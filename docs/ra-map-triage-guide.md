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
4. In the assigned web workpack, sign in and use `Save draft`,
   `Submit unresolved note`, or `Submit for review`.
5. Use spreadsheet copy/paste only if JB explicitly asks you to use the
   fallback.

The current pilot has a shared backend. In assignment mode, signed-in work is
saved to the project task queue, where reviewers can inspect it. In demo or
fallback mode, the map can still generate a local spreadsheet-ready evidence
row and a local review JSON preview, but those local previews are not submitted
unless JB asks you to use the spreadsheet fallback.

The verification map also has target-year controls for 2013, 2018, and 2023.
These colours are provisional. They use reviewed target-year fields when
available and otherwise fall back to OpenStreetMap date tags such as
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

- The assigned NZ verification link shows a filtered task list.
- Google sign-in connects the page to the shared Convex task backend.
- `Save draft`, `Submit unresolved note`, and `Submit for review` are the
  preferred saving path.
- Spreadsheet rows remain a fallback and export/debug aid.
- JB and reviewers handle validation, staging, and review outside the default
  RA workflow.

Target workflow:

- You open the map.
- You choose a time point: 2013, 2018, or 2023.
- You click an existing point, building, or empty location.
- You propose a change: missing site, duplicate, closure, changed use,
  no building present, denomination change, shared building, or uncertain
  status.
- The authenticated portal writes the proposal to staging for review.
- Reviewed changes rebuild the 2013, 2018, and 2023 map layers.

Until the full target workflow exists, use the assigned backend link and the
spreadsheet fallback only when JB asks for it.

## Using The Demo Map Action Builder

Demo mode is useful for testing the workflow and reducing typing, but it is not
an intake system.

Use this section only if JB asks you to use demo or spreadsheet-fallback mode.

1. Open the NZ verification map in demo mode.
2. Select a target year: 2013, 2018, or 2023.
3. Click a task from the map or priority list.
4. In "What did you find?", choose the closest action.
5. Check or adjust the 2013, 2018, and 2023 statuses.
6. Check or adjust the controlled status and confidence dropdowns.
7. Add a short source title, source URL or agreed file reference, any source-backed street address or locality found for missing-address tasks, related ids if relevant, and the guided direct-observation, interpretation, and uncertainty fields. If denomination or shared use is relevant, preserve the exact label, record who supplied it, and choose its provisional relation to the project record.
8. Click `Copy spreadsheet row` if you were asked to paste a draft row into the wide evidence sheet and at least one target year has been assessed.
9. Click `Copy review JSON` if JB asks for a compact feedback payload, or when the evidence preserves a raw denomination label without assessing a target year.

The copied spreadsheet row is a single tab-separated row matching the wide evidence sheet columns. Paste it into the sheet under the existing header row. Review it before sending it back. A record with every target year left as `not_assessed` cannot form a wide spreadsheet or `pow` row; preserve it as review JSON for reviewer follow-up instead. The map marks copied tasks as tentatively closed only in this browser; choose the next task from the map or list. Do not enter private contact details, restricted source material, or raw uploaded files into the map.

The target-year fields are for 2013, 2018, and 2023. Use the optional opening,
closure, and change-date fields for dates outside those waves, such as site
opening, closure, relocation, demolition, first/last seen evidence, or a later
shared-use or multi-denominational change. The map records one structured
opening, closure, or change date per copied row; copy an additional row if the
same site has another distinct source-backed date worth preserving.

These dates are dated evidence about a worship site's history: when an
organisation began, worship began at the site, a building opened, the site was
first or last seen, worship ended, the building was demolished, the
organisation relocated, or the worship function changed. Keep building
existence separate from worship use where the source allows.

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
- `site_opened_date`, `site_closed_date`, `first_seen_date`,
  `last_seen_date`, `use_changed_date`, and related precision fields:
  opening, closure, or later-change evidence that may fall outside the target
  years.
- `existence_status`: whether the source supports site or building existence at
  the relevant time.
- `worship_use_status`: whether the source supports worship use at the relevant
  time.
- `quality_flag`: use `needs_review` when a reviewer must decide.
- `review_status`: usually `unreviewed` or `needs_review` for RA-entered rows.
- `privacy_flag` and `licence_flag`: use `clear`, `needs_review`, or
  `restricted`.
- `osm_start_date`, `osm_old_start_date`, and `osm_end_date`: preserve OSM date
  tags exactly as OpenStreetMap gives them.
- `osm_lifecycle_date_notes`: explain what the OSM date appears to mean and
  whether it is supported by another source.

Do not paste private contact details, restricted source files, or raw uploaded
material into GitHub.

## Street-Level Imagery And Field Observations

Street-level imagery can be strong evidence when the capture date is visible
and the visual claim is specific: for example, a worship-service sign, a
denominational sign, a named church noticeboard, or a building sign that clearly
identifies current worship use. It is weaker evidence for absence: no visible
sign does not prove that worship use was absent.

Use `source_type = street_imagery` for Google Street View, Apple Look Around,
Mapillary, KartaView, Bing Streetside, local-council street imagery, or similar
street-level services. Put the service in `provider`, for example `Google
Street View`. Record the image or panorama link in `source_url_or_file`, the
displayed capture date in `visual_verification_capture_date`, and a short
visual claim in `visual_verification_summary`.

Use `source_type = field_observation` for an RA or JB-approved site visit. Put
the visit date in `visual_verification_capture_date`, write `field_observation`
in `visual_verification_source`, and summarise only the site-level observation.
Do not record private conversations, personal contact details, photographs, or
videos unless JB has explicitly approved the collection and storage path.

Do not store or republish Street View screenshots in the repository or public
outputs. Record the provider, link or agreed file reference, capture date, and
what the image supports.

## Using OSM Date Tags

OpenStreetMap date tags are useful but incomplete. They may refer to a building,
a worship site, a congregation, a dedication, or an editor's best guess. Use
them as evidence, not as a final answer.

When OSM supplies `start_date`, `old_start_date`, or `end_date`:

1. Copy the raw value into the matching OSM date field.
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

## Case 1: A Current PoW Is Missing From The Project Map

Use this when you find a current place of worship that is not represented on
the project map or master list. It may still have an OSM object or another
upstream source record; preserve those identifiers as candidate or matching
evidence.

1. Check that the place appears to be a worship site, not only an office,
   cemetery, school, childcare centre, or generic community facility.
2. Search for source evidence: official website, directory, charity register,
   denominational directory, council or heritage record, street imagery, or
   other approved source. Also search OSM or inspect nearby OSM candidates when
   relevant.
3. In the assigned workpack, use `Missing current site` only when the missing
   place belongs to the task you are already checking. If you find an unrelated
   missing place, record its name, source, location, and any OSM id, then send
   that note to JB until the `Nominate missing PoW` flow is available.
4. If JB asks you to use demo mode, the draft nomination panel can help you
   inspect the fields for a candidate, but it does not save or submit anything.
5. In the shared backend or fallback wide evidence sheet, add one record for
   the source-place evidence.
6. Set `candidate_site_id` to a temporary id, for example
   `candidate-missing-001`.
7. Leave `matched_current_site_id` blank if there is no current mapped site.
8. If there is an OSM object for the candidate, record `matched_osm_id` and
   `osm_object_type`. This does not make the OSM id the project site id.
9. Set `match_method` to `unmatched`, or `manual_review` if there is a plausible
   nearby project or OSM candidate that needs reviewer judgement.
10. Set `match_confidence` to `none` unless there is a plausible nearby match
   that needs review.
11. Record `name_raw`, `name_standardised`, `denomination_or_tradition_raw`,
    `site_type`, `address_raw`, `locality_raw`, and source fields where known.
12. If you can locate the place, record `latitude`, `longitude`,
    `geocoding_basis`, and `geocoding_confidence`.
13. If the source supports current worship use, set:
    - `target_year_2023_status`: `present`
    - `worship_use_status`: `confirmed_worship` or `probable_worship`
    - `existence_status`: `present`
14. Fill 2013 and 2018 target-year fields only if the source supports them.
15. Set `quality_flag` to `needs_review`.
16. Set `review_status` to `needs_review`.
17. In `review_note`, write: `Current PoW appears missing from project map; reviewer to
confirm whether this should become a new site.`

Current limitation: the assigned backend can save evidence against existing
tasks, but it does not yet create standalone missing-site tasks. A reviewer
must decide whether a candidate becomes a new site.

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
8. Choose `No building present` when the source suggests the mapped building is
   gone, no building is visible at the mapped point, or the geometry may point
   to the wrong place. In that case, set `existence_status` to `absent`,
   `worship_use_status` to `not_worship`, and explain whether the evidence is
   demolition, street imagery, aerial imagery, a property record, or a geometry
   problem.
9. If you know the closure date, fill `site_closed_date` and
   `site_closed_date_precision`.
10. If you only know that closure happened after 2013 and by 2018, fill:
   - `closure_not_earlier_than_date`: `2013-09-01`
   - `closure_not_earlier_than_date_precision`: `day`
   - `closure_not_later_than_date`: `2018-09-01`
   - `closure_not_later_than_date_precision`: `day`
11. If the building still exists but worship use ended, use `use_changed_date`
    or `closure_not_*` fields rather than treating the building as demolished.
12. Set `worship_use_status` to the source-specific status. For an end-use
    source, this will often be `not_worship` or `uncertain`.
13. Set `quality_flag` to `needs_review`.
14. Set `review_status` to `needs_review`.
15. In `review_note`, write what needs reviewer judgement, for example:
    `Evidence supports worship in 2013 and non-worship by 2018; closure date is
bounded but not exact.`

Do not treat "building still visible" as evidence of worship use. The research
question is whether worship use was active at the site in the target year.

## Case 4: Denomination Changed, Shared Building, Or Multi-Use Site

Use this when the building remains but the worship function is complicated.

1. Record each source separately if it supports a different organisation,
   denomination, or time period.
2. Preserve `denomination_or_tradition_raw` exactly as the source, sign, or community gives it. In the live portal, enter this under `Exact label observed or reported` and keep it separate from the starting project label.
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

Record who supplied the label separately from its possible relation to the record. Correction, historical-change, and shared-use choices create follow-up signals only; they are not complete change events. Taxonomy mapping and acceptance remain reviewer and `pow` operations.

## How To Work Through The NZ Website Priority List

The NZ verification map uses automated priority labels.

1. Start with `high` priority tasks unless JB assigns another batch.
2. Use `medium` priority tasks for spot-checking in sample.
3. Leave `low` priority tasks until asked.
4. Choose the target year you are checking: 2013, 2018, or 2023.
5. Use the target-year status filter if you are assigned a specific kind of
   work, such as missing opening/closure/change-date evidence, uncertain status, or apparent
   absences.
6. Open one task at a time.
7. Copy the task id, master id, OSM id, name, address, OSM date tags, and
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
   - no building present, apparent demolition, or bad geometry,
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
