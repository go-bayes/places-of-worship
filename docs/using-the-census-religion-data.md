# Using the census-religion data

This tutorial shows a researcher how to load, interpret, and responsibly reuse the census-religion data products. It complements the [FAQ](../FAQ.md), which explains the project's workflow, and [Religious change in the census-religion corpus](religious-change-highlights.md), which describes what the products document. The older [RA CSV validation tutorial](development/ra-cli-tutorial.md) covers the evidence-entry workflow and is archived; nothing here depends on it.

## Where the data live

Each country ships as one or more governed area-summary products. There are three pieces per product, and every analysis should touch all three.

The first piece is the area summary itself: `apps/regions/<iso2>/data/area_summary_<level>.json`, with a CSV of the same rows beside it. This file is what the country page renders and what you analyse. `<level>` names the geography — `district` for Belize, `commune` for Chile, `sa2` for Australia.

The second piece is the boundary file: a GeoJSON in the same directory, keyed to the rows by `area_unit_id`. Boundary vintages are recorded per product; some countries ship one boundary frame per wave.

The third piece is the manifest: `docs/manifests/<iso2>-census-religion-<years>.json`. The manifest carries the source tables, retrieval dates, licence position, universes, denominators, reconciliation results, and method notes. The manifest is the provenance contract; cite it, and read it before comparing anything across waves.

The data contracts are `schemas/area-summary.schema.json` and `schemas/area-summary.v2.schema.json`.

## Anatomy of an area summary

An area summary is a JSON object with a `rows` array and an `indicators` declaration. Each row is one area in one census wave:

```json
{
  "area_name": "Corozal",
  "year": 2000,
  "population_total": 32209,
  "religious_affiliation_count": 28699,
  "religious_affiliation_percent": 89.1024,
  "no_religion_count": 3438,
  "no_religion_percent": 10.674,
  "quality_flag": "frame_2000_seventeen_category_integer_full_count;..."
}
```

The `indicators` array declares what each field means for this country: the construct, the denominator, the universe, and the quality notes. Read it first — the same field name does not mean the same thing in every product.

## The two-slot design, and the trap in it

Most products use the ordinary two-slot design: `religious_affiliation_percent` is the share of the population reporting a named religion, and `no_religion_percent` is the census's own none line. Non-response lines (don't know, not stated, refused) sit in the denominator and in neither slot, which is why the two shares need not sum to 100.

A minority-share family reuses the same two field names for a different construct. Where a census frame sums to 100 percent affiliation by construction (Sri Lanka, Indonesia, Bangladesh, Cambodia), `religious_affiliation_percent` carries the reference-group share and `no_religion_percent` carries the named-minority complement. Sri Lanka's own indicator declaration says it plainly: the slot is "not a measure of no religion, belief, practice, or secularity". Any script that aggregates `no_religion_percent` across countries must test the indicator declaration and refuse minority-share products; `scripts/build_census_religion_note_figures.R` shows the guard:

```r
for (ind in d$indicators) {
  if (identical(ind$indicator_id, "no_religion_percent") &&
      grepl("minority share|complement|reference group", tolower(ind$description %||% ""))) {
    stop("minority-share slot design in ", path, "; not a no-religion measure")
  }
}
```

## Worked example: district change in Belize

```r
library(jsonlite)
library(dplyr)

bz <- fromJSON("apps/regions/bz/data/area_summary_district.json", simplifyVector = FALSE)

districts <- tibble(
  district = vapply(bz$rows, function(r) r$area_name, character(1)),
  year = vapply(bz$rows, function(r) as.numeric(r$year), numeric(1)),
  no_religion = vapply(bz$rows, function(r) as.numeric(r$no_religion_percent), numeric(1))
)

districts |>
  filter(year %in% c(2000, 2022)) |>
  tidyr::pivot_wider(names_from = year, values_from = no_religion, names_prefix = "y") |>
  mutate(change = y2022 - y2000) |>
  arrange(desc(change))
```

This yields the district table in the highlights note: Stann Creek +37.9 percentage points, Corozal +12.1. For a national figure, weight by `population_total` within each wave; never average area percentages unweighted.

## Comparing across waves: five hazards

Cross-wave comparison is where reuse goes wrong, and every hazard below is disclosed in the product or its manifest rather than hidden.

The first hazard is the universe: some countries ask religion of all persons (Belize), others of the population aged 15 and over (Chile, Estonia) or 12 and over (Peru). Universes per wave sit in the manifest.

The second hazard is the denominator: some products use the whole census population, others the stated-response denominator that excludes not-stated answers (New Zealand, Australia, England and Wales). The `indicators` declaration names the basis.

The third hazard is the category frame: none lines merge and split across waves. Saint Lucia's 2022 no-religion line combines Atheist and None; the Cook Islands no-religion frame changes mid-series. The `quality_flag` on each row and the manifest's alignment notes carry these folds.

The fourth hazard is the withheld comparison: where the instrument changed (Lithuania's 2021 survey-estimated religion, Cabo Verde's 2010–2021 break), the product withholds cross-wave change metrics, and downstream reuse should too.

The fifth hazard is the falling line: a falling no-religion share can reflect instrument, enumeration, or category changes as well as changed belief. South Africa's manifest documents the case in full — the 2011 census dropped the religion question, and the 2016 intercensal Community Survey reported about 10.7 percent religiously unaffiliated against the 2.9 percent in the 2022 census line.

## Licences and attribution

Licence positions differ by statistics office and are recorded per manifest in the `licence` blocks, together with the attribution strings the source requires. Derived summaries ship with full attribution under the project's build-then-ask stance; some products are staged while reuse confirmations are pending, and the manifest's `dataset_role` says which. Before republishing any table, copy the attribution from the manifest and keep the manifest citation beside it.

## Related documents

- [FAQ](../FAQ.md) — what the project is doing and how review works.
- [Religious change in the census-religion corpus](religious-change-highlights.md) — what the shipped products document, with figures.
- [Measurement diversity principle](development/measurement-diversity-principle.md) — why regimes are displayed rather than harmonised away.
- [Data storage pipeline](data-storage-pipeline.md) — how products and manifests are governed.
- [Minority-share metric design](development/minority-share-metric.md) — the two-slot variant in full.
