# build the iceland administrative-membership national area-summary product.
# inputs: statistics iceland px-web MAN10001, source metadata and terms,
# and geoboundaries gbOpen ISL ADM0 metadata and geometry.
# outputs: apps/regions/is/data/area_summary_adm0.{json,csv},
# apps/regions/is/data/is_adm0_2020.geojson, and
# docs/manifests/is-membership-1998-2026.json.
# run from the repo root: Rscript scripts/build_is_area_summary.R

suppressMessages({
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

raw_dir <- "data/raw/is_membership"
output_dir <- "apps/regions/is/data"
manifest_dir <- "docs/manifests"
dir.create(raw_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(output_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

retrieval_date <- "2026-07-10"
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
script_id <- "scripts/build_is_area_summary.R"
country_code <- "IS"
table_id <- "MAN10001.px"
table_dataset_id <- "statice-px-man10001-membership-1998-2026"
boundary_dataset_id <- "geoboundaries-gbopen-isl-adm0-9469f09"
boundary_set_id <- "is-adm0-2020-geoboundaries-9469f09"

px_en_base <- "https://px.hagstofa.is/pxen/api/v1/en/Samfelag/menning/5_trufelog"
px_is_base <- "https://px.hagstofa.is/pxis/api/v1/is/Samfelag/menning/5_trufelog"
px_table_url <- paste(px_en_base, "trufelog", table_id, sep = "/")
px_table_is_url <- paste(px_is_base, "trufelog", table_id, sep = "/")
px_branch_en_url <- paste(px_en_base, "trufelog", sep = "/")
px_branch_is_url <- paste(px_is_base, "trufelog", sep = "/")
px_earlier_en_url <- paste(px_en_base, "trufelogeldra", sep = "/")
px_parish_url <- paste(px_en_base, "trufelog", "MAN10289.px", sep = "/")
px_registration_url <- paste(px_en_base, "trufelogeldra", "MAN10200.px", sep = "/")
terms_url <- "https://statice.is/publications/open-data-access/"
boundary_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/ISL/ADM0/"
boundary_url <- paste0(
  "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/",
  "releaseData/gbOpen/ISL/ADM0/geoBoundaries-ISL-ADM0.geojson"
)

branch_en_path <- file.path(raw_dir, "px_religious_tables_en.json")
branch_is_path <- file.path(raw_dir, "px_religious_tables_is.json")
earlier_en_path <- file.path(raw_dir, "px_religious_tables_earlier_en.json")
metadata_en_path <- file.path(raw_dir, "px_man10001_metadata_en.json")
metadata_is_path <- file.path(raw_dir, "px_man10001_metadata_is.json")
parish_metadata_path <- file.path(raw_dir, "px_man10289_metadata_en.json")
registration_metadata_path <- file.path(raw_dir, "px_man10200_metadata_en.json")
membership_path <- file.path(raw_dir, "px_man10001_membership_total_1998_2026.json")
terms_path <- file.path(raw_dir, "statistics_iceland_open_data_access.html")
boundary_meta_path <- file.path(raw_dir, "geoboundaries_isl_adm0_metadata.json")
boundary_raw_path <- file.path(raw_dir, "geoboundaries_isl_adm0_raw.geojson")

boundary_out <- file.path(output_dir, "is_adm0_2020.geojson")
summary_json_out <- file.path(output_dir, "area_summary_adm0.json")
summary_csv_out <- file.path(output_dir, "area_summary_adm0.csv")
manifest_out <- file.path(manifest_dir, "is-membership-1998-2026.json")

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

# validate a generated json product against its repository schema.
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
  result <- tryCatch(
    utils::download.file(url, tmp, mode = "wb", quiet = TRUE),
    error = function(error) error
  )
  if (inherits(result, "error") || !file.exists(tmp) || file_bytes(tmp) == 0L) {
    stop("failed to download ", url, call. = FALSE)
  }
  if (!file.rename(tmp, path)) stop("failed to cache ", path, call. = FALSE)
  invisible(path)
}

# post a px-web json query when the local response cache is absent.
fetch_px_post_if_missing <- function(url, query, path) {
  if (file.exists(path) && file_bytes(path) > 0L) return(invisible(path))
  query_path <- tempfile(fileext = ".json")
  tmp <- paste0(path, ".part")
  on.exit(unlink(c(query_path, tmp)), add = TRUE)
  write_json(query, query_path, auto_unbox = TRUE, pretty = TRUE, null = "null")
  args <- c(
    "--http1.1", "--tlsv1.2", "--fail", "--silent", "--show-error",
    "--max-time", "120", "-HContent-Type:application/json",
    "--data-binary", paste0("@", query_path), url, "-o", tmp
  )
  status <- system2("curl", args)
  if (!identical(status, 0L) || !file.exists(tmp) || file_bytes(tmp) == 0L) {
    stop("failed to query ", url, call. = FALSE)
  }
  if (!file.rename(tmp, path)) stop("failed to cache ", path, call. = FALSE)
  invisible(path)
}

# return a named metadata variable from a px-web table description.
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

# return category codes in the source order from a json-stat2 dimension.
dimension_codes <- function(dimension) {
  index <- dimension[["category"]][["index"]]
  names(sort(unlist(index, use.names = TRUE)))
}

# return category labels aligned to source-ordered json-stat2 codes.
dimension_labels <- function(dimension, codes) {
  labels <- unlist(dimension[["category"]][["label"]], use.names = TRUE)
  unname(labels[codes])
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
durable_file_record <- function(path, content, row_count = NULL, feature_count = NULL) {
  record <- list(
    uri = paste0("repo:", path),
    storage_provider = "other",
    format = sub("^.*\\.", "", path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    content = content,
    privacy = "public",
    licence_status = "accepted"
  )
  if (!is.null(row_count)) record[["row_count"]] <- as.integer(row_count)
  if (!is.null(feature_count)) record[["feature_count"]] <- as.integer(feature_count)
  record
}

fetch_get_if_missing(px_branch_en_url, branch_en_path)
fetch_get_if_missing(px_branch_is_url, branch_is_path)
fetch_get_if_missing(px_earlier_en_url, earlier_en_path)
fetch_get_if_missing(px_table_url, metadata_en_path)
fetch_get_if_missing(px_table_is_url, metadata_is_path)
fetch_get_if_missing(px_parish_url, parish_metadata_path)
fetch_get_if_missing(px_registration_url, registration_metadata_path)
fetch_get_if_missing(terms_url, terms_path)
fetch_get_if_missing(boundary_meta_url, boundary_meta_path)
fetch_get_if_missing(boundary_url, boundary_raw_path)

metadata <- fromJSON(metadata_en_path, simplifyVector = FALSE)
year_variable <- metadata_variable(metadata, "Year")
religious_variable <- metadata_variable(metadata, "Religious")
division_variable <- metadata_variable(metadata, "Division")
years <- as.integer(unlist(year_variable[["values"]]))
religious_codes <- unlist(religious_variable[["values"]])
religious_labels <- unlist(religious_variable[["valueTexts"]])
division_codes <- unlist(division_variable[["values"]])
division_labels <- unlist(division_variable[["valueTexts"]])

if (!identical(years, 1998L:2026L)) {
  stop("source year coverage changed from the probed 1998-2026 span", call. = FALSE)
}
if (length(religious_codes) != 64L || length(division_codes) != 7L) {
  stop("source variable cardinality changed after the probe", call. = FALSE)
}
if (!identical(division_labels, c(
  "Total", "Males", "Females", "0 - 17 years", "18 years and over",
  "Percent", "Parish fees payers"
))) {
  stop("Division labels changed after the probe", call. = FALSE)
}

px_query <- list(
  query = list(
    list(
      code = year_variable[["code"]],
      selection = list(filter = "item", values = as.list(as.character(years)))
    ),
    list(
      code = religious_variable[["code"]],
      selection = list(filter = "all", values = list("*"))
    ),
    list(
      code = division_variable[["code"]],
      selection = list(filter = "item", values = list("0"))
    )
  ),
  response = list(format = "json-stat2")
)
fetch_px_post_if_missing(px_table_url, px_query, membership_path)

response <- fromJSON(membership_path, simplifyVector = TRUE)
if (!identical(unname(response[["id"]]), c(
  year_variable[["code"]], religious_variable[["code"]], division_variable[["code"]]
))) {
  stop("PX-Web response dimensions changed", call. = FALSE)
}
if (!identical(as.integer(response[["size"]]), c(length(years), length(religious_codes), 1L))) {
  stop("PX-Web response size does not match the metadata", call. = FALSE)
}
response_year_codes <- dimension_codes(response[["dimension"]][[year_variable[["code"]]]])
response_religious_codes <- dimension_codes(response[["dimension"]][[religious_variable[["code"]]]])
response_religious_labels <- dimension_labels(
  response[["dimension"]][[religious_variable[["code"]]]],
  response_religious_codes
)
if (!identical(response_year_codes, as.character(years)) ||
    !identical(response_religious_codes, religious_codes) ||
    !identical(response_religious_labels, religious_labels)) {
  stop("PX-Web response categories do not reproduce the table metadata", call. = FALSE)
}

values <- as.numeric(response[["value"]])
expected_cells <- length(years) * length(religious_codes)
if (length(values) != expected_cells) {
  stop("PX-Web response has an unexpected number of values", call. = FALSE)
}
value_matrix <- matrix(
  values,
  nrow = length(years),
  ncol = length(religious_codes),
  byrow = TRUE,
  dimnames = list(as.character(years), religious_codes)
)
if (anyNA(value_matrix)) {
  stop(
    "one or more organisation cells in shipped years are NA; no values are imputed",
    call. = FALSE
  )
}

total_code <- religious_codes[religious_labels == "Total"]
other_unspecified_code <- religious_codes[religious_labels == "Other and not specified"]
no_religious_code <- religious_codes[religious_labels == "No religious organisation"]
if (length(total_code) != 1L || length(other_unspecified_code) != 1L ||
    length(no_religious_code) != 1L) {
  stop("required source categories are not uniquely present", call. = FALSE)
}
organisation_codes <- setdiff(
  religious_codes,
  c(total_code, other_unspecified_code, no_religious_code)
)

totals <- as.integer(value_matrix[, total_code])
category_sums <- as.integer(rowSums(value_matrix[, setdiff(religious_codes, total_code), drop = FALSE]))
if (any(is.na(totals)) || any(category_sums != totals)) {
  stop("source category rows do not reconcile exactly to Total", call. = FALSE)
}
if (!identical(as.integer(rownames(value_matrix)), years)) {
  stop("one or more source years are absent", call. = FALSE)
}

latest_values <- value_matrix[as.character(max(years)), organisation_codes]
source_order <- match(organisation_codes, religious_codes)
rank_order <- order(-latest_values, source_order)
top_n <- 10L
top_codes <- organisation_codes[rank_order[seq_len(top_n)]]
residual_codes <- setdiff(organisation_codes, top_codes)
top_labels <- religious_labels[match(top_codes, religious_codes)]

# build exact annual category reconciliation records for the selected categories.
category_reconciliation <- lapply(seq_along(years), function(index) {
  top_categories <- lapply(seq_along(top_codes), function(category_index) {
    value <- value_matrix[index, top_codes[[category_index]]]
    list(
      source_code = top_codes[[category_index]],
      label = top_labels[[category_index]],
      count = as.integer(value)
    )
  })
  residual <- as.integer(sum(value_matrix[index, residual_codes]))
  other_unspecified <- as.integer(value_matrix[index, other_unspecified_code])
  no_religious <- as.integer(value_matrix[index, no_religious_code])
  shipped_sum <- sum(
    vapply(top_categories, `[[`, integer(1), "count"),
    residual,
    other_unspecified,
    no_religious
  )
  list(
    year = years[[index]],
    categories = top_categories,
    other_organisations = residual,
    other_and_not_specified = other_unspecified,
    no_religious_organisation = no_religious,
    source_total = totals[[index]],
    shipped_category_sum = as.integer(shipped_sum),
    difference = as.integer(totals[[index]] - shipped_sum)
  )
})
if (any(vapply(category_reconciliation, `[[`, integer(1), "difference") != 0L)) {
  stop("selected categories and residual do not reconcile to Total", call. = FALSE)
}

boundary_metadata <- fromJSON(boundary_meta_path, simplifyVector = TRUE)
if (!identical(boundary_metadata[["boundaryISO"]], "ISL") ||
    !identical(boundary_metadata[["boundaryType"]], "ADM0") ||
    !identical(boundary_metadata[["boundaryYearRepresented"]], "2020") ||
    !identical(boundary_metadata[["boundaryLicense"]],
      "Creative Commons Attribution 4.0 International (CC BY 4.0)")) {
  stop("geoBoundaries ADM0 metadata changed after the probe", call. = FALSE)
}
boundary_license_url <- boundary_metadata[["licenseSource"]]
if (!grepl("^https?://", boundary_license_url)) {
  boundary_license_url <- paste0("https://", boundary_license_url)
}
boundary <- st_read(boundary_raw_path, quiet = TRUE)
if (nrow(boundary) != 1L || any(st_is_empty(boundary)) || any(!st_is_valid(boundary))) {
  stop("raw Iceland ADM0 boundary is missing, empty, or invalid", call. = FALSE)
}
boundary <- st_sf(
  area_code = "IS",
  area_name = "Iceland",
  geometry = st_geometry(st_transform(boundary, 4326)),
  crs = 4326
)
simplification <- mapshaper_simplify_to_cap(
  boundary,
  boundary_out,
  max_bytes = 250000,
  keep_percentages = c(20, 10, 5, 2, 1, 0.5, 0.2, 0.1)
)
written_boundary <- st_read(boundary_out, quiet = TRUE)
written_valid <- st_is_valid(written_boundary)
if (nrow(written_boundary) != 1L || any(st_is_empty(written_boundary)) ||
    any(is.na(written_valid)) || any(!written_valid)) {
  stop("simplified Iceland ADM0 boundary failed the geometry gate", call. = FALSE)
}
land_area_sq_km <- as.numeric(st_area(st_transform(written_boundary, 4326))[[1]]) / 1e6

membership_counts <- as.integer(rowSums(value_matrix[, organisation_codes, drop = FALSE]))
no_religious_counts <- as.integer(value_matrix[, no_religious_code])
other_unspecified_counts <- as.integer(value_matrix[, other_unspecified_code])
if (any(membership_counts + no_religious_counts + other_unspecified_counts != totals)) {
  stop("headline counts and Other and not specified do not reconcile to Total", call. = FALSE)
}

population_basis <- paste(
  "Statistics Iceland PX-Web MAN10001 population on 1 January.",
  "Membership is an administrative National Register of Persons construct.",
  "The religious_affiliation fields sum the table's 61 named religious and",
  "life-stance organisation rows; Other and not specified remains outside",
  "both headline fields, and No religious organisation keeps the source name."
)
quality_flag <- paste(
  "administrative_register_membership",
  "national_only_adm0",
  "named_organisation_rows_summed",
  "other_and_not_specified_excluded_from_headline_fields",
  "no_religious_organisation_source_label_not_irreligion",
  "population_method_revised_from_2011_in_march_2024",
  sep = ";"
)
rows <- lapply(seq_along(years), function(index) {
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = "adm0",
    area_unit_id = paste0(boundary_set_id, ":IS"),
    area_code = "IS",
    area_name = "Iceland",
    year = years[[index]],
    population_total = totals[[index]],
    population_total_basis = population_basis,
    religious_affiliation_count = membership_counts[[index]],
    religious_affiliation_percent = round(100 * membership_counts[[index]] / totals[[index]], 4),
    no_religion_count = no_religious_counts[[index]],
    no_religion_percent = round(100 * no_religious_counts[[index]] / totals[[index]], 4),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(land_area_sq_km, 4),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(table_dataset_id, boundary_dataset_id),
    quality_flag = quality_flag
  )
})

temporal_coverage <- paste0(min(years), "-", max(years), ", annually")
spatial_coverage <- "Iceland national total on a single geoBoundaries ADM0 polygon."
membership_quality <- paste(
  "Administrative National Register of Persons membership, never census",
  "affiliation, belief, or attendance. Statistics Iceland revised the population",
  "estimation method in March 2024 and updated the series from 2011 onwards."
)
no_religious_quality <- paste(
  "No religious organisation is the Statistics Iceland source name.",
  "The product does not interpret the category as irreligion, belief, or attendance."
)

source_datasets <- list(
  list(
    source_dataset_id = table_dataset_id,
    name = metadata[["title"]],
    provider = "Statistics Iceland",
    url = px_table_url,
    retrieval_date = retrieval_date,
    local_path = membership_path,
    licence = list(
      name = "Creative Commons Attribution 4.0 International (CC BY 4.0)",
      url = terms_url,
      attribution = "Statistics Iceland, PX-Web table MAN10001"
    ),
    citation = paste(
      "Statistics Iceland, PX-Web MAN10001, Populations by religious and life",
      "stance organizations 1998-2026; updated 12 March 2026."
    ),
    access_limits = NULL,
    redistribution_limits = paste(
      "Statistics Iceland permits reuse under CC BY 4.0 with attribution and",
      "asks that altered data not be attributed to the institution as the source",
      "of the changes. Raw API responses remain in the git-ignored cache."
    ),
    notes = paste(
      "Population 1 January. Membership in recognised organisations is registered",
      "in the National Register of Persons. Persons in unrecognised organisations",
      "or with unknown status are classified as Other and not specified."
    )
  ),
  list(
    source_dataset_id = boundary_dataset_id,
    name = "geoBoundaries gbOpen Iceland ADM0",
    provider = "geoBoundaries; source Lýsigagnagátt",
    url = boundary_url,
    retrieval_date = retrieval_date,
    local_path = boundary_raw_path,
    licence = list(
      name = "Creative Commons Attribution 4.0 International (CC BY 4.0)",
      url = boundary_license_url,
      attribution = "geoBoundaries; Lýsigagnagátt"
    ),
    citation = paste(
      "geoBoundaries gbOpen ISL ADM0, release commit 9469f09, boundary year 2020;",
      "source Lýsigagnagátt."
    ),
    access_limits = NULL,
    redistribution_limits = "The simplified derivative is redistributed under CC BY 4.0 with attribution.",
    notes = "One national polygon simplified with scripts/lib/simplify_boundary.R."
  )
)

indicators <- list(
  list(
    indicator_id = "population_total",
    label = "Total",
    description = "Statistics Iceland MAN10001 national population total on 1 January.",
    unit = "count",
    denominator_indicator_id = NULL,
    method = "Published Total row for Division=Total.",
    temporal_coverage = temporal_coverage,
    spatial_coverage = spatial_coverage,
    quality_notes = "Population method revised in March 2024; Statistics Iceland updated 2011 onwards."
  ),
  list(
    indicator_id = "religious_affiliation_count",
    label = "Membership in published religious and life-stance organisations (count)",
    description = paste(
      "Legacy area-summary field used for the sum of Statistics Iceland's 61",
      "published named organisation rows. This is administrative register membership."
    ),
    unit = "count",
    denominator_indicator_id = "population_total",
    method = paste(
      "Sum all named organisation rows; exclude Total, Other and not specified,",
      "and No religious organisation. Published zero cells remain zero; no values are imputed."
    ),
    temporal_coverage = temporal_coverage,
    spatial_coverage = spatial_coverage,
    quality_notes = membership_quality
  ),
  list(
    indicator_id = "religious_affiliation_percent",
    label = "Membership in published religious and life-stance organisations (%)",
    description = "Administrative register membership in the 61 named organisation rows as a share of Total.",
    unit = "percent",
    denominator_indicator_id = "population_total",
    method = "100 times the named-organisation sum divided by the published Total.",
    temporal_coverage = temporal_coverage,
    spatial_coverage = spatial_coverage,
    quality_notes = membership_quality
  ),
  list(
    indicator_id = "no_religion_count",
    label = "No religious organisation (count)",
    description = paste(
      "Legacy no_religion field used for Statistics Iceland's source category",
      "No religious organisation. The label is not broadened to an irreligion claim."
    ),
    unit = "count",
    denominator_indicator_id = "population_total",
    method = "Published No religious organisation row for Division=Total.",
    temporal_coverage = temporal_coverage,
    spatial_coverage = spatial_coverage,
    quality_notes = no_religious_quality
  ),
  list(
    indicator_id = "no_religion_percent",
    label = "No religious organisation (%)",
    description = "Statistics Iceland's No religious organisation count as a share of Total.",
    unit = "percent",
    denominator_indicator_id = "population_total",
    method = "100 times No religious organisation divided by the published Total.",
    temporal_coverage = temporal_coverage,
    spatial_coverage = spatial_coverage,
    quality_notes = no_religious_quality
  )
)

visual_layers <- list(
  list(
    visual_layer_id = "is-adm0-register-membership-share",
    label = "Register membership share",
    description = "National administrative register membership in Statistics Iceland's named organisations.",
    layer_type = "choropleth",
    indicator_ids = list("religious_affiliation_percent"),
    geometry_unit_type = "country",
    legend = NULL,
    colour_scale = NULL,
    time_control = "year_selector",
    aggregation_rule = NULL,
    uncertainty_display = NULL,
    default_visibility = TRUE,
    notes = paste(
      "A single national polygon is intentional: the project ships small-country",
      "national series where the source publishes no subnational membership table."
    )
  ),
  list(
    visual_layer_id = "is-adm0-no-religious-organisation-share",
    label = "No religious organisation share",
    description = "National share in Statistics Iceland's No religious organisation source category.",
    layer_type = "choropleth",
    indicator_ids = list("no_religion_percent"),
    geometry_unit_type = "country",
    legend = NULL,
    colour_scale = NULL,
    time_control = "year_selector",
    aggregation_rule = NULL,
    uncertainty_display = NULL,
    default_visibility = FALSE,
    notes = "No religious organisation is not interpreted as irreligion or attendance."
  )
)

area_summary <- list(
  schema_version = "0.2.0",
  generated_at = stamp,
  generated_by = script_id,
  country_code = country_code,
  boundary_set = list(
    boundary_set_id = boundary_set_id,
    country_code = country_code,
    level = "adm0",
    vintage = "2020",
    source_dataset_id = boundary_dataset_id
  ),
  site_snapshot = list(
    source_dataset_id = NULL,
    snapshot_date = NULL,
    basis = "no governed Iceland place-of-worship snapshot is included in this membership release",
    notes = "The Iceland lane ships administrative membership metrics only."
  ),
  source_datasets = source_datasets,
  indicators = indicators,
  visual_layers = visual_layers,
  rows = rows
)
write_json(area_summary, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", digits = NA)
utils::write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

if (!jsonlite::validate(readChar(summary_json_out, file_bytes(summary_json_out), useBytes = TRUE))) {
  stop("area-summary output failed JSON syntax validation", call. = FALSE)
}
validate_json_schema("schemas/area-summary.schema.json", summary_json_out)

raw_paths <- c(
  branch_en_path, branch_is_path, earlier_en_path, metadata_en_path,
  metadata_is_path, parish_metadata_path, registration_metadata_path,
  membership_path, terms_path, boundary_meta_path, boundary_raw_path
)
raw_urls <- c(
  px_branch_en_url, px_branch_is_url, px_earlier_en_url, px_table_url,
  px_table_is_url, px_parish_url, px_registration_url, px_table_url,
  terms_url, boundary_meta_url, boundary_url
)
raw_methods <- c(rep("GET", 7L), "POST", rep("GET", 3L))
raw_sources <- lapply(seq_along(raw_paths), function(index) {
  raw_source_record(
    raw_paths[[index]],
    raw_urls[[index]],
    raw_methods[[index]],
    if (raw_methods[[index]] == "POST") px_query else NULL
  )
})
raw_hashes <- vapply(raw_sources, `[[`, character(1), "sha256")
output_paths <- c(summary_json_out, summary_csv_out, boundary_out)
output_hashes <- vapply(output_paths, sha256_file, character(1))
version_hash <- substr(sha256_values(c(raw_hashes, output_hashes)), 1L, 12L)
git_commit <- trimws(system2("git", c("rev-parse", "--short", "HEAD"), stdout = TRUE))

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = paste0("manifest:is-membership:is:1998-2026:", version_hash),
  dataset_id = "is-membership:is:1998-2026:statice-geoboundaries",
  dataset_version_id = paste0(
    "is-membership:is:1998-2026:statice-geoboundaries:", version_hash
  ),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "is-membership",
  dataset_role = "public_product",
  scope = list(
    level = "country",
    country_codes = list("IS"),
    snapshot_date = NULL,
    snapshot_anchor = "01-01",
    pipeline_stage = "public"
  ),
  created_at = stamp,
  created_by = script_id,
  pipeline = list(
    script = script_id,
    git_commit = git_commit,
    command = paste("Rscript", script_id),
    parameters = list(
      source_table = table_id,
      geography = "adm0",
      shipped_years = as.list(years),
      px_web_query = px_query,
      category_selection = list(
        rule = paste(
          "The ten largest named organisations by 2026 membership retain the",
          "source's English labels. Other organisations is the exact annual sum",
          "of all remaining named organisation rows. Other and not specified and",
          "No religious organisation remain separate source-named categories."
        ),
        ranking_year = max(years),
        largest_n = top_n,
        largest_organisation_codes = as.list(top_codes),
        largest_organisation_labels = as.list(top_labels),
        residual_label = "Other organisations",
        special_source_labels = list("Other and not specified", "No religious organisation")
      ),
      headline_area_summary_fields = paste(
        "religious_affiliation fields sum all 61 named organisation rows;",
        "no_religion fields carry No religious organisation verbatim;",
        "Other and not specified remains outside both headline fields"
      ),
      boundary_simplification = c(
        simplification,
        list(byte_ceiling = 250000, helper = "scripts/lib/simplify_boundary.R")
      )
    ),
    software_versions = list(
      R = paste(R.version$major, R.version$minor, sep = "."),
      sf = as.character(utils::packageVersion("sf")),
      jsonlite = as.character(utils::packageVersion("jsonlite"))
    )
  ),
  source = list(
    provider = "Statistics Iceland; geoBoundaries/Lýsigagnagátt",
    source_dataset_ids = list(table_dataset_id, boundary_dataset_id),
    source_urls = list(px_table_url, terms_url, boundary_meta_url, boundary_url),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = paste(
      "Statistics Iceland publishes its statistics under CC BY 4.0 with attribution.",
      "geoBoundaries records the ISL ADM0 source as CC BY 4.0."
    ),
    citation = paste(
      "Statistics Iceland PX-Web MAN10001; geoBoundaries gbOpen ISL ADM0",
      "release commit 9469f09, source Lýsigagnagátt."
    )
  ),
  input_manifests = list(),
  durable_files = list(
    durable_file_record(summary_json_out, "Iceland national annual area-summary JSON", length(rows)),
    durable_file_record(summary_csv_out, "Iceland national annual area-summary CSV", length(rows)),
    durable_file_record(boundary_out, "Simplified Iceland ADM0 boundary", feature_count = 1L)
  ),
  partitions = list(
    list(
      partition_id = "is-adm0-1998-2026",
      partition_type = "country",
      file_uri = paste0("repo:", summary_json_out),
      sha256 = sha256_file(summary_json_out),
      country_code = "IS",
      snapshot_date = NULL,
      stage = "public"
    )
  ),
  stats = list(
    years = length(years),
    first_year = min(years),
    last_year = max(years),
    area_rows = length(rows),
    boundary_features = 1L,
    source_categories_including_total = length(religious_codes),
    named_organisation_categories = length(organisation_codes),
    selected_largest_organisations = top_n,
    boundary_bytes = file_bytes(boundary_out)
  ),
  local_cache_hint = "data/raw/is_membership/ (git-ignored; every cached file is listed and hashed below)",
  validation = list(
    status = "passed",
    commands = list(
      paste("Rscript", script_id),
      paste(
        "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile",
        "schemas/area-summary.schema.json",
        summary_json_out
      )
    ),
    warnings = list(
      paste(
        "The product is national only. The PX-Web religious-organisation branch",
        "contains parish tables for National Church membership, but no municipality,",
        "region, or capital-versus-rest split for all organisations."
      ),
      paste(
        "No religious organisation and Other and not specified keep their source",
        "meanings and are not interpreted as irreligion, belief, or attendance."
      )
    ),
    notes = paste(
      "All 29 years are present. Every annual source category sum and every selected",
      "top-ten-plus-residual category sum equals the published Total exactly. The",
      "single simplified polygon is non-empty and valid."
    ),
    category_reconciliation = category_reconciliation,
    geometry_validation = list(
      source_feature_count = 1L,
      output_feature_count = nrow(written_boundary),
      all_valid = all(written_valid),
      all_non_empty = all(!st_is_empty(written_boundary)),
      distinct_geometry_hash_gate = "not applicable: one feature",
      feature_geometry_sha256 = sha256_values(
        st_as_binary(st_geometry(written_boundary), EWKB = TRUE)
      ),
      output_bytes = file_bytes(boundary_out),
      simplification = simplification
    )
  ),
  privacy = "public",
  licence_status = "accepted",
  downstream_status = "public",
  notes = paste(
    "National annual administrative register membership product. A single national",
    "polygon is intentional: the project ships small-country national series where",
    "the source publishes no subnational membership table."
  ),
  raw_sources = raw_sources,
  derived_outputs = lapply(output_paths, function(path) {
    list(uri = paste0("repo:", path), sha256 = sha256_file(path), built_by = script_id)
  }),
  construct_notes = list(
    paste(
      "Indicator declaration: administrative register membership in religious and",
      "life-stance organisations recorded in Iceland's National Register of Persons."
    ),
    "The product never reports census affiliation, belief, practice, or attendance.",
    paste(
      "Statistics Iceland's published English organisation names remain unchanged.",
      "The source publishes no grouping. The category reconciliation retains the",
      "ten largest 2026 organisations and computes Other organisations as the exact",
      "annual residual of the remaining named organisation rows."
    ),
    paste(
      "Other and not specified is Statistics Iceland's category for persons in an",
      "unrecognised organisation or whose status is unknown. It remains separate."
    ),
    paste(
      "No religious organisation is Statistics Iceland's source category. The",
      "project does not frame it as irreligion beyond the source statement."
    ),
    paste(
      "The area-summary religious_affiliation fields sum all 61 named organisation",
      "rows. The legacy no_religion fields carry No religious organisation verbatim."
    ),
    "Published zero organisation cells remain zero; the build performs no imputation.",
    "No Iceland place-of-worship count or density metric is shipped in this release."
  ),
  source_datasets = source_datasets
)
write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", digits = NA)

if (!jsonlite::validate(readChar(manifest_out, file_bytes(manifest_out), useBytes = TRUE))) {
  stop("manifest output is not valid JSON", call. = FALSE)
}

message(
  "built Iceland ADM0 membership product: ", length(rows), " rows, ",
  min(years), "-", max(years), "; boundary ", file_bytes(boundary_out), " bytes"
)
