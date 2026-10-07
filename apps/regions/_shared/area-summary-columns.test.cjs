// columnar area-summary transport (L4, first half): the loader's decoder and
// its fallback, run against the real shipped files. the python round trip
// (scripts/build_area_summary_columns.py --check) proves the files decode to the
// governed products in python; this test proves the browser decoder does the
// same in JavaScript, and that a 404, a malformed file or a network error
// falls back to the governed summary instead of failing the layer.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const repo = path.join(__dirname, "..", "..", "..");
const runtime = fs.readFileSync(path.join(__dirname, "region-map.js"), "utf8");
let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks += 1; };
// values built inside the vm context carry that realm's prototypes, so compare
// plain JSON copies (which also pins key order through the text comparison)
const plain = (v) => JSON.parse(JSON.stringify(v));
const eq = (a, b, message) => {
  assert.deepStrictEqual(plain(a), plain(b), message);
  assert.equal(JSON.stringify(a), JSON.stringify(b), `${message} (key order)`);
  checks += 1;
};

// load the transport block from the runtime source, with stubbed globals
const begin = runtime.indexOf("// @columnar-transport-begin");
const end = runtime.indexOf("// @columnar-transport-end");
ok(begin > 0 && end > begin, "the runtime marks its columnar transport block");
const warnings = [];
const sandbox = { console: { warn: (m) => warnings.push(m) }, structuredClone, Object, Array, Number, Error, JSON, fetch: undefined };
vm.createContext(sandbox);
vm.runInContext(`${runtime.slice(begin, end)}\nthis.expandSummaryColumns = expandSummaryColumns; this.fetchCensusSummary = fetchCensusSummary;`, sandbox);
const { expandSummaryColumns, fetchCensusSummary } = sandbox;

// a response stub
const respond = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => (typeof body === "string" ? JSON.parse(body) : body)
});
const stub = (table) => {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    const hit = table[url];
    if (hit instanceof Error) throw hit;
    return hit ?? respond(404, {});
  };
  fn.calls = calls;
  return fn;
};

// 1. the decoder reproduces every shipped governed product, row for row and
//    field for field, including header, key order and value types
const manifest = JSON.parse(fs.readFileSync(path.join(repo, "docs", "manifests", "area-summary-columns.manifest.json"), "utf8"));
for (const file of manifest.durable_files) {
  const entry = manifest.stats.files.find((f) => f.columns === file.uri);
  const governed = JSON.parse(fs.readFileSync(path.join(repo, entry.source), "utf8"));
  const decoded = expandSummaryColumns(JSON.parse(fs.readFileSync(path.join(repo, file.uri), "utf8")));
  eq(decoded.rows.length, governed.rows.length, `${file.uri}: row count`);
  eq(decoded, governed, `${file.uri}: decoded product equals the governed product`);
}

// 2. no two rows alias an array or object shared through the transport
{
  const rows = expandSummaryColumns({
    schema_version: "area-summary-columns.v1", n: 2, header: { domain: "religion" }, keys: ["a", "b", "c"],
    constants: { a: ["x"] }, encoded: { b: { values: [["y"]], index: [0, 0] } }, columns: { c: [1, 2] }
  }).rows;
  rows[0].a.push("z");
  rows[0].b.push("z");
  eq(rows[1].a, ["x"], "constant arrays are copied per row");
  eq(rows[1].b, ["y"], "dictionary arrays are copied per row");
}

// 3. fetchCensusSummary
const governedBody = { schema_version: "area-summary.v2", rows: [{ area_code: "1", year: 2020 }] };
const validColumns = {
  schema_version: "area-summary-columns.v1", n: 1, header: { schema_version: "area-summary.v2" }, keys: ["area_code", "year"],
  constants: { year: 2020 }, encoded: {}, columns: { area_code: ["1"] }
};
const def = { summary: "data/s.json", summaryColumns: "data/s.columns.json" };
(async () => {
  // success: the transport is read and the governed file is not requested
  let fetchImpl = stub({ "data/s.columns.json": respond(200, validColumns) });
  eq(await fetchCensusSummary(def, fetchImpl), governedBody, "success returns the decoded product");
  eq(fetchImpl.calls, ["data/s.columns.json"], "success requests only the transport");

  // no opt-in: the governed file alone, as before
  fetchImpl = stub({ "data/s.json": respond(200, governedBody) });
  eq(await fetchCensusSummary({ summary: "data/s.json" }, fetchImpl), governedBody, "a level without summaryColumns reads the governed file");
  eq(fetchImpl.calls, ["data/s.json"], "a level without summaryColumns requests nothing else");

  // 404: falls back to the governed summary
  warnings.length = 0;
  fetchImpl = stub({ "data/s.json": respond(200, governedBody) });
  eq(await fetchCensusSummary(def, fetchImpl), governedBody, "404 falls back to the governed file");
  eq(fetchImpl.calls, ["data/s.columns.json", "data/s.json"], "404 requests the transport then the governed file");
  ok(warnings.length === 1 && /404/.test(warnings[0]), "404 is logged once");

  // malformed: unparseable text, wrong version, short column, bad position, missing field
  const malformed = {
    "unparseable": respond(200, "{not json"),
    "wrong version": respond(200, { ...validColumns, schema_version: "area-summary-columns.v2" }),
    "short column": respond(200, { ...validColumns, columns: { area_code: [] } }),
    "missing column": respond(200, { ...validColumns, columns: {} }),
    "bad position": respond(200, { ...validColumns, constants: { year: 2020 }, encoded: { area_code: { values: ["1"], index: [3] } }, columns: {} }),
    "index length": respond(200, { ...validColumns, encoded: { area_code: { values: ["1"], index: [0, 0] } }, columns: {} }),
    "no header": respond(200, { ...validColumns, header: null }),
    "null body": respond(200, "null"),
    "html error page": { ok: true, status: 200, json: async () => { throw new SyntaxError("Unexpected token <"); } }
  };
  for (const [name, res] of Object.entries(malformed)) {
    warnings.length = 0;
    fetchImpl = stub({ "data/s.columns.json": res, "data/s.json": respond(200, governedBody) });
    eq(await fetchCensusSummary(def, fetchImpl), governedBody, `malformed (${name}) falls back to the governed file`);
    ok(warnings.length === 1, `malformed (${name}) is logged once`);
  }

  // a network error on the transport falls back too
  fetchImpl = stub({ "data/s.columns.json": new TypeError("Failed to fetch"), "data/s.json": respond(200, governedBody) });
  eq(await fetchCensusSummary(def, fetchImpl), governedBody, "a network error falls back to the governed file");

  // the governed file failing is still an error, as before
  fetchImpl = stub({});
  await assert.rejects(() => fetchCensusSummary(def, fetchImpl), /census fetch failed/);
  checks += 1;

  // 4. configuration: every opt-in names a file the manifest lists, next to
  //    its governed summary; every listed file is opted in by some page; the
  //    small levels are left alone
  const listed = new Set(manifest.durable_files.map((f) => f.uri));
  const used = new Set();
  const regions = path.join(repo, "apps", "regions");
  for (const dir of fs.readdirSync(regions)) {
    const page = path.join(regions, dir, "index.html");
    if (!fs.existsSync(page)) continue;
    const html = fs.readFileSync(page, "utf8");
    for (const m of html.matchAll(/summary: "(data\/[^"]+\.json)",\n\s*summaryColumns: "([^"]+)",/g)) {
      eq(m[2], m[1].replace(/\.json$/, ".columns.json"), `${dir}: summaryColumns sits beside its summary`);
      ok(listed.has(`apps/regions/${dir}/${m[2]}`), `${dir}: ${m[2]} is in the manifest`);
      used.add(`apps/regions/${dir}/${m[2]}`);
    }
    // every summaryColumns key appears directly after a summary key
    eq((html.match(/summaryColumns:/g) || []).length, [...html.matchAll(/summary: "[^"]+",\n\s*summaryColumns:/g)].length, `${dir}: each summaryColumns follows a summary`);
  }
  eq([...used].sort(), [...listed].sort(), "every manifest file is opted in by exactly the pages that name it");
  eq(new Set([...used].map((u) => u.split("/")[2])), new Set(["us", "br", "dk", "mx", "nz", "au"]), "the six pages opt in");
  for (const small of ["nz/data/area_summary_ta", "br/data/area_summary_uf"]) {
    const dir = small.split("/")[0];
    ok(!new RegExp(`summaryColumns: "data/${small.split("/")[2]}`).test(fs.readFileSync(path.join(regions, dir, "index.html"), "utf8")), `${small} stays on the governed file`);
  }
  // the loader reads the summary only through the fallback-aware function
  ok(/fetchCensusSummary\(def\)/.test(runtime) && !/fetch\(def\.summary\)/.test(runtime), "loadCensusDataInto goes through fetchCensusSummary");
  ok(!/countryCode\s*(===|==)\s*["'](us|br|dk|mx|nz|au)["']/i.test(runtime.slice(begin, end)), "no country logic in the transport");

  console.log(`area-summary-columns: ${checks} checks passed`);
})().catch((err) => { console.error(err); process.exit(1); });
