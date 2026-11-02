// the review map's Map data panel (2026-11-03, ui item 6 step two): the ra
// portal's idiom on the review page. it opens folded to one bar, the fold
// is remembered on the device, the body sits above the bar so it opens
// upward, the points switch is an outline button on the bar whose word
// and pressed state follow the mode, the count pill says how much of the
// queue is on the map, and the grip moves the panel and remembers the spot.
// hand-rolled dom, no jsdom.
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

function node(tag) {
    const classes = new Set();
    return {
        tag,
        children: [],
        attrs: {},
        listeners: {},
        style: {},
        hidden: false,
        id: "",
        type: "",
        innerHTML: "",
        _text: "",
        rect: { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 },
        get className() { return [...classes].join(" "); },
        set className(value) { classes.clear(); String(value).split(/\s+/).filter(Boolean).forEach((c) => classes.add(c)); },
        classList: {
            add: (c) => classes.add(c),
            remove: (c) => classes.delete(c),
            contains: (c) => classes.has(c),
            toggle: (c, on) => { const next = on === undefined ? !classes.has(c) : Boolean(on); if (next) classes.add(c); else classes.delete(c); return next; },
        },
        get textContent() { return this._text + this.children.map((child) => child.textContent ?? "").join(""); },
        set textContent(value) { this._text = String(value); this.children = []; },
        setAttribute(k, v) { this.attrs[k] = String(v); },
        getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        append(...items) { this.children.push(...items); },
        addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
        fire(type, event = {}) { for (const fn of this.listeners[type] || []) fn({ preventDefault() {}, button: 0, pointerId: 1, ...event }); },
        getBoundingClientRect() { return this.rect; },
        setPointerCapture() {},
        releasePointerCapture() {},
    };
}

const document = {
    createElement: (tag) => node(tag),
    createTextNode: (text) => ({ textContent: text }),
};
const window = { localStorage };
window.window = window;
const timers = [];
const context = vm.createContext({ window, document, JSON, Number, String, Boolean, Math, Array, Object, console, setTimeout: (fn) => timers.push(fn) });
vm.runInContext(fs.readFileSync(path.join(__dirname, "review-map-data.js"), "utf8"), context, { filename: "review-map-data.js" });
const panel = window.PowReviewMapData;
assert.ok(panel, "module exposed");

const mapListeners = {};
const mapContainer = { getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 440, width: 800, height: 440 }) };
const map = { getContainer: () => mapContainer, on(type, fn) { (mapListeners[type] ||= []).push(fn); } };
const L = {
    control(options) {
        return { options, addTo(target) { this.el = this.onAdd(target); return this; } };
    },
    DomEvent: { disableClickPropagation() {}, disableScrollPropagation() {} },
};

function build(options = {}) {
    let notified = [];
    const api = panel.create(L, map, {
        legendHtml: '<div class="map-legend">legend rows</div>',
        pointsAvailable: true,
        onPointsChange: (on) => notified.push(on),
        ...options,
    });
    return { api, parts: api.parts, notified: () => notified };
}

// 1. the panel's shape: bottom left, the body before the bar so it opens upward
{
    values.clear();
    const { api, parts } = build();
    assert.equal(api.control.options.position, "bottomleft");
    assert.equal(parts.root.className, "points-legend-control map-data-panel folded");
    assert.equal(parts.root.children[0], parts.body, "the body comes first");
    assert.equal(parts.root.children[1], parts.bar, "and the bar under it, so the body opens upward");
    assert.deepEqual(parts.bar.children.map((child) => child.className), ["legend-grip", "legend-fold", "legend-count", "legend-points"]);
    assert.equal(parts.grip.getAttribute("aria-label"), "Move this panel: drag it");
    assert.equal(parts.fold.getAttribute("aria-controls"), parts.body.id);
    assert.equal(parts.body.innerHTML, '<div class="map-legend">legend rows</div>');
    assert.equal(parts.points.className, "legend-points", "the switch is the outline button, not a select");
}

// 2. folded on arrival; the fold opens and closes and is remembered
{
    values.clear();
    const { api, parts } = build();
    assert.equal(api.isFolded(), true, "the review map's short panel opens folded");
    assert.equal(parts.body.hidden, true);
    assert.equal(parts.fold.getAttribute("aria-expanded"), "false");
    assert.equal(parts.caret.textContent, "▴", "the caret points up: it opens upward");
    assert.equal(parts.fold.textContent, "Map data ▴");
    parts.fold.fire("click");
    assert.equal(api.isFolded(), false);
    assert.equal(parts.body.hidden, false);
    assert.equal(parts.fold.getAttribute("aria-expanded"), "true");
    assert.equal(parts.caret.textContent, "▾");
    assert.equal(parts.root.classList.contains("folded"), false);
    assert.equal(values.get(panel.FOLD_KEY), "0", "the open panel is remembered");
    const again = build();
    assert.equal(again.api.isFolded(), false, "a reload keeps it open");
    assert.equal(again.parts.body.hidden, false);
    again.parts.fold.fire("click");
    assert.equal(values.get(panel.FOLD_KEY), "1");
    assert.equal(build().api.isFolded(), true, "and keeps it folded once folded");
}

// 3. the points switch: off on arrival, its word says what a press does
{
    values.clear();
    const { api, parts, notified } = build();
    assert.equal(parts.points.textContent, "Show unreviewed");
    assert.equal(parts.points.getAttribute("aria-pressed"), "false");
    parts.points.fire("click");
    assert.equal(api.pointsOn(), true);
    assert.equal(parts.points.textContent, "Hide unreviewed");
    assert.equal(parts.points.getAttribute("aria-pressed"), "true");
    assert.deepEqual(notified(), [true], "the map is told to draw the places");
    parts.points.fire("click");
    assert.equal(parts.points.textContent, "Show unreviewed");
    assert.deepEqual(notified(), [true, false]);
    // without the unreviewed places on this page there is no switch
    const bare = build({ pointsAvailable: false });
    assert.equal(bare.parts.points, null);
    assert.deepEqual(bare.parts.bar.children.map((child) => child.className), ["legend-grip", "legend-fold", "legend-count"]);
}

// 4. the count pill: hidden before a queue loads, then the queue on the map
{
    values.clear();
    const { api, parts } = build();
    assert.equal(parts.count.hidden, true, "nothing to count before a queue loads");
    api.setCount(12, 12);
    assert.equal(parts.count.hidden, false);
    assert.equal(parts.count.textContent, "12 in this queue");
    api.setCount(10, 12);
    assert.equal(parts.count.textContent, "10 of 12 in this queue on the map", "rows without a location are not claimed as drawn");
    parts.points.fire("click");
    assert.equal(parts.count.textContent, "10 of 12 in this queue on the map · unreviewed shown");
    api.setCount(0, 0);
    assert.equal(parts.count.hidden, true, "an empty queue hides the pill");
    assert.equal(panel.countLabel(3, 3, false), "3 in this queue");
}

// 5. the grip moves the panel inside the map and the spot is remembered
{
    values.clear();
    const { parts } = build();
    parts.root.rect = { left: 10, top: 370, right: 310, bottom: 430, width: 300, height: 60 };
    parts.grip.fire("pointerdown", { clientX: 20, clientY: 400 });
    assert.equal(parts.root.classList.contains("dragging"), true);
    parts.grip.fire("pointermove", { clientX: 220, clientY: 300 });
    assert.equal(parts.root.style.transform, "translate(200px, -100px)");
    parts.grip.fire("pointermove", { clientX: 2000, clientY: 400 });
    assert.equal(parts.root.style.transform, "translate(490px, 0px)", "never past the map's edge");
    parts.grip.fire("pointerup", { clientX: 2000, clientY: 400 });
    assert.equal(parts.root.classList.contains("dragging"), false);
    assert.deepEqual(JSON.parse(values.get(panel.OFFSET_KEY)), { x: 490, y: 0 });
    const again = build();
    again.parts.root.rect = parts.root.rect;
    timers.splice(0).forEach((fn) => fn());
    assert.equal(again.parts.root.style.transform, "translate(490px, 0px)", "a reload puts it where it was left");
    again.parts.grip.fire("dblclick");
    assert.equal(again.parts.root.style.transform, "", "a double click on the grip sends it home");
    assert.deepEqual(JSON.parse(values.get(panel.OFFSET_KEY)), { x: 0, y: 0 });
    assert.ok(mapListeners.resize?.length, "a map resize re-clamps the panel");
}

// 5b. a saved spot above the corner survives the unmeasured first fold:
// onAdd runs before the panel is in the map, when it measures zero
{
    values.clear();
    values.set(panel.OFFSET_KEY, JSON.stringify({ x: 0, y: -120 }));
    timers.splice(0);
    const { parts } = build();
    parts.root.rect = { left: 10, top: 370, right: 310, bottom: 430, width: 300, height: 60 };
    timers.splice(0).forEach((fn) => fn());
    assert.equal(parts.root.style.transform, "translate(0px, -120px)", "the saved spot is kept, not clamped to the corner");
}

// 6. without storage the panel still folds and switches for the page
{
    window.localStorage = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
    const { api, parts } = build();
    assert.equal(api.isFolded(), true);
    parts.fold.fire("click");
    assert.equal(api.isFolded(), false);
    window.localStorage = localStorage;
}

// 7. the page: the panel's script loads before the map and its shared css
// is linked; the old select and its paragraph are gone from the map
{
    const html = fs.readFileSync(path.join(__dirname, "..", "review.html"), "utf8");
    assert.ok(html.indexOf("js/review-map-data.js") > 0);
    assert.ok(html.indexOf("js/review-map-data.js") < html.indexOf("js/review-map.js"), "the panel's script loads before the map");
    assert.match(html, /<link rel="stylesheet" href="\.\.\/_shared\/map-data-panel\.css\?v=\d+[a-z]?">/);
    const mapJs = fs.readFileSync(path.join(__dirname, "review-map.js"), "utf8");
    assert.doesNotMatch(mapJs, /reviewPointsSelect|reviewPointsNote/, "no select and no explanatory paragraph");
    assert.match(mapJs, /window\.PowReviewMapData\s*\?\s*window\.PowReviewMapData\.create\(L, map,/);
    assert.match(mapJs, /mapData\?\.setCount\(markersByTaskId\.size, rows\.length\)/, "the count follows each queue load");
    const css = fs.readFileSync(path.join(__dirname, "..", "..", "_shared", "map-data-panel.css"), "utf8");
    for (const rule of css.match(/^[^\s@/}][^{]*\{/gm) || []) {
        assert.match(rule, /\.map-data-panel/, `every rule is scoped to the panel: ${rule.trim()}`);
    }
}

console.log("review map data panel ok");
