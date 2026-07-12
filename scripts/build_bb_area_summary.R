# build the Barbados parish census-religion area-summary product for a single wave
# (2010) on the eleven-unit geoBoundaries BRB ADM1 parish frame. inputs (all cached,
# git-ignored, sha256 in research/countries/bb/route-probe.md):
#   data/raw/bb_census/bb_2010_PHC_Vol1.pdf -> Table 02.06 "Total Population by
#     Parish, Sex and Religion" (integer full-count, 23 categories, 11 parishes,
#     Both Sexes rows used)
#   data/raw/bb_census/geoBoundaries-BRB-ADM1.geojson -> 11-parish ADM1 boundary
#   data/raw/bb_census/gb_brb_adm1_meta.json -> boundary licence metadata (CC BY 2.5)
# every religion cell is transcribed verbatim from Table 02.06 (Both Sexes) and
# reconciled against the printed control totals here; the build stops on any margin
# mismatch and never allocates, infers, rounds, imputes, or tunes a value. the 2010
# table is an integer full-count of the Tabulable Population (226,193), distinct from
# the Estimated Resident Population (277,821); the gap is the census undercount and is
# not part of the religion denominator.
# outputs: apps/regions/bb/data/bb_parish_2005.geojson,
#   apps/regions/bb/data/area_summary_parish.{json,csv}, and
#   docs/manifests/bb-census-religion-2010.json.
# run from the repo root: Rscript scripts/build_bb_area_summary.R
# STAGED product: no page, no hub link. licence ACCEPTED (BSS Open Licence Agreement,
# free reuse with attribution); boundary CC BY 2.5 Generic. single-wave parish product
# (religion is cross-tabbed by parish only in 2010; the page/single-wave-subnational
# decision is the conductor's, parallel to the Antigua task-8 question).

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "BB"
script_id <- "scripts/build_bb_area_summary.R"
raw_dir <- "data/raw/bb_census"
product_dir <- "apps/regions/bb/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-12"
stamp <- paste0(retrieval_date, "T00:00:00Z")
git_commit <- trimws(system2("git", c("rev-parse", "HEAD"), stdout = TRUE))
if (length(git_commit) != 1L || !grepl("^[a-f0-9]{40}$", git_commit)) git_commit <- NULL

# geoBoundaries boundaryYearRepresented is 2005 for BRB ADM1.
boundary_level <- "parish"
boundary_vintage <- "2005"
boundary_set_id <- "bb-parish-2005-geoboundaries-adm1"

d2010 <- "bb-census-2010-vol1-table-02-06-religion-by-parish"
d_boundary <- "geoboundaries-brb-adm1-2005"

# ---- source urls and cached paths ----------------------------------------------
url_2010 <- "https://stats.gov.bb/wp-content/uploads/2020/03/2010-PHC-Report-Vol-1.pdf"
url_2000 <- "https://stats.gov.bb/wp-content/uploads/2020/05/Barbados-2000-Census-Report.pdf"
url_2021 <- "https://stats.gov.bb/wp-content/uploads/2024/02/2021-Population-and-Housing-Census.pdf"
url_ola <- "https://stats.gov.bb/open-licence-agreement/"
url_terms <- "https://stats.gov.bb/terms-and-conditions/"
bss_home_url <- "https://stats.gov.bb"
boundary_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/BRB/ADM1/geoBoundaries-BRB-ADM1.geojson"
boundary_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/BRB/ADM1/"

path_2010 <- file.path(raw_dir, "bb_2010_PHC_Vol1.pdf")
path_2000 <- file.path(raw_dir, "bb_2000_Census_Report.pdf")
path_2021 <- file.path(raw_dir, "bb_2021_PHC.pdf")
path_ola <- file.path(raw_dir, "bss_open_licence_agreement.html")
path_terms <- file.path(raw_dir, "bss_terms.html")
boundary_path <- file.path(raw_dir, "geoBoundaries-BRB-ADM1.geojson")
boundary_meta_path <- file.path(raw_dir, "gb_brb_adm1_meta.json")

boundary_out <- file.path(product_dir, "bb_parish_2005.geojson")
summary_json_out <- file.path(product_dir, "area_summary_parish.json")
summary_csv_out <- file.path(product_dir, "area_summary_parish.csv")
manifest_out <- file.path(manifest_dir, "bb-census-religion-2010.json")

# ---- canonical parish frame ----------------------------------------------------
# eleven canonical parish display names, Table 02.06 source order. the census prints
# "St. X"; geoBoundaries prints "Saint X" and "Christ Church" identically, so a
# deterministic St.->Saint crosswalk joins the two one-to-one (no fuzzy matching).
parishes <- c("St. Michael", "Christ Church", "St. George", "St. Philip", "St. John",
              "St. James", "St. Thomas", "St. Joseph", "St. Andrew", "St. Peter", "St. Lucy")
parish_slug <- c(`St. Michael` = "st_michael", `Christ Church` = "christ_church",
                 `St. George` = "st_george", `St. Philip` = "st_philip",
                 `St. John` = "st_john", `St. James` = "st_james",
                 `St. Thomas` = "st_thomas", `St. Joseph` = "st_joseph",
                 `St. Andrew` = "st_andrew", `St. Peter` = "st_peter", `St. Lucy` = "st_lucy")
# census parish name -> geoBoundaries shapeName.
parish_boundary_name <- c(`St. Michael` = "Saint Michael", `Christ Church` = "Christ Church",
                          `St. George` = "Saint George", `St. Philip` = "Saint Philip",
                          `St. John` = "Saint John", `St. James` = "Saint James",
                          `St. Thomas` = "Saint Thomas", `St. Joseph` = "Saint Joseph",
                          `St. Andrew` = "Saint Andrew", `St. Peter` = "Saint Peter",
                          `St. Lucy` = "Saint Lucy")

# ---- 2010 Table 02.06 (integer full-count; 23-category frame) -------------------
# verbatim source category order (Table 02.06). None = no-religion line, Not Stated =
# non-response line. "-" in the printed table is transcribed as 0. no cell suppression.
cat_2010 <- c("Adventist", "Anglican", "Baptist", "Brethren", "Church of God",
              "Jehovah Witness", "Methodist", "Moravian", "Mormon", "Nazarene",
              "Pentecostal", "Roman Catholic", "Salvation Army", "Wesleyan",
              "Other Christian", "Baha'i", "Hindu", "Jewish", "Muslim", "Rastafarian",
              "Other Non-Christian", "None", "Not Stated")

# per-parish Both Sexes counts in cat_2010 order (verbatim from Table 02.06).
parish_counts <- list(
  `St. Michael`   = c(3947,13783,1435,275,1008,1157,3726,745,83,1940,13170,3474,183,1987,2600,25,404,33,1125,965,276,16421,842),
  `Christ Church` = c(2053,10606,1021,284,702,684,2415,300,100,1109,9160,2420,113,1244,1659,33,221,25,168,323,101,8002,384),
  `St. George`    = c(1242,5090,153,165,477,364,403,198,8,926,2914,504,3,729,476,4,93,6,27,205,37,4018,161),
  `St. Philip`    = c(1218,7107,638,37,494,762,1158,109,24,1148,4086,405,148,918,898,7,91,4,33,163,47,3878,415),
  `St. John`      = c(431,3232,43,23,66,155,60,374,1,147,1176,144,3,556,131,2,29,0,14,125,24,1789,92),
  `St. James`     = c(1027,5344,203,133,893,538,1004,175,9,885,4276,1067,116,434,700,16,83,20,166,207,75,3559,328),
  `St. Thomas`    = c(695,2212,81,75,530,347,176,685,1,503,2841,271,8,412,438,1,65,13,31,89,23,2404,134),
  `St. Joseph`    = c(483,1617,91,67,72,102,33,72,1,109,948,75,0,430,160,1,20,0,4,79,7,1529,39),
  `St. Andrew`    = c(345,706,99,4,277,55,10,7,0,160,1360,22,12,261,137,0,1,1,5,94,5,1013,57),
  `St. Peter`     = c(842,2781,236,7,584,192,273,19,5,215,2299,226,96,191,161,5,19,1,23,42,23,2012,130),
  `St. Lucy`      = c(1154,1491,82,5,253,159,203,8,3,158,1863,71,197,539,207,4,29,0,9,40,6,1934,194)
)

# printed control totals (Table 02.06 Barbados row and per-parish Total column).
total_2010_parish <- c(`St. Michael` = 69604L, `Christ Church` = 43127L, `St. George` = 18203L,
                       `St. Philip` = 23788L, `St. John` = 8617L, `St. James` = 21258L,
                       `St. Thomas` = 12035L, `St. Joseph` = 5939L, `St. Andrew` = 4631L,
                       `St. Peter` = 10382L, `St. Lucy` = 8609L)
total_2010_cat <- setNames(
  c(13437L,53969L,4082L,1075L,5356L,4515L,9461L,2692L,235L,7300L,44093L,8679L,879L,
    7701L,7567L,98L,1055L,103L,1605L,2332L,624L,46559L,2776L), cat_2010)
national_2010 <- 226193L
no_rel_2010 <- "None"
nonresp_2010 <- "Not Stated"

# assemble the per-category matrix (category -> named parish vector) from the per-
# parish rows, so the transcription lives in one place and is reconciled below.
m2010 <- setNames(lapply(seq_along(cat_2010), function(i) {
  setNames(as.integer(vapply(parishes, function(p) parish_counts[[p]][[i]], numeric(1))), parishes)
}), cat_2010)

# ---- reconciliation gate (fail-fast; stop, do not tune) -------------------------
# integer full-count wave: every parish column, every religion row, and both national
# margins must close exactly. any nonzero deviation stops the build.
reconcile_wave <- function(mat, cats, parish_totals, cat_totals, national, year) {
  records <- list()
  for (s in parishes) {
    col_sum <- sum(vapply(cats, function(c) mat[[c]][[s]], numeric(1)))
    if (col_sum != parish_totals[[s]]) {
      stop(sprintf("%d parish gate FAILED for %s: categories sum %d != printed total %d",
                   year, s, as.integer(col_sum), parish_totals[[s]]), call. = FALSE)
    }
    records[[length(records) + 1L]] <- data.frame(
      year = year, margin = "parish_column", key = s,
      computed = as.integer(col_sum), printed = as.integer(parish_totals[[s]]),
      difference = as.integer(col_sum - parish_totals[[s]]), stringsAsFactors = FALSE)
  }
  for (c in cats) {
    row_sum <- sum(mat[[c]])
    if (row_sum != cat_totals[[c]]) {
      stop(sprintf("%d religion-row gate FAILED for %s: eleven-parish sum %d != printed %d",
                   year, c, as.integer(row_sum), cat_totals[[c]]), call. = FALSE)
    }
    records[[length(records) + 1L]] <- data.frame(
      year = year, margin = "religion_row", key = c,
      computed = as.integer(row_sum), printed = as.integer(cat_totals[[c]]),
      difference = as.integer(row_sum - cat_totals[[c]]), stringsAsFactors = FALSE)
  }
  if (sum(parish_totals) != national) {
    stop(sprintf("%d grand gate FAILED: parish-total sum %d != printed national %d",
                 year, as.integer(sum(parish_totals)), national), call. = FALSE)
  }
  if (sum(cat_totals) != national) {
    stop(sprintf("%d category-total gate FAILED: category-total sum %d != printed national %d",
                 year, as.integer(sum(cat_totals)), national), call. = FALSE)
  }
  do.call(rbind, records)
}

rec_2010 <- reconcile_wave(m2010, cat_2010, total_2010_parish, total_2010_cat, national_2010, 2010L)
message(sprintf("gate 2010: PASSED (integer-exact; both margins close to %d)", national_2010))

# ---- boundary ------------------------------------------------------------------
sha256_file <- function(path) unname(tools::sha256sum(path))
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))
require_file <- function(path) {
  if (!file.exists(path) || file_bytes(path) == 0L) stop("missing required source: ", path, call. = FALSE)
}
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$", path)) return(length(fromJSON(path, simplifyVector = FALSE)[["features"]]))
  if (grepl("\\.json$", path)) return(length(fromJSON(path, simplifyVector = FALSE)[["rows"]]))
  NA_integer_
}
geometry_hashes <- function(layer) {
  vapply(seq_len(nrow(layer)), function(i) {
    digest(st_as_binary(st_geometry(layer)[i], EWKB = TRUE)[[1L]], algo = "sha256", serialize = FALSE)
  }, character(1))
}

required_inputs <- c(path_2010, boundary_path, boundary_meta_path)
invisible(lapply(required_inputs, require_file))

# confirm the pinned boundary licence, unit count, and type before use.
boundary_metadata <- fromJSON(boundary_meta_path, simplifyVector = FALSE)
if (!identical(boundary_metadata[["boundaryLicense"]], "Creative Commons Attribution 2.5 Generic") ||
    !identical(boundary_metadata[["admUnitCount"]], "11") ||
    !identical(boundary_metadata[["boundaryType"]], "ADM1")) {
  stop("geoBoundaries BRB ADM1 licence, unit count, or type metadata changed", call. = FALSE)
}
boundary_licence <- boundary_metadata[["boundaryLicense"]]

# Barbados-centred equal-area projection for land areas (compact, far from antimeridian).
bb_laea <- "+proj=laea +lat_0=13.17 +lon_0=-59.55 +datum=WGS84 +units=m +no_defs"

# join the eleven census parishes one-to-one to the geoBoundaries ADM1 features via
# the St.->Saint crosswalk.
build_boundary <- function(path) {
  boundary <- st_make_valid(st_read(path, quiet = TRUE, stringsAsFactors = FALSE))
  if (nrow(boundary) != 11L) stop("geoBoundaries BRB ADM1 feature count is not 11", call. = FALSE)
  target_names <- unname(parish_boundary_name[parishes])
  idx <- match(target_names, boundary[["shapeName"]])
  if (anyNA(idx) || anyDuplicated(idx) || !setequal(idx, seq_len(11L))) {
    stop("census parishes and geoBoundaries features do not join one-to-one", call. = FALSE)
  }
  boundary <- boundary[idx, ]
  boundary[["area_name"]] <- parishes
  boundary[["boundary_source_name"]] <- boundary[["shapeName"]]
  boundary[["area_code"]] <- unname(parish_slug[parishes])
  boundary[["area_unit_id"]] <- paste(boundary_set_id, unname(parish_slug[parishes]), sep = ":")
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- boundary_level
  boundary[["boundary_vintage"]] <- boundary_vintage
  boundary[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(boundary, bb_laea))) / 1e6
  boundary <- st_transform(st_make_valid(boundary), 4326)
  boundary[c("area_code", "area_name", "boundary_source_name", "area_unit_id",
             "boundary_set_id", "boundary_level", "boundary_vintage",
             "land_area_sq_km", "geometry")]
}

boundary <- build_boundary(boundary_path)

# full-extent gate: Barbados spans lon -59.65 to -59.42 E and lat 13.04 to 13.34 N.
bbox <- st_bbox(boundary)
if (bbox[["xmin"]] < -59.75 || bbox[["xmin"]] > -59.55 ||
    bbox[["xmax"]] < -59.50 || bbox[["xmax"]] > -59.30 ||
    bbox[["ymin"]] < 12.95 || bbox[["ymin"]] > 13.15 ||
    bbox[["ymax"]] < 13.25 || bbox[["ymax"]] > 13.45) {
  stop("boundary bbox does not match the expected Barbados extent", call. = FALSE)
}

simplification <- mapshaper_simplify_to_cap(
  boundary, boundary_out,
  max_bytes = 900000L,
  keep_percentages = c(100, 75, 50, 30, 20, 10, 5),
  clean_option = "allow-overlaps"
)
written <- st_read(boundary_out, quiet = TRUE, stringsAsFactors = FALSE)
written <- written[match(boundary[["area_code"]], written[["area_code"]]), ]
if (anyNA(written[["area_code"]])) stop("simplified boundary lost an area code", call. = FALSE)
if (nrow(written) != 11L) stop("simplified boundary does not contain 11 features", call. = FALSE)
w_valid <- st_is_valid(written)
if (any(st_is_empty(written)) || any(is.na(w_valid)) || any(!w_valid)) {
  stop("simplified boundary has empty or invalid geometries", call. = FALSE)
}
geom_hashes <- geometry_hashes(written)
if (length(unique(geom_hashes)) != 11L) stop("simplified boundary geometry hashes are not distinct", call. = FALSE)
message(sprintf("boundary: PASSED (11 valid distinct features, %d bytes at %g%% keep)",
                file_bytes(boundary_out), simplification[["keep_percent"]]))

land_area <- setNames(round(written[["land_area_sq_km"]], 4), written[["area_name"]])
area_unit <- setNames(written[["area_unit_id"]], written[["area_name"]])
area_code <- setNames(written[["area_code"]], written[["area_name"]])

# ---- product rows --------------------------------------------------------------
# slot design (ordinary two-slot, SB/FM/KI precedent): religious_affiliation is the
# parish population minus the None line and the Not Stated line; no_religion is the
# single None line. Not Stated stays in the denominator and in neither slot, so the
# two shares need not sum to 100. Barbados has a real None category, so no minority-
# share (task-6) treatment applies. counts are integer full-counts.

flag_common <- paste(
  "census_affiliation", "all_persons_universe", "single_select_reported_denomination",
  "religious_affiliation_percent_is_named_religion_share",
  "no_religion_percent_is_none_line_only",
  "not_stated_residual_in_denominator_neither_slot",
  "shares_need_not_sum_to_100",
  "single_wave_2010_parish_product",
  "denominator_is_tabulable_population_226193_not_estimated_resident_277821",
  "licence_accepted_bss_open_licence_agreement",
  "boundary_cc_by_2_5_generic",
  sep = ";")
flag_2010 <- paste(
  "frame_2010_twenty_three_category_integer_full_count",
  "none_line=None", "nonresponse_line=Not Stated",
  "printed_dash_transcribed_as_zero",
  flag_common, sep = ";")

basis_2010 <- paste(
  "2010 Population and Housing Census, Volume 1, Table 02.06 'Total Population by",
  "Parish, Sex and Religion' (Both Sexes), integer full-count. The denominator is the",
  "printed parish Total (Tabulable Population). Religious affiliation is the parish",
  "population minus the None and Not Stated lines.")

# build one schema-shaped area-summary row, carrying the verbatim per-parish category
# breakdown on the quality flag (source_categories_verbatim pattern).
make_row <- function(s, year, mat, cats, parish_total, no_rel_label, nonresp_label,
                     flag, basis, dataset_id) {
  pop <- parish_total[[s]]
  no_rel <- mat[[no_rel_label]][[s]]
  nonresp <- mat[[nonresp_label]][[s]]
  affiliation <- pop - no_rel - nonresp
  aff_pct <- round(100 * affiliation / pop, 4)
  no_pct <- round(100 * no_rel / pop, 4)
  breakdown <- paste(vapply(cats, function(c) paste0(c, "=", as.integer(mat[[c]][[s]])), character(1)),
                     collapse = ";")
  full_flag <- paste0(flag, ";source_categories_verbatim=", breakdown)
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = unname(area_unit[[s]]),
    area_code = unname(area_code[[s]]),
    area_name = s,
    year = as.integer(year),
    population_total = as.integer(pop),
    population_total_basis = basis,
    religious_affiliation_count = as.integer(affiliation),
    religious_affiliation_percent = aff_pct,
    no_religion_count = as.integer(no_rel),
    no_religion_percent = no_pct,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = unname(land_area[[s]]),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(dataset_id, d_boundary),
    quality_flag = full_flag
  )
}

rows <- list()
for (s in parishes) {
  rows[[length(rows) + 1L]] <- make_row(s, 2010L, m2010, cat_2010, total_2010_parish,
                                        no_rel_2010, nonresp_2010, flag_2010, basis_2010, d2010)
}

# ---- area-summary document -----------------------------------------------------

licence_accepted_text <- paste(
  "The Barbados Statistical Service (BSS) publishes an Open Licence Agreement",
  "(stats.gov.bb/open-licence-agreement/) that governs use of BSS data. It grants",
  "'a worldwide, royalty-free non-exclusive licence to freely use the data, copy,",
  "modify, translate, publish, adapt, distribute, create derivative works and",
  "value-added products for commercial and non-commercial purposes', conditioned on",
  "the acknowledgement-of-source notice. The required value-added-product notice is:",
  "'This product was adapted from the Barbados Statistical Service's information,",
  "which is licensed under the Barbados Statistical Service's Open Licence Agreement.'",
  "The BSS Terms and Conditions confirm data use is subject to the Open Licence",
  "Agreement. Licence status: accepted. The boundary is Creative Commons Attribution",
  "2.5 Generic.")

bss_attribution <- paste(
  "This product was adapted from the Barbados Statistical Service's information, which",
  "is licensed under the Barbados Statistical Service's Open Licence Agreement.")

source_datasets <- function() {
  list(
    list(
      source_dataset_id = d2010,
      name = "Barbados 2010 Population and Housing Census, Volume 1, Table 02.06: Total Population by Parish, Sex and Religion",
      provider = "Barbados Statistical Service (BSS)",
      url = url_2010, retrieval_date = retrieval_date, local_path = path_2010,
      licence = list(name = licence_accepted_text, url = url_ola, attribution = bss_attribution),
      citation = "Barbados Statistical Service, 2010 Population and Housing Census, Volume 1, Table 02.06.",
      access_limits = NULL,
      redistribution_limits = "Derived parish summaries ship under the BSS Open Licence Agreement (free reuse with the acknowledgement-of-source notice). Raw census PDFs are not committed.",
      notes = paste("Integer full-count; 23-category frame; Both Sexes rows. Both margins close exactly: every parish",
                    "column and every religion row sum to the printed national total of 226,193. No cell suppression.",
                    "Printed '-' transcribed as 0. The denominator is the Tabulable Population (226,193); the Estimated",
                    "Resident Population (277,821) is a separate adjusted figure and is not the religion denominator.")),
    list(
      source_dataset_id = d_boundary,
      name = "geoBoundaries BRB ADM1 (11 parishes)",
      provider = "geoBoundaries (William & Mary geoLab); boundary source Wikimedia Commons",
      url = boundary_url, retrieval_date = retrieval_date, local_path = boundary_path,
      licence = list(name = boundary_licence, url = boundary_meta_url,
                     attribution = "geoBoundaries (gbOpen); boundary source Wikimedia Commons"),
      citation = "geoBoundaries BRB ADM1 (gbOpen, pinned 9469f09), 11 parish boundaries.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary is committed under Creative Commons Attribution 2.5 Generic (attribution to geoBoundaries / Wikimedia Commons).",
      notes = paste("11 ADM1 parishes, boundaryYearRepresented 2005, joined one-to-one to the census parishes via a",
                    "St.->Saint name crosswalk. The extent spans lon -59.65 to -59.42E and lat 13.04 to 13.34N, far",
                    "from the antimeridian; no dateline handling is needed."))
  )
}

indicators <- function() {
  denom_note <- paste(
    "Percentages use each parish's Tabulable Population Total. The Not Stated line stays",
    "in the denominator and outside both headline numerators, so the two shares need not",
    "sum to 100%.")
  list(
    list(indicator_id = "population_total", label = "Census population total",
         description = "Parish all-persons Tabulable Population represented in the 2010 religion table.",
         unit = "count", denominator_indicator_id = NULL,
         method = "Printed parish Total from 2010 Census Volume 1 Table 02.06 (Both Sexes).",
         temporal_coverage = "2010", spatial_coverage = "Barbados parishes (11)",
         quality_notes = "Religion is asked of the whole resident population (no age restriction). The denominator is the Tabulable Population (national 226,193), distinct from the Estimated Resident Population (277,821); the difference is the census undercount and is not part of the religion denominator."),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
         description = "Share of the parish population reporting affiliation with a named religion or denomination.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (population - None - Not Stated) / population.",
         temporal_coverage = "2010", spatial_coverage = "Barbados parishes (11)",
         quality_notes = paste("Single wave (2010): religion is cross-tabulated by parish only in the 2010 census; 1990 and 2000 religion are published nationally only (2000 Report Table 2.7), and 2021 collected religion (questionnaire P11) but published no religion table.", denom_note)),
    list(indicator_id = "no_religion_percent", label = "No religious affiliation %",
         description = "Share of the parish population in the census None line.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * None / population. The Not Stated line is not part of this slot.",
         temporal_coverage = "2010", spatial_coverage = "Barbados parishes (11)",
         quality_notes = paste("The national no-religion share was 20.6% in 2010 (46,559 / 226,193); the construct is the share reporting None, read within each parish's own denominator.", denom_note))
  )
}

visual_layers <- function() {
  list(
    list(visual_layer_id = "bb-parish-religious-affiliation", label = "Religious affiliation %",
         description = "Barbados census-affiliation share by parish (2010).", layer_type = "choropleth",
         indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "parish Tabulable Population, including a Not Stated residual"),
         colour_scale = "sequential", time_control = "none",
         aggregation_rule = "reported parish value", uncertainty_display = "quality_flag",
         default_visibility = TRUE,
         notes = "Census affiliation, not practice, attendance, or membership. Single wave (2010)."),
    list(visual_layer_id = "bb-parish-no-religion", label = "No religious affiliation %",
         description = "Barbados census no-religion share by parish (2010).", layer_type = "choropleth",
         indicator_ids = list("no_religion_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "parish Tabulable Population"),
         colour_scale = "sequential", time_control = "none",
         aggregation_rule = "reported parish value", uncertainty_display = "quality_flag",
         default_visibility = FALSE,
         notes = "The source category is None. The Not Stated line is excluded from this slot.")
  )
}

summary_product <- list(
  schema_version = "area-summary.v1", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code,
                      level = boundary_level, vintage = boundary_vintage, source_dataset_id = d_boundary),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "No governed place-of-worship snapshot ships in the Barbados census product.",
                       notes = "Place counts and density metrics remain null."),
  source_datasets = source_datasets(), indicators = indicators(),
  visual_layers = visual_layers(), rows = rows
)

write_json(summary_product, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(summary_json_out, warn = FALSE), collapse = "\n"))) {
  stop("area-summary JSON is invalid", call. = FALSE)
}

# flatten rows to the CSV companion.
flatten_rows <- function(rows) {
  do.call(rbind, lapply(rows, function(r) {
    data.frame(
      country_code = r[["country_code"]], boundary_set_id = r[["boundary_set_id"]],
      boundary_level = r[["boundary_level"]], area_unit_id = r[["area_unit_id"]],
      area_code = r[["area_code"]], area_name = r[["area_name"]], year = r[["year"]],
      population_total = r[["population_total"]], population_total_basis = r[["population_total_basis"]],
      religious_affiliation_count = if (is.null(r[["religious_affiliation_count"]])) NA_integer_ else r[["religious_affiliation_count"]],
      religious_affiliation_percent = if (is.null(r[["religious_affiliation_percent"]])) NA_real_ else r[["religious_affiliation_percent"]],
      no_religion_count = if (is.null(r[["no_religion_count"]])) NA_integer_ else r[["no_religion_count"]],
      no_religion_percent = if (is.null(r[["no_religion_percent"]])) NA_real_ else r[["no_religion_percent"]],
      place_count = NA_integer_, places_per_10000_residents = NA_real_,
      place_density_per_sq_km = NA_real_, land_area_sq_km = r[["land_area_sq_km"]],
      site_snapshot_date = NA_character_, place_count_basis = NA_character_,
      source_dataset_ids = paste(unlist(r[["source_dataset_ids"]]), collapse = "|"),
      quality_flag = r[["quality_flag"]], stringsAsFactors = FALSE
    )
  }))
}
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

# ---- manifest ------------------------------------------------------------------

raw_source_record <- function(path, url, format, used, periods, dataset_id, notes) {
  list(uri = path, url = url, format = format, bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = NULL, source_dataset_id = dataset_id, used_in_public_product = used,
       periods = periods, notes = notes,
       local_cache_hint = paste0(path, " (git-ignored by .gitignore data/ rule)"),
       raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/bb_census/"))
}

durable_file_record <- function(path, content, licence_status_value, licence_basis_value) {
  list(uri = paste0("repo:", path), storage_provider = "git_repository", format = sub("^.*\\.", "", path),
       bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = if (grepl("area_summary|\\.csv$", path)) row_count_file(path) else NULL,
       feature_count = if (grepl("\\.geojson$", path)) row_count_file(path) else NULL,
       content = content, privacy = "public",
       licence_status = licence_status_value, licence_basis = licence_basis_value)
}

licence_basis_slug <- "bss_open_licence_agreement"

raw_sources <- list(
  raw_source_record(path_2010, url_2010, "pdf", TRUE, "2010", d2010,
    "2010 Census Volume 1; Table 02.06 Religion by parish (integer full-count, Both Sexes). Both margins close to 226,193."),
  raw_source_record(path_2000, url_2000, "pdf", FALSE, "1990;2000", "bb-census-2000-report-table-2-7-national-religion",
    "2000 National Census Report (CARICOM Secretariat); Table 2.7 national religion for 1990 and 2000. National only, no parish religion cross-tab. Context, not a shipped subnational source."),
  raw_source_record(path_2021, url_2021, "pdf", FALSE, "2021",
    "bb-census-2021-report", "2021 Population and Housing Census Report; religion collected (questionnaire P11) but no religion table published (national or parish). Documents the missing 2021 parish wave."),
  raw_source_record(path_ola, url_ola, "html", FALSE, "2026", d2010,
    "BSS Open Licence Agreement (verbatim licence grant and acknowledgement-of-source notice)."),
  raw_source_record(path_terms, url_terms, "html", FALSE, "2026", d2010,
    "BSS Terms and Conditions; 'Terms of Use of Data ... subject to the requirements set forth under the Open Licence Agreement'."),
  raw_source_record(boundary_path, boundary_url, "geojson", TRUE, "2005", d_boundary,
    "geoBoundaries BRB ADM1 GeoJSON; 11 parishes, CC BY 2.5 Generic. Pinned commit 9469f09."),
  raw_source_record(boundary_meta_path, boundary_meta_url, "json", FALSE, "2005", d_boundary,
    "geoBoundaries BRB ADM1 metadata; records CC BY 2.5 Generic, boundaryYearRepresented 2005, admUnitCount 11.")
)

dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)
dataset_id <- "bb-census-religion:bb:2010:bss-parish"

reconciliation_block <- function(rec) {
  lapply(seq_len(nrow(rec)), function(i) as.list(rec[i, ]))
}

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = paste0("manifest:", dataset_id),
  dataset_id = dataset_id,
  dataset_version_id = paste0(dataset_id, ":", dataset_hash),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "bb-census-religion", dataset_role = "staged_evidence",
  scope = list(level = "country", country_codes = list("BB"), snapshot_date = NULL,
               snapshot_anchor = NULL, pipeline_stage = "staged"),
  created_at = stamp, created_by = script_id,
  target_years = list(2010L),
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation",
      shipped_waves = list(2010L),
      shipped_geography = "11 Barbados parishes (St. Michael, Christ Church, St. George, St. Philip, St. John, St. James, St. Thomas, St. Joseph, St. Andrew, St. Peter, St. Lucy)",
      boundary_set = boundary_set_id,
      source_tables = list(
        `2010` = "2010 Census Volume 1 Table 02.06 Total Population by Parish, Sex and Religion (integer full-count, 23 categories, Both Sexes)"
      ),
      universes = list(
        `2010` = "Tabulable Population, all persons, all ages (226,193); the Estimated Resident Population (277,821) is a separate adjusted figure and is not the religion denominator"
      ),
      method_note = paste(
        "The 2010 religion cross-tab (Table 02.06) is an integer full-count of the Tabulable Population (226,193).",
        "Every cell is transcribed verbatim from the Both Sexes rows; printed '-' is transcribed as 0. Both national",
        "margins close exactly. The Estimated Resident Population (277,821) is the census's separate adjusted total",
        "(the difference is the undercount) and is not used as the religion denominator."
      ),
      denominators = list(
        `2010` = "printed parish Total (Tabulable Population); affiliation = population - None - Not Stated"
      ),
      slot_design = paste(
        "Ordinary two-slot (SB/FM/KI precedent). religious_affiliation_percent is the share of the parish population",
        "reporting a named religion/denomination (population minus None minus Not Stated); no_religion_percent is the",
        "single None line. The Not Stated line stays in the denominator and in neither slot, so the two shares need",
        "not sum to 100. Barbados has a real None category, so no minority-share (task-6) treatment applies."
      ),
      category_frames = list(
        `2010` = as.list(cat_2010),
        alignment_note = paste(
          "Single-wave product: religion is cross-tabulated by parish only in the 2010 census. 1990 and 2000 religion",
          "are published at national level only (2000 National Census Report Table 2.7, categories Adventist, Anglican,",
          "Baptist, Brethren, Church of God, Hindu, Jehovah's Witness, Methodist, Moravian, Muslim, Pentecostal,",
          "Rastafarian, Roman Catholic, Salvation Army, Other, None, Not Stated). The 2021 census collected religion",
          "(questionnaire P11) but published no religion table in any geography. No cross-wave parish change is",
          "assertable; the 2010 frame is preserved verbatim."
        )
      ),
      change_rule = paste(
        "Single wave (2010): no cross-wave parish change layer. National religion context exists for 1990, 2000, and",
        "2010 (national totals), but the subnational (parish) product is 2010-only."
      ),
      no_religion_treatment = list(
        `2010` = "single None line (national 46,559; 20.6%); Not Stated is a separate non-response residual, excluded from this slot"
      ),
      held_and_deferred = paste(
        "The 2021 parish religion wave does not exist as a published table (religion was collected via questionnaire P11",
        "but not tabulated); it is a documented gap, not a held source. National 1990/2000 religion (2000 Report Table",
        "2.7) is a deeper-history national series, not a parish product. 2000 Volume 2 detailed tables carry no religion",
        "cross-tab. A 2021 parish religion table would require a BSS data request (recorded as a courtesy ask)."
      ),
      territorial_note = "Barbados has no external territorial dispute affecting the parish frame.",
      omitted_metrics = list("places_per_10000_residents", "place_density_per_sq_km"),
      boundary_simplification = simplification,
      local_cache_hint = "All raw sources are cached under data/raw/bb_census/ and remain git-ignored.",
      retrieval_record = raw_sources
    ),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")), digest = as.character(packageVersion("digest")),
      mapshaper = "scripts/lib/simplify_boundary.R (npx mapshaper)"
    )
  ),
  source = list(
    provider = "Barbados Statistical Service (BSS); geoBoundaries (William & Mary geoLab)",
    source_dataset_ids = list(d2010, d_boundary),
    source_urls = list(url_2010, url_2000, url_2021, url_ola, url_terms, boundary_url, boundary_meta_url),
    retrieved_at = stamp,
    licence = licence_accepted_text,
    citation = "BSS 2010 Population and Housing Census Volume 1 Table 02.06; geoBoundaries BRB ADM1 (gbOpen).",
    raw_redistribution = "The census PDFs and the geoBoundaries source GeoJSON are not committed; they remain in data/raw/bb_census/.",
    local_cache_hint = "data/raw/bb_census/ (git-ignored by .gitignore data/ rule)",
    raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/bb_census/")
  ),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = list(
    durable_file_record(summary_json_out, "Barbados 11-parish census-affiliation area summary for 2010.", "accepted", licence_basis_slug),
    durable_file_record(summary_csv_out, "Flattened Barbados 11-parish census-affiliation rows for 2010.", "accepted", licence_basis_slug),
    durable_file_record(boundary_out, "Simplified geoBoundaries BRB ADM1 11-parish boundary GeoJSON.", "accepted", "geoboundaries_cc_by_2_5_generic")
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id,
         notes = "11 parishes x 1 wave = 11 rows; all-persons universe; no suppressed cells in the headline slots."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out), built_by = script_id,
         notes = "11 parish features from geoBoundaries BRB ADM1, simplified with mapshaper weighted keep-shapes.")
  ),
  validation = list(
    status = "passed_with_warnings",
    commands = list(
      paste("Rscript", script_id),
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/bb/data/area_summary_parish.json",
      "bash scripts/validate_manifests.sh"
    ),
    gate_2010 = list(status = "passed", both_margins_close_to = national_2010,
                     parish_column_checks = 11L, religion_row_checks = length(cat_2010),
                     records = reconciliation_block(rec_2010)),
    boundary_validation = list(status = "passed", feature_count = 11L,
                               distinct_geometry_hashes = length(unique(geom_hashes)),
                               geometry_hashes = as.list(geom_hashes),
                               bbox = list(xmin = unname(bbox[["xmin"]]), ymin = unname(bbox[["ymin"]]),
                                           xmax = unname(bbox[["xmax"]]), ymax = unname(bbox[["ymax"]])),
                               dateline_note = "extent lon -59.65 to -59.42E, lat 13.04 to 13.34N; far from the antimeridian, no dateline handling needed",
                               output_bytes = file_bytes(boundary_out), simplification = simplification,
                               licence = boundary_licence, adm_unit_count = boundary_metadata[["admUnitCount"]]),
    join_coverage = list(matched_parishes = 11L, expected_parishes = 11L, unmatched_parishes = list(), unused_boundary_features = list()),
    notes = paste(
      "2010 Table 02.06 closes integer-exact at both margins (national total 226,193). Boundary joins 11/11 to",
      "geoBoundaries BRB ADM1 via a St.->Saint crosswalk with 11 distinct geometry hashes."
    ),
    warnings = list(
      "STAGED product: no page, no hub link. The page and the single-wave-subnational display decision are the conductor's (parallel to the Antigua task-8 single-wave parish question).",
      "Single-wave product: religion is cross-tabulated by parish only in 2010. 1990/2000 religion is national only (2000 Report Table 2.7); 2021 collected religion (P11) but published no religion table.",
      "The religion denominator is the Tabulable Population (226,193), not the Estimated Resident Population (277,821); the difference is the census undercount.",
      "Printed '-' in Table 02.06 is transcribed as 0 (structural zero cells for small denominations in small parishes)."
    )
  ),
  construct_notes = list(
    "The construct is census affiliation: each resident's reported religion/denomination (questionnaire item 'To which religion/denomination do you belong?'), asked of the whole resident population, not practice, attendance, or membership.",
    "The public product carries three headline fields per parish-wave: population total, religious affiliation percent, and no-religion percent. Place-density metrics are null (no governed place-of-worship snapshot).",
    "Single wave (2010): religion is cross-tabulated by parish only in the 2010 census (Table 02.06). 1990 and 2000 religion are national only (2000 National Census Report Table 2.7); the 2021 census collected religion (questionnaire P11) but published no religion table in any geography.",
    "The 2010 table is an integer full-count of the Tabulable Population (226,193). The Estimated Resident Population (277,821) is the census's separate adjusted total; the difference is the undercount and is not part of the religion denominator.",
    "Slot design (ordinary two-slot, SB/FM/KI precedent): religious_affiliation_percent is the share reporting a named religion/denomination (population minus None minus Not Stated); no_religion_percent is the single None line. Not Stated stays in the denominator and in neither slot, so the two shares need not sum to 100. Barbados has a real None category, so no minority-share (task-6) treatment applies.",
    "Licence accepted: the BSS Open Licence Agreement grants free reuse (commercial and non-commercial) with the acknowledgement-of-source notice. The product ships with the required value-added-product attribution to the Barbados Statistical Service. The boundary is geoBoundaries BRB ADM1, 11 parishes, Creative Commons Attribution 2.5 Generic, joined one-to-one via a St.->Saint crosswalk."
  ),
  deferred_sources = list(
    list(source_dataset_id = "bb-census-2000-report-table-2-7-national-religion", status = "deferred",
         url = url_2000, local_path = path_2000,
         notes = paste("2000 National Census Report Table 2.7: national religion for 1990 and 2000 (no parish breakdown).",
                       "A deeper-history national series, not a parish product.")),
    list(source_dataset_id = "bb-census-2021-parish-religion", status = "not_published",
         url = url_2021, local_path = path_2021,
         notes = paste("The 2021 census collected religion (questionnaire P11 'Are you affiliated with any religious",
                       "denomination?' / 'What is your religious affiliation/denomination?') but published no religion",
                       "table in the 2021 report. A 2021 parish religion table is a BSS data request (courtesy ask).")),
    list(source_dataset_id = "bss-data-request-2021-parish-religion", status = "not_pinned",
         url = bss_home_url, local_path = NULL,
         notes = "A BSS data request for the 2021 parish religion cross-tab would extend the product to two waves; recorded as a courtesy ask for the PI.")
  ),
  privacy = "public",
  licence_status = "accepted",
  licence_basis = licence_basis_slug,
  downstream_status = "staged",
  source_datasets = source_datasets(),
  notes = paste(
    "STAGED product (no page, no hub link). The committed products are the derived 11-parish area summary (11 rows",
    "for 2010) and the simplified geoBoundaries BRB ADM1 boundary. Licence accepted (BSS Open Licence Agreement, free",
    "reuse with the acknowledgement-of-source notice); boundary CC BY 2.5 Generic. Single-wave parish product; the",
    "page decision is the conductor's, parallel to the Antigua task-8 single-wave-subnational question."
  )
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

cat("wave shipped: 2010 on 11 Barbados parishes\n")
cat(sprintf("rows: %d (11 parishes x 1 wave)\n", length(rows)))
cat(sprintf("gate 2010: passed integer-exact; both margins close to %d\n", national_2010))
cat(sprintf("boundary gate: passed; 11/11 join, %d distinct geometry hashes, %d bytes at %g%% keep\n",
            length(unique(geom_hashes)), file_bytes(boundary_out), simplification[["keep_percent"]]))
cat("licence gate: accepted; BSS Open Licence Agreement with acknowledgement-of-source notice\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", boundary_out))
cat(sprintf("wrote %s\n", manifest_out))
