# System Map

This document gives a compact view of the project as a set of deep modules.
A deep module has a simple outside interface and hides messy internal details.
The aim is to make the system easy to hold in mind, easy to develop, and easy
to assign work within.

The map is not a replacement for `ROADMAP.md` or the detailed planning and governance records in the private research tier. It is the architectural index: what the major parts are, what each part owns, and what each part gives to the next.

## Whole-System View

```mermaid
flowchart LR
  A["Source Library<br/>OSM, Census, church records,<br/>directories, imagery"] --> B["Extraction And Cleaning<br/>R scripts, cleaning rules,<br/>normalised records"]
  B --> C["Temporal Leads<br/>date tags, year differences,<br/>curated places to check"]
  C --> D["Shared Task List<br/>Convex assignments, status,<br/>workpacks and nominations"]
  U["Nominate Missing PoW<br/>provisional candidate task<br/>not an add-to-map action"] --> D
  D --> E["Evidence Intake<br/>drafts, source notes,<br/>target-year and historical claims"]
  E --> R["Authenticated Review Portal<br/>inspect evidence, decide,<br/>return status to task list"]
  R --> X["Reviewed Export Bundle<br/>tasks, events, evidence drafts,<br/>historical claims and decisions"]
  X --> F["Validation And Diff<br/>pow validate/stage/propose/diff"]
  F --> G["Master Reconstruction<br/>accepted events, replay,<br/>site states by date"]
  G --> H["Research Outputs<br/>maps, downloads, density tables,<br/>R workflows"]
  H --> I["Public And Portal UI<br/>global map, NZ map,<br/>reviewed public products"]

  J["Governance<br/>auth, privacy, licences,<br/>storage, audit"] -.-> A
  J -.-> D
  J -.-> R
  J -.-> F
  J -.-> H
```

## Module Table

| Module | Owns | Does not own | Main interface |
| --- | --- | --- | --- |
| Source Library | Durable source packages, source manifests, source licence and access notes. | Cleaning decisions or accepted site states. | Source files plus manifests with hashes, counts, dates, and access notes. |
| Extraction And Cleaning | Deterministic R scripts, current/global extraction rules, obvious false-positive removal, cleaned intermediate outputs. | RA assignments or final historical truth. | Cleaned datasets and generated places-to-check files. |
| Temporal Leads | OSM date-tag leads, OSM year-difference leads, candidate gain/loss windows, small RA workpacks. | Acceptance decisions or public map layers. | Curated workpack CSV/Sheet rows with one narrow evidence question per row. |
| Shared Task List | Who is working on what, task status, provisional closure, assignments, nominations, spreadsheet-submitted leads, and shared task history. | Accepted research data or master writes. | Convex task state; Sheets only as fallback/debug export or import adapter. |
| Evidence Intake | RA evidence drafts, source notes, target-year statuses, uncertainty, separate historical claims, and candidate identifiers. | Final acceptance decisions. | Evidence drafts and exported CSV/JSONL that can be validated and staged. |
| Authenticated Review Portal | Reviewer queues, evidence inspection, accept/reject/defer/revise decisions, and RA-visible next actions. | Master writes or public map updates. | Review decisions and task-state updates in Convex. |
| Reviewed Export Bundle | Frozen task, event, evidence, and decision files for governed handoff. | Research estimates or public map layers. | Manifested CSV/JSONL bundle for `pow`. |
| Validation And Diff | `pow` validation, staging, proposal generation, reviewer diff reports, and replay checks. | Public research products or live task assignment. | Accepted, rejected, deferred, or revised events with rationale and hashes. |
| Master Reconstruction | Replay of accepted events, target-year site states, deterministic rebuilds. | Raw source collection or provisional task status. | Rebuilt snapshots and master state tables for target years and current maps. |
| Research Outputs | Density tables, map layers, downloads, R-readable summaries, analysis workflows. | Data intake or review decisions. | Investigator-facing CSV, GeoJSON, JSON, and R outputs. |
| Public And Portal UI | Map display, inspection, future authenticated contribution surfaces. | Direct master writes. | Read-only public products and, later, authenticated staged submissions. |
| Governance | Auth, privacy, licensing, storage rules, audit expectations, provider boundaries. | Day-to-day task completion. | Cross-module rules and checks that every module must respect. |

## Current Tactical Focus

The immediate New Zealand pilot has five stages spanning six modules:

1. **Temporal Leads**: generate the first 50-record RA workpack from OSM date
   tags and year-difference leads.
2. **Shared Task List**: assign that work through Convex, with the Sheet path
   retained only as fallback/debug export.
3. **Evidence Intake**: record source-backed target-year evidence, separate historical events or states, exact denomination or tradition labels, and guided direct observation, interpretation, and uncertainty.
4. **Authenticated Review Portal**: let JB/JW inspect submitted evidence and
   record decisions that update the task list.
5. **Reviewed Export Bundle** and **Validation And Diff**: freeze accepted
   decisions, validate, stage, propose, diff, and review the returned evidence
   before anything can affect the master.

The planned field-observation packet extends Evidence Intake without changing this authority chain. Restricted object storage holds image artefacts and exact capture metadata; Convex holds guided text, opaque references, and workflow state; reviewers adjudicate provisional claims; and only governed `pow` exports can become accepted events.

## Development Rule

Every active task should name its module. A task can depend on another module's
output, but it should have one primary home.

Examples:

- `Generate first 50-record NZ temporal workpack` belongs to **Temporal Leads**.
- `Check assigned records` belongs to **Evidence Intake**.
- `Write Vanuatu source-first protocol` belongs to **Source Library**.
- `Define Vanuatu target years and timeline anchors` belongs to **Temporal
  Leads**.
- `Wire shared task status` belongs to **Shared Task List**.
- `Build review queue and decision form` belongs to **Authenticated Review Portal**.
- `Add reviewer decision semantics to pow` belongs to **Validation And Diff**.

This keeps tactical work connected to the system design without turning the
roadmap into a task tracker.
