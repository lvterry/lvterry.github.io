/* 成绩页的计分口径。score.html 只负责画图。
   缺的科目是 null，不是 0。0 表示确实考了 0 分。
   七门和八门各自成总分；一次考试只公布科目更多的那一档，
   不同档的总分不相减。日期必须是 "YYYY-MM-DD" 字符串，
   formatDate 靠 split 拆开。跨日考试另给结束日，横轴用开始日。 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ScorePage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function scoreOf(exam, key) {
    if (!exam || !exam.scores) return null;
    var value = exam.scores[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function sumOf(exam, keys) {
    if (!keys || !keys.length) return null;
    var total = 0;
    for (var i = 0; i < keys.length; i += 1) {
      var value = scoreOf(exam, keys[i]);
      if (value === null) return null;
      total += value;
    }
    return total;
  }

  function formatScore(value) {
    return value === null || value === undefined ? "—" : String(value);
  }

  function formatDate(iso) {
    var parts = iso.split("-");
    return parts[0] + "." + Number(parts[1]) + "." + Number(parts[2]);
  }

  function formatExamDate(exam) {
    var start = formatDate(exam.date);
    if (typeof exam.date_end !== "string" || exam.date_end === exam.date) return start;
    var startParts = exam.date.split("-");
    var endParts = exam.date_end.split("-");
    if (startParts[0] === endParts[0]) {
      return start + "\u2013" + Number(endParts[1]) + "." + Number(endParts[2]);
    }
    return start + "\u2013" + formatDate(exam.date_end);
  }

  function formatDelta(value) {
    if (value === null || value === undefined) return "—";
    return value > 0 ? "+" + value : String(value);
  }

  function bandLabel(grade) {
    if (grade === null || grade === undefined) return "";
    var match = /^G(\d{1,2})$/.exec(String(grade));
    if (!match) return grade;
    var band = Number(match[1]);
    if (band < 1 || band > 10) return grade;
    var lower = (10 - band) * 10;
    return lower === 0 ? "年级前 " + (lower + 10) + "%" : "年级前 " + lower + "\u2013" + (lower + 10) + "%";
  }

  function gradeLabel(grade) {
    if (grade === null || grade === undefined) return "";
    var band = bandLabel(grade);
    return band === grade ? grade : grade + " · " + band;
  }

  function gradeValue(grade) {
    var match = /^G(\d{1,2})$/.exec(String(grade === null || grade === undefined ? "" : grade));
    return match ? Number(match[1]) : null;
  }

  function totalDefinitions(data) {
    if (data && Array.isArray(data.totals) && data.totals.length) {
      return data.totals.map(function (total) {
        return {
          id: String(total.id),
          label: String(total.label),
          keys: Array.isArray(total.keys) ? total.keys.slice() : []
        };
      });
    }
    var keys = ((data && data.subjects) || []).map(function (subject) { return subject.key; });
    return [{ id: "all", label: "全科", keys: keys }];
  }

  function fullestTotal(exam, totals) {
    var best = null;
    for (var i = 0; i < totals.length; i += 1) {
      var total = totals[i];
      var sum = sumOf(exam, total.keys);
      if (sum === null) continue;
      if (!best || total.keys.length > best.keys.length) {
        best = { id: total.id, label: total.label, keys: total.keys.slice(), sum: sum };
      }
    }
    return best;
  }

  function publishedSum(exam, total, totals) {
    var full = fullestTotal(exam, totals);
    if (!full || full.id !== total.id) return null;
    return full.sum;
  }

  function previousComparable(exams, index, totals) {
    var current = fullestTotal(exams[index], totals);
    if (!current) return null;
    for (var i = index - 1; i >= 0; i -= 1) {
      var older = fullestTotal(exams[i], totals);
      if (older && older.id === current.id) {
        return { index: i, sum: older.sum, delta: current.sum - older.sum };
      }
    }
    return null;
  }

  function previousSum(exams, index, keys) {
    var current = sumOf(exams[index], keys);
    if (current === null) return null;
    for (var i = index - 1; i >= 0; i -= 1) {
      var older = sumOf(exams[i], keys);
      if (older !== null) return { index: i, sum: older, delta: current - older };
    }
    return null;
  }

  function chartDateISO(exam) {
    return exam.date;
  }

  function subjectCell(exam, key) {
    var value = scoreOf(exam, key);
    return { value: value, text: formatScore(value), missing: value === null };
  }

  function totalCell(exam, totals) {
    var full = fullestTotal(exam, totals);
    if (!full) return { id: null, sum: null, text: "—", label: "—", missing: true };
    return { id: full.id, sum: full.sum, text: formatScore(full.sum), label: full.label, missing: false };
  }

  function deltaCell(exams, index, totals) {
    var previous = previousComparable(exams, index, totals);
    var delta = previous ? previous.delta : null;
    return { delta: delta, text: formatDelta(delta) };
  }

  function rankCell(exam) {
    if (!exam.grade) return { text: "—", title: "", missing: true };
    return { text: String(exam.grade), title: gradeLabel(exam.grade), missing: false };
  }

  function fullTotalHint(exam, delta) {
    var hasMax = typeof exam.out_of === "number" && Number.isFinite(exam.out_of);
    if (delta === null || delta === undefined) return hasMax ? "满分 " + exam.out_of : "—";
    var deltaText = formatDelta(delta);
    return hasMax ? "满分 " + exam.out_of + " · " + deltaText : deltaText;
  }

  function latestSummary(data) {
    var exams = data.exams || [];
    var latest = exams[exams.length - 1];
    var totals = totalDefinitions(data);
    var full = fullestTotal(latest, totals);
    var previous = previousComparable(exams, exams.length - 1, totals);
    var delta = previous ? previous.delta : null;
    var corePrevious = previousSum(exams, exams.length - 1, data.core);
    var coreDelta = corePrevious ? corePrevious.delta : null;
    return {
      name: latest.name,
      date: formatExamDate(latest),
      totalLabel: full ? full.label + "总分" : "全科总分",
      totalText: full ? formatScore(full.sum) : "—",
      totalHint: full ? fullTotalHint(latest, delta) : "当次仅公布语数英",
      totalTone: delta > 0 ? "up" : delta < 0 ? "down" : "",
      coreText: formatScore(sumOf(latest, data.core)),
      coreDelta: formatDelta(coreDelta),
      coreTone: coreDelta > 0 ? "up" : coreDelta < 0 ? "down" : "",
      rankText: latest.grade ? String(latest.grade) : "—",
      rankHint: latest.grade ? gradeLabel(latest.grade) : "当次未公布"
    };
  }

  function viewModes(data) {
    return [{ id: "core3", label: "语数英" }]
      .concat(totalDefinitions(data).map(function (total) {
        return { id: total.id, label: total.label + "总分" };
      }))
      .concat([{ id: "subject", label: "单科" }]);
  }

  function tableModel(data) {
    var exams = data.exams || [];
    var totals = totalDefinitions(data);
    var subjects = data.subjects || [];
    return exams.map(function (exam, index) {
      var total = totalCell(exam, totals);
      var delta = deltaCell(exams, index, totals);
      return {
        date: formatExamDate(exam),
        name: exam.name,
        subjects: subjects.map(function (subject) {
          var cell = subjectCell(exam, subject.key);
          return { key: subject.key, label: subject.label, text: cell.text, missing: cell.missing, value: cell.value };
        }),
        coreText: formatScore(sumOf(exam, data.core)),
        totalText: total.text,
        scaleText: total.label,
        deltaText: delta.text,
        delta: delta.delta,
        rank: rankCell(exam),
        outOf: typeof exam.out_of === "number" ? exam.out_of : null
      };
    }).reverse();
  }

  function seriesValues(data, mode) {
    var totals = totalDefinitions(data);
    var exams = data.exams || [];
    var totalDef = null;
    for (var i = 0; i < totals.length; i += 1) {
      if (totals[i].id === mode) totalDef = totals[i];
    }
    if (totalDef) {
      return exams.map(function (exam) {
        return { date: chartDateISO(exam), value: publishedSum(exam, totalDef, totals) };
      });
    }
    if (mode === "core3") {
      return exams.map(function (exam) {
        return { date: chartDateISO(exam), value: sumOf(exam, data.core) };
      });
    }
    return null;
  }

  function gradePoints(data) {
    return (data.exams || []).map(function (exam, index) {
      var value = gradeValue(exam.grade);
      if (value === null) return null;
      return { index: index, date: chartDateISO(exam), grade: exam.grade, value: value };
    }).filter(Boolean);
  }

  return {
    scoreOf: scoreOf,
    sumOf: sumOf,
    formatScore: formatScore,
    formatDate: formatDate,
    formatExamDate: formatExamDate,
    formatDelta: formatDelta,
    bandLabel: bandLabel,
    gradeLabel: gradeLabel,
    gradeValue: gradeValue,
    totalDefinitions: totalDefinitions,
    fullestTotal: fullestTotal,
    publishedSum: publishedSum,
    previousComparable: previousComparable,
    previousSum: previousSum,
    chartDateISO: chartDateISO,
    subjectCell: subjectCell,
    totalCell: totalCell,
    deltaCell: deltaCell,
    rankCell: rankCell,
    fullTotalHint: fullTotalHint,
    latestSummary: latestSummary,
    viewModes: viewModes,
    tableModel: tableModel,
    seriesValues: seriesValues,
    gradePoints: gradePoints
  };
});
