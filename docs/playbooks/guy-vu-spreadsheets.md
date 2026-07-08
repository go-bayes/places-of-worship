# Playbook: ingest Guy's historical Vanuatu census spreadsheets

Status: PARTIALLY DONE 2026-07-08 (commit 78d3c52) — Guy's first delivery
was scans of the 1999/2009/2020 census table volumes; 2009/2020 were
byte-identical to files already extracted, and the 1999 Main Report
(print-only until now) yielded province-level religion. The 1967 first
census (McArthur & Yaxley Table A) is now digitised and aggregated
island→province (scripts/build_vu_1967_provinces.py), so the province
slider runs 1967–2020 and the map carries five denomination shares
(customary beliefs plus four mission churches). REMAINING: the 1999
island-level rows (in the scan, for AC harmonisation), the 1979 and 1989
censuses, and Guy's promised single harmonised AC-level spreadsheet
(religion, demographics, language) from first census to present — his
backbone for the religious-diversification paper linking Bob's
historical missions data. Guy's Google account is on file with JB for
the portal invite; keep personal emails out of this public repo.
Task: #11. Effort: one sitting per delivery.

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

## Island-level longitudinal lane (Guy's proposal, 2026-07-09)

Guy proposes island-level estimates over time as the VU longitudinal
spine: islands are easily identifiable, stable across years, and give
~66 inhabited-island granularity potentially consistent across every
census 1967-2020 — whereas area councils change and did not exist in
1967 or 1979, and pre-1994 "provinces" were eleven regions. The repo
already supports the early end: the digitised 1967 Table A
(`apps/regions/vu/data/source/vu_religion_by_island_1967_mcarthur_tableA.csv`)
is island-grain (66 rows, per-mille shares, 15+ universe), and the
current pipeline aggregates island→province, discarding that grain.
The 1999 island rows await transcription from Guy's scan.

Design sketch:
- Harmonised unit: "island unit" — an island or named island group,
  defined once with stable ids; small islets grouped where censuses
  group them. The concordance table (island unit ↔ 1967 Table A island
  ↔ 2020 area councils ↔ province) is the load-bearing artefact.
- Modern end, in preference order: (1) published religion-by-island
  tables in 2009/2020 Basic Tables if they exist; (2) AC→island
  aggregation where every AC lies wholly within one island unit;
  (3) island units coarsened to make (2) true.
- Boundaries: island polygons are stable — derivable from the AC layer
  (`apps/regions/vu/data/adm2_2020.geojson`) by dissolve where ACs
  nest, else from coastline data.
- Small-cell care: 1967 published tiny islands (Hiu: 26 aged 15+);
  modern tables may suppress or perturb small cells — document per
  wave, quality_flag small denominators (existing wash-flag treatment).
- Product shape: a third VU censusLevel (`island_unit`) alongside
  provinces and ACs, letting the slider run 1967-2020 at one stable
  geography.

Wave-by-wave verdicts (researched 2026-07-09; full report in the
session scratchpad, key facts verified against repo extracts):
- 1967 ATTAINABLE — digitised, 66 islands (Table A).
- 1979 NOT YET — no accessible copy located; grain unknown; next step
  is a Trove/NLA catalogue search for the New Hebrides 1979 census
  volumes (the 1989 report's sibling record).
- 1989 province-only ceiling (print scan, NLA 3027354 / SPC 25wd8);
  the island spine carries a documented gap here.
- 1999 NEEDS-TRANSCRIPTION — island rows exist in Guy's scan.
- 2009 ATTAINABLE — Basic Tables T3.5 is already island-grain in our
  extract (`geo_level == "island"`, 64 islands, 12 categories).
- 2020 ATTAINABLE-VIA-AGGREGATION — AC→island-group; exactly six ACs
  bundle multiple islands (Torres, Makimae, Merelava, Motalava,
  Vanua Lava, Nguna) and become island-group units.

Boundary caution: the AC layer (geoBoundaries VUT) has 65 features —
Torres is MISSING a polygon (known manifest flag); island polygons
should come from OSM coastline data (ODbL) rather than dissolving the
AC layer. Build order: island-unit concordance (with the six
island-group rules) → 1967+2009 product (no new transcription needed)
→ 2020 aggregation → 1999 when Guy transcribes → 1979 if the volume
surfaces.

## Watch for

- Boundary comparability: pre-1994 provinces were ELEVEN local
  government regions, not the six provinces — if 1989 data uses the old
  regions, a crosswalk to the six provinces is required before mapping;
  document whichever Guy's sheets use. 1999 uses the six provinces.
- Category drift across years: never silently merge categories; the
  normalised label column plus notes carries the mapping.
