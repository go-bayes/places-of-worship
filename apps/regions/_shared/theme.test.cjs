// theme.js: dark is the one theme (jb 2026-09-21). html is marked dark before
// paint, the api answers dark, the sheet carries one set, and neither portal
// offers a choice
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// 1. the root is marked dark before anything else runs, whatever the device
//    prefers, and the api answers dark
{
  const attrs = {};
  const root = { setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: (k) => { delete attrs[k]; }, getAttribute: (k) => attrs[k] ?? null };
  const document = { documentElement: root, addEventListener() {} };
  const window = { matchMedia: () => ({ matches: false, addEventListener() {} }), localStorage: { getItem: () => "light", setItem() {}, removeItem() {} } };
  const context = vm.createContext({ window, document });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "theme.js"), "utf8"), context, { filename: "theme.js" });
  assert.equal(attrs["data-theme"], "dark");
  assert.equal(attrs["data-theme-effective"], "dark");
  assert.equal(window.PowTheme.get(), "dark");
  assert.equal(window.PowTheme.effective(), "dark");
  assert.equal(window.PowTheme.set("light"), "dark");
  assert.equal(attrs["data-theme"], "dark");
  window.PowTheme.bind(document);
}

// 2. the sheet: one dark set on :root, no light set, no device query, no control
{
  const sheet = fs.readFileSync(path.join(__dirname, "theme.css"), "utf8");
  assert.match(sheet, /:root \{\n\s+color-scheme: dark;/);
  assert.match(sheet, /--bg: #0f1620/);
  assert.match(sheet, /--marker-halo: #ffffff/);
  assert.equal(/\[data-theme="/.test(sheet), false, "no theme choice block");
  assert.equal(/prefers-color-scheme/.test(sheet), false, "no device query");
  assert.equal(/\.theme-control/.test(sheet), false, "no control styles");
  assert.equal(/#f4f6f8/.test(sheet), false, "no light background");
}

// 3. both portals: script before the sheet before the page style, no choice
//    buttons, no token block and no rgba literal in the page; the streets
//    basemap still follows the marked theme
{
  for (const page of ["verification.html", "review.html"]) {
    const html = fs.readFileSync(path.join(__dirname, "..", "nz", page), "utf8");
    const script = html.indexOf('src="../_shared/theme.js');
    const sheetAt = html.indexOf('href="../_shared/theme.css');
    const firstStyle = html.indexOf("<style>");
    assert.ok(script > 0 && script < sheetAt && sheetAt < firstStyle, `${page}: theme.js, then theme.css, then the page style`);
    assert.equal(/data-theme-choice|theme-control/.test(html), false, `${page}: no theme choice`);
    assert.equal(/^\s*--bg:/m.test(html), false, `${page}: no token block in the page`);
    assert.equal(/rgba\(/.test(html), false, `${page}: no rgba literal`);
  }
  const ra = fs.readFileSync(path.join(__dirname, "..", "nz", "js", "verification-map.js"), "utf8");
  const review = fs.readFileSync(path.join(__dirname, "..", "nz", "js", "review-map.js"), "utf8");
  for (const source of [ra, review]) {
    assert.match(source, /streets-v2-dark/);
    assert.match(source, /data-theme-effective/);
  }
}

console.log("theme: 3 checks passed");
