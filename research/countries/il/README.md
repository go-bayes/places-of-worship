# Country data map: Israel (IL)

## Status

- **Tier**: scope approved; construct extension required
- **Build state**: stopped at the construct gate; no product shipped
- **Last verified**: 2026-07-11

The project lead selected CBS statistical coverage as published. The selected
coverage includes East Jerusalem within Jerusalem District and Golan
Sub-District within Northern District under CBS statistical definitions. It
also includes any localities beyond the Green Line present in the CBS files,
including the separately labelled Judea and Samaria Area. The project records
the statistical source's definitions without endorsing any boundary position.

The build stopped because CBS table 2.11 publishes five Population Register
categories: Jews, Muslims, Christians, Druze, and people not classified by
religion. The last category records missing religious classification in the
Population Register. It does not record a no-religion response. The current
area-summary rows provide only two fixed religion metric pairs, and the shared
runtime has no generic route for these five CBS groups. No category was forced
into the legacy `no_religion` fields.

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Israel Central Bureau of Statistics (CBS), Statistical Abstract table 2.2 | Registry-based population by religion | National | Annual, 1995–2024 | XLSX/PDF | Open web | CBS open licence |
| CBS geographic dictionary API | Main religion of locality; Jewish, Arab, and total population counts | Locality | Annual, 1995–2024 | API (JSON/XML) | Open web | CBS open licence |
| CBS Statistical Abstract table 2.11 | Registry-based population by religion | District/sub-district | 1948, 1961, 1972, 1983, 1995, 2008, 2022, and 2024 | XLSX/PDF | Open web | CBS open licence |
| CBS Social Survey | Self-defined Jewish religiosity among people aged 20 and over | National annual estimates; district analysis would require microdata and precision assessment | Annual survey since 2002 | Tables/microdata | Open web | CBS terms |

These constructs are not interchangeable. The locality API does not provide
all-age counts for every religion, and self-defined religiosity is a survey
indicator rather than registry religion.

## Access the data yourself

- **Source of record**: [CBS population publications](https://www.cbs.gov.il/en/Pages/SubjectPublications.aspx?CbsSubject=%D7%90%D7%95%D7%9B%D7%9C%D7%95%D7%A1%D7%99%D7%99%D7%94)
- **Exact routes**: recorded in [scope-options.md](scope-options.md)
- **Licence**: [CBS Open License for information on its website](https://www.cbs.gov.il/en/Pages/Enduser-license.aspx)
- **Extraction script**: none; the construct gate stopped the build before a
  product script was created
- **Retrieval recipe and hashes**: none committed; source workbooks were
  inspected locally to resolve the construct

## Boundaries

The selected boundary convention is CBS statistical coverage. CBS publishes
2021 locality points and 2022 statistical-area polygons under its open licence.
The public catalogue located during the scope probe did not expose a current
district or sub-district polygon download. See
[scope-options.md](scope-options.md) for the files, limitations, and terms.

## Places-of-worship layer

Not probed. Site-layer assessment is outside this scope-options task.

## First visualisation

No visualisation was built because the construct gate stopped the product.

## Build recipe

A later build should extend the area-summary contract with generic indicator
values keyed by `indicator_id`, or attach `indicator_observation` records to
each district-year. It should register Jewish, Muslim, Christian, Druze, and
not-classified-by-religion counts and shares as separate indicators. The shared
runtime should derive its metric selector from those indicator definitions.
The legacy `religious_affiliation` and `no_religion` fields should remain null
unless the project separately approves an aggregate construct with precise
labels.

After that extension, the build can extract the eight machine-readable
reference years in CBS table 2.11: 1948, 1961, 1972, 1983, 1995, 2008, 2022,
and 2024. The source omits several sub-district rows for smaller groups, while
its district rows provide the most complete subnational breakdown. The source
does not provide an annual subnational five-group panel.

## Risks and open questions

- The area-summary schema and shared runtime need a generic multi-group
  indicator route before the CBS product can ship.
- Registry religion, locality main religion, and survey self-definition must
  remain separate indicators.
- The published district table supplies eight reference years rather than an
  annual panel.
- A locality-row filter cannot split Jerusalem at the Green Line.

## Deep-history potential

Not assessed in this probe.
