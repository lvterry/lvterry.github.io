/* 课程页的读表和计算。class.html 只负责画。
   运行时读 Google 表格的 Courses、Sessions、Payments，不带登录态。
   不读 Summary，也不读 About。读不到表格时由页面改用标明日期的存档。
   日期只认日历上的年月日，不用会按 UTC 把日期拨到前一天的解析。 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ClassPage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var SHEET_ID = "1jsDGlPjqnbPS0Pw6Gt5iDbJOEHB5WhHxH-qijaT7ySc";
  var SHEET_ID_RE = /^[A-Za-z0-9_-]{20,80}$/;
  var KEY_RE = /^[a-z][a-z0-9_-]{0,40}$/;
  var HEADER_RE = /^[a-z_]{1,40}$/;
  var COLORS = {
    spanish: "var(--course-spanish)",
    boxing: "var(--course-boxing)"
  };
  var TABS = {
    courses: { name: "Courses", gid: "108538292" },
    sessions: { name: "Sessions", gid: "1212152675" },
    payments: { name: "Payments", gid: "188672671" }
  };
  var HOST = "https://docs.google.com";
  var jsonpSeq = 0;

  function deniedError(message) {
    var error = new Error(message || "sheet access denied");
    error.denied = true;
    return error;
  }

  function assertSheetId(id) {
    if (!SHEET_ID_RE.test(id)) throw new Error("sheet id");
    return id;
  }

  function isSafeKey(key) {
    return KEY_RE.test(key);
  }

  function colorFor(key) {
    return COLORS[key] || "var(--accent)";
  }

  function pad(n) {
    n = Number(n);
    return (n < 10 ? "0" : "") + n;
  }

  function validYmd(year, month, day) {
    year = Number(year);
    month = Number(month);
    day = Number(day);
    if (!isFinite(year) || year < 1000 || year > 9999) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    var dt = new Date(year, month - 1, day, 12);
    if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return null;
    return year + "-" + pad(month) + "-" + pad(day);
  }

  function datePattern(pattern) {
    var text = String(pattern || "").toLowerCase();
    return text.indexOf("y") !== -1 && text.indexOf("m") !== -1 && text.indexOf("d") !== -1;
  }

  /* 表格把日期列存成序列数，显示格式才是 yyyy-mm-dd。
     序列从 1899-12-30 起算，用 UTC 取出年月日，避免浏览器时区把日期提前一天。 */
  function dateFromSerial(value) {
    if (typeof value !== "number" || !isFinite(value)) return null;
    var days = Math.round(value);
    if (Math.abs(value - days) > 1e-4 || days < 30000 || days > 80000) return null;
    var utc = Date.UTC(1899, 11, 30) + days * 86400000;
    var dt = new Date(utc);
    var iso = validYmd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    if (!iso) return null;
    var year = Number(iso.slice(0, 4));
    if (year < 2000 || year > 2100) return null;
    return iso;
  }

  function normalizeDate(value) {
    if (value == null || value === "") return null;
    if (typeof value === "number") return dateFromSerial(value);
    var text = String(value).trim();
    var iso = /^(\d{4})-(\d{2})-(\d{2})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/.exec(text);
    if (iso) return validYmd(iso[1], iso[2], iso[3]);
    var slash = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(text);
    if (slash) return validYmd(slash[1], slash[2], slash[3]);
    var gviz = /^Date\((\d{4}),(\d{1,2}),(\d{1,2})(?:,\d{1,2},\d{1,2},\d{1,2})?\)$/.exec(text);
    if (gviz) return validYmd(gviz[1], Number(gviz[2]) + 1, gviz[3]);
    return null;
  }

  function normalizeNumber(value) {
    if (typeof value === "number") return isFinite(value) ? tidy(value) : null;
    if (value == null) return null;
    var text = String(value).trim();
    if (!text || text === "—" || text === "-") return null;
    text = text.replace(/[¥￥,\s]/g, "");
    if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
    var n = Number(text);
    return isFinite(n) ? tidy(n) : null;
  }

  function tidy(n) {
    if (Math.abs(n - Math.round(n)) < 1e-9) return Math.round(n);
    return Math.round(n * 100) / 100;
  }

  function cleanText(value, maxChars) {
    var text = String(value == null ? "" : value).replace(/[\u0000-\u001f\u007f]/g, "").trim();
    var chars = Array.from(text);
    if (chars.length > maxChars) return chars.slice(0, maxChars).join("");
    return text;
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function parseDate(iso) {
    var p = String(iso).split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12);
  }

  function formatDate(iso) {
    var p = String(iso).split("-");
    return p[0] + "." + Number(p[1]) + "." + Number(p[2]);
  }

  function calendarDay(today) {
    if (!today) {
      var now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
    }
    if (typeof today === "string") return parseDate(normalizeDate(today) || today);
    return new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  }

  function daysBetween(a, b) {
    return Math.round((b - a) / 86400000);
  }

  function sessionCredits(s) {
    var v = s && s.credits;
    return typeof v === "number" && isFinite(v) && v > 0 ? v : 1;
  }

  function cardPct(s) {
    return s.cardSize ? Math.min(100, (s.onCard / s.cardSize) * 100) : 0;
  }

  function summarize(course, today) {
    var TODAY = calendarDay(today);
    var sessions = (course.sessions || []).slice().sort(function (a, b) {
      return a.date < b.date ? -1 : 1;
    });
    var payments = (course.payments || []).slice().sort(function (a, b) {
      return a.date < b.date ? -1 : 1;
    });
    var attended = sessions.reduce(function (n, s) { return n + sessionCredits(s); }, 0);
    var purchased = payments.reduce(function (n, p) { return n + (Number(p.credits) || 0); }, 0);
    var spend = payments.reduce(function (n, p) { return n + (Number(p.amount) || 0); }, 0);
    var last = sessions.length ? sessions[sessions.length - 1] : null;
    var lastPayment = payments.length ? payments[payments.length - 1] : null;
    var previous = sessions.length > 1 ? sessions[sessions.length - 2] : null;
    var onCard = lastPayment
      ? sessions.filter(function (s) { return s.date > lastPayment.date; }).reduce(function (n, s) { return n + sessionCredits(s); }, 0)
      : 0;
    var cardSize = lastPayment ? Number(lastPayment.credits) || 0 : 0;
    return {
      sessions: sessions,
      payments: payments,
      attended: attended,
      purchased: purchased,
      spend: spend,
      remaining: purchased - attended,
      last: last,
      lastPayment: lastPayment,
      previous: previous,
      onCard: onCard,
      cardSize: cardSize,
      online: sessions.filter(function (s) { return s.mode === "线上"; }).length,
      recent: sessions.filter(function (s) { return daysBetween(parseDate(s.date), TODAY) <= 90; }).length,
      daysSinceLast: last ? daysBetween(parseDate(last.date), TODAY) : null,
      gap: last && previous ? daysBetween(parseDate(previous.date), parseDate(last.date)) : null,
      avgGap: sessions.length > 1 ? Math.round(daysBetween(parseDate(sessions[0].date), parseDate(last.date)) / (sessions.length - 1)) : null,
      perSession: attended ? Math.round(spend / attended) : null
    };
  }

  function looksLikeHtml(text) {
    var sample = String(text || "").replace(/^\uFEFF/, "").trim().slice(0, 300).toLowerCase();
    return sample.charAt(0) === "<" || sample.indexOf("<!doctype html") === 0 || sample.indexOf("<html") === 0;
  }

  function headerName(col) {
    var label = cleanText(col && (col.label != null ? col.label : col.id), 40).toLowerCase();
    return HEADER_RE.test(label) ? label : "";
  }

  function cellValue(cell, col) {
    if (!cell || typeof cell !== "object") return "";
    var type = col && col.type;
    if (type === "date" || type === "datetime" || type === "dateTime") {
      return normalizeDate(cell.f) || normalizeDate(cell.v) || "";
    }
    if (type === "number") {
      var shown = normalizeDate(cell.f);
      var serial = dateFromSerial(cell.v);
      if ((datePattern(col && col.pattern) && (shown || serial)) || (shown && serial)) return shown || serial;
      if (typeof cell.v === "number" && isFinite(cell.v)) return tidy(cell.v);
      var fromFormatted = normalizeNumber(cell.f != null ? cell.f : cell.v);
      return fromFormatted == null ? "" : fromFormatted;
    }
    if (typeof cell.v === "number" && isFinite(cell.v)) return tidy(cell.v);
    if (typeof cell.v === "string") return cell.v.replace(/[\u0000-\u001f\u007f]/g, "").trim();
    if (cell.v == null || cell.v === "") {
      return cell.f == null ? "" : cleanText(cell.f, 500);
    }
    return "";
  }

  function rowHasValue(row) {
    var keys = Object.keys(row);
    for (var i = 0; i < keys.length; i += 1) {
      var value = row[keys[i]];
      if (value != null && String(value).trim() !== "") return true;
    }
    return false;
  }

  function tableToRows(table) {
    var cols = (table && table.cols) || [];
    var labels = cols.map(headerName);
    if (labels.indexOf("course_key") < 0) throw new Error("missing course_key");
    return ((table && table.rows) || []).map(function (row) {
      var obj = {};
      var cells = (row && row.c) || [];
      for (var i = 0; i < labels.length; i += 1) {
        if (!labels[i] || Object.prototype.hasOwnProperty.call(obj, labels[i])) continue;
        obj[labels[i]] = cellValue(cells[i], cols[i]);
      }
      return obj;
    }).filter(rowHasValue);
  }

  function rowsFromGvizPayload(payload) {
    if (!payload || typeof payload !== "object" || !payload.table) throw new Error("gviz status");
    if (payload.status !== "ok") {
      var reasons = payload.errors || [];
      for (var i = 0; i < reasons.length; i += 1) {
        var reason = String(reasons[i] && (reasons[i].reason || reasons[i].message) || "").toLowerCase();
        if (reason.indexOf("access") >= 0 || reason.indexOf("denied") >= 0 || reason.indexOf("unauth") >= 0) {
          throw deniedError("gviz denied");
        }
      }
      throw new Error("gviz status");
    }
    return tableToRows(payload.table);
  }

  function rowsFromGvizText(text) {
    if (looksLikeHtml(text)) throw deniedError("sheet returned html");
    var raw = String(text || "").replace(/^\uFEFF/, "").trim();
    var start = raw.indexOf("{");
    var end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("gviz parse");
    var payload;
    try {
      payload = JSON.parse(raw.slice(start, end + 1));
    } catch (e) {
      throw new Error("gviz json");
    }
    return rowsFromGvizPayload(payload);
  }

  function parseCsv(text) {
    if (looksLikeHtml(text)) throw deniedError("sheet returned html");
    var source = String(text || "").replace(/^\uFEFF/, "");
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;
    for (var i = 0; i < source.length; i += 1) {
      var ch = source.charAt(i);
      if (inQuotes) {
        if (ch === '"') {
          if (source.charAt(i + 1) === '"') {
            field += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
        continue;
      }
      if (ch === '"') {
        inQuotes = true;
        continue;
      }
      if (ch === ",") {
        row.push(field);
        field = "";
        continue;
      }
      if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && source.charAt(i + 1) === "\n") i += 1;
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
        continue;
      }
      field += ch;
    }
    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }
    if (!rows.length) throw new Error("empty csv");
    var headers = rows[0].map(function (header) {
      var name = cleanText(header, 40).toLowerCase();
      return HEADER_RE.test(name) ? name : "";
    });
    if (headers.indexOf("course_key") < 0) throw new Error("missing course_key");
    return rows.slice(1).map(function (cells) {
      var obj = {};
      for (var c = 0; c < headers.length; c += 1) {
        if (!headers[c] || Object.prototype.hasOwnProperty.call(obj, headers[c])) continue;
        obj[headers[c]] = cells[c] == null ? "" : String(cells[c]).replace(/[\u0000-\u001f\u007f]/g, "").trim();
      }
      return obj;
    }).filter(rowHasValue);
  }

  function sheetUrl(sheetId, kind, tab, cacheKey) {
    assertSheetId(sheetId);
    var gid = String(tab && tab.gid || "");
    var name = String(tab && tab.name || "");
    if (!/^\d{1,20}$/.test(gid)) throw new Error("gid");
    if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(name)) throw new Error("sheet name");
    var url = new URL(HOST + "/spreadsheets/d/" + sheetId + (kind === "csv" ? "/export" : "/gviz/tq"));
    if (kind === "csv") {
      url.searchParams.set("format", "csv");
      url.searchParams.set("gid", gid);
    } else {
      url.searchParams.set("tqx", "out:json");
      if (kind !== "gviz-gid") url.searchParams.set("sheet", name);
      url.searchParams.set("gid", gid);
    }
    if (cacheKey != null && cacheKey !== "") url.searchParams.set("_", String(cacheKey));
    return url.toString();
  }

  function withResponseHandler(gvizUrl, name) {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]{0,40}$/.test(name)) throw new Error("callback");
    var url = new URL(gvizUrl);
    if (url.origin !== HOST) throw new Error("host");
    url.searchParams.set("tqx", "out:json;responseHandler:" + name);
    return url.toString();
  }

  function request(url, env) {
    if (!env || typeof env.fetch !== "function") return Promise.reject(new Error("no fetch"));
    var ms = env.timeoutMs || 8000;
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, ms) : null;
    var init = {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      redirect: "follow"
    };
    if (controller) init.signal = controller.signal;
    return new Promise(function (resolve, reject) {
      var done = false;
      var timeout = setTimeout(function () {
        if (done) return;
        done = true;
        if (controller) controller.abort();
        reject(new Error("timeout"));
      }, ms);
      Promise.resolve(env.fetch(url, init)).then(function (response) {
        if (done) return;
        done = true;
        clearTimeout(timeout);
        if (timer) clearTimeout(timer);
        resolve(response);
      }, function (error) {
        if (done) return;
        done = true;
        clearTimeout(timeout);
        if (timer) clearTimeout(timer);
        reject(error);
      });
    });
  }

  function readResponse(response) {
    var status = response && response.status;
    if (status === 401 || status === 403) throw deniedError("sheet is not public");
    if (!response || response.ok !== true || typeof response.text !== "function") {
      throw new Error("http " + status);
    }
    return response.text();
  }

  function fetchGviz(url, env) {
    return request(url, env).then(readResponse).then(rowsFromGvizText);
  }

  function fetchCsv(url, env) {
    return request(url, env).then(readResponse).then(parseCsv);
  }

  function jsonpGviz(url, env) {
    return new Promise(function (resolve, reject) {
      var doc = env && env.document;
      var globalObject = (env && env.globalObject) || (typeof globalThis !== "undefined" ? globalThis : null);
      if (!doc || typeof doc.createElement !== "function" || !doc.head || !globalObject) {
        reject(new Error("jsonp unavailable"));
        return;
      }
      jsonpSeq += 1;
      var name = "classSheetCb" + jsonpSeq;
      var script = doc.createElement("script");
      var ms = (env && env.timeoutMs) || 8000;
      var timer = setTimeout(fail, ms);
      function cleanup() {
        clearTimeout(timer);
        try { delete globalObject[name]; } catch (e) { globalObject[name] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      }
      function fail() {
        cleanup();
        reject(new Error("jsonp failed"));
      }
      globalObject[name] = function (payload) {
        cleanup();
        try { resolve(rowsFromGvizPayload(payload)); }
        catch (error) { reject(error); }
      };
      script.async = true;
      script.onload = function () {
        /* 回调没来，多半是登录页或空脚本，不要把它当成空课程表。 */
        setTimeout(function () {
          if (globalObject[name]) fail();
        }, 0);
      };
      script.onerror = fail;
      try {
        script.src = withResponseHandler(url, name);
      } catch (error) {
        cleanup();
        reject(error);
        return;
      }
      doc.head.appendChild(script);
    });
  }

  function loadTab(tab, env) {
    var sheetId = env.sheetId || SHEET_ID;
    var gviz = sheetUrl(sheetId, "gviz", tab, env.cacheKey);
    var gvizGid = sheetUrl(sheetId, "gviz-gid", tab, env.cacheKey);
    var csv = sheetUrl(sheetId, "csv", tab, env.cacheKey);
    function next(error, action) {
      if (error && error.denied) throw error;
      return action();
    }
    return fetchGviz(gviz, env).catch(function (error) {
      return next(error, function () { return fetchGviz(gvizGid, env); });
    }).catch(function (error) {
      return next(error, function () { return fetchCsv(csv, env); });
    }).catch(function (error) {
      return next(error, function () { return jsonpGviz(gviz, env); });
    });
  }

  function loadSheets(env) {
    var options = env || {};
    var now = options.now || function () { return Date.now(); };
    var cacheKey = String(now());
    var names = ["courses", "sessions", "payments"];
    var shared = {
      fetch: options.fetch || (typeof fetch === "function" ? fetch : null),
      document: options.document || (typeof document !== "undefined" ? document : null),
      globalObject: options.globalObject || (typeof globalThis !== "undefined" ? globalThis : null),
      sheetId: options.sheetId || SHEET_ID,
      cacheKey: cacheKey,
      timeoutMs: options.timeoutMs
    };
    return Promise.all(names.map(function (name) {
      return loadTab(TABS[name], shared);
    })).then(function (parts) {
      var out = {};
      names.forEach(function (name, i) { out[name] = parts[i]; });
      return out;
    });
  }

  function courseKey(row) {
    return cleanText(row && row.course_key, 40).toLowerCase();
  }

  function assemble(tables) {
    var source = tables || {};
    var courses = [];
    var seen = Object.create(null);
    (source.courses || []).forEach(function (row, index) {
      var key = courseKey(row);
      if (!isSafeKey(key) || seen[key]) return;
      var label = cleanText(row.label, 40);
      if (!label) return;
      seen[key] = true;
      var sortOrder = normalizeNumber(row.sort_order);
      courses.push({
        key: key,
        label: label,
        emoji: cleanText(row.emoji, 8),
        color: colorFor(key),
        sortOrder: sortOrder == null ? 1000 + index : sortOrder,
        index: index,
        payments: [],
        sessions: []
      });
    });
    var byKey = Object.create(null);
    courses.forEach(function (course) { byKey[course.key] = course; });
    (source.sessions || []).forEach(function (row) {
      var course = byKey[courseKey(row)];
      if (!course) return;
      var date = normalizeDate(row.date);
      if (!date) return;
      var session = { date: date };
      var credits = normalizeNumber(row.credits);
      if (credits != null && credits > 0) session.credits = credits;
      var mode = cleanText(row.mode, 8);
      if (mode === "线上" || mode === "线下") session.mode = mode;
      var note = cleanText(row.note, 500);
      if (note) session.note = note;
      course.sessions.push(session);
    });
    (source.payments || []).forEach(function (row) {
      var course = byKey[courseKey(row)];
      if (!course) return;
      var date = normalizeDate(row.date);
      var amount = normalizeNumber(row.amount);
      var credits = normalizeNumber(row.credits);
      if (!date || amount == null || amount < 0 || credits == null || credits <= 0) return;
      var payment = { date: date, amount: amount, credits: credits };
      var note = cleanText(row.note, 500);
      if (note) payment.note = note;
      course.payments.push(payment);
    });
    courses.sort(function (a, b) {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.index - b.index;
    });
    return courses;
  }

  function coursesFromSnapshot(data) {
    var list = data && data.courses;
    if (!Array.isArray(list) || !list.length) throw new Error("snapshot missing courses");
    var tables = { courses: [], sessions: [], payments: [] };
    list.forEach(function (course, index) {
      tables.courses.push({
        course_key: course && course.key,
        label: course && course.label,
        emoji: course && course.emoji,
        sort_order: index + 1
      });
      ((course && course.sessions) || []).forEach(function (session) {
        tables.sessions.push({
          course_key: course.key,
          date: session && session.date,
          credits: session && session.credits,
          mode: session && session.mode,
          note: session && session.note
        });
      });
      ((course && course.payments) || []).forEach(function (payment) {
        tables.payments.push({
          course_key: course.key,
          date: payment && payment.date,
          amount: payment && payment.amount,
          credits: payment && payment.credits,
          note: payment && payment.note
        });
      });
    });
    var courses = assemble(tables);
    if (!courses.length) throw new Error("snapshot missing courses");
    return courses;
  }

  function staleBanner(snapshot) {
    var asOf = normalizeDate(snapshot && snapshot.snapshot_as_of);
    return {
      stale: true,
      asOf: asOf,
      text: asOf
        ? "课程表暂时读不到。下面是 " + formatDate(asOf) + " 存档，不是实时数据。"
        : "课程表暂时读不到。下面是仓库里的旧存档，不是实时数据。"
    };
  }

  function failureMessage() {
    return "课程表暂时读不到。这次没有改用旧存档。";
  }

  function start(options) {
    var opts = options || {};
    var onStatus = opts.onStatus || function () {};
    var onReady = opts.onReady || function () {};
    onStatus({ kind: "loading", text: "正在读取课程表…" });
    var loader = opts.load || loadSheets;
    return Promise.resolve().then(function () {
      return loader(opts.loadOptions);
    }).then(function (tables) {
      var courses = assemble(tables);
      onStatus({ kind: "live", text: "" });
      onReady(courses, { source: "sheet", stale: false });
      return { source: "sheet", courses: courses };
    }, function () {
      try {
        var archived = coursesFromSnapshot(opts.snapshot);
        var banner = staleBanner(opts.snapshot);
        onStatus({ kind: "stale", text: banner.text });
        onReady(archived, { source: "snapshot", stale: true, asOf: banner.asOf });
        return { source: "snapshot", courses: archived };
      } catch (error) {
        onStatus({ kind: "error", text: failureMessage() });
        onReady([], { source: "error", stale: false });
        return { source: "error", courses: [] };
      }
    });
  }

  return {
    SHEET_ID: SHEET_ID,
    TABS: TABS,
    assertSheetId: assertSheetId,
    isSafeKey: isSafeKey,
    colorFor: colorFor,
    normalizeDate: normalizeDate,
    normalizeNumber: normalizeNumber,
    escapeHtml: escapeHtml,
    parseDate: parseDate,
    formatDate: formatDate,
    sessionCredits: sessionCredits,
    cardPct: cardPct,
    summarize: summarize,
    looksLikeHtml: looksLikeHtml,
    rowsFromGvizText: rowsFromGvizText,
    rowsFromGvizPayload: rowsFromGvizPayload,
    parseCsv: parseCsv,
    sheetUrl: sheetUrl,
    withResponseHandler: withResponseHandler,
    fetchGviz: fetchGviz,
    fetchCsv: fetchCsv,
    jsonpGviz: jsonpGviz,
    loadTab: loadTab,
    loadSheets: loadSheets,
    assemble: assemble,
    coursesFromSnapshot: coursesFromSnapshot,
    staleBanner: staleBanner,
    failureMessage: failureMessage,
    start: start
  };
});
