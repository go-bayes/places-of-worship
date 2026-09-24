# Agent judgments

Status: built 2026-09-19 under Joseph B's rulings R-J1 to R-J7 (recorded in the private research tier). Additive schema change: two new tables, one new module, and judgment writes inside two existing lanes. Humans decide; AI recommends. No function that writes a judgment changes a task, an evidence draft, or a review decision.

## Why one table

Before this change AI judgments sat at three grains in three places. The `agent_reviews` table holds one recommendation per evidence draft with source-level checks. The `agent_intake_receipts` table keeps per-claim checks inside `bundle_json`, unindexed. The first-pass archive keeps research as local files with no Convex reference. None answers a question such as "how often does this model's support verdict agree with the reviewer's decision on claims of this type". A single append-only table at claim grain, `agent_judgments`, answers it.

## What a judgment is

A judgment is an evaluative output about a subject: whether a source supports a claim, a recommendation on a draft, a status assessment for a place, an annotation that qualifies or disputes a claim, a duplicate or location verdict. A claim is a proposal of evidence and stays in the dossier or evidence record; a judgment refers to it by `claim_id` within a content hash. The evidence record stays immutable and judgments accumulate around it.

## The `agent_judgments` table

One row per judgment, written once, never patched. `judgment_id` is the SHA-256 of the canonical JSON envelope (`agent-judgment.v1`), so an identical retried write collapses onto one row and a re-judgment in a later batch appends a new row.

| Field | Content |
| --- | --- |
| `subject_kind`, `subject_ref` | `claim` (`<sha256>#<claim_id>`), `evidence_draft` (draft id), `evidence_version` (object hash), `first_pass` (sha256, reserved for the first-pass receipt), or `place` (`place_ref`). |
| `judgment_kind` | `claim_support`, `recommendation`, `status_assessment`, `annotation`, `duplicate`, `location`. |
| `outcome` | Fixed vocabulary per kind in `convex/lib/agentJudgments.ts` (`OUTCOMES_BY_KIND`); the writer refuses a mismatch. |
| `facet` | Optional discriminator between sibling judgments by one lane on one subject, for example the batch reviewer's `existence`, `date_support` and `location_plausibility` checks. |
| `confidence`, `access_method`, `source_locator`, `basis_note` | Optional. `access_method` is one of `opened`, `search_snippet`, `http_fetch`, `model_assessment`, `not_checked`. |
| `judge` | `agent_name`, `model_provider`, `model_requested`, `model_reported` or `model_unreported_reason` (exactly one), `prompt_version`, optional `code_revision` and `instruction_sha256`. |
| `run` | `batch_id` or `agent_run_id`, `attempt`, `cost_usd` and `cost_basis`. An unknown or unmetered cost stays absent; it is never zero. A metered basis requires a value. |
| `context` | Optional `task_id`, `evidence_draft_id`, `evidence_version_hash`; required `place_ref` and `country_code`. |
| `parents` | The lane's earlier judgments of the same kind, facet and source on the same subject, newest first, at most ten. |
| `actor_user_id`, `ai_generated: true`, `created_at` | As in `agent_reviews`. |

Indexes: by judgment id, and by subject, task, batch and prompt version, each followed by `created_at` so a bounded read walks newest first and a cap drops the oldest rows.

## The `judgment_dispositions` table

What a person did with one judgment: `judgment_id`, `reviewer_user_id`, `disposition` (`agreed`, `disagreed`, `corrected`, `not_considered`), an optional note that becomes required for a disagreement or correction, an optional `review_decision_id`, and `created_at`. Append-only. The `review_decisions` table keeps its draft-level `agent_review_id` and `agent_review_agreement` fields and its version-0 and version-1 hash contracts unchanged.

## Writers

`convex/lib/agentJudgments.recordJudgments` is the one write path. It validates each input, computes the id, returns an existing row unchanged, computes parents, and inserts. It accepts at most 100 judgments per call.

The Claude batch-review lane (`claudeReviews.recordArtifact`) writes one `recommendation` judgment for the draft and one `claim_support` judgment per recorded source check, in the same transaction as the `agent_reviews` artifact. The subject is the draft's newest evidence version when one exists, else the draft. The lane records the requested model and states that the response model id is not captured.

The internal bundle intake (`internalAgentIntake.ingestBundle`) writes one `claim_support` judgment per advisory `claim_checks` entry with its real `access_method`, one `recommendation` judgment on the intake evidence version, and one `status_assessment` judgment for the place from the researcher's dossier. The source-level `sources_checked` summary on the `agent_reviews` row now records `not_checked` when the reviewer did not check the source and `model_assessment` otherwise, and names the source rather than the claim id; the earlier row asserted an `existence` check by `model_assessment` for every claim.

The first-pass receipt ingest (`firstPassReceipts.ingestFirstPass`, added 2026-09-24 as J2) writes one `status_assessment` judgment for the place from the record's dossier and one `annotation` judgment per claim annotation, whose subject is `<first-pass sha256>#<claim_id>` and whose `facet` numbers the annotation so sibling annotations on one claim are not read as revisions of each other. The judge is `<provider>-first-pass`, with the provider taken from the dossier's run manifest; a record without a dossier yields no judgments. The claims stay in the record. See [revisitable agent research](agent-first-passes.md#receipts-in-the-shared-backend).

## Reads and the human disposition

`agentJudgments.listJudgmentsForTask`, `listJudgmentsForSubject` and `listDispositionsForJudgment` return newest first to reviewers, curators, administrators and the PI. `agentJudgments.recordJudgmentDisposition` appends one disposition; it refuses an unknown judgment, an unknown review decision, a decision about a different task or evidence draft from the judgment, and a disagreement or correction without a note of at least eight characters.

## Deployment

The change is additive: two new tables, one new module, new optional writes inside two existing mutations. It deploys from the reviewed head under the closure procedure in `AGENTS.md`. A reviewer panel that shows judgments per claim and records dispositions is the next step.
