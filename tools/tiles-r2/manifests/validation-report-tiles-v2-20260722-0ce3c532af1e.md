# Tiles v2 validation report (input built 20260722, version 0ce3c532af1e)

Built on green on 2026-10-07 by `tools/tiles-r2/build_tiles_v2.py` (build commit 46f07ce8; audit and validation re-run on the unchanged archives with commit d260e9cd, see the note below), tippecanoe v2.79.0. Source: `places.mbtiles` in `~/tiles-archive-2026-07/tiles-migration/` on green, opened read-only (4,373,762,048 bytes, sha256 `eaa55c50971381cacca36ea08b1d4a68628b77d47a7156848cebb6a13eb2c406`, tilestats count 2,072,349). Sizes are stored (gzip) tile bytes; 1 KB is 1,000 bytes. This report supersedes `validation-report-tiles-v2-20260722.md`, which described the first build (strict country routing, overview built in one tippecanoe run); the first build was never uploaded.

**Re-run of 2026-10-07 (review round two).** The extraction audit and the RA validation were repaired and re-run against the existing archives in `~/tiles-build-2026-10-07/v3/work/out/` on green, without rebuilding. All 211 archive SHA-256 digests and sizes equal the earlier manifest (172,259,334 bytes) and the version digest is unchanged. The repaired checks are described in sections 1 and 3; the earlier audit paired coordinates only within attribute groups of one occurrence and the earlier validation reconciled counts only at z7.

Machine-readable record: `validation-report-tiles-v2-20260722-0ce3c532af1e.json`, with the manifest `tiles-v2-20260722-0ce3c532af1e.manifest.json` and `input-stats-tiles-v2-20260722-0ce3c532af1e.json`.

## Verdict

Status `passed_with_warnings`. No problem and no unmet criterion.

- The input is complete as a multiset of places: the attribute multiset at the extraction zoom (z10) equals the one at an independent zoom (z6), and within every attribute group, repeated or not, the coordinates pair one to one within 0.003 degrees (section 1).
- Every place is in a per-country archive: 210 archives, 2,072,349 points, exact at z7 in every archive by count, osm-key multiplicity and religion composition, and every place, keyed or keyless, has a decoded point within two grid units at every zoom from z3 to z7 (section 3). At z3 to z6, 93, 108, 236 and 507 places (35, 50, 88 and 188 of them keyless) lie only in a tile buffer.
- Religion shares at overview z0 to z5 are within 0.267 percentage points of the input (limit 0.3); z2 is the closest to the limit (section 2).
- Warnings: RA tiles above 1 MB at z3 to z6 (section 3), and the licence of the 701,349 places without an OSM key is not established (section 4).

## 1. Input

- Source zoom 10: 54,232 tiles, 2,073,286 feature rows decoded, including tile-buffer copies. A feature is kept from the tile whose proper area holds it (2,072,346). Three points on a tile's far edge that no tile held are added (their detail is in `extract-report.json` in the private work directory, not in this record). The total is 2,072,349, equal to the tilestats count.
- The rule counts multiplicities. For each point key the number added from far edges is the largest number of occurrences in any single tile's far edge minus the number already held in tile proper areas, so coincident points on an edge are not collapsed. East and west copies of the antimeridian (lon 180 and -180) are one meridian.
- **Cross-zoom audit.** The same procedure at z6 gives 2,072,349 features (none added from edges). The attribute multisets of the two zooms are equal: 1,667,423 distinct (osm type, osm id, name, religion, denomination, country code, country) keys, 30,098 of them occurring more than once (435,024 occurrences), with the same multiplicity at both zooms; 0 occurrences appear at one zoom only. Within every attribute group, of any size, the coordinates of the two zooms are paired one to one by a maximum bipartite matching with a tolerance of 0.003 degrees in each coordinate (longitude taken modulo 360, which covers source-zoom quantisation and the antimeridian): all 2,072,349 occurrences pair, 0 are unmatched. The earlier audit compared coordinates only for the 1,637,325 keys that occur once, so a place lost from a repeated group and replaced by a copy elsewhere could go unnoticed; `tools/tiles-r2/test_build_tiles_v2.py` holds that case as a regression test. The audit cannot tell apart two places of one attribute group that lie within 0.003 degrees of each other. The extraction stops if either test fails. The counts at higher source zooms (2,072,341 at z12 to 2,072,079 at z18 in the first report) are not used: the source loses points there.
- The brief's key, `osm_type` + `osm_id`, is not unique and does not exist for every feature. 1,371,000 features carry it and 701,349 do not. Those carry no `osm_id`, `osm_type`, `id`, `country_code`, `tags_raw` or `address`; they carry `country`, `name`, `religion` and `denomination`, and sometimes `building` or `amenity`. 5 osm keys occur twice at identical coordinates in the source itself, and the tilestats count includes both copies, so deduplicating by key would give a count below 2,072,349.
- `name:en` is in neither the attributes nor `tags_raw` of any feature. It is omitted.
- Every one of the 701,349 features without `country_code` has a valid two-letter `country`, covering 178 countries.
- The extraction order is sorted, so `slim.ndjson` and every archive are byte-reproducible: two builds in the same directory gave identical digests for all 211 archives. (An archive built under a different directory differs, because tippecanoe records its output path in the archive metadata.)

## 2. Public overview, `places-overview-v2-20260722.pmtiles`

The archive is 5,516,611 bytes (live archive: 308,496,321; 98.2% smaller), layer `places_overview`, zoom 0 to 5, attributes country_code, denomination, name, osm_id, osm_type, religion (the 701,349 features without an osm key lack osm_id, osm_type and country_code, as in the live tiles). Every tile is under the 250,000-byte cap, and the z0 tile decodes cleanly.

It is joined from three tippecanoe builds, because the briefed flags alone failed the religion-share criterion:

- z2 to z5: `-Z2 -z5 --drop-fraction-as-needed -M 250000`, as briefed.
- z0 and z1: a seeded (20260722) sample of the input, stratified by religion so that each religion keeps the same fraction, built with `-r1 --no-feature-limit --no-tile-size-limit`. The fraction is raised or lowered until the largest tile is between 215,000 and 245,000 bytes (z0 0.578%, z1 0.869%).

With `--drop-fraction-as-needed` alone the z1 shares differed from the input by 0.449 points (four tiles, a different fraction in each), and a z0-only run differed by 1.8 points, because the drop follows the spatial index. A uniform fraction avoids this. The cost is that z0 and z1 samples are drawn independently of the z2 sample, so a place shown at z1 need not be shown at z2.

| Zoom | Tiles | Max tile | Mean tile | Total | Points kept | Share of input |
|---|---|---|---|---|---|---|
| 0 | 1 | 227,561 | 227,561 | 227,561 | 11,965 | 0.58% |
| 1 | 4 | 228,355 | 93,201 | 372,804 | 18,011 | 0.87% |
| 2 | 12 | 209,060 | 37,766 | 453,193 | 21,695 | 1.05% |
| 3 | 37 | 214,616 | 19,503 | 721,625 | 33,483 | 1.62% |
| 4 | 117 | 217,010 | 7,667 | 897,013 | 41,222 | 1.99% |
| 5 | 327 | 219,212 | 8,680 | 2,838,326 | 138,992 | 6.71% |

Points kept are those inside tile proper areas.

**Religion shares** (percent of points kept, against the input), for the seven religions above 0.5% of the input. The criterion is a largest absolute difference of 0.3 percentage points at every zoom; validation fails the build if any zoom exceeds it.

| Zoom | christian | muslim | unknown | buddhist | hindu | shinto | jewish | Max abs difference (pp) |
|---|---|---|---|---|---|---|---|---|
| input | 61.74 | 14.55 | 10.38 | 6.88 | 2.56 | 2.44 | 0.55 | |
| 0 | 61.79 | 14.56 | 10.39 | 6.89 | 2.57 | 2.44 | 0.55 | 0.052 |
| 1 | 61.79 | 14.56 | 10.39 | 6.89 | 2.57 | 2.44 | 0.55 | 0.053 |
| 2 | 61.47 | 14.54 | 10.60 | 6.84 | 2.51 | 2.54 | 0.60 | 0.267 |
| 3 | 61.52 | 14.54 | 10.53 | 6.88 | 2.57 | 2.47 | 0.58 | 0.213 |
| 4 | 61.50 | 14.64 | 10.46 | 6.95 | 2.54 | 2.50 | 0.55 | 0.236 |
| 5 | 61.64 | 14.58 | 10.43 | 6.88 | 2.57 | 2.44 | 0.57 | 0.099 |

Z2 to z4 use per-tile drop fractions, so their deviation depends on tippecanoe's drop and is deterministic only for this tippecanoe version and input order; z2 has the least margin (0.267 against 0.3).

**Comparison with the live overview** (same z/x/y, stored bytes). Z0 to z3 cover every live tile; z4 and z5 are a random sample of 60 live tiles (seed 20260722). Every sampled tile exists in the new archive.

| Zoom | Tiles | Live bytes | New bytes | Reduction | Largest live tile |
|---|---|---|---|---|---|
| 0 | 1 | 46,977,363 | 227,561 | 99.5% | 46,977,363 |
| 1 | 4 | 51,792,891 | 372,804 | 99.3% | 32,101,317 |
| 2 | 12 | 51,365,272 | 453,193 | 99.1% | 25,108,961 |
| 3 | 37 | 53,179,264 | 721,625 | 98.6% | 18,758,670 |
| 4 | 60 | 37,766,870 | 596,588 | 98.4% | 16,360,847 |
| 5 | 60 | 14,651,745 | 739,839 | 95.0% | 4,771,078 |

The live z0 tile (46,977,363 bytes) is the one that returns HTTP 500 today.

## 3. Per-country RA dots, `ra-dots-<cc>-20260722.pmtiles`

210 archives (one per country in the `country_code` or, where that is absent, the `country` attribute), layer `places_overview`, zoom 3 to 7, `-r1 --no-feature-limit --no-tile-size-limit`, attributes name, osm_id, osm_type, religion, denomination and country_code. Total 166,742,723 bytes. Points expected 2,072,349; found at z7 2,072,349, with every archive exact by count, by osm-key multiplicity (0 occurrences short in any archive) and by religion composition. Validation reconciles every place at every zoom from z3 to z7. Each decoded point is placed on the zoom's integer tile grid (longitude modulo the world width). Within every attribute group, each expected place (from the per-country NDJSON the archive was built from, keyed or keyless) is paired one to one, by maximum bipartite matching, with a decoded point within two grid units, using tile-proper points where possible and a buffer point otherwise; buffer copies of one point in neighbouring tiles are counted once, by the largest number any one tile holds in a cluster. Result: 0 places missing from every tile, and 0 tile-proper points without an expected place, at every zoom, in every archive. The places held only in a tile buffer, which a tile-proper count misses, are 93 at z3, 108 at z4, 236 at z5 and 507 at z6 (largest at z6: US, 78), of which 35, 50, 88 and 188 have no osm key; at z7 there are none. Every osm key is present in some tile of its archive at every zoom (0 missing, 0 unexpected), and no tile-proper count exceeds its expected count. A point rounded onto a tile's far edge can sit only in the neighbour's buffer, where VectorGrid still draws it, so tile-proper counts fall short at the coarser zooms by those numbers. Whether VectorGrid draws every buffer-only point at a tile boundary has not been checked in a browser. Two places of one attribute group closer than two grid units cannot be told apart, so a buffer copy of one could stand for a lost neighbour; at z3 a grid unit is about 1.2 km at the equator. No archive holds a point whose `country_code` differs from its country. The overview is checked at every zoom 0 to 5 for tiles, features and finite religion shares (an empty zoom fails), and its header zooms must be 0 to 5.

Routing. The 701,349 places without a `country_code` are routed by their `country` attribute (Joseph's ruling of 2026-09-04 and the plan's item R1: every unreviewed place shows as an amber dot). Strict routing by `country_code` alone, built first, gave 33 archives and 1,371,000 points and left out all of Indonesia (87,083) and Brazil (56,093); it is available as `--country-routing strict` and is not the manifested set. The archives for places without a `country_code` still carry no `country_code`, `osm_id` or `osm_type`, so those places show but cannot be revised by OSM key.

| Country | Points | Archive bytes | Max tile z3 | z4 | z5 | z6 | z7 |
|---|---|---|---|---|---|---|---|
| US | 342,655 | 34,581,828 | 3,130,606 | 3,007,546 | 1,855,063 | 666,202 | 311,719 |
| DE | 135,242 | 11,848,307 | 2,131,584 | 2,187,849 | 1,324,726 | 1,177,878 | 410,830 |
| IT | 119,721 | 10,693,245 | 1,649,604 | 1,655,981 | 1,046,579 | 612,121 | 442,314 |
| JP | 108,829 | 9,268,071 | 1,269,854 | 1,271,173 | 1,287,696 | 1,038,936 | 544,547 |
| FR | 90,281 | 7,950,062 | 1,119,016 | 1,104,013 | 926,869 | 414,527 | 153,646 |
| ID | 87,083 | 3,585,742 | 504,048 | 333,859 | 333,926 | 270,387 | 162,988 |
| PL | 80,529 | 6,753,721 | 1,198,313 | 1,151,234 | 1,146,003 | 743,106 | 262,128 |
| IN | 73,869 | 7,540,498 | 1,356,750 | 1,086,892 | 521,475 | 518,712 | 503,880 |
| GB | 56,957 | 6,267,473 | 976,494 | 914,736 | 901,427 | 459,098 | 338,766 |
| BR | 56,093 | 2,881,645 | 268,162 | 195,248 | 201,621 | 111,625 | 73,369 |
| ES | 53,491 | 5,513,052 | 592,489 | 529,472 | 521,234 | 273,531 | 156,981 |
| TR | 45,395 | 1,859,934 | 249,517 | 263,386 | 160,776 | 132,072 | 54,164 |

The remaining 198 archives are in the machine-readable report.

**Tile sizes.** The flags set no tile size limit, so large countries produce large coarse tiles. Largest tile over all archives by zoom: z3 3,130,606 bytes, z4 3,007,546, z5 1,855,063, z6 1,177,878, z7 544,547. Tiles above 1 MB occur in 7 archives at z3 (US, DE, IT, IN, JP, PL, FR), 7 at z4 (the same seven), 5 at z5 (US, DE, JP, PL, IT) and 2 at z6 (DE, JP). The archives are fit for use only if the client requests no zoom below the one where its country's tiles are small, or sets a minimum zoom for these layers (plan item R2). Phone performance at these sizes has not been measured.

## 4. Gates that stay open

- **Licence.** `source.licence` is null and `licence_status` is `needs_review` for every file: the licence and attribution of the 701,349 places without an OSM key are not established. Uploading the archives to R2 does not serve them; the Worker does not route versioned names until it is deployed, and serving is a separate decision.
- **Source lineage.** The source archive's byte hash, size and metadata are recorded. Its original dataset links and retrieval date are not in the archive and are not known.
- **Durable copies.** The build output on green is a machine-local cache. The durable copy is the R2 object, recorded in the manifest after upload and verification.

## 5. Reproducing

Run `tools/tiles-r2/run_tiles_v2.sh` (see `tools/tiles-r2/README.md`); the stages stop with a non-zero exit code on a count mismatch (3), a failed build (4), a validation problem (5) or an unmet criterion (6). Commands, versions and digests are in the manifest.
