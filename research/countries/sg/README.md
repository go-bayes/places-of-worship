# Country data map: Singapore (SG)

## Status

- **Tier**: B
- **Build state**: Built at planning-area level for the 2010 and 2020 censuses, with each wave on its matching Urban Redevelopment Authority Master Plan boundary vintage.
- **Last verified**: 2026-07-10

## Built products

| Product | Unit | Wave | Notes |
| --- | --- | --- | --- |
| `apps/regions/sg/data/area_summary_pa.json` | Planning area | 2010, 2020 | Combined 65-row product. The waves retain separate boundary-set identifiers. |
| `apps/regions/sg/data/area_summary_pa.csv` | Planning area | 2010, 2020 | Flattened tabular companion. |
| `apps/regions/sg/data/area_summary_pa_2010.json` | Planning area | 2010 | Derived 35-row view for the Master Plan 2008 level. |
| `apps/regions/sg/data/area_summary_pa_2020.json` | Planning area | 2020 | Derived 30-row view for the Master Plan 2019 level. |
| `apps/regions/sg/data/sg_pa_2008.geojson` | Planning area | 2010 | Mapped subset of the Master Plan 2008 boundary file. |
| `apps/regions/sg/data/sg_pa_2019.geojson` | Planning area | 2020 | Mapped subset of the Master Plan 2019 boundary file. |
| `docs/manifests/sg-census-religion-2010-2020.json` | Manifest | 2010, 2020 | Source routes, licence, category treatment, residuals, hashes, and validation notes. |

## Religious data over time

| Source | Construct | Smallest public unit used | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [SingStat CT 8628](https://tablebuilder.singstat.gov.sg/api/doswebcontent/1/CrossSectionalFileUpload/CrossSectional/8628) | Census religious declaration among the resident population aged 15 years and over | Master Plan 2008 planning area | 2010 | TableBuilder JSON routes and data.gov.sg CSV | Open web | Singapore Open Data Licence |
| [SingStat CT 17592](https://tablebuilder.singstat.gov.sg/api/doswebcontent/1/CrossSectionalFileUpload/CrossSectional/17592) | Census religious declaration among the resident population aged 15 years and over | Master Plan 2019 planning area | 2020 | TableBuilder JSON routes and data.gov.sg CSV | Open web | Singapore Open Data Licence |
| [SingStat CT 9016](https://tablebuilder.singstat.gov.sg/api/doswebcontent/1/CrossSectionalFileUpload/CrossSectional/9016) | Census religious declaration among the resident population aged 15 years and over | DGP zone | 2000 | TableBuilder JSON routes and data.gov.sg CSV | Open web | Singapore Open Data Licence |

The denominator is the source title's wording: `Resident Population Aged 15 Years and Over`. SingStat defines religion as the religious faith or spiritual belief declared by the person. The declaration does not require regular attendance at religious ceremonies or regular practice.

## Category mapping

| Source category | Map treatment |
| --- | --- |
| `Buddhism` | Included in religious affiliation. |
| `Taoism` | Included in religious affiliation; includes Chinese Traditional Beliefs. |
| `Islam` | Included in religious affiliation. |
| `Hinduism` | Included in religious affiliation. |
| `Sikhism` | Included in religious affiliation. |
| `Christianity - Catholic` | Included in religious affiliation. |
| `Christianity - Other Christians` | Included in religious affiliation. |
| `Other Religions` | Included in religious affiliation. |
| `No Religion` | Used directly for the no-religion count and percentage. |

The headline religious-affiliation count equals `Total - No Religion`. The subtraction reproduces the national tables' `With Religion` construct and retains planning areas whose minor-category cells contain `na` or `-`. The build leaves those source markers unavailable; it does not impute category counts.

## Boundaries and geography

| Source | Unit | Match note |
| --- | --- | --- |
| [Master Plan 2008 Planning Area Boundary (No Sea)](https://data.gov.sg/datasets/d_773f010a4eaae0ce6d81cbe78d251642/view) | Planning area | CT 8628 states that its 2010 planning areas refer to Master Plan 2008. |
| [Master Plan 2019 Planning Area Boundary (No Sea)](https://data.gov.sg/datasets/d_4765db0e87b9c86336792efe8a1f7a66/view) | Planning area | CT 17592 states that its 2020 planning areas refer to Master Plan 2019. |

The two census waves ship on separate planning-area vintages. The product therefore provides no cross-wave planning-area change metric. The 2000 table remains deferred because it reports DGP zones rather than either shipped planning-area geography.

Both full Urban Redevelopment Authority files contain 55 planning areas. The shipped files contain only areas named in the corresponding census table: 35 for 2010 and 30 for 2020. Each census table also has an `Others` row. The build includes `Others` in national reconciliation and excludes it from map rows because it has no planning-area polygon.

## Reconciliation

The planning-area sums include `Others` and retain the published counts. Small additivity residuals remain against the independent national tables; their size is consistent with whole-person cell rounding.

| Wave | Metric | Planning-area sum including `Others` | Published national total | Residual |
| --- | --- | ---: | ---: | ---: |
| 2010 | Total | 3,105,751 | 3,105,748 | +3 |
| 2010 | With religion | 2,578,194 | 2,578,196 | -2 |
| 2010 | No Religion | 527,557 | 527,553 | +4 |
| 2020 | Total | 3,459,094 | 3,459,093 | +1 |
| 2020 | With religion | 2,766,566 | 2,766,566 | 0 |
| 2020 | No Religion | 692,528 | 692,528 | 0 |

The build reports every residual and distributes none of it across planning areas. SingStat CT 6364 supplies the 2010 national comparison, and CT 17459 supplies the 2020 national comparison.

## Access the data yourself

- **Planning-area tables**: CT 8628 for 2010 and CT 17592 for 2020. The data.gov.sg dataset identifiers and signed-download polling routes are recorded in the manifest.
- **National comparison tables**: CT 6364 for 2010 and CT 17459 for 2020.
- **Boundaries**: data.gov.sg datasets `d_773f010a4eaae0ce6d81cbe78d251642` and `d_4765db0e87b9c86336792efe8a1f7a66`.
- **Licence**: Singapore Open Data Licence. Reuse must acknowledge the source and must not suggest Singapore Government endorsement.
- **Build**: run `Rscript scripts/build_sg_area_summary.R` from the repository root.

## Places-of-worship layer

No governed Singapore OpenStreetMap place-of-worship snapshot is included in this release. Place-count and density fields remain null.

## Deep-history potential

Straits Settlements census volumes, National Archives of Singapore holdings, Urban Redevelopment Authority historical maps, charity and society registrations, denominational directories, and institutional records can support longer site histories.
