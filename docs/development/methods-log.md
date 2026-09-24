# Development methods log

This log records how the religionmap.org site and its review backend were developed, for a methods publication. Each entry is dated and written at summary grain; operational detail stays in the project's private handovers. The rules for keeping it are in `AGENTS.md`, section "Development Methods Record". Entries are appended and never rewritten.

## 2026-09-24

**Setting.** The project lead set standing authority for a two-week absence and worked with the agents over a remote terminal session. One orchestrating agent (Claude Opus 5.5) planned the work, delegated each lane to a subagent or to a Codex model, reviewed and merged the results, and deployed backend changes. The project lead ruled on design questions as they arose; the agents did not decide questions of policy, privacy or publication.

**Division of labour.** Implementation lanes ran on Claude Opus 5.5 for authentication, security-sensitive and interface work, on Claude Fable 5.1 for design briefs and public standards, and, from the evening, on GPT-6 Sol through Codex for implementation of an already-specified plan. Reviews ran first on GPT-6 Astra; later the same day the project lead set model tiers, after which GPT-6 Sol reviewed every pull request and a reserved model (GPT-6 Astra, Fable 5.1 or Opus 5.5) additionally reviewed design briefs and security- or privacy-sensitive changes. Greptile commented on pull requests as an advisory reviewer; every comment was verified against the code and answered.

**Review practice.** Every merge followed a review of the final head. Findings were verified against the code before any change; valid findings were repaired on the same branch, with regression tests where the change was code, and the head was reviewed again. Code changes typically needed two to five rounds before a review returned no high- or medium-severity finding; the authentication change needed five, and a privacy change to the agent-research intake needed four, each round closing leak paths the previous round had not exposed. Design briefs needed two to five rounds; for briefs, the orchestrating agent verified narrowly specified final repairs itself rather than commissioning a further full review.

**Verification.** Continuous integration ran on every final head. Changes to the backend were exercised on isolated local backends with synthetic data, never on the live deployment. Each backend deployment was made from the reviewed head before the site's main branch advanced, and the live function list was read back and compared with the reviewed code. One pull request specified by the plan was implemented by GPT-6 Sol in a sandbox that could not run a backend; a separate agent then ran its checks on a local backend, which exposed a phone-number format the shared screen missed, and the orchestrating agent found a country-code mismatch in the database lookups.

**Work completed.** Nine public pull requests merged, six of them with backend deployments (#147, #148, #149, #150, #152 and #154): stronger provenance for agent-assisted research (allowlisted sources, reported model identities, per-model cost); immutable receipts for first-pass research records; budgeted, scheduled freezing of export batches; a whole-record screen that keeps personal details out of what the reviewing model and the backend receive; exclusion of agent-intake drafts from external review; the contract for a read-only inspection collection of retained evidence; the model tiers in the review rule; and the public confidence standard (version 0.1.0) with a summary of how AI assistance is used. The Clerk sign-in change completed five review rounds and awaits the project lead's rulings and a live sign-in test. Design briefs recorded the project lead's rulings on contributor access, confidence scoring, personal-detail holds and orchestration.

**Review counts by pull request.** The counts are findings in the saved GPT-6 Sol and GPT-6 Astra review outputs, summed over rounds; they exclude Greptile's advisory comments and the separate Convex security review of #149 (one medium and twelve low findings). A finding repeated across rounds by both reviewers is counted each time it was reported.

| Pull request | Review rounds | High | Medium | Low |
| --- | ---: | ---: | ---: | ---: |
| #146 review rule and heap default | 2 | 0 | 1 | 1 |
| #147 agent provenance repairs | 3 | 0 | 4 | 0 |
| #148 first-pass receipts | 3 | 0 | 6 | 0 |
| #149 budgeted export freezing | 3 | 0 | 6 | 0 |
| #150 personal-details screen | 4 | 7 | 3 | 1 |
| #151 model tiers in the review rule | 2 | 0 | 1 | 0 |
| #152 inspection collection contract | 2 | 2 | 5 | 2 |
| #153 Clerk sign-in (not yet merged) | 5 | 0 | 17 | 3 |
| #154 external-review exclusion | 1 | 0 | 0 | 0 |
| #155 confidence standard 0.1.0 | 2 | 1 | 16 | 5 |

**Rulings that shaped the work.** The project lead relaxed the personal-details rule to permit clergy names drawn from a cited public source; ruled that personal details in agent output should be flagged and held for human review rather than refused once the holding design is built, with refusal as the interim behaviour; made hold decisions deletable, keeping only a compressed record of decision-making; required contributor photographs to be licensed at upload rather than assigned; required the confidence standards to be public and versioned; and set the model tiers above.

**Deviations.** Three merges departed from the review rule. Early in the day a design brief was merged on the project lead's instruction before its review; the review that followed produced a revision. Later, a one-sentence ruling record in the private repository was merged before its review; a later review confirmed it. Last, the confidence-standard pull request (#155) was merged while three advisory comments posted on its later commits were unanswered, and its closure comment wrongly stated that all advisory threads had been answered; one comment was already resolved in the merged head, and the other two, both valid, were repaired in a follow-up pull request (#157, confidence standard 0.2.0). The closure comment was corrected on the pull request.
