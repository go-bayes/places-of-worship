# Country data map: Israel (IL)

## Status

- **Tier**: A (built under the approved two-slot Register construct)
- **Build state**: data product shipped; UI and hub wiring remain outside this build
- **Last verified**: 2026-07-10

The project lead selected CBS statistical coverage as published. The selected
coverage includes East Jerusalem within Jerusalem District and Golan
Sub-District within Northern District under CBS statistical definitions. It
also includes any localities beyond the Green Line present in the CBS files,
including the separately labelled Judea and Samaria Area. The project records
the statistical source's definitions without endorsing any boundary position.

The product uses the two fixed area-summary slots with CBS's own category
names. `religious_affiliation_percent` carries **Classified in a religion group
(%) — Population Register classification, not belief or practice**. The
classified group combines the Jewish, Muslim, Christian, and Druze entries in
CBS table 2.11. `no_religion_percent` carries CBS's category verbatim: **Not
classified by religion (%)**. This is a Population Register classification for
residents without a recognised religious classification, notably many
immigrants and their descendants who are not registered in a religion group.
It is not a measure of no religion, irreligion, or secularity.

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Israel Central Bureau of Statistics (CBS), Statistical Abstract table 2.11 | Population Register classification by religion | district and sub-district | 1948, 1961, 1972, 1983, 1995, 2008, 2022, and 2024 | XLSX/PDF | open web | CBS open licence |
| CBS Statistical Abstract table 2.2 | Population Register classification by religion | national | annual, 1995–2024 | XLSX/PDF | open web | CBS open licence |
| CBS geographic dictionary API | Main religion of locality; Jewish, Arab, and total population counts | locality | annual, 1995–2024 | API (JSON/XML) | open web | CBS open licence |
| CBS Social Survey | Self-defined Jewish religiosity among people aged 20 and over | national annual estimates; district analysis requires microdata and precision assessment | annual survey since 2002 | tables/microdata | open web | CBS terms |

Population Register classification, locality main religion, and survey
self-definition are separate constructs. This product uses Population Register
classification only. The shared UI lane should therefore use `dataNoun:
"Register"` when the later UI task wires these files.

## Shipped waves and reconciliation

The district product contains 56 rows: seven geographic entries across eight
reference years. The seven entries are the six CBS districts and the
separately labelled Judea and Samaria Area. CBS publishes counts in thousands
rounded to one decimal. The product converts these values to persons, which
retains a source resolution of 100 people.

The 1948 wave is recorded context. CBS publishes the total and Jewish district
counts, while the Muslim, Christian, and Druze district distributions are
suppressed. The two ruled construct fields are therefore null for all seven
1948 rows. The national population is 872.7 thousand and the six published
district rows sum to 855.6 thousand. The 17.1-thousand outside-district
remainder is reported in the manifest and never distributed.

The 1961–2024 classified-group values sum the district entries that CBS
publishes for Jewish, Muslim, Christian, and Druze classifications. CBS omits
several small district-by-group entries. The build reports each national-minus-
district residual and distributes none of it. Population totals reconcile
exactly in 1961, 2008, 2022, and 2024; the 1972, 1983, and 1995 differences are
within 100 people, the source rounding unit. The classified-group residuals
range from 300 to 3,300 people after 1961; the 1961 residual is 1,700 people.

CBS publishes Not classified by religion at district level for 1995, 2008,
2022, and 2024. The district sums match the national entry in 1995, 2008, and
2022. The 2024 district sum exceeds the national entry by 100 people, which is
one source rounding unit. The earlier Not classified by religion fields remain
null because table 2.11 does not publish that category for those waves.

## Access the data yourself

- **Source of record**: [CBS population publications](https://www.cbs.gov.il/en/Pages/SubjectPublications.aspx?CbsSubject=%D7%90%D7%95%D7%9B%D7%9C%D7%95%D7%A1%D7%99%D7%99%D7%94).
- **Exact table**: [Statistical Abstract table 2.11, *Population of Israelis, by district, sub-district and religion*](https://www.cbs.gov.il/he/publications/DocLib/2025/2.ShnatonPopulation/st02_11x.xlsx).
- **Exact routes and scope ruling**: [scope-options.md](scope-options.md).
- **Licence**: [CBS Open License for information on its website](https://www.cbs.gov.il/en/Pages/Enduser-license.aspx).
- **Extraction script**: [`scripts/build_il_area_summary.R`](../../../scripts/build_il_area_summary.R).
- **Retrieval recipe, source hashes, and residuals**: [`docs/manifests/il-register-classification-1948-2024.json`](../../../docs/manifests/il-register-classification-1948-2024.json).

## Boundaries

The six districts derive from the 15 official Ministry of Interior
sub-district polygons linked by the CBS ArcGIS organisation. The build
dissolves those polygons by CBS district and simplifies the result with the
shared mapshaper helper. The separately labelled Judea and Samaria Area is the
union of the 193 CBS 2022 statistical-area polygons linked to 129 locality
rows carrying district code `7`. Its geometry depicts published CBS
statistical-area coverage. It does not assert a legal or territorial boundary.

The boundary source terms remain separate. CBS open-licence terms apply to the
CBS statistical-area layer. The official sub-district endpoint carries the
Planning Administration geographic-information terms linked in its CBS
ArcGIS item. The output contains seven valid features and is 255,690 bytes.

## Places-of-worship layer

Not probed. Site-layer assessment and UI wiring are outside this build.

## First visualisation

Population Register classification by district for the seven mappable waves,
1961–2024, with 1948 retained as recorded context.

## Build recipe

1. Download CBS Statistical Abstract table 2.11 and retain its reference dates,
   category labels, footnotes, and one-decimal-thousand units.
2. Sum the published Jewish, Muslim, Christian, and Druze district entries for
   the classified-group slot. Preserve missing entries and national residuals.
3. Carry Not classified by religion into the legacy `no_religion` slot for the
   four waves where CBS publishes the category. Keep the earlier values null.
4. Dissolve the official sub-district polygons into six districts and append
   the separately labelled CBS statistical-area coverage for district code `7`.
5. Validate the 56 rows, indicator declarations, source-rounding residuals,
   seven boundary features, and output sizes.

## Scope sensitivity configuration

Option B remains the shipped scope. The manifest preserves the two unshipped
filters as configuration. Option A excludes district code `7`, sub-district
code `29`, and natural-area codes `291`–`294`; Jerusalem locality code `3000`
requires a finer spatial split. Option C uses the same exclusion codes and
must separately choose whether Jerusalem locality code `3000` is retained,
excluded, or replaced with finer 2022 data.

## Future extension

A later generic multi-group contract can expose Jewish, Muslim, Christian,
Druze, and Not classified by religion as separate indicators. That extension
must preserve this product's Register construct, source labels, scope ruling,
and residual rule.

## Deep-history potential

Not assessed in this build.
