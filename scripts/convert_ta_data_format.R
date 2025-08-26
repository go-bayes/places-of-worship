# language: R  
# comments: lower case
# purpose: convert new Stats NZ TA data format to legacy app format
# input: ta_aggregated_data_statsNZ.json (new format)
# output: ta_aggregated_data.json (legacy format)

library(jsonlite)
library(dplyr)
library(purrr)

cat("Converting new Stats NZ format to legacy app format...\n")

# read new format data
new_data <- read_json("../ta_aggregated_data_statsNZ.json")

# function to convert single TA data
convert_ta_data <- function(ta_data) {
  
  # extract religion data array
  religions <- ta_data$religions
  
  # prepare data for each year
  years_data <- list()
  
  for (year in c("2006", "2013", "2018")) {
    year_data <- list()
    count_col <- paste0("count_", year)
    
    # use the correct population figure from statsNZ data (not sum of religions)
    correct_population <- ta_data$population[[year]]
    if (is.null(correct_population) || is.na(correct_population)) {
      correct_population <- 0
    }
    
    # set total stated to correct population figure
    year_data[["Total stated"]] <- correct_population
    
    # process each religion
    for (religion in religions) {
      religion_name <- religion$religion
      count_value <- religion[[count_col]]
      
      # handle missing/NA values
      if (is.null(count_value) || is.na(count_value)) {
        count_value <- 0
      }
      
      # map religion names to legacy format  
      legacy_name <- case_when(
        religion_name == "No religion" ~ "No religion",
        religion_name == "Christianity" ~ "Christian", 
        religion_name == "Buddhism" ~ "Buddhism",
        religion_name == "Hinduism" ~ "Hinduism",
        religion_name == "Islam" ~ "Islam",
        religion_name == "Judaism" ~ "Judaism",
        # ignore summary/total entries to prevent double counting
        religion_name %in% c("Total people", "Total people stated", "Object to answering") ~ NA_character_,
        # group remaining religions (excluding totals)
        TRUE ~ "Other"
      )
      
      # skip entries that map to NA (totals)
      if (is.na(legacy_name)) {
        next
      }
      
      # add to year data, combining duplicates
      if (legacy_name %in% names(year_data)) {
        year_data[[legacy_name]] <- year_data[[legacy_name]] + count_value
      } else {
        year_data[[legacy_name]] <- count_value
      }
    }
    
    # add name field for legacy compatibility
    year_data[["name"]] <- ta_data$ta_name
    
    # store year data
    years_data[[year]] <- year_data
  }
  
  return(years_data)
}

# convert all TAs
cat("Processing", length(new_data), "territorial authorities...\n")

legacy_data <- map(new_data, convert_ta_data)

# add names to maintain TA identification
legacy_data <- imap(legacy_data, function(ta_data, ta_code) {
  # add name to root level for each year
  for (year in names(ta_data)) {
    if (is.list(ta_data[[year]]) && !is.null(new_data[[ta_code]]$ta_name)) {
      ta_data[[year]][["name"]] <- new_data[[ta_code]]$ta_name
    }
  }
  return(ta_data)
})

# save as legacy format
output_path <- "../ta_aggregated_data.json"
cat("Saving converted data to:", output_path, "\n")
write_json(legacy_data, output_path, pretty = TRUE, auto_unbox = TRUE)

cat("✓ Successfully converted to legacy format\n")

# preview conversion
cat("\nPreview of converted data for first TA:\n")
first_ta_code <- names(legacy_data)[1]
first_ta <- legacy_data[[first_ta_code]]
cat("TA Code:", first_ta_code, "\n")
if ("2018" %in% names(first_ta)) {
  cat("2018 data keys:", paste(names(first_ta[["2018"]]), collapse = ", "), "\n")
  cat("Total stated 2018:", first_ta[["2018"]][["Total stated"]], "\n")
  cat("No religion 2018:", first_ta[["2018"]][["No religion"]], "\n")
}