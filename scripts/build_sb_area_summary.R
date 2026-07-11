# build the Solomon Islands province census-religion area-summary product for two
# waves (2009, 2019) on the ten-unit geoBoundaries SLB ADM1 province frame (nine
# provinces plus Honiara). inputs (all cached, git-ignored, sha256 in the route
# probe research/countries/sb/route-probe.md):
#   data/raw/sb_census/sb_2009_basic_tables_vol2.pdf -> Table P3.2 "Total population
#     by province and religious denomination, Solomon Islands: 2009" (13 categories)
#   data/raw/sb_census/sb_2019_basic_tables_vol2.pdf -> Table P8.2 "Total population
#     by province and religious denominations, Solomon Islands: 2019" (17 categories)
#   data/raw/sb_census/geoBoundaries-SLB-ADM1.geojson -> 10-province ADM1 boundary
#   data/raw/sb_census/gb_slb_adm1_meta.json          -> boundary licence metadata
# every religion table is transcribed verbatim from its cached source (the exact
# cells were extracted with pdftotext -layout and margin-verified before
# transcription) and reconciled against the printed control totals here; the build
# stops on any margin mismatch and never allocates, infers, rounds, imputes, or
# tunes a value. no cell suppression occurs in either wave (dashes read as nil).
# outputs: apps/regions/sb/data/sb_province_2021.geojson,
#   apps/regions/sb/data/area_summary_province.{json,csv}, and
#   docs/manifests/sb-census-religion-2009-2019.json.
# run from the repo root: Rscript scripts/build_sb_area_summary.R
# this is a STAGED product: no page, no hub link; licence needs review pending a PI
# ruling (no reuse terms stated on the SINSO tables; the boundary is Public Domain).

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "SB"
script_id <- "scripts/build_sb_area_summary.R"
raw_dir <- "data/raw/sb_census"
product_dir <- "apps/regions/sb/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-11"
stamp <- paste0(retrieval_date, "T00:00:00Z")
git_commit <- trimws(system2("git", c("rev-parse", "HEAD"), stdout = TRUE))
if (length(git_commit) != 1L || !grepl("^[a-f0-9]{40}$", git_commit)) git_commit <- NULL

# boundaryYearRepresented is 2021 in the geoBoundaries release metadata; the file,
# id, and vintage all carry 2021 (the route brief's "sb_province_2019" filename
# predates that metadata read and is superseded by the record).
boundary_level <- "province"
boundary_vintage <- "2021"
boundary_set_id <- "sb-province-2021-geoboundaries-adm1"

d2009 <- "sb-census-2009-basic-tables-p3-2-religion-by-province"
d2019 <- "sb-census-2019-basic-tables-p8-2-religion-by-province"
d_boundary <- "geoboundaries-slb-adm1-2021"

# ---- source urls and cached paths ----------------------------------------------
url_2009 <- "https://solomonislands-data.sprep.org/system/files/2009_Census_Report-on-Basic-Tables-Vol2.pdf"
url_2019 <- "https://solomons.gov.sb/wp-content/uploads/2023/09/Solomon-Islands-2019-Population-Census-Report_Basic-Tables_Operations_Vol2.pdf"
url_2019_national <- "https://solomons.gov.sb/wp-content/uploads/2023/09/Solomon-Islands-2019-Population-and-Housing-Census_National-Report-Vol-1.pdf"
sinso_home_url <- "https://statistics.gov.sb"
boundary_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/SLB/ADM1/geoBoundaries-SLB-ADM1.geojson"
boundary_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/SLB/ADM1/"

path_2009 <- file.path(raw_dir, "sb_2009_basic_tables_vol2.pdf")
path_2019 <- file.path(raw_dir, "sb_2019_basic_tables_vol2.pdf")
path_2019_national <- file.path(raw_dir, "sb_2019_national_report_vol1.pdf")
boundary_path <- file.path(raw_dir, "geoBoundaries-SLB-ADM1.geojson")
boundary_meta_path <- file.path(raw_dir, "gb_slb_adm1_meta.json")

boundary_out <- file.path(product_dir, "sb_province_2021.geojson")
summary_json_out <- file.path(product_dir, "area_summary_province.json")
summary_csv_out <- file.path(product_dir, "area_summary_province.csv")
manifest_out <- file.path(manifest_dir, "sb-census-religion-2009-2019.json")

# ---- canonical province frame and boundary concordance -------------------------
# ten canonical province display names in a stable order matching both census
# tables' province columns; area_code is a snake_case slug of the display name.
provinces <- c("Choiseul", "Western", "Isabel", "Central", "Rennell-Bellona",
               "Guadalcanal", "Malaita", "Makira-Ulawa", "Temotu", "Honiara")
province_slug <- c(Choiseul = "choiseul", Western = "western", Isabel = "isabel",
                   Central = "central", `Rennell-Bellona` = "rennell_bellona",
                   Guadalcanal = "guadalcanal", Malaita = "malaita",
                   `Makira-Ulawa` = "makira_ulawa", Temotu = "temotu", Honiara = "honiara")
# census display name -> geoBoundaries shapeName (identity where absent). three
# names differ: Makira-Ulawa/Makira, Rennell-Bellona/Rennell and Bellona,
# Honiara/Capital Territory (Honiara).
census_to_boundary <- c(
  `Makira-Ulawa` = "Makira",
  `Rennell-Bellona` = "Rennell and Bellona",
  Honiara = "Capital Territory (Honiara)"
)

# helper: build a province-named integer vector in canonical province order.
pv <- function(...) setNames(as.integer(c(...)), provinces)

# ---- 2009 Table P3.2 (all persons, all ages; 13-category frame) -----------------
# verbatim printed column order from the P3.2 header; note the 2009 table misspells
# the province "Guadacanal" (display name uses the standard "Guadalcanal").
cat_2009 <- c("Church of Melanesia", "Roman Catholic", "South Sea Evangelical Church",
              "Seventh Day Adventist", "United Church", "Christian Fellowship Church",
              "Jehovah's Witness", "Christian OutReach", "Bahai", "Custom Beliefs",
              "No Religion", "Refuse to Answer", "Other")
# category -> province-vector (canonical province order). dashes in the source read
# as nil (0). every province column and every category row is gated below.
m2009 <- list(
  `Church of Melanesia`          = pv(   285,  2605, 23183, 21747,   170, 22311, 36241, 18947, 18640, 20510),
  `Roman Catholic`               = pv(  5995,  5176,   834,  2384,     8, 35275, 32879,  9004,    33,  9411),
  `South Sea Evangelical Church` = pv(   321,  2008,   115,   889,  1192, 16397, 42813,  9983,    33, 14644),
  `Seventh Day Adventist`        = pv(  4401, 21772,   513,   753,  1512, 11694,  7966,  1253,   458, 10184),
  `United Church`                = pv( 14361, 29984,   181,   128,     2,  2733,   254,    96,    14,  4166),
  `Christian Fellowship Church`  = pv(   283, 11568,    29,    13,     1,   185,   275,    49,    64,   686),
  `Jehovah's Witness`            = pv(    12,   168,    11,    30,     2,   709,  6714,   125,   424,  1249),
  `Christian OutReach`           = pv(     4,   649,     8,    26,     9,   978,  1418,   355,  1316,   540),
  Bahai                          = pv(    44,   313,     9,    21,     0,    93,  1414,    75,    21,   437),
  `Custom Beliefs`               = pv(     1,    13,     6,     0,     0,  1650,  2467,     5,     1,    48),
  `No Religion`                  = pv(    25,    67,     3,     8,     0,   213,   149,     5,    11,   200),
  `Refuse to Answer`             = pv(     4,    36,     0,     0,     1,    16,    16,     0,     4,    60),
  Other                          = pv(   636,  2290,  1266,    52,   144,  1359,  4990,   522,   343,  2474)
)
# printed province Total row (P3.2) and printed national category totals (col 1).
total_2009_province <- pv(26372, 76649, 26158, 26051, 3041, 93613, 137596, 40419, 21362, 64609)
total_2009_cat <- c(`Church of Melanesia` = 164639L, `Roman Catholic` = 100999L,
                    `South Sea Evangelical Church` = 88395L, `Seventh Day Adventist` = 60506L,
                    `United Church` = 51919L, `Christian Fellowship Church` = 13153L,
                    `Jehovah's Witness` = 9444L, `Christian OutReach` = 5303L, Bahai = 2427L,
                    `Custom Beliefs` = 4191L, `No Religion` = 681L, `Refuse to Answer` = 137L,
                    Other = 14076L)
national_2009 <- 515870L
no_religion_label_2009 <- "No Religion"
refuse_label_2009 <- "Refuse to Answer"

# ---- 2019 Table P8.2 (all persons, all ages; 17-category frame) -----------------
# verbatim printed row order from the P8.2 table. Pentecostal, Assembly of God,
# Muslim, and Baptist Church split out of the 2009 "Other"; three lines widen their
# label (Christian OutReach Church, Bahai Faith, Custom Beliefs or Animism, No
# Religion or Faith/Atheism). dashes read as nil (0).
cat_2019 <- c("Church of Melanesia", "Roman Catholic", "South Sea Evangelical Church",
              "Seventh Day Adventist", "United Church", "Christian Fellowship Church",
              "Christian OutReach Church", "Pentecostal", "Jehovah's Witness",
              "Bahai Faith", "Assembly of God", "Muslim", "Baptist Church",
              "Other religions", "Custom Beliefs or Animism",
              "No Religion or Faith/Atheism", "Refuse to Answer")
m2019 <- list(
  `Church of Melanesia`          = pv(   603,  4638, 27991, 24959,   243, 40817, 49710, 23509, 19003, 40568),
  `Roman Catholic`               = pv(  6954,  7031,   475,  2824,    58, 55811, 41390, 10904,    74, 18557),
  `South Sea Evangelical Church` = pv(   441,  2964,   138,  1082,  1530, 27241, 48512, 12351,    99, 30148),
  `Seventh Day Adventist`        = pv(  4892, 24859,   656,  1117,  1958, 17652,  9911,  1619,   584, 20204),
  `United Church`                = pv( 16478, 36472,   233,   122,    20,  4838,   429,   181,    43,  8099),
  `Christian Fellowship Church`  = pv(   363, 13629,    37,    17,     4,   415,   377,    58,    66,  1213),
  `Christian OutReach Church`    = pv(    24,   787,    11,    46,    14,  1084,  1498,   273,  1142,   703),
  Pentecostal                    = pv(    13,    83,     2,    15,     0,   238,  1598,    15,    38,  1017),
  `Jehovah's Witness`            = pv(    29,   269,    11,    66,     5,  1759,  9078,   236,   459,  2712),
  `Bahai Faith`                  = pv(    51,   327,     8,    11,     3,   204,  1732,    99,     6,   663),
  `Assembly of God`              = pv(     6,   408,   102,    16,     2,   501,  1613,     1,    11,  1096),
  Muslim                         = pv(   102,   159,   241,    16,    97,    80,   116,    22,    16,   251),
  `Baptist Church`               = pv(     1,    80,     0,     7,   132,   310,  1137,     4,     2,   499),
  `Other religions`              = pv(   781,  2160,  1484,    17,    31,  1703,  2482,  2298,   743,  3254),
  `Custom Beliefs or Animism`    = pv(     5,    28,     2,     0,     0,  1176,  2807,     5,     3,    89),
  `No Religion or Faith/Atheism` = pv(    26,   202,    27,     2,     3,   180,   329,     9,    16,   433),
  `Refuse to Answer`             = pv(     6,    10,     2,     1,     0,    13,    21,     3,    14,    63)
)
total_2019_province <- pv(30775, 94106, 31420, 30318, 4100, 154022, 172740, 51587, 22319, 129569)
total_2019_cat <- c(`Church of Melanesia` = 232041L, `Roman Catholic` = 144078L,
                    `South Sea Evangelical Church` = 124506L, `Seventh Day Adventist` = 83452L,
                    `United Church` = 66915L, `Christian Fellowship Church` = 16179L,
                    `Christian OutReach Church` = 5582L, Pentecostal = 3019L,
                    `Jehovah's Witness` = 14624L, `Bahai Faith` = 3104L,
                    `Assembly of God` = 3756L, Muslim = 1100L, `Baptist Church` = 2172L,
                    `Other religions` = 14953L, `Custom Beliefs or Animism` = 4115L,
                    `No Religion or Faith/Atheism` = 1227L, `Refuse to Answer` = 133L)
national_2019 <- 720956L
no_religion_label_2019 <- "No Religion or Faith/Atheism"
refuse_label_2019 <- "Refuse to Answer"

# ---- reconciliation gates (fail-fast; stop, do not tune) ------------------------
# every province column sums to its printed province total, every category row sums
# to its printed national total, and both margins sum to the printed national grand
# total. any deviation stops the build.
reconcile_wave <- function(mat, cats, province_totals, cat_totals, national, year) {
  records <- list()
  for (s in provinces) {
    col_sum <- sum(vapply(cats, function(c) mat[[c]][[s]], integer(1)))
    if (col_sum != province_totals[[s]]) {
      stop(sprintf("%d province gate FAILED for %s: categories sum %d != printed total %d",
                   year, s, col_sum, province_totals[[s]]), call. = FALSE)
    }
    records[[length(records) + 1L]] <- data.frame(
      year = year, margin = "province_column", key = s,
      computed = col_sum, printed = province_totals[[s]], difference = 0L,
      stringsAsFactors = FALSE)
  }
  for (c in cats) {
    row_sum <- sum(mat[[c]])
    if (row_sum != cat_totals[[c]]) {
      stop(sprintf("%d religion-row gate FAILED for %s: ten-province sum %d != printed %d",
                   year, c, row_sum, cat_totals[[c]]), call. = FALSE)
    }
    records[[length(records) + 1L]] <- data.frame(
      year = year, margin = "religion_row", key = c,
      computed = row_sum, printed = cat_totals[[c]], difference = 0L,
      stringsAsFactors = FALSE)
  }
  if (sum(province_totals) != national) {
    stop(sprintf("%d grand gate FAILED: province-total sum %d != printed national %d",
                 year, sum(province_totals), national), call. = FALSE)
  }
  if (sum(cat_totals) != national) {
    stop(sprintf("%d category-total gate FAILED: category-total sum %d != printed national %d",
                 year, sum(cat_totals), national), call. = FALSE)
  }
  do.call(rbind, records)
}

rec_2009 <- reconcile_wave(m2009, cat_2009, total_2009_province, total_2009_cat, national_2009, 2009L)
rec_2019 <- reconcile_wave(m2019, cat_2019, total_2019_province, total_2019_cat, national_2019, 2019L)

message(sprintf("gate 2009: PASSED (both margins close to %d; 10 province columns, 13 religion rows)", national_2009))
message(sprintf("gate 2019: PASSED (both margins close to %d; 10 province columns, 17 religion rows)", national_2019))

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
# hash each feature's geometry (EWKB) to prove per-feature distinctness.
geometry_hashes <- function(layer) {
  vapply(seq_len(nrow(layer)), function(i) {
    digest(st_as_binary(st_geometry(layer)[i], EWKB = TRUE)[[1L]], algo = "sha256", serialize = FALSE)
  }, character(1))
}

required_inputs <- c(path_2009, path_2019, boundary_path, boundary_meta_path)
invisible(lapply(required_inputs, require_file))

# confirm the pinned boundary licence, unit count, and type before use.
boundary_metadata <- fromJSON(boundary_meta_path, simplifyVector = FALSE)
if (!identical(boundary_metadata[["boundaryLicense"]], "Public Domain") ||
    !identical(boundary_metadata[["admUnitCount"]], "10") ||
    !identical(boundary_metadata[["boundaryType"]], "ADM1")) {
  stop("geoBoundaries SLB ADM1 licence, unit count, or type metadata changed", call. = FALSE)
}

# SB-centred equal-area projection for land areas (the archipelago is compact and
# wholly east of and far from the antimeridian; no dateline handling is needed).
sb_laea <- "+proj=laea +lat_0=-9 +lon_0=160 +datum=WGS84 +units=m +no_defs"

# join the ten census provinces one-to-one to the geoBoundaries ADM1 features.
build_boundary <- function(path) {
  boundary <- st_make_valid(st_read(path, quiet = TRUE, stringsAsFactors = FALSE))
  if (nrow(boundary) != 10L) stop("geoBoundaries SLB ADM1 feature count is not 10", call. = FALSE)
  target <- ifelse(provinces %in% names(census_to_boundary),
                   unname(census_to_boundary[provinces]), provinces)
  idx <- match(target, boundary[["shapeName"]])
  if (anyNA(idx) || anyDuplicated(idx) || !setequal(idx, seq_len(10L))) {
    stop("census provinces and geoBoundaries features do not join one-to-one", call. = FALSE)
  }
  boundary <- boundary[idx, ]
  boundary[["area_name"]] <- provinces
  boundary[["boundary_source_name"]] <- boundary[["shapeName"]]
  boundary[["area_code"]] <- unname(province_slug[provinces])
  boundary[["area_unit_id"]] <- paste(boundary_set_id, unname(province_slug[provinces]), sep = ":")
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- boundary_level
  boundary[["boundary_vintage"]] <- boundary_vintage
  boundary[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(boundary, sb_laea))) / 1e6
  boundary <- st_transform(st_make_valid(boundary), 4326)
  boundary[c("area_code", "area_name", "boundary_source_name", "area_unit_id",
             "boundary_set_id", "boundary_level", "boundary_vintage",
             "land_area_sq_km", "geometry")]
}

boundary <- build_boundary(boundary_path)

# full-extent gate: the archipelago spans lon 155.5-168.8E and lat 12.3-6.6S,
# wholly within [-180,180] and far from the antimeridian (no dateline handling).
bbox <- st_bbox(boundary)
if (bbox[["xmin"]] < 155.0 || bbox[["xmin"]] > 156.0 ||
    bbox[["xmax"]] < 168.0 || bbox[["xmax"]] > 169.5 ||
    bbox[["ymin"]] < -12.6 || bbox[["ymin"]] > -12.0 ||
    bbox[["ymax"]] < -6.75 || bbox[["ymax"]] > -6.4) {
  stop("boundary bbox does not match the expected Solomon Islands extent", call. = FALSE)
}

# simplify with the mandatory helper and re-validate feature count and distinctness.
simplification <- mapshaper_simplify_to_cap(
  boundary, boundary_out,
  max_bytes = 900000L,
  keep_percentages = c(100, 75, 50, 30, 20, 10, 5),
  clean_option = "allow-overlaps"
)
written <- st_read(boundary_out, quiet = TRUE, stringsAsFactors = FALSE)
written <- written[match(boundary[["area_code"]], written[["area_code"]]), ]
if (anyNA(written[["area_code"]])) stop("simplified boundary lost an area code", call. = FALSE)
if (nrow(written) != 10L) stop("simplified boundary does not contain 10 features", call. = FALSE)
w_valid <- st_is_valid(written)
if (any(st_is_empty(written)) || any(is.na(w_valid)) || any(!w_valid)) {
  stop("simplified boundary has empty or invalid geometries", call. = FALSE)
}
geom_hashes <- geometry_hashes(written)
if (length(unique(geom_hashes)) != 10L) stop("simplified boundary geometry hashes are not distinct", call. = FALSE)
message(sprintf("boundary: PASSED (10 valid distinct features, %d bytes at %g%% keep)",
                file_bytes(boundary_out), simplification[["keep_percent"]]))

land_area <- setNames(round(written[["land_area_sq_km"]], 4), written[["area_name"]])
area_unit <- setNames(written[["area_unit_id"]], written[["area_name"]])
area_code <- setNames(written[["area_code"]], written[["area_name"]])

# ---- product rows --------------------------------------------------------------
# slot design (ordinary two-slot, FM/KI precedent): religious_affiliation_percent
# is the summed share of every religious-affiliation category (Custom Beliefs /
# Custom Beliefs or Animism counts as a religious tradition, not its absence);
# no_religion_percent is the single No Religion line. Refuse to Answer stays in the
# denominator and in neither slot, so the two shares need not sum to 100 (FJ
# unallocated-residual precedent). affiliation = population - No Religion - Refuse.

flag_common <- paste(
  "census_affiliation", "all_persons_all_ages_universe", "no_universe_break_2009_to_2019",
  "single_select_reported_religion", "religious_affiliation_percent_is_summed_affiliation_share",
  "custom_beliefs_counted_as_religious_affiliation",
  "no_religion_percent_is_no_religion_line_only",
  "refuse_to_answer_residual_in_denominator_neither_slot",
  "shares_need_not_sum_to_100", "broad_affiliation_comparable_2009_2019",
  "licence_needs_review_pending_pi_ruling", "boundary_public_domain",
  sep = ";")
flag_2009 <- paste(
  "frame_2009_thirteen_category", "no_religion_line=No Religion", "refuse_line=Refuse to Answer",
  "other_line_2009_not_comparable_to_2019_other_religions_split_out",
  "source_province_spelling_guadalcanal_printed_guadacanal",
  flag_common, sep = ";")
flag_2019 <- paste(
  "frame_2019_seventeen_category", "no_religion_line=No Religion or Faith/Atheism",
  "refuse_line=Refuse to Answer",
  "pentecostal_assembly_of_god_muslim_baptist_split_out_of_2009_other",
  "other_religions_line_2019_not_comparable_to_2009_other",
  flag_common, sep = ";")

basis_2009 <- paste(
  "2009 Solomon Islands Census Report Basic Tables Vol 2, Table P3.2 'Total",
  "population by province and religious denomination', all persons of all ages;",
  "the denominator is the printed province Total. Religious affiliation is the",
  "province population minus the No Religion and Refuse to Answer lines; Custom",
  "Beliefs counts as a religious affiliation.")
basis_2019 <- paste(
  "2019 Solomon Islands Population Census Report Basic Tables Vol 2, Table P8.2",
  "'Total population by province and religious denominations', all persons of all",
  "ages; the denominator is the printed province Total. Religious affiliation is",
  "the province population minus the No Religion or Faith/Atheism and Refuse to",
  "Answer lines; Custom Beliefs or Animism counts as a religious affiliation.")

# build one schema-shaped area-summary row, carrying the verbatim per-province
# category breakdown on the quality flag (source_categories_verbatim pattern).
make_row <- function(s, year, mat, cats, province_total, no_rel_label, refuse_label,
                     flag, basis, dataset_id) {
  pop <- province_total[[s]]
  no_rel <- mat[[no_rel_label]][[s]]
  refuse <- mat[[refuse_label]][[s]]
  affiliation <- pop - no_rel - refuse
  aff_pct <- round(100 * affiliation / pop, 4)
  no_pct <- round(100 * no_rel / pop, 4)
  breakdown <- paste(vapply(cats, function(c) paste0(c, "=", mat[[c]][[s]]), character(1)),
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

waves <- list(
  list(year = 2009L, mat = m2009, cats = cat_2009, totals = total_2009_province,
       no_rel = no_religion_label_2009, refuse = refuse_label_2009,
       flag = flag_2009, basis = basis_2009, dataset = d2009),
  list(year = 2019L, mat = m2019, cats = cat_2019, totals = total_2019_province,
       no_rel = no_religion_label_2019, refuse = refuse_label_2019,
       flag = flag_2019, basis = basis_2019, dataset = d2019)
)

rows <- list()
for (w in waves) {
  for (s in provinces) {
    rows[[length(rows) + 1L]] <- make_row(s, w$year, w$mat, w$cats, w$totals,
                                          w$no_rel, w$refuse, w$flag, w$basis, w$dataset)
  }
}

# ---- area-summary document -----------------------------------------------------

licence_pending <- paste(
  "No reuse licence is stated on the SINSO census religion tables in either wave",
  "(2009 Basic Tables Vol 2, 2019 Basic Tables Vol 2). The SINSO website footer",
  "reads 'Copyright 2023 @ Solomon Islands National Statistics Office' (a copyright",
  "assertion, not a reuse grant). The SPREP re-host of the 2009 file attaches a",
  "Creative Commons Public Data License, which governs the SPREP mirror, not the",
  "SINSO original. The derived province summaries carry attribution to the Solomon",
  "Islands National Statistics Office (SINSO) and ship STAGED pending a PI licence",
  "ruling (summaries-not-raw-data stance). The boundary is Public Domain.")

source_datasets <- function() {
  list(
    list(
      source_dataset_id = d2009,
      name = "Solomon Islands 2009 Census Report on Basic Tables Vol 2, Table P3.2: Total population by province and religious denomination",
      provider = "Solomon Islands National Statistics Office (SINSO); SPREP Solomon Islands environment data portal (mirror)",
      url = url_2009, retrieval_date = retrieval_date, local_path = path_2009,
      licence = list(name = licence_pending, url = sinso_home_url,
                     attribution = "Solomon Islands National Statistics Office, 2009 Population and Housing Census"),
      citation = "Solomon Islands National Statistics Office, 2009 Population and Housing Census, Report on Basic Tables Vol 2, Table P3.2.",
      access_limits = NULL,
      redistribution_limits = "Derived province summaries only; no reuse licence is stated on the SINSO source. Ships STAGED pending a PI ruling.",
      notes = paste("All persons, all ages; 13-category frame. Both margins close exactly: every province column and",
                    "every religion row sum to the printed national total of 515,870. Dashes read as nil; no cell",
                    "suppression. The 2009 table misspells the province 'Guadacanal' (display name uses 'Guadalcanal').")),
    list(
      source_dataset_id = d2019,
      name = "Solomon Islands 2019 Population Census Report Basic Tables & Operations Vol 2, Table P8.2: Total population by province and religious denominations",
      provider = "Solomon Islands National Statistics Office (SINSO)",
      url = url_2019, retrieval_date = retrieval_date, local_path = path_2019,
      licence = list(name = licence_pending, url = sinso_home_url,
                     attribution = "Solomon Islands National Statistics Office, 2019 Population and Housing Census"),
      citation = "Solomon Islands National Statistics Office, 2019 Population and Housing Census, Basic Tables & Operations Vol 2, Table P8.2.",
      access_limits = NULL,
      redistribution_limits = "Derived province summaries only; no reuse licence is stated on the SINSO source. Ships STAGED pending a PI ruling.",
      notes = paste("All persons, all ages; 17-category frame. Both margins close exactly to the printed national",
                    "total of 720,956. Pentecostal, Assembly of God, Muslim, and Baptist Church split out of the 2009",
                    "'Other'; three lines widen their label (Christian OutReach Church, Bahai Faith, Custom Beliefs or",
                    "Animism, No Religion or Faith/Atheism). The national totals reconcile with the 2019 National",
                    "Report Table 8.3.1 (Church of Melanesia 232,041; national 720,956).")),
    list(
      source_dataset_id = d_boundary,
      name = "geoBoundaries SLB ADM1 (10 provinces)",
      provider = "geoBoundaries (William & Mary geoLab); boundary source Natural Earth",
      url = boundary_url, retrieval_date = retrieval_date, local_path = boundary_path,
      licence = list(name = "Public Domain", url = boundary_meta_url,
                     attribution = "geoBoundaries (gbOpen); boundary source Natural Earth"),
      citation = "geoBoundaries SLB ADM1 (gbOpen, pinned 9469f09), 10 province boundaries.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary is committed under Public Domain (Natural Earth via geoBoundaries); no attribution obligation on the geometry.",
      notes = paste("10 ADM1 provinces, boundaryYearRepresented 2021, joined one-to-one to the census provinces after a",
                    "three-name concordance (Makira-Ulawa/Makira, Rennell-Bellona/Rennell and Bellona, Honiara/Capital",
                    "Territory (Honiara)). The extent spans lon 155.5-168.8E and lat 12.3-6.6S, wholly east of and far",
                    "from the antimeridian; no dateline handling is needed."))
  )
}

indicators <- function() {
  denom_note <- paste(
    "Percentages use each province's printed census population Total. The Refuse to",
    "Answer line stays in the denominator and outside both headline numerators, so",
    "the two shares need not sum to 100%.")
  list(
    list(indicator_id = "population_total", label = "Census population total",
         description = "Province all-persons population represented in the wave's religion table.",
         unit = "count", denominator_indicator_id = NULL,
         method = "Printed province Total: 2009 Table P3.2, 2019 Table P8.2.",
         temporal_coverage = "2009; 2019", spatial_coverage = "Solomon Islands provinces (10)",
         quality_notes = "Every wave counts all persons of all ages; there is no universe break, so province denominators are directly comparable across 2009-2019. The population grows from 515,870 to 720,956 (+39.8%); this is a population change, never a religion change."),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
         description = "Share of the province population reporting affiliation with a named religion or belief tradition.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (population - No Religion - Refuse to Answer) / population. Custom Beliefs (2009) / Custom Beliefs or Animism (2019) counts as a religious affiliation.",
         temporal_coverage = "2009; 2019", spatial_coverage = "Solomon Islands provinces (10)",
         quality_notes = paste("Broad affiliation is comparable across both waves; the 2019 split-out of Pentecostal, Assembly of God, Muslim, and Baptist Church from the 2009 'Other' does not change the has-a-religion total. The 2009 'Other' (14,076) and 2019 'Other religions' (14,953) lines are not comparable (the split-out).", denom_note)),
    list(indicator_id = "no_religion_percent", label = "No religious affiliation %",
         description = "Share in the census No Religion line (No Religion in 2009; No Religion or Faith/Atheism in 2019).",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (No Religion line) / population. Refuse to Answer is not part of this slot.",
         temporal_coverage = "2009; 2019", spatial_coverage = "Solomon Islands provinces (10)",
         quality_notes = paste("The no-religion population is very small (national 681 in 2009, 1,227 in 2019). The 2019 line widens its label to 'No Religion or Faith/Atheism'; the construct is the same no-religion slot.", denom_note))
  )
}

visual_layers <- function() {
  list(
    list(visual_layer_id = "sb-province-religious-affiliation", label = "Religious affiliation %",
         description = "Solomon Islands census-affiliation share by province.", layer_type = "choropleth",
         indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "province all-persons population, including a Refuse-to-Answer residual"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "reported province value", uncertainty_display = "quality_flag",
         default_visibility = TRUE,
         notes = "Census affiliation, not practice, attendance, or membership. Comparable across both waves at the broad-affiliation level."),
    list(visual_layer_id = "sb-province-no-religion", label = "No religious affiliation %",
         description = "Solomon Islands census no-religion share by province.", layer_type = "choropleth",
         indicator_ids = list("no_religion_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "province all-persons population"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "reported province value", uncertainty_display = "quality_flag",
         default_visibility = FALSE,
         notes = "The source category is No Religion (2009) / No Religion or Faith/Atheism (2019). Refuse to Answer is excluded from this slot.")
  )
}

summary_product <- list(
  schema_version = "area-summary.v1", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code,
                      level = boundary_level, vintage = boundary_vintage, source_dataset_id = d_boundary),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "No governed place-of-worship snapshot ships in the Solomon Islands census product.",
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

# record one cached source with its retrieval hash and durable mirror.
raw_source_record <- function(path, url, format, used, periods, dataset_id, notes) {
  list(uri = path, url = url, format = format, bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = NULL, source_dataset_id = dataset_id, used_in_public_product = used,
       periods = periods, notes = notes,
       local_cache_hint = paste0(path, " (git-ignored by .gitignore data/ rule)"),
       raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/sb_census/"))
}

# record one generated file in the manifest.
durable_file_record <- function(path, content, licence_status_value, licence_basis_value) {
  list(uri = paste0("repo:", path), storage_provider = "git_repository", format = sub("^.*\\.", "", path),
       bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = if (grepl("area_summary|\\.csv$", path)) row_count_file(path) else NULL,
       feature_count = if (grepl("\\.geojson$", path)) row_count_file(path) else NULL,
       content = content, privacy = "public",
       licence_status = licence_status_value, licence_basis = licence_basis_value)
}

licence_basis_slug <- "sinso_no_stated_terms_pending_pi_ruling"

raw_sources <- list(
  raw_source_record(path_2009, url_2009, "pdf", TRUE, "2009", d2009,
    "2009 Basic Tables Vol 2 (SPREP mirror of the SINSO/SPC file); Table P3.2 Religion by Province. Both margins close to 515,870."),
  raw_source_record(path_2019, url_2019, "pdf", TRUE, "2019", d2019,
    "2019 Basic Tables & Operations Vol 2 (SINSO / SIG portal); Table P8.2 Religion by Province. Both margins close to 720,956."),
  raw_source_record(path_2019_national, url_2019_national, "pdf", FALSE, "2019", d2019,
    "2019 National Report Vol 1; cross-source anchor (Table 8.3.1 national religion totals reconcile with P8.2), not a province table source."),
  raw_source_record(boundary_path, boundary_url, "geojson", TRUE, "2021", d_boundary,
    "geoBoundaries SLB ADM1 GeoJSON; 10 provinces, Public Domain (Natural Earth). Pinned commit 9469f09."),
  raw_source_record(boundary_meta_path, boundary_meta_url, "json", FALSE, "2021", d_boundary,
    "geoBoundaries SLB ADM1 metadata; records Public Domain, boundarySource 'Natural Earth', boundaryYearRepresented 2021, admUnitCount 10.")
)

dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)
dataset_id <- "sb-census-religion:sb:2009-2019:sinso-province"

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
  dataset_family = "sb-census-religion", dataset_role = "staged_evidence",
  scope = list(level = "country", country_codes = list("SB"), snapshot_date = NULL,
               snapshot_anchor = NULL, pipeline_stage = "staged"),
  created_at = stamp, created_by = script_id,
  target_years = list(2009L, 2019L),
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation",
      shipped_waves = list(2009L, 2019L),
      shipped_geography = "10 Solomon Islands provinces (nine provinces plus Honiara)",
      boundary_set = boundary_set_id,
      source_tables = list(
        `2009` = "Basic Tables Vol 2 Table P3.2 Total population by province and religious denomination (all persons, all ages)",
        `2019` = "Basic Tables Vol 2 Table P8.2 Total population by province and religious denominations (all persons, all ages)"
      ),
      universes = list(
        `2009` = "all persons, all ages",
        `2019` = "all persons, all ages"
      ),
      denominators = list(
        `2009` = "printed province Total; affiliation = population - No Religion - Refuse to Answer",
        `2019` = "printed province Total; affiliation = population - No Religion or Faith/Atheism - Refuse to Answer"
      ),
      slot_design = paste(
        "Ordinary two-slot (FM/KI precedent, not the minority-share design).",
        "religious_affiliation_percent is the summed share of every religious-affiliation category;",
        "Custom Beliefs (2009) / Custom Beliefs or Animism (2019) is counted as a religious affiliation",
        "because it names a belief tradition, not its absence. no_religion_percent is the single No",
        "Religion line (No Religion in 2009; No Religion or Faith/Atheism in 2019). The Refuse to Answer",
        "line stays in the denominator and in neither slot, so the two shares need not sum to 100 (the FJ",
        "unallocated-residual precedent)."
      ),
      category_frames = list(
        `2009` = as.list(cat_2009),
        `2019` = as.list(cat_2019),
        alignment_note = paste(
          "Both waves share one all-persons universe, so there is no universe break and broad affiliation is",
          "comparable across the 2009-2019 pair. The broad denominational spine (Church of Melanesia, Roman",
          "Catholic, South Sea Evangelical Church, Seventh Day Adventist, United Church, Christian Fellowship",
          "Church, Christian OutReach(Church), Jehovah's Witness, Bahai(Faith), plus the always-separate Custom",
          "Beliefs, No Religion, and Refuse to Answer) is comparable across both waves. The 2019 frame splits",
          "Pentecostal, Assembly of God, Muslim, and Baptist Church out of the 2009 'Other', so the 2009 'Other'",
          "(14,076) and 2019 'Other religions' (14,953) lines are not comparable. Three lines widen their label",
          "in 2019 (Christian OutReach Church, Bahai Faith, Custom Beliefs or Animism, No Religion or",
          "Faith/Atheism); same body, widened label. Frames are preserved verbatim per wave and never merged."
        )
      ),
      change_rule = paste(
        "Broad religious-affiliation change is readable across both waves (2009, 2019) because every wave counts",
        "all persons of all ages with no universe break. Only the Other-line detail is incomparable (the 2019",
        "split-out); the affiliation-share change is honest, so no change_withheld flag is emitted. The population",
        "grows sharply (515,870 to 720,956, +39.8%); shares are read within each province's own wave denominator",
        "and the growth is never treated as a religion change."
      ),
      no_religion_treatment = list(
        `2009` = "single No Religion line; Refuse to Answer is a separate residual, excluded from this slot",
        `2019` = "single No Religion or Faith/Atheism line; Refuse to Answer is a separate residual, excluded from this slot"
      ),
      other_line_comparability = paste(
        "The 2009 'Other' (14,076) and the 2019 'Other religions' (14,953) are NOT comparable: Pentecostal,",
        "Assembly of God, Muslim, and Baptist Church are printed as separate 2019 lines but folded into the 2009",
        "'Other'. A per-row quality flag discloses the incomparability; the broad affiliation-share change is",
        "unaffected because those bodies count as religious affiliation in both waves."
      ),
      microdata_position = paste(
        "The Pacific Data Hub / SPC microdata are not the route and are unused; the build reads only the published",
        "aggregate Basic Tables, so no PDH access restriction binds the product."
      ),
      held_earlier_waves = paste(
        "1999 religion is published nationally only (2019 National Report Table 8.3.1: national 409,042) with no",
        "religion-by-province table located; 1986 predates the current province geography (Choiseul separated from",
        "Western in 1991, Rennell-Bellona from Central in 1993). Both are HELD: no backcast, no national-context",
        "rows in this province product."
      ),
      omitted_metrics = list("places_per_10000_residents", "place_density_per_sq_km"),
      boundary_simplification = simplification,
      local_cache_hint = "All raw sources are cached under data/raw/sb_census/ and remain git-ignored.",
      retrieval_record = raw_sources
    ),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")), digest = as.character(packageVersion("digest")),
      mapshaper = "scripts/lib/simplify_boundary.R (npx mapshaper)"
    )
  ),
  source = list(
    provider = "Solomon Islands National Statistics Office (SINSO); SPREP (2009 mirror); geoBoundaries (William & Mary geoLab)",
    source_dataset_ids = list(d2009, d2019, d_boundary),
    source_urls = list(url_2009, url_2019, url_2019_national, boundary_url, boundary_meta_url),
    retrieved_at = stamp,
    licence = paste(
      "No reuse licence is stated on the SINSO census religion tables in either wave (2009 Basic Tables Vol 2,",
      "2019 Basic Tables Vol 2). The SINSO website footer asserts 'Copyright 2023 @ Solomon Islands National",
      "Statistics Office' (a copyright assertion, not a reuse grant). The SPREP re-host of the 2009 file attaches",
      "a Creative Commons Public Data License, which governs the SPREP mirror, not the SINSO original. The derived",
      "province summaries carry attribution to SINSO and ship STAGED pending a PI licence ruling under the",
      "summaries-not-raw-data stance (as with Palau, FSM, Kiribati). Boundaries are geoBoundaries SLB ADM1, Public",
      "Domain, boundary source Natural Earth."
    ),
    citation = "SINSO 2009 Basic Tables Vol 2 Table P3.2; SINSO 2019 Basic Tables Vol 2 Table P8.2; geoBoundaries SLB ADM1 (gbOpen).",
    raw_redistribution = "The census PDFs and the geoBoundaries source GeoJSON are not committed; they remain in data/raw/sb_census/.",
    local_cache_hint = "data/raw/sb_census/ (git-ignored by .gitignore data/ rule)",
    raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/sb_census/")
  ),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = list(
    durable_file_record(summary_json_out, "Solomon Islands 10-province census-affiliation area summary for 2009 and 2019.", "needs_review", licence_basis_slug),
    durable_file_record(summary_csv_out, "Flattened Solomon Islands 10-province census-affiliation rows for 2009 and 2019.", "needs_review", licence_basis_slug),
    durable_file_record(boundary_out, "Simplified geoBoundaries SLB ADM1 10-province boundary GeoJSON.", "accepted", "geoboundaries_public_domain")
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id,
         notes = "10 provinces x 2 waves = 20 rows; all-persons universe in every wave; no suppressed cells."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out), built_by = script_id,
         notes = "10 province features from geoBoundaries SLB ADM1, simplified with mapshaper weighted keep-shapes.")
  ),
  validation = list(
    status = "passed_with_warnings",
    commands = list(
      paste("Rscript", script_id),
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/sb/data/area_summary_province.json",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/data-manifest.schema.json docs/manifests/sb-census-religion-2009-2019.json"
    ),
    gate_2009 = list(status = "passed", both_margins_close_to = national_2009,
                     province_column_checks = 10L, religion_row_checks = length(cat_2009),
                     records = reconciliation_block(rec_2009)),
    gate_2019 = list(status = "passed", both_margins_close_to = national_2019,
                     province_column_checks = 10L, religion_row_checks = length(cat_2019),
                     records = reconciliation_block(rec_2019)),
    boundary_validation = list(status = "passed", feature_count = 10L,
                               distinct_geometry_hashes = length(unique(geom_hashes)),
                               geometry_hashes = as.list(geom_hashes),
                               bbox = list(xmin = unname(bbox[["xmin"]]), ymin = unname(bbox[["ymin"]]),
                                           xmax = unname(bbox[["xmax"]]), ymax = unname(bbox[["ymax"]])),
                               dateline_note = "extent lon 155.5-168.8E, lat 12.3-6.6S; wholly east of and far from the antimeridian, no dateline handling needed",
                               output_bytes = file_bytes(boundary_out), simplification = simplification,
                               licence = boundary_metadata[["boundaryLicense"]], adm_unit_count = boundary_metadata[["admUnitCount"]]),
    join_coverage = list(matched_provinces = 10L, expected_provinces = 10L, unmatched_provinces = list(), unused_boundary_features = list()),
    notes = paste(
      "2009 P3.2 and 2019 P8.2 each close exactly at both margins: every province column and every religion row",
      "sum to the printed national total (515,870 in 2009, 720,956 in 2019), and both margins reconcile. Boundary",
      "joins 10/10 to geoBoundaries SLB ADM1 with 10 distinct geometry hashes."
    ),
    warnings = list(
      "STAGED product: no page, no hub link. Licence needs review pending a PI ruling; no reuse terms are stated on either wave's SINSO religion table.",
      "The 2009 'Other' (14,076) and 2019 'Other religions' (14,953) lines are not comparable: Pentecostal, Assembly of God, Muslim, and Baptist Church split out of the 2009 'Other' in 2019. Disclosed per row; the broad affiliation-share change is unaffected.",
      "The boundary file, boundary_set_id, and vintage carry 2021 (the geoBoundaries boundaryYearRepresented), superseding the route brief's 'sb_province_2019' filename; the underlying release is identical.",
      "Custom Beliefs (2009) / Custom Beliefs or Animism (2019) is counted as a religious affiliation, not as no-religion.",
      "The Refuse to Answer line is a disclosed residual kept in the denominator and in neither headline slot, so the affiliation and no-religion shares need not sum to 100%."
    )
  ),
  construct_notes = list(
    "The construct is census affiliation: each resident's reported religion (questionnaire item P11, 'What is this person's religion?', asked of all persons of all ages), not practice, attendance, or membership.",
    "The public product carries three headline fields per province-wave: population total, religious affiliation percent, and no-religion percent. Place-density metrics are null (no governed place-of-worship snapshot).",
    "Every wave counts all persons of all ages, so there is no universe break and the province denominators are directly comparable across 2009 and 2019. Broad religious affiliation is therefore comparable across the pair.",
    "Slot design (ordinary two-slot, FM/KI precedent): religious_affiliation_percent is the summed share of every religious-affiliation category; Custom Beliefs (2009) / Custom Beliefs or Animism (2019) is counted as a religious affiliation because it names a belief tradition, not its absence. no_religion_percent is the single No Religion line. The Refuse to Answer line is a disclosed residual kept in the denominator and in neither slot, so the two shares need not sum to 100.",
    "The 2019 seventeen-way frame splits Pentecostal, Assembly of God, Muslim, and Baptist Church out of the 2009 'Other'; the 2009 'Other' (14,076) and 2019 'Other religions' (14,953) are therefore not comparable. The broad affiliation-share change across the pair is honest and no change_withheld flag is emitted; only the Other-line detail is incomparable, disclosed per row.",
    "The population grows sharply across the pair (515,870 to 720,956, +39.8%). The build reads religious shares within each province's own wave denominator and never treats population growth as a religion change.",
    "Earlier waves are HELD: 1999 religion is published nationally only (2019 National Report Table 8.3.1: national 409,042) with no religion-by-province table located, and 1986 predates the current province geography (Choiseul split from Western in 1991, Rennell-Bellona from Central in 1993). No backcast and no national-context rows ship in this province product.",
    "Boundary: geoBoundaries SLB ADM1, 10 provinces, Public Domain (Natural Earth). The ten provinces join one-to-one after a three-name concordance (Makira-Ulawa/Makira, Rennell-Bellona/Rennell and Bellona, Honiara/Capital Territory (Honiara)). The extent spans lon 155.5-168.8E and lat 12.3-6.6S, far from the antimeridian; no dateline handling is needed."
  ),
  deferred_sources = list(
    list(source_dataset_id = "sb-census-2009-2019-ward-level", status = "deferred",
         url = url_2019, local_path = NULL,
         notes = paste("Religion is published by ward in both waves (P3.1 in 2009, P8.3 in 2019, ~180 wards), a richer",
                       "geography than the province, but geoBoundaries offers only ADM1 (10 provinces) and ADM2 (50",
                       "constituencies, not the census wards). A ward-level product needs a ward boundary layer located",
                       "and licensed first; a future-research route.")),
    list(source_dataset_id = "sb-census-1999-religion-by-province", status = "deferred",
         url = url_2019_national, local_path = NULL,
         notes = paste("1999 religion is published nationally only (national 409,042 in the 2019 National Report Table",
                       "8.3.1). No 1999 religion-by-province table was located; extending the series before 2009 needs",
                       "the 1999 census volumes recovered.")),
    list(source_dataset_id = "sinso-licence-confirmation", status = "not_pinned",
         url = sinso_home_url, local_path = NULL,
         notes = "A SINSO reuse-confirmation email is the clean unblock for the licence gate (PI ruling); none is held.")
  ),
  privacy = "public",
  licence_status = "needs_review",
  licence_basis = licence_basis_slug,
  downstream_status = "staged",
  source_datasets = source_datasets(),
  notes = paste(
    "STAGED product (no page, no hub link) pending a PI licence ruling. The committed products are the derived",
    "10-province area summary (20 rows across 2009 and 2019) and the simplified geoBoundaries SLB ADM1 boundary.",
    "On-page attribution, when a page is built, must cite the Solomon Islands National Statistics Office (SINSO)",
    "and geoBoundaries (Public Domain, Natural Earth)."
  )
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

cat("waves shipped: 2009, 2019 (all persons) on 10 Solomon Islands provinces\n")
cat(sprintf("rows: %d (10 provinces x 2 waves)\n", length(rows)))
cat(sprintf("gate 2009: passed; both margins close to %d\n", national_2009))
cat(sprintf("gate 2019: passed; both margins close to %d\n", national_2019))
cat(sprintf("boundary gate: passed; 10/10 join, %d distinct geometry hashes, %d bytes at %g%% keep\n",
            length(unique(geom_hashes)), file_bytes(boundary_out), simplification[["keep_percent"]]))
cat("change: broad affiliation comparable across both waves; 2009 Other vs 2019 Other religions not comparable\n")
cat("licence gate: needs_review; STAGED pending PI ruling; no reuse terms stated on either wave\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", boundary_out))
cat(sprintf("wrote %s\n", manifest_out))
