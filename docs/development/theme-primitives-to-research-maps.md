# Porting the global map's theme primitives to the research maps

## Status (2026-06-13)

- **Extraction DONE** (`ad815f4`): `apps/shared/map-shell.css` holds the
  primitives; the global map consumes it. Proven a visual no-op by
  computed-style diff (47 elements × 63 properties, 1280 and 375).
- **NZ main map restyled in place** (`977d1d5`) as the interim state.
- **Scope change**: Joseph authorised a rebuild of the NZ main map.
  **Stage one SHIPPED** (`1d564ef`): `apps/regions/nz/next.html` forks
  the global shell and adds TA census choropleths from the governed
  `area_summary_ta.json`. The Leaflet `index.html` stays live until
  parity + screenshot approval. See JOURNAL 2026-06-13 entries.
- **Open decisions**: (1) swap `next.html` → `index.html`; (2) the
  verification surface's register — dark chrome would collide with the
  RA light-workspace convention, so per this brief's rule the question
  goes to Joseph rather than being guessed; (3) SA2 resolution waits on
  a governed SA2 summary product.

Instructions for the Claude instance unifying the NZ research maps with the
global map's design language. Written 2026-06-13 by the instance that built
that language (with Joseph, over ~50 commits — see `git log --since
2026-06-12` and the JOURNAL entries of 2026-06-12/13). Joseph dislikes the
disjoint between the apps; PLANNING.md step 31 already names this task and
its register: a restrained UI pass, not a rewrite.

## What to unify (the primitives)

All of these live in `apps/global/index.html` + `apps/global/styles/maplibre-flat.css`:

1. **Tokens** — the `:root` block: `--safe-top/right/bottom/left` (safe-area
   insets with minimums), panel/text/accent colours. Work Sans typography.
2. **The dark pill** — `rgba(15,23,42,~0.6-0.72)` background, 999px radius,
   1px `rgba(255,255,255,0.08)` border, `0 6px 14px` shadow, `#e2e8f0` text,
   opacity 0.85. Every control wears this: action pills, corner buttons,
   toasts, the wordmark.
3. **Corner grammar** — top-centre: compact key pill (colour dots + label +
   caret, panel on tap); top-right: identity pill (links + theme select,
   dividers between entries, native select chrome stripped via
   `appearance: none` + custom SVG caret); top-left: transient state only
   (compass appears when rotated, `.rotated` toggle); bottom-left: round
   refresh button; bottom-centre: the action pill row; bottom-right: stock
   map controls + attribution.
4. **Stock-control treatment** — MapLibre attribution at the true corner,
   responsive (full text wide, tap-to-expand disc on phones — keep the
   collapsed disc ≥24px against the 7px text styling). Attribution strings
   declared on data sources (ODbL credit).
5. **Toasts** — `#click-hint` pattern: centred fixed pill, 28px desktop,
   and the mobile override: 14px, `max-width: 86vw`, `white-space: normal`,
   centred text.
6. **Touch floors** — 44px minimum targets on phones (the style guide's own
   rule); full-row hit areas for disclosure toggles.
7. **Popup idiom** — dark translucent content, hidden tip, pill close
   button, `.place-attrs` grid rows, white footnotes (`#e2e8f0`, never the
   grey whisper).

## How to unify (extraction over copying)

The disjoint exists because styles were copied and drifted. Do not copy
again. Extract:

1. Create `apps/shared/map-shell.css` holding the tokens, pill recipe,
   toast, popup idiom, and corner-control treatments as classes/variables.
2. Make the global map consume it first (prove the extraction changes
   nothing — screenshot before/after at 1280 and 375).
3. Then adopt it in the NZ apps surface by surface.

## The research-map constraints (do not break)

- **André's live pilot**: `apps/regions/nz/verification.html` is in active
  RA use. AGENTS.md: keep it stable; migrate only through targeted
  redesigns. Restyle chrome, never workflow.
- **Status colours carry meaning** in RA surfaces (`docs/ui-style-guide.md`:
  green = present, amber = uncertain/skip, etc.). Theme primitives style
  *containers*; semantic colours stay.
- **Country-specific controls stay**: TA/SA2 selectors, census-year
  controls, target-year machinery. The pass restyles them in place.
- The NZ map's data contracts and JSON outputs are untouched by this work.

## Hard-won gotchas from the global-map sessions (do not relearn)

- **`hidden` attribute vs author CSS**: any `display:` rule on an element
  silently defeats the `hidden` attribute. Ship a scoped
  `[hidden] { display: none }` companion for every toggled element. This
  bug shipped invisibly on the global map for two days.
- **Verify computed style, not attributes/classes** — the above survived
  several "verifications" that asserted `el.hidden` instead of
  `getComputedStyle(el).display`.
- **Local dev port 8000 only**: the MapTiler and Google keys are
  origin-locked to `localhost:8000`. On any other port the keyed basemap
  fails and the credit fallback flips to CARTO (fine for layout testing;
  Street View dark). If another session holds 8000, test layout on 8010
  knowing that.
- **Hidden preview tabs lie**: rAF and the style pipeline stall; camera
  animations and `map.on("load")` never fire. Ask Joseph to open the
  preview panel for rendered verification; assert geometry and computed
  style, capture `flyTo` args instead of expecting the camera to move.
- **Cache-bust both HTML and CSS** in the preview (http-server 304s), and
  on iOS expect stale CSS after deploys.
- **GitHub Pages builds race**: two close pushes can leave the last build
  `errored` with no successor — check
  `gh api repos/go-bayes/places-of-worship/pages/builds/latest` after the
  final push and POST a rebuild if needed.
- **`document.write` reboots cannot re-run the page script** (top-level
  const redeclaration) — mock APIs post-load instead; MapLibre resolves
  `navigator.geolocation` at trigger time, so post-load mocks work.

## Process

Work surface by surface (extraction, global-map adoption, NZ main map, NZ
verification chrome), one commit each, screenshots at 1280 and 375 for
Joseph between steps — he approves UI from screenshots quickly. Record
durable decisions in `JOURNAL.md` and date `CHANGELOG.md` entries. When a
global-map convention collides with an RA-workflow convention, the RA
convention wins on RA surfaces; ask rather than guess.
