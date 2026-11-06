const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const dataDir = path.join("_data", "investment");
const files = fs.readdirSync(dataDir).filter((name) => name.endsWith(".yml")).map((name) => path.join(dataDir, name));
files.push("investment.html", "assets/js/investment.js", "docs/investment.md");

const forbiddenKey = /^\s*(shares|share_count|quantity|qty|market_value|marketvalue|cost_basis|costbasis|balance|notional|position_size|dollar_value)\s*:/i;
const numberedMetric = /^\s*(actual_pct|valuation|return_pct|contribution_pct|price|value_pp)\s*:\s*-?\d/i;
const money = /(?:\$|USD|US\$|¥|￥)\s*\d|\d[\d,]*(?:\.\d+)?\s*(?:美元|美金|港币|人民币)/i;
const lockedFive = /5\s*个百分点|五个百分点|value_pp\s*:\s*5\b/;
const network = /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage/;

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  assert.equal(money.test(text), false, file + " looks like a money amount");
  assert.equal(lockedFive.test(text), false, file + " hardcodes a five-point trade rule");
  if (file.startsWith(dataDir)) {
    assert.equal(forbiddenKey.test(text), false, file + " has a private holdings field");
    assert.equal(numberedMetric.test(text), false, file + " has a filled metric");
  }
}

const script = fs.readFileSync("assets/js/investment.js", "utf8");
assert.equal(network.test(script), false, "investment.js should stay local");

const page = fs.readFileSync("investment.html", "utf8");
for (const name of ["principles", "targets", "companies", "holdings", "quotes", "events", "focus", "suggestions", "themes", "methodology"]) {
  assert.equal(page.includes("site.data.investment." + name), true, "missing " + name);
}
assert.equal(page.includes('content="noindex"'), false);

const docs = fs.readFileSync("docs/investment.md", "utf8");
assert.equal(/"(?:market_value|shares)"\s*:\s*-?\d/.test(docs), false);
assert.equal(docs.includes("/investment.html"), true);

console.log("investment privacy ok");
