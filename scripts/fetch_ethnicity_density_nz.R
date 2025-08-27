# language: R  
# comments: lower case
# purpose: fetch ethnicity and population density data by TA from Stats NZ
# output: static JSON file for enhanced places application
# source: Statistics New Zealand - portal.apis.stats.govt.nz

library(httr)
library(dplyr)
library(jsonlite)

# ---- configuration ----
# Stats NZ API key
api_key <- "5f3f95fc8ec04a04a852f83bb71cdc6f" # Primary key provided by user

# API endpoints
ethnicity_endpoint <- "https://portal.apis.stats.govt.nz/v1/census/ethnicity-profile"
geography_endpoint <- "https://portal.apis.stats.govt.nz/v1/geography/territorial-authorities"

cat("Fetching ethnicity and population density data from Stats NZ API...\n")

# ---- fetch ethnicity data ----
fetch_ethnicity_data <- function() {
  # Request ethnicity data for TA level for census years
  url <- paste0(ethnicity_endpoint, "?geographic_level=TA&years=2013,2018")
  
  response <- GET(
    url,
    add_headers(
      "Ocp-Apim-Subscription-Key" = api_key,
      "Accept" = "application/json"
    )
  )
  
  if (status_code(response) != 200) {
    cat("ERROR: Ethnicity API request failed with status", status_code(response), "\n")
    cat("Response:", content(response, "text"), "\n")
    return(NULL)
  }
  
  data <- content(response, "parsed")
  return(data)
}

# ---- fetch geography data for area calculations ----
fetch_geography_data <- function() {
  # Request TA geography data including area
  response <- GET(
    geography_endpoint,
    add_headers(
      "Ocp-Apim-Subscription-Key" = api_key,
      "Accept" = "application/json"
    )
  )
  
  if (status_code(response) != 200) {
    cat("ERROR: Geography API request failed with status", status_code(response), "\n")
    cat("Response:", content(response, "text"), "\n")
    return(NULL)
  }
  
  data <- content(response, "parsed")
  return(data)
}

# ---- process ethnicity data ----
process_ethnicity_data <- function(raw_data) {
  if (is.null(raw_data) || is.null(raw_data$data)) {
    cat("No ethnicity data to process\n")
    return(list())
  }
  
  processed <- list()
  
  for (record in raw_data$data) {
    ta_code <- record$ta_code
    year <- as.character(record$year)
    
    if (is.null(processed[[ta_code]])) {
      processed[[ta_code]] <- list()
    }
    
    if (is.null(processed[[ta_code]][[year]])) {
      processed[[ta_code]][[year]] <- list()
    }
    
    total_population <- record$total_population %||% 0
    
    processed[[ta_code]][[year]]$ethnicity <- list(
      total_population = total_population,
      european = record$european %||% 0,
      maori = record$maori %||% 0,
      pacific = record$pacific %||% 0,
      asian = record$asian %||% 0,
      middle_eastern_latin_african = record$melaa %||% 0,
      other = record$other_ethnicity %||% 0,
      european_percent = round((record$european %||% 0) / total_population * 100, 1),
      maori_percent = round((record$maori %||% 0) / total_population * 100, 1),
      pacific_percent = round((record$pacific %||% 0) / total_population * 100, 1),
      asian_percent = round((record$asian %||% 0) / total_population * 100, 1),
      melaa_percent = round((record$melaa %||% 0) / total_population * 100, 1),
      other_percent = round((record$other_ethnicity %||% 0) / total_population * 100, 1)
    )
  }
  
  return(processed)
}

# ---- process geography data for population density ----
process_geography_data <- function(raw_data) {
  if (is.null(raw_data) || is.null(raw_data$data)) {
    cat("No geography data to process\n")
    return(list())
  }
  
  geography_lookup <- list()
  
  for (record in raw_data$data) {
    ta_code <- record$ta_code
    geography_lookup[[ta_code]] <- list(
      area_km2 = record$area_km2 %||% 0,
      name = record$ta_name %||% "Unknown"
    )
  }
  
  return(geography_lookup)
}

# ---- calculate population density ----
add_population_density <- function(ethnicity_data, geography_data) {
  for (ta_code in names(ethnicity_data)) {
    if (ta_code %in% names(geography_data)) {
      area_km2 <- geography_data[[ta_code]]$area_km2
      
      for (year in names(ethnicity_data[[ta_code]])) {
        if (!is.null(ethnicity_data[[ta_code]][[year]]$ethnicity)) {
          population <- ethnicity_data[[ta_code]][[year]]$ethnicity$total_population
          density <- if (area_km2 > 0) round(population / area_km2, 1) else 0
          
          ethnicity_data[[ta_code]][[year]]$geography <- list(
            area_km2 = area_km2,
            population_density = density,
            population_density_category = case_when(
              density >= 1000 ~ "Very High",
              density >= 100 ~ "High", 
              density >= 10 ~ "Medium",
              density >= 1 ~ "Low",
              TRUE ~ "Very Low"
            )
          )
        }
      }
    }
  }
  
  return(ethnicity_data)
}

# ---- main execution ----
cat("Starting ethnicity and population density data collection...\n")

# Fetch raw data
ethnicity_raw <- fetch_ethnicity_data()
geography_raw <- fetch_geography_data()

if (!is.null(ethnicity_raw)) {
  # Process ethnicity data
  ethnicity_data <- process_ethnicity_data(ethnicity_raw)
  
  # Process geography data and add population density
  if (!is.null(geography_raw)) {
    geography_data <- process_geography_data(geography_raw)
    ethnicity_data <- add_population_density(ethnicity_data, geography_data)
  }
  
  # Add metadata
  output_data <- list(
    metadata = list(
      source = "Statistics New Zealand",
      api_endpoints = c(ethnicity_endpoint, geography_endpoint),
      download_date = as.character(Sys.Date()),
      coverage_years = c("2013", "2018"),
      geographic_level = "Territorial Authority (TA)",
      categories = c("ethnicity", "population_density"),
      license = "CC BY 4.0"
    ),
    data = ethnicity_data
  )
  
  # Save as JSON
  output_path <- "../src/ethnicity_density_static.json"
  write_json(output_data, output_path, pretty = TRUE, auto_unbox = TRUE)
  
  cat("✓ Ethnicity and population density data saved to:", output_path, "\n")
  cat("✓ Contains data for", length(ethnicity_data), "TA areas\n")
  
} else {
  cat("❌ Failed to fetch ethnicity data\n")
  
  # Create empty file to prevent loading errors
  output_data <- list(
    metadata = list(
      source = "Statistics New Zealand", 
      download_date = as.character(Sys.Date()),
      status = "API_UNAVAILABLE"
    ),
    data = list()
  )
  
  output_path <- "../src/ethnicity_density_static.json"
  write_json(output_data, output_path, pretty = TRUE, auto_unbox = TRUE)
  
  cat("Created empty ethnicity/density file to prevent loading errors\n")
}

cat("Ethnicity and population density data collection completed.\n")