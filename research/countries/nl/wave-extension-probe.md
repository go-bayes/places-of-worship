# Netherlands CBS province religion probe

Probe date: 2026-07-10.

Source context: `research/countries/nl/README.md` previously recorded a possible
CBS province or COROP survey route. This probe tests the annual province series,
attendance coverage, sampling uncertainty, reuse terms, and current boundaries.

## Bottom line

The Netherlands clears the build conditions for two separate province products.
CBS StatLine table `83288NED` publishes final annual survey estimates for all 12
provinces from 2010 through 2015. One product measures self-reported religious
affiliation. The other product measures self-reported attendance at religious or
worldview gatherings. Both use the total population aged 15+ as the denominator.

The table states that its sample estimates have uncertainty margins. Its OData
schema publishes rounded whole percentages without standard errors, sample
sizes, or confidence intervals. The build therefore carries explicit survey and
missing-interval flags. It does not calculate unsupported intervals.

CBS StatLine data and the current PDOK province boundaries are each licensed
under Creative Commons Attribution 4.0 International (CC BY 4.0). Attribution is
required to CBS for the survey tables and Kadaster / PDOK for the boundaries.

## Annual affiliation series

The machine-readable annual route is CBS StatLine table `83288NED`,
*Religieuze betrokkenheid; kerkelijke gezindte; regio; 2010-2015*:

```text
https://opendata.cbs.nl/ODataApi/OData/83288NED
```

The relevant OData resources are:

```text
TableInfos
DataProperties
RegioS
Perioden
TypedDataSet
```

`RegioS` contains the 12 province codes `PV20` through `PV31`. The table also
contains national and landsdeel rows. `Perioden` contains six final annual
periods: 2010, 2011, 2012, 2013, 2014, and 2015. Every province-year row contains
the required affiliation values.

The affiliation product uses two published topics:

| OData topic | Construct | Unit and denominator |
| --- | --- | --- |
| `TotaalKerkelijkeGezindte_2` | Reports belonging to a religious denomination or worldview group | Percent of the total population aged 15+ |
| `GeenKerkelijkeGezindte_1` | Reports no religious denomination or worldview group | Percent of the total population aged 15+ |

The table also publishes Catholic, Protestant Church in the Netherlands, Dutch
Reformed, Reformed, Islam, and other-affiliation percentages. The affiliation
product ships the two headline categories. The cached source response retains the
detailed categories without combining them into a second taxonomy.

## Provincial attendance series

Table `83288NED` also publishes attendance for every province and year. Attendance
is a separate practice construct and has its own product. The attendance product
uses two published topics:

| OData topic | Construct | Unit and denominator |
| --- | --- | --- |
| `EenKeerPerWeekOfVaker_9` | Attends a religious or worldview gathering once a week or more | Percent of the total population aged 15+ |
| `ZeldenOfNooit_13` | Seldom or never attends a religious or worldview gathering | Percent of the total population aged 15+ |

The table also publishes two-to-three-times-per-month, monthly, and less-than-
monthly categories. The five attendance categories sum to approximately 100 in
each row, subject to whole-percentage rounding.

The regional table defines attendance over the total population. Some category
descriptions in national table `82904NED` refer to people who identify with a
religious denomination. Those descriptions conflict with the published values:
the five national attendance categories sum to 100, and the regional table
explicitly defines the denominator as the total population. The products follow
the regional table definition and record the total population aged 15+ as the
denominator.

## Sampling uncertainty

`TableInfos` states that `83288NED` is based on the Labour Force Survey and that
sample estimates have an uncertainty margin. `DataProperties` exposes percentage
topics only. It contains no standard-error, lower-bound, upper-bound, sample-size,
or reliability-flag topic. The values have zero published decimal places.

Confidence intervals cannot be recovered from the published percentages alone.
The survey design and effective sample sizes are required. Both products carry:

```text
sample_survey_estimate
rounded_whole_percent
confidence_interval_not_published
```

An older table, `70794ned`, *Religie; naar regio; 2000/2002 of 2003*, publishes
percentages and standard errors for landsdelen, provinces, and COROP regions.
Most affiliation estimates pool 2000–2002, while Islam uses a modelled 2003
value. The population universe and measurement basis differ from `83288NED`.
The older table is therefore context for a possible later wave, rather than part
of this annual product.

## Later regional publication

CBS marks 83288NED as discontinued (ReasonDelivery: Stopgezet, no
further figures); the 2015 endpoint is the source's own, not an
extraction limit.

CBS released *Religie naar regio, 2021/2025* in March 2026. The downloadable
tables report five-year average affiliation estimates for provinces and most
COROP regions from the Social Cohesion and Well-being survey:

```text
https://www.cbs.nl/nl-nl/maatwerk/2026/11/religie-naar-regio-2021-2025
```

The release provides regional affiliation estimates pooled across five years. It
does not extend the annual `83288NED` province panel and does not publish a
provincial attendance panel. A news comparison also reports a 2016–2020 five-year
average. Neither pooled estimate is inserted into the annual 2010–2015 products.

## Historical census context

CBS StatLine table `37850`, *Kerkelijke gezindte per provincie vanaf 1849*,
records province affiliation from the historical censuses through 1971 and
survey estimates after 1971. Its metadata states that the 1849–1971 values cover
the whole population and come from the censuses; values from 1977 onward come
from samples of people aged 18+.

The traditional census held on 28 February 1971 was the last Dutch census of
that form. CBS abandoned the planned 1981 enumeration after high non-response in
trial counts. Historical census scans and tables remain available through CBS
and the Dutch census portal:

```text
https://www.cbs.nl/nl-nl/cijfers/detail/37850
https://www.volkstellingen.nl/
```

The historical census series is context only. Its full-population census
construct, changing categories, and period province geographies remain separate
from the modern sample-survey products.

## Reuse terms

The CBS open-data portal for `83288NED` labels the API and downloads CC BY 4.0:

```text
https://opendata.cbs.nl/portal.html?_catalog=CBS&_la=nl&tableId=83288NED
```

The Dutch government data catalogue independently records the same table and
licence. The build attributes Statistics Netherlands (CBS) and preserves the
table identifier.

The PDOK OGC API landing document exposes a `license` relation titled `CC BY
4.0`. The provider is Kadaster, and the province areas derive from the
Basisregistratie Kadaster:

```text
https://api.pdok.nl/kadaster/brk-bestuurlijke-gebieden/ogc/v1?f=json
```

## Boundaries

The build retrieves the current `provinciegebied` collection from PDOK:

```text
https://api.pdok.nl/kadaster/brk-bestuurlijke-gebieden/ogc/v1/collections/provinciegebied/items?f=json&limit=100
```

The response contains the 12 province codes `20` through `31`, which join
directly to the StatLine `PV20` through `PV31` codes. The source was current in
2026. The builder simplifies the 12 valid province features with the shared
mapshaper helper and retains every province shape.

## National comparisons

CBS national table `82904NED`, *Religieuze betrokkenheid;
persoonskenmerken*, supplies an independent StatLine route for the same national
universe. The builder compares three years for each shipped indicator:

| Indicator | 2010 regional / national | 2012 regional / national | 2015 regional / national |
| --- | ---: | ---: | ---: |
| Religious affiliation | 55 / 55 | 52 / 52 | 50 / 50 |
| No religious affiliation | 45 / 45 | 48 / 48 | 50 / 50 |
| Weekly-or-more attendance | 10 / 10 | 10 / 10 | 10 / 10 |
| Seldom-or-never attendance | 74 / 74 | 76 / 76 | 77 / 77 |

Every comparison has a zero percentage-point difference.

## Build decision and outputs

The provincial series is machine-readable and licence-clear. The stop conditions
do not apply. The build creates:

```text
scripts/build_nl_area_summary.R
apps/regions/nl/data/area_summary_affiliation_province.json
apps/regions/nl/data/area_summary_affiliation_province.csv
apps/regions/nl/data/area_summary_attendance_province.json
apps/regions/nl/data/area_summary_attendance_province.csv
apps/regions/nl/data/nl_province_2026.geojson
docs/manifests/nl-survey-religion-2010-2015.json
```

Each survey product contains 72 rows: 12 provinces across six annual periods.
The manifest records the source URLs, cached-source hashes, national comparisons,
survey warnings, boundary validation, output hashes, and file sizes.
