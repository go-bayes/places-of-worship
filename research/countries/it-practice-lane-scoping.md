# Italy practice-lane pilot: scoping

Scoping notes for the ratified practice lane (research/country-survey.md,
"Practice lane"). Italy maps religious *practice* (frequency of attendance at
a place of worship) by region as its own construct. Unlike Poland, whose
pilot rests on an annual full count of Mass attendance (ISKK dominicantes),
the only regional Italian source is a self-reported sample survey: ISTAT's
"Aspetti della vita quotidiana". This document records the sources found,
maps the years and boundary vintage, states the licence positions, sets out
the survey-versus-count construct honesty explicitly against Poland, and
proposes a build sequence. It is a scoping note, not a build; nothing here is
committed to a product.

## Sources found

### ISTAT "Aspetti della vita quotidiana" — religious practice (attendance)

- The Italian National Institute of Statistics (ISTAT) runs the annual
  multipurpose survey "Aspetti della vita quotidiana" (Aspects of Daily
  Life, AVQ), the household survey of the "Vita quotidiana e opinioni dei
  cittadini" theme. It has run annually since 1993 on roughly 20,000
  households and about 45,000 resident individuals.
- The attendance item asks how often the respondent goes to church or another
  place of worship. ISTAT disseminates it as the indicator **"Pratica
  religiosa"** (religious practice), cross-tabulated several ways; the one
  we need is **"Pratica religiosa - regioni e tipo di comune"** (religious
  practice by region and type of municipality). In the legacy I.Stat
  warehouse this was table `QueryId=24349` at dati.istat.it (that host's TLS
  certificate has now expired; the warehouse has migrated to IstatData /
  esploradati.istat.it/databrowser/).
- **Frequency categories.** The headline band is "at least once a week"
  (almeno una volta a settimana) — the practising-attendance measure. The
  full band set is roughly: at least once a week / some times a month
  (qualche volta al mese) / some times a year (qualche volta all'anno) /
  never (mai) / not indicated. Confirm the exact codelist labels from the
  dataflow at build (see API note).
- **Population base.** Persons **aged 6 and over** (the survey's standard
  base for this item). Respondents aged 14+ answer directly; for children
  aged 6-13 a parent answers by proxy. Pin the denominator as resident
  population aged 6+, not total population.
- **Years.** National series runs from 1993; the regional breakdown is a
  designed estimation domain of the survey and is robust across the 2000s to
  the present. A safe pilot span is roughly **2001-present** on the regional
  table (annual). Recent context: weekly attendance fell from about 37% in
  the early series to a historical minimum of 18.8% in 2022.
- **Headline references** (context, not sources of record): Diotallevi's
  analysis of the ISTAT series (1993 -> 2019 decline) and the annual press
  coverage all read straight from this table.

### API route (SDMX REST) — status

- ISTAT exposes IstatData over an SDMX 2.1 REST endpoint at
  **https://esploradati.istat.it/SDMXWS/rest**. The route is live: sample
  data queries follow the pattern
  `https://esploradati.istat.it/SDMXWS/rest/data/IT1,<DATAFLOW>,1.0/all/ALL/?detail=full&dimensionAtObservation=TIME_PERIOD&format=structurespecificdata`
  (confirmed working for published dataflows such as `IT1,POP,1.0`).
- Codelists resolve at `/rest/codelist/IT1/<CL_ID>` and the dataflow list at
  `/rest/dataflow/IT1`. The **exact religious-practice dataflow id is still
  to be confirmed** (the full dataflow list is too large to fetch in one
  call; resolve it in the databrowser UI or by filtering the dataflow list at
  build — the AVQ survey uses the `DCCV_` dataflow prefix).
- **Rate limit:** 5 queries per minute per IP; exceeding it triggers a 1-2
  day block. Batch and cache accordingly.
- Community guidance: the ondata "Guida all'uso delle API REST di ISTAT"
  (https://ondata.github.io/guida-api-istat/) documents the query grammar;
  the R `istat` package (CRAN) wraps the same endpoint.

### Boundaries — Italian regions

- ISTAT publishes **"Confini delle unità amministrative a fini statistici"**
  (administrative-unit boundaries for statistical purposes): three
  administrative levels (regions, provinces, municipalities) plus geographic
  subdivisions, national coverage, in both **generalised** (generalizzati)
  and full-detail versions, shapefile, WGS84 UTM32N.
- Released annually since 2002, referenced to 1 January of each year. The
  2026 vintage sits under
  `https://www.istat.it/storage/cartografia/confini_amministrativi/generalizzati/2026/`;
  the archive landing page is https://www.istat.it/it/archivio/222527 (2024)
  and the theme hub is Territory and cartography on istat.it.
- **Vintage stability.** The **20 regions are stable across the entire AVQ
  series** — no reorganisation analogous to Poland's 1992/2004 diocese
  redraws. (Provincial boundaries did change, e.g. in Sardinia, but the
  region layer is unaffected.) Any single generalised region vintage joins
  cleanly to every attendance year. The generalised version is the right
  choropleth base; the full-detail version is unnecessary at region scale.

### Diocese-level attendance for Italy (parity with Poland) — none public

- There is **no Italian equivalent of ISKK's annual diocese count**. The CEI
  (Conferenza Episcopale Italiana) does not publish a systematic annual
  parish/diocese census of Sunday attendance; the "Annuario delle Diocesi
  d'Italia" carries structural data (parishes, clergy), not attendance
  counts. Catholic-Hierarchy publishes diocese-level *Catholic population*
  estimates (catholic-hierarchy.org/country/scit1.html), which are affiliation
  proxies, not attendance. Diocese-level attendance parity with Poland is not
  achievable from public data; the region-level ISTAT survey is the Italian
  practice measure.

## Construct and denominator (honest description)

The Italian measure is a **self-reported survey estimate**, not a count. This
is the load-bearing difference from Poland and must sit on the card.

- **Construct.** Share of the resident population aged 6+ who report attending
  a place of worship "at least once a week". It is attendance frequency as
  *stated by respondents*, carrying sampling error and the known upward bias
  of self-reported religious attendance (declared attendance exceeds observed
  attendance). It is attendance, its own construct — never affiliation, and
  never a headcount at the door.
- **Denominator.** Resident population aged 6+ (the survey base); the
  published figure is already a percentage, so no separate denominator
  download is needed. State the base as population aged 6+, not "all Catholics"
  and not "the obliged".
- **Difference from Poland, explicitly.** Poland's dominicantes is a *census*
  of persons physically present at Mass on one count Sunday, expressed over
  *obligati* (obliged Catholics). Italy's figure is a *sample survey* of
  *self-reported* weekly attendance over the *resident population aged 6+*.
  Different collection (count vs survey), different denominator (obligati vs
  resident 6+), different error structure (none-from-count vs sampling error
  plus self-report bias). The two national numbers must never be placed on the
  same axis or compared directly; if both ship, label each with its method and
  denominator on the card.
- **Uncertainty.** Because regional estimates are a designed domain, ISTAT
  reports relative sampling errors by region in the survey's annual "Nota
  metodologica" (methodological note, one per year on istat.it). The pilot
  should carry the regional estimate *with* its sampling error / confidence
  band from that note rather than presenting a bare point estimate; confirm at
  build whether the note gives per-region relative errors for the attendance
  item specifically or only for the survey's principal estimates.

## Licence positions

- **ISTAT data (attendance figures).** Creative Commons Attribution 4.0
  International (CC BY 4.0), per the current ISTAT legal notice
  (https://www.istat.it/en/legal-notice/). Reuse, including commercial and
  adaptation, is permitted with attribution and a note of any changes.
  Attribute as "Source: ISTAT, Aspetti della vita quotidiana, <year>".
- **ISTAT boundaries.** Released under Creative Commons Attribution; the
  boundary archive historically carried CC BY 3.0 IT, while ISTAT's
  institutional policy is now CC BY 4.0. Confirm the exact statement on the
  boundary archive page at build and attribute "Source: ISTAT, confini delle
  unità amministrative a fini statistici".
- No microdata are required: the region-level percentages are public
  aggregate output. ISTAT research microdata (e.g. via UniData) are
  fee/registration-gated and out of scope.

## Open questions for the PI

1. Pilot span: adopt roughly 2001-present on the regional table, or a shorter
   recent window (e.g. 2014-present) for cleaner comparability?
2. Headline metric: ship the single "at least once a week" band, or show the
   full frequency distribution (weekly / monthly / yearly / never) per region?
3. Uncertainty display: carry the regional sampling error / confidence band
   from the annual Nota metodologica on the card, or ship point estimates with
   a standing "survey estimate" caveat?
4. Given no diocese data exist, confirm the Italian practice lane ships at
   **region level only** (no diocese parity with Poland is possible).
5. Any wish to add an affiliation context layer? Italy has no census religion
   question; affiliation would come from survey/administrative proxies with
   their own caveats — likely out of scope for the pilot.

## Proposed build sequence

1. Resolve the dataflow: locate the "Pratica religiosa - regioni e tipo di
   comune" dataflow id in the IstatData databrowser, read its codelists
   (frequency bands, region, age base, time), and record a working SDMX REST
   query for the region x "at least once a week" x year slice. Respect the
   5-queries/minute limit; cache the raw pull under `data/raw/it_practice/`
   with provenance and hashes per docs/data-storage-pipeline.md.
2. Extract boundaries: download one generalised ISTAT region vintage
   (`.../generalizzati/<year>/`), keep the 20-region layer, simplify, and
   store at `apps/regions/it/data/`. Region geometry joins to every
   attendance year (stable vintage).
3. Build the `area_summary` product per schemas/area_summary.schema.json with
   a distinct `construct` for religious practice (attendance), never
   affiliation; set `metricLabels`/`metricsAvailable` so the rate reads as
   "Weekly attendance at a place of worship (self-reported), % of population
   aged 6+" and set `popupDenominatorNote` to the resident-6+ / self-report
   wording, with a survey-estimate and sampling-error caveat.
4. Join key is the region name/ISTAT region code; build a small concordance
   from the SDMX region codelist to the boundary layer's region code.
5. Write the region page per docs/development/adding-a-region.md; state the
   construct precisely and keep the Poland contrast (count vs survey) off the
   comparison axis.
6. Verify: national ISTAT figure against the population-weighted regional
   mean for a sample year, join coverage 20/20 regions, sampling-error band
   sourced to the Nota metodologica, and every attribution string (ISTAT
   CC BY, boundary CC BY).
