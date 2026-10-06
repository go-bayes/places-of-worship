# tiles-r2

Serving and upload tooling for the map tiles, migrated to Cloudflare R2 on 2026-07-22.

- `worker/` — the `pow-tiles` Cloudflare Worker: serves PMTiles range reads from the `pow-tiles` R2 bucket with edge caching, routed at `tiles.placemap.org`. Deploy with `wrangler deploy` from `worker/`.
- `upload_r2.py` — uploads PMTiles archives to the bucket via the S3 multipart API; requires `CLOUDFLARE_API_TOKEN` in the environment (the S3 secret is derived from it).

The tile archives themselves (`places.pmtiles`, `places-overview.pmtiles`, `buildings.pmtiles`, `nz-polygons.pmtiles`, plus the mbtiles intermediates they were converted from) are deliberately untracked: the live copies are in R2, and local rollback copies were moved to `~/tiles-archive-2026-07/tiles-migration/` when this tooling was rescued from the untracked `.tiles-migration/` staging directory on 2026-08-14.

## Worker caching and tileset names

The worker (`worker/src/index.js`) serves two kinds of tileset name.

- **Unversioned names** (`places`, `places-overview`, `buildings`, `nz-polygons`) are the live archives and are replaced in place on a data rebuild. Tiles are sent with `Cache-Control: public, max-age=3600, s-maxage=604800`, and the edge copy is purged after a rebuild.
- **Versioned names** are accepted by an explicit pattern: `places-overview-v2-<snapshot>` and `ra-dots-<cc>-<snapshot>`, where `<cc>` is a two-letter lower-case country code and `<snapshot>` is `yyyymmdd` or `yyyy-mm-dd`, optionally followed by `-<suffix>` in lower-case letters and digits (for example `ra-dots-de-2026-10-06` or `places-overview-v2-20261006-b`). Tiles are sent with `Cache-Control: public, max-age=31536000, immutable`. A name that matches neither the allow-list nor the pattern returns 404 without reading R2, and a matching name whose archive is absent returns 404 with `Cache-Control: no-store`.

**A versioned key must never be overwritten in R2.** Browsers and the edge hold its tiles for a year and are told they never change, so overwriting would leave old tiles in circulation that no purge can reach. A change of content takes a new snapshot name, and the frontend then points at the new name. The upload procedure for versioned archives must refuse when the key already exists (check with a `HEAD` or `list_objects_v2` before writing, and use a conditional write such as `If-None-Match: *`). `upload_r2.py` uploads only the four unversioned names listed in `FILES` and cannot write a versioned key; any script added for versioned archives has to carry this refusal.

Every tile response carries a strong `ETag` of the form `"<r2 object etag>-<z>-<x>-<y>"`, built from the archive's R2 etag without hashing the body (the versioned name stands in if R2 reports none). A request with a matching `If-None-Match` receives `304 Not Modified` with the `ETag`, `Cache-Control` and CORS headers. Empty tiles return `204` and are cached at the edge like 200s; because the Cache API may not retain a 204, the worker stores an empty tile as a bodiless 200 with an internal `X-Tile-Empty` header and restores the 204 on a hit. The worker removes `Age` from responses served from `caches.default` and restates `Date` as the current time, since a browser derives an apparent age from both and would otherwise treat a freshly delivered tile as stale. Every read after the header is conditional on the header's R2 etag, so replacing an unversioned archive makes the next read fail the precondition and PMTiles reloads the header and directories; the tile `ETag` is taken only when the header etag is the same before and after the read. Because a cached header or directory that reports a tile absent never reads R2, an edge miss for an unversioned name also calls `head` on the object and reloads the handle when its etag differs from the cached header's; versioned names skip this check. An edge entry without an `ETag` (stored by an earlier worker version) is treated as a miss and replaced.

### Tests

From `worker/`, run `npm ci` and then `npm test`. The tests (`worker/test/worker.test.mjs`) use a mocked R2 bucket, a mocked `caches.default` that adds `Age` and an old `Date` as the edge may, and a small PMTiles archive built in the test. They do not exercise Cloudflare's cache. `wrangler dev --local` simulates the Cache API, so confirm production behaviour on the production route after a deploy, as in the plan's verification row P1:

```sh
# twice; the second should show cf-cache-status: HIT, no age, immutable, an etag
curl -sS -D - -o /dev/null https://tiles.placemap.org/<versioned>/5/31/19
# revalidation should return 304 (use the etag from above)
curl -sS -D - -o /dev/null -H 'If-None-Match: <etag>' https://tiles.placemap.org/<versioned>/5/31/19
# twice on a tile that returns 204; the second should show cf-cache-status: HIT
curl -sS -D - -o /dev/null https://tiles.placemap.org/<versioned>/<z>/<x>/<y>
```

Local `wrangler dev` needs `--compatibility-date` at or before the date the installed workerd supports (wrangler 4.94.0 supports up to 2026-05-28, earlier than the 2026-07-01 in `wrangler.jsonc`); pass it on the command line rather than editing the config.
