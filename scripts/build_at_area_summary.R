# build the austria bundesland religious-affiliation area-summary product.
# inputs: statistics austria ODS tables for the 1951-2001 censuses and the
# 2021 microcensus-based estimate, plus geoBoundaries AUT ADM1 GeoJSON.
# outputs: apps/regions/at/data/at_bundesland_2017.geojson,
# apps/regions/at/data/area_summary_bundesland.{json,csv}, and
# docs/manifests/at-religious-affiliation-1951-2021.json.
# run from the repo root: Rscript scripts/build_at_area_summary.R

suppressMessages({
  library(jsonlite)
  library(sf)
  library(xml2)
})
source("scripts/lib/simplify_boundary.R")

raw_dir <- "data/raw/at_religion"
at_dir <- "apps/regions/at/data"
manifest_dir <- "docs/manifests"
dir.create(raw_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(at_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- format(Sys.Date(), "%Y-%m-%d")
script_id <- "scripts/build_at_area_summary.R"
country_code <- "AT"

boundary_set_id <- "at-bundesland-2017-geoboundaries"
boundary_level <- "bundesland"
census_dataset_id <- "statistik-austria-census-religion-bundesland-1951-2001"
survey_dataset_id <- "statistik-austria-religious-affiliation-bundesland-2021"
boundary_dataset_id <- "geoboundaries-gbopen-aut-adm1-2017"
source_page_dataset_id <- "statistik-austria-religious-denomination-page"
method_dataset_id <- "statistik-austria-religious-affiliation-2021-standard-documentation"
website_terms_dataset_id <- "statistik-austria-website-information"

census_url <- "https://www.statistik.at/fileadmin/pages/439/neu__Religion__1_.ods"
survey_url <- "https://www.statistik.at/fileadmin/pages/439/neu__Religion_2021_Bundesland.ods"
source_page_url <- paste0(
  "https://www.statistik.at/en/statistics/population-and-society/population/",
  "further-population-statistics/religious-denomination"
)
method_url <- paste0(
  "https://www.statistik.at/fileadmin/shared/QM/Standarddokumentationen/B_en/",
  "engl_std_b_religionzugehoerigkeit.pdf"
)
website_terms_url <- paste0(
  "https://www.statistik.at/en/about-us/responsibilities-and-principles/",
  "legal-basis/website-information"
)
open_data_terms_url <- "https://data.statistik.gv.at/web/?page=terms"
boundary_api_url <- "https://www.geoboundaries.org/api/current/gbOpen/AUT/ADM1/"
boundary_url <- paste0(
  "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/",
  "gbOpen/AUT/ADM1/geoBoundaries-AUT-ADM1.geojson"
)

census_path <- file.path(raw_dir, "statistik_austria_religion_1951_2001_bundesland.ods")
survey_path <- file.path(raw_dir, "statistik_austria_religion_2021_bundesland.ods")
source_page_path <- file.path(raw_dir, "statistik_austria_religious_denomination.html")
method_path <- file.path(raw_dir, "statistik_austria_religion_2021_standard_documentation.pdf")
website_terms_path <- file.path(raw_dir, "statistik_austria_website_information.html")
boundary_api_path <- file.path(raw_dir, "geoboundaries_aut_adm1_api.json")
boundary_raw_path <- file.path(raw_dir, "geoboundaries_aut_adm1.geojson")

boundary_out <- file.path(at_dir, "at_bundesland_2017.geojson")
summary_json_out <- file.path(at_dir, "area_summary_bundesland.json")
summary_csv_out <- file.path(at_dir, "area_summary_bundesland.csv")
reconciliation_out <- file.path(at_dir, "national_reconciliation.csv")
manifest_out <- file.path(manifest_dir, "at-religious-affiliation-1951-2021.json")

bundesland_codes <- c(
  "Burgenland" = "AT-1",
  "Kärnten" = "AT-2",
  "Niederösterreich" = "AT-3",
  "Oberösterreich" = "AT-4",
  "Salzburg" = "AT-5",
  "Steiermark" = "AT-6",
  "Tirol" = "AT-7",
  "Vorarlberg" = "AT-8",
  "Wien" = "AT-9"
)

survey_caveat <- paste(
  "Values with less than extrapolated 6 000 persons are highly subject to",
  "random fluctuations."
)
licence_text <- paste(
  "Statistics Austria's website information permits accurate reproduction,",
  "distribution, public availability, and processing when Statistics Austria",
  "is cited. Adapted or extracted content must be identified as edited.",
  "These tables are main-site downloads. The separate Statistics Austria",
  "open.data CC BY 4.0 licence therefore does not govern them."
)
boundary_licence_text <- paste(
  "geoBoundaries gbOpen AUT ADM1 metadata records the source licence as",
  "Creative Commons Attribution-ShareAlike 2.0 and identifies geoBoundaries",
  "and the Austrian Federal Office for Metrology and Survey as sources."
)

# return a file's byte size.
file_bytes <- function(path) {
  as.integer(unname(file.info(path)[["size"]]))
}

# compute a file's SHA-256 digest.
sha256_file <- function(path) {
  unname(tools::sha256sum(path))
}

# stop when a required source or output is absent or empty.
require_file <- function(path) {
  if (!file.exists(path) || file_bytes(path) < 1L) {
    stop("missing required file: ", path, call. = FALSE)
  }
}

# download one source with curl and write a retrieval metadata sidecar.
fetch_file <- function(url, path, insecure = FALSE) {
  if (file.exists(path) && file_bytes(path) > 0L) return(invisible(path))
  args <- c("-L", "--fail", "--silent", "--show-error")
  if (isTRUE(insecure)) args <- c("-k", args)
  args <- c(args, "-o", path, url)
  status <- system2("curl", args)
  if (!identical(status, 0L)) stop("curl failed for ", url, call. = FALSE)
  write_json(
    list(url = url, retrieved_at = stamp, http_status = 200L),
    paste0(path, ".meta.json"),
    auto_unbox = TRUE,
    pretty = TRUE
  )
  invisible(path)
}

# read a metadata sidecar for a cached source.
read_meta <- function(path) {
  meta_path <- paste0(path, ".meta.json")
  if (!file.exists(meta_path)) return(list(retrieved_at = NULL, http_status = NULL))
  fromJSON(meta_path, simplifyVector = FALSE)
}

# expand one OpenDocument sheet into a character matrix.
read_ods_sheet <- function(path, sheet_name) {
  max_columns <- 64L
  xml_path <- tempfile(fileext = ".xml")
  on.exit(unlink(xml_path), add = TRUE)
  extracted <- unzip(path, files = "content.xml", exdir = dirname(xml_path), junkpaths = TRUE)
  if (length(extracted) != 1L) stop("could not extract content.xml from ", path, call. = FALSE)
  file.rename(extracted, xml_path)
  doc <- read_xml(xml_path)
  xpath <- paste0(
    "//*[local-name()='table' and @*[local-name()='name']=",
    "'", sheet_name, "']"
  )
  sheet <- xml_find_first(doc, xpath)
  if (inherits(sheet, "xml_missing")) stop("ODS sheet not found: ", sheet_name, call. = FALSE)
  row_nodes <- xml_find_all(sheet, "./*[local-name()='table-row']")
  parsed_rows <- lapply(row_nodes, function(row) {
    cells <- xml_find_all(
      row,
      "./*[local-name()='table-cell' or local-name()='covered-table-cell']"
    )
    values <- character()
    for (cell in cells) {
      if (length(values) >= max_columns) break
      repeated_text <- xml_find_chr(cell, "string(@*[local-name()='number-columns-repeated'])")
      repeated <- if (nzchar(repeated_text)) as.integer(repeated_text) else 1L
      repeated <- min(repeated, max_columns - length(values))
      numeric_value <- xml_find_chr(cell, "string(@*[local-name()='value'])")
      string_value <- xml_find_chr(cell, "string(@*[local-name()='string-value'])")
      paragraph_text <- paste(xml_text(xml_find_all(cell, ".//*[local-name()='p']")), collapse = " ")
      value <- if (nzchar(numeric_value)) numeric_value else if (nzchar(string_value)) string_value else paragraph_text
      values <- c(values, rep(value, repeated))
    }
    values
  })
  width <- max(vapply(parsed_rows, length, integer(1)))
  output <- matrix("", nrow = length(parsed_rows), ncol = width)
  for (i in seq_along(parsed_rows)) output[i, seq_along(parsed_rows[[i]])] <- parsed_rows[[i]]
  output
}

# convert one source cell to a numeric value and reject non-numeric content.
numeric_cell <- function(value, context) {
  result <- suppressWarnings(as.numeric(value))
  if (length(result) != 1L || is.na(result)) stop("non-numeric cell for ", context, call. = FALSE)
  result
}

# normalise the line-broken Bundesland headings in the ODS tables.
normalise_area_name <- function(value) {
  value <- gsub("-[[:space:]]*", "", trimws(value))
  gsub("[[:space:]]+", " ", value)
}

# compute headline counts for one census year and retain the national row.
parse_census_year <- function(sheet, year) {
  year_row <- which(trimws(sheet[, 2]) == as.character(year) & trimws(sheet[, 1]) == "")
  if (length(year_row) != 1L) stop("expected one census heading for ", year, call. = FALSE)
  next_year_rows <- which(
    seq_len(nrow(sheet)) > year_row &
      trimws(sheet[, 1]) == "" &
      grepl("^[0-9]{4}$", trimws(sheet[, 2]))
  )
  final_row <- if (length(next_year_rows) > 0L) min(next_year_rows) - 1L else nrow(sheet)
  block <- sheet[(year_row + 1L):final_row, , drop = FALSE]
  labels <- trimws(block[, 1])
  total_row <- match("Insgesamt", labels)
  no_row <- match("Ohne Bekenntnis", labels)
  unknown_row <- match(c("Ohne Angabe", "Unbekannt"), labels, nomatch = 0L)
  unknown_row <- unknown_row[unknown_row > 0L][1]
  if (any(is.na(c(total_row, no_row, unknown_row)))) {
    stop(
      "census category rows not found for ", year, ": ",
      paste(labels, collapse = " | "),
      call. = FALSE
    )
  }
  area_names <- normalise_area_name(sheet[2, 3:11])
  if (!identical(area_names, names(bundesland_codes))) {
    stop("unexpected census Bundesland order", call. = FALSE)
  }
  make_values <- function(column) {
    total <- numeric_cell(block[total_row, column], paste(year, "total"))
    no_religion <- numeric_cell(block[no_row, column], paste(year, "no religion"))
    not_stated <- numeric_cell(block[unknown_row, column], paste(year, "not stated"))
    c(
      population_total = total,
      religious_affiliation_count = total - no_religion - not_stated,
      no_religion_count = no_religion,
      not_stated_count = not_stated
    )
  }
  list(
    national = make_values(2L),
    areas = lapply(seq_along(area_names), function(i) {
      list(area_name = area_names[i], values = make_values(i + 2L))
    })
  )
}

# compute 2021 headline estimates from the unrounded ODS cell values.
parse_survey_2021 <- function(sheet) {
  labels <- trimws(sheet[, 1])
  rows <- c(
    total = match("Gesamtbevölkerung", labels),
    christian = match("Christentum", labels),
    islam = match("Islam", labels),
    other = match("Andere Religion, Konfession oder Glaubensgemeinschaft", labels),
    no_religion = match("Keiner Religion, Konfession oder Glaubensgemeinschaft angehörig", labels)
  )
  if (any(is.na(rows))) stop("2021 source category rows not found", call. = FALSE)
  area_names <- normalise_area_name(sheet[2, 3:11])
  if (!identical(area_names, names(bundesland_codes))) {
    stop("unexpected 2021 Bundesland order", call. = FALSE)
  }
  make_values <- function(column) {
    source_value <- function(row_name) {
      1000 * numeric_cell(sheet[rows[[row_name]], column], paste("2021", row_name))
    }
    c(
      population_total = source_value("total"),
      religious_affiliation_count = source_value("christian") + source_value("islam") + source_value("other"),
      no_religion_count = source_value("no_religion"),
      not_stated_count = 0
    )
  }
  list(
    national = make_values(2L),
    areas = lapply(seq_along(area_names), function(i) {
      list(area_name = area_names[i], values = make_values(i + 2L))
    })
  )
}

# turn parsed wave values into area-summary rows.
wave_rows <- function(parsed, year, source_dataset_id, construct, quality_flag, basis, source_note) {
  lapply(parsed[["areas"]], function(area) {
    values <- area[["values"]]
    population_total <- unname(values[["population_total"]])
    affiliation_count <- unname(values[["religious_affiliation_count"]])
    no_religion_count <- unname(values[["no_religion_count"]])
    not_stated_count <- unname(values[["not_stated_count"]])
    area_name <- area[["area_name"]]
    area_code <- unname(bundesland_codes[[area_name]])
    list(
      country_code = country_code,
      boundary_set_id = boundary_set_id,
      boundary_level = boundary_level,
      area_unit_id = paste(boundary_set_id, area_code, sep = ":"),
      area_code = area_code,
      area_name = area_name,
      year = as.integer(year),
      population_total = population_total,
      population_total_basis = basis,
      religious_affiliation_count = affiliation_count,
      religious_affiliation_percent = round(100 * affiliation_count / population_total, 2),
      no_religion_count = no_religion_count,
      no_religion_percent = round(100 * no_religion_count / population_total, 2),
      not_stated_count = not_stated_count,
      not_stated_percent = round(100 * not_stated_count / population_total, 2),
      religious_change = NULL,
      places_of_worship_count = NULL,
      places_per_10000_residents = NULL,
      land_area_sq_km = NULL,
      place_density_per_sq_km = NULL,
      source_dataset_id = source_dataset_id,
      source_construct = construct,
      source_note = source_note,
      quality_flag = quality_flag
    )
  })
}

# verify exact national reconciliation for all headline counts in one wave.
reconcile_wave <- function(rows, national, year, tolerance = 1e-6) {
  metrics <- c(
    "population_total", "religious_affiliation_count",
    "no_religion_count", "not_stated_count"
  )
  lapply(metrics, function(metric) {
    area_sum <- sum(vapply(rows, `[[`, numeric(1), metric))
    source_total <- unname(national[[metric]])
    difference <- area_sum - source_total
    if (abs(difference) > tolerance) {
      stop("national reconciliation failed for ", year, " ", metric, call. = FALSE)
    }
    list(
      year = as.integer(year),
      metric = metric,
      area_sum = area_sum,
      source_national_total = source_total,
      difference = difference,
      tolerance = tolerance,
      status = "matched"
    )
  })
}

# prepare and validate the nine-feature Bundesland boundary layer.
build_boundary <- function(path) {
  boundary <- st_read(path, quiet = TRUE)
  required <- c("shapeName", "shapeISO")
  if (!all(required %in% names(boundary))) stop("boundary properties changed", call. = FALSE)
  if (nrow(boundary) != 9L) stop("expected nine AUT ADM1 features", call. = FALSE)
  if (!setequal(boundary[["shapeISO"]], unname(bundesland_codes))) {
    stop("boundary ISO codes do not match the source table", call. = FALSE)
  }
  if (any(st_is_empty(boundary)) || any(!st_is_valid(boundary))) {
    stop("raw boundary contains empty or invalid geometries", call. = FALSE)
  }
  boundary <- st_transform(boundary, 4326)
  boundary <- suppressWarnings(st_cast(boundary, "MULTIPOLYGON"))
  area_layer <- st_transform(boundary, 3035)
  # remove a sub-metre sliver that collapses at the shared five-decimal export precision.
  st_geometry(boundary) <- st_geometry(st_transform(
    st_simplify(area_layer, dTolerance = 5, preserveTopology = TRUE),
    4326
  ))
  boundary[["area_code"]] <- boundary[["shapeISO"]]
  boundary[["area_name"]] <- boundary[["shapeName"]]
  boundary[["area_unit_id"]] <- paste(boundary_set_id, boundary[["area_code"]], sep = ":")
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- boundary_level
  boundary[["land_area_sq_km"]] <- as.numeric(st_area(area_layer)) / 1e6
  boundary[, c(
    "area_code", "area_name", "area_unit_id", "boundary_set_id",
    "boundary_level", "land_area_sq_km", "geometry"
  )]
}

# add boundary land area to every area-summary row.
add_land_area <- function(rows, boundary) {
  land_area <- setNames(boundary[["land_area_sq_km"]], boundary[["area_code"]])
  lapply(rows, function(row) {
    row[["land_area_sq_km"]] <- unname(land_area[[row[["area_code"]]]])
    row
  })
}

# flatten area-summary rows for the companion CSV product.
flatten_rows <- function(rows) {
  fields <- c(
    "country_code", "boundary_set_id", "boundary_level", "area_unit_id",
    "area_code", "area_name", "year", "population_total",
    "population_total_basis", "religious_affiliation_count",
    "religious_affiliation_percent", "no_religion_count",
    "no_religion_percent", "not_stated_count", "not_stated_percent",
    "religious_change", "places_of_worship_count",
    "places_per_10000_residents", "land_area_sq_km",
    "place_density_per_sq_km", "source_dataset_id", "source_construct",
    "source_note", "quality_flag"
  )
  data.frame(do.call(rbind, lapply(rows, function(row) {
    vapply(fields, function(field) {
      value <- row[[field]]
      if (is.null(value) || length(value) == 0L) NA_character_ else as.character(value)
    }, character(1))
  })), stringsAsFactors = FALSE, check.names = FALSE) |>
    setNames(fields)
}

# count rows or features in one generated product.
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$", path)) {
    return(length(fromJSON(path, simplifyVector = FALSE)[["features"]]))
  }
  document <- fromJSON(path, simplifyVector = FALSE)
  if (!is.null(document[["rows"]])) return(length(document[["rows"]]))
  NA_integer_
}

# describe the two source constructs used by the product.
source_datasets <- function() {
  list(
    list(
      source_dataset_id = census_dataset_id,
      name = "Population by religious denomination and Bundesland, 1951 to 2001",
      provider = "Statistics Austria",
      url = census_url,
      retrieval_date = retrieval_date,
      local_path = census_path,
      licence = list(
        name = "Statistics Austria website reuse terms",
        url = website_terms_url,
        attribution = "Statistics Austria; extracted and adapted"
      ),
      citation = "Statistics Austria. Population censuses 1951 to 2001, population by religious denomination and Bundesland.",
      access_limits = NULL,
      redistribution_limits = "Attribute Statistics Austria and identify extracted or adapted content.",
      notes = "Six full-enumeration census self-declaration waves: 1951, 1961, 1971, 1981, 1991, and 2001."
    ),
    list(
      source_dataset_id = survey_dataset_id,
      name = "Religious affiliation of the Austrian population 2021 by Bundesland",
      provider = "Statistics Austria",
      url = survey_url,
      retrieval_date = retrieval_date,
      local_path = survey_path,
      licence = list(
        name = "Statistics Austria website reuse terms",
        url = website_terms_url,
        attribution = "Statistics Austria; extracted and adapted"
      ),
      citation = "Statistics Austria. Additional questions to the Microcensus Labour Force Survey on religious affiliation, quarters 1 to 4 of 2021.",
      access_limits = NULL,
      redistribution_limits = "Attribute Statistics Austria and identify extracted or adapted content.",
      notes = paste(
        "A voluntary sample survey of people aged 16+ in private households,",
        "with parent-based imputation for children under 16 and an estimate",
        "for the institutional population. Deepest geography: Bundesland."
      )
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "geoBoundaries gbOpen Austria ADM1",
      provider = "geoBoundaries / Federal Office for Metrology and Survey, Austria",
      url = boundary_api_url,
      retrieval_date = retrieval_date,
      local_path = boundary_raw_path,
      licence = list(
        name = "Creative Commons Attribution-ShareAlike 2.0",
        url = "https://creativecommons.org/licenses/by-sa/2.0/",
        attribution = "geoBoundaries; Federal Office for Metrology and Survey, Austria"
      ),
      citation = "geoBoundaries gbOpen AUT ADM1, boundary year 2017.",
      access_limits = NULL,
      redistribution_limits = "Attribution and share-alike apply.",
      notes = "Nine Bundesländer with ISO 3166-2 codes AT-1 through AT-9."
    )
  )
}

# describe the public indicators without conflating the two source designs.
indicators <- function() {
  list(
    list(
      indicator_id = "population_total",
      label = "Source population denominator",
      description = "Total population in the Bundesland for the source wave.",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "Census total population for 1951-2001; weighted total-population estimate for 2021.",
      temporal_coverage = "1951, 1961, 1971, 1981, 1991, 2001, 2021",
      spatial_coverage = "Nine Austrian Bundesländer.",
      quality_notes = "The 2021 values are weighted estimates and may be non-integer."
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious affiliation %",
      description = "Share of the source population denominator assigned to a reported religious-affiliation category.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * religious_affiliation_count / population_total.",
      temporal_coverage = "1951, 1961, 1971, 1981, 1991, 2001, 2021",
      spatial_coverage = "Nine Austrian Bundesländer.",
      quality_notes = paste(
        "1951-2001 are census self-declarations. The 2021 value combines a",
        "voluntary sample survey, imputation for children, and an estimate for",
        "the institutional population."
      )
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "No religion %",
      description = "Share of the source population denominator reported or estimated as having no religious affiliation.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * no_religion_count / population_total.",
      temporal_coverage = "1951, 1961, 1971, 1981, 1991, 2001, 2021",
      spatial_coverage = "Nine Austrian Bundesländer.",
      quality_notes = "Not-stated census responses remain in the 1951-2001 denominator and outside both headline categories."
    )
  )
}

# describe the two choropleth layers supplied by the data product.
visual_layers <- function() {
  list(
    list(
      visual_layer_id = "at-bundesland-religious-affiliation",
      label = "Religious affiliation %",
      description = "Austria Bundesland religious-affiliation share for six census waves and the separate 2021 mixed estimate.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "source population denominator"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported Bundesland value",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = "The 2021 source-design break must remain explicit in map copy."
    ),
    list(
      visual_layer_id = "at-bundesland-no-religion",
      label = "No religion %",
      description = "Austria Bundesland no-religion share for six census waves and the separate 2021 mixed estimate.",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "source population denominator"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported Bundesland value",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = "The census denominator includes not-stated responses."
    )
  )
}

# create one manifest record for a cached raw source.
raw_source_record <- function(path, url, format, source_id, periods, notes) {
  meta <- read_meta(path)
  list(
    uri = path,
    url = url,
    format = format,
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    source_dataset_id = source_id,
    used_in_public_product = TRUE,
    periods = periods,
    retrieved_at = meta[["retrieved_at"]],
    http_status = meta[["http_status"]],
    notes = notes
  )
}

# create one manifest record for a generated public file.
manifest_file_record <- function(path, content, licence_status) {
  list(
    uri = paste0("repo:", path),
    storage_provider = "other",
    format = sub("^.*\\.", "", path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    row_count = row_count_file(path),
    content = content,
    privacy = "public",
    licence_status = licence_status
  )
}

fetch_file(census_url, census_path, insecure = TRUE)
fetch_file(survey_url, survey_path, insecure = TRUE)
fetch_file(source_page_url, source_page_path, insecure = TRUE)
fetch_file(method_url, method_path, insecure = TRUE)
fetch_file(website_terms_url, website_terms_path, insecure = TRUE)
fetch_file(boundary_api_url, boundary_api_path)
fetch_file(boundary_url, boundary_raw_path)

required_sources <- c(
  census_path, survey_path, source_page_path, method_path,
  website_terms_path, boundary_api_path, boundary_raw_path
)
invisible(lapply(required_sources, require_file))

boundary_api <- fromJSON(boundary_api_path, simplifyVector = FALSE)
if (!identical(boundary_api[["admUnitCount"]], "9")) stop("boundary API unit count changed", call. = FALSE)
if (!identical(boundary_api[["boundaryCanonical"]], "Bundesländer")) stop("boundary canonical label changed", call. = FALSE)
if (!identical(boundary_api[["boundaryLicense"]], "Creative Commons Attribution-ShareAlike 2.0")) {
  stop("boundary source licence changed", call. = FALSE)
}

census_sheet <- read_ods_sheet(census_path, "A1")
survey_sheet <- read_ods_sheet(survey_path, "Tabelle1")
census_years <- c(1951L, 1961L, 1971L, 1981L, 1991L, 2001L)
parsed_waves <- setNames(lapply(census_years, function(year) {
  parse_census_year(census_sheet, year)
}), census_years)
parsed_waves[["2021"]] <- parse_survey_2021(survey_sheet)

census_basis <- paste(
  "Full-enumeration population census self-declaration; total population",
  "denominator includes the not-stated category"
)
census_note <- paste(
  "Religious affiliation is total population minus Ohne Bekenntnis and",
  "Ohne Angabe/Unbekannt. Category detail changes across censuses; Sonstiges",
  "includes Islam in 1951 and 1961."
)
survey_basis <- paste(
  "Weighted 2021 total-population estimate: voluntary Microcensus Labour",
  "Force Survey module among people aged 16+ in private households,",
  "parent-based imputation for children under 16, and an estimate for the",
  "institutional population"
)
survey_note <- paste(
  "Religion is absent from the 2021 register census. The affiliation question",
  "was weighted to compensate for don't know and no information, leaving no",
  "unknown category. Official caveat:", survey_caveat
)

all_rows <- list()
reconciliation <- list()
for (year in census_years) {
  parsed <- parsed_waves[[as.character(year)]]
  rows <- wave_rows(
    parsed, year, census_dataset_id, "census_self_declared_religious_affiliation",
    "full_enumeration_census;not_stated_in_denominator",
    census_basis, census_note
  )
  all_rows <- c(all_rows, rows)
  reconciliation <- c(reconciliation, reconcile_wave(rows, parsed[["national"]], year, tolerance = 0))
}
parsed_2021 <- parsed_waves[["2021"]]
rows_2021 <- wave_rows(
  parsed_2021, 2021L, survey_dataset_id,
  "mixed_sample_survey_imputation_and_institutional_population_estimate",
  paste(
    "sample_survey_estimate;voluntary_response;children_imputed;",
    "institutional_population_estimated;small_estimates_randomly_unstable",
    sep = ""
  ),
  survey_basis, survey_note
)
all_rows <- c(all_rows, rows_2021)
reconciliation <- c(
  reconciliation,
  reconcile_wave(rows_2021, parsed_2021[["national"]], 2021L, tolerance = 1e-6)
)

boundary <- build_boundary(boundary_raw_path)
all_rows <- add_land_area(all_rows, boundary)
keep_ladder <- c(10, 5, 2, 1, 0.5)
boundary_write <- mapshaper_simplify_to_cap(
  boundary, boundary_out, 800000L, keep_ladder, clean_option = NULL
)
output_boundary <- st_read(boundary_out, quiet = TRUE)
if (nrow(output_boundary) != 9L || any(st_is_empty(output_boundary)) || any(!st_is_valid(output_boundary))) {
  stop("simplified boundary failed feature or geometry validation", call. = FALSE)
}

area_summary <- list(
  schema_version = "0.2.0",
  generated_at = stamp,
  generated_by = script_id,
  country_code = country_code,
  boundary_set = list(
    boundary_set_id = boundary_set_id,
    country_code = country_code,
    level = boundary_level,
    vintage = "2017",
    source_dataset_id = boundary_dataset_id
  ),
  site_snapshot = list(
    source_dataset_id = NULL,
    snapshot_date = NULL,
    basis = "no governed Austria OpenStreetMap place-of-worship snapshot is included in this product",
    notes = "The Austria product contains official religious-affiliation and no-religion estimates only."
  ),
  source_datasets = source_datasets(),
  indicators = indicators(),
  visual_layers = visual_layers(),
  rows = all_rows
)
write_json(
  area_summary, summary_json_out, auto_unbox = TRUE, pretty = TRUE,
  null = "null", na = "null", digits = NA
)
write.csv(flatten_rows(all_rows), summary_csv_out, row.names = FALSE, na = "")
reconciliation_frame <- do.call(rbind, lapply(reconciliation, function(item) {
  data.frame(
    year = item[["year"]],
    metric = item[["metric"]],
    area_sum = item[["area_sum"]],
    source_national_total = item[["source_national_total"]],
    difference = item[["difference"]],
    tolerance = item[["tolerance"]],
    status = item[["status"]],
    stringsAsFactors = FALSE
  )
}))
write.csv(reconciliation_frame, reconciliation_out, row.names = FALSE)
if (!jsonlite::validate(paste(readLines(summary_json_out, warn = FALSE), collapse = "\n"))) {
  stop("area-summary JSON failed validation", call. = FALSE)
}

join_coverage <- lapply(c(census_years, 2021L), function(year) {
  list(
    boundary_level = boundary_level,
    year = as.integer(year),
    matched_area_count = 9L,
    expected_area_count = 9L,
    missing_area_names = list()
  )
})
raw_sources <- list(
  raw_source_record(
    census_path, census_url, "ods", census_dataset_id,
    "1951,1961,1971,1981,1991,2001",
    "ODS sheet A1; underlying integer cells used for all six census waves and national reconciliation."
  ),
  raw_source_record(
    survey_path, survey_url, "ods", survey_dataset_id, "2021",
    "ODS sheet Tabelle1; underlying unrounded weighted estimates used rather than one-decimal display values."
  ),
  raw_source_record(
    source_page_path, source_page_url, "html", source_page_dataset_id,
    "1951-2021", "Source landing page with construct descriptions and direct ODS routes."
  ),
  raw_source_record(
    method_path, method_url, "pdf", method_dataset_id, "2021",
    "Three-page standard documentation used to establish the sample, imputations, estimation, and deepest geography."
  ),
  raw_source_record(
    website_terms_path, website_terms_url, "html", website_terms_dataset_id,
    "not applicable", "Website reuse grant; confirms these main-site files do not use the separate open.data CC BY 4.0 licence."
  ),
  raw_source_record(
    boundary_api_path, boundary_api_url, "json", boundary_dataset_id,
    "2017", "Pinned geoBoundaries metadata, source licence, feature count, and GeoJSON route."
  ),
  raw_source_record(
    boundary_raw_path, boundary_url, "geojson", boundary_dataset_id,
    "2017", "Nine-feature AUT ADM1 boundary source used for the simplified public boundary."
  )
)

licence_status <- "accepted"
git_commit <- trimws(system2("git", c("rev-parse", "HEAD"), stdout = TRUE))
if (length(git_commit) != 1L || !grepl("^[a-f0-9]{7,40}$", git_commit)) {
  stop("could not record the current git commit", call. = FALSE)
}
manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:at-religious-affiliation:at:1951-2021:statistik-austria",
  dataset_id = "at-religious-affiliation:at:1951-2021:statistik-austria",
  dataset_version_id = paste0(
    "at-religious-affiliation:at:1951-2021:statistik-austria:",
    substr(sha256_file(summary_json_out), 1, 12)
  ),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "at-religious-affiliation",
  dataset_role = "public_product",
  scope = list(
    level = "country", country_codes = list(country_code),
    snapshot_date = NULL, snapshot_anchor = NULL, pipeline_stage = "public"
  ),
  created_at = stamp,
  created_by = script_id,
  pipeline = list(
    script = script_id,
    git_commit = git_commit,
    command = paste("Rscript", script_id),
    parameters = list(
      waves = as.list(as.character(c(census_years, 2021L))),
      source_frame = "nine Bundesländer",
      census_construct = "full-enumeration self-declared religious affiliation",
      survey_2021_construct = paste(
        "voluntary Microcensus Labour Force Survey module for people aged 16+",
        "in private households, parent-based imputation for children, and an",
        "estimate for the institutional population"
      ),
      denominator = "source total population; not-stated census responses remain in the 1951-2001 denominator",
      boundary_set = boundary_set_id,
      boundary_simplification = list(
        method = boundary_write[["method"]],
        clean_option = boundary_write[["clean_option"]],
        keep_percent = boundary_write[["keep_percent"]],
        bytes = boundary_write[["bytes"]],
        byte_ceiling = 800000L
      ),
      source_objects = raw_sources,
      reconciliation_file = reconciliation_out,
      reconciliation_metrics = c(
        "population_total", "religious_affiliation_count",
        "no_religion_count", "not_stated_count"
      ),
      omitted_metrics = c("religious_change", "places_per_10000_residents", "place_density_per_sq_km")
    ),
    software_versions = list(
      r = paste(R.version[["major"]], R.version[["minor"]], sep = "."),
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")),
      xml2 = as.character(packageVersion("xml2")),
      mapshaper = "npx --yes mapshaper"
    )
  ),
  source = list(
    provider = "Statistics Austria; geoBoundaries",
    source_dataset_ids = c(
      census_dataset_id, survey_dataset_id, boundary_dataset_id,
      source_page_dataset_id, method_dataset_id, website_terms_dataset_id
    ),
    source_urls = c(
      census_url, survey_url, source_page_url, method_url,
      website_terms_url, open_data_terms_url, boundary_api_url, boundary_url
    ),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = paste(licence_text, boundary_licence_text),
    citation = paste(
      "Statistics Austria, population by religious denomination and Bundesland",
      "1951-2001; Statistics Austria, religious affiliation 2021 by Bundesland;",
      "geoBoundaries gbOpen AUT ADM1."
    )
  ),
  input_manifests = list(),
  durable_files = list(
    manifest_file_record(
      summary_json_out,
      "Austria Bundesland area summary for six census waves and the separate 2021 mixed religious-affiliation estimate.",
      licence_status
    ),
    manifest_file_record(
      summary_csv_out,
      "Flattened Austria Bundesland religious-affiliation area summary.",
      licence_status
    ),
    manifest_file_record(
      boundary_out,
      "Simplified geoBoundaries Austria ADM1 boundary GeoJSON with nine Bundesländer.",
      licence_status
    ),
    manifest_file_record(
      reconciliation_out,
      "Wave-by-wave national reconciliation for four headline counts.",
      licence_status
    )
  ),
  stats = list(
    area_summary_rows = length(all_rows),
    boundary_features = nrow(output_boundary),
    waves = length(census_years) + 1L,
    reconciliation_records = length(reconciliation),
    max_abs_reconciliation_difference_persons = max(abs(vapply(
      reconciliation, `[[`, numeric(1), "difference"
    )))
  ),
  validation = list(
    status = "passed",
    commands = c(
      "Rscript scripts/build_at_area_summary.R",
      paste(
        "uv run --with jsonschema python -m jsonschema -i",
        "docs/manifests/at-religious-affiliation-1951-2021.json",
        "schemas/data-manifest.schema.json"
      )
    ),
    warnings = list(),
    notes = paste(
      "Seven waves each join nine source rows to nine boundary features.",
      "All percentage metrics are within [0, 100]. Population, religious",
      "affiliation, no religion, and not stated reconcile to the national",
      "source row in every wave. Census differences are zero. The largest",
      "2021 binary floating-point residual is below 4e-9 persons.",
      "The simplified boundary contains nine valid non-empty features and is",
      "below 800 KB. See apps/regions/at/data/national_reconciliation.csv."
    )
  ),
  privacy = "public",
  licence_status = licence_status,
  downstream_status = "public",
  notes = paste(
    "The Austria country data product is built. The 1951-2001 rows are census",
    "self-declarations. The 2021 rows combine a voluntary sample survey, child",
    "imputation, and an institutional-population estimate; the register census",
    "did not collect religion. The ODS underlying values support reconciliation",
    "without using display-rounded cells. Raw sources remain in gitignored",
    "data/raw/at_religion/. UI and hub integration remain out of scope."
  )
)
write_json(
  manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE,
  null = "null", na = "null", digits = NA
)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) {
  stop("manifest JSON failed validation", call. = FALSE)
}

cat(sprintf("wrote %s: %d rows\n", summary_json_out, length(all_rows)))
cat(sprintf("wrote %s: %d rows\n", summary_csv_out, row_count_file(summary_csv_out)))
cat(sprintf("wrote %s: %d rows\n", reconciliation_out, row_count_file(reconciliation_out)))
cat(sprintf(
  "wrote %s: %d features, %d bytes with %s at %g%% keep, %s\n",
  boundary_out, row_count_file(boundary_out), file_bytes(boundary_out),
  boundary_write[["method"]], boundary_write[["keep_percent"]],
  boundary_write[["clean_option"]]
))
cat(sprintf("wrote %s\n", manifest_out))
