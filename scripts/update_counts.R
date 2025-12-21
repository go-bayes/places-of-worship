#!/usr/bin/env Rscript

# Update global counts and manifest from data/global/*_places.json
# Usage: Rscript scripts/update_counts.R [data_dir] [manifest_path]

suppressPackageStartupMessages({
  library(jsonlite)
})

args <- commandArgs(trailingOnly = TRUE)
data_dir <- if (length(args) >= 1) args[[1]] else "data/global"
manifest_path <- if (length(args) >= 2) args[[2]] else file.path(data_dir, "manifest.json")
# Write a dated manifest copy for diffing
manifest_dated_path <- if (length(args) >= 3) args[[3]] else file.path(data_dir, paste0("manifest-", format(Sys.Date(), "%Y%m%d"), ".json"))
# Write a changes report
changes_path <- if (length(args) >= 4) args[[4]] else file.path(data_dir, "changes.csv")

if (!dir.exists(data_dir)) {
  stop("Data directory not found: ", data_dir)
}

files <- list.files(data_dir, pattern = "_places\\.json$", full.names = TRUE)
if (length(files) == 0) {
  stop("No *_places.json files found in ", data_dir, ". Sync data/global before running.")
}

count_file <- function(path) {
  message("Counting ", basename(path), " ...")
  con <- file(path, open = "r")
  on.exit(close(con), add = TRUE)
  df <- stream_in(con, verbose = FALSE)
  if (is.data.frame(df)) {
    nrow(df)
  } else {
    length(df)
  }
}

counts <- vapply(files, count_file, integer(1))
total <- sum(counts)
by_country <- counts
names(by_country) <- sub("_places\\.json$", "", basename(files))

manifest <- if (file.exists(manifest_path)) {
  read_json(manifest_path, simplifyVector = TRUE)
} else {
  list()
}

manifest$generated_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ")
manifest$totals <- list(
  global = unname(total),
  by_country = as.list(by_country)
)

write_json(manifest, manifest_path, pretty = TRUE, auto_unbox = TRUE)

summary_path <- file.path(data_dir, "counts_summary.csv")
write.csv(
  data.frame(country = names(by_country), count = as.integer(by_country)),
  summary_path,
  row.names = FALSE
)

# Save dated manifest
write_json(manifest, manifest_dated_path, pretty = TRUE, auto_unbox = TRUE)

# Diff against previous manifest if available
if (file.exists(manifest_path)) {
  prev <- tryCatch(read_json(manifest_path, simplifyVector = TRUE), error = function(e) NULL)
  if (!is.null(prev) && !is.null(prev$totals$by_country)) {
    prev_counts <- unlist(prev$totals$by_country)
    delta <- by_country - prev_counts[names(by_country)]
    delta[is.na(delta)] <- by_country[is.na(delta)]  # new countries
    changes <- data.frame(
      country = names(by_country),
      previous = as.integer(prev_counts[names(by_country)]),
      current = as.integer(by_country),
      delta = as.integer(delta)
    )
    write.csv(changes, changes_path, row.names = FALSE)
    message("Changes written: ", changes_path)
  }
}

message("Done. Total places: ", total)
message("Updated: ", manifest_path)
message("Summary: ", summary_path)
message("Dated manifest: ", manifest_dated_path)
