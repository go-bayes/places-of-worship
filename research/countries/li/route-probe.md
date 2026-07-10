# Liechtenstein census-affiliation route probe

## Probe result

The buildable municipality product contains three census waves: 2010, 2015, and 2020. Statistics Liechtenstein table 213.001d currently exposes those three reference dates for the permanent population (`Ständige Bevölkerung`), 11 religion categories, and 11 municipalities plus the national total. The audit's 1980–2020 span matches the national trend described on the topic page; it does not match the municipality waves in table 213.001d.

The source construct is census affiliation. The 2020 topic page states that the census asks, “Welcher Religionsgemeinschaft gehören Sie an?” (“Which religious community do you belong to?”). The table therefore measures reported religious-community affiliation. It does not measure belief or participation in religious practice.

## Exact table and export routes

| Purpose | Exact route | Result |
| --- | --- | --- |
| Interactive table | <https://www.statistikportal.li/etab/213.001d> | PX-Web table `213.001d Ständige Bevölkerung nach Religion, Heimat, Geschlecht und Gemeinde`; offers CSV, XLSX, PC-Axis, HTML, and delimited-text output |
| 2010 versioned export | <https://www.statistikportal.li/statistikportal/publications/151-amt-fuer-statistik/111-volkszaehlung/2010/01/1/111.2010.01_02_vz-2010-bd1-tabellen.xls> | XLS workbook, sheet `1.08` |
| 2015 versioned export | <https://www.statistikportal.li/statistikportal/publications/213-bevoelkerungsstruktur/2015/01/1/213.2015.01_02_bevoelkerungsstruktur-2015-tabellen.xlsx> | XLSX workbook, sheet `1.08` |
| 2020 versioned export | <https://www.statistikportal.li/statistikportal/publications/213-bevoelkerungsstruktur/2020/01/1/213.2020.01.1_02_bevoelkerungsstruktur-2020-tabellen.xlsx> | XLSX workbook, sheet `1.108` |

The build uses the three versioned workbooks because they are stable direct downloads and preserve the official table layout. Command-line requests to the interactive PX-Web page encounter a Cloudflare challenge; no undocumented API endpoint is required by the recipe.

## Verified waves

| Census year | Reference date | Population frame | Municipality table | Shipped |
| --- | --- | --- | --- | --- |
| 2010 | 31 December 2010 | `Ständige Bevölkerung` | table 1.08, XLS | yes |
| 2015 | 31 December 2015 | `Ständige Bevölkerung` | table 1.08, XLSX | yes |
| 2020 | 31 December 2020 | `Ständige Bevölkerung` | table 1.108, XLSX | yes |

The official census overview states that five-year census results begin in 2010. The current eTab matrix announces exactly 2010, 2015, and 2020. All three announced waves are present in the product.

## Archive sweep before 2010

| Census year | Archive evidence | Finding | Treatment |
| --- | --- | --- | --- |
| 1980 | [Volkszählung 1980, Band 1](https://www.statistikportal.li/statistikportal/publications/151-amt-fuer-statistik/111-volkszaehlung/1980/01/1/111.1980.01_01_vz-1980-bd1-demografische-merkmale.pdf) | Municipality `Konfession` tables for `Wohnbevölkerung`, with an older category frame | outside table 213.001d and not shipped |
| 1990 | [Volkszählung 1990, Band 1](https://www.statistikportal.li/de/publikation/111-volkszaehlung/1990/01/v-1/p3481) | Archived municipality census volume for `Wohnbevölkerung`; the available 542-page PDF is image-only | outside table 213.001d and not shipped |
| 2000 | [Volkszählung 2000, Band 1](https://www.statistikportal.li/statistikportal/publications/151-amt-fuer-statistik/111-volkszaehlung/2000/01/1/111.2000.01_01_vz-2000-bd1-bevoelkerungsstruktur.pdf) | Municipality religion table for `Wohnbevölkerung`, with a coarser category frame than 2010 | outside table 213.001d and not shipped |

The earlier municipality tables establish deep-history potential. They do not extend the current permanent-population series without a separate population-frame and category review. The present build therefore follows the exact eTab record and ships 2010–2020.

## Categories by wave

The 2010 and 2015 workbooks publish 11 religion categories:

1. `Römisch-katholisch`
2. `Evangelisch-reformiert`
3. `Evangelisch-lutherisch`
4. `Andere protestantische Kirchen`
5. `Christlich-orthodox`
6. `Andere christliche Kirchen`
7. `Islamisch`
8. `Buddhistisch`
9. `Andere Religionen`
10. `Keine Zugehörigkeit`
11. `Ohne Angabe`

The 2020 workbook also publishes 11 categories. It replaces `Evangelisch-reformiert` with `Evangelisch (reformiert, protestantisch)` and retains the other ten labels. The build records this source-label break and does not merge the two labels into a denomination trend. The manifest records every German label, a faithful English display label, and its headline role.

## Statistics Liechtenstein licence

The 2015 and 2020 workbook metadata state `Nutzungsbedingungen: CC BY 4.0`. The official 2010 publication record also states CC BY 4.0. The interactive table identifies the Amt für Statistik as publisher and permits reproduction with publisher attribution. The derived product attributes Statistics Liechtenstein and identifies its extraction, English display-label translation, and adaptation.

## Boundary route

| Purpose | Exact route | Finding |
| --- | --- | --- |
| Official download catalogue | <https://service.geo.llv.li/download/> | `Hoheitsgrenzen` dataset, DXF/SHP |
| Official ZIP | <https://service.geo.llv.li/download/getfile.php?theme=hgredxf> | `hgredxf.zip` |
| Metadata | [geocat.ch record 7dd0cb7f-43f9-4db4-b83f-66b43a47f943](https://www.geocat.ch/geonetwork/srv/ger/catalog.search#/metadata/7dd0cb7f-43f9-4db4-b83f-66b43a47f943) | national and municipal boundaries derived from official surveying |
| Terms | <https://service.geo.llv.li/download/hgredxf/licence.txt> | commercial and non-commercial use, modification, and redistribution with attribution; modified data must use the same conditions |

The archive's `Ge_Gemeindegrenze_A` layer contains 30 polygon parts dated 10 September 2021. The build assigns EPSG:2056 from the archive's LV95 coordinate range because the ZIP omits a PRJ file, dissolves the parts by official municipality code, and writes 11 municipality features. The output filename uses 2021 as an archive-content vintage; it does not claim a separate legal effective date.

## Hard-gate results

1. Reconciliation passed. In every wave, each municipality's 11 category counts sum exactly to its population total. The 11 municipality values also sum exactly to the published national value for population and every category.
2. Wave coverage passed. The product contains all three waves announced by table 213.001d: 2010, 2015, and 2020.
3. Geometry passed. The output has 11 non-empty valid features and 11 distinct SHA-256 hashes of the output geometries.
4. Provenance passed. The manifest records the URL, retrieval date, byte size, and SHA-256 for every raw workbook, boundary object, metadata object, and terms object used by the build.

No hard gate failed.
