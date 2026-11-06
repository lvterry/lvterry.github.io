const assert = require("node:assert/strict");
const page = require("../assets/js/investment.js");

const publicData = {
  principles: {
    items: [{ id: "horizon", text: "投资期限至少 5 年。" }],
    watch_threshold: { confirmed: false, status: "待确认", value_pp: null }
  },
  targets: {
    weights: [
      { ticker: "GOOG", name: "Alphabet", target_pct: 30, bucket: "equity" },
      { ticker: "MSFT", name: "Microsoft", target_pct: 20, bucket: "equity" },
      { ticker: "NVDA", name: "NVIDIA", target_pct: 25, bucket: "equity" },
      { ticker: "TSLA", name: "Tesla", target_pct: 15, bucket: "equity" },
      { ticker: "CASH", name: "现金", target_pct: 10, bucket: "cash", instruments: ["SGOV", "TFLO"] }
    ]
  },
  companies: {
    companies: [
      { ticker: "GOOG", name: "Alphabet", status: "待核实", thesis: null, evidence: { facts: [], guidance: [], media: [], judgment: [] } }
    ]
  },
  holdings: {
    timezone: "Asia/Shanghai",
    holdings_as_of: null,
    after_hours_included: null,
    positions: ["GOOG", "MSFT", "NVDA", "TSLA", "CASH"].map((ticker) => ({
      ticker,
      actual_pct: null,
      valuation: null,
      return_pct: null,
      contribution_pct: null
    }))
  },
  quotes: { snapshots: [] },
  suggestions: {
    items: ["GOOG", "MSFT", "NVDA", "TSLA", "CASH"].map((ticker) => ({ ticker, action: null, evidence: [] }))
  },
  events: { events: [] },
  focus: { snapshots: [] },
  themes: { note: "不等于分散", items: [] },
  methodology: { items: [{ id: "missing", text: "没有的数据留空。" }] }
};

const model = page.buildModel(publicData);
assert.equal(page.sumTargets(model.rows).sum, 100);
assert.ok(model.rows.every((row) => row.actualPct === null && row.deviationPp === null));
assert.equal(page.formatPct(null), null);
assert.equal(page.formatPct(0), "0%");
assert.notEqual(page.formatPct(null), "0%");
const columns = page.metricColumns(model.rows);
assert.equal(columns.price, false);
assert.equal(columns.valuation, false);
assert.equal(columns.returnPct, false);
assert.equal(columns.contributionPct, false);
assert.ok(model.suggestions.every((item) => item.action.label === "无法判断" && item.action.missing));
assert.equal(page.weightAnomalies(model.rows, model.threshold.valuePp).state, "threshold_unset");
assert.equal(page.adjustmentNote(null, 30).state, "unknown");

const stringZero = page.buildModel({
  holdings: { positions: [{ ticker: "GOOG", actual_pct: "0", valuation: "", return_pct: "1" }] },
  targets: { weights: [{ ticker: "GOOG", target_pct: 30 }] },
  quotes: { snapshots: [{ ticker: "GOOG", price: "100", as_of: "2026-11-06T16:00:00+08:00" }] }
});
assert.equal(stringZero.rows[0].actualPct, null);
assert.equal(stringZero.rows[0].valuation, null);
assert.equal(stringZero.rows[0].returnPct, null);
assert.equal(stringZero.rows[0].price, null);

assert.equal(page.safeUrl("javascript:alert(1)"), null);
assert.equal(page.safeUrl("https://example.com/a"), "https://example.com/a");
assert.equal(page.normalizeAction("继续持有").label, "继续持有");
assert.equal(page.normalizeAction("先别动").label, "无法判断");
assert.equal(page.normalizeAction(null).missing, true);

const tickers = ["GOOG", "MSFT", "NVDA", "TSLA", "CASH"];
const partial = page.readLocalActuals({
  positions: [
    { ticker: "GOOG", actual_pct: 30 },
    { ticker: "MSFT", actual_pct: null }
  ]
}, tickers);
assert.equal(partial.basis, "actual_pct");
assert.equal(partial.actuals.GOOG, 30);
assert.equal(partial.actuals.MSFT, null);
assert.equal(partial.actuals.CASH, null);
assert.ok(partial.warnings.some((line) => line.includes("没有当成 0")));

const folded = page.readLocalActuals({
  positions: [
    { ticker: "GOOG", actual_pct: 30 },
    { ticker: "SGOV", actual_pct: 4 },
    { ticker: "TFLO", actual_pct: 6 }
  ]
}, tickers);
assert.equal(folded.actuals.CASH, 10);

const incompleteCash = page.readLocalActuals({
  positions: [
    { ticker: "SGOV", actual_pct: 4 },
    { ticker: "TFLO", actual_pct: null }
  ]
}, tickers);
assert.equal(incompleteCash.actuals.CASH, null);

const preferPct = page.readLocalActuals({
  positions: tickers.map((ticker) => ({ ticker, actual_pct: 20, market_value: 987654321 }))
}, tickers);
assert.equal(preferPct.basis, "actual_pct");
assert.equal(JSON.stringify(preferPct).includes("987654321"), false);
assert.equal(preferPct.market_value, undefined);

const fromValue = page.readLocalActuals({
  positions: [
    { ticker: "GOOG", market_value: 30 },
    { ticker: "MSFT", market_value: 20 },
    { ticker: "NVDA", market_value: 25 },
    { ticker: "TSLA", market_value: 15 },
    { ticker: "SGOV", market_value: 6 },
    { ticker: "TFLO", market_value: 4 }
  ]
}, tickers);
assert.equal(fromValue.basis, "market_value");
assert.equal(Math.round(fromValue.actuals.GOOG), 30);
assert.equal(Math.round(fromValue.actuals.CASH), 10);
assert.equal(Object.hasOwn(fromValue.actuals, "market_value"), false);
assert.equal(JSON.stringify(fromValue.actuals), JSON.stringify({
  GOOG: fromValue.actuals.GOOG,
  MSFT: fromValue.actuals.MSFT,
  NVDA: fromValue.actuals.NVDA,
  TSLA: fromValue.actuals.TSLA,
  CASH: fromValue.actuals.CASH
}));

const missingValue = page.readLocalActuals({
  positions: [
    { ticker: "GOOG", market_value: 30 },
    { ticker: "MSFT", market_value: 20 },
    { ticker: "NVDA", market_value: null },
    { ticker: "TSLA", market_value: 15 },
    { ticker: "CASH", market_value: 10 }
  ]
}, tickers);
assert.ok(tickers.every((ticker) => missingValue.actuals[ticker] === null));

const extraName = page.readLocalActuals({
  positions: tickers.concat(["AMZN"]).map((ticker) => ({ ticker, market_value: 10 }))
}, tickers);
assert.ok(tickers.every((ticker) => extraName.actuals[ticker] === null));

const sharesIgnored = page.readLocalActuals({
  positions: [{ ticker: "GOOG", shares: 12345 }]
}, tickers);
assert.equal(sharesIgnored.actuals.GOOG, null);
assert.equal(JSON.stringify(sharesIgnored).includes("12345"), false);
assert.ok(sharesIgnored.warnings.some((line) => line.includes("股数")));

const viewed = page.viewModel(model, partial);
assert.equal(viewed.rows.find((row) => row.ticker === "GOOG").deviationPp, 0);
assert.equal(viewed.rows.find((row) => row.ticker === "MSFT").actualPct, null);
assert.equal(page.adjustmentNote(35, 30).text.includes("不含交易成本和税"), true);
assert.equal(page.adjustmentNote(35, 30).text.includes("不会下单"), true);

const events = [
  { id: "a", ticker: "GOOG", theme: "云", importance: "高", event_at: "2026-11-01", source_url: "https://example.com/a", fact: "同一句" },
  { id: "b", ticker: "MSFT", theme: "云", importance: "低", event_at: "2026-11-03", source_url: "https://example.com/b", fact: "另一句" },
  { id: "c", theme: "宏观", importance: "中", event_at: "2026-10-01", source_url: "https://example.com/c", fact: "跨公司" },
  { id: "d", ticker: "GOOG", theme: "云", importance: "高", event_at: "2026-11-01", source_url: "https://example.com/a", fact: "同一句" }
];
assert.deepEqual(page.filterEvents(events, { ticker: "GOOG" }).map((event) => event.id), ["a", "d"]);
assert.deepEqual(page.filterEvents(events, { ticker: "跨公司" }).map((event) => event.id), ["c"]);
assert.deepEqual(page.filterEvents(events, { from: "2026-11-02", to: "2026-11-30" }).map((event) => event.id), ["b"]);
assert.deepEqual(page.sortEvents(events).map((event) => event.id), ["b", "a", "d", "c"]);
const flagged = page.flagDuplicates(page.sortEvents(events));
assert.equal(flagged.filter((event) => event.duplicateOf).length, 1);

const quotes = page.latestQuotes([
  { ticker: "GOOG", price: 10, as_of: "2026-11-01T00:00:00+08:00" },
  { ticker: "GOOG", price: 12, as_of: "2026-11-06T00:00:00+08:00" }
]);
assert.equal(quotes.GOOG.price, 12);

const template = JSON.parse(page.templateJson(tickers));
assert.ok(template.positions.every((row) => row.actual_pct === null));
assert.equal(JSON.stringify(template).includes("market_value"), false);
assert.equal(JSON.stringify(template).includes("shares"), false);

console.log("investment logic ok");
