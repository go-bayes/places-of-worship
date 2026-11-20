// run with Node from any directory. Keeps the original point commands,
// feature order, identifiers and scalar encodings while rebuilding the tags.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { ownershipProperties } from "../../../shared/tile-ownership.mjs";
import { decodeMvtPoints } from "../mvt-points.js";

const allowed = new Set([...ownershipProperties, "start_date"]);
const directory = new URL("./", import.meta.url);

function readVarint(bytes, offset) {
  let value = 0n;
  for (let shift = 0n; shift <= 63n && offset < bytes.length; shift += 7n) {
    const byte = bytes[offset++];
    value |= BigInt(byte & 127) << shift;
    if (byte < 128) return [Number(value), offset];
  }
  throw new Error("Invalid protobuf varint");
}

function* fields(bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    const start = offset;
    const [tag, valueStart] = readVarint(bytes, offset);
    offset = valueStart;
    let payload;
    if ((tag & 7) === 2) {
      const [length, dataStart] = readVarint(bytes, offset);
      offset = dataStart + length;
      payload = bytes.subarray(dataStart, offset);
    } else {
      assert.equal(tag & 7, 0);
      [, offset] = readVarint(bytes, offset);
    }
    assert.ok(offset <= bytes.length, "truncated protobuf");
    yield { tag, payload, encoded: bytes.subarray(start, offset) };
  }
}

function writeVarint(value) {
  const bytes = [];
  while (value >= 128) {
    bytes.push((value % 128) + 128);
    value = Math.floor(value / 128);
  }
  return Buffer.from([...bytes, value]);
}

function message(tag, payload) {
  return Buffer.concat([writeVarint(tag), writeVarint(payload.length), payload]);
}

function remap(index, indexes) {
  if (!indexes.has(index)) indexes.set(index, indexes.size);
  return indexes.get(index);
}

function minimiseTile(bytes) {
  const layers = [...fields(bytes)];
  assert.equal(layers.length, 1);
  assert.equal(layers[0].tag, 26);
  const layer = [...fields(layers[0].payload)];
  assert.equal(layer.find(({ tag }) => tag === 10)?.payload.toString(), "places");
  const keys = layer.filter(({ tag }) => tag === 26);
  const values = layer.filter(({ tag }) => tag === 34);
  const usedKeys = new Map();
  const usedValues = new Map();
  const features = layer.filter(({ tag }) => tag === 18).map(({ payload }) => {
    const output = [];
    const tags = [];
    for (const field of fields(payload)) {
      if (field.tag === 16) tags.push(readVarint(field.encoded, 1)[0]);
      else if (field.tag === 18) {
        for (let offset = 0; offset < field.payload.length;) {
          const [index, next] = readVarint(field.payload, offset);
          tags.push(index);
          offset = next;
        }
      } else if ([8, 24, 32, 34].includes(field.tag)) output.push(field.encoded);
    }
    assert.equal(tags.length % 2, 0);
    const indices = [];
    for (let i = 0; i < tags.length; i += 2) {
      const [key, value] = [tags[i], tags[i + 1]];
      assert.ok(keys[key] && values[value], "invalid property index");
      if (allowed.has(keys[key].payload.toString())) {
        indices.push(remap(key, usedKeys), remap(value, usedValues));
      }
    }
    if (indices.length) output.push(message(18, Buffer.concat(indices.map(writeVarint))));
    return message(18, Buffer.concat(output));
  });
  return message(26, Buffer.concat([
    ...layer.filter(({ tag }) => [10, 40, 120].includes(tag)).map(({ encoded }) => encoded),
    ...features,
    ...[...usedKeys.keys()].map((index) => keys[index].encoded),
    ...[...usedValues.keys()].map((index) => values[index].encoded)
  ]));
}

const fixtures = (await readdir(directory)).filter((name) => /^wellington-z12-\d+-\d+\.pbf$/.test(name)).sort();
assert.equal(fixtures.length, 4);
for (const name of fixtures) {
  const url = new URL(name, directory);
  const [, z, x, y] = name.match(/^wellington-z(\d+)-(\d+)-(\d+)\.pbf$/).map(Number);
  const tile = { z, x, y };
  const original = await readFile(url);
  const minimised = minimiseTile(original);
  const decode = (bytes) => decodeMvtPoints(Uint8Array.from(bytes).buffer, tile, "places", { requirePoints: true });
  const before = decode(original);
  const after = decode(minimised);
  const expected = before.points.map(({ properties, ...point }) => ({
    ...point, properties: Object.fromEntries(Object.entries(properties).filter(([key]) => allowed.has(key)))
  }));
  assert.equal(after.foundLayer, true);
  assert.deepEqual(after.points, expected);
  await writeFile(url, minimised);
  const hash = createHash("sha256").update(minimised).digest("hex");
  console.log(`${name}  ${hash}  ${after.points.length} features`);
}
