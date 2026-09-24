import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { canonicalWireJson, isCanonicalWireJson, pythonFloatRepr } from "./wireJson.ts";

// python -> typescript: every python-generated vector re-encodes to python's
// own bytes; typescript -> python is checked by test_first_pass.py, which
// parses and re-encodes the same expected strings
const vectors = JSON.parse(fs.readFileSync(new URL("../../scripts/agent_research/fixtures/wire-format-vectors.json", import.meta.url), "utf8"));

test("the typescript encoder reproduces python's canonical bytes for every vector", () => {
  assert.ok(vectors.canonical.length >= 40);
  for (const { input, expected } of vectors.canonical) {
    assert.equal(canonicalWireJson(input), expected, `input ${JSON.stringify(input)}`);
    // the canonical form is a fixed point, and only it passes the check
    assert.equal(canonicalWireJson(expected), expected);
    assert.equal(isCanonicalWireJson(`${expected}\n`), true);
    if (input !== expected) assert.equal(isCanonicalWireJson(`${input}\n`), false, `non-canonical ${JSON.stringify(input)} was accepted`);
  }
});

test("inputs python's archive parser refuses are refused", () => {
  for (const input of vectors.rejected) {
    assert.throws(() => canonicalWireJson(input), undefined, `accepted ${JSON.stringify(input)}`);
  }
});

test("python float spellings follow repr's notation boundaries", () => {
  assert.equal(pythonFloatRepr(1e-7), "1e-07");
  assert.equal(pythonFloatRepr(0.0001), "0.0001");
  assert.equal(pythonFloatRepr(1e15), "1000000000000000.0");
  assert.equal(pythonFloatRepr(1e16), "1e+16");
  assert.equal(pythonFloatRepr(-0), "-0.0");
  assert.throws(() => pythonFloatRepr(Infinity), /non-finite/);
});

test("python re-encodes the typescript output to the same bytes", async (t) => {
  const { spawnSync } = await import("node:child_process");
  const probe = spawnSync("python3", ["--version"]);
  if (probe.status !== 0) {
    t.skip("python3 is not available");
    return;
  }
  const outputs = vectors.canonical.map(({ input }) => canonicalWireJson(input));
  const script = "import json,sys\nfor line in sys.stdin.read().split('\\n')[:-1]:\n    print(json.dumps(json.loads(line), sort_keys=True, ensure_ascii=True, separators=(',', ':'), allow_nan=False))\n";
  const run = spawnSync("python3", ["-c", script], { input: outputs.join("\n") + "\n", encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(run.stdout.split("\n").slice(0, -1), outputs);
});
