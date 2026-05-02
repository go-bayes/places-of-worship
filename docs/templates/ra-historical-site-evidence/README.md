# RA historical site evidence template

This folder contains Google Sheets-ready CSV tabs for collecting evidence about historical places of worship, starting with New Zealand lifecycle evidence and 2013, 2018, and 2023 place-density reconstruction.

The template is for source evidence, not final counts. Each row should record what a source says about a place, how the evidence was dated, how it may match to a site, and what review status it currently has. Final ingestion should only use rows that pass review.

## How to set up the sheet

1. Create a Google Sheet named `NZ historical site evidence - working`.
2. For the first RA pass, import:
   - `site_evidence_wide.csv`
   - `controlled_vocabularies.csv`
3. For a fuller ingestion pilot, also import the normalised reference tabs:
   - `sources.csv`
   - `site_observations.csv`
   - `site_lifecycle_events.csv`
   - `candidate_matches.csv`
   - `review_notes.csv`
4. Freeze the first row on each tab.
5. Use `controlled_vocabularies.csv` for drop-down validation where practical.
6. Share the sheet with the project team only. Do not make the sheet public unless source licences and privacy checks permit public release.

## RA workflow

1. Use `site_evidence_wide.csv` as the main working tab. It is intentionally wide so human data entry can happen in one place.
2. Add one row per source-place record. If one source gives evidence for several distinct sites, use one row per site. If a source gives conflicting evidence for the same site, use separate rows and flag them for review.
3. Record all source-backed lifecycle evidence you find: organisation founding, first sighting, opening or dedication, relocation, closure, last sighting, change of use, and demolition.
4. Preserve historical addresses as evidence. Put any modern address or coordinates in the matching/geocoding fields and note the basis for that interpretation.
5. Preserve OpenStreetMap object ids, version timestamps, lifecycle tags, and visual verification notes where they are used as evidence.
6. Use the 2013, 2018, and 2023 status/evidence columns only when the source helps determine whether the place existed or was in worship use in those years.
7. Use target-year probability columns only when a reviewer or pipeline has made an explicit probability judgement. Enter values from `0` to `1`; leave blank otherwise.
8. Use `sources.csv`, `site_observations.csv`, and `candidate_matches.csv` as reference or downstream-normalised tabs when the team is ready to split the wide sheet into ingestion tables.
9. Use `review_notes.csv` for reviewer decisions, unresolved problems, and follow-up tasks.
10. Leave uncertain cases as `needs_review` rather than forcing a match.

## Data rules

- Record the evidence as found. Do not silently normalise names, addresses, or denominations without preserving the raw value.
- Do not collect personal contact details, office-holder names, private email addresses, phone numbers, or pastoral notes unless they are essential to source identification and approved for use.
- Keep restricted or licensed source files outside Git. Use `raw_file_location` to point to the controlled storage location.
- Prefer stable identifiers and URLs. If a source was downloaded, record the retrieval date and checksum when available.
- Treat changed streets, renamed localities, demolished buildings, and shifted road alignments as matching problems. Record the historical address separately from any modern address candidate, explain the address change, and lower `geocoding_confidence` where the location is uncertain.
- Do not collapse all lifecycle evidence into one birthday or death date. Use the specific date fields for organisation founding, site opening, building opening or dedication, first seen, last seen, closure, demolition, change of use, and relocation.
- Use bounded date fields when the source only gives a limit. For example, if a source proves the site existed before or by 2013 but gives no opening date, leave the exact opening fields blank and enter `2013` in `origin_not_later_than_date` with `origin_not_later_than_date_precision` set to `year`.
- Read `not_later_than` as "known by this date" and `not_earlier_than` as "cannot have occurred before this date". Use the closure equivalents for closure or end-of-use evidence.
- OpenStreetMap lifecycle tags such as `start_date`, `old_start_date`, and `end_date` are useful evidence, but they are not final truth. Preserve the raw tags and explain how they were interpreted.
- Visual checks from street maps, street-level imagery, aerial imagery, or historical maps should record the source, capture date where known, URL or file reference, and a short summary.
- Use date precision fields to distinguish exact dates from month-only, year-only, bounded, or uncertain dates.
- Use the target-year columns to record whether the source supports `present`, `absent`, `uncertain`, or `not_assessed` for 2013, 2018, and 2023.

## Review statuses

- `unreviewed`: extracted by the RA but not checked.
- `needs_review`: unclear date, match, classification, licence, or source interpretation.
- `accepted`: reviewer agrees this row can be used for ingestion.
- `excluded`: reviewer agrees this row should not be ingested.
- `deferred`: potentially useful but outside the current ingestion round.

## Handoff

When a batch is ready, export the tabs as CSV files and place them in the agreed controlled data location. The ingestion step should validate required fields, controlled vocabularies, coordinates, dates, source licences, and match confidence before writing to the master database.
