# Global places normalisation
# Usage:
#   Rscript scripts/normalize_global_places.R [input_path] [country_codes_csv] [--overwrite]
#
# Examples:
#   Rscript scripts/normalize_global_places.R data/raw/osm/2026-09-01 NZ,AU
#   Rscript scripts/normalize_global_places.R data/global/nz_places_raw.json

suppressPackageStartupMessages({
  library(jsonlite)
  library(dplyr)
  library(purrr)
})

parse_args <- function(args) {
  input_path <- NULL
  country_codes <- NULL
  overwrite_outputs <- FALSE

  positional <- args[!startsWith(args, "--")]
  flags <- args[startsWith(args, "--")]

  if (length(positional) >= 1) {
    input_path <- positional[[1]]
  }

  if (length(positional) >= 2) {
    country_codes <- positional[[2]] |>
      strsplit(",", fixed = TRUE) |>
      unlist() |>
      trimws() |>
      toupper()
  }

  overwrite_outputs <- any(flags %in% c("--overwrite", "--force"))

  list(
    input_path = input_path,
    country_codes = country_codes,
    overwrite_outputs = overwrite_outputs
  )
}

find_latest_snapshot_dir <- function() {
  raw_root <- file.path("data", "raw", "osm")
  if (!dir.exists(raw_root)) {
    stop("No raw OSM directory found at ", raw_root, ".")
  }

  snapshot_dirs <- list.dirs(raw_root, recursive = FALSE, full.names = TRUE)
  if (length(snapshot_dirs) == 0) {
    stop("No snapshot directories found under ", raw_root, ".")
  }

  snapshot_dirs[[which.max(basename(snapshot_dirs))]]
}

extract_address <- function(tags) {
  address_parts <- c(
    tags[["addr:housenumber"]],
    tags[["addr:street"]],
    tags[["addr:suburb"]],
    tags[["addr:city"]],
    tags[["addr:postcode"]]
  )

  address_parts <- address_parts[!is.na(address_parts) & address_parts != ""]
  paste(address_parts, collapse = ", ")
}

normalize_religion <- function(religion_value) {
  if (is.null(religion_value) || is.na(religion_value) || religion_value == "") {
    return("unknown")
  }

  religion_value <- tolower(religion_value)

  case_when(
    religion_value %in% c("christian", "christianity", "catholic", "protestant", "orthodox", "baptist", "methodist", "pentecostal") ~ "christian",
    religion_value %in% c("muslim", "islam", "sunni", "shia", "islamic") ~ "muslim",
    religion_value %in% c("jewish", "judaism") ~ "jewish",
    religion_value %in% c("hindu", "hinduism") ~ "hindu",
    religion_value %in% c("buddhist", "buddhism") ~ "buddhist",
    religion_value %in% c("sikh", "sikhism") ~ "sikh",
    religion_value %in% c("shinto") ~ "shinto",
    religion_value %in% c("taoist", "taoism", "daoism") ~ "taoist",
    religion_value %in% c("bahai", "baha'i", "bahá'í") ~ "bahai",
    TRUE ~ "unknown"
  )
}

calculate_confidence <- function(name, religion, denomination, tags, source_layer) {
  score <- 0.35

  if (!is.null(tags[["amenity"]]) && identical(tags[["amenity"]], "place_of_worship")) {
    score <- score + 0.35
  }

  if (!is.null(tags[["building"]]) && tags[["building"]] %in% c("church", "mosque", "temple", "synagogue", "chapel", "cathedral", "monastery", "shrine")) {
    score <- score + 0.15
  }

  if (!is.na(name) && name != "" && name != "Unnamed Place of Worship") {
    score <- score + 0.05
  }

  if (!is.na(religion) && religion != "unknown") {
    score <- score + 0.05
  }

  if (!is.na(denomination) && denomination != "") {
    score <- score + 0.05
  }

  if (!is.na(source_layer) && source_layer %in% c("osm_polygons", "osm_multipolygons")) {
    score <- score + 0.05
  }

  min(score, 1.0)
}

read_raw_payload <- function(path) {
  payload <- read_json(path, simplifyVector = FALSE)

  if (is.list(payload) && !is.null(payload$records)) {
    payload$source_bundle <- basename(path)
    return(payload)
  }

  country_code <- basename(path)
  country_code <- sub("_places_raw\\.json$", "", country_code)
  country_code <- toupper(country_code)

  list(
    snapshot_date = "undated",
    extracted_at = NA_character_,
    source = "legacy_raw_file",
    script = NA_character_,
    source_bundle = basename(path),
    country_code = country_code,
    country_name = NA_character_,
    records = payload
  )
}

normalize_record <- function(record, payload) {
  tags <- record$tags %||% list()
  religion <- normalize_religion(tags[["religion"]])
  denomination <- tags[["denomination"]] %||% ""
  name <- tags[["name"]] %||% tags[["name:en"]] %||% "Unnamed Place of Worship"
  osm_type <- record$osm_type %||% record$type %||% "unknown"
  source_layer <- record$source_layer %||% NA_character_
  lat <- record$lat %||% NA_real_
  lon <- record$lon %||% record$lng %||% NA_real_

  list(
    id = paste0(substr(osm_type, 1, 1), record$osm_id %||% record$id),
    osm_id = record$osm_id %||% record$id,
    osm_type = osm_type,
    source_layer = source_layer,
    lat = lat,
    lng = lon,
    name = name,
    religion = religion,
    denomination = denomination,
    confidence = calculate_confidence(name, religion, denomination, tags, source_layer),
    country_code = payload$country_code,
    type = "churches",
    website = tags[["website"]] %||% "",
    phone = tags[["phone"]] %||% "",
    address = extract_address(tags),
    start_date = tags[["start_date"]] %||% NA_character_,
    snapshot_date = payload$snapshot_date %||% "undated",
    source_bundle = payload$source_bundle %||% "unknown",
    tags_raw = tags
  )
}

normalize_file <- function(path, output_dir, overwrite_outputs) {
  payload <- read_raw_payload(path)
  country_code <- payload$country_code %||% toupper(sub("_places_raw\\.json$", "", basename(path)))

  output_file <- file.path(
    output_dir,
    paste0(tolower(country_code), "_places_normalized.json")
  )

  if (file.exists(output_file) && !overwrite_outputs) {
    message(sprintf("  [%s] Exists. Skipping.", country_code))
    return(list(
      country_code = country_code,
      output_file = output_file,
      skipped = TRUE
    ))
  }

  message(sprintf("  [%s] Normalizing %s...", country_code, basename(path)))

  normalized_records <- payload$records |>
    purrr::map(function(record) normalize_record(record, payload))

  write_json(normalized_records, output_file, pretty = TRUE, auto_unbox = TRUE, null = "null")

  list(
    country_code = country_code,
    output_file = output_file,
    skipped = FALSE,
    record_count = length(normalized_records)
  )
}

write_normalization_manifest <- function(results, output_dir, input_path) {
  manifest_path <- file.path(output_dir, "normalization_manifest.json")

  manifest <- list(
    generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    script = "scripts/normalize_global_places.R",
    input_path = input_path,
    countries = results
  )

  write_json(manifest, manifest_path, pretty = TRUE, auto_unbox = TRUE, null = "null")
  message(sprintf("Wrote normalization manifest: %s", manifest_path))
}

main <- function() {
  args <- parse_args(commandArgs(trailingOnly = TRUE))

  input_path <- args$input_path %||% find_latest_snapshot_dir()

  input_files <- if (dir.exists(input_path)) {
    list.files(
      input_path,
      pattern = "_places_raw\\.json$",
      full.names = TRUE
    )
  } else if (file.exists(input_path)) {
    input_path
  } else {
    stop("Input path does not exist: ", input_path)
  }

  if (!is.null(args$country_codes)) {
    input_files <- input_files[
      toupper(sub("_places_raw\\.json$", "", basename(input_files))) %in% args$country_codes
    ]
  }

  if (length(input_files) == 0) {
    stop("No raw input files found for normalization.")
  }

  snapshot_name <- if (dir.exists(input_path)) {
    basename(input_path)
  } else {
    "undated"
  }

  output_dir <- file.path("data", "intermediate", "global", snapshot_name)
  dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)

  results <- purrr::map(
    input_files,
    function(path) normalize_file(path, output_dir, args$overwrite_outputs)
  )

  write_normalization_manifest(results, output_dir, input_path)
}

`%||%` <- function(left, right) {
  if (is.null(left) || (length(left) == 1 && is.na(left))) {
    return(right)
  }
  left
}

main()
