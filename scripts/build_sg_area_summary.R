# build singapore planning-area census religion products for 2010 and 2020.
# inputs: data.gov.sg CSV copies of SingStat CT 8628 and CT 17592, and
# URA Master Plan 2008 and Master Plan 2019 planning-area GeoJSON files.
# outputs: apps/regions/sg/data/area_summary_pa.{json,csv}, per-vintage
# summary JSON files, per-vintage boundary GeoJSON files, and the manifest.
# run from the repo root: Rscript scripts/build_sg_area_summary.R

suppressMessages({
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

raw_dir <- "data/raw/sg_census"
sg_dir <- "apps/regions/sg/data"
manifest_dir <- "docs/manifests"
dir.create(raw_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(sg_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- "2026-07-10"
script_id <- "scripts/build_sg_area_summary.R"
country_code <- "SG"
boundary_level <- "planning_area"
years <- c(2010L, 2020L)

census_dataset_id_2010 <- "singstat-ct-8628-planning-area-religion-2010"
census_dataset_id_2020 <- "singstat-ct-17592-planning-area-religion-2020"
national_dataset_id_2010 <- "singstat-ct-6364-national-religion-2010"
national_dataset_id_2020 <- "singstat-ct-17459-national-religion-2020"
boundary_dataset_id_2008 <- "data-gov-sg-d-773f010a4eaae0ce6d81cbe78d251642"
boundary_dataset_id_2019 <- "data-gov-sg-d-4765db0e87b9c86336792efe8a1f7a66"
boundary_set_id_2008 <- "sg-pa-2008-ura-mp2008"
boundary_set_id_2019 <- "sg-pa-2019-ura-mp2019"

data_api_base <- "https://api-open.data.gov.sg/v1/public/api/datasets"
tablebuilder_base <- paste0(
  "https://tablebuilder.singstat.gov.sg/api/doswebcontent/1/",
  "CrossSectionalFileUpload/CrossSectional"
)
religion_definitions_url <- paste0(
  "https://www.singstat.gov.sg/find-data/explore-data-themes/",
  "population/religion/latest-news-data"
)
open_data_licence_url <- "https://data.gov.sg/open-data-licence"

census_data_id_2010 <- "d_d4be7f8ba23ba93e5d59564d1dfb5eaa"
census_data_id_2020 <- "d_a58564fbed922609a0f79af96069dd9b"
national_data_id_2010 <- "d_9fa1b6a53c80f89d93b7c795d5b2e9ee"
national_data_id_2020 <- "d_4f6dc35cb00308f67bf9d429cfa30e65"
boundary_data_id_2008 <- "d_773f010a4eaae0ce6d81cbe78d251642"
boundary_data_id_2019 <- "d_4765db0e87b9c86336792efe8a1f7a66"

# construct a data.gov.sg signed-download polling route from a dataset id.
poll_url <- function(dataset_id) paste(data_api_base, dataset_id, "poll-download", sep = "/")

# construct a SingStat cross-sectional table metadata route from a table code.
table_url <- function(code) paste0(tablebuilder_base, "/", code)

# construct a public data.gov.sg catalogue page from a dataset id.
dataset_page_url <- function(dataset_id) paste0("https://data.gov.sg/datasets/", dataset_id, "/view")

census_path_2010 <- file.path(raw_dir, "ct8628_planning_area_religion_2010.csv")
census_path_2020 <- file.path(raw_dir, "ct17592_planning_area_religion_2020.csv")
national_path_2010 <- file.path(raw_dir, "ct6364_national_religion_2010.csv")
national_path_2020 <- file.path(raw_dir, "ct17459_national_religion_2020.csv")
boundary_path_2008 <- file.path(raw_dir, "master_plan_2008_planning_area_no_sea.geojson")
boundary_path_2019 <- file.path(raw_dir, "master_plan_2019_planning_area_no_sea.geojson")

boundary_out_2008 <- file.path(sg_dir, "sg_pa_2008.geojson")
boundary_out_2019 <- file.path(sg_dir, "sg_pa_2019.geojson")
summary_json_out <- file.path(sg_dir, "area_summary_pa.json")
summary_csv_out <- file.path(sg_dir, "area_summary_pa.csv")
summary_2010_out <- file.path(sg_dir, "area_summary_pa_2010.json")
summary_2020_out <- file.path(sg_dir, "area_summary_pa_2020.json")
manifest_out <- file.path(manifest_dir, "sg-census-religion-2010-2020.json")

licence_text <- paste(
  "Singapore Department of Statistics tables and Urban Redevelopment",
  "Authority planning-area boundaries are reused under the Singapore Open",
  "Data Licence. Source acknowledgement is required and reuse must not",
  "suggest endorsement by the Singapore Government."
)
population_basis <- "Resident Population Aged 15 Years and Over"
religion_definition <- paste(
  "Religion refers to the religious faith or spiritual belief declared by",
  "the person. Regular attendance at religious ceremonies and regular",
  "practice are not required for the declaration."
)
geography_note <- paste(
  "The 2010 wave uses Master Plan 2008 planning areas and the 2020 wave uses",
  "Master Plan 2019 planning areas. Each wave ships as its own geography",
  "level. No cross-wave planning-area change metric is calculated."
)

category_map <- list(
  list(source_label = "No Religion", mapped_role = "no_religion_count"),
  list(source_label = "Buddhism", mapped_role = "religious_affiliation_count"),
  list(source_label = "Taoism", mapped_role = "religious_affiliation_count", notes = "Includes Chinese Traditional Beliefs."),
  list(source_label = "Islam", mapped_role = "religious_affiliation_count"),
  list(source_label = "Hinduism", mapped_role = "religious_affiliation_count"),
  list(source_label = "Sikhism", mapped_role = "religious_affiliation_count"),
  list(source_label = "Christianity - Catholic", mapped_role = "religious_affiliation_count"),
  list(source_label = "Christianity - Other Christians", mapped_role = "religious_affiliation_count"),
  list(source_label = "Other Religions", mapped_role = "religious_affiliation_count")
)

# return a SHA-256 digest for a local file.
sha256_file <- function(path) unname(tools::sha256sum(path))

# return a local file's byte size as an integer.
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))

# return the current Git commit recorded by the generated manifest.
current_git_commit <- function() {
  result <- system2("git", c("rev-parse", "--short", "HEAD"), stdout = TRUE, stderr = TRUE)
  commit <- result[[1]]
  if (!grepl("^[a-f0-9]{7,40}$", commit)) stop("could not resolve Git commit", call. = FALSE)
  commit
}

# return JSON null for missing scalar values.
null_if_na <- function(value) {
  if (!length(value) || is.na(value) || !is.finite(value)) return(NULL)
  value
}

# count data rows or GeoJSON features in a generated product.
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  value <- fromJSON(path, simplifyVector = FALSE)
  if (grepl("\\.geojson$", path)) return(length(value[["features"]]))
  if (!is.null(value[["rows"]])) return(length(value[["rows"]]))
  NA_integer_
}

# fetch a data.gov.sg source through its current signed download URL.
download_dataset <- function(dataset_id, path, attempts = 8L) {
  if (file.exists(path) && file.info(path)[["size"]] > 0) return(invisible(path))
  tmp_poll <- tempfile(fileext = ".json")
  tmp_out <- paste0(path, ".part")
  on.exit(unlink(tmp_poll), add = TRUE)
  for (attempt in seq_len(attempts)) {
    poll_status <- system2(
      "curl",
      c("-L", "--fail", "--silent", "--show-error", "-o", tmp_poll, poll_url(dataset_id))
    )
    poll <- if (poll_status == 0L) fromJSON(tmp_poll, simplifyVector = FALSE) else NULL
    url <- if (!is.null(poll)) poll[["data"]][["url"]] else NULL
    if (!is.null(url) && nzchar(url)) {
      status <- system2(
        "curl",
        c("-L", "--fail", "--silent", "--show-error", "-o", tmp_out, shQuote(url))
      )
      if (status == 0L && file.exists(tmp_out) && file.info(tmp_out)[["size"]] > 0) {
        file.rename(tmp_out, path)
        return(invisible(path))
      }
    }
    if (attempt < attempts) Sys.sleep(min(5 * attempt, 30))
  }
  stop("data.gov.sg download failed for ", dataset_id, call. = FALSE)
}

# download all raw tables and boundary vintages needed by the build.
fetch_sources <- function() {
  download_dataset(census_data_id_2010, census_path_2010)
  download_dataset(census_data_id_2020, census_path_2020)
  download_dataset(national_data_id_2010, national_path_2010)
  download_dataset(national_data_id_2020, national_path_2020)
  download_dataset(boundary_data_id_2008, boundary_path_2008)
  download_dataset(boundary_data_id_2019, boundary_path_2019)
}

# read one planning-area table and normalise its stable category columns.
read_census_table <- function(path, year) {
  data <- read.csv(path, check.names = FALSE, na.strings = c("-", "na"), stringsAsFactors = FALSE)
  expected <- c(
    "Number", "Total", "NoReligion", "Buddhism",
    if (year == 2010L) "Taoism" else "Taoism1",
    "Islam", "Hinduism", "Sikhism", "Christianity_Catholic",
    "Christianity_OtherChristians", "OtherReligions"
  )
  if (!identical(names(data), expected)) stop(year, " census columns changed", call. = FALSE)
  names(data)[names(data) == "Number"] <- "area_name"
  names(data)[names(data) == "Total"] <- "total"
  names(data)[names(data) == "NoReligion"] <- "no_religion"
  names(data)[names(data) %in% c("Taoism", "Taoism1")] <- "taoism"
  names(data)[names(data) == "Christianity_Catholic"] <- "catholic"
  names(data)[names(data) == "Christianity_OtherChristians"] <- "other_christians"
  names(data)[names(data) == "OtherReligions"] <- "other_religions"
  names(data) <- tolower(names(data))
  numeric_columns <- setdiff(names(data), "area_name")
  data[numeric_columns] <- lapply(data[numeric_columns], as.integer)
  national <- data[data[["area_name"]] == "Total", , drop = FALSE]
  areas <- data[data[["area_name"]] != "Total", , drop = FALSE]
  if (nrow(national) != 1L || !"Others" %in% areas[["area_name"]]) {
    stop(year, " table lacks the expected Total or Others row", call. = FALSE)
  }
  religion_columns <- setdiff(numeric_columns, c("total", "no_religion"))
  if (anyNA(areas[["total"]]) || anyNA(areas[["no_religion"]])) {
    stop(year, " table has missing Total or No Religion values", call. = FALSE)
  }
  # total minus the table's own no-religion category retains rows with
  # unavailable minor-category cells and matches the published With Religion construct.
  areas[["religious_affiliation"]] <- areas[["total"]] - areas[["no_religion"]]
  national[["religious_affiliation"]] <- national[["total"]] - national[["no_religion"]]
  list(areas = areas, national = national, religion_columns = religion_columns)
}

# read the independent national comparison rows for the headline metrics.
read_national_totals <- function(path, year) {
  data <- read.csv(path, check.names = FALSE, stringsAsFactors = FALSE)
  total_column <- "Total_Total"
  if (!all(c("Number", total_column) %in% names(data))) {
    stop(year, " national table columns changed", call. = FALSE)
  }
  values <- setNames(lapply(c("Total", "With Religion", "No Religion"), function(label) {
    value <- data[data[["Number"]] == label, total_column]
    if (length(value) != 1L) stop(year, " national ", label, " row changed", call. = FALSE)
    as.integer(value)
  }), c("total", "religious_affiliation", "no_religion"))
  values
}

# compare all planning-area rows including Others with the published Total row.
reconcile_table <- function(census, national, year) {
  fields <- c("total", "religious_affiliation", "no_religion")
  lapply(fields, function(field) {
    area_sum <- sum(census[["areas"]][[field]], na.rm = TRUE)
    national_value <- as.integer(national[[field]])
    list(
      year = year,
      metric = field,
      planning_area_sum_including_others = area_sum,
      published_national_total = national_value,
      residual = area_sum - national_value
    )
  })
}

# summarise source rounding differences between totals and category sums.
category_rounding <- function(census) {
  categories <- census[["areas"]][census[["religion_columns"]]]
  complete <- rowSums(is.na(categories)) == 0L
  residual <- census[["areas"]][["religious_affiliation"]][complete] -
    rowSums(categories[complete, , drop = FALSE])
  list(
    minimum = as.integer(min(residual)),
    maximum = as.integer(max(residual)),
    nonzero_row_count = as.integer(sum(residual != 0L)),
    complete_row_count = as.integer(sum(complete)),
    incomplete_row_count = as.integer(sum(!complete))
  )
}

# read, join, and prepare one URA planning-area boundary vintage.
prepare_boundary <- function(path, metrics, boundary_set_id) {
  boundary <- st_read(path, quiet = TRUE, stringsAsFactors = FALSE)
  required <- c("PLN_AREA_N", "PLN_AREA_C", "REGION_N", "REGION_C")
  if (!all(required %in% names(boundary))) stop("URA boundary fields changed", call. = FALSE)
  mapped <- metrics[metrics[["area_name"]] != "Others", , drop = FALSE]
  index <- match(toupper(mapped[["area_name"]]), toupper(boundary[["PLN_AREA_N"]]))
  if (anyNA(index)) {
    stop("unmatched census planning areas: ", paste(mapped[["area_name"]][is.na(index)], collapse = ", "), call. = FALSE)
  }
  boundary <- boundary[index, ]
  boundary[["area_code"]] <- boundary[["PLN_AREA_C"]]
  boundary[["area_name"]] <- mapped[["area_name"]]
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- boundary_level
  boundary[["area_unit_id"]] <- paste(boundary_set_id, boundary[["area_code"]], sep = ":")
  boundary[["region_name"]] <- tools::toTitleCase(tolower(boundary[["REGION_N"]]))
  boundary[["region_code"]] <- boundary[["REGION_C"]]
  boundary[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(boundary, 3414))) / 1e6
  if (any(st_is_empty(boundary))) stop("URA source boundary contains empty geometry", call. = FALSE)
  boundary
}

# simplify and write one mapped planning-area boundary file.
write_boundary <- function(boundary, output_path) {
  fields <- c(
    "area_code", "area_name", "area_unit_id", "boundary_set_id",
    "boundary_level", "region_name", "region_code", "land_area_sq_km"
  )
  if (file.exists(output_path) && file.info(output_path)[["size"]] <= 1500000) {
    existing <- st_read(output_path, quiet = TRUE)
    if (nrow(existing) == nrow(boundary) && !any(st_is_empty(existing)) &&
        all(st_is_valid(existing))) {
      return(list(
        method = "existing validated mapshaper output",
        clean_option = "allow-overlaps",
        keep_percent = NA_real_,
        bytes = as.numeric(file.info(output_path)[["size"]])
      ))
    }
  }
  last_error <- NULL
  for (attempt in seq_len(3L)) {
    result <- tryCatch(
      mapshaper_simplify_to_cap(
        boundary[fields], output_path, max_bytes = 1500000,
        keep_percentages = c(20, 10, 5, 2, 1), clean_option = "allow-overlaps"
      ),
      error = function(error) {
        last_error <<- error
        NULL
      }
    )
    if (!is.null(result)) return(result)
    if (attempt < 3L) Sys.sleep(3)
  }
  stop("boundary simplification failed after three attempts: ", conditionMessage(last_error), call. = FALSE)
}

# describe whether a boundary was freshly simplified or reused after validation.
boundary_write_note <- function(result) {
  if (is.na(result[["keep_percent"]])) {
    return(paste0(result[["bytes"]], " bytes; existing output revalidated"))
  }
  paste0(result[["bytes"]], " bytes at ", result[["keep_percent"]], "% keep")
}

# return a named source-dataset record for an area-summary document.
source_dataset <- function(id, name, provider, url, citation, notes = NULL) {
  list(
    source_dataset_id = id,
    name = name,
    provider = provider,
    url = url,
    retrieval_date = retrieval_date,
    local_path = NULL,
    licence = list(
      name = "Singapore Open Data Licence",
      url = open_data_licence_url,
      attribution = "Source: Singapore Department of Statistics and Urban Redevelopment Authority, via data.gov.sg."
    ),
    citation = citation,
    access_limits = NULL,
    redistribution_limits = "Reuse must acknowledge the source and must not suggest Singapore Government endorsement.",
    notes = notes
  )
}

# define shared area-summary indicators for the census construct.
indicators <- function(temporal_coverage, spatial_coverage) {
  list(
    list(
      indicator_id = "population_total",
      label = population_basis,
      description = "Published census table total for the planning area.",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "Use the table's Total column without adjustment.",
      temporal_coverage = temporal_coverage,
      spatial_coverage = spatial_coverage,
      quality_notes = "The published whole-person category counts have small additivity residuals."
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious affiliation %",
      description = paste("Share declaring a listed religion.", religion_definition),
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 times (Total minus No Religion) divided by Total. The difference equals the table's published With Religion construct and avoids imputing unavailable minor-category cells.",
      temporal_coverage = temporal_coverage,
      spatial_coverage = spatial_coverage,
      quality_notes = "Taoism includes Chinese Traditional Beliefs. Published category counts are preserved."
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "No religion %",
      description = "Share in the table's own No Religion category.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 times No Religion divided by Total.",
      temporal_coverage = temporal_coverage,
      spatial_coverage = spatial_coverage,
      quality_notes = religion_definition
    )
  )
}

# define the two non-comparative choropleth layers in the data product.
visual_layers <- function(temporal_coverage) {
  list(
    list(
      visual_layer_id = "sg-pa-religious-affiliation",
      label = "Religious affiliation %",
      description = paste("Planning-area census affiliation for", temporal_coverage, "on each wave's own boundary vintage."),
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = population_basis),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported planning-area value",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = geography_note
    ),
    list(
      visual_layer_id = "sg-pa-no-religion",
      label = "No religion %",
      description = paste("Planning-area No Religion share for", temporal_coverage, "on each wave's own boundary vintage."),
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = population_basis),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported planning-area value",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = geography_note
    )
  )
}

# build schema-conforming map rows for one wave and boundary vintage.
build_rows <- function(census, boundary, year, boundary_set_id, boundary_dataset_id, census_dataset_id) {
  metrics <- census[["areas"]][census[["areas"]][["area_name"]] != "Others", , drop = FALSE]
  index <- match(metrics[["area_name"]], boundary[["area_name"]])
  if (anyNA(index)) stop(year, " area-summary boundary join failed", call. = FALSE)
  lapply(seq_len(nrow(metrics)), function(i) {
    row <- metrics[i, , drop = FALSE]
    geo <- boundary[index[[i]], ]
    total <- row[["total"]][[1]]
    affiliation <- row[["religious_affiliation"]][[1]]
    no_religion <- row[["no_religion"]][[1]]
    list(
      country_code = country_code,
      boundary_set_id = boundary_set_id,
      boundary_level = boundary_level,
      area_unit_id = geo[["area_unit_id"]][[1]],
      area_code = geo[["area_code"]][[1]],
      area_name = row[["area_name"]][[1]],
      year = year,
      population_total = as.integer(total),
      population_total_basis = population_basis,
      religious_affiliation_count = as.integer(affiliation),
      religious_affiliation_percent = round(100 * affiliation / total, 4),
      no_religion_count = as.integer(no_religion),
      no_religion_percent = round(100 * no_religion / total, 4),
      place_count = NULL,
      places_per_10000_residents = NULL,
      place_density_per_sq_km = NULL,
      land_area_sq_km = round(geo[["land_area_sq_km"]][[1]], 6),
      site_snapshot_date = NULL,
      place_count_basis = NULL,
      source_dataset_ids = list(census_dataset_id, boundary_dataset_id),
      quality_flag = "published_whole_person_counts;small_additivity_residuals;per_vintage_geography;no_cross_wave_change"
    )
  })
}

# flatten schema rows for the CSV companion without changing the JSON rows.
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
    source_dataset_ids = vapply(rows, function(row) paste(unlist(row[["source_dataset_ids"]]), collapse = "|"), character(1)),
    quality_flag = vapply(rows, `[[`, character(1), "quality_flag"),
    stringsAsFactors = FALSE
  )
}

# assemble either the combined document or one per-vintage derived view.
area_summary_document <- function(rows, year = NULL) {
  combined <- is.null(year)
  if (combined) {
    boundary_set <- list(
      boundary_set_id = "sg-pa-period-ura-master-plan",
      country_code = country_code,
      level = boundary_level,
      vintage = "Master Plan 2008 for 2010; Master Plan 2019 for 2020",
      source_dataset_id = paste(boundary_dataset_id_2008, boundary_dataset_id_2019, sep = "|")
    )
    coverage <- "2010 and 2020"
    spatial <- "Singapore planning areas on each census wave's matching URA Master Plan vintage."
  } else {
    is_2010 <- year == 2010L
    boundary_set <- list(
      boundary_set_id = if (is_2010) boundary_set_id_2008 else boundary_set_id_2019,
      country_code = country_code,
      level = boundary_level,
      vintage = if (is_2010) "Master Plan 2008" else "Master Plan 2019",
      source_dataset_id = if (is_2010) boundary_dataset_id_2008 else boundary_dataset_id_2019
    )
    coverage <- as.character(year)
    spatial <- paste("Singapore planning areas on URA", boundary_set[["vintage"]], "boundaries.")
  }
  list(
    schema_version = "area-summary.v1",
    generated_at = stamp,
    generated_by = script_id,
    country_code = country_code,
    boundary_set = boundary_set,
    site_snapshot = list(
      source_dataset_id = NULL,
      snapshot_date = NULL,
      basis = "no governed Singapore place-of-worship snapshot is included in this country data-map release",
      notes = "Place-count and density metrics remain null."
    ),
    source_datasets = list(
      source_dataset(
        census_dataset_id_2010,
        "Table 11 Resident Population Aged 15 Years and Over by Planning Area and Religion",
        "Singapore Department of Statistics", table_url(8628),
        "Census of Population 2010, CT 8628.",
        "Planning areas refer to URA Master Plan 2008."
      ),
      source_dataset(
        census_dataset_id_2020,
        "Table 99 Resident Population Aged 15 Years and Over by Planning Area of Residence and Religion",
        "Singapore Department of Statistics", table_url(17592),
        "Census of Population 2020, CT 17592.",
        "Planning areas refer to URA Master Plan 2019."
      ),
      source_dataset(
        boundary_dataset_id_2008, "Master Plan 2008 Planning Area Boundary (No Sea)",
        "Urban Redevelopment Authority", dataset_page_url(boundary_data_id_2008),
        "URA Master Plan 2008 planning-area boundary via data.gov.sg."
      ),
      source_dataset(
        boundary_dataset_id_2019, "Master Plan 2019 Planning Area Boundary (No Sea)",
        "Urban Redevelopment Authority", dataset_page_url(boundary_data_id_2019),
        "URA Master Plan 2019 planning-area boundary via data.gov.sg."
      )
    ),
    indicators = indicators(coverage, spatial),
    visual_layers = visual_layers(coverage),
    rows = rows
  )
}

# create a durable-file record for a generated repository product.
manifest_file_record <- function(path, content) {
  is_geo <- grepl("\\.geojson$", path)
  list(
    uri = paste0("repo:", path),
    storage_provider = "other",
    format = sub("^.*\\.", "", path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    row_count = if (is_geo) NULL else row_count_file(path),
    feature_count = if (is_geo) row_count_file(path) else NULL,
    content = content,
    privacy = "public",
    licence_status = "accepted"
  )
}

# create a manifest note for one cached raw source.
raw_source_record <- function(path, dataset_id, url, format, rows, notes) {
  list(
    uri = path,
    url = url,
    format = format,
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    row_count = rows,
    source_dataset_id = dataset_id,
    used_in_public_product = TRUE,
    notes = notes
  )
}

fetch_sources()
census_2010 <- read_census_table(census_path_2010, 2010L)
census_2020 <- read_census_table(census_path_2020, 2020L)
national_2010 <- read_national_totals(national_path_2010, 2010L)
national_2020 <- read_national_totals(national_path_2020, 2020L)

if (national_2010[["total"]] != census_2010[["national"]][["total"]]) {
  stop("2010 CT 6364 national total does not match CT 8628 Total", call. = FALSE)
}
if (national_2020[["total"]] != census_2020[["national"]][["total"]]) {
  stop("2020 CT 17459 national total does not match CT 17592 Total", call. = FALSE)
}
if (national_2010[["no_religion"]] != census_2010[["national"]][["no_religion"]] ||
    national_2020[["no_religion"]] != census_2020[["national"]][["no_religion"]]) {
  stop("national and planning-area No Religion totals differ", call. = FALSE)
}

reconciliation_2010 <- reconcile_table(census_2010, national_2010, 2010L)
reconciliation_2020 <- reconcile_table(census_2020, national_2020, 2020L)
rounding_2010 <- category_rounding(census_2010)
rounding_2020 <- category_rounding(census_2020)

boundary_2008 <- prepare_boundary(boundary_path_2008, census_2010[["areas"]], boundary_set_id_2008)
boundary_2019 <- prepare_boundary(boundary_path_2019, census_2020[["areas"]], boundary_set_id_2019)
boundary_write_2008 <- write_boundary(boundary_2008, boundary_out_2008)
boundary_write_2019 <- write_boundary(boundary_2019, boundary_out_2019)

rows_2010 <- build_rows(
  census_2010, boundary_2008, 2010L, boundary_set_id_2008,
  boundary_dataset_id_2008, census_dataset_id_2010
)
rows_2020 <- build_rows(
  census_2020, boundary_2019, 2020L, boundary_set_id_2019,
  boundary_dataset_id_2019, census_dataset_id_2020
)
rows <- c(rows_2010, rows_2020)

write_json(area_summary_document(rows), summary_json_out, auto_unbox = TRUE,
           pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")
write_json(area_summary_document(rows_2010, 2010L), summary_2010_out, auto_unbox = TRUE,
           pretty = TRUE, null = "null", na = "null", digits = NA)
write_json(area_summary_document(rows_2020, 2020L), summary_2020_out, auto_unbox = TRUE,
           pretty = TRUE, null = "null", na = "null", digits = NA)

if (row_count_file(boundary_out_2008) != length(rows_2010)) {
  stop("2010 boundary feature count changed during simplification", call. = FALSE)
}
if (row_count_file(boundary_out_2019) != length(rows_2020)) {
  stop("2020 boundary feature count changed during simplification", call. = FALSE)
}

# format one wave's reconciliation residuals for logs and the manifest.
reconciliation_line <- function(items, year) {
  values <- vapply(items, function(item) {
    paste0(item[["metric"]], " ", sprintf("%+d", item[["residual"]]))
  }, character(1))
  paste0(year, " planning-area sums including Others minus the published national Total row: ", paste(values, collapse = "; "), ".")
}

validation_notes <- paste(
  "The build takes the two-vintage branch: CT 8628 uses Master Plan 2008 boundaries and CT 17592 uses Master Plan 2019 boundaries.",
  "The 2010 table contributes 35 mapped planning-area rows; the 2020 table contributes 30 mapped planning-area rows. Each table's Others row is included in national reconciliation and excluded from map rows because it has no planning-area polygon.",
  reconciliation_line(reconciliation_2010, 2010L),
  reconciliation_line(reconciliation_2020, 2020L),
  paste0("Across the ", rounding_2010[["complete_row_count"]], " complete 2010 rows, Total minus No Religion minus the sum of named religion categories ranges from ", rounding_2010[["minimum"]], " to ", rounding_2010[["maximum"]], " persons; ", rounding_2010[["nonzero_row_count"]], " rows are non-zero. Another ", rounding_2010[["incomplete_row_count"]], " rows contain source 'na' markers."),
  paste0("Across the ", rounding_2020[["complete_row_count"]], " complete 2020 rows, Total minus No Religion minus the sum of named religion categories ranges from ", rounding_2020[["minimum"]], " to ", rounding_2020[["maximum"]], " persons; ", rounding_2020[["nonzero_row_count"]], " rows are non-zero. Another ", rounding_2020[["incomplete_row_count"]], " row contains a source dash."),
  "The small residuals are consistent with whole-person cell rounding. The build preserves every source value and does not distribute residuals.",
  "The headline religious-affiliation count is Total minus No Religion. This retains the complete with-religion construct without imputing the 'na' and dash category cells.",
  paste0("CT 6364 independently reports the 2010 national total as ", national_2010[["total"]], ", matching CT 8628 Total."),
  paste0("CT 17459 independently reports the 2020 national total as ", national_2020[["total"]], ", matching CT 17592 Total."),
  geography_note,
  paste0("The 2008 boundary writes to ", boundary_write_note(boundary_write_2008), "."),
  paste0("The 2019 boundary writes to ", boundary_write_note(boundary_write_2019), "."),
  sep = "\n"
)

raw_sources <- list(
  raw_source_record(census_path_2010, census_dataset_id_2010, poll_url(census_data_id_2010), "csv", 37L, "CT 8628: Total, 35 named planning areas, and Others."),
  raw_source_record(census_path_2020, census_dataset_id_2020, poll_url(census_data_id_2020), "csv", 32L, "CT 17592: Total, 30 named planning areas, and Others."),
  raw_source_record(national_path_2010, national_dataset_id_2010, poll_url(national_data_id_2010), "csv", 12L, "CT 6364 national religion table used to verify the published total."),
  raw_source_record(national_path_2020, national_dataset_id_2020, poll_url(national_data_id_2020), "csv", 12L, "CT 17459 national religion table used to verify the published total."),
  raw_source_record(boundary_path_2008, boundary_dataset_id_2008, poll_url(boundary_data_id_2008), "geojson", 55L, "Full URA MP2008 planning-area source; mapped subset ships."),
  raw_source_record(boundary_path_2019, boundary_dataset_id_2019, poll_url(boundary_data_id_2019), "geojson", 55L, "Full URA MP2019 planning-area source; mapped subset ships.")
)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:sg-census-religion:sg:2010-2020:singstat",
  dataset_id = "sg-census-religion:sg:2010-2020:singstat",
  dataset_version_id = paste0("sg-census-religion:sg:2010-2020:singstat:", substr(sha256_file(summary_json_out), 1, 12)),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "sg-census-religion",
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
    git_commit = current_git_commit(),
    command = paste("Rscript", script_id),
    parameters = list(
      waves_built = "2010, 2020",
      geography = "planning area; each wave uses its own URA Master Plan vintage",
      boundary_sets = paste(boundary_set_id_2008, boundary_set_id_2019, sep = ", "),
      denominator = population_basis,
      category_mapping = "No Religion remains separate; all named religion categories sum to religious affiliation.",
      omitted_metrics = "cross-wave planning-area change; all place-of-worship count and density metrics",
      reconciliation = "planning-area sums include Others and are compared with each table's published national Total row; residuals are reported and never distributed"
    ),
    software_versions = list(
      r = paste(R.version[["major"]], R.version[["minor"]], sep = "."),
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite"))
    )
  ),
  source = list(
    provider = "Singapore Department of Statistics; Urban Redevelopment Authority, via data.gov.sg",
    source_dataset_ids = c(
      census_dataset_id_2010, census_dataset_id_2020,
      national_dataset_id_2010, national_dataset_id_2020,
      boundary_dataset_id_2008, boundary_dataset_id_2019
    ),
    source_urls = c(
      table_url(8628), table_url(17592), table_url(6364), table_url(17459),
      dataset_page_url(boundary_data_id_2008), dataset_page_url(boundary_data_id_2019),
      religion_definitions_url, open_data_licence_url
    ),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = licence_text,
    citation = "SingStat Census of Population tables CT 8628, CT 17592, CT 6364, and CT 17459; URA Master Plan 2008 and 2019 planning-area boundaries."
  ),
  input_manifests = list(),
  durable_files = list(
    manifest_file_record(summary_json_out, "Combined Singapore planning-area census religion product; per-vintage geography only."),
    manifest_file_record(summary_csv_out, "Flattened combined Singapore planning-area census religion rows."),
    manifest_file_record(summary_2010_out, "Derived 2010-only view for the MP2008 planning-area level."),
    manifest_file_record(summary_2020_out, "Derived 2020-only view for the MP2019 planning-area level."),
    manifest_file_record(boundary_out_2008, "Simplified mapped subset of URA Master Plan 2008 planning-area boundaries."),
    manifest_file_record(boundary_out_2019, "Simplified mapped subset of URA Master Plan 2019 planning-area boundaries.")
  ),
  partitions = list(
    list(partition_id = "country:SG:2010", partition_type = "country", country_code = country_code, file_uri = paste0("repo:", summary_2010_out), sha256 = sha256_file(summary_2010_out), row_count = length(rows_2010), feature_count = length(rows_2010)),
    list(partition_id = "country:SG:2020", partition_type = "country", country_code = country_code, file_uri = paste0("repo:", summary_2020_out), sha256 = sha256_file(summary_2020_out), row_count = length(rows_2020), feature_count = length(rows_2020))
  ),
  stats = list(
    waves = 2L,
    mapped_rows_2010 = length(rows_2010),
    mapped_rows_2020 = length(rows_2020),
    source_rows_including_others_2010 = nrow(census_2010[["areas"]]),
    source_rows_including_others_2020 = nrow(census_2020[["areas"]]),
    national_total_2010 = national_2010[["total"]],
    national_total_2020 = national_2020[["total"]],
    total_residual_2010 = reconciliation_2010[[1]][["residual"]],
    total_residual_2020 = reconciliation_2020[[1]][["residual"]],
    affiliation_residual_2010 = reconciliation_2010[[2]][["residual"]],
    affiliation_residual_2020 = reconciliation_2020[[2]][["residual"]],
    no_religion_residual_2010 = reconciliation_2010[[3]][["residual"]],
    no_religion_residual_2020 = reconciliation_2020[[3]][["residual"]]
  ),
  local_cache_hint = "Raw SingStat CSVs and URA GeoJSON files are cached under data/raw/sg_census/. The git-ignored cache should be promoted to project-controlled storage before reuse outside this build.",
  validation = list(
    status = "passed_with_warnings",
    commands = list(
      "Rscript scripts/build_sg_area_summary.R",
      "uv run --with jsonschema python -m jsonschema -i apps/regions/sg/data/area_summary_pa.json schemas/area-summary.schema.json",
      "uv run --with jsonschema python -m jsonschema -i apps/regions/sg/data/area_summary_pa_2010.json schemas/area-summary.schema.json",
      "uv run --with jsonschema python -m jsonschema -i apps/regions/sg/data/area_summary_pa_2020.json schemas/area-summary.schema.json",
      "uv run --with jsonschema python -m jsonschema -i docs/manifests/sg-census-religion-2010-2020.json schemas/data-manifest.schema.json"
    ),
    warnings = c(
      "Published planning-area category sums have small additivity residuals against the published national rows.",
      "No residual is distributed across planning areas.",
      "The two waves use different planning-area vintages and expose no cross-wave area change metric.",
      "The Others source row is included in reconciliation and excluded from mapped rows because it has no polygon."
    ),
    notes = validation_notes
  ),
  privacy = "public",
  licence_status = "accepted",
  downstream_status = "public",
  notes = paste(
    validation_notes,
    "Raw source records:", toJSON(raw_sources, auto_unbox = TRUE, null = "null"),
    "Category mapping:",
    paste(vapply(category_map, function(item) {
      paste(item[["source_label"]], "=>", item[["mapped_role"]])
    }, character(1)), collapse = "; "),
    "Religion definition:", religion_definition
  )
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE,
           null = "null", na = "null", digits = NA)

cat("branch=two-vintage\n")
cat("wrote ", summary_json_out, " rows=", row_count_file(summary_json_out), "\n", sep = "")
cat("wrote ", summary_2010_out, " rows=", row_count_file(summary_2010_out), "\n", sep = "")
cat("wrote ", summary_2020_out, " rows=", row_count_file(summary_2020_out), "\n", sep = "")
cat(reconciliation_line(reconciliation_2010, 2010L), "\n")
cat(reconciliation_line(reconciliation_2020, 2020L), "\n")
cat("wrote ", boundary_out_2008, " features=", row_count_file(boundary_out_2008), " bytes=", file_bytes(boundary_out_2008), "\n", sep = "")
cat("wrote ", boundary_out_2019, " features=", row_count_file(boundary_out_2019), " bytes=", file_bytes(boundary_out_2019), "\n", sep = "")
cat("wrote ", manifest_out, "\n", sep = "")
