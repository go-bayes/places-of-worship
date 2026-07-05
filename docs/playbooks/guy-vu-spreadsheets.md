# Playbook: ingest Guy's historical Vanuatu census spreadsheets

Status: BLOCKED — waiting on data from Guy (JB obtaining, expected
within days of 2026-07-04)
Task: #11. Effort: one sitting once files arrive.

## Why this matters

Guy holds spreadsheets of historical Vanuatu census data. Digitised
1989/1999 (and possibly earlier) religion tables at province level exist
nowhere online — the project's own extraction confirmed print-only
(1999 Main Report: NLA catalogue 1663689; 1989 likewise). If Guy's
sheets carry sub-national religion for pre-2009 censuses, the VU map's
time depth extends immediately.

## On arrival

1. **Quarantine + provenance first**: copy originals untouched to
   `data/raw/vu_census_guy/` (git-ignored); record in a `sources.csv`
   sibling: file name, SHA-256, received-from, received-date, Guy's own
   source citation for each sheet (which census volume/table), and any
   licence/permission statement from Guy's email. Ask JB to forward the
   permission context if absent.
2. **Inventory**: per sheet — census year, geography level, categories,
   whether counts or percentages, and Guy's transformations if any.
3. **Validate against knowns** before use:
   - national religion 1989/1999/2009/2020 must match
     `apps/regions/vu/data/source/vu_religion_national_1989_1999_2009_2020_analytical_t30.csv`;
   - 2009 province values must match
     `vu_religion_by_province_2009_basictables_t3_5.csv` (that file sums
     exactly — discrepancies mean transcription differences to resolve);
   - provinces must sum to national within documented perturbation.
4. **Extract to the project shape**: tidy CSVs matching the existing
   source files (geography, geo_level, province, census_year,
   religion_label_source, religion_label_normalised, count). Keep Guy's
   labels verbatim in `religion_label_source`; extend the normalised
   vocabulary only if a genuinely new category appears (note: 1989
   lacks AOG/NTM/Apostolic/LDS as separate categories).
5. **Extend the map**: add earlier years to
   `scripts/build_vu_area_summary.R` inputs; provinces gain 1989/1999
   rows (area councils did not exist then — province level only). The
   scaffold needs year rows added: mirror how 2009/2020 rows were
   seeded (`scripts/build_vu_area_scaffold.R`). Update VU
   `REGION_CONFIG` onboarding copy (years now 1989–2020) — the module
   reads years from the summary, so the slider extends automatically.
6. **Manifest** in `docs/manifests/` (pattern:
   `vu-census-religion-2009-2020-d17f5596eca1.json`), crediting Guy's
   digitisation explicitly in the source chain. Changelog names Guy's
   contribution. Verify in browser (slider reaches 1989; change metric
   behaves across the new gaps), commit, push.

## Watch for

- Boundary comparability: pre-1994 provinces were ELEVEN local
  government regions, not the six provinces — if 1989 data uses the old
  regions, a crosswalk to the six provinces is required before mapping;
  document whichever Guy's sheets use. 1999 uses the six provinces.
- Category drift across years: never silently merge categories; the
  normalised label column plus notes carries the mapping.
