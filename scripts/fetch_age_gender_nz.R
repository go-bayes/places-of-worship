# language: R  
# comments: lower case
# purpose: fetch age and gender demographics by TA from Stats NZ
# output: static JSON file for enhanced places application
# source: Statistics New Zealand - portal.apis.stats.govt.nz

library(httr)
library(dplyr)
library(jsonlite)

# ---- configuration ----
# Stats NZ API key
api_key <- "5f3f95fc8ec04a04a852f83bb71cdc6f" # Primary key provided by user

# API endpoint for age and gender demographics
endpoint <- "https://portal.apis.stats.govt.nz/v1/census/demographic-profile"

cat("Fetching age and gender demographics from Stats NZ API...\n")

# ---- fetch age gender data ----
fetch_age_gender_data <- function() {
  # Request age and gender data for TA level for census years
  url <- paste0(endpoint, "?geographic_level=TA&years=2013,2018&categories=age,gender")
  
  response <- GET(
    url,
    add_headers(
      "Ocp-Apim-Subscription-Key" = api_key,
      "Accept" = "application/json"
    )
  )
  
  if (status_code(response) != 200) {
    cat("ERROR: API request failed with status", status_code(response), "\n")
    cat("Response:", content(response, "text"), "\n")
    return(NULL)
  }
  
  # Parse response
  data <- content(response, "parsed")
  return(data)
}

# ---- process age gender data ----
process_age_gender_data <- function(raw_data) {
  if (is.null(raw_data) || is.null(raw_data$data)) {
    cat("No age/gender data to process\n")
    return(list())
  }
  
  processed <- list()
  
  for (record in raw_data$data) {
    ta_code <- record$ta_code
    year <- as.character(record$year)
    category <- record$category
    
    if (is.null(processed[[ta_code]])) {
      processed[[ta_code]] <- list()
    }
    
    if (is.null(processed[[ta_code]][[year]])) {
      processed[[ta_code]][[year]] <- list()
    }
    
    # process age demographics
    if (category == "age") {
      processed[[ta_code]][[year]]$age <- list(
        median_age = record$median_age %||% 0,
        age_0_14 = record$age_0_14 %||% 0,
        age_15_29 = record$age_15_29 %||% 0,
        age_30_49 = record$age_30_49 %||% 0,
        age_50_64 = record$age_50_64 %||% 0,
        age_65_plus = record$age_65_plus %||% 0,
        age_0_14_percent = round((record$age_0_14 %||% 0) / (record$total_population %||% 1) * 100, 1),
        age_15_29_percent = round((record$age_15_29 %||% 0) / (record$total_population %||% 1) * 100, 1),
        age_30_49_percent = round((record$age_30_49 %||% 0) / (record$total_population %||% 1) * 100, 1),
        age_50_64_percent = round((record$age_50_64 %||% 0) / (record$total_population %||% 1) * 100, 1),
        age_65_plus_percent = round((record$age_65_plus %||% 0) / (record$total_population %||% 1) * 100, 1)
      )
    }
    
    # process gender demographics
    if (category == "gender") {
      processed[[ta_code]][[year]]$gender <- list(
        male = record$male %||% 0,
        female = record$female %||% 0,
        male_percent = round((record$male %||% 0) / (record$total_population %||% 1) * 100, 1),
        female_percent = round((record$female %||% 0) / (record$total_population %||% 1) * 100, 1),
        total_population = record$total_population %||% 0
      )
    }
  }
  
  return(processed)
}

# ---- main execution ----
cat("Starting age and gender data collection...\n")

# Fetch raw data
raw_data <- fetch_age_gender_data()

if (!is.null(raw_data)) {
  # Process data
  age_gender_data <- process_age_gender_data(raw_data)
  
  # Add metadata
  output_data <- list(
    metadata = list(
      source = "Statistics New Zealand",
      api_endpoint = endpoint,
      download_date = as.character(Sys.Date()),
      coverage_years = c("2013", "2018"),
      geographic_level = "Territorial Authority (TA)",
      categories = c("age", "gender"),
      license = "CC BY 4.0"
    ),
    data = age_gender_data
  )
  
  # Save as JSON
  output_path <- "../src/age_gender_static.json"
  write_json(output_data, output_path, pretty = TRUE, auto_unbox = TRUE)
  
  cat("✓ Age and gender data saved to:", output_path, "\n")
  cat("✓ Contains data for", length(age_gender_data), "TA areas\n")
  
} else {
  cat("❌ Failed to fetch age and gender data\n")
  
  # Create empty file to prevent loading errors
  output_data <- list(
    metadata = list(
      source = "Statistics New Zealand", 
      download_date = as.character(Sys.Date()),
      status = "API_UNAVAILABLE"
    ),
    data = list()
  )
  
  output_path <- "../src/age_gender_static.json"
  write_json(output_data, output_path, pretty = TRUE, auto_unbox = TRUE)
  
  cat("Created empty age/gender file to prevent loading errors\n")
}

cat("Age and gender data collection completed.\n")