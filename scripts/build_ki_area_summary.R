# build the Kiribati island census-religion area-summary product for six waves
# (1990, 1995, 2000, 2005, 2010, 2015) on the 24-unit geoBoundaries KIR ADM2
# island frame. this is a STAGED product: no page, no hub link; licence needs
# review pending PI task 15 (the KINSO reports and historical Excel tables carry
# no stated reuse terms; the SPC/KINSO Census Atlas carries a partial-reproduction
# clause, recorded but not relied on for the island waves; the boundary is ODbL).
#
# inputs (all cached under data/raw/ki_census/, git-ignored, sha256 in the probe):
#   ki_census_tables_{1990,1995,2000,2005,2010}.xlsx -> sheet "Religion",
#     "Table 10. Religion by Island" (all-persons block, parsed at build time)
#   ki_2015_census_report_vol1.pdf -> Table 6 "Population by island, sex and
#     religion: 2015" (island population and No religion transcribed from the
#     printed table images; national category closure verified externally)
#   ki_2020_general_report.pdf -> Table G-3 national religion (context only, not
#     an island wave; transcribed for the manifest national frame)
#   geoBoundaries-KIR-ADM2.geojson + gb_kir_adm2_meta.json -> 24-island boundary
#
# every island wave is reconciled against its printed control totals here; the
# build stops on any margin mismatch that is not a documented, disclosed source
# discrepancy (the 1990 nine-person unaccounted residual), and never allocates,
# infers, rounds, imputes, or tunes a value.
#
# antimeridian: Kiribati straddles 180 (Gilberts near +177E, Line Islands near
# -157W). every geometry operation runs in a contiguous 0-360 frame; the layer is
# cut at lon 180 and the eastern pieces are shifted back to negative longitudes so
# the web-map output is a valid -180..180 layer with no meridian-crossing ring.
# geometry gates run in BOTH frames (FJ precedent).
#
# outputs: apps/regions/ki/data/ki_island_2017.geojson,
#   apps/regions/ki/data/area_summary_island.{json,csv}, and
#   docs/manifests/ki-census-religion-1990-2015.json.
# run from the repo root: Rscript scripts/build_ki_area_summary.R

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(readxl)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "KI"
script_id <- "scripts/build_ki_area_summary.R"
raw_dir <- "data/raw/ki_census"
product_dir <- "apps/regions/ki/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-11"
stamp <- paste0(retrieval_date, "T00:00:00Z")
git_commit <- trimws(system2("git", c("rev-parse", "HEAD"), stdout = TRUE))
if (length(git_commit) != 1L || !grepl("^[a-f0-9]{40}$", git_commit)) stop("could not resolve the base git commit", call. = FALSE)

boundary_level <- "island"
boundary_set_id <- "ki-island-2017-geoboundaries-adm2"
d_boundary <- "geoboundaries-kir-adm2-2017"

# per-wave census dataset ids.
d_wave <- c(
  `1990` = "kinso-census-1990-table10-religion-by-island",
  `1995` = "kinso-census-1995-table10-religion-by-island",
  `2000` = "kinso-census-2000-table10-religion-by-island",
  `2005` = "kinso-census-2005-table10-religion-by-island",
  `2010` = "kinso-census-2010-table10-religion-by-island",
  `2015` = "kinso-census-2015-report-table6-religion-by-island"
)
d_2020 <- "kinso-census-2020-report-tableg3-religion-national"

# ---- source urls and cached paths ----------------------------------------------
nso_home_url <- "https://nso.gov.ki"
url_1990 <- "https://nso.gov.ki/download/96/previous-to-2010/1135/census-tables-kiribati-1990.xlsx"
url_1995 <- "https://nso.gov.ki/download/96/previous-to-2010/1136/census-tables-kiribati-1995.xlsx"
url_2000 <- "https://nso.gov.ki/download/96/previous-to-2010/1138/census-tables-kiribati-2000.xlsx"
url_2005 <- "https://nso.gov.ki/download/96/previous-to-2010/1141/census-tables-kiribati-2005.xlsx"
url_2010 <- "https://nso.gov.ki/download/96/previous-to-2010/1142/census-tables-kiribati-2010.xlsx"
url_2015 <- "https://nso.gov.ki/download/25/population/1217/2015-population-census-report-volume-1final-211016.pdf"
url_2020 <- "https://nso.gov.ki/download/146/2020-census/1965/population-and-housing-census-report-2020"
url_atlas <- "https://nso.gov.ki/download/117/other-reports/2022/kiribati-census-atlas-2022.pdf"
boundary_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/KIR/ADM2/geoBoundaries-KIR-ADM2.geojson"
boundary_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/KIR/ADM2/"

path_xlsx <- c(
  `1990` = file.path(raw_dir, "ki_census_tables_1990.xlsx"),
  `1995` = file.path(raw_dir, "ki_census_tables_1995.xlsx"),
  `2000` = file.path(raw_dir, "ki_census_tables_2000.xlsx"),
  `2005` = file.path(raw_dir, "ki_census_tables_2005.xlsx"),
  `2010` = file.path(raw_dir, "ki_census_tables_2010.xlsx")
)
path_2015 <- file.path(raw_dir, "ki_2015_census_report_vol1.pdf")
path_2020 <- file.path(raw_dir, "ki_2020_general_report.pdf")
path_atlas <- file.path(raw_dir, "ki_census_atlas_2022.pdf")
boundary_path <- file.path(raw_dir, "geoBoundaries-KIR-ADM2.geojson")
boundary_meta_path <- file.path(raw_dir, "gb_kir_adm2_meta.json")

boundary_out <- file.path(product_dir, "ki_island_2017.geojson")
summary_json_out <- file.path(product_dir, "area_summary_island.json")
summary_csv_out <- file.path(product_dir, "area_summary_island.csv")
manifest_out <- file.path(manifest_dir, "ki-census-religion-1990-2015.json")

# ---- canonical island frame and name concordance -------------------------------
# 24 canonical census island names in a stable display order (Northern -> South
# Tarawa -> Central -> Southern -> Line/Phoenix). area_code is the geoBoundaries
# shapeID (the ADM2 layer carries no ISO subdivision code).
islands <- c(
  "Banaba", "Makin", "Butaritari", "Marakei", "Abaiang", "North Tarawa",
  "South Tarawa", "Betio", "Maiana", "Abemama", "Kuria", "Aranuka", "Nonouti",
  "North Tabiteuea", "South Tabiteuea", "Beru", "Nikunau", "Onotoa", "Tamana",
  "Arorae", "Teeraina", "Tabuaeran", "Kiritimati", "Kanton"
)
# census canonical name -> geoBoundaries shapeName (identity where absent).
census_to_boundary <- c(
  "North Tarawa" = "Tarawa Ieta",
  "South Tarawa" = "Tarawa Teinainano",
  "North Tabiteuea" = "Tabiteuea North",
  "South Tabiteuea" = "Tabiteuea South",
  "Teeraina" = "Teraina"
)

# ---- per-wave island roster (left-to-right column order in the source table) ----
# these are the census columns actually enumerated in each wave; islands absent
# from a wave's roster receive a null row with a disclosed quality flag.
rosters <- list(
  `1990` = c("Banaba","Makin","Butaritari","Marakei","Abaiang","North Tarawa","South Tarawa","Maiana","Abemama","Kuria","Aranuka","Nonouti","North Tabiteuea","South Tabiteuea","Beru","Nikunau","Onotoa","Tamana","Arorae","Teeraina","Tabuaeran","Kiritimati","Kanton"),
  `1995` = c("Banaba","Makin","Butaritari","Marakei","Abaiang","North Tarawa","South Tarawa","Maiana","Abemama","Kuria","Aranuka","Nonouti","North Tabiteuea","South Tabiteuea","Beru","Nikunau","Onotoa","Tamana","Arorae","Phoenix/Line"),
  `2000` = c("Banaba","Makin","Butaritari","Marakei","Abaiang","North Tarawa","South Tarawa","Maiana","Abemama","Kuria","Aranuka","Nonouti","North Tabiteuea","South Tabiteuea","Beru","Nikunau","Onotoa","Tamana","Arorae","Teeraina","Tabuaeran","Kiritimati","Kanton"),
  `2005` = c("Banaba","Makin","Butaritari","Marakei","Abaiang","North Tarawa","South Tarawa","Maiana","Abemama","Kuria","Aranuka","Nonouti","North Tabiteuea","South Tabiteuea","Beru","Nikunau","Onotoa","Tamana","Arorae","Teeraina","Tabuaeran","Kiritimati","Kanton"),
  `2010` = c("Banaba","Makin","Butaritari","Marakei","Abaiang","North Tarawa","South Tarawa","Maiana","Abemama","Kuria","Aranuka","Nonouti","North Tabiteuea","South Tabiteuea","Beru","Nikunau","Onotoa","Tamana","Arorae","Teeraina","Tabuaeran","Kiritimati","Kanton")
)

# category-label classification. everything not a no-religion or a non-response
# label is a named-religion affiliation category. labels are matched verbatim
# per wave; the frame widens over time but the split rule is stable.
no_religion_labels <- c("None", "No religion")
not_stated_labels <- c("Ns", "Not Stated")

# ---- helpers -------------------------------------------------------------------
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

# ---- parse one xlsx "Religion" sheet all-persons block --------------------------
# returns, per wave: the full categories x islands integer matrix, the printed
# island Totals (grand row), the printed category Totals (col2), and the derived
# per-island population / named-affiliation / no-religion / residual quantities.
parse_wave_xlsx <- function(year, path) {
  d <- as.data.frame(suppressMessages(read_excel(path, sheet = "Religion", col_names = FALSE, .name_repair = "minimal")))
  labs <- trimws(ifelse(is.na(d[[1]]), "", as.character(d[[1]])))
  total_row <- which(labs == "Total")[1]
  males_row <- which(labs == "Males")[1]
  if (is.na(total_row) || is.na(males_row)) stop(year, ": could not locate the all-persons block", call. = FALSE)
  cat_rows <- (total_row + 1L):(males_row - 1L)
  cat_rows <- cat_rows[labs[cat_rows] != ""]
  cats <- labs[cat_rows]
  grand <- suppressWarnings(as.numeric(as.character(unlist(d[total_row, ]))))
  numeric_cols <- which(!is.na(grand))
  national_col <- numeric_cols[1]
  isl_cols <- numeric_cols[-1]
  national <- as.integer(grand[national_col])
  roster <- rosters[[as.character(year)]]
  if (length(isl_cols) != length(roster)) {
    stop(sprintf("%s: %d island columns but %d-island roster", year, length(isl_cols), length(roster)), call. = FALSE)
  }
  M <- matrix(0L, nrow = length(cats), ncol = length(roster), dimnames = list(cats, roster))
  for (k in seq_along(cat_rows)) {
    M[k, ] <- suppressWarnings(as.integer(as.character(unlist(d[cat_rows[k], isl_cols]))))
  }
  cat_tot <- suppressWarnings(as.integer(as.character(unlist(d[cat_rows, national_col]))))
  names(cat_tot) <- cats
  isl_tot <- as.integer(grand[isl_cols]); names(isl_tot) <- roster

  # classify categories.
  is_no_rel <- cats %in% no_religion_labels
  is_ns <- cats %in% not_stated_labels
  named_cats <- cats[!is_no_rel & !is_ns]
  no_rel_present <- any(is_no_rel)

  # derived per-island quantities on the actually-enumerated columns.
  pop <- isl_tot
  named_aff <- colSums(M[named_cats, , drop = FALSE])
  no_rel <- if (no_rel_present) colSums(M[is_no_rel, , drop = FALSE]) else setNames(rep(NA_integer_, length(roster)), roster)
  no_rel_for_resid <- ifelse(is.na(no_rel), 0L, no_rel)
  # not-stated/unaccounted residual kept in the denominator (outside both
  # numerators): population minus named affiliation minus no-religion. it equals
  # the Ns/Not Stated column where the wave prints one, plus any island where the
  # cells fall short of the printed island Total (the 1990 discrepancy).
  residual <- pop - named_aff - no_rel_for_resid
  # unaccounted = printed island Total minus the sum of EVERY category cell. this
  # is 0 wherever the table closes (a printed Not Stated column is a cell, so it
  # does not register here) and positive only for the 1990 short-fall.
  unaccounted <- pop - colSums(M)

  list(year = year, cats = cats, matrix = M, cat_tot = cat_tot, isl_tot = isl_tot,
       national = national, named_cats = named_cats, no_rel_present = no_rel_present,
       pop = pop, named_aff = as.integer(named_aff), no_rel = no_rel, residual = as.integer(residual),
       unaccounted = as.integer(unaccounted), roster = roster)
}

# ---- reconciliation gate for a parsed xlsx wave --------------------------------
# gate A: every category row sums over islands to its printed col2 total.
# gate B: every island residual (printed island Total minus all category cells)
#         is non-negative; the total residual equals the disclosed wave amount.
# gate C: printed island Totals sum to the national Total; printed category
#         Totals sum to the national Total minus the same disclosed amount.
reconcile_xlsx <- function(p, disclosed_residual) {
  records <- list()
  for (c in p$cats) {
    s <- sum(p$matrix[c, ]); pr <- p$cat_tot[[c]]
    if (s != pr) stop(sprintf("%s category-row gate FAILED for %s: island sum %d != printed %d", p$year, c, s, pr), call. = FALSE)
    records[[length(records) + 1L]] <- data.frame(year = p$year, margin = "category_row", key = c,
      computed = s, printed = pr, difference = 0L, stringsAsFactors = FALSE)
  }
  if (any(p$residual < 0L)) stop(sprintf("%s island residual is negative for %s", p$year,
    paste(p$roster[p$residual < 0L], collapse = "; ")), call. = FALSE)
  if (any(p$unaccounted < 0L)) stop(sprintf("%s island unaccounted is negative for %s", p$year,
    paste(p$roster[p$unaccounted < 0L], collapse = "; ")), call. = FALSE)
  total_unaccounted <- sum(p$unaccounted)
  if (total_unaccounted != disclosed_residual) {
    stop(sprintf("%s island-column closure gate FAILED: total unaccounted %d != disclosed %d", p$year, total_unaccounted, disclosed_residual), call. = FALSE)
  }
  if (sum(p$isl_tot) != p$national) stop(sprintf("%s island-total gate FAILED: %d != national %d", p$year, sum(p$isl_tot), p$national), call. = FALSE)
  if (sum(p$cat_tot) != p$national - disclosed_residual) {
    stop(sprintf("%s category-total gate FAILED: %d != national %d minus disclosed %d", p$year, sum(p$cat_tot), p$national, disclosed_residual), call. = FALSE)
  }
  do.call(rbind, records)
}

# ---- 2015 island wave (transcribed from the printed Table 6 images) ------------
# population_total and No religion per island, verbatim from the report table
# (pdftotext -layout mangles the trailing-dash columns; values were read from the
# rendered table pages and each closes exactly: populations sum to 110,136 and No
# religion sums to 51). the 2015 frame carries no not-stated column, so per-island
# named affiliation is population minus No religion (residual 0). the 14 printed
# categories sum to 110,136 nationally (external check).
pop_2015 <- c(
  "Banaba" = 268L, "Makin" = 1990L, "Butaritari" = 3224L, "Marakei" = 2799L,
  "Abaiang" = 5568L, "North Tarawa" = 6629L, "South Tarawa" = 39058L, "Betio" = 17330L,
  "Maiana" = 1982L, "Abemama" = 3262L, "Kuria" = 1046L, "Aranuka" = 1125L,
  "Nonouti" = 2743L, "North Tabiteuea" = 3955L, "South Tabiteuea" = 1306L, "Beru" = 2051L,
  "Nikunau" = 1789L, "Onotoa" = 1393L, "Tamana" = 1104L, "Arorae" = 1011L,
  "Teeraina" = 1712L, "Tabuaeran" = 2315L, "Kiritimati" = 6456L, "Kanton" = 20L
)
no_rel_2015 <- c(
  "Banaba" = 0L, "Makin" = 0L, "Butaritari" = 0L, "Marakei" = 0L,
  "Abaiang" = 3L, "North Tarawa" = 0L, "South Tarawa" = 21L, "Betio" = 6L,
  "Maiana" = 0L, "Abemama" = 9L, "Kuria" = 0L, "Aranuka" = 0L,
  "Nonouti" = 0L, "North Tabiteuea" = 4L, "South Tabiteuea" = 0L, "Beru" = 0L,
  "Nikunau" = 0L, "Onotoa" = 2L, "Tamana" = 0L, "Arorae" = 0L,
  "Teeraina" = 0L, "Tabuaeran" = 6L, "Kiritimati" = 0L, "Kanton" = 0L
)
national_2015 <- 110136L
national_2015_no_rel <- 51L
cats_2015 <- c("Roman Catholic", "KPC", "Seventh Day Adventist", "Church Of God",
               "Latter Day Saints", "Assembly of God", "Bahai",
               "Jehova's Witness (Te Koaua)", "Islam", "Four Square", "Te Ran",
               "All Nation", "No religion", "Other")

# ---- 2020 national context (Table G-3; not an island wave) ----------------------
cats_2020 <- c("Catholic", "Kiribati Protestant Church (KPC)", "Kiribati Uniting Church (KUC)",
               "The Church of Jesus Christ of Latter Day (Mormon)", "Bahai", "Jehovah's Witness",
               "Seventh-day Adventist", "Assemblies of God", "All Nations",
               "United Pentecostal Church International", "Baptist Church", "Church of God",
               "Te Ran", "Muslim", "No religion", "Other religion", "Not Stated")
national_2020 <- c(
  "Catholic" = 70333L, "Kiribati Protestant Church (KPC)" = 10016L, "Kiribati Uniting Church (KUC)" = 25322L,
  "The Church of Jesus Christ of Latter Day (Mormon)" = 6720L, "Bahai" = 2454L, "Jehovah's Witness" = 449L,
  "Seventh-day Adventist" = 2542L, "Assemblies of God" = 509L, "All Nations" = 244L,
  "United Pentecostal Church International" = 206L, "Baptist Church" = 65L, "Church of God" = 68L,
  "Te Ran" = 89L, "Muslim" = 102L, "No religion" = 120L, "Other religion" = 137L, "Not Stated" = 62L
)
national_2020_total <- 119438L
kpc_kuc_2020_combined <- 35338L  # KPC 10,016 + KUC 25,322 (the Atlas KUC-KPC collapse)

# ---- boundary ------------------------------------------------------------------
require_file(boundary_path); require_file(boundary_meta_path)
boundary_metadata <- fromJSON(boundary_meta_path, simplifyVector = FALSE)
if (!identical(boundary_metadata[["boundaryLicense"]], "Open Data Commons Open Database License 1.0") ||
    !identical(boundary_metadata[["admUnitCount"]], "24") ||
    !identical(boundary_metadata[["boundaryType"]], "ADM2")) {
  stop("geoBoundaries KIR ADM2 licence, unit count, or type metadata changed", call. = FALSE)
}

# join the 24 census islands one-to-one to the geoBoundaries ADM2 features. land
# area is computed with spherical (s2) geometry on the raw WGS84 coordinates: each
# atoll is compact and wholly on one side of 180, so s2 area is exact and immune to
# the antimeridian smear that a planar projection over the 3,900 km span would incur.
build_boundary <- function(path) {
  b <- st_make_valid(st_read(path, quiet = TRUE, stringsAsFactors = FALSE))
  if (nrow(b) != 24L) stop("geoBoundaries KIR ADM2 feature count changed", call. = FALSE)
  target <- ifelse(islands %in% names(census_to_boundary), unname(census_to_boundary[islands]), islands)
  idx <- match(target, b[["shapeName"]])
  if (anyNA(idx) || anyDuplicated(idx) || !setequal(idx, seq_len(24L))) {
    stop("census islands and geoBoundaries features do not join one-to-one", call. = FALSE)
  }
  b <- b[idx, ]
  old_s2 <- sf_use_s2(); on.exit(suppressMessages(sf_use_s2(old_s2)), add = TRUE)
  suppressMessages(sf_use_s2(TRUE))
  land_area <- as.numeric(st_area(b)) / 1e6
  b[["area_name"]] <- islands
  b[["source_area_name"]] <- islands
  b[["boundary_source_name"]] <- b[["shapeName"]]
  b[["area_code"]] <- b[["shapeID"]]
  b[["area_unit_id"]] <- paste(boundary_set_id, b[["shapeID"]], sep = ":")
  b[["boundary_set_id"]] <- boundary_set_id
  b[["boundary_level"]] <- boundary_level
  b[["boundary_vintage"]] <- "2017"
  b[["boundary_source"]] <- "geoBoundaries KIR ADM2; source OpenStreetMap, Wambacher"
  b[["boundary_licence"]] <- "ODbL 1.0"
  b[["land_area_sq_km"]] <- land_area
  b[c("area_code", "area_name", "source_area_name", "boundary_source_name", "area_unit_id",
      "boundary_set_id", "boundary_level", "boundary_vintage", "boundary_source",
      "boundary_licence", "land_area_sq_km", "geometry")]
}

feature_rings <- function(geom) {
  if (inherits(geom, "POLYGON")) return(unclass(geom))
  if (inherits(geom, "MULTIPOLYGON")) return(do.call(c, lapply(unclass(geom), unclass)))
  stop("feature geometry is not polygonal", call. = FALSE)
}

# cut a contiguous 0..360-frame layer at lon 180 and return a -180..180 layer.
# no Kiribati feature straddles 180 (each atoll is compact), so every feature falls
# wholly in the western [0,180] or eastern [180,360] half; the eastern pieces are
# translated back by 360 degrees. the explicit intersection (never a bare wrap)
# is retained as the FJ-precedent dateline node.
cut_at_dateline <- function(shifted_layer) {
  old_s2 <- sf_use_s2(); on.exit(suppressMessages(sf_use_s2(old_s2)), add = TRUE)
  suppressMessages(sf_use_s2(FALSE))
  west_rect <- st_as_sfc(st_bbox(c(xmin = 0, ymin = -90, xmax = 180, ymax = 90), crs = st_crs(4326)))
  east_rect <- st_as_sfc(st_bbox(c(xmin = 180, ymin = -90, xmax = 360, ymax = 90), crs = st_crs(4326)))
  geoms <- lapply(seq_len(nrow(shifted_layer)), function(i) {
    geom <- st_geometry(shifted_layer)[i]
    pieces <- list()
    west <- suppressMessages(suppressWarnings(st_intersection(geom, west_rect)))
    if (length(west) > 0L && !all(st_is_empty(west))) pieces <- c(pieces, list(suppressWarnings(st_collection_extract(west, "POLYGON"))))
    east <- suppressMessages(suppressWarnings(st_intersection(geom, east_rect)))
    if (length(east) > 0L && !all(st_is_empty(east))) {
      east_polys <- suppressWarnings(st_collection_extract(east, "POLYGON"))
      pieces <- c(pieces, list(st_set_crs(east_polys - c(360, 0), 4326)))
    }
    if (length(pieces) == 0L) stop("dateline cut emptied a feature", call. = FALSE)
    combined <- st_make_valid(suppressMessages(suppressWarnings(st_union(do.call(c, pieces)))))
    st_cast(combined, "MULTIPOLYGON")[[1L]]
  })
  out <- shifted_layer
  st_geometry(out) <- st_sfc(geoms, crs = 4326)
  out
}

# contiguous 0..360 representation of a -180..180 layer, for the both-frame gate.
contiguous_frame <- function(layer) {
  old_s2 <- sf_use_s2(); on.exit(suppressMessages(sf_use_s2(old_s2)), add = TRUE)
  suppressMessages(sf_use_s2(FALSE))
  shifted <- st_shift_longitude(layer)
  geoms <- lapply(seq_len(nrow(shifted)), function(i) {
    merged <- suppressMessages(suppressWarnings(st_union(st_geometry(shifted)[i])))
    st_cast(st_make_valid(merged), "MULTIPOLYGON")[[1L]]
  })
  st_geometry(shifted) <- st_sfc(geoms, crs = st_crs(layer))
  shifted
}

# validity, distinctness (24 hashes), and archipelago geometry in one frame.
validate_frame <- function(layer, stage) {
  v <- st_is_valid(layer)
  if (nrow(layer) != 24L || any(st_is_empty(layer)) || any(is.na(v)) || any(!v)) {
    stop(stage, " boundary does not contain 24 valid non-empty features", call. = FALSE)
  }
  hashes <- geometry_hashes(layer)
  if (length(unique(hashes)) != 24L) stop(stage, " boundary geometry hashes are not distinct", call. = FALSE)
  list(status = "passed", feature_count = 24L, distinct_geometry_hashes = length(unique(hashes)),
       hashes = setNames(as.list(hashes), layer[["area_code"]]))
}

# WGS84-frame gates: validity in EPSG:4326, every coordinate inside [-180,180], no
# ring crossing the antimeridian (consecutive-vertex jump >= 180), and no single
# feature bbox spanning more than 5 degrees of longitude (the smear test: a
# 350-degree feature bbox is the failure signature).
validate_wgs84_frame <- function(layer) {
  v <- st_is_valid(layer)
  if (any(st_is_empty(layer)) || any(is.na(v)) || any(!v)) stop("boundary is not valid in EPSG:4326", call. = FALSE)
  max_bbox_span <- 0; max_jump <- 0
  for (i in seq_len(nrow(layer))) {
    lons <- numeric(0)
    for (ring in feature_rings(st_geometry(layer)[[i]])) {
      rl <- ring[, 1L]
      if (any(rl < -180 - 1e-8) || any(rl > 180 + 1e-8)) {
        stop("feature ", layer[["area_name"]][[i]], " has a coordinate outside [-180, 180]", call. = FALSE)
      }
      jump <- max(abs(diff(rl)))
      if (jump >= 180) stop("feature ", layer[["area_name"]][[i]], " has a ring crossing the antimeridian (jump ", round(jump, 2), ")", call. = FALSE)
      max_jump <- max(max_jump, jump)
      lons <- c(lons, rl)
    }
    span <- max(lons) - min(lons)
    if (span > 5) stop("feature ", layer[["area_name"]][[i]], " bbox spans ", round(span, 2), " degrees of longitude (smear test)", call. = FALSE)
    max_bbox_span <- max(max_bbox_span, span)
  }
  list(status = "passed", crs = "EPSG:4326", coordinate_range_check = "all coordinates within [-180, 180]",
       max_ring_consecutive_lon_jump_deg = round(max_jump, 4),
       max_feature_bbox_lon_span_deg = round(max_bbox_span, 4),
       smear_test_threshold_deg = 5)
}

# simplify in the contiguous 0..360 frame, cut at 180, shift the eastern pieces
# back, and re-run every geometry gate in both output frames. dateline-aware
# national extents are recorded, never the raw -180..180 bbox.
write_boundary <- function(boundary) {
  source_validation <- validate_frame(boundary, "source")
  raw_bbox <- st_bbox(boundary)
  shifted_src <- st_shift_longitude(boundary)
  shifted_bbox <- st_bbox(shifted_src)
  # 0-360 national-extent gate: compact ~169.5-202.9 span (never the 348-degree smear).
  if (shifted_bbox[["xmin"]] < 169 || shifted_bbox[["xmin"]] > 170 ||
      shifted_bbox[["xmax"]] < 202 || shifted_bbox[["xmax"]] > 203.5 ||
      (shifted_bbox[["xmax"]] - shifted_bbox[["xmin"]]) > 40) {
    stop("0-360 national extent is not the expected compact ~169.5-202.9 span", call. = FALSE)
  }
  simplify_tmp <- tempfile(fileext = ".geojson")
  on.exit(unlink(simplify_tmp), add = TRUE)
  simplification <- mapshaper_simplify_to_cap(
    shifted_src, simplify_tmp, max_bytes = 1500000L,
    keep_percentages = c(100, 75, 50, 30, 20, 10, 5),
    clean_option = "allow-overlaps"
  )
  simplified_shifted <- st_read(simplify_tmp, quiet = TRUE, stringsAsFactors = FALSE)
  wrapped <- cut_at_dateline(simplified_shifted)
  st_write(wrapped, boundary_out, driver = "GeoJSON", delete_dsn = TRUE, quiet = TRUE,
           layer_options = c("COORDINATE_PRECISION=5"))
  final_bytes <- file_bytes(boundary_out)
  if (final_bytes > 1500000L) stop("wrapped simplified boundary exceeds 1.5 MB", call. = FALSE)
  simplification[["bytes"]] <- final_bytes
  written <- st_read(boundary_out, quiet = TRUE, stringsAsFactors = FALSE)
  written <- written[match(boundary[["area_code"]], written[["area_code"]]), ]
  if (anyNA(written[["area_code"]])) stop("simplified boundary lost an area code", call. = FALSE)
  wgs84_validation <- validate_wgs84_frame(written)
  simplified_validation <- validate_frame(written, "simplified")
  shifted_validation <- validate_frame(contiguous_frame(written), "simplified-shifted")
  list(
    layer = written, simplification = simplification,
    source_validation = source_validation, simplified_validation = simplified_validation,
    shifted_validation = shifted_validation, wgs84_validation = wgs84_validation,
    dateline_aware_extent = list(
      frame_0_360 = list(xmin = round(unname(shifted_bbox[["xmin"]]), 4), xmax = round(unname(shifted_bbox[["xmax"]]), 4),
                         span = round(unname(shifted_bbox[["xmax"]] - shifted_bbox[["xmin"]]), 4)),
      ymin = round(unname(shifted_bbox[["ymin"]]), 4), ymax = round(unname(shifted_bbox[["ymax"]]), 4),
      raw_wgs84_bbox_note = sprintf("raw -180..180 bbox spans %.1f degrees (the antimeridian smear); not used", raw_bbox[["xmax"]] - raw_bbox[["xmin"]])
    )
  )
}

# ---- run parse + reconcile -----------------------------------------------------
for (p in c(path_xlsx, path_2015, path_2020, boundary_path, boundary_meta_path)) require_file(p)

# 1990 carries a documented nine-person unaccounted residual (the printed island
# Totals exceed the sum of the religion cells by 3 in South Tarawa, 4 in Abemama,
# 1 in North Tabiteuea, and 1 in South Tabiteuea); all other xlsx waves close to 0.
disclosed_residual <- c(`1990` = 9L, `1995` = 0L, `2000` = 0L, `2005` = 0L, `2010` = 0L)

parsed <- lapply(names(path_xlsx), function(y) parse_wave_xlsx(as.integer(y), path_xlsx[[y]]))
names(parsed) <- names(path_xlsx)
recon <- lapply(names(parsed), function(y) reconcile_xlsx(parsed[[y]], disclosed_residual[[y]]))
names(recon) <- names(parsed)

# 2015 transcription gate: populations and No religion each close exactly.
if (sum(pop_2015) != national_2015) stop(sprintf("2015 population gate FAILED: %d != %d", sum(pop_2015), national_2015), call. = FALSE)
if (sum(no_rel_2015) != national_2015_no_rel) stop(sprintf("2015 No religion gate FAILED: %d != %d", sum(no_rel_2015), national_2015_no_rel), call. = FALSE)
if (!setequal(names(pop_2015), islands) || !setequal(names(no_rel_2015), islands)) stop("2015 island set mismatch", call. = FALSE)

# 2020 national context gate.
if (sum(national_2020) != national_2020_total) stop(sprintf("2020 national gate FAILED: %d != %d", sum(national_2020), national_2020_total), call. = FALSE)
if (national_2020[["Kiribati Protestant Church (KPC)"]] + national_2020[["Kiribati Uniting Church (KUC)"]] != kpc_kuc_2020_combined) {
  stop("2020 KPC+KUC combine does not equal 35,338", call. = FALSE)
}

message("gate 1990: PASSED (island totals close to 72,334; nine-person unaccounted residual disclosed across 4 islands)")
for (y in c("1995","2000","2005","2010")) message(sprintf("gate %s: PASSED (both margins close to %d)", y, parsed[[y]]$national))
message("gate 2015: PASSED (24 island populations sum to 110,136; No religion sums to 51)")
message("gate 2020: PASSED (national context; 17 categories sum to 119,438; KPC+KUC = 35,338)")

boundary <- build_boundary(boundary_path)
boundary_result <- write_boundary(boundary)
written_boundary <- boundary_result[["layer"]]
message(sprintf("boundary: PASSED (24 valid distinct features, %d bytes at %g%% keep)",
                file_bytes(boundary_out), boundary_result[["simplification"]][["keep_percent"]]))

land_area <- setNames(round(written_boundary[["land_area_sq_km"]], 4), written_boundary[["area_name"]])
area_unit <- setNames(written_boundary[["area_unit_id"]], written_boundary[["area_name"]])
area_code <- setNames(written_boundary[["area_code"]], written_boundary[["area_name"]])

# ---- assemble product rows (24 islands x 6 waves = 144 rows) --------------------
flag_common <- "census_affiliation;all_persons_all_ages_universe;single_select_reported_religion;broad_affiliation_comparable_1990_2015;denomination_detail_widens_over_time;licence_needs_review_pending_pi_task_15;boundary_odbl_1_0"

# per-wave availability of each island as a separately enumerated feature, and the
# per-wave derived quantities. absent features (Betio through 2010, and the Line
# Islands plus Kanton in 1995) receive null metric rows with a disclosed flag.
wave_data <- list()
for (y in names(parsed)) {
  p <- parsed[[y]]
  present <- intersect(islands, p$roster)   # canonical islands enumerated this wave
  wave_data[[y]] <- list(present = present, pop = p$pop, aff = setNames(p$named_aff, p$roster),
                         no_rel = p$no_rel, resid = setNames(p$residual, p$roster),
                         no_rel_present = p$no_rel_present)
}
wave_data[["2015"]] <- list(
  present = islands,
  pop = pop_2015,
  aff = setNames(as.integer(pop_2015 - no_rel_2015), names(pop_2015)),
  no_rel = no_rel_2015,
  resid = setNames(rep(0L, length(islands)), islands),
  no_rel_present = TRUE
)

wave_years <- c(1990L, 1995L, 2000L, 2005L, 2010L, 2015L)

# per-wave quality-flag phrases for frame differences.
wave_flag <- function(year) {
  base <- switch(as.character(year),
    "1990" = "frame_1990_eight_category;no_not_stated_category;nine_person_unaccounted_residual_disclosed_south_tarawa_abemama_tabiteuea",
    "1995" = "frame_1995_six_category;no_no_religion_category_affiliation_equals_population;phoenix_and_line_islands_enumerated_in_one_combined_column",
    "2000" = "frame_2000_nine_category;not_stated_residual_in_denominator",
    "2005" = "frame_2005_nine_category;not_stated_residual_in_denominator",
    "2010" = "frame_2010_twelve_category;not_stated_residual_in_denominator",
    "2015" = "frame_2015_fourteen_category;no_not_stated_category;betio_enumerated_separately")
  paste(base, flag_common, sep = ";")
}

pop_basis <- function(year) {
  src <- switch(as.character(year),
    "1990" = "1990 Kiribati Census Table 10 Religion by Island (all persons); the printed island Total is the population denominator.",
    "1995" = "1995 Kiribati Census Table 10 Religion by Island (all persons); the printed island Total is the population denominator.",
    "2000" = "2000 Kiribati Census Table 10 Religion by Island (all persons); the printed island Total is the population denominator.",
    "2005" = "2005 Kiribati Census Table 10 Religion by Island (all persons); the printed island Total is the population denominator.",
    "2010" = "2010 Kiribati Census Table 10 Religion by Island (all persons); the printed island Total is the population denominator.",
    "2015" = "2015 Kiribati Population Census Report Vol 1 Table 6 Population by island, sex and religion (all persons); the printed island Total is the population denominator.")
  paste(src, "Religious affiliation is the sum of the named-religion categories; a not-stated/unaccounted residual, where present, stays in the denominator and outside both headline numerators.")
}

make_row <- function(area_name, year, present, pop, aff, no_rel, resid, no_rel_present, extra_flag) {
  au <- unname(area_unit[[area_name]]); ac <- unname(area_code[[area_name]]); la <- unname(land_area[[area_name]])
  ds <- list(unname(d_wave[[as.character(year)]]), d_boundary)
  if (!(area_name %in% present)) {
    # unit not separately enumerated this wave: null metrics, disclosed absence.
    return(list(
      country_code = country_code, boundary_set_id = boundary_set_id, boundary_level = boundary_level,
      area_unit_id = au, area_code = ac, area_name = area_name, year = as.integer(year),
      population_total = NULL,
      population_total_basis = paste0("The ", year, " census did not enumerate ", area_name,
        " as a separate island unit (", extra_flag, "); no population is placed on this feature."),
      religious_affiliation_count = NULL, religious_affiliation_percent = NULL,
      no_religion_count = NULL, no_religion_percent = NULL,
      place_count = NULL, places_per_10000_residents = NULL, place_density_per_sq_km = NULL,
      land_area_sq_km = la, site_snapshot_date = NULL, place_count_basis = NULL,
      source_dataset_ids = ds,
      quality_flag = paste0("unit_absent_this_wave;", extra_flag, ";", wave_flag(year))
    ))
  }
  pv <- pop[[area_name]]
  av <- aff[[area_name]]
  nr <- if (no_rel_present) no_rel[[area_name]] else NA_integer_
  aff_pct <- round(100 * av / pv, 4)
  no_pct <- if (is.na(nr)) NULL else round(100 * nr / pv, 4)
  flag <- wave_flag(year)
  if (nchar(extra_flag) > 0L) flag <- paste0(extra_flag, ";", flag)
  list(
    country_code = country_code, boundary_set_id = boundary_set_id, boundary_level = boundary_level,
    area_unit_id = au, area_code = ac, area_name = area_name, year = as.integer(year),
    population_total = as.integer(pv), population_total_basis = pop_basis(year),
    religious_affiliation_count = as.integer(av), religious_affiliation_percent = aff_pct,
    no_religion_count = if (is.na(nr)) NULL else as.integer(nr), no_religion_percent = no_pct,
    place_count = NULL, places_per_10000_residents = NULL, place_density_per_sq_km = NULL,
    land_area_sq_km = la, site_snapshot_date = NULL, place_count_basis = NULL,
    source_dataset_ids = ds, quality_flag = flag
  )
}

rows <- list()
for (year in wave_years) {
  wd <- wave_data[[as.character(year)]]
  for (isl in islands) {
    extra <- ""
    if (!(isl %in% wd$present)) {
      # explain why the unit is absent this wave.
      if (isl == "Betio") extra <- "betio_enumerated_within_south_tarawa_through_2010"
      else if (isl %in% c("Teeraina", "Tabuaeran", "Kiritimati", "Kanton") && year == 1995L) extra <- "enumerated_within_combined_phoenix_line_column_1995"
      else extra <- "not_enumerated_this_wave"
    } else if (isl == "South Tarawa" && year <= 2010L) {
      extra <- "count_includes_betio_enumerated_within_south_tarawa_through_2010"
    }
    rows[[length(rows) + 1L]] <- make_row(isl, year, wd$present, wd$pop, wd$aff, wd$no_rel, wd$resid, wd$no_rel_present, extra)
  }
}

# ---- area-summary document -----------------------------------------------------
licence_pending <- paste(
  "The KINSO census reports (2015 Vol 1, 2020 General Report) and the historical",
  "Excel tables (1990-2010) carry no stated reuse licence and no rights page. The",
  "SPC/KINSO Census Atlas 2022 carries an explicit partial-reproduction-with-",
  "acknowledgement clause (recorded, but the Atlas island pies are not used for the",
  "1990-2015 island waves). The derived island summaries carry attribution to the",
  "Kiribati National Statistics Office (and SPC) and ship STAGED pending a PI",
  "licence ruling (summaries-not-raw-data stance). The restricted Pacific Data Hub",
  "microdata are unused and do not bind."
)

source_datasets <- function() {
  wave_ds <- lapply(names(path_xlsx), function(y) {
    list(source_dataset_id = unname(d_wave[[y]]),
         name = sprintf("Kiribati %s Census, Table 10: Religion by Island (all persons)", y),
         provider = "Kiribati National Statistics Office (KINSO)",
         url = get(paste0("url_", y)), retrieval_date = retrieval_date, local_path = unname(path_xlsx[[y]]),
         licence = list(name = licence_pending, url = nso_home_url,
                        attribution = sprintf("Kiribati National Statistics Office, %s Census of Population and Housing", y)),
         citation = sprintf("Kiribati National Statistics Office, %s Census, Table 10 Religion by Island.", y),
         access_limits = NULL,
         redistribution_limits = "Derived island summaries only; no reuse licence is stated. Ships STAGED pending a PI ruling.",
         notes = sprintf("All persons, all ages; %d-island roster. Reconciled at build time against the printed island and category margins.", length(rosters[[y]])))
  })
  c(wave_ds, list(
    list(source_dataset_id = unname(d_wave[["2015"]]),
         name = "Kiribati 2015 Population Census Report Volume 1, Table 6: Population by island, sex and religion (all persons)",
         provider = "Kiribati National Statistics Office (KINSO)",
         url = url_2015, retrieval_date = retrieval_date, local_path = path_2015,
         licence = list(name = licence_pending, url = nso_home_url, attribution = "Kiribati National Statistics Office, 2015 Population Census"),
         citation = "Kiribati National Statistics Office, 2015 Population Census Report Volume 1, Table 6.",
         access_limits = NULL,
         redistribution_limits = "Derived island summaries only; no reuse licence is stated. Ships STAGED pending a PI ruling.",
         notes = "All persons; 24-island roster with Betio enumerated separately from South Tarawa. Population and No religion transcribed from the printed table images; the 14 printed categories sum to 110,136 nationally and No religion sums to 51."),
    list(source_dataset_id = d_2020,
         name = "Kiribati 2020 Population and Housing Census General Report, Table G-3: Total population by sex and religion (national)",
         provider = "Kiribati National Statistics Office (KINSO)",
         url = url_2020, retrieval_date = retrieval_date, local_path = path_2020,
         licence = list(name = licence_pending, url = nso_home_url, attribution = "Kiribati National Statistics Office, 2020 Population and Housing Census"),
         citation = "Kiribati National Statistics Office, 2020 Population and Housing Census General Report, Table G-3.",
         access_limits = NULL,
         redistribution_limits = "National context only; not published as an island wave. Ships STAGED pending a PI ruling.",
         notes = "National religion only (island religion in 2020 is published as Census Atlas pie charts and held in licensed microdata). Seventeen categories sum to 119,438; KPC (10,016) and KUC (25,322) combine to 35,338, the Atlas KUC-KPC collapse. Carried as recorded national context, never as an island wave."),
    list(source_dataset_id = d_boundary,
         name = "geoBoundaries KIR ADM2 (24 islands)",
         provider = "geoBoundaries (William & Mary geoLab); source OpenStreetMap, Wambacher",
         url = boundary_url, retrieval_date = retrieval_date, local_path = boundary_path,
         licence = list(name = "Open Data Commons Open Database License 1.0 (ODbL)", url = boundary_meta_url,
                        attribution = "geoBoundaries (gbOpen); OpenStreetMap contributors, Wambacher"),
         citation = "geoBoundaries KIR ADM2 (gbOpen, pinned 9469f09), 24 island boundaries.",
         access_limits = NULL,
         redistribution_limits = "The simplified derived boundary is committed with geoBoundaries and OpenStreetMap/ODbL attribution.",
         notes = "24 ADM2 island units, boundaryYearRepresented 2017. Joined one-to-one to the census islands via a five-name concordance (North/South Tarawa, North/South Tabiteuea, Teeraina). Kiribati straddles the antimeridian; the geometry pipeline runs in a 0-360 frame and gates in both frames.")
  ))
}

indicators <- function() {
  denom_note <- paste(
    "Percentages use each island's printed census population Total. A not-stated or",
    "unaccounted residual (the 2000/2005/2010 Not Stated column, and the 1990",
    "nine-person unaccounted residual) stays in the denominator and outside both",
    "headline numerators, so the two shares need not sum to 100%."
  )
  list(
    list(indicator_id = "population_total", label = "Census population total",
         description = "Island all-persons population represented in the wave's religion table.",
         unit = "count", denominator_indicator_id = NULL,
         method = "Printed island Total in Table 10 (1990-2010) or Table 6 (2015).",
         temporal_coverage = "1990; 1995; 2000; 2005; 2010; 2015", spatial_coverage = "Kiribati islands (24)",
         quality_notes = "Every wave counts all persons of all ages; there is no universe break, so island denominators are comparable across 1990-2015."),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
         description = "Share of the island population reporting affiliation with a named religion.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (sum of named-religion categories) / island population. In 1995 there is no No religion category, so affiliation equals the population (100%).",
         temporal_coverage = "1990; 1995; 2000; 2005; 2010; 2015", spatial_coverage = "Kiribati islands (24)",
         quality_notes = paste("Broad affiliation is comparable across all six waves; the widening denominational detail (8 categories in 1990 to 14 in 2015) does not change the has-a-religion total.", denom_note)),
    list(indicator_id = "no_religion_percent", label = "No religious affiliation %",
         description = "Share in the census No religion / None category.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (None / No religion category) / island population. Null in 1995 (no such category in that frame).",
         temporal_coverage = "1990; 2000; 2005; 2010; 2015", spatial_coverage = "Kiribati islands (24)",
         quality_notes = paste("The no-religion population in Kiribati is very small (national 51 in 2015). The 1995 frame offered no No religion category, so the 1995 no-religion share is null (not enumerated).", denom_note))
  )
}

visual_layers <- function() {
  list(
    list(visual_layer_id = "ki-island-religious-affiliation", label = "Religious affiliation %",
         description = "Kiribati census-affiliation share by island.", layer_type = "choropleth",
         indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "island all-persons population, including a not-stated/unaccounted residual where present"),
         colour_scale = "sequential", time_control = "year_selector", aggregation_rule = "reported island value",
         uncertainty_display = "quality_flag", default_visibility = TRUE,
         notes = "Census affiliation, not practice, attendance, or membership. Comparable across all six waves at the broad-affiliation level."),
    list(visual_layer_id = "ki-island-no-religion", label = "No religious affiliation %",
         description = "Kiribati census no-religion share by island.", layer_type = "choropleth",
         indicator_ids = list("no_religion_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "island all-persons population"),
         colour_scale = "sequential", time_control = "year_selector", aggregation_rule = "reported island value",
         uncertainty_display = "quality_flag", default_visibility = FALSE,
         notes = "The source category is None / No religion. Null in 1995 (category absent from that frame).")
  )
}

summary_product <- list(
  schema_version = "area-summary.v1", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code,
                      level = boundary_level, vintage = "2017", source_dataset_id = d_boundary),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "No governed place-of-worship snapshot ships in the Kiribati census product.",
                       notes = "Place counts and density metrics remain null."),
  source_datasets = source_datasets(), indicators = indicators(),
  visual_layers = visual_layers(), rows = rows
)

write_json(summary_product, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(summary_json_out, warn = FALSE), collapse = "\n"))) stop("area-summary JSON is invalid", call. = FALSE)

flatten_rows <- function(rows) {
  do.call(rbind, lapply(rows, function(r) {
    g <- function(k, na) if (is.null(r[[k]])) na else r[[k]]
    data.frame(
      country_code = r[["country_code"]], boundary_set_id = r[["boundary_set_id"]],
      boundary_level = r[["boundary_level"]], area_unit_id = r[["area_unit_id"]],
      area_code = r[["area_code"]], area_name = r[["area_name"]], year = r[["year"]],
      population_total = g("population_total", NA_integer_), population_total_basis = r[["population_total_basis"]],
      religious_affiliation_count = g("religious_affiliation_count", NA_integer_),
      religious_affiliation_percent = g("religious_affiliation_percent", NA_real_),
      no_religion_count = g("no_religion_count", NA_integer_),
      no_religion_percent = g("no_religion_percent", NA_real_),
      place_count = NA_integer_, places_per_10000_residents = NA_real_,
      place_density_per_sq_km = NA_real_, land_area_sq_km = r[["land_area_sq_km"]],
      site_snapshot_date = NA_character_, place_count_basis = NA_character_,
      source_dataset_ids = paste(unlist(r[["source_dataset_ids"]]), collapse = "|"),
      quality_flag = r[["quality_flag"]], stringsAsFactors = FALSE
    )
  }))
}
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

# ---- manifest (data-manifest.v2) -----------------------------------------------
raw_source_record <- function(path, url, format, used, periods, dataset_id, notes) {
  list(uri = path, url = url, format = format, bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = NULL, source_dataset_id = dataset_id, used_in_public_product = used,
       periods = periods, notes = notes,
       local_cache_hint = paste0(path, " (git-ignored by .gitignore data/ rule)"),
       raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/ki_census/"))
}
durable_file_record <- function(path, content, licence_status_value, licence_basis_value) {
  list(uri = paste0("repo:", path), storage_provider = "git_repository", format = sub("^.*\\.", "", path),
       bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = if (grepl("area_summary|\\.csv$", path)) row_count_file(path) else NULL,
       feature_count = if (grepl("\\.geojson$", path)) row_count_file(path) else NULL,
       content = content, privacy = "public",
       licence_status = licence_status_value, licence_basis = licence_basis_value)
}
licence_basis_slug <- "kinso_reports_and_historical_tables_no_stated_terms_atlas_spc_clause_pending_pi_task_15"

raw_sources <- list(
  raw_source_record(path_xlsx[["1990"]], url_1990, "xlsx", TRUE, "1990", d_wave[["1990"]],
    "1990 Table 10 Religion by Island; 23-island roster (Betio within South Tarawa). Category rows close to the printed totals; a documented nine-person unaccounted residual (South Tarawa 3, Abemama 4, North Tabiteuea 1, South Tabiteuea 1) stays in the denominator."),
  raw_source_record(path_xlsx[["1995"]], url_1995, "xlsx", TRUE, "1995", d_wave[["1995"]],
    "1995 Table 10 Religion by Island; six-category frame with no No religion column; the Line Islands and Phoenix are enumerated in one combined Phoenix/Line column (5,866). Both margins close to 76,844."),
  raw_source_record(path_xlsx[["2000"]], url_2000, "xlsx", TRUE, "2000", d_wave[["2000"]],
    "2000 Table 10 Religion by Island; 23-island roster. Both margins close to 84,491."),
  raw_source_record(path_xlsx[["2005"]], url_2005, "xlsx", TRUE, "2005", d_wave[["2005"]],
    "2005 Table 10 Religion by Island; 23-island roster. Both margins close to 92,533."),
  raw_source_record(path_xlsx[["2010"]], url_2010, "xlsx", TRUE, "2010", d_wave[["2010"]],
    "2010 Table 10 Religion by Island; 23-island roster. Both margins close to 103,058."),
  raw_source_record(path_2015, url_2015, "pdf", TRUE, "2015", d_wave[["2015"]],
    "2015 Report Vol 1 Table 6; 24-island roster with Betio separate. Populations sum to 110,136 and No religion sums to 51; the 14 printed categories sum to 110,136 nationally."),
  raw_source_record(path_2020, url_2020, "pdf", FALSE, "2020", d_2020,
    "2020 General Report Table G-3 national religion (context only). Seventeen categories sum to 119,438; KPC 10,016 + KUC 25,322 = 35,338. Island religion is not published for 2020 (Atlas pies / licensed microdata)."),
  raw_source_record(path_atlas, url_atlas, "pdf", FALSE, "2022", d_2020,
    "SPC/KINSO Census Atlas 2022; carries the explicit partial-reproduction-with-acknowledgement clause. Not used for the island waves; recorded for the licence position and the 2020 island-religion route."),
  raw_source_record(boundary_path, boundary_url, "geojson", TRUE, "2017", d_boundary,
    "geoBoundaries KIR ADM2 GeoJSON; 24 islands, ODbL 1.0. Pinned commit 9469f09."),
  raw_source_record(boundary_meta_path, boundary_meta_url, "json", FALSE, "2017", d_boundary,
    "geoBoundaries KIR ADM2 metadata; records ODbL 1.0, admUnitCount 24, boundaryType ADM2, source OpenStreetMap/Wambacher.")
)

recon_block <- function(rec) lapply(seq_len(nrow(rec)), function(i) as.list(rec[i, ]))

dataset_id <- "ki-census-religion:ki:1990-2015:kinso-island"
dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = paste0("manifest:", dataset_id),
  dataset_id = dataset_id,
  dataset_version_id = paste0(dataset_id, ":", dataset_hash),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "ki-census-religion", dataset_role = "staged_evidence",
  scope = list(level = "country", country_codes = list("KI"), snapshot_date = NULL,
               snapshot_anchor = NULL, pipeline_stage = "staged"),
  created_at = stamp, created_by = script_id,
  target_years = list(1990L, 1995L, 2000L, 2005L, 2010L, 2015L),
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation",
      shipped_waves = list(1990L, 1995L, 2000L, 2005L, 2010L, 2015L),
      shipped_geography = "24 Kiribati islands (geoBoundaries KIR ADM2)",
      boundary_set = boundary_set_id,
      source_tables = list(
        `1990` = "Table 10 Religion by Island (all persons)",
        `1995` = "Table 10 Religion by Island (all persons)",
        `2000` = "Table 10 Religion by Island (all persons)",
        `2005` = "Table 10 Religion by Island (all persons)",
        `2010` = "Table 10 Religion by Island (all persons)",
        `2015` = "Report Vol 1 Table 6 Population by island, sex and religion (all persons)"
      ),
      universe = "all persons, all ages, in every wave (probe-verified); no universe break across 1990-2015",
      category_frames = list(
        `1990` = as.list(parsed[["1990"]]$cats),
        `1995` = as.list(parsed[["1995"]]$cats),
        `2000` = as.list(parsed[["2000"]]$cats),
        `2005` = as.list(parsed[["2005"]]$cats),
        `2010` = as.list(parsed[["2010"]]$cats),
        `2015` = as.list(cats_2015),
        `2020_national_context` = as.list(cats_2020),
        alignment_note = paste(
          "Categories are preserved verbatim per wave and never merged. The frame widens from eight categories",
          "(1990) to fourteen (2015). Broad religious affiliation (population minus no-religion and any not-stated",
          "residual) is comparable across all six waves because every wave counts all persons. The dominant",
          "Protestant body is one category through 2015 (Kiribati Protestant Church); the Kiribati Uniting Church",
          "formed in 2014 and the 2020 national context splits KPC (10,016) and KUC (25,322), which combine to",
          "35,338 (the Atlas KUC-KPC collapse). That split is recorded for the 2020 national context row only and",
          "is never applied to the island waves. The 1995 frame carries no No religion category, so the 1995",
          "no-religion share is null. The Line Islands and Phoenix are enumerated in one combined column in 1995."
        )
      ),
      no_religion_treatment = list(
        `1990` = "None category (national 56); no not-stated column",
        `1995` = "no No religion category in the frame; no-religion rendered null, affiliation equals population",
        `2000` = "None category (national 64); Ns not-stated column (national 25) retained in the denominator",
        `2005` = "None category (national 23); Ns not-stated column (national 22) retained in the denominator",
        `2010` = "None category (national 51); Not Stated column (national 212) retained in the denominator",
        `2015` = "No religion category (national 51); no not-stated column"
      ),
      betio_treatment = paste(
        "Betio is a separate geoBoundaries ADM2 feature and a separate 2015 census island. Through 2010 the census",
        "enumerated Betio within South Tarawa, so 1990-2010 carry a null Betio row (unit absent this wave) and the",
        "South Tarawa row's count includes Betio. In 2015 Betio is enumerated separately (17,330). The Korea 1995",
        "Sejong precedent governs: absent units get explicit null rows with a disclosed quality flag."
      ),
      phoenix_line_1995 = paste(
        "The 1995 Table 10 enumerates Teeraina, Tabuaeran, Kiritimati, and Kanton in a single combined Phoenix/Line",
        "column (5,866). Those four features carry null rows for 1995; the combined total is recorded here and never",
        "placed on a single feature."
      ),
      documented_source_discrepancy_1990 = paste(
        "The 1990 Table 10 printed island Totals sum to the national 72,334, but the religion cells fall nine persons",
        "short of the printed island Totals in four islands: South Tarawa (25,376 vs 25,379), Abemama (3,214 vs 3,218),",
        "North Tabiteuea (3,200 vs 3,201), and South Tabiteuea (1,330 vs 1,331). The nine unaccounted persons stay in",
        "each island's denominator and outside both numerators. Disclosed, never repaired (the FSM 2023 precedent)."
      ),
      change_rule = paste(
        "Broad religious-affiliation change is readable across all six waves (1990-2015) because every wave counts all",
        "persons with no universe break. Denomination-level change follows the data and widens over time; only broad",
        "affiliation and the no-religion share are published. The 2020 wave is national-only and is carried as context,",
        "never as an island wave."
      ),
      national_context_2020 = list(
        table = "G-3 Total population by sex and religion (national)",
        total = national_2020_total,
        categories = as.list(setNames(as.integer(national_2020), names(national_2020))),
        kpc = unname(national_2020[["Kiribati Protestant Church (KPC)"]]),
        kuc = unname(national_2020[["Kiribati Uniting Church (KUC)"]]),
        kpc_kuc_combined = kpc_kuc_2020_combined,
        no_religion = unname(national_2020[["No religion"]]),
        not_stated = unname(national_2020[["Not Stated"]]),
        note = "Recorded national context. Island religion for 2020 is published only as Census Atlas pie charts and held in licensed microdata; it is not shipped as an island wave."
      ),
      omitted_metrics = list("places_per_10000_residents", "place_density_per_sq_km"),
      boundary_simplification = boundary_result[["simplification"]],
      dateline_aware_extent = boundary_result[["dateline_aware_extent"]],
      local_cache_hint = "All raw sources are cached under data/raw/ki_census/ and remain git-ignored.",
      retrieval_record = raw_sources
    ),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")), digest = as.character(packageVersion("digest")),
      readxl = as.character(packageVersion("readxl")),
      mapshaper = "scripts/lib/simplify_boundary.R (npx mapshaper)"
    )
  ),
  source = list(
    provider = "Kiribati National Statistics Office (KINSO); SPC (Census Atlas); geoBoundaries (William & Mary geoLab)",
    source_dataset_ids = c(lapply(names(path_xlsx), function(y) unname(d_wave[[y]])), list(unname(d_wave[["2015"]]), d_2020, d_boundary)),
    source_urls = list(url_1990, url_1995, url_2000, url_2005, url_2010, url_2015, url_2020, url_atlas, boundary_url, boundary_meta_url),
    retrieved_at = stamp,
    licence = licence_pending,
    citation = "Kiribati Census Table 10 Religion by Island (1990-2010); 2015 Report Vol 1 Table 6; 2020 General Report Table G-3 (context); geoBoundaries KIR ADM2 (gbOpen).",
    raw_redistribution = "The census workbooks, reports, and the geoBoundaries source GeoJSON are not committed; they remain in data/raw/ki_census/.",
    local_cache_hint = "data/raw/ki_census/ (git-ignored by .gitignore data/ rule)"
  ),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = list(
    durable_file_record(summary_json_out, "Kiribati 24-island census-affiliation area summary for 1990-2015 (six waves).", "needs_review", licence_basis_slug),
    durable_file_record(summary_csv_out, "Flattened Kiribati 24-island census-affiliation rows for 1990-2015.", "needs_review", licence_basis_slug),
    durable_file_record(boundary_out, "Simplified geoBoundaries KIR ADM2 24-island boundary GeoJSON (antimeridian-safe).", "accepted", "geoboundaries_odbl_1_0")
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id,
         notes = "24 islands x 6 waves = 144 rows; all-persons universe in every wave. Absent units (Betio through 2010; Line/Phoenix in 1995) carry null metric rows."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out), built_by = script_id,
         notes = "24 island features from geoBoundaries KIR ADM2, simplified in a 0-360 frame and cut at 180; valid -180..180 output with no meridian-crossing ring.")
  ),
  validation = list(
    status = "passed_with_warnings",
    commands = list(
      paste("Rscript", script_id),
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/ki/data/area_summary_island.json",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/data-manifest.schema.json docs/manifests/ki-census-religion-1990-2015.json",
      "bash scripts/validate_manifests.sh"
    ),
    gate_1990 = list(status = "passed_with_disclosed_discrepancy", national_close_to = 72334L,
                     unaccounted_residual_total = 9L,
                     unaccounted_by_island = list(`South Tarawa` = 3L, Abemama = 4L, `North Tabiteuea` = 1L, `South Tabiteuea` = 1L),
                     records = recon_block(recon[["1990"]])),
    gate_1995 = list(status = "passed", both_margins_close_to = parsed[["1995"]]$national,
                     phoenix_line_combined = 5866L, records = recon_block(recon[["1995"]])),
    gate_2000 = list(status = "passed", both_margins_close_to = parsed[["2000"]]$national, records = recon_block(recon[["2000"]])),
    gate_2005 = list(status = "passed", both_margins_close_to = parsed[["2005"]]$national, records = recon_block(recon[["2005"]])),
    gate_2010 = list(status = "passed", both_margins_close_to = parsed[["2010"]]$national, records = recon_block(recon[["2010"]])),
    gate_2015 = list(status = "passed", population_sum = national_2015, population_close_to = national_2015,
                     no_religion_sum = national_2015_no_rel, national_category_closure = "14 printed categories sum to 110,136"),
    gate_2020_national_context = list(status = "passed", national_total = national_2020_total,
                                      category_sum = sum(national_2020), kpc_kuc_combined = kpc_kuc_2020_combined),
    boundary_validation = list(
      status = "passed", feature_count = 24L,
      distinct_geometry_hashes = boundary_result[["simplified_validation"]][["distinct_geometry_hashes"]],
      source_geometry = boundary_result[["source_validation"]],
      simplified_geometry = boundary_result[["simplified_validation"]],
      simplified_geometry_contiguous_frame = boundary_result[["shifted_validation"]],
      wgs84_frame = boundary_result[["wgs84_validation"]],
      dateline_aware_extent = boundary_result[["dateline_aware_extent"]],
      output_bytes = file_bytes(boundary_out), simplification = boundary_result[["simplification"]],
      licence = boundary_metadata[["boundaryLicense"]], adm_unit_count = boundary_metadata[["admUnitCount"]]),
    join_coverage = list(matched_islands = 24L, expected_islands = 24L, unmatched_islands = list(), unused_boundary_features = list()),
    notes = paste(
      "Every island wave reconciles against its printed control totals. 1995/2000/2005/2010 close exactly at both",
      "margins; 1990 carries a documented nine-person unaccounted residual across four islands; 2015 populations sum",
      "to 110,136 and No religion sums to 51. The boundary joins 24/24 to geoBoundaries KIR ADM2 with 24 distinct",
      "geometry hashes, and passes geometry gates in both the -180..180 output frame and the contiguous 0-360 frame:",
      "the 0-360 national extent is the compact 169.5-202.9 span, and in WGS84 no feature bbox exceeds 5 degrees of",
      "longitude (the smear test) and no ring crosses the antimeridian."
    ),
    warnings = list(
      "STAGED product: no page, no hub link. Licence needs review pending PI task 15; the KINSO reports and historical tables carry no stated reuse terms, and the SPC/KINSO Atlas partial-reproduction clause is recorded but not relied on for the island waves.",
      "1990 Table 10 carries a documented nine-person unaccounted residual (South Tarawa 3, Abemama 4, North Tabiteuea 1, South Tabiteuea 1); the residual stays in each island's denominator and is never repaired.",
      "1995 enumerates the Line Islands and Phoenix in one combined column (5,866); those four features carry null 1995 rows. Betio is enumerated within South Tarawa through 2010, so Betio carries null rows for 1990-2010 and the South Tarawa count includes Betio.",
      "The 1995 frame has no No religion category; the 1995 no-religion share is null (not enumerated).",
      "2020 is national-only (Table G-3) and is carried as recorded context, never as an island wave."
    )
  ),
  construct_notes = list(
    "The construct is census affiliation: each resident's single-select reported religion (the 2020 questionnaire item P8, and its equivalents in earlier waves), asked of all persons of all ages; not practice, attendance, or membership.",
    "Every wave counts all persons of all ages, so there is no universe break and the island denominators are directly comparable across 1990-2015. Broad religious affiliation is comparable across the full span.",
    "Categories are preserved verbatim per wave and never merged. The frame widens from eight categories (1990) to fourteen (2015). Only broad affiliation and the no-religion share are published; denomination-level change follows the data and is not published as a harmonised series.",
    "The dominant Protestant body is one category (Kiribati Protestant Church) through 2015. The Kiribati Uniting Church formed in 2014; the 2020 national context splits KPC (10,016) and KUC (25,322), which combine to 35,338 (the Atlas KUC-KPC collapse). This split is recorded for the 2020 national context only and is never applied to the island waves.",
    "The 1995 frame carries no No religion category, so the 1995 no-religion share is null and affiliation equals the enumerated population. The Line Islands and Phoenix are enumerated in one combined column in 1995, so those four features carry null 1995 rows.",
    "Betio is a separate 2015 census island and a separate ADM2 feature. Through 2010 Betio was enumerated within South Tarawa, so 1990-2010 carry null Betio rows and the South Tarawa count includes Betio (the Korea 1995 Sejong absent-unit precedent).",
    "1990 Table 10 carries a documented nine-person unaccounted residual across four islands (South Tarawa, Abemama, North Tabiteuea, South Tabiteuea); the residual stays in the denominator and is never repaired.",
    "Boundary: geoBoundaries KIR ADM2, 24 islands, ODbL 1.0. Kiribati straddles the antimeridian; the geometry pipeline runs in a contiguous 0-360 frame, cuts at lon 180, and shifts the eastern pieces back, gating in both frames. The dateline-aware national extent (169.5-202.9 in 0-360) is recorded, never the 348-degree raw bbox smear."
  ),
  deferred_sources = list(
    list(source_dataset_id = "kinso-census-2020-religion-by-island", status = "deferred",
         url = url_atlas, local_path = path_atlas,
         notes = "2020 island-level religion is published only as Census Atlas pie charts (four collapsed categories) and held in the licensed Pacific Data Hub microdata. Recovery route: a KINSO/SPC custom PDH.Stat tabulation or an NSO custom-table request."),
    list(source_dataset_id = "kinso-census-1968-1973-1985-religion-by-island", status = "deferred",
         url = nso_home_url, local_path = NULL,
         notes = "Deeper-history workbooks (census-tables-kiribati-1968/1973/1985) are listed on the KINSO file sitemap but not probed or pinned; a future-research route to extend the series before 1990."),
    list(source_dataset_id = "kinso-2005-village-level-religion", status = "deferred",
         url = nso_home_url, local_path = file.path(raw_dir, "ki_2005_teraina_general_tables.xlsx"),
         notes = "The 2005 per-island village workbooks carry Table 7 Population by village, sex and religion; a finer village geography is a future-research route, not shipped."),
    list(source_dataset_id = "kinso-licence-confirmation", status = "not_pinned",
         url = nso_home_url, local_path = NULL,
         notes = "A KINSO reuse-confirmation email is the clean unblock for the licence gate (PI task 15); none is held.")
  ),
  privacy = "public",
  licence_status = "needs_review",
  licence_basis = licence_basis_slug,
  downstream_status = "staged",
  source_datasets = source_datasets(),
  notes = paste(
    "STAGED product (no page, no hub link) pending a PI licence ruling (task 15). The committed products are the",
    "derived 24-island area summary (144 rows across 1990, 1995, 2000, 2005, 2010, 2015) and the simplified,",
    "antimeridian-safe geoBoundaries KIR ADM2 boundary. On-page attribution, when a page is built, must cite the",
    "Kiribati National Statistics Office (and SPC for the Atlas material) and geoBoundaries (ODbL 1.0, OpenStreetMap",
    "contributors, Wambacher)."
  )
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) stop("manifest JSON is invalid", call. = FALSE)

cat("waves shipped: 1990, 1995, 2000, 2005, 2010, 2015 (all persons) on 24 Kiribati islands\n")
cat(sprintf("rows: %d (24 islands x 6 waves)\n", length(rows)))
cat("gate 1990: passed; island totals close to 72,334; nine-person unaccounted residual disclosed (S.Tarawa 3, Abemama 4, N.Tabiteuea 1, S.Tabiteuea 1)\n")
cat(sprintf("gate 1995: passed; both margins close to %d; Phoenix/Line combined column 5,866 (four features null)\n", parsed[["1995"]]$national))
cat(sprintf("gate 2000: passed; both margins close to %d\n", parsed[["2000"]]$national))
cat(sprintf("gate 2005: passed; both margins close to %d\n", parsed[["2005"]]$national))
cat(sprintf("gate 2010: passed; both margins close to %d\n", parsed[["2010"]]$national))
cat("gate 2015: passed; 24 populations sum to 110,136; No religion sums to 51\n")
cat(sprintf("gate 2020 (national context): passed; 17 categories sum to %d; KPC+KUC = %d\n", national_2020_total, kpc_kuc_2020_combined))
cat(sprintf("boundary gate: passed; 24/24 join, %d distinct hashes, %d bytes at %g%% keep\n",
            boundary_result[["simplified_validation"]][["distinct_geometry_hashes"]], file_bytes(boundary_out),
            boundary_result[["simplification"]][["keep_percent"]]))
cat(sprintf("  0-360 extent: %.3f-%.3f (span %.1f); WGS84 max feature bbox lon span %.3f deg; max ring lon jump %.3f deg\n",
            boundary_result[["dateline_aware_extent"]][["frame_0_360"]][["xmin"]],
            boundary_result[["dateline_aware_extent"]][["frame_0_360"]][["xmax"]],
            boundary_result[["dateline_aware_extent"]][["frame_0_360"]][["span"]],
            boundary_result[["wgs84_validation"]][["max_feature_bbox_lon_span_deg"]],
            boundary_result[["wgs84_validation"]][["max_ring_consecutive_lon_jump_deg"]]))
cat("licence gate: needs_review; STAGED pending PI task 15; no reuse terms on KINSO reports/tables; Atlas SPC clause recorded; boundary ODbL 1.0\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", boundary_out))
cat(sprintf("wrote %s\n", manifest_out))
