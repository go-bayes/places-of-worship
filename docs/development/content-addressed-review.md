# Content-Addressed Review Contract

**Status:** Design proposal, 2026-08-27. This document defines the intended contract. Live schemas, mutations, exports, and `pow` commands remain unchanged.

## Decision In Brief

Review proposals should behave like commits. A submitted evidence version receives a content-derived identifier, a revision links to its parent, a change proposal identifies the accepted state on which it was based, and every review decision identifies the proposal version the reviewer considered. Accepted events and export manifests continue the same chain into `pow` and the rebuilt research products.

Convex remains the shared task and review service. `pow` remains the governed validation, acceptance, replay, and export boundary. Git stores code, schemas, documentation, and compact manifests. The content-addressed contract lets the dashboard, command-line tools, and later agent clients refer to the same review objects. Per-task Git branches and GitHub pull requests remain outside the review workflow.

## The Pull-Request Analogy

The analogy maps Git's version structure and review relations onto project review objects. Convex and `pow` continue to store and process those objects.

| Git concept | Places-of-worship equivalent | Consequence |
| --- | --- | --- |
| Base commit | Accepted site-state or event-log hash | A proposal states the accepted state from which it was prepared. |
| Commit | Immutable proposal version | A reviewer can retrieve the proposal that a decision concerns. |
| Parent commit | Parent proposal hash | Revisions retain earlier proposals and link the proposal history. |
| Diff | `pow diff` over proposed events | Review concerns the scientific and analytical consequences of a proposed change. |
| Review comment | Task-linked question or review note | Questions can identify a proposal, evidence version, field, or map artefact. |
| Review decision | Immutable decision referencing a proposal hash | A later proposal requires its own decision. |
| Merge | Accepted event plus accepted-diff manifest after `pow` validation and sign-off | Accepted longitudinal data retain the proposal, evidence, decision, and rebuild chain. |

## Why The Current Hashes Are Insufficient

The current system has three useful pieces of the eventual contract. Batch imports may include a `claim_hash` for duplicate detection. Review decisions receive a SHA-256 hash over the stored decision fields. `pow stage` hashes the raw input bytes and retains that hash with the staged batch.

Taken together, these pieces stop short of identifying a complete review version. Evidence remains in draft rows that existing mutations can patch. A review decision identifies an `evidence_draft_id`, leaving the reviewed content unspecified. Freezing an export stores task and decision identifiers, while `getExportBundle` later queries the current task, event, and evidence rows. A later row change can therefore change the returned files while retaining the export-batch identifier.

Content-addressed review closes this gap by making submitted scientific objects immutable and linking every downstream object by hash.

## Object Graph

```mermaid
flowchart LR
  E0["Evidence version"] --> P0["Proposal version"]
  B0["Accepted base-state hash"] --> P0
  P0 --> D0["Review decision"]
  E1["Corrected evidence version"] --> P1["Revised proposal version"]
  E0 -. "parent" .-> E1
  P0 -. "parent" .-> P1
  P1 --> D1["Review decision"]
  D1 --> A0["Accepted event"]
  A0 --> M0["Accepted-diff manifest"]
  M0 --> R0["Rebuild manifest and research outputs"]
```

Mutable task status remains a coordination index around this graph. Task events record status transitions. The submitted evidence, proposal, decision, accepted event, and frozen export are immutable records.

## Hash Envelope

Every content-addressed review object uses an immutable envelope:

```json
{
  "hash_contract": "pow-object.v1",
  "object_type": "proposal_version",
  "schema_version": "change-proposal.v1",
  "logical_id": "proposal:nz-temporal-001:48",
  "parent_object_hashes": [],
  "created_by": "actor:project-user-id",
  "recorded_at": "2026-08-27T04:30:00.000Z",
  "payload": {
    "base_state_hash": "sha256:...",
    "evidence_version_hashes": ["sha256:..."],
    "proposed_event_hashes": ["sha256:..."]
  }
}
```

The `object_hash` is `sha256:` followed by the lowercase hexadecimal SHA-256 digest of the UTF-8 bytes produced by the contract's canonical JSON serialisation. The serialised envelope excludes `object_hash`, Convex document identifiers, database creation metadata, indexes, cached display fields, and mutable task status.

Version 1 should use a published cross-language JSON canonicalisation standard, with RFC 8785 JSON Canonicalization Scheme as the proposed choice. The implementation must pin the standard and its library versions, reject values outside the supported JSON domain, and publish common TypeScript and Rust fixtures before any hash becomes authoritative. Schema rules must distinguish ordered arrays from set-like arrays; set-like arrays are sorted by their defined stable field before canonicalisation. Canonicalisation preserves the submitted scientific values and text.

Hashing establishes content identity. Authenticated actor records establish attribution. Server-enforced roles and project sign-off establish authority. Source assessment and human review establish whether the scientific claim is acceptable.

## Required Review Objects

| Object | Immutable contents | Required references |
| --- | --- | --- |
| Evidence version | Submitted observations, source references, interpretation, uncertainty, privacy and licence state, schema version, actor, and recorded time | Parent evidence-version hash for a correction; stable task and evidence-family identifiers |
| Proposal version | Proposed events or field changes and the validation summary used for review | Evidence-version hashes, base-state hash, parent proposal hash when revised, schema and taxonomy versions |
| Review decision | Decision, rationale, requested follow-up, identity and target-year conclusions, reviewer, and recorded time | Proposal hash, reviewed evidence-version hashes, and any agent-review hash considered |
| Accepted event | Event envelope used by replay | Proposal hash, accepting decision hash, evidence-version hashes, payload hash, source-manifest references, schema and taxonomy versions |
| Frozen export manifest | The immutable files handed to `pow` | Sorted object-hash lists, per-file hashes and byte counts, schema versions, generator commit, country and batch scope, freeze time |
| Rebuild manifest | Inputs, command, code version, replay horizon, and output files | Accepted-event and input-manifest hashes, per-output hashes, target years and area partitions |

Import duplicate detection and scientific version identity serve different purposes. A server-computed evidence-content hash may later replace the current client-supplied `claim_hash`. The evidence-version hash also includes the version envelope, including its parent, actor, schema, and recorded time.

The `base_state_hash` identifies a canonical base manifest for every site or other target the proposal may change. The base manifest records the accepted event hashes, reconstructed fields, source and taxonomy versions, and replay horizon used to prepare the proposal. An accepted event concerning an unrelated target leaves the proposal current.

## Version And Decision Rules

An autosaved draft may change in place. Submission creates an immutable evidence version and returns its hash. The server assigns the actor and recorded time and requires an idempotency token; retrying the same submission returns the existing version. The dashboard can continue to present a simple Save or Submit interaction because the version boundary is a server operation.

A correction creates a child evidence version linked to the version it supersedes. A later dated observation creates a distinct evidence version because it contributes new longitudinal evidence. Every version remains retrievable.

A proposal pins its evidence versions and `base_state_hash`. A proposal created after a correction or accepted-state change receives a new `proposal_hash` and links to its parent proposal where applicable.

A review decision pins the proposal hash and the evidence-version hashes shown to the reviewer. Recording a decision against an outdated proposal returns a stale-version result. The reviewer then sees the parent-to-current diff and decides on the current proposal.

A changed or withdrawn decision is a new decision referencing the earlier decision hash. Earlier decisions remain in the audit history.

An accepted event references the accepting decision and proposal. Convex status `accepted_for_export` continues to mean eligible for the governed handoff; acceptance into the event log occurs only through `pow` validation, diff, project sign-off, and replay verification.

## Frozen Exports

Freezing an export must create and durably store the export bytes before the export receives `frozen` status. Later retrieval returns those stored bytes and verifies their hashes. Reconstruction from current database rows remains a draft-export operation.

The export manifest records the included object hashes, file names, SHA-256 hashes, byte counts, row counts, schema versions, country and batch scope, generator commit, creation time, and freeze time. The manifest hash covers the canonical manifest with its own hash field omitted. A sorted object list makes the manifest independent of query order.

Task and status snapshots may accompany an export as review context. Their file hashes freeze the supplied context, while the evidence, proposal, decision, and accepted-event hashes identify the scientific objects used by `pow`.

Task status changes to `exported` only after durable storage and hash verification succeed. A failed freeze leaves the batch in draft status and records the failure as an event.

## Dashboard, CLI, And Agent Ergonomics

People should usually see stable task names and short hash prefixes. The interface exposes the full hash through copy controls, downloads, and machine-readable responses. A decision screen shows whether the proposal remains current and offers a parent-to-current diff after revision.

The same contract supports later command-line and agent clients. Illustrative commands are:

```sh
pow remote proposal show sha256:<proposal-hash>
pow remote proposal diff sha256:<parent-hash> sha256:<proposal-hash>
pow remote question raise --proposal sha256:<proposal-hash> --field /geometry
pow remote review recommend --proposal sha256:<proposal-hash>
pow export verify path/to/export-manifest.json
```

Task-linked questions, agent recommendations, and generated review maps should identify the proposal hash they concern. A map artefact should also record its scientific overlay hash, renderer and style versions, extent, and input hashes. Standard OpenStreetMap basemap tiles provide visual context and remain outside the scientific overlay hash.

## Implementation Sequence

The first implementation step is the canonicalisation contract and a small set of golden fixtures shared by TypeScript and Rust. The fixtures should cover nested objects, Unicode, coordinates, timestamps, nulls, ordered arrays, set-like arrays, and omitted optional fields.

The second implementation step is immutable evidence versions. Submission should create the version on the server, compute its hash, and prevent later patches to the submitted content. Corrections should create linked child versions.

The third implementation step is proposal and decision pinning. A proposal should record its accepted base-state hash, evidence-version hashes, proposed-event hashes, and parent proposal. Review decisions should require the proposal hash and reject stale writes.

The fourth implementation step is durable frozen exports. Freeze should serialise, store, hash, and verify the export package as a recoverable operation. Export retrieval should return the stored package.

The fifth implementation step is `pow` verification, acceptance, and replay. `pow` should verify every referenced object and file hash before acceptance, preserve the hash chain in accepted events, and reproduce rebuilt outputs under manifest hashes.

Each step should land as a focused pull request after the active portal branch has stabilised. The design is compatible with the current dashboard and prepares the same review objects for command-line and agent clients.

## Migration

Existing `decision_hash` values retain their current contract as version 0. New decision hashes use a named version 1 envelope. A field must never silently change hash semantics.

Existing submitted rows can enter the new graph through migration records that identify the source row, the migration run, and the time when migration copied the row. Stored historical actor and creation fields may be retained when present. The migration record should avoid implying that the version hash existed when the original submission occurred.

The migration should preserve current identifiers as locators while introducing storage-independent logical identifiers and content-derived hashes. Convex document identifiers remain implementation details and stay outside exported hash envelopes.

## Acceptance Criteria

1. TypeScript and Rust produce the same hash for every golden fixture.
2. Reordering JSON object member names leaves the hash unchanged.
3. Changing any hashed field changes the hash.
4. Set-like arrays produce the same hash after their specified pre-sort; ordered arrays retain order as data.
5. Retrying a submission with the same idempotency token returns the existing version and hash.
6. Correcting submitted evidence creates a child version and preserves the parent.
7. A decision with a stale proposal hash is rejected with the current hash and a retrievable diff.
8. Retrieving a frozen export after later task activity returns byte-identical files.
9. `pow` rejects an export package whose object, file, or manifest hash fails verification.
10. Replaying the accepted event log under pinned inputs reproduces the declared output hashes.

## Deferred Extensions

Digital signatures, a public transparency log, per-task Git branches, automatic agent acceptance, and hashing third-party basemap pixels are deferred. The version graph leaves room for signatures and external timestamping if later governance or publication needs justify them.

## Decision Requested

Adopting this contract commits the project to four principles. First, submission creates an immutable evidence version. Second, every decision identifies the proposal and evidence versions under review. Third, a frozen export consists of stored bytes whose manifest verifies them. Fourth, dashboards, command-line tools, and agent clients use the same versioned review objects.
