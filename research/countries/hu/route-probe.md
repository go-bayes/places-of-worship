# Hungary census-religion route probe

## Probe result

Hungarian Central Statistical Office (KSH) dataflow `WBS008`, API publication `V67`, is the source of record for the three-wave product. It publishes the complete religion classification for 2001, 2011, and 2022 at county level, with settlement type as a separate dimension. County is therefore the finest geography available with the full category set in all three waves.

The KSH releases do not support a complete three-wave settlement product. KSH's separate settlement map advertises settlement religion indicators for 2011 and 2022 only, and its indicator table contains four religion shares: Roman Catholic, Greek Catholic, Calvinist, and Lutheran. The separate district religion visualisation covers 2022 only.

## Pinned endpoints

- **Current API publication**: `GET https://nepszamlalas2022.ksh.hu/api/version` returned `V67` on 2026-07-10.
- **English dataflow index**: `GET https://nepszamlalas2022.ksh.hu/api/index/V67/en` identifies `WBS008` as “Population by religion, county and type of settlement”.
- **Bilingual structure and codelists**: `GET https://nepszamlalas2022.ksh.hu/api/structure/WBS008/V67`.
- **County observations used by the build**: `GET https://nepszamlalas2022.ksh.hu/api/dataflows/WBS008/V67/d/TIME_PERIOD,TERUL_GEO3:HU110+HU120+HU211+HU212+HU213+HU221+HU222+HU223+HU231+HU232+HU233+HU311+HU312+HU313+HU321+HU322+HU323+HU331+HU332+HU333,TERUL_TELTIP2:HU,VALLAS_V2`.
- **Published national rows used for reconciliation**: `GET https://nepszamlalas2022.ksh.hu/api/dataflows/WBS008/V67/d/TIME_PERIOD,TERUL_GEO3:HU,TERUL_TELTIP2:HU,VALLAS_V2`.
- **Settlement-map indicator catalogue**: `GET https://map.ksh.hu/arcgis/rest/services/nsz_ksh_map/MapServer/8/query?where=MUTATO_FOCSOP%3D%27J%27&outFields=*&returnGeometry=false&f=json`.
- **Settlement-map observation layer**: `GET https://map.ksh.hu/arcgis/rest/services/nsz_ksh_map/MapServer/2/query?where=M_KOD%20LIKE%20%27TYWJ%25%27&outFields=*&returnGeometry=false&f=json`.
- **2022 district presentation**: `https://nepszamlalas2022.ksh.hu/eredmenyek/vizualizaciok/vallas/`.

## Waves and geography

| Wave | Complete county rows | Published religion rows including total | Mutually exclusive categories excluding total | Settlement route |
| --- | ---: | ---: | ---: | --- |
| 2001 | 20 | 28 | 25 | No complete religion export pinned |
| 2011 | 20 | 28 | 25 | Four shares in the settlement map |
| 2022 | 20 | 29 | 26 | Four shares in the settlement map |

The 2022 classification adds `Ukrán ortodox` (Ukrainian Orthodox), which is absent from the 2001 and 2011 rows. `Katolikus` (Catholic) is a mutually exclusive parent category. `Katolikuson belül római katolikus` and `Katolikuson belül görögkatolikus` are detail rows within Catholic and must not be summed again.

## Source categories

| Code | Hungarian source name | English display label | Waves | Product role |
| --- | --- | --- | --- | --- |
| `TOTAL` | Összesen | Total | 2001, 2011, 2022 | total |
| `RE_C` | Katolikus | Catholic | 2001, 2011, 2022 | named religion |
| `RE_RC` | Katolikuson belül római katolikus | Roman Catholic among Catholics | 2001, 2011, 2022 | Catholic detail |
| `RE_GC` | Katolikuson belül görögkatolikus | Greek Catholic among Catholics | 2001, 2011, 2022 | Catholic detail |
| `RE_OG` | Görög ortodox | Greek Orthodox | 2001, 2011, 2022 | named religion |
| `RE_ORU` | Orosz ortodox | Russian Orthodox | 2001, 2011, 2022 | named religion |
| `RE_OS` | Szerb ortodox | Serbian Orthodox | 2001, 2011, 2022 | named religion |
| `RE_OB` | Bolgár ortodox | Bulgarian Orthodox | 2001, 2011, 2022 | named religion |
| `RE_ORO` | Román ortodox | Romanian Orthodox | 2001, 2011, 2022 | named religion |
| `RE_OU` | Ukrán ortodox | Ukrainian Orthodox | 2022 | named religion |
| `RE_OO` | Más ortodox | Other Orthodox | 2001, 2011, 2022 | named religion |
| `RE_CA` | Református | Calvinist | 2001, 2011, 2022 | named religion |
| `RE_LU` | Evangélikus | Lutheran | 2001, 2011, 2022 | named religion |
| `RE_UN` | Unitárius | Unitarian | 2001, 2011, 2022 | named religion |
| `RE_BA` | Baptista | Baptist | 2001, 2011, 2022 | named religion |
| `RE_ME` | Metodista | Methodist | 2001, 2011, 2022 | named religion |
| `RE_AD` | Adventista | Adventist | 2001, 2011, 2022 | named religion |
| `RE_PE` | Pünkösdi | Pentecostal | 2001, 2011, 2022 | named religion |
| `RE_AN` | Anglikán | Anglican | 2001, 2011, 2022 | named religion |
| `RE_JW` | Jehova tanúi | Jehovah's Witnesses | 2001, 2011, 2022 | named religion |
| `RE_FC` | Hit Gyülekezete | Faith Church | 2001, 2011, 2022 | named religion |
| `RE_CO` | Más keresztény felekezet | Other Christian | 2001, 2011, 2022 | named religion |
| `RE_J` | Izraelita | Jewish | 2001, 2011, 2022 | named religion |
| `RE_M` | Muszlim | Muslim | 2001, 2011, 2022 | named religion |
| `RE_B` | Buddhista | Buddhist | 2001, 2011, 2022 | named religion |
| `RE_H` | Hindu | Hindus | 2001, 2011, 2022 | named religion |
| `RE_OCD2` | Más vallási közösséghez, felekezethez tartozó | Other church, denomination | 2001, 2011, 2022 | named religion |
| `RE_NOT` | Nem vallásos | Not belong to any church, denomination | 2001, 2011, 2022 | no religion |
| `RE_NA` | Nem válaszolt | No answer | 2001, 2011, 2022 | non-response |

KSH publishes no separate refusal or unknown row in `WBS008`. `Nem válaszolt` remains the single published non-response category. The build does not split it, rename it as refusal or unknown, or fold it into another category.

## Denominator decision

The headline percentages use the stated-response denominator: `TOTAL - RE_NA`. KSH's own 2022 district visualisation is titled “share of the religious population among respondents”. KSH's final release states that 60% of the population answered the voluntary religion question and that 73% of respondents reported a religious affiliation. The product applies this source presentation consistently to 2001, 2011, and 2022.

National `Nem válaszolt` shares are 10.8286% in 2001, 27.1578% in 2011, and 40.1154% in 2022. The 2022 count is 3,852,533 of 9,603,634 residents. The responding share of the population changed substantially across waves; cross-wave share changes may therefore reflect changing respondent composition as well as changing affiliation. The change metric compares stated-response shares only.

## Boundaries

The primary boundary is the Geographic Information System of the Commission, Eurostat (GISCO), Nomenclature of Territorial Units for Statistics (NUTS) level 3 2021 layer at 1:1 million in EPSG:4326. The cached endpoint is `https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_01M_2021_4326_LEVL_3.geojson`. The file contains the same 20 Hungarian NUTS level 3 codes used by KSH `WBS008`. The build filters the all-Europe file, calculates area in EPSG:3035, and simplifies the Hungary layer through `scripts/lib/simplify_boundary.R`.

Geometric stability of Hungarian county boundaries across 2001, 2011, and 2022 was not verified. The single 2021 frame join rests on identity of the 20 NUTS level 3 codes in KSH `WBS008` and GISCO.

The boundary is independent of OpenStreetMap. Eurostat's GISCO download provisions and general reuse policy apply; the product attributes Eurostat GISCO and preserves `© EuroGeographics for the administrative boundaries`. No broader open-licence claim is made for the geometry.

## Terms

KSH's Census 2022 terms apply Creative Commons Attribution 4.0 International to site content and require attribution as KSH. Section 3.3 bars commercial use of files individually selected from KSH internal databases but states that this restriction does not extend to independently copyrightable works produced from those files. The manifest records both the general licence and the database-selection caveat.

## Build decision

Ship 60 county-year rows on the 2021 NUTS 3 frame. Preserve every KSH source row and bilingual label in the manifest. Use `Katolikus` once in the named-religion sum, retain its two detail rows for reconciliation, calculate affiliation and no-religion shares over stated responses, and retain `Nem válaszolt` as its own source category.
