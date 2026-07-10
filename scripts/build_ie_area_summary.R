# build the ireland county-and-city area-summary product from cso pxstat f5051.
# inputs: data/raw/ie_census/cso_pxstat_f5051_religion_county_city_2011_2016_2022.csv
# and data/raw/ie_census/tailte_administrative_areas_2019.geojson.
# outputs: apps/regions/ie/data/county_city_2019.geojson,
# apps/regions/ie/data/area_summary_county_city.{json,csv}, and
# docs/manifests/ie-census-religion-2011-2022.json.
# run from the repo root: Rscript scripts/build_ie_area_summary.R

suppressMessages({
  library(sf)
  library(jsonlite)
})

raw_dir <- "data/raw/ie_census"
ie_dir <- "apps/regions/ie/data"
manifest_dir <- "docs/manifests"
dir.create(ie_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- "2026-07-07"
census_dataset_id <- "cso-pxstat-f5051-county-city-2011-2022"
boundary_dataset_id <- "tailte-administrative-areas-2019"
boundary_set_id <- "ie-county-city-2019-derived"

f5051_path <- file.path(raw_dir, "cso_pxstat_f5051_religion_county_city_2011_2016_2022.csv")
boundary_raw_path <- file.path(raw_dir, "tailte_administrative_areas_2019.geojson")
table09_path <- file.path(raw_dir, "cso_census_1926_volume3_table09_counties_1861_1926.pdf")

boundary_out <- file.path(ie_dir, "county_city_2019.geojson")
summary_json_out <- file.path(ie_dir, "area_summary_county_city.json")
summary_csv_out <- file.path(ie_dir, "area_summary_county_city.csv")
manifest_out <- file.path(manifest_dir, "ie-census-religion-2011-2022.json")

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
  unname(file.info(path)[["size"]])
}

# return a compact row count for csv and geojson manifest records.
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

# normalise Tailte local-authority names to the CSO F5051 reporting units.
normalise_boundary_name <- function(name) {
  name_map <- c(
    "DUBLIN CITY COUNCIL" = "Dublin City",
    "CORK CITY COUNCIL" = "Cork City and Cork County",
    "CORK COUNTY COUNCIL" = "Cork City and Cork County",
    "GALWAY CITY COUNCIL" = "Galway City",
    "GALWAY COUNTY COUNCIL" = "Galway County",
    "LIMERICK CITY AND COUNTY COUNCIL" = "Limerick City and County",
    "WATERFORD CITY AND COUNTY COUNCIL" = "Waterford City and County",
    "DUN LAOGHAIRE-RATHDOWN COUNTY COUNCIL" = "Dún Laoghaire-Rathdown",
    "FINGAL COUNTY COUNCIL" = "Fingal",
    "SOUTH DUBLIN COUNTY COUNCIL" = "South Dublin"
  )
  if (name %in% names(name_map)) return(unname(name_map[[name]]))
  tools::toTitleCase(tolower(sub(" COUNTY COUNCIL$", "", name)))
}

# return the first matching count for one year/area/religion tuple.
lookup_value <- function(rows, year, area_name, religion_label) {
  hit <- rows[rows[["year"]] == year &
                rows[["area_name"]] == area_name &
                rows[["religion"]] == religion_label, , drop = FALSE]
  if (nrow(hit) != 1) {
    stop(sprintf(
      "expected one row for %s / %s / %s; found %d",
      year, area_name, religion_label, nrow(hit)
    ), call. = FALSE)
  }
  hit[["value"]][[1]]
}

# build one area-summary row from CSO values and boundary metadata.
build_area_row <- function(area, year, census_rows, boundary_lookup) {
  area_name <- area[["area_name"]]
  total <- lookup_value(census_rows, year, area_name, "All religions")
  no_religion <- lookup_value(census_rows, year, area_name, "No religion")
  not_stated <- lookup_value(census_rows, year, area_name, "Not stated")
  stated <- total - not_stated
  affiliated <- stated - no_religion
  pct_affiliated <- if (stated > 0) round(100 * affiliated / stated, 2) else NA_real_
  pct_no_religion <- if (stated > 0) round(100 * no_religion / stated, 2) else NA_real_

  boundary_match <- boundary_lookup[match(area_name, boundary_lookup[["area_name"]]), ]
  if (nrow(boundary_match) != 1 || is.na(boundary_match[["land_area_sq_km"]][[1]])) {
    stop("missing boundary metadata for ", area_name, call. = FALSE)
  }

  list(
    country_code = "IE",
    boundary_set_id = boundary_set_id,
    boundary_level = "county_city",
    area_unit_id = paste0(boundary_set_id, ":", area[["area_code"]]),
    area_code = area[["area_code"]],
    area_name = area_name,
    year = year,
    population_total = as.integer(stated),
    population_total_basis = "population usually resident and present in the State with a stated religion response (All religions minus Not stated)",
    religious_affiliation_count = as.integer(affiliated),
    religious_affiliation_percent = pct_affiliated,
    no_religion_count = as.integer(no_religion),
    no_religion_percent = pct_no_religion,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(boundary_match[["land_area_sq_km"]][[1]], 2),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = c(census_dataset_id, boundary_dataset_id),
    quality_flag = if (area_name == "Cork City and Cork County") {
      "cork_city_and_county_boundary_dissolved_from_two_tailte_features"
    } else {
      ""
    }
  )
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
      population_total = row[["population_total"]],
      population_total_basis = row[["population_total_basis"]],
      religious_affiliation_count = row[["religious_affiliation_count"]],
      religious_affiliation_percent = row[["religious_affiliation_percent"]],
      no_religion_count = row[["no_religion_count"]],
      no_religion_percent = row[["no_religion_percent"]],
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

# create a manifest durable-file record for one generated output.
manifest_file_record <- function(path, content, licence_status = "accepted", licence_basis = "open_cc_by_4_0_with_attribution") {
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

# compare county-and-city area totals with the CSO state row for each year.
validate_against_state <- function(census_rows, area_rows, years) {
  lapply(years, function(year) {
    state_rows <- census_rows[census_rows[["year"]] == year & census_rows[["area_name"]] == "State", ]
    area_year <- area_rows[area_rows[["year"]] == year, , drop = FALSE]
    state_total <- state_rows[["value"]][match("All religions", state_rows[["religion"]])]
    state_no_religion <- state_rows[["value"]][match("No religion", state_rows[["religion"]])]
    state_not_stated <- state_rows[["value"]][match("Not stated", state_rows[["religion"]])]
    state_stated <- state_total - state_not_stated
    state_affiliated <- state_stated - state_no_religion

    list(
      year = year,
      area_count = nrow(area_year),
      all_religions_area_sum = sum(area_year[["all_religions"]]),
      all_religions_state = state_total,
      all_religions_difference = sum(area_year[["all_religions"]]) - state_total,
      stated_response_area_sum = sum(area_year[["stated_response"]]),
      stated_response_state = state_stated,
      stated_response_difference = sum(area_year[["stated_response"]]) - state_stated,
      religious_affiliation_area_sum = sum(area_year[["religious_affiliation_count"]]),
      religious_affiliation_state = state_affiliated,
      religious_affiliation_difference = sum(area_year[["religious_affiliation_count"]]) - state_affiliated,
      no_religion_area_sum = sum(area_year[["no_religion_count"]]),
      no_religion_state = state_no_religion,
      no_religion_difference = sum(area_year[["no_religion_count"]]) - state_no_religion,
      not_stated_area_sum = sum(area_year[["not_stated"]]),
      not_stated_state = state_not_stated,
      not_stated_difference = sum(area_year[["not_stated"]]) - state_not_stated
    )
  })
}

require_file(f5051_path)
require_file(boundary_raw_path)
require_file(table09_path)

raw <- read.csv(f5051_path, stringsAsFactors = FALSE, check.names = FALSE, fileEncoding = "UTF-8-BOM")
census_rows <- data.frame(
  year = as.integer(raw[["Census Year"]]),
  sex = raw[["Sex"]],
  religion = raw[["Religion"]],
  area_code = raw[["C04104V04868"]],
  area_name = raw[["County and City"]],
  value = as.integer(raw[["VALUE"]]),
  stringsAsFactors = FALSE
)
census_rows <- census_rows[census_rows[["sex"]] == "Both sexes", ]
years <- sort(unique(census_rows[["year"]]))
if (!identical(years, c(2011L, 2016L, 2022L))) stop("unexpected F5051 years", call. = FALSE)

areas <- unique(census_rows[census_rows[["area_name"]] != "State", c("area_code", "area_name")])
areas <- areas[order(areas[["area_name"]]), ]
if (nrow(areas) != 30) stop("expected 30 F5051 county-and-city areas", call. = FALSE)

area_validation_rows <- do.call(rbind, lapply(seq_len(nrow(areas)), function(index) {
  do.call(rbind, lapply(years, function(year) {
    area_name <- areas[["area_name"]][[index]]
    total <- lookup_value(census_rows, year, area_name, "All religions")
    no_religion <- lookup_value(census_rows, year, area_name, "No religion")
    not_stated <- lookup_value(census_rows, year, area_name, "Not stated")
    stated <- total - not_stated
    data.frame(
      area_name = area_name,
      year = year,
      all_religions = total,
      stated_response = stated,
      religious_affiliation_count = stated - no_religion,
      no_religion_count = no_religion,
      not_stated = not_stated,
      stringsAsFactors = FALSE
    )
  }))
}))

boundary <- st_read(boundary_raw_path, quiet = TRUE)
boundary[["area_name"]] <- vapply(boundary[["ENGLISH"]], normalise_boundary_name, character(1))
boundary[["source_boundary_guids"]] <- boundary[["GUID"]]
boundary[["land_area_sq_km"]] <- as.numeric(boundary[["AREA"]]) / 1e6
boundary[["area_code"]] <- areas[["area_code"]][match(boundary[["area_name"]], areas[["area_name"]])]
if (any(is.na(boundary[["area_code"]]))) {
  stop("boundary names without F5051 match: ",
       paste(boundary[["ENGLISH"]][is.na(boundary[["area_code"]])], collapse = ", "),
       call. = FALSE)
}

# dissolve Cork City and Cork County because F5051 publishes Cork as one unit.
boundary_2157 <- st_transform(boundary, 2157)
boundary_2157 <- st_make_valid(boundary_2157)
groups <- split(seq_len(nrow(boundary_2157)), boundary_2157[["area_name"]])
boundary_dissolved <- do.call(rbind, lapply(names(groups), function(area_name) {
  index <- groups[[area_name]]
  feature <- st_sf(
    area_code = boundary_2157[["area_code"]][index][[1]],
    area_name = area_name,
    area_unit_id = paste0(boundary_set_id, ":", boundary_2157[["area_code"]][index][[1]]),
    boundary_set_id = boundary_set_id,
    boundary_level = "county_city",
    source_boundary_guids = paste(boundary_2157[["GUID"]][index], collapse = "|"),
    land_area_sq_km = sum(boundary_2157[["land_area_sq_km"]][index]),
    geometry = st_union(st_geometry(boundary_2157[index, ]))
  )
  feature
}))
boundary_dissolved <- boundary_dissolved[order(boundary_dissolved[["area_name"]]), ]
boundary_lookup <- st_drop_geometry(boundary_dissolved)[c("area_name", "land_area_sq_km")]

rows <- lapply(seq_len(nrow(areas)), function(index) {
  area <- as.list(areas[index, ])
  lapply(years, build_area_row, area = area, census_rows = census_rows, boundary_lookup = boundary_lookup)
})
rows <- unlist(rows, recursive = FALSE)

source_datasets <- list(
  list(
    source_dataset_id = census_dataset_id,
    name = "F5051: Population usually resident and present in the State by religion, sex, census year and county and city",
    provider = "Central Statistics Office (CSO), Ireland",
    url = "https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/F5051/CSV/1.0/en",
    retrieval_date = retrieval_date,
    local_path = f5051_path,
    licence = list(
      name = "Creative Commons Attribution 4.0 (CC BY 4.0); Government of Ireland copyright",
      url = "https://www.cso.ie/en/aboutus/whoweare/copyrightpolicy/",
      attribution = "Central Statistics Office (CSO), Ireland"
    ),
    citation = "Central Statistics Office (Ireland). PxStat table F5051, population usually resident and present in the State by religion, sex, census year and county and city.",
    access_limits = NULL,
    redistribution_limits = "Reproduction is authorised subject to acknowledgement of the source.",
    notes = "The map uses Both sexes and the 30 county-and-city rows, excluding the State row. Denominator is All religions minus Not stated; No religion remains a separate stated-response category."
  ),
  list(
    source_dataset_id = boundary_dataset_id,
    name = "Administrative Areas - National Statutory Boundaries - 2019",
    provider = "Tailte Éireann",
    url = "https://www.arcgis.com/home/item.html?id=d81188d16e804bde81548e982e80c53e",
    retrieval_date = retrieval_date,
    local_path = boundary_raw_path,
    licence = list(
      name = "Creative Commons Attribution 4.0 (CC BY 4.0)",
      url = "https://creativecommons.org/licenses/by/4.0/",
      attribution = "Tailte Éireann"
    ),
    citation = "Tailte Éireann. Administrative Areas - National Statutory Boundaries - 2019.",
    access_limits = NULL,
    redistribution_limits = "Attribute Tailte Éireann and preserve the generalised-boundary accuracy warning where relevant.",
    notes = "The source has 31 administrative areas. The derived map layer dissolves Cork City Council and Cork County Council because CSO F5051 publishes Cork City and Cork County as one reporting row."
  )
)

indicators <- list(
  list(
    indicator_id = "population_total",
    label = "Religion-response denominator",
    description = "People usually resident and present in the State with a stated religion response in the area and census year.",
    unit = "count",
    denominator_indicator_id = NULL,
    method = "CSO F5051 All religions minus Not stated.",
    temporal_coverage = "2011, 2016, 2022",
    spatial_coverage = "Ireland county-and-city reporting units; Cork City and Cork County are dissolved to match F5051.",
    quality_notes = "This is the stated-response denominator, not the full usually resident and present population."
  ),
  list(
    indicator_id = "religious_affiliation_percent",
    label = "Religious affiliation %",
    description = "Share of the stated-response denominator reporting any stated religion.",
    unit = "percent",
    denominator_indicator_id = "population_total",
    method = "100 * (All religions - Not stated - No religion) / (All religions - Not stated).",
    temporal_coverage = "2011, 2016, 2022",
    spatial_coverage = "Ireland county-and-city reporting units.",
    quality_notes = "Religion labels are CSO source labels; category detail changes across census products outside this broad affiliation/no-religion split."
  ),
  list(
    indicator_id = "no_religion_percent",
    label = "No religion %",
    description = "Share of the stated-response denominator reporting no religion.",
    unit = "percent",
    denominator_indicator_id = "population_total",
    method = "100 * No religion / (All religions - Not stated).",
    temporal_coverage = "2011, 2016, 2022",
    spatial_coverage = "Ireland county-and-city reporting units.",
    quality_notes = "No religion is a stated response in F5051 and is not included in religious affiliation."
  )
)

visual_layers <- list(
  list(
    visual_layer_id = "ie-county-city-religious-affiliation-percent",
    label = "Religious affiliation %",
    description = "County-and-city choropleth of religious-affiliation percentage.",
    layer_type = "choropleth",
    indicator_ids = I(c("religious_affiliation_percent")),
    geometry_unit_type = "area_unit",
    legend = list(unit = "percent", denominator = "stated religion response"),
    colour_scale = "sequential",
    time_control = "year_selector",
    aggregation_rule = "precomputed by county-and-city reporting unit and census year",
    uncertainty_display = "quality_flag",
    default_visibility = TRUE,
    notes = NULL
  ),
  list(
    visual_layer_id = "ie-county-city-no-religion-percent",
    label = "No religion %",
    description = "County-and-city choropleth of no-religion percentage.",
    layer_type = "choropleth",
    indicator_ids = I(c("no_religion_percent")),
    geometry_unit_type = "area_unit",
    legend = list(unit = "percent", denominator = "stated religion response"),
    colour_scale = "sequential",
    time_control = "year_selector",
    aggregation_rule = "precomputed by county-and-city reporting unit and census year",
    uncertainty_display = "quality_flag",
    default_visibility = FALSE,
    notes = NULL
  )
)

summary <- list(
  schema_version = "0.1.0",
  generated_at = stamp,
  generated_by = "scripts/build_ie_area_summary.R",
  country_code = "IE",
  boundary_set = list(
    boundary_set_id = boundary_set_id,
    country_code = "IE",
    level = "county_city",
    vintage = "2019",
    source_dataset_id = boundary_dataset_id
  ),
  site_snapshot = list(
    source_dataset_id = NULL,
    snapshot_date = NULL,
    basis = "no Ireland place-of-worship snapshot is included in this country data-map release",
    notes = "The Ireland page exposes census affiliation, no-religion, and change metrics only; OSM place-density metrics are hidden until a governed Ireland place layer is built."
  ),
  source_datasets = source_datasets,
  indicators = indicators,
  visual_layers = visual_layers,
  rows = rows
)

write(toJSON(summary, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null"), summary_json_out)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

boundary_export <- boundary_dissolved[c(
  "area_code", "area_name", "area_unit_id", "boundary_set_id",
  "boundary_level", "source_boundary_guids", "land_area_sq_km"
)]
tolerances <- c(50, 100, 200, 500)
chosen_tolerance <- NA_real_
for (tolerance in tolerances) {
  candidate <- st_simplify(boundary_export, dTolerance = tolerance, preserveTopology = TRUE)
  candidate <- st_transform(candidate, 4326)
  st_write(candidate, boundary_out, delete_dsn = TRUE, quiet = TRUE)
  if (file_bytes(boundary_out) <= 3 * 1024 * 1024) {
    chosen_tolerance <- tolerance
    break
  }
}
if (is.na(chosen_tolerance)) {
  warning("boundary output remains above 3 MB after maximum simplification")
  chosen_tolerance <- max(tolerances)
}

validation_by_year <- validate_against_state(census_rows, area_validation_rows, years)
for (result in validation_by_year) {
  if (result[["all_religions_difference"]] != 0 ||
      result[["stated_response_difference"]] != 0 ||
      result[["religious_affiliation_difference"]] != 0 ||
      result[["no_religion_difference"]] != 0 ||
      result[["not_stated_difference"]] != 0) {
    stop("state validation failed for ", result[["year"]], call. = FALSE)
  }
}

join_coverage <- lapply(years, function(year) {
  list(
    year = year,
    matched_area_count = sum(vapply(rows, function(row) {
      row[["year"]] == year && !is.null(row[["population_total"]])
    }, logical(1))),
    expected_area_count = nrow(areas),
    missing_area_names = character(0)
  )
})

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:ie-census-religion:ie:2011-2022:pxstat-f5051",
  dataset_id = "ie-census-religion:ie:2011-2022:pxstat-f5051",
  dataset_version_id = paste0("ie-census-religion:ie:2011-2022:pxstat-f5051:", substr(sha256_file(summary_json_out), 1, 12)),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "ie-census-religion",
  dataset_role = "public_product",
  scope = list(
    level = "country",
    country_codes = I(c("IE")),
    snapshot_date = NULL,
    snapshot_anchor = NULL,
    pipeline_stage = "public"
  ),
  created_at = stamp,
  created_by = "scripts/build_ie_area_summary.R",
  pipeline = list(
    script = "scripts/build_ie_area_summary.R",
    git_commit = NULL,
    command = "Rscript scripts/build_ie_area_summary.R",
    parameters = list(
      waves = as.character(years),
      boundary_set = boundary_set_id,
      boundary_simplification_tolerance_m = chosen_tolerance,
      denominator = "All religions minus Not stated"
    ),
    software_versions = list(
      r = paste(R.version[["major"]], R.version[["minor"]], sep = "."),
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite"))
    )
  ),
  source = list(
    provider = "Central Statistics Office (CSO), Ireland; Tailte Éireann",
    source_dataset_ids = c(census_dataset_id, boundary_dataset_id),
    source_urls = c(
      "https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/F5051/CSV/1.0/en",
      "https://www.arcgis.com/home/item.html?id=d81188d16e804bde81548e982e80c53e",
      "https://www.cso.ie/en/aboutus/whoweare/copyrightpolicy/"
    ),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = "CSO statistics are Government of Ireland copyright and licensed under Creative Commons Attribution 4.0; reproduction is authorised subject to acknowledgement of the source. Tailte Éireann open data are licensed under Creative Commons Attribution 4.0.",
    citation = "Central Statistics Office (Ireland), PxStat table F5051; Tailte Éireann, Administrative Areas - National Statutory Boundaries - 2019.",
    raw_redistribution = "Raw CSO CSV, Tailte GeoJSON, and CSO historical PDFs are not committed. They remain in data/raw/ie_census/ and await any project-controlled raw archive upload."
  ),
  input_manifests = list(),
  raw_sources = list(
    list(
      uri = f5051_path,
      format = "csv",
      bytes = file_bytes(f5051_path),
      sha256 = sha256_file(f5051_path),
      row_count = row_count_file(f5051_path),
      notes = "Raw PxStat F5051 CSV API export; includes State row, 30 county-and-city rows, both sexes, male, and female rows for 2011, 2016, and 2022."
    ),
    list(
      uri = boundary_raw_path,
      format = "geojson",
      bytes = file_bytes(boundary_raw_path),
      sha256 = sha256_file(boundary_raw_path),
      row_count = row_count_file(boundary_raw_path),
      notes = "Raw Tailte 2019 administrative areas; 31 source features. Cork City Council and Cork County Council dissolve to match the CSO F5051 reporting unit."
    ),
    list(
      uri = table09_path,
      format = "pdf",
      bytes = file_bytes(table09_path),
      sha256 = sha256_file(table09_path),
      row_count = NA_integer_,
      notes = "Downloaded but not extracted in this release. Census 1926 Volume 3 Table 09 is a 5-page image-only PDF; pdftotext returns only form feeds, so OCR and table QA are required before the 1861-1926 extension."
    )
  ),
  durable_files = list(
    manifest_file_record(summary_json_out, "Ireland county-and-city area summary with CSO F5051 stated-response religion metrics."),
    manifest_file_record(summary_csv_out, "Flattened Ireland county-and-city area summary with CSO F5051 stated-response religion metrics."),
    manifest_file_record(boundary_out, "Simplified Ireland county-and-city boundary GeoJSON derived from Tailte 2019 administrative areas.")
  ),
  derived_outputs = list(
    list(
      uri = paste0("repo:", summary_json_out),
      sha256 = sha256_file(summary_json_out),
      built_by = "scripts/build_ie_area_summary.R",
      notes = "30 county-and-city reporting units x 3 census years; stated-response denominator equals All religions minus Not stated."
    ),
    list(
      uri = paste0("repo:", boundary_out),
      sha256 = sha256_file(boundary_out),
      built_by = "scripts/build_ie_area_summary.R",
      notes = paste0("30 derived features; Cork City and Cork County dissolved; simplified at ", chosen_tolerance, " m tolerance.")
    )
  ),
  validation = list(
    checks = c(
      "F5051 source URL returned CSV and the downloaded file has 6,975 data rows.",
      "Tailte administrative-area source returned 31 raw features; derived boundary has 30 features after Cork dissolve.",
      "For each of 2011, 2016, and 2022, area sums match the CSO State row exactly for All religions, Not stated, stated-response denominator, religious affiliation, and No religion.",
      "Join coverage is 30/30 county-and-city reporting units for every built wave.",
      "Census 1926 Volume 3 Table 09 PDF is downloaded and verified as image-only; OCR extraction is deferred."
    ),
    join_coverage = join_coverage,
    state_validation = validation_by_year,
    boundary_validation = list(
      source_feature_count = nrow(boundary),
      derived_feature_count = row_count_file(boundary_out),
      expected_feature_count = 30,
      cork_source_features_dissolved = c("CORK CITY COUNCIL", "CORK COUNTY COUNCIL"),
      unmapped_boundary_features = character(0),
      unmapped_census_areas = character(0),
      simplified_boundary_bytes = file_bytes(boundary_out),
      simplification_tolerance_m = chosen_tolerance
    )
  ),
  deferred_sources = list(
    list(
      source_dataset_id = "cso-census-1926-volume3-table09-counties-1861-1926",
      url = "https://www.cso.ie/en/media/csoie/census/census1926results/volume3/C_12_1926_V3_T9.pdf",
      local_path = table09_path,
      notes = "Next build route for the deep past. The source title is 'Counties 1861-1926. Number of persons of each religion in each county and county borough in Saorstát Éireann at each census year from 1861'. Extraction requires OCR and a historical county/county-borough concordance before publication."
    )
  )
)

write(toJSON(manifest, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null"), manifest_out)

cat(sprintf("built %d area-summary rows across %d waves\n", length(rows), length(years)))
cat(sprintf("derived boundary: %d features, %s bytes, %sm simplification\n",
            row_count_file(boundary_out), file_bytes(boundary_out), chosen_tolerance))
for (coverage in join_coverage) {
  cat(sprintf("%s join coverage: %d/%d\n",
              coverage[["year"]], coverage[["matched_area_count"]], coverage[["expected_area_count"]]))
}
cat("state validations: exact\n")
