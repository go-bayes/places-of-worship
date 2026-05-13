# Build a small, reproducible RA workpack from the NZ temporal OSM leads.
#
# This script does not ask an RA to review raw OSM differences. It reduces the
# generated OSM places-to-check files to a small mixed pilot set with one narrow
# evidence question per row.
#
# Usage:
#   Rscript scripts/build_nz_temporal_ra_workpack.R
#   Rscript scripts/build_nz_temporal_ra_workpack.R --limit 50

suppressPackageStartupMessages({
  library(dplyr)
  library(jsonlite)
})

collate_status <- try(Sys.setlocale("LC_COLLATE", "C"), silent = TRUE)
invisible(collate_status)
options(stringsAsFactors = FALSE)

repo_root <- normalizePath(
  if (basename(getwd()) == "scripts") ".." else ".",
  mustWork = TRUE
)

default_input_dir <- file.path("data", "intermediate", "nz_osm_temporal")
default_output_dir <- file.path("exports", "nz_temporal_ra_workpack")
default_workpack_id <- "nz-temporal-ra-workpack-001"

parse_args <- function(args) {
  input_dir <- default_input_dir
  output_dir <- default_output_dir
  workpack_id <- default_workpack_id
  limit <- 50L

  index <- 1L
  while (index <= length(args)) {
    arg <- args[[index]]
    if (arg == "--input-dir") {
      index <- index + 1L
      input_dir <- args[[index]]
    } else if (arg == "--output-dir") {
      index <- index + 1L
      output_dir <- args[[index]]
    } else if (arg == "--workpack-id") {
      index <- index + 1L
      workpack_id <- args[[index]]
    } else if (arg == "--limit") {
      index <- index + 1L
      limit <- as.integer(args[[index]])
    } else if (arg %in% c("--help", "-h")) {
      cat(
        "Build the first NZ temporal RA workpack.\n\n",
        "Options:\n",
        "  --input-dir DIR    Temporal OSM output directory (default: data/intermediate/nz_osm_temporal)\n",
        "  --output-dir DIR   Output directory (default: exports/nz_temporal_ra_workpack)\n",
        "  --workpack-id ID   Workpack id (default: nz-temporal-ra-workpack-001)\n",
        "  --limit N          Row limit (default: 50)\n",
        "  --help             Show this help\n",
        sep = ""
      )
      quit(save = "no", status = 0)
    } else {
      stop("Unknown argument: ", arg)
    }
    index <- index + 1L
  }

  if (is.na(limit) || limit < 1L) {
    stop("--limit must be a positive integer")
  }

  list(
    input_dir = input_dir,
    output_dir = output_dir,
    workpack_id = workpack_id,
    limit = limit
  )
}

repo_relative <- function(path) {
  sub(paste0("^", normalizePath(repo_root, winslash = "/", mustWork = TRUE), "/?"), "", normalizePath(path, winslash = "/", mustWork = FALSE))
}

read_required_csv <- function(path) {
  if (!file.exists(path)) {
    stop("Required input not found: ", path)
  }
  read.csv(path, check.names = FALSE, stringsAsFactors = FALSE, na.strings = c("", "NA"))
}

coalesce_chr <- function(...) {
  values <- list(...)
  for (value in values) {
    if (length(value) == 0 || is.null(value) || is.na(value) || trimws(as.character(value)) == "") next
    return(as.character(value))
  }
  ""
}

safe_col <- function(data, name) {
  if (name %in% names(data)) data[[name]] else rep(NA_character_, nrow(data))
}

has_text <- function(value) {
  !is.na(value) & trimws(as.character(value)) != ""
}

osm_object_url <- function(osm_key) {
  ifelse(
    has_text(osm_key) & grepl("/", osm_key, fixed = TRUE),
    paste0("https://www.openstreetmap.org/", osm_key),
    ""
  )
}

main_question <- function(case_type, row) {
  name <- coalesce_chr(row[["latest_name"]], row[["matched_current_name"]], "this place")
  if (case_type == "possible_opening_from_osm_date_tag") {
    return(paste0("Does independent evidence support the OSM date-tag suggestion that ", name, " was active in the relevant target years?"))
  }
  if (case_type == "likely_osm_object_churn_loss") {
    return(paste0("Does this apparent disappearance reflect a real end of worship use, or only OSM object replacement/mapping churn for ", name, "?"))
  }
  if (case_type == "ambiguous_date_or_status") {
    return(paste0("Can independent evidence clarify the ambiguous OSM date or target-year status for ", name, "?"))
  }
  if (case_type == "control_confirmation") {
    return(paste0("Can a straightforward non-OSM source confirm that ", name, " was an active place of worship across the target years?"))
  }
  paste0("Check the target-year worship-use evidence for ", name, ".")
}

source_hints <- function(row, include_replacement = FALSE) {
  hints <- c(
    "OSM object/history",
    "official website or directory",
    "denominational or faith-body directory",
    "street-level imagery with visible capture date",
    "charity/register/council/heritage source"
  )
  if (include_replacement && has_text(row[["nearby_replacement_osm_key"]])) {
    hints <- c(hints, paste0("nearby possible replacement: ", row[["nearby_replacement_osm_key"]]))
  }
  paste(hints, collapse = "; ")
}

as_text_frame <- function(data) {
  data |>
    mutate(across(everything(), \(value) as.character(value)))
}

build_date_tag_rows <- function(data, case_type, selection_reason) {
  if (nrow(data) == 0) return(tibble())

  data |>
    rowwise() |>
    mutate(
      case_type = case_type,
      source_file = "nz_osm_date_tag_places_to_check.csv",
      source_row_id = date_tag_row_id,
      source_record_id = date_tag_row_id,
      religion = latest_religion,
      denomination = latest_denomination,
      lat = latest_lat,
      lng = latest_lng,
      transition_windows = "",
      task_year_presence = paste(
        paste0("2013=", target_year_2013_status),
        paste0("2018=", target_year_2018_status),
        paste0("2023=", target_year_2023_status),
        sep = " | "
      ),
      nearby_replacement_osm_key = "",
      nearby_replacement_name = "",
      nearby_replacement_distance_m = "",
      main_question = main_question(case_type, pick(everything())),
      source_hints = source_hints(pick(everything())),
      selection_reason = selection_reason,
      osm_object_url = osm_object_url(osm_key)
    ) |>
    ungroup() |>
    as_text_frame()
}

build_temporal_rows <- function(data, case_type, selection_reason) {
  if (nrow(data) == 0) return(tibble())

  data |>
    rowwise() |>
    mutate(
      case_type = case_type,
      source_file = "nz_osm_temporal_candidates.csv",
      source_row_id = candidate_id,
      source_record_id = candidate_id,
      religion = latest_religion,
      denomination = latest_denomination,
      lat = latest_lat,
      lng = latest_lng,
      osm_date_tags_by_year = "",
      former_use_tags_by_year = "",
      origin_tag = "",
      origin_raw = "",
      origin_source_year = "",
      origin_not_earlier_than = "",
      origin_not_later_than = "",
      origin_date_precision = "",
      origin_parser_warning = "",
      closure_tag = "",
      closure_raw = "",
      closure_source_year = "",
      closure_not_earlier_than = "",
      closure_not_later_than = "",
      closure_date_precision = "",
      closure_parser_warning = "",
      candidate_date_tag_windows = "",
      target_year_2013_status = ifelse(present_in_cleaned_osm_2013, "present", "absent"),
      target_year_2013_basis = "cleaned_osm_snapshot_presence",
      target_year_2013_evidence = paste0("Cleaned OSM snapshot presence: 2013=", target_year_2013_status),
      target_year_2018_status = ifelse(present_in_cleaned_osm_2018, "present", "absent"),
      target_year_2018_basis = "cleaned_osm_snapshot_presence",
      target_year_2018_evidence = paste0("Cleaned OSM snapshot presence: 2018=", target_year_2018_status),
      target_year_2023_status = ifelse(present_in_cleaned_osm_2023, "present", "absent"),
      target_year_2023_basis = "cleaned_osm_snapshot_presence",
      target_year_2023_evidence = paste0("Cleaned OSM snapshot presence: 2023=", target_year_2023_status),
      main_question = main_question(case_type, pick(everything())),
      source_hints = source_hints(pick(everything()), include_replacement = TRUE),
      selection_reason = selection_reason,
      osm_object_url = osm_object_url(osm_key)
    ) |>
    ungroup() |>
    as_text_frame()
}

select_workpack <- function(date_tags, temporal, limit) {
  gain_rows <- date_tags |>
    filter(grepl("candidate_gain", candidate_date_tag_windows, fixed = TRUE)) |>
    arrange(candidate_date_tag_windows, latest_name, osm_key) |>
    build_date_tag_rows(
      "possible_opening_from_osm_date_tag",
      "All available OSM date-tag rows with candidate_gain windows are included first."
    )

  used_osm_keys <- unique(gain_rows$osm_key)

  churn_rows <- temporal |>
    filter(
      grepl("osm_present_then_absent", transition_types, fixed = TRUE),
      has_text(nearby_replacement_osm_key),
      !osm_key %in% used_osm_keys
    ) |>
    arrange(diff_category, latest_name, osm_key) |>
    head(5L) |>
    build_temporal_rows(
      "likely_osm_object_churn_loss",
      "Likely object-churn losses with a nearby replacement are included to test loss verification without treating OSM disappearance as closure."
    )

  used_osm_keys <- unique(c(used_osm_keys, churn_rows$osm_key))

  uncertain_rows <- date_tags |>
    filter(
      !osm_key %in% used_osm_keys,
      !grepl("candidate_gain", candidate_date_tag_windows, fixed = TRUE),
      has_text(origin_parser_warning) |
        has_text(closure_parser_warning) |
        target_year_2013_status == "uncertain" |
        target_year_2018_status == "uncertain" |
        target_year_2023_status == "uncertain" |
        grepl("candidate_status_change", candidate_date_tag_windows, fixed = TRUE)
    ) |>
    arrange(desc(has_text(origin_parser_warning) | has_text(closure_parser_warning)), candidate_date_tag_windows, latest_name, osm_key) |>
    head(5L) |>
    build_date_tag_rows(
      "ambiguous_date_or_status",
      "Ambiguous date or target-year rows test how well the RA workflow captures uncertainty."
    )

  used_osm_keys <- unique(c(used_osm_keys, uncertain_rows$osm_key))

  control_rows <- date_tags |>
    filter(
      !osm_key %in% used_osm_keys,
      !has_text(candidate_date_tag_windows),
      !has_text(origin_parser_warning),
      !has_text(closure_parser_warning),
      target_year_2013_status == "present",
      target_year_2018_status == "present",
      target_year_2023_status == "present"
    ) |>
    arrange(latest_name, osm_key) |>
    head(5L) |>
    build_date_tag_rows(
      "control_confirmation",
      "Clear present-present-present OSM date-tag rows provide straightforward controls."
    )

  rows <- bind_rows(gain_rows, churn_rows, uncertain_rows, control_rows)

  if (nrow(rows) > limit) {
    rows <- rows |> slice_head(n = limit)
  }

  rows
}

finalise_workpack <- function(rows, workpack_id) {
  workpack_id_value <- workpack_id
  common_columns <- c(
    "workpack_id",
    "workpack_row",
    "priority",
    "case_type",
    "source_file",
    "source_row_id",
    "source_record_id",
    "osm_key",
    "osm_object_url",
    "matched_current_project_id",
    "matched_current_name",
    "latest_name",
    "religion",
    "denomination",
    "lat",
    "lng",
    "target_years_to_check",
    "main_question",
    "source_hints",
    "selection_reason",
    "andre_check",
    "evidence_basis",
    "osm_date_tags_by_year",
    "former_use_tags_by_year",
    "origin_tag",
    "origin_raw",
    "origin_source_year",
    "origin_not_earlier_than",
    "origin_not_later_than",
    "origin_date_precision",
    "origin_parser_warning",
    "closure_tag",
    "closure_raw",
    "closure_source_year",
    "closure_not_earlier_than",
    "closure_not_later_than",
    "closure_date_precision",
    "closure_parser_warning",
    "candidate_date_tag_windows",
    "transition_types",
    "transition_windows",
    "task_year_presence",
    "nearby_replacement_osm_key",
    "nearby_replacement_name",
    "nearby_replacement_distance_m",
    "target_year_2013_status",
    "target_year_2013_basis",
    "target_year_2013_evidence",
    "target_year_2018_status",
    "target_year_2018_basis",
    "target_year_2018_evidence",
    "target_year_2023_status",
    "target_year_2023_basis",
    "target_year_2023_evidence",
    "ra_status",
    "ra_initials",
    "ra_source_title",
    "ra_source_url_or_file",
    "ra_target_year_2013_status",
    "ra_target_year_2018_status",
    "ra_target_year_2023_status",
    "ra_opening_or_closure_date",
    "ra_confidence",
    "ra_notes",
    "jb_review_status",
    "jb_review_notes"
  )

  for (column in common_columns) {
    if (!column %in% names(rows)) rows[[column]] <- ""
  }

  rows |>
    mutate(
      workpack_id = workpack_id_value,
      workpack_row = row_number(),
      priority = case_when(
        case_type == "possible_opening_from_osm_date_tag" ~ "high",
        case_type == "likely_osm_object_churn_loss" ~ "high",
        case_type == "ambiguous_date_or_status" ~ "medium",
        TRUE ~ "control"
      ),
      target_years_to_check = "2013;2018;2023",
      ra_status = "not_started",
      jb_review_status = "not_reviewed"
    ) |>
    select(all_of(common_columns))
}

args <- parse_args(commandArgs(trailingOnly = TRUE))
input_dir <- file.path(repo_root, args$input_dir)
output_dir <- file.path(repo_root, args$output_dir)

date_tag_path <- file.path(input_dir, "nz_osm_date_tag_places_to_check.csv")
temporal_path <- file.path(input_dir, "nz_osm_temporal_candidates.csv")

date_tags <- read_required_csv(date_tag_path)
temporal <- read_required_csv(temporal_path)

workpack <- select_workpack(date_tags, temporal, args$limit) |>
  finalise_workpack(args$workpack_id)

if (nrow(workpack) != args$limit) {
  stop("Expected ", args$limit, " workpack rows, produced ", nrow(workpack))
}

dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
csv_path <- file.path(output_dir, paste0(args$workpack_id, ".csv"))
summary_path <- file.path(output_dir, paste0(args$workpack_id, "-summary.json"))

write.csv(workpack, csv_path, row.names = FALSE, na = "")

summary <- list(
  workpack_id = args$workpack_id,
  generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z"),
  generated_by = "scripts/build_nz_temporal_ra_workpack.R",
  input_files = list(
    date_tag_places_to_check = list(
      path = repo_relative(date_tag_path),
      sha256 = unname(tools::sha256sum(date_tag_path)),
      rows = nrow(date_tags)
    ),
    temporal_candidates = list(
      path = repo_relative(temporal_path),
      sha256 = unname(tools::sha256sum(temporal_path)),
      rows = nrow(temporal)
    )
  ),
  output_files = list(
    workpack_csv = list(
      path = repo_relative(csv_path),
      sha256 = unname(tools::sha256sum(csv_path)),
      rows = nrow(workpack)
    )
  ),
  selection_counts = as.list(table(workpack$case_type)),
  selection_rule = list(
    order = c(
      "include all OSM date-tag rows with candidate_gain windows",
      "add five likely OSM object-churn loss rows with nearby replacements",
      "add five ambiguous date or target-year status rows",
      "add five clear present-present-present controls"
    ),
    sort_keys = c(
      "candidate windows, latest name, OSM key",
      "diff category, latest name, OSM key"
    )
  )
)

write_json(summary, summary_path, pretty = TRUE, auto_unbox = TRUE)

message("Wrote workpack CSV: ", repo_relative(csv_path))
message("Wrote summary JSON: ", repo_relative(summary_path))
message("Rows by case type:")
print(as.data.frame(table(workpack$case_type)))
