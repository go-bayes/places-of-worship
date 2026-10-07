// behavioural check of the partially-selected christianity filter in the
// shared runtime: denominationMatch is lifted from the source and run against
// the real taxonomy. a denomination of a deselected bucket must not pass
// because the "Other Christian" checkbox is on (found in review of PR #181;
// the logic predates it).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const runtime = fs.readFileSync(path.join(__dirname, "region-map.js"), "utf8");
const start = runtime.indexOf("function denominationMatch(");
assert.ok(start > 0, "denominationMatch exists");
const end = runtime.indexOf("\n}\n", start) + 2;
const context = vm.createContext({});
vm.runInContext(`${runtime.slice(start, end)}\nthis.denominationMatch = denominationMatch;`, context);
const { denominationMatch } = context;

const taxonomy = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "..", "schemas", "denomination-taxonomy.json"), "utf8"));
const codes = [
  "christian.anglican", "christian.catholic", "christian.presbyterian",
  "christian.methodist", "christian.baptist", "christian.pentecostal",
  "christian.orthodox", "christian.latter_day_saints"
];
const buckets = codes.map((code) => ({
  code,
  aliases: taxonomy.denominations.find((d) => d.code === code).osm_aliases.map((a) => a.toLowerCase())
}));

// match labels must be unique across the expression
const allAliases = taxonomy.denominations.flatMap((d) => (d.osm_aliases || []).map((a) => a.toLowerCase()));
assert.equal(new Set(allAliases).size, allAliases.length, "taxonomy aliases are unique");

// evaluates the expression subset denominationMatch emits, on a plain string
function passes(expr, value) {
  if (typeof expr === "boolean") return expr;
  assert.equal(expr[0], "match");
  const arms = expr.slice(2, -1);
  for (let i = 0; i < arms.length; i += 2) {
    if (arms[i].includes(value)) return arms[i + 1];
  }
  return expr[expr.length - 1];
}

const state = (off, other) => {
  const s = { __other: other };
  codes.forEach((c) => { s[c] = !off.includes(c); });
  return s;
};
const run = (off, other, value) => passes(denominationMatch(["literal", "x"], buckets, state(off, other)), value);

// catholic off, other christian on: catholic hidden, others shown
assert.equal(run(["christian.catholic"], true, "catholic"), false);
assert.equal(run(["christian.catholic"], true, "roman_catholic"), false);
assert.equal(run(["christian.catholic"], true, "anglican"), true);
assert.equal(run(["christian.catholic"], true, "coptic"), true, "outside every bucket follows other");
assert.equal(run(["christian.catholic"], true, ""), true, "no denomination follows other");

// other christian off: only the selected buckets pass
assert.equal(run(["christian.catholic"], false, "coptic"), false);
assert.equal(run(["christian.catholic"], false, ""), false);
assert.equal(run(["christian.catholic"], false, "baptist"), true);
assert.equal(run(["christian.catholic"], false, "catholic"), false);

// only other christian on: every bucket hidden
assert.equal(run(codes, true, "anglican"), false);
assert.equal(run(codes, true, "coptic"), true);

// only catholic on
const onlyCatholic = codes.filter((c) => c !== "christian.catholic");
assert.equal(run(onlyCatholic, false, "catholic"), true);
assert.equal(run(onlyCatholic, false, "baptist"), false);
assert.equal(run(onlyCatholic, false, "coptic"), false);

// the filter builds this clause through the helper
assert.match(runtime, /denominationMatch\(denom, christianBuckets, denomFilterState\)/);
console.log("ok denomination-filter");
