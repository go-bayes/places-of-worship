# build the estonia census-affiliation county area-summary product.
# inputs: statistics estonia pxweb census tables for 2000, 2011, and 2021,
# official methodology and licence pages, and maa-amet historical county wfs layers.
# outputs: apps/regions/ee/data/area_summary_county.{json,csv}, three
# per-vintage county geojson files, and the tracked data manifest.
# run from the repo root: Rscript scripts/build_ee_area_summary.R

suppressMessages({
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

raw_dir <- "data/raw/ee_census"
output_dir <- "apps/regions/ee/data"
manifest_dir <- "docs/manifests"
dir.create(raw_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(output_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

retrieval_date <- "2026-07-10"
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
script_id <- "scripts/build_ee_area_summary.R"
country_code <- "EE"
terms_url <- paste0(
  "https://www.stat.ee/en/statistics-estonia/about-us/strategy/",
  "principles-dissemination-official-statistics"
)
religion_2021_method_url <- paste0(
  "https://www.stat.ee/en/news/population-census-proportion-people-",
  "religious-affiliation-remains-stable-orthodox-christianity-still-most-widespread"
)
boundary_catalogue_url <- paste0(
  "https://geoportaal.maaamet.ee/eng/spatial-data/",
  "administrative-and-settlement-division-p312.html"
)
boundary_licence_url <- paste0(
  "https://geoportaal.maaamet.ee/docs/Avaandmed/",
  "Licence-of-open-data-of-Estonian-Land-Board.pdf"
)
wfs_base_url <- "https://teenus.maaamet.ee/ows/wms-ajalooline-haldus"
wfs_capabilities_url <- paste0(
  wfs_base_url,
  "?service=WFS&request=GetCapabilities&version=2.0.0"
)

waves <- list(
  `2000` = list(
    year = 2000L,
    table_id = "RL229.PX",
    api_path = "rahvaloendus/rel2000/usk/RL229.PX",
    geography_text_en = "Place of residence",
    religion_text_en = "Religious affiliation",
    religion_text_et = "Suhtumine religiooni ja usk",
    singleton = list(Sugu = "+"),
    national_code = "000000",
    total_code = "+",
    affiliation_code = "10",
    no_religion_codes = c("20", "30"),
    top_level_codes = c("10", "20", "30", "40", "50", "60"),
    child_codes = c(
      "110", "111", "112", "113", "114", "115", "116", "117",
      "118", "119", "1M", "1X"
    ),
    boundary_layer = "maakonnad_2000",
    boundary_vintage = "2000-12-04",
    boundary_set_id = "ee-county-2000-maaamet",
    table_dataset_id = "stat-ee-rl229-census-religion-2000",
    boundary_dataset_id = "maaamet-historical-county-2000-12-04"
  ),
  `2011` = list(
    year = 2011L,
    table_id = "RL0453.PX",
    api_path = paste(
      "rahvaloendus/rel2011/rahvastiku-demograafilised-ja-etno-kultuurilised-naitajad",
      "usk/RL0453.PX",
      sep = "/"
    ),
    geography_text_en = "County",
    religion_text_en = "Religion",
    religion_text_et = "Usk",
    singleton = list(Sugu = "T", `Vanuserühm` = "Y_TOTAL"),
    national_code = "EE00",
    total_code = "899",
    affiliation_code = "898",
    no_religion_codes = "892",
    top_level_codes = c("898", "892", "891", "890"),
    child_codes = c(
      "102", "101", "104", "103", "105", "107", "131", "135",
      "121", "106", "110", "108", "119", "109", "157", "OTH", "893"
    ),
    boundary_layer = "maakonnad_2011",
    boundary_vintage = "2011-06-08",
    boundary_set_id = "ee-county-2011-maaamet",
    table_dataset_id = "stat-ee-rl0453-census-religion-2011",
    boundary_dataset_id = "maaamet-historical-county-2011-06-08"
  ),
  `2021` = list(
    year = 2021L,
    table_id = "RL21452.px",
    api_path = paste(
      "rahvaloendus/rel2021/rahvastiku-demograafilised-ja-etno-kultuurilised-naitajad",
      "usk/RL21452.px",
      sep = "/"
    ),
    geography_text_en = "Place of residence",
    religion_text_en = "Religion",
    religion_text_et = "Usk",
    singleton = list(Aasta = "2021"),
    national_code = "1",
    total_code = "1",
    affiliation_code = "2",
    no_religion_codes = "19",
    top_level_codes = c("2", "19", "20", "21"),
    child_codes = as.character(3:18),
    boundary_layer = "maakonnad_2021",
    boundary_vintage = "2021-01-01",
    boundary_set_id = "ee-county-2021-maaamet",
    table_dataset_id = "stat-ee-rl21452-census-religion-2021",
    boundary_dataset_id = "maaamet-historical-county-2021-01-01"
  )
)

for (wave_name in names(waves)) {
  wave <- waves[[wave_name]]
  wave[["api_url_en"]] <- paste0("https://andmed.stat.ee/api/v1/en/stat/", wave[["api_path"]])
  wave[["api_url_et"]] <- paste0("https://andmed.stat.ee/api/v1/et/stat/", wave[["api_path"]])
  wave[["metadata_en_path"]] <- file.path(raw_dir, paste0("px_", wave_name, "_metadata_en.json"))
  wave[["metadata_et_path"]] <- file.path(raw_dir, paste0("px_", wave_name, "_metadata_et.json"))
  wave[["data_path"]] <- file.path(raw_dir, paste0("px_", wave_name, "_county_religion.json"))
  wave[["boundary_url"]] <- paste0(
    wfs_base_url,
    "?service=WFS&version=2.0.0&request=GetFeature&typeNames=",
    wave[["boundary_layer"]],
    "&outputFormat=GEOJSON"
  )
  wave[["boundary_raw_path"]] <- file.path(raw_dir, paste0("maaamet_", wave_name, "_county_raw.geojson"))
  wave[["boundary_out"]] <- file.path(output_dir, paste0("ee_county_", wave_name, ".geojson"))
  waves[[wave_name]] <- wave
}

branch_urls <- c(
  `2000` = "https://andmed.stat.ee/api/v1/en/stat/rahvaloendus/rel2000/usk",
  `2011` = paste0(
    "https://andmed.stat.ee/api/v1/en/stat/rahvaloendus/rel2011/",
    "rahvastiku-demograafilised-ja-etno-kultuurilised-naitajad/usk"
  ),
  `2021` = paste0(
    "https://andmed.stat.ee/api/v1/en/stat/rahvaloendus/rel2021/",
    "rahvastiku-demograafilised-ja-etno-kultuurilised-naitajad/usk"
  )
)
branch_paths <- setNames(
  file.path(raw_dir, paste0("px_", names(branch_urls), "_religion_branch_en.json")),
  names(branch_urls)
)
terms_path <- file.path(raw_dir, "statistics_estonia_dissemination_terms.html")
religion_2021_method_path <- file.path(raw_dir, "statistics_estonia_2021_religion_method.html")
boundary_catalogue_path <- file.path(raw_dir, "maaamet_administrative_division_catalogue.html")
boundary_licence_path <- file.path(raw_dir, "maaamet_open_data_licence.pdf")
wfs_capabilities_path <- file.path(raw_dir, "maaamet_historical_county_wfs_capabilities.xml")

summary_json_out <- file.path(output_dir, "area_summary_county.json")
summary_csv_out <- file.path(output_dir, "area_summary_county.csv")
manifest_out <- file.path(manifest_dir, "ee-census-religion-2000-2021.json")

# statistics estonia's pxweb tables are cc by-sa 4.0 (share-alike); the boundary
# layer carries maa-amet's own attribution licence with no cc identifier. the
# licence_status slugs encode both obligations so downstream exports inherit
# the share-alike flag rather than the generic "accepted" status (ghana
# precedent: docs/manifests/gh-census-religion-2010-2021.json).
licence_status_dataset <- paste0(
  "stat_ee_open_data_cc_by_sa_4_0_attribution_",
  "maaamet_open_data_licence_attribution"
)
licence_status_boundary <- "maaamet_open_data_licence_attribution"

# compute the sha-256 digest for a local file.
sha256_file <- function(path) {
  unname(tools::sha256sum(path))
}

# hash ordered text values into a compact version token.
sha256_values <- function(values) {
  tmp <- tempfile()
  on.exit(unlink(tmp), add = TRUE)
  writeBin(charToRaw(paste(values, collapse = "")), tmp)
  sha256_file(tmp)
}

# return file size in bytes for validation and manifest records.
file_bytes <- function(path) {
  as.integer(unname(file.info(path)[["size"]]))
}

# validate a generated json product against a repository schema.
validate_json_schema <- function(schema_path, instance_path) {
  base_uri <- paste0(
    "file://",
    normalizePath(dirname(schema_path), winslash = "/", mustWork = TRUE),
    "/"
  )
  status <- system2(
    "uvx",
    c(
      "check-jsonschema",
      "--base-uri", base_uri,
      "--schemafile", schema_path,
      instance_path
    ),
    env = c(
      "UV_CACHE_DIR=/tmp/places-of-worship-uv/cache",
      "UV_TOOL_DIR=/tmp/places-of-worship-uv/tools",
      "UV_PYTHON_INSTALL_DIR=/tmp/places-of-worship-uv/python"
    )
  )
  if (!identical(status, 0L)) {
    stop("area-summary output failed schema validation", call. = FALSE)
  }
  invisible(instance_path)
}

# download an open get response when the local cache is absent.
fetch_get_if_missing <- function(url, path) {
  if (file.exists(path) && file_bytes(path) > 0L) return(invisible(path))
  tmp <- paste0(path, ".part")
  on.exit(unlink(tmp), add = TRUE)
  args <- c(
    "--fail", "--silent", "--show-error", "--location", "--max-time", "180",
    shQuote(url), "-o", shQuote(tmp)
  )
  status <- system2("curl", args)
  if (!identical(status, 0L) || !file.exists(tmp) || file_bytes(tmp) == 0L) {
    stop("failed to download ", url, call. = FALSE)
  }
  if (!file.rename(tmp, path)) stop("failed to cache ", path, call. = FALSE)
  invisible(path)
}

# post a pxweb json query when the local response cache is absent.
fetch_px_post_if_missing <- function(url, query, path) {
  if (file.exists(path) && file_bytes(path) > 0L) return(invisible(path))
  query_path <- tempfile(fileext = ".json")
  tmp <- paste0(path, ".part")
  on.exit(unlink(c(query_path, tmp)), add = TRUE)
  write_json(query, query_path, auto_unbox = TRUE, pretty = TRUE, null = "null")
  args <- c(
    "--http1.1", "--tlsv1.2", "--fail", "--silent", "--show-error",
    "--max-time", "180", "-HContent-Type:application/json",
    "--data-binary", shQuote(paste0("@", query_path)), shQuote(url),
    "-o", shQuote(tmp)
  )
  status <- system2("curl", args)
  if (!identical(status, 0L) || !file.exists(tmp) || file_bytes(tmp) == 0L) {
    stop("failed to query ", url, call. = FALSE)
  }
  if (!file.rename(tmp, path)) stop("failed to cache ", path, call. = FALSE)
  invisible(path)
}

# return a named metadata variable from a pxweb table description.
metadata_variable <- function(metadata, variable_text) {
  matches <- Filter(
    function(variable) identical(variable[["text"]], variable_text),
    metadata[["variables"]]
  )
  if (length(matches) != 1L) {
    stop("metadata variable not found exactly once: ", variable_text, call. = FALSE)
  }
  matches[[1]]
}

# return category codes in source order from a json-stat2 dimension.
dimension_codes <- function(dimension) {
  index <- dimension[["category"]][["index"]]
  names(sort(unlist(index, use.names = TRUE)))
}

# return category labels aligned to source-ordered json-stat2 codes.
dimension_labels <- function(dimension, codes) {
  labels <- unlist(dimension[["category"]][["label"]], use.names = TRUE)
  unname(labels[codes])
}

# standardise a vintage-specific ehak county code to four digits.
county_code_from_source <- function(source_code, year) {
  if (year == 2000L) return(sprintf("%04d", as.integer(substr(source_code, 1L, 2L))))
  if (year == 2011L) return(sprintf("%04d", as.integer(source_code)))
  substr(source_code, 1L, 4L)
}

# identify the national and 15 county codes from one wave's metadata.
county_codes_from_metadata <- function(geography_variable, year, national_code) {
  codes <- unlist(geography_variable[["values"]])
  labels <- unlist(geography_variable[["valueTexts"]])
  if (year %in% c(2000L, 2021L)) {
    county_codes <- codes[grepl(" COUNTY$", labels) & !startsWith(labels, "..")]
  } else {
    county_codes <- codes[codes != national_code & !startsWith(labels, "..")]
  }
  if (length(county_codes) != 15L) {
    stop("expected 15 county codes in ", year, " metadata", call. = FALSE)
  }
  c(national_code, county_codes)
}

# build a pxweb request while preserving the table's source dimension order.
build_px_query <- function(metadata, wave, geography_codes) {
  query <- lapply(metadata[["variables"]], function(variable) {
    code <- variable[["code"]]
    if (identical(variable[["text"]], wave[["geography_text_en"]])) {
      values <- as.list(geography_codes)
      filter <- "item"
    } else if (identical(variable[["text"]], wave[["religion_text_en"]])) {
      values <- list("*")
      filter <- "all"
    } else if (code %in% names(wave[["singleton"]])) {
      values <- list(wave[["singleton"]][[code]])
      filter <- "item"
    } else {
      stop("unhandled PX-Web variable in ", wave[["table_id"]], ": ", code, call. = FALSE)
    }
    list(code = code, selection = list(filter = filter, values = values))
  })
  list(query = query, response = list(format = "json-stat2"))
}

# return a manifest raw-source record for a cached input.
raw_source_record <- function(path, url, method = "GET", request_body = NULL) {
  record <- list(
    local_path = path,
    url = url,
    method = method,
    retrieval_date = retrieval_date,
    bytes = file_bytes(path),
    sha256 = sha256_file(path)
  )
  if (!is.null(request_body)) record[["request_body"]] <- request_body
  record
}

# return a manifest durable-file record for a committed output.
durable_file_record <- function(path, content, licence_status, row_count = NULL, feature_count = NULL) {
  record <- list(
    uri = paste0("repo:", path),
    storage_provider = "other",
    format = sub("^.*\\.", "", path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    content = content,
    privacy = "public",
    licence_status = licence_status
  )
  if (!is.null(row_count)) record[["row_count"]] <- as.integer(row_count)
  if (!is.null(feature_count)) record[["feature_count"]] <- as.integer(feature_count)
  record
}

# hash each feature geometry independently to detect duplicated polygons.
feature_geometry_hashes <- function(layer, code_field) {
  order_index <- order(layer[[code_field]])
  ordered <- layer[order_index, ]
  hashes <- vapply(seq_len(nrow(ordered)), function(index) {
    tmp <- tempfile()
    on.exit(unlink(tmp), add = TRUE)
    writeBin(st_as_binary(st_geometry(ordered[index, ]), EWKB = TRUE)[[1]], tmp)
    sha256_file(tmp)
  }, character(1))
  setNames(unname(hashes), ordered[[code_field]])
}

# flatten area-summary rows into the repository csv companion shape.
flatten_rows <- function(rows) {
  data.frame(
    country_code = vapply(rows, `[[`, character(1), "country_code"),
    boundary_set_id = vapply(rows, `[[`, character(1), "boundary_set_id"),
    boundary_level = vapply(rows, `[[`, character(1), "boundary_level"),
    area_unit_id = vapply(rows, `[[`, character(1), "area_unit_id"),
    area_code = vapply(rows, `[[`, character(1), "area_code"),
    area_name = vapply(rows, `[[`, character(1), "area_name"),
    year = vapply(rows, `[[`, integer(1), "year"),
    population_total = vapply(rows, `[[`, integer(1), "population_total"),
    population_total_basis = vapply(rows, `[[`, character(1), "population_total_basis"),
    religious_affiliation_count = vapply(rows, `[[`, integer(1), "religious_affiliation_count"),
    religious_affiliation_percent = vapply(rows, `[[`, numeric(1), "religious_affiliation_percent"),
    no_religion_count = vapply(rows, `[[`, integer(1), "no_religion_count"),
    no_religion_percent = vapply(rows, `[[`, numeric(1), "no_religion_percent"),
    place_count = NA_integer_,
    places_per_10000_residents = NA_real_,
    place_density_per_sq_km = NA_real_,
    land_area_sq_km = vapply(rows, `[[`, numeric(1), "land_area_sq_km"),
    site_snapshot_date = NA_character_,
    place_count_basis = NA_character_,
    source_dataset_ids = vapply(
      rows,
      function(row) paste(unlist(row[["source_dataset_ids"]]), collapse = "|"),
      character(1)
    ),
    quality_flag = vapply(rows, `[[`, character(1), "quality_flag"),
    stringsAsFactors = FALSE
  )
}

invisible(mapply(fetch_get_if_missing, branch_urls, branch_paths))
fetch_get_if_missing(terms_url, terms_path)
fetch_get_if_missing(religion_2021_method_url, religion_2021_method_path)
fetch_get_if_missing(boundary_catalogue_url, boundary_catalogue_path)
fetch_get_if_missing(boundary_licence_url, boundary_licence_path)
fetch_get_if_missing(wfs_capabilities_url, wfs_capabilities_path)

wave_results <- list()
px_queries <- list()
category_mappings <- list()
geometry_validation <- list()
all_rows <- list()

for (wave_name in names(waves)) {
  wave <- waves[[wave_name]]
  fetch_get_if_missing(wave[["api_url_en"]], wave[["metadata_en_path"]])
  fetch_get_if_missing(wave[["api_url_et"]], wave[["metadata_et_path"]])
  fetch_get_if_missing(wave[["boundary_url"]], wave[["boundary_raw_path"]])

  metadata_en <- fromJSON(wave[["metadata_en_path"]], simplifyVector = FALSE)
  metadata_et <- fromJSON(wave[["metadata_et_path"]], simplifyVector = FALSE)
  geography_en <- metadata_variable(metadata_en, wave[["geography_text_en"]])
  religion_en <- metadata_variable(metadata_en, wave[["religion_text_en"]])
  religion_et <- metadata_variable(metadata_et, wave[["religion_text_et"]])
  religion_codes <- unlist(religion_en[["values"]])
  religion_labels_en <- unlist(religion_en[["valueTexts"]])
  religion_labels_et <- unlist(religion_et[["valueTexts"]])
  if (!identical(religion_codes, unlist(religion_et[["values"]]))) {
    stop("Estonian and English religion codes differ in ", wave_name, call. = FALSE)
  }

  geography_codes <- county_codes_from_metadata(
    geography_en,
    wave[["year"]],
    wave[["national_code"]]
  )
  px_query <- build_px_query(metadata_en, wave, geography_codes)
  px_queries[[wave_name]] <- px_query
  fetch_px_post_if_missing(wave[["api_url_en"]], px_query, wave[["data_path"]])

  response <- fromJSON(wave[["data_path"]], simplifyVector = TRUE)
  geography_dimension <- response[["dimension"]][[geography_en[["code"]]]]
  religion_dimension <- response[["dimension"]][[religion_en[["code"]]]]
  response_geography_codes <- dimension_codes(geography_dimension)
  response_religion_codes <- dimension_codes(religion_dimension)
  response_religion_labels <- dimension_labels(religion_dimension, response_religion_codes)
  if (!identical(response_geography_codes, geography_codes) ||
      !identical(response_religion_codes, religion_codes) ||
      !identical(response_religion_labels, religion_labels_en)) {
    stop("PX-Web response categories changed in ", wave_name, call. = FALSE)
  }

  values <- as.numeric(response[["value"]])
  expected_cells <- length(geography_codes) * length(religion_codes)
  if (length(values) != expected_cells) {
    stop("PX-Web response cell count changed in ", wave_name, call. = FALSE)
  }
  value_matrix <- matrix(
    values,
    nrow = length(geography_codes),
    ncol = length(religion_codes),
    byrow = TRUE,
    dimnames = list(geography_codes, religion_codes)
  )
  headline_codes <- unique(c(
    wave[["total_code"]], wave[["affiliation_code"]],
    wave[["no_religion_codes"]], wave[["top_level_codes"]]
  ))
  if (anyNA(value_matrix[, headline_codes, drop = FALSE])) {
    stop("a required headline or reconciliation cell is unavailable in ", wave_name, call. = FALSE)
  }
  if (wave[["year"]] == 2021L) {
    published_values <- value_matrix[!is.na(value_matrix)]
    if (any(published_values %% 10 != 0)) {
      stop("2021 values are no longer published consistently in tens", call. = FALSE)
    }
  }

  top_level_difference <- value_matrix[, wave[["total_code"]]] -
    rowSums(value_matrix[, wave[["top_level_codes"]], drop = FALSE])
  top_level_bound <- if (wave[["year"]] == 2021L) {
    10L * (length(wave[["top_level_codes"]]) - 1L)
  } else {
    0L
  }
  if (any(abs(top_level_difference) > top_level_bound)) {
    stop("top-level categories fail the source rounding gate in ", wave_name, call. = FALSE)
  }

  national_values <- value_matrix[wave[["national_code"]], ]
  county_values <- value_matrix[-1L, , drop = FALSE]
  complete_category <- colSums(is.na(county_values)) == 0L
  county_category_sums <- colSums(county_values, na.rm = TRUE)
  county_differences <- national_values - county_category_sums
  # each published cell is independently rounded to the nearest ten, so its
  # rounding error is at most 5; a sum of k such cells can differ from the
  # separately rounded total by at most 5*k. the bound is derived from the
  # actual number of cells summed, never an arbitrary headroom figure.
  geography_cell_count <- nrow(county_values)
  geography_bound <- if (wave[["year"]] == 2021L) {
    5L * geography_cell_count
  } else {
    0L
  }
  complete_differences <- county_differences[complete_category]
  if (any(abs(complete_differences) > geography_bound)) {
    stop("county sums fail the national reconciliation gate in ", wave_name, call. = FALSE)
  }

  # affiliation-child reconciliation (affiliation parent vs. the sum of its
  # published child categories) now runs on every geography row -- the
  # national row and each of the 15 counties -- rather than the national
  # aggregate alone, so an individual county's mis-summed children cannot
  # hide behind an aggregate total that still happens to balance.
  child_cell_count <- length(wave[["child_codes"]])
  child_bound <- if (wave[["year"]] == 2021L) {
    5L * child_cell_count
  } else {
    0L
  }
  row_child_complete <- rowSums(is.na(value_matrix[, wave[["child_codes"]], drop = FALSE])) == 0L
  row_child_difference <- value_matrix[, wave[["affiliation_code"]]] -
    rowSums(value_matrix[, wave[["child_codes"]], drop = FALSE], na.rm = FALSE)
  complete_child_differences <- row_child_difference[row_child_complete]
  if (any(abs(complete_child_differences) > child_bound)) {
    stop("affiliation children fail reconciliation in ", wave_name, call. = FALSE)
  }

  national_child_complete <- unname(row_child_complete[[wave[["national_code"]]]])
  national_child_difference <- if (national_child_complete) {
    as.integer(row_child_difference[[wave[["national_code"]]]])
  } else {
    NA_integer_
  }
  county_child_complete <- row_child_complete[-1L]
  county_child_differences <- row_child_difference[-1L]
  county_affiliation_child_max_absolute_difference <- if (any(county_child_complete)) {
    as.integer(max(abs(county_child_differences[county_child_complete])))
  } else {
    NA_integer_
  }
  # per-county breakdown: reconcile each county's own published affiliation
  # count against that same county's published child-category sum.
  affiliation_child_by_county <- lapply(seq_along(geography_codes[-1L]), function(index) {
    source_geography_code <- geography_codes[-1L][[index]]
    area_code <- county_code_from_source(source_geography_code, wave[["year"]])
    complete <- unname(row_child_complete[[source_geography_code]])
    list(
      area_code = area_code,
      county_cells_complete = complete,
      affiliation_count = as.integer(value_matrix[source_geography_code, wave[["affiliation_code"]]]),
      child_sum = if (complete) {
        as.integer(sum(value_matrix[source_geography_code, wave[["child_codes"]]]))
      } else {
        NULL
      },
      difference = if (complete) as.integer(row_child_difference[[source_geography_code]]) else NULL,
      status = if (!complete) {
        "not_reconciled_due_to_source_unavailable_cells"
      } else if (row_child_difference[[source_geography_code]] == 0) {
        "exact"
      } else {
        "within_source_rounding"
      }
    )
  })

  category_mappings[[wave_name]] <- lapply(seq_along(religion_codes), function(index) {
    role <- if (religion_codes[[index]] == wave[["total_code"]]) {
      "age_15_plus_total"
    } else if (religion_codes[[index]] == wave[["affiliation_code"]]) {
      "headline_affiliation"
    } else if (religion_codes[[index]] %in% wave[["no_religion_codes"]]) {
      if (wave[["year"]] == 2000L && religion_codes[[index]] == "30") {
        "headline_no_religion_component_atheist"
      } else {
        "headline_no_religion"
      }
    } else if (religion_codes[[index]] %in% wave[["child_codes"]]) {
      "affiliation_detail_as_published"
    } else {
      "response_or_unknown_outside_headline"
    }
    list(
      source_code = religion_codes[[index]],
      source_label_et = religion_labels_et[[index]],
      display_label_en = religion_labels_en[[index]],
      product_role = role
    )
  })

  boundary <- st_read(wave[["boundary_raw_path"]], quiet = TRUE)
  if (!all(c("MKOOD", "MNIMI") %in% names(boundary)) || nrow(boundary) != 15L) {
    stop("official county boundary shape changed in ", wave_name, call. = FALSE)
  }
  # the historical wfs geojson carries l-est97 coordinates without a usable crs tag.
  suppressWarnings(st_crs(boundary) <- 3301)
  boundary <- st_transform(boundary, 4326)
  # normalise coastal counties with multiple exterior rings to multipolygons.
  boundary <- st_make_valid(boundary)
  boundary_codes <- sprintf("%04d", as.integer(boundary[["MKOOD"]]))
  source_county_codes <- vapply(
    geography_codes[-1L],
    county_code_from_source,
    character(1),
    year = wave[["year"]]
  )
  if (!setequal(boundary_codes, source_county_codes)) {
    stop("PX-Web and Maa-amet county codes do not match in ", wave_name, call. = FALSE)
  }
  geography_labels <- unlist(geography_en[["valueTexts"]])
  names(geography_labels) <- unlist(geography_en[["values"]])
  area_names <- setNames(geography_labels[geography_codes[-1L]], source_county_codes)
  boundary <- st_sf(
    area_code = boundary_codes,
    area_name = unname(area_names[boundary_codes]),
    geometry = st_geometry(boundary),
    crs = 4326
  )
  boundary <- boundary[order(boundary$area_code), ]
  simplification <- mapshaper_simplify_to_cap(
    boundary,
    wave[["boundary_out"]],
    max_bytes = 750000,
    keep_percentages = switch(
      wave_name,
      `2000` = c(5, 2, 1, 0.5, 0.2, 0.1),
      `2011` = c(2, 1, 0.5, 0.2, 0.1),
      `2021` = c(1, 0.5, 0.2, 0.1)
    )
  )
  written_boundary <- st_read(wave[["boundary_out"]], quiet = TRUE)
  written_boundary <- written_boundary[order(written_boundary$area_code), ]
  written_valid <- st_is_valid(written_boundary)
  geometry_hashes <- feature_geometry_hashes(written_boundary, "area_code")
  if (nrow(written_boundary) != 15L || any(st_is_empty(written_boundary)) ||
      any(is.na(written_valid)) || any(!written_valid) ||
      length(unique(geometry_hashes)) != 15L) {
    stop("simplified county boundary failed geometry gates in ", wave_name, call. = FALSE)
  }
  land_area <- as.numeric(st_area(st_transform(written_boundary, 3035))) / 1e6
  land_area_by_code <- setNames(land_area, written_boundary$area_code)

  county_rows <- lapply(seq_along(geography_codes[-1L]), function(index) {
    source_geography_code <- geography_codes[-1L][[index]]
    area_code <- county_code_from_source(source_geography_code, wave[["year"]])
    total <- as.integer(value_matrix[source_geography_code, wave[["total_code"]]])
    affiliation <- as.integer(value_matrix[source_geography_code, wave[["affiliation_code"]]])
    no_religion <- as.integer(sum(
      value_matrix[source_geography_code, wave[["no_religion_codes"]]],
      na.rm = FALSE
    ))
    rounding_flag <- if (wave[["year"]] == 2021L) {
      "published_survey_estimates_rounded_to_tens"
    } else {
      "published_census_counts"
    }
    list(
      country_code = country_code,
      boundary_set_id = wave[["boundary_set_id"]],
      boundary_level = "county",
      area_unit_id = paste0(wave[["boundary_set_id"]], ":", area_code),
      area_code = area_code,
      area_name = unname(area_names[[area_code]]),
      year = wave[["year"]],
      population_total = total,
      population_total_basis = paste(
        "Statistics Estonia", wave[["table_id"]],
        "published population aged 15 and over; this age-15-plus count is the denominator."
      ),
      religious_affiliation_count = affiliation,
      religious_affiliation_percent = round(100 * affiliation / total, 2),
      no_religion_count = no_religion,
      no_religion_percent = round(100 * no_religion / total, 2),
      place_count = NULL,
      places_per_10000_residents = NULL,
      place_density_per_sq_km = NULL,
      land_area_sq_km = round(unname(land_area_by_code[[area_code]]), 4),
      site_snapshot_date = NULL,
      place_count_basis = NULL,
      source_dataset_ids = list(
        wave[["table_dataset_id"]], wave[["boundary_dataset_id"]]
      ),
      quality_flag = paste(
        "census_affiliation",
        "denominator_population_age_15_plus",
        rounding_flag,
        "period_boundary_vintage",
        "no_cross_wave_county_concordance",
        sep = ";"
      )
    )
  })

  category_reconciliation <- lapply(seq_along(religion_codes), function(index) {
    code <- religion_codes[[index]]
    complete <- complete_category[[code]]
    list(
      source_code = code,
      source_label_et = religion_labels_et[[index]],
      display_label_en = religion_labels_en[[index]],
      county_cells_complete = unname(complete),
      unavailable_county_cells = as.integer(sum(is.na(county_values[, code]))),
      county_sum = if (complete) as.integer(county_category_sums[[code]]) else NULL,
      published_national_total = as.integer(national_values[[code]]),
      difference = if (complete) as.integer(county_differences[[code]]) else NULL,
      status = if (!complete) {
        "not_reconciled_due_to_source_unavailable_cells"
      } else if (county_differences[[code]] == 0) {
        "exact"
      } else {
        "within_source_rounding"
      }
    )
  })

  wave_results[[wave_name]] <- list(
    year = wave[["year"]],
    table_id = wave[["table_id"]],
    county_count = 15L,
    category_count = length(religion_codes),
    unavailable_county_cells = as.integer(sum(is.na(county_values))),
    headline_cells_complete = TRUE,
    top_level_reconciliation_max_absolute_difference = as.integer(max(abs(top_level_difference))),
    national_affiliation_child_difference = national_child_difference,
    county_affiliation_child_max_absolute_difference = county_affiliation_child_max_absolute_difference,
    county_to_national_complete_category_max_absolute_difference = as.integer(
      max(abs(complete_differences))
    ),
    geography_reconciliation_bound = as.integer(geography_bound),
    geography_reconciliation_bound_derivation = if (wave[["year"]] == 2021L) {
      paste0(
        "Each of the ", geography_cell_count, " county cells summed into a category's ",
        "national total is independently rounded to the nearest ten (maximum rounding ",
        "error 5 per cell); the bound is 5 x ", geography_cell_count, " = ", geography_bound,
        ". The observed maximum absolute difference is ",
        as.integer(max(abs(complete_differences))), "."
      )
    } else {
      "Published integer counts reconcile exactly; no rounding allowance is used."
    },
    affiliation_child_reconciliation_bound = as.integer(child_bound),
    affiliation_child_reconciliation_bound_derivation = if (wave[["year"]] == 2021L) {
      paste0(
        "Each of the ", child_cell_count, " published affiliation child categories summed",
        " within a geography row is independently rounded to the nearest ten (maximum",
        " rounding error 5 per cell); the bound is 5 x ", child_cell_count, " = ", child_bound,
        ". The observed maximum absolute difference across complete county rows is ",
        ifelse(
          is.na(county_affiliation_child_max_absolute_difference),
          "not applicable (no county has every child cell available)",
          county_affiliation_child_max_absolute_difference
        ), "."
      )
    } else {
      "Published integer counts reconcile exactly; no rounding allowance is used."
    },
    rounding_treatment = if (wave[["year"]] == 2021L) {
      paste(
        "Statistics Estonia publishes values in multiples of ten and states that",
        "aggregated values may differ from sums because of rounding. Published",
        "counts remain unchanged; no residual is distributed."
      )
    } else {
      "Published integer counts reconcile exactly; no rounding allowance is used."
    },
    category_reconciliation = category_reconciliation,
    affiliation_child_by_county = affiliation_child_by_county
  )
  geometry_validation[[wave_name]] <- list(
    boundary_vintage = wave[["boundary_vintage"]],
    source_feature_count = 15L,
    output_feature_count = nrow(written_boundary),
    all_valid = all(written_valid),
    all_non_empty = all(!st_is_empty(written_boundary)),
    distinct_geometry_hash_count = length(unique(geometry_hashes)),
    feature_geometry_sha256 = as.list(geometry_hashes),
    output_bytes = file_bytes(wave[["boundary_out"]]),
    simplification = c(
      simplification,
      list(byte_ceiling = 750000, helper = "scripts/lib/simplify_boundary.R")
    )
  )
  all_rows <- c(all_rows, county_rows)
}

if (!identical(sort(unique(vapply(all_rows, `[[`, integer(1), "year"))), c(2000L, 2011L, 2021L))) {
  stop("one or more required census waves are absent", call. = FALSE)
}
if (length(all_rows) != 45L) stop("expected 45 county-wave rows", call. = FALSE)

table_source_datasets <- lapply(names(waves), function(wave_name) {
  wave <- waves[[wave_name]]
  notes <- if (wave[["year"]] == 2021L) {
    paste(
      "Religion was collected through the census sample survey and generalised",
      "to the population aged 15 and over. Religion was not supplemented from",
      "registers. Published counts are in tens, and the table warns that",
      "aggregates may differ from sums because of rounding."
    )
  } else if (wave[["year"]] == 2000L) {
    paste(
      "The table footnote defines Population as persons aged 15 and older plus",
      "persons whose age was unknown. The product uses that published total as",
      "the age-15-plus denominator."
    )
  } else {
    paste(
      "The table is a full-enumeration census table for persons aged 15 and over.",
      "The religion question was voluntary."
    )
  }
  list(
    source_dataset_id = wave[["table_dataset_id"]],
    name = fromJSON(wave[["metadata_en_path"]])[["title"]],
    provider = "Statistics Estonia",
    url = wave[["api_url_en"]],
    retrieval_date = retrieval_date,
    local_path = wave[["data_path"]],
    licence = list(
      name = "Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)",
      url = "https://creativecommons.org/licenses/by-sa/4.0/",
      attribution = "Statistics Estonia"
    ),
    citation = paste("Statistics Estonia, PXWeb table", wave[["table_id"]]),
    access_limits = NULL,
    redistribution_limits = paste(
      "Statistics Estonia requires source attribution and share-alike reuse under",
      "CC BY-SA 4.0. Raw API responses remain in the git-ignored cache."
    ),
    notes = notes
  )
})

boundary_source_datasets <- lapply(names(waves), function(wave_name) {
  wave <- waves[[wave_name]]
  # expand acronyms at first use only; later waves in this loop reuse the
  # short forms once the manifest has already introduced the long forms.
  is_first_wave <- identical(wave_name, names(waves)[[1]])
  maa_amet_term <- if (is_first_wave) "Maa-amet (Estonian Land Board)" else "Maa-amet"
  wfs_term <- if (is_first_wave) "WFS (Web Feature Service)" else "WFS"
  list(
    source_dataset_id = wave[["boundary_dataset_id"]],
    name = paste(maa_amet_term, "historical county layer", wave[["boundary_vintage"]]),
    provider = "Estonian Land and Spatial Development Board (Maa- ja Ruumiamet; Maa-amet service)",
    url = wave[["boundary_url"]],
    retrieval_date = retrieval_date,
    local_path = wave[["boundary_raw_path"]],
    licence = list(
      name = paste(
        "Estonian Land and Spatial Development Board open-data licence;",
        "source and data vintage attribution required"
      ),
      url = boundary_licence_url,
      attribution = paste(
        "Administrative and settlement units, Estonian Land and Spatial",
        "Development Board", wave[["boundary_vintage"]]
      )
    ),
    citation = paste(
      "Estonian Land and Spatial Development Board historical administrative",
      "division", paste0(wfs_term, ","), "county layer", wave[["boundary_layer"]]
    ),
    access_limits = NULL,
    redistribution_limits = paste(
      "The official open-data licence permits derivatives and redistribution",
      "with origin and data-vintage attribution. No Creative Commons identifier",
      "is claimed for the boundary."
    ),
    notes = paste(
      "Official per-vintage county boundary. The layer is not used to rebase",
      "another wave's counts."
    )
  )
})
source_datasets <- c(table_source_datasets, boundary_source_datasets)

universe_note <- paste(
  "Population aged 15 and over in the selected Statistics Estonia census religion",
  "table. Every percentage divides by the published age-15-plus total for the",
  "same county and wave; total population is never the denominator."
)
spatial_note <- paste(
  "Fifteen counties on each census wave's official Maa-amet boundary vintage.",
  "The product does not treat repeated county names as unchanged polygons."
)
indicators <- list(
  list(
    indicator_id = "population_total",
    label = "Population aged 15+",
    description = "Published census religion-table population aged 15 and over.",
    unit = "count",
    denominator_indicator_id = NULL,
    method = "Use the published total row for each county and wave without adjustment.",
    temporal_coverage = "2000, 2011, 2021",
    spatial_coverage = spatial_note,
    quality_notes = universe_note
  ),
  list(
    indicator_id = "religious_affiliation_count",
    label = "Religious affiliation (count)",
    description = "People who reported or were estimated to feel an affiliation to a religion.",
    unit = "count",
    denominator_indicator_id = "population_total",
    method = paste(
      "Use each table's published affiliation parent category: Follower of a",
      "particular faith (2000) or Feels an affiliation to a religion (2011 and 2021)."
    ),
    temporal_coverage = "2000, 2011, 2021",
    spatial_coverage = spatial_note,
    quality_notes = paste(
      universe_note,
      "The 2021 values are sample-survey estimates published in tens."
    )
  ),
  list(
    indicator_id = "religious_affiliation_percent",
    label = "Religious affiliation (%)",
    description = "Religious-affiliation count as a percentage of the population aged 15 and over.",
    unit = "percent",
    denominator_indicator_id = "population_total",
    method = "100 times the published affiliation parent count divided by the published age-15-plus total.",
    temporal_coverage = "2000, 2011, 2021",
    spatial_coverage = spatial_note,
    quality_notes = universe_note
  ),
  list(
    indicator_id = "no_religion_count",
    label = "No religious affiliation (count)",
    description = paste(
      "People in the source no-affiliation category; the 2000 count also includes",
      "the separately published Atheist category."
    ),
    unit = "count",
    denominator_indicator_id = "population_total",
    method = paste(
      "For 2000, sum Has no religious affiliation and Atheist. For 2011 and",
      "2021, use Does not feel an affiliation to any religion."
    ),
    temporal_coverage = "2000, 2011, 2021",
    spatial_coverage = spatial_note,
    quality_notes = universe_note
  ),
  list(
    indicator_id = "no_religion_percent",
    label = "No religious affiliation (%)",
    description = "No-religion count as a percentage of the population aged 15 and over.",
    unit = "percent",
    denominator_indicator_id = "population_total",
    method = "100 times the mapped no-religion count divided by the published age-15-plus total.",
    temporal_coverage = "2000, 2011, 2021",
    spatial_coverage = spatial_note,
    quality_notes = universe_note
  )
)

visual_layers <- list(
  list(
    visual_layer_id = "ee-county-religious-affiliation-share",
    label = "Religious affiliation share",
    description = "Census religious affiliation among the population aged 15 and over by county.",
    layer_type = "choropleth",
    indicator_ids = list("religious_affiliation_percent"),
    geometry_unit_type = "area_unit",
    legend = list(unit = "percent", denominator = "population aged 15+"),
    colour_scale = "sequential",
    time_control = "year_selector",
    aggregation_rule = "published county value on the matching wave boundary",
    uncertainty_display = "quality_flag",
    default_visibility = TRUE,
    notes = "The year selector must switch to the matching per-vintage county boundary."
  ),
  list(
    visual_layer_id = "ee-county-no-religion-share",
    label = "No religious affiliation share",
    description = "No religious affiliation among the population aged 15 and over by county.",
    layer_type = "choropleth",
    indicator_ids = list("no_religion_percent"),
    geometry_unit_type = "area_unit",
    legend = list(unit = "percent", denominator = "population aged 15+"),
    colour_scale = "sequential",
    time_control = "year_selector",
    aggregation_rule = "published county value on the matching wave boundary",
    uncertainty_display = "quality_flag",
    default_visibility = FALSE,
    notes = "The 2000 mapping combines the source's no-affiliation and atheist categories."
  )
)

area_summary <- list(
  schema_version = "0.2.0",
  generated_at = stamp,
  generated_by = script_id,
  country_code = country_code,
  boundary_set = list(
    boundary_set_id = "ee-county-period-maaamet",
    country_code = country_code,
    level = "county",
    vintage = "2000, 2011, and 2021 period county vintages",
    source_dataset_id = paste(
      vapply(waves, `[[`, character(1), "boundary_dataset_id"),
      collapse = "|"
    )
  ),
  site_snapshot = list(
    source_dataset_id = NULL,
    snapshot_date = NULL,
    basis = "no governed Estonia place-of-worship snapshot is included in this census-affiliation release",
    notes = "The Estonia lane ships census-affiliation metrics only."
  ),
  source_datasets = source_datasets,
  indicators = indicators,
  visual_layers = visual_layers,
  rows = all_rows
)
write_json(area_summary, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", digits = NA)
utils::write.csv(flatten_rows(all_rows), summary_csv_out, row.names = FALSE, na = "")

if (!jsonlite::validate(readChar(summary_json_out, file_bytes(summary_json_out), useBytes = TRUE))) {
  stop("area-summary output failed JSON syntax validation", call. = FALSE)
}
validate_json_schema("schemas/area-summary.schema.json", summary_json_out)

raw_records <- list()
for (wave_name in names(waves)) {
  wave <- waves[[wave_name]]
  raw_records <- c(raw_records, list(
    raw_source_record(wave[["metadata_en_path"]], wave[["api_url_en"]]),
    raw_source_record(wave[["metadata_et_path"]], wave[["api_url_et"]]),
    raw_source_record(wave[["data_path"]], wave[["api_url_en"]], "POST", px_queries[[wave_name]]),
    raw_source_record(wave[["boundary_raw_path"]], wave[["boundary_url"]])
  ))
}
for (wave_name in names(branch_urls)) {
  raw_records <- c(raw_records, list(raw_source_record(
    branch_paths[[wave_name]], branch_urls[[wave_name]]
  )))
}
raw_records <- c(raw_records, list(
  raw_source_record(terms_path, terms_url),
  raw_source_record(religion_2021_method_path, religion_2021_method_url),
  raw_source_record(boundary_catalogue_path, boundary_catalogue_url),
  raw_source_record(boundary_licence_path, boundary_licence_url),
  raw_source_record(wfs_capabilities_path, wfs_capabilities_url)
))

output_paths <- c(
  summary_json_out,
  summary_csv_out,
  vapply(waves, `[[`, character(1), "boundary_out")
)
output_hashes <- vapply(output_paths, sha256_file, character(1))
raw_hashes <- vapply(raw_records, `[[`, character(1), "sha256")
version_hash <- substr(sha256_values(c(raw_hashes, output_hashes)), 1L, 12L)
git_commit <- trimws(system2("git", c("rev-parse", "--short", "HEAD"), stdout = TRUE))

construct_notes <- list(
  "Indicator declaration: self-reported census religious affiliation among the population aged 15 and over.",
  paste(
    "Every denominator is the published population aged 15 and over in the same",
    "county and wave. Total population is never used."
  ),
  paste(
    "The 2021 religion characteristic comes from the census sample survey and is",
    "generalised to the full population aged 15 and over. Religion itself is not",
    "register-supplemented. Published counts remain rounded to tens."
  ),
  paste(
    "The 2000 no-religion headline is Has no religious affiliation plus Atheist.",
    "The 2011 and 2021 headlines use Does not feel an affiliation to any religion."
  ),
  paste(
    "Refused, cannot define, and relationship-unknown categories remain in the",
    "age-15-plus denominator and outside both headline numerators."
  ),
  paste(
    "The product uses official county geography for each wave. Statistics Estonia",
    "does not publish these earlier religion tables rebased to current counties or",
    "municipalities, and the build creates no concordance."
  ),
  list(note_type = "category_mapping", year = 2000L, mappings = category_mappings[["2000"]]),
  list(note_type = "category_mapping", year = 2011L, mappings = category_mappings[["2011"]]),
  list(note_type = "category_mapping", year = 2021L, mappings = category_mappings[["2021"]])
)

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = paste0("manifest:ee-census-religion:ee:2000-2021:", version_hash),
  dataset_id = "ee-census-religion:ee:2000-2021:stat-ee-maaamet",
  dataset_version_id = paste0(
    "ee-census-religion:ee:2000-2021:stat-ee-maaamet:", version_hash
  ),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "ee-census-religion",
  dataset_role = "public_product",
  scope = list(
    level = "country",
    country_codes = list("EE"),
    snapshot_date = NULL,
    pipeline_stage = "public"
  ),
  created_at = stamp,
  created_by = script_id,
  pipeline = list(
    script = script_id,
    git_commit = git_commit,
    command = paste("Rscript", script_id),
    parameters = list(
      waves = list(2000L, 2011L, 2021L),
      geography = "15 counties on period-specific official boundaries",
      universe = "population aged 15 and over",
      pxweb_queries = px_queries,
      boundary_layers = lapply(waves, function(wave) {
        list(
          layer = wave[["boundary_layer"]],
          vintage = wave[["boundary_vintage"]],
          boundary_set_id = wave[["boundary_set_id"]]
        )
      }),
      category_mapping_location = "construct_notes entries with note_type=category_mapping",
      rounding_rule = paste(
        "2021 published values must remain multiples of ten; discrepancies must",
        "remain within the deterministic source-rounding gate; no residual is distributed"
      ),
      boundary_simplification = "scripts/lib/simplify_boundary.R; 750000-byte cap per vintage"
    ),
    software_versions = list(
      R = paste(R.version$major, R.version$minor, sep = "."),
      sf = as.character(utils::packageVersion("sf")),
      jsonlite = as.character(utils::packageVersion("jsonlite"))
    )
  ),
  source = list(
    provider = "Statistics Estonia; Estonian Land and Spatial Development Board",
    source_dataset_ids = as.list(vapply(source_datasets, `[[`, character(1), "source_dataset_id")),
    source_urls = as.list(unique(c(
      vapply(waves, `[[`, character(1), "api_url_en"),
      vapply(waves, `[[`, character(1), "boundary_url"),
      terms_url,
      religion_2021_method_url,
      boundary_catalogue_url,
      boundary_licence_url
    ))),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = paste(
      "Statistics Estonia open data: CC BY-SA 4.0 with source attribution.",
      "Maa-amet (Estonian Land Board) boundary data: official open-data licence",
      "with source and vintage attribution; no Creative Commons identifier claimed."
    ),
    citation = paste(
      "Statistics Estonia PXWeb RL229, RL0453, and RL21452; Estonian Land and",
      "Spatial Development Board historical administrative division WFS",
      "(Web Feature Service)."
    )
  ),
  input_manifests = list(),
  durable_files = list(
    durable_file_record(
      summary_json_out, "Estonia three-wave county area-summary JSON",
      licence_status_dataset, row_count = 45L
    ),
    durable_file_record(
      summary_csv_out, "Estonia three-wave county area-summary CSV",
      licence_status_dataset, row_count = 45L
    ),
    durable_file_record(
      waves[["2000"]][["boundary_out"]], "Estonia 2000 county boundary",
      licence_status_boundary, feature_count = 15L
    ),
    durable_file_record(
      waves[["2011"]][["boundary_out"]], "Estonia 2011 county boundary",
      licence_status_boundary, feature_count = 15L
    ),
    durable_file_record(
      waves[["2021"]][["boundary_out"]], "Estonia 2021 county boundary",
      licence_status_boundary, feature_count = 15L
    )
  ),
  partitions = lapply(names(waves), function(wave_name) {
    wave <- waves[[wave_name]]
    list(
      partition_id = paste0("ee-county-", wave_name),
      partition_type = "area",
      file_uri = paste0("repo:", summary_json_out),
      sha256 = sha256_file(summary_json_out),
      country_code = "EE",
      snapshot_date = NULL,
      stage = "public"
    )
  }),
  stats = list(
    waves = 3L,
    years = "2000, 2011, 2021",
    county_rows = 45L,
    counties_per_wave = 15L,
    categories_2000 = length(category_mappings[["2000"]]),
    categories_2011 = length(category_mappings[["2011"]]),
    categories_2021 = length(category_mappings[["2021"]]),
    boundary_features_per_vintage = 15L
  ),
  local_cache_hint = "data/raw/ee_census/ (git-ignored; every cached source is listed and hashed below)",
  validation = list(
    status = "passed",
    commands = list(
      paste("Rscript", script_id),
      paste(
        "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile",
        "schemas/area-summary.schema.json",
        summary_json_out
      ),
      paste("jq empty", manifest_out)
    ),
    warnings = list(
      paste(
        "The three waves use period-specific county polygons. Repeated county",
        "names do not establish unchanged geography, and the product reports no",
        "cross-wave county change statistic."
      ),
      paste(
        "The 2021 values are survey estimates published in tens. Source-unavailable",
        "minor religion cells remain null in raw data and are never imputed."
      ),
      paste(
        "The 2000 age-15-plus universe also includes persons whose age was unknown,",
        "as stated in the source footnote."
      )
    ),
    notes = paste(
      "All three waves are present with 15 county rows. Headline values are complete.",
      "The 2000 and 2011 complete county category sums reconcile exactly to the",
      "published national rows. The 2021 discrepancies remain within the source's",
      "documented rounding behaviour; published counts are unchanged. All three",
      "boundary outputs contain 15 valid, non-empty, distinctly hashed geometries."
    ),
    reconciliation = wave_results,
    geometry_validation = geometry_validation,
    provenance = list(
      raw_source_count = length(raw_records),
      every_raw_source_has_url_date_sha256 = all(vapply(raw_records, function(record) {
        nzchar(record[["url"]]) && nzchar(record[["retrieval_date"]]) &&
          grepl("^[a-f0-9]{64}$", record[["sha256"]])
      }, logical(1)))
    )
  ),
  construct_notes = construct_notes,
  privacy = "public",
  licence_status = licence_status_dataset,
  downstream_status = "public",
  notes = paste(
    "County census-affiliation product for the population aged 15 and over.",
    "A region page is outside this build."
  ),
  raw_sources = raw_records,
  derived_outputs = lapply(output_paths, function(path) {
    list(uri = paste0("repo:", path), sha256 = sha256_file(path), built_by = script_id)
  }),
  source_datasets = source_datasets
)
write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", digits = NA)

if (!jsonlite::validate(readChar(manifest_out, file_bytes(manifest_out), useBytes = TRUE))) {
  stop("manifest output is not valid JSON", call. = FALSE)
}

message(
  "built Estonia county census-affiliation product: ", length(all_rows),
  " rows across 2000, 2011, and 2021; boundaries ",
  paste(vapply(waves, function(wave) file_bytes(wave[["boundary_out"]]), integer(1)), collapse = "/"),
  " bytes"
)
