# Free Contribution Portal Design

Status: design sitting, 2026-07-07.

Planning source: `docs/playbooks/free-contribution-portal.md`.

Related references:

| Reference | Use in this design |
| --- | --- |
| `docs/ui-style-guide.md` | Workbench wording, status labels, colours, and form controls. |
| `docs/system-map.md` | Module boundary from nomination to reviewed export and `pow`. |
| `apps/workbench/README.md` | Demo-mode and provider-boundary rules. |
| `apps/workbench/src/data/types.ts` | Current TypeScript evidence surface. |
| `apps/workbench/src/data/provider.ts` | Required provider interface boundary. |
| `FAQ.md` | Identity, review, and task-to-master rules. |
| `docs/playbooks/deep-history-schema.md` | Offline source and sensitivity rules. |

## Purpose And Boundary

The free contribution portal extends the Research Workbench so an RA can start
source-backed evidence without an assigned workpack row. Every user-facing
entry says `Nominate missing PoW`.

The portal creates provisional work. A nomination, source claim, agent output,
or reviewer decision never changes the master data or public map. Reviewed
evidence becomes eligible for a frozen export package. The governed path then
runs through `pow validate`, `pow stage`, proposal review, diffing, replay, and
rebuilt outputs.

The first implementation remains demo-mode in `DemoProvider` and localStorage.
The Convex binding is a later step gated by JB. Public map links to the
workbench stay gated until JB confirms the demo or authenticated route.

## System Home

The feature belongs to three modules from `docs/system-map.md`.

| Module | Portal responsibility |
| --- | --- |
| Shared Task List | Store provisional nominations, source-first tasks, assignment state, and review state. |
| Evidence Intake | Store RA drafts, agent drafts, source records, lifecycle claims, and unresolved notes. |
| Authenticated Review Portal | Inspect submitted evidence, decide identity, request revisions, reject, or accept for export. |

The feature must not create a second intake backend. Workbench screens call
`WorkbenchProvider`; `DemoProvider` handles the first version, and a future
`ConvexProvider` implements the same surface.

## Entry Points

The first entry point is a sidebar action in the Research Workbench. The action
is always shown in the sidebar as `Nominate missing PoW`. The action opens a
short mode chooser with `Place-first` and `Source-first` options. The action
also appears in `My work` when a saved draft or submitted nomination exists.

The second entry point is the map route described in
`docs/playbooks/fix-map-two-options.md`. Country and global maps may offer an
`RA workbench` route beside the OSM route. The route can pass country code, map
centre, selected coordinates, zoom, and an optional existing site hint. Public
surfaces must not expose the workbench route until JB approves the publish and
authentication state.

The third entry point is internal. Agent-assisted and agent-autonomous source
pipelines create provisional work through provider calls. Those calls use the
same queue, state model, role gates, and review path as human nominations.

## Place-First Flow

The place-first flow is for an RA who already knows the place to nominate.

| Step | Required behaviour |
| --- | --- |
| Country context | Country config sets target years, lifecycle floor, suggested sources, and sensitivity prompt. |
| Sensitivity prompt | VU shows the kastom or sensitivity prompt before location entry. The RA must answer before submitting. |
| Minimal identity | The RA enters source name, locality or map point, religion or denomination guess when known, and source notes. |
| Dedup assistance | The provider queries nearby and name-similar sites before the nomination is created. |
| Evidence | The RA adds source records, location evidence, target-year statuses, lifecycle claims, and attributes. |
| Save or submit | `Save draft` keeps editable work. `Submit for review` freezes that version. |

The place-first form can accept a map point, an address, a described locality,
or a regional-only placement. Exact coordinates are helpful, but they are not
required when the source only supports a region.

## Source-First Flow

The source-first flow is for archive, census, directory, PDF, scan, or photo
work where one source may contain many site claims.

| Step | Required behaviour |
| --- | --- |
| Source record | The RA records the source before site claims. |
| Offline source support | A source validates with a title plus either `url` or `archiveRef`. |
| Archive reference | `archiveRef` maps to schema `archive_ref`: repository name, collection, optional item reference, consulted date, and optional repository location. |
| Claim list | The RA creates any number of site claims from the source. |
| Claim reuse | Each claim reuses the source record and adds its own place, date, attribute, and location evidence. |
| Regional-only claim | A source-first claim can be complete with no coordinates when `geocodingBasis` is `regional_only`. |

The source-first screen should keep the source panel fixed while the RA adds
claims below it. A claim can be saved as a draft, submitted for review, or
parked as an unresolved note. One source may therefore produce accepted,
rejected, revised, and unresolved claims without duplicating the source record.

## Dedup Assistance

Deduplication is assistance. Deduplication does not block creation.

Before a nomination or claim is created, the provider should return candidate
matches from existing accepted sites, open tasks, submitted nominations, and
known source identifiers. Matching inputs include name, former names, locality,
coordinates, address text, OSM id, source record id, and archive reference.

The UI shows candidate matches under the question `Is it one of these?`.
Choosing an accepted site turns the work into evidence against that site.
Choosing a pending candidate attaches the evidence to that candidate. Choosing
`Continue as new nomination` requires a short reason when a high-confidence
match exists.

Reviewers see the match list, the RA's choice, confidence, and any automated
identity warnings. Review decisions use the existing identity vocabulary:
`same_site`, `new_candidate`, `duplicate`, `split`, `merge`, `relocation`, and
`uncertain`.

## Provisional Identity

Free contributions use provisional identity until review.

| Identifier | Owner | Rule |
| --- | --- | --- |
| `candidate_site_id` | Workbench or Convex task layer | Client-generated in demo mode; server-generated or confirmed in Convex later. |
| `task_id` | Shared task list | Identifies the provisional work item and its history. |
| external ids | Source evidence | OSM ids, archive ids, charity ids, and directory ids help matching. External ids do not define project identity. |
| `site_id` | Governed project data | Assigned only after review accepts the identity decision; canonical master use still waits for the governed path. |

The recommended candidate id form is
`candidate:{country_code}:{ulid_or_task_id}`. Demo mode may mint that id in the
browser. Convex mode should preserve incoming ids for idempotency, then return
the canonical task id and candidate id.

Moving congregations normally create a new site linked by relocation evidence.
Reviewers decide whether a submitted claim is a new site, a duplicate, a split,
a merge, or a relocation.

## State Model

The state model keeps draft work separate from submitted and reviewed work.

| UI label | Stored state | Meaning |
| --- | --- | --- |
| draft | `draft` | Editable RA work or editable source-first claim. |
| agent draft | `agent_draft` | Machine-produced claim awaiting human confirmation. |
| human confirmed | `human_confirmed` | RA or JB has reviewed a machine-produced claim and owns it. |
| submitted for review | `submitted` plus task `needs_review` | Submitted version is read-only until a revision path starts. |
| changes requested | task `changes_requested` or review `needs_more_evidence` | RA must create a new draft version. |
| accepted for export | `accepted_for_export` | Reviewer accepts the evidence for the next governed export. |
| rejected | `rejected` | Reviewer rejects the claim, with reason retained. |
| unresolved note | `unresolved_note` | Useful but incomplete evidence stays in the queue. |
| superseded | `superseded` | A later submitted or reviewed version replaced this draft. |

The base flow is `draft -> submitted for review -> accepted for export`,
`changes requested`, or `rejected`. An unresolved note can branch from a draft
without requiring complete evidence. A submitted version is never edited in
place. Revisions create a new evidence version and mark the older version
`superseded` when appropriate.

## Agent-Interacting Pipelines

The agent-interacting design uses three lanes. Each lane has a different trust
boundary, but every lane enters the same provisional queue before review.

### The FIXED Lane

The FIXED lane is the current assigned-workpack model.

| Area | Design |
| --- | --- |
| Actor | Human RA works from assigned tasks. |
| Agent role | No agent participates in evidence extraction. |
| UI state | Work starts as an assigned task, then becomes `draft`, `submitted`, or `unresolved_note`. |
| Trust boundary | The RA is the author of record. Reviewers inspect RA evidence before export. |
| Export boundary | Accepted-for-export evidence still requires the governed `pow` path. |

The lane keeps the first New Zealand pilot stable. Free nominations should not
disrupt assigned workpacks, task filters, or reviewer queues.

### The AGENT-ASSISTED RA Lane

The AGENT-ASSISTED RA lane supports source transcription and extraction under
human ownership.

| Area | Design |
| --- | --- |
| Actor | RA or JB supplies a scan, PDF, URL, or photo of an archive document. |
| Agent role | Agent extracts candidate site claims into `agent_draft` evidence. |
| Human role | RA reviews, corrects, rejects, or confirms each claim before submission. |
| Author of record | The confirming human is the author of record. The agent is a transcription and extraction assistant. |
| Submission gate | `agent_draft` claims cannot be submitted until marked `human_confirmed`. |
| Reviewer view | Reviewers see the source, agent run, human edits, confirmation time, and final human-owned claim. |

The UI shows an extraction workspace with source metadata at the top and a
claim table below. Each claim has one of four states: `agent_draft`,
`human_confirmed`, `rejected_by_human`, or `submitted`. Field-level badges show
whether the value is unchanged from the agent, edited by the human, or added by
the human.

Required provenance fields are:

| Field | Purpose |
| --- | --- |
| `agent_run_id` | Links every extracted claim to one run. |
| `agent_name` | Names the tool or pipeline that produced the draft. |
| `model_provider` | Records the model provider. |
| `model_name` | Records the model name. |
| `model_version` | Records the model or deployment version when available. |
| `prompt_or_pipeline_version` | Records the extraction instruction set. |
| `source_record_id` | Links the run to the supplied source. |
| `source_locator` | Records page, image, folio, row, column, timestamp, or similar location. |
| `run_started_at` and `run_completed_at` | Record extraction timing. |
| `extraction_confidence` | Stores `high`, `medium`, or `low` confidence. |
| `field_provenance` | Stores agent-suggested, human-edited, or human-added field state. |
| `confirmed_by` and `confirmed_at` | Record human ownership before submission. |

Reviewer pages should sort agent-assisted submissions with human submissions,
while showing a clear `agent-assisted` badge. The reviewer should see the
original source reference, extraction provenance, confidence, human edits, and
dedup candidates. The reviewer should decide on the final human-owned claim.
The agent draft alone is not the decision target.

### The AGENT-AUTONOMOUS Lane

The AGENT-AUTONOMOUS lane supports bulk extraction over approved source sets.

| Area | Design |
| --- | --- |
| Actor | Service role runs an approved extraction pipeline over a source set. |
| Agent role | Agent creates provisional candidate tasks and evidence drafts at scale. |
| Human role | Reviewers triage, sample, batch decide, request more evidence, or route claims to RA confirmation. |
| Queue entry | Outputs enter the same provisional queue as human nominations. |
| Flagging | Every output carries `agent_generated = true` and an `agent_autonomous` origin. |
| Export boundary | No output reaches master data without human review and `pow` validation. |

Bulk runs need volume controls before Convex deployment:

| Control | Required rule |
| --- | --- |
| Source allowlist | Curator approves each source set before the service role can run it. |
| Run manifest | Every run records source manifest id, source hashes, pipeline version, thresholds, and expected count. |
| Idempotency | Claims carry `claim_hash` and `source_claim_key` so reruns do not flood the queue. |
| Daily cap | Country-level cap limits new queue items per day. |
| Run cap | `maxClaimsPerRun` limits each extraction run. |
| Confidence gate | Low-confidence claims become source leads unless a curator promotes them. |
| Sensitivity gate | VU and other sensitive claims require individual review. |
| Conflict gate | Identity conflicts, location conflicts, and master conflicts require individual review. |
| Pause switch | Curators can stop ingestion by country, source, or pipeline version. |

Reviewer workload stays sane through queue shaping:

| Mechanism | Required behaviour |
| --- | --- |
| Batch summary | Reviewer sees source-level counts, confidence distribution, duplicate risk, and validation failures. |
| Stratified sample | Reviewer must inspect a sample by source, confidence, geography, and claim type before batch action. |
| Batch reject | Reviewer can reject a whole run or source segment with one reason. |
| Batch accept | Reviewer can accept low-risk homogeneous claims only after sample review and validation pass. |
| Individual review | New site creation, sensitive records, low confidence, duplicate risk, and conflicting evidence stay row-level. |
| RA routing | Reviewer can assign a segment to an RA for human confirmation instead of deciding it. |

Batch acceptance means accepted for export. The accepted batch still enters the
frozen export package and `pow` path. Batch decisions must record the sampling
plan, reviewed sample ids, reviewer id, decision note, and any excluded claims.

## Workbench Provider Surface

The implementation should extend `WorkbenchProvider` rather than calling
Convex or localStorage from screens.

```ts
export interface WorkbenchProvider {
  readonly kind: "demo" | "convex";
  listTasks(countryCode: string): Promise<WorkTask[]>;
  getDraft(taskId: string): Promise<EvidenceDraft | null>;
  saveDraft(draft: EvidenceDraft): Promise<void>;
  submitForReview(draftId: string): Promise<void>;
  submitUnresolvedNote(draftId: string, note: string): Promise<void>;
  skipTask(taskId: string, reason?: string): Promise<void>;
  listMyWork(countryCode: string): Promise<EvidenceDraft[]>;

  createFreeContribution(input: FreeContributionInput): Promise<FreeContributionHandle>;
  listDedupCandidates(input: DedupCandidateQuery): Promise<DedupCandidate[]>;
  createSourceRecord(input: SourceRecordInput): Promise<SourceRecordHandle>;
  listClaimsForSource(sourceRecordId: string): Promise<EvidenceDraft[]>;
  saveAgentDraft(input: AgentDraftInput): Promise<EvidenceDraft>;
  confirmAgentDraft(input: HumanConfirmationInput): Promise<EvidenceDraft>;
  rejectAgentDraft(input: HumanRejectionInput): Promise<void>;
}
```

`DemoProvider` stores all new data in localStorage. Demo records should include
`providerKind = "demo"` and should never write outside the browser.

`ConvexProvider` later maps the same calls to Convex mutations and queries.
That binding must keep role gates, state transitions, and text limits aligned
with existing task and evidence mutations.

## TypeScript Data Additions

The workbench types should add source and agent provenance without replacing
the current evidence draft shape.

| Type | Required fields |
| --- | --- |
| `ArchiveRef` | `repositoryName`, `collection`, optional `itemRef`, `consultedDate`, optional `location`. |
| `SourceRecord` | Existing fields plus optional `archiveRef`; validation requires `title` and either `url` or `archiveRef`. |
| `FreeContributionInput` | `countryCode`, `mode`, optional map context, optional source id, optional candidate id. |
| `DedupCandidate` | `siteId`, `candidateSiteId`, `taskId`, name, locality, distance, source ids, confidence, reason. |
| `AgentExtractionRun` | Agent, model, source, run timing, confidence policy, counts, and status. |
| `ClaimProvenance` | Lane, origin, agent run id, field provenance, human confirmation fields. |
| `FreeEvidenceDraft` | EvidenceDraft plus candidate id, source-first id, lane, origin, and claim provenance. |

Location evidence should also allow a containing area when coordinates are
absent. A regional-only source-first claim can therefore store country,
province, island, region, or locality evidence without inventing a point.

## Convex Spec For Later

The Convex implementation is a later spec only. JB must gate deployment.

| Area | Required Convex design |
| --- | --- |
| Existing tables | Reuse `tasks`, `task_events`, `evidence_drafts`, `review_decisions`, and `export_batches` where possible. |
| Free nominations | Represent a human nomination as task type `missing_from_project_map` with source kind `ra_nomination`. |
| Source-first work | Represent source-first claims as task type `source_extraction` or a new source-kind value if the schema needs it. |
| Agent runs | Add an `agent_extraction_runs` table or equivalent exported record for provenance and rate controls. |
| Claim origin | Store lane and origin on evidence drafts or source context: `fixed`, `agent_assisted_ra`, or `agent_autonomous`. |
| Review queue | Merge assigned tasks, free nominations, unresolved notes, and agent outputs into one reviewer queue. |
| Export | Frozen export packages include tasks, events, evidence drafts, review decisions, agent run records, manifests, and hashes. |

Role gates should reuse current roles:

| Role | Free-contribution permission |
| --- | --- |
| `ra` | Create and edit own drafts, confirm agent-assisted drafts, submit own work, submit unresolved notes. |
| `reviewer` | Inspect submitted work and unresolved notes, decide review outcomes, request changes, link duplicates. |
| `curator` | Import source batches, run or approve bulk pipelines, freeze exports, pause ingestion. |
| `admin` | Manage users, roles, configuration, and deployment gates. |
| `service` | Write approved agent-autonomous drafts and run metadata only. Service cannot submit as a human author. |

Field-size limits should reuse `convex/lib/limits.ts`:

| Limit | Value |
| --- | ---: |
| `SHORT_TEXT_MAX` | 256 |
| `TASK_NAME_MAX` | 512 |
| `MEDIUM_TEXT_MAX` | 2,048 |
| `TASK_REASON_MAX` | 2,048 |
| `TASK_BRIEF_MAX` | 4,000 |
| `URL_OR_FILE_MAX` | 4,096 |
| `LONG_TEXT_MAX` | 8,000 |
| `CLIENT_CONTEXT_MAX` | 16,000 |
| `VALIDATION_SUMMARY_MAX` | 16,000 |
| `GENERATED_ROW_MAX` | 128,000 |

New source, archive, agent, and dedup payloads should either fit those limits
or define a stricter exported schema before Convex deployment. Convex should
reject over-limit data at mutation time and record the rejection as a user-
facing validation message.

## Review Experience

Reviewers should see one queue with filters for country, source kind, lane,
status, confidence, sensitivity, duplicate risk, and submitter. The queue
should show human submissions and agent-origin work together, with badges for
`agent-assisted` and `agent-generated`.

A review detail page should show:

| Panel | Content |
| --- | --- |
| Claim | Proposed place, source-backed dates, target-year statuses, lifecycle claims, attributes, and notes. |
| Source | URL or archive reference, licence, access limits, consulted date, and source locator. |
| Location | Map point, area-only placement, geocoding basis, confidence, and location notes. |
| Identity | Existing site matches, pending candidates, OSM ids, and RA or agent match choice. |
| Agent provenance | Lane, run id, model, pipeline version, confidence, human edits, and confirmation state. |
| Review controls | Accept for export, reject, request changes, mark duplicate, link existing site, defer, or reopen. |

Sensitive VU claims should display restricted-location expectations before the
map panel. Reviewer acceptance for export should not clear public display of a
sensitive record unless the reviewer also records display clearance.

## Validation Rules

Submission validation should enforce these rules before review:

| Rule | Required behaviour |
| --- | --- |
| Wording | The creation action uses `Nominate missing PoW`. |
| Source title | Every source needs a real title. Blank and `NA` fail. |
| Source locator | Every source has either `url` or `archiveRef`. |
| Archive reference | `archiveRef` needs repository name, collection, and consulted date. |
| Dates | Dates use `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`; bounded dates preserve uncertainty. |
| Denomination | A denomination code requires taxonomy version. |
| Location | Coordinates require geocoding basis and confidence; regional-only claims require a containing area. |
| VU sensitivity | The kastom or sensitivity prompt appears before location entry and must be answered before submission. |
| Agent drafts | Agent drafts cannot be submitted until human confirmed. |
| Review boundary | No intake path writes to master data or public map products. |

Validation warnings should stay attached to the task and evidence draft. Review
can accept a warning only by recording a reason.

## Open Ratification Points

JB should ratify four design choices before the build sitting.

| Choice | Proposed decision |
| --- | --- |
| Candidate id format | Use `candidate:{country_code}:{ulid_or_task_id}` across demo and Convex. |
| Agent-assisted submission gate | Require `human_confirmed` before `Submit for review`. |
| Bulk agent queue controls | Require source allowlist, run caps, daily caps, confidence gates, and pause switch before Convex ingestion. |
| Batch review scope | Allow batch accept only for low-risk homogeneous claims after sample review; require row-level review for sensitive, low-confidence, duplicate-risk, and conflicting claims. |
