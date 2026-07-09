# build the netherlands province survey products from cbs statline.
# inputs: cbs odata table 83288ned, national comparison table 82904ned,
# and current pdok province boundaries.
# outputs: separate affiliation and attendance area-summary json/csv files,
# one shared province geojson, and one provenance manifest.
# run from the repo root: Rscript scripts/build_nl_area_summary.R

suppressMessages({
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

raw_dir <- "data/raw/nl_religion"
nl_dir <- "apps/regions/nl/data"
manifest_dir <- "docs/manifests"
dir.create(raw_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(nl_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- "2026-07-10"
script_id <- "scripts/build_nl_area_summary.R"
country_code <- "NL"

cbs_regional_base <- "https://opendata.cbs.nl/ODataApi/OData/83288NED"
cbs_national_base <- "https://opendata.cbs.nl/ODataApi/OData/82904NED"
cbs_portal_url <- paste0(
  "https://opendata.cbs.nl/portal.html?_catalog=CBS&_la=nl&tableId=83288NED"
)
pdok_items_url <- paste0(
  "https://api.pdok.nl/kadaster/brk-bestuurlijke-gebieden/ogc/v1/",
  "collections/provinciegebied/items?f=json&limit=100"
)
pdok_landing_url <- "https://api.pdok.nl/kadaster/brk-bestuurlijke-gebieden/ogc/v1?f=json"
cc_by_url <- "https://creativecommons.org/licenses/by/4.0/"

regional_dataset_id <- "cbs-statline-83288ned-religious-involvement-province-2010-2015"
national_dataset_id <- "cbs-statline-82904ned-religious-involvement-national-2010-2025"
boundary_dataset_id <- "pdok-brk-bestuurlijke-gebieden-province-current-2026"
boundary_set_id <- "nl-province-2026-pdok-brk"
boundary_level <- "province"

regional_endpoints <- c("TableInfos", "DataProperties", "RegioS", "Perioden", "TypedDataSet")
national_endpoints <- c("TableInfos", "Persoonskenmerken", "KerkelijkeGezindte", "Perioden", "TypedDataSet")
regional_paths <- setNames(
  file.path(raw_dir, paste0("cbs_83288ned_", tolower(regional_endpoints), ".json")),
  regional_endpoints
)
national_paths <- setNames(
  file.path(raw_dir, paste0("cbs_82904ned_", tolower(national_endpoints), ".json")),
  national_endpoints
)
pdok_raw_path <- file.path(raw_dir, "pdok_provinciegebied_current.geojson")
pdok_landing_path <- file.path(raw_dir, "pdok_bestuurlijke_gebieden_landing.json")
cbs_portal_path <- file.path(raw_dir, "cbs_open_data_portal_83288ned.html")

boundary_out <- file.path(nl_dir, "nl_province_2026.geojson")
affiliation_json_out <- file.path(nl_dir, "area_summary_affiliation_province.json")
affiliation_csv_out <- file.path(nl_dir, "area_summary_affiliation_province.csv")
attendance_json_out <- file.path(nl_dir, "area_summary_attendance_province.json")
attendance_csv_out <- file.path(nl_dir, "area_summary_attendance_province.csv")
manifest_out <- file.path(manifest_dir, "nl-survey-religion-2010-2015.json")

years <- 2010L:2015L
spot_years <- c(2010L, 2012L, 2015L)
province_codes <- sprintf("%02d", 20:31)

population_basis_note <- paste(
  "CBS Labour Force Survey estimate for the total population aged 15+;",
  "the source publishes rounded whole percentages and no population count",
  "or machine-readable uncertainty interval in table 83288NED."
)
affiliation_quality_flag <- paste(
  "sample_survey_estimate",
  "self_reported_religious_affiliation",
  "population_aged_15_plus",
  "rounded_whole_percent",
  "confidence_interval_not_published",
  "final_source_value",
  sep = ";"
)
attendance_quality_flag <- paste(
  "sample_survey_estimate",
  "self_reported_religious_service_attendance",
  "total_population_aged_15_plus_denominator",
  "rounded_whole_percent",
  "confidence_interval_not_published",
  "final_source_value",
  sep = ";"
)

# compute the sha-256 digest for a local file.
sha256_file <- function(path) {
  unname(tools::sha256sum(path))
}

# return a file size in bytes for validation and manifest records.
file_bytes <- function(path) {
  as.integer(unname(file.info(path)[["size"]]))
}

# write retrieval metadata beside a cached network response.
write_meta <- function(path, url) {
  write_json(
    list(retrieved_at = stamp, url = url, method = "GET", http_status = 200),
    paste0(path, ".meta.json"),
    auto_unbox = TRUE,
    pretty = TRUE
  )
}

# download a source only when the gitignored cache does not contain it.
fetch_if_missing <- function(url, path) {
  if (file.exists(path) && file_bytes(path) > 0L) {
    if (!file.exists(paste0(path, ".meta.json"))) write_meta(path, url)
    return(FALSE)
  }
  tmp <- tempfile(tmpdir = dirname(path))
  on.exit(unlink(tmp), add = TRUE)
  status <- system2(
    "curl",
    c("--retry", "3", "--connect-timeout", "15", "--max-time", "120",
      "-fL", "-sS", shQuote(url), "-o", shQuote(tmp))
  )
  if (status != 0L || !file.exists(tmp) || file_bytes(tmp) == 0L) {
    stop("source download failed: ", url, call. = FALSE)
  }
  if (!file.rename(tmp, path)) stop("could not cache source: ", path, call. = FALSE)
  write_meta(path, url)
  TRUE
}

# ensure every source required by the build is present in the local cache.
ensure_sources <- function() {
  for (endpoint in regional_endpoints) {
    fetch_if_missing(paste0(cbs_regional_base, "/", endpoint), regional_paths[[endpoint]])
  }
  for (endpoint in national_endpoints) {
    fetch_if_missing(paste0(cbs_national_base, "/", endpoint), national_paths[[endpoint]])
  }
  fetch_if_missing(pdok_items_url, pdok_raw_path)
  fetch_if_missing(pdok_landing_url, pdok_landing_path)
  fetch_if_missing(cbs_portal_url, cbs_portal_path)
  invisible(TRUE)
}

# return the value array from one cached cbs odata response.
read_odata_values <- function(path, simplify = TRUE) {
  obj <- fromJSON(path, simplifyVector = simplify)
  if (is.null(obj[["value"]])) stop("OData response has no value array: ", path, call. = FALSE)
  obj[["value"]]
}

# parse a four-digit year from a cbs annual period key.
parse_year <- function(values) {
  as.integer(substr(as.character(values), 1L, 4L))
}

# strip cbs geography suffixes while retaining the displayed province name.
clean_province_name <- function(values) {
  trimws(sub("\\s*\\(PV\\)$", "", as.character(values)))
}

# load and validate the 12-province annual cbs source table.
build_regional_source <- function() {
  table_info <- read_odata_values(regional_paths[["TableInfos"]], simplify = FALSE)[[1]]
  if (!identical(table_info[["Identifier"]], "83288NED")) {
    stop("unexpected CBS regional table identifier", call. = FALSE)
  }
  if (!grepl("2010-2015", table_info[["Period"]], fixed = TRUE)) {
    stop("CBS regional table period changed", call. = FALSE)
  }

  properties <- read_odata_values(regional_paths[["DataProperties"]])
  property_keys <- properties[["Key"]][properties[["Type"]] == "Topic"]
  required_topics <- c(
    "GeenKerkelijkeGezindte_1", "TotaalKerkelijkeGezindte_2",
    "EenKeerPerWeekOfVaker_9", "TweeTotDrieKeerPerMaand_10",
    "EenKeerPerMaand_11", "MinderDanEenKeerPerMaand_12", "ZeldenOfNooit_13"
  )
  if (!all(required_topics %in% property_keys)) {
    stop("CBS regional table is missing one or more required topics", call. = FALSE)
  }

  regions <- read_odata_values(regional_paths[["RegioS"]])
  regions[["key_trimmed"]] <- trimws(regions[["Key"]])
  regions[["area_code"]] <- sub("^PV", "", regions[["key_trimmed"]])
  regions[["area_name"]] <- clean_province_name(regions[["Title"]])
  provinces <- regions[grepl("^PV", regions[["key_trimmed"]]), ]
  if (nrow(provinces) != 12L || !setequal(provinces[["area_code"]], province_codes)) {
    stop("CBS regional metadata does not contain the expected 12 provinces", call. = FALSE)
  }

  periods <- read_odata_values(regional_paths[["Perioden"]])
  if (!identical(sort(parse_year(periods[["Key"]])), years)) {
    stop("CBS regional period coverage is not exactly 2010-2015", call. = FALSE)
  }
  if (!all(periods[["Status"]] == "Definitief")) {
    stop("CBS regional table contains a non-final period", call. = FALSE)
  }

  data <- read_odata_values(regional_paths[["TypedDataSet"]])
  data[["region_key"]] <- trimws(data[["RegioS"]])
  data[["year"]] <- parse_year(data[["Perioden"]])
  data[["area_code"]] <- sub("^PV", "", data[["region_key"]])
  data <- merge(
    data,
    provinces[, c("key_trimmed", "area_name")],
    by.x = "region_key",
    by.y = "key_trimmed",
    all.x = TRUE
  )
  province_data <- data[grepl("^PV", data[["region_key"]]), ]
  expected_keys <- expand.grid(area_code = province_codes, year = years, stringsAsFactors = FALSE)
  observed_keys <- province_data[, c("area_code", "year")]
  if (nrow(province_data) != 72L || nrow(merge(expected_keys, observed_keys)) != 72L) {
    stop("CBS province-year coverage is incomplete", call. = FALSE)
  }
  if (anyDuplicated(observed_keys)) stop("duplicate CBS province-year row", call. = FALSE)
  if (anyNA(province_data[, required_topics])) {
    stop("CBS province table has missing required values", call. = FALSE)
  }
  for (topic in required_topics) {
    if (any(province_data[[topic]] < 0 | province_data[[topic]] > 100)) {
      stop("CBS percentage outside [0, 100]: ", topic, call. = FALSE)
    }
  }
  province_data[order(province_data[["year"]], province_data[["area_code"]]), ]
}

# compare three national years in the regional and national cbs tables.
validate_national_spot_values <- function() {
  regional <- read_odata_values(regional_paths[["TypedDataSet"]])
  regional[["region_key"]] <- trimws(regional[["RegioS"]])
  regional[["year"]] <- parse_year(regional[["Perioden"]])
  regional <- regional[regional[["region_key"]] == "NL01" & regional[["year"]] %in% spot_years, ]

  person_categories <- read_odata_values(national_paths[["Persoonskenmerken"]])
  total_person_key <- person_categories[["Key"]][person_categories[["Title"]] == "Totaal personen"]
  religion_categories <- read_odata_values(national_paths[["KerkelijkeGezindte"]])
  category_key <- setNames(religion_categories[["Key"]], religion_categories[["Title"]])
  national <- read_odata_values(national_paths[["TypedDataSet"]])
  national[["year"]] <- parse_year(national[["Perioden"]])
  national <- national[
    national[["Persoonskenmerken"]] == total_person_key & national[["year"]] %in% spot_years,
  ]

  comparisons <- list(
    affiliation = c(regional = "TotaalKerkelijkeGezindte_2", national = category_key[["Kerkelijke gezindte totaal"]]),
    no_affiliation = c(regional = "GeenKerkelijkeGezindte_1", national = category_key[["Kerkelijke gezindte: geen"]]),
    weekly_attendance = c(regional = "EenKeerPerWeekOfVaker_9", national = category_key[["Kerkbezoek: één keer per week of vaker"]]),
    seldom_or_never_attendance = c(regional = "ZeldenOfNooit_13", national = category_key[["Kerkbezoek: zelden of nooit"]])
  )
  results <- list()
  for (metric in names(comparisons)) {
    mapping <- comparisons[[metric]]
    for (year in spot_years) {
      regional_value <- regional[regional[["year"]] == year, mapping[["regional"]]]
      national_value <- national[
        national[["year"]] == year & national[["KerkelijkeGezindte"]] == mapping[["national"]],
        "PersonenKerkelijkeGezindte_1"
      ]
      if (length(regional_value) != 1L || length(national_value) != 1L ||
          is.na(regional_value) || is.na(national_value) || regional_value != national_value) {
        stop("national spot comparison failed for ", metric, " in ", year, call. = FALSE)
      }
      results[[length(results) + 1L]] <- list(
        indicator = metric,
        year = year,
        regional_table_value = regional_value,
        national_table_value = national_value,
        difference = regional_value - national_value
      )
    }
  }
  results
}

# prepare and simplify the current pdok province boundary layer.
build_boundary <- function() {
  landing <- fromJSON(pdok_landing_path, simplifyVector = FALSE)
  licence_links <- Filter(function(link) identical(link[["rel"]], "license"), landing[["links"]])
  if (length(licence_links) == 0L || !grepl("CC BY 4.0", licence_links[[1]][["title"]], fixed = TRUE)) {
    stop("PDOK OGC API does not expose the expected CC BY 4.0 licence", call. = FALSE)
  }

  boundary <- st_read(pdok_raw_path, quiet = TRUE)
  required_fields <- c("code", "identificatie", "naam")
  if (!all(required_fields %in% names(boundary))) {
    stop("PDOK province boundary is missing required fields", call. = FALSE)
  }
  boundary[["area_code"]] <- sprintf("%02d", as.integer(boundary[["code"]]))
  if (nrow(boundary) != 12L || !setequal(boundary[["area_code"]], province_codes)) {
    stop("PDOK boundary does not contain the expected 12 provinces", call. = FALSE)
  }
  boundary <- st_transform(boundary, 4326)
  if (any(st_is_empty(boundary)) || any(!st_is_valid(boundary))) {
    stop("PDOK source boundary contains empty or invalid geometry", call. = FALSE)
  }
  boundary[["country_code"]] <- country_code
  boundary[["area_unit_id"]] <- paste0(boundary_set_id, ":", boundary[["area_code"]])
  boundary[["area_name"]] <- boundary[["naam"]]
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- boundary_level
  boundary <- boundary[, c(
    "country_code", "area_unit_id", "area_code", "area_name",
    "boundary_set_id", "boundary_level", "geometry"
  )]
  boundary <- boundary[order(boundary[["area_code"]]), ]

  # PDOK polygons contain a few zero-area remnants that mapshaper can emit as
  # a second line layer. Restrict cleaning and output to the polygon layer.
  keep_percentages <- c(20, 10, 5, 2, 1)
  attr(keep_percentages, "mapshaper_target") <- "1"
  simplification <- mapshaper_simplify_to_cap(
    boundary,
    boundary_out,
    max_bytes = 800000,
    keep_percentages = keep_percentages
  )
  written <- st_read(boundary_out, quiet = TRUE)
  if (nrow(written) != 12L || any(st_is_empty(written)) || any(!st_is_valid(written))) {
    stop("simplified PDOK boundary failed validation", call. = FALSE)
  }
  list(boundary = written, simplification = simplification)
}

# construct one legacy area-summary row with an explicitly labelled survey metric pair.
make_row <- function(source_row, boundary_row, primary_value, secondary_value, quality_flag) {
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = boundary_row[["area_unit_id"]],
    area_code = source_row[["area_code"]],
    area_name = boundary_row[["area_name"]],
    year = as.integer(source_row[["year"]]),
    population_total = NULL,
    population_total_basis = population_basis_note,
    religious_affiliation_count = NULL,
    religious_affiliation_percent = as.numeric(primary_value),
    no_religion_count = NULL,
    no_religion_percent = as.numeric(secondary_value),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = NULL,
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = c(regional_dataset_id, boundary_dataset_id),
    quality_flag = quality_flag
  )
}

# build all area-summary rows for affiliation and attendance as separate constructs.
build_rows <- function(source, boundary) {
  affiliation <- vector("list", nrow(source))
  attendance <- vector("list", nrow(source))
  for (i in seq_len(nrow(source))) {
    b <- boundary[boundary[["area_code"]] == source[["area_code"]][i], ]
    if (nrow(b) != 1L) stop("boundary join failed for province ", source[["area_code"]][i], call. = FALSE)
    affiliation[[i]] <- make_row(
      source[i, ], b,
      source[["TotaalKerkelijkeGezindte_2"]][i],
      source[["GeenKerkelijkeGezindte_1"]][i],
      affiliation_quality_flag
    )
    attendance[[i]] <- make_row(
      source[i, ], b,
      source[["EenKeerPerWeekOfVaker_9"]][i],
      source[["ZeldenOfNooit_13"]][i],
      attendance_quality_flag
    )
  }
  list(affiliation = affiliation, attendance = attendance)
}

# define the shared source metadata included in both product documents.
source_datasets <- function() {
  list(
    list(
      source_dataset_id = regional_dataset_id,
      name = "CBS StatLine 83288NED: Religieuze betrokkenheid; kerkelijke gezindte; regio; 2010-2015",
      provider = "Statistics Netherlands (CBS)",
      url = cbs_regional_base,
      retrieval_date = retrieval_date,
      licence = list(name = "Creative Commons Attribution 4.0 International", url = cbs_portal_url, attribution = "Statistics Netherlands (CBS)"),
      notes = paste(
        "Final annual Labour Force Survey percentages for people aged 15+.",
        "The table states that sample uncertainty exists but publishes no",
        "standard errors or confidence intervals. Values are rounded to whole percentages."
      )
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "PDOK Bestuurlijke Gebieden, current provinciegebied",
      provider = "Kadaster via PDOK",
      url = pdok_items_url,
      retrieval_date = retrieval_date,
      licence = list(name = "Creative Commons Attribution 4.0 International", url = cc_by_url, attribution = "Kadaster / PDOK"),
      notes = "Current 2026 province areas derived from the Basisregistratie Kadaster."
    )
  )
}

# create one area-summary document with construct-specific indicator labels.
product_document <- function(rows, construct) {
  is_affiliation <- identical(construct, "affiliation")
  primary_label <- if (is_affiliation) "Religious affiliation %" else "Weekly-or-more attendance %"
  secondary_label <- if (is_affiliation) "No religious affiliation %" else "Seldom-or-never attendance %"
  primary_description <- if (is_affiliation) {
    "Share of people aged 15+ who report belonging to a religious denomination or worldview group."
  } else {
    "Share of the total population aged 15+ who report attending a religious or worldview gathering once a week or more."
  }
  secondary_description <- if (is_affiliation) {
    "Share of people aged 15+ who report no religious denomination or worldview group."
  } else {
    "Share of the total population aged 15+ who report seldom or never attending a religious or worldview gathering."
  }
  list(
    schema_version = "0.2.0",
    generated_at = stamp,
    generated_by = script_id,
    country_code = country_code,
    construct = if (is_affiliation) "self-reported religious affiliation" else "self-reported religious-service attendance",
    boundary_set = list(
      boundary_set_id = boundary_set_id,
      country_code = country_code,
      level = boundary_level,
      vintage = "2026",
      source_dataset_id = boundary_dataset_id
    ),
    site_snapshot = list(
      source_dataset_id = NULL,
      snapshot_date = NULL,
      basis = "no governed Netherlands place-of-worship snapshot is included in this survey release",
      notes = "The products expose survey estimates only."
    ),
    source_datasets = source_datasets(),
    indicators = list(
      list(
        indicator_id = "religious_affiliation_percent",
        label = primary_label,
        description = primary_description,
        unit = "percent",
        method = if (is_affiliation) "CBS 83288NED TotaalKerkelijkeGezindte_2" else "CBS 83288NED EenKeerPerWeekOfVaker_9",
        temporal_coverage = "2010-2015 annual",
        spatial_coverage = "12 Netherlands provinces",
        quality_notes = population_basis_note
      ),
      list(
        indicator_id = "no_religion_percent",
        label = secondary_label,
        description = secondary_description,
        unit = "percent",
        method = if (is_affiliation) "CBS 83288NED GeenKerkelijkeGezindte_1" else "CBS 83288NED ZeldenOfNooit_13",
        temporal_coverage = "2010-2015 annual",
        spatial_coverage = "12 Netherlands provinces",
        quality_notes = population_basis_note
      )
    ),
    visual_layers = list(
      list(
        visual_layer_id = paste0("nl-province-", construct, "-primary"),
        label = primary_label,
        layer_type = "choropleth",
        indicator_ids = list("religious_affiliation_percent"),
        geometry_unit_type = "area_unit",
        legend = list(unit = "percent", denominator = "total population aged 15+"),
        colour_scale = "sequential",
        time_control = "year_selector",
        aggregation_rule = "published annual province survey estimate",
        uncertainty_display = "quality_flag",
        default_visibility = TRUE,
        notes = if (is_affiliation) "Affiliation construct only." else "Attendance construct only; the legacy field name does not change the construct."
      ),
      list(
        visual_layer_id = paste0("nl-province-", construct, "-secondary"),
        label = secondary_label,
        layer_type = "choropleth",
        indicator_ids = list("no_religion_percent"),
        geometry_unit_type = "area_unit",
        legend = list(unit = "percent", denominator = "total population aged 15+"),
        colour_scale = "sequential",
        time_control = "year_selector",
        aggregation_rule = "published annual province survey estimate",
        uncertainty_display = "quality_flag",
        default_visibility = FALSE,
        notes = if (is_affiliation) "No-affiliation construct only." else "Attendance construct only; the legacy field name does not change the construct."
      )
    ),
    rows = rows
  )
}

# flatten area-summary rows into the repository's legacy csv columns.
rows_to_data_frame <- function(rows) {
  fields <- c(
    "country_code", "boundary_set_id", "boundary_level", "area_unit_id",
    "area_code", "area_name", "year", "population_total", "population_total_basis",
    "religious_affiliation_count", "religious_affiliation_percent", "no_religion_count",
    "no_religion_percent", "place_count", "places_per_10000_residents",
    "place_density_per_sq_km", "land_area_sq_km", "site_snapshot_date",
    "place_count_basis", "source_dataset_ids", "quality_flag"
  )
  out <- data.frame(matrix(nrow = length(rows), ncol = length(fields)), stringsAsFactors = FALSE)
  names(out) <- fields
  for (i in seq_along(rows)) {
    for (field in fields) {
      value <- rows[[i]][[field]]
      if (identical(field, "source_dataset_ids")) value <- paste(value, collapse = "|")
      if (is.null(value)) value <- NA
      out[i, field] <- value
    }
  }
  out
}

# write one json and csv product pair.
write_product <- function(document, json_path, csv_path) {
  write_json(document, json_path, auto_unbox = TRUE, pretty = TRUE, null = "null", digits = NA)
  write.csv(rows_to_data_frame(document[["rows"]]), csv_path, row.names = FALSE, na = "")
}

# return a manifest file record for one committed product.
durable_record <- function(path, row_count, content) {
  list(
    uri = paste0("repo:", path),
    storage_provider = "other",
    format = sub("^.*\\.", "", path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    row_count = row_count,
    content = content,
    privacy = "public",
    licence_status = "accepted"
  )
}

# return a provenance record for one cached raw response.
raw_record <- function(path, url, dataset_id, used = TRUE) {
  meta <- fromJSON(paste0(path, ".meta.json"), simplifyVector = TRUE)
  list(
    uri = path,
    url = url,
    format = sub("^.*\\.", "", path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    source_dataset_id = dataset_id,
    used_in_public_product = used,
    retrieved_at = meta[["retrieved_at"]],
    http_status = meta[["http_status"]]
  )
}

# write a detailed product manifest that also validates against data-manifest.v1.
write_manifest <- function(simplification, spot_values) {
  git_commit <- trimws(system2("git", c("rev-parse", "--short=12", "HEAD"), stdout = TRUE))
  if (length(git_commit) != 1L || !grepl("^[a-f0-9]{12}$", git_commit)) {
    stop("could not identify the build-base git commit", call. = FALSE)
  }
  regional_raw <- lapply(regional_endpoints, function(endpoint) {
    raw_record(regional_paths[[endpoint]], paste0(cbs_regional_base, "/", endpoint), regional_dataset_id)
  })
  national_raw <- lapply(national_endpoints, function(endpoint) {
    raw_record(national_paths[[endpoint]], paste0(cbs_national_base, "/", endpoint), national_dataset_id, used = FALSE)
  })
  raw_sources <- c(
    regional_raw,
    national_raw,
    list(
      raw_record(pdok_raw_path, pdok_items_url, boundary_dataset_id),
      raw_record(pdok_landing_path, pdok_landing_url, boundary_dataset_id),
      raw_record(cbs_portal_path, cbs_portal_url, regional_dataset_id, used = FALSE)
    )
  )
  durable_files <- list(
    durable_record(affiliation_json_out, 72L, "Province affiliation survey area summary, 2010-2015."),
    durable_record(affiliation_csv_out, 72L, "Flattened province affiliation survey area summary."),
    durable_record(attendance_json_out, 72L, "Province attendance survey area summary, 2010-2015."),
    durable_record(attendance_csv_out, 72L, "Flattened province attendance survey area summary."),
    durable_record(boundary_out, 12L, "Simplified current PDOK province boundary GeoJSON.")
  )
  version_hash <- substr(sha256_file(affiliation_json_out), 1L, 12L)
  manifest <- list(
    `$schema` = "../../schemas/data-manifest.schema.json",
    schema_version = "data-manifest.v1",
    manifest_id = "manifest:nl-survey-religion:nl:2010-2015:cbs-province",
    dataset_id = "nl-survey-religion:nl:2010-2015:cbs-province",
    dataset_version_id = paste0("nl-survey-religion:nl:2010-2015:cbs-province:", version_hash),
    manifest_sha256 = NULL,
    supersedes_manifest_id = NULL,
    superseded_by_manifest_id = NULL,
    dataset_family = "nl-survey-religion",
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
      command = "Rscript scripts/build_nl_area_summary.R",
      parameters = list(
        regional_table = "83288NED",
        national_comparison_table = "82904NED",
        province_years = as.list(years),
        affiliation_product = "separate",
        attendance_product = "separate",
        uncertainty = "confidence intervals and standard errors are not published in 83288NED",
        boundary_set = boundary_set_id,
        boundary_simplification = simplification
      ),
      software_versions = list(
        r = paste(R.version$major, R.version$minor, sep = "."),
        sf = as.character(packageVersion("sf")),
        jsonlite = as.character(packageVersion("jsonlite")),
        mapshaper = "npx --yes mapshaper"
      )
    ),
    source = list(
      provider = "Statistics Netherlands (CBS) and Kadaster / PDOK",
      source_dataset_ids = list(regional_dataset_id, national_dataset_id, boundary_dataset_id),
      source_urls = list(cbs_regional_base, cbs_national_base, pdok_items_url, pdok_landing_url, cbs_portal_url, cc_by_url),
      retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
      licence = paste(
        "CBS StatLine 83288NED and 82904NED are CC BY 4.0 with CBS attribution;",
        "PDOK Bestuurlijke Gebieden is CC BY 4.0 with Kadaster / PDOK attribution."
      ),
      citation = paste(
        "Statistics Netherlands (CBS), StatLine 83288NED and 82904NED;",
        "Kadaster via PDOK, Bestuurlijke Gebieden, provinciegebied."
      )
    ),
    input_manifests = list(),
    durable_files = durable_files,
    stats = list(
      province_count = 12L,
      year_count = 6L,
      affiliation_row_count = 72L,
      attendance_row_count = 72L,
      boundary_bytes = file_bytes(boundary_out)
    ),
    local_cache_hint = raw_dir,
    validation = list(
      status = "passed_with_warnings",
      commands = list(
        "Rscript scripts/build_nl_area_summary.R",
        "uv run python -m jsonschema -i docs/manifests/nl-survey-religion-2010-2015.json schemas/data-manifest.schema.json"
      ),
      warnings = list(
        "CBS 83288NED states that sampling uncertainty exists but does not publish standard errors or confidence intervals.",
        "The annual estimates are rounded to whole percentages.",
        "Current 2026 province boundaries display annual estimates from 2010-2015; province codes remain stable, but small boundary corrections are not represented historically."
      ),
      notes = paste(
        "Every year has 12/12 province rows for both constructs. Four national",
        "metrics match table 82904NED exactly in 2010, 2012, and 2015.",
        "The 12 simplified boundary features are valid and non-empty."
      )
    ),
    privacy = "public",
    licence_status = "accepted",
    downstream_status = "public",
    notes = paste0(
      "raw_sources=", toJSON(raw_sources, auto_unbox = TRUE, null = "null"),
      "; national_spot_values=", toJSON(spot_values, auto_unbox = TRUE, null = "null")
    )
  )
  write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", digits = NA)
}

ensure_sources()
message("sources ready")
regional_source <- build_regional_source()
message("regional source validated")
spot_values <- validate_national_spot_values()
message("national spot values validated")
boundary_result <- build_boundary()
message("boundary built")
rows <- build_rows(regional_source, boundary_result[["boundary"]])
message("product rows built")
write_product(
  product_document(rows[["affiliation"]], "affiliation"),
  affiliation_json_out,
  affiliation_csv_out
)
message("affiliation product written")
write_product(
  product_document(rows[["attendance"]], "attendance"),
  attendance_json_out,
  attendance_csv_out
)
message("attendance product written")
write_manifest(boundary_result[["simplification"]], spot_values)
message("manifest written")

message("built Netherlands affiliation rows: ", length(rows[["affiliation"]]))
message("built Netherlands attendance rows: ", length(rows[["attendance"]]))
message("built Netherlands province features: ", nrow(boundary_result[["boundary"]]))
message("boundary bytes: ", file_bytes(boundary_out))
