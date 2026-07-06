# build us nhgis county deep-past area-summary products.
# inputs: ignored nhgis extracts under data/raw/us_nhgis/.
# outputs: derived county summaries, simplified period boundaries, source
# extracts, data/raw/us_nhgis/sources.csv, and the public nhgis manifest.
# run from the repo root: Rscript scripts/build_us_nhgis_deep_past.R

suppressMessages({
  library(jsonlite)
  library(readr)
  library(sf)
})

sf::sf_use_s2(FALSE)

raw_dir <- "data/raw/us_nhgis"
csv_dir <- file.path(raw_dir, "nhgis0001_csv")
validation_csv_dir <- file.path(raw_dir, "nhgis0002_csv")
shape_dir <- file.path(raw_dir, "nhgis0001_shape")
us_dir <- "apps/regions/us/data"
src_dir <- file.path(us_dir, "source")
manifest_dir <- "docs/manifests"
dir.create(src_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- "2026-07-06"
nhgis_citation <- paste(
  "Jonathan Schroeder, David Van Riper, Steven Manson, Grace Cooper,",
  "Zachary Krause, Tracy Kugler, Tsu Zhu, and Steven Ruggles.",
  "IPUMS National Historical Geographic Information System: Version 21.0",
  "[dataset]. Minneapolis, MN: IPUMS. 2026.",
  "http://doi.org/10.18128/D050.V21.0"
)
nhgis_short_citation <- "IPUMS NHGIS, University of Minnesota, www.nhgis.org."
jb_licence_position <- paste(
  "publish the derived rates with citation and a pointer to the original",
  "NHGIS data, now; he judges the risk acceptable for a research website",
  "and takes responsibility for it."
)
raw_archive_target <- "gs://places-of-worship-private-sync/raw_sources/us_nhgis/"

# return NULL for JSON fields when a numeric value is absent.
json_number <- function(value, digits = NULL) {
  if (!length(value) || !is.finite(value)) return(NULL)
  if (is.null(digits)) value else round(value, digits)
}

# read an NHGIS csv_header file while dropping the descriptive second header row.
read_nhgis_csv <- function(path) {
  headers <- strsplit(readLines(path, n = 1, warn = FALSE), ",", fixed = TRUE)[[1]]
  suppressMessages(read_csv(
    path,
    skip = 2,
    col_names = headers,
    col_types = cols(.default = col_character()),
    na = c("", "NA")
  ))
}

# parse NHGIS numeric text, including comma-formatted values.
num_col <- function(data, column_name) {
  parse_number(data[[column_name]], locale = locale(grouping_mark = ","))
}

# sum a vector while preserving all-missing groups as missing.
sum_or_na <- function(values) {
  if (all(is.na(values))) NA_real_ else sum(values, na.rm = TRUE)
}

# produce a compact comma-separated label for manifest lists.
collapse_values <- function(values, limit = 40) {
  values <- sort(unique(values[!is.na(values) & nzchar(values)]))
  if (!length(values)) return("")
  if (length(values) > limit) {
    values <- c(values[seq_len(limit)], sprintf("... %d more", length(values) - limit))
  }
  paste(values, collapse = ", ")
}

# locate the NHGIS csv for a dataset, year, and geography level.
csv_path <- function(base_dir, nhgis_id, year, level) {
  matches <- Sys.glob(file.path(base_dir, sprintf("*_%s_%s_%s.csv", nhgis_id, year, level)))
  if (length(matches) != 1) {
    stop(sprintf("expected one %s %s %s csv, found %d", nhgis_id, year, level, length(matches)))
  }
  matches[[1]]
}

# compute a tracked file record for the docs manifest.
durable_file <- function(path, row_count = NULL, content = "") {
  info <- file.info(path)
  list(
    uri = paste0("repo:", path),
    storage_provider = "other",
    format = tools::file_ext(path),
    bytes = as.integer(info[["size"]]),
    sha256 = unname(tools::sha256sum(path)),
    row_count = row_count,
    content = content,
    privacy = "public",
    licence_status = "accepted_by_jb_pending_ipums_confirmation"
  )
}

# compute a local raw-file record for ignored NHGIS downloads.
raw_file <- function(path, content = "") {
  info <- file.info(path)
  list(
    local_path = path,
    bytes = as.integer(info[["size"]]),
    sha256 = unname(tools::sha256sum(path)),
    content = content,
    privacy = "private_cache",
    archive_status = "pending_private_gcs_upload",
    archive_target = raw_archive_target
  )
}

# list source-table metadata from the authenticated NHGIS discovery pass.
make_table_records <- function(spec) {
  lapply(spec[["tables"]], function(table) {
    list(
      source_code = table[["source_code"]],
      nhgis_code = table[["nhgis_code"]],
      description = table[["description"]],
      role = table[["role"]],
      variable_codes = table[["variables"]]
    )
  })
}

# read, simplify, and write a period county boundary file.
write_boundary_geojson <- function(boundary_year, simplify_tolerance_metres = 1500) {
  shp <- Sys.glob(file.path(
    shape_dir,
    sprintf("*us_county_%s", boundary_year),
    sprintf("US_county_%s_conflated.shp", boundary_year)
  ))
  if (length(shp) != 1) stop(sprintf("missing boundary shapefile for %s", boundary_year))

  boundary <- st_read(shp, quiet = TRUE)
  keep <- c("GISJOIN", "NHGISNAM", "STATENAM", "STATE", "COUNTY")
  boundary <- boundary[keep]
  boundary[["AREA_NAME"]] <- paste0(boundary[["NHGISNAM"]], ", ", boundary[["STATENAM"]])
  boundary[["BOUNDARY_YEAR"]] <- as.integer(boundary_year)
  boundary[["BOUNDARY_SET_ID"]] <- sprintf("us-county-%s-tl2008", boundary_year)
  boundary[["LAND_AREA_SQ_KM"]] <- as.numeric(st_area(st_make_valid(boundary))) / 1e6

  output_path <- file.path(us_dir, sprintf("counties_%s.geojson", boundary_year))
  simplified <- st_simplify(
    boundary,
    dTolerance = simplify_tolerance_metres,
    preserveTopology = FALSE
  )
  simplified <- st_transform(simplified, 4326)
  suppressWarnings(st_write(
    simplified,
    output_path,
    driver = "GeoJSON",
    delete_dsn = TRUE,
    quiet = TRUE,
    layer_options = "COORDINATE_PRECISION=5"
  ))
  size <- file.info(output_path)[["size"]]

  list(
    year = boundary_year,
    boundary = boundary,
    output_path = output_path,
    feature_count = nrow(boundary),
    bytes = as.integer(size),
    simplify_tolerance_metres = simplify_tolerance_metres
  )
}

# build the derived source extract for one wave before JSON conversion.
build_wave_extract <- function(spec, boundary_info) {
  source <- read_nhgis_csv(csv_path(csv_dir, spec[["nhgis_id"]], spec[["year"]], "county"))
  source[["population_total"]] <- num_col(source, spec[["population_col"]])
  source[["church_or_edifice_count"]] <- if (!is.null(spec[["place_col"]])) num_col(source, spec[["place_col"]]) else NA_real_
  source[["church_seating_count"]] <- if (!is.null(spec[["seating_col"]])) num_col(source, spec[["seating_col"]]) else NA_real_
  source[["church_property_value"]] <- if (!is.null(spec[["property_col"]])) num_col(source, spec[["property_col"]]) else NA_real_
  source[["member_count"]] <- if (!is.null(spec[["member_col"]])) num_col(source, spec[["member_col"]]) else NA_real_
  source[["church_seating_per_100_population"]] <- ifelse(
    is.finite(source[["population_total"]]) & source[["population_total"]] > 0 & is.finite(source[["church_seating_count"]]),
    100 * source[["church_seating_count"]] / source[["population_total"]],
    NA_real_
  )
  source[["churches_or_edifices_per_10000_residents"]] <- ifelse(
    is.finite(source[["population_total"]]) & source[["population_total"]] > 0 & is.finite(source[["church_or_edifice_count"]]),
    10000 * source[["church_or_edifice_count"]] / source[["population_total"]],
    NA_real_
  )
  source[["members_per_100_population"]] <- ifelse(
    is.finite(source[["population_total"]]) & source[["population_total"]] > 0 & is.finite(source[["member_count"]]),
    100 * source[["member_count"]] / source[["population_total"]],
    NA_real_
  )

  boundary_lookup <- st_drop_geometry(boundary_info[["boundary"]])
  source[["joined_to_boundary"]] <- source[["GISJOIN"]] %in% boundary_lookup[["GISJOIN"]]
  joined <- source[source[["joined_to_boundary"]], ]
  joined <- joined[match(intersect(boundary_lookup[["GISJOIN"]], joined[["GISJOIN"]]), joined[["GISJOIN"]]), ]
  boundary_match <- boundary_lookup[match(joined[["GISJOIN"]], boundary_lookup[["GISJOIN"]]), ]

  flags <- rep("wave_coverage_differs", nrow(joined))
  if (spec[["year"]] != spec[["boundary_year"]]) {
    flags <- paste(flags, "period_boundary_vintage_differs", sep = ";")
  }

  out <- data.frame(
    gisjoin = joined[["GISJOIN"]],
    year = spec[["year"]],
    boundary_year = spec[["boundary_year"]],
    area_name = boundary_match[["AREA_NAME"]],
    source_area_name = joined[["AREANAME"]],
    state_name = joined[["STATE"]],
    state_code = joined[["STATEA"]],
    county_name = joined[["COUNTY"]],
    county_code = joined[["COUNTYA"]],
    population_total = joined[["population_total"]],
    population_reference_year = spec[["population_reference_year"]],
    church_or_edifice_count = joined[["church_or_edifice_count"]],
    church_count_basis = if (is.null(spec[["place_count_basis"]])) NA_character_ else spec[["place_count_basis"]],
    church_seating_count = joined[["church_seating_count"]],
    church_seating_per_100_population = round(joined[["church_seating_per_100_population"]], 4),
    churches_or_edifices_per_10000_residents = round(joined[["churches_or_edifices_per_10000_residents"]], 4),
    church_property_value = joined[["church_property_value"]],
    member_count = joined[["member_count"]],
    members_per_100_population = round(joined[["members_per_100_population"]], 4),
    land_area_sq_km = round(boundary_match[["LAND_AREA_SQ_KM"]], 2),
    quality_flag = flags,
    stringsAsFactors = FALSE
  )

  extract_path <- file.path(src_dir, sprintf("us_nhgis_county_%s_extract.csv", spec[["year"]]))
  write.csv(out, extract_path, row.names = FALSE, na = "")

  list(source = source, joined = out, extract_path = extract_path)
}

# convert one derived extract into the shared area-summary row contract.
build_area_rows <- function(spec, extract) {
  rows <- lapply(seq_len(nrow(extract)), function(index) {
    row <- extract[index, ]
    source_ids <- c(
      sprintf("nhgis-%s-%s-county", spec[["nhgis_id"]], spec[["year"]]),
      sprintf("nhgis-shapefile-us-county-%s-tl2008", spec[["boundary_year"]])
    )
    list(
      country_code = "US",
      boundary_set_id = sprintf("us-county-%s-tl2008", spec[["boundary_year"]]),
      boundary_level = sprintf("county_%s", spec[["boundary_year"]]),
      area_unit_id = paste0(sprintf("us-county-%s-tl2008:", spec[["boundary_year"]]), row[["gisjoin"]]),
      area_code = row[["gisjoin"]],
      area_name = row[["area_name"]],
      year = spec[["year"]],
      population_total = json_number(row[["population_total"]]),
      population_total_basis = spec[["population_basis"]],
      religious_affiliation_count = if (is.finite(row[["member_count"]])) {
        json_number(row[["member_count"]])
      } else {
        json_number(row[["church_seating_count"]])
      },
      religious_affiliation_percent = if (is.finite(row[["members_per_100_population"]])) {
        json_number(row[["members_per_100_population"]], 2)
      } else {
        json_number(row[["church_seating_per_100_population"]], 2)
      },
      no_religion_count = NULL,
      no_religion_percent = NULL,
      place_count = json_number(row[["church_or_edifice_count"]]),
      places_per_10000_residents = json_number(row[["churches_or_edifices_per_10000_residents"]], 2),
      place_density_per_sq_km = NULL,
      land_area_sq_km = json_number(row[["land_area_sq_km"]], 2),
      site_snapshot_date = NULL,
      place_count_basis = if (is.finite(row[["church_or_edifice_count"]])) spec[["place_count_basis"]] else NULL,
      quality_flag = row[["quality_flag"]],
      source_dataset_ids = source_ids
    )
  })
  rows
}

# flatten area-summary rows for the csv sibling.
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
      population_total = if (is.null(row[["population_total"]])) NA else row[["population_total"]],
      population_total_basis = row[["population_total_basis"]],
      religious_affiliation_count = if (is.null(row[["religious_affiliation_count"]])) NA else row[["religious_affiliation_count"]],
      religious_affiliation_percent = if (is.null(row[["religious_affiliation_percent"]])) NA else row[["religious_affiliation_percent"]],
      no_religion_count = NA,
      no_religion_percent = if (is.null(row[["no_religion_percent"]])) NA else row[["no_religion_percent"]],
      place_count = if (is.null(row[["place_count"]])) NA else row[["place_count"]],
      places_per_10000_residents = if (is.null(row[["places_per_10000_residents"]])) NA else row[["places_per_10000_residents"]],
      place_density_per_sq_km = NA,
      land_area_sq_km = if (is.null(row[["land_area_sq_km"]])) NA else row[["land_area_sq_km"]],
      site_snapshot_date = NA,
      place_count_basis = if (is.null(row[["place_count_basis"]])) NA else row[["place_count_basis"]],
      source_dataset_ids = paste(row[["source_dataset_ids"]], collapse = "|"),
      quality_flag = row[["quality_flag"]],
      stringsAsFactors = FALSE
    )
  }))
}

# compare county sums with NHGIS state and optional nation totals.
validate_wave <- function(spec, source) {
  state_path <- csv_path(validation_csv_dir, spec[["nhgis_id"]], spec[["year"]], "state")
  state_rows <- read_nhgis_csv(state_path)
  metrics <- spec[["validation_metrics"]]
  county_states <- split(seq_len(nrow(source)), source[["STATEA"]])
  county_state_sums <- do.call(rbind, lapply(names(county_states), function(state_code) {
    index <- county_states[[state_code]]
    values <- setNames(lapply(metrics, function(column_name) {
      sum_or_na(num_col(source[index, ], column_name))
    }), names(metrics))
    data.frame(state_code = state_code, as.data.frame(values), stringsAsFactors = FALSE)
  }))

  state_sums <- data.frame(
    state_code = state_rows[["STATEA"]],
    stringsAsFactors = FALSE
  )
  for (metric_name in names(metrics)) {
    state_sums[[metric_name]] <- num_col(state_rows, metrics[[metric_name]])
  }

  matched <- sort(intersect(county_state_sums[["state_code"]], state_sums[["state_code"]]))
  county_match <- county_state_sums[match(matched, county_state_sums[["state_code"]]), ]
  state_match <- state_sums[match(matched, state_sums[["state_code"]]), ]
  metric_diffs <- setNames(lapply(names(metrics), function(metric_name) {
    county_match[[metric_name]] - state_match[[metric_name]]
  }), names(metrics))
  mismatch <- Reduce(`|`, lapply(metric_diffs, function(diff) abs(diff) > 1e-9))
  mismatch_states <- lapply(which(mismatch), function(index) {
    item <- list(state_code = matched[[index]])
    for (metric_name in names(metrics)) item[[paste0(metric_name, "_diff")]] <- metric_diffs[[metric_name]][[index]]
    item
  })

  nation_result <- NULL
  nation_path <- Sys.glob(file.path(validation_csv_dir, sprintf("*_%s_%s_nation.csv", spec[["nhgis_id"]], spec[["year"]])))
  if (length(nation_path) == 1) {
    nation_rows <- read_nhgis_csv(nation_path)
    nation_values <- setNames(lapply(metrics, function(column_name) {
      sum_or_na(num_col(nation_rows, column_name))
    }), names(metrics))
    county_values <- setNames(lapply(metrics, function(column_name) {
      sum_or_na(num_col(source, column_name))
    }), names(metrics))
    diffs <- setNames(lapply(names(metrics), function(metric_name) {
      county_values[[metric_name]] - nation_values[[metric_name]]
    }), names(metrics))
    nation_result <- list(
      result = if (all(abs(unlist(diffs)) <= 1e-9)) "exact" else "mismatch_against_nation_file",
      county_sums = county_values,
      nation_sums = nation_values,
      differences = diffs
    )
  }

  state_result <- if (!length(mismatch_states) &&
    !length(setdiff(county_state_sums[["state_code"]], state_sums[["state_code"]])) &&
    !length(setdiff(state_sums[["state_code"]], county_state_sums[["state_code"]]))) {
    "exact"
  } else if (!length(mismatch_states)) {
    "matched_states_exact_with_state_file_coverage_difference"
  } else {
    "mismatch_against_state_file"
  }

  list(
    state_validation_source = basename(state_path),
    state_result = state_result,
    matched_state_count = length(matched),
    county_state_count = nrow(county_state_sums),
    validation_state_count = nrow(state_sums),
    missing_in_state_file = sort(setdiff(county_state_sums[["state_code"]], state_sums[["state_code"]])),
    extra_in_state_file = sort(setdiff(state_sums[["state_code"]], county_state_sums[["state_code"]])),
    county_sums_matched_states = setNames(lapply(names(metrics), function(metric_name) {
      sum_or_na(county_match[[metric_name]])
    }), names(metrics)),
    state_sums_matched_states = setNames(lapply(names(metrics), function(metric_name) {
      sum_or_na(state_match[[metric_name]])
    }), names(metrics)),
    differences_matched_states = setNames(lapply(names(metrics), function(metric_name) {
      sum_or_na(metric_diffs[[metric_name]])
    }), names(metrics)),
    mismatch_state_count = length(mismatch_states),
    mismatch_states = mismatch_states,
    nation_validation = nation_result
  )
}

# write one summary json/csv pair for a region-map census level.
write_level_summary <- function(level_key, boundary_year, rows, specs_for_level) {
  json_path <- file.path(us_dir, sprintf("area_summary_%s.json", level_key))
  csv_path <- file.path(us_dir, sprintf("area_summary_%s.csv", level_key))
  manifest <- list(
    schema_version = "0.2.0",
    generated_at = stamp,
    generated_by = "scripts/build_us_nhgis_deep_past.R",
    country_code = "US",
    boundary_set = list(
      boundary_set_id = sprintf("us-county-%s-tl2008", boundary_year),
      country_code = "US",
      level = level_key,
      vintage = as.character(boundary_year),
      source_dataset_id = sprintf("nhgis-shapefile-us-county-%s-tl2008", boundary_year)
    ),
    source = list(
      provider = "IPUMS NHGIS, University of Minnesota",
      citation = nhgis_citation,
      short_citation = nhgis_short_citation,
      licence_position = jb_licence_position
    ),
    indicators = list(
      "population_total",
      "church_seating_per_100_population",
      "churches_or_edifices_per_10000_residents",
      "members_per_100_population"
    ),
    notes = "Rows contain derived rates/counts only. The shared map's religious_affiliation_percent metric slot displays church seating per 100 population for 1850-1890, members per 100 population for 1906-1936, and adherents per 100 population for 1952-2020; the US page labels the construct shift explicitly.",
    waves = lapply(specs_for_level, function(spec) spec[["year"]]),
    rows = rows
  )
  write_json(manifest, json_path, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
  flat <- flatten_rows(rows)
  write.csv(flat, csv_path, row.names = FALSE, na = "")
  list(json_path = json_path, csv_path = csv_path, row_count = length(rows), csv_row_count = nrow(flat))
}

wave_specs <- list(
  list(
    year = 1850, boundary_year = 1850, dataset_code = "1850_cPAX", nhgis_id = "ds10",
    dataset_name = "1850 Census: Population, Agriculture & Other Data [US, States & Counties]",
    population_col = "ADQ001", population_reference_year = 1850,
    population_basis = "1850 total county population from NHGIS table NT1 (ADQ001).",
    place_col = "AEX001", seating_col = "AEY001", property_col = "AEZ001", member_col = NULL,
    place_count_basis = "total number of churches from NHGIS table NT50 (AEX001)",
    validation_metrics = c(population = "ADQ001", churches_or_edifices = "AEX001", seating = "AEY001", property_value = "AEZ001"),
    tables = list(
      list(source_code = "NT1", nhgis_code = "ADQ", description = "Total Population", role = "population", variables = "ADQ001"),
      list(source_code = "NT47", nhgis_code = "AET", description = "Churches by Denomination", role = "denomination_detail", variables = "AET001-AET023"),
      list(source_code = "NT48", nhgis_code = "AEU", description = "Aggregate Accommodations of Churches by Denomination", role = "denomination_detail", variables = "AEU001-AEU023"),
      list(source_code = "NT49", nhgis_code = "AEV", description = "Value of Church Property by Denomination", role = "denomination_detail", variables = "AEV001-AEV023"),
      list(source_code = "NT50", nhgis_code = "AEX", description = "Total Number of Churches", role = "map_count", variables = "AEX001"),
      list(source_code = "NT51", nhgis_code = "AEY", description = "Total Aggregate Accommodations of Churches", role = "map_rate", variables = "AEY001"),
      list(source_code = "NT52", nhgis_code = "AEZ", description = "Total Value of Church Property", role = "validation", variables = "AEZ001")
    )
  ),
  list(
    year = 1860, boundary_year = 1860, dataset_code = "1860_cPAX", nhgis_id = "ds14",
    dataset_name = "1860 Census: Population, Agriculture & Other Data [US, States & Counties]",
    population_col = "AG3001", population_reference_year = 1860,
    population_basis = "1860 total county population from NHGIS table NT1 (AG3001).",
    place_col = "AHS001", seating_col = "AHT001", property_col = "AHU001", member_col = NULL,
    place_count_basis = "total churches from NHGIS table NT32 (AHS001)",
    validation_metrics = c(population = "AG3001", churches_or_edifices = "AHS001", seating = "AHT001", property_value = "AHU001"),
    tables = list(
      list(source_code = "NT1", nhgis_code = "AG3", description = "Total Population", role = "population", variables = "AG3001"),
      list(source_code = "NT26", nhgis_code = "AHL", description = "Churches by Denomination", role = "denomination_detail", variables = "AHL001-AHL022"),
      list(source_code = "NT28", nhgis_code = "AHN", description = "Aggregate Accommodations of Churches by Denomination", role = "denomination_detail", variables = "AHN001-AHN022"),
      list(source_code = "NT30", nhgis_code = "AHQ", description = "Value of Church Property by Denomination", role = "denomination_detail", variables = "AHQ001-AHQ022"),
      list(source_code = "NT32", nhgis_code = "AHS", description = "Total Churches", role = "map_count", variables = "AHS001"),
      list(source_code = "NT33", nhgis_code = "AHT", description = "Total Aggregate Accommodations of Churches", role = "map_rate", variables = "AHT001"),
      list(source_code = "NT34", nhgis_code = "AHU", description = "Total Value of Church Property", role = "validation", variables = "AHU001")
    )
  ),
  list(
    year = 1870, boundary_year = 1870, dataset_code = "1870_cPAX", nhgis_id = "ds17",
    dataset_name = "1870 Census: Population, Agriculture & Other Data [US, States & Counties]",
    population_col = "AJ3001", population_reference_year = 1870,
    population_basis = "1870 total county population from NHGIS table NT1 (AJ3001).",
    place_col = "AK8001", seating_col = "AK9001", property_col = "ALA001", member_col = NULL,
    place_count_basis = "total religious edifices from NHGIS table NT44 (AK8001)",
    validation_metrics = c(population = "AJ3001", religious_organisations = "AK7001", churches_or_edifices = "AK8001", seating = "AK9001", property_value = "ALA001"),
    tables = list(
      list(source_code = "NT1", nhgis_code = "AJ3", description = "Total Population", role = "population", variables = "AJ3001"),
      list(source_code = "NT41", nhgis_code = "AK5", description = "Religious Organizations by Denomination", role = "denomination_detail", variables = "AK5001-AK5019"),
      list(source_code = "NT42", nhgis_code = "AK6", description = "Religious Sittings by Denomination", role = "denomination_detail", variables = "AK6001-AK6019"),
      list(source_code = "NT43", nhgis_code = "AK7", description = "Total Religious Organizations of All Denominations", role = "validation", variables = "AK7001"),
      list(source_code = "NT44", nhgis_code = "AK8", description = "Total Religious Edifices of All Denominations", role = "map_count", variables = "AK8001"),
      list(source_code = "NT45", nhgis_code = "AK9", description = "Total Religious Sittings of All Denominations", role = "map_rate", variables = "AK9001"),
      list(source_code = "NT46", nhgis_code = "ALA", description = "Value of Property of all Denominations", role = "validation", variables = "ALA001")
    )
  ),
  list(
    year = 1890, boundary_year = 1890, dataset_code = "1890_cRelig", nhgis_id = "ds28",
    dataset_name = "1890 Census: Religious Bodies Data [US, States & Counties]",
    population_col = "AV4001", population_reference_year = 1890,
    population_basis = "1890 total county population from NHGIS table NT1 (AV4001).",
    place_col = "AWF001", seating_col = "AWG001", property_col = "AV6001", member_col = NULL,
    place_count_basis = "total church edifices from NHGIS table NT8 (AWF001)",
    validation_metrics = c(population = "AV4001", church_organisations = "AWE001", churches_or_edifices = "AWF001", seating = "AWG001", property_value = "AV6001", members = "AV7001"),
    tables = list(
      list(source_code = "NT1", nhgis_code = "AV4", description = "Total Population", role = "population", variables = "AV4001"),
      list(source_code = "NT3", nhgis_code = "AWA", description = "Number of Church Edifices by Type of Church Organization", role = "denomination_detail", variables = "AWA001-AWA060"),
      list(source_code = "NT4", nhgis_code = "AWB", description = "Approximate Seating Capacity of Churches by Type of Church Organization", role = "denomination_detail", variables = "AWB001-AWB060"),
      list(source_code = "NT5", nhgis_code = "AWC", description = "Value of Church Property by Type of Church Organization", role = "denomination_detail", variables = "AWC001-AWC060"),
      list(source_code = "NT7", nhgis_code = "AWE", description = "Total Number of Church Organizations", role = "validation", variables = "AWE001"),
      list(source_code = "NT8", nhgis_code = "AWF", description = "Total Number of Church Edifices", role = "map_count", variables = "AWF001"),
      list(source_code = "NT9", nhgis_code = "AWG", description = "Approximate Seating Capacity of All Churches", role = "map_rate", variables = "AWG001"),
      list(source_code = "NT11", nhgis_code = "AV6", description = "Value of All Church Property", role = "validation", variables = "AV6001"),
      list(source_code = "NT12", nhgis_code = "AV7", description = "Total Number of Church Communicants or Members", role = "not_mapped", variables = "AV7001")
    )
  ),
  list(
    year = 1906, boundary_year = 1930, dataset_code = "1906_cRelig", nhgis_id = "ds33",
    dataset_name = "1906 Census of Religious Bodies: Religious Bodies Data [States & Counties]",
    population_col = "AZ8002", population_reference_year = 1910,
    population_basis = "1910 county population supplied by NHGIS table NT1 (AZ8002) for the 1906 Census of Religious Bodies.",
    place_col = NULL, seating_col = NULL, property_col = NULL, member_col = "A0A001",
    place_count_basis = NULL,
    validation_metrics = c(population = "AZ8002", members = "A0A001"),
    tables = list(
      list(source_code = "NT1", nhgis_code = "AZ8", description = "Population in Census Years", role = "population", variables = "AZ8001-AZ8002"),
      list(source_code = "NT2", nhgis_code = "AZ9", description = "Number of Members by Churches", role = "denomination_detail", variables = "AZ9001-AZ9092"),
      list(source_code = "NT3", nhgis_code = "A0A", description = "Members of All Denominations, 1906", role = "map_rate", variables = "A0A001")
    )
  ),
  list(
    year = 1916, boundary_year = 1930, dataset_code = "1916_cRelig", nhgis_id = "ds41",
    dataset_name = "1916 Census of Religious Bodies: Religious Bodies Data [States & Counties]",
    population_col = "A7F002", population_reference_year = 1920,
    population_basis = "1920 county population supplied by NHGIS table NT1 (A7F002) for the 1916 Census of Religious Bodies.",
    place_col = NULL, seating_col = NULL, property_col = NULL, member_col = "A7H001",
    place_count_basis = NULL,
    validation_metrics = c(population = "A7F002", members = "A7H001"),
    tables = list(
      list(source_code = "NT1", nhgis_code = "A7F", description = "Population in Census Years", role = "population", variables = "A7F001-A7F002"),
      list(source_code = "NT2", nhgis_code = "A7G", description = "Number of Members by Churches", role = "denomination_detail", variables = "A7G001-A7G109"),
      list(source_code = "NT3", nhgis_code = "A7H", description = "Members of All Denominations, 1916", role = "map_rate", variables = "A7H001")
    )
  ),
  list(
    year = 1926, boundary_year = 1930, dataset_code = "1926_cRelig", nhgis_id = "ds51",
    dataset_name = "1926 Census of Religious Bodies: Religious Bodies Data [States & Counties]",
    population_col = "BCU002", population_reference_year = 1930,
    population_basis = "1930 county population supplied by NHGIS table NT1 (BCU002) for the 1926 Census of Religious Bodies.",
    place_col = NULL, seating_col = NULL, property_col = NULL, member_col = "BCW001",
    place_count_basis = NULL,
    validation_metrics = c(population = "BCU002", members = "BCW001"),
    tables = list(
      list(source_code = "NT1", nhgis_code = "BCU", description = "Population in Census Years", role = "population", variables = "BCU001-BCU002"),
      list(source_code = "NT2", nhgis_code = "BCV", description = "Number of Members by Churches", role = "denomination_detail", variables = "BCV001-BCV082"),
      list(source_code = "NT3", nhgis_code = "BCW", description = "Members of All Denominations, 1926", role = "map_rate", variables = "BCW001")
    )
  ),
  list(
    year = 1936, boundary_year = 1930, dataset_code = "1936_cRelig", nhgis_id = "ds74",
    dataset_name = "1936 Census of Religious Bodies: Religious Bodies Data [States & Counties]",
    population_col = "BTU002", population_reference_year = 1940,
    population_basis = "1940 county population supplied by NHGIS table NT1 (BTU002) for the 1936 Census of Religious Bodies.",
    place_col = NULL, seating_col = NULL, property_col = NULL, member_col = "BTW001",
    place_count_basis = NULL,
    validation_metrics = c(population = "BTU002", members = "BTW001"),
    tables = list(
      list(source_code = "NT1", nhgis_code = "BTU", description = "Population in Census Years", role = "population", variables = "BTU001-BTU002"),
      list(source_code = "NT2", nhgis_code = "BTV", description = "Number of Members by Churches", role = "denomination_detail", variables = "BTV001-BTV074"),
      list(source_code = "NT3", nhgis_code = "BTW", description = "Members of All Denominations, 1936", role = "map_rate", variables = "BTW001")
    )
  )
)

boundary_years <- sort(unique(vapply(wave_specs, function(spec) spec[["boundary_year"]], numeric(1))))
boundary_outputs <- setNames(lapply(boundary_years, write_boundary_geojson), as.character(boundary_years))

wave_outputs <- list()
wave_validation <- list()
rows_by_level <- list()
level_outputs <- list()

for (spec in wave_specs) {
  boundary_info <- boundary_outputs[[as.character(spec[["boundary_year"]])]]
  wave <- build_wave_extract(spec, boundary_info)
  rows <- build_area_rows(spec, wave[["joined"]])
  level_key <- sprintf("county_%s", spec[["boundary_year"]])
  rows_by_level[[level_key]] <- c(rows_by_level[[level_key]], rows)
  validation <- validate_wave(spec, wave[["source"]])

  boundary_codes <- st_drop_geometry(boundary_info[["boundary"]])[["GISJOIN"]]
  source_codes <- wave[["source"]][["GISJOIN"]]
  source_unmatched <- wave[["source"]][!(source_codes %in% boundary_codes), ]
  boundary_without_source <- sort(setdiff(boundary_codes, source_codes))

  wave_validation[[as.character(spec[["year"]])]] <- list(
    year = spec[["year"]],
    dataset_code = spec[["dataset_code"]],
    nhgis_id = spec[["nhgis_id"]],
    table_codes = lapply(spec[["tables"]], function(table) {
      list(source_code = table[["source_code"]], nhgis_code = table[["nhgis_code"]], description = table[["description"]])
    }),
    boundary_vintage = spec[["boundary_year"]],
    boundary_set_id = sprintf("us-county-%s-tl2008", spec[["boundary_year"]]),
    source_rows = nrow(wave[["source"]]),
    source_rows_joined_to_boundary = nrow(wave[["joined"]]),
    boundary_feature_count = length(boundary_codes),
    join_coverage = paste0(nrow(wave[["joined"]]), "/", length(boundary_codes)),
    source_unmatched_count = nrow(source_unmatched),
    source_unmatched_gisjoins = sort(source_unmatched[["GISJOIN"]]),
    boundary_without_source_count = length(boundary_without_source),
    boundary_without_source_gisjoins = boundary_without_source,
    complete_metric_rows = sum(
      is.finite(wave[["joined"]][["population_total"]]) &
        (is.finite(wave[["joined"]][["church_seating_per_100_population"]]) |
          is.finite(wave[["joined"]][["members_per_100_population"]]))
    ),
    all_rows_flagged_wave_coverage_differs = all(grepl("wave_coverage_differs", wave[["joined"]][["quality_flag"]])),
    validation = validation
  )
  wave_outputs[[as.character(spec[["year"]])]] <- wave
  cat(sprintf(
    "%s: %d source rows -> %d boundary rows; join coverage %s\n",
    spec[["year"]], nrow(wave[["source"]]), nrow(wave[["joined"]]),
    wave_validation[[as.character(spec[["year"]])]][["join_coverage"]]
  ))
}

for (level_key in names(rows_by_level)) {
  boundary_year <- as.integer(sub("^county_", "", level_key))
  specs_for_level <- wave_specs[vapply(wave_specs, function(spec) spec[["boundary_year"]] == boundary_year, logical(1))]
  level_outputs[[level_key]] <- write_level_summary(level_key, boundary_year, rows_by_level[[level_key]], specs_for_level)
}

validation_warnings <- unlist(lapply(names(wave_validation), function(year_key) {
  item <- wave_validation[[year_key]]
  warnings <- character(0)
  if (!item[["all_rows_flagged_wave_coverage_differs"]]) {
    warnings <- c(warnings, sprintf("%s has unflagged rows", year_key))
  }
  if (!identical(item[["validation"]][["state_result"]], "exact")) {
    warnings <- c(warnings, sprintf("%s state validation result: %s", year_key, item[["validation"]][["state_result"]]))
  }
  nation_result <- item[["validation"]][["nation_validation"]]
  if (!is.null(nation_result) && !identical(nation_result[["result"]], "exact")) {
    warnings <- c(warnings, sprintf("%s nation validation result: %s", year_key, nation_result[["result"]]))
  }
  if (item[["source_unmatched_count"]] > 0) {
    warnings <- c(warnings, sprintf("%s has %d source rows without the selected period boundary", year_key, item[["source_unmatched_count"]]))
  }
  if (item[["boundary_without_source_count"]] > 0) {
    warnings <- c(warnings, sprintf("%s has %d period-boundary counties without a source row", year_key, item[["boundary_without_source_count"]]))
  }
  warnings
}), use.names = FALSE)

source_datasets <- c(
  lapply(wave_specs, function(spec) {
    list(
      source_dataset_id = sprintf("nhgis-%s-%s-county", spec[["nhgis_id"]], spec[["year"]]),
      name = spec[["dataset_name"]],
      provider = "IPUMS NHGIS, University of Minnesota",
      url = sprintf("https://api.ipums.org/metadata/nhgis/datasets/%s?version=2", spec[["dataset_code"]]),
      documentation_url = "https://www.nhgis.org/documentation/tabular-data",
      retrieval_date = retrieval_date,
      role = "map_source",
      dataset_code = spec[["dataset_code"]],
      nhgis_id = spec[["nhgis_id"]],
      geographic_level = "county",
      table_records = make_table_records(spec),
      citation = nhgis_citation,
      short_citation = nhgis_short_citation,
      licence_position = jb_licence_position,
      source_terms_summary = "NHGIS codebooks state that redistribution requires permission except for subsets published to meet journal requirements; derived rates are published here under JB's 2026-07-06 licence decision pending IPUMS/NHGIS confirmation."
    )
  }),
  lapply(boundary_years, function(boundary_year) {
    list(
      source_dataset_id = sprintf("nhgis-shapefile-us-county-%s-tl2008", boundary_year),
      name = sprintf("NHGIS county boundary shapefile, %s vintage, 2008 TIGER/Line+ basis", boundary_year),
      provider = "IPUMS NHGIS, University of Minnesota",
      url = "https://api.ipums.org/metadata/nhgis/shapefiles?version=2",
      retrieval_date = retrieval_date,
      role = "boundary",
      shapefile_code = sprintf("us_county_%s_tl2008", boundary_year),
      citation = nhgis_citation,
      short_citation = nhgis_short_citation,
      licence_position = jb_licence_position,
      notes = "Selected as a period county boundary; the build does not crosswalk these rows onto 2020 counties."
    )
  })
)

durable_files <- c(
  unlist(lapply(names(level_outputs), function(level_key) {
    item <- level_outputs[[level_key]]
    list(
      durable_file(item[["json_path"]], row_count = item[["row_count"]], content = sprintf("US NHGIS area summary for %s.", level_key)),
      durable_file(item[["csv_path"]], row_count = item[["csv_row_count"]], content = sprintf("Flattened US NHGIS area summary for %s.", level_key))
    )
  }), recursive = FALSE),
  lapply(boundary_outputs, function(item) {
    durable_file(item[["output_path"]], row_count = item[["feature_count"]], content = sprintf("Simplified NHGIS %s county boundary GeoJSON.", item[["year"]]))
  }),
  lapply(wave_outputs, function(item) {
    durable_file(item[["extract_path"]], row_count = nrow(item[["joined"]]), content = "Derived NHGIS county extract with rates/counts only.")
  })
)

raw_files <- list(
  raw_file(file.path(raw_dir, "nhgis0001_csv_PREVIEW.zip"), "NHGIS codebook preview ZIP for county extract 1."),
  raw_file(file.path(raw_dir, "nhgis0001_csv.zip"), "NHGIS county table-data ZIP for extract 1."),
  raw_file(file.path(raw_dir, "nhgis0001_shape.zip"), "NHGIS period-boundary shape ZIP for extract 1."),
  raw_file(file.path(raw_dir, "nhgis0002_csv_PREVIEW.zip"), "NHGIS codebook preview ZIP for validation extract 2."),
  raw_file(file.path(raw_dir, "nhgis0002_csv.zip"), "NHGIS state/nation validation table-data ZIP for extract 2.")
)

stats <- list(
  total_area_rows = sum(vapply(level_outputs, function(item) item[["row_count"]], numeric(1))),
  rows_by_level = setNames(lapply(level_outputs, function(item) item[["row_count"]]), names(level_outputs)),
  rows_by_year = setNames(lapply(wave_validation, function(item) item[["source_rows_joined_to_boundary"]]), names(wave_validation)),
  boundary_features = setNames(lapply(boundary_outputs, function(item) item[["feature_count"]]), paste0("county_", names(boundary_outputs))),
  boundary_geojson_bytes = setNames(lapply(boundary_outputs, function(item) item[["bytes"]]), paste0("county_", names(boundary_outputs))),
  boundary_simplification_tolerance_metres = setNames(lapply(boundary_outputs, function(item) item[["simplify_tolerance_metres"]]), paste0("county_", names(boundary_outputs)))
)

area_hashes <- vapply(level_outputs, function(item) unname(tools::sha256sum(item[["json_path"]])), character(1))
dataset_hash <- substr(unname(tools::sha256sum(level_outputs[[names(level_outputs)[[1]]]][["json_path"]])), 1, 12)
docs_manifest <- list(
  schema_version = "us-nhgis-county-manifest.v1",
  manifest_id = paste0("manifest:us-nhgis-county:us:1850-1936:", dataset_hash),
  dataset_id = "us-nhgis-county:us:1850-1936:public",
  dataset_version_id = paste0("us-nhgis-county:us:1850-1936:public:", dataset_hash),
  manifest_sha256 = NULL,
  dataset_family = "us-nhgis-county",
  dataset_role = "public_product",
  scope = list(
    level = "country",
    country_codes = list("US"),
    snapshot_date = NULL,
    snapshot_anchor = NULL,
    pipeline_stage = "public"
  ),
  created_at = stamp,
  created_by = "scripts/build_us_nhgis_deep_past.R",
  pipeline = list(
    script = "scripts/build_us_nhgis_deep_past.R",
    git_commit = NULL,
    command = "Rscript scripts/build_us_nhgis_deep_past.R",
    parameters = list(
      waves = names(wave_validation),
      boundary_sets = names(rows_by_level),
      shapefile_basis = "2008 TIGER/Line+"
    ),
    software_versions = list(
      r = paste(R.version[["major"]], R.version[["minor"]], sep = "."),
      sf = as.character(packageVersion("sf"))
    )
  ),
  source = list(
    provider = "IPUMS NHGIS, University of Minnesota",
    source_dataset_ids = vapply(source_datasets, function(item) item[["source_dataset_id"]], character(1)),
    source_urls = unique(vapply(source_datasets, function(item) item[["url"]], character(1))),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    citation = nhgis_citation,
    short_citation = nhgis_short_citation,
    licence_position = jb_licence_position,
    licence_position_verbatim_from_playbook = jb_licence_position,
    licence_todo = "JB will write to IPUMS/NHGIS asking whether attributed derived county rates on a research map are within their licence or need permission; record their answer here when it arrives.",
    raw_redistribution = "Raw NHGIS extract ZIPs are not committed or redistributed. They remain in data/raw/us_nhgis/ and await upload to the private raw archive."
  ),
  durable_files = durable_files,
  raw_files = raw_files,
  stats = stats,
  validation = list(
    status = if (length(validation_warnings)) "passed_with_warnings" else "passed",
    commands = list("Rscript scripts/build_us_nhgis_deep_past.R"),
    warnings = as.list(validation_warnings),
    notes = "County sums are validated against NHGIS state totals for every wave. Nineteenth-century waves also validate against NHGIS nation totals where the API exposes the nation geography. The 1906-1936 religious-body datasets expose state and county geographies, not nation geography.",
    waves = wave_validation
  ),
  privacy = "public",
  licence_status = "accepted_by_jb_pending_ipums_confirmation",
  downstream_status = "public",
  source_datasets = source_datasets,
  notes = paste(
    "The build uses matching period county boundaries for 1850, 1860, 1870, and 1890,",
    "and a single 1930 period boundary for 1906, 1916, 1926, and 1936.",
    "No nineteenth-century rows are crosswalked onto 2020 counties.",
    "Every new row carries wave_coverage_differs."
  )
)

docs_manifest_path <- file.path(manifest_dir, "us-nhgis-county-1850-1936.json")
write_json(docs_manifest, docs_manifest_path, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)

sources_rows <- do.call(rbind, c(
  lapply(wave_specs, function(spec) {
    data.frame(
      row_type = "dataset_tables",
      source_dataset_id = sprintf("nhgis-%s-%s-county", spec[["nhgis_id"]], spec[["year"]]),
      dataset_code = spec[["dataset_code"]],
      nhgis_id = spec[["nhgis_id"]],
      year = spec[["year"]],
      geography = "county",
      table_codes = paste(vapply(spec[["tables"]], function(table) table[["source_code"]], character(1)), collapse = "|"),
      nhgis_table_codes = paste(vapply(spec[["tables"]], function(table) table[["nhgis_code"]], character(1)), collapse = "|"),
      shapefile_code = "",
      url = sprintf("https://api.ipums.org/metadata/nhgis/datasets/%s?version=2", spec[["dataset_code"]]),
      retrieval_date = retrieval_date,
      downloaded_zips = "nhgis0001_csv.zip|nhgis0002_csv.zip",
      downloaded_zip_sha256 = paste(raw_files[[2]][["sha256"]], raw_files[[5]][["sha256"]], sep = "|"),
      citation = nhgis_citation,
      licence_position = jb_licence_position,
      notes = spec[["dataset_name"]],
      stringsAsFactors = FALSE
    )
  }),
  lapply(boundary_years, function(boundary_year) {
    data.frame(
      row_type = "shapefile",
      source_dataset_id = sprintf("nhgis-shapefile-us-county-%s-tl2008", boundary_year),
      dataset_code = "",
      nhgis_id = "",
      year = boundary_year,
      geography = "county",
      table_codes = "",
      nhgis_table_codes = "",
      shapefile_code = sprintf("us_county_%s_tl2008", boundary_year),
      url = "https://api.ipums.org/metadata/nhgis/shapefiles?version=2",
      retrieval_date = retrieval_date,
      downloaded_zips = "nhgis0001_shape.zip",
      downloaded_zip_sha256 = raw_files[[3]][["sha256"]],
      citation = nhgis_citation,
      licence_position = jb_licence_position,
      notes = "Period county boundary, 2008 TIGER/Line+ basis.",
      stringsAsFactors = FALSE
    )
  })
))
write.csv(sources_rows, file.path(raw_dir, "sources.csv"), row.names = FALSE, na = "")

flag_assert <- all(vapply(wave_outputs, function(item) {
  all(grepl("wave_coverage_differs", item[["joined"]][["quality_flag"]]))
}, logical(1)))
if (!flag_assert) stop("not all NHGIS rows carry wave_coverage_differs")
if (!file.exists(docs_manifest_path)) stop("manifest was not written")

cat(sprintf("\nwrote %s\n", docs_manifest_path))
cat(sprintf("wrote %d NHGIS area rows across %d waves and %d boundary levels\n",
            stats[["total_area_rows"]], length(wave_specs), length(level_outputs)))
cat("done\n")
