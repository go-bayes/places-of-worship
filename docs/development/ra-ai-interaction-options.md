# RA–AI Interaction Options

Status: OPTIONS for JB, 2026-07-07. Nothing here is decided. The
ratified design boundary holds throughout: every AI output is a
provisional claim in the same queue, review path, and `pow` export
boundary as human work (`docs/portal-free-contribution-design.md`).

Three distinct functions keep getting mixed together in "RAs talking to
AI". Separating them makes the options clear.

## Function 1 — Source Extraction Inside The Pipeline

This function is already designed and ratified: the agent-assisted lane
(RA supplies a source, agent extracts `agent_draft` claims, RA confirms
each one before submission) and the agent-autonomous lane (bulk runs
under the ratified volume controls). The open question is only the
calling mechanism.

| Option | How it works | Available |
| --- | --- | --- |
| JB-run extraction sittings | Claude Code / Agent SDK session extracts claims from a scan, PDF, or URL and writes `agent_draft` records with full provenance (run id, model, prompt version, source locator). | Now, no new infrastructure. |
| Convex action proxy | A Convex action holds the Anthropic API key server-side and exposes an in-app `Extract from this source` button behind role gates, run caps, and the field limits. | After the Convex binding (JB-gated). |
| codex (GPT-5.5) for mechanical transcription | Bulk OCR-style transcription of tabular or directory sources, same provenance fields, model recorded as such. | Now, for grunt extraction only per the model-routing policy. |

An API key must never ship in the browser. The Convex action is the
natural proxy because role gates, caps, and audit events already live
there.

## Function 2 — Conversational Help For RAs

RAs asking questions ("how do I record a bounded date?", "is this a
relocation or a new site?") is support work, and it should stay outside
the evidence pipeline. The boundary rule for every option below: chat
helps an RA understand and draft; claims still enter through the
workbench with their sources, and an AI statement without a source
locator is a lead to verify rather than evidence.

| Option | Strengths | Costs and limits |
| --- | --- | --- |
| Claude for Teams | A shared Project can hold the RA guides, evidence templates, and FAQ as project knowledge, so answers cite the project's own rules. No build work. | Per-seat cost; answers live outside the pipeline; provenance is manual. |
| Claude in Slack | Meets RAs where coordination already happens; the whole team sees the questions and answers; very low friction. | Shallower context than a Project; same outside-the-pipeline caveat. |
| In-workbench assistant | Sees the claim the RA is editing, so help is contextual ("this date needs a basis") and extraction is one click away. | Needs the Convex proxy, guardrails, and its own review; a later step, after the binding. |

These options compose rather than compete: Slack or Teams for the
pilot's support channel now, the in-workbench assistant as the lasting
home once the Convex binding lands.

## Function 3 — External Evidence Gathering

AI can search external sources for building construction dates,
establishment and closure dates, denominational lineage, and relocation
evidence. Candidate NZ sources, roughly in order of licence clarity and
extraction ease:

| Source | Yields |
| --- | --- |
| Heritage New Zealand List | Construction dates, architects, historic names for listed churches. |
| Papers Past | Opening services, foundation stones, fires, closures, congregational moves, with dates. |
| NZ Charities Register | Active congregations, legal names, registration dates. |
| Denominational yearbooks and archives | Parish histories, circuit lists, closures and amalgamations. |
| Wikidata / DigitalNZ | Cross-references and images; useful for matching more than for primary claims. |

Every such run is the agent-autonomous lane: outputs carry
`agent_generated = true`, per-claim source locators, and confidence;
the ratified controls (source allowlist, run manifest, idempotency
keys, daily and per-run caps, confidence gate, pause switch) are
preconditions for Convex ingestion; and the per-source verification
directive (JB, 2026-07-07) applies before anything reaches a public
surface.

A sensible pilot: one bounded run over one allowlisted source
(Heritage New Zealand List entries for churches), producing
source-first claims with construction dates, sample-reviewed by a
human before any batch decision. That exercises the whole lane at a size a reviewer can
actually inspect.

## Suggested Sequence

1. Now: JB-run extraction sittings for archival sources; a Slack
   channel or Teams Project for RA support with the boundary rule
   stated in the RA guide.
2. After the Convex binding: the extraction proxy and the in-workbench
   `Extract from this source` button, agent-assisted lane only.
3. After the bulk controls are implemented and tested: the bounded
   Heritage NZ pilot run, then further sources one allowlist entry at
   a time.
