# Design review: the country-aware broadcast pill (2026-07-16)

Four independent reviewers (the "tribunal") examined the uncommitted country-broadcast prototype on `feat/datamaps-pill`: three Claude Fable agents — interaction and semantics (A), architecture, correctness and performance (B), adversarial user journeys (C) — and one OpenAI Codex `gpt-5.6-sol` instance at high reasoning effort (D), unanchored. This memo synthesises their reports into decisions.

## The prototype under review

The owner's request: the Switch Country pill becomes country-aware — over New Zealand it broadcasts New Zealand, over Australia it broadcasts Australia, tracking as the user moves; too far out it prints "zoom for country data"; the potential selection appears both in the button and as a green layer across the territory, so the user can click without reading; the more (visual) telemetry the better.

As built: on country pages the pill broadcasts the neighbour under the centre ("Australia →", emerald) with an emerald territory fill; one tap navigates, census view carried; the handoff pill keeps only return offers. On the global map the pill has three states: idle (panel trigger), hint ("Zoom for Country Data"), broadcast (navigates with the camera).

## The central verdict: keep the behaviour, move it off the switcher pill

All four reviewers accept the tracking-broadcast-plus-green-layer experience and reject its housing. One anchor that is sometimes a menu trigger, sometimes a navigation offer, and sometimes an instruction destroys its learned identity, leaves stale link and ARIA semantics (cmd-click on "Australia →" opens the hub; screen readers hear "has popup, collapsed" on a link that navigates), and locks the country panel away exactly where it is most needed. The remedies split two ways, and the tribunal disagrees:

- **A (interaction)** would keep one pill, split internally: the main zone broadcasts and navigates; a persistent caret zone always opens the panel; long-press as a hatch.
- **D (Codex)** would reject the mode-switching pill outright: a stable Switch Country button that always opens the panel, plus one separate contextual travel control that owns both directions — "Open Australia data →" and "Back to New Zealand →" — in a consistent seat.

The synthesis this memo recommends is D's shape built from parts that already exist: the emerald handoff pill *is* the contextual travel control. Rather than moving its offer onto the switcher pill (as prototyped), keep the switcher pill stable and give the handoff pill the new powers — the tracking broadcast, the green territory layer, the census carry (which it already has), and a seat on the global map (which it currently lacks). The handoff pill has already solved the problems the prototype reintroduced: `aria-live`, max-width with ellipsis, and established emerald "go" semantics. The hint state ("Zoom for Australia data" — named, per A's cheapest-telemetry-win finding) rides the same travel pill, dimmed, rather than mutating the switcher.

## Defects that must be fixed in any shape

1. **Duplicated resolver already diverges (B, D).** The global copy of the resolution helpers picks a different country than the regional logic at 1,761 points on a 0.5° world grid (measured), because its `smallestAt` skips the containment test. Extract one shared module (`apps/shared/region-resolve.js`: normalise, boxContains(margin), pointInRings, smallestContainingAt, resolveAt) used by both surfaces, with border, enclave, antimeridian, and multi-box tests.
2. **Enclaves glow brightest (B, D).** Flat rings rendered as independent polygons double-paint holes: Lesotho renders at 0.26 opacity inside South Africa's 0.14 — the one territory that is *not* offered glows most. Fix at manifest-generation time by nesting hole rings into their containers (MultiPolygon per region).
3. **Manifest cost on the global page (B, D).** 221 KB gzip on every global visit, re-validated with `no-cache`, where resolution needs a 3 KB boxes-only slice. Split the manifest: boxes at arm time, rings on first resolve.
4. **Layer order and colour honesty (A, D).** The fill currently paints above dots and labels, reversing the runtime's deliberate choropleth-below-points order, and tints the census blues. Insert beneath symbol layers, add a 1 px emerald outline; on census pages prefer outline-only so the choropleth's values stay unmodified — the fill is for the global map, where no data layer competes.
5. **Link and ARIA contract (A, C, D).** While offering, the control's `href` must be the destination (fixes cmd-click, middle-click, copy-link, and no-JS in one move), `aria-haspopup`/`aria-expanded` must not claim a popup, the accessible name must name the destination, and changes announce politely.
6. **State machine seams (B, C).** Theme switches silently drop the global fill (re-assert on styledata); programmatic camera nudges clear tap-armed offers (gate clearing on real movement); tapping home should clear what tapping a neighbour armed; a stale-label race at arrival argues for capturing saved labels at arm time.
7. **Mobile discipline (A, C).** Long names ("Saint Vincent and the Grenadines →") need the handoff pill's max-width and ellipsis; the long/short label swap must survive; changed CSS needs its cache pin bumped.

## Copy decisions

Long form "Continue into Australia →", short form "Australia →" (the existing label-swap pattern); hint "Zoom for Australia data", naming the resolved country. Non-manifest countries stay idle — never hint where zooming yields nothing (A, confirmed C).

## Telemetry

The tribunal reads "the more telemetry the better" as richer *visible* state, and finds the current set close to complete: the named hint and the territory outline earn their place; pulses and on-map name labels are noise (A). Usage analytics is a separate proposal: only for a defined evaluation question, coarse first-party events, and never precise centres, coordinates, searches, or movement histories (D) — parked pending the owner's intent.

## What the tribunal found sound

Broadcast/handoff exclusivity in every branch; the census-view carry (verified on Pulotu-default vu and timeline us: metric gate, nearest-wave clamp, never force-enables); per-moveend ray-cast cost (worst case ≈28.5k edge tests, under 1 ms — the bbox prefilter suffices); failure paths (manifest fetch failure leaves a fully functional panel trigger); script-order claim of the click (verified on all 102 pages, to be encoded properly by the extraction).

## Decisions (JB, 2026-07-16)

1. **Shape: the travel pill.** The switcher pill keeps its identity everywhere; the emerald handoff pill is the one contextual travel control, now with the tracking broadcast, the territory highlight, and a seat on the global map.
2. **Analytics: parked.** Visible-state telemetry only, pending a defined evaluation question.

## Implementation record (same day)

The travel-pill shape shipped with the tribunal's fixes:

- One resolver (`apps/shared/region-resolve.js`) now serves both surfaces — normalise, containment with margin, ray cast, smallest-*containing*-box pick, and home-aware `resolveAt` — retiring the divergent global copy (B's 1,761-point finding). Ring nesting (`nestRings`/`regionFeature`) builds proper MultiPolygon topology at runtime with a per-region cache, so enclaves such as Lesotho and San Marino no longer double-paint (B's finding 3 fixed in the renderer rather than the generator; a generator-side fix remains open).
- The travel pill is an anchor whose `href` carries the real destination — country, camera, origin, and census view — so modified clicks, middle clicks, and copied links are honest (A/C/D). It announces via its existing `aria-live`; the home offer drops the `href` and takes `role="button"`.
- Copy: "Continue into <Country> →" for offers, "Zoom for <Country> data" for the global hint (named, per A), which on click delivers the promised zoom. Non-manifest countries stay idle.
- The territory highlight sits beneath the place dots (anchored before the dot layers). Country pages draw outline only — no fill over the census choropleth (D's colour-honesty point); the global map draws wash plus outline.
- State seams: tap-armed offers survive programmatic camera nudges and clear on a home/water tap or a real gesture (C); both surfaces re-assert the highlight after a theme switch (B); style-load races retry on styledata with cached geometry.
- Cache pins bumped to `?v=20260716f` (C's stale-CSS finding).

Deferred, recorded as open work: the manifest split (boxes-only ~3 KB for arming, rings on demand — B/D; the global fetch meanwhile uses default HTTP caching instead of `no-cache`), generator-side ring nesting, and D's suggestion of a "countries in view" affordance inside the switcher panel at low zoom.
