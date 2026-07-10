# build the czechia kraj area-summary product from CZSO census 2021.
# inputs: the CZSO DataStat SLD008T02 JSON-stat response (population by
# religious faith and region) and the GISCO NUTS3 2021 all-Europe GeoJSON.
# outputs: apps/regions/cz/data/cz_kraj_2021.geojson,
# apps/regions/cz/data/area_summary_kraj.{json,csv}, and
# docs/manifests/cz-census-religion-2021.json.
# run from the repo root: Rscript scripts/build_cz_area_summary.R

suppressMessages({
  library(jsonlite)
  library(sf)
})

raw_dir <- "data/raw/cz_census"
cz_dir <- "apps/regions/cz/data"
manifest_dir <- "docs/manifests"
dir.create(cz_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- "2026-07-09"
script_id <- "scripts/build_cz_area_summary.R"
country_code <- "CZ"
year <- 2021L

boundary_set_id <- "cz-kraj-2021-gisco-nuts3"
boundary_level <- "kraj"
census_dataset_id <- "czso-sld008t02-religion-by-kraj-2021"
boundary_dataset_id <- "gisco-nuts3-2021-cz"

# source urls recorded in the manifest and the on-page attribution.
catalogue_url <- "https://scitani.gov.cz/datastat/api/katalog/vybery/SLD008T02?jazyk=cs"
data_url <- "https://scitani.gov.cz/datastat/api/dotaz/data/vybery/SLD008T02?jazyk=cs"
census_page_url <- "https://scitani.gov.cz/nabozenska-vira"
reconciliation_url <- "https://scitani.gov.cz/docs/42301/aa331037-5c05-6d25-d9b9-07218379072e/sldb2021_pv_obyvatelstvo_podle_cirkvi_a_kraju.xlsx"
open_data_terms_url <- "https://csu.gov.cz/podminky_pro_vyuzivani_a_dalsi_zverejnovani_statistickych_udaju_csu"
gisco_nuts3_url <- "https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_01M_2021_4326_LEVL_3.geojson"

data_path <- file.path(raw_dir, "sld008t02_data_2021.json")
catalogue_path <- file.path(raw_dir, "sld008t02_catalogue.json")
gisco_nuts3_path <- file.path(raw_dir, "gisco_nuts3_2021_4326.geojson")
reconciliation_path <- file.path(raw_dir, "sldb2021_pv_obyvatelstvo_podle_cirkvi_a_kraju.xlsx")

boundary_out <- file.path(cz_dir, "cz_kraj_2021.geojson")
summary_json_out <- file.path(cz_dir, "area_summary_kraj.json")
summary_csv_out <- file.path(cz_dir, "area_summary_kraj.csv")
manifest_out <- file.path(manifest_dir, "cz-census-religion-2021.json")

licence_text <- paste(
  "Czech Statistical Office (CZSO) census 2021 open data, retrieved from the",
  "DataStat API. CZSO publishes its statistical outputs under open terms that",
  "permit reuse with attribution; see the CZSO conditions for using and",
  "further publishing statistical data. Boundaries are Eurostat GISCO NUTS3",
  "2021 (kraje are NUTS3 in Czechia), used under GISCO download provisions",
  "with attribution to EuroGeographics for the administrative boundaries."
)
licence_status <- "accepted"
# terms identity preserved separately from the shipping decision (schema v2)
licence_basis <- "czso_open_data_attribution_gisco_eurogeographics_attribution"

# order of the eight NABVIRAWS1 religion categories in the JSON-stat response.
# codes: 0 total, 20 believers with church, 9 Roman Catholic, 6 Hussite,
# 10 Czech Brethren, 46 believers without church, 1 no religion, 99 not stated.
nab_labels <- c(
  "total", "with_church", "catholic", "hussite",
  "brethren", "without_church", "no_religion", "not_stated"
)

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

# count rows or features for CSV, GeoJSON, and area-summary JSON files.
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$", path)) {
    geo <- fromJSON(path, simplifyVector = FALSE)
    return(length(geo[["features"]]))
  }
  if (grepl("\\.json$", path)) {
    json <- fromJSON(path, simplifyVector = FALSE)
    if (!is.null(json[["rows"]])) return(length(json[["rows"]]))
  }
  NA_integer_
}

# normalise a Czech region label so DataStat and GISCO names compare equal.
cz_norm <- function(x) {
  x <- trimws(as.character(x))
  x <- gsub("\\s+", " ", x)
  tolower(x)
}

# read the SLD008T02 JSON-stat response into one row per territory.
# the first three dimensions are singletons, so the flat value index is
# territory_index * 8 + category_index; national ČR (code 19) is kept for
# reconciliation and dropped from the shipped kraj rows.
read_census <- function(path) {
  parsed <- fromJSON(path, simplifyVector = FALSE)
  if (!identical(parsed[["id"]][[4]], "UzCrKr_H") ||
      !identical(parsed[["id"]][[5]], "NABVIRAWS1")) {
    stop("unexpected SLD008T02 dimension order", call. = FALSE)
  }
  size <- unlist(parsed[["size"]])
  if (size[[5]] != 8L) stop("expected 8 religion categories", call. = FALSE)

  terr <- parsed[["dimension"]][["UzCrKr_H"]][["category"]]
  year_label <- unlist(parsed[["dimension"]][["CenRoky1"]][["category"]][["label"]])
  if (!any(year_label == "2021")) stop("expected the 2021 census wave", call. = FALSE)

  values <- unlist(parsed[["value"]])
  codes <- names(sort(unlist(terr[["index"]])))
  do.call(rbind, lapply(codes, function(code) {
    idx <- terr[["index"]][[code]]
    block <- values[(idx * 8L + 1L):(idx * 8L + 8L)]
    names(block) <- nab_labels
    data.frame(
      terr_code = code,
      terr_name = as.character(terr[["label"]][[code]]),
      is_national = code == "19",
      total = block[["total"]],
      with_church = block[["with_church"]],
      without_church = block[["without_church"]],
      no_religion = block[["no_religion"]],
      not_stated = block[["not_stated"]],
      stringsAsFactors = FALSE
    )
  }))
}

# derive the stated-response denominator and headline counts for one census row.
# the denominator excludes neuvedeno (not stated); believers without a church
# (věřící - nehlásící se k církvi) count as religious affiliation.
derive_counts <- function(rows) {
  denominator <- rows[["total"]] - rows[["not_stated"]]
  religious_affiliation <- rows[["with_church"]] + rows[["without_church"]]
  data.frame(
    population_total = denominator,
    religious_affiliation_count = religious_affiliation,
    no_religion_count = rows[["no_religion"]],
    not_stated_count = rows[["not_stated"]],
    religious_affiliation_percent = round(100 * religious_affiliation / denominator, 2),
    no_religion_percent = round(100 * rows[["no_religion"]] / denominator, 2),
    stringsAsFactors = FALSE
  )
}

# prepare the CZ kraj boundary layer from the GISCO NUTS3 2021 all-Europe file.
read_boundary <- function(path) {
  nuts <- st_read(path, quiet = TRUE)
  kraj <- nuts[nuts[["CNTR_CODE"]] == "CZ" & nuts[["LEVL_CODE"]] == 3, ]
  if (nrow(kraj) != 14L) stop("expected 14 CZ NUTS3 kraje", call. = FALSE)
  kraj <- st_make_valid(kraj)
  kraj_metric <- st_transform(kraj, 3035)

  kraj[["area_code"]] <- as.character(kraj[["NUTS_ID"]])
  kraj[["area_name"]] <- as.character(kraj[["NAME_LATN"]])
  kraj[["area_unit_id"]] <- paste0(boundary_set_id, ":", kraj[["area_code"]])
  kraj[["boundary_set_id"]] <- boundary_set_id
  kraj[["boundary_level"]] <- boundary_level
  kraj[["nuts_id"]] <- as.character(kraj[["NUTS_ID"]])
  kraj[["join_name"]] <- cz_norm(kraj[["NAME_LATN"]])
  kraj[["land_area_sq_km"]] <- as.numeric(st_area(kraj_metric)) / 1e6

  if (any(duplicated(kraj[["join_name"]]))) {
    stop("duplicate NUTS3 kraj join names", call. = FALSE)
  }
  kraj
}

# match the census kraj rows to the boundary layer by normalised name.
match_to_boundary <- function(census_kraj, boundary) {
  source_key <- cz_norm(census_kraj[["terr_name"]])
  boundary_index <- match(source_key, boundary[["join_name"]])
  if (any(is.na(boundary_index))) {
    missing <- census_kraj[is.na(boundary_index), "terr_name"]
    stop("unmatched CZ kraj rows: ", paste(missing, collapse = "; "), call. = FALSE)
  }
  if (any(duplicated(boundary_index))) stop("duplicate matched kraj boundaries", call. = FALSE)
  if (length(boundary_index) != nrow(boundary)) {
    stop("unexpected matched kraj count", call. = FALSE)
  }
  counts <- derive_counts(census_kraj)
  data.frame(
    census_kraj,
    counts,
    area_code = boundary[["area_code"]][boundary_index],
    area_name = boundary[["area_name"]][boundary_index],
    area_unit_id = boundary[["area_unit_id"]][boundary_index],
    land_area_sq_km = boundary[["land_area_sq_km"]][boundary_index],
    stringsAsFactors = FALSE
  )
}

# build one schema-shaped area-summary row for one kraj.
build_area_row <- function(row) {
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = row[["area_unit_id"]],
    area_code = as.character(row[["area_code"]]),
    area_name = row[["area_name"]],
    year = year,
    population_total = null_if_na(as.integer(row[["population_total"]])),
    population_total_basis = "stated religion-response denominator: obyvatelstvo celkem minus neuvedeno (not stated)",
    religious_affiliation_count = null_if_na(as.integer(row[["religious_affiliation_count"]])),
    religious_affiliation_percent = null_if_na(row[["religious_affiliation_percent"]]),
    no_religion_count = null_if_na(as.integer(row[["no_religion_count"]])),
    no_religion_percent = null_if_na(row[["no_religion_percent"]]),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(row[["land_area_sq_km"]], 2),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = c(census_dataset_id, boundary_dataset_id),
    quality_flag = paste(
      "stated_response_denominator",
      "neuvedeno_excluded_from_denominator",
      "believers_without_church_in_religious_affiliation",
      sep = ";"
    )
  )
}

# flatten area-summary rows for the CSV sibling.
flatten_rows <- function(rows) {
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
      population_total = csv_scalar(row[["population_total"]], NA_integer_),
      population_total_basis = row[["population_total_basis"]],
      religious_affiliation_count = csv_scalar(row[["religious_affiliation_count"]], NA_integer_),
      religious_affiliation_percent = csv_scalar(row[["religious_affiliation_percent"]], NA_real_),
      no_religion_count = csv_scalar(row[["no_religion_count"]], NA_integer_),
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

# write the boundary, increasing simplification tolerance until it is small.
write_simplified_boundary <- function(boundary, output_path, field_names) {
  boundary_fields <- boundary[, field_names]
  tolerances <- c(50, 100, 200, 500, 1000, 1500, 2000)
  for (tolerance in tolerances) {
    candidate <- st_transform(boundary_fields, 3035)
    candidate <- st_simplify(candidate, dTolerance = tolerance, preserveTopology = TRUE)
    candidate <- st_make_valid(st_transform(candidate, 4326))
    if (any(st_is_empty(candidate))) next
    st_write(
      candidate,
      output_path,
      driver = "GeoJSON",
      delete_dsn = TRUE,
      quiet = TRUE,
      layer_options = c("COORDINATE_PRECISION=5")
    )
    bytes <- file_bytes(output_path)
    if (bytes <= 3000000L) return(list(tolerance_m = tolerance, bytes = bytes))
  }
  stop("simplified CZ boundary remains above 3 MB", call. = FALSE)
}

# create the source-dataset records for the area-summary document.
source_datasets <- function() {
  list(
    list(
      source_dataset_id = census_dataset_id,
      name = "CZSO census 2021 SLD008T02: population by religious faith and region (kraj)",
      provider = "Czech Statistical Office (Český statistický úřad)",
      url = data_url,
      retrieval_date = retrieval_date,
      local_path = data_path,
      licence = list(
        name = "CZSO open data; conditions for using and further publishing statistical data",
        url = open_data_terms_url,
        attribution = "Czech Statistical Office (ČSÚ)"
      ),
      citation = "Czech Statistical Office, Census 2021, DataStat table SLD008T02 (Obyvatelstvo podle náboženské víry a krajů).",
      access_limits = NULL,
      redistribution_limits = "Raw DataStat JSON is not committed; the derived public product attributes CZSO and links the source.",
      notes = "The DataStat SLD008T02 selection returns the 2021 census wave only. The stated-response denominator excludes neuvedeno (not stated); believers without a church count as religious affiliation."
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "Eurostat GISCO NUTS3 2021 boundaries (Czechia kraje)",
      provider = "Eurostat GISCO",
      url = gisco_nuts3_url,
      retrieval_date = retrieval_date,
      local_path = gisco_nuts3_path,
      licence = list(
        name = "GISCO download provisions with attribution; administrative boundaries © EuroGeographics",
        url = "https://ec.europa.eu/eurostat/web/gisco/geodata/statistical-units",
        attribution = "© EuroGeographics for the administrative boundaries"
      ),
      citation = "Eurostat GISCO, NUTS 2021 regions, level 3, 1:1 million.",
      access_limits = NULL,
      redistribution_limits = "The raw all-Europe GeoJSON is not committed; the simplified derived boundary attributes GISCO and EuroGeographics.",
      notes = "Czech kraje are NUTS3 units; 14 CZ features are filtered from the all-Europe NUTS3 2021 file."
    )
  )
}

# create the indicator metadata for the kraj product.
indicators_for_kraj <- function() {
  denominator_note <- paste(
    "Percentages use a stated religion-response denominator: obyvatelstvo",
    "celkem minus neuvedeno (not stated). Neuvedeno is large in Czechia and",
    "is excluded from the denominator, not counted as no religion."
  )
  list(
    list(
      indicator_id = "population_total",
      label = "Stated religion-response denominator",
      description = "Total population minus the not-stated (neuvedeno) category in the kraj.",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "obyvatelstvo celkem minus neuvedeno.",
      temporal_coverage = "2021",
      spatial_coverage = "Czechia kraje (NUTS3) in the 2021 census.",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious affiliation %",
      description = "Share of the stated-response denominator declaring a religious faith, whether or not tied to a church.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * (věřící hlásící se k církvi + věřící nehlásící se k církvi) / (total - neuvedeno).",
      temporal_coverage = "2021",
      spatial_coverage = "Czechia kraje (NUTS3) in the 2021 census.",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "No religion %",
      description = "Share of the stated-response denominator declaring no religious faith (bez náboženské víry).",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * bez náboženské víry / (total - neuvedeno).",
      temporal_coverage = "2021",
      spatial_coverage = "Czechia kraje (NUTS3) in the 2021 census.",
      quality_notes = denominator_note
    )
  )
}

# define the choropleth layers exposed by the shared region map.
visual_layers_for_kraj <- function() {
  list(
    list(
      visual_layer_id = "cz-kraj-religious-affiliation",
      label = "Religious affiliation %",
      description = "Czechia census 2021 religious-affiliation share.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "stated religion responses"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = "Believers with and without a church both count as religious affiliation."
    ),
    list(
      visual_layer_id = "cz-kraj-no-religion",
      label = "No religion %",
      description = "Czechia census 2021 no-religion share.",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "stated religion responses"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = "No religion is bez náboženské víry; neuvedeno is excluded from the denominator."
    )
  )
}

# assemble the schema-compatible area-summary document.
area_summary_document <- function(rows) {
  list(
    schema_version = "0.2.0",
    generated_at = stamp,
    generated_by = script_id,
    country_code = country_code,
    boundary_set = list(
      boundary_set_id = boundary_set_id,
      country_code = country_code,
      level = boundary_level,
      vintage = "2021",
      source_dataset_id = boundary_dataset_id
    ),
    site_snapshot = list(
      source_dataset_id = NULL,
      snapshot_date = NULL,
      basis = "no governed Czechia OpenStreetMap place-of-worship snapshot is included in this country data-map release",
      notes = "The Czechia page exposes census 2021 religious-affiliation and no-religion metrics only; place-density metrics are hidden until a governed Czechia place layer is built."
    ),
    source_datasets = source_datasets(),
    indicators = indicators_for_kraj(),
    visual_layers = visual_layers_for_kraj(),
    rows = rows
  )
}

# create a manifest durable-file record for one generated output.
manifest_file_record <- function(path, content, licence_status_value) {
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

# create a manifest raw-source record for one local source file.
raw_source_record <- function(path, url, format, row_count, source_id, used, notes) {
  list(
    uri = path,
    url = url,
    format = format,
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    row_count = row_count,
    source_dataset_id = source_id,
    used_in_public_product = used,
    periods = "2021",
    notes = notes
  )
}

required_sources <- c(data_path, gisco_nuts3_path)
invisible(lapply(required_sources, require_file))

census <- read_census(data_path)
census_kraj <- census[!census[["is_national"]], , drop = FALSE]
national <- census[census[["is_national"]], , drop = FALSE]
if (nrow(census_kraj) != 14L) stop("expected 14 kraj rows", call. = FALSE)
if (nrow(national) != 1L) stop("expected one national row", call. = FALSE)

boundary <- read_boundary(gisco_nuts3_path)
matched <- match_to_boundary(census_kraj, boundary)
matched <- matched[order(matched[["area_name"]]), ]

# reconcile the kraj rows against the national ČR row for every component.
national_counts <- derive_counts(national)
recon_fields <- c(
  "population_total", "religious_affiliation_count",
  "no_religion_count", "not_stated_count"
)
kraj_counts <- derive_counts(census_kraj)
national_reconciliation <- lapply(recon_fields, function(field) {
  kraj_sum <- sum(kraj_counts[[field]])
  national_value <- national_counts[[field]][[1]]
  list(
    year = year,
    metric = field,
    kraj_sum = kraj_sum,
    national_total = national_value,
    difference = kraj_sum - national_value
  )
})
for (check in national_reconciliation) {
  if (check[["difference"]] != 0) {
    stop("national reconciliation failed for ", check[["metric"]], call. = FALSE)
  }
}

boundary_write <- write_simplified_boundary(
  boundary,
  boundary_out,
  c("area_code", "area_name", "area_unit_id", "boundary_set_id",
    "boundary_level", "nuts_id", "land_area_sq_km")
)
if (row_count_file(boundary_out) != nrow(boundary)) {
  stop("kraj boundary feature count changed during simplification", call. = FALSE)
}

rows <- lapply(seq_len(nrow(matched)), function(index) {
  build_area_row(matched[index, , drop = FALSE])
})

write_json(area_summary_document(rows), summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

join_coverage <- list(
  boundary_level = boundary_level,
  year = year,
  matched_area_count = nrow(matched),
  expected_area_count = nrow(boundary),
  missing_area_names = list()
)

national_share_not_stated <- round(
  100 * national[["not_stated"]] / national[["total"]], 2
)

validation_checks <- c(
  "The CZSO DataStat SLD008T02 selection returns the 2021 census wave only; 1991, 2001, and 2011 are not retrievable at kraj level through this table.",
  "The 14 kraj rows sum exactly to the national ČR row for the stated-response denominator, religious affiliation, no religion, and not stated.",
  "All 14 kraj census rows join to the 14 GISCO NUTS3 2021 CZ features by normalised region name.",
  sprintf("The simplified kraj boundary GeoJSON writes to %d bytes after %d m simplification.", boundary_write[["bytes"]], boundary_write[["tolerance_m"]]),
  "Percentages use a stated-response denominator: obyvatelstvo celkem minus neuvedeno. Neuvedeno is excluded, not counted as no religion.",
  "Believers without a church (věřící - nehlásící se k církvi) count as religious affiliation, not as no religion."
)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:cz-census-religion:cz:2021:czso-sld008t02",
  dataset_id = "cz-census-religion:cz:2021:czso-sld008t02",
  dataset_version_id = paste0("cz-census-religion:cz:2021:czso-sld008t02:", substr(sha256_file(summary_json_out), 1, 12)),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "cz-census-religion",
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
      kraj_boundary_set = boundary_set_id,
      kraj_boundary_simplification_tolerance_m = boundary_write[["tolerance_m"]],
      denominator = "obyvatelstvo celkem minus neuvedeno (not stated)",
      omitted_metrics = c("religious_change", "places_per_10000_residents", "place_density_per_sq_km")
    ),
    software_versions = list(
      r = paste(R.version[["major"]], R.version[["minor"]], sep = "."),
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite"))
    )
  ),
  source = list(
    provider = "Czech Statistical Office (ČSÚ); Eurostat GISCO",
    source_dataset_ids = c(census_dataset_id, boundary_dataset_id),
    source_urls = c(catalogue_url, data_url, census_page_url, reconciliation_url, gisco_nuts3_url, open_data_terms_url),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = licence_text,
    citation = "Czech Statistical Office, Census 2021 SLD008T02; Eurostat GISCO NUTS3 2021.",
    raw_redistribution = "Raw DataStat JSON, the reconciliation XLSX, and the all-Europe GISCO GeoJSON are not committed. They remain in data/raw/cz_census/ and await any project-controlled raw archive upload."
  ),
  input_manifests = list(),
  raw_sources = list(
    raw_source_record(
      data_path, data_url, "json", 15L, census_dataset_id, TRUE,
      "CZSO DataStat SLD008T02 JSON-stat response; national ČR row plus 14 kraje for the 2021 wave."
    ),
    raw_source_record(
      catalogue_path, catalogue_url, "json", NA_integer_, census_dataset_id, FALSE,
      "CZSO DataStat SLD008T02 selection catalogue; confirms the CenRoky1 filter pins the 2021 census wave."
    ),
    raw_source_record(
      reconciliation_path, reconciliation_url, "xlsx", 84L, census_dataset_id, FALSE,
      "CZSO census 2021 believers-by-church-and-kraj workbook; total population and believers-with-church per kraj reconcile exactly with the DataStat extraction."
    ),
    raw_source_record(
      gisco_nuts3_path, gisco_nuts3_url, "geojson", 14L, boundary_dataset_id, TRUE,
      "GISCO NUTS3 2021 all-Europe GeoJSON filtered to the 14 CZ kraje for the boundary product."
    )
  ),
  durable_files = list(
    manifest_file_record(summary_json_out, "Czechia kraj area summary with CZSO census 2021 religious-affiliation and no-religion metrics.", licence_status),
    manifest_file_record(summary_csv_out, "Flattened Czechia kraj area summary with CZSO census 2021 religious-affiliation and no-religion metrics.", licence_status),
    manifest_file_record(boundary_out, "Simplified Czechia kraj boundary GeoJSON derived from GISCO NUTS3 2021.", "gisco_download_provisions_eurogeographics_attribution")
  ),
  derived_outputs = list(
    list(
      uri = paste0("repo:", summary_json_out),
      sha256 = sha256_file(summary_json_out),
      built_by = script_id,
      notes = "14 kraj reporting units x 1 census year; denominator is total population minus neuvedeno."
    ),
    list(
      uri = paste0("repo:", boundary_out),
      sha256 = sha256_file(boundary_out),
      built_by = script_id,
      notes = sprintf("14 GISCO NUTS3 2021 CZ features simplified at %d m tolerance.", boundary_write[["tolerance_m"]])
    )
  ),
  validation = list(
    checks = validation_checks,
    join_coverage = list(kraj = list(join_coverage)),
    national_reconciliation = national_reconciliation,
    national_not_stated_share_percent = national_share_not_stated,
    boundary_validation = list(
      source_cz_feature_count = nrow(boundary),
      output_feature_count = row_count_file(boundary_out),
      expected_feature_count = nrow(boundary),
      output_bytes = boundary_write[["bytes"]],
      simplification_tolerance_m = boundary_write[["tolerance_m"]],
      unmatched_boundary_features = list(),
      unmatched_census_areas = list()
    )
  ),
  construct_notes = list(
    "The public map displays two headline metrics for 2021: religious affiliation percent and no religion percent.",
    "The denominator is the stated religion-response population: obyvatelstvo celkem minus neuvedeno (not stated).",
    "Neuvedeno is large in Czechia (30.05% of the population nationally) and remains its own category, excluded from the denominator rather than counted as no religion.",
    "Religious affiliation is věřící - hlásící se k církvi (believers with a church) plus věřící - nehlásící se k církvi (believers without a church). The 2021 census used write-in responses, so the with-church count is broken down into individually coded churches in the source.",
    "No religion is bez náboženské víry.",
    "Only the 2021 wave is retrievable at kraj level via SLD008T02; the SLD008 dataset uses the 2021 write-in classification (NABVIRAWS1), which is not populated for 1991, 2001, or 2011. Earlier subnational waves are deferred until a compatible source and classification crosswalk are pinned."
  ),
  deferred_sources = list(
    list(
      source_dataset_id = "czso-census-pre2021-religion-by-kraj",
      url = census_page_url,
      local_path = NULL,
      notes = "The DataStat SLD008T02 selection and the underlying SLD008 dataset return the 2021 census only; the CenRoky1 dimension carries four census-year codelist slots, but the data endpoint (GET-only; POST returns 405) and a year-filter override both return 2021. Earlier waves used fixed religion lists incompatible with the 2021 write-in classification and are deferred; the nabozenska-vira page reports a 1991-2021 comparison at national level only."
    )
  ),
  privacy = "public",
  licence_status = licence_status,
  licence_basis = licence_basis,
  downstream_status = "public",
  source_datasets = source_datasets(),
  notes = "The committed products contain the derived kraj area summary and simplified boundary only. On-page attribution cites CZSO and Eurostat GISCO/EuroGeographics."
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
manifest_text <- paste(readLines(manifest_out, warn = FALSE), collapse = "\n")
if (!jsonlite::validate(manifest_text)) stop("manifest JSON failed jsonlite validation", call. = FALSE)

cat(sprintf("wrote %s: %d rows\n", summary_json_out, length(rows)))
cat(sprintf("wrote %s: %d rows\n", summary_csv_out, row_count_file(summary_csv_out)))
cat(sprintf("wrote %s: %d features, %d bytes at %d m\n", boundary_out, row_count_file(boundary_out), file_bytes(boundary_out), boundary_write[["tolerance_m"]]))
cat(sprintf("wrote %s\n", manifest_out))
cat(sprintf("join coverage: %d/%d\n", join_coverage[["matched_area_count"]], join_coverage[["expected_area_count"]]))
cat(sprintf("national not-stated share: %.2f%%\n", national_share_not_stated))
cat("national reconciliation: exact for denominator, religious affiliation, no religion, and not stated\n")
