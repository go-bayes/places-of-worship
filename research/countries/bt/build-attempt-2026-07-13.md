# Bhutan build attempt, 2026-07-13 — HELD at the coverage census

A build lane opened the same day as the route probe (7c40ee1) under two conductor rulings: place_count carries the DAG "Religious institutions" count (the Taiwan register analogue), and the "Religious monuments" indicator stays out of the area-summary.v2 product, preserved verbatim in the manifest with a second-indicator PI question recorded. The lane stopped at the coverage census, correctly, on two independent grounds. No deliverable was created; no tracked file changed; partial retrievals sit in the git-ignored `data/raw/bt_census/`.

## Ground one: Wayback retrieval became intermittent

The live host (nsb.gov.bt, 43.230.208.104) timed out, as the probe records. The Wayback Machine returned the combined 2022 archive (all 20 dzongkhag sheets) and the 2023 archive (16 sheets), plus several individual earlier editions, then began refusing connections mid-census. The lane refused to count indexed-but-unfetched captures as retrievable — the coverage-census rule requires successful fetches — and stopped rather than hammer the archive.

## Ground two: malformed source layouts need source-level inspection

The partial retrievals expose defects that bar mechanical extraction:

- The 2017 Chhukha PDF extracts its printed year headings as `2014 2016 2016` with a separate trailing `2017`, against three visible value columns — the year-to-column assignment is not recoverable from the text layer alone.
- Several sheets place a bare `YEAR` heading above three unnamed columns, with the actual years absent from the extracted cells.
- The 2022 Samdrup Jongkhar sheet prints religious-monument values but no religious-institutions row.
- Some archived PDFs carry damaged cross-reference tables and cannot be rendered or extracted reliably.

The lane assigned no years from neighbouring tables or edition conventions — printed values and printed years only — and therefore could not produce a trustworthy retrievable matrix, cross-edition agreement result, or extracted table.

## Unblocks

1. A retry with slow pacing (5-10 s) against Wayback, or a reachable route to the live NSB portal, to complete the 20 x 8 retrieval census.
2. Page-image (not text-layer) verification of the defective layouts — the year-header defects likely need visual reading of each sheet's column layout before any extraction rule is set.
3. The Samdrup Jongkhar 2022 missing-row case needs a per-sheet indicator-presence census across all editions, so the product's null pattern is recorded rather than discovered.

The probe's BUILDABLE verdict stands; the hold is operational (retrieval and layout verification), not a record refutation.
