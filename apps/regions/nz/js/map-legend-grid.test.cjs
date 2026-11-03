// the amber ruling and the map data grid (jb 2026-11-03, ui item 8): the
// uncertain fill and the disputed ring leave the caution amber for their own
// marker tokens, the open-case amber stays, the text pills keep the amber
// triad, and the map data legend is a fill by ring grid drawn with the
// map's own marker classes
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = (...parts) => fs.readFileSync(path.join(__dirname, ...parts), "utf8");
const theme = read("..", "..", "_shared", "theme.css");
const page = read("..", "verification.html");
const review = read("..", "review.html");
const source = read("verification-map.js");

const token = (name) => {
    const match = theme.match(new RegExp(`--${name}: (#[0-9a-f]{6});`));
    assert.ok(match, `theme.css defines --${name}`);
    return match[1];
};

// 1. two marker tokens beside the caution tokens, apart from every amber
{
    assert.equal(token("marker-uncertain"), "#6366f1");
    assert.equal(token("marker-disputed"), "#c8218e");
    const ambers = [token("caution"), token("caution-strong"), token("marker-unvalidated")];
    for (const name of ["marker-uncertain", "marker-disputed"]) {
        assert.equal(ambers.includes(token(name)), false, `--${name} is not an amber`);
    }
    assert.notEqual(token("marker-uncertain"), token("marker-disputed"));
    assert.equal(token("marker-unvalidated"), "#f59e0b", "the open-case amber is unchanged (r-d1')");
    assert.ok(theme.indexOf("--marker-uncertain") > theme.indexOf("--caution-strong"), "the tokens sit beside the caution tokens");
}

// 2. every disputed ring on both portals wears the red-violet, none the
//    caution amber; the uncertain fill wears the indigo
{
    for (const [name, html] of [["verification.html", page], ["review.html", review]]) {
        const disputed = [...html.matchAll(/vm-disputed(?:-swatch)? \{\s*([^}]*)\}/g)].map(match => match[1]);
        assert.ok(disputed.length >= 3, `${name}: the disputed ring, its imagery halo and its swatch`);
        for (const rule of disputed) {
            assert.match(rule, /var\(--marker-disputed\)/, `${name}: ${rule}`);
            assert.doesNotMatch(rule, /caution/, `${name}: no amber in a disputed ring`);
        }
    }
    assert.match(page, /\.legend-mark\.legend-fill-uncertain \{\s*background: var\(--marker-uncertain\);/);
    assert.match(source, /if \(status === "uncertain"\) return "var\(--marker-uncertain\)";/);
    assert.doesNotMatch(source, /return "var\(--caution-strong\)"/);
}

// 3. the text pills keep the amber caution triad
{
    assert.match(page, /\.status-uncertain \{\s*background: var\(--caution-soft\);\s*color: var\(--caution\);/);
    assert.match(page, /\.skip-badge \{[^}]*var\(--caution-strong\)/);
}

// 4. the corrected comment: the validated-absent ring is --ink, near-white
{
    assert.doesNotMatch(page, /near-black/);
    assert.match(page, /\.verification-marker\.vm-validated-absent \{\s*box-shadow: 0 0 0 2px var\(--marker-halo\), 0 0 0 5px var\(--ink\)/);
}

// the portal class in a stub page
const store = new Map();
const localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
};
const document = {
    body: { classList: { add() {}, remove() {}, toggle() {}, contains: () => false } },
    getElementById: () => null,
    createElement: () => ({ classList: { add() {}, remove() {} }, addEventListener() {} }),
    querySelector: () => null,
    querySelectorAll: () => [],
};
const window = {
    __POW_TEST_NO_BOOTSTRAP__: true,
    location: { search: "", pathname: "/apps/regions/nz/verification.html" },
    localStorage,
    sessionStorage: localStorage,
    setTimeout,
    clearTimeout,
    matchMedia: () => ({ matches: false }),
    isSecureContext: true,
};
const context = vm.createContext({
    window, document, localStorage, sessionStorage: localStorage, navigator: {},
    URLSearchParams, Map, Set, Date, Number, String, Boolean, Object, Array, Math, JSON, RegExp, Intl, console, setTimeout, clearTimeout, Promise, Error,
    L: { divIcon: (options) => options },
});
for (const file of ["occupancy-contract.js", "function-chain-contract.js", "task-presentation.js", "verification-map.js"]) {
    vm.runInContext(read(file), context, { filename: file });
}
const app = Object.create(window.NzVerificationMap.prototype);

// 5. a marker draws the uncertain fill in indigo inside the red-violet ring
{
    const icon = app.createIcon("medium", "uncertain", "disputed");
    assert.match(icon.html, /class="verification-marker vm-disputed"/);
    assert.match(icon.html, /background:var\(--marker-uncertain\);/);
    const open = app.createIcon("medium", "uncertain", "unvalidated");
    assert.match(open.html, /vm-unvalidated/);
    assert.match(open.html, /var\(--marker-uncertain\)/);
}

// 6. the legend grid: four fill rows by four ring columns, each cell a
//    marker the map draws, then the single marks
{
    const html = app.mapDataLegendHtml("tiles");
    const columns = [...html.matchAll(/<th scope="col">([^<]+)<\/th>/g)].map(match => match[1]);
    assert.deepEqual(columns, ["open case", "validated", "validated absent", "disputed"]);
    const rows = [...html.matchAll(/<th scope="row">([^<]+)<\/th>/g)].map(match => match[1]);
    assert.deepEqual(rows, ["present", "absent", "uncertain", "not assessed"]);
    const cells = [...html.matchAll(/<span class="verification-marker legend-mark ([^"]+)" role="img" aria-label="([^"]+)">/g)];
    assert.equal(cells.length, 16);
    assert.deepEqual(cells[10].slice(1), ["legend-fill-uncertain vm-validated-absent", "uncertain, validated absent"]);
    assert.deepEqual(cells[15].slice(1), ["vm-unknown vm-disputed", "not assessed, disputed"]);
    assert.match(html, /<caption>Fill: status in the target year · Ring: validation<\/caption>/);
    const singles = html.slice(html.indexOf("legend-singles"));
    assert.ok(singles.indexOf("in review") < singles.indexOf("your nomination"));
    assert.ok(singles.indexOf("your nomination") < singles.indexOf("place on today's map"));
    assert.doesNotMatch(html, /swatch[^"]*uncertain|fill-uncertain-swatch|caution/);
    // a country without unreviewed places has no dot to explain
    assert.doesNotMatch(app.mapDataLegendHtml("none"), /context-dot-swatch/);
}

// 7. the points toggle follows the legend, and the grid stays in the panel
//    on a phone, where the panel opens folded
{
    const control = source.slice(source.indexOf("addPointsLegendControl() {"));
    assert.ok(control.indexOf("this.mapDataLegendHtml(source)") < control.indexOf('id="portalPointsToggle"'));
    assert.doesNotMatch(page, /\.map-legend \{\s*display: none;/);
}

console.log("map-legend-grid: tokens, rings, fills and the legend grid checked");
