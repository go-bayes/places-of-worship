import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync as nodeGunzip } from "node:zlib";
import {
  BUNDLE_CODEC,
  FFLATE_VERSION,
  codecId,
  gzipBundleFile,
  gunzipBundleFile,
  sha256Hex,
  storedObjectKey,
  utf8Bytes,
  verifyStoredFile,
} from "./bundleCodec.ts";

const repoRoot = new URL("../../", import.meta.url);
const sampleText = `${JSON.stringify({ task_id: "task_1", note: "Māori place name, ✓ and   kept" })}\n`.repeat(200);

function hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

test("the codec version is pinned exactly in package.json and matches the installed fflate", () => {
  const pkg = JSON.parse(fs.readFileSync(new URL("package.json", repoRoot), "utf8"));
  assert.equal(pkg.dependencies.fflate, FFLATE_VERSION, "package.json must pin fflate exactly, with no range");
  const installed = JSON.parse(fs.readFileSync(new URL("node_modules/fflate/package.json", repoRoot), "utf8"));
  assert.equal(installed.version, FFLATE_VERSION);
  assert.deepEqual(BUNDLE_CODEC, { name: "fflate", version: FFLATE_VERSION, level: 6, header: { mtime: 0, filename: false } });
  assert.equal(codecId(BUNDLE_CODEC), `fflate-${FFLATE_VERSION}-l6`);
});

test("the gzip header is fixed: mtime 0, no filename or comment flag, xfl 0 at level 6, os byte 3", () => {
  const gz = gzipBundleFile(utf8Bytes(sampleText));
  assert.deepEqual([...gz.subarray(0, 10)], [0x1f, 0x8b, 0x08, 0x00, 0, 0, 0, 0, 0x00, 0x03]);
});

test("one plain file under one codec gives one stored byte sequence, and any gzip reader restores the plain bytes", () => {
  const plain = utf8Bytes(sampleText);
  const first = gzipBundleFile(plain);
  const originalNow = Date.now;
  try {
    // a different clock must not reach the header
    Date.now = () => 4_102_444_800_000;
    const second = gzipBundleFile(plain);
    assert.equal(hex(second), hex(first));
  } finally {
    Date.now = originalNow;
  }
  assert.ok(first.length < plain.length / 5, "jsonl of repeated rows should compress well");
  assert.equal(hex(gunzipBundleFile(first)), hex(plain));
  // the stored bytes are plain gzip: the platform's own reader agrees
  assert.equal(hex(nodeGunzip(first)), hex(plain));
  // an empty file still stores (every bundle carries empty jsonl files)
  const empty = gzipBundleFile(new Uint8Array(0));
  assert.equal(gunzipBundleFile(empty).length, 0);
});

test("the object key names the plain hash and the codec id together", () => {
  const plainHash = hex(utf8Bytes(sampleText));
  assert.equal(storedObjectKey(plainHash, BUNDLE_CODEC), `objects/sha256/${plainHash}/fflate-${FFLATE_VERSION}-l6.gz`);
  const other = { ...BUNDLE_CODEC, version: "9.9.9" };
  assert.notEqual(storedObjectKey(plainHash, other), storedObjectKey(plainHash, BUNDLE_CODEC));
  assert.throws(() => gzipBundleFile(utf8Bytes("x"), other), /Unsupported bundle codec fflate-9.9.9-l6/);
});

test("verifyStoredFile checks all four values and names the one that fails", async () => {
  const plain = utf8Bytes(sampleText);
  const stored = gzipBundleFile(plain);
  const expected = {
    sha256: await sha256Hex(plain),
    byte_length: plain.length,
    stored_sha256: await sha256Hex(stored),
    stored_byte_length: stored.length,
  };
  assert.equal(hex(await verifyStoredFile("file", stored, expected)), hex(plain));

  // a flipped stored byte fails the stored hash before any decoding
  const flipped = new Uint8Array(stored);
  flipped[20] ^= 0xff;
  await assert.rejects(verifyStoredFile("tasks.jsonl", flipped, expected), /tasks\.jsonl: stored bytes failed verification/);

  // a stored length mismatch alone is caught
  await assert.rejects(
    verifyStoredFile("tasks.jsonl", stored, { ...expected, stored_byte_length: stored.length + 1 }),
    /stored bytes failed verification/,
  );

  // consistent stored values over different content fail the plain check
  const substitute = gzipBundleFile(utf8Bytes(sampleText.replace("task_1", "task_2")));
  await assert.rejects(
    verifyStoredFile("tasks.jsonl", substitute, {
      ...expected,
      stored_sha256: await sha256Hex(substitute),
      stored_byte_length: substitute.length,
    }),
    /tasks\.jsonl: decoded bytes failed verification/,
  );

  // bytes that are not gzip at all
  const notGzip = utf8Bytes("plain text, not gzip");
  await assert.rejects(
    verifyStoredFile("tasks.jsonl", notGzip, {
      ...expected,
      stored_sha256: await sha256Hex(notGzip),
      stored_byte_length: notGzip.length,
    }),
    /tasks\.jsonl: stored bytes do not decode as gzip/,
  );
});
