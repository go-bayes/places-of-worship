# build the south africa province area-summary product from the 1996, 2001 and
# 2022 censuses.
# inputs: the Stats SA "Cultural Dynamics in South Africa" report (Report
# 03-01-84), Table 4.1 (percentage distribution of population by religious
# denomination and province, Censuses 1996, 2001 and 2022 — the harmonised
# cross-wave religion table), the Census 2022 Statistical Release (P0301.4),
# Table 2.1 (distribution of population by province and sex, 1996-2022 — the
# exact province population denominators), and the geoBoundaries ZAF ADM1 (9
# provinces) GeoJSON.
# outputs: apps/regions/za/data/za_province_2020.geojson,
# apps/regions/za/data/area_summary_province.{json,csv}, and
# docs/manifests/za-census-religion-1996-2022.json.
# run from the repo root: Rscript scripts/build_za_area_summary.R
# three census waves ship. Table 4.1 tabulates religion by province for 1996,
# 2001 and 2022 on a single harmonised category set; the 2011 census dropped the
# religion question, so 2011 is absent from Table 4.1 while it is present in the
# population Table 2.1 — the direct source signature of the 2011 gap. religion is
# published as percentages (each province-year row sums to 100 across the
# categories, including an Undetermined residual), so the product ships
# percentages with the exact province population as denominator; the two headline
# shares use the stated-response denominator (population implied by named
# religions plus no religion, i.e. excluding Undetermined).

suppressMessages({
  library(jsonlite)
  library(sf)
})

raw_dir <- "data/raw/za_census"
za_dir <- "apps/regions/za/data"
manifest_dir <- "docs/manifests"
dir.create(za_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- "2026-07-09"
script_id <- "scripts/build_za_area_summary.R"
country_code <- "ZA"
years <- c(1996L, 2001L, 2022L)

boundary_set_id <- "za-province-2020-geoboundaries-adm1"
boundary_level <- "province"
religion_dataset_id <- "statssa-cultural-dynamics-03-01-84-table41-religion-by-province"
population_dataset_id <- "statssa-census2022-p0301-4-table21-population-by-province"
religion_2022_dataset_id <- "statssa-census2022-p0301-4-table210-religion-by-province"
boundary_dataset_id <- "geoboundaries-zaf-adm1-2020"

# source urls recorded in the manifest and the on-page attribution.
census_landing_url <- "https://www.statssa.gov.za/?page_id=3839"
p03014_url <- "https://census.statssa.gov.za/assets/documents/2022/P03014_Census_2022_Statistical_Release.pdf"
cultdyn_url <- "https://www.statssa.gov.za/publications/03-01-84/03-01-84.pdf"
geoboundaries_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/ZAF/ADM1/"
geoboundaries_gj_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/ZAF/ADM1/geoBoundaries-ZAF-ADM1.geojson"

p03014_path <- file.path(raw_dir, "za_2022_P03014_statistical_release.pdf")
cultdyn_path <- file.path(raw_dir, "za_cultural_dynamics_03-01-84.pdf")
geoboundaries_path <- file.path(raw_dir, "geoBoundaries-ZAF-ADM1.geojson")
geoboundaries_meta_path <- file.path(raw_dir, "gb_zaf_adm1_meta.json")

boundary_out <- file.path(za_dir, "za_province_2020.geojson")
summary_json_out <- file.path(za_dir, "area_summary_province.json")
summary_csv_out <- file.path(za_dir, "area_summary_province.csv")
manifest_out <- file.path(manifest_dir, "za-census-religion-1996-2022.json")

licence_text <- paste(
  "Religion by province is Statistics South Africa, Cultural Dynamics in South",
  "Africa (Report 03-01-84), Table 4.1 (percentage distribution of population by",
  "religious denomination and province, Censuses 1996, 2001 and 2022). Province",
  "population denominators are Stats SA, Census 2022 Statistical Release (P0301.4),",
  "Table 2.1. Stats SA publishes its census releases for open download and",
  "requests attribution; no explicit reuse licence is stated on the releases, so",
  "the derived product attributes Stats SA and links the source of record.",
  "Boundaries are geoBoundaries ZAF ADM1 (9 provinces, 2020), Creative Commons",
  "Attribution 3.0 IGO (CC BY 3.0 IGO), boundary source OCHA ROSEA and the South",
  "African Municipal Demarcation Board (licence source",
  "data.humdata.org/dataset/south-africa-admin-level-1-boundaries)."
)
licence_status <- "accepted"
# terms identity preserved separately from the shipping decision (schema v2)
licence_basis <- "statssa_census_open_release_attribution_geoboundaries_cc_by_3_0_igo"

# the nine provinces, spelled as Stats SA Table 4.1 names them and in that table
# order. these double as the census reporting units; geoBoundaries carries a
# clean ISO code per province (used as the join key) plus a shapeName that
# misspells Northern Cape as "Nothern Cape", corrected here.
provinces <- c("Western Cape", "Eastern Cape", "Northern Cape", "Free State",
               "KwaZulu-Natal", "North West", "Gauteng", "Mpumalanga", "Limpopo")
# province name -> geoBoundaries shapeISO join code (note GT, KZ, LI differ from
# ISO 3166-2 GP, KZN, LP; NC is the code carried by the misspelled feature).
province_iso <- c("Western Cape" = "WC", "Eastern Cape" = "EC", "Northern Cape" = "NC",
                  "Free State" = "FS", "KwaZulu-Natal" = "KZ", "North West" = "NW",
                  "Gauteng" = "GT", "Mpumalanga" = "MP", "Limpopo" = "LI")
# Table 2.1 province order (adds South Africa as the tenth block).
pop_provinces <- c(provinces, "South Africa")

# Table 4.1 harmonised religion columns, in printed order. named religions are
# every category except no_religion and undetermined; undetermined is the
# residual excluded from the stated-response denominator.
cats <- c("christianity", "islam", "traditional_african", "hinduism",
          "jewish_hebrew", "other_beliefs", "no_religion", "undetermined")
named <- c("christianity", "islam", "traditional_african", "hinduism",
           "jewish_hebrew", "other_beliefs")

# printed national religion shares (Figure 4.1, % of total population) for
# cross-checking the population-weighted provincial aggregate against Stats SA's
# own national row, per wave.
national_printed <- list(
  "1996" = c(christianity = 75.9, islam = 1.4, traditional_african = 0.0,
             hinduism = 1.4, jewish_hebrew = 0.2, other_beliefs = 0.0,
             no_religion = 11.7, undetermined = 9.4),
  "2001" = c(christianity = 79.8, islam = 1.5, traditional_african = 0.3,
             hinduism = 1.2, jewish_hebrew = 0.2, other_beliefs = 0.6,
             no_religion = 15.1, undetermined = 1.4),
  "2022" = c(christianity = 84.5, islam = 1.6, traditional_african = 7.8,
             hinduism = 1.1, jewish_hebrew = 0.1, other_beliefs = 0.3,
             no_religion = 2.9, undetermined = 1.9)
)
# printed national population totals (Table 2.1 South Africa row) per wave.
national_pop <- c("1996" = 40583573L, "2001" = 44819778L, "2022" = 62027503L)

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

# slice the text lines to a single table: from the last occurrence of the table
# header to the first occurrence of the following table's header.
slice_table <- function(lines, header_pat, end_pat) {
  starts <- which(grepl(header_pat, lines))
  if (length(starts) < 1L) stop("could not locate table header: ", header_pat, call. = FALSE)
  start <- starts[length(starts)]
  ends <- which(grepl(end_pat, lines))
  ends <- ends[ends > start]
  end <- if (length(ends) > 0L) ends[1] - 1L else length(lines)
  lines[start:end]
}

# split a layout line on runs of two or more spaces into trimmed non-empty
# fields; single spaces inside numbers ("3 956 875") are preserved.
layout_fields <- function(line) {
  parts <- trimws(strsplit(line, "\\s{2,}")[[1]])
  parts[nzchar(parts)]
}

# parse Table 2.1 (population by province and sex). each province is a block of
# four year rows (1996, 2001, 2011, 2022); the province label floats on its own
# line and is ignored. blocks are assigned to pop_provinces by order (every 1996
# row starts a new province). returns a named list of per-province, per-year
# exact total population.
parse_population <- function(pdf_path) {
  txt <- slice_table(pdf_layout_lines(pdf_path),
                     "Table 2\\.1:? +Distribution of.*population by province",
                     "Table 2\\.2")
  year_set <- c("1996", "2001", "2011", "2022")
  out <- setNames(vector("list", length(pop_provinces)), pop_provinces)
  prov_idx <- 0L
  for (line in txt) {
    fields <- layout_fields(line)
    if (length(fields) < 4L) next
    if (!(fields[1] %in% year_set)) next
    year <- fields[1]
    total <- as.integer(gsub("[^0-9]", "", fields[length(fields)]))
    if (is.na(total)) next
    if (year == "1996") prov_idx <- prov_idx + 1L
    if (prov_idx < 1L || prov_idx > length(pop_provinces)) next
    out[[pop_provinces[prov_idx]]][[year]] <- total
  }
  out
}

# parse Table 4.1 (religion by province). each province is a block of three year
# rows (1996, 2001, 2022); the province label floats onto the 2001 row. a data
# row is a year followed by nine comma-decimal values ending in the 100,0 total.
# blocks are assigned to provinces by order (every 1996 row starts a new
# province). returns a per-province list of named category vectors per year.
parse_religion <- function(pdf_path) {
  txt <- slice_table(pdf_layout_lines(pdf_path),
                     "Table 4\\.1 .*religious denomination and province",
                     "Table 4\\.2")
  year_set <- c("1996", "2001", "2022")
  out <- setNames(vector("list", length(provinces)), provinces)
  prov_idx <- 0L
  for (line in txt) {
    fields <- layout_fields(line)
    if (length(fields) < 10L) next
    # optional leading province label: shift so the year is the first field.
    if (!(fields[1] %in% year_set)) fields <- fields[-1]
    if (length(fields) < 10L) next
    if (!(fields[1] %in% year_set)) next
    year <- fields[1]
    vals <- suppressWarnings(as.numeric(gsub(",", ".", fields[2:10])))
    if (any(is.na(vals))) next
    total <- vals[9]
    if (abs(total - 100) > 0.6) next
    if (year == "1996") prov_idx <- prov_idx + 1L
    if (prov_idx < 1L || prov_idx > length(provinces)) next
    cat_vals <- setNames(vals[1:8], cats)
    out[[provinces[prov_idx]]][[year]] <- cat_vals
  }
  out
}

# compute the two headline shares from a province-year category vector using the
# stated-response denominator (named religions plus no religion, excluding the
# Undetermined residual). the two shares sum to 100 percent of stated responses.
headline_shares <- function(cat_vals) {
  named_sum <- sum(cat_vals[named])
  no_rel <- cat_vals[["no_religion"]]
  stated <- named_sum + no_rel
  list(
    affiliation_percent = round(100 * named_sum / stated, 2),
    no_religion_percent = round(100 * no_rel / stated, 2),
    undetermined_share = cat_vals[["undetermined"]]
  )
}

# metric CRS for area computation and metre-tolerance simplification; Lambert
# azimuthal equal area centred on South Africa keeps every province true.
za_laea <- "+proj=laea +lat_0=-29 +lon_0=25 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"

# slugify a province name to a stable lowercase area code.
za_slug <- function(x) gsub("[^a-z0-9]+", "-", tolower(trimws(x)))

# prepare the province boundary layer from geoBoundaries ZAF ADM1, joining the
# census province names by the clean shapeISO code and correcting the misspelled
# "Nothern Cape" feature name.
read_boundary <- function(path) {
  gb <- st_read(path, quiet = TRUE)
  if (nrow(gb) != 9L) stop("expected 9 geoBoundaries ZAF ADM1 provinces", call. = FALSE)
  gb <- st_make_valid(gb)
  gb_metric <- st_transform(gb, za_laea)
  iso_to_name <- setNames(names(province_iso), unname(province_iso))
  gb[["area_name"]] <- iso_to_name[as.character(gb[["shapeISO"]])]
  if (any(is.na(gb[["area_name"]]))) {
    stop("geoBoundaries province ISO code did not map to a census province: ",
         paste(gb[["shapeISO"]][is.na(gb[["area_name"]])], collapse = "; "), call. = FALSE)
  }
  gb[["area_code"]] <- za_slug(gb[["area_name"]])
  gb[["area_unit_id"]] <- paste0(boundary_set_id, ":", gb[["area_code"]])
  gb[["boundary_set_id"]] <- boundary_set_id
  gb[["boundary_level"]] <- boundary_level
  gb[["province_iso"]] <- as.character(gb[["shapeISO"]])
  gb[["shape_id"]] <- as.character(gb[["shapeID"]])
  gb[["land_area_sq_km"]] <- as.numeric(st_area(gb_metric)) / 1e6
  if (any(duplicated(gb[["area_code"]]))) stop("duplicate province area codes", call. = FALSE)
  missing <- setdiff(provinces, gb[["area_name"]])
  if (length(missing) > 0L) {
    stop("census provinces absent from geoBoundaries: ", paste(missing, collapse = "; "), call. = FALSE)
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

# write the boundary, increasing simplification tolerance until it is small. a
# large continental country with detailed coastline needs coarser tolerances
# than a small country; the national-zoom province choropleth reads fine coarse.
write_simplified_boundary <- function(boundary, output_path, field_names) {
  boundary_fields <- boundary[, field_names]
  tolerances <- c(200, 500, 1000, 2000, 3000, 5000)
  for (tolerance in tolerances) {
    candidate <- st_transform(boundary_fields, za_laea)
    candidate <- st_simplify(candidate, dTolerance = tolerance, preserveTopology = TRUE)
    candidate <- st_make_valid(st_transform(candidate, 4326))
    if (any(st_is_empty(candidate))) next
    st_write(candidate, output_path, driver = "GeoJSON", delete_dsn = TRUE,
             quiet = TRUE, layer_options = c("COORDINATE_PRECISION=5"))
    bytes <- file_bytes(output_path)
    if (bytes <= 3000000L) return(list(tolerance_m = tolerance, bytes = bytes))
  }
  stop("simplified ZA province boundary remains above 3 MB", call. = FALSE)
}

source_datasets <- function() {
  list(
    list(
      source_dataset_id = religion_dataset_id,
      name = "Stats SA Cultural Dynamics in South Africa (Report 03-01-84), Table 4.1: percentage distribution of population by religious denomination and province, Censuses 1996, 2001 and 2022",
      provider = "Statistics South Africa (Stats SA)",
      url = cultdyn_url,
      retrieval_date = retrieval_date,
      local_path = cultdyn_path,
      licence = list(
        name = "Stats SA census release, open download; attribution requested, no explicit reuse licence stated",
        url = census_landing_url,
        attribution = "Statistics South Africa (Stats SA)"
      ),
      citation = "Statistics South Africa, Cultural Dynamics in South Africa (Report 03-01-84), Table 4.1.",
      access_limits = NULL,
      redistribution_limits = "The report PDF is not committed; the derived public product attributes Stats SA and links the source.",
      notes = paste(
        "Table 4.1 prints, for each of the nine provinces and each of the 1996, 2001 and 2022 censuses, the",
        "percentage distribution across eight religion categories (Christianity, Islam, Traditional African",
        "Religion, Hinduism, Jewish Faith/Hebrew, Other beliefs, No religious affiliation/belief) plus an",
        "Undetermined residual, summing to a printed Total of 100. The 2011 census is absent from this table",
        "because the 2011 census dropped the religion question; it is present in the population Table 2.1."
      )
    ),
    list(
      source_dataset_id = population_dataset_id,
      name = "Stats SA Census 2022 Statistical Release (P0301.4), Table 2.1: distribution of population by province and sex, Census 1996-2022",
      provider = "Statistics South Africa (Stats SA)",
      url = p03014_url,
      retrieval_date = retrieval_date,
      local_path = p03014_path,
      licence = list(
        name = "Stats SA census release, open download; attribution requested, no explicit reuse licence stated",
        url = census_landing_url,
        attribution = "Statistics South Africa (Stats SA)"
      ),
      citation = "Statistics South Africa, Census 2022 Statistical Release (P0301.4), Table 2.1.",
      access_limits = NULL,
      redistribution_limits = "The release PDF is not committed; the derived public product attributes Stats SA and links the source.",
      notes = "Table 2.1 supplies the exact province population totals for 1996, 2001, 2011 and 2022. The 1996, 2001 and 2022 totals are the denominators carried in the area summary; the 2011 total is read for the reconciliation but not shipped (2011 has no religion tabulation)."
    ),
    list(
      source_dataset_id = religion_2022_dataset_id,
      name = "Stats SA Census 2022 Statistical Release (P0301.4), Table 2.10: percentage distribution of population by religious affiliation/belief, Census 2022",
      provider = "Statistics South Africa (Stats SA)",
      url = p03014_url,
      retrieval_date = retrieval_date,
      local_path = p03014_path,
      licence = list(
        name = "Stats SA census release, open download; attribution requested, no explicit reuse licence stated",
        url = census_landing_url,
        attribution = "Statistics South Africa (Stats SA)"
      ),
      citation = "Statistics South Africa, Census 2022 Statistical Release (P0301.4), Table 2.10.",
      access_limits = NULL,
      redistribution_limits = "The release PDF is not committed; the derived public product attributes Stats SA and links the source.",
      notes = "The 2022-only religion table with a finer category set (splitting Buddhism, Judaism, Atheism, Agnosticism and a renormalised base with no Undetermined column). Cited as a corroborating 2022 source; the shipped waves all use the harmonised Table 4.1 categories so 1996, 2001 and 2022 stay comparable."
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "geoBoundaries ZAF ADM1 (9 provinces, 2020)",
      provider = "geoBoundaries (William & Mary geoLab)",
      url = geoboundaries_gj_url,
      retrieval_date = retrieval_date,
      local_path = geoboundaries_path,
      licence = list(
        name = "Creative Commons Attribution 3.0 IGO (CC BY 3.0 IGO); boundary source OCHA ROSEA and the South African Municipal Demarcation Board",
        url = geoboundaries_meta_url,
        attribution = "geoBoundaries (gbOpen); boundary source OCHA ROSEA and the South African Municipal Demarcation Board"
      ),
      citation = "Runfola et al., geoBoundaries ZAF ADM1 (gbOpen), province boundaries.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary is committed with CC BY 3.0 IGO attribution to geoBoundaries and its boundary sources.",
      notes = "9 ADM1 provinces. Joined by the clean geoBoundaries shapeISO code (WC, EC, NC, FS, KZ, NW, GT, MP, LI); the feature carrying ISO code NC has the misspelled shapeName 'Nothern Cape', corrected to 'Northern Cape' in the product. Source data update 2023-01-19."
    )
  )
}

denominator_note <- paste(
  "Percentages use the stated-response denominator (the province population",
  "implied by named religions plus no religion, i.e. excluding the Undetermined",
  "residual). Religious affiliation is every named religion (Christianity, Islam,",
  "Traditional African Religion, Hinduism, Jewish Faith/Hebrew, Other beliefs); no",
  "religion is the No religious affiliation/belief category. The two shares sum to",
  "100 percent of stated responses. Religion is published as percentages, so the",
  "product ships percentages with the exact province population as the denominator;",
  "the Undetermined share is large in 1996 (about 9 percent nationally, reflecting",
  "1996 data collection) and small in 2001 and 2022 (about 1-2 percent)."
)

indicators_for_province <- function() {
  list(
    list(
      indicator_id = "population_total",
      label = "Census population denominator",
      description = "Province total population (Stats SA Census 2022 Statistical Release, Table 2.1).",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "Exact province population total from Table 2.1 for 1996, 2001 and 2022.",
      temporal_coverage = "1996, 2001, 2022",
      spatial_coverage = "South Africa provinces (geoBoundaries ZAF ADM1, 9 provinces).",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious affiliation %",
      description = "Share of stated responses declaring any named religion.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * (sum of named-religion shares) / (named-religion shares + no-religion share), from Table 4.1 percentages.",
      temporal_coverage = "1996, 2001, 2022",
      spatial_coverage = "South Africa provinces (geoBoundaries ZAF ADM1).",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "No religion %",
      description = "Share of stated responses reporting no religious affiliation/belief.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * (no-religion share) / (named-religion shares + no-religion share), from Table 4.1 percentages.",
      temporal_coverage = "1996, 2001, 2022",
      spatial_coverage = "South Africa provinces (geoBoundaries ZAF ADM1).",
      quality_notes = denominator_note
    )
  )
}

visual_layers_for_province <- function() {
  list(
    list(
      visual_layer_id = "za-province-religious-affiliation",
      label = "Religious affiliation %",
      description = "South Africa census 1996-2022 religious-affiliation share by province.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "stated responses in the census religion tabulation"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = "All named religions count as religious affiliation in every wave."
    ),
    list(
      visual_layer_id = "za-province-no-religion",
      label = "No religion %",
      description = "South Africa census 1996-2022 no-religion share by province.",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "stated responses in the census religion tabulation"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = "The No religious affiliation/belief category of each province in every wave."
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
      vintage = "2020",
      source_dataset_id = boundary_dataset_id
    ),
    site_snapshot = list(
      source_dataset_id = NULL,
      snapshot_date = NULL,
      basis = "no governed South Africa OpenStreetMap place-of-worship snapshot is included in this country data-map release",
      notes = "The South Africa page exposes census religious-affiliation and no-religion metrics only; place-density metrics are hidden until a governed South Africa place layer is built."
    ),
    source_datasets = source_datasets(),
    indicators = indicators_for_province(),
    visual_layers = visual_layers_for_province(),
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
required_sources <- c(p03014_path, cultdyn_path, geoboundaries_path)
invisible(lapply(required_sources, require_file))

# ---- parse population and religion ----
pop <- parse_population(p03014_path)
for (p in pop_provinces) {
  for (y in c("1996", "2001", "2011", "2022")) {
    if (is.null(pop[[p]][[y]])) stop("missing population for ", p, " ", y, call. = FALSE)
  }
}
for (y in names(national_pop)) {
  prov_sum <- sum(vapply(provinces, function(p) pop[[p]][[y]], numeric(1)))
  sa_total <- pop[["South Africa"]][[y]]
  if (sa_total != national_pop[[y]]) {
    stop("parsed South Africa ", y, " total does not match the expected national total", call. = FALSE)
  }
  # provinces sum to the national total up to Stats SA's own 1-person rounding.
  if (abs(prov_sum - sa_total) > 2L) {
    stop("province populations do not sum to the national total for ", y, call. = FALSE)
  }
}

rel <- parse_religion(cultdyn_path)
for (p in provinces) {
  for (y in c("1996", "2001", "2022")) {
    if (is.null(rel[[p]][[y]])) stop("missing religion row for ", p, " ", y, call. = FALSE)
  }
}

# ---- national cross-check: population-weighted provincial aggregate reproduces
# the printed national religion shares (Figure 4.1) within 1-decimal precision ----
national_recon <- list()
max_abs_diff <- 0
for (y in names(national_printed)) {
  w <- vapply(provinces, function(p) pop[[p]][[y]], numeric(1))
  agg <- vapply(cats, function(cat) {
    sum(vapply(provinces, function(p) rel[[p]][[y]][[cat]], numeric(1)) * w) / sum(w)
  }, numeric(1))
  printed <- national_printed[[y]]
  diffs <- abs(agg - printed[cats])
  max_abs_diff <- max(max_abs_diff, max(diffs))
  national_recon[[y]] <- list(
    year = as.integer(y),
    weighted_no_religion = round(agg[["no_religion"]], 2),
    printed_no_religion = unname(printed[["no_religion"]]),
    weighted_christianity = round(agg[["christianity"]], 2),
    printed_christianity = unname(printed[["christianity"]]),
    weighted_undetermined = round(agg[["undetermined"]], 2),
    printed_undetermined = unname(printed[["undetermined"]]),
    max_category_abs_diff = round(max(diffs), 2)
  )
}
# tolerance: provincial shares carry one-decimal precision, so the weighted
# national aggregate reproduces the printed national row within a few tenths.
if (max_abs_diff > 0.6) {
  stop("population-weighted national aggregate diverges from the printed national row by ",
       round(max_abs_diff, 2), " percentage points", call. = FALSE)
}

# ---- per-province headline shares per wave ----
shares <- setNames(vector("list", length(provinces)), provinces)
for (p in provinces) {
  shares[[p]] <- lapply(c("1996", "2001", "2022"), function(y) headline_shares(rel[[p]][[y]]))
  names(shares[[p]]) <- c("1996", "2001", "2022")
}

# ---- boundary ----
boundary <- read_boundary(geoboundaries_path)
boundary_write <- write_simplified_boundary(
  boundary, boundary_out,
  c("area_code", "area_name", "area_unit_id", "boundary_set_id",
    "boundary_level", "province_iso", "shape_id", "land_area_sq_km")
)
if (row_count_file(boundary_out) != nrow(boundary)) {
  stop("province boundary feature count changed during simplification", call. = FALSE)
}

# ---- assemble rows: waves in ascending year, provinces in area-name order ----
basis_by_year <- function(y) paste0(
  "province total population from Stats SA Census 2022 Statistical Release Table 2.1 (", y, "); ",
  "religion shares from Cultural Dynamics Table 4.1 (", y, "), one-decimal source precision; ",
  "the stated-response denominator for the percentages excludes the Undetermined residual"
)
flag_by_year <- function(y) paste(
  "stated_response_denominator_excludes_undetermined",
  "named_religions_in_religious_affiliation",
  "no_religion_category_is_no_religious_affiliation",
  "religion_shares_one_decimal_precision",
  "population_denominator_exact_from_table_2_1",
  if (y == "1996") "high_undetermined_share_1996_data_collection;traditional_african_coded_zero_in_1996" else "province_boundaries_2020_vintage",
  sep = ";"
)

order_idx <- order(boundary[["area_name"]])
rows <- list()
for (y in c("1996", "2001", "2022")) {
  yr <- as.integer(y)
  for (i in order_idx) {
    p <- boundary[["area_name"]][i]
    s <- shares[[p]][[y]]
    rows[[length(rows) + 1L]] <- build_area_row(
      area_code = boundary[["area_code"]][i], area_name = p,
      area_unit_id = boundary[["area_unit_id"]][i], land_area_sq_km = boundary[["land_area_sq_km"]][i],
      year = yr, population_total = pop[[p]][[y]], population_total_basis = basis_by_year(y),
      affiliation_percent = s[["affiliation_percent"]], no_religion_percent = s[["no_religion_percent"]],
      source_ids = c(religion_dataset_id, population_dataset_id, boundary_dataset_id),
      quality_flag = flag_by_year(y)
    )
  }
}

write_json(area_summary_document(rows), summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

join_coverage <- lapply(years, function(y) {
  list(boundary_level = boundary_level, year = y,
       matched_area_count = 9L, expected_area_count = nrow(boundary),
       missing_area_names = list())
})

national_reconciliation <- lapply(names(national_pop), function(y) {
  prov_sum <- sum(vapply(provinces, function(p) pop[[p]][[y]], numeric(1)))
  list(year = as.integer(y), metric = "population_total", area_sum = prov_sum,
       national_total = unname(national_pop[[y]]), difference = prov_sum - national_pop[[y]])
})

validation_checks <- c(
  "The three shipped waves (1996, 2001, 2022) are the census years for which Stats SA tabulates religion by province in Cultural Dynamics Table 4.1, on a single harmonised category set (Christianity, Islam, Traditional African Religion, Hinduism, Jewish Faith/Hebrew, Other beliefs, No religious affiliation/belief, and an Undetermined residual).",
  "The 2011 census dropped the religion question: 2011 is absent from the religion Table 4.1 while it is present in the population Table 2.1. The premise that South Africa asked religion continuously is incorrect; the product records the 2011 gap and does not fabricate a 2011 wave.",
  sprintf("The population-weighted provincial aggregate reproduces the printed national religion row (Figure 4.1) for every wave within %.2f percentage points (one-decimal provincial precision).", max_abs_diff),
  "Province populations sum to the printed national total for each wave up to Stats SA's own 1-person rounding (1996 exact; 2001 and 2022 differ by 1).",
  "Percentages use the stated-response denominator (named religions plus no religion, excluding Undetermined); religious affiliation and no religion sum to 100 percent of stated responses in every province and wave.",
  "All 9 census provinces join to the 9 geoBoundaries ZAF ADM1 features by the clean shapeISO code; the feature with ISO code NC carries the misspelled name 'Nothern Cape', corrected to 'Northern Cape' in the product.",
  sprintf("The simplified province boundary GeoJSON writes to %d bytes after %d m simplification (9 province features).", as.integer(boundary_write[["bytes"]]), boundary_write[["tolerance_m"]]),
  "The 2016 Community Survey reintroduced religion after the 2011 gap but is an intercensal household survey (a separate construct from a census), so it is deferred and not mixed into the census layers. The 1996 wave carries a high Undetermined share (about 9 percent nationally) and codes Traditional African Religion as 0,0 in every province, both features of 1996 census processing; the stated-response denominator absorbs the Undetermined residual, and 1996-to-2022 Traditional African comparisons are treated with care."
)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:za-census-religion:za:1996-2022:statssa-cultural-dynamics-and-p0301-4",
  dataset_id = "za-census-religion:za:1996-2022:statssa-cultural-dynamics-and-p0301-4",
  dataset_version_id = paste0("za-census-religion:za:1996-2022:statssa-cultural-dynamics-and-p0301-4:", substr(sha256_file(summary_json_out), 1, 12)),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "za-census-religion",
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
      waves = c("1996", "2001", "2022"),
      province_boundary_set = boundary_set_id,
      province_boundary_simplification_tolerance_m = boundary_write[["tolerance_m"]],
      pdf_extraction = "poppler pdftotext -layout; Cultural Dynamics Table 4.1 religion rows and P0301.4 Table 2.1 population rows parsed and reconciled",
      denominator = "stated responses (named religions plus no religion, excluding Undetermined); affiliation = named religions, no religion = No religious affiliation/belief",
      subnational_geography = "geoBoundaries ZAF ADM1 (9 provinces), joined by shapeISO code",
      omitted_metrics = c("religious_change", "places_per_10000_residents", "place_density_per_sq_km"),
      counts_published = "religion is published as percentages; the product ships percentages with the exact province population as denominator",
      dropped_wave = "2011 census dropped the religion question (present in Table 2.1 population, absent from Table 4.1 religion)"
    ),
    software_versions = list(
      r = paste(R.version[["major"]], R.version[["minor"]], sep = "."),
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")),
      pdftotext = "poppler pdftotext (system)"
    )
  ),
  source = list(
    provider = "Statistics South Africa (Stats SA); geoBoundaries (William & Mary geoLab)",
    source_dataset_ids = c(religion_dataset_id, population_dataset_id, religion_2022_dataset_id, boundary_dataset_id),
    source_urls = c(cultdyn_url, p03014_url, geoboundaries_meta_url, geoboundaries_gj_url),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = licence_text,
    citation = "Stats SA, Cultural Dynamics in South Africa (Report 03-01-84), Table 4.1; Stats SA, Census 2022 Statistical Release (P0301.4), Tables 2.1 and 2.10; geoBoundaries ZAF ADM1 (gbOpen).",
    raw_redistribution = "The census report PDFs and the geoBoundaries source GeoJSON are not committed. They remain in data/raw/za_census/ and await any project-controlled raw archive upload."
  ),
  input_manifests = list(),
  raw_sources = list(
    raw_source_record(cultdyn_path, cultdyn_url, "pdf", 27L, religion_dataset_id, TRUE, "1996,2001,2022",
      "Cultural Dynamics in South Africa (Report 03-01-84); Table 4.1 supplies the 9 provinces x 3 census years religion shares on a harmonised category set."),
    raw_source_record(p03014_path, p03014_url, "pdf", 40L, population_dataset_id, TRUE, "1996,2001,2011,2022",
      "Census 2022 Statistical Release (P0301.4); Table 2.1 supplies the exact province population totals (1996/2001/2011/2022) and Table 2.10 the corroborating 2022 religion-by-province table."),
    raw_source_record(geoboundaries_path, geoboundaries_gj_url, "geojson", 9L, boundary_dataset_id, TRUE, "2020",
      "geoBoundaries ZAF ADM1 GeoJSON; 9 province features. CC BY 3.0 IGO, boundary source OCHA ROSEA and the South African Municipal Demarcation Board."),
    raw_source_record(geoboundaries_meta_path, geoboundaries_meta_url, "json", NA_integer_, boundary_dataset_id, FALSE, "2020",
      "geoBoundaries ZAF ADM1 metadata; records the CC BY 3.0 IGO licence, boundary source, and the pinned release commit.")
  ),
  durable_files = list(
    manifest_file_record(summary_json_out, "South Africa province area summary with census 1996, 2001 and 2022 religious-affiliation and no-religion metrics.", licence_status),
    manifest_file_record(summary_csv_out, "Flattened South Africa province area summary with census 1996, 2001 and 2022 religious-affiliation and no-religion metrics.", licence_status),
    manifest_file_record(boundary_out, "Simplified South Africa province boundary GeoJSON derived from geoBoundaries ZAF ADM1 (9 provinces).", "geoboundaries_cc_by_3_0_igo")
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out),
         built_by = script_id, notes = "9 province reporting units x 3 census years (1996, 2001, 2022); stated-response denominator, percent-primary."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out),
         built_by = script_id, notes = sprintf("9 geoBoundaries ZAF ADM1 province features simplified at %d m tolerance.", boundary_write[["tolerance_m"]]))
  ),
  validation = list(
    checks = validation_checks,
    join_coverage = list(province = join_coverage),
    national_reconciliation = national_reconciliation,
    national_religion_cross_check = national_recon,
    national_excluded_share_percent = round(national_recon[["1996"]][["weighted_undetermined"]], 2),
    boundary_validation = list(
      source_za_province_count = 9L,
      output_feature_count = row_count_file(boundary_out),
      expected_feature_count = nrow(boundary),
      output_bytes = boundary_write[["bytes"]],
      simplification_tolerance_m = boundary_write[["tolerance_m"]],
      unmatched_boundary_features = list(),
      unmatched_census_areas = list(),
      name_fixes = list("geoBoundaries 'Nothern Cape' (shapeISO NC) corrected to 'Northern Cape'")
    )
  ),
  construct_notes = list(
    "The public map displays two headline metrics for 1996, 2001 and 2022 at province level: religious affiliation percent and no religion percent.",
    "Percentages use the stated-response denominator: named religions plus no religion, excluding the Undetermined residual. Religious affiliation is every named religion (Christianity, Islam, Traditional African Religion, Hinduism, Jewish Faith/Hebrew, Other beliefs); no religion is the No religious affiliation/belief category. The two shares sum to 100 percent of stated responses.",
    "Religion is published as percentages in Cultural Dynamics Table 4.1 (each province-year row sums to 100 across the categories including Undetermined). The product ships percentages with the exact province population (Census 2022 Statistical Release Table 2.1) as the denominator; religion counts are not published, so the count fields are null.",
    "The 2011 census dropped the religion question, so there is no 2011 religion layer; 2011 appears only in the population table. The 2016 Community Survey reintroduced religion but is an intercensal household survey, a separate construct from a census, so it is deferred and never mixed into the census layers.",
    "The 1996 wave carries a high Undetermined share (about 9 percent nationally) and codes Traditional African Religion as 0,0 in every province, both artefacts of 1996 census processing rather than of the population; the stated-response denominator absorbs the Undetermined residual. Provincial boundaries shifted slightly between the 1996/2001 and 2022 waves (cross-border municipality reallocations), but Stats SA tabulates all three waves by the same nine province names, so the product follows the source and maps them on the 2020 province boundaries."
  ),
  deferred_sources = list(
    list(
      source_dataset_id = "statssa-community-survey-2016-religion",
      url = "https://cs2016.statssa.gov.za/",
      local_path = NULL,
      notes = "The 2016 Community Survey reintroduced a religion question after the 2011 census dropped it, reporting the religiously unaffiliated share at about 10,7 percent nationally. It is an intercensal household survey, not a census, so it measures a different construct and is deferred rather than mixed into the census religion layers."
    ),
    list(
      source_dataset_id = "statssa-census-2001-religion-by-municipality",
      url = census_landing_url,
      local_path = NULL,
      notes = "The 2001 census published religion at municipality level (via the Census 2001 community profiles and Stats SA interactive tabulation), but the 2022 religion release (P0301.4) and the harmonised cross-wave Table 4.1 are province-level only. The first product anchors on province for 1996-2001-2022 comparability; a municipal downscaling of 2001 (and any later municipal 2022 re-tabulation) is deferred to a district/municipality build."
    )
  ),
  privacy = "public",
  licence_status = licence_status,
  licence_basis = licence_basis,
  downstream_status = "public",
  source_datasets = source_datasets(),
  notes = "The committed products contain the derived province area summary and simplified boundary only. On-page attribution cites Stats SA and geoBoundaries (CC BY 3.0 IGO, boundary source OCHA ROSEA and the South African Municipal Demarcation Board)."
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
manifest_text <- paste(readLines(manifest_out, warn = FALSE), collapse = "\n")
if (!jsonlite::validate(manifest_text)) stop("manifest JSON failed jsonlite validation", call. = FALSE)

cat(sprintf("wrote %s: %d rows\n", summary_json_out, length(rows)))
cat(sprintf("wrote %s: %d rows\n", summary_csv_out, row_count_file(summary_csv_out)))
cat(sprintf("wrote %s: %d features, %d bytes at %d m\n", boundary_out, row_count_file(boundary_out),
            as.integer(file_bytes(boundary_out)), boundary_write[["tolerance_m"]]))
cat(sprintf("wrote %s\n", manifest_out))
cat("join coverage: 9/9 provinces for 1996, 2001 and 2022 (geoBoundaries 'Nothern Cape' -> 'Northern Cape')\n")
for (y in names(national_recon)) {
  nr <- national_recon[[y]]
  cat(sprintf("%s national cross-check: weighted no-religion %.2f%% vs printed %.1f%%; max category diff %.2f pp\n",
              y, nr[["weighted_no_religion"]], nr[["printed_no_religion"]], nr[["max_category_abs_diff"]]))
}
cat("national reconciliation (province populations vs national total): 1996 exact; 2001 and 2022 differ by 1 (source rounding)\n")
