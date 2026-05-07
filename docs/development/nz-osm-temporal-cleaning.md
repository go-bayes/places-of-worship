# NZ OSM Temporal Cleaning

This note defines the first maintainer-facing workflow for turning 2013, 2018,
and 2023 OpenStreetMap history into cleaned review candidates for the New
Zealand pilot.

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

For a small-area smoke test, pass an ohsome bounding box:

```sh
Rscript scripts/build_nz_osm_temporal_candidates.R --bbox 174.6,-41.4,175.1,-41.0
```

The script:

1. queries the ohsome `elements/centroid` endpoint for `2013-09-01`,
   `2018-09-01`, and `2023-09-01`, requesting nodes and ways separately before
   combining them;
2. extracts places tagged `amenity=place_of_worship` by default;
3. normalises the output into the project place-record shape;
4. applies the existing project cleaning rules from `scripts/clean_global_places.R`;
5. compares cleaned snapshots by OpenStreetMap object key;
6. emits candidate rows only where the cleaned OpenStreetMap state changed or
   tags changed.

An optional `--broad` flag also includes worship-style building tags and all
objects with a `religion=*` tag. Use it only after the strict default has been
checked, because it is slower and noisier.

The default omits relations because historical relation geometry can be slow to
fetch. Add `--types node,way,relation` only after the node/way pilot has been
checked.

The default per-request timeout is 180 seconds. Use `--timeout-seconds N` to
raise or lower it for exploratory runs.

Outputs are written under `data/intermediate/nz_osm_temporal/`, which is
gitignored by default:

- `raw/nz_osm_pows_<date>.geojson`
- `nz_osm_<year>_normalised.json`
- `nz_osm_<year>_cleaned.json`
- `nz_osm_temporal_candidates.csv`
- `nz_osm_temporal_candidates.geojson`
- `manifest.json`

## Review Columns

The candidate CSV records:

- whether each object is present in the cleaned 2013, 2018, and 2023 snapshots;
- the apparent diff category;
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
