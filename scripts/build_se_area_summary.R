# build the Sweden national Church of Sweden membership series.
#
# The Church of Sweden PDF publishes annual administrative membership counts,
# membership shares, and year-on-year percentage-point changes for 1972-2025.
# The build preserves the printed values and ships one national row per year.
# It never derives a population denominator or a no-religion measure.

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(sf)
})

country_code <- "SE"
script_id <- "scripts/build_se_area_summary.R"
output_dir <- "apps/regions/se/data"
manifest_dir <- "docs/manifests"
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-13"
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
pdf_url <- "https://www.svenskakyrkan.se/filer/1374643/Medlemmar%20i%20Svenska%20kyrkan%201972-2025.pdf?id=3016165"
boundary_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/SWE/ADM0/"
boundary_url <- paste0(
  "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/",
  "releaseData/gbOpen/SWE/ADM0/geoBoundaries-SWE-ADM0.geojson"
)
expected_pdf_sha256 <- "ab32a05bafbddddf9581cd6ecde5fe5fd6ee98213896a16d5a77dd8efd7ed6f8"
expected_boundary_sha256 <- "62bfd3141269c7e1feb204aae29eca9ed6e0ec3e6c7dbcf0e8c6a735533b7464"

source_dataset_id <- "church-of-sweden-membership-1972-2025"
boundary_dataset_id <- "geoboundaries-gbopen-swe-adm0-32631220"
boundary_set_id <- "se-adm0-2019-geoboundaries-32631220"

summary_json_out <- file.path(output_dir, "area_summary_national.json")
summary_csv_out <- file.path(output_dir, "area_summary_national.csv")
boundary_out <- file.path(output_dir, "se_national.geojson")
manifest_out <- file.path(manifest_dir, "se-church-membership-1972-2025.json")

# return a file's sha-256 digest.
sha256_file <- function(path) unname(tools::sha256sum(path))

# return a file's size in bytes.
file_bytes <- function(path) as.integer(file.info(path)[["size"]])

# download a source into temporary storage without creating a repository cache.
download_source <- function(url, suffix) {
  path <- tempfile(fileext = suffix)
  status <- utils::download.file(url, path, mode = "wb", quiet = TRUE)
  if (!identical(status, 0L)) stop("download failed: ", url, call. = FALSE)
  path
}

# extract layout-preserving PDF text with Poppler.
pdf_layout_lines <- function(path) {
  command <- Sys.which("pdftotext")
  if (!nzchar(command)) stop("pdftotext (Poppler) is required", call. = FALSE)
  output <- tempfile(fileext = ".txt")
  on.exit(unlink(output), add = TRUE)
  status <- system2(command, c("-layout", shQuote(path), shQuote(output)))
  if (!identical(status, 0L)) stop("pdftotext failed", call. = FALSE)
  readLines(output, warn = FALSE, encoding = "UTF-8")
}

# validate a generated json product against a repository schema.
validate_json_schema <- function(schema_path, instance_path) {
  base_uri <- paste0(
    "file://",
    normalizePath(dirname(schema_path), winslash = "/", mustWork = TRUE), "/"
  )
  status <- system2(
    "uvx",
    c("check-jsonschema", "--base-uri", base_uri, "--schemafile", schema_path, instance_path),
    env = c(
      "UV_CACHE_DIR=/tmp/places-of-worship-uv/cache",
      "UV_TOOL_DIR=/tmp/places-of-worship-uv/tools",
      "UV_PYTHON_INSTALL_DIR=/tmp/places-of-worship-uv/python"
    )
  )
  if (!identical(status, 0L)) stop("schema validation failed for ", instance_path, call. = FALSE)
  invisible(instance_path)
}

# parse one printed table row without recomputing any source value.
parse_source_row <- function(line) {
  fields <- strsplit(trimws(gsub("[[:space:]]+", " ", line)), " ", fixed = TRUE)[[1L]]
  year <- as.integer(fields[[1L]])
  if (year == 1981L) {
    return(list(
      year = year,
      member_count_printed = "-",
      percent_printed = "-",
      change_printed = "*",
      member_count = NA_integer_,
      percent = NA_real_
    ))
  }
  count_parts <- fields[2:4]
  percent_part <- fields[[5L]]
  change_part <- if (length(fields) >= 6L) fields[[6L]] else NULL
  list(
    year = year,
    member_count_printed = paste(count_parts, collapse = " "),
    percent_printed = percent_part,
    change_printed = change_part,
    member_count = as.integer(paste0(count_parts, collapse = "")),
    percent = as.numeric(sub(",", ".", percent_part, fixed = TRUE))
  )
}

# ---- retrieve and verify the pinned inputs --------------------------------

pdf_path <- download_source(pdf_url, ".pdf")
boundary_meta_path <- download_source(boundary_meta_url, ".json")
boundary_raw_path <- download_source(boundary_url, ".geojson")
on.exit(unlink(c(pdf_path, boundary_meta_path, boundary_raw_path)), add = TRUE)

pdf_sha256 <- sha256_file(pdf_path)
if (!identical(pdf_sha256, expected_pdf_sha256)) {
  stop("PDF checksum mismatch; stopping before extraction", call. = FALSE)
}
if (!identical(sha256_file(boundary_raw_path), expected_boundary_sha256)) {
  stop("geoBoundaries SWE ADM0 checksum mismatch", call. = FALSE)
}

# ---- extract and gate the complete printed table --------------------------

source_lines <- pdf_layout_lines(pdf_path)
row_lines <- source_lines[grepl("^\\s*(19|20)[0-9]{2}\\s+", source_lines)]
source_table <- lapply(row_lines, parse_source_row)
years <- vapply(source_table, `[[`, integer(1), "year")

if (!identical(years, 1972:2025) || length(source_table) != 54L) {
  stop("source extraction did not produce every year from 1972 through 2025", call. = FALSE)
}
null_rows <- vapply(source_table, function(row) is.na(row[["member_count"]]) && is.na(row[["percent"]]), logical(1))
if (sum(null_rows) != 1L || years[null_rows] != 1981L) {
  stop("1981 must be the sole null-metrics row", call. = FALSE)
}
row_1972 <- source_table[[1L]]
row_2025 <- source_table[[length(source_table)]]
if (row_1972[["member_count"]] != 7754784L || row_1972[["percent"]] != 95.2 ||
    row_2025[["member_count"]] != 5365542L || row_2025[["percent"]] != 50.7) {
  stop("anchor rows do not match the pinned source record", call. = FALSE)
}

source_note_1981 <- paste(
  "År 1981 upprättades ingen personförteckning av Riksskatteverket, varför",
  "inga befolkningdata kunde erhållas"
)
source_text <- paste(source_lines, collapse = " ") |> gsub("[[:space:]]+", " ", x = _)
if (!grepl(source_note_1981, source_text, fixed = TRUE)) {
  stop("the source's 1981 note was not recovered verbatim", call. = FALSE)
}

# ---- verify and write the national boundary -------------------------------

boundary_meta <- fromJSON(boundary_meta_path, simplifyVector = TRUE)
if (!identical(boundary_meta[["boundaryID"]], "SWE-ADM0-32631220") ||
    !identical(boundary_meta[["boundaryISO"]], "SWE") ||
    !identical(boundary_meta[["boundaryType"]], "ADM0") ||
    !identical(boundary_meta[["boundaryYearRepresented"]], "2019") ||
    !identical(boundary_meta[["boundaryLicense"]], "Open Government Licence v3.0")) {
  stop("geoBoundaries SWE ADM0 metadata drifted from the verified release", call. = FALSE)
}

raw_boundary <- st_read(boundary_raw_path, quiet = TRUE)
raw_boundary <- st_transform(st_make_valid(raw_boundary), 4326)
coordinates <- st_coordinates(raw_boundary)
boundary_bbox <- st_bbox(raw_boundary)
if (nrow(raw_boundary) != 1L || any(st_is_empty(raw_boundary)) ||
    any(is.na(st_is_valid(raw_boundary))) || any(!st_is_valid(raw_boundary)) ||
    any(abs(coordinates[, "X"]) > 180) ||
    (boundary_bbox[["xmax"]] - boundary_bbox[["xmin"]]) > 180) {
  stop("Sweden ADM0 geometry failed the feature, validity, or antimeridian gate", call. = FALSE)
}
boundary <- st_sf(
  area_code = "SE",
  area_name = "Sweden",
  geometry = st_geometry(raw_boundary),
  crs = 4326
)
st_write(boundary, boundary_out, driver = "GeoJSON", delete_dsn = TRUE, quiet = TRUE)
written_boundary <- st_read(boundary_out, quiet = TRUE)
if (nrow(written_boundary) != 1L || any(!st_is_valid(written_boundary))) {
  stop("written Sweden ADM0 boundary failed validation", call. = FALSE)
}
boundary_sha256 <- sha256_file(boundary_out)

# ---- assemble the area-summary rows ---------------------------------------

population_total_basis <- paste(
  "The Church of Sweden source prints a member count and a membership share of",
  "the population, but it prints no population base. This product never derives",
  "a count or denominator from a percentage."
)
base_quality_flag <- paste(
  "administrative_membership_register",
  "church_of_sweden_membership_not_census_affiliation_not_belief_not_practice",
  "national_only_adm0",
  "percent_printed_verbatim_no_recompute",
  "licence_needs_review_build_then_ask",
  "boundary_geoboundaries_swe_adm0_2019_ogl_3_0",
  sep = ";"
)

rows <- lapply(source_table, function(source_row) {
  quality_flag <- base_quality_flag
  if (source_row[["year"]] == 1981L) {
    quality_flag <- paste(quality_flag, "no_population_base_1981_source_blank", sep = ";")
  }
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = "adm0",
    area_unit_id = paste0(boundary_set_id, ":SE"),
    area_code = "SE",
    area_name = "Sweden",
    year = source_row[["year"]],
    population_total = NULL,
    population_total_basis = population_total_basis,
    religious_affiliation_count = if (is.na(source_row[["member_count"]])) NULL else source_row[["member_count"]],
    religious_affiliation_percent = if (is.na(source_row[["percent"]])) NULL else source_row[["percent"]],
    no_religion_count = NULL,
    no_religion_percent = NULL,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = NULL,
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(source_dataset_id, boundary_dataset_id),
    quality_flag = quality_flag
  )
})

# flatten standard row fields while preserving null values as blank CSV cells.
flatten_rows <- function(rows) {
  data.frame(
    country_code = vapply(rows, `[[`, character(1), "country_code"),
    boundary_set_id = vapply(rows, `[[`, character(1), "boundary_set_id"),
    boundary_level = vapply(rows, `[[`, character(1), "boundary_level"),
    area_unit_id = vapply(rows, `[[`, character(1), "area_unit_id"),
    area_code = vapply(rows, `[[`, character(1), "area_code"),
    area_name = vapply(rows, `[[`, character(1), "area_name"),
    year = vapply(rows, `[[`, integer(1), "year"),
    population_total = NA_integer_,
    population_total_basis = vapply(rows, `[[`, character(1), "population_total_basis"),
    religious_affiliation_count = vapply(rows, function(row) row[["religious_affiliation_count"]] %||% NA_integer_, integer(1)),
    religious_affiliation_percent = vapply(rows, function(row) row[["religious_affiliation_percent"]] %||% NA_real_, numeric(1)),
    no_religion_count = NA_integer_,
    no_religion_percent = NA_real_,
    place_count = NA_integer_,
    places_per_10000_residents = NA_real_,
    place_density_per_sq_km = NA_real_,
    land_area_sq_km = NA_real_,
    site_snapshot_date = NA_character_,
    place_count_basis = NA_character_,
    source_dataset_ids = vapply(rows, function(row) paste(unlist(row[["source_dataset_ids"]]), collapse = "|"), character(1)),
    quality_flag = vapply(rows, `[[`, character(1), "quality_flag"),
    stringsAsFactors = FALSE
  )
}

# return a fallback value only when the first value is null.
`%||%` <- function(x, y) if (is.null(x)) y else x

source_datasets <- list(
  list(
    source_dataset_id = source_dataset_id,
    name = "Medlemmar i Svenska kyrkan 1972-2025",
    provider = "Church of Sweden (Svenska kyrkan)",
    url = pdf_url,
    retrieval_date = retrieval_date,
    local_path = NULL,
    licence = list(
      name = "No stated reuse licence; needs review under build-then-ask posture",
      url = NULL,
      attribution = paste0(
        "Source: Church of Sweden (Svenska kyrkan), svenskakyrkan.se/statistik, ",
        "'Medlemmar i Svenska kyrkan 1972-2025', retrieved 2026-07-13. No reuse ",
        "licence stated; used with attribution under the project's build-then-ask ",
        "posture pending confirmation."
      )
    ),
    citation = "Church of Sweden, Medlemmar i Svenska kyrkan 1972-2025.",
    access_limits = NULL,
    redistribution_limits = "No reuse licence is stated; licence review remains open.",
    notes = paste(
      "Administrative Church of Sweden membership register. The source is not a",
      "census measure of affiliation, belief, practice, or attendance. A non-member",
      "does not support a no-religion claim."
    )
  ),
  list(
    source_dataset_id = boundary_dataset_id,
    name = "geoBoundaries SWE ADM0",
    provider = "geoBoundaries",
    url = boundary_url,
    retrieval_date = retrieval_date,
    local_path = NULL,
    licence = list(
      name = "Open Government Licence v3.0",
      url = "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
      attribution = "geoBoundaries"
    ),
    citation = "geoBoundaries gbOpen SWE ADM0, boundary SWE-ADM0-32631220, 2019.",
    access_limits = NULL,
    redistribution_limits = "Open Government Licence v3.0 applies.",
    notes = "One national feature. The shipped GeoJSON sha256 is recorded in the manifest."
  )
)

indicators <- list(
  list(
    indicator_id = "religious_affiliation_count",
    label = "Church of Sweden members",
    description = "Published Church of Sweden administrative membership count.",
    unit = "count",
    denominator_indicator_id = NULL,
    method = "Printed member count carried verbatim; no recomputation.",
    temporal_coverage = "Annual 1972-2025; the source prints no metrics for 1981.",
    spatial_coverage = "Sweden national total.",
    quality_notes = "Single-denomination administrative membership register."
  ),
  list(
    indicator_id = "religious_affiliation_percent",
    label = "Church of Sweden membership share",
    description = "Published Church of Sweden members as a percentage of the population.",
    unit = "percent",
    denominator_indicator_id = NULL,
    method = "Printed percentage carried verbatim; never recomputed or re-rounded.",
    temporal_coverage = "Annual 1972-2025; the source prints no metrics for 1981.",
    spatial_coverage = "Sweden national total.",
    quality_notes = "The source prints no population denominator."
  )
)

visual_layers <- list(
  list(
    visual_layer_id = "se-adm0-church-membership-share",
    label = "Church of Sweden membership share",
    description = "Published national administrative membership share.",
    layer_type = "choropleth",
    indicator_ids = list("religious_affiliation_percent"),
    geometry_unit_type = "country",
    legend = list(unit = "percent"),
    colour_scale = "sequential",
    time_control = "year_selector",
    aggregation_rule = "use the source's printed national percentage",
    uncertainty_display = "quality_flag",
    default_visibility = TRUE,
    notes = "The source prints no metrics for 1981."
  )
)

area_summary <- list(
  schema_version = "area-summary.v2",
  generated_at = stamp,
  generated_by = script_id,
  country_code = country_code,
  data_status = "register_membership_staged",
  data_status_note = "Sweden national Church of Sweden administrative membership, 1972-2025.",
  boundary_set = list(
    boundary_set_id = boundary_set_id,
    country_code = country_code,
    level = "adm0",
    vintage = "2019",
    source_dataset_id = boundary_dataset_id
  ),
  site_snapshot = list(
    source_dataset_id = NULL,
    snapshot_date = NULL,
    basis = "no governed Sweden place-of-worship snapshot is included in this membership release",
    notes = "The product ships national administrative membership metrics only."
  ),
  source_datasets = source_datasets,
  indicators = indicators,
  visual_layers = visual_layers,
  rows = rows
)

write_json(area_summary, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
utils::write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")
validate_json_schema("schemas/area-summary.v2.schema.json", summary_json_out)

# ---- write the recoverable data manifest ----------------------------------

git_commit <- tryCatch({
  value <- trimws(system2("git", c("rev-parse", "--short", "HEAD"), stdout = TRUE, stderr = TRUE))
  if (length(value) == 1L && grepl("^[a-f0-9]{7,40}$", value)) value else NULL
}, error = function(e) NULL)

output_paths <- c(summary_json_out, summary_csv_out, boundary_out)
output_hashes <- vapply(output_paths, sha256_file, character(1))
version_hash <- substr(
  digest(paste(c(pdf_sha256, expected_boundary_sha256, output_hashes), collapse = ""), algo = "sha256", serialize = FALSE),
  1L, 12L
)

# describe one generated file with its checksum, size, and optional counts.
durable_file <- function(path, content, row_count = NULL, feature_count = NULL, licence_status = "needs_review", licence_basis = "no_stated_terms_build_then_ask") {
  record <- list(
    uri = paste0("repo:", path),
    storage_provider = "git_repository",
    format = sub("^.*\\.", "", path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    content = content,
    privacy = "public",
    licence_status = licence_status,
    licence_basis = licence_basis
  )
  if (!is.null(row_count)) record[["row_count"]] <- as.integer(row_count)
  if (!is.null(feature_count)) record[["feature_count"]] <- as.integer(feature_count)
  record
}

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = paste0("manifest:se-church-membership:se:1972-2025:", version_hash),
  dataset_id = "se-church-membership:se:1972-2025:national",
  dataset_version_id = paste0("se-church-membership:se:1972-2025:national:", version_hash),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "se-church-membership",
  dataset_role = "public_product",
  scope = list(
    level = "country",
    country_codes = list("SE"),
    snapshot_date = NULL,
    snapshot_anchor = "12-31",
    pipeline_stage = "staged"
  ),
  created_at = stamp,
  created_by = script_id,
  target_years = as.list(years),
  pipeline = list(
    script = script_id,
    git_commit = git_commit,
    command = paste("Rscript", script_id),
    parameters = list(
      construct = "single-denomination Church of Sweden administrative membership register",
      slot_design = "religious_affiliation carries Church of Sweden membership; no_religion remains null because non-membership supports no no-religion claim",
      population_rule = "population_total remains null because the source prints no population base; never derive a denominator from the printed percentage",
      composition_rule = "composition omitted because the single printed membership line partitions nothing",
      source_note_1981 = source_note_1981,
      printed_frame = source_table,
      boundary_source_record = list(
        boundary_id = boundary_meta[["boundaryID"]],
        vintage = boundary_meta[["boundaryYearRepresented"]],
        licence = boundary_meta[["boundaryLicense"]],
        licence_source = paste0("https://", boundary_meta[["licenseSource"]]),
        raw_sha256 = expected_boundary_sha256,
        shipped_geojson_sha256 = boundary_sha256
      )
    )
  ),
  source = list(
    provider = "Church of Sweden (Svenska kyrkan)",
    source_dataset_ids = list(source_dataset_id, boundary_dataset_id),
    source_urls = list(pdf_url, boundary_url),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = "No reuse licence stated for the Church of Sweden statistics series; geoBoundaries SWE ADM0 is Open Government Licence v3.0.",
    citation = source_datasets[[1L]][["licence"]][["attribution"]],
    raw_redistribution = "The Church of Sweden PDF is not redistributed; the builder retrieves it and verifies its pinned checksum.",
    local_cache_hint = "No repository cache is created; sources are downloaded to temporary files.",
    licence_position = "needs_review",
    licence_position_verbatim_from_playbook = "build-then-ask",
    licence_todo = "Courtesy permission request is recorded separately and is outside this build lane.",
    short_citation = "Church of Sweden, Medlemmar i Svenska kyrkan 1972-2025."
  ),
  raw_sources = list(
    list(
      url = pdf_url,
      method = "GET",
      retrieval_date = retrieval_date,
      format = "pdf",
      bytes = file_bytes(pdf_path),
      sha256 = pdf_sha256,
      notes = "Three-page PDF with intact text layer; source of record for all printed values."
    ),
    list(
      url = boundary_url,
      method = "GET",
      retrieval_date = retrieval_date,
      format = "geojson",
      bytes = file_bytes(boundary_raw_path),
      sha256 = expected_boundary_sha256,
      notes = "Pinned geoBoundaries SWE ADM0 source geometry."
    )
  ),
  source_datasets = source_datasets,
  durable_files = list(
    durable_file(summary_json_out, "area-summary.v2 national annual rows", row_count = 54L),
    durable_file(summary_csv_out, "CSV companion to the national annual rows", row_count = 54L),
    durable_file(boundary_out, "single-feature Sweden ADM0 boundary", feature_count = 1L, licence_status = "accepted", licence_basis = "open_government_licence_v3_0")
  ),
  stats = list(
    row_count = 54L,
    feature_count = 1L,
    year_min = 1972L,
    year_max = 2025L,
    null_metrics_rows = 1L
  ),
  validation = list(
    status = "passed",
    commands = list(
      "uvx check-jsonschema --base-uri file://$(pwd)/schemas/ --schemafile schemas/area-summary.v2.schema.json apps/regions/se/data/area_summary_national.json",
      "uvx check-jsonschema --base-uri file://$(pwd)/schemas/ --schemafile schemas/data-manifest.schema.json docs/manifests/se-church-membership-1972-2025.json"
    ),
    warnings = list("Church of Sweden source licence needs review under the build-then-ask posture."),
    notes = "PDF checksum, complete-year extraction, anchor rows, sole 1981 null row, and geometry gates passed.",
    pdf_sha256 = pdf_sha256,
    boundary_geojson_sha256 = boundary_sha256,
    anchor_1972 = list(member_count = 7754784L, percent = 95.2),
    anchor_2025 = list(member_count = 5365542L, percent = 50.7)
  ),
  privacy = "public",
  licence_status = "needs_review",
  licence_basis = "no_stated_terms_build_then_ask",
  downstream_status = "staged",
  notes = paste(
    "The MUCF/SST served-population series remains national context only and is excluded",
    "from rows because it measures a different construct. SCB CC0 and Lantmäteriet",
    "alternatives remain a deferred boundary swap. The current geoBoundaries SWE ADM0",
    "metadata identifies Open Government Licence v3.0; the build records that source",
    "licence rather than importing Finland's ODbL boundary licence."
  ),
  construct_notes = list(
    "The product measures Church of Sweden administrative membership. It does not measure census affiliation, belief, practice, or attendance.",
    "A non-member does not support a no-religion claim. Both no_religion fields remain null.",
    "The printed percentage is carried verbatim. The build never recomputes or re-rounds it.",
    paste0("The 1981 source note is preserved verbatim: ", source_note_1981),
    "The manifest preserves the source's full three-column printed frame, including the year-on-year change column."
  ),
  deferred_sources = list(
    list(
      source = "SCB CC0 or Lantmäteriet national boundary",
      status = "deferred_boundary_swap",
      reason = "The current product follows the geoBoundaries ADM0 fleet precedent.",
      recovery_route = "Replace the national outline with an SCB CC0 or Lantmäteriet alternative after a fleet-level boundary decision."
    ),
    list(
      source = "MUCF/SST served-population series",
      status = "national_context_only",
      reason = "The series measures served populations across other faith communities, a different construct from Church of Sweden membership.",
      recovery_route = "Retain as contextual documentation and never merge it into these rows."
    )
  )
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
validate_json_schema("schemas/data-manifest.schema.json", manifest_out)

message("built ", length(rows), " Sweden national rows (1972-2025)")
message("PDF sha256: ", pdf_sha256)
message("boundary GeoJSON sha256: ", boundary_sha256)
