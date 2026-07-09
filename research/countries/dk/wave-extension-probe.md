# Denmark Church of Denmark membership and parish-boundary probe

Probe date: 2026-07-10.

Source context: `research/countries/dk/README.md` records Denmark as Tier B, with current parish membership noted from `sogn.dk`, ministry church statistics noted for national summaries, and DAGI parish boundaries flagged as the boundary source that needs a reproducible route.

## Bottom Line

Denmark has a strong first map lane for Church of Denmark administrative membership by parish. Statistics Denmark's current StatBank church tables do not expose a 1984-2026 parish panel. The reusable API lane starts in 2007. `KM1` gives quarterly parish-by-membership counts from 2007Q1 to 2026Q2. `KM5` gives annual parish counts by sex, age group, membership, and year from 2007 to 2026. `KM6` gives the same annual construct by municipality from 2011 to 2026. The older 1984/1990 public summaries are real church-statistics context. They are separate from the current clean StatBank parish panel.

The first Denmark map should use the latest `KM1` quarter and current sogn polygons. The map statistic is the percentage of the parish population that is registered as a Church of Denmark member. The active sogn polygon count is about 2,100. DAWA returned 2,097 current sogn records during this probe, while the StatBank `SOGN` code list has 2,299 values. The StatBank list includes obsolete/special rows such as `0000 Without placeable address` and `9999 Without permanent residence`.

## StatBank Tables

The relevant StatBank table list is small and stable enough for a direct API discovery step:

```sh
curl -L -sS 'https://api.statbank.dk/v1/tables?lang=en' \
  | jq -r '.[] | select(.id|test("^KM";"i")) | [.id,.text,.unit,.updated] | @tsv'
```

Fetched fragment:

```text
KM1   Population at the first day of the quarter       Number  2026-05-11T08:00:00
KM5   Population 1. January                            Number  2026-02-12T08:00:00
KM6   Population 1. January                            Number  2026-02-12T08:00:00
KM2   Registration and resignation from the National Church    Number  2026-05-11T08:00:00
KM4   Religious ceremonies                             Number  2026-02-12T08:00:00
```

`KM1` is the clean parish membership table:

```sh
curl -L -sS 'https://api.statbank.dk/v1/tableinfo/KM1?lang=en' \
  | jq -r '[.id,.text,.description,.unit,.updated,
      ([.variables[] | (.id+":"+.text+":"+((.values|length)|tostring)+":"+
      (.values[0].id // "")+":"+(.values[-1].id // ""))] | join(" | "))] | @tsv'
```

Fetched fragment:

```text
KM1  Population at the first day of the quarter  Population at the first day of the quarter by parish, member of the National Church and time  Number  2026-05-11T08:00:00  SOGN:parish:2299:7001:9999 | FKMED:member of the National Church:2:F:U | Tid:time:78:2007K1:2026K2
```

`KM5` and `KM6` are the annual detail tables:

```sh
for t in KM5 KM6; do
  curl -L -sS "https://api.statbank.dk/v1/tableinfo/$t?lang=en" \
    | jq -r '[.id,.text,.description,.unit,.updated,
        ([.variables[] | (.id+":"+.text+":"+((.values|length)|tostring)+":"+
        (.values[0].id // "")+":"+(.values[-1].id // ""))] | join(" | "))] | @tsv'
done
```

Fetched fragment:

```text
KM5  Population 1. January  Population 1. January by parish, sex, age, member of the National Church and time  Number  2026-02-12T08:00:00  SOGN:parish:2299:7001:9999 | KØN:sex:2:1:2 | ALDER:age:21:0-4:100OV | FKMED:member of the National Church:2:F:U | Tid:time:20:2007:2026
KM6  Population 1. January  Population 1. January by municipality, sex, age, member of the National Church and time  Number  2026-02-12T08:00:00  KOMK:municipality:99:101:851 | KØN:sex:2:1:2 | ALDER:age:21:0-4:100OV | FKMED:member of the National Church:2:F:U | Tid:time:16:2011:2026
```

Statistics Denmark's church-statistics documentation agrees with the API start date for the current series. The statistical-presentation page gives time coverage as `2007-`. Its comparability page also says older National Church statistics have been produced since 1974 and that 1984-2002 included questionnaires from parishes. That older documentation does not override the actual StatBank table spans above.

## Working Membership Calls

Current parish membership counts can be fetched directly from `KM1`:

```sh
curl -L -sS 'https://api.statbank.dk/v1/data/KM1/CSV?lang=en' \
  -H 'Content-Type: application/json' \
  -d '{"table":"KM1","format":"BULK","lang":"en","variables":[
        {"code":"SOGN","values":["7002"]},
        {"code":"FKMED","values":["F","U"]},
        {"code":"Tid","values":["2007K1","2026K1"]}
      ]}'
```

Fetched fragment:

```text
SOGN;FKMED;TID;INDHOLD
7002 Helligånds (København Municipality);Member of National Church;2007Q1;2343
7002 Helligånds (København Municipality);Not member of National Church;2007Q1;1206
7002 Helligånds (København Municipality);Member of National Church;2026Q1;2898
7002 Helligånds (København Municipality);Not member of National Church;2026Q1;3068
```

StatBank can also return the percentage share for the membership dimension in non-streamed CSV:

```sh
curl -L -sS 'https://api.statbank.dk/v1/data/KM1/CSV?lang=en' \
  -H 'Content-Type: application/json' \
  -d '{"table":"KM1","format":"CSV","lang":"en","valuePresentation":"CodeAndValue",
      "variables":[
        {"code":"SOGN","values":["7002"]},
        {"code":"FKMED","values":["F","U"]},
        {"code":"Tid","values":["2026K1"]}
      ],
      "valueTransformationSettings":{
        "operation":"percent",
        "selectedVariableCode":"FKMED",
        "addAsNewValue":"true",
        "newValueName":"Percentage",
        "newValuePlacement":"Head",
        "contentTypeCode":"Content_Type"
      }}'
```

Fetched fragment:

```text
SOGN;FKMED;TID;CONTENT_TYPE;INDHOLD
7002 7002 Helligånds (København Municipality);F Member of National Church;2026K1 2026Q1;Number;2898
7002 7002 Helligånds (København Municipality);F Member of National Church;2026K1 2026Q1;Percentage;48.58
7002 7002 Helligånds (København Municipality);U Not member of National Church;2026K1 2026Q1;Number;3068
7002 7002 Helligånds (København Municipality);U Not member of National Church;2026K1 2026Q1;Percentage;51.42
```

The annual `KM5` parish table works, but age has no single all-age total code. A build that uses `KM5` must either request age groups and sum them or use `KM1` quarter 1 for a simpler annual-like parish series.

```sh
curl -L -sS 'https://api.statbank.dk/v1/data/KM5/CSV?lang=en' \
  -H 'Content-Type: application/json' \
  -d '{"table":"KM5","format":"BULK","lang":"en","variables":[
        {"code":"SOGN","values":["7002"]},
        {"code":"KØN","values":["1","2"]},
        {"code":"ALDER","values":["0-4"]},
        {"code":"FKMED","values":["F","U"]},
        {"code":"Tid","values":["2007","2026"]}
      ]}'
```

Fetched fragment:

```text
SOGN;KØN;ALDER;FKMED;TID;INDHOLD
7002 Helligånds (København Municipality);Men;0-4 years;Member of National Church;2007;41
7002 Helligånds (København Municipality);Men;0-4 years;Not member of National Church;2007;34
7002 Helligånds (København Municipality);Women;0-4 years;Member of National Church;2026;36
7002 Helligånds (København Municipality);Women;0-4 years;Not member of National Church;2026;64
```

The municipality route starts later:

```sh
curl -L -sS 'https://api.statbank.dk/v1/data/KM6/CSV?lang=en' \
  -H 'Content-Type: application/json' \
  -d '{"table":"KM6","format":"BULK","lang":"en","variables":[
        {"code":"KOMK","values":["101"]},
        {"code":"KØN","values":["1","2"]},
        {"code":"ALDER","values":["0-4"]},
        {"code":"FKMED","values":["F","U"]},
        {"code":"Tid","values":["2011","2026"]}
      ]}'
```

Fetched fragment:

```text
KOMK;KØN;ALDER;FKMED;TID;INDHOLD
Copenhagen;Men;0-4 years;Member of National Church;2011;7371
Copenhagen;Men;0-4 years;Not member of National Church;2011;11359
Copenhagen;Women;0-4 years;Member of National Church;2026;4990
Copenhagen;Women;0-4 years;Not member of National Church;2026;13230
```

## StatBank Licence

Statistics Denmark's StatBank API help page states that StatBank data can be used free of charge for commercial and non-commercial purposes, with source reference. The page says this reuse statement corresponds to Creative Commons CC BY 4.0. The same page says the API gives access to all published data in StatBank and that users can make free use of data for service development.

Source: `https://www.dst.dk/en/Statistik/hjaelp-til-statistikbanken/api`.

## Membership Construct

Church of Denmark membership is an administrative register construct. Statistics Denmark's church-statistics documentation states that the statistics are based partly on the Central Population Register (CPR). The CPR-based statistics concern the number of members of the National Church, registrations and resignations, births, and deaths. Daily CPR deliveries form the basis for the statistics. Folkekirken's membership page explains the social mechanism: most people become members through infant baptism, adults join through baptism or admission, resignation is registered by the parish office, and CPR records show whether someone is registered as a member.

The construct is therefore close to Germany's church administrative-membership lane. It does not measure attendance or belief. The denominator for a parish share is the registered population in the same parish and period in the membership table: member plus not-member. StatBank can either return the percentage by `FKMED` through `valueTransformationSettings` or provide the counts for local calculation.

Sources: `https://www.dst.dk/en/Statistik/dokumentation/documentationofstatistics/church-statistics`, `https://www.dst.dk/en/Statistik/dokumentation/documentationofstatistics/church-statistics/statistical-processing`, and `https://www.folkekirken.dk/om-folkekirken/vaer-med/medlemskab`.

## Parish Boundaries

The official boundary family is Danmarks Administrative Geografiske Inddeling (DAGI). Datafordeler's catalogue names the dataset as `Danmarks Administrative Geografiske Inddelinger (DAGI)` and describes it as a standardised reference dataset for Danish administrative divisions. The dataset list explicitly includes `Sogneinddeling`.

Dataforsyningen's current service catalogue exposes relevant DAGI services:

```sh
curl -L -sS 'https://dataforsyningen.dk/es/services/_search' \
  -H 'Content-Type: application/json' \
  -d '{"size":20,"query":{"query_string":{"query":"DAGI"}}}' \
  | jq -r '.hits.hits[]? | [._source.o_id,._source.service_title,
      ._source.service_name,._source.service_servicetypename,
      ._source.service_version,._source.service_tokenrequired,
      ._source.service_link,._source.service_description] | @tsv'
```

Fetched fragment:

```text
3748  DAWA-DAGI  DAWA-DAGI  API    no  https://dawadocs.dataforsyningen.dk/dok/dagi  DAWA-DAGI API'et kan anvendes til at danne en oversigt over DAGI's forskellige inddelinger. DAWA lukker 1. juli 2026
3455  DAGI multigeometri  dagi_DAF  WMS  1.1.1,1.3.0  yes  https://api.dataforsyningen.dk/dagi_DAF?service=WMS&request=GetCapabilities&token=  DAGI WMS er en fælles udstilling, der anvender både data i skala 1:10.000 og data i skalaerne anvendt i administrative inddelinger til præsentationsformål. Distribueret via Datafordeler (DAF).
3449  DAGI 2000 multigeometri  DAGI_2000MULTIGEOM_GMLSFP_DAF  WFS  2.0.0  yes  https://api.dataforsyningen.dk/DAGI_2000MULTIGEOM_GMLSFP_DAF?service=WFS&request=GetCapabilities&token=  Alle DAGI inddelingerne som vektordata. Aktuelle data (uden historik) som multigeometriobjekter i 1:2.000.000. Distribueret via Datafordeler (DAF).
3453  DAGI 500 multigeometri  DAGI_500MULTIGEOM_GMLSFP_DAF  WFS  2.0.0  yes  https://api.dataforsyningen.dk/DAGI_500MULTIGEOM_GMLSFP_DAF?service=WFS&request=GetCapabilities&token=  Alle DAGI inddelingerne som vektordata. Aktuelle data (uden historik) som multigeometriobjekter i 1:500.000. Distribueret via Datafordeler (DAF).
3445  DAGI 10 multigeometri   DAGI_10MULTIGEOM_GMLSFP_DAF   WFS  2.0.0  yes  https://api.dataforsyningen.dk/DAGI_10MULTIGEOM_GMLSFP_DAF?service=WFS&request=GetCapabilities&token=   Alle DAGI inddelingerne som vektordata. Aktuelle data (uden historik) som multigeometriobjekter i 1:10.000. Distribueret via Datafordeler (DAF). Denne WFS service lukker 1.april 2026
3451  DAGI 250 multigeometri  DAGI_250MULTIGEOM_GMLSFP_DAF  WFS  2.0.0  yes  https://api.dataforsyningen.dk/DAGI_250MULTIGEOM_GMLSFP_DAF?service=WFS&request=GetCapabilities&token=  Alle DAGI inddelingerne som vektordata. Aktuelle data (uden historik) som multigeometriobjekter i 1:250.000. Distribueret via Datafordeler (DAF).
3447  DAGI 10 multigeometri m historik  DAGI_10MULTIGEOM_HIST_GMLSFP_DAF  WFS  2.0.0  yes  https://api.dataforsyningen.dk/DAGI_10MULTIGEOM_HIST_GMLSFP_DAF?service=WFS&request=GetCapabilities&token=  DAGI-data med historik fra 2018 i skala 1:10.000. Distribueret via Datafordeler (DAF). Denne WFS service lukker 1. april 2026
5184  DAGI via datafordeler   DAGI via datafordeler   API          no   https://confluence.kds.dk/pages/viewpage.action?pageId=10616969  Udstilling fra Datafordeleren
```

Dataforsyningen WFS routes therefore require a Dataforsyningen token. The catalogue records `service_tokenrequired` as `yes` and the WFS URLs end with `token=`. Datafordeler's geodata help page also says service URLs used in GIS clients must be enriched with service-user credentials. Dataforsyningen describes the site as direct access to free public geodata. Treat the practical route as free-data credentialed access. It is not anonymous WFS.

Datafordeler also supports geodata downloads through file extracts. The geodata help page says predefined extracts are available for download, and that some datasets support user-defined extracts where the user chooses data format, coordinate system, and geographical area. User-defined extracts are current at the extraction time. The supported extract formats listed on the help page include GeoPackage, GML321, and SHP, with the actual formats determined by the register's service catalogue.

The legacy DAWA DAGI endpoint still returned current sogn polygons during this probe. The endpoint is useful for a quick proof of concept. DAWA documentation warns that DAWA closes on 1 July 2026. Production should move to Dataforsyningen/Datafordeler.

```sh
curl -L -sS 'https://api.dataforsyningen.dk/sogne?per_side=1&format=geojson&srid=4326' \
  | jq '{type,features:(.features|length),
      first:{properties:.features[0].properties,geometry_type:.features[0].geometry.type}}'
```

Fetched fragment:

```json
{
  "type": "FeatureCollection",
  "features": 1,
  "first": {
    "properties": {
      "dagi_id": "107307",
      "kode": "7002",
      "navn": "Helligånds",
      "ændret": "2023-11-02T22:05:36.260Z",
      "geo_ændret": "2023-11-02T22:05:36.260Z",
      "geo_version": 6,
      "visueltcenter_x": 12.57165114,
      "visueltcenter_y": 55.67358892
    },
    "geometry_type": "MultiPolygon"
  }
}
```

The current DAWA endpoint returned 2,097 sogn records:

```sh
curl -L -sS 'https://api.dataforsyningen.dk/sogne?format=json' | jq 'length'
```

Fetched fragment:

```text
2097
```

Boundary vintage is available at the object and service level, but the public pages consulted in this probe did not state a fixed update cadence. The Dataforsyningen catalogue distinguishes current DAGI WFS services without history from a history service with data from 2018. DAWA `sogn` records carry `ændret`, `geo_ændret`, and `geo_version`, while the replication API exposes live transaction metadata. During this probe, `senestetransaktion` returned transaction `4133320` at `2026-07-09T12:52:26.512Z`. A production boundary snapshot should therefore pin the retrieval date, route, record count, and file hash.

Datafordeler's KDS geographical-data terms page says DAGI falls under `KDS - Geografiske data`. The page says free geographical data are under CC BY 4.0. Users may freely retrieve, share, and adapt the data and must credit Klimadatastyrelsen in an appropriate place.

Sources: `https://datafordeler.dk/dataoversigt/danmarks-administrative-geografiske-inddeling-dagi/`, `https://datafordeler.dk/vejledning/tjenester/geodata/`, `https://datafordeler.dk/vejledning/brugervilkaar/kds-geografiske-data/`, `https://dataforsyningen.dk/data`, and `https://dawadocs.dataforsyningen.dk/dok/api/sogn`.

## Parish Concordance

A stable 40-year annual parish panel is not ready from a single public StatBank table. StatBank's `SOGN` variable lists 2,299 values and supplies a current map key `denmark_parish_23_4c`, but it does not include start or end validity dates in table metadata:

```sh
curl -L -sS 'https://api.statbank.dk/v1/tableinfo/KM1?lang=en' \
  | jq -r '.variables[] | select(.id=="SOGN") |
      {id,text,map,elimination,values:(.values|length),first:.values[0],last:.values[-1]}'
```

Fetched fragment:

```json
{
  "id": "SOGN",
  "text": "parish",
  "map": "denmark_parish_23_4c",
  "elimination": true,
  "values": 2299,
  "first": {"id": "7001", "text": "7001 Vor Frue (København Municipality)"},
  "last": {"id": "9999", "text": "9999 Without permanent residence"}
}
```

DAWA/DAGI gives current `sogn` objects with change timestamps and geometry versions, and the replication API has a `sogn` entity. The machine-readable model for `sogn` has `kode`, `dagi_id`, `ændret`, `geo_ændret`, and `geo_version`. It does not have validity-start or validity-end fields. The replication API also exposes `dar_darsogneinddeling_historik`, which has `virkningstart` and `virkningslut`. The DAR entity records address/sogn division history rather than a ready StatBank parish-code concordance.

```sh
curl -L -sS 'https://api.dataforsyningen.dk/replikering/datamodel' \
  | jq '{sogn:.sogn, dar_sogne_hist:.dar_darsogneinddeling_historik}'
```

Fetched fragment:

```json
{
  "sogn": {
    "key": ["kode"],
    "attributes": [
      {"name": "ændret", "type": "string"},
      {"name": "geo_ændret", "type": "string"},
      {"name": "geo_version", "type": "integer"},
      {"name": "geometri", "type": "geometry", "offloaded": true},
      {"name": "dagi_id", "type": "string"},
      {"name": "kode", "type": "string"},
      {"name": "navn", "type": "string"}
    ]
  },
  "dar_sogne_hist": {
    "key": ["rowkey"],
    "attributes": [
      {"name": "virkningstart", "type": "timestamp"},
      {"name": "virkningslut", "type": "timestamp"},
      {"name": "sognekode", "type": "string"}
    ]
  }
}
```

The build implication is clear. A latest-year parish map can join `KM1` to current sogn polygons by `SOGN`/`kode`. A 2007-2026 annual parish panel can be extracted from `KM1` Q1 or from `KM5`, but boundary and code churn must be handled before interpreting parish-level change. A 1984-2026 parish panel requires a separate concordance or aggregation strategy; it is not exposed by the current StatBank `KM` tables.

## Immigration-Driven Denominators

Statistics Denmark publishes ancestry context that is directly relevant to Church of Denmark denominators. `KMSTA001` cross-tabulates parish, ancestry, Church membership, and year from 2008 to 2026. The ancestry categories are persons of Danish origin, immigrants from western countries, immigrants from non-western countries, descendants from western countries, and descendants from non-western countries. The `KMSTA001` table can explain denominator composition, but it should remain context for a later analysis rather than part of the first map.

```sh
curl -L -sS 'https://api.statbank.dk/v1/data/KMSTA001/CSV?lang=en' \
  -H 'Content-Type: application/json' \
  -d '{"table":"KMSTA001","format":"BULK","lang":"en","variables":[
        {"code":"SOGN","values":["7001"]},
        {"code":"HERKOMST","values":["1","24","25","34","35"]},
        {"code":"FKMED","values":["F","U"]},
        {"code":"Tid","values":["2008","2026"]}
      ]}'
```

Fetched fragment:

```text
SOGN;HERKOMST;FKMED;TID;INDHOLD
7001 Vor Frue (København Municipality);Persons of Danish origin;Member of National Church;2008;2093
7001 Vor Frue (København Municipality);Immigrants from western countries;Not member of National Church;2008;246
7001 Vor Frue (København Municipality);Immigrants from non-western countries;Member of National Church;2008;8
7001 Vor Frue (København Municipality);Descendants from non-western countries;Not member of National Church;2008;30
```

## Attendance Data

The discovery probe found no church-statistics table that provides parish-level or national administrative counts of ordinary service attendance. Statistics Denmark does have a survey table, `KV2FR5`, for visits to places of worship by frequency, sex, age, and year. The `KV2FR5` table is national survey percentage data for 2024 and 2025. It is separate from Church of Denmark attendance registers and parish map layers.

```sh
curl -L -sS 'https://api.statbank.dk/v1/tableinfo/KV2FR5?lang=en' \
  | jq -r '[.id,.text,.description,.unit,.updated,
      ([.variables[] | (.id+":"+.text+":"+((.values|length)|tostring)+":"+
      (.values[0].id // "")+":"+(.values[-1].id // ""))] | join(" | "))] | @tsv'
```

Fetched fragment:

```text
KV2FR5  Visits to places of worship  Visits to places of worship by frequency, sex, age and time  Per cent  2026-03-04T08:00:00  HYP:frequency:9:110200:111200 | KØN:sex:3:10:2 | ALDER:age:8:TOT:75OV | Tid:time:2:2024:2025
```

Example extract:

```text
HYP;KØN;ALDER;TID;INDHOLD
Once or multiple times a week;Sex, total;Age, total;2025;3
1-3 times a month;Sex, total;Age, total;2025;3
I have not done that within the past 12 months;Sex, total;Age, total;2025;25
I have never done that (2025-);Sex, total;Age, total;2025;7
```

## Recommended Build Route

1. Build the latest parish map first. Use `KM1`, latest complete quarter or 2026Q1 if the map needs a January anchor, and current sogn polygons. Join `SOGN` code to DAGI/DAWA `kode`. Map `Member of National Church` as a percentage of `Member + Not member`. The `KM1` route is small enough for about 2,100 current parishes and avoids age summing.

2. Add a 2007-2026 parish time series second. Prefer `KM1` Q1 for annual January points if the map needs a simple all-age denominator. Use `KM5` only if age or sex structure is needed, because `KM5` requires age-group summing for all-age parish totals. Treat parish merges, splits, and missing rows as data events that need a concordance layer.

3. Add a municipality panel only if the first parish panel is too costly for UI performance. `KM6` starts in 2011, has 99 municipality values, and is much easier to display, but it gives up the parish geography that makes Denmark unusually strong for this project.

4. Leave the 1984/1990 ministry summaries as national context. Keep them out of parish wave claims unless a historical parish-code concordance and a source table with parish-level counts are found.
