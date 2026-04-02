# Global raw places of worship extraction
# Usage:
#   Rscript scripts/extract_global_data.R [snapshot_date] [country_codes_csv] [--force]
#
# Example:
#   Rscript scripts/extract_global_data.R 2026-09-01 NZ,AU --force

suppressPackageStartupMessages({
  library(osmdata)
  library(sf)
  library(dplyr)
  library(jsonlite)
  library(purrr)
  library(rnaturalearth)
})

parse_args <- function(args) {
  snapshot_date <- format(Sys.Date(), "%Y-%m-%d")
  country_codes <- NULL
  force_refresh <- FALSE

  positional <- args[!startsWith(args, "--")]
  flags <- args[startsWith(args, "--")]

  if (length(positional) >= 1) {
    snapshot_date <- positional[[1]]
  }

  if (length(positional) >= 2) {
    country_codes <- positional[[2]] |>
      strsplit(",", fixed = TRUE) |>
      unlist() |>
      trimws() |>
      toupper()
  }

  force_refresh <- any(flags %in% c("--force", "--overwrite"))

  list(
    snapshot_date = snapshot_date,
    country_codes = country_codes,
    force_refresh = force_refresh
  )
}

extract_tags <- function(data, row_index) {
  tag_columns <- setdiff(names(data), c("osm_id", "geometry"))

  tags <- purrr::keep(
    purrr::map(tag_columns, function(column_name) {
      value <- data[[column_name]][[row_index]]
      if (is.null(value) || is.na(value) || identical(value, "")) {
        return(NULL)
      }

      list(column_name = column_name, value = as.character(value))
    }),
    Negate(is.null)
  )

  if (length(tags) == 0) {
    return(list())
  }

  names(tags) <- purrr::map_chr(tags, "column_name")
  purrr::map(tags, "value")
}

build_representative_points <- function(data, source_layer) {
  if (nrow(data) == 0) {
    return(data)
  }

  if (source_layer == "osm_points") {
    return(data)
  }

  suppressWarnings(st_point_on_surface(data))
}

layer_to_osm_type <- function(source_layer) {
  dplyr::case_when(
    source_layer == "osm_points" ~ "node",
    source_layer == "osm_polygons" ~ "way",
    source_layer == "osm_multipolygons" ~ "relation",
    TRUE ~ "unknown"
  )
}

filter_to_country <- function(data, country_geometry, source_layer) {
  if (nrow(data) == 0) {
    return(data[0, ])
  }

  if (source_layer == "osm_points") {
    keep_index <- st_within(data, country_geometry, sparse = FALSE)[, 1]
  } else {
    keep_index <- st_intersects(data, country_geometry, sparse = FALSE)[, 1]
  }

  data[keep_index, ]
}

build_layer_records <- function(data, source_layer, country_geometry) {
  if (is.null(data) || nrow(data) == 0) {
    return(list())
  }

  filtered_data <- filter_to_country(data, country_geometry, source_layer)

  if (nrow(filtered_data) == 0) {
    return(list())
  }

  representative_points <- build_representative_points(filtered_data, source_layer)
  coords <- st_coordinates(representative_points)
  osm_type <- layer_to_osm_type(source_layer)

  purrr::map(seq_len(nrow(filtered_data)), function(row_index) {
    list(
      source_layer = source_layer,
      osm_type = osm_type,
      osm_id = as.character(filtered_data$osm_id[[row_index]]),
      lat = coords[row_index, 2],
      lon = coords[row_index, 1],
      tags = extract_tags(filtered_data, row_index)
    )
  })
}

extract_country <- function(country_code, country_name, country_geometry, output_dir, force_refresh) {
  output_file <- file.path(
    output_dir,
    paste0(tolower(country_code), "_places_raw.json")
  )

  if (file.exists(output_file) && !force_refresh) {
    message(sprintf("  [%s] Exists. Skipping.", country_code))
    return(list(
      country_code = country_code,
      country_name = country_name,
      output_file = output_file,
      skipped = TRUE
    ))
  }

  message(sprintf("  [%s] Fetching %s...", country_code, country_name))
  Sys.sleep(2)

  query_bbox <- st_bbox(country_geometry)

  tryCatch(
    {
      query <- opq(
        bbox = c(query_bbox[["xmin"]], query_bbox[["ymin"]], query_bbox[["xmax"]], query_bbox[["ymax"]]),
        timeout = 2400
      ) |>
        add_osm_feature(key = "amenity", value = "place_of_worship")

      osm_raw <- osmdata_sf(query)

      raw_records <- c(
        build_layer_records(osm_raw$osm_points, "osm_points", country_geometry),
        build_layer_records(osm_raw$osm_polygons, "osm_polygons", country_geometry),
        build_layer_records(osm_raw$osm_multipolygons, "osm_multipolygons", country_geometry)
      )

      payload <- list(
        snapshot_date = basename(output_dir),
        extracted_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
        source = "osm_overpass",
        script = "scripts/extract_global_data.R",
        country_code = country_code,
        country_name = country_name,
        query = list(
          feature_key = "amenity",
          feature_value = "place_of_worship",
          bbox = list(
            xmin = unname(query_bbox[["xmin"]]),
            ymin = unname(query_bbox[["ymin"]]),
            xmax = unname(query_bbox[["xmax"]]),
            ymax = unname(query_bbox[["ymax"]])
          )
        ),
        layer_counts = list(
          osm_points = sum(purrr::map_chr(raw_records, "source_layer") == "osm_points"),
          osm_polygons = sum(purrr::map_chr(raw_records, "source_layer") == "osm_polygons"),
          osm_multipolygons = sum(purrr::map_chr(raw_records, "source_layer") == "osm_multipolygons")
        ),
        record_count = length(raw_records),
        records = raw_records
      )

      write_json(payload, output_file, pretty = TRUE, auto_unbox = TRUE, null = "null")
      message(sprintf("  [%s] Success! Saved %d raw records.", country_code, length(raw_records)))

      list(
        country_code = country_code,
        country_name = country_name,
        output_file = output_file,
        skipped = FALSE,
        record_count = length(raw_records)
      )
    },
    error = function(error) {
      message(sprintf("  [%s] FAILED: %s", country_code, error$message))
      list(
        country_code = country_code,
        country_name = country_name,
        output_file = output_file,
        skipped = FALSE,
        error = error$message
      )
    }
  )
}

write_snapshot_manifest <- function(results, output_dir) {
  manifest_path <- file.path(output_dir, "snapshot_manifest.json")

  manifest <- list(
    snapshot_date = basename(output_dir),
    generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    script = "scripts/extract_global_data.R",
    countries = results
  )

  write_json(manifest, manifest_path, pretty = TRUE, auto_unbox = TRUE, null = "null")
  message(sprintf("Wrote snapshot manifest: %s", manifest_path))
}

main <- function() {
  args <- parse_args(commandArgs(trailingOnly = TRUE))

  output_dir <- file.path("data", "raw", "osm", args$snapshot_date)
  dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)

  world_map <- ne_countries(scale = "medium", returnclass = "sf")

  target_countries <- world_map |>
    filter(!is.na(iso_a2), continent != "Antarctica") |>
    transmute(code = iso_a2, name = name)

  if (!is.null(args$country_codes)) {
    target_countries <- target_countries |>
      filter(code %in% args$country_codes)
  }

  message(sprintf("Targeting %d countries/territories...", nrow(target_countries)))

  country_rows <- split(target_countries, seq_len(nrow(target_countries)))

  results <- purrr::map(
    country_rows,
    function(country_row) {
      extract_country(
        country_code = country_row$code[[1]],
        country_name = country_row$name[[1]],
        country_geometry = st_geometry(country_row),
        output_dir = output_dir,
        force_refresh = args$force_refresh
      )
    }
  )

  write_snapshot_manifest(results, output_dir)
}

main()
