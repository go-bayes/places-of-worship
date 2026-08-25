# Claude Batch Review Lane

Status: DESIGNED AND BUILT 2026-07-07 (dev-deployment code only; every
activation step is a JB decision). Commissioned by JB, 2026-07-07:
before JW and JB open the review queue, Claude reviews each pending
submission in batch and attaches a recommendation, so the human queue
arrives already triaged.

Boundary, stated first: **humans decide; AI recommends.** The ratified `human_confirmed` gate and the reviewer decision path are untouched. No function in this lane changes a task status, an evidence draft, or a review decision. The lane only appends review artifacts and audit events. A recommendation can never accept a claim.

This document names the built Anthropic automation runner. Authorised session runs may use another provider while following the same review contract. Every artifact records its actual `agent_name`, `model_provider`, and `model_name`; the reviewer interface therefore labels the result as an AI recommendation and shows that recorded agent, provider, and model.

Related references:

| Reference | Use here |
| --- | --- |
| `docs/portal-free-contribution-design.md` | Ratified agent-lane design this lane extends. |
| `docs/development/ra-ai-interaction-options.md` | The Convex action proxy pattern for server-side model calls. |
| `schemas/change-event.schema.json` | Source-reference discipline the evidence contract mirrors. |
| `docs/development/workbench-publication-plan.md` | The JB-gated publication and binding steps this plan slots behind. |
| `apps/regions/nz/review.html` | The reviewer queue where recommendations surface. |

## Where This Sits In The Agent-Lane Design

The ratified design has three contribution lanes (fixed,
agent-assisted RA, agent-autonomous). Batch review is not a fourth
contribution lane: it produces no claims and enters nothing into the
evidence queue. It is the review-side counterpart of the
agent-autonomous lane's queue-shaping mechanisms (batch summary,
stratified sample), and it reuses that lane's control vocabulary —
service-role attribution, run manifests, per-run caps, idempotency
keys, and a pause point (the runner is JB-triggered until a cron is
deliberately enabled).

## Data Model

Two tables, both append-only.

### `agent_reviews` — one AI recommendation for one claim version

| Field | Content |
| --- | --- |
| `agent_review_id` | `{task_id}:agent-review:{ms}:{n}` — unique, sortable. |
| `task_id`, `evidence_draft_id` | The claim reviewed. A re-review of a revised draft appends a new artifact; nothing is overwritten. |
| `version` | 1-based sequence per task, so reviewers see "review 2 of 2". |
| `batch_id` | The run that produced the artifact (see `agent_review_batches`). |
| `recommendation` | `accept` \| `revise` \| `reject` \| `defer_cultural`. |
| `reasoning` | Bounded prose (LONG_TEXT_MAX): why the recommendation follows from the checked sources. |
| `sources_checked` | Array of per-source verification records (contract below). |
| `cultural_sensitivity` | `{ flagged, basis }` — why the kastom gate did or did not bind. |
| `agent_name`, `model_provider`, `model_name`, `source_check_model`, `prompt_version` | Full provenance, mirroring the ratified extraction-run fields. |
| `actor_user_id` | The service-role user; recommendations are attributed like any other actor's work. |
| `ai_generated` | Always `true` — the provenance field the PR #17 review asked data products to carry applies to review outputs identically (JB directive 2026-07-07). |
| `created_at` | Server time. |

### `agent_review_batches` — one record per runner invocation

Carries `batch_id`, trigger (`jb_cli` \| `cron`), optional country
filter, prompt and model versions, caps, per-outcome counts
(reviewed, skipped as already reviewed, deferred cultural, failed),
truncated error notes, and start/completion times. This is the run
manifest the ratified bulk-lane controls require.

### `review_decisions` additions

Two optional fields record what the human saw and what they did with
it: `agent_review_id` (which artifact was on screen) and
`agent_review_agreement` (`followed` \| `disagreed` \|
`not_considered`). The decision itself is unchanged — same statuses,
same required human note, same role gates.

## The Kastom / Cultural-Sensitivity Gate

Flagged-sensitive items enter the batch for **source checking only**.
For a flagged item the runner records the per-source verification
results and forces `recommendation = defer_cultural`; the synthesis
model is never asked to judge the cultural claim itself. The reviewer
UI renders this as "Requires human cultural judgement", never as a
lean toward accept or reject.

An item is flagged when any of these hold:

1. The evidence draft's `privacy_flag` is `needs_review` or
   `restricted`.
2. The task's country is `VU`. This country-level default is
   deliberately conservative: until the free-contribution Convex
   binding carries the explicit `culturallySensitive` answer from the
   workbench sensitivity prompt, every Vanuatu submission defaults to
   human cultural judgement.
3. The draft's generated wide row carries a truthy
   `culturally_sensitive` field (forward-compatible with the binding).

Relaxing rule 2 to the explicit per-record flag is a JB decision for
after the free-contribution binding lands.

## The Evidence Contract (Source-First Recommendations)

Attribution and per-source verification rules apply to review outputs
exactly as to data products. Every artifact must say what was checked
and what the check found; an unchecked source is recorded as
unchecked, never silently passed. Each `sources_checked` entry:

| Field | Content |
| --- | --- |
| `source_title`, `url_or_file` | Which source, in the draft's own terms. |
| `check` | What was assessed: `existence`, `date_support`, `location_plausibility`. |
| `method` | `http_fetch` (the runner fetched the URL and a model read the retrieved content) or `not_checked`. A third value, `model_assessment`, is reserved in the schema; no current code path emits it. |
| `outcome` | `supported`, `not_supported`, `unclear`, `unreachable`, or `requires_human_access` (offline/archive sources). |
| `note` | One or two sentences of specifics — what the fetched page said, or why the check could not run. |

The synthesis prompt receives only these recorded check results plus
the draft fields; the recommendation must cite them, and `reasoning`
that asserts a verification with no matching `sources_checked` entry
is a prompt-contract violation to fix, not a display problem.

Two boundary rules govern what the checks may touch. First,
privacy-flagged evidence (`privacy_flag` of `needs_review` or
`restricted`) never leaves the deployment: the runner performs no fetch
and no model call for it, and the artifact records that the check was
withheld. Second, fetched page content is contributor-controlled text:
the runner walks redirects manually and refuses private and local hosts
at every hop, and the check prompt treats page text as data to judge,
never as instructions — but a hostile page can still bias the cheap
model's outcome notes, which is one more reason the artifact is
advisory and the human decision is the gate.

## Model Routing (JB Cost/Capability Policy)

Two model calls per item, costed deliberately:

| Step | Model | Why |
| --- | --- | --- |
| Source-check interpretation | `claude-sonnet-5` | Mechanical reading, but Sonnet is the floor: JB rule 2026-07-07 bans Haiku in every role after repeated quality burns; check errors would flow into the recorded outcomes reviewers rely on. |
| Recommendation synthesis | `claude-sonnet-5` | Weighing partial evidence, dedup risk, and validation state needs judgement, but the task is bounded (one claim, a handful of checks) and the output is advisory with a human decision behind it — frontier-tier synthesis is not warranted. |

Both model ids are recorded per artifact, so a later routing change is
visible in the record rather than silent. The deterministic HTTP fetch
itself is not a model call and costs nothing.

## The Runner

`convex/claudeReviews.ts : runBatch` is an **internal action** — it is
callable only with the deployment admin key (CLI, dashboard, cron),
never from the public API, so an unauthenticated caller cannot trigger
model spend or artifact writes. Flow:

1. Pull tasks in `needs_review` (optionally one country), each with its
   latest submitted or unresolved-note draft — the same selection the
   reviewer queue shows.
2. Skip items whose latest draft already has an artifact at the current
   `prompt_version` (idempotency), unless `forceRerun` is passed.
3. Cap the run (`maxItems`, default 10) — the per-run cap from the
   ratified bulk-lane controls, sized so a worst-case batch fits one
   action's time budget; idempotency makes clearing a longer queue with
   repeated runs cheap.
4. Per item: run the source checks, apply the kastom gate, synthesise
   the recommendation (or force `defer_cultural`), write the artifact
   and a `note_added` task event through internal mutations.
5. Close the batch record with counts and any per-item errors. Item
   failures never abort the batch and never write a partial artifact.

Trigger now: JB (or a JB-authorised sitting) runs
`npx convex run claudeReviews:runBatch '{}'` against the dev
deployment. A cron entry is prepared in commentary but not registered;
scheduling it is a JB decision.

## Reviewer Experience

The review portal (`apps/regions/nz/review.html`) surfaces the latest
artifact per task:

- Queue cards carry a compact pill (for example `AI: accept`,
  `AI: human judgement`) so triage order is visible before opening.
- The detail page gains an "AI recommendation" panel: recommendation pill, agent, provider, model and date line, version count, reasoning collapsed under an expandable summary, and the per-source verification table.
- Two explicit affordances: **Use recommendation** prefills the
  decision select with the mapped decision (`accept` →
  accepted for export, `revise` → needs more evidence, `reject` →
  rejected) and marks agreement `followed`; **Decide differently**
  marks `disagreed` and focuses the decision form. Neither submits
  anything: the decision note and the Record button remain the human
  act. `defer_cultural` offers no prefill — only the disagree-free
  path of the reviewer's own judgement.
- If the reviewer ignores the panel and decides anyway, the recorded
  agreement is derived from whether the decision matched the
  recommendation, so the provenance never claims the human followed
  advice they contradicted. The derivation errs the other way by
  design: a coincidental match records `followed` even when the panel
  went unread, so agreement counts overstate engagement, never
  disagreement — read them accordingly. (`not_considered` exists in the
  schema for clients that can attest non-display; the portal cannot.)
- A per-task version history query (`listAgentReviewsForTask`) is
  prepared and reviewer-gated; the portal currently renders only the
  latest artifact, and wiring the history view is a later touch.

## Controls And Limits

| Control | Rule |
| --- | --- |
| Trigger | Internal action only; JB-run until a cron is deliberately registered. |
| Per-run cap | `maxItems`, default 10, hard ceiling 50. |
| Idempotency | One artifact per (evidence draft, prompt version); reruns require `forceRerun`. |
| Text limits | `reasoning` ≤ LONG_TEXT_MAX; `sources_checked` JSON ≤ VALIDATION_SUMMARY_MAX; over-limit model output is truncated with a recorded note. |
| Fetch budget | One GET per source URL with at most 3 manually-walked redirects, each hop checked against the private-host block; 10 s timeout; first 20,000 characters of stripped text; no retries. |
| Batch deadline | The runner stops starting new items 7 minutes in and closes the manifest with a deadline note, leaving budget for one worst-case in-flight item inside the Convex action time cap. A batch found stuck at `running` (crash, cap overrun) is safe to re-run: artifacts are idempotent per (draft, prompt version). |
| API key | `ANTHROPIC_API_KEY` lives in the Convex deployment environment, server-side only (the action proxy pattern from `ra-ai-interaction-options.md`). Never in the browser, never committed. |
| Pause | An absent key fails the run loudly before any artifact is written. The service user is created on demand and cannot block a run. |

## Activation Checklist (JB — prepared, not performed)

Dev deployment first; production only after the dev run is inspected.

1. `npx convex dev --once` in the repo pushes the schema and functions to
   the **dev** deployment (`pastel-goshawk-398`, the one the portals use).
   `npx convex deploy` goes to the empty prod deployment instead; see
   `docs/development/convex-task-layer-setup.md`.
2. Set the key on dev: `npx convex env set ANTHROPIC_API_KEY <key>`.
3. Optional: pre-seed the service user with
   `npx convex run claudeReviews:ensureServiceUser '{}'` (idempotent;
   the runner also creates it on demand).
4. Dry run: `npx convex run claudeReviews:runBatch '{"maxItems": 3}'`,
   then inspect the artifacts in the dashboard and the portal.
5. Production binding (separate decision): repeat 1–3 against prod
   (`--prod`), run one capped batch, inspect, and only then consider
   registering the cron. The production flip stays JB's alone, per the
   standing directive.

Until step 1, everything in `convex/` from this arc is inert code in
the repository, exactly like the rest of the prepared binding work.
