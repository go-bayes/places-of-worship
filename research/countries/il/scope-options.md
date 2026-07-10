# Israel geographic scope options

## Purpose and status

This probe records the choices that preceded the Israel data product. The
project lead selected **Option B: CBS statistical coverage as published** on
2026-07-11. The project lead then approved the two-slot Register construct:
the first slot sums the recognised CBS religion groups, and the second carries
CBS's Not classified by religion category under its source name. A generic
five-group extension remains a future path.

The three options differ in what defines the study area. Option A uses the
Green Line as a spatial mask. Option B reproduces CBS statistical coverage.
Option C filters CBS locality rows while retaining the CBS geographic frame.
The distinction affects Jerusalem because CBS publishes Jerusalem as one
locality, while the Green Line crosses the locality.

## Data register

### Registry-based religion

The CBS population estimates use the Population Register, with census-based
revisions. Three routes are relevant:

| Route | Geography and construct | Machine-readable span | What it supports | Limitation |
| --- | --- | --- | --- | --- |
| [Statistical Abstract table 2.2, *Population of Israelis, by religion*](https://www.cbs.gov.il/he/publications/DocLib/2025/2.ShnatonPopulation/st02_02.xlsx) | National counts for Jews, Muslims, Christians, Druze, and the grand total | Annual, 1995–2024 | An all-age annual national series | No subnational breakdown |
| [CBS geographic dictionary API: localities](https://api.cbs.gov.il/Dictionary/geo/localities?year=2024&expand=false&format=json&download=false&page=1&page_size=250) | Locality code, district, natural area, main-religion code, total population, Jews and Others, Jews, and Arabs | Annual, 1995–2024; 1995 is the first year returned by the API | Annual locality membership and broad population-group totals | `religion` is the locality's main religion. The endpoint does not give all-age Muslim, Christian, and Druze counts for every locality. A User-Agent header is mandatory for CBS API requests. |
| [Statistical Abstract table 2.11, *Population of Israelis, by district, sub-district and religion*](https://www.cbs.gov.il/he/publications/DocLib/2025/2.ShnatonPopulation/st02_11x.xlsx) | Counts and shares for religion by district and sub-district | 1948, 1961, 1972, 1983, 1995, 2008, 2022, and 2024 in the current workbook | Full religion categories at district/sub-district level | This reference-year series does not form an annual subnational panel. |

The [CBS API documentation](https://www.cbs.gov.il/en/Pages/API-Dictionary.aspx)
lists the locality fields and the district, religion, and locality code lists.
The annual locality workbook is also published through the CBS
[localities publication route](https://www.cbs.gov.il/he/publications/Pages/2019/%D7%99%D7%99%D7%A9%D7%95%D7%91%D7%99%D7%9D-%D7%91%D7%99%D7%A9%D7%A8%D7%90%D7%9C.aspx).
The API is the more direct machine route because it accepts a `year`
parameter. The [2022 Census locality and statistical-area workbook](https://www.cbs.gov.il/he/publications/LochutTlushim/2025/Selected%20data%2C%20by%20localities%20and%20statistical%20areas%20-%20the%202022%20Census.xlsx)
provides one census reference point with the main religion for each locality or
statistical area.

CBS also publishes an annual locality-by-religion table for
[people aged 0–17, 2009–2022](https://www.cbs.gov.il/he/Pages/search/TableMaps.aspx?CbsSubject=%D7%90%D7%95%D7%9B%D7%9C%D7%95%D7%A1%D7%99%D7%99%D7%94).
Its age restriction prevents its use as an all-population religion series.

### Self-defined Jewish religiosity

The [CBS Social Survey](https://www.cbs.gov.il/en/Statistical/seker-chevrati-e124.pdf)
is an annual repeated cross-sectional survey conducted since 2002. For Jews
aged 20 and over, it asks respondents to define their religiosity, with
categories such as secular, traditional, religious, and ultra-Orthodox. This
indicator measures self-definition. It does not measure the religion recorded
in the Population Register.

The published annual series is national. Public-use files include geographic
variables that can support district analysis, but a district series would be
a project estimate requiring survey weights, pooling or uncertainty review,
and a scope-consistent geographic filter. CBS does not publish an annual
locality panel for this self-definition measure. The 2022 Census products
separately publish a main household religious-lifestyle category at locality
and statistical-area level; that one-year household indicator is also distinct
from the Social Survey series.

### Licence and reuse

The [CBS end-user licence](https://www.cbs.gov.il/en/Pages/Enduser-license.aspx)
is a worldwide, royalty-free, perpetual, non-exclusive licence. It permits
commercial and non-commercial copying, distribution, and derivative works.
It requires the prescribed source acknowledgement when CBS information is
reproduced, prohibits misleading alteration and implied endorsement, and
excludes third-party rights, personal data, logos, photographs, and code. The
licence version in force on the retrieval date applies. These terms cover the
CBS-hosted tables and GIS files unless a file identifies third-party rights.

## How CBS defines its published geography

The [CBS district definition](https://www.cbs.gov.il/he/Pages/%D7%9B%D7%9C-%D7%94%D7%9E%D7%95%D7%A0%D7%97%D7%99%D7%9D.aspx?k=%D7%9E%D7%97%D7%95%D7%96)
states three rules relevant to this decision. Jerusalem District has included
East Jerusalem since 1967. Northern District has included Golan Sub-District
since 1982. CBS district presentations also include Israeli localities in the
Judea and Samaria Area; CBS publishes that area separately from the six
districts. Table 2.11 labels the Judea and Samaria row as Israeli localities
and records historical coverage changes in its footnotes.

The CBS files therefore do not provide a Green-Line-only total as a selectable
published category. A Green-Line result requires a project rule applied to CBS
rows or geometry. The source total will no longer reconcile after that rule is
applied unless the excluded population is reported separately.

## Scope options and operational implications

### Option A: Green-Line study area

**Definition.** The Green Line forms the study-area mask. Territory east of
the line in Jerusalem, the Golan Heights, and the West Bank falls outside the
study area.

**Locality rows.** Include CBS locality observations whose geography falls
inside the mask. Exclude Judea and Samaria Area locality rows and Golan
locality rows. In the API, these exclusions correspond to district code `7`
and Northern District rows with Golan sub-district code `region=29`.
Natural-area codes `291`–`294` identify the four Golan natural areas.
Jerusalem cannot be handled accurately as one locality row:
the annual row must either be omitted or replaced by a spatially divided
estimate from a finer geography for a supported year. The 2022 statistical
areas offer the available CBS route for that finer treatment, subject to
suppression and geometry limitations.

**Boundary display.** Show the Green Line as the study-area edge. The map
does not show the CBS outer extent or CBS district polygons as the country
edge. District statistics require spatial reconstruction because the CBS
Jerusalem and Northern districts cross the study-area mask.

**Line specification.** A later ruling would also need to name the selected
line file and its handling of the Jerusalem no-man's-land sectors and the
former Israel–Syria demilitarised zones. “Green Line” alone does not define a
single analysis polygon at locality scale.

**Resulting comparability.** National and affected-district totals become
project-derived estimates. They do not reproduce published CBS totals.

### Option B: CBS statistical coverage as published

**Definition.** Use the geographic categories and coverage in each CBS
release without a project territorial filter.

**Locality rows.** Apply no territorial exclusion to the selected CBS locality
file. Retain Golan Sub-District within Northern District, Jerusalem as CBS
defines it, and Israeli localities in the separately labelled Judea and
Samaria Area. Preserve the source's historical coverage notes when comparing
years.

**Boundary display.** Use CBS locality points or statistical-area polygons
and label the geography as “CBS statistical coverage”. Display the Judea and
Samaria Area separately where the source does. A boundary disclaimer must
state that source coverage does not determine legal status or endorse a
boundary.

**Resulting comparability.** Counts can reconcile to CBS releases, subject to
rounding, suppression, census revisions, and the difference between the
locality main-religion field and district religion counts.

### Option C: exclude locality rows beyond the Green Line within the CBS frame

**Definition.** Retain CBS units and identifiers, but remove locality rows
identified as beyond the Green Line. This is a source-row rule rather than a
spatially clipped study area.

**Locality rows.** Exclude locality rows assigned to the Judea and Samaria
Area (`district=7`) and rows in Golan Sub-District (`region=29`). The Golan
natural-area codes are `291`–`294`.
A row-only rule cannot remove East Jerusalem from locality code `3000` while
retaining West Jerusalem because CBS publishes Jerusalem as one locality. The
ruling must therefore record whether the Jerusalem row is retained in full,
excluded in full, or replaced for 2022 with finer statistical-area data. Each
treatment produces a different denominator.

**Boundary display.** Retain the CBS geographic frame and show excluded
localities as outside the analytic data coverage, for example as no-data
areas. Overlay the Green Line as a reference line. The frame and the data
coverage are therefore different objects and must have separate legend
labels.

**Resulting comparability.** Unaffected CBS locality identifiers remain
unchanged. The filtered total does not reproduce CBS national totals, and the
Jerusalem treatment determines whether the filter fully removes population
east of the Green Line.

## Boundary availability by option

| Option | Available boundary route | What the source provides | Terms and limitations |
| --- | --- | --- | --- |
| A: Green-Line study area | A Green Line reference must supplement CBS geometry. [Natural Earth disputed-boundary data](https://www.naturalearthdata.com/about/disputed-boundaries-policy/) publish de facto boundaries by default and separate de jure claim lines. [UN Map 3584 Rev. 1](https://digitallibrary.un.org/record/496980?ln=en) shows the former Mandate boundary and Armistice Demarcation Line but supplies a PDF reference rather than a ready locality-scale vector. | A mask and reference line independent of CBS coverage | Natural Earth is public domain, but its small-scale geometry requires fitness assessment before locality work. The UN map supplies a cartographic precedent rather than a reusable vector licence in this probe. A production Green Line file and its terms remain to be pinned after the scope ruling. |
| B: CBS statistical coverage | [CBS 2021 locality layer with 2022 Census data](https://www.cbs.gov.il/he/publications/DocLib/2022/%D7%A7%D7%98%D7%9C%D7%95%D7%92/1.%20%D7%99%D7%99%D7%A9%D7%95%D7%91%D7%99%D7%9D%20%D7%95%D7%97%D7%9C%D7%95%D7%A7%D7%95%D7%AA%20%D7%92%D7%90%D7%95%D7%92%D7%A8%D7%A4%D7%99%D7%95%D7%AA/census_2022_setl_all_2021.gdb.zip) and [CBS 2022 statistical-area layer](https://www.cbs.gov.il/he/publications/DocLib/2022/%D7%A7%D7%98%D7%9C%D7%95%D7%92/1.%20%D7%99%D7%99%D7%A9%D7%95%D7%91%D7%99%D7%9D%20%D7%95%D7%97%D7%9C%D7%95%D7%A7%D7%95%D7%AA%20%D7%92%D7%90%D7%95%D7%92%D7%A8%D7%A4%D7%99%D7%95%D7%AA/census_2022_statistical_areas_2022.gdb.zip) | File Geodatabase locality points and statistical-area polygons in the Israel Transverse Mercator grid | CBS open licence and attribution apply. The locality layer is point geometry. CBS states that rural statistical-area extents are not authoritative locality boundaries and that some Judea and Samaria localities without statistical areas are represented by 50-metre circles. The public catalogue located in this probe did not expose a current district/sub-district polygon download. |
| C: row exclusion within CBS frame | The same CBS locality and statistical-area files as Option B, plus a Green Line reference for classifying and displaying exclusions | Stable CBS identifiers and the CBS frame, with a separate inclusion flag | CBS licence applies to CBS files; the reference-line source carries its own terms. The geometry cannot by itself split the annual Jerusalem locality observation. |

The subsequent product build located the official Ministry of Interior
sub-district polygons through the [sub-district boundary item linked from the
CBS ArcGIS organisation](https://www.arcgis.com/home/item.html?id=927cfe72a31e4a05ab130526c1391acf).
The 15 polygons dissolve into the six CBS districts. The endpoint carries the
Planning Administration geographic-information terms linked in the CBS item.
The separately labelled Judea and Samaria Area remains outside that six-
district layer; the product represents it as CBS statistical-area coverage
selected through locality district code `7` and labels it accordingly.

The [CBS GIS landing page](https://www.cbs.gov.il/he/cbsNewBrand/Pages/%D7%A9%D7%9B%D7%91%D7%95%D7%AA-%D7%9E%D7%9E%D7%92-%D7%9E%D7%A2%D7%A8%D7%9B%D7%AA-%D7%9E%D7%99%D7%93%D7%A2-%D7%92%D7%90%D7%95%D7%92%D7%A8%D7%A4%D7%99%D7%AA-GIS.aspx)
links both public geodatabases and their field documentation. The locality
layer describes its coverage as nationwide. The statistical-area layer uses
the same description and explicitly documents its treatment of Judea and
Samaria localities.

## Boundary precedents in neutral data projects

Neutral data projects separate the data producer's coverage from the map's
boundary convention and state the convention directly.

- [geoBoundaries](https://www.geoboundaries.org/countryDownloads.html)
  publishes single-country files as each country represents itself. Its
  global composite instead identifies disputed areas. This precedent keeps a
  source-aligned country file and a dispute-aware global layer as different
  products.
- [Natural Earth](https://www.naturalearthdata.com/about/disputed-boundaries-policy/)
  displays de facto boundaries by default, marks them as disputed, and
  provides de jure claim lines as auxiliary data. This precedent stores the
  alternative conventions as separate linework rather than silently choosing
  one geometry.
- The [World Bank's standard map disclaimer](https://www.worldbank.org/en/news/press-release/2020/07/30/statement-on-the-world-bank-and-national-boundaries)
  states that boundaries and denominations on a map do not express a
  judgement about legal status or endorse those boundaries. This precedent
  addresses interpretation, but it does not substitute for naming the actual
  inclusion rule.

These precedents do not decide among Options A, B, and C. They show the
operational need to name the source coverage, boundary convention, excluded
rows, and treatment of disputed lines in the metadata and legend.

## Ruling record

- **Selected option**: Option B, CBS statistical coverage as published,
  approved by the project lead on 2026-07-11.
- **Jerusalem treatment**: retain East Jerusalem within Jerusalem District
  under CBS statistical definitions.
- **Golan treatment**: retain Golan Sub-District within Northern District
  under CBS statistical definitions.
- **Judea and Samaria locality treatment**: retain any localities beyond the
  Green Line present in the CBS files, including the separately labelled Judea
  and Samaria Area.
- **Boundary source and displayed disclaimer**: use CBS geography and label
  the extent as CBS statistical coverage. The project records the statistical
  source's definitions without endorsing any boundary position.
- **Construct**: ship the two-slot Register product. The
  `religious_affiliation_percent` slot is “Classified in a religion group (%) —
  Population Register classification, not belief or practice”. The
  `no_religion_percent` slot is CBS's “Not classified by religion (%)”. This is
  a Population Register classification for residents without a recognised
  religious classification, notably many immigrants and their descendants who
  are not registered in a religion group. It is not a measure of no religion,
  irreligion, or secularity.
- **Build**: `scripts/build_il_area_summary.R` ships the eight table 2.11
  reference years. The 1948 wave is recorded context with null construct
  fields because three recognised-group district distributions are
  suppressed. The 17.1-thousand population residual is reported and never
  distributed.
- **Sensitivity conditions for any later product**: keep the published data
  unchanged. Record the Option A filter as district code `7`, sub-district code
  `29`, and natural-area codes `291`-`294`, with Jerusalem locality code `3000`
  requiring a finer spatial split rather than a row filter. Record the Option C
  filter as district code `7`, sub-district code `29`, and natural-area codes
  `291`-`294`; its configuration must separately choose whether Jerusalem
  locality code `3000` is retained, excluded, or replaced with finer 2022 data.
