# AI and human review at scale — design brief (2026-09-04)

Status: RULED IN PRINCIPLE 2026-09-04 (JB, section 9, his words); build not started. Drafted at JB's request after PR #94: "to review 1.6 million PoWs will need AI review as well as human. How shall we approach this? We must consider the design." Sits between the annual OSM audit runner (`osm-annual-audit-scoping-2026-09-03.md`) and the duplicate-pruning discussion left open under R-O3, and beneath the PI acceptance layer (`pi-acceptance-layer-brief-2026-09-04.md`).

## 1. The problem

The OSM stock counts about 1.54 million `amenity=place_of_worship` records across the project's countries at the 1 September 2026 anchor. Every one is an open case: the amber dot, `unvalidated`. Reviewing the stock by hand at three minutes a record is about 80,000 hours, roughly forty person-years. The project cannot review the stock, and it must not publish machine labels as validated records. The design has to change what a review is at that scale while leaving every existing rule where it stands: humans decide, AI recommends; validated states come only from a reviewer's decision and a PI's acceptance; culturally sensitive material never reaches an external model.

## 2. Reframe the unit

Three populations need different treatment.

1. **Submissions.** Evidence filed by RAs and collaborators: hundreds to low thousands. Full human review, then PI acceptance, as now. AI pre-triage exists for this lane already (`docs/portal-claude-batch-review.md`) and is unchanged.
2. **The census of change.** The record classes the annual audit produces between editions (stable, tag change, geometry change, identifier churn, apparent addition, apparent removal, duplicate or split or merge candidate, unresolved). Tens of thousands a year, not millions.
3. **The stock.** The 1.54 million records themselves. Never reviewed one by one. Characterised by deterministic checks over all of it, AI screening over the informative slice, and a human-reviewed probability sample that supports population estimates with uncertainty.

Human effort scales with submissions and with churn, never with the stock.

## 3. The principle: an AI verdict is an auxiliary variable

A screening verdict is data about a record, recorded with full provenance, and it is never a validation state. It changes where human effort goes (which records become tasks, how the sample is stratified) and it never changes what the project says about a place. Population claims (how many real places of worship, how many duplicates, how many closures) are design-based estimates from the human-reviewed probability sample, with the AI class as a stratifier or a model-assisted auxiliary. The human sample also calibrates the AI's error rates per stratum, so every published number carries its uncertainty and the AI's confusion matrix is itself a reported result.

## 4. The tiers

1. **Deterministic checks over everything.** Run in the audit pipeline over each R2 edition, exact and cheap: the 2025 NZ cleaning rules (section 5), coincident and near-coincident records, node-inside-way pairs, tag consistency, lifecycle date tags, geometry inside a building. Output is a per-record flag set with rule ids and versions.
2. **AI screening over the informative slice.** Records with at least one deterministic flag, every record in a changed census class, and a random slice of the flag-free stock (so the screen's false-negative rate on "clean" records is measurable). Text only: the OSM record, its tag history, and its neighbours within a radius. No images, no capture locations, no privacy-flagged or culturally sensitive material. Output is a structured verdict: `likely_place_of_worship`, `likely_duplicate_of <id>`, `likely_not_place_of_worship <class>`, `likely_closed`, `cannot_tell`, with a confidence, the evidence lines it relied on, and the audit class it proposes. Provenance as the agent reviews table already carries: agent name, provider, model, prompt version, run id.
3. **Human review of three things.** Every submission, as now. The probability sample of the stock, stratified by country, deterministic flag set and AI class. And every actionable AI flag above a threshold, under a daily cap, as tasks in the review portal with the verdict shown in the existing AI-recommendation panel. Sensitive records are human only; the kastom gate stands.
4. **PI acceptance** of anything that changes a master record, the layer built in PR #93.

## 5. The audit classes, covering the 2025 NZ cleaning

JB (2026-09-04): "for the classes we need to audit, there should be a history of NZ cases that we cleaned at the last PoW entry ... places that were identically located, Claude drew up a list of attributes (schools etc). We should try to cover that work." The rules live in `scripts/clean_global_places.R` and were applied in the first strict national run of 2026-05-07 (`nz-osm-temporal-cleaning.md`). Each becomes a named, versioned audit class so the screen, the sample and the tasks speak the same vocabulary. The rule ids are proposed here and fixed when the class list is versioned (as R-O4 fixes the hash field list).

| Class id | Rule as applied in NZ | Source of the rule |
| --- | --- | --- |
| `not_pow_amenity` | `amenity` in childcare, school, hospital, social_facility, college, university, kindergarten, community_centre, events_venue, library, pub, grave_yard, parking | `excluded_amenities` |
| `not_pow_building` | `building=school` | `excluded_buildings` |
| `not_pow_name` | name matches cemetery, burial, urupā, office, residence, pub, kindergarten | name pattern |
| `placeholder_name` | "Place of Worship N" with no tags; "<Religion> Place of Worship" with no amenity and no building | name pattern |
| `masonic` | masonic centre or masonic hall | name pattern |
| `support_building` | hall, centre or house within 100 m of a church, cathedral, chapel, temple, mosque, synagogue or gurdwara that shares a name token or the denomination, unless the name marks it a worship space (kingdom hall, gospel hall, church of Christ hall, and the listed exceptions) | `is_support_building_duplicate` |
| `school_named` | school, academy, seminary or college in the name, kept only when chapel-like or `amenity=place_of_worship` is explicit | name pattern with exception |
| `coincident` | two records at the same coordinates, or a node inside a way, both carrying the worship tag; the identical-location cases JB names | new, deterministic |
| `near_duplicate` | same name tokens and denomination within a radius, not covered above | new, deterministic candidate for the screen |
| `lifecycle_dated` | start, end, opening, disused or was tags with parsed bounds and parser warnings | `nz_osm_date_tag_places_to_check` |
| census classes | stable, tag change, geometry change, identifier churn, apparent addition, apparent removal, split or merge candidate, unresolved | `research/sparrc/osm-repeat-2025-2026` protocol |

Two consequences. First, the NZ cleaned outputs of 2025 and 2026 are the first labelled set: every record the rules dropped is a case with a known class, and the screen is tested against them before it runs anywhere else. Second, the rules stay deterministic where they can be; the AI screens only what the rules cannot settle (a hall that might be the congregation's only building, a school chapel in use, a duplicate pair with different names).

## 6. The cascade and independent review

JB (2026-09-04): "yes on the two model cascade, although stay away from Sonnet. GPT Luna class is very good and cheap." And: "Multi-agent independent review makes sense too."

- **Screen.** A cheap model over the informative slice, batched, capped, idempotent by edition, record version and prompt version. JB named the GPT "Luna" class as the screening tier; the exact model identifier is recorded in the run manifest once JB confirms it, and no Sonnet-class model is used at either tier.
- **Escalate.** A strong model on every actionable verdict and every `cannot_tell`, with the screen's verdict withheld from it so the second reading is independent.
- **Independent readers.** For records that will become tasks or enter the estimation sample, two or more independent screens (different model families or prompts, no shared context). Agreement is recorded per record; disagreement is itself a class and raises the record's sampling weight and its priority in the human queue. This is the review-side counterpart of the second-opinion gate on acceptance.
- **AI-drafted evidence.** JB: "I think we should allow AI-drafted evidence, recorded as such." A screen or escalation may draft an evidence record (the sources it checked, with locators) in the agent-assisted lane, marked `ai_generated: true` with agent, provider, model and prompt version, entering the same queue as human work. A human confirms it before it is a decision; a PI accepts it before it is a record. An AI statement without a source locator is a lead, not evidence.

## 7. Samples and estimation

Two samples with different roles, as the sparrc protocol already separates them.

- **Rule-development sample.** Deliberately enriched, about fifty cases per class or per country group, to expose failure modes of the rules and the prompts. It estimates nothing.
- **Estimation sample.** A stratified probability sample of the stock, strata by country, deterministic flag set and AI class, with selection probabilities preserved. A few thousand records gives population proportions to within about two percentage points overall; per-country precision follows the allocation, which is a ruling (section 9). Reviewers answer narrow questions with non-OSM evidence, as the protocol requires. The published outputs are the estimated prevalence of each class with intervals, and the AI's sensitivity and specificity per stratum.

## 8. Where it runs and where it lives

- Screening reads the R2 editions (`pow-osm-editions`) and writes its verdicts beside them, partitioned by edition and country, keyed by OSM id, object version and prompt version, hash-stamped in the manifest like the audit itself. Reproducible: the same edition, prompt and model give the same file.
- Only three things enter Convex: actionable flags above threshold (as tasks with the verdict attached), the estimation sample (as tasks with a narrow question), and AI-drafted evidence in the agent-assisted lane. Convex holds tasks and decisions, not 1.54 million rows.
- Re-screening between editions covers only records whose hash changed, plus the fresh random slice, so the annual cost is the churn.
- Run controls carry over from the batch-review lane: service-role attribution, run manifests, per-run and daily caps, idempotency keys, a pause switch, JB-triggered until a schedule is deliberately enabled.
- The portals show a screening verdict as its own reading (the AI panel in the review portal; a "screened" note on the submit portal's popup). The public map shows nothing from screening.

## 9. Rulings (JB, 2026-09-04, his words) and rulings still open

Ruled:

- **R-A1 Never validated.** "yes, never validated." A screening verdict is never a validation state on any surface.
- **R-A2 Estimation by probability sample with the AI class as stratifier.** "yes that's a good way to go."
- **R-A3 Audit classes.** "for the classes we need to audit, there should be a history of NZ cases that we cleaned at the last PoW entry ... We should try to cover that work." Section 5 covers the 2025 rules and adds the identical-location classes.
- **R-A4 Two-model cascade.** "yes on the two model cascade, although stay away from Sonnet. GPT Luna class is very good and cheap."
- **R-A5 Outputs beside the editions in R2; only flags and samples enter Convex.** "yes."
- **R-A6 AI-drafted evidence.** "yes I think we should allow AI drafted evidence, recorded as such."
- **R-A7 Independent multi-agent review.** "Multi-agent independent review makes sense too."
- **R-A8 Acceptance.** "we'll keep the PIs for acceptance of the record."

Open:

- **R-A9 Model identifiers.** The exact screening and escalation models, recorded in the manifest. JB to confirm the "Luna" identifier and the escalation model.
- **R-A10 Thresholds and caps.** The confidence at which a verdict becomes a task, the daily task cap per country, and the random-slice fraction of the flag-free stock.
- **R-A11 Sample allocation.** Overall size and per-country allocation of the estimation sample, and which countries enter the first wave.
- **R-A12 Class list version.** Fix the class ids of section 5 as version 1 before the first screen runs, as R-O4 fixed the hash field list.
- **R-A13 Reader count.** Two independent readers for tasks and the sample, or three with majority, and whether the readers must differ in model family.

## 10. Build plan

- **PR-S0, class list.** Version the audit classes of section 5; port the NZ rules from R into the audit runner so they run over every edition; produce the NZ 2025 and 2026 labelled sets.
- **PR-S1, screen.** The screening runner over R2 editions with manifest, caps, idempotency and the verdict schema; tested against the NZ labelled set before any other country.
- **PR-S2, cascade and readers.** Escalation and independent readers with agreement recording; AI-drafted evidence into the agent-assisted lane with provenance.
- **PR-S3, sample and tasks.** Stratified sampling with preserved weights; task creation for flags and sample rows; the narrow-question task form; the verdict in the review portal's AI panel.
- **PR-S4, estimation.** The design-based estimators, the calibration report (AI sensitivity and specificity per stratum), and the published class prevalences with intervals.

## 11. What does not change

- The reviewer decision vocabulary, the required note, the second-opinion gate, and PI acceptance.
- The six validation states and their rings on both portals and the public map.
- The kastom and privacy gates: sensitive material never reaches an external model.
- The RA lanes and the rapid-entry, occupancy, historical-claim and location contracts.
