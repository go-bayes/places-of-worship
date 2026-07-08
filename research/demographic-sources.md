# Demographic data sources register

Purpose: the change-over-time research programme needs denominators and
covariates alongside the religion waves and the places-of-worship
census. This register records candidate demographic sources as we
encounter them during country builds. Recording is the task for now;
extraction pipelines come later, designed against the private repo
(`pow-research`) so that licence-restricted microdata never enters the
public repo.

Rules of the register:

- One row per source per country (or one row for a global source).
- Record the smallest public geography, the wave years, the access
  route (API/CSV/report PDF), and the licence class — the same fields
  the religion survey uses (`research/country-survey.md`).
- Where the religion table itself ships population denominators
  (total-response counts per area), say so: that is the cheapest
  demographic layer and is often already in our extractions.
- Destination: open aggregates may live in the public repo; anything
  licence-restricted (IPUMS microdata, DHS recode files) goes to
  `pow-research` via the GCS bucket lane, never git.

## Global sources

| Source | Content | Smallest unit | Years | Access | Licence class |
| --- | --- | --- | --- | --- | --- |
| UN World Population Prospects | population by age/sex, national | country | 1950-2100 | open CSV/API | CC BY 3.0 IGO |
| WorldPop | gridded population counts/density | ~100 m grid | 2000-2020 | open rasters | CC BY 4.0 |
| GHS-POP (JRC) | gridded population | 100 m / 1 km grid | 1975-2030 (5-yearly) | open rasters | free reuse with attribution |
| IPUMS International | census microdata (age, sex, education, religion where asked) | varies; often district | varies by country | registration + licence | research use, no redistribution — private repo only |
| DHS Program | survey microdata incl. religion, fertility, household | cluster/region | 1980s-present | registration | research use — private repo only |

## Per-country sources

Seeded from the live builds; extend as each new country lands.

| ISO2 | Source | Content | Smallest unit | Years | Access | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| NZ | Stats NZ census tables | age, ethnicity, population by SA2/TA | SA2 | 2006-2023 | open (pre-2013 waves requested, reply pending) | same tabulator as religion extraction |
| AU | ABS DataPacks (G01 etc.) | age/sex, ancestry, population by SA2 | SA1/SA2 | 2011-2021 | open | same DataPacks as G14 religion |
| CA | StatCan Census Profile | age/sex, population by CSD | CSD | 1981-2021 | open | same profile downloads as religion topic |
| UK | Nomis census tables | age/sex, ethnicity by OA | OA | 2001-2021 | open | same Nomis route as TS030 |
| IE | CSO PxStat | age/sex, population by county | county/Small Area | long run | open | same PxStat route as F5051 |
| BR | IBGE SIDRA | age/sex, population by municipality | municipality | 1991-2022 | open API | same SIDRA API as table 137 |
| MX | INEGI ITER | age/sex, population by locality | locality | 2000-2020 | open CSV | religion and demography in the same ITER file |
| US | NHGIS | full historical demographic tables by county | county | 1790-present | IPUMS licence — reply pending | blocked on the same licence thread as the church statistics |
| VU | VNSO/VBoS census reports | age/sex, population by province/area council | area council (2020) | 1999-2020 | attributed research use | same reports as religion tables |
