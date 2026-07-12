# build the Trinidad and Tobago municipality census-religion area-summary product for a
# single wave (2011) on the fifteen-unit OCHA COD-AB TTO ADM1 municipality frame. inputs
# (all cached, git-ignored, sha256 in research/countries/tt/route-probe.md):
#   data/raw/tt_census/tt_2011_demographic_report.pdf -> Table 8 "Non-Institutional
#     Population by Sex, Age Group, Religion and Municipality" (count-valued, 17
#     categories, 15 units, Both Sexes / All Ages column used)
#   data/raw/tt_census/adm1_cod/tto_adm1/TTO_adm1.shp -> 15-unit ADM1 boundary
#     (unzipped from tto_adm1_v2.zip; CC BY-IGO)
#   data/raw/tt_census/hdx_cod_ab_tto.json -> boundary licence metadata (CC BY-IGO)
# every religion cell is transcribed verbatim from Table 8 (Both Sexes, All Ages) and
# reconciled here against the printed control totals. the published table does NOT close
# integer-exact: printed marginals differ from printed-cell sums by up to +-2 (a source
# property; two extractors agree on all cells). under the documented-discrepancy ruling
# (Saint Lucia / Cote d'Ivoire) every value is transcribed verbatim, every residual is
# recorded, and no value is allocated, inferred, imputed, redistributed, rounded, or
# tuned to force closure. the gate asserts the derived bound (|resid| <= 2) and records
# each deviation; it does not fail on nonzero. the religion universe is the NON-
# INSTITUTIONAL population (1,322,546), distinct from the total enumerated population
# (1,328,019); the institutional population is not cross-tabbed by religion.
# outputs: apps/regions/tt/data/tt_municipality_codab.geojson,
#   apps/regions/tt/data/area_summary_municipality.{json,csv}, and
#   docs/manifests/tt-census-religion-2011.json.
# run from the repo root: Rscript scripts/build_tt_area_summary.R
# STAGED product: no page, no hub link. licence NEEDS_REVIEW (CSO "personal, non-
# commercial use with permission" clause; build-then-ask attribution); boundary CC BY-IGO.
# single-wave product (religion is cross-tabbed by municipality only in 2011; the
# page/single-wave-subnational decision is the conductor's, parallel to Antigua/Barbados).

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "TT"
script_id <- "scripts/build_tt_area_summary.R"
raw_dir <- "data/raw/tt_census"
product_dir <- "apps/regions/tt/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-12"
stamp <- paste0(retrieval_date, "T00:00:00Z")
git_commit <- trimws(system2("git", c("rev-parse", "HEAD"), stdout = TRUE))
if (length(git_commit) != 1L || !grepl("^[a-f0-9]{40}$", git_commit)) git_commit <- NULL

boundary_level <- "municipality"
boundary_vintage <- "codab-v2"
boundary_set_id <- "tt-municipality-codab-v2-adm1"

d2011 <- "tt-census-2011-demographic-report-table-8-religion-by-municipality"
d_boundary <- "ocha-codab-tto-adm1-v2"

# ---- source urls and cached paths ----------------------------------------------
url_2011 <- "https://cso.gov.tt/wp-content/uploads/2020/01/2011-Demographic-Report.pdf"
url_2000 <- "https://catalog.ihsn.org/index.php/catalog/4217/download/55709"
url_stats_act <- "https://cso.gov.tt/wp-content/uploads/2021/01/Statistics-Act.pdf"
cso_home_url <- "https://cso.gov.tt"
boundary_url <- "https://data.humdata.org/dataset/eed55f95-183c-48f7-adef-23dff31ec972/resource/218b72d0-35fb-4026-b8a6-152d87acea0d/download/tto_adm1_v2.zip"
boundary_meta_url <- "https://data.humdata.org/api/3/action/package_show?id=cod-ab-tto"
gb_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/TTO/ADM1/"

path_2011 <- file.path(raw_dir, "tt_2011_demographic_report.pdf")
path_2000 <- file.path(raw_dir, "tt_2000_national_census_report.pdf")
path_stats_act <- file.path(raw_dir, "tt_statistics_act.pdf")
boundary_zip_path <- file.path(raw_dir, "tto_adm1_v2.zip")
boundary_shp_path <- file.path(raw_dir, "adm1_cod", "tto_adm1", "TTO_adm1.shp")
boundary_meta_path <- file.path(raw_dir, "hdx_cod_ab_tto.json")

boundary_out <- file.path(product_dir, "tt_municipality_codab.geojson")
summary_json_out <- file.path(product_dir, "area_summary_municipality.json")
summary_csv_out <- file.path(product_dir, "area_summary_municipality.csv")
manifest_out <- file.path(manifest_dir, "tt-census-religion-2011.json")

# ---- canonical municipality frame ----------------------------------------------
# fifteen census units in Table 8 source order: two cities, three boroughs, nine
# regional corporations, and Tobago (one unit). the census prints "City of X" /
# "Borough of X"; the COD-AB NAME_1 drops those prefixes and normalises punctuation,
# so a deterministic crosswalk joins the two one-to-one (no fuzzy matching).
munis <- c("City of Port of Spain", "City of San Fernando", "Borough of Arima",
           "Borough of Chaguanas", "Borough of Point Fortin", "Couva/ Tabaquite/ Talparo",
           "Diego Martin", "Mayaro/ Rio Claro", "Penal/ Debe", "Princes Town",
           "San Juan/Laventille", "Sangre Grande", "Siparia", "Tunapuna/ Piarco", "Tobago")
muni_slug <- c(`City of Port of Spain` = "port_of_spain", `City of San Fernando` = "san_fernando",
               `Borough of Arima` = "arima", `Borough of Chaguanas` = "chaguanas",
               `Borough of Point Fortin` = "point_fortin", `Couva/ Tabaquite/ Talparo` = "couva_tabaquite_talparo",
               `Diego Martin` = "diego_martin", `Mayaro/ Rio Claro` = "mayaro_rio_claro",
               `Penal/ Debe` = "penal_debe", `Princes Town` = "princes_town",
               `San Juan/Laventille` = "san_juan_laventille", `Sangre Grande` = "sangre_grande",
               `Siparia` = "siparia", `Tunapuna/ Piarco` = "tunapuna_piarco", `Tobago` = "tobago")
# census unit name -> COD-AB NAME_1 value.
muni_boundary_name <- c(`City of Port of Spain` = "Port of Spain", `City of San Fernando` = "San Fernando",
                        `Borough of Arima` = "Arima", `Borough of Chaguanas` = "Chaguanas",
                        `Borough of Point Fortin` = "Point Fortin", `Couva/ Tabaquite/ Talparo` = "Couva-Tabaquite-Talparo",
                        `Diego Martin` = "Diego Martin", `Mayaro/ Rio Claro` = "Mayaro/Rio Claro",
                        `Penal/ Debe` = "Penal-Debe", `Princes Town` = "Princes Town",
                        `San Juan/Laventille` = "San Juan-Laventille", `Sangre Grande` = "Sangre Grande",
                        `Siparia` = "Siparia", `Tunapuna/ Piarco` = "Tunapuna/Piarco", `Tobago` = "Tobago")

# ---- 2011 Table 8 (count-valued; 17-category frame; Both Sexes / All Ages) -------
# verbatim source category order (Table 8). categories 1-15 are affiliation (15 = the
# residual Other line), 16 = None (no-religion), 17 = Not Stated (non-response). printed
# "-" in the table is transcribed as 0. no cell suppression.
cat_2011 <- c("Anglican", "Baptist-Spiritual Shouter", "Baptist-Other", "Hinduism", "Islam",
              "Jehovah's Witness", "Methodist", "Moravian", "Orisha",
              "Pentecostal/ Evangelical/ Full Gospel", "Presbyterian/ Congregational",
              "Rastafarian", "Roman Catholic", "Seventh Day Adventist", "Other", "None", "Not Stated")
n_affiliation <- 15L  # categories 1..15 are affiliation; 16 = None; 17 = Not Stated

# per-unit Both Sexes / All Ages counts in cat_2011 order (verbatim from Table 8, cross-
# checked by pdftotext and pdfplumber; zero cell disagreements).
muni_counts <- list(
  `City of Port of Spain`     = c(4476,2708,208,520,948,633,417,92,583,2861,228,195,14194,913,1616,974,4347),
  `City of San Fernando`      = c(4103,2478,833,5205,2235,675,340,6,334,6605,2651,142,11516,988,3968,814,5743),
  `Borough of Arima`          = c(1532,929,180,1468,946,476,167,22,459,4746,435,50,14099,1336,2454,878,3227),
  `Borough of Chaguanas`      = c(3186,3195,558,25084,7170,1062,569,47,601,9741,1973,79,12015,2109,7952,1327,6820),
  `Borough of Point Fortin`   = c(1608,2620,207,781,359,426,69,3,368,1619,206,101,4132,1142,2913,583,3023),
  `Couva/ Tabaquite/ Talparo` = c(5761,7959,991,55691,13238,2039,589,27,1135,24221,6666,270,25218,4067,12501,2213,15574),
  `Diego Martin`              = c(8745,4791,349,1875,2322,2219,655,107,1300,9891,540,538,45810,3735,5611,3316,10535),
  `Mayaro/ Rio Claro`         = c(573,2453,913,8006,2181,699,7,0,756,4409,1307,63,6521,1636,1764,733,3629),
  `Penal/ Debe`               = c(1966,2358,738,38402,5941,748,96,3,255,11777,4755,102,7614,896,5473,785,7432),
  `Princes Town`              = c(3636,5259,7647,27626,8690,812,190,13,420,13311,4111,192,8245,2985,6785,1246,11201),
  `San Juan/Laventille`       = c(12740,15035,494,13117,6601,3214,1212,198,2249,18836,1276,669,43751,7379,11113,4822,14314),
  `Sangre Grande`             = c(2718,4796,403,11653,2896,1157,158,48,318,9856,1915,196,19388,6226,6659,1986,5233),
  `Siparia`                   = c(4022,6417,1249,20307,3388,1104,150,1,598,9359,3129,310,15991,3067,7831,1357,8618),
  `Tunapuna/ Piarco`          = c(12152,7589,792,29955,8445,3202,1036,190,1619,22882,3675,474,53145,7801,14205,4532,41131),
  `Tobago`                    = c(7776,6414,387,408,345,986,2992,2769,925,8921,107,234,4030,9876,5320,3275,5971)
)

# printed control totals (Table 8 municipality "All Ages" Total column, verbatim).
total_2011_muni <- c(`City of Port of Spain` = 35914L, `City of San Fernando` = 48635L,
                     `Borough of Arima` = 33404L, `Borough of Chaguanas` = 83489L,
                     `Borough of Point Fortin` = 20161L, `Couva/ Tabaquite/ Talparo` = 178160L,
                     `Diego Martin` = 102340L, `Mayaro/ Rio Claro` = 35649L, `Penal/ Debe` = 89342L,
                     `Princes Town` = 102369L, `San Juan/Laventille` = 157021L, `Sangre Grande` = 75605L,
                     `Siparia` = 86898L, `Tunapuna/ Piarco` = 212825L, `Tobago` = 60735L)
# printed national religion totals (Table 8 TRINIDAD AND TOBAGO row, verbatim).
total_2011_cat <- setNames(
  c(74994L, 75002L, 15951L, 240100L, 65705L, 19450L, 8648L, 3526L, 11918L, 159033L,
    32972L, 3615L, 285671L, 54156L, 96166L, 28842L, 146798L), cat_2011)
national_2011 <- 1322546L          # printed non-institutional national total
trinidad_2011 <- 1261811L          # printed Trinidad subtotal (14 units)
no_rel_2011 <- "None"
nonresp_2011 <- "Not Stated"

# assemble the per-category matrix (category -> named unit vector) from the per-unit
# rows, so the transcription lives in one place and is reconciled below.
m2011 <- setNames(lapply(seq_along(cat_2011), function(i) {
  setNames(as.integer(vapply(munis, function(u) muni_counts[[u]][[i]], numeric(1))), munis)
}), cat_2011)

# ---- reconciliation gate (documented-discrepancy; record, do not tune) ----------
# the published table does not close exactly. transcribe verbatim, record every residual,
# and assert the derived bound; the build stops only if a residual EXCEEDS the bound
# (which would signal a transcription error, not a source rounding), never on a within-
# bound nonzero. no value is allocated, inferred, imputed, redistributed, or tuned.
col_bound <- 1L   # municipality column residual bound (observed max |1|)
row_bound <- 2L   # religion row residual bound (observed max |2|)

reconcile_wave <- function(mat, cats, muni_totals, cat_totals, national, trinidad, year) {
  records <- list()
  for (u in munis) {
    col_sum <- sum(vapply(cats, function(c) mat[[c]][[u]], numeric(1)))
    resid <- as.integer(muni_totals[[u]] - col_sum)
    if (abs(resid) > col_bound) {
      stop(sprintf("%d municipality residual for %s is %d, exceeds bound +-%d (transcription error?)",
                   year, u, resid, col_bound), call. = FALSE)
    }
    records[[length(records) + 1L]] <- data.frame(
      year = year, margin = "municipality_column", key = u,
      printed = as.integer(muni_totals[[u]]), cell_sum = as.integer(col_sum),
      residual = resid, stringsAsFactors = FALSE)
  }
  for (c in cats) {
    row_sum <- sum(mat[[c]])
    resid <- as.integer(cat_totals[[c]] - row_sum)
    if (abs(resid) > row_bound) {
      stop(sprintf("%d religion-row residual for %s is %d, exceeds bound +-%d (transcription error?)",
                   year, c, resid, row_bound), call. = FALSE)
    }
    records[[length(records) + 1L]] <- data.frame(
      year = year, margin = "religion_row", key = c,
      printed = as.integer(cat_totals[[c]]), cell_sum = as.integer(row_sum),
      residual = resid, stringsAsFactors = FALSE)
  }
  # grand and Trinidad-subtotal residuals (recorded, within +-1).
  grand_resid <- as.integer(national - sum(muni_totals))
  trinidad_units <- setdiff(munis, "Tobago")
  trinidad_resid <- as.integer(trinidad - sum(muni_totals[trinidad_units]))
  records[[length(records) + 1L]] <- data.frame(
    year = year, margin = "grand_total", key = "TRINIDAD AND TOBAGO",
    printed = as.integer(national), cell_sum = as.integer(sum(muni_totals)),
    residual = grand_resid, stringsAsFactors = FALSE)
  records[[length(records) + 1L]] <- data.frame(
    year = year, margin = "trinidad_subtotal", key = "TRINIDAD",
    printed = as.integer(trinidad), cell_sum = as.integer(sum(muni_totals[trinidad_units])),
    residual = trinidad_resid, stringsAsFactors = FALSE)
  if (abs(grand_resid) > col_bound || abs(trinidad_resid) > col_bound) {
    stop(sprintf("%d grand/Trinidad residual exceeds bound", year), call. = FALSE)
  }
  do.call(rbind, records)
}

rec_2011 <- reconcile_wave(m2011, cat_2011, total_2011_muni, total_2011_cat,
                           national_2011, trinidad_2011, 2011L)
max_resid <- max(abs(rec_2011[["residual"]]))
message(sprintf("gate 2011: PASSED (documented discrepancy; max |residual| = %d, within bound)", max_resid))

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

# unzip the COD-AB shapefile if the extracted .shp is not already present.
if (!file.exists(boundary_shp_path)) {
  require_file(boundary_zip_path)
  utils::unzip(boundary_zip_path, exdir = file.path(raw_dir, "adm1_cod"))
}
required_inputs <- c(path_2011, boundary_shp_path, boundary_meta_path)
invisible(lapply(required_inputs, require_file))

# confirm the pinned boundary licence and unit count before use.
boundary_metadata <- fromJSON(boundary_meta_path, simplifyVector = FALSE)[["result"]]
boundary_licence <- boundary_metadata[["license_title"]]
if (!identical(boundary_metadata[["license_id"]], "cc-by-igo")) {
  stop("OCHA COD-AB TTO licence metadata changed (expected cc-by-igo)", call. = FALSE)
}

# Trinidad-and-Tobago-centred equal-area projection for land areas (compact, far from
# antimeridian).
tt_laea <- "+proj=laea +lat_0=10.7 +lon_0=-61.2 +datum=WGS84 +units=m +no_defs"

# join the fifteen census units one-to-one to the COD-AB ADM1 features via the crosswalk.
build_boundary <- function(path) {
  boundary <- st_make_valid(st_read(path, quiet = TRUE, stringsAsFactors = FALSE))
  if (nrow(boundary) != 15L) stop("OCHA COD-AB TTO ADM1 feature count is not 15", call. = FALSE)
  target_names <- unname(muni_boundary_name[munis])
  idx <- match(target_names, boundary[["NAME_1"]])
  if (anyNA(idx) || anyDuplicated(idx) || !setequal(idx, seq_len(15L))) {
    stop("census units and COD-AB features do not join one-to-one", call. = FALSE)
  }
  boundary <- boundary[idx, ]
  boundary[["area_name"]] <- munis
  boundary[["boundary_source_name"]] <- boundary[["NAME_1"]]
  boundary[["area_pcode"]] <- boundary[["ADM1_PCODE"]]
  boundary[["area_code"]] <- unname(muni_slug[munis])
  boundary[["area_unit_id"]] <- paste(boundary_set_id, unname(muni_slug[munis]), sep = ":")
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- boundary_level
  boundary[["boundary_vintage"]] <- boundary_vintage
  boundary[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(boundary, tt_laea))) / 1e6
  boundary <- st_transform(st_make_valid(boundary), 4326)
  boundary[c("area_code", "area_name", "boundary_source_name", "area_pcode", "area_unit_id",
             "boundary_set_id", "boundary_level", "boundary_vintage",
             "land_area_sq_km", "geometry")]
}

boundary <- build_boundary(boundary_shp_path)

# full-extent gate: Trinidad and Tobago spans lon -61.93 to -60.49E and lat 10.04 to 11.36N.
bbox <- st_bbox(boundary)
if (bbox[["xmin"]] < -62.05 || bbox[["xmin"]] > -61.80 ||
    bbox[["xmax"]] < -60.60 || bbox[["xmax"]] > -60.35 ||
    bbox[["ymin"]] < 9.95 || bbox[["ymin"]] > 10.15 ||
    bbox[["ymax"]] < 11.25 || bbox[["ymax"]] > 11.50) {
  stop("boundary bbox does not match the expected Trinidad and Tobago extent", call. = FALSE)
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
if (nrow(written) != 15L) stop("simplified boundary does not contain 15 features", call. = FALSE)
w_valid <- st_is_valid(written)
if (any(st_is_empty(written)) || any(is.na(w_valid)) || any(!w_valid)) {
  stop("simplified boundary has empty or invalid geometries", call. = FALSE)
}
geom_hashes <- geometry_hashes(written)
if (length(unique(geom_hashes)) != 15L) stop("simplified boundary geometry hashes are not distinct", call. = FALSE)
message(sprintf("boundary: PASSED (15 valid distinct features, %d bytes at %g%% keep)",
                file_bytes(boundary_out), simplification[["keep_percent"]]))

land_area <- setNames(round(written[["land_area_sq_km"]], 4), written[["area_name"]])
area_unit <- setNames(written[["area_unit_id"]], written[["area_name"]])
area_code <- setNames(written[["area_code"]], written[["area_name"]])
area_pcode <- setNames(written[["area_pcode"]], written[["area_name"]])

# ---- product rows --------------------------------------------------------------
# slot design (ordinary two-slot, SB/FM/KI precedent, verbatim-cell variant):
# religious_affiliation is the sum of the fifteen named-religion cells plus the Other cell
# (categories 1..15); no_religion is the single None line; Not Stated stays in the
# denominator and in neither slot. every count is a verbatim printed cell; percentages use
# the printed municipality Total. the closure residual (printed total minus affiliation
# minus None minus Not Stated) is recorded per unit, never repaired.

flag_common <- paste(
  "census_affiliation", "non_institutional_population_universe",
  "single_select_reported_religion",
  "religious_affiliation_percent_is_categories_1_to_15_share",
  "no_religion_percent_is_none_line_only",
  "not_stated_residual_in_denominator_neither_slot",
  "shares_need_not_sum_to_100",
  "single_wave_2011_municipality_product",
  "denominator_is_non_institutional_population_1322546_not_total_enumerated_1328019",
  "documented_source_discrepancy_residuals_within_2_recorded_never_repaired",
  "licence_needs_review_cso_permission_clause_build_then_ask",
  "boundary_cc_by_igo_ocha_codab",
  sep = ";")
flag_2011 <- paste(
  "frame_2011_seventeen_category_count_valued",
  "none_line=None", "nonresponse_line=Not Stated",
  "printed_dash_transcribed_as_zero",
  flag_common, sep = ";")

basis_2011 <- paste(
  "2011 Population and Housing Census Demographic Report, Table 8 'Non-Institutional",
  "Population by Sex, Age Group, Religion and Municipality' (Both Sexes, All Ages column).",
  "The denominator is the printed municipality Total (non-institutional population).",
  "Religious affiliation is the sum of categories 1-15 (fifteen named religions plus the",
  "residual Other line). The published table does not close integer-exact; residuals are",
  "recorded, not repaired.")

# build one schema-shaped area-summary row, carrying the verbatim per-unit category
# breakdown and the closure residual on the quality flag (source_categories_verbatim
# pattern).
make_row <- function(u, year, mat, cats, muni_total, no_rel_label, nonresp_label,
                     n_aff, flag, basis, dataset_id) {
  pop <- muni_total[[u]]
  no_rel <- mat[[no_rel_label]][[u]]
  nonresp <- mat[[nonresp_label]][[u]]
  affiliation <- sum(vapply(cats[seq_len(n_aff)], function(c) mat[[c]][[u]], numeric(1)))
  closure_resid <- as.integer(pop - affiliation - no_rel - nonresp)
  aff_pct <- round(100 * affiliation / pop, 4)
  no_pct <- round(100 * no_rel / pop, 4)
  breakdown <- paste(vapply(cats, function(c) paste0(c, "=", as.integer(mat[[c]][[u]])), character(1)),
                     collapse = ";")
  full_flag <- paste0(flag, ";printed_total=", as.integer(pop),
                      ";closure_residual_printed_total_minus_cellsum=", closure_resid,
                      ";source_categories_verbatim=", breakdown)
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = unname(area_unit[[u]]),
    area_code = unname(area_code[[u]]),
    area_name = u,
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
    land_area_sq_km = unname(land_area[[u]]),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(dataset_id, d_boundary),
    quality_flag = full_flag
  )
}

rows <- list()
for (u in munis) {
  rows[[length(rows) + 1L]] <- make_row(u, 2011L, m2011, cat_2011, total_2011_muni,
                                        no_rel_2011, nonresp_2011, n_affiliation,
                                        flag_2011, basis_2011, d2011)
}

# ---- area-summary document -----------------------------------------------------

licence_needs_review_text <- paste(
  "The Central Statistical Office of Trinidad and Tobago (CSO) asserts copyright over its",
  "census publications. The 2011 Demographic Report states: 'Extracts from this",
  "publication may be reproduced, for personal, non-commercial use with permission,",
  "provided that the Central Statistical Office of Trinidad and Tobago is fully",
  "acknowledged as the source. Storage in a retrieval system ... must be requested in",
  "writing and requires prior permission ...' (Copyright 2012). The CSO website footer",
  "asserts 'All Rights Reserved'. No open-data licence is stated. This derived aggregate",
  "summary ships with attribution to the CSO under the standing BUILD-THEN-ASK ruling;",
  "licence status: needs_review, pending a CSO reuse confirmation (courtesy ask recorded",
  "for the PI). The boundary is OCHA COD-AB, Creative Commons Attribution for",
  "Intergovernmental Organisations (CC BY-IGO).")

cso_attribution <- paste(
  "Source: Central Statistical Office of Trinidad and Tobago, 2011 Population and Housing",
  "Census Demographic Report. Reproduced with acknowledgement of source.")

source_datasets <- function() {
  list(
    list(
      source_dataset_id = d2011,
      name = "Trinidad and Tobago 2011 Population and Housing Census Demographic Report, Table 8: Non-Institutional Population by Sex, Age Group, Religion and Municipality",
      provider = "Central Statistical Office of Trinidad and Tobago (CSO)",
      url = url_2011, retrieval_date = retrieval_date, local_path = path_2011,
      licence = list(name = licence_needs_review_text, url = cso_home_url, attribution = cso_attribution),
      citation = "Central Statistical Office, Ministry of Planning and Sustainable Development. Trinidad and Tobago 2011 Population and Housing Census Demographic Report, Table 8.",
      access_limits = NULL,
      redistribution_limits = "Derived municipality summaries ship with attribution under BUILD-THEN-ASK (CSO reuse confirmation pending). Raw census PDFs are not committed.",
      notes = paste("Count-valued; 17-category frame; Both Sexes, All Ages column. The published table does not close",
                    "integer-exact: printed marginals differ from printed-cell sums by up to +-2 (a source property; two",
                    "extractors agree on all 255 cells). Residuals recorded, never repaired. Printed '-' transcribed as 0.",
                    "The universe is the non-institutional population (1,322,546); the total enumerated population",
                    "(1,328,019) includes the institutional population, which is not cross-tabbed by religion.")),
    list(
      source_dataset_id = d_boundary,
      name = "OCHA COD-AB Trinidad and Tobago, ADM1 (15 municipalities)",
      provider = "OCHA Field Information Services Section (FISS); geometry lineage GADM (www.gadm.org)",
      url = boundary_url, retrieval_date = retrieval_date, local_path = boundary_zip_path,
      licence = list(name = boundary_licence, url = "http://creativecommons.org/licenses/by/3.0/igo/legalcode",
                     attribution = "OCHA Field Information Services Section (FISS); geometry from GADM (www.gadm.org)"),
      citation = "OCHA COD-AB Trinidad and Tobago ADM1 (tto_adm1_v2), 15 municipality boundaries; geometry from GADM.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary is committed under Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO), attribution to OCHA/GADM.",
      notes = paste("15 ADM1 units (nine regional corporations, three boroughs, two cities, Tobago), each with an",
                    "ADM1 pcode (TT10-TT90), joined one-to-one to the census units via a name crosswalk. geoBoundaries",
                    "TTO ADM1 (OSM/ODbL) was rejected because it carries only 14 units, omitting the Borough of Arima.",
                    "The extent spans lon -61.93 to -60.49E and lat 10.04 to 11.36N, far from the antimeridian."))
  )
}

indicators <- function() {
  denom_note <- paste(
    "Percentages use each unit's printed municipality Total (non-institutional population).",
    "The Not Stated line stays in the denominator and outside both headline numerators, so",
    "the two shares need not sum to 100%. The published table does not close exactly;",
    "residuals (up to +-2 at any margin) are recorded, not repaired.")
  list(
    list(indicator_id = "population_total", label = "Census population total",
         description = "Municipality all-persons non-institutional population in the 2011 religion table.",
         unit = "count", denominator_indicator_id = NULL,
         method = "Printed municipality Total from 2011 Demographic Report Table 8 (Both Sexes, All Ages).",
         temporal_coverage = "2011", spatial_coverage = "Trinidad and Tobago municipalities (15)",
         quality_notes = "Religion is asked of the whole non-institutional population (no age restriction; the All Ages column is used). The denominator is the non-institutional population (national 1,322,546), distinct from the total enumerated population (1,328,019); the institutional population is tabulated separately and not cross-tabbed by religion."),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
         description = "Share of the municipality population reporting affiliation with a religion (categories 1-15, including the residual Other line).",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (sum of the fifteen named-religion cells plus Other) / printed municipality Total.",
         temporal_coverage = "2011", spatial_coverage = "Trinidad and Tobago municipalities (15)",
         quality_notes = paste("Single wave (2011): religion is cross-tabulated by municipality only in the 2011 census; the 2000 National Census Report reports religion nationally only (Table 2.6, prorated), and no post-2011 census has occurred.", denom_note)),
    list(indicator_id = "no_religion_percent", label = "No religious affiliation %",
         description = "Share of the municipality population in the census None line.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * None / printed municipality Total. The Not Stated line is not part of this slot.",
         temporal_coverage = "2011", spatial_coverage = "Trinidad and Tobago municipalities (15)",
         quality_notes = paste("The national no-religion share was 2.2% in 2011 (28,842 / 1,322,546); None and Not Stated together are 13.3%. The construct is the share reporting None, read within each unit's printed denominator.", denom_note))
  )
}

visual_layers <- function() {
  list(
    list(visual_layer_id = "tt-municipality-religious-affiliation", label = "Religious affiliation %",
         description = "Trinidad and Tobago census-affiliation share by municipality (2011).", layer_type = "choropleth",
         indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "municipality non-institutional population, including a Not Stated residual"),
         colour_scale = "sequential", time_control = "none",
         aggregation_rule = "reported municipality value", uncertainty_display = "quality_flag",
         default_visibility = TRUE,
         notes = "Census affiliation, not practice, attendance, or membership. Single wave (2011)."),
    list(visual_layer_id = "tt-municipality-no-religion", label = "No religious affiliation %",
         description = "Trinidad and Tobago census no-religion share by municipality (2011).", layer_type = "choropleth",
         indicator_ids = list("no_religion_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "municipality non-institutional population"),
         colour_scale = "sequential", time_control = "none",
         aggregation_rule = "reported municipality value", uncertainty_display = "quality_flag",
         default_visibility = FALSE,
         notes = "The source category is None. The Not Stated line (11.1% nationally) is excluded from this slot.")
  )
}

summary_product <- list(
  schema_version = "area-summary.v1", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code,
                      level = boundary_level, vintage = boundary_vintage, source_dataset_id = d_boundary),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "No governed place-of-worship snapshot ships in the Trinidad and Tobago census product.",
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
       raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/tt_census/"))
}

durable_file_record <- function(path, content, licence_status_value, licence_basis_value) {
  list(uri = paste0("repo:", path), storage_provider = "git_repository", format = sub("^.*\\.", "", path),
       bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = if (grepl("area_summary|\\.csv$", path)) row_count_file(path) else NULL,
       feature_count = if (grepl("\\.geojson$", path)) row_count_file(path) else NULL,
       content = content, privacy = "public",
       licence_status = licence_status_value, licence_basis = licence_basis_value)
}

licence_basis_slug <- "cso_copyright_permission_attribution"

raw_sources <- list(
  raw_source_record(path_2011, url_2011, "pdf", TRUE, "2011", d2011,
    "2011 Demographic Report; Table 8 religion by municipality (count-valued, Both Sexes, All Ages). Marginals close to within +-2 of the printed-cell sums; residuals recorded."),
  raw_source_record(path_2000, url_2000, "pdf", FALSE, "1990;2000", "tt-census-2000-national-report-table-2-6-national-religion",
    "2000 National Census Report (CARICOM/CSO); Table 2.6 national religion for 1990 and 2000 (prorated, tabulable-households base). National only, no municipality religion cross-tab. Context, not a shipped subnational source."),
  raw_source_record(path_stats_act, url_stats_act, "pdf", FALSE, "n/a", d2011,
    "Trinidad and Tobago Statistics Act (governs the CSO). Context for the rights posture; no open-data licence."),
  raw_source_record(boundary_zip_path, boundary_url, "zip", TRUE, "codab-v2", d_boundary,
    "OCHA COD-AB TTO ADM1 shapefile (tto_adm1_v2); 15 municipalities, CC BY-IGO, geometry from GADM."),
  raw_source_record(boundary_meta_path, boundary_meta_url, "json", FALSE, "codab-v2", d_boundary,
    "HDX COD-AB TTO metadata; records CC BY-IGO (license_id cc-by-igo), dataset_source www.gadm.org, org OCHA FISS.")
)

dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)
dataset_id <- "tt-census-religion:tt:2011:cso-municipality"

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
  dataset_family = "tt-census-religion", dataset_role = "staged_evidence",
  scope = list(level = "country", country_codes = list("TT"), snapshot_date = NULL,
               snapshot_anchor = NULL, pipeline_stage = "staged"),
  created_at = stamp, created_by = script_id,
  target_years = list(2011L),
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation",
      shipped_waves = list(2011L),
      shipped_geography = "15 Trinidad and Tobago municipalities (2 cities, 3 boroughs, 9 regional corporations, Tobago)",
      boundary_set = boundary_set_id,
      source_tables = list(
        `2011` = "2011 Demographic Report Table 8 Non-Institutional Population by Sex, Age Group, Religion and Municipality (count-valued, 17 categories, Both Sexes, All Ages column)"
      ),
      universes = list(
        `2011` = "Non-institutional population, all persons, all ages (1,322,546); the total enumerated population (1,328,019) includes the institutional population, which is not cross-tabbed by religion"
      ),
      method_note = paste(
        "The 2011 religion cross-tab (Table 8) is count-valued. Every cell is transcribed verbatim from the Both Sexes",
        "All Ages column; printed '-' is transcribed as 0. The published table does NOT close integer-exact: printed",
        "marginals differ from printed-cell sums by up to +-2 (municipality columns +-1, religion rows +-2, grand -1).",
        "The discrepancy is source-internal (pdftotext and pdfplumber agree on all 255 cells; the published national row",
        "itself sums to 1,322,547 vs the printed 1,322,546). Under the documented-discrepancy ruling (Saint Lucia / Cote",
        "d'Ivoire), values are unchanged and every residual is recorded; nothing is allocated, imputed, or repaired."
      ),
      denominators = list(
        `2011` = "printed municipality Total (non-institutional population); affiliation = sum of categories 1-15 (verbatim)"
      ),
      slot_design = paste(
        "Ordinary two-slot (SB/FM/KI precedent, verbatim-cell variant). religious_affiliation_percent is the share",
        "reporting a religion = (sum of the fifteen named-religion cells plus the residual Other line) / printed",
        "municipality Total; no_religion_percent is the single None line / printed municipality Total. The Not Stated",
        "line stays in the denominator and in neither slot, so the two shares need not sum to 100. Trinidad and Tobago",
        "has a real None category, so no minority-share (task-6) treatment applies. Every count is a verbatim printed",
        "cell; no count is derived by subtraction from a total the cells do not match."
      ),
      category_frames = list(
        `2011` = as.list(cat_2011),
        affiliation_categories = "1-15 (Anglican through Other); 16 = None (no-religion); 17 = Not Stated (non-response)",
        alignment_note = paste(
          "Single-wave product: religion is cross-tabulated by municipality only in the 2011 census. The 2000 National",
          "Census Report publishes religion nationally only (Table 2.6, categories Anglican, Baptist, Hindu, Jehovah",
          "Witness, Methodist, Muslim, Pentecostal, Presbyterian, Roman Catholic, SDA, None), prorated with Other merged",
          "into Not Stated and on a tabulable-households base. That frame is not comparable to the 2011 seventeen-category",
          "frame and is not built. No cross-wave municipality change is assertable; the 2011 frame is preserved verbatim."
        )
      ),
      change_rule = paste(
        "Single wave (2011): no cross-wave municipality change layer. National religion context exists for 1990, 2000,",
        "and 2011, but the subnational (municipality) product is 2011-only."
      ),
      no_religion_treatment = list(
        `2011` = "single None line (national 28,842; 2.2%); Not Stated is a separate non-response residual (national 146,798; 11.1%), excluded from this slot"
      ),
      discrepancy_treatment = paste(
        "Documented-discrepancy (Saint Lucia / Cote d'Ivoire): published values unchanged, every residual recorded, none",
        "repaired. Derived bound: municipality column residuals within +-1, religion row residuals within +-2, grand",
        "residual -1. Max absolute residual at any margin: 2."
      ),
      held_and_deferred = paste(
        "No 2000 municipality religion table is published (the 2000 National Census Report is national-only, prorated).",
        "The 2000 municipality route is the CSO REDATAM online engine (2000-census-portal, BASE=PHC2K), a session-",
        "ephemeral microdata tabulation (the Antigua REDATAM pattern); recorded as the deferred unblock, not built. No",
        "post-2011 census exists (COVID-delayed; GDUE began January 2026; census planned for 2027)."
      ),
      territorial_note = "Trinidad and Tobago has no external territorial dispute affecting the municipality frame; Tobago is rendered as a single census unit.",
      omitted_metrics = list("places_per_10000_residents", "place_density_per_sq_km"),
      boundary_simplification = simplification,
      boundary_choice_note = paste(
        "OCHA COD-AB TTO ADM1 (15 units, CC BY-IGO, geometry from GADM) was selected. geoBoundaries TTO ADM1 (OSM/ODbL,",
        "non-null licence) was rejected on completeness: it carries only 14 units, omitting the Borough of Arima."
      ),
      local_cache_hint = "All raw sources are cached under data/raw/tt_census/ and remain git-ignored.",
      retrieval_record = raw_sources
    ),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")), digest = as.character(packageVersion("digest")),
      mapshaper = "scripts/lib/simplify_boundary.R (npx mapshaper)"
    )
  ),
  source = list(
    provider = "Central Statistical Office of Trinidad and Tobago (CSO); OCHA Field Information Services Section (FISS) / GADM",
    source_dataset_ids = list(d2011, d_boundary),
    source_urls = list(url_2011, url_2000, url_stats_act, boundary_url, boundary_meta_url, gb_meta_url),
    retrieved_at = stamp,
    licence = licence_needs_review_text,
    citation = "CSO 2011 Population and Housing Census Demographic Report Table 8; OCHA COD-AB TTO ADM1 (tto_adm1_v2).",
    raw_redistribution = "The census PDFs and the COD-AB shapefile zip are not committed; they remain in data/raw/tt_census/.",
    local_cache_hint = "data/raw/tt_census/ (git-ignored by .gitignore data/ rule)",
    raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/tt_census/")
  ),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = list(
    durable_file_record(summary_json_out, "Trinidad and Tobago 15-municipality census-affiliation area summary for 2011.", "needs_review", licence_basis_slug),
    durable_file_record(summary_csv_out, "Flattened Trinidad and Tobago 15-municipality census-affiliation rows for 2011.", "needs_review", licence_basis_slug),
    durable_file_record(boundary_out, "Simplified OCHA COD-AB TTO ADM1 15-municipality boundary GeoJSON.", "accepted", "ocha_codab_cc_by_igo")
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id,
         notes = "15 municipalities x 1 wave = 15 rows; non-institutional universe; documented +-2 source discrepancy recorded per margin."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out), built_by = script_id,
         notes = "15 municipality features from OCHA COD-AB TTO ADM1, simplified with mapshaper weighted keep-shapes.")
  ),
  validation = list(
    status = "passed_with_warnings",
    commands = list(
      paste("Rscript", script_id),
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/tt/data/area_summary_municipality.json",
      "bash scripts/validate_manifests.sh"
    ),
    gate_2011 = list(status = "passed_with_documented_discrepancy",
                     max_abs_residual = max_resid, column_bound = col_bound, row_bound = row_bound,
                     grand_residual = as.integer(national_2011 - sum(total_2011_muni)),
                     municipality_column_checks = 15L, religion_row_checks = length(cat_2011),
                     records = reconciliation_block(rec_2011)),
    boundary_validation = list(status = "passed", feature_count = 15L,
                               distinct_geometry_hashes = length(unique(geom_hashes)),
                               geometry_hashes = as.list(geom_hashes),
                               bbox = list(xmin = unname(bbox[["xmin"]]), ymin = unname(bbox[["ymin"]]),
                                           xmax = unname(bbox[["xmax"]]), ymax = unname(bbox[["ymax"]])),
                               dateline_note = "extent lon -61.93 to -60.49E, lat 10.04 to 11.36N; far from the antimeridian, no dateline handling needed",
                               output_bytes = file_bytes(boundary_out), simplification = simplification,
                               licence = boundary_licence, adm_unit_count = 15L),
    join_coverage = list(matched_units = 15L, expected_units = 15L, unmatched_units = list(), unused_boundary_features = list()),
    notes = paste(
      "2011 Table 8 is transcribed verbatim and reconciled under the documented-discrepancy ruling: printed marginals",
      "differ from printed-cell sums by up to +-2 (max residual 2), every deviation recorded, none repaired. Boundary",
      "joins 15/15 to OCHA COD-AB TTO ADM1 via a name crosswalk with 15 distinct geometry hashes."
    ),
    warnings = list(
      "STAGED product: no page, no hub link. Licence needs_review (CSO 'personal, non-commercial use with permission' clause; CSO courtesy reuse ask recorded for the PI). The page and the single-wave-subnational display decision are the conductor's (parallel to the Antigua/Barbados task-8 question).",
      "Single-wave product: religion is cross-tabulated by municipality only in 2011. The 2000 National Census Report is national-only (Table 2.6, prorated); no post-2011 census exists (census planned for 2027).",
      "The published Table 8 does not close integer-exact: printed marginals differ from printed-cell sums by up to +-2 (source-internal; two extractors agree on all cells). Values unchanged, residuals recorded, never repaired.",
      "The religion denominator is the non-institutional population (1,322,546), not the total enumerated population (1,328,019); the institutional population is not cross-tabbed by religion.",
      "Boundary is OCHA COD-AB (CC BY-IGO, geometry from GADM); geoBoundaries TTO ADM1 (OSM/ODbL) was rejected for omitting the Borough of Arima (14 units).",
      "Printed '-' in Table 8 is transcribed as 0 (structural zero cells for small denominations in small units)."
    )
  ),
  construct_notes = list(
    "The construct is census affiliation: each resident's reported religion, asked of the non-institutional population, not practice, attendance, or membership.",
    "The public product carries three headline fields per municipality-wave: population total, religious affiliation percent, and no-religion percent. Place-density metrics are null (no governed place-of-worship snapshot).",
    "Single wave (2011): religion is cross-tabulated by municipality only in the 2011 census (Table 8). The 2000 National Census Report publishes religion nationally only (Table 2.6, prorated, tabulable-households base); no post-2011 census has occurred (COVID-delayed; census planned for 2027).",
    "The 2011 table is count-valued on the non-institutional population (1,322,546). The total enumerated population (1,328,019) includes the institutional population, which is tabulated separately and not cross-tabbed by religion.",
    "The published Table 8 does not close integer-exact: printed marginals differ from printed-cell sums by up to +-2. Under the documented-discrepancy ruling (Saint Lucia / Cote d'Ivoire), values are transcribed verbatim, every residual is recorded, and nothing is allocated, imputed, or repaired.",
    "Slot design (ordinary two-slot, SB/FM/KI precedent, verbatim-cell variant): religious_affiliation_percent is the share reporting a religion (sum of categories 1-15, including the residual Other line) / printed municipality Total; no_religion_percent is the single None line / printed municipality Total. Not Stated stays in the denominator and in neither slot, so the two shares need not sum to 100. Trinidad and Tobago has a real None category, so no minority-share (task-6) treatment applies. The Baptist-Spiritual Shouter and Orisha categories are preserved verbatim, never merged.",
    "Licence needs_review: the CSO permits reproduction of extracts only for 'personal, non-commercial use with permission' with full acknowledgement, and its website footer asserts All Rights Reserved. The derived aggregate summary ships with CSO attribution under BUILD-THEN-ASK, pending a CSO reuse confirmation (courtesy ask recorded for the PI). The boundary is OCHA COD-AB TTO ADM1, 15 units, CC BY-IGO (geometry from GADM), joined one-to-one via a name crosswalk; geoBoundaries was rejected for omitting the Borough of Arima."
  ),
  deferred_sources = list(
    list(source_dataset_id = "tt-census-2000-national-report-table-2-6-national-religion", status = "deferred",
         url = url_2000, local_path = path_2000,
         notes = paste("2000 National Census Report Table 2.6: national religion for 1990 and 2000 (prorated, Other merged",
                       "into Not Stated, tabulable-households base; no municipality breakdown). A deeper-history national",
                       "series, not a municipality product.")),
    list(source_dataset_id = "tt-census-2000-redatam-phc2k-municipality-religion", status = "not_pinned",
         url = "https://prod.redatam.org/bintto/RpWebEngine.exe/Portal?BASE=PHC2K", local_path = NULL,
         notes = paste("The CSO REDATAM online engine (2000-census-portal, BASE=PHC2K) can tabulate 2000 religion by",
                       "municipality from microdata, but it is session-ephemeral browser work (the Antigua REDATAM pattern).",
                       "Recorded as the deferred unblock to a 2000 municipality wave; not built.")),
    list(source_dataset_id = "tt-census-post-2011", status = "not_conducted",
         url = cso_home_url, local_path = NULL,
         notes = paste("No post-2011 census exists. The census was COVID-delayed (targeted Q4 2022, then postponed); the",
                       "Geospatial Data Update Exercise began 26 January 2026 and the census is planned for 2027.")),
    list(source_dataset_id = "geoboundaries-tto-adm1", status = "rejected",
         url = gb_meta_url, local_path = file.path(raw_dir, "geoBoundaries-TTO-ADM1.geojson"),
         notes = paste("geoBoundaries TTO ADM1 (OSM/ODbL, non-null licence) carries only 14 units, omitting the Borough of",
                       "Arima (population 33,404). Rejected on completeness in favour of OCHA COD-AB (15 units)."))
  ),
  privacy = "public",
  licence_status = "needs_review",
  licence_basis = licence_basis_slug,
  downstream_status = "staged",
  source_datasets = source_datasets(),
  notes = paste(
    "STAGED product (no page, no hub link). The committed products are the derived 15-municipality area summary (15 rows",
    "for 2011) and the simplified OCHA COD-AB TTO ADM1 boundary. Licence needs_review (CSO copyright, 'personal,",
    "non-commercial use with permission'; ships with attribution under BUILD-THEN-ASK, CSO courtesy ask recorded for the",
    "PI); boundary CC BY-IGO. Single-wave municipality product; the page decision is the conductor's, parallel to the",
    "Antigua/Barbados single-wave-subnational question."
  )
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

cat("wave shipped: 2011 on 15 Trinidad and Tobago municipalities\n")
cat(sprintf("rows: %d (15 municipalities x 1 wave)\n", length(rows)))
cat(sprintf("gate 2011: passed with documented discrepancy; max |residual| = %d (bound cols +-%d, rows +-%d)\n",
            max_resid, col_bound, row_bound))
cat(sprintf("boundary gate: passed; 15/15 join, %d distinct geometry hashes, %d bytes at %g%% keep\n",
            length(unique(geom_hashes)), file_bytes(boundary_out), simplification[["keep_percent"]]))
cat("licence gate: needs_review; CSO copyright (build-then-ask, attribution); boundary CC BY-IGO\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", boundary_out))
cat(sprintf("wrote %s\n", manifest_out))
