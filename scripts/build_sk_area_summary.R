# build the slovakia municipality area-summary product from SODB 2021.
# inputs: SODB 2021 Z01_15 religious-belief JSON files by district,
# the SODB 2021 national Z01_15 JSON, and the SODB 2021 OB GeoJSON.
# outputs: apps/regions/sk/data/sk_municipality_2021.geojson,
# apps/regions/sk/data/area_summary_municipality.{json,csv}, and
# docs/manifests/sk-census-religion-2021.json.
# run from the repo root: Rscript scripts/build_sk_area_summary.R

suppressMessages({
  library(jsonlite)
  library(sf)
})

raw_dir <- "data/raw/sk_census"
district_dir <- file.path(raw_dir, "sodb2021_z01_15_by_district")
sk_dir <- "apps/regions/sk/data"
manifest_dir <- "docs/manifests"
dir.create(sk_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- format(Sys.Date(), "%Y-%m-%d")
script_id <- "scripts/build_sk_area_summary.R"
country_code <- "SK"
year <- 2021L

boundary_set_id <- "sk-municipality-2021-sodb"
census_dataset_id <- "sodb2021-z01-15-religious-belief-basic-results"
boundary_dataset_id <- "sodb2021-disem-ob-geojson"
time_series_dataset_id <- "sodb2021-c01-11-religious-belief-time-series-national"

sodb_base_url <- "https://www.scitanie.sk"
basic_results_url <- paste0(
  sodb_base_url,
  "/en/population/basic-results/structure-of-population-by-religious-belief/SR/SK0/SR"
)
previous_censuses_url <- paste0(sodb_base_url, "/en/data-from-the-previous-censuses-since-1991")
content_operator_url <- paste0(sodb_base_url, "/en/content-and-technical-operator")
district_url_pattern <- paste0(
  sodb_base_url,
  "/themes/web-sodb/assets/public/disem/data/Z01_15_OK_%s_OB.json?v=10"
)
national_url <- paste0(
  sodb_base_url,
  "/themes/web-sodb/assets/public/disem/data/Z01_15_SR_SK0_SR.json?v=10"
)
all_districts_url <- paste0(
  sodb_base_url,
  "/themes/web-sodb/assets/public/disem/data/Z01_15_SR_SK0_OK.json?v=10"
)
boundary_url <- paste0(
  sodb_base_url,
  "/themes/web-sodb/assets/public/disem/geojson/OB.geojson"
)
time_series_url <- paste0(
  sodb_base_url,
  "/themes/web-sodb/assets/public/disem/data/C01_11.json?v=10"
)

district_codes <- c(
  "SK0221", "SK0321", "SK0322", "SK0411", "SK0101", "SK0102", "SK0103",
  "SK0104", "SK0105", "SK0323", "SK0311", "SK0312", "SK0324", "SK0313",
  "SK0211", "SK0212", "SK0421", "SK0213", "SK0412", "SK0222", "SK0413",
  "SK0231", "SK0426", "SK0422", "SK0423", "SK0424", "SK0425", "SK0325",
  "SK0314", "SK0232", "SK0414", "SK0315", "SK0326", "SK0106", "SK0316",
  "SK0415", "SK0427", "SK0223", "SK0317", "SK0233", "SK0224", "SK0234",
  "SK0225", "SK0107", "SK0214", "SK0327", "SK0416", "SK0226", "SK0417",
  "SK0227", "SK0228", "SK0328", "SK0329", "SK0428", "SK0318", "SK0418",
  "SK0108", "SK0215", "SK0216", "SK0419", "SK0429", "SK042A", "SK041A",
  "SK041B", "SK041C", "SK0235", "SK0236", "SK042B", "SK0229", "SK0217",
  "SK0319", "SK031A", "SK032A", "SK041D", "SK0237", "SK032B", "SK032C",
  "SK032D", "SK031B"
)

national_path <- file.path(raw_dir, "sodb2021_z01_15_religious_belief_structure_national.json")
all_districts_path <- file.path(raw_dir, "sodb2021_z01_15_religious_belief_structure_all_districts.json")
boundary_raw_path <- file.path(raw_dir, "sodb2021_ob_municipality_boundaries.geojson")
time_series_path <- file.path(raw_dir, "sodb2021_c01_11_religious_belief_time_series.json")
hypercube_metadata_path <- file.path(raw_dir, "sodb2011_hypercube_variable_names.xlsx")
codebook_path <- file.path(raw_dir, "sodb2011_codebooks_eurostat.xlsx")

boundary_out <- file.path(sk_dir, "sk_municipality_2021.geojson")
summary_json_out <- file.path(sk_dir, "area_summary_municipality.json")
summary_csv_out <- file.path(sk_dir, "area_summary_municipality.csv")
manifest_out <- file.path(manifest_dir, "sk-census-religion-2021.json")

licence_text <- paste(
  "SODB 2021 public website assets are published by the Statistical Office",
  "of the Slovak Republic. This build attributes SUSR and links the source;",
  "a specific CC BY statement was not located on the SODB pages during this pass."
)
licence_status <- "susr_public_sodb_attribution_required_statement_not_located"

# stop early if a required raw source has not been downloaded.
require_file <- function(path) {
  if (!file.exists(path)) stop("missing required source: ", path, call. = FALSE)
}

# compute the sha-256 digest for a local file.
sha256_file <- function(path) {
  unname(tools::sha256sum(path))
}

# return file size in bytes for manifest records.
file_bytes <- function(path) {
  as.integer(unname(file.info(path)[["size"]]))
}

# return NULL for a scalar that should serialise as JSON null.
null_if_na <- function(value) {
  if (length(value) == 0L || is.na(value) || !is.finite(value)) return(NULL)
  value
}

# list all raw district JSON paths in the expected official-code order.
district_paths <- function() {
  file.path(district_dir, paste0("Z01_15_OK_", district_codes, "_OB.json"))
}

# count rows or features for CSV, GeoJSON, and SODB JSON files.
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$", path)) {
    geo <- fromJSON(path, simplifyVector = FALSE)
    return(length(geo[["features"]]))
  }
  if (grepl("\\.json$", path)) {
    json <- fromJSON(path, simplifyVector = FALSE)
    if (!is.null(json[["rows"]])) return(length(json[["rows"]]))
    if (!is.null(json[["table"]][["data"]])) return(length(json[["table"]][["data"]]))
  }
  NA_integer_
}

# extract one numeric SODB category value from a parsed row.
sodb_value <- function(row, code) {
  value <- row[["types"]][[code]][["value"]]
  if (is.null(value)) stop("missing SODB category code ", code, call. = FALSE)
  as.numeric(value)
}

# extract SODB municipality records from one district JSON file.
read_district_file <- function(path) {
  parsed <- fromJSON(path, simplifyVector = FALSE)
  if (!identical(parsed[["meta"]][["type"]], "Z01") ||
      !identical(parsed[["meta"]][["indicator"]], "15") ||
      !identical(parsed[["meta"]][["territoryUnit"]], "OB")) {
    stop("unexpected SODB district file metadata: ", path, call. = FALSE)
  }

  district_code <- parsed[["meta"]][["territorySpecification"]]
  rows <- parsed[["table"]][["data"]]
  do.call(rbind, lapply(names(rows), function(area_code) {
    row <- rows[[area_code]]
    total <- sodb_value(row, "total")
    no_religion <- sodb_value(row, "28")
    not_found_out <- sodb_value(row, "00")
    religious_affiliation <- total - no_religion - not_found_out
    data.frame(
      area_code = area_code,
      area_name = row[["name"]],
      area_name_en = row[["name_en"]],
      district_code = district_code,
      population_total = total,
      no_religion_count = no_religion,
      not_found_out_count = not_found_out,
      religious_affiliation_count = religious_affiliation,
      stringsAsFactors = FALSE
    )
  }))
}

# extract national SODB category totals from the national JSON file.
read_national_totals <- function(path) {
  parsed <- fromJSON(path, simplifyVector = FALSE)
  if (!identical(parsed[["meta"]][["type"]], "Z01") ||
      !identical(parsed[["meta"]][["indicator"]], "15") ||
      !identical(parsed[["meta"]][["territoryUnit"]], "SR")) {
    stop("unexpected SODB national file metadata: ", path, call. = FALSE)
  }
  row <- parsed[["table"]][["data"]][["SK0"]]
  total <- sodb_value(row, "total")
  no_religion <- sodb_value(row, "28")
  not_found_out <- sodb_value(row, "00")
  list(
    population_total = total,
    no_religion_count = no_religion,
    not_found_out_count = not_found_out,
    religious_affiliation_count = total - no_religion - not_found_out
  )
}

# create boundary geometry, metadata, and simplification details.
write_boundary_product <- function(boundary_path, census_codes) {
  boundary_raw <- st_read(boundary_path, quiet = TRUE)
  municipality_boundary <- boundary_raw[!is.na(boundary_raw[["okres_kod"]]), ]
  municipality_boundary[["area_code"]] <- municipality_boundary[["code"]]
  municipality_boundary[["area_name"]] <- municipality_boundary[["name"]]

  missing_boundary <- setdiff(census_codes, municipality_boundary[["area_code"]])
  extra_boundary <- setdiff(municipality_boundary[["area_code"]], census_codes)
  if (length(missing_boundary) || length(extra_boundary)) {
    stop(
      "SODB boundary/census code mismatch; missing boundary: ",
      paste(missing_boundary, collapse = ", "),
      "; extra boundary: ",
      paste(extra_boundary, collapse = ", "),
      call. = FALSE
    )
  }

  municipality_boundary <- municipality_boundary[match(census_codes, municipality_boundary[["area_code"]]), ]
  municipality_boundary <- st_make_valid(municipality_boundary)
  boundary_metric <- st_transform(municipality_boundary, 3035)
  area_table <- st_drop_geometry(boundary_metric)
  area_table[["land_area_sq_km"]] <- as.numeric(st_area(boundary_metric)) / 1e6
  area_table <- area_table[, c("area_code", "area_name", "okres_kod", "kraj_kod", "land_area_sq_km")]

  boundary_export <- st_sf(
    area_code = boundary_metric[["area_code"]],
    area_name = boundary_metric[["area_name"]],
    area_unit_id = paste0(boundary_set_id, ":", boundary_metric[["area_code"]]),
    boundary_set_id = boundary_set_id,
    boundary_level = "municipality",
    district_code = boundary_metric[["okres_kod"]],
    region_code = boundary_metric[["kraj_kod"]],
    land_area_sq_km = round(area_table[["land_area_sq_km"]], 2),
    geometry = st_geometry(boundary_metric)
  )

  tolerances <- c(10, 25, 50, 100, 200, 500, 1000, 1500, 2000)
  chosen_tolerance <- tail(tolerances, 1)
  chosen_bytes <- NA_integer_
  for (tolerance in tolerances) {
    candidate <- st_simplify(boundary_export, dTolerance = tolerance, preserveTopology = TRUE)
    candidate <- st_make_valid(st_transform(candidate, 4326))
    st_write(candidate, boundary_out, delete_dsn = TRUE, quiet = TRUE)
    chosen_bytes <- file_bytes(boundary_out)
    chosen_tolerance <- tolerance
    if (chosen_bytes <= 3000000L) break
  }
  if (chosen_bytes > 3000000L) {
    stop("simplified SK boundary exceeds 3 MB: ", chosen_bytes, call. = FALSE)
  }

  list(
    area_table = area_table,
    source_feature_count = nrow(boundary_raw),
    output_feature_count = row_count_file(boundary_out),
    expected_feature_count = length(census_codes),
    simplification_tolerance_m = chosen_tolerance,
    output_bytes = chosen_bytes,
    parent_helper_feature_count = nrow(boundary_raw) - nrow(municipality_boundary),
    missing_boundary_codes = missing_boundary,
    extra_boundary_codes = extra_boundary
  )
}

# create one schema-shaped area-summary row for one municipality.
build_area_row <- function(count_row, area_table) {
  area <- area_table[match(count_row[["area_code"]], area_table[["area_code"]]), ]
  if (nrow(area) != 1L || is.na(area[["land_area_sq_km"]])) {
    stop("missing boundary metadata for ", count_row[["area_code"]], call. = FALSE)
  }

  total <- as.numeric(count_row[["population_total"]])
  religious_affiliation <- as.numeric(count_row[["religious_affiliation_count"]])
  no_religion <- as.numeric(count_row[["no_religion_count"]])

  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = "municipality",
    area_unit_id = paste0(boundary_set_id, ":", count_row[["area_code"]]),
    area_code = count_row[["area_code"]],
    area_name = count_row[["area_name"]],
    year = year,
    population_total = as.integer(total),
    population_total_basis = "SODB 2021 total population denominator used in published shares; includes the category nezistené / not found out",
    religious_affiliation_count = as.integer(religious_affiliation),
    religious_affiliation_percent = null_if_na(round(100 * religious_affiliation / total, 2)),
    no_religion_count = as.integer(no_religion),
    no_religion_percent = null_if_na(round(100 * no_religion / total, 2)),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(area[["land_area_sq_km"]], 2),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = c(census_dataset_id, boundary_dataset_id),
    quality_flag = "sodb_published_total_denominator_includes_nezistene"
  )
}

# flatten area-summary rows for the CSV sibling.
flatten_rows <- function(rows) {
  # keep JSON null scalars from turning the one-row CSV data frame into zero rows.
  csv_scalar <- function(value, missing_value) {
    if (is.null(value)) return(missing_value)
    value
  }

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
      religious_affiliation_percent = csv_scalar(row[["religious_affiliation_percent"]], NA_real_),
      no_religion_count = row[["no_religion_count"]],
      no_religion_percent = csv_scalar(row[["no_religion_percent"]], NA_real_),
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

# create source-dataset records for the area-summary document.
source_datasets <- function() {
  list(
    list(
      source_dataset_id = census_dataset_id,
      name = "SODB 2021 Z01_15: Structure of population by religious belief",
      provider = "Statistical Office of the Slovak Republic",
      url = basic_results_url,
      retrieval_date = retrieval_date,
      local_path = district_dir,
      licence = list(
        name = "SODB public website assets; attribution to the Statistical Office of the Slovak Republic",
        url = content_operator_url,
        attribution = "Statistical Office of the Slovak Republic"
      ),
      citation = "Statistical Office of the Slovak Republic. SODB 2021 basic results, Z01_15 Structure of population by religious belief.",
      access_limits = NULL,
      redistribution_limits = "Raw JSON files are not committed; derived public products attribute SUSR and link to the source.",
      notes = "The product uses 79 official district-scoped municipality JSON files. The denominator is the SODB total population denominator, including nezistené / not found out, to match SUSR's published percentages."
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "SODB 2021 OB GeoJSON municipality and city-part boundaries",
      provider = "Statistical Office of the Slovak Republic",
      url = boundary_url,
      retrieval_date = retrieval_date,
      local_path = boundary_raw_path,
      licence = list(
        name = "SODB public website assets; attribution to the Statistical Office of the Slovak Republic",
        url = content_operator_url,
        attribution = "Statistical Office of the Slovak Republic"
      ),
      citation = "Statistical Office of the Slovak Republic. SODB 2021 DISem OB GeoJSON boundary layer.",
      access_limits = NULL,
      redistribution_limits = "Raw GeoJSON is not committed; simplified derived boundary GeoJSON attributes SUSR and links to the source.",
      notes = "The raw GeoJSON includes 87 non-output helper features and 2,927 municipality/city-part output features. Bratislava and Košice are represented by city parts, matching SODB basic-results reporting."
    )
  )
}

# create shared indicator metadata for the municipality product.
indicators_for_municipality <- function() {
  denominator_note <- paste(
    "SODB 2021 publishes category shares against total population.",
    "The denominator includes the not-found-out category (nezistené)."
  )
  list(
    list(
      indicator_id = "population_total",
      label = "SODB total population denominator",
      description = "Total population in the SODB 2021 municipality or city-part reporting unit.",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "SODB Z01_15 table category total.",
      temporal_coverage = "2021",
      spatial_coverage = "Slovakia municipalities and Bratislava/Košice city parts in SODB 2021.",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious affiliation %",
      description = "Share of total population in any SODB religious-belief category other than no religion and not found out.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * (total - code 28 bez náboženského vyznania - code 00 nezistené) / total.",
      temporal_coverage = "2021",
      spatial_coverage = "Slovakia municipalities and Bratislava/Košice city parts in SODB 2021.",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "No religion %",
      description = "Share of total population in SODB code 28, bez náboženského vyznania.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * code 28 bez náboženského vyznania / total.",
      temporal_coverage = "2021",
      spatial_coverage = "Slovakia municipalities and Bratislava/Košice city parts in SODB 2021.",
      quality_notes = denominator_note
    )
  )
}

# define the choropleth layers exposed by the shared region map.
visual_layers_for_municipality <- function() {
  list(
    list(
      visual_layer_id = "sk-municipality-religious-affiliation",
      label = "Religious affiliation %",
      description = "Slovakia SODB 2021 religious-affiliation share.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "SODB total population"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = "The denominator includes the SODB not-found-out category."
    ),
    list(
      visual_layer_id = "sk-municipality-no-religion",
      label = "No religion %",
      description = "Slovakia SODB 2021 no-religion share.",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "SODB total population"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = "No religion is SODB code 28, bez náboženského vyznania."
    )
  )
}

# create a schema-compatible area-summary document.
area_summary_document <- function(rows) {
  list(
    schema_version = "0.2.0",
    generated_at = stamp,
    generated_by = script_id,
    country_code = country_code,
    boundary_set = list(
      boundary_set_id = boundary_set_id,
      country_code = country_code,
      level = "municipality",
      vintage = "2021",
      source_dataset_id = boundary_dataset_id
    ),
    site_snapshot = list(
      source_dataset_id = NULL,
      snapshot_date = NULL,
      basis = "no governed Slovakia OpenStreetMap place-of-worship snapshot is included in this country data-map release",
      notes = "The Slovakia page exposes SODB 2021 religious-affiliation and no-religion metrics only; place-density metrics are hidden until a governed Slovakia place layer is built."
    ),
    source_datasets = source_datasets(),
    indicators = indicators_for_municipality(),
    visual_layers = visual_layers_for_municipality(),
    rows = rows
  )
}

# create a manifest durable-file record for one generated output.
manifest_file_record <- function(path, content, licence_status_value = licence_status) {
  list(
    uri = paste0("repo:", path),
    storage_provider = "git_repository",
    format = sub("^.*\\.", "", path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    row_count = row_count_file(path),
    content = content,
    privacy = "public",
    licence_status = licence_status_value
  )
}

# create manifest raw-source records for every required SODB JSON file.
raw_source_records <- function(required_paths) {
  district_records <- lapply(district_codes, function(code) {
    path <- file.path(district_dir, paste0("Z01_15_OK_", code, "_OB.json"))
    list(
      uri = path,
      url = sprintf(district_url_pattern, code),
      format = "json",
      bytes = file_bytes(path),
      sha256 = sha256_file(path),
      row_count = row_count_file(path),
      source_dataset_id = census_dataset_id,
      used_in_public_product = TRUE,
      periods = "2021",
      notes = paste0("SODB 2021 Z01_15 municipality rows for district ", code, ".")
    )
  })
  other_records <- list(
    list(
      uri = national_path,
      url = national_url,
      format = "json",
      bytes = file_bytes(national_path),
      sha256 = sha256_file(national_path),
      row_count = row_count_file(national_path),
      source_dataset_id = census_dataset_id,
      used_in_public_product = TRUE,
      periods = "2021",
      notes = "SODB 2021 Z01_15 national row used for exact reconciliation."
    ),
    list(
      uri = all_districts_path,
      url = all_districts_url,
      format = "json",
      bytes = file_bytes(all_districts_path),
      sha256 = sha256_file(all_districts_path),
      row_count = row_count_file(all_districts_path),
      source_dataset_id = census_dataset_id,
      used_in_public_product = FALSE,
      periods = "2021",
      notes = "SODB 2021 Z01_15 district rows downloaded for source-pinning and reporting; municipality product is built from district-scoped municipality files."
    ),
    list(
      uri = boundary_raw_path,
      url = boundary_url,
      format = "geojson",
      bytes = file_bytes(boundary_raw_path),
      sha256 = sha256_file(boundary_raw_path),
      row_count = row_count_file(boundary_raw_path),
      source_dataset_id = boundary_dataset_id,
      used_in_public_product = TRUE,
      periods = "2021",
      notes = "SODB 2021 OB GeoJSON; 87 helper features are filtered out before writing the municipality boundary product."
    )
  )
  optional_paths <- required_paths[!required_paths %in% c(district_paths(), national_path, all_districts_path, boundary_raw_path)]
  optional_records <- lapply(optional_paths[file.exists(optional_paths)], function(path) {
    dataset <- if (identical(path, time_series_path)) time_series_dataset_id else "sodb2011-source-discovery"
    list(
      uri = path,
      url = if (identical(path, time_series_path)) time_series_url else previous_censuses_url,
      format = sub("^.*\\.", "", path),
      bytes = file_bytes(path),
      sha256 = sha256_file(path),
      row_count = row_count_file(path),
      source_dataset_id = dataset,
      used_in_public_product = FALSE,
      periods = if (identical(path, time_series_path)) "1880-2021" else "2011",
      notes = "Downloaded during source discovery but not extracted into the public map product."
    )
  })
  c(district_records, other_records, optional_records)
}

# compare municipality public metrics with the SODB national row.
validate_national_totals <- function(counts, national_totals) {
  checks <- list(
    list(
      year = year,
      metric = "population_total",
      municipality_sum = sum(counts[["population_total"]]),
      national_total = national_totals[["population_total"]],
      difference = sum(counts[["population_total"]]) - national_totals[["population_total"]]
    ),
    list(
      year = year,
      metric = "religious_affiliation_count",
      municipality_sum = sum(counts[["religious_affiliation_count"]]),
      national_total = national_totals[["religious_affiliation_count"]],
      difference = sum(counts[["religious_affiliation_count"]]) - national_totals[["religious_affiliation_count"]]
    ),
    list(
      year = year,
      metric = "no_religion_count",
      municipality_sum = sum(counts[["no_religion_count"]]),
      national_total = national_totals[["no_religion_count"]],
      difference = sum(counts[["no_religion_count"]]) - national_totals[["no_religion_count"]]
    ),
    list(
      year = year,
      metric = "not_found_out_count",
      municipality_sum = sum(counts[["not_found_out_count"]]),
      national_total = national_totals[["not_found_out_count"]],
      difference = sum(counts[["not_found_out_count"]]) - national_totals[["not_found_out_count"]]
    )
  )
  for (check in checks) {
    if (check[["difference"]] != 0) {
      stop("national validation failed for ", check[["metric"]], call. = FALSE)
    }
  }
  checks
}

required_sources <- c(district_paths(), national_path, all_districts_path, boundary_raw_path)
for (path in required_sources) require_file(path)

district_json <- lapply(district_paths(), read_district_file)
counts <- do.call(rbind, district_json)
counts <- counts[order(counts[["area_code"]]), ]
if (nrow(counts) != length(unique(counts[["area_code"]]))) {
  stop("duplicate SODB municipality codes in district files", call. = FALSE)
}
if (nrow(counts) != 2927L) stop("expected 2,927 SODB municipality/city-part rows", call. = FALSE)

national_totals <- read_national_totals(national_path)
national_validation <- validate_national_totals(counts, national_totals)

boundary_info <- write_boundary_product(boundary_raw_path, counts[["area_code"]])
area_table <- boundary_info[["area_table"]]

rows <- lapply(seq_len(nrow(counts)), function(index) {
  build_area_row(as.list(counts[index, ]), area_table)
})

write_json(area_summary_document(rows), summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

join_coverage <- list(
  year = year,
  matched_area_count = length(intersect(counts[["area_code"]], area_table[["area_code"]])),
  expected_area_count = nrow(counts),
  missing_area_names = list()
)

validation_checks <- c(
  "SODB 2021 Z01_15 municipality rows were downloaded as 79 official district-scoped JSON files.",
  "The 2,927 SODB municipality/city-part rows have unique official area codes.",
  "All 2,927 SODB municipality/city-part rows join exactly to the OB GeoJSON municipality/city-part features.",
  "Municipality sums match the SODB national row exactly for total population, religious affiliation, no religion, and not found out.",
  sprintf("The simplified municipality boundary GeoJSON writes to %d bytes after %d m simplification.", boundary_info[["output_bytes"]], boundary_info[["simplification_tolerance_m"]]),
  "SODB 2021 percentages use the total population denominator, including the not-found-out category, matching SUSR's published shares.",
  "1991, 2001, and 2011 subnational waves are deferred because no official boundary concordance or clean machine-readable extraction route was completed in this timebox."
)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:sk-census-religion:sk:2021:sodb2021-z01-15",
  dataset_id = "sk-census-religion:sk:2021:sodb2021-z01-15",
  dataset_version_id = paste0("sk-census-religion:sk:2021:sodb2021-z01-15:", substr(sha256_file(summary_json_out), 1, 12)),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "sk-census-religion",
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
    git_commit = NULL,
    command = paste("Rscript", script_id),
    parameters = list(
      waves = c("2021"),
      municipality_boundary_set = boundary_set_id,
      municipality_boundary_simplification_tolerance_m = boundary_info[["simplification_tolerance_m"]],
      denominator = "SODB Z01_15 total population denominator, including code 00 nezistené / not found out",
      omitted_metrics = c("religious_change", "places_per_10000_residents", "place_density_per_sq_km")
    ),
    software_versions = list(
      r = paste(R.version[["major"]], R.version[["minor"]], sep = "."),
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite"))
    )
  ),
  source = list(
    provider = "Statistical Office of the Slovak Republic",
    source_dataset_ids = c(census_dataset_id, boundary_dataset_id),
    source_urls = c(
      basic_results_url,
      sprintf(district_url_pattern, "SK0101"),
      national_url,
      all_districts_url,
      boundary_url,
      previous_censuses_url,
      content_operator_url
    ),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = licence_text,
    citation = "Statistical Office of the Slovak Republic, SODB 2021 basic results Z01_15; SODB 2021 DISem OB GeoJSON.",
    raw_redistribution = "Raw SODB JSON, GeoJSON, and source-discovery files are not committed. They remain in data/raw/sk_census/ and await any project-controlled raw archive upload."
  ),
  input_manifests = list(),
  raw_sources = raw_source_records(c(required_sources, time_series_path, hypercube_metadata_path, codebook_path)),
  durable_files = list(
    manifest_file_record(summary_json_out, "Slovakia municipality/city-part area summary with SODB 2021 religious-belief metrics."),
    manifest_file_record(summary_csv_out, "Flattened Slovakia municipality/city-part area summary with SODB 2021 religious-belief metrics."),
    manifest_file_record(boundary_out, "Simplified Slovakia SODB 2021 municipality/city-part boundary GeoJSON.")
  ),
  derived_outputs = list(
    list(
      uri = paste0("repo:", summary_json_out),
      sha256 = sha256_file(summary_json_out),
      built_by = script_id,
      notes = "2,927 SODB municipality/city-part reporting units x 1 census year; denominator is SODB total population including not found out."
    ),
    list(
      uri = paste0("repo:", boundary_out),
      sha256 = sha256_file(boundary_out),
      built_by = script_id,
      notes = sprintf("SODB 2021 OB municipality/city-part layer simplified at %d m tolerance.", boundary_info[["simplification_tolerance_m"]])
    )
  ),
  validation = list(
    checks = validation_checks,
    join_coverage = list(municipality = list(join_coverage)),
    national_validation = national_validation,
    boundary_validation = list(
      source_feature_count = boundary_info[["source_feature_count"]],
      municipality_output_feature_count = boundary_info[["output_feature_count"]],
      expected_municipality_feature_count = boundary_info[["expected_feature_count"]],
      parent_helper_feature_count_filtered = boundary_info[["parent_helper_feature_count"]],
      output_bytes = boundary_info[["output_bytes"]],
      simplification_tolerance_m = boundary_info[["simplification_tolerance_m"]],
      missing_boundary_codes = as.list(boundary_info[["missing_boundary_codes"]]),
      extra_boundary_codes = as.list(boundary_info[["extra_boundary_codes"]])
    )
  ),
  construct_notes = list(
    "The public map displays two headline metrics for 2021: religious affiliation percent and no religion percent.",
    "Religious affiliation count is total population minus code 28 bez náboženského vyznania and code 00 nezistené.",
    "No religion count is code 28 bez náboženského vyznania.",
    "The denominator is SODB total population because SUSR's published Z01_15 shares use total population, including code 00 nezistené.",
    "No cross-wave denomination crosswalk is attempted; older subnational waves are deferred until their official extraction route and boundary concordance are pinned."
  ),
  deferred_sources = list(
    list(
      source_dataset_id = time_series_dataset_id,
      url = time_series_url,
      local_path = time_series_path,
      notes = "Downloaded national time-series file C01_11, 'Number of population by religious belief in the Slovak Republic in 1880-2021'. It is not used in the map because its time-series categories collapse 'other and not found out', which prevents the requested no-religion/not-ascertained denominator treatment."
    ),
    list(
      source_dataset_id = "sodb2011-datacube-and-hypercubes",
      url = "http://datacube.statistics.sk/#!/folder/sk/1000398",
      local_path = hypercube_metadata_path,
      notes = "The official previous-censuses page points 2011 users to DATAcube, archived hyper-cubes, multidimensional tables, and other results. The static hyper-cube tree was checked, but a reliable religious-belief municipality extraction was not completed in the timebox."
    ),
    list(
      source_dataset_id = "sodb2001-infostat-results",
      url = "http://sodb.infostat.sk/scitanie/sk/2001/format.htm",
      local_path = NULL,
      notes = "Official 2001 source route from the SODB previous-censuses page. The endpoint did not return usable content during the bounded probe; extraction is deferred."
    ),
    list(
      source_dataset_id = "sodb1991-infostat-results",
      url = "http://sodb.infostat.sk/scitanie/sk/1991/format.htm",
      local_path = NULL,
      notes = "Official 1991 source route from the SODB previous-censuses page. The endpoint did not return usable content during the bounded probe; extraction is deferred."
    )
  ),
  privacy = "public",
  licence_status = licence_status,
  downstream_status = "public",
  source_datasets = source_datasets(),
  notes = "The committed products contain derived area summaries and simplified boundaries only. On-page attribution cites SUSR and the SODB 2021 source pages."
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
manifest_text <- paste(readLines(manifest_out, warn = FALSE), collapse = "\n")
if (!jsonlite::validate(manifest_text)) stop("manifest JSON failed jsonlite validation", call. = FALSE)

cat(sprintf("wrote %s: %d rows\n", summary_json_out, length(rows)))
cat(sprintf("wrote %s: %d rows\n", summary_csv_out, row_count_file(summary_csv_out)))
cat(sprintf("wrote %s: %d features, %d bytes\n", boundary_out, row_count_file(boundary_out), file_bytes(boundary_out)))
cat(sprintf("wrote %s\n", manifest_out))
cat(sprintf("join coverage: %d/%d\n", join_coverage[["matched_area_count"]], join_coverage[["expected_area_count"]]))
cat("national validations: exact\n")
