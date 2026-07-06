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
src_dir <- file.path(vu_dir, "source")
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")

# affiliation = stated denominator minus no-religion; refusals and
# not-stated leave the denominator entirely (matches the nz product)

# read one extracted census csv into per-geography religion aggregates.
# returns geography, denominator (stated responses), affiliated count,
# no-religion count
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
    data.frame(
      geography = g$geography[1],
      population_total = stated,
      religious_affiliation_count = stated - no_rel,
      no_religion_count = no_rel,
      stringsAsFactors = FALSE
    )
  }))
  rownames(out) <- NULL
  out
}

# fill religion fields on scaffold rows for one census year from an
# aggregate table keyed by lowercase geography name
fill_rows <- function(rows, agg, year, extra_flag, source_ids_added) {
  key <- tolower(trimws(agg$geography))
  for (i in seq_len(nrow(rows))) {
    if (rows$year[i] != year) next
    j <- match(tolower(trimws(rows$area_name[i])), key)
    if (is.na(j)) next
    pop <- agg$population_total[j]
    aff <- agg$religious_affiliation_count[j]
    no_rel <- agg$no_religion_count[j]
    rows$population_total[i] <- pop
    rows$population_total_basis[i] <- "total people with a stated religious-affiliation response (census total in private households minus refusals and not-stated)"
    rows$religious_affiliation_count[i] <- aff
    rows$religious_affiliation_percent[i] <- round(100 * aff / pop, 2)
    rows$no_religion_count[i] <- no_rel
    rows$no_religion_percent[i] <- round(100 * no_rel / pop, 2)
    rows$places_per_10000_residents[i] <- round(10000 * rows$place_count[i] / pop, 2)
    flags <- c("current_place_counts_repeated_across_census_years", extra_flag)
    rows$quality_flag[i] <- paste(flags[nzchar(flags)], collapse = ";")
    rows$source_dataset_ids[[i]] <- unique(c(rows$source_dataset_ids[[i]], source_ids_added))
  }
  rows
}

census_source_datasets <- list(
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

build_level <- function(summary_path, level) {
  d <- fromJSON(summary_path, simplifyVector = TRUE, simplifyDataFrame = FALSE)
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

  if (level == "adm1") {
    # provinces gain 1999 (main report table 2.10, digitised by guy lavender
    # forsyth): clone the 2009 rows as the 1999 scaffold, then fill all years
    if (!any(rows$year == 1999)) {
      seed <- rows[rows$year == 2009, ]
      seed$year <- 1999
      seed$population_total <- NA
      seed$population_total_basis <- "stated religious-affiliation response (pending)"
      seed$religious_affiliation_count <- NA
      seed$religious_affiliation_percent <- NA
      seed$no_religion_count <- NA
      seed$no_religion_percent <- NA
      seed$places_per_10000_residents <- NA
      rows <- rbind(rows, seed)
      rows <- rows[order(rows$area_code, rows$year), ]
    }
    agg1999 <- aggregate_census(file.path(src_dir, "vu_religion_by_province_1999_mainreport_t2_10.csv"), "province")
    agg2009 <- aggregate_census(file.path(src_dir, "vu_religion_by_province_2009_basictables_t3_5.csv"), "province")
    agg2020 <- aggregate_census(file.path(src_dir, "vu_religion_by_province_2020_incl_urban_DERIVED.csv"), geo_col = "province")
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
    if (level == "adm2" && s$source_dataset_id %in% c("vnso-1999-census-main-report-t2-10", "vnso-2009-census-basic-tables-t3-5", "vu-2020-province-incl-urban-derived")) next
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

  d$data_status <- "census_religion_live"
  d$data_status_note <- if (level == "adm1") {
    "Census religious affiliation is live for provinces in 1999, 2009 and 2020 (1999 Main Report Table 2.10, digitised by Guy Lavender Forsyth; Basic Tables Volume 1 Table 3.5 for 2009 and 2020). The 2020 provincial values include the urban municipalities by derivation so all years share one basis. National religion series back to 1989 sits in apps/regions/vu/data/source/."
  } else {
    "Census religious affiliation is live for area councils and urban municipalities in 2020. 2009 sub-provincial religion was published by island, not area council, so 2009 stays pending at this level. The Torres area council is absent from the geoBoundaries ADM2 layer, so its 2020 counts are not mapped at this level."
  }
  d$generated_at <- stamp
  d$generated_by <- "scripts/build_vu_area_summary.R"

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
