# build the slovakia municipality and kraj area-summary products.
# inputs: SODB 2021 Z01_15 religious-belief JSON files by district,
# the SODB 2021 national Z01_15 JSON, the SODB 2021 OB GeoJSON,
# Infostat 2001 data118 kraj HTML tables, and SODB 2011 TAB. 118 XLS files.
# outputs: apps/regions/sk/data/sk_municipality_2021.geojson,
# apps/regions/sk/data/area_summary_municipality.{json,csv},
# apps/regions/sk/data/sk_kraj_2021.geojson,
# apps/regions/sk/data/area_summary_kraj.{json,csv}, and
# docs/manifests/sk-census-religion-2001-2021.json.
# run from the repo root: Rscript scripts/build_sk_area_summary.R

suppressMessages({
  library(jsonlite)
  library(readxl)
  library(sf)
  library(xml2)
})

raw_dir <- "data/raw/sk_census"
district_dir <- file.path(raw_dir, "sodb2021_z01_15_by_district")
infostat_2001_dir <- file.path(raw_dir, "sodb2001_infostat_data118_kraj")
sodb_2011_dir <- file.path(raw_dir, "sodb2011_tab118_kraj")
sk_dir <- "apps/regions/sk/data"
manifest_dir <- "docs/manifests"
dir.create(sk_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(infostat_2001_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(sodb_2011_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- format(Sys.Date(), "%Y-%m-%d")
script_id <- "scripts/build_sk_area_summary.R"
country_code <- "SK"
year <- 2021L

boundary_set_id <- "sk-municipality-2021-sodb"
kraj_boundary_set_id <- "sk-kraj-2021-sodb-dissolved"
kraj_boundary_target_bytes <- 300000L
census_2001_dataset_id <- "sodb2001-infostat-data118-religion-kraj"
census_2011_dataset_id <- "sodb2011-tab118-religion-kraj"
census_2021_dataset_id <- "sodb2021-z01-15-religious-belief-basic-results"
boundary_dataset_id <- "sodb2021-disem-ob-geojson"
time_series_dataset_id <- "sodb2021-c01-11-religious-belief-time-series-national"
deferred_1991_dataset_id <- "sodb1991-infostat-data118-religion-source-geography"

sodb_base_url <- "https://www.scitanie.sk"
basic_results_url <- paste0(
  sodb_base_url,
  "/en/population/basic-results/structure-of-population-by-religious-belief/SR/SK0/SR"
)
previous_censuses_url <- paste0(sodb_base_url, "/en/data-from-the-previous-censuses-since-1991")
content_operator_url <- paste0(sodb_base_url, "/en/content-and-technical-operator")
district_url_pattern <- paste0(
  sodb_base_url,
  "/themes/web-sodb/assets/public/disem/data/Z01_15_OK_%s_OB.json?v=10"
)
national_url <- paste0(
  sodb_base_url,
  "/themes/web-sodb/assets/public/disem/data/Z01_15_SR_SK0_SR.json?v=10"
)
all_districts_url <- paste0(
  sodb_base_url,
  "/themes/web-sodb/assets/public/disem/data/Z01_15_SR_SK0_OK.json?v=10"
)
boundary_url <- paste0(
  sodb_base_url,
  "/themes/web-sodb/assets/public/disem/geojson/OB.geojson"
)
time_series_url <- paste0(
  sodb_base_url,
  "/themes/web-sodb/assets/public/disem/data/C01_11.json?v=10"
)
infostat_2001_base_url <- "http://sodb.infostat.sk/scitanie/sk/2001"
infostat_1991_base_url <- "http://sodb.infostat.sk/scitanie/sk/1991"
infostat_2001_navigation_url <- paste0(infostat_2001_base_url, "/navigation.htm")
infostat_2001_national_url <- paste0(infostat_2001_base_url, "/data118.aspx?u=100000&okr=0")
infostat_2001_kraj_url <- function(source_code) {
  paste0(infostat_2001_base_url, "/data118.aspx?txtUroven=", source_code, "&okr=0")
}
sodb_2011_data_php_url <- "https://census2011.statistics.sk/data.php"
sodb_2011_base_url <- "https://census2011.statistics.sk"

district_codes <- c(
  "SK0221", "SK0321", "SK0322", "SK0411", "SK0101", "SK0102", "SK0103",
  "SK0104", "SK0105", "SK0323", "SK0311", "SK0312", "SK0324", "SK0313",
  "SK0211", "SK0212", "SK0421", "SK0213", "SK0412", "SK0222", "SK0413",
  "SK0231", "SK0426", "SK0422", "SK0423", "SK0424", "SK0425", "SK0325",
  "SK0314", "SK0232", "SK0414", "SK0315", "SK0326", "SK0106", "SK0316",
  "SK0415", "SK0427", "SK0223", "SK0317", "SK0233", "SK0224", "SK0234",
  "SK0225", "SK0107", "SK0214", "SK0327", "SK0416", "SK0226", "SK0417",
  "SK0227", "SK0228", "SK0328", "SK0329", "SK0428", "SK0318", "SK0418",
  "SK0108", "SK0215", "SK0216", "SK0419", "SK0429", "SK042A", "SK041A",
  "SK041B", "SK041C", "SK0235", "SK0236", "SK042B", "SK0229", "SK0217",
  "SK0319", "SK031A", "SK032A", "SK041D", "SK0237", "SK032B", "SK032C",
  "SK032D", "SK031B"
)

kraj_specs <- list(
  list(
    area_code = "SK010",
    area_name = "Bratislavský kraj",
    infostat_2001_code = "310100",
    data2011_metadata = "SR%2FBratislavsk%C3%BD+kraj%2FBratislavsk%C3%BD+kraj",
    data2011_parent_metadata = "SR%2FBratislavsk%C3%BD+kraj",
    parent_slug = "bratislavsky"
  ),
  list(
    area_code = "SK021",
    area_name = "Trnavský kraj",
    infostat_2001_code = "320200",
    data2011_metadata = "SR%2FZ%C3%A1padn%C3%A9+Slovensko%2FTrnavsk%C3%BD+kraj",
    data2011_parent_metadata = "SR%2FZ%C3%A1padn%C3%A9+Slovensko",
    parent_slug = "zapadne"
  ),
  list(
    area_code = "SK022",
    area_name = "Trenčiansky kraj",
    infostat_2001_code = "320300",
    data2011_metadata = "SR%2FZ%C3%A1padn%C3%A9+Slovensko%2FTren%C4%8Diansky+kraj",
    data2011_parent_metadata = "SR%2FZ%C3%A1padn%C3%A9+Slovensko",
    parent_slug = "zapadne"
  ),
  list(
    area_code = "SK023",
    area_name = "Nitriansky kraj",
    infostat_2001_code = "320400",
    data2011_metadata = "SR%2FZ%C3%A1padn%C3%A9+Slovensko%2FNitriansky+kraj",
    data2011_parent_metadata = "SR%2FZ%C3%A1padn%C3%A9+Slovensko",
    parent_slug = "zapadne"
  ),
  list(
    area_code = "SK031",
    area_name = "Žilinský kraj",
    infostat_2001_code = "330500",
    data2011_metadata = "SR%2FStredn%C3%A9+Slovensko%2F%C5%BDilinsk%C3%BD+kraj",
    data2011_parent_metadata = "SR%2FStredn%C3%A9+Slovensko",
    parent_slug = "stredne"
  ),
  list(
    area_code = "SK032",
    area_name = "Banskobystrický kraj",
    infostat_2001_code = "330600",
    data2011_metadata = "SR%2FStredn%C3%A9+Slovensko%2FBanskobystrick%C3%BD+kraj",
    data2011_parent_metadata = "SR%2FStredn%C3%A9+Slovensko",
    parent_slug = "stredne"
  ),
  list(
    area_code = "SK041",
    area_name = "Prešovský kraj",
    infostat_2001_code = "340700",
    data2011_metadata = "SR%2FV%C3%BDchodn%C3%A9+Slovensko%2FPre%C5%A1ovsk%C3%BD+kraj",
    data2011_parent_metadata = "SR%2FV%C3%BDchodn%C3%A9+Slovensko",
    parent_slug = "vychodne"
  ),
  list(
    area_code = "SK042",
    area_name = "Košický kraj",
    infostat_2001_code = "340800",
    data2011_metadata = "SR%2FV%C3%BDchodn%C3%A9+Slovensko%2FKo%C5%A1ick%C3%BD+kraj",
    data2011_parent_metadata = "SR%2FV%C3%BDchodn%C3%A9+Slovensko",
    parent_slug = "vychodne"
  )
)
kraj_names <- setNames(
  vapply(kraj_specs, `[[`, character(1), "area_name"),
  vapply(kraj_specs, `[[`, character(1), "area_code")
)

national_path <- file.path(raw_dir, "sodb2021_z01_15_religious_belief_structure_national.json")
all_districts_path <- file.path(raw_dir, "sodb2021_z01_15_religious_belief_structure_all_districts.json")
boundary_raw_path <- file.path(raw_dir, "sodb2021_ob_municipality_boundaries.geojson")
time_series_path <- file.path(raw_dir, "sodb2021_c01_11_religious_belief_time_series.json")
hypercube_metadata_path <- file.path(raw_dir, "sodb2011_hypercube_variable_names.xlsx")
codebook_path <- file.path(raw_dir, "sodb2011_codebooks_eurostat.xlsx")

infostat_2001_navigation_path <- file.path(infostat_2001_dir, "navigation.htm")
infostat_2001_national_path <- file.path(infostat_2001_dir, "data118_national.html")
sodb_2011_root_tree_path <- file.path(sodb_2011_dir, "data_php_root.json")
sodb_2011_national_xls_path <- file.path(sodb_2011_dir, "TAB_118_national.xls")

boundary_out <- file.path(sk_dir, "sk_municipality_2021.geojson")
summary_json_out <- file.path(sk_dir, "area_summary_municipality.json")
summary_csv_out <- file.path(sk_dir, "area_summary_municipality.csv")
kraj_boundary_out <- file.path(sk_dir, "sk_kraj_2021.geojson")
kraj_summary_json_out <- file.path(sk_dir, "area_summary_kraj.json")
kraj_summary_csv_out <- file.path(sk_dir, "area_summary_kraj.csv")
manifest_out <- file.path(manifest_dir, "sk-census-religion-2001-2021.json")

licence_text <- paste(
  "SODB 2021 public website assets are published by the Statistical Office",
  "of the Slovak Republic. This build attributes SUSR and links the source;",
  "a specific CC BY statement was not located on the SODB pages during this pass.",
  "The 2001 Infostat and 2011 SODB archive routes are also attributed to SUSR;",
  "their exact reuse statements were not located during the pinned probe."
)
licence_status <- "susr_public_sodb_attribution_required_statement_not_located"

# return the local raw path for one 2001 kraj HTML table.
infostat_2001_kraj_path <- function(source_code) {
  file.path(infostat_2001_dir, paste0("data118_kraj_", source_code, ".html"))
}

# return the local data.php JSON path for one 2011 source tree node.
sodb_2011_tree_path <- function(slug) {
  file.path(sodb_2011_dir, paste0("data_php_", slug, ".json"))
}

# return the local XLS path for one 2011 kraj table.
sodb_2011_kraj_xls_path <- function(area_code) {
  file.path(sodb_2011_dir, paste0("TAB_118_kraj_", area_code, ".xls"))
}

# stop early if a required raw source has not been downloaded.
require_file <- function(path) {
  if (!file.exists(path)) stop("missing required source: ", path, call. = FALSE)
}

# compute the sha-256 digest for a local file.
sha256_file <- function(path) {
  unname(tools::sha256sum(path))
}

# hash ordered product hashes for manifest version tokens.
sha256_values <- function(values) {
  tmp <- tempfile()
  on.exit(unlink(tmp), add = TRUE)
  writeBin(charToRaw(paste(values, collapse = "")), tmp)
  sha256_file(tmp)
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

# parse a count from HTML, XLS, or JSON source cells.
parse_count <- function(value) {
  text <- gsub("[^0-9-]", "", as.character(value))
  if (!nzchar(text)) return(NA_real_)
  as.numeric(text)
}

# normalise a Slovak category label for exact matching across parsers.
normalise_label <- function(value) {
  gsub("[[:space:]]+", " ", trimws(as.character(value)))
}

# download one source file with curl and optional insecure TLS handling.
fetch_file <- function(url, path, insecure = FALSE) {
  if (file.exists(path) && file_bytes(path) > 0L) return(invisible(path))
  dir.create(dirname(path), showWarnings = FALSE, recursive = TRUE)
  args <- c("-L", "-sS")
  if (isTRUE(insecure)) args <- c("-k", args)
  command <- paste(
    "curl",
    paste(c(args, "-o", shQuote(path), shQuote(url)), collapse = " ")
  )
  status <- system(command)
  if (!identical(status, 0L)) stop("curl failed for ", url, call. = FALSE)
  if (!file.exists(path) || file_bytes(path) == 0L) {
    stop("download produced an empty file: ", path, call. = FALSE)
  }
  invisible(path)
}

# build a replayable data.php URL from an optional metadata id.
sodb_2011_tree_url <- function(metadata = NULL) {
  if (is.null(metadata)) return(sodb_2011_data_php_url)
  paste0(sodb_2011_data_php_url, "?id=", metadata)
}

# list all raw district JSON paths in the expected official-code order.
district_paths <- function() {
  file.path(district_dir, paste0("Z01_15_OK_", district_codes, "_OB.json"))
}

# count rows or features for CSV, GeoJSON, XLS, HTML, and SODB JSON files.
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$", path)) {
    geo <- fromJSON(path, simplifyVector = FALSE)
    return(length(geo[["features"]]))
  }
  if (grepl("\\.xls$", path, ignore.case = TRUE)) {
    return(nrow(read_excel(path, col_names = FALSE, .name_repair = "minimal")))
  }
  if (grepl("\\.html?$", path, ignore.case = TRUE)) {
    doc <- read_html(path)
    rows <- xml_find_all(doc, ".//table[contains(@class, 'tabulka')]//tr")
    return(max(0L, length(rows) - 1L))
  }
  if (grepl("\\.json$", path)) {
    json <- fromJSON(path, simplifyVector = FALSE)
    if (!is.null(json[["rows"]])) return(length(json[["rows"]]))
    if (!is.null(json[["table"]][["data"]])) return(length(json[["table"]][["data"]]))
    if (is.list(json)) return(length(json))
  }
  NA_integer_
}

# extract one numeric SODB category value from a parsed row.
sodb_value <- function(row, code) {
  value <- row[["types"]][[code]][["value"]]
  if (is.null(value)) stop("missing SODB category code ", code, call. = FALSE)
  as.numeric(value)
}

# extract SODB municipality records from one district JSON file.
read_district_file <- function(path) {
  parsed <- fromJSON(path, simplifyVector = FALSE)
  if (!identical(parsed[["meta"]][["type"]], "Z01") ||
      !identical(parsed[["meta"]][["indicator"]], "15") ||
      !identical(parsed[["meta"]][["territoryUnit"]], "OB")) {
    stop("unexpected SODB district file metadata: ", path, call. = FALSE)
  }

  district_code <- parsed[["meta"]][["territorySpecification"]]
  rows <- parsed[["table"]][["data"]]
  do.call(rbind, lapply(names(rows), function(area_code) {
    row <- rows[[area_code]]
    total <- sodb_value(row, "total")
    no_religion <- sodb_value(row, "28")
    not_found_out <- sodb_value(row, "00")
    religious_affiliation <- total - no_religion - not_found_out
    data.frame(
      area_code = area_code,
      area_name = row[["name"]],
      area_name_en = row[["name_en"]],
      district_code = district_code,
      population_total = total,
      no_religion_count = no_religion,
      not_found_out_count = not_found_out,
      religious_affiliation_count = religious_affiliation,
      stringsAsFactors = FALSE
    )
  }))
}

# extract national SODB category totals from the national JSON file.
read_national_totals <- function(path) {
  parsed <- fromJSON(path, simplifyVector = FALSE)
  if (!identical(parsed[["meta"]][["type"]], "Z01") ||
      !identical(parsed[["meta"]][["indicator"]], "15") ||
      !identical(parsed[["meta"]][["territoryUnit"]], "SR")) {
    stop("unexpected SODB national file metadata: ", path, call. = FALSE)
  }
  row <- parsed[["table"]][["data"]][["SK0"]]
  total <- sodb_value(row, "total")
  no_religion <- sodb_value(row, "28")
  not_found_out <- sodb_value(row, "00")
  list(
    population_total = total,
    no_religion_count = no_religion,
    not_found_out_count = not_found_out,
    religious_affiliation_count = total - no_religion - not_found_out
  )
}

# create boundary geometry, metadata, and simplification details.
write_boundary_product <- function(boundary_path, census_codes) {
  boundary_raw <- st_read(boundary_path, quiet = TRUE)
  municipality_boundary <- boundary_raw[!is.na(boundary_raw[["okres_kod"]]), ]
  municipality_boundary[["area_code"]] <- municipality_boundary[["code"]]
  municipality_boundary[["area_name"]] <- municipality_boundary[["name"]]

  missing_boundary <- setdiff(census_codes, municipality_boundary[["area_code"]])
  extra_boundary <- setdiff(municipality_boundary[["area_code"]], census_codes)
  if (length(missing_boundary) || length(extra_boundary)) {
    stop(
      "SODB boundary/census code mismatch; missing boundary: ",
      paste(missing_boundary, collapse = ", "),
      "; extra boundary: ",
      paste(extra_boundary, collapse = ", "),
      call. = FALSE
    )
  }

  municipality_boundary <- municipality_boundary[match(census_codes, municipality_boundary[["area_code"]]), ]
  municipality_boundary <- st_make_valid(municipality_boundary)
  boundary_metric <- st_transform(municipality_boundary, 3035)
  area_table <- st_drop_geometry(boundary_metric)
  area_table[["land_area_sq_km"]] <- as.numeric(st_area(boundary_metric)) / 1e6
  area_table <- area_table[, c("area_code", "area_name", "okres_kod", "kraj_kod", "land_area_sq_km")]

  boundary_export <- st_sf(
    area_code = boundary_metric[["area_code"]],
    area_name = boundary_metric[["area_name"]],
    area_unit_id = paste0(boundary_set_id, ":", boundary_metric[["area_code"]]),
    boundary_set_id = boundary_set_id,
    boundary_level = "municipality",
    district_code = boundary_metric[["okres_kod"]],
    region_code = boundary_metric[["kraj_kod"]],
    land_area_sq_km = round(area_table[["land_area_sq_km"]], 2),
    geometry = st_geometry(boundary_metric)
  )

  tolerances <- c(10, 25, 50, 100, 200, 500, 1000, 1500, 2000)
  chosen_tolerance <- tail(tolerances, 1)
  chosen_bytes <- NA_integer_
  for (tolerance in tolerances) {
    candidate <- st_simplify(boundary_export, dTolerance = tolerance, preserveTopology = TRUE)
    candidate <- st_make_valid(st_transform(candidate, 4326))
    st_write(candidate, boundary_out, delete_dsn = TRUE, quiet = TRUE)
    chosen_bytes <- file_bytes(boundary_out)
    chosen_tolerance <- tolerance
    if (chosen_bytes <= 3000000L) break
  }
  if (chosen_bytes > 3000000L) {
    stop("simplified SK boundary exceeds 3 MB: ", chosen_bytes, call. = FALSE)
  }

  list(
    area_table = area_table,
    source_feature_count = nrow(boundary_raw),
    output_feature_count = row_count_file(boundary_out),
    expected_feature_count = length(census_codes),
    simplification_tolerance_m = chosen_tolerance,
    output_bytes = chosen_bytes,
    parent_helper_feature_count = nrow(boundary_raw) - nrow(municipality_boundary),
    missing_boundary_codes = missing_boundary,
    extra_boundary_codes = extra_boundary
  )
}

# run mapshaper simplification for one keep percentage.
run_mapshaper <- function(input_path, output_path, keep_percent) {
  npm_cache <- tempfile("npm-cache-")
  dir.create(npm_cache, showWarnings = FALSE, recursive = TRUE)
  on.exit(unlink(npm_cache, recursive = TRUE), add = TRUE)
  unlink(output_path)
  args <- c(
    "--yes", "mapshaper", input_path,
    "-simplify", "weighted", "keep-shapes", paste0(keep_percent, "%"),
    "-clean",
    "-o", "precision=0.00001", "format=geojson", output_path
  )
  result <- system2(
    "npx", args,
    stdout = TRUE,
    stderr = TRUE,
    env = paste0("NPM_CONFIG_CACHE=", npm_cache)
  )
  status <- attr(result, "status")
  if (!is.null(status) && status != 0L) {
    stop("mapshaper failed: ", paste(result, collapse = "\n"), call. = FALSE)
  }
  invisible(result)
}

# dissolve the existing municipality boundary product to the eight current kraje.
write_kraj_boundary_product <- function(municipality_boundary_path, municipality_area_table, output_path) {
  boundary <- st_read(municipality_boundary_path, quiet = TRUE)
  if (!"region_code" %in% names(boundary)) {
    stop("municipality boundary lacks region_code for kraj dissolve", call. = FALSE)
  }
  missing_regions <- setdiff(names(kraj_names), unique(boundary[["region_code"]]))
  extra_regions <- setdiff(unique(boundary[["region_code"]]), names(kraj_names))
  if (length(missing_regions) || length(extra_regions)) {
    stop(
      "unexpected kraj codes in municipality boundary; missing=",
      paste(missing_regions, collapse = "|"),
      " extra=",
      paste(extra_regions, collapse = "|"),
      call. = FALSE
    )
  }

  boundary_metric <- st_make_valid(st_transform(boundary, 3035))
  area_by_kraj <- aggregate(
    municipality_area_table[["land_area_sq_km"]],
    by = list(area_code = municipality_area_table[["kraj_kod"]]),
    FUN = sum
  )
  names(area_by_kraj)[2] <- "land_area_sq_km"

  dissolved <- do.call(rbind, lapply(names(kraj_names), function(area_code) {
    index <- which(boundary_metric[["region_code"]] == area_code)
    area_row <- area_by_kraj[area_by_kraj[["area_code"]] == area_code, ]
    st_sf(
      area_code = area_code,
      area_name = unname(kraj_names[[area_code]]),
      area_unit_id = paste0(kraj_boundary_set_id, ":", area_code),
      boundary_set_id = kraj_boundary_set_id,
      boundary_level = "kraj",
      source_boundary_codes = paste(sort(boundary_metric[["area_code"]][index]), collapse = "|"),
      land_area_sq_km = round(area_row[["land_area_sq_km"]], 2),
      geometry = st_union(st_geometry(boundary_metric[index, ]))
    )
  }))
  dissolved <- dissolved[order(dissolved[["area_code"]]), ]

  temp_input <- file.path(tempdir(), "sk_kraj_2021_unsimplified.geojson")
  st_write(st_make_valid(st_transform(dissolved, 4326)), temp_input, delete_dsn = TRUE, quiet = TRUE)

  keep_ladder <- c(75, 50, 35, 25, 15, 10, 7.5, 5, 3, 2, 1)
  chosen_keep <- tail(keep_ladder, 1)
  chosen_bytes <- NA_integer_
  for (keep_percent in keep_ladder) {
    run_mapshaper(temp_input, output_path, keep_percent)
    chosen_bytes <- file_bytes(output_path)
    chosen_keep <- keep_percent
    if (chosen_bytes <= kraj_boundary_target_bytes) break
  }
  if (chosen_bytes > kraj_boundary_target_bytes) {
    stop("simplified SK kraj boundary exceeds target bytes: ", chosen_bytes, call. = FALSE)
  }

  simplified <- st_read(output_path, quiet = TRUE)
  if (nrow(simplified) != length(kraj_names)) {
    stop("kraj boundary output feature count changed during simplification", call. = FALSE)
  }

  list(
    area_table = st_drop_geometry(dissolved)[c("area_code", "area_name", "land_area_sq_km", "source_boundary_codes")],
    source_feature_count = nrow(boundary),
    output_feature_count = row_count_file(output_path),
    output_bytes = chosen_bytes,
    mapshaper_keep_percent = chosen_keep,
    input_bytes = file_bytes(temp_input)
  )
}

# create one schema-shaped area-summary row for one municipality.
build_area_row <- function(count_row, area_table) {
  area <- area_table[match(count_row[["area_code"]], area_table[["area_code"]]), ]
  if (nrow(area) != 1L || is.na(area[["land_area_sq_km"]])) {
    stop("missing boundary metadata for ", count_row[["area_code"]], call. = FALSE)
  }

  total <- as.numeric(count_row[["population_total"]])
  religious_affiliation <- as.numeric(count_row[["religious_affiliation_count"]])
  no_religion <- as.numeric(count_row[["no_religion_count"]])

  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = "municipality",
    area_unit_id = paste0(boundary_set_id, ":", count_row[["area_code"]]),
    area_code = count_row[["area_code"]],
    area_name = count_row[["area_name"]],
    year = year,
    population_total = as.integer(total),
    population_total_basis = "SODB 2021 total population denominator used in published shares; includes the category nezistené / not found out",
    religious_affiliation_count = as.integer(religious_affiliation),
    religious_affiliation_percent = null_if_na(round(100 * religious_affiliation / total, 2)),
    no_religion_count = as.integer(no_religion),
    no_religion_percent = null_if_na(round(100 * no_religion / total, 2)),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(area[["land_area_sq_km"]], 2),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = c(census_2021_dataset_id, boundary_dataset_id),
    quality_flag = "sodb_published_total_denominator_includes_nezistene"
  )
}

# flatten area-summary rows for the CSV sibling.
flatten_rows <- function(rows) {
  # keep JSON null scalars from turning the one-row CSV data frame into zero rows.
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
      population_total = row[["population_total"]],
      population_total_basis = row[["population_total_basis"]],
      religious_affiliation_count = row[["religious_affiliation_count"]],
      religious_affiliation_percent = csv_scalar(row[["religious_affiliation_percent"]], NA_real_),
      no_religion_count = row[["no_religion_count"]],
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

# create source-dataset records for the municipality document.
source_datasets_municipality <- function() {
  list(
    list(
      source_dataset_id = census_2021_dataset_id,
      name = "SODB 2021 Z01_15: Structure of population by religious belief",
      provider = "Statistical Office of the Slovak Republic",
      url = basic_results_url,
      retrieval_date = retrieval_date,
      local_path = district_dir,
      licence = list(
        name = "SODB public website assets; attribution to the Statistical Office of the Slovak Republic",
        url = content_operator_url,
        attribution = "Statistical Office of the Slovak Republic"
      ),
      citation = "Statistical Office of the Slovak Republic. SODB 2021 basic results, Z01_15 Structure of population by religious belief.",
      access_limits = NULL,
      redistribution_limits = "Raw JSON files are not committed; derived public products attribute SUSR and link to the source.",
      notes = "The product uses 79 official district-scoped municipality JSON files. The denominator is the SODB total population denominator, including nezistené / not found out, to match SUSR's published percentages."
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "SODB 2021 OB GeoJSON municipality and city-part boundaries",
      provider = "Statistical Office of the Slovak Republic",
      url = boundary_url,
      retrieval_date = retrieval_date,
      local_path = boundary_raw_path,
      licence = list(
        name = "SODB public website assets; attribution to the Statistical Office of the Slovak Republic",
        url = content_operator_url,
        attribution = "Statistical Office of the Slovak Republic"
      ),
      citation = "Statistical Office of the Slovak Republic. SODB 2021 DISem OB GeoJSON boundary layer.",
      access_limits = NULL,
      redistribution_limits = "Raw GeoJSON is not committed; simplified derived boundary GeoJSON attributes SUSR and links to the source.",
      notes = "The raw GeoJSON includes 87 non-output helper features and 2,927 municipality/city-part output features. Bratislava and Košice are represented by city parts, matching SODB basic-results reporting."
    )
  )
}

# create source-dataset records for the kraj companion product.
source_datasets_kraj <- function() {
  c(
    list(
      list(
        source_dataset_id = census_2001_dataset_id,
        name = "Infostat SODB 2001 data118: Obyvateľstvo podľa pohlavia a náboženstva",
        provider = "Statistical Office of the Slovak Republic / Infostat",
        url = paste0(infostat_2001_base_url, "/format.htm"),
        retrieval_date = retrieval_date,
        local_path = infostat_2001_dir,
        licence = list(
          name = "SUSR attribution; exact previous-census reuse statement not located",
          url = previous_censuses_url,
          attribution = "Štatistický úrad Slovenskej republiky"
        ),
        citation = "Štatistický úrad Slovenskej republiky / Infostat. SODB 2001 data118, Obyvateľstvo podľa pohlavia a náboženstva.",
        access_limits = NULL,
        redistribution_limits = "Raw HTML files are not committed; derived public products attribute SUSR and link to the exact routes.",
        notes = "Used for the eight current kraj rows and national reconciliation row. Religious affiliation sums every reported category except Bez vyznania, Nezistené, and Spolu; Nezistené remains in the denominator."
      ),
      list(
        source_dataset_id = census_2011_dataset_id,
        name = "SODB 2011 TAB. 118: Obyvateľstvo podľa pohlavia a náboženského vyznania",
        provider = "Statistical Office of the Slovak Republic",
        url = "https://census2011.statistics.sk/tabulky.html",
        retrieval_date = retrieval_date,
        local_path = sodb_2011_dir,
        licence = list(
          name = "SUSR attribution; exact SODB 2011 archive reuse statement not located",
          url = previous_censuses_url,
          attribution = "Štatistický úrad Slovenskej republiky"
        ),
        citation = "Štatistický úrad Slovenskej republiky. SODB 2011 multidimensional table TAB. 118, Obyvateľstvo podľa pohlavia a náboženského vyznania.",
        access_limits = NULL,
        redistribution_limits = "Raw XLS files are not committed; derived public products attribute SUSR and link to the exact routes.",
        notes = "Used for the eight current kraj rows and national reconciliation row. Religious affiliation sums every reported category except Bez vyznania, Nezistené, and Spolu; Iné remains in religious affiliation and Nezistené remains in the denominator."
      )
    ),
    source_datasets_municipality()
  )
}

# create shared indicator metadata for the municipality product.
indicators_for_municipality <- function() {
  denominator_note <- paste(
    "SODB 2021 publishes category shares against total population.",
    "The denominator includes the not-found-out category (nezistené)."
  )
  list(
    list(
      indicator_id = "population_total",
      label = "SODB total population denominator",
      description = "Total population in the SODB 2021 municipality or city-part reporting unit.",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "SODB Z01_15 table category total.",
      temporal_coverage = "2021",
      spatial_coverage = "Slovakia municipalities and Bratislava/Košice city parts in SODB 2021.",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious affiliation %",
      description = "Share of total population in any SODB religious-belief category other than no religion and not found out.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * (total - code 28 bez náboženského vyznania - code 00 nezistené) / total.",
      temporal_coverage = "2021",
      spatial_coverage = "Slovakia municipalities and Bratislava/Košice city parts in SODB 2021.",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "No religion %",
      description = "Share of total population in SODB code 28, bez náboženského vyznania.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * code 28 bez náboženského vyznania / total.",
      temporal_coverage = "2021",
      spatial_coverage = "Slovakia municipalities and Bratislava/Košice city parts in SODB 2021.",
      quality_notes = denominator_note
    )
  )
}

# create shared indicator metadata for the kraj companion product.
indicators_for_kraj <- function() {
  denominator_note <- paste(
    "Each wave uses the source total-population denominator.",
    "The not-stated category, Nezistené, remains in the denominator and outside religious affiliation."
  )
  list(
    list(
      indicator_id = "population_total",
      label = "Census total population denominator",
      description = "Total population in the kraj reporting unit for the census wave.",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "Infostat 2001 and SODB 2011 TAB. 118 Spolu; SODB 2021 municipality product summed to kraj.",
      temporal_coverage = "2001, 2011, 2021",
      spatial_coverage = "Eight current Slovakia kraje.",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious affiliation %",
      description = "Share of total population in any reported religious-affiliation category other than no religion and not stated.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * religious_affiliation_count / population_total, where religious_affiliation_count excludes Bez vyznania and Nezistené.",
      temporal_coverage = "2001, 2011, 2021",
      spatial_coverage = "Eight current Slovakia kraje.",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "No religion %",
      description = "Share of total population in Bez vyznania / bez náboženského vyznania.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * no_religion_count / population_total.",
      temporal_coverage = "2001, 2011, 2021",
      spatial_coverage = "Eight current Slovakia kraje.",
      quality_notes = denominator_note
    )
  )
}

# define the choropleth layers exposed by the shared region map.
visual_layers_for_municipality <- function() {
  list(
    list(
      visual_layer_id = "sk-municipality-religious-affiliation",
      label = "Religious affiliation %",
      description = "Slovakia SODB 2021 religious-affiliation share.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "SODB total population"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = "The denominator includes the SODB not-found-out category."
    ),
    list(
      visual_layer_id = "sk-municipality-no-religion",
      label = "No religion %",
      description = "Slovakia SODB 2021 no-religion share.",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "SODB total population"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = "No religion is SODB code 28, bez náboženského vyznania."
    )
  )
}

# define companion-product choropleth layer metadata for kraje.
visual_layers_for_kraj <- function() {
  list(
    list(
      visual_layer_id = "sk-kraj-religious-affiliation",
      label = "Religious affiliation %",
      description = "Slovakia kraj religious-affiliation share for 2001, 2011, and 2021.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "census total population"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported kraj value for 2001/2011; exact municipality sum for 2021",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = "The denominator includes Nezistené / not stated."
    ),
    list(
      visual_layer_id = "sk-kraj-no-religion",
      label = "No religion %",
      description = "Slovakia kraj no-religion share for 2001, 2011, and 2021.",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "census total population"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported kraj value for 2001/2011; exact municipality sum for 2021",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = "No religion is Bez vyznania in 2001/2011 and SODB code 28 in 2021."
    )
  )
}

# create a schema-compatible municipality area-summary document.
area_summary_document <- function(rows) {
  list(
    schema_version = "0.2.0",
    generated_at = stamp,
    generated_by = script_id,
    country_code = country_code,
    boundary_set = list(
      boundary_set_id = boundary_set_id,
      country_code = country_code,
      level = "municipality",
      vintage = "2021",
      source_dataset_id = boundary_dataset_id
    ),
    site_snapshot = list(
      source_dataset_id = NULL,
      snapshot_date = NULL,
      basis = "no governed Slovakia OpenStreetMap place-of-worship snapshot is included in this country data-map release",
      notes = "The Slovakia page exposes SODB 2021 religious-affiliation and no-religion metrics only; place-density metrics are hidden until a governed Slovakia place layer is built."
    ),
    source_datasets = source_datasets_municipality(),
    indicators = indicators_for_municipality(),
    visual_layers = visual_layers_for_municipality(),
    rows = rows
  )
}

# create a schema-compatible kraj companion area-summary document.
kraj_area_summary_document <- function(rows) {
  list(
    schema_version = "0.2.0",
    generated_at = stamp,
    generated_by = script_id,
    country_code = country_code,
    boundary_set = list(
      boundary_set_id = kraj_boundary_set_id,
      country_code = country_code,
      level = "kraj",
      vintage = "2021 current kraje",
      source_dataset_id = boundary_dataset_id
    ),
    site_snapshot = list(
      source_dataset_id = NULL,
      snapshot_date = NULL,
      basis = "no governed Slovakia OpenStreetMap place-of-worship snapshot is included in this companion product",
      notes = "The kraj companion product contains census religious-affiliation and no-religion metrics only."
    ),
    source_datasets = source_datasets_kraj(),
    indicators = indicators_for_kraj(),
    visual_layers = visual_layers_for_kraj(),
    rows = rows
  )
}

# create a manifest durable-file record for one generated output.
manifest_file_record <- function(path, content, licence_status_value = licence_status) {
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

# create one manifest raw-source record.
raw_source_record <- function(path, url, dataset_id, used, periods, notes) {
  list(
    uri = path,
    url = url,
    format = sub("^.*\\.", "", path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    row_count = row_count_file(path),
    source_dataset_id = dataset_id,
    used_in_public_product = used,
    periods = periods,
    notes = notes
  )
}

# create manifest raw-source records for every required SODB 2021 JSON file.
raw_source_records_2021 <- function(required_paths) {
  district_records <- lapply(district_codes, function(code) {
    path <- file.path(district_dir, paste0("Z01_15_OK_", code, "_OB.json"))
    raw_source_record(
      path,
      sprintf(district_url_pattern, code),
      census_2021_dataset_id,
      TRUE,
      "2021",
      paste0("SODB 2021 Z01_15 municipality rows for district ", code, ".")
    )
  })
  other_records <- list(
    raw_source_record(
      national_path,
      national_url,
      census_2021_dataset_id,
      TRUE,
      "2021",
      "SODB 2021 Z01_15 national row used for exact reconciliation."
    ),
    raw_source_record(
      all_districts_path,
      all_districts_url,
      census_2021_dataset_id,
      FALSE,
      "2021",
      "SODB 2021 Z01_15 district rows downloaded for source-pinning and reporting; municipality product is built from district-scoped municipality files."
    ),
    raw_source_record(
      boundary_raw_path,
      boundary_url,
      boundary_dataset_id,
      TRUE,
      "2021",
      "SODB 2021 OB GeoJSON; 87 helper features are filtered out before writing the municipality boundary product and the municipality product is dissolved to kraje."
    )
  )
  optional_paths <- required_paths[!required_paths %in% c(district_paths(), national_path, all_districts_path, boundary_raw_path)]
  optional_records <- lapply(optional_paths[file.exists(optional_paths)], function(path) {
    dataset <- if (identical(path, time_series_path)) time_series_dataset_id else "sodb2011-source-discovery"
    raw_source_record(
      path,
      if (identical(path, time_series_path)) time_series_url else previous_censuses_url,
      dataset,
      FALSE,
      if (identical(path, time_series_path)) "1880-2021" else "2011",
      "Downloaded during source discovery but not extracted into the public map product."
    )
  })
  c(district_records, other_records, optional_records)
}

# create manifest raw-source records for Infostat 2001 inputs.
raw_source_records_2001 <- function() {
  c(
    list(
      raw_source_record(
        infostat_2001_navigation_path,
        infostat_2001_navigation_url,
        census_2001_dataset_id,
        TRUE,
        "2001",
        "Infostat 2001 navigation tree used to verify the eight current kraj data118 routes."
      ),
      raw_source_record(
        infostat_2001_national_path,
        infostat_2001_national_url,
        census_2001_dataset_id,
        TRUE,
        "2001",
        "Infostat 2001 national data118 table used for exact category reconciliation."
      )
    ),
    lapply(kraj_specs, function(spec) {
      raw_source_record(
        infostat_2001_kraj_path(spec[["infostat_2001_code"]]),
        infostat_2001_kraj_url(spec[["infostat_2001_code"]]),
        census_2001_dataset_id,
        TRUE,
        "2001",
        paste0("Infostat 2001 data118 table for ", spec[["area_name"]], ".")
      )
    })
  )
}

# create manifest raw-source records for SODB 2011 inputs.
raw_source_records_2011 <- function() {
  parent_records <- lapply(unique(vapply(kraj_specs, `[[`, character(1), "parent_slug")), function(slug) {
    spec <- kraj_specs[[match(slug, vapply(kraj_specs, `[[`, character(1), "parent_slug"))]]
    raw_source_record(
      sodb_2011_tree_path(paste0("parent_", slug)),
      sodb_2011_tree_url(spec[["data2011_parent_metadata"]]),
      census_2011_dataset_id,
      TRUE,
      "2011",
      paste0("SODB 2011 data.php parent tree for ", slug, " Slovakia.")
    )
  })
  kraj_tree_records <- lapply(kraj_specs, function(spec) {
    raw_source_record(
      sodb_2011_tree_path(paste0("kraj_", spec[["area_code"]])),
      sodb_2011_tree_url(spec[["data2011_metadata"]]),
      census_2011_dataset_id,
      TRUE,
      "2011",
      paste0("SODB 2011 data.php tree for ", spec[["area_name"]], ".")
    )
  })
  xls_records <- lapply(kraj_specs, function(spec) {
    raw_source_record(
      sodb_2011_kraj_xls_path(spec[["area_code"]]),
      sodb_2011_kraj_xls_source_url(spec),
      census_2011_dataset_id,
      TRUE,
      "2011",
      paste0("SODB 2011 TAB. 118 XLS for ", spec[["area_name"]], ".")
    )
  })
  c(
    list(
      raw_source_record(
        sodb_2011_root_tree_path,
        sodb_2011_tree_url(),
        census_2011_dataset_id,
        TRUE,
        "2011",
        "SODB 2011 root data.php tree used to verify national TAB. 118 and parent folders."
      ),
      raw_source_record(
        sodb_2011_national_xls_path,
        sodb_2011_national_xls_source_url(),
        census_2011_dataset_id,
        TRUE,
        "2011",
        "SODB 2011 national TAB. 118 XLS used for exact category reconciliation."
      )
    ),
    parent_records,
    kraj_tree_records,
    xls_records
  )
}

# compare municipality public metrics with the SODB national row.
validate_national_totals <- function(counts, national_totals) {
  checks <- list(
    list(
      year = year,
      metric = "population_total",
      municipality_sum = sum(counts[["population_total"]]),
      national_total = national_totals[["population_total"]],
      difference = sum(counts[["population_total"]]) - national_totals[["population_total"]]
    ),
    list(
      year = year,
      metric = "religious_affiliation_count",
      municipality_sum = sum(counts[["religious_affiliation_count"]]),
      national_total = national_totals[["religious_affiliation_count"]],
      difference = sum(counts[["religious_affiliation_count"]]) - national_totals[["religious_affiliation_count"]]
    ),
    list(
      year = year,
      metric = "no_religion_count",
      municipality_sum = sum(counts[["no_religion_count"]]),
      national_total = national_totals[["no_religion_count"]],
      difference = sum(counts[["no_religion_count"]]) - national_totals[["no_religion_count"]]
    ),
    list(
      year = year,
      metric = "not_found_out_count",
      municipality_sum = sum(counts[["not_found_out_count"]]),
      national_total = national_totals[["not_found_out_count"]],
      difference = sum(counts[["not_found_out_count"]]) - national_totals[["not_found_out_count"]]
    )
  )
  for (check in checks) {
    if (check[["difference"]] != 0) {
      stop("national validation failed for ", check[["metric"]], call. = FALSE)
    }
  }
  checks
}

# fetch all pinned Infostat 2001 sources needed for the kraj product.
ensure_2001_sources <- function() {
  fetch_file(infostat_2001_navigation_url, infostat_2001_navigation_path)
  fetch_file(infostat_2001_national_url, infostat_2001_national_path)
  for (spec in kraj_specs) {
    fetch_file(
      infostat_2001_kraj_url(spec[["infostat_2001_code"]]),
      infostat_2001_kraj_path(spec[["infostat_2001_code"]])
    )
  }
}

# return the XLS href for TAB. 118 from one 2011 data.php tree file.
find_2011_tab118_xls_href <- function(tree_path) {
  tree <- fromJSON(tree_path, simplifyVector = FALSE)
  hrefs <- unlist(lapply(tree, function(node) {
    href <- node[["data"]][["attr"]][["href"]]
    title <- node[["data"]][["title"]]
    if (is.null(href) || is.null(title)) return(NULL)
    if (!grepl("TAB\\. 118", title, fixed = FALSE)) return(NULL)
    if (!grepl("\\.xls$", href, ignore.case = TRUE)) return(NULL)
    href
  }), use.names = FALSE)
  if (length(hrefs) != 1L) stop("expected one 2011 TAB. 118 XLS href in ", tree_path, call. = FALSE)
  hrefs[[1]]
}

# return the full national XLS URL resolved from the cached 2011 root tree.
sodb_2011_national_xls_source_url <- function() {
  paste0(sodb_2011_base_url, "/", find_2011_tab118_xls_href(sodb_2011_root_tree_path))
}

# return the full kraj XLS URL resolved from the cached 2011 kraj tree.
sodb_2011_kraj_xls_source_url <- function(spec) {
  tree_path <- sodb_2011_tree_path(paste0("kraj_", spec[["area_code"]]))
  paste0(sodb_2011_base_url, "/", find_2011_tab118_xls_href(tree_path))
}

# fetch all pinned SODB 2011 data.php trees and TAB. 118 XLS sources.
ensure_2011_sources <- function() {
  fetch_file(sodb_2011_tree_url(), sodb_2011_root_tree_path, insecure = TRUE)
  national_href <- find_2011_tab118_xls_href(sodb_2011_root_tree_path)
  national_xls_url <- paste0(sodb_2011_base_url, "/", national_href)
  fetch_file(national_xls_url, sodb_2011_national_xls_path, insecure = TRUE)

  parent_slugs <- unique(vapply(kraj_specs, `[[`, character(1), "parent_slug"))
  for (slug in parent_slugs) {
    spec <- kraj_specs[[match(slug, vapply(kraj_specs, `[[`, character(1), "parent_slug"))]]
    fetch_file(
      sodb_2011_tree_url(spec[["data2011_parent_metadata"]]),
      sodb_2011_tree_path(paste0("parent_", slug)),
      insecure = TRUE
    )
  }

  for (index in seq_along(kraj_specs)) {
    spec <- kraj_specs[[index]]
    tree_path <- sodb_2011_tree_path(paste0("kraj_", spec[["area_code"]]))
    fetch_file(sodb_2011_tree_url(spec[["data2011_metadata"]]), tree_path, insecure = TRUE)
    href <- find_2011_tab118_xls_href(tree_path)
    xls_url <- paste0(sodb_2011_base_url, "/", href)
    fetch_file(xls_url, sodb_2011_kraj_xls_path(spec[["area_code"]]), insecure = TRUE)
  }
}

# verify the 2001 navigation includes exactly the expected kraj table routes.
validate_2001_navigation <- function() {
  text <- rawToChar(readBin(infostat_2001_navigation_path, "raw", n = file_bytes(infostat_2001_navigation_path)))
  Encoding(text) <- "bytes"
  missing <- vapply(kraj_specs, function(spec) {
    !grepl(paste0("txtUroven=", spec[["infostat_2001_code"]], "&okr=0"), text, fixed = TRUE, useBytes = TRUE)
  }, logical(1))
  if (any(missing)) {
    stop("2001 navigation missing expected kraj codes: ", paste(vapply(kraj_specs[missing], `[[`, character(1), "infostat_2001_code"), collapse = ", "), call. = FALSE)
  }
  list(
    expected_kraj_count = length(kraj_specs),
    matched_kraj_count = length(kraj_specs),
    source_codes = as.list(vapply(kraj_specs, `[[`, character(1), "infostat_2001_code"))
  )
}

# read one Infostat 2001 HTML religion table.
read_infostat_2001_table <- function(path, area_code, area_name, source_code) {
  doc <- read_html(path)
  table <- xml_find_first(doc, ".//table[contains(@class, 'tabulka')]")
  if (inherits(table, "xml_missing")) stop("missing Infostat 2001 data table: ", path, call. = FALSE)
  rows <- xml_find_all(table, ".//tr")
  parsed <- lapply(rows, function(row) {
    cells <- xml_find_all(row, ".//th|.//td")
    normalise_label(xml_text(cells))
  })
  data_rows <- parsed[vapply(parsed, length, integer(1)) == 4L]
  data_rows <- data_rows[vapply(data_rows, function(row) row[[1]] != "Náboženské vyznanie / cirkev", logical(1))]
  geography_label <- normalise_label(xml_text(xml_find_first(doc, ".//*[@id='LabUzemie']")))
  result <- do.call(rbind, lapply(data_rows, function(row) {
    data.frame(
      year = 2001L,
      area_code = area_code,
      area_name = area_name,
      source_area_code = source_code,
      source_area_name = geography_label,
      category = row[[1]],
      male_count = parse_count(row[[2]]),
      female_count = parse_count(row[[3]]),
      total_count = parse_count(row[[4]]),
      stringsAsFactors = FALSE
    )
  }))
  if (any(result[["male_count"]] + result[["female_count"]] != result[["total_count"]])) {
    stop("Infostat 2001 sex totals do not sum in ", path, call. = FALSE)
  }
  result
}

# read one SODB 2011 TAB. 118 XLS religion table.
read_sodb_2011_table <- function(path, area_code, area_name) {
  raw <- read_excel(path, col_names = FALSE, .name_repair = "minimal")
  categories <- normalise_label(raw[[1]])
  header_index <- which(categories == "Náboženské vyznanie")[[1]]
  source_area_name <- categories[[header_index + 1L]]
  rows <- raw[(header_index + 2L):nrow(raw), ]
  rows <- rows[!is.na(rows[[4]]), ]
  result <- data.frame(
    year = 2011L,
    area_code = area_code,
    area_name = area_name,
    source_area_code = area_code,
    source_area_name = source_area_name,
    category = normalise_label(rows[[1]]),
    male_count = as.numeric(rows[[2]]),
    female_count = as.numeric(rows[[3]]),
    total_count = as.numeric(rows[[4]]),
    stringsAsFactors = FALSE
  )
  if (any(result[["male_count"]] + result[["female_count"]] != result[["total_count"]])) {
    stop("SODB 2011 sex totals do not sum in ", path, call. = FALSE)
  }
  result
}

# map a full source category table into the public headline construct.
category_counts_to_headlines <- function(category_rows, source_dataset_id, boundary_dataset = boundary_dataset_id) {
  categories <- category_rows[["category"]]
  required <- c("Bez vyznania", "Nezistené", "Spolu")
  missing <- setdiff(required, categories)
  if (length(missing)) {
    stop("missing required category: ", paste(missing, collapse = ", "), call. = FALSE)
  }
  total <- category_rows[category_rows[["category"]] == "Spolu", "total_count"]
  no_religion <- category_rows[category_rows[["category"]] == "Bez vyznania", "total_count"]
  not_stated <- category_rows[category_rows[["category"]] == "Nezistené", "total_count"]
  religious_categories <- setdiff(categories, required)
  religious_affiliation <- sum(category_rows[category_rows[["category"]] %in% religious_categories, "total_count"])
  if (religious_affiliation + no_religion + not_stated != total) {
    stop("category mapping does not reconstruct Spolu for ", category_rows[["area_name"]][[1]], call. = FALSE)
  }
  list(
    area_code = category_rows[["area_code"]][[1]],
    area_name = category_rows[["area_name"]][[1]],
    year = category_rows[["year"]][[1]],
    population_total = total,
    religious_affiliation_count = religious_affiliation,
    no_religion_count = no_religion,
    not_stated_count = not_stated,
    source_dataset_ids = c(source_dataset_id, boundary_dataset),
    religious_categories = religious_categories
  )
}

# create one schema-shaped area-summary row for one kraj and wave.
build_kraj_area_row <- function(counts, kraj_area_table) {
  area <- kraj_area_table[match(counts[["area_code"]], kraj_area_table[["area_code"]]), ]
  if (nrow(area) != 1L || is.na(area[["land_area_sq_km"]])) {
    stop("missing kraj boundary metadata for ", counts[["area_code"]], call. = FALSE)
  }

  total <- as.numeric(counts[["population_total"]])
  religious_affiliation <- as.numeric(counts[["religious_affiliation_count"]])
  no_religion <- as.numeric(counts[["no_religion_count"]])
  basis <- if (counts[["year"]] == 2001L) {
    "Infostat 2001 data118 Spolu total population denominator; Nezistené remains in the denominator and outside religious_affiliation_count"
  } else if (counts[["year"]] == 2011L) {
    "SODB 2011 TAB. 118 Spolu total population denominator; Nezistené remains in the denominator and outside religious_affiliation_count"
  } else {
    "SODB 2021 municipality product total population denominator; code 00 nezistené / not found out remains in the denominator and outside religious_affiliation_count"
  }
  flag <- if (counts[["year"]] == 2021L) {
    "aggregated_from_2021_municipality_product;sodb_published_total_denominator_includes_nezistene"
  } else {
    "source_kraj_row_current_kraj_geography;nezistene_in_denominator"
  }

  list(
    country_code = country_code,
    boundary_set_id = kraj_boundary_set_id,
    boundary_level = "kraj",
    area_unit_id = paste0(kraj_boundary_set_id, ":", counts[["area_code"]]),
    area_code = counts[["area_code"]],
    area_name = counts[["area_name"]],
    year = counts[["year"]],
    population_total = as.integer(total),
    population_total_basis = basis,
    religious_affiliation_count = as.integer(religious_affiliation),
    religious_affiliation_percent = null_if_na(round(100 * religious_affiliation / total, 2)),
    no_religion_count = as.integer(no_religion),
    no_religion_percent = null_if_na(round(100 * no_religion / total, 2)),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(area[["land_area_sq_km"]], 2),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = counts[["source_dataset_ids"]],
    quality_flag = flag
  )
}

# validate category-level sums against the national row for one source year.
validate_category_reconciliation <- function(kraj_category_rows, national_category_rows, source_label) {
  category_sums <- aggregate(
    kraj_category_rows[["total_count"]],
    by = list(category = kraj_category_rows[["category"]]),
    FUN = sum
  )
  names(category_sums)[2] <- "kraj_sum"
  national <- national_category_rows[, c("category", "total_count")]
  names(national)[2] <- "national_total"
  merged <- merge(category_sums, national, by = "category", all = TRUE)
  merged[["difference"]] <- merged[["kraj_sum"]] - merged[["national_total"]]
  if (any(is.na(merged[["difference"]])) || any(merged[["difference"]] != 0)) {
    stop(source_label, " category reconciliation failed", call. = FALSE)
  }
  lapply(seq_len(nrow(merged)), function(index) {
    list(
      category = merged[["category"]][[index]],
      kraj_sum = merged[["kraj_sum"]][[index]],
      national_total = merged[["national_total"]][[index]],
      difference = merged[["difference"]][[index]]
    )
  })
}

# convert municipality area-summary JSON rows into a data frame for kraj aggregation.
read_municipality_product_rows <- function(path) {
  parsed <- fromJSON(path, simplifyVector = FALSE)
  do.call(rbind, lapply(parsed[["rows"]], function(row) {
    data.frame(
      area_code = row[["area_code"]],
      area_name = row[["area_name"]],
      year = row[["year"]],
      population_total = row[["population_total"]],
      religious_affiliation_count = row[["religious_affiliation_count"]],
      no_religion_count = row[["no_religion_count"]],
      not_stated_count = row[["population_total"]] - row[["religious_affiliation_count"]] - row[["no_religion_count"]],
      stringsAsFactors = FALSE
    )
  }))
}

# aggregate the existing 2021 municipality product to current kraje.
aggregate_2021_municipality_product_to_kraj <- function(municipality_rows, municipality_area_table) {
  joined <- merge(
    municipality_rows,
    municipality_area_table[, c("area_code", "kraj_kod")],
    by = "area_code",
    all.x = TRUE,
    sort = FALSE
  )
  if (any(is.na(joined[["kraj_kod"]]))) {
    stop("municipality product rows missing kraj membership", call. = FALSE)
  }
  split_rows <- split(joined, joined[["kraj_kod"]])
  lapply(names(kraj_names), function(area_code) {
    rows <- split_rows[[area_code]]
    list(
      area_code = area_code,
      area_name = unname(kraj_names[[area_code]]),
      year = 2021L,
      population_total = sum(rows[["population_total"]]),
      religious_affiliation_count = sum(rows[["religious_affiliation_count"]]),
      no_religion_count = sum(rows[["no_religion_count"]]),
      not_stated_count = sum(rows[["not_stated_count"]]),
      source_dataset_ids = c(census_2021_dataset_id, boundary_dataset_id)
    )
  })
}

# verify SODB municipality codes embed the same kraj prefix as the boundary join.
validate_embedded_kraj_codes <- function(municipality_rows, municipality_area_table) {
  joined <- merge(
    municipality_rows[, c("area_code"), drop = FALSE],
    municipality_area_table[, c("area_code", "kraj_kod")],
    by = "area_code",
    all.x = TRUE,
    sort = FALSE
  )
  embedded <- substr(joined[["area_code"]], 1L, 5L)
  mismatch <- joined[embedded != joined[["kraj_kod"]], ]
  if (nrow(mismatch)) {
    stop("municipality codes do not embed kraj membership", call. = FALSE)
  }
  list(
    checked_municipality_rows = nrow(joined),
    mismatches = 0L,
    rule = "substr(area_code, 1, 5) equals SODB OB GeoJSON kraj_kod"
  )
}

# validate exact 2021 kraj sums against the existing municipality product.
validate_kraj_2021_rollup <- function(kraj_counts, municipality_rows) {
  checks <- lapply(c("population_total", "religious_affiliation_count", "no_religion_count", "not_stated_count"), function(metric) {
    kraj_sum <- sum(vapply(kraj_counts, function(row) row[[metric]], numeric(1)))
    municipality_sum <- sum(municipality_rows[[metric]])
    list(
      year = 2021L,
      metric = metric,
      kraj_sum = kraj_sum,
      municipality_product_sum = municipality_sum,
      difference = kraj_sum - municipality_sum
    )
  })
  for (check in checks) {
    if (check[["difference"]] != 0) stop("2021 kraj roll-up failed for ", check[["metric"]], call. = FALSE)
  }
  checks
}

# create a compact category-mapping record for manifest and review.
category_mapping_table <- function() {
  list(
    list(
      year = 2001,
      population_total = "Spolu",
      religious_affiliation_count = "All reported categories except Bez vyznania, Nezistené, and Spolu; includes Ostatné.",
      no_religion_count = "Bez vyznania",
      not_stated_excluded_category = "Nezistené",
      denominator = "Spolu, with Nezistené retained in the denominator"
    ),
    list(
      year = 2011,
      population_total = "Spolu",
      religious_affiliation_count = "All reported categories except Bez vyznania, Nezistené, and Spolu; includes Iné.",
      no_religion_count = "Bez vyznania",
      not_stated_excluded_category = "Nezistené",
      denominator = "Spolu, with Nezistené retained in the denominator"
    ),
    list(
      year = 2021,
      population_total = "SODB Z01_15 total",
      religious_affiliation_count = "SODB Z01_15 total minus code 28 bez náboženského vyznania and code 00 nezistené.",
      no_religion_count = "Code 28 bez náboženského vyznania",
      not_stated_excluded_category = "Code 00 nezistené",
      denominator = "SODB total population, with code 00 nezistené retained in the denominator"
    )
  )
}

required_sources <- c(district_paths(), national_path, all_districts_path, boundary_raw_path)
for (path in required_sources) require_file(path)

ensure_2001_sources()
ensure_2011_sources()
navigation_validation <- validate_2001_navigation()

district_json <- lapply(district_paths(), read_district_file)
counts <- do.call(rbind, district_json)
counts <- counts[order(counts[["area_code"]]), ]
if (nrow(counts) != length(unique(counts[["area_code"]]))) {
  stop("duplicate SODB municipality codes in district files", call. = FALSE)
}
if (nrow(counts) != 2927L) stop("expected 2,927 SODB municipality/city-part rows", call. = FALSE)

national_totals <- read_national_totals(national_path)
national_validation <- validate_national_totals(counts, national_totals)

boundary_info <- write_boundary_product(boundary_raw_path, counts[["area_code"]])
area_table <- boundary_info[["area_table"]]

rows <- lapply(seq_len(nrow(counts)), function(index) {
  build_area_row(as.list(counts[index, ]), area_table)
})

write_json(area_summary_document(rows), summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

kraj_boundary_info <- write_kraj_boundary_product(boundary_out, area_table, kraj_boundary_out)
kraj_area_table <- kraj_boundary_info[["area_table"]]

tables_2001 <- lapply(kraj_specs, function(spec) {
  read_infostat_2001_table(
    infostat_2001_kraj_path(spec[["infostat_2001_code"]]),
    spec[["area_code"]],
    spec[["area_name"]],
    spec[["infostat_2001_code"]]
  )
})
kraj_categories_2001 <- do.call(rbind, tables_2001)
national_categories_2001 <- read_infostat_2001_table(infostat_2001_national_path, "SK", "Slovakia", "100000")
category_validation_2001 <- validate_category_reconciliation(
  kraj_categories_2001,
  national_categories_2001,
  "2001 Infostat"
)
counts_2001 <- lapply(tables_2001, category_counts_to_headlines, source_dataset_id = census_2001_dataset_id)

tables_2011 <- lapply(kraj_specs, function(spec) {
  read_sodb_2011_table(sodb_2011_kraj_xls_path(spec[["area_code"]]), spec[["area_code"]], spec[["area_name"]])
})
kraj_categories_2011 <- do.call(rbind, tables_2011)
national_categories_2011 <- read_sodb_2011_table(sodb_2011_national_xls_path, "SK", "Slovakia")
category_validation_2011 <- validate_category_reconciliation(
  kraj_categories_2011,
  national_categories_2011,
  "2011 SODB"
)
counts_2011 <- lapply(tables_2011, category_counts_to_headlines, source_dataset_id = census_2011_dataset_id)

municipality_product_rows <- read_municipality_product_rows(summary_json_out)
embedded_kraj_validation <- validate_embedded_kraj_codes(municipality_product_rows, area_table)
counts_2021 <- aggregate_2021_municipality_product_to_kraj(municipality_product_rows, area_table)
kraj_2021_validation <- validate_kraj_2021_rollup(counts_2021, municipality_product_rows)

kraj_count_rows <- c(counts_2001, counts_2011, counts_2021)
kraj_rows <- lapply(kraj_count_rows, build_kraj_area_row, kraj_area_table = kraj_area_table)
write_json(kraj_area_summary_document(kraj_rows), kraj_summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(kraj_rows), kraj_summary_csv_out, row.names = FALSE, na = "")

join_coverage <- list(
  year = year,
  matched_area_count = length(intersect(counts[["area_code"]], area_table[["area_code"]])),
  expected_area_count = nrow(counts),
  missing_area_names = list()
)

kraj_join_coverage <- lapply(c(2001L, 2011L, 2021L), function(wave) {
  wave_rows <- kraj_count_rows[vapply(kraj_count_rows, function(row) row[["year"]] == wave, logical(1))]
  wave_codes <- unique(vapply(wave_rows, function(row) row[["area_code"]], character(1)))
  boundary_codes <- unique(kraj_area_table[["area_code"]])
  missing_codes <- setdiff(boundary_codes, wave_codes)
  list(
    year = wave,
    matched_area_count = length(intersect(wave_codes, boundary_codes)),
    expected_area_count = length(kraj_names),
    missing_area_names = as.list(unname(kraj_names[missing_codes]))
  )
})

validation_checks <- c(
  "SODB 2021 Z01_15 municipality rows were downloaded as 79 official district-scoped JSON files.",
  "The 2,927 SODB municipality/city-part rows have unique official area codes.",
  "All 2,927 SODB municipality/city-part rows join exactly to the OB GeoJSON municipality/city-part features.",
  "Municipality sums match the SODB national row exactly for total population, religious affiliation, no religion, and not found out.",
  sprintf("The simplified municipality boundary GeoJSON writes to %d bytes after %d m simplification.", boundary_info[["output_bytes"]], boundary_info[["simplification_tolerance_m"]]),
  "SODB 2021 percentages use the total population denominator, including the not-found-out category, matching SUSR's published shares.",
  "Infostat 2001 data118 HTML kraj rows reconcile exactly to the 2001 national data118 row for every reported category.",
  "SODB 2011 TAB. 118 XLS kraj rows reconcile exactly to the 2011 national TAB. 118 XLS row for every reported category.",
  "The 2021 kraj product is aggregated from the existing municipality product rows, and its national sums are identical to the municipality product sums.",
  sprintf("The dissolved kraj boundary GeoJSON writes to %d bytes after mapshaper weighted keep-shapes at %s%% keep.", kraj_boundary_info[["output_bytes"]], kraj_boundary_info[["mapshaper_keep_percent"]])
)

municipality_summary_sha <- sha256_file(summary_json_out)
kraj_summary_sha <- sha256_file(kraj_summary_json_out)
summary_sha <- sha256_values(c(municipality_summary_sha, kraj_summary_sha))
manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = paste0("manifest:sk-census-religion:sk:2001-2021:", substr(summary_sha, 1, 12)),
  dataset_id = "sk-census-religion:sk:2001-2021:sodb-infostat",
  dataset_version_id = paste0("sk-census-religion:sk:2001-2021:sodb-infostat:", substr(summary_sha, 1, 12)),
  manifest_sha256 = NULL,
  supersedes_manifest_id = "manifest:sk-census-religion:sk:2021:sodb2021-z01-15",
  superseded_by_manifest_id = NULL,
  dataset_family = "sk-census-religion",
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
      waves = c("2001", "2011", "2021"),
      municipality_boundary_set = boundary_set_id,
      kraj_boundary_set = kraj_boundary_set_id,
      municipality_boundary_simplification_tolerance_m = boundary_info[["simplification_tolerance_m"]],
      kraj_boundary_mapshaper_keep_percent = kraj_boundary_info[["mapshaper_keep_percent"]],
      denominator = "All Slovakia waves use the source total population denominator; Nezistené / not found out remains in the denominator and outside religious_affiliation_count.",
      omitted_metrics = c("religious_change", "places_per_10000_residents", "place_density_per_sq_km")
    ),
    software_versions = list(
      r = paste(R.version[["major"]], R.version[["minor"]], sep = "."),
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")),
      readxl = as.character(packageVersion("readxl")),
      xml2 = as.character(packageVersion("xml2")),
      mapshaper = "npx --yes mapshaper 0.7.33 or current npx-resolved package"
    )
  ),
  source = list(
    provider = "Statistical Office of the Slovak Republic; Infostat",
    source_dataset_ids = c(census_2001_dataset_id, census_2011_dataset_id, census_2021_dataset_id, boundary_dataset_id),
    source_urls = c(
      infostat_2001_navigation_url,
      infostat_2001_national_url,
      vapply(kraj_specs, function(spec) infostat_2001_kraj_url(spec[["infostat_2001_code"]]), character(1)),
      sodb_2011_tree_url(),
      sodb_2011_national_xls_source_url(),
      vapply(kraj_specs, sodb_2011_kraj_xls_source_url, character(1)),
      basic_results_url,
      national_url,
      all_districts_url,
      boundary_url,
      previous_censuses_url,
      content_operator_url
    ),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = licence_text,
    citation = "Štatistický úrad Slovenskej republiky / Infostat SODB 2001 data118; Štatistický úrad Slovenskej republiky SODB 2011 TAB. 118; Statistical Office of the Slovak Republic SODB 2021 basic results Z01_15 and DISem OB GeoJSON.",
    raw_redistribution = "Raw SODB JSON, Infostat HTML, SODB 2011 XLS, GeoJSON, and source-discovery files are not committed. They remain in data/raw/sk_census/ and await any project-controlled raw archive upload."
  ),
  input_manifests = list(),
  raw_sources = c(
    raw_source_records_2001(),
    raw_source_records_2011(),
    raw_source_records_2021(c(required_sources, time_series_path, hypercube_metadata_path, codebook_path))
  ),
  durable_files = list(
    manifest_file_record(summary_json_out, "Slovakia municipality/city-part area summary with SODB 2021 religious-belief metrics."),
    manifest_file_record(summary_csv_out, "Flattened Slovakia municipality/city-part area summary with SODB 2021 religious-belief metrics."),
    manifest_file_record(boundary_out, "Simplified Slovakia SODB 2021 municipality/city-part boundary GeoJSON."),
    manifest_file_record(kraj_summary_json_out, "Slovakia current-kraj area summary with 2001, 2011, and 2021 census religious-belief metrics."),
    manifest_file_record(kraj_summary_csv_out, "Flattened Slovakia current-kraj area summary with 2001, 2011, and 2021 census religious-belief metrics."),
    manifest_file_record(kraj_boundary_out, "Simplified Slovakia current-kraj boundary GeoJSON dissolved from the SODB 2021 municipality boundary product.")
  ),
  derived_outputs = list(
    list(
      uri = paste0("repo:", summary_json_out),
      sha256 = municipality_summary_sha,
      built_by = script_id,
      notes = "2,927 SODB municipality/city-part reporting units x 1 census year; denominator is SODB total population including not found out."
    ),
    list(
      uri = paste0("repo:", boundary_out),
      sha256 = sha256_file(boundary_out),
      built_by = script_id,
      notes = sprintf("SODB 2021 OB municipality/city-part layer simplified at %d m tolerance.", boundary_info[["simplification_tolerance_m"]])
    ),
    list(
      uri = paste0("repo:", kraj_summary_json_out),
      sha256 = kraj_summary_sha,
      built_by = script_id,
      notes = "8 current Slovakia kraje x 3 waves. The 2001 and 2011 rows use source kraj tables; 2021 rows are exact sums of the municipality product."
    ),
    list(
      uri = paste0("repo:", kraj_boundary_out),
      sha256 = sha256_file(kraj_boundary_out),
      built_by = script_id,
      notes = sprintf("SODB 2021 municipality boundary product dissolved to 8 current kraje and simplified with mapshaper weighted keep-shapes at %s%% keep.", kraj_boundary_info[["mapshaper_keep_percent"]])
    )
  ),
  validation = list(
    checks = validation_checks,
    join_coverage = list(municipality = list(join_coverage), kraj = kraj_join_coverage),
    national_validation = list(
      municipality_2021 = national_validation,
      kraj_2001_categories = category_validation_2001,
      kraj_2011_categories = category_validation_2011,
      kraj_2021_from_municipality = kraj_2021_validation
    ),
    category_mapping = category_mapping_table(),
    embedded_kraj_code_validation = embedded_kraj_validation,
    navigation_validation_2001 = navigation_validation,
    boundary_validation = list(
      municipality = list(
        source_feature_count = boundary_info[["source_feature_count"]],
        municipality_output_feature_count = boundary_info[["output_feature_count"]],
        expected_municipality_feature_count = boundary_info[["expected_feature_count"]],
        parent_helper_feature_count_filtered = boundary_info[["parent_helper_feature_count"]],
        output_bytes = boundary_info[["output_bytes"]],
        simplification_tolerance_m = boundary_info[["simplification_tolerance_m"]],
        missing_boundary_codes = as.list(boundary_info[["missing_boundary_codes"]]),
        extra_boundary_codes = as.list(boundary_info[["extra_boundary_codes"]])
      ),
      kraj = list(
        source = "Dissolved from repo:apps/regions/sk/data/sk_municipality_2021.geojson, which is derived from the SODB 2021 OB GeoJSON and carries region_code / kraj membership.",
        source_feature_count = kraj_boundary_info[["source_feature_count"]],
        output_feature_count = kraj_boundary_info[["output_feature_count"]],
        output_bytes = kraj_boundary_info[["output_bytes"]],
        input_bytes = kraj_boundary_info[["input_bytes"]],
        mapshaper_keep_percent = kraj_boundary_info[["mapshaper_keep_percent"]],
        target_bytes = kraj_boundary_target_bytes
      )
    )
  ),
  construct_notes = list(
    "The public map displays two headline metrics for 2021: religious affiliation percent and no religion percent.",
    "The companion kraj product displays the same headline metrics for 2001, 2011, and 2021.",
    "Religious affiliation count is total population minus no religion and Nezistené / not found out. This matches the existing SODB 2021 municipality denominator convention.",
    "For 2001, religious_affiliation_count sums all data118 categories except Bez vyznania, Nezistené, and Spolu; Ostatné is included in religious affiliation.",
    "For 2011, religious_affiliation_count sums all TAB. 118 categories except Bez vyznania, Nezistené, and Spolu; Iné is included in religious affiliation.",
    "For 2021, the kraj rows aggregate the existing municipality product by SODB area-code prefix and OB GeoJSON kraj_kod; code 00 nezistené remains in the denominator.",
    "No cross-wave denomination crosswalk is attempted."
  ),
  deferred_sources = list(
    list(
      source_dataset_id = time_series_dataset_id,
      url = time_series_url,
      local_path = time_series_path,
      notes = "Downloaded national time-series file C01_11, 'Number of population by religious belief in the Slovak Republic in 1880-2021'. It is not used in the map because its time-series categories collapse 'other and not found out', which prevents the requested no-religion/not-ascertained denominator treatment."
    ),
    list(
      source_dataset_id = deferred_1991_dataset_id,
      url = paste0(infostat_1991_base_url, "/format.htm"),
      local_path = NULL,
      status = "deferred",
      geography = "source district/obvod and macro-region geography",
      notes = "1991 is deferred because the Infostat source has 42 district/obvod rows and three macro-regions, while current kraje did not exist until 1996. No official correspondence to the current eight kraje was pinned. A future ruling could publish 1991 at its own source geography."
    )
  ),
  privacy = "public",
  licence_status = licence_status,
  downstream_status = "public",
  source_datasets = source_datasets_kraj(),
  notes = "The committed products contain derived area summaries and simplified boundaries only. On-page attribution cites SUSR, Infostat, SODB 2011, and SODB 2021 source pages."
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
manifest_text <- paste(readLines(manifest_out, warn = FALSE), collapse = "\n")
if (!jsonlite::validate(manifest_text)) stop("manifest JSON failed jsonlite validation", call. = FALSE)

cat(sprintf("wrote %s: %d rows\n", summary_json_out, length(rows)))
cat(sprintf("wrote %s: %d rows\n", summary_csv_out, row_count_file(summary_csv_out)))
cat(sprintf("wrote %s: %d features, %d bytes\n", boundary_out, row_count_file(boundary_out), file_bytes(boundary_out)))
cat(sprintf("wrote %s: %d rows\n", kraj_summary_json_out, length(kraj_rows)))
cat(sprintf("wrote %s: %d rows\n", kraj_summary_csv_out, row_count_file(kraj_summary_csv_out)))
cat(sprintf("wrote %s: %d features, %d bytes, keep %s%%\n", kraj_boundary_out, row_count_file(kraj_boundary_out), file_bytes(kraj_boundary_out), kraj_boundary_info[["mapshaper_keep_percent"]]))
cat(sprintf("wrote %s\n", manifest_out))
cat(sprintf("join coverage: municipality %d/%d; kraj 8/8\n", join_coverage[["matched_area_count"]], join_coverage[["expected_area_count"]]))
cat("national validations: exact\n")
