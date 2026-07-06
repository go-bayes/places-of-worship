# Country data map: Cambodia (KH)

## Status

- **Tier**: B
- **Build state**: Surveyed; 2008 and 2019 province religion tables are public but PDF-centred.
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [National Institute of Statistics Cambodia](https://nis.gov.kh/) | Census religion by person | Province | 2008, 2019 | PDF tables | Open web | Government statistics; confirm reuse terms before republication |
| [Cambodia census 2019 final-results portal](https://nis.gov.kh/index.php/km/14-gpc/19-general-population-census-of-cambodia-2019) | Census religion by person | Province in report tables | 2019; 2024 intercensal survey appears national for religion | PDF/web | Open web | Government statistics; confirm reuse terms before republication |

## Boundaries

| Source | Unit | Match note |
| --- | --- | --- |
| [geoBoundaries KHM ADM1](https://www.geoboundaries.org/api/current/gbOpen/KHM/ADM1/) | Province | Province-level matching should be feasible, with attention to new provinces and name changes. |

## Places-of-worship layer

| Source | Role | Note |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) | Candidate site layer | OSM coverage was not counted in this source sweep. First build should assess pagoda coverage separately from churches and mosques. |

## First visualisation

Map 2019 province religious-affiliation shares and add 2008 only after province changes are reconciled.

## Build recipe

Start with the 2019 General Population Census final-results religion table and geoBoundaries KHM ADM1. Extract 2008 from the earlier census report and preserve census categories exactly.

## Risks and open questions

Religion data are less politically charged than in several neighbouring countries, but Cham Muslim and Christian minority localities still warrant small-cell caution. The 2024 intercensal religion release appears too coarse for subnational mapping.

## Deep-history potential

Medium. French Indochina administrative records, National Archives of Cambodia holdings, Ministry of Cults and Religion pagoda records, mosque and church registers, and provincial gazetteers can support deeper histories.
