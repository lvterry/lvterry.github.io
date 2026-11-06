/* 长期投资框架页的逻辑。
   数据由 investment.html 在构建时注入。这个文件不请求网络，
   也不把本地持仓写进浏览器存储。刷新页面后，导入的仓位就没了。 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.InvestmentPage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var FRAME = ["GOOG", "MSFT", "NVDA", "TSLA", "CASH"];
  var CASH_PARTS = ["CASH", "SGOV", "TFLO"];
  var ACTIONS = ["继续持有", "加强观察", "评估再平衡", "评估减仓"];
  var ACTION_SET = new Set(ACTIONS);
  var STATUSES = ["正面", "观察", "恶化", "待核实"];
  var PRICE_VS = ["价格偏离", "论点恶化", "两者都有"];
  var EVIDENCE_LANES = [
    ["facts", "事实"],
    ["guidance", "管理层指引"],
    ["media", "媒体"],
    ["judgment", "我们的判断"]
  ];

  function isNum(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function blank(value) {
    return value == null || (typeof value === "string" && value.trim() === "");
  }

  function text(value) {
    return blank(value) ? null : String(value).trim();
  }

  function upper(value) {
    return blank(value) ? "" : String(value).trim().toUpperCase();
  }

  function listOf(value) {
    return Array.isArray(value) ? value : [];
  }

  function dict() {
    return Object.create(null);
  }

  function round1(value) {
    return Math.round(value * 10) / 10;
  }

  function deviationPp(actual, target) {
    if (!isNum(actual) || !isNum(target)) return null;
    return actual - target;
  }

  function formatPct(value) {
    if (!isNum(value)) return null;
    var rounded = round1(value);
    var body = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    return body + "%";
  }

  function formatPp(value) {
    if (!isNum(value)) return null;
    var rounded = round1(value);
    if (rounded === 0) return "0 pp";
    var abs = Math.abs(rounded);
    var body = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
    return (rounded > 0 ? "+" : "-") + body + " pp";
  }

  function formatPrice(value) {
    if (!isNum(value)) return null;
    return String(value);
  }

  function safeUrl(url) {
    if (typeof url !== "string" || blank(url)) return null;
    try {
      var parsed = new URL(url.trim());
      if (parsed.protocol === "https:" || parsed.protocol === "http:") return parsed.href;
    } catch (error) {
      return null;
    }
    return null;
  }

  function safeDomId(prefix, id) {
    var value = text(id);
    if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
    return prefix + "-" + value;
  }

  function normalizeAction(action) {
    if (blank(action)) return { label: "无法判断", missing: true, unrecognized: null };
    if (ACTION_SET.has(action)) return { label: action, missing: false, unrecognized: null };
    return { label: "无法判断", missing: false, unrecognized: String(action) };
  }

  function normalizeStatus(status) {
    if (blank(status) || STATUSES.indexOf(status) === -1) return "待核实";
    return status;
  }

  function statusClass(status) {
    if (status === "正面") return "up";
    if (status === "恶化") return "down";
    if (status === "观察") return "warn";
    return "na";
  }

  function afterHoursLabel(value) {
    if (value === true) return "含盘后";
    if (value === false) return "不含盘后";
    return "未知";
  }

  function indexBy(list, getKey) {
    var map = dict();
    list.forEach(function (item) {
      var key = upper(getKey(item));
      if (key) map[key] = item;
    });
    return map;
  }

  function sumTargets(rows) {
    var numbers = rows.map(function (row) { return row.targetPct; }).filter(isNum);
    if (!rows.length || numbers.length !== rows.length) {
      return { complete: false, sum: numbers.length ? numbers.reduce(add, 0) : null };
    }
    return { complete: true, sum: numbers.reduce(add, 0) };
  }

  function add(total, value) {
    return total + value;
  }

  function watchThreshold(principles) {
    var block = (principles && principles.watch_threshold) || {};
    return {
      valuePp: isNum(block.value_pp) ? block.value_pp : null,
      confirmed: block.confirmed === true,
      status: text(block.status) || "待确认",
      note: text(block.note)
    };
  }

  function buildRows(data) {
    var src = data || {};
    var targets = listOf(src.targets && src.targets.weights);
    var holdings = listOf(src.holdings && src.holdings.positions);
    var companies = listOf(src.companies && src.companies.companies);
    var targetMap = indexBy(targets, function (item) { return item.ticker; });
    var holdingMap = indexBy(holdings, function (item) { return item.ticker; });
    var companyMap = indexBy(companies, function (item) { return item.ticker; });
    var order = [];
    targets.forEach(function (item) {
      var key = upper(item.ticker);
      if (key && order.indexOf(key) === -1) order.push(key);
    });
    FRAME.forEach(function (key) {
      if (order.indexOf(key) === -1 && (holdingMap[key] || companyMap[key])) order.push(key);
    });
    return order.map(function (ticker) {
      var target = targetMap[ticker] || {};
      var holding = holdingMap[ticker] || {};
      var company = companyMap[ticker] || {};
      var evidence = company.evidence || {};
      var actualPct = isNum(holding.actual_pct) ? holding.actual_pct : null;
      var targetPct = isNum(target.target_pct) ? target.target_pct : null;
      return {
        ticker: ticker,
        name: text(company.name) || text(target.name) || ticker,
        bucket: text(target.bucket) || (ticker === "CASH" ? "cash" : "equity"),
        instruments: listOf(target.instruments).map(text).filter(Boolean),
        targetPct: targetPct,
        actualPct: actualPct,
        deviationPp: deviationPp(actualPct, targetPct),
        valuation: isNum(holding.valuation) ? holding.valuation : null,
        valuationNote: text(holding.valuation_note),
        valuationSource: safeUrl(holding.valuation_source),
        returnPct: isNum(holding.return_pct) ? holding.return_pct : null,
        contributionPct: isNum(holding.contribution_pct) ? holding.contribution_pct : null,
        status: normalizeStatus(company.status),
        thesis: text(company.thesis),
        statusRationale: text(company.status_rationale),
        confidence: text(company.confidence),
        lastReview: text(company.last_review),
        nextVerification: text(company.next_verification),
        focus: listOf(company.focus).map(text).filter(Boolean),
        evidence: {
          facts: listOf(evidence.facts),
          guidance: listOf(evidence.guidance),
          media: listOf(evidence.media),
          judgment: listOf(evidence.judgment)
        }
      };
    });
  }

  function latestQuotes(snapshots) {
    var best = dict();
    listOf(snapshots).forEach(function (snap) {
      if (!snap || typeof snap !== "object") return;
      var ticker = upper(snap.ticker);
      if (!ticker) return;
      var at = text(snap.as_of) || "";
      var prev = best[ticker];
      if (!prev || at >= (text(prev.as_of) || "")) best[ticker] = snap;
    });
    return best;
  }

  function attachQuotes(rows, snapshots) {
    var latest = latestQuotes(snapshots);
    return rows.map(function (row) {
      var quote = latest[row.ticker];
      var next = copyRow(row);
      next.price = null;
      next.priceCurrency = null;
      next.priceAsOf = null;
      next.afterHours = null;
      next.priceSource = null;
      if (!quote || !isNum(quote.price)) return next;
      next.price = quote.price;
      next.priceCurrency = text(quote.currency) || "USD";
      next.priceAsOf = text(quote.as_of);
      next.afterHours = afterHoursLabel(quote.after_hours_included);
      next.priceSource = safeUrl(quote.source_url);
      return next;
    });
  }

  function copyRow(row) {
    var next = {};
    Object.keys(row).forEach(function (key) { next[key] = row[key]; });
    return next;
  }

  function buildSuggestions(data, rows) {
    var items = listOf(data.suggestions && data.suggestions.items);
    var map = indexBy(items, function (item) { return item.ticker; });
    return rows.map(function (row) {
      var item = map[row.ticker] || {};
      var stance = text(item.price_vs_thesis);
      return {
        ticker: row.ticker,
        name: row.name,
        action: normalizeAction(item.action),
        priceVsThesis: PRICE_VS.indexOf(stance) === -1 ? null : stance,
        priceVsUnrecognized: stance && PRICE_VS.indexOf(stance) === -1 ? stance : null,
        evidence: listOf(item.evidence).map(text).filter(Boolean),
        triggers: listOf(item.triggers).map(text).filter(Boolean),
        falsifiers: listOf(item.falsifiers).map(text).filter(Boolean),
        pending: listOf(item.pending_checks).map(text).filter(Boolean),
        timepoints: listOf(item.timepoints).map(text).filter(Boolean),
        note: text(item.note)
      };
    });
  }

  function buildModel(data) {
    var src = data || {};
    var rows = attachQuotes(buildRows(src), src.quotes && src.quotes.snapshots);
    var principles = src.principles || {};
    return {
      principles: principles,
      threshold: watchThreshold(principles),
      methodology: listOf(src.methodology && src.methodology.items).filter(function (item) {
        return item && text(item.text);
      }),
      themes: src.themes || {},
      events: listOf(src.events && src.events.events),
      focus: listOf(src.focus && src.focus.snapshots),
      suggestions: buildSuggestions(src, rows),
      rows: rows,
      holdingsAsOf: text(src.holdings && src.holdings.holdings_as_of),
      holdingsAfterHours: src.holdings ? src.holdings.after_hours_included : null,
      timezone: text(src.holdings && src.holdings.timezone) || text(src.quotes && src.quotes.timezone) || "Asia/Shanghai"
    };
  }

  function withLocalActuals(rows, actuals) {
    return rows.map(function (row) {
      var actualPct = actuals && isNum(actuals[row.ticker]) ? actuals[row.ticker] : null;
      var next = copyRow(row);
      next.actualPct = actualPct;
      next.deviationPp = deviationPp(actualPct, row.targetPct);
      next.actualSource = "local";
      return next;
    });
  }

  function viewModel(model, local) {
    var rows = local ? withLocalActuals(model.rows, local.actuals) : model.rows;
    return {
      principles: model.principles,
      threshold: model.threshold,
      methodology: model.methodology,
      themes: model.themes,
      events: model.events,
      focus: model.focus,
      suggestions: model.suggestions,
      rows: rows,
      timezone: model.timezone,
      local: local,
      holdingsAsOf: local && local.asOf ? local.asOf : model.holdingsAsOf,
      holdingsAfterHours: local && (local.afterHours === true || local.afterHours === false)
        ? local.afterHours
        : model.holdingsAfterHours
    };
  }

  function given(value) {
    return value != null && value !== "";
  }

  function readLocalActuals(doc, tickers) {
    var wanted = (tickers && tickers.length ? tickers : FRAME).map(upper);
    var warnings = [];
    function empty() {
      var actuals = dict();
      wanted.forEach(function (ticker) { actuals[ticker] = null; });
      return actuals;
    }
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
      warnings.push("文件不是对象，已忽略。");
      return { actuals: empty(), asOf: null, afterHours: null, warnings: warnings, basis: "none" };
    }
    var rows = [];
    listOf(doc.positions).forEach(function (row) {
      if (!row || typeof row !== "object") return;
      var ticker = upper(row.ticker);
      if (!ticker) return;
      rows.push({
        ticker: ticker,
        actual_pct: isNum(row.actual_pct) ? row.actual_pct : null,
        actualGiven: given(row.actual_pct),
        actualValid: isNum(row.actual_pct),
        market_value: isNum(row.market_value) && row.market_value >= 0 ? row.market_value : null,
        marketGiven: given(row.market_value),
        marketValid: isNum(row.market_value) && row.market_value >= 0,
        marketNegative: isNum(row.market_value) && row.market_value < 0,
        sharesGiven: ["shares", "share_count", "quantity", "qty"].some(function (key) { return given(row[key]); })
      });
    });
    if (rows.some(function (row) { return row.sharesGiven; })) {
      warnings.push("文件里有股数。页面不展示股数，也不用股数推算仓位。");
    }
    var invalidPct = rows.filter(function (row) { return row.actualGiven && !row.actualValid; });
    if (invalidPct.length) {
      warnings.push("有实际百分比不是数字，已忽略：" + invalidPct.map(function (row) { return row.ticker; }).join("、") + "。");
    }
    var asOf = text(doc.holdings_as_of);
    var afterHours = doc.after_hours_included === true || doc.after_hours_included === false
      ? doc.after_hours_included
      : null;
    var anyPct = rows.some(function (row) { return row.actualValid; });
    var anyMarket = rows.some(function (row) { return row.marketGiven || row.marketNegative; });
    if (anyPct && anyMarket) {
      warnings.push("同时写了实际百分比和金额。只采用实际百分比，金额不参与计算，也不展示。");
    }
    if (anyPct) {
      var fromPct = actualsFromPct(rows, wanted, warnings);
      warnPartial(fromPct, wanted, warnings);
      return { actuals: fromPct, asOf: asOf, afterHours: afterHours, warnings: warnings, basis: "actual_pct" };
    }
    if (anyMarket) {
      var fromMarket = actualsFromMarket(rows, wanted, warnings);
      return { actuals: fromMarket, asOf: asOf, afterHours: afterHours, warnings: warnings, basis: "market_value" };
    }
    warnings.push("没有可用的实际百分比。实际仓位保持空白。");
    return { actuals: empty(), asOf: asOf, afterHours: afterHours, warnings: warnings, basis: "none" };
  }

  function warnPartial(actuals, wanted, warnings) {
    var missing = wanted.filter(function (ticker) { return !isNum(actuals[ticker]); });
    var present = wanted.filter(function (ticker) { return isNum(actuals[ticker]); });
    if (missing.length && present.length) {
      warnings.push("这些标的没有实际百分比，保持空白，没有当成 0：" + missing.join("、") + "。");
    }
    if (present.length === wanted.length) {
      var sum = present.reduce(function (total, ticker) { return total + actuals[ticker]; }, 0);
      if (Math.abs(sum - 100) > 0.2) warnings.push("实际百分比合计不是 100%，没有重新归一。");
    }
  }

  function actualsFromPct(rows, wanted, warnings) {
    var actuals = dict();
    var map = dict();
    wanted.forEach(function (ticker) { actuals[ticker] = null; });
    rows.forEach(function (row) { map[row.ticker] = row; });
    var extras = Object.keys(map).filter(function (ticker) {
      return wanted.indexOf(ticker) === -1 && CASH_PARTS.indexOf(ticker) === -1 && map[ticker].actualValid;
    });
    if (extras.length) warnings.push("框架外标的已忽略，没有重新归一：" + extras.join("、") + "。");
    wanted.forEach(function (ticker) {
      if (ticker === "CASH") return;
      actuals[ticker] = map[ticker] && map[ticker].actualValid ? map[ticker].actual_pct : null;
    });
    if (wanted.indexOf("CASH") !== -1) actuals.CASH = foldCashPct(map, warnings);
    return actuals;
  }

  function foldCashPct(map, warnings) {
    var cash = map.CASH;
    var parts = ["SGOV", "TFLO"].filter(function (ticker) { return map[ticker]; }).map(function (ticker) { return map[ticker]; });
    if (cash && cash.actualValid) {
      if (parts.some(function (row) { return row.actualGiven || row.actualValid; })) {
        warnings.push("现金已填写百分比，SGOV / TFLO 没有再加进去，避免重复计算。");
      }
      return cash.actual_pct;
    }
    if (cash && cash.actualGiven && !cash.actualValid) {
      warnings.push("现金百分比不是数字，SGOV / TFLO 也没有用来顶上。");
      return null;
    }
    if (!parts.length) return null;
    if (parts.some(function (row) { return !row.actualValid; })) {
      warnings.push("SGOV / TFLO 的百分比不完整，没有把缺失当成 0，现金仍为空白。");
      return null;
    }
    return parts.reduce(function (total, row) { return total + row.actual_pct; }, 0);
  }

  function actualsFromMarket(rows, wanted, warnings) {
    var actuals = dict();
    var map = dict();
    wanted.forEach(function (ticker) { actuals[ticker] = null; });
    rows.forEach(function (row) { map[row.ticker] = row; });
    if (rows.some(function (row) { return row.marketNegative; })) {
      warnings.push("金额不能是负数，没有计算百分比。");
      return actuals;
    }
    if (rows.some(function (row) { return row.marketGiven && !row.marketValid; })) {
      warnings.push("有金额不是数字，没有把缺失当成 0，因此没有计算百分比。");
      return actuals;
    }
    var extras = Object.keys(map).filter(function (ticker) {
      return wanted.indexOf(ticker) === -1 && CASH_PARTS.indexOf(ticker) === -1;
    });
    if (extras.length) {
      warnings.push("文件里有框架外标的，不能把它排除后再假装算全组合。百分比没有计算。");
      return actuals;
    }
    var values = dict();
    var missingEquity = wanted.some(function (ticker) {
      if (ticker === "CASH") return false;
      if (!map[ticker] || !map[ticker].marketValid) return true;
      values[ticker] = map[ticker].market_value;
      return false;
    });
    if (missingEquity) {
      warnings.push("有标的缺少金额，没有把缺失当成 0，因此没有计算百分比。");
      return actuals;
    }
    if (wanted.indexOf("CASH") !== -1) {
      var cashValue = foldCashMarket(map, warnings);
      if (!isNum(cashValue)) return actuals;
      values.CASH = cashValue;
    }
    var sum = wanted.reduce(function (total, ticker) { return total + values[ticker]; }, 0);
    if (!(sum > 0)) {
      warnings.push("金额合计不是正数，无法计算百分比。");
      return actuals;
    }
    wanted.forEach(function (ticker) { actuals[ticker] = (values[ticker] / sum) * 100; });
    warnings.push("百分比由本机金额临时算出。金额不显示，也不上传。");
    return actuals;
  }

  function foldCashMarket(map, warnings) {
    var present = CASH_PARTS.filter(function (ticker) { return map[ticker]; });
    if (!present.length) {
      warnings.push("缺少现金金额，没有把缺失当成 0。");
      return null;
    }
    if (present.some(function (ticker) { return !map[ticker].marketValid; })) {
      warnings.push("现金或货币市场基金的金额不完整，没有把缺失当成 0。");
      return null;
    }
    return present.reduce(function (total, ticker) { return total + map[ticker].market_value; }, 0);
  }

  function weightAnomalies(rows, thresholdPp) {
    if (!isNum(thresholdPp)) return { state: "threshold_unset", flagged: [] };
    if (!rows.some(function (row) { return isNum(row.actualPct); })) return { state: "no_actual", flagged: [] };
    return {
      state: "ok",
      flagged: rows.filter(function (row) {
        return isNum(row.deviationPp) && Math.abs(row.deviationPp) >= thresholdPp - 1e-9;
      })
    };
  }

  function adjustmentNote(actual, target) {
    if (!isNum(actual) || !isNum(target)) return { state: "unknown", gapPp: null, text: "无法判断" };
    var gapPp = actual - target;
    return {
      state: "estimate",
      gapPp: gapPp,
      text: "若调到目标权重，实际相对目标 " + formatPp(gapPp) + "。计算基础是实际百分比减去目标百分比，不含交易成本和税，也不会下单。"
    };
  }

  function filterEvents(events, query) {
    var q = query || {};
    return listOf(events).filter(function (event) {
      var ticker = upper(event && event.ticker);
      if (q.ticker && q.ticker !== "全部") {
        if (q.ticker === "跨公司") {
          if (ticker) return false;
        } else if (ticker !== upper(q.ticker)) return false;
      }
      if (q.theme && q.theme !== "全部" && text(event.theme) !== q.theme) return false;
      if (q.importance && q.importance !== "全部" && text(event.importance) !== q.importance) return false;
      var day = String((event && event.event_at) || "").slice(0, 10);
      if ((q.from || q.to) && !day) return false;
      if (q.from && day < q.from) return false;
      if (q.to && day > q.to) return false;
      return true;
    });
  }

  function sortEvents(events) {
    return listOf(events).slice().sort(function (a, b) {
      var left = text(a.event_at) || "";
      var right = text(b.event_at) || "";
      if (left === right) return 0;
      if (!left) return 1;
      if (!right) return -1;
      return left < right ? 1 : -1;
    });
  }

  function flagDuplicates(events) {
    var seen = new Map();
    return listOf(events).map(function (event) {
      var url = text(event.source_url) || "";
      var key = [upper(event.ticker), text(event.event_at) || "", url, text(event.fact) || ""].join("|");
      var duplicateOf = null;
      if (url && seen.has(key)) duplicateOf = seen.get(key);
      else if (url) seen.set(key, text(event.id) || "未编号");
      var next = {};
      Object.keys(event).forEach(function (name) { next[name] = event[name]; });
      next.duplicateOf = duplicateOf;
      return next;
    });
  }

  function metricColumns(rows) {
    return {
      valuation: rows.some(function (row) { return isNum(row.valuation); }),
      returnPct: rows.some(function (row) { return isNum(row.returnPct); }),
      contributionPct: rows.some(function (row) { return isNum(row.contributionPct); }),
      price: rows.some(function (row) { return isNum(row.price); })
    };
  }

  function templateJson(tickers) {
    return JSON.stringify({
      holdings_as_of: null,
      timezone: "Asia/Shanghai",
      after_hours_included: null,
      positions: (tickers && tickers.length ? tickers : FRAME).map(function (ticker) {
        return { ticker: ticker, actual_pct: null };
      })
    }, null, 2) + "\n";
  }

  function methodText(model, id) {
    var found = model.methodology.find(function (item) { return item.id === id; });
    return found ? found.text : null;
  }

  function el(doc, tag, attrs, children) {
    var node = doc.createElement(tag);
    var attributes = attrs || {};
    Object.keys(attributes).forEach(function (key) {
      var value = attributes[key];
      if (value == null || value === false) return;
      if (key === "class") node.className = value;
      else node.setAttribute(key, String(value));
    });
    (children || []).forEach(function (child) {
      if (child == null || child === false) return;
      node.appendChild(typeof child === "string" ? doc.createTextNode(child) : child);
    });
    return node;
  }

  function missing(doc, label) {
    return el(doc, "span", { class: "na" }, [label || "待填"]);
  }

  function textOr(doc, value, label) {
    return blank(value) ? missing(doc, label) : doc.createTextNode(String(value));
  }

  function pctOr(doc, value) {
    var shown = formatPct(value);
    return shown ? doc.createTextNode(shown) : missing(doc, "—");
  }

  function ppOr(doc, value) {
    var shown = formatPp(value);
    return shown ? doc.createTextNode(shown) : missing(doc, "—");
  }

  function badge(doc, label, kind) {
    return el(doc, "span", { class: "badge " + (kind || "na") }, [label]);
  }

  function externalLink(doc, url, label) {
    var href = safeUrl(url);
    if (!href) return null;
    return el(doc, "a", { href: href, target: "_blank", rel: "noopener noreferrer" }, [label || "来源"]);
  }

  function renderPrinciples(doc, container, model) {
    var list = el(doc, "ol", { class: "principles" });
    listOf(model.principles.items).forEach(function (item) {
      if (!text(item.text)) return;
      list.appendChild(el(doc, "li", {}, [item.text]));
    });
    var threshold = model.threshold;
    var status = el(doc, "p", { class: "hint" }, [
      "观察阈值：" + (isNum(threshold.valuePp) ? formatPp(Math.abs(threshold.valuePp)).replace("+", "") : "未设置"),
      "。状态：" + threshold.status + "。",
      threshold.confirmed ? "数值已确认，仍只用于观察，不会自动变成交易。" : "未确认，不是强制交易规则。"
    ]);
    container.replaceChildren(list, renderWeightList(doc, model.rows), status);
    if (threshold.note) container.appendChild(el(doc, "p", { class: "hint" }, [threshold.note]));
  }

  function renderWeightList(doc, rows) {
    var list = el(doc, "ul", { class: "weights" });
    rows.forEach(function (row) {
      var extra = row.instruments.length ? "（含 " + row.instruments.join("、") + "）" : "";
      list.appendChild(el(doc, "li", {}, [
        el(doc, "span", { class: "dot seg-" + row.ticker.toLowerCase() }),
        row.ticker + " " + row.name + extra + " ",
        pctOr(doc, row.targetPct)
      ]));
    });
    var sum = sumTargets(rows);
    var sumLabel = sum.complete ? formatPct(sum.sum) : "不完整";
    var off = sum.complete && Math.abs(sum.sum - 100) > 0.05;
    list.appendChild(el(doc, "li", { class: off ? "down" : "" }, ["合计 " + sumLabel]));
    return list;
  }

  function renderAsof(doc, container, view) {
    var priceText = priceSummary(view.rows);
    var holdingTime = view.holdingsAsOf || "未录入";
    var holdingSource = view.local ? "本机这次打开" : "公开页";
    container.replaceChildren(
      el(doc, "span", {}, ["价格截至 "]),
      el(doc, "strong", {}, [priceText]),
      el(doc, "span", {}, [" · 持仓截至 "]),
      el(doc, "strong", {}, [holdingTime]),
      el(doc, "span", {}, ["（" + holdingSource + "，" + view.timezone + "，持仓是否含盘后：" + afterHoursLabel(view.holdingsAfterHours) + "）"])
    );
  }

  function priceSummary(rows) {
    var priced = rows.filter(function (row) { return isNum(row.price); });
    if (!priced.length) return "未录入";
    var times = unique(priced.map(function (row) { return row.priceAsOf || "未标明时间"; }));
    var flags = unique(priced.map(function (row) { return row.afterHours || "是否含盘后未标明"; }));
    return times.join("；") + "，" + flags.join("；");
  }

  function unique(list) {
    var seen = dict();
    var out = [];
    list.forEach(function (item) {
      if (seen[item]) return;
      seen[item] = true;
      out.push(item);
    });
    return out;
  }

  function renderGlance(doc, container, view) {
    var sum = sumTargets(view.rows);
    var anomalies = weightAnomalies(view.rows, view.threshold.valuePp);
    var watches = view.rows.filter(function (row) { return row.status === "观察" || row.status === "恶化"; });
    var unverified = view.rows.filter(function (row) { return row.status === "待核实"; });
    var missingActions = view.suggestions.filter(function (item) { return item.action.missing; }).length;
    var knownActions = view.suggestions.filter(function (item) { return !item.action.missing && !item.action.unrecognized; });
    container.replaceChildren(
      glanceCard(doc, "#holdings", "持有框架", frameworkGlance(doc, view, sum)),
      glanceCard(doc, "#holdings", "偏离", anomalyGlance(doc, view, anomalies)),
      glanceCard(doc, "#companies", "观察", [
        watches.length ? watches.map(function (row) { return row.ticker + " " + row.status; }).join("、") : "没有标成观察或恶化的名字。",
        unverified.length ? unverified.length + " 个仍是待核实，这不是「没事」。" : ""
      ].filter(Boolean).join("")),
      glanceCard(doc, "#actions", "建议", suggestionGlance(missingActions, knownActions, view.suggestions.length))
    );
  }

  function frameworkGlance(doc, view, sum) {
    var actuals = view.rows.filter(function (row) { return isNum(row.actualPct); }).length;
    var sumText = sum.complete ? formatPct(sum.sum) : "不完整";
    return "目标 " + view.rows.length + " 项，合计 " + sumText + "。" +
      (actuals ? "本机载入了 " + actuals + " 个实际百分比。" : "实际仓位未录入。");
  }

  function anomalyGlance(doc, view, anomalies) {
    if (anomalies.state === "threshold_unset") {
      return "观察阈值还没设置。权重偏离不会自动标成要行动。没有实际仓位时，偏离也无法判断。";
    }
    if (anomalies.state === "no_actual") return "观察阈值已填写，但没有实际仓位，偏离无法判断。";
    if (!anomalies.flagged.length) return "已载入的仓位没有超过观察阈值。这不是交易建议。";
    return "超过观察阈值：" + anomalies.flagged.map(function (row) {
      return row.ticker + " " + (formatPp(row.deviationPp) || "—");
    }).join("、") + "。这只表示要复核，不是下单。";
  }

  function suggestionGlance(missingCount, known, total) {
    if (!total) return "没有建议条目。无法判断。";
    if (missingCount === total) return "全部无法判断。缺证据时不默认继续持有。";
    var parts = known.map(function (item) { return item.ticker + " " + item.action.label; });
    if (missingCount) parts.push(missingCount + " 项无法判断");
    return parts.join("、") + "。建议不是下单。";
  }

  function glanceCard(doc, href, title, body) {
    return el(doc, "a", { class: "glance-card", href: href }, [
      el(doc, "div", { class: "glance-name" }, [title]),
      el(doc, "p", { class: "glance-meta" }, [body])
    ]);
  }

  function renderHoldings(doc, container, view) {
    var columns = metricColumns(view.rows);
    var table = el(doc, "table", {});
    var head = el(doc, "tr", {}, [
      el(doc, "th", { scope: "col" }, ["名称"]),
      el(doc, "th", { scope: "col" }, ["实际"]),
      el(doc, "th", { scope: "col" }, ["目标"]),
      el(doc, "th", { scope: "col" }, ["偏离"])
    ]);
    if (columns.price) head.appendChild(el(doc, "th", { scope: "col" }, ["价格"]));
    if (columns.valuation) head.appendChild(el(doc, "th", { scope: "col" }, ["估值"]));
    if (columns.returnPct) head.appendChild(el(doc, "th", { scope: "col" }, ["收益"]));
    if (columns.contributionPct) head.appendChild(el(doc, "th", { scope: "col" }, ["组合贡献"]));
    head.appendChild(el(doc, "th", { scope: "col" }, ["状态"]));
    table.appendChild(el(doc, "thead", {}, [head]));
    var body = el(doc, "tbody", {});
    view.rows.forEach(function (row) {
      var cells = [
        el(doc, "th", { scope: "row" }, [
          el(doc, "span", { class: "dot seg-" + row.ticker.toLowerCase() }),
          el(doc, "span", { class: "ticker" }, [row.ticker]),
          " " + row.name
        ]),
        el(doc, "td", {}, [pctOr(doc, row.actualPct)]),
        el(doc, "td", {}, [pctOr(doc, row.targetPct)]),
        el(doc, "td", {}, [ppOr(doc, row.deviationPp)])
      ];
      if (columns.price) cells.push(priceCell(doc, row));
      if (columns.valuation) cells.push(metricCell(doc, row.valuation, row.valuationNote, row.valuationSource));
      if (columns.returnPct) cells.push(el(doc, "td", {}, [pctOr(doc, row.returnPct)]));
      if (columns.contributionPct) cells.push(el(doc, "td", {}, [pctOr(doc, row.contributionPct)]));
      cells.push(el(doc, "td", {}, [badge(doc, row.status, statusClass(row.status))]));
      body.appendChild(el(doc, "tr", {}, cells));
    });
    table.appendChild(body);
    var wrap = el(doc, "div", { class: "table-wrap" }, [table]);
    var blocks = [renderTargetBar(doc, view.rows), wrap];
    if (view.local) {
      blocks.unshift(el(doc, "p", { class: "hint" }, ["实际百分比来自这台浏览器里刚打开的文件，没有上传。刷新后会消失。"]));
    }
    if (!columns.price && !columns.valuation && !columns.returnPct && !columns.contributionPct) {
      blocks.push(el(doc, "p", { class: "hint" }, ["价格、估值、收益和组合贡献都还没录入，所以这些列不显示，也不用 0 填充。"]));
    }
    ["cash", "overlap", "missing"].forEach(function (id) {
      var line = methodText(view, id);
      if (line) blocks.push(el(doc, "p", { class: "hint" }, [line]));
    });
    container.replaceChildren.apply(container, blocks);
  }

  function priceCell(doc, row) {
    if (!isNum(row.price)) return el(doc, "td", {}, [missing(doc, "—")]);
    var bits = [formatPrice(row.price) + (row.priceCurrency ? " " + row.priceCurrency : "")];
    var cell = el(doc, "td", {}, [bits[0]]);
    var meta = [row.priceAsOf, row.afterHours].filter(Boolean).join(" · ");
    if (meta) cell.appendChild(el(doc, "div", { class: "cell-meta" }, [meta]));
    var link = externalLink(doc, row.priceSource, "来源");
    if (link) cell.appendChild(el(doc, "div", { class: "cell-meta" }, [link]));
    return cell;
  }

  function metricCell(doc, value, note, source) {
    var cell = el(doc, "td", {}, [isNum(value) ? doc.createTextNode(String(value)) : missing(doc, "—")]);
    if (note) cell.appendChild(el(doc, "div", { class: "cell-meta" }, [note]));
    var link = externalLink(doc, source, "来源");
    if (link) cell.appendChild(el(doc, "div", { class: "cell-meta" }, [link]));
    return cell;
  }

  function renderTargetBar(doc, rows) {
    var sum = sumTargets(rows);
    if (!sum.complete || !(sum.sum > 0)) return el(doc, "p", { class: "hint" }, ["目标权重不完整，比例条先不画。"]);
    var bar = el(doc, "div", { class: "mix", role: "img", "aria-label": "目标权重比例" });
    rows.forEach(function (row) {
      bar.appendChild(el(doc, "span", {
        class: "seg seg-" + row.ticker.toLowerCase(),
        style: "width:" + (row.targetPct / sum.sum * 100) + "%",
        title: row.ticker + " " + formatPct(row.targetPct)
      }));
    });
    return el(doc, "div", { class: "mix-block" }, [bar, renderWeightList(doc, rows)]);
  }

  function renderCompanies(doc, container, model) {
    container.replaceChildren.apply(container, model.rows.map(function (row) {
      return renderCompany(doc, row);
    }));
  }

  function renderCompany(doc, row) {
    var meta = el(doc, "dl", { class: "meta" });
    [
      ["论点", row.thesis, "待填"],
      ["状态依据", row.statusRationale, "待填"],
      ["信心", row.confidence, "未填"],
      ["上次复核", row.lastReview, "未填"],
      ["下次核对", row.nextVerification, "未填"]
    ].forEach(function (item) {
      meta.appendChild(el(doc, "dt", {}, [item[0]]));
      meta.appendChild(el(doc, "dd", {}, [textOr(doc, item[1], item[2])]));
    });
    var focus = el(doc, "ul", { class: "focus-list" });
    if (!row.focus.length) focus.appendChild(el(doc, "li", { class: "na" }, ["关注项还没列。"]));
    row.focus.forEach(function (item) { focus.appendChild(el(doc, "li", {}, [item])); });
    return el(doc, "article", { class: "company", id: "company-" + row.ticker }, [
      el(doc, "div", { class: "company-head" }, [
        el(doc, "h3", {}, [
          el(doc, "span", { class: "dot seg-" + row.ticker.toLowerCase() }),
          row.ticker + " " + row.name
        ]),
        badge(doc, row.status, statusClass(row.status))
      ]),
      meta,
      el(doc, "h4", {}, ["关注项"]),
      el(doc, "p", { class: "hint" }, ["下面是要核对的问题，不是已经核实的事实。"]),
      focus,
      el(doc, "div", { class: "evidence" }, EVIDENCE_LANES.map(function (lane) {
        return renderLane(doc, lane[1], row.evidence[lane[0]]);
      }))
    ]);
  }

  function renderLane(doc, title, items) {
    var list = el(doc, "ul", { class: "lane-list" });
    if (!items.length) list.appendChild(el(doc, "li", { class: "na" }, ["暂无"]));
    items.forEach(function (item) { list.appendChild(renderEvidenceItem(doc, item)); });
    return el(doc, "div", { class: "lane" }, [el(doc, "h4", {}, [title]), list]);
  }

  function renderEvidenceItem(doc, item) {
    var body = typeof item === "string" ? { text: item } : (item || {});
    var line = el(doc, "li", {}, [textOr(doc, text(body.text) || text(body.summary), "待填")]);
    var bits = [];
    if (text(body.as_of)) bits.push("截至 " + text(body.as_of));
    bits.push(body.verified === true ? "已核实" : "待核实");
    line.appendChild(el(doc, "div", { class: "cell-meta" }, [bits.join(" · ")]));
    var link = externalLink(doc, body.source_url, "来源");
    if (link) line.appendChild(el(doc, "div", { class: "cell-meta" }, [link]));
    return line;
  }

  function renderThemes(doc, container, model) {
    var themes = model.themes || {};
    var blocks = [];
    if (text(themes.note)) blocks.push(el(doc, "p", { class: "hint" }, [themes.note]));
    var items = listOf(themes.items);
    if (!items.length) blocks.push(el(doc, "p", { class: "na" }, ["还没有共同风险条目。"]));
    items.forEach(function (item) {
      var tickers = listOf(item.tickers).map(upper).filter(Boolean);
      blocks.push(el(doc, "article", { class: "company" }, [
        el(doc, "div", { class: "company-head" }, [
          el(doc, "h3", {}, [text(item.title) || "未命名主题"]),
          badge(doc, normalizeStatus(item.status), statusClass(normalizeStatus(item.status)))
        ]),
        el(doc, "p", { class: "hint" }, [tickers.length ? tickers.join("、") : "未标明涉及的名字"]),
        el(doc, "p", {}, [textOr(doc, item.assessment, "评估待填")])
      ]));
    });
    container.replaceChildren.apply(container, blocks);
  }

  function renderTimeline(doc, container, model) {
    var filter = { ticker: "全部", theme: "全部", importance: "全部", from: "", to: "" };
    var list = el(doc, "div", { class: "stack" });
    var controls = el(doc, "div", { class: "filters" });
    controls.appendChild(selectFilter(doc, "公司", ["全部"].concat(model.rows.map(function (row) { return row.ticker; })).concat(["跨公司"]), function (value) {
      filter.ticker = value;
      paint();
    }));
    var themes = unique(model.events.map(function (event) { return text(event.theme); }).filter(Boolean));
    controls.appendChild(selectFilter(doc, "主题", ["全部"].concat(themes), function (value) {
      filter.theme = value;
      paint();
    }));
    controls.appendChild(selectFilter(doc, "重要性", ["全部", "高", "中", "低"], function (value) {
      filter.importance = value;
      paint();
    }));
    controls.appendChild(dateFilter(doc, "发生日期从", function (value) { filter.from = value; paint(); }));
    controls.appendChild(dateFilter(doc, "到", function (value) { filter.to = value; paint(); }));
    function paint() {
      var events = flagDuplicates(filterEvents(sortEvents(model.events), filter));
      if (!model.events.length) {
        list.replaceChildren(el(doc, "p", { class: "empty" }, ["还没有记录。不要用未核实的旧闻把这里填满。"]));
        return;
      }
      if (!events.length) {
        list.replaceChildren(el(doc, "p", { class: "empty" }, ["没有符合筛选的记录。"]));
        return;
      }
      list.replaceChildren.apply(list, events.map(function (event) { return renderEvent(doc, event); }));
    }
    paint();
    container.replaceChildren(controls, list);
  }

  function selectFilter(doc, label, options, onChange) {
    var select = el(doc, "select", {});
    options.forEach(function (option) {
      select.appendChild(el(doc, "option", { value: option }, [option]));
    });
    select.addEventListener("change", function () { onChange(select.value); });
    return el(doc, "label", {}, [label, select]);
  }

  function dateFilter(doc, label, onChange) {
    var input = el(doc, "input", { type: "date" });
    input.addEventListener("change", function () { onChange(input.value); });
    return el(doc, "label", {}, [label, input]);
  }

  function renderEvent(doc, event) {
    var id = safeDomId("event", event.id);
    var ticker = text(event.ticker) || "跨公司";
    var bits = [ticker];
    if (text(event.theme)) bits.push(text(event.theme));
    var tags = el(doc, "div", { class: "tag-row" }, [
      text(event.kind) ? badge(doc, text(event.kind), "na") : null,
      text(event.importance) ? badge(doc, text(event.importance), "na") : null,
      badge(doc, event.verified === true ? "已核实" : "待核实", event.verified === true ? "up" : "na")
    ]);
    var body = [
      el(doc, "div", { class: "company-head" }, [el(doc, "h3", {}, [bits.join(" · ")]), tags]),
      metaLine(doc, "发生", text(event.event_at), "未填"),
      metaLine(doc, "记录", text(event.recorded_at), "未填"),
      metaLine(doc, "事实", text(event.fact), "事实摘要未写"),
      metaLine(doc, "影响", text(event.impact), "未写")
    ];
    var link = externalLink(doc, event.source_url, text(event.source_url) || "来源");
    body.push(el(doc, "p", { class: "hint" }, [link || missing(doc, "没有原始链接")]));
    if (text(event.continues)) body.push(el(doc, "p", { class: "hint" }, ["承接「" + text(event.continues) + "」。旧记录保留。"]));
    if (text(event.corrects)) body.push(el(doc, "p", { class: "hint" }, ["这是对「" + text(event.corrects) + "」的更正。旧记录保留。"]));
    if (text(event.correction_note)) body.push(el(doc, "p", {}, [text(event.correction_note)]));
    if (event.duplicateOf) body.push(el(doc, "p", { class: "hint warn" }, ["可能与「" + event.duplicateOf + "」重复。两条都留着，不自动删。"]));
    var card = el(doc, "article", { class: "company" }, body);
    if (id) card.id = id;
    return card;
  }

  function metaLine(doc, label, value, emptyLabel) {
    return el(doc, "p", {}, [label + "：", textOr(doc, value, emptyLabel)]);
  }

  function renderFocus(doc, container, model) {
    var shots = model.focus.slice().sort(function (a, b) {
      var left = text(a.as_of) || "";
      var right = text(b.as_of) || "";
      if (left === right) return 0;
      if (!left) return 1;
      if (!right) return -1;
      return left < right ? 1 : -1;
    });
    if (!shots.length) {
      container.replaceChildren(el(doc, "p", { class: "empty" }, ["还没有焦点快照。不要回填没记录过的历史。"]));
      return;
    }
    container.replaceChildren.apply(container, shots.map(function (shot) { return renderFocusShot(doc, shot); }));
  }

  function renderFocusShot(doc, shot) {
    var themes = listOf(shot.themes);
    var names = themes.map(function (theme) { return text(theme.name) || text(theme); }).filter(Boolean);
    var summary = el(doc, "summary", {}, [
      (text(shot.as_of) || "未标日期") + (names.length ? " · " + names.join("、") : " · 未写主题")
    ]);
    var body = [summary];
    if (text(shot.why)) body.push(el(doc, "p", {}, [shot.why]));
    else body.push(el(doc, "p", {}, [missing(doc, "原因待填")]));
    if (text(shot.recorded_at)) body.push(el(doc, "p", { class: "hint" }, ["记录于 " + text(shot.recorded_at)]));
    if (text(shot.supersedes)) body.push(el(doc, "p", { class: "hint" }, ["取代「" + text(shot.supersedes) + "」。旧快照保留。"]));
    var list = el(doc, "ul", { class: "focus-list" });
    if (!themes.length) list.appendChild(el(doc, "li", { class: "na" }, ["没有主题。"]));
    themes.forEach(function (theme) {
      if (typeof theme === "string") {
        list.appendChild(el(doc, "li", {}, [theme]));
        return;
      }
      var tickers = listOf(theme.tickers).map(upper).filter(Boolean);
      var line = (text(theme.name) || "未命名") + (tickers.length ? "（" + tickers.join("、") + "）" : "");
      var item = el(doc, "li", {}, [line]);
      if (text(theme.why)) item.appendChild(el(doc, "div", { class: "cell-meta" }, [theme.why]));
      list.appendChild(item);
    });
    body.push(list);
    var details = el(doc, "details", { class: "fold focus-shot" }, body);
    var id = safeDomId("focus", shot.id);
    if (id) details.id = id;
    return details;
  }

  function renderActions(doc, container, view) {
    var intro = el(doc, "div", { class: "stack" }, [
      el(doc, "p", { class: "hint" }, ["建议不是自动交易，也不会下单。证据不够时显示「无法判断」，不默认继续持有。"]),
      el(doc, "p", { class: "hint" }, ["论点恶化即使权重仍在目标上，也可以触发评估。价格偏离本身不是交易指令。"])
    ]);
    var cards = view.suggestions.map(function (item) {
      var row = view.rows.find(function (candidate) { return candidate.ticker === item.ticker; });
      return renderSuggestion(doc, item, row);
    });
    container.replaceChildren.apply(container, [intro].concat(cards));
  }

  function renderSuggestion(doc, item, row) {
    var actionKind = item.action.label === "无法判断" ? "warn" : "na";
    var stance = item.priceVsThesis || (item.priceVsUnrecognized ? "未识别，按无法判断处理" : "未填");
    var sim = adjustmentNote(row && row.actualPct, row && row.targetPct);
    return el(doc, "article", { class: "company", id: "action-" + item.ticker }, [
      el(doc, "div", { class: "company-head" }, [
        el(doc, "h3", {}, [item.ticker + " " + item.name]),
        badge(doc, item.action.label, actionKind)
      ]),
      item.action.unrecognized ? el(doc, "p", { class: "hint" }, ["动作「" + item.action.unrecognized + "」不在可用列表里，已按无法判断显示。"]) : null,
      metaLine(doc, "价格还是论点", stance, "未填"),
      item.note ? el(doc, "p", {}, [item.note]) : null,
      listBlock(doc, "证据", item.evidence),
      listBlock(doc, "触发", item.triggers),
      listBlock(doc, "证伪", item.falsifiers),
      listBlock(doc, "待核对", item.pending),
      listBlock(doc, "时间点", item.timepoints),
      el(doc, "p", {}, ["若调整：" + sim.text])
    ]);
  }

  function listBlock(doc, label, items) {
    if (!items.length) return el(doc, "p", { class: "hint" }, [label + "：暂无"]);
    var list = el(doc, "ul", { class: "focus-list" });
    items.forEach(function (item) { list.appendChild(el(doc, "li", {}, [item])); });
    return el(doc, "div", {}, [el(doc, "h4", {}, [label]), list]);
  }

  function renderMethodology(doc, container, model) {
    var list = el(doc, "ul", { class: "focus-list" });
    if (!model.methodology.length) list.appendChild(el(doc, "li", { class: "na" }, ["口径说明还没写。"]));
    model.methodology.forEach(function (item) { list.appendChild(el(doc, "li", {}, [item.text])); });
    container.replaceChildren(list);
  }

  function renderLocal(doc, container, tickers, onLocal) {
    var message = el(doc, "div", { class: "stack", role: "status", "aria-live": "polite" });
    var input = el(doc, "input", { type: "file", accept: "application/json,.json" });
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      input.value = "";
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var parsed = parseLocal(String(reader.result || ""), tickers);
        message.replaceChildren.apply(message, messageNodes(doc, parsed));
        onLocal(parsed.local || null);
      };
      reader.onerror = function () {
        message.replaceChildren(el(doc, "p", { class: "down" }, ["文件没有读成。"]));
        onLocal(null);
      };
      reader.readAsText(file);
    });
    var clear = el(doc, "button", { class: "btn", type: "button" }, ["清除本次载入"]);
    clear.addEventListener("click", function () {
      message.replaceChildren(el(doc, "p", {}, ["已清除。实际仓位回到公开页的空白。"]));
      onLocal(null);
    });
    var download = el(doc, "button", { class: "btn", type: "button" }, ["下载空白模板"]);
    download.addEventListener("click", function () {
      var blob = new Blob([templateJson(tickers)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var link = el(doc, "a", { href: url, download: "holdings-template.json" }, ["下载"]);
      doc.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });
    container.replaceChildren(
      el(doc, "p", {}, ["选择一个只存在你电脑上的 JSON。页面只用它计算百分比，不展示股数和金额，也不上传。刷新后需要重新选择。"]),
      el(doc, "p", { class: "hint" }, ["优先写 actual_pct。不要把这个文件提交进仓库。股数会被忽略，因为页面不联网取价。"]),
      el(doc, "div", { class: "button-row" }, [
        el(doc, "label", { class: "btn" }, ["选择 JSON", input]),
        download,
        clear
      ]),
      message
    );
  }

  function parseLocal(raw, tickers) {
    var doc;
    try {
      doc = JSON.parse(raw);
    } catch (error) {
      return { error: "JSON 无法解析。", local: null };
    }
    return { error: null, local: readLocalActuals(doc, tickers) };
  }

  function messageNodes(doc, parsed) {
    if (parsed.error) return [el(doc, "p", { class: "down" }, [parsed.error])];
    var local = parsed.local;
    var nodes = [el(doc, "p", {}, ["已在这次打开的页面里使用，没有上传。依据：" + basisLabel(local.basis) + "。"])];
    local.warnings.forEach(function (warning) {
      nodes.push(el(doc, "p", { class: "hint" }, [warning]));
    });
    return nodes;
  }

  function basisLabel(basis) {
    if (basis === "actual_pct") return "实际百分比";
    if (basis === "market_value") return "本机金额换算的百分比";
    return "没有可用仓位";
  }

  function mount(container, data) {
    if (!container || !container.ownerDocument) throw new Error("缺少页面容器");
    var doc = container.ownerDocument;
    var model = buildModel(data);
    var local = null;
    var slot = {
      asof: container.querySelector("[data-mount='asof']"),
      glance: container.querySelector("[data-mount='glance']"),
      principles: container.querySelector("[data-mount='principles']"),
      holdings: container.querySelector("[data-mount='holdings']"),
      companies: container.querySelector("[data-mount='companies']"),
      themes: container.querySelector("[data-mount='themes']"),
      timeline: container.querySelector("[data-mount='timeline']"),
      focus: container.querySelector("[data-mount='focus']"),
      actions: container.querySelector("[data-mount='actions']"),
      local: container.querySelector("[data-mount='local']"),
      method: container.querySelector("[data-mount='method']")
    };
    renderPrinciples(doc, slot.principles, model);
    renderCompanies(doc, slot.companies, model);
    renderThemes(doc, slot.themes, model);
    renderTimeline(doc, slot.timeline, model);
    renderFocus(doc, slot.focus, model);
    renderMethodology(doc, slot.method, model);
    renderLocal(doc, slot.local, model.rows.map(function (row) { return row.ticker; }), function (next) {
      local = next;
      paint();
    });
    function paint() {
      var view = viewModel(model, local);
      renderAsof(doc, slot.asof, view);
      renderGlance(doc, slot.glance, view);
      renderHoldings(doc, slot.holdings, view);
      renderActions(doc, slot.actions, view);
    }
    paint();
  }

  return {
    ACTIONS: ACTIONS,
    isNum: isNum,
    deviationPp: deviationPp,
    formatPct: formatPct,
    formatPp: formatPp,
    safeUrl: safeUrl,
    normalizeAction: normalizeAction,
    buildModel: buildModel,
    viewModel: viewModel,
    readLocalActuals: readLocalActuals,
    weightAnomalies: weightAnomalies,
    adjustmentNote: adjustmentNote,
    filterEvents: filterEvents,
    sortEvents: sortEvents,
    flagDuplicates: flagDuplicates,
    metricColumns: metricColumns,
    sumTargets: sumTargets,
    templateJson: templateJson,
    latestQuotes: latestQuotes,
    mount: mount
  };
});
