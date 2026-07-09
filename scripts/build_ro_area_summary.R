# build the romania area-summary products from INS census religion tables.
# inputs: 2011 and 2021 RPL religion workbooks, GISCO LAU 2011 and 2021
# GeoJSON, and GISCO NUTS3 2021 GeoJSON under data/raw/ro_census/.
# outputs: apps/regions/ro/data/ro_lau_2021.geojson,
# apps/regions/ro/data/area_summary_lau_2021.{json,csv},
# apps/regions/ro/data/ro_judet_2021.geojson,
# apps/regions/ro/data/area_summary_judet.{json,csv}, and
# docs/manifests/ro-census-religion-2011-2021.json.
# run from the repo root: Rscript scripts/build_ro_area_summary.R

suppressMessages({
  library(dplyr)
  library(jsonlite)
  library(readxl)
  library(sf)
})

raw_dir <- "data/raw/ro_census"
ro_dir <- "apps/regions/ro/data"
manifest_dir <- "docs/manifests"
dir.create(ro_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- "2026-07-09"
script_id <- "scripts/build_ro_area_summary.R"
country_code <- "RO"
boundary_set_id <- "ro-lau-2021-gisco"
boundary_level <- "lau_2021"
judet_boundary_set_id <- "ro-judet-2021-gisco-nuts3"
judet_boundary_level <- "judet"
boundary_dataset_id_2021 <- "gisco-lau-2021-ro"
boundary_dataset_id_2011 <- "gisco-lau-2011-ro"
nuts_dataset_id <- "gisco-nuts3-2021-ro"
census_2021_dataset_id <- "ins-rpl-2021-table-2-04-uat-religion"
census_2011_dataset_id <- "ins-rpl-2011-sr-tab-13-uat-religion"

rpl_2021_url <- "https://www.recensamantromania.ro/wp-content/uploads/2023/06/Tabel-2.04.1-si-Tabel-2.04.2.xlsx"
rpl_2011_url <- "https://www.recensamantromania.ro/wp-content/uploads/2021/11/sR_TAB_13.xls"
rpl_2021_page <- "https://www.recensamantromania.ro/rezultate-rpl-2021/rezultate-definitive/"
rpl_2011_page <- "https://www.recensamantromania.ro/istoric/rpl-2011/"
rpl_2002_page <- "https://www.recensamantromania.ro/rezultate-recensamant-2002/"
rpl_1992_page <- "https://www.recensamantromania.ro/rezultate-recensamant-1992/"
gisco_lau_2021_url <- "https://gisco-services.ec.europa.eu/distribution/v2/lau/geojson/LAU_RG_01M_2021_4326.geojson"
gisco_lau_2011_url <- "https://gisco-services.ec.europa.eu/distribution/v2/lau/geojson/LAU_RG_01M_2011_4326.geojson"
gisco_nuts3_2021_url <- "https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_01M_2021_4326_LEVL_3.geojson"

rpl_2021_path <- file.path(raw_dir, "rpl2021_tabel_2_04_1_2_religion.xlsx")
rpl_2011_path <- file.path(raw_dir, "rpl2011_sr_tab_13_religion_uat.xls")
gisco_lau_2021_path <- file.path(raw_dir, "gisco_lau_2021_4326.geojson")
gisco_lau_2011_path <- file.path(raw_dir, "gisco_lau_2011_4326.geojson")
gisco_nuts3_2021_path <- file.path(raw_dir, "gisco_nuts3_2021_4326.geojson")

boundary_out <- file.path(ro_dir, "ro_lau_2021.geojson")
judet_boundary_out <- file.path(ro_dir, "ro_judet_2021.geojson")
summary_json_out <- file.path(ro_dir, "area_summary_lau_2021.json")
summary_csv_out <- file.path(ro_dir, "area_summary_lau_2021.csv")
judet_summary_json_out <- file.path(ro_dir, "area_summary_judet.json")
judet_summary_csv_out <- file.path(ro_dir, "area_summary_judet.csv")
manifest_out <- file.path(manifest_dir, "ro-census-religion-2011-2021.json")

census_specs <- list(
  `2011` = list(
    year = 2011L,
    dataset_id = census_2011_dataset_id,
    path = rpl_2011_path,
    sheet = 1,
    skip = 6,
    total_col = "c2",
    named_cols = paste0("c", 3:21),
    no_religion_col = "c22",
    atheist_col = "c23",
    agnostic_col = NULL,
    unavailable_col = "c24",
    total_label = "POPULATIA STABILA TOTAL",
    unavailable_label = "Informatie nedisponibila",
    no_religion_labels = c("Fara religie", "Atei"),
    basis = "population with a stated religion response: POPULATIA STABILA TOTAL minus Informatie nedisponibila",
    source_title = "RPL 2011 sR_TAB_13, Populatia stabila dupa religie - judete, municipii, orase, comune"
  ),
  `2021` = list(
    year = 2021L,
    dataset_id = census_2021_dataset_id,
    path = rpl_2021_path,
    sheet = "Tab 2.4.2",
    skip = 6,
    total_col = "c2",
    named_cols = paste0("c", 3:21),
    no_religion_col = "c22",
    atheist_col = "c23",
    agnostic_col = "c24",
    unavailable_col = "c25",
    total_label = "POPULATIA REZIDENTA TOTAL",
    unavailable_label = "Informatie nedisponibila",
    no_religion_labels = c("Fara religie", "Ateu"),
    basis = "population with a stated religion response: POPULATIA REZIDENTA TOTAL minus Informatie nedisponibila",
    source_title = "RPL 2021 final results, Tabel 2.04.2, populatia rezidenta dupa religie pe UAT"
  )
)

county_names <- c(
  "ALBA", "ARAD", "ARGES", "BACAU", "BIHOR", "BISTRITA NASAUD",
  "BOTOSANI", "BRASOV", "BRAILA", "BUZAU", "CARAS SEVERIN",
  "CALARASI", "CLUJ", "CONSTANTA", "COVASNA", "DAMBOVITA",
  "DOLJ", "GALATI", "GIURGIU", "GORJ", "HARGHITA",
  "HUNEDOARA", "IALOMITA", "IASI", "ILFOV", "MARAMURES",
  "MEHEDINTI", "MURES", "NEAMT", "OLT", "PRAHOVA",
  "SATU MARE", "SALAJ", "SIBIU", "SUCEAVA", "TELEORMAN",
  "TIMIS", "TULCEA", "VASLUI", "VALCEA", "VRANCEA", "BUCURESTI"
)

name_corrections <- c(
  "2021|CLUJ|RASCA" = "RISCA",
  "2021|COVASNA|SFANTU GHEORGHE" = "SFANTUL GHEORGHE",
  "2021|GALATI|SUHURLUI" = "SUHURULUI",
  "2021|ILFOV|DOBROESTI" = "DOBROIESTI",
  "2011|ARAD|FANTINELE" = "FANTANELE",
  "2011|BISTRITA NASAUD|SANMIHAIU DE CIMPIE" = "SANMIHAIU DE CAMPIE",
  "2011|BISTRITA NASAUD|SILIVASU DE CIMPIE" = "SILIVASU DE CAMPIE",
  "2011|BRAILA|RIMNICELU" = "RAMNICELU",
  "2011|COVASNA|SFANTU GHEORGHE" = "SFANTUL GHEORGHE",
  "2011|DAMBOVITA|VALENI DIMBOVITA" = "VALENI DAMBOVITA",
  "2011|DAMBOVITA|VIRFURI" = "VARFURI",
  "2011|DOLJ|GINGIOVA" = "GANGIOVA",
  "2011|GALATI|SUHURLUI" = "SUHURULUI",
  "2011|GORJ|TARGU CARBUNESTI" = "TIRGU CARBUNESTI",
  "2011|ILFOV|DOBROESTI" = "DOBROIESTI",
  "2011|SATU MARE|ACIS" = "ACAS",
  "2011|VASLUI|BARLAD" = "BIRLAD"
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
  as.numeric(unname(file.info(path)[["size"]]))
}

# convert an R value to NULL when JSON should carry a missing scalar.
null_if_na <- function(value) {
  if (length(value) == 0L || is.na(value) || !is.finite(value)) return(NULL)
  value
}

# return a compact row count for generated files where cheap to compute.
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

# normalise Romanian names so source and GISCO labels can be compared.
ro_norm <- function(x) {
  x <- toupper(trimws(as.character(x)))
  x <- chartr("ĂÂÎȘŞȚŢăâîșşțţ", "AAISSTTaaisstt", x)
  x <- gsub("[[:punct:]]+", " ", x)
  x <- gsub("\\s+", " ", x)
  trimws(x)
}

# remove administrative prefixes that differ between source and boundary labels.
strip_area_type <- function(x) {
  x <- ro_norm(x)
  x <- sub("^MUNICIPIUL\\s+", "", x)
  x <- sub("^MUNICIPIU\\s+", "", x)
  x <- sub("^ORASUL\\s+", "", x)
  x <- sub("^ORAS\\s+", "", x)
  trimws(x)
}

# parse Romanian census count cells, preserving suppression as NA.
parse_count <- function(value) {
  text <- trimws(as.character(value))
  text[text == "-"] <- "0"
  text[text %in% c("", "*", "NA", "NaN")] <- NA_character_
  text <- gsub("\\s+", "", text)
  suppressWarnings(as.numeric(text))
}

# identify cells where the source uses an asterisk suppression marker.
is_suppressed <- function(value) {
  trimws(as.character(value)) == "*"
}

# apply audited spelling and diacritic corrections before a strict join.
apply_name_corrections <- function(year, county, name) {
  key <- paste(year, county, name, sep = "|")
  out <- name
  hit <- key %in% names(name_corrections)
  out[hit] <- unname(name_corrections[key[hit]])
  out
}

# read a census workbook as text so confidential asterisks are not coerced away.
read_wave_sheet <- function(spec) {
  raw <- read_excel(
    spec[["path"]],
    sheet = spec[["sheet"]],
    skip = spec[["skip"]],
    col_names = FALSE,
    col_types = "text",
    .name_repair = "minimal"
  )
  names(raw) <- paste0("c", seq_len(ncol(raw)))
  raw[["source_row"]] <- seq_len(nrow(raw))
  raw
}

# add parsed count columns and row classes for one census wave.
read_census_wave <- function(spec) {
  raw <- read_wave_sheet(spec)
  raw[["area_label"]] <- as.character(raw[["c1"]])
  raw[["area_norm"]] <- ro_norm(raw[["area_label"]])
  raw[["total_count"]] <- parse_count(raw[[spec[["total_col"]]]])
  raw[["unavailable_count"]] <- parse_count(raw[[spec[["unavailable_col"]]]])
  raw[["no_religion_component"]] <- parse_count(raw[[spec[["no_religion_col"]]]])
  raw[["atheist_component"]] <- parse_count(raw[[spec[["atheist_col"]]]])
  raw[["agnostic_component"]] <- if (is.null(spec[["agnostic_col"]])) 0 else {
    parse_count(raw[[spec[["agnostic_col"]]]])
  }
  raw[["unavailable_suppressed"]] <- is_suppressed(raw[[spec[["unavailable_col"]]]])
  raw[["no_religion_suppressed"]] <- is_suppressed(raw[[spec[["no_religion_col"]]]])
  raw[["atheist_suppressed"]] <- is_suppressed(raw[[spec[["atheist_col"]]]])
  raw[["agnostic_suppressed"]] <- if (is.null(spec[["agnostic_col"]])) FALSE else {
    is_suppressed(raw[[spec[["agnostic_col"]]]])
  }
  named_suppressed <- rowSums(as.data.frame(lapply(
    spec[["named_cols"]],
    function(col) is_suppressed(raw[[col]])
  ))) > 0
  raw[["named_religion_suppressed"]] <- named_suppressed

  rows <- raw[!is.na(raw[["total_count"]]), , drop = FALSE]
  rows[["row_kind"]] <- "uat"
  rows[["row_kind"]][rows[["area_norm"]] == "ROMANIA"] <- "national"
  rows[["row_kind"]][
    rows[["area_norm"]] %in% county_names & rows[["total_count"]] > 100000
  ] <- "county"
  rows[["row_kind"]][grepl("^A MUNICIPII", rows[["area_norm"]])] <- "group"
  rows[["row_kind"]][grepl("^B COMUNE", rows[["area_norm"]])] <- "group"
  rows[["row_kind"]][grepl("BUCURESTI SECTORUL [1-6]$", rows[["area_norm"]])] <- "sector"

  rows[["validation_area"]] <- rows[["row_kind"]] == "county"
  bucharest_rows <- which(rows[["area_norm"]] == "MUNICIPIUL BUCURESTI")
  if (spec[["year"]] == 2021L) {
    if (length(bucharest_rows) != 2L) stop("expected two 2021 Bucharest rows", call. = FALSE)
    rows[["row_kind"]][bucharest_rows[1]] <- "county"
    rows[["row_kind"]][bucharest_rows[2]] <- "uat"
    rows[["validation_area"]][bucharest_rows[1]] <- TRUE
    rows[["validation_area"]][bucharest_rows[2]] <- FALSE
  } else {
    if (length(bucharest_rows) != 1L) stop("expected one 2011 Bucharest row", call. = FALSE)
    rows[["row_kind"]][bucharest_rows] <- "uat"
    rows[["validation_area"]][bucharest_rows] <- TRUE
  }

  current_county <- NA_character_
  join_county <- character(nrow(rows))
  for (index in seq_len(nrow(rows))) {
    if (rows[["row_kind"]][index] == "county") {
      current_county <- rows[["area_norm"]][index]
    }
    if (rows[["area_norm"]][index] == "MUNICIPIUL BUCURESTI") {
      current_county <- "BUCURESTI"
    }
    join_county[index] <- current_county
  }
  rows[["join_county"]] <- join_county
  rows[["join_name"]] <- apply_name_corrections(
    spec[["year"]],
    rows[["join_county"]],
    strip_area_type(rows[["area_label"]])
  )

  uat_rows <- rows[rows[["row_kind"]] == "uat", , drop = FALSE]
  if (any(is.na(uat_rows[["join_county"]]))) {
    stop("missing current county while parsing ", spec[["year"]], call. = FALSE)
  }
  national <- rows[rows[["row_kind"]] == "national", , drop = FALSE]
  if (nrow(national) != 1L) stop("expected one national row for ", spec[["year"]], call. = FALSE)
  validation_rows <- rows[rows[["validation_area"]], , drop = FALSE]

  list(
    spec = spec,
    rows = rows,
    uat_rows = uat_rows,
    national = national,
    validation_rows = validation_rows
  )
}

# derive headline counts and percentages from one parsed census row set.
derive_headline_counts <- function(rows, spec) {
  population_total <- rows[["total_count"]] - rows[["unavailable_count"]]
  no_religion_count <- rows[["no_religion_component"]] + rows[["atheist_component"]]
  agnostic_count <- rows[["agnostic_component"]]
  religious_affiliation_count <- population_total - no_religion_count - agnostic_count

  unusable_population <- rows[["unavailable_suppressed"]] | is.na(population_total)
  unusable_no_religion <- rows[["no_religion_suppressed"]] |
    rows[["atheist_suppressed"]] | is.na(no_religion_count)
  unusable_agnostic <- rows[["agnostic_suppressed"]] | is.na(agnostic_count)
  unusable_affiliation <- unusable_population | unusable_no_religion | unusable_agnostic

  population_total[unusable_population] <- NA_real_
  no_religion_count[unusable_no_religion] <- NA_real_
  religious_affiliation_count[unusable_affiliation] <- NA_real_

  no_religion_percent <- ifelse(
    !is.na(population_total) & population_total > 0 & !is.na(no_religion_count),
    round(100 * no_religion_count / population_total, 2),
    NA_real_
  )
  religious_affiliation_percent <- ifelse(
    !is.na(population_total) & population_total > 0 & !is.na(religious_affiliation_count),
    round(100 * religious_affiliation_count / population_total, 2),
    NA_real_
  )

  data.frame(
    total_count = rows[["total_count"]],
    unavailable_count = rows[["unavailable_count"]],
    population_total = population_total,
    no_religion_count = no_religion_count,
    agnostic_count = agnostic_count,
    religious_affiliation_count = religious_affiliation_count,
    no_religion_percent = no_religion_percent,
    religious_affiliation_percent = religious_affiliation_percent,
    stringsAsFactors = FALSE
  )
}

# compare county-level validation rows with the national source row.
validate_wave_totals <- function(wave) {
  spec <- wave[["spec"]]
  validation_counts <- derive_headline_counts(wave[["validation_rows"]], spec)
  national_counts <- derive_headline_counts(wave[["national"]], spec)

  sum_value <- function(field) sum(validation_counts[[field]], na.rm = FALSE)
  national_value <- function(field) national_counts[[field]][[1]]
  difference <- function(field) sum_value(field) - national_value(field)
  fields <- c(
    "total_count",
    "unavailable_count",
    "population_total",
    "religious_affiliation_count",
    "no_religion_count"
  )
  if (spec[["year"]] == 2021L) fields <- c(fields, "agnostic_count")
  differences <- vapply(fields, difference, numeric(1))
  if (any(is.na(differences)) || any(differences != 0)) {
    stop("national validation failed for ", spec[["year"]], call. = FALSE)
  }

  list(
    source_area_level = "source county rows",
    boundary_level = judet_boundary_level,
    year = spec[["year"]],
    validation_area_count = nrow(wave[["validation_rows"]]),
    source_total_area_sum = sum_value("total_count"),
    source_total_national = national_value("total_count"),
    source_total_difference = difference("total_count"),
    undeclared_area_sum = sum_value("unavailable_count"),
    undeclared_national = national_value("unavailable_count"),
    undeclared_difference = difference("unavailable_count"),
    undeclared_national_share_percent = round(
      100 * national_value("unavailable_count") / national_value("total_count"),
      2
    ),
    stated_response_area_sum = sum_value("population_total"),
    stated_response_national = national_value("population_total"),
    stated_response_difference = difference("population_total"),
    religious_affiliation_area_sum = sum_value("religious_affiliation_count"),
    religious_affiliation_national = national_value("religious_affiliation_count"),
    religious_affiliation_difference = difference("religious_affiliation_count"),
    no_religion_area_sum = sum_value("no_religion_count"),
    no_religion_national = national_value("no_religion_count"),
    no_religion_difference = difference("no_religion_count"),
    agnostic_area_sum = if (spec[["year"]] == 2021L) sum_value("agnostic_count") else NULL,
    agnostic_national = if (spec[["year"]] == 2021L) national_value("agnostic_count") else NULL,
    agnostic_difference = if (spec[["year"]] == 2021L) difference("agnostic_count") else NULL
  )
}

# prepare a Romania LAU boundary layer with county tags from GISCO NUTS3.
read_lau_boundary <- function(path, year, nuts) {
  lau <- st_read(path, quiet = TRUE) |>
    filter(.data[["CNTR_CODE"]] == "RO")
  if (nrow(lau) != 3181L) stop("expected 3,181 RO LAU features for ", year, call. = FALSE)
  lau <- st_make_valid(lau)

  lau_3035 <- st_transform(lau, 3035)
  point_layer <- st_sf(
    row_id = seq_len(nrow(lau)),
    geometry = st_point_on_surface(st_geometry(lau_3035)),
    crs = st_crs(lau_3035)
  )
  nuts_3035 <- st_transform(nuts[, c("NUTS_ID", "NAME_LATN")], 3035)
  joined <- st_join(point_layer, nuts_3035, join = st_within, left = TRUE)
  if (any(is.na(joined[["NAME_LATN"]]))) {
    stop("failed to assign NUTS3 county tags for ", year, call. = FALSE)
  }

  lau[["join_county"]] <- ro_norm(joined[["NAME_LATN"]])
  lau[["join_county"]][lau[["LAU_NAME"]] == "Municipiul Bucureşti"] <- "BUCURESTI"
  lau[["join_name"]] <- strip_area_type(lau[["LAU_NAME"]])
  lau[["area_code"]] <- as.character(lau[["LAU_ID"]])
  lau[["area_name"]] <- as.character(lau[["LAU_NAME"]])
  lau[["area_unit_id"]] <- paste0(boundary_set_id, ":", lau[["area_code"]])
  lau[["boundary_set_id"]] <- boundary_set_id
  lau[["boundary_level"]] <- boundary_level
  lau[["source_lau_year"]] <- year
  lau[["county_name"]] <- as.character(joined[["NAME_LATN"]])
  lau[["land_area_sq_km"]] <- as.numeric(st_area(lau_3035)) / 1000000

  key <- paste(lau[["join_county"]], lau[["join_name"]], sep = "|")
  duplicated_key <- unique(key[duplicated(key)])
  if (length(duplicated_key)) {
    stop("duplicate boundary join keys for ", year, ": ", paste(duplicated_key, collapse = "; "), call. = FALSE)
  }
  lau
}

# prepare the Romania județ boundary layer from GISCO NUTS3 2021.
read_judet_boundary <- function(nuts) {
  judet <- nuts
  if (nrow(judet) != 42L) stop("expected 42 RO NUTS3 features", call. = FALSE)
  judet <- st_make_valid(judet)
  judet_3035 <- st_transform(judet, 3035)

  judet[["join_name"]] <- ro_norm(judet[["NAME_LATN"]])
  judet[["area_code"]] <- as.character(judet[["NUTS_ID"]])
  judet[["area_name"]] <- as.character(judet[["NAME_LATN"]])
  judet[["area_unit_id"]] <- paste0(judet_boundary_set_id, ":", judet[["area_code"]])
  judet[["boundary_set_id"]] <- judet_boundary_set_id
  judet[["boundary_level"]] <- judet_boundary_level
  judet[["nuts_id"]] <- as.character(judet[["NUTS_ID"]])
  judet[["nuts_name"]] <- as.character(judet[["NUTS_NAME"]])
  judet[["land_area_sq_km"]] <- as.numeric(st_area(judet_3035)) / 1000000

  if (any(duplicated(judet[["join_name"]]))) {
    duplicate_names <- unique(judet[["join_name"]][duplicated(judet[["join_name"]])])
    stop("duplicate NUTS3 county join names: ", paste(duplicate_names, collapse = "; "), call. = FALSE)
  }
  judet
}

# match one wave to the 2021 output boundary, using 2011 LAU IDs where needed.
match_wave_to_boundary <- function(wave, boundary_2011, boundary_2021) {
  spec <- wave[["spec"]]
  source <- wave[["uat_rows"]]
  source_key <- paste(source[["join_county"]], source[["join_name"]], sep = "|")

  if (spec[["year"]] == 2021L) {
    boundary_key <- paste(boundary_2021[["join_county"]], boundary_2021[["join_name"]], sep = "|")
    boundary_index <- match(source_key, boundary_key)
    if (any(is.na(boundary_index))) {
      missing <- source[is.na(boundary_index), c("area_label", "join_county", "join_name")]
      stop("unmatched 2021 UAT rows: ", paste(missing[["area_label"]], collapse = "; "), call. = FALSE)
    }
    matched_2021_index <- boundary_index
    bridge_note <- rep(FALSE, nrow(source))
  } else {
    boundary_2011_key <- paste(boundary_2011[["join_county"]], boundary_2011[["join_name"]], sep = "|")
    boundary_2011_index <- match(source_key, boundary_2011_key)
    if (any(is.na(boundary_2011_index))) {
      missing <- source[is.na(boundary_2011_index), c("area_label", "join_county", "join_name")]
      stop("unmatched 2011 UAT rows: ", paste(missing[["area_label"]], collapse = "; "), call. = FALSE)
    }
    lau_ids <- boundary_2011[["LAU_ID"]][boundary_2011_index]
    matched_2021_index <- match(lau_ids, boundary_2021[["LAU_ID"]])
    if (any(is.na(matched_2021_index))) {
      stop("2011 LAU IDs missing from the 2021 GISCO boundary", call. = FALSE)
    }
    bridge_note <- rep(TRUE, nrow(source))
  }

  if (any(duplicated(boundary_2021[["LAU_ID"]][matched_2021_index]))) {
    stop("duplicate matched LAU IDs for ", spec[["year"]], call. = FALSE)
  }
  if (length(matched_2021_index) != nrow(boundary_2021)) {
    stop("unexpected matched area count for ", spec[["year"]], call. = FALSE)
  }

  counts <- derive_headline_counts(source, spec)
  data.frame(
    source,
    counts,
    area_code = boundary_2021[["area_code"]][matched_2021_index],
    area_name = boundary_2021[["area_name"]][matched_2021_index],
    area_unit_id = boundary_2021[["area_unit_id"]][matched_2021_index],
    land_area_sq_km = boundary_2021[["land_area_sq_km"]][matched_2021_index],
    boundary_county_name = boundary_2021[["county_name"]][matched_2021_index],
    bridged_from_2011_lau = bridge_note,
    stringsAsFactors = FALSE
  )
}

# match one wave's source county rows to the GISCO NUTS3 județ boundary.
match_wave_to_judet_boundary <- function(wave, boundary_judet) {
  spec <- wave[["spec"]]
  source <- wave[["validation_rows"]]
  source_key <- source[["join_name"]]
  boundary_key <- boundary_judet[["join_name"]]
  boundary_index <- match(source_key, boundary_key)
  if (any(is.na(boundary_index))) {
    missing <- source[is.na(boundary_index), c("area_label", "join_name")]
    stop(
      "unmatched ", spec[["year"]], " județ rows: ",
      paste(missing[["area_label"]], collapse = "; "),
      call. = FALSE
    )
  }
  if (any(duplicated(boundary_judet[["area_code"]][boundary_index]))) {
    stop("duplicate matched județ NUTS3 IDs for ", spec[["year"]], call. = FALSE)
  }
  if (length(boundary_index) != nrow(boundary_judet)) {
    stop("unexpected matched județ count for ", spec[["year"]], call. = FALSE)
  }

  counts <- derive_headline_counts(source, spec)
  data.frame(
    source,
    counts,
    area_code = boundary_judet[["area_code"]][boundary_index],
    area_name = boundary_judet[["area_name"]][boundary_index],
    area_unit_id = boundary_judet[["area_unit_id"]][boundary_index],
    land_area_sq_km = boundary_judet[["land_area_sq_km"]][boundary_index],
    boundary_county_name = boundary_judet[["area_name"]][boundary_index],
    bridged_from_2011_lau = FALSE,
    stringsAsFactors = FALSE
  )
}

# build one area-summary row from matched census and boundary metadata.
build_area_row <- function(row, spec, boundary_set_id_value, boundary_level_value,
                           source_ids, extra_flags = character(),
                           include_lau_bucharest_flag = FALSE,
                           include_named_detail_flag = TRUE) {
  flags <- c("undeclared_excluded_from_denominator", "stated_response_denominator")
  if (spec[["year"]] == 2021L) {
    flags <- c(flags, "agnostic_in_denominator_not_no_religion")
  }
  flags <- c(flags, extra_flags)
  if (isTRUE(row[["bridged_from_2011_lau"]])) {
    flags <- c(flags, "gisco_lau_2011_to_2021_id_bridge")
  }
  if (
    include_lau_bucharest_flag &&
      spec[["year"]] == 2011L &&
      row[["area_norm"]] == "MUNICIPIUL BUCURESTI"
  ) {
    flags <- c(flags, "bucharest_2011_sectors_aggregated_to_municipality_lau")
  }
  if (isTRUE(row[["unavailable_suppressed"]])) {
    flags <- c(flags, "source_suppressed_undeclared_component")
  }
  if (isTRUE(row[["no_religion_suppressed"]]) || isTRUE(row[["atheist_suppressed"]])) {
    flags <- c(flags, "source_suppressed_no_religion_component")
  }
  if (isTRUE(row[["agnostic_suppressed"]])) {
    flags <- c(flags, "source_suppressed_agnostic_component")
  }
  if (include_named_detail_flag && isTRUE(row[["named_religion_suppressed"]])) {
    flags <- c(flags, "source_suppressed_named_religion_detail")
  }
  if (is.na(row[["religious_affiliation_percent"]]) || is.na(row[["no_religion_percent"]])) {
    flags <- c(flags, "headline_metric_unavailable_due_source_suppression")
  }

  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id_value,
    boundary_level = boundary_level_value,
    area_unit_id = row[["area_unit_id"]],
    area_code = as.character(row[["area_code"]]),
    area_name = row[["area_name"]],
    year = spec[["year"]],
    population_total = null_if_na(as.integer(row[["population_total"]])),
    population_total_basis = spec[["basis"]],
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
    source_dataset_ids = source_ids,
    quality_flag = paste(unique(flags), collapse = ";")
  )
}

# build the shared area-summary envelope for one geography level.
build_area_summary <- function(area_rows, boundary_set_id_value, boundary_level_value,
                               boundary_vintage, boundary_source_dataset_id,
                               boundary_note, supporting_sources = list()) {
  primary_boundary_source <- list(
    source_dataset_id = boundary_source_dataset_id,
    provider = "Eurostat GISCO",
    title = boundary_note,
    url = if (boundary_source_dataset_id == nuts_dataset_id) {
      gisco_nuts3_2021_url
    } else {
      gisco_lau_2021_url
    },
    retrieved_at = retrieval_date,
    licence = "Eurostat GISCO download provisions with attribution."
  )
  list(
    schema_version = "0.1.0",
    generated_at = stamp,
    generated_by = script_id,
    country_code = country_code,
    boundary_set = list(
      boundary_set_id = boundary_set_id_value,
      country_code = country_code,
      level = boundary_level_value,
      vintage = boundary_vintage,
      source_dataset_id = boundary_source_dataset_id
    ),
    site_snapshot = list(
      source_dataset_id = NULL,
      snapshot_date = NULL,
      basis = "No governed places-of-worship point snapshot is included in this Romania census-religion product.",
      notes = "The shipped product contains census religion area metrics only."
    ),
    source_datasets = c(
      list(
        list(
          source_dataset_id = census_2011_dataset_id,
          provider = "Institutul National de Statistica; Recensamant Romania",
          title = census_specs[["2011"]][["source_title"]],
          url = rpl_2011_url,
          retrieved_at = retrieval_date,
          licence = "INS/recensamantromania public download; an explicit reuse statement was not located during this build."
        ),
        list(
          source_dataset_id = census_2021_dataset_id,
          provider = "Institutul National de Statistica; Recensamant Romania",
          title = census_specs[["2021"]][["source_title"]],
          url = rpl_2021_url,
          retrieved_at = retrieval_date,
          licence = "INS/recensamantromania public download; an explicit reuse statement was not located during this build."
        ),
        primary_boundary_source
      ),
      supporting_sources
    ),
    indicators = list(
      list(
        indicator_id = "population_total",
        label = "Stated religion-response denominator",
        unit = "people",
        method = "2011: POPULATIA STABILA TOTAL minus Informatie nedisponibila. 2021: POPULATIA REZIDENTA TOTAL minus Informatie nedisponibila.",
        quality_notes = "The denominator excludes undeclared or unavailable religion responses in each wave."
      ),
      list(
        indicator_id = "religious_affiliation_percent",
        label = "Religious affiliation percent",
        unit = "percent",
        method = "100 * named-religion categories / stated religion-response denominator. The script computes the named-religion total as denominator minus Fara religie, Atei/Ateu, and 2021 Agnostic.",
        quality_notes = "Rows with source suppression in a headline component are left unavailable rather than imputed."
      ),
      list(
        indicator_id = "no_religion_percent",
        label = "No religion percent",
        unit = "percent",
        method = "100 * (Fara religie + Atei/Ateu) / stated religion-response denominator.",
        quality_notes = "The no-religion construct keeps the two source labels Fara religie and Atei/Ateu; 2021 Agnostic is documented separately and remains in the denominator."
      )
    ),
    visual_layers = list(
      list(
        visual_layer_id = "religious_affiliation",
        indicator_ids = c("religious_affiliation_percent"),
        layer_type = "choropleth",
        legend = "Religious affiliation (%)",
        colour_scale = "sequential_blue",
        time_control = "year_selector",
        default_visibility = TRUE
      ),
      list(
        visual_layer_id = "no_religion",
        indicator_ids = c("no_religion_percent"),
        layer_type = "choropleth",
        legend = "No religion (%)",
        colour_scale = "sequential_orange",
        time_control = "year_selector",
        default_visibility = FALSE
      )
    ),
    rows = area_rows
  )
}

# flatten area-summary rows for the csv sibling.
flatten_rows <- function(rows) {
  scalar_or_na <- function(value) {
    if (is.null(value)) return(NA)
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
      population_total = scalar_or_na(row[["population_total"]]),
      population_total_basis = row[["population_total_basis"]],
      religious_affiliation_count = scalar_or_na(row[["religious_affiliation_count"]]),
      religious_affiliation_percent = scalar_or_na(row[["religious_affiliation_percent"]]),
      no_religion_count = scalar_or_na(row[["no_religion_count"]]),
      no_religion_percent = scalar_or_na(row[["no_religion_percent"]]),
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

# write a simplified boundary, increasing tolerance until it is small.
write_simplified_boundary <- function(boundary, output_path, field_names) {
  boundary_fields <- boundary[, field_names]
  tolerances <- c(500, 1000, 1500, 2000, 3000, 5000, 8000, 12000, 16000)
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
    if (bytes <= 3000000) {
      return(list(tolerance_m = tolerance, bytes = bytes))
    }
  }
  stop("simplified boundary remains above 3 MB", call. = FALSE)
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

# create a raw-source manifest record for one local source file.
raw_source_record <- function(path, format, row_count, notes) {
  list(
    uri = path,
    format = format,
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    row_count = row_count,
    notes = notes
  )
}

# summarise source suppression in one shipped level.
suppression_summary <- function(matched, spec, boundary_level_value) {
  list(
    boundary_level = boundary_level_value,
    year = spec[["year"]],
    row_count = nrow(matched),
    rows_with_suppressed_undeclared_component = sum(matched[["unavailable_suppressed"]], na.rm = TRUE),
    rows_with_suppressed_no_religion_component = sum(
      matched[["no_religion_suppressed"]] | matched[["atheist_suppressed"]],
      na.rm = TRUE
    ),
    rows_with_suppressed_agnostic_component = if (spec[["year"]] == 2021L) {
      sum(matched[["agnostic_suppressed"]], na.rm = TRUE)
    } else {
      0L
    },
    rows_with_suppressed_named_religion_detail = sum(matched[["named_religion_suppressed"]], na.rm = TRUE),
    rows_with_unavailable_religious_affiliation_percent = sum(is.na(matched[["religious_affiliation_percent"]])),
    rows_with_unavailable_no_religion_percent = sum(is.na(matched[["no_religion_percent"]]))
  )
}

# require a complete headline choropleth for a level that should not suppress cells.
validate_complete_headlines <- function(summary, label) {
  suppression_fields <- c(
    "rows_with_suppressed_undeclared_component",
    "rows_with_suppressed_no_religion_component",
    "rows_with_suppressed_agnostic_component",
    "rows_with_unavailable_religious_affiliation_percent",
    "rows_with_unavailable_no_religion_percent"
  )
  failures <- vapply(suppression_fields, function(field) summary[[field]], numeric(1))
  if (any(failures != 0)) {
    stop(label, " has suppressed or unavailable headline rows", call. = FALSE)
  }
  summary
}

required_sources <- c(
  rpl_2021_path,
  rpl_2011_path,
  gisco_lau_2021_path,
  gisco_lau_2011_path,
  gisco_nuts3_2021_path
)
invisible(lapply(required_sources, require_file))

nuts <- st_read(gisco_nuts3_2021_path, quiet = TRUE) |>
  filter(.data[["CNTR_CODE"]] == "RO") |>
  st_make_valid()
boundary_2021 <- read_lau_boundary(gisco_lau_2021_path, 2021L, nuts)
boundary_2011 <- read_lau_boundary(gisco_lau_2011_path, 2011L, nuts)
boundary_judet <- read_judet_boundary(nuts)

wave_2011 <- read_census_wave(census_specs[["2011"]])
wave_2021 <- read_census_wave(census_specs[["2021"]])
validation_2011 <- validate_wave_totals(wave_2011)
validation_2021 <- validate_wave_totals(wave_2021)

matched_2011 <- match_wave_to_boundary(wave_2011, boundary_2011, boundary_2021)
matched_2021 <- match_wave_to_boundary(wave_2021, boundary_2011, boundary_2021)
matched_judet_2011 <- match_wave_to_judet_boundary(wave_2011, boundary_judet)
matched_judet_2021 <- match_wave_to_judet_boundary(wave_2021, boundary_judet)
join_coverage <- list(
  list(
    boundary_level = boundary_level,
    year = 2011L,
    matched_area_count = nrow(matched_2011),
    expected_area_count = nrow(boundary_2021),
    missing_area_names = list()
  ),
  list(
    boundary_level = boundary_level,
    year = 2021L,
    matched_area_count = nrow(matched_2021),
    expected_area_count = nrow(boundary_2021),
    missing_area_names = list()
  ),
  list(
    boundary_level = judet_boundary_level,
    year = 2011L,
    matched_area_count = nrow(matched_judet_2011),
    expected_area_count = nrow(boundary_judet),
    missing_area_names = list()
  ),
  list(
    boundary_level = judet_boundary_level,
    year = 2021L,
    matched_area_count = nrow(matched_judet_2021),
    expected_area_count = nrow(boundary_judet),
    missing_area_names = list()
  )
)
if (
  nrow(matched_2011) != 3181L ||
    nrow(matched_2021) != 3181L ||
    nrow(matched_judet_2011) != 42L ||
    nrow(matched_judet_2021) != 42L
) {
  stop("join coverage failed", call. = FALSE)
}

boundary_write <- write_simplified_boundary(
  boundary_2021,
  boundary_out,
  c(
    "area_code", "area_name", "area_unit_id", "boundary_set_id",
    "boundary_level", "county_name", "source_lau_year", "land_area_sq_km"
  )
)
if (row_count_file(boundary_out) != nrow(boundary_2021)) {
  stop("LAU boundary feature count changed during simplification", call. = FALSE)
}

judet_boundary_write <- write_simplified_boundary(
  boundary_judet,
  judet_boundary_out,
  c(
    "area_code", "area_name", "area_unit_id", "boundary_set_id",
    "boundary_level", "nuts_id", "nuts_name", "land_area_sq_km"
  )
)
if (row_count_file(judet_boundary_out) != nrow(boundary_judet)) {
  stop("județ boundary feature count changed during simplification", call. = FALSE)
}

area_rows_lau <- c(
  lapply(seq_len(nrow(matched_2011)), function(index) {
    build_area_row(
      matched_2011[index, , drop = FALSE],
      census_specs[["2011"]],
      boundary_set_id,
      boundary_level,
      c(census_2011_dataset_id, boundary_dataset_id_2011, boundary_dataset_id_2021, nuts_dataset_id),
      include_lau_bucharest_flag = TRUE
    )
  }),
  lapply(seq_len(nrow(matched_2021)), function(index) {
    build_area_row(
      matched_2021[index, , drop = FALSE],
      census_specs[["2021"]],
      boundary_set_id,
      boundary_level,
      c(census_2021_dataset_id, boundary_dataset_id_2021, nuts_dataset_id),
      include_lau_bucharest_flag = TRUE
    )
  })
)
area_rows_lau <- area_rows_lau[order(
  vapply(area_rows_lau, function(row) row[["area_name"]], character(1)),
  vapply(area_rows_lau, function(row) row[["year"]], integer(1))
)]

area_rows_judet <- c(
  lapply(seq_len(nrow(matched_judet_2011)), function(index) {
    build_area_row(
      matched_judet_2011[index, , drop = FALSE],
      census_specs[["2011"]],
      judet_boundary_set_id,
      judet_boundary_level,
      c(census_2011_dataset_id, nuts_dataset_id),
      extra_flags = c("source_county_row", "gisco_nuts3_2021_boundary"),
      include_named_detail_flag = FALSE
    )
  }),
  lapply(seq_len(nrow(matched_judet_2021)), function(index) {
    build_area_row(
      matched_judet_2021[index, , drop = FALSE],
      census_specs[["2021"]],
      judet_boundary_set_id,
      judet_boundary_level,
      c(census_2021_dataset_id, nuts_dataset_id),
      extra_flags = c("source_county_row", "gisco_nuts3_2021_boundary"),
      include_named_detail_flag = FALSE
    )
  })
)
area_rows_judet <- area_rows_judet[order(
  vapply(area_rows_judet, function(row) row[["area_name"]], character(1)),
  vapply(area_rows_judet, function(row) row[["year"]], integer(1))
)]

lau_area_summary <- build_area_summary(
  area_rows_lau,
  boundary_set_id,
  boundary_level,
  "2021",
  boundary_dataset_id_2021,
  "GISCO LAU 2021 Romania polygons",
  supporting_sources = list(
    list(
      source_dataset_id = boundary_dataset_id_2011,
      provider = "Eurostat GISCO",
      title = "GISCO LAU 2011 Romania polygons",
      url = gisco_lau_2011_url,
      retrieved_at = retrieval_date,
      licence = "Eurostat GISCO download provisions with attribution."
    ),
    list(
      source_dataset_id = nuts_dataset_id,
      provider = "Eurostat GISCO",
      title = "GISCO NUTS3 2021 Romania polygons",
      url = gisco_nuts3_2021_url,
      retrieved_at = retrieval_date,
      licence = "Eurostat GISCO download provisions with attribution."
    )
  )
)
judet_area_summary <- build_area_summary(
  area_rows_judet,
  judet_boundary_set_id,
  judet_boundary_level,
  "2021",
  nuts_dataset_id,
  "GISCO NUTS3 2021 Romania polygons"
)

writeLines(
  toJSON(lau_area_summary, pretty = TRUE, auto_unbox = TRUE, null = "null", digits = NA),
  summary_json_out,
  useBytes = TRUE
)
write.csv(flatten_rows(area_rows_lau), summary_csv_out, row.names = FALSE, na = "")
writeLines(
  toJSON(judet_area_summary, pretty = TRUE, auto_unbox = TRUE, null = "null", digits = NA),
  judet_summary_json_out,
  useBytes = TRUE
)
write.csv(flatten_rows(area_rows_judet), judet_summary_csv_out, row.names = FALSE, na = "")

summary_sha <- sha256_file(summary_json_out)
judet_summary_sha <- sha256_file(judet_summary_json_out)
dataset_id <- "ro-census-religion:ro:2011-2021:ins-rpl-gisco-lau"
dataset_version_id <- paste0(
  dataset_id,
  ":",
  substr(summary_sha, 1, 6),
  substr(judet_summary_sha, 1, 6)
)
licence_note <- paste(
  "INS/recensamantromania workbooks are public downloads from the census portal.",
  "A public page with explicit reuse terms was not located during this build;",
  "source attribution is retained. GISCO files are used under Eurostat GISCO",
  "download provisions with attribution."
)

raw_sources <- list(
  raw_source_record(
    rpl_2011_path,
    "xls",
    nrow(wave_2011[["rows"]]),
    "RPL 2011 sR_TAB_13 religion workbook; used for 2011 LAU rows, county rows, and national validation."
  ),
  raw_source_record(
    rpl_2021_path,
    "xlsx",
    nrow(wave_2021[["rows"]]),
    "RPL 2021 final results workbook Tabel 2.04.1 and Tabel 2.04.2; sheet Tab 2.4.2 used for LAU rows, county rows, and national validation."
  ),
  raw_source_record(
    gisco_lau_2021_path,
    "geojson",
    nrow(boundary_2021),
    "GISCO LAU 2021 all-Europe GeoJSON filtered to Romania for the output boundary."
  ),
  raw_source_record(
    gisco_lau_2011_path,
    "geojson",
    nrow(boundary_2011),
    "GISCO LAU 2011 all-Europe GeoJSON filtered to Romania to bridge 2011 source names to LAU IDs."
  ),
  raw_source_record(
    gisco_nuts3_2021_path,
    "geojson",
    nrow(nuts),
    "GISCO NUTS3 2021 all-Europe GeoJSON filtered to Romania for the județ boundary and LAU county tags."
  )
)

durable_files <- list(
  manifest_file_record(
    summary_json_out,
    "Romania LAU 2021 area summary with INS RPL 2011 and 2021 stated-response religion metrics.",
    "ins_public_download_terms_unclear_gisco_attribution"
  ),
  manifest_file_record(
    summary_csv_out,
    "Flattened Romania LAU 2021 area summary with INS RPL 2011 and 2021 stated-response religion metrics.",
    "ins_public_download_terms_unclear_gisco_attribution"
  ),
  manifest_file_record(
    boundary_out,
    "Simplified Romania LAU 2021 boundary GeoJSON derived from GISCO LAU 2021.",
    "gisco_download_provisions_with_attribution"
  ),
  manifest_file_record(
    judet_summary_json_out,
    "Romania județ area summary with INS RPL 2011 and 2021 stated-response religion metrics from source county rows.",
    "ins_public_download_terms_unclear_gisco_attribution"
  ),
  manifest_file_record(
    judet_summary_csv_out,
    "Flattened Romania județ area summary with INS RPL 2011 and 2021 stated-response religion metrics from source county rows.",
    "ins_public_download_terms_unclear_gisco_attribution"
  ),
  manifest_file_record(
    judet_boundary_out,
    "Simplified Romania județ boundary GeoJSON derived from GISCO NUTS3 2021.",
    "gisco_download_provisions_with_attribution"
  )
)

suppression_lau_2011 <- suppression_summary(matched_2011, census_specs[["2011"]], boundary_level)
suppression_lau_2021 <- suppression_summary(matched_2021, census_specs[["2021"]], boundary_level)
suppression_judet_2011 <- validate_complete_headlines(
  suppression_summary(matched_judet_2011, census_specs[["2011"]], judet_boundary_level),
  "2011 județ product"
)
suppression_judet_2021 <- validate_complete_headlines(
  suppression_summary(matched_judet_2021, census_specs[["2021"]], judet_boundary_level),
  "2021 județ product"
)

validation <- list(
  checks = c(
    "2011 and 2021 source county rows reconcile exactly to the published national row for source total, undeclared responses, stated-response denominator, religious affiliation, and no religion.",
    "2021 validation also reconciles Agnostic exactly, because it remains in the denominator and outside the no-religion construct.",
    "Join coverage is 3,181 of 3,181 LAU areas and 42 of 42 județ areas for both shipped waves.",
    "The județ product uses the source workbook's own county rows rather than aggregating suppressed LAU rows.",
    "2011 rows are first matched to GISCO LAU 2011 names, then bridged to the GISCO LAU 2021 output boundary by LAU_ID; no invented concordance is used.",
    "Rows with source asterisk suppression in headline components are left unavailable rather than imputed.",
    "The simplified LAU and județ boundaries remain below 3 MB and preserve their output feature counts.",
    "jsonlite::validate passes for the generated manifest."
  ),
  join_coverage = join_coverage,
  national_reconciliation = list(validation_2011, validation_2021),
  state_validation = list(validation_2011, validation_2021),
  suppression_validation = list(
    suppression_lau_2011,
    suppression_lau_2021,
    suppression_judet_2011,
    suppression_judet_2021
  ),
  boundary_validation = list(
    lau_2021 = list(
      source_2021_feature_count = nrow(boundary_2021),
      source_2011_feature_count = nrow(boundary_2011),
      derived_feature_count = row_count_file(boundary_out),
      expected_feature_count = 3181L,
      simplified_boundary_bytes = boundary_write[["bytes"]],
      simplification_tolerance_m = boundary_write[["tolerance_m"]],
      lau_2011_ids_missing_from_2021 = sum(!boundary_2011[["LAU_ID"]] %in% boundary_2021[["LAU_ID"]]),
      unmatched_boundary_features = list(),
      unmatched_census_areas = list()
    ),
    judet = list(
      source_feature_count = nrow(boundary_judet),
      derived_feature_count = row_count_file(judet_boundary_out),
      expected_feature_count = 42L,
      simplified_boundary_bytes = judet_boundary_write[["bytes"]],
      simplification_tolerance_m = judet_boundary_write[["tolerance_m"]],
      unmatched_boundary_features = list(),
      unmatched_census_areas = list()
    )
  )
)

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:ro-census-religion:ro:2011-2021:ins-rpl-gisco-lau",
  dataset_id = dataset_id,
  dataset_version_id = dataset_version_id,
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "ro-census-religion",
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
    command = "Rscript scripts/build_ro_area_summary.R",
    parameters = list(
      waves = c("2011", "2021"),
      boundary_sets = c(boundary_set_id, judet_boundary_set_id),
      boundary_simplification_tolerance_m = list(
        lau_2021 = boundary_write[["tolerance_m"]],
        judet = judet_boundary_write[["tolerance_m"]]
      ),
      denominator = "Total population minus Informatie nedisponibila in each wave"
    ),
    software_versions = list(
      r = paste(R.version$major, R.version$minor, sep = "."),
      dplyr = as.character(packageVersion("dplyr")),
      jsonlite = as.character(packageVersion("jsonlite")),
      readxl = as.character(packageVersion("readxl")),
      sf = as.character(packageVersion("sf"))
    )
  ),
  source = list(
    provider = "Institutul National de Statistica (INS), Recensamant Romania; Eurostat GISCO",
    source_dataset_ids = c(
      census_2011_dataset_id,
      census_2021_dataset_id,
      boundary_dataset_id_2011,
      boundary_dataset_id_2021,
      nuts_dataset_id
    ),
    source_urls = c(
      rpl_2011_page,
      rpl_2011_url,
      rpl_2021_page,
      rpl_2021_url,
      gisco_lau_2011_url,
      gisco_lau_2021_url,
      gisco_nuts3_2021_url
    ),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = licence_note,
    citation = "Institutul National de Statistica, RPL 2011 sR_TAB_13 and RPL 2021 final results Tabel 2.04.2; Eurostat GISCO LAU 2011, LAU 2021, and NUTS3 2021.",
    raw_redistribution = "Raw INS workbooks and GISCO all-Europe GeoJSON files are not committed. They remain in data/raw/ro_census/ and await any project-controlled raw archive upload."
  ),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = durable_files,
  derived_outputs = list(
    list(
      uri = paste0("repo:", summary_json_out),
      sha256 = summary_sha,
      built_by = script_id,
      notes = "3,181 LAU reporting units x 2 census years; stated-response denominator excludes Informatie nedisponibila."
    ),
    list(
      uri = paste0("repo:", boundary_out),
      sha256 = sha256_file(boundary_out),
      built_by = script_id,
      notes = paste0(
        "3,181 GISCO LAU 2021 features simplified at ",
        boundary_write[["tolerance_m"]],
        " m tolerance."
      )
    ),
    list(
      uri = paste0("repo:", judet_summary_json_out),
      sha256 = judet_summary_sha,
      built_by = script_id,
      notes = "42 source county reporting units x 2 census years; stated-response denominator excludes Informatie nedisponibila."
    ),
    list(
      uri = paste0("repo:", judet_boundary_out),
      sha256 = sha256_file(judet_boundary_out),
      built_by = script_id,
      notes = paste0(
        "42 GISCO NUTS3 2021 features simplified at ",
        judet_boundary_write[["tolerance_m"]],
        " m tolerance."
      )
    )
  ),
  validation = validation,
  deferred_sources = list(
    list(
      source_dataset_id = "ins-rpl-2002-volume4-religion",
      url = rpl_2002_page,
      local_path = NULL,
      notes = "Timeboxed review found public 2002 religion workbooks in volume 4, but no clean UAT religion table was safely pinned in this pass. The wave is deferred rather than mapped by an invented correspondence."
    ),
    list(
      source_dataset_id = "ins-rpl-1992-county-religion",
      url = rpl_1992_page,
      local_path = NULL,
      notes = "1992 public tables appear to expose religion at county and locality-category level rather than UAT level. A separate coarser county product is deferred."
    )
  ),
  construct_notes = c(
    "The 2011 denominator is POPULATIA STABILA TOTAL minus Informatie nedisponibila; the national undeclared share is 6.26%.",
    "The 2021 denominator is POPULATIA REZIDENTA TOTAL minus Informatie nedisponibila; the national undeclared share is 13.95%.",
    "The no-religion construct is Fara religie plus Atei/Ateu in each wave.",
    "The 2021 Agnostic category is not included in no religion; it remains in the stated-response denominator and outside religious_affiliation.",
    "Religious affiliation is the named-religion construct. At UAT level the script computes it as the stated-response denominator minus the no-religion construct and, in 2021, minus Agnostic.",
    "Cells published as * are treated as unavailable. The script does not impute suppressed headline components.",
    "The județ product uses the workbook's source county rows and GISCO NUTS3 2021 boundaries. It does not aggregate suppressed LAU rows.",
    "The 2011 source is matched to GISCO LAU 2011 by county and UAT name, then bridged to GISCO LAU 2021 by LAU_ID. Official source IDs are used; no ad hoc split/merge mapping is invented.",
    "The 2011 Bucharest municipality row is used for the 2021 Bucharest LAU feature; six sector rows are excluded from the shipped LAU product."
  )
)

writeLines(
  toJSON(manifest, pretty = TRUE, auto_unbox = TRUE, null = "null", digits = NA),
  manifest_out,
  useBytes = TRUE
)
manifest_text <- paste(readLines(manifest_out, warn = FALSE), collapse = "\n")
if (!validate(manifest_text)) {
  stop("manifest is not valid JSON", call. = FALSE)
}

cat(
  paste0(
    "Built Romania census-religion area summary\n",
    "- LAU rows: ", length(area_rows_lau), "\n",
    "- județ rows: ", length(area_rows_judet), "\n",
    "- 2011 LAU join coverage: ", nrow(matched_2011), "/3181\n",
    "- 2021 LAU join coverage: ", nrow(matched_2021), "/3181\n",
    "- 2011 județ join coverage: ", nrow(matched_judet_2011), "/42\n",
    "- 2021 județ join coverage: ", nrow(matched_judet_2021), "/42\n",
    "- 2011 undeclared share: ", validation_2011[["undeclared_national_share_percent"]], "%\n",
    "- 2021 undeclared share: ", validation_2021[["undeclared_national_share_percent"]], "%\n",
    "- LAU boundary: ", boundary_write[["bytes"]], " bytes at ",
    boundary_write[["tolerance_m"]], " m tolerance\n",
    "- județ boundary: ", judet_boundary_write[["bytes"]], " bytes at ",
    judet_boundary_write[["tolerance_m"]], " m tolerance\n",
    "- manifest: ", manifest_out, "\n"
  )
)
