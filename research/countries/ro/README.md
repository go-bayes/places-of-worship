# Country data map: Romania (RO)

## Status

- **Tier**: A (buildable now)
- **Build state**: map live
- **Last verified**: 2026-07-09

## Built Map

- **App route**: `apps/regions/ro/index.html`
- **Product files**: `apps/regions/ro/data/area_summary_judet.json`,
  `apps/regions/ro/data/area_summary_judet.csv`,
  `apps/regions/ro/data/ro_judet_2021.geojson`,
  `apps/regions/ro/data/area_summary_lau_2021.json`,
  `apps/regions/ro/data/area_summary_lau_2021.csv`, and
  `apps/regions/ro/data/ro_lau_2021.geojson`
- **Extraction script**: `scripts/build_ro_area_summary.R`
- **Manifest**: `docs/manifests/ro-census-religion-2011-2021.json`
- **Waves shipped**: 2011 and 2021
- **Denominator**: total population minus `Informatie nedisponibila` in
  each wave. The national undeclared share is 6.26% in 2011 and 13.95%
  in 2021.
- **Default view**: județ, using source county rows from the same RPL
  workbooks. The LAU 2021 product remains available as the detail level.
- **Boundary basis**: GISCO NUTS3 2021 for județe and GISCO LAU 2021
  for the detail layer. The 2011 LAU source rows are first matched to
  GISCO LAU 2011 names, then bridged to the 2021 output boundary by LAU
  ID.

## Religious Data Over Time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [RPL 2021 final results, Tabel 2.04.2](https://www.recensamantromania.ro/rezultate-rpl-2021/rezultate-definitive/) | census religion | municipality, town, commune | 2021 | XLSX | open | INS public download; explicit reuse statement not located |
| [RPL 2011 sR_TAB_13](https://www.recensamantromania.ro/istoric/rpl-2011/) | census religion | municipality, town, commune | 2011 | XLS | open | INS public download; explicit reuse statement not located |
| [RPL 2002 historical page](https://www.recensamantromania.ro/rezultate-recensamant-2002/) | census religion | unresolved in this build | 2002 | XLS/PDF | open | INS public download; explicit reuse statement not located |
| [RPL 1992 historical page](https://www.recensamantromania.ro/rezultate-recensamant-1992/) | census religion | county and locality category | 1992 | XLS/PDF | open | INS public download; explicit reuse statement not located |

The no-religion construct is `Fara religie` plus `Atei` or `Ateu`. The
2021 `Agnostic` category remains in the denominator but is not counted as
no religion. Rows where a headline source component is published as `*`
are left unavailable rather than imputed.

## Access The Data Yourself

This project does not redistribute source workbooks. The map shows
derived rates with attribution. To obtain the data from the source of
record:

- **Source of record**: Institutul National de Statistica through the
  Recensamant Romania portal.
- **Exact tables**: RPL 2021 `Tabel 2.04.2`; RPL 2011 `sR_TAB_13`.
- **Licence**: the files are public downloads from the census portal; an
  explicit reuse statement was not located during this build.
- **Our extraction script**: `scripts/build_ro_area_summary.R`.
- **Retrieval recipe and hashes**:
  `docs/manifests/ro-census-religion-2011-2021.json`.

## Boundaries

- Official boundary files: Eurostat GISCO NUTS3 2021, LAU 2021, and LAU
  2011 GeoJSON. GISCO download provisions require attribution.
- Boundary changes between waves and the harmonisation plan: 2021 LAU
  boundaries anchor the shipped product. The 2011 wave uses LAU IDs from
  GISCO LAU 2011 to bridge into the 2021 boundary set. No unofficial
  split or merge correspondence is used. The județ layer uses source
  county rows directly and therefore does not aggregate suppressed LAU
  rows.

## Places-Of-Worship Layer

- OSM coverage assessment (2026-07-07): Overpass count did not complete
  reliably in the survey sweep.
- Country-specific registers that could seed or verify the layer:
  Secretariat of State for Religious Affairs denominations, Orthodox and
  Greek Catholic parish lists, Jewish and Muslim community directories.

## First Visualisation

Religious-affiliation percent and no-religion percent by județ and LAU
area for the 2011 and 2021 censuses. The map opens on județ because
headline county percentages are complete; LAU remains the detail view.

## Build Recipe

1. Extract RPL 2021 `Tabel 2.04.2` and RPL 2011 `sR_TAB_13`.
2. Build `area_summary` products per `schemas/area_summary.schema.json`,
   with a tracked manifest per `docs/data-storage-pipeline.md`: source
   county rows for `judet`, and LAU rows for `lau_2021`.
3. Join 2021 rows to GISCO LAU 2021 by county and UAT name. Join 2011
   rows to GISCO LAU 2011 by county and UAT name, then bridge to 2021 by
   LAU ID. Join county rows to GISCO NUTS3 2021 by județ name.
4. Configure `REGION_CONFIG` per `docs/development/adding-a-region.md`.
5. Verify national totals, join coverage, source suppression handling,
   boundary size, and JSON validity.

## Risks And Open Questions

- The 2021 wave has a large `Informatie nedisponibila` share. The map
  therefore reports stated-response rates over the stated-response
  denominator rather than over the full resident population.
- Source `*` suppression leaves many LAU no-religion and affiliation
  percentages unavailable. The build does not impute those cells; the
  default județ view uses complete source county rows.
- The 2002 and 1992 waves need separate extraction work. The 1992 wave
  may need a coarser county-level product.
- The religion field measures self-declared affiliation rather than
  practice.

## Deep-History Potential

County archives, Orthodox parish registers, Greek Catholic and Roman
Catholic diocesan archives, Jewish community archives, Ottoman and
Habsburg-era materials for border regions, and interwar census volumes.
