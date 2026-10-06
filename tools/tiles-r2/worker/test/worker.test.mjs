// run with: npm test (node --test); uses a mocked r2 bucket and caches.default
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { zxyToTileId } from "pmtiles";

// minimal pmtiles v3 archive: uncompressed root directory, one tile per entry
function buildArchive(tiles) {
  const entries = tiles
    .map((t) => ({ id: zxyToTileId(t.z, t.x, t.y), data: t.data }))
    .sort((a, b) => a.id - b.id);
  const varint = (n) => {
    const out = [];
    while (n >= 0x80) {
      out.push((n % 0x80) | 0x80);
      n = Math.floor(n / 0x80);
    }
    out.push(n);
    return out;
  };
  const dir = [...varint(entries.length)];
  let last = 0;
  for (const e of entries) {
    dir.push(...varint(e.id - last));
    last = e.id;
  }
  for (const _ of entries) dir.push(...varint(1)); // run length
  for (const e of entries) dir.push(...varint(e.data.length));
  let offset = 0;
  for (const e of entries) {
    dir.push(...varint(offset === 0 ? 1 : 0)); // 0 means "contiguous with the previous tile"
    offset += e.data.length;
  }
  const dataBytes = entries.flatMap((e) => [...e.data]);
  const rootOffset = 127;
  const metaOffset = rootOffset + dir.length;
  const metadata = [...new TextEncoder().encode("{}")];
  const dataOffset = metaOffset + metadata.length;
  const header = new DataView(new ArrayBuffer(127));
  [..."PMTiles"].forEach((c, i) => header.setUint8(i, c.charCodeAt(0)));
  header.setUint8(7, 3);
  const u64 = (pos, v) => header.setBigUint64(pos, BigInt(v), true);
  u64(8, rootOffset);
  u64(16, dir.length);
  u64(24, metaOffset);
  u64(32, metadata.length);
  u64(40, 0); // leaf directories
  u64(48, 0);
  u64(56, dataOffset);
  u64(64, dataBytes.length);
  u64(72, entries.length);
  u64(80, entries.length);
  u64(88, entries.length);
  header.setUint8(96, 1); // clustered
  header.setUint8(97, 1); // internal compression none
  header.setUint8(98, 1); // tile compression none
  header.setUint8(99, 1); // mvt
  header.setUint8(100, 0);
  header.setUint8(101, 14);
  header.setInt32(102, -1800000000, true);
  header.setInt32(106, -850000000, true);
  header.setInt32(110, 1800000000, true);
  header.setInt32(114, 850000000, true);
  header.setUint8(118, 0);
  const bytes = new Uint8Array(dataOffset + dataBytes.length);
  bytes.set(new Uint8Array(header.buffer), 0);
  bytes.set(dir, rootOffset);
  bytes.set(metadata, metaOffset);
  bytes.set(dataBytes, dataOffset);
  return bytes;
}

// r2 stand-in: get(key, { range }) returns an object with etag and arrayBuffer
function mockBucket(objects) {
  const calls = [];
  return {
    calls,
    async get(key, opts) {
      calls.push(key);
      const o = objects[key];
      if (!o) return null;
      const { offset, length } = opts.range;
      const slice = o.bytes.slice(offset, offset + length);
      return { etag: o.etag, arrayBuffer: async () => slice.buffer };
    },
  };
}

// caches.default stand-in that, like the edge, adds Age to what it returns
function installCache() {
  const store = new Map();
  const cache = {
    puts: 0,
    async match(req) {
      const hit = store.get(req.url);
      if (!hit) return undefined;
      const headers = new Headers(hit.headers);
      headers.set("Age", "4000");
      return new Response(hit.body, { status: hit.status, headers });
    },
    async put(req, res) {
      cache.puts += 1;
      store.set(req.url, { status: res.status, headers: new Headers(res.headers), body: res.body ? await res.arrayBuffer() : null });
    },
  };
  globalThis.caches = { default: cache };
  return cache;
}

const TILE = new Uint8Array([1, 2, 3, 4, 5]);
// z5/31/20 is absent from the archive, so it answers 204
const ARCHIVE = buildArchive([
  { z: 5, x: 31, y: 19, data: TILE },
]);

let worker;
let cache;
let bucket;
let waits;
const ctx = { waitUntil: (p) => waits.push(p) };

async function get(path, headers = {}) {
  waits = [];
  const res = await worker.fetch(new Request(`https://tiles.test${path}`, { headers }), { BUCKET: bucket }, ctx);
  await Promise.all(waits);
  return res;
}

beforeEach(async () => {
  cache = installCache();
  bucket = mockBucket({
    "places-overview.pmtiles": { bytes: ARCHIVE, etag: "aaa111" },
    "places-overview-v2-20261006.pmtiles": { bytes: ARCHIVE, etag: "bbb222" },
    "ra-dots-de-2026-10-06.pmtiles": { bytes: ARCHIVE, etag: "ccc333" },
  });
  // fresh module per test so the per-isolate archive map starts empty
  worker = (await import(`../src/index.js?t=${Math.random()}`)).default;
});

describe("tile worker", () => {
  it("serves unversioned names with today's headers and a strong etag", async () => {
    const res = await get("/places-overview/5/31/19");
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Cache-Control"), "public, max-age=3600, s-maxage=604800");
    assert.equal(res.headers.get("ETag"), '"aaa111-5-31-19"');
    assert.deepEqual([...new Uint8Array(await res.arrayBuffer())], [...TILE]);
  });

  it("serves versioned names as immutable", async () => {
    for (const name of ["places-overview-v2-20261006", "ra-dots-de-2026-10-06"]) {
      const res = await get(`/${name}/5/31/19`);
      assert.equal(res.status, 200, name);
      assert.equal(res.headers.get("Cache-Control"), "public, max-age=31536000, immutable");
      assert.match(res.headers.get("ETag"), /^"[a-z0-9]+-5-31-19"$/);
    }
  });

  it("returns 404 for a missing versioned archive and does not cache it", async () => {
    const res = await get("/places-overview-v2-20270101/5/31/19");
    assert.equal(res.status, 404);
    assert.equal(res.headers.get("Cache-Control"), "no-store");
    assert.equal(cache.puts, 0);
  });

  it("rejects names that match neither the allow-list nor the version pattern", async () => {
    for (const name of ["places-v2", "ra-dots-de", "ra-dots-deu-20261006", "places-overview-v2-latest", "other-20261006"]) {
      const res = await get(`/${name}/5/31/19`);
      assert.equal(res.status, 404, name);
    }
    assert.equal(bucket.calls.length, 0, "no r2 read for rejected names");
  });

  it("strips Age from responses served from the cache", async () => {
    await get("/places-overview/5/31/19");
    const res = await get("/places-overview/5/31/19");
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Age"), null);
    assert.equal(res.headers.get("ETag"), '"aaa111-5-31-19"');
  });

  it("answers If-None-Match with 304 on a miss and on a hit, keeping CORS", async () => {
    const origin = "https://religionmap.org";
    const etag = '"aaa111-5-31-19"';
    const miss = await get("/places-overview/5/31/19", { "If-None-Match": etag, Origin: origin });
    assert.equal(miss.status, 304);
    assert.equal(miss.headers.get("ETag"), etag);
    assert.equal(miss.headers.get("Access-Control-Allow-Origin"), origin);
    assert.equal(miss.headers.get("Age"), null);
    const hit = await get("/places-overview/5/31/19", { "If-None-Match": `W/${etag}, "other"`, Origin: origin });
    assert.equal(hit.status, 304);
    assert.equal(hit.headers.get("Access-Control-Allow-Origin"), origin);
    assert.equal(hit.headers.get("Cache-Control"), "public, max-age=3600, s-maxage=604800");
    const star = await get("/places-overview/5/31/19", { "If-None-Match": "*" });
    assert.equal(star.status, 304);
    const stale = await get("/places-overview/5/31/19", { "If-None-Match": '"old-5-31-19"' });
    assert.equal(stale.status, 200);
  });

  it("changes the etag when the archive changes", async () => {
    const before = (await get("/places-overview/5/31/19")).headers.get("ETag");
    bucket = mockBucket({ "places-overview.pmtiles": { bytes: ARCHIVE, etag: "zzz999" } });
    worker = (await import(`../src/index.js?t=${Math.random()}`)).default;
    cache = installCache();
    const after = (await get("/places-overview/5/31/19")).headers.get("ETag");
    assert.notEqual(before, after);
  });

  it("caches 204 empty tiles with the same headers as 200s", async () => {
    const first = await get("/places-overview/5/31/20", { Origin: "https://religionmap.org" });
    assert.equal(first.status, 204);
    assert.equal(first.headers.get("Cache-Control"), "public, max-age=3600, s-maxage=604800");
    assert.equal(first.headers.get("Access-Control-Allow-Origin"), "https://religionmap.org");
    assert.equal(cache.puts, 1);
    const reads = bucket.calls.length;
    const second = await get("/places-overview/5/31/20");
    assert.equal(second.status, 204);
    assert.equal(second.headers.get("Age"), null);
    assert.equal(second.headers.get("X-Tile-Empty"), null, "internal marker never leaves the worker");
    assert.equal(bucket.calls.length, reads, "second 204 comes from the cache, not r2");
    const revalidated = await get("/places-overview/5/31/20", { "If-None-Match": first.headers.get("ETag") });
    assert.equal(revalidated.status, 304);
  });

  it("caches a 204 for a tile absent from the archive", async () => {
    const res = await get("/places-overview-v2-20261006/6/1/1");
    assert.equal(res.status, 204);
    assert.equal(res.headers.get("Cache-Control"), "public, max-age=31536000, immutable");
    assert.equal(cache.puts, 1);
  });

  it("still serves the tile when the cache put rejects", async () => {
    cache.put = async () => {
      throw new Error("not cacheable");
    };
    const res = await get("/places-overview/5/31/20");
    assert.equal(res.status, 204);
  });

  it("keeps CORS and Vary on 200 for an allowed origin only", async () => {
    const ok = await get("/places-overview/5/31/19", { Origin: "https://religionmap.org" });
    assert.equal(ok.headers.get("Access-Control-Allow-Origin"), "https://religionmap.org");
    assert.equal(ok.headers.get("Vary"), "Origin");
    const bad = await get("/places-overview/5/31/19", { Origin: "https://example.com" });
    assert.equal(bad.headers.get("Access-Control-Allow-Origin"), null);
  });
});
