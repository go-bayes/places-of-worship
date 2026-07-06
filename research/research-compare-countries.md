# Global Country Survey: Religious Data Feasibility

> Superseded for country ranking by [country-survey.md](country-survey.md); retained as the earlier grant-aligned screening brief.

This note is a working brief for deciding which countries can support the
places-of-worship portal beyond New Zealand. It should be updated as sources are
verified. Do not treat the current country list as a final ranking.

## Grant-Aligned Question

The grant asks whether the map can become a semi-passive, auditable data
infrastructure for studying places of worship and their surrounding communities
across space and time. Country selection should therefore be driven by what can
be linked reproducibly to mapped sites:

- reliable places-of-worship coverage
- subnational religious affiliation or practice data
- demographic, social, economic, health, charity, conflict, or fertility data
- longitudinal depth
- usable boundary systems
- clear licence and access terms
- plausible local collaborators or validation routes

## Screening Criteria

Classify each candidate country on five dimensions.

1. **Spatial resolution**: national only, region, district, municipality, census
   small area, parish/congregation, or point-level institutional data.
2. **Temporal resolution**: one-off, decennial, annual, panel, administrative
   live register, or historical archive.
3. **Religious construct**: affiliation, attendance, membership, adherents,
   congregations, denomination, practice, belief, or organisation records.
4. **Research linkage**: whether religious data can be joined to place, area,
   census, economic, health, charity, crime, disaster, or migration data.
5. **Access risk**: open download, API, restricted research access, paid
   archive, manual scraping, legal uncertainty, or collaborator-only records.

## Immediate Reference Country

### New Zealand

New Zealand remains the pilot because it combines official boundaries, census
religious affiliation, rich public-area data, and an already functioning regional
app. The immediate update is to add 2023 Census religious-affiliation data to the
existing 2013/2018 territorial-authority workflow.

Primary sources to keep in the pipeline:

- Stats NZ 2023 Census religious affiliation metadata:
  <https://datainfoplus.stats.govt.nz/item/nz.govt.stats/f0032908-16db-40de-b543-a41ac1dda574>
- Figure.NZ extract from Stats NZ for religious affiliation by territorial
  authority, 2013, 2018, and 2023:
  <https://figure.nz/table/ITPm3h6kNu9LqEZt>
- Stats NZ API portal for future direct extraction:
  <https://portal.apis.stats.govt.nz/>

Open issue: the browser app currently treats 2018 as the fixed overlay year in
several places. After the 2023 data are added, the interface needs a year
selector or a documented rule for latest-year display.

## High-Priority Country Leads

### United States

Strong for mapped religious infrastructure and county-level estimates. It lacks
official census religion data, so the useful sources are non-governmental.

- U.S. Religion Census: decennial county-level congregations, members,
  adherents, and attendance for participating religious bodies:
  <https://www.usreligioncensus.org/>
- PRRI American Values Atlas: large annual surveys and county-level small-area
  estimates of religious identity and diversity:
  <https://prri.org/research/census-2023-american-religion/>
- Pew Religious Landscape Study: detailed affiliation, belief, and practice
  data for states and large metropolitan areas:
  <https://www.pewresearch.org/about-the-religious-landscape-study/>
- Yale American Religious History databases guide, including ARDA:
  <https://guides.library.yale.edu/americanreligion/databases>

Best use: county-level institutional density, diversity, and identity overlays.
Main risk: institutional data and survey estimates measure different constructs.

### United Kingdom

Strong for official census religion and small-area geography, especially England
and Wales. Scotland and Northern Ireland need separate extraction checks.

- ONS Census 2021 religion bulletin and datasets:
  <https://www.ons.gov.uk/peoplepopulationandcommunity/culturalidentity/religion/bulletins/religionenglandandwales/census2021>
- Understanding Society may be useful for individual-level longitudinal
  religion and wellbeing analyses, subject to access controls:
  <https://www.understandingsociety.ac.uk/>

Best use: small-area affiliation overlays and longitudinal area comparison from
2001, 2011, and 2021 where boundaries can be harmonised.
Main risk: census religion is voluntary and measures affiliation rather than
attendance or belief.

### Switzerland

Strong for long-run affiliation, annual structural survey data, and formal
church-tax membership. It is useful for studying divergence between legal
membership, affiliation, and practice.

- Swiss Federal Statistical Office release on no religious affiliation becoming
  the largest group:
  <https://www.eid.admin.ch/en/nsb?id=99816>
- FORS Swiss Household Panel for individual longitudinal measures:
  <https://forscenter.ch/projects/swiss-household-panel/>

Best use: longitudinal affiliation and institutional-membership comparison.
Main risk: subnational access and harmonisation across cantons need checking.

### Germany

Strong for formal church membership, exits, sacraments, and institutional
records through the church-tax system.

- Protestant EKD membership statistics:
  <https://www.ekd.de/statistik-kirchenmitglieder-17279.htm>
- German Bishops' Conference Catholic church statistics:
  <https://www.dbk.de/presse/kirchenstatistik-2024>

Best use: formal membership, exits, sacraments, and regional institutional
change.
Main risk: Catholic and Protestant records do not cover all religious groups.

### Poland

Strong for Catholic attendance and sacramental practice through the Institute
for Catholic Church Statistics.

- Institute for Catholic Church Statistics:
  <https://iskk.pl/>
- e-Dominicantes annual parish count workflow:
  <https://iskk.pl/dominicantes/>

Best use: annual religious practice measures, especially dominicantes and
communicantes.
Main risk: Catholic institutional data are strong, but minority religions and
non-affiliation require separate sources.

## Second-Round Candidates

These countries may be valuable, but each needs a short source audit before
being promoted.

- **Australia**: census religion, stable statistical geographies, rich area data.
- **Canada**: census religion and detailed local geographies, with privacy and
  access constraints to check.
- **Ireland**: census religion, parishes, and longitudinal census comparisons.
- **Netherlands**: strong administrative and survey data, but church membership
  and religion measures may require careful source reconciliation.
- **Brazil**: census religion and rich municipality-level social indicators.
- **South Africa**: census religion and subnational socioeconomic data, but
  boundary and comparability checks are required.
- **India**: census religion has high potential for area-level analysis, but
  access, sensitivity, and boundary harmonisation need careful handling.
- **Vanuatu and Pacific partners**: grant-relevant, likely collaborator-driven,
  and important for community data collection. Vanuatu is now an active
  source-first case; see `vanuatu-case-analysis.md`. The first protocol uses
  1989, 1999, 2009, and 2020 census-linked target years, while preserving
  lifecycle evidence from 1600 onward.
- **Bahamas and Atlanta, Georgia**: grant-relevant validation and outreach sites.
  Atlanta can use U.S. county/metropolitan data; the Bahamas needs a national
  source and collaborator audit.

## Cross-Country Source Hubs

- ARDA, for survey archives, national profiles, maps, tables, and reports:
  <https://www.thearda.com/>
- geoBoundaries, for open administrative boundaries where official national
  sources are unavailable or difficult to harmonise:
  <https://www.geoboundaries.org/>
- WorldPop, for gridded population and demographic covariates:
  <https://www.worldpop.org/datacatalog/>
- Global Human Settlement Layer, for settlement, built-up area, and population
  surfaces:
  <https://joint-research-centre.ec.europa.eu/scientific-tools-and-databases-0/global-human-settlement-layer-tools_en>
- ohsome API, for OpenStreetMap history and temporal coverage diagnostics:
  <https://wiki.openstreetmap.org/wiki/Ohsome_API>

## Next Research Tasks

1. Build a country-source matrix with one row per country and columns for
   religious data, covariates, boundaries, time coverage, access, licence, and
   map visualisation potential.
2. For each high-priority country, identify the smallest area unit that can be
   legally and reproducibly linked to places of worship.
3. Separate constructs before comparison: mapped site, congregation, member,
   adherent, attendee, religious affiliation, and belief are not interchangeable.
4. For each candidate country, define one feasible first visualisation:
   choropleth, site density per population, religious diversity, site change,
   or data-quality/coverage layer.
5. Record shifts from the grant plan explicitly: why a country, source, or
   construct was added, delayed, or dropped.
