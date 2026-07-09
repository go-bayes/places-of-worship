# Austria religious-affiliation wave probe

Last verified: 2026-07-10

## Status

- **Build decision**: proceed. Seven machine-readable Bundesland waves are available, the 2021 statistical basis is explicit, and the source terms permit reuse with attribution.
- **Census waves**: 1951, 1961, 1971, 1981, 1991, and 2001.
- **Later wave**: 2021, a mixed total-population estimate based on a voluntary sample survey, imputation for children, and an estimate for the institutional population.
- **Deepest common geography**: Bundesland, nine units.
- **Licence result**: the Statistics Austria main-site tables use the website reuse terms. The separate Statistics Austria open.data CC BY 4.0 licence does not govern these files.

## Historical census route

Statistics Austria publishes the six census waves in one OpenDocument Spreadsheet (ODS):

```text
https://www.statistik.at/fileadmin/pages/439/neu__Religion__1_.ods
```

The relevant sheet is `A1`, *Bevölkerung nach dem Religionsbekenntnis und Bundesländern 1951 bis 2001*. It contains national and Bundesland counts for 1951, 1961, 1971, 1981, 1991, and 2001. The six censuses collected religious affiliation through population self-declaration.

The Bundesland columns are Burgenland, Kärnten, Niederösterreich, Oberösterreich, Salzburg, Steiermark, Tirol, Vorarlberg, and Wien. The national cell equals the sum of these nine cells for every headline count used in the product.

The category frame changes. `Sonstiges` includes Islam in 1951 and 1961. Later waves separate Islam. A stable broad product therefore defines religious affiliation as total population minus `Ohne Bekenntnis` and `Ohne Angabe` or `Unbekannt`. The not-stated category remains in the denominator and outside the affiliation and no-religion numerators.

Probe object:

| Item | Value |
| --- | --- |
| Format | ODS |
| Relevant sheet | `A1` |
| Bytes | 18,802 |
| SHA-256 | `c35e9265bfa48d09af0176d1b85ef1d70884dfaf00e52f3f742970652f9b2a18` |
| Machine-readable aggregate | yes |

Statistics Austria also links STATcube census time-series databases from its historical-census page. The relevant general routes are `https://statcube.at/statcube/opendatabase?id=def1727` and `https://statcube.at/statcube/opendatabase?id=def1727g`. STATcube prohibits automated retrieval outside its web application. The direct ODS is therefore the replayable source route for this build.

## The 2021 statistical basis

The 2021 religion figure is not a register count. Religion was absent from the 2021 register census. Statistics Austria instead fielded a one-off voluntary religious-affiliation module in quarters 1 to 4 of the 2021 Microcensus Labour Force Survey.

The survey asked people aged 16 and older in private households. Statistics Austria reports 27,656 respondents, a 95.7% response rate, and a 20.7% proxy-interview rate. The agency imputed the religion variables for 5,106 children under 16 from parental information. Statistics Austria then estimated the religion distribution of the 129,314 people living in institutions from private-household marginal distributions. The final table is therefore a mixed total-population estimate: sample-survey estimates for private-household residents aged 16+, parent-based imputations for children, and an estimate for the institutional population.

Statistics Austria calibrated the private-household survey to the 2021 annual-average resident population in private households. The calibration incorporated age, Bundesland, sex, citizenship, and country of birth. The reference period is the respondent's current situation at the interview date across January to December 2021. The deepest released geography is Bundesland.

Direct ODS route:

```text
https://www.statistik.at/fileadmin/pages/439/neu__Religion_2021_Bundesland.ods
```

Standard documentation:

```text
https://www.statistik.at/fileadmin/shared/QM/Standarddokumentationen/B_en/engl_std_b_religionzugehoerigkeit.pdf
```

Probe object:

| Item | Value |
| --- | --- |
| Format | ODS |
| Relevant sheet | `Tabelle1` |
| Bytes | 7,986 |
| SHA-256 | `c823ec388d8e27bbeb031405fee2269bd2f1d230af81444eba27531f5217972a` |
| Machine-readable aggregate | yes |

The spreadsheet displays absolute estimates to one decimal thousand, but the ODS cells retain unrounded weighted values. The build uses the underlying values. All nine Bundesland cells then sum to the national cell for total population, Christianity, Roman Catholic, Protestant, Orthodox, Islam, other religion, and no religion within floating-point precision.

The official release caveat is: “Values with less than extrapolated 6 000 persons are highly subject to random fluctuations.” The German ODS adds that values below an extrapolated 3,000 people are statistically uninterpretable. The 2021 question weights compensate for `don't know` and `no information`, leaving no unknown category.

## Source terms

Statistics Austria's website information states:

> If the contained material is accurately reproduced and the source “Statistics Austria” is quoted it is permitted to reproduce, distribute, make publicly available and process the content.

The next sentence requires a note at an adequate position when published tables, graphics, or text are partially used, displayed, or otherwise changed. The page also states that separate licences and terms apply to Statistics Austria open data. The pinned main-site terms route is:

```text
https://www.statistik.at/en/about-us/responsibilities-and-principles/legal-basis/website-information
```

Statistics Austria open.data has a separate CC BY 4.0 licence. Its catalogue and terms routes are:

```text
https://data.statistik.gv.at/web/catalog.jsp
https://data.statistik.gv.at/web/?page=terms
```

The complete open.data catalogue did not contain `Religion`, `Religions`, `Bekenntnis`, or `Konfession` on 2026-07-10. The retrieved catalogue was 1,108,130 bytes with SHA-256 `8f1a9104fe3433af3f740e0cda3e1b634baded7b8c4a6310098f26710d8fce6d`. The historical and 2021 ODS files remain on `www.statistik.at/fileadmin/`. The product therefore records the main-site reuse grant and does not label the source tables CC BY 4.0.

The pinned website-information page was 91,713 bytes with SHA-256 `727e1e7babf4db3a7a8cee59dbcdb689a5a2e8472ca5cdb88474bbb625ae0f73`. Its live bytes matched the cached probe object on 2026-07-10.

## Boundaries

The pinned boundary route is geoBoundaries gbOpen AUT ADM1:

```text
https://www.geoboundaries.org/api/current/gbOpen/AUT/ADM1/
```

The API response identifies nine `Bundesländer`, boundary year 2017, with ISO 3166-2 codes `AT-1` through `AT-9`. The pinned GeoJSON is:

```text
https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/AUT/ADM1/geoBoundaries-AUT-ADM1.geojson
```

| Item | Value |
| --- | --- |
| Features | 9 |
| CRS | WGS84 |
| Valid, non-empty geometries | 9 |
| Bytes | 17,910,858 |
| SHA-256 | `b8fe718a750753381bcb977adef9cb0d33c966a81db02bb0357263a86629b993` |
| Source licence | Creative Commons Attribution-ShareAlike 2.0 |
| Attribution | geoBoundaries; Federal Office for Metrology and Survey, Austria |

The raw file requires simplification before publication. The build uses `scripts/lib/simplify_boundary.R`, preserves all nine features, and enforces an 800 KB ceiling.

## Product decision

The Bundesland frame is stable across all seven released waves. No companion roll-up or concordance is needed. The product includes religious-affiliation and no-religion shares for 1951, 1961, 1971, 1981, 1991, 2001, and 2021.

The product must preserve the source-design break. Rows from 1951 to 2001 are census self-declarations. Rows from 2021 are mixed estimates based on a voluntary sample survey, child imputation, and institutional-population estimation. The 2021 quality flag carries the official small-estimate caveat.

Exact reconciliation uses the unrounded source cells. For each wave, the nine Bundesland rows sum to the national source row for total population, religious affiliation, no religion, and not stated. The build records the 28 comparisons in `apps/regions/at/data/national_reconciliation.csv`. No PDF table is transcribed.
