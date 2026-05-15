# RA historical site evidence template

This folder contains Google Sheets-ready CSV tabs for collecting evidence about
historical places of worship. The default template starts with New Zealand
lifecycle evidence and 2013, 2018, and 2023 place-density reconstruction.
Other countries should use the same evidence logic with country-specific target
years. For Vanuatu, the first target-year set is 1989, 1999, 2009, and 2020.

The template is for source evidence, not final counts. Each row should record what a source says about a place, how the evidence was dated, how it may match to a site, and what review status it currently has. Final ingestion should only use rows that pass review.

## How to set up the sheet

The pilot should use a project-owned Google Sheet, not an RA-owned copy. To
build the import workbook from these CSV tabs, run from the repo root:

```sh
uv run scripts/build_ra_working_sheet.py
```

The script writes an `.xlsx` workbook under `exports/`, which is gitignored.
Import that workbook into Google Drive as a native Google Sheet, then share the
Google Sheet directly with the RA. Do not commit the private sheet link to
GitHub. The workbook includes frozen header rows, filters, and dropdown
validation for the main controlled fields in `site_evidence_wide`.

The generated workbook includes:

- `site_evidence_wide.csv`, the main RA working tab
- `controlled_vocabularies.csv`
- `sources.csv`
- `site_observations.csv`
- `site_lifecycle_events.csv`
- `candidate_matches.csv`
- `review_notes.csv`

Share the sheet with the project team and assigned RA only. Do not make the
sheet public unless source licences and privacy checks permit public release.

## RA workflow

1. Use `site_evidence_wide.csv` as the main working tab. It is intentionally wide so human data entry can happen in one place.
2. Add one row per source-place record. If one source gives evidence for several distinct sites, use one row per site. If a source gives conflicting evidence for the same site, use separate rows and flag them for review.
3. Record all source-backed lifecycle evidence you find: organisation founding, first sighting, opening or dedication, relocation, closure, last sighting, change of use, and demolition. Here, lifecycle means dated evidence about the history of the worship site, organisation, building, or worship function; keep building dates and worship-use dates separate where possible.
4. Preserve historical addresses as evidence. Put any modern address or coordinates in the matching/geocoding fields and note the basis for that interpretation.
5. Preserve OpenStreetMap object ids, version timestamps, lifecycle tags, and visual verification notes where they are used as evidence.
6. Use `source_type = street_imagery` for dated street-level imagery such as Google Street View, Apple Look Around, Mapillary, KartaView, Bing Streetside, or comparable services. Record the provider, URL or agreed reference, displayed capture date, and a short summary of what the image shows. Do not store screenshots in Git.
7. Use `source_type = field_observation` for direct RA or project-team site visits. Record the visit date and site-level observation, but do not record private conversations, personal contact details, photos, or videos unless the project team has explicitly approved the collection and storage path.
8. Use target-year status/evidence columns only when the source helps
   determine whether the place existed or was in worship use in those years.
   The default New Zealand sheet uses 2013, 2018, and 2023; country-specific
   sheets may replace these with the relevant census or research years.
9. Use target-year probability columns only when a reviewer or pipeline has made an explicit probability judgement. Enter values from `0` to `1`; leave blank otherwise.
10. Use `sources.csv`, `site_observations.csv`, and `candidate_matches.csv` as reference or downstream-normalised tabs when the team is ready to split the wide sheet into ingestion tables.
11. Use `review_notes.csv` for reviewer decisions, unresolved problems, and follow-up tasks.
12. Leave uncertain cases as `needs_review` rather than forcing a match.
13. Leave unknown or non-applicable open cells blank. Do not type `NA`, `N/A`,
    or similar placeholders. Use controlled values such as `unknown`,
    `uncertain`, `none`, and `not_assessed` only in fields where those values
    are offered.

## Data rules

- Record the evidence as found. Do not silently normalise names, addresses, or denominations without preserving the raw value.
- Do not collect personal contact details, office-holder names, private email addresses, phone numbers, or pastoral notes unless they are essential to source identification and approved for use.
- Keep restricted or licensed source files outside Git. Use `raw_file_location` to point to the controlled storage location.
- Prefer stable identifiers and URLs. If a source was downloaded, record the retrieval date and checksum when available.
- A place missing from the project map may already have an OSM candidate object.
  Record that OSM id and object type as source or matching evidence; do not
  treat it as the project site id.
- Keep absent-building evidence distinct from worship-use closure. Use
  `existence_status = absent` when the source suggests the mapped building is
  gone, no building is visible at the mapped point, or the geometry may be
  wrong. Use `worship_use_status = not_worship` when the source supports no
  active worship use; use `uncertain` when it only raises a question.
- Treat changed streets, renamed localities, demolished buildings, and shifted road alignments as matching problems. Record the historical address separately from any modern address candidate, explain the address change, and lower `geocoding_confidence` where the location is uncertain.
- Do not collapse all lifecycle evidence into one birthday or death date. Use the specific date fields for organisation founding, site opening, building opening or dedication, first seen, last seen, closure, demolition, change of use, and relocation.
- Use `use_changed_date` for later worship-function changes that do not fit a
  simple opening or closure field, including evidence that a site became shared,
  multi-use, or multi-denominational.
- Use bounded date fields when the source only gives a limit. For example, if a source proves the site existed before or by 2013 but gives no opening date, leave the exact opening fields blank and enter `2013` in `origin_not_later_than_date` with `origin_not_later_than_date_precision` set to `year`.
- Read `not_later_than` as "known by this date" and `not_earlier_than` as "cannot have occurred before this date". Use the closure equivalents for closure or end-of-use evidence.
- Enter dates only as `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`. Do not enter prose
  dates such as `Sept 2018`, seasons, circa notation, or `NA`; preserve that
  detail in `date_evidence_raw` or the evidence note.
- OpenStreetMap lifecycle tags such as `start_date`, `old_start_date`, and `end_date` are useful evidence, but they are not final truth. Preserve the raw tags and explain how they were interpreted.
- Visual checks from street maps, street-level imagery, aerial imagery, historical maps, or field observations should record the provider or observer type, capture or visit date where known, URL or agreed file reference, and a short summary.
- Street-level imagery and field observations can strongly support visible worship-use claims, but absence of visible signage should usually be treated as weak or uncertain evidence for absence.
- Use date precision fields to distinguish exact dates from month-only, year-only, bounded, or uncertain dates.
- Use the target-year columns to record whether the source supports `present`,
  `absent`, `uncertain`, or `not_assessed` for the country-specific target
  years. Preserve other useful dates in the lifecycle fields rather than
  forcing them into a target year.
- Country protocols may need much earlier lifecycle dates. For Vanuatu, the
  evidence-entry interface should accept valid `YYYY`, `YYYY-MM`, and
  `YYYY-MM-DD` dates from 1600 onward.

## Review statuses

- `unreviewed`: extracted by the RA but not checked.
- `needs_review`: unclear date, match, classification, licence, or source interpretation.
- `accepted`: reviewer agrees this row can be used for ingestion.
- `excluded`: reviewer agrees this row should not be ingested.
- `deferred`: potentially useful but outside the current ingestion round.

## Handoff

When a batch is ready, export the tabs as CSV files and place them in the agreed controlled data location. The ingestion step should validate required fields, controlled vocabularies, coordinates, dates, source licences, and match confidence before writing to the master database.
