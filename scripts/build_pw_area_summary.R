# build the Palau state census-religion area-summary product for 2005, 2015, 2020.
# inputs (all cached, git-ignored, verified by sha256 in the route probe):
#   data/raw/pw_census/pw_2005_census_monograph.pdf  -> Table 10.1 (text-extractable)
#   data/raw/pw_census/pw_2015_census_vol1.pdf       -> Table 42 (image page 53)
#   data/raw/pw_census/pw_2020_census_vol1.pdf        -> Table 42 (image page 53)
#   data/raw/pw_census/geoBoundaries-PLW-ADM1.geojson -> 16-state ADM1 boundary
#   data/raw/pw_census/gb_plw_adm1_meta.json          -> boundary licence metadata
# the three census tables are transcribed verbatim into this script (2015/2020 from
# 150 dpi image renders; 2005 from pdftotext) and reconciled at both margins here;
# the build stops on any margin mismatch and never allocates, infers, or tunes a cell.
# outputs: apps/regions/pw/data/pw_state_2017.geojson,
#   apps/regions/pw/data/area_summary_state.{json,csv}, and
#   docs/manifests/pw-census-religion-2005-2020.json.
# run from the repo root: Rscript scripts/build_pw_area_summary.R
# this is a STAGED product: no page, no hub link; licence needs review pending a PI ruling.

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "PW"
script_id <- "scripts/build_pw_area_summary.R"
raw_dir <- "data/raw/pw_census"
product_dir <- "apps/regions/pw/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-11"
stamp <- paste0(retrieval_date, "T00:00:00Z")
boundary_level <- "state"
boundary_set_id <- "pw-state-2017-geoboundaries-adm1"

d2005 <- "pw-census-2005-monograph-table-10-1"
d2015 <- "pw-census-2015-basic-tables-table-42"
d2020 <- "pw-census-2020-basic-tables-table-42"
d_boundary <- "geoboundaries-plw-adm1-2017"

monograph_2005_url <- "https://www.palaugov.pw/wp-content/uploads/2016/03/2005-Census-Monograph-Report.pdf"
basic_2015_url <- "https://www.palaugov.pw/wp-content/uploads/2017/02/2015-Census-of-Population-Housing-Agriculture-.pdf"
basic_2020_url <- "https://www.palaugov.pw/wp-content/uploads/2022/09/2020-Census-of-Population-and-Housing.pdf"
census_hub_url <- "https://www.palaugov.pw/executive-branch/ministries/finance/budgetandplanning/census-of-population-and-housing/"
boundary_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/PLW/ADM1/geoBoundaries-PLW-ADM1.geojson"
boundary_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/PLW/ADM1/"

monograph_2005_path <- file.path(raw_dir, "pw_2005_census_monograph.pdf")
basic_2015_path <- file.path(raw_dir, "pw_2015_census_vol1.pdf")
basic_2020_path <- file.path(raw_dir, "pw_2020_census_vol1.pdf")
census_hub_path <- file.path(raw_dir, "palaugov_census_hub.html")
boundary_path <- file.path(raw_dir, "geoBoundaries-PLW-ADM1.geojson")
boundary_meta_path <- file.path(raw_dir, "gb_plw_adm1_meta.json")

boundary_out <- file.path(product_dir, "pw_state_2017.geojson")
summary_json_out <- file.path(product_dir, "area_summary_state.json")
summary_csv_out <- file.path(product_dir, "area_summary_state.csv")
manifest_out <- file.path(manifest_dir, "pw-census-religion-2005-2020.json")

# canonical state order (alphabetical by the display name the product carries).
states <- c(
  "Aimeliik", "Airai", "Angaur", "Hatohobei", "Kayangel", "Koror",
  "Melekeok", "Ngaraard", "Ngarchelong", "Ngardmau", "Ngaremlengui",
  "Ngatpang", "Ngchesar", "Ngiwal", "Peleliu", "Sonsorol"
)

# geoBoundaries shapeName per canonical state; two spellings diverge from the census.
gb_name <- c(
  Aimeliik = "Aimeliik", Airai = "Airai", Angaur = "Angaur", Hatohobei = "Hatohobei",
  Kayangel = "Kayangel", Koror = "Koror", Melekeok = "Melekeok", Ngaraard = "Ngaraard",
  Ngarchelong = "Ngarchelong", Ngardmau = "Ngardmau", Ngaremlengui = "Ngeremlengui",
  Ngatpang = "Ngatpang", Ngchesar = "Ngchesar", Ngiwal = "Ngiwal", Peleliu = "Peleliu",
  Sonsorol = "Sonsorol"
)

# helper: build a named-by-state count vector from values given in canonical order.
sv <- function(...) setNames(as.integer(c(...)), states)

# the 2015 and 2020 Table 42 image columns run in this printed order; iv() takes
# values in that image order and reorders them to the canonical state order so a
# manual reordering slip cannot mis-assign a cell.
img_order <- c("Kayangel", "Ngarchelong", "Ngaraard", "Ngiwal", "Melekeok", "Ngchesar",
               "Airai", "Aimeliik", "Ngatpang", "Ngardmau", "Ngaremlengui", "Angaur",
               "Peleliu", "Koror", "Sonsorol", "Hatohobei")
iv <- function(...) {
  v <- setNames(as.integer(c(...)), img_order)
  v[states]
}

# ---- 2005 Table 10.1 (all persons, all ages; nine-way frame) --------------------
# category order: Modekngei, Catholic, Evangelical, Seventh Day Adventist, Mormons,
# Jehovah's Witnesses, Other Protestants, Other religion, None or refused.
cat_2005 <- c("Modekngei", "Catholic", "Evangelical", "Seventh Day Adventist",
              "Mormons", "Jehovah's Witnesses", "Other Protestants",
              "Other religion", "None or refused")
# vectors are in canonical state order (Aimeliik..Sonsorol).
m2005 <- list(
  Modekngei              = sv(29, 123,   0,  0, 128, 891,  12,  29, 156, 10,  46, 208,   2,  3,  96,  0),
  Catholic               = sv(91,1002, 264, 44,  44,7151, 198, 245,  76, 33,  81, 110,  82, 86, 224, 94),
  Evangelical            = sv(70, 436,  42,  0,  14,2645, 146,  82, 220, 79, 174, 108, 146,124, 324,  0),
  `Seventh Day Adventist`= sv(36, 345,   8,  0,   0, 542,  10,   1,   0,  5,  11,  36,  14,  1,  31,  6),
  Mormons                = sv( 0,   7,   0,  0,   0, 132,   4,   0,   0,  0,   0,   0,   0,  0,   0,  0),
  `Jehovah's Witnesses`  = sv( 2,  61,   0,  0,   0, 120,   0,   0,   0, 36,   0,   0,   2,  1,   0,  0),
  `Other Protestants`    = sv( 0,  71,   0,  0,   0, 216,   0, 204,   0,  2,   0,   0,   0,  0,   0,  0),
  `Other religion`       = sv(42, 467,   6,  0,   2, 972,  21,  18,  36,  0,   5,   2,   7,  8,  27,  0),
  `None or refused`      = sv( 0, 211,   0,  0,   0,   7,   0,   2,   0,  1,   0,   0,   1,  0,   0,  0)
)
# printed control margins for 2005.
total_2005_state <- sv(270,2723,320,44,188,12676,391,581,488,166,317,464,254,223,702,100)
total_2005_cat <- c(Modekngei = 1733L, Catholic = 9825L, Evangelical = 4610L,
                    `Seventh Day Adventist` = 1046L, Mormons = 143L,
                    `Jehovah's Witnesses` = 222L, `Other Protestants` = 493L,
                    `Other religion` = 1613L, `None or refused` = 222L)
national_2005 <- 19907L

# ---- 2015 Table 42 (persons 18+; nine-way frame) --------------------------------
cat_1520 <- c("Catholic", "Evangelical", "Seven Day Adventist", "Assembly of God",
              "Baptist", "Muslim", "Mormons", "Modekngei", "Other")
# values below run in img_order (Kayangel, Ngarchelong, Ngaraard, Ngiwal, Melekeok,
# Ngchesar, Airai, Aimeliik, Ngatpang, Ngardmau, Ngaremlengui, Angaur, Peleliu, Koror,
# Sonsorol, Hatohobei); iv() reorders each to the canonical state order.
m2015 <- list(
  Catholic               = iv( 43,  89, 260, 146, 188,  79, 289, 128,  44,  54,  76, 156, 155,1626, 116,  79),
  Evangelical            = iv( 52, 261, 273, 187, 119, 184, 210, 106,  95,  87, 137,  35, 224, 829,   0,   1),
  `Seven Day Adventist`  = iv(  7,  19,   8,  12,  10,  20, 196,  51,  27,   6,  31,  12,  41, 229,   0,   0),
  `Assembly of God`      = iv(  0,  19,   5,   1,   0,   1,   6,   3,   6,   0,   2,   0,   1,  33,   0,   0),
  Baptist                = iv(  1,   1,   1,   0,   0,   2,   0,   1,   0,   0,   0,   0,   1,   4,   0,   0),
  Muslim                 = iv(  0,   1,   0,   0,   3,   0,   1,   0,   0,   0,   0,   0,   0,   2,   0,   0),
  Mormons                = iv(  5,   4,   5,   0,   4,   1,   9,   3,   2,   8,   3,   0,   3,  92,   0,   0),
  Modekngei              = iv( 68, 119,  44,   6,   8,   0,  56,  37,  99,   7,  52,   4,  55, 217,   0,   0),
  Other                  = iv( 24,  20,   9,   8,  20,   3,  61,  19,  12,  34,  11,   7,  11, 133,   1,   0)
)
total_2015_state <- iv(200,533,605,360,352,290,828,348,285,196,312,214,491,3165,117,80)
total_2015_cat <- c(Catholic = 3528L, Evangelical = 2800L, `Seven Day Adventist` = 669L,
                    `Assembly of God` = 77L, Baptist = 11L, Muslim = 7L, Mormons = 139L,
                    Modekngei = 772L, Other = 373L)
palau_total_2015 <- 8376L

# ---- 2020 Table 42 (persons 18+; nine-way frame; no printed Palau subtotal) ------
# NOTE for 2020 the printed overall Total column also includes six overseas
# legal-residence columns; those are transcribed only to reconcile the Total column.
# values below run in img_order; iv() reorders each to the canonical state order.
m2020 <- list(
  Catholic               = iv( 46, 110, 262, 144, 221,  82, 368, 168,  52,  57,  90, 147, 151,1925, 134,  84),
  Evangelical            = iv( 53, 276, 242, 193, 163, 197, 251, 130,  87, 122, 161,  50, 246, 913,   3,   1),
  `Seven Day Adventist`  = iv(  6,  19,   4,   8,  15,  19, 169,  48,  31,   7,  24,   4,  23, 182,   0,   0),
  `Assembly of God`      = iv(  1,  16,   9,   1,   0,   2,   6,   3,   7,   1,   2,   1,   2,  19,   3,   0),
  Baptist                = iv(  1,   2,   3,   0,   0,   0,   2,   1,   0,   1,   0,   3,   0,   5,   0,   0),
  Muslim                 = iv(  0,   2,   1,   1,   1,   3,  10,   8,   2,   0,   0,   0,   0,  38,   0,   0),
  Mormons                = iv(  0,   6,   2,   0,   5,   0,  11,   1,   1,   1,   2,   0,   3,  77,   0,   0),
  Modekngei              = iv( 88, 107,  24,   7,   4,   3,  57,  27,  86,   8,  46,   3,  53, 173,   0,   0),
  Other                  = iv( 14,  24,  23,   9,  13,   5,  87,  34,  19,  40,  16,  18,  25, 333,   2,   1)
)
total_2020_state <- iv(209,562,570,363,422,311,961,420,285,237,341,226,503,3665,142,86)
# printed overall Total column (states + six overseas legal-residence columns).
total_2020_cat_all <- c(Catholic = 6363L, Evangelical = 3335L, `Seven Day Adventist` = 676L,
                        `Assembly of God` = 113L, Baptist = 71L, Muslim = 661L, Mormons = 122L,
                        Modekngei = 689L, Other = 1546L)
# overseas legal-residence columns per category (Philippines, China/Taiwan,
# USA/Guam/CNMI, Fed States Micronesia, Other countries, Unknown).
overseas_2020 <- list(
  Catholic               = c(2069,10,37,75,50,81),
  Evangelical            = c(135,10,16,29,34,23),
  `Seven Day Adventist`  = c(92,2,3,3,6,11),
  `Assembly of God`      = c(29,1,2,1,7,0),
  Baptist                = c(27,5,7,3,8,3),
  Muslim                 = c(14,1,0,1,547,32),
  Mormons                = c(8,0,0,1,3,1),
  Modekngei              = c(1,0,1,1,0,0),
  Other                  = c(271,297,50,14,215,36)
)
overall_total_2020 <- 13576L
state_sum_2020 <- 9303L

# ---- reconciliation gates (fail-fast; stop, do not tune) ------------------------

# reconcile one wave at both margins against the printed controls.
reconcile_wave <- function(mat, cats, state_totals, cat_totals, grand, year) {
  records <- list()
  # margin 1: every state row's category sum equals the printed state total.
  for (s in states) {
    row_sum <- sum(vapply(cats, function(c) mat[[c]][[s]], integer(1)))
    if (row_sum != state_totals[[s]]) {
      stop(sprintf("%d row gate FAILED for %s: categories sum %d != printed total %d",
                   year, s, row_sum, state_totals[[s]]), call. = FALSE)
    }
    records[[length(records) + 1L]] <- data.frame(
      year = year, margin = "state_row", key = s,
      computed = row_sum, printed = state_totals[[s]], difference = 0L,
      stringsAsFactors = FALSE
    )
  }
  # margin 2: every category column's 16-state sum equals the printed category total.
  for (c in cats) {
    col_sum <- sum(mat[[c]])
    if (col_sum != cat_totals[[c]]) {
      stop(sprintf("%d column gate FAILED for %s: 16-state sum %d != printed %d",
                   year, c, col_sum, cat_totals[[c]]), call. = FALSE)
    }
    records[[length(records) + 1L]] <- data.frame(
      year = year, margin = "category_column", key = c,
      computed = col_sum, printed = cat_totals[[c]], difference = 0L,
      stringsAsFactors = FALSE
    )
  }
  # grand margin: both the printed state totals and the printed category totals
  # sum to the same national figure.
  if (sum(state_totals) != grand || sum(cat_totals) != grand) {
    stop(sprintf("%d grand gate FAILED: state-total sum %d, category-total sum %d, expected %d",
                 year, sum(state_totals), sum(cat_totals), grand), call. = FALSE)
  }
  do.call(rbind, records)
}

rec_2005 <- reconcile_wave(m2005, cat_2005, total_2005_state, total_2005_cat, national_2005, 2005L)
rec_2015 <- reconcile_wave(m2015, cat_1520, total_2015_state, total_2015_cat, palau_total_2015, 2015L)

# 2020 has no printed Palau subtotal: reconcile each state row, then use the overseas
# columns to close the printed overall Total column as a transcription control, and
# assert the 16-state grand sum equals the printed 9,303.
rec_2020 <- list()
for (s in states) {
  row_sum <- sum(vapply(cat_1520, function(c) m2020[[c]][[s]], integer(1)))
  if (row_sum != total_2020_state[[s]]) {
    stop(sprintf("2020 row gate FAILED for %s: %d != printed %d", s, row_sum, total_2020_state[[s]]), call. = FALSE)
  }
  rec_2020[[length(rec_2020) + 1L]] <- data.frame(
    year = 2020L, margin = "state_row", key = s, computed = row_sum,
    printed = total_2020_state[[s]], difference = 0L, stringsAsFactors = FALSE)
}
for (c in cat_1520) {
  total_col <- sum(m2020[[c]]) + sum(overseas_2020[[c]])
  if (total_col != total_2020_cat_all[[c]]) {
    stop(sprintf("2020 Total-column control FAILED for %s: states+overseas %d != printed %d",
                 c, total_col, total_2020_cat_all[[c]]), call. = FALSE)
  }
  rec_2020[[length(rec_2020) + 1L]] <- data.frame(
    year = 2020L, margin = "total_column_control", key = c, computed = total_col,
    printed = total_2020_cat_all[[c]], difference = 0L, stringsAsFactors = FALSE)
}
state_grand_2020 <- sum(total_2020_state)
if (state_grand_2020 != state_sum_2020) {
  stop(sprintf("2020 state gate FAILED: 16-state sum %d != expected %d", state_grand_2020, state_sum_2020), call. = FALSE)
}
if (sum(total_2020_cat_all) != overall_total_2020) {
  stop(sprintf("2020 Total-column gate FAILED: category Total sum %d != printed %d",
               sum(total_2020_cat_all), overall_total_2020), call. = FALSE)
}
rec_2020 <- do.call(rbind, rec_2020)

message(sprintf("gate 2005: PASSED (both margins close to %d)", national_2005))
message(sprintf("gate 2015: PASSED (Palau Total column and 16 states both close to %d)", palau_total_2015))
message(sprintf("gate 2020: PASSED (16 states sum %d; overall Total column control %d)",
                state_sum_2020, overall_total_2020))

# ---- boundary ------------------------------------------------------------------

# return a file's SHA-256 digest.
sha256_file <- function(path) unname(tools::sha256sum(path))
# return a file's size in bytes.
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))
# stop when a required cached input is absent or empty.
require_file <- function(path) {
  if (!file.exists(path) || file_bytes(path) == 0L) stop("missing required source: ", path, call. = FALSE)
}
# count rows or features in a generated product.
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$", path)) return(length(fromJSON(path, simplifyVector = FALSE)[["features"]]))
  if (grepl("\\.json$", path)) return(length(fromJSON(path, simplifyVector = FALSE)[["rows"]]))
  NA_integer_
}
# hash each feature's geometry (EWKB) to prove distinctness.
geometry_hashes <- function(layer) {
  vapply(seq_len(nrow(layer)), function(i) {
    digest(st_as_binary(st_geometry(layer)[i], EWKB = TRUE)[[1L]], algo = "sha256", serialize = FALSE)
  }, character(1))
}

required_inputs <- c(monograph_2005_path, basic_2015_path, basic_2020_path,
                     census_hub_path, boundary_path, boundary_meta_path)
invisible(lapply(required_inputs, require_file))

# confirm the pinned boundary licence, source, and unit count before use.
boundary_metadata <- fromJSON(boundary_meta_path, simplifyVector = FALSE)
if (!identical(boundary_metadata[["boundaryLicense"]], "Open Data Commons Open Database License 1.0") ||
    !identical(boundary_metadata[["admUnitCount"]], "16") ||
    !identical(boundary_metadata[["boundaryType"]], "ADM1")) {
  stop("geoBoundaries PLW ADM1 licence, unit count, or type metadata changed", call. = FALSE)
}

# palau-centred equal-area projection for land areas and geometry checks.
pw_laea <- "+proj=laea +lat_0=6 +lon_0=134 +datum=WGS84 +units=m +no_defs"

# join the 16 census states one-to-one to the geoBoundaries ADM1 features.
build_boundary <- function(path) {
  boundary <- st_read(path, quiet = TRUE, stringsAsFactors = FALSE)
  if (nrow(boundary) != 16L) stop("geoBoundaries PLW ADM1 feature count is not 16", call. = FALSE)
  idx <- match(unname(gb_name[states]), boundary[["shapeName"]])
  if (anyNA(idx) || anyDuplicated(idx) || !setequal(idx, seq_len(16L))) {
    stop("census states and geoBoundaries features do not join one-to-one", call. = FALSE)
  }
  boundary <- boundary[idx, ]
  boundary[["area_name"]] <- states
  boundary[["boundary_source_name"]] <- boundary[["shapeName"]]
  boundary[["area_code"]] <- boundary[["shapeID"]]
  boundary[["area_unit_id"]] <- paste(boundary_set_id, boundary[["shapeID"]], sep = ":")
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- boundary_level
  boundary[["boundary_vintage"]] <- "2017"
  boundary[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(boundary, pw_laea))) / 1e6
  boundary <- st_transform(st_make_valid(boundary), 4326)
  boundary[c("area_code", "area_name", "boundary_source_name", "area_unit_id",
             "boundary_set_id", "boundary_level", "boundary_vintage",
             "land_area_sq_km", "geometry")]
}

boundary <- build_boundary(boundary_path)

# full-extent gate: the bounding box must span the southwest outliers (Sonsorol,
# Hatohobei near 3N) and the northern atoll, not just the main Babeldaob cluster.
bbox <- st_bbox(boundary)
if (bbox[["ymin"]] > 3.5 || bbox[["ymax"]] < 7.5 || bbox[["xmin"]] > 131.5) {
  stop("boundary bbox does not span the full Palau extent (missing outlying states)", call. = FALSE)
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
if (nrow(written) != 16L) stop("simplified boundary does not contain 16 features", call. = FALSE)
w_valid <- st_is_valid(written)
if (any(st_is_empty(written)) || any(is.na(w_valid)) || any(!w_valid)) {
  stop("simplified boundary has empty or invalid geometries", call. = FALSE)
}
geom_hashes <- geometry_hashes(written)
if (length(unique(geom_hashes)) != 16L) stop("simplified boundary geometry hashes are not distinct", call. = FALSE)
message(sprintf("boundary: PASSED (16 valid distinct features, %d bytes at %g%% keep)",
                file_bytes(boundary_out), simplification[["keep_percent"]]))

land_area <- setNames(round(written[["land_area_sq_km"]], 4), written[["area_name"]])
area_unit <- setNames(written[["area_unit_id"]], written[["area_name"]])
area_code <- setNames(written[["area_code"]], written[["area_name"]])

# ---- product rows --------------------------------------------------------------

flag_2005 <- paste(
  "census_affiliation", "all_persons_all_ages_universe",
  "frame_2005_nine_way", "no_religion_is_none_or_refused_mixes_none_with_nonresponse",
  "change_withheld_universe_and_frame_break_vs_2015_2020",
  "licence_needs_review_pending_pi_ruling", "boundary_odbl_1_0",
  sep = ";")
flag_1520 <- paste(
  "census_affiliation", "persons_18_and_over_universe",
  "frame_2015_2020_nine_way", "no_religion_folded_into_other_no_separable_none",
  "affiliation_flat_by_construction_100_percent",
  "change_withheld_vs_2005_computable_2015_to_2020",
  "licence_needs_review_pending_pi_ruling", "boundary_odbl_1_0",
  sep = ";")
flag_2020_extra <- ";no_printed_palau_subtotal_16_state_denominator"

pop_basis_2005 <- paste(
  "2005 Census monograph Table 10.1, all persons of all ages;",
  "denominator is the printed state Total; religious affiliation is every named",
  "religion plus Other religion; None or refused is the no-religion slot and mixes",
  "persons with no religion and refusals to answer"
)
pop_basis_1520 <- paste(
  "2015/2020 Census Table 42, persons 18 years and over; denominator is the state",
  "column total; the report classifies persons with no religion into the Other",
  "category, so no separable no-religion count exists and religious affiliation",
  "equals the population by construction (flat at 100 percent)"
)

# build one schema-shaped area-summary row.
make_row <- function(s, year, pop, affiliation, no_religion, flag, basis, dataset_id) {
  no_rel_pct <- if (is.null(no_religion)) NULL else round(100 * no_religion / pop, 4)
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
    religious_affiliation_percent = round(100 * affiliation / pop, 4),
    no_religion_count = if (is.null(no_religion)) NULL else as.integer(no_religion),
    no_religion_percent = no_rel_pct,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = unname(land_area[[s]]),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(dataset_id, d_boundary),
    quality_flag = flag
  )
}

rows <- list()
for (s in states) {
  # 2005: affiliation excludes None or refused; no-religion slot is real.
  pop05 <- total_2005_state[[s]]
  none05 <- m2005[["None or refused"]][[s]]
  aff05 <- pop05 - none05
  rows[[length(rows) + 1L]] <- make_row(s, 2005L, pop05, aff05, none05, flag_2005, pop_basis_2005, d2005)
  # 2015: affiliation flat by construction; no separable no-religion.
  pop15 <- total_2015_state[[s]]
  rows[[length(rows) + 1L]] <- make_row(s, 2015L, pop15, pop15, NULL, flag_1520, pop_basis_1520, d2015)
  # 2020: same construct; extra flag for the missing printed subtotal.
  pop20 <- total_2020_state[[s]]
  rows[[length(rows) + 1L]] <- make_row(s, 2020L, pop20, pop20, NULL,
                                        paste0(flag_1520, flag_2020_extra), pop_basis_1520, d2020)
}

# ---- area-summary document -----------------------------------------------------

source_datasets <- function() {
  licence_pending <- paste(
    "No reuse licence is stated in any Palau Office of Planning and Statistics",
    "report or on the Pacific Data Hub. The derived state summaries carry",
    "attribution to the Palau Office of Planning and Statistics and ship STAGED",
    "pending a PI licence ruling (summaries-not-raw-data stance)."
  )
  list(
    list(
      source_dataset_id = d2005,
      name = "Palau 2005 Census Volume II Monograph, Table 10.1: Religion by State",
      provider = "Palau Office of Planning and Statistics (OPS)",
      url = monograph_2005_url, retrieval_date = retrieval_date, local_path = monograph_2005_path,
      licence = list(name = licence_pending, url = census_hub_url,
                     attribution = "Palau Office of Planning and Statistics, 2005 Census of Population and Housing"),
      citation = "Palau Office of Planning and Statistics, 2005 Census of Population and Housing, Volume II Monograph, Table 10.1.",
      access_limits = NULL,
      redistribution_limits = "Derived state summaries only; no reuse licence is stated. Ships STAGED pending a PI ruling.",
      notes = paste("All persons, all ages; nine-way frame with a distinct None or refused column (222 nationally).",
                    "Both margins close exactly to the printed national Total of 19,907.")
    ),
    list(
      source_dataset_id = d2015,
      name = "Palau 2015 Census of Population, Housing and Agriculture, Volume I Basic Tables, Table 42",
      provider = "Palau Office of Planning and Statistics (OPS)",
      url = basic_2015_url, retrieval_date = retrieval_date, local_path = basic_2015_path,
      licence = list(name = licence_pending, url = census_hub_url,
                     attribution = "Palau Office of Planning and Statistics, 2015 Census of Population, Housing and Agriculture"),
      citation = "Palau Office of Planning and Statistics, 2015 Census of Population, Housing and Agriculture, Volume I Basic Tables, Table 42.",
      access_limits = NULL,
      redistribution_limits = "Derived state summaries only; no reuse licence is stated. Ships STAGED pending a PI ruling.",
      notes = paste("Persons 18 and over; image-based table transcribed at 150 dpi and reconciled.",
                    "The nine categories on the printed Palau Total column and the 16 state columns both sum to 8,376.")
    ),
    list(
      source_dataset_id = d2020,
      name = "Palau 2020 Census of Population and Housing, Volume I Basic Tables, Table 42",
      provider = "Palau Office of Planning and Statistics (OPS)",
      url = basic_2020_url, retrieval_date = retrieval_date, local_path = basic_2020_path,
      licence = list(name = licence_pending, url = census_hub_url,
                     attribution = "Palau Office of Planning and Statistics, 2020 Census of Population and Housing"),
      citation = "Palau Office of Planning and Statistics, 2020 Census of Population and Housing, Volume I Basic Tables, Table 42.",
      access_limits = NULL,
      redistribution_limits = "Derived state summaries only; no reuse licence is stated. Ships STAGED pending a PI ruling.",
      notes = paste("Persons 18 and over; image-based table transcribed at 150 dpi and reconciled. No printed Palau",
                    "subtotal; the 16 state columns sum to 9,303 and the overall Total column (13,576, including overseas",
                    "legal-residence columns) is a transcription control, never the state denominator.")
    ),
    list(
      source_dataset_id = d_boundary,
      name = "geoBoundaries PLW ADM1 (16 states)",
      provider = "geoBoundaries (William & Mary geoLab); source OpenStreetMap, Wambacher",
      url = boundary_url, retrieval_date = retrieval_date, local_path = boundary_path,
      licence = list(name = "Open Data Commons Open Database License 1.0", url = boundary_meta_url,
                     attribution = "geoBoundaries (gbOpen); boundary source OpenStreetMap, Wambacher"),
      citation = "geoBoundaries PLW ADM1 (gbOpen, pinned 9469f09), 16 state boundaries.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary is committed with ODbL 1.0 attribution.",
      notes = paste("16 ADM1 states, boundaryYearRepresented 2017. Two spelling concordances: geoBoundaries",
                    "Ngeremlengui maps to census Ngaremlengui; the 2005 monograph spelling Ngerchelong maps to",
                    "canonical Ngarchelong. The extent spans latitude 2.75 to 8.09 North, including Sonsorol and Hatohobei.")
    )
  )
}

denominator_note <- paste(
  "Percentages use each state's printed population total. For 2005 (all ages)",
  "religious affiliation excludes None or refused, which is the no-religion slot.",
  "For 2015 and 2020 (persons 18 and over) the report folds persons with no",
  "religion into Other, so no separable no-religion count exists and affiliation",
  "is flat at 100 percent by construction."
)

indicators <- function() {
  list(
    list(indicator_id = "population_total", label = "Census population total",
         description = "State population represented in the wave's religion table.",
         unit = "count", denominator_indicator_id = NULL,
         method = "Printed state total: Table 10.1 (2005, all ages) or Table 42 state column (2015/2020, 18+).",
         temporal_coverage = "2005; 2015; 2020", spatial_coverage = "Palau states (16)",
         quality_notes = "The 2005 universe is all persons; the 2015 and 2020 universe is persons 18 and over. The level difference across 2005 and the later waves is a universe break, not change."),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
         description = "Share of the state population with a stated religious affiliation.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "2005: 100 * (Total - None or refused) / Total. 2015/2020: 100 by construction, no-religion folded into Other.",
         temporal_coverage = "2005; 2015; 2020", spatial_coverage = "Palau states (16)",
         quality_notes = "For 2015 and 2020 this metric is flat at 100 percent by construction and does not distinguish states."),
    list(indicator_id = "no_religion_percent", label = "No religious affiliation %",
         description = "Share in the 2005 None or refused category; null for 2015 and 2020.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "2005: 100 * None or refused / Total. 2015/2020: null (no separable no-religion category).",
         temporal_coverage = "2005", spatial_coverage = "Palau states (16)",
         quality_notes = "The 2005 None or refused category mixes persons with no religion and refusals to answer. The 2005 monograph prose claim of 'about 1 in 6' with no religion is refuted by its own table (222 of 19,907, near 1.1 percent); the table governs.")
  )
}

visual_layers <- function() {
  list(
    list(visual_layer_id = "pw-state-religious-affiliation", label = "Religious affiliation %",
         description = "Palau census-affiliation share by state.", layer_type = "choropleth",
         indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "state population total"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "reported state value", uncertainty_display = "quality_flag",
         default_visibility = TRUE,
         notes = "Census affiliation, not practice or membership. Flat at 100 percent for 2015 and 2020 by construction."),
    list(visual_layer_id = "pw-state-no-religion", label = "No religious affiliation %",
         description = "Palau 2005 None or refused share by state.", layer_type = "choropleth",
         indicator_ids = list("no_religion_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "state population total"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "reported state value", uncertainty_display = "quality_flag",
         default_visibility = FALSE,
         notes = "2005 only; the category is None or refused and mixes no-religion with non-response.")
  )
}

summary_product <- list(
  schema_version = "area-summary.v1", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code,
                      level = boundary_level, vintage = "2017", source_dataset_id = d_boundary),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "No governed place-of-worship snapshot ships in the Palau census product.",
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
      religious_affiliation_count = r[["religious_affiliation_count"]],
      religious_affiliation_percent = r[["religious_affiliation_percent"]],
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
       raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/pw_census/"))
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

licence_basis_slug <- "palau_ops_no_stated_terms_pending_pi_ruling"

raw_sources <- list(
  raw_source_record(monograph_2005_path, monograph_2005_url, "pdf", TRUE, "2005", d2005,
    "2005 Volume II Monograph; Table 10.1 Religion by State (text-extractable). Both margins close to 19,907."),
  raw_source_record(basic_2015_path, basic_2015_url, "pdf", TRUE, "2015", d2015,
    "2015 Volume I Basic Tables; Table 42 (image page 53) transcribed at 150 dpi. Palau Total column and 16 states both sum to 8,376."),
  raw_source_record(basic_2020_path, basic_2020_url, "pdf", TRUE, "2020", d2020,
    "2020 Volume I Basic Tables; Table 42 (image page 53) transcribed at 150 dpi. 16 states sum to 9,303; overall Total column 13,576 is a transcription control."),
  raw_source_record(census_hub_path, census_hub_url, "html", FALSE, "2005-2020", d2020,
    "Official OPS census hub; source-of-record route. No reuse licence stated."),
  raw_source_record(boundary_path, boundary_url, "geojson", TRUE, "2017", d_boundary,
    "geoBoundaries PLW ADM1 GeoJSON; 16 states, ODbL 1.0. Pinned commit 9469f09."),
  raw_source_record(boundary_meta_path, boundary_meta_url, "json", FALSE, "2017", d_boundary,
    "geoBoundaries PLW ADM1 metadata; records ODbL 1.0, boundarySource 'OpenStreetMap, Wambacher', admUnitCount 16.")
)

dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)
dataset_id <- "pw-census-religion:pw:2005-2020:ops-state"

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
  dataset_family = "pw-census-religion", dataset_role = "staged_evidence",
  scope = list(level = "country", country_codes = list("PW"), snapshot_date = NULL,
               snapshot_anchor = NULL, pipeline_stage = "staged"),
  created_at = stamp, created_by = script_id,
  target_years = list(2005L, 2015L, 2020L),
  pipeline = list(
    script = script_id, git_commit = NULL, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation",
      shipped_waves = list(2005L, 2015L, 2020L),
      shipped_geography = "16 Palau states",
      boundary_set = boundary_set_id,
      source_tables = list(
        `2005` = "Volume II Monograph Table 10.1 Religion by State (all persons, all ages)",
        `2015` = "Volume I Basic Tables Table 42 Ethnicity and Religion by Legal Residence (persons 18+)",
        `2020` = "Volume I Basic Tables Table 42 Ethnicity and Religion by Legal Residence (persons 18+)"
      ),
      universes = list(
        `2005` = "all persons, all ages",
        `2015` = "persons 18 years and over",
        `2020` = "persons 18 years and over"
      ),
      denominators = list(
        `2005` = "printed state Total; affiliation = named religions + Other religion; None or refused is the no-religion slot",
        `2015` = "state column total on the printed Palau Total frame (8,376); no separable no-religion; affiliation flat by construction",
        `2020` = "sum of the 16 state columns (9,303); the overall Total column (13,576, including overseas legal-residence columns) is never the state denominator"
      ),
      state_spelling_concordances = list(
        list(geoboundaries = "Ngeremlengui", census = "Ngaremlengui", waves = "all"),
        list(geoboundaries = "Ngarchelong", census_2005 = "Ngerchelong", census_2015_2020 = "Ngarchelong", canonical = "Ngarchelong")
      ),
      category_frames = list(
        `2005` = as.list(cat_2005),
        `2015_2020` = as.list(cat_1520),
        alignment_note = paste(
          "The 2005 nine-way frame separates Jehovah's Witnesses, Other Protestants, and a distinct None or",
          "refused, and has no Muslim, Assembly of God, or Baptist column. The 2015/2020 nine-way frame splits",
          "Muslim, Assembly of God, and Baptist and folds no-religion into Other. The two frames differ and are",
          "not merged; only a broad affiliation total is published across all three waves. Denomination detail",
          "is a 2015-2020 matter; 2005 keeps its own frame. Modekngei is a first-class named category in every wave."
        )
      ),
      change_rule = paste(
        "religious_change withheld for 2005->2015 and 2005->2020 (universe break: all ages vs 18+, and a",
        "category-frame break); computable only for the matched 2015->2020 pair, where affiliation is flat by",
        "construction so any change is trivially zero."
      ),
      no_religion_treatment = list(
        `2005` = "real: None or refused (222 nationally) with its verbatim label; mixes persons with no religion and refusals",
        `2015_2020` = "null: the 2020 report states persons who said they had no religion were classified into the Other category"
      ),
      monograph_prose_discrepancy = paste(
        "The 2005 monograph prose says 'About 1 in every 6 people in the census responded that they had no",
        "religion, or refused to answer the question', which the table refutes: None or refused is 222 of 19,907,",
        "near 1.1 percent. The table governs; the prose sentence is recorded, not used."
      ),
      omitted_metrics = list("places_per_10000_residents", "place_density_per_sq_km"),
      boundary_simplification = simplification,
      local_cache_hint = "All raw sources are cached under data/raw/pw_census/ and remain git-ignored.",
      retrieval_record = raw_sources
    ),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")), digest = as.character(packageVersion("digest")),
      mapshaper = "scripts/lib/simplify_boundary.R (npx mapshaper)"
    )
  ),
  source = list(
    provider = "Palau Office of Planning and Statistics (OPS); geoBoundaries (William & Mary geoLab); OpenStreetMap, Wambacher",
    source_dataset_ids = list(d2005, d2015, d2020, d_boundary),
    source_urls = list(monograph_2005_url, basic_2015_url, basic_2020_url, census_hub_url, boundary_url, boundary_meta_url),
    retrieved_at = stamp,
    licence = paste(
      "No reuse licence is stated in any OPS report or on the Pacific Data Hub (License not specified).",
      "The derived state summaries carry attribution to the Palau Office of Planning and Statistics and ship",
      "STAGED pending a PI licence ruling under the summaries-not-raw-data stance (as with Cote d'Ivoire and Iran).",
      "Boundaries are geoBoundaries PLW ADM1, Open Data Commons Open Database License 1.0, boundary source",
      "OpenStreetMap and Wambacher."
    ),
    citation = "Palau OPS, 2005 Census Monograph Table 10.1; 2015 and 2020 Basic Tables Table 42; geoBoundaries PLW ADM1 (gbOpen).",
    raw_redistribution = "The census PDFs and the geoBoundaries source GeoJSON are not committed; they remain in data/raw/pw_census/.",
    local_cache_hint = "data/raw/pw_census/ (git-ignored by .gitignore data/ rule)"
  ),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = list(
    durable_file_record(summary_json_out, "Palau 16-state census-affiliation area summary for 2005, 2015, 2020.", "needs_review", licence_basis_slug),
    durable_file_record(summary_csv_out, "Flattened Palau 16-state census-affiliation rows for 2005, 2015, 2020.", "needs_review", licence_basis_slug),
    durable_file_record(boundary_out, "Simplified geoBoundaries PLW ADM1 16-state boundary GeoJSON.", "accepted", "geoboundaries_odbl_1_0")
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id,
         notes = "16 states x 3 waves = 48 rows; per-wave universe (2005 all ages; 2015/2020 18+)."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out), built_by = script_id,
         notes = "16 state features from geoBoundaries PLW ADM1, simplified with mapshaper weighted keep-shapes.")
  ),
  validation = list(
    status = "passed_with_warnings",
    commands = list(
      paste("Rscript", script_id),
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/pw/data/area_summary_state.json",
      "bash scripts/validate_manifests.sh"
    ),
    gate_2005 = list(status = "passed", both_margins_close_to = national_2005,
                     state_row_checks = 16L, category_column_checks = length(cat_2005),
                     records = reconciliation_block(rec_2005)),
    gate_2015 = list(status = "passed", palau_total_column = palau_total_2015, sixteen_state_sum = sum(total_2015_state),
                     state_row_checks = 16L, category_column_checks = length(cat_1520),
                     records = reconciliation_block(rec_2015)),
    gate_2020 = list(status = "passed", sixteen_state_sum = state_grand_2020, expected_state_sum = state_sum_2020,
                     overall_total_column_control = overall_total_2020,
                     state_row_checks = 16L, total_column_controls = length(cat_1520),
                     records = reconciliation_block(rec_2020)),
    boundary_validation = list(status = "passed", feature_count = 16L, distinct_geometry_hashes = length(unique(geom_hashes)),
                               geometry_hashes = as.list(geom_hashes),
                               bbox = list(xmin = unname(bbox[["xmin"]]), ymin = unname(bbox[["ymin"]]),
                                           xmax = unname(bbox[["xmax"]]), ymax = unname(bbox[["ymax"]])),
                               full_extent_note = "bbox spans lat 2.75-8.09N including Sonsorol and Hatohobei; a main-cluster bbox would be wrong",
                               output_bytes = file_bytes(boundary_out), simplification = simplification,
                               licence = boundary_metadata[["boundaryLicense"]], adm_unit_count = boundary_metadata[["admUnitCount"]]),
    join_coverage = list(matched_states = 16L, expected_states = 16L, unmatched_states = list(), unused_boundary_features = list()),
    notes = paste(
      "All three waves reconcile at both margins with zero difference. 2005 both margins close to 19,907;",
      "2015 Palau Total column and 16 states both close to 8,376; 2020 16 states close to 9,303 and the overall",
      "Total column control closes to 13,576. Boundary joins 16/16 to geoBoundaries PLW ADM1 with 16 distinct",
      "geometry hashes."
    ),
    warnings = list(
      "STAGED product: no page, no hub link. Licence needs review pending a PI ruling; no reuse terms exist anywhere in the source chain.",
      "The page additionally shares the PI task 6 gate in part: 2015 and 2020 religious affiliation is flat at 100 percent by construction (no-religion folded into Other).",
      "Cross-wave change is withheld for 2005 to 2015/2020 (universe and frame breaks) and is only computable for the matched 2015-2020 pair.",
      "2005 monograph prose '1 in 6 no religion' is refuted by its own table (222/19,907); the table governs."
    )
  ),
  construct_notes = list(
    "The construct is census affiliation: each resident's reported religion, not practice, attendance, or membership. The 2005 monograph states the item was collected as social indicators and not as part of a census of religions.",
    "The public product carries three headline fields per state-wave: population total, religious affiliation percent, and no religion percent. Place-density metrics are null (no governed place-of-worship snapshot).",
    "Per-wave universes: 2005 counts all persons of all ages; 2015 and 2020 count persons 18 years and over. The 2005-to-later level difference is a universe break and must never be read as change.",
    "The 2005 nine-way frame (Modekngei, Catholic, Evangelical, Seventh Day Adventist, Mormons, Jehovah's Witnesses, Other Protestants, Other religion, None or refused) differs from the 2015/2020 nine-way frame (Catholic, Evangelical, Seven Day Adventist, Assembly of God, Baptist, Muslim, Mormons, Modekngei, Other). The frames are preserved verbatim and not merged; only a broad affiliation total is published across all three waves.",
    "No-religion slot: for 2005 it is the printed None or refused count (222 nationally), which mixes persons with no religion and refusals to answer. For 2015 and 2020 there is no separable no-religion count, because the report classifies persons with no religion into the Other category; the metric is null for those waves.",
    "Because 2015 and 2020 fold no-religion into Other, religious affiliation equals the population by construction and is flat at 100 percent for every state in those waves; it does not distinguish states. This is the PI task 6 gate shared in part.",
    "The 2015 state universe uses the printed Palau Total column (8,376 adults), which equals the 16-state sum. The 2020 table prints no Palau subtotal; the 16 state columns sum to 9,303 and the overall Total (13,576, including overseas legal-residence columns) is never used as the state denominator.",
    "Change is withheld across 2005 and the later waves (universe and category-frame breaks) and is computable only for the matched 2015-2020 pair, where the flat-by-construction affiliation makes any change trivially zero.",
    "Boundary: geoBoundaries PLW ADM1, 16 states, ODbL 1.0. Two spelling concordances preserve both labels: geoBoundaries Ngeremlengui maps to census Ngaremlengui, and the 2005 monograph spelling Ngerchelong maps to canonical Ngarchelong. The full extent spans latitude 2.75 to 8.09 North and includes the southwest outlying states Sonsorol and Hatohobei."
  ),
  deferred_sources = list(
    list(source_dataset_id = "pw-census-2000-monograph-religion-by-state", status = "deferred",
         url = census_hub_url, local_path = NULL,
         notes = paste("The 2000 Census Population and Housing Profile (Monograph III) is the credible route to a fourth,",
                       "earlier state wave. It needs the 2000 religion-by-state table located and its universe and frame",
                       "reconciled against 2005 under the same licence ruling. The exact first religion wave is disputed:",
                       "the 2020 report says religion was first asked in 2000, while the 2005 monograph implies a 1995 question.")),
    list(source_dataset_id = "pw-census-2015-2020-denomination-series", status = "deferred",
         url = NULL, local_path = NULL,
         notes = "A denomination time series is a 2015-2020 matter only (shared frame). It is not shipped in this headline-affiliation product."),
    list(source_dataset_id = "pw-ops-licence-confirmation", status = "not_pinned",
         url = census_hub_url, local_path = NULL,
         notes = "An OPS reuse-confirmation email is the clean unblock for the licence gate; none is held.")
  ),
  privacy = "public",
  licence_status = "needs_review",
  licence_basis = licence_basis_slug,
  downstream_status = "staged",
  source_datasets = source_datasets(),
  notes = paste(
    "STAGED product (no page, no hub link) pending a PI licence ruling. The committed products are the derived",
    "16-state area summary (48 rows across 2005, 2015, 2020) and the simplified geoBoundaries PLW ADM1 boundary.",
    "On-page attribution, when a page is built, must cite the Palau Office of Planning and Statistics and",
    "geoBoundaries (ODbL 1.0, OpenStreetMap/Wambacher)."
  )
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

cat("waves shipped: 2005 (all ages), 2015 (18+), 2020 (18+) on 16 Palau states\n")
cat(sprintf("rows: %d (16 states x 3 waves)\n", length(rows)))
cat(sprintf("gate 2005: passed; both margins close to %d\n", national_2005))
cat(sprintf("gate 2015: passed; Palau Total column and 16 states both close to %d\n", palau_total_2015))
cat(sprintf("gate 2020: passed; 16 states sum to %d; overall Total column control %d\n", state_grand_2020, overall_total_2020))
cat(sprintf("boundary gate: passed; 16/16 join, %d distinct geometry hashes, %d bytes at %g%% keep\n",
            length(unique(geom_hashes)), file_bytes(boundary_out), simplification[["keep_percent"]]))
cat("change gate: withheld 2005->2015/2020 (universe + frame breaks); computable 2015->2020 only\n")
cat("licence gate: needs_review; STAGED pending PI ruling; no reuse terms stated anywhere\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", boundary_out))
cat(sprintf("wrote %s\n", manifest_out))
