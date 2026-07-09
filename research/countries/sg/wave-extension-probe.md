# Singapore religion wave-extension probe

Probe date: 2026-07-10.

Source context: `research/expansion-survey-2026-07.md` records Singapore as a strong TableBuilder/DOS religion candidate, with a likely planning-area route and a resident population aged 15+ denominator.

## Bottom Line

Stop before build. The 2010 and 2020 planning-area religion tables are machine-readable. URA planning-area boundaries are also machine-readable through data.gov.sg under the Singapore Open Data Licence. The build gate fails because the subnational census waves use different geography vintages without a pinned exact nesting. Census 2010 uses URA Master Plan 2008 planning areas. Census 2020 uses URA Master Plan 2019 planning areas. Census 2000 uses DGP zones.

No `area_summary`, boundary product, manifest, reconciliation file, or country-card update was created.

## TableBuilder Routes

TableBuilder exposes two useful route families:

```text
tree:
https://tablebuilder.singstat.gov.sg/api/doswebcontent/1/SubjectGrouping/tree-data

public data API catalogue:
https://tablebuilder.singstat.gov.sg/api/doswebcontent/1/SubjectGrouping/getdataapi/?admin=false

cross-sectional metadata:
https://tablebuilder.singstat.gov.sg/api/doswebcontent/1/CrossSectionalFileUpload/CrossSectional/{table_code}

cross-sectional headers:
https://tablebuilder.singstat.gov.sg/api/doswebcontent/1/CrossSectionalFileUpload/CrossSectional/Headers/{internal_id}

cross-sectional rows:
https://tablebuilder.singstat.gov.sg/api/doswebcontent/1/CrossSectionalFileUpload/CrossSectional/Row/{internal_id}
```

The row endpoint returns `jsonChunk` URLs for the table body. The public data API catalogue exposes the current TableBuilder API subset. It included the Census 2020 national religion tables during this probe, but it did not expose the 2010 and 2020 planning-area religion tables. Those planning-area tables are still machine-readable through the cross-sectional metadata, header, row, and chunk routes above.

## National Series

The national route is suitable as context only. If a later build proceeds, the five census waves should be recorded in the manifest/card. They should not be emitted as map rows.

| Wave | Machine route found in this probe | Preferred national table route | Notes |
| --- | --- | --- | --- |
| 1980 | Not found in current TableBuilder tree, TableBuilder public data API catalogue, or data.gov.sg public catalogue. | Not pinned. | Treat as publication-context only until an official DOS archival table route is located. |
| 1990 | Not found in current TableBuilder tree, TableBuilder public data API catalogue, or data.gov.sg public catalogue. | Not pinned. | Treat as publication-context only until an official DOS archival table route is located. |
| 2000 | Yes. | TableBuilder CT `6355`; data.gov.sg `d_285988f6622425f3f2d72ebb6ec5aba9`, `Resident Population Aged 15 Years and Over by Religion, Ethnic Group and Sex (Census of Population 2000)`. | Alternative national table: CT `6354`, data.gov.sg `d_2fbfdfa81bad05f8f63773ada4d87b2c`, by age group, religion, and sex. |
| 2010 | Yes. | TableBuilder CT `6364`; data.gov.sg `d_9fa1b6a53c80f89d93b7c795d5b2e9ee`, `Resident Population Aged 15 Years and Over by Religion, Ethnic Group and Sex (Census of Population 2010)`. | Alternative national table: CT `6367`, data.gov.sg `d_02b58c38cb957104f29f120fdc83f56f`, by age group, religion, and sex. |
| 2020 | Yes. | TableBuilder CT `17459`; data.gov.sg `d_4f6dc35cb00308f67bf9d429cfa30e65`, `Resident Population Aged 15 Years and Over by Religion, Ethnic Group and Sex (Census of Population 2020)`. | Alternative national table: CT `17458`, data.gov.sg `d_1bd1abe4f66c4ecc00fe656a0e5d1c40`, by age group, religion, and sex. |

Denominator: use the tables' own convention. The repeated DOS title phrase is `Resident Population Aged 15 Years and Over`. The SingStat religion theme defines religion as the faith or spiritual belief declared by the person. Attendance at ceremonies and regular practice are not required for the declaration.

## Subnational Religion Route

| Wave | Route | Table title | Geography note | Machine-readable status |
| --- | --- | --- | --- | --- |
| 2000 | TableBuilder CT `9016`; data.gov.sg `d_84737eaa85026c5b817fcc6bad08d70b`. | `Table 11 Resident Population Aged 15 Years and Over by DGP Zone and Religion`. | Uses DGP Zone rather than planning area. | Machine-readable for DGP Zone; outside the planning-area build requested here. |
| 2010 | TableBuilder CT `8628`; data.gov.sg `d_d4be7f8ba23ba93e5d59564d1dfb5eaa`. | `Table 11 Resident Population Aged 15 Years and Over by Planning Area and Religion`. | Footnote states that planning areas refer to URA Master Plan 2008. | Machine-readable. Internal TableBuilder id: `11cd151e-54b7-4cd2-9de3-79f622a1a915`. |
| 2020 | TableBuilder CT `17592`; data.gov.sg `d_a58564fbed922609a0f79af96069dd9b`. | `Table 99 Resident Population Aged 15 Years and Over by Planning Area of Residence and Religion`. | Footnote states that planning areas refer to URA Master Plan 2019. | Machine-readable. Internal TableBuilder id: `0a76787b-f5c0-425a-4fa9-08d93224e75b`. |

The 2010 row set contains planning-area rows that are absent from the 2020 table, including `Changi`, `Mandai`, `Newton`, `Rochor`, and `Singapore River`. Both tables include an `Others` row. The row-set difference is enough to stop the build. An exact Master Plan 2008 to Master Plan 2019 nesting or crosswalk must be pinned before a multi-wave product proceeds.

## Boundaries And Licence

The data.gov.sg public catalogue route is:

```text
https://api-production.data.gov.sg/v2/public/api/datasets?page={page}
```

The data.gov.sg dataset routes for metadata and download polling are:

```text
metadata:
https://api-production.data.gov.sg/v2/public/api/datasets/{dataset_id}/metadata

download poll:
https://api-open.data.gov.sg/v1/public/api/datasets/{dataset_id}/poll-download
```

Relevant URA planning-area boundary datasets:

| Geography vintage | data.gov.sg dataset id | Dataset title | Format | Size / attributes |
| --- | --- | --- | --- | --- |
| Master Plan 2008 | `d_773f010a4eaae0ce6d81cbe78d251642` | `Master Plan 2008 Planning Area Boundary (No Sea)` | GEOJSON | Download poll returns `MasterPlan2008PlanningAreaBoundaryNoSea.geojson`. |
| Master Plan 2019 | `d_4765db0e87b9c86336792efe8a1f7a66` | `Master Plan 2019 Planning Area Boundary (No Sea)` | GEOJSON | Dataset page lists 2 MB and attributes `PLN_AREA_N`, `PLN_AREA_C`, `REGION_N`, and `REGION_C`. |

The Master Plan 2019 dataset page states that the file is free for personal or commercial use under the Open Data Licence. The Singapore Open Data Licence terms are clear for this project. The licence grants worldwide, perpetual, royalty-free, non-exclusive permission to use, copy, distribute, transmit, modify, and adapt datasets for commercial or non-commercial purposes. Reuse must acknowledge the source and link to the licence, and it must not suggest official endorsement. The licence does not grant rights over personal data, third-party rights, patents, trademarks, or design rights.

## Build Gate

| Gate | Result | Evidence |
| --- | --- | --- |
| Subnational religion machine-readable | Pass for 2010 and 2020; fail for a 2000 planning-area wave. | CT `8628` and CT `17592` have JSON metadata, header, row, and chunk routes. CT `9016` is DGP Zone. |
| Boundary route machine-readable | Pass. | data.gov.sg exposes GEOJSON planning-area boundaries for Master Plan 2008 and Master Plan 2019. |
| Licence clear | Pass. | URA datasets are released through data.gov.sg under the Singapore Open Data Licence. |
| Exact geography nesting across waves | Fail. | 2010 uses Master Plan 2008, 2020 uses Master Plan 2019, 2000 uses DGP Zone, and no exact nesting or crosswalk was pinned. |

If a later task reopens a single-wave 2020 product, the reconciliation rule should be strict: compare the planning-area table total, including `Others`, with the published national total for the same wave and report any residual. Do not distribute residuals across planning areas.
