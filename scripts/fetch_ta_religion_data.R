# language: R
# purpose: fetch territorial authority religion data and align it to official TA codes
# output: apps/regions/nz/data/ta_aggregated_data.json

suppressPackageStartupMessages({
  library(dplyr)
  library(httr)
  library(janitor)
  library(jsonlite)
  library(purrr)
})

repo_root <- normalizePath(
  if (basename(getwd()) == "scripts") ".." else ".",
  mustWork = TRUE
)

url_figure <- "https://figure.nz/table/ITPm3h6kNu9LqEZt/download"
census_years <- c(2013, 2018, 2023)
legacy_empty_years <- 2006
boundary_path <- file.path(repo_root, "apps/regions/nz/data/territorial_authorities.geojson")
output_path <- file.path(repo_root, "apps/regions/nz/data/ta_aggregated_data.json")
local_csv_path <- file.path(repo_root, "archive/stats_nz_religious_affiliation_by_ta.csv")

normalise_ta_name <- function(x) {
  x <- iconv(x, from = "UTF-8", to = "ASCII//TRANSLIT")
  x <- tolower(x)
  x <- gsub("['’]", "", x = x)
  x <- gsub("\\b(district|city|territory|council)\\b", "", x = x)
  x <- gsub("\\s+", " ", x = x)
  trimws(x)
}

load_ta_lookup <- function(path) {
  geojson <- read_json(path, simplifyVector = FALSE)

  map_dfr(
    geojson$features,
    \(feature) {
      tibble(
        ta_code = feature$properties$TA2025_V1,
        ta_name_boundary = feature$properties$TA2025_NAME
      )
    }
  ) |>
    mutate(ta_name_key = normalise_ta_name(ta_name_boundary))
}

category_template <- function(name, total_stated, christian, no_religion, buddhism,
                              hinduism, islam, judaism, maori_religions,
                              other_religions, spiritualism) {
  list(
    name = name,
    Total = total_stated,
    `Total stated` = total_stated,
    Christian = christian,
    `No religion` = no_religion,
    Buddhism = buddhism,
    Hinduism = hinduism,
    Islam = islam,
    Judaism = judaism,
    `Māori Christian` = maori_religions,
    `Maori religions, beliefs, and philosophies` = maori_religions,
    `Other religion` = other_religions + spiritualism,
    `Other religions, beliefs, and philosophies` = other_religions + spiritualism,
    `Spiritualism and New Age religions` = spiritualism
  )
}

empty_year_entry <- function(name) {
  category_template(
    name = name,
    total_stated = 0,
    christian = 0,
    no_religion = 0,
    buddhism = 0,
    hinduism = 0,
    islam = 0,
    judaism = 0,
    maori_religions = 0,
    other_religions = 0,
    spiritualism = 0
  )
}

extract_count <- function(df, label) {
  value <- df |>
    filter(religion == label) |>
    pull(count)

  if (length(value) == 0) {
    return(0)
  }

  as.numeric(value[[1]])
}

extract_pattern_count <- function(df, pattern) {
  value <- df |>
    filter(grepl(pattern, religion)) |>
    pull(count)

  if (length(value) == 0) {
    return(0)
  }

  sum(as.numeric(value), na.rm = TRUE)
}

build_year_entry <- function(df, name, year) {
  year_df <- df |>
    filter(census_year == year)

  if (nrow(year_df) == 0) {
    return(empty_year_entry(name))
  }

  total_stated <- extract_count(year_df, "Total people stated")
  if (total_stated == 0) {
    total_stated <- extract_count(year_df, "Total people")
  }

  category_template(
    name = name,
    total_stated = total_stated,
    christian = extract_count(year_df, "Christianity"),
    no_religion = extract_count(year_df, "No religion"),
    buddhism = extract_count(year_df, "Buddhism"),
    hinduism = extract_count(year_df, "Hinduism"),
    islam = extract_count(year_df, "Islam"),
    judaism = extract_count(year_df, "Judaism"),
    maori_religions = extract_pattern_count(year_df, "^Māori religions, beliefs and philosophies"),
    other_religions = extract_pattern_count(year_df, "^Other Religions, Beliefs and Philosophies"),
    spiritualism = extract_pattern_count(year_df, "^Spiritual")
  )
}

load_religion_source <- function() {
  cat("Fetching census religion data from Figure.NZ...\n")
  path_figure <- tempfile(fileext = ".csv")

  response <- tryCatch(
    GET(url_figure, write_disk(path_figure, overwrite = TRUE)),
    error = function(e) NULL
  )

  if (!is.null(response) && response$status_code == 200) {
    religion_raw <- read.csv(path_figure) |>
      clean_names()

    if (all(c("unit", "value", "territorial_authority") %in% names(religion_raw))) {
      return(religion_raw)
    }
  }

  cat("Figure.NZ unavailable. Falling back to local Stats NZ extract at", local_csv_path, "\n")
  read.csv(local_csv_path, fileEncoding = "UTF-8-BOM") |>
    clean_names()
}

ta_lookup <- load_ta_lookup(boundary_path)

religion_raw <- load_religion_source()

religion_all <- religion_raw |>
  filter(unit == "Count", !is.na(value)) |>
  select(
    census_year,
    ta_name = territorial_authority,
    religion = religious_affiliation,
    count = value
  ) |>
  filter(
    census_year %in% census_years,
    !ta_name %in% c("New Zealand", "Area Outside Territorial Authority")
  ) |>
  mutate(
    ta_name_key = normalise_ta_name(ta_name),
    count = as.numeric(count),
    census_year = as.numeric(census_year)
  ) |>
  group_by(ta_name, ta_name_key, religion, census_year) |>
  summarise(count = sum(count, na.rm = TRUE), .groups = "drop") |>
  left_join(ta_lookup, by = "ta_name_key")

unmatched_tas <- religion_all |>
  filter(is.na(ta_code)) |>
  distinct(ta_name)

if (nrow(unmatched_tas) > 0) {
  stop(
    "Unmatched territorial authorities: ",
    paste(unmatched_tas$ta_name, collapse = ", ")
  )
}

ta_output <- religion_all |>
  group_by(ta_code, ta_name_boundary) |>
  group_split()

output_data <- map(
  ta_output,
  \(ta_df) {
    name <- ta_df$ta_name_boundary[[1]]

    year_entries <- map(
      c(legacy_empty_years, census_years),
      \(year) {
        if (year %in% legacy_empty_years) {
          empty_year_entry(name)
        } else {
          build_year_entry(ta_df, name, year)
        }
      }
    )
    year_entries <- set_names(year_entries, as.character(c(legacy_empty_years, census_years)))

    c(list(name = name), year_entries)
  }
)

output_names <- map_chr(ta_output, \(ta_df) ta_df$ta_code[[1]])
output_data <- set_names(output_data, output_names)
output_data <- output_data[order(names(output_data))]

cat("Saving aligned TA religion data to:", output_path, "\n")
write_json(output_data, output_path, pretty = TRUE, auto_unbox = TRUE)

cat("✓ Successfully fetched and processed TA religion data\n")
cat("✓ Data saved to", output_path, "\n")
cat("✓ Contains", length(output_data), "territorial authorities\n")
cat("✓ Census years:", paste(c(legacy_empty_years, census_years), collapse = ", "), "\n")
