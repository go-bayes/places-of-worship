# Country data map: Mauritius (MU)

## Status

- **Tier**: A (district series built)
- **Build state**: data extracted; UI out of scope
- **Last verified**: 2026-07-10

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Statistics Mauritius Housing and Population Census, Volume II, Table D6 | respondent-reported census religion | Municipal Ward/Village Council Area; product uses district and Rodrigues | 2000, 2011, 2022 | text-layer PDF; 2011 also exposes an Excel route | open web | Government of Mauritius copyright notice permits accurate reproduction and transmission with source URL and Government copyright attribution |
| Statistics Mauritius 1990 Housing and Population Census, Volume II | respondent-reported census religion | report route exists; geography not extracted | 1990 | image-only PDF scan | open web | same Government copyright notice |

Religion in Mauritius must never be presented or interpreted as an ethnic
proxy. Religion is entangled with the country's constitutional and census
history of ethnic classification, but the census religion response and ethnic
identity are distinct constructs. Congregation registers measure a third
construct.

## Built product

The product contains 30 rows: nine districts on Mauritius island plus Rodrigues
for the 2000, 2011, and 2022 censuses. Each wave uses Statistics Mauritius
Table D6 and reconciles exactly to its printed Republic of Mauritius row.

- Area summary: `apps/regions/mu/data/area_summary_district.{json,csv}`
- Boundary: `apps/regions/mu/data/mu_adm1_2017.geojson` (10 features,
  205,331 bytes)
- Build: `scripts/build_mu_area_summary.R`
- Manifest: `docs/manifests/mu-census-religion-2000-2022.json`
- Probe: `research/countries/mu/wave-extension-probe.md`

The first headline metric is **named religious affiliation %**: all named
religious-group columns divided by the full Table D6 resident population. The
final district column combines `Other` and `Not stated` in 2000 and 2011, so
those waves cannot support a separate no-religion measure. The 2022 table adds
an explicit `No religion` column; the second metric is therefore available only
for 2022. The product does not relabel the combined residual.

## Access the data yourself

- **Source of record**: Statistics Mauritius census pages for
  [2000](https://statsmauritius.govmu.org/Pages/Censuses%20and%20Surveys/Census-2000.aspx),
  [2011](https://statsmauritius.govmu.org/Pages/Censuses%20and%20Surveys/Census-2011.aspx),
  and [2022](https://statsmauritius.govmu.org/Pages/Censuses%20and%20Surveys/Census/census_2022.aspx).
- **Exact tables**: Volume II, Table D6, `Resident population by geographical
  location and religious group`.
- **Licence**: the Government of Mauritius copyright notice permits accurate
  reproduction and transmission when the source URL and Government copyright
  status are stated. The product and manifest provide that attribution.
- **Our extraction script**: `scripts/build_mu_area_summary.R`; it uses
  `pdftotext -layout` and fails if the printed categories or district totals do
  not reconcile.
- **Retrieval recipe and hashes**:
  `docs/manifests/mu-census-religion-2000-2022.json`.

## Boundaries

The product uses geoBoundaries `MUS ADM1`, representing 2017 districts and
outer islands under the Open Data Commons Open Database Licence 1.0. The ten
Table D6 reporting units match nine district features and Rodrigues exactly.
Agaléga and St. Brandon are excluded because Table D6 does not publish rows for
them. The ten district/island labels align across waves. The product does not
attempt a ward/Village Council Area comparison.

## Places-of-worship layer

- OSM coverage has not been assessed for this build.
- Potential verification sources include the Diocese of Port-Louis, Council of
  Religions Mauritius, Mauritius Sanatan Dharma Temples Federation, and mosque
  directories.

## First visualisation

Shippable: named religious affiliation by district and Rodrigues for 2000,
2011, and 2022, plus explicit no religion for 2022. A UI or hub entry is outside
this build.

## Build recipe

1. Extract each Table D6 with Poppler `pdftotext -layout`; never hand-enter
   values.
2. Sum the published named religious-group columns. Retain the combined
   `Other and Not stated` residual without reinterpretation; retain explicit
   `No religion` only where 2022 publishes it.
3. Assert each area row's category accounting and exact sums to the printed
   national row.
4. Join the ten reporting units to geoBoundaries `MUS ADM1` and simplify with
   `scripts/lib/simplify_boundary.R`.
5. Write the schema-shaped products and provenance manifest.

## Risks and open questions

- The public 1990 Volume II file is an image-only scan. `pdftotext` returns no
  text, and 1990 is therefore excluded under the no-OCR and no-hand-entry rule.
- Category detail changes across waves. The consistent longitudinal metric is
  the sum of named religious groups over the full Table D6 total; denomination
  columns should not be compared without a separate category concordance.
- The 2000 and 2011 residual combines `Other` with `Not stated`, which prevents
  a separate district no-religion series before 2022.
- Religion must never serve as a proxy for ethnicity.

## Deep-history potential

National Archives of Mauritius, Diocese of Port-Louis archives, Anglican and
Presbyterian archives, indenture records, mosque and temple committee records,
and colonial newspapers may support later site-history research.
