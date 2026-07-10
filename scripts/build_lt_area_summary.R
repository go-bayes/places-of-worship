# build the Lithuania municipality census-affiliation area-summary product.
# inputs: OSP SDMX religion flows and the Registers Centre municipality boundary API.
# outputs: apps/regions/lt/data/area_summary_municipality.{json,csv},
# apps/regions/lt/data/lt_municipality_2025.geojson, and
# docs/manifests/lt-census-religion-2001-2021.json.
# run from the repository root: Rscript scripts/build_lt_area_summary.R

suppressMessages({
  library(digest)
  library(jsonlite)
  library(sf)
})

source("scripts/lib/simplify_boundary.R")

raw_dir <- "data/raw/lt_census"
output_dir <- "apps/regions/lt/data"
manifest_dir <- "docs/manifests"
repo_root <- normalizePath(".", mustWork = TRUE)
mapshaper_runtime_dir <- file.path(repo_root, raw_dir, "mapshaper_runtime")
dir.create(raw_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

country_code <- "LT"
years <- c(2001L, 2011L, 2021L)
script_id <- "scripts/build_lt_area_summary.R"
retrieval_date <- format(Sys.Date(), "%Y-%m-%d")
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
git_commit <- system("git rev-parse --short HEAD", intern = TRUE)

boundary_vintage <- "2025"
boundary_set_id <- "lt-municipality-2025-registers-centre"
boundary_level <- "municipality"
municipality_dataset_id <- "osp-s3r778-gbs010306-1-religion-municipality-2001-2021"
national_dataset_id <- "osp-s3r778-gbs010502-religion-national-2001-2021"
boundary_dataset_id <- "lt-registers-centre-address-register-municipalities-2025"
boundary_catalogue_dataset_id <- "data-gov-lt-dataset-1345-municipality-boundaries"

municipality_table_hash <- "a19ff692-f3aa-4a3d-90c3-84c7880fa9fa"
municipality_table_url <- paste0(
  "https://osp.stat.gov.lt/lt/statistiniu-rodikliu-analize?hash=",
  municipality_table_hash
)
municipality_api_url <- "https://osp-rs.stat.gov.lt/rest_json/data/S3R778_GBS010306_1"
national_api_url <- "https://osp-rs.stat.gov.lt/rest_json/data/S3R778_GBS010502"
rest_docs_url <- "https://osp.stat.gov.lt/rdb-rest"
census_page_url <- "https://osp.stat.gov.lt/gyventoju-ir-bustu-surasymai1"
survey_release_url <- paste0(
  "https://osp.stat.gov.lt/en/2021-gyventoju-ir-bustu-surasymo-rezultatai/",
  "tautybe-gimtoji-kalba-ir-tikyba"
)
survey_method_url <- paste0(
  "https://osp.stat.gov.lt/documents/10180/4432752/",
  "Etnokult_tyrimo_metodika_2020_189.pdf/",
  "2f49c11b-5392-4678-bfb4-28879c1ee001"
)
boundary_catalogue_url <- "https://data.gov.lt/datasets/1345/?resource_version=1125"
boundary_api_url <- paste0(
  "http://get.data.gov.lt/datasets/gov/rc/ar/grasavivaldybe/",
  "GraSavivaldybe/:format/json"
)
boundary_api_canonical_url <- sub("^http:", "https:", boundary_api_url)

municipality_path <- file.path(raw_dir, "osp_s3r778_gbs010306_1.json")
national_path <- file.path(raw_dir, "osp_s3r778_gbs010502.json")
boundary_path <- file.path(raw_dir, "registers_centre_municipalities_2025.json")
boundary_catalogue_path <- file.path(raw_dir, "data_gov_lt_dataset_1345.html")

summary_json_out <- file.path(output_dir, "area_summary_municipality.json")
summary_csv_out <- file.path(output_dir, "area_summary_municipality.csv")
boundary_out <- file.path(output_dir, paste0("lt_municipality_", boundary_vintage, ".geojson"))
manifest_out <- file.path(manifest_dir, "lt-census-religion-2001-2021.json")

expected_municipality_categories <- c(
  "34" = "Naujosios apaštalų Bažnyčios",
  "49" = "Septintos dienos adventistų",
  "RK" = "Romos katalikų",
  "ST" = "Stačiatikių (ortodoksų)",
  "SN" = "Sentikių",
  "EL" = "Evangelikų liuteronų",
  "ER" = "Evangelikų reformatų",
  "MS" = "Musulmonų sunitų",
  "BA" = "Baptistų ir „laisvųjų bažnyčių “",
  "JU" = "Judėjų",
  "GA" = "Graikų apeigų katalikų (unitų)",
  "KR" = "Karaimų",
  "OTH" = "Kitų",
  "NO" = "Nė vienai",
  "XX" = "Nenurodyta",
  "SE" = "Sekmininkų"
)

english_display_labels <- c(
  "34" = "New Apostolic Church",
  "49" = "Seventh-day Adventists",
  "RK" = "Roman Catholics",
  "ST" = "Orthodox",
  "SN" = "Old Believers",
  "EL" = "Evangelical Lutherans",
  "ER" = "Evangelical Reformed",
  "MS" = "Sunni Muslims",
  "BA" = "Baptists and free churches",
  "JU" = "Jewish",
  "GA" = "Greek Rite Catholics (Uniates)",
  "KR" = "Karaites",
  "OTH" = "Other",
  "NO" = "None",
  "XX" = "Not indicated",
  "SE" = "Pentecostals"
)

# return a file's SHA-256 digest.
sha256_file <- function(path) unname(tools::sha256sum(path))

# return a file size as an integer number of bytes.
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))

# stop when a required file is absent or empty.
require_file <- function(path) {
  if (!file.exists(path) || file_bytes(path) < 1L) {
    stop("missing required file: ", path, call. = FALSE)
  }
}

# write one raw-source retrieval sidecar without replacing an older timestamp.
write_meta_if_missing <- function(path, url) {
  meta_path <- paste0(path, ".meta.json")
  if (!file.exists(meta_path)) {
    write_json(
      list(url = url, retrieved_at = stamp, http_status = 200L),
      meta_path,
      auto_unbox = TRUE,
      pretty = TRUE
    )
  }
}

# fetch one public source into the git-ignored cache.
fetch_file <- function(url, path) {
  if (!file.exists(path) || file_bytes(path) < 1L) {
    temporary_path <- tempfile(tmpdir = dirname(path))
    on.exit(unlink(temporary_path), add = TRUE)
    status <- system2(
      "curl",
      c(
        "-L", "--fail", "--silent", "--show-error", "--retry", "3",
        "--max-time", "300", "-A", "places-of-worship-LT-build",
        "-o", temporary_path, url
      )
    )
    if (status != 0L || !file.exists(temporary_path) || file_bytes(temporary_path) < 1L) {
      stop("failed to retrieve ", url, call. = FALSE)
    }
    if (!file.rename(temporary_path, path)) stop("failed to cache ", path, call. = FALSE)
  }
  write_meta_if_missing(path, url)
  invisible(path)
}

# install a cache-local mapshaper runtime so the shared helper avoids repeated npx installs.
ensure_mapshaper_runtime <- function() {
  executable <- file.path(mapshaper_runtime_dir, "node_modules", ".bin", "mapshaper")
  if (file.exists(executable)) return(invisible(executable))
  dir.create(mapshaper_runtime_dir, recursive = TRUE, showWarnings = FALSE)
  npm_cache <- file.path(raw_dir, "npm_cache")
  dir.create(npm_cache, recursive = TRUE, showWarnings = FALSE)
  status <- system2(
    "npm",
    c(
      "install", "--prefix", mapshaper_runtime_dir, "--no-save",
      "--no-package-lock", "mapshaper"
    ),
    env = c(paste0("NPM_CONFIG_CACHE=", npm_cache))
  )
  if (status != 0L || !file.exists(executable)) {
    stop("failed to prepare cache-local mapshaper runtime", call. = FALSE)
  }
  invisible(executable)
}

# read the retrieval metadata recorded beside one raw source.
read_meta <- function(path) {
  meta_path <- paste0(path, ".meta.json")
  if (!file.exists(meta_path)) stop("missing retrieval metadata: ", meta_path, call. = FALSE)
  fromJSON(meta_path, simplifyVector = FALSE)
}

# return one possibly null SDMX observation member as a scalar.
sdmx_scalar <- function(value) {
  if (is.null(value) || length(value) == 0L) return(NA)
  value
}

# parse one flat OSP SDMX-JSON response and retain labels and statuses.
parse_sdmx <- function(path) {
  source <- fromJSON(path, simplifyVector = FALSE)
  dimensions <- source[["structure"]][["dimensions"]][["observation"]]
  dimension_ids <- vapply(dimensions, `[[`, character(1), "id")
  dimension_values <- lapply(dimensions, function(dimension) {
    vapply(dimension[["values"]], function(value) as.character(value[["id"]]), character(1))
  })
  dimension_labels <- lapply(dimensions, function(dimension) {
    setNames(
      vapply(dimension[["values"]], `[[`, character(1), "name"),
      vapply(dimension[["values"]], function(value) as.character(value[["id"]]), character(1))
    )
  })
  names(dimension_values) <- dimension_ids
  names(dimension_labels) <- dimension_ids
  observations <- source[["dataSets"]][[1L]][["observations"]]
  rows <- lapply(names(observations), function(key) {
    positions <- as.integer(strsplit(key, ":", fixed = TRUE)[[1L]]) + 1L
    identifiers <- vapply(seq_along(dimension_values), function(index) {
      dimension_values[[index]][[positions[[index]]]]
    }, character(1))
    observation <- observations[[key]]
    row <- as.list(identifiers)
    names(row) <- dimension_ids
    row[["value"]] <- sdmx_scalar(observation[[1L]])
    row[["decimals_index"]] <- sdmx_scalar(observation[[2L]])
    row[["status_index"]] <- sdmx_scalar(observation[[3L]])
    as.data.frame(row, stringsAsFactors = FALSE)
  })
  data <- do.call(rbind, rows)
  data[["value"]] <- as.numeric(data[["value"]])
  data[["status_index"]] <- as.numeric(data[["status_index"]])
  list(source = source, data = data, labels = dimension_labels)
}

# enforce the municipality flow's fixed identifiers, categories, and waves.
validate_source_structure <- function(parsed) {
  required_dimensions <- c("SavivaldybesM1411", "GBS_religija_06", "MATVNT", "LAIKOTARPIS")
  if (!all(required_dimensions %in% names(parsed[["labels"]]))) {
    stop("OSP municipality dimensions changed", call. = FALSE)
  }
  religion_labels <- parsed[["labels"]][["GBS_religija_06"]]
  category_labels <- religion_labels[names(religion_labels) != "TOT"]
  if (!identical(category_labels[names(expected_municipality_categories)], expected_municipality_categories)) {
    stop("OSP municipality religion categories changed", call. = FALSE)
  }
  published_years <- sort(as.integer(names(parsed[["labels"]][["LAIKOTARPIS"]])))
  if (!identical(published_years, years)) stop("OSP municipality waves changed", call. = FALSE)
  invisible(TRUE)
}

# identify the 60 municipality codes shared by OSP and the boundary source.
municipality_codes <- function(parsed, boundary_source) {
  source_codes <- sprintf("%02d", as.integer(boundary_source[["sav_kodas"]]))
  if (length(source_codes) != 60L || anyDuplicated(source_codes)) {
    stop("expected 60 distinct Registers Centre municipality codes", call. = FALSE)
  }
  osp_codes <- names(parsed[["labels"]][["SavivaldybesM1411"]])
  if (!all(source_codes %in% osp_codes)) stop("boundary municipality codes do not match OSP", call. = FALSE)
  sort(source_codes)
}

# validate exact headline reconciliation for one wave.
validate_wave <- function(parsed, year, area_codes) {
  data <- parsed[["data"]]
  area_field <- "SavivaldybesM1411"
  religion_field <- "GBS_religija_06"
  wave <- data[data[["LAIKOTARPIS"]] == as.character(year), ]
  headline_categories <- c("TOT", "NO", "XX")
  details <- lapply(headline_categories, function(category) {
    municipality <- wave[
      wave[[area_field]] %in% area_codes & wave[[religion_field]] == category,
    ]
    national <- wave[
      wave[[area_field]] == "00" & wave[[religion_field]] == category,
    ]
    if (nrow(municipality) != 60L || nrow(national) != 1L || any(is.na(municipality[["value"]]))) {
      stop("missing headline source value for ", year, " ", category, call. = FALSE)
    }
    difference <- sum(municipality[["value"]]) - national[["value"]][[1L]]
    if (difference != 0) stop("national reconciliation failed for ", year, " ", category, call. = FALSE)
    list(
      source_category_lt = unname(parsed[["labels"]][[religion_field]][[category]]),
      source_category_id = category,
      municipality_sum = as.integer(sum(municipality[["value"]])),
      published_national_total = as.integer(national[["value"]][[1L]]),
      difference = as.integer(difference),
      status = "matched"
    )
  })
  municipality_cells <- wave[wave[[area_field]] %in% area_codes & wave[[religion_field]] != "TOT", ]
  list(
    year = year,
    municipality_count = length(area_codes),
    category_count = length(expected_municipality_categories),
    headline_categories_exact = TRUE,
    max_absolute_headline_difference = 0L,
    confidential_municipality_category_cells = sum(is.na(municipality_cells[["value"]]) & municipality_cells[["status_index"]] == 0, na.rm = TRUE),
    no_phenomenon_municipality_category_cells = sum(is.na(municipality_cells[["value"]]) & municipality_cells[["status_index"]] == 1, na.rm = TRUE),
    reconciliation = details
  )
}

# validate the expanded national flow's categories against its total.
validate_national_presentation <- function(parsed) {
  data <- parsed[["data"]]
  religion_field <- "GBS_religija_8"
  lapply(years, function(year) {
    wave <- data[data[["LAIKOTARPIS"]] == as.character(year), ]
    total <- wave[["value"]][wave[[religion_field]] == "TOT"]
    categories <- wave[wave[[religion_field]] != "TOT", ]
    category_sum <- sum(categories[["value"]], na.rm = TRUE)
    if (length(total) != 1L || category_sum != total) {
      stop("expanded national category reconciliation failed for ", year, call. = FALSE)
    }
    list(
      year = year,
      structural_category_count = nrow(categories),
      numeric_category_count = sum(!is.na(categories[["value"]])),
      confidential_category_count = sum(is.na(categories[["value"]]) & categories[["status_index"]] == 0, na.rm = TRUE),
      no_phenomenon_category_count = sum(is.na(categories[["value"]]) & categories[["status_index"]] == 1, na.rm = TRUE),
      published_numeric_display_sum = as.integer(category_sum),
      published_total = as.integer(total),
      difference = 0L
    )
  })
}

# swap one parsed geometry's northing/easting axis order into EPSG:3346 x/y order.
swap_geometry_axes <- function(geometry) {
  # transpose each coordinate pair without reparsing the source WKT.
  swap_matrix <- function(matrix) matrix[, c(2L, 1L), drop = FALSE]
  if (inherits(geometry, "POLYGON")) return(st_polygon(lapply(geometry, swap_matrix)))
  if (inherits(geometry, "MULTIPOLYGON")) {
    return(st_multipolygon(lapply(geometry, function(polygon) lapply(polygon, swap_matrix))))
  }
  stop("unsupported Registers Centre geometry type", call. = FALSE)
}

# build the current official municipality boundary layer from source WKT.
build_boundary <- function(path, parsed) {
  source <- fromJSON(path, simplifyDataFrame = TRUE)[["_data"]]
  required <- c("pavadinimas", "sav_kodas", "sav_plotas", "sav_r", "formavimo_data", "savivaldybes")
  if (nrow(source) != 60L || !all(required %in% names(source))) {
    stop("unexpected Registers Centre municipality source shape", call. = FALSE)
  }
  if (!identical(unique(source[["formavimo_data"]]), "2025-10-21")) {
    stop("boundary formation date changed", call. = FALSE)
  }
  raw_geometries <- st_as_sfc(source[["savivaldybes"]], crs = 3346)
  geometries <- st_sfc(lapply(raw_geometries, swap_geometry_axes), crs = 3346)
  boundary <- st_sf(
    area_code = sprintf("%02d", as.integer(source[["sav_kodas"]])),
    boundary_area_name_lt = source[["pavadinimas"]],
    municipality_formation_date = source[["sav_r"]],
    land_area_sq_km = as.numeric(source[["sav_plotas"]]) / 100,
    geometry = geometries
  )
  boundary <- st_make_valid(boundary)
  boundary <- st_collection_extract(boundary, "POLYGON", warn = FALSE)
  if (any(st_is_empty(boundary)) || any(!st_is_valid(boundary))) {
    stop("Registers Centre municipality geometry is empty or invalid", call. = FALSE)
  }
  # reduce the 12 MB source before the shared mapshaper helper loads it.
  boundary <- st_simplify(boundary, dTolerance = 25, preserveTopology = TRUE)
  boundary <- st_make_valid(boundary)
  boundary <- st_collection_extract(boundary, "POLYGON", warn = FALSE)
  if (any(st_is_empty(boundary)) || any(!st_is_valid(boundary))) {
    stop("projected boundary preparation produced empty or invalid geometry", call. = FALSE)
  }
  area_labels <- parsed[["labels"]][["SavivaldybesM1411"]]
  boundary[["area_name"]] <- unname(area_labels[boundary[["area_code"]]])
  if (any(is.na(boundary[["area_name"]]))) stop("missing OSP municipality label", call. = FALSE)
  boundary[["area_unit_id"]] <- paste(boundary_set_id, boundary[["area_code"]], sep = ":")
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- boundary_level
  boundary <- st_transform(boundary, 4326)
  boundary[order(boundary[["area_code"]]), c(
    "area_code", "area_name", "boundary_area_name_lt", "municipality_formation_date",
    "area_unit_id", "boundary_set_id", "boundary_level", "land_area_sq_km", "geometry"
  )]
}

# simplify, write, and validate all municipality geometries.
write_boundary <- function(boundary) {
  output_absolute <- file.path(repo_root, boundary_out)
  previous_working_directory <- getwd()
  on.exit(setwd(previous_working_directory), add = TRUE)
  setwd(mapshaper_runtime_dir)
  simplification <- mapshaper_simplify_to_cap(
    boundary,
    output_absolute,
    max_bytes = 800000,
    keep_percentages = c(100, 75, 50, 25, 15, 10, 7.5, 5, 3, 2, 1, 0.5),
    clean_option = "allow-overlaps"
  )
  # remove mapshaper's auxiliary geometry-type layers when mixed input is split.
  split_outputs <- Sys.glob(paste0(tools::file_path_sans_ext(output_absolute), "-*.geojson"))
  unlink(split_outputs)
  written <- st_read(output_absolute, quiet = TRUE)
  validity <- st_is_valid(written)
  if (nrow(written) != 60L || any(st_is_empty(written)) || any(is.na(validity)) || any(!validity)) {
    stop("simplified boundary did not retain 60 valid non-empty features", call. = FALSE)
  }
  hashes <- vapply(st_as_binary(st_geometry(written), EWKB = TRUE), function(wkb) {
    digest(wkb, algo = "sha256", serialize = FALSE)
  }, character(1))
  if (length(unique(hashes)) != 60L) stop("municipality geometry hashes are not distinct", call. = FALSE)
  simplification[["source_preparation"]] <- "sf st_simplify at 25 metres in EPSG:3346 before the shared mapshaper helper"
  simplification[["byte_ceiling"]] <- 800000L
  list(
    layer = written,
    simplification = simplification,
    valid_feature_count = sum(validity),
    geometry_hashes = setNames(as.list(hashes), written[["area_code"]])
  )
}

# return one exact municipality value for a year and source category.
source_value <- function(parsed, area_code, year, category) {
  data <- parsed[["data"]]
  value <- data[["value"]][
    data[["SavivaldybesM1411"]] == area_code &
      data[["LAIKOTARPIS"]] == as.character(year) &
      data[["GBS_religija_06"]] == category
  ]
  if (length(value) != 1L || is.na(value) || value != round(value)) {
    stop("missing or non-integer headline value for ", area_code, " ", year, " ", category, call. = FALSE)
  }
  as.integer(value)
}

# build one schema-conforming municipality-year row.
build_row <- function(parsed, boundary, area_code, year) {
  area <- boundary[boundary[["area_code"]] == area_code, ]
  population_total <- source_value(parsed, area_code, year, "TOT")
  no_religion_count <- source_value(parsed, area_code, year, "NO")
  not_indicated_count <- source_value(parsed, area_code, year, "XX")
  religious_affiliation_count <- population_total - no_religion_count - not_indicated_count
  if (religious_affiliation_count < 0L) stop("negative affiliation residual", call. = FALSE)
  instrument <- if (year == 2021L) {
    "sample_modelled_ethnocultural_statistical_survey"
  } else {
    "full_enumeration_population_census"
  }
  basis <- if (year == 2021L) {
    paste(
      "The denominator is the 2021 census resident-population total. Religion is a",
      "sample/model-based statistical-survey estimate: 171,000 household residents",
      "were surveyed and mathematical methods extended the ethnocultural results."
    )
  } else {
    paste(
      "Full-enumeration population census municipality total; Nenurodyta",
      "remains in the denominator."
    )
  }
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = area[["area_unit_id"]][[1L]],
    area_code = area_code,
    area_name = area[["area_name"]][[1L]],
    year = year,
    population_total = population_total,
    population_total_basis = basis,
    religious_affiliation_count = religious_affiliation_count,
    religious_affiliation_percent = round(100 * religious_affiliation_count / population_total, 4),
    no_religion_count = no_religion_count,
    no_religion_percent = round(100 * no_religion_count / population_total, 4),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(area[["land_area_sq_km"]][[1L]], 4),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(municipality_dataset_id, boundary_dataset_id),
    quality_flag = paste(
      "census_affiliation",
      instrument,
      "source_categories_as_published",
      "not_indicated_in_denominator",
      "exact_municipality_national_headline_reconciliation",
      "current_2025_boundary_frame",
      if (year == 2021L) "change_metric_withheld_across_instrument_break" else "no_cross_instrument_change_metric",
      sep = ";"
    )
  )
}

# declare the standard census-affiliation headline indicators.
indicators <- function() {
  temporal <- paste(
    "2001 and 2011 full-enumeration censuses; 2021 sample/model-based",
    "ethnocultural statistical survey published with the register-based census."
  )
  spatial <- "Sixty Lithuanian municipalities on the current 2025 boundary frame."
  list(
    list(
      indicator_id = "population_total",
      label = "Resident population",
      description = "Published municipality population total in OSP flow S3R778_GBS010306_1.",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "Published Iš viso pagal religiją municipality value.",
      temporal_coverage = temporal,
      spatial_coverage = spatial,
      quality_notes = "Nenurodyta, the source's not-indicated religion category, remains in the total."
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious community indicated (%)",
      description = "Share assigned to a named religious community in the source municipality presentation.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 times (Iš viso pagal religiją minus Nė vienai minus Nenurodyta) divided by Iš viso pagal religiją.",
      temporal_coverage = temporal,
      spatial_coverage = spatial,
      quality_notes = paste(
        "The 2021 value is a sample/model-based estimate. No change metric is",
        "calculated between 2001/2011 census enumeration and the 2021 instrument."
      )
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "Nė vienai (%) — None",
      description = "Share in the source category Nė vienai (None).",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 times the published Nė vienai municipality value divided by Iš viso pagal religiją.",
      temporal_coverage = temporal,
      spatial_coverage = spatial,
      quality_notes = paste(
        "Nė vienai and Nenurodyta remain separate. The 2021 value is a",
        "sample/model-based estimate, and no cross-instrument change is reported."
      )
    )
  )
}

# describe the two source datasets used by the area-summary product.
source_datasets <- function() {
  list(
    list(
      source_dataset_id = municipality_dataset_id,
      name = "OSP S3R778 / GBS010306 municipality religion flow",
      provider = "State Data Agency of Lithuania",
      url = municipality_api_url,
      retrieval_date = retrieval_date,
      local_path = municipality_path,
      licence = list(
        name = "No named licence located; source attribution required",
        url = census_page_url,
        attribution = "State Data Agency of Lithuania, Official Statistics Portal; extracted and adapted"
      ),
      citation = "State Data Agency of Lithuania. S3R778 - Gyventojų skaičius, dimensions GBS010306: municipality and religion, 2001, 2011, and 2021.",
      access_limits = NULL,
      redistribution_limits = "The OSP states that users must identify the State Data Agency as the data source; no named licence was located on the table, REST documentation, or census release pages.",
      notes = paste(
        "The 2001 and 2011 waves are full-enumeration census affiliation.",
        "The 2021 religion values come from the separate ethnocultural statistical survey."
      )
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "Address Register municipality spatial data",
      provider = "State Enterprise Centre of Registers, Lithuania",
      url = boundary_api_canonical_url,
      retrieval_date = retrieval_date,
      local_path = boundary_path,
      licence = list(
        name = "Creative Commons Attribution 4.0 International (CC BY 4.0)",
        url = "https://creativecommons.org/licenses/by/4.0/",
        attribution = "State Enterprise Centre of Registers; transformed, simplified, and adapted"
      ),
      citation = "State Enterprise Centre of Registers. Address Register municipality spatial data, formation date 2025-10-21; dataset 1345 in Lithuania's Open Data Portal.",
      access_limits = NULL,
      redistribution_limits = "CC BY 4.0 attribution applies; this product identifies the coordinate-axis correction, transformation, and simplification.",
      notes = paste(
        "The source WKT serialises EPSG:3346 as northing then easting; the builder",
        "swaps axes before transforming to EPSG:4326."
      )
    )
  )
}

# flatten row objects into the repository's CSV companion shape.
flatten_rows <- function(rows) {
  get_character <- function(row, field) row[[field]]
  get_integer <- function(row, field) row[[field]]
  get_numeric <- function(row, field) row[[field]]
  data.frame(
    country_code = vapply(rows, get_character, character(1), "country_code"),
    boundary_set_id = vapply(rows, get_character, character(1), "boundary_set_id"),
    boundary_level = vapply(rows, get_character, character(1), "boundary_level"),
    area_unit_id = vapply(rows, get_character, character(1), "area_unit_id"),
    area_code = vapply(rows, get_character, character(1), "area_code"),
    area_name = vapply(rows, get_character, character(1), "area_name"),
    year = vapply(rows, get_integer, integer(1), "year"),
    population_total = vapply(rows, get_integer, integer(1), "population_total"),
    population_total_basis = vapply(rows, get_character, character(1), "population_total_basis"),
    religious_affiliation_count = vapply(rows, get_integer, integer(1), "religious_affiliation_count"),
    religious_affiliation_percent = vapply(rows, get_numeric, numeric(1), "religious_affiliation_percent"),
    no_religion_count = vapply(rows, get_integer, integer(1), "no_religion_count"),
    no_religion_percent = vapply(rows, get_numeric, numeric(1), "no_religion_percent"),
    place_count = NA_integer_,
    places_per_10000_residents = NA_real_,
    place_density_per_sq_km = NA_real_,
    land_area_sq_km = vapply(rows, get_numeric, numeric(1), "land_area_sq_km"),
    site_snapshot_date = NA_character_,
    place_count_basis = NA_character_,
    source_dataset_ids = vapply(rows, function(row) paste(unlist(row[["source_dataset_ids"]]), collapse = "|"), character(1)),
    quality_flag = vapply(rows, get_character, character(1), "quality_flag"),
    stringsAsFactors = FALSE
  )
}

# return a stable row or feature count for a generated artefact.
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$", path)) return(nrow(st_read(path, quiet = TRUE)))
  object <- fromJSON(path, simplifyVector = FALSE)
  if (!is.null(object[["rows"]])) return(length(object[["rows"]]))
  NA_integer_
}

# describe a tracked public output in the manifest.
manifest_file_record <- function(path, content, licence_status) {
  list(
    uri = paste0("repo:", path),
    storage_provider = "other",
    format = tools::file_ext(path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    row_count = row_count_file(path),
    content = content,
    privacy = "public",
    licence_status = licence_status
  )
}

# describe one cached source with its URL, retrieval time, and digest.
raw_source_record <- function(path, source_dataset_id, notes, used_in_public_product = TRUE) {
  meta <- read_meta(path)
  list(
    uri = path,
    url = meta[["url"]],
    retrieval_date = substr(meta[["retrieved_at"]], 1L, 10L),
    retrieved_at = meta[["retrieved_at"]],
    format = tools::file_ext(path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    source_dataset_id = source_dataset_id,
    used_in_public_product = used_in_public_product,
    notes = notes
  )
}

# record the municipality source categories and English display labels.
category_mapping_notes <- function() {
  vapply(names(expected_municipality_categories), function(category_id) {
    role <- if (category_id == "NO") {
      "no_religion"
    } else if (category_id == "XX") {
      "not_indicated"
    } else if (category_id == "OTH") {
      "grouped_named_religion"
    } else {
      "named_religion"
    }
    paste0(
      "Category mapping for every municipality wave: ", category_id, " | ",
      expected_municipality_categories[[category_id]], " => ",
      english_display_labels[[category_id]], " [product role: ", role,
      "; harmonisation: as_published]."
    )
  }, character(1))
}

ensure_mapshaper_runtime()
fetch_file(municipality_api_url, municipality_path)
fetch_file(national_api_url, national_path)
fetch_file(boundary_api_url, boundary_path)
fetch_file(boundary_catalogue_url, boundary_catalogue_path)

catalogue_text <- paste(readLines(boundary_catalogue_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
if (!grepl("Creative Commons Attribution 4.0", catalogue_text, fixed = TRUE)) {
  stop("boundary catalogue no longer states CC BY 4.0", call. = FALSE)
}

municipality_parsed <- parse_sdmx(municipality_path)
national_parsed <- parse_sdmx(national_path)
validate_source_structure(municipality_parsed)
boundary_source <- fromJSON(boundary_path, simplifyDataFrame = TRUE)[["_data"]]
area_codes <- municipality_codes(municipality_parsed, boundary_source)
rm(boundary_source)
invisible(gc())
reconciliation <- lapply(years, function(year) validate_wave(municipality_parsed, year, area_codes))
national_presentation <- validate_national_presentation(national_parsed)

message("validated OSP sources; building municipality geometry")
boundary <- build_boundary(boundary_path, municipality_parsed)
prepared_boundary_path <- tempfile("lt-municipality-prepared-", fileext = ".geojson")
st_write(
  boundary,
  prepared_boundary_path,
  driver = "GeoJSON",
  delete_dsn = TRUE,
  quiet = TRUE,
  layer_options = c("COORDINATE_PRECISION=5")
)
rm(boundary)
invisible(gc())
message("built municipality geometry; simplifying boundary")
boundary_result <- write_boundary(prepared_boundary_path)
unlink(prepared_boundary_path)
message("simplified boundary; building area-summary rows")
written_boundary <- boundary_result[["layer"]]

rows <- unlist(lapply(years, function(year) {
  lapply(area_codes, function(area_code) build_row(municipality_parsed, written_boundary, area_code, year))
}), recursive = FALSE)
if (length(rows) != 180L) stop("expected 180 municipality-year rows", call. = FALSE)

area_summary <- list(
  schema_version = "0.2.0",
  generated_at = stamp,
  generated_by = script_id,
  country_code = country_code,
  boundary_set = list(
    boundary_set_id = boundary_set_id,
    country_code = country_code,
    level = boundary_level,
    vintage = boundary_vintage,
    source_dataset_id = boundary_dataset_id
  ),
  site_snapshot = list(
    source_dataset_id = NULL,
    snapshot_date = NULL,
    basis = "no governed Lithuania place-of-worship snapshot is included in this census-affiliation release",
    # cite the 2021 instrument on the shipped surface (not only the manifest) and disclose
    # the two national-flow suppression cells that document confidentiality and no-phenomenon status.
    notes = paste0(
      "The product ships census-affiliation metrics and municipality geometry only; ",
      "place-density fields are null. The 2021 religious-community values are a ",
      "sample/model-based ethnocultural statistical-survey estimate: 56,000 household ",
      "residents completed the questionnaire themselves, interviewers surveyed a further ",
      "115,000 household residents, and mathematical methods produced the population ",
      "estimates. See the State Data Agency's official release: ", survey_release_url, ". ",
      "A single confidential cell in the 2001 expanded national presentation and a single ",
      "no-phenomenon cell in the 2021 expanded national presentation remain unavailable; ",
      "the builder neither zero-fills nor redistributes them."
    )
  ),
  source_datasets = source_datasets(),
  indicators = indicators(),
  visual_layers = list(
    list(
      visual_layer_id = "lt-municipality-religious-community-indicated",
      label = "Religious community indicated (%)",
      description = "Census-affiliation share by municipality for 2001, 2011, and 2021.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "resident population, including Nenurodyta"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "Iš viso pagal religiją minus Nė vienai minus Nenurodyta",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = "The year selector shows source snapshots. It does not calculate change across the 2011-2021 instrument break."
    ),
    list(
      visual_layer_id = "lt-municipality-none",
      label = "Nė vienai (%) — None",
      description = "Share in the source category Nė vienai (None).",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "resident population, including Nenurodyta"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "published Nė vienai municipality value",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = "Nė vienai remains separate from Nenurodyta; no cross-instrument change is reported."
    )
  ),
  rows = rows
)

write_json(area_summary, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

raw_sources <- list(
  raw_source_record(
    municipality_path,
    municipality_dataset_id,
    "OSP SDMX-JSON flow S3R778_GBS010306_1; all 60 municipalities, 16 published religion categories plus total, and 2001/2011/2021."
  ),
  raw_source_record(
    national_path,
    national_dataset_id,
    "OSP SDMX-JSON flow S3R778_GBS010502; expanded national presentation with 25 structural categories plus total, used to document municipality grouping.",
    used_in_public_product = FALSE
  ),
  raw_source_record(
    boundary_path,
    boundary_dataset_id,
    "Registers Centre Address Register municipality WKT for 60 municipalities, formation date 2025-10-21."
  ),
  raw_source_record(
    boundary_catalogue_path,
    boundary_catalogue_dataset_id,
    "Lithuanian Open Data Portal dataset 1345 catalogue record stating public access and CC BY 4.0."
  )
)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:lt-census-religion:lt:2001-2021:s3r778-gbs010306-1",
  dataset_id = "lt-census-religion:lt:2001-2021:s3r778-gbs010306-1",
  dataset_version_id = paste0(
    "lt-census-religion:lt:2001-2021:s3r778-gbs010306-1:",
    substr(sha256_file(summary_json_out), 1L, 12L)
  ),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "lt-census-religion",
  dataset_role = "public_product",
  scope = list(
    level = "country",
    country_codes = list(country_code),
    snapshot_date = NULL,
    snapshot_anchor = NULL,
    pipeline_stage = "public"
  ),
  created_at = stamp,
  created_by = script_id,
  pipeline = list(
    script = script_id,
    git_commit = git_commit,
    command = paste("Rscript", script_id),
    parameters = list(
      table_id = "S3R778_GBS010306_1",
      data_structure_id = "GBS010306",
      shared_table_hash = municipality_table_hash,
      waves = years,
      geography = "60 municipalities",
      construct = "census affiliation / religious community indicated",
      denominator = "published Iš viso pagal religiją; Nenurodyta retained",
      affiliation_rule = "Iš viso pagal religiją minus Nė vienai minus Nenurodyta",
      instrument_rule = "2001/2011 full-enumeration census; 2021 sample/model-based ethnocultural statistical survey; no cross-instrument change metric",
      boundary_source_vintage = "2025-10-21",
      boundary_simplification = boundary_result[["simplification"]],
      local_cache_hint = "Raw OSP and Registers Centre inputs are cached under data/raw/lt_census/ and remain git-ignored.",
      retrieval_routes = list(
        list(purpose = "shared OSP table", method = "GET", url = municipality_table_url, notes = "Interactive share route for all three waves."),
        list(purpose = "municipality SDMX export", method = "GET", url = municipality_api_url, notes = "Machine-readable build input."),
        list(purpose = "expanded national SDMX export", method = "GET", url = national_api_url, notes = "Documents the source's more detailed national presentation."),
        list(purpose = "municipality geometry", method = "GET", url = boundary_api_canonical_url, notes = "Open Data Storage API; the builder uses the equivalent HTTP route because the HTTPS load balancer returned 502 during retrieval."),
        list(purpose = "boundary licence record", method = "GET", url = boundary_catalogue_url, notes = "Dataset 1345 states CC BY 4.0.")
      )
    ),
    software_versions = list(
      r = R.version.string,
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")),
      digest = as.character(packageVersion("digest")),
      mapshaper = "npx mapshaper used through scripts/lib/simplify_boundary.R"
    )
  ),
  source = list(
    provider = "State Data Agency of Lithuania; State Enterprise Centre of Registers",
    source_dataset_ids = list(
      municipality_dataset_id,
      national_dataset_id,
      boundary_dataset_id,
      boundary_catalogue_dataset_id
    ),
    source_urls = list(
      municipality_table_url,
      municipality_api_url,
      national_api_url,
      rest_docs_url,
      census_page_url,
      survey_release_url,
      survey_method_url,
      boundary_api_canonical_url,
      boundary_catalogue_url
    ),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = paste(
      "The OSP requires users to identify the State Data Agency as the data source;",
      "no named licence was located for the indicator flow. Lithuania Open Data Portal",
      "dataset 1345 states CC BY 4.0 for the Registers Centre boundary data."
    ),
    citation = "State Data Agency OSP flow S3R778_GBS010306_1; State Enterprise Centre of Registers Address Register municipality spatial data."
  ),
  durable_files = list(
    manifest_file_record(summary_json_out, "Lithuania municipality census-affiliation area summary for 2001, 2011, and 2021.", "needs_review"),
    manifest_file_record(summary_csv_out, "Flattened Lithuania municipality census-affiliation area-summary rows.", "needs_review"),
    manifest_file_record(boundary_out, "Simplified official 2025 Lithuania municipality geometry with 60 features.", "accepted")
  ),
  raw_sources = raw_sources,
  validation = list(
    status = "passed_with_warnings",
    commands = list(
      "Rscript scripts/build_lt_area_summary.R",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/lt/data/area_summary_municipality.json",
      "jq empty docs/manifests/lt-census-religion-2001-2021.json"
    ),
    tests = list(
      "All three waves are present for all 60 municipality codes.",
      "Iš viso pagal religiją, Nė vienai, and Nenurodyta municipality sums match the national row exactly in every wave.",
      "Each row's named-affiliation residual plus Nė vienai plus Nenurodyta equals its published total exactly.",
      "No difference or change metric crosses the 2011-2021 instrument break.",
      "All 60 simplified municipality geometries are valid, non-empty, and have distinct SHA-256 WKB hashes.",
      "Every raw build input records its URL, retrieval timestamp, byte count, and SHA-256."
    ),
    warnings = list(
      "The 2021 religion values are sample/model-based statistical-survey estimates published with a register-based census; they are not full-enumeration religion responses.",
      "The municipality flow groups minor religious communities into Kitų. Its 16-category presentation is less detailed than the 25-category national flow.",
      "Small municipality denomination cells can be confidential or marked as no phenomenon. The public headline uses only unsuppressed total, Nė vienai, and Nenurodyta rows.",
      paste(
        "Current 2025 municipality polygons provide the common display frame. The source",
        "formation dates identify 55 municipalities as 1998-06-01 and five municipalities as",
        "2000-02-02. Municipality geometry stability from 2001 through the 2025 boundary frame",
        "was not verified: formation dates and shared codes do not prove unchanged boundaries."
      ),
      "No named OSP licence was located. The product records the agency's source-attribution requirement and makes no open-licence claim for the statistical flow."
    ),
    notes = paste(
      "The public headline fields reconcile exactly for 2001, 2011, and 2021.",
      "The 2021 estimates remain available as a separate snapshot, while change metrics",
      "are withheld across the incompatible enumeration and survey/model instruments."
    ),
    gates = list(
      all_waves_present = "passed",
      exact_headline_reconciliation = "passed",
      instrument_break_declared = "passed",
      incompatible_change_metrics_withheld = "passed",
      geometry_validity = "passed",
      distinct_geometry_hashes = "passed",
      provenance = "passed",
      licence_claims = "passed_no_osp_open_licence_claimed",
      nonresponse_labels = "passed_source_labels_retained"
    ),
    stats = list(
      waves = length(years),
      rows = length(rows),
      municipalities_per_wave = 60L,
      municipality_categories_per_wave = "2001=16;2011=16;2021=16",
      national_structural_categories_per_wave = "2001=25;2011=25;2021=25",
      national_numeric_categories_per_wave = "2001=24;2011=25;2021=24",
      boundary_features = 60L,
      boundary_valid_features = boundary_result[["valid_feature_count"]],
      distinct_geometry_hashes = length(unique(unlist(boundary_result[["geometry_hashes"]]))),
      boundary_bytes = file_bytes(boundary_out),
      summary_json_bytes = file_bytes(summary_json_out),
      summary_csv_bytes = file_bytes(summary_csv_out)
    ),
    reconciliation = reconciliation,
    national_category_presentation = national_presentation,
    boundary_validation = list(
      source_feature_count = 60L,
      output_feature_count = 60L,
      valid_feature_count = boundary_result[["valid_feature_count"]],
      distinct_geometry_hash_count = length(unique(unlist(boundary_result[["geometry_hashes"]]))),
      geometry_sha256_by_municipality_code = boundary_result[["geometry_hashes"]],
      source_crs_interpretation = "EPSG:3346 with northing/easting serialised in the source WKT; axes swapped before transformation",
      output_crs = "EPSG:4326"
    )
  ),
  construct_notes = c(list(
    "The construct is census affiliation: the source asks which religious community residents identify with. It does not measure belief, practice, attendance, or membership records.",
    "The 2001 and 2011 religion values came from full-enumeration population censuses.",
    "The 2021 census population was established from administrative registers. Religion was absent from those registers and came from a separate ethnocultural statistical survey: 56,000 household residents self-completed, interviewers surveyed 115,000 household residents, and mathematical methods produced population estimates.",
    "The 2021 product denominator is the full 2,810,761 census resident-population total. The religion numerators are sample/model-based estimates joined to the census results; they are not whole-population register observations.",
    "Nė vienai and Nenurodyta retain the source's Lithuanian names and separate framing in every wave. Nenurodyta remains in the denominator and outside both named affiliation and Nė vienai.",
    "The municipality table publishes 16 categories plus Iš viso pagal religiją. Kitų is a grouped presentation. The companion national flow publishes 25 structural categories plus the total. Its category allocation must not replace the municipality source rows.",
    "The product shows three source snapshots. It withholds change metrics across 2011-2021 because full-enumeration census responses and a sample/model-based statistical survey are incompatible instruments.",
    "The current municipality frame contains 60 codes in every wave. The boundary source records formation date 2000-02-02 for Elektrėnai, Kalvarija, Kazlų Rūda, Pagėgiai, and Rietavas, and 1998-06-01 for the other 55 municipalities. The product does not claim that the 2025 polygons reproduce every historic boundary segment. Municipality geometry stability from 2001 through the 2025 boundary frame was not verified: formation dates and shared codes do not prove unchanged boundaries."
  ), as.list(category_mapping_notes())),
  privacy = "public",
  licence_status = "needs_review",
  downstream_status = "public",
  source_datasets = source_datasets(),
  notes = "The committed product contains derived municipality summaries and simplified official geometry only. Lithuania UI and hub wiring are outside this build."
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)

cat(sprintf("table ids: S3R778_GBS010306_1 (municipality), S3R778_GBS010502 (expanded national)\n"))
cat(sprintf("waves x geography: %s; 60 municipalities per wave\n", paste(years, collapse = ", ")))
cat("municipality category counts: 2001=16, 2011=16, 2021=16 (plus total)\n")
cat("expanded national category counts: 2001=24 numeric/25 structural, 2011=25/25, 2021=24/25 (plus total)\n")
cat("2021 universe verdict: full census population denominator; religion is a sample/model-based estimate from 171,000 household respondents, not a whole-population register observation\n")
cat("hard gates: passed; change metrics withheld across the 2011-2021 instrument break; OSP licence remains unnamed and is not presented as open\n")
cat(sprintf("wrote %s: %d rows, %d bytes\n", summary_json_out, length(rows), file_bytes(summary_json_out)))
cat(sprintf("wrote %s: %d rows, %d bytes\n", summary_csv_out, row_count_file(summary_csv_out), file_bytes(summary_csv_out)))
cat(sprintf("wrote %s: %d features, %d bytes\n", boundary_out, row_count_file(boundary_out), file_bytes(boundary_out)))
cat(sprintf("wrote %s: %d bytes\n", manifest_out, file_bytes(manifest_out)))
