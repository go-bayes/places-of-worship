// columnar area-summary transport (L4, first half): the loader's decoder, its
// pins and its fallback, run against the real shipped files. the python round
// trip (scripts/build_area_summary_columns.py --check) proves the files decode
// to the governed products in python; this test proves the browser decoder does
// the same in JavaScript, that a transport whose bytes, source, shape or domain
// disagree with the page's pins is refused, and that every such failure (and a
// 404, a malformed file or a network error) falls back to the governed summary
// instead of failing the layer or altering what the map shows.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
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
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

// load the transport block from the runtime source, with stubbed globals
const begin = runtime.indexOf("// @columnar-transport-begin");
const end = runtime.indexOf("// @columnar-transport-end");
ok(begin > 0 && end > begin, "the runtime marks its columnar transport block");
const warnings = [];
const sandbox = { console: { warn: (m) => warnings.push(m) }, crypto: crypto.webcrypto, TextDecoder, fetch: undefined };
vm.createContext(sandbox);
vm.runInContext(`${runtime.slice(begin, end)}\nthis.expandSummaryColumns = expandSummaryColumns; this.fetchCensusSummary = fetchCensusSummary;`, sandbox);
const { expandSummaryColumns, fetchCensusSummary } = sandbox;

// a response stub: the body is text, parsed or read as bytes on demand
const respond = (status, body) => {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text,
    json: async () => JSON.parse(text),
    arrayBuffer: async () => { const b = Buffer.from(text, "utf8"); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); }
  };
};
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
//    field for field, including header, key order and value types, and the
//    shipped file's recorded source is the governed product's actual hash
const manifest = JSON.parse(fs.readFileSync(path.join(repo, "docs", "manifests", "area-summary-columns.manifest.json"), "utf8"));
for (const file of manifest.durable_files) {
  const entry = manifest.stats.files.find((f) => f.columns === file.uri);
  const governedBytes = fs.readFileSync(path.join(repo, entry.source));
  const governed = JSON.parse(governedBytes);
  const columnsBytes = fs.readFileSync(path.join(repo, file.uri));
  eq(sha256(governedBytes), entry.source_sha256, `${file.uri}: the manifest records the governed product's hash`);
  eq(sha256(columnsBytes), entry.columns_sha256, `${file.uri}: the manifest records the transport's hash`);
  const decoded = expandSummaryColumns(JSON.parse(columnsBytes), {
    sourceFile: path.basename(entry.source), sourceSha256: entry.source_sha256, domain: governed.domain || "religion"
  });
  eq(decoded.rows.length, governed.rows.length, `${file.uri}: row count`);
  eq(decoded, governed, `${file.uri}: decoded product equals the governed product`);
}

// 2. no two rows alias an array or object shared through the transport
const SRC = "a".repeat(64);
const base = {
  schema_version: "area-summary-columns.v1", source_file: "s.json", source_sha256: SRC, n: 2, header: { domain: "religion" },
  keys: ["area_code", "year", "a", "b", "c"], constants: { year: 2020, a: ["x"] },
  encoded: { b: { values: [["y"]], index: [0, 0] } }, columns: { area_code: ["1", "2"], c: [1, 2] }
};
{
  const rows = expandSummaryColumns(plain(base)).rows;
  rows[0].a.push("z");
  rows[0].b.push("z");
  eq(rows[1].a, ["x"], "constant arrays are copied per row");
  eq(rows[1].b, ["y"], "dictionary arrays are copied per row");
}

// 3. validation: every schema-invalid payload throws in the decoder
const mutate = (fn) => { const copy = plain(base); fn(copy); return copy; };
const invalid = {
  "not an object": [],
  "null": null,
  "array header": mutate((p) => { p.header = []; }),
  "header with rows": mutate((p) => { p.header.rows = []; }),
  "null header": mutate((p) => { p.header = null; }),
  "missing source_file": mutate((p) => { delete p.source_file; }),
  "empty source_file": mutate((p) => { p.source_file = ""; }),
  "missing source_sha256": mutate((p) => { delete p.source_sha256; }),
  "malformed source_sha256": mutate((p) => { p.source_sha256 = "ZZ"; }),
  "non-integer n": mutate((p) => { p.n = 2.5; }),
  "empty keys": mutate((p) => { p.keys = []; }),
  "empty key": mutate((p) => { p.keys.push(""); p.columns[""] = [1, 2]; }),
  "non-string key": mutate((p) => { p.keys.push(7); }),
  "duplicate keys": mutate((p) => { p.keys.push("c"); }),
  "proto key": mutate((p) => { p.keys.push("__proto__"); p.columns = JSON.parse(`{"area_code":["1","2"],"c":[1,2],"__proto__":[1,2]}`); }),
  "key in two groups": mutate((p) => { p.columns.a = ["x", "x"]; }),
  "key in no group": mutate((p) => { delete p.columns.c; }),
  "group key outside keys": mutate((p) => { p.columns.extra = [1, 2]; }),
  "array group": mutate((p) => { p.constants = []; }),
  "encoded entry not an object": mutate((p) => { p.encoded.b = []; }),
  "no area_code": mutate((p) => { p.keys = p.keys.filter((k) => k !== "area_code"); delete p.columns.area_code; }),
  "no year": mutate((p) => { p.keys = p.keys.filter((k) => k !== "year"); delete p.constants.year; }),
  "constant area_code": mutate((p) => { p.constants.area_code = "WRONG"; delete p.columns.area_code; p.keys = ["area_code", "year", "a", "b", "c"]; }),
  "duplicate area_code and year": mutate((p) => { p.columns.area_code = ["1", "1"]; }),
  "short column": mutate((p) => { p.columns.c = [1]; }),
  "bad position": mutate((p) => { p.encoded.b.index = [0, 3]; }),
  "fractional position": mutate((p) => { p.encoded.b.index = [0, 0.5]; }),
  "index length": mutate((p) => { p.encoded.b.index = [0]; })
};
for (const [name, payload] of Object.entries(invalid)) {
  assert.throws(() => expandSummaryColumns(payload, { sourceFile: "s.json", sourceSha256: SRC, domain: "religion" }), undefined, `invalid (${name}) is refused`);
  checks += 1;
}
const refuses = (expect, message) => {
  assert.throws(() => expandSummaryColumns(plain(base), expect), undefined, message);
  checks += 1;
};
refuses({ sourceFile: "other.json" }, "a different source_file is refused");
refuses({ sourceSha256: "b".repeat(64) }, "a different source_sha256 is refused");
refuses({ domain: "other" }, "a different header domain is refused");
eq(expandSummaryColumns(plain(base), { sourceFile: "s.json", sourceSha256: SRC, domain: "religion" }).rows.length, 2, "the valid fixture decodes under matching expectations");
eq(expandSummaryColumns(mutate((p) => { delete p.header.domain; }), { domain: "religion" }).rows.length, 2, "a header without a domain is the religion domain");

// 4. fetchCensusSummary: pins, fetch, fallback
const governedBody = { schema_version: "area-summary.v2", rows: [{ area_code: "1", year: 2020 }] };
const validColumns = {
  schema_version: "area-summary-columns.v1", source_file: "s.json", source_sha256: SRC, n: 1,
  header: { schema_version: "area-summary.v2" }, keys: ["area_code", "year"],
  constants: { year: 2020 }, encoded: {}, columns: { area_code: ["1"] }
};
const expect = { domain: "religion" };
// a level whose pins match the given response body
const pinnedDef = (res) => ({
  summary: "data/s.json", summaryColumns: "data/s.columns.json",
  summaryColumnsSha256: sha256(res.text), summarySha256: SRC
});
const fallsBack = async (name, table, def, why) => {
  warnings.length = 0;
  const fetchImpl = stub({ "data/s.json": respond(200, governedBody), ...table });
  eq(await fetchCensusSummary(def, fetchImpl, expect), governedBody, `${name} falls back to the governed file`);
  ok(fetchImpl.calls.at(-1) === "data/s.json", `${name} ends at the governed file`);
  ok(warnings.length === 1, `${name} is logged once`);
  if (why) ok(why.test(warnings[0]), `${name} names its reason (${warnings[0]})`);
};
(async () => {
  // success: the transport is read and the governed file is not requested
  const good = respond(200, validColumns);
  let fetchImpl = stub({ "data/s.columns.json": good });
  eq(await fetchCensusSummary(pinnedDef(good), fetchImpl, expect), governedBody, "success returns the decoded product");
  eq(fetchImpl.calls, ["data/s.columns.json"], "success requests only the transport");

  // no opt-in: the governed file alone, as before
  fetchImpl = stub({ "data/s.json": respond(200, governedBody) });
  eq(await fetchCensusSummary({ summary: "data/s.json" }, fetchImpl, expect), governedBody, "a level without summaryColumns reads the governed file");
  eq(fetchImpl.calls, ["data/s.json"], "a level without summaryColumns requests nothing else");

  // 404: falls back to the governed summary
  await fallsBack("404", {}, pinnedDef(good), /404/);

  // unpinned: a level that names a transport but pins nothing never loads it
  for (const [name, def] of Object.entries({
    "no pins": { summary: "data/s.json", summaryColumns: "data/s.columns.json" },
    "no source pin": { ...pinnedDef(good), summarySha256: undefined },
    "no bytes pin": { ...pinnedDef(good), summaryColumnsSha256: undefined },
    "malformed pin": { ...pinnedDef(good), summaryColumnsSha256: "abc" }
  })) {
    await fallsBack(`unpinned (${name})`, { "data/s.columns.json": good }, def, /not pinned/);
  }

  // digest: corrupted bytes, an altered but structurally valid value, and a stale pin
  const wrongHashDef = { ...pinnedDef(good), summaryColumnsSha256: "0".repeat(64) };
  await fallsBack("a hash that does not match the fetched bytes", { "data/s.columns.json": good }, wrongHashDef, /pinned SHA-256/);
  const altered = respond(200, { ...validColumns, columns: { area_code: ["2"] } });
  await fallsBack("a structurally valid value changed after pinning", { "data/s.columns.json": altered }, pinnedDef(good), /pinned SHA-256/);
  const zeroed = respond(200, { ...validColumns, source_sha256: "0".repeat(64) });
  await fallsBack("a zeroed source_sha256 (bytes pinned)", { "data/s.columns.json": zeroed }, pinnedDef(zeroed), /source_sha256/);
  const otherSource = respond(200, { ...validColumns, source_file: "t.json" });
  await fallsBack("a transport derived from another file", { "data/s.columns.json": otherSource }, pinnedDef(otherSource), /source_file/);
  const staleSource = { ...pinnedDef(good), summarySha256: "c".repeat(64) };
  await fallsBack("a source pin that disagrees with the transport", { "data/s.columns.json": good }, staleSource, /source_sha256/);

  // schema-invalid, with the bytes pinned so the decoder (not the hash) refuses it
  const schemaCases = {
    "constants.area_code overrides every code": { ...validColumns, n: 2, keys: ["area_code", "year"], constants: { area_code: "WRONG", year: 2020 }, columns: {} },
    "array header": { ...validColumns, header: [] },
    "overlapping groups": { ...validColumns, constants: { year: 2020 }, columns: { area_code: ["1"], year: [2020] } },
    "duplicate keys": { ...validColumns, keys: ["area_code", "year", "year"] },
    "empty key": { ...validColumns, keys: ["area_code", "year", ""], columns: { area_code: ["1"], "": [1] } },
    "missing source fields": (() => { const c = { ...validColumns }; delete c.source_file; delete c.source_sha256; return c; })(),
    "wrong header domain": { ...validColumns, header: { schema_version: "area-summary.v2", domain: "other" } }
  };
  for (const [name, payload] of Object.entries(schemaCases)) {
    const res = respond(200, payload);
    await fallsBack(`schema-invalid (${name})`, { "data/s.columns.json": res }, pinnedDef(res));
  }

  // malformed bodies, with the bytes pinned
  const malformed = {
    "unparseable": respond(200, "{not json"),
    "wrong version": respond(200, { ...validColumns, schema_version: "area-summary-columns.v2" }),
    "short column": respond(200, { ...validColumns, columns: { area_code: [] } }),
    "missing column": respond(200, { ...validColumns, columns: {} }),
    "bad position": respond(200, { ...validColumns, constants: { year: 2020 }, encoded: { area_code: { values: ["1"], index: [3] } }, columns: {} }),
    "index length": respond(200, { ...validColumns, encoded: { area_code: { values: ["1"], index: [0, 0] } }, columns: {} }),
    "no header": respond(200, { ...validColumns, header: null }),
    "null body": respond(200, "null"),
    "html error page": respond(200, "<!doctype html><title>404</title>")
  };
  for (const [name, res] of Object.entries(malformed)) {
    await fallsBack(`malformed (${name})`, { "data/s.columns.json": res }, pinnedDef(res));
  }

  // a network error on the transport falls back too
  await fallsBack("a network error", { "data/s.columns.json": new TypeError("Failed to fetch") }, pinnedDef(good));

  // no crypto.subtle (an insecure context): the transport cannot be verified, so it is not used
  sandbox.crypto = undefined;
  await fallsBack("a context without crypto.subtle", { "data/s.columns.json": good }, pinnedDef(good));
  sandbox.crypto = crypto.webcrypto;

  // the governed file failing is still an error, as before
  fetchImpl = stub({});
  await assert.rejects(() => fetchCensusSummary(pinnedDef(good), fetchImpl, expect), /census fetch failed/);
  checks += 1;

  // 5. configuration: every opt-in names a file the manifest lists, next to
  //    its governed summary, with both pins equal to the manifest's hashes;
  //    every listed file is opted in by some page; the small levels are left
  //    alone
  const listed = new Set(manifest.durable_files.map((f) => f.uri));
  const used = new Set();
  const regions = path.join(repo, "apps", "regions");
  for (const dir of fs.readdirSync(regions)) {
    const page = path.join(regions, dir, "index.html");
    if (!fs.existsSync(page)) continue;
    const html = fs.readFileSync(page, "utf8");
    const optIn = /summary: "(data\/[^"]+\.json)",\n\s*summaryColumns: "([^"]+)",\n\s*summaryColumnsSha256: "([0-9a-f]{64})",\n\s*summarySha256: "([0-9a-f]{64})",/g;
    for (const m of html.matchAll(optIn)) {
      const uri = `apps/regions/${dir}/${m[2]}`;
      eq(m[2], m[1].replace(/\.json$/, ".columns.json"), `${dir}: summaryColumns sits beside its summary`);
      ok(listed.has(uri), `${dir}: ${m[2]} is in the manifest`);
      const entry = manifest.stats.files.find((f) => f.columns === uri);
      eq(m[3], entry.columns_sha256, `${dir}: ${m[2]} is pinned to the manifest's transport hash`);
      eq(m[4], entry.source_sha256, `${dir}: ${m[2]} is pinned to the manifest's source hash`);
      used.add(uri);
    }
    // every summaryColumns key appears directly after a summary key, and carries both pins
    eq((html.match(/summaryColumns:/g) || []).length, [...html.matchAll(optIn)].length, `${dir}: each summaryColumns follows a summary and carries both pins`);
  }
  eq([...used].sort(), [...listed].sort(), "every manifest file is opted in by exactly the pages that name it");
  eq(new Set([...used].map((u) => u.split("/")[2])), new Set(["us", "br", "dk", "mx", "nz", "au"]), "the six pages opt in");
  for (const small of ["nz/data/area_summary_ta", "br/data/area_summary_uf"]) {
    const dir = small.split("/")[0];
    ok(!new RegExp(`summaryColumns: "data/${small.split("/")[2]}`).test(fs.readFileSync(path.join(regions, dir, "index.html"), "utf8")), `${small} stays on the governed file`);
  }
  // the loader reads the summary only through the fallback-aware function,
  // which receives the overlay domain it must match
  ok(/fetchCensusSummary\(def, fetch, \{ domain: censusState\.domain \}\)/.test(runtime) && !/fetch\(def\.summary\)/.test(runtime), "loadCensusDataInto goes through fetchCensusSummary with its domain");
  ok(!/countryCode\s*(===|==)\s*["'](us|br|dk|mx|nz|au)["']/i.test(runtime.slice(begin, end)), "no country logic in the transport");

  console.log(`area-summary-columns: ${checks} checks passed`);
})().catch((err) => { console.error(err); process.exit(1); });
