// map text is data: OSM names and tags from the tiles, fetched census and
// dated-place json, and contributor records all reach popup html. this test
// lifts the shared runtime's html builders from the source and feeds them a
// markup payload and a quote-breaking OSM type, then checks that no raw tag
// or unescaped quote reaches the string and that a non-http link is dropped
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const runtime = fs.readFileSync(path.join(__dirname, "region-map.js"), "utf8");
function lift(startMarker) {
  const start = runtime.indexOf(startMarker);
  assert.ok(start > 0, `${startMarker} exists`);
  return runtime.slice(start, runtime.indexOf("\n}\n", start) + 2);
}
function load(names, extra = {}) {
  const sandbox = { URL, ...extra };
  const context = vm.createContext(sandbox);
  const body = names.map((name) => lift(`function ${name}(`)).join("\n");
  vm.runInContext(`${body}\n${names.map((name) => `this.${name} = ${name};`).join("")}`, context);
  return context;
}

const XSS = "<img src=x onerror=alert(1)>";
const QUOTE = 'node" onmouseover="alert(1)';
const noRawMarkup = (html, message) => {
  assert.ok(!/<img/i.test(html), `${message}: no raw <img`);
  assert.ok(!/onerror=alert\(1\)>/.test(html), `${message}: payload not left whole`);
  assert.ok(html.includes("&lt;img"), `${message}: payload appears escaped`);
};

// the escaper covers all five characters
{
  const { escText } = load(["escText"]);
  assert.equal(escText(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
  assert.equal(escText(null), "null");
}

// link checks
{
  const { safeHttpUrl, osmObjectUrl } = load(["safeHttpUrl", "osmObjectUrl"]);
  assert.equal(safeHttpUrl("https://example.org/a?b=1"), "https://example.org/a?b=1");
  assert.equal(safeHttpUrl("http://example.org/"), "http://example.org/");
  for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", " javascript:alert(1)", "data:text/html,x", "vbscript:x", "/relative", "", null, undefined, 5]) {
    assert.equal(safeHttpUrl(bad), "", `refused: ${String(bad)}`);
  }
  assert.equal(osmObjectUrl("node", 123), "https://www.openstreetmap.org/node/123");
  assert.equal(osmObjectUrl("way", "45"), "https://www.openstreetmap.org/way/45");
  assert.equal(osmObjectUrl("relation", "6"), "https://www.openstreetmap.org/relation/6");
  assert.equal(osmObjectUrl(QUOTE, "1"), "");
  assert.equal(osmObjectUrl("node", '1"><script>'), "");
  assert.equal(osmObjectUrl("node", "12a"), "");
  assert.equal(osmObjectUrl("", "1"), "");
  assert.equal(osmObjectUrl("node", undefined), "");
}

// hover and pinned label, and the census area builders
{
  const ctx = load(["escText", "placeLabelHtml", "censusAreaHeaderHtml", "censusHoverHtml"]);
  noRawMarkup(ctx.placeLabelHtml(XSS), "place label");
  assert.equal(ctx.placeLabelHtml("St Mary's"), `<div style="font-weight:600;color:inherit;">St Mary&#39;s</div>`);
  noRawMarkup(ctx.censusAreaHeaderHtml(XSS), "census popup header");
  const hover = ctx.censusHoverHtml(XSS, "No religion", 2023, "12.0%");
  noRawMarkup(hover, "census hover");
  assert.ok(hover.includes("No religion (2023): 12.0%"), "the metric line is kept");
  // a byte artefact in a name displays literally
  assert.ok(ctx.censusAreaHeaderHtml("Témiscamingue").includes("Témiscamingue"));
}

// the dated-place popup
{
  const ctx = load(["escText", "osmObjectUrl", "datedPlacePopupHtml"], { censusState: { enabled: true, year: 1900 } });
  const hostile = {
    name: XSS, religion: XSS, denomination: XSS, end_reason: XSS,
    source: "reviewed_occupancy", start_year: 1850, end_year: XSS, still_active_asof: XSS,
    osm_type: QUOTE, osm_id: "1"
  };
  const html = ctx.datedPlacePopupHtml(hostile, [174.7, -36.8]);
  noRawMarkup(html, "dated popup");
  assert.ok(!html.includes("Open OSM"), "a quote-breaking osm_type yields no OSM link");
  assert.ok(!/onmouseover="alert/.test(html), "no attribute escapes the quote");
  assert.ok(html.includes("Street View"), "the rest of the popup is kept");
  const badId = ctx.datedPlacePopupHtml({ name: "x", osm_type: "node", osm_id: '1"><script>' }, [1, 2]);
  assert.ok(!badId.includes("Open OSM") && !/<script/.test(badId), "a non-digit id yields no link");
  const good = ctx.datedPlacePopupHtml({ name: "Chapel", osm_type: "way", osm_id: 77, religion: "christian" }, [1, 2]);
  assert.ok(good.includes('href="https://www.openstreetmap.org/way/77"'), "a valid object links");
  assert.ok(good.includes("Chapel") && good.includes("christian"));
}

// the revise link keeps its href inside the attribute
{
  const ctx = load(["escText", "reviseLinkHtml"], { portalLinkHref: () => 'x" onmouseover="alert(1)' });
  const html = ctx.reviseLinkHtml("n", "1", "2", null);
  assert.ok(!/" onmouseover="/.test(html), "href cannot leave its attribute");
}

// the evidence drawer renders a link only for http and https
{
  const body = { innerHTML: "" };
  const evidence = { hidden: true };
  const ctx = load(["escText", "safeHttpUrl", "renderEvidenceDrawer"], {
    RC: {},
    document: { getElementById: (id) => (id === "census-evidence" ? evidence : id === "census-evidence-body" ? body : null) }
  });
  ctx.renderEvidenceDrawer({
    sourceDatasets: [
      { name: XSS, url: "javascript:alert(1)", licence: { name: "CC BY", url: "javascript:alert(2)" } },
      { name: "Good", url: "https://example.org/data", licence: { name: "CC0", url: "https://example.org/licence" } }
    ]
  });
  assert.ok(!/javascript:/i.test(body.innerHTML), "no javascript: href in the drawer");
  noRawMarkup(body.innerHTML, "evidence drawer");
  assert.ok(body.innerHTML.includes('href="https://example.org/data"') && body.innerHTML.includes('href="https://example.org/licence"'));
}

// the sinks use the builders
assert.ok(!/pulotuEscape/.test(runtime), "one escaper in the module");
assert.ok(!/\.setHTML\(`<div style="font-weight:600;color:inherit;">\$\{/.test(runtime), "hover and pinned labels use placeLabelHtml");
assert.equal((runtime.match(/function escText\(/g) || []).length, 1, "escText is defined once");
assert.ok(/safeHttpUrl\(pr\.record_url\)/.test(runtime), "the Pulotu record link is scheme-checked");
assert.ok(!/popup-title">\$\{(name|betterName)(\s*\|\|[^}]*)?\}</.test(runtime), "no popup title takes a raw name");

console.log("escape-map-text.test.cjs: ok");
