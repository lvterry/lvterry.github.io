const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ClassPage = require("../assets/js/classes.js");
const { loadClassesYaml } = require("./classes-yaml.cjs");

const TODAY = "2026-11-22";
const BASELINE = {
  spanish: { purchased: 44, attended: 34, remaining: 10, payments: 5, spend: 13200, sessions: 34 },
  boxing: { purchased: 40, attended: 37, remaining: 3, payments: 4, spend: 16000, sessions: 37, onCard: 7, cardSize: 10 }
};

function balances(courses, today) {
  const out = {};
  courses.forEach((course) => {
    out[course.key] = ClassPage.summarize(course, today || TODAY);
  });
  return out;
}

function assertBaseline(courses) {
  const got = balances(courses);
  for (const key of Object.keys(BASELINE)) {
    const expect = BASELINE[key];
    const actual = got[key];
    assert.ok(actual, key);
    for (const field of Object.keys(expect)) {
      const value = field === "payments" ? actual.payments.length : field === "sessions" ? actual.sessions.length : actual[field];
      assert.equal(value, expect[field], key + " " + field);
    }
  }
  const spanish = got.spanish;
  assert.equal(spanish.sessions.filter((session) => session.date > "2026-11-05").length, 1);
  assert.equal(spanish.onCard, 1);
  assert.equal(spanish.cardSize, 10);
  assert.equal(got.boxing.sessions.some((session) => session.date === "2026-08-31"), false);
  assert.equal(got.boxing.lastPayment.date, "2026-08-31");
}

const yaml = fs.readFileSync("_data/classes.yml", "utf8");
const snapshot = loadClassesYaml(yaml);
assert.equal(snapshot.snapshot_as_of, "2026-11-22");
const archived = ClassPage.coursesFromSnapshot(snapshot);
assertBaseline(archived);
assert.equal(ClassPage.colorFor("spanish"), "var(--course-spanish)");
assert.equal(ClassPage.colorFor("boxing"), "var(--course-boxing)");
assert.equal(archived[0].color, "var(--course-spanish)");
assert.equal(archived[1].key, "boxing");
const poisoned = ClassPage.coursesFromSnapshot({
  courses: [{ key: "spanish", label: "西班牙语课", emoji: "🇪🇸", color: "red;}</style><script>", payments: [], sessions: [] }]
});
assert.equal(poisoned[0].color, "var(--course-spanish)");

const serialRows = ClassPage.rowsFromGvizText(fs.readFileSync("tests/fixtures/classes/gviz-serial.txt", "utf8"));
assert.equal(serialRows.length, 2);
assert.equal(serialRows[0].date, "2025-01-16");
assert.equal(serialRows[1].date, "2026-11-22");
assert.equal(serialRows[0].credits, 1);
assert.equal(ClassPage.normalizeDate(45673), "2025-01-16");
assert.equal(ClassPage.normalizeDate("Date(2026,10,22)"), "2026-11-22");
assert.equal(ClassPage.normalizeDate("Date(2025,1,29)"), null);
assert.equal(ClassPage.normalizeDate("2026-11-22"), "2026-11-22");
assert.equal(ClassPage.normalizeNumber("¥1,200"), 1200);
assert.equal(ClassPage.normalizeNumber("3,000"), 3000);
assert.equal(ClassPage.normalizeNumber(1200), 1200);

const edgeRows = ClassPage.rowsFromGvizText(fs.readFileSync("tests/fixtures/classes/gviz-edge.txt", "utf8"));
assert.equal(edgeRows.length, 3);
assert.equal(edgeRows[0].date, "2026-11-22");
assert.equal(edgeRows[0].note.includes("<img"), true);
assert.equal(Object.prototype.polluted, undefined);
assert.equal(edgeRows[1].credits, 2);
assert.equal(edgeRows[2].course_key.includes("svg"), true);

const amountTable = {
  cols: [
    { label: "course_key", type: "string" },
    { label: "date", type: "number", pattern: "yyyy-mm-dd" },
    { label: "amount", type: "number", pattern: "#,##0" },
    { label: "credits", type: "number", pattern: "#,##0" }
  ],
  rows: [{ c: [{ v: "spanish" }, { v: 45667, f: "2025-01-10" }, { v: 1200, f: "1,200" }, { v: 4, f: "4" }] }]
};
const amountRows = ClassPage.rowsFromGvizPayload({ status: "ok", table: amountTable });
assert.equal(amountRows[0].date, "2025-01-10");
assert.equal(amountRows[0].amount, 1200);
assert.equal(amountRows[0].credits, 4);

const paymentRows = ClassPage.parseCsv(fs.readFileSync("tests/fixtures/classes/payments-edge.csv", "utf8"));
assert.equal(paymentRows.length, 5);
assert.equal(paymentRows[0].amount, "¥3,000");
assert.equal(paymentRows[1].note, '白天说的"加课",不是 HTML <script>');
const edged = ClassPage.assemble({
  courses: [
    { course_key: " spanish ", label: "西班牙语课<script>", emoji: "🇪🇸", sort_order: "2", color: "expression(alert(1))" },
    { course_key: "boxing\"><img>", label: "坏键", emoji: "🥊", sort_order: 1 }
  ],
  sessions: edgeRows.concat([{ course_key: "spanish", date: "", note: "空日期" }, { course_key: "", date: "2026-01-01" }]),
  payments: paymentRows
});
assert.deepEqual(edged.map((course) => course.key), ["spanish"]);
assert.equal(edged[0].color, "var(--course-spanish)");
assert.equal(edged[0].label.includes("<script>"), true);
assert.equal(ClassPage.escapeHtml(edged[0].label).includes("<script>"), false);
assert.equal(edged[0].sessions.length, 1);
assert.equal(edged[0].sessions[0].date, "2026-11-22");
assert.equal(edged[0].sessions[0].note.includes("<img"), true);
assert.equal(edgeRows[1].date, "");
assert.equal(edged[0].payments.length, 1);
assert.equal(edged[0].payments[0].amount, 3000);
assert.equal(ClassPage.isSafeKey("spanish\"><img"), false);

const sameDay = ClassPage.summarize({
  key: "boxing",
  sessions: [{ date: "2026-08-30" }, { date: "2026-08-31" }, { date: "2026-09-01" }],
  payments: [{ date: "2026-08-31", amount: 4000, credits: 10 }]
}, TODAY);
assert.equal(sameDay.onCard, 1);
assert.equal(sameDay.cardSize, 10);
assert.equal(sameDay.attended, 3);

assert.throws(() => ClassPage.rowsFromGvizText("<!DOCTYPE html><html>login</html>"));
assert.throws(() => ClassPage.parseCsv("<html><body>no</body></html>"));
assert.throws(() => ClassPage.rowsFromGvizPayload({ status: "error", errors: [{ reason: "access_denied" }] }));

const sessionUrl = ClassPage.sheetUrl(ClassPage.SHEET_ID, "gviz", ClassPage.TABS.sessions, "123");
assert.equal(sessionUrl.startsWith("https://docs.google.com/spreadsheets/d/" + ClassPage.SHEET_ID + "/gviz/tq?"), true);
assert.equal(sessionUrl.includes("sheet=Sessions"), true);
assert.equal(sessionUrl.includes("gid=1212152675"), true);
assert.equal(sessionUrl.includes("_=123"), true);
assert.equal(sessionUrl.includes("key="), false);
assert.equal(sessionUrl.includes("AIza"), false);
assert.equal(ClassPage.sheetUrl(ClassPage.SHEET_ID, "csv", ClassPage.TABS.payments, "9").includes("gid=188672671"), true);
assert.equal(JSON.stringify(ClassPage.TABS).includes("1799790277"), false);
assert.throws(() => ClassPage.sheetUrl("https://evil.example/sheet", "gviz", ClassPage.TABS.sessions, "1"));

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body
  };
}

(async () => {
  const calls = [];
  await assert.rejects(() => ClassPage.loadTab(ClassPage.TABS.sessions, {
    fetch(url, init) {
      calls.push({ url, init });
      return Promise.resolve(response(401, "<!DOCTYPE html>"));
    },
    document: { createElement() { throw new Error("jsonp should not run"); }, head: { appendChild() {} } },
    globalObject: {},
    sheetId: ClassPage.SHEET_ID,
    cacheKey: "1",
    timeoutMs: 200
  }));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.credentials, "omit");
  assert.equal(calls[0].init.cache, "no-store");
  assert.equal(calls[0].init.method, "GET");

  const globalObject = {};
  let scriptSrc = "";
  const tables = await ClassPage.loadSheets({
    now: () => 111,
    timeoutMs: 200,
    fetch(url) {
      return Promise.reject(new Error("cors"));
    },
    globalObject,
    document: {
      createElement() {
        return {
          async: false,
          set src(value) {
            scriptSrc = value;
            const name = /responseHandler%3A([A-Za-z0-9_]+)|responseHandler:([A-Za-z0-9_]+)/.exec(value);
            const callback = name[1] || name[2];
            globalObject[callback]({ status: "ok", table: amountTable });
          },
          parentNode: { removeChild() {} }
        };
      },
      head: { appendChild() {} }
    }
  });
  assert.equal(tables.courses[0].date, "2025-01-10");
  assert.equal(tables.sessions[0].amount, 1200);
  assert.equal(scriptSrc.includes("responseHandler"), true);
  assert.equal(scriptSrc.includes("_=111"), true);

  const denied = await ClassPage.start({
    snapshot,
    load() { return Promise.reject(new Error("sheet is not public")); },
    onStatus() {},
    onReady() {}
  });
  assert.equal(denied.source, "snapshot");
  assert.match(ClassPage.staleBanner(snapshot).text, /2026\.11\.22 存档，不是实时数据/);
  const live = await ClassPage.start({
    snapshot,
    load() {
      return Promise.resolve({
        courses: [{ course_key: "boxing", label: "拳击课", emoji: "🥊", sort_order: 1 }],
        sessions: [],
        payments: []
      });
    },
    onStatus(status) {
      if (status.kind === "live") assert.equal(status.text, "");
    },
    onReady() {}
  });
  assert.equal(live.source, "sheet");
  assert.equal(live.courses[0].key, "boxing");
  assert.equal(live.courses.length, 1);

  const html = fs.readFileSync("class.html", "utf8");
  assert.match(html, /\/assets\/js\/classes\.js/);
  assert.match(html, /id="sheet-status"/);
  assert.match(html, /statusEl\.textContent = status\.text/);
  assert.equal(html.includes("const DATA = {{ site.data.classes"), false);
  assert.match(html, /const SNAPSHOT = \{\{ site\.data\.classes \| jsonify \}\}/);
  assert.equal(html.includes("AIza"), false);
  assert.equal(html.includes("access_token"), false);
  assert.equal(fs.readFileSync("assets/js/classes.js", "utf8").includes("eval("), false);

  const ids = {};
  function element(tag) {
    const node = {
      tagName: String(tag || "div").toUpperCase(),
      id: "",
      className: "",
      hidden: false,
      textContent: "",
      children: [],
      style: {},
      clientWidth: 900,
      _html: "",
      append(child) { this.children.push(child); },
      appendChild(child) { this.children.push(child); return child; },
      addEventListener() {}
    };
    Object.defineProperty(node, "innerHTML", {
      get() { return node._html; },
      set(value) {
        node._html = String(value);
        const re = /id="([^"]+)"/g;
        let match;
        while ((match = re.exec(node._html))) {
          ids[match[1]] = element("div");
          ids[match[1]].id = match[1];
        }
      }
    });
    return node;
  }
  ["sheet-loading", "sheet-status", "glance", "courses"].forEach((id) => {
    ids[id] = element("div");
    ids[id].id = id;
  });
  function chain() {
    const node = {
      select: () => chain(),
      selectAll: () => chain(),
      append: () => chain(),
      attr: () => chain(),
      style: () => chain(),
      text: () => chain(),
      data: () => chain(),
      join: () => chain(),
      on: () => chain(),
      remove: () => chain(),
      node: () => ({ offsetWidth: 30, offsetHeight: 16 }),
      call(fn) { if (typeof fn === "function") fn(chain()); return chain(); }
    };
    return node;
  }
  function scale() {
    const fn = () => 12;
    fn.domain = () => fn;
    fn.range = () => fn;
    fn.padding = () => fn;
    fn.nice = () => fn;
    fn.bandwidth = () => 6;
    return fn;
  }
  function axis() {
    const fn = () => {};
    fn.ticks = () => fn;
    fn.tickSize = () => fn;
    fn.tickFormat = () => fn;
    fn.tickValues = () => fn;
    return fn;
  }
  const context = vm.createContext({
    ClassPage,
    document: {
      getElementById: (id) => ids[id],
      createElement: element,
      documentElement: {}
    },
    window: { addEventListener() {}, matchMedia: () => ({ addEventListener() {} }) },
    getComputedStyle: () => ({ getPropertyValue: () => "#777" }),
    d3: { max: () => 2, scaleBand: scale, scaleLinear: scale, axisLeft: axis, axisBottom: axis, select: () => chain() }
  });
  context.window.matchMedia = context.window.matchMedia;
  const realLoad = ClassPage.loadSheets;
  ClassPage.loadSheets = () => Promise.resolve({
    courses: [{ course_key: "spanish", label: "西班牙语课", emoji: "🇪🇸", sort_order: 1 }],
    sessions: [{ course_key: "spanish", date: "2026-11-10", mode: "线下", note: "<img src=x onerror=alert(1)>" }],
    payments: [{ course_key: "spanish", date: "2026-11-05", amount: "¥3,000", credits: 10, note: "第5次交费" }]
  });
  const source = html.slice(html.lastIndexOf("<script>") + "<script>".length, html.lastIndexOf("</script>"))
    .replace("{{ site.data.classes | jsonify }}", JSON.stringify({ snapshot_as_of: "2026-11-22", courses: [] }));
  vm.runInContext(source, context);
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ids["sheet-status"].hidden, true);
  assert.equal(ids["sheet-status"].textContent, "");
  assert.match(ids.glance._html, /剩 9 节/);
  assert.match(ids["sessions-spanish"]._html, /&lt;img/);
  assert.equal(ids["sessions-spanish"]._html.includes("<img"), false);
  assert.match(ids["payments-spanish"]._html, /¥3,000/);
  ClassPage.loadSheets = realLoad;

  const fetched = [];
  const liveTables = await ClassPage.loadSheets({
    fetch(url, init) {
      fetched.push({ url: String(url), credentials: init && init.credentials, cache: init && init.cache });
      return fetch(url, init);
    },
    document: null,
    timeoutMs: 15000
  });
  assert.equal(fetched.length >= 3, true);
  assert.equal(fetched.every((call) => call.credentials === "omit" && call.cache === "no-store"), true);
  assert.equal(fetched.every((call) => call.url.startsWith("https://docs.google.com/spreadsheets/d/" + ClassPage.SHEET_ID + "/")), true);
  assert.equal(fetched.some((call) => /[?&](key|access_token)=/.test(call.url)), false);
  const liveCourses = ClassPage.assemble(liveTables);
  const liveBalances = balances(liveCourses);
  const summaryText = await (await fetch(
    "https://docs.google.com/spreadsheets/d/" + ClassPage.SHEET_ID + "/gviz/tq?tqx=out:json&gid=1799790277&_=" + Date.now(),
    { cache: "no-store", credentials: "omit" }
  )).text();
  const summary = ClassPage.rowsFromGvizText(summaryText);
  console.log("live balances", JSON.stringify({
    sessions: liveTables.sessions.length,
    payments: liveTables.payments.length,
    spanish: {
      purchased: liveBalances.spanish.purchased,
      attended: liveBalances.spanish.attended,
      remaining: liveBalances.spanish.remaining,
      payments: liveBalances.spanish.payments.length,
      spend: liveBalances.spanish.spend,
      onCard: liveBalances.spanish.onCard,
      cardSize: liveBalances.spanish.cardSize
    },
    boxing: {
      purchased: liveBalances.boxing.purchased,
      attended: liveBalances.boxing.attended,
      remaining: liveBalances.boxing.remaining,
      payments: liveBalances.boxing.payments.length,
      spend: liveBalances.boxing.spend,
      onCard: liveBalances.boxing.onCard,
      cardSize: liveBalances.boxing.cardSize
    }
  }));
  for (const course of liveCourses) {
    assert.equal(course.sessions.every((session) => /^\d{4}-\d{2}-\d{2}$/.test(session.date)), true, course.key);
    assert.equal(course.payments.every((payment) => /^\d{4}-\d{2}-\d{2}$/.test(payment.date)), true, course.key);
  }
  assert.equal(liveBalances.spanish.remaining, liveBalances.spanish.purchased - liveBalances.spanish.attended);
  assert.equal(liveBalances.boxing.remaining, liveBalances.boxing.purchased - liveBalances.boxing.attended);
  for (const row of summary) {
    const actual = liveBalances[row.course_key];
    assert.equal(actual.purchased, row.bought_credits, row.course_key + " bought");
    assert.equal(actual.attended, row.used_credits, row.course_key + " used");
    assert.equal(actual.remaining, row.remaining_credits, row.course_key + " remaining");
    assert.equal(actual.payments.length, row.payment_count, row.course_key + " payments");
    assert.equal(actual.sessions.length, row.session_count, row.course_key + " sessions");
    assert.equal(actual.spend, row.amount_total, row.course_key + " amount");
  }
  assert.equal(liveTables.sessions.length >= BASELINE.spanish.sessions + BASELINE.boxing.sessions, true);
  assert.equal(liveTables.payments.length >= BASELINE.spanish.payments + BASELINE.boxing.payments, true);
  if (liveBalances.spanish.sessions.length === BASELINE.spanish.sessions && liveBalances.boxing.sessions.length === BASELINE.boxing.sessions) {
    assertBaseline(liveCourses);
    console.log("live balances match the migrated archive, boxing card 7/10");
  } else {
    console.log("live sheet has rows beyond the archive; formula check passed");
  }
  console.log("classes ok");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
