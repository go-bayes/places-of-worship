# language: R
# purpose: build the Vanuatu province (ADM1) and area-council (ADM2)
#   area-summary products. Boundaries come from geoBoundaries. Per-area
#   religious-affiliation counts are NOT yet available as a structured source
#   (the 2020 VNSO census religion tables are PDF-only), so religion fields
#   stay null. What IS computable today is place-of-worship DENSITY: OSM
#   place_of_worship points per square kilometre of land area. That gives the
#   map a real choropleth to show while religion remains pending.
# input: geoBoundaries gbOpen VUT ADM1 + ADM2 (downloaded at run time)
# input: OpenStreetMap amenity=place_of_worship in Vanuatu (Overpass)
# output: apps/regions/vu/data/adm1_2020.geojson, adm2_2020.geojson
# output: apps/regions/vu/data/area_summary_adm1.json (+ adm2), with csvs
# output: archive/geoboundaries-vut/boundaries_manifest.json
# output: archive/osm-vu-pow/pow_vu.json (+ manifest)

suppressPackageStartupMessages({
  library(jsonlite)
  library(purrr)
  library(sf)
  library(tibble)
})
sf_use_s2(TRUE) # geodesic area and point-in-polygon on lat/lng

repo_root <- normalizePath(
  if (basename(getwd()) == "scripts") ".." else ".",
  mustWork = TRUE
)

data_dir <- file.path(repo_root, "apps/regions/vu/data")
gb_archive_dir <- file.path(repo_root, "archive/geoboundaries-vut")
osm_archive_dir <- file.path(repo_root, "archive/osm-vu-pow")
dir.create(data_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(gb_archive_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(osm_archive_dir, recursive = TRUE, showWarnings = FALSE)

gb_commit <- "9469f09" # geoBoundaries release pinned for reproducibility
census_years <- c(2009L, 2020L) # vanuatu full-census years carrying religion

`%||%` <- function(x, y) if (is.null(x)) y else x

retrieved_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")

# ── OSM places of worship via Overpass ────────────────────────────────────
# counts whatever OSM tags amenity=place_of_worship in Vanuatu; in this
# country that includes some nakamals (kava meeting houses) alongside
# churches, so the metric is "places of worship" as OSM records them
osm_path <- file.path(osm_archive_dir, "pow_vu.json")
overpass_url <- "https://overpass-api.de/api/interpreter"
overpass_query <- paste0(
  '[out:json][timeout:90];area["ISO3166-1"="VU"]->.a;',
  '(node["amenity"="place_of_worship"](area.a);',
  'way["amenity"="place_of_worship"](area.a);',
  'relation["amenity"="place_of_worship"](area.a););out tags center;'
)
user_agent <- "places-of-worship-research/1.0 (joseph.bulbulia@gmail.com)"

cat("Fetching Vanuatu places of worship from Overpass...\n")
qfile <- tempfile(fileext = ".overpassql")
writeLines(overpass_query, qfile)
# overpass blocks default curl user-agents (406); send a descriptive one.
# shQuote each value: the user-agent carries spaces and parentheses that
# would otherwise break the shell system2() runs the command through
fetch_status <- system2("curl", c(
  "-sS", "-m", "150",
  "-H", shQuote(paste0("User-Agent: ", user_agent)),
  "--data-urlencode", shQuote(paste0("data@", qfile)),
  "-o", shQuote(osm_path),
  shQuote(overpass_url)
))
if (fetch_status != 0) stop("Overpass fetch failed (curl exit ", fetch_status, ")")

pow <- read_json(osm_path, simplifyVector = FALSE)
if (is.null(pow$elements) || length(pow$elements) == 0) {
  stop("Overpass returned no place-of-worship elements for Vanuatu")
}

# nodes carry lat/lon; ways and relations carry a center from `out center`
pow_points <- map_dfr(pow$elements, function(e) {
  lat <- e$lat %||% (if (!is.null(e$center)) e$center$lat else NULL)
  lon <- e$lon %||% (if (!is.null(e$center)) e$center$lon else NULL)
  if (is.null(lat) || is.null(lon)) return(NULL)
  tibble(lng = as.numeric(lon), lat = as.numeric(lat))
})
cat("  ", nrow(pow_points), "places of worship with coordinates\n")
points_sf <- st_as_sf(pow_points, coords = c("lng", "lat"), crs = 4326)

osm_manifest <- list(
  source_dataset_id = "osm-vu-place-of-worship",
  name = "OpenStreetMap places of worship in Vanuatu",
  provider = "OpenStreetMap contributors",
  endpoint = overpass_url,
  query = overpass_query,
  retrieval_date = retrieved_at,
  feature_count = nrow(pow_points),
  licence = list(name = "ODbL-1.0", url = "https://opendatacommons.org/licenses/odbl/1-0/", attribution = "OpenStreetMap contributors"),
  notes = paste(
    "amenity=place_of_worship as recorded in OSM; in Vanuatu this includes",
    "some nakamals (kava meeting houses) alongside churches. Node/way/relation",
    "centroids used for point-in-polygon assignment."
  )
)
write_json(osm_manifest, file.path(osm_archive_dir, "pow_vu_manifest.json"), pretty = TRUE, auto_unbox = TRUE)

# ── boundary levels ───────────────────────────────────────────────────────
levels <- list(
  adm1 = list(
    gb_type = "ADM1", boundary_level = "province", boundary_set_id = "vu-adm1-geoboundaries",
    licence = list(name = "ODbL-1.0", url = "https://opendatacommons.org/licenses/odbl/1-0/", attribution = "geoBoundaries (William & Mary geoLab)"),
    out_geojson = "adm1_2020.geojson", out_summary = "area_summary_adm1.json", out_csv = "area_summary_adm1.csv"
  ),
  adm2 = list(
    gb_type = "ADM2", boundary_level = "area_council", boundary_set_id = "vu-adm2-geoboundaries",
    licence = list(name = "CC-BY-3.0-IGO", url = "https://creativecommons.org/licenses/by/3.0/igo/", attribution = "geoBoundaries (William & Mary geoLab)"),
    out_geojson = "adm2_2020.geojson", out_summary = "area_summary_adm2.json", out_csv = "area_summary_adm2.csv"
  )
)

gb_url <- function(gb_type) {
  sprintf(
    "https://github.com/wmgeolab/geoBoundaries/raw/%s/releaseData/gbOpen/VUT/%s/geoBoundaries-VUT-%s_simplified.geojson",
    gb_commit, gb_type, gb_type
  )
}

# prefer the iso subdivision (adm1 only), fall back to the unique shape id
area_code_of <- function(props) {
  iso <- props$shapeISO
  if (!is.null(iso) && nzchar(iso)) return(iso)
  props$shapeID
}
clean_name <- function(name) trimws(sub("\\s+Province$", "", name))

manifest_levels <- list()

for (key in names(levels)) {
  cfg <- levels[[key]]
  cat("Fetching VUT", cfg$gb_type, "boundaries...\n")
  fc <- read_json(gb_url(cfg$gb_type), simplifyVector = FALSE)

  # re-tag each feature to the project's area schema, keeping geometry intact
  areas <- list()
  fc$features <- map(fc$features, function(feature) {
    props <- feature$properties
    code <- area_code_of(props)
    name <- clean_name(props$shapeName)
    areas[[length(areas) + 1]] <<- list(code = code, name = name)
    feature$properties <- list(area_code = code, area_name = name, level = cfg$boundary_level)
    feature
  })

  geojson_path <- file.path(data_dir, cfg$out_geojson)
  cat("  writing", cfg$out_geojson, "(", length(fc$features), "areas )\n")
  write_json(fc, geojson_path, auto_unbox = TRUE, digits = 6, na = "null")

  # land area (geodesic) and OSM point-in-polygon counts, joined by area_code
  areas_sf <- st_make_valid(st_read(geojson_path, quiet = TRUE))
  land_km2 <- as.numeric(st_area(areas_sf)) / 1e6
  pip_counts <- lengths(st_intersects(areas_sf, points_sf))
  density_by_code <- tibble(
    area_code = areas_sf$area_code,
    land_area_sq_km = round(land_km2, 2),
    place_count = as.integer(pip_counts),
    place_density_per_sq_km = round(as.integer(pip_counts) / land_km2, 4)
  )
  cat("  assigned", sum(pip_counts), "of", nrow(pow_points), "places to", nrow(areas_sf), cfg$boundary_level, "areas\n")

  # one row per area-year. place counts are a current OSM snapshot, repeated
  # across census years (no per-year history); religion fields stay null
  rows <- list()
  for (area in areas) {
    d <- density_by_code[density_by_code$area_code == area$code, ]
    for (year in census_years) {
      rows[[length(rows) + 1]] <- list(
        country_code = "VU",
        boundary_set_id = cfg$boundary_set_id,
        boundary_level = cfg$boundary_level,
        area_unit_id = paste0(cfg$boundary_set_id, ":", area$code),
        area_code = area$code,
        area_name = area$name,
        year = year,
        population_total = NA_integer_,
        population_total_basis = "stated religious-affiliation response (pending)",
        religious_affiliation_count = NA_integer_,
        religious_affiliation_percent = NA_real_,
        no_religion_count = NA_integer_,
        no_religion_percent = NA_real_,
        place_count = d$place_count[1],
        places_per_10000_residents = NA_real_, # needs a population denominator (pending)
        place_density_per_sq_km = d$place_density_per_sq_km[1],
        land_area_sq_km = d$land_area_sq_km[1],
        site_snapshot_date = retrieved_at,
        place_count_basis = "current OSM amenity=place_of_worship snapshot",
        source_dataset_ids = list(cfg$boundary_set_id, "osm-vu-place-of-worship"),
        quality_flag = "place_density_only;current_place_counts_repeated_across_census_years;religion_pending"
      )
    }
  }

  summary <- list(
    schema_version = "0.1.0",
    generated_at = retrieved_at,
    generated_by = "scripts/build_vu_area_scaffold.R",
    country_code = "VU",
    data_status = "place_density_only",
    data_status_note = paste(
      "Place-of-worship density (OSM places per sq km) is computed and live.",
      "Per-area religious-affiliation counts await a structured source: the 2020",
      "VNSO census reports religion nationally (Presbyterian 27.2%, SDA 14.8%,",
      "Catholic 12.1%, Anglican 12.0%, others 20.3%) but the provincial tables",
      "are PDF-only. Drop counts into these rows to light up the religion metrics."
    ),
    boundary_set = list(
      boundary_set_id = cfg$boundary_set_id, country_code = "VU",
      level = cfg$boundary_level, vintage = "geoBoundaries gbOpen",
      source_dataset_id = cfg$boundary_set_id
    ),
    source_datasets = list(
      list(
        source_dataset_id = cfg$boundary_set_id,
        name = paste("geoBoundaries gbOpen VUT", cfg$gb_type),
        provider = "geoBoundaries (William & Mary geoLab)",
        url = gb_url(cfg$gb_type),
        retrieval_date = retrieved_at,
        licence = cfg$licence,
        citation = "Runfola et al. (2020) geoBoundaries: A global database of political administrative boundaries.",
        notes = paste("Simplified release", gb_commit, "re-tagged to the project area schema; land area computed geodesically from this geometry.")
      ),
      list(
        source_dataset_id = "osm-vu-place-of-worship",
        name = "OpenStreetMap places of worship in Vanuatu",
        provider = "OpenStreetMap contributors",
        url = overpass_url,
        retrieval_date = retrieved_at,
        licence = list(name = "ODbL-1.0", url = "https://opendatacommons.org/licenses/odbl/1-0/", attribution = "OpenStreetMap contributors"),
        citation = "OpenStreetMap contributors, amenity=place_of_worship, Vanuatu.",
        notes = osm_manifest$notes
      )
    ),
    indicators = list(),
    visual_layers = list(),
    rows = rows
  )

  summary_path <- file.path(data_dir, cfg$out_summary)
  cat("  writing", cfg$out_summary, "(", length(rows), "area-year rows; place density live, religion pending )\n")
  write_json(summary, summary_path, pretty = TRUE, auto_unbox = TRUE, na = "null")

  csv_df <- data.frame(
    area_code = map_chr(areas, "code"),
    area_name = map_chr(areas, "name"),
    stringsAsFactors = FALSE
  )
  csv_df <- merge(csv_df, as.data.frame(density_by_code), by = "area_code", all.x = TRUE, sort = FALSE)
  write.csv(csv_df, file.path(data_dir, cfg$out_csv), row.names = FALSE)

  manifest_levels[[key]] <- list(
    level = cfg$boundary_level, boundary_set_id = cfg$boundary_set_id,
    source_url = gb_url(cfg$gb_type), licence = cfg$licence, area_count = length(areas)
  )
}

manifest <- list(
  source = "geoBoundaries gbOpen, VUT",
  geoboundaries_commit = gb_commit,
  retrieval_date = retrieved_at,
  census_years = census_years,
  data_status = "place_density_only",
  osm_place_of_worship_count = nrow(pow_points),
  levels = manifest_levels
)
write_json(manifest, file.path(gb_archive_dir, "boundaries_manifest.json"), pretty = TRUE, auto_unbox = TRUE)

cat("✓ Vanuatu area summaries built: place density live, religion pending\n")
