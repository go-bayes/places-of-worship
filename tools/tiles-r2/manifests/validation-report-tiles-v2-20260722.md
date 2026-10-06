# Tiles v2 validation report (input built 20260722)

Built on green on 2026-10-07 by `tools/tiles-r2/build_tiles_v2.py` (commit 384b0dd6), tippecanoe v2.79.0. Source: `places.mbtiles` in `~/tiles-archive-2026-07/tiles-migration/` on green, opened read-only (tilestats count 2,072,349). Sizes are stored (gzip) tile bytes; 1 KB is 1,000 bytes.

## Verdict

- Structural checks pass: input count, per-country point counts at z7, osm-key presence at z3 and z7, layer names, attributes and the z0 tile.
- One criterion is not met: the religion share at overview z1 differs from the input by 0.449 percentage points (limit 0.3). Zooms 0, 2, 3, 4 and 5 are within 0.22 points.
- Routing the per-country archives by `country_code`, as the brief says, leaves 701,349 places (33.8% of the input) in no archive, because they carry no `country_code`. They do carry a `country` attribute. Section 4 gives the consequence and the measured alternative.

## 1. Input

- Source zoom 10: 54,232 tiles; 2,073,286 feature rows decoded, including tile-buffer copies.
- Deduplication: a feature is kept from the tile whose proper area holds it (2,072,346), and 3 points on a tile's far edge that no tile held were added. The total is 2,072,349, equal to the tilestats count. Counting features inside tile proper areas gives 2,072,349 at z6, 2,072,348 at z8, 2,072,346 at z10, 2,072,341 at z12, 2,072,328 at z14, 2,072,284 at z16 and 2,072,079 at z18, so the source archive itself loses points at higher zooms. Z10 with the edge rule is the finest zoom that gave a complete set.
- The brief's key, `osm_type` + `osm_id`, is not unique and does not exist for every feature. 1,371,000 features carry it and 701,349 do not. Those carry no `osm_id`, `osm_type`, `id`, `country_code`, `tags_raw` or `address`; they carry `country`, `name`, `religion` and `denomination`, and sometimes `building` or `amenity`. 5 osm keys occur twice at identical coordinates in the source itself (way/508963249, way/36687825, way/97448362, way/1319772698, way/30344850), and the tilestats count includes both copies, so deduplicating by key would give a count below 2,072,349. It was not used.
- `name:en` is in neither the attributes nor `tags_raw` of any feature. It is omitted.
- Features with no valid `country_code`: 701,349 (all absent; none malformed). Every one has a valid two-letter `country`, covering 178 countries.
- Religion shares in the input: christian 61.74%, muslim 14.55%, unknown 10.38%, buddhist 6.88%, hindu 2.56%, shinto 2.44%, jewish 0.55%.

## 2. Public overview, `places-overview-v2-20260722.pmtiles`

Flags: `-Z0 -z5 --drop-fraction-as-needed -M 250000 -l places_overview`. The archive is 5,442,685 bytes (live archive: 308,496,321). Layer `places_overview`; attributes country_code, denomination, name, osm_id, osm_type, religion (the 701,349 features without an osm key lack osm_id, osm_type and country_code, as in the live tiles). The z0 tile is 195,968 bytes and decodes cleanly. The archive is not byte-reproducible: tippecanoe's parallel read (`-P`) changes the feature order between runs, so a rebuild gives a different digest and a different, equally valid sample.

| Zoom | Tiles | Max tile | Mean tile | Total | Points kept | Share of input |
|---|---|---|---|---|---|---|
| 0 | 1 | 195,968 | 195,968 | 195,968 | 10,172 | 0.49% |
| 1 | 4 | 202,436 | 82,798 | 331,191 | 15,817 | 0.76% |
| 2 | 12 | 209,209 | 37,791 | 453,490 | 21,715 | 1.05% |
| 3 | 37 | 214,666 | 19,511 | 721,899 | 33,504 | 1.62% |
| 4 | 117 | 217,111 | 7,667 | 897,013 | 41,222 | 1.99% |
| 5 | 327 | 219,315 | 8,676 | 2,836,890 | 138,992 | 6.71% |

The cap of 250,000 bytes holds at every zoom (largest tile 219,315 bytes). Points kept are those inside tile proper areas.

**Religion shares** (percent of points kept, against the input), for the seven religions above 0.5% of the input.

| Zoom | christian | muslim | unknown | buddhist | hindu | shinto | jewish | Max abs difference (pp) |
|---|---|---|---|---|---|---|---|---|
| input | 61.74 | 14.55 | 10.38 | 6.88 | 2.56 | 2.44 | 0.55 | |
| 0 | 61.57 | 14.70 | 10.34 | 6.84 | 2.50 | 2.58 | 0.60 | 0.166 |
| 1 | 61.29 | 14.58 | 10.68 | 6.84 | 2.54 | 2.62 | 0.58 | 0.449 (over 0.3) |
| 2 | 61.57 | 14.50 | 10.55 | 6.83 | 2.52 | 2.53 | 0.59 | 0.177 |
| 3 | 61.55 | 14.52 | 10.52 | 6.87 | 2.58 | 2.47 | 0.58 | 0.186 |
| 4 | 61.52 | 14.62 | 10.47 | 6.92 | 2.55 | 2.51 | 0.55 | 0.214 |
| 5 | 61.65 | 14.57 | 10.44 | 6.88 | 2.57 | 2.44 | 0.57 | 0.090 |

Z1 is over the limit: Christian is 0.45 points under the input and unknown 0.30 over. A different fraction is dropped in each tile, so tiles over dense Christian areas lose more than tiles elsewhere, and z1 has four tiles. The effect is smaller at z2 to z5 (largest 0.21 points). The flags in the brief give no control over it.

**Comparison with the live overview** (same z/x/y, stored bytes). Z0 to z3 cover every live tile; z4 and z5 are a random sample of 60 live tiles (seed 20260722). Every sampled tile exists in the new archive.

| Zoom | Tiles | Live bytes | New bytes | Reduction | Largest live tile |
|---|---|---|---|---|---|
| 0 | 1 | 46,977,363 | 195,968 | 99.6% | 46,977,363 |
| 1 | 4 | 51,792,891 | 331,191 | 99.4% | 32,101,317 |
| 2 | 12 | 51,365,272 | 453,490 | 99.1% | 25,108,961 |
| 3 | 37 | 53,179,264 | 721,899 | 98.6% | 18,758,670 |
| 4 | 60 | 37,766,870 | 596,496 | 98.4% | 16,360,847 |
| 5 | 60 | 14,651,745 | 739,958 | 95.0% | 4,771,078 |

The live z0 tile (46,977,363 bytes) is the one that returns HTTP 500 today. The whole archive falls from 308,496,321 to 5,442,685 bytes (98.2% smaller).

## 3. Per-country RA dots, routed by `country_code` (the brief)

33 archives, layer `places_overview`, z3 to z7, `-r1 --no-feature-limit --no-tile-size-limit`, attributes name, osm_id, osm_type, religion, denomination and country_code. Total 129,763,364 bytes. Points expected 1,371,000; found at z7 1,371,000, exact in all 33 archives; every osm key is present at z3 and z7. At z3 the count inside tile proper areas is 58 points short in total (largest: US, 24), because z3 coordinates are coarse and a point rounded onto a tile's edge can sit only in the neighbour's buffer, where VectorGrid still draws it. No archive holds a point whose `country_code` differs from its country.

Places in no per-country archive: **701,349** (no `country_code`).

| Country | Points | Archive bytes | Max tile z3 | z4 | z5 | z6 | z7 |
|---|---|---|---|---|---|---|---|
| US | 342,655 | 34,581,897 | 3,130,652 | 3,007,573 | 1,855,061 | 666,213 | 311,708 |
| DE | 135,242 | 11,848,205 | 2,131,599 | 2,187,830 | 1,324,691 | 1,177,843 | 410,821 |
| IT | 119,721 | 10,693,422 | 1,649,600 | 1,656,105 | 1,046,588 | 612,116 | 442,320 |
| JP | 108,829 | 9,268,670 | 1,269,970 | 1,271,307 | 1,287,793 | 1,039,018 | 544,505 |
| FR | 90,281 | 7,950,113 | 1,119,028 | 1,104,043 | 926,877 | 414,535 | 153,647 |
| PL | 80,529 | 6,753,828 | 1,198,321 | 1,151,212 | 1,146,014 | 743,077 | 262,166 |
| IN | 73,869 | 7,540,787 | 1,356,785 | 1,086,967 | 521,482 | 518,705 | 503,871 |
| GB | 56,957 | 6,267,267 | 976,469 | 914,742 | 901,410 | 459,090 | 338,763 |
| ES | 53,491 | 5,512,764 | 592,466 | 529,431 | 521,198 | 273,526 | 156,989 |
| GR | 32,256 | 2,830,022 | 464,390 | 340,327 | 318,201 | 225,589 | 117,293 |
| AT | 31,112 | 2,608,189 | 471,071 | 484,764 | 456,214 | 462,360 | 283,079 |
| TH | 29,013 | 2,558,867 | 465,030 | 477,419 | 265,338 | 166,904 | 103,749 |
| CZ | 28,104 | 2,174,315 | 380,461 | 392,320 | 392,851 | 319,677 | 224,440 |
| PH | 23,376 | 2,389,419 | 418,446 | 427,538 | 290,753 | 279,539 | 134,949 |
| RO | 21,999 | 2,033,780 | 363,290 | 347,597 | 348,675 | 248,057 | 115,402 |
| BE | 15,305 | 1,393,511 | 254,104 | 260,796 | 266,693 | 249,178 | 152,398 |
| KR | 15,152 | 1,357,641 | 250,912 | 257,026 | 262,650 | 143,785 | 141,075 |
| HU | 12,713 | 1,083,605 | 195,988 | 201,172 | 205,120 | 196,786 | 85,005 |
| MY | 12,648 | 1,264,944 | 226,386 | 210,122 | 156,155 | 128,939 | 87,399 |
| AU | 12,342 | 1,402,868 | 212,564 | 209,041 | 86,104 | 83,106 | 60,808 |
| NL | 9,892 | 975,632 | 168,352 | 172,332 | 176,108 | 96,564 | 93,870 |
| VN | 8,444 | 866,641 | 154,174 | 156,484 | 86,542 | 62,357 | 60,970 |
| HR | 7,487 | 692,226 | 122,498 | 125,439 | 128,122 | 57,016 | 49,353 |
| SE | 7,167 | 741,589 | 125,553 | 124,931 | 106,831 | 66,300 | 30,014 |
| NG | 7,107 | 718,812 | 123,582 | 126,572 | 115,184 | 66,225 | 41,762 |
| ZA | 4,978 | 561,404 | 94,350 | 69,616 | 61,540 | 31,699 | 28,028 |
| NZ | 4,718 | 578,232 | 75,398 | 75,079 | 70,263 | 63,634 | 49,612 |
| GH | 4,683 | 645,325 | 81,869 | 79,744 | 79,681 | 72,687 | 57,770 |
| KE | 4,502 | 559,525 | 77,497 | 75,992 | 75,564 | 66,138 | 48,413 |
| FI | 4,270 | 503,050 | 79,723 | 73,431 | 37,818 | 35,438 | 20,779 |
| DK | 4,081 | 433,393 | 69,834 | 47,898 | 34,140 | 33,467 | 29,831 |
| UG | 4,078 | 494,182 | 68,019 | 64,283 | 59,226 | 59,436 | 36,619 |
| NO | 3,999 | 479,239 | 68,753 | 69,826 | 54,867 | 36,772 | 22,793 |

Largest tile over all archives by zoom: z3 3,130,652, z4 3,007,573, z5 1,855,061, z6 1,177,843, z7 544,505 bytes. The z3 and z4 tiles of the US, Germany, Italy and Japan exceed 1 MB, which matters only if the client requests below z5 (plan item R2).

## 4. The 701,349 places without `country_code`

The brief says to leave places with an empty or invalid `country_code` out of every per-country archive and to report them. The count is not marginal. In the source, `country_code`, `osm_id` and `osm_type` exist only on the 1,371,000 OSM-keyed features, so the strict build covers 33 countries and drops a third of the places, including all of Indonesia (87,083) and Brazil (56,093). Archives without them would remove those dots from the RA map, which departs from the 2026-09-04 ruling that every unreviewed place shows as an amber dot. These places cannot be revised by OSM key today either, because the live tiles carry no `osm_id` for them.

The alternative was built and validated in a second directory (`--country-fallback`, routing by the `country` attribute; the properties written are unchanged, so these features still lack `country_code`, `osm_id` and `osm_type`). It gives 210 archives, 2,072,349 points found at z7 (exact in every archive), none left out, and 166,731,279 bytes in total (strict: 129,763,364). Largest tiles by zoom equal the strict build's (z3 3,130,652; z7 544,505 bytes). Its archives are on green in `~/tiles-build-2026-10-07/work-fallback/out/` and are not in the manifest; `country-fallback-summary-tiles-v2-20260722.json` has its per-country counts and tile sizes. Which routing to ship is Joseph's decision; the manifest lists the strict set.

## 5. Reproducing

Run `tools/tiles-r2/run_tiles_v2.sh` (see `tools/tiles-r2/README.md`). Commands, versions and digests are in `tiles-v2-20260722.manifest.json`; the input statistics are in `input-stats-tiles-v2-20260722.json`; the machine-readable report is `validation-report-tiles-v2-20260722.json`.
