# Archived documentation

Superseded or completed documents kept for the historical record. Nothing here describes the current system.

- `architecture.md`, `runbook.md`, `deployment-strategy.md`: pre-2026-07 architecture and operations notes. They document the retired `placesmap.org` domain and the retired GCP-VM tile stack; the site is now `religionmap.org` and tiles serve from Cloudflare R2 (`tools/tiles-r2/`).
- `api-specification.md`, `schema-integration.md`: the 2025-08 Parquet + FastAPI two-layer design. The FastAPI prototype (`api/`) was removed on 2026-08-14; the Convex task layer (`convex/`) is the live backend.
- `global-extractor-audit.md`, `nz-data-cleanup-audit.md`, `nz-manual-review-queue.{md,csv}`, `review_queues/`: completed one-shot audits and their review queues.

For the current architecture, start at `docs/system-map.md`.
