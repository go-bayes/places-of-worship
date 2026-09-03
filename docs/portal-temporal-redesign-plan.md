# Portal Temporal And Sidebar Redesign Plan

> **Superseded by the occupancy plan (JB, 2026-09-04).** This plan is kept as the historical record of the 28 August design and JB's 31 August rulings. Its temporal lane was reshaped by `docs/portal-location-and-occupancy-plan.md` (ruled 2026-09-02), whose section 8 reconciles it item by item: `site_lifespans` became `site_occupancies` with an embedded location; the nine-rule derivation and `derived_target_year_states` came through unchanged; the time slider reads the occupancy in force at the chosen date. PRs D, E, and F of that lane are merged. The sidebar order in section 1 was overtaken by the activity chooser, the entry-focus fix of 2026-09-03, and ruling R-W3 of 2026-09-04 (`docs/development/ra-portal-walkthrough-2026-09-04-phone.md`). Nothing here governs current work; landed from PR #43, closed without code.

Status: SUPERSEDED (2026-09-04); previously RULED (JB, 2026-08-31) — all twelve section-6 decisions ruled;
section 7 records the rulings, three amendments, and two follow-up items.
Produced 2026-08-28 from two independent model designs (Fable 5 with full
session context; Opus 5 independently on the temporal model), reconciled by
the session conductor. No code in this plan has been implemented.

Portal hub: `docs/portal-data-entry-plan.md`. Related contracts:
`docs/convex-task-layer-spec.md`, `docs/field-observation-packet-spec.md`.

## 1. Sidebar Restructure (assignment mode)

Ruled order, top to bottom:

1. Header (title, snapshot, nav) — unchanged.
2. **Sign-in** (`#backendPanel`) — stays at top.
3. **Add a place** — the primary action moves from above the sign-in card to
   directly below it. Label proposal: **"＋ Add a missing place"** with a
   one-line helper — "Your nomination goes to human review — it does not
   change the public map." — carrying the nomination semantics the style
   guide protects. `verification-map.js` currently renames the button when
   rapid entry is active; that rename is removed so one label serves all
   countries. Requires a same-PR update to `docs/ui-style-guide.md` and
   `LEXICON.md` (decision D1).
4. **Check existing data** — new secondary block: one sentence ("Browse
   everything already recorded — all mapped places, nominations under
   review, and their known dates."), a secondary button, and (later) the
   time slider. Ships in two slices:
   - Slice A (with the reorder): the button opens `?full=1` full-map mode in
     the same tab. Zero-risk interim; the Google session survives reload.
   - Slice C (target): an in-page `viewMode: "assignment" | "browse"` toggle
     with no reload — browse fetches the country's full static dataset,
     shows it with nominations and assignment tasks, keeps signed-in state,
     and hosts the time slider. The ~15 `ASSIGNMENT_MODE`/`FULL_MAP_MODE`
     reads that gate data (not page chrome) route through `viewMode`.
5. **Assigned web workpack** — the filters, stats, and task list, retitled
   with a visible section heading so the list reads as the assignment sheet.
6. Session and detail panels — unchanged.

Click-feedback fix for the pin flow (currently a scroll-away instruction
that reads as a dead button): the button itself swaps in place to
"Placing pin — click the building on the map · Esc cancels" on the amber
in-progress pair; the map gets a crosshair cursor and an action-colour
inset glow; phone widths get a dismissible toast over the map. No sidebar
scroll on entry.

## 2. Temporal Contract

### 2.1 Governing architectural finding

The obvious implementation — writing derived census-year states into
`evidence_drafts.target_year_statuses` — would violate the no-inferred-dates
rule through three existing code paths: `review-portal.js` hardcodes
`basis: "source_observation"` on every target-year decision;
`convex/lib/exportEligibility.ts` makes a draft export-eligible the moment
any target year stops being `not_assessed`; and `convex/lib/limits.ts`
rejects rapid drafts that assess historical years. **Derived states
therefore never touch `target_year_statuses`.** They live in their own
table and reach the observed vocabulary only through explicit reviewer
confirmation that stamps a non-observational basis.

### 2.2 `site_lifespan_v1`

A site's worship function is a set of segments (closure and reopening are
two segments), one row per segment in a new `site_lifespans` table attached
to a guided evidence draft (never a rapid draft — reuse the
`assertNotRapidContract` pattern). Each segment carries:

- start: `start_mode` (`known | between | by | unknown`), partial date or
  not-earlier/not-later bounds, precision, and **`start_basis`**
  (`founding_stated | organisation_founded | building_dedication |
  first_seen_only | unknown`);
- end: `end_mode` (`still_active | known | between | after | unknown`),
  bounds, precision, **`end_basis`** (`closure_stated | last_seen_only |
  unknown`), `end_reason` (`closed | relocated | demolished | use_changed |
  unknown`, with `successor_site_id` mandatory for relocations), and
  `still_active_asof` mandatory when still active;
- provenance mirroring `historical_claim_v1`: confidence with basis, source
  basis/title/reference/account, uncertainty note, privacy flag,
  claim status (`submitted | superseded | withdrawn`).

Partial-date validation reuses `isValidPartialDate` and the
`partialDateLower/Upper` expanders (1600 floor) already shared by the
historical-claim contract.

**The basis asymmetry is the heart of the model.** Only `founding_stated`
licenses an `absent` inference before the start window, and only
`closure_stated` licenses `absent` after the end window. `first_seen_only`
and `last_seen_only` — the archive merely starts or stops — can never
manufacture an absence. `building_dedication` and `organisation_founded`
date a different object and license nothing about worship use. (The Port
Vila 2010 survey's `first_date` demonstrably mixes all three meanings, so
this typing is mandatory, not optional.)

### 2.3 RA entry surface

The RA sees one simple block — "When was this place used for worship?" —
with two rows (Began / Ended), each a mode selector plus partial-date
fields, a "Still in use at my observation date" checkbox, one confidence,
one source basis, and an unresolved-wording escape required when both
bounds are blank. An `around Y` qualifier compiles to bounds `[Y−1, Y+1]`
**displayed before save** ("around 1954 will be recorded as 1953–1955 —
edit if wrong"). "Add another period" creates a further segment. The range
is an input affordance that expands deterministically into the typed
fields; nothing is collapsed in storage (decision D4 ratifies this against
the template README's "do not collapse" rule).

Rapid-path integration is one-way pre-fill: a `currently_used_for_worship`
observation offers `still_active_asof = observation date` when the RA opens
the range panel afterwards; it writes nothing by itself, and census years
stay unassessed without a range.

### 2.4 Derivation

Server-side, reproducible, and stored in a new `derived_target_year_states`
table: task, lifespan id, target year, derived status
(`present | absent | uncertain` — `not_assessed` is expressed by writing no
row, since a rule firing is a judgement), the `rule_id` that fired, a
`derivation_version`, an `inputs_hash` over the consumed lifespan fields
(any lifespan edit reverts non-matching rows to `derived_unconfirmed`), and
a review state (`derived_unconfirmed | reviewer_confirmed |
reviewer_overridden | reviewer_rejected`).

Rule table (first match wins; census year compared per decision D2;
partial-date bounds resolve conservatively — a definite status derives only
when the whole window sits on one side):

| # | rule_id | Condition | Derived |
|---|---------|-----------|---------|
| 1 | inside_interval | year ≥ start upper bound and ≤ end lower bound | present |
| 2 | before_stated_founding | year certainly before start window and `founding_stated` | absent |
| 3 | before_first_record | year certainly before start window, basis weaker | uncertain |
| 4 | after_stated_closure | year certainly after end window and `closure_stated` | absent |
| 5 | after_last_record | year certainly after end window, basis weaker | uncertain |
| 6 | within_start_window | year inside the start uncertainty window | uncertain |
| 7 | within_end_window | year inside the end uncertainty window | uncertain |
| 8 | beyond_active_anchor | still_active and year after `still_active_asof` | uncertain |
| 9 | start_unknown | no start bound and year ≤ end lower bound | uncertain |

Multi-segment combination: any present → present; else any uncertain →
uncertain; else all absent → absent; no segments → no row. Rule 8 is the
one that bites: a 2010 survey saying "founded 1980, still going" derives
present for 1989/1999/2009 and **uncertain for 2020** — an observation
cannot speak past its own date.

### 2.5 Review and export

The reviewer sees the interval drawn as a bar with census years marked,
each derived status beneath with its rule in plain words, and per-year
Confirm / Override (status + mandatory note) / Reject. "Confirm all" is
offered only when every year derived by rules 1, 2, or 4 — never for an
uncertain. On confirm — and only then — the value enters
`target_year_statuses` and `target_year_affects` under a new controlled
basis vocabulary: `source_observation | reviewer_confirmed_derivation |
reviewer_override` (replacing the hardcoded string; the field is already an
optional string, so this is a vocabulary tightening, not a migration).

Exports: the wide CSV gains `target_year_<Y>_basis` columns; the bundle
gains `derived_target_year_states.jsonl` (full audit trail);
`derived_unconfirmed` values never enter the wide CSV. Where a derived
value conflicts with an existing observed one, the observation wins and an
automated check (`lifespan_conflicts_observation`) raises `needs_review` —
the engine never auto-resolves.

**Blocking prerequisite:** `convex/exports.ts` takes the wide-CSV header
from the first eligible draft's field list, so drafts disagreeing on
columns silently lose data. `WIDE_EVIDENCE_FIELDS` must become a shared,
server-validated constant before any temporal column lands. Pre-existing
bug; becomes a data-loss bug otherwise.

Export eligibility needs no change: because derived states live outside
`target_year_statuses`, a lifespan alone cannot promote a draft — the main
practical argument for the separation.

## 3. Time Slider

Two stacks: the public map (`region-map.js`, MapLibre) **already has** a
census slider, a dated-places temporal filter, and a prospective-sites ring
layer; `apps/regions/vu/data/dated_places.geojson` is an empty stub waiting
for accepted VU lifespans. The portal map (`verification-map.js`) is
Leaflet with ~3,600 canvas features and has none of this.

Spec (either stack):

- Domain 1600 → present; detent ticks at the census years and VU historical
  anchors, snap-to-tick, free drag between; default landing on the most
  recent census year. The slider is a review and visualisation tool — it
  never writes.
- Two visual channels: colour = state (existing tokens: present green only
  for reviewed state, uncertain amber, not-assessed pale blue); stroke =
  provenance (solid observed, dashed derived-unconfirmed, inner-dot
  confirmed).
- Pin at date T: certainly active → filled; not yet founded → hidden with a
  "show later foundations" toggle (hollow ring); ceased with stated closure
  → hidden with a "show closed" toggle (grey ghost); uncertainty window
  overlapping T → amber hollow dashed; unknown at T → pale blue or
  excluded, **never grey/absent** (standing ruling: no evidence must not
  display as absence).
- Staleness: a still-active segment renders uncertain for T beyond
  `still_active_asof` plus the horizon (decision D8), so a 2010 survey
  cannot colour 2026 green.
- Performance: public map — integer year-bound properties baked at build,
  GPU-side `setFilter`. Portal — precompute an `Int16Array` of the four
  year bounds, evaluate over the typed array, debounce redraw to animation
  frames; bucket into per-decade layer groups if needed.

## 4. Bob Woodbury Bulk Historical Lane

- Invite as `ra` + `reviewer` (pending invite, activates on first sign-in —
  the Guy precedent). Author-cannot-accept-own separation already holds.
- CSV: extend the existing 18-column curator import header with the typed
  segment fields (mode/date/bounds/precision/basis per endpoint,
  end_reason, successor locator, still_active_asof, confidence, source
  account); consecutive rows share a source locator with distinct
  `segment_index`. Legacy `first_date`/`last_date` import as
  `first_seen_only`/`last_seen_only` — the honest reading, which refuses to
  derive absence. Migrating the Port Vila survey then means adding a basis
  column, not re-transcribing.
- Ingest via an internal `adminUpsertLifespansFromImport` mutation run
  under the deployment admin key with a named service actor (unreachable
  from clients; re-import preserves task status and assignment). Batch
  `vu-woodbury-historical-sites-001`. `IMPORT_MAX_ROWS = 200` needs a
  ruling for his dataset size (D7).
- Each row produces, in one transaction: a task, a **draft** evidence draft
  (submission stays a human act), lifespan segment rows, and
  `derived_unconfirmed` derived rows. The reviewer confirms per year on the
  drawn interval — nobody retypes a date. VU rows still answer the kastom
  prompt or park as sensitive; the lane does not bypass sensitivity.

## 5. Build Order

1. **PR-A** — sidebar reorder, label unification (+ style-guide/LEXICON
   update), click-feedback fix, "Check existing data → ?full=1" interim.
   Pure frontend, small.
2. **PR-B0** — `WIDE_EVIDENCE_FIELDS` shared server-validated constant
   (blocking export-header bug).
3. **PR-B** — `site_lifespan_v1` + derivation engine +
   `derived_target_year_states` + reviewer confirm/override + basis
   vocabulary + export columns and JSONL. The scientific core; lands before
   Bob arrives.
4. **PR-C** — in-page browse mode; slider per decision D9 (C.1
   filter-only, C.2 polish).
5. **PR-D** — import extension, seed Bob's batch, onboarding doc + invite.

## 6. Decisions Needing JB's Ruling

Scientific:

- **D2 Census comparison convention.** Compare intervals against the whole
  census year `[Y-01-01, Y-12-31]` (conservative; recommended) or the
  actual census day per batch metadata? Affects edge cases only.
- **D3 Founding licence.** Does `founding_stated` license `absent` for
  earlier census years? Recommended yes — the design's largest inferential
  commitment.
- **D4 Ratify range-as-affordance** against the template README's "do not
  collapse lifecycle evidence" rule (storage stays typed and uncollapsed).
- **D5 Wide-CSV entry.** May reviewer-confirmed derived states enter
  `site_evidence_wide.csv` with mandatory basis columns (recommended), or
  do they stay JSONL-only?
- **D6 Vocabulary.** Is `absent` acceptable for a not-yet-founded year
  (LEXICON-literal but possibly misread as "closed"), with the distinction
  carried in derivation metadata and rendering? Recommended yes.
- **D10 Relocation accounting.** Closure-plus-founding, or neither, in
  census change statistics? Recommended: neither — relocation is its own
  linked event class; at most one member of the pair carries
  `genuine_change`.

Product:

- **D1 Button wording** "＋ Add a missing place" + helper line, LEXICON
  updated. Recommended yes.
- **D7 Import cap** for Bob's dataset: raise `IMPORT_MAX_ROWS`, chunk, or
  admin path exemption. Recommended: chunked admin path, cap unchanged for
  clients.
- **D8 Staleness horizon** for VU still-active rendering (public map uses
  15 years). Recommended 15.
- **D9 Slider v1 surface.** Public map first (machinery exists; portal
  browse links out) with the portal Leaflet slider in a later slice
  (recommended), or portal-first as the review tool?
- **D11 Browse-mode scope.** Static verification dataset + nominations
  (recommended), or also the public master layer?
- **D12 Bob's roles** `ra` + `reviewer` from day one. Recommended yes.

## 7. JB Rulings — 2026-08-31

Recorded from JB's review of this document (terminal read of the branch
file; the visual design was not viewable in that session — see follow-up
F2).

### Section rulings

- **Section 2.1 — ruled with an amendment.** Inferred (derived) dates are
  permitted as first-class working values; the standing no-inferred-dates
  rule is relaxed to: *derived dates are permitted, provided each derived
  value receives quick reviewer confirmation in the review portal before it
  enters the observed vocabulary.* The architecture stands unchanged —
  derived states live in `derived_target_year_states` and reach
  `target_year_statuses` only on confirmation — but the confirmation UX
  must be fast (the drawn-interval, per-year confirm bar of §2.5, with
  "Confirm all" where rules 1/2/4 fired). Confirmation is a lightweight
  gate, not a re-adjudication.
- **Section 2.2 — ruled.** The basis asymmetry is affirmed; the
  distinctions (`founding_stated` vs `first_seen_only`;
  `closure_stated` vs `last_seen_only`; `building_dedication` /
  `organisation_founded` dating a different object) **must be enforced**,
  not merely recorded.
- **Sections 2.3, 2.4, 2.5 — ruled as designed.**
- **Section 3 — ruled with an amendment.** Integrate the public map's
  existing slider machinery (this also settles D9: public map first). On
  the domain: the 1600 floor is queried. It is only a typo-guard constant
  in `convex/lib/historicalClaims.ts` (line 120), not a scientific
  commitment. JB's direction: deep history must remain reachable —
  eventually back to the early Holocene for archaeological layers — so the
  slider domain must not hard-bake 1600. Design toward a country-specific
  (or collection-declared) domain and/or a relative slider; see follow-up
  F1 for the validation-floor change this implies.
- **Section 4 — ruled with an amendment.** Author-cannot-accept-own is
  affirmed. The governing requirement, on the model of GitHub pull-request
  review: **review provenance must be an ongoing, inspectable record** —
  who confirmed, overrode, or rejected each derived value, when, and with
  what note, as an append-only history rather than a mutable state field.
  `derived_target_year_states.review state` therefore needs a companion
  event log (or equivalent immutable trail) in PR-B. On the import cap:
  see D7. Batch entry must be easy for RAs, not only for the admin lane.
- **Section 5 — ruled.** Build order PR-A → PR-B0 → PR-B → PR-C → PR-D
  approved.

### Decision rulings (all twelve)

Scientific: **D2** whole-census-year convention, as recommended. **D3**
`founding_stated` licenses `absent` for earlier census years, as
recommended. **D4** range-as-affordance ratified against the template
README's do-not-collapse rule (storage stays typed and uncollapsed).
**D5** reviewer-confirmed derived states enter the wide CSV with mandatory
basis columns, as recommended. **D6** `absent` is acceptable for a
not-yet-founded year, with the distinction carried in derivation metadata
and rendering. **D10** relocation enters census change statistics as
neither closure nor founding; relocation is its own linked event class.

Product: **D1** "＋ Add a missing place" wording and helper line, as
recommended. **D7** chunked admin-path ingest accepted, and JB
additionally permits raising `IMPORT_MAX_ROWS` for batching; the specific
ruling governs — make batch entry easy, for RAs as well as the admin lane.
**D8** 15-year staleness horizon. **D9** public map first (see section 3
ruling). **D11** browse mode scopes to the static verification dataset
plus nominations. **D12** yes — already effected on dev (Bob invited
`ra` + `reviewer`, pending).

### Follow-ups opened by these rulings

- **F1 — date-validation floor.** The 1600 floor in
  `convex/lib/historicalClaims.ts` conflicts with the deep-history
  direction. Replace the constant with a per-country or per-collection
  declared floor (defaulting to the current 1600 where nothing is
  declared) when the slider-domain work lands; a bare widening without a
  declared floor would readmit the typo class the guard exists to catch.
- **F2 — design review method robust to remote terminals.** JB could not
  view the visual design over ssh. Standing method (amended 2026-08-31 to
  avoid bloating the repository): every design doc carries the canonical
  markdown spec in the repo, readable in any terminal, and a static render
  (PNG, HTML, or PDF) saved to the git-ignored `local/review/` folder —
  the established home for review screenshots — named and referenced from
  the design doc so the reviewed version is identifiable. Renders are
  never committed. A render that must survive the machine or cross
  machines is banked to the project GCS bucket via the pow-research
  push/pull scripts, on the same rule as other large files. Artifact links
  remain useful from any browser (they are not tied to a machine) but must
  never be the only form of a design put to JB for ruling.
