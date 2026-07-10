# Mauritius census-religion wave probe

Verified 2026-07-10. This probe tests the public Statistics Mauritius routes
for 1990, 2000, 2011, and 2022. A wave counts as machine-extractable only when
the source table yields clean structured text without optical character
recognition or hand entry.

## Sensitivity rule

Religion in Mauritius is entangled with the constitutional and census history
of ethnic classification. The religion response must never be presented or
interpreted as an ethnic proxy. The product describes respondent-reported
census religion and makes no claim about ethnicity.

## Wave results

| Wave | Official route | Machine-readable? | Finest published geography | Build decision |
| --- | --- | --- | --- | --- |
| 1990 | [Census page](https://statsmauritius.govmu.org/Pages/Censuses%20and%20Surveys/Census-1990.aspx); [Volume II PDF](https://statsmauritius.govmu.org/Documents/Census_and_Surveys/Archive%20Census/1990%20Census/Table%20Reports/1990%20HPC%20Vol.%20II.pdf) | No. The public file is an image-only scan and `pdftotext -layout` returns zero text lines. | Not machine-verified | Exclude. Optical character recognition and hand entry are outside the permitted extraction route. |
| 2000 | [Census page](https://statsmauritius.govmu.org/Pages/Censuses%20and%20Surveys/Census-2000.aspx); [Volume II PDF](https://statsmauritius.govmu.org/Documents/Census_and_Surveys/HPC/2000/TR_VOLII-Demographic_Characteristics.pdf) | Yes. Table D6 parses cleanly with `pdftotext -layout`. | Municipal Ward/Village Council Area and Rodrigues zones; district, island, and national rows are also printed. | Ship district and Rodrigues rows. |
| 2011 | [Census page](https://statsmauritius.govmu.org/Pages/Censuses%20and%20Surveys/Census-2011.aspx); [Volume II PDF](https://statsmauritius.govmu.org/Documents/Census_and_Surveys/HPC/2011/HPC_TR_Vol2_Demography_Yr11.pdf); [Excel route](https://statsmauritius.govmu.org/Documents/Census_and_Surveys/HPC/2011/HPC_TR_Vol2_Demography_Yr11.xls) | Yes. The PDF parses cleanly. The census page exposes the Excel route, although the file endpoint returned HTTP 503 during this run. | Municipal Ward/Village Council Area and six Rodrigues regions; district, island, and national rows are also printed. | Ship district and Rodrigues rows from the PDF. |
| 2022 | [Census page](https://statsmauritius.govmu.org/Pages/Censuses%20and%20Surveys/Census/census_2022.aspx); [Volume II PDF](https://statsmauritius.govmu.org/Documents/Census_and_Surveys/Census2022/HPC_TR_Vol2_Demography_Yr22.pdf) | Yes. Table D6 parses cleanly with `pdftotext -layout`. | Municipal Ward/Village Council Area and six Rodrigues regions; district, island, and national rows are also printed. | Ship district and Rodrigues rows. |

The finest common published geography is Municipal Ward/Village Council Area
on Mauritius island and zones or regions on Rodrigues. The product uses
district and Rodrigues because ward/Village Council Area boundaries changed
between censuses, whereas the ten district/island labels align without a
historical concordance.

## Retrieval routes

The Statistics Mauritius server intermittently returned HTTP 503 for the older
PDF paths. The build records each official URL as the source of record and uses
preserved snapshots of the same URLs for the local 2000 and 2011 copies:

- 2000 snapshot:
  `https://web.archive.org/web/20250403151859id_/` plus the official PDF URL.
- 2011 snapshot:
  `https://web.archive.org/web/20240929031031id_/` plus the official PDF URL.
- 1990 snapshot used to test extractability:
  `https://web.archive.org/web/20240626074506id_/` plus the official PDF URL.
- 2022 downloaded directly from Statistics Mauritius.

The manifest records retrieval URLs, file sizes, and SHA-256 hashes. Raw files
remain in the gitignored `data/raw/mu_census/` cache.

## Licence

The [Government of Mauritius copyright
notice](https://www.govmu.org/FR/Pages/Mentions_Legales.aspx) encourages public
access. It permits protected government data to be downloaded without charge
and reproduced accurately, provided the material is not used in a misleading
or disparaging context. Transmission to others requires the source, including
its URL, and Government of Mauritius copyright status. Third-party material is
excluded from that permission.

The derived census products therefore cite Statistics Mauritius, preserve the
official URLs, and state Government copyright. The boundary source is
[geoBoundaries MUS ADM1](https://www.geoboundaries.org/api/current/gbOpen/MUS/ADM1/),
boundary ID `MUS-ADM1-65221844`, representing 2017 districts and outer islands.
Its API metadata states the Open Data Commons Open Database Licence 1.0 and
attributes geoBoundaries and OpenStreetMap.

## Category mapping

The longitudinal headline metric is `named religious affiliation`: the sum of
every named religious-group column in Table D6, divided by the full Table D6
resident population. The mapping preserves the table's own aggregation.

| Source category | Product treatment |
| --- | --- |
| Named Christian, Hindu, Muslim, Buddhist/Chinese, and other named religious-group columns | Sum into `religious_affiliation_count`. Category labels and combinations vary across waves. The product does not publish a longitudinal denomination comparison. |
| `No religion` | Publish as `no_religion_count` and percent in 2022. The category is not separate in the earlier district tables. |
| `Other and Not stated` / `Other & Not stated` | Retain as an excluded residual. Never relabel it as no religion. |
| `Total` | Use as `population_total` and as the denominator for both published percentages. |

The 2000 table has twelve named group columns plus the combined residual. The
2011 table has eleven named group columns after combining some Hindu and Muslim
labels, plus the combined residual. The 2022 table has twelve named group
columns, explicit `No religion`, and the combined residual.

## Exact reconciliation

The build asserts every area row's printed category accounting and then sums
the ten reporting units to the printed Republic of Mauritius row.

| Wave | Table D6 total | Named religious affiliation | No religion | Other and not stated residual |
| --- | ---: | ---: | ---: | ---: |
| 2000 | 1,178,848 | 1,169,743 | not separable | 9,105 |
| 2011 | 1,236,817 | 1,224,124 | not separable | 12,693 |
| 2022 | 1,233,097 | 1,218,413 | 7,753 | 6,931 |

For every published field and wave, the sum of the nine districts plus
Rodrigues equals the printed national value.

## Boundary decision

geoBoundaries supplies twelve ADM1 features. The product retains the nine
districts and Rodrigues. Agaléga and St. Brandon are omitted because Statistics
Mauritius Table D6 excludes them. All 10 retained features join in all three
waves. `scripts/lib/simplify_boundary.R` writes 10 valid features at 205,331
bytes with 100% weighted keep-shapes and `allow-overlaps` cleaning.
