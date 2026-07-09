# Slovakia census religion wave-extension probe

Probe date: 2026-07-09.

Source context: `research/countries/sk/README.md` records the current Slovakia build as a 2021-only SODB product and flags the SODB previous-censuses page as the unresolved route for 1991, 2001, and 2011.

## Bottom Line

The recommended extraction route is SODB/Infostat HTML for 1991 and 2001 and SODB 2011 multidimensional XLS tables for 2011. The current `data.statistics.sk` open API works, but its collection did not expose a religion or census cube matching `náboženské vyznanie`, `nabožensk*`, `vyznanie`, `religion`, `belief`, `census`, or `SODB` during this probe. The 2011 DATAcube link from SODB opens a JavaScript DATAcube folder route, but no replayable JSON-stat religion dataset URL was pinned.

## DATAcube And Open API

SUSR's open-data API documentation is at `https://data.statistics.sk/api/`. The API collection endpoint is:

```sh
curl -k -L -sS 'https://data.statistics.sk/api/v2/collection?lang=en'
```

Normalised fetched fragment:

```json
{
  "class": "collection",
  "label": "JSON-stat Dataset Collection",
  "items": 668,
  "first_item": {
    "href": "https://data.statistics.sk/api/v2/dataset/as1001rs/as1001rs_rok/as1001rs_ukaz/as1001rs_poh?lang=en",
    "label": "Population and attributes of age",
    "update": "2025-12-19"
  }
}
```

The API documentation states that access is free, requires no registration, supports JSON-stat/CSV/XML/XLSX/ODS, uses the Creative Commons Attribution License 4.0, and builds dataset URLs as:

```text
https://data.statistics.sk/api/v2/dataset/cube_code/PARAM1/PARAM2/PARAM3...?lang=lang_code&type=file_type
```

Fetched fragment from `https://data.statistics.sk/api/html/help-en.html`:

```text
Access to data is free and does not require registration.
All information is subject to the license terms of the Creative Commons Attribution License (cc-by) 4.0.
Overview of all tables available in the API via the URL https://data.statistics.sk/api/v2/collection?lang=en in JSON-stat format.
The amount of data transmitted by one URL link is a maximum of 10000 items.
```

The collection search for Slovak and English religion/census terms returned no relevant cubes:

```sh
curl -k -L -sS 'https://data.statistics.sk/api/v2/collection?lang=sk' \
  | jq -r '.link.item[] | [.href,.label,.update] | @tsv' \
  | rg -i 'nábož|nabož|vyzn|sčít|scit|sodb|census|viero'

curl -k -L -sS 'https://data.statistics.sk/api/v2/collection?lang=en' \
  | jq -r '.link.item[] | [.href,.label,.update] | @tsv' \
  | rg -i 'relig|belief|confess|census|sodb'
```

Fetched fragment:

```text
# no matching rows
```

DATAcube itself has the SODB 2011 folder route advertised on the SODB previous-censuses page:

```text
http://datacube.statistics.sk/#!/folder/sk/1000398
```

A Vaadin bootstrap request loaded the DATAcube application and preserved the requested fragment in the response state, but the returned tree did not expose a SODB 2011 religion cube code or a JSON-stat dataset route. Treat DATAcube as unpinned for this extraction until a cube code and replayable API URL are found.

## SODB Previous-Census Routes

The SODB previous-censuses page is the source of record for the older routes:

```sh
curl -k -L -sS 'https://www.scitanie.sk/en/data-from-the-previous-censuses-since-1991' \
  | rg -n 'DATAcube|hyper|2011|2001|1991|infostat|archiv|census2011'
```

Fetched fragment:

```text
253: <h2 class="b-typo-h2">2011 Census results</h2>
256: <a class="d-link" href="http://datacube.statistics.sk/#!/folder/sk/1000398" target="_blank">Results from the 2011 Population and Housing Census in DATAcube.</a>
259: <a class="d-link" href="https://archiv.statistics.sk/open_data/data/sodb_2011/" target="_blank">Results from the 2011 Population and Housing Census in hyper-cubes</a>
262: <a class="d-link" href="https://census2011.statistics.sk/tabulky.html" target="_blank">Results from the 2011 Population and Housing Census in multidimensional tables</a>
274: <a class="d-link" href="http://sodb.infostat.sk/scitanie/sk/2001/format.htm" target="_blank">Results of the 2001 Population and Housing Census</a>
283: <a class="d-link" href="http://sodb.infostat.sk/scitanie/sk/1991/format.htm" target="_blank">Results from the 1991 Population and Housing Census</a>
```

## 1991 Findings

1991 religion data are available through Infostat HTML tables at national, reporting-region, district/Bratislava-obvod, and municipality level. The direct table endpoint is `data118.aspx`.

Format: HTML tables served as `text/html; charset=utf-8`. No XLS, CSV, or PDF export route was found on the Infostat 1991 pages.

Lowest geography found in machine-readable form: municipality pages reached through district pages. Example:

```sh
curl -sS -I 'http://sodb.infostat.sk/scitanie/sk/1991/data118.aspx?u=501441&okr=420202'
```

Fetched fragment:

```text
HTTP/1.1 200 OK
Content-Length: 9481
Content-Type: text/html; charset=utf-8
```

HTML table fragment:

```text
1991 obec Báč | Báč | Obyvateľstvo podľa pohlavia a náboženstva
Náboženské vyznanie / cirkev | Muži | Ženy | Spolu
Bez vyznania | 10 | 2 | 12
Rímskokatolícke | 158 | 316 | 474
Nezistené | 7 | 109 | 116
Spolu | 178 | 428 | 606
```

National route:

```text
http://sodb.infostat.sk/scitanie/sk/1991/data118.aspx?u=100000&okr=0
```

National fetched fragment:

```text
SLOVENSKÁ REPUBLIKA | Obyvateľstvo podľa pohlavia a náboženstva
Bez vyznania | 277 508 | 238 043 | 515 551
Rímskokatolícke | 1 520 559 | 1 666 824 | 3 187 383
Nezistené | 469 764 | 448 071 | 917 835
Spolu | 2 574 061 | 2 700 274 | 5 274 335
```

National category list:

```text
Bez vyznania
Rímskokatolícke
Gréckokatolícke
Pravoslávne
Čs. husitské
Evanjelická cirkev
Ostatné
Nezistené
Spolu
```

District example:

```text
http://sodb.infostat.sk/scitanie/sk/1991/data118.aspx?txtUroven=420202&okr=0
```

Fetched fragment:

```text
1991 okres Dunajská Streda | Okres Dunajská Streda | Obyvateľstvo podľa pohlavia a náboženstva
Náboženské vyznanie / cirkev | Muži | Ženy | Spolu
Bez vyznania | 4 674 | 4 084 | 8 758
Rímskokatolícke | 35 594 | 37 352 | 72 946
Nezistené | 9 069 | 8 482 | 17 551
Spolu | 54 062 | 55 283 | 109 345
```

Geography used by the source: the 1991 navigation has 42 terminal district/obvod rows. It uses `Hlavné mesto SR Bratislava`, `Obvod Bratislava I` to `Obvod Bratislava V`, `Okres Bratislava - vidiek`, and the three wider reporting regions `Západné Slovensko`, `Stredné Slovensko`, and `Východné Slovensko`. Slovakia had 38 okresy in 1991; the source's 42 terminal rows reflect its own Bratislava obvod and district/obvod reporting layout. The source does not use the eight current kraje, which were created after 1991.

Navigation fragment:

```text
d.add(1,0,'Hlavné mesto SR Bratislava','data111a.aspx?txtUroven=210000&okr=0',...)
d.add(2,1,'Obvod Bratislava I','data111a.aspx?txtUroven=410101&okr=0',...,'navig/tabulky.gif')
d.add(7,0,'Západné Slovensko','data111a.aspx?txtUroven=220000&okr=0',...)
d.add(33,0,'Východné Slovensko','data111a.aspx?txtUroven=240000&okr=0',...)
```

## 2001 Findings

2001 religion data are available through Infostat HTML tables at national, oblast, kraj, okres, and municipality level. The direct table endpoint is also `data118.aspx`.

Format: HTML tables served as `text/html; charset=utf-8`. No XLS, CSV, or PDF export route was found on the Infostat 2001 pages.

Kraj availability was verified with Trnavský kraj:

```sh
curl -sS -I 'http://sodb.infostat.sk/scitanie/sk/2001/data118.aspx?txtUroven=320200&okr=0'
```

Fetched fragment:

```text
HTTP/1.1 200 OK
Content-Length: 14161
Content-Type: text/html; charset=utf-8
```

Table fragment:

```text
2001 kraj Trnavský | Trnavský kraj | Obyvateľstvo podľa pohlavia a náboženstva
Náboženské vyznanie / cirkev | Muži | Ženy | Spolu
Rímskokatolícka cirkev | 205 833 | 225 321 | 431 154
Gréckokatolícka cirkev | 495 | 542 | 1 037
Nezistené | 7 363 | 6 304 | 13 667
Spolu | 268 473 | 282 530 | 551 003
```

Okres availability was verified with Okres Galanta:

```text
http://sodb.infostat.sk/scitanie/sk/2001/data118.aspx?txtUroven=420202&okr=0
```

Fetched fragment:

```text
2001 okres Galanta | Okres Galanta | Obyvateľstvo podľa pohlavia a náboženstva
Náboženské vyznanie / cirkev | Muži | Ženy | Spolu
Rímskokatolícka cirkev | 34 710 | 38 055 | 72 765
Gréckokatolícka cirkev | 62 | 83 | 145
Nezistené | 971 | 854 | 1 825
Spolu | 46 071 | 48 462 | 94 533
```

Municipality availability was verified with Galanta:

```text
http://sodb.infostat.sk/scitanie/sk/2001/data118.aspx?u=503665&okr=420202
```

Fetched fragment:

```text
2001 obec Galanta | Galanta | Obyvateľstvo podľa pohlavia a náboženstva
Náboženské vyznanie / cirkev | Muži | Ženy | Spolu
Rímskokatolícka cirkev | 5 054 | 5 919 | 10 973
Gréckokatolícka cirkev | 14 | 15 | 29
Nezistené | 313 | 254 | 567
Spolu | 7 845 | 8 520 | 16 365
```

National route:

```text
http://sodb.infostat.sk/scitanie/sk/2001/data118.aspx?u=100000&okr=0
```

National fetched fragment:

```text
SLOVENSKÁ REPUBLIKA | Obyvateľstvo podľa pohlavia a náboženstva
Rímskokatolícka cirkev | 1 760 553 | 1 947 567 | 3 708 120
Gréckokatolícka cirkev | 106 502 | 113 329 | 219 831
Bez vyznania | 382 377 | 314 931 | 697 308
Nezistené | 85 607 | 74 991 | 160 598
Spolu | 2 612 515 | 2 766 940 | 5 379 455
```

National category list:

```text
Rímskokatolícka cirkev
Gréckokatolícka cirkev
Pravoslávna cirkev
Evanjelická cirkev augsburského vyznania
Reformovaná kresťanská cirkev
Evanjelická cirkev metodistická
Apoštolská cirkev
Starokatolícka cirkev
Bratská jednota baptistov
Cirkev československá husitská
Cirkev adventistov siedmeho dňa
Cirkev bratská
Kresťanské zbory
Židovské náboženské obce
Náboženská spoločnosť Jehovovi svedkovia
Ostatné
Bez vyznania
Nezistené
Spolu
```

Geography used by the source: the 2001 navigation has 79 terminal district rows and explicit eight-kraj entries below oblast entries. Example:

```text
d.add(12,11,'Trnavský kraj','data111a.aspx?txtUroven=320200&okr=0',...)
d.add(14,12,'Galanta','data111a.aspx?txtUroven=420202&okr=0',...,'navig/tabulky.gif')
```

## 2011 Findings

2011 religion data are available through SODB 2011 multidimensional XLS tables at national, oblast, kraj, okres, and municipality level. The religion table is `TAB. 118 Obyvateľstvo podľa pohlavia a náboženského vyznania`; `TAB. 159` adds age groups.

The multidimensional-table JSON route exposes the tree:

```sh
curl -k -L -sS 'https://census2011.statistics.sk/data.php' \
  | jq -r '.[] | select(.data.title|test("TAB. 118|TAB. 159|kraj|Slovensko")) | [.data.title, .data.attr.href // "folder"] | @tsv'
```

Fetched fragment:

```text
Bratislavský kraj    folder
Stredné Slovensko    folder
Východné Slovensko   folder
Západné Slovensko    folder
TAB. 118 Obyvateľstvo podľa pohlavia a náboženského vyznania    SR/TAB.%20118%20Obyvate%C4%BEstvo%20pod%C4%BEa%20pohlavia%20a%20n%C3%A1bo%C5%BEensk%C3%A9ho%20vyznania.xls
TAB. 159 Obyvateľstvo podľa vekových skupín, pohlavia a náboženského vyznania    SR/TAB.%20159%20Obyvate%C4%BEstvo%20pod%C4%BEa%20vekov%C3%BDch%20skup%C3%ADn,%20pohlavia%20a%20n%C3%A1bo%C5%BEensk%C3%A9ho%20vyznania.xls
```

National XLS route:

```text
https://census2011.statistics.sk/SR/TAB.%20118%20Obyvate%C4%BEstvo%20pod%C4%BEa%20pohlavia%20a%20n%C3%A1bo%C5%BEensk%C3%A9ho%20vyznania.xls
```

Fetched fragment:

```text
HTTP/1.1 200 OK
Content-Length: 27136
Content-Type: application/vnd.ms-excel
00000000: d0cf 11e0 a1b1 1ae1 0000 0000 0000 0000  ................
```

National category list from the XLS:

```text
Rímskokatolícka cirkev
Gréckokatolícka cirkev
Pravoslávna cirkev
Evanjelická cirkev augsburského vyznania
Reformovaná kresťanská cirkev
Evanjelická cirkev metodistická
Apoštolská cirkev
Starokatolícka cirkev
Bratská jednota baptistov
Cirkev československá husitská
Cirkev adventistov siedmeho dňa
Cirkev bratská
Kresťanské zbory
Ústredný zväz židovských náboženských obcí
Náboženská spoločnosť Jehovovi svedkovia
Novoapoštolská cirkev
Bahájske spoločenstvo
Cirkev Ježiša Krista Svätých neskorších dní
Bez vyznania
Iné
Nezistené
Spolu
```

Oblast, kraj, okres, and municipality routes were verified through `data.php`:

```sh
curl -k -L -sS 'https://census2011.statistics.sk/data.php?id=SR%2FZ%C3%A1padn%C3%A9+Slovensko'
curl -k -L -sS 'https://census2011.statistics.sk/data.php?id=SR%2FZ%C3%A1padn%C3%A9+Slovensko%2FTrnavsk%C3%BD+kraj'
curl -k -L -sS 'https://census2011.statistics.sk/data.php?id=SR%2FZ%C3%A1padn%C3%A9+Slovensko%2FTrnavsk%C3%BD+kraj%2FOkres+Galanta'
curl -k -L -sS 'https://census2011.statistics.sk/data.php?id=SR%2FZ%C3%A1padn%C3%A9+Slovensko%2FTrnavsk%C3%BD+kraj%2FOkres+Galanta%2FGalanta'
```

Fetched fragments:

```text
Západné Slovensko:
Nitriansky kraj    folder
Trenčiansky kraj   folder
Trnavský kraj      folder
TAB. 118 ... náboženského vyznania    SR/Z%C3%A1padn%C3%A9%20Slovensko/TAB.%20118...

Trnavský kraj:
Okres Dunajská Streda    folder
Okres Galanta            folder
Okres Hlohovec           folder
TAB. 118 ... náboženského vyznania    SR/Z%C3%A1padn%C3%A9%20Slovensko/Trnavsk%C3%BD%20kraj/TAB.%20118...

Okres Galanta:
Galanta    folder
TAB. 118 ... náboženského vyznania    SR/Z%C3%A1padn%C3%A9%20Slovensko/Trnavsk%C3%BD%20kraj/Okres%20Galanta/TAB.%20118...

Galanta:
TAB. 118 ... náboženského vyznania    SR/Z%C3%A1padn%C3%A9%20Slovensko/Trnavsk%C3%BD%20kraj/Okres%20Galanta/Galanta/TAB.%20118...
```

Municipality XLS route verified with Malacky:

```text
https://census2011.statistics.sk/SR/Bratislavsk%C3%BD%20kraj/Bratislavsk%C3%BD%20kraj/Okres%20Malacky/Malacky/TAB.%20118%20Obyvate%C4%BEstvo%20pod%C4%BEa%20pohlavia%20a%20n%C3%A1bo%C5%BEensk%C3%A9ho%20vyznania.xls
```

Fetched fragment:

```text
HTTP/1.1 200 OK
Content-Length: 27136
Content-Type: application/vnd.ms-excel
00000000: d0cf 11e0 a1b1 1ae1 0000 0000 0000 0000  ................
```

2011 hyper-cubes are CSV files with metadata and codelist XLSX files, but the listed hyper-cubes do not include religion. The route is useful for geography code lists, not for this religion extraction.

```sh
curl -k -L -sS 'https://archiv.statistics.sk/open_data/data/sodb_2011/' \
  | rg -n 'CSV|obce|Meta|SODB2011|hypercube|cisel|Eurostat'
```

Fetched fragment:

```text
45: Dáta sú štatisticky spracované v územných štruktúrach za Slovenskú republiku, oblasti, kraje a okresy.
45: Tam, kde to systém ochrany údajov umožňuje, sprístupňujeme údaje až do úrovne obcí.
51: súbory sú uložené v *.CSV formáte a obsahujú viac ako 1 048 576 riadkov.
53: metadata/Metaudaje.pdf
53: metadata/SODB2011_ciselniky_Eurostat.xlsx
54: metadata/SODB2011_hypercube.xlsx
```

The 2011 hypercube metadata confirms a geography codelist:

```text
SODB2011_ciselniky_Eurostat.xlsx
SHEET GEO. max 2943 2
SK | Slovensko
SK0 | Slovensko
SK01 | Bratislavský kraj NUTS2
SK010 | Bratislavský kraj
SK010_500267 | Záhorie (vojenský obvod)
SK010_503681 | Boldog
```

## Geography Vintages And Correspondence

1991 source geography is census-era Infostat geography. The source uses Bratislava obvody, 42 terminal district/obvod rows, and the three broad reporting regions plus Bratislava. It does not use current kraje.

2001 source geography is the post-1996 structure: oblast entries, eight kraje, 79 okresy, and municipality pages. The same numeric code can refer to a different district across waves: `420202` is Okres Dunajská Streda in 1991 and Okres Galanta in 2001. Extraction must therefore keep the census year and source hierarchy with each code.

2011 multidimensional tables use a source tree with `SR`, oblast, kraj, okres, and municipality/city route segments. The archived 2011 hypercube codelist uses NUTS-style codes for national, oblast, and kraj rows, then combines the NUTS3 prefix and municipality code for municipality rows.

SUSR portal probes found code-list and register landing routes, and the open API has current territorial dimensions such as `nuts13`, `nuts14`, `nuts15`, and municipality dimensions in non-census demographic tables.

```sh
curl -k -L -sS 'https://data.statistics.sk/api/v2/collection?lang=en' \
  | jq -r '.link.item[] | [.href,.label] | @tsv' \
  | rg -i 'territ|municip|district|region|register|code|settlement|spatial|administrative'

curl -k -L -sS -I 'https://slovak.statistics.sk/wps/portal/ext/services/infoservis/ciselniky'
curl -k -L -sS -I 'https://slovak.statistics.sk/wps/portal/ext/services/infoservis/registre'
```

Fetched fragments:

```text
https://data.statistics.sk/api/v2/dataset/om7010rr/om7010rr_obc/om7010rr_obd/om7010rr_ukaz?lang=en    Stock and Change of the Population - Municipalities
https://data.statistics.sk/api/v2/dataset/om7011rr/om7011rr_vuc/om7011rr_obd/om7011rr_ukaz?lang=en    Stock and Change of the Population-SR-Area-Reg-District, U-R
https://data.statistics.sk/api/v2/dataset/pl5001rr/nuts15/pl5001rr_rok/pl5001rr_ukaz?lang=en    Land area, land use - SR-Areas-Regions-Districts-Municipalities

HTTP/1.1 302 Found
Location: https://slovak.statistics.sk/wps/portal/ext/services/infoservis/ciselniky/...

HTTP/1.1 302 Found
Location: https://slovak.statistics.sk/wps/portal/ext/services/infoservis/registre/...
```

The probe did not locate an official SUSR correspondence table from 1991/2001 geography to current municipality or district units. The extraction lane should therefore preserve each wave on its source geography unless a later probe pins an official correspondence file.

## Licence Notes

DATAcube/open API: `data.statistics.sk/api/html/help-en.html` states that API access is free, requires no registration, and is under Creative Commons Attribution 4.0.

SODB/Infostat 1991 and 2001: table pages identify the source as `Štatistický úrad Slovenskej republiky`. The exact previous-census reuse licence was not located in this probe. Attribute SUSR and link the exact route.

SODB 2011 multidimensional and hypercube routes: the source is the SODB 2011 archive under SUSR domains. The exact reuse licence was not located on the archive pages during this probe. Attribute SUSR and keep source URLs with retrieval dates.

## Recommended Extraction Route

1. Use Infostat `data118.aspx` HTML for 1991 and 2001. Extract tables by year, source hierarchy code, display geography name, sex, religion category, and count. Keep year-specific geography codes.
2. Use SODB 2011 multidimensional `TAB. 118` XLS files for 2011 religion by sex and geography. Use `data.php` to enumerate folders and XLS links. Use `TAB. 159` only if age-by-religion is needed.
3. Use the 2011 hypercube metadata only to assist with code-list interpretation. Do not use the hypercube CSVs for religion unless a separate religion hypercube is later found.
4. Defer DATAcube JSON-stat extraction for these waves until a religion cube code and replayable dataset URL are pinned. The current open API catalogue did not list one.
5. Defer cross-wave change products at municipality or current-boundary level until an official SUSR correspondence file is found. For now, publish older waves only at their source geography or aggregate them to an agreed common geography with a documented manual concordance.
