# build the india district area-summary products from Census of India C-01.
# inputs: Census of India 2001/2011 C-01 XLS workbooks and DataMeet 2001/2011
# district shapefiles under data/raw/in_census/.
# outputs: apps/regions/in/data/districts_2001.geojson, districts_2011.geojson,
# apps/regions/in/data/area_summary_district_2001.{json,csv},
# apps/regions/in/data/area_summary_district_2011.{json,csv}, and
# docs/manifests/in-census-religion-2001-2011.json.
# run from the repo root: Rscript scripts/build_in_area_summary.R

suppressMessages({
  library(dplyr)
  library(jsonlite)
  library(readxl)
  library(sf)
})

raw_dir <- "data/raw/in_census"
in_dir <- "apps/regions/in/data"
manifest_dir <- "docs/manifests"
dir.create(in_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- "2026-07-09"
script_id <- "scripts/build_in_area_summary.R"
country_code <- "IN"

census_2011_dataset_id <- "censusindia-2011-c01-religious-community"
census_2001_dataset_id <- "censusindia-2001-c01-religious-community"
census_1991_dataset_id <- "censusindia-1991-c09-religion"
boundary_2011_dataset_id <- "datameet-india-districts-census-2011"
boundary_2001_dataset_id <- "datameet-india-districts-census-2001"
boundary_set_2011 <- "in-district-2011-datameet"
boundary_set_2001 <- "in-district-2001-datameet"

census_api_2011_url <- "https://censusindia.gov.in/nada/index.php/api/tables/data/global/census_tables/100/0/?ft_query=C-01%20Population%20by%20religious%20community&series_id=15&census_year=2011"
census_api_2001_url <- "https://censusindia.gov.in/nada/index.php/api/tables/data/global/census_tables/100/0/?ft_query=C-01%20Population%20by%20religious%20community&series_id=15&census_year=2001"
census_1991_url <- "https://censusindia.gov.in/nada/index.php/catalog/35737/download/39400/1991-C09T-0100.xlsx"
census_tables_url <- "https://censusindia.gov.in/census.website/data/census-tables"
godl_url <- "https://www.data.gov.in/sites/default/files/Gazette_Notification_OGDL.pdf"
datameet_repo_url <- "https://github.com/datameet/maps"
datameet_districts_url <- "https://github.com/datameet/maps/tree/master/Districts"
datameet_2011_url <- "https://github.com/datameet/maps/tree/master/Districts/Census_2011"
datameet_2001_url <- "https://github.com/datameet/maps/tree/master/Districts/Census_2001"
geoboundaries_adm2_api_url <- "https://www.geoboundaries.org/api/current/gbOpen/IND/ADM2/"

census_api_2011_path <- file.path(raw_dir, "censusindia_api_2011_c01.json")
census_api_2001_path <- file.path(raw_dir, "censusindia_api_2001_c01.json")
census_1991_path <- file.path(raw_dir, "1991-C09T-0100.xlsx")
datameet_readme_path <- file.path(raw_dir, "datameet_maps_README.md")
datameet_districts_readme_path <- file.path(raw_dir, "datameet_districts_README.md")
datameet_license_path <- file.path(raw_dir, "datameet_maps_LICENSE")

district_2011_shp <- file.path(raw_dir, "datameet_districts_2011", "2011_Dist.shp")
district_2001_shp <- file.path(raw_dir, "datameet_districts_2001", "2001_Dist.shp")

boundary_2011_out <- file.path(in_dir, "districts_2011.geojson")
boundary_2001_out <- file.path(in_dir, "districts_2001.geojson")
summary_2011_json_out <- file.path(in_dir, "area_summary_district_2011.json")
summary_2011_csv_out <- file.path(in_dir, "area_summary_district_2011.csv")
summary_2001_json_out <- file.path(in_dir, "area_summary_district_2001.json")
summary_2001_csv_out <- file.path(in_dir, "area_summary_district_2001.csv")
manifest_out <- file.path(manifest_dir, "in-census-religion-2001-2011.json")

census_licence_text <- paste(
  "Government Open Data License - India attribution basis. The Census of",
  "India portal exposes public C-01 XLS downloads; the licence statement",
  "recorded here is the Government of India GODL-India gazette, which grants",
  "lawful commercial and non-commercial use with provider, source, and licence",
  "attribution for shareable non-sensitive government data."
)
datameet_licence_text <- paste(
  "DataMeet districts README declares the district dataset under Creative",
  "Commons Attribution 2.5 India; the repository README states CC BY 4.0 by",
  "default where a dataset does not state otherwise. The district README is",
  "the controlling district-boundary licence record used here."
)

# stop early when a raw source required for the governed build is missing.
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

# normalise arbitrary labels into the raw-cache filenames made from API items.
safe_label <- function(value) {
  gsub("[^A-Za-z0-9]+", "_", value)
}

# return the local workbook path for one API item.
census_item_path <- function(item, prefix) {
  link <- item[["links"]][[1]][["link"]]
  file.path(
    raw_dir,
    sprintf(
      "%s_%s_%s.%s",
      prefix,
      item[["table_id"]],
      safe_label(item[["state_name"]]),
      tools::file_ext(link)
    )
  )
}

# read one cached Census API response as a list of source items.
api_items <- function(path) {
  require_file(path)
  api <- fromJSON(path, simplifyVector = FALSE)
  if (!length(api[["data"]])) stop("API manifest has no data: ", path, call. = FALSE)
  api[["data"]][[1]][["items"]]
}

# parse integer Census count cells while rejecting malformed values.
parse_count <- function(value) {
  value <- gsub(",", "", trimws(as.character(value)))
  value[value %in% c("", "NA", "N/A")] <- NA_character_
  parsed <- suppressWarnings(as.numeric(value))
  if (any(is.na(parsed) & !is.na(value))) {
    stop("failed to parse count cell: ", paste(unique(value[is.na(parsed) & !is.na(value)]), collapse = ", "), call. = FALSE)
  }
  parsed
}

# remove the source's area prefixes from names for display and joins.
clean_area_name <- function(value) {
  value <- sub("^District - ", "", value)
  value <- sub("^State - ", "", value)
  trimws(value)
}

# turn one Census C-01 workbook into source rows for a target geography.
read_c01_workbook <- function(path, year, geography = c("district", "state", "national")) {
  geography <- match.arg(geography)
  require_file(path)
  raw <- suppressMessages(read_excel(path, col_names = FALSE, skip = 7, col_types = "text"))
  names(raw) <- paste0("v", seq_along(raw))
  raw <- raw[raw[["v7"]] == "Total", ]

  if (year == 2011L) {
    if (geography == "district") {
      rows <- raw[!is.na(raw[["v3"]]) & raw[["v3"]] != "000" & raw[["v4"]] == "00000" & raw[["v5"]] == "000000", ]
      area_code <- rows[["v3"]]
    } else if (geography == "state") {
      rows <- raw[!is.na(raw[["v2"]]) & raw[["v2"]] != "00" & raw[["v3"]] == "000" & raw[["v4"]] == "00000" & raw[["v5"]] == "000000", ]
      area_code <- rows[["v2"]]
    } else {
      rows <- raw[raw[["v2"]] == "00" & raw[["v3"]] == "000" & raw[["v4"]] == "00000" & raw[["v5"]] == "000000", ]
      area_code <- "IN"
    }
  } else if (year == 2001L) {
    if (geography == "district") {
      rows <- raw[!is.na(raw[["v3"]]) & raw[["v3"]] != "00" & raw[["v4"]] == "0000" & raw[["v5"]] == "00000000", ]
      area_code <- paste0(rows[["v2"]], rows[["v3"]])
    } else if (geography == "state") {
      rows <- raw[!is.na(raw[["v2"]]) & raw[["v2"]] != "00" & raw[["v3"]] == "00" & raw[["v4"]] == "0000" & raw[["v5"]] == "00000000", ]
      area_code <- rows[["v2"]]
    } else {
      rows <- raw[raw[["v2"]] == "00" & raw[["v3"]] == "00" & raw[["v4"]] == "0000" & raw[["v5"]] == "00000000", ]
      area_code <- "IN"
    }
  } else {
    stop("unsupported C-01 year: ", year, call. = FALSE)
  }

  if (!nrow(rows)) stop("no ", geography, " rows found in ", path, call. = FALSE)

  total <- parse_count(rows[["v8"]])
  hindu <- parse_count(rows[["v11"]])
  muslim <- parse_count(rows[["v14"]])
  christian <- parse_count(rows[["v17"]])
  sikh <- parse_count(rows[["v20"]])
  buddhist <- parse_count(rows[["v23"]])
  jain <- parse_count(rows[["v26"]])
  other_religions <- parse_count(rows[["v29"]])
  religion_not_stated <- parse_count(rows[["v32"]])
  religious_affiliation <- hindu + muslim + christian + sikh + buddhist + jain + other_religions
  if (any(religious_affiliation != total - religion_not_stated, na.rm = TRUE)) {
    stop("religion category sum does not equal total minus not stated in ", path, call. = FALSE)
  }

  data.frame(
    year = year,
    state_code = rows[["v2"]],
    district_code = rows[["v3"]],
    area_code = area_code,
    source_area_name = clean_area_name(rows[["v6"]]),
    total_population = total,
    hindu_count = hindu,
    muslim_count = muslim,
    christian_count = christian,
    sikh_count = sikh,
    buddhist_count = buddhist,
    jain_count = jain,
    other_religions_count = other_religions,
    religion_not_stated_count = religion_not_stated,
    religious_affiliation_count = religious_affiliation,
    religious_affiliation_percent = ifelse(total > 0, round(100 * religious_affiliation / total, 2), NA_real_),
    stringsAsFactors = FALSE
  )
}

# read every state workbook for a census wave and retain district rows.
read_c01_wave <- function(year, api_path, prefix) {
  items <- api_items(api_path)
  state_items <- Filter(function(item) item[["state_name"]] != "India", items)
  rows <- lapply(state_items, function(item) {
    path <- census_item_path(item, prefix)
    out <- read_c01_workbook(path, year, "district")
    out[["state_name_api"]] <- item[["state_name"]]
    out[["source_table_id"]] <- item[["table_id"]]
    out[["source_url"]] <- item[["links"]][[1]][["link"]]
    out
  })
  do.call(rbind, rows)
}

# read state and national rows used for exact reconciliation.
read_validation_rows <- function(year, api_path, prefix) {
  items <- api_items(api_path)
  state_items <- Filter(function(item) item[["state_name"]] != "India", items)
  india_item <- Filter(function(item) item[["state_name"]] == "India", items)
  if (length(india_item) != 1L) stop("expected one India item for ", year, call. = FALSE)

  states <- lapply(state_items, function(item) {
    row <- read_c01_workbook(census_item_path(item, prefix), year, "state")
    row[["state_name_api"]] <- item[["state_name"]]
    row
  })

  list(
    state_rows = do.call(rbind, states),
    national_row = read_c01_workbook(census_item_path(india_item[[1]], prefix), year, "national")
  )
}

# build source-dataset metadata for one area-summary product.
source_datasets_for_year <- function(year) {
  if (year == 2011L) {
    list(
      list(
        source_dataset_id = census_2011_dataset_id,
        name = "Census of India 2011 C-01: Population by religious community",
        provider = "Office of the Registrar General and Census Commissioner, India",
        url = census_api_2011_url,
        retrieval_date = retrieval_date,
        local_path = census_api_2011_path,
        licence = list(name = "Government Open Data License - India attribution basis", url = godl_url, attribution = "Office of the Registrar General and Census Commissioner, India"),
        citation = "Census of India 2011, C-01: Population by religious community, state XLS workbooks.",
        access_limits = "The local curl client required certificate-verification bypass for censusindia.gov.in; browser/API access is otherwise open.",
        redistribution_limits = "Raw XLS workbooks are not committed; derived public products attribute Census of India and link to the source.",
        notes = "The product uses district total rows from each state workbook. Religion not stated is excluded from the religious-affiliation numerator and is not interpreted as no religion."
      ),
      list(
        source_dataset_id = boundary_2011_dataset_id,
        name = "DataMeet India district boundaries, Census 2011",
        provider = "DataMeet India community",
        url = datameet_2011_url,
        retrieval_date = retrieval_date,
        local_path = dirname(district_2011_shp),
        licence = list(name = "Creative Commons Attribution 2.5 India", url = "https://creativecommons.org/licenses/by/2.5/in/", attribution = "DataMeet India community"),
        citation = "DataMeet India community, Districts/Census_2011 in datameet/maps.",
        access_limits = NULL,
        redistribution_limits = "Simplified derived boundary GeoJSON attributes DataMeet and links to the source.",
        notes = "One 'Data Not Available' feature with censuscode 0 is removed before publication; the remaining 640 features match Census C-01 district codes exactly."
      )
    )
  } else if (year == 2001L) {
    list(
      list(
        source_dataset_id = census_2001_dataset_id,
        name = "Census of India 2001 C-01: Population by religious community",
        provider = "Office of the Registrar General and Census Commissioner, India",
        url = census_api_2001_url,
        retrieval_date = retrieval_date,
        local_path = census_api_2001_path,
        licence = list(name = "Government Open Data License - India attribution basis", url = godl_url, attribution = "Office of the Registrar General and Census Commissioner, India"),
        citation = "Census of India 2001, C-01: Population by religious community, state XLS workbooks.",
        access_limits = "The local curl client required certificate-verification bypass for censusindia.gov.in; browser/API access is otherwise open.",
        redistribution_limits = "Raw XLS workbooks are not committed; derived public products attribute Census of India and link to the source.",
        notes = "The product uses district total rows from each state workbook. Religion not stated is excluded from the religious-affiliation numerator and is not interpreted as no religion."
      ),
      list(
        source_dataset_id = boundary_2001_dataset_id,
        name = "DataMeet India district boundaries, Census 2001",
        provider = "DataMeet India community",
        url = datameet_2001_url,
        retrieval_date = retrieval_date,
        local_path = dirname(district_2001_shp),
        licence = list(name = "Creative Commons Attribution 2.5 India", url = "https://creativecommons.org/licenses/by/2.5/in/", attribution = "DataMeet India community"),
        citation = "DataMeet India community, Districts/Census_2001 in datameet/maps.",
        access_limits = NULL,
        redistribution_limits = "Simplified derived boundary GeoJSON attributes DataMeet and links to the source.",
        notes = "One 'Data Not Available' feature with state and district code 99 is removed before publication; the remaining 593 features match Census C-01 district codes exactly."
      )
    )
  } else {
    stop("unsupported year for source datasets: ", year, call. = FALSE)
  }
}

# create shared indicator metadata for India district products.
indicators_for_india <- function(year, level_label) {
  list(
    list(
      indicator_id = "population_total",
      label = "Total population",
      description = paste("Census of India", year, "C-01 total persons in the reporting district."),
      unit = "count",
      denominator_indicator_id = NULL,
      method = "C-01 Total persons.",
      temporal_coverage = as.character(year),
      spatial_coverage = level_label,
      quality_notes = "The denominator includes Religion not stated. Religion not stated is not a no-religion category."
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious affiliation %",
      description = "Share of total persons counted in the seven named or other religious-affiliation categories.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * (Hindu + Muslim + Christian + Sikh + Buddhist + Jain + Other religions and persuasions) / C-01 Total persons.",
      temporal_coverage = as.character(year),
      spatial_coverage = level_label,
      quality_notes = "Religion not stated is excluded from the numerator and is not interpreted as no religion."
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "No religion %",
      description = "Unavailable: the Census of India C-01 category set has no no-religion category.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "Not calculated. C-01 has Hindu, Muslim, Christian, Sikh, Buddhist, Jain, Other religions and persuasions, and Religion not stated; Religion not stated is not a no-religion category.",
      temporal_coverage = as.character(year),
      spatial_coverage = level_label,
      quality_notes = "Rows carry no_religion_category_absent and null no_religion_count/no_religion_percent values."
    )
  )
}

# define the only choropleth layer exposed for the India product.
visual_layers_for_india <- function(year, level_id) {
  list(
    list(
      visual_layer_id = paste0("in-", level_id, "-religious-affiliation"),
      label = "Religious affiliation %",
      description = paste("Census of India", year, "religious-affiliation share of total persons."),
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = NULL,
      colour_scale = "shared sequential blue",
      time_control = "year_selector",
      aggregation_rule = "reported district value",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = "No no-religion layer is exposed because C-01 has no no-religion category."
    )
  )
}

# create an area-summary JSON document for a single district vintage.
area_summary_document <- function(rows, year, boundary_set_id, boundary_dataset_id, level_label) {
  list(
    schema_version = "0.2.0",
    generated_at = stamp,
    generated_by = script_id,
    country_code = country_code,
    boundary_set = list(
      boundary_set_id = boundary_set_id,
      country_code = country_code,
      level = level_label,
      vintage = as.character(year),
      source_dataset_id = boundary_dataset_id
    ),
    site_snapshot = list(
      source_dataset_id = NULL,
      snapshot_date = NULL,
      basis = "no governed India OpenStreetMap place-of-worship snapshot is included in this country data-map release",
      notes = "The India page exposes Census of India religious-affiliation percentages only; place-density metrics are hidden until a governed India place layer is built."
    ),
    source_datasets = source_datasets_for_year(year),
    indicators = indicators_for_india(year, level_label),
    visual_layers = visual_layers_for_india(year, level_label),
    rows = rows
  )
}

# convert NA values to JSON null scalars.
null_if_na <- function(value) {
  if (length(value) == 0L || is.na(value) || !is.finite(value)) return(NULL)
  value
}

# create one schema-shaped area-summary row from census and boundary metadata.
build_area_row <- function(area, count_row, year, boundary_set_id, boundary_dataset_id, census_dataset_id, level_label) {
  flags <- c("no_religion_category_absent", paste0("uses_", year, "_period_district_boundary"))
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = level_label,
    area_unit_id = paste0(boundary_set_id, ":", area[["area_code"]][1]),
    area_code = area[["area_code"]][1],
    area_name = area[["area_name"]][1],
    year = year,
    population_total = as.integer(round(count_row[["total_population"]][1])),
    population_total_basis = paste0(
      "Census of India ", year,
      " C-01 Total persons; religious_affiliation_count excludes Religion not stated, which is not a no-religion category"
    ),
    religious_affiliation_count = as.integer(round(count_row[["religious_affiliation_count"]][1])),
    religious_affiliation_percent = null_if_na(count_row[["religious_affiliation_percent"]][1]),
    no_religion_count = NULL,
    no_religion_percent = NULL,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(area[["land_area_sq_km"]][1], 2),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = c(census_dataset_id, boundary_dataset_id),
    quality_flag = paste(flags, collapse = ";")
  )
}

# flatten area-summary rows for the CSV sibling.
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
      religious_affiliation_percent = if (is.null(row[["religious_affiliation_percent"]])) NA_real_ else row[["religious_affiliation_percent"]],
      no_religion_count = NA_integer_,
      no_religion_percent = NA_real_,
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

# return row or feature counts for generated files where cheap to compute.
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$", path)) {
    geo <- fromJSON(path, simplifyVector = FALSE)
    return(length(geo[["features"]]))
  }
  if (grepl("\\.json$", path)) {
    json <- fromJSON(path, simplifyVector = FALSE)
    if (!is.null(json[["rows"]])) return(length(json[["rows"]]))
    if (!is.null(json[["data"]][[1]][["items"]])) return(length(json[["data"]][[1]][["items"]]))
  }
  NA_integer_
}

# validate a JSON file by reading its contents, not the path string.
validate_json_file <- function(path) {
  jsonlite::validate(paste(readLines(path, warn = FALSE), collapse = "\n"))
}

# create a manifest durable-file record for one generated output.
manifest_file_record <- function(path, content, licence_status) {
  list(
    uri = paste0("repo:", path),
    storage_provider = "git_repository",
    format = sub("^.*\\.", "", path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    row_count = row_count_file(path),
    content = content,
    privacy = "public",
    licence_status = licence_status
  )
}

# convert a local raw source into a manifest record.
raw_file_record <- function(path, notes, source_dataset_id = NULL, url = NULL, used_in_public_product = TRUE) {
  list(
    uri = path,
    url = url,
    format = sub("^.*\\.", "", path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    row_count = row_count_file(path),
    source_dataset_id = source_dataset_id,
    used_in_public_product = used_in_public_product,
    notes = notes
  )
}

# create raw-source records for every C-01 workbook named by an API response.
census_raw_records <- function(year, api_path, prefix, dataset_id) {
  items <- api_items(api_path)
  lapply(items, function(item) {
    path <- census_item_path(item, prefix)
    require_file(path)
    raw_file_record(
      path = path,
      url = item[["links"]][[1]][["link"]],
      source_dataset_id = dataset_id,
      used_in_public_product = TRUE,
      notes = sprintf(
        "Census of India %d C-01 XLS workbook for %s (%s); district rows are used except the India workbook, which is used for national validation.",
        year,
        item[["state_name"]],
        item[["table_id"]]
      )
    )
  })
}

# create raw-source records for shapefile sidecars and boundary documentation.
boundary_raw_records <- function() {
  boundary_files <- c(
    list.files(file.path(raw_dir, "datameet_districts_2011"), full.names = TRUE),
    list.files(file.path(raw_dir, "datameet_districts_2001"), full.names = TRUE),
    datameet_readme_path,
    datameet_districts_readme_path,
    datameet_license_path
  )
  lapply(boundary_files, function(path) {
    dataset_id <- if (grepl("2011_Dist", basename(path))) {
      boundary_2011_dataset_id
    } else if (grepl("2001_Dist", basename(path))) {
      boundary_2001_dataset_id
    } else {
      "datameet-maps-documentation"
    }
    raw_file_record(
      path = path,
      source_dataset_id = dataset_id,
      used_in_public_product = TRUE,
      notes = "DataMeet boundary source or licence/provenance documentation used for India district boundary products."
    )
  })
}

# create raw-source records for pinned but deferred or rejected sources.
deferred_raw_records <- function() {
  records <- list()
  if (file.exists(census_1991_path)) {
    records <- c(records, list(raw_file_record(
      path = census_1991_path,
      url = census_1991_url,
      source_dataset_id = census_1991_dataset_id,
      used_in_public_product = FALSE,
      notes = "Census of India 1991 C-9 Religion workbook pinned and downloaded, but deferred because no clean 1991 period district boundary or state-split harmonisation is included in this build."
    )))
  }
  adm2_path <- file.path(raw_dir, "geoboundaries_ind_adm2_2021_simplified.geojson")
  if (file.exists(adm2_path)) {
    records <- c(records, list(raw_file_record(
      path = adm2_path,
      url = "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/IND/ADM2/geoBoundaries-IND-ADM2_simplified.geojson",
      source_dataset_id = "geoboundaries-ind-adm2-2021",
      used_in_public_product = FALSE,
      notes = "Pinned fallback current ADM2 boundary source. Not used because DataMeet provides period district boundaries for the 2001 and 2011 C-01 waves."
    )))
  }
  records
}

# compare district sums with state and national source rows.
validate_census_totals <- function(count_rows, validation_rows, year) {
  metrics <- c(
    "total_population",
    "religious_affiliation_count",
    "hindu_count",
    "muslim_count",
    "christian_count",
    "sikh_count",
    "buddhist_count",
    "jain_count",
    "other_religions_count",
    "religion_not_stated_count"
  )
  state_checks <- lapply(split(count_rows, count_rows[["state_code"]]), function(state_counts) {
    state_code <- state_counts[["state_code"]][1]
    state_source <- validation_rows[["state_rows"]][validation_rows[["state_rows"]][["state_code"]] == state_code, ]
    if (nrow(state_source) != 1L) stop("missing source state row for ", year, " state ", state_code, call. = FALSE)
    metric_checks <- lapply(metrics, function(metric) {
      area_sum <- sum(state_counts[[metric]], na.rm = TRUE)
      state_value <- state_source[[metric]][1]
      list(metric = metric, district_sum = area_sum, state_total = state_value, difference = area_sum - state_value)
    })
    list(
      year = year,
      state_code = state_code,
      state_name = state_source[["source_area_name"]][1],
      district_count = nrow(state_counts),
      checks = metric_checks
    )
  })

  national_checks <- lapply(metrics, function(metric) {
    district_sum <- sum(count_rows[[metric]], na.rm = TRUE)
    national_value <- validation_rows[["national_row"]][[metric]][1]
    list(metric = metric, district_sum = district_sum, national_total = national_value, difference = district_sum - national_value)
  })

  all_differences <- unlist(lapply(c(state_checks, list(list(checks = national_checks))), function(group) {
    vapply(group[["checks"]], function(check) check[["difference"]], numeric(1))
  }))
  if (any(all_differences != 0, na.rm = TRUE)) {
    stop("Census total reconciliation failed for ", year, call. = FALSE)
  }

  list(
    year = year,
    district_count = nrow(count_rows),
    state_validation = state_checks,
    national_validation = national_checks
  )
}

# report join coverage for one boundary vintage and wave.
join_coverage <- function(boundary_codes, count_rows, year) {
  count_codes <- unique(count_rows[["area_code"]])
  missing <- sort(setdiff(boundary_codes, count_codes))
  extra <- sort(setdiff(count_codes, boundary_codes))
  list(
    year = year,
    matched_area_count = length(intersect(boundary_codes, count_codes)),
    expected_area_count = length(boundary_codes),
    source_area_count = length(count_codes),
    missing_area_codes = as.list(missing),
    extra_source_area_codes = as.list(extra)
  )
}

# read, label, measure, simplify, and write a district boundary layer.
write_boundary_product <- function(path, year, output_path) {
  raw <- st_read(path, quiet = TRUE)
  if (year == 2011L) {
    raw[["area_code"]] <- sprintf("%03d", as.integer(raw[["censuscode"]]))
    raw[["area_name"]] <- paste0(raw[["DISTRICT"]], ", ", raw[["ST_NM"]])
    removed <- raw[raw[["area_code"]] == "000" | raw[["DISTRICT"]] == "Data Not Available", ]
    boundaries <- raw[!(raw[["area_code"]] == "000" | raw[["DISTRICT"]] == "Data Not Available"), ]
  } else if (year == 2001L) {
    raw[["area_code"]] <- paste0(sprintf("%02d", as.integer(raw[["ST_CEN_CD"]])), sprintf("%02d", as.integer(raw[["DT_CEN_CD"]])))
    raw[["area_name"]] <- paste0(raw[["DISTRICT"]], ", ", raw[["ST_NM"]])
    removed <- raw[raw[["ST_CEN_CD"]] == "99" | raw[["DT_CEN_CD"]] == "99" | raw[["DISTRICT"]] == "Data Not Available", ]
    boundaries <- raw[!(raw[["ST_CEN_CD"]] == "99" | raw[["DT_CEN_CD"]] == "99" | raw[["DISTRICT"]] == "Data Not Available"), ]
  } else {
    stop("unsupported boundary year: ", year, call. = FALSE)
  }

  boundaries <- boundaries[order(boundaries[["area_code"]]), ]
  boundaries <- st_make_valid(boundaries)
  projected <- st_transform(boundaries, 8857)
  projected <- st_make_valid(projected)
  area_table <- st_drop_geometry(boundaries)
  area_table[["land_area_sq_km"]] <- as.numeric(st_area(projected)) / 1e6
  area_table <- area_table[, c("area_code", "area_name", "land_area_sq_km")]

  tolerances <- c(250, 500, 750, 1000, 1500, 2000, 3000, 5000, 8000, 12000, 20000, 30000, 50000)
  chosen_tolerance <- tail(tolerances, 1)
  chosen_bytes <- NA_integer_
  for (tolerance in tolerances) {
    candidate <- st_simplify(projected[, c("area_code", "area_name")], dTolerance = tolerance, preserveTopology = TRUE)
    candidate <- st_make_valid(st_transform(candidate, 4326))
    st_write(candidate, output_path, quiet = TRUE, delete_dsn = TRUE)
    chosen_bytes <- file_bytes(output_path)
    chosen_tolerance <- tolerance
    if (chosen_bytes <= 3000000L) break
  }
  if (chosen_bytes > 3000000L) {
    stop("boundary output remains larger than 3 MB after maximum simplification: ", output_path, call. = FALSE)
  }

  list(
    area_table = area_table,
    source_feature_count = nrow(raw),
    removed_feature_count = nrow(removed),
    removed_features = if (nrow(removed)) as.list(st_drop_geometry(removed)[["DISTRICT"]]) else list(),
    output_feature_count = row_count_file(output_path),
    simplification_tolerance_m = chosen_tolerance,
    output_bytes = chosen_bytes
  )
}

# build and write one year-specific district area-summary product.
write_area_summary_product <- function(year, count_rows, boundary_info, boundary_set_id, boundary_dataset_id, census_dataset_id, json_out, csv_out) {
  area_table <- boundary_info[["area_table"]]
  coverage <- join_coverage(area_table[["area_code"]], count_rows, year)
  if (length(coverage[["missing_area_codes"]]) || length(coverage[["extra_source_area_codes"]])) {
    stop("join coverage failed for ", year, call. = FALSE)
  }
  area_rows <- split(area_table, seq_len(nrow(area_table)))
  rows <- unname(lapply(area_rows, function(area) {
    count_row <- count_rows[count_rows[["area_code"]] == area[["area_code"]][1], ]
    if (nrow(count_row) != 1L) stop("expected one count row for ", area[["area_code"]][1], call. = FALSE)
    build_area_row(area, count_row, year, boundary_set_id, boundary_dataset_id, census_dataset_id, paste0("district_", year))
  }))
  write_json(
    area_summary_document(rows, year, boundary_set_id, boundary_dataset_id, paste0("district_", year)),
    json_out,
    auto_unbox = TRUE,
    pretty = TRUE,
    null = "null",
    na = "null",
    digits = NA
  )
  write.csv(flatten_rows(rows), csv_out, row.names = FALSE, na = "")
  list(rows = rows, coverage = coverage)
}

# check whether area-summary rows can legally carry null no-religion values.
check_no_religion_schema_route <- function() {
  schema <- fromJSON("schemas/area-summary.schema.json", simplifyVector = FALSE)
  props <- schema[["$defs"]][["AreaSummaryRow"]][["properties"]]
  allows_null <- function(field) {
    types <- props[[field]][["type"]]
    "null" %in% unlist(types, use.names = FALSE)
  }
  result <- allows_null("no_religion_count") && allows_null("no_religion_percent")
  if (!result) {
    stop("area-summary schema does not allow null no-religion values; India no-religion route must be redesigned", call. = FALSE)
  }
  "schema_allows_null_no_religion_fields_indicator_retained_visual_layer_omitted"
}

require_file(census_api_2011_path)
require_file(census_api_2001_path)
require_file(district_2011_shp)
require_file(district_2001_shp)
require_file(datameet_readme_path)
require_file(datameet_districts_readme_path)
require_file(datameet_license_path)

no_religion_schema_route <- check_no_religion_schema_route()

counts_2011 <- read_c01_wave(2011L, census_api_2011_path, "censusindia_2011")
counts_2001 <- read_c01_wave(2001L, census_api_2001_path, "censusindia_2001")
counts_2011 <- counts_2011[order(counts_2011[["area_code"]]), ]
counts_2001 <- counts_2001[order(counts_2001[["area_code"]]), ]
validation_2011 <- validate_census_totals(counts_2011, read_validation_rows(2011L, census_api_2011_path, "censusindia_2011"), 2011L)
validation_2001 <- validate_census_totals(counts_2001, read_validation_rows(2001L, census_api_2001_path, "censusindia_2001"), 2001L)

boundary_2011_info <- write_boundary_product(district_2011_shp, 2011L, boundary_2011_out)
boundary_2001_info <- write_boundary_product(district_2001_shp, 2001L, boundary_2001_out)

product_2011 <- write_area_summary_product(
  2011L,
  counts_2011,
  boundary_2011_info,
  boundary_set_2011,
  boundary_2011_dataset_id,
  census_2011_dataset_id,
  summary_2011_json_out,
  summary_2011_csv_out
)
product_2001 <- write_area_summary_product(
  2001L,
  counts_2001,
  boundary_2001_info,
  boundary_set_2001,
  boundary_2001_dataset_id,
  census_2001_dataset_id,
  summary_2001_json_out,
  summary_2001_csv_out
)

if (!validate_json_file(summary_2011_json_out)) stop("invalid summary JSON: ", summary_2011_json_out, call. = FALSE)
if (!validate_json_file(summary_2001_json_out)) stop("invalid summary JSON: ", summary_2001_json_out, call. = FALSE)

combined_version_hash <- substr(sha256_file(summary_2011_json_out), 1, 6)
combined_version_hash <- paste0(combined_version_hash, substr(sha256_file(summary_2001_json_out), 1, 6))

validation_checks <- c(
  "Area-summary schema allows null no_religion_count and no_religion_percent, so rows carry null values and no_religion_category_absent; the no-religion indicator documents the absence and no no-religion visual layer is exposed.",
  sprintf("2011 C-01 district rows reconcile exactly to %d state rows and the all-India row for total population, seven affiliation categories, Religion not stated, and religious_affiliation_count.", length(validation_2011[["state_validation"]])),
  sprintf("2001 C-01 district rows reconcile exactly to %d state rows and the all-India row for total population, seven affiliation categories, Religion not stated, and religious_affiliation_count.", length(validation_2001[["state_validation"]])),
  sprintf("2011 boundary source has %d features; %d Data Not Available feature removed; output has %d features and %d bytes after %d m simplification.", boundary_2011_info[["source_feature_count"]], boundary_2011_info[["removed_feature_count"]], boundary_2011_info[["output_feature_count"]], boundary_2011_info[["output_bytes"]], boundary_2011_info[["simplification_tolerance_m"]]),
  sprintf("2001 boundary source has %d features; %d Data Not Available feature removed; output has %d features and %d bytes after %d m simplification.", boundary_2001_info[["source_feature_count"]], boundary_2001_info[["removed_feature_count"]], boundary_2001_info[["output_feature_count"]], boundary_2001_info[["output_bytes"]], boundary_2001_info[["simplification_tolerance_m"]]),
  "1991 C-9 Religion is pinned and downloaded, but not published because this build does not include a clean 1991 district boundary or a state-split harmonisation for Uttaranchal/Uttarakhand, Jharkhand, and Chhattisgarh."
)

docs_manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = paste0("manifest:in-census-religion:in:2001-2011:", combined_version_hash),
  dataset_id = "in-census-religion:in:2001-2011:censusindia-c01",
  dataset_version_id = paste0("in-census-religion:in:2001-2011:censusindia-c01:", combined_version_hash),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "in-census-religion",
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
      waves = c("2001", "2011"),
      boundary_sets = c(boundary_set_2001, boundary_set_2011),
      boundary_simplification_tolerance_m = list(
        district_2001 = boundary_2001_info[["simplification_tolerance_m"]],
        district_2011 = boundary_2011_info[["simplification_tolerance_m"]]
      ),
      denominator = "C-01 Total persons; religious_affiliation_count is Hindu + Muslim + Christian + Sikh + Buddhist + Jain + Other religions and persuasions; Religion not stated is excluded from the numerator and is not treated as no religion",
      omitted_metrics = c("no_religion_percent visual layer", "religious_change", "places_per_10000_residents", "place_density_per_sq_km")
    ),
    software_versions = list(
      r = paste(R.version[["major"]], R.version[["minor"]], sep = "."),
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")),
      readxl = as.character(packageVersion("readxl")),
      dplyr = as.character(packageVersion("dplyr"))
    )
  ),
  source = list(
    provider = "Office of the Registrar General and Census Commissioner, India; DataMeet India community",
    source_dataset_ids = c(census_2001_dataset_id, census_2011_dataset_id, boundary_2001_dataset_id, boundary_2011_dataset_id),
    source_urls = c(census_api_2001_url, census_api_2011_url, census_tables_url, godl_url, datameet_2001_url, datameet_2011_url, datameet_districts_url, geoboundaries_adm2_api_url),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = paste(census_licence_text, datameet_licence_text),
    citation = "Census of India 2001 and 2011, C-01: Population by religious community; DataMeet India community, district boundaries for Census 2001 and Census 2011.",
    raw_redistribution = "Raw Census India XLS workbooks, API responses, DataMeet shapefiles, and deferred source files are not committed. They remain in data/raw/in_census/ and await any project-controlled raw archive upload."
  ),
  input_manifests = list(),
  raw_sources = c(
    list(
      raw_file_record(census_api_2001_path, "Cached Census India API response listing 2001 C-01 XLS workbook URLs.", census_2001_dataset_id, census_api_2001_url),
      raw_file_record(census_api_2011_path, "Cached Census India API response listing 2011 C-01 XLS workbook URLs.", census_2011_dataset_id, census_api_2011_url)
    ),
    census_raw_records(2001L, census_api_2001_path, "censusindia_2001", census_2001_dataset_id),
    census_raw_records(2011L, census_api_2011_path, "censusindia_2011", census_2011_dataset_id),
    boundary_raw_records(),
    deferred_raw_records()
  ),
  durable_files = list(
    manifest_file_record(summary_2001_json_out, "India 2001 district area summary with Census of India C-01 religious-affiliation metrics.", "censusindia_godl_india_attribution_basis"),
    manifest_file_record(summary_2001_csv_out, "Flattened India 2001 district area summary with Census of India C-01 religious-affiliation metrics.", "censusindia_godl_india_attribution_basis"),
    manifest_file_record(boundary_2001_out, "Simplified India Census 2001 district boundary GeoJSON derived from DataMeet.", "cc_by_2_5_in_with_attribution"),
    manifest_file_record(summary_2011_json_out, "India 2011 district area summary with Census of India C-01 religious-affiliation metrics.", "censusindia_godl_india_attribution_basis"),
    manifest_file_record(summary_2011_csv_out, "Flattened India 2011 district area summary with Census of India C-01 religious-affiliation metrics.", "censusindia_godl_india_attribution_basis"),
    manifest_file_record(boundary_2011_out, "Simplified India Census 2011 district boundary GeoJSON derived from DataMeet.", "cc_by_2_5_in_with_attribution")
  ),
  derived_outputs = list(
    list(
      uri = paste0("repo:", summary_2001_json_out),
      sha256 = sha256_file(summary_2001_json_out),
      built_by = script_id,
      notes = sprintf("%d Census 2001 districts; denominator is C-01 Total persons.", length(product_2001[["rows"]]))
    ),
    list(
      uri = paste0("repo:", boundary_2001_out),
      sha256 = sha256_file(boundary_2001_out),
      built_by = script_id,
      notes = sprintf("DataMeet Census 2001 district layer simplified at %d m tolerance after removing one Data Not Available feature.", boundary_2001_info[["simplification_tolerance_m"]])
    ),
    list(
      uri = paste0("repo:", summary_2011_json_out),
      sha256 = sha256_file(summary_2011_json_out),
      built_by = script_id,
      notes = sprintf("%d Census 2011 districts; denominator is C-01 Total persons.", length(product_2011[["rows"]]))
    ),
    list(
      uri = paste0("repo:", boundary_2011_out),
      sha256 = sha256_file(boundary_2011_out),
      built_by = script_id,
      notes = sprintf("DataMeet Census 2011 district layer simplified at %d m tolerance after removing one Data Not Available feature.", boundary_2011_info[["simplification_tolerance_m"]])
    )
  ),
  validation = list(
    checks = validation_checks,
    no_religion_schema_route = no_religion_schema_route,
    join_coverage = list(
      district_2001 = product_2001[["coverage"]],
      district_2011 = product_2011[["coverage"]]
    ),
    state_validation = list(
      district_2001 = validation_2001[["state_validation"]],
      district_2011 = validation_2011[["state_validation"]]
    ),
    national_validation = list(
      district_2001 = validation_2001[["national_validation"]],
      district_2011 = validation_2011[["national_validation"]]
    ),
    boundary_validation = list(
      district_2001 = list(
        source_feature_count = boundary_2001_info[["source_feature_count"]],
        removed_feature_count = boundary_2001_info[["removed_feature_count"]],
        removed_features = boundary_2001_info[["removed_features"]],
        output_feature_count = boundary_2001_info[["output_feature_count"]],
        output_bytes = boundary_2001_info[["output_bytes"]],
        simplification_tolerance_m = boundary_2001_info[["simplification_tolerance_m"]]
      ),
      district_2011 = list(
        source_feature_count = boundary_2011_info[["source_feature_count"]],
        removed_feature_count = boundary_2011_info[["removed_feature_count"]],
        removed_features = boundary_2011_info[["removed_features"]],
        output_feature_count = boundary_2011_info[["output_feature_count"]],
        output_bytes = boundary_2011_info[["output_bytes"]],
        simplification_tolerance_m = boundary_2011_info[["simplification_tolerance_m"]]
      )
    )
  ),
  deferred_sources = list(
    list(
      source_dataset_id = census_1991_dataset_id,
      url = census_1991_url,
      local_path = census_1991_path,
      notes = "Official Census of India 1991 C-9 Religion workbook is pinned and cached. Publication is deferred because Jammu and Kashmir was not enumerated in 1991 and this build does not include a clean 1991 district boundary or state-split harmonisation for states created in 2000."
    ),
    list(
      source_dataset_id = "geoboundaries-ind-adm2-2021",
      url = geoboundaries_adm2_api_url,
      local_path = file.path(raw_dir, "geoboundaries_ind_adm2_2021_simplified.geojson"),
      notes = "geoBoundaries IND ADM2 was pinned as a current-boundary fallback: boundaryYearRepresented 2021, 735 simplified features locally, ODbL 1.0, source Pathways Data Pvt. Ltd. / lgdirectory.gov.in. It is not used because DataMeet period district boundaries match the 2001 and 2011 Census C-01 district codes."
    )
  ),
  construct_notes = list(
    "Census of India C-01 does not include a no-religion category. Religion not stated is a non-response category, not no religion.",
    "religious_affiliation_count is Hindu + Muslim + Christian + Sikh + Buddhist + Jain + Other religions and persuasions, which equals Total persons minus Religion not stated.",
    "religious_affiliation_percent is religious_affiliation_count divided by C-01 Total persons. This makes variation in Religion not stated visible without misclassifying it as no religion.",
    "no_religion_count and no_religion_percent are null for every row and every row carries no_religion_category_absent.",
    "The public page exposes religious_affiliation_percent only. It does not expose no_religion_percent or religious_change.",
    "2001 and 2011 use their own period district boundary sets rather than a crosswalk."
  ),
  privacy = "public",
  licence_status = "censusindia_godl_india_attribution_basis_and_datameet_cc_by_2_5_in",
  downstream_status = "public",
  source_datasets = c(source_datasets_for_year(2001L), source_datasets_for_year(2011L)),
  notes = "The committed products contain derived area summaries and simplified district boundaries only. On-page attribution must cite Census of India, GODL-India attribution basis, DataMeet, and the DataMeet district boundary licence."
)

write_json(docs_manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!validate_json_file(manifest_out)) stop("invalid manifest JSON: ", manifest_out, call. = FALSE)

cat(sprintf("wrote %s: %d rows\n", summary_2001_json_out, length(product_2001[["rows"]])))
cat(sprintf("wrote %s: %d rows\n", summary_2011_json_out, length(product_2011[["rows"]])))
cat(sprintf("wrote %s: %d features, %d bytes\n", boundary_2001_out, row_count_file(boundary_2001_out), file_bytes(boundary_2001_out)))
cat(sprintf("wrote %s: %d features, %d bytes\n", boundary_2011_out, row_count_file(boundary_2011_out), file_bytes(boundary_2011_out)))
cat(sprintf("wrote %s\n", manifest_out))
cat("done\n")
