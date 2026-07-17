# Scripts

Data preparation and pipeline utilities.

Outputs:
- `apps/regions/nz/data` for the NZ enhanced app.
- `data/` for global or intermediate datasets.

Run scripts from the repo root so relative paths resolve.

Canonical workflow:
- Use the R scripts below as the primary research pipeline.
- Keep Python for the API and supporting utilities where there is a clear advantage.

Python environment:
- Use `uv sync` for the lightweight default Python environment.
- Run standard-library support scripts with `uv run` when needed.
- Install the API prototype stack only when needed with `uv sync --extra api`.
- Run the Parquet-backed API path with both extras:
  `uv sync --extra api --extra fast-parquet`.
- Install the optional `pyarrow` fast path only when needed with
  `uv sync --extra fast-parquet`.
- Install archived legacy Python dependencies only when inspecting old code with
  `uv sync --extra legacy`.

Current NZ cleanup utilities:

- `~/GIT/pow-research/pipeline/build_ta_aggregated_from_cen23_tbt.R`: validate the archived official Stats NZ CEN23_TBT_008 extract for 2013, 2018, and 2023, align it to the 67 shipped TA codes, and write `apps/regions/nz/data/ta_aggregated_data.json`. The former Figure.NZ fetcher now lives at `~/GIT/pow-research/pipeline/fetch_ta_religion_data.R` and its CSV is a superseded fallback.
- `~/GIT/pow-research/pipeline/build_nz_area_summary.R`: build the territorial-authority `area_summary` product from current NZ places, TA boundaries, and official 2013/2018/2023 religion data.
- `scripts/clean_nz_places.py`: remove obvious non-worship records from the committed NZ places datasets.
- `scripts/build_nz_review_queue.py`: build `docs/nz-manual-review-queue.md` and `docs/nz-manual-review-queue.csv` for manual review.
- `scripts/build_ra_working_sheet.py`: build the project-owned RA Google Sheets import workbook from `docs/templates/ra-historical-site-evidence/`; the generated `.xlsx` goes under gitignored `exports/` and should be imported into Google Drive as a native Sheet. The workbook includes frozen headers, filters, and dropdown validation for the main controlled fields.

Current global pipeline scaffolding:

- `scripts/extract_global_data.R`: raw global extractor that writes dated country payloads to `data/raw/osm/<snapshot_date>/`.
- `scripts/normalize_global_places.R`: normalise raw country payloads into a stable intermediate schema under `data/intermediate/global/<snapshot_date>/`.
- `scripts/clean_global_places.R`: apply conservative shared cleaning rules to normalised country datasets and write cleaned outputs and manifests under `data/intermediate/global/<snapshot_date>/`.
- `scripts/deduplicate_global_places.R`: collapse only very likely duplicate cleaned records and write deduplicated outputs and resolution logs under `data/intermediate/global/<snapshot_date>/`.
- `scripts/build_global_review_queue.R`: classify cleaned or deduplicated country datasets into review queues under `docs/review_queues/<snapshot_date>/`.
- `scripts/clean_global_places.py`, `scripts/deduplicate_global_places.py`, and `scripts/build_global_review_queue.py`: transitional reference implementations retained during the R migration.
- `docs/global-extractor-audit.md`: audit and staged replacement workflow for the global pipeline.
