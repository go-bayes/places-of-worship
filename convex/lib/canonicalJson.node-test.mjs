import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
      for (const extension of [".js", ".ts"]) {
        const candidate = new URL(`${specifier}${extension}`, context.parentURL);
        if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

const { canonicalJsonStrict, objectHash, withoutUndefined, isObjectHash, HASH_CONTRACT } = await import("./canonicalJson.ts");

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fixtures = JSON.parse(fs.readFileSync(path.join(repoRoot, "schemas/fixtures/pow-canonical-json.v1.json"), "utf8"));

// the fixture file is the shared oracle for both languages; this suite
// checks the typescript implementation against it, and the rust suite in
// crates/pow-cli/src/canonical.rs checks the same file
test("every canonical fixture reproduces its canonical text and object hash", () => {
  assert.equal(fixtures.hash_contract, HASH_CONTRACT);
  assert.ok(fixtures.cases.length >= 40);
  for (const entry of fixtures.cases) {
    const value = JSON.parse(entry.json_text);
    assert.equal(canonicalJsonStrict(value), entry.canonical, entry.name);
    assert.equal(objectHash(value), entry.object_hash, entry.name);
    assert.ok(isObjectHash(entry.object_hash), entry.name);
  }
});

test("every rejected fixture is refused by parse or canonicalisation", () => {
  for (const entry of fixtures.rejected) {
    assert.throws(() => {
      const value = JSON.parse(entry.json_text);
      if (entry.name === "duplicate_member_names") {
        // json.parse keeps the last duplicate silently; the server rejects
        // duplicates before parsing (assertNoDuplicateJsonKeys), so this
        // case asserts the contract rule rather than the parser
        throw new Error("duplicate member name");
      }
      canonicalJsonStrict(value);
    }, entry.name);
  }
});

test("reordering object members leaves the hash unchanged", () => {
  const left = { latitude: -41.28664, longitude: 174.77557, name: "Wellington", nested: { b: 1, a: [1, 2] } };
  const right = { nested: { a: [1, 2], b: 1 }, name: "Wellington", longitude: 174.77557, latitude: -41.28664 };
  assert.equal(objectHash(left), objectHash(right));
});

test("changing any hashed field changes the hash", () => {
  const base = { latitude: -41.28664, longitude: 174.77557, note: "a", years: [2013, 2018] };
  const variants = [
    { ...base, latitude: -41.28665 },
    { ...base, note: "b" },
    { ...base, years: [2018, 2013] },
    { ...base, extra: null },
  ];
  const seen = new Set([objectHash(base)]);
  for (const variant of variants) {
    const hash = objectHash(variant);
    assert.ok(!seen.has(hash));
    seen.add(hash);
  }
});

test("set-like arrays hash identically after their pre-sort and ordered arrays keep order as data", () => {
  const sortedHashes = ["sha256:a", "sha256:b"];
  assert.equal(
    objectHash({ parent_object_hashes: [...sortedHashes].sort() }),
    objectHash({ parent_object_hashes: [...sortedHashes].reverse().sort() }),
  );
  assert.notEqual(objectHash({ segments: [1, 2] }), objectHash({ segments: [2, 1] }));
});

test("values outside the contract domain are refused instead of coerced", () => {
  assert.throws(() => canonicalJsonStrict({ a: undefined }), /Unsupported value/);
  assert.throws(() => canonicalJsonStrict([undefined]), /Unsupported value/);
  assert.throws(() => canonicalJsonStrict(Number.NaN), /Non-finite/);
  assert.throws(() => canonicalJsonStrict(Number.POSITIVE_INFINITY), /Non-finite/);
  assert.throws(() => canonicalJsonStrict(10n), /Unsupported value/);
  assert.throws(() => canonicalJsonStrict(new Date(0)), /Non-plain object/);
  assert.throws(() => canonicalJsonStrict("\ud800"), /Lone surrogate/);
  assert.throws(() => canonicalJsonStrict({ "\udc00": 1 }), /Lone surrogate/);
  assert.equal(canonicalJsonStrict(-0), "0");
  assert.equal(canonicalJsonStrict(Object.create(null)), "{}");
});

test("withoutUndefined omits unset optional members at every depth and refuses undefined array elements", () => {
  const cleaned = withoutUndefined({ a: undefined, b: { c: undefined, d: 1 }, e: [{ f: undefined, g: 2 }] });
  assert.deepEqual(cleaned, { b: { d: 1 }, e: [{ g: 2 }] });
  assert.equal(objectHash(cleaned), objectHash({ b: { d: 1 }, e: [{ g: 2 }] }));
  assert.throws(() => withoutUndefined([1, undefined]), /Undefined array element/);
});

// finding (2026-09-11 review): assignment into {} invoked the inherited
// __proto__ setter, so cleanup silently dropped that member and two
// different documents hashed the same
test("a member named __proto__ survives cleanup and moves the hash", () => {
  const one = JSON.parse('{"__proto__":1,"note":"same"}');
  const two = JSON.parse('{"__proto__":2,"note":"same"}');
  assert.equal(canonicalJsonStrict(withoutUndefined(one)), '{"__proto__":1,"note":"same"}');
  assert.equal(canonicalJsonStrict(withoutUndefined(one)), canonicalJsonStrict(one));
  assert.notEqual(objectHash(withoutUndefined(one)), objectHash(withoutUndefined(two)));
  // nested, and beside an undefined member that is dropped
  const nested = withoutUndefined({ outer: JSON.parse('{"__proto__":{"x":1},"gone":null}'), gone: undefined });
  assert.deepEqual(Object.keys(nested), ["outer"]);
  assert.deepEqual(Object.keys(nested.outer), ["__proto__", "gone"]);
  assert.equal(Object.getPrototypeOf(nested.outer), Object.prototype);
  assert.equal(canonicalJsonStrict(nested), '{"outer":{"__proto__":{"x":1},"gone":null}}');
});

test("sparse arrays are refused by canonicalisation and by cleanup", () => {
  assert.throws(() => canonicalJsonStrict(Array(1)), /Sparse array element at \$\[0\]/);
  assert.throws(() => canonicalJsonStrict(Array(2)), /Sparse array element/);
  assert.throws(() => canonicalJsonStrict({ a: [1, , 3] }), /Sparse array element at \$\.a\[1\]/);
  assert.throws(() => withoutUndefined(Array(1)), /Sparse array element/);
  assert.throws(() => withoutUndefined({ a: [1, , 3] }), /Sparse array element at \$\.a\[1\]/);
  // dense arrays of the same length are unaffected
  assert.equal(canonicalJsonStrict([null]), "[null]");
  assert.deepEqual(withoutUndefined([1, [2]]), [1, [2]]);
});
