# Changelog

## Unreleased

### 2026-06-13

- Brought the Vanuatu map to the same control layout as NZ: Census
  front-and-centre as a panel disclosure (geography selector and the
  boundaries-pending legend), Key top-left, no play button, two-pill
  bottom row.
- Reworked the NZ map's top controls so census is the centrepiece: the
  Census button moved front-and-centre at the top (a disclosure that
  opens and closes its data panel — metric, geography, colour key and
  the time slider all in one place), and the denomination Key moved to
  the top-left. The census options left the Search bar entirely. The
  bottom row returns to Search & Filters · Near Me. The slider's play
  button is gone — dragging the slider is enough. On phones the Key
  collapses to its colour dots so it never crowds the Census control.
- Added a parallel Vanuatu research map at `apps/regions/vu/`, forked
  from the NZ map on the same shell. It carries the country's province
  (ADM1, 6) and area-council (ADM2, 65) geographies from geoBoundaries,
  census years 2009 and 2020, and the full place layer from the global
  tiles. Per-area religious-affiliation data is not yet available as a
  structured source (the 2020 VNSO provincial tables are PDF-only), so
  the areas render as a boundaries-only scaffold: the legend states the
  data is pending and the area summaries are ready to receive counts
  with no schema change. Wordmarks cross-link NZ and Vanuatu.
- Fixed a latent bug in the change metric: JavaScript coerces `null` to
  0, so `null - null` returned 0 rather than no-data. A suppressed or
  pending denominator now counts as no change, not zero change
  (surfaced by Vanuatu's all-pending data; also corrected on the NZ map).
- The census overlay is now a first-class control on the NZ map: it is
  on by default (so the map opens already oriented over the country), and
  a third bottom-row pill — Search & Filters · Census · Near Me — toggles
  it. The redundant in-dock checkbox is gone; the Census pill carries a
  rounded-square swatch (an area layer) to read distinctly from Near Me's
  round location dot. Three pills fit 375px.
- The NZ map now defaults to MapTiler's low-saturation Dataviz basemap,
  which is built to sit under data overlays so the census choropleth
  reads clearly above it; without a MapTiler key it falls back to
  Backdrop, then the free CARTO style.
- Fixed the denomination taxonomy path on the NZ map: the page sits one
  level deeper than the global map, so its `../../schemas/` fetch 404ed
  and the Christian-denomination sub-filters never populated. Corrected
  to `../../../schemas/`.
- The census overlay gained a time slider in the legend panel: it steps
  the choropleth through the census years (2013, 2018, 2023) with a play
  button that auto-advances, so the religious-affiliation change shows as
  motion across the map. The slider, the year dropdown, and autoplay all
  drive one shared year state and stay in lockstep.
- The NZ map's census overlay now offers two geographies: territorial
  authority and statistical area 2. The SA2 level reads a new governed
  product (`area_summary_sa2.json`, 2,311 areas by censuses 2013–2023)
  built from a provenance-recorded Stats NZ extract (the 2023 Census
  totals-by-topic SA2 feature service, CC BY 4.0; earlier censuses sit
  on 2023 boundaries via Stats NZ's own concordance). Areas with small
  or suppressed denominators wash out on denominator metrics, popups
  mark flagged years, and colour scales clamp to the 2nd–98th
  percentile so extreme small-area values cannot compress the national
  palette.
- Removed the unverifiable legacy demo data (`religion.json`,
  `demographics.json`, the 2018 `sa2.geojson`, and the static
  demographic stubs), completing the storage policy's audit-or-remove
  action; the new SA2 extract supersedes them with full provenance.
- The verification surface keeps its light RA workspace and CARTO
  basemap but now shares the project's type stack via
  `apps/shared/map-shell.css`, and the style guide's colour meanings
  moved into CSS custom properties with values unchanged (the guide's
  named future work). Computed styles verified: only the font stack
  changed. The shared sheet's popup idiom is now scoped to MapLibre
  popups so it cannot leak into Leaflet surfaces like this one.
- The rebuilt NZ research map is now the live page: `next.html` became
  `apps/regions/nz/index.html`, and the Leaflet page retired with its
  app scripts (`enhanced-places-app.js`, `denomination-mapper.js`;
  both live in git history). Inbound links pointed at the directory,
  so no link changed. Data files all remain, including `sa2.geojson`
  for the future SA2 overlay.
- Began the NZ research map rebuild on the global MapLibre shell:
  `apps/regions/nz/next.html` (alongside the live page) adds
  territorial-authority census choropleths (five metrics, censuses
  2013–2023, a diverging change scale), dark census popups with the
  full year table, a choropleth legend under the key pill, NZ city
  chips, and NZ-biased search. The overlay consumes the governed
  `area_summary_ta.json`; the Leaflet page remains the live
  `index.html` until parity.
- The NZ research map now wears the shared design language: slate
  masthead and controls bar, dark legend and loading panels, pill corner
  links, and the shared type stack, via `apps/shared/map-shell.css`.
  Semantic colours (category dots, data-quality sizes, cluster tints,
  choropleth scales) are unchanged; popups stay light pending the
  rebuild decision.
- Extracted the global map's theme primitives (tokens, the dark pill,
  corner placement, toast, popup skin, attribution treatment) into a
  shared stylesheet, `apps/shared/map-shell.css`, that the global map now
  consumes. Computed styles verified unchanged at 1280 px and 375 px;
  the research maps adopt the same sheet next.
- Searching a specific address now drops the measuring pin there and zooms
  in; area searches surface a once-per-session tip naming the gesture for
  dropping a pin.
- Marked the reliefmap porting guide as historical in `AGENTS.md` and in
  the guide itself, so retired features (the nearest banner, the ambient
  guide line) are not rebuilt from its inventory.
- The hint toast (pin drop, location messages) now wraps centred within
  the phone screen instead of running past both edges.
- Fixed the Filters toggle, which had never visually worked: its hidden
  attribute was silently overridden by the rows' display rule, so the
  state flipped while the screen never changed. Popup distances now say
  `as the crow flies` inline and the footnote renders white.
- The theme selector now rides in the wordmark pill beside GitHub and fix
  map; phones fix the theme to Backdrop (the wordmark hides there, and the
  credit fallback still applies).
- Mobile pills dropped to the refresh button's line and the dock followed;
  attribution uses MapLibre's responsive default — full text on desktop,
  a tap-to-expand disc on phones.
- Removed the nearest-place banner and its background nearest search;
  distances live in the place popups, and the tap-held guide line and
  planning pin remain (tap the pin to remove it).
- Replaced the circular GitHub info badge with a compact theme selector
  pill under the wordmark (top corner on phones); the badge's links live in
  the wordmark and the repo, and the onboarding card still shows each new
  session.
- The guide line now draws only when the user taps a place (and releases on
  a second tap); Near Me shows the dot and the nearest-distance banner
  without drawing a line unbidden.
- Moved the attribution to the true bottom corner on phones, where it no
  longer crosses the Search and Near Me pills; the filters disclosure became
  a full-width 44 px touch target and its chips now build at page start.
- The OpenStreetMap credit is now always on screen: both place tile sources
  declare ODbL attribution and the attribution pill no longer hides behind
  the info menu.
- The denomination key shrank to a compact pull-down: three colour dots for
  the leading categories in view, a Key label, and a caret, with the full
  key one tap away.
- Filters now persist when the search panel closes; an indicator chip
  beside the toggle shows the off-count and clears everything in one tap,
  and reopening the panel shows the active filters. Filter state travels
  in the URL fragment beside the camera, so filtered views are shareable.
- Typing a category into search (mosque, synagogue, church, a religion
  name, or a Christian denomination) now applies the matching filter and
  closes the panel; longer queries geocode as before.
- Restructured the filters: the Christian chip is now the tri-state master
  of its nested denomination row (selecting Anglican alone shows Christian
  as partially on, so a denomination can never be selected without its
  religion), and the rows sit behind a collapsed `Filters` disclosure whose
  label carries an off-count whenever anything is filtered.
- Added a tri-state `All` box that selects or clears every filter at once,
  with a dash showing a mixed state.
- Added search-panel filters: chips for the nine palette religions plus,
  while Christian is selected, eight major denomination buckets and Other
  Christian, grouped from raw OSM values through the denomination
  taxonomy's aliases. Filters drive the map layers, the counts key, and
  the nearest search together.
- The search dock follows the reliefmap contract: the toggle reads
  `Search & Filters` / `Close`, the panel has a ×, Escape closes, and
  closing or resetting clears all filters.
- Fixed Near Me on phones: the pill is now a strict toggle (a tap after
  panning turns location off rather than re-zooming to the user), the
  nearest search no longer stacks deferred tile queries while location
  tracking keeps the camera busy, and a denied browser permission now
  explains where to re-enable location.

### 2026-06-12

- Fixed the global map's fullscreen mode hiding the HUD, dock, and buttons:
  the fullscreen control now fullscreens `document.body` rather than the map
  element alone.
- Replaced `isStyleLoaded()` gates in the global map's click handlers and
  counts panel with layer-presence guards, so taps and key updates are no
  longer silently dropped during repaints (worst around basemap switches).
- Added a blue-dot geolocate control to the global map for all devices
  (high accuracy, follow mode, larger dot on phones) — the first feature of
  the reliefmap location-features port described in
  `docs/development/location-features-from-reliefmap.md`.
- Added a labelled `Near Me` pill beside `Search World` that drives the
  geolocate control's state machine, replacing the stock icon; on phones the
  pill row sits above the corner basemap control with 44 px touch targets.
- The global map now lands on the keyed Backdrop theme wherever a MapTiler
  key exists and falls back to the free CARTO style once if the key is
  blocked, rate-limited, or out of credit.
- Shortened the global map's onboarding card to two bullets and moved its
  copy to NZ English; the fix-on-OSM route now lives in the wordmark's
  fix-map link and the card's `How to fix data` button.
- Added a top-right wordmark pill with a GitHub repo link and an OSM
  fix-map deep-link that opens the editor at the current view (desktop
  only).
- Added the planning pin: right-click or touch-hold drops a draggable amber
  pin that becomes the measuring point, with nearest-to-pin readouts,
  pin-origin directions, and tap-or-× removal.
- Added the dashed guide line from the measuring point to the inspected or
  nearest place; tapping a place holds the line on it (surviving popup
  close), tapping it again releases, and the line survives basemap
  switches.
- The nearest banner now yields while the search dock is open on phones and
  returns on close, instead of overlaying the panel.
- The basemap theme selector moved from its bottom-right pill into the
  octocat corner menu, clearing the bottom-right corner.
- Place popups are now singletons (opening one closes the previous) and the
  refresh sweep closes the open popup.
- Street View is now lazy: the page-load prewarm (a billable Dynamic Maps
  hit per visit) is gone, popups show a Show Street View button, and the
  Google Maps API loads once on first request with callback-based
  readiness. Expand, the drag hint, and Copy coords work without it.
- Raised the open search dock above the mobile pill row so it no longer
  hides the Search World and Near Me buttons.
- Added From you / From pin distance rows to place popups with a crow-flies
  footnote and a walking Directions link (pin as origin when down), on both
  the desktop and mobile popups.
- Tidied the global map's corner controls: the set-north badge now appears
  only when the map is rotated (phone and desktop), the dead second compass
  button is gone, the octocat info menu sits top-right under the wordmark,
  and a refresh button (bottom-left, both form factors) clears pin, search,
  and dock and flies home.
- Bumped starlette (1.0.1), pyarrow (23.0.1), and idna (3.17) past open
  dependabot advisories; fastapi 0.136.1 resolves cleanly against the new
  pins.
- Added the measuring point and nearest banner from the reliefmap port:
  distances answer from the blue dot (later the planning pin), the banner
  reports the nearest place of worship as the crow flies with a walk
  estimate, and tapping it opens Google Maps walking directions. The
  nearest search queries the detailed places source only, never the
  low-zoom overview tier.
- Added `DECISIONS.md`, a register of sixteen adjudicated rulings for the
  revisions pipeline, each with rationale, what it forecloses, and the cost
  to reverse.
- Added `schemas/denomination-taxonomy.schema.json` and the first versioned
  vocabulary instance `schemas/denomination-taxonomy.json`
  (`taxonomy_version` 2026-06-12.1), promoting the controlled vocabulary out
  of `apps/regions/nz/js/denomination-mapper.js`. Contested placements follow
  the Stats NZ standard classification and carry review flags.
- Tightened `schemas/change-event.schema.json`: `taxonomy_version` is now
  required for any denomination-bearing payload (previously only for
  `denomination_*` event types), `client_event_id` must be non-empty, and the
  descriptions state the bitemporal replay rule.
- Updated `docs/examples/revisions/nz-relocation.jsonl` to pin the v1
  taxonomy and use dotted denomination codes. Bare codes remaining in other
  example files and `pow-cli` fixtures are migration debt before
  taxonomy-membership validation is enforced.

### 2026-05-23

- Added temporary Vanuatu source-first portal entry points that use the shared
  Convex assignment and reviewer surfaces with Vanuatu target years 1989, 1999,
  2009, and 2020.
- Added a spreadsheet-submission import path so exported RA
  `site_evidence_wide` CSV rows can become provisional Convex tasks with
  submitted evidence drafts in the review portal.
- Added a Vanuatu OSM-derived starter seed builder for a balanced 50-case
  source-first task batch under `vu-source-first-test-001`.
- Seeded the hosted Convex deployment with the 50-case Vanuatu starter batch
  and verified that the public Vanuatu task and review entry points are live.
- Documented the Vanuatu test workflow, spreadsheet import command, Convex
  import mutation, and the continuing boundary that imported rows do not update
  the master or public map before review and `pow` validation.

### 2026-05-15

- Added explicit RA evidence fields for source-backed street address, locality,
  and address notes so `street address missing` tasks have somewhere to record
  the correction.
- Added Google identity-token expiry tracking and pre-expiry refresh attempts
  for the static Convex task client, reducing mid-session sign-in expiry during
  RA verification and review work.
- Switched the Convex Google OpenID Connect auth config to the public Google
  client id already used by the frontend, so local anonymous Convex codegen no
  longer depends on hosted deployment environment variables.

### 2026-05-14

- Refreshed RA-facing docs to include `No building present` / building absence
  as a first-class finding, distinct from worship-use closure, changed use,
  unrelated missing-site nomination, and bad-geometry review.
- Tightened Convex evidence/task-history access so RA accounts can inspect
  only their own or assigned evidence, while reviewer, curator, admin, and
  service roles retain project-wide inspection access.
- Added server-side field-size limits to Convex evidence, review, and task
  mutations so oversized notes, generated rows, and client context are rejected
  before they reach the shared backend.
- Recorded the strict TypeScript transition rule: new Convex-facing workflow UI
  should be strict TypeScript, while the live static verification map should
  migrate only through targeted redesign or pilot-driven edits.
- Refreshed RA-facing documentation so the assigned Convex-backed workpack is
  the preferred saving path and spreadsheet copy/paste is fallback only.
- Reordered the journal newest-first and refreshed the planning snapshot to
  describe the live Convex assignment/review workflow as of 2026-05-14.
- Reviewed the public Convex function inventory against the current exported
  queries and mutations, and added a workflow script catalogue for RA workpacks,
  Convex seeding, review exports, and `pow` handoff scripts.
- Updated the FAQ to reflect the current Convex-backed RA assignment, static
  reviewer portal, unresolved-note path, accepted-for-export boundary,
  TypeScript/Rust split, and workflow function/script references.
- Added the New Zealand submitted-evidence reviewer portal to the README links
  and noted that current authorisation is limited to JB and JW.
- Clarified that new Convex-facing task, review, nomination, export, and
  country-configuration UI should prefer strict TypeScript over new vanilla
  JavaScript.
- Added an OSM-notes-style `Submit unresolved note` path for RA work: useful
  but incomplete evidence now becomes a first-class Convex task/draft state
  instead of being forced into a completed submission.
- Added unresolved-note handling to the reviewer portal queue and documented
  the RA/reviewer workflow.
- Tightened the static reviewer portal: decisions now require an explicit
  choice and short note, reviewed/exported cases can be inspected, and reviewers
  can mark system-test submissions as rejected/excluded without entering the
  export path.
- Added an assignment-mode `My work` panel so RAs can see saved drafts,
  submitted cases, skipped tasks, and review outcomes without repeating work.
- Added a deliberate `Revise submission` path: submitted evidence is read-only
  by default, revisions create a new draft id, and older submitted drafts are
  marked `superseded` after the revision is submitted.
- Changed the assigned task list to show active work only, so submitted or
  skipped tasks leave the main queue after refresh and remain visible in
  `My work`.
- Added a visible `No building present` option to the worship-use dropdown and
  normalised it to `existence_status = absent` plus
  `worship_use_status = not_worship` for exported evidence.
- Blocked `NA`/`N/A` source titles on submit while still allowing incomplete
  drafts to be saved.
- Relaxed RA backend draft saving so `Save draft` can preserve incomplete work,
  while `Submit for review` still requires source and evidence details.
- Added a `No building present` RA action for demolition or no-visible-building
  cases, keeping building absence distinct from worship-use closure.
- Added a static Convex-backed New Zealand reviewer portal at
  `apps/regions/nz/review.html` for role-gated review of submitted evidence
  drafts.
- Extended the browser Convex client with review queue, review decision,
  evidence-list, and task-history methods.
- Tightened Convex review decisions so accepted-for-export decisions require an
  evidence draft from the same task.
- Added clearer street-level imagery support to the RA verification map:
  marker popups now expose Street View, the source-link panel prioritises
  Street View and Google Maps, and the evidence form can explicitly fill a
  Google Street View source URL for street-imagery checks.
- Clarified the RA instructions and planning around missing places of worship:
  assigned-task missing-site evidence should save through Convex, unrelated new
  candidates should be sent to JB for now, and the next reusable build step is a
  Convex-backed `Nominate missing PoW` flow.
- Added `Nominate missing PoW`, not `Add to map`, as the required wording for
  provisional candidate intake so RA-facing UI keeps the master boundary clear.
- Added documentation-governance guides: a staleness health check, a Convex
  function inventory, and a UI style guide for task-map wording, status,
  colour, button, and form conventions.
- Relabelled the old RA CLI tutorial as an archived CSV validation fallback,
  and recorded React + Vite + Convex React as the preferred stack for the first
  authenticated review portal or shared task workbench.
- Updated `BRAINSTORMING.md` so Convex is described as the chosen live pilot
  coordination layer, while Leptos/Rust-first UI remains a deferred comparison
  after the React + Vite review workbench.
- Updated the dataflow figures and review planning so assigned tasks and
  `Nominate missing PoW` candidates both flow through Convex, an authenticated
  review portal, a reviewed export bundle, and `pow` before public outputs.
- Recorded the Convex/live-workbench decision and added the first
  Convex-to-`pow` export bridge: `exports:getExportBundle` now exposes a file
  bundle, and `scripts/materialise_convex_export.py` writes ignored export
  artefacts with SHA-256 hashes for the round-trip validation path.
- Added the review-portal direction to the Convex planning docs: reviewer
  decisions should happen in a role-gated UI, update the RA-facing task state,
  and treat the current workpack as a filtered batch over one shared task list.
- Recorded the stack decision to use TypeScript pragmatically for
  Convex-backed prototypes, task/review workflow glue, and frontend
  integrations while keeping Rust and R authoritative for governed data and
  analysis.
- Polished the RA assignment page with a collapsible quickstart guide,
  optional invited-account hint, lifecycle-date prompt for closure/change
  actions, clearer post-submit/skip filter guidance, and a pre-paint mobile
  assignment layout guard.
- Clarified the RA workpack instructions: André should work through assigned
  tasks in order, stop at a natural stopping point, and understand that the
  50-case list comes from the documented R selection algorithm rather than
  hand-picked map sampling.
- Applied the first RA assignment UI review fixes: prevented assignment-mode
  skip from falling back to hidden local storage, removed the pre-sign-in
  initials prompt, improved phone layout, clarified save/submit labels,
  added sign-in-expiry handling, and reloaded the latest saved draft when a
  task is reopened.
- Moved the NZ assignment sign-in card to the top of the sidebar, enlarged the
  Google sign-in prompt, added a sign-out control, and hid old local
  copy/session guidance during backend assignments.
- Defaulted the hosted NZ verification page to the 50-case
  `nz-temporal-ra-workpack-001` assignment when the shared backend is enabled,
  so RAs do not accidentally load the full task map from the bare URL.
- Clarified that the Google sign-in button shows the account already signed
  into the current browser, so RAs should choose or switch to their invited
  account if a different name appears.
- Updated `urllib3` in `uv.lock` from 2.6.3 to 2.7.0 to address the current
  Dependabot security alerts for urllib3.
- Enabled the hosted Convex-backed NZ assignment client for
  `placesmap.org`, using the public Convex deployment URL and public Google
  OAuth client id.
- Deployed the Convex task backend and seeded
  `nz-temporal-ra-workpack-001` with 50 open tasks for the first RA web
  assignment.
- Added pending Google-authenticated project invitations for the NZ pilot
  admin/reviewer and RA accounts.

### 2026-05-13

- Added a configuration-gated Convex bridge to the NZ verification map:
  Google sign-in panel, shared task-state refresh, `Save draft`, `Submit for
  review`, and backend `Skip this task` actions.
- Added the first 50-case Convex-backed web assignment path:
  `?batch=nz-temporal-ra-workpack-001` loads only that assigned batch, disables
  spreadsheet copy/paste for the assignment, and saves drafts/submissions to
  the shared task backend.
- Added `scripts/build_convex_workpack_seed.py` to turn the reproducible New
  Zealand temporal workpack into a deterministic Convex seed payload.
- Added a disabled-by-default public `convex-config.js` and browser task
  client so the static map can be enabled after hosted Convex auth, invites,
  and task seeding are ready.
- Guarded Convex bootstrap mutations with a deployment setup token and updated
  setup guidance so the first hosted admin/RA invites cannot be created
  anonymously.
- Added the real Convex Google OpenID Connect auth config, using the deployment
  `GOOGLE_CLIENT_ID` environment variable rather than a committed client id.
- Added a Convex capacity and plan-trigger model: start on Free, move to
  Starter only on quota pressure, and reserve Professional for backups, logs,
  support/compliance needs, or sustained high usage.
- Tightened the Convex task-layer spec with country-config, schema-version,
  OSM-as-evidence, rate-limit, kill-switch, and Sheet/Convex transition rules.
- Fixed local fallback state so a failed clipboard write no longer marks a task
  tentatively closed, and namespaced local session exports by country and RA
  initials.
- Updated RA-facing guidance to make backend save/submit the preferred
  workflow and spreadsheet copy/paste the fallback path.
- Added `research/vanuatu-case-analysis.md` as the first Vanuatu source-first
  country protocol, with 1989/1999/2009/2020 target years and lifecycle dates
  accepted from 1600 onward.
- Recorded Guy as the research assistant for the first Vanuatu source-first
  pass.
- Updated planning, roadmap, FAQ, Convex task-layer, and RA template guidance
  so target years are country-specific rather than treated as globally fixed
  New Zealand fields.
- Generalised the verification-map target-year controls behind a small country
  config while preserving the New Zealand 2013/2018/2023 defaults.
- Added a private André handoff draft for the existing New Zealand temporal RA
  workpack, keeping the shared Sheet link out of public docs.

### 2026-05-10

- Added `docs/system-map.md` to organise the project as deep modules with clear
  ownership, interfaces, and tactical task homes.
- Added system-map links from the README, roadmap, planning, and agent
  guidance.

### 2026-05-09

- Added a reproducible New Zealand temporal RA workpack builder that selects a
  first 50-record pilot set from the generated OSM date-tag and temporal
  places-to-check files.
- Documented the workpack selection rule, generated outputs, SHA-256 check, and
  RA use pattern in `docs/development/nz-temporal-ra-workpack.md`.

### 2026-05-08

- Added `BRAINSTORMING.md` for tool and architecture ideas still being weighed,
  including Graphite, JSON diff/tree rendering libraries, Convex boundaries,
  PostGIS, and Rust-first web UI options, with migration-path notes.
- Added a separate tracked `raw_source` manifest for the New Zealand
  2013-2025 raw OSM/ohsome annual snapshot archive stored in project Google
  Drive.

### 2026-05-07

- Recorded the New Zealand temporal-reconstruction pilot decision: RAs should
  contact church bodies and review only curated, cleaned OpenStreetMap lists of
  places to check, not raw annual OSM differences.
- Added a current-data-flow chart and inventory explaining where the already
  ingested OSM and NZ Census-linked files live, separating committed NZ app
  data from ignored temporary working outputs, plus a current-action checklist
  for promotion, audit, or disposal.
- Added the first tracked data manifest for the New Zealand 2013-2025 OSM
  places-to-check archive stored in project Google Drive.
- Added a dated Convex pricing snapshot to the storage and task-map planning:
  start the one-RA pilot on Free/Starter if possible, consider Professional
  only for backups/logs/support or usage limits, and keep raw snapshots,
  media, accepted diffs, and public products outside Convex.
- Added `docs/data-storage-pipeline.md` to make ignored generated files
  temporary working files only: reusable datasets now require durable
  project-controlled storage plus tracked manifests with checksums, counts,
  provenance, and licence/privacy status.
- Added `schemas/data-manifest.schema.json` and updated the manifest templates
  for hash-backed dataset versions, country/global partitions, supersession, and
  durable-file checksums.
- Documented accepted diffs as primary longitudinal data: losses, gains,
  target-year states, density changes, and appeared/disappeared map layers must
  be derived from accepted change events and accepted-diff manifests.
- Documented how OSM opening and closure date tags, such as `start_date`,
  `old_start_date`, and `end_date`, can seed provisional target-year statuses
  and gain/loss tasks, while accepted events remain the longitudinal data.
- Added an FAQ entry explaining how OSM date tags can indicate whether a
  place of worship may have been alive at 2013, 2018, or 2023.
- Added a journal data-workflow graph and storage/action decision tree covering
  the shared online task map/list, project Drive working files, Google Cloud
  Storage durable artefacts, deferred PostgreSQL/PostGIS, and `pow`
  accepted-event outputs.
- Updated planning and storage guidance with the account and pricing checks
  needed before enabling Convex, Google Cloud Storage, or queryable geospatial
  staging.
- Clarified that temporary working files mean ignored, disposable, recomputable
  run output only; reusable datasets need named non-local project locations
  such as Drive file IDs, cloud storage paths, or database names.
- Reworded the OSM temporal workflow docs in plainer terms: the generated
  files are lists of places to check, such as places present in one OSM year but
  not another or places with OSM opening/closure date tags.
- Replaced ambiguous workflow labels with concrete terms such as OSM date tags,
  shared online task map/list, reviewer download, file set, and cloud storage
  path.
- Added `LEXICON.md` as a plain-language glossary for project reporting,
  RA-facing docs, diagrams, and future agent work, and linked it from the
  README and agent guidance.
- Clarified that `JOURNAL.md` is public-facing project history and rewrote the
  grant-reference entry to avoid internal agent-style wording.
- Renamed the OSM date-tag places-to-check output to
  `nz_osm_date_tag_places_to_check.csv`/`.geojson` and renamed the RA source
  type value to `osm_date_tags`.
- Clarified provider planning so Cloudflare is not part of the active storage
  path unless that choice is explicitly reopened.
- Extended the temporal OSM places-to-check generator to use annual `1 September`
  snapshots from 2013 through 2025 by default, while retaining 2013, 2018, and
  2023 as highlighted New Zealand RA/research task years.
- Recorded the first strict national annual OSM run: 4,777 local candidate rows
  from the ignored 2013-2025 node/way extraction, confirming the direct ohsome
  route is viable but needs a smaller reviewer-selected task set before RA
  review.
- Added the first `scripts/build_nz_osm_temporal_candidates.R` workflow to
  fetch dated New Zealand OSM snapshots through ohsome, apply the existing
  project cleaning rules to each snapshot, and emit candidate CSV/GeoJSON diffs
  for maintainer inspection before RA review. The strict default now starts
  with `amenity=place_of_worship` and node/way objects; broader tags and
  relation geometry are explicit slower options.
- Extended the NZ temporal OSM workflow to emit CSV/GeoJSON files listing
  places with OSM opening or closure date tags, including raw tags, parsed date
  bounds, provisional target-year statuses, possible gain/loss windows, parser
  warnings, and reviewer instructions.
- Reran the cached strict New Zealand temporal OSM extraction locally after the
  OSM date-tag update: 4,777 year-difference rows and 1,438 date-tag rows, with
  35 possible gain windows and no date-tag-derived loss windows.
- Added maintainer-facing notes for the NZ OSM temporal-cleaning workflow and
  updated the near-horizon plan and roadmap to put cleaned OSM places-to-check
  files and church-body record requests ahead of RA verification.

### 2026-05-03

- Added the initial Convex task-map backend scaffold: package scripts, project
  config, schema tables for users/tasks/task events/evidence drafts/reviews/
  exports, role-checked functions for shared task status and manual candidate
  tasks, a static NZ task seed builder, and maintainer setup notes.
- Ran the first local Convex task-map backend smoke test: generated Convex types,
  bootstrapped a local admin identity, seeded five NZ tasks, created a manual
  candidate task, saved/submitted/reviewed an evidence draft, and froze an
  export file set.
- Added hosted-pilot onboarding support for Convex: a one-time pending-invite
  bootstrap mutation and Google OpenID Connect auth configuration example,
  so real users can claim project roles with their own identities.
- Added `docs/convex-task-layer-spec.md` as the implementation contract for the
  live RA/reviewer task map: Convex-owned task status, evidence drafts,
  review decisions, event logs, reviewer exports, and the export boundary to
  `pow`.
- Removed implementation-facing command-line references from the RA pilot task
  guide so the first-pass instructions stay focused on the map and shared
  working Sheet.
- Updated portal and task-map planning to make Convex the preferred near-term
  backend spike for shared RA/reviewer task status, while keeping accepted
  events, master rebuilds, and public map exports outside Convex.
- Defined opening, closure, and change-date evidence in RA-facing guidance and
  clarified that missing-place candidates may already exist in OSM; OSM ids
  should be recorded as source or matching evidence, not treated as project
  site ids.
- Added optional opening/closure/later-change fields to the NZ verification map
  so RA rows can capture source-backed dates outside 2013/2018/2023, including
  site opening, closure, first/last seen, relocation, demolition, and later
  shared-use or multi-denominational changes.
- Clarified that RAs should leave missing cells blank rather than entering
  `NA`/`N/A`, documented accepted date formats as `YYYY`, `YYYY-MM`, or
  `YYYY-MM-DD`, added map-side date checks for source/capture dates, and made
  `pow validate` reject common missing-value placeholders.
- Documented how RAs should avoid accidental duplicate work during the NZ
  pilot: local map badges are browser-only, the shared Sheet is the durable
  pilot record, multiple rows for one place are allowed when they carry
  different evidence, and the target design needs a shared provisional task
  store outside the master database.
- Updated the NZ verification map action builder to keep RAs on the map after
  copy/skip actions, mark copied tasks as tentatively closed in the local
  session, and expose controlled fields for existence status, worship-use
  status, assessment confidence, site-match confidence, and location
  confidence.
- Clarified the NZ verification map's missing-site prompt by adding an
  `Open draft nomination form` button and renaming the sidebar panel so RAs
  are not pointed to an ambiguous "form above".
- Clarified the RA session JSON export as a local reconstruction/debug log,
  changed active RA-facing instructions from "the project team" to "JB", and
  tightened the NZ place-density colour domain so low per-km² values render
  visibly on the map.
- Added a first-session briefing and post-session capture protocol to
  `docs/ra-nz-pilot-task.md`, including 5-10 varied demo-map cases, paste
  alignment checks, session JSON export, and five feedback questions.
- Treated `site_evidence_wide` header order as a data contract: protected the
  live Sheet header with an edit warning, clarified paste instructions, added a
  FAQ entry, and made `pow validate` reject known-template header reordering.
- Simplified `docs/ra-nz-pilot-task.md` so the current RA instruction is to
  sample varied tasks from the demo map rather than complete a fixed 50-row
  pilot batch.
- Added a second README pointer to `FAQ.md` near the project orientation links.
- Clarified the identity conflict process: accepted user-nominated sites keep
  durable project `site_id` values, later OSM matches attach as source
  identifiers after review, and conflicts become proposed change events rather
  than direct master overwrites.
- Added `FAQ.md` as a plain-language guide to site identity, candidate ids,
  OSM conflicts, RA spreadsheets, task generation, staged review, and visual
  evidence.
- Moved CLI and staging support docs into `docs/development/`, removed the CLI
  tutorial from the default RA task path, and added planning notes for
  UI-generated new PoW nominations and explicit 2013/2018/2023 evidence
  capture.
- Clarified that RA working spreadsheets should be project-owned Google Sheets,
  with later automated provisioning from a locked project template rather than
  RA-owned copies.
- Added `scripts/build_ra_working_sheet.py` to build the multi-tab RA working
  workbook from the repository templates for native Google Sheets import,
  including frozen headers, filters, and main-tab controlled-field dropdowns.
- Added `field_observation` to the RA evidence vocabulary and documented
  street-level imagery providers, capture dates, and RA field observations as
  explicit visual evidence sources.
- Updated the NZ verification map action builder to capture source provider,
  source/capture date, Street View or other street-imagery sources, and field
  observation rows without silently falling back to OSM as evidence.
- Added a selected-site task brief to the NZ verification map demo. The detail
  panel now turns priority, suggested action, target year, and automated checks
  into a concrete RA checklist before the findings form.
- Defaulted the NZ verification map to demo mode while the RA action builder
  is the only functional state. The page now lands with the action builder,
  session log, and nomination controls available; appending `?demo=0` opts in
  to the read-only feedback view that will become the default once secure
  staging exists. Updated the NZ README and RA pilot task doc to point at the
  bare URL as the canonical demo entry and to document the `?demo=0` opt-out.
- Added a Tier 2 self-audit and recovery layer to the NZ verification map
  demo: an RA-initials prompt and badge persisted at
  `localStorage.pow_ra_initials` and stamped on emitted evidence rows; a
  client-side session log at `localStorage.pow_ra_session_v1` capturing every
  copied or skipped task with the full TSV; a collapsible "My session" panel
  in the sidebar with re-copy, open-task, export-JSON, and clear-session
  controls; a Skip task collapsible with optional reason; and
  tentatively-closed/skipped status pills on the sidebar task list.
  All client-side; no schema or backend changes.
- Added a Tier 1 ergonomics pass to the NZ verification map demo: a numbered
  4-step indicator (Inspect, Decide, Evidence, Copy row) at the top of the
  detail panel; a reordered detail panel so the action builder sits directly
  below the source links; a dismissable quickstart banner explaining the
  6-step workflow; an explicit "Use OSM URL" button so the source URL no
  longer auto-fills with the OSM record itself; clearer post-copy clipboard
  guidance; larger body, label, input, button, and link fonts with primary
  buttons at least 44 to 48 pixels tall; and removal of the fragile
  note-overwrite heuristic so action changes never overwrite a touched note.
- Shortened the public README, added a direct roadmap link, and removed the
  detailed OpenStreetMap editing instructions while retaining OpenStreetMap
  attribution and contribution-status guidance.
- Updated the roadmap and planning notes after the `pow diff` v1 merge so the
  next priority is the minimal save/evaluate/review loop rather than the
  completed diff groundwork.
- Added `pow propose --persist` so emitted draft change events are written
  back into the local staging database as a derived batch linked to its
  source via `stage_batches.parent_batch_id`, and added `pow diff <batch_id>`
  reviewer report (text and JSON) covering per-site changesets, per-target-year
  transitions, validation warnings, and source coverage. Migration is
  idempotent for existing `.pow/staging.sqlite` files.
- Added `ROADMAP.md` as a directional phase map for the project and simplified
  `AGENTS.md` so future agents can find the roadmap, active planning, decision
  log, schemas, revision CLI docs, RA templates, verification plan, and portal
  plans quickly.
- Revised the roadmap and planning notes to pair evidence governance with
  research outputs, and recorded that web-based data management is deferred
  while the `pow` CLI, local staging, diff reports, and R-readable exports are
  stabilised first.
- Extended `change-event.schema.json` with pre-release worship-function event
  payloads for appeared/disappeared worship use, multi-denomination,
  multi-purpose use, organisation-site links, split/merge cases, and
  target-year effects, plus fixtures and CLI tests for the new contract.
- Scoped the first `pow diff` milestone to a reviewer report derived from staged
  events, with reconstructed snapshots, area summaries, density estimates, and
  map/export effects deferred to `pow rebuild-master` and export commands.
- Added an RA-facing CLI tutorial for validating and staging exported evidence
  CSV batches without editing repository templates or changing the public map.
- Added the first `pow propose` bridge and mapping contract for translating
  staged RA evidence rows into draft change-event JSONL before `pow diff`,
  including a golden CSV-to-JSONL fixture.
- Expanded the RA CLI tutorial into a step-by-step walkthrough with
  screenshot-style figures and explicit instructions not to submit pull
  requests, edit repository templates, or run staging/proposal steps without a
  project-team request during the pilot, plus a plain-language overview of the
  project aim and RA role. A fixture-based demo pass now aligns the tutorial
  with actual Cargo, validation, staging, and proposal output.
- Added `docs/ra-map-triage-guide.md` to give RAs step-by-step instructions for
  missing sites, duplicate records, disappeared sites, complicated worship
  functions, NZ priority tasks, and the intended 2013/2018/2023 map workflow.
- Added provisional 2013/2018/2023 target-year controls to the NZ verification
  map, colouring markers by target-year status derived from reviewed status
  fields where available and otherwise from OSM date tags.
- Added a no-save RA action builder to the NZ verification map demo so selected
  tasks can produce a spreadsheet-ready evidence row and review JSON locally
  while secure authenticated staging remains future work.
- Added `docs/ra-nz-pilot-task.md` as the current RA-facing New Zealand web
  pilot tutorial, making the pilot map-first, time-bounded, and focused on a
  mixed validation batch rather than CLI-first data entry.
- Clarified for RAs that the map demo does not save work: pilot evidence is
  saved in the shared working spreadsheet, with CSV export from that sheet only
  when requested.
- Removed the repository contributor guide while development remains
  single-maintainer.
- Recorded the repository governance baseline: keep the repo public, disable
  GitHub Issues/Discussions/Wiki during the pilot, and protect `main` against
  force-pushes and deletion while allowing direct maintainer commits.
- Added the first Rust `pow` CLI scaffold with `validate` and `stage` commands
  for RA evidence CSVs and staged revision JSON/JSONL files, including
  schema-backed change-event and geometry-history validation,
  controlled-vocabulary checks, date/coordinate/probability checks,
  replay-safety checks, text/JSON reports, and a local SQLite staging store.
- Added `docs/development/revisions-cli.md` and a small NZ sample change-event
  batch to document how the local CLI relates to later map/API staging
  ergonomics.
- Recorded journal decisions that the edit/review maps should submit through an
  authenticated API rather than call the CLI directly, and that the first
  staging store should use SQLite-compatible tables while Turso remains a later
  evaluation candidate.
- Clarified in planning and the journal that functional changes in worship use
  are first-class analytical data: appeared/disappeared target-year states,
  denomination changes, multi-denomination, multi-purpose use, and split or
  merged worship uses must be preserved separately from building existence.
- Tightened `change-event.schema.json` so `event_type` discriminates the
  required `payload.payload_type` and the allowed `event_intent` via top-level
  `if/then` rules; added `name_update` and `structure_created` payloads so the
  full `event_type` enum has a coupled payload; promoted `Status` to `$defs` in
  `site.schema.json` and `structure.schema.json` and referenced the site
  variant from `SiteCreatedPayload.status` and `StatusPayload.{previous,new}_status`,
  and the structure variant from `StructureCreatedPayload.status`; removed the
  duplicated `taxonomy_version` from `DenominationPayload` so the top-level
  field is authoritative; and added a `^[a-z][a-z0-9._-]*$` pattern on
  `denomination_code` pending the taxonomy schema.
- Moved heavy Python packages out of the default `uv` environment into explicit
  `api`, `fast-parquet`, and `legacy` extras, and documented the narrower Python
  scope.
- Updated Python API dependencies to clear Dependabot alerts for `geopandas`
  and `starlette`, including the FastAPI bump required by the patched Starlette
  release.
- Merged the revisions-pipeline critique and added initial change-event and
  geometry-history schemas for RA-submitted location and denomination revisions.
- Recorded the identity-on-relocation rule: `site_id` tracks the mappable place,
  while congregations that move to materially different places are linked through
  relocation events and organisation evidence.
- Added a portal data-entry planning hub and focused UI, database/storage,
  submission-review, auth/security, media, and provider-evaluation plans for the
  first authenticated New Zealand staging pilot.
- Recorded Google Cloud as the first portal backend baseline, with Google
  OAuth/Identity Platform, Cloud Run, Cloud SQL/PostGIS, Cloud Storage, no direct
  master writes, GitHub only as an audit mirror, and Convex/SpacetimeDB deferred
  until contracts are stable.
- Added planning and journal notes for a Rust-backed data-modification pipeline
  that governs validation, staged proposals, append-only change events, dry-run
  diffs, master rebuilds, and researcher-friendly exports while keeping R as the
  investigator-facing analysis layer.
- Made the NZ verification demo-entry path more visible by linking to demo mode
  from the read-only page and showing an initial mock-entry preview panel before
  a task is selected.
- Renamed the visible NZ verification action label from "Review when sampling"
  to "Spot-check in sample" while preserving the stored
  `review_when_sampling` value.
- Fixed the NZ verification popup `Open task` control so it binds through the
  app code and focuses the sidebar task detail instead of relying on an inline
  handler.
- Added an explicit `?demo=1` mode for the NZ verification page so the RA can
  inspect draft decision and nomination controls while the default public page
  remains read-only and no demo data is saved or submitted.
- Recorded the decision to use a managed authentication service for future
  intake and audit workflows rather than implementing password or session
  handling in the project.
- Added security and trust-boundary requirements for any future data intake
  path, including authentication, permissions, rate limits, upload controls,
  quarantine, validation, privacy/licence checks, abuse handling, and audit
  logs.
- Made the public NZ verification feedback pilot read-only until secure staging
  exists.
- Added `JOURNAL.md` as a decision log for methodological and architectural
  choices that need rationale beyond the release changelog.
- Disabled clustering on the NZ verification map so RA review shows individual
  candidate points by default.
- Ignored the local Darbyshire thesis PDF and noted that congregation-rich
  historical sources without addresses may later support fuzzy regional
  placement or uncertain back-propagated maps.
- Switched the NZ verification map to a greyscale basemap and added staged
  nomination controls for current places missing from OSM, lost target-year
  places, denomination/building complications, and charity-record site matching.
- Added a static NZ OSM verification map and generated
  `verification_tasks.geojson` layer so reviewers can inspect current master
  sites against OSM links, automated checks, priority filters, and copyable
  staged review decisions.
- Added `docs/master-verification-workflow-plan.md` to plan read-only master
  site data files, automated verification checks, review queues, staged decisions,
  agent-readable data dumps, and map verification layers for NZ and global
  scale.
- Added RA-facing historical site evidence CSV templates in
  `docs/templates/ra-historical-site-evidence/` for Google Sheets import,
  including source metadata, site observations, candidate matches, review notes,
  controlled vocabularies, and privacy/licence instructions.
- Added a wide RA evidence-entry template with first-class opening/closure/change date
  fields for founding, opening, first seen, last seen, closure, demolition,
  change of use, relocation, and target-year status checks.
- Added a normalised opening/closure/change-event CSV scaffold for later
  ingestion once the wide RA entry sheet is split into backend tables.
- Added historical-address and geocoding-basis fields to the RA evidence
  templates so changed streets, renamed localities, demolished buildings, and
  uncertain modern matches can be reviewed explicitly.
- Added bounded origin and closure date fields so sources that establish
  "not earlier than" or "not later than" evidence can be recorded without
  inventing exact dates.
- Added OpenStreetMap date-tag, visual-verification, and target-year
  probability fields to support later temporal verification of 2013, 2018, and
  2023 place existence.
- Added `docs/community-ingestion-api-plan.md` to plan Google Sheets, web,
  bulk-upload, API, and AI-agent contribution paths through staging,
  validation, review, adjudication, and master ingestion.
- Added a proposed ingestion spec for historical NZ place-density evidence so
  research assistants can source data while the pipeline preserves manifests,
  site-observation fields, review states, privacy checks, and aggregation rules.
- Added a planning note on the problem of reconstructing true 2013 and 2018 NZ
  place density, including evidence-tiered source paths through OSM history,
  Charities Services, Incorporated Societies, LINZ building/property data, and
  denominational or local records.
- Added a planning rationale for the first NZ `area_summary_ta.json` frontend
  wiring, documenting why overlays now consume a provenance-rich analytical
  product rather than browser-derived legacy census tables.
- Added a planned NZ interface-alignment pass so the regional map can adopt
  the global map's basemap, control, legend, popup, and attribution style after
  the area-summary overlay stabilises.
- Wired the New Zealand territorial-authority map overlay to
  `area_summary_ta.json`, including census-year controls, area-summary metrics,
  and denominator/source/boundary/quality context in popups and legends.
- Defaulted the global map on `placesmap.org` to the MapTiler Backdrop basemap
  when available, with CARTO retained as the fallback.
- Made `AGENTS.md` the canonical repo-local agent guidance and removed the
  repo-root `CLAUDE.md` symlink.
- Added the first New Zealand territorial-authority `area_summary` contract,
  generator, and static JSON/CSV outputs for portal layers and downloads.
- Added JSON Schemas for `source_dataset`, `indicator`,
  `indicator_observation`, `visual_layer`, and `area_summary`.
- Added 2023 Census religious-affiliation data to the New Zealand territorial
  authority workflow while preserving 2013 and 2018 snapshots.
- Added grant-aligned planning notes and a versioned `research/` workspace for
  global country-source feasibility audits.
- Ignored local `grant/` materials while allowing lightweight `research/` notes
  to be tracked.
- Reworked the top of `README.md` to better describe the project as a research portal in development, fixed external-facing wording errors, and moved OpenStreetMap editing guidance lower in the document.
- Added a planning note that `extendr` is the preferred optimisation path for future R bottlenecks, rather than rewriting the research pipeline away from R.
- Ported the global cleaning, deduplication, and review-queue stages to R as `scripts/clean_global_places.R`, `scripts/deduplicate_global_places.R`, and `scripts/build_global_review_queue.R`.
- Confirmed R-stage parity on the existing NZ `undated` snapshot: `4,632` cleaned records, `0` deduplicated removals, and `1,438` queued records.
- Marked the R scripts as the canonical research-facing global pipeline, with the equivalent Python scripts retained only as transitional references.
- Added a root `pyproject.toml`, `.python-version`, tracked `uv.lock`, and a `uv`-managed Python dependency workflow for scripts and the API.
- Removed the incompatible explicit `starlette` pin from `api/requirements.txt` and the new `pyproject.toml`, allowing `fastapi` to resolve a compatible version.
- Moved `pyarrow` to an optional `fast-parquet` extra because it is only used as an optional API fast path and does not currently build cleanly in the default Python 3.14 environment.
- Added `scripts/deduplicate_global_places.py` as a conservative global deduplication stage between cleaning and review-queue generation.
- Updated `scripts/build_global_review_queue.py` to consume deduplicated country outputs when present, while still falling back to cleaned outputs.
- Added `scripts/clean_global_places.py` for conservative deterministic cleaning of normalised global country datasets and `scripts/build_global_review_queue.py` for per-country review queues.
- Added the first global intermediate outputs from the existing NZ normalised snapshot:
  - `data/intermediate/global/undated/nz_places_cleaned.json`
  - `data/intermediate/global/undated/nz_places_deduplicated.json`
  - `data/intermediate/global/undated/nz_duplicate_resolutions.json`
  - `docs/review_queues/undated/nz_review_queue.csv`
  - `docs/review_queues/undated/nz_review_queue.md`
- Recorded the first strict deduplication test result for NZ: `0` records removed from `4,632` cleaned records, indicating that the current rules are not collapsing co-located but distinct congregations.
- Refactored `scripts/extract_global_data.R` into a raw extractor and added `scripts/normalize_global_places.R` as the first explicit global normalisation stage.
- Added an audit of `scripts/extract_global_data.R` and a staged draft workflow for global extraction, cleaning, review queues, and publication.
- Clarified that countries, including NZ, may have multiple coexisting boundary tessellations that are not strictly nested.
- Added proposed NZ pilot defaults for fixed-boundary comparison outputs, hybrid site matching, and the minimum country download contract.
- Added a country backend scheme and decision log for country-specific downloads, area assignment, and temporal tracking.
- Set `1 September` as the planning anchor date for annual longitudinal snapshots and noted Google Drive as temporary holding rather than the long-term record.
- Rewrote `PLANNING.md` as the active redevelopment roadmap and planning source of truth.
- Marked `docs/data-pipeline-architecture.md` as technical reference rather than the active roadmap.
- Added `docs/nz-data-cleanup-audit.md` to record the first NZ false-positive cleanup pass.
- Added `docs/nz-manual-review-queue.md` and `docs/nz-manual-review-queue.csv` for ambiguous NZ records that need human review.
- Applied a second NZ cleanup pass to remove low-information placeholder and generic worship-label records.
- Applied a third NZ cleanup pass to remove seven `Masonic Centre` records from the `hall_centre_house_site` review bucket.
- Applied a fourth NZ cleanup pass to remove church-hall and parish/community-centre support buildings that duplicated nearby mapped churches.
- Applied a fifth NZ cleanup pass to remove generic hall support buildings that duplicated nearby mapped churches, plus one `Masonic Hall` false positive.
- Applied a sixth NZ cleanup pass to remove weak generic centre records that duplicated nearby mapped worship sites.
- Rebuilt `apps/regions/nz/data/ta_aggregated_data.json` from official TA boundaries and Stats NZ religion data.
- Removed NZ frontend TA code remapping now that TA keys align with official boundary codes.
- Added a conservative NZ place-cleaning script and removed obvious non-worship records from published NZ datasets.
- Added a review-queue generator for staged NZ manual cleanup work.
- Tightened the legacy OSM extractor to reject obvious non-worship facilities with weak religious tags.
- Clarified NZ inclusion scope in `README.md`, including Chatham Islands coverage and current exclusions.
- Introduced `apps/global` and `apps/regions/nz` structure for frontends.
- Added legacy URL shims for `/`, `/enhanced-places.html`, and `frontend/` + `src/` paths.
- Added root `PLANNING.md` and consolidated planning notes.
- Added README guides for `apps/`, `apps/regions/nz/`, `data/`, `scripts/`, and `schemas/`.
- Aligned deployment strategy doc with the current static + tile server architecture and Rust plan.
- Added an operations runbook for GitHub Pages + Martin tile server workflows.
- Expanded the runbook with a step-by-step tile refresh guide and a forensics checklist.
- Redacted DNS record values in the runbook and replaced them with placeholders.
- Added a git-ignored `ops/private-ops-notes.md` template for sensitive details.
- Documented current data storage locations and an auditable tracking plan.
- Added an OSM snapshot/diff strategy to the data storage plan.
- Added JSON templates for snapshot and diff manifests.
- Consolidated planning content into `PLANNING.md` and reduced `docs/data-storage.md` to inventory-only.
- Noted `PLANNING.md` as the single planning source in `README.md`.
- Allowed `apps/regions/**/data` to be tracked and prepared NZ data files for deployment.
- Tracked NZ boundary GeoJSON files in `apps/regions/nz/data` to fix 404s.
- Updated Enhanced NZ data pipeline scripts to emit into `apps/regions/nz/data` while preserving legacy outputs.
- Switched global map Enhanced NZ link to a relative path for local and production parity.
- Made Enhanced NZ data loading resilient to `/apps/regions/nz/` and legacy URL entry points.
- Normalised coordinates from vector tiles to restore Street View links at low zoom.
- Added a Rust migration plan for data ingestion + API in `PLANNING.md`.
- Added a draft decision log section to `PLANNING.md`.
- Added an initial open decision entry for the Rust feasibility test (aka 'Spike').
- Added decision placeholders for regional data storage and portal adapter strategy.
- Renamed Enhanced NZ app path to `apps/regions/nz` for scalable regional naming.
- Removed root-level NZ data files and legacy `src/` data copies (now only in `apps/regions/nz/data`).
