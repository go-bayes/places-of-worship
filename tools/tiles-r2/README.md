# tiles-r2

Serving and upload tooling for the map tiles, migrated to Cloudflare R2 on 2026-07-22.

- `worker/` — the `pow-tiles` Cloudflare Worker: serves PMTiles range reads from the `pow-tiles` R2 bucket with edge caching, routed at `tiles.placemap.org`. Deploy with `wrangler deploy` from `worker/`.
- `upload_r2.py` — uploads PMTiles archives to the bucket via the S3 multipart API; requires `CLOUDFLARE_API_TOKEN` in the environment (the S3 secret is derived from it).

The tile archives themselves (`places.pmtiles`, `places-overview.pmtiles`, `buildings.pmtiles`, `nz-polygons.pmtiles`, plus the mbtiles intermediates they were converted from) are deliberately untracked: the live copies are in R2, and local rollback copies were moved to `~/tiles-archive-2026-07/tiles-migration/` when this tooling was rescued from the untracked `.tiles-migration/` staging directory on 2026-08-14.

## v2 tile build (2026-10-07)

`build_tiles_v2.py` rebuilds the public overview tier and the per-country RA dot archives from the live `places.mbtiles`, because the original `all_places.ndjson` no longer exists. It is a Python script run with `uv` (its dependencies are declared inline), and it calls `tippecanoe` v2.79 or later. `run_tiles_v2.sh` runs the stages in order and logs to `<work>/run.log`; run it on a machine with tippecanoe (green) in a detached session:

```sh
tmux new -d -s tiles-v2 'caffeinate -is tools/tiles-r2/run_tiles_v2.sh'
```

Nothing in it writes to R2, and the source archive is opened read-only. The archives it produces are untracked, as above; the manifest, validation report and input statistics are tracked in `manifests/`.

Stages:

1. `extract` decodes every feature of `places.mbtiles` at zoom 10 (coordinates precise to about 10 m) and writes `slim.ndjson` (sorted, so reruns are identical) and one NDJSON file per country. The source has no unique key (701,349 features carry no `osm_id`, `osm_type` or `id`, and five OSM keys occur twice at identical coordinates), so tile-buffer duplicates are removed geometrically: a feature is kept from the tile whose proper area holds it, and far-edge points that no tile holds are added, counted with multiplicity. The count must equal the source's tilestats count of 2,072,349, and the attribute multiset must equal the one extracted at an independent zoom (`--audit-zoom`, default 6), or the stage stops with exit code 3. It records the source's byte hash and metadata.
2. `build` runs tippecanoe. The overview is `places-overview-v2-20260722.pmtiles`, layer `places_overview`, with `religion`, `denomination`, `name`, `osm_id`, `osm_type` and `country_code` (`name:en` is in neither the attributes nor `tags_raw` of any feature, so it is omitted). It is joined with `tile-join -pk` from z2-5 (`-Z2 -z5 --drop-fraction-as-needed -M 250000`) and from z0 and z1, each a seeded sample stratified by religion at one fraction, adjusted until the largest tile is near the 250,000-byte cap; the briefed flags alone fail the religion-share criterion at z0 and z1. Each country gets `ra-dots-<cc>-20260722.pmtiles`, layer `places_overview` (the layer `unvalidated-places.js` reads for its overview tier), `-Z3 -z7 -r1 --no-feature-limit --no-tile-size-limit`, with the six properties the RA hit test and popups read (`name`, `osm_id`, `osm_type`, `religion`, `denomination`, `country_code`). Output is byte-reproducible for a given output path (tippecanoe records the path in the archive metadata).
3. `validate` checks, for every country and every zoom 3 to 7, that osm keys are present in some tile and not in excess, and at z7 that the point count, osm-key multiplicities and religion composition are exact; it also checks the overview's z0 tile, maximum tile bytes per zoom, religion shares against the input at z0 to z5, attributes and layer names, and compares sample tiles with the live overview. It writes `validation-report.json`. A problem exits with code 5 and an unmet acceptance criterion (a religion share more than 0.3 points from the input) with code 6; neither writes a manifest.
4. `manifest` writes the data manifest (`schemas/data-manifest.schema.json`) with SHA-256 digests, feature counts, the source archive's hash and tilestats, the tippecanoe version and the commands. The version identity is a digest of the output hashes and the build parameters, including the routing mode, and the files are named with it (`tiles-v2-<snapshot>-<version>.manifest.json`); `--supersedes` links a manifest to the one it replaces. Output paths on green are recorded as caches. `record_uploads` adds the verified R2 objects.

By default a place without a valid `country_code` is routed by its `country` attribute (`--country-routing fallback`), so every place is in a per-country archive (ruling of 2026-09-04); in the source, `country_code` exists only on the 1,371,000 features that carry an OSM key, and the other 701,349 carry only `country`. `--country-routing strict` (environment variable `EXTRA`) routes by `country_code` alone and leaves those places out. The validation report gives counts and sizes.

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
