# language: R
# comments: lower case
# purpose: fetch migration data by territorial authority from Stats NZ
# output: static JSON file for enhanced places application
# source: Statistics New Zealand - portal.apis.stats.govt.nz

library(httr)
library(dplyr)
library(jsonlite)

# ---- configuration ----
# Stats NZ API key (use environment variable in production)
api_key <- "5f3f95fc8ec04a04a852f83bb71cdc6f" # Primary key provided by user

# API endpoint for migration data
endpoint <- "https://portal.apis.stats.govt.nz/v1/population/migration"

cat("Fetching migration data from Stats NZ API...\\n")

# ---- fetch migration data ----
fetch_migration_data <- function() {
  # Request migration data for all territorial authorities for recent years
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

# ---- process migration data ----
process_migration_data <- function(raw_data) {
  if (is.null(raw_data) || is.null(raw_data$data)) {
    cat("No migration data to process\\n")
    return(list())
  }
  
  processed <- list()
  
  for (record in raw_data$data) {
    ta_code <- record$territorial_authority_code
    year <- as.character(record$year)
    
    internal_in <- record$internal_arrivals %||% 0
    internal_out <- record$internal_departures %||% 0
    external_in <- record$external_arrivals %||% 0  
    external_out <- record$external_departures %||% 0
    net_migration <- internal_in - internal_out + external_in - external_out
    
    if (is.null(processed[[ta_code]])) {
      processed[[ta_code]] <- list()
    }
    
    processed[[ta_code]][[year]] <- list(
      internal_migration_in = internal_in,
      internal_migration_out = internal_out,
      external_migration_in = external_in,
      external_migration_out = external_out,
      net_migration = net_migration,
      net_internal = internal_in - internal_out,
      net_external = external_in - external_out
    )
  }
  
  return(processed)
}

# ---- main execution ----
cat("Starting migration data collection...\\n")

# Fetch raw data
raw_data <- fetch_migration_data()

if (!is.null(raw_data)) {
  # Process data
  migration_data <- process_migration_data(raw_data)
  
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
    data = migration_data
  )
  
  # Save as JSON
  output_path <- "../src/migration_data_static.json"
  write_json(output_data, output_path, pretty = TRUE, auto_unbox = TRUE)
  
  cat("✓ Migration data saved to:", output_path, "\\n")
  cat("✓ Contains data for", length(migration_data), "territorial authorities\\n")
  
} else {
  cat("❌ Failed to fetch migration data\\n")
  
  # Create empty file to prevent loading errors
  output_data <- list(
    metadata = list(
      source = "Statistics New Zealand",
      download_date = as.character(Sys.Date()),
      status = "API_UNAVAILABLE"
    ),
    data = list()
  )
  
  output_path <- "../src/migration_data_static.json"
  write_json(output_data, output_path, pretty = TRUE, auto_unbox = TRUE)
  
  cat("Created empty migration file to prevent loading errors\\n")
}

cat("Migration data collection completed.\\n")