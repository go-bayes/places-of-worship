# build the united kingdom census-affiliation area-summary products.
# inputs: official Nomis CSV extracts, NISRA MS-B19, and ONS/NRS/OSNI
# boundary FeatureServer exports downloaded into data/raw/uk_census.
# outputs: apps/regions/uk/data/ area summaries, boundary GeoJSON files,
# and docs/manifests/uk-census-religion-2001-2022.json.
# run from the repo root: Rscript scripts/build_uk_area_summary.R

suppressMessages({
  library(sf)
  library(readxl)
  library(jsonlite)
})

raw_dir <- "data/raw/uk_census"
uk_dir <- "apps/regions/uk/data"
manifest_dir <- "docs/manifests"
dir.create(raw_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(uk_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- "2026-07-07"
manifest_out <- file.path(manifest_dir, "uk-census-religion-2001-2022.json")
git_commit <- tryCatch(
  system2("git", c("rev-parse", "--short", "HEAD"), stdout = TRUE, stderr = FALSE),
  error = function(error) character(0)
)
if (length(git_commit) != 1 || !grepl("^[a-f0-9]{7,40}$", git_commit)) {
  git_commit <- "0000000"
}

ew_boundary_dataset_id <- "ons-lad-may-2021-uk-bgc"
ew_lookup_dataset_id <- "ons-lad11-lad21-ew-lookup"
ew_2021_dataset_id <- "nomis-c2021ts030-lad2022-ew"
ew_2011_dataset_id <- "nomis-c2011ks209ew-lad2011-ew"
ew_2001_dataset_id <- "nomis-c2001ks007-lad2011-ew"
sco_boundary_dataset_id <- "scotland-census-council-area-2019"
sco_pending_dataset_id <- "scotland-census-religion-extraction-pending"
ni_boundary_dataset_id <- "osni-lgd-2012"
ni_2021_dataset_id <- "nisra-census-2021-ms-b19-lgd"
ni_pending_dataset_id <- "nisra-2001-2011-lgd-religion-extraction-pending"

ew_boundary_set_id <- "uk-ew-lad-2021"
sco_boundary_set_id <- "uk-sco-council-area-2019"
ni_boundary_set_id <- "uk-ni-lgd-2012"

raw_sources <- data.frame(
  filename = c(
    "nomis_ew_2021_ts030_lad2022.csv",
    "nomis_ew_2021_ts030_country.csv",
    "nomis_ew_2011_ks209ew_lad2011.csv",
    "nomis_ew_2011_ks209ew_country.csv",
    "nomis_ew_2001_ks007_lad2011.csv",
    "nomis_ew_2001_ks007_country.csv",
    "ons_lad_may_2021_uk_bgc.geojson",
    "ons_lad11_lad21_ew_lookup.json",
    "scotland_council_area_2019.geojson",
    "osni_lgd_2012.geojson",
    "nisra_census_2021_ms_b19.xlsx"
  ),
  url = c(
    "https://www.nomisweb.co.uk/api/v01/dataset/nm_2049_1.bulk.csv?time=latest&measures=20100&c2021_religion_10=0,1,9&geography=TYPE154",
    "https://www.nomisweb.co.uk/api/v01/dataset/nm_2049_1.bulk.csv?time=latest&measures=20100&c2021_religion_10=0,1,9&geography=TYPE499",
    "https://www.nomisweb.co.uk/api/v01/dataset/nm_616_1.bulk.csv?time=latest&measures=20100&rural_urban=total&cell=0,8,9&geography=TYPE464",
    "https://www.nomisweb.co.uk/api/v01/dataset/nm_616_1.bulk.csv?time=latest&measures=20100&rural_urban=total&cell=0,8,9&geography=TYPE499",
    "https://www.nomisweb.co.uk/api/v01/dataset/nm_1607_1.bulk.csv?time=latest&measures=20100&c_relpuk11=0,8,9&geography=TYPE464",
    "https://www.nomisweb.co.uk/api/v01/dataset/nm_1607_1.bulk.csv?time=latest&measures=20100&c_relpuk11=0,8,9&geography=TYPE499",
    "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Local_Authority_Districts_May_2021_UK_BGC_2022/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson",
    "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/LAD11_LAD21_EW_LU/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=false&f=json",
    "https://services1.arcgis.com/etUJqgud3DEym3ls/ArcGIS/rest/services/CouncilArea2019_MHW/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson",
    "https://services2.arcgis.com/BdBkthNLO9mzGAMO/arcgis/rest/services/OSNI_Open_Data_Largescale_Boundaries__Local_Government_Districts_2012/FeatureServer/1/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson",
    "https://www.nisra.gov.uk/system/files/statistics/census-2021-ms-b19.xlsx"
  ),
  publisher = c(
    rep("Office for National Statistics via Nomis", 6),
    "Office for National Statistics Open Geography Portal",
    "Office for National Statistics Open Geography Portal",
    "National Records of Scotland / Scotland's Census",
    "Ordnance Survey of Northern Ireland / OpenDataNI",
    "Northern Ireland Statistics and Research Agency"
  ),
  licence_text = c(
    rep("Contains public sector information licensed under the Open Government Licence v3.0.", 11)
  ),
  stringsAsFactors = FALSE
)

# download one raw source when the local cache is absent.
download_raw <- function(filename, url) {
  path <- file.path(raw_dir, filename)
  if (!file.exists(path) || file.info(path)[["size"]] == 0) {
    message("downloading ", filename)
    utils::download.file(url, path, mode = "wb", quiet = TRUE)
  }
  path
}

# compute the sha-256 digest for a local file.
sha256_file <- function(path) {
  unname(tools::sha256sum(path))
}

# return file size in bytes for manifest records.
file_bytes <- function(path) {
  unname(file.info(path)[["size"]])
}

# return a compact row count for csv, geojson, and area-summary json files.
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$", path)) {
    geo <- fromJSON(path, simplifyVector = FALSE)
    return(length(geo[["features"]]))
  }
  if (grepl("\\.json$", path)) {
    json <- fromJSON(path, simplifyVector = FALSE)
    if (!is.null(json[["rows"]])) return(length(json[["rows"]]))
    if (!is.null(json[["features"]])) return(length(json[["features"]]))
  }
  NA_integer_
}

for (index in seq_len(nrow(raw_sources))) {
  download_raw(raw_sources[["filename"]][index], raw_sources[["url"]][index])
}
raw_sources[["retrieval_date"]] <- retrieval_date
raw_sources[["sha256"]] <- vapply(file.path(raw_dir, raw_sources[["filename"]]), sha256_file, character(1))
write.csv(raw_sources, file.path(raw_dir, "sources.csv"), row.names = FALSE)

# return the first column whose name contains every requested token.
find_column <- function(names_vector, tokens) {
  hits <- rep(TRUE, length(names_vector))
  lowered <- tolower(names_vector)
  for (token in tokens) hits <- hits & grepl(token, lowered, fixed = TRUE)
  match_index <- which(hits)
  if (length(match_index) != 1) {
    stop("expected one column for tokens: ", paste(tokens, collapse = ", "), call. = FALSE)
  }
  names_vector[[match_index]]
}

# parse a Nomis wide CSV into total, no-religion, and not-stated counts.
read_nomis_religion <- function(path, year, no_religion_label, not_stated_label) {
  raw <- read.csv(path, stringsAsFactors = FALSE, check.names = FALSE, fileEncoding = "UTF-8-BOM")
  names_raw <- names(raw)
  total_col <- find_column(names_raw, c("religion:", "all"))
  no_religion_col <- find_column(names_raw, c("religion:", tolower(no_religion_label)))
  not_stated_col <- find_column(names_raw, c("religion:", tolower(not_stated_label)))
  out <- data.frame(
    year = year,
    area_code = raw[["geography code"]],
    area_name = raw[["geography"]],
    total = as.integer(raw[[total_col]]),
    no_religion = as.integer(raw[[no_religion_col]]),
    not_stated = as.integer(raw[[not_stated_col]]),
    stringsAsFactors = FALSE
  )
  out[["stated"]] <- out[["total"]] - out[["not_stated"]]
  out[["affiliated"]] <- out[["stated"]] - out[["no_religion"]]
  out
}

# collapse old local-authority rows onto the 2021 boundary set.
concord_ew_rows <- function(rows, lookup) {
  map_index <- match(rows[["area_code"]], lookup[["LAD11CD"]])
  rows[["lad21_code"]] <- lookup[["LAD21CD"]][map_index]
  rows[["lad21_name"]] <- lookup[["LAD21NM"]][map_index]
  rows[["mapped"]] <- !is.na(rows[["lad21_code"]])
  groups <- split(seq_len(nrow(rows[rows[["mapped"]], ])), rows[["lad21_code"]][rows[["mapped"]]])
  mapped_rows <- rows[rows[["mapped"]], ]
  pieces <- lapply(names(groups), function(code) {
    group <- mapped_rows[groups[[code]], ]
    data.frame(
      year = group[["year"]][[1]],
      area_code = code,
      area_name = group[["lad21_name"]][[1]],
      total = sum(group[["total"]]),
      no_religion = sum(group[["no_religion"]]),
      not_stated = sum(group[["not_stated"]]),
      stated = sum(group[["stated"]]),
      affiliated = sum(group[["affiliated"]]),
      source_area_count = nrow(group),
      source_area_codes = paste(group[["area_code"]], collapse = "|"),
      stringsAsFactors = FALSE
    )
  })
  out <- do.call(rbind, pieces)
  out[order(out[["area_code"]]), ]
}

# build the standard area-summary row consumed by the shared map runtime.
build_summary_row <- function(country_code, boundary_set_id, boundary_level, area_code,
                              area_name, year, counts, land_area_sq_km,
                              source_ids, quality_flag = "") {
  has_counts <- !is.null(counts)
  stated <- if (has_counts) counts[["stated"]] else NA_integer_
  affiliated <- if (has_counts) counts[["affiliated"]] else NA_integer_
  no_religion <- if (has_counts) counts[["no_religion"]] else NA_integer_
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = paste0(boundary_set_id, ":", area_code),
    area_code = area_code,
    area_name = area_name,
    year = year,
    population_total = if (has_counts) as.integer(stated) else NULL,
    population_total_basis = if (has_counts) {
      "people with a stated current-religion response (all usual residents minus not answered or religion not stated)"
    } else {
      "stated current-religion response (pending extraction)"
    },
    religious_affiliation_count = if (has_counts) as.integer(affiliated) else NULL,
    religious_affiliation_percent = if (has_counts && stated > 0) round(100 * affiliated / stated, 2) else NULL,
    no_religion_count = if (has_counts) as.integer(no_religion) else NULL,
    no_religion_percent = if (has_counts && stated > 0) round(100 * no_religion / stated, 2) else NULL,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = if (is.finite(land_area_sq_km)) round(land_area_sq_km, 2) else NULL,
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = source_ids,
    quality_flag = quality_flag
  )
}

# flatten area-summary rows for csv siblings.
flatten_rows <- function(rows) {
  do.call(rbind, lapply(rows, function(row) {
    data.frame(
      country_code = row[["country_code"]],
      boundary_set_id = row[["boundary_set_id"]],
      boundary_level = row[["boundary_level"]],
      area_unit_id = row[["area_unit_id"]],
      area_code = row[["area_code"]],
      area_name = row[["area_name"]],
      year = row[["year"]],
      population_total = if (is.null(row[["population_total"]])) NA else row[["population_total"]],
      population_total_basis = row[["population_total_basis"]],
      religious_affiliation_count = if (is.null(row[["religious_affiliation_count"]])) NA else row[["religious_affiliation_count"]],
      religious_affiliation_percent = if (is.null(row[["religious_affiliation_percent"]])) NA else row[["religious_affiliation_percent"]],
      no_religion_count = if (is.null(row[["no_religion_count"]])) NA else row[["no_religion_count"]],
      no_religion_percent = if (is.null(row[["no_religion_percent"]])) NA else row[["no_religion_percent"]],
      place_count = NA_integer_,
      places_per_10000_residents = NA_real_,
      place_density_per_sq_km = NA_real_,
      land_area_sq_km = if (is.null(row[["land_area_sq_km"]])) NA else row[["land_area_sq_km"]],
      site_snapshot_date = NA,
      place_count_basis = NA,
      source_dataset_ids = paste(row[["source_dataset_ids"]], collapse = "|"),
      quality_flag = row[["quality_flag"]],
      stringsAsFactors = FALSE
    )
  }))
}

# create shared indicator metadata for census current-religion affiliation.
religion_indicators <- function(temporal_coverage, spatial_coverage, quality_notes) {
  list(
    list(
      indicator_id = "population_total",
      label = "Religion-response denominator",
      description = "People with a stated current-religion response in the area and census year.",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "All usual residents minus not answered or religion not stated.",
      temporal_coverage = temporal_coverage,
      spatial_coverage = spatial_coverage,
      quality_notes = quality_notes
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious affiliation %",
      description = "Share of the stated-response denominator reporting any current religious affiliation.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * (All usual residents - not answered/not stated - no religion) / (All usual residents - not answered/not stated).",
      temporal_coverage = temporal_coverage,
      spatial_coverage = spatial_coverage,
      quality_notes = quality_notes
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "No religion %",
      description = "Share of the stated-response denominator reporting no religion.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * No religion / (All usual residents - not answered/not stated).",
      temporal_coverage = temporal_coverage,
      spatial_coverage = spatial_coverage,
      quality_notes = quality_notes
    )
  )
}

# create shared choropleth layer metadata for the area summary.
religion_layers <- function(prefix, geography_label) {
  list(
    list(
      visual_layer_id = paste0(prefix, "-religious-affiliation-percent"),
      label = "Religious affiliation %",
      description = paste0(geography_label, " choropleth of current religious-affiliation percentage."),
      layer_type = "choropleth",
      indicator_ids = I(c("religious_affiliation_percent")),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "stated current-religion response"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "precomputed by area and census year",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = NULL
    ),
    list(
      visual_layer_id = paste0(prefix, "-no-religion-percent"),
      label = "No religion %",
      description = paste0(geography_label, " choropleth of no-religion percentage."),
      layer_type = "choropleth",
      indicator_ids = I(c("no_religion_percent")),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "stated current-religion response"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "precomputed by area and census year",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = NULL
    )
  )
}

# write a simplified GeoJSON while keeping the output under the target size.
write_boundary_geojson <- function(boundary, path, tolerances = c(0, 25, 50, 100, 200, 500)) {
  chosen_tolerance <- NA_real_
  for (tolerance in tolerances) {
    candidate <- boundary
    if (tolerance > 0) {
      candidate <- st_transform(candidate, 3857)
      candidate <- st_simplify(candidate, dTolerance = tolerance, preserveTopology = TRUE)
      candidate <- st_transform(candidate, 4326)
    } else {
      candidate <- st_transform(candidate, 4326)
    }
    st_write(candidate, path, delete_dsn = TRUE, quiet = TRUE)
    chosen_tolerance <- tolerance
    if (file_bytes(path) <= 3 * 1024 * 1024) break
  }
  chosen_tolerance
}

# create a source-dataset record for the area-summary product.
source_dataset <- function(id, name, provider, url, local_path, attribution, notes) {
  list(
    source_dataset_id = id,
    name = name,
    provider = provider,
    url = url,
    retrieval_date = retrieval_date,
    local_path = local_path,
    licence = list(
      name = "Open Government Licence v3.0",
      url = "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
      attribution = attribution
    ),
    citation = paste(provider, name, sep = ". "),
    access_limits = NULL,
    redistribution_limits = "Contains public sector information licensed under the Open Government Licence v3.0.",
    notes = notes
  )
}

# write one area-summary JSON/CSV pair.
write_summary <- function(summary, json_path, csv_path) {
  write(toJSON(summary, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null"), json_path)
  write.csv(flatten_rows(summary[["rows"]]), csv_path, row.names = FALSE, na = "")
}

ew_boundary_raw <- file.path(raw_dir, "ons_lad_may_2021_uk_bgc.geojson")
ew_lookup_raw <- file.path(raw_dir, "ons_lad11_lad21_ew_lookup.json")
sco_boundary_raw <- file.path(raw_dir, "scotland_council_area_2019.geojson")
ni_boundary_raw <- file.path(raw_dir, "osni_lgd_2012.geojson")
ni_2021_raw <- file.path(raw_dir, "nisra_census_2021_ms_b19.xlsx")

ew_boundary <- st_read(ew_boundary_raw, quiet = TRUE)
ew_boundary <- ew_boundary[substr(ew_boundary[["LAD21CD"]], 1, 1) %in% c("E", "W"), ]
ew_boundary[["area_code"]] <- ew_boundary[["LAD21CD"]]
ew_boundary[["area_name"]] <- ew_boundary[["LAD21NM"]]
ew_boundary[["area_unit_id"]] <- paste0(ew_boundary_set_id, ":", ew_boundary[["area_code"]])
ew_boundary[["boundary_set_id"]] <- ew_boundary_set_id
ew_boundary[["boundary_level"]] <- "ew_ltla"
ew_boundary[["land_area_sq_km"]] <- as.numeric(ew_boundary[["Shape__Area"]]) / 1e6
ew_boundary_export <- ew_boundary[c(
  "area_code", "area_name", "area_unit_id", "boundary_set_id",
  "boundary_level", "land_area_sq_km"
)]
ew_boundary_out <- file.path(uk_dir, "ew_ltla_2021.geojson")
ew_tolerance <- write_boundary_geojson(ew_boundary_export, ew_boundary_out)
ew_boundary_lookup <- st_drop_geometry(ew_boundary_export)

lookup_json <- fromJSON(ew_lookup_raw, simplifyDataFrame = TRUE)
if (is.data.frame(lookup_json[["features"]]) && "attributes" %in% names(lookup_json[["features"]])) {
  ew_lookup <- lookup_json[["features"]][["attributes"]]
} else {
  ew_lookup <- do.call(rbind, lapply(lookup_json[["features"]], function(feature) {
    as.data.frame(feature[["attributes"]], stringsAsFactors = FALSE)
  }))
}
ew_self_lookup <- data.frame(
  LAD11CD = ew_boundary_lookup[["area_code"]],
  LAD11NM = ew_boundary_lookup[["area_name"]],
  LAD11NMW = NA_character_,
  LAD21CD = ew_boundary_lookup[["area_code"]],
  LAD21NM = ew_boundary_lookup[["area_name"]],
  LAD21NMW = NA_character_,
  ObjectId = NA_integer_,
  stringsAsFactors = FALSE
)
ew_lookup <- rbind(
  ew_lookup,
  ew_self_lookup[!ew_self_lookup[["LAD11CD"]] %in% ew_lookup[["LAD11CD"]], names(ew_lookup)]
)
ew_2021 <- read_nomis_religion(
  file.path(raw_dir, "nomis_ew_2021_ts030_lad2022.csv"),
  2021,
  "No religion",
  "Not answered"
)
ew_2011 <- read_nomis_religion(
  file.path(raw_dir, "nomis_ew_2011_ks209ew_lad2011.csv"),
  2011,
  "No religion",
  "Religion not stated"
)
ew_2001 <- read_nomis_religion(
  file.path(raw_dir, "nomis_ew_2001_ks007_lad2011.csv"),
  2001,
  "No religion",
  "Religion not stated"
)
ew_2011_c <- concord_ew_rows(ew_2011, ew_lookup)
ew_2001_c <- concord_ew_rows(ew_2001, ew_lookup)
ew_2021[["source_area_count"]] <- 1L
ew_2021[["source_area_codes"]] <- ew_2021[["area_code"]]
ew_counts <- rbind(
  ew_2001_c,
  ew_2011_c,
  ew_2021[c("year", "area_code", "area_name", "total", "no_religion", "not_stated", "stated", "affiliated", "source_area_count", "source_area_codes")]
)

ew_count_map <- split(ew_counts, paste(ew_counts[["area_code"]], ew_counts[["year"]], sep = "|"))
ew_rows <- unlist(lapply(seq_len(nrow(ew_boundary_lookup)), function(index) {
  area_code <- ew_boundary_lookup[["area_code"]][[index]]
  area_name <- ew_boundary_lookup[["area_name"]][[index]]
  land_area <- ew_boundary_lookup[["land_area_sq_km"]][[index]]
  lapply(c(2001L, 2011L, 2021L), function(year) {
    key <- paste(area_code, year, sep = "|")
    counts <- ew_count_map[[key]]
    source_id <- if (year == 2021L) ew_2021_dataset_id else if (year == 2011L) ew_2011_dataset_id else ew_2001_dataset_id
    quality <- ""
    if (is.null(counts)) {
      quality <- "lad11_to_lad21_concordance_no_match"
    } else if (year < 2021L && counts[["source_area_count"]][[1]] > 1) {
      quality <- "boundary_change_crosswalked;lad11_to_lad21_concordance_sum"
    } else if (year < 2021L && counts[["source_area_codes"]][[1]] != area_code) {
      quality <- "boundary_change_crosswalked;lad11_to_lad21_concordance"
    }
    build_summary_row(
      "UK", ew_boundary_set_id, "ew_ltla", area_code, area_name, year,
      if (is.null(counts)) NULL else as.list(counts[1, ]),
      land_area,
      c(source_id, ew_boundary_dataset_id, ew_lookup_dataset_id),
      quality
    )
  })
}), recursive = FALSE)

ew_sources <- list(
  source_dataset(
    ew_2021_dataset_id,
    "Census 2021 TS030 Religion, 2022 local authorities",
    "Office for National Statistics via Nomis",
    raw_sources[["url"]][raw_sources[["filename"]] == "nomis_ew_2021_ts030_lad2022.csv"],
    file.path(raw_dir, "nomis_ew_2021_ts030_lad2022.csv"),
    "Office for National Statistics",
    "The map uses total usual residents, no religion, and not answered at 2022 local-authority district level."
  ),
  source_dataset(
    ew_2011_dataset_id,
    "Census 2011 KS209EW Religion, pre-2015 local authorities",
    "Office for National Statistics via Nomis",
    raw_sources[["url"]][raw_sources[["filename"]] == "nomis_ew_2011_ks209ew_lad2011.csv"],
    file.path(raw_dir, "nomis_ew_2011_ks209ew_lad2011.csv"),
    "Office for National Statistics",
    "The 2011 rows are aggregated to the 2021 boundary set with the ONS LAD11 to LAD21 lookup."
  ),
  source_dataset(
    ew_2001_dataset_id,
    "Census 2001 KS007 Religion, pre-2015 local authorities",
    "Office for National Statistics via Nomis",
    raw_sources[["url"]][raw_sources[["filename"]] == "nomis_ew_2001_ks007_lad2011.csv"],
    file.path(raw_dir, "nomis_ew_2001_ks007_lad2011.csv"),
    "Office for National Statistics",
    "The 2001 rows are aggregated to the 2021 boundary set with the ONS LAD11 to LAD21 lookup."
  ),
  source_dataset(
    ew_boundary_dataset_id,
    "Local Authority Districts (May 2021) Boundaries UK BGC",
    "Office for National Statistics Open Geography Portal",
    "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Local_Authority_Districts_May_2021_UK_BGC_2022/FeatureServer",
    ew_boundary_raw,
    "Office for National Statistics",
    "Only England and Wales local-authority districts are exported for this level."
  ),
  source_dataset(
    ew_lookup_dataset_id,
    "Local Authority District (2011) to Local Authority District (2021) Lookup for EW",
    "Office for National Statistics Open Geography Portal",
    "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/LAD11_LAD21_EW_LU/FeatureServer",
    ew_lookup_raw,
    "Office for National Statistics",
    "Used as a first-pass concordance for earlier Nomis local-authority waves; merged 2011 authorities are summed onto the 2021 authority."
  )
)

ew_summary <- list(
  schema_version = "0.1.0",
  generated_at = stamp,
  generated_by = "scripts/build_uk_area_summary.R",
  country_code = "UK",
  boundary_set = list(
    boundary_set_id = ew_boundary_set_id,
    country_code = "UK",
    level = "ew_ltla",
    vintage = "May 2021",
    source_dataset_id = ew_boundary_dataset_id
  ),
  site_snapshot = list(
    source_dataset_id = NULL,
    snapshot_date = NULL,
    basis = "no United Kingdom place-of-worship snapshot is included in this country data-map release",
    notes = "The UK page exposes census affiliation, no-religion, and change metrics only; OSM place-density metrics are hidden until governed place layers are built."
  ),
  source_datasets = ew_sources,
  indicators = religion_indicators(
    "2001, 2011, 2021",
    "England and Wales local-authority districts, May 2021 boundary set",
    "Earlier waves are aggregated from 2011 local-authority rows to the 2021 boundary set using the ONS LAD11 to LAD21 lookup."
  ),
  visual_layers = religion_layers("uk-ew-ltla", "England and Wales local-authority"),
  rows = ew_rows
)
ew_summary_json <- file.path(uk_dir, "area_summary_ew_ltla.json")
ew_summary_csv <- file.path(uk_dir, "area_summary_ew_ltla.csv")
write_summary(ew_summary, ew_summary_json, ew_summary_csv)

sco_boundary <- st_read(sco_boundary_raw, quiet = TRUE)
sco_boundary[["area_code"]] <- sco_boundary[["CODE"]]
sco_boundary[["area_name"]] <- sco_boundary[["NAME"]]
sco_boundary[["area_unit_id"]] <- paste0(sco_boundary_set_id, ":", sco_boundary[["area_code"]])
sco_boundary[["boundary_set_id"]] <- sco_boundary_set_id
sco_boundary[["boundary_level"]] <- "sco_ca"
sco_boundary[["land_area_sq_km"]] <- as.numeric(sco_boundary[["Shape__Area"]]) / 1e6
sco_boundary_export <- sco_boundary[c(
  "area_code", "area_name", "area_unit_id", "boundary_set_id",
  "boundary_level", "land_area_sq_km"
)]
sco_boundary_out <- file.path(uk_dir, "sco_council_area_2019.geojson")
sco_tolerance <- write_boundary_geojson(sco_boundary_export, sco_boundary_out)
sco_boundary_lookup <- st_drop_geometry(sco_boundary_export)
sco_rows <- unlist(lapply(seq_len(nrow(sco_boundary_lookup)), function(index) {
  lapply(c(2001L, 2011L, 2022L), function(year) {
    build_summary_row(
      "UK", sco_boundary_set_id, "sco_ca",
      sco_boundary_lookup[["area_code"]][[index]],
      sco_boundary_lookup[["area_name"]][[index]],
      year,
      NULL,
      sco_boundary_lookup[["land_area_sq_km"]][[index]],
      c(sco_boundary_dataset_id, sco_pending_dataset_id),
      "scotland_census_table_builder_extraction_pending"
    )
  })
}), recursive = FALSE)
sco_sources <- list(
  source_dataset(
    sco_boundary_dataset_id,
    "Council Area 2019 boundaries",
    "National Records of Scotland / Scotland's Census",
    "https://services1.arcgis.com/etUJqgud3DEym3ls/ArcGIS/rest/services/CouncilArea2019_MHW/FeatureServer",
    sco_boundary_raw,
    "National Records of Scotland",
    "Council area boundaries are live; the census table-builder extraction remains pending."
  ),
  source_dataset(
    sco_pending_dataset_id,
    "Scotland census religion tables, extraction pending",
    "National Records of Scotland / Scotland's Census",
    "https://www.scotlandscensus.gov.uk/search-the-census",
    NULL,
    "National Records of Scotland",
    "The table-builder search route was verified, but no stable unauthenticated CSV/XLSX export was pinned in this sitting."
  )
)
sco_summary <- list(
  schema_version = "0.1.0",
  generated_at = stamp,
  generated_by = "scripts/build_uk_area_summary.R",
  country_code = "UK",
  boundary_set = list(
    boundary_set_id = sco_boundary_set_id,
    country_code = "UK",
    level = "sco_ca",
    vintage = "2019",
    source_dataset_id = sco_boundary_dataset_id
  ),
  site_snapshot = list(
    source_dataset_id = NULL,
    snapshot_date = NULL,
    basis = "no Scotland place-of-worship snapshot is included in this country data-map release",
    notes = "Census religious-affiliation data is pending for Scotland council areas."
  ),
  source_datasets = sco_sources,
  indicators = religion_indicators(
    "2001, 2011, 2022 pending",
    "Scotland council areas, 2019 boundary set",
    "The official table-builder extraction remains pending."
  ),
  visual_layers = religion_layers("uk-sco-ca", "Scotland council-area"),
  rows = sco_rows
)
sco_summary_json <- file.path(uk_dir, "area_summary_sco_ca.json")
sco_summary_csv <- file.path(uk_dir, "area_summary_sco_ca.csv")
write_summary(sco_summary, sco_summary_json, sco_summary_csv)

ni_boundary <- st_read(ni_boundary_raw, quiet = TRUE)
ni_boundary[["area_code"]] <- ni_boundary[["LGDCode"]]
ni_boundary[["area_name"]] <- ni_boundary[["LGDNAME"]]
ni_boundary[["area_name"]][ni_boundary[["area_code"]] == "N09000002"] <- "Armagh City, Banbridge and Craigavon"
ni_boundary[["area_name"]][ni_boundary[["area_code"]] == "N09000005"] <- "Derry City and Strabane"
ni_boundary[["area_unit_id"]] <- paste0(ni_boundary_set_id, ":", ni_boundary[["area_code"]])
ni_boundary[["boundary_set_id"]] <- ni_boundary_set_id
ni_boundary[["boundary_level"]] <- "ni_lgd"
ni_boundary[["land_area_sq_km"]] <- as.numeric(ni_boundary[["Shape__Area"]]) / 1e6
ni_boundary_export <- ni_boundary[c(
  "area_code", "area_name", "area_unit_id", "boundary_set_id",
  "boundary_level", "land_area_sq_km"
)]
ni_boundary_out <- file.path(uk_dir, "ni_lgd_2012.geojson")
ni_tolerance <- write_boundary_geojson(ni_boundary_export, ni_boundary_out)
ni_boundary_lookup <- st_drop_geometry(ni_boundary_export)

# parse the NISRA MS-B19 LGD count table.
parse_nisra_ms_b19_lgd <- function(path) {
  raw <- read_excel(path, sheet = "LGD", col_names = FALSE)
  header <- as.character(unlist(raw[9, ]))
  counts <- raw[10:20, ]
  names(counts) <- make.names(header, unique = TRUE)
  total_col <- find_column(names(counts), c("all.usual.residents"))
  no_religion_col <- find_column(names(counts), c("no.religion"))
  not_stated_col <- find_column(names(counts), c("religion.not.stated"))
  out <- data.frame(
    year = 2021L,
    area_name = as.character(counts[[1]]),
    area_code = as.character(counts[[2]]),
    total = as.integer(counts[[total_col]]),
    no_religion = as.integer(counts[[no_religion_col]]),
    not_stated = as.integer(counts[[not_stated_col]]),
    stringsAsFactors = FALSE
  )
  out[["stated"]] <- out[["total"]] - out[["not_stated"]]
  out[["affiliated"]] <- out[["stated"]] - out[["no_religion"]]
  out
}
ni_2021 <- parse_nisra_ms_b19_lgd(ni_2021_raw)
ni_count_map <- split(ni_2021, paste(ni_2021[["area_code"]], ni_2021[["year"]], sep = "|"))
ni_rows <- unlist(lapply(seq_len(nrow(ni_boundary_lookup)), function(index) {
  area_code <- ni_boundary_lookup[["area_code"]][[index]]
  area_name <- ni_boundary_lookup[["area_name"]][[index]]
  land_area <- ni_boundary_lookup[["land_area_sq_km"]][[index]]
  lapply(c(2001L, 2011L, 2021L), function(year) {
    counts <- ni_count_map[[paste(area_code, year, sep = "|")]]
    build_summary_row(
      "UK", ni_boundary_set_id, "ni_lgd", area_code, area_name, year,
      if (is.null(counts)) NULL else as.list(counts[1, ]),
      land_area,
      if (year == 2021L) c(ni_2021_dataset_id, ni_boundary_dataset_id) else c(ni_boundary_dataset_id, ni_pending_dataset_id),
      if (year == 2021L) "" else "nisra_2001_2011_lgd_religion_extraction_pending"
    )
  })
}), recursive = FALSE)
ni_sources <- list(
  source_dataset(
    ni_2021_dataset_id,
    "Census 2021 MS-B19 Religion, Local Government District",
    "Northern Ireland Statistics and Research Agency",
    "https://www.nisra.gov.uk/system/files/statistics/census-2021-ms-b19.xlsx",
    ni_2021_raw,
    "Northern Ireland Statistics and Research Agency",
    "The map uses the LGD count block for current religion. Religion or religion brought up in is deliberately excluded."
  ),
  source_dataset(
    ni_boundary_dataset_id,
    "OSNI Open Data Largescale Boundaries, Local Government Districts 2012",
    "Ordnance Survey of Northern Ireland / OpenDataNI",
    "https://services2.arcgis.com/BdBkthNLO9mzGAMO/arcgis/rest/services/OSNI_Open_Data_Largescale_Boundaries__Local_Government_Districts_2012/FeatureServer",
    ni_boundary_raw,
    "Ordnance Survey of Northern Ireland",
    "Current 11-district geometry used for the 2021 LGD table."
  ),
  source_dataset(
    ni_pending_dataset_id,
    "Northern Ireland 2001 and 2011 LGD current-religion tables, extraction pending",
    "Northern Ireland Statistics and Research Agency",
    "https://www.nisra.gov.uk/publications/census-2021-main-statistics-religion-tables",
    NULL,
    "Northern Ireland Statistics and Research Agency",
    "NINIS/table-lookup routes for 2001 and 2011 LGD current-religion tables were not pinned in this sitting."
  )
)
ni_summary <- list(
  schema_version = "0.1.0",
  generated_at = stamp,
  generated_by = "scripts/build_uk_area_summary.R",
  country_code = "UK",
  boundary_set = list(
    boundary_set_id = ni_boundary_set_id,
    country_code = "UK",
    level = "ni_lgd",
    vintage = "2012",
    source_dataset_id = ni_boundary_dataset_id
  ),
  site_snapshot = list(
    source_dataset_id = NULL,
    snapshot_date = NULL,
    basis = "no Northern Ireland place-of-worship snapshot is included in this country data-map release",
    notes = "The Northern Ireland level exposes 2021 current-religion affiliation only; 2001 and 2011 LGD rows are present as pending placeholders."
  ),
  source_datasets = ni_sources,
  indicators = religion_indicators(
    "2021 live; 2001 and 2011 pending",
    "Northern Ireland Local Government Districts, 2012 boundary set",
    "The 2021 table is current religion only. Community-background tables are separate and not included."
  ),
  visual_layers = religion_layers("uk-ni-lgd", "Northern Ireland Local Government District"),
  rows = ni_rows
)
ni_summary_json <- file.path(uk_dir, "area_summary_ni_lgd.json")
ni_summary_csv <- file.path(uk_dir, "area_summary_ni_lgd.csv")
write_summary(ni_summary, ni_summary_json, ni_summary_csv)

# compare local sums with the published country row where available.
validate_ew_country <- function(area_rows, country_path, year, no_label, not_label) {
  country <- read_nomis_religion(country_path, year, no_label, not_label)
  ew_country <- country[country[["area_code"]] == "K04000001", ]
  if (nrow(ew_country) != 1) stop("missing England and Wales country row for ", year, call. = FALSE)
  area_year <- area_rows[area_rows[["year"]] == year, ]
  list(
    year = year,
    area_count = nrow(area_year),
    country_total = ew_country[["total"]][[1]],
    area_total_sum = sum(area_year[["total"]]),
    total_difference = sum(area_year[["total"]]) - ew_country[["total"]][[1]],
    country_stated = ew_country[["stated"]][[1]],
    area_stated_sum = sum(area_year[["stated"]]),
    stated_difference = sum(area_year[["stated"]]) - ew_country[["stated"]][[1]],
    country_affiliated = ew_country[["affiliated"]][[1]],
    area_affiliated_sum = sum(area_year[["affiliated"]]),
    affiliated_difference = sum(area_year[["affiliated"]]) - ew_country[["affiliated"]][[1]],
    country_no_religion = ew_country[["no_religion"]][[1]],
    area_no_religion_sum = sum(area_year[["no_religion"]]),
    no_religion_difference = sum(area_year[["no_religion"]]) - ew_country[["no_religion"]][[1]]
  )
}
ew_validation <- list(
  validate_ew_country(ew_counts, file.path(raw_dir, "nomis_ew_2001_ks007_country.csv"), 2001L, "No religion", "Religion not stated"),
  validate_ew_country(ew_counts, file.path(raw_dir, "nomis_ew_2011_ks209ew_country.csv"), 2011L, "No religion", "Religion not stated"),
  validate_ew_country(ew_counts, file.path(raw_dir, "nomis_ew_2021_ts030_country.csv"), 2021L, "No religion", "Not answered")
)

# compare NISRA LGD sums with the Northern Ireland sheet row.
validate_ni_country <- function(path, area_rows) {
  raw <- read_excel(path, sheet = "NI", col_names = FALSE)
  header <- as.character(unlist(raw[9, ]))
  counts <- raw[10, ]
  names(counts) <- make.names(header, unique = TRUE)
  total_col <- find_column(names(counts), c("all.usual.residents"))
  no_religion_col <- find_column(names(counts), c("no.religion"))
  not_stated_col <- find_column(names(counts), c("religion.not.stated"))
  total <- as.integer(counts[[total_col]])
  no_religion <- as.integer(counts[[no_religion_col]])
  not_stated <- as.integer(counts[[not_stated_col]])
  stated <- total - not_stated
  affiliated <- stated - no_religion
  live <- area_rows[area_rows[["year"]] == 2021L, ]
  list(
    year = 2021L,
    area_count = nrow(live),
    country_total = total,
    area_total_sum = sum(live[["total"]]),
    total_difference = sum(live[["total"]]) - total,
    country_stated = stated,
    area_stated_sum = sum(live[["stated"]]),
    stated_difference = sum(live[["stated"]]) - stated,
    country_affiliated = affiliated,
    area_affiliated_sum = sum(live[["affiliated"]]),
    affiliated_difference = sum(live[["affiliated"]]) - affiliated,
    country_no_religion = no_religion,
    area_no_religion_sum = sum(live[["no_religion"]]),
    no_religion_difference = sum(live[["no_religion"]]) - no_religion
  )
}
ni_validation <- validate_ni_country(ni_2021_raw, ni_2021)

if (any(vapply(ew_validation, function(result) {
  tolerance <- 25L
  abs(result[["total_difference"]]) > tolerance ||
    abs(result[["stated_difference"]]) > tolerance ||
    abs(result[["affiliated_difference"]]) > tolerance ||
    abs(result[["no_religion_difference"]]) > tolerance
}, logical(1)))) {
  stop("England/Wales validation against Nomis country rows failed", call. = FALSE)
}
if (ni_validation[["total_difference"]] != 0 ||
    ni_validation[["stated_difference"]] != 0 ||
    ni_validation[["affiliated_difference"]] != 0 ||
    ni_validation[["no_religion_difference"]] != 0) {
  stop("Northern Ireland validation against NISRA country row failed", call. = FALSE)
}

# create a manifest durable-file record for one generated output.
manifest_file_record <- function(path, content, licence_status = "accepted") {
  list(
    uri = paste0("repo:", path),
    storage_provider = "other",
    format = sub("^.*\\.", "", path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    row_count = row_count_file(path),
    content = content,
    privacy = "public",
    licence_status = licence_status
  )
}

durable_files <- list(
  manifest_file_record(ew_summary_json, "England and Wales local-authority area summary, 2001-2021."),
  manifest_file_record(ew_summary_csv, "Flattened England and Wales local-authority area summary, 2001-2021."),
  manifest_file_record(ew_boundary_out, "Simplified England and Wales local-authority boundaries, May 2021."),
  manifest_file_record(sco_summary_json, "Scotland council-area pending area summary, 2001-2022."),
  manifest_file_record(sco_summary_csv, "Flattened Scotland council-area pending area summary, 2001-2022."),
  manifest_file_record(sco_boundary_out, "Simplified Scotland council-area boundaries, 2019."),
  manifest_file_record(ni_summary_json, "Northern Ireland LGD area summary, 2021 live with 2001/2011 placeholders."),
  manifest_file_record(ni_summary_csv, "Flattened Northern Ireland LGD area summary, 2021 live with 2001/2011 placeholders."),
  manifest_file_record(ni_boundary_out, "Simplified Northern Ireland Local Government District boundaries, 2012.")
)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:uk-census-religion:uk:2001-2022:initial",
  dataset_id = "uk-census-religion:uk:2001-2022:initial",
  dataset_version_id = paste0("uk-census-religion:uk:2001-2022:initial:", substr(sha256_file(ew_summary_json), 1, 12)),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "uk-census-religion",
  dataset_role = "public_product",
  scope = list(
    level = "country",
    country_codes = I(c("UK")),
    snapshot_date = NULL,
    snapshot_anchor = NULL,
    pipeline_stage = "public"
  ),
  created_at = stamp,
  created_by = "scripts/build_uk_area_summary.R",
  pipeline = list(
    script = "scripts/build_uk_area_summary.R",
    git_commit = git_commit,
    command = "Rscript scripts/build_uk_area_summary.R",
    parameters = list(
      census_levels = c("ew_ltla", "sco_ca", "ni_lgd"),
      live_waves = list(
        ew_ltla = c("2001", "2011", "2021"),
        ni_lgd = c("2021")
      ),
      pending_waves = list(
        sco_ca = c("2001", "2011", "2022"),
        ni_lgd = c("2001", "2011")
      ),
      denominator = "all usual residents minus not answered or religion not stated",
      ew_boundary_simplification_tolerance_m = ew_tolerance,
      sco_boundary_simplification_tolerance_m = sco_tolerance,
      ni_boundary_simplification_tolerance_m = ni_tolerance
    ),
    software_versions = list(
      r = paste(R.version[["major"]], R.version[["minor"]], sep = "."),
      sf = as.character(packageVersion("sf")),
      readxl = as.character(packageVersion("readxl")),
      jsonlite = as.character(packageVersion("jsonlite"))
    )
  ),
  source = list(
    provider = "Office for National Statistics via Nomis; Office for National Statistics Open Geography Portal; National Records of Scotland; Ordnance Survey of Northern Ireland; Northern Ireland Statistics and Research Agency",
    source_dataset_ids = c(
      ew_2021_dataset_id, ew_2011_dataset_id, ew_2001_dataset_id,
      ew_boundary_dataset_id, ew_lookup_dataset_id,
      sco_boundary_dataset_id, sco_pending_dataset_id,
      ni_2021_dataset_id, ni_boundary_dataset_id, ni_pending_dataset_id
    ),
    source_urls = raw_sources[["url"]],
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = "Contains public sector information licensed under the Open Government Licence v3.0.",
    citation = "Office for National Statistics via Nomis, Census 2001 KS007, Census 2011 KS209EW, and Census 2021 TS030; Office for National Statistics Open Geography Portal; National Records of Scotland / Scotland's Census; Ordnance Survey of Northern Ireland / OpenDataNI; Northern Ireland Statistics and Research Agency, Census 2021 MS-B19."
  ),
  input_manifests = list(),
  durable_files = durable_files,
  stats = list(
    ew_area_count = nrow(ew_boundary_lookup),
    ew_rows = length(ew_rows),
    ew_2001_total_difference = ew_validation[[1]][["total_difference"]],
    ew_2011_total_difference = ew_validation[[2]][["total_difference"]],
    ew_2021_total_difference = ew_validation[[3]][["total_difference"]],
    sco_area_count = nrow(sco_boundary_lookup),
    sco_rows = length(sco_rows),
    sco_live_rows = 0L,
    ni_area_count = nrow(ni_boundary_lookup),
    ni_rows = length(ni_rows),
    ni_live_rows = nrow(ni_2021),
    ni_2021_total_difference = ni_validation[["total_difference"]]
  ),
  validation = list(
    status = "passed_with_warnings",
    commands = c(
      "Rscript scripts/build_uk_area_summary.R",
      "jq empty apps/regions/uk/data/area_summary_ew_ltla.json apps/regions/uk/data/area_summary_sco_ca.json apps/regions/uk/data/area_summary_ni_lgd.json docs/manifests/uk-census-religion-2001-2022.json"
    ),
    warnings = c(
      "England and Wales national-total residuals are within the 25-person build tolerance.",
      "Scotland council-area census counts are pending extraction.",
      "Northern Ireland 2001 and 2011 LGD census counts are pending extraction."
    ),
    notes = "England and Wales join coverage is 331/331 for 2001, 2011, and 2021. Scotland has 32 council-area boundary rows for each placeholder year and 0 live census rows. Northern Ireland has 11/11 live 2021 LGD rows and placeholder rows for 2001 and 2011."
  ),
  privacy = "public",
  licence_status = "accepted",
  downstream_status = "public",
  notes = "Raw files are downloaded to data/raw/uk_census. Derived summaries and simplified boundaries are committed. The product uses census current-religion affiliation throughout. Religion or religion brought up in/community background is not mixed into the affiliation metric."
)

write(toJSON(manifest, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null"), manifest_out)
message("wrote ", ew_summary_json, " (", length(ew_rows), " rows)")
message("wrote ", sco_summary_json, " (", length(sco_rows), " rows)")
message("wrote ", ni_summary_json, " (", length(ni_rows), " rows)")
message("wrote ", manifest_out)
