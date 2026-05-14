# Portal Submission Review Plan

Planning source of truth: `PLANNING.md`.

Portal hub: `docs/portal-data-entry-plan.md`.

Task-layer contract: `docs/convex-task-layer-spec.md`.

## Purpose

Review should be fast for trusted reviewers and strict about the master data
boundary. The review tool should show what was submitted, what the master
currently says, what evidence is available, which automated checks ran, and what
change would result if accepted.

## Current V1 Direction

The first review surface should be a small authenticated React + Vite + Convex
React workbench. It should review evidence already saved in Convex by the New
Zealand assignment page, then freeze accepted decisions into an export bundle
for `pow`.

```mermaid
flowchart LR
  A["Assigned task or<br/>Nominate missing PoW"] --> B["Convex shared task list"]
  B --> C["Evidence draft<br/>source, target years,<br/>lifecycle claims"]
  C --> D["Authenticated review portal"]
  D --> E["Review decision<br/>accept, reject, defer,<br/>needs more evidence,<br/>duplicate/link"]
  E --> B
  E --> F["Export bundle<br/>manifest, CSV/JSONL,<br/>review decisions"]
  F --> G["pow validate, stage,<br/>propose, diff"]
  G --> H["Accepted events and<br/>rebuilt public/research outputs"]
```

For v1, keep the decision vocabulary narrow and aligned with the current
Convex schema:

- `accepted_for_export`,
- `rejected`,
- `needs_more_evidence`,
- `duplicate_task`,
- `deferred`.

The portal should not write to the master, publish public map changes, or
create a second review database. It reads and writes Convex task/review state,
then relies on the export bundle and `pow` for governed data changes.

## Review Queue

The first queue should support:

- filter by country, priority, proposed action, validation status, submitter, and
  media presence
- map preview with selected point or building outline
- current master record and proposed staged values
- source and evidence references
- validation warnings and duplicate-risk flags
- optional AI review notes, clearly marked as suggestions
- reviewer decision controls

Default review decisions:

- accept for export
- reject
- request more evidence
- mark duplicate or link to an existing site
- defer

Later versions may add retract, supersede, and adjudication routing once the
first reviewed export round trip works.

## States

Submission states should be explicit:

- `submitted`
- `validating`
- `needs_triage`
- `under_review`
- `needs_more_info`
- `accepted_for_change_proposal`
- `rejected`
- `deferred`
- `retracted`
- `superseded`
- `exported_to_master_dry_run`

State changes should be append-only audit events. Avoid overwriting a previous
decision in place.

## Undo And Reversal

Before review, a contributor or reviewer may retract a staged submission. After
review, correction should happen through a superseding decision linked to the
earlier decision. After a master change is accepted, reversal should require a
new reviewed change proposal.

This preserves the ability to explain what happened when project records are
reported, audited, or rebuilt.

## GitHub Audit Mirror

GitHub can be useful for community visibility and durable public snapshots, but
it should not be the primary review backend. For the live task-map spike,
Convex should be the source of truth for task state and reviewer decisions until
they are exported into the `pow` pipeline. Durable storage layers should remain
the source of truth for raw submissions, quarantined media, and reviewed export
manifests. Optional GitHub exports may include:

- signed or checksummed batch manifests
- reviewed change summaries
- generated issues for community discussion
- pull requests for static docs or public export updates

Do not store private contributor details, restricted sources, raw uploads, or
unreviewed sensitive evidence in GitHub.
