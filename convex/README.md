# Convex Task Layer

This directory contains the first Convex backend scaffold for the New Zealand
research-assistant task map.

It owns provisional workflow state only:

- task batches,
- task status and assignment,
- task events,
- evidence drafts,
- reviewer decisions,
- curator export batches.

It does not write to the master database or public map exports. Reviewed Convex
data must be exported into the governed `pow` validation and rebuild path before
it can affect public or research-facing products.

Implementation notes:

- `schema.ts` defines the database tables and indexes.
- `users.ts` handles invite-only project users and role claims.
- `tasks.ts` imports static tasks, claims/releases work, records skips,
  provisionally closes tasks, and creates manual candidate tasks.
- `evidence.ts` saves and submits RA evidence drafts.
- `reviews.ts` records reviewer decisions.
- `exports.ts` creates frozen export bundles for curator handoff.

See `docs/development/convex-task-layer-setup.md` for local setup and seed
instructions.
