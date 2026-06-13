# language: R
# purpose: fetch religious-affiliation counts (2013, 2018, 2023) and
#   generalised SA2 2023 boundaries from the Stats NZ "2023 Census totals
#   by topic for individuals by SA2" feature service (CC BY 4.0)
# output: archive/statsnz-2023-census-totals-sa2/religion_sa2_2023.csv (long extract)
# output: archive/statsnz-2023-census-totals-sa2/religion_sa2_2023_manifest.json (provenance record)
# output: apps/regions/nz/data/sa2_2023.geojson (generalised boundaries for the web map)

suppressPackageStartupMessages({
  library(jsonlite)
  library(purrr)
})

repo_root <- normalizePath(
  if (basename(getwd()) == "scripts") ".." else ".",
  mustWork = TRUE
)

service_url <- "https://services2.arcgis.com/vKb0s8tBIA3bdocZ/arcgis/rest/services/2023_Census_totals_by_topic_for_individuals_by_SA2/FeatureServer/0/query"
item_url <- "https://www.arcgis.com/home/item.html?id=29a82d5a0ea24a3880219bcb3df126dc"

archive_dir <- file.path(repo_root, "archive/statsnz-2023-census-totals-sa2")
data_dir <- file.path(repo_root, "apps/regions/nz/data")
dir.create(archive_dir, recursive = TRUE, showWarnings = FALSE)

# religion variable blocks in the service schema: one set of categories per
# census year, each ending in Total and Total stated. the alias text on each
# field is the authoritative label; we re-derive labels from aliases rather
# than trusting these offsets blindly.
religion_field_ids <- sprintf("VAR_1_%d", 377:415)
id_fields <- c("SA22023_V1_00", "SA22023_V1_00_NAME", "LAND_AREA_SQ_KM")

fetch_json <- function(url) {
  fromJSON(url, simplifyVector = TRUE)
}

encode_params <- function(params) {
  paste(
    map_chr(names(params), \(k) paste0(k, "=", URLencode(as.character(params[[k]]), reserved = TRUE))),
    collapse = "&"
  )
}

# layer metadata: field aliases carry the year and category for each VAR id
layer_meta <- fetch_json(paste0(dirname(service_url), "?f=json"))
field_alias <- setNames(layer_meta$fields$alias, layer_meta$fields$name)

parse_alias <- function(alias) {
  year <- regmatches(alias, regexpr("Year: \\d{4}", alias))
  category <- regmatches(alias, regexpr("Religious affiliation \\(.+\\)$", alias))
  list(
    year = as.integer(sub("Year: ", "", year)),
    category = sub("\\)$", "", sub("Religious affiliation \\(", "", category))
  )
}

# page through the attribute query; the service caps each page at 2000 rows
fetch_attribute_pages <- function() {
  out_fields <- paste(c(id_fields, religion_field_ids), collapse = ",")
  offset <- 0
  pages <- list()
  repeat {
    params <- list(
      where = "1=1",
      outFields = out_fields,
      returnGeometry = "false",
      f = "json",
      resultOffset = offset,
      resultRecordCount = 2000,
      orderByFields = "SA22023_V1_00"
    )
    page <- fetch_json(paste0(service_url, "?", encode_params(params)))
    if (!is.null(page$error)) {
      stop("Attribute query failed at offset ", offset, ": ", toJSON(page$error, auto_unbox = TRUE))
    }
    rows <- page$features$attributes
    if (is.null(rows) || nrow(rows) == 0) break
    pages[[length(pages) + 1]] <- rows
    offset <- offset + nrow(rows)
    if (is.null(page$exceededTransferLimit) || !isTRUE(page$exceededTransferLimit)) break
  }
  do.call(rbind, pages)
}

# page through the geometry query with server-side generalisation so the
# committed boundary file stays web-sized; precision 5 ~ 1 m at nz latitudes
fetch_geometry_pages <- function() {
  offset <- 0
  features <- list()
  repeat {
    params <- list(
      where = "1=1",
      outFields = paste(id_fields, collapse = ","),
      returnGeometry = "true",
      maxAllowableOffset = 0.0004,
      geometryPrecision = 5,
      outSR = 4326,
      f = "geojson",
      resultOffset = offset,
      resultRecordCount = 2000,
      orderByFields = "SA22023_V1_00"
    )
    page <- fetch_json(paste0(service_url, "?", encode_params(params)))
    if (!is.null(page$error)) {
      stop("Geometry query failed at offset ", offset, ": ", toJSON(page$error, auto_unbox = TRUE))
    }
    # keep features as raw lists so geometry survives untouched
    page_raw <- fromJSON(
      paste0(service_url, "?", encode_params(params)),
      simplifyVector = FALSE
    )
    n <- length(page_raw$features)
    if (n == 0) break
    features <- c(features, page_raw$features)
    offset <- offset + n
    if (is.null(page$properties$exceededTransferLimit) &&
        (is.null(page_raw$exceededTransferLimit) || !isTRUE(page_raw$exceededTransferLimit)) &&
        n < 2000) {
      break
    }
  }
  features
}

cat("Fetching SA2 2023 religion attributes...\n")
attributes <- fetch_attribute_pages()
cat("  rows:", nrow(attributes), "\n")

cat("Fetching generalised SA2 2023 boundaries...\n")
features <- fetch_geometry_pages()
cat("  features:", length(features), "\n")

if (nrow(attributes) != length(features)) {
  stop("Row mismatch: ", nrow(attributes), " attribute rows vs ", length(features), " boundary features")
}

# reshape the wide VAR columns into long rows keyed by area, year, category
cat("Reshaping religion counts...\n")
long_rows <- map_dfr(religion_field_ids, \(field) {
  meta <- parse_alias(field_alias[[field]])
  data.frame(
    area_code = attributes$SA22023_V1_00,
    area_name = attributes$SA22023_V1_00_NAME,
    land_area_sq_km = attributes$LAND_AREA_SQ_KM,
    year = meta$year,
    category = meta$category,
    count = attributes[[field]],
    stringsAsFactors = FALSE
  )
})

retrieved_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")

manifest <- list(
  source_dataset_id = "statsnz-2023-census-totals-by-topic-sa2",
  name = "2023 Census totals by topic for individuals by SA2 (part 1, clipped to coastline)",
  provider = "Stats NZ Tatauranga Aotearoa",
  service_url = service_url,
  item_url = item_url,
  retrieval_date = retrieved_at,
  licence = list(
    name = "CC BY 4.0",
    url = "https://creativecommons.org/licenses/by/4.0/",
    attribution = "Stats NZ"
  ),
  row_count = nrow(long_rows),
  area_count = length(unique(long_rows$area_code)),
  years = sort(unique(long_rows$year)),
  confidentiality = paste(
    "Counts are subject to Stats NZ confidentiality rules: random rounding",
    "to base 3, with -999 marking suppressed cells."
  ),
  notes = paste(
    "Religious affiliation counts for the census usually resident population,",
    "censuses 2013, 2018, and 2023, on 2023 SA2 boundaries (Stats NZ concordance).",
    "Field ids VAR_1_377-415; labels taken from field aliases."
  )
)

manifest_path <- file.path(archive_dir, "religion_sa2_2023_manifest.json")
cat("Writing provenance manifest to:", manifest_path, "\n")
write_json(manifest, manifest_path, pretty = TRUE, auto_unbox = TRUE, na = "null")

extract_path <- file.path(archive_dir, "religion_sa2_2023.csv")
cat("Writing long extract to:", extract_path, "\n")
write.csv(long_rows, extract_path, row.names = FALSE, na = "")

geojson <- list(
  type = "FeatureCollection",
  features = features
)
geojson_path <- file.path(data_dir, "sa2_2023.geojson")
cat("Writing generalised boundaries to:", geojson_path, "\n")
write_json(geojson, geojson_path, auto_unbox = TRUE, na = "null", digits = 8)

cat("✓ Fetched", nrow(attributes), "areas x", length(religion_field_ids), "fields\n")
cat("✓ Years:", paste(sort(unique(long_rows$year)), collapse = ", "), "\n")
cat("✓ Categories:", length(unique(long_rows$category)), "\n")
