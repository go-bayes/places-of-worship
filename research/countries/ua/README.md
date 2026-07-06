# Country data map: Ukraine (UA)

## Status

- **Tier**: B (feasible with extraction work)
- **Build state**: survey verified
- **Last verified**: 2026-07-07

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [2001 Ukrainian Census](https://2001.ukrcensus.gov.ua/eng/) | census population; no religion question found | not applicable for religion | 2001 | web tables | open | State Statistics terms |
| [Razumkov Centre religion surveys](https://razumkov.org.ua/en) | survey religious identity | macro-region/oblast in some reports | repeated 2000s-2020s | PDF/tables | open | Razumkov terms |
| [State Service for Ethnopolitics and Freedom of Conscience](https://dess.gov.ua/) | registered religious organisations | oblast/organisation, depending release | annual/recent | web/PDF/register | open | agency terms |

## Boundaries

- Official boundary files: Ukrainian administrative boundaries from state open data where available; geoBoundaries ADM1/ADM2 is a fallback.
- Boundary changes between waves and the harmonisation plan: wartime occupation and administrative changes require a frozen boundary year and explicit exclusions.

## Places-of-worship layer

- OSM coverage assessment (2026-07-07): Overpass count did not complete reliably in this sweep.
- Country-specific registers that could seed or verify the layer: state religious-organisation register, Orthodox jurisdictions, Greek Catholic eparchies, Protestant unions, Jewish and Muslim communities.

## First visualisation

Registered religious organisations by oblast and denomination, current or most recent pre-war complete year, with survey identity shown separately.

## Build recipe

1. Extract: DESS or predecessor annual religious-organisation statistics by oblast and denomination.
2. Governed product: `area_summary` for organisation density only after construct labels are fixed.
3. Boundaries: oblast boundaries for a named year, with Crimea and occupied territories flagged.
4. Region page: defer until wartime coverage rules are agreed.
5. Verification: reconcile oblast organisation counts to national agency totals.

## Risks and open questions

- Ukraine has no modern census religion affiliation table.
- Survey identity, registered organisations, and mapped places are different constructs.
- War and occupation make current subnational coverage unstable.

## Deep-history potential

Central State Historical Archives in Kyiv and Lviv, Orthodox/Greek Catholic/Catholic parish registers, Jewish community archives, Ottoman and imperial Russian materials, metrical books, and historical gazetteers.
