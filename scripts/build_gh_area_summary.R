# build the ghana census-religion area-summary products.
# inputs: the pinned 2021 Population and Housing Census General Report Volume 3C
# table 5.7 extract, the 2010 StatsBank POP16 region-religion query, the 2010
# National Analytical Report table 4.17, and the existing geoBoundaries-derived
# 16-region product.
# outputs: apps/regions/gh/data/gh_region_2010_ten.geojson,
# apps/regions/gh/data/area_summary_region_2010_2021_ten.{json,csv}, and
# docs/manifests/gh-census-religion-2010-2021.json.
# run from the repo root: Rscript scripts/build_gh_area_summary.R
# the existing 2021 sixteen-region product is validated but not rewritten.

suppressMessages({
  library(jsonlite)
  library(sf)
})

raw_dir <- "data/raw/gh_census"
gh_dir <- "apps/regions/gh/data"
manifest_dir <- "docs/manifests"
dir.create(gh_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- "2026-07-09"
script_id <- "scripts/build_gh_area_summary.R"
country_code <- "GH"
year <- 2021L
year_2010 <- 2010L
year_2021 <- 2021L

boundary_set_id <- "gh-region-2019-geoboundaries-adm1"
boundary_level <- "region"
census_dataset_id <- "gss-2021-phc-vol3c-table-5-7-religion-by-region"
boundary_dataset_id <- "geoboundaries-gha-adm1-2019"
ten_boundary_set_id <- "gh-region-2010-ten-geoboundaries-adm1-dissolved"
ten_boundary_dataset_id <- "geoboundaries-gha-adm1-2019-dissolved-to-2010-ten-region"
census_2010_statsbank_dataset_id <- "gss-statsbank-phc2010-pop16-religion-by-region"
census_2010_report_dataset_id <- "gss-2010-phc-national-analytical-report-table-4-17"
original_2021_boundary_simplification_tolerance_m <- 50L
original_2021_boundary_sha256 <- "3ddb73e5f14c6aa15f09be755e56b114a5029c6842ea67b5139dde14e88049b0"

# source urls recorded in the manifest and the on-page attribution. the census
# pdf is the 2021 PHC General Report Volume 3C, hosted on the GSS census portal.
census_pdf_url <- "https://census2021.statsghana.gov.gh/gssmain/fileUpload/reportthemelist/2021%20PHC%20General%20Report%20Vol%203C_Background%20Characteristics_181121.pdf"
census_landing_url <- "https://census2021.statsghana.gov.gh/"
statsbank_district_url <- "https://statsbank.statsghana.gov.gh/pxweb/en/PHC%202021%20StatsBank/PHC%202021%20StatsBank__Population/religion_table.px/"
statsbank_2010_api_root <- "https://statsbank.statsghana.gov.gh/api/v1/en"
statsbank_2010_table_api_url <- paste0(
  statsbank_2010_api_root,
  "/PHC2010/Population/POP16%20Population%20by%20Religious%20Affiliation,%20Age,%20Sex,%20Locality,%20and%20Geographic_Area.px"
)
statsbank_2010_table_ui_url <- paste0(
  "https://statsbank.statsghana.gov.gh/pxweb/en/PHC2010/PHC2010__Population/",
  "POP16%20Population%20by%20Religious%20Affiliation,%20Age,%20Sex,%20Locality,%20and%20Geographic_Area.px/"
)
census_2010_url <- "https://new-ndpc-static1.s3.amazonaws.com/pubication/2010PHC+National+Analytical+Report.pdf"
census_2000_url <- "https://statsbank.statsghana.gov.gh/censusatlas/Religion.html"
geoboundaries_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/GHA/ADM1/"
geoboundaries_gj_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/GHA/ADM1/geoBoundaries-GHA-ADM1.geojson"

census_pdf_path <- file.path(raw_dir, "gh_2021_vol3c.pdf")
census_2010_statsbank_meta_path <- file.path(raw_dir, "statsbank_phc2010_pop16_meta.json")
census_2010_statsbank_csv_path <- file.path(raw_dir, "statsbank_phc2010_pop16_region_religion.csv")
census_2010_report_pdf_path <- file.path(raw_dir, "gh_2010_national_analytical_report.pdf")
census_2010_report_txt_path <- file.path(raw_dir, "gh_2010_national_analytical_report.txt")
geoboundaries_path <- file.path(raw_dir, "geoBoundaries-GHA-ADM1.geojson")
geoboundaries_meta_path <- file.path(raw_dir, "gb_gha_adm1_meta.json")

boundary_out <- file.path(gh_dir, "gh_region_2019.geojson")
summary_json_out <- file.path(gh_dir, "area_summary_region.json")
summary_csv_out <- file.path(gh_dir, "area_summary_region.csv")
ten_boundary_out <- file.path(gh_dir, "gh_region_2010_ten.geojson")
ten_summary_json_out <- file.path(gh_dir, "area_summary_region_2010_2021_ten.json")
ten_summary_csv_out <- file.path(gh_dir, "area_summary_region_2010_2021_ten.csv")
manifest_out <- file.path(manifest_dir, "gh-census-religion-2010-2021.json")

licence_text <- paste(
  "GSS 2021 Population and Housing Census General Report Volume 3C (Background",
  "Characteristics), table 5.7 (population by religious affiliation, sex and",
  "region). The Ghana Statistical Service publishes the census report for open",
  "download on the census portal; no explicit reuse licence is stated, so the",
  "derived product attributes GSS and links the source of record. Boundaries",
  "are geoBoundaries GHA ADM1 (16 post-2019 regions), Creative Commons",
  "Attribution-ShareAlike 2.0, boundary source OpenStreetMap contributors."
)
licence_status <- "gss_census_open_report_attribution_geoboundaries_cc_by_sa_2_0"

# the eight religion groups of table 5.7, as the report labels them. the pdf
# prints "Pentecostal/" with "Charismatic" wrapped to the next line, so the
# parser keys on the "Pentecostal/" token. "Christian" is a printed subtotal
# (catholic + protestant + pentecostal/charismatic + other christian) and is
# not one of the eight groups; it is not used in the derived counts.
category_labels <- c(
  "Catholic", "Protestant", "Pentecostal/", "Other Christian",
  "Islam", "Traditionalist", "Other Religion", "No Religion"
)

# the seven named-religion groups that make up religious affiliation; every
# group except no religion. table 5.7 allocates every person to one of the
# eight groups, so the named religions plus no religion exhaust the total.
affiliation_cats <- c(
  "Catholic", "Protestant", "Pentecostal/", "Other Christian",
  "Islam", "Traditionalist", "Other Religion"
)

# the 16 region columns of table 5.7, in printed left-to-right order; the parser
# reads each data row positionally, so this order fixes the region identity.
region_order <- c(
  "Western", "Central", "Greater Accra", "Volta", "Eastern", "Ashanti",
  "Western North", "Ahafo", "Bono", "Bono East", "Oti", "Northern",
  "Savannah", "North East", "Upper East", "Upper West"
)

# the ten pre-2019 regions used by the 2010 printed report; each old region is
# either unchanged or the exact parent of post-2019 regions.
ten_region_order <- c(
  "Western", "Central", "Greater Accra", "Volta", "Eastern", "Ashanti",
  "Brong Ahafo", "Northern", "Upper East", "Upper West"
)
ten_region_codes <- c(
  "Western" = "GH-WP",
  "Central" = "GH-CP",
  "Greater Accra" = "GH-AA",
  "Volta" = "GH-TV",
  "Eastern" = "GH-EP",
  "Ashanti" = "GH-AH",
  "Brong Ahafo" = "GH-BA",
  "Northern" = "GH-NP",
  "Upper East" = "GH-UE",
  "Upper West" = "GH-UW"
)
ten_region_members <- list(
  "Western" = c("Western", "Western North"),
  "Central" = c("Central"),
  "Greater Accra" = c("Greater Accra"),
  "Volta" = c("Volta", "Oti"),
  "Eastern" = c("Eastern"),
  "Ashanti" = c("Ashanti"),
  "Brong Ahafo" = c("Ahafo", "Bono", "Bono East"),
  "Northern" = c("Northern", "Savannah", "North East"),
  "Upper East" = c("Upper East"),
  "Upper West" = c("Upper West")
)

# stop early if a required raw source has not been downloaded.
require_file <- function(path) {
  if (!file.exists(path)) stop("missing required source: ", path, call. = FALSE)
}

# compute the sha-256 digest for a local file.
sha256_file <- function(path) {
  unname(tools::sha256sum(path))
}

# hash ordered product hashes for manifest version tokens.
sha256_values <- function(values) {
  tmp <- tempfile()
  on.exit(unlink(tmp), add = TRUE)
  writeBin(charToRaw(paste(values, collapse = "")), tmp)
  sha256_file(tmp)
}

# return file size in bytes for manifest records.
file_bytes <- function(path) {
  as.integer(unname(file.info(path)[["size"]]))
}

# return NULL for a scalar that should serialise as JSON null.
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

# normalise a region label so the census and geoBoundaries spellings compare
# equal: uppercase, drop the trailing "REGION" word geoBoundaries appends,
# punctuation to spaces, collapse whitespace.
gh_norm <- function(x) {
  x <- toupper(trimws(as.character(x)))
  x <- gsub("[^A-Z0-9]+", " ", x)
  x <- gsub("\\bREGION\\b", "", x)
  trimws(gsub("\\s+", " ", x))
}

# extract table 5.7 with poppler pdftotext -layout, then parse the Both Sexes /
# all-locality block: the "All locality types" total row and the eight religion
# rows. each data row is a label followed by a number, a decimal percent, and 16
# region integers. the block ends where the Male block begins, which keeps the
# sex-disaggregated rows out.
read_census <- function(pdf_path) {
  pdftotext <- Sys.which("pdftotext")
  if (!nzchar(pdftotext)) {
    stop("pdftotext (poppler) is required to parse the census PDF", call. = FALSE)
  }
  layout_path <- tempfile(fileext = ".txt")
  on.exit(unlink(layout_path), add = TRUE)
  status <- system2(pdftotext, c("-layout", shQuote(pdf_path), shQuote(layout_path)))
  if (status != 0L) stop("pdftotext failed on the census PDF", call. = FALSE)

  txt <- readLines(layout_path, warn = FALSE)
  # the real table header is the all-caps table title; the contents and
  # figure-list entries use different casing and carry leader dots.
  hdr <- grep("TABLE 5\\.7: POPULATION BY RELIGIOUS AFFILIATION, SEX AND REGION", txt)
  if (length(hdr) < 1L) stop("could not locate table 5.7", call. = FALSE)
  start <- hdr[1]
  male_offsets <- grep("^\\s*Male\\s*$", txt[start:length(txt)])
  if (length(male_offsets) < 1L) stop("could not find the Male block boundary", call. = FALSE)
  window <- txt[start:(start + male_offsets[1] - 2L)]

  # a data row is a label, the national Number, the Percent decimal, and 16
  # region integers. the label allows letters, spaces, and the slash in
  # "Pentecostal/".
  num <- "[0-9][0-9,]*"
  pat <- paste0("^\\s*([A-Za-z][A-Za-z /]*?)\\s+(", num, ")\\s+(\\d+\\.\\d)\\s+(",
                num, "(?:\\s+", num, "){15})\\s*$")

  parse_ints <- function(s) as.integer(gsub(",", "", strsplit(trimws(s), "\\s+")[[1]]))
  matched <- list()
  for (line in window) {
    m <- regmatches(line, regexec(pat, line, perl = TRUE))[[1]]
    if (length(m) != 5L) next
    label <- trimws(m[2])
    matched[[label]] <- list(
      number = as.integer(gsub(",", "", m[3])),
      region_values = parse_ints(m[5])
    )
  }

  if (is.null(matched[["All locality types"]])) {
    stop("could not parse the table 5.7 total row", call. = FALSE)
  }
  missing_cats <- setdiff(category_labels, names(matched))
  if (length(missing_cats) > 0L) {
    stop("missing table 5.7 category rows: ", paste(missing_cats, collapse = "; "), call. = FALSE)
  }
  for (label in c("All locality types", category_labels)) {
    if (length(matched[[label]][["region_values"]]) != 16L) {
      stop("row '", label, "' does not carry 16 region values", call. = FALSE)
    }
  }
  matched
}

# assemble a region-by-category matrix (rows = regions, columns = categories)
# plus the printed regional totals, and reconcile before returning.
build_region_frame <- function(parsed) {
  total_row <- parsed[["All locality types"]]
  region_total <- total_row[["region_values"]]

  cat_matrix <- vapply(category_labels, function(label) {
    parsed[[label]][["region_values"]]
  }, integer(16L))
  rownames(cat_matrix) <- region_order

  # each category's 16 region values sum to its printed national Number.
  for (label in category_labels) {
    if (sum(parsed[[label]][["region_values"]]) != parsed[[label]][["number"]]) {
      stop("category '", label, "' region values do not sum to its national number", call. = FALSE)
    }
  }
  # every region's eight categories sum to its printed regional total.
  region_component_sum <- rowSums(cat_matrix)
  if (any(region_component_sum != region_total)) {
    stop("a region's eight religion groups do not sum to its printed total", call. = FALSE)
  }
  # the eight national numbers sum to the printed national total.
  if (sum(vapply(category_labels, function(l) parsed[[l]][["number"]], integer(1))) != total_row[["number"]]) {
    stop("the eight national religion numbers do not sum to the national total", call. = FALSE)
  }

  data.frame(
    terr_name = region_order,
    total = region_total,
    catholic = cat_matrix[, "Catholic"],
    protestant = cat_matrix[, "Protestant"],
    pentecostal_charismatic = cat_matrix[, "Pentecostal/"],
    other_christian = cat_matrix[, "Other Christian"],
    islam = cat_matrix[, "Islam"],
    traditionalist = cat_matrix[, "Traditionalist"],
    other_religion = cat_matrix[, "Other Religion"],
    no_religion = cat_matrix[, "No Religion"],
    stringsAsFactors = FALSE
  )
}

# derive the headline counts for the census rows. table 5.7 allocates every
# person to one of the eight groups with no not-stated residual, so the
# denominator is the printed regional total and religious affiliation is the
# total minus no religion.
derive_counts <- function(rows) {
  affiliation_map <- c(
    catholic = "Catholic", protestant = "Protestant",
    pentecostal_charismatic = "Pentecostal/", other_christian = "Other Christian",
    islam = "Islam", traditionalist = "Traditionalist", other_religion = "Other Religion"
  )
  affiliation_cols <- names(affiliation_map)
  religious_affiliation <- rowSums(rows[, affiliation_cols, drop = FALSE])
  no_religion <- rows[["no_religion"]]
  denominator <- rows[["total"]]
  data.frame(
    population_total = denominator,
    religious_affiliation_count = religious_affiliation,
    no_religion_count = no_religion,
    religious_affiliation_percent = round(100 * religious_affiliation / denominator, 2),
    no_religion_percent = round(100 * no_religion / denominator, 2),
    stringsAsFactors = FALSE
  )
}

# metric CRS for area computation and metre-tolerance simplification;
# Africa Albers Equal Area covers Ghana without a UTM-zone seam.
africa_aea <- paste(
  "+proj=aea +lat_1=20 +lat_2=-23 +lat_0=0 +lon_0=25",
  "+x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"
)

# prepare the region boundary layer from the geoBoundaries GHA ADM1 file. the
# display name drops the trailing " Region" so it matches the census spelling;
# the ISO 3166-2 shapeISO code (GH-WN, ...) is the area code.
read_boundary <- function(path) {
  gb <- st_read(path, quiet = TRUE)
  if (nrow(gb) != 16L) stop("expected 16 geoBoundaries GHA ADM1 regions", call. = FALSE)
  gb <- st_make_valid(gb)
  gb_metric <- st_transform(gb, africa_aea)

  gb[["area_name"]] <- sub("\\s+Region$", "", as.character(gb[["shapeName"]]))
  gb[["area_code"]] <- as.character(gb[["shapeISO"]])
  gb[["area_unit_id"]] <- paste0(boundary_set_id, ":", gb[["area_code"]])
  gb[["boundary_set_id"]] <- boundary_set_id
  gb[["boundary_level"]] <- boundary_level
  gb[["shape_id"]] <- as.character(gb[["shapeID"]])
  gb[["join_name"]] <- gh_norm(gb[["shapeName"]])
  gb[["land_area_sq_km"]] <- as.numeric(st_area(gb_metric)) / 1e6

  if (any(duplicated(gb[["join_name"]]))) {
    stop("duplicate region join names in the boundary layer", call. = FALSE)
  }
  if (any(!nzchar(gb[["area_code"]]))) {
    stop("a geoBoundaries region has an empty shapeISO code", call. = FALSE)
  }
  gb
}

# match the census region rows to the boundary layer by normalised name.
match_to_boundary <- function(census_region, boundary) {
  source_key <- gh_norm(census_region[["terr_name"]])
  boundary_index <- match(source_key, boundary[["join_name"]])
  if (any(is.na(boundary_index))) {
    missing <- census_region[is.na(boundary_index), "terr_name"]
    stop("unmatched GH region rows: ", paste(missing, collapse = "; "), call. = FALSE)
  }
  if (any(duplicated(boundary_index))) stop("duplicate matched region boundaries", call. = FALSE)
  if (length(boundary_index) != nrow(boundary)) {
    stop("unexpected matched region count", call. = FALSE)
  }
  counts <- derive_counts(census_region)
  data.frame(
    census_region,
    counts,
    area_code = boundary[["area_code"]][boundary_index],
    area_name = boundary[["area_name"]][boundary_index],
    area_unit_id = boundary[["area_unit_id"]][boundary_index],
    land_area_sq_km = boundary[["land_area_sq_km"]][boundary_index],
    stringsAsFactors = FALSE
  )
}

# build one schema-shaped area-summary row for one region.
build_area_row <- function(row) {
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = row[["area_unit_id"]],
    area_code = as.character(row[["area_code"]]),
    area_name = row[["area_name"]],
    year = year,
    population_total = null_if_na(as.integer(row[["population_total"]])),
    population_total_basis = "table 5.7 regional total (all locality types, both sexes); the census allocates every person to one of eight religious groups, so no not-stated residual is excluded",
    religious_affiliation_count = null_if_na(as.integer(row[["religious_affiliation_count"]])),
    religious_affiliation_percent = null_if_na(row[["religious_affiliation_percent"]]),
    no_religion_count = null_if_na(as.integer(row[["no_religion_count"]])),
    no_religion_percent = null_if_na(row[["no_religion_percent"]]),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(row[["land_area_sq_km"]], 2),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = c(census_dataset_id, boundary_dataset_id),
    quality_flag = paste(
      "full_response_denominator",
      "no_not_stated_category_in_source",
      "named_religions_in_religious_affiliation",
      sep = ";"
    )
  )
}

# flatten area-summary rows for the CSV sibling.
flatten_rows <- function(rows) {
  csv_scalar <- function(value, missing_value) {
    if (is.null(value)) return(missing_value)
    value
  }
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
      religious_affiliation_count = csv_scalar(row[["religious_affiliation_count"]], NA_integer_),
      religious_affiliation_percent = csv_scalar(row[["religious_affiliation_percent"]], NA_real_),
      no_religion_count = csv_scalar(row[["no_religion_count"]], NA_integer_),
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

# create the source-dataset records for the area-summary document.
source_datasets <- function() {
  list(
    list(
      source_dataset_id = census_dataset_id,
      name = "GSS 2021 PHC General Report Volume 3C (Background Characteristics), table 5.7: population by religious affiliation, sex and region",
      provider = "Ghana Statistical Service (GSS)",
      url = census_pdf_url,
      retrieval_date = retrieval_date,
      local_path = census_pdf_path,
      licence = list(
        name = "GSS census report, open download on the census portal; no explicit reuse licence stated",
        url = census_landing_url,
        attribution = "Ghana Statistical Service (GSS)"
      ),
      citation = "Ghana Statistical Service, 2021 Population and Housing Census General Report Volume 3C: Background Characteristics, Table 5.7.",
      access_limits = NULL,
      redistribution_limits = "The census PDF is not committed; the derived public product attributes GSS and links the source.",
      notes = "Table 5.7 gives the eight religion groups (Catholic, Protestant, Pentecostal/Charismatic, Other Christian, Islam, Traditionalist, Other Religion, No Religion) for all 16 regions plus a national Number column; parsed with pdftotext -layout from the Both Sexes / all-locality block. Every person is allocated, so no not-stated residual exists. District religion is not published in Volume 3C."
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "geoBoundaries GHA ADM1 (16 post-2019 regions)",
      provider = "geoBoundaries (William & Mary geoLab)",
      url = geoboundaries_gj_url,
      retrieval_date = retrieval_date,
      local_path = geoboundaries_path,
      licence = list(
        name = "Creative Commons Attribution-ShareAlike 2.0 (CC BY-SA 2.0); boundary source OpenStreetMap contributors",
        url = geoboundaries_meta_url,
        attribution = "geoBoundaries (gbOpen); boundary source OpenStreetMap contributors"
      ),
      citation = "Runfola et al., geoBoundaries GHA ADM1 (gbOpen), region boundaries.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary is committed with CC BY-SA 2.0 attribution to OpenStreetMap contributors.",
      notes = "16 ADM1 regions matching the post-2019 regional structure the 2021 census reports; shapeISO carries the ISO 3166-2 GH-NN codes used as area codes. Boundary source OpenStreetMap, sourceDataUpdateDate 2023."
    )
  )
}

# create the indicator metadata for the region product.
indicators_for_region <- function() {
  denominator_note <- paste(
    "Percentages use the table 5.7 regional total (all locality types, both",
    "sexes) as the denominator. Table 5.7 allocates every person to one of the",
    "eight religion groups, so there is no not-stated category to exclude."
  )
  list(
    list(
      indicator_id = "population_total",
      label = "Census religion-response denominator",
      description = "Regional total of persons in table 5.7 (all locality types, both sexes).",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "table 5.7 regional total; every person is allocated to one of the eight religion groups.",
      temporal_coverage = "2021",
      spatial_coverage = "Ghana regions (geoBoundaries ADM1) in the 2021 census.",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious affiliation %",
      description = "Share of persons declaring any named religion.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * (Catholic + Protestant + Pentecostal/Charismatic + Other Christian + Islam + Traditionalist + Other Religion) / regional total.",
      temporal_coverage = "2021",
      spatial_coverage = "Ghana regions (geoBoundaries ADM1) in the 2021 census.",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "No religion %",
      description = "Share of persons in the No Religion group.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * No Religion / regional total.",
      temporal_coverage = "2021",
      spatial_coverage = "Ghana regions (geoBoundaries ADM1) in the 2021 census.",
      quality_notes = denominator_note
    )
  )
}

# define the choropleth layers exposed by the shared region map.
visual_layers_for_region <- function() {
  list(
    list(
      visual_layer_id = "gh-region-religious-affiliation",
      label = "Religious affiliation %",
      description = "Ghana census 2021 religious-affiliation share.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "persons in the religion table"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = "All seven named-religion groups count as religious affiliation."
    ),
    list(
      visual_layer_id = "gh-region-no-religion",
      label = "No religion %",
      description = "Ghana census 2021 no-religion share.",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "persons in the religion table"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = "No religion is the No Religion group; there is no not-stated category in table 5.7."
    )
  )
}

# assemble the schema-compatible area-summary document.
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
      vintage = "2019",
      source_dataset_id = boundary_dataset_id
    ),
    site_snapshot = list(
      source_dataset_id = NULL,
      snapshot_date = NULL,
      basis = "no governed Ghana OpenStreetMap place-of-worship snapshot is included in this country data-map release",
      notes = "The Ghana page exposes census 2021 religious-affiliation and no-religion metrics only; place-density metrics are hidden until a governed Ghana place layer is built."
    ),
    source_datasets = source_datasets(),
    indicators = indicators_for_region(),
    visual_layers = visual_layers_for_region(),
    rows = rows
  )
}

# create a manifest durable-file record for one generated output.
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

# create a manifest raw-source record for one local source file.
raw_source_record <- function(path, url, format, row_count, source_id, used, periods, notes) {
  list(
    uri = path,
    url = url,
    format = format,
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    row_count = row_count,
    source_dataset_id = source_id,
    used_in_public_product = used,
    periods = periods,
    notes = notes
  )
}

# return a stable digest of the committed 2021 rows for before/after checks.
rows_digest <- function(path) {
  json <- fromJSON(path, simplifyVector = FALSE)
  rows_text <- toJSON(json[["rows"]], auto_unbox = TRUE, null = "null", digits = NA)
  tmp <- tempfile()
  on.exit(unlink(tmp), add = TRUE)
  writeBin(charToRaw(rows_text), tmp)
  sha256_file(tmp)
}

# read the committed 2021 area-summary rows into a small count frame.
read_existing_area_summary_counts <- function(path) {
  json <- fromJSON(path, simplifyVector = FALSE)
  rows <- json[["rows"]]
  do.call(rbind, lapply(rows, function(row) {
    data.frame(
      terr_name = row[["area_name"]],
      area_code = row[["area_code"]],
      area_unit_id = row[["area_unit_id"]],
      total = as.integer(row[["population_total"]]),
      population_total = as.integer(row[["population_total"]]),
      religious_affiliation_count = as.integer(row[["religious_affiliation_count"]]),
      religious_affiliation_percent = as.numeric(row[["religious_affiliation_percent"]]),
      no_religion = as.integer(row[["no_religion_count"]]),
      no_religion_count = as.integer(row[["no_religion_count"]]),
      no_religion_percent = as.numeric(row[["no_religion_percent"]]),
      land_area_sq_km = as.numeric(row[["land_area_sq_km"]]),
      stringsAsFactors = FALSE
    )
  }))
}

# validate that the committed 2021 rows still match the source-derived counts.
validate_existing_2021_rows <- function(existing_counts, source_counts) {
  expected <- data.frame(
    terr_name = source_counts[["terr_name"]],
    derive_counts(source_counts),
    land_area_sq_km = round(source_counts[["land_area_sq_km"]], 2),
    stringsAsFactors = FALSE
  )
  rownames(expected) <- expected[["terr_name"]]
  rownames(existing_counts) <- existing_counts[["terr_name"]]
  missing <- setdiff(expected[["terr_name"]], existing_counts[["terr_name"]])
  if (length(missing) > 0L) {
    stop("committed 2021 area-summary rows are missing: ", paste(missing, collapse = "; "), call. = FALSE)
  }
  fields <- c(
    "population_total",
    "religious_affiliation_count",
    "no_religion_count",
    "religious_affiliation_percent",
    "no_religion_percent",
    "land_area_sq_km"
  )
  existing_compare <- existing_counts[expected[["terr_name"]], fields, drop = FALSE]
  expected_compare <- expected[, fields, drop = FALSE]
  count_fields <- c("population_total", "religious_affiliation_count", "no_religion_count")
  for (field in count_fields) {
    if (!all(as.integer(existing_compare[[field]]) == as.integer(expected_compare[[field]]))) {
      stop("committed 2021 area-summary rows no longer match the source counts for ", field, call. = FALSE)
    }
  }
  decimal_fields <- c("religious_affiliation_percent", "no_religion_percent", "land_area_sq_km")
  for (field in decimal_fields) {
    if (!all(sprintf("%.2f", as.numeric(existing_compare[[field]])) == sprintf("%.2f", as.numeric(expected_compare[[field]])))) {
      stop("committed 2021 area-summary rows no longer match the source counts for ", field, call. = FALSE)
    }
  }
  TRUE
}

# parse the pinned 2010 StatsBank CSV and return one row per current region.
read_2010_statsbank_region_counts <- function(path) {
  raw <- read.csv(path, check.names = FALSE, fileEncoding = "Windows-1252")
  required_cols <- c("Geographical_Area", "Education", "Religion", "Locality", "Sex", "All ages")
  missing_cols <- setdiff(required_cols, names(raw))
  if (length(missing_cols) > 0L) {
    stop("2010 StatsBank CSV is missing columns: ", paste(missing_cols, collapse = "; "), call. = FALSE)
  }
  if (any(raw[["Education"]] != "Total") ||
      any(raw[["Locality"]] != "All Locality Types") ||
      any(raw[["Sex"]] != "Both sexes")) {
    stop("2010 StatsBank CSV is not the expected total/locality/sex query", call. = FALSE)
  }
  expected_areas <- c("Ghana", region_order)
  missing_areas <- setdiff(expected_areas, raw[["Geographical_Area"]])
  if (length(missing_areas) > 0L) {
    stop("2010 StatsBank CSV is missing areas: ", paste(missing_areas, collapse = "; "), call. = FALSE)
  }

  religion_map <- c(
    total = "Total",
    no_religion = "No religion",
    catholic = "Catholic",
    protestant = "Protestants",
    pentecostal_charismatic = "Pentecostal/Charismatic",
    other_christian = "Other christian",
    islam = "Islam",
    traditionalist = "Traditionalist",
    other_religion = "Other"
  )
  # return one exact StatsBank count for an area/category cell.
  value_for <- function(area, religion) {
    hits <- raw[raw[["Geographical_Area"]] == area & raw[["Religion"]] == religion, "All ages"]
    if (length(hits) != 1L) stop("missing 2010 StatsBank value for ", area, " / ", religion, call. = FALSE)
    as.integer(hits)
  }
  region_counts <- do.call(rbind, lapply(region_order, function(area) {
    values <- vapply(religion_map, function(religion) value_for(area, religion), integer(1))
    data.frame(terr_name = area, as.list(values), stringsAsFactors = FALSE, check.names = FALSE)
  }))
  national <- vapply(religion_map, function(religion) value_for("Ghana", religion), integer(1))

  religion_cols <- setdiff(names(religion_map), "total")
  if (any(rowSums(region_counts[, religion_cols, drop = FALSE]) != region_counts[["total"]])) {
    stop("a 2010 StatsBank region's religion groups do not sum to its total", call. = FALSE)
  }
  for (col in names(religion_map)) {
    if (sum(region_counts[[col]]) != national[[col]]) {
      stop("2010 StatsBank region values do not sum to Ghana for ", col, call. = FALSE)
    }
  }
  list(region_counts = region_counts, national = national)
}

# ensure the 2010 PDF has a pdftotext layout extraction for table validation.
ensure_2010_report_text <- function(pdf_path, txt_path) {
  if (file.exists(txt_path)) return(txt_path)
  pdftotext <- Sys.which("pdftotext")
  if (!nzchar(pdftotext)) {
    stop("pdftotext (poppler) is required to parse the 2010 report PDF", call. = FALSE)
  }
  status <- system2(pdftotext, c("-layout", shQuote(pdf_path), shQuote(txt_path)))
  if (status != 0L) stop("pdftotext failed on the 2010 report PDF", call. = FALSE)
  txt_path
}

# read the printed 2010 report table 4.17 totals and one-decimal percentages.
read_2010_report_table <- function(txt_path) {
  txt <- readLines(txt_path, warn = FALSE)
  start <- grep("Table 4\\.17: Population by religious affiliation and region, 2010", txt)
  if (length(start) < 1L) stop("could not locate 2010 report table 4.17", call. = FALSE)
  start <- start[length(start)]
  window <- txt[start:(start + 40L)]
  # return the integer values printed across one report-table row.
  parse_ints <- function(line) as.integer(gsub(",", "", regmatches(line, gregexpr("[0-9][0-9,]*", line))[[1]]))
  # return the one-decimal percentages printed across one report-table row.
  parse_pcts <- function(line) as.numeric(regmatches(line, gregexpr("[0-9]+\\.[0-9]", line))[[1]])

  total_line <- grep("^\\s*All regions", window, value = TRUE)
  if (length(total_line) != 1L) stop("could not parse 2010 report table 4.17 total row", call. = FALSE)
  totals <- parse_ints(total_line)
  if (length(totals) != length(ten_region_order)) {
    stop("2010 report table 4.17 total row does not carry ten values", call. = FALSE)
  }

  # return the single report-table row matching a category pattern.
  line_for <- function(pattern) {
    value <- grep(pattern, window, value = TRUE)
    if (length(value) != 1L) stop("could not parse 2010 report row: ", pattern, call. = FALSE)
    value
  }
  pct_lines <- list(
    no_religion = line_for("^\\s*No Religion"),
    catholic = line_for("^\\s*Catholic"),
    protestant = line_for("^\\s*Protestant"),
    pentecostal_charismatic = line_for("^\\s*Charismatic"),
    other_christian = line_for("^\\s*Christian"),
    islam = line_for("^\\s*Islam"),
    traditionalist = line_for("^\\s*Traditionalist"),
    other_religion = line_for("^\\s*Other\\s+[0-9]")
  )
  pct_values <- lapply(pct_lines, parse_pcts)
  bad_pct_rows <- names(pct_values)[vapply(pct_values, length, integer(1)) != length(ten_region_order)]
  if (length(bad_pct_rows) > 0L) {
    stop("2010 report percentage rows do not carry ten values: ", paste(bad_pct_rows, collapse = "; "), call. = FALSE)
  }
  percentages <- as.data.frame(pct_values, check.names = FALSE)
  percentages[["terr_name"]] <- ten_region_order
  percentages <- percentages[, c("terr_name", names(pct_lines))]

  list(
    totals = data.frame(terr_name = ten_region_order, total = totals, stringsAsFactors = FALSE),
    percentages = percentages
  )
}

# aggregate the current 16-region counts to the pre-2019 ten-region frame.
aggregate_to_ten_regions <- function(region_counts) {
  count_cols <- intersect(
    c("total", "catholic", "protestant", "pentecostal_charismatic",
      "other_christian", "islam", "traditionalist", "other_religion",
      "no_religion", "religious_affiliation_count"),
    names(region_counts)
  )
  do.call(rbind, lapply(ten_region_order, function(old_region) {
    members <- ten_region_members[[old_region]]
    subset <- region_counts[region_counts[["terr_name"]] %in% members, , drop = FALSE]
    if (nrow(subset) != length(members)) {
      stop("missing current-region members for ", old_region, call. = FALSE)
    }
    values <- vapply(count_cols, function(col) sum(subset[[col]]), numeric(1))
    data.frame(terr_name = old_region, as.list(values), stringsAsFactors = FALSE, check.names = FALSE)
  }))
}

# validate the ten-region 2010 counts against the printed table 4.17 frame.
validate_2010_against_report <- function(ten_counts, report_table) {
  rownames(ten_counts) <- ten_counts[["terr_name"]]
  report_totals <- report_table[["totals"]]
  rownames(report_totals) <- report_totals[["terr_name"]]
  if (!identical(as.integer(ten_counts[ten_region_order, "total"]), as.integer(report_totals[ten_region_order, "total"]))) {
    stop("2010 ten-region totals do not match report table 4.17", call. = FALSE)
  }
  report_pct <- report_table[["percentages"]]
  rownames(report_pct) <- report_pct[["terr_name"]]
  pct_cols <- setdiff(names(report_pct), "terr_name")
  calculated <- data.frame(
    terr_name = ten_region_order,
    lapply(pct_cols, function(col) round(100 * ten_counts[ten_region_order, col] / ten_counts[ten_region_order, "total"], 1)),
    check.names = FALSE
  )
  names(calculated) <- c("terr_name", pct_cols)
  for (col in pct_cols) {
    if (!all(as.numeric(calculated[[col]]) == as.numeric(report_pct[ten_region_order, col]))) {
      stop("2010 ten-region percentages do not reproduce report table 4.17 for ", col, call. = FALSE)
    }
  }
  TRUE
}

# dissolve the existing 16-region boundary into the ten pre-2019 regions.
dissolve_ten_region_boundary <- function(path) {
  source <- st_read(path, quiet = TRUE)
  source[["old_region"]] <- NA_character_
  for (old_region in ten_region_order) {
    source[["old_region"]][source[["area_name"]] %in% ten_region_members[[old_region]]] <- old_region
  }
  if (any(is.na(source[["old_region"]]))) {
    stop("some 16-region boundary features lack a ten-region parent", call. = FALSE)
  }
  metric <- st_transform(st_make_valid(source), africa_aea)
  dissolved <- lapply(ten_region_order, function(old_region) {
    subset <- metric[metric[["old_region"]] == old_region, ]
    geometry <- st_union(st_geometry(subset))
    st_sf(
      data.frame(
        area_code = unname(ten_region_codes[[old_region]]),
        area_name = old_region,
        area_unit_id = paste0(ten_boundary_set_id, ":", unname(ten_region_codes[[old_region]])),
        boundary_set_id = ten_boundary_set_id,
        boundary_level = boundary_level,
        source_area_codes = paste(sort(subset[["area_code"]]), collapse = "|"),
        land_area_sq_km = sum(as.numeric(subset[["land_area_sq_km"]])),
        stringsAsFactors = FALSE
      ),
      geometry = st_sfc(geometry, crs = st_crs(metric))
    )
  })
  dissolved <- do.call(rbind, dissolved)
  st_make_valid(st_transform(dissolved, 4326))
}

# write the dissolved ten-region boundary to GeoJSON with stable precision.
write_ten_boundary <- function(boundary, output_path) {
  st_write(
    boundary,
    output_path,
    driver = "GeoJSON",
    delete_dsn = TRUE,
    quiet = TRUE,
    layer_options = c("COORDINATE_PRECISION=5")
  )
  list(bytes = file_bytes(output_path))
}

# derive headline counts and percentages from exact category counts.
derive_counts_from_categories <- function(rows) {
  affiliation_cols <- c(
    "catholic", "protestant", "pentecostal_charismatic", "other_christian",
    "islam", "traditionalist", "other_religion"
  )
  religious_affiliation <- rowSums(rows[, affiliation_cols, drop = FALSE])
  no_religion <- rows[["no_religion"]]
  denominator <- rows[["total"]]
  data.frame(
    population_total = denominator,
    religious_affiliation_count = religious_affiliation,
    no_religion_count = no_religion,
    religious_affiliation_percent = round(100 * religious_affiliation / denominator, 2),
    no_religion_percent = round(100 * no_religion / denominator, 2),
    stringsAsFactors = FALSE
  )
}

# create one area-summary row for the ten-region companion product.
build_ten_area_row <- function(row, year_value, source_ids, basis, quality_flag) {
  list(
    country_code = country_code,
    boundary_set_id = ten_boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = row[["area_unit_id"]],
    area_code = as.character(row[["area_code"]]),
    area_name = row[["area_name"]],
    year = year_value,
    population_total = null_if_na(as.integer(row[["population_total"]])),
    population_total_basis = basis,
    religious_affiliation_count = null_if_na(as.integer(row[["religious_affiliation_count"]])),
    religious_affiliation_percent = null_if_na(row[["religious_affiliation_percent"]]),
    no_religion_count = null_if_na(as.integer(row[["no_religion_count"]])),
    no_religion_percent = null_if_na(row[["no_religion_percent"]]),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(as.numeric(row[["land_area_sq_km"]]), 2),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = source_ids,
    quality_flag = quality_flag
  )
}

# return the source dataset records for the ten-region companion product.
source_datasets_ten_region <- function() {
  c(
    list(
      list(
        source_dataset_id = census_2010_statsbank_dataset_id,
        name = "GSS StatsBank PHC2010 POP16: population by religious affiliation, district, region, locality, age, sex, and education",
        provider = "Ghana Statistical Service (GSS)",
        url = statsbank_2010_table_ui_url,
        retrieval_date = retrieval_date,
        local_path = census_2010_statsbank_csv_path,
        licence = list(
          name = "GSS StatsBank open web table; no explicit reuse licence stated",
          url = "https://statsbank.statsghana.gov.gh/",
          attribution = "Ghana Statistical Service (GSS)"
        ),
        citation = "Ghana Statistical Service, StatsBank PHC2010 POP16 population by religious affiliation table.",
        access_limits = "The API was queried with curl -k because the server TLS chain did not verify in this environment.",
        redistribution_limits = "The pinned CSV query remains under data/raw/gh_census; the public product contains derived regional counts.",
        notes = "The live table path is /api/v1/en/PHC2010/Population/POP16 Population by Religious Affiliation, Age, Sex, Locality, and Geographic_Area.px. The pinned query selects Ghana plus the 16 current region values, Education=Total, Religion=Total plus eight groups, Locality=All Locality Types, Sex=Both sexes, and Age=All ages."
      ),
      list(
        source_dataset_id = census_2010_report_dataset_id,
        name = "GSS 2010 PHC National Analytical Report, table 4.17: population by religious affiliation and region, 2010",
        provider = "Ghana Statistical Service (GSS)",
        url = census_2010_url,
        retrieval_date = retrieval_date,
        local_path = census_2010_report_pdf_path,
        licence = list(
          name = "GSS census report, open download; no explicit reuse licence stated",
          url = census_2010_url,
          attribution = "Ghana Statistical Service (GSS)"
        ),
        citation = "Ghana Statistical Service, 2010 Population and Housing Census National Analytical Report, Table 4.17.",
        access_limits = NULL,
        redistribution_limits = "The census PDF is not committed; the derived product records checksums and attributes GSS.",
        notes = "Table 4.17 prints the old ten-region frame and one-decimal religious-affiliation percentages. The StatsBank exact counts aggregate to the report's ten regional totals and reproduce those percentages."
      )
    ),
    source_datasets(),
    list(
      list(
        source_dataset_id = ten_boundary_dataset_id,
        name = "Ghana ten-region boundary dissolved from geoBoundaries GHA ADM1 post-2019 regions",
        provider = "Places of Worship project, derived from geoBoundaries (William & Mary geoLab)",
        url = geoboundaries_gj_url,
        retrieval_date = retrieval_date,
        local_path = ten_boundary_out,
        licence = list(
          name = "Creative Commons Attribution-ShareAlike 2.0 (CC BY-SA 2.0); boundary source OpenStreetMap contributors",
          url = geoboundaries_meta_url,
          attribution = "geoBoundaries (gbOpen); boundary source OpenStreetMap contributors"
        ),
        citation = "Derived dissolve of geoBoundaries GHA ADM1 (gbOpen) to the pre-2019 ten-region frame.",
        access_limits = NULL,
        redistribution_limits = "The dissolved boundary is a CC BY-SA 2.0 derivative of the committed geoBoundaries-derived 16-region boundary.",
        notes = "The 2019 splits nest exactly inside the old ten regions: Western includes Western North; Volta includes Oti; Northern includes Savannah and North East; Brong Ahafo includes Ahafo, Bono, and Bono East; the other six regions are unchanged."
      )
    )
  )
}

# create indicator metadata for the ten-region companion product.
indicators_for_ten_region <- function() {
  denominator_note <- paste(
    "Percentages use each wave's census religion-response denominator.",
    "The 2010 counts come from GSS StatsBank exact counts aggregated to the",
    "old ten-region frame; the 2021 counts are exact sums of the existing",
    "sixteen-region product."
  )
  list(
    list(
      indicator_id = "population_total",
      label = "Census religion-response denominator",
      description = "Persons in the census religion table for the old ten-region frame.",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "2010 uses StatsBank PHC2010 POP16 exact counts; 2021 uses exact sums of the existing 16-region area-summary rows.",
      temporal_coverage = "2010 and 2021",
      spatial_coverage = "Ghana pre-2019 ten-region frame.",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious affiliation %",
      description = "Share of persons declaring any named religion.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * named-religion count / population_total. Named religion includes Catholic, Protestant, Pentecostal/Charismatic, Other Christian, Islam, Traditionalist, and Other Religion or Other.",
      temporal_coverage = "2010 and 2021",
      spatial_coverage = "Ghana pre-2019 ten-region frame.",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "No religion %",
      description = "Share of persons in the No Religion group.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * No Religion / population_total.",
      temporal_coverage = "2010 and 2021",
      spatial_coverage = "Ghana pre-2019 ten-region frame.",
      quality_notes = denominator_note
    )
  )
}

# define choropleth layer metadata for the ten-region companion product.
visual_layers_for_ten_region <- function() {
  list(
    list(
      visual_layer_id = "gh-ten-region-religious-affiliation",
      label = "Religious affiliation %",
      description = "Ghana census religious-affiliation share on the old ten-region frame.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "persons in the religion table"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported or exact-sum area value",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = "All named-religion groups count as religious affiliation."
    ),
    list(
      visual_layer_id = "gh-ten-region-no-religion",
      label = "No religion %",
      description = "Ghana census no-religion share on the old ten-region frame.",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "persons in the religion table"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported or exact-sum area value",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = "No religion is the No Religion group."
    )
  )
}

# assemble the schema-compatible ten-region area-summary document.
area_summary_document_ten_region <- function(rows) {
  list(
    schema_version = "0.2.0",
    generated_at = stamp,
    generated_by = script_id,
    country_code = country_code,
    boundary_set = list(
      boundary_set_id = ten_boundary_set_id,
      country_code = country_code,
      level = boundary_level,
      vintage = "2010-frame-dissolved-from-2019",
      source_dataset_id = ten_boundary_dataset_id
    ),
    site_snapshot = list(
      source_dataset_id = NULL,
      snapshot_date = NULL,
      basis = "no governed Ghana OpenStreetMap place-of-worship snapshot is included in this country data-map release",
      notes = "The ten-region companion product exposes census 2010 and aggregated census 2021 religion metrics only."
    ),
    source_datasets = source_datasets_ten_region(),
    indicators = indicators_for_ten_region(),
    visual_layers = visual_layers_for_ten_region(),
    rows = rows
  )
}

required_sources <- c(
  census_pdf_path,
  census_2010_statsbank_meta_path,
  census_2010_statsbank_csv_path,
  census_2010_report_pdf_path,
  geoboundaries_path,
  geoboundaries_meta_path,
  boundary_out,
  summary_json_out,
  summary_csv_out
)
invisible(lapply(required_sources, require_file))
invisible(ensure_2010_report_text(census_2010_report_pdf_path, census_2010_report_txt_path))

rows_2021_digest_before <- rows_digest(summary_json_out)

parsed <- read_census(census_pdf_path)
census_region <- build_region_frame(parsed)
if (nrow(census_region) != 16L) stop("expected 16 region rows", call. = FALSE)

boundary <- read_boundary(geoboundaries_path)
matched <- match_to_boundary(census_region, boundary)
matched <- matched[order(matched[["area_name"]]), ]

# reconcile the 2021 source rows against the national totals for every metric.
national_total <- parsed[["All locality types"]][["number"]]
national_no_religion <- parsed[["No Religion"]][["number"]]
national_affiliation <- sum(vapply(affiliation_cats, function(l) parsed[[l]][["number"]], integer(1)))
national_values <- c(
  population_total = national_total,
  religious_affiliation_count = national_affiliation,
  no_religion_count = national_no_religion
)
region_counts <- derive_counts(census_region)
recon_fields <- c("population_total", "religious_affiliation_count", "no_religion_count")
national_reconciliation_2021_sixteen <- lapply(recon_fields, function(field) {
  region_sum <- sum(region_counts[[field]])
  national_value <- as.integer(national_values[[field]])
  list(
    year = year_2021,
    boundary_set_id = boundary_set_id,
    metric = field,
    region_sum = region_sum,
    national_total = national_value,
    difference = region_sum - national_value
  )
})
for (check in national_reconciliation_2021_sixteen) {
  if (check[["difference"]] != 0) {
    stop("2021 national reconciliation failed for ", check[["metric"]], call. = FALSE)
  }
}

existing_2021_counts <- read_existing_area_summary_counts(summary_json_out)
invisible(validate_existing_2021_rows(existing_2021_counts, matched))
boundary_write <- list(
  original_build_record_tolerance_m = original_2021_boundary_simplification_tolerance_m,
  bytes = file_bytes(boundary_out),
  sha256 = sha256_file(boundary_out)
)
if (row_count_file(boundary_out) != nrow(boundary)) {
  stop("committed 2021 region boundary feature count is not 16", call. = FALSE)
}
if (!identical(boundary_write[["sha256"]], original_2021_boundary_sha256)) {
  stop("committed 2021 region boundary sha no longer matches the original build record", call. = FALSE)
}

statsbank_2010 <- read_2010_statsbank_region_counts(census_2010_statsbank_csv_path)
census_2010_ten <- aggregate_to_ten_regions(statsbank_2010[["region_counts"]])
report_table_2010 <- read_2010_report_table(census_2010_report_txt_path)
invisible(validate_2010_against_report(census_2010_ten, report_table_2010))
counts_2010 <- derive_counts_from_categories(census_2010_ten)
census_2010_ten <- cbind(census_2010_ten, counts_2010)

census_2021_ten <- aggregate_to_ten_regions(existing_2021_counts)
census_2021_ten <- data.frame(
  terr_name = census_2021_ten[["terr_name"]],
  total = census_2021_ten[["total"]],
  population_total = census_2021_ten[["total"]],
  religious_affiliation_count = census_2021_ten[["religious_affiliation_count"]],
  no_religion_count = census_2021_ten[["no_religion"]],
  religious_affiliation_percent = round(100 * census_2021_ten[["religious_affiliation_count"]] / census_2021_ten[["total"]], 2),
  no_religion_percent = round(100 * census_2021_ten[["no_religion"]] / census_2021_ten[["total"]], 2),
  stringsAsFactors = FALSE
)

ten_boundary <- dissolve_ten_region_boundary(boundary_out)
ten_boundary_write <- write_ten_boundary(ten_boundary, ten_boundary_out)
if (row_count_file(ten_boundary_out) != length(ten_region_order)) {
  stop("ten-region dissolved boundary feature count is not 10", call. = FALSE)
}
ten_boundary_attrs <- st_drop_geometry(ten_boundary)

# attach dissolved ten-region boundary identifiers and land area to count rows.
attach_ten_boundary <- function(counts) {
  boundary_index <- match(counts[["terr_name"]], ten_boundary_attrs[["area_name"]])
  if (any(is.na(boundary_index))) {
    missing <- counts[["terr_name"]][is.na(boundary_index)]
    stop("ten-region counts lack dissolved boundaries: ", paste(missing, collapse = "; "), call. = FALSE)
  }
  data.frame(
    counts,
    area_code = ten_boundary_attrs[["area_code"]][boundary_index],
    area_name = ten_boundary_attrs[["area_name"]][boundary_index],
    area_unit_id = ten_boundary_attrs[["area_unit_id"]][boundary_index],
    land_area_sq_km = ten_boundary_attrs[["land_area_sq_km"]][boundary_index],
    stringsAsFactors = FALSE
  )
}

ten_2010_matched <- attach_ten_boundary(census_2010_ten)
ten_2021_matched <- attach_ten_boundary(census_2021_ten)

ten_rows <- list()
for (old_region in ten_region_order) {
  row_2010 <- ten_2010_matched[ten_2010_matched[["terr_name"]] == old_region, , drop = FALSE]
  row_2021 <- ten_2021_matched[ten_2021_matched[["terr_name"]] == old_region, , drop = FALSE]
  ten_rows[[length(ten_rows) + 1L]] <- build_ten_area_row(
    row_2010,
    year_2010,
    c(census_2010_statsbank_dataset_id, census_2010_report_dataset_id, ten_boundary_dataset_id),
    "GSS StatsBank PHC2010 POP16 exact counts, aggregated to the printed pre-2019 ten-region frame and checked against National Analytical Report table 4.17",
    "full_response_denominator;statsbank_exact_counts;ten_region_concordance;printed_table_4_17_checked"
  )
  ten_rows[[length(ten_rows) + 1L]] <- build_ten_area_row(
    row_2021,
    year_2021,
    c(census_dataset_id, ten_boundary_dataset_id),
    "exact sum of the existing 2021 sixteen-region area-summary rows on the pre-2019 ten-region frame",
    "full_response_denominator;exact_sum_from_2021_sixteen_region_product;ten_region_concordance"
  )
}

write_json(area_summary_document_ten_region(ten_rows), ten_summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(ten_rows), ten_summary_csv_out, row.names = FALSE, na = "")
sixteen_summary_sha <- sha256_file(summary_json_out)
ten_summary_sha <- sha256_file(ten_summary_json_out)
summary_sha <- sha256_values(c(sixteen_summary_sha, ten_summary_sha))

national_counts <- derive_counts(data.frame(
  total = national_total,
  catholic = parsed[["Catholic"]][["number"]],
  protestant = parsed[["Protestant"]][["number"]],
  pentecostal_charismatic = parsed[["Pentecostal/"]][["number"]],
  other_christian = parsed[["Other Christian"]][["number"]],
  islam = parsed[["Islam"]][["number"]],
  traditionalist = parsed[["Traditionalist"]][["number"]],
  other_religion = parsed[["Other Religion"]][["number"]],
  no_religion = national_no_religion,
  stringsAsFactors = FALSE
))

national_2010_values <- c(
  population_total = statsbank_2010[["national"]][["total"]],
  religious_affiliation_count = statsbank_2010[["national"]][["total"]] - statsbank_2010[["national"]][["no_religion"]],
  no_religion_count = statsbank_2010[["national"]][["no_religion"]]
)
national_2021_ten_values <- c(
  population_total = sum(existing_2021_counts[["total"]]),
  religious_affiliation_count = sum(existing_2021_counts[["religious_affiliation_count"]]),
  no_religion_count = sum(existing_2021_counts[["no_religion"]])
)
national_reconciliation_ten <- c(
  lapply(recon_fields, function(field) {
    region_sum <- sum(ten_2010_matched[[field]])
    national_value <- as.integer(national_2010_values[[field]])
    list(
      year = year_2010,
      boundary_set_id = ten_boundary_set_id,
      metric = field,
      region_sum = region_sum,
      national_total = national_value,
      difference = region_sum - national_value
    )
  }),
  lapply(recon_fields, function(field) {
    region_sum <- sum(ten_2021_matched[[field]])
    national_value <- as.integer(national_2021_ten_values[[field]])
    list(
      year = year_2021,
      boundary_set_id = ten_boundary_set_id,
      metric = field,
      region_sum = region_sum,
      national_total = national_value,
      difference = region_sum - national_value
    )
  })
)
for (check in national_reconciliation_ten) {
  if (check[["difference"]] != 0) {
    stop("ten-region national reconciliation failed for ", check[["year"]], " / ", check[["metric"]], call. = FALSE)
  }
}

region_concordance_reconciliation <- lapply(ten_region_order, function(old_region) {
  members <- ten_region_members[[old_region]]
  source_rows <- existing_2021_counts[existing_2021_counts[["terr_name"]] %in% members, , drop = FALSE]
  ten_row <- ten_2021_matched[ten_2021_matched[["terr_name"]] == old_region, , drop = FALSE]
  list(
    year = year_2021,
    old_region = old_region,
    source_regions = members,
    population_total = as.integer(ten_row[["population_total"]]),
    source_population_total_sum = as.integer(sum(source_rows[["total"]])),
    religious_affiliation_count = as.integer(ten_row[["religious_affiliation_count"]]),
    source_religious_affiliation_sum = as.integer(sum(source_rows[["religious_affiliation_count"]])),
    no_religion_count = as.integer(ten_row[["no_religion_count"]]),
    source_no_religion_sum = as.integer(sum(source_rows[["no_religion"]]))
  )
})

# the religion table total is below the enumerated 2021 population; the gap is
# reported for context but has no not-stated category inside table 5.7.
enumerated_population_2021 <- 30832019L
religion_table_gap <- enumerated_population_2021 - national_total

# exact JSON body used to pin the 2010 StatsBank region-only CSV query.
statsbank_2010_query_body <- paste0(
  "{\"query\":[",
  "{\"code\":\"Geographical_Area\",\"selection\":{\"filter\":\"item\",\"values\":[\"Ghana\",\"Western\",\"Central\",\"Greater Accra\",\"Volta\",\"Eastern\",\"Ashanti\",\"Western North\",\"Ahafo\",\"Bono\",\"Bono East\",\"Oti\",\"Northern\",\"Savannah\",\"North East\",\"Upper East\",\"Upper West\"]}},",
  "{\"code\":\"Education\",\"selection\":{\"filter\":\"item\",\"values\":[\"Total\"]}},",
  "{\"code\":\"Religion\",\"selection\":{\"filter\":\"item\",\"values\":[\"Total\",\"No religion\",\"Catholic\",\"Protestants\",\"Pentecostal/Charismatic\",\"Other christian\",\"Islam\",\"Traditionalist\",\"Other\"]}},",
  "{\"code\":\"Locality\",\"selection\":{\"filter\":\"item\",\"values\":[\"All Locality Types\"]}},",
  "{\"code\":\"Sex\",\"selection\":{\"filter\":\"item\",\"values\":[\"Both sexes\"]}},",
  "{\"code\":\"Age\",\"selection\":{\"filter\":\"item\",\"values\":[\"All ages\"]}}",
  "],\"response\":{\"format\":\"CSV\"}}"
)

rows_2021_digest_after <- rows_digest(summary_json_out)
if (!identical(rows_2021_digest_before, rows_2021_digest_after)) {
  stop("committed 2021 sixteen-region rows changed during the build", call. = FALSE)
}

validation_checks <- c(
  "The committed 2021 sixteen-region product is read and validated against GSS 2021 PHC General Report Volume 3C table 5.7; it is not rewritten by this script.",
  "Every 2021 source region's eight religion groups sum exactly to its printed regional total, and the eight national numbers sum exactly to the national total.",
  "Each religion group's 16 region values sum exactly to its printed national Number.",
  "The 2021 sixteen-region rows sum exactly to the national total for the denominator, religious affiliation, and no religion.",
  "All 16 census region rows join to the 16 geoBoundaries GHA ADM1 features by normalised name (the boundary ' Region' suffix dropped).",
  "The 2010 StatsBank POP16 table returns exact counts for Ghana plus the 16 current regions for Total, No religion, Catholic, Protestants, Pentecostal/Charismatic, Other christian, Islam, Traditionalist, and Other.",
  "The 2010 sixteen current-region counts aggregate exactly to the ten old regions; those ten totals match National Analytical Report table 4.17, and one-decimal percentages reproduce table 4.17.",
  "The 2021 ten-region companion rows are exact sums of the existing 2021 sixteen-region product under the ten-to-sixteen concordance.",
  sprintf("The dissolved ten-region boundary GeoJSON writes to %d bytes after dissolving the committed 16-region boundary; the %d m tolerance is carried from the original 2021 build record, and this run validates that committed boundary by feature count and sha.", ten_boundary_write[["bytes"]], boundary_write[["original_build_record_tolerance_m"]]),
  "The dissolved ten-region boundary is a CC BY-SA 2.0 derivative of the geoBoundaries GHA ADM1 / OpenStreetMap-derived boundary.",
  sprintf("The table 5.7 total (%d) is %d below the enumerated 2021 population (%d, Table 1.1); the gap is outside the religion table and there is no not-stated category within it.", national_total, religion_table_gap, enumerated_population_2021)
)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:gh-census-religion:gh:2010-2021:gss-statsbank-pop16-vol3c",
  dataset_id = "gh-census-religion:gh:2010-2021:gss-statsbank-pop16-vol3c",
  dataset_version_id = paste0("gh-census-religion:gh:2010-2021:gss-statsbank-pop16-vol3c:", substr(summary_sha, 1, 12)),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "gh-census-religion",
  dataset_role = "public_product",
  scope = list(
    level = "country",
    country_codes = list(country_code),
    snapshot_date = NULL,
    snapshot_anchor = NULL,
    pipeline_stage = "public"
  ),
  created_at = stamp,
  created_by = script_id,
  pipeline = list(
    script = script_id,
    git_commit = NULL,
    command = paste("Rscript", script_id),
    parameters = list(
      waves = c("2010", "2021"),
      existing_sixteen_region_product = "left byte-identical; read for 2021 aggregation only",
      sixteen_region_boundary_set = boundary_set_id,
      ten_region_boundary_set = ten_boundary_set_id,
      ten_region_boundary_derivation = "dissolve existing apps/regions/gh/data/gh_region_2019.geojson by the post-2019-to-pre-2019 nesting table",
      statsbank_2010_table_id = "PHC2010/Population/POP16 Population by Religious Affiliation, Age, Sex, Locality, and Geographic_Area.px",
      statsbank_2010_post_body = statsbank_2010_query_body,
      pdf_extraction = "poppler pdftotext -layout, 2010 National Analytical Report table 4.17 and 2021 Vol. 3C table 5.7",
      denominator = "census religion table total; no not-stated category is excluded",
      omitted_metrics = c("religious_change", "places_per_10000_residents", "place_density_per_sq_km")
    ),
    software_versions = list(
      r = paste(R.version[["major"]], R.version[["minor"]], sep = "."),
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")),
      pdftotext = "poppler pdftotext (system)"
    )
  ),
  source = list(
    provider = "Ghana Statistical Service (GSS); geoBoundaries (William & Mary geoLab)",
    source_dataset_ids = c(
      census_2010_statsbank_dataset_id,
      census_2010_report_dataset_id,
      census_dataset_id,
      boundary_dataset_id,
      ten_boundary_dataset_id
    ),
    source_urls = c(
      statsbank_2010_table_api_url,
      statsbank_2010_table_ui_url,
      census_2010_url,
      census_pdf_url,
      census_landing_url,
      geoboundaries_meta_url,
      geoboundaries_gj_url
    ),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = paste(
      "GSS StatsBank PHC2010 POP16 and the GSS 2010 and 2021 census reports",
      "are open web sources with no explicit reuse licence stated; derived",
      "products attribute GSS and link the source of record. The 16-region",
      "boundary and the dissolved ten-region derivative are geoBoundaries GHA",
      "ADM1 / OpenStreetMap-derived material under CC BY-SA 2.0."
    ),
    citation = "GSS StatsBank PHC2010 POP16; GSS 2010 PHC National Analytical Report Table 4.17; GSS 2021 PHC General Report Volume 3C Table 5.7; geoBoundaries GHA ADM1 (gbOpen).",
    raw_redistribution = "Raw census PDFs, StatsBank query files, and geoBoundaries source GeoJSON remain in data/raw/gh_census/ and await any project-controlled raw archive upload."
  ),
  input_manifests = list(),
  raw_sources = list(
    raw_source_record(
      census_2010_statsbank_meta_path, statsbank_2010_table_api_url, "json", NA_integer_, census_2010_statsbank_dataset_id, TRUE, "2010",
      "StatsBank PHC2010 POP16 metadata for the religious-affiliation table; queried with curl -k because the server TLS chain did not verify locally."
    ),
    raw_source_record(
      census_2010_statsbank_csv_path, statsbank_2010_table_api_url, "csv", 153L, census_2010_statsbank_dataset_id, TRUE, "2010",
      "StatsBank PHC2010 POP16 CSV POST query selecting Ghana plus the 16 current regions, Total education, All Locality Types, Both sexes, All ages, and Total plus eight religion groups."
    ),
    raw_source_record(
      census_2010_report_pdf_path, census_2010_url, "pdf", 10L, census_2010_report_dataset_id, TRUE, "2010",
      "2010 PHC National Analytical Report PDF; table 4.17 gives the printed old ten-region frame and one-decimal religion percentages used to validate the StatsBank exact counts."
    ),
    raw_source_record(
      census_pdf_path, census_pdf_url, "pdf", 16L, census_dataset_id, TRUE, "2021",
      "2021 PHC General Report Volume 3C PDF (GSS census portal); table 5.7 yields the eight religion groups for the 16 regions plus the national Number column."
    ),
    raw_source_record(
      geoboundaries_path, geoboundaries_gj_url, "geojson", 16L, boundary_dataset_id, TRUE, "2019",
      "geoBoundaries GHA ADM1 GeoJSON; 16 region features with ISO 3166-2 shapeISO codes, matching the post-2019 regional structure."
    ),
    raw_source_record(
      geoboundaries_meta_path, geoboundaries_meta_url, "json", NA_integer_, boundary_dataset_id, FALSE, "2019",
      "geoBoundaries GHA ADM1 metadata; records the CC BY-SA 2.0 licence and the OpenStreetMap boundary source."
    )
  ),
  durable_files = list(
    manifest_file_record(summary_json_out, "Existing Ghana 16-region area summary with GSS census 2021 religious-affiliation and no-religion metrics; rows left byte-identical.", licence_status),
    manifest_file_record(summary_csv_out, "Existing flattened Ghana 16-region area summary with GSS census 2021 metrics; left untouched.", licence_status),
    manifest_file_record(boundary_out, "Existing simplified Ghana 16-region boundary GeoJSON derived from geoBoundaries GHA ADM1.", "geoboundaries_cc_by_sa_2_0"),
    manifest_file_record(ten_summary_json_out, "Ghana old ten-region area summary with 2010 StatsBank counts and exact 2021 sums from the sixteen-region product.", licence_status),
    manifest_file_record(ten_summary_csv_out, "Flattened Ghana old ten-region area summary with 2010 and 2021 census religion metrics.", licence_status),
    manifest_file_record(ten_boundary_out, "Dissolved Ghana old ten-region boundary GeoJSON derived from the existing geoBoundaries GHA ADM1 product.", "geoboundaries_cc_by_sa_2_0")
  ),
  derived_outputs = list(
    list(
      uri = paste0("repo:", summary_json_out),
      sha256 = sixteen_summary_sha,
      built_by = script_id,
      notes = "Existing 16 region reporting units x 1 census year; file is not rewritten by this extension."
    ),
    list(
      uri = paste0("repo:", ten_summary_json_out),
      sha256 = ten_summary_sha,
      built_by = script_id,
      notes = "10 old-region reporting units x 2 census years; 2010 exact StatsBank counts and 2021 exact sums from the existing 16-region product."
    ),
    list(
      uri = paste0("repo:", ten_boundary_out),
      sha256 = sha256_file(ten_boundary_out),
      built_by = script_id,
      notes = "10 pre-2019 region features dissolved from the existing 16-region boundary product."
    )
  ),
  validation = list(
    checks = validation_checks,
    join_coverage = list(
      region_2021_sixteen = list(list(
        boundary_level = boundary_level,
        year = year_2021,
        matched_area_count = nrow(matched),
        expected_area_count = nrow(boundary),
        missing_area_names = list()
      )),
      region_2010_2021_ten = list(
        list(
          boundary_level = boundary_level,
          year = year_2010,
          matched_area_count = nrow(ten_2010_matched),
          expected_area_count = length(ten_region_order),
          missing_area_names = list()
        ),
        list(
          boundary_level = boundary_level,
          year = year_2021,
          matched_area_count = nrow(ten_2021_matched),
          expected_area_count = length(ten_region_order),
          missing_area_names = list()
        )
      )
    ),
    national_reconciliation = c(national_reconciliation_2021_sixteen, national_reconciliation_ten),
    region_concordance_reconciliation = region_concordance_reconciliation,
    printed_2010_report_reconciliation = list(
      source = "2010 PHC National Analytical Report table 4.17",
      totals_exact = TRUE,
      one_decimal_percentages_match = TRUE
    ),
    national_excluded_share_percent = 0,
    existing_2021_rows_sha256_before = rows_2021_digest_before,
    existing_2021_rows_sha256_after = rows_2021_digest_after,
    existing_2021_rows_byte_identical = identical(rows_2021_digest_before, rows_2021_digest_after),
    boundary_validation = list(
      source_gh_feature_count = nrow(boundary),
      output_feature_count_2021_sixteen = row_count_file(boundary_out),
      output_feature_count_2010_ten = row_count_file(ten_boundary_out),
      expected_feature_count_2010_ten = length(ten_region_order),
      output_bytes_2021_sixteen = boundary_write[["bytes"]],
      output_bytes_2010_ten = ten_boundary_write[["bytes"]],
      original_build_record_simplification_tolerance_m_2021_sixteen = boundary_write[["original_build_record_tolerance_m"]],
      original_build_record_boundary_sha256_2021_sixteen = original_2021_boundary_sha256,
      committed_boundary_sha256_2021_sixteen = boundary_write[["sha256"]],
      committed_boundary_validation_basis_2021_sixteen = "feature count and sha matched this run; simplification tolerance is carried from the original 2021 build record",
      dissolved_from_existing_2021_boundary = TRUE,
      unmatched_boundary_features = list(),
      unmatched_census_areas = list()
    )
  ),
  construct_notes = list(
    "The live Ghana map remains the existing 2021 sixteen-region product.",
    "The companion product places 2010 and 2021 on the old pre-2019 ten-region frame.",
    "The 2010 exact counts come from GSS StatsBank PHC2010 POP16. StatsBank currently exposes the 2010 counts on the post-2019 sixteen-region list; those rows aggregate exactly to the old ten regions printed in the 2010 National Analytical Report table 4.17.",
    "The 2021 ten-region rows are exact sums of the existing 2021 sixteen-region product. The existing 2021 rows remain byte-identical.",
    "Religious affiliation combines Catholic, Protestant or Protestants, Pentecostal/Charismatic, Other Christian or Other christian, Islam, Traditionalist, and Other Religion or Other. No religion is the No Religion group.",
    sprintf("The table 5.7 total (%d) is %d below the enumerated 2021 population (%d, Table 1.1); the gap sits outside the religion table and there is no not-stated category within table 5.7.", national_total, religion_table_gap, enumerated_population_2021)
  ),
  category_mapping = list(
    list(source_year = 2010, source_category = "Total", product_field = "population_total", product_role = "denominator"),
    list(source_year = 2010, source_category = "No religion", product_field = "no_religion_count", product_role = "no religion"),
    list(source_year = 2010, source_category = "Catholic", product_field = "religious_affiliation_count", product_role = "named religion"),
    list(source_year = 2010, source_category = "Protestants", product_field = "religious_affiliation_count", product_role = "named religion"),
    list(source_year = 2010, source_category = "Pentecostal/Charismatic", product_field = "religious_affiliation_count", product_role = "named religion"),
    list(source_year = 2010, source_category = "Other christian", product_field = "religious_affiliation_count", product_role = "named religion"),
    list(source_year = 2010, source_category = "Islam", product_field = "religious_affiliation_count", product_role = "named religion"),
    list(source_year = 2010, source_category = "Traditionalist", product_field = "religious_affiliation_count", product_role = "named religion"),
    list(source_year = 2010, source_category = "Other", product_field = "religious_affiliation_count", product_role = "named religion"),
    list(source_year = 2021, source_category = "Total", product_field = "population_total", product_role = "denominator"),
    list(source_year = 2021, source_category = "No Religion", product_field = "no_religion_count", product_role = "no religion"),
    list(source_year = 2021, source_category = "Catholic; Protestant; Pentecostal/Charismatic; Other Christian; Islam; Traditionalist; Other Religion", product_field = "religious_affiliation_count", product_role = "named religion")
  ),
  retrieval_calls = list(
    list(
      purpose = "StatsBank root",
      method = "GET",
      url = statsbank_2010_api_root,
      note = "The working API root is /api/v1/en; /pxweb/api/v1/en returned a 500 error."
    ),
    list(
      purpose = "StatsBank PHC2010 Population table list",
      method = "GET",
      url = paste0(statsbank_2010_api_root, "/PHC2010/Population")
    ),
    list(
      purpose = "StatsBank PHC2010 POP16 metadata",
      method = "GET",
      url = statsbank_2010_table_api_url,
      local_path = census_2010_statsbank_meta_path,
      sha256 = sha256_file(census_2010_statsbank_meta_path)
    ),
    list(
      purpose = "StatsBank PHC2010 POP16 region-religion CSV",
      method = "POST",
      url = statsbank_2010_table_api_url,
      content_type = "application/json",
      body = statsbank_2010_query_body,
      local_path = census_2010_statsbank_csv_path,
      sha256 = sha256_file(census_2010_statsbank_csv_path),
      note = "curl used -k because local certificate verification failed for statsbank.statsghana.gov.gh."
    ),
    list(
      purpose = "2010 National Analytical Report PDF",
      method = "GET",
      url = census_2010_url,
      local_path = census_2010_report_pdf_path,
      sha256 = sha256_file(census_2010_report_pdf_path)
    )
  ),
  deferred_sources = list(
    list(
      source_dataset_id = "gss-2021-statsbank-religion-by-district",
      url = statsbank_district_url,
      local_path = NULL,
      notes = "The 2021 StatsBank table publishes 2021 religion by district (261 units), but district extraction remains outside this ten-region companion build; the existing 2021 region product remains the live map product."
    ),
    list(
      source_dataset_id = "gss-2000-phc-religion-by-region",
      url = census_2000_url,
      local_path = NULL,
      notes = "The 2000 PHC published religion using the same eight-group scheme on the pre-2019 ten-region geography. It remains deferred."
    )
  ),
  privacy = "public",
  licence_status = licence_status,
  downstream_status = "public",
  source_datasets = source_datasets_ten_region(),
  notes = "The committed outputs now include the unchanged live 2021 sixteen-region product plus a separate old ten-region 2010-2021 companion product. UI wiring is intentionally unchanged."
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
manifest_text <- paste(readLines(manifest_out, warn = FALSE), collapse = "\n")
if (!jsonlite::validate(manifest_text)) stop("manifest JSON failed jsonlite validation", call. = FALSE)

cat(sprintf("left %s unchanged: rows sha256 %s\n", summary_json_out, rows_2021_digest_after))
cat(sprintf("wrote %s: %d rows\n", ten_summary_json_out, length(ten_rows)))
cat(sprintf("wrote %s: %d rows\n", ten_summary_csv_out, row_count_file(ten_summary_csv_out)))
cat(sprintf("wrote %s: %d features, %d bytes\n", ten_boundary_out, row_count_file(ten_boundary_out), file_bytes(ten_boundary_out)))
cat(sprintf("wrote %s\n", manifest_out))
cat(sprintf("2010 national denominator: %d; religious affiliation: %d; no religion: %d\n",
            national_2010_values[["population_total"]],
            national_2010_values[["religious_affiliation_count"]],
            national_2010_values[["no_religion_count"]]))
cat(sprintf("2021 old-ten denominator: %d; religious affiliation: %d; no religion: %d\n",
            national_2021_ten_values[["population_total"]],
            national_2021_ten_values[["religious_affiliation_count"]],
            national_2021_ten_values[["no_religion_count"]]))
cat("national reconciliation: exact for denominator, religious affiliation, and no religion (2010 ten regions and 2021 ten-region aggregation)\n")
