# UI design audit and decision set — the RA portal, the review portal, and the public map shell (2026-09-03)

Status: DRAFTED 2026-09-03 (late evening) at JB's request ("look at the colours and font size and layout of the RA portal. We want the ui to be maximally intuitive and clear. We also want nice colours and design. This is where Anthropic excels over my tastes."). Two read-only audits ran in parallel (the RA portal; the review portal and the public map shell); their full reports with computed contrast ratios and line-numbered tables are in the session scratchpad and summarised here. This document takes the decisions JB delegated and leaves him three policy rulings (section 5). Nothing here has been applied; section 4 proposes PR-H3.

## 1. The state of the three surfaces

The three pages were written at different times by different hands and it shows. Counted from the stylesheets:

| Surface | Distinct colours | Font sizes in use | Radii | Base text |
|---|---|---|---|---|
| RA portal (`verification.html`) | about 120 (14 text greys, 14 border greys, 12 blues, 7 ambers) | 11 to 24 px; 80 of 109 declarations at 13 px or below | 2, 3, 4, 5, 6, 9, 10 px | 15 px, but most working text 13 px |
| Review portal (`review.html`) | about 37 (13 tokens plus 24 literals: 4 blues, 5 ambers) | 9 to 24 px | 3, 6, 8 px | 15 px |
| Public map shell (`map-shell.css`, `region-map.css`, `maplibre-flat.css`) | one navy at 14 alpha values, 11 white hairline alphas, 6 text greys | 17 sizes, 7 to 28 px | 4 to 24 px, eleven values | 12 to 13 px in the chrome |

No page loads a web font. The review portal asks for Inter and the shell asks for Work Sans; neither is linked, so every visitor sees the system stack. The two working tools disagree on the secondary button (grey-filled versus white with a blue outline), the muted grey, the amber pair, the radius and the font stack.

## 2. Defects (no ruling needed; they contradict WCAG AA, the style guide, or the page's own tokens)

Ordered by harm to a new RA, reviewer, or visitor.

**RA portal.**
1. Amber means seven things: uncertain status, medium priority, the disputed ring, two buttons ("skip confirm", "revise now"), required-field marks, a gap prompt, a zoom gate; and the amber unvalidated dot (`#f59e0b`) and the disputed ring (`#d68910`) are the same colour to the eye.
2. The map carries four encodings (fill hue for target-year status, ring for validation state, size for priority, dash for review or nomination) and two legends, one on the map and one in the sidebar filters. Nothing tells the RA that size means priority. The "not assessed" fill and the "validated" ring are the same blue, so a validated not-assessed site is a blue dot in a blue ring.
3. Text is too small for a tool used for hours: task rows, check lists, task brief, help copy at 13 px; stat captions and status pills at 11 px; then 16 px inputs beside 13 px labels, so forms look inflated while prose looks cramped.
4. Contrast: white on the amber buttons is 2.8:1; stat captions 3.5:1; placeholders 3.5:1; input borders 1.5:1 and card borders 1.2:1 against white (WCAG asks 3:1 for control boundaries), so the structure the dividers are meant to give barely registers.
5. Everything is bold (labels, meta, pills, badges, summaries, legends, buttons), so nothing leads.
6. The save row shows two filled primaries ("Save draft", "Submit for review") with the outlined "Submit unresolved note" orphaned on a second row; any unclassed `button` is a filled primary.
7. Two numbering systems for one workflow: the chips say Inspect, Decide, Evidence, Save; the headings say Open source links, Choose what your evidence shows, Evidence, Save or submit.
8. Six blues doing four jobs (action, validated ring, step headings, focus, headings and badges, task-why border).

**Review portal.**
1. Confirm, Override and Reject are all the same secondary grey; the reject form's submit wears the primary blue. Colour must say what the button does.
2. The disabled Confirm (the one that carries the tooltip explaining why confirm is refused) sits at 1.7:1.
3. Every attachment "Open" is a default primary, so four photos show four primaries above "Record review decision".
4. Green and amber status pills fail AA at 12 px bold (4.1 and 4.5:1); input borders 1.8:1; hairlines 1.4:1.
5. No hover or focus styles at all; h2 and h3 are both 16 px; the standing "Review boundary" instructions wear the warning amber.

**Public map shell.**
1. Chrome text fails AA over the default light basemap: pills 4.1 to 4.4:1, the wordmark that holds Contribute 2.4:1, census panel body 3.4:1, muted text 2.2:1. One cause: `--pill-opacity: 0.85` fades the text with the face. Everything passes over a dark basemap; the chrome was tuned before the July ruling made the light backdrop the default.
2. The wordmark is the smallest and faintest control on the page and is hidden under 640 px, which also hides every contribute route on phones.
3. Seventeen font sizes with the scale inverted: entry points at 12 px, the denomination key at 20 px (22 on phones), the toast at 28 px.
4. Popup action rows at 17 px are larger than the 13 px content they act on, in three visual weights, with two labels for Street View and inline styles in three templates.
5. The attribution is 7 px; the ODbL credit is a licence condition.
6. `--accent` is used as body text; a dead `#hud` block carries two unused tokens.

## 3. The decision set (taken here, per JB's delegation)

One system for the three surfaces. Values chosen to pass AA on white and, for the chrome, over the light basemap, while keeping the existing action blue so no button changes identity.

```css
:root {
  --bg: #f4f6f8;  --panel: #ffffff;  --panel-2: #f3f6f9;
  --ink: #17202a;  --muted: #5b6776;                 /* 5.6:1 on the palest surface */
  --line: #cfd6df;  --control-line: #8c96a5;         /* 3.0:1 boundaries */
  --action: #1f618d;  --action-hover: #17527a;  --action-soft: #e8f1fb;
  --danger: #b42318;  --danger-soft: #fee4e2;
  /* one amber: uncertain, caution, disputed */
  --caution: #6b4e00;  --caution-soft: #fff4dc;  --caution-strong: #9a6700;   /* white on it 4.9:1 */
  --present: #145a32;  --present-soft: #dff3e6;
  --absent: #374151;  --absent-soft: #e5e7eb;
  --not-assessed: #1f4e79;  --not-assessed-soft: #e8f1fb;
  --entry: #0f766e;  --entry-soft: #e6f4f1;          /* nominations and pure entry, containers only */
  --marker-unvalidated: #f59e0b;                     /* jb ruling 2026-09-02; see r-D1 */
  --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --fs-xs: 13px;  --fs-sm: 14px;  --fs-md: 16px;  --fs-lg: 18px;  --fs-xl: 22px;
  --sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px;  --sp-4: 16px;  --sp-5: 24px;
  --r-sm: 6px;  --r-md: 12px;  --r-lg: 16px;  --r-pill: 999px;
}
.map-chrome, .maplibregl-popup-content {
  --chrome-face: rgba(15, 23, 42, 0.85);  --chrome-line: rgba(255, 255, 255, 0.16);
  --ink: #f1f5f9;  --muted: #b8c2d0;  --action: #3b82f6;  --caution: #fcd34d;
  --fs-chrome: 14px;  --fs-chrome-lg: 16px;
}
```

Decisions folded into that block, with the reasoning in one line each:

- **Base text 16 px in the working tools**, 14 px for meta and pills, nothing under 13 px, SVG annotations 11 px minimum. RAs read the task brief for hours; 13 px is a caption size.
- **Labels 600, prose 400.** Bold becomes the exception again, so titles lead.
- **One amber.** Uncertain, caution and disputed share the pair; priority leaves colour entirely and becomes a word in the task row's meta line (the red-green priority dot beside a green present pill is indistinguishable for protan readers).
- **One blue.** The action blue for buttons, links, focus and the validated ring; headings in ink, not blue; the not-assessed fill becomes hollow white with a grey border so a validated not-assessed site is no longer a blue dot in a blue ring.
- **One legend on the RA map**, fills first (present, absent, unknown, your nomination), rings second (validated, validated absent, disputed, in review), then the unvalidated dot; the same words as the status pills. The sidebar pill legend goes.
- **One primary per row.** Submit for review filled; Save draft outlined; Submit unresolved note as a text link; attachment "Open" buttons outlined and small. Review portal: Confirm primary blue, Override outlined, Reject outlined red, the reject form's submit filled red.
- **Disabled controls keep their text readable**: grey face and muted ink, never opacity.
- **The secondary button idiom is the outline** (the RA portal's), on both tools.
- **Chrome: `--pill-opacity: 1` with the face at 0.85 alpha.** That single change lifts every pill from 4.1 to over 9:1 over the light basemap. The wordmark grows to 14 px at full ink. The legend drops to 14 px, the popup actions to 14 px, the attribution to 10 px. One radius per class (6, 12, 16, 999).
- **Font: the system stack everywhere**, declared once, so the three surfaces agree; the unlinked Inter and Work Sans declarations go. Loading a web font is a taste decision that costs a request on every page and buys little at these sizes.
- **One heading style and one workflow numbering** in the RA portal (the chip names copied from the section headings).
- **Sidebar `minmax(360px, 440px)` with one-column field grids** except short pairs (date plus precision), so 16 px inputs stop wrapping their labels.

## 4. PR-H3, proposed (mechanical first, then the two layout changes)

1. **Tokens and substitution** across `verification.html`, `review.html`, `map-shell.css`, `region-map.css`, `maplibre-flat.css`: introduce the block above, replace literals by the mapping tables in the audits (about 120 → 25 values on the RA portal). Sed-able; no behaviour change; screenshot diff before and after.
2. **Type and weight pass**: base 16 px in the tools, the four small sizes retired, labels 600, prose 400, the chrome scale.
3. **Buttons**: the primary-per-row rule and the review decision colours (needs template edits in `verification-map.js` and `review-portal.js`).
4. **Markers and legend**: hollow not-assessed, priority as a word, one legend (`verification-map.js`; the fill and ring constants).
5. **Chrome contrast**: `--pill-opacity`, the wordmark, the attribution, the partial-layer tag, the dead `#hud` block.
6. **Layout**: sidebar width and one-column grids; the review portal's `h2`/`h3` scale; hover and focus styles on the review portal.

Sequence after #78 and #79 merge (they touch the same files). Each step is its own commit with a before-and-after screenshot in `.private/screens-<date>/`; the guide screenshots are recaptured once at the end.

## 5. Rulings for JB (policy, not taste)

- **R-D1 the unvalidated dot's colour.** Amber `#f59e0b` was ruled on 2026-09-02, and today "unvalidated" became the name for nearly every place on the map. Under the one-amber decision, amber also means disputed, and hundreds of unvalidated dots then share a hue with a handful of disputed rings. Recommendation: the unvalidated dot goes to a small slate disc (`#64748b`) with a white halo, and amber is left to mean "needs attention". This overrides a ruling, so it is JB's to make.
- **R-D2 Contribute on phones.** The 2026-07-16 ruling hides the wordmark under 640 px, which now also hides every contribute route. Recommendation: Contribute takes a seat in the bottom action row on phones (beside Search, Near Me, Data Maps); the OSM editor route is dropped there (iD does not work on phones) and only the portal route shows.
- **R-D3 the Review boundary panel.** The standing reviewer instructions cost 120 px of every reviewer's sidebar. Recommendation: fold them into a `<details>` that opens on first visit and stays closed after.

Everything else in sections 3 and 4 proceeds without a ruling unless JB objects.
