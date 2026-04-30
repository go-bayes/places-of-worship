# RA historical site evidence template

This folder contains Google Sheets-ready CSV tabs for collecting evidence about historical places of worship, starting with New Zealand 2013 and 2018 place-density reconstruction.

The template is for source evidence, not final counts. Each row should record a claim from a source, how it was dated, how it may match to a site, and what review status it currently has. Final ingestion should only use rows that pass review.

## How to set up the sheet

1. Create a Google Sheet named `NZ historical site evidence - working`.
2. Import each CSV in this folder as a separate tab:
   - `sources.csv`
   - `site_observations.csv`
   - `candidate_matches.csv`
   - `review_notes.csv`
   - `controlled_vocabularies.csv`
3. Freeze the first row on each tab.
4. Use `controlled_vocabularies.csv` for drop-down validation where practical.
5. Share the sheet with the project team only. Do not make the sheet public unless source licences and privacy checks permit public release.

## RA workflow

1. Add one row to `sources.csv` for each dataset, directory, archive, register, or file inspected.
2. Add one row to `site_observations.csv` for each site claim found in a source.
3. Use `candidate_matches.csv` when a source claim may match one or more existing places on the map.
4. Use `review_notes.csv` for reviewer decisions, unresolved problems, and follow-up tasks.
5. Leave uncertain cases as `needs_review` rather than forcing a match.

## Data rules

- Record the evidence as found. Do not silently normalise names, addresses, or denominations without preserving the raw value.
- Do not collect personal contact details, office-holder names, private email addresses, phone numbers, or pastoral notes unless they are essential to source identification and approved for use.
- Keep restricted or licensed source files outside Git. Use `raw_file_location` to point to the controlled storage location.
- Prefer stable identifiers and URLs. If a source was downloaded, record the retrieval date and checksum when available.
- Use `target_year` for the census year the observation is intended to inform, usually `2013` or `2018`.
- Use `observation_date_basis` and `date_precision` to distinguish precise evidence from year-only or range-based evidence.

## Review statuses

- `unreviewed`: extracted by the RA but not checked.
- `needs_review`: unclear date, match, classification, licence, or source interpretation.
- `accepted`: reviewer agrees this row can be used for ingestion.
- `excluded`: reviewer agrees this row should not be ingested.
- `deferred`: potentially useful but outside the current ingestion round.

## Handoff

When a batch is ready, export the tabs as CSV files and place them in the agreed controlled data location. The ingestion step should validate required fields, controlled vocabularies, coordinates, dates, source licences, and match confidence before writing to the master database.
