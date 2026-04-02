# Global review queue builder
# Usage:
#   Rscript scripts/build_global_review_queue.R [input_path]
#
# Example:
#   Rscript scripts/build_global_review_queue.R data/intermediate/global/undated

suppressPackageStartupMessages({
  library(jsonlite)
  library(purrr)
})

category_order <- c(
  "placeholder_name" = 1,
  "generic_worship_label" = 1,
  "institutional_site" = 1,
  "retreat_or_prayer_site" = 2,
  "hall_centre_house_site" = 2,
  "missing_core_tags" = 3
)

parse_args <- function(args) {
  positional <- args[!startsWith(args, "--")]

  list(
    input_path = if (length(positional) >= 1) positional[[1]] else NULL
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

  deduplicated_files <- sort(list.files(
    input_path,
    pattern = "_places_deduplicated\\.json$",
    full.names = TRUE
  ))

  if (length(deduplicated_files) > 0) {
    return(deduplicated_files)
  }

  sort(list.files(
    input_path,
    pattern = "_places_cleaned\\.json$",
    full.names = TRUE
  ))
}

matches_pattern <- function(pattern, value) {
  grepl(pattern, value %||% "", perl = TRUE, ignore.case = TRUE)
}

is_weak_tag_record <- function(record) {
  tags <- record$tags_raw %||% list()
  amenity <- tags[["amenity"]] %||% NULL
  building <- tags[["building"]] %||% NULL

  (is.null(amenity) || identical(amenity, "place_of_worship")) &&
    (is.null(building) || identical(building, "yes"))
}

classify_record <- function(record) {
  tags <- record$tags_raw %||% list()
  amenity <- tags[["amenity"]] %||% NULL
  building <- tags[["building"]] %||% NULL
  name <- record$name %||% ""
  weak <- is_weak_tag_record(record)

  if (weak && matches_pattern("^Place of Worship \\d+$", name)) {
    return(list(category = "placeholder_name", priority = category_order[["placeholder_name"]]))
  }

  if (
    weak &&
      matches_pattern("^(Christian|Anglican|Roman_Catholic|Jewish|Sikh|Mormon|Methodist|Lutheran) Place of Worship$", name)
  ) {
    return(list(category = "generic_worship_label", priority = category_order[["generic_worship_label"]]))
  }

  if (matches_pattern("\\b(academy|school|seminary|college)\\b", name)) {
    return(list(category = "institutional_site", priority = category_order[["institutional_site"]]))
  }

  if (matches_pattern("\\b(retreat|prayer|meditation)\\b", name)) {
    return(list(category = "retreat_or_prayer_site", priority = category_order[["retreat_or_prayer_site"]]))
  }

  if (weak && matches_pattern("\\b(centre|center|hall|house|community)\\b", name)) {
    return(list(category = "hall_centre_house_site", priority = category_order[["hall_centre_house_site"]]))
  }

  if (is.null(amenity) && is.null(building)) {
    return(list(category = "missing_core_tags", priority = category_order[["missing_core_tags"]]))
  }

  NULL
}

queue_row_from_record <- function(record, country_code) {
  classification <- classify_record(record)
  if (is.null(classification)) {
    return(NULL)
  }

  tags <- record$tags_raw %||% list()
  ordered_tag_names <- sort(names(tags))
  ordered_tags <- tags[ordered_tag_names]

  list(
    priority = classification$priority,
    category = classification$category,
    country_code = country_code,
    id = record$id %||% "",
    name = record$name %||% "",
    religion = record$religion %||% "",
    denomination = record$denomination %||% "",
    address = record$address %||% "",
    amenity = tags[["amenity"]] %||% "",
    building = tags[["building"]] %||% "",
    lat = as.character(record$lat %||% ""),
    lng = as.character(record$lng %||% ""),
    tags_raw = as.character(toJSON(ordered_tags, auto_unbox = TRUE, null = "null"))
  )
}

build_queue <- function(records, country_code) {
  queue <- records |>
    map(\(record) queue_row_from_record(record, country_code)) |>
    compact()

  if (length(queue) == 0) {
    return(data.frame())
  }

  queue_df <- queue |>
    map(\(row) as.data.frame(row, stringsAsFactors = FALSE)) |>
    list_rbind()

  queue_df[order(queue_df$priority, queue_df$category, queue_df$name, queue_df$id), , drop = FALSE]
}

write_country_queue <- function(path, output_dir) {
  country_code <- toupper(
    sub(
      "_places_(deduplicated|cleaned)\\.json$",
      "",
      basename(path)
    )
  )

  records <- read_json(path, simplifyVector = FALSE)
  queue <- build_queue(records, country_code)

  csv_path <- file.path(output_dir, paste0(tolower(country_code), "_review_queue.csv"))
  md_path <- file.path(output_dir, paste0(tolower(country_code), "_review_queue.md"))

  write.csv(queue, csv_path, row.names = FALSE, na = "")

  category_counts <- if (nrow(queue) == 0) integer() else table(queue$category)
  priority_counts <- if (nrow(queue) == 0) integer() else table(queue$priority)

  lines <- c(
    paste("#", country_code, "Review Queue"),
    "",
    paste("- cleaned dataset size:", length(records)),
    paste("- queued for manual review:", nrow(queue)),
    paste("- priority 1 records:", priority_counts[["1"]] %||% 0),
    paste("- priority 2 records:", priority_counts[["2"]] %||% 0),
    paste("- priority 3 records:", priority_counts[["3"]] %||% 0),
    "",
    "## Categories",
    ""
  )

  if (length(category_counts) > 0) {
    ordered_categories <- names(category_counts)[order(
      unname(category_order[names(category_counts)]),
      names(category_counts)
    )]

    lines <- c(
      lines,
      map_chr(
        ordered_categories,
        \(category) sprintf("- `%s`: %s", category, category_counts[[category]])
      )
    )
  }

  writeLines(lines, md_path, useBytes = TRUE)

  list(
    country_code = country_code,
    input_file = path,
    csv_path = csv_path,
    md_path = md_path,
    input_count = length(records),
    review_count = nrow(queue)
  )
}

write_review_manifest <- function(results, output_dir, input_path) {
  manifest <- list(
    generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    script = "scripts/build_global_review_queue.R",
    input_path = input_path,
    countries = results
  )

  manifest_path <- file.path(output_dir, "review_queue_manifest.json")
  write_json(manifest, manifest_path, pretty = TRUE, auto_unbox = TRUE, null = "null")
  message(sprintf("Wrote review queue manifest: %s", manifest_path))
}

main <- function() {
  args <- parse_args(commandArgs(trailingOnly = TRUE))
  input_path <- args$input_path %||% find_latest_snapshot_dir()

  input_files <- iter_input_files(input_path)
  if (length(input_files) == 0) {
    stop("No deduplicated or cleaned files found under ", input_path, ".")
  }

  snapshot_name <- if (dir.exists(input_path)) basename(input_path) else basename(dirname(input_path))
  output_dir <- file.path("docs", "review_queues", snapshot_name)
  dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)

  results <- input_files |>
    map(\(path) write_country_queue(path, output_dir))

  write_review_manifest(results, output_dir, input_path)
}

main()
