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
