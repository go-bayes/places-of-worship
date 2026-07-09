# build the rwanda district area-summary product from the 2012 and 2022 censuses.
# inputs: the RPHC4 (2012) Socio-cultural Characteristics of the Population thematic
# report, Table 26 (Annex E: distribution % of the resident population by religious
# affiliation and sector of residence), and the RPHC5 (2022) Social-cultural
# Characteristics of the Population thematic report, Table D.1 (Annex D: the same
# sector-level religion table for 2022), plus the geoBoundaries RWA ADM2 (30
# districts) GeoJSON.
# outputs: apps/regions/rw/data/rw_district_2012.geojson,
# apps/regions/rw/data/area_summary_district.{json,csv}, and
# docs/manifests/rw-census-religion-2012-2022.json.
# run from the repo root: Rscript scripts/build_rw_area_summary.R
# both reports print religion at sector level. 2012 (Table 26) carries no district
# subtotal rows, so the 416 sectors are aggregated up to the 30 districts by
# summing the exact sector populations and the population-weighted religion shares
# (1-decimal source precision). 2022 (Table D.1) prints an exact district "Total"
# row per district (2-decimal shares), read directly. both waves reconcile: the
# district populations sum exactly to the printed national total (2012:
# 10,515,973; 2022: 13,246,394). religion ships percent-only (the source is
# percentage-based); population_total is exact and carried as the denominator.
# the 2022 religion question was NOT dropped: RPHC5 collected religion with ten
# modalities (adding Other Christians), so this product ships two waves, not one.

suppressMessages({
  library(jsonlite)
  library(sf)
})

raw_dir <- "data/raw/rw_census"
rw_dir <- "apps/regions/rw/data"
manifest_dir <- "docs/manifests"
dir.create(rw_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- "2026-07-09"
script_id <- "scripts/build_rw_area_summary.R"
country_code <- "RW"
years <- c(2012L, 2022L)

boundary_set_id <- "rw-district-2012-geoboundaries-adm2"
boundary_level <- "district"
census_2012_dataset_id <- "nisr-rphc4-2012-socio-cultural-table26-religion-by-sector"
census_2022_dataset_id <- "nisr-rphc5-2022-social-cultural-tabled1-religion-by-sector"
boundary_dataset_id <- "geoboundaries-rwa-adm2-2012"

# source urls recorded in the manifest and the on-page attribution.
census_landing_url <- "https://www.statistics.gov.rw/statistical-publications"
census_2012_url <- "https://www.statistics.gov.rw/sites/default/files/documents/2025-07/RPHC4_Socio_cultural_characteristics_population.pdf"
census_2022_url <- "https://www.statistics.gov.rw/sites/default/files/documents/2025-02/Social-cultural%20characteristics.pdf"
main_indicators_2022_url <- "https://www.statistics.gov.rw/sites/default/files/documents/2025-02/RPHC5_MainIndicatorsReport_Final.pdf"
geoboundaries_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/RWA/ADM2/"
geoboundaries_gj_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/RWA/ADM2/geoBoundaries-RWA-ADM2.geojson"

census_2012_path <- file.path(raw_dir, "rw_2012_socio_cultural.pdf")
census_2022_path <- file.path(raw_dir, "rw_2022_socio_cultural.pdf")
geoboundaries_path <- file.path(raw_dir, "geoBoundaries-RWA-ADM2.geojson")
geoboundaries_meta_path <- file.path(raw_dir, "gb_rwa_adm2_meta.json")

boundary_out <- file.path(rw_dir, "rw_district_2012.geojson")
summary_json_out <- file.path(rw_dir, "area_summary_district.json")
summary_csv_out <- file.path(rw_dir, "area_summary_district.csv")
manifest_out <- file.path(manifest_dir, "rw-census-religion-2012-2022.json")

licence_text <- paste(
  "NISR RPHC4 (2012) Socio-cultural Characteristics of the Population thematic",
  "report, Table 26 (religious affiliation by sector), and NISR RPHC5 (2022)",
  "Social-cultural Characteristics of the Population thematic report, Table D.1",
  "(religious affiliation by sector). The National Institute of Statistics of",
  "Rwanda publishes the census reports for open download; no explicit reuse",
  "licence is stated on the reports, so the derived product attributes NISR and",
  "links the source of record. Boundaries are geoBoundaries RWA ADM2 (30",
  "districts, 2012), Creative Commons Attribution 4.0 International, boundary",
  "source Open Data Rwanda (NISR geoportal, statistics.gov.rw/terms-use)."
)
licence_status <- "nisr_census_open_report_attribution_geoboundaries_cc_by_4_0"

# the 30 modern districts (post-2006 reform), spelled as geoBoundaries RWA ADM2
# names them. these double as the district-header lines that group the sectors in
# both reports; sector names repeat across districts (Nyarugenge, Musha, Nyanza,
# Muganza), so sectors are grouped positionally by the preceding district header,
# never by sector name.
districts <- c(
  "Nyarugenge", "Gasabo", "Kicukiro", "Nyanza", "Gisagara", "Nyaruguru", "Huye",
  "Nyamagabe", "Ruhango", "Muhanga", "Kamonyi", "Karongi", "Rutsiro", "Rubavu",
  "Nyabihu", "Ngororero", "Rusizi", "Nyamasheke", "Rulindo", "Gakenke", "Musanze",
  "Burera", "Gicumbi", "Rwamagana", "Nyagatare", "Gatsibo", "Kayonza", "Kirehe",
  "Ngoma", "Bugesera"
)

# 2012 Table 26 column order (nine modalities, one decimal). named religions are
# every category except no_religion and not_stated.
cats_2012 <- c("catholic", "protestant", "adventist", "muslim", "jehovah",
               "traditional", "no_religion", "other_religion", "not_stated")
named_2012 <- c("catholic", "protestant", "adventist", "muslim", "jehovah",
                "traditional", "other_religion")

# 2022 Table D.1 column order (ten modalities, two decimals; adds Other Christians
# and reorders no_religion after other_religion). named religions are every
# category except no_religion and not_stated.
cats_2022 <- c("catholic", "protestant", "adventist", "other_christians", "muslim",
               "jehovah", "traditional", "other_religion", "no_religion", "not_stated")
named_2022 <- c("catholic", "protestant", "adventist", "other_christians", "muslim",
                "jehovah", "traditional", "other_religion")

# printed national religion shares (% of resident population) for cross-checking
# the aggregate against the reports' own Rwanda row.
national_2012_printed <- c(catholic = 43.7, protestant = 37.7, adventist = 11.8,
                           muslim = 2.0, jehovah = 0.7, traditional = 0.0,
                           no_religion = 2.5, other_religion = 0.2, not_stated = 1.3)
national_2012_pop <- 10515973L
# the RPHC5 national Rwanda row prints these shares (Protestant is the residual,
# ~35.85); the build recomputes the national aggregate from the 30 districts and
# asserts no_religion and not_stated reproduce the printed national values.
national_2022_no_religion_printed <- 3.04
national_2022_not_stated_printed <- 0.13
national_2022_pop <- 13246394L

# stop early if a required raw source has not been downloaded.
require_file <- function(path) {
  if (!file.exists(path)) stop("missing required source: ", path, call. = FALSE)
}

sha256_file <- function(path) unname(tools::sha256sum(path))
file_bytes <- function(path) as.numeric(unname(file.info(path)[["size"]]))

null_if_na <- function(value) {
  if (length(value) == 0L || is.na(value) || !is.finite(value)) return(NULL)
  value
}

# count rows or features for CSV, GeoJSON, and area-summary JSON files.
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$", path)) {
    geo <- fromJSON(path, simplifyVector = FALSE)
    return(length(geo[["features"]]))
  }
  if (grepl("\\.json$", path)) {
    json <- fromJSON(path, simplifyVector = FALSE)
    if (!is.null(json[["rows"]])) return(length(json[["rows"]]))
  }
  NA_integer_
}

# run pdftotext -layout and return the text lines.
pdf_layout_lines <- function(pdf_path) {
  pdftotext <- Sys.which("pdftotext")
  if (!nzchar(pdftotext)) stop("pdftotext (poppler) is required", call. = FALSE)
  layout_path <- tempfile(fileext = ".txt")
  on.exit(unlink(layout_path), add = TRUE)
  status <- system2(pdftotext, c("-layout", shQuote(pdf_path), shQuote(layout_path)))
  if (status != 0L) stop("pdftotext failed on ", pdf_path, call. = FALSE)
  readLines(layout_path, warn = FALSE)
}

# slugify a district name to a stable lowercase area code (geoBoundaries carries
# no ISO code for RWA districts).
rw_slug <- function(x) gsub("[^a-z0-9]+", "-", tolower(trimws(x)))

# parse 2012 Table 26 and aggregate the 416 sectors up to the 30 districts.
# each sector row is: label, nine one-decimal shares, 100.0, and the exact sector
# population. sectors are assigned to the district named by the most recent
# bare district-header line. returns a per-district list of the summed population
# and the population-weighted religion counts (share/100 * population).
parse_2012 <- function(pdf_path) {
  txt <- pdf_layout_lines(pdf_path)
  start <- which(grepl("Annex E", txt) & grepl("Sector", txt))
  start <- start[length(start)]
  if (length(start) < 1L) stop("could not locate the 2012 sector-level annex", call. = FALSE)

  row_pat <- "^\\s*([A-Za-z][A-Za-z'().\\- ]+?)\\s+((?:[0-9][0-9,]*\\.[0-9]\\s+){9}100\\.0)\\s+([0-9,]+)\\s*$"
  agg <- setNames(vector("list", length(districts)), districts)
  for (d in districts) agg[[d]] <- list(pop = 0L, wcount = setNames(rep(0, length(cats_2012)), cats_2012))
  n_sectors <- 0L
  national_row <- NULL
  current <- NA_character_
  for (line in txt[start:length(txt)]) {
    trimmed <- trimws(line)
    if (trimmed %in% districts && !grepl("[0-9]", trimmed)) {
      current <- trimmed
      next
    }
    m <- regmatches(line, regexec(row_pat, line, perl = TRUE))[[1]]
    if (length(m) != 4L) next
    label <- trimws(m[2])
    shares <- as.numeric(strsplit(trimws(m[3]), "\\s+")[[1]][seq_len(length(cats_2012))])
    pop <- as.integer(gsub(",", "", m[4]))
    if (label == "Rwanda") {
      national_row <- shares
      next
    }
    if (is.na(current)) next
    n_sectors <- n_sectors + 1L
    agg[[current]][["pop"]] <- agg[[current]][["pop"]] + pop
    agg[[current]][["wcount"]] <- agg[[current]][["wcount"]] + shares * pop / 100
  }
  list(agg = agg, n_sectors = n_sectors, national_row = national_row)
}

# parse 2022 Table D.1 and read the exact district "Total" row for each district.
# each Total row is: "Total", exact district population, 100, ten two-decimal
# shares. the row is assigned to the most recent bare district-header line.
parse_2022 <- function(pdf_path) {
  txt <- pdf_layout_lines(pdf_path)
  start <- which(grepl("Table D. 1", txt, fixed = TRUE))
  start <- start[length(start)]
  if (length(start) < 1L) stop("could not locate the 2022 sector-level annex", call. = FALSE)

  total_pat <- "^\\s*Total\\s+([0-9,]+)\\s+100\\s+((?:[0-9]+\\.[0-9]+\\s+){9}[0-9]+\\.[0-9]+)\\s*$"
  out <- setNames(vector("list", length(districts)), districts)
  current <- NA_character_
  for (line in txt[start:length(txt)]) {
    trimmed <- trimws(line)
    if (trimmed %in% districts && !grepl("[0-9]", trimmed)) {
      current <- trimmed
      next
    }
    m <- regmatches(line, regexec(total_pat, line, perl = TRUE))[[1]]
    if (length(m) != 3L) next
    if (is.na(current) || !is.null(out[[current]])) next
    pop <- as.integer(gsub(",", "", m[2]))
    shares <- as.numeric(strsplit(trimws(m[3]), "\\s+")[[1]][seq_len(length(cats_2022))])
    out[[current]] <- list(pop = pop, shares = setNames(shares, cats_2022))
    current <- NA_character_
  }
  out
}

# compute the two headline shares from a district's religion counts using the
# stated-response denominator (population minus not stated). affiliation is every
# named religion; no religion is the No Religion category; the two shares sum to
# 100 percent of stated responses.
headline_shares <- function(pop, cat_counts, named_cols) {
  no_rel <- cat_counts[["no_religion"]]
  not_stated <- cat_counts[["not_stated"]]
  named <- sum(cat_counts[named_cols])
  stated <- pop - not_stated
  list(
    affiliation_percent = round(100 * named / stated, 2),
    no_religion_percent = round(100 * no_rel / stated, 2),
    not_stated_share = 100 * not_stated / pop,
    no_religion_share = 100 * no_rel / pop
  )
}

# metric CRS for area computation and metre-tolerance simplification; Lambert
# azimuthal equal area centred on Rwanda keeps every district true.
rwanda_laea <- "+proj=laea +lat_0=-2 +lon_0=29.9 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"

# prepare the district boundary layer from geoBoundaries RWA ADM2.
read_boundary <- function(path) {
  gb <- st_read(path, quiet = TRUE)
  if (nrow(gb) != 30L) stop("expected 30 geoBoundaries RWA ADM2 districts", call. = FALSE)
  gb <- st_make_valid(gb)
  gb_metric <- st_transform(gb, rwanda_laea)
  gb[["area_name"]] <- as.character(gb[["shapeName"]])
  gb[["area_code"]] <- rw_slug(gb[["area_name"]])
  gb[["area_unit_id"]] <- paste0(boundary_set_id, ":", gb[["area_code"]])
  gb[["boundary_set_id"]] <- boundary_set_id
  gb[["boundary_level"]] <- boundary_level
  gb[["shape_id"]] <- as.character(gb[["shapeID"]])
  gb[["land_area_sq_km"]] <- as.numeric(st_area(gb_metric)) / 1e6
  if (any(duplicated(gb[["area_code"]]))) stop("duplicate district area codes", call. = FALSE)
  missing <- setdiff(districts, gb[["area_name"]])
  if (length(missing) > 0L) {
    stop("census districts absent from geoBoundaries: ", paste(missing, collapse = "; "), call. = FALSE)
  }
  gb
}

# build one schema-shaped area-summary row (percent-primary; religion counts are
# not published, so only population_total carries a count).
build_area_row <- function(area_code, area_name, area_unit_id, land_area_sq_km,
                           year, population_total, population_total_basis,
                           affiliation_percent, no_religion_percent,
                           source_ids, quality_flag) {
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = area_unit_id,
    area_code = as.character(area_code),
    area_name = area_name,
    year = year,
    population_total = null_if_na(as.integer(population_total)),
    population_total_basis = population_total_basis,
    religious_affiliation_count = NULL,
    religious_affiliation_percent = null_if_na(affiliation_percent),
    no_religion_count = NULL,
    no_religion_percent = null_if_na(no_religion_percent),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(land_area_sq_km, 2),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = source_ids,
    quality_flag = quality_flag
  )
}

flatten_rows <- function(rows) {
  csv_scalar <- function(value, missing_value) if (is.null(value)) missing_value else value
  do.call(rbind, lapply(rows, function(row) {
    data.frame(
      country_code = row[["country_code"]],
      boundary_set_id = row[["boundary_set_id"]],
      boundary_level = row[["boundary_level"]],
      area_unit_id = row[["area_unit_id"]],
      area_code = row[["area_code"]],
      area_name = row[["area_name"]],
      year = row[["year"]],
      population_total = csv_scalar(row[["population_total"]], NA_integer_),
      population_total_basis = row[["population_total_basis"]],
      religious_affiliation_count = NA_integer_,
      religious_affiliation_percent = csv_scalar(row[["religious_affiliation_percent"]], NA_real_),
      no_religion_count = NA_integer_,
      no_religion_percent = csv_scalar(row[["no_religion_percent"]], NA_real_),
      place_count = NA_integer_,
      places_per_10000_residents = NA_real_,
      place_density_per_sq_km = NA_real_,
      land_area_sq_km = row[["land_area_sq_km"]],
      site_snapshot_date = NA,
      place_count_basis = NA,
      source_dataset_ids = paste(row[["source_dataset_ids"]], collapse = "|"),
      quality_flag = row[["quality_flag"]],
      stringsAsFactors = FALSE
    )
  }))
}

# write the boundary, increasing simplification tolerance until it is small.
write_simplified_boundary <- function(boundary, output_path, field_names) {
  boundary_fields <- boundary[, field_names]
  tolerances <- c(50, 100, 200, 500, 1000, 1500, 2000)
  for (tolerance in tolerances) {
    candidate <- st_transform(boundary_fields, rwanda_laea)
    candidate <- st_simplify(candidate, dTolerance = tolerance, preserveTopology = TRUE)
    candidate <- st_make_valid(st_transform(candidate, 4326))
    if (any(st_is_empty(candidate))) next
    st_write(candidate, output_path, driver = "GeoJSON", delete_dsn = TRUE,
             quiet = TRUE, layer_options = c("COORDINATE_PRECISION=5"))
    bytes <- file_bytes(output_path)
    if (bytes <= 3000000L) return(list(tolerance_m = tolerance, bytes = bytes))
  }
  stop("simplified RW district boundary remains above 3 MB", call. = FALSE)
}

source_datasets <- function() {
  list(
    list(
      source_dataset_id = census_2012_dataset_id,
      name = "NISR RPHC4 (2012) Socio-cultural Characteristics of the Population, Table 26: distribution (%) of the resident population by religious affiliation and sector of residence",
      provider = "National Institute of Statistics of Rwanda (NISR)",
      url = census_2012_url,
      retrieval_date = retrieval_date,
      local_path = census_2012_path,
      licence = list(
        name = "NISR census report, open download; no explicit reuse licence stated",
        url = census_landing_url,
        attribution = "National Institute of Statistics of Rwanda (NISR)"
      ),
      citation = "National Institute of Statistics of Rwanda, Fourth Population and Housing Census (RPHC4) 2012, Thematic Report: Socio-cultural Characteristics of the Population, Table 26.",
      access_limits = NULL,
      redistribution_limits = "The census PDF is not committed; the derived public product attributes NISR and links the source.",
      notes = paste(
        "Table 26 (Annex E) prints nine religion shares (Catholic, Protestant, Adventist, Muslim, Jehovah's Witness,",
        "Traditionalist/Animist, No Religion, Other Religion, Not Stated) and the exact population for each of the 416",
        "sectors. The report carries no district subtotal, so the 416 sectors are aggregated to the 30 districts by",
        "summing the exact sector populations and the population-weighted shares. Sector populations sum exactly to the",
        "printed national total (10,515,973)."
      )
    ),
    list(
      source_dataset_id = census_2022_dataset_id,
      name = "NISR RPHC5 (2022) Social-cultural Characteristics of the Population, Table D.1: distribution (%) of the resident population by religious affiliation and sector of residence",
      provider = "National Institute of Statistics of Rwanda (NISR)",
      url = census_2022_url,
      retrieval_date = retrieval_date,
      local_path = census_2022_path,
      licence = list(
        name = "NISR census report, open download; no explicit reuse licence stated",
        url = census_landing_url,
        attribution = "National Institute of Statistics of Rwanda (NISR)"
      ),
      citation = "National Institute of Statistics of Rwanda, Fifth Population and Housing Census (RPHC5) 2022, Thematic Report: Social-cultural Characteristics of the Population, Table D.1.",
      access_limits = NULL,
      redistribution_limits = "The census PDF is not committed; the derived public product attributes NISR and links the source.",
      notes = paste(
        "Table D.1 (Annex D) prints ten religion shares (adding Other Christians and reordering No Religion after Other",
        "Religion) and, unlike 2012, an exact district Total row per district (two-decimal shares). The 30 district Total",
        "rows are read directly; their populations sum exactly to the printed national total (13,246,394). The 2022",
        "census did collect religion: the religion question was not dropped."
      )
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "geoBoundaries RWA ADM2 (30 districts, 2012)",
      provider = "geoBoundaries (William & Mary geoLab)",
      url = geoboundaries_gj_url,
      retrieval_date = retrieval_date,
      local_path = geoboundaries_path,
      licence = list(
        name = "Creative Commons Attribution 4.0 International (CC BY 4.0); boundary source Open Data Rwanda (NISR geoportal)",
        url = geoboundaries_meta_url,
        attribution = "geoBoundaries (gbOpen); boundary source Open Data Rwanda (NISR)"
      ),
      citation = "Runfola et al., geoBoundaries RWA ADM2 (gbOpen), district boundaries.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary is committed with CC BY 4.0 attribution to geoBoundaries and Open Data Rwanda.",
      notes = "30 ADM2 districts of the post-2006 administrative structure both census waves report on; geoBoundaries records the licence source as statistics.gov.rw/terms-use. No ISO 3166-2 code is published for districts, so the area code is a slug of the district name. Source data update 2023-01-19."
    )
  )
}

denominator_note <- paste(
  "Percentages use the stated-response denominator (district resident population",
  "minus the not-stated count). Religious affiliation is every named religion",
  "(Catholic, Protestant, Adventist, Other Christians in 2022, Muslim, Jehovah's",
  "Witness, Traditionalist/Animist, Other Religion); no religion is the No Religion",
  "category. The two shares sum to 100 percent of stated responses. Religion is",
  "published as percentages, so the product ships percentages with the exact",
  "district population as the denominator; 2012 shares carry one-decimal source",
  "precision (aggregated from sectors), 2022 shares two-decimal precision."
)

indicators_for_district <- function() {
  list(
    list(
      indicator_id = "population_total",
      label = "Census population denominator",
      description = "District resident population. 2012: sum of the exact sector populations in Table 26. 2022: the exact district Total row of Table D.1.",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "2012: sum of Table 26 sector populations. 2022: Table D.1 district Total population.",
      temporal_coverage = "2012, 2022",
      spatial_coverage = "Rwanda districts (geoBoundaries RWA ADM2, 30 post-2006 districts).",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious affiliation %",
      description = "Share of stated responses declaring any named religion.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * (sum of named-religion shares) / (100 - not-stated share), computed in count space over the district population.",
      temporal_coverage = "2012, 2022",
      spatial_coverage = "Rwanda districts (geoBoundaries RWA ADM2).",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "No religion %",
      description = "Share of stated responses reporting no religion (the No Religion category).",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * No Religion / (population - not stated).",
      temporal_coverage = "2012, 2022",
      spatial_coverage = "Rwanda districts (geoBoundaries RWA ADM2).",
      quality_notes = denominator_note
    )
  )
}

visual_layers_for_district <- function() {
  list(
    list(
      visual_layer_id = "rw-district-religious-affiliation",
      label = "Religious affiliation %",
      description = "Rwanda census 2012-2022 religious-affiliation share by district.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "stated responses in the census religion tabulation"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = "All named religions count as religious affiliation in both waves."
    ),
    list(
      visual_layer_id = "rw-district-no-religion",
      label = "No religion %",
      description = "Rwanda census 2012-2022 no-religion share by district.",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "stated responses in the census religion tabulation"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = "The No Religion category of each district in both waves."
    )
  )
}

area_summary_document <- function(rows) {
  list(
    schema_version = "0.2.0",
    generated_at = stamp,
    generated_by = script_id,
    country_code = country_code,
    boundary_set = list(
      boundary_set_id = boundary_set_id,
      country_code = country_code,
      level = boundary_level,
      vintage = "2012",
      source_dataset_id = boundary_dataset_id
    ),
    site_snapshot = list(
      source_dataset_id = NULL,
      snapshot_date = NULL,
      basis = "no governed Rwanda OpenStreetMap place-of-worship snapshot is included in this country data-map release",
      notes = "The Rwanda page exposes census religious-affiliation and no-religion metrics only; place-density metrics are hidden until a governed Rwanda place layer is built."
    ),
    source_datasets = source_datasets(),
    indicators = indicators_for_district(),
    visual_layers = visual_layers_for_district(),
    rows = rows
  )
}

manifest_file_record <- function(path, content, licence_status_value) {
  list(
    uri = paste0("repo:", path),
    storage_provider = "git_repository",
    format = sub("^.*\\.", "", path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    row_count = row_count_file(path),
    content = content,
    privacy = "public",
    licence_status = licence_status_value
  )
}

raw_source_record <- function(path, url, format, row_count, source_id, used, periods, notes) {
  list(
    uri = path, url = url, format = format,
    bytes = if (file.exists(path)) file_bytes(path) else NULL,
    sha256 = if (file.exists(path)) sha256_file(path) else NULL,
    row_count = row_count, source_dataset_id = source_id,
    used_in_public_product = used, periods = periods, notes = notes
  )
}

# ---- require raw sources ----
required_sources <- c(census_2012_path, census_2022_path, geoboundaries_path)
invisible(lapply(required_sources, require_file))

# ---- parse both waves ----
parsed_2012 <- parse_2012(census_2012_path)
if (parsed_2012[["n_sectors"]] != 416L) {
  stop("expected 416 sectors in the 2012 table, parsed ", parsed_2012[["n_sectors"]], call. = FALSE)
}
pop_2012 <- vapply(districts, function(d) parsed_2012[["agg"]][[d]][["pop"]], numeric(1))
if (sum(pop_2012) != national_2012_pop) {
  stop("2012 district populations do not sum to the printed national total", call. = FALSE)
}

parsed_2022 <- parse_2022(census_2022_path)
missing_2022 <- districts[vapply(districts, function(d) is.null(parsed_2022[[d]]), logical(1))]
if (length(missing_2022) > 0L) {
  stop("2022 district Total rows not found for: ", paste(missing_2022, collapse = "; "), call. = FALSE)
}
pop_2022 <- vapply(districts, function(d) parsed_2022[[d]][["pop"]], numeric(1))
if (sum(pop_2022) != national_2022_pop) {
  stop("2022 district populations do not sum to the printed national total", call. = FALSE)
}

# ---- per-district headline shares ----
shares_2012 <- lapply(districts, function(d) {
  a <- parsed_2012[["agg"]][[d]]
  headline_shares(a[["pop"]], a[["wcount"]], named_2012)
})
names(shares_2012) <- districts
shares_2022 <- lapply(districts, function(d) {
  t <- parsed_2022[[d]]
  cat_counts <- t[["shares"]] / 100 * t[["pop"]]
  headline_shares(t[["pop"]], cat_counts, named_2022)
})
names(shares_2022) <- districts

# ---- national cross-checks (aggregate reproduces the printed national row) ----
nat_2012_no_rel <- 100 * sum(vapply(districts, function(d) parsed_2012[["agg"]][[d]][["wcount"]][["no_religion"]], numeric(1))) / national_2012_pop
nat_2012_not_stated <- 100 * sum(vapply(districts, function(d) parsed_2012[["agg"]][[d]][["wcount"]][["not_stated"]], numeric(1))) / national_2012_pop
if (abs(nat_2012_no_rel - national_2012_printed[["no_religion"]]) > 0.15) {
  stop("2012 aggregated no-religion share does not reproduce the printed national value", call. = FALSE)
}
if (abs(nat_2012_not_stated - national_2012_printed[["not_stated"]]) > 0.15) {
  stop("2012 aggregated not-stated share does not reproduce the printed national value", call. = FALSE)
}
nat_2022_no_rel <- 100 * sum(vapply(districts, function(d) (parsed_2022[[d]][["shares"]][["no_religion"]] / 100) * parsed_2022[[d]][["pop"]], numeric(1))) / national_2022_pop
nat_2022_not_stated <- 100 * sum(vapply(districts, function(d) (parsed_2022[[d]][["shares"]][["not_stated"]] / 100) * parsed_2022[[d]][["pop"]], numeric(1))) / national_2022_pop
if (abs(nat_2022_no_rel - national_2022_no_religion_printed) > 0.05) {
  stop("2022 aggregated no-religion share does not reproduce the printed national value", call. = FALSE)
}
if (abs(nat_2022_not_stated - national_2022_not_stated_printed) > 0.05) {
  stop("2022 aggregated not-stated share does not reproduce the printed national value", call. = FALSE)
}

# ---- boundary ----
boundary <- read_boundary(geoboundaries_path)
boundary_write <- write_simplified_boundary(
  boundary, boundary_out,
  c("area_code", "area_name", "area_unit_id", "boundary_set_id",
    "boundary_level", "shape_id", "land_area_sq_km")
)
if (row_count_file(boundary_out) != nrow(boundary)) {
  stop("district boundary feature count changed during simplification", call. = FALSE)
}

# ---- assemble rows: 2012 then 2022, districts in area-name order ----
basis_2012 <- paste(
  "district resident population summed from the exact sector populations in the",
  "RPHC4 Table 26 religion tabulation; the stated-response denominator for the",
  "percentages excludes the not-stated count. Religion shares are aggregated from",
  "one-decimal sector shares, so the district shares carry one-decimal source",
  "precision"
)
basis_2022 <- paste(
  "district resident population from the exact RPHC5 Table D.1 district Total row;",
  "the stated-response denominator for the percentages excludes the not-stated",
  "count. Religion shares carry two-decimal source precision"
)
flag_2012 <- paste(
  "stated_response_denominator_excludes_not_stated",
  "named_religions_in_religious_affiliation",
  "no_religion_category_is_no_religion",
  "aggregated_from_sector_shares_one_decimal_precision",
  "sector_populations_reconcile_to_national_total",
  sep = ";"
)
flag_2022 <- paste(
  "stated_response_denominator_excludes_not_stated",
  "named_religions_in_religious_affiliation",
  "no_religion_category_is_no_religion",
  "district_total_row_two_decimal_precision",
  "district_populations_reconcile_to_national_total",
  sep = ";"
)

order_idx <- order(boundary[["area_name"]])
rows <- list()
for (i in order_idx) {
  d <- boundary[["area_name"]][i]
  s <- shares_2012[[d]]
  rows[[length(rows) + 1L]] <- build_area_row(
    area_code = boundary[["area_code"]][i], area_name = d,
    area_unit_id = boundary[["area_unit_id"]][i], land_area_sq_km = boundary[["land_area_sq_km"]][i],
    year = 2012L, population_total = pop_2012[[d]], population_total_basis = basis_2012,
    affiliation_percent = s[["affiliation_percent"]], no_religion_percent = s[["no_religion_percent"]],
    source_ids = c(census_2012_dataset_id, boundary_dataset_id), quality_flag = flag_2012
  )
}
for (i in order_idx) {
  d <- boundary[["area_name"]][i]
  s <- shares_2022[[d]]
  rows[[length(rows) + 1L]] <- build_area_row(
    area_code = boundary[["area_code"]][i], area_name = d,
    area_unit_id = boundary[["area_unit_id"]][i], land_area_sq_km = boundary[["land_area_sq_km"]][i],
    year = 2022L, population_total = pop_2022[[d]], population_total_basis = basis_2022,
    affiliation_percent = s[["affiliation_percent"]], no_religion_percent = s[["no_religion_percent"]],
    source_ids = c(census_2022_dataset_id, boundary_dataset_id), quality_flag = flag_2022
  )
}

write_json(area_summary_document(rows), summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

join_coverage <- lapply(years, function(y) {
  list(boundary_level = boundary_level, year = y,
       matched_area_count = 30L, expected_area_count = nrow(boundary),
       missing_area_names = list())
})

national_reconciliation <- list(
  list(year = 2012L, metric = "population_total", area_sum = sum(pop_2012),
       national_total = national_2012_pop, difference = sum(pop_2012) - national_2012_pop),
  list(year = 2022L, metric = "population_total", area_sum = sum(pop_2022),
       national_total = national_2022_pop, difference = sum(pop_2022) - national_2022_pop)
)

validation_checks <- c(
  "The 2012 wave aggregates the 416 sectors of RPHC4 Table 26 to the 30 districts by summing the exact sector populations and the population-weighted religion shares; the report carries no district subtotal row.",
  sprintf("The 2012 sector populations sum exactly to the printed national total (%d) and the aggregate reproduces the printed national no-religion (%.2f vs 2.5) and not-stated (%.2f vs 1.3) shares.", national_2012_pop, nat_2012_no_rel, nat_2012_not_stated),
  "The 2022 wave reads the exact district Total row of RPHC5 Table D.1 for each of the 30 districts (two-decimal shares).",
  sprintf("The 2022 district populations sum exactly to the printed national total (%d) and the aggregate reproduces the printed national no-religion (%.2f vs 3.04) and not-stated (%.2f vs 0.13) shares.", national_2022_pop, nat_2022_no_rel, nat_2022_not_stated),
  "The 2022 census did collect religion: RPHC5 asked the religion question with ten modalities (Catholic, Protestant, Adventist, Other Christians, Muslim, Jehovah's Witness, Traditionalist/Animist, Other Religion, No Religion, Not Stated). The premise that 2022 dropped religion is incorrect.",
  "Percentages use the stated-response denominator (district population minus not stated); religious affiliation (all named religions) and no religion sum to 100 percent of stated responses.",
  "All 30 census districts join to the 30 geoBoundaries RWA ADM2 features by name for both waves, with no name fixes needed (the Kigali City districts Nyarugenge, Gasabo, Kicukiro and the near-homographs Rulindo, Ruhango, Rutsiro, Rusizi all match exactly).",
  sprintf("The simplified district boundary GeoJSON writes to %d bytes after %d m simplification (30 district features).", as.integer(boundary_write[["bytes"]]), boundary_write[["tolerance_m"]]),
  "The 2002 census (RPHC3) is deferred: it enumerated religion on the pre-2006 twelve-prefecture geography, which does not join to the 30-district structure; the 1978-2022 national religion trend is recorded in both thematic reports."
)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:rw-census-religion:rw:2012-2022:nisr-socio-cultural-reports",
  dataset_id = "rw-census-religion:rw:2012-2022:nisr-socio-cultural-reports",
  dataset_version_id = paste0("rw-census-religion:rw:2012-2022:nisr-socio-cultural-reports:", substr(sha256_file(summary_json_out), 1, 12)),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "rw-census-religion",
  dataset_role = "public_product",
  scope = list(level = "country", country_codes = list(country_code),
               snapshot_date = NULL, snapshot_anchor = NULL, pipeline_stage = "public"),
  created_at = stamp,
  created_by = script_id,
  pipeline = list(
    script = script_id,
    git_commit = NULL,
    command = paste("Rscript", script_id),
    parameters = list(
      waves = c("2012", "2022"),
      district_boundary_set = boundary_set_id,
      district_boundary_simplification_tolerance_m = boundary_write[["tolerance_m"]],
      pdf_extraction = "poppler pdftotext -layout; 2012 Table 26 sectors aggregated to districts, 2022 Table D.1 district Total rows read directly",
      denominator = "stated responses (district population minus not stated); affiliation = named religions, no religion = No Religion category",
      subnational_geography = "geoBoundaries RWA ADM2 (30 post-2006 districts) both census waves report on",
      omitted_metrics = c("religious_change", "places_per_10000_residents", "place_density_per_sq_km"),
      counts_published = "religion is published as percentages; the product ships percentages with the exact district population as denominator"
    ),
    software_versions = list(
      r = paste(R.version[["major"]], R.version[["minor"]], sep = "."),
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")),
      pdftotext = "poppler pdftotext (system)"
    )
  ),
  source = list(
    provider = "National Institute of Statistics of Rwanda (NISR); geoBoundaries (William & Mary geoLab)",
    source_dataset_ids = c(census_2012_dataset_id, census_2022_dataset_id, boundary_dataset_id),
    source_urls = c(census_2012_url, census_2022_url, main_indicators_2022_url, geoboundaries_meta_url, geoboundaries_gj_url),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = licence_text,
    citation = "NISR, RPHC4 2012 Socio-cultural Characteristics of the Population, Table 26; NISR, RPHC5 2022 Social-cultural Characteristics of the Population, Table D.1; geoBoundaries RWA ADM2 (gbOpen).",
    raw_redistribution = "The census PDFs and the geoBoundaries source GeoJSON are not committed. They remain in data/raw/rw_census/ and await any project-controlled raw archive upload."
  ),
  input_manifests = list(),
  raw_sources = list(
    raw_source_record(census_2012_path, census_2012_url, "pdf", 416L, census_2012_dataset_id, TRUE, "2012",
      "RPHC4 2012 Socio-cultural Characteristics report; Table 26 supplies the 416 sector religion shares and populations, aggregated to 30 districts."),
    raw_source_record(census_2022_path, census_2022_url, "pdf", 30L, census_2022_dataset_id, TRUE, "2022",
      "RPHC5 2022 Social-cultural Characteristics report; Table D.1 supplies the 30 exact district Total rows (ten religion shares) read directly."),
    raw_source_record(geoboundaries_path, geoboundaries_gj_url, "geojson", 30L, boundary_dataset_id, TRUE, "2012",
      "geoBoundaries RWA ADM2 GeoJSON; 30 district features. CC BY 4.0, boundary source Open Data Rwanda (NISR geoportal)."),
    raw_source_record(geoboundaries_meta_path, geoboundaries_meta_url, "json", NA_integer_, boundary_dataset_id, FALSE, "2012",
      "geoBoundaries RWA ADM2 metadata; records the CC BY 4.0 licence and the Open Data Rwanda boundary source (licence source statistics.gov.rw/terms-use).")
  ),
  durable_files = list(
    manifest_file_record(summary_json_out, "Rwanda district area summary with census 2012 and 2022 religious-affiliation and no-religion metrics.", licence_status),
    manifest_file_record(summary_csv_out, "Flattened Rwanda district area summary with census 2012 and 2022 religious-affiliation and no-religion metrics.", licence_status),
    manifest_file_record(boundary_out, "Simplified Rwanda district boundary GeoJSON derived from geoBoundaries RWA ADM2 (30 districts).", "geoboundaries_cc_by_4_0")
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out),
         built_by = script_id, notes = "30 district reporting units x 2 census years (2012, 2022); stated-response denominator, percent-primary."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out),
         built_by = script_id, notes = sprintf("30 geoBoundaries RWA ADM2 district features simplified at %d m tolerance.", boundary_write[["tolerance_m"]]))
  ),
  validation = list(
    checks = validation_checks,
    join_coverage = list(district = join_coverage),
    national_reconciliation = national_reconciliation,
    national_excluded_share_percent = round(nat_2012_not_stated, 2),
    boundary_validation = list(
      source_rw_district_count = 30L,
      output_feature_count = row_count_file(boundary_out),
      expected_feature_count = nrow(boundary),
      output_bytes = boundary_write[["bytes"]],
      simplification_tolerance_m = boundary_write[["tolerance_m"]],
      unmatched_boundary_features = list(),
      unmatched_census_areas = list()
    )
  ),
  construct_notes = list(
    "The public map displays two headline metrics for 2012 and 2022 at district level: religious affiliation percent and no religion percent.",
    "Percentages use the stated-response denominator: district resident population minus the not-stated count. Religious affiliation is every named religion; no religion is the No Religion category. The two shares sum to 100 percent of stated responses.",
    "2012 (RPHC4 Table 26) prints nine religion shares and the exact population for each of the 416 sectors, with no district subtotal; the sectors are aggregated to the 30 districts by summing the exact populations and the population-weighted shares, so 2012 district shares carry one-decimal source precision.",
    "2022 (RPHC5 Table D.1) adds Other Christians (ten modalities) and prints an exact district Total row per district (two-decimal shares), read directly. The 2022 religion question was not dropped.",
    "Religion is published as percentages in both reports, so the product ships percentages with the exact district population as the denominator; no religion counts are published, so the count fields are null.",
    "The 2002 census (RPHC3) enumerated religion on the pre-2006 twelve-prefecture geography, which the 2006 reform replaced with five provinces and thirty districts; 2002 does not join the modern district set and is deferred pending a re-tabulation on modern boundaries."
  ),
  deferred_sources = list(
    list(
      source_dataset_id = "nisr-rphc3-2002-religion-by-prefecture",
      url = census_landing_url,
      local_path = NULL,
      notes = "The 2002 census (RPHC3) tabulated religion on the pre-2006 twelve-prefecture geography. The 2006 territorial reform replaced the twelve prefectures with five provinces and thirty districts, so the 2002 subnational religion tables do not join the modern 30-district boundary set. A 2002 wave is deferred pending a re-tabulation of the 2002 microdata on modern boundaries (or a prefecture-to-district concordance); the 1978-2022 national religion trend is recorded in both thematic reports."
    ),
    list(
      source_dataset_id = "rwanda-data-portal-religion-series",
      url = "https://rwanda.opendataforafrica.org/",
      local_path = NULL,
      notes = "The Rwanda Data Portal (opendataforafrica.org) lists a census religion series for 2012 and 2022; it was not used because the NISR thematic reports are the authoritative source of record and reconcile exactly. Recorded as an alternative machine-readable access point."
    )
  ),
  privacy = "public",
  licence_status = licence_status,
  downstream_status = "public",
  source_datasets = source_datasets(),
  notes = "The committed products contain the derived district area summary and simplified boundary only. On-page attribution cites NISR and geoBoundaries (CC BY 4.0, Open Data Rwanda)."
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
manifest_text <- paste(readLines(manifest_out, warn = FALSE), collapse = "\n")
if (!jsonlite::validate(manifest_text)) stop("manifest JSON failed jsonlite validation", call. = FALSE)

cat(sprintf("wrote %s: %d rows\n", summary_json_out, length(rows)))
cat(sprintf("wrote %s: %d rows\n", summary_csv_out, row_count_file(summary_csv_out)))
cat(sprintf("wrote %s: %d features, %d bytes at %d m\n", boundary_out, row_count_file(boundary_out),
            as.integer(file_bytes(boundary_out)), boundary_write[["tolerance_m"]]))
cat(sprintf("wrote %s\n", manifest_out))
cat(sprintf("join coverage: 30/30 districts for 2012 and 2022\n"))
cat(sprintf("2012 national: pop %d; no religion %.2f%% of total; not stated %.2f%% of total\n",
            national_2012_pop, nat_2012_no_rel, nat_2012_not_stated))
cat(sprintf("2022 national: pop %d; no religion %.2f%% of total; not stated %.2f%% of total\n",
            national_2022_pop, nat_2022_no_rel, nat_2022_not_stated))
cat("national reconciliation: exact for the 2012 and 2022 district populations\n")
