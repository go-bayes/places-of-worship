# Annual OSM audit of places of worship, all countries — scoping note (2026-09-03)

Status: SCOPING, rulings R-O1 to R-O5 made by JB on 2026-09-03 (section 5a); nothing built yet. A rendered copy is at https://claude.ai/code/artifact/7afa35c1-b3f2-4ff8-baa8-8d0eeab63c2a.

The goal is a yearly pull of every OpenStreetMap `amenity=place_of_worship` record for every country, taken at one fixed anchor date, stored durably with hashes, and diffed against the previous edition to give a census of change. New Zealand has a working prototype of the historical pull. Nothing else on the path exists yet.

## 1. What exists

| Script | Source | Scope | Outputs | Status |
|---|---|---|---|---|
| `scripts/build_nz_osm_temporal_candidates.R` | ohsome `elements/centroid`, one request per object type per year, true point-in-time | NZ, two hard-coded bounding boxes; years 2013 to 2025 at a 1 September anchor | gitignored files under `data/intermediate/nz_osm_temporal/` (raw, normalised, cleaned, candidates, date-tag rows, manifest) | logic sound; needs `httr` installed on green |
| `scripts/extract_global_data.R` | Overpass via `osmdata`, bbox then polygon clip | all ISO-A2 countries from Natural Earth, serial, 2 s sleep, resumable by file presence | `data/raw/osm/<date>/<cc>_places_raw.json` plus a snapshot manifest | current state only: the date argument names a folder, not a historical query |
| `normalize` / `clean` / `deduplicate_global_places.R` | reads the files above | per country or whole snapshot | normalised, cleaned, deduplicated files with manifests | run; `clean` holds the shared `keep_record()` rules the NZ script reuses |
| `pow-research/pipeline/build_osm_dated_places_products.R` | ohsome with 30 s and 60 s retry back-off | 21 hand-configured countries | dated-places map products; manifest with SHA-256 per file and a 12-character combined version hash | closest prototype of the hash-manifest pattern |
| `pow-research/pipeline/build_vu_area_scaffold.R` | Overpass, raw curl | Vanuatu | `archive/osm-vu-pow/pow_vu.json` with manifest | one-off, not reusable |

The only country pulled year by year is New Zealand. The 7 May 2026 strict run produced 4,777 year-difference rows and cleaned snapshot counts of 775 (2013), 2,012 (2018), 3,335 (2023) and 3,350 (2025). Those files still sit only in a gitignored local cache.

## 2. Storage and manifest conventions already ruled

`docs/data-storage-pipeline.md` fixes the partition scheme: dataset family (`osm-pow`), snapshot date at the annual anchor, pipeline stage, country code. Every partition carries its own hashes and counts, and a global rollup manifest lists the country manifests. `schemas/data-manifest.schema.json` requires a `dataset_version_id` of the form `id:hash` and a role from raw source through public product.

Two gaps in the document itself: it refers to `docs/manifests/`, which does not exist in the repo; and Milestone 1 (a hash manifest for the NZ run) has not been started, so the pilot country has no durable record either. The manifest templates and validation scripts live only in the private research repo and are not wired to CI.

## 3. The census-of-change design

JB's ruling of 22 August (`docs/development/c2-vocabulary-reconciliation-2026-08-14.md` section 7) sets four constraints for the master rebuild: the diff unit is the accepted draft; the claim hash is computed server-side over a versioned canonical projection and any change to that projection re-baselines the edition; corrections are append-only through clone and supersede; each rebuild is stamped with an `export_batch_id` and diffed as a set difference on draft-id and hash pairs.

The OSM audit is the raw-source counterpart. The working protocol in the research repo (`research/sparrc/osm-repeat-2025-2026/README.md`) already fixes the 1 September anchor and states the blocker: the public global extractor does not supply a scientifically exact historical state, because its date argument labels an output directory while the script obtains current Overpass records at execution time. The same protocol requires that machine differences be labelled only as record classes (stable, tag change, geometry change, churn, apparent add, apparent remove, duplicate split or merge, unresolved); they become openings and closures only after review. It separates a 50-case rule-development sample from a later probability sample for prevalence estimation.

## 4. What blocks an all-country run

1. No historical-state extractor at global scope. The global script fetches the present; only the NZ script queries a date, and it is NZ-only.
2. Country coverage of the historical, hash-aware path is 21 of about 195, each needing a hand-built boundary and bounding box.
3. No durable store. Tier 2 names GCS and Postgres as the default reference, but no bucket exists. R2 is used only for tiles and guide media.
4. No manifest tooling in the public repo. Validation and generation scripts exist privately, unwired.
5. Run time and rate limits unmodelled. A serial per-country loop with a 40-minute timeout per country would take days, with no retry on the global path and no documented ohsome or Overpass ceiling.

Scale is unknown: neither repository holds a global count of OSM places of worship or a per-country table. A single ohsome count query per country at the anchor date would settle this in an afternoon and should precede any design commitment.

## 5. Decisions put to JB

- **R-O1 Historical-state source.** ohsome/OSHDB or planet full-history extracts? Recommended: ohsome for editions 1 and 2. Proven in NZ, exact point-in-time state, per-country cost is a bounding box or boundary that Natural Earth already supplies. Revisit planet history only if ohsome throttles a full-globe run.

- **R-O2 Durable store.** Recommended: a dedicated R2 bucket (`pow-osm-editions`), partitioned as the storage document rules. Account, wrangler and upload code already exist for tiles and guide media; GCS would add a second cloud for no gain. Execute Milestone 1 for NZ into that bucket first, as the template.

- **R-O3 Edition 1 scope.** Strict `amenity=place_of_worship` only, or the broad building and religion filter? Relations in or out? Recommended: strict, nodes and ways, relations out, matching the NZ default. The broad filter can be pulled later from the same anchor because ohsome is historical.

- **R-O4 Canonical hash field list for the OSM record class.** Recommended: version it before edition 1 is stamped: OSM id and type, centroid to six decimals, and the evidential tag set the NZ cleaning rules already name (amenity, disused and was amenity, name, religion, denomination, building, start, end and opening dates). Any later change re-baselines, so the list is a ruling, not a default.

- **R-O5 Runner.** Extend the global Overpass script, or generalise the 21-country ohsome script? Recommended: generalise the ohsome script. It already retries, hashes and manifests; it lacks a country loop over Natural Earth boundaries, resumability, and an R2 upload step. The Overpass script would have to gain historical queries from nothing.

### 5a. Rulings (JB, 2026-09-03, his words)

- **R-O1** ohsome.
- **R-O2** yes; and a good point to consider design of data stores as we have many data types (country-level data, polygons used, etc.). What will be both efficient and reproducible? To be discussed.
- **R-O3** strict; and further, we must consider efficient pruning for duplicates (if we can). This will be difficult for human-only review at this scale, again to be discussed.
- **R-O4** agree.
- **R-O5** agree, the Overpass script is not state of the art; ohsome to generalise.

Two follow-on design discussions are therefore open: the layout of the project's data stores across data types (R-O2), and duplicate pruning at scale with less than full human review (R-O3).

## 6. Proposed order of work

1. Count query per country at 1 September 2025 and 2026 through ohsome, to size the corpus and the run.
2. JB rules R-O1 to R-O5 (done 2026-09-03).
3. Milestone 1: hash manifest for the existing NZ run, uploaded to the chosen store, validated against the schema, with `docs/manifests/` created.
4. All-country runner brief (server sitting), then the runner, with a ten-country dry run before the full pull.
5. Edition 1 pull at the anchor, then the record-class diff against the 2025 NZ snapshot as the first census of change.

Yes, this order makes sense.
