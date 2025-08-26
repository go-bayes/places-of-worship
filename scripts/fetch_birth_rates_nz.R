# language: R
# comments: lower case
# purpose: fetch birth rates by territorial authority from Stats NZ
# output: static JSON file for enhanced places application
# source: Statistics New Zealand - portal.apis.stats.govt.nz

library(httr)
library(dplyr)
library(jsonlite)

# ---- configuration ----
# Stats NZ API key (use environment variable in production)
api_key <- "5f3f95fc8ec04a04a852f83bb71cdc6f" # Primary key provided by user

# API endpoint for birth rates
endpoint <- "https://portal.apis.stats.govt.nz/v1/births-deaths/births"

cat("Fetching birth rate data from Stats NZ API...\\n")

# ---- fetch birth rate data ----
fetch_birth_rates <- function() {
  # Request birth rates for all territorial authorities for recent years
  url <- paste0(endpoint, "?territorial_authority=all&years=2018,2019,2020,2021,2022")
  
  response <- GET(
    url,
    add_headers(
      "Ocp-Apim-Subscription-Key" = api_key,
      "Accept" = "application/json"
    )
  )
  
  if (status_code(response) != 200) {
    cat("ERROR: API request failed with status", status_code(response), "\\n")
    cat("Response:", content(response, "text"), "\\n")
    return(NULL)
  }
  
  # Parse response
  data <- content(response, "parsed")
  return(data)
}

# ---- process birth rate data ----
process_birth_rates <- function(raw_data) {
  if (is.null(raw_data) || is.null(raw_data$data)) {
    cat("No birth rate data to process\\n")
    return(list())
  }
  
  processed <- list()
  
  for (record in raw_data$data) {
    ta_code <- record$territorial_authority_code
    year <- as.character(record$year)
    births <- record$births %||% 0
    population <- record$population %||% 1
    birth_rate <- (births / population) * 1000  # births per 1000 people
    
    if (is.null(processed[[ta_code]])) {
      processed[[ta_code]] <- list()
    }
    
    processed[[ta_code]][[year]] <- list(
      births = births,
      population = population,
      birth_rate = round(birth_rate, 2)
    )
  }
  
  return(processed)
}

# ---- main execution ----
cat("Starting birth rate data collection...\\n")

# Fetch raw data
raw_data <- fetch_birth_rates()

if (!is.null(raw_data)) {
  # Process data
  birth_rate_data <- process_birth_rates(raw_data)
  
  # Add metadata
  output_data <- list(
    metadata = list(
      source = "Statistics New Zealand",
      api_endpoint = endpoint,
      download_date = as.character(Sys.Date()),
      coverage_years = c("2018", "2019", "2020", "2021", "2022"),
      geographic_level = "Territorial Authority",
      license = "CC BY 4.0"
    ),
    data = birth_rate_data
  )
  
  # Save as JSON
  output_path <- "../src/birth_rates_static.json"
  write_json(output_data, output_path, pretty = TRUE, auto_unbox = TRUE)
  
  cat("✓ Birth rate data saved to:", output_path, "\\n")
  cat("✓ Contains data for", length(birth_rate_data), "territorial authorities\\n")
  
} else {
  cat("❌ Failed to fetch birth rate data\\n")
  
  # Create empty file to prevent loading errors
  output_data <- list(
    metadata = list(
      source = "Statistics New Zealand",
      download_date = as.character(Sys.Date()),
      status = "API_UNAVAILABLE"
    ),
    data = list()
  )
  
  output_path <- "../src/birth_rates_static.json"
  write_json(output_data, output_path, pretty = TRUE, auto_unbox = TRUE)
  
  cat("Created empty birth rate file to prevent loading errors\\n")
}

cat("Birth rate data collection completed.\\n")