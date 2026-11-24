const assert = require("node:assert/strict");
const fs = require("node:fs");

const OLDEST = "把风晾干";
const PREVIOUS = "盐湖空椅";
const NEWEST = "纸上的小黄鸭";
const EXPECTED_COUNT = 25;

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
  return value;
}

function loadArtworks(text) {
  const artworks = [];
  let current = null;
  for (const rawLine of String(text).split(/\n/)) {
    const line = stripComment(rawLine);
    if (!line.trim()) continue;
    if (line.startsWith("- ")) {
      current = {};
      artworks.push(current);
      const body = line.slice(2);
      const splitAt = body.indexOf(":");
      if (splitAt < 0) throw new Error("Expected key on " + line);
      current[body.slice(0, splitAt).trim()] = scalar(body.slice(splitAt + 1));
      continue;
    }
    if (!current || !/^\s/.test(line)) throw new Error("Unexpected artwork line: " + line);
    const trimmed = line.trim();
    const splitAt = trimmed.indexOf(":");
    if (splitAt < 0) throw new Error("Expected key on " + line);
    current[trimmed.slice(0, splitAt).trim()] = scalar(trimmed.slice(splitAt + 1));
  }
  return artworks;
}

function unique(values) {
  return new Set(values).size === values.length;
}

const artworks = loadArtworks(fs.readFileSync("_data/artworks.yml", "utf8"));
assert.equal(artworks.length, EXPECTED_COUNT, "artwork catalog size");
for (const artwork of artworks) {
  for (const key of ["title", "date", "image", "width", "height", "alt"]) {
    assert.ok(artwork[key], artwork.title + " missing " + key);
  }
  assert.match(String(artwork.date), /^\d{4}-\d{2}-\d{2}$/, artwork.title + " date");
}
assert.ok(unique(artworks.map((artwork) => artwork.title)), "titles must be unique");
assert.ok(unique(artworks.map((artwork) => artwork.image)), "images must be unique");
for (let i = 1; i < artworks.length; i += 1) {
  assert.ok(artworks[i - 1].date <= artworks[i].date, "file order stays oldest-to-newest");
}
assert.equal(artworks[0].title, OLDEST);
assert.equal(artworks[artworks.length - 2].title, PREVIOUS);
assert.equal(artworks[artworks.length - 1].title, NEWEST);

const BLOSSOM_VERSION = "1.6.1";
const blossomDir = "assets/vendor/blossom-carousel/" + BLOSSOM_VERSION;
const blossomJs = fs.readFileSync(blossomDir + "/blossom-carousel-web.umd.js", "utf8");
const blossomLicense = fs.readFileSync(blossomDir + "/LICENSE", "utf8");
assert.match(blossomJs, /customElements\.define\(`blossom-carousel`/);
assert.match(blossomJs, /customElements\.define\(`blossom-prev`/);
assert.match(blossomJs, /customElements\.define\(`blossom-next`/);
assert.match(blossomLicense, /Apache License/);
assert.match(blossomLicense, /Version 2\.0/);

const template = fs.readFileSync("collection.html", "utf8");
assert.match(template, /\{%\s*for artwork in site\.data\.artworks reversed\s*%\}/);
assert.doesNotMatch(template, /\{%\s*for artwork in site\.data\.artworks\s*%\}/);
assert.match(template, /querySelectorAll\("\.collection-image"\)/);
assert.match(template, /showAt\(currentIndex \+ 1\)/);
assert.match(template, /showAt\(currentIndex - 1\)/);
assert.match(template, /showAt\(currentIndex \+ \(dx < 0 \? 1 : -1\)\)/);
assert.match(template, /\{%\s*unless forloop\.index <= 3\s*%\} loading="lazy"/);
assert.match(template, /<blossom-carousel[^>]*id="collection-cover"/);
assert.match(template, /data-blossom-slide/);
assert.match(template, /<blossom-prev\b/);
assert.match(template, /<blossom-next\b/);
assert.match(template, new RegExp("blossom-carousel/" + BLOSSOM_VERSION.replace(".", "\\.") + "/blossom-carousel-web\\.umd\\.js"));
assert.match(template, /object-fit:\s*contain/);
assert.doesNotMatch(template, /object-fit:\s*cover/);
assert.match(template, /@keyframes rotate-cover/);
assert.match(template, /@keyframes slide-cover/);
assert.match(template, /animation-timeline:\s*--slide/);
assert.match(template, /prefers-reduced-motion:\s*reduce/);
assert.doesNotMatch(template, /autoplay|setInterval/);

const builtPath = "_site/collection.html";
assert.ok(fs.existsSync(builtPath), "run bundle exec jekyll build before this test");
const html = fs.readFileSync(builtPath, "utf8");
const rendered = [];
const pattern = /<a class="collection-image" href="([^"]+)" aria-label="查看《([^》]*)》原图">\s*<img src="([^"]+)" alt="([^"]*)"([^>]*)>/g;
for (const match of html.matchAll(pattern)) {
  rendered.push({
    href: match[1],
    title: match[2],
    src: match[3],
    alt: match[4],
    attrs: match[5]
  });
}

const expected = artworks.slice().reverse();
assert.equal(rendered.length, expected.length, "rendered collection count");
assert.ok(unique(rendered.map((item) => item.title)), "rendered titles must be unique");
assert.ok(unique(rendered.map((item) => item.href)), "rendered images must be unique");
rendered.forEach((item, index) => {
  const artwork = expected[index];
  assert.equal(item.title, artwork.title, "display title at " + index);
  assert.equal(item.href, artwork.image, "display image at " + index);
  assert.equal(item.src, artwork.image, "thumbnail matches full image at " + index);
  assert.equal(item.alt, artwork.alt, "alt at " + index);
  const lazy = /\sloading="lazy"/.test(item.attrs);
  assert.equal(lazy, index >= 3, "the centered work and its two neighbors load eagerly at " + index);
});
assert.equal(rendered[0].title, NEWEST);
assert.equal(rendered[1].title, PREVIOUS);
assert.equal(rendered[rendered.length - 1].title, OLDEST);

const slideTitles = [];
const slidePattern = /<li data-blossom-slide data-title="([^"]*)">/g;
for (const match of html.matchAll(slidePattern)) slideTitles.push(match[1]);
assert.deepEqual(slideTitles, expected.map((artwork) => artwork.title));
assert.equal((html.match(/<li data-blossom-slide /g) || []).length, EXPECTED_COUNT);
assert.match(html, /assets\/vendor\/blossom-carousel\/1\.6\.1\/blossom-carousel-web\.umd\.js/);
assert.match(html, /assets\/vendor\/blossom-carousel\/1\.6\.1\/blossom-carousel-web\.css/);
assert.match(html, /<blossom-carousel id="collection-cover"/);
assert.match(html, /<blossom-prev for="collection-cover"/);
assert.match(html, /<blossom-next for="collection-cover"/);
assert.doesNotMatch(html, /autoplay|setInterval/);

console.log("collection order: " + rendered.length + " works, " + rendered[0].title + " first, " + rendered[rendered.length - 1].title + " last");
