const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ScorePage = require("../assets/js/scores.js");

const RANGE = "2026.11.3\u201311.5";
const REPORT_DATE = "2026-11-07";
const ORIGINAL_SEVEN = ["chinese", "math", "english", "history", "biology", "geography", "morals"];
const HISTORICAL = [
  { date: "2025-09-08", name: "初一第一学期暑假作业验收", grade: "G8", scores: { chinese: 90, math: 85, english: 77.5 } },
  { date: "2025-10-09", name: "初一第一学期10月月考", grade: "G8", scores: { chinese: 79, math: 86, english: 90.5 } },
  { date: "2025-11-04", name: "初一第一学期期中考试", grade: "G6", scores: { chinese: 78.5, math: 80, english: 90, history: 88, biology: 81, geography: 77, morals: 86 } },
  { date: "2025-12-01", name: "初一第一学期12月月考", grade: "G8", scores: { chinese: 71, math: 77, english: 77 } },
  { date: "2026-01-12", name: "初一第一学期期末考试", grade: "G7", scores: { chinese: 73, math: 82, english: 87, history: 85, biology: 85, geography: 93, morals: 89 } },
  { date: "2026-03-09", name: "初一第二学期寒假作业验收", grade: "G7", scores: { chinese: 87, math: 83, english: 79 } },
  { date: "2026-04-20", name: "初一第二学期期中考试", grade: "G7", scores: { chinese: 83, math: 79, english: 89.5, history: 87, biology: 87, geography: 91, morals: 79 } },
  { date: "2026-05-26", name: "初一第二学期5月月考", grade: "G8", scores: { chinese: 80, math: 84, english: 79.5 } },
  { date: "2026-06-29", name: "初一第二学期期末考试", grade: "G8", scores: { chinese: 76, math: 82, english: 82, history: 89, biology: 96, geography: 90, morals: 86 } },
  { date: "2026-09-20", name: "初二第一学期9月月考", grade: "G8", scores: { chinese: 85, math: 85, english: 88 } }
];
const SEVEN_TOTALS = {
  "2025-11-04": { sum: 580.5, delta: "—" },
  "2026-01-12": { sum: 594, delta: "+13.5" },
  "2026-04-20": { sum: 595.5, delta: "+1.5" },
  "2026-06-29": { sum: 601, delta: "+5.5" }
};

function stripComment(line) {
  let out = "";
  let quote = null;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote) {
      out += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === "#") break;
    out += ch;
  }
  return out.replace(/\s+$/, "");
}

function scalar(raw) {
  const value = raw.trim();
  if (!value) return null;
  if ((value[0] === '"' && value[value.length - 1] === '"') || (value[0] === "'" && value[value.length - 1] === "'")) {
    return value.slice(1, -1);
  }
  if (/^-?\d+$/.test(value)) return Number(value);
  if (/^-?\d+\.\d+$/.test(value)) return Number(value);
  return value;
}

function splitKey(text) {
  const trimmed = text.trim().replace(/^-\s+/, "");
  const index = trimmed.indexOf(":");
  if (index < 0) throw new Error("Expected key: " + text);
  return [trimmed.slice(0, index).trim(), trimmed.slice(index + 1)];
}

function loadScores(text) {
  const data = { subjects: [], core: [], totals: [], exams: [] };
  let section = null;
  let subject = null;
  let total = null;
  let exam = null;
  let inKeys = false;
  let inScores = false;
  for (const rawLine of text.split(/\n/)) {
    const line = stripComment(rawLine);
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) {
      const key = line.replace(/:.*/, "");
      if (key !== "subjects" && key !== "core" && key !== "totals" && key !== "exams") {
        throw new Error("Unexpected top-level line: " + line);
      }
      section = key;
      subject = null;
      total = null;
      exam = null;
      inKeys = false;
      inScores = false;
      continue;
    }
    const trimmed = line.trim();
    if (section === "subjects") {
      if (trimmed.startsWith("- ")) {
        subject = {};
        const pair = splitKey(trimmed);
        subject[pair[0]] = scalar(pair[1]);
        data.subjects.push(subject);
      } else {
        const pair = splitKey(trimmed);
        subject[pair[0]] = scalar(pair[1]);
      }
    } else if (section === "core") {
      data.core.push(scalar(trimmed.replace(/^-\s+/, "")));
    } else if (section === "totals") {
      if (trimmed.startsWith("- ") && trimmed.includes(":")) {
        const pair = splitKey(trimmed);
        total = { id: scalar(pair[1]), keys: [] };
        data.totals.push(total);
        inKeys = false;
      } else if (trimmed.startsWith("- ")) {
        total.keys.push(scalar(trimmed.replace(/^-\s+/, "")));
      } else if (trimmed === "keys:") {
        inKeys = true;
      } else {
        const pair = splitKey(trimmed);
        total[pair[0]] = scalar(pair[1]);
      }
    } else if (section === "exams") {
      if (trimmed.startsWith("- ")) {
        const pair = splitKey(trimmed);
        exam = { scores: {} };
        exam[pair[0]] = scalar(pair[1]);
        data.exams.push(exam);
        inScores = false;
      } else if (trimmed === "scores:") {
        inScores = true;
      } else {
        const pair = splitKey(trimmed);
        if (inScores) exam.scores[pair[0]] = scalar(pair[1]);
        else exam[pair[0]] = scalar(pair[1]);
      }
    } else {
      throw new Error("Line outside section: " + line);
    }
  }
  return data;
}

function extractData(html) {
  const marker = "const DATA = ";
  const start = html.indexOf(marker);
  assert.ok(start >= 0, "built score page is missing DATA");
  const jsonStart = start + marker.length;
  assert.equal(html[jsonStart], "{");
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = jsonStart; i < html.length; i += 1) {
    const ch = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return JSON.parse(html.slice(jsonStart, i + 1));
    }
  }
  throw new Error("unterminated DATA");
}

function assertRecord(data) {
  assert.deepEqual(data.subjects.map((subject) => subject.key), ["chinese", "math", "english", "physics", "history", "biology", "geography", "morals"]);
  assert.deepEqual(data.core, ["chinese", "math", "english"]);
  for (const subject of data.subjects) {
    assert.deepEqual(Object.keys(subject).sort(), ["color", "key", "label"]);
  }
  assert.equal(data.subjects.find((subject) => subject.key === "physics").label, "物理");
  assert.equal(data.subjects.find((subject) => subject.key === "physics").color, "var(--subject-physics)");
  assert.equal(data.subjects.find((subject) => subject.key === "biology").label, "生物");
  assert.equal(data.subjects.find((subject) => subject.key === "morals").label, "道法");

  const totals = ScorePage.totalDefinitions(data);
  assert.deepEqual(totals.find((total) => total.id === "total7").keys, ORIGINAL_SEVEN);
  assert.deepEqual(totals.find((total) => total.id === "total8").keys, ["chinese", "math", "english", "physics", "history", "biology", "geography", "morals"]);
  assert.deepEqual(data.exams.map((exam) => exam.date), HISTORICAL.map((exam) => exam.date).concat(["2026-11-03"]));

  HISTORICAL.forEach((expected, index) => {
    const exam = data.exams[index];
    assert.equal(exam.name, expected.name);
    assert.equal(exam.grade, expected.grade);
    assert.deepEqual(exam.scores, expected.scores);
    assert.equal(exam.date_end, undefined);
    assert.equal(exam.out_of, undefined);
    assert.equal(Object.hasOwn(exam.scores, "physics"), false);
    assert.equal(ScorePage.scoreOf(exam, "physics"), null);
    assert.notEqual(ScorePage.scoreOf(exam, "physics"), 0);
    assert.equal(ScorePage.subjectCell(exam, "physics").text, "—");
    assert.equal(ScorePage.subjectCell(exam, "physics").missing, true);
    for (const key of Object.keys(exam.scores)) assert.ok(ORIGINAL_SEVEN.includes(key));
  });

  const rows = ScorePage.tableModel(data);
  const byName = Object.fromEntries(rows.map((row) => [row.name, row]));
  for (const [date, expected] of Object.entries(SEVEN_TOTALS)) {
    const exam = data.exams.find((item) => item.date === date);
    const full = ScorePage.fullestTotal(exam, totals);
    assert.equal(full.id, "total7");
    assert.equal(full.sum, expected.sum);
    assert.equal(ScorePage.sumOf(exam, ORIGINAL_SEVEN), expected.sum);
    assert.equal(byName[exam.name].totalText, String(expected.sum));
    assert.equal(byName[exam.name].scaleText, "七门");
    assert.equal(byName[exam.name].deltaText, expected.delta);
    assert.equal(byName[exam.name].subjects.find((cell) => cell.key === "physics").text, "—");
  }

  for (const exam of data.exams.slice(0, HISTORICAL.length)) {
    const full = ScorePage.fullestTotal(exam, totals);
    if (Object.keys(exam.scores).length < ORIGINAL_SEVEN.length) {
      assert.equal(full, null);
      assert.equal(ScorePage.sumOf(exam, ORIGINAL_SEVEN), null);
      assert.equal(byName[exam.name].totalText, "—");
      assert.equal(byName[exam.name].scaleText, "—");
    }
    assert.notEqual(exam.date, REPORT_DATE);
    assert.notEqual(exam.date_end, REPORT_DATE);
  }

  const mid = data.exams[data.exams.length - 1];
  assert.equal(mid.name, "初二第一学期期中考试");
  assert.equal(mid.date, "2026-11-03");
  assert.equal(mid.date_end, "2026-11-05");
  assert.ok(mid.date < mid.date_end);
  assert.equal(typeof mid.date, "string");
  assert.equal(typeof mid.date_end, "string");
  assert.notEqual(mid.date, REPORT_DATE);
  assert.notEqual(mid.date_end, REPORT_DATE);
  assert.equal(mid.grade, "G8");
  assert.equal(ScorePage.gradeValue(mid.grade), 8);
  assert.equal(ScorePage.rankCell(mid).text, "G8");
  assert.equal(ScorePage.rankCell(mid).missing, false);
  assert.equal(ScorePage.rankCell(mid).title, "G8 · 年级前 20\u201330%");
  assert.equal(mid.out_of, 800);
  assert.deepEqual(mid.scores, {
    chinese: 81.5,
    math: 77,
    english: 93.5,
    physics: 86,
    biology: 95,
    history: 88,
    geography: 85,
    morals: 85.5
  });
  const manual = 81.5 + 77 + 93.5 + 86 + 95 + 88 + 85 + 85.5;
  assert.equal(manual, 691.5);
  assert.equal(ScorePage.sumOf(mid, totals.find((total) => total.id === "total8").keys), 691.5);
  assert.equal(ScorePage.sumOf(mid, ORIGINAL_SEVEN), 605.5);
  const full = ScorePage.fullestTotal(mid, totals);
  assert.equal(full.id, "total8");
  assert.equal(full.label, "八门");
  assert.equal(full.sum, 691.5);
  assert.equal(ScorePage.publishedSum(mid, totals.find((total) => total.id === "total7"), totals), null);
  assert.equal(ScorePage.previousComparable(data.exams, data.exams.length - 1, totals), null);
  assert.equal(ScorePage.formatDate(mid.date), "2026.11.3");
  assert.equal(ScorePage.formatDate(mid.date_end), "2026.11.5");
  assert.equal(ScorePage.formatExamDate(mid), RANGE);
  assert.equal(ScorePage.chartDateISO(mid), "2026-11-03");
  assert.notEqual(ScorePage.formatDate(mid.date + "/" + mid.date_end), RANGE);

  const summary = ScorePage.latestSummary(data);
  assert.equal(summary.name, mid.name);
  assert.equal(summary.date, RANGE);
  assert.equal(summary.totalLabel, "八门总分");
  assert.equal(summary.totalText, "691.5");
  assert.equal(summary.totalHint, "满分 800");
  assert.equal(summary.totalTone, "");
  assert.equal(summary.coreText, "252");
  assert.equal(summary.coreDelta, "-6");
  assert.equal(summary.coreTone, "down");
  assert.equal(summary.rankText, "G8");
  assert.equal(summary.rankHint, "G8 · 年级前 20\u201330%");

  const midRow = rows[0];
  assert.equal(midRow.name, mid.name);
  assert.equal(midRow.date, RANGE);
  assert.equal(midRow.totalText, "691.5");
  assert.equal(midRow.scaleText, "八门");
  assert.equal(midRow.deltaText, "—");
  assert.equal(midRow.coreText, "252");
  assert.equal(midRow.rank.text, "G8");
  assert.equal(midRow.rank.missing, false);
  assert.equal(midRow.outOf, 800);
  assert.deepEqual(Object.fromEntries(midRow.subjects.map((cell) => [cell.key, cell.text])), {
    chinese: "81.5",
    math: "77",
    english: "93.5",
    physics: "86",
    history: "88",
    biology: "95",
    geography: "85",
    morals: "85.5"
  });

  const sevenSeries = ScorePage.seriesValues(data, "total7");
  const sevenByDate = Object.fromEntries(sevenSeries.map((point) => [point.date, point.value]));
  assert.equal(sevenByDate["2025-11-04"], 580.5);
  assert.equal(sevenByDate["2026-01-12"], 594);
  assert.equal(sevenByDate["2026-04-20"], 595.5);
  assert.equal(sevenByDate["2026-06-29"], 601);
  assert.equal(sevenByDate["2026-09-20"], null);
  assert.equal(sevenByDate["2026-11-03"], null);
  assert.equal(sevenSeries.some((point) => point.value === 605.5), false);
  assert.equal(sevenSeries.some((point) => point.date === REPORT_DATE), false);
  const eightSeries = ScorePage.seriesValues(data, "total8").filter((point) => point.value !== null);
  assert.deepEqual(eightSeries, [{ date: "2026-11-03", value: 691.5 }]);
  const coreSeries = ScorePage.seriesValues(data, "core3");
  assert.equal(coreSeries.find((point) => point.date === "2026-11-03").value, 252);
  assert.equal(coreSeries.find((point) => point.date === "2026-09-20").value, 258);
  assert.equal(coreSeries.every((point) => point.value !== null), true);

  const grades = ScorePage.gradePoints(data);
  assert.equal(grades.length, HISTORICAL.length + 1);
  assert.equal(grades[grades.length - 1].date, "2026-11-03");
  assert.equal(grades[grades.length - 1].grade, "G8");
  assert.equal(grades[grades.length - 1].value, 8);
  assert.deepEqual(ScorePage.viewModes(data).map((mode) => mode.label), ["语数英", "七门总分", "八门总分", "单科"]);
}

const yaml = fs.readFileSync("_data/scores.yml", "utf8");
const data = loadScores(yaml);
assertRecord(data);

const midSource = yaml.slice(yaml.indexOf('date: "2026-11-03"'));
assert.match(yaml, /date: "2026-11-03"/);
assert.match(yaml, /date_end: "2026-11-05"/);
assert.match(midSource, /grade: G8/);
assert.equal(midSource.includes(REPORT_DATE), false);
assert.equal(yaml.includes("max:"), false);

const omitted = { scores: { chinese: 10, math: 10, english: 10, history: 10, biology: 10, geography: 10, morals: 10 } };
const totals = ScorePage.totalDefinitions(data);
assert.equal(ScorePage.fullestTotal(omitted, totals).id, "total7");
assert.equal(ScorePage.fullestTotal(omitted, totals).sum, 70);
assert.equal(ScorePage.subjectCell(omitted, "physics").text, "—");
const zero = { scores: Object.assign({ physics: 0 }, omitted.scores) };
assert.equal(ScorePage.scoreOf(zero, "physics"), 0);
assert.equal(ScorePage.subjectCell(zero, "physics").text, "0");
assert.equal(ScorePage.subjectCell(zero, "physics").missing, false);
assert.equal(ScorePage.fullestTotal(zero, totals).id, "total8");
assert.equal(ScorePage.fullestTotal(zero, totals).sum, 70);
assert.equal(ScorePage.formatExamDate({ date: "2025-11-04" }), "2025.11.4");
assert.equal(ScorePage.formatExamDate({ date: "2026-11-30", date_end: "2026-12-02" }), "2026.11.30\u201312.2");
assert.equal(ScorePage.formatExamDate({ date: "2026-12-30", date_end: "2027-01-02" }), "2026.12.30\u20132027.1.2");
assert.equal(ScorePage.gradeLabel("G8"), "G8 · 年级前 20\u201330%");
assert.equal(ScorePage.gradeValue("G8"), 8);
assert.equal(ScorePage.gradeValue("初二"), null);

const html = fs.readFileSync("score.html", "utf8");
assert.equal(html.split("--subject-physics:").length - 1, 2);
assert.match(html, /\/assets\/js\/scores\.js/);
assert.match(html, /formatExamDate/);
assert.match(html, /latestSummary/);
assert.match(html, /tableModel/);
assert.match(html, /seriesValues/);
assert.match(html, /gradePoints/);
assert.equal(html.includes("691.5"), false);
assert.equal(html.includes(REPORT_DATE), false);
const inline = html.slice(html.lastIndexOf("<script>"));
const source = inline.slice("<script>".length, inline.indexOf("</script>")).replace(
  "{{ site.data.scores | jsonify }}",
  JSON.stringify(data)
);
new vm.Script(source, { filename: "score.html" });

const builtPath = "_site/score.html";
if (fs.existsSync(builtPath)) {
  const built = fs.readFileSync(builtPath, "utf8");
  assert.equal(built.includes(REPORT_DATE), false);
  assert.match(built, /\/assets\/js\/scores\.js/);
  assert.equal(built.split("--subject-physics:").length - 1, 2);
  assertRecord(extractData(built));
  console.log("scores ok, including built page");
} else {
  console.log("scores ok");
}
