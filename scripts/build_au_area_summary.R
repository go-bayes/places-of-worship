# build the australia SA2 area-summary product from ABS Census GCP G14.
# inputs: data/raw/au_census ABS DataPack and ASGS boundary zip files.
# outputs: apps/regions/au/data/area_summary_sa2.{json,csv},
# apps/regions/au/data/sa2_2021.geojson, and
# docs/manifests/au-census-religion-2021.json.
# run from the repo root: Rscript scripts/build_au_area_summary.R

suppressMessages({
  library(sf)
  library(jsonlite)
})

repo_root <- normalizePath(
  if (basename(getwd()) == "scripts") ".." else ".",
  mustWork = TRUE
)

raw_dir_rel <- "data/raw/au_census"
au_dir_rel <- "apps/regions/au/data"
manifest_dir_rel <- "docs/manifests"

raw_dir <- file.path(repo_root, raw_dir_rel)
au_dir <- file.path(repo_root, au_dir_rel)
manifest_dir <- file.path(repo_root, manifest_dir_rel)
dir.create(au_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- "2026-07-07"

census_dataset_id <- "abs-2021-gcp-g14-sa2-aus"
state_validation_dataset_id <- "abs-2021-gcp-g14-ste-aus"
national_validation_dataset_id <- "abs-2021-gcp-g14-aus-aus"
boundary_dataset_id <- "abs-asgs-ed3-sa2-2021-gda2020"
boundary_set_id <- "au-sa2-2021-asgs-ed3"

census_sa2_zip <- "2021_GCP_SA2_for_AUS_short-header.zip"
census_ste_zip <- "2021_GCP_STE_for_AUS_short-header.zip"
census_aus_zip <- "2021_GCP_AUS_for_AUS_short-header.zip"
boundary_zip <- "SA2_2021_AUST_SHP_GDA2020.zip"
sources_csv_rel <- file.path(raw_dir_rel, "sources.csv")
sources_csv <- file.path(repo_root, sources_csv_rel)

census_sa2_url <- paste0(
  "https://www.abs.gov.au/census/find-census-data/datapacks/download/",
  census_sa2_zip
)
census_ste_url <- paste0(
  "https://www.abs.gov.au/census/find-census-data/datapacks/download/",
  census_ste_zip
)
census_aus_url <- paste0(
  "https://www.abs.gov.au/census/find-census-data/datapacks/download/",
  census_aus_zip
)
boundary_url <- paste0(
  "https://www.abs.gov.au/statistics/standards/",
  "australian-statistical-geography-standard-asgs/",
  "edition-3-july-2021-june-2026/access-and-downloads/",
  "digital-boundary-files/",
  boundary_zip
)
correspondence_url <- paste0(
  "https://www.abs.gov.au/statistics/standards/",
  "australian-statistical-geography-standard-asgs/",
  "edition-3-july-2021-june-2026/access-and-downloads/correspondences"
)
abs_copyright_url <- "https://www.abs.gov.au/website-privacy-copyright-and-disclaimer"
cc_by_url <- "https://creativecommons.org/licenses/by/4.0/"

sa2_zip_path <- file.path(raw_dir, census_sa2_zip)
ste_zip_path <- file.path(raw_dir, census_ste_zip)
aus_zip_path <- file.path(raw_dir, census_aus_zip)
boundary_zip_path <- file.path(raw_dir, boundary_zip)

boundary_out_rel <- file.path(au_dir_rel, "sa2_2021.geojson")
summary_json_out_rel <- file.path(au_dir_rel, "area_summary_sa2.json")
summary_csv_out_rel <- file.path(au_dir_rel, "area_summary_sa2.csv")
manifest_out_rel <- file.path(manifest_dir_rel, "au-census-religion-2021.json")

boundary_out <- file.path(repo_root, boundary_out_rel)
summary_json_out <- file.path(repo_root, summary_json_out_rel)
summary_csv_out <- file.path(repo_root, summary_csv_out_rel)
manifest_out <- file.path(repo_root, manifest_out_rel)

boundary_tolerance_floor_m <- 40
boundary_tolerance_cap_m <- 1500
boundary_tolerance_base_factor <- 0.008
boundary_tolerance_scale <- 1.3
boundary_max_simplification_iterations <- 4L
boundary_coordinate_precision <- 4L
boundary_size_budget_bytes <- 4 * 1024 * 1024
boundary_ring_guard_min_points <- 8L

population_total_basis <- paste(
  "people counted at place of usual residence with a stated",
  "religious-affiliation response (ABS G14 Total Persons minus",
  "Religious affiliation not stated, which comprises Not stated and",
  "Inadequately described)"
)

# independent small random adjustment across about 2.5k sa2s and 9 ste units makes residuals of this order expected; observed 100 state / 198 national.
perturbation_residual_bound <- 500L

# stop early if a required raw source has not been downloaded.
require_file <- function(path) {
  if (!file.exists(path)) stop("missing required source: ", path, call. = FALSE)
}

# compute the sha-256 digest for a local file.
sha256_file <- function(path) {
  unname(tools::sha256sum(path))
}

# return file size in bytes for generated-output records.
file_bytes <- function(path) {
  unname(file.info(path)[["size"]])
}

# count data rows or features for manifest and QA records.
row_count_file <- function(path) {
  if (grepl("[.]csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("[.]geojson$", path)) {
    geo <- fromJSON(path, simplifyVector = FALSE)
    return(length(geo[["features"]]))
  }
  if (grepl("[.]json$", path)) {
    json <- fromJSON(path, simplifyVector = FALSE)
    if (!is.null(json[["rows"]])) return(length(json[["rows"]]))
  }
  NA_integer_
}

# read one csv member from an ABS DataPack zip as character columns.
read_zip_csv <- function(zip_path, inner_path) {
  listing <- utils::unzip(zip_path, list = TRUE)
  if (!inner_path %in% listing[["Name"]]) {
    stop("zip member not found: ", inner_path, call. = FALSE)
  }
  read.csv(
    unz(zip_path, inner_path),
    stringsAsFactors = FALSE,
    check.names = FALSE,
    colClasses = "character"
  )
}

# coerce an ABS count column while keeping missing values explicit.
numeric_column <- function(data, column) {
  if (!column %in% names(data)) stop("missing column: ", column, call. = FALSE)
  suppressWarnings(as.numeric(gsub(",", "", data[[column]], fixed = TRUE)))
}

# extract the headline religion counts used by the public map.
count_components <- function(data, code_col, name_col = NULL) {
  required <- c(
    code_col, "Tot_P", "Religious_affiliation_ns_P", "SB_OSB_NRA_Tot_P"
  )
  missing <- setdiff(required, names(data))
  if (length(missing) > 0) {
    stop("missing required ABS G14 columns: ", paste(missing, collapse = ", "), call. = FALSE)
  }

  total <- numeric_column(data, "Tot_P")
  not_stated <- numeric_column(data, "Religious_affiliation_ns_P")
  no_religion <- numeric_column(data, "SB_OSB_NRA_Tot_P")
  stated <- total - not_stated
  religious_affiliation <- stated - no_religion

  data.frame(
    code = data[[code_col]],
    name = if (is.null(name_col) || !name_col %in% names(data)) {
      rep(NA_character_, nrow(data))
    } else {
      data[[name_col]]
    },
    total = total,
    not_stated = not_stated,
    stated = stated,
    no_religion = no_religion,
    religious_affiliation = religious_affiliation,
    stringsAsFactors = FALSE
  )
}

# build one public area-summary row from joined census and boundary data.
build_area_row <- function(row) {
  population_total <- as.integer(round(row[["stated"]]))
  no_religion_count <- as.integer(round(row[["no_religion"]]))
  religious_affiliation_count <- as.integer(round(row[["religious_affiliation"]]))

  list(
    country_code = "AU",
    boundary_set_id = boundary_set_id,
    boundary_level = "sa2",
    area_unit_id = paste0(boundary_set_id, ":", row[["area_code"]]),
    area_code = row[["area_code"]],
    area_name = row[["area_name"]],
    year = 2021L,
    population_total = population_total,
    population_total_basis = population_total_basis,
    religious_affiliation_count = religious_affiliation_count,
    religious_affiliation_percent = if (population_total > 0) {
      round(100 * religious_affiliation_count / population_total, 2)
    } else {
      NA_real_
    },
    no_religion_count = no_religion_count,
    no_religion_percent = if (population_total > 0) {
      round(100 * no_religion_count / population_total, 2)
    } else {
      NA_real_
    },
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(as.numeric(row[["land_area_sq_km"]]), 2),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = c(census_dataset_id, boundary_dataset_id),
    quality_flag = ""
  )
}

# flatten area-summary rows for the csv sibling.
flatten_rows <- function(rows) {
  do.call(rbind, lapply(rows, function(row) {
    data.frame(
      country_code = row[["country_code"]],
      boundary_set_id = row[["boundary_set_id"]],
      boundary_level = row[["boundary_level"]],
      area_unit_id = row[["area_unit_id"]],
      area_code = row[["area_code"]],
      area_name = row[["area_name"]],
      year = row[["year"]],
      population_total = row[["population_total"]],
      population_total_basis = row[["population_total_basis"]],
      religious_affiliation_count = row[["religious_affiliation_count"]],
      religious_affiliation_percent = row[["religious_affiliation_percent"]],
      no_religion_count = row[["no_religion_count"]],
      no_religion_percent = row[["no_religion_percent"]],
      place_count = NA_integer_,
      places_per_10000_residents = NA_real_,
      place_density_per_sq_km = NA_real_,
      land_area_sq_km = row[["land_area_sq_km"]],
      site_snapshot_date = NA,
      place_count_basis = NA,
      source_dataset_ids = paste(row[["source_dataset_ids"]], collapse = "|"),
      quality_flag = row[["quality_flag"]],
      stringsAsFactors = FALSE
    )
  }))
}

# create a schema-valid durable-file record for a generated output.
manifest_file_record <- function(rel_path, abs_path, content, row_count = NULL, feature_count = NULL) {
  list(
    uri = paste0("repo:", rel_path),
    storage_provider = "other",
    format = sub("^.*[.]", "", rel_path),
    bytes = file_bytes(abs_path),
    sha256 = sha256_file(abs_path),
    row_count = row_count,
    feature_count = feature_count,
    content = content,
    privacy = "public",
    licence_status = "accepted"
  )
}

# aggregate count components to state or national validation units.
aggregate_components <- function(data, group_col) {
  metrics <- c(
    "total", "not_stated", "stated", "no_religion", "religious_affiliation"
  )
  stats::aggregate(data[metrics], by = list(code = data[[group_col]]), FUN = sum)
}

# compare derived sums with a source-level ABS G14 total row.
compare_components <- function(source_row, derived_row, label) {
  metrics <- c("total", "not_stated", "stated", "no_religion", "religious_affiliation")
  differences <- lapply(metrics, function(metric) {
    source_value <- as.integer(round(source_row[[metric]]))
    derived_value <- as.integer(round(derived_row[[metric]]))
    list(
      metric = metric,
      source_total = source_value,
      derived_sum = derived_value,
      difference = derived_value - source_value
    )
  })
  max_abs_difference <- max(abs(vapply(differences, function(item) item[["difference"]], integer(1))))
  list(
    label = label,
    code = source_row[["code"]],
    name = source_row[["name"]],
    status = if (max_abs_difference == 0) "exact" else "difference_recorded",
    max_abs_difference = max_abs_difference,
    differences = differences
  )
}

# compare all available ABS source rows at one level with SA2-derived sums.
compare_level <- function(source_counts, derived_counts, label) {
  lapply(seq_len(nrow(source_counts)), function(index) {
    source_row <- as.list(source_counts[index, ])
    derived_match <- derived_counts[derived_counts[["code"]] == source_row[["code"]], , drop = FALSE]
    if (nrow(derived_match) != 1) {
      stop("missing derived validation row for ", label, " ", source_row[["code"]], call. = FALSE)
    }
    compare_components(source_row, as.list(derived_match[1, ]), label)
  })
}

# return the largest reconciliation difference in a validation record list.
max_validation_difference <- function(validation_records) {
  max(vapply(validation_records, function(item) item[["max_abs_difference"]], integer(1)))
}

# summarise a validation record list in one manifest-note line.
validation_note_line <- function(year, level, validation_records) {
  statuses <- unique(vapply(validation_records, function(item) item[["status"]], character(1)))
  paste0(
    year, " ", level, " G14 reconciliation: ", paste(statuses, collapse = "/"),
    "; units=", length(validation_records),
    "; max_abs_difference=", max_validation_difference(validation_records)
  )
}

# write the ignored raw-source ledger required for the launch.
write_sources_ledger <- function() {
  datapack_licence <- paste(
    "ABS DataPacks are licensed under Creative Commons Attribution 4.0;",
    "ABS data used with permission from the Australian Bureau of Statistics;",
    "follow ABS website copyright terms."
  )
  boundary_licence <- paste(
    "ASGS boundary files are credited to the Australian Bureau of Statistics;",
    "ABS data used with permission from the Australian Bureau of Statistics;",
    "follow ABS website copyright terms."
  )
  source_rows <- data.frame(
    filename = c(census_sa2_zip, census_ste_zip, census_aus_zip, boundary_zip),
    url = c(census_sa2_url, census_ste_url, census_aus_url, boundary_url),
    retrieval_date = retrieval_date,
    publisher = "Australian Bureau of Statistics",
    licence_text = c(rep(datapack_licence, 3), boundary_licence),
    sha256 = vapply(
      file.path(raw_dir, c(census_sa2_zip, census_ste_zip, census_aus_zip, boundary_zip)),
      sha256_file,
      character(1)
    ),
    stringsAsFactors = FALSE
  )
  write.csv(source_rows, sources_csv, row.names = FALSE, na = "")
  source_rows
}

# return the current git commit for manifest lineage.
current_git_commit <- function() {
  commit <- tryCatch(
    system("git rev-parse --short HEAD", intern = TRUE),
    error = function(error) character(0)
  )
  if (length(commit) == 0 || is.na(commit[[1]]) || !nzchar(commit[[1]])) {
    stop("could not determine git commit for manifest", call. = FALSE)
  }
  commit[[1]]
}

# return per-feature simplification tolerances from projected feature areas.
boundary_tolerances <- function(boundary_sf, factor) {
  pmin(
    boundary_tolerance_cap_m,
    pmax(
      boundary_tolerance_floor_m,
      factor * sqrt(as.numeric(st_area(st_geometry(boundary_sf))))
    )
  )
}

# simplify one feature, lowering tolerance only to satisfy the ring guard.
simplify_boundary_geometry <- function(geometry, crs, tolerance) {
  adjusted_tolerance <- tolerance
  for (attempt in seq_len(8L)) {
    candidate <- st_simplify(
      st_sfc(geometry, crs = crs),
      dTolerance = adjusted_tolerance,
      preserveTopology = TRUE
    )[[1]]
    point_count <- largest_outer_ring_point_count(candidate, crs = crs)
    if (is.na(point_count) || point_count >= boundary_ring_guard_min_points) {
      return(list(
        geometry = candidate,
        tolerance = adjusted_tolerance,
        guard_adjusted = adjusted_tolerance < tolerance
      ))
    }
    adjusted_tolerance <- adjusted_tolerance / 2
  }

  list(
    geometry = geometry,
    tolerance = 0,
    guard_adjusted = TRUE
  )
}

# simplify projected boundary geometries with each feature's own tolerance.
simplify_boundary <- function(boundary_sf, factor) {
  initial_tolerances <- boundary_tolerances(boundary_sf, factor)
  crs <- st_crs(boundary_sf)
  simplified <- lapply(seq_along(initial_tolerances), function(index) {
    simplify_boundary_geometry(
      st_geometry(boundary_sf)[[index]],
      crs,
      initial_tolerances[[index]]
    )
  })
  simplified_geometry <- st_sfc(
    lapply(simplified, function(item) item[["geometry"]]),
    crs = crs
  )
  st_geometry(boundary_sf) <- simplified_geometry

  list(
    boundary = boundary_sf,
    initial_tolerances = initial_tolerances,
    final_tolerances = vapply(simplified, function(item) item[["tolerance"]], numeric(1)),
    guard_adjusted = vapply(simplified, function(item) item[["guard_adjusted"]], logical(1))
  )
}

# write the smallest area-scaled boundary that meets the file-size budget.
write_simplified_boundary <- function(boundary_sf, output_path) {
  result <- NULL
  for (iteration in seq_len(boundary_max_simplification_iterations)) {
    factor <- boundary_tolerance_base_factor * boundary_tolerance_scale^(iteration - 1L)
    simplified <- simplify_boundary(boundary_sf, factor)
    candidate <- st_transform(simplified[["boundary"]], 4326)
    st_write(
      candidate,
      output_path,
      layer_options = paste0("COORDINATE_PRECISION=", boundary_coordinate_precision),
      delete_dsn = TRUE,
      quiet = TRUE
    )

    result <- list(
      factor = factor,
      iteration = iteration,
      initial_tolerances = simplified[["initial_tolerances"]],
      final_tolerances = simplified[["final_tolerances"]],
      guard_adjusted_features = sum(simplified[["guard_adjusted"]]),
      bytes = file_bytes(output_path)
    )
    if (result[["bytes"]] <= boundary_size_budget_bytes) return(result)
  }

  stop(
    "boundary output remains above 4 MB after maximum area-scaled simplification iterations",
    call. = FALSE
  )
}

# count points in the largest polygon's outer ring for one geometry.
largest_outer_ring_point_count <- function(geometry, crs = 4326) {
  if (st_is_empty(geometry)) return(NA_integer_)
  geometry_type <- as.character(st_geometry_type(geometry))
  polygons <- if (geometry_type == "POLYGON") {
    list(geometry)
  } else if (geometry_type == "MULTIPOLYGON") {
    lapply(geometry, st_polygon)
  } else {
    extracted <- suppressWarnings(
      st_cast(st_collection_extract(st_sfc(geometry, crs = crs), "POLYGON"), "POLYGON")
    )
    lapply(seq_along(extracted), function(index) extracted[[index]])
  }
  if (length(polygons) == 0) return(NA_integer_)

  polygon_sfc <- do.call(st_sfc, c(polygons, list(crs = crs)))
  polygon_areas <- as.numeric(st_area(st_transform(polygon_sfc, 3577)))
  largest_polygon <- polygon_sfc[[which.max(polygon_areas)]]
  nrow(largest_polygon[[1]])
}

# read back the boundary product and stop if real SA2s are over-simplified.
validate_boundary_ring_points <- function(path) {
  boundary_geojson <- st_read(path, quiet = TRUE)
  geometry <- st_geometry(boundary_geojson)
  non_empty <- !st_is_empty(geometry)
  special_code <- grepl("^Z+$", boundary_geojson[["area_code"]])
  real_feature <- non_empty & !special_code
  point_counts <- vapply(geometry, largest_outer_ring_point_count, integer(1))
  real_point_counts <- point_counts[real_feature]

  if (any(real_point_counts < boundary_ring_guard_min_points, na.rm = TRUE)) {
    failed_codes <- boundary_geojson[["area_code"]][real_feature][
      real_point_counts < boundary_ring_guard_min_points
    ]
    stop(
      paste(
        "simplified boundary outer-ring guard failed:",
        length(failed_codes),
        "real SA2 features have fewer than",
        boundary_ring_guard_min_points,
        "points in the largest polygon outer ring; examples:",
        paste(head(failed_codes, 10), collapse = ", ")
      ),
      call. = FALSE
    )
  }

  list(
    min = min(real_point_counts, na.rm = TRUE),
    median = stats::median(real_point_counts, na.rm = TRUE),
    max = max(real_point_counts, na.rm = TRUE),
    below_12 = sum(real_point_counts < 12, na.rm = TRUE),
    guard_minimum = boundary_ring_guard_min_points
  )
}

require_file(sa2_zip_path)
require_file(ste_zip_path)
require_file(aus_zip_path)
require_file(boundary_zip_path)
source_ledger <- write_sources_ledger()

sa2_g14 <- read_zip_csv(
  sa2_zip_path,
  "2021 Census GCP Statistical Area 2 for AUS/2021Census_G14_AUST_SA2.csv"
)
ste_g14 <- read_zip_csv(
  ste_zip_path,
  "2021 Census GCP States and Territories for AUS/2021Census_G14_AUST_STE.csv"
)
aus_g14 <- read_zip_csv(
  aus_zip_path,
  "2021 Census GCP Australia for AUS/2021Census_G14_AUS_AUS.csv"
)

boundary_tmp <- tempfile("au_sa2_boundary_")
dir.create(boundary_tmp)
utils::unzip(boundary_zip_path, exdir = boundary_tmp)
boundary_shp <- list.files(boundary_tmp, pattern = "[.]shp$", full.names = TRUE)
if (length(boundary_shp) != 1) stop("expected one shapefile in boundary zip", call. = FALSE)
boundary <- st_read(boundary_shp, quiet = TRUE)

sa2_counts <- count_components(sa2_g14, "SA2_CODE_2021")
state_counts <- count_components(ste_g14, "STE_CODE_2021", "STE_NAME_2021")
national_counts <- count_components(aus_g14, "AUS_CODE_2021")

boundary_lookup <- data.frame(
  area_code = boundary[["SA2_CODE21"]],
  area_name = boundary[["SA2_NAME21"]],
  state_code = boundary[["STE_CODE21"]],
  state_name = boundary[["STE_NAME21"]],
  land_area_sq_km = as.numeric(boundary[["AREASQKM21"]]),
  stringsAsFactors = FALSE
)
state_name_lookup <- unique(boundary_lookup[c("state_code", "state_name")])
state_counts[["name"]] <- state_name_lookup[["state_name"]][match(
  state_counts[["code"]],
  state_name_lookup[["state_code"]]
)]
national_counts[["name"]] <- "Australia"

match_index <- match(boundary_lookup[["area_code"]], sa2_counts[["code"]])
missing_census_codes <- boundary_lookup[["area_code"]][is.na(match_index)]
missing_boundary_codes <- sa2_counts[["code"]][is.na(match(sa2_counts[["code"]], boundary_lookup[["area_code"]]))]
if (length(missing_boundary_codes) > 0 ||
    length(setdiff(missing_census_codes, "ZZZZZZZZZ")) > 0) {
  stop("SA2 census/boundary join is incomplete", call. = FALSE)
}
matched_boundary_rows <- !is.na(match_index)
join_matched_count <- length(intersect(sa2_counts[["code"]], boundary_lookup[["area_code"]]))

joined <- cbind(
  boundary_lookup[matched_boundary_rows, ],
  sa2_counts[match_index[matched_boundary_rows], setdiff(names(sa2_counts), c("code", "name"))]
)
joined[["code"]] <- joined[["area_code"]]

rows <- lapply(seq_len(nrow(joined)), function(index) build_area_row(as.list(joined[index, ])))

source_datasets <- list(
  list(
    source_dataset_id = census_dataset_id,
    name = "2021 Census General Community Profile DataPack G14, SA2, Australia",
    provider = "Australian Bureau of Statistics",
    url = census_sa2_url,
    retrieval_date = retrieval_date,
    local_path = file.path(raw_dir_rel, census_sa2_zip),
    licence = list(
      name = "Creative Commons Attribution 4.0, subject to ABS website copyright terms",
      url = abs_copyright_url,
      attribution = "Australian Bureau of Statistics; ABS data used with permission from the Australian Bureau of Statistics"
    ),
    citation = "Australian Bureau of Statistics. 2021 Census General Community Profile DataPack, table G14, Statistical Area 2 for Australia.",
    access_limits = NULL,
    redistribution_limits = "Attribute the Australian Bureau of Statistics and retain ABS website copyright context.",
    notes = paste(
      "Public metrics retain only headline stated-response aggregates.",
      "No-religion count uses SB_OSB_NRA_Tot_P, the ABS top-level",
      "Secular Beliefs and Other Spiritual Beliefs and No Religious Affiliation total."
    )
  ),
  list(
    source_dataset_id = state_validation_dataset_id,
    name = "2021 Census General Community Profile DataPack G14, states and territories, Australia",
    provider = "Australian Bureau of Statistics",
    url = census_ste_url,
    retrieval_date = retrieval_date,
    local_path = file.path(raw_dir_rel, census_ste_zip),
    licence = list(
      name = "Creative Commons Attribution 4.0, subject to ABS website copyright terms",
      url = abs_copyright_url,
      attribution = "Australian Bureau of Statistics"
    ),
    citation = "Australian Bureau of Statistics. 2021 Census General Community Profile DataPack, table G14, states and territories for Australia.",
    access_limits = NULL,
    redistribution_limits = "Validation source only; raw zip remains in the ignored local cache.",
    notes = "Used to validate each state and territory G14 total against sums of SA2 rows."
  ),
  list(
    source_dataset_id = national_validation_dataset_id,
    name = "2021 Census General Community Profile DataPack G14, Australia",
    provider = "Australian Bureau of Statistics",
    url = census_aus_url,
    retrieval_date = retrieval_date,
    local_path = file.path(raw_dir_rel, census_aus_zip),
    licence = list(
      name = "Creative Commons Attribution 4.0, subject to ABS website copyright terms",
      url = abs_copyright_url,
      attribution = "Australian Bureau of Statistics"
    ),
    citation = "Australian Bureau of Statistics. 2021 Census General Community Profile DataPack, table G14, Australia.",
    access_limits = NULL,
    redistribution_limits = "Validation source only; raw zip remains in the ignored local cache.",
    notes = "Used to validate the national G14 total against sums of SA2 rows."
  ),
  list(
    source_dataset_id = boundary_dataset_id,
    name = "ASGS Edition 3 Statistical Area Level 2 2021 digital boundary file, GDA2020",
    provider = "Australian Bureau of Statistics",
    url = boundary_url,
    retrieval_date = retrieval_date,
    local_path = file.path(raw_dir_rel, boundary_zip),
    licence = list(
      name = "ABS website copyright terms",
      url = abs_copyright_url,
      attribution = "Australian Bureau of Statistics, Australian Statistical Geography Standard (ASGS) Edition 3"
    ),
    citation = "Australian Bureau of Statistics. Australian Statistical Geography Standard (ASGS) Edition 3, Statistical Area Level 2 2021 digital boundary file, GDA2020.",
    access_limits = NULL,
    redistribution_limits = "Attribute the Australian Bureau of Statistics and ASGS boundary source.",
    notes = "The public GeoJSON is simplified from the official ASGS Edition 3 SA2 shapefile."
  )
)

indicators <- list(
  list(
    indicator_id = "population_total",
    label = "Religion-response denominator",
    description = "People counted at place of usual residence with a stated religious-affiliation response in the SA2 and census year.",
    unit = "count",
    denominator_indicator_id = NULL,
    method = "ABS G14 Total Persons minus Religious affiliation not stated.",
    temporal_coverage = "2021",
    spatial_coverage = "Australia ASGS Edition 3 Statistical Area Level 2.",
    quality_notes = "The religious-affiliation question is voluntary. The denominator excludes the ABS not-stated field, which comprises Not stated and Inadequately described."
  ),
  list(
    indicator_id = "religious_affiliation_percent",
    label = "Religious affiliation %",
    description = "Share of the stated-response denominator reporting any stated religious affiliation.",
    unit = "percent",
    denominator_indicator_id = "population_total",
    method = "100 * (Total Persons - Religious affiliation not stated - SB_OSB_NRA_Tot_P) / (Total Persons - Religious affiliation not stated).",
    temporal_coverage = "2021",
    spatial_coverage = "Australia ASGS Edition 3 Statistical Area Level 2.",
    quality_notes = "The public product uses a headline affiliation/no-religion split, not the detailed ABS G14 religion categories."
  ),
  list(
    indicator_id = "no_religion_percent",
    label = "No religion %",
    description = "Share of the stated-response denominator in the ABS top-level non-religion and no-religious-affiliation category.",
    unit = "percent",
    denominator_indicator_id = "population_total",
    method = "100 * SB_OSB_NRA_Tot_P / (Total Persons - Religious affiliation not stated).",
    temporal_coverage = "2021",
    spatial_coverage = "Australia ASGS Edition 3 Statistical Area Level 2.",
    quality_notes = "SB_OSB_NRA_Tot_P includes the ABS top-level Secular Beliefs and Other Spiritual Beliefs and No Religious Affiliation total, not only No Religion, so described."
  )
)

visual_layers <- list(
  list(
    visual_layer_id = "au-sa2-religious-affiliation-percent",
    label = "Religious affiliation %",
    description = "SA2 choropleth of religious-affiliation percentage.",
    layer_type = "choropleth",
    indicator_ids = I(c("religious_affiliation_percent")),
    geometry_unit_type = "area_unit",
    legend = list(unit = "percent", denominator = "stated religious-affiliation response"),
    colour_scale = "sequential",
    time_control = "year_selector",
    aggregation_rule = "precomputed by SA2 reporting unit and census year",
    uncertainty_display = "quality_flag",
    default_visibility = TRUE,
    notes = NULL
  ),
  list(
    visual_layer_id = "au-sa2-no-religion-percent",
    label = "No religion %",
    description = "SA2 choropleth of no-religion and no-religious-affiliation percentage.",
    layer_type = "choropleth",
    indicator_ids = I(c("no_religion_percent")),
    geometry_unit_type = "area_unit",
    legend = list(unit = "percent", denominator = "stated religious-affiliation response"),
    colour_scale = "sequential",
    time_control = "year_selector",
    aggregation_rule = "precomputed by SA2 reporting unit and census year",
    uncertainty_display = "quality_flag",
    default_visibility = FALSE,
    notes = NULL
  )
)

summary <- list(
  schema_version = "0.1.0",
  generated_at = stamp,
  generated_by = "scripts/build_au_area_summary.R",
  country_code = "AU",
  boundary_set = list(
    boundary_set_id = boundary_set_id,
    country_code = "AU",
    level = "sa2",
    vintage = "ASGS Edition 3 2021, GDA2020",
    source_dataset_id = boundary_dataset_id
  ),
  site_snapshot = list(
    source_dataset_id = NULL,
    snapshot_date = NULL,
    basis = "no Australia place-of-worship snapshot is included in this country data-map release",
    notes = "The Australia page exposes 2021 census affiliation and no-religion metrics only; place-density metrics are hidden until a governed Australia place layer is built."
  ),
  source_datasets = source_datasets,
  indicators = indicators,
  visual_layers = visual_layers,
  rows = rows
)

write(toJSON(summary, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null"), summary_json_out)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

boundary_export <- boundary[c(
  "SA2_CODE21", "SA2_NAME21", "STE_CODE21", "STE_NAME21", "AREASQKM21"
)]
boundary_export <- st_sf(
  area_code = boundary_export[["SA2_CODE21"]],
  area_name = boundary_export[["SA2_NAME21"]],
  area_unit_id = paste0(boundary_set_id, ":", boundary_export[["SA2_CODE21"]]),
  boundary_set_id = boundary_set_id,
  boundary_level = "sa2",
  state_code = boundary_export[["STE_CODE21"]],
  state_name = boundary_export[["STE_NAME21"]],
  land_area_sq_km = as.numeric(boundary_export[["AREASQKM21"]]),
  geometry = st_geometry(boundary_export)
)
boundary_export <- st_transform(st_make_valid(boundary_export), 3577)

boundary_simplification <- write_simplified_boundary(boundary_export, boundary_out)
boundary_ring_stats <- validate_boundary_ring_points(boundary_out)

sa2_for_validation <- data.frame(
  code = joined[["area_code"]],
  state_code = joined[["state_code"]],
  total = joined[["total"]],
  not_stated = joined[["not_stated"]],
  stated = joined[["stated"]],
  no_religion = joined[["no_religion"]],
  religious_affiliation = joined[["religious_affiliation"]],
  stringsAsFactors = FALSE
)
state_derived <- aggregate_components(sa2_for_validation, "state_code")
national_derived <- data.frame(
  code = "AUS",
  total = sum(sa2_for_validation[["total"]]),
  not_stated = sum(sa2_for_validation[["not_stated"]]),
  stated = sum(sa2_for_validation[["stated"]]),
  no_religion = sum(sa2_for_validation[["no_religion"]]),
  religious_affiliation = sum(sa2_for_validation[["religious_affiliation"]]),
  stringsAsFactors = FALSE
)

state_validation <- compare_level(state_counts, state_derived, "STE")
national_validation <- compare_level(national_counts, national_derived, "AUST")
state_max_difference <- max_validation_difference(state_validation)
national_max_difference <- max_validation_difference(national_validation)
if (state_max_difference > perturbation_residual_bound ||
    national_max_difference > perturbation_residual_bound) {
  stop(
    sprintf(
      "ABS perturbation residual exceeds %d: state max=%d, national max=%d",
      perturbation_residual_bound,
      state_max_difference,
      national_max_difference
    ),
    call. = FALSE
  )
}
validation_status <- if (state_max_difference == 0 && national_max_difference == 0) {
  "passed"
} else {
  "passed_with_warnings"
}

boundary_feature_count <- row_count_file(boundary_out)
boundary_validation_status <- if (nrow(boundary) == 2473 && boundary_feature_count == 2473) {
  "exact"
} else {
  "difference_recorded"
}
if (boundary_feature_count != nrow(boundary)) {
  stop("simplified boundary feature count differs from source boundary count", call. = FALSE)
}

validation_lines <- c(
  paste0(
    "wave 2021 row output: ", length(rows),
    " SA2 rows; join coverage: ", join_matched_count, "/", nrow(sa2_counts),
    " SA2 G14 rows matched ASGS Edition 3 SA2 boundaries on SA2_CODE_2021 to SA2_CODE21;",
    " boundary-only ASGS features without a G14 row: ",
    paste(missing_census_codes, collapse = ", ")
  ),
  validation_note_line(2021, "state and territory", state_validation),
  validation_note_line(2021, "national", national_validation),
  paste(
    "reconciliation differences at these magnitudes are expected under the",
    "ABS small random adjustment (perturbation) applied to all census cells;",
    "SA2, STE, and AUS tables are perturbed independently; their sums",
    "can therefore differ by small amounts and exact zero is unattainable;",
    "acceptance bound is",
    perturbation_residual_bound,
    "persons for both state and national max_abs_difference."
  ),
  paste0(
    "boundary validation: ", boundary_validation_status,
    "; ASGS Edition 3 SA2 source features=2473; simplified GeoJSON features=",
    boundary_feature_count,
    "; bytes=", file_bytes(boundary_out),
    "; area-scaled simplification rule=pmin(",
    boundary_tolerance_cap_m,
    ", pmax(",
    boundary_tolerance_floor_m,
    ", factor * sqrt(st_area_m2))); factor=",
    boundary_simplification[["factor"]],
    "; factor_iteration=",
    boundary_simplification[["iteration"]],
    "; coordinate_precision=",
    boundary_coordinate_precision,
    "; size_budget_bytes=",
    boundary_size_budget_bytes,
    " (relaxed from 3 MB to 4 MB by decision); largest_outer_ring_points min/median/max=",
    boundary_ring_stats[["min"]],
    "/",
    boundary_ring_stats[["median"]],
    "/",
    boundary_ring_stats[["max"]],
    "; features_below_12_points=",
    boundary_ring_stats[["below_12"]],
    "; guard_minimum_points=",
    boundary_ring_stats[["guard_minimum"]],
    "; guard_adjusted_features=",
    boundary_simplification[["guard_adjusted_features"]]
  ),
  paste(
    "deferred waves: 2011 and 2016 were not shipped.",
    "The official ABS SA2 2016 to 2021 correspondence is available at the ASGS Edition 3 correspondence page,",
    "but the official ABS SA2 2011 to 2021 correspondence was not available through the current ABS correspondence page or tested direct ABS paths.",
    "The launch rule forbids constructing a project correspondence."
  ),
  paste(
    "denominator decision: population_total_basis is",
    shQuote(population_total_basis),
    "and follows the NZ/IE convention of using stated religious-affiliation responses."
  ),
  paste(
    "raw-source ledger:",
    sources_csv_rel,
    "records filename, URL, retrieval date, publisher, licence text, and sha256 for the downloaded ABS zips."
  )
)

summary_hash <- substr(sha256_file(summary_json_out), 1, 12)
git_commit <- current_git_commit()

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:au-census-religion:au:2021:gcp-g14-sa2",
  dataset_id = "au-census-religion:au:2021:gcp-g14-sa2",
  dataset_version_id = paste0("au-census-religion:au:2021:gcp-g14-sa2:", summary_hash),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "au-census-religion",
  dataset_role = "public_product",
  scope = list(
    level = "country",
    country_codes = I(c("AU")),
    snapshot_date = NULL,
    snapshot_anchor = NULL,
    pipeline_stage = "public"
  ),
  created_at = stamp,
  created_by = "scripts/build_au_area_summary.R",
  pipeline = list(
    script = "scripts/build_au_area_summary.R",
    git_commit = git_commit,
    command = "Rscript scripts/build_au_area_summary.R",
    parameters = list(
      waves_built = "2021",
      waves_deferred = "2011, 2016",
      boundary_set = boundary_set_id,
      boundary_simplification_rule = list(
        type = "area_scaled_per_feature",
        tolerance_m = "pmin(1500, pmax(40, factor * sqrt(st_area_m2)))",
        tolerance_floor_m = boundary_tolerance_floor_m,
        tolerance_cap_m = boundary_tolerance_cap_m,
        tolerance_factor = boundary_simplification[["factor"]],
        base_tolerance_factor = boundary_tolerance_base_factor,
        factor_iteration = boundary_simplification[["iteration"]],
        factor_scale_on_budget_miss = boundary_tolerance_scale,
        max_factor_iterations = boundary_max_simplification_iterations,
        coordinate_precision = boundary_coordinate_precision,
        size_budget_bytes = boundary_size_budget_bytes,
        ring_guard_minimum_points = boundary_ring_guard_min_points,
        guard_adjusted_features = boundary_simplification[["guard_adjusted_features"]]
      ),
      denominator = population_total_basis,
      no_religion_numerator = "SB_OSB_NRA_Tot_P"
    ),
    software_versions = list(
      r = paste(R.version[["major"]], R.version[["minor"]], sep = "."),
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite"))
    )
  ),
  source = list(
    provider = "Australian Bureau of Statistics",
    source_dataset_ids = I(c(
      census_dataset_id,
      state_validation_dataset_id,
      national_validation_dataset_id,
      boundary_dataset_id
    )),
    source_urls = I(c(
      census_sa2_url,
      census_ste_url,
      census_aus_url,
      boundary_url,
      correspondence_url,
      abs_copyright_url
    )),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = paste(
      "Australian Bureau of Statistics DataPacks are licensed under Creative Commons Attribution 4.0.",
      "ABS data used with permission from the Australian Bureau of Statistics.",
      "ASGS Edition 3 SA2 boundaries are credited to the Australian Bureau of Statistics under ABS website copyright terms."
    ),
    citation = "Australian Bureau of Statistics. 2021 Census General Community Profile DataPacks table G14 and Australian Statistical Geography Standard (ASGS) Edition 3 SA2 2021 digital boundary file."
  ),
  input_manifests = list(),
  durable_files = list(
    manifest_file_record(
      summary_json_out_rel,
      summary_json_out,
      "Australia SA2 area summary with ABS 2021 G14 stated-response religion metrics.",
      row_count = row_count_file(summary_json_out),
      feature_count = NULL
    ),
    manifest_file_record(
      summary_csv_out_rel,
      summary_csv_out,
      "Flattened Australia SA2 area summary with ABS 2021 G14 stated-response religion metrics.",
      row_count = row_count_file(summary_csv_out),
      feature_count = NULL
    ),
    manifest_file_record(
      boundary_out_rel,
      boundary_out,
      "Simplified Australia ASGS Edition 3 SA2 2021 boundary GeoJSON derived from ABS GDA2020 shapefile.",
      row_count = NULL,
      feature_count = boundary_feature_count
    )
  ),
  partitions = list(
    list(
      partition_id = "country:AU",
      partition_type = "country",
      country_code = "AU",
      file_uri = paste0("repo:", summary_json_out_rel),
      sha256 = sha256_file(summary_json_out),
      row_count = row_count_file(summary_json_out),
      feature_count = NULL
    )
  ),
  stats = list(
    waves_built = 1L,
    rows_2021 = length(rows),
    join_matched_rows_2021 = join_matched_count,
    join_expected_rows_2021 = nrow(sa2_counts),
    boundary_only_features_without_g14_2021 = length(missing_census_codes),
    state_validation_units_2021 = length(state_validation),
    state_validation_max_abs_difference_2021 = state_max_difference,
    national_validation_units_2021 = length(national_validation),
    national_validation_max_abs_difference_2021 = national_max_difference,
    boundary_expected_feature_count = 2473L,
    boundary_source_feature_count = nrow(boundary),
    boundary_derived_feature_count = boundary_feature_count,
    boundary_geojson_bytes = file_bytes(boundary_out),
    boundary_simplification_rule = list(
      type = "area_scaled_per_feature",
      tolerance_floor_m = boundary_tolerance_floor_m,
      tolerance_cap_m = boundary_tolerance_cap_m,
      tolerance_factor = boundary_simplification[["factor"]],
      base_tolerance_factor = boundary_tolerance_base_factor,
      factor_iteration = boundary_simplification[["iteration"]],
      factor_scale_on_budget_miss = boundary_tolerance_scale,
      max_factor_iterations = boundary_max_simplification_iterations,
      coordinate_precision = boundary_coordinate_precision,
      size_budget_bytes = boundary_size_budget_bytes,
      ring_guard_minimum_points = boundary_ring_guard_min_points,
      guard_adjusted_features = boundary_simplification[["guard_adjusted_features"]]
    ),
    boundary_guard_adjusted_features = boundary_simplification[["guard_adjusted_features"]],
    boundary_largest_outer_ring_points_min = boundary_ring_stats[["min"]],
    boundary_largest_outer_ring_points_median = boundary_ring_stats[["median"]],
    boundary_largest_outer_ring_points_max = boundary_ring_stats[["max"]],
    boundary_largest_outer_ring_points_below_12 = boundary_ring_stats[["below_12"]],
    boundary_outer_ring_guard_minimum_points = boundary_ring_stats[["guard_minimum"]],
    raw_source_rows = nrow(source_ledger)
  ),
  local_cache_hint = paste(
    "Raw ABS downloads and sources.csv are in data/raw/au_census/.",
    "The directory is git-ignored and should be promoted to project-controlled storage before reuse outside this build."
  ),
  validation = list(
    status = validation_status,
    commands = I(c(
      "Rscript scripts/build_au_area_summary.R"
    )),
    warnings = if (validation_status == "passed") {
      I(character(0))
    } else {
      I(c("ABS SA2 sums differ from ABS state or national G14 rows; differences are recorded in validation notes."))
    },
    notes = paste(validation_lines, collapse = "\n")
  ),
  privacy = "public",
  licence_status = "accepted",
  downstream_status = "public",
  notes = paste(validation_lines, collapse = "\n")
)

write(toJSON(manifest, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null"), manifest_out)

cat(sprintf("built %d AU SA2 area-summary rows for 2021\n", length(rows)))
cat(sprintf("2021 join coverage: %d/%d G14 SA2 rows\n", join_matched_count, nrow(sa2_counts)))
cat(sprintf("2021 state validation max absolute difference: %d\n", state_max_difference))
cat(sprintf("2021 national validation max absolute difference: %d\n", national_max_difference))
cat(sprintf("boundary validation: %d/%d features, %s bytes, factor %.6f at iteration %d\n",
            boundary_feature_count, nrow(boundary), file_bytes(boundary_out),
            boundary_simplification[["factor"]], boundary_simplification[["iteration"]]))
cat(sprintf("boundary ring guard: min/median/max largest outer-ring points = %s/%s/%s; %s features below 12; guard minimum %s; %s features guard-adjusted\n",
            boundary_ring_stats[["min"]], boundary_ring_stats[["median"]],
            boundary_ring_stats[["max"]], boundary_ring_stats[["below_12"]],
            boundary_ring_stats[["guard_minimum"]],
            boundary_simplification[["guard_adjusted_features"]]))
