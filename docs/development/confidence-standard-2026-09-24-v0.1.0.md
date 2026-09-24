# Confidence standard for recorded judgments

**A confidence score is a recorded judgment about a candidate place of worship. Confidence scores are recorded AI judgments; humans decide acceptance.**

Version: 0.1.0. Date: 2026-09-24. Status: adopted by the project lead. This dated snapshot keeps version 0.1.0 as adopted. The [canonical confidence standard](../confidence-standard.md) presents the current version. Passages headed or marked *proposed* record design that the project lead has yet to rule on; everything else in this document is adopted.

## Purpose

The [operational definition](../operational-definition.md) states what a place of worship is. It leaves open how sure the project is that a given record meets that definition. Most records on religionmap.org come from OpenStreetMap, whose place-of-worship tag volunteers apply without a shared rule; the definition therefore describes the evidence for the map as a whole as uncertain. The project now registers those records with confidence scores. As scoring changes from a heuristic to a calibrated procedure, the project needs a public standard that says what a score means, how it is produced, how it is validated, and how a person uses it. This document is that standard. It is versioned so that every recorded judgment can name the standard it was made under, and so that a later change to the standard can be compared with the judgments made before it.

Two commitments hold throughout. First, a score changes the order of the review queue and the amount of preparation a reviewer receives; it accepts nothing. Acceptance remains a reviewer's recorded decision on the reviewed evidence and the principal investigator's acceptance for release. Second, every score is a judgment with an author, a method version, and a basis, recorded where a person can dispose of it. As such, the project can later measure how often the scorer was right.

## The statistical estimand

We define the score for a dated extract of source features, which we call an *edition*. An edition $E$ is the set of OpenStreetMap features tagged `amenity=place_of_worship` for one country as they stood at the *edition date* $t_E$, recorded with a hash so that the same edition can be scored again. Each feature $i \in E$ gives a location $\ell_i$ (a node's coordinates or a footprint's centroid) and a set of tags.

For feature $i$ we define three events at the edition date. $A_i$: the feature denotes one real place of worship under the operational definition, rather than a duplicate of another feature or a mistagged object. $L_i$: the site of that place lies within 75 metres of $\ell_i$. $U_i$: recurring worship by or for a community continues at that place at $t_E$. The *registration confidence* $p_i$ is the calibrated probability that all three events hold:

$$p_i = \Pr(A_i \cap L_i \cap U_i \mid s_i),$$

where $s_i$ is the vector of evidence signals recorded for the feature (next section). *Calibrated* means that among features assigned a score near $p$, the proportion for which the three events hold is near $p$; the calibration section states how that property is fitted and evaluated. The 75-metre tolerance is the tolerance the project's locator validator uses for a location claim.

Four component scores are recorded beside the composite, each a calibrated probability of its own event: an *identity* component for $A_i$; a *location* component for $L_i$; a *status* component for $U_i$; and a *denomination* component for the event that the feature's `religion` and `denomination` tags match the place's own description. The denomination event is outside the composite, because a place with a wrong denomination tag is still a place of worship. The tiers below use the components as well as the composite. As such, a demolished church with a well-mapped footprint is escalated rather than passed on the strength of its geometry.

The score describes the edition date only. Lifecycle dates, target-year states and relocations remain evidence questions answered through the project's evidence workflow; the score decides which features a person looks at and how soon.

## Evidence signals

The signal vector $s_i$ has two parts. The *deterministic signals* are computed from the edition and from public bulk sources without any model call. They therefore cost compute and storage alone, and they are recomputed whenever the scorer changes. The *model signals* cost money and are requested only where the deterministic vector is uninformative or contradictory.

| Deterministic signal | Source | What it measures |
| --- | --- | --- |
| tag completeness | edition tags | presence of `name`, `religion`, `denomination`, `building`, `addr:*`, `website` or `contact:*`, `opening_hours`, `wikidata`, `start_date`, and a `check_date` or `survey:date` |
| geometry | edition geometry | node against way or relation; footprint area; a `building` value specific to worship (`church`, `mosque`, `temple`, `synagogue`, `shrine`) against `yes` |
| edit history | OpenStreetMap full history | creation year, version count, distinct contributors, days since the last tag change, creation by import, deletion and re-creation |
| name quality | edition `name` | generic names against specific ones; script and language consistency; denomination words in the name against the `denomination` tag |
| duplicate risk | edition | another place of worship within 50 metres with the same religion, or a node inside a way with matching tags |
| cross-source agreement | public place datasets and registers (Overture places, Foursquare OS Places, Wikidata, national charity registers) | a match by name similarity and distance, with the partner's own confidence where it publishes one |
| building footprint | public building datasets | a footprint under the pin, which is evidence that a building exists and says nothing about its use |
| imagery availability | street-imagery metadata | whether imagery exists at the pin; a human observation remains the evidence |

The model signals come from two passes. The *screen* asks a bulk model a question whose answer takes a structured form: does a public page from an institutional host (the place's own site, a denominational directory, a council or heritage register) describe worship at this place in the two years ending at the edition date? The prompt names the edition date and the answer records the page's own date. A reopening after the edition or a closure before it is therefore scored against the right date. The answer contains the page's locator, the access method and a verbatim quotation. The *judge* pass is the project's research runner: two readers, a validator that re-fetches every locator, an advisory review, and a dossier written for a person. The screen and judge passes run on the current edition only; earlier annual snapshots receive the deterministic signals alone, because a web search cannot be anchored to a date a decade old.

## Tiers and cut points

The composite and its components map each feature to one of three tiers. The cut points are provisional: they stand until calibration replaces them with values that give the screened tier a lower 95 per cent confidence bound on precision of at least 0.95, and the project lead rules on the replacements.

| Tier | Condition (provisional) | What happens |
| --- | --- | --- |
| screened | $p_i \ge 0.9$, every component at or above 0.7, no duplicate or conflict indicator | registered as provisional and machine-screened; enters research-assistant review in capacity-matched batches with a stated audit sample; a reviewer disposes of the judgment rows |
| review | $0.6 \le p_i < 0.9$, or any conflict indicator, or any component below 0.7 | a research-assistant task showing the signal vector and any dossier |
| escalate | $p_i < 0.6$, or reader disagreement, or a cultural-sensitivity indicator, or a generic name with no cross-source match | a judge pass followed by a research-assistant task with the dossier; a feature under the cultural-sensitivity gate stops there |

We define the *precision* of the screened tier as $\pi_S = \Pr(A \cap L \cap U \mid \text{tier} = \text{screened})$, the proportion of screened features that are places of worship at the stated location and in use at the edition date. The target is a lower one-sided 95 per cent confidence bound on $\pi_S$ of at least 0.95, estimated on the validation sample described next. Cut points are calibrated per country, because tag practice differs between mapping communities.

## Calibration and validation

Calibration needs reference labels made by people, and two kinds of labelled set serve two purposes that the standard keeps apart, because the first cannot do the second's job.

The *development sets* are chosen: a canary set of about 25 places with human ground truth, deliberately including the hard cases and the disagreements, rerun on every change to a prompt, model, client or scorer; and the adjudicated places of the first measurement run. Development sets give reliability diagrams and Brier scores per component, the error classes the scorer misses, and drift between reruns. They cannot give an unbiased estimate of tier precision, and 25 places are too few in any case: 25 successes in 25 give an exact one-sided 95 per cent lower bound on precision of 0.887, below any threshold worth ruling.

The *validation sample* is drawn once per country from the edition by stratified random sampling over the provisional tiers, with inclusion probabilities recorded. Its reference labels are made by independent reference assessment: an assessor records the reference value for each field from the sources before seeing any scorer output or any closure. The scorer is registered before the sample is labelled, by recording its code revision and the hash of its signal vectors; any change to the scorer after labelling reopens the sample. Probability calibration is fitted on the development sets by a stated method (isotonic regression on the composite by default; a logistic model on the signal vector if the canary shows the composite is poorly ordered) and evaluated on the validation sample alone.

A cut point for the screened tier is promoted only when the lower 95 per cent confidence bound on $\pi_S$ reaches 0.95. When the screened stratum is sampled as one stratum with $n$ labelled features, the bound is the exact one-sided binomial (Clopper–Pearson) bound. When the final screened tier spans provisional strata $h = 1, \ldots, H$ sampled at different rates, with $N_h$ features of the edition in stratum $h$, $N = \sum_h N_h$, $n_h$ labelled from stratum $h$, $\hat p_h$ the proportion of those $n_h$ whose reference label confirms a place of worship, and $s_h^2 = \hat p_h (1 - \hat p_h)\, n_h / (n_h - 1)$, the estimate is $\sum_h (N_h / N)\, \hat p_h$ with variance $\sum_h (N_h / N)^2 (1 - n_h / N_h)\, s_h^2 / n_h$.

We define *power* here as the probability, at a stated true precision, that the bound reaches 0.95; the target is 80 per cent. A sample at the boundary clears the bound by luck. The sample is therefore sized prospectively:

| True screened-tier precision | $n$ for 80 per cent power (failures allowed) | $n$ for 90 per cent power (failures allowed) |
| ---: | ---: | ---: |
| 0.99 | 124 (2) | 153 (3) |
| 0.985 | 153 (3) | 208 (5) |
| 0.98 | 234 (6) | 311 (9) |
| 0.97 | 601 (21) | 832 (31) |

A tier whose precision is below 0.97 is cheaper to shrink, by raising its cut point or improving the scorer, than to validate; relaxing the required precision would be a separate ruling. The review and escalate tiers need their own labelled draws for recall. The reference procedure belongs with the Christchurch validation study, whose protocol may adopt or replace the labelling procedure stated here; the development sets remain development sets whatever that study decides.

Each reference label is a `reference-label.v1` record: the subject and edition; the field (existence, worship use, location, denomination, and the lifecycle, identity-link and name fields where the task type has them); the reference value in the project's evidence vocabulary; the locators and quotations that establish it; the assessor, the method and the date; an uncertainty mark (`established`, `probable`, `unresolved`); and the sampling stratum and inclusion probability. Reference labels are row-level evidence and may cite restricted sources. They are therefore stored in the private research tier, and only their manifest (storage location, hash, count, assessor role, date) is committed.

## How human review decides

A tier sets how much human attention a feature receives and nothing else. Every score is written as rows in the project's append-only judgment table (`agent_judgments`): a `status_assessment` judgment for the status component, a `location` judgment, and a `duplicate` judgment where the duplicate signal fires, each with a categorical confidence and a basis note naming the signal values behind it, and each naming its author, model or code revision, and run. A reviewer sees the tier, the signals and any dossier in the place view; no percentage bar is drawn, because a number without its basis invites acceptance by number.

A reviewer disposes of each judgment as agreed, disagreed, corrected or not considered, with a note where the reviewer disagrees or corrects. Acceptance is a separate act: the reviewer's decision binds to the exact evidence reviewed, and the principal investigator accepts for release. A disposition changes no evidence; a correction is a new evidence version with its own basis. A judgment that no person has disposed of remains a recommendation.

## Published names

The project's personal-details policy binds every published surface: a detail that identifies a living person is published only with that person's permission, whether or not the detail is already public, and only a recorded death date establishes that a person has died. The project lead relaxed the policy on 2026-09-24 for cited clergy names. A clergy or office-holder's name that appears in a public source may be published when the publication cites that source and the citation has been verified, meaning that a named process or person opened the source at the cited locator and found the passage that contains the name. A name without a citable public source, a model-inferred name without quoted support, and every telephone number, email address and home address remain withheld. The verification is recorded beside the judgment, and a public product contains such a name only in a row that cites the source.

*Proposed.* The machine rule that applies the relaxation would admit a name automatically, with internal scope and a recorded rule version, when the name is led by a clergy title, lies inside a claim whose verbatim quotation contains it, and that claim cites a locator on the country's source allowlist; public scope would need the verification record above; a curator could overrule the rule's decision.

## Promotion of research assistants to final review

*Final review* means that a research assistant disposes of the model's judgments and corrects the model's draft in the place view before submitting, rather than preparing evidence from scratch; the principal investigator still accepts. Promotion is decided per *stratum*, a task type within a country, by a non-inferiority test on paired closures.

For task $i$ and required output $f$ of the task type, let $y_i^R$ and $y_i^M$ be 1 when the research assistant's value and the model's value equal the reference value, and 0 otherwise. The statistical estimands are the accuracies $p^R = \mathbb{E}[y^R]$ and $p^M = \mathbb{E}[y^M]$ and their difference $\delta = p^M - p^R$, descriptive quantities for tasks generated by the project's task pipeline; the comparison describes two closure procedures on the same tasks and defines no causal estimand. For each required output the null hypothesis is $H_0\colon \delta \le -\Delta$ against $H_1\colon \delta > -\Delta$, with margin $\Delta = 0.05$ and one-sided significance level $\alpha = 0.05$. A stratum is promoted only when $H_0$ is rejected for every one of its $K$ required outputs, when the model's rates of unsupported locators and of over-closure (treating a denominational closure or sale as the end of all worship) are no higher than the research assistant's, and when the retained record contains no personal-detail leak. Denomination accuracy is reported on the eligible pairs and is never a promotion condition. Joint power of 0.8 across the $K$ outputs is secured by per-output power $1 - 0.2/K$. With $\pi_d$ the probability that the two closures differ in correctness on a task, and $z_q$ the $q$-quantile of the standard normal distribution, the number of pairs for one output is approximately $n = (z_{1-\alpha} + z_\beta)^2\, \pi_d / \Delta^2$; at $\pi_d = 0.10$ and $\Delta = 0.05$ that is 248, 343, 396 or 433 pairs for $K = 1$ to $4$, refined by simulation once the discordance rates are measured. The project lead may set $\Delta = 0.10$ for a first promotion, at about a quarter of the pairs.

Promotion comparisons are blind on both sides. The research assistant's closures in the promotion sample come from a reserved *blind comparison sample* in every stratum, served with agent assistance hidden. The comparator is therefore an independent research assistant rather than a research assistant who has seen the model's dossier; the model closes the same tasks from the same brief with nothing from the research assistant's draft; and the reference label is made by an assessor blind to both closures, who sees the two closures only afterwards, unlabelled and in a random order, with prose fields withheld. Submissions made with model assistance shown are analysed separately, as a measure of the value a reviewer adds, and never enter the promotion test. Until a stratum reaches its $n$, its tasks keep the procedure in which the research assistant prepares the evidence.

## Recording and versioning

Every recorded judgment names two versions: the *standard version*, which is the version of this document, and the *rule version*, which identifies the procedure that produced the judgment (for a model judgment, the prompt version and instruction hash; for a deterministic scorer, the code revision and the hash of its signal vectors). The rule version has its fields today: an `agent_judgments` row records `judge.prompt_version`, `judge.code_revision` and `judge.instruction_sha256`, and the row's own `schema_version` names the judgment contract (`agent-judgment.v1`). The standard version has no field: neither `convex/lib/agentJudgments.ts` nor the `agent_judgments` table in `convex/schema.ts` names the standard a judgment was made under. It will be added as `judge.standard_version`, a string of the form `confidence-standard/0.1.0`, in the next judgment contract revision (`agent-judgment.v1.1`, which also adds the `deterministic` judge kind); until that field exists, the judgment's `basis_note` states the standard version. Reference labels, calibration reports and promotion decisions name both versions in the same way.

The version number has three parts. A change that alters the meaning of any judgment made under the standard raises the minor version: a change to the events in the statistical estimand or the 75-metre tolerance, to a component's definition, to a tier condition or cut point, to the calibration target or the validation design, to the promotion rule or its margin, or to the published-name rule. A change that alters the meaning of no judgment, such as a clarification, a corrected reference or an added example, raises the patch version. A change to the events themselves, such as scoring a different tolerance or dropping a component, raises the major version. Each adopted version is snapshotted at `docs/development/confidence-standard-<date>-v<version>.md`, and a later version states its implications for the judgments, tiers, calibrations and promotions made under earlier versions. A judgment is interpreted under the version it names; a recalibration under a new version recomputes tiers from the stored signal vectors and writes new judgment rows rather than editing old ones.

## Not yet ruled

Four items await the project lead. The first is the calibrated cut points and the validation-sample sizes for New Zealand, which return to the project lead with their lower bounds once the sample is labelled. The second is the machine rule for cited clergy names above, marked proposed. The third is the licence status of the project's own verdict, observation and tile tables derived beside OpenStreetMap features, which a commissioned legal assessment will settle before those tables are published; the feature registry and the signal vectors are treated as derivative databases under the Open Database Licence meanwhile. The fourth is the `standard_version` field, listed as follow-up work above.

## Change log

- 0.1.0 (2026-09-24). First adopted version. Defines the registration confidence as the calibrated probability of identity, location within 75 metres and worship use at the edition date, with four recorded components; the deterministic and model signals; the three tiers with provisional cut points 0.9 and 0.6 and a component floor of 0.7; a validation sample per country, distinct from the development sets, with the scorer registered before labelling and sized for 80 per cent power to clear a 0.95 lower bound on screened-tier precision; recording as judgment rows that a person disposes of; the published-name relaxation for cited clergy names; the promotion rule for research assistants (paired non-inferiority per stratum, $\Delta = 0.05$, one-sided $\alpha = 0.05$, joint power 0.8, blind comparison sample); and the versioning rule. Snapshot: this file.
