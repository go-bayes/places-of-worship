# Global places deduplication
# Usage:
#   Rscript scripts/deduplicate_global_places.R [input_path] [--overwrite]
#
# Example:
#   Rscript scripts/deduplicate_global_places.R data/intermediate/global/undated --overwrite

suppressPackageStartupMessages({
  library(jsonlite)
  library(purrr)
})

name_stopwords <- c(
  "a",
  "an",
  "and",
  "at",
  "church",
  "churches",
  "of",
  "place",
  "saint",
  "st",
  "the",
  "worship"
)

source_layer_priority <- c(
  "osm_multipolygons" = 4,
  "osm_polygons" = 3,
  "osm_points" = 2
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

iter_cleaned_files <- function(input_path) {
  if (file.exists(input_path) && !dir.exists(input_path)) {
    return(input_path)
  }

  sort(list.files(
    input_path,
    pattern = "_places_cleaned\\.json$",
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

canonical_name <- function(name) {
  cleaned <- tolower(name %||% "")
  cleaned <- gsub("\\bst\\s+", "saint ", cleaned, perl = TRUE)
  cleaned <- gsub("[^a-z0-9 ]+", " ", cleaned, perl = TRUE)
  cleaned <- gsub("\\s+", " ", cleaned, perl = TRUE)
  trimws(cleaned)
}

name_tokens <- function(name) {
  tokens <- unlist(regmatches(canonical_name(name), gregexpr("[a-z0-9]+", canonical_name(name), perl = TRUE)))
  setdiff(unique(tokens), name_stopwords)
}

canonical_address <- function(address) {
  cleaned <- tolower(address %||% "")
  cleaned <- gsub("\\s+", " ", cleaned, perl = TRUE)
  trimws(cleaned)
}

tag_count <- function(record) {
  tags <- record$tags_raw %||% list()
  sum(map_lgl(tags, \(value) !is.null(value) && !identical(value, "") && !is.na(value)))
}

record_score <- function(record) {
  tags <- record$tags_raw %||% list()
  source_layer <- record$source_layer %||% ""
  source_priority <- if (source_layer %in% names(source_layer_priority)) {
    unname(source_layer_priority[[source_layer]])
  } else {
    1
  }
  amenity_priority <- if (identical(tags[["amenity"]] %||% NULL, "place_of_worship")) 1 else 0
  named_priority <- if (!((record$name %||% "") %in% c("", "Unnamed Place of Worship"))) 1 else 0
  confidence <- as_numeric_or_na(record$confidence)
  confidence <- if (is.na(confidence)) 0 else confidence

  c(
    source_priority,
    amenity_priority,
    named_priority,
    tag_count(record),
    confidence
  )
}

names_match <- function(left, right) {
  left_name <- canonical_name(left$name %||% "")
  right_name <- canonical_name(right$name %||% "")

  if (left_name == "" || right_name == "") {
    return(FALSE)
  }

  if (identical(left_name, right_name)) {
    return(TRUE)
  }

  left_tokens <- name_tokens(left_name)
  right_tokens <- name_tokens(right_name)

  if (length(left_tokens) == 0 || length(right_tokens) == 0) {
    return(FALSE)
  }

  identical(sort(left_tokens), sort(right_tokens)) && length(left_tokens) >= 2
}

compatible_religion <- function(left, right) {
  left_religion <- tolower(left$religion %||% "")
  right_religion <- tolower(right$religion %||% "")
  left_denomination <- tolower(left$denomination %||% "")
  right_denomination <- tolower(right$denomination %||% "")

  if (left_religion != "" && right_religion != "" && left_religion != right_religion) {
    return(FALSE)
  }

  if (
    left_denomination != "" &&
      right_denomination != "" &&
      left_denomination != right_denomination
  ) {
    return(FALSE)
  }

  TRUE
}

is_duplicate <- function(left, right) {
  if (identical(left$id, right$id)) {
    return(FALSE)
  }

  if (!names_match(left, right)) {
    return(FALSE)
  }

  if (!compatible_religion(left, right)) {
    return(FALSE)
  }

  left_lat <- as_numeric_or_na(left$lat)
  left_lng <- as_numeric_or_na(left$lng)
  right_lat <- as_numeric_or_na(right$lat)
  right_lng <- as_numeric_or_na(right$lng)

  if (any(is.na(c(left_lat, left_lng, right_lat, right_lng)))) {
    return(FALSE)
  }

  if (haversine_distance_metres(left_lat, left_lng, right_lat, right_lng) > 25) {
    return(FALSE)
  }

  left_address <- canonical_address(left$address %||% "")
  right_address <- canonical_address(right$address %||% "")

  if (left_address != "" && right_address != "" && left_address != right_address) {
    return(FALSE)
  }

  TRUE
}

sort_records_by_score <- function(records) {
  if (length(records) == 0) {
    return(records)
  }

  score_matrix <- do.call(rbind, map(records, record_score))

  order_index <- do.call(
    order,
    c(as.data.frame(as.data.frame(score_matrix)), list(decreasing = TRUE))
  )

  records[order_index]
}

deduplicate_records <- function(records) {
  kept_records <- list()
  resolutions <- list()

  for (record in sort_records_by_score(records)) {
    duplicate_index <- NULL

    if (length(kept_records) > 0) {
      for (index in seq_along(kept_records)) {
        if (is_duplicate(record, kept_records[[index]])) {
          duplicate_index <- index
          break
        }
      }
    }

    if (is.null(duplicate_index)) {
      kept_records[[length(kept_records) + 1]] <- record
      next
    }

    kept_record <- kept_records[[duplicate_index]]
    distance_metres <- haversine_distance_metres(
      as_numeric_or_na(record$lat),
      as_numeric_or_na(record$lng),
      as_numeric_or_na(kept_record$lat),
      as_numeric_or_na(kept_record$lng)
    )

    resolutions[[length(resolutions) + 1]] <- list(
      dropped_id = record$id,
      kept_id = kept_record$id,
      dropped_name = record$name,
      kept_name = kept_record$name,
      distance_metres = round(distance_metres, 2),
      reason = "same_name_same_religion_close_location"
    )
  }

  if (length(kept_records) > 0) {
    kept_records <- kept_records[order(map_chr(kept_records, \(record) record$id %||% ""))]
  }

  list(
    records = kept_records,
    resolutions = resolutions
  )
}

deduplicate_file <- function(path, output_dir, overwrite_outputs) {
  country_code <- toupper(sub("_places_cleaned\\.json$", "", basename(path)))
  output_file <- file.path(
    output_dir,
    sub("_cleaned", "_deduplicated", basename(path))
  )
  resolution_file <- file.path(
    output_dir,
    sub("_places_cleaned\\.json$", "_duplicate_resolutions.json", basename(path))
  )

  if (file.exists(output_file) && !overwrite_outputs) {
    return(list(
      country_code = country_code,
      output_file = output_file,
      skipped = TRUE
    ))
  }

  message(sprintf("  [%s] Deduplicating %s...", country_code, basename(path)))

  records <- read_json(path, simplifyVector = FALSE)
  result <- deduplicate_records(records)

  write_json(
    result$records,
    output_file,
    pretty = TRUE,
    auto_unbox = TRUE,
    null = "null"
  )
  write_json(
    result$resolutions,
    resolution_file,
    pretty = TRUE,
    auto_unbox = TRUE,
    null = "null"
  )

  list(
    country_code = country_code,
    output_file = output_file,
    resolution_file = resolution_file,
    skipped = FALSE,
    input_count = length(records),
    output_count = length(result$records),
    removed_count = length(result$resolutions)
  )
}

write_deduplication_manifest <- function(results, output_dir, input_path) {
  manifest <- list(
    generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    script = "scripts/deduplicate_global_places.R",
    input_path = input_path,
    countries = results
  )

  manifest_path <- file.path(output_dir, "deduplication_manifest.json")
  write_json(manifest, manifest_path, pretty = TRUE, auto_unbox = TRUE, null = "null")
  message(sprintf("Wrote deduplication manifest: %s", manifest_path))
}

main <- function() {
  args <- parse_args(commandArgs(trailingOnly = TRUE))
  input_path <- args$input_path %||% find_latest_snapshot_dir()

  input_files <- iter_cleaned_files(input_path)
  if (length(input_files) == 0) {
    stop("No cleaned files found under ", input_path, ".")
  }

  snapshot_name <- if (dir.exists(input_path)) basename(input_path) else basename(dirname(input_path))
  output_dir <- file.path("data", "intermediate", "global", snapshot_name)
  dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)

  results <- input_files |>
    map(\(path) deduplicate_file(path, output_dir, args$overwrite_outputs))

  write_deduplication_manifest(results, output_dir, input_path)
}

main()
