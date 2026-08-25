# archive/

Two kinds of material share this directory. Check which kind a file is
before deleting it.

## Cited provenance (keep)

Source extracts and manifests that `docs/data-storage-pipeline.md` cites as
the archived origin of committed app data. They are part of the provenance
chain, not dead code.

- `statsnz-cen23-tbt-ta-religion/` — Stats NZ CEN23_TBT_008 extract
  (retrieved 2026-07-18) behind `apps/regions/nz/data/ta_aggregated_data.json`.
- `stats_nz_religious_affiliation_by_ta.csv` — the superseded Figure.NZ
  fallback the 2026-07-18 ruling replaced; retained because the pipeline doc
  cites it.
- `statsnz-2023-census-totals-sa2/` — SA2 religion extract and manifest
  (retrieved 2026-06-13).
- `statsnz-territorial-authority-2025-SHP/` — boundary metadata for the 2025
  territorial-authority layer.
- `geoboundaries-vut/`, `osm-vu-pow/` — Vanuatu boundary and OSM
  place-of-worship manifests behind the VU research map.

## Legacy (dead; kept only for the record)

`legacy/` holds the pre-2026-02 prototype: the FastAPI stubs, the original
`frontend/` and `src/` apps, one-off extraction scripts, the December-2025
demo HTML pages (`legacy/html/`), the territorial-authority JSON experiments
and their test script (`legacy/ta-json/`), and two planning notes
(`legacy/planning/`). Nothing here runs or is referenced by live code or
docs. Reorganised 2026-08-25 (stocktake item from 2026-08-14).
