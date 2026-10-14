// Leaflet writes a string tooltip as html, and the marker name is contributor
// entered through a manual candidate task. this test lifts the tooltip text
// builder and the link builder from verification-map.js and checks that a
// markup payload is escaped and that only http and https links render
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "verification-map.js"), "utf8");
function liftFunction(name) {
    const start = source.indexOf(`function ${name}(`);
    assert.ok(start > 0, `${name} exists`);
    return source.slice(start, source.indexOf("\n}\n", start) + 2);
}
function liftMethod(name) {
    const start = source.indexOf(`\n    ${name}(`);
    assert.ok(start > 0, `${name} exists`);
    const end = source.indexOf("\n    }\n", start) + 7;
    return source.slice(start, end);
}

const XSS = "<img src=x onerror=alert(1)>";
const context = vm.createContext({ URL, Date, Number });
vm.runInContext(
    [liftFunction("escapeHtml"), liftFunction("safeHttpUrl"), liftFunction("relativeTimeText"),
        `class Probe {${liftMethod("markerTooltipText")}${liftMethod("linkHtml")}}`,
        "this.Probe = Probe;"].join("\n"),
    context
);
const probe = new context.Probe();
probe.backendTasksById = new Map([["t1", { status: `in_review<b>`, last_event_at: Date.now() - 120000 }]]);

// tooltip text
const tip = probe.markerTooltipText({ task_id: "t1", name: XSS });
assert.ok(!/<img/i.test(tip) && !/<b>/.test(tip), "no raw tag in the tooltip");
assert.ok(tip.includes("&lt;img src=x onerror=alert(1)&gt;"), "the name appears escaped");
assert.ok(tip.includes(" · ") && tip.includes("last activity 2 minutes ago"), "the layout is kept");
probe.backendTasksById = new Map();
assert.equal(probe.markerTooltipText({ task_id: "t2", name: "St Mary's" }), "St Mary&#039;s · not started");
assert.equal(probe.markerTooltipText({ task_id: "t2" }), "Unnamed site · not started");

// links
const bad = probe.linkHtml("OSM object", "javascript:alert(1)", "source-link-primary");
assert.ok(!/<a\b/i.test(bad) && !/javascript:/i.test(bad), "javascript: renders no link");
assert.ok(bad.includes("OSM object"), "the label remains as text");
assert.ok(!/<a\b/i.test(probe.linkHtml(XSS, "data:text/html,x")), "data: renders no link");
const labelled = probe.linkHtml(XSS, "javascript:alert(1)");
assert.ok(!/<img/i.test(labelled), "the label is escaped when the link is dropped");
const good = probe.linkHtml("OSM object", "https://www.openstreetmap.org/node/1", "source-link-primary");
assert.ok(good.startsWith('<a class="source-link-primary" href="https://www.openstreetmap.org/node/1"'), "an https url renders as before");
assert.equal(probe.linkHtml("x", ""), "<span></span>", "an empty url keeps the empty span");
const quoted = probe.linkHtml("x", 'https://example.org/"onmouseover="alert(1)');
assert.ok(!/"onmouseover="/.test(quoted), "a quote in the url cannot leave the attribute");

console.log("marker-tooltip-escape.test.cjs: ok");
