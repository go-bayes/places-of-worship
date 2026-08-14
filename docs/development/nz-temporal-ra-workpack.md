# New Zealand Temporal RA Workpack

This note documents how the first New Zealand temporal research-assistant (RA)
workpack is generated. The goal is to give André a small, focused set of
records to check, not to expose raw OpenStreetMap (OSM) history rows directly.

The workpack asks one narrow evidence question per row: what can a non-OSM
source tell us about worship use at the target years 2013, 2018, and 2023?

The generating script is
[`scripts/build_nz_temporal_ra_workpack.R`](https://github.com/go-bayes/places-of-worship/blob/main/scripts/build_nz_temporal_ra_workpack.R).

## Inputs

The workpack is built from the generated New Zealand OSM temporal outputs:

- `data/intermediate/nz_osm_temporal/nz_osm_date_tag_places_to_check.csv`
- `data/intermediate/nz_osm_temporal/nz_osm_temporal_candidates.csv`

These inputs are ignored local working files, but their durable source packages
are recorded in:

- `docs/manifests/osm-pow-nz-2013-2025-raw-ohsome-dffb55663f94.json`
- `docs/manifests/osm-pow-nz-2013-2025-places-to-check-ef64ba809ced.json`

## Selection Rule

The first workpack contains 50 rows. The script selects them in this exact
order:

1. all rows from `nz_osm_date_tag_places_to_check.csv` whose
   `candidate_date_tag_windows` field contains `candidate_gain`, sorted by
   `candidate_date_tag_windows`, `latest_name`, and `osm_key`;
2. after excluding already-used `osm_key`s, the first five rows from
   `nz_osm_temporal_candidates.csv` where `transition_types` contains
   `osm_present_then_absent` and `nearby_replacement_osm_key` is present,
   sorted by `diff_category`, `latest_name`, and `osm_key`;
3. after excluding already-used `osm_key`s, the first five remaining date-tag
   rows with an origin or closure parser warning, an uncertain 2013/2018/2023
   status, or a `candidate_status_change` window, sorted by warning presence,
   `candidate_date_tag_windows`, `latest_name`, and `osm_key`;
4. after excluding already-used `osm_key`s, the first five remaining date-tag
   rows that are present in 2013, 2018, and 2023, with no candidate window and
   no parser warning, sorted by `latest_name` and `osm_key`.

Within each category, rows are sorted deterministically by case information
such as candidate window, difference category, latest name, and OSM key. No
manual row choice is needed. The script sets string collation to `C` before
sorting so the selected rows do not depend on the local machine locale.

The current first workpack contains:

| Case type | Rows | Purpose |
| --- | ---: | --- |
| `possible_opening_from_osm_date_tag` | 35 | Check whether OSM opening-date evidence is supported by independent sources. |
| `likely_osm_object_churn_loss` | 5 | Check whether an apparent OSM disappearance is a real end of worship use or an object replacement. |
| `ambiguous_date_or_status` | 5 | Test how well the workflow captures uncertain dates and target-year states. |
| `control_confirmation` | 5 | Provide straightforward confirmation cases. |

## Generated Files

Run:

```sh
Rscript scripts/build_nz_temporal_ra_workpack.R
```

The default output is:

- `exports/nz_temporal_ra_workpack/nz-temporal-ra-workpack-001.csv`
- `exports/nz_temporal_ra_workpack/nz-temporal-ra-workpack-001-summary.json`

The CSV is the reproducible source for the web assignment. It can also be
imported into a private Google Sheet for fallback review, but the active RA
workflow should use the Convex-backed task map once the hosted backend is
available.

The summary file records input row counts, input SHA-256 hashes, output
SHA-256 hash, selection counts, and the selection rule.

For the current generated CSV:

- rows: 50
- SHA-256: `512ec695b6aceeec4929f43cd935a73d5a391fa8d67f6baca1f5d5243f5910e9`

To build the Convex import payload for the web assignment, run:

```sh
uv run scripts/build_convex_workpack_seed.py
```

The output is:

- `exports/convex-task-seed/nz-temporal-ra-workpack-001.json`

That JSON contains exactly the `batch` and `tasks` arguments for
`tasks:upsertTasksFromStaticMap`. The task ids are deterministic:
`nz-temporal-ra-workpack-001-row-001` through
`nz-temporal-ra-workpack-001-row-050`.

After the seed is imported into Convex and the static map client is enabled,
the RA assignment link is:

<https://religionmap.org/apps/regions/nz/verification.html?batch=nz-temporal-ra-workpack-001>

## How André Should Use It

André should work from the curated web assignment, not from raw OSM history and
not from a spreadsheet unless JB explicitly chooses the fallback path. The first
handoff should ask him to work down the assigned tasks in order, stop at a
natural stopping point, and tell JB where he stopped.

For each row:

1. read the `main_question`;
2. open the OSM object link and map location;
3. search for non-OSM evidence using the source hints;
4. record what the source supports for 2013, 2018, and 2023;
5. record any useful opening, closure, first-seen, last-seen, or changed-use
   date;
6. mark difficult cases as uncertain or needing review;
7. move on rather than spending too long on one case.

OSM history and OSM date tags are starting points. They are not accepted
historical worship-use evidence until reviewed.

## Reproducibility Checks

After running the script, check:

```sh
Rscript -e 'x <- read.csv("exports/nz_temporal_ra_workpack/nz-temporal-ra-workpack-001.csv", check.names=FALSE); stopifnot(nrow(x) == 50); print(table(x$case_type)); cat(unname(tools::sha256sum("exports/nz_temporal_ra_workpack/nz-temporal-ra-workpack-001.csv")), "\n")'
uv run scripts/build_convex_workpack_seed.py
python3 -m json.tool exports/convex-task-seed/nz-temporal-ra-workpack-001.json >/dev/null
```

The expected case counts are:

- `possible_opening_from_osm_date_tag`: 35
- `likely_osm_object_churn_loss`: 5
- `ambiguous_date_or_status`: 5
- `control_confirmation`: 5

The expected CSV SHA-256 is:

`512ec695b6aceeec4929f43cd935a73d5a391fa8d67f6baca1f5d5243f5910e9`
