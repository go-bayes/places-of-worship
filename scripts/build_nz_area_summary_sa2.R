# language: R
# purpose: build the NZ statistical-area-2 area-summary product from the
#   provenance-recorded stats nz extract (2013, 2018, 2023 on SA2 2023
#   boundaries) plus current cleaned places of worship
# input: archive/statsnz-2023-census-totals-sa2/religion_sa2_2023.csv (+ manifest)
# input: apps/regions/nz/data/sa2_2023.geojson
# input: apps/regions/nz/data/nz_places.json
# output: apps/regions/nz/data/area_summary_sa2.json
# output: apps/regions/nz/data/area_summary_sa2.csv

suppressPackageStartupMessages({
  library(dplyr)
  library(tidyr)
  library(jsonlite)
  library(purrr)
})

repo_root <- normalizePath(
  if (basename(getwd()) == "scripts") ".." else ".",
  mustWork = TRUE
)

data_dir <- file.path(repo_root, "apps/regions/nz/data")
archive_dir <- file.path(repo_root, "archive/statsnz-2023-census-totals-sa2")
places_path <- file.path(data_dir, "nz_places.json")
boundary_path <- file.path(data_dir, "sa2_2023.geojson")
extract_path <- file.path(archive_dir, "religion_sa2_2023.csv")
manifest_path <- file.path(archive_dir, "religion_sa2_2023_manifest.json")
ta_summary_path <- file.path(data_dir, "area_summary_ta.json")
json_output_path <- file.path(data_dir, "area_summary_sa2.json")
csv_output_path <- file.path(data_dir, "area_summary_sa2.csv")

boundary_set_id <- "nz-sa2-2023"
boundary_level <- "statistical_area_2"
census_years <- c(2013L, 2018L, 2023L)
# below this denominator, rr3 rounding makes percentages volatile; rows are
# flagged and the map washes them out rather than implying precision
small_denominator_floor <- 100L

rate <- function(numerator, denominator, multiplier = 1, digits = 2) {
  if (is.na(numerator) || is.na(denominator) || denominator <= 0) {
    return(NA_real_)
  }
  round((numerator / denominator) * multiplier, digits)
}

# suppressed cells arrive as -999 from the feature service
clean_count <- function(x) {
  x <- suppressWarnings(as.integer(x))
  if_else(is.na(x) | x < 0, NA_integer_, x)
}

ring_to_matrix <- function(ring) {
  matrix(
    unlist(map(ring, \(coord) as.numeric(coord[seq_len(2)]))),
    ncol = 2,
    byrow = TRUE
  )
}

geometry_to_polygons <- function(geometry) {
  if (geometry$type == "Polygon") {
    return(list(map(geometry$coordinates, ring_to_matrix)))
  }
  if (geometry$type == "MultiPolygon") {
    return(map(geometry$coordinates, \(polygon) map(polygon, ring_to_matrix)))
  }
  stop("Unsupported boundary geometry type: ", geometry$type)
}

geometry_bbox <- function(polygons) {
  rings <- unlist(polygons, recursive = FALSE)
  coordinates <- do.call(rbind, rings)
  c(
    xmin = min(coordinates[, 1], na.rm = TRUE),
    xmax = max(coordinates[, 1], na.rm = TRUE),
    ymin = min(coordinates[, 2], na.rm = TRUE),
    ymax = max(coordinates[, 2], na.rm = TRUE)
  )
}

point_in_ring <- function(x, y, ring) {
  if (nrow(ring) < 3) {
    return(FALSE)
  }
  inside <- FALSE
  j <- nrow(ring)
  for (i in seq_len(nrow(ring))) {
    xi <- ring[i, 1]
    yi <- ring[i, 2]
    xj <- ring[j, 1]
    yj <- ring[j, 2]
    crosses <- (yi > y) != (yj > y)
    if (crosses) {
      x_intersection <- ((xj - xi) * (y - yi) / (yj - yi)) + xi
      if (!is.na(x_intersection) && x < x_intersection) {
        inside <- !inside
      }
    }
    j <- i
  }
  inside
}

point_in_polygon <- function(x, y, polygon) {
  if (!point_in_ring(x, y, polygon[[1]])) {
    return(FALSE)
  }
  if (length(polygon) > 1) {
    for (hole in polygon[-1]) {
      if (point_in_ring(x, y, hole)) {
        return(FALSE)
      }
    }
  }
  TRUE
}

point_in_geometry <- function(x, y, polygons) {
  for (polygon in polygons) {
    if (point_in_polygon(x, y, polygon)) {
      return(TRUE)
    }
  }
  FALSE
}

cat("Loading SA2 boundaries, extract, and places...\n")
boundaries <- read_json(boundary_path, simplifyVector = FALSE)
extract <- read.csv(extract_path, colClasses = c(area_code = "character"))
manifest <- read_json(manifest_path, simplifyVector = TRUE)
places <- read_json(places_path, simplifyVector = TRUE)

sa2_index <- map(boundaries$features, \(feature) {
  polygons <- geometry_to_polygons(feature$geometry)
  list(
    code = feature$properties$SA22023_V1_00,
    name = feature$properties$SA22023_V1_00_NAME,
    land_area_sq_km = as.numeric(feature$properties$LAND_AREA_SQ_KM),
    polygons = polygons,
    bbox = geometry_bbox(polygons)
  )
})

# vectorised bbox prefilter keeps the 2311-area assignment tractable in plain r
bbox_matrix <- do.call(rbind, map(sa2_index, "bbox"))

assign_sa2_code <- function(lng, lat) {
  candidates <- which(
    lng >= bbox_matrix[, "xmin"] & lng <= bbox_matrix[, "xmax"] &
      lat >= bbox_matrix[, "ymin"] & lat <= bbox_matrix[, "ymax"]
  )
  for (i in candidates) {
    if (point_in_geometry(lng, lat, sa2_index[[i]]$polygons)) {
      return(sa2_index[[i]]$code)
    }
  }
  NA_character_
}

cat("Assigning", nrow(places), "places to SA2 areas...\n")
places_assigned <- places |>
  mutate(
    sa2_code = map2_chr(
      as.numeric(lng),
      as.numeric(lat),
      \(lng, lat) assign_sa2_code(lng, lat)
    )
  )

unassigned_places <- places_assigned |>
  filter(is.na(sa2_code))

if (nrow(unassigned_places) > 0) {
  warning(nrow(unassigned_places), " places were not assigned to an SA2 area.")
}

place_counts <- places_assigned |>
  filter(!is.na(sa2_code)) |>
  count(sa2_code, name = "place_count")

cat("Building religion rows...\n")
religion_wide <- extract |>
  filter(category %in% c("Total stated", "No Religion")) |>
  mutate(count = clean_count(count)) |>
  select(area_code, area_name, land_area_sq_km, year, category, count) |>
  pivot_wider(names_from = category, values_from = count) |>
  rename(population_total = `Total stated`, no_religion_count = `No Religion`)

summary_rows <- religion_wide |>
  left_join(place_counts, by = c("area_code" = "sa2_code")) |>
  mutate(
    country_code = "NZ",
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = paste0(boundary_set_id, ":", area_code),
    year = as.integer(year),
    population_total_basis = "total people with a stated religious-affiliation response",
    religious_affiliation_count = if_else(
      is.na(population_total) | is.na(no_religion_count),
      NA_integer_,
      pmax(population_total - no_religion_count, 0L)
    ),
    religious_affiliation_percent = map2_dbl(religious_affiliation_count, population_total, \(n, d) rate(n, d, 100)),
    no_religion_percent = map2_dbl(no_religion_count, population_total, \(n, d) rate(n, d, 100)),
    place_count = coalesce(place_count, 0L),
    places_per_10000_residents = map2_dbl(place_count, population_total, \(n, d) rate(n, d, 10000)),
    land_area_sq_km = round(land_area_sq_km, 2),
    place_density_per_sq_km = map2_dbl(place_count, land_area_sq_km, \(n, d) rate(n, d, 1)),
    site_snapshot_date = NA_character_,
    place_count_basis = "current committed nz_places.json snapshot",
    quality_flag = pmap_chr(
      list(population_total),
      \(denominator) {
        flags <- c("current_place_counts_repeated_across_census_years")
        if (is.na(denominator)) {
          flags <- c("suppressed_denominator", flags)
        } else if (denominator < small_denominator_floor) {
          flags <- c("rr3_small_denominator", flags)
        }
        paste(flags, collapse = ";")
      }
    )
  ) |>
  arrange(area_code, year) |>
  select(
    country_code,
    boundary_set_id,
    boundary_level,
    area_unit_id,
    area_code,
    area_name,
    year,
    population_total,
    population_total_basis,
    religious_affiliation_count,
    religious_affiliation_percent,
    no_religion_count,
    no_religion_percent,
    place_count,
    places_per_10000_residents,
    place_density_per_sq_km,
    land_area_sq_km,
    site_snapshot_date,
    place_count_basis,
    quality_flag
  )

expected_rows <- length(sa2_index) * length(census_years)
if (nrow(summary_rows) != expected_rows) {
  stop("Expected ", expected_rows, " rows (areas x years) but built ", nrow(summary_rows))
}

# cross-check national aggregates against the territorial-authority product;
# differences reflect rr3 rounding and coastline clipping, so the gate is loose
ta_summary <- read_json(ta_summary_path, simplifyVector = TRUE)
ta_totals <- as_tibble(ta_summary$rows) |>
  group_by(year) |>
  summarise(ta_population = sum(population_total, na.rm = TRUE), .groups = "drop")

sa2_totals <- summary_rows |>
  group_by(year) |>
  summarise(sa2_population = sum(population_total, na.rm = TRUE), .groups = "drop")

totals_check <- left_join(ta_totals, sa2_totals, by = "year") |>
  mutate(relative_gap = abs(sa2_population - ta_population) / ta_population)

print(totals_check)

if (any(totals_check$relative_gap > 0.02)) {
  stop("SA2 national totals diverge from the TA product by more than 2%.")
}

source_dataset_ids <- c(
  "statsnz-2023-census-totals-by-topic-sa2",
  "osm-nz-places-current-cleaned"
)

summary_rows$source_dataset_ids <- replicate(
  nrow(summary_rows),
  source_dataset_ids,
  simplify = FALSE
)

source_date <- function(path) {
  path_info <- file.info(path)
  if (is.na(path_info$mtime)) {
    return(NA_character_)
  }
  as.character(as.Date(path_info$mtime))
}

make_source_datasets <- function() {
  list(
    list(
      source_dataset_id = "statsnz-2023-census-totals-by-topic-sa2",
      name = manifest$name,
      provider = manifest$provider,
      url = manifest$item_url,
      service_url = manifest$service_url,
      retrieval_date = manifest$retrieval_date,
      local_path = "archive/statsnz-2023-census-totals-sa2/religion_sa2_2023.csv",
      licence = manifest$licence,
      citation = "Stats NZ 2023 Census totals by topic for individuals by SA2, accessed via the Stats NZ ArcGIS feature service.",
      access_limits = NA_character_,
      redistribution_limits = "Attribute Stats NZ and preserve source context.",
      notes = manifest$confidentiality
    ),
    list(
      source_dataset_id = "osm-nz-places-current-cleaned",
      name = "Current cleaned New Zealand places of worship",
      provider = "OpenStreetMap contributors and project cleaning pipeline",
      url = "https://www.openstreetmap.org/",
      retrieval_date = source_date(places_path),
      local_path = "apps/regions/nz/data/nz_places.json",
      licence = list(
        name = "ODbL-1.0",
        url = "https://opendatacommons.org/licenses/odbl/1-0/",
        attribution = "OpenStreetMap contributors"
      ),
      citation = "OpenStreetMap contributors, cleaned by the Places of Worship project.",
      access_limits = NA_character_,
      redistribution_limits = "Derived database subject to ODbL 1.0.",
      notes = "Current committed site snapshot; not a historical count for each census year."
    )
  )
}

make_indicators <- function() {
  shared_quality <- paste(
    "Counts are random-rounded to base 3 by Stats NZ; cells below the",
    "confidentiality threshold arrive suppressed. Rows with a stated-response",
    "denominator under", small_denominator_floor, "carry the rr3_small_denominator flag",
    "and should be washed out rather than read as precise."
  )
  list(
    list(
      indicator_id = "population_total",
      label = "Religion-response denominator",
      description = "People with a stated religious-affiliation response in the area and census year.",
      unit = "count",
      denominator_indicator_id = NA_character_,
      method = "Read from the Total stated field of the SA2 census extract.",
      temporal_coverage = "2013, 2018, 2023",
      spatial_coverage = "New Zealand statistical area 2, 2023 boundary set",
      quality_notes = paste(
        "2013 and 2018 counts were re-aggregated by Stats NZ onto 2023 SA2 boundaries.",
        shared_quality
      )
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious affiliation",
      description = "Share of people with a stated religion response who reported a religious affiliation.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "Calculated as 100 * (Total stated - No religion) / Total stated.",
      temporal_coverage = "2013, 2018, 2023",
      spatial_coverage = "New Zealand statistical area 2, 2023 boundary set",
      quality_notes = shared_quality
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "No religion",
      description = "Share of people with a stated religion response who reported no religion.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "Calculated as 100 * No religion / Total stated.",
      temporal_coverage = "2013, 2018, 2023",
      spatial_coverage = "New Zealand statistical area 2, 2023 boundary set",
      quality_notes = shared_quality
    ),
    list(
      indicator_id = "place_count",
      label = "Places of worship",
      description = "Number of current committed places of worship assigned to the area.",
      unit = "count",
      denominator_indicator_id = NA_character_,
      method = paste(
        "Point-in-polygon assignment from current cleaned site coordinates to the",
        "committed generalised 2023 SA2 boundaries (about 40 m tolerance), so a",
        "place within that distance of a boundary may sit in the neighbouring area."
      ),
      temporal_coverage = "current committed place snapshot",
      spatial_coverage = "New Zealand statistical area 2, 2023 boundary set",
      quality_notes = "Current place counts are repeated across census years and should not be interpreted as historical counts."
    ),
    list(
      indicator_id = "places_per_10000_residents",
      label = "Places per 10,000 residents",
      description = "Current places of worship per 10,000 people in the religion-response denominator.",
      unit = "places_per_10000_residents",
      denominator_indicator_id = "population_total",
      method = "Calculated as 10000 * current place count / Total stated.",
      temporal_coverage = "current places with 2013, 2018, and 2023 denominators",
      spatial_coverage = "New Zealand statistical area 2, 2023 boundary set",
      quality_notes = paste("Combines current site counts with census-year denominators.", shared_quality)
    ),
    list(
      indicator_id = "place_density_per_sq_km",
      label = "Place density",
      description = "Current places of worship per square kilometre of land area.",
      unit = "places_per_sq_km",
      denominator_indicator_id = NA_character_,
      method = "Calculated as current place count / LAND_AREA_SQ_KM from the Stats NZ feature service.",
      temporal_coverage = "current committed place snapshot",
      spatial_coverage = "New Zealand statistical area 2, 2023 boundary set",
      quality_notes = "Uses Stats NZ official land area; oceanic SA2 units are not part of the coastline-clipped layer."
    )
  )
}

make_visual_layers <- function() {
  list(
    list(
      visual_layer_id = "nz-sa2-religious-affiliation-percent",
      label = "Religious affiliation %",
      description = "SA2 choropleth of religious-affiliation percentage.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "Total stated religion response"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "precomputed by SA2 and census year",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = "Wash out rows flagged rr3_small_denominator or suppressed_denominator."
    ),
    list(
      visual_layer_id = "nz-sa2-no-religion-percent",
      label = "No religion %",
      description = "SA2 choropleth of no-religion percentage.",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "Total stated religion response"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "precomputed by SA2 and census year",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = "Wash out rows flagged rr3_small_denominator or suppressed_denominator."
    ),
    list(
      visual_layer_id = "nz-sa2-places-per-10000-residents",
      label = "Places per 10,000 residents",
      description = "Current places of worship per 10,000 people in the religion-response denominator.",
      layer_type = "choropleth",
      indicator_ids = list("places_per_10000_residents"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "places per 10,000 residents", denominator = "Total stated religion response"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "current place count divided by census-year denominator",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = "Use with caution because current place counts are repeated across census years."
    ),
    list(
      visual_layer_id = "nz-sa2-place-density-per-sq-km",
      label = "Place density",
      description = "Current places of worship per square kilometre.",
      layer_type = "choropleth",
      indicator_ids = list("place_density_per_sq_km"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "places per sq km", denominator = "land area"),
      colour_scale = "sequential",
      time_control = "none",
      aggregation_rule = "current place count divided by land area",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = NA_character_
    )
  )
}

row_fields <- c(
  "country_code",
  "boundary_set_id",
  "boundary_level",
  "area_unit_id",
  "area_code",
  "area_name",
  "year",
  "population_total",
  "population_total_basis",
  "religious_affiliation_count",
  "religious_affiliation_percent",
  "no_religion_count",
  "no_religion_percent",
  "place_count",
  "places_per_10000_residents",
  "place_density_per_sq_km",
  "land_area_sq_km",
  "site_snapshot_date",
  "place_count_basis",
  "source_dataset_ids",
  "quality_flag"
)

json_rows <- pmap(summary_rows[, row_fields], list)

area_summary <- list(
  schema_version = "0.1.0",
  generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
  generated_by = "scripts/build_nz_area_summary_sa2.R",
  country_code = "NZ",
  boundary_set = list(
    boundary_set_id = boundary_set_id,
    country_code = "NZ",
    level = boundary_level,
    vintage = "2023",
    source_dataset_id = "statsnz-2023-census-totals-by-topic-sa2"
  ),
  site_snapshot = list(
    source_dataset_id = "osm-nz-places-current-cleaned",
    snapshot_date = NA_character_,
    basis = "current committed cleaned New Zealand places of worship",
    notes = paste0(
      nrow(places_assigned) - nrow(unassigned_places),
      " assigned places; ",
      nrow(unassigned_places),
      " unassigned places."
    )
  ),
  source_datasets = make_source_datasets(),
  indicators = make_indicators(),
  visual_layers = make_visual_layers(),
  rows = json_rows
)

csv_rows <- summary_rows |>
  mutate(source_dataset_ids = map_chr(source_dataset_ids, paste, collapse = ";")) |>
  select(all_of(row_fields))

cat("Writing area summary JSON to:", json_output_path, "\n")
write_json(area_summary, json_output_path, pretty = TRUE, auto_unbox = TRUE, na = "null")

cat("Writing area summary CSV to:", csv_output_path, "\n")
write.csv(csv_rows, csv_output_path, row.names = FALSE, na = "")

flag_summary <- summary_rows |>
  count(quality_flag)
print(flag_summary)

cat("✓ Wrote", nrow(summary_rows), "area-year rows for", length(sa2_index), "SA2 areas\n")
cat("✓ Assigned", nrow(places_assigned) - nrow(unassigned_places), "places;", nrow(unassigned_places), "unassigned\n")
