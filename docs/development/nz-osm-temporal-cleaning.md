# NZ OSM Temporal Cleaning

This note defines the first maintainer-facing workflow for turning annual
OpenStreetMap history into cleaned review candidates for the New Zealand pilot.
The default extraction uses `1 September` snapshots for every completed year
from 2013 to 2025, while highlighting the New Zealand estimation target years
2013, 2018, and 2023 for research-assistant review.

The output is a candidate-diff layer, not accepted historical truth. Apparent
OpenStreetMap additions or removals usually mean one of several things:

- the place was not yet mapped;
- a node became a way, relation, or nearby replacement object;
- tags were corrected;
- a support building or non-worship feature entered the raw query;
- a real worship use appeared, disappeared, moved, merged, split, or changed.

Research assistants should not inspect raw OpenStreetMap diffs directly during
the pilot. They should receive cleaned, prioritised candidate rows and then
check selected cases against non-OpenStreetMap sources such as church-body
records, directories, archived websites, annual reports, visual evidence, or
local records.

## Script

Run from the repository root:

```sh
Rscript scripts/build_nz_osm_temporal_candidates.R
```

The full default run may take time because it requests node and way snapshots
for 13 annual dates. Start with a bounding-box smoke test when changing the
script or cleaning rules.

For a small-area smoke test, pass an ohsome bounding box:

```sh
Rscript scripts/build_nz_osm_temporal_candidates.R --bbox 174.6,-41.4,175.1,-41.0
```

The script:

1. queries the ohsome `elements/centroid` endpoint for annual `1 September`
   snapshots, requesting nodes and ways separately before combining them;
2. extracts places tagged `amenity=place_of_worship` by default;
3. normalises the output into the project place-record shape;
4. applies the existing project cleaning rules from `scripts/clean_global_places.R`;
5. compares adjacent cleaned annual snapshots by OpenStreetMap object key;
6. emits candidate rows only where the cleaned OpenStreetMap state changed or
   tags changed.

By default this means `2013-09-01` through `2025-09-01`. Use `--years` for a
smaller smoke test or a future country-specific run:

```sh
Rscript scripts/build_nz_osm_temporal_candidates.R --years 2013:2015 --task-years 2013
```

The `--task-years` option does not limit extraction. It marks the years most
important for RA-facing review. For New Zealand, keep `2013,2018,2023` unless
the estimation target changes.

An optional `--broad` flag also includes worship-style building tags and all
objects with a `religion=*` tag. Use it only after the strict default has been
checked, because it is slower and noisier.

The default omits relations because historical relation geometry can be slow to
fetch. Add `--types node,way,relation` only after the node/way pilot has been
checked.

The default per-request timeout is 180 seconds. Use `--timeout-seconds N` to
raise or lower it for exploratory runs.

Outputs are written under `data/intermediate/nz_osm_temporal/`, which is
gitignored by default. These files are local cache only; promote reusable
outputs through `docs/data-storage-pipeline.md` before using them for RA task
generation, analysis, or public products:

- `raw/nz_osm_pows_<date>.geojson`
- `nz_osm_<year>_normalised.json`
- `nz_osm_<year>_cleaned.json`
- `nz_osm_temporal_candidates.csv`
- `nz_osm_temporal_candidates.geojson`
- `manifest.json`

## Review Columns

The candidate CSV records:

- whether each object is present in each cleaned annual snapshot;
- target-year presence for the highlighted RA/research years;
- the apparent diff category and adjacent-year transition window;
- the latest name, religion, denomination, and location;
- year-by-year name, religion, denomination, amenity, and building tags;
- any current-map match by OpenStreetMap object key;
- possible nearby replacement objects for likely node/way/relation churn;
- a fixed evidence-basis warning that the row is cleaned OpenStreetMap evidence
  only;
- a short instruction for the research assistant.

Before these candidates enter Convex or `pow`, a curator should inspect the
manifest and sample rows to check whether the broad query and cleaner are
producing useful leads rather than noise.

## First Strict National Run

On 2026-05-07, the strict node/way run for `2013:2025` completed with
`--timeout-seconds 300` and wrote ignored outputs under
`data/intermediate/nz_osm_temporal/`. It produced 4,777 candidate rows. Cleaned
snapshot counts were 775 for 2013, 2,012 for 2018, 3,335 for 2023, and 3,350
for 2025.

This confirms that the direct ohsome route is viable for the strict national
pilot, though the candidate volume is much too large for direct RA review.
Curators should sample and collapse these leads before exposing tasks through
the RA map or Convex task layer.
