# Country data map: Israel (IL)

## Status

- **Tier**: awaiting scope ruling
- **Build state**: awaiting scope ruling; probe only
- **Last verified**: 2026-07-10

No extraction, boundary preparation, or map build may begin until the project
lead rules on geographic scope and sensitivity. The evidence and the three
scope options are in [scope-options.md](scope-options.md).

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
- **Extraction script**: none; building is out of scope pending the ruling
- **Retrieval recipe and hashes**: none; building is out of scope pending the ruling

## Boundaries

Boundary choices depend on the scope ruling. CBS publishes 2021 locality
points and 2022 statistical-area polygons. The public files follow CBS
statistical coverage; they are not a neutral Green Line mask. See
[scope-options.md](scope-options.md) for the files, limitations, and terms.

## Places-of-worship layer

Not probed. Site-layer assessment is outside this scope-options task.

## First visualisation

Awaiting scope ruling. No visualisation is specified or built.

## Build recipe

Awaiting scope ruling. No build recipe is authorised.

## Risks and open questions

- The project lead must choose among the three documented geographic scopes.
- Registry religion, locality main religion, and survey self-definition must
  remain separate indicators.
- A locality-row filter cannot split Jerusalem at the Green Line.

## Deep-history potential

Not assessed in this probe.
