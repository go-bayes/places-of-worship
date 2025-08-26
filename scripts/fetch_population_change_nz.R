# language: R  
# comments: lower case
# purpose: fetch population change data by SA2 from Stats NZ
# output: static JSON file for enhanced places application
# source: Statistics New Zealand - portal.apis.stats.govt.nz

library(httr)
library(dplyr)
library(jsonlite)

# ---- configuration ----
# Stats NZ API key (use environment variable in production)
api_key <- "5f3f95fc8ec04a04a852f83bb71cdc6f" # Primary key provided by user

# API endpoint for population change
endpoint <- "https://portal.apis.stats.govt.nz/v1/census/population-change"

cat("Fetching population change data from Stats NZ API...\\n")

# ---- fetch population change data ----
fetch_population_change <- function() {
  # Request population change data for SA2 level for census years
  url <- paste0(endpoint, "?geographic_level=SA2&years=2013,2018,2023")
  
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

# ---- process population change data ----
process_population_change <- function(raw_data) {
  if (is.null(raw_data) || is.null(raw_data$data)) {
    cat("No population change data to process\\n")
    return(list())
  }
  
  processed <- list()
  
  for (record in raw_data$data) {
    sa2_code <- record$sa2_code
    year <- as.character(record$year)
    
    population <- record$population %||% 0
    pop_change <- record$population_change %||% 0
    pop_change_pct <- record$population_change_percent %||% 0
    
    if (is.null(processed[[sa2_code]])) {
      processed[[sa2_code]] <- list()
    }
    
    processed[[sa2_code]][[year]] <- list(
      population = population,
      population_change = pop_change,
      population_change_percent = round(pop_change_pct, 2)
    )
  }
  
  return(processed)
}

# ---- main execution ----
cat("Starting population change data collection...\\n")

# Fetch raw data
raw_data <- fetch_population_change()

if (!is.null(raw_data)) {
  # Process data
  pop_change_data <- process_population_change(raw_data)
  
  # Add metadata
  output_data <- list(
    metadata = list(
      source = "Statistics New Zealand",
      api_endpoint = endpoint,
      download_date = as.character(Sys.Date()),
      coverage_years = c("2013", "2018", "2023"),
      geographic_level = "Statistical Area 2 (SA2)",
      license = "CC BY 4.0"
    ),
    data = pop_change_data
  )
  
  # Save as JSON
  output_path <- "../src/population_change_static.json"
  write_json(output_data, output_path, pretty = TRUE, auto_unbox = TRUE)
  
  cat("✓ Population change data saved to:", output_path, "\\n")
  cat("✓ Contains data for", length(pop_change_data), "SA2 areas\\n")
  
} else {
  cat("❌ Failed to fetch population change data\\n")
  
  # Create empty file to prevent loading errors
  output_data <- list(
    metadata = list(
      source = "Statistics New Zealand", 
      download_date = as.character(Sys.Date()),
      status = "API_UNAVAILABLE"
    ),
    data = list()
  )
  
  output_path <- "../src/population_change_static.json"
  write_json(output_data, output_path, pretty = TRUE, auto_unbox = TRUE)
  
  cat("Created empty population change file to prevent loading errors\\n")
}

cat("Population change data collection completed.\\n")