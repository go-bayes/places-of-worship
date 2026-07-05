# Execution playbooks

Self-contained work orders written 2026-07-04 (Fable planning session) so
that any later agent or narrow session can execute one playbook per
sitting without rediscovery. Each playbook carries its own context, exact
paths, step order, decision rules, and acceptance checks.

Rules for the executing agent:

- Read the playbook fully, then `AGENTS.md`, before touching anything.
- Stay inside the playbook's scope; park discoveries as notes at the end
  of the playbook file rather than expanding the work.
- Never touch `apps/regions/*/verification.html`, `review.html`, or the
  production Convex deployment.
- Every playbook ends the same way: update `CHANGELOG.md` (dated entry
  under Unreleased), reconcile any doc the change makes stale
  (`AGENTS.md` Where To Look, README links), commit to `main` with an
  imperative lowercase subject ≤72 chars, no AI co-author trailer, push.
- Mark the playbook's Status line DONE with the commit hash.

| Playbook | Task | Depends on |
| --- | --- | --- |
| `deep-history-schema.md` | #7 evidence contract for deep histories | none |
| `country-survey.md` | #3 global survey + build cards | none (template exists) |
| `free-contribution-portal.md` | #10 open RA intake design/build | deep-history-schema (types) |
| `fix-map-two-options.md` | #9 OSM + workbench routes on the maps | none |
| `manifest-and-docs.md` | #1 + #4 + #8 inventory and doc architecture | best done last |
| `guy-vu-spreadsheets.md` | #11 historical VU census ingestion | blocked on data arrival |
