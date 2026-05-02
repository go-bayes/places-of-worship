# Portal Submission Review Plan

Planning source of truth: `PLANNING.md`.

Portal hub: `docs/portal-data-entry-plan.md`.

## Purpose

Review should be fast for trusted reviewers and strict about the master data
boundary. The review tool should show what was submitted, what the master
currently says, what evidence is available, which automated checks ran, and what
change would result if accepted.

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

- accept
- reject
- request more information
- defer
- retract
- supersede
- route to adjudication

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
it should not be the primary review backend. The portal database and storage
layer should be the source of truth. Optional GitHub exports may include:

- signed or checksummed batch manifests
- reviewed change summaries
- generated issues for community discussion
- pull requests for static docs or public export updates

Do not store private contributor details, restricted sources, raw uploads, or
unreviewed sensitive evidence in GitHub.
