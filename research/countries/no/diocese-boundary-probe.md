# Norway diocese boundary probe

## Outcome

The boundary probe selected route (a): Kartverket's [Geonorge `Soknegrenser` dataset](https://kartkatalog.geonorge.no/Metadata/uuid/289d459c-0390-4000-84f3-88982f2cdb0c) contains 11 direct `Bispedømme` surfaces. The product therefore needs no municipality-to-diocese concordance and no municipality dissolve. Route (b), Church of Norway open data, and route (c), a municipality dissolve, were not pursued after the authoritative direct-polygon route succeeded.

## Geonorge catalogue probe

The initial catalogue searches covered `bispedømme`, `kirkelig inndeling`, and `sokn`. The successful record is `Soknegrenser`, Geonorge metadata UUID `289d459c-0390-4000-84f3-88982f2cdb0c`. The [machine-readable metadata](https://kartkatalog.geonorge.no/api/getdata/289d459c-0390-4000-84f3-88982f2cdb0c) states that the dataset contains parish boundaries, parishes, and dioceses, with parishes and dioceses represented as surfaces. The metadata states that the latest update applies from 1 January 2025. Its catalogue update date is 6 February 2025.

The [Geonorge download capability response](https://nedlasting.geonorge.no/api/capabilities/289d459c-0390-4000-84f3-88982f2cdb0c) offers one nationwide SOSI package in ETRS89 / UTM zone 33N (`EPSG:25833`). The SOSI file contains exactly 11 `.FLATE` records whose `OBJTYPE` is `Bispedømme`. Each surface carries `BISPEDØMMENUMMER`, `BISPEDØMMENAVN`, and a signed `REF` list of source curve identifiers. The builder reconstructs each feature from its own referenced curves and polygonises each reference network separately. It never concatenates the 11 `sfg` objects with `c()`.

## Source-aligned geography

The SSB table metadata contains codes `01` through `11` for the 11 named dioceses and code `99` for `Unknown diocese`. The 11 Geonorge surface codes and names match the 11 mapped SSB categories after adding SSB's published English suffix `diocese`. The output preserves SSB's table labels verbatim. `Unknown diocese` remains unallocated national context because no polygon can represent it.

The shipped boundary vintage is 1 January 2025. This current frame aligns with the final year of the 2005-2025 membership series and follows Geonorge's effective-date statement. Counts follow SSB's published diocese assignment for each reference year, while the drawn boundaries use the 2025-01-01 vintage. Diocese composition changed during the series: the Church of Norway documents that [Rindal parish moved from Møre to Nidaros on 1 January 2020](https://www.kirken.no/nn-NO/bispedommer/more/aktuelt/endringar%20i%20bisped%C3%B8megrenser%20og%20prostigrenser%20fr%C3%A5%202020/). Early-year counts near transferred parishes may therefore not align exactly with the drawn borders. Neither [table 06929](https://www.ssb.no/en/statbank1/table/06929) nor SSB's [About the statistics documentation](https://www.ssb.no/en/kultur-og-fritid/religion-og-livssyn/statistikk/den-norske-kirke) states whether SSB rebases the historical series to current dioceses. The product therefore makes no rebasing claim and does not reconstruct historical boundaries.

The SSB [population definition](https://www.ssb.no/en/kultur-og-fritid/religion-og-livssyn/statistikk/den-norske-kirke) excludes Svalbard from the Church of Norway statistics. The Church of Norway states that [Nord-Hålogaland diocese formally includes Svalbard](https://www.kirken.no/nb-NO/bispedommer/nord-haalogaland/biskop%20og%20bisped%C3%B8mme2/), but the shipped polygons end at approximately 71.4° N and exclude Svalbard. The table and the mapped polygons therefore share the same Svalbard exclusion.

The direct Geonorge surfaces extend through coastal waters. Their union measures 470,107.2744 square kilometres before simplification and 470,107.3930 square kilometres after simplification. These figures describe the source surfaces and are not Norwegian land-area estimates. The area-summary product therefore leaves `land_area_sq_km` and all density fields null.

## Geometry gates

The source and simplified layers each contain 11 valid, non-empty features and 11 distinct per-feature WKB SHA-256 hashes. The union has no interior ring that would represent a gap. The sum-of-features minus union-area result stays within numerical noise: its absolute value is below 0.002 square metres before and after simplification, against the fixed 1-square-metre topological tolerance. The shared `scripts/lib/simplify_boundary.R` helper selected mapshaper's weighted, keep-shapes method at 10 per cent with `-clean`; the committed GeoJSON is 243,129 bytes.

The municipality-concordance gate is not applicable to the successful direct-polygon route. Coverage and overlap gates still apply to the direct national partition, and both pass. A future fallback to municipality dissolution would require a separate vintage-pinned concordance in tracked data, with every municipality assigned exactly once.

## Membership and reconciliation probe

[SSB table 06929](https://data.ssb.no/api/v0/en/table/DNKMedlemmer) publishes all years from 2005 through 2025. Its membership category code is `Medlemmer`; its English API label is preserved verbatim in the product. The table publishes counts and no diocese population percentage. The product therefore imports no denominator and derives no percentage.

Omitting the optional `Bispedomme` dimension returns SSB's published national series. For every year, the sum of the 11 mapped categories plus `Unknown diocese` equals that national total exactly. Across 2005-2025, the unallocated count ranges from 0 to 25,923 members, or from 0 to 0.6758% of the published national total. [SSB's table metadata states verbatim](https://www.ssb.no/en/statbank1/table/06929): “Unknown diocese do not include members living aboard.” The source uses “aboard”; the project preserves the source's wording. SSB's table note also warns that national totals from 2011 cannot be compared with earlier years because `Unknown diocese` is then included. A second source note states that the membership variable includes members and an unbaptised child under 18 of a member through 2020, while the variable includes members only from 2021.

## Licence and provenance

SSB's [current licence page](https://www.ssb.no/en/diverse/lisens) applies Creative Commons Attribution 4.0 International (CC BY 4.0) with Statistics Norway attribution. The project records CC BY 4.0 as the current term and makes no NLOD claim. The Geonorge metadata records `No conditions apply to access and use` and no public-access limitation for `Soknegrenser`; the project preserves that wording rather than assigning a different licence.

The manifest records the URL, retrieval timestamp, HTTP method, request body where applicable, byte size, and SHA-256 digest for every cached SSB and Geonorge input. Raw responses remain under the git-ignored `data/raw/no_membership/` cache.
