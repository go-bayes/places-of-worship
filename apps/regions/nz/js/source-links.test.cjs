const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

// the module runs in a bare window; osm-history is absent, so inline
// history defaults off and the history entry links out
const source = fs.readFileSync(`${__dirname}/source-links.js`, "utf8");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(source, context);
const raw = context.window.PowSourceLinks;
// values cross the vm boundary, so round-trip them for strict deep equality
const plain = value => (value === null || value === undefined ? value : JSON.parse(JSON.stringify(value)));
const links = {
    ...raw,
    urls: place => plain(raw.urls(place)),
    entries: (place, options) => plain(raw.entries(place, options)),
};

function ok(name) {
    console.log(`ok: ${name}`);
}

const place = { lat: -41.28664, lng: 174.77557, osmType: "n", osmId: 123456, name: "St Paul's", locality: "Wellington", countryName: "New Zealand" };

{
    const labels = links.entries(place).map(entry => entry.label);
    assert.deepEqual(labels, ["Street View", "Google Maps", "Open OSM", "Copy coords", "OSM object", "OSM history", "OSM map", "Name search"]);
    ok("the eight links in the ra portal's order");
}

{
    const u = links.urls(place);
    assert.equal(u.street_view, "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=-41.28664%2C174.77557");
    assert.equal(u.google_maps, "https://www.google.com/maps/search/?api=1&query=-41.28664%2C174.77557");
    assert.equal(u.osm_point, "https://www.openstreetmap.org/?mlat=-41.28664&mlon=174.77557#map=18/-41.28664/174.77557");
    assert.equal(u.coords, "-41.28664,174.77557");
    assert.equal(u.osm_object, "https://www.openstreetmap.org/node/123456");
    assert.equal(u.osm_history, "https://www.openstreetmap.org/node/123456/history");
    assert.equal(u.osm_map, "https://www.openstreetmap.org/node/123456");
    assert.equal(u.name_search, "https://www.google.com/search?q=St%20Paul's%20Wellington%20New%20Zealand%20place%20of%20worship");
    ok("urls match the ra portal's helpers");
}

{
    const labels = links.entries({ lat: -41.3, lng: 174.8 }).map(entry => entry.label);
    assert.deepEqual(labels, ["Street View", "Google Maps", "Open OSM", "Copy coords"]);
    ok("a bare point carries the four point links only");
}

{
    const labels = links.entries({ osmType: "way", osmId: "9", name: "Marae" }).map(entry => entry.label);
    assert.deepEqual(labels, ["OSM object", "OSM history", "OSM map", "Name search"]);
    ok("an osm object without a point carries the object links and the search");
}

{
    assert.deepEqual(links.entries({ osmType: "bogus", osmId: 1 }), []);
    assert.deepEqual(links.entries({ lat: "x", lng: 1 }), []);
    ok("unknown types and bad coordinates render nothing");
}

{
    const labels = links.entries({ lat: -41.3, lng: 174.8 }, { approximate: true }).map(entry => entry.label);
    assert.deepEqual(labels, ["Street View", "Approximate centre in Google Maps", "Open OSM", "Copy area centre"]);
    ok("an approximate area names its centre");
}

{
    const html = links.itemsHtml(place, { className: "popup-link" });
    assert.match(html, /<a class="popup-link" href="https:\/\/www\.google\.com\/maps\/@\?api=1&amp;map_action=pano/);
    assert.match(html, /<button class="popup-link popup-copy-coords" type="button" data-copy="-41.28664,174.77557">Copy coords<\/button>/);
    // no osm-history module in this window: history is a plain link
    assert.match(html, /<a class="popup-link" href="https:\/\/www\.openstreetmap\.org\/node\/123456\/history"/);
    assert.doesNotMatch(html, /data-osm-history/);
    assert.doesNotMatch(html, /popup-osm-history-body/);
    ok("without osm-history the history entry links out");
}

{
    context.window.PowOsmHistory = { loadInto: async () => {} };
    const html = links.itemsHtml(place, { className: "popup-link" });
    assert.match(html, /<button class="popup-link popup-osm-history" type="button" data-osm-history="node\/123456"/);
    assert.match(html, /<div class="popup-osm-history-body" hidden><\/div>$/);
    const grid = links.itemsHtml(place, { className: "", primaryClassName: "source-link-primary", inlineHistory: false });
    assert.match(grid, /<a class="source-link-primary" href="https:\/\/www\.google\.com\/maps\/@/);
    assert.match(grid, /<a href="https:\/\/www\.openstreetmap\.org\/node\/123456"/);
    assert.match(grid, /<button class="popup-copy-coords" type="button"/);
    assert.doesNotMatch(grid, /data-osm-history/);
    delete context.window.PowOsmHistory;
    ok("with osm-history the popup expands in place and the grid can opt out");
}

{
    const html = links.itemsHtml({ lat: -41.3, lng: 174.8, name: `<b>"x"</b>` });
    assert.doesNotMatch(html, /<b>/);
    assert.match(html, /%3Cb%3E/);
    ok("names are escaped in html and encoded in urls");
}

{
    assert.equal(links.normaliseType("N"), "node");
    assert.equal(links.normaliseType("relation"), "relation");
    assert.equal(links.normaliseType(""), "");
    ok("type normalisation");
}

console.log("source-links tests passed");
