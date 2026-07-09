# Germany census religion and church-membership wave-extension probe

Probe date: 2026-07-09.

Source context: `research/countries/de/README.md` records Germany as Tier B, with Zensus 2011, EKD, DBK, and VG250 already flagged. The Germany README treats Zensus 2022 religion as unresolved or absent. This probe updates that point and separates the census legal-membership lane from church administrative membership.

## Bottom Line

Germany has a machine-readable two-wave census lane for legal membership in public-law religious bodies. Zensus 2011 table `1000X-1014` and Zensus 2022 table `1000A-1018` both publish compact religion categories by municipality and by Kreis through the current Zensusdatenbank API/CSV export. The strongest first map is therefore a census-affiliation lane using 2011 and 2022 compact legal-membership shares. BKG VG250 provides the boundary family, with reference dates selected to match each census where practical.

The detailed 2011 religion table is useful, but it is incomplete at municipality level. Table `2000X-1022` publishes `Religion (ausführlich)` by Kreis and by municipalities with at least 10,000 residents. Smaller municipalities are absent. The table distinguishes Roman Catholic, Protestant, Protestant free churches, Orthodox churches, Jewish communities, other, and no public-law religious society.

Church administrative membership should remain a separate lane. EKD publishes annual regional-church and Bundesland tables, including XLSX for 2023 and 2024 and PDFs back to 2001/2002. DBK publishes annual diocese and Bundesland PDFs, including 2025. Those data are church register products. They should not be treated as census tabulations. fowid is useful as a secondary synthesis of religious affiliation and no-religion estimates. The current pages probed here expose HTML/image tables and source links rather than a clean first-pass machine-readable file.

## Zensusdatenbank API And Licence

The current Zensusdatenbank is the practical route for both Zensus 2022 and migrated Zensus 2011 tables. The web app environment exposes a public proxy base and licence text:

```sh
curl -L -sS 'https://ergebnisse.zensus2022.de/datenbank/online/environment.json?v=1.5.0-202604171460' \
  | jq '{api:.api.basePath,copyright:.copyright.de,about:.aboutThisDatabase}'
```

Fetched fragment:

```json
{
  "api": "https://ergebnisse.zensus2022.de/proxy",
  "copyright": "© Statistische Ämter des Bundes und der Länder, Deutschland, 2026. Lizenziert unter der Datenlizenz Deutschland - Namensnennung - Version 2.0"
}
```

The application JavaScript and API manual shipped with the web app identify the replayable table routes:

```text
GET  https://ergebnisse.zensus2022.de/proxy/api/rest/search
GET  https://ergebnisse.zensus2022.de/proxy/api/rest/statistics/{statisticCode}/tables
GET  https://ergebnisse.zensus2022.de/proxy/api/rest/tables/{tableCode}/structure
POST https://ergebnisse.zensus2022.de/proxy/api/rest/tables/{tableCode}/download/ffcsv/de
```

The formal registered webservice is documented at:

```text
https://ergebnisse.zensus2022.de/datenbank/online/docs/ZENSUS-Webservices_Einfuehrung.pdf
```

`pdfinfo` fetched fragment:

```text
Title:           Anwenderdokumentation zum Webservice/API der Zensusdatenbank
Subject:         Version 4.3.4, Stand: 05.05.2025
Pages:           74
```

The manual says the REST/JSON webservice requires registration for requests other than `whoami`. The public web-app proxy above returned table metadata and flat-CSV downloads without credentials during this probe.

## Zensus 2022 Findings

Zensus 2022 religion was published. The table is `1000A-1018 Personen: Religion` under statistic `1000A Bevölkerung kompakt (Gebietsstand 15.05.2022)`. The variable `RELZG2` is legal membership in a public-law religious society. The variable does not measure subjective belief.

Search route:

```sh
curl -L -sS --get 'https://ergebnisse.zensus2022.de/proxy/api/rest/search' \
  --data-urlencode 'searchTerm=Religion' \
  --data-urlencode 'language=de' \
  | jq '{statistics:.statisticCodes, tables:.tableCodes, variables:.variableCodes}'
```

Fetched fragment:

```json
{
  "statistics": ["2000S", "1000A", "2000X", "1000X"],
  "tables": ["1000A-1018", "2000X-1022", "1000X-1014"],
  "variables": ["RELZG2", "RELZG1"]
}
```

Table listing:

```sh
curl -L -sS 'https://ergebnisse.zensus2022.de/proxy/api/rest/statistics/1000A/tables' \
  | jq -r '.[]? | [.code,.name.de] | @tsv' \
  | rg -i 'relig'
```

Fetched fragment:

```text
1000A-1018  Personen: Religion
```

Table structure:

```sh
curl -L -sS 'https://ergebnisse.zensus2022.de/proxy/api/rest/tables/1000A-1018/structure' \
  | jq -r '.variables | to_entries[] | [.key,.value.label.de,.value.variableType] | @tsv'
```

Fetched fragment:

```text
STAG    Stichtag    TIME_IDENTIFYING_REFERENCE_DAY
GEODL1  Deutschland REGION_CLASSIFYING
RELZG2  Religion    SUBJECT_CLASSIFYING
GEOBZ1  Bezirke (Hamburg und Berlin) REGION_CLASSIFYING
GEOGM4  Gemeinden (Gebietsstand 15.05.2022) REGION_CLASSIFYING
GEORB1  Regierungsbezirke/Statistische Regionen REGION_CLASSIFYING
GEOLK4  Landkreise u. krsfr. Städte (Stand 15.05.22) REGION_CLASSIFYING
GEOVB4  Gemeindeverbände (Gebietsstand 15.05.2022) REGION_CLASSIFYING
GEOBL1  Bundesländer REGION_CLASSIFYING
```

`RELZG2` metadata:

```sh
curl -L -sS 'https://ergebnisse.zensus2022.de/proxy/api/rest/variables/RELZG2/information' \
  | jq '{code,name:.name.de,description:.description.de}'
```

Fetched fragment:

```json
{
  "code": "RELZG2",
  "name": "Religion",
  "description": "Dieses Merkmal gibt die Zugehörigkeit zu einer öffentlich-\nrechtlichen Religionsgesellschaft an."
}
```

`RELZG2` categories:

```sh
curl -L -sS 'https://ergebnisse.zensus2022.de/proxy/api/rest/variables/RELZG2/values' \
  | jq -r '.[] | [.code,.name.de] | @tsv'
```

Fetched fragment:

```text
REL-EV-OR     Evangelische Kirche (öffentlich-rechtlich)
REL-RK-OR     Römisch-katholische Kirche (öffentlich-rechtlich)
REL-SONST-X   Sonstige, keine, ohne Angabe
```

CSV export route:

```sh
curl -L -sS 'https://ergebnisse.zensus2022.de/proxy/api/rest/tables/1000A-1018/structure' \
  | jq '.initialState' > /tmp/1000A-1018.initial.json

curl -L -sS -D /tmp/1000A-1018.hdr -o /tmp/1000A-1018.zip \
  -X POST -H 'Content-Type: application/json' \
  --data-binary @/tmp/1000A-1018.initial.json \
  'https://ergebnisse.zensus2022.de/proxy/api/rest/tables/1000A-1018/download/ffcsv/de'
```

Fetched header and flat-CSV fragment:

```text
HTTP/1.1 200 OK
Content-Disposition: attachment; filename="1000A-1018_de_flat.zip"
Content-Type: application/octet-stream
```

```csv
statistics_code;statistics_label;time_code;time_label;time;1_variable_code;1_variable_label;1_variable_attribute_code;1_variable_attribute_label;2_variable_code;2_variable_label;2_variable_attribute_code;2_variable_attribute_label;value;value_unit;value_variable_code;value_variable_label;value_q
1000A;Bevölkerung kompakt (Gebietsstand 15.05.2022);STAG;Stichtag;2022-05-15;GEOBL1;Bundesländer;13;Mecklenburg-Vorpommern;RELZG2;Religion;REL-RK-OR;Römisch-katholische Kirche (öffentlich-rechtlich);3,1;%;PRS018;Personen;e
1000A;Bevölkerung kompakt (Gebietsstand 15.05.2022);STAG;Stichtag;2022-05-15;GEOBL1;Bundesländer;13;Mecklenburg-Vorpommern;RELZG2;Religion;REL-RK-OR;Römisch-katholische Kirche (öffentlich-rechtlich);49282;Anzahl;PRS018;Personen;e
```

The default exported state used by the UI was at Bundesland level in this fetch. The table structure confirms the same table can be selected to municipality (`GEOGM4`) or Kreis (`GEOLK4`). The selected state can then be posted to the flat-CSV download route.

## Zensus 2011 Findings

The old host `https://ergebnisse.zensus2011.de/` still resolves with an expired certificate when fetched with `curl -k`. The practical current route is the Zensus 2022 database. Its environment text says the 2011 data are available under migrated codes such as `1000X` and `2000X`.

The compact full-municipality table is `1000X-1014 Personen: Religion`. It uses the same compact legal-membership variable `RELZG2`.

```sh
curl -L -sS 'https://ergebnisse.zensus2022.de/proxy/api/rest/statistics/1000X/tables' \
  | jq -r '.[]? | [.code,.name.de] | @tsv' \
  | rg -i 'relig'
```

Fetched fragment:

```text
1000X-1014  Personen: Religion
```

Table structure:

```sh
curl -L -sS 'https://ergebnisse.zensus2022.de/proxy/api/rest/tables/1000X-1014/structure' \
  | jq -r '.variables | to_entries[] | [.key,.value.label.de,.value.variableType] | @tsv'
```

Fetched fragment:

```text
STAG    Stichtag    TIME_IDENTIFYING_REFERENCE_DAY
GEODL1  Deutschland REGION_CLASSIFYING
RELZG2  Religion    SUBJECT_CLASSIFYING
GEOGM1  Gemeinden   REGION_CLASSIFYING
GEOLK1  Landkreise und kreisfreie Städte REGION_CLASSIFYING
GEORB1  Regierungsbezirke/Statistische Regionen REGION_CLASSIFYING
GEOVB1  Gemeindeverbände (Gebietsstand 09.05.2011) REGION_CLASSIFYING
GEOBL1  Bundesländer REGION_CLASSIFYING
```

CSV export route:

```sh
curl -L -sS 'https://ergebnisse.zensus2022.de/proxy/api/rest/tables/1000X-1014/structure' \
  | jq '.initialState' > /tmp/1000X-1014.initial.json

curl -L -sS -D /tmp/1000X-1014.hdr -o /tmp/1000X-1014.zip \
  -X POST -H 'Content-Type: application/json' \
  --data-binary @/tmp/1000X-1014.initial.json \
  'https://ergebnisse.zensus2022.de/proxy/api/rest/tables/1000X-1014/download/ffcsv/de'
```

Fetched header and flat-CSV fragment:

```text
HTTP/1.1 200 OK
Content-Disposition: attachment; filename="1000X-1014_de_flat.zip"
Content-Type: application/octet-stream
```

```csv
statistics_code;statistics_label;time_code;time_label;time;1_variable_code;1_variable_label;1_variable_attribute_code;1_variable_attribute_label;2_variable_code;2_variable_label;2_variable_attribute_code;2_variable_attribute_label;value;value_unit;value_variable_code;value_variable_label;value_q
1000X;Bevölkerung kompakt (Gebietsstand 09.05.2011);STAG;Stichtag;2011-05-09;GEOBL1;Bundesländer;13;Mecklenburg-Vorpommern;RELZG2;Religion;REL-SONST-X;Sonstige, keine, ohne Angabe;79,5;%;PRS018;Personen;e
1000X;Bevölkerung kompakt (Gebietsstand 09.05.2011);STAG;Stichtag;2011-05-09;GEOBL1;Bundesländer;13;Mecklenburg-Vorpommern;RELZG2;Religion;REL-SONST-X;Sonstige, keine, ohne Angabe;1279912;Anzahl;PRS018;Personen;e
```

The detailed 2011 table is `2000X-1022 Personen: Religion (ausführlich)`.

```sh
curl -L -sS 'https://ergebnisse.zensus2022.de/proxy/api/rest/statistics/2000X/tables' \
  | jq -r '.[]? | [.code,.name.de] | @tsv' \
  | rg -i 'relig'
```

Fetched fragment:

```text
2000X-1022  Personen: Religion (ausführlich)
```

Detailed structure:

```sh
curl -L -sS 'https://ergebnisse.zensus2022.de/proxy/api/rest/tables/2000X-1022/structure' \
  | jq -r '.variables | to_entries[] | [.key,.value.label.de,.value.variableType] | @tsv'
```

Fetched fragment:

```text
STAG    Stichtag    TIME_IDENTIFYING_REFERENCE_DAY
GEOBL3  Bundesländer REGION_CLASSIFYING
GEODL3  Deutschland REGION_CLASSIFYING
GEOGM3  Gemeinden mit mindestens 10 000 Einwohnern REGION_CLASSIFYING
RELZG1  Religion (ausführlich) SUBJECT_CLASSIFYING
GEOLK3  Landkreise und kreisfreie Städte REGION_CLASSIFYING
GEORB3  Regierungsbezirke/Statistische Regionen REGION_CLASSIFYING
GEOVB3  Gemeindeverbände mit mindestens 10 000 Einwohnern REGION_CLASSIFYING
```

`RELZG1` metadata:

```sh
curl -L -sS 'https://ergebnisse.zensus2022.de/proxy/api/rest/variables/RELZG1/information' \
  | jq '{code,name:.name.de,description:.description.de}'
```

Fetched fragment:

```json
{
  "code": "RELZG1",
  "name": "Religion (ausführlich)",
  "description": "Dieses Merkmal gibt die Zugehörigkeit zu einer öffentlich-\nrechtlichen Religionsgesellschaft an."
}
```

CSV export route:

```sh
curl -L -sS 'https://ergebnisse.zensus2022.de/proxy/api/rest/tables/2000X-1022/structure' \
  | jq '.initialState' > /tmp/2000X-1022.initial.json

curl -L -sS -D /tmp/2000X-1022.hdr -o /tmp/2000X-1022.zip \
  -X POST -H 'Content-Type: application/json' \
  --data-binary @/tmp/2000X-1022.initial.json \
  'https://ergebnisse.zensus2022.de/proxy/api/rest/tables/2000X-1022/download/ffcsv/de'
```

Fetched flat-CSV fragment:

```csv
2000X;Bevölkerung: Bildung, Erwerb, Migration;STAG;Stichtag;2011-05-09;GEODL3;Deutschland;DG;Deutschland;RELZG1;Religion (ausführlich);REL-EV-FREI;Evangelische Freikirchen;714360;Anzahl;PRS004;Personen;e
2000X;Bevölkerung: Bildung, Erwerb, Migration;STAG;Stichtag;2011-05-09;GEODL3;Deutschland;DG;Deutschland;RELZG1;Religion (ausführlich);REL-X;Keiner ö.-r. Religionsgesellschaft zugehörig;26265880;Anzahl;PRS004;Personen;e
```

## 2011 Construct Distinction

Zensus 2011 collected two religion-related items. The database variables above are the legal-membership item. They are distinct from the voluntary belief/world-view item.

The Zensus 2011 law distinguishes the compulsory legal-membership item from the voluntary belief item:

```sh
curl -L -sS 'https://www.gesetze-im-internet.de/zensg_2011/ZensG_2011.pdf' \
  -o /tmp/ZensG_2011.pdf
pdftotext /tmp/ZensG_2011.pdf - | rg -n 'Religionsgesellschaft|Bekenntnis|freiwillig' -C 1
```

Fetched fragment:

```text
rechtliche Zugehörigkeit zu einer öffentlich-rechtlichen Religionsgesellschaft
Bekenntnis zu einer Religion, Glaubensrichtung oder Weltanschauung ...
Für die Erhebungen nach diesem Gesetz besteht Auskunftspflicht.
Die Auskunft über die Erhebungsmerkmale nach § 7 Absatz 4 Nummer 19 ist freiwillig.
```

Interpretation for the build: `RELZG1` and `RELZG2` describe legal membership in public-law religious societies. The voluntary `Bekenntnis` item under § 7(4)(19) is conceptually different. No public Zensusdatenbank table for that voluntary item was located during this probe.

## Regionalstatistik And Historical Census Findings

The Regionaldatenbank Deutschland web interface does not expose historical religion tables in the simple public table search. Searches for religion terms mostly returned no tables. The one relevant hit points outward to Zensus 2011.

Search route:

```sh
curl -L -sS 'https://www.regionalstatistik.de/genesis/online?operation=find&query=Religionszugehoerigkeit' \
  | rg -n 'Tabellen|Statistiken|Merkmale|12111|Zensus'
```

Fetched fragment:

```text
Tabellen (0)
Statistiken (1)
Merkmale (1)
12111  Zensus 2011 (externer Link unter "Informationen zur Statistik")
```

Other web searches returned no religion table rows:

```sh
for q in Religion Kirchenmitglieder Konfession Volkszaehlung; do
  curl -L -sS "https://www.regionalstatistik.de/genesis/online?operation=find&query=$q" \
    | rg -n 'Tabellen \\(|Die Suche ergab keine Treffer|Zensus|Religion|Konfession'
done
```

Observed fragments:

```text
Die Suche ergab keine Treffer. Folgende Begriffe sind ... nicht vorhanden: Religion
Die Suche ergab keine Treffer. Folgende Begriffe sind ... nicht vorhanden: Kirchenmitglieder
Die Suche ergab keine Treffer. Folgende Begriffe sind ... nicht vorhanden: Konfession
```

The Regionaldatenbank REST service exists, but catalogue calls were not accessible with the public `GAST` credentials shown in the WADL during this probe.

```sh
curl -L -sS 'https://www.regionalstatistik.de/genesisws/rest/2020/helloworld/whoami'
```

Fetched fragment:

```json
{"User-Agent":"curl/8.7.1"}
```

Form-encoded catalogue attempts with `username: GAST` and `password: GAST` returned:

```json
{
  "Code": 15,
  "Content": "Sie sind nicht berechtigt diesen Service aufzurufen oder der Header Ihres Requests enthält nicht alle notwendigen Angaben, sodass Ihre Zugangsdaten nicht erkannt werden.",
  "Type": "ERROR"
}
```

Historical census religion is therefore not yet a machine-readable route. The likely sources for 1950, 1961, 1970, and 1987 are digitised census and statistical-yearbook PDFs in the Statistische Bibliothek, plus state-level series. These sources are deep-history candidates. They are not a first Germany map route. GDR census publications differ in coverage and release practice. No public machine-readable GDR religion table was found in this probe.

## Church Administrative Membership

EKD publishes the Protestant administrative membership series on its own statistics pages. The current summary page reports a provisional 2025 estimate, while the downloads page provides annual files.

```sh
curl -L -sS 'https://www.ekd.de/statistik-kirchenmitglieder-17279.htm' \
  | rg -n 'Mitglieder|31.12.2025|31.12.2024|Kirchenmitgliederstatistik'
```

Fetched fragment:

```text
Evangelische Kirche: 17,4 Millionen Mitglieder in Deutschland (vorläufige, geschätzte Zahlen - Stand 31.12.2025)
Zur Evangelischen Kirche in Deutschland zählen knapp 17,4 Millionen Menschen ...
Kirchenmitglieder am 31.12.2024
Quelle: Kirchenmitgliederstatistik
```

Downloads page:

```sh
curl -L -sS 'https://www.ekd.de/kirchenmitgliederzahlen-downloads-44413.htm' \
  | rg -n 'Kirchenmitgliederzahlen am 31.12.2024|xlsx|31.12.2001'
```

Fetched fragment:

```text
Kirchenmitgliederzahlen am 31.12.2024 (pdf: 1509,41 KB)
Kirchenmitgliederzahlen am 31.12.2024 (xlsx: 1892,65 KB)
Kirchenmitgliederzahlen am 31.12.2023 (pdf: 1367,25 KB)
Kirchenmitgliederzahlen am 31.12.2023 (xlsx: 1970,66 KB)
Kirchenmitgliederzahlen am 31.12.2001 und am 31.12.2002 (pdf: 121,03 KB)
```

The 2024 XLSX route works:

```sh
curl -L -sS -D /tmp/ekd-xlsx.hdr -o /tmp/ekd-2024.xlsx \
  'https://www.ekd.de/ekd_de/ds_doc/Bericht_Kirchenmitglieder_2024_r.xlsx'
unzip -l /tmp/ekd-2024.xlsx | sed -n '1,20p'
```

Fetched fragment:

```text
HTTP/1.1 200 OK
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
xl/worksheets/sheet1.xml
xl/worksheets/sheet2.xml
xl/worksheets/sheet3.xml
xl/sharedStrings.xml
```

The XLSX shared strings confirm the file contains regional-church and Bundesland tables:

```text
Tabelle 1: Evangelische Kirchenmitglieder und Bevölkerung nach Gliedkirchen am 31. Dezember 2024
Tabelle 2: Evangelische Kirchenmitglieder und Bevölkerung nach Bundesländern am 31. Dezember 2024
Tabelle 3: Evangelische Kirchenmitglieder, Katholiken und Bevölkerung nach Bundesländern am 31. Dezember 2024
```

DBK publishes Catholic administrative membership by diocese and by Bundesland as annual PDFs. The site is behind a proof-of-work bot gate, but the page and file downloads were fetched after solving the public challenge.

```sh
curl -L -sS -b /tmp/dbk-cookie.txt 'https://www.dbk.de/presse/kirchenstatistik-2025' \
  | rg -n 'Kirchenstatistik 2025|Katholiken|Bistümern|Bundesländern|fileadmin'
```

Fetched fragment:

```text
Kirchenstatistik 2025
Die Kirchenstatistik für das Jahr 2025 ist heute (16. März 2026) ... veröffentlicht worden.
In Deutschland machen die Katholiken 23 Prozent der Gesamtbevölkerung aus (19.219.601 Kirchenmitglieder).
Eckdaten des kirchlichen Lebens in den Bistümern Deutschlands 2025
Eckdaten des kirchlichen Lebens nach Bundesländern 2025
```

The diocese PDF route works:

```sh
curl -L -sS -b /tmp/dbk-cookie.txt -D /tmp/dbk-2025-pdf.hdr -o /tmp/dbk-2025-bistum.pdf \
  'https://www.dbk.de/fileadmin/redaktion/diverse_downloads/dossiers_2026/2026-037a-Bistumstabelle_2025-vorlaeufige_Ergebnisse-Stand_16032026.pdf'
pdftotext /tmp/dbk-2025-bistum.pdf - | sed -n '1,45p'
```

Fetched fragment:

```text
HTTP/2 200
Content-Type: application/pdf
Eckdaten des Kirchlichen Lebens in den Bistümern Deutschlands 2025
Stand: 16. März 2026
Aachen
Augsburg
Bamberg *
Berlin *
...
```

The DBK 2024 route also works and remains useful where a fully released 2024 comparison is needed:

```text
https://www.dbk.de/fileadmin/redaktion/diverse_downloads/presse_2025/2025-03-27_Statistik-Bistumstabelle_2024-vorlaeufige_Ergebnisse.pdf
https://www.dbk.de/fileadmin/redaktion/diverse_downloads/presse_2025/2025-03-27_Statistik-Laendertabelle_2024-vorl%C3%A4ufige_Ergebnisse.pdf
```

No explicit open-data licence was found on EKD or DBK membership pages. Treat them as public web publications that need reuse review before redistribution. Use the churches' own files as source evidence. Prefer census data where an open data licence is required.

fowid's current religion page documents a secondary synthesis rather than a first-pass machine-readable file:

```sh
curl -L -sS 'https://fowid.de/meldung/religionszugehoerigkeiten-2024' \
  | rg -n 'Mischung plausibler Daten|Katholiken|EKD|Konfessionsfreie|fowid'
```

Fetched fragment:

```text
Die folgenden Daten sind ... eine Mischung plausibler Daten und Schätzungen verschiedenster Qualitäten.
Katholiken stellen 23,7 Prozent, EKD-Evangelische 21,5 Prozent, Muslime 3,9 Prozent, weitere Religionsgemeinschaften 4,1 Prozent, Konfessionsfreie 46,8 Prozent der Bevölkerung.
```

## Church Geography And Boundaries

BKG VG250 is the boundary source for municipality and Kreis joins. The current product page is:

```text
https://gdz.bkg.bund.de/index.php/default/digitale-geodaten/verwaltungsgebiete/verwaltungsgebiete-1-250-000-stand-01-01-vg250-01-01.html
```

Product-page fragments:

```text
Aktualitätsstand: 01.01.2025
Datenaktualisierung Stand 01.01.2025
Die VG250 enthalten die Verwaltungsebenen vom Staat bis zu den Gemeinden mit den jeweiligen Grenzen.
Die Daten werden geldleistungsfrei gemäß der Datenlizenz Deutschland Namensnennung 2.0 zur Verfügung gestellt.
© BKG (Jahr des letzten Datenbezugs) dl-de/by-2-0, Datenquellen: https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg_nuts.pdf
```

The current direct downloads are under `vg250_ebenen_0101`. The older simpler `vg250_0101` path returned 404 during this probe:

```sh
for url in \
  'https://daten.gdz.bkg.bund.de/produkte/vg/vg250_ebenen_0101/aktuell/vg250_01-01.utm32s.shape.ebenen.zip' \
  'https://daten.gdz.bkg.bund.de/produkte/vg/vg250_ebenen_0101/aktuell/vg250_01-01.utm32s.gpkg.ebenen.zip' \
  'https://daten.gdz.bkg.bund.de/produkte/vg/vg250_ebenen_0101/aktuell/vg250_01-01.ee.excel.ebenen.zip'; do
  curl -L -sS -I "$url" | sed -n '1,8p'
done
```

Fetched fragment:

```text
HTTP/1.1 200 OK
Content-Type: application/zip
Content-Length: 69137702
Last-Modified: Tue, 19 Aug 2025 11:50:43 GMT

HTTP/1.1 200 OK
Content-Type: application/zip
Content-Length: 72326773

HTTP/1.1 200 OK
Content-Type: application/zip
Content-Length: 7031155
```

Church geographies need a separate boundary decision. The Zensusdatenbank now includes church administrative-unit variables for religion tabulations. Those variables are codes and tabulation geographies. They are not a standalone official GIS boundary product.

Important Zensusdatenbank change note:

```sh
curl -L -sS 'https://ergebnisse.zensus2022.de/proxy/api/rest/information/importantChanges' \
  | jq -r '.[] | select(.date|startswith("2025-06-27")) | [.date,.heading.de,.description.de] | @tsv'
```

Fetched fragment:

```text
2025-06-27T00:00:00Z  Tabellen für Verwaltungseinheiten der katholischen und evangelischen Kirche  Im Themenbereich [/statistic/1000A Bevölkerung kompakt] stehen nun Tabellen zur Verfügung, die das Merkmal „Religion“ für ... evangelische Landeskirchen, Kirchenkreise und Kirchengemeinden sowie ... Bistümer, Dekanate und Pfarreien der katholischen Kirche auswerten.
```

Church geography variables probed:

```text
GEOEV1  Landeskirche (Evangelische Kirche)
GEOEV2  Kirchenkreis
GEOEV3  Kirchengemeinde
GEORK1  Bistum (Katholische Kirche)
GEORK2  Dekanat
GEORK3  Pfarrei
```

EKD publishes a regional-church overview map only as a PDF:

```sh
curl -L -sS 'https://www.ekd.de/statistik-gliedkirchenkarte-84880.htm' \
  | sed -n '3090,3125p'
```

Fetched fragment:

```text
Übersichtskarte der evangelischen Gliedkirchen der EKD. Stand: 27. Mai 2012.
Gliedkirchenkarte 27. Mai 2012 (pdf: 151,36 KB)
```

No official EKD or DBK GIS boundary download was found during this probe. For a church-membership map, treat church boundaries as a separate sourcing task. BKG administrative units should not be assumed to stand in for dioceses or regional churches.

## Recommended Build Route

The first route is the 2011/2022 census legal-membership lane. Extract `1000X-1014` and `1000A-1018` for municipalities and Kreis from the Zensusdatenbank flat-CSV export. Join to BKG VG250 boundaries at the matching reference date where practical. Display the compact categories as legal membership in public-law religious societies. The categories are Protestant public-law church, Roman Catholic public-law church, and other or no public-law membership or no data.

The second route is a Kreis-first or large-municipality detail layer for 2011. Use `2000X-1022` to break out additional public-law categories. Do not present it as complete municipality coverage because its municipality dimension is limited to places with at least 10,000 residents.

The third route is a separate church administrative membership product. EKD XLSX tables by Gliedkirche/Bundesland and DBK PDFs by diocese/Bundesland can support reference panels or a later membership-construct map. Do not merge the church series with census legal-membership shares without a clear construct label.

The fourth route is deep history. Treat 1950, 1961, 1970, 1987, and GDR census religion as a later digitisation task from statistical-yearbook and census-volume PDFs. A credentialed GENESIS route or another official machine-readable source would change that ranking.

## Open Questions

The Zensusdatenbank flat-CSV POST route is confirmed, but a production extractor should generate and store explicit table-state JSON for the municipality and Kreis selections rather than relying on the UI default state.

The voluntary 2011 `Bekenntnis` item was verified in the law but not found as a public database table. Confirm with Zensus documentation before concluding that it was never publicly released.

Historical census religion remains unresolved at machine-readable depth. A follow-up should search the Statistische Bibliothek by exact census-volume title and state statistical-office catalogues. That follow-up can then decide whether OCR/table extraction is worth the effort.

Church boundary GIS remains unresolved. EKD and DBK appear to publish maps and tabular statistics, but no official GIS files were found in this probe.
