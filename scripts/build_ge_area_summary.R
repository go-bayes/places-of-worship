# build the Georgia region census-religion area-summary product for three waves
# (2002, 2014, 2024) on the stable region frame. one licensed boundary set
# (geoBoundaries GEO ADM1, 12 units, CC BY 3.0) serves all waves: the 11 controlled
# regions carry every wave; the Abkhazia polygon carries the 2002 wave only (the
# census enumerated a 1,956-person fraction of Abkhazia in 2002 and none of it in
# 2014/2024 — occupied territories excluded). see research/countries/ge/route-probe.md
# for full provenance, sha256, and the territorial-scope statement.
#   inputs (all cached, git-ignored under data/raw/ge_census/):
#   ge_2002_vol_I-tomi.pdf            <- 2002 census Vol I, Table #29 (region x religion)
#   ge_2014_population_by_regions_and_religion.xls <- 2014 region x religion
#   ge_2024_population_by_regions_selfgov_sex_religion.xlsx <- 2024 region x religion
#   geoBoundaries-GEO-ADM1.geojson    <- region boundary (12 units, CC BY 3.0)
# every religion cell is transcribed verbatim from its cached source (margin-verified)
# and reconciled against the printed control totals here; the build stops on any
# margin mismatch and never allocates, infers, rounds, imputes, or tunes a value.
# 2002 dashes read as 0; 2014 "…"(<=10) cells are suppression carried verbatim.
# outputs: apps/regions/ge/data/{ge_region.geojson, area_summary_region.json,
#   area_summary_region.csv} and docs/manifests/ge-census-religion-2002-2024.json.
# run from the repo root: Rscript scripts/build_ge_area_summary.R

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "GE"
script_id <- "scripts/build_ge_area_summary.R"
raw_dir <- "data/raw/ge_census"
product_dir <- "apps/regions/ge/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-12"
stamp <- paste0(retrieval_date, "T00:00:00Z")
git_commit <- trimws(system2("git", c("rev-parse", "HEAD"), stdout = TRUE))
if (length(git_commit) != 1L || !grepl("^[a-f0-9]{40}$", git_commit)) git_commit <- NULL

# ---- dataset ids ---------------------------------------------------------------
d2002 <- "ge-census-2002-vol1-table29-religion-by-region"
d2014 <- "ge-census-2014-population-by-regions-and-religion"
d2024 <- "ge-census-2024-population-by-regions-selfgov-sex-religion"
d_gb <- "geoboundaries-geo-adm1-2015"
boundary_set_id <- "ge-region-geoboundaries-adm1"

# ---- source urls and cached paths ----------------------------------------------
url_2002 <- "https://geostat.ge/media/44559/I-tomi.pdf"
url_2014 <- "https://geostat.ge/media/44724/22_Population-by-regions-and-religion.xls"
url_2024 <- "https://geostat.ge/media/80625/6.-Population-by-regions%2C-self-governed-units%2C-sex-and-religion.xlsx"
url_gb <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/GEO/ADM1/geoBoundaries-GEO-ADM1.geojson"
url_gb_meta <- "https://www.geoboundaries.org/api/current/gbOpen/GEO/ADM1/"
url_terms <- "https://www.geostat.ge/en/page/monacemta-gamoyenebis-pirobebi"

path_2002 <- file.path(raw_dir, "ge_2002_vol_I-tomi.pdf")
path_2014 <- file.path(raw_dir, "ge_2014_population_by_regions_and_religion.xls")
path_2024 <- file.path(raw_dir, "ge_2024_population_by_regions_selfgov_sex_religion.xlsx")
path_gb <- file.path(raw_dir, "geoBoundaries-GEO-ADM1.geojson")
path_gb_meta <- file.path(raw_dir, "gb_geo_adm1_meta.json")
path_terms <- file.path(raw_dir, "geostat_terms_of_use_en.txt")

geojson_out <- file.path(product_dir, "ge_region.geojson")
summary_json_out <- file.path(product_dir, "area_summary_region.json")
summary_csv_out <- file.path(product_dir, "area_summary_region.csv")
manifest_out <- file.path(manifest_dir, "ge-census-religion-2002-2024.json")

# ---- stable region identity (slug -> geoBoundaries shapeName) -------------------
# one slug per region; the boundary layer join uses shapeName. Abkhazia is present
# only in the 2002 wave.
region_slug <- c(
  tbilisi = "Tbilisi", abkhazia = "Abkhazia", adjara = "Adjara", guria = "Guria",
  imereti = "Imereti", kakheti = "Kakheti", mtskheta_mtianeti = "Mtskheta-Mtianeti",
  racha_lechkhumi_kvemo_svaneti = "Racha-Lechkhumi and Kvemo Svaneti",
  samegrelo_zemo_svaneti = "Samegrelo-Zemo Svaneti",
  samtskhe_javakheti = "Samtskhe–Javakheti",  # en-dash in geoBoundaries shapeName
  kvemo_kartli = "Kvemo Kartli", shida_kartli = "Shida Kartli")
region_label <- c(
  tbilisi = "Tbilisi", abkhazia = "Abkhazia A.R.", adjara = "Adjara A.R.",
  guria = "Guria", imereti = "Imereti", kakheti = "Kakheti",
  mtskheta_mtianeti = "Mtskheta-Mtianeti",
  racha_lechkhumi_kvemo_svaneti = "Racha-Lechkhumi and Kvemo Svaneti",
  samegrelo_zemo_svaneti = "Samegrelo-Zemo Svaneti",
  samtskhe_javakheti = "Samtskhe-Javakheti",
  kvemo_kartli = "Kvemo Kartli", shida_kartli = "Shida Kartli")

# ---- 2002 wave: Vol I Table #29 (12 regions, integer full-count) ----------------
# columns: total, Orthodox, Catholic, Armenian-Gregorian, Judaism, Muslim,
# residual("other religion", bundles other + none + unclassified). dashes read 0.
cats_2002 <- c("Orthodox", "Catholic", "Armenian-Gregorian", "Judaism", "Muslim",
               "Other religion (residual)")
cats_2002_ka <- c("მართლმადიდებელი",
                  "კათოლიკური",
                  "სომხურ-გრიგორიანული",
                  "იუდეური",
                  "მაჰმადიანური",
                  "სხვა სარწმუნოება")
m2002 <- rbind(
  tbilisi                       = c(1081679, 988664, 2715, 51687, 2320, 11438, 24855),
  abkhazia                      = c(1956, 1940, 1, 1, 0, 9, 5),
  adjara                        = c(376016, 240552, 683, 3162, 161, 115161, 16297),
  guria                         = c(143357, 127217, 724, 341, 13, 13736, 1326),
  imereti                       = c(699666, 693462, 478, 591, 365, 1549, 3221),
  kakheti                       = c(407182, 350126, 737, 1146, 73, 51256, 3844),
  mtskheta_mtianeti             = c(125443, 121690, 43, 101, 15, 2240, 1354),
  racha_lechkhumi_kvemo_svaneti = c(50969, 50670, 3, 6, 32, 75, 183),
  samegrelo_zemo_svaneti        = c(466100, 462435, 64, 190, 51, 1015, 2345),
  samtskhe_javakheti            = c(207598, 85011, 27871, 87827, 69, 5859, 961),
  kvemo_kartli                  = c(497530, 242086, 1040, 25688, 110, 225657, 2949),
  shida_kartli                  = c(314039, 302380, 368, 399, 332, 5789, 4771))
colnames(m2002) <- c("total", cats_2002)
nat_2002 <- c(total = 4371535, Orthodox = 3666233, Catholic = 34727,
              `Armenian-Gregorian` = 171139, Judaism = 3541, Muslim = 433784,
              `Other religion (residual)` = 62111)

# ---- 2014 wave: region table Total block (11 regions, integer, "…"<=10) ---------
# printed order: total, Orthodox, Muslim, Armenian apostolic, Catholic,
# Jehovah's Witnesses, Yazidis, Protestant, Judaism, Other, None, Refusal, Not stated.
# a value of -1 marks a "…"(<=10) suppressed cell (carried verbatim, never repaired).
S <- -1L
cats_2014 <- c("Orthodox", "Muslim", "Armenian apostolic", "Catholic",
               "Jehovah's Witnesses", "Yazidis", "Protestant", "Judaism", "Other",
               "None", "Refusal", "Not stated")
m2014 <- rbind(
  tbilisi                       = c(1108717, 1024931, 16268, 29368, 1662, 3979, 8124, 1174, 1016, 973, 4971, 2429, 13822),
  adjara                        = c(333953, 182041, 132852, 1082, 147, 175, 25, 148, 59, 50, 9233, 4217, 3924),
  guria                         = c(113350, 98330, 12951, 144, 306, 107, 12, 64, S, 28, 368, 198, 839),
  imereti                       = c(533906, 527531, 931, 67, 158, 1473, 0, 139, 93, 73, 711, 282, 2448),
  kakheti                       = c(318583, 273177, 38683, 182, 264, 1011, 233, 326, 35, 74, 931, 512, 3155),
  mtskheta_mtianeti             = c(94573, 90861, 2296, 35, 15, 469, 42, 105, S, 15, 141, 92, 493),
  racha_lechkhumi_kvemo_svaneti = c(32089, 31818, S, S, 0, 69, 0, S, 13, S, 30, 24, 126),
  samegrelo_zemo_svaneti        = c(330761, 326061, 766, 23, 53, 1408, 0, 36, 13, 35, 338, 245, 1783),
  samtskhe_javakheti            = c(160504, 72605, 6060, 64115, 15024, 314, 0, 27, 33, 39, 903, 168, 1216),
  kvemo_kartli                  = c(423986, 217724, 182216, 13926, 1493, 1011, 154, 186, 41, 98, 839, 1125, 5173),
  shida_kartli                  = c(263382, 252494, 5650, 97, 73, 2379, S, 313, 102, 43, 615, 343, 1272))
colnames(m2014) <- c("total", cats_2014)
nat_2014 <- c(total = 3713804, Orthodox = 3097573, Muslim = 398677,
              `Armenian apostolic` = 109041, Catholic = 19195,
              `Jehovah's Witnesses` = 12395, Yazidis = 8591, Protestant = 2520,
              Judaism = 1417, Other = 1429, None = 19080, Refusal = 9635,
              `Not stated` = 34251)

# ---- 2024 wave: region rows of the region+self-gov table, Both Sexes block ------
# printed order: total, Orthodox, Catholic, Armenian apostolic, Judaism,
# Jehovah's Witnesses, Muslim, Other, None, Refusal, Not stated. no suppression.
cats_2024 <- c("Orthodox", "Catholic", "Armenian apostolic", "Judaism",
               "Jehovah's Witnesses", "Muslim", "Other", "None", "Refusal",
               "Not stated")
m2024 <- rbind(
  tbilisi                       = c(1331485, 1183612, 2955, 23422, 713, 3423, 27884, 8578, 7613, 3533, 69752),
  adjara                        = c(402929, 239905, 689, 727, 85, 290, 136386, 240, 8113, 2958, 13536),
  guria                         = c(102408, 89421, 213, 132, 3, 134, 11627, 50, 268, 126, 434),
  imereti                       = c(510741, 504540, 283, 62, 63, 1298, 1004, 201, 317, 93, 2880),
  kakheti                       = c(303833, 256009, 179, 298, 15, 924, 44115, 566, 295, 104, 1328),
  mtskheta_mtianeti             = c(94039, 89528, 51, 25, 7, 454, 2673, 99, 95, 81, 1026),
  racha_lechkhumi_kvemo_svaneti = c(29901, 29779, 3, 1, 12, 68, 7, 1, 11, 3, 16),
  samegrelo_zemo_svaneti        = c(305597, 302419, 190, 14, 12, 996, 772, 43, 196, 61, 894),
  samtskhe_javakheti            = c(155282, 70704, 13963, 64103, 8, 274, 5054, 161, 325, 97, 593),
  kvemo_kartli                  = c(441630, 215357, 914, 12900, 29, 825, 202095, 307, 1679, 1790, 5734),
  shida_kartli                  = c(251736, 241932, 153, 52, 66, 2101, 5841, 247, 302, 66, 976))
colnames(m2024) <- c("total", cats_2024)
nat_2024 <- c(total = 3929581, Orthodox = 3223206, Catholic = 19593,
              `Armenian apostolic` = 101736, Judaism = 1013,
              `Jehovah's Witnesses` = 10787, Muslim = 437458, Other = 10493,
              None = 19214, Refusal = 8912, `Not stated` = 97169)

# ---- reconciliation gates (fail-fast; stop, do not tune) ------------------------
# clean waves (2002, 2024): every region row's categories sum to its printed total,
# every category column sums to its printed national total. records the evidence.
reconcile_clean <- function(mat, nat, cats, year) {
  records <- list()
  for (r in rownames(mat)) {
    row_sum <- sum(mat[r, cats])
    if (row_sum != mat[r, "total"]) {
      stop(sprintf("%d region gate FAILED for %s: categories sum %d != printed total %d",
                   year, r, row_sum, mat[r, "total"]), call. = FALSE)
    }
    records[[length(records) + 1L]] <- data.frame(
      year = year, margin = "region_row", key = r, computed = row_sum,
      printed = unname(mat[r, "total"]), difference = 0L, stringsAsFactors = FALSE)
  }
  for (cc in cats) {
    col_sum <- sum(mat[, cc])
    if (col_sum != nat[[cc]]) {
      stop(sprintf("%d column gate FAILED for %s: region sum %d != printed national %d",
                   year, cc, col_sum, nat[[cc]]), call. = FALSE)
    }
    records[[length(records) + 1L]] <- data.frame(
      year = year, margin = "religion_column", key = cc, computed = col_sum,
      printed = unname(nat[[cc]]), difference = 0L, stringsAsFactors = FALSE)
  }
  if (sum(mat[, "total"]) != nat[["total"]]) {
    stop(sprintf("%d grand gate FAILED: region-total sum %d != printed national %d",
                 year, sum(mat[, "total"]), nat[["total"]]), call. = FALSE)
  }
  do.call(rbind, records)
}

# 2014 gate: the two headline slots reconcile exactly (None/Refusal/Not-stated are
# never suppressed); suppressed "…" cells are bounded, never repaired. checks the
# national row exactly and each region's suppression bound.
reconcile_2014 <- function(mat, nat) {
  records <- list()
  headline <- c("None", "Refusal", "Not stated")
  # national row: every category printed, must sum exactly.
  for (cc in cats_2014) {
    col_sum <- sum(mat[mat[, cc] != S, cc])  # exclude suppressed from column sum
    known_national <- nat[[cc]]
    # for non-suppressed-anywhere columns the region sum must equal national.
    if (!any(mat[, cc] == S) && col_sum != known_national) {
      stop(sprintf("2014 column gate FAILED for %s: region sum %d != national %d",
                   cc, col_sum, known_national), call. = FALSE)
    }
  }
  # national total closes over all 12 categories.
  if (sum(nat[cats_2014]) != nat[["total"]]) {
    stop("2014 national category gate FAILED", call. = FALSE)
  }
  for (r in rownames(mat)) {
    known <- mat[r, cats_2014]
    n_sup <- sum(known == S)
    known_sum <- sum(known[known != S])
    gap <- mat[r, "total"] - known_sum
    if (n_sup == 0L) {
      if (gap != 0L) stop(sprintf("2014 region gate FAILED for %s: gap %d with no suppression", r, gap), call. = FALSE)
    } else {
      # suppression bound: 0 <= gap <= 10 * n_suppressed.
      if (gap < 0L || gap > 10L * n_sup) {
        stop(sprintf("2014 suppression bound FAILED for %s: gap %d outside [0, %d]",
                     r, gap, 10L * n_sup), call. = FALSE)
      }
    }
    records[[length(records) + 1L]] <- data.frame(
      year = 2014L, margin = "region_row_suppression_bound", key = r,
      computed = known_sum, printed = unname(mat[r, "total"]),
      difference = gap, stringsAsFactors = FALSE)
  }
  # headline-slot column reconciliation (None exact at both margins).
  for (cc in headline) {
    col_sum <- sum(mat[, cc])
    if (col_sum != nat[[cc]]) {
      stop(sprintf("2014 headline column gate FAILED for %s: %d != %d", cc, col_sum, nat[[cc]]), call. = FALSE)
    }
    records[[length(records) + 1L]] <- data.frame(
      year = 2014L, margin = "headline_column", key = cc, computed = col_sum,
      printed = unname(nat[[cc]]), difference = 0L, stringsAsFactors = FALSE)
  }
  do.call(rbind, records)
}

rec_2002 <- reconcile_clean(m2002, nat_2002, cats_2002, 2002L)
rec_2014 <- reconcile_2014(m2014, nat_2014)
rec_2024 <- reconcile_clean(m2024, nat_2024, cats_2024, 2024L)
message(sprintf("gate 2002: PASSED (both margins close to %d; 12 regions)", nat_2002[["total"]]))
message(sprintf("gate 2014: PASSED (national exact to %d; per-region suppression bounds hold; None exact)", nat_2014[["total"]]))
message(sprintf("gate 2024: PASSED (both margins close to %d; 11 regions)", nat_2024[["total"]]))

# ---- boundary helpers ----------------------------------------------------------
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

invisible(lapply(c(path_gb, path_gb_meta), require_file))

# confirm the boundary licence, unit count, and type before use.
gb_meta <- fromJSON(path_gb_meta, simplifyVector = FALSE)
if (!identical(gb_meta[["boundaryLicense"]], "Creative Commons Attribution 3.0 License") ||
    !identical(gb_meta[["admUnitCount"]], "12") ||
    !identical(gb_meta[["boundaryType"]], "ADM1")) {
  stop("geoBoundaries GEO ADM1 licence, unit count, or type metadata changed", call. = FALSE)
}

# Georgia-centred equal-area projection for land areas (no dateline crossing).
ge_laea <- "+proj=laea +lat_0=42 +lon_0=43.5 +datum=WGS84 +units=m +no_defs"

# assemble the region boundary: join every region slug to its shapeName, attach
# product identifiers and land area. all 12 regions (Abkhazia included).
gb <- st_make_valid(st_read(path_gb, quiet = TRUE, stringsAsFactors = FALSE))
if (nrow(gb) != 12L) stop("geoBoundaries GEO ADM1 feature count is not 12", call. = FALSE)
target <- unname(region_slug)
idx <- match(target, gb[["shapeName"]])
if (anyNA(idx) || anyDuplicated(idx)) stop("regions do not join geoBoundaries shapeNames one-to-one", call. = FALSE)
boundary <- gb[idx, ]
boundary[["area_code"]] <- names(region_slug)
boundary[["area_name"]] <- unname(region_label)
boundary[["boundary_source_name"]] <- unname(region_slug)
boundary[["area_unit_id"]] <- paste(boundary_set_id, names(region_slug), sep = ":")
boundary[["boundary_set_id"]] <- boundary_set_id
boundary[["boundary_level"]] <- "region"
boundary[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(boundary, ge_laea))) / 1e6
# snap to a 1e-5 grid (the mapshaper output precision) then re-validate: this removes
# a sub-precision spike in the geoBoundaries Adjara polygon that otherwise collapses
# to a stray LineString layer during simplification. geometry is otherwise unchanged.
boundary <- st_make_valid(st_set_precision(st_transform(st_make_valid(boundary), 4326), 1e5))
boundary <- boundary[c("area_code", "area_name", "boundary_source_name", "area_unit_id",
                       "boundary_set_id", "boundary_level", "land_area_sq_km", "geometry")]

# simplify with the mandatory helper; re-validate count + distinctness.
simplification <- mapshaper_simplify_to_cap(
  boundary, geojson_out, max_bytes = 900000L,
  keep_percentages = c(30, 20, 12, 8, 5, 3, 2), clean_option = "allow-overlaps")
written <- st_read(geojson_out, quiet = TRUE, stringsAsFactors = FALSE)
written <- written[match(boundary[["area_code"]], written[["area_code"]]), ]
if (anyNA(written[["area_code"]]) || nrow(written) != 12L) stop("simplified boundary lost a region", call. = FALSE)
w_valid <- st_is_valid(written)
if (any(st_is_empty(written)) || any(is.na(w_valid)) || any(!w_valid)) stop("simplified boundary invalid", call. = FALSE)
hashes <- geometry_hashes(written)
if (length(unique(hashes)) != 12L) stop("simplified geometry hashes not distinct", call. = FALSE)
land_area <- setNames(written[["land_area_sq_km"]], written[["area_code"]])
message(sprintf("boundary: PASSED (12 distinct features, %d bytes at %g%% keep)",
                file_bytes(geojson_out), simplification[["keep_percent"]]))

# ---- product rows --------------------------------------------------------------
flag_common <- paste(
  "census_affiliation", "whole_enumerated_population_all_ages_universe",
  "single_select_reported_religion",
  "religious_affiliation_percent_is_named_religion_share",
  "region_frame_stable_across_waves",
  "category_frames_differ_per_wave_no_cross_wave_category_change",
  "occupied_territories_abkhazia_and_south_ossetia_not_enumerated",
  "census_licence_open_reuse_with_attribution",
  sep = ";")

basis_text <- c(
  `2002` = paste(
    "2002 General Population Census of Georgia, Volume I, Table #29 (population by",
    "religion across regions), whole enumerated population of all ages; the",
    "denominator is the printed region total. Affiliation is a recorded LOWER BOUND",
    "= Orthodox + Catholic + Armenian-Gregorian + Judaism + Muslim (the residual",
    "'other religion' column bundles other-religion with no-religion and cannot be",
    "split at region level, so no-religion is null)."),
  `2014` = paste(
    "2014 General Population Census of Georgia, 'Population by regions and religion'",
    "(Total block), whole population of all ages; the denominator is the printed",
    "region total. Affiliation = population - None - Refusal - Not stated."),
  `2024` = paste(
    "2024 Population Census of Georgia, 'Population by regions, self-governed units,",
    "sex and religion' (Both Sexes block), whole population as of 14 Nov 2024; the",
    "denominator is the printed region total. Affiliation = population - None -",
    "Refusal - Not stated. Occupied territories excluded per the source footnote."))

# per-region territorial-scope note where the record needs one.
scope_note <- function(slug, year) {
  if (slug == "abkhazia") {
    return("territorial_scope=abkhazia_enumerated_fraction_only_1956_persons_in_2002_not_representative_of_abkhazia")
  }
  if (slug == "shida_kartli") {
    return("territorial_scope=shida_kartli_enumerated_in_georgian_controlled_part_only_tskhinvali_south_ossetia_area_not_enumerated_polygon_spans_full_extent")
  }
  NULL
}

# verbatim per-region category breakdown, source labels = counts in printed order.
breakdown_str <- function(mat, slug, cats, labels) {
  vals <- mat[slug, cats]
  disp <- ifelse(vals == -1L, "…", as.character(vals))  # "…" for suppressed 2014 cells
  paste(paste0(labels, "=", disp), collapse = ";")
}

# build one schema-shaped row for a region-wave.
make_row <- function(slug, wave) {
  mat <- wave$mat
  pop <- as.integer(mat[slug, "total"])
  if (wave$year == 2002L) {
    named5 <- c("Orthodox", "Catholic", "Armenian-Gregorian", "Judaism", "Muslim")
    affiliation <- sum(mat[slug, named5])
    no_rel <- NA_integer_
    no_pct <- NA_real_
    labels <- cats_2002_ka; cats <- cats_2002
    extra <- "affiliation_is_recorded_lower_bound_named_religions_only_residual_excluded;no_religion_null_residual_bundles_none"
  } else {
    non_aff <- c("None", "Refusal", "Not stated")
    affiliation <- pop - sum(mat[slug, non_aff])
    no_rel <- as.integer(mat[slug, "None"])
    no_pct <- round(100 * no_rel / pop, 4)
    labels <- if (wave$year == 2014L) cats_2014 else cats_2024
    cats <- labels
    extra <- "refused_and_not_stated_residual_in_denominator_neither_slot;shares_need_not_sum_to_100"
  }
  aff_pct <- round(100 * affiliation / pop, 4)
  breakdown <- breakdown_str(mat, slug, cats, labels)
  flag_parts <- c(flag_common, extra,
                  paste0("source_categories_verbatim=", breakdown),
                  scope_note(slug, wave$year))
  full_flag <- paste(flag_parts[nzchar(flag_parts)], collapse = ";")
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = "region",
    area_unit_id = paste(boundary_set_id, slug, sep = ":"),
    area_code = slug,
    area_name = unname(region_label[[slug]]),
    year = as.integer(wave$year),
    population_total = pop,
    population_total_basis = wave$basis,
    religious_affiliation_count = as.integer(affiliation),
    religious_affiliation_percent = aff_pct,
    no_religion_count = if (is.na(no_rel)) NULL else as.integer(no_rel),
    no_religion_percent = if (is.na(no_pct)) NULL else no_pct,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = unname(round(land_area[[slug]], 4)),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(wave$dataset, d_gb),
    quality_flag = full_flag)
}

wave_2002 <- list(year = 2002L, mat = m2002, dataset = d2002, basis = basis_text[["2002"]])
wave_2014 <- list(year = 2014L, mat = m2014, dataset = d2014, basis = basis_text[["2014"]])
wave_2024 <- list(year = 2024L, mat = m2024, dataset = d2024, basis = basis_text[["2024"]])

rows <- c(lapply(rownames(m2002), make_row, wave = wave_2002),
          lapply(rownames(m2014), make_row, wave = wave_2014),
          lapply(rownames(m2024), make_row, wave = wave_2024))

# ---- area-summary document -----------------------------------------------------
census_licence_name <- paste(
  "National Statistics Office of Georgia (Geostat) Terms of Use open reuse grant.",
  "The Geostat Terms of Use page (geostat.ge/en/page/monacemta-gamoyenebis-pirobebi,",
  "retrieved 2026-07-12) grant 'the right to download, use, adapt, modify, create",
  "derivative works of, disseminate, copy, and share to the third parties, for any",
  "purpose, including commercial and non-commercial use, without restriction,",
  "statistical data, metadata, official publications and other published documents",
  "placed on GEOSTAT website without prior permission', with the condition: 'Users",
  "should indicate Geostat as a source of information when using data of GEOSTAT.'",
  "An open licence conditioned only on source attribution.")

source_datasets <- function() {
  gl <- list(name = "Creative Commons Attribution 3.0 License", url = url_gb_meta,
             attribution = "geoBoundaries (gbOpen); boundary source geoBoundaries, Wikimedia (CC BY 3.0)")
  cl <- function(att) list(name = census_licence_name, url = url_terms, attribution = att)
  list(
    list(source_dataset_id = d2002,
         name = "Georgia 2002 General Population Census, Volume I, Table #29: population by religion by region",
         provider = "National Statistics Office of Georgia (Geostat; 2002: State Department for Statistics of Georgia)",
         url = url_2002, retrieval_date = retrieval_date, local_path = path_2002,
         licence = cl("National Statistics Office of Georgia, 2002 General Population Census"),
         citation = "Georgia 2002 General Population Census Results, Volume I, Table #29 (population by religion by region).",
         access_limits = NULL,
         redistribution_limits = "Open reuse with source attribution; derived region summaries ship with attribution to Geostat.",
         notes = paste("Whole enumerated population, all ages; 12 regions incl. an Abkhazia A.R. fraction (1,956).",
                       "Both margins close exactly to 4,371,535. Six named categories plus one 'other religion' residual",
                       "that bundles other-religion with no-religion (no isolable no-religion cell at region level).")),
    list(source_dataset_id = d2014,
         name = "Georgia 2014 General Population Census: Population by regions and religion",
         provider = "National Statistics Office of Georgia (Geostat)",
         url = url_2014, retrieval_date = retrieval_date, local_path = path_2014,
         licence = cl("National Statistics Office of Georgia, 2014 General Population Census"),
         citation = "Georgia 2014 General Population Census Results, Population by regions and religion.",
         access_limits = NULL,
         redistribution_limits = "Open reuse with source attribution; derived region summaries ship with attribution to Geostat.",
         notes = paste("Whole population, all ages; 11 regions, 12 categories incl. separate None/Refusal/Not-stated.",
                       "National row closes exactly to 3,713,804. '…'(<=10) suppression on small affiliation sub-categories,",
                       "carried verbatim; the two headline slots stay exact because None/Refusal/Not-stated are never suppressed.")),
    list(source_dataset_id = d2024,
         name = "Georgia 2024 Population Census: Population by regions, self-governed units, sex and religion",
         provider = "National Statistics Office of Georgia (Geostat)",
         url = url_2024, retrieval_date = retrieval_date, local_path = path_2024,
         licence = cl("National Statistics Office of Georgia, 2024 Population Census"),
         citation = "Georgia 2024 Population Census Results, Population by regions, self-governed units, sex and religion.",
         access_limits = NULL,
         redistribution_limits = "Open reuse with source attribution; derived region summaries ship with attribution to Geostat.",
         notes = paste("Whole population as of 14 Nov 2024; 11 region rows (region product) plus 64 self-governed-unit rows",
                       "(deferred municipality product). 10 categories. Both margins close exactly to 3,929,581. No suppression.",
                       "Source footnote: 'Does not include occupied territories of Georgia.'")),
    list(source_dataset_id = d_gb,
         name = "geoBoundaries GEO ADM1 (12 regions, 2015 vintage)",
         provider = "geoBoundaries (William & Mary geoLab); boundary source geoBoundaries, Wikimedia",
         url = url_gb, retrieval_date = retrieval_date, local_path = path_gb,
         licence = gl,
         citation = "geoBoundaries GEO ADM1 (gbOpen, pinned 9469f09), 12 region boundaries.",
         access_limits = NULL,
         redistribution_limits = "The simplified derived boundary is committed under CC BY 3.0 with attribution to geoBoundaries/Wikimedia.",
         notes = "12 ADM1 regions, boundaryYearRepresented 2015; join the census regions one-to-one (Abkhazia used for 2002 only)."))
}

indicators <- function() {
  denom_note <- paste(
    "Percentages use each region's printed census population total. For 2014 and 2024",
    "the Refusal and Not-stated lines stay in the denominator and outside both",
    "numerators, so the two shares need not sum to 100%. For 2002 no-religion is null",
    "and affiliation is a recorded lower bound (the residual column is excluded).")
  list(
    list(indicator_id = "population_total", label = "Census population total",
         description = "Region whole-population count represented in the wave's religion table.",
         unit = "count", denominator_indicator_id = NULL,
         method = "Printed region total: 2002 Vol I Table #29; 2014 region table; 2024 region+self-gov table.",
         temporal_coverage = "2002; 2014; 2024", spatial_coverage = "Georgia regions (12 in 2002 incl. Abkhazia; 11 in 2014 and 2024)",
         quality_notes = "Whole enumerated population, all ages, in every wave; no universe break. Abkhazia and South Ossetia are not enumerated (2002 carries a 1,956-person Abkhazia fraction; Shida Kartli is enumerated in its controlled part only)."),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
         description = "Share of the region population reporting affiliation with a named religion.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "2014/2024: 100 * (population - None - Refusal - Not stated) / population. 2002: 100 * (Orthodox + Catholic + Armenian-Gregorian + Judaism + Muslim) / population (recorded lower bound; residual excluded).",
         temporal_coverage = "2002; 2014; 2024", spatial_coverage = "Georgia regions",
         quality_notes = paste("Category frames differ across waves (2002: 6 named + residual; 2014: 12; 2024: 10), so no cross-wave category change is claimed; the comparable spine is the five great-tradition shares (Orthodox, Muslim, Armenian Apostolic/Gregorian, Catholic, Judaism), carried verbatim per region.", denom_note)),
    list(indicator_id = "no_religion_percent", label = "No religious affiliation %",
         description = "Share in the census None line (2014, 2024 only).",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * None / population for 2014 and 2024. Null for 2002 (the residual bundles no-religion with other-religion and cannot be split).",
         temporal_coverage = "2014; 2024", spatial_coverage = "Georgia regions (11)",
         quality_notes = "2002 no-religion is null (render the record, no invented split). Refusal and Not-stated are disclosed residuals, never folded into the no-religion slot.")
  )
}

visual_layers <- function() {
  list(
    list(visual_layer_id = "ge-region-religious-affiliation", label = "Religious affiliation %",
         description = "Georgia census-affiliation share by region.", layer_type = "choropleth",
         indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "region whole population"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "reported region value", uncertainty_display = "quality_flag",
         default_visibility = TRUE,
         notes = "Census affiliation, not practice or membership. 2002 affiliation is a recorded lower bound. Abkhazia appears only in 2002 with a 1,956-person enumerated-fraction flag."),
    list(visual_layer_id = "ge-region-no-religion", label = "No religious affiliation %",
         description = "Georgia census None share by region (2014, 2024).", layer_type = "choropleth",
         indicator_ids = list("no_religion_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "region whole population"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "reported region value", uncertainty_display = "quality_flag",
         default_visibility = FALSE,
         notes = "The source category is None. Refusal and Not-stated are excluded from this slot. Null for 2002.")
  )
}

summary_product <- list(
  schema_version = "area-summary.v1", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code,
                      level = "region", vintage = "geoBoundaries GEO ADM1 (2015); 12 regions, Abkhazia used for 2002 only",
                      source_dataset_id = d_gb),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "No governed place-of-worship snapshot ships in the Georgia census product.",
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
      religious_affiliation_count = r[["religious_affiliation_count"]],
      religious_affiliation_percent = r[["religious_affiliation_percent"]],
      no_religion_count = if (is.null(r[["no_religion_count"]])) NA_integer_ else r[["no_religion_count"]],
      no_religion_percent = if (is.null(r[["no_religion_percent"]])) NA_real_ else r[["no_religion_percent"]],
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
       raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/ge_census/"))
}
durable_file_record <- function(path, content, licence_status_value, licence_basis_value) {
  list(uri = paste0("repo:", path), storage_provider = "git_repository", format = sub("^.*\\.", "", path),
       bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = if (grepl("area_summary|\\.csv$", path)) row_count_file(path) else NULL,
       feature_count = if (grepl("\\.geojson$", path)) row_count_file(path) else NULL,
       content = content, privacy = "public",
       licence_status = licence_status_value, licence_basis = licence_basis_value)
}
reconciliation_block <- function(rec) lapply(seq_len(nrow(rec)), function(i) as.list(rec[i, ]))

licence_basis_slug <- "ge_geostat_open_reuse_with_attribution"

raw_sources <- list(
  raw_source_record(path_2002, url_2002, "pdf", TRUE, "2002", d2002,
    "2002 census Vol I (text-extractable scanned PDF); Table #29 region x religion. Both margins close to 4,371,535."),
  raw_source_record(path_2014, url_2014, "xls", TRUE, "2014", d2014,
    "2014 region x religion XLS (Total block). National row closes to 3,713,804; '…'(<=10) suppression on small cells."),
  raw_source_record(path_2024, url_2024, "xlsx", TRUE, "2024", d2024,
    "2024 region+self-gov x religion XLSX (Both Sexes block). Region rows close to 3,929,581. Footnote excludes occupied territories."),
  raw_source_record(path_gb, url_gb, "geojson", TRUE, "2015", d_gb,
    "geoBoundaries GEO ADM1 GeoJSON; 12 regions, CC BY 3.0. Pinned commit 9469f09."),
  raw_source_record(path_gb_meta, url_gb_meta, "json", FALSE, "2015", d_gb,
    "geoBoundaries GEO ADM1 metadata; records CC BY 3.0, admUnitCount 12, boundaryYearRepresented 2015."),
  raw_source_record(path_terms, url_terms, "txt", FALSE, "2026", d2024,
    "Geostat Terms of Use (rendered capture); verbatim open-reuse-with-attribution licence."))

dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)
dataset_id <- "ge-census-religion:ge:2002-2024:geostat-region"

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = paste0("manifest:", dataset_id),
  dataset_id = dataset_id,
  dataset_version_id = paste0(dataset_id, ":", dataset_hash),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "ge-census-religion", dataset_role = "accepted_export",
  scope = list(level = "country", country_codes = list("GE"), snapshot_date = NULL,
               snapshot_anchor = NULL, pipeline_stage = "accepted"),
  created_at = stamp, created_by = script_id,
  target_years = list(2002L, 2014L, 2024L),
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation",
      shipped_waves = list(2002L, 2014L, 2024L),
      shipped_geography = "12 Georgia regions in 2002 (incl. Abkhazia fraction); 11 regions in 2014 and 2024",
      boundary_set = boundary_set_id,
      source_tables = list(
        `2002` = "Vol I Table #29 (population by religion by region)",
        `2014` = "Population by regions and religion (Total block)",
        `2024` = "Population by regions, self-governed units, sex and religion (Both Sexes; region rows)"),
      universes = list(`2002` = "whole enumerated population, all ages",
                       `2014` = "whole population, all ages",
                       `2024` = "whole population as of 14 Nov 2024"),
      slot_design = paste(
        "Ordinary two-slot. religious_affiliation_percent: 2014/2024 = (population - None - Refusal -",
        "Not stated)/population; 2002 = (Orthodox + Catholic + Armenian-Gregorian + Judaism + Muslim)/population,",
        "a recorded lower bound (the 'other religion' residual, which bundles other-religion with no-religion,",
        "is excluded). no_religion_percent: None/population for 2014/2024; null for 2002. Refusal and Not-stated",
        "are disclosed denominator residuals (2014/2024), so the two shares need not sum to 100."),
      category_frames = list(
        `2002` = as.list(c("Orthodox", cats_2002[2:6])),
        `2014` = as.list(cats_2014),
        `2024` = as.list(cats_2024),
        frame_break_note = paste(
          "The three waves do not share one category frame. 2002 prints 6 named categories plus one 'other",
          "religion' residual (no separate None/Refusal/Not-stated). 2014 prints 12 categories incl. Yazidis and",
          "Protestant as separate lines. 2024 folds Yazidis and Protestant into Other (10 categories). Each wave",
          "is transcribed in its own printed order and labelled by wave; no cross-wave category change is claimed",
          "(CHANGE-WITHHOLD). The comparable spine is the five great-tradition shares.")),
      suppression = paste(
        "2014 only: '…' marks cells of <=10 persons on small affiliation sub-categories (Guria/Mtskheta-Mtianeti",
        "Judaism; Racha-Lechkhumi Muslim/Armenian/Protestant/Other; Shida Kartli Yazidis). Carried verbatim as '…'",
        "in the per-region breakdown, never repaired. Recorded per-row suppression bound: 0 <= total - sum(known)",
        "<= 10 * n_suppressed. The two headline slots stay exact (None/Refusal/Not-stated never suppressed)."),
      territorial_scope = paste(
        "Abkhazia and South Ossetia are not enumerated by Geostat. 2002 Table #29 carries a 1,956-person Abkhazia",
        "A.R. row (the fraction under Georgian control at the census date), mapped with a per-feature flag that it",
        "is not representative of Abkhazia; 2014 and 2024 have no Abkhazia row (occupied territories excluded).",
        "Shida Kartli is enumerated only in its Georgian-controlled part in every wave; the polygon spans the full",
        "extent (incl. the non-enumerated Tskhinvali/South Ossetia area), disclosed on the Shida Kartli flag.",
        "No count is invented for any non-enumerated area."),
      boundary_derivation = "geoBoundaries GEO ADM1 (12 units, CC BY 3.0, 2015); regions join one-to-one after normalising self-governing-city/AR prefixes and the en-dash in 'Samtskhe–Javakheti'. One boundary set serves all waves.",
      omitted_metrics = list("places_per_10000_residents", "place_density_per_sq_km"),
      boundary_simplification = simplification,
      local_cache_hint = "All raw sources are cached under data/raw/ge_census/ and remain git-ignored.",
      retrieval_record = raw_sources),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")), digest = as.character(packageVersion("digest")),
      mapshaper = "scripts/lib/simplify_boundary.R (npx mapshaper)")),
  source = list(
    provider = "National Statistics Office of Georgia (Geostat); geoBoundaries (William & Mary geoLab)",
    source_dataset_ids = list(d2002, d2014, d2024, d_gb),
    source_urls = list(url_2002, url_2014, url_2024, url_gb, url_gb_meta, url_terms),
    retrieved_at = stamp,
    licence = census_licence_name,
    citation = "Georgia 2002 Census Vol I Table #29; 2014 Population by regions and religion; 2024 Population by regions, self-governed units, sex and religion; geoBoundaries GEO ADM1 (CC BY 3.0).",
    raw_redistribution = "The census PDF/XLS/XLSX and the boundary source file are not committed; they remain in data/raw/ge_census/.",
    local_cache_hint = "data/raw/ge_census/ (git-ignored by .gitignore data/ rule)",
    raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/ge_census/")),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = list(
    durable_file_record(summary_json_out, "Georgia region census-affiliation area summary for 2002, 2014, 2024.", "accepted", licence_basis_slug),
    durable_file_record(summary_csv_out, "Flattened Georgia region census-affiliation rows for 2002, 2014, 2024.", "accepted", licence_basis_slug),
    durable_file_record(geojson_out, "Simplified geoBoundaries GEO ADM1 12-region boundary GeoJSON.", "accepted", "geoboundaries_cc_by_3_0")),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id,
         notes = "34 rows: 12 regions (2002) + 11 (2014) + 11 (2024). 2002 no-religion null; 2014 suppression carried verbatim."),
    list(uri = paste0("repo:", geojson_out), sha256 = sha256_file(geojson_out), built_by = script_id,
         notes = "12 region features from geoBoundaries GEO ADM1, simplified with mapshaper (Abkhazia used for 2002 only).")),
  validation = list(
    status = "passed",
    commands = list(
      paste("Rscript", script_id),
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/ge/data/area_summary_region.json",
      "bash scripts/validate_manifests.sh"),
    gate_2002 = list(status = "passed", both_margins_close_to = unname(nat_2002[["total"]]),
                     region_row_checks = 12L, religion_column_checks = length(cats_2002),
                     records = reconciliation_block(rec_2002)),
    gate_2014 = list(status = "passed", national_total = unname(nat_2014[["total"]]),
                     note = "national row exact over 12 categories; per-region suppression bounds hold; None exact at both margins",
                     records = reconciliation_block(rec_2014)),
    gate_2024 = list(status = "passed", both_margins_close_to = unname(nat_2024[["total"]]),
                     region_row_checks = 11L, religion_column_checks = length(cats_2024),
                     records = reconciliation_block(rec_2024)),
    boundary_validation = list(status = "passed", feature_count = 12L,
                               distinct_geometry_hashes = length(unique(hashes)),
                               bbox = as.list(st_bbox(written)), output_bytes = file_bytes(geojson_out),
                               licence = gb_meta[["boundaryLicense"]], adm_unit_count = gb_meta[["admUnitCount"]]),
    join_coverage = list(matched = 12L, expected = 12L),
    notes = paste(
      "2002 (12 regions) and 2024 (11 regions) close exactly at both margins (4,371,535; 3,929,581). 2014 national",
      "row closes exactly over 12 categories (3,713,804); the two headline slots are exact per region, and the",
      "'…'(<=10) suppressed cells satisfy the recorded per-row bound. Boundary joins 12/12."),
    warnings = list(
      "Category frames differ per wave (2002: 6 named + residual; 2014: 12; 2024: 10) — no cross-wave category change; comparable spine is the five great-tradition shares.",
      "2002 no-religion is null (residual bundles no-religion with other-religion); 2002 affiliation is a recorded lower bound.",
      "2014 '…'(<=10) suppression carried verbatim on small affiliation sub-categories; headline slots unaffected.",
      "Territorial scope: Abkhazia/South Ossetia not enumerated; 2002 carries a 1,956-person Abkhazia fraction (flagged); Shida Kartli enumerated in controlled part only (flagged).",
      "Municipality (2024 self-gov, 64 units) is a documented deeper product deferred on a boundary-vintage mismatch (geoBoundaries ADM2 is a 68-unit 2007 vintage).")),
  construct_notes = list(
    "The construct is census affiliation: each resident's reported religion (asked of the whole enumerated population, all ages), not practice, attendance, or membership. Religion was first tabulated in the 2002 census and again in 2014 and 2024.",
    "The public product carries three headline fields per region-wave: population total, religious affiliation percent, and no-religion percent. Place-density metrics are null (no governed place-of-worship snapshot).",
    "Category frames differ per wave and are preserved verbatim per region on the quality flag: 2002 has 6 named categories plus an 'other religion' residual that bundles other-religion with no-religion; 2014 has 12 categories; 2024 has 10 (Yazidis and Protestant folded into Other). No cross-wave category change is claimed.",
    "Slot design: 2014/2024 affiliation = population - None - Refusal - Not stated, and no-religion = None. 2002 affiliation = the five great-tradition sum (a recorded lower bound, residual excluded) and no-religion = null. Refusal and Not-stated (2014/2024) are disclosed denominator residuals, so the two shares need not sum to 100.",
    "Territorial scope (render the record): Geostat does not enumerate Abkhazia or South Ossetia. 2002 carries a 1,956-person Abkhazia A.R. fraction (mapped with a not-representative flag); 2014/2024 exclude the occupied territories entirely. Shida Kartli is enumerated in its Georgian-controlled part only in every wave; the polygon spans the full administrative extent (disclosed). No count is invented for any non-enumerated area.",
    "Licence: the census data ship under the Geostat Terms of Use open reuse grant (free reuse for any purpose with source attribution, quoted verbatim in source.licence and captured under data/raw/ge_census/). No reuse ask is needed; the product ships with attribution to the National Statistics Office of Georgia."),
  deferred_sources = list(
    list(source_dataset_id = "ge-census-2024-religion-by-self-governed-unit", status = "deferred",
         url = url_2024, local_path = path_2024,
         notes = "The 2024 table also gives religion by 64 self-governed units (municipalities + self-governing cities), clean and exact. Deferred: geoBoundaries GEO ADM2 is a 68-unit 2007 vintage that predates the self-governing-city reforms and mismatches the 2024 self-gov frame; an official Geostat self-gov layer or a 2024-vintage COD-AB ADM2 is the unblock. No concordance invented."),
    list(source_dataset_id = "ge-census-religion-urban-rural-sex", status = "deferred",
         url = url_2014, local_path = NULL,
         notes = "The 2014 table splits religion by urban/rural, and the 2024 table by sex, within region. Only the whole-population/both-sexes region block is shipped; the urban/rural and sex cuts are a deeper future product.")),
  privacy = "public",
  licence_status = "accepted",
  licence_basis = licence_basis_slug,
  downstream_status = "accepted",
  source_datasets = source_datasets(),
  notes = paste(
    "Accepted product (open Geostat reuse licence with attribution). The committed products are the derived region",
    "area summary (34 rows across 2002, 2014, 2024) and one geoBoundaries GEO ADM1 12-region boundary GeoJSON.",
    "On-page attribution, when a page is built, must cite the National Statistics Office of Georgia (Geostat) and",
    "geoBoundaries (CC BY 3.0)."))

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

cat("waves shipped: 2002 (12 regions), 2014 (11 regions), 2024 (11 regions) on one boundary set\n")
cat(sprintf("rows: %d (12 + 11 + 11)\n", length(rows)))
cat(sprintf("gate 2002: passed; both margins close to %d\n", nat_2002[["total"]]))
cat(sprintf("gate 2014: passed; national exact to %d; suppression bounds hold\n", nat_2014[["total"]]))
cat(sprintf("gate 2024: passed; both margins close to %d\n", nat_2024[["total"]]))
cat(sprintf("boundary: 12 features, %d bytes\n", file_bytes(geojson_out)))
cat("licence: accepted (Geostat open reuse with attribution); CC BY 3.0 boundary\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", geojson_out))
cat(sprintf("wrote %s\n", manifest_out))
