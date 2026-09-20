// the review portal's drag bars (jb 2026-09-21): the queue width and the
// map height clamp to their floors and ceilings, a pointer over the bar
// maps to a width or a height, a chosen size is remembered on the device
// and a reset forgets it, keys step and home resets, and leaflet is asked
// to re-measure after every change. hand-rolled dom, no jsdom.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const values = new Map();
const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
};
function bar() {
    return {
        attrs: {}, listeners: {}, classes: new Set(),
        setAttribute(k, v) { this.attrs[k] = v; },
        addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
        fire(type, event = {}) { for (const fn of this.listeners[type] || []) fn({ preventDefault() {}, ...event }); },
        classList: { add: (n) => {}, remove: (n) => {} },
        setPointerCapture() {}, releasePointerCapture() {},
    };
}
function box(rect) {
    const styles = {};
    return {
        styles,
        style: { setProperty(n, v) { styles[n] = v; }, removeProperty(n) { delete styles[n]; } },
        getBoundingClientRect() { return rect; },
    };
}
let innerHeight = 900;
const window = { localStorage, matchMedia: () => ({ matches: false }), get innerHeight() { return innerHeight; }, addEventListener() {} };
window.window = window;
const document = { querySelector: () => null, getElementById: () => null };
const context = vm.createContext({ window, document, Number, String, Boolean, Math, console });
vm.runInContext(fs.readFileSync(path.join(__dirname, "review-panes.js"), "utf8"), context, { filename: "review-panes.js" });
const panes = window.PowReviewPanes;
assert.ok(panes, "module exposed");

function build() {
    const layout = box({ left: 0, top: 0, width: 1440, height: 900 });
    const detail = box({ left: 404, top: 95, width: 1036, height: 800 });
    const mapEl = box({ left: 404, top: 95, width: 1036, height: 440 });
    const sidebarBar = bar();
    const mapBar = bar();
    let resized = 0;
    const api = panes.setup({ layout, detail, mapEl, sidebarBar, mapBar, onResize: () => { resized += 1; } });
    return { layout, detail, mapEl, sidebarBar, mapBar, api, resized: () => resized };
}

// 1. queue width: clamped between 320 and six tenths of the layout, remembered when chosen
{
    values.clear();
    const { layout, sidebarBar, api, resized } = build();
    assert.equal(sidebarBar.attrs["aria-valuenow"], "390", "the default width is described before any drag");
    assert.equal(sidebarBar.attrs["aria-valuemax"], "864");
    assert.equal(api.sidebarFromPointer(500), 500);
    assert.equal(api.sidebarFromPointer(100), 320, "never under the floor");
    assert.equal(api.sidebarFromPointer(1400), 864, "never past six tenths");
    api.setSidebarWidth(500);
    assert.equal(layout.styles["--sidebar-w"], "500px");
    assert.equal(values.get("pow-review-sidebar-w"), undefined, "a live drag is not remembered yet");
    api.setSidebarWidth(520, { chosen: true });
    assert.equal(values.get("pow-review-sidebar-w"), "520", "the release is remembered");
    assert.equal(sidebarBar.attrs["aria-valuenow"], "520");
    assert.ok(resized() >= 2, "leaflet re-measures after each change");
    api.setSidebarWidth(null, { chosen: true });
    assert.equal(layout.styles["--sidebar-w"], undefined, "a reset returns to the stylesheet's default");
    assert.equal(values.get("pow-review-sidebar-w"), undefined, "and forgets the choice");
    assert.equal(sidebarBar.attrs["aria-valuenow"], "390");
}

// 2. map height: clamped between 200 and nine tenths of the window, the pointer's distance from the map's top
{
    values.clear();
    const { detail, mapBar, api } = build();
    assert.equal(mapBar.attrs["aria-valuenow"], "440", "the measured height is described before any drag");
    assert.equal(mapBar.attrs["aria-valuemax"], "810");
    assert.equal(api.mapFromPointer(95 + 600), 600);
    assert.equal(api.mapFromPointer(95 + 50), 200, "never under the floor");
    assert.equal(api.mapFromPointer(95 + 2000), 810, "never past nine tenths of the window");
    api.setMapHeight(600, { chosen: true });
    assert.equal(detail.styles["--map-h"], "600px");
    assert.equal(values.get("pow-review-map-h"), "600");
    api.setMapHeight(null, { chosen: true });
    assert.equal(detail.styles["--map-h"], undefined, "a reset lets the stylesheet's default (440, or 300 on a phone) stand");
    assert.equal(values.get("pow-review-map-h"), undefined);
}

// 3. what the device remembers is applied at setup
{
    values.clear();
    values.set("pow-review-sidebar-w", "600");
    values.set("pow-review-map-h", "700");
    const { layout, detail } = build();
    assert.equal(layout.styles["--sidebar-w"], "600px");
    assert.equal(detail.styles["--map-h"], "700px");
    values.set("pow-review-sidebar-w", "5000");
    const wide = build();
    assert.equal(wide.layout.styles["--sidebar-w"], "864px", "a remembered width past the ceiling is clamped");
}

// 4. pointer drags: a few pixels are a click, more is a drag; the release is the chosen size
{
    values.clear();
    const { layout, detail, sidebarBar, mapBar } = build();
    sidebarBar.fire("pointerdown", { button: 0, clientX: 397, clientY: 400, pointerId: 1 });
    sidebarBar.fire("pointermove", { clientX: 399, clientY: 400, pointerId: 1 });
    assert.equal(layout.styles["--sidebar-w"], undefined, "two pixels is not a drag");
    sidebarBar.fire("pointermove", { clientX: 650, clientY: 400, pointerId: 1 });
    assert.equal(layout.styles["--sidebar-w"], "650px");
    sidebarBar.fire("pointerup", { clientX: 660, clientY: 400, pointerId: 1 });
    assert.equal(values.get("pow-review-sidebar-w"), "660");
    mapBar.fire("pointerdown", { button: 0, clientX: 800, clientY: 549, pointerId: 2 });
    mapBar.fire("pointermove", { clientX: 800, clientY: 95 + 650, pointerId: 2 });
    assert.equal(detail.styles["--map-h"], "650px");
    mapBar.fire("pointerup", { clientX: 800, clientY: 95 + 640, pointerId: 2 });
    assert.equal(values.get("pow-review-map-h"), "640");
    // a right button press is not a drag
    sidebarBar.fire("pointerdown", { button: 2, clientX: 660, clientY: 400, pointerId: 3 });
    sidebarBar.fire("pointermove", { clientX: 900, clientY: 400, pointerId: 3 });
    assert.equal(layout.styles["--sidebar-w"], "660px");
    // a double click resets both
    sidebarBar.fire("dblclick");
    mapBar.fire("dblclick");
    assert.equal(layout.styles["--sidebar-w"], undefined);
    assert.equal(detail.styles["--map-h"], undefined);
}

// 5. keys: arrows step by 40, home resets
{
    values.clear();
    const { layout, detail, sidebarBar, mapBar } = build();
    sidebarBar.fire("keydown", { key: "ArrowRight" });
    assert.equal(layout.styles["--sidebar-w"], "430px");
    sidebarBar.fire("keydown", { key: "ArrowLeft" });
    sidebarBar.fire("keydown", { key: "ArrowLeft" });
    sidebarBar.fire("keydown", { key: "ArrowLeft" });
    assert.equal(layout.styles["--sidebar-w"], "320px", "stepping stops at the floor");
    sidebarBar.fire("keydown", { key: "Home" });
    assert.equal(layout.styles["--sidebar-w"], undefined);
    mapBar.fire("keydown", { key: "ArrowDown" });
    assert.equal(detail.styles["--map-h"], "480px", "steps from the measured height");
    mapBar.fire("keydown", { key: "ArrowUp" });
    assert.equal(detail.styles["--map-h"], "440px");
    mapBar.fire("keydown", { key: "Home" });
    assert.equal(detail.styles["--map-h"], undefined);
}

console.log("review-panes: ok");
