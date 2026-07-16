# Design review: the Data Maps pill and the continuous data roam (2026-07-16)

Four independent reviewers examined the uncommitted `feat/datamaps-pill` prototype and the continuous-data-roam proposal: three Claude Fable agents with distinct charters — interaction and information architecture (A), architecture and feasibility (B), adversarial user journeys (C) — and one OpenAI Codex `gpt-5.6-sol` instance at high reasoning effort (D), given the raw materials without our prior analysis. This memo synthesises their reports into decisions.

## The prototype under review

A third pill joins Search and Near Me in the bottom-centre action row on the global map and all 100 country pages. The pill is an anchor to the data-maps hub, so visits without JavaScript still navigate; with JavaScript it opens the searchable country-switcher panel, which previously had one trigger (the top-right wordmark link, which the prototype keeps). The switcher was refactored to let two triggers share one panel.

## Recommended decisions

1. **Adopt the pill, revised.** All four reviewers endorse a bottom-bar entry to the country maps; none endorses shipping it as prototyped. The revisions are listed below.
2. **Ship roam v1: the state-carrying handoff.** The existing border-handoff offer carries the selected metric, source, and wave to the neighbour via the URL hash, with a nearest-wave rule and fall-through to the neighbour's defaults. B rates this cheap — the hash-parameter machinery exists (`region-map.js` `readHashParam`/`writeHashParam`) — and it delivers most of the roam's felt continuity.
3. **Park roam v2: the in-page neighbour swap.** B and D disagree here, and the disagreement is signal. B would run v2 as a constrained experiment on one high-alignment pair (at→de) after a refactor of the region-config assumption. D would reject any live swap — data under a wrong URL, wrong search bias, wrong page copy — and instead build a separate harmonised comparison product with shared semantics and colour domains. Decide after v1 ships and its usage is observed.
4. **Drop roam v3: free-roam.** Unanimous. The payload tail is brutal (US summary ~21 MB, Brazil ~19 MB; a 13-country European roam ~21 MB against a 1 MiB prefetch budget), and per-country percentile colour domains make identical colours mean different quantities across a border. On a research site the border must not lie.

## Why the roam fails as proposed

Country identity is architectural, not a parameter. `REGION_CONFIG` is read at ~70 sites and frozen into module-level constants; the census choropleth is only one of five country-scoped data systems (place dots, overview dots, polygon and building tiles, dated places, Pulotu). A census-only swap leaves the site's namesake layer frozen to the home country (B). The data is schema-homogeneous but semantically heterogeneous: denominators differ (NZ stated-response vs AT total-population), some countries map different constructs entirely (Bhutan building-register counts, Norway membership counts without denominators, Saint Vincent Christian-only percentages), and waves and geography levels never align (B, D). `religious_affiliation_percent` is the only roamable construct, and even it changes denominator at some borders.

## Revisions to the pill before merge

- **Blocker (C): phone-width overflow and refresh-button collision.** The three-pill row overlaps the bottom-left refresh button at 375–390 px and spans edge to edge at 320 px; with active filters the excluded `#filters-clear` pill makes a ~415 px row that clips off-viewport. Add `#filters-clear` to the ≤640 px shrink rule, tighten the row, and verify at 320/375/390 in a real browser.
- **Rename the pill (A, D).** "Data Maps" beside "Show Census Data" reads as this map's data toggle. Both reviewers converge on an action name such as "Switch Country"; renaming trades away some of the data-forward labelling the pill was meant to carry, so the choice of name is recorded as an open decision below.
- **One trigger, not two (A, D).** Demote the wordmark entry to a plain hub link; the pill owns the panel. Unify casing wherever both remain.
- **Record or revert the corner-grammar breach (A).** Bottom-centre is documented as the action row; cross-map navigation is a different kind of control. If the pill stays, amend the grammar comment in `map-shell.css` and the sidebar design record deliberately.
- **Cap the panel height from a bottom anchor (A):** `min(space above, 60vh)`, clear of the top chrome band.
- **Double-tap guard (C):** the stall escape navigates to the hub on any second click while the catalogue loads; take that escape only after ~1 s.
- **Android keyboard fix (C):** the soft keyboard fires a window resize that closes the panel mid-typing; re-place instead of close while the filter has focus.
- **Accessibility tidy (C, D):** add `aria-controls`; give the dialog a close button and a loading state; preserve modifier-key semantics on Enter in the filter; note the dialog/combobox/option pattern mix (D) against WAI-ARIA practice.

## Clean bills

Progressive enhancement and every fallback path (catalogue-shape error → hub parse → plain navigation), modified-click behaviour, two-trigger re-anchor bookkeeping, Escape focus return, prefetch budget guards, onboarding stacking, and the panel's internal keyboard pattern all passed adversarial walking (C).

## Decisions (JB, 2026-07-16)

1. The pill is named **Switch Country** (Countries on phones), the reviewers' action-first preference.
2. The wordmark keeps a **plain hub link**; the pill owns the panel.
3. **Roam v1 shipped** with the pill revisions: the handoff carries `d=metric:year` in the fragment, the arrival clamps to its nearest wave and falls back to its own default metric, geography level never carries.
4. The v2 path stays open — constrained at→de experiment (B) vs a separate harmonised comparison product (D) — to be decided after v1 usage is observed.

Every should-fix and blocker above shipped with the revisions; the deliberate exceptions are the buried-handoff keyboard case (finding 5 of the journeys review; pointer panning closes the panel, the keyboard path is niche) and the panel close button (Escape, outside-tap, and the trigger toggle already close it; recorded here rather than added).
