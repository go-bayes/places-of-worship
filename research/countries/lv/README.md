# Country data map: Latvia (LV)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [Central Statistical Bureau database](https://data.stat.gov.lv/) | census population; no census religion table found | not applicable for religion | 2000, 2011, 2021 | PxWeb | open | CSB terms |
| [Ministry of Justice religious organisations reports](https://www.tm.gov.lv/en) | administrative membership and organisation reports | denomination; organisation addresses may be local | annual recent reports | PDF/web | open | Ministry terms |
| [Register of Enterprises religious organisations](https://www.ur.gov.lv/en/) | congregation or religious organisation directory | point/address | current register; historical extracts need request | web/register | partly open | Register terms |

## Boundaries

- Official boundary files: Latvian open geodata and GISCO LAU for municipalities.
- Boundary changes between waves and the harmonisation plan: use current municipalities for organisation directories; no census-affiliation time series is currently buildable.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): Overpass count did not complete reliably in this sweep.
- Country-specific registers that could seed or verify the layer: Ministry of Justice religious-organisation reports, Register of Enterprises, Lutheran/Catholic/Orthodox/Old Believer directories.

## First visualisation

Registered congregations or religious organisations by municipality, current year, clearly labelled as organisation presence rather than population affiliation.

## Build recipe

1. Extract: Register of Enterprises religious-organisation addresses and Ministry of Justice annual reports.
2. Governed product: organisation-level source register first; `area_summary` only after geocoding and denomination normalisation.
3. Boundaries: current municipality polygons from Latvian open data or GISCO LAU.
4. Region page: defer until organisation data are reproducible.
5. Verification: reconcile organisation counts to Ministry of Justice report totals.

## Risks and open questions

- Latvia does not appear to publish modern census religious affiliation.
- Administrative membership, organisation counts, and survey affiliation are different constructs.
- Historical register access may require manual requests.

## Deep-history potential

State Historical Archives, Lutheran church books, Catholic and Orthodox parish registers, Old Believer records, Jewish community archives, and interwar census materials.
