// the shared portal link builder and the wrapped pin longitude (pin
// nomination brief 2026-10-15, section 3.1 changes 4 to 6). the public map
// script throws without window.REGION_CONFIG, so the functions are lifted
// from the source into a vm context with stubs, as counts-label.test.cjs does.
// 1. the nominate link carries only nominate, lat and lng after the portal
// base, and names the country as the revise link does. 2. a longitude that
// maplibre reports unwrapped is wrapped into -180 to 180 before the card or
// the link uses it. 3. the revise link is byte-identical to its output before
// the builder was shared.
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

// the one longitude wrapper, from the shared resolver
const resolverWindow = {};
vm.runInContext(
  fs.readFileSync(path.join(__dirname, "..", "..", "shared", "region-resolve.js"), "utf8"),
  vm.createContext({ window: resolverWindow })
);
const { normaliseLng } = resolverWindow.RegionResolve;
assert.equal(typeof normaliseLng, "function", "the resolver exports normaliseLng");

function load({ portal = null, rc = {}, region = null } = {}) {
  const sandbox = {
    URLSearchParams,
    RC: rc,
    CONTRIBUTE_ROUTES: { portal },
    PORTAL_BASE: "../nz/",
    projectCountryCode: (code) => (code === "gb" ? "uk" : code),
    countryUnderPoint: () => region,
    normaliseLng,
    escText: (value) => String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
  };
  const context = vm.createContext(sandbox);
  const names = ["countryForPlace", "portalLinkHref", "pinLinkCoords", "reviseLinkHtml"];
  const body = names.map((name) => lift(`function ${name}(`)).join("\n");
  vm.runInContext(`${body}\n${names.map((name) => `this.${name} = ${name};`).join("")}`, context);
  return context;
}
const nominate = (ctx, latFixed = "-41.286500", lngFixed = "174.776200") =>
  ctx.portalLinkHref("nominate", { name: "", latFixed, lngFixed, props: null });

// nominate link: a configured portal
{
  const ctx = load({ portal: { href: "../nz/verification.html" } });
  assert.equal(nominate(ctx), "../nz/verification.html?nominate=1&lat=-41.286500&lng=174.776200", "no country parameter");
  const withQuery = load({ portal: { href: "../nz/verification.html?country=nz" }, rc: { countryCode: "au" } });
  assert.equal(
    nominate(withQuery),
    "../nz/verification.html?country=nz&nominate=1&lat=-41.286500&lng=174.776200",
    "a query already on the portal href is kept and extended with &"
  );
}

// nominate link: a country page
{
  const ctx = load({ rc: { countryCode: "nz" } });
  assert.equal(nominate(ctx), "../nz/verification.html?country=nz&nominate=1&lat=-41.286500&lng=174.776200");
}

// nominate link: the global map names the country under the point
{
  const ctx = load({ region: { code: "fj", name: "Fiji" } });
  assert.equal(nominate(ctx, "-17.713400", "178.065000"), "../nz/verification.html?country=fj&nominate=1&lat=-17.713400&lng=178.065000");
  const tile = load({ region: null });
  assert.equal(
    tile.portalLinkHref("nominate", { name: "", latFixed: "51.5", lngFixed: "-0.1", props: { country_code: "gb" } }),
    "../nz/verification.html?country=uk&nominate=1&lat=51.5&lng=-0.1",
    "a tile country code is projected as in the revise link"
  );
}

// nominate link: at sea nothing names a country
{
  const ctx = load({ region: null });
  assert.equal(nominate(ctx, "-30.000000", "-150.000000"), "");
}

// the nominate mode carries no place identity
{
  const ctx = load({ rc: { countryCode: "nz" } });
  const href = ctx.portalLinkHref("nominate", { name: "St Paul's", latFixed: "1.000000", lngFixed: "2.000000", props: { osm_type: "way", osm_id: 9 } });
  assert.equal(href, "../nz/verification.html?country=nz&nominate=1&lat=1.000000&lng=2.000000", "no name, osm_type or osm_id, and no revise flag");
}

// the pin's longitude is wrapped before the card or the link uses it
{
  const { pinLinkCoords } = load();
  const wellington = pinLinkCoords({ lng: 534.7762, lat: -41.2865 });
  assert.equal(wellington.lngFixed, "174.776200");
  assert.equal(wellington.latFixed, "-41.286500");
  assert.equal(wellington.lngLabel, "174.77620");
  assert.equal(wellington.latLabel, "-41.28650");
  assert.equal(pinLinkCoords({ lng: -185.5, lat: 10 }).lngFixed, "174.500000");
  assert.equal(pinLinkCoords({ lng: 174.7762, lat: -41.2865 }).lngFixed, "174.776200", "an in-range longitude is unchanged");
  for (const lng of [180, -180, 540, -540, 179.9999995]) {
    const fixed = Number(pinLinkCoords({ lng, lat: 0 }).lngFixed);
    assert.ok(Math.abs(fixed) <= 180, `${lng} wraps within the parser's range (got ${fixed})`);
  }
  // the card label and the link agree on the same wrapped point
  const label = pinLinkCoords({ lng: 534.7762, lat: -41.2865 });
  assert.equal(Number(label.lngLabel), Number(Number(label.lngFixed).toFixed(5)));
}

// the revise link is byte-identical to its output before the builder was shared
{
  const place = { osm_type: "way", osm_id: 12345 };
  const run = (opts) => load(opts).reviseLinkHtml("St Paul's & Co", "-41.286500", "174.776200", place);
  const rest = "&amp;lat=-41.286500&amp;lng=174.776200&amp;name=St+Paul%27s+%26+Co&amp;osm_type=way&amp;osm_id=12345\" title=\"Open the contributor portal at this place\">Revise this place</a>";
  const tail = `&amp;revise=1${rest}`;
  const head = (base) => `<a class="popup-revise" href="${base}`;
  assert.equal(
    run({ portal: { href: "../nz/verification.html" } }),
    `${head("../nz/verification.html?revise=1")}${rest}`,
    "configured portal without a query"
  );
  assert.equal(
    run({ portal: { href: "../nz/verification.html?country=nz" } }),
    `${head("../nz/verification.html?country=nz")}${tail}`,
    "configured portal with a query"
  );
  assert.equal(run({ rc: { countryCode: "nz" } }), `${head("../nz/verification.html?country=nz")}${tail}`, "country page");
  assert.equal(run({ region: { code: "FJ", name: "Fiji" } }), `${head("../nz/verification.html?country=fj")}${tail}`, "global map");
  assert.equal(run({}), "", "no country and no portal gives no link");
  assert.equal(load().reviseLinkHtml("Loading place…", "1", "2", null), "", "an unresolved country gives no link, name or not");
}

console.log("pin-nomination tests passed");
