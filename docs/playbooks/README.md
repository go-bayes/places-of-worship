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
- **Attribution is never optional** (JB standing rule, 2026-07-04):
  every data product carries its source attribution and licence in the
  manifest AND on the visible surface (map attribution line, page
  credit). A build that ships data without attribution fails acceptance
  regardless of everything else.
- Every playbook ends the same way: update `CHANGELOG.md` (dated entry
  under Unreleased), reconcile any doc the change makes stale
  (`AGENTS.md` Where To Look, README links), commit to `main` with an
  imperative lowercase subject ≤72 chars, no AI co-author trailer, push.
- Mark the playbook's Status line DONE with the commit hash.

The research playbooks (country survey, deep-history schema, external
evidence gathering, US data map, US deep past, manifest-and-docs, VU
spreadsheets) moved to the private research tier
(`~/GIT/pow-research/docs/playbooks/`) for the work phase. The platform
playbooks remain here:

| Playbook | Task | Depends on |
| --- | --- | --- |
| `free-contribution-portal.md` | #10 open RA intake design/build | deep-history-schema (private tier, types) |
| `fix-map-two-options.md` | #9 OSM + workbench routes on the maps | none |
| `session-batch-review.md` | batch review workflow | none |
