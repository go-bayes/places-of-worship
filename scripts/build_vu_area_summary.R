# build the vanuatu area-summary products with census religion data.
# inputs: the boundaries-only scaffolds (apps/regions/vu/data/area_summary_adm{1,2}.json,
# which carry place counts, land areas and provenance) and the census
# religion tables extracted from the 2009/2020 basic tables volume 1
# (apps/regions/vu/data/source/*.csv, see sources.csv for provenance).
# outputs: the same JSON/CSV products with religion fields filled where
# the census supports them: provinces 2009+2020, area councils 2020.
# run from the repo root: Rscript scripts/build_vu_area_summary.R

library(jsonlite)

vu_dir <- "apps/regions/vu/data"
# source extracts live in the private research tier (attributed-use
# licence class; see docs/data-access-and-research-tiers.md). fetch for
# rebuilds: gcloud storage cp -r gs://pow-research-data/research_datasets/vu_census_extracts/* data/raw/vu_census_extracts/
src_dir <- "data/raw/vu_census_extracts"
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")

# affiliation = stated denominator minus no-religion; refusals and
# not-stated leave the denominator entirely (matches the nz product)

# the denomination percent metrics carried alongside affiliation; every one
# is present in the 1967, 1999, 2009 and 2020 province tables, so the
# choropleth stays comparable across all four censuses. customary beliefs is
# the headline diversification signal; the four mission-era churches trace the
# denominational geography (Anglican in the Banks/Torba, Presbyterian in the
# central islands, Catholic and SDA scattered)
DENOM_LABELS <- c("customary_beliefs", "presbyterian", "anglican",
                  "catholic", "seventh_day_adventist")

# read one extracted census csv into per-geography religion aggregates.
# returns geography, denominator (stated responses), affiliated count,
# no-religion count, and a stated-denominator count for each DENOM_LABELS
# category
aggregate_census <- function(path, level_filter = NULL, geo_col = "geography") {
  raw <- read.csv(path, stringsAsFactors = FALSE)
  if (!is.null(level_filter)) raw <- raw[raw$geo_level %in% level_filter, ]
  if (geo_col != "geography") raw$geography <- raw[[geo_col]]
  raw$count <- suppressWarnings(as.numeric(raw$count))
  out <- do.call(rbind, lapply(split(raw, raw$geography), function(g) {
    lbl <- g$religion_label_normalised
    total <- g$count[lbl == "total"]
    refuse <- sum(g$count[lbl == "refuse_to_answer"], na.rm = TRUE)
    not_stated <- sum(g$count[lbl == "not_stated"], na.rm = TRUE)
    no_rel <- sum(g$count[lbl == "no_religion"], na.rm = TRUE)
    # stated denominator excludes refusals and not-stated, matching the
    # nz product's "stated religious-affiliation response" basis
    stated <- total - refuse - not_stated
    row <- data.frame(
      geography = g$geography[1],
      population_total = stated,
      religious_affiliation_count = stated - no_rel,
      no_religion_count = no_rel,
      stringsAsFactors = FALSE
    )
    # one count column per tracked denomination (0 where the census did not
    # tabulate that category); percents are derived in fill_rows
    for (d in DENOM_LABELS) {
      row[[paste0(d, "_count")]] <- sum(g$count[lbl == d], na.rm = TRUE)
    }
    row
  }))
  rownames(out) <- NULL
  out
}

# fill religion fields on scaffold rows for one census year from an
# aggregate table keyed by lowercase geography name. mode "full" fills
# affiliation, no-religion, denominations and the place rate; mode
# "denominations_only" is for 1967, whose Table A tabulates adherents of
# religious groups aged 15+ with no no-religion category, so affiliation,
# no-religion and the place rate (a different, total-population denominator)
# are left null and only the denomination shares are comparable
fill_rows <- function(rows, agg, year, extra_flag, source_ids_added,
                      mode = "full", pop_basis = NULL) {
  key <- tolower(trimws(agg$geography))
  for (i in seq_len(nrow(rows))) {
    if (rows$year[i] != year) next
    j <- match(tolower(trimws(rows$area_name[i])), key)
    if (is.na(j)) next
    pop <- agg$population_total[j]
    rows$population_total[i] <- pop
    rows$population_total_basis[i] <- if (!is.null(pop_basis)) pop_basis else
      "total people with a stated religious-affiliation response (census total in private households minus refusals and not-stated)"
    # denomination shares over the stated denominator (present in every year)
    for (d in DENOM_LABELS) {
      cnt <- agg[[paste0(d, "_count")]][j]
      rows[[paste0(d, "_percent")]][i] <- round(100 * cnt / pop, 2)
    }
    if (mode == "full") {
      aff <- agg$religious_affiliation_count[j]
      no_rel <- agg$no_religion_count[j]
      rows$religious_affiliation_count[i] <- aff
      rows$religious_affiliation_percent[i] <- round(100 * aff / pop, 2)
      rows$no_religion_count[i] <- no_rel
      rows$no_religion_percent[i] <- round(100 * no_rel / pop, 2)
      rows$places_per_10000_residents[i] <- round(10000 * rows$place_count[i] / pop, 2)
    }
    flags <- c("current_place_counts_repeated_across_census_years", extra_flag)
    rows$quality_flag[i] <- paste(flags[nzchar(flags)], collapse = ";")
    rows$source_dataset_ids[[i]] <- unique(c(rows$source_dataset_ids[[i]], source_ids_added))
  }
  rows
}

census_source_datasets <- list(
  list(
    source_dataset_id = "mcarthur-yaxley-1967-census-table-a",
    name = "1967 Census of the New Hebrides, Table A: adherence to principal religious groups per 1,000 persons aged 15+, by island",
    provider = "Norma McArthur and J. F. Yaxley for the Condominium of the New Hebrides; digitised by the Places of Worship project",
    url = NA,
    retrieval_date = "2026-07-08",
    local_path = "data/VAN/religion_proportion_by_island_1967.xlsx",
    licence = list(
      name = "government census report, attributed research use",
      url = NA,
      attribution = "McArthur & Yaxley (1968), Condominium of the New Hebrides"
    ),
    citation = "McArthur, Norma, and J. F. Yaxley (1968). Condominium of the New Hebrides: A Report on the First Census of the Population 1967. Sydney: V.C.N. Blight, Government Printer. Table A, p. 67.",
    notes = "Island-level per-1,000 adherence rates for persons aged 15+ were aggregated to the six modern provinces by scripts/build_vu_1967_provinces.py, weighting each island by its aged-15+ population and using the island->province crosswalk implied by the 2009 census island rows. The reconstructed national customary share (14.65%) matches the report's national row (14.6%) and province populations sum to the national aged-15+ total minus the 262 ship-board residents. The 1967 census tabulated adherents of religious groups aged 15+ with no no-religion category, so only denomination shares are comparable to later censuses."
  ),
  list(
    source_dataset_id = "vnso-1999-census-main-report-t2-10",
    name = "1999 Vanuatu National Population and Housing Census, Main Report, Table 2.10: population by religion and island of residence",
    provider = "Vanuatu National Statistics Office (VNSO); print volume digitised by Guy Lavender Forsyth",
    url = NA,
    retrieval_date = "2026-07-06",
    local_path = "apps/regions/vu/data/source/vu_religion_by_province_1999_mainreport_t2_10.csv",
    licence = list(
      name = "no explicit licence; government census publication, attributed research use",
      url = NA,
      attribution = "Vanuatu National Statistics Office"
    ),
    citation = "Vanuatu National Statistics Office (2000). The 1999 Vanuatu National Population and Housing Census, Main Report. Port Vila.",
    notes = "Print-only volume (previously located only at NLA Canberra/SPC Noumea); scan received from Guy Lavender Forsyth 2026-07-06 and transcribed at province level. Every province row sums exactly to its total and provinces sum to the national row, which matches the national series in Table 30 of the 2020 Analytical Report (its 1999 refuse-to-answer 2,374 equals this table's do-not-want-to-say 320 plus not-stated 2,054). Provinces include urban municipalities (Efate row carries Port Vila; Santo carries Luganville). Island-level rows exist in the scan and await transcription for the area-council harmonisation work."
  ),
  list(
    source_dataset_id = "vbos-2020-census-basic-tables-t3-5",
    name = "2020 National Population and Housing Census, Basic Tables Volume 1, Table 3.5: population in private households by religion and region",
    provider = "Vanuatu Bureau of Statistics (VBoS) / Pacific Community (SPC)",
    url = "https://www.spc.int/digitallibrary/get/2dwwa",
    retrieval_date = "2026-07-03",
    local_path = "apps/regions/vu/data/source/vu_religion_by_region_2020_basictables_t3_5.csv",
    licence = list(
      name = "no explicit licence; SPC/VBoS research-use acknowledgement",
      url = "https://www.spc.int/digitallibrary/get/2dwwa",
      attribution = "Vanuatu Bureau of Statistics and the Pacific Community (SPC)"
    ),
    citation = "Vanuatu Bureau of Statistics (2022). 2020 National Population and Housing Census, Basic Tables Volume 1.",
    notes = "Extracted with scripts/extract_vu_census_religion.py; the published table is internally inconsistent by plus or minus 1-2 across rows (pattern consistent with cell perturbation), verified against the PDF text layer and identical in the VBoS Version 2 file. Counts reproduced for research with acknowledgement; formal redistribution terms unconfirmed."
  ),
  list(
    source_dataset_id = "vnso-2009-census-basic-tables-t3-5",
    name = "2009 National Population and Housing Census, Basic Tables Volume 1, Table 3.5: population by religion and region",
    provider = "Vanuatu National Statistics Office (VNSO)",
    url = "https://www.spc.int/digitallibrary/get/aazaf",
    retrieval_date = "2026-07-04",
    local_path = "apps/regions/vu/data/source/vu_religion_by_province_2009_basictables_t3_5.csv",
    licence = list(
      name = "no explicit licence; SPC/VNSO research-use acknowledgement",
      url = "https://www.spc.int/digitallibrary/get/aazaf",
      attribution = "Vanuatu National Statistics Office and the Pacific Community (SPC)"
    ),
    citation = "Vanuatu National Statistics Office (2011). 2009 National Population and Housing Census, Basic Tables Volume 1.",
    notes = "All 75 geography rows sum exactly to their stated totals. 2009 provinces include the urban municipalities (Port Vila in Shefa, Luganville in Sanma)."
  ),
  list(
    source_dataset_id = "vu-2020-province-incl-urban-derived",
    name = "2020 provinces including urban municipalities (derived)",
    provider = "Places of Worship project derivation",
    url = NA,
    retrieval_date = "2026-07-04",
    local_path = "apps/regions/vu/data/source/vu_religion_by_province_2020_incl_urban_DERIVED.csv",
    licence = list(
      name = "derived from VBoS/SPC census tables",
      url = NA,
      attribution = "Vanuatu Bureau of Statistics and the Pacific Community (SPC); derivation by the Places of Worship project"
    ),
    citation = "Derived: Shefa + Port Vila and Sanma + Luganville added so 2020 provinces match the 2009 provincial basis.",
    notes = "In the published 2020 table, province rows cover the rural population only. This derivation restores 2009-comparable provinces; shares reproduce the published Analytical Report Table 31 within 0.05 percentage points on 77 of 78 cells."
  )
)

# geoBoundaries provenance for each admin level; the same values the
# boundaries-only scaffold shipped before the loop-variable bug (see
# denom_lbl comment below) wiped them from the regenerated product.
# schema_version follows the "0.2.0" convention used by the other
# country builders (e.g. scripts/build_in_area_summary.R), superseding
# the scaffold-era "0.1.0"
GEOBOUNDARIES <- list(
  adm1 = list(
    boundary_set_id = "vu-adm1-geoboundaries",
    level = "province",
    source_dataset = list(
      source_dataset_id = "vu-adm1-geoboundaries",
      name = "geoBoundaries gbOpen VUT ADM1",
      provider = "geoBoundaries (William & Mary geoLab)",
      url = "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/VUT/ADM1/geoBoundaries-VUT-ADM1_simplified.geojson",
      retrieval_date = "2026-06-13T03:09:00Z",
      licence = list(
        name = "ODbL-1.0",
        url = "https://opendatacommons.org/licenses/odbl/1-0/",
        attribution = "geoBoundaries (William & Mary geoLab)"
      ),
      citation = "Runfola et al. (2020) geoBoundaries: A global database of political administrative boundaries.",
      notes = "Simplified release 9469f09 re-tagged to the project area schema."
    )
  ),
  adm2 = list(
    boundary_set_id = "vu-adm2-geoboundaries",
    level = "area_council",
    source_dataset = list(
      source_dataset_id = "vu-adm2-geoboundaries",
      name = "geoBoundaries gbOpen VUT ADM2",
      provider = "geoBoundaries (William & Mary geoLab)",
      url = "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/VUT/ADM2/geoBoundaries-VUT-ADM2_simplified.geojson",
      retrieval_date = "2026-06-13T03:09:00Z",
      licence = list(
        name = "CC-BY-3.0-IGO",
        url = "https://creativecommons.org/licenses/by/3.0/igo/",
        attribution = "geoBoundaries (William & Mary geoLab)"
      ),
      citation = "Runfola et al. (2020) geoBoundaries: A global database of political administrative boundaries.",
      notes = "Simplified release 9469f09 re-tagged to the project area schema."
    )
  )
)

build_level <- function(summary_path, level) {
  d <- fromJSON(summary_path, simplifyVector = TRUE, simplifyDataFrame = FALSE)
  # historical one-time purge: the committed scaffold once carried a stray
  # "1" key from the loop-variable bug fixed at d432479; regenerated files no
  # longer carry it, and this line only guards a stale checkout
  d[["1"]] <- NULL
  # scaffold rows -> data frame with the source-id list column preserved
  rows <- do.call(rbind, lapply(d$rows, function(r) {
    df <- data.frame(
      country_code = r[["country_code"]], boundary_set_id = r[["boundary_set_id"]],
      boundary_level = r[["boundary_level"]], area_unit_id = r[["area_unit_id"]],
      area_code = r[["area_code"]], area_name = r[["area_name"]], year = r[["year"]],
      population_total = ifelse(is.null(r[["population_total"]]), NA, r[["population_total"]]),
      population_total_basis = r[["population_total_basis"]],
      religious_affiliation_count = ifelse(is.null(r[["religious_affiliation_count"]]), NA, r[["religious_affiliation_count"]]),
      religious_affiliation_percent = ifelse(is.null(r[["religious_affiliation_percent"]]), NA, r[["religious_affiliation_percent"]]),
      no_religion_count = ifelse(is.null(r[["no_religion_count"]]), NA, r[["no_religion_count"]]),
      no_religion_percent = ifelse(is.null(r[["no_religion_percent"]]), NA, r[["no_religion_percent"]]),
      place_count = r[["place_count"]],
      places_per_10000_residents = ifelse(is.null(r[["places_per_10000_residents"]]), NA, r[["places_per_10000_residents"]]),
      place_density_per_sq_km = r[["place_density_per_sq_km"]],
      land_area_sq_km = r[["land_area_sq_km"]],
      site_snapshot_date = r[["site_snapshot_date"]],
      place_count_basis = r[["place_count_basis"]],
      quality_flag = r[["quality_flag"]],
      stringsAsFactors = FALSE
    )
    df$source_dataset_ids <- I(list(r[["source_dataset_ids"]]))
    df
  }))
  # denomination percent columns start empty and are filled per year by
  # fill_rows; pre-creating them at full length keeps the assignment safe.
  # loop variable must not be named `d`: this function's `d` is the
  # top-level area-summary list read above, and a for-loop variable
  # persists after the loop, so `for (d in DENOM_LABELS)` used to clobber
  # it with the last DENOM_LABELS value ("seventh_day_adventist"); every
  # later `d$field <- ...` then silently coerced that string into a list
  # (R's $<- coerces atomic LHS to a list, see ?"$<-"), losing the
  # parsed scaffold and surfacing the orphaned string as a top-level "1"
  # key when jsonlite serialised the unnamed first element
  for (denom_lbl in DENOM_LABELS) rows[[paste0(denom_lbl, "_percent")]] <- NA_real_

  if (level == "adm1") {
    # provinces gain earlier waves by cloning the 2009 rows as a blank
    # scaffold for the year, then filling from that year's extract. 1999 is
    # the main report table 2.10 (digitised by guy lavender forsyth); 1967 is
    # McArthur & Yaxley Table A, aggregated island->province by
    # scripts/build_vu_1967_provinces.py
    seed_year <- function(rows, year) {
      if (any(rows$year == year)) return(rows)
      seed <- rows[rows$year == 2009, ]
      seed$year <- year
      seed$population_total <- NA
      seed$population_total_basis <- "stated religious-affiliation response (pending)"
      seed$religious_affiliation_count <- NA
      seed$religious_affiliation_percent <- NA
      seed$no_religion_count <- NA
      seed$no_religion_percent <- NA
      seed$places_per_10000_residents <- NA
      for (d in DENOM_LABELS) seed[[paste0(d, "_percent")]] <- NA_real_
      # the clone carries 2009's census source id; a seeded year owns only the
      # boundary and OSM base until its own census fill adds the right id
      seed$source_dataset_ids <- I(lapply(seed$source_dataset_ids, function(ids)
        ids[!grepl("census|derived|mcarthur|t2-10|t3-5", ids)]))
      rows <- rbind(rows, seed)
      rows[order(rows$area_code, rows$year), ]
    }
    rows <- seed_year(rows, 1999)
    rows <- seed_year(rows, 1967)
    agg1967 <- aggregate_census(file.path(src_dir, "vu_religion_by_province_1967_mcarthur_tableA.csv"), "province")
    agg1999 <- aggregate_census(file.path(src_dir, "vu_religion_by_province_1999_mainreport_t2_10.csv"), "province")
    agg2009 <- aggregate_census(file.path(src_dir, "vu_religion_by_province_2009_basictables_t3_5.csv"), "province")
    agg2020 <- aggregate_census(file.path(src_dir, "vu_religion_by_province_2020_incl_urban_DERIVED.csv"), geo_col = "province")
    rows <- fill_rows(rows, agg1967, 1967, "religion_aged_15_plus_no_no_religion_category_1967",
                      "mcarthur-yaxley-1967-census-table-a", mode = "denominations_only",
                      pop_basis = "persons aged 15+ professing adherence to a religious group (McArthur & Yaxley 1967 first-census Table A; no no-religion category, so affiliation and no-religion shares are not defined)")
    rows <- fill_rows(rows, agg1999, 1999, "", "vnso-1999-census-main-report-t2-10")
    rows <- fill_rows(rows, agg2009, 2009, "", "vnso-2009-census-basic-tables-t3-5")
    rows <- fill_rows(rows, agg2020, 2020, "province_2020_includes_urban_derived",
                      c("vbos-2020-census-basic-tables-t3-5", "vu-2020-province-incl-urban-derived"))
  } else {
    agg2020 <- aggregate_census(file.path(src_dir, "vu_religion_by_region_2020_basictables_t3_5.csv"), c("area_council", "urban_municipality"))
    rows <- fill_rows(rows, agg2020, 2020, "", "vbos-2020-census-basic-tables-t3-5")
    # 2009 sub-provincial religion was published by island, not area
    # council; keep those rows pending with an accurate flag
    pending_2009 <- rows$year == 2009 & is.na(rows$population_total)
    rows$quality_flag[pending_2009] <- "current_place_counts_repeated_across_census_years;religion_published_by_island_not_area_council_2009"
  }

  filled <- sum(!is.na(rows$population_total))
  cat(sprintf("%s: %d of %d rows carry census religion data\n", level, filled, nrow(rows)))
  unmatched <- unique(rows$area_name[is.na(rows$population_total) & rows$year == 2020])
  if (length(unmatched) > 0) cat("  2020 rows without census match:", paste(unmatched, collapse = ", "), "\n")

  d$rows <- lapply(seq_len(nrow(rows)), function(i) {
    r <- as.list(rows[i, setdiff(names(rows), "source_dataset_ids")])
    r[["source_dataset_ids"]] <- rows$source_dataset_ids[[i]]
    for (k in names(r)) if (length(r[[k]]) == 1 && is.na(r[[k]])) r[[k]] <- NULL
    r
  })

  existing_ids <- vapply(d$source_datasets, function(s) s$source_dataset_id, "")
  for (s in census_source_datasets) {
    if (level == "adm2" && s$source_dataset_id %in% c("mcarthur-yaxley-1967-census-table-a", "vnso-1999-census-main-report-t2-10", "vnso-2009-census-basic-tables-t3-5", "vu-2020-province-incl-urban-derived")) next
    if (!(s$source_dataset_id %in% existing_ids)) d$source_datasets <- c(d$source_datasets, list(s))
  }

  d$indicators <- list(
    list(indicator_id = "population_total", label = "Religion-response denominator",
         description = "People in private households with a stated religious-affiliation response in the area and census year (census total minus refusals and not-stated).",
         unit = "count", denominator_indicator_id = NULL,
         method = "Total from Basic Tables Volume 1 Table 3.5 minus refuse-to-answer and not-stated.",
         temporal_coverage = if (level == "adm1") "1999, 2009, 2020" else "2020",
         spatial_coverage = if (level == "adm1") "Vanuatu provinces (2020 includes urban municipalities by derivation)" else "Vanuatu area councils and urban municipalities, geoBoundaries ADM2",
         quality_notes = "The published 2020 table is internally inconsistent by plus or minus 1-2 (consistent with cell perturbation); treat small differences as noise."),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
         description = "Share of the stated-response denominator affiliated with any religion, including customary beliefs.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "Stated denominator minus no-religion, over stated denominator.",
         temporal_coverage = if (level == "adm1") "1999, 2009, 2020" else "2020",
         spatial_coverage = if (level == "adm1") "Vanuatu provinces" else "Vanuatu area councils and urban municipalities",
         quality_notes = "Customary beliefs count as religious affiliation. Category boundaries changed between 2009 and 2020 (Latter Day Saints separated from Other; Not Stated added)."),
    list(indicator_id = "no_religion_percent", label = "No religion %",
         description = "Share of the stated-response denominator reporting no religion or faith.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "No-religion count over stated denominator.",
         temporal_coverage = if (level == "adm1") "1999, 2009, 2020" else "2020",
         spatial_coverage = if (level == "adm1") "Vanuatu provinces" else "Vanuatu area councils and urban municipalities",
         quality_notes = "2020 label is No Religion/Faith; 2009 label is No religion."),
    list(indicator_id = "place_count", label = "Places of worship",
         description = "OpenStreetMap amenity=place_of_worship points assigned to the area.",
         unit = "count", denominator_indicator_id = NULL,
         method = "Point-in-polygon assignment of the current OSM snapshot.",
         temporal_coverage = "current snapshot, repeated across census years",
         spatial_coverage = "Vanuatu",
         quality_notes = "Includes some nakamals as tagged in OSM; not a census-year measure."),
    list(indicator_id = "places_per_10000_residents", label = "Places per 10,000 residents",
         description = "Current place count per 10,000 stated-response residents in the census year.",
         unit = "rate", denominator_indicator_id = "population_total",
         method = "Place count over stated denominator, times 10,000.",
         temporal_coverage = if (level == "adm1") "1999, 2009, 2020" else "2020",
         spatial_coverage = "Vanuatu",
         quality_notes = "Numerator is the current OSM snapshot, not a census-year place count."),
    list(indicator_id = "place_density_per_sq_km", label = "Places per km²",
         description = "Current place count per square kilometre of geodesic land area.",
         unit = "rate", denominator_indicator_id = NULL,
         method = "Place count over geodesic land area from the boundary geometry.",
         temporal_coverage = "current snapshot",
         spatial_coverage = "Vanuatu",
         quality_notes = "Repeated across census years.")
  )

  # one indicator per tracked denomination. all five are present in every
  # province census wave, so they carry the fullest temporal coverage on the
  # map: 1967 (provinces only) through 2020
  denom_meta <- list(
    customary_beliefs_percent = list(label = "Customary beliefs %",
      description = "Share of the stated-response denominator reporting customary (kastom) beliefs.",
      notes = "The headline diversification signal: nationally 14.6% of adults in 1967, concentrated in Tafea (Tanna), falling across later censuses. Customary beliefs count as religious affiliation."),
    presbyterian_percent = list(label = "Presbyterian %",
      description = "Share of the stated-response denominator affiliated with the Presbyterian Church.",
      notes = "The largest denomination nationally; strongest in the central islands (Shefa, Malampa)."),
    anglican_percent = list(label = "Anglican %",
      description = "Share of the stated-response denominator affiliated with the Anglican Church (historically the Melanesian Mission).",
      notes = "Concentrated in the north (Torba/Banks and Penama)."),
    catholic_percent = list(label = "Catholic %",
      description = "Share of the stated-response denominator affiliated with the Roman Catholic Church.",
      notes = "Scattered across the archipelago; the 1967 label is Roman Catholic."),
    seventh_day_adventist_percent = list(label = "Seventh-day Adventist %",
      description = "Share of the stated-response denominator affiliated with the Seventh-day Adventist Church.",
      notes = "A minority denomination present in every census wave.")
  )
  # the 1967 caveats apply only at province level (adm1); the area-council
  # product (adm2) carries denomination shares for 2020 alone, so its method
  # and notes must not reference the aged-15+ 1967 basis
  denom_indicators <- lapply(names(denom_meta), function(id) {
    m <- denom_meta[[id]]
    list(indicator_id = id, label = m$label, description = m$description,
         unit = "percent", denominator_indicator_id = "population_total",
         method = if (level == "adm1")
           "Denomination count over the stated-response denominator (aged-15+ adherents for 1967)."
           else "Denomination count over the stated-response denominator.",
         temporal_coverage = if (level == "adm1") "1967, 1999, 2009, 2020" else "2020",
         spatial_coverage = if (level == "adm1") "Vanuatu provinces (1967 aggregated island->province)" else "Vanuatu area councils and urban municipalities",
         quality_notes = if (level == "adm1")
           paste(m$notes, "1967 uses persons aged 15+ (no no-religion category); later years use the whole stated-response population.")
           else m$notes)
  })
  d$indicators <- c(d$indicators, denom_indicators)

  d$data_status <- "census_religion_live"
  d$data_status_note <- if (level == "adm1") {
    "Census religious affiliation is live for provinces in 1999, 2009 and 2020 (1999 Main Report Table 2.10, digitised by Guy Lavender Forsyth; Basic Tables Volume 1 Table 3.5 for 2009 and 2020). Denomination shares, including customary beliefs, extend back to the 1967 first census (McArthur & Yaxley Table A, aggregated island->province); the 1967 wave covers persons aged 15+ with no no-religion category, so its affiliation and no-religion shares are left undefined. The 2020 provincial values include the urban municipalities by derivation so all years share one basis. National religion series back to 1989 sits in apps/regions/vu/data/source/."
  } else {
    "Census religious affiliation and denomination shares are live for area councils and urban municipalities in 2020. 2009 sub-provincial religion was published by island, not area council, so 2009 stays pending at this level. The Torres area council is absent from the geoBoundaries ADM2 layer, so its 2020 counts are not mapped at this level."
  }
  d$generated_at <- stamp
  d$generated_by <- "scripts/build_vu_area_summary.R"
  # every product states its place-layer position; vanuatu ships no governed
  # place snapshot in this release (the schema admits the null id)
  d$site_snapshot <- list(
    source_dataset_id = NA,
    snapshot_date = NA,
    basis = "no governed Vanuatu place-of-worship snapshot is included in this country data-map release",
    notes = "place_count and its derived metrics are null; the map’s place dots come from the shared global OpenStreetMap tiles, and the dated-places product is pending."
  )

  # required top-level fields set explicitly rather than left to scaffold
  # passthrough (passthrough is what let the loop-variable bug silently
  # drop them on a prior regeneration); values match sibling products
  # (schemas/area-summary.schema.json, e.g. apps/regions/bs/data/area_summary_island.json)
  geo <- GEOBOUNDARIES[[level]]
  d$schema_version <- "0.2.0"
  d$country_code <- "VU"
  d$boundary_set <- list(
    boundary_set_id = geo$boundary_set_id,
    country_code = "VU",
    level = geo$level,
    vintage = "geoBoundaries gbOpen",
    source_dataset_id = geo$boundary_set_id
  )
  if (is.null(d$visual_layers)) d$visual_layers <- list()
  existing_ids <- vapply(d$source_datasets, function(s) s$source_dataset_id, "")
  if (!(geo$source_dataset$source_dataset_id %in% existing_ids)) {
    d$source_datasets <- c(list(geo$source_dataset), d$source_datasets)
  }

  write_json(d, summary_path, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)

  csv_path <- sub("\\.json$", ".csv", summary_path)
  flat <- rows
  flat$source_dataset_ids <- vapply(rows$source_dataset_ids, function(x) paste(x, collapse = "|"), "")
  write.csv(flat, csv_path, row.names = FALSE, na = "")
  invisible(d)
}

build_level(file.path(vu_dir, "area_summary_adm1.json"), "adm1")
build_level(file.path(vu_dir, "area_summary_adm2.json"), "adm2")
cat("done\n")
