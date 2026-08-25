# Documentation Health Check

This checklist keeps project documents aligned as the task map, review portal,
and governed data pipeline change. It is intentionally light. The aim is to
reduce confusion for future maintainers without turning documentation into a
separate project.

## When To Run This Check

Run this checklist:

- before sending instructions to a research assistant,
- before expanding a country pilot,
- before merging a change that affects task intake, review, export, storage, or
  public map behaviour,
- after a major planning decision,
- weekly while the Convex-backed pilot is active.

This is not yet a blocking Git hook. A blocking hook would be too noisy while
the workflow is still moving. If the checklist proves stable, add a script that
checks links, required phrases, and known cross-reference pairs.

## Fast Pass

1. Does `README.md` still send a new collaborator to the right current links?
2. Does `ROADMAP.md` still describe phases rather than yesterday's task list?
3. Does `PLANNING.md` still match the active next steps?
4. Does `FAQ.md` contain the durable answers we keep repeating in discussion?
5. Does `LEXICON.md` explain any new jargon in plain language?
6. Does `docs/system-map.md` still show the right modules and boundaries?
7. Are RA-facing docs true for the live interface?
8. Do Convex docs match the functions that are currently deployed or planned?
9. Do storage docs say where important data lives outside a laptop?
10. Do public-facing docs avoid private agent-process language?

## High-Risk Drift Points

### Master Boundary

Check that docs consistently say:

- RAs and public users nominate candidates, they do not add records directly to
  the public map.
- Use `Nominate missing PoW`, not `Add to map`, for candidate intake.
- Accepted data changes pass through review, export, `pow` validation, diff,
  replay, and rebuild.
- Convex is the live task and review layer, not the canonical master database.

### Research Meaning

Check that docs consistently preserve these distinctions:

- worship function versus building existence,
- historical gain or loss versus correction of a bad record,
- OSM source identifiers versus durable project `site_id`,
- provisional target-year evidence versus accepted target-year state,
- task status versus accepted research data.

### RA Instructions

Before sending RA instructions, check:

- `docs/ra-nz-pilot-task.md`,
- `docs/ra-map-triage-guide.md`,
- `docs/ui-style-guide.md` when the visible interface changed,
- `FAQ.md` for recurring conceptual questions.

The RA-facing path should be simple: open the assigned link, sign in, work down
the assigned tasks, save draft or submit for review, and move on. Spreadsheet
copy/paste should be described only as fallback.

### Convex And Review Workflow

When a Convex function, schema, or front-end task flow changes, check:

- `docs/convex-task-layer-spec.md`,
- `docs/development/convex-task-layer-setup.md`,
- `docs/api/convex-functions.md`,
- `docs/api/workflow-scripts.md` if task seeds, workpacks, export bundles, or
  `pow` handoff scripts changed,
- `ROADMAP.md` if the phase changed,
- `PLANNING.md` if the next step changed,
- `JOURNAL.md` if the decision matters later,
- `CHANGELOG.md` if behaviour visible to collaborators changed.

### Data Storage

When generated data is used for RA tasks, map products, analysis, or reporting,
check:

- `docs/data-storage-pipeline.md`,
- relevant files in `docs/manifests/`,
- `PLANNING.md` near the storage and OSM temporal sections,
- `JOURNAL.md` if a storage decision changed.

Ignored local files are cache. Durable project data needs a project-controlled
location, manifest, checksum, counts, source caveats, licence/privacy status,
and rebuild instructions.

## Decision Routing

Use this routing rule when a document contains something that looks stale:

- **Decision or rationale:** move or copy the durable point into `JOURNAL.md`.
- **Current priority or active plan:** keep it in `PLANNING.md`.
- **Phase or milestone:** keep it in `ROADMAP.md`.
- **Recurring conceptual answer:** add it to `FAQ.md`.
- **Plain-language definition:** add it to `LEXICON.md`.
- **Implementation contract:** add it to `docs/api/` or the relevant spec.
- **Speculative option:** keep it in `BRAINSTORMING.md`.

Do not keep the same live instruction in three places unless one is explicitly
the summary and the others point to it.

## Questions For A Periodic Review

1. What changed in the live interface since the last review?
2. What changed in the data contract or export path?
3. What changed in who can write, review, export, or publish?
4. What changed in where durable data is stored?
5. What instruction would confuse an RA if they followed it today?
6. What phrase would confuse JB, JW, a funder, or a future maintainer?
7. Which open question should now be a decision?
8. Which decision should now be a FAQ entry?

## Run Record

- 2026-08-25 (audit sitting, read-only pass then fixes): fast-pass items 6, 8,
  and 9 checked. Corrected the retired GCP tile-hosting description in
  `docs/data-storage.md`; added `adminUpsertTasksFromStaticMap` to
  `docs/api/convex-functions.md`; removed the root `enhanced-places.html` shim
  and `ideas/`; marked four consumer-less schemas aspirational; split
  `archive/` into provenance and legacy with a README. Left as deliberate
  design references: the Google Cloud/PostGIS "durable staging" statements
  in the portal storage, data-entry, ingestion, and pipeline plans (no such
  deployment exists today; the plans still name it as the reference).
  Left with their dated status lines: the 2026-07 DRAFT/PROPOSED markers on
  `portal-ra-feedback-and-training.md`, `multi-domain-overlay-design.md`,
  `revision-pipeline-all-countries.md`, and the pending invite note in
  `workbench-publication-plan.md`. Items 1-5, 7, and 10 were not re-read.
