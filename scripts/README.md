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
- Use `uv sync` to install or refresh Python dependencies from `pyproject.toml`.
- Run Python scripts with `uv run` when needed.
- Install the optional `pyarrow` fast path only when needed with `uv sync --extra fast-parquet`.

Current NZ cleanup utilities:

- `scripts/fetch_ta_religion_data.R`: align TA religion data to official TA codes and write `apps/regions/nz/data/ta_aggregated_data.json`.
- `scripts/clean_nz_places.py`: remove obvious non-worship records from the committed NZ places datasets.
- `scripts/build_nz_review_queue.py`: build `docs/nz-manual-review-queue.md` and `docs/nz-manual-review-queue.csv` for manual review.

Current global pipeline scaffolding:

- `scripts/extract_global_data.R`: raw global extractor that writes dated country payloads to `data/raw/osm/<snapshot_date>/`.
- `scripts/normalize_global_places.R`: normalise raw country payloads into a stable intermediate schema under `data/intermediate/global/<snapshot_date>/`.
- `scripts/clean_global_places.R`: apply conservative shared cleaning rules to normalised country datasets and write cleaned outputs and manifests under `data/intermediate/global/<snapshot_date>/`.
- `scripts/deduplicate_global_places.R`: collapse only very likely duplicate cleaned records and write deduplicated outputs and resolution logs under `data/intermediate/global/<snapshot_date>/`.
- `scripts/build_global_review_queue.R`: classify cleaned or deduplicated country datasets into review queues under `docs/review_queues/<snapshot_date>/`.
- `scripts/clean_global_places.py`, `scripts/deduplicate_global_places.py`, and `scripts/build_global_review_queue.py`: transitional reference implementations retained during the R migration.
- `docs/global-extractor-audit.md`: audit and staged replacement workflow for the global pipeline.
