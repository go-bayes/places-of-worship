// theme.js (r-u2): the stored choice reaches <html> before paint, auto
// follows the device, a set persists and announces, and both portals wire
// the script, the sheet and the three-button control
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function boot({ stored = null, deviceDark = false, storageThrows = false } = {}) {
  const values = new Map();
  if (stored) values.set("pow-theme", stored);
  const localStorage = storageThrows
    ? { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } }
    : { getItem: (k) => (values.has(k) ? values.get(k) : null), setItem: (k, v) => values.set(k, String(v)), removeItem: (k) => values.delete(k) };
  const attrs = {};
  const root = { setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: (k) => { delete attrs[k]; }, getAttribute: (k) => attrs[k] ?? null };
  const buttons = ["system", "light", "dark"].map((choice) => {
    const a = { "data-theme-choice": choice, "aria-pressed": "false" };
    const handlers = {};
    return { attrs: a, getAttribute: (k) => a[k] ?? null, setAttribute: (k, v) => { a[k] = v; }, addEventListener: (t, fn) => { handlers[t] = fn; }, click: () => handlers.click?.() };
  });
  const listeners = {};
  const document = { documentElement: root, querySelectorAll: () => buttons, addEventListener: (t, fn) => { listeners[t] = fn; } };
  const events = [];
  const queryListeners = [];
  const query = { matches: deviceDark, addEventListener: (t, fn) => queryListeners.push(fn) };
  const window = {
    localStorage, matchMedia: () => query,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    dispatchEvent: (event) => events.push(event),
  };
  const context = vm.createContext({ window, document, localStorage });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "theme.js"), "utf8"), context, { filename: "theme.js" });
  return { attrs, buttons, events, values, window, query, queryListeners, listeners, PowTheme: window.PowTheme };
}

// 1. nothing stored: auto, and the effective theme follows the device
{
  const light = boot();
  assert.equal(light.attrs["data-theme"], undefined);
  assert.equal(light.attrs["data-theme-effective"], "light");
  assert.equal(light.PowTheme.get(), "system");
  const dark = boot({ deviceDark: true });
  assert.equal(dark.attrs["data-theme-effective"], "dark");
  assert.equal(dark.PowTheme.effective(), "dark");
}

// 2. a stored choice paints before anything else runs
{
  const t = boot({ stored: "dark" });
  assert.equal(t.attrs["data-theme"], "dark");
  assert.equal(t.attrs["data-theme-effective"], "dark");
}

// 3. set persists, applies, announces, and syncs the buttons; system clears
{
  const t = boot();
  t.listeners.DOMContentLoaded();
  assert.equal(t.buttons[0].attrs["aria-pressed"], "true");
  t.buttons[2].click();
  assert.equal(t.values.get("pow-theme"), "dark");
  assert.equal(t.attrs["data-theme"], "dark");
  assert.equal(t.attrs["data-theme-effective"], "dark");
  assert.equal(t.events.at(-1).type, "pow-theme-change");
  // the detail comes from the vm realm, so compare its fields
  assert.equal(t.events.at(-1).detail.choice, "dark");
  assert.equal(t.events.at(-1).detail.effective, "dark");
  assert.equal(t.buttons[2].attrs["aria-pressed"], "true");
  assert.equal(t.buttons[0].attrs["aria-pressed"], "false");
  t.PowTheme.set("system");
  assert.equal(t.values.has("pow-theme"), false);
  assert.equal(t.attrs["data-theme"], undefined);
  assert.equal(t.PowTheme.set("nonsense"), "system");
}

// 4. the device preference changes while auto is chosen: followed; while a choice is stored: ignored
{
  const t = boot();
  t.query.matches = true;
  t.queryListeners.forEach((fn) => fn());
  assert.equal(t.attrs["data-theme-effective"], "dark");
  t.PowTheme.set("light");
  t.query.matches = false;
  t.queryListeners.forEach((fn) => fn());
  assert.equal(t.attrs["data-theme-effective"], "light");
  t.query.matches = true;
  t.queryListeners.forEach((fn) => fn());
  assert.equal(t.attrs["data-theme-effective"], "light");
}

// 5. blocked storage: the page still paints and a choice lives for the page:
//    get and effective report it, a device change does not overwrite it,
//    and the buttons show it (greptile p1 on #130)
{
  const t = boot({ storageThrows: true });
  assert.equal(t.attrs["data-theme-effective"], "light");
  assert.equal(t.PowTheme.set("dark"), "dark");
  assert.equal(t.attrs["data-theme"], "dark");
  assert.equal(t.PowTheme.get(), "dark");
  assert.equal(t.PowTheme.effective(), "dark");
  t.query.matches = false;
  t.queryListeners.forEach((fn) => fn());
  assert.equal(t.attrs["data-theme"], "dark");
  assert.equal(t.attrs["data-theme-effective"], "dark");
  t.listeners.DOMContentLoaded();
  assert.equal(t.buttons[2].attrs["aria-pressed"], "true");
  assert.equal(t.buttons[0].attrs["aria-pressed"], "false");
  t.PowTheme.set("system");
  assert.equal(t.PowTheme.get(), "system");
  assert.equal(t.attrs["data-theme"], undefined);
}

// 6. both portals: script before the sheets, the sheet linked, the control present,
//    no token block and no rgba literal left in the page
{
  const sheet = fs.readFileSync(path.join(__dirname, "theme.css"), "utf8");
  assert.match(sheet, /:root\[data-theme="dark"\]/);
  assert.match(sheet, /@media \(prefers-color-scheme: dark\)/);
  assert.match(sheet, /--marker-halo: #ffffff/);
  for (const page of ["verification.html", "review.html"]) {
    const html = fs.readFileSync(path.join(__dirname, "..", "nz", page), "utf8");
    const script = html.indexOf('src="../_shared/theme.js');
    const sheetAt = html.indexOf('href="../_shared/theme.css');
    const firstStyle = html.indexOf("<style>");
    assert.ok(script > 0 && script < sheetAt && sheetAt < firstStyle, `${page}: theme.js, then theme.css, then the page style`);
    assert.equal((html.match(/data-theme-choice="(system|light|dark)"/g) || []).length, 3, `${page}: three choices`);
    assert.equal(/^\s*--bg:/m.test(html), false, `${page}: no token block in the page`);
    assert.equal(/rgba\(/.test(html), false, `${page}: no rgba literal`);
    assert.equal(/box-shadow:[^;]*var\(--panel\)[^;]*var\(--shade-ink/.test(html), false, `${page}: marker halos use --marker-halo`);
  }
  const ra = fs.readFileSync(path.join(__dirname, "..", "nz", "js", "verification-map.js"), "utf8");
  const review = fs.readFileSync(path.join(__dirname, "..", "nz", "js", "review-map.js"), "utf8");
  for (const source of [ra, review]) {
    assert.match(source, /streets-v2-dark/);
    assert.match(source, /streets-tiles-filtered/);
    assert.match(source, /pow-theme-change/);
  }
}

console.log("theme: 6 checks passed");
