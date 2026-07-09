# Per-country overview page

Every country map's onboarding banner promises more than the map can
say: where the data come from, what the shading means, what the map
does not show, and how to get the underlying data. Today those answers
live in the research cards (`research/countries/<cc>/README.md`) and
the manifests — repo files a public visitor never finds. The overview
page is the public rendering of that record: one page per country, at
`apps/regions/<cc>/overview.html`, linked from the onboarding banner.

## Design principles

1. **The page renders the record; it does not author claims.** Every
   fact on the overview — waves, sources, licences, caveats — is
   copied from the country card, the manifest, or the live
   `REGION_CONFIG`. Where the card marks something pending (a licence
   reply, a boundary correspondence), the overview says pending in the
   same words. Nothing appears on the overview that the repo record
   cannot back.
2. **One runtime, thin pages** — the region-map idiom
   (`docs/development/regional-map-consistency.md`) applies unchanged.
   A country overview is `window.OVERVIEW_CONFIG` plus two shared
   assets; nothing is forked.
3. **A document, not a map shell.** The page is a readable single
   column in the project's dark-slate voice (tokens from
   `apps/shared/map-shell.css`, layout kin to the Data-maps hub
   `apps/regions/index.html`), `min(720px, 94vw)` wide. No floating
   pills, no map.
4. **The map stays one click away.** "Open the map" is the first
   action on the page, styled as the primary button per
   `docs/ui-style-guide.md`.

## Architecture

- `apps/regions/_shared/overview.js` — renders the page from
  `window.OVERVIEW_CONFIG`; sections with no config entry collapse
  rather than render empty.
- `apps/regions/_shared/overview.css` — loaded after
  `map-shell.css`; document typography and section chrome only.
- `apps/regions/<cc>/overview.html` — thin loader: inline
  `OVERVIEW_CONFIG`, the two shared assets with `?v=` cache-bust tags
  matching the current shared-asset tag discipline.

## Config surface (all of it)

- `countryCode`, `countryName`, `mapHref` (normally `"./"`)
- `intro` — one paragraph: what the map shows, in the onboarding
  banner's register but with room to breathe.
- `facts` — the at-a-glance strip: `waves` (e.g. "Censuses 2013, 2018,
  2023"), `geographies` (level labels from `censusLevels`),
  `metrics` (the metric labels the map actually offers),
  `placeDots` (one line naming OSM as the dot source).
- `sources` — array of `{ name, href, construct, years, licence }`,
  rendered as the "Data sources and licences" table; rows come from
  the country card's "Religious data over time" table, restricted to
  sources the live map uses, plus the boundary source.
- `reading` — "How to read this map": bullets carrying the
  denominator note (`popupDenominatorNote`), the category construct,
  the suppression/flag rule (`censusFlagNote`), and boundary-vintage
  caveats. This is the honesty section; it is required, not optional.
- `accessData` — mirrors the card's "Access the data yourself"
  section: `sourceOfRecord` (HTML), `tables`, `licence`,
  `script` (repo path, linked to GitHub), `manifests`
  (`[{ label, href }]` into `docs/manifests/` on GitHub).
- `contribute` — links: Submit evidence (`verification.html`), Review
  evidence (`review.html`), fix OSM, project GitHub. Countries whose
  portals are pending omit the portal links and the section says so.
- `footerLinks` — Data maps hub (`../`), Global map
  (`../../global/`), the country card on GitHub.

## Section order

Header (country name, "research map overview", Open-the-map button) →
intro → facts strip → How to read this map → Data sources and
licences → Get the data yourself → Contribute → footer. The reading
section outranks the sources table because a visitor who reads only
one section should read the one that prevents misreading.

## Linking

- `onboarding.links` in each country's `REGION_CONFIG` gains
  `{ label: "About this map", href: "overview.html" }` as the FIRST
  link — the banner is the page's front door.
- The wordmark pill gains nothing: it is already at its crowding
  limit (the 2026-07-09 data-pill overlap), and the onboarding banner
  is where a new visitor looks first.
- The Data-maps hub cards stay single-link; the overview links back
  to the hub in its footer.

## Implementation steps

1. Shared runtime and stylesheet, rendering the config surface above.
2. NZ first as the reference page, authored from
   `research/countries/nz/README.md` + `survey.md` and the live
   `REGION_CONFIG`; verify against the checklist below.
3. Remaining live countries, one config each, authored from their
   cards; countries with thin cards get honest thin pages.
4. Onboarding-link addition across all live country configs, with a
   fresh `?v=` tag wherever a shared asset changed.

## Verification checklist

- Page loads with no console errors at 1280px and 375px.
- Every href resolves (map, portals, hub, global, GitHub paths).
- Every licence line matches the manifest's `licence_position` or the
  card's licence column — diff by eye per country.
- The reading section states the denominator and the suppression rule
  where the map's popups do.
- A country with pending items (US licence reply) says pending in the
  card's words.
