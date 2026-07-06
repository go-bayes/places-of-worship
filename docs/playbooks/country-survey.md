# Playbook: global country survey and build cards

Status: READY (not started; a prior in-session run was lost before results landed)
Task: #3 (+ feeds #4). Effort: parallelisable — one cheap agent per
region, one synthesis sitting. Needs web access.

## Goal

Screen every country for PUBLIC data on religion/churches over time
usable for subnational mapping; produce one build card per feasible
country at `research/countries/<iso2>/README.md` — one directory per
country, extra notes alongside the card (JB convention, 2026-07-06) —
following `research/countries/TEMPLATE.md` exactly; produce a global
matrix at `research/country-survey.md`. Consistent method and look across all
cards is the point — do not vary the template.

## Method (per region agent)

Regions: (1) Pacific incl. Timor-Leste; (2) NZ/AU/UK[E&W, Scotland, NI
separately]/IE/CA/US; (3) Western+Northern Europe; (4) Central+Eastern
Europe incl. Caucasus; (5) Latin America + Caribbean; (6) Asia + Middle
East; (7) Africa; (8) cross-cutting hubs (IPUMS International religion
variables, ARDA, World Religion Database, Pew, DHS/MICS, UNSD census
hub, geoBoundaries, ohsome OSM coverage).

For each country, verify with real web lookups (never from memory):

- construct(s): census affiliation | church-tax/administrative
  membership | attendance counts | congregation directories | survey.
  Never merge constructs; name each.
- smallest spatial unit with PUBLIC tables; the actual years/waves
  (include the 2020–2024 round; note historical censuses and how far
  back religion questions go — deep pasts matter to this project);
- sources with URLs, format (API/CSV/XLSX/PDF-only/web table), access,
  licence; boundary availability (official open files or geoBoundaries
  ADM level);
- one feasible first visualisation; risks (comparability breaks,
  suppression, boundary changes, sensitivity, PDF-locked tables).

Tiering: **A** = multi-wave subnational religion data, open access,
usable boundaries (buildable now). **B** = feasible with extraction work
(PDF-only counts as B — the project has RA and agent capacity; Vanuatu
was B and is now live). **C** = single wave, national-only with no
subnational route, or inaccessible — write a 3-line card anyway so the
exclusion is documented.

Verification pass: for each tier-A claim, a second lookup must confirm
the strongest claim (the actual table downloadable at the stated unit
and years) before the card says A. Record the verification URL on the
card's Last verified line.

## Steps

1. Read `research/research-compare-countries.md` (prior leads, grant
   framing, screening criteria) and `research/vanuatu-case-analysis.md`.
2. Run region agents (or sittings) producing draft cards directly in the
   template format. Keep each card ≤1 page; put source rows in the
   table, not prose.
3. Synthesis sitting: write `research/country-survey.md` — a matrix (one
   row per country: tier, construct, smallest unit, waves, access,
   licence, boundary source, first visualisation) sorted tier-then-region,
   plus a short "what is missing" section naming countries the sweep
   could not settle. Mark `research/research-compare-countries.md` as
   superseded by the new files (one-line header note, keep the file).
4. For the top tier plus NZ and VU, extend the card's Build recipe
   section into concrete steps (named source table → extraction route →
   `area_summary` per `docs/development/adding-a-region.md`). The VU
   card documents what is already live (see
   `docs/manifests/vu-census-religion-2009-2020-d17f5596eca1.json`) and
   the print-only 1989/1999 province tables (VBoS Port Vila, SPC Noumea,
   NLA Canberra) as the deep-past route.
5. Fill each card's Deep-history potential section with at least the
   obvious registers/archives named during the sweep; JB direction
   2026-07-04: deep pasts eventually matter for ALL countries, and RA
   value concentrates in sources not online — note physical archives.
6. Link the survey from `README.md` (research portal section) and
   `ROADMAP.md` if a phase mentions country expansion.

## Acceptance checks

- Every country in the region lists has either a card or a row in the
  matrix's exclusions; announced counts match card counts.
- Every tier-A card carries a verification URL and date. No card
  deviates from TEMPLATE.md's headings.

## Budget guidance

This burned heavily as a Fable fan-out. Run region agents as Sonnet
(or the cheapest capable tier) with the prompt template above; expect
~8 agents + 1 synthesis. Do not adversarially multi-vote; the single
verification lookup per tier-A claim is enough.
