# Human review and occasional release

Status: delivery direction clarified by the project lead on 2026-09-23. The existing human review portal is the destination for retained evidence, with read-only inspection as the default interaction. Release into the accepted master follows an irregular, operator-scheduled process. Collection browsing, international inspection adapters, and proposal-bound previews remain implementation work; the current review and PI controls remain in force.

## Evidence inspection is a delivery milestone

Retained research should become inspectable in the existing authenticated human review portal before its eventual release into the accepted master. A local viewer or synthetic fixture can support development. The delivery milestone is an authorised collection of retained evidence that a human can inspect through the shared portal, with its sources, uncertainty, history, and recorded agent assessments.

Read-only inspection means that opening cases, filtering or paging a collection, comparing versions, and changing the map leave research and workflow records unchanged. An eligible reviewer deliberately enters the existing decision workflow to record a finding or decision. Human preparation and independent review retain their current roles, including author exclusion and the provisional status of intake-only agent research.

The collection view should retain access to incomplete, deferred, rejected, reviewed-unreleased, superseded, and released evidence. Its pagination and filters must disclose the membership they show. A location-unresolved observation belongs in the case list; supported geometry determines whether it can appear on the map. Case history should distinguish an accepted version from a later draft.

The existing country review pages use the shared portal. The present queue queries a task status and returns a bounded result; persistent collection browsing and pagination need implementation. The [internal agent intake](internal-agent-review.md) remains restricted to its NZ pilot. Importing an international collection requires a reviewed adapter that preserves actual country, source dates, model attribution, missing values, and access restrictions.

## Review, export, processing, and publication

Portal evidence and master data have different authority. Convex coordinates tasks, evidence, and review; `pow` governs validation, staging, acceptance, replay, and export of master changes. Backend deployment, provisional evidence import, a human review action, export freezing, master processing, and map publication must each be named in operational records.

| Stage | Meaning | Current or planned control |
| --- | --- | --- |
| Available for inspection | A permitted source or provisional claim is accessible to an authorised reviewer. | Existing evidence access; collection adapters and persistent browsing remain planned. |
| Human reviewed | A qualified reviewer has recorded a decision on inspected content. | Existing role checks, author exclusion, and snapshot-linked decisions remain in force. |
| PI authority | The principal investigator has authorised eligible evidence for handoff. | Current per-item PI acceptance remains until the approved batch-release replacement is implemented and verified. |
| Frozen export | Stored export bytes and their membership can be retrieved and verified. | Implemented [frozen-export contract](frozen-exports.md); the task label `exported` records that workflow transition. |
| Accepted master change | Governed processing has accepted the relevant events and verified reconstruction. | Recorded `pow` authority and processing evidence; an export alone does not establish this stage. |
| Published output | A versioned public product has been built and published from accepted inputs. | Publication records identify the release, transformation, and output hashes. |

The [content-addressed review contract](content-addressed-review.md) specifies reviewer acceptance into a transparent queue and explicit PI batch release. That replacement remains planned. The current per-item gate must continue to protect exports until the replacement's queue, permissions, return path, version checks, and downstream verification are implemented together.

Review can continue between releases. The planned collection view should expose reviewed evidence awaiting release and the release membership of earlier versions. Release preparation selects a named set of eligible versions and revalidates its evidence, decisions, proposal base, and authority. Coupled events, such as linked origin and destination identity changes, need consistent membership.

Historical claims retain their evidence basis between releases. A changed source, identity decision, applicable rule, or relevant proposal dependency can require renewed review. Preserve the earlier decision and preview, create the revised proposal, and obtain the required approval for its changed meaning or map effect. A failed release retains the review history and processing diagnostics; retry protection must prevent duplicate accepted events.

## Definition and map interpretation

The [operational definition](../operational-definition.md) governs current interpretation. [Version 0.1.6](place-of-worship-definition-2026-09-22-v0.1.6.md) requires a new identity at a distinct property and preserves identity through inactivity, subject to its recorded end and succession rules. Claims about location, worship, community, time, function, and relationships retain their own evidence and review scope. A supported name correction leaves the other attributes at their recorded review state.

Evidential uncertainty concerns incomplete knowledge, such as competing coordinates or bounded dates. Vagueness concerns the concept boundary, such as membership of a coherent worship complex. Preserve the evidence, the applicable rule and version, the reviewer’s rationale, and unresolved alternatives. Study counts follow declared recurrence and confidence criteria applied to the recorded attributes.

The [earlier occupancy plan](../portal-location-and-occupancy-plan.md) and `convex/lib/occupancies.ts` still encode the superseded same-identity relocation rule. The definition's revision note identifies that mismatch. Evidence inspection can proceed while those contracts are reconciled; affected acceptance and export paths must wait for definition-compatible validation. Existing accepted histories retain the version of the rule under which they were assessed.

The review map should distinguish source-derived candidates, collection evidence, review coverage, accepted release states, and proposed changes. A historical view must identify contemporary OSM context. Review status and evidential uncertainty need distinct labels; unresolved geography and unresolved eligibility remain inspectable. Counts must follow identity decisions, even when distinct PoWs share a representative point or several source objects describe the same PoW.

Current/proposed/difference views become approval-bound only when a proposal pins the accepted base, evidence and decision versions, proposed event hashes, definition and counting-rule versions, transformation version, and output hashes. Earlier previews remain illustrative. Census affiliation layers retain their own dates and denominators, while PoW density outputs identify their release and counting rule.

## Storage and recovery between releases

The [storage pipeline](../data-storage-pipeline.md#storage-responsibilities-and-current-status) separates working files, the private source archive, Convex coordination records, frozen export bytes, and published products. Collection intake should reference preserved source editions and append evidence versions as review proceeds. Export freezing preserves the selected bytes for a release; it is independent of routine inspection.

Each imported collection needs a manifest identifying membership, source editions, adapter version, hashes, access restrictions, and validation results. Identical retries should return the existing receipt; changed input creates a linked version. Original source bytes and transformed content retain distinct hashes where necessary. A recovery exercise must reconstruct the inspection data from project-controlled storage and manifests using a clean cache.

Source permissions determine which bytes may be retained and shown. Inaccessible or restricted sources retain permitted locators, extracts, dates, and explicit limitations. Source access can constrain acceptance of a claim while leaving its provisional record useful for further investigation. Private payloads remain behind server-side authorisation; a public portal shell does not make its evidence public.

## Delivery and verification

The first implementation milestone combines the collection contract, verified storage references, an inspection adapter, and retained evidence in the existing portal. Definition-compatible review can proceed alongside inspection development. Proposal binding and occasional governed release follow their own prerequisites. Release scheduling therefore remains independent of the first portal walkthrough.

| Implementation area | Required evidence |
| --- | --- |
| Inspection | A signed-in walkthrough shows retained cases, incomplete evidence, source limitations, agent identities, and history; navigation leaves workflow state unchanged. |
| Collection access | Pagination retrieves the declared membership; filters expose reviewed-unreleased versions; unresolved locations remain discoverable. |
| Permission and fidelity | Role checks protect private payloads; mappings preserve source wording, actual country and attribution, temporal scope, and unknown values. |
| Review | Deliberate actions enforce author exclusion, inspected-version freshness, and definition-compatible identity and temporal rules. |
| Recovery | Immutable objects and manifests reproduce the inspection collection after local-cache loss; interrupted imports can safely resume. |
| Projection and release | Pinned previews reproduce their proposed effects; freeze, processing, and publication have distinct receipts; failed processing preserves review access. |

Implementation PRs must update contributor guidance when controls change contributor behaviour, and reviewer guidance when inspection or decision behaviour changes. Operational imports, deployments, acceptance, and release retain their existing authority requirements. Country-specific research, collection membership, and access details remain in the private research tier.
