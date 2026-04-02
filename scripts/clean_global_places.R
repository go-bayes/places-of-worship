# Global places cleaning
# Usage:
#   Rscript scripts/clean_global_places.R [input_path] [--overwrite]
#
# Example:
#   Rscript scripts/clean_global_places.R data/intermediate/global/undated --overwrite

suppressPackageStartupMessages({
  library(jsonlite)
  library(purrr)
})

excluded_amenities <- c(
  "childcare",
  "school",
  "hospital",
  "social_facility",
  "college",
  "university",
  "kindergarten",
  "community_centre",
  "events_venue",
  "library",
  "pub",
  "grave_yard",
  "parking"
)

excluded_buildings <- c("school")

generic_name_tokens <- c(
  "and",
  "anglican",
  "apostolic",
  "assembly",
  "assemblies",
  "baptist",
  "catholic",
  "centre",
  "centres",
  "christian",
  "church",
  "churches",
  "community",
  "corps",
  "hall",
  "house",
  "houses",
  "methodist",
  "parish",
  "place",
  "presbyterian",
  "roman",
  "saint",
  "salvation",
  "site",
  "sites",
  "st",
  "the",
  "worship",
  "youth"
)

parse_args <- function(args) {
  positional <- args[!startsWith(args, "--")]
  flags <- args[startsWith(args, "--")]

  list(
    input_path = if (length(positional) >= 1) positional[[1]] else NULL,
    overwrite_outputs = any(flags %in% c("--overwrite", "--force"))
  )
}

find_latest_snapshot_dir <- function() {
  base_dir <- file.path("data", "intermediate", "global")
  if (!dir.exists(base_dir)) {
    stop("No intermediate global directory found at ", base_dir, ".")
  }

  snapshot_dirs <- list.dirs(base_dir, recursive = FALSE, full.names = TRUE)
  if (length(snapshot_dirs) == 0) {
    stop("No snapshot directories found under ", base_dir, ".")
  }

  snapshot_dirs[[which.max(basename(snapshot_dirs))]]
}

iter_input_files <- function(input_path) {
  if (file.exists(input_path) && !dir.exists(input_path)) {
    return(input_path)
  }

  sort(list.files(
    input_path,
    pattern = "_places_normalized\\.json$",
    full.names = TRUE
  ))
}

as_numeric_or_na <- function(value) {
  if (is.null(value) || identical(value, "") || is.na(value)) {
    return(NA_real_)
  }

  suppressWarnings(as.numeric(value))
}

haversine_distance_metres <- function(lat_1, lng_1, lat_2, lng_2) {
  lat_1_rad <- lat_1 * pi / 180
  lng_1_rad <- lng_1 * pi / 180
  lat_2_rad <- lat_2 * pi / 180
  lng_2_rad <- lng_2 * pi / 180

  delta_lat <- lat_2_rad - lat_1_rad
  delta_lng <- lng_2_rad - lng_1_rad

  haversine <- sin(delta_lat / 2) ^ 2 +
    cos(lat_1_rad) * cos(lat_2_rad) * sin(delta_lng / 2) ^ 2

  6371000 * 2 * asin(sqrt(haversine))
}

matches_pattern <- function(pattern, value) {
  grepl(pattern, value %||% "", perl = TRUE, ignore.case = TRUE)
}

normalise_name_tokens <- function(name) {
  normalised <- tolower(name %||% "")
  normalised <- gsub("\\bst\\s+", "saint ", normalised, perl = TRUE)
  tokens <- unlist(regmatches(normalised, gregexpr("[a-z]+", normalised, perl = TRUE)))
  setdiff(unique(tokens), generic_name_tokens)
}

is_support_building_duplicate <- function(record, records) {
  name <- record$name %||% ""

  hall_like_name <- matches_pattern("\\bhall\\b", name) &&
    !matches_pattern(
      "\\b(kingdom hall|gospel hall|mission hall|assembly hall|church of christ hall|christadelphian hall)\\b",
      name
    )

  centre_like_name <- matches_pattern("\\bcentre\\b", name) &&
    !matches_pattern(
      "\\b(church|christian|islamic|baha'i|bahai|bahá'í|worship|life|gospel|masjid|mosque|faith|revival|outreach|breakthrough|hope|buddhist|temple|celebration|family|heritage|mission|charity)\\b",
      name
    )

  house_like_name <- matches_pattern("\\bhouse\\b", name) &&
    !matches_pattern(
      "\\b(house of|church|worship|masjid|mosque|temple|faith|hope|grace|bread|breakthrough)\\b",
      name
    )

  if (
    !matches_pattern("\\b(church hall|parish centre|community centre)\\b", name) &&
      !hall_like_name &&
      !centre_like_name &&
      !house_like_name
  ) {
    return(FALSE)
  }

  lat <- as_numeric_or_na(record$lat)
  lng <- as_numeric_or_na(record$lng)

  if (is.na(lat) || is.na(lng)) {
    return(FALSE)
  }

  record_tokens <- normalise_name_tokens(name)
  denomination <- record$denomination %||% ""

  for (other in records) {
    if (identical(other$id, record$id)) {
      next
    }

    other_name <- other$name %||% ""
    if (!matches_pattern("\\b(church|cathedral|chapel|temple|mosque|synagogue|gurdwara)\\b", other_name)) {
      next
    }

    other_lat <- as_numeric_or_na(other$lat)
    other_lng <- as_numeric_or_na(other$lng)

    if (is.na(other_lat) || is.na(other_lng)) {
      next
    }

    if (haversine_distance_metres(lat, lng, other_lat, other_lng) > 100) {
      next
    }

    other_tokens <- normalise_name_tokens(other_name)
    shared_tokens <- intersect(record_tokens, other_tokens)
    denomination_match <- denomination != "" &&
      identical(denomination, other$denomination %||% "")

    if (length(shared_tokens) >= 1) {
      return(TRUE)
    }

    if (hall_like_name && denomination_match && length(record_tokens) <= 1) {
      return(TRUE)
    }

    if (centre_like_name && denomination_match && length(record_tokens) <= 1) {
      return(TRUE)
    }

    if (house_like_name && denomination_match && length(record_tokens) <= 1) {
      return(TRUE)
    }

    if (length(record_tokens) == 0 && denomination_match) {
      return(TRUE)
    }
  }

  FALSE
}

keep_record <- function(record, records) {
  tags <- record$tags_raw %||% list()
  amenity <- tags[["amenity"]] %||% NULL
  building <- tags[["building"]] %||% NULL
  name <- record$name %||% ""

  if (!is.null(amenity) && amenity %in% excluded_amenities) {
    return(FALSE)
  }

  if (!is.null(building) && building %in% excluded_buildings) {
    return(FALSE)
  }

  if (matches_pattern("\\b(cemetery|burial|urupa|office|residence|pub|kindergarten)\\b", name)) {
    return(FALSE)
  }

  if (matches_pattern("^Place of Worship \\d+$", name) && length(tags) == 0) {
    return(FALSE)
  }

  if (
    matches_pattern("^(Christian|Anglican|Roman_Catholic|Jewish|Sikh|Mormon|Methodist|Lutheran) Place of Worship$", name) &&
      is.null(amenity) &&
      is.null(building)
  ) {
    return(FALSE)
  }

  if (matches_pattern("\\bmasonic centre\\b", name)) {
    return(FALSE)
  }

  if (matches_pattern("\\bmasonic hall\\b", name)) {
    return(FALSE)
  }

  if (is_support_building_duplicate(record, records)) {
    return(FALSE)
  }

  if (matches_pattern("\\b(school|academy|seminary|college)\\b", name)) {
    chapel_like <- matches_pattern("chapel", name) || identical(building, "chapel")
    explicit_worship_space <- identical(amenity, "place_of_worship")

    if (!chapel_like && !explicit_worship_space) {
      return(FALSE)
    }
  }

  TRUE
}

clean_file <- function(path, output_dir, overwrite_outputs) {
  country_code <- toupper(sub("_places_normalized\\.json$", "", basename(path)))
  output_file <- file.path(
    output_dir,
    sub("_normalized", "_cleaned", basename(path))
  )

  if (file.exists(output_file) && !overwrite_outputs) {
    return(list(
      country_code = country_code,
      output_file = output_file,
      skipped = TRUE
    ))
  }

  message(sprintf("  [%s] Cleaning %s...", country_code, basename(path)))

  records <- read_json(path, simplifyVector = FALSE)
  filtered_records <- keep(
    records,
    \(record) keep_record(record, records)
  )

  write_json(
    filtered_records,
    output_file,
    pretty = TRUE,
    auto_unbox = TRUE,
    null = "null"
  )

  list(
    country_code = country_code,
    output_file = output_file,
    skipped = FALSE,
    input_count = length(records),
    output_count = length(filtered_records),
    removed_count = length(records) - length(filtered_records)
  )
}

write_cleaning_manifest <- function(results, output_dir, input_path) {
  manifest <- list(
    generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    script = "scripts/clean_global_places.R",
    input_path = input_path,
    countries = results
  )

  manifest_path <- file.path(output_dir, "cleaning_manifest.json")
  write_json(manifest, manifest_path, pretty = TRUE, auto_unbox = TRUE, null = "null")
  message(sprintf("Wrote cleaning manifest: %s", manifest_path))
}

main <- function() {
  args <- parse_args(commandArgs(trailingOnly = TRUE))
  input_path <- args$input_path %||% find_latest_snapshot_dir()

  input_files <- iter_input_files(input_path)
  if (length(input_files) == 0) {
    stop("No normalized files found under ", input_path, ".")
  }

  snapshot_name <- if (dir.exists(input_path)) basename(input_path) else basename(dirname(input_path))
  output_dir <- file.path("data", "intermediate", "global", snapshot_name)
  dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)

  results <- input_files |>
    map(\(path) clean_file(path, output_dir, args$overwrite_outputs))

  write_cleaning_manifest(results, output_dir, input_path)
}

main()
