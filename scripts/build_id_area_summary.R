# build the Indonesia province census-religion area-summary product for the single
# 2010 census wave (SP2010) on the 33-unit 2010 province frame. inputs (all cached,
# git-ignored, sha256 recorded in research/countries/id/route-probe.md):
#   data/raw/id_census/sp2010_religion_province_national.html -> BPS Sensus Penduduk
#     2010 "Penduduk Menurut Wilayah dan Agama yang Dianut" (religion by province),
#     verbatim ten-column frame; counts transcribed as R literals below.
#   data/raw/id_census/geoBoundaries-IDN-ADM1-gbHum.geojson -> 34-province ADM1
#     boundary (gbHumanitarian, OCHA ROAP/HDX COD lineage, CC BY 3.0 IGO)
#   data/raw/id_census/gb_idn_adm1_gbhum_meta.json -> boundary licence metadata
# the record refutes the queue's multi-wave / kabupaten premises: SP2020 dropped the
# religion question (pandemic short form), so census affiliation has one modern wave
# (SP2010); 2020+ subnational religion is Dukcapil administrative registration, a
# separate construct kept out of this product. every count is transcribed verbatim
# from the SP2010 source and reconciled against the printed province totals and the
# national column totals here; the build stops on any margin mismatch and never
# allocates, infers, rounds, imputes, or tunes a value.
# outputs: apps/regions/id/data/id_province_2019.geojson,
#   apps/regions/id/data/area_summary_province.{json,csv}, and
#   docs/manifests/id-census-religion-2010.json.
# run from the repo root: Rscript scripts/build_id_area_summary.R
# STAGED product: no page, no hub link; licence needs_review under BUILD-THEN-ASK
# (BPS copyright-only with attribution; boundary CC BY 3.0 IGO).

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "ID"
script_id <- "scripts/build_id_area_summary.R"
raw_dir <- "data/raw/id_census"
product_dir <- "apps/regions/id/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-12"
stamp <- paste0(retrieval_date, "T00:00:00Z")
git_commit <- trimws(system2("git", c("rev-parse", "HEAD"), stdout = TRUE))
if (length(git_commit) != 1L || !grepl("^[a-f0-9]{40}$", git_commit)) git_commit <- NULL

# gbHumanitarian boundaryYearRepresented is 2019 for IDN ADM1 (34 provinces incl
# Kalimantan Utara). dissolved back to the 33-unit 2010 census frame in this build.
boundary_level <- "province"
boundary_vintage <- "2019"
boundary_set_id <- "id-province-2019-cod-adm1"

d_sp2010 <- "id-sp2010-religion-by-province"
d_boundary <- "geoboundaries-idn-adm1-gbhum-2019"

# ---- source urls and cached paths ----------------------------------------------
url_sp2010 <- "https://sensus.bps.go.id/topik/tabular/sp2010/12/0/0"
bps_home_url <- "https://sensus.bps.go.id"
boundary_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbHumanitarian/IDN/ADM1/geoBoundaries-IDN-ADM1.geojson"
boundary_meta_url <- "https://www.geoboundaries.org/api/current/gbHumanitarian/IDN/ADM1/"

path_sp2010 <- file.path(raw_dir, "sp2010_religion_province_national.html")
boundary_path <- file.path(raw_dir, "geoBoundaries-IDN-ADM1-gbHum.geojson")
boundary_meta_path <- file.path(raw_dir, "gb_idn_adm1_gbhum_meta.json")

boundary_out <- file.path(product_dir, "id_province_2019.geojson")
summary_json_out <- file.path(product_dir, "area_summary_province.json")
summary_csv_out <- file.path(product_dir, "area_summary_province.csv")
manifest_out <- file.path(manifest_dir, "id-census-religion-2010.json")

# ---- SP2010 religion by province (verbatim, 33-province 2010 frame) -------------
# BPS province codes and verbatim source names (UPPERCASE as printed). the ten
# published columns are the seven official religions plus two non-response residuals
# (Tidak Terjawab = not answered; Tidak Ditanyakan = not asked) and the Total.
prov_code <- c("11", "12", "13", "14", "15", "16", "17", "18", "19", "21", "31", "32",
               "33", "34", "35", "36", "51", "52", "53", "61", "62", "63", "64", "71",
               "72", "73", "74", "75", "76", "81", "82", "91", "94")
prov_name_src <- c("NANGGROE ACEH DARUSSALAM", "SUMATERA UTARA", "SUMATERA BARAT", "RIAU",
                   "JAMBI", "SUMATERA SELATAN", "BENGKULU", "LAMPUNG",
                   "KEPULAUAN BANGKA BELITUNG", "KEPULAUAN RIAU", "DKI JAKARTA",
                   "JAWA BARAT", "JAWA TENGAH", "DI YOGYAKARTA", "JAWA TIMUR", "BANTEN",
                   "BALI", "NUSA TENGGARA BARAT", "NUSA TENGGARA TIMUR",
                   "KALIMANTAN BARAT", "KALIMANTAN TENGAH", "KALIMANTAN SELATAN",
                   "KALIMANTAN TIMUR", "SULAWESI UTARA", "SULAWESI TENGAH",
                   "SULAWESI SELATAN", "SULAWESI TENGGARA", "GORONTALO", "SULAWESI BARAT",
                   "MALUKU", "MALUKU UTARA", "PAPUA BARAT", "PAPUA")
# clean display names (canonical Title Case) in the same order.
prov_name <- c("Aceh", "Sumatera Utara", "Sumatera Barat", "Riau", "Jambi",
               "Sumatera Selatan", "Bengkulu", "Lampung", "Kepulauan Bangka Belitung",
               "Kepulauan Riau", "DKI Jakarta", "Jawa Barat", "Jawa Tengah",
               "DI Yogyakarta", "Jawa Timur", "Banten", "Bali", "Nusa Tenggara Barat",
               "Nusa Tenggara Timur", "Kalimantan Barat", "Kalimantan Tengah",
               "Kalimantan Selatan", "Kalimantan Timur", "Sulawesi Utara",
               "Sulawesi Tengah", "Sulawesi Selatan", "Sulawesi Tenggara", "Gorontalo",
               "Sulawesi Barat", "Maluku", "Maluku Utara", "Papua Barat", "Papua")

prov_total <- c(4494410, 12982204, 4846909, 5538367, 3092265, 7450394, 1715518, 7608405,
                1223296, 1679163, 9607787, 43053732, 32382657, 3457491, 37476757,
                10632166, 3890757, 4500212, 4683827, 4395983, 2212089, 3626616, 3553143,
                2270596, 2635009, 8034776, 2232586, 1040164, 1158651, 1533506, 1038087,
                760422, 2833381)
col_islam <- c(4413244, 8579830, 4721924, 4872873, 2950195, 7218951, 1669081, 7264783,
               1088791, 1332201, 8200796, 41763592, 31328341, 3179129, 36113396,
               10065783, 520244, 4341284, 423925, 2603318, 1643715, 3505846, 3033705,
               701699, 2047959, 7200938, 2126126, 1017396, 957735, 776130, 771110,
               292026, 450096)
col_kristen <- c(50309, 3509700, 69253, 484895, 82311, 72235, 28724, 115255, 22053,
                 187576, 724232, 779272, 572517, 94268, 638467, 268890, 64454, 13862,
                 1627157, 500254, 353353, 47974, 337380, 1444141, 447475, 612751, 41131,
                 16559, 164667, 634841, 258471, 408841, 1855245)
col_katolik <- c(3315, 516037, 40428, 44183, 13250, 42436, 6364, 69014, 14738, 38252,
                 303295, 250875, 317919, 165749, 234204, 115865, 31397, 8894, 2535937,
                 1008368, 58279, 16045, 138629, 99980, 21638, 124255, 12880, 761, 11871,
                 103629, 5378, 53463, 500545)
col_hindu <- c(136, 14644, 234, 1076, 582, 39206, 3727, 113512, 1040, 1541, 20364, 19481,
               17448, 5257, 112177, 8189, 3247283, 118083, 5210, 2708, 11149, 16064,
               7657, 13133, 99579, 58393, 45441, 3612, 16042, 5669, 200, 859, 2420)
col_budha <- c(7062, 303548, 3419, 114332, 30014, 59655, 2173, 24122, 51882, 111730,
               317527, 93551, 53009, 3542, 60760, 131222, 21156, 14625, 318, 237741,
               2301, 11675, 16356, 3076, 3951, 19867, 978, 934, 326, 259, 90, 601, 1452)
col_khong_hu_chu <- c(36, 984, 70, 3755, 1491, 663, 41, 596, 39790, 3389, 5334, 14723,
                      2995, 159, 6166, 3232, 427, 139, 91, 29737, 414, 236, 1080, 511,
                      141, 367, 48, 11, 35, 117, 212, 25, 76)
col_lainnya <- c(277, 5088, 493, 2088, 303, 164, 130, 664, 323, 198, 2410, 5657, 5657,
                 506, 2042, 11722, 282, 40, 81129, 2907, 138419, 16465, 849, 1363, 2575,
                 4731, 8, 18, 6535, 6278, 122, 0, 174)
col_tidak_terjawab <- c(1, 1760, 1930, 517, 313, 1928, 1538, 3442, 862, 620, 3133, 66868,
                        7, 4557, 45010, 16, 1, 30, 247, 671, 220, 3, 1951, 83, 638, 728,
                        1471, 205, 383, 0, 87, 341, 21)
col_tidak_ditanyakan <- c(20030, 50613, 9158, 14648, 13806, 15156, 3740, 17017, 3817,
                          3656, 30696, 59713, 84764, 4324, 264535, 27247, 5513, 3255,
                          9813, 10279, 4239, 12308, 15536, 6610, 11053, 12746, 4503, 668,
                          1057, 6583, 2417, 4266, 23352)

# verbatim category frame (source spelling), in the two product roles.
affiliation_cats <- c("Islam", "Kristen", "Katolik", "Hindu", "Budha", "Khong Hu Chu", "Lainnya")
residual_cats <- c("Tidak Terjawab", "Tidak Ditanyakan")
all_cats <- c(affiliation_cats, residual_cats)

# national column controls printed on the TOTAL row (fail-fast targets).
national_controls <- c(
  Islam = 207176162L, Kristen = 16528513L, Katolik = 6907873L, Hindu = 4012116L,
  Budha = 1703254L, `Khong Hu Chu` = 117091L, Lainnya = 299617L,
  `Tidak Terjawab` = 139582L, `Tidak Ditanyakan` = 757118L)
national_total <- 237641326L

# assemble the province-by-category matrix in canonical order.
n_prov <- length(prov_code)
cat_mat <- list(
  Islam = col_islam, Kristen = col_kristen, Katolik = col_katolik, Hindu = col_hindu,
  Budha = col_budha, `Khong Hu Chu` = col_khong_hu_chu, Lainnya = col_lainnya,
  `Tidak Terjawab` = col_tidak_terjawab, `Tidak Ditanyakan` = col_tidak_ditanyakan)
stopifnot(all(vapply(cat_mat, length, integer(1)) == n_prov),
          length(prov_name) == n_prov, length(prov_name_src) == n_prov,
          length(prov_total) == n_prov)

# ---- reconciliation gates (fail-fast; stop, do not tune) ------------------------
# integer full-count census table: reconcile exactly. every province row sums over the
# nine published columns to its printed Total; every category column sums over the 33
# provinces to its printed national control; the province totals sum to the national.
rec_records <- list()
for (i in seq_len(n_prov)) {
  row_sum <- sum(vapply(all_cats, function(c) cat_mat[[c]][i], numeric(1)))
  if (row_sum != prov_total[i]) {
    stop(sprintf("province row gate FAILED for %s: nine-column sum %d != printed Total %d",
                 prov_name_src[i], row_sum, prov_total[i]), call. = FALSE)
  }
  rec_records[[length(rec_records) + 1L]] <- data.frame(
    margin = "province_row", key = prov_name_src[i], computed = row_sum,
    printed = prov_total[i], difference = row_sum - prov_total[i], stringsAsFactors = FALSE)
}
for (c in all_cats) {
  col_sum <- sum(cat_mat[[c]])
  if (col_sum != national_controls[[c]]) {
    stop(sprintf("category-column gate FAILED for %s: 33-province sum %d != printed national %d",
                 c, col_sum, national_controls[[c]]), call. = FALSE)
  }
  rec_records[[length(rec_records) + 1L]] <- data.frame(
    margin = "religion_column", key = c, computed = col_sum,
    printed = national_controls[[c]], difference = col_sum - national_controls[[c]],
    stringsAsFactors = FALSE)
}
if (sum(prov_total) != national_total) {
  stop(sprintf("grand gate FAILED: province-total sum %d != printed national %d",
               sum(prov_total), national_total), call. = FALSE)
}
if (sum(national_controls) != national_total) {
  stop(sprintf("category-total gate FAILED: category sum %d != printed national %d",
               sum(national_controls), national_total), call. = FALSE)
}
reconciliation <- do.call(rbind, rec_records)
message(sprintf("gate SP2010: PASSED (integer-exact; both margins close to %d)", national_total))

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

required_inputs <- c(path_sp2010, boundary_path, boundary_meta_path)
invisible(lapply(required_inputs, require_file))

# confirm the pinned boundary licence, unit count, and type before use.
boundary_metadata <- fromJSON(boundary_meta_path, simplifyVector = FALSE)
if (!identical(boundary_metadata[["boundaryLicense"]], "Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO)") ||
    !identical(boundary_metadata[["admUnitCount"]], "34") ||
    !identical(boundary_metadata[["boundaryType"]], "ADM1")) {
  stop("geoBoundaries IDN ADM1 (gbHumanitarian) licence, unit count, or type metadata changed", call. = FALSE)
}
boundary_licence <- boundary_metadata[["boundaryLicense"]]

# Indonesia-centred equal-area projection for land areas (spans ~95E-141E; no dateline).
id_laea <- "+proj=laea +lat_0=-2 +lon_0=118 +datum=WGS84 +units=m +no_defs"

# map each of the 34 boundary shapeName values to a census province (by uppercased
# name), dissolving Kalimantan Utara into Kalimantan Timur (the only post-2010 split
# affecting the 2010 frame: North Kalimantan was carved wholly out of East Kalimantan
# in 2012, so their union reconstructs the single 2010 province). this is a complete-
# unit aggregation, never an invented concordance.
boundary_to_census <- c(
  "ACEH" = "NANGGROE ACEH DARUSSALAM",
  "DKI JAKARTA" = "DKI JAKARTA",
  "DAERAH ISTIMEWA YOGYAKARTA" = "DI YOGYAKARTA",
  "KALIMANTAN UTARA" = "KALIMANTAN TIMUR")

build_boundary <- function(path) {
  boundary <- st_make_valid(st_read(path, quiet = TRUE, stringsAsFactors = FALSE))
  if (nrow(boundary) != 34L) stop("geoBoundaries IDN ADM1 feature count is not 34", call. = FALSE)
  bn <- toupper(trimws(boundary[["shapeName"]]))
  mapped <- ifelse(bn %in% names(boundary_to_census), boundary_to_census[bn], bn)
  if (!setequal(unique(mapped), prov_name_src)) {
    stop("boundary provinces do not map onto the 33 census provinces after the crosswalk", call. = FALSE)
  }
  # dissolve to the 33 census provinces (union of member polygons per census province).
  parts_list <- lapply(seq_len(n_prov), function(k) {
    pn <- prov_name_src[k]
    g <- st_make_valid(st_union(st_geometry(boundary)[mapped == pn]))
    st_sf(area_code = paste0("id", prov_code[k]), area_name = prov_name[k],
          census_name = pn, prov_code = prov_code[k],
          boundary_set_id = boundary_set_id, boundary_level = boundary_level,
          boundary_vintage = boundary_vintage, geometry = g)
  })
  out <- do.call(rbind, parts_list)
  out[["area_unit_id"]] <- paste(boundary_set_id, out[["area_code"]], sep = ":")
  out[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(out, id_laea))) / 1e6
  st_transform(st_make_valid(out), 4326)
}

boundary <- build_boundary(boundary_path)
if (nrow(boundary) != 33L) stop("dissolved boundary does not contain 33 provinces", call. = FALSE)

# full-extent gate: Indonesia spans lon ~95E to ~141E and lat ~6N to ~11S; no dateline.
bbox <- st_bbox(boundary)
if (bbox[["xmin"]] < 94 || bbox[["xmin"]] > 96 ||
    bbox[["xmax"]] < 140 || bbox[["xmax"]] > 142 ||
    bbox[["ymin"]] < -12 || bbox[["ymin"]] > -10 ||
    bbox[["ymax"]] < 5 || bbox[["ymax"]] > 7) {
  stop("boundary bbox does not match the expected Indonesia extent", call. = FALSE)
}

simplification <- mapshaper_simplify_to_cap(
  boundary, boundary_out,
  max_bytes = 1600000L,
  keep_percentages = c(10, 5, 3, 2, 1, 0.5, 0.3, 0.2, 0.1),
  clean_option = "allow-overlaps")
written <- st_read(boundary_out, quiet = TRUE, stringsAsFactors = FALSE)
written <- written[match(boundary[["area_code"]], written[["area_code"]]), ]
if (anyNA(written[["area_code"]])) stop("simplified boundary lost an area code", call. = FALSE)
if (nrow(written) != 33L) stop("simplified boundary does not contain 33 features", call. = FALSE)
w_valid <- st_is_valid(written)
if (any(st_is_empty(written)) || any(is.na(w_valid)) || any(!w_valid)) {
  stop("simplified boundary has empty or invalid geometries", call. = FALSE)
}
geom_hashes <- geometry_hashes(written)
if (length(unique(geom_hashes)) != 33L) stop("simplified boundary geometry hashes are not distinct", call. = FALSE)
message(sprintf("boundary: PASSED (33 valid distinct features, %d bytes at %g%% keep)",
                file_bytes(boundary_out), simplification[["keep_percent"]]))

land_area <- setNames(round(written[["land_area_sq_km"]], 4), written[["area_code"]])
area_unit <- setNames(written[["area_unit_id"]], written[["area_code"]])

# ---- product rows --------------------------------------------------------------
# slot design: the Indonesian official frame has NO no-religion category (all seven
# lines are religions; Lainnya is other religions/beliefs). religious_affiliation is
# the sum of the seven religion lines; no_religion is null (rendered, not invented).
# the two non-response residuals (Tidak Terjawab = not answered, Tidak Ditanyakan =
# not asked) stay in the denominator (the published Total) and in neither slot, so the
# affiliation share sits just below 100. the rich per-province composition rides
# verbatim on the quality flag (source_categories_verbatim pattern).

flag_common <- paste(
  "census_affiliation", "all_persons_universe", "single_select_reported_religion",
  "official_frame_has_no_no_religion_category",
  "no_religion_slot_null_not_invented",
  "religious_affiliation_percent_is_seven_religion_share",
  "non_response_residual_tidak_terjawab_and_tidak_ditanyakan_in_denominator_neither_slot",
  "affiliation_share_sits_below_100_by_the_residual",
  "single_wave_sp2010_sp2020_dropped_religion",
  "dukcapil_2020plus_is_separate_administrative_construct_not_merged",
  "licence_needs_review_build_then_ask_bps_attribution",
  "boundary_cc_by_3_0_igo",
  "kalimantan_utara_dissolved_into_kalimantan_timur_2010_frame",
  sep = ";")

basis_pop <- paste(
  "BPS Sensus Penduduk 2010, 'Penduduk Menurut Wilayah dan Agama yang Dianut';",
  "the denominator is the printed province Total (all persons of all ages, including",
  "the Tidak Terjawab and Tidak Ditanyakan residual columns).")

make_row <- function(i) {
  code <- prov_code[i]
  ac <- paste0("id", code)
  pop <- prov_total[i]
  affiliation <- sum(vapply(affiliation_cats, function(c) cat_mat[[c]][i], numeric(1)))
  aff_pct <- round(100 * affiliation / pop, 4)
  breakdown <- paste(vapply(all_cats, function(c) paste0(c, "=", cat_mat[[c]][i]), character(1)),
                     collapse = ";")
  full_flag <- paste0(flag_common, ";bps_province_code=", code,
                      ";census_name=", prov_name_src[i],
                      ";source_categories_verbatim=", breakdown)
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = unname(area_unit[[ac]]),
    area_code = ac,
    area_name = prov_name[i],
    year = 2010L,
    population_total = as.integer(pop),
    population_total_basis = basis_pop,
    religious_affiliation_count = as.integer(affiliation),
    religious_affiliation_percent = aff_pct,
    no_religion_count = NULL,
    no_religion_percent = NULL,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = unname(land_area[[ac]]),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(d_sp2010, d_boundary),
    quality_flag = full_flag)
}

rows <- lapply(seq_len(n_prov), make_row)

# ---- area-summary document -----------------------------------------------------

licence_pending <- paste(
  "No open-data licence is stated on the BPS Sensus Penduduk 2010 source. The",
  "sensus.bps.go.id page footer asserts 'Copyright (c) 2026 - Badan Pusat Statistik |",
  "Sensus Penduduk 2010' (retrieved 2026-07-12, byte-matched in the cached HTML), a",
  "copyright assertion with no reuse grant. The main bps.go.id term-of-use page sits",
  "behind a Cloudflare human-verification challenge that this lane does not complete",
  "(recorded gap). The derived province summaries carry attribution to Badan Pusat",
  "Statistik (BPS) and ship STAGED under the BUILD-THEN-ASK ruling (summaries-with-",
  "attribution stance, RO/SK/CI/MONSTAT line); a BPS reuse-confirmation ask is the",
  "clean courtesy unblock. The boundary is CC BY 3.0 IGO.")

source_datasets <- function() {
  list(
    list(
      source_dataset_id = d_sp2010,
      name = "Indonesia SP2010 (Sensus Penduduk 2010): Penduduk Menurut Wilayah dan Agama yang Dianut (population by region and religion)",
      provider = "Badan Pusat Statistik (BPS - Statistics Indonesia)",
      url = url_sp2010, retrieval_date = retrieval_date, local_path = path_sp2010,
      licence = list(name = licence_pending, url = bps_home_url,
                     attribution = "Badan Pusat Statistik (BPS), Sensus Penduduk 2010"),
      citation = "Badan Pusat Statistik, Sensus Penduduk 2010, Penduduk Menurut Wilayah dan Agama yang Dianut.",
      access_limits = NULL,
      redistribution_limits = "Derived province summaries only; no open-data licence is stated on the BPS source. Ships STAGED under BUILD-THEN-ASK with attribution.",
      notes = paste("Integer full-count census table; verbatim ten-column frame (Islam, Kristen, Katolik, Hindu, Budha,",
                    "Khong Hu Chu, Lainnya, Tidak Terjawab, Tidak Ditanyakan, Total). Both margins close exactly: every province",
                    "row sums over the nine category columns to its printed Total, and every category column sums over the 33",
                    "provinces to its printed national control; national Total 237,641,326.")),
    list(
      source_dataset_id = d_boundary,
      name = "geoBoundaries IDN ADM1 (gbHumanitarian): 34 provinces",
      provider = "geoBoundaries (William & Mary geoLab); boundary source OCHA ROAP / HDX (COD-AB, BPS lineage)",
      url = boundary_url, retrieval_date = retrieval_date, local_path = boundary_path,
      licence = list(name = boundary_licence, url = boundary_meta_url,
                     attribution = "geoBoundaries gbHumanitarian; boundary source OCHA Regional Office for Asia and the Pacific (COD-AB)"),
      citation = "geoBoundaries IDN ADM1 (gbHumanitarian, pinned 9469f09), 34 province boundaries, dissolved to the 33-unit 2010 census frame.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary is committed under CC BY 3.0 IGO (attribution to geoBoundaries / OCHA COD-AB).",
      notes = paste("34 ADM1 provinces, boundaryYearRepresented 2019. Kalimantan Utara (created 2012) is dissolved into Kalimantan",
                    "Timur to reconstruct the single 2010 province, giving 33 units that join the SP2010 frame one-to-one after a",
                    "three-name crosswalk (Aceh, DKI Jakarta, Daerah Istimewa Yogyakarta). The extent spans lon ~95-141E, lat ~6N-11S,",
                    "far from the antimeridian; no dateline handling needed."))
  )
}

indicators <- function() {
  denom_note <- paste(
    "Percentages use each province's published census Total. The two non-response",
    "columns (Tidak Terjawab = not answered; Tidak Ditanyakan = not asked) stay in the",
    "denominator and outside the affiliation numerator, so the affiliation share sits",
    "just below 100%.")
  list(
    list(indicator_id = "population_total", label = "Census population total",
         description = "Province all-persons population in the SP2010 religion table.",
         unit = "count", denominator_indicator_id = NULL,
         method = "Printed province Total column, SP2010 'Penduduk Menurut Wilayah dan Agama yang Dianut'.",
         temporal_coverage = "2010", spatial_coverage = "Indonesia provinces (33, 2010 frame)",
         quality_notes = "All persons of all ages. The Total includes the Tidak Terjawab (not answered) and Tidak Ditanyakan (not asked) residual columns, kept as published."),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
         description = "Share of the province population reporting one of the seven official religions.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (Islam + Kristen + Katolik + Hindu + Budha + Khong Hu Chu + Lainnya) / Total.",
         temporal_coverage = "2010", spatial_coverage = "Indonesia provinces (33, 2010 frame)",
         quality_notes = paste("The Indonesian official frame has no no-religion category, so the no-religion slot is null (rendered, not invented) and the affiliation share is high everywhere (the residual is the non-response columns). The map-worthy signal is the religious COMPOSITION across provinces (Islam-dominant west; Protestant/Catholic Nusa Tenggara Timur, Papua, Papua Barat, Sulawesi Utara, Maluku; Hindu Bali), carried verbatim on each row's quality flag.", denom_note))
  )
}

visual_layers <- function() {
  list(
    list(visual_layer_id = "id-province-religious-affiliation", label = "Religious affiliation %",
         description = "Indonesia SP2010 census-affiliation share by province.", layer_type = "choropleth",
         indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "province census Total, including a non-response residual"),
         colour_scale = "sequential", time_control = "none",
         aggregation_rule = "reported province value", uncertainty_display = "quality_flag",
         default_visibility = TRUE,
         notes = "Census affiliation, not practice, attendance, or membership. Single wave (SP2010). The seven-religion composition rides verbatim on each row's quality flag; a dominant-religion / composition view is downstream page design.")
  )
}

summary_product <- list(
  schema_version = "area-summary.v1", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code,
                      level = boundary_level, vintage = boundary_vintage, source_dataset_id = d_boundary),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "No governed place-of-worship snapshot ships in the Indonesia census product.",
                       notes = "Place counts and density metrics remain null."),
  source_datasets = source_datasets(), indicators = indicators(),
  visual_layers = visual_layers(), rows = rows)

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
      no_religion_count = NA_integer_, no_religion_percent = NA_real_,
      place_count = NA_integer_, places_per_10000_residents = NA_real_,
      place_density_per_sq_km = NA_real_, land_area_sq_km = r[["land_area_sq_km"]],
      site_snapshot_date = NA_character_, place_count_basis = NA_character_,
      source_dataset_ids = paste(unlist(r[["source_dataset_ids"]]), collapse = "|"),
      quality_flag = r[["quality_flag"]], stringsAsFactors = FALSE)
  }))
}
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

# ---- manifest ------------------------------------------------------------------

raw_source_record <- function(path, url, format, used, periods, dataset_id, notes) {
  list(uri = path, url = url, format = format, bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = NULL, source_dataset_id = dataset_id, used_in_public_product = used,
       periods = periods, notes = notes,
       local_cache_hint = paste0(path, " (git-ignored by .gitignore data/ rule)"),
       raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/id_census/"))
}

durable_file_record <- function(path, content, licence_status_value, licence_basis_value) {
  list(uri = paste0("repo:", path), storage_provider = "git_repository", format = sub("^.*\\.", "", path),
       bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = if (grepl("area_summary|\\.csv$", path)) row_count_file(path) else NULL,
       feature_count = if (grepl("\\.geojson$", path)) row_count_file(path) else NULL,
       content = content, privacy = "public",
       licence_status = licence_status_value, licence_basis = licence_basis_value)
}

licence_basis_slug <- "bps_copyright_attribution_build_then_ask"

raw_sources <- list(
  raw_source_record(path_sp2010, url_sp2010, "html", TRUE, "2010", d_sp2010,
    "SP2010 religion-by-province table (server-rendered HTML). Ten-column verbatim frame; both margins close to 237,641,326."),
  raw_source_record(boundary_path, boundary_url, "geojson", TRUE, "2019", d_boundary,
    "geoBoundaries IDN ADM1 (gbHumanitarian) GeoJSON; 34 provinces, CC BY 3.0 IGO (OCHA COD-AB lineage). Pinned commit 9469f09."),
  raw_source_record(boundary_meta_path, boundary_meta_url, "json", FALSE, "2019", d_boundary,
    "geoBoundaries IDN ADM1 (gbHumanitarian) metadata; records CC BY 3.0 IGO, boundaryYearRepresented 2019, admUnitCount 34."))

dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)
dataset_id <- "id-census-religion:id:2010:bps-province"

reconciliation_block <- function(rec) lapply(seq_len(nrow(rec)), function(i) as.list(rec[i, ]))

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = paste0("manifest:", dataset_id),
  dataset_id = dataset_id,
  dataset_version_id = paste0(dataset_id, ":", dataset_hash),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "id-census-religion", dataset_role = "staged_evidence",
  scope = list(level = "country", country_codes = list("ID"), snapshot_date = NULL,
               snapshot_anchor = NULL, pipeline_stage = "staged"),
  created_at = stamp, created_by = script_id,
  target_years = list(2010L),
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation",
      shipped_waves = list(2010L),
      shipped_geography = "33 Indonesia provinces (2010 census frame)",
      boundary_set = boundary_set_id,
      source_tables = list(
        `2010` = "SP2010 'Penduduk Menurut Wilayah dan Agama yang Dianut' (religion by province), integer full-count, ten-column frame"),
      universe = "all persons of all ages; the Total includes Tidak Terjawab (not answered) and Tidak Ditanyakan (not asked)",
      premise_corrections = paste(
        "The queue row implied a 2010-2024 multi-wave kabupaten/kota product. The record refutes both the span and the",
        "grain for a clean census build. First, SP2020 dropped the religion question (pandemic short form), so census",
        "affiliation has a single modern wave with a published subnational religion table: SP2010. Second, 2020+ subnational",
        "religion figures come from Dukcapil (Ministry of Home Affairs civil registration) - administrative registration, a",
        "DIFFERENT construct, kept out of this census product and never merged. Third, the kabupaten/kota grain is data-",
        "available in SP2010 but boundary-blocked: the open licensed ADM2 layers are the 2020 (519-unit) frame, while SP2010",
        "used the ~497-unit 2010 frame, and mapping across the 2010-2020 kabupaten splits would require an invented",
        "concordance (forbidden). The province product ships; kabupaten is the documented deeper route."),
      slot_design = paste(
        "The Indonesian official frame has NO no-religion category: all seven lines (Islam, Kristen, Katolik, Hindu, Budha,",
        "Khong Hu Chu, Lainnya) are religions and Lainnya is other religions/beliefs. religious_affiliation_percent is the",
        "seven-religion share of the published Total; no_religion is null (rendered, not invented). The two non-response",
        "columns (Tidak Terjawab, Tidak Ditanyakan) stay in the denominator and in neither slot, so the affiliation share",
        "sits just below 100 (the FJ/SB/BZ unallocated-residual precedent). The seven-religion composition - the real signal",
        "- rides verbatim on each row's quality flag."),
      category_frame = as.list(all_cats),
      category_frame_note = paste(
        "Verbatim BPS spelling preserved: 'Budha' (not Buddha), 'Khong Hu Chu' (not Khong Hu Cu), 'Lainnya' (Other),",
        "'Tidak Terjawab' (not answered), 'Tidak Ditanyakan' (not asked). No category is merged, redistributed, or backcast."),
      no_religion_treatment = "null in every row: the official Indonesian religion frame has no no-religion / atheist category. Not invented.",
      residual_treatment = paste(
        "Tidak Terjawab (not answered; national 139,582) and Tidak Ditanyakan (not asked; national 757,118) are kept as",
        "published, in each province's Total denominator, and excluded from the affiliation numerator - disclosed, never repaired."),
      change_rule = "Single wave (SP2010); no cross-wave change. SP2020 religion is absent; Dukcapil 2020+ is a separate construct, not a comparison wave.",
      dukcapil_note = paste(
        "The Ditjen Dukcapil (Kemendagri) civil-registration data publishes religion by province and kabupaten/kota",
        "semi-annually from ~2020 (e.g., semester I 2024). It is administrative registration, not census self-report - a",
        "separate construct recorded as a future separate-construct option, never merged into this census product."),
      held_and_deferred = paste(
        "Kabupaten/kota SP2010 religion (the 33 province drill-downs, ~497 units) is data-available via the same BPS route",
        "but boundary-blocked (no open licensed 2010-vintage ADM2 layer; the 2020 519-unit frame needs an invented split",
        "concordance). SP2000 and earlier census waves (province religion appears in provincial BPS tables, e.g., Bali",
        "1971/2000/2010) are a deeper-history route needing province-by-province national assembly across changing province",
        "frames. Both HELD, no backcast."),
      omitted_metrics = list("no_religion_percent", "places_per_10000_residents", "place_density_per_sq_km"),
      boundary_simplification = simplification,
      local_cache_hint = "All raw sources are cached under data/raw/id_census/ and remain git-ignored.",
      retrieval_record = raw_sources),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")), digest = as.character(packageVersion("digest")),
      mapshaper = "scripts/lib/simplify_boundary.R (npx mapshaper)")),
  source = list(
    provider = "Badan Pusat Statistik (BPS - Statistics Indonesia); geoBoundaries (William & Mary geoLab) / OCHA COD-AB",
    source_dataset_ids = list(d_sp2010, d_boundary),
    source_urls = list(url_sp2010, boundary_url, boundary_meta_url),
    retrieved_at = stamp,
    licence = licence_pending,
    citation = "BPS Sensus Penduduk 2010, Penduduk Menurut Wilayah dan Agama yang Dianut; geoBoundaries IDN ADM1 (gbHumanitarian, OCHA COD-AB).",
    raw_redistribution = "The SP2010 source HTML and the geoBoundaries source GeoJSON are not committed; they remain in data/raw/id_census/.",
    local_cache_hint = "data/raw/id_census/ (git-ignored by .gitignore data/ rule)",
    raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/id_census/")),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = list(
    durable_file_record(summary_json_out, "Indonesia 33-province SP2010 census-affiliation area summary (single wave, 2010).", "needs_review", licence_basis_slug),
    durable_file_record(summary_csv_out, "Flattened Indonesia 33-province SP2010 census-affiliation rows (2010).", "needs_review", licence_basis_slug),
    durable_file_record(boundary_out, "Simplified geoBoundaries IDN ADM1 boundary dissolved to the 33-province 2010 frame.", "accepted", "geoboundaries_cc_by_3_0_igo")),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id,
         notes = "33 provinces x 1 wave = 33 rows; all-persons universe; no no-religion category in the official frame (null); non-response residual disclosed in the denominator."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out), built_by = script_id,
         notes = "33 province features from geoBoundaries IDN ADM1 (gbHumanitarian), Kalimantan Utara dissolved into Kalimantan Timur, simplified with mapshaper weighted keep-shapes.")),
  validation = list(
    status = "passed_with_warnings",
    commands = list(
      paste("Rscript", script_id),
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/id/data/area_summary_province.json",
      "bash scripts/validate_manifests.sh"),
    gate_sp2010 = list(status = "passed", both_margins_close_to = national_total,
                       province_row_checks = n_prov, religion_column_checks = length(all_cats),
                       records = reconciliation_block(reconciliation)),
    boundary_validation = list(status = "passed", feature_count = 33L,
                               distinct_geometry_hashes = length(unique(geom_hashes)),
                               geometry_hashes = as.list(geom_hashes),
                               bbox = list(xmin = unname(bbox[["xmin"]]), ymin = unname(bbox[["ymin"]]),
                                           xmax = unname(bbox[["xmax"]]), ymax = unname(bbox[["ymax"]])),
                               dateline_note = "extent lon ~95-141E, lat ~6N-11S; far from the antimeridian, no dateline handling needed",
                               output_bytes = file_bytes(boundary_out), simplification = simplification,
                               licence = boundary_licence, adm_unit_count = boundary_metadata[["admUnitCount"]],
                               dissolve_note = "34 boundary provinces dissolved to 33 census provinces: Kalimantan Utara (created 2012) united into Kalimantan Timur to reconstruct the 2010 province."),
    join_coverage = list(matched_provinces = 33L, expected_provinces = 33L, unmatched_provinces = list(), unused_boundary_features = list()),
    notes = paste(
      "SP2010 religion-by-province closes integer-exact at both margins (national 237,641,326): every province row sums over",
      "the nine category columns to its printed Total, and every category column sums over the 33 provinces to its printed",
      "national control. Boundary joins 34->33 to geoBoundaries IDN ADM1 (gbHumanitarian) with 33 distinct geometry hashes."),
    warnings = list(
      "STAGED product: no page, no hub link. Licence needs review; ships under BUILD-THEN-ASK with attribution to BPS (copyright-only source; bps.go.id term-of-use behind an uncompleted Cloudflare challenge).",
      "Single wave (SP2010). The queue's 2010-2024 multi-wave premise is refuted: SP2020 dropped the religion question, and 2020+ subnational religion is Dukcapil administrative registration (a separate construct, not merged).",
      "The official Indonesian religion frame has no no-religion category, so no_religion is null (rendered, not invented) and the affiliation share is high-and-flat; the seven-religion composition is the signal, carried verbatim on the quality flag.",
      "The two non-response columns (Tidak Terjawab, Tidak Ditanyakan) are kept as published in the Total denominator, disclosed, never repaired.",
      "Kabupaten/kota SP2010 religion is data-available but boundary-blocked (no open licensed 2010-vintage ADM2 layer); HELD as the documented deeper route.")),
  construct_notes = list(
    "The construct is census affiliation: each resident's reported religion in the SP2010 census, asked of the whole resident population, not practice, attendance, or membership.",
    "The public product carries two headline fields per province: population total and religious affiliation percent. No-religion is null (the official Indonesian frame has no no-religion category); place-density metrics are null (no governed place-of-worship snapshot).",
    "Single wave: SP2020 dropped the religion question, so there is no comparable 2020 census religion table. 2020+ subnational religion is Dukcapil (civil-registration) administrative data - a separate construct recorded as a future option, never merged.",
    "The seven official religions (Islam, Kristen, Katolik, Hindu, Budha, Khong Hu Chu, Lainnya) partition the affiliation numerator; the composition across provinces (Islam-dominant west; Protestant/Catholic Nusa Tenggara Timur, Papua, Papua Barat, Sulawesi Utara, Maluku; Hindu Bali) is the map-worthy signal and rides verbatim on each row's quality flag.",
    "The two non-response columns (Tidak Terjawab = not answered, national 139,582; Tidak Ditanyakan = not asked, national 757,118) are kept as published in each province's Total denominator, in neither slot, so the affiliation share sits just below 100. Disclosed, never repaired.",
    "Boundary: geoBoundaries IDN ADM1 (gbHumanitarian), 34 provinces, CC BY 3.0 IGO (OCHA COD-AB, BPS lineage). Kalimantan Utara (created 2012) is dissolved into Kalimantan Timur to reconstruct the single 2010 province; the remaining provinces join by name after a three-name crosswalk. This is a complete-unit aggregation, never an invented concordance."),
  deferred_sources = list(
    list(source_dataset_id = "id-sp2010-religion-by-kabupaten", status = "deferred",
         url = "https://sensus.bps.go.id/topik/tabular/sp2010/12", local_path = NULL,
         notes = "SP2010 religion by kabupaten/kota (~497 units) is data-available via the 33 province drill-downs but boundary-blocked: the open licensed ADM2 layers are the 2020 519-unit frame, and mapping across the 2010-2020 kabupaten splits needs an invented concordance (forbidden). Deeper route pending a licensed 2010-vintage ADM2 layer."),
    list(source_dataset_id = "id-dukcapil-religion-administrative", status = "separate_construct",
         url = "https://gis.dukcapil.kemendagri.go.id/peta/", local_path = NULL,
         notes = "Ditjen Dukcapil (Kemendagri) civil-registration religion by province and kabupaten/kota, semi-annual from ~2020. Administrative registration, NOT census self-report - a separate construct recorded as a future option, never merged into this census product."),
    list(source_dataset_id = "bps-licence-confirmation", status = "not_pinned",
         url = bps_home_url, local_path = NULL,
         notes = "A BPS reuse-confirmation ask is the clean courtesy unblock under BUILD-THEN-ASK; none is held. The bps.go.id term-of-use page is behind an uncompleted Cloudflare human-verification challenge (recorded gap).")),
  privacy = "public",
  licence_status = "needs_review",
  licence_basis = licence_basis_slug,
  downstream_status = "staged",
  source_datasets = source_datasets(),
  notes = paste(
    "STAGED product (no page, no hub link). The committed products are the derived 33-province area summary (33 rows,",
    "SP2010) and the simplified geoBoundaries IDN ADM1 (gbHumanitarian) boundary dissolved to the 2010 frame. Ships under",
    "BUILD-THEN-ASK with attribution to Badan Pusat Statistik (BPS) and geoBoundaries / OCHA COD-AB (CC BY 3.0 IGO)."))

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

cat("wave shipped: 2010 (SP2010) on 33 Indonesia provinces\n")
cat(sprintf("rows: %d (33 provinces x 1 wave)\n", length(rows)))
cat(sprintf("gate SP2010: passed integer-exact; both margins close to %d\n", national_total))
cat(sprintf("boundary gate: passed; 34->33 dissolve, %d distinct geometry hashes, %d bytes at %g%% keep\n",
            length(unique(geom_hashes)), file_bytes(boundary_out), simplification[["keep_percent"]]))
cat("licence gate: needs_review; STAGED under BUILD-THEN-ASK with BPS attribution\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", boundary_out))
cat(sprintf("wrote %s\n", manifest_out))
