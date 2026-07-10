# build the Fiji 2007 province census-affiliation area-summary product.
# inputs: Fiji Bureau of Statistics 2007 census Table P01-3 (Relationship,
# Ethnicity and Religion by Province of Enumeration) PDF, plus geoBoundaries
# FJI ADM2 province release geometry and metadata.
# the build reads only the first, all-ethnicity table and extracts the
# religion-by-province margin; the source's religion-by-ethnicity cross-tabs
# (its Fijians and Indians tables) are out of scope for this product.
# outputs: apps/regions/fj/data/fj_province_2020.geojson,
# apps/regions/fj/data/area_summary_province.{json,csv}, and
# docs/manifests/fj-census-religion-2007.json.
# run from the repository root: Rscript scripts/build_fj_area_summary.R

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(sf)
})

source("scripts/lib/simplify_boundary.R")

country_code <- "FJ"
script_id <- "scripts/build_fj_area_summary.R"
raw_dir <- "data/raw/fj_census"
product_dir <- "apps/regions/fj/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-11"
stamp <- paste0(retrieval_date, "T00:00:00Z")
git_commit <- trimws(system2("git", c("rev-parse", "HEAD"), stdout = TRUE))
if (length(git_commit) != 1L || !grepl("^[a-f0-9]{40}$", git_commit)) stop("could not resolve the base git commit", call. = FALSE)
boundary_level <- "province"
boundary_set_id <- "fj-province-2020-geoboundaries-adm2"
census_dataset_id <- "fbos-census-2007-table-p01-3-religion-province"
boundary_dataset_id <- "geoboundaries-fji-adm2-2020"

# fiji map grid handles the antimeridian crossing (Lau, Rotuma) for area maths.
metric_crs <- "EPSG:3460"

census_url <- "https://www.statsfiji.gov.fj/download/117/01_province-of-enumeration/686/03_relationship-ethnicity-and-religion-by_province-of-enumeration_fiji-2007.pdf"
census_page_url <- "https://www.statsfiji.gov.fj/census-surveys/census-of-population-and-housing/"
statsfiji_home_url <- "https://www.statsfiji.gov.fj/"
boundary_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/FJI/ADM2/"
boundary_adm1_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/FJI/ADM1/"
boundary_adm3_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/FJI/ADM3/"
boundary_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/FJI/ADM2/geoBoundaries-FJI-ADM2.geojson"
release3_url <- "https://www.statsfiji.gov.fj/download/121/phc-2017/729/2017-population-and-housing-census-release-3.pdf"
pdh_2007_url <- "https://microdata.pacificdata.org/index.php/catalog/241"
pdh_1996_url <- "https://microdata.pacificdata.org/index.php/catalog/237"

census_path <- file.path(raw_dir, "fj_2007_religion_ethnicity_province.pdf")
census_page_path <- file.path(raw_dir, "statsfiji_census_page.html")
statsfiji_home_path <- file.path(raw_dir, "statsfiji_home.html")
boundary_meta_path <- file.path(raw_dir, "gb_fji_adm2_meta.json")
boundary_adm1_meta_path <- file.path(raw_dir, "gb_fji_adm1_meta.json")
boundary_adm3_meta_path <- file.path(raw_dir, "gb_fji_adm3_meta.json")
boundary_path <- file.path(raw_dir, "geoBoundaries-FJI-ADM2.geojson")
release3_path <- file.path(raw_dir, "fj_2017_census_release3_general_tables.pdf")
pdh_2007_path <- file.path(raw_dir, "pdh_2007_catalog241.html")
pdh_1996_path <- file.path(raw_dir, "pdh_1996_catalog237.html")

boundary_out <- file.path(product_dir, "fj_province_2020.geojson")
summary_json_out <- file.path(product_dir, "area_summary_province.json")
summary_csv_out <- file.path(product_dir, "area_summary_province.csv")
manifest_out <- file.path(manifest_dir, "fj-census-religion-2007.json")

# provinces in the printed column order of Table P01-3, mapped positionally.
province_order <- c(
  "Ba", "Bua", "Cakaudrove", "Kadavu", "Lau", "Lomaiviti", "Macuata",
  "Nadroga/Navosa", "Naitasiri", "Namosi", "Ra", "Rewa", "Serua", "Tailevu", "Rotuma"
)
# one spelling concordance to the boundary shapeName; all others are identical.
province_aliases <- c("Nadroga/Navosa" = "Nadroga-Navosa")

# the six mutually exclusive top-level religion categories printed by the source.
top_categories <- c("Christian", "Hindu", "Sikh", "Moslem", "Other religion", "No religion")
# named religions counted as religious affiliation; "No religion" is the no-religion numerator.
affiliation_categories <- c("Christian", "Hindu", "Sikh", "Moslem", "Other religion")
# printed Christian sub-denomination labels (source-truncated spellings) for the internal gate.
christian_subcategories <- c(
  "Anglican", "Apostolic", "Assembly of Go", "All Nation Chr", "Baptist", "Catholic",
  "Christ Mis Flw", "Church of Chri", "Gospel", "Jehovah's Witn", "Latter Day Sai",
  "Methodist", "Penticostal", "Presbyterian", "Salvation Army", "Seventh Day Ad",
  "United Penteco", "Other Christia"
)

# return a file's SHA-256 digest.
sha256_file <- function(path) unname(tools::sha256sum(path))

# return a file's size in bytes.
file_bytes <- function(path) as.numeric(unname(file.info(path)[["size"]]))

# stop when a required cached input is absent.
require_file <- function(path) {
  if (!file.exists(path) || file_bytes(path) == 0) stop("missing required source: ", path, call. = FALSE)
}

# count rows or features in a generated product.
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$", path)) return(length(fromJSON(path, simplifyVector = FALSE)[["features"]]))
  if (grepl("\\.json$", path)) return(length(fromJSON(path, simplifyVector = FALSE)[["rows"]]))
  NA_integer_
}

# pull the integer tokens from one printed table line ("-" denotes a zero cell).
line_numbers <- function(line) {
  toks <- regmatches(line, gregexpr("-|[0-9][0-9,]*", line))[[1L]]
  as.integer(ifelse(toks == "-", "0", gsub(",", "", toks)))
}

# find the single religion row whose label opens the trimmed line and return its 16 counts.
category_row <- function(lines, label) {
  hit <- lines[startsWith(trimws(lines), label)]
  if (length(hit) < 1L) stop("religion row not found: ", label, call. = FALSE)
  values <- line_numbers(hit[[1L]])
  if (length(values) != 16L) stop("religion row ", label, " did not yield 16 counts", call. = FALSE)
  values
}

# extract only the all-ethnicity religion-by-province margin from the 2007 PDF.
parse_religion_margin <- function(path) {
  tmp <- tempfile(fileext = ".txt")
  on.exit(unlink(tmp), add = TRUE)
  status <- system2("pdftotext", c("-layout", shQuote(path), shQuote(tmp)))
  if (!identical(status, 0L) || !file.exists(tmp)) stop("pdftotext failed on the 2007 census PDF", call. = FALSE)
  lines <- readLines(tmp, warn = FALSE)

  title_rows <- grep("^Table P01-3\\.", lines)
  if (length(title_rows) < 1L) stop("first Table P01-3 header not found", call. = FALSE)
  source_rows <- grep("^Source:", lines)
  first_source <- source_rows[source_rows > title_rows[[1L]]][[1L]]
  # isolate the first table (all ethnicities combined); ignore the ethnicity-specific tables.
  block <- lines[title_rows[[1L]]:first_source]

  religion_start <- which(trimws(block) == "RELIGION")
  if (length(religion_start) != 1L) stop("RELIGION section not uniquely found in the first table", call. = FALSE)
  religion <- block[religion_start:length(block)]

  total_line <- religion[startsWith(trimws(religion), "Total")]
  if (length(total_line) < 1L) stop("religion Total row not found", call. = FALSE)
  total <- line_numbers(total_line[[1L]])
  if (length(total) != 16L) stop("religion Total row did not yield 16 counts", call. = FALSE)

  tops <- lapply(top_categories, function(cat) category_row(religion, cat))
  names(tops) <- top_categories
  subs <- lapply(christian_subcategories, function(cat) category_row(religion, cat))
  names(subs) <- christian_subcategories

  # gate one: Christian sub-denominations close to the Christian total in every column.
  christian_sum <- Reduce(`+`, subs)
  if (!all(christian_sum == tops[["Christian"]])) {
    failing <- province_order[which(christian_sum[-1L] != tops[["Christian"]][-1L])]
    stop("Christian sub-denominations do not sum to the Christian total for: ",
         paste(c(if (christian_sum[[1L]] != tops[["Christian"]][[1L]]) "NATIONAL", failing), collapse = "; "),
         call. = FALSE)
  }

  # gate two: the 15 provinces close to the printed national column for Total and each category.
  reconcile <- c(list(Total = total), tops)
  for (field in names(reconcile)) {
    vals <- reconcile[[field]]
    if (sum(vals[2:16]) != vals[[1L]]) {
      stop("provinces do not sum to the national ", field, call. = FALSE)
    }
  }

  # not-stated residual: the source prints no not-stated row; the residual is therefore
  # carried in the denominator and outside both headline numerators (the Tonga REF precedent).
  not_stated <- vapply(seq_len(16L), function(i) {
    total[[i]] - sum(vapply(top_categories, function(cat) tops[[cat]][[i]], integer(1)))
  }, integer(1))
  if (any(not_stated < 0L)) stop("not-stated residual is negative in at least one column", call. = FALSE)

  list(total = total, tops = tops, subs = subs, not_stated = not_stated)
}

# count polygon interior rings, which indicate uncovered internal gaps.
interior_ring_count <- function(geometry) {
  shape <- st_geometry(geometry)[[1L]]
  if (inherits(shape, "POLYGON")) return(max(0L, length(shape) - 1L))
  if (inherits(shape, "MULTIPOLYGON")) {
    return(sum(vapply(shape, function(polygon) max(0L, length(polygon) - 1L), integer(1))))
  }
  stop("boundary union is not polygonal", call. = FALSE)
}

# count source-defined holes across individual features.
feature_interior_ring_count <- function(layer) {
  sum(vapply(seq_len(nrow(layer)), function(index) interior_ring_count(layer[index, ]), integer(1)))
}

# hash each feature's geometry without serialising the R object.
geometry_hashes <- function(layer) {
  vapply(seq_len(nrow(layer)), function(index) {
    digest(st_as_binary(st_geometry(layer)[index], EWKB = TRUE)[[1L]], algo = "sha256", serialize = FALSE)
  }, character(1))
}

# enforce validity, distinctness, overlap, gap, and sliver gates.
validate_boundary <- function(layer, stage) {
  if (nrow(layer) != 15L || any(st_is_empty(layer)) || any(is.na(st_is_valid(layer))) || any(!st_is_valid(layer))) {
    stop(stage, " boundary does not contain 15 valid non-empty features", call. = FALSE)
  }
  hashes <- geometry_hashes(layer)
  if (length(unique(hashes)) != 15L) stop(stage, " boundary geometry hashes are not distinct", call. = FALSE)
  metric <- st_transform(layer, metric_crs)
  areas <- as.numeric(st_area(metric))
  union <- st_union(metric)
  overlap_sq_m <- sum(areas) - as.numeric(st_area(union))
  if (overlap_sq_m > 1) stop(stage, " boundary overlap exceeds 1 square metre", call. = FALSE)
  union_holes <- interior_ring_count(union)
  source_holes <- feature_interior_ring_count(metric)
  gaps <- max(0L, union_holes - source_holes)
  if (gaps != 0L) stop(stage, " boundary contains an uncovered inter-feature gap", call. = FALSE)
  sliver_threshold_sq_m <- 1000000
  sliver_count <- sum(areas < sliver_threshold_sq_m)
  if (sliver_count != 0L) stop(stage, " boundary contains a feature below 1 square kilometre", call. = FALSE)
  list(
    hashes = setNames(as.list(hashes), layer[["area_code"]]),
    overlap_sq_m = round(overlap_sq_m, 6),
    interior_gap_count = gaps,
    source_hydrographic_hole_count = source_holes,
    sliver_threshold_sq_m = sliver_threshold_sq_m,
    sliver_count = sliver_count,
    minimum_feature_area_sq_km = round(min(areas) / 1e6, 4),
    coverage_sq_km = round(as.numeric(st_area(union)) / 1e6, 4)
  )
}

# join all 15 census provinces one-to-one to the licensed ADM2 features.
build_boundary <- function(path) {
  boundary <- st_make_valid(st_read(path, quiet = TRUE, stringsAsFactors = FALSE))
  if (nrow(boundary) != 15L) stop("geoBoundaries FJI ADM2 feature count changed", call. = FALSE)
  boundary_names <- ifelse(
    province_order %in% names(province_aliases),
    unname(province_aliases[province_order]),
    province_order
  )
  index <- match(boundary_names, boundary[["shapeName"]])
  if (anyNA(index) || anyDuplicated(index) || !setequal(index, seq_len(15L))) {
    stop("census and boundary provinces do not join one-to-one", call. = FALSE)
  }
  boundary <- boundary[index, ]
  boundary[["source_area_name"]] <- province_order
  boundary[["boundary_source_name"]] <- boundary[["shapeName"]]
  boundary[["area_code"]] <- boundary[["shapeID"]]
  boundary[["area_name"]] <- province_order
  boundary[["area_unit_id"]] <- paste(boundary_set_id, boundary[["area_code"]], sep = ":")
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- boundary_level
  boundary[["boundary_vintage"]] <- "2020"
  boundary[["boundary_source"]] <- "geoBoundaries FJI ADM2; source pacificdata.org"
  boundary[["boundary_licence"]] <- "CC BY 4.0"
  boundary[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(boundary, metric_crs))) / 1e6
  boundary <- st_transform(st_make_valid(boundary), 4326)
  boundary[c(
    "area_code", "area_name", "source_area_name", "boundary_source_name", "area_unit_id",
    "boundary_set_id", "boundary_level", "boundary_vintage", "boundary_source",
    "boundary_licence", "land_area_sq_km", "geometry"
  )]
}

# list every ring matrix in one polygonal sfg.
feature_rings <- function(geom) {
  if (inherits(geom, "POLYGON")) return(unclass(geom))
  if (inherits(geom, "MULTIPOLYGON")) return(do.call(c, lapply(unclass(geom), unclass)))
  stop("feature geometry is not polygonal", call. = FALSE)
}

# cut a contiguous 0..360-frame layer at lon 180 and return a -180..180 layer:
# each straddling province becomes a dateline-noded MultiPolygon whose eastern
# pieces are shifted back by 360 degrees; no ring crosses the meridian.
cut_at_dateline <- function(shifted_layer) {
  old_s2 <- sf_use_s2()
  on.exit(suppressMessages(sf_use_s2(old_s2)), add = TRUE)
  # the cut is a planar operation in the contiguous frame
  suppressMessages(sf_use_s2(FALSE))
  west_rect <- st_as_sfc(st_bbox(c(xmin = 0, ymin = -90, xmax = 180, ymax = 90), crs = st_crs(4326)))
  east_rect <- st_as_sfc(st_bbox(c(xmin = 180, ymin = -90, xmax = 360, ymax = 90), crs = st_crs(4326)))
  geoms <- lapply(seq_len(nrow(shifted_layer)), function(index) {
    geom <- st_geometry(shifted_layer)[index]
    pieces <- list()
    west <- suppressMessages(suppressWarnings(st_intersection(geom, west_rect)))
    if (length(west) > 0L && !all(st_is_empty(west))) {
      pieces <- c(pieces, list(suppressWarnings(st_collection_extract(west, "POLYGON"))))
    }
    east <- suppressMessages(suppressWarnings(st_intersection(geom, east_rect)))
    if (length(east) > 0L && !all(st_is_empty(east))) {
      east_polys <- suppressWarnings(st_collection_extract(east, "POLYGON"))
      # translate the eastern hemisphere pieces back into negative longitudes
      east_shifted <- st_set_crs(east_polys - c(360, 0), 4326)
      pieces <- c(pieces, list(east_shifted))
    }
    if (length(pieces) == 0L) stop("dateline cut emptied a province", call. = FALSE)
    combined <- st_make_valid(suppressMessages(suppressWarnings(st_union(do.call(c, pieces)))))
    st_cast(combined, "MULTIPOLYGON")[[1L]]
  })
  out <- shifted_layer
  st_geometry(out) <- st_sfc(geoms, crs = 4326)
  out
}

# WGS84-frame gates: validity in EPSG:4326, every coordinate inside [-180, 180],
# no ring with a consecutive-vertex longitude jump of 180 degrees or more (the
# dateline-smear test), and a dateline-aware per-feature longitudinal extent
# below 180 degrees. A correctly cut straddling province carries pieces at both
# +180 and -180: its raw bbox spans 360 by construction, and the dateline-aware
# extent (the shorter of the raw span and the 0..360-frame span) measures its
# true angular width.
validate_wgs84_frame <- function(layer) {
  validity <- st_is_valid(layer)
  if (any(st_is_empty(layer)) || any(is.na(validity)) || any(!validity)) {
    stop("boundary is not valid and non-empty in EPSG:4326", call. = FALSE)
  }
  max_extent <- 0
  max_jump <- 0
  for (index in seq_len(nrow(layer))) {
    lons <- numeric(0)
    for (ring in feature_rings(st_geometry(layer)[[index]])) {
      ring_lons <- ring[, 1L]
      if (any(ring_lons < -180 - 1e-8) || any(ring_lons > 180 + 1e-8)) {
        stop("feature ", layer[["area_name"]][[index]], " has a coordinate outside [-180, 180]", call. = FALSE)
      }
      jump <- max(abs(diff(ring_lons)))
      if (jump >= 180) {
        stop("feature ", layer[["area_name"]][[index]],
             " has a ring crossing the antimeridian (consecutive-vertex longitude jump ",
             round(jump, 2), " degrees)", call. = FALSE)
      }
      max_jump <- max(max_jump, jump)
      lons <- c(lons, ring_lons)
    }
    raw_span <- max(lons) - min(lons)
    shifted_lons <- ifelse(lons < 0, lons + 360, lons)
    shifted_span <- max(shifted_lons) - min(shifted_lons)
    extent <- min(raw_span, shifted_span)
    if (extent >= 180) {
      stop("feature ", layer[["area_name"]][[index]], " spans ", round(extent, 2),
           " degrees of longitude", call. = FALSE)
    }
    max_extent <- max(max_extent, extent)
  }
  list(
    status = "passed",
    crs = "EPSG:4326",
    coordinate_range_check = "all coordinates within [-180, 180]",
    max_ring_consecutive_lon_jump_deg = round(max_jump, 4),
    max_feature_dateline_aware_lon_extent_deg = round(max_extent, 4)
  )
}

# return the contiguous 0..360 representation of a cut layer: shift longitudes
# and dissolve each feature's dateline seam (the cut halves share the seam
# edge, which is a duplicate-edge invalidity until the unary union merges them
# back into one contiguous polygon).
contiguous_frame <- function(layer) {
  old_s2 <- sf_use_s2()
  on.exit(suppressMessages(sf_use_s2(old_s2)), add = TRUE)
  suppressMessages(sf_use_s2(FALSE))
  shifted <- st_shift_longitude(layer)
  geoms <- lapply(seq_len(nrow(shifted)), function(index) {
    merged <- suppressMessages(suppressWarnings(st_union(st_geometry(shifted)[index])))
    st_cast(st_make_valid(merged), "MULTIPOLYGON")[[1L]]
  })
  st_geometry(shifted) <- st_sfc(geoms, crs = st_crs(layer))
  shifted
}

# simplify with the mandatory helper and re-run every geometry gate.
# Fiji straddles the antimeridian (Lau, Cakaudrove, and Macuata reach past
# 180): mapshaper's planar clean corrupts the -180..180 split representation;
# therefore the layer is shifted to a contiguous 0..360 frame for
# simplification, cut at lon 180, and the eastern pieces are shifted back so
# the web-map output is a valid -180..180 layer with no meridian-crossing ring.
write_boundary <- function(boundary) {
  source_validation <- validate_boundary(boundary, "source")
  shifted <- st_shift_longitude(boundary)
  simplify_tmp <- tempfile(fileext = ".geojson")
  on.exit(unlink(simplify_tmp), add = TRUE)
  simplification <- mapshaper_simplify_to_cap(
    shifted,
    simplify_tmp,
    max_bytes = 3000000L,
    keep_percentages = c(100, 75, 50, 30, 20, 10, 5),
    clean_option = "allow-overlaps"
  )
  simplified_shifted <- st_read(simplify_tmp, quiet = TRUE, stringsAsFactors = FALSE)
  wrapped <- cut_at_dateline(simplified_shifted)
  st_write(wrapped, boundary_out, driver = "GeoJSON", delete_dsn = TRUE, quiet = TRUE,
           layer_options = c("COORDINATE_PRECISION=5"))
  final_bytes <- file_bytes(boundary_out)
  if (final_bytes > 3000000L) stop("wrapped simplified boundary exceeds 3 MB", call. = FALSE)
  simplification[["bytes"]] <- as.integer(final_bytes)
  written <- st_read(boundary_out, quiet = TRUE, stringsAsFactors = FALSE)
  written <- written[match(boundary[["area_code"]], written[["area_code"]]), ]
  if (anyNA(written[["area_code"]])) stop("simplified boundary lost an area code", call. = FALSE)
  # gates in the WGS84 output frame: validity, coordinate range, no smear
  wgs84_validation <- validate_wgs84_frame(written)
  # projected gates plus distinct hashes in the output -180..180 frame
  simplified_validation <- validate_boundary(written, "simplified")
  # the same gates re-run in the contiguous 0..360 frame (seams dissolved):
  # the distinct-hash, overlap, gap, and sliver checks must hold in both
  # representations
  rewrapped <- contiguous_frame(written)
  shifted_validation <- validate_boundary(rewrapped, "simplified-shifted")
  list(
    layer = written,
    simplification = simplification,
    source_validation = source_validation,
    simplified_validation = simplified_validation,
    shifted_validation = shifted_validation,
    wgs84_validation = wgs84_validation
  )
}

# build one schema-shaped province row for the 2007 wave.
build_area_row <- function(parsed, province_index, area) {
  col <- province_index + 1L
  total <- parsed[["total"]][[col]]
  affiliation <- sum(vapply(affiliation_categories, function(cat) parsed[["tops"]][[cat]][[col]], integer(1)))
  no_religion <- parsed[["tops"]][["No religion"]][[col]]
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = area[["area_unit_id"]],
    area_code = area[["area_code"]],
    area_name = province_order[[province_index]],
    year = 2007L,
    population_total = as.integer(total),
    population_total_basis = paste(
      "population enumerated by province in the 2007 census Table P01-3 religion margin;",
      "an unprinted not-stated residual (province Total minus the six printed religion categories)",
      "remains in the denominator and outside both headline numerators"
    ),
    religious_affiliation_count = as.integer(affiliation),
    religious_affiliation_percent = round(100 * affiliation / total, 4),
    no_religion_count = as.integer(no_religion),
    no_religion_percent = round(100 * no_religion / total, 4),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(area[["land_area_sq_km"]], 4),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(census_dataset_id, boundary_dataset_id),
    quality_flag = paste(
      "census_affiliation;religion_by_province_margin;ethnicity_dimension_out_of_scope;",
      "unprinted_not_stated_residual_retained_in_denominator;",
      "2007_only_change_withheld;fbos_all_rights_reserved_research_reuse_with_attribution;boundary_cc_by_4_0",
      sep = ""
    )
  )
}

# flatten row objects into the CSV companion.
flatten_rows <- function(rows) {
  do.call(rbind, lapply(rows, function(row) {
    data.frame(
      country_code = row[["country_code"]], boundary_set_id = row[["boundary_set_id"]],
      boundary_level = row[["boundary_level"]], area_unit_id = row[["area_unit_id"]],
      area_code = row[["area_code"]], area_name = row[["area_name"]], year = row[["year"]],
      population_total = row[["population_total"]], population_total_basis = row[["population_total_basis"]],
      religious_affiliation_count = row[["religious_affiliation_count"]],
      religious_affiliation_percent = row[["religious_affiliation_percent"]],
      no_religion_count = row[["no_religion_count"]], no_religion_percent = row[["no_religion_percent"]],
      place_count = NA_integer_, places_per_10000_residents = NA_real_,
      place_density_per_sq_km = NA_real_, land_area_sq_km = row[["land_area_sq_km"]],
      site_snapshot_date = NA_character_, place_count_basis = NA_character_,
      source_dataset_ids = paste(unlist(row[["source_dataset_ids"]]), collapse = "|"),
      quality_flag = row[["quality_flag"]], stringsAsFactors = FALSE
    )
  }))
}

# describe the sources carried by the governed product.
source_datasets <- function() {
  fbos_licence <- paste(
    "Fiji Bureau of Statistics asserts all rights reserved with no explicit reuse grant;",
    "the derived aggregate is used for research with attribution and claims no open-data licence"
  )
  list(
    list(
      source_dataset_id = census_dataset_id,
      name = "Fiji 2007 Census of Population and Housing, Table P01-3: Relationship, Ethnicity and Religion by Province of Enumeration (all-ethnicity religion margin)",
      provider = "Fiji Bureau of Statistics (FBoS)", url = census_url,
      retrieval_date = retrieval_date, local_path = census_path,
      licence = list(name = fbos_licence, url = statsfiji_home_url, attribution = "Fiji Bureau of Statistics, 2007 Census of Population and Housing"),
      citation = "Fiji Bureau of Statistics, 2007 Census of Population and Housing, Table P01-3, Relationship, Ethnicity and Religion by Province of Enumeration.",
      access_limits = NULL,
      redistribution_limits = "The product contains derived aggregate statistics for a research map. No open-data licence is claimed; reuse relies on FBoS attribution.",
      notes = "Only the first, all-ethnicity table is used, and only its religion-by-province margin. The source also prints religion-by-ethnicity cross-tabs (its Fijians and Indians tables); the ethnicity dimension is out of scope."
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "geoBoundaries FJI ADM2 (15 provinces)",
      provider = "geoBoundaries; source pacificdata.org", url = boundary_url,
      retrieval_date = retrieval_date, local_path = boundary_path,
      licence = list(name = "Creative Commons Attribution 4.0 (CC BY 4.0)", url = boundary_meta_url, attribution = "geoBoundaries; pacificdata.org"),
      citation = "geoBoundaries FJI ADM2, boundary ID FJI-ADM2-14151628; source pacificdata.org 2007 FJI PHC admin boundaries.",
      access_limits = NULL,
      redistribution_limits = "The simplified boundary retains geoBoundaries and pacificdata.org attribution.",
      notes = "Release metadata records 15 province units, canonical Provinces, represented year 2020, source pacificdata.org, and CC BY 4.0. One label alias (Nadroga/Navosa to Nadroga-Navosa) connects source spellings without changing geography."
    )
  )
}

# declare the three indicators exposed by the snapshot.
indicators <- function() {
  denominator_note <- paste(
    "Percentages use each province Total from the 2007 Table P01-3 religion margin.",
    "An unprinted not-stated residual remains in the denominator and outside both headline numerators."
  )
  list(
    list(
      indicator_id = "population_total", label = "Religion-table population", description = "Population enumerated by province in the 2007 census religion margin.",
      unit = "count", denominator_indicator_id = NULL, method = "Printed province Total in Table P01-3 (RELIGION section).", temporal_coverage = "2007",
      spatial_coverage = "Fiji provinces", quality_notes = denominator_note
    ),
    list(
      indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
      description = "Share affiliated with a named religion (Christian, Hindu, Sikh, Moslem, or Other religion).", unit = "percent",
      denominator_indicator_id = "population_total", method = "100 * (Christian + Hindu + Sikh + Moslem + Other religion) / Total.", temporal_coverage = "2007",
      spatial_coverage = "Fiji provinces", quality_notes = denominator_note
    ),
    list(
      indicator_id = "no_religion_percent", label = "No religious affiliation %",
      description = "Share in the source's No religion category.", unit = "percent", denominator_indicator_id = "population_total",
      method = "100 * No religion / Total.", temporal_coverage = "2007", spatial_coverage = "Fiji provinces", quality_notes = denominator_note
    )
  )
}

# declare the province choropleth layers without a change layer.
visual_layers <- function() {
  list(
    list(
      visual_layer_id = "fj-province-religious-affiliation", label = "Religious affiliation %",
      description = "Fiji 2007 census-affiliation share by province.", layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "province population in the 2007 religion margin, including a not-stated residual"),
      colour_scale = "sequential", time_control = "year_selector", aggregation_rule = "reported province value",
      uncertainty_display = "quality_flag", default_visibility = TRUE,
      notes = "The construct is census affiliation with any named religion, not religious practice or registered membership."
    ),
    list(
      visual_layer_id = "fj-province-no-religion", label = "No religious affiliation %",
      description = "Fiji 2007 census no-religion share by province.", layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"), geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "province population in the 2007 religion margin, including a not-stated residual"),
      colour_scale = "sequential", time_control = "year_selector", aggregation_rule = "reported province value",
      uncertainty_display = "quality_flag", default_visibility = FALSE, notes = "The source category is No religion."
    )
  )
}

# record one cached source with its exact retrieval hash.
raw_source_record <- function(path, url, format, used_in_public_product, periods, notes) {
  list(
    uri = path, url = url, format = format, bytes = as.integer(file_bytes(path)), sha256 = sha256_file(path),
    used_in_public_product = used_in_public_product, periods = periods, notes = notes
  )
}

# record one generated file in the manifest.
manifest_file_record <- function(path, content, licence_status) {
  list(
    uri = paste0("repo:", path), storage_provider = "other", format = sub("^.*\\.", "", path),
    bytes = as.integer(file_bytes(path)), sha256 = sha256_file(path), content_sha256 = NULL,
    row_count = if (grepl("area_summary", path)) row_count_file(path) else NULL,
    feature_count = if (grepl("geojson$", path)) row_count_file(path) else NULL,
    content = content, licence_status = licence_status
  )
}

required_inputs <- c(
  census_path, census_page_path, statsfiji_home_path, boundary_meta_path, boundary_adm1_meta_path,
  boundary_adm3_meta_path, boundary_path, release3_path, pdh_2007_path, pdh_1996_path
)
invisible(lapply(required_inputs, require_file))

boundary_metadata <- fromJSON(boundary_meta_path, simplifyVector = FALSE)
if (!identical(boundary_metadata[["boundaryLicense"]], "Creative Commons Attribution 4.0 (CC BY 4.0)") ||
    !identical(boundary_metadata[["boundarySource"]], "pacificdata.org") ||
    !identical(boundary_metadata[["boundaryCanonical"]], "Provinces") ||
    !identical(boundary_metadata[["admUnitCount"]], "15")) {
  stop("geoBoundaries licence, source, canonical, or unit metadata changed", call. = FALSE)
}

parsed <- parse_religion_margin(census_path)
boundary <- build_boundary(boundary_path)
boundary_result <- write_boundary(boundary)
written_boundary <- boundary_result[["layer"]]

rows <- lapply(seq_along(province_order), function(index) {
  build_area_row(parsed, index, written_boundary[index, , drop = FALSE])
})

summary_product <- list(
  schema_version = "area-summary.v1", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(
    boundary_set_id = boundary_set_id, country_code = country_code, level = boundary_level,
    vintage = "2020", source_dataset_id = boundary_dataset_id
  ),
  site_snapshot = list(
    source_dataset_id = NULL, snapshot_date = NULL,
    basis = "No governed place-of-worship snapshot ships in the Fiji census product.",
    notes = "Place counts and density metrics remain null."
  ),
  source_datasets = source_datasets(), indicators = indicators(), visual_layers = visual_layers(), rows = rows
)

write_json(summary_product, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

national_total <- parsed[["total"]][[1L]]
national_affiliation <- sum(vapply(affiliation_categories, function(cat) parsed[["tops"]][[cat]][[1L]], integer(1)))
national_no_religion <- parsed[["tops"]][["No religion"]][[1L]]
national_not_stated <- parsed[["not_stated"]][[1L]]
national_category_totals <- setNames(
  as.list(as.integer(vapply(top_categories, function(cat) parsed[["tops"]][[cat]][[1L]], integer(1)))),
  top_categories
)

raw_sources <- list(
  raw_source_record(census_path, census_url, "pdf", TRUE, "2007", "Table P01-3; the first, all-ethnicity table supplies the religion-by-province margin and national reconciliation column."),
  raw_source_record(boundary_meta_path, boundary_meta_url, "json", TRUE, "2020", "Release metadata records pacificdata.org as source, 15 province units, and CC BY 4.0."),
  raw_source_record(boundary_path, boundary_url, "geojson", TRUE, "2020", "Source geometry for 15 provinces."),
  raw_source_record(boundary_adm1_meta_path, boundary_adm1_meta_url, "json", FALSE, "2006", "ADM1 = 4 Divisions; recorded as evidence that ADM1 does not match the 15-province census frame."),
  raw_source_record(boundary_adm3_meta_path, boundary_adm3_meta_url, "json", FALSE, "2017", "ADM3 = 86 Tikina under ODbL 1.0; the finer geography is not used but recorded for a future tikina route."),
  raw_source_record(census_page_path, census_page_url, "html", FALSE, "2007", "Census landing page; links the 2007 report and the 2017 Release 1-3 downloads."),
  raw_source_record(statsfiji_home_path, statsfiji_home_url, "html", FALSE, NA, "FBoS home page; footer asserts all rights reserved. Licence evidence."),
  raw_source_record(release3_path, release3_url, "pdf", FALSE, "2017", "2017 Release 3 General Tables; province-of-enumeration tables cover age/sex, economic activity, education, province of birth and housing only, with no religion table. Evidence for the 2017 deferral."),
  raw_source_record(pdh_2007_path, pdh_2007_url, "html", FALSE, "2007", "PDH 2007 census catalogue; record-level metadata."),
  raw_source_record(pdh_1996_path, pdh_1996_url, "html", FALSE, "1996", "PDH 1996 census catalogue; metadata confirms a religion variable but no official aggregate province religion table was pinned. 1996 deferred route.")
)

dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)
manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json", schema_version = "data-manifest.v1",
  manifest_id = "manifest:fj-census-religion:fj:2007:fbos-province",
  dataset_id = "fj-census-religion:fj:2007:fbos-province",
  dataset_version_id = paste0("fj-census-religion:fj:2007:fbos-province:", dataset_hash),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "fj-census-religion", dataset_role = "public_product",
  scope = list(level = "country", country_codes = list("FJ"), snapshot_date = NULL, snapshot_anchor = NULL, pipeline_stage = "public"),
  created_at = stamp, created_by = script_id,
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation",
      shipped_wave = 2007L, shipped_geography = "15 provinces",
      source_table = "Table P01-3 (all-ethnicity table), RELIGION by Province of Enumeration margin",
      ethnicity_handling = "The source crosses religion with ethnicity (Fijians and Indians tables). Only the all-ethnicity religion-by-province margin is extracted; the ethnicity dimension is out of scope.",
      denominator = "province Total from Table P01-3; an unprinted not-stated residual remains in the denominator and outside both headline numerators",
      not_stated_rule = "not_stated = province Total minus the six printed religion categories; the source prints no not-stated row",
      top_categories = as.list(top_categories),
      affiliation_categories = as.list(affiliation_categories),
      province_aliases = list(`Nadroga/Navosa` = "Nadroga-Navosa"),
      boundary_simplification = boundary_result[["simplification"]],
      change_rule = "religious_change withheld because only the 2007 province wave ships",
      local_cache_hint = "All raw sources are cached under data/raw/fj_census/ and remain git-ignored.",
      retrieval_record = raw_sources,
      validation_details = list(
        printed_row_reconciliation = list(
          status = "passed",
          christian_subcategory_gate = "18 Christian sub-denominations sum to the Christian total in all 16 columns",
          christian_subcategory_count = length(christian_subcategories),
          top_level_category_count = length(top_categories)
        ),
        local_to_national_reconciliation = list(
          status = "passed", province_rows = 15L,
          exact_fields = c(list("Total"), as.list(top_categories))
        ),
        national_2007 = list(
          denominator = national_total, religious_affiliation_count = national_affiliation,
          no_religion_count = national_no_religion, not_stated_count = national_not_stated,
          category_totals = national_category_totals,
          not_stated_by_province = setNames(as.list(as.integer(parsed[["not_stated"]][2:16])), province_order)
        ),
        join_coverage = list(matched_province_rows = 15L, expected_province_rows = 15L, unmatched_province_rows = list(), unused_boundary_features = list()),
        boundary_validation = list(
          source_geometry = boundary_result[["source_validation"]], simplified_geometry = boundary_result[["simplified_validation"]],
          simplified_geometry_contiguous_frame = boundary_result[["shifted_validation"]],
          wgs84_frame = boundary_result[["wgs84_validation"]],
          licence_metadata_status = "passed", licence = boundary_metadata[["boundaryLicense"]], release_source = boundary_metadata[["boundarySource"]]
        ),
        provenance = list(status = "passed", cached_input_count = length(raw_sources), cached_inputs_with_sha256 = length(raw_sources))
      ),
      construct_notes = list(
        "The construct is census affiliation. It does not measure practice, attendance, or registered membership.",
        "The source publishes religion-by-ethnicity tables; this product ships the all-ethnicity religion-by-province margin only.",
        "Religious affiliation counts Christian, Hindu, Sikh, Moslem, and Other religion; No religion is the no-religion numerator.",
        "The source prints no not-stated row. The residual (Total minus the six categories) is carried in the denominator and outside both headline numerators; the two headline shares therefore do not sum to 100%.",
        "No religious_change field is released because only the 2007 province wave ships."
      ),
      deferred_sources = list(
        list(source_dataset_id = "fbos-census-2017-religion-province", status = "deferred", reason = "The 2017 census collected religion (an official FBoS ArcGIS experience maps population by major religious groups at province level), but the 2017 Release 3 General Tables PDF prints no religion table; no official static province religion table was pinned. Recovery route: the FBoS ArcGIS religion layer or a direct FBoS tabulation request."),
        list(source_dataset_id = "fbos-census-1996-religion-province", status = "not_pinned", reason = "PDH catalogue 237 metadata confirms a 1996 religion variable, but no official aggregate province religion table was pinned. Recovery route: an FBoS 1996 tabulation or the licensed 1996 microdata.")
      ),
      raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/fj_census/")
    ),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")), digest = as.character(packageVersion("digest")),
      pdftotext = trimws(system2("pdftotext", "-v", stdout = TRUE, stderr = TRUE)[[1L]]),
      mapshaper = "scripts/lib/simplify_boundary.R"
    )
  ),
  source = list(
    provider = "Fiji Bureau of Statistics; geoBoundaries; pacificdata.org",
    source_dataset_ids = list(census_dataset_id, boundary_dataset_id),
    source_urls = list(census_url, boundary_meta_url, boundary_url),
    retrieved_at = stamp,
    licence = paste(
      "The Fiji Bureau of Statistics asserts all rights reserved with no explicit reuse grant; the derived aggregate is used for research with attribution and claims no open-data licence.",
      "geoBoundaries FJI ADM2 is CC BY 4.0, verified in release metadata that identifies pacificdata.org as the source."
    ),
    citation = "Fiji Bureau of Statistics, 2007 Census Table P01-3 religion margin; geoBoundaries FJI ADM2."
  ),
  input_manifests = list(),
  durable_files = list(
    manifest_file_record(summary_json_out, "Fiji 2007 province census-affiliation area summary.", "needs_review"),
    manifest_file_record(summary_csv_out, "Flattened Fiji 2007 province census-affiliation rows.", "needs_review"),
    manifest_file_record(boundary_out, "Simplified geoBoundaries FJI ADM2 province geometry.", "needs_review")
  ),
  validation = list(
    status = "passed", commands = list(
      "Rscript scripts/build_fj_area_summary.R",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/fj/data/area_summary_province.json",
      "jq empty docs/manifests/fj-census-religion-2007.json"
    ),
    notes = paste(
      "The 18 printed Christian sub-denominations sum exactly to the Christian total in all 16 columns.",
      "The 15 provinces sum exactly to the national column for Total and each of the six religion categories.",
      "The province-boundary join is 15/15. Source and simplified geometry validity, distinct-hash, overlap, interior-gap, sliver, and provenance gates passed,",
      "with the simplified gates run in both the -180..180 output frame and the contiguous 0..360 frame.",
      "The WGS84-frame gate passed: every coordinate lies within [-180, 180], no ring crosses the antimeridian, and every feature's dateline-aware longitudinal extent is below 180 degrees."
    ), warnings = list(
      "Only the 2007 wave ships; no religious-change field is released. An unprinted not-stated residual is retained in the denominator.",
      "FBoS asserts all rights reserved with no explicit reuse grant; the product is staged with licence_status needs_review until FBoS reuse terms are resolved."
    )
  ),
  stats = list(province_year_rows = 15L, province_count = 15L, shipped_wave_count = 1L, distinct_geometry_hashes = 15L),
  privacy = "public", licence_status = "needs_review", downstream_status = "staged",
  notes = "The derived product uses FBoS census aggregates for a research map with attribution; FBoS asserts all rights reserved with no explicit reuse grant, and the product stays staged with licence_status needs_review until FBoS reuse terms are resolved. Only the all-ethnicity religion margin ships; the ethnicity dimension is out of scope. The map UI is outside this build."
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

cat("waves shipped: 2007 only; 1996 and 2017 province religion routes deferred\n")
cat("geography: 15 provinces joined one-to-one to geoBoundaries FJI ADM2 (2020)\n")
cat(sprintf("row gate: passed; 18 Christian sub-denominations close in all 16 columns; %d top-level categories\n", length(top_categories)))
cat(sprintf("local-to-national gate: passed; 15 provinces sum exactly for %d fields\n", length(top_categories) + 1L))
cat(sprintf("denominator: national Total=%d; affiliation=%d; no religion=%d; not stated retained in denominator=%d\n",
            national_total, national_affiliation, national_no_religion, national_not_stated))
cat(sprintf("join gate: passed; 15/15 provinces; geometry gate: passed; 15 valid distinct features, overlap %.6f sq m (output frame) / %.6f sq m (contiguous frame), 0 interior gaps, 0 sub-1-sq-km slivers\n",
            boundary_result[["simplified_validation"]][["overlap_sq_m"]],
            boundary_result[["shifted_validation"]][["overlap_sq_m"]]))
cat(sprintf("wgs84 frame gate: passed; all coordinates within [-180, 180]; max ring consecutive lon jump %.4f deg; max feature dateline-aware lon extent %.4f deg\n",
            boundary_result[["wgs84_validation"]][["max_ring_consecutive_lon_jump_deg"]],
            boundary_result[["wgs84_validation"]][["max_feature_dateline_aware_lon_extent_deg"]]))
cat(sprintf("boundary size gate: passed; %d bytes with %s at %g%% keep\n", file_bytes(boundary_out),
            boundary_result[["simplification"]][["method"]], boundary_result[["simplification"]][["keep_percent"]]))
cat(sprintf("provenance gate: passed; %d/%d cached inputs record SHA-256\n", length(raw_sources), length(raw_sources)))
cat("licence gate: staged with needs_review; FBoS all rights reserved with no explicit reuse grant; derived aggregate used for research with attribution; boundary CC BY 4.0\n")
cat("ethnicity gate: passed; only the all-ethnicity religion margin ships; religion-by-ethnicity cross-tabs withheld\n")
cat("change gate: passed by withholding; no cross-wave province change metric is released\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", boundary_out))
cat(sprintf("wrote %s\n", manifest_out))
