// theme.js (r-u2 restored, proposed 2026-11-20): dark is the default and
// nothing changes unless a contributor chooses; the stored choice reaches
// <html> before paint, auto follows the device, a set persists and
// announces, blocked storage holds the choice in memory, and both portals
// wire the script, the sheet and the three-button control
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "theme.js"), "utf8");

function boot({ stored = null, deviceDark = false, storageThrows = false, legacy = null, noMatchMedia = false } = {}) {
  const values = new Map();
  if (stored) values.set("pow-theme-choice", stored);
  if (legacy) values.set("pow-theme", legacy);
  const localStorage = storageThrows
    ? { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } }
    : { getItem: (k) => (values.has(k) ? values.get(k) : null), setItem: (k, v) => values.set(k, String(v)), removeItem: (k) => values.delete(k) };
  const attrs = {};
  const root = { nodeType: 1, setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: (k) => { delete attrs[k]; }, getAttribute: (k) => attrs[k] ?? null };
  // every listener is kept, as a browser keeps them, so a second binding
  // would show as a second handler
  const docListeners = [];
  // a group of three buttons; a press runs the document's capture listeners,
  // the button's own, then bubbles unless the group stops it (leaflet's
  // disableClickPropagation does, on the map data panel)
  const makeGroup = ({ stopsPropagation = false } = {}) => {
    const group = { nodeType: 1, getAttribute: () => null, parentNode: null };
    const buttons = ["dark", "light", "auto"].map((choice) => {
      const a = { "data-theme-choice": choice, "aria-pressed": "false" };
      const own = [];
      const button = {
        nodeType: 1, attrs: a, own, parentNode: group,
        getAttribute: (k) => a[k] ?? null, setAttribute: (k, v) => { a[k] = v; },
        addEventListener: (t, fn) => own.push({ t, fn }),
        click() {
          const event = { type: "click", target: button, stopped: false, stopPropagation() { this.stopped = true; } };
          docListeners.filter((l) => l.t === "click" && l.capture).forEach((l) => l.fn(event));
          own.filter((l) => l.t === "click").forEach((l) => l.fn(event));
          if (stopsPropagation) event.stopped = true;
          if (!event.stopped) docListeners.filter((l) => l.t === "click" && !l.capture).forEach((l) => l.fn(event));
        },
      };
      return button;
    });
    group.querySelector = () => buttons[0];
    group.querySelectorAll = () => buttons;
    return { group, buttons };
  };
  const header = makeGroup();
  const panel = makeGroup({ stopsPropagation: true });
  const parsed = [];
  const document = {
    documentElement: root,
    querySelectorAll: () => parsed.slice(),
    addEventListener: (t, fn, capture = false) => docListeners.push({ t, fn, capture: Boolean(capture) }),
  };
  const observers = [];
  class MutationObserver {
    constructor(callback) { this.callback = callback; this.active = false; observers.push(this); }
    observe() { this.active = true; }
    disconnect() { this.active = false; }
  }
  const events = [];
  const queryListeners = [];
  const query = { matches: deviceDark, addEventListener: (t, fn) => queryListeners.push(fn) };
  const window = {
    localStorage, MutationObserver,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    dispatchEvent: (event) => events.push(event),
  };
  if (!noMatchMedia) window.matchMedia = () => query;
  const context = vm.createContext({ window, document, localStorage });
  vm.runInContext(source, context, { filename: "theme.js" });
  // the parser adds the header: the observer hears of it at once, long
  // before DOMContentLoaded
  const parseHeader = () => {
    parsed.push(...header.buttons);
    observers.filter((o) => o.active).forEach((o) => o.callback([{ addedNodes: [header.group] }]));
  };
  const contentLoaded = () => docListeners.filter((l) => l.t === "DOMContentLoaded").forEach((l) => l.fn());
  const buildPanel = () => { parsed.push(...panel.buttons); window.PowTheme.bind(panel.group); };
  return {
    attrs, buttons: header.buttons, panelButtons: panel.buttons, parseHeader, contentLoaded, buildPanel,
    observers, docListeners, events, values, window, query, queryListeners, PowTheme: window.PowTheme,
  };
}

const pressed = (buttons) => buttons.filter((b) => b.attrs["aria-pressed"] === "true").map((b) => b.attrs["data-theme-choice"]).join();

const deviceChanges = (t, matches) => { t.query.matches = matches; t.queryListeners.forEach((fn) => fn()); };

// 1. nothing stored: dark, whatever the device prefers, so no screen changes
//    unless its owner chooses
{
  for (const deviceDark of [false, true]) {
    const t = boot({ deviceDark });
    assert.equal(t.attrs["data-theme"], "dark");
    assert.equal(t.attrs["data-theme-effective"], "dark");
    assert.equal(t.PowTheme.get(), "dark");
    assert.equal(t.PowTheme.effective(), "dark");
    assert.equal(t.PowTheme.DEFAULT, "dark");
  }
  // the retired control's key is ignored: a light choice from its one day
  // live does not reappear
  const legacy = boot({ legacy: "light" });
  assert.equal(legacy.attrs["data-theme-effective"], "dark");
  // an unknown stored value falls back to the default
  assert.equal(boot({ stored: "sepia" }).PowTheme.get(), "dark");
  assert.deepEqual([...boot().PowTheme.CHOICES], ["dark", "light", "auto"]);
}

// 2. a stored choice paints before anything else runs
{
  const light = boot({ stored: "light", deviceDark: true });
  assert.equal(light.attrs["data-theme"], "light");
  assert.equal(light.attrs["data-theme-effective"], "light");
  const auto = boot({ stored: "auto", deviceDark: false });
  assert.equal(auto.attrs["data-theme"], "auto");
  assert.equal(auto.attrs["data-theme-effective"], "light");
  assert.equal(boot({ stored: "auto", deviceDark: true }).attrs["data-theme-effective"], "dark");
  // auto with no way to ask the device keeps dark
  assert.equal(boot({ stored: "auto", noMatchMedia: true }).attrs["data-theme-effective"], "dark");
}

// 3. set persists, applies, announces, and syncs every copy of the control,
//    including the phone copy marked after the map data panel is built,
//    whose panel stops a click from bubbling
{
  const t = boot();
  t.parseHeader();
  t.contentLoaded();
  assert.equal(pressed(t.buttons), "dark");
  t.buttons[1].click();
  assert.equal(t.values.get("pow-theme-choice"), "light");
  assert.equal(t.attrs["data-theme"], "light");
  assert.equal(t.attrs["data-theme-effective"], "light");
  assert.equal(t.events.at(-1).type, "pow-theme-change");
  // the detail comes from the vm realm, so compare its fields
  assert.equal(t.events.at(-1).detail.choice, "light");
  assert.equal(t.events.at(-1).detail.effective, "light");
  assert.equal(pressed(t.buttons), "light");
  t.buildPanel();
  assert.equal(pressed(t.panelButtons), "light", "the phone copy shows the choice in hand");
  t.panelButtons[2].click();
  assert.equal(t.values.get("pow-theme-choice"), "auto", "a press in a panel that stops propagation still counts");
  assert.equal(pressed(t.buttons), "auto", "a press on the phone copy moves the header copy too");
  // an explicit dark is stored, so a later change of default leaves it alone
  t.PowTheme.set("dark");
  assert.equal(t.values.get("pow-theme-choice"), "dark");
  assert.equal(t.PowTheme.set("nonsense"), "dark");
  // binding again, and again after the page has loaded, adds no handler:
  // one press announces once
  t.PowTheme.bind();
  t.PowTheme.bind(t.buttons[0].parentNode);
  t.contentLoaded();
  const before = t.events.length;
  t.buttons[1].click();
  assert.equal(t.events.length, before + 1, "one press, one announcement");
  for (const button of t.buttons.concat(t.panelButtons)) assert.equal(button.own.length, 0, "no handler on the button itself");
  assert.equal(t.docListeners.filter((l) => l.t === "click").length, 1, "one click listener on the document");
}

// 3a. a saved light or auto choice with a later script still loading: the
//     header copy is marked as soon as it is parsed, before DOMContentLoaded
//     (so before the delayed script and first paint), and a press made then
//     takes effect; the watch on the parser ends at DOMContentLoaded
{
  for (const [stored, deviceDark, effective] of [["light", true, "light"], ["auto", false, "light"], ["auto", true, "dark"]]) {
    const t = boot({ stored, deviceDark });
    assert.equal(t.attrs["data-theme-effective"], effective, `${stored}: painted ${effective}`);
    assert.equal(pressed(t.buttons), "", "nothing parsed yet");
    t.parseHeader();
    assert.equal(pressed(t.buttons), stored, `${stored}: the parsed header shows the saved choice before the page loads`);
    t.buttons[0].click();
    assert.equal(t.values.get("pow-theme-choice"), "dark", `${stored}: an early press is not lost`);
    assert.equal(t.attrs["data-theme-effective"], "dark");
    assert.equal(t.events.length, 1);
    assert.equal(pressed(t.buttons), "dark");
    t.contentLoaded();
    assert.equal(pressed(t.buttons), "dark", "loading the page keeps the early press");
    assert.equal(t.observers.every((o) => !o.active), true, "the parser watch ends with parsing");
  }
}

// 4. the device preference changes while auto is chosen: followed and
//    announced; while dark or light is chosen: ignored
{
  const t = boot({ stored: "auto" });
  deviceChanges(t, true);
  assert.equal(t.attrs["data-theme-effective"], "dark");
  assert.equal(t.events.at(-1).detail.effective, "dark");
  deviceChanges(t, false);
  assert.equal(t.attrs["data-theme-effective"], "light");
  t.PowTheme.set("dark");
  const before = t.events.length;
  deviceChanges(t, false);
  assert.equal(t.attrs["data-theme-effective"], "dark");
  assert.equal(t.events.length, before, "no announcement for a choice the device does not drive");
}

// 5. blocked storage: the page still paints dark, and a choice lives for the
//    page: get and effective report it, a device change does not overwrite
//    it, and the buttons show it (a set must not be lost when storage
//    throws)
{
  const t = boot({ storageThrows: true });
  assert.equal(t.attrs["data-theme-effective"], "dark");
  assert.equal(t.PowTheme.set("light"), "light");
  assert.equal(t.attrs["data-theme"], "light");
  assert.equal(t.PowTheme.get(), "light");
  assert.equal(t.PowTheme.effective(), "light");
  deviceChanges(t, true);
  assert.equal(t.attrs["data-theme-effective"], "light");
  t.parseHeader();
  t.contentLoaded();
  assert.equal(pressed(t.buttons), "light");
}

// 6. the sheet: the dark set on :root by default, the light set under
//    data-theme-effective="light" with every dark token answered, the map
//    marks pinned to their dark values, and the control styled
{
  const sheet = fs.readFileSync(path.join(__dirname, "theme.css"), "utf8");
  assert.match(sheet, /:root \{\n\s+color-scheme: dark;/);
  assert.equal(/prefers-color-scheme/.test(sheet), false, "auto is decided in theme.js, not by a media query");
  const block = (selector) => {
    const at = sheet.indexOf(`${selector} {`);
    assert.ok(at >= 0, `the sheet has ${selector}`);
    return sheet.slice(at, sheet.indexOf("}", at));
  };
  const tokens = (text) => Object.fromEntries([...text.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const dark = tokens(block(":root"));
  const light = tokens(block(':root[data-theme-effective="light"]'));
  const colourTokens = Object.keys(dark).filter((name) => /^#|^rgba\(/.test(dark[name]));
  for (const name of colourTokens) assert.ok(light[name], `the light set answers ${name}`);
  for (const name of Object.keys(light)) assert.ok(dark[name], `${name} is a dark token too`);
  assert.equal(dark["--bg"], "#0f1620");
  assert.equal(light["--bg"], "#f4f6f8");
  assert.match(block(':root[data-theme-effective="light"]'), /color-scheme: light;/);
  // the 2026-11-03 marker colours and the open-case amber are the same in both sets
  for (const name of ["--marker-uncertain", "--marker-disputed", "--marker-unvalidated", "--marker-halo", "--marker-edge"]) {
    assert.equal(light[name], dark[name], `${name} is the same in both themes`);
  }
  // the uncertain tag stays indigo in light (7.0:1 on its soft)
  assert.equal(light["--uncertain"], "#4338ca");
  assert.equal(light["--uncertain-soft"], "#eef0ff");
  // the map marks keep the dark values of the tokens they draw in,
  // including the dropped pin and the selected case's outline (--danger)
  const pinnedSelector = ':root[data-theme-effective="light"] .verification-marker,\n:root[data-theme-effective="light"] .legend-dot,\n:root[data-theme-effective="light"] .pin-drop-marker';
  const pinned = tokens(block(pinnedSelector));
  for (const [name, value] of Object.entries(pinned)) assert.equal(value, dark[name], `a mark keeps the dark ${name}`);
  for (const name of ["--present", "--absent", "--action", "--ink", "--entry", "--danger", "--shade-deep", "--shade-ink"]) {
    assert.ok(pinned[name], `a mark pins ${name}`);
  }
  assert.equal(pinned["--danger"], "#f28b82");
  assert.match(block(':root[data-theme-effective="light"] .verification-marker'), /--panel: var\(--marker-edge\);/);
  // the outer edge is a solid 1 px outline in --marker-edge, on the dom
  // markers and the pin over the light streets map and on the legend
  // swatches; no blurred filter, and the overlay pane is left alone
  assert.equal(/drop-shadow/.test(sheet), false, "no blurred drop-shadow edge");
  assert.equal(/leaflet-overlay-pane/.test(sheet), false, "the other overlays are untouched");
  const edge = block(':root[data-theme-effective="light"] .leaflet-container:not(.basemap-imagery) .leaflet-marker-pane .verification-marker:not(.vm-selected),\n:root[data-theme-effective="light"] .leaflet-container:not(.basemap-imagery) .leaflet-marker-pane .pin-drop-marker,\n:root[data-theme-effective="light"] .legend-mark,\n:root[data-theme-effective="light"] .legend-dot');
  assert.match(edge, /outline: 1px solid var\(--marker-edge\);/);
  assert.match(edge, /outline-offset: var\(--mark-reach, 0px\);/);
  assert.match(sheet, /\.vm-selected::after \{[^}]*inset: -8px;[^}]*border: 1px solid var\(--marker-edge\);/);
  // the pressed button keeps a visible focus ring
  assert.match(block('.theme-control button[aria-pressed="true"]:focus-visible'), /outline-color: var\(--panel\);/);
  assert.match(sheet, /\.theme-control button\[aria-pressed="true"\]/);
  assert.match(sheet, /:root\[data-theme-effective="dark"\] \.streets-tiles-filtered/);
}

// 7. both portals: script before the sheets, the sheet linked, the header
//    control present with dark pressed, no token block and no rgba literal
//    left in the page; the phone copy lives in each map data panel and is
//    bound when built; the streets basemap still follows the marked theme
{
  for (const page of ["verification.html", "review.html"]) {
    const html = fs.readFileSync(path.join(__dirname, "..", "nz", page), "utf8");
    const script = html.indexOf('src="../_shared/theme.js');
    const sheetAt = html.indexOf('href="../_shared/theme.css');
    const firstStyle = html.indexOf("<style>");
    assert.ok(script > 0 && script < sheetAt && sheetAt < firstStyle, `${page}: theme.js, then theme.css, then the page style`);
    assert.equal((html.match(/data-theme-choice="(dark|light|auto)"/g) || []).length, 3, `${page}: three choices in the header`);
    assert.match(html, /<div class="theme-control" role="group" aria-label="Theme">\s*<button type="button" data-theme-choice="dark" aria-pressed="true">Dark<\/button>\s*<button type="button" data-theme-choice="light" aria-pressed="false">Light<\/button>\s*<button type="button" data-theme-choice="auto" aria-pressed="false">Auto<\/button>/, `${page}: Dark, Light, Auto, dark pressed`);
    assert.match(html, /@media \(max-width: 700px\)[\s\S]*\.theme-control \{ ?\n?\s*display: none;/, `${page}: the header copy hides on a phone`);
    assert.equal(/^\s*--bg:/m.test(html), false, `${page}: no token block in the page`);
    assert.equal(/rgba\(/.test(html), false, `${page}: no rgba literal`);
  }
  const ra = fs.readFileSync(path.join(__dirname, "..", "nz", "js", "verification-map.js"), "utf8");
  const review = fs.readFileSync(path.join(__dirname, "..", "nz", "js", "review-map.js"), "utf8");
  for (const code of [ra, review]) {
    assert.match(code, /streets-v2-dark/);
    assert.match(code, /data-theme-effective/);
    assert.match(code, /pow-theme-change/);
    assert.match(code, /class="map-data-theme"/);
    assert.match(code, /data-theme-choice="dark"[\s\S]*data-theme-choice="light"[\s\S]*data-theme-choice="auto"/);
    assert.match(code, /window\.PowTheme\?\.bind\?\.\(/);
  }
}

console.log("theme: 8 checks passed");
