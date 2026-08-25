// serves z/x/y vector tiles straight from pmtiles archives in r2, preserving the
// url shape martin used (/{tileset}/{z}/{x}/{y}), so the frontend needs no change
import { PMTiles } from "pmtiles";

const TILESETS = new Set(["places", "places-overview", "buildings", "nz-polygons"]);

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

// range reads against the r2 object; pmtiles fetches only the byte spans it needs
class R2Source {
  constructor(bucket, key) {
    this.bucket = bucket;
    this.key = key;
  }
  getKey() {
    return this.key;
  }
  async getBytes(offset, length) {
    const obj = await this.bucket.get(this.key, { range: { offset, length } });
    if (!obj) throw new Error(`archive missing: ${this.key}`);
    return { data: await obj.arrayBuffer() };
  }
}

// cache archive handles per isolate so directory lookups amortise across requests
const archives = new Map();
function archive(env, name) {
  if (!archives.has(name)) {
    archives.set(name, new PMTiles(new R2Source(env.BUCKET, `${name}.pmtiles`)));
  }
  return archives.get(name);
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
    if (!m || !TILESETS.has(m[1])) {
      return withCors(new Response("not found", { status: 404 }), request);
    }

    // edge-cache tiles ourselves: workers run in front of the zone cache, so the
    // cache api is what keeps repeat requests off r2
    const cacheKey = new Request(`https://${url.hostname}${url.pathname}`);
    const cached = await caches.default.match(cacheKey);
    if (cached) return withCors(cached, request);

    const [, name, z, x, y] = m;
    let tile;
    try {
      tile = await archive(env, name).getZxy(Number(z), Number(x), Number(y));
    } catch (e) {
      return withCors(new Response(`tile error: ${e.message}`, { status: 500 }), request);
    }

    // martin answered empty tiles with 204; the frontend expects that shape
    if (!tile || !tile.data || tile.data.byteLength === 0) {
      return withCors(new Response(null, { status: 204, headers: { "Cache-Control": "public, max-age=3600" } }), request);
    }

    const response = new Response(tile.data, {
      headers: {
        "Content-Type": "application/x-protobuf",
        // browsers hold tiles an hour; the edge holds them a week (purge on data rebuild)
        "Cache-Control": "public, max-age=3600, s-maxage=604800",
        "X-Served-By": "pow-tiles-worker",
      },
    });
    ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
    return withCors(response, request);
  },
};
