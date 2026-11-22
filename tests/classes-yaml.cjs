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
  const value = String(raw == null ? "" : raw).trim();
  if (!value) return "";
  if ((value[0] === '"' && value[value.length - 1] === '"') || (value[0] === "'" && value[value.length - 1] === "'")) {
    return value.slice(1, -1);
  }
  if (/^-?\d+$/.test(value)) return Number(value);
  if (/^-?\d+\.\d+$/.test(value)) return Number(value);
  return value;
}

function loadClassesYaml(text) {
  const data = { courses: [] };
  let course = null;
  let section = null;
  let item = null;
  for (const rawLine of String(text).split(/\n/)) {
    const line = stripComment(rawLine);
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) {
      const key = line.slice(0, line.indexOf(":")).trim();
      if (key === "snapshot_as_of") data.snapshot_as_of = scalar(line.slice(line.indexOf(":") + 1));
      course = null;
      section = null;
      item = null;
      continue;
    }
    if (line.startsWith("  - key:")) {
      course = { key: scalar(line.slice(line.indexOf(":") + 1)), payments: [], sessions: [] };
      data.courses.push(course);
      section = null;
      item = null;
      continue;
    }
    if (!course) continue;
    if (line.startsWith("    payments:")) {
      section = "payments";
      item = null;
      continue;
    }
    if (line.startsWith("    sessions:")) {
      section = "sessions";
      item = null;
      continue;
    }
    if (line.startsWith("      - date:")) {
      item = { date: scalar(line.slice(line.indexOf(":") + 1)) };
      course[section].push(item);
      continue;
    }
    const splitAt = line.indexOf(":");
    if (splitAt < 0) continue;
    const key = line.slice(0, splitAt).trim();
    const value = scalar(line.slice(splitAt + 1));
    if (item && line.startsWith("        ")) item[key] = value;
    else if (!item && line.startsWith("    ")) course[key] = value;
  }
  return data;
}

module.exports = { loadClassesYaml };
