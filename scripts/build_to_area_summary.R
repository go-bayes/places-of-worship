# build the Tonga 2021 district census-affiliation area-summary product.
# inputs: Tonga Statistics Department 2021 religion workbook and report, plus
# geoBoundaries TON ADM2 release geometry and metadata.
# outputs: apps/regions/to/data/to_district_2020.geojson,
# apps/regions/to/data/area_summary_district.{json,csv}, and
# docs/manifests/to-census-religion-2021.json.
# run from the repository root: Rscript scripts/build_to_area_summary.R

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(readxl)
  library(sf)
})

source("scripts/lib/simplify_boundary.R")

country_code <- "TO"
script_id <- "scripts/build_to_area_summary.R"
raw_dir <- "data/raw/to_census"
product_dir <- "apps/regions/to/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-10"
stamp <- paste0(retrieval_date, "T00:00:00Z")
git_commit <- trimws(system2("git", c("rev-parse", "HEAD"), stdout = TRUE))
if (length(git_commit) != 1L || !grepl("^[a-f0-9]{40}$", git_commit)) stop("could not resolve the base git commit", call. = FALSE)
boundary_level <- "district"
boundary_set_id <- "to-district-2020-geoboundaries-adm2"
census_dataset_id <- "tsd-census-2021-table-g19-religion-district"
census_report_dataset_id <- "tsd-census-2021-volume-1"
boundary_dataset_id <- "geoboundaries-ton-adm2-2020"

census_url <- "https://tongastats.gov.to/download/266/general-tables/7664/4-religion.xlsx"
census_report_url <- "https://tongastats.gov.to/download/272/census-report-and-factsheet/7647/census-report-vol1-2021.pdf"
census_hub_url <- "https://tongastats.gov.to/census-2/population-census-3/census-report-and-factsheet/"
contact_url <- "https://tongastats.gov.to/about-us/contact-us/"
terms_url <- "https://www.gov.to/termsandcondtions/"
boundary_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/TON/ADM2/"
boundary_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/TON/ADM2/geoBoundaries-TON-ADM2.geojson"
report_2016_url <- "https://tongastats.gov.to/download/60/2016/4062/2016-census-report-volume-1-2nd-edition.pdf"
report_2011_url <- "https://microdata.pacificdata.org/index.php/catalog/184/download/2684"
report_2006_url <- "https://microdata.pacificdata.org/index.php/catalog/183/download/935"
pdh_1996_url <- "https://microdata.pacificdata.org/index.php/catalog/182"

census_path <- file.path(raw_dir, "to_2021_religion.xlsx")
census_report_path <- file.path(raw_dir, "to_2021_census_report_volume_1.pdf")
census_hub_path <- file.path(raw_dir, "tongastats_census_hub.html")
contact_path <- file.path(raw_dir, "tongastats_contact.html")
boundary_meta_path <- file.path(raw_dir, "gb_ton_adm2_meta.json")
boundary_path <- file.path(raw_dir, "geoBoundaries-TON-ADM2.geojson")
report_2016_path <- file.path(raw_dir, "to_2016_census_report_volume_1.pdf")
report_2011_path <- file.path(raw_dir, "to_2011_basic_tables.pdf")
report_2006_path <- file.path(raw_dir, "to_2006_basic_tables.pdf")
pdh_1996_path <- file.path(raw_dir, "pdh_1996_catalog.html")

boundary_out <- file.path(product_dir, "to_district_2020.geojson")
summary_json_out <- file.path(product_dir, "area_summary_district.json")
summary_csv_out <- file.path(product_dir, "area_summary_district.csv")
manifest_out <- file.path(manifest_dir, "to-census-religion-2021.json")

source_categories <- c(
  "FWC", "RC", "LDS", "FCOT", "COT", "AOG", "TOK", "CCOT", "GOS",
  "AGC", "SDA", "MF", "TSA", "JW", "OP", "BF", "BUDH", "ISL", "HND",
  "NO Rel", "REF", "Other"
)

display_labels_en <- c(
  "Free Wesleyan Church", "Roman Catholic", "Latter Day Saints", "Free Church of Tonga",
  "Church of Tonga", "Assembly of God", "Tokaikolo / Maamafo'ou",
  "Constitutional Church of Tonga", "Gospel Church", "Anglican Church",
  "Seventh Day Adventist", "Mo'ui Fo'ou 'Ia Kalaisi", "The Salvation Army",
  "Jehovah's Witness", "Other Pentecostal", "Baha'i Faith", "Buddhist", "Islam",
  "Hinduism", "No religious affiliation", "Refused to answer", "Other minor religious groups"
)

category_roles <- c(rep("religious_affiliation", 19L), "no_religion", "nonresponse", "religious_affiliation")

divisions <- list(
  Tongatapu = c("Kolofo'ou", "Kolomotu'a", "Vaini", "Tatakamotonga", "Lapaha", "Nukunuku", "Kolovai"),
  `Vava'u` = c("Neiafu", "Pangaimotu", "Hahake", "Leimatu'a", "Hihifo", "Motu"),
  `Ha'apai` = c("Pangai", "Foa", "Lulunga", "Mu'omu'a", "Ha'ano", "'Uiha"),
  `'Eua` = c("'Eua Motu'a", "'Eua Fo'ou"),
  `Ongo Niua` = c("Niuatoputapu", "Niuafo'ou")
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

# expose the workbook's verbatim category spellings and separate display labels.
category_mapping_2021 <- function() {
  lapply(seq_along(source_categories), function(index) {
    list(
      source_name = source_categories[[index]],
      display_label_en = display_labels_en[[index]],
      role = category_roles[[index]]
    )
  })
}

# parse the national, division, and district rows from workbook sheet G 19.
parse_religion_table <- function(path) {
  raw <- read_excel(path, sheet = "G 19", skip = 2, col_types = "text")
  expected_names <- c("area", "Total", source_categories)
  if (ncol(raw) != length(expected_names)) stop("G 19 column count changed", call. = FALSE)
  names(raw) <- expected_names
  numeric_total <- suppressWarnings(as.numeric(raw[["Total"]]))
  rows <- raw[!is.na(raw[["area"]]) & !is.na(numeric_total), , drop = FALSE]
  for (field in expected_names[-1L]) rows[[field]] <- as.integer(rows[[field]])
  if (nrow(rows) != 29L) stop("expected 29 national, division, and district rows in G 19", call. = FALSE)

  category_sum <- rowSums(rows[source_categories])
  if (any(category_sum != rows[["Total"]])) {
    failures <- rows[["area"]][category_sum != rows[["Total"]]]
    stop("source row arithmetic fails for: ", paste(failures, collapse = "; "), call. = FALSE)
  }

  national <- rows[rows[["area"]] == "Total", , drop = FALSE]
  district_names <- unlist(divisions, use.names = FALSE)
  district_rows <- rows[rows[["area"]] %in% district_names, , drop = FALSE]
  if (nrow(national) != 1L || nrow(district_rows) != 23L || anyDuplicated(district_rows[["area"]])) {
    stop("national or district row structure changed", call. = FALSE)
  }

  reconcile_fields <- c("Total", source_categories)
  for (field in reconcile_fields) {
    if (sum(district_rows[[field]]) != national[[field]][[1L]]) {
      stop("district rows do not sum to the national ", field, call. = FALSE)
    }
  }
  for (division_name in names(divisions)) {
    division_row <- rows[rows[["area"]] == division_name, , drop = FALSE]
    children <- district_rows[district_rows[["area"]] %in% divisions[[division_name]], , drop = FALSE]
    if (nrow(division_row) != 1L || nrow(children) != length(divisions[[division_name]])) {
      stop("division hierarchy changed for ", division_name, call. = FALSE)
    }
    for (field in reconcile_fields) {
      if (sum(children[[field]]) != division_row[[field]][[1L]]) {
        stop("district rows do not sum to ", division_name, " for ", field, call. = FALSE)
      }
    }
  }
  list(all_rows = rows, districts = district_rows, national = national)
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
  if (nrow(layer) != 23L || any(st_is_empty(layer)) || any(is.na(st_is_valid(layer))) || any(!st_is_valid(layer))) {
    stop(stage, " boundary does not contain 23 valid non-empty features", call. = FALSE)
  }
  hashes <- geometry_hashes(layer)
  if (length(unique(hashes)) != 23L) stop(stage, " boundary geometry hashes are not distinct", call. = FALSE)
  metric <- st_transform(layer, "+proj=laea +lat_0=-20 +lon_0=-175 +datum=WGS84 +units=m +no_defs")
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

# join all census districts one-to-one to the licensed ADM2 features.
build_boundary <- function(census_rows, path) {
  boundary <- st_read(path, quiet = TRUE, stringsAsFactors = FALSE)
  if (nrow(boundary) != 23L) stop("geoBoundaries TON ADM2 feature count changed", call. = FALSE)
  aliases <- c("Ha'ano" = "Ha`ano", "'Eua Motu'a" = "'Eua Prope", "'Eua Fo'ou" = "'Eua fo'ou")
  census_rows[["boundary_name"]] <- ifelse(
    census_rows[["area"]] %in% names(aliases),
    unname(aliases[census_rows[["area"]]]),
    census_rows[["area"]]
  )
  index <- match(census_rows[["boundary_name"]], boundary[["shapeName"]])
  if (anyNA(index) || anyDuplicated(index) || !setequal(index, seq_len(23L))) {
    stop("census and boundary districts do not join one-to-one", call. = FALSE)
  }
  boundary <- boundary[index, ]
  boundary[["source_area_name"]] <- census_rows[["area"]]
  boundary[["boundary_source_name"]] <- boundary[["shapeName"]]
  boundary[["area_code"]] <- boundary[["shapeID"]]
  boundary[["area_name"]] <- census_rows[["area"]]
  boundary[["area_unit_id"]] <- paste(boundary_set_id, boundary[["area_code"]], sep = ":")
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- boundary_level
  boundary[["boundary_vintage"]] <- "2020"
  boundary[["boundary_source"]] <- "geoBoundaries TON ADM2; source Pacific Data Hub"
  boundary[["boundary_licence"]] <- "CC BY 4.0"
  boundary[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(
    boundary, "+proj=laea +lat_0=-20 +lon_0=-175 +datum=WGS84 +units=m +no_defs"
  ))) / 1e6
  boundary <- st_transform(st_make_valid(boundary), 4326)
  boundary[c(
    "area_code", "area_name", "source_area_name", "boundary_source_name", "area_unit_id",
    "boundary_set_id", "boundary_level", "boundary_vintage", "boundary_source",
    "boundary_licence", "land_area_sq_km", "geometry"
  )]
}

# simplify with the mandatory helper and re-run every geometry gate.
write_boundary <- function(boundary) {
  source_validation <- validate_boundary(boundary, "source")
  simplification <- mapshaper_simplify_to_cap(
    boundary,
    boundary_out,
    max_bytes = 3000000L,
    keep_percentages = c(100, 75, 50, 30, 20, 10, 5),
    clean_option = "allow-overlaps"
  )
  written <- st_read(boundary_out, quiet = TRUE, stringsAsFactors = FALSE)
  written <- written[match(boundary[["area_code"]], written[["area_code"]]), ]
  if (anyNA(written[["area_code"]])) stop("simplified boundary lost an area code", call. = FALSE)
  simplified_validation <- validate_boundary(written, "simplified")
  list(
    layer = written,
    simplification = simplification,
    source_validation = source_validation,
    simplified_validation = simplified_validation
  )
}

# build one schema-shaped district row.
build_area_row <- function(source, area) {
  affiliation_count <- source[["Total"]] - source[["NO Rel"]] - source[["REF"]]
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = area[["area_unit_id"]],
    area_code = area[["area_code"]],
    area_name = source[["area"]],
    year = 2021L,
    population_total = as.integer(source[["Total"]]),
    population_total_basis = paste(
      "population in the 2021 G 19 religion table; refused responses remain in the denominator;",
      "the source note excludes visitors or non-residents and the report specifies persons occupying institutions"
    ),
    religious_affiliation_count = as.integer(affiliation_count),
    religious_affiliation_percent = round(100 * affiliation_count / source[["Total"]], 4),
    no_religion_count = as.integer(source[["NO Rel"]]),
    no_religion_percent = round(100 * source[["NO Rel"]] / source[["Total"]], 4),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(area[["land_area_sq_km"]], 4),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(census_dataset_id, census_report_dataset_id, boundary_dataset_id),
    quality_flag = paste(
      "census_affiliation;full_table_denominator;refused_retained_in_denominator;",
      "visitors_nonresidents_and_institution_population_excluded_by_source;",
      "2021_only_change_withheld;tsd_partial_research_reuse_with_attribution;boundary_cc_by_4_0",
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
  licence_name <- paste(
    "TSD 2021 census report terms: commercial or for-profit reproduction reserved;",
    "partial scientific, educational, or research reproduction authorised with TSD and source acknowledgement"
  )
  list(
    list(
      source_dataset_id = census_dataset_id,
      name = "Tonga 2021 Census of Population and Housing, workbook table G 19: Population religious affiliation by division and district",
      provider = "Tonga Statistics Department (TSD)", url = census_url,
      retrieval_date = retrieval_date, local_path = census_path,
      licence = list(name = licence_name, url = census_report_url, attribution = "Tonga Statistics Department, 2021 Census of Population and Housing"),
      citation = "Tonga Statistics Department, Tonga 2021 Census of Population and Housing, religion workbook, Table G 19.",
      access_limits = NULL,
      redistribution_limits = "The product contains partial derived statistics for a research map. Commercial or for-profit reuse requires separate permission.",
      notes = "G 19 contains one national row, five division rows, and 23 district rows. Every category sum closes exactly to its printed row total; all district rows sum exactly to every national category."
    ),
    list(
      source_dataset_id = census_report_dataset_id,
      name = "Tonga 2021 Census of Population and Housing, Volume 1: Basic Tables",
      provider = "Tonga Statistics Department (TSD)", url = census_report_url,
      retrieval_date = retrieval_date, local_path = census_report_path,
      licence = list(name = licence_name, url = census_report_url, attribution = "Tonga Statistics Department, 2021 Census of Population and Housing"),
      citation = "Tonga Statistics Department. 2021. Tonga Census of Population and Housing 2021. Nuku'alofa: Tonga Statistics Department.",
      access_limits = NULL,
      redistribution_limits = "Commercial or for-profit reproduction is reserved; partial scientific, educational, or research reproduction requires acknowledgement.",
      notes = "The report's publication page states the reuse terms and its district religion table reproduces the workbook's 2021 counts."
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "geoBoundaries TON ADM2 (23 districts)",
      provider = "geoBoundaries; source Pacific Data Hub", url = boundary_url,
      retrieval_date = retrieval_date, local_path = boundary_path,
      licence = list(name = "Creative Commons Attribution 4.0 International (CC BY 4.0)", url = boundary_meta_url, attribution = "geoBoundaries; Pacific Data Hub"),
      citation = "geoBoundaries TON ADM2, boundary ID TON-ADM2-48082658; source Pacific Data Hub.",
      access_limits = NULL,
      redistribution_limits = "The simplified boundary retains geoBoundaries and Pacific Data Hub attribution.",
      notes = "Release metadata records 23 district units, represented year 2020, source Pacific Data Hub, and CC BY 4.0. Three one-to-one label aliases connect source spellings without changing geography."
    )
  )
}

# declare the three indicators exposed by the snapshot.
indicators <- function() {
  denominator_note <- paste(
    "Percentages use each G 19 district Total. Refused responses remain in the denominator and outside both headline numerators.",
    "The source excludes visitors or non-residents; the report specifies persons occupying institutions among the exclusions."
  )
  list(
    list(
      indicator_id = "population_total", label = "Religion-table population", description = "Population represented in the 2021 district religion table.",
      unit = "count", denominator_indicator_id = NULL, method = "Printed Total in workbook table G 19.", temporal_coverage = "2021",
      spatial_coverage = "Tonga districts", quality_notes = denominator_note
    ),
    list(
      indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
      description = "Share affiliated with a named religion or the source's Other category.", unit = "percent",
      denominator_indicator_id = "population_total", method = "100 * (Total - NO Rel - REF) / Total.", temporal_coverage = "2021",
      spatial_coverage = "Tonga districts", quality_notes = denominator_note
    ),
    list(
      indicator_id = "no_religion_percent", label = "No religious affiliation %",
      description = "Share in the source's NO Rel category.", unit = "percent", denominator_indicator_id = "population_total",
      method = "100 * NO Rel / Total.", temporal_coverage = "2021", spatial_coverage = "Tonga districts", quality_notes = denominator_note
    )
  )
}

# declare the district choropleth layers without a change layer.
visual_layers <- function() {
  list(
    list(
      visual_layer_id = "to-district-religious-affiliation", label = "Religious affiliation %",
      description = "Tonga 2021 census-affiliation share by district.", layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "population in the G 19 religion table, including refused responses"),
      colour_scale = "sequential", time_control = "year_selector", aggregation_rule = "reported district value",
      uncertainty_display = "quality_flag", default_visibility = TRUE,
      notes = "The construct is census affiliation, not religious practice or registered membership."
    ),
    list(
      visual_layer_id = "to-district-no-religion", label = "No religious affiliation %",
      description = "Tonga 2021 census no-religion share by district.", layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"), geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "population in the G 19 religion table, including refused responses"),
      colour_scale = "sequential", time_control = "year_selector", aggregation_rule = "reported district value",
      uncertainty_display = "quality_flag", default_visibility = FALSE, notes = "The source category is NO Rel."
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
  census_path, census_report_path, census_hub_path, contact_path, boundary_meta_path, boundary_path,
  report_2016_path, report_2011_path, report_2006_path, pdh_1996_path
)
invisible(lapply(required_inputs, require_file))

boundary_metadata <- fromJSON(boundary_meta_path, simplifyVector = FALSE)
if (!identical(boundary_metadata[["boundaryLicense"]], "Creative Commons Attribution 4.0 International (CC BY 4.0)") ||
    !identical(boundary_metadata[["boundarySource"]], "Pacific Data Hub") ||
    !identical(boundary_metadata[["admUnitCount"]], "23")) {
  stop("geoBoundaries licence, source, or unit metadata changed", call. = FALSE)
}

parsed <- parse_religion_table(census_path)
boundary <- build_boundary(parsed[["districts"]], boundary_path)
boundary_result <- write_boundary(boundary)
written_boundary <- boundary_result[["layer"]]

rows <- lapply(seq_len(nrow(parsed[["districts"]])), function(index) {
  build_area_row(parsed[["districts"]][index, , drop = FALSE], written_boundary[index, , drop = FALSE])
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
    basis = "No governed place-of-worship snapshot ships in the Tonga census product.",
    notes = "Place counts and density metrics remain null."
  ),
  source_datasets = source_datasets(), indicators = indicators(), visual_layers = visual_layers(), rows = rows
)

write_json(summary_product, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

national <- parsed[["national"]][1L, , drop = FALSE]
national_affiliation <- national[["Total"]] - national[["NO Rel"]] - national[["REF"]]
raw_sources <- list(
  raw_source_record(census_path, census_url, "xlsx", TRUE, "2021", "Workbook table G 19 supplies the 23 district rows and national reconciliation row."),
  raw_source_record(census_report_path, census_report_url, "pdf", TRUE, "2021", "Volume 1 supplies the publication terms, category definitions, denominator note, and matching printed table."),
  raw_source_record(census_hub_path, census_hub_url, "html", FALSE, "2021", "Official census report hub and source-of-record route."),
  raw_source_record(contact_path, contact_url, "html", FALSE, "2021", paste("TSD footer copyright and the terms link; the linked endpoint", terms_url, "returned HTTP 404 on retrieval.")),
  raw_source_record(boundary_meta_path, boundary_meta_url, "json", TRUE, "2020", "Release metadata records Pacific Data Hub as source and CC BY 4.0."),
  raw_source_record(boundary_path, boundary_url, "geojson", TRUE, "2020", "Source geometry for 23 districts."),
  raw_source_record(report_2016_path, report_2016_url, "pdf", FALSE, "2016", "Earlier-wave village and district religion tables; deferred because only 2021 ships in this build."),
  raw_source_record(report_2011_path, report_2011_url, "pdf", FALSE, "2011", "Earlier-wave village and district religion tables; deferred for a separate comparability extraction."),
  raw_source_record(report_2006_path, report_2006_url, "pdf", FALSE, "2006", "Earlier-wave village and district religion tables; G 19 uses total population while G 18 uses private-household population."),
  raw_source_record(pdh_1996_path, pdh_1996_url, "html", FALSE, "1996", "PDH metadata confirms a religion variable; no official aggregate subnational table was pinned.")
)

dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)
manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json", schema_version = "data-manifest.v1",
  manifest_id = "manifest:to-census-religion:to:2021:tsd-district",
  dataset_id = "to-census-religion:to:2021:tsd-district",
  dataset_version_id = paste0("to-census-religion:to:2021:tsd-district:", dataset_hash),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "to-census-religion", dataset_role = "public_product",
  scope = list(level = "country", country_codes = list("TO"), snapshot_date = NULL, snapshot_anchor = NULL, pipeline_stage = "public"),
  created_at = stamp, created_by = script_id,
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation", shipped_wave = 2021L, shipped_geography = "23 districts",
      source_table = "workbook G 19: Population religious affiliation by division and district",
      denominator = "G 19 Total; REF remains in the denominator and outside both headline numerators",
      source_exclusions = "visitors or non-residents; the report specifies persons occupying institutions",
      category_mappings = list(`2021` = category_mapping_2021()),
      district_aliases = list(`Ha'ano` = "Ha`ano", `'Eua Motu'a` = "'Eua Prope", `'Eua Fo'ou` = "'Eua fo'ou"),
      boundary_simplification = boundary_result[["simplification"]],
      change_rule = "religious_change withheld because only the 2021 district wave ships",
      local_cache_hint = "All raw sources are cached under data/raw/to_census/ and remain git-ignored.",
      retrieval_record = raw_sources,
      validation_details = list(
        printed_row_reconciliation = list(status = "passed", printed_rows = 29L, exact_row_matches = 29L, category_count = length(source_categories)),
        local_to_national_reconciliation = list(status = "passed", district_rows = 23L, exact_fields = list("Total", source_categories)),
        national_2021 = list(
          denominator = national[["Total"]], religious_affiliation_count = national_affiliation,
          no_religion_count = national[["NO Rel"]], refused_count = national[["REF"]],
          category_totals = setNames(as.list(as.integer(national[source_categories])), source_categories)
        ),
        join_coverage = list(matched_district_rows = 23L, expected_district_rows = 23L, unmatched_district_rows = list(), unused_boundary_features = list()),
        boundary_validation = list(
          source_geometry = boundary_result[["source_validation"]], simplified_geometry = boundary_result[["simplified_validation"]],
          licence_metadata_status = "passed", licence = boundary_metadata[["boundaryLicense"]], release_source = boundary_metadata[["boundarySource"]]
        ),
        provenance = list(status = "passed", cached_input_count = length(raw_sources), cached_inputs_with_sha256 = length(raw_sources))
      ),
      construct_notes = list(
        "The construct is census affiliation. It does not measure practice, attendance, or registered membership.",
        "Workbook category spellings are retained verbatim in the manifest; English display labels are separate.",
        "The denominator is each district's G 19 Total. REF remains in the denominator and outside religious affiliation and no religion.",
        "The source excludes visitors or non-residents. The report's corresponding table specifies persons occupying institutions and non-resident visitors to households.",
        "No religious_change field is released because only the 2021 district wave ships."
      ),
      deferred_sources = list(
        list(source_dataset_id = "tsd-census-2016-religion", status = "deferred", reason = "Official district and village tables are available in PDF. A later extraction must resolve the published G 18/G 19 national discrepancy before any longitudinal product."),
        list(source_dataset_id = "tsd-census-2011-religion", status = "deferred", reason = "Official district and village tables are available in a PDH-hosted PDF and require a separate cross-wave category and geography comparison."),
        list(source_dataset_id = "tsd-census-2006-religion", status = "deferred", reason = "Official village table G 19 uses total population; district table G 18 uses private-household population and cannot be substituted."),
        list(source_dataset_id = "tsd-census-1996-subnational-religion", status = "not_pinned", reason = "PDH metadata confirms a religion variable, but no official aggregate subnational religion table was pinned.")
      )
    ),
    software_versions = list(
      r = R.version.string, readxl = as.character(packageVersion("readxl")), sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")), digest = as.character(packageVersion("digest")),
      mapshaper = "scripts/lib/simplify_boundary.R"
    )
  ),
  source = list(
    provider = "Tonga Statistics Department; geoBoundaries; Pacific Data Hub",
    source_dataset_ids = list(census_dataset_id, census_report_dataset_id, boundary_dataset_id),
    source_urls = list(census_url, census_report_url, census_hub_url, boundary_meta_url, boundary_url),
    retrieved_at = stamp,
    licence = paste(
      "The 2021 census report reserves commercial or for-profit reproduction and authorises partial scientific, educational, or research reproduction with TSD and source acknowledgement.",
      "geoBoundaries TON ADM2 is CC BY 4.0, verified in release metadata that identifies Pacific Data Hub as the source."
    ),
    citation = "Tonga Statistics Department, 2021 Census religion workbook G 19 and Volume 1; geoBoundaries TON ADM2."
  ),
  input_manifests = list(),
  durable_files = list(
    manifest_file_record(summary_json_out, "Tonga 2021 district census-affiliation area summary.", "accepted"),
    manifest_file_record(summary_csv_out, "Flattened Tonga 2021 district census-affiliation rows.", "accepted"),
    manifest_file_record(boundary_out, "Simplified geoBoundaries TON ADM2 district geometry.", "accepted")
  ),
  validation = list(
    status = "passed", commands = list(
      "Rscript scripts/build_to_area_summary.R",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/to/data/area_summary_district.json",
      "jq empty docs/manifests/to-census-religion-2021.json"
    ),
    notes = paste(
      "All 29 published G 19 rows close exactly across 22 mutually exclusive categories.",
      "The 23 district rows sum exactly to all five division rows and the national row for Total and every category.",
      "The district-boundary join is 23/23. Source and simplified geometry validity, distinct-hash, overlap, interior-gap, sliver, and provenance gates passed."
    ), warnings = list("Only the 2021 wave ships; no religious-change field is released.")
  ),
  stats = list(district_year_rows = 23L, district_count = 23L, shipped_wave_count = 1L, distinct_geometry_hashes = 23L),
  privacy = "public", licence_status = "accepted", downstream_status = "public",
  notes = "The derived product uses the census report's partial scientific and research reproduction permission with attribution. Commercial reuse requires separate permission. The map UI is outside this build."
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

cat("waves shipped: 2021 only; earlier 1996, 2006, 2011, and 2016 routes deferred\n")
cat("geography: 23 districts joined one-to-one to geoBoundaries TON ADM2 (2020)\n")
cat(sprintf("row gate: passed; 29/29 published rows close across %d categories\n", length(source_categories)))
cat(sprintf("local-to-national gate: passed; 23 districts sum exactly for %d fields\n", length(source_categories) + 1L))
cat(sprintf("denominator: national G 19 Total=%d; affiliation=%d; no religion=%d; refused retained in denominator=%d\n",
            national[["Total"]], national_affiliation, national[["NO Rel"]], national[["REF"]]))
cat(sprintf("join gate: passed; 23/23 districts; geometry gate: passed; 23 valid distinct features, overlap %.6f sq m, 0 interior gaps, 0 sub-1-sq-km slivers\n",
            boundary_result[["simplified_validation"]][["overlap_sq_m"]]))
cat(sprintf("boundary size gate: passed; %d bytes with %s at %g%% keep\n", file_bytes(boundary_out),
            boundary_result[["simplification"]][["method"]], boundary_result[["simplification"]][["keep_percent"]]))
cat(sprintf("provenance gate: passed; %d/%d cached inputs record SHA-256\n", length(raw_sources), length(raw_sources)))
cat("licence gate: passed for partial scientific, educational, or research reuse with TSD acknowledgement; commercial reuse remains reserved\n")
cat("change gate: passed by withholding; no cross-wave district change metric is released\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", boundary_out))
cat(sprintf("wrote %s\n", manifest_out))
