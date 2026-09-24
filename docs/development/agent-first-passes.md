# Revisitable agent research and storage

Status: implementation proposal with a working local archive and backend receipts. The archive preserves provisional research attempts, including attempts that stop before producing a dossier. Since 2026-09-24 (J2 of the [agent judgments](agent-judgments.md) design) an operator can submit archived records to the shared backend, which keeps their exact bytes under a receipt and records their judgments. Automatic dispatch, hosted object storage, and portal display remain proposed. Existing review and release rules continue to apply.

## A useful first pass

A first pass answers a bounded question as far as the permitted evidence allows. The record retains supported claims, qualifications, disagreements, attempted searches, reasons for stopping, and questions for a later attempt. Each search has explicit source-name, attempt-date, retrieval-date, licence, and access fields. Unknown names and dates remain null; the access note explains the gap. An inaccessible source or unresolved date is a useful recorded result. Research completion and evidence acceptance are different states.

A first pass run for a portal record may carry an optional `context` block naming the task, the evidence draft, the SHA-256 of the exact evidence version it judged, and the assistance request that asked for it; every field is optional, unknown fields are refused, and an absent block means the pass was not run against a portal record. The block is what lets a first-pass receipt in the shared backend (`agent_judgments`, rulings R-J1 to R-J7 of 2026-09-19) point back at the archived object and the evidence version it saw.

The first-pass record wraps the existing [agent dossier](../../scripts/agent_research/schemas/agent-dossier.v1.json). Each dossier claim retains its source locator, quoted support, date scope, uncertainty, and reader attribution. Annotations identify claims by `claim_id`. A later pass names the hashes of its parent records and creates a new object; the earlier evidence remains recoverable. Multiple investigators can independently revisit the same record.

The local implementation retains the internal pilot's New Zealand and model restrictions when a dossier is present. A blocked or partial attempt can omit the dossier and preserve its search history and next question. The `researched` outcome requires a validated dossier. Every outcome remains `provisional` and requires the existing preparation and review process before acceptance.

## Contribution and assignment

A public nomination should require a place name or description and enough location information to investigate. Optional context can include an observation, a public link, and uncertainty about the location. Receipt of a nomination starts triage.

An RA assistance request should inherit the selected task, place, and evidence version. The RA chooses a question such as finding a source, investigating a date, explaining a disagreement, or checking a possible duplicate. The request preserves the RA's words. An agent answer appears beside the evidence, with supporting sources and the option to ask a follow-up question. Changes proposed by an agent enter the ordinary evidence preparation and review workflow.

The proposed assignment envelope specifies the question, input hashes, operational-definition hash, permitted source scope, responsible human, model policy, execution allowance, and stopping conditions before dispatch. The execution allowance includes elapsed time, source requests, output size, attempts, and monetary cost where the provider exposes enforceable accounting. Unknown expenditure remains unknown. A change to the question or source scope creates a new assignment version.

## Controller and stopping conditions

A deterministic controller should own leases, retries, and execution allowances. Agents receive a task-specific input package and return structured records. Agents can propose another question, but the controller checks the proposal against the assignment's remaining allowance and source policy before dispatch. Research workers receive source access appropriate to the assignment; storage and acceptance credentials remain with the controller.

The proposed lease contract uses an assignment identifier, attempt identifier, lease expiry, and monotonically increasing fencing token. A result is committed only if its token still identifies the current lease. The controller atomically reserves capacity before dispatch, retains failed attempts, and treats an idempotent retry as the same submission. Worker loss releases capacity after expiry; late results remain in the research history.

A first pass stops when its question is answered within the available evidence, its allowance is exhausted, a source needs human access, or a sensitivity concern requires review. An inconclusive result should name the unresolved question and the most useful next action. Repeated blocked retrievals should wait for a changed access condition. Agreement among agents can help prioritise review, but acceptance continues to depend on the project's human review rules.

## Storage responsibilities

| Record | Proposed storage | Required property |
| --- | --- | --- |
| Active assignments, leases, permissions, receipts, and review status | Convex | Atomic changes, bounded queries, and explicit actor authority |
| First-pass records, permitted source copies, outputs, and validation reports | Private project object storage | Immutable keys, hashes, byte counts, access classification, and verified retrieval |
| Personal or culturally restricted material | Separate restricted quarantine | Restricted access and a recorded human decision before extraction or disclosure |
| Specifications, schemas, prompts, code, and compact manifests | Appropriate public or private Git tier | Reviewed versions and recoverable history |
| Accepted export files | Existing frozen-export contract | Retained bytes and membership, withdrawal state, and governed processing |

Concurrent agents should write distinct immutable objects. A shared JSONL object rewritten by every worker would introduce contention and lost-update risk. The controller can build a disposable index over completed records; the index can be reconstructed from retained objects and receipts. A receipt should record the object version, SHA-256, byte length, successful retrieval verification, and access classification before the task is labelled durably stored.

Source retention depends on permission. Retain the locator, retrieval date, access result, licence or access note, and the evidence needed to inspect the claim. Store source bytes only when permitted. A hash proves byte identity. Source truth and permission require separate evidence. Store concise decision rationales and tool outcomes; hidden model reasoning is outside the research record.

Retention periods require a project decision. Preserve evidence used for human decisions and the associated version history under the research retention policy. Give temporary execution traces and quarantined content separate, bounded schedules. Deletion must preserve enough restricted audit information to explain a withdrawal while respecting the applicable deletion requirement. Deletion support remains outside the local archive implementation.

The existing [storage pipeline](../data-storage-pipeline.md), [internal intake](internal-agent-review.md), and [frozen exports](frozen-exports.md) remain authoritative. The archive described below is a staging and recovery tool. Durable project-controlled storage requires a verified hosted copy and receipt.

## Local archive and recovery

The [first-pass schema](../../scripts/agent_research/schemas/agent-first-pass.v1.json) and `first_pass.py` validate a bounded record. Semantic validation additionally checks the embedded dossier, annotation references, same-place parent history, source locators, dates, and unknown-cost handling. JSON Schema validation alone is insufficient. Input JSON is limited to 64 KiB and rejects duplicate keys, non-finite numbers, and prohibited controls using the existing intake parser.

The archive encodes records as sorted-key ASCII JSON with compact separators and a final newline. SHA-256 covers those bytes. Objects use `objects/sha256/<first-two-hash-characters>/<hash>.json`. Publication uses a flushed temporary file and an exclusive hard link. Each published object therefore retains its complete original bytes across competing writes. Identical retries verify the existing bytes. The archive assumes an operator-controlled local filesystem with hard-link and directory-sync support; hosted object storage requires a separate adapter.

The archive verifies the complete parent graph, up to 1,000 records, before reporting success. A revisit must reference existing records for the same place. The copy operation first verifies the source graph, copies its objects to a separate directory, and verifies the destination. An interrupted copy leaves objects that an identical retry can reuse. The procedure preserves research history; evidence acceptance remains with the existing review workflow.

```sh
# Synthetic data only; use a private directory for actual research.
uv run python scripts/agent_research/first_pass.py archive \
  scripts/agent_research/fixtures/first-pass.json --store /tmp/pow-first-pass-archive

uv run python scripts/agent_research/first_pass.py verify HASH \
  --store /tmp/pow-first-pass-archive

uv run python scripts/agent_research/first_pass.py copy HASH \
  --store /tmp/pow-first-pass-archive --destination /tmp/pow-first-pass-recovery

python3 -m unittest discover -s scripts/agent_research -p 'test_*.py'
```

The archive validates the structure of supplied attribution fields. A trusted controller must populate or verify responsible-human identifiers, code and instruction hashes, operational-definition hashes, and provider receipts. A missing reported model identifier requires an explicit reason. A schema-valid record can still contain false evidence or sensitive text; keep actual records in the private tier and inspect them before any wider use.

## Receipts in the shared backend

`first_pass.py submit` sends an archived record and its complete parent history to the backend, parents first. The backend keeps each record's exact archive bytes in an `agent_first_pass_receipts` row and returns a receipt. Its checks mirror the archive's. The bytes must hash to the claimed SHA-256 and must be exactly the archive's version-1 wire format: Python's sorted, compact, ASCII JSON with Python's spelling of every number and string, then one newline. The backend re-encodes the submitted text in that format (`convex/lib/wireJson.ts`) and refuses any difference, such as unsorted keys, extra spaces, or `1e-7` where Python writes `1e-07`, so every stored receipt restores. Cross-language vectors generated by Python (`scripts/agent_research/wire_vectors.py`) are checked by both test suites. The record must then pass the first-pass schema and every semantic rule above, including the embedded dossier's checks and the New Zealand restriction. Each parent must already hold a receipt for the same place, so the backend never holds a revision whose history it cannot return. The submission runs through an internal mutation behind the `POW_INTERNAL_AGENT_INGEST_ENABLED` gate that also governs the internal bundle intake, and the command requires an explicit `dev` or `local` deployment selector.

Reviewers read receipts, so the backend adds two rules to the archive's. First, the record's free text (question, stop reason, cost note, responsible-human reference, unreported-model reason, annotation notes, search queries and notes, source names, licence and access notes, next questions, and the dossier's status basis) is screened for phone numbers, email addresses, and honorific-led names with the detector already applied to dossier claims; a hit refuses the record. Second, an attribution that names the dossier's own run must report that run's models. `submit` applies both rules to the whole history before its first call. The local archive keeps any valid record: it is the operator's private working copy, and a refused record stays there for human handling.

A `context` block links a pass to a portal record. Every field it supplies is resolved to its owning task: the task itself, the draft's task, and the evidence version's task and draft. All must be the same task, the version must belong to the named draft, the task must be in the record's country, and the task must be about the record's place (its OSM object or its source record id). A task that names no place the record can be checked against refuses the link. The receipt and the judgments carry the resolved task and draft.

A record with a dossier also produces agent judgments, each attributed from the one run that produced it:

- One `status_assessment` of the place: the dossier researcher's verdict. Its provider, requested and reported models, prompt version, run id, and cost come from the dossier's run manifest. The judgment is keyed on that run and the record's context, not on the first-pass record. A later pass that carries the same dossier cites the same judgment, and its receipt lists that id, instead of writing a second copy of one model output that agreement rates would count twice. A pass with a new dossier run writes a new verdict that revises the earlier one.
- One `annotation` per claim annotation: the first-pass author's own judgment, keyed on the record as `<record sha256>#<claim_id>` and attributed from the record's attribution block. The provider is the dossier's backend only when the attribution names the dossier's own run; an author from another run keeps its own models and records its provider as `not_reported` rather than borrowing the researcher's.

The claims themselves stay in the record. A record without a dossier receives a receipt and no judgments. The receipt creates no task, evidence draft, evidence version, or review decision, and every record remains provisional.

The receipt follows a general contract, `object-receipt.v1`, implemented in `convex/lib/objectReceipts.ts` so that a later import needing immutable references can reuse it:

- The object is addressed by the SHA-256 of its exact bytes, and the receipt id is `<namespace>:<sha256>` (here `first-pass:<sha256>`).
- The bytes are the archive's version-1 wire format and nothing else, so the receipt alone rebuilds the archived object.
- An identical retry returns the existing receipt and writes nothing. An operator therefore repeats an interrupted submission unchanged.
- Changed content has a different hash and therefore receives a new receipt; its predecessors are named explicitly and must already hold receipts.
- The receipt records the byte length and a storage tier. The tier is `convex_only` until an independent copy has been written, read back, and verified, when it becomes `r2_verified` with the object key and verification time. The bytes stay in the receipt until that verification.

`first_pass.py restore` rebuilds a record and its history in a clean local archive from the receipts alone, checking each object's hash and wire format before publishing it and verifying the complete graph afterwards. A `convex_only` receipt is a recoverable second copy, not the durable project-controlled storage that the storage table above requires; the hosted object adapter and its independent verification remain to be built.

```sh
# synthetic data only; the deployment must be one you are authorised to write to.
uv run python scripts/agent_research/first_pass.py submit HASH \
  --store /tmp/pow-first-pass-archive --deployment local

uv run python scripts/agent_research/first_pass.py restore HASH \
  --store /tmp/pow-first-pass-restored --deployment local
```

Reviewers, curators, administrators, and the PI can read a receipt with `firstPassReceipts:getFirstPassReceipt` and list receipts by place or task with `listFirstPassReceipts`. The review portal does not yet display them.

## Delivery and evaluation

The next implementation should connect the existing internal runner to the first-pass archive, preserving a blocked record when a provider fails or a dossier needs revision. The hosted storage adapter should then write immutable objects, retrieve and verify every uploaded object, and advance the backend receipt to `r2_verified`. A reconstruction exercise from an independent stored copy should precede any durability claim.

Portal delivery first makes retained evidence inspectable through the existing authenticated human review portal, as clarified on 2026-09-23 in [human review and occasional release](human-review-and-release.md). A reviewed inspection adapter and verified hosted references can deliver that collection while runner integration proceeds. The current NZ intake restrictions remain in force until a country-compatible contract is reviewed and implemented. Persistent collection browsing remains planned; master release can follow later, on the PI’s instruction. Inspection may first require an authorised Convex deployment and provisional import.

New agent assistance should begin with signed-in RA requests attached to the current task and evidence version. Public intake can then use a separate bounded ingress with abuse controls, duplicate suggestions, and a private receipt. Attachment handling requires quarantined upload and isolated extraction. An untrusted URL supplied by a visitor must pass the controlled fetcher's DNS, redirect, size, and MIME checks before retrieval.

Evaluation should record source support, temporal-scope mistakes, missed contradictions, human correction time, useful partial results, blocked access, cost completeness, and recovery success. Review agreeing claims as well as disagreements. Measure the time to leave a lead and request help on a phone, including keyboard and screen-reader use. Expand execution only after review capacity and per-assignment allowances are established.
