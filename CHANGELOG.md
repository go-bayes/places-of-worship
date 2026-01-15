# Changelog

## Unreleased
- Introduced `apps/global` and `apps/nz-enhanced` structure for frontends.
- Added legacy URL shims for `/`, `/enhanced-places.html`, and `frontend/` + `src/` paths.
- Added root `PLANNING.md` and consolidated planning notes.
- Updated Enhanced NZ data pipeline scripts to emit into `apps/nz-enhanced/data` while preserving legacy outputs.
- Switched global map Enhanced NZ link to a relative path for local and production parity.
- Made Enhanced NZ data loading resilient to `/apps/nz-enhanced/` and legacy URL entry points.
- Normalised coordinates from vector tiles to restore Street View links at low zoom.
- Added a Rust migration plan for data ingestion + API in `PLANNING.md`.
- Added a draft decision log section to `PLANNING.md`.
- Added an initial open decision entry for the Rust feasibility test (aka 'Spike').
- Added decision placeholders for regional data storage and portal adapter strategy.
