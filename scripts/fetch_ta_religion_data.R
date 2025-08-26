# language: R
# comments: lower case
# purpose: fetch census religion by territorial authority for 2006, 2013, 2018
# output: clean JSON data to replace flawed ta_aggregated_data.json

library(readxl)
library(httr)
library(dplyr)
library(janitor)
library(tidyr)
library(jsonlite)
library(purrr)

# ---- download paths ----
# using figure.nz which has processed stats nz data
url_figure <- "https://figure.nz/table/ITPm3h6kNu9LqEZt/download"

cat("Fetching census religion data from Figure.NZ...\n")
# ---- read and clean figure.nz data ----
path_figure <- tempfile(fileext = ".csv")
GET(url_figure, write_disk(path_figure, overwrite = TRUE))

# read the figure.nz csv and examine structure
religion_raw <- read.csv(path_figure) %>%
  clean_names()

cat("Column names in downloaded data:\n")
print(names(religion_raw))
cat("First few rows:\n")
print(head(religion_raw))

# extract the data we need using correct column names
religion_all <- religion_raw %>%
  # filter for count data only (not percentages)  
  filter(unit == "Count" & !is.na(value)) %>%
  # select relevant columns
  select(
    census_year,
    ta_name = territorial_authority,
    religion = religious_affiliation,
    count = value
  ) %>%
  # CRITICAL FIX: exclude national totals and non-TA entries
  filter(
    census_year %in% c(2013, 2018),
    !ta_name %in% c("New Zealand", "Area Outside Territorial Authority")
  ) %>%
  # clean up the data
  mutate(
    ta_name = gsub(" District| City", "", ta_name),
    count = as.numeric(count),
    census_year = as.numeric(census_year)
  )

# ---- harmonise religion categories across years ----
# create mapping for consistent religion names
harmonise_religion <- function(religion) {
  # keep exact case for key categories to match Stats NZ data
  case_when(
    religion == "Total people stated" ~ "Total people stated",
    religion == "Total people" ~ "Total people", 
    religion == "No religion" ~ "No religion",
    religion == "Christianity" ~ "Christianity",
    religion == "Buddhism" ~ "Buddhism", 
    religion == "Hinduism" ~ "Hinduism",
    religion == "Islam" ~ "Islam",
    religion == "Judaism" ~ "Judaism",
    religion == "Object to answering" ~ "Object to answering",
    grepl("Māori religions", religion) ~ "Māori religions",
    grepl("Spiritualism", religion) ~ "Spiritualism",
    grepl("Other Religions", religion) ~ "Other religions",
    TRUE ~ religion  # keep original for all other detailed categories
  )
}

# harmonise religion categories
religion_all$religion <- harmonise_religion(religion_all$religion)

# ---- reshape data by year ----
cat("Reshaping data by census year...\n")

# check for duplicates first
cat("Checking for duplicate entries...\n")
duplicates <- religion_all %>%
  group_by(ta_name, religion, census_year) %>%
  summarise(n = n(), .groups = "drop") %>%
  filter(n > 1)

if(nrow(duplicates) > 0) {
  cat("Found", nrow(duplicates), "duplicate entries. Summarising...\n")
  # sum up duplicates
  religion_all <- religion_all %>%
    group_by(ta_name, religion, census_year) %>%
    summarise(count = sum(count, na.rm = TRUE), .groups = "drop")
}

all_religion <- religion_all %>%
  pivot_wider(names_from = census_year, 
              values_from = count, 
              names_prefix = "count_",
              values_fill = 0) %>%
  # add 2006 as NA for now (not available in this source)
  mutate(count_2006 = NA_real_)

# ---- calculate totals and percentages ----
cat("Calculating totals using Total People Stated (not sum of all religion entries)...\n")
ta_religion_summary <- all_religion %>%
  group_by(ta_name) %>%
  summarise(
    # use the "Total people stated" figure directly (not sum of all religions)
    total_stated_2006 = count_2006[religion == "Total people stated"][1],
    total_stated_2013 = count_2013[religion == "Total people stated"][1],
    total_stated_2018 = count_2018[religion == "Total people stated"][1],
    no_religion_2006 = count_2006[religion == "No religion"][1],
    no_religion_2013 = count_2013[religion == "No religion"][1],
    no_religion_2018 = count_2018[religion == "No religion"][1],
    christian_total_2006 = count_2006[religion == "Christianity"][1],
    christian_total_2013 = count_2013[religion == "Christianity"][1],
    christian_total_2018 = count_2018[religion == "Christianity"][1],
    .groups = "drop"
  ) %>%
  # handle missing values
  mutate(
    total_stated_2006 = ifelse(is.na(total_stated_2006), 0, total_stated_2006),
    total_stated_2013 = ifelse(is.na(total_stated_2013), 0, total_stated_2013),
    total_stated_2018 = ifelse(is.na(total_stated_2018), 0, total_stated_2018),
    no_religion_2006 = ifelse(is.na(no_religion_2006), 0, no_religion_2006),
    no_religion_2013 = ifelse(is.na(no_religion_2013), 0, no_religion_2013),
    no_religion_2018 = ifelse(is.na(no_religion_2018), 0, no_religion_2018),
    christian_total_2006 = ifelse(is.na(christian_total_2006), 0, christian_total_2006),
    christian_total_2013 = ifelse(is.na(christian_total_2013), 0, christian_total_2013),
    christian_total_2018 = ifelse(is.na(christian_total_2018), 0, christian_total_2018)
  ) %>%
  # calculate religious percentages (total stated minus no religion)
  mutate(
    religious_2006 = ifelse(total_stated_2006 > 0, ((total_stated_2006 - no_religion_2006) / total_stated_2006) * 100, 0),
    religious_2013 = ifelse(total_stated_2013 > 0, ((total_stated_2013 - no_religion_2013) / total_stated_2013) * 100, 0),
    religious_2018 = ifelse(total_stated_2018 > 0, ((total_stated_2018 - no_religion_2018) / total_stated_2018) * 100, 0)
  )

# ---- create final dataset structure ----
cat("Creating final JSON structure...\n")
# create detailed religion breakdown
religion_detail <- all_religion %>%
  group_by(ta_name) %>%
  summarise(
    religions = list(
      data.frame(
        religion = religion,
        count_2006 = count_2006,
        count_2013 = count_2013,
        count_2018 = count_2018,
        stringsAsFactors = FALSE
      )
    ),
    .groups = "drop"
  )

# combine summary with detail
final_data <- ta_religion_summary %>%
  left_join(religion_detail, by = "ta_name") %>%
  # create final structure matching original format
  mutate(
    ta_code = row_number(),  # temporary - will need proper mapping
    data = pmap(list(ta_name, total_stated_2006, total_stated_2013, total_stated_2018,
                     religious_2006, religious_2013, religious_2018, religions),
                function(name, total06, total13, total18, rel06, rel13, rel18, religions) {
                  list(
                    ta_name = name,
                    population = list(
                      "2006" = total06,
                      "2013" = total13,
                      "2018" = total18
                    ),
                    religious_percentage = list(
                      "2006" = round(rel06, 1),
                      "2013" = round(rel13, 1),
                      "2018" = round(rel18, 1)
                    ),
                    religions = religions
                  )
                })
  )

# convert to named list for JSON output
output_data <- setNames(final_data$data, sprintf("%03d", final_data$ta_code))

# ---- save as JSON ----
output_path <- "../ta_aggregated_data_statsNZ.json"
cat("Saving cleaned data to:", output_path, "\n")
write_json(output_data, output_path, pretty = TRUE, auto_unbox = TRUE)

cat("✓ Successfully fetched and processed TA religion data\n")
cat("✓ Data saved to ta_aggregated_data_statsNZ.json\n")
cat("✓ Contains", length(output_data), "territorial authorities\n")

# ---- preview data ----
cat("\nPreview of first territorial authority:\n")
print(output_data[[1]], max.levels = 3)