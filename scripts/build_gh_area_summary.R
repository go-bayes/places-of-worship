# build the ghana region area-summary product from the GSS 2021 census.
# inputs: the 2021 Population and Housing Census General Report Volume 3C
# (Background Characteristics), table 5.7 (population by religious affiliation,
# sex and region) and the geoBoundaries GHA ADM1 (16 post-2019 regions) GeoJSON.
# outputs: apps/regions/gh/data/gh_region_2019.geojson,
# apps/regions/gh/data/area_summary_region.{json,csv}, and
# docs/manifests/gh-census-religion-2021.json.
# run from the repo root: Rscript scripts/build_gh_area_summary.R
# the table is parsed from the PDF with poppler pdftotext -layout; every number
# comes from table 5.7 and is reconciled against the printed regional totals and
# the national number column.

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

boundary_set_id <- "gh-region-2019-geoboundaries-adm1"
boundary_level <- "region"
census_dataset_id <- "gss-2021-phc-vol3c-table-5-7-religion-by-region"
boundary_dataset_id <- "geoboundaries-gha-adm1-2019"

# source urls recorded in the manifest and the on-page attribution. the census
# pdf is the 2021 PHC General Report Volume 3C, hosted on the GSS census portal.
census_pdf_url <- "https://census2021.statsghana.gov.gh/gssmain/fileUpload/reportthemelist/2021%20PHC%20General%20Report%20Vol%203C_Background%20Characteristics_181121.pdf"
census_landing_url <- "https://census2021.statsghana.gov.gh/"
statsbank_district_url <- "https://statsbank.statsghana.gov.gh/pxweb/en/PHC%202021%20StatsBank/PHC%202021%20StatsBank__Population/religion_table.px/"
census_2010_url <- "https://new-ndpc-static1.s3.amazonaws.com/pubication/2010PHC+National+Analytical+Report.pdf"
census_2000_url <- "https://statsbank.statsghana.gov.gh/censusatlas/Religion.html"
geoboundaries_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/GHA/ADM1/"
geoboundaries_gj_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/GHA/ADM1/geoBoundaries-GHA-ADM1.geojson"

census_pdf_path <- file.path(raw_dir, "gh_2021_vol3c.pdf")
geoboundaries_path <- file.path(raw_dir, "geoBoundaries-GHA-ADM1.geojson")
geoboundaries_meta_path <- file.path(raw_dir, "gb_gha_adm1_meta.json")

boundary_out <- file.path(gh_dir, "gh_region_2019.geojson")
summary_json_out <- file.path(gh_dir, "area_summary_region.json")
summary_csv_out <- file.path(gh_dir, "area_summary_region.csv")
manifest_out <- file.path(manifest_dir, "gh-census-religion-2021.json")

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

# stop early if a required raw source has not been downloaded.
require_file <- function(path) {
  if (!file.exists(path)) stop("missing required source: ", path, call. = FALSE)
}

# compute the sha-256 digest for a local file.
sha256_file <- function(path) {
  unname(tools::sha256sum(path))
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

# write the boundary, increasing simplification tolerance until it is small.
write_simplified_boundary <- function(boundary, output_path, field_names) {
  boundary_fields <- boundary[, field_names]
  tolerances <- c(50, 100, 200, 500, 1000, 1500, 2000)
  for (tolerance in tolerances) {
    candidate <- st_transform(boundary_fields, africa_aea)
    candidate <- st_simplify(candidate, dTolerance = tolerance, preserveTopology = TRUE)
    candidate <- st_make_valid(st_transform(candidate, 4326))
    if (any(st_is_empty(candidate))) next
    st_write(
      candidate,
      output_path,
      driver = "GeoJSON",
      delete_dsn = TRUE,
      quiet = TRUE,
      layer_options = c("COORDINATE_PRECISION=5")
    )
    bytes <- file_bytes(output_path)
    if (bytes <= 3000000L) return(list(tolerance_m = tolerance, bytes = bytes))
  }
  stop("simplified GH boundary remains above 3 MB", call. = FALSE)
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

required_sources <- c(census_pdf_path, geoboundaries_path)
invisible(lapply(required_sources, require_file))

parsed <- read_census(census_pdf_path)
census_region <- build_region_frame(parsed)
if (nrow(census_region) != 16L) stop("expected 16 region rows", call. = FALSE)

boundary <- read_boundary(geoboundaries_path)
matched <- match_to_boundary(census_region, boundary)
matched <- matched[order(matched[["area_name"]]), ]

# reconcile the region rows against the national totals for every metric. the
# national figures are the table 5.7 Number column: the total, the seven named
# religions (summed to religious affiliation), and no religion.
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
national_reconciliation <- lapply(recon_fields, function(field) {
  region_sum <- sum(region_counts[[field]])
  national_value <- as.integer(national_values[[field]])
  list(
    year = year,
    metric = field,
    region_sum = region_sum,
    national_total = national_value,
    difference = region_sum - national_value
  )
})
for (check in national_reconciliation) {
  if (check[["difference"]] != 0) {
    stop("national reconciliation failed for ", check[["metric"]], call. = FALSE)
  }
}

boundary_write <- write_simplified_boundary(
  boundary,
  boundary_out,
  c("area_code", "area_name", "area_unit_id", "boundary_set_id",
    "boundary_level", "shape_id", "land_area_sq_km")
)
if (row_count_file(boundary_out) != nrow(boundary)) {
  stop("region boundary feature count changed during simplification", call. = FALSE)
}

rows <- lapply(seq_len(nrow(matched)), function(index) {
  build_area_row(matched[index, , drop = FALSE])
})

write_json(area_summary_document(rows), summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

join_coverage <- list(
  boundary_level = boundary_level,
  year = year,
  matched_area_count = nrow(matched),
  expected_area_count = nrow(boundary),
  missing_area_names = list()
)

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

# the religion table total is below the enumerated 2021 population; the gap is
# reported for context but has no not-stated category inside table 5.7.
enumerated_population_2021 <- 30832019L
religion_table_gap <- enumerated_population_2021 - national_total

validation_checks <- c(
  "Table 5.7 is the 2021 PHC General Report Volume 3C population-by-religious-affiliation-sex-and-region table; the Both Sexes / all-locality block gives the eight religion groups for the 16 regions plus a national Number column, parsed with pdftotext -layout.",
  "Every region's eight religion groups sum exactly to its printed regional total, and the eight national numbers sum exactly to the national total.",
  "Each religion group's 16 region values sum exactly to its printed national Number.",
  "The 16 region rows sum exactly to the national total for the denominator, religious affiliation, and no religion.",
  "All 16 census region rows join to the 16 geoBoundaries GHA ADM1 features by normalised name (the boundary ' Region' suffix dropped).",
  sprintf("The simplified region boundary GeoJSON writes to %d bytes after %d m simplification.", boundary_write[["bytes"]], boundary_write[["tolerance_m"]]),
  "Percentages use the table 5.7 regional total as the denominator; the census allocates every person to one of eight groups, so nothing is excluded.",
  sprintf("The table 5.7 total (%d) is %d below the enumerated 2021 population (%d, Table 1.1); the gap is outside the religion table and there is no not-stated category within it.", national_total, religion_table_gap, enumerated_population_2021),
  "The 2021 census wave is the only wave shipped: 2010 and 2000 region religion use the pre-2019 ten-region geography and district religion for 2021 lives in the interactive StatsBank PxWeb table whose REST API returned server errors during this build, so those routes are deferred."
)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:gh-census-religion:gh:2021:gss-vol3c-table-5-7",
  dataset_id = "gh-census-religion:gh:2021:gss-vol3c-table-5-7",
  dataset_version_id = paste0("gh-census-religion:gh:2021:gss-vol3c-table-5-7:", substr(sha256_file(summary_json_out), 1, 12)),
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
      waves = c("2021"),
      region_boundary_set = boundary_set_id,
      region_boundary_simplification_tolerance_m = boundary_write[["tolerance_m"]],
      pdf_extraction = "poppler pdftotext -layout, table 5.7 Both Sexes / all-locality block",
      denominator = "table 5.7 regional total (no not-stated category)",
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
    source_dataset_ids = c(census_dataset_id, boundary_dataset_id),
    source_urls = c(census_pdf_url, census_landing_url, geoboundaries_meta_url, geoboundaries_gj_url),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = licence_text,
    citation = "GSS, 2021 PHC General Report Volume 3C, Table 5.7; geoBoundaries GHA ADM1 (gbOpen).",
    raw_redistribution = "The census PDF and the geoBoundaries source GeoJSON are not committed. They remain in data/raw/gh_census/ and await any project-controlled raw archive upload."
  ),
  input_manifests = list(),
  raw_sources = list(
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
    manifest_file_record(summary_json_out, "Ghana region area summary with GSS census 2021 religious-affiliation and no-religion metrics.", licence_status),
    manifest_file_record(summary_csv_out, "Flattened Ghana region area summary with GSS census 2021 religious-affiliation and no-religion metrics.", licence_status),
    manifest_file_record(boundary_out, "Simplified Ghana region boundary GeoJSON derived from geoBoundaries GHA ADM1 (16 post-2019 regions).", "geoboundaries_cc_by_sa_2_0")
  ),
  derived_outputs = list(
    list(
      uri = paste0("repo:", summary_json_out),
      sha256 = sha256_file(summary_json_out),
      built_by = script_id,
      notes = "16 region reporting units x 1 census year; denominator is the table 5.7 regional total."
    ),
    list(
      uri = paste0("repo:", boundary_out),
      sha256 = sha256_file(boundary_out),
      built_by = script_id,
      notes = sprintf("16 geoBoundaries GHA ADM1 region features simplified at %d m tolerance.", boundary_write[["tolerance_m"]])
    )
  ),
  validation = list(
    checks = validation_checks,
    join_coverage = list(region = list(join_coverage)),
    national_reconciliation = national_reconciliation,
    national_excluded_share_percent = 0,
    boundary_validation = list(
      source_gh_feature_count = nrow(boundary),
      output_feature_count = row_count_file(boundary_out),
      expected_feature_count = nrow(boundary),
      output_bytes = boundary_write[["bytes"]],
      simplification_tolerance_m = boundary_write[["tolerance_m"]],
      unmatched_boundary_features = list(),
      unmatched_census_areas = list()
    )
  ),
  construct_notes = list(
    "The public map displays two headline metrics for 2021: religious affiliation percent and no religion percent.",
    "The denominator is the table 5.7 regional total (all locality types, both sexes); the census allocates every person to one of eight religion groups, so there is no not-stated category to exclude.",
    "Religious affiliation combines the seven named-religion groups: Catholic, Protestant, Pentecostal/Charismatic, Other Christian, Islam, Traditionalist, and Other Religion. Christian in table 5.7 is a printed subtotal of the four Christian groups and is not double-counted.",
    "No religion is the No Religion group.",
    sprintf("The table 5.7 total (%d) is %d below the enumerated 2021 population (%d, Table 1.1); the gap sits outside the religion table and there is no not-stated category within table 5.7.", national_total, religion_table_gap, enumerated_population_2021),
    "The finest religion geography published in Volume 3C is the region; district religion is not in Volume 3C. The 2021 StatsBank PxWeb table publishes religion by district, but its REST API returned server errors during this build, so the district route is recorded as deferred."
  ),
  deferred_sources = list(
    list(
      source_dataset_id = "gss-2021-statsbank-religion-by-district",
      url = statsbank_district_url,
      local_path = NULL,
      notes = "The 2021 StatsBank PxWeb table 'Population by Religious Affiliation, District, Region, Type of Locality, Age, Sex, and Education' publishes 2021 religion by district (261 units). Its PxWeb REST API returned HTTP 500/404 during this build, so a clean district extract was not attainable. A district product is deferred until the PxWeb API is queryable or a district analytical report PDF is located; the ADM2 boundary route is geoBoundaries GHA ADM2 (CC BY 4.0)."
    ),
    list(
      source_dataset_id = "gss-2010-phc-national-analytical-report-religion-by-region",
      url = census_2010_url,
      local_path = NULL,
      notes = "The 2010 PHC National Analytical Report Table 4.17 publishes population by religious affiliation and region, but on the pre-2019 ten-region geography (Western, Central, Greater Accra, Volta, Eastern, Ashanti, Brong Ahafo, Northern, Upper East, Upper West). The 2019 reform split four of those regions into the 16 the 2021 map uses, so 2010 region religion is not comparable on the 2021 boundaries without a concordance. Deferred pending a ten-to-sixteen region crosswalk."
    ),
    list(
      source_dataset_id = "gss-2000-phc-religion-by-region",
      url = census_2000_url,
      local_path = NULL,
      notes = "The 2000 PHC published religion using the same eight-group scheme on the pre-2019 ten-region geography (GSS StatsBank census atlas and the IPUMS International 10% microdata sample). As with 2010, the ten-region geography is incompatible with the 2021 sixteen-region boundaries. Deferred pending a concordance."
    )
  ),
  privacy = "public",
  licence_status = licence_status,
  downstream_status = "public",
  source_datasets = source_datasets(),
  notes = "The committed products contain the derived region area summary and simplified boundary only. On-page attribution cites GSS and geoBoundaries (CC BY-SA 2.0, OpenStreetMap)."
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
manifest_text <- paste(readLines(manifest_out, warn = FALSE), collapse = "\n")
if (!jsonlite::validate(manifest_text)) stop("manifest JSON failed jsonlite validation", call. = FALSE)

cat(sprintf("wrote %s: %d rows\n", summary_json_out, length(rows)))
cat(sprintf("wrote %s: %d rows\n", summary_csv_out, row_count_file(summary_csv_out)))
cat(sprintf("wrote %s: %d features, %d bytes at %d m\n", boundary_out, row_count_file(boundary_out), file_bytes(boundary_out), boundary_write[["tolerance_m"]]))
cat(sprintf("wrote %s\n", manifest_out))
cat(sprintf("join coverage: %d/%d\n", join_coverage[["matched_area_count"]], join_coverage[["expected_area_count"]]))
cat(sprintf("national denominator: %d; religious affiliation: %d (%.2f%%); no religion: %d (%.2f%%)\n",
            national_counts[["population_total"]][[1]],
            national_counts[["religious_affiliation_count"]][[1]],
            national_counts[["religious_affiliation_percent"]][[1]],
            national_counts[["no_religion_count"]][[1]],
            national_counts[["no_religion_percent"]][[1]]))
cat(sprintf("table 5.7 total vs enumerated 2021 population gap: %d\n", religion_table_gap))
cat("national reconciliation: exact for denominator, religious affiliation, and no religion (16 regions)\n")
