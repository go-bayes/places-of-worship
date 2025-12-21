#!/usr/bin/env Rscript

# Update global counts and manifest from data/global/*_places.json
# Usage: Rscript scripts/update_counts.R [data_dir] [manifest_path]

suppressPackageStartupMessages({
  library(jsonlite)
})

args <- commandArgs(trailingOnly = TRUE)
data_dir <- if (length(args) >= 1) args[[1]] else "data/global"
manifest_path <- if (length(args) >= 2) args[[2]] else file.path(data_dir, "manifest.json")

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

message("Done. Total places: ", total)
message("Updated: ", manifest_path)
message("Summary: ", summary_path)
