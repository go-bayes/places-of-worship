# build the Guyana region census-religion area-summary product for a single wave
# (2012) on the ten-unit geoBoundaries GUY ADM1 region frame. inputs (all cached,
# git-ignored, sha256 in research/countries/gy/route-probe.md):
#   data/raw/gy_census/gy_2012_Compendium2.pdf -> Table 2.19 "Distribution of the
#     Population by Religious Affiliation and Administrative Regions, Guyana: 2012"
#     (integer counts, 13 categories, 10 regions; p. 49)
#   data/raw/gy_census/geoBoundaries-GUY-ADM1.geojson -> 10-region ADM1 boundary
#   data/raw/gy_census/gb_guy_adm1_meta.json -> boundary licence metadata (ODbL 1.0)
# every religion cell is transcribed verbatim from Table 2.19 and reconciled against the
# printed control totals here (both margins close to 746,955); the build stops on any
# margin mismatch and never allocates, infers, rounds, imputes, or tunes a value. the
# table carries no Not Stated line: BoS prorated the 363 Not-Stated, 16,331 No-Contact,
# and 7,443 Institutional persons across the 13 groups, so the table spans the whole
# census population and the two headline shares sum to 100 by construction.
# outputs: apps/regions/gy/data/gy_region_2017.geojson,
#   apps/regions/gy/data/area_summary_region.{json,csv}, and
#   docs/manifests/gy-census-religion-2012.json.
# run from the repo root: Rscript scripts/build_gy_area_summary.R
# STAGED product: no page, no hub link. licence ACCEPTED (BoS Open Licence Agreement,
# free reuse with attribution); boundary ODbL 1.0 (OpenStreetMap). single-wave region
# product (religion is cross-tabbed by region with counts only in 2012; 2002 is
# percentages-only and inconsistent, 2022 not yet released). the page/single-wave
# decision is the conductor's, parallel to the Barbados/Antigua task-8 question.

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "GY"
script_id <- "scripts/build_gy_area_summary.R"
raw_dir <- "data/raw/gy_census"
product_dir <- "apps/regions/gy/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-12"
stamp <- paste0(retrieval_date, "T00:00:00Z")
git_commit <- trimws(system2("git", c("rev-parse", "HEAD"), stdout = TRUE))
if (length(git_commit) != 1L || !grepl("^[a-f0-9]{40}$", git_commit)) git_commit <- NULL

# geoBoundaries boundaryYearRepresented is 2017 for GUY ADM1.
boundary_level <- "region"
boundary_vintage <- "2017"
boundary_set_id <- "gy-region-2017-geoboundaries-adm1"

d2012 <- "gy-census-2012-compendium2-table-2-19-religion-by-region"
d_boundary <- "geoboundaries-guy-adm1-2017"

# ---- source urls and cached paths ----------------------------------------------
url_2012 <- "https://statisticsguyana.gov.gy/wp-content/uploads/2019/10/Final_2012_Census_Compendium2.pdf"
url_2002 <- "https://statisticsguyana.gov.gy/wp-content/uploads/2019/10/Guyana_National_Census-Report_2002.zip"
url_2022 <- "https://statisticsguyana.gov.gy/wp-content/uploads/2019/10/Preliminary-Report-Guyana-National-Population-and-Housing-Census-2022.pdf"
url_ola <- "https://statisticsguyana.gov.gy/open-licence-agreement/"
url_census <- "https://statisticsguyana.gov.gy/census/"
bos_home_url <- "https://statisticsguyana.gov.gy/"
boundary_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/GUY/ADM1/geoBoundaries-GUY-ADM1.geojson"
boundary_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/GUY/ADM1/"

path_2012 <- file.path(raw_dir, "gy_2012_Compendium2.pdf")
path_2002 <- file.path(raw_dir, "gy_2002_National_Report.zip")
path_2022 <- file.path(raw_dir, "Preliminary-Report-Guyana-National-Population-and-Housing-Census-2022.pdf")
path_ola <- file.path(raw_dir, "bos_open-licence-agreement.html")
path_census <- file.path(raw_dir, "bos_census.html")
boundary_path <- file.path(raw_dir, "geoBoundaries-GUY-ADM1.geojson")
boundary_meta_path <- file.path(raw_dir, "gb_guy_adm1_meta.json")

boundary_out <- file.path(product_dir, "gy_region_2017.geojson")
summary_json_out <- file.path(product_dir, "area_summary_region.json")
summary_csv_out <- file.path(product_dir, "area_summary_region.csv")
manifest_out <- file.path(manifest_dir, "gy-census-religion-2012.json")

# ---- canonical region frame ----------------------------------------------------
# ten regions in census "Region 1" .. "Region 10" order. the census table labels the
# columns by number; the build carries the official region names and joins to the
# geoBoundaries feature by ISO 3166-2 code (shapeISO), robust to the one shapeName typo
# ("Barina-Waini" for Barima-Waini, Region 1).
regions <- paste("Region", 1:10)
region_name <- c(
  `Region 1` = "Barima-Waini", `Region 2` = "Pomeroon-Supenaam",
  `Region 3` = "Essequibo Islands-West Demerara", `Region 4` = "Demerara-Mahaica",
  `Region 5` = "Mahaica-Berbice", `Region 6` = "East Berbice-Corentyne",
  `Region 7` = "Cuyuni-Mazaruni", `Region 8` = "Potaro-Siparuni",
  `Region 9` = "Upper Takutu-Upper Essequibo", `Region 10` = "Upper Demerara-Berbice")
# region -> ISO 3166-2 code used to join the boundary feature.
region_iso <- c(
  `Region 1` = "GY-BA", `Region 2` = "GY-PM", `Region 3` = "GY-ES", `Region 4` = "GY-DE",
  `Region 5` = "GY-MA", `Region 6` = "GY-EB", `Region 7` = "GY-CU", `Region 8` = "GY-PT",
  `Region 9` = "GY-UT", `Region 10` = "GY-UD")
region_slug <- c(
  `Region 1` = "region_01", `Region 2` = "region_02", `Region 3` = "region_03",
  `Region 4` = "region_04", `Region 5` = "region_05", `Region 6` = "region_06",
  `Region 7` = "region_07", `Region 8` = "region_08", `Region 9` = "region_09",
  `Region 10` = "region_10")

# ---- 2012 Table 2.19 (integer counts; 13-category frame) ------------------------
# verbatim source category order (Table 2.19). None = no-religion line. the table has no
# Not Stated line (prorated by BoS). every cell verified against a 200-dpi render of p.49.
cat_2012 <- c("Anglican", "Methodist", "Pentecostal", "Roman Catholic", "Jehovah Witness",
              "Seventh Day Adventist", "Bahai", "Muslim", "Hindu", "Rastafarian",
              "Other Christians", "None", "Other")

# per-region counts in cat_2012 order is awkward to read; instead store per-category the
# ten region values (Region 1 .. Region 10), matching the printed rows of Table 2.19.
cat_region_counts <- list(
  `Anglican`               = c(682, 3225, 3124, 16259, 3025, 3452, 3217, 694, 3608, 1676),
  `Methodist`              = c(31, 490, 1389, 6194, 792, 630, 72, 68, 6, 434),
  `Pentecostal`            = c(11030, 7667, 18251, 84424, 10611, 18086, 4347, 1062, 397, 14414),
  `Roman Catholic`         = c(9357, 1623, 2268, 19150, 376, 1891, 932, 4408, 12145, 751),
  `Jehovah Witness`        = c(554, 449, 1128, 4207, 638, 1408, 118, 62, 208, 830),
  `Seventh Day Adventist`  = c(941, 3792, 2899, 14262, 2896, 5670, 3182, 293, 505, 5934),
  `Bahai`                  = c(3, 25, 56, 234, 7, 47, 3, 3, 29, 14),
  `Muslim`                 = c(70, 3201, 12688, 18702, 4494, 10448, 350, 67, 135, 417),
  `Hindu`                  = c(114, 15556, 40666, 64752, 17006, 46196, 637, 116, 88, 308),
  `Rastafarian`            = c(40, 35, 317, 2056, 123, 234, 49, 79, 25, 538),
  `Other Christians`       = c(3792, 9407, 22996, 67093, 8231, 19193, 3084, 3498, 6498, 11258),
  `None`                   = c(832, 1067, 1657, 11548, 1324, 2030, 1106, 678, 279, 2898),
  `Other`                  = c(197, 273, 346, 2682, 297, 367, 1278, 49, 315, 520)
)

# printed control totals (Table 2.19 Total column and region Total row; cross-checked
# against Table 2.17 2012 national column).
total_2012_region <- setNames(
  c(27643L, 46810L, 107785L, 311563L, 49820L, 109652L, 18375L, 11077L, 24238L, 39992L), regions)
total_2012_cat <- setNames(
  c(38962L, 10106L, 170289L, 52901L, 9602L, 40374L, 421L, 50572L, 185439L, 3496L, 155050L, 23419L, 6324L),
  cat_2012)
national_2012 <- 746955L
no_rel_2012 <- "None"

# assemble the per-category matrix (category -> named region vector).
m2012 <- setNames(lapply(cat_2012, function(c) setNames(as.integer(cat_region_counts[[c]]), regions)), cat_2012)

# ---- reconciliation gate (fail-fast; stop, do not tune) -------------------------
# integer wave: every region column, every religion row, and both national margins must
# close exactly. any nonzero deviation stops the build.
reconcile_wave <- function(mat, cats, region_totals, cat_totals, national, year) {
  records <- list()
  for (s in regions) {
    col_sum <- sum(vapply(cats, function(c) mat[[c]][[s]], numeric(1)))
    if (col_sum != region_totals[[s]]) {
      stop(sprintf("%d region gate FAILED for %s: categories sum %d != printed total %d",
                   year, s, as.integer(col_sum), region_totals[[s]]), call. = FALSE)
    }
    records[[length(records) + 1L]] <- data.frame(
      year = year, margin = "region_column", key = s,
      computed = as.integer(col_sum), printed = as.integer(region_totals[[s]]),
      difference = as.integer(col_sum - region_totals[[s]]), stringsAsFactors = FALSE)
  }
  for (c in cats) {
    row_sum <- sum(mat[[c]])
    if (row_sum != cat_totals[[c]]) {
      stop(sprintf("%d religion-row gate FAILED for %s: ten-region sum %d != printed %d",
                   year, c, as.integer(row_sum), cat_totals[[c]]), call. = FALSE)
    }
    records[[length(records) + 1L]] <- data.frame(
      year = year, margin = "religion_row", key = c,
      computed = as.integer(row_sum), printed = as.integer(cat_totals[[c]]),
      difference = as.integer(row_sum - cat_totals[[c]]), stringsAsFactors = FALSE)
  }
  if (sum(region_totals) != national) {
    stop(sprintf("%d grand gate FAILED: region-total sum %d != printed national %d",
                 year, as.integer(sum(region_totals)), national), call. = FALSE)
  }
  if (sum(cat_totals) != national) {
    stop(sprintf("%d category-total gate FAILED: category-total sum %d != printed national %d",
                 year, as.integer(sum(cat_totals)), national), call. = FALSE)
  }
  do.call(rbind, records)
}

rec_2012 <- reconcile_wave(m2012, cat_2012, total_2012_region, total_2012_cat, national_2012, 2012L)
message(sprintf("gate 2012: PASSED (integer-exact; both margins close to %d)", national_2012))

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

required_inputs <- c(path_2012, boundary_path, boundary_meta_path)
invisible(lapply(required_inputs, require_file))

# confirm the pinned boundary licence, unit count, and type before use.
boundary_metadata <- fromJSON(boundary_meta_path, simplifyVector = FALSE)
if (!identical(boundary_metadata[["boundaryLicense"]], "Open Data Commons Open Database License 1.0") ||
    !identical(boundary_metadata[["admUnitCount"]], "10") ||
    !identical(boundary_metadata[["boundaryType"]], "ADM1")) {
  stop("geoBoundaries GUY ADM1 licence, unit count, or type metadata changed", call. = FALSE)
}
boundary_licence <- boundary_metadata[["boundaryLicense"]]

# Guyana-centred equal-area projection for land areas (compact, far from antimeridian).
gy_laea <- "+proj=laea +lat_0=4.9 +lon_0=-58.9 +datum=WGS84 +units=m +no_defs"

# join the ten census regions one-to-one to the geoBoundaries ADM1 features via the
# region-number -> ISO 3166-2 code crosswalk (shapeISO).
build_boundary <- function(path) {
  boundary <- st_make_valid(st_read(path, quiet = TRUE, stringsAsFactors = FALSE))
  if (nrow(boundary) != 10L) stop("geoBoundaries GUY ADM1 feature count is not 10", call. = FALSE)
  target_iso <- unname(region_iso[regions])
  idx <- match(target_iso, boundary[["shapeISO"]])
  if (anyNA(idx) || anyDuplicated(idx) || !setequal(idx, seq_len(10L))) {
    stop("census regions and geoBoundaries features do not join one-to-one by ISO code", call. = FALSE)
  }
  boundary <- boundary[idx, ]
  boundary[["area_name"]] <- unname(region_name[regions])
  boundary[["boundary_source_name"]] <- boundary[["shapeName"]]
  boundary[["area_code"]] <- unname(region_slug[regions])
  boundary[["area_unit_id"]] <- paste(boundary_set_id, unname(region_slug[regions]), sep = ":")
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- boundary_level
  boundary[["boundary_vintage"]] <- boundary_vintage
  boundary[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(boundary, gy_laea))) / 1e6
  boundary <- st_transform(st_make_valid(boundary), 4326)
  boundary[c("area_code", "area_name", "boundary_source_name", "area_unit_id",
             "boundary_set_id", "boundary_level", "boundary_vintage",
             "land_area_sq_km", "geometry")]
}

boundary <- build_boundary(boundary_path)

# full-extent gate: Guyana spans lon -61.4 to -56.5 E and lat 1.2 to 8.6 N.
bbox <- st_bbox(boundary)
if (bbox[["xmin"]] < -61.6 || bbox[["xmin"]] > -61.0 ||
    bbox[["xmax"]] < -57.0 || bbox[["xmax"]] > -56.2 ||
    bbox[["ymin"]] < 1.0 || bbox[["ymin"]] > 1.6 ||
    bbox[["ymax"]] < 8.2 || bbox[["ymax"]] > 8.8) {
  stop("boundary bbox does not match the expected Guyana extent", call. = FALSE)
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
if (nrow(written) != 10L) stop("simplified boundary does not contain 10 features", call. = FALSE)
w_valid <- st_is_valid(written)
if (any(st_is_empty(written)) || any(is.na(w_valid)) || any(!w_valid)) {
  stop("simplified boundary has empty or invalid geometries", call. = FALSE)
}
geom_hashes <- geometry_hashes(written)
if (length(unique(geom_hashes)) != 10L) stop("simplified boundary geometry hashes are not distinct", call. = FALSE)
message(sprintf("boundary: PASSED (10 valid distinct features, %d bytes at %g%% keep)",
                file_bytes(boundary_out), simplification[["keep_percent"]]))

# written is in census "Region 1".."Region 10" order (boundary was built in that order),
# so key the lookup vectors by the census region label used to iterate the rows.
land_area <- setNames(round(written[["land_area_sq_km"]], 4), regions)
area_unit <- setNames(written[["area_unit_id"]], regions)
area_code <- setNames(written[["area_code"]], regions)

# ---- product rows --------------------------------------------------------------
# slot design (ordinary two-slot, BB/SB/FM/KI precedent): religious_affiliation is the
# region population minus the None line; no_religion is the single None line. the 2012
# table has no Not Stated line (BoS prorated it away), so the two shares sum to 100 by
# construction. Guyana has a real None category (regionally varying), so no minority-
# share (task-6) treatment applies. counts are the published (prorated) integers.

flag_common <- paste(
  "census_affiliation", "all_persons_universe", "single_select_reported_religion",
  "religious_affiliation_percent_is_named_religion_share",
  "no_religion_percent_is_none_line_only",
  "no_not_stated_line_source_prorated_not_stated_nocontact_institutional",
  "two_shares_sum_to_100_by_construction",
  "single_wave_2012_region_product",
  "denominator_is_whole_census_population_746955",
  "licence_accepted_bos_open_licence_agreement",
  "boundary_odbl_1_0_openstreetmap",
  sep = ";")
flag_2012 <- paste(
  "frame_2012_thirteen_category_integer_counts",
  "none_line=None", "no_nonresponse_line_prorated",
  flag_common, sep = ";")

basis_2012 <- paste(
  "2012 Population and Housing Census, Final Compendium 2 'Population Composition',",
  "Table 2.19 'Distribution of the Population by Religious Affiliation and Administrative",
  "Regions'. The denominator is the printed region Total (whole census population, with",
  "Not-Stated/No-Contact/Institutional persons prorated across groups). Religious",
  "affiliation is the region population minus the None line.")

# build one schema-shaped area-summary row, carrying the verbatim per-region category
# breakdown on the quality flag (source_categories_verbatim pattern).
make_row <- function(s, year, mat, cats, region_total, no_rel_label,
                     flag, basis, dataset_id) {
  pop <- region_total[[s]]
  no_rel <- mat[[no_rel_label]][[s]]
  affiliation <- pop - no_rel
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

# rows carry the official region name (Barima-Waini, ...) as area_name; the census
# "Region N" label rides in the quality flag context via area_code region_0N.
rows <- list()
for (s in regions) {
  nm <- unname(region_name[[s]])
  r <- make_row(s, 2012L, m2012, cat_2012, total_2012_region, no_rel_2012, flag_2012, basis_2012, d2012)
  r[["area_name"]] <- nm
  rows[[length(rows) + 1L]] <- r
}

# ---- area-summary document -----------------------------------------------------

licence_accepted_text <- paste(
  "The Bureau of Statistics, Guyana (BoS) publishes an Open Licence Agreement",
  "(statisticsguyana.gov.gy/open-licence-agreement/) that governs use of BoS data. It",
  "grants 'a worldwide, royalty-free non-exclusive licence to freely use the data, copy,",
  "modify, translate, publish, adapt, distribute, create derivative works and value-added",
  "products for commercial and non-commercial purposes', conditioned on the",
  "acknowledgement-of-source notice. The required derived-tables notice is: 'This table",
  "was adapted from the Bureau of Statistics, Guyana, which is licenced under the Central",
  "Statistical Office's Open Licence Agreement.' Licence status: accepted. The boundary",
  "is Open Data Commons Open Database License 1.0 (OpenStreetMap).")

bos_attribution <- paste(
  "This table was adapted from the Bureau of Statistics, Guyana, which is licenced under",
  "the Central Statistical Office's Open Licence Agreement.")

source_datasets <- function() {
  list(
    list(
      source_dataset_id = d2012,
      name = "Guyana 2012 Population and Housing Census, Final Compendium 2 (Population Composition), Table 2.19: Distribution of the Population by Religious Affiliation and Administrative Regions",
      provider = "Bureau of Statistics, Guyana (BoS)",
      url = url_2012, retrieval_date = retrieval_date, local_path = path_2012,
      licence = list(name = licence_accepted_text, url = url_ola, attribution = bos_attribution),
      citation = "Bureau of Statistics, Guyana, 2012 Population and Housing Census, Final Compendium 2, Table 2.19.",
      access_limits = NULL,
      redistribution_limits = "Derived region summaries ship under the BoS Open Licence Agreement (free reuse with the acknowledgement-of-source notice). The raw census PDF is not committed.",
      notes = paste("Integer counts; 13-category frame. Both margins close exactly: every region column and every",
                    "religion row sum to the printed national total of 746,955. No cell suppression. The table carries",
                    "no Not Stated line: BoS prorated the 363 Not-Stated, 16,331 No-Contact, and 7,443 Institutional",
                    "persons across the 13 groups, so the table spans the whole census population and the two headline",
                    "shares sum to 100 by construction. Category national totals equal the Table 2.17 2012 column exactly.")),
    list(
      source_dataset_id = d_boundary,
      name = "geoBoundaries GUY ADM1 (10 regions)",
      provider = "geoBoundaries (William & Mary geoLab); boundary source OpenStreetMap",
      url = boundary_url, retrieval_date = retrieval_date, local_path = boundary_path,
      licence = list(name = boundary_licence, url = boundary_meta_url,
                     attribution = "geoBoundaries (gbOpen); boundary source (c) OpenStreetMap contributors, ODbL"),
      citation = "geoBoundaries GUY ADM1 (gbOpen, pinned 9469f09), 10 region boundaries.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary is committed under Open Data Commons Open Database License 1.0 (share-alike; attribution to OpenStreetMap contributors).",
      notes = paste("10 ADM1 regions, boundaryYearRepresented 2017, joined one-to-one to the census regions by ISO",
                    "3166-2 code (shapeISO). The extent spans lon -61.4 to -56.5E and lat 1.2 to 8.6N, far from the",
                    "antimeridian; no dateline handling is needed. The western regions fall within the Essequibo area",
                    "subject to a Venezuelan territorial claim; the layer renders the official Guyanese administrative",
                    "extent that the BoS census enumerates, neutrally."))
  )
}

indicators <- function() {
  denom_note <- paste(
    "Percentages use each region's whole-population Total (the 2012 table is prorated over",
    "Not-Stated/No-Contact/Institutional persons, so it has no residual line and the two",
    "headline shares sum to 100% by construction).")
  list(
    list(indicator_id = "population_total", label = "Census population total",
         description = "Region all-persons population represented in the 2012 religion table.",
         unit = "count", denominator_indicator_id = NULL,
         method = "Printed region Total from 2012 Census Compendium 2 Table 2.19.",
         temporal_coverage = "2012", spatial_coverage = "Guyana administrative regions (10)",
         quality_notes = "Religion is asked of the whole resident population (no age restriction). The 2012 table spans the full census population (national 746,955); BoS prorated the 363 Not-Stated, 16,331 No-Contact, and 7,443 Institutional persons across the 13 groups."),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
         description = "Share of the region population reporting affiliation with a named religion.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (population - None) / population.",
         temporal_coverage = "2012", spatial_coverage = "Guyana administrative regions (10)",
         quality_notes = paste("Single wave (2012): religion is cross-tabulated by region with counts only in the 2012 census (Compendium 2 Table 2.19); the 2002 census publishes region religion as percentages only (Tables 2.6A/2.6B) with internally inconsistent national totals, and the 2022 census has released only preliminary results with no religion table.", denom_note)),
    list(indicator_id = "no_religion_percent", label = "No religious affiliation %",
         description = "Share of the region population in the census None line.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * None / population.",
         temporal_coverage = "2012", spatial_coverage = "Guyana administrative regions (10)",
         quality_notes = paste("The national no-religion share was 3.14% in 2012 (23,419 / 746,955), ranging from 1.15% (Region 9) to 7.25% (Region 10); the construct is the share reporting None, read within each region's own denominator.", denom_note))
  )
}

visual_layers <- function() {
  list(
    list(visual_layer_id = "gy-region-religious-affiliation", label = "Religious affiliation %",
         description = "Guyana census-affiliation share by region (2012).", layer_type = "choropleth",
         indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "region whole-population Total (prorated; no residual line)"),
         colour_scale = "sequential", time_control = "none",
         aggregation_rule = "reported region value", uncertainty_display = "quality_flag",
         default_visibility = TRUE,
         notes = "Census affiliation, not practice, attendance, or membership. Single wave (2012)."),
    list(visual_layer_id = "gy-region-no-religion", label = "No religious affiliation %",
         description = "Guyana census no-religion share by region (2012).", layer_type = "choropleth",
         indicator_ids = list("no_religion_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "region whole-population Total"),
         colour_scale = "sequential", time_control = "none",
         aggregation_rule = "reported region value", uncertainty_display = "quality_flag",
         default_visibility = FALSE,
         notes = "The source category is None. The two headline shares sum to 100 by construction (prorated source).")
  )
}

summary_product <- list(
  schema_version = "area-summary.v1", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code,
                      level = boundary_level, vintage = boundary_vintage, source_dataset_id = d_boundary),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "No governed place-of-worship snapshot ships in the Guyana census product.",
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
  list(uri = path, url = url, format = format,
       bytes = if (file.exists(path)) file_bytes(path) else 0L,
       sha256 = if (file.exists(path)) sha256_file(path) else NULL,
       row_count = NULL, source_dataset_id = dataset_id, used_in_public_product = used,
       periods = periods, notes = notes,
       local_cache_hint = paste0(path, " (git-ignored by .gitignore data/ rule)"),
       raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/gy_census/"))
}

durable_file_record <- function(path, content, licence_status_value, licence_basis_value) {
  list(uri = paste0("repo:", path), storage_provider = "git_repository", format = sub("^.*\\.", "", path),
       bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = if (grepl("area_summary|\\.csv$", path)) row_count_file(path) else NULL,
       feature_count = if (grepl("\\.geojson$", path)) row_count_file(path) else NULL,
       content = content, privacy = "public",
       licence_status = licence_status_value, licence_basis = licence_basis_value)
}

licence_basis_slug <- "bos_open_licence_agreement"

raw_sources <- list(
  raw_source_record(path_2012, url_2012, "pdf", TRUE, "2012", d2012,
    "2012 Census Final Compendium 2 (Population Composition); Table 2.19 Religion by region (integer counts). Both margins close to 746,955. Page 49."),
  raw_source_record(path_2002, url_2002, "zip", FALSE, "2002", "gy-census-2002-national-report",
    "2002 National Census Report (zip). Chapter 2 Tables 2.6A/2.6B give region religion as percentages only (no counts) with internally inconsistent national totals. Context, not a shipped subnational source."),
  raw_source_record(path_2022, url_2022, "pdf", FALSE, "2022", "gy-census-2022-preliminary-report",
    "2022 Preliminary Report; population count only (878,674), no religion table. Documents the not-yet-released 2022 wave."),
  raw_source_record(path_ola, url_ola, "html", FALSE, "2026", d2012,
    "BoS Open Licence Agreement (verbatim licence grant and acknowledgement-of-source notice)."),
  raw_source_record(path_census, url_census, "html", FALSE, "2026", d2012,
    "BoS census page; download index for the 2002/2012/2022 census products."),
  raw_source_record(boundary_path, boundary_url, "geojson", TRUE, "2017", d_boundary,
    "geoBoundaries GUY ADM1 GeoJSON; 10 regions, ODbL 1.0 (OpenStreetMap). Pinned commit 9469f09."),
  raw_source_record(boundary_meta_path, boundary_meta_url, "json", FALSE, "2017", d_boundary,
    "geoBoundaries GUY ADM1 metadata; records ODbL 1.0, boundaryYearRepresented 2017, admUnitCount 10.")
)

dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)
dataset_id <- "gy-census-religion:gy:2012:bos-region"

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
  dataset_family = "gy-census-religion", dataset_role = "staged_evidence",
  scope = list(level = "country", country_codes = list("GY"), snapshot_date = NULL,
               snapshot_anchor = NULL, pipeline_stage = "staged"),
  created_at = stamp, created_by = script_id,
  target_years = list(2012L),
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation",
      shipped_waves = list(2012L),
      shipped_geography = "10 Guyana administrative regions (Barima-Waini, Pomeroon-Supenaam, Essequibo Islands-West Demerara, Demerara-Mahaica, Mahaica-Berbice, East Berbice-Corentyne, Cuyuni-Mazaruni, Potaro-Siparuni, Upper Takutu-Upper Essequibo, Upper Demerara-Berbice)",
      boundary_set = boundary_set_id,
      source_tables = list(
        `2012` = "2012 Census Compendium 2 Table 2.19 Distribution of the Population by Religious Affiliation and Administrative Regions (integer counts, 13 categories)"
      ),
      universes = list(
        `2012` = "whole census population, all ages (746,955); Not-Stated (363), No-Contact (16,331), and Institutional (7,443) persons prorated across the 13 groups"
      ),
      method_note = paste(
        "The 2012 religion cross-tab (Table 2.19) is a count table over the whole census population (746,955).",
        "Every cell is transcribed verbatim and verified against a 200-dpi render of Compendium 2 page 49. Both",
        "national margins close exactly, and the 13 category national totals equal the Table 2.17 2012 column exactly.",
        "The table has no Not Stated line: BoS prorated the Not-Stated/No-Contact/Institutional persons across groups,",
        "so the two headline shares sum to 100 by construction."
      ),
      denominators = list(
        `2012` = "printed region Total (whole census population); affiliation = population - None"
      ),
      slot_design = paste(
        "Ordinary two-slot (BB/SB/FM/KI precedent). religious_affiliation_percent is the share of the region",
        "population reporting a named religion (population minus None); no_religion_percent is the single None line.",
        "The 2012 table carries no Not Stated residual (prorated by BoS), so the two shares sum to 100 by construction",
        "(unlike Barbados/Belize). Guyana has a real, regionally-varying None category (1.15% to 7.25%), so no",
        "minority-share (task-6) treatment applies."
      ),
      category_frames = list(
        `2012` = as.list(cat_2012),
        alignment_note = paste(
          "Single-wave product: religion is cross-tabulated by region with counts only in the 2012 census. The 2002",
          "census (same 13-category frame nationally) publishes region religion as percentages only (Tables 2.6A/2.6B)",
          "with internally inconsistent national totals (Table 2.5 vs Table 2.6B vs the 2012 Compendium Table 2.17 2002",
          "column give three different totals), so no count-valued 2002 region wave is publishable. The 2022 census has",
          "released only preliminary results (population 878,674) with no religion table. No cross-wave region change is",
          "assertable; the 2012 frame is preserved verbatim."
        )
      ),
      change_rule = paste(
        "Single wave (2012): no cross-wave region change layer. National religion context exists for 2002 and 2012",
        "(Table 2.17), but the count-valued subnational (region) product is 2012-only."
      ),
      no_religion_treatment = list(
        `2012` = "single None line (national 23,419; 3.14%); no separate Not Stated line (prorated by BoS)"
      ),
      held_and_deferred = paste(
        "The 2002 region religion tables (2.6A/2.6B) are percentages-only with inconsistent national totals; a",
        "count-valued 2002 wave would require a BoS data request (courtesy ask). The 2022 census final results",
        "carrying religion are not yet released (only preliminary population). Both are documented gaps, not held",
        "sources with recoverable counts."
      ),
      territorial_note = "The western regions fall within the Essequibo area subject to a Venezuelan territorial claim; the build renders the official Guyanese administrative extent that the BoS census enumerates, neutrally, and takes no position on the dispute.",
      omitted_metrics = list("places_per_10000_residents", "place_density_per_sq_km"),
      boundary_simplification = simplification,
      local_cache_hint = "All raw sources are cached under data/raw/gy_census/ and remain git-ignored.",
      retrieval_record = raw_sources
    ),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")), digest = as.character(packageVersion("digest")),
      mapshaper = "scripts/lib/simplify_boundary.R (npx mapshaper)"
    )
  ),
  source = list(
    provider = "Bureau of Statistics, Guyana (BoS); geoBoundaries (William & Mary geoLab)",
    source_dataset_ids = list(d2012, d_boundary),
    source_urls = list(url_2012, url_2002, url_2022, url_ola, url_census, boundary_url, boundary_meta_url),
    retrieved_at = stamp,
    licence = licence_accepted_text,
    citation = "BoS 2012 Population and Housing Census Compendium 2 Table 2.19; geoBoundaries GUY ADM1 (gbOpen).",
    raw_redistribution = "The census PDF/zip and the geoBoundaries source GeoJSON are not committed; they remain in data/raw/gy_census/.",
    local_cache_hint = "data/raw/gy_census/ (git-ignored by .gitignore data/ rule)",
    raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/gy_census/")
  ),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = list(
    durable_file_record(summary_json_out, "Guyana 10-region census-affiliation area summary for 2012.", "accepted", licence_basis_slug),
    durable_file_record(summary_csv_out, "Flattened Guyana 10-region census-affiliation rows for 2012.", "accepted", licence_basis_slug),
    durable_file_record(boundary_out, "Simplified geoBoundaries GUY ADM1 10-region boundary GeoJSON.", "accepted", "geoboundaries_odbl_1_0")
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id,
         notes = "10 regions x 1 wave = 10 rows; whole-population universe; no suppressed cells."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out), built_by = script_id,
         notes = "10 region features from geoBoundaries GUY ADM1, simplified with mapshaper weighted keep-shapes.")
  ),
  validation = list(
    status = "passed_with_warnings",
    commands = list(
      paste("Rscript", script_id),
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/gy/data/area_summary_region.json",
      "bash scripts/validate_manifests.sh"
    ),
    gate_2012 = list(status = "passed", both_margins_close_to = national_2012,
                     region_column_checks = 10L, religion_row_checks = length(cat_2012),
                     records = reconciliation_block(rec_2012)),
    boundary_validation = list(status = "passed", feature_count = 10L,
                               distinct_geometry_hashes = length(unique(geom_hashes)),
                               geometry_hashes = as.list(geom_hashes),
                               bbox = list(xmin = unname(bbox[["xmin"]]), ymin = unname(bbox[["ymin"]]),
                                           xmax = unname(bbox[["xmax"]]), ymax = unname(bbox[["ymax"]])),
                               dateline_note = "extent lon -61.4 to -56.5E, lat 1.2 to 8.6N; far from the antimeridian, no dateline handling needed",
                               output_bytes = file_bytes(boundary_out), simplification = simplification,
                               licence = boundary_licence, adm_unit_count = boundary_metadata[["admUnitCount"]]),
    join_coverage = list(matched_regions = 10L, expected_regions = 10L, unmatched_regions = list(), unused_boundary_features = list()),
    notes = paste(
      "2012 Table 2.19 closes integer-exact at both margins (national total 746,955). Boundary joins 10/10 to",
      "geoBoundaries GUY ADM1 by ISO 3166-2 code with 10 distinct geometry hashes."
    ),
    warnings = list(
      "STAGED product: no page, no hub link. The page and the single-wave-subnational display decision are the conductor's (parallel to the Barbados/Antigua task-8 single-wave subnational question).",
      "Single-wave product: religion is cross-tabulated by region with counts only in 2012. 2002 region religion is percentages-only with inconsistent totals; 2022 final results carrying religion are not yet released.",
      "The 2012 table carries no Not Stated line (BoS prorated Not-Stated/No-Contact/Institutional persons across groups), so the two headline shares sum to 100 by construction; Guyana has a real, regionally-varying None category, so no task-6 treatment applies.",
      "The western regions fall within the Essequibo area subject to a Venezuelan territorial claim; the build renders the official Guyanese record neutrally."
    )
  ),
  construct_notes = list(
    "The construct is census affiliation: each resident's reported religion, asked of the whole resident population, not practice, attendance, or membership.",
    "The public product carries three headline fields per region-wave: population total, religious affiliation percent, and no-religion percent. Place-density metrics are null (no governed place-of-worship snapshot).",
    "Single wave (2012): religion is cross-tabulated by region with counts only in the 2012 census (Compendium 2 Table 2.19). The 2002 census publishes region religion as percentages only (Tables 2.6A/2.6B) with internally inconsistent national totals; the 2022 census has released only preliminary results with no religion table.",
    "The 2012 table spans the whole census population (746,955): BoS prorated the 363 Not-Stated, 16,331 No-Contact, and 7,443 Institutional persons across the 13 groups, so there is no Not Stated line and the two headline shares sum to 100 by construction.",
    "Slot design (ordinary two-slot, BB/SB/FM/KI precedent): religious_affiliation_percent is the share reporting a named religion (population minus None); no_religion_percent is the single None line. Guyana has a real, regionally-varying None category (1.15% to 7.25%), so no minority-share (task-6) treatment applies.",
    "Licence accepted: the BoS Open Licence Agreement grants free reuse (commercial and non-commercial) with the acknowledgement-of-source notice. The product ships with the required derived-tables attribution to the Bureau of Statistics, Guyana. The boundary is geoBoundaries GUY ADM1, 10 regions, Open Data Commons Open Database License 1.0 (OpenStreetMap), joined one-to-one by ISO 3166-2 code."
  ),
  deferred_sources = list(
    list(source_dataset_id = "gy-census-2002-national-report", status = "deferred",
         url = url_2002, local_path = path_2002,
         notes = paste("2002 National Census Report Chapter 2 Tables 2.6A/2.6B: region religion as one-decimal",
                       "percentages only (no counts), with internally inconsistent national totals across Table 2.5,",
                       "Table 2.6B, and the 2012 Compendium Table 2.17 2002 column. Not shipped; a count-valued 2002",
                       "region table would require a BoS data request (courtesy ask).")),
    list(source_dataset_id = "gy-census-2022-religion-by-region", status = "not_published",
         url = url_2022, local_path = path_2022,
         notes = paste("The 2022 census has released only preliminary results (population 878,674, January 2026); no",
                       "religion table is published in any geography. A future BoS final-report release is the only",
                       "route to a 2022 wave.")),
    list(source_dataset_id = "bos-data-request-2002-region-religion", status = "not_pinned",
         url = bos_home_url, local_path = NULL,
         notes = "A BoS data request for the 2002 region religion count table would extend the product to two waves; recorded as a courtesy ask for the PI.")
  ),
  privacy = "public",
  licence_status = "accepted",
  licence_basis = licence_basis_slug,
  downstream_status = "staged",
  source_datasets = source_datasets(),
  notes = paste(
    "STAGED product (no page, no hub link). The committed products are the derived 10-region area summary (10 rows",
    "for 2012) and the simplified geoBoundaries GUY ADM1 boundary. Licence accepted (BoS Open Licence Agreement, free",
    "reuse with the acknowledgement-of-source notice); boundary ODbL 1.0 (OpenStreetMap). Single-wave region product;",
    "the page decision is the conductor's, parallel to the Barbados/Antigua task-8 single-wave-subnational question."
  )
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

cat("wave shipped: 2012 on 10 Guyana regions\n")
cat(sprintf("rows: %d (10 regions x 1 wave)\n", length(rows)))
cat(sprintf("gate 2012: passed integer-exact; both margins close to %d\n", national_2012))
cat(sprintf("boundary gate: passed; 10/10 join, %d distinct geometry hashes, %d bytes at %g%% keep\n",
            length(unique(geom_hashes)), file_bytes(boundary_out), simplification[["keep_percent"]]))
cat("licence gate: accepted; BoS Open Licence Agreement with acknowledgement-of-source notice\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", boundary_out))
cat(sprintf("wrote %s\n", manifest_out))
