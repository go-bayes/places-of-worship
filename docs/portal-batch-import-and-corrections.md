# Batch Import, Correctable Points, And Visual Alignment

Status: RATIFIED 2026-07-07 — JB commissioned; revised and approved by
independent Fable line review (two passes); build authorised. Extends
`docs/portal-free-contribution-design.md` (ratified 2026-07-07); no
ratified decision is renegotiated here.

Three questions from JB, answered as three designs. First, whether
nominating places of worship should support batch import with
validation, or stay one-by-one. Second, whether every point on the map
should be correctable. Third, whether the workbench should look more
like the main maps.

## 1. Batch Import (Curator Lane)

### Boundary

The one-by-one nominate flow stays the RA-facing path: it teaches and
enforces the evidence contract per record — source-first entry, dedup
assistance, the kastom prompt before location detail. Batch import is a
curator/JB action for machine-shaped corpora: a historical directory, a
denominational yearbook index, a missions list, an export from another
project. It reuses the lane machinery the ratified design already owns —
`task_batches` with `source_kind: "spreadsheet_submission"`, the
provisional queue, the ratified bulk-lane controls — and invents no
parallel lane. A batch import is many source-first claims from one
source record.

One correction to an earlier framing: Guy's Vanuatu spreadsheets
(`docs/playbooks/guy-vu-spreadsheets.md`) are census data tables for the
map pipeline, not site lists; they are not this feature's corpus. The
pilot corpus should be a small allowlisted site directory chosen by JB
(the Heritage NZ List extract from
`docs/development/ra-ai-interaction-options.md` is one candidate; a
missions station list is another).

### The import contract

One file, one source record. The spreadsheet or directory is itself the
source consulted: the importer records it once (source type, title, URL
or archive reference, licence, consulted date), and every row carries a
`source_locator` pointing into it. Locators must be stable entry
identifiers where the corpus has them (an entry id, a page-plus-entry
reference); bare row numbers are accepted but fragile, so the importer
also computes a content hash per row (`claim_hash` over the normalised
row values), and the ratified pairing of `source_claim_key` with
`claim_hash` is the idempotency test — a row is a duplicate only when
locator or hash says so. The repair rule for curators: fix rejected
rows in place and re-upload the whole file; never delete or reorder
rows between uploads.

Rows citing their own sources compose with this rather than replacing
it. A corpus that links out per entry (or an export from another
project whose rows carry heterogeneous original citations) is still
imported under the file-level source record — that is the source the
curator actually consulted — and an optional `source_url` column adds a
second, row-level source reference on the claim recording the
directory's own citation for that entry.

File-level fields, supplied once at upload: `source_type` (from the
existing source-type vocabulary), source title, URL or archive
reference, licence, and consulted date — together the file's source
record.

Row columns (header names exact; unknown columns preserved as notes):

| Column | Rule |
| --- | --- |
| `name` | Required. Name as the source gives it. |
| `country_code` | Required, ISO-2, one country per file. |
| `religion` | Optional free text. |
| `denomination_code` | Optional; requires `taxonomy_version` when present. |
| `taxonomy_version` | Required iff `denomination_code` present. |
| `lat`, `lng` | Optional pair; both or neither; requires `geocoding_basis`. |
| `locality` | Optional described place. |
| `containing_area` | Required when no coordinates (regional-only rule). |
| `geocoding_basis` | Required with coordinates; from the existing vocabulary. |
| `location_confidence` | Optional (`high`/`medium`/`low`); defaults to `medium` with coordinates, `low` without. |
| `source_locator` | Required. Stable entry reference into the file's source record. |
| `source_url` | Optional per-row URL; becomes a second source reference on the claim (the directory's own citation), inheriting the file's `source_type` and taking the derived title "{file source title}, entry {source_locator}" so it passes the submit path's real-title rule. |
| `first_date`, `last_date` | Optional partial ISO dates (YYYY, YYYY-MM, YYYY-MM-DD); imported as `first_seen` / `last_seen` lifecycle claims. |
| `date_confidence` | Optional (`high`/`medium`/`low`); applies to both lifecycle claims; defaults to `medium`. |
| `culturally_sensitive` | Required for VU rows (`yes`/`no`); optional elsewhere. |
| `notes` | Optional free text. |

### Occupancy columns (PR-D, ruled 2026-09-02)

Section 4 of `docs/portal-location-and-occupancy-plan.md` extends the row
with one period per row: rows of one place share `source_locator` (and
`name`) and are numbered by `segment_index` from 0. The columns are the
`occupancy_v1` contract in CSV form; `convex/lib/occupancyImport.ts` is the
single reading of them, and the whole set is validated by
`assertOccupancySet` exactly as an RA submission is.

| Column | Rule |
| --- | --- |
| `segment_index` | 0-based, contiguous within a place. |
| `start_mode`, `start_date`, `start_not_earlier_than`, `start_not_later_than`, `start_basis` | As the occupancy contract: known needs the date; between needs both bounds; by needs the latest date; unknown carries basis `unknown`. |
| `end_mode`, `end_date`, `end_not_earlier_than`, `end_not_later_than`, `end_basis`, `end_reason`, `still_active_asof` | As the occupancy contract; a dated end needs its reason; `after` with `last_seen_only` says "in use at the last observation, nothing after". |
| `latitude`, `longitude` | The period's own point; when it differs from the row's `lat`/`lng` the period is `distinct`, when absent or equal it describes the task point. |
| `location_mode`, `uncertainty_radius_m`, `location_basis`, `location_wording` | The embedded `location_assertion_v1`; an approximate area needs a whole-metre radius (25 m–100 km) and its wording. The assertion's confidence is derived from mode and radius. |
| `occupancy_confidence`, `occupancy_confidence_basis`, `occupancy_source_basis`, `occupancy_source_reference`, `occupancy_source_account`, `occupancy_uncertainty_note` | Provenance per period; defaults: `moderate`, an import basis sentence, `named_public_source`, the row's locator, a generated account. |

Legacy `first_date` and `last_date` still import as first-seen and
last-seen lifecycle claims and never derive an absence. Rows with these
columns enter through `batchImport:adminImportOccupancyBatch` (admin key,
named service actor), which lands each place submitted for review with its
periods and derived census-year proposals; the workbench curator screen has
not adopted the columns yet and imports drafts without periods.

### Validation is three-layered and repairable

File level: parseable CSV, required headers present, one country, row
cap (`maxClaimsPerRun` from the ratified controls; an oversize file is
rejected with instructions to split it, never silently truncated). Row
level: every rule the submit path enforces (date formats, taxonomy
version with denomination codes, coordinate pairing, geocoding basis
with coordinates, regional-only containing area), with the same
wording, plus two rules import adds beyond `Submit for review`: `name`
is required (the submit path leaves the site name optional, but a batch
row without a name is unreviewable at scale), and a coordinate-less row
must carry `containing_area` even when it has a `locality` (the submit
path accepts a described locality alone; import demands the coarser
anchor too, because nobody walks 200 rows back for it later).
Coordinate-less rows with a locality import with
`geocoding_basis: "described_locality"`; with only a containing area,
`"regional_only"`. Batch level: dedup screening within the file and
against existing sites, open tasks, and pending candidates — recorded
as dedup candidates on each claim, never blocking creation, per the
ratified "dedup is assistance" rule.

The import report is per row, and a failing row never blocks the rest
of the file. Each row lands as `imported`, `rejected` (with the
specific rule it broke), or `parked_sensitive` (VU rows lacking the
sensitivity answer are parked for individual handling, never imported
silently). The curator fixes the rejected rows in place and re-uploads;
the locator-plus-hash idempotency test skips already-imported rows and
reports them as skipped, so a corrected file never duplicates the
queue.

### What imported rows become

Each imported row becomes a source-first claim in the provisional queue: a task (type `missing_from_project_map`, batch-linked) plus an evidence draft in state `draft` owned by the importing curator, carrying the shared source record, its row locator, and lane/origin marking the batch import. Imported drafts are NOT auto-submitted: the curator reviews the import report, then submits rows for review in bulk or individually — submission stays a deliberate human act, and everything downstream is unchanged: the same reviewer queue, the same `human_confirmed`/review gates, and the AI batch-review lane triaging the result (a 200-row import is exactly the queue shape the batch reviewer exists for). Batch acceptance keeps its ratified shape: sampled review with row-level exceptions; nothing here weakens it.

### Sequencing

Build now in demo mode: a curator import screen in the workbench behind
the provider surface (`DemoProvider` implements it in localStorage), so
the contract, validation wording, and report are testable in the
browser today. The Convex mutation mirrors it inert (same rules, role
gate `curator`/`admin`, field limits from `convex/lib/limits.ts`) and
waits for the binding; bulk ingestion at scale additionally waits on the
ratified bulk-control preconditions, which this feature reuses rather
than re-implements.

## 2. Every Point Correctable

### Principle

A correction is evidence. It enters the same provisional queue as
every nomination, faces the same review, and changes the master and
public map only through `pow` validation and replay; no correction
edits a site in place. This carries the ratified design's second entry
point (`docs/playbooks/fix-map-two-options.md`) to its natural end:
beyond "open the workbench from the map" to "open the workbench about
this dot".

Corrections from the map are also the highest-value contribution path:
identity is already resolved (the claim binds to a known `site_id` via
`matched_current_site_id`), so the dedup ambiguity that makes free
nominations reviewer-expensive does not arise, and the change-event
schema already carries the full correction vocabulary
(`site_location_corrected`, `site_status_corrected`,
`site_name_corrected`, …). A later refinement may add an optional
correction-type hint to the route so reviewers see what kind of fix the
contributor intended; the parameters below suffice for opening the
flow.

### The route contract (workbench side — build now)

The workbench accepts URL parameters and opens a prefilled flow:

| Parameter | Meaning |
| --- | --- |
| `country` | ISO-2; selects the country config (and its sensitivity prompt). |
| `site` | Existing project `site_id`; presence switches to correction mode. |
| `name` | Site name hint for the header and dedup context. |
| `lat`, `lng`, `zoom` | Map context; prefills location evidence for a new nomination, display-only context for a correction. |

With `site` present, the flow creates a task bound to that site
(`taskKind: "verify_site"`, `siteId` set) and opens the evidence editor
labelled as a correction to the named site; without it, the flow is the
existing place-first nomination prefilled with the map context. Invalid
or unknown parameters degrade to the plain workbench, never to an
error page.

### Guardrails

The map side stays dormant and JB-gated exactly as the playbook states:
flipping `workbenchHref`/`RC.raPortalHref` on public maps waits on the
publication and authentication decisions. The kastom rule extends to
the route, with the enforcement placed where the knowledge lives. The
workbench cannot know a site is display-restricted (in demo mode it has
no master-site store), so the restricted-coordinate rule binds the map
link generator: when it builds the workbench URL for a
restricted-display site, it must omit `lat`/`lng` and pass locality
context only. The workbench adds two defensive rules of its own:
correction mode never copies URL coordinates into evidence fields (they
are display context; location evidence must come from the contributor's
source), and for VU the sensitivity prompt still comes before location
detail regardless of what the URL carries. Corrections are visible in
the reviewer queue with the existing identity vocabulary; no new review
states are needed.

## 3. Visual Alignment With The Main Maps

The token layer is already aligned, which changes what this item is.
The workbench's `theme.css` declares the map shell's identity tokens
and type stack (`apps/shared/map-shell.css`) and the style guide's
colour meanings as CSS custom properties, with the guide named as the
source of truth. What differs is the chrome idiom: the maps are dark
full-bleed canvases with floating `shell-pill` controls; the workbench
is a light, dense working surface under a slate masthead — a deliberate
choice recorded in `theme.css`, and the right one for long-form data
entry.

Recommendation: keep the light working surface, and close the seam with
three targeted touches when the map→workbench route lands (that is the
moment users first cross it): the workbench masthead adopts the
wordmark-pill presentation of the maps' identity corner; interactive
states (hover, focus ring, active pill) adopt the shell's exact
treatments rather than near-matches; and any workbench element that
floats over content (dialogs, the future map picker) wears
`shell-pill`. Full component parity remains a non-goal. No build in
this arc beyond what the correction entry point needs; this section
exists so the intent is ratified before anyone spends a sitting on it.

## Decisions For Review

| # | Decision proposed here |
| --- | --- |
| 1 | Batch import is curator/JB-only; the RA path stays one-by-one. |
| 2 | One source record per file; rows carry stable `source_locator`s paired with a content `claim_hash` for idempotency; per-row repairable report; fix rows in place, never delete or reorder between uploads. |
| 3 | Imported rows arrive as drafts, never auto-submitted. Import validation is the submit rules plus two stricter additions (required `name`; required `containing_area` without coordinates). |
| 4 | VU rows without an explicit sensitivity answer are parked, not imported. |
| 5 | Corrections are evidence against `matched_current_site_id`, entering the standard queue; map-side exposure stays JB-gated. |
| 6 | The restricted-coordinate rule binds the map link generator (omit `lat`/`lng` for restricted-display sites); the workbench never copies URL coordinates into evidence fields. |
| 7 | Visual alignment proceeds as three targeted touches at route-landing time; light working surface retained. |
