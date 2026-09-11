# Internal agent research and human batch review

Status: internal pilot. The runner searches public material, obtains an independent advisory review, and produces a validated JSON bundle. A deployment-gated Convex intake route can put that bundle in the human review queue. Governed data changes continue through the existing evidence, acceptance, and `pow` contracts.

## Workflow and authority

```mermaid
flowchart LR
  S[Operator-selected public seed] --> A[Claude or Codex research]
  A --> V[Bounded JSON validation]
  V --> R[Independent provider review]
  R --> I[Provisional intake receipt]
  I --> H[Human batch triage]
  H --> C[Return or reject]
  H --> E[Prepare ordinary evidence]
  E --> B[Human batch evidence review]
  B --> C
  B --> Q[Accepted export queue]
  Q --> B
  Q --> P[PI acceptance and governed pow processing]
```

The researcher and advisory reviewer use different providers. Provider diversity helps reveal disagreements. Factual independence also depends on the sources, which both agents may share. Each claim retains its source URL, quotation, temporal scope, uncertainty, and reader provenance. Advisory review records whether the source was opened, seen only through a search snippet, or not checked. An `accept` recommendation requires an opened, supported check for every claim.

Human batch review is a feasibility requirement. Reviewers select an explicit set of records, see the relevant evidence, inspect exceptions, and approve those versions together. The backend checks every selected version before committing the transaction. A stale item invalidates the batch so that an unseen revision cannot inherit approval. Sampling-based acceptance needs an explicit sampling and escalation policy; this pilot grants no authority to accept unseen records merely because a sample passed.

Raw agent dossiers enter as `agent_intake_only` drafts. They may contain several kinds of historical claim, whereas ordinary evidence specifies observations, interpretations, periods, and proposed states. Human preparation must preserve those distinctions before ordinary acceptance. Create a fresh human-owned draft with `evidence:saveEvidenceDraft` using the task identifier and omitting `evidenceDraftId`, then submit it through the ordinary evidence-and-periods contract. Preserve the receipt identifier in its source notes. A different qualified reviewer makes the acceptance decision. Cloning an intake draft retains its provisional marker and service authorship. Intake-only drafts therefore support batch return or rejection, while completed ordinary evidence uses the existing acceptance rules. The advisory model cannot accept, release, or write map data.

The [approved review and release design](content-addressed-review.md) makes PI batch release the final authority before governed processing and allows returns from the transparent export queue. The current backend still uses per-item PI acceptance. Human batch reviewer decisions in this pilot do not replace that PI gate or implement immutable export files.

## Relationship to the earlier review design

The earlier [contribution design](../portal-free-contribution-design.md) distinguishes human-confirmed agent drafts from autonomous submissions and proposes run manifests, duplicate prevention, sensitivity routing, pause controls, and sampled batch inspection. The [Claude batch-review design](../portal-claude-batch-review.md) treats AI reviews as append-only recommendations. This pilot retains that authority boundary and reuses `agent_reviews` and task events.

The first implementation adds a narrow transport contract and manual execution. Coordination remains operator-driven: choose a seed, run research and review, validate, and explicitly submit to an enabled development deployment. Automatic scheduling, country-wide fan-out, source-file ingestion, and sample-based acceptance need further implementation and evaluation.

## Run locally

Use authenticated Claude and Codex command-line clients that support the required isolation flags. The runner checks those flags and stops on incompatibility. Its permitted models are Claude `sonnet` and Codex `gpt-5.6-luna`; there is no fallback to a more expensive model. Claude's alias can resolve to a newer Sonnet, so retain the reported model identifier when the client supplies it.

Create an operator-selected seed containing `place_ref`, `name`, `country_code`, `seed_latitude`, `seed_longitude`, and `seed_source`. The internal pilot permits public, non-sensitive New Zealand seeds. Keep real runs, logs, and research decisions in the private research tier. The checked-in fixture uses invented evidence and is only for contract tests.

```sh
python3 scripts/agent_research/internal_runner.py \
  --backend codex --review-backend claude \
  --seed /absolute/path/public-seed.json \
  --out /absolute/path/private-run-directory \
  --public-nonsensitive --timeout 180 --budget-usd 2 \
  --pause-file /absolute/path/STOP

python3 scripts/agent_research/intake.py validate /absolute/path/private-run-directory/bundle.json
cargo run -p pow-cli -- validate-agent /absolute/path/private-run-directory/bundle.json --report json
```

The timeout applies to each provider attempt. The Claude budget is a reported-dollar ceiling enforced by its client; Codex has no equivalent dollar ceiling here. Its model, elapsed-time limit, output cap, and manual invocation bound the pilot operationally. Usage or cost unavailable from the client remains unknown. Do not interpret missing billing fields as zero cost. Creating the pause file prevents the next provider invocation; it is not an interrupt for an already running process.

Successful bundles contain a deterministic submission key, the dossier and review, and provider manifests with timestamps, trace and prompt hashes, model identifiers, exit status, and available usage. Rewriting an output bundle with different content is refused. Failed attempts retain local diagnostic records and produce no submit-ready bundle.

## Submit explicitly

After installing this code on a development deployment, its operator must enable `POW_INTERNAL_AGENT_INGEST_ENABLED=true`. The following controller command validates the file again and passes its exact bytes and SHA-256 to the internal mutation:

```sh
python3 scripts/agent_research/intake.py submit /absolute/path/private-run-directory/bundle.json \
  --deployment dev
```

Use a personal Convex CLI sign-in; the installed CLI refuses deployment-specific keys with this selector. The `dev` selector targets the operator’s personal development deployment; `local` is also permitted. Named deployments and production selectors are refused. The controller holds Convex credentials; model processes receive no deployment credentials. The server independently validates the bundle, recomputes its hash, and creates the provisional task, evidence draft, advisory review, audit event, and immutable receipt atomically. Retrying identical bytes returns the existing receipt. Reusing a submission key with changed bytes fails.

Authenticated reviewers, curators, and administrators can inspect receipts with `internalAgentIntake:getReceipt` or `listReceipts`. The list returns `page`, `continueCursor`, and `isDone`; pass the continuation token as `cursor` to inspect further pages. `batchDisposeReceipts` accepts `items` containing `receipt_id` and `expected_hash`, an `outcome` of `return` or `reject`, and a human note. Its batch limit is 20 records. For completed ordinary evidence, `reviews:getReviewSnapshot({taskId, evidenceDraftId})` returns the inspected evidence context, summary, and `snapshot_hash`. Submit selected items to `reviews:batchRecordReviewDecisions({items})`, each containing `task_id`, `evidence_draft_id`, `snapshot_hash`, and an ordinary `decision` with `decision_status: "accepted_for_export"`, the same evidence-draft identifier, and a human decision note. The endpoint applies the ordinary author-exclusion, additional-opinion, pending-period, and location checks. It retains the exact inspected snapshot and records its hash with each decision; `reviews:getRecordedReviewSnapshot` retrieves that audit record. Snapshots are limited to 128 KiB each and 512 KiB across the batch. Changes to related periods, derived states, historical claims, or advisory reviews also invalidate the snapshot.

The queue supplies the newest advisory review for the evidence draft currently under review. After a revision, the reviewer can decide the new draft while awaiting a new advisory review. The server rejects attempts to attach an advisory review from a different draft. Batch returns and rejections use the ordinary decision path, including its note requirement, review-claim release, and actor-role selection. Batch acceptance includes provisionally closed tasks under the same task-status rules as individual review.

Snapshot-linked decisions store `decision_hash_version: 1`. Their SHA-256 input is the canonical JSON envelope `{schema_version: "review-decision.v1", decision: <version-0 decision fields>, review_snapshot_hash: <inspected snapshot hash>}`. The version-0 fields are `review_decision_id`, `task_id`, `evidence_draft_id`, `reviewer_user_id` as a string, `decision_status`, `decision_note`, `accepted_action`, `identity_decision`, `location_outcome`, `target_year_affects`, `required_follow_up`, `agent_review_id`, `agent_review_agreement`, `created_at`, and `updated_at`. Canonicalisation drops absent fields. Decisions without a snapshot retain the version-0 hash contract and omit `decision_hash_version`. Database metadata and stored hash fields are excluded from each hash input.

The shared [intake regression cases](../../scripts/agent_research/fixtures/intake-regressions.json) run in the Python, TypeScript, and Rust suites. They cover empty URL userinfo, domestic and international NZ phone strings, historical year strings, escaped controls in values and keys, trailing newlines in constrained fields, source dates with a time suffix, and invalid or reversed manifest timestamps. Run manifests require complete UTC timestamps; source dates are validated by their calendar-date component. The Rust command also escapes controls in terminal error messages.

The runner's `raw_trace_sha256` hashes process stdout bytes, a newline byte, and process stderr bytes in that order. It differs from the hash of the enclosing JSONL attempt file. Stored stdout and stderr undergo credential redaction and output limits. Therefore, reproduction from retained text is possible only when those transformations preserve the bytes. Verify and record that equality when preserving a run. `prompt_sha256` hashes the combined system and user text with the runner's separator. Claude's flat usage fields describe the primary model; helper usage and total reported cost remain in `provider_usage.modelUsage`. Codex's flat usage fields describe the process. Comparisons must account for those scopes and the providers' cache-accounting conventions.

These are backend operations for internal runs; the existing RA interface is unaffected. A batch-review screen and automatic conversion of agent claims into ordinary evidence remain follow-up work.

## Hostile input and evaluation limits

JSON validation enforces structure and bounds; it cannot prove a source truthful or remove all prompt injection. The controller treats model output as data. It accepts bounded UTF-8 JSON, rejects duplicate or prototype-like keys and non-finite numbers, and checks claim coverage, dates, provider identities, and source locators. The transport limit is 64 KiB, nesting is limited to 32 levels, and dossiers contain at most 20 claims. Source locators use public HTTP(S) DNS hostnames checked syntactically; numeric IP hosts are refused. Ingestion does not fetch them or resolve their hostnames.

Model processes start in a fresh working directory with shell, file-editing, connector, hook, and subagent capabilities disabled by their client configuration. They receive only the selected public seed and the resulting dossier. Tool-event auditing adds a detection layer where the client exposes events. These controls reduce the impact of malicious source instructions; client regressions and unreported provider-side behaviour remain evaluation limits.

The intake route accepts JSON only. Source URLs may still identify PDFs, and a provider’s built-in web tool may attempt to fetch them despite prompt instructions. Such instructions are not a file-quarantine control. It neither downloads attachments nor parses PDFs, archives, scripts, or office documents. Future file ingestion needs a quarantined fetcher, redirect and DNS checks, MIME and size limits, isolated parsing, provenance hashes, and explicit release of extracted text. A model's own safety response contributes behavioural evidence alongside those controls.

Evaluate public discovery against what public sources could establish. Hold privately supplied observations out of research prompts. A model should preserve uncertainty about undocumented worship rather than infer absence from a sale, denominational closure, or deconsecration. Measure source support, scope errors, disagreements, human review time, rejected or deferred cases, usage, and latency separately. Small internal runs establish whether this pipeline works; they do not estimate quality or cost across the global inventory.

Client configuration follows the installed command-line help, with [Codex security guidance](https://developers.openai.com/codex/security) and the [Claude CLI reference](https://code.claude.com/docs/en/cli-reference) as supporting documentation. Recheck the controls when upgrading either client.
