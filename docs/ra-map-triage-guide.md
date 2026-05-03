# RA Map Triage Guide

This guide explains what a research assistant (RA) should do when the New
Zealand map reveals a possible change, missing place, duplicate, or historical
place of worship.

The short version is:

1. If you are working on the current NZ pilot, start with
   `docs/ra-nz-pilot-task.md`.
2. Use the map to find and inspect the case.
3. Use source links, searches, street maps, directories, or other approved
   sources to check the evidence.
4. Record the evidence in the agreed spreadsheet. If the map demo action
   builder is enabled, you may use it to generate a draft spreadsheet row for
   pasting into the sheet.
5. Export the spreadsheet tab as CSV.
6. Run `pow validate` only if the project team asks.
7. Send the CSV, validation output, and unresolved questions back to the project
   team.

The current pilot is map-assisted, but not yet a secure submission portal. The
map is a search and triage surface. In demo mode, it can generate a local
spreadsheet-ready evidence row and a local review JSON preview for feedback.
The spreadsheet remains the evidence-entry surface. The command-line tool
checks the exported CSV. Nothing entered in the demo map is saved or submitted.
Your work is saved in the shared working spreadsheet, not in the map.

The verification map also has target-year controls for 2013, 2018, and 2023.
These colours are provisional. They use reviewed target-year fields when
available and otherwise fall back to OpenStreetMap lifecycle tags such as
`start_date`, `old_start_date`, and `end_date`. Treat those tags as evidence to
check, not as final truth.

## Why This Matters

The project is reconstructing places of worship (PoWs) across space and time.
We need to know whether a site was active in target years such as 2013, 2018,
and 2023, not only whether a building exists now.

Your role is to gather source-backed evidence. You are not making final
acceptance decisions, editing the master database, or changing the public map.

## Current Pilot Versus Target Workflow

Current pilot:

- The NZ verification map helps you find tasks and inspect current map records.
- The demo controls can generate a local spreadsheet row and review JSON for
  discussion, but they do not save or submit data.
- The working spreadsheet records evidence.
- `pow validate` checks the exported CSV.
- `pow stage` and `pow propose` are run only if the project team asks.

Target workflow:

- You open the map.
- You choose a time point: 2013, 2018, or 2023.
- You click an existing point, building, or empty location.
- You propose a change: missing site, duplicate, closure, changed use,
  denomination change, shared building, or uncertain status.
- The authenticated portal writes the proposal to staging for review.
- Reviewed changes rebuild the 2013, 2018, and 2023 map layers.

Until that target workflow exists, use the spreadsheet.

## Using The Demo Map Action Builder

Demo mode is useful for testing the workflow and reducing typing, but it is not
an intake system.

1. Open the NZ verification map in demo mode.
2. Select a target year: 2013, 2018, or 2023.
3. Click a task from the map or priority list.
4. In "What did you find?", choose the closest action.
5. Check or adjust the 2013, 2018, and 2023 statuses.
6. Add a short source title, source URL or agreed file reference, related ids if
   relevant, and a source-backed evidence note.
7. Click `Copy spreadsheet row` if you were asked to paste a draft row into the
   wide evidence sheet.
8. Click `Copy review JSON` if the project team asks for a compact feedback
   payload.

The copied spreadsheet row is a single tab-separated row matching the wide
evidence sheet columns. Paste it into the sheet under the existing header row.
Review it before sending it back. Do not enter private contact details,
restricted source material, or raw uploaded files into the map.

## Common Fields

Use these fields consistently in the wide evidence sheet:

- `evidence_row_id`, `country_code`, `source_dataset_id`, `source_type`,
  `review_status`, `privacy_flag`, and `licence_flag`: required for validation.
- `matched_current_site_id`: current map or OpenStreetMap-like id when the row
  matches an existing mapped site.
- `candidate_site_id`: temporary id for a possible new, missing, lost, or
  uncertain site.
- `match_method`: how the row was matched, such as `osm_id`, `name_address`,
  `spatial_proximity`, `manual_review`, or `unmatched`.
- `match_confidence`: `high`, `medium`, `low`, or `none`.
- `target_year_2013_status`, `target_year_2018_status`,
  `target_year_2023_status`: `present`, `absent`, `uncertain`, or
  `not_assessed`.
- `target_year_*_evidence`: short explanation of the source evidence for that
  year.
- `existence_status`: whether the source supports site or building existence at
  the relevant time.
- `worship_use_status`: whether the source supports worship use at the relevant
  time.
- `quality_flag`: use `needs_review` when a reviewer must decide.
- `review_status`: usually `unreviewed` or `needs_review` for RA-entered rows.
- `privacy_flag` and `licence_flag`: use `clear`, `needs_review`, or
  `restricted`.
- `osm_start_date`, `osm_old_start_date`, and `osm_end_date`: preserve lifecycle
  tags exactly as OpenStreetMap gives them.
- `osm_lifecycle_date_notes`: explain what the OSM date appears to mean and
  whether it is supported by another source.

Do not paste private contact details, restricted source files, or raw uploaded
material into GitHub.

## Using OSM Lifecycle Dates

OpenStreetMap lifecycle tags are useful but incomplete. They may refer to a
building, a worship site, a congregation, a dedication, or an editor's best
guess. Use them as evidence, not as a final answer.

When OSM supplies `start_date`, `old_start_date`, or `end_date`:

1. Copy the raw value into the matching OSM lifecycle field.
2. Record the OSM object id, object type, version timestamp, and raw tags if
   available.
3. In `osm_lifecycle_date_notes`, state what the date might mean, for example:
   `OSM start_date may refer to building construction; worship-use date still
   needs confirmation.`
4. Use stronger source fields when another source is clearer:
   - `site_opened_date` for worship beginning at the physical location,
   - `building_opened_or_dedicated_date` for the building or dedication,
   - `first_seen_date` for first source evidence,
   - `site_closed_date` or closure bounds for end of worship use.
5. If the OSM date helps decide 2013, 2018, or 2023 status, explain that in the
   matching `target_year_*_evidence` field.
6. If the OSM date is ambiguous, set the target-year status to `uncertain` and
   mark the row `needs_review`.

Example:

- OSM `start_date=1953` supports that the site or building predates 2013, but a
  reviewer may still need to confirm whether worship use was active in 2013.
- OSM `start_date=2018` is not precise enough by itself to prove status on
  2018-09-01. Mark the 2018 target-year status `uncertain` unless another
  source gives a clearer date.

## Case 1: A Current PoW Is Missing From The Map

Use this when you find a current place of worship that is not on the map.

1. Check that the place appears to be a worship site, not only an office,
   cemetery, school, childcare centre, or generic community facility.
2. Search for source evidence: official website, directory, charity register,
   denominational directory, council or heritage record, street imagery, or
   other approved source.
3. In the wide evidence sheet, add one row for the source-place record.
4. Set `candidate_site_id` to a temporary id, for example
   `candidate-missing-001`.
5. Leave `matched_current_site_id` blank if there is no current mapped site.
6. Set `match_method` to `unmatched`.
7. Set `match_confidence` to `none` unless there is a plausible nearby match
   that needs review.
8. Record `name_raw`, `name_standardised`, `denomination_or_tradition_raw`,
   `site_type`, `address_raw`, `locality_raw`, and source fields where known.
9. If you can locate the place, record `latitude`, `longitude`,
   `geocoding_basis`, and `geocoding_confidence`.
10. If the source supports current worship use, set:
    - `target_year_2023_status`: `present`
    - `worship_use_status`: `confirmed_worship` or `probable_worship`
    - `existence_status`: `present`
11. Fill 2013 and 2018 target-year fields only if the source supports them.
12. Set `quality_flag` to `needs_review`.
13. Set `review_status` to `needs_review`.
14. In `review_note`, write: `Current PoW appears missing from map; reviewer to
    confirm whether this should become a new site.`

Current limitation: `pow propose` v1 does not mint new accepted site ids for
unmatched candidates. The row can be validated and reviewed, but it needs a
reviewer decision before it can become a staged master change.

## Case 2: Two Map Points Appear To Be One Site

Use this when two mapped points or records appear to refer to the same place of
worship.

1. Open both map records and copy their names, master ids, and OSM ids if
   available.
2. Check whether they are truly the same worship site. Do not merge:
   - two different congregations sharing one building,
   - a church plus a separate chapel,
   - a worship building plus an office,
   - a historical site and a current successor site without evidence.
3. Find source evidence if possible: shared address, shared website, OSM
   history, street imagery, directory listing, or another reliable source.
4. In the wide evidence sheet, add one row for the evidence.
5. Put the id of the strongest apparent current record in
   `matched_current_site_id`.
6. Put the other id or ids in `candidate_match_notes` and `review_note`.
7. Set `match_method` to `manual_review` or `spatial_proximity`.
8. Set `match_confidence` to `medium` or `low` unless the evidence is very
   clear.
9. Set `quality_flag` to `needs_review`.
10. Set `review_status` to `needs_review`.
11. In `review_note`, write: `Possible duplicate: [id A] and [id B] appear to
    refer to one site; reviewer to decide whether to merge or retain both.`

If you cannot tell which id should survive, leave `matched_current_site_id`
blank and record both ids in `candidate_match_notes` and `review_note`.

## Case 3: A PoW Existed In 2013 But Not In 2018

Use this when evidence suggests a place was active as a place of worship in
2013 but was no longer active by 2018.

1. Record the source that supports 2013 worship use.
2. Record the source that supports absence, closure, demolition, or changed use
   by 2018.
3. Use one row if the same source supports both statuses. Use separate rows if
   the evidence comes from different sources.
4. If the site matches a current or historical map record, fill
   `matched_current_site_id`.
5. If it is not on the current map, create a `candidate_site_id`.
6. Set:
   - `target_year_2013_status`: `present`
   - `target_year_2018_status`: `absent`
   - `target_year_2023_status`: `absent` if supported, otherwise
     `not_assessed` or `uncertain`
7. Use the matching `target_year_*_evidence` fields to explain the evidence for
   each target year.
8. If you know the closure date, fill `site_closed_date` and
   `site_closed_date_precision`.
9. If you only know that closure happened after 2013 and by 2018, fill:
   - `closure_not_earlier_than_date`: `2013-09-01`
   - `closure_not_earlier_than_date_precision`: `day`
   - `closure_not_later_than_date`: `2018-09-01`
   - `closure_not_later_than_date_precision`: `day`
10. If the building still exists but worship use ended, use `use_changed_date`
    or `closure_not_*` fields rather than treating the building as demolished.
11. Set `worship_use_status` to the source-specific status. For an end-use
    source, this will often be `not_worship` or `uncertain`.
12. Set `quality_flag` to `needs_review`.
13. Set `review_status` to `needs_review`.
14. In `review_note`, write what needs reviewer judgement, for example:
    `Evidence supports worship in 2013 and non-worship by 2018; closure date is
    bounded but not exact.`

Do not treat "building still visible" as evidence of worship use. The research
question is whether worship use was active at the site in the target year.

## Case 4: Denomination Changed, Shared Building, Or Multi-Use Site

Use this when the building remains but the worship function is complicated.

1. Record each source separately if it supports a different organisation,
   denomination, or time period.
2. Preserve `denomination_or_tradition_raw` exactly as the source gives it.
3. Use `site_type` as `multi_use` if worship is one use among several.
4. Use `review_note` to explain whether the case is:
   - denomination switch,
   - shared building,
   - multiple congregations,
   - worship plus community or education use,
   - split or merged site record.
5. Set `quality_flag` to `needs_review`.
6. Set `review_status` to `needs_review`.

Current limitation: coded denomination taxonomy and multi-organisation event
translation are still being developed. Preserve the evidence; do not force a
single final denomination if the source shows concurrent use.

## How To Work Through The NZ Website Priority List

The NZ verification map uses automated priority labels.

1. Start with `high` priority tasks unless the project team assigns another
   batch.
2. Use `medium` priority tasks for spot-checking in sample.
3. Leave `low` priority tasks until asked.
4. Choose the target year you are checking: 2013, 2018, or 2023.
5. Use the target-year status filter if you are assigned a specific kind of
   work, such as missing lifecycle evidence, uncertain status, or apparent
   absences.
6. Open one task at a time.
7. Copy the task id, master id, OSM id, name, address, lifecycle tags, and
   suggested action into
   your notes or evidence row.
8. Use the links in the task panel to inspect OSM, OSM history, Google Maps,
   Street View, and search results.
9. Decide what kind of evidence row is needed:
   - accept current record,
   - missing current site,
   - duplicate or merge candidate,
   - not a place of worship,
   - closed or changed use,
   - historical only,
   - target-year status uncertain,
   - denomination changed,
   - shared or multi-congregation building.
10. Add or update the evidence row in the spreadsheet.
11. Mark unclear cases `needs_review`.
12. Move to the next task.

If you are working from the static manual review queue instead of the website,
use priority 1 first, then priority 2, then priority 3.

## What The 2013, 2018, And 2023 Map Should Eventually Show

Each target-year map should show the reviewed state for that year:

- `present`: source-backed active worship use.
- `absent`: source-backed absence, closure, changed use away from worship, or
  no worship use at that site.
- `uncertain`: relevant evidence exists but does not settle the status.
- `not_assessed`: no target-year judgement has been made.

The map should let a reviewer switch between 2013, 2018, and 2023, click a site
or empty location, and propose the relevant change. The proposal should go to
staging, not directly to the master database.

Until that interface exists, the target-year columns in the spreadsheet are the
source of truth for proposed 2013, 2018, and 2023 states.
