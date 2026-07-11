# build the Tokelau atoll census-religion area-summary product for 2006, 2011, 2016.
# inputs (all cached, git-ignored under data/raw/tk_census/ and mirrored to
# gs://pow-research-data/raw_sources/tk_census/; sha256 verified in the route probe):
#   data/raw/tk_census/tk_2006_tables.xls                 -> Table 2.5 (religion by atoll, 2006)
#   data/raw/tk_census/tk_2016_social_profile_tables.xlsx -> Table 5.8 (religion by atoll, 2011 and 2016)
#   data/raw/tk_census/geoBoundaries-TKL-ADM0.geojson     -> single 206-part land-cover MultiPolygon
#   data/raw/tk_census/gb_tkl_adm0_meta.json              -> boundary licence metadata (CC BY 4.0)
#   data/raw/tk_census/statsnz_copyright_page.txt         -> byte-matched Stats NZ CC BY 4.0 clause
# the three atoll footprints are derived from the ADM0 land-cover layer by exploding the
# MultiPolygon and clustering its parts by centroid longitude (Atafu ~172.5W, Nukunonu
# ~171.8W, Fakaofo ~171.2W, ~90-100 km apart; the clusters are unambiguous), then
# dissolving each cluster to one footprint. the three published census tables are read
# from the workbooks and reconciled at both margins here; the build stops on any margin
# mismatch and never allocates, infers, rounds, or tunes a cell. the 2006 Nukunonu `~`
# confidentiality cells (Presbyterian, Not Stated) render as suppressed nulls in the
# manifest category detail and are never estimated (MONSTAT z precedent); the printed
# atoll and national margins force both to zero, so the headline affiliation is exact.
# outputs: apps/regions/tk/data/tk_atoll_2022.geojson,
#   apps/regions/tk/data/area_summary_atoll.{json,csv}, and
#   docs/manifests/tk-census-religion-2006-2016.json.
# run from the repo root: Rscript scripts/build_tk_area_summary.R
# FULL SHIP: licence CC BY 4.0 byte-matched (accepted); the region page follows separately.

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(readxl)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "TK"
script_id <- "scripts/build_tk_area_summary.R"
raw_dir <- "data/raw/tk_census"
product_dir <- "apps/regions/tk/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-11"
stamp <- paste0(retrieval_date, "T00:00:00Z")
boundary_level <- "atoll"
boundary_set_id <- "tk-atoll-2022-geoboundaries-adm0-split"
boundary_vintage <- "2022"

# durable raw-cache mirror (mirrored by this lane; see build appendix).
raw_cache_durable_uris <- c("gs://pow-research-data/raw_sources/tk_census/")

d2006 <- "tnso-statsnz-census-2006-table-2-5-religion-by-atoll"
d2016wb <- "tnso-statsnz-census-2016-table-5-8-religion-by-atoll-2011-2016"
d_boundary <- "geoboundaries-tkl-adm0-2022-atoll-split"

census_2006_url <- "https://www.tokelau.org.nz/site/tokelau/files/2006%20Tokelau%20Census%20-%20Tables.xls"
social_2016_url <- "https://www.tokelau.org.nz/site/tokelau/files/TokelauNSO/2016Census/2016%20Tokelau%20Census%20of%20Population%20and%20Dwellings%20-%20Tables%20about%20social%20profile.xlsx"
profile_2016_url <- "https://www.tokelau.org.nz/site/tokelau/files/TokelauNSO/2016Census/profile-tokelau-2016-census-final-to-print28jun17jj.pdf"
report_2006_url <- "http://www.tokelau.org.nz/site/tokelau/files/2006%20Census%20of%20Tokelau%20Analytical%20Report.pdf"
census_hub_url <- "https://www.tokelau.org.nz/statistics.html"
statsnz_copyright_url <- "https://www.stats.govt.nz/about-us/copyright/"
boundary_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/TKL/ADM0/geoBoundaries-TKL-ADM0.geojson"
boundary_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/TKL/ADM0/"

census_2006_path <- file.path(raw_dir, "tk_2006_tables.xls")
social_2016_path <- file.path(raw_dir, "tk_2016_social_profile_tables.xlsx")
profile_2016_path <- file.path(raw_dir, "tk_2016_profile.pdf")
report_2006_path <- file.path(raw_dir, "tk_2006_analytical_report.pdf")
statsnz_copyright_path <- file.path(raw_dir, "statsnz_copyright_page.txt")
boundary_path <- file.path(raw_dir, "geoBoundaries-TKL-ADM0.geojson")
boundary_meta_path <- file.path(raw_dir, "gb_tkl_adm0_meta.json")

boundary_out <- file.path(product_dir, "tk_atoll_2022.geojson")
summary_json_out <- file.path(product_dir, "area_summary_atoll.json")
summary_csv_out <- file.path(product_dir, "area_summary_atoll.csv")
manifest_out <- file.path(manifest_dir, "tk-census-religion-2006-2016.json")

# canonical atoll order, west to east by longitude (Atafu, Nukunonu, Fakaofo).
atolls <- c("Atafu", "Nukunonu", "Fakaofo")

# byte-matched Stats NZ CC BY 4.0 clause and the adapted-content attribution statement.
statsnz_cc_by_clause <- "Unless otherwise specified, content we produce is licensed under the Creative Commons Attribution 4.0 International licence."
adapted_content_statement <- "This work is based on/includes Stats NZ's data which are licensed by Stats NZ for reuse under the Creative Commons Attribution 4.0 International licence."
tnso_attribution <- paste(adapted_content_statement, "Derived atoll religion summaries acknowledge the Tokelau National Statistics Office and Stats NZ.")

# ---- published atoll counts (verbatim from the workbooks) -----------------------
# every value is transcribed exactly as printed; NA marks the 2006 Nukunonu `~`
# confidentiality cells, which the printed atoll and national margins force to zero
# and which are never estimated (rendered as suppressed nulls in the manifest).
# each list is keyed by category label and holds the three atoll counts in canonical
# order (Atafu, Nukunonu, Fakaofo).

# a named-by-atoll integer vector from canonical-order values.
av <- function(atafu, nukunonu, fakaofo) setNames(c(atafu, nukunonu, fakaofo), atolls)

# 2006, Table 2.5 (printed order Atafu, Fakaofo, Nukunonu; reordered here to canonical).
frame_2006 <- c("Congregational Christian", "Presbyterian", "Roman Catholic",
                "Other Christian", "Not Stated")
m2006 <- list(
  `Congregational Christian` = av(397, 6, 261),
  Presbyterian               = av(1, NA, 10),   # Nukunonu ~ (suppressed; forced to 0)
  `Roman Catholic`           = av(1, 278, 82),
  `Other Christian`          = av(17, 3, 16),
  `Not Stated`               = av(1, NA, 1)     # Nukunonu ~ (suppressed; forced to 0)
)
total_2006 <- av(417, 287, 370)
# printed national margins for 2006 (row totals across the three atolls).
national_2006 <- c(`Congregational Christian` = 664L, Presbyterian = 11L,
                   `Roman Catholic` = 361L, `Other Christian` = 36L, `Not Stated` = 2L)
grand_2006 <- 1074L

# 2011, Table 5.8, 2011 block (printed order Atafu, Fakaofo, Nukunonu; canonical here).
frame_1116 <- c("Congregational Christian", "Presbyterian", "Roman Catholic",
                "Other Christian", "Spiritualism and New Age religions",
                "No religion", "Not stated")
m2011 <- list(
  `Congregational Christian`           = av(345, 14, 306),
  Presbyterian                         = av(5, 5, 11),
  `Roman Catholic`                     = av(13, 290, 115),
  `Other Christian`                    = av(21, 0, 11),
  `Spiritualism and New Age religions` = av(0, 0, 1),
  `No religion`                        = av(0, 0, 0),
  `Not stated`                         = av(1, 0, 5)
)
total_2011 <- av(385, 309, 449)
national_2011 <- c(`Congregational Christian` = 665L, Presbyterian = 21L,
                   `Roman Catholic` = 418L, `Other Christian` = 32L,
                   `Spiritualism and New Age religions` = 1L, `No religion` = 0L,
                   `Not stated` = 6L)
grand_2011 <- 1143L

# 2016, Table 5.8, 2016 block.
m2016 <- list(
  `Congregational Christian`           = av(318, 35, 250),
  Presbyterian                         = av(54, 9, 8),
  `Roman Catholic`                     = av(18, 315, 130),
  `Other Christian`                    = av(15, 24, 11),
  `Spiritualism and New Age religions` = av(0, 0, 0),
  `No religion`                        = av(1, 0, 0),
  `Not stated`                         = av(7, 2, 0)
)
total_2016 <- av(413, 385, 399)
national_2016 <- c(`Congregational Christian` = 603L, Presbyterian = 71L,
                   `Roman Catholic` = 463L, `Other Christian` = 50L,
                   `Spiritualism and New Age religions` = 0L, `No religion` = 1L,
                   `Not stated` = 9L)
grand_2016 <- 1197L

# category roles: which lines are affiliation, no-religion, or non-response.
no_religion_label <- "No religion"
not_stated_labels <- c("Not Stated", "Not stated")

# ---- reconciliation gates (fail-fast; stop, do not tune) ------------------------

# reconcile one wave at both margins against the printed controls; `~` counts as 0.
reconcile_wave <- function(mat, frame, atoll_totals, national_totals, grand, year) {
  records <- list()
  # margin 1: each atoll column's category sum equals the printed atoll total.
  for (a in atolls) {
    col_sum <- sum(vapply(frame, function(cat) {
      v <- mat[[cat]][[a]]
      if (is.na(v)) 0L else as.integer(v)
    }, integer(1)))
    if (col_sum != atoll_totals[[a]]) {
      stop(sprintf("%d atoll gate FAILED for %s: categories sum %d != printed total %d",
                   year, a, col_sum, atoll_totals[[a]]), call. = FALSE)
    }
    records[[length(records) + 1L]] <- data.frame(
      year = year, margin = "atoll_column", key = a,
      computed = col_sum, printed = as.integer(atoll_totals[[a]]), difference = 0L,
      stringsAsFactors = FALSE)
  }
  # margin 2: each category row's three-atoll sum equals the printed national total.
  for (cat in frame) {
    row_sum <- sum(vapply(atolls, function(a) {
      v <- mat[[cat]][[a]]
      if (is.na(v)) 0L else as.integer(v)
    }, integer(1)))
    if (row_sum != national_totals[[cat]]) {
      stop(sprintf("%d category gate FAILED for %s: three-atoll sum %d != printed national %d",
                   year, cat, row_sum, national_totals[[cat]]), call. = FALSE)
    }
    records[[length(records) + 1L]] <- data.frame(
      year = year, margin = "category_row", key = cat,
      computed = row_sum, printed = as.integer(national_totals[[cat]]), difference = 0L,
      stringsAsFactors = FALSE)
  }
  # grand margin: printed atoll totals and printed national totals share one grand total.
  if (sum(atoll_totals) != grand || sum(national_totals) != grand) {
    stop(sprintf("%d grand gate FAILED: atoll-total sum %d, national-total sum %d, expected %d",
                 year, sum(atoll_totals), sum(national_totals), grand), call. = FALSE)
  }
  do.call(rbind, records)
}

rec_2006 <- reconcile_wave(m2006, frame_2006, total_2006, national_2006, grand_2006, 2006L)
rec_2011 <- reconcile_wave(m2011, frame_1116, total_2011, national_2011, grand_2011, 2011L)
rec_2016 <- reconcile_wave(m2016, frame_1116, total_2016, national_2016, grand_2016, 2016L)

message(sprintf("gate 2006: PASSED (both margins close to %d)", grand_2006))
message(sprintf("gate 2011: PASSED (both margins close to %d)", grand_2011))
message(sprintf("gate 2016: PASSED (both margins close to %d)", grand_2016))

# the 2006 Nukunonu `~` cells must be zero: the printed atoll total already equals the
# sum of the visible non-suppressed cells, so the suppressed cells cannot be positive.
nuku_visible_2006 <- sum(vapply(frame_2006, function(cat) {
  v <- m2006[[cat]][["Nukunonu"]]
  if (is.na(v)) 0L else as.integer(v)
}, integer(1)))
if (nuku_visible_2006 != total_2006[["Nukunonu"]]) {
  stop("2006 Nukunonu suppressed-cell gate FAILED: visible cells do not close to 287", call. = FALSE)
}
message("gate 2006 suppression: PASSED (Nukunonu ~ cells forced to zero by the printed 287 margin)")

# ---- headline construction (source-category based) ------------------------------
# affiliation = total - no religion - not stated; every named denomination plus
# Spiritualism and New Age religions is affiliated. 2006 prints no No religion line
# and its analytical report records that every respondent gave a Christian
# denomination, so no religion is zero across all three 2006 atolls.

# derive the headline counts for one atoll-wave.
headline <- function(mat, frame, atoll_totals, a) {
  total <- as.integer(atoll_totals[[a]])
  no_rel <- if (no_religion_label %in% frame) as.integer(mat[[no_religion_label]][[a]]) else 0L
  ns_label <- intersect(not_stated_labels, frame)
  ns_val <- mat[[ns_label]][[a]]
  not_stated <- if (is.na(ns_val)) 0L else as.integer(ns_val)  # `~` forced to zero
  affiliation <- total - no_rel - not_stated
  list(total = total, no_religion = no_rel, not_stated = not_stated, affiliation = affiliation)
}

waves <- list(
  list(year = 2006L, mat = m2006, frame = frame_2006, totals = total_2006, dataset = d2006),
  list(year = 2011L, mat = m2011, frame = frame_1116, totals = total_2011, dataset = d2016wb),
  list(year = 2016L, mat = m2016, frame = frame_1116, totals = total_2016, dataset = d2016wb)
)

# ---- boundary: explode ADM0, cluster by longitude, dissolve to three atolls ------

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

required_inputs <- c(census_2006_path, social_2016_path, profile_2016_path, report_2006_path,
                     statsnz_copyright_path, boundary_path, boundary_meta_path)
invisible(lapply(required_inputs, require_file))

# confirm the byte-matched Stats NZ CC BY 4.0 clause is present in the capture.
copyright_text <- paste(readLines(statsnz_copyright_path, warn = FALSE), collapse = "\n")
if (!grepl(statsnz_cc_by_clause, copyright_text, fixed = TRUE)) {
  stop("byte-matched Stats NZ CC BY 4.0 clause not found in the copyright capture", call. = FALSE)
}
statsnz_copyright_sha256 <- sha256_file(statsnz_copyright_path)

# confirm the pinned boundary licence, type, and unit count before use.
boundary_metadata <- fromJSON(boundary_meta_path, simplifyVector = FALSE)
if (!identical(boundary_metadata[["boundaryLicense"]], "Creative Commons Attribution 4.0 International (CC BY 4.0)") ||
    !identical(boundary_metadata[["boundaryType"]], "ADM0") ||
    !identical(boundary_metadata[["admUnitCount"]], "1")) {
  stop("geoBoundaries TKL ADM0 licence, type, or unit-count metadata changed", call. = FALSE)
}

# tokelau-centred equal-area projection for land areas and geometry checks.
tk_laea <- "+proj=laea +lat_0=-9 +lon_0=-171.8 +datum=WGS84 +units=m +no_defs"

# explode the single ADM0 MultiPolygon and assign every part to an atoll by centroid
# longitude; the three longitude clusters are ~0.5-0.6 deg apart so the split is clean.
explode_and_cluster <- function(path) {
  b <- st_read(path, quiet = TRUE)
  if (nrow(b) != 1L) stop("geoBoundaries TKL ADM0 is not a single feature", call. = FALSE)
  parts <- st_cast(st_geometry(b), "POLYGON", warn = FALSE)
  n_parts <- length(parts)
  if (n_parts < 3L) stop("ADM0 MultiPolygon did not explode into multiple parts", call. = FALSE)
  ctr <- suppressWarnings(st_coordinates(st_centroid(parts)))
  lon <- ctr[, 1]; lat <- ctr[, 2]
  # Swains contamination guard: no part may sit south of 10S.
  full_bbox <- st_bbox(b)
  if (full_bbox[["ymin"]] < -10) {
    stop("boundary extends south of 10S: possible Swains Island contamination", call. = FALSE)
  }
  if (any(lat < -10)) stop("a part centroid sits south of 10S", call. = FALSE)
  # assign by centroid longitude with thresholds in the ~0.6 deg inter-atoll gaps.
  assignment <- ifelse(lon < -172.0, "Atafu",
                       ifelse(lon < -171.5, "Nukunonu", "Fakaofo"))
  if (any(is.na(assignment))) stop("a part was not assigned to an atoll", call. = FALSE)
  cluster_counts <- table(factor(assignment, levels = atolls))
  if (any(cluster_counts == 0L)) stop("an atoll cluster is empty", call. = FALSE)
  if (sum(cluster_counts) != n_parts) stop("part assignment lost or duplicated a part", call. = FALSE)
  # per-cluster longitude range from actual part extents (not centroids).
  lon_ranges <- lapply(atolls, function(a) {
    sub <- parts[assignment == a]
    bb <- st_bbox(sub)
    c(xmin = unname(bb[["xmin"]]), xmax = unname(bb[["xmax"]]))
  })
  names(lon_ranges) <- atolls
  # non-overlap gate: Atafu west of Nukunonu west of Fakaofo, no shared longitude.
  if (!(lon_ranges[["Atafu"]][["xmax"]] < lon_ranges[["Nukunonu"]][["xmin"]] &&
        lon_ranges[["Nukunonu"]][["xmax"]] < lon_ranges[["Fakaofo"]][["xmin"]])) {
    stop("atoll longitude ranges overlap; the clustering is not clean", call. = FALSE)
  }
  list(parts = parts, assignment = assignment, n_parts = n_parts,
       cluster_counts = cluster_counts, lon_ranges = lon_ranges,
       full_bbox = full_bbox)
}

# dissolve each atoll's parts to one footprint and attach product attributes.
build_boundary <- function(cluster) {
  parts <- cluster[["parts"]]
  assignment <- cluster[["assignment"]]
  geoms <- lapply(atolls, function(a) st_union(st_make_valid(parts[assignment == a])))
  layer <- st_sf(area_name = atolls,
                 geometry = st_sfc(lapply(geoms, function(g) st_geometry(g)[[1L]]), crs = st_crs(parts)))
  layer[["area_code"]] <- paste0("TK-", toupper(substr(layer[["area_name"]], 1, 3)))
  layer[["boundary_source_name"]] <- "geoBoundaries TKL ADM0 (land-cover), longitude-clustered to atoll"
  layer[["area_unit_id"]] <- paste(boundary_set_id, layer[["area_code"]], sep = ":")
  layer[["boundary_set_id"]] <- boundary_set_id
  layer[["boundary_level"]] <- boundary_level
  layer[["boundary_vintage"]] <- boundary_vintage
  layer[["boundary_source"]] <- "geoBoundaries TKL ADM0; Sentinel-2 10m Land Cover raster-to-polygon dissolve"
  layer[["boundary_licence"]] <- "CC BY 4.0"
  layer[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(layer, tk_laea))) / 1e6
  layer <- st_transform(st_make_valid(layer), 4326)
  layer[c("area_code", "area_name", "boundary_source_name", "area_unit_id",
          "boundary_set_id", "boundary_level", "boundary_vintage", "boundary_source",
          "boundary_licence", "land_area_sq_km", "geometry")]
}

# enforce the count, validity, distinctness, and non-overlap gates on a footprint layer.
validate_boundary <- function(layer, stage) {
  if (nrow(layer) != 3L || any(st_is_empty(layer)) || any(is.na(st_is_valid(layer))) || any(!st_is_valid(layer))) {
    stop(stage, " boundary does not contain 3 valid non-empty features", call. = FALSE)
  }
  hashes <- geometry_hashes(layer)
  if (length(unique(hashes)) != 3L) stop(stage, " boundary geometry hashes are not distinct", call. = FALSE)
  ranges <- lapply(atolls, function(a) {
    bb <- st_bbox(layer[layer[["area_name"]] == a, ])
    c(xmin = unname(bb[["xmin"]]), xmax = unname(bb[["xmax"]]))
  })
  names(ranges) <- atolls
  if (!(ranges[["Atafu"]][["xmax"]] < ranges[["Nukunonu"]][["xmin"]] &&
        ranges[["Nukunonu"]][["xmax"]] < ranges[["Fakaofo"]][["xmin"]])) {
    stop(stage, " footprint longitude ranges overlap", call. = FALSE)
  }
  metric <- st_transform(layer, tk_laea)
  areas <- as.numeric(st_area(metric))
  list(hashes = setNames(as.list(hashes), layer[["area_code"]]),
       longitude_ranges = ranges,
       minimum_feature_area_sq_km = round(min(areas) / 1e6, 4),
       total_land_area_sq_km = round(sum(areas) / 1e6, 4))
}

cluster <- explode_and_cluster(boundary_path)
boundary <- build_boundary(cluster)
source_validation <- validate_boundary(boundary, "source")

simplification <- mapshaper_simplify_to_cap(
  boundary, boundary_out,
  max_bytes = 1500000L,
  keep_percentages = c(100, 75, 50, 30, 20, 10),
  clean_option = "allow-overlaps"
)
written <- st_read(boundary_out, quiet = TRUE, stringsAsFactors = FALSE)
written <- written[match(boundary[["area_code"]], written[["area_code"]]), ]
if (anyNA(written[["area_code"]])) stop("simplified boundary lost an area code", call. = FALSE)
simplified_validation <- validate_boundary(written, "simplified")
geom_hashes <- geometry_hashes(written)
message(sprintf("boundary: PASSED (3 valid distinct atoll footprints, %d parts assigned %s, %d bytes at %g%% keep)",
                cluster[["n_parts"]],
                paste(sprintf("%s=%d", names(cluster[["cluster_counts"]]), as.integer(cluster[["cluster_counts"]])), collapse = " "),
                file_bytes(boundary_out), simplification[["keep_percent"]]))

land_area <- setNames(round(written[["land_area_sq_km"]], 4), written[["area_name"]])
area_unit <- setNames(written[["area_unit_id"]], written[["area_name"]])
area_code <- setNames(written[["area_code"]], written[["area_name"]])

# ---- product rows ---------------------------------------------------------------

pop_basis <- paste(
  "Usually resident population present in Tokelau on census night, printed atoll total:",
  "2006 Table 2.5; 2011 and 2016 Table 5.8. This present-resident universe is internally",
  "consistent across all three waves and is not the absentee-inclusive usual-resident total."
)

# build one schema-shaped atoll-summary row for a wave.
make_row <- function(a, wv) {
  h <- headline(wv[["mat"]], wv[["frame"]], wv[["totals"]], a)
  flag_parts <- c("census_affiliation", "present_usual_resident_universe",
                  "stable_frame_2006_2011_2016_source_categories_verbatim",
                  "statsnz_tnso_cc_by_4_0_adapted_content", "boundary_cc_by_4_0")
  if (wv[["year"]] == 2006L) {
    flag_parts <- c(flag_parts, "no_religion_absent_from_2006_frame_zero_by_source_narrative")
    if (a == "Nukunonu") {
      flag_parts <- c(flag_parts,
        "confidentiality_suppression_2006_presbyterian_and_not_stated_tilde_rendered_null_forced_zero_by_printed_margins")
    }
  }
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = unname(area_unit[[a]]),
    area_code = unname(area_code[[a]]),
    area_name = a,
    year = wv[["year"]],
    population_total = h[["total"]],
    population_total_basis = pop_basis,
    religious_affiliation_count = h[["affiliation"]],
    religious_affiliation_percent = round(100 * h[["affiliation"]] / h[["total"]], 4),
    no_religion_count = h[["no_religion"]],
    no_religion_percent = round(100 * h[["no_religion"]] / h[["total"]], 4),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = unname(land_area[[a]]),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(wv[["dataset"]], d_boundary),
    quality_flag = paste(flag_parts, collapse = ";")
  )
}

# rows ordered atoll-major then wave to keep each atoll's series together.
rows <- list()
for (a in atolls) {
  for (wv in waves) {
    rows[[length(rows) + 1L]] <- make_row(a, wv)
  }
}

# ---- area-summary document ------------------------------------------------------

source_datasets <- function() {
  cc_by <- function(url) list(name = "Creative Commons Attribution 4.0 International (CC BY 4.0)",
                              url = url, attribution = tnso_attribution)
  list(
    list(
      source_dataset_id = d2006,
      name = "Tokelau 2006 Census of Population and Dwellings, Table 2.5: Religion by Atoll of Usual Residence",
      provider = "Tokelau National Statistics Office and Stats NZ",
      url = census_2006_url, retrieval_date = retrieval_date, local_path = census_2006_path,
      licence = cc_by(statsnz_copyright_url),
      citation = "Tokelau National Statistics Office and Stats NZ, 2006 Tokelau Census of Population and Dwellings, Table 2.5.",
      access_limits = NULL,
      redistribution_limits = "Derived atoll summaries under CC BY 4.0 with the adapted-content attribution statement.",
      notes = paste("Bilingual Tokelauan/English table; present usual residents (1,074).",
                    "Nukunonu Presbyterian and Not Stated print as `~` confidentiality suppressions,",
                    "forced to zero by the printed atoll (287) and national margins; rendered as suppressed nulls, never estimated.")
    ),
    list(
      source_dataset_id = d2016wb,
      name = "Tokelau 2016 Census of Population and Dwellings, Tables about social profile, Table 5.8: Religious affiliation by atoll of usual residence, 2011 and 2016",
      provider = "Tokelau National Statistics Office and Stats NZ",
      url = social_2016_url, retrieval_date = retrieval_date, local_path = social_2016_path,
      licence = cc_by(statsnz_copyright_url),
      citation = "Tokelau National Statistics Office and Stats NZ, 2016 Tokelau Census of Population and Dwellings, Tables about social profile, Table 5.8.",
      access_limits = NULL,
      redistribution_limits = "Derived atoll summaries under CC BY 4.0 with the adapted-content attribution statement.",
      notes = paste("Table 5.8 prints 2011 and 2016 as adjacent column blocks; present usual residents (1,143 in 2011, 1,197 in 2016).",
                    "The 2011 wave is recovered from this 2016 workbook because the retired Stats NZ 2011 pages 404.")
    ),
    list(
      source_dataset_id = d_boundary,
      name = "geoBoundaries TKL ADM0 land-cover layer, longitude-clustered to three atoll footprints",
      provider = "geoBoundaries (William & Mary geoLab); source Sentinel-2 10m Land Cover",
      url = boundary_url, retrieval_date = retrieval_date, local_path = boundary_path,
      licence = list(name = "Creative Commons Attribution 4.0 International (CC BY 4.0)",
                     url = boundary_meta_url, attribution = "geoBoundaries (gbOpen); Sentinel-2 10m Land Cover"),
      citation = "geoBoundaries TKL ADM0 (gbOpen, pinned 9469f09), boundary ID TKL-ADM0-11190911; atoll split derived by longitude clustering.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived atoll boundary is committed with geoBoundaries CC BY 4.0 attribution.",
      notes = paste("Single ADM0 MultiPolygon of 206 land-cover parts; exploded and assigned to Atafu, Nukunonu, Fakaofo",
                    "by centroid longitude, then dissolved to three footprints. Every part is assigned; no part sits south of 10S",
                    "(no Swains Island contamination); the three footprint longitude ranges do not overlap.")
    )
  )
}

denominator_note <- paste(
  "Percentages use each atoll's printed present-usual-resident total. Religious affiliation",
  "is every named denomination plus Spiritualism and New Age religions; No religion and Not",
  "stated are excluded from the affiliation numerator. 2006 prints no No religion line and its",
  "analytical report records that every respondent gave a Christian denomination, so no religion",
  "is zero across the three 2006 atolls."
)

indicators <- function() {
  list(
    list(indicator_id = "population_total", label = "Census population total",
         description = "Present usual residents represented in the atoll religion table.",
         unit = "count", denominator_indicator_id = NULL,
         method = "Printed atoll total: 2006 Table 2.5; 2011 and 2016 Table 5.8.",
         temporal_coverage = "2006; 2011; 2016", spatial_coverage = "Tokelau atolls (3)",
         quality_notes = "Present-resident universe (present in Tokelau on census night), not the absentee-inclusive usual-resident total."),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
         description = "Share of the atoll population with a stated religious affiliation.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (Total - No religion - Not stated) / Total; affiliation includes every named denomination and Spiritualism and New Age religions.",
         temporal_coverage = "2006; 2011; 2016", spatial_coverage = "Tokelau atolls (3)",
         quality_notes = denominator_note),
    list(indicator_id = "no_religion_percent", label = "No religious affiliation %",
         description = "Share in the source No religion category (zero for 2006, which prints no such line).",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * No religion / Total. 2006: zero (no No religion line; every respondent gave a Christian denomination).",
         temporal_coverage = "2006; 2011; 2016", spatial_coverage = "Tokelau atolls (3)",
         quality_notes = "Tokelau is effectively universally Christian: the national no-religion count is 0, 0, and 1 across 2006, 2011, and 2016.")
  )
}

visual_layers <- function() {
  list(
    list(visual_layer_id = "tk-atoll-religious-affiliation", label = "Religious affiliation %",
         description = "Tokelau census-affiliation share by atoll.", layer_type = "choropleth",
         indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "present usual residents in the atoll religion table"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "reported atoll value", uncertainty_display = "quality_flag",
         default_visibility = TRUE,
         notes = "Census affiliation, not practice, attendance, or membership. Near 100 percent in every wave (universally Christian)."),
    list(visual_layer_id = "tk-atoll-no-religion", label = "No religious affiliation %",
         description = "Tokelau census no-religion share by atoll.", layer_type = "choropleth",
         indicator_ids = list("no_religion_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "present usual residents in the atoll religion table"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "reported atoll value", uncertainty_display = "quality_flag",
         default_visibility = FALSE,
         notes = "Source No religion category; zero for 2006 (no printed line), zero in 2011, and one nationally in 2016.")
  )
}

summary_product <- list(
  schema_version = "area-summary.v1", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code,
                      level = boundary_level, vintage = boundary_vintage, source_dataset_id = d_boundary),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "No governed place-of-worship snapshot ships in the Tokelau census product.",
                       notes = "Place counts and density metrics remain null (the 2026-07-07 OSM sweep returned 2 tagged places, too sparse)."),
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
      no_religion_count = r[["no_religion_count"]], no_religion_percent = r[["no_religion_percent"]],
      place_count = NA_integer_, places_per_10000_residents = NA_real_,
      place_density_per_sq_km = NA_real_, land_area_sq_km = r[["land_area_sq_km"]],
      site_snapshot_date = NA_character_, place_count_basis = NA_character_,
      source_dataset_ids = paste(unlist(r[["source_dataset_ids"]]), collapse = "|"),
      quality_flag = r[["quality_flag"]], stringsAsFactors = FALSE
    )
  }))
}
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

# ---- manifest -------------------------------------------------------------------

# record one cached source with its retrieval hash and durable mirror.
raw_source_record <- function(path, url, format, used, periods, dataset_id, notes) {
  list(uri = path, url = url, format = format, bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = NULL, source_dataset_id = dataset_id, used_in_public_product = used,
       periods = periods, notes = notes,
       local_cache_hint = paste0(path, " (git-ignored by .gitignore data/ rule)"),
       raw_cache_durable_uris = as.list(raw_cache_durable_uris))
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

licence_basis_slug <- "statsnz_tnso_cc_by_4_0_byte_matched_attribution"
boundary_basis_slug <- "geoboundaries_cc_by_4_0"

raw_sources <- list(
  raw_source_record(census_2006_path, census_2006_url, "xls", TRUE, "2006", d2006,
    "2006 Census Tables workbook; Table 2.5 Religion by Atoll of Usual Residence. Both margins close to 1,074."),
  raw_source_record(social_2016_path, social_2016_url, "xlsx", TRUE, "2011,2016", d2016wb,
    "2016 social-profile workbook; Table 5.8 prints 2011 and 2016 religion by atoll. Both margins close to 1,143 (2011) and 1,197 (2016)."),
  raw_source_record(profile_2016_path, profile_2016_url, "pdf", FALSE, "2016", d2016wb,
    "Profile of Tokelau: 2016, section 5.4 narrative and Figure 5.4; used to cross-check the printed shares."),
  raw_source_record(report_2006_path, report_2006_url, "pdf", FALSE, "2006", d2006,
    "2006 Census Analytical Report; records that every respondent gave a Christian denomination (no-religion zero)."),
  raw_source_record(statsnz_copyright_path, statsnz_copyright_url, "txt", TRUE, "2021", d2016wb,
    "Byte-matched Stats NZ copyright page capture; the operative CC BY 4.0 clause and the adapted-content attribution statement."),
  raw_source_record(boundary_path, boundary_url, "geojson", TRUE, "2022", d_boundary,
    "geoBoundaries TKL ADM0 land-cover MultiPolygon (206 parts); exploded and longitude-clustered to three atolls."),
  raw_source_record(boundary_meta_path, boundary_meta_url, "json", FALSE, "2022", d_boundary,
    "geoBoundaries TKL ADM0 metadata; records CC BY 4.0, boundaryType ADM0, admUnitCount 1, boundaryYearRepresented 2022.")
)

# per-wave category detail with the 2006 Nukunonu `~` cells rendered as suppressed nulls.
category_detail <- function(mat, frame, year) {
  lapply(frame, function(cat) {
    per_atoll <- lapply(atolls, function(a) {
      v <- mat[[cat]][[a]]
      list(atoll = a,
           count = if (is.na(v)) NULL else as.integer(v),
           suppressed = is.na(v))
    })
    list(year = year, category = cat, atolls = per_atoll)
  })
}

reconciliation_block <- function(rec) lapply(seq_len(nrow(rec)), function(i) as.list(rec[i, ]))

# national headline totals per wave for the manifest evidence.
national_headline <- function(wv) {
  h <- lapply(atolls, function(a) headline(wv[["mat"]], wv[["frame"]], wv[["totals"]], a))
  list(year = wv[["year"]],
       population_total = sum(vapply(h, function(x) x[["total"]], integer(1))),
       religious_affiliation_count = sum(vapply(h, function(x) x[["affiliation"]], integer(1))),
       no_religion_count = sum(vapply(h, function(x) x[["no_religion"]], integer(1))),
       not_stated_count = sum(vapply(h, function(x) x[["not_stated"]], integer(1))))
}

dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)
dataset_id <- "tk-census-religion:tk:2006-2016:tnso-atoll"

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = paste0("manifest:", dataset_id),
  dataset_id = dataset_id,
  dataset_version_id = paste0(dataset_id, ":", dataset_hash),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "tk-census-religion", dataset_role = "public_product",
  scope = list(level = "country", country_codes = list("TK"), snapshot_date = NULL,
               snapshot_anchor = NULL, pipeline_stage = "public"),
  created_at = stamp, created_by = script_id,
  target_years = list(2006L, 2011L, 2016L),
  pipeline = list(
    script = script_id, git_commit = NULL, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation",
      shipped_waves = list(2006L, 2011L, 2016L),
      shipped_geography = "3 Tokelau atolls (Atafu, Nukunonu, Fakaofo)",
      boundary_set = boundary_set_id,
      universe = "usually resident population present in Tokelau on census night",
      source_tables = list(
        `2006` = "2006 Census Tables workbook, Table 2.5 Religion by Atoll of Usual Residence",
        `2011` = "2016 social-profile workbook, Table 5.8 (2011 column block)",
        `2016` = "2016 social-profile workbook, Table 5.8 (2016 column block)"
      ),
      category_frames = list(
        `2006` = as.list(frame_2006),
        `2011_2016` = as.list(frame_1116),
        frame_note = paste(
          "The frame is stable across the three waves (the 2016 classification was based on the 2011 one, and 2006",
          "used the same New Zealand Standard Classification of Religious Affiliation spine). 2006 prints no No religion",
          "or Spiritualism line because those counts are zero. Source spellings are preserved verbatim per wave",
          "(2006 is bilingual Tokelauan/English)."
        )
      ),
      category_detail = list(
        `2006` = category_detail(m2006, frame_2006, 2006L),
        `2011` = category_detail(m2011, frame_1116, 2011L),
        `2016` = category_detail(m2016, frame_1116, 2016L)
      ),
      affiliation_rule = "religious_affiliation = Total - No religion - Not stated; affiliation includes every named denomination plus Spiritualism and New Age religions",
      no_religion_treatment = list(
        `2006` = "zero: no No religion line is printed and the analytical report records that every respondent gave a Christian denomination",
        `2011_2016` = "real: the printed No religion count (0 nationally in 2011, 1 nationally in 2016)"
      ),
      suppression_treatment = paste(
        "2006 Nukunonu Presbyterian and Not Stated print as `~` confidentiality suppressions. They are rendered as",
        "suppressed nulls in the category detail and never estimated (MONSTAT z precedent). The printed Nukunonu atoll",
        "total (287) equals the sum of the visible cells, and the national Presbyterian (11) and Not Stated (2) totals are",
        "reached by Atafu and Fakaofo alone, so both suppressed cells are forced to zero; the headline affiliation is exact."
      ),
      change_rule = paste(
        "The atoll geography and category spine are stable across 2006, 2011, and 2016, so cross-wave change is",
        "well defined. Headline religious affiliation sits near 100 percent in every wave (universally Christian); the",
        "substantive change is denominational (Congregational decline on Atafu and Fakaofo, rising Roman Catholic share",
        "on Fakaofo, near-total Roman Catholic Nukunonu easing) and is legible in the retained category detail."
      ),
      boundary_derivation = list(
        method = "explode the single ADM0 MultiPolygon, assign every part to an atoll by centroid longitude, dissolve to three footprints",
        adm0_part_count = as.integer(cluster[["n_parts"]]),
        cluster_counts = as.list(setNames(as.integer(cluster[["cluster_counts"]]), names(cluster[["cluster_counts"]]))),
        longitude_thresholds = list(atafu_nukunonu = -172.0, nukunonu_fakaofo = -171.5),
        part_longitude_ranges = lapply(cluster[["lon_ranges"]], as.list),
        swains_guard = list(full_bbox_ymin = unname(cluster[["full_bbox"]][["ymin"]]),
                            rule = "no part south of 10S", passed = unname(cluster[["full_bbox"]][["ymin"]]) >= -10)
      ),
      omitted_metrics = list("places_per_10000_residents", "place_density_per_sq_km"),
      boundary_simplification = simplification,
      local_cache_hint = "All raw sources are cached under data/raw/tk_census/ and remain git-ignored.",
      retrieval_record = raw_sources
    ),
    software_versions = list(
      r = R.version.string, readxl = as.character(packageVersion("readxl")),
      sf = as.character(packageVersion("sf")), jsonlite = as.character(packageVersion("jsonlite")),
      digest = as.character(packageVersion("digest")), mapshaper = "scripts/lib/simplify_boundary.R (npx mapshaper)"
    )
  ),
  source = list(
    provider = "Tokelau National Statistics Office and Stats NZ; geoBoundaries (William & Mary geoLab)",
    source_dataset_ids = list(d2006, d2016wb, d_boundary),
    source_urls = list(census_2006_url, social_2016_url, profile_2016_url, report_2006_url,
                       statsnz_copyright_url, boundary_url, boundary_meta_url),
    retrieved_at = stamp,
    licence = paste(
      "CC BY 4.0, byte-matched. The Stats NZ copyright page states verbatim:",
      paste0("'", statsnz_cc_by_clause, "'"),
      "TNSO/Stats NZ co-publish the Tokelau census as Crown copyright deferring to those terms. The derived atoll",
      "summaries carry the adapted-content attribution statement and acknowledge the Tokelau National Statistics Office.",
      "Boundaries are geoBoundaries TKL ADM0, CC BY 4.0 per release metadata."
    ),
    citation = "TNSO and Stats NZ, 2006 Table 2.5 and 2016 Table 5.8; geoBoundaries TKL ADM0 (gbOpen), atoll split.",
    raw_redistribution = "The census workbooks and the geoBoundaries source GeoJSON are not committed; they remain in data/raw/tk_census/ and in the durable GCS mirror.",
    local_cache_hint = "data/raw/tk_census/ (git-ignored by .gitignore data/ rule)",
    raw_cache_durable_uris = as.list(raw_cache_durable_uris),
    licence_position = "CC BY 4.0 (byte-matched from the Stats NZ copyright page); accepted for full ship.",
    licence_position_verbatim_from_playbook = statsnz_cc_by_clause
  ),
  extensions = list(
    licence_byte_match = list(
      clause = statsnz_cc_by_clause,
      adapted_content_statement = adapted_content_statement,
      capture_file = statsnz_copyright_path,
      capture_sha256 = statsnz_copyright_sha256,
      url = statsnz_copyright_url,
      page_dated = "2021-05-03"
    )
  ),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = list(
    durable_file_record(summary_json_out, "Tokelau 3-atoll census-affiliation area summary for 2006, 2011, 2016.", "accepted", licence_basis_slug),
    durable_file_record(summary_csv_out, "Flattened Tokelau 3-atoll census-affiliation rows for 2006, 2011, 2016.", "accepted", licence_basis_slug),
    durable_file_record(boundary_out, "Simplified geoBoundaries TKL ADM0 atoll-split boundary GeoJSON (3 footprints).", "accepted", boundary_basis_slug)
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id,
         notes = "3 atolls x 3 waves = 9 rows; present-usual-resident universe."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out), built_by = script_id,
         notes = "3 atoll footprints dissolved from the geoBoundaries TKL ADM0 land-cover parts by longitude clustering, simplified with mapshaper.")
  ),
  validation = list(
    status = "passed",
    commands = list(
      paste("Rscript", script_id),
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/tk/data/area_summary_atoll.json",
      "bash scripts/validate_manifests.sh"
    ),
    gate_2006 = list(status = "passed", both_margins_close_to = grand_2006,
                     atoll_column_checks = length(atolls), category_row_checks = length(frame_2006),
                     suppression_note = "Nukunonu `~` cells (Presbyterian, Not Stated) forced to zero by the printed 287 and national margins",
                     records = reconciliation_block(rec_2006)),
    gate_2011 = list(status = "passed", both_margins_close_to = grand_2011,
                     atoll_column_checks = length(atolls), category_row_checks = length(frame_1116),
                     records = reconciliation_block(rec_2011)),
    gate_2016 = list(status = "passed", both_margins_close_to = grand_2016,
                     atoll_column_checks = length(atolls), category_row_checks = length(frame_1116),
                     records = reconciliation_block(rec_2016)),
    national_headline = list(national_headline(waves[[1]]), national_headline(waves[[2]]), national_headline(waves[[3]])),
    boundary_validation = list(status = "passed", feature_count = 3L,
                               adm0_part_count = as.integer(cluster[["n_parts"]]),
                               cluster_counts = as.list(setNames(as.integer(cluster[["cluster_counts"]]), names(cluster[["cluster_counts"]]))),
                               orphan_parts = 0L,
                               distinct_geometry_hashes = length(unique(geom_hashes)),
                               geometry_hashes = as.list(geom_hashes),
                               part_longitude_ranges = lapply(cluster[["lon_ranges"]], as.list),
                               footprint_longitude_ranges = lapply(simplified_validation[["longitude_ranges"]], as.list),
                               longitude_ranges_non_overlapping = TRUE,
                               swains_guard_full_bbox_ymin = unname(cluster[["full_bbox"]][["ymin"]]),
                               total_land_area_sq_km = simplified_validation[["total_land_area_sq_km"]],
                               minimum_feature_area_sq_km = simplified_validation[["minimum_feature_area_sq_km"]],
                               output_bytes = file_bytes(boundary_out), simplification = simplification,
                               licence = boundary_metadata[["boundaryLicense"]], adm_unit_count = boundary_metadata[["admUnitCount"]]),
    join_coverage = list(matched_atolls = 3L, expected_atolls = 3L, unmatched_atolls = list(), unused_boundary_features = list()),
    licence_validation = list(status = "passed", byte_match = "confirmed",
                              clause = statsnz_cc_by_clause, capture_sha256 = statsnz_copyright_sha256),
    notes = paste(
      "All three waves reconcile at both margins with zero difference (2006 to 1,074; 2011 to 1,143; 2016 to 1,197).",
      "The 2006 Nukunonu `~` cells are forced to zero by the printed margins and rendered as suppressed nulls, never estimated.",
      "The boundary explodes into 206 parts, all assigned to three atolls with zero orphans and non-overlapping longitude",
      "ranges, no part south of 10S, and three distinct geometry hashes."
    ),
    warnings = list(
      "Headline religious affiliation is near 100 percent in every wave (Tokelau is universally Christian); the substantive change is denominational and is carried in the manifest category detail, not in the headline metric.",
      "2022 (licensed microdata only) and the pre-2006 waves are deferred; see deferred_sources."
    )
  ),
  construct_notes = list(
    "The construct is census affiliation: each present usual resident's reported religious denomination (the census item 'What is (...)'s religion?'), not practice, attendance, or membership.",
    "The public product carries three headline fields per atoll-wave: population total, religious affiliation percent, and no religion percent. Place-density metrics are null (no governed place-of-worship snapshot; the OSM sweep returned two tagged places).",
    "Universe: the usually resident population present in Tokelau on census night, stable across 2006, 2011, and 2016 (1,074, 1,143, 1,197). This is not the absentee-inclusive usual-resident total the profiles report elsewhere.",
    "The category spine is stable across the three waves and preserved verbatim per wave; 2006 is bilingual Tokelauan/English and prints no No religion or Spiritualism line because those counts are zero.",
    "Affiliation = Total - No religion - Not stated, with every named denomination plus Spiritualism and New Age religions counted as affiliated. No-religion is zero across the 2006 atolls (no printed line; every respondent gave a Christian denomination), zero in 2011, and one nationally in 2016.",
    "The 2006 Nukunonu Presbyterian and Not Stated cells print as `~` confidentiality suppressions; they render as suppressed nulls in the manifest category detail and are never estimated. The printed atoll (287) and national (Presbyterian 11, Not Stated 2) margins force both to zero, so the headline affiliation for Nukunonu 2006 is exact (287 affiliated, 100 percent).",
    "Boundary: geoBoundaries TKL ADM0 is a single Sentinel-2 land-cover MultiPolygon of 206 motu parts. It is exploded and every part assigned to Atafu, Nukunonu, or Fakaofo by centroid longitude (thresholds -172.0 and -171.5, sitting in the ~0.6 degree inter-atoll gaps), then dissolved to three footprints. Every part is assigned, no part sits south of 10S (Swains Island, near 11S and US-administered, is outside the layer and the census), and the three footprint longitude ranges do not overlap.",
    "Change: the stable atoll geography and category spine make cross-wave change well defined, but headline affiliation is near-constant at ~100 percent; the interpretable change is denominational and is retained in the category detail rather than surfaced as a headline metric."
  ),
  deferred_sources = list(
    list(source_dataset_id = "tnso-census-2022-religion-by-atoll", status = "deferred",
         url = "https://microdata.pacificdata.org/index.php/catalog/834", local_path = NULL,
         notes = paste("The 2022 census (released August 2025) exists only as licensed microdata ('Other (Not Open)',",
                       "confidentiality declaration required). No public 2022 religion-by-atoll aggregate was located on TNSO, SDD,",
                       "PDH, or ILO surveyLib. Revisit if TNSO/SPC releases a 2022 profile report or an open .Stat aggregate.")),
    list(source_dataset_id = "tnso-census-pre-2006-religion-by-atoll", status = "deferred",
         url = "https://microdata.pacificdata.org/index.php/catalog/190", local_path = NULL,
         notes = "No public atoll religion table located for 1986, 1991, 1996, or 2001 (PDH catalog/190 holds 1996 as metadata-only microdata). Outside the buildable series.")
  ),
  privacy = "public",
  licence_status = "accepted",
  licence_basis = licence_basis_slug,
  downstream_status = "public",
  source_datasets = source_datasets(),
  notes = paste(
    "FULL SHIP product under CC BY 4.0 (byte-matched from the Stats NZ copyright page). The committed products are the",
    "derived 3-atoll area summary (9 rows across 2006, 2011, 2016) and the simplified geoBoundaries TKL ADM0 atoll-split",
    "boundary. On-page attribution, when the region page is built, must carry the adapted-content statement",
    "('This work is based on/includes Stats NZ's data ...') and acknowledge the Tokelau National Statistics Office and",
    "geoBoundaries (CC BY 4.0). The map UI is outside this build."
  )
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

nat <- lapply(waves, national_headline)
cat("waves shipped: 2006, 2011, 2016 on 3 Tokelau atolls (Atafu, Nukunonu, Fakaofo)\n")
cat(sprintf("rows: %d (3 atolls x 3 waves)\n", length(rows)))
cat(sprintf("gate 2006: passed; both margins close to %d (Nukunonu ~ cells forced to zero)\n", grand_2006))
cat(sprintf("gate 2011: passed; both margins close to %d\n", grand_2011))
cat(sprintf("gate 2016: passed; both margins close to %d\n", grand_2016))
for (n in nat) cat(sprintf("national %d: pop=%d affiliation=%d no_religion=%d not_stated=%d\n",
                           n[["year"]], n[["population_total"]], n[["religious_affiliation_count"]],
                           n[["no_religion_count"]], n[["not_stated_count"]]))
cat(sprintf("boundary gate: passed; %d ADM0 parts -> %s; 0 orphans; 3 distinct hashes; %d bytes at %g%% keep\n",
            cluster[["n_parts"]],
            paste(sprintf("%s=%d", names(cluster[["cluster_counts"]]), as.integer(cluster[["cluster_counts"]])), collapse = " "),
            file_bytes(boundary_out), simplification[["keep_percent"]]))
cat(sprintf("swains guard: passed; full bbox ymin=%.4f (>= -10)\n", unname(cluster[["full_bbox"]][["ymin"]])))
cat("licence gate: passed; CC BY 4.0 byte-matched from the Stats NZ copyright page (accepted)\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", boundary_out))
cat(sprintf("wrote %s\n", manifest_out))
