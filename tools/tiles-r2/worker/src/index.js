// serves z/x/y vector tiles straight from pmtiles archives in r2, preserving the
// url shape martin used (/{tileset}/{z}/{x}/{y}), so the frontend needs no change
import { PMTiles } from "pmtiles";

const TILESETS = new Set(["places", "places-overview", "buildings", "nz-polygons"]);

// versioned tilesets are immutable: the snapshot is part of the name and a key is
// never overwritten in r2, so tiles can be cached for a year. the pattern is explicit
// so a stray name cannot reach r2: places-overview-v2-<snapshot> and
// ra-dots-<cc>-<snapshot>, where <snapshot> is yyyymmdd or yyyy-mm-dd with an
// optional alphanumeric suffix (for example a rebuild letter)
const VERSIONED = /^(?:places-overview-v2|ra-dots-[a-z]{2})-(?:\d{8}|\d{4}-\d{2}-\d{2})(?:-[a-z0-9]+)?$/;

const CACHE_VERSIONED = "public, max-age=31536000, immutable";
// browsers hold unversioned tiles an hour; the edge holds them a week (purge on data rebuild)
const CACHE_UNVERSIONED = "public, max-age=3600, s-maxage=604800";

// internal header on cached empty tiles; removed before a response leaves the worker
const EMPTY_MARKER = "X-Tile-Empty";

const ALLOWED_ORIGINS = new Set([
  "https://religionmap.org",
  "https://www.religionmap.org",
  // retired domains: they 301 to religionmap.org, but a cached page may still
  // request tiles from them during the redirect window, so keep them allowed
  "https://placesmap.org",
  "https://powmap.org",
  "https://go-bayes.github.io",
  "http://localhost:8000",
]);

class ArchiveMissingError extends Error {}

// range reads against the r2 object; pmtiles fetches only the byte spans it needs
class R2Source {
  constructor(bucket, key) {
    this.bucket = bucket;
    this.key = key;
    // etag of the r2 object behind the latest range read, used to build tile etags
    this.etag = null;
  }
  getKey() {
    return this.key;
  }
  async getBytes(offset, length) {
    const obj = await this.bucket.get(this.key, { range: { offset, length } });
    if (!obj) throw new ArchiveMissingError(`archive missing: ${this.key}`);
    if (obj.etag) this.etag = obj.etag;
    return { data: await obj.arrayBuffer() };
  }
}

// cache archive handles per isolate so directory lookups amortise across requests
const archives = new Map();
function archive(env, name) {
  if (!archives.has(name)) {
    const source = new R2Source(env.BUCKET, `${name}.pmtiles`);
    archives.set(name, { source, pmtiles: new PMTiles(source) });
  }
  return archives.get(name);
}

// strong etag from the archive's r2 etag plus z/x/y, without hashing the body. a
// versioned key is never overwritten, so its name stands in if r2 reports no etag
function tileEtag(archiveEtag, name, z, x, y) {
  return `"${archiveEtag || name}-${z}-${x}-${y}"`;
}

// If-None-Match is a comma-separated list or *, compared weakly (RFC 9110 section 13.1.2)
function etagMatches(request, etag) {
  const header = request.headers.get("If-None-Match");
  if (!header || !etag) return false;
  if (header.trim() === "*") return true;
  const bare = (t) => t.trim().replace(/^W\//, "");
  return header.split(",").some((t) => bare(t) === etag);
}

// cors is attached per request, after cache lookup, so cached bodies stay origin-neutral
function withCors(response, request) {
  const origin = request.headers.get("Origin");
  const headers = new Headers(response.headers);
  headers.set("Vary", "Origin");
  if (origin && ALLOWED_ORIGINS.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return new Response(response.body, { status: response.status, headers });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return withCors(
        new Response(null, { headers: { "Access-Control-Allow-Methods": "GET", "Access-Control-Max-Age": "86400" } }),
        request
      );
    }
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/([a-z0-9-]+)\/(\d+)\/(\d+)\/(\d+)(?:\.(?:pbf|mvt))?$/);
    const versioned = m ? VERSIONED.test(m[1]) : false;
    if (!m || !(versioned || TILESETS.has(m[1]))) {
      return withCors(new Response("not found", { status: 404 }), request);
    }
    const [, name, z, x, y] = m;
    const cacheControl = versioned ? CACHE_VERSIONED : CACHE_UNVERSIONED;

    // a 304 repeats the validator and cache headers so the browser extends freshness
    const notModified = (etag) =>
      withCors(new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": cacheControl } }), request);

    // edge-cache tiles ourselves: workers run in front of the zone cache, so the
    // cache api is what keeps repeat requests off r2
    const cacheKey = new Request(`https://${url.hostname}${url.pathname}`);
    const cached = await caches.default.match(cacheKey);
    if (cached) {
      const cachedEtag = cached.headers.get("ETag");
      if (etagMatches(request, cachedEtag)) return notModified(cachedEtag);
      // Age counts time since the edge stored the tile; a browser that adds it to
      // max-age treats a tile it has just received as already stale
      const headers = new Headers(cached.headers);
      headers.delete("Age");
      if (headers.has(EMPTY_MARKER)) {
        headers.delete(EMPTY_MARKER);
        return withCors(new Response(null, { status: 204, headers }), request);
      }
      return withCors(new Response(cached.body, { status: cached.status, headers }), request);
    }

    let tile;
    let etag;
    try {
      const { source, pmtiles } = archive(env, name);
      tile = await pmtiles.getZxy(Number(z), Number(x), Number(y));
      etag = tileEtag(source.etag, name, z, x, y);
    } catch (e) {
      // drop the handle so a missing or failed archive is retried and names do not accumulate
      archives.delete(name);
      if (e instanceof ArchiveMissingError) {
        return withCors(new Response("not found", { status: 404, headers: { "Cache-Control": "no-store" } }), request);
      }
      return withCors(new Response(`tile error: ${e.message}`, { status: 500 }), request);
    }

    // martin answered empty tiles with 204; the frontend expects that shape. the 204
    // is cached like a 200 because the global pages request many that are always empty
    const empty = !tile || !tile.data || tile.data.byteLength === 0;
    const response = empty
      ? new Response(null, { status: 204, headers: { "Cache-Control": cacheControl, ETag: etag } })
      : new Response(tile.data, {
          headers: {
            "Content-Type": "application/x-protobuf",
            "Cache-Control": cacheControl,
            ETag: etag,
            "X-Served-By": "pow-tiles-worker",
          },
        });
    // the edge does not reliably store a 204 through the cache api, so an empty tile
    // is stored as a bodiless 200 carrying a marker and turned back into a 204 on a hit
    let stored = response.clone();
    if (empty) {
      const headers = new Headers(response.headers);
      headers.set(EMPTY_MARKER, "1");
      stored = new Response(null, { status: 200, headers });
    }
    ctx.waitUntil(
      Promise.resolve(caches.default.put(cacheKey, stored)).catch((e) =>
        console.warn(`cache put failed: ${e.message}`)
      )
    );
    if (etagMatches(request, etag)) return notModified(etag);
    return withCors(response, request);
  },
};
