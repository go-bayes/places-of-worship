import assert from "node:assert/strict";
import test from "node:test";
import {
  assertRealSourceTitle,
  makeSourceId,
  normalizeTitleKey,
  resolveCitedSource,
  sourceClaimKey,
} from "./sources.ts";

test("title keys collapse case and whitespace", () => {
  assert.equal(normalizeTitleKey("  NZ  Phonebook\t1953 "), "nz phonebook 1953");
});

test("claim keys match the batch-import convention", () => {
  assert.equal(sourceClaimKey("NZ Phonebook 1953", "p. 214"), "NZ Phonebook 1953#p. 214");
});

test("source ids are deterministic per title key and scope", () => {
  const scoped = makeSourceId(normalizeTitleKey("NZ  Phonebook 1953"), "NZ");
  assert.equal(scoped, makeSourceId("nz phonebook 1953", "NZ"));
  assert.match(scoped, /^src:nz:[0-9a-f]{16}$/);
  assert.notEqual(scoped, makeSourceId("nz phonebook 1953", "AU"));
  assert.match(makeSourceId("nz phonebook 1953"), /^src:global:[0-9a-f]{16}$/);
});

test("placeholder titles are rejected", () => {
  assert.throws(() => assertRealSourceTitle("n/a"), /real title/);
  assert.throws(() => assertRealSourceTitle("  "), /real title/);
  assert.doesNotThrow(() => assertRealSourceTitle("Vanuatu Council of Churches directory"));
});

test("a locator without a picked source is rejected before any lookup", async () => {
  await assert.rejects(
    () => resolveCitedSource({}, undefined, "p. 4"),
    /locator needs a picked register source/,
  );
});

test("an absent citation resolves to null", async () => {
  assert.equal(await resolveCitedSource({}, undefined, undefined), null);
  assert.equal(await resolveCitedSource({}, undefined, "  "), null);
});
