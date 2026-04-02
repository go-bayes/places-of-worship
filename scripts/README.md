# Scripts

Data preparation and pipeline utilities (R and Python).

Outputs:
- `apps/regions/nz/data` for the NZ enhanced app.
- `data/` for global or intermediate datasets.

Run scripts from the repo root so relative paths resolve.

Current NZ cleanup utilities:

- `scripts/fetch_ta_religion_data.R`: align TA religion data to official TA codes and write `apps/regions/nz/data/ta_aggregated_data.json`.
- `scripts/clean_nz_places.py`: remove obvious non-worship records from the committed NZ places datasets.
- `scripts/build_nz_review_queue.py`: build `docs/nz-manual-review-queue.md` and `docs/nz-manual-review-queue.csv` for manual review.
