# Pin-to-portal nomination brief (2026-10-15)

Status: DESIGN, awaiting review. Joseph B proposed the idea on 2026-10-15 and ruled the same day on the five questions recorded in section 4 and on the review class in section 7. The design precedes any code. Under AGENTS.md, this brief needs a routine review and a reserved-model review before it merges, and the implementation follows in a separate pull request.

## 1. The problem

A research assistant (RA) browsing religionmap.org who notices a missing place of worship must leave the map they are looking at, open the contributor portal, find the same spot again, and start a nomination there. The public map already holds the spot: a right-click, or a press-and-hold on a phone, drops an amber planning pin at it. Today that pin serves only to measure distances. Here, we let the pin start a nomination in the portal at the pin's position, while the pin continues to measure.

## 2. What exists

Three existing pieces carry most of the design.

The first piece is the planning pin in `apps/regions/_shared/region-map.js`, shared by the global map and every country page. A right-click, a press-and-hold, or a precise address search drops a draggable amber pin; while the pin is down, popups give distances and walking directions from it. A click or tap on the pin removes it.

The second piece is the public map's hand-off to the portal. Each place's popup carries "Revise this place", a link to `apps/regions/nz/verification.html?country=xx&revise=1&lat=..&lng=..` with the place's name and OSM identity. The portal parses the link in `deepLinkContextFromParams`, holds it as `pendingDeepLink` while the visitor signs in, names the place on the sign-in card, and opens the revise card through `applyPendingDeepLink` once a contributor is signed in. Sign-in uses Google Identity Services within the page, which stays loaded, and the link's parameters survive sign-in.

The third piece is the portal's own nomination flow. `enterPinMode` opens an entry, `placePin` drops a draggable pin, and the RA drags the pin onto the building, zooms to at least `PIN_MIN_PLACEMENT_ZOOM` (15), and confirms the location. After confirmation, the portal lists existing tasks within the proximity radius and asks whether the pin marks one of them, before the entry form opens. The portal also keeps an unfinished pin entry on the device and resumes it after a reload (`resumeRapidPinFromDevice`).

## 3. The design

The design adds a third hand-off mode, `nominate`, beside `revise` and `report_issue`. The public map builds the link; the portal opens its existing nomination flow at the linked point. All entry, proximity checking and review stay in the portal, as AGENTS.md requires: a nomination is a provisional claim, and the public map writes nothing.

### 3.1 The pin card on the public map

The pin card gives the pin a second use and keeps its first. We make five changes in `region-map.js`.

1. **Dropping the pin is unchanged.** A right-click, a press-and-hold, or a precise address search drops the pin, and distances and directions are measured from it.
2. **A click or tap on the pin opens a small card at the pin.** The card shows the pin's coordinates to five decimal places, a link labelled **Nominate missing PoW here**, and a **Remove pin** button. Escape, a click on the map, or a drag of the pin closes the card. After a drag, the card's link carries the new position.
3. **The card stays closed when the pin drops.** Most visitors use the pin to measure, and a card on every drop would cover the map. The hint shown on dropping changes from "tap it to remove" to "tap it for options".
4. **The link names the country as the revise link does.** On a country page, the link uses the page's country. On the global map, it uses the country under the point (the page manifest, then the world outlines). Over the sea, or where no country resolves, the card shows only the coordinates and **Remove pin**.
5. **One function builds both links.** The link is `…/nz/verification.html?country=<code>&nominate=1&lat=<6 dp>&lng=<6 dp>`. `portalReviseHref` becomes a shared builder that takes the mode as an argument. Pages whose configuration names their own portal therefore receive nominations there too.

The card leaves the public page's security as it stands. The card's DOM nodes hold only numbers and fixed text. The link is a same-origin navigation, which the content security policy already allows; the version stamp on `region-map.js` and the restamped page hashes are the policy's only changes. The sign-in token stays with the portal.

### 3.2 The portal's handling of the link

The portal treats a nominate link as a held request to open its nomination flow at a point. We make six changes in `apps/regions/nz/js/verification-map.js`.

1. **The parser learns the mode.** `deepLinkContextFromParams` returns `mode: "nominate"` for `nominate=1` with a valid `lat` and `lng`. The link carries only the point, since the place is unrecorded. A nominate link with invalid coordinates opens add places with a note that the link's location was unusable, and the RA drops the pin by hand.
2. **Sign-in holds the link.** The constructor keeps a nominate link as `pendingDeepLink`, as it keeps a revise link. Signed out, the sign-in card reads: "Sign in to nominate the place at the pin (−41.28650, 174.77620); it opens here after sign-in." Sign-in and the access check stay as they are. Access still comes only from an RA account: a visitor without one stops at sign-in, as on the portal's front page.
3. **After sign-in, the pin opens unconfirmed.** `applyPendingDeepLink` gains a nominate branch. It switches to add places, centres the map on the point at zoom `PIN_MIN_PLACEMENT_ZOOM` or above, calls `enterPinMode`, and calls `placePin` at the point. The status line asks the RA to drag the pin onto the building and confirm. The pin from the public map may have been dropped at a coarse zoom, and the RA therefore confirms the position before the proximity check runs, as for any nomination.
4. **An unfinished entry on the device comes first.** When the device holds an unfinished pin entry, that entry resumes as it does today, and the portal sets the link's point aside. A notice names the point and offers **Discard my unfinished entry and nominate at the map pin**; the button asks for confirmation before anything is discarded. The rule prevents an ordering hazard. Today `applyPendingDeepLink` runs before `resumeRapidPinFromDevice`, and the resume returns early once pin mode is open; a link applied first would therefore displace the saved work. The decision among the three states (saved entry, held link, neither) sits in a pure function that the tests call directly.
5. **A link is applied once.** After the nominate branch runs, `history.replaceState` removes `nominate`, `lat` and `lng` from the address. A reload then resumes the saved entry in place of a second entry. Revise links keep their current behaviour.
6. **The nomination records its route.** The nomination's `clientContext` gains `entry_route: "public_map_pin"` when the entry began from a nominate link. The backend accepts `clientContext` as a free-form object within a size limit; the tag therefore leaves Convex as it is, and it lets us count how often RAs use the new link.

The rest of the flow is the portal's existing behaviour. The entry form is whichever form the country already uses. The entry follows the pin's country, and a link that named the wrong country therefore corrects itself once the pin is placed. The nomination goes through the existing submission mutation and its rate limits. Convex functions, schema and deployment stay as they are.

## 4. Rulings recorded

Joseph B ruled on five questions on 2026-10-15.

1. **Who may nominate from the pin:** signed-in RAs only. Every visitor sees the action, and the portal's existing sign-in gate applies. The public tip lane in the contributor-access ruling is a separate piece of work.
2. **The measuring pin stays.** The pin keeps measuring, and the card adds the nomination action beside **Remove pin**.
3. **The card stays closed on drop.**
4. **An unfinished entry saved on the device comes before a held link**, and is discarded only on the RA's confirmed choice.
5. **The hand-off is a link with a new mode** (section 3), chosen over two alternatives. Passing the point through `sessionStorage` would fail across tabs and duplicate the link mechanism. A nomination form on the public map would load sign-in and backend code on every public page, against the content security policy work of 2026-10-15, and would create an entry route outside the portal.

## 5. Files

The implementation pull request touches these files:

- `apps/regions/_shared/region-map.js`: the pin card, the shared link builder, the drop hint.
- `apps/shared/map-shell.css`: the card's styles.
- `apps/regions/nz/js/verification-map.js`: the parser, the held link, the nominate branch, the precedence rule, `replaceState`, the `clientContext` tag.
- The version stamps on every page that loads either script, and the policy hashes restamped by `scripts/stamp_csp.mjs`.
- Tests (section 6), `apps/guides/ra.html` (one line on the new route) and `CHANGELOG.md`.

## 6. Tests

Node tests run in CI for four units.

1. **The parser:** a nominate link with valid coordinates; missing or out-of-range coordinates; revise and report-issue links unchanged. These cases extend `apps/regions/nz/js/deep-link-context.test.cjs`.
2. **The link builder:** the page's own country; the country under the point on the global map; no country over the sea; a portal named in a page's configuration.
3. **The precedence rule:** each combination of saved entry and held link, including a check that a saved entry is discarded only after the RA confirms.
4. **The card:** built from DOM nodes, with its text set through `textContent`.

Browser checks run in headless Chromium with the working tree routed under `https://religionmap.org`, and the live content security policy therefore applies, as in the policy checks of 2026-10-15. We require zero policy violations and a passing `scripts/stamp_csp.mjs --check`. On the public map, the checks cover a right-click, the card, the card's link, the link after a drag, a press-and-hold and a tap in phone emulation, and pins on a country page, on the global map and at sea. In the portal, the checks cover the signed-out sign-in card, and then, signed in against an isolated local Convex backend so that nothing reaches the live database, the unconfirmed pin, the proximity check, confirmation, a submitted nomination carrying the `entry_route` tag, the saved-entry rule, and a reload after the link has been applied.

## 7. Review and delivery

The work ships in two pull requests. The first carries this brief, with a routine review and a reserved-model review under AGENTS.md. The second carries the implementation after the brief merges, with a routine review of its final head. The implementation changes the step that holds a link through sign-in and leaves sign-in and authorisation as they are; Joseph B ruled on 2026-10-15 that the change is outside the security-sensitive class, so the routine review suffices. Both pull requests are reviewed by Anthropic models (Joseph B, 2026-10-15): Claude Sonnet 5.5 at high effort for routine review, and Claude Fable 5.1 for the reserved review. The implementation leaves Convex code as it is and therefore needs no backend deployment.

## 8. Scope limits

The design covers RAs with portal accounts. Public tips from visitors without an account belong to the contributor-access lane. The pin card offers nomination only; revising a recorded place stays with the place's own popup. The portal's nomination flow, proximity check and review queue are used as they stand.
