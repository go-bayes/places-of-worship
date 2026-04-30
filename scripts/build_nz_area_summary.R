# language: R
# purpose: build the first NZ territorial-authority area-summary product
# output: apps/regions/nz/data/area_summary_ta.json
# output: apps/regions/nz/data/area_summary_ta.csv

suppressPackageStartupMessages({
  library(dplyr)
  library(jsonlite)
  library(purrr)
})

repo_root <- normalizePath(
  if (basename(getwd()) == "scripts") ".." else ".",
  mustWork = TRUE
)

data_dir <- file.path(repo_root, "apps/regions/nz/data")
places_path <- file.path(data_dir, "nz_places.json")
boundary_path <- file.path(data_dir, "territorial_authorities.geojson")
religion_path <- file.path(data_dir, "ta_aggregated_data.json")
json_output_path <- file.path(data_dir, "area_summary_ta.json")
csv_output_path <- file.path(data_dir, "area_summary_ta.csv")

boundary_set_id <- "nz-ta-2025"
boundary_level <- "territorial_authority"
census_years <- c(2013L, 2018L, 2023L)

`%||%` <- function(x, y) {
  if (is.null(x) || length(x) == 0) y else x
}

as_count <- function(x) {
  if (is.null(x) || length(x) == 0 || is.na(x)) {
    return(NA_integer_)
  }
  as.integer(round(as.numeric(x)))
}

rate <- function(numerator, denominator, multiplier = 1, digits = 2) {
  if (is.na(numerator) || is.na(denominator) || denominator <= 0) {
    return(NA_real_)
  }
  round((numerator / denominator) * multiplier, digits)
}

source_date <- function(path) {
  path_info <- file.info(path)
  if (is.na(path_info$mtime)) {
    return(NA_character_)
  }
  as.character(as.Date(path_info$mtime))
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

  list(
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

load_ta_index <- function(path) {
  boundaries <- read_json(path, simplifyVector = FALSE)

  map(boundaries$features, \(feature) {
    polygons <- geometry_to_polygons(feature$geometry)

    list(
      code = feature$properties$TA2025_V1,
      name = feature$properties$TA2025_NAME,
      land_area_sq_km = as.numeric(feature$properties$LAND_AREA),
      polygons = polygons,
      bbox = geometry_bbox(polygons)
    )
  })
}

assign_ta_code <- function(lng, lat, ta_index) {
  for (ta in ta_index) {
    bbox <- ta$bbox
    in_bbox <- lng >= bbox$xmin && lng <= bbox$xmax && lat >= bbox$ymin && lat <= bbox$ymax

    if (in_bbox && point_in_geometry(lng, lat, ta$polygons)) {
      return(ta$code)
    }
  }

  NA_character_
}

build_religion_rows <- function(religion_data) {
  map_dfr(names(religion_data), \(ta_code) {
    ta_entry <- religion_data[[ta_code]]

    map_dfr(census_years, \(year) {
      year_data <- ta_entry[[as.character(year)]]
      population_total <- as_count(year_data[["Total stated"]] %||% year_data[["Total"]])
      no_religion_count <- as_count(year_data[["No religion"]])
      religious_affiliation_count <- if (
        is.na(population_total) || is.na(no_religion_count)
      ) {
        NA_integer_
      } else {
        max(population_total - no_religion_count, 0L)
      }

      tibble(
        area_code = ta_code,
        year = as.integer(year),
        population_total = population_total,
        population_total_basis = "total people with a stated religious-affiliation response",
        religious_affiliation_count = religious_affiliation_count,
        religious_affiliation_percent = rate(religious_affiliation_count, population_total, 100),
        no_religion_count = no_religion_count,
        no_religion_percent = rate(no_religion_count, population_total, 100)
      )
    })
  })
}

make_source_datasets <- function() {
  list(
    list(
      source_dataset_id = "statsnz-figure-nz-religion-ta-2013-2023",
      name = "Religious affiliation by territorial authority, 2013, 2018, and 2023",
      provider = "Stats NZ via Figure.NZ",
      url = "https://figure.nz/table/ITPm3h6kNu9LqEZt",
      retrieval_date = source_date(religion_path),
      local_path = "apps/regions/nz/data/ta_aggregated_data.json",
      licence = list(
        name = "CC BY 4.0",
        url = "https://creativecommons.org/licenses/by/4.0/",
        attribution = "Stats NZ"
      ),
      citation = "Stats NZ religious-affiliation census data, accessed via Figure.NZ.",
      access_limits = NA_character_,
      redistribution_limits = "Attribute Stats NZ and preserve source context.",
      notes = "Used as the first reproducible bridge while direct Stats NZ API extraction is being planned."
    ),
    list(
      source_dataset_id = "statsnz-ta-boundaries-2025",
      name = "Territorial Authority 2025 boundaries",
      provider = "Stats NZ",
      url = NA_character_,
      retrieval_date = source_date(boundary_path),
      local_path = "apps/regions/nz/data/territorial_authorities.geojson",
      licence = list(
        name = "CC BY 4.0",
        url = "https://creativecommons.org/licenses/by/4.0/",
        attribution = "Stats NZ"
      ),
      citation = "Stats NZ territorial authority boundary layer, 2025 vintage.",
      access_limits = NA_character_,
      redistribution_limits = "Attribute Stats NZ and preserve source context.",
      notes = "LAND_AREA is used for place-density calculations."
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
  list(
    list(
      indicator_id = "population_total",
      label = "Religion-response denominator",
      description = "People with a stated religious-affiliation response in the area and census year.",
      unit = "count",
      denominator_indicator_id = NA_character_,
      method = "Read from the Total stated field in the territorial-authority religion extract.",
      temporal_coverage = "2013, 2018, 2023",
      spatial_coverage = "New Zealand territorial authorities, 2025 boundary set",
      quality_notes = "This is the religion-response denominator, not necessarily the full usually resident population."
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious affiliation",
      description = "Share of people with a stated religion response who reported a religious affiliation.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "Calculated as 100 * (Total stated - No religion) / Total stated.",
      temporal_coverage = "2013, 2018, 2023",
      spatial_coverage = "New Zealand territorial authorities, 2025 boundary set",
      quality_notes = "Uses fixed 2025 territorial authority boundaries after source alignment."
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "No religion",
      description = "Share of people with a stated religion response who reported no religion.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "Calculated as 100 * No religion / Total stated.",
      temporal_coverage = "2013, 2018, 2023",
      spatial_coverage = "New Zealand territorial authorities, 2025 boundary set",
      quality_notes = "Uses fixed 2025 territorial authority boundaries after source alignment."
    ),
    list(
      indicator_id = "place_count",
      label = "Places of worship",
      description = "Number of current committed places of worship assigned to the area.",
      unit = "count",
      denominator_indicator_id = NA_character_,
      method = "Point-in-polygon assignment from current cleaned site coordinates to 2025 territorial authority boundaries.",
      temporal_coverage = "current committed place snapshot",
      spatial_coverage = "New Zealand territorial authorities, 2025 boundary set",
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
      spatial_coverage = "New Zealand territorial authorities, 2025 boundary set",
      quality_notes = "Combines current site counts with census-year denominators."
    ),
    list(
      indicator_id = "place_density_per_sq_km",
      label = "Place density",
      description = "Current places of worship per square kilometre of land area.",
      unit = "places_per_sq_km",
      denominator_indicator_id = NA_character_,
      method = "Calculated as current place count / territorial authority LAND_AREA.",
      temporal_coverage = "current committed place snapshot",
      spatial_coverage = "New Zealand territorial authorities, 2025 boundary set",
      quality_notes = "Uses Stats NZ LAND_AREA from the boundary source."
    )
  )
}

make_visual_layers <- function() {
  list(
    list(
      visual_layer_id = "nz-ta-religious-affiliation-percent",
      label = "Religious affiliation %",
      description = "Territorial-authority choropleth of religious-affiliation percentage.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "Total stated religion response"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "precomputed by territorial authority and census year",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = NA_character_
    ),
    list(
      visual_layer_id = "nz-ta-no-religion-percent",
      label = "No religion %",
      description = "Territorial-authority choropleth of no-religion percentage.",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "Total stated religion response"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "precomputed by territorial authority and census year",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = NA_character_
    ),
    list(
      visual_layer_id = "nz-ta-places-per-10000-residents",
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
      visual_layer_id = "nz-ta-place-density-per-sq-km",
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

cat("Loading NZ place, boundary, and religion inputs...\n")
places <- read_json(places_path, simplifyVector = TRUE)
religion_data <- read_json(religion_path, simplifyVector = FALSE)
ta_index <- load_ta_index(boundary_path)

if (!all(c("lat", "lng") %in% names(places))) {
  stop("Expected lat and lng fields in ", places_path)
}

cat("Assigning places to territorial authorities...\n")
places_assigned <- places |>
  mutate(
    ta_code = map2_chr(
      as.numeric(lng),
      as.numeric(lat),
      \(lng, lat) assign_ta_code(lng, lat, ta_index)
    )
  )

unassigned_places <- places_assigned |>
  filter(is.na(ta_code))

if (nrow(unassigned_places) > 0) {
  warning(nrow(unassigned_places), " places were not assigned to a territorial authority.")
}

place_counts <- places_assigned |>
  filter(!is.na(ta_code)) |>
  count(ta_code, name = "place_count")

ta_lookup <- map_dfr(ta_index, \(ta) {
  tibble(
    area_code = ta$code,
    area_name = ta$name,
    land_area_sq_km = round(ta$land_area_sq_km, 2)
  )
})

source_dataset_ids <- c(
  "statsnz-figure-nz-religion-ta-2013-2023",
  "statsnz-ta-boundaries-2025",
  "osm-nz-places-current-cleaned"
)

summary_rows <- build_religion_rows(religion_data) |>
  left_join(ta_lookup, by = "area_code") |>
  left_join(place_counts, by = c("area_code" = "ta_code")) |>
  mutate(
    country_code = "NZ",
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = paste0(boundary_set_id, ":", area_code),
    place_count = coalesce(place_count, 0L),
    places_per_10000_residents = map2_dbl(place_count, population_total, \(n, d) rate(n, d, 10000)),
    place_density_per_sq_km = map2_dbl(place_count, land_area_sq_km, \(n, d) rate(n, d, 1)),
    site_snapshot_date = NA_character_,
    place_count_basis = "current committed nz_places.json snapshot",
    quality_flag = "current_place_counts_repeated_across_census_years"
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

if (any(is.na(summary_rows$area_name))) {
  missing_codes <- summary_rows |>
    filter(is.na(area_name)) |>
    distinct(area_code) |>
    pull(area_code)
  stop("Missing boundary metadata for TA codes: ", paste(missing_codes, collapse = ", "))
}

summary_rows$source_dataset_ids <- replicate(
  nrow(summary_rows),
  source_dataset_ids,
  simplify = FALSE
)

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
  generated_by = "scripts/build_nz_area_summary.R",
  country_code = "NZ",
  boundary_set = list(
    boundary_set_id = boundary_set_id,
    country_code = "NZ",
    level = boundary_level,
    vintage = "2025",
    source_dataset_id = "statsnz-ta-boundaries-2025"
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

cat("✓ Wrote", nrow(summary_rows), "area-year rows\n")
cat("✓ Assigned", nrow(places_assigned) - nrow(unassigned_places), "places to TAs\n")
cat("✓ Unassigned places:", nrow(unassigned_places), "\n")
