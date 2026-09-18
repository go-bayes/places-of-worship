# Revisitable agent research and storage

Status: implementation proposal with a working local archive. The archive preserves provisional research attempts, including attempts that stop before producing a dossier. Automatic dispatch, hosted object storage, and portal integration remain proposed. Existing review and release rules continue to apply.

## A useful first pass

A first pass answers a bounded question as far as the permitted evidence allows. The record retains supported claims, qualifications, disagreements, attempted searches, reasons for stopping, and questions for a later attempt. Each search has explicit source-name, attempt-date, retrieval-date, licence, and access fields. Unknown names and dates remain null; the access note explains the gap. An inaccessible source or unresolved date is a useful recorded result. Research completion and evidence acceptance are different states.

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

## Delivery and evaluation

The next implementation should connect the existing internal runner to the first-pass archive, preserving a blocked record when a provider fails or a dossier needs revision. The hosted storage adapter should then write immutable objects, retrieve and verify every uploaded object, and return a receipt. A reconstruction exercise from an independent stored copy should precede any durability claim.

Portal integration should begin with signed-in RA assistance attached to the current task and evidence version. Public intake can then use a separate bounded ingress with abuse controls, duplicate suggestions, and a private receipt. Attachment handling requires quarantined upload and isolated extraction. An untrusted URL supplied by a visitor must pass the controlled fetcher's DNS, redirect, size, and MIME checks before retrieval.

Evaluation should record source support, temporal-scope mistakes, missed contradictions, human correction time, useful partial results, blocked access, cost completeness, and recovery success. Review agreeing claims as well as disagreements. Measure the time to leave a lead and request help on a phone, including keyboard and screen-reader use. Expand execution only after review capacity and per-assignment allowances are established.
