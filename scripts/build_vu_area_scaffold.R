# language: R
# purpose: scaffold the Vanuatu census geographies parallel to the NZ
#   products. Vanuatu province (ADM1) and area-council (ADM2) boundaries
#   come from geoBoundaries; per-area religious-affiliation counts are NOT
#   yet available as an internet-accessible structured source (the 2020 VNSO
#   census religion tables are PDF-only), so the area summaries are built as
#   data-pending skeletons: real areas and census years, null religion
#   values, ready to receive counts without any schema change.
# input: geoBoundaries gbOpen VUT ADM1 + ADM2 (downloaded at run time)
# output: apps/regions/vu/data/adm1_2020.geojson, adm2_2020.geojson
# output: apps/regions/vu/data/area_summary_adm1.json (+ adm2), with csvs
# output: archive/geoboundaries-vut/boundaries_manifest.json

suppressPackageStartupMessages({
  library(jsonlite)
  library(purrr)
})

repo_root <- normalizePath(
  if (basename(getwd()) == "scripts") ".." else ".",
  mustWork = TRUE
)

data_dir <- file.path(repo_root, "apps/regions/vu/data")
archive_dir <- file.path(repo_root, "archive/geoboundaries-vut")
dir.create(data_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(archive_dir, recursive = TRUE, showWarnings = FALSE)

# the geoBoundaries release pinned for reproducibility
gb_commit <- "9469f09"
census_years <- c(2009L, 2020L) # vanuatu full-census years carrying religion

levels <- list(
  adm1 = list(
    gb_type = "ADM1",
    boundary_level = "province",
    boundary_set_id = "vu-adm1-geoboundaries",
    licence = list(name = "ODbL-1.0", url = "https://opendatacommons.org/licenses/odbl/1-0/", attribution = "geoBoundaries (William & Mary geoLab)"),
    out_geojson = "adm1_2020.geojson",
    out_summary = "area_summary_adm1.json",
    out_csv = "area_summary_adm1.csv"
  ),
  adm2 = list(
    gb_type = "ADM2",
    boundary_level = "area_council",
    boundary_set_id = "vu-adm2-geoboundaries",
    licence = list(name = "CC-BY-3.0-IGO", url = "https://creativecommons.org/licenses/by/3.0/igo/", attribution = "geoBoundaries (William & Mary geoLab)"),
    out_geojson = "adm2_2020.geojson",
    out_summary = "area_summary_adm2.json",
    out_csv = "area_summary_adm2.csv"
  )
)

gb_url <- function(gb_type) {
  sprintf(
    "https://github.com/wmgeolab/geoBoundaries/raw/%s/releaseData/gbOpen/VUT/%s/geoBoundaries-VUT-%s_simplified.geojson",
    gb_commit, gb_type, gb_type
  )
}

# a stable, readable code: prefer the iso subdivision (adm1 only) and fall
# back to the geoBoundaries shape id, which is unique per feature
area_code_of <- function(props) {
  iso <- props$shapeISO
  if (!is.null(iso) && nzchar(iso)) return(iso)
  props$shapeID
}

# tidy the province display names ("Shefa Province" -> "Shefa")
clean_name <- function(name) {
  trimws(sub("\\s+Province$", "", name))
}

retrieved_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
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

  # data-pending skeleton: one row per area-year, religion fields null. the
  # schema matches the NZ area-summary product so the same map module reads it
  rows <- list()
  for (area in areas) {
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
        place_count = NA_integer_,
        places_per_10000_residents = NA_real_,
        place_density_per_sq_km = NA_real_,
        land_area_sq_km = NA_real_,
        site_snapshot_date = NA_character_,
        place_count_basis = NA_character_,
        source_dataset_ids = list(cfg$boundary_set_id),
        quality_flag = "boundaries_only_awaiting_census_religion"
      )
    }
  }

  summary <- list(
    schema_version = "0.1.0",
    generated_at = retrieved_at,
    generated_by = "scripts/build_vu_area_scaffold.R",
    country_code = "VU",
    data_status = "boundaries_only",
    data_status_note = paste(
      "Vanuatu province and area-council boundaries are in place; per-area",
      "religious-affiliation counts await a structured source. The 2020 VNSO",
      "census reports religion nationally (Presbyterian 27.2%, SDA 14.8%,",
      "Catholic 12.1%, Anglican 12.0%, others 20.3%) but the provincial tables",
      "are PDF-only. Drop counts into these rows to light up the choropleth."
    ),
    boundary_set = list(
      boundary_set_id = cfg$boundary_set_id,
      country_code = "VU",
      level = cfg$boundary_level,
      vintage = "geoBoundaries gbOpen",
      source_dataset_id = cfg$boundary_set_id
    ),
    source_datasets = list(list(
      source_dataset_id = cfg$boundary_set_id,
      name = paste("geoBoundaries gbOpen VUT", cfg$gb_type),
      provider = "geoBoundaries (William & Mary geoLab)",
      url = gb_url(cfg$gb_type),
      retrieval_date = retrieved_at,
      licence = cfg$licence,
      citation = "Runfola et al. (2020) geoBoundaries: A global database of political administrative boundaries.",
      notes = paste("Simplified release", gb_commit, "re-tagged to the project area schema.")
    )),
    indicators = list(),
    visual_layers = list(),
    rows = rows
  )

  summary_path <- file.path(data_dir, cfg$out_summary)
  cat("  writing", cfg$out_summary, "(", length(rows), "area-year rows, religion pending )\n")
  write_json(summary, summary_path, pretty = TRUE, auto_unbox = TRUE, na = "null")

  # flat csv mirror for inspection
  csv_df <- data.frame(
    area_code = map_chr(areas, "code"),
    area_name = map_chr(areas, "name"),
    stringsAsFactors = FALSE
  )
  write.csv(csv_df, file.path(data_dir, cfg$out_csv), row.names = FALSE)

  manifest_levels[[key]] <- list(
    level = cfg$boundary_level,
    boundary_set_id = cfg$boundary_set_id,
    source_url = gb_url(cfg$gb_type),
    licence = cfg$licence,
    area_count = length(areas)
  )
}

manifest <- list(
  source = "geoBoundaries gbOpen, VUT",
  geoboundaries_commit = gb_commit,
  retrieval_date = retrieved_at,
  census_years = census_years,
  data_status = "boundaries_only",
  levels = manifest_levels
)
write_json(manifest, file.path(archive_dir, "boundaries_manifest.json"), pretty = TRUE, auto_unbox = TRUE)

cat("✓ Vanuatu boundary scaffold built (provinces + area councils)\n")
cat("✓ Religion values are null pending a structured VNSO source\n")
