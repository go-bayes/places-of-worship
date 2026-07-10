# Country data map: Liechtenstein (LI)

## Status

- **Tier**: A (data product built)
- **Build state**: data product shipped; region page and hub wiring remain outside this build
- **Last verified**: 2026-07-10

## Religious data over time

| Source | Construct | Smallest public unit | Years | Format | Access | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Statistics Liechtenstein table 213.001d, `Ständige Bevölkerung nach Religion, Heimat, Geschlecht und Gemeinde` | full-enumeration census affiliation for the permanent population | municipality | 2010, 2015, 2020 | PX-Web, XLS/XLSX | open web | CC BY 4.0 |

The source asks which religious community the respondent belongs to. It measures census affiliation. It does not measure belief or participation in religious practice.

The product retains the source's `Keine Zugehörigkeit` (No affiliation) and `Ohne Angabe` (Not stated) categories. `Ohne Angabe` remains in the population denominator and outside the affiliation and no-affiliation headline counts. The 2020 Protestant label differs from the 2010 and 2015 label; the manifest records the break and does not smooth it.

## Access the data yourself

This project does not redistribute the source workbooks. The public product contains derived municipality rates with attribution.

- **Source of record**: [Statistics Liechtenstein population-structure page](https://www.statistikportal.li/de/themen/bevoelkerung/bevoelkerungsstruktur).
- **Exact table**: [213.001d `Ständige Bevölkerung nach Religion, Heimat, Geschlecht und Gemeinde`](https://www.statistikportal.li/etab/213.001d).
- **Versioned exports**: the 2010 XLS sheet `1.08`, the 2015 XLSX sheet `1.08`, and the 2020 XLSX sheet `1.108`. The [route probe](route-probe.md) records every direct URL.
- **Licence**: Statistics Liechtenstein publication metadata states CC BY 4.0. Attribute Statistics Liechtenstein and identify extracted, translated, or adapted material.
- **Our extraction script**: [`scripts/build_li_area_summary.R`](../../../scripts/build_li_area_summary.R).
- **Retrieval recipe and hashes**: [`docs/manifests/li-census-religion-2010-2020.json`](../../../docs/manifests/li-census-religion-2010-2020.json).

## Boundaries

- **Official source**: [Liechtenstein National Administration Hoheitsgrenzen download](https://service.geo.llv.li/download/getfile.php?theme=hgredxf), with [geocat.ch metadata](https://www.geocat.ch/geonetwork/srv/ger/catalog.search#/metadata/7dd0cb7f-43f9-4db4-b83f-66b43a47f943).
- **Vintage anchor**: the municipality polygon members in the archive are dated 10 September 2021.
- **Licence**: the [LLV geodata terms](https://service.geo.llv.li/download/hgredxf/licence.txt) permit commercial and non-commercial use, modification, and redistribution with attribution; modified data must use the same conditions.
- **Processing**: dissolve 30 official polygon parts by municipality code, transform from the archive's LV95 coordinate range to WGS84, and simplify through `scripts/lib/simplify_boundary.R`.
- **Public output**: `apps/regions/li/data/li_municipality_2021.geojson`, with 11 valid features and 11 distinct geometry hashes.

The 11 municipalities are stable across the shipped 2010–2020 series. No geographic concordance is required.

## Places-of-worship layer

No governed Liechtenstein place-of-worship snapshot ships with this product. Site coverage assessment and UI wiring remain separate lanes.

## First visualisation

Religious-affiliation and `Keine Zugehörigkeit` percentages by municipality for the 2010, 2015, and 2020 censuses, on the official 2021 municipality frame.

## Build recipe

1. Download the three versioned population-structure workbooks and extract the national total plus all 11 municipality values from the published religion table.
2. Retain every wave's German category labels. Record faithful English display labels and the 2020 Protestant label break in the manifest.
3. Derive the standard affiliation headline from each wave's named religion categories. Retain `Keine Zugehörigkeit` as the no-affiliation headline and `Ohne Angabe` in the source population denominator.
4. Download the official Hoheitsgrenzen archive, dissolve its 30 municipal polygon parts to 11 features, and simplify with the shared helper.
5. Validate exact within-municipality and municipality-to-national category sums, all announced waves, 11 valid distinct geometries, and complete raw-source provenance.

Run from the repository root:

```sh
Rscript scripts/build_li_area_summary.R
```

## Risks and open questions

- The 1980, 1990, and 2000 archives contain municipality religion or confession tables for the older `Wohnbevölkerung` frame. They sit outside table 213.001d's `Ständige Bevölkerung` series and require a separate population-frame and category review before use.
- The 1990 census volume is available as an image-only scan. This build does not derive counts from optical character recognition.
- The official boundary ZIP omits a PRJ file. The coordinates use the Swiss LV95 range; the build pins EPSG:2056 and validates the resulting Liechtenstein extent.

## Deep-history potential

The census archive supports a separate pre-2010 investigation. The 1980 and 2000 municipality tables are text-readable, while the 1990 volume requires a governed image-table extraction. Earlier census volumes also report confession at municipality level, but they are outside this product.
