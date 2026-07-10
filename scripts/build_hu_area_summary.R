# build the Hungary county census-affiliation area-summary product.
# inputs: KSH Census Database WBS008 observations and Eurostat GISCO NUTS 3.
# outputs: county area-summary JSON/CSV, a simplified boundary, and a manifest.
# run from the repository root: Rscript scripts/build_hu_area_summary.R

suppressMessages({
  library(digest)
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

raw_dir <- "data/raw/hu_census"
output_dir <- "apps/regions/hu/data"
manifest_dir <- "docs/manifests"
dir.create(raw_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

country_code <- "HU"
years <- c(2001L, 2011L, 2022L)
script_id <- "scripts/build_hu_area_summary.R"
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- format(Sys.Date(), "%Y-%m-%d")
git_commit <- system("git rev-parse --short HEAD", intern = TRUE)
api_version <- "V67"
dataflow_id <- "WBS008"
boundary_level <- "county"
boundary_vintage <- "2021"
boundary_set_id <- "hu-county-2021-gisco-nuts3"
census_dataset_id <- "ksh-census-wbs008-religion-county-2001-2022-v67"
boundary_dataset_id <- "eurostat-gisco-nuts3-2021-hu"
ksh_terms_dataset_id <- "ksh-census-2022-terms"
gisco_terms_dataset_id <- "eurostat-gisco-nuts-download-provisions"

api_base_url <- "https://nepszamlalas2022.ksh.hu"
version_url <- paste0(api_base_url, "/api/version")
index_url <- paste0(api_base_url, "/api/index/", api_version, "/en")
structure_url <- paste0(api_base_url, "/api/structure/", dataflow_id, "/", api_version)
ksh_database_url <- paste0(api_base_url, "/en/database/")
ksh_terms_url <- paste0(api_base_url, "/felhasznalasi-feltetelek")
ksh_religion_visualisation_url <- paste0(api_base_url, "/eredmenyek/vizualizaciok/vallas/")
gisco_boundary_url <- paste0(
  "https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/",
  "NUTS_RG_01M_2021_4326_LEVL_3.geojson"
)
gisco_terms_url <- paste0(
  "https://ec.europa.eu/eurostat/web/gisco/geodata/statistical-units/",
  "territorial-units-statistics"
)
eurostat_copyright_url <- "https://ec.europa.eu/eurostat/help/copyright-notice"

county_codes <- c(
  "HU110", "HU120", "HU211", "HU212", "HU213", "HU221", "HU222",
  "HU223", "HU231", "HU232", "HU233", "HU311", "HU312", "HU313",
  "HU321", "HU322", "HU323", "HU331", "HU332", "HU333"
)
county_selector <- paste(county_codes, collapse = "+")
county_data_url <- paste0(
  api_base_url, "/api/dataflows/", dataflow_id, "/", api_version,
  "/d/TIME_PERIOD,TERUL_GEO3:", county_selector,
  ",TERUL_TELTIP2:HU,VALLAS_V2"
)
national_data_url <- paste0(
  api_base_url, "/api/dataflows/", dataflow_id, "/", api_version,
  "/d/TIME_PERIOD,TERUL_GEO3:HU,TERUL_TELTIP2:HU,VALLAS_V2"
)

version_path <- file.path(raw_dir, "ksh_api_version.json")
index_path <- file.path(raw_dir, paste0("ksh_index_", api_version, "_en.json"))
structure_path <- file.path(raw_dir, paste0("ksh_wbs008_structure_", api_version, ".json"))
county_data_path <- file.path(raw_dir, paste0("ksh_wbs008_county_2001_2022_", api_version, ".json"))
national_data_path <- file.path(raw_dir, paste0("ksh_wbs008_national_2001_2022_", api_version, ".json"))
ksh_terms_path <- file.path(raw_dir, "ksh_census_2022_terms.html")
gisco_boundary_path <- file.path(raw_dir, "gisco_nuts3_2021_4326.geojson")
gisco_terms_path <- file.path(raw_dir, "gisco_nuts_terms.html")
eurostat_copyright_path <- file.path(raw_dir, "eurostat_copyright.html")
summary_json_out <- file.path(output_dir, "area_summary_county.json")
summary_csv_out <- file.path(output_dir, "area_summary_county.csv")
boundary_out <- file.path(output_dir, "hu_county_2021.geojson")
manifest_out <- file.path(manifest_dir, "hu-census-religion-2001-2022.json")

# return a file's SHA-256 digest.
sha256_file <- function(path) unname(tools::sha256sum(path))

# return a file's size in bytes.
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))

# fetch one source and preserve its first successful retrieval timestamp.
fetch_file <- function(url, path) {
  if (file.exists(path) && file_bytes(path) > 0L) return(invisible(path))
  status <- system2("curl", c("-L", "--fail", "--silent", "--show-error", "-o", path, url))
  if (!identical(status, 0L)) stop("curl failed for ", url, call. = FALSE)
  write_json(
    list(url = url, retrieved_at = stamp, http_status = 200L),
    paste0(path, ".meta.json"),
    auto_unbox = TRUE,
    pretty = TRUE
  )
  invisible(path)
}

# read the retrieval metadata sidecar for a cached source.
read_meta <- function(path) {
  meta_path <- paste0(path, ".meta.json")
  if (!file.exists(meta_path)) {
    return(list(retrieved_at = paste0(retrieval_date, "T00:00:00Z"), http_status = NULL))
  }
  fromJSON(meta_path, simplifyVector = FALSE)
}

# return one named codelist from the bilingual SDMX structure message.
structure_codelist <- function(structure, codelist_id) {
  codelists <- structure[["data"]][["codelists"]]
  matches <- which(vapply(codelists, function(x) identical(x[["id"]], codelist_id), logical(1)))
  if (length(matches) != 1L) stop("expected one codelist: ", codelist_id, call. = FALSE)
  codelists[[matches]]
}

# turn one codelist into Hungarian and English code-to-label vectors.
codelist_labels <- function(codelist) {
  codes <- codelist[["codes"]]
  ids <- vapply(codes, function(x) x[["id"]], character(1))
  list(
    hu = setNames(vapply(codes, function(x) x[["names"]][["hu"]], character(1)), ids),
    en = setNames(vapply(codes, function(x) x[["names"]][["en"]], character(1)), ids)
  )
}

# parse one KSH API response into exact integer observation rows.
read_observations <- function(path) {
  rows <- fromJSON(path, simplifyDataFrame = TRUE)
  required <- c("OBS_VALUE", "TIME_PERIOD", "TERUL_GEO3", "TERUL_TELTIP2", "VALLAS_V2")
  if (!is.data.frame(rows) || !all(required %in% names(rows))) {
    stop("KSH observation response changed shape: ", path, call. = FALSE)
  }
  if (any(!grepl("^[0-9]+$", rows[["OBS_VALUE"]]))) {
    stop("KSH response contains a non-integer observation", call. = FALSE)
  }
  rows[["OBS_VALUE"]] <- as.integer(rows[["OBS_VALUE"]])
  rows[["TIME_PERIOD"]] <- as.integer(rows[["TIME_PERIOD"]])
  rows
}

# classify one published religion code for headline aggregation.
category_role <- function(code) {
  if (identical(code, "TOTAL")) return("total")
  if (identical(code, "RE_NOT")) return("no_religion")
  if (identical(code, "RE_NA")) return("no_answer")
  if (code %in% c("RE_RC", "RE_GC")) return("catholic_detail_not_summed")
  "named_religion"
}

# convert one area-year block into a named integer vector.
observation_vector <- function(rows, context) {
  if (anyDuplicated(rows[["VALLAS_V2"]])) stop("duplicate category in ", context, call. = FALSE)
  setNames(rows[["OBS_VALUE"]], rows[["VALLAS_V2"]])
}

# enforce exact within-county and county-to-national reconciliation for one wave.
validate_wave <- function(year, county_rows, national_rows, category_codes, category_labels) {
  wave_county <- county_rows[county_rows[["TIME_PERIOD"]] == year, , drop = FALSE]
  wave_national <- national_rows[national_rows[["TIME_PERIOD"]] == year, , drop = FALSE]
  areas <- sort(unique(wave_county[["TERUL_GEO3"]]))
  source_categories <- sort(unique(wave_national[["VALLAS_V2"]]))
  if (!setequal(areas, county_codes) || length(areas) != 20L) {
    stop("wave ", year, " does not contain 20 counties", call. = FALSE)
  }
  if (!setequal(source_categories, unique(wave_county[["VALLAS_V2"]]))) {
    stop("wave ", year, " county and national categories differ", call. = FALSE)
  }
  if (!all(source_categories %in% category_codes)) {
    stop("wave ", year, " contains an unknown category", call. = FALSE)
  }
  national <- observation_vector(wave_national, paste(year, "national"))
  exclusive_codes <- source_categories[!source_categories %in% c("TOTAL", "RE_RC", "RE_GC")]
  named_codes <- source_categories[
    vapply(source_categories, category_role, character(1)) == "named_religion"
  ]
  area_results <- lapply(areas, function(area_code) {
    area <- observation_vector(
      wave_county[wave_county[["TERUL_GEO3"]] == area_code, , drop = FALSE],
      paste(year, area_code)
    )
    if (!setequal(names(area), source_categories)) {
      stop("incomplete categories for ", year, " ", area_code, call. = FALSE)
    }
    if (sum(area[exclusive_codes]) != area[["TOTAL"]]) {
      stop("category sum differs from total for ", year, " ", area_code, call. = FALSE)
    }
    if (sum(area[named_codes]) != area[["TOTAL"]] - area[["RE_NOT"]] - area[["RE_NA"]]) {
      stop("named-religion sum differs for ", year, " ", area_code, call. = FALSE)
    }
    list(area_code = area_code, values = area)
  })
  category_reconciliation <- lapply(source_categories, function(code) {
    county_sum <- sum(vapply(area_results, function(x) x[["values"]][[code]], integer(1)))
    difference <- county_sum - national[[code]]
    if (difference != 0L) stop("national reconciliation failed for ", year, " ", code, call. = FALSE)
    list(
      source_code = code,
      source_name_hu = unname(category_labels[["hu"]][[code]]),
      source_display_en = unname(category_labels[["en"]][[code]]),
      county_sum = county_sum,
      published_national_total = national[[code]],
      difference = difference,
      status = "matched"
    )
  })
  if (sum(national[exclusive_codes]) != national[["TOTAL"]]) {
    stop("national category sum differs for ", year, call. = FALSE)
  }
  list(
    year = year,
    county_count = length(areas),
    published_category_rows_including_total = length(source_categories),
    mutually_exclusive_categories_excluding_total = length(exclusive_codes),
    named_religion_categories = length(named_codes),
    within_county_category_sums_exact = TRUE,
    county_category_sums_exact = TRUE,
    max_absolute_difference = 0L,
    national_total = national[["TOTAL"]],
    national_no_answer_count = national[["RE_NA"]],
    national_no_answer_percent = round(100 * national[["RE_NA"]] / national[["TOTAL"]], 4),
    category_reconciliation = category_reconciliation
  )
}

# build the 20-county layer from GISCO NUTS 3 2021.
build_boundary <- function(path, county_labels) {
  source <- st_read(path, quiet = TRUE)
  required <- c("NUTS_ID", "LEVL_CODE", "CNTR_CODE")
  if (!all(required %in% names(source))) stop("GISCO fields changed", call. = FALSE)
  source <- source[source[["CNTR_CODE"]] == country_code & source[["LEVL_CODE"]] == 3L, ]
  if (nrow(source) != 20L || !setequal(source[["NUTS_ID"]], county_codes)) {
    stop("expected 20 Hungarian NUTS 3 features", call. = FALSE)
  }
  source <- st_make_valid(source)
  if (any(st_is_empty(source)) || any(!st_is_valid(source))) {
    stop("GISCO Hungary source contains invalid geometry", call. = FALSE)
  }
  source[["area_code"]] <- as.character(source[["NUTS_ID"]])
  source[["area_name"]] <- unname(county_labels[source[["area_code"]]])
  if (any(is.na(source[["area_name"]]))) stop("missing KSH county label", call. = FALSE)
  source[["area_unit_id"]] <- paste(boundary_set_id, source[["area_code"]], sep = ":")
  source[["boundary_set_id"]] <- boundary_set_id
  source[["boundary_level"]] <- boundary_level
  source[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(source, 3035))) / 1e6
  source <- st_transform(source, 4326)
  source[order(source[["area_code"]]), c(
    "area_code", "area_name", "area_unit_id", "boundary_set_id",
    "boundary_level", "land_area_sq_km", "geometry"
  )]
}

# simplify the boundary and enforce valid, distinct feature geometry.
write_boundary <- function(boundary) {
  simplification <- mapshaper_simplify_to_cap(
    boundary,
    boundary_out,
    max_bytes = 1500000,
    keep_percentages = c(100, 75, 50, 25, 15, 10, 7.5, 5, 3, 2, 1),
    clean_option = "allow-overlaps"
  )
  written <- st_read(boundary_out, quiet = TRUE)
  validity <- st_is_valid(written)
  if (nrow(written) != 20L || any(st_is_empty(written)) || any(is.na(validity)) || any(!validity)) {
    stop("simplified boundary did not retain 20 valid features", call. = FALSE)
  }
  if (!setequal(written[["area_code"]], county_codes)) stop("county codes changed", call. = FALSE)
  hashes <- vapply(st_as_binary(st_geometry(written), EWKB = TRUE), function(wkb) {
    digest(wkb, algo = "sha256", serialize = FALSE)
  }, character(1))
  if (length(unique(hashes)) != 20L) stop("county geometry hashes are not distinct", call. = FALSE)
  simplification[["byte_ceiling"]] <- 1500000L
  list(
    layer = written,
    simplification = simplification,
    valid_feature_count = sum(validity),
    geometry_hashes = setNames(as.list(hashes), written[["area_code"]])
  )
}

# build one schema-conforming county-year row with a stated-response denominator.
build_row <- function(year, area_code, county_rows, boundary) {
  source_rows <- county_rows[
    county_rows[["TIME_PERIOD"]] == year & county_rows[["TERUL_GEO3"]] == area_code,
    , drop = FALSE
  ]
  values <- observation_vector(source_rows, paste(year, area_code))
  named_codes <- names(values)[
    vapply(names(values), category_role, character(1)) == "named_religion"
  ]
  population_total <- values[["TOTAL"]]
  no_answer_count <- values[["RE_NA"]]
  stated_response_total <- population_total - no_answer_count
  religious_affiliation_count <- sum(values[named_codes])
  no_religion_count <- values[["RE_NOT"]]
  if (religious_affiliation_count + no_religion_count != stated_response_total) {
    stop("headline counts do not exhaust stated responses", call. = FALSE)
  }
  area <- boundary[boundary[["area_code"]] == area_code, ]
  no_answer_percent <- round(100 * no_answer_count / population_total, 4)
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = area[["area_unit_id"]][[1]],
    area_code = area_code,
    area_name = area[["area_name"]][[1]],
    year = year,
    population_total = population_total,
    population_total_basis = paste(
      "KSH census population total; headline percentages use respondents to the voluntary",
      "religion question (TOTAL minus Nem válaszolt / No answer)."
    ),
    religious_affiliation_count = religious_affiliation_count,
    religious_affiliation_percent = round(100 * religious_affiliation_count / stated_response_total, 4),
    no_religion_count = no_religion_count,
    no_religion_percent = round(100 * no_religion_count / stated_response_total, 4),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(area[["land_area_sq_km"]][[1]], 4),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = as.list(c(census_dataset_id, boundary_dataset_id)),
    quality_flag = paste0(
      "full_enumeration_census_affiliation;voluntary_question;",
      "stated_response_denominator_excludes_no_answer;",
      "source_no_answer_category=Nem válaszolt;",
      "no_answer_share_of_residents_percent=", sprintf("%.4f", no_answer_percent), ";",
      "exact_county_national_reconciliation;current_2021_boundary_frame"
    )
  )
}

# declare the standard census-affiliation indicators.
indicators <- function(comparability_note) {
  temporal <- "KSH population censuses 2001, 2011, and 2022."
  spatial <- "Twenty KSH county rows joined by NUTS 3 code to GISCO NUTS 3 2021."
  list(
    list(
      indicator_id = "population_total",
      label = "Census population",
      description = "Population total in KSH dataflow WBS008 for the county and census wave.",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "Published KSH county total for settlement type Total.",
      temporal_coverage = temporal,
      spatial_coverage = spatial,
      quality_notes = "The voluntary religion question has a separate Nem válaszolt (No answer) category."
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious affiliation among respondents (%)",
      description = "Share of religion-question respondents in a published named-religion category.",
      unit = "percent",
      denominator_indicator_id = NULL,
      method = paste(
        "100 times religious_affiliation_count divided by the sum of religious_affiliation_count and no_religion_count.",
        "Katolikus is counted once; its Roman Catholic and Greek Catholic detail rows are not summed twice."
      ),
      temporal_coverage = temporal,
      spatial_coverage = spatial,
      quality_notes = comparability_note
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "Nem vallásos (%) — No religion among respondents",
      description = "Share of religion-question respondents in KSH category Nem vallásos.",
      unit = "percent",
      denominator_indicator_id = NULL,
      method = "100 times no_religion_count divided by the sum of religious_affiliation_count and no_religion_count.",
      temporal_coverage = temporal,
      spatial_coverage = spatial,
      quality_notes = paste(
        "Nem vallásos and Nem válaszolt remain separate source categories.",
        comparability_note
      )
    )
  )
}

# flatten row objects into the CSV companion shape.
flatten_rows <- function(rows) {
  data.frame(
    country_code = vapply(rows, function(x) x[["country_code"]], character(1)),
    boundary_set_id = vapply(rows, function(x) x[["boundary_set_id"]], character(1)),
    boundary_level = vapply(rows, function(x) x[["boundary_level"]], character(1)),
    area_unit_id = vapply(rows, function(x) x[["area_unit_id"]], character(1)),
    area_code = vapply(rows, function(x) x[["area_code"]], character(1)),
    area_name = vapply(rows, function(x) x[["area_name"]], character(1)),
    year = vapply(rows, function(x) x[["year"]], integer(1)),
    population_total = vapply(rows, function(x) x[["population_total"]], integer(1)),
    population_total_basis = vapply(rows, function(x) x[["population_total_basis"]], character(1)),
    religious_affiliation_count = vapply(rows, function(x) x[["religious_affiliation_count"]], integer(1)),
    religious_affiliation_percent = vapply(rows, function(x) x[["religious_affiliation_percent"]], numeric(1)),
    no_religion_count = vapply(rows, function(x) x[["no_religion_count"]], integer(1)),
    no_religion_percent = vapply(rows, function(x) x[["no_religion_percent"]], numeric(1)),
    place_count = NA_integer_,
    places_per_10000_residents = NA_real_,
    place_density_per_sq_km = NA_real_,
    land_area_sq_km = vapply(rows, function(x) x[["land_area_sq_km"]], numeric(1)),
    site_snapshot_date = NA_character_,
    place_count_basis = NA_character_,
    source_dataset_ids = vapply(
      rows,
      function(x) paste(unlist(x[["source_dataset_ids"]]), collapse = "|"),
      character(1)
    ),
    quality_flag = vapply(rows, function(x) x[["quality_flag"]], character(1)),
    stringsAsFactors = FALSE
  )
}

# return a row or feature count for one generated artefact.
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$", path)) return(nrow(st_read(path, quiet = TRUE)))
  object <- fromJSON(path, simplifyVector = FALSE)
  if (!is.null(object[["rows"]])) return(length(object[["rows"]]))
  NA_integer_
}

# describe one tracked public output in the manifest.
manifest_file_record <- function(path, content) {
  list(
    uri = paste0("repo:", path),
    storage_provider = "other",
    format = tools::file_ext(path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    row_count = row_count_file(path),
    content = content,
    privacy = "public",
    licence_status = "accepted"
  )
}

# describe one raw cached source with URL, retrieval time, and digest.
raw_source_record <- function(path, url, format, source_dataset_id, used, notes) {
  meta <- read_meta(path)
  list(
    uri = path,
    url = url,
    retrieval_date = substr(meta[["retrieved_at"]], 1L, 10L),
    retrieved_at = meta[["retrieved_at"]],
    http_status = meta[["http_status"]],
    format = format,
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    source_dataset_id = source_dataset_id,
    used_in_public_product = used,
    notes = notes
  )
}

# record source labels and faithful English display labels for one wave.
category_mapping <- function(year, source_codes, category_labels) {
  entries <- vapply(source_codes, function(code) {
    paste0(
      code, " ", category_labels[["hu"]][[code]], " => ", category_labels[["en"]][[code]],
      " [product role: ", category_role(code), "; harmonisation: as_published]"
    )
  }, character(1))
  paste0("Category mapping for ", year, ": ", paste(entries, collapse = "; "), ".")
}

# describe the census and boundary datasets used by the product.
source_datasets <- function() {
  list(
    list(
      source_dataset_id = census_dataset_id,
      name = "KSH Census Database WBS008: Population by religion, county and type of settlement",
      provider = "Hungarian Central Statistical Office (KSH)",
      url = county_data_url,
      retrieval_date = retrieval_date,
      local_path = county_data_path,
      licence = list(
        name = "KSH Census 2022 website terms: CC BY 4.0, with section 3.3 database-selection caveat",
        url = ksh_terms_url,
        attribution = "Source: Hungarian Central Statistical Office (KSH)"
      ),
      citation = "KSH Census Database, WBS008, API publication V67, county totals for 2001, 2011, and 2022.",
      access_limits = NULL,
      redistribution_limits = paste(
        "The terms apply CC BY 4.0 to site content and require KSH attribution.",
        "Section 3.3 bars commercial use of individually selected internal-database files but",
        "exempts independently copyrightable works made from them."
      ),
      notes = "The JSON endpoint supplies 20 counties, settlement type Total, and every published religion row for all three waves."
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "Eurostat GISCO NUTS 3 regions 2021, Hungary",
      provider = "Eurostat GISCO",
      url = gisco_boundary_url,
      retrieval_date = retrieval_date,
      local_path = gisco_boundary_path,
      licence = list(
        name = "Eurostat GISCO download provisions and general reuse policy",
        url = gisco_terms_url,
        attribution = "Eurostat GISCO; © EuroGeographics for the administrative boundaries"
      ),
      citation = "Eurostat GISCO, NUTS 3 2021, 1:1 million, EPSG:4326; Hungarian NUTS 3 features.",
      access_limits = NULL,
      redistribution_limits = "Use under GISCO download provisions with source acknowledgement and EuroGeographics administrative-boundary attribution.",
      notes = "The all-Europe GeoJSON is filtered to the 20 Hungarian NUTS 3 codes and simplified."
    )
  )
}

fetch_file(version_url, version_path)
fetch_file(index_url, index_path)
fetch_file(structure_url, structure_path)
fetch_file(county_data_url, county_data_path)
fetch_file(national_data_url, national_data_path)
fetch_file(ksh_terms_url, ksh_terms_path)
fetch_file(gisco_boundary_url, gisco_boundary_path)
fetch_file(gisco_terms_url, gisco_terms_path)
fetch_file(eurostat_copyright_url, eurostat_copyright_path)

version_record <- fromJSON(version_path, simplifyVector = TRUE)
if (!identical(version_record[["version"]], api_version)) {
  stop("KSH API publication changed from ", api_version, call. = FALSE)
}
index_record <- fromJSON(index_path, simplifyVector = FALSE)
index_flows <- index_record[["dataflows"]]
index_match <- which(vapply(index_flows, function(x) identical(x[["id"]], dataflow_id), logical(1)))
if (length(index_match) != 1L) stop("WBS008 is absent from the KSH index", call. = FALSE)

structure <- fromJSON(structure_path, simplifyVector = FALSE)
time_labels <- codelist_labels(structure_codelist(structure, "CL_TIME_PERIOD"))
county_labels <- codelist_labels(structure_codelist(structure, "CL_TERUL_GEO3"))
category_labels <- codelist_labels(structure_codelist(structure, "CL_VALLAS_V2"))
if (!setequal(as.integer(names(time_labels[["en"]])), years)) {
  stop("WBS008 does not announce exactly 2001, 2011, and 2022", call. = FALSE)
}
if (!all(county_codes %in% names(county_labels[["hu"]]))) stop("county codelist changed", call. = FALSE)

county_rows <- read_observations(county_data_path)
national_rows <- read_observations(national_data_path)
if (any(county_rows[["TERUL_TELTIP2"]] != "HU") ||
    any(national_rows[["TERUL_TELTIP2"]] != "HU")) {
  stop("KSH response includes a non-total settlement type", call. = FALSE)
}
if (!setequal(sort(unique(county_rows[["TIME_PERIOD"]])), years) ||
    !setequal(sort(unique(national_rows[["TIME_PERIOD"]])), years)) {
  stop("one or more announced waves are absent", call. = FALSE)
}

all_category_codes <- names(category_labels[["hu"]])
reconciliation <- lapply(
  years,
  validate_wave,
  county_rows = county_rows,
  national_rows = national_rows,
  category_codes = all_category_codes,
  category_labels = category_labels
)
comparability_note <- paste0(
  "The affiliation and no-religion shares are among stated responses. National non-response was ",
  sprintf("%.4f", reconciliation[[1]][["national_no_answer_percent"]]), "% in 2001, ",
  sprintf("%.4f", reconciliation[[2]][["national_no_answer_percent"]]), "% in 2011, and ",
  sprintf("%.4f", reconciliation[[3]][["national_no_answer_percent"]]), "% in 2022. ",
  "The responding share of the population changed substantially across waves; cross-wave share changes may therefore reflect changing respondent composition as well as changing affiliation. ",
  "The change metric compares stated-response shares only."
)
boundary_stability_note <- paste(
  "Geometric stability of Hungarian county boundaries across 2001, 2011, and 2022 was not verified.",
  "The common 2021 boundary join rests on identity of the 20 NUTS 3 codes in KSH WBS008 and GISCO."
)
boundary <- build_boundary(gisco_boundary_path, county_labels[["hu"]])
boundary_result <- write_boundary(boundary)
written_boundary <- boundary_result[["layer"]]
rows <- unlist(lapply(years, function(year) {
  lapply(county_codes, function(area_code) {
    build_row(year, area_code, county_rows, written_boundary)
  })
}), recursive = FALSE)
if (length(rows) != 60L) stop("expected 60 county-year rows", call. = FALSE)

area_summary <- list(
  schema_version = "0.2.0",
  generated_at = stamp,
  generated_by = script_id,
  country_code = country_code,
  boundary_set = list(
    boundary_set_id = boundary_set_id,
    country_code = country_code,
    level = boundary_level,
    vintage = boundary_vintage,
    source_dataset_id = boundary_dataset_id
  ),
  site_snapshot = list(
    source_dataset_id = NULL,
    snapshot_date = NULL,
    basis = "no governed Hungary place-of-worship snapshot is included in this census-affiliation release",
    notes = "The product ships census-affiliation metrics and county geometry only; place-density fields are null."
  ),
  source_datasets = source_datasets(),
  indicators = indicators(comparability_note),
  visual_layers = list(
    list(
      visual_layer_id = "hu-county-religious-affiliation",
      label = "Religious affiliation among respondents (%)",
      description = "Census-affiliation share among religion-question respondents by county for 2001, 2011, and 2022.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "respondents to the voluntary religion question"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "sum mutually exclusive named-religion categories; exclude Nem válaszolt from the denominator",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = paste(
        "The manifest preserves every source category and the Catholic parent/detail relationship.",
        comparability_note
      )
    ),
    list(
      visual_layer_id = "hu-county-no-religion",
      label = "Nem vallásos (%) — No religion among respondents",
      description = "Share of respondents in the published KSH category Nem vallásos.",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "respondents to the voluntary religion question"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "Nem vallásos divided by TOTAL minus Nem válaszolt",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = paste(
        "Nem vallásos and Nem válaszolt remain distinct source categories.",
        comparability_note
      )
    )
  ),
  rows = rows
)
write_json(
  area_summary,
  summary_json_out,
  auto_unbox = TRUE,
  pretty = TRUE,
  null = "null",
  na = "null",
  digits = NA
)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

raw_sources <- list(
  raw_source_record(version_path, version_url, "json", census_dataset_id, TRUE, "KSH API publication pointer; pins V67."),
  raw_source_record(index_path, index_url, "json", census_dataset_id, TRUE, "KSH English API index V67; identifies WBS008 and its dimensions."),
  raw_source_record(structure_path, structure_url, "json", census_dataset_id, TRUE, "Bilingual WBS008 structure with waves, county codes, and religion labels."),
  raw_source_record(county_data_path, county_data_url, "json", census_dataset_id, TRUE, "County observations for three waves, settlement type Total, and every religion row."),
  raw_source_record(national_data_path, national_data_url, "json", census_dataset_id, TRUE, "National observations used for exact reconciliation."),
  raw_source_record(ksh_terms_path, ksh_terms_url, "html", ksh_terms_dataset_id, TRUE, "KSH terms stating CC BY 4.0, attribution, and the database-selection caveat."),
  raw_source_record(gisco_boundary_path, gisco_boundary_url, "geojson", boundary_dataset_id, TRUE, "All-Europe NUTS 3 2021 GeoJSON filtered to Hungary."),
  raw_source_record(gisco_terms_path, gisco_terms_url, "html", gisco_terms_dataset_id, TRUE, "Eurostat GISCO NUTS download page."),
  raw_source_record(eurostat_copyright_path, eurostat_copyright_url, "html", gisco_terms_dataset_id, TRUE, "Eurostat general copyright and statistical-data reuse policy.")
)
wave_category_codes <- lapply(years, function(year) {
  sort(unique(national_rows[national_rows[["TIME_PERIOD"]] == year, "VALLAS_V2"]))
})
names(wave_category_codes) <- as.character(years)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:hu-census-religion:hu:2001-2022:wbs008-v67",
  dataset_id = "hu-census-religion:hu:2001-2022:wbs008-v67",
  dataset_version_id = paste0(
    "hu-census-religion:hu:2001-2022:wbs008-v67:",
    substr(sha256_file(summary_json_out), 1L, 12L)
  ),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "hu-census-religion",
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
    command = paste("Rscript", script_id),
    parameters = list(
      dataflow = dataflow_id,
      api_publication = api_version,
      waves = years,
      geography = "20 KSH county rows (NUTS 3 codes)",
      settlement_type = "HU Total",
      construct = "census affiliation from the voluntary religion question",
      denominator = "stated responses: TOTAL minus Nem válaszolt (No answer)",
      category_rule = "retain all source rows; aggregate Katolikus once and preserve its Roman Catholic and Greek Catholic detail rows",
      boundary_source_vintage = boundary_vintage,
      boundary_simplification = boundary_result[["simplification"]],
      local_cache_hint = "Raw KSH responses, terms, and GISCO geometry are cached under data/raw/hu_census/ and remain git-ignored.",
      retrieval_routes = list(
        list(purpose = "API publication", method = "GET", url = version_url, notes = "Pins V67."),
        list(purpose = "dataflow index", method = "GET", url = index_url, notes = "Identifies WBS008."),
        list(purpose = "bilingual structure", method = "GET", url = structure_url, notes = "Supplies codes and labels."),
        list(purpose = "county observations", method = "GET", url = county_data_url, notes = "All counties, waves, and religion rows."),
        list(purpose = "national reconciliation", method = "GET", url = national_data_url, notes = "Published national rows."),
        list(purpose = "boundary", method = "GET", url = gisco_boundary_url, notes = "NUTS 3 2021 GeoJSON.")
      )
    ),
    software_versions = list(
      r = R.version.string,
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")),
      digest = as.character(packageVersion("digest")),
      mapshaper = "npx mapshaper through scripts/lib/simplify_boundary.R"
    )
  ),
  source = list(
    provider = "Hungarian Central Statistical Office (KSH); Eurostat GISCO",
    source_dataset_ids = list(
      census_dataset_id, boundary_dataset_id, ksh_terms_dataset_id, gisco_terms_dataset_id
    ),
    source_urls = list(
      ksh_database_url, version_url, index_url, structure_url, county_data_url,
      national_data_url, ksh_terms_url, ksh_religion_visualisation_url,
      gisco_boundary_url, gisco_terms_url, eurostat_copyright_url
    ),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = paste(
      "KSH Census 2022 website content is CC BY 4.0 with mandatory KSH attribution;",
      "section 3.3 adds a commercial-use caveat for individually selected internal-database files.",
      "GISCO geometry uses its download provisions with Eurostat GISCO and EuroGeographics attribution."
    ),
    citation = "KSH Census Database WBS008 V67; Eurostat GISCO NUTS 3 2021."
  ),
  input_manifests = list(),
  durable_files = list(
    manifest_file_record(summary_json_out, "Hungary county census-affiliation area summary for 2001, 2011, and 2022."),
    manifest_file_record(summary_csv_out, "Flattened Hungary county census-affiliation rows."),
    manifest_file_record(boundary_out, "Simplified GISCO NUTS 3 2021 Hungary geometry.")
  ),
  raw_sources = raw_sources,
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id, notes = "60 county-year rows."),
    list(uri = paste0("repo:", summary_csv_out), sha256 = sha256_file(summary_csv_out), built_by = script_id, notes = "CSV companion."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out), built_by = script_id, notes = "20 simplified county features.")
  ),
  validation = list(
    status = "passed",
    commands = list(
      "Rscript scripts/build_hu_area_summary.R",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/hu/data/area_summary_county.json",
      "jq empty docs/manifests/hu-census-religion-2001-2022.json"
    ),
    warnings = list(
      "County is the finest complete three-wave KSH religion geography. The settlement map exposes 2011 and 2022 only and four religion shares.",
      "KSH publishes one non-response category, Nem válaszolt (No answer). The product does not invent separate refusal or unknown counts.",
      boundary_stability_note
    ),
    notes = paste(
      "Every mutually exclusive category sum equals the county population total.",
      "Every published row sums exactly from 20 counties to KSH's national row.",
      "All 20 geometries are valid, non-empty, and have distinct SHA-256 WKB hashes."
    ),
    stats = list(
      waves = length(years),
      rows = length(rows),
      counties_per_wave = 20L,
      published_category_rows_per_wave = paste0(
        "2001=", reconciliation[[1]][["published_category_rows_including_total"]],
        ";2011=", reconciliation[[2]][["published_category_rows_including_total"]],
        ";2022=", reconciliation[[3]][["published_category_rows_including_total"]]
      ),
      mutually_exclusive_categories_per_wave = paste0(
        "2001=", reconciliation[[1]][["mutually_exclusive_categories_excluding_total"]],
        ";2011=", reconciliation[[2]][["mutually_exclusive_categories_excluding_total"]],
        ";2022=", reconciliation[[3]][["mutually_exclusive_categories_excluding_total"]]
      ),
      national_2001_no_answer_percent = reconciliation[[1]][["national_no_answer_percent"]],
      national_2011_no_answer_percent = reconciliation[[2]][["national_no_answer_percent"]],
      national_2022_no_answer_count = reconciliation[[3]][["national_no_answer_count"]],
      national_2022_no_answer_percent = reconciliation[[3]][["national_no_answer_percent"]],
      boundary_features = 20L,
      boundary_valid_features = boundary_result[["valid_feature_count"]],
      distinct_geometry_hashes = length(unique(unlist(boundary_result[["geometry_hashes"]]))),
      boundary_bytes = file_bytes(boundary_out),
      summary_json_bytes = file_bytes(summary_json_out),
      summary_csv_bytes = file_bytes(summary_csv_out)
    ),
    reconciliation = reconciliation,
    boundary_validation = list(
      output_feature_count = 20L,
      valid_feature_count = boundary_result[["valid_feature_count"]],
      distinct_geometry_hash_count = length(unique(unlist(boundary_result[["geometry_hashes"]]))),
      geometry_sha256_by_nuts3_code = boundary_result[["geometry_hashes"]],
      source_crs = "EPSG:4326",
      area_calculation_crs = "EPSG:3035",
      output_crs = "EPSG:4326"
    )
  ),
  construct_notes = c(list(
    "The construct is census affiliation from KSH's voluntary religion question. It does not measure belief, practice, attendance, or registered membership.",
    "The headline uses the stated-response denominator because KSH's 2022 religion presentation reports the religious share among respondents. The denominator is TOTAL minus Nem válaszolt (No answer) in every wave.",
    comparability_note,
    "Nem vallásos remains the no-religion category. Nem válaszolt remains a separate non-response category and is excluded from the stated-response denominator.",
    "KSH WBS008 does not publish separate refusal and unknown rows. The product preserves the single published Nem válaszolt category and does not split it or fold it into a residual.",
    "Katolikus is the mutually exclusive Catholic category in the headline sum. Római katolikus and Görögkatolikus are detail rows within Catholic; they remain in validation and mappings and are not summed again.",
    "County is the primary geography because WBS008 supplies every category for 2001, 2011, and 2022. KSH's settlement map supplies 2011 and 2022 only and four religion shares; the district visualisation supplies 2022 only.",
    boundary_stability_note,
    paste0(
      "National no-answer shares are 2001=", sprintf("%.4f", reconciliation[[1]][["national_no_answer_percent"]]),
      "%, 2011=", sprintf("%.4f", reconciliation[[2]][["national_no_answer_percent"]]),
      "%, and 2022=", sprintf("%.4f", reconciliation[[3]][["national_no_answer_percent"]]),
      "%. The 2022 denominator omits 3,852,533 people, or 40.1154% of the census population."
    )
  ), lapply(years, function(year) {
    category_mapping(year, wave_category_codes[[as.character(year)]], category_labels)
  })),
  deferred_sources = list(
    list(
      source = "KSH settlement map (map.ksh.hu/nepszamlalas)",
      status = "extra_level_not_shipped",
      reason = "The map announces settlement religion indicators for 2011 and 2022 only and exposes four shares rather than the full category set."
    ),
    list(
      source = ksh_religion_visualisation_url,
      status = "extra_level_not_shipped",
      reason = "The district visualisation is 2022 only; it establishes the respondent denominator but cannot form a three-wave series."
    )
  ),
  privacy = "public",
  licence_status = "accepted",
  downstream_status = "public",
  source_datasets = source_datasets(),
  notes = "The committed product contains derived county summaries and simplified GISCO geometry only. Hungary UI and hub wiring are outside this build."
)
write_json(
  manifest,
  manifest_out,
  auto_unbox = TRUE,
  pretty = TRUE,
  null = "null",
  na = "null",
  digits = NA
)

cat(sprintf("county endpoint: %s\n", county_data_url))
cat(sprintf("national endpoint: %s\n", national_data_url))
cat(sprintf("waves x geography: %s x 20 counties\n", paste(years, collapse = ", ")))
cat(sprintf(
  "category counts: 2001=%d, 2011=%d, 2022=%d published rows including total\n",
  reconciliation[[1]][["published_category_rows_including_total"]],
  reconciliation[[2]][["published_category_rows_including_total"]],
  reconciliation[[3]][["published_category_rows_including_total"]]
))
cat("denominator: stated responses (TOTAL minus Nem válaszolt / No answer)\n")
cat(sprintf(
  "national no-answer shares: 2001=%.4f%%; 2011=%.4f%%; 2022=%.4f%%\n",
  reconciliation[[1]][["national_no_answer_percent"]],
  reconciliation[[2]][["national_no_answer_percent"]],
  reconciliation[[3]][["national_no_answer_percent"]]
))
cat("comparability gate: passed; change metrics compare stated-response shares only\n")
cat("reconciliation gate: passed; every county and national category sum matched exactly\n")
cat("wave gate: passed; 2001, 2011, and 2022 are present\n")
cat("geometry gate: passed; 20 valid features with 20 distinct SHA-256 WKB hashes\n")
cat("provenance gate: passed; every raw input has URL, retrieval date, and SHA-256\n")
cat(sprintf("wrote %s: %d rows, %d bytes\n", summary_json_out, length(rows), file_bytes(summary_json_out)))
cat(sprintf("wrote %s: %d rows, %d bytes\n", summary_csv_out, row_count_file(summary_csv_out), file_bytes(summary_csv_out)))
cat(sprintf("wrote %s: %d features, %d bytes\n", boundary_out, row_count_file(boundary_out), file_bytes(boundary_out)))
cat(sprintf("wrote %s: %d bytes\n", manifest_out, file_bytes(manifest_out)))
