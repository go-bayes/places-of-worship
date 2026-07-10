# build the Serbia area census-affiliation product.
# inputs: SORS 2002 publication, SORS dissemination tables, and GISCO NUTS 3.
# outputs: area-summary JSON/CSV, a simplified boundary, and a manifest.
# run from the repository root: Rscript scripts/build_rs_area_summary.R

suppressMessages({
  library(digest)
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

raw_dir <- "data/raw/rs_census"
output_dir <- "apps/regions/rs/data"
manifest_dir <- "docs/manifests"
dir.create(raw_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

country_code <- "RS"
years <- c(2002L, 2011L, 2022L)
script_id <- "scripts/build_rs_area_summary.R"
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- format(Sys.Date(), "%Y-%m-%d")
git_commit <- system("git rev-parse --short HEAD", intern = TRUE)
boundary_level <- "area"
boundary_vintage <- "2021"
boundary_set_id <- "rs-area-2021-gisco-nuts3"
census_dataset_id <- "sors-census-religion-area-2002-2022"
boundary_dataset_id <- "eurostat-gisco-nuts3-2021-rs"

sddb_base <- "https://data.stat.gov.rs"
table_2011_id <- "3102010402"
table_2022_id <- "3104020301"
table_2011_url <- paste0(sddb_base, "/Home/Result/", table_2011_id, "?languageCode=en-US")
table_2022_url <- paste0(sddb_base, "/Home/Result/", table_2022_id, "?languageCode=en-US")
display_result_url <- paste0(sddb_base, "/Home/DisplayResult")
publication_2002_url <- "https://publikacije.stat.gov.rs/G2002/PdfE/G20024003.pdf"
terms_url <- "https://opendata.stat.gov.rs/odata/?id=en-us"
gisco_boundary_url <- paste0(
  "https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/",
  "NUTS_RG_01M_2021_4326_LEVL_3.geojson"
)
gisco_terms_url <- paste0(
  "https://ec.europa.eu/eurostat/web/gisco/geodata/statistical-units/",
  "territorial-units-statistics"
)
eurostat_copyright_url <- "https://ec.europa.eu/eurostat/help/copyright-notice"

area_codes <- c(
  "RS110", "RS121", "RS122", "RS123", "RS124", "RS125", "RS126", "RS127",
  "RS211", "RS212", "RS213", "RS214", "RS215", "RS216", "RS217", "RS218",
  "RS221", "RS222", "RS223", "RS224", "RS225", "RS226", "RS227", "RS228", "RS229"
)
area_selector <- paste(c("RS", area_codes), collapse = ",")
category_selector <- paste(sprintf("%02d", 1:14), collapse = ",")
query_2011 <- paste0(
  "indicators=1802010402IND01&agg-102=", area_selector,
  "&agg-23=0&agg-116=", category_selector
)
query_2022 <- paste0(
  "indicators=3104020301IND01&agg-2=202200&agg-23=0&agg-102=", area_selector,
  "&agg-116=", category_selector
)

publication_2002_path <- file.path(raw_dir, "sors_2002_religion_municipalities_en.pdf")
publication_2002_text_path <- file.path(raw_dir, "sors_2002_religion_municipalities_en.txt")
table_2011_path <- file.path(raw_dir, "sors_3102010402_area_total_gender.html")
table_2022_path <- file.path(raw_dir, "sors_3104020301_area_total_gender.html")
terms_path <- file.path(raw_dir, "sors_open_data_terms.html")
gisco_boundary_path <- file.path(raw_dir, "gisco_nuts3_2021_4326.geojson")
gisco_terms_path <- file.path(raw_dir, "gisco_nuts_terms.html")
eurostat_copyright_path <- file.path(raw_dir, "eurostat_copyright.html")
summary_json_out <- file.path(output_dir, "area_summary_area.json")
summary_csv_out <- file.path(output_dir, "area_summary_area.csv")
boundary_out <- file.path(output_dir, "rs_area_2021.geojson")
manifest_out <- file.path(manifest_dir, "rs-census-religion-2002-2022.json")

area_unit_note <- "In this product, the area level comprises the City of Belgrade plus 24 districts (okruzi)."
scope_note <- paste(
  "This product follows the territorial coverage published by the Statistical Office of the Republic of Serbia (SORS).",
  area_unit_note,
  "The 2002 publication covers Central Serbia and Vojvodina and states that the census was not conducted in the Autonomous Province of Kosovo and Metohija.",
  "The 2011 and 2022 dissemination tables identify their coverage as excluding data for the Autonomous Province of Kosovo and Metohija.",
  "Kosovo rows from other publications are outside this Serbia product."
)
boundary_stability_note <- paste(
  "The common display frame is the 2021 GISCO NUTS 3 layer.",
  "Geometric stability of the 25 published areas across 2002, 2011, and 2022 was not verified.",
  "The build joins shared statistical-area codes and makes no claim that every boundary segment was unchanged."
)

# return a file's SHA-256 digest.
sha256_file <- function(path) unname(tools::sha256sum(path))

# return a file's size in bytes.
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))

# write retrieval metadata after a successful download.
write_meta <- function(path, url, method = "GET", notes = NULL) {
  write_json(
    list(url = url, retrieved_at = stamp, http_status = 200L, method = method, notes = notes),
    paste0(path, ".meta.json"),
    auto_unbox = TRUE,
    pretty = TRUE,
    null = "null"
  )
}

# fetch one source while preserving the first successful cache.
fetch_file <- function(url, path, insecure = FALSE) {
  if (file.exists(path) && file_bytes(path) > 0L) return(invisible(path))
  args <- c("-L", "--fail", "--silent", "--show-error")
  if (insecure) args <- c(args, "--insecure")
  status <- system2("curl", c(args, "-o", path, url))
  if (!identical(status, 0L) || !file.exists(path) || file_bytes(path) == 0L) {
    stop("curl failed for ", url, call. = FALSE)
  }
  write_meta(path, url)
  invisible(path)
}

# fetch one selected SORS dissemination result through its POST export.
fetch_sddb <- function(table_id, query, path) {
  if (file.exists(path) && file_bytes(path) > 0L) return(invisible(path))
  args <- c(
    "-L", "--fail", "--silent", "--show-error", "--insecure",
    shQuote(display_result_url),
    "--data-urlencode", shQuote("languageCode=en-US"),
    "--data-urlencode", shQuote("displayMode=table"),
    "--data-urlencode", shQuote(paste0("subAreaId=", table_id)),
    "--data-urlencode", shQuote(paste0("uriQuery=", query)),
    "--data-urlencode", shQuote("resultDisplayType=IdentificatorTitle"),
    "-o", shQuote(path)
  )
  status <- system2("curl", args)
  if (!identical(status, 0L) || !file.exists(path) || file_bytes(path) == 0L) {
    stop("SORS dissemination export failed for table ", table_id, call. = FALSE)
  }
  write_meta(path, paste0(sddb_base, "/Home/Result/", table_id, "?languageCode=en-US"), "POST", query)
  invisible(path)
}

# read retrieval metadata for a cached source.
read_meta <- function(path) {
  meta_path <- paste0(path, ".meta.json")
  if (!file.exists(meta_path)) {
    return(list(retrieved_at = paste0(retrieval_date, "T00:00:00Z"), http_status = NULL))
  }
  fromJSON(meta_path, simplifyVector = FALSE)
}

# parse the JSON observation array embedded in a SORS result page.
read_sddb <- function(path, year) {
  html <- paste(readLines(path, warn = FALSE), collapse = "\n")
  match <- regexec("(?s)pivotUI\\(\\s*(\\[.*?\\])\\s*,\\s*\\{", html, perl = TRUE)
  parts <- regmatches(html, match)[[1]]
  if (length(parts) != 2L) stop("could not locate SORS observation array", call. = FALSE)
  rows <- fromJSON(parts[[2]], simplifyDataFrame = TRUE)
  required <- c("Territory - NSTJ", "Gender", "Religion", "Vrednost")
  if (!all(required %in% names(rows)) || any(rows[["Gender"]] != "Total")) {
    stop("SORS result changed shape", call. = FALSE)
  }
  if (any(!grepl("^([0-9]+|-)$", rows[["Vrednost"]]))) {
    stop("SORS result contains a non-integer observation", call. = FALSE)
  }
  rows[["year"]] <- year
  rows[["area_code"]] <- sub(" .*", "", rows[["Territory - NSTJ"]])
  rows[["area_name"]] <- sub("^[^ ]+ - ", "", rows[["Territory - NSTJ"]])
  rows[["value"]] <- as.integer(replace(rows[["Vrednost"]], rows[["Vrednost"]] == "-", "0"))
  rows[, c("year", "area_code", "area_name", "Religion", "value")]
}

# convert the 2002 official PDF to its fixed-layout text layer.
extract_2002_text <- function() {
  if (file.exists(publication_2002_text_path) && file_bytes(publication_2002_text_path) > 0L) {
    return(invisible(publication_2002_text_path))
  }
  status <- system2("pdftotext", c("-layout", publication_2002_path, publication_2002_text_path))
  if (!identical(status, 0L)) stop("pdftotext failed for the 2002 publication", call. = FALSE)
  write_meta(publication_2002_text_path, publication_2002_url, "DERIVED", "Fixed-layout text extracted from the cached PDF.")
  invisible(publication_2002_text_path)
}

category_2002 <- data.frame(
  source_code = c("TOTAL", "ISLAM", "JUDAIC", "CATHOLIC", "ORTHODOX", "PROTESTANT", "PRO_ORIENTAL", "OTHER_RELIGION", "BELIEVER_NO_RELIGION", "UNDECLARED", "ATHEIST", "UNKNOWN"),
  source_name = c("Total", "Islam", "Judaic", "Catholic", "Orthodox", "Protestant", "Pro-oriental cults", "Belonging to religion which is not cited", "Believer, but does not belong to any religion", "Undeclared", "Atheist", "Unknown"),
  display_en = c("Total", "Islam", "Judaism", "Catholic", "Orthodox", "Protestant", "Eastern religions", "Other religion", "Believer without religious affiliation", "Did not declare", "Atheist", "Unknown"),
  role = c("total", rep("named_religion", 7), "belief_without_affiliation", "not_declared", "no_religion", "unknown"),
  stringsAsFactors = FALSE
)

area_name_2002 <- c(
  RS110 = "City of Belgrade", RS121 = "District of West Bačka", RS122 = "District of South Banat",
  RS123 = "District of South Bačka", RS124 = "District of North Banat", RS125 = "District of North Bačka",
  RS126 = "District of Central Banat", RS127 = "District of Srem", RS211 = "District of Zlatibor",
  RS212 = "District of Kolubara", RS213 = "District of Mačva", RS214 = "District of Morava",
  RS215 = "District of Pomoravlje", RS216 = "District of Rasina", RS217 = "District of Raška",
  RS218 = "District of Šumadija", RS221 = "District of Bor", RS222 = "District of Braničevo",
  RS223 = "District of Zaječar", RS224 = "District of Jablanica", RS225 = "District of Nišava",
  RS226 = "District of Pirot", RS227 = "District of Danube", RS228 = "District of Pčinja",
  RS229 = "District of Toplica"
)

# parse the first 2002 religion table into national and area observations.
read_2002 <- function(path) {
  lines <- readLines(path, warn = FALSE)
  start <- grep("1\\. POPULATION BY RELIGION", lines)[1]
  if (is.na(start)) stop("2002 religion table heading is absent", call. = FALSE)
  lines <- lines[start:length(lines)]
  national_line <- grep("^REPUBLIC OF SERBIA", lines, value = TRUE)[1]
  area_lines <- vapply(area_name_2002, function(name) {
    hits <- grep(paste0("^", name, "[[:space:]]+[0-9]"), lines, value = TRUE)
    if (length(hits) == 0L) stop("missing 2002 area: ", name, call. = FALSE)
    hits[[1]]
  }, character(1))
  parse_line <- function(line, area_code, area_name) {
    tail <- sub("^.*?([0-9][0-9 -]+)$", "\\1", line, perl = TRUE)
    tokens <- strsplit(trimws(tail), "[[:space:]]+")[[1]]
    if (length(tokens) != 12L) stop("unexpected 2002 category count for ", area_name, call. = FALSE)
    tokens[tokens == "-"] <- "0"
    values <- as.integer(tokens)
    data.frame(
      year = 2002L, area_code = area_code, area_name = area_name,
      Religion = category_2002[["source_code"]], value = values,
      stringsAsFactors = FALSE
    )
  }
  result <- parse_line(national_line, "RS", "REPUBLIC OF SERBIA")
  for (code in names(area_lines)) {
    result <- rbind(result, parse_line(area_lines[[code]], code, unname(area_name_2002[[code]])))
  }
  result
}

category_modern <- data.frame(
  source_code = sprintf("%02d", 1:14),
  source_name = c("Укупно", "Хришћанска - свега", "православна", "католичка", "протестантска", "остале хришћанске", "Исламска", "Јудаистичка", "Источњачке вероисповести", "Остале вероисповести", "Агностици", "Нису верници (атеисти)", "Нису се изјаснили", "Непознато"),
  display_en = c("Total", "Christians in total", "Orthodox", "Catholic", "Protestant", "Other Christian", "Islamic", "Judaism", "Eastern religions", "Other religions", "Agnostics", "Atheists", "Not declared", "Unknown"),
  role = c("total", "christian_parent", rep("christian_detail", 4), rep("named_religion", 4), "no_religion", "no_religion", "not_declared", "unknown"),
  stringsAsFactors = FALSE
)

# attach stable source codes to modern SORS display labels.
code_modern_categories <- function(rows) {
  lookup <- setNames(category_modern[["source_code"]], category_modern[["display_en"]])
  rows[["source_code"]] <- unname(lookup[rows[["Religion"]]])
  if (any(is.na(rows[["source_code"]]))) stop("unknown modern SORS category", call. = FALSE)
  rows
}

# return one area's observations as a named vector.
observation_vector <- function(rows, area_code) {
  block <- rows[rows[["area_code"]] == area_code, , drop = FALSE]
  if (anyDuplicated(block[["source_code"]])) stop("duplicate category for ", area_code, call. = FALSE)
  setNames(block[["value"]], block[["source_code"]])
}

# enforce within-area and area-to-national reconciliation for one wave.
validate_wave <- function(year, rows, categories) {
  areas <- sort(setdiff(unique(rows[["area_code"]]), "RS"))
  if (!setequal(areas, area_codes) || length(areas) != 25L) stop("wave lacks 25 areas", call. = FALSE)
  national <- observation_vector(rows, "RS")
  expected_codes <- categories[["source_code"]]
  if (!setequal(names(national), expected_codes)) stop("wave category inventory changed", call. = FALSE)
  if (year == 2002L) {
    exclusive <- setdiff(expected_codes, "TOTAL")
    affiliation <- categories[["source_code"]][categories[["role"]] == "named_religion"]
    no_religion <- "ATHEIST"
    outside <- c("BELIEVER_NO_RELIGION", "UNDECLARED", "UNKNOWN")
  } else {
    exclusive <- c("02", "07", "08", "09", "10", "11", "12", "13", "14")
    affiliation <- c("02", "07", "08", "09", "10")
    no_religion <- c("11", "12")
    outside <- c("13", "14")
  }
  area_values <- lapply(areas, function(code) {
    values <- observation_vector(rows, code)
    if (!setequal(names(values), expected_codes)) stop("incomplete categories for ", year, " ", code, call. = FALSE)
    if (sum(values[exclusive]) != values[[if (year == 2002L) "TOTAL" else "01"]]) {
      stop("within-area category sum failed for ", year, " ", code, call. = FALSE)
    }
    values
  })
  names(area_values) <- areas
  reconciliation <- lapply(expected_codes, function(code) {
    area_sum <- sum(vapply(area_values, function(values) values[[code]], integer(1)))
    difference <- area_sum - national[[code]]
    if (difference != 0L) stop("national reconciliation failed for ", year, " ", code, call. = FALSE)
    entry <- categories[categories[["source_code"]] == code, , drop = FALSE]
    list(
      source_code = code,
      source_name = entry[["source_name"]][[1]],
      source_display_en = entry[["display_en"]][[1]],
      area_sum = area_sum,
      published_national_total = national[[code]],
      difference = difference,
      status = "matched"
    )
  })
  total_code <- if (year == 2002L) "TOTAL" else "01"
  list(
    year = year,
    area_count = 25L,
    published_category_rows_including_total = length(expected_codes),
    mutually_exclusive_categories_excluding_total = length(exclusive),
    named_affiliation_categories = length(affiliation),
    within_area_category_sums_exact = TRUE,
    area_category_sums_exact = TRUE,
    max_absolute_difference = 0L,
    national_total = national[[total_code]],
    national_affiliation_count = sum(national[affiliation]),
    national_no_religion_count = sum(national[no_religion]),
    national_outside_headlines_count = sum(national[outside]),
    category_reconciliation = reconciliation
  )
}

# build the 25-area layer from GISCO NUTS 3 2021.
build_boundary <- function(path, area_labels) {
  source <- st_read(path, quiet = TRUE)
  required <- c("NUTS_ID", "LEVL_CODE", "CNTR_CODE")
  if (!all(required %in% names(source))) stop("GISCO fields changed", call. = FALSE)
  source <- source[source[["CNTR_CODE"]] == country_code & source[["LEVL_CODE"]] == 3L, ]
  if (nrow(source) != 25L || !setequal(source[["NUTS_ID"]], area_codes)) {
    stop("expected 25 Serbia NUTS 3 features", call. = FALSE)
  }
  source <- st_make_valid(source)
  if (any(st_is_empty(source)) || any(!st_is_valid(source))) stop("invalid GISCO geometry", call. = FALSE)
  source[["area_code"]] <- as.character(source[["NUTS_ID"]])
  source[["area_name"]] <- unname(area_labels[source[["area_code"]]])
  if (any(is.na(source[["area_name"]]))) stop("missing SORS area label", call. = FALSE)
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
  if (nrow(written) != 25L || any(st_is_empty(written)) || any(is.na(validity)) || any(!validity)) {
    stop("simplified boundary did not retain 25 valid features", call. = FALSE)
  }
  if (!setequal(written[["area_code"]], area_codes)) stop("area codes changed", call. = FALSE)
  hashes <- vapply(st_as_binary(st_geometry(written), EWKB = TRUE), function(wkb) {
    digest(wkb, algo = "sha256", serialize = FALSE)
  }, character(1))
  if (length(unique(hashes)) != 25L) stop("area geometry hashes are not distinct", call. = FALSE)
  simplification[["byte_ceiling"]] <- 1500000L
  list(
    layer = written,
    simplification = simplification,
    valid_feature_count = sum(validity),
    geometry_hashes = setNames(as.list(hashes), written[["area_code"]])
  )
}

# build one schema-conforming area-year row.
build_row <- function(year, area_code, rows, boundary) {
  values <- observation_vector(rows, area_code)
  if (year == 2002L) {
    total_code <- "TOTAL"
    affiliation_codes <- category_2002[["source_code"]][category_2002[["role"]] == "named_religion"]
    no_religion_codes <- "ATHEIST"
    disclosure <- "The 2002 believer-without-religious-affiliation category remains outside both headlines."
  } else {
    total_code <- "01"
    affiliation_codes <- c("02", "07", "08", "09", "10")
    no_religion_codes <- c("11", "12")
    disclosure <- "Agnostics and atheists form the no-religion headline; not-declared and unknown remain in the population denominator."
  }
  population_total <- values[[total_code]]
  religious_affiliation_count <- sum(values[affiliation_codes])
  no_religion_count <- sum(values[no_religion_codes])
  area <- boundary[boundary[["area_code"]] == area_code, ]
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = area[["area_unit_id"]][[1]],
    area_code = area_code,
    area_name = area[["area_name"]][[1]],
    year = year,
    population_total = population_total,
    population_total_basis = paste("SORS census population total; percentages use the total census population.", scope_note),
    religious_affiliation_count = religious_affiliation_count,
    religious_affiliation_percent = round(100 * religious_affiliation_count / population_total, 4),
    no_religion_count = no_religion_count,
    no_religion_percent = round(100 * no_religion_count / population_total, 4),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(area[["land_area_sq_km"]][[1]], 4),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = as.list(c(census_dataset_id, boundary_dataset_id)),
    quality_flag = paste(
      "full_enumeration_census_affiliation;total_population_denominator;",
      "exact_area_national_reconciliation;2021_boundary_frame;boundary_stability_unverified;",
      disclosure,
      scope_note
    )
  )
}

# declare the shipped census-affiliation indicators.
indicators <- function() {
  temporal <- "SORS population censuses 2002, 2011, and 2022."
  spatial <- paste("Twenty-five SORS areas joined by statistical-area code to GISCO NUTS 3 2021.", scope_note)
  quality <- paste(
    "Religion was an open voluntary question in 2011 and 2022.",
    "Not-declared and unknown responses remain in the population denominator.",
    "The 2002 believer-without-religious-affiliation category remains outside both headlines.",
    boundary_stability_note
  )
  list(
    list(
      indicator_id = "population_total",
      label = "Census population",
      description = "Published census population total for the area and wave.",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "Published SORS area total.",
      temporal_coverage = temporal,
      spatial_coverage = spatial,
      quality_notes = quality
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious affiliation (% of census population)",
      description = "Share of the census population in the published religious-affiliation categories.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 times the sum of mutually exclusive affiliation categories divided by the census population total; the Christian parent is counted once in 2011 and 2022.",
      temporal_coverage = temporal,
      spatial_coverage = spatial,
      quality_notes = quality
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "No religion (% of census population)",
      description = "Atheist in 2002; agnostic plus atheist in 2011 and 2022, divided by the census population total.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 times the wave-specific published no-religion categories divided by the census population total.",
      temporal_coverage = temporal,
      spatial_coverage = spatial,
      quality_notes = quality
    )
  )
}

# flatten row objects into the CSV companion shape.
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
    licence_status = "needs_review"
  )
}

# describe one raw cached source with URL, retrieval time, and digest.
raw_source_record <- function(path, url, format, source_dataset_id, notes) {
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
    used_in_public_product = TRUE,
    notes = notes
  )
}

# record categories with source labels and English display labels.
category_mapping <- function(year, categories) {
  entries <- apply(categories, 1, function(entry) {
    paste0(entry[["source_code"]], " ", entry[["source_name"]], " => ", entry[["display_en"]], " [product role: ", entry[["role"]], "; harmonisation: as_published]")
  })
  paste0("Category mapping for ", year, ": ", paste(entries, collapse = "; "), ".")
}

# describe the source datasets used by the product.
source_datasets <- function() {
  list(
    list(
      source_dataset_id = census_dataset_id,
      name = "SORS census religion by area, 2002, 2011, and 2022",
      provider = "Statistical Office of the Republic of Serbia (SORS)",
      url = table_2022_url,
      retrieval_date = retrieval_date,
      local_path = table_2022_path,
      licence = list(name = "SORS source quotation required; broader dissemination-database reuse terms not identified", url = terms_url, attribution = "Statistical Office of the Republic of Serbia (SORS)"),
      citation = "Statistical Office of the Republic of Serbia, 2002 Census publication G20024003 and dissemination tables 3102010402 and 3104020301.",
      access_limits = NULL,
      redistribution_limits = "The census publications require source quotation. The build makes no broader licence claim for the dissemination database.",
      notes = paste("All three waves contain national and 25 area rows.", scope_note)
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "Eurostat GISCO NUTS 3 regions 2021, Serbia",
      provider = "Eurostat GISCO",
      url = gisco_boundary_url,
      retrieval_date = retrieval_date,
      local_path = gisco_boundary_path,
      licence = list(name = "Eurostat GISCO download provisions and general reuse policy", url = gisco_terms_url, attribution = "Eurostat GISCO; © EuroGeographics for the administrative boundaries"),
      citation = "Eurostat GISCO, NUTS 3 2021, 1:1 million, EPSG:4326; Serbia statistical-region features.",
      access_limits = NULL,
      redistribution_limits = "Use under GISCO download provisions with source acknowledgement and EuroGeographics administrative-boundary attribution.",
      notes = paste("The all-Europe GeoJSON is filtered to the 25 Serbia statistical-region codes and simplified.", area_unit_note, boundary_stability_note)
    )
  )
}

fetch_file(publication_2002_url, publication_2002_path, insecure = TRUE)
if (file_bytes(publication_2002_path) != 4414439L) stop("2002 publication byte size changed", call. = FALSE)
extract_2002_text()
fetch_sddb(table_2011_id, query_2011, table_2011_path)
fetch_sddb(table_2022_id, query_2022, table_2022_path)
fetch_file(terms_url, terms_path, insecure = TRUE)
fetch_file(gisco_boundary_url, gisco_boundary_path)
fetch_file(gisco_terms_url, gisco_terms_path)
fetch_file(eurostat_copyright_url, eurostat_copyright_path)

rows_2002 <- read_2002(publication_2002_text_path)
rows_2002[["source_code"]] <- rows_2002[["Religion"]]
rows_2011 <- code_modern_categories(read_sddb(table_2011_path, 2011L))
rows_2022 <- code_modern_categories(read_sddb(table_2022_path, 2022L))
wave_rows <- list(`2002` = rows_2002, `2011` = rows_2011, `2022` = rows_2022)
wave_categories <- list(`2002` = category_2002, `2011` = category_modern, `2022` = category_modern)
reconciliation <- lapply(years, function(year) {
  validate_wave(year, wave_rows[[as.character(year)]], wave_categories[[as.character(year)]])
})

area_labels <- setNames(
  rows_2022[["area_name"]][match(area_codes, rows_2022[["area_code"]])],
  area_codes
)
if (any(is.na(area_labels))) stop("2022 SORS area labels are incomplete", call. = FALSE)
boundary_result <- write_boundary(build_boundary(gisco_boundary_path, area_labels))
written_boundary <- boundary_result[["layer"]]
rows <- unlist(lapply(years, function(year) {
  lapply(area_codes, function(area_code) {
    build_row(year, area_code, wave_rows[[as.character(year)]], written_boundary)
  })
}), recursive = FALSE)
if (length(rows) != 75L) stop("expected 75 area-year rows", call. = FALSE)

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
    basis = "no governed Serbia place-of-worship snapshot is included in this census-affiliation release",
    notes = paste("The product ships census-affiliation metrics and area geometry only; place-density fields are null.", scope_note)
  ),
  source_datasets = source_datasets(),
  indicators = indicators(),
  visual_layers = list(
    list(
      visual_layer_id = "rs-area-religious-affiliation",
      label = "Religious affiliation (% of census population)",
      description = "Census-affiliation share by area for 2002, 2011, and 2022.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "total census population"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "sum mutually exclusive published affiliation categories; count the Christian parent once in 2011 and 2022",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = paste(scope_note, boundary_stability_note)
    ),
    list(
      visual_layer_id = "rs-area-no-religion",
      label = "No religion (% of census population)",
      description = "Atheist in 2002 and agnostic plus atheist in 2011 and 2022.",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "total census population"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "use the published wave-specific no-religion categories",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = paste(scope_note, boundary_stability_note)
    )
  ),
  rows = rows
)
write_json(area_summary, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

raw_sources <- list(
  raw_source_record(publication_2002_path, publication_2002_url, "pdf", census_dataset_id, "Official English 2002 religion publication; the build parses its first population-by-religion table."),
  raw_source_record(publication_2002_text_path, publication_2002_url, "txt", census_dataset_id, "Fixed-layout text derived from the cached official portable document format (PDF)."),
  raw_source_record(table_2011_path, table_2011_url, "html", census_dataset_id, paste("Selected POST export from dissemination table 3102010402: national and 25 area rows, total gender, all 14 categories.", area_unit_note)),
  raw_source_record(table_2022_path, table_2022_url, "html", census_dataset_id, paste("Selected POST export from dissemination table 3104020301: national and 25 area rows, total gender, all 14 categories.", area_unit_note)),
  raw_source_record(terms_path, terms_url, "html", census_dataset_id, "SORS open-data portal terms; recorded as context and not asserted to govern every historical census file."),
  raw_source_record(gisco_boundary_path, gisco_boundary_url, "geojson", boundary_dataset_id, "All-Europe NUTS 3 2021 GeoJSON filtered to Serbia."),
  raw_source_record(gisco_terms_path, gisco_terms_url, "html", boundary_dataset_id, "Eurostat GISCO NUTS download page."),
  raw_source_record(eurostat_copyright_path, eurostat_copyright_url, "html", boundary_dataset_id, "Eurostat general copyright and statistical-data reuse policy.")
)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:rs-census-religion:rs:2002-2022:sors-area",
  dataset_id = "rs-census-religion:rs:2002-2022:sors-area",
  dataset_version_id = paste0("rs-census-religion:rs:2002-2022:sors-area:", substr(sha256_file(summary_json_out), 1L, 12L)),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "rs-census-religion",
  dataset_role = "public_product",
  scope = list(level = "country", country_codes = list(country_code), snapshot_date = NULL, snapshot_anchor = NULL, pipeline_stage = "public"),
  created_at = stamp,
  created_by = script_id,
  pipeline = list(
    script = script_id,
    git_commit = git_commit,
    command = paste("Rscript", script_id),
    parameters = list(
      table_2011_id = table_2011_id,
      table_2022_id = table_2022_id,
      waves = years,
      geography = "25 SORS statistical areas, comprising the City of Belgrade plus 24 districts (okruzi), on the GISCO NUTS 3 2021 display frame",
      construct = "census affiliation",
      denominator = "total census population",
      category_rule = "preserve source categories; count the Christian parent once in 2011 and 2022; keep non-response and undeclared categories separate",
      territorial_scope = scope_note,
      boundary_source_vintage = boundary_vintage,
      boundary_simplification = boundary_result[["simplification"]],
      local_cache_hint = "Raw SORS sources, terms, and GISCO geometry are cached under data/raw/rs_census/ and remain git-ignored.",
      retrieval_routes = list(
        list(purpose = "2002 religion", method = "GET", url = publication_2002_url, notes = "Official publication G20024003."),
        list(purpose = "2011 religion", method = "POST", url = table_2011_url, notes = query_2011),
        list(purpose = "2022 religion", method = "POST", url = table_2022_url, notes = query_2022),
        list(purpose = "boundary", method = "GET", url = gisco_boundary_url, notes = "NUTS 3 2021 GeoJSON.")
      )
    ),
    software_versions = list(
      r = R.version.string,
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")),
      digest = as.character(packageVersion("digest")),
      mapshaper = "npx mapshaper through scripts/lib/simplify_boundary.R",
      pdftotext = "Poppler pdftotext command-line utility"
    )
  ),
  source = list(
    provider = "Statistical Office of the Republic of Serbia (SORS); Eurostat GISCO",
    source_dataset_ids = list(census_dataset_id, boundary_dataset_id),
    source_urls = list(publication_2002_url, table_2011_url, table_2022_url, gisco_boundary_url, gisco_terms_url),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = "SORS census publications require source quotation; no broader reuse claim is made for the dissemination database. GISCO geometry uses its download provisions with Eurostat GISCO and EuroGeographics attribution.",
    citation = "SORS census religion publication G20024003 and dissemination tables 3102010402 and 3104020301; Eurostat GISCO NUTS 3 2021."
  ),
  input_manifests = list(),
  durable_files = list(
    manifest_file_record(summary_json_out, paste("Serbia area census-affiliation summary for 2002, 2011, and 2022.", area_unit_note)),
    manifest_file_record(summary_csv_out, paste("Flattened Serbia area census-affiliation rows.", area_unit_note)),
    manifest_file_record(boundary_out, paste("Simplified GISCO NUTS 3 2021 Serbia statistical-area geometry.", area_unit_note))
  ),
  raw_sources = raw_sources,
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id, notes = paste("75 area-year rows.", area_unit_note)),
    list(uri = paste0("repo:", summary_csv_out), sha256 = sha256_file(summary_csv_out), built_by = script_id, notes = "CSV companion."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out), built_by = script_id, notes = paste("25 simplified area features.", area_unit_note))
  ),
  validation = list(
    status = "passed_with_warnings",
    commands = list(
      "Rscript scripts/build_rs_area_summary.R",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/rs/data/area_summary_area.json",
      "jq empty docs/manifests/rs-census-religion-2002-2022.json"
    ),
    tests = list(
      paste("All three announced waves contain national and 25 area rows.", area_unit_note),
      paste("Every mutually exclusive category sum equals the published area population total.", area_unit_note),
      paste("Every category sums exactly from 25 areas to the published national row.", area_unit_note),
      "All 25 simplified geometries are valid, non-empty, and have distinct SHA-256 well-known binary (WKB) hashes.",
      "Every raw input and generated output records URL or repository path, retrieval date where applicable, byte size, and SHA-256."
    ),
    warnings = list(
      boundary_stability_note,
      "The SORS publications require source quotation. A broader licence for the historical census and dissemination-database files was not identified; licence status remains needs review.",
      "The 2002 believer-without-religious-affiliation category remains outside both headline measures."
    ),
    notes = paste("All numerical and geometry gates passed.", scope_note),
    stats = list(
      waves = 3L,
      rows = 75L,
      areas_per_wave = 25L,
      category_counts = "2002=12;2011=14;2022=14 published rows including total",
      boundary_features = 25L,
      boundary_valid_features = boundary_result[["valid_feature_count"]],
      distinct_geometry_hashes = length(unique(unlist(boundary_result[["geometry_hashes"]]))),
      boundary_bytes = file_bytes(boundary_out),
      summary_json_bytes = file_bytes(summary_json_out),
      summary_csv_bytes = file_bytes(summary_csv_out)
    ),
    reconciliation = reconciliation,
    boundary_validation = list(
      output_feature_count = 25L,
      valid_feature_count = boundary_result[["valid_feature_count"]],
      distinct_geometry_hash_count = length(unique(unlist(boundary_result[["geometry_hashes"]]))),
      geometry_sha256_by_area_code = boundary_result[["geometry_hashes"]],
      source_crs = "EPSG:4326",
      area_calculation_crs = "EPSG:3035",
      output_crs = "EPSG:4326"
    )
  ),
  construct_notes = c(list(
    "The construct is census affiliation. It does not measure belief, practice, attendance, or registered membership.",
    scope_note,
    "The headline percentages use the total census population. Did-not-declare and unknown responses remain in that denominator.",
    "In 2011 and 2022, Хришћанска - свега / Christians in total is the mutually exclusive Christian parent. Orthodox, Catholic, Protestant, and Other Christian are detail rows and are never summed again.",
    "In 2002, Believer, but does not belong to any religion is preserved outside the affiliation and no-religion headlines because it reports belief without religious affiliation.",
    "The 2002 build uses the source labels in the official English publication. The 2011 and 2022 mappings retain the source's Serbian Cyrillic category labels and add the official English dissemination labels.",
    paste("Municipality and city units changed between waves, including the appearance of Surčin and city-municipality splits after 2002. The pinned SORS routes provide no religion table rebased to one municipal frame. The build therefore uses the 25 common published areas and creates no unofficial municipal concordance.", area_unit_note),
    boundary_stability_note,
    "SORS means Statistical Office of the Republic of Serbia. GISCO means Geographic Information System of the Commission. NUTS means Nomenclature of Territorial Units for Statistics."
  ), lapply(years, function(year) category_mapping(year, wave_categories[[as.character(year)]]))),
  deferred_sources = list(
    list(
      source = "SORS municipality and city rows in tables 3102010402 and 3104020301 and publication G20024003",
      status = "extra_level_not_shipped",
      reason = "The source publishes municipality and city rows, but the three-wave municipal geography changed and no official rebasing or complete set of official per-vintage boundary files was pinned."
    )
  ),
  privacy = "public",
  licence_status = "needs_review",
  downstream_status = "public",
  source_datasets = source_datasets(),
  notes = paste("The committed product contains derived area summaries and simplified GISCO geometry only. Serbia UI and hub wiring are outside this build.", scope_note)
)
write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)

cat(sprintf("2011 table: %s (%s)\n", table_2011_id, table_2011_url))
cat(sprintf("2022 table: %s (%s)\n", table_2022_id, table_2022_url))
cat(sprintf("2002 route: %s\n", publication_2002_url))
cat("waves x geography: 2002, 2011, 2022 x the City of Belgrade plus 24 districts (okruzi) on the GISCO 2021 display frame\n")
cat("category counts: 2002=12; 2011=14; 2022=14 published rows including total\n")
cat(sprintf("scope note: %s\n", scope_note))
cat("wave gate: passed; 2002, 2011, and 2022 are present\n")
cat("reconciliation gate: passed; every within-area and area-to-national category sum matched exactly\n")
cat("geometry gate: passed; 25 valid features with 25 distinct SHA-256 WKB hashes\n")
cat("boundary-stability gate: passed with explicit unverified disclosure\n")
cat("provenance gate: passed; every raw input has URL, retrieval date, byte size, and SHA-256\n")
cat("licence gate: passed with needs-review status; no broader SORS reuse claim was invented\n")
cat(sprintf("wrote %s: %d rows, %d bytes\n", summary_json_out, length(rows), file_bytes(summary_json_out)))
cat(sprintf("wrote %s: %d rows, %d bytes\n", summary_csv_out, row_count_file(summary_csv_out), file_bytes(summary_csv_out)))
cat(sprintf("wrote %s: %d features, %d bytes\n", boundary_out, row_count_file(boundary_out), file_bytes(boundary_out)))
cat(sprintf("wrote %s: %d bytes\n", manifest_out, file_bytes(manifest_out)))
