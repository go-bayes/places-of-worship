# NZ census religion — wave-extension research notes

Working notes for extending the live 2013/2018/2023 maps backward
(JB directive 2026-07-07: fetch all attainable waves; document what we
learn as we go). Findings land here as they are verified; the card
stays the build spec.

## The three tiers

1. **Machine-readable gap-fill, 1991–2006 (JB-approved build).** The
   1991, 1996, 2001, and 2006 censuses asked religious affiliation and
   Stats NZ published sub-national tables in its statistical systems.
   Territorial authorities exist from 1989, so all four waves can ride
   TA-vintage boundaries. Exact table routes: being pinned (first
   research pass overran; narrower pass running 2026-07-07).
2. **Print-volume era, 1945–1986 (deep-history extraction).** Religious
   profession tables in printed census volumes (for example the 1966
   Census of Population and Dwellings religious-professions volume) at
   county/borough/urban-area geography. Two costs: transcription (the
   VU-1999 pattern — digitise, transcribe, verify per source) and
   boundaries — digital county/borough vintages mostly do not exist,
   so honest mapping needs period-boundary reconstruction. Candidate
   pilot for the workbench evidence pipeline once the portal publishes.
3. **1878–1936 (deepest history).** Religious profession was asked from
   the earliest censuses; volumes are progressively digitised at
   www3.stats.govt.nz/historic_publications/. Same shape as tier 2,
   older sources.

## Construct cautions (all tiers)

- The NZ religion question carries a legal right to object (since the
  1950s): the object-to-state share varies by era and the
  stated-response denominator shifts meaning across waves. Every
  backdated wave needs its own population_total_basis and a
  comparability flag (the runtime's distinguishing-flag pathway now
  supports this cleanly).
- Category schemes changed repeatedly; per-wave construct notes, no
  blended crosswalks without a ruling.

## Verified so far

- (2026-07-07) First research pass failed on scope (codex context
  overflow) before pinning table URLs — lesson: research briefs need a
  fetch budget and a narrow wave range per run.
- (2026-07-07, narrow pass, 15-fetch budget) NEGATIVE within budget for
  machine-readable 1991-2006: the Aotearoa Data Explorer carries
  census religion only for 2013/2018/2023 (RC/TALB/SA2); the old
  NZ.Stat route ("Religious affiliation (total responses) ... 1996,
  2001, 2006, 2013") did not resolve — NZ.Stat is decommissioned and
  these waves apparently did not migrate. 2006 exists as archived
  QuickStats/classification-counts HTML (Wayback links in the research
  log), not as bulk CSV at TA. Datafinder TA boundaries: released
  annually, but digital boundary data became FREE only from 2007-07-01;
  no 1991-2006 TA vintage resolved yet.
- Implication: 1991-2006 is not a quick pipeline item after all — it
  needs either (a) recovery of the old NZ.Stat SDMX dataset
  identifiers (Wayback) with a live API check, (b) the Stats NZ
  archive-site bulk 2001/2006 census table downloads, or (c) a
  customised-data request to Stats NZ. Next narrow pass targets (a)
  and (b).

## Route decision for 1991-2006 (2026-07-07)

Three research passes closed the public routes: the ADE carries only
2013+; no old NZ.Stat dataflow identifier could be recovered (the
DataInfo+ records are metadata identifiers, not SDMX dataflows); the
archived 2006 pages are HTML, not bulk workbooks. The route is a
customised-data request to Stats NZ (JB action). Draft request:

> Subject: Customised data request — census religious affiliation by
> territorial authority, 1991-2006
>
> I am requesting religious-affiliation counts from the 1991, 1996,
> 2001, and 2006 Censuses of Population and Dwellings at territorial
> authority level (regional council as a fallback), for a research
> programme mapping religious change (placesmap.org; Victoria
> University of Wellington). Specifically: (1) total responses by
> top-level religious-affiliation categories per TA per census,
> including no religion, object to answering, and not stated; (2) the
> category classification used in each wave (so we can document breaks
> rather than harmonise silently); (3) the denominator conventions per
> wave (census usually resident population and the treatment of
> non-response); and (4) the matching digital TA boundary vintages, or
> guidance on obtaining pre-2007 vintages. CSV or Excel preferred.
> Please indicate any cost and the licence the extract would carry —
> we publish only derived rates with attribution.

## Open questions

- Exact machine-readable routes for 1991/1996/2001/2006 religion at TA
  (or regional) level, and the earliest downloadable TA boundary
  vintage on datafinder.
- Whether the 1966 religious-professions volume is digitised and at
  which geography its tables sit.
