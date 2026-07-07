# Playbook: external evidence gathering (agent-autonomous pilot)

Status: DEFERRED — HIGH PRIORITY, not yet scheduled (JB direction
2026-07-07). Do not start without a JB go-ahead.
Task: #12 (next free number in this worktree at 2026-07-07; renumber at
merge if the map session has taken it). Effort: one design sitting +
one bounded pilot run + one review sitting.

## Goal

Use AI to gather site evidence from external sources — building
construction dates, opening and closure dates, denominational lineage,
relocations — as source-first claims in the provisional queue. The
review boundary is untouched: every claim is provisional, carries its
source and locator, and reaches nothing public before reviewer
acceptance and `pow`.

## Preconditions (all ratified or directed; none yet implemented)

- The agent-autonomous lane controls from
  `docs/portal-free-contribution-design.md` are a ratified precondition
  for Convex ingestion: source allowlist, run manifest, `claim_hash`
  idempotency, daily and per-run caps, confidence gate, sensitivity
  gate, conflict gate, pause switch.
- Per-source verification (JB directive 2026-07-07): every claim
  carries its source, and each source is verified separately before
  anything reaches a public surface.
- Licence and provenance recorded per source (name, URL or archive
  reference, licence, retrieval date, access limits) before extraction,
  per the repository's storage and attribution rules.
- The Convex binding for the workbench is itself JB-gated; until it
  lands, pilot outputs stay in demo-mode or in ignored local exports.

## Candidate sources (NZ first)

| Source | Yields | Notes |
| --- | --- | --- |
| Heritage New Zealand List | Construction dates, architects, historic names for listed churches | Cleanest licence path; first pilot target. |
| Papers Past | Opening services, foundation stones, fires, closures, moves | Rich dates; OCR noise needs confidence gating. |
| NZ Charities Register | Active congregations, legal names, registration dates | Good for present-day corroboration. |
| Denominational yearbooks and archives | Parish histories, circuits, amalgamations | Licence and access vary; source-by-source. |
| Wikidata / DigitalNZ | Cross-references and images | Matching aid more than primary evidence. |

## Pilot shape

One bounded run over one allowlisted source: Heritage New Zealand List
entries for churches, producing source-first claims with construction
dates and per-claim locators, at a size a reviewer can actually
inspect. Sample review before any batch decision; batch decisions
record the sampling plan per the ratified design.

## Acceptance checks

- Every claim in the pilot output carries `agent_generated = true`, an
  agent-autonomous origin, a source locator, and a confidence level.
- The run manifest records source hashes, pipeline version, thresholds,
  and expected counts; reruns do not duplicate claims.
- A reviewer can reject the whole run with one reason, and the pause
  switch stops ingestion mid-run.
- No pilot output appears on any public surface.
