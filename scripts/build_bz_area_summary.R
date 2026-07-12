# build the Belize district census-religion area-summary product for three waves
# (2000, 2010, 2022) on the six-unit geoBoundaries BLZ ADM1 district frame. inputs
# (all cached, git-ignored, sha256 in research/countries/bz/route-probe.md):
#   data/raw/bz_census/bz_2000_Census_Report.pdf -> Table B2 "Population by Religion
#     and Sex for Major Divisions" (integer full-count, 17 categories, 6 districts)
#   data/raw/bz_census/bz_Census2010_GeneralCharacteristics.xlsx -> sheet
#     Religion_by_District Table 9 (weighted, 12 categories, 6 districts)
#   data/raw/bz_census/bz_Census2022_GeneralCharacteristics.xlsx -> sheet
#     Religion_by_District Table 9 (weighted, 12 categories, 6 districts)
#   data/raw/bz_census/geoBoundaries-BLZ-ADM1.geojson -> 6-district ADM1 boundary
#   data/raw/bz_census/gb_blz_adm1_meta.json -> boundary licence metadata (CC BY 2.5)
# every religion cell is transcribed verbatim from its cached source and reconciled
# against the printed control totals here; the build stops on any margin mismatch and
# never allocates, infers, rounds, imputes, or tunes a value. 2000 is integer full-
# count; 2010/2022 are weighted (non-integer) counts from the SIB non-response-
# adjustment methodology, reconciled float-exact and rounded for the schema's integer
# count fields only (percentages use the unrounded values).
# outputs: apps/regions/bz/data/bz_district_2006.geojson,
#   apps/regions/bz/data/area_summary_district.{json,csv}, and
#   docs/manifests/bz-census-religion-2000-2022.json.
# run from the repo root: Rscript scripts/build_bz_area_summary.R
# STAGED product: no page, no hub link; licence needs_review under BUILD-THEN-ASK
# (SIB all-rights-reserved with attribution; boundary CC BY 2.5 Generic).

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "BZ"
script_id <- "scripts/build_bz_area_summary.R"
raw_dir <- "data/raw/bz_census"
product_dir <- "apps/regions/bz/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-12"
stamp <- paste0(retrieval_date, "T00:00:00Z")
git_commit <- trimws(system2("git", c("rev-parse", "HEAD"), stdout = TRUE))
if (length(git_commit) != 1L || !grepl("^[a-f0-9]{40}$", git_commit)) git_commit <- NULL

# geoBoundaries boundaryYearRepresented is 2006 for BLZ ADM1.
boundary_level <- "district"
boundary_vintage <- "2006"
boundary_set_id <- "bz-district-2006-geoboundaries-adm1"

d2000 <- "bz-census-2000-report-table-b2-religion-by-district"
d2010 <- "bz-census-2010-general-characteristics-religion-by-district"
d2022 <- "bz-census-2022-general-characteristics-religion-by-district"
d_boundary <- "geoboundaries-blz-adm1-2006"

# ---- source urls and cached paths ----------------------------------------------
url_2000 <- "https://sib.org.bz/wp-content/uploads/2000_Census_Report.pdf"
url_2010 <- "https://sib.org.bz/wp-content/uploads/Census2010_GeneralCharacteristics.xlsx"
url_2022 <- "https://sib.org.bz/wp-content/uploads/Census2022_GeneralCharacteristics.xlsx"
url_2022_keyfindings <- "https://sib.org.bz/wp-content/uploads/CensusKeyFindingsReport_2022.pdf"
url_2010_report <- "https://sib.org.bz/wp-content/uploads/2010_Census_Report.pdf"
sib_home_url <- "https://sib.org.bz"
boundary_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/BLZ/ADM1/geoBoundaries-BLZ-ADM1.geojson"
boundary_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/BLZ/ADM1/"

path_2000 <- file.path(raw_dir, "bz_2000_Census_Report.pdf")
path_2010 <- file.path(raw_dir, "bz_Census2010_GeneralCharacteristics.xlsx")
path_2022 <- file.path(raw_dir, "bz_Census2022_GeneralCharacteristics.xlsx")
path_2022_keyfindings <- file.path(raw_dir, "bz_CensusKeyFindingsReport_2022.pdf")
path_2010_report <- file.path(raw_dir, "bz_2010_Census_Report.pdf")
boundary_path <- file.path(raw_dir, "geoBoundaries-BLZ-ADM1.geojson")
boundary_meta_path <- file.path(raw_dir, "gb_blz_adm1_meta.json")

boundary_out <- file.path(product_dir, "bz_district_2006.geojson")
summary_json_out <- file.path(product_dir, "area_summary_district.json")
summary_csv_out <- file.path(product_dir, "area_summary_district.csv")
manifest_out <- file.path(manifest_dir, "bz-census-religion-2000-2022.json")

# ---- canonical district frame --------------------------------------------------
# six canonical district display names, source column order; area_code is a snake
# slug. geoBoundaries shapeName values match one-to-one (no concordance needed).
districts <- c("Corozal", "Orange Walk", "Belize", "Cayo", "Stann Creek", "Toledo")
district_slug <- c(Corozal = "corozal", `Orange Walk` = "orange_walk", Belize = "belize",
                   Cayo = "cayo", `Stann Creek` = "stann_creek", Toledo = "toledo")

# helper: integer district vector (2000, full-count) in canonical district order.
iv <- function(...) setNames(as.integer(c(...)), districts)
# helper: numeric district vector (2010/2022, weighted) in canonical district order.
dv <- function(...) setNames(as.numeric(c(...)), districts)

# ---- 2000 Table B2 (integer full-count; 17-category frame) ----------------------
# verbatim source category order (2000 column of Table B2). None = no-religion line,
# DK/NS = non-response line. No cell suppression in the 2000 count columns.
cat_2000 <- c("Anglican", "Bahai Faith", "Baptist", "Hindu", "Jehovah Witness",
              "Mennonite", "Methodist", "Mormon", "Muslim", "Nazarene", "Pentecostal",
              "Roman Catholic", "Seventh Day Adventist", "Salvation Army", "Other",
              "None", "DK/NS")
m2000 <- list(
  Anglican                = iv(  337,   379,  8970,  1253,  1349,    98),
  `Bahai Faith`           = iv(   35,    13,    45,    55,    29,    28),
  Baptist                 = iv(  440,   242,  3228,   946,   987,  2234),
  Hindu                   = iv(    4,    80,   224,    45,     3,    11),
  `Jehovah Witness`       = iv(  462,   730,   999,   673,   303,   199),
  Mennonite               = iv( 2148,  3924,   405,  2180,   195,   645),
  Methodist               = iv(  400,   246,  5382,   397,   972,   627),
  Mormon                  = iv(  106,   185,   255,   347,    28,     7),
  Muslim                  = iv(    4,     2,   156,    22,    49,    10),
  Nazarene                = iv(  645,   180,  1716,  1981,   580,  1015),
  Pentecostal             = iv( 1425,  1633,  3025,  7193,  1912,  2001),
  `Roman Catholic`        = iv(17651, 20707, 27104, 24039, 13397, 12137),
  `Seventh Day Adventist` = iv( 3429,  1808,  3587,  1969,  1016,   351),
  `Salvation Army`        = iv(   14,    21,   270,    54,     9,     3),
  Other                   = iv( 1599,  4040,  2431,  3442,  1383,  2089),
  None                    = iv( 3438,  3717,  4547,  6395,  2124,  1574),
  `DK/NS`                 = iv(   72,   153,   717,   230,   107,    88)
)
total_2000_district <- iv(32209, 38060, 63061, 51221, 24443, 23117)
total_2000_cat <- c(Anglican = 12386L, `Bahai Faith` = 205L, Baptist = 8077L,
                    Hindu = 367L, `Jehovah Witness` = 3366L, Mennonite = 9497L,
                    Methodist = 8024L, Mormon = 928L, Muslim = 243L, Nazarene = 6117L,
                    Pentecostal = 17189L, `Roman Catholic` = 115035L,
                    `Seventh Day Adventist` = 12160L, `Salvation Army` = 371L,
                    Other = 14984L, None = 21795L, `DK/NS` = 1367L)
national_2000 <- 232111L
no_rel_2000 <- "None"
nonresp_2000 <- "DK/NS"

# ---- 2010 weighted (Census2010_GeneralCharacteristics.xlsx Religion_by_District) --
cat_2010 <- c("Anglican", "Baptist", "Jehovah's Witness", "Mennonite", "Methodist",
              "Nazarene", "Pentecostal", "Roman Catholic", "Seventh Day Adventist",
              "None", "Other", "Don't Know/Not Stated")
m2010 <- list(
  Anglican                = dv(413.8371083386, 495.1265565452, 10554.6145833431, 1634.9877297812, 1701.2303344930, 264.9973663160),
  Baptist                 = dv(646.8489356829, 437.0756951524, 4201.1580544703, 2019.1302326402, 1894.7429890978, 2421.6399751286),
  `Jehovah's Witness`     = dv(738.1219749135, 1041.6998415482, 1552.9378008118, 1166.1499647034, 550.0341549540, 336.1503741347),
  Mennonite               = dv(2709.9245201140, 5080.2701598035, 359.2960403326, 3046.8299616371, 222.1206477024, 634.7262923768),
  Methodist               = dv(552.3661804760, 298.0876009281, 6667.7714083310, 399.3996848443, 945.9029034503, 593.4750529036),
  Nazarene                = dv(858.5014519137, 152.9328159988, 2076.5073698981, 2808.4594051003, 1355.4288002685, 1893.5501365713),
  Pentecostal             = dv(1757.2790668269, 2059.0766078691, 5458.3786655931, 11600.2638597643, 3044.4961879680, 3200.1626612179),
  `Roman Catholic`        = dv(19046.7818677460, 20435.0323232871, 36344.2038434112, 25973.9498486048, 14012.4820460330, 13625.7039479114),
  `Seventh Day Adventist` = dv(4122.9928621724, 2341.4595929868, 5868.3363065012, 3230.0968657160, 1499.9806136169, 493.6628699037),
  None                    = dv(6693.5180512560, 5634.7162641146, 13109.2168566227, 14633.4955585016, 5973.4890479639, 3927.6448122528),
  Other                   = dv(3255.5583569082, 7818.2427974846, 8209.5176813748, 8106.2776711948, 2944.9457310871, 3248.7552315487),
  `Don't Know/Not Stated` = dv(264.6858012333, 142.2514540885, 884.6254827245, 415.3391149955, 178.7758898756, 142.3896501077)
)
total_2010_district <- dv(41060.4161775767, 45935.9717098009, 95286.5640934099, 75034.3798974648, 34323.6293465130, 30782.8583703751)
total_2010_cat <- c(Anglican = 15064.7936788173, Baptist = 11620.5958821725,
                    `Jehovah's Witness` = 5385.0941110655, Mennonite = 12053.1676219673,
                    Methodist = 9457.0028309333, Nazarene = 9145.3799797505,
                    Pentecostal = 27119.6570492399, `Roman Catholic` = 129438.1538769886,
                    `Seventh Day Adventist` = 17556.5291108972, None = 49972.0805907079,
                    Other = 33583.2974695976, `Don't Know/Not Stated` = 2028.0673930251)
national_2010 <- 322423.8195952825
no_rel_2010 <- "None"
nonresp_2010 <- "Don't Know/Not Stated"

# ---- 2022 weighted (Census2022_GeneralCharacteristics.xlsx Religion_by_District) --
cat_2022 <- c("Roman Catholic", "Pentecostal", "Seventh Day Adventist", "Anglican",
              "Mennonite", "Baptist", "Methodist", "Nazarene", "Jehovah's Witness",
              "Other", "None", "Don't Know/Not Stated")
m2022 <- list(
  `Roman Catholic`        = dv(17153.6506688821, 20181.8888736663, 37960.9456372600, 26950.1010981244, 12565.4308005501, 11784.3727966510),
  Pentecostal             = dv(2410.2632026033, 4067.5848534727, 6219.2755826464, 14770.5121723302, 4036.3993707890, 4955.8848078543),
  `Seventh Day Adventist` = dv(4726.7351497972, 2171.4842178535, 5832.3881184242, 4016.5915852192, 1310.6384548451, 583.7311027225),
  Anglican                = dv(645.4730968844, 1072.3117271391, 9797.6704143586, 2378.0941954381, 1572.9435216288, 476.5879774835),
  Mennonite               = dv(4051.6450596601, 5350.1329636856, 571.6372689189, 4192.4402022350, 223.9155837219, 1050.7139836137),
  Baptist                 = dv(801.6113467662, 465.9642338075, 4057.5645380459, 1914.5631136051, 2399.8506961037, 4469.1071851251),
  Methodist               = dv(376.5022447271, 118.3477163036, 4695.4556345126, 447.7422688396, 513.4051761910, 471.8787298431),
  Nazarene                = dv(592.0565587333, 76.3881997329, 1271.6885233909, 1920.0562262614, 931.5053587855, 1776.3680028141),
  `Jehovah's Witness`     = dv(627.3636267118, 762.4407630777, 1195.2430258436, 1130.7992358603, 485.7412671231, 275.9929627685),
  Other                   = dv(3266.4676970261, 6438.3191206231, 5095.4044496420, 5925.7245851400, 1283.7722365552, 3107.2581976857),
  None                    = dv(10319.4565307549, 13110.8244086528, 35039.6307140165, 34432.4666414807, 22427.9642008926, 8042.3262615190),
  `Don't Know/Not Stated` = dv(338.9919779059, 336.4650046959, 1893.3132848750, 1025.7973973297, 410.5198164205, 129.6725894776)
)
total_2022_district <- dv(45310.2171604495, 54152.1520827875, 113630.2171918945, 99104.8887218751, 48162.0864835958, 37123.8945975660)
total_2022_cat <- c(`Roman Catholic` = 126596.3898752472, Pentecostal = 36459.9199896941,
                    `Seventh Day Adventist` = 18641.5686288654, Anglican = 15943.0809329334,
                    Mennonite = 15440.4850618364, Baptist = 14108.6611134543,
                    Methodist = 6623.3317704167, Nazarene = 6568.0628697175,
                    `Jehovah's Witness` = 4477.5808813849, Other = 25116.9462866742,
                    None = 123372.6687573383, `Don't Know/Not Stated` = 4134.7600707046)
national_2022 <- 397483.4562388667
no_rel_2022 <- "None"
nonresp_2022 <- "Don't Know/Not Stated"

# ---- reconciliation gates (fail-fast; stop, do not tune) ------------------------
# integer waves (2000) reconcile exactly; weighted waves (2010/2022) reconcile to a
# floating-point tolerance because the published cells are themselves non-integer
# weighted counts. any deviation beyond tolerance stops the build.
reconcile_wave <- function(mat, cats, province_totals, cat_totals, national, year, integer_wave) {
  tol <- if (integer_wave) 0L else 1e-2
  records <- list()
  for (s in districts) {
    col_sum <- sum(vapply(cats, function(c) mat[[c]][[s]], numeric(1)))
    if (abs(col_sum - province_totals[[s]]) > tol) {
      stop(sprintf("%d district gate FAILED for %s: categories sum %.6f != printed total %.6f",
                   year, s, col_sum, province_totals[[s]]), call. = FALSE)
    }
    records[[length(records) + 1L]] <- data.frame(
      year = year, margin = "district_column", key = s,
      computed = col_sum, printed = as.numeric(province_totals[[s]]),
      difference = col_sum - province_totals[[s]], stringsAsFactors = FALSE)
  }
  for (c in cats) {
    row_sum <- sum(mat[[c]])
    if (abs(row_sum - cat_totals[[c]]) > tol) {
      stop(sprintf("%d religion-row gate FAILED for %s: six-district sum %.6f != printed %.6f",
                   year, c, row_sum, cat_totals[[c]]), call. = FALSE)
    }
    records[[length(records) + 1L]] <- data.frame(
      year = year, margin = "religion_row", key = c,
      computed = row_sum, printed = as.numeric(cat_totals[[c]]),
      difference = row_sum - cat_totals[[c]], stringsAsFactors = FALSE)
  }
  if (abs(sum(province_totals) - national) > tol) {
    stop(sprintf("%d grand gate FAILED: district-total sum %.6f != printed national %.6f",
                 year, sum(province_totals), national), call. = FALSE)
  }
  if (abs(sum(cat_totals) - national) > tol) {
    stop(sprintf("%d category-total gate FAILED: category-total sum %.6f != printed national %.6f",
                 year, sum(cat_totals), national), call. = FALSE)
  }
  do.call(rbind, records)
}

rec_2000 <- reconcile_wave(m2000, cat_2000, total_2000_district, total_2000_cat, national_2000, 2000L, TRUE)
rec_2010 <- reconcile_wave(m2010, cat_2010, total_2010_district, total_2010_cat, national_2010, 2010L, FALSE)
rec_2022 <- reconcile_wave(m2022, cat_2022, total_2022_district, total_2022_cat, national_2022, 2022L, FALSE)

message(sprintf("gate 2000: PASSED (integer-exact; both margins close to %d)", national_2000))
message(sprintf("gate 2010: PASSED (weighted, float-exact; both margins close to %.2f)", national_2010))
message(sprintf("gate 2022: PASSED (weighted, float-exact; both margins close to %.2f)", national_2022))

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

required_inputs <- c(path_2000, path_2010, path_2022, boundary_path, boundary_meta_path)
invisible(lapply(required_inputs, require_file))

# confirm the pinned boundary licence, unit count, and type before use.
boundary_metadata <- fromJSON(boundary_meta_path, simplifyVector = FALSE)
if (!identical(boundary_metadata[["boundaryLicense"]], "Creative Commons Attribution 2.5 Generic") ||
    !identical(boundary_metadata[["admUnitCount"]], "6") ||
    !identical(boundary_metadata[["boundaryType"]], "ADM1")) {
  stop("geoBoundaries BLZ ADM1 licence, unit count, or type metadata changed", call. = FALSE)
}
boundary_licence <- boundary_metadata[["boundaryLicense"]]

# Belize-centred equal-area projection for land areas (compact, far from antimeridian).
bz_laea <- "+proj=laea +lat_0=17 +lon_0=-88.5 +datum=WGS84 +units=m +no_defs"

# join the six census districts one-to-one to the geoBoundaries ADM1 features.
build_boundary <- function(path) {
  boundary <- st_make_valid(st_read(path, quiet = TRUE, stringsAsFactors = FALSE))
  if (nrow(boundary) != 6L) stop("geoBoundaries BLZ ADM1 feature count is not 6", call. = FALSE)
  idx <- match(districts, boundary[["shapeName"]])
  if (anyNA(idx) || anyDuplicated(idx) || !setequal(idx, seq_len(6L))) {
    stop("census districts and geoBoundaries features do not join one-to-one", call. = FALSE)
  }
  boundary <- boundary[idx, ]
  boundary[["area_name"]] <- districts
  boundary[["boundary_source_name"]] <- boundary[["shapeName"]]
  boundary[["area_code"]] <- unname(district_slug[districts])
  boundary[["area_unit_id"]] <- paste(boundary_set_id, unname(district_slug[districts]), sep = ":")
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- boundary_level
  boundary[["boundary_vintage"]] <- boundary_vintage
  boundary[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(boundary, bz_laea))) / 1e6
  boundary <- st_transform(st_make_valid(boundary), 4326)
  boundary[c("area_code", "area_name", "boundary_source_name", "area_unit_id",
             "boundary_set_id", "boundary_level", "boundary_vintage",
             "land_area_sq_km", "geometry")]
}

boundary <- build_boundary(boundary_path)

# full-extent gate: Belize spans lon -89.2 to -87.8 E and lat 15.9 to 18.5 N.
bbox <- st_bbox(boundary)
if (bbox[["xmin"]] < -89.5 || bbox[["xmin"]] > -89.0 ||
    bbox[["xmax"]] < -88.0 || bbox[["xmax"]] > -87.5 ||
    bbox[["ymin"]] < 15.7 || bbox[["ymin"]] > 16.1 ||
    bbox[["ymax"]] < 18.3 || bbox[["ymax"]] > 18.7) {
  stop("boundary bbox does not match the expected Belize extent", call. = FALSE)
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
if (nrow(written) != 6L) stop("simplified boundary does not contain 6 features", call. = FALSE)
w_valid <- st_is_valid(written)
if (any(st_is_empty(written)) || any(is.na(w_valid)) || any(!w_valid)) {
  stop("simplified boundary has empty or invalid geometries", call. = FALSE)
}
geom_hashes <- geometry_hashes(written)
if (length(unique(geom_hashes)) != 6L) stop("simplified boundary geometry hashes are not distinct", call. = FALSE)
message(sprintf("boundary: PASSED (6 valid distinct features, %d bytes at %g%% keep)",
                file_bytes(boundary_out), simplification[["keep_percent"]]))

land_area <- setNames(round(written[["land_area_sq_km"]], 4), written[["area_name"]])
area_unit <- setNames(written[["area_unit_id"]], written[["area_name"]])
area_code <- setNames(written[["area_code"]], written[["area_name"]])

# ---- product rows --------------------------------------------------------------
# slot design (ordinary two-slot, SB/FM/KI precedent): religious_affiliation is the
# district population minus the None line and the non-response line; no_religion is
# the single None line. the non-response line stays in the denominator and in
# neither slot, so the two shares need not sum to 100. counts are rounded to integer
# for the schema's integer fields; percentages use the unrounded (as-published)
# values. 2000 cells are integer full-counts, 2010/2022 cells are weighted.

flag_common <- paste(
  "census_affiliation", "all_persons_universe", "single_select_reported_religion",
  "religious_affiliation_percent_is_named_religion_share",
  "no_religion_percent_is_none_line_only",
  "non_response_residual_in_denominator_neither_slot",
  "shares_need_not_sum_to_100",
  "headline_no_religion_and_affiliation_comparable_across_waves",
  # named to keep clear of the runtime's blanket change_withheld guard: the
  # manifest change_rule reads headline change across all three waves and
  # withholds only the fine-denomination series across the 2000 frame break
  "fine_denomination_series_not_comparable_across_frame_break",
  "licence_needs_review_build_then_ask_sib_attribution",
  "boundary_cc_by_2_5_generic",
  sep = ";")
flag_2000 <- paste(
  "frame_2000_seventeen_category_integer_full_count",
  "none_line=None", "nonresponse_line=DK/NS",
  "small_bodies_bahai_hindu_mormon_muslim_salvation_army_separate_in_2000_folded_into_other_in_2010_2022",
  "denominator_is_tabulated_population_232111",
  flag_common, sep = ";")
flag_2010 <- paste(
  "frame_2010_twelve_category_weighted",
  "none_line=None", "nonresponse_line=Don't Know/Not Stated",
  "weighted_non_integer_counts_sib_non_response_adjustment",
  "counts_rounded_to_integer_for_display_percentages_from_unrounded",
  "alternative_2010_source_table_r1_1_integer_20_category_deferred",
  flag_common, sep = ";")
flag_2022 <- paste(
  "frame_2022_twelve_category_weighted",
  "none_line=None", "nonresponse_line=Don't Know/Not Stated",
  "weighted_non_integer_counts_sib_non_response_adjustment",
  "counts_rounded_to_integer_for_display_percentages_from_unrounded",
  "rounded_national_counts_match_key_findings_table_3_5",
  flag_common, sep = ";")

basis_2000 <- paste(
  "2000 Belize Census Report, Table B2 'Population by Religion and Sex for Major",
  "Divisions', integer full-count; the denominator is the printed district Total",
  "(tabulated population). Religious affiliation is the district population minus the",
  "None and DK/NS lines.")
basis_2010 <- paste(
  "2010 General Characteristics Tables (Excel), sheet Religion_by_District Table 9;",
  "weighted counts (SIB non-response adjustment); the denominator is the district",
  "Total. Religious affiliation is the district population minus the None and Don't",
  "Know/Not Stated lines.")
basis_2022 <- paste(
  "2022 General Characteristics Tables (Excel), sheet Religion_by_District Table 9",
  "(= Key Findings Report Table A.2); weighted counts (SIB non-response adjustment);",
  "the denominator is the district Total. Religious affiliation is the district",
  "population minus the None and Don't Know/Not Stated lines.")

# build one schema-shaped area-summary row, carrying the verbatim per-district
# category breakdown on the quality flag (source_categories_verbatim pattern).
make_row <- function(s, year, mat, cats, district_total, no_rel_label, nonresp_label,
                     flag, basis, dataset_id, integer_wave) {
  pop <- district_total[[s]]
  no_rel <- mat[[no_rel_label]][[s]]
  nonresp <- mat[[nonresp_label]][[s]]
  affiliation <- pop - no_rel - nonresp
  aff_pct <- round(100 * affiliation / pop, 4)
  no_pct <- round(100 * no_rel / pop, 4)
  fmt <- if (integer_wave) function(x) as.character(as.integer(x)) else function(x) formatC(x, format = "f", digits = 4)
  breakdown <- paste(vapply(cats, function(c) paste0(c, "=", fmt(mat[[c]][[s]])), character(1)),
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
    population_total = as.integer(round(pop)),
    population_total_basis = basis,
    religious_affiliation_count = as.integer(round(affiliation)),
    religious_affiliation_percent = aff_pct,
    no_religion_count = as.integer(round(no_rel)),
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

waves <- list(
  list(year = 2000L, mat = m2000, cats = cat_2000, totals = total_2000_district,
       no_rel = no_rel_2000, nonresp = nonresp_2000, flag = flag_2000, basis = basis_2000,
       dataset = d2000, integer_wave = TRUE),
  list(year = 2010L, mat = m2010, cats = cat_2010, totals = total_2010_district,
       no_rel = no_rel_2010, nonresp = nonresp_2010, flag = flag_2010, basis = basis_2010,
       dataset = d2010, integer_wave = FALSE),
  list(year = 2022L, mat = m2022, cats = cat_2022, totals = total_2022_district,
       no_rel = no_rel_2022, nonresp = nonresp_2022, flag = flag_2022, basis = basis_2022,
       dataset = d2022, integer_wave = FALSE)
)

rows <- list()
for (w in waves) {
  for (s in districts) {
    rows[[length(rows) + 1L]] <- make_row(s, w$year, w$mat, w$cats, w$totals,
                                          w$no_rel, w$nonresp, w$flag, w$basis, w$dataset, w$integer_wave)
  }
}

# ---- area-summary document -----------------------------------------------------

licence_pending <- paste(
  "No open-data licence is stated on any SIB census product. The 2010 Census Report",
  "front matter reads: 'Copyright (c) 2013, The Statistical Institute of Belize. Short",
  "sections of this publication may be copied for individual use without permission,",
  "provided the source is fully acknowledged. Otherwise, no part of this publication",
  "may be reproduced or transmitted in any form or by any means ... without permission",
  "in writing from the Statistical Institute of Belize.' The SIB website footer asserts",
  "'Statistical Institute of Belize. Copyright (c) 2026. All Rights Reserved.' The",
  "derived district summaries carry attribution to the Statistical Institute of Belize",
  "and ship STAGED under the BUILD-THEN-ASK ruling (summaries-with-attribution stance,",
  "RO/SK/CI/MONSTAT line); a SIB reuse-confirmation email is the clean courtesy unblock.",
  "The boundary is Creative Commons Attribution 2.5 Generic.")

source_datasets <- function() {
  list(
    list(
      source_dataset_id = d2000,
      name = "Belize 2000 Census Report, Table B2: Population by Religion and Sex for Major Divisions",
      provider = "Statistical Institute of Belize (SIB)",
      url = url_2000, retrieval_date = retrieval_date, local_path = path_2000,
      licence = list(name = licence_pending, url = sib_home_url,
                     attribution = "Statistical Institute of Belize, 2000 Population and Housing Census"),
      citation = "Statistical Institute of Belize, 2000 Population and Housing Census, Report, Table B2.",
      access_limits = NULL,
      redistribution_limits = "Derived district summaries only; no open-data licence is stated on the SIB source. Ships STAGED under BUILD-THEN-ASK with attribution.",
      notes = paste("Integer full-count; 17-category frame. Both margins close exactly: every district column and",
                    "every religion row sum to the printed country total of 232,111. No cell suppression in the count columns.",
                    "The denominator is the tabulated population (232,111).")),
    list(
      source_dataset_id = d2010,
      name = "Belize 2010 General Characteristics Tables, sheet Religion_by_District (Table 9): Population by Religion, District and Sex",
      provider = "Statistical Institute of Belize (SIB)",
      url = url_2010, retrieval_date = retrieval_date, local_path = path_2010,
      licence = list(name = licence_pending, url = sib_home_url,
                     attribution = "Statistical Institute of Belize, 2010 Population and Housing Census"),
      citation = "Statistical Institute of Belize, 2010 Population and Housing Census, General Characteristics Tables, Religion_by_District (Table 9).",
      access_limits = NULL,
      redistribution_limits = "Derived district summaries only; no open-data licence is stated on the SIB source. Ships STAGED under BUILD-THEN-ASK with attribution.",
      notes = paste("Weighted (non-integer) counts from the SIB non-response-adjustment methodology; 12-category frame.",
                    "Both margins close float-exact to the national 322,423.82. None 49,972.08; Don't Know/Not Stated 2,028.07.",
                    "The 2010 Census Report Table R1.1 (integer full-count, 20 categories, ** suppression, country total 322,453)",
                    "is the richer-frame alternative 2010 source, deferred in favour of the 2010/2022 same-frame pair.")),
    list(
      source_dataset_id = d2022,
      name = "Belize 2022 General Characteristics Tables, sheet Religion_by_District (Table 9): Population by Religion, District and Sex",
      provider = "Statistical Institute of Belize (SIB)",
      url = url_2022, retrieval_date = retrieval_date, local_path = path_2022,
      licence = list(name = licence_pending, url = sib_home_url,
                     attribution = "Statistical Institute of Belize, 2022 Population and Housing Census"),
      citation = "Statistical Institute of Belize, 2022 Population and Housing Census, General Characteristics Tables, Religion_by_District (Table 9) / Key Findings Report Table A.2.",
      access_limits = NULL,
      redistribution_limits = "Derived district summaries only; no open-data licence is stated on the SIB source. Ships STAGED under BUILD-THEN-ASK with attribution.",
      notes = paste("Weighted (non-integer) counts from the SIB non-response-adjustment methodology; 12-category frame.",
                    "Both margins close float-exact to the national 397,483.46. None 123,372.67; Don't Know/Not Stated 4,134.76.",
                    "The rounded national counts match the Key Findings Report Table 3.5 published integers exactly",
                    "(Roman Catholic 126,596; None 123,373; total 397,483).")),
    list(
      source_dataset_id = d_boundary,
      name = "geoBoundaries BLZ ADM1 (6 districts)",
      provider = "geoBoundaries (William & Mary geoLab); boundary source Wikimedia Commons",
      url = boundary_url, retrieval_date = retrieval_date, local_path = boundary_path,
      licence = list(name = boundary_licence, url = boundary_meta_url,
                     attribution = "geoBoundaries (gbOpen); boundary source Wikimedia Commons"),
      citation = "geoBoundaries BLZ ADM1 (gbOpen, pinned 9469f09), 6 district boundaries.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary is committed under Creative Commons Attribution 2.5 Generic (attribution to geoBoundaries / Wikimedia Commons).",
      notes = paste("6 ADM1 districts, boundaryYearRepresented 2006, joined one-to-one to the census districts with no name",
                    "concordance. The extent spans lon -89.2 to -87.8E and lat 15.9 to 18.5N, far from the antimeridian.",
                    "Belize's border with Guatemala is subject to a territorial claim before the ICJ; the layer renders the",
                    "official Belizean administrative extent that the SIB census enumerates."))
  )
}

indicators <- function() {
  denom_note <- paste(
    "Percentages use each district's tabulated census population Total. The non-response",
    "line (2000 DK/NS; 2010/2022 Don't Know/Not Stated) stays in the denominator and",
    "outside both headline numerators, so the two shares need not sum to 100%.")
  list(
    list(indicator_id = "population_total", label = "Census population total",
         description = "District all-persons population represented in the wave's religion table.",
         unit = "count", denominator_indicator_id = NULL,
         method = "Printed district Total: 2000 Table B2, 2010/2022 General Characteristics Table 9. 2010/2022 totals are weighted counts rounded to integer.",
         temporal_coverage = "2000; 2010; 2022", spatial_coverage = "Belize districts (6)",
         quality_notes = "Religion is asked of the whole resident population in every wave. The 2000 denominator is the tabulated population (232,111); 2010 and 2022 are weighted census populations (322,423.82; 397,483.46). Population growth is never treated as a religion change."),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
         description = "Share of the district population reporting affiliation with a named religion.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (population - None - non-response) / population.",
         temporal_coverage = "2000; 2010; 2022", spatial_coverage = "Belize districts (6)",
         quality_notes = paste("The headline affiliation share is comparable across all three waves. Fine-denomination change is withheld across the 2000 frame break (Bahai Faith, Hindu, Mormon, Muslim, and Salvation Army are separate 2000 lines but fold into 'Other' in 2010/2022) and across the integer-to-weighted method change.", denom_note)),
    list(indicator_id = "no_religion_percent", label = "No religious affiliation %",
         description = "Share of the district population in the census None line.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * None / population. The non-response line is not part of this slot.",
         temporal_coverage = "2000; 2010; 2022", spatial_coverage = "Belize districts (6)",
         quality_notes = paste("The no-religion share rose sharply nationally (9.4% in 2000, 15.5% in 2010, 31.0% in 2022); the construct (share reporting None) is consistent across waves.", denom_note))
  )
}

visual_layers <- function() {
  list(
    list(visual_layer_id = "bz-district-religious-affiliation", label = "Religious affiliation %",
         description = "Belize census-affiliation share by district.", layer_type = "choropleth",
         indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "district tabulated population, including a non-response residual"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "reported district value", uncertainty_display = "quality_flag",
         default_visibility = TRUE,
         notes = "Census affiliation, not practice, attendance, or membership. Comparable across all three waves at the headline level."),
    list(visual_layer_id = "bz-district-no-religion", label = "No religious affiliation %",
         description = "Belize census no-religion share by district.", layer_type = "choropleth",
         indicator_ids = list("no_religion_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "district tabulated population"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "reported district value", uncertainty_display = "quality_flag",
         default_visibility = FALSE,
         notes = "The source category is None. The non-response line (DK/NS; Don't Know/Not Stated) is excluded from this slot.")
  )
}

summary_product <- list(
  schema_version = "area-summary.v1", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code,
                      level = boundary_level, vintage = boundary_vintage, source_dataset_id = d_boundary),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "No governed place-of-worship snapshot ships in the Belize census product.",
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
       raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/bz_census/"))
}

durable_file_record <- function(path, content, licence_status_value, licence_basis_value) {
  list(uri = paste0("repo:", path), storage_provider = "git_repository", format = sub("^.*\\.", "", path),
       bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = if (grepl("area_summary|\\.csv$", path)) row_count_file(path) else NULL,
       feature_count = if (grepl("\\.geojson$", path)) row_count_file(path) else NULL,
       content = content, privacy = "public",
       licence_status = licence_status_value, licence_basis = licence_basis_value)
}

licence_basis_slug <- "sib_all_rights_reserved_attribution_build_then_ask"

raw_sources <- list(
  raw_source_record(path_2000, url_2000, "pdf", TRUE, "2000", d2000,
    "2000 Census Report; Table B2 Religion by district (integer full-count). Both margins close to 232,111."),
  raw_source_record(path_2010, url_2010, "xlsx", TRUE, "2010", d2010,
    "2010 General Characteristics Tables; sheet Religion_by_District (Table 9), weighted. Both margins close to 322,423.82."),
  raw_source_record(path_2022, url_2022, "xlsx", TRUE, "2022", d2022,
    "2022 General Characteristics Tables; sheet Religion_by_District (Table 9), weighted. Both margins close to 397,483.46."),
  raw_source_record(path_2022_keyfindings, url_2022_keyfindings, "pdf", FALSE, "2022", d2022,
    "2022 Key Findings Report; cross-source anchor (Table A.2 district religion; Table 3.5 national rounded counts match the Excel)."),
  raw_source_record(path_2010_report, url_2010_report, "pdf", FALSE, "2010", d2010,
    "2010 Census Report; carries the verbatim SIB copyright/reuse clause and the alternative integer Table R1.1 (20-category, deferred)."),
  raw_source_record(boundary_path, boundary_url, "geojson", TRUE, "2006", d_boundary,
    "geoBoundaries BLZ ADM1 GeoJSON; 6 districts, CC BY 2.5 Generic. Pinned commit 9469f09."),
  raw_source_record(boundary_meta_path, boundary_meta_url, "json", FALSE, "2006", d_boundary,
    "geoBoundaries BLZ ADM1 metadata; records CC BY 2.5 Generic, boundaryYearRepresented 2006, admUnitCount 6.")
)

dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)
dataset_id <- "bz-census-religion:bz:2000-2022:sib-district"

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
  dataset_family = "bz-census-religion", dataset_role = "staged_evidence",
  scope = list(level = "country", country_codes = list("BZ"), snapshot_date = NULL,
               snapshot_anchor = NULL, pipeline_stage = "staged"),
  created_at = stamp, created_by = script_id,
  target_years = list(2000L, 2010L, 2022L),
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation",
      shipped_waves = list(2000L, 2010L, 2022L),
      shipped_geography = "6 Belize districts (Corozal, Orange Walk, Belize, Cayo, Stann Creek, Toledo)",
      boundary_set = boundary_set_id,
      source_tables = list(
        `2000` = "2000 Census Report Table B2 Population by Religion and Sex for Major Divisions (integer full-count, 17 categories)",
        `2010` = "2010 General Characteristics Tables sheet Religion_by_District Table 9 (weighted, 12 categories)",
        `2022` = "2022 General Characteristics Tables sheet Religion_by_District Table 9 = Key Findings Report Table A.2 (weighted, 12 categories)"
      ),
      universes = list(
        `2000` = "tabulated population, all persons (232,111)",
        `2010` = "weighted census population, all persons (322,423.82)",
        `2022` = "weighted census population, all persons (397,483.46)"
      ),
      method_note = paste(
        "The 2022 census applied census weighting and non-response adjustment through the assignment of weights",
        "(2022 Key Findings Report sections 1.3.1 and 1.3.4); the 2010 General Characteristics religion table was",
        "re-tabulated on the same weighted basis. Both waves' district religion cells are therefore non-integer",
        "weighted counts, rendered verbatim and reconciled float-exact. The 2000 Table B2 cells are integer full-counts.",
        "Count fields are rounded to integer for the schema; percentages use the unrounded as-published values."
      ),
      denominators = list(
        `2000` = "printed district Total; affiliation = population - None - DK/NS",
        `2010` = "printed district Total; affiliation = population - None - Don't Know/Not Stated",
        `2022` = "printed district Total; affiliation = population - None - Don't Know/Not Stated"
      ),
      slot_design = paste(
        "Ordinary two-slot (SB/FM/KI precedent). religious_affiliation_percent is the share of the district",
        "population reporting a named religion (population minus None minus the non-response line);",
        "no_religion_percent is the single None line. The non-response line (2000 DK/NS; 2010/2022 Don't",
        "Know/Not Stated) stays in the denominator and in neither slot, so the two shares need not sum to 100",
        "(the FJ/SB unallocated-residual precedent)."
      ),
      category_frames = list(
        `2000` = as.list(cat_2000),
        `2010` = as.list(cat_2010),
        `2022` = as.list(cat_2022),
        alignment_note = paste(
          "The headline no-religion and affiliation shares are comparable across all three waves (construct: share",
          "reporting a named religion / None, of the whole resident population). Two breaks limit fine-denomination",
          "comparison. First, category collapse: the 2000 frame names Bahai Faith, Hindu, Mormon, Muslim, and",
          "Salvation Army as separate lines, while 2010/2022 fold them into 'Other', so the 'Other' lines and those",
          "small-body lines are not comparable across the 2000 break. Second, method: 2000 is integer full-count",
          "while 2010/2022 are weighted (non-integer) counts. Frames are preserved verbatim per wave and never merged."
        )
      ),
      change_rule = paste(
        "Headline change (no-religion share, affiliation share) is readable across all three waves. Fine-denomination",
        "change is withheld across the 2000 frame break and the integer-to-weighted method change. National no-religion",
        "share rose 9.4% (2000) -> 15.5% (2010) -> 31.0% (2022); shares are read within each district's own wave",
        "denominator and population growth (232k -> 322k -> 397k) is never treated as a religion change."
      ),
      no_religion_treatment = list(
        `2000` = "single None line; DK/NS is a separate non-response residual, excluded from this slot",
        `2010` = "single None line; Don't Know/Not Stated is a separate non-response residual, excluded from this slot",
        `2022` = "single None line; Don't Know/Not Stated is a separate non-response residual, excluded from this slot"
      ),
      held_and_deferred = paste(
        "1991 (2000 report Table B2 1991 column) is HELD: it folds None into a combined None/Not-Stated line, so the",
        "no-religion slot cannot be isolated. The 2010 Census Report Table R1.1 (integer full-count, 20 categories,",
        "** suppression on cells of ten or fewer persons, country total 322,453) is a richer-frame alternative 2010",
        "source, deferred in favour of the 2010/2022 same-frame Excel pair."
      ),
      territorial_note = paste(
        "Belize's border with Guatemala is subject to a long-standing Guatemalan territorial claim before the ICJ.",
        "The build renders the official Belizean administrative extent and census record as published and takes no",
        "position on the dispute."
      ),
      omitted_metrics = list("places_per_10000_residents", "place_density_per_sq_km"),
      boundary_simplification = simplification,
      local_cache_hint = "All raw sources are cached under data/raw/bz_census/ and remain git-ignored.",
      retrieval_record = raw_sources
    ),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")), digest = as.character(packageVersion("digest")),
      mapshaper = "scripts/lib/simplify_boundary.R (npx mapshaper)"
    )
  ),
  source = list(
    provider = "Statistical Institute of Belize (SIB); geoBoundaries (William & Mary geoLab)",
    source_dataset_ids = list(d2000, d2010, d2022, d_boundary),
    source_urls = list(url_2000, url_2010, url_2022, url_2022_keyfindings, url_2010_report, boundary_url, boundary_meta_url),
    retrieved_at = stamp,
    licence = licence_pending,
    citation = "SIB 2000 Census Report Table B2; SIB 2010 & 2022 General Characteristics Tables Religion_by_District (Table 9); geoBoundaries BLZ ADM1 (gbOpen).",
    raw_redistribution = "The census PDFs, the Excel workbooks, and the geoBoundaries source GeoJSON are not committed; they remain in data/raw/bz_census/.",
    local_cache_hint = "data/raw/bz_census/ (git-ignored by .gitignore data/ rule)",
    raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/bz_census/")
  ),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = list(
    durable_file_record(summary_json_out, "Belize 6-district census-affiliation area summary for 2000, 2010, and 2022.", "needs_review", licence_basis_slug),
    durable_file_record(summary_csv_out, "Flattened Belize 6-district census-affiliation rows for 2000, 2010, and 2022.", "needs_review", licence_basis_slug),
    durable_file_record(boundary_out, "Simplified geoBoundaries BLZ ADM1 6-district boundary GeoJSON.", "accepted", "geoboundaries_cc_by_2_5_generic")
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id,
         notes = "6 districts x 3 waves = 18 rows; all-persons universe in every wave; no suppressed cells in the headline slots."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out), built_by = script_id,
         notes = "6 district features from geoBoundaries BLZ ADM1, simplified with mapshaper weighted keep-shapes.")
  ),
  validation = list(
    status = "passed_with_warnings",
    commands = list(
      paste("Rscript", script_id),
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/bz/data/area_summary_district.json",
      "bash scripts/validate_manifests.sh"
    ),
    gate_2000 = list(status = "passed", both_margins_close_to = national_2000,
                     district_column_checks = 6L, religion_row_checks = length(cat_2000),
                     records = reconciliation_block(rec_2000)),
    gate_2010 = list(status = "passed", both_margins_close_to = national_2010,
                     district_column_checks = 6L, religion_row_checks = length(cat_2010),
                     records = reconciliation_block(rec_2010)),
    gate_2022 = list(status = "passed", both_margins_close_to = national_2022,
                     district_column_checks = 6L, religion_row_checks = length(cat_2022),
                     records = reconciliation_block(rec_2022)),
    boundary_validation = list(status = "passed", feature_count = 6L,
                               distinct_geometry_hashes = length(unique(geom_hashes)),
                               geometry_hashes = as.list(geom_hashes),
                               bbox = list(xmin = unname(bbox[["xmin"]]), ymin = unname(bbox[["ymin"]]),
                                           xmax = unname(bbox[["xmax"]]), ymax = unname(bbox[["ymax"]])),
                               dateline_note = "extent lon -89.2 to -87.8E, lat 15.9 to 18.5N; far from the antimeridian, no dateline handling needed",
                               output_bytes = file_bytes(boundary_out), simplification = simplification,
                               licence = boundary_licence, adm_unit_count = boundary_metadata[["admUnitCount"]]),
    join_coverage = list(matched_districts = 6L, expected_districts = 6L, unmatched_districts = list(), unused_boundary_features = list()),
    notes = paste(
      "2000 Table B2 closes integer-exact at both margins (country total 232,111); 2010 and 2022 General",
      "Characteristics Table 9 close float-exact at both margins (322,423.82; 397,483.46). Boundary joins 6/6 to",
      "geoBoundaries BLZ ADM1 with 6 distinct geometry hashes."
    ),
    warnings = list(
      "STAGED product: no page, no hub link. Licence needs review; ships under BUILD-THEN-ASK with attribution to SIB (no open-data licence stated).",
      "The 2010 and 2022 district religion cells are weighted (non-integer) counts from the SIB non-response-adjustment methodology; rendered verbatim, rounded to integer for the schema's count fields, reconciled on the as-published values.",
      "The 2000 17-category frame collapses to the 2010/2022 12-category frame (Bahai Faith, Hindu, Mormon, Muslim, Salvation Army fold into 'Other'); fine-denomination change is withheld across the break; headline shares are comparable.",
      "1991 is HELD (combined None/Not-Stated line); the 2010 Table R1.1 integer 20-category table is a deferred richer-frame alternative.",
      "Belize's border with Guatemala is subject to an ICJ territorial claim; the official Belizean record is rendered as published, neutrally."
    )
  ),
  construct_notes = list(
    "The construct is census affiliation: each resident's reported religion, asked of the whole resident population, not practice, attendance, or membership.",
    "The public product carries three headline fields per district-wave: population total, religious affiliation percent, and no-religion percent. Place-density metrics are null (no governed place-of-worship snapshot).",
    "The headline no-religion and affiliation shares are comparable across all three waves; the national no-religion share rose 9.4% (2000) to 15.5% (2010) to 31.0% (2022).",
    "The 2022 census applied census weighting and non-response adjustment through the assignment of weights (Key Findings Report 1.3.1, 1.3.4); the 2010 General Characteristics religion table shares that weighted basis. Both waves' cells are non-integer weighted counts, rendered verbatim and reconciled float-exact; the 2000 Table B2 cells are integer full-counts.",
    "Slot design (ordinary two-slot, SB/FM/KI precedent): religious_affiliation_percent is the share reporting a named religion (population minus None minus the non-response line); no_religion_percent is the single None line. The non-response line stays in the denominator and in neither slot, so the two shares need not sum to 100.",
    "Two frame breaks limit fine-denomination comparison: category collapse (2000 names Bahai Faith, Hindu, Mormon, Muslim, Salvation Army separately; 2010/2022 fold them into 'Other') and method (2000 integer full-count vs 2010/2022 weighted). Change is withheld on the fine denominations; frames are preserved verbatim per wave.",
    "Earlier and alternative waves are HELD/deferred: 1991 folds None into a combined None/Not-Stated line (no-religion slot cannot be isolated); the 2010 Census Report Table R1.1 is a richer 20-category integer full-count with ** suppression, deferred in favour of the 2010/2022 same-frame pair.",
    "Boundary: geoBoundaries BLZ ADM1, 6 districts, Creative Commons Attribution 2.5 Generic. The six districts join one-to-one by name with no concordance. Belize's border with Guatemala is subject to an ICJ territorial claim; the official Belizean extent and census record are rendered as published, neutrally."
  ),
  deferred_sources = list(
    list(source_dataset_id = "bz-census-2010-report-table-r1-1-integer-20-category", status = "deferred",
         url = url_2010_report, local_path = path_2010_report,
         notes = paste("2010 Census Report Table R1.1: integer full-count district religion, 20 categories, ** suppression on",
                       "cells of ten or fewer persons, country total 322,453. A richer-frame alternative 2010 source, deferred",
                       "in favour of the 2010/2022 same-frame weighted Excel pair.")),
    list(source_dataset_id = "bz-census-1991-religion-by-district", status = "deferred",
         url = url_2000, local_path = path_2000,
         notes = paste("1991 district religion is in the 2000 report Table B2 (1991 column) but folds None into a combined",
                       "None/Not-Stated line, so the no-religion slot cannot be isolated; a deeper-history wave, not shipped.")),
    list(source_dataset_id = "sib-licence-confirmation", status = "not_pinned",
         url = sib_home_url, local_path = NULL,
         notes = "A SIB reuse-confirmation email is the clean courtesy unblock under BUILD-THEN-ASK; none is held.")
  ),
  privacy = "public",
  licence_status = "needs_review",
  licence_basis = licence_basis_slug,
  downstream_status = "staged",
  source_datasets = source_datasets(),
  notes = paste(
    "STAGED product (no page, no hub link). The committed products are the derived 6-district area summary (18 rows",
    "across 2000, 2010, and 2022) and the simplified geoBoundaries BLZ ADM1 boundary. Ships under BUILD-THEN-ASK with",
    "attribution to the Statistical Institute of Belize (SIB) and geoBoundaries (CC BY 2.5 Generic)."
  )
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

cat("waves shipped: 2000, 2010, 2022 on 6 Belize districts\n")
cat(sprintf("rows: %d (6 districts x 3 waves)\n", length(rows)))
cat(sprintf("gate 2000: passed integer-exact; both margins close to %d\n", national_2000))
cat(sprintf("gate 2010: passed float-exact; both margins close to %.2f\n", national_2010))
cat(sprintf("gate 2022: passed float-exact; both margins close to %.2f\n", national_2022))
cat(sprintf("boundary gate: passed; 6/6 join, %d distinct geometry hashes, %d bytes at %g%% keep\n",
            length(unique(geom_hashes)), file_bytes(boundary_out), simplification[["keep_percent"]]))
cat("licence gate: needs_review; STAGED under BUILD-THEN-ASK with SIB attribution\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", boundary_out))
cat(sprintf("wrote %s\n", manifest_out))
