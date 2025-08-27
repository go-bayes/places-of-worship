# language: R  
# comments: lower case
# purpose: fetch employment and income data by TA from Stats NZ
# output: static JSON file for enhanced places application
# source: Statistics New Zealand - portal.apis.stats.govt.nz

library(httr)
library(dplyr)
library(jsonlite)

# ---- configuration ----
# Stats NZ API key
api_key <- "5f3f95fc8ec04a04a852f83bb71cdc6f" # Primary key provided by user

# API endpoint for employment and income data
endpoint <- "https://portal.apis.stats.govt.nz/v1/census/economic-profile"

cat("Fetching employment and income data from Stats NZ API...\n")

# ---- fetch employment income data ----
fetch_employment_income_data <- function() {
  # Request employment and income data for TA level for census years
  url <- paste0(endpoint, "?geographic_level=TA&years=2013,2018&categories=employment,income")
  
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

# ---- process employment income data ----
process_employment_income_data <- function(raw_data) {
  if (is.null(raw_data) || is.null(raw_data$data)) {
    cat("No employment/income data to process\n")
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
    
    # process employment data
    if (category == "employment") {
      total_working_age <- record$working_age_population %||% 0
      employed <- record$employed %||% 0
      unemployed <- record$unemployed %||% 0
      not_in_labour_force <- record$not_in_labour_force %||% 0
      
      processed[[ta_code]][[year]]$employment <- list(
        working_age_population = total_working_age,
        employed = employed,
        unemployed = unemployed,
        not_in_labour_force = not_in_labour_force,
        employment_rate = if (total_working_age > 0) round((employed / total_working_age) * 100, 1) else 0,
        unemployment_rate = if ((employed + unemployed) > 0) round((unemployed / (employed + unemployed)) * 100, 1) else 0,
        participation_rate = if (total_working_age > 0) round(((employed + unemployed) / total_working_age) * 100, 1) else 0
      )
    }
    
    # process income data
    if (category == "income") {
      processed[[ta_code]][[year]]$income <- list(
        median_income = record$median_income %||% 0,
        income_under_20k = record$income_under_20k %||% 0,
        income_20k_50k = record$income_20k_50k %||% 0,
        income_50k_100k = record$income_50k_100k %||% 0,
        income_over_100k = record$income_over_100k %||% 0,
        total_income_earners = record$total_income_earners %||% 0,
        income_under_20k_percent = round((record$income_under_20k %||% 0) / (record$total_income_earners %||% 1) * 100, 1),
        income_20k_50k_percent = round((record$income_20k_50k %||% 0) / (record$total_income_earners %||% 1) * 100, 1),
        income_50k_100k_percent = round((record$income_50k_100k %||% 0) / (record$total_income_earners %||% 1) * 100, 1),
        income_over_100k_percent = round((record$income_over_100k %||% 0) / (record$total_income_earners %||% 1) * 100, 1)
      )
    }
  }
  
  return(processed)
}

# ---- main execution ----
cat("Starting employment and income data collection...\n")

# Fetch raw data
raw_data <- fetch_employment_income_data()

if (!is.null(raw_data)) {
  # Process data
  employment_income_data <- process_employment_income_data(raw_data)
  
  # Add metadata
  output_data <- list(
    metadata = list(
      source = "Statistics New Zealand",
      api_endpoint = endpoint,
      download_date = as.character(Sys.Date()),
      coverage_years = c("2013", "2018"),
      geographic_level = "Territorial Authority (TA)",
      categories = c("employment", "income"),
      license = "CC BY 4.0"
    ),
    data = employment_income_data
  )
  
  # Save as JSON
  output_path <- "../src/employment_income_static.json"
  write_json(output_data, output_path, pretty = TRUE, auto_unbox = TRUE)
  
  cat("✓ Employment and income data saved to:", output_path, "\n")
  cat("✓ Contains data for", length(employment_income_data), "TA areas\n")
  
} else {
  cat("❌ Failed to fetch employment and income data\n")
  
  # Create empty file to prevent loading errors
  output_data <- list(
    metadata = list(
      source = "Statistics New Zealand", 
      download_date = as.character(Sys.Date()),
      status = "API_UNAVAILABLE"
    ),
    data = list()
  )
  
  output_path <- "../src/employment_income_static.json"
  write_json(output_data, output_path, pretty = TRUE, auto_unbox = TRUE)
  
  cat("Created empty employment/income file to prevent loading errors\n")
}

cat("Employment and income data collection completed.\n")