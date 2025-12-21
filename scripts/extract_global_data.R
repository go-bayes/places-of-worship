# Global Places of Worship Extraction (All Countries Edition)
# Dependencies: install.packages(c("osmdata", "sf", "dplyr", "jsonlite", "rnaturalearth", "rnaturalearthdata"))

suppressPackageStartupMessages({
  library(osmdata)
  library(sf)
  library(dplyr)
  library(jsonlite)
  library(purrr)
  library(rnaturalearth)
})

# --- Configuration ---
DATA_DIR <- "data/global"
if (!dir.exists(DATA_DIR)) dir.create(DATA_DIR, recursive = TRUE)

# --- 1. Get All Countries ---
# rnaturalearth provides a clean sf object with ISO codes and names
world_map <- ne_countries(scale = "medium", returnclass = "sf")

# Filter out Antarctica and undefined regions to save time
target_countries <- world_map %>%
  filter(!is.na(iso_a2), continent != "Antarctica") %>%
  select(name = name, code = iso_a2) %>%
  st_drop_geometry()

message(sprintf("Targeting %d countries/territories...", nrow(target_countries)))

# --- 2. Helper Functions (Same as before) ---

normalize_religion <- function(rel) {
  rel <- tolower(rel)
  dplyr::case_when(
    rel %in% c("christian", "catholic", "protestant", "orthodox", "baptist", "methodist", "pentecostal") ~ "christian",
    rel %in% c("muslim", "islam", "sunni", "shia") ~ "muslim",
    rel %in% c("jewish", "judaism") ~ "jewish",
    rel %in% c("hindu", "hinduism") ~ "hindu",
    rel %in% c("buddhist", "buddhism") ~ "buddhist",
    rel %in% c("sikh", "sikhism") ~ "sikh",
    rel %in% c("shinto") ~ "shinto",
    rel %in% c("taoist", "taoism") ~ "taoist",
    TRUE ~ "unknown"
  )
}

calculate_confidence <- function(name, religion, denomination) {
  score <- 0.5
  if (!is.na(name) && name != "") score <- score + 0.2
  if (!is.na(religion) && religion != "unknown") score <- score + 0.1
  if (!is.na(denomination) && denomination != "") score <- score + 0.1
  return(min(score, 1.0))
}

# --- 3. The Extraction Function ---

extract_country <- function(country_code, country_name) {
  # Standardize file path
  safe_name <- gsub("[^a-zA-Z0-9]", "_", tolower(country_code))
  output_file <- file.path(DATA_DIR, paste0(safe_name, "_places.json"))

  # Skip if file already exists (Remove this check to force refresh)
  if (file.exists(output_file)) {
    message(sprintf("  [%s] Exists. Skipping.", country_code))
    return(NULL)
  }

  message(sprintf("  [%s] Fetching %s...", country_code, country_name))

  # Be polite to the API
  Sys.sleep(2)

  tryCatch(
    {
      # Increase timeout for large countries (Russia, China, etc.)
      q <- opq(bbox = country_name, timeout = 2400) %>%
        add_osm_feature(key = "amenity", value = "place_of_worship")

      osm_raw <- osmdata_sf(q)

      # Collect points and polygon centroids
      valid_objs <- list()
      if (!is.null(osm_raw$osm_points) && nrow(osm_raw$osm_points) > 0) {
        valid_objs[[length(valid_objs) + 1]] <- osm_raw$osm_points
      }
      if (!is.null(osm_raw$osm_polygons) && nrow(osm_raw$osm_polygons) > 0) {
        suppressWarnings(valid_objs[[length(valid_objs) + 1]] <- st_centroid(osm_raw$osm_polygons))
      }

      if (length(valid_objs) == 0) {
        message(sprintf("  [%s] No data found.", country_code))
        # Write empty list to prevent re-querying next time
        write_json(list(), output_file)
        return(NULL)
      }

      combined <- do.call(dplyr::bind_rows, valid_objs)

      # Ensure columns exist
      cols_check <- c("name", "name:en", "religion", "denomination", "amenity")
      for (col in cols_check) if (!col %in% names(combined)) combined[[col]] <- NA

      coords <- st_coordinates(combined)

      final_df <- combined %>%
        st_drop_geometry() %>%
        mutate(
          lat = coords[, 2],
          lng = coords[, 1],
          country = country_code,
          name = coalesce(name, `name:en`, "Unnamed Place of Worship"),
          religion = normalize_religion(religion),
          denomination = coalesce(denomination, ""),
          confidence = mapply(calculate_confidence, name, religion, denomination)
        ) %>%
        select(lat, lng, name, religion, denomination, country, confidence)

      write_json(final_df, output_file, pretty = TRUE, auto_unbox = TRUE)
      message(sprintf("  [%s] Success! Saved %d places.", country_code, nrow(final_df)))
    },
    error = function(e) {
      message(sprintf("  [%s] FAILED: %s", country_code, e$message))
    }
  )
}

# --- 4. Main Loop ---
# Loop through the dataframe rows
apply(target_countries, 1, function(row) {
  extract_country(row["code"], row["name"])
})


# # global Places of Worship Extraction Script
# # replaces: scripts/extract_real_global_data.py
# # dependencies: install.packages(c("osmdata", "sf", "dplyr", "jsonlite", "purrr"))
#
# suppressPackageStartupMessages({
#   library(osmdata)
#   library(sf)
#   library(dplyr)
#   library(jsonlite)
#   library(purrr)
# })
#
# # configuration
# DATA_DIR <- "data/global"
# if (!dir.exists(DATA_DIR)) dir.create(DATA_DIR, recursive = TRUE)
#
# # 1. define schema helper
# # ensures consistent output format matching README spec
# format_for_export <- function(sf_obj, country_code) {
#   coords <- st_coordinates(sf_obj)
#
#   sf_obj %>%
#     st_drop_geometry() %>%
#     mutate(
#       lat = coords[, 2],
#       lng = coords[, 1],
#       country = country_code,
#       # Fallbacks for missing names
#       name = coalesce(name, name.en, "Unnamed Place of Worship"),
#       religion = coalesce(religion, "unknown"),
#       denomination = coalesce(denomination, "unknown")
#     ) %>%
#     select(lat, lng, name, religion, denomination, country)
# }
#
# # 2. extraction function
# extract_country <- function(country_name, country_code) {
#   message(sprintf("Processing %s (%s)...", country_name, country_code))
#
#   output_file <- file.path(DATA_DIR, paste0(country_code, "_places.json"))
#
#   # build overpass query
#   # 'timeout' increased for large datasets
#   q <- opq(bbox = country_name, timeout = 900) %>%
#     add_osm_feature(key = "amenity", value = "place_of_worship")
#
#   # execute query (safely)
#   tryCatch(
#     {
#       # download and convert to sf
#       osm_data <- osmdata_sf(q)
#
#       # combine points and polygons (centroids for polygons)
#       points <- osm_data$osm_points
#       polygons <- osm_data$osm_polygons
#
#       combined <- list()
#
#       if (!is.null(points) && nrow(points) > 0) {
#         combined[[1]] <- points %>% select(any_of(c("name", "name:en", "religion", "denomination")))
#       }
#
#       if (!is.null(polygons) && nrow(polygons) > 0) {
#         # Calculate centroids for building footprints
#         combined[[2]] <- polygons %>%
#           st_centroid() %>%
#           select(any_of(c("name", "name:en", "religion", "denomination")))
#       }
#
#       if (length(combined) == 0) {
#         message(sprintf("  No data found for %s.", country_name))
#         return(NULL)
#       }
#
#       # merge/ format
#       final_data <- do.call(rbind, combined) %>%
#         format_for_export(country_code)
#
#       # write JSON
#       write_json(final_data, output_file, pretty = TRUE, auto_unbox = TRUE)
#       message(sprintf("  Saved %d places to %s", nrow(final_data), output_file))
#     },
#     error = function(e) {
#       message(sprintf("  Error processing %s: %s", country_name, e$message))
#     }
#   )
# }
#
# # 3. execution loop
# # replace this list with CSV read or 'rnaturalearth' data
# target_countries <- list(
#   list(name = "New Zealand", code = "NZ"),
#   list(name = "Australia", code = "AU")
#   # Add more countries here
# )
#
# # run extraction
# walk(target_countries, ~ extract_country(.x$name, .x$code))
