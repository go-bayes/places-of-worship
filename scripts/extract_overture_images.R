# overture_and_images.R
# ==============================================================================
# r script to extract places from overture maps and enrich with user images
# implements the "all-r" stack discussed
#
# dependencies:
# install.packages(c("duckdb", "sf", "dplyr", "httr", "jsonlite", "tidywikidatar"))
# ==============================================================================

library(duckdb)
library(sf)
library(dplyr)
library(httr)
library(jsonlite)
library(tidywikidatar)

# ==============================================================================
# 1. overture maps extraction (using duckdb)
# ==============================================================================

# function to query overture s3 bucket directly from r
# uses duckdb spatial extension to filter before downloading
get_overture_places <- function(bbox) {
  # bbox format: c(xmin, ymin, xmax, ymax)

  # create ephemeral duckdb connection
  con <- dbConnect(duckdb::duckdb())
  on.exit(dbDisconnect(con, shutdown = TRUE))

  # install spatial extensions if missing
  # this only needs to run once per session
  dbExecute(con, "INSTALL spatial; LOAD spatial;")
  dbExecute(con, "INSTALL httpfs; LOAD httpfs;")

  # construct sql query
  # we filter by bbox and 'place_of_worship' category
  # we specifically select 'wikidata' to link images later
  query <- sprintf("
    SELECT
      id,
      names.primary AS name,
      categories.primary AS category,
      wikidata,
      ST_AsText(geometry) AS wkt_geom
    FROM read_parquet('s3://overturemaps-us-west-2/release/2024-04-16.0/theme=places/type=place/*')
    WHERE
      bbox.xmin > %f AND bbox.xmax < %f
      AND bbox.ymin > %f AND bbox.ymax < %f
      AND categories.primary = 'place_of_worship'
  ", bbox[1], bbox[3], bbox[2], bbox[4])

  message("querying overture s3 bucket (this may take a moment)...")
  df <- dbGetQuery(con, query)

  if (nrow(df) == 0) {
    return(NULL)
  }

  # convert to sf object
  st_as_sf(df, wkt = "wkt_geom", crs = 4326)
}

# ==============================================================================
# 2. image enrichment functions
# ==============================================================================

# option a: fetch high-quality images from wikidata
# uses the 'tidywikidatar' package cache for speed
get_wiki_image <- function(wiki_id) {
  if (is.na(wiki_id) || wiki_id == "") {
    return(NA)
  }

  # 'p18' is the wikidata property for 'image'
  img_url <- tryCatch(
    {
      tw_get_image_metadata(id = wiki_id) %>%
        slice(1) %>%
        pull(url)
    },
    error = function(e) NA
  )

  return(img_url)
}

# option b: fetch street-level images from mapillary
# requires a free api key from mapillary
get_mapillary_image <- function(lat, lon, token) {
  if (is.na(token)) {
    return(NA)
  }

  # search for images within a small radius (~50m)
  # requesting 'thumb_1024_url' for a decent resolution
  url <- "https://graph.mapillary.com/images"
  bbox_str <- sprintf("%f,%f,%f,%f", lon - 0.0005, lat - 0.0005, lon + 0.0005, lat + 0.0005)

  resp <- tryCatch(
    {
      GET(
        url,
        query = list(
          access_token = token,
          fields = "id,thumb_1024_url",
          bbox = bbox_str,
          limit = 1
        )
      )
    },
    error = function(e) NULL
  )

  if (is.null(resp) || status_code(resp) != 200) {
    return(NA)
  }

  content <- content(resp, as = "parsed")
  if (length(content$data) > 0) {
    return(content$data[[1]]$thumb_1024_url)
  }

  return(NA)
}

# ==============================================================================
# 3. main workflow
# ==============================================================================

# example: fetching churches in wellington, nz
# bounding box: xmin, ymin, xmax, ymax
wellington_bbox <- c(174.75, -41.35, 174.85, -41.25)

# 1. extract base data
places_sf <- get_overture_places(wellington_bbox)

if (!is.null(places_sf)) {
  message(sprintf("extracted %d places.", nrow(places_sf)))

  # 2. enrich with wikidata images
  # we use a loop or map here; for large datasets, use parallel processing (furrr)
  message("fetching wikidata images...")
  places_sf$image_url <- sapply(places_sf$wikidata, get_wiki_image)

  # 3. fallback to mapillary for missing images (optional)
  # mapillary_token <- "your_token_here"
  # missing_idx <- which(is.na(places_sf$image_url))
  #
  # if (length(missing_idx) > 0) {
  #   coords <- st_coordinates(places_sf)
  #   places_sf$image_url[missing_idx] <- mapply(
  #     get_mapillary_image,
  #     lat = coords[missing_idx, 2],
  #     lon = coords[missing_idx, 1],
  #     MoreArgs = list(token = mapillary_token)
  #   )
  # }

  # 4. save result
  # st_write(places_sf, "wellington_churches_with_images.geojson")
  print(head(places_sf))
} else {
  message("no places found in this region.")
}
