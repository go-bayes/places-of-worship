# build the malawi district area-summary product from the NSO 2018 census.
# inputs: the 2018 Malawi Population and Housing Census Main Report PDF
# (table E5, population of Malawi by denomination, region, and district)
# and the geoBoundaries MWI ADM2 (2020 districts) GeoJSON.
# outputs: apps/regions/mw/data/mw_district_2020.geojson,
# apps/regions/mw/data/area_summary_district.{json,csv}, and
# docs/manifests/mw-census-religion-2018.json.
# run from the repo root: Rscript scripts/build_mw_area_summary.R
# the table is parsed from the PDF with poppler pdftotext -layout; every
# number comes from table E5 and is reconciled against the MALAWI row.

suppressMessages({
  library(jsonlite)
  library(sf)
})

raw_dir <- "data/raw/mw_census"
mw_dir <- "apps/regions/mw/data"
manifest_dir <- "docs/manifests"
dir.create(mw_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- "2026-07-09"
script_id <- "scripts/build_mw_area_summary.R"
country_code <- "MW"
year <- 2018L

boundary_set_id <- "mw-district-2020-geoboundaries-adm2"
boundary_level <- "district"
census_dataset_id <- "nso-2018-phc-table-e5-religion-by-district"
boundary_dataset_id <- "geoboundaries-mwi-adm2-2020"

# source urls recorded in the manifest and the on-page attribution. the pdf is
# the NSO 2018 census main report, hosted by UNFPA Malawi; the NSO landing page
# is the source of record but is client-rendered.
census_pdf_url <- "https://malawi.unfpa.org/sites/default/files/resource-pdf/2018%20Malawi%20Population%20and%20Housing%20Census%20Main%20Report%20(1).pdf"
census_landing_url <- "https://www.nsomalawi.mw/2018-population-and-housing-census/"
geoboundaries_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/MWI/ADM2/"
geoboundaries_gj_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/MWI/ADM2/geoBoundaries-MWI-ADM2.geojson"

census_pdf_path <- file.path(raw_dir, "mw_2018_main_report.pdf")
census_2008_pdf_path <- file.path(raw_dir, "mw_2008_main_report.pdf")
geoboundaries_path <- file.path(raw_dir, "geoBoundaries-MWI-ADM2.geojson")
geoboundaries_meta_path <- file.path(raw_dir, "gb_mwi_adm2_meta.json")

boundary_out <- file.path(mw_dir, "mw_district_2020.geojson")
summary_json_out <- file.path(mw_dir, "area_summary_district.json")
summary_csv_out <- file.path(mw_dir, "area_summary_district.csv")
manifest_out <- file.path(manifest_dir, "mw-census-religion-2018.json")

licence_text <- paste(
  "NSO 2018 Malawi Population and Housing Census Main Report, table E5",
  "(population of Malawi by denomination, region, and district). The National",
  "Statistical Office publishes the census report for open download; no",
  "explicit reuse licence is stated, so the derived product attributes NSO",
  "Malawi and links the source of record. Boundaries are geoBoundaries MWI",
  "ADM2 (2020 districts), Creative Commons Attribution 3.0 IGO, boundary",
  "source National Statistics Office of Malawi and OCHA ROSEA via HDX."
)
licence_status <- "accepted"
# terms identity preserved separately from the shipping decision (schema v2)
licence_basis <- "nso_census_open_report_attribution_geoboundaries_cc_by_3_igo"

# the 11 columns of table E5, in printed order, plus the leading total.
# other_denomination folds Buddhism, Hinduism, and other non-Christian
# denominations that table 3.4 reports as separate national rows.
nab_labels <- c(
  "total", "catholic", "ccap", "sda_baptist_apostolic", "anglican",
  "pentecostal", "other_christian", "islam", "traditional",
  "other_denomination", "no_religion"
)

# the nine named-religion columns that make up religious affiliation; every
# category except no religion. table E5 carries no not-stated residual, so the
# named religions plus no religion exhaust the total.
affiliation_cols <- c(
  "catholic", "ccap", "sda_baptist_apostolic", "anglican", "pentecostal",
  "other_christian", "islam", "traditional", "other_denomination"
)

# the three region subtotal rows and the national row are dropped before the
# district join; only the 32 district and city rows carry through.
region_rows <- c("Northern", "Central", "Southern")

# the census breaks out four cities as their own rows; geoBoundaries ADM2 has
# no city polygons, so each city folds into the district that encloses it.
city_parent <- c(
  "Lilongwe City" = "Lilongwe",
  "Blantyre City" = "Blantyre",
  "Zomba City" = "Zomba",
  "Mzuzu City" = "Mzimba"
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

# normalise a district label so the census and geoBoundaries spellings compare
# equal: lowercase, punctuation to spaces, collapse whitespace.
mw_norm <- function(x) {
  x <- tolower(trimws(as.character(x)))
  x <- gsub("[^a-z0-9]+", " ", x)
  trimws(gsub("\\s+", " ", x))
}

# stable slug used as the area code, since geoBoundaries MWI ADM2 carries no
# ISO or official district code (shapeISO is empty for every feature).
mw_slug <- function(x) {
  gsub(" ", "-", mw_norm(x))
}

# extract table E5 with poppler pdftotext -layout, then parse the both-sexes
# block: the MALAWI row, three region subtotals, and 32 district/city rows.
# each data row is a name followed by 11 fields (total plus 10 denomination
# columns); a "-" field is a printed zero (Likoma has no Traditional count).
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
  # the real table header carries the period after E5; the contents entry does
  # not, so requiring "E5. Population" skips the table-of-contents line.
  hdr <- grep("Table E5\\. Population of Malawi by Denomination", txt)
  if (length(hdr) < 1L) stop("could not locate table E5", call. = FALSE)
  window <- txt[hdr[1]:length(txt)]

  # a data row is a district/region/national name and 11 comma-formatted
  # integers or "-" placeholders.
  num <- "(?:[0-9][0-9,]*|-)"
  pat <- paste0("^\\s*([A-Za-z][A-Za-z .'/-]*?[A-Za-z.])\\s+(", num,
                "(?:\\s+", num, "){10})\\s*$")

  parse_field <- function(s) if (trimws(s) == "-") 0 else as.numeric(gsub(",", "", s))
  parse_row <- function(s) vapply(strsplit(trimws(s), "\\s+")[[1]], parse_field, numeric(1))

  names_v <- character(0)
  rows <- list()
  started <- FALSE
  for (line in window) {
    m <- regmatches(line, regexec(pat, line, perl = TRUE))[[1]]
    if (length(m) != 3L) next
    name <- trimws(m[2])
    # the both-sexes block starts at MALAWI and ends where the Males block
    # begins; stopping there avoids the repeated sex-disaggregated rows.
    if (name == "Malawi") started <- TRUE
    if (name %in% c("Males", "Females")) break
    if (!started) next
    names_v <- c(names_v, name)
    rows[[length(rows) + 1L]] <- parse_row(m[3])
  }

  mat <- do.call(rbind, rows)
  colnames(mat) <- nab_labels
  frame <- data.frame(
    terr_name = names_v,
    is_national = names_v == "Malawi",
    is_region = names_v %in% region_rows,
    mat,
    stringsAsFactors = FALSE
  )
  # every row's 10 denomination columns must sum to its printed total.
  component_sum <- rowSums(frame[, nab_labels[-1]])
  if (any(component_sum != frame[["total"]])) {
    stop("a table E5 row's components do not sum to its total", call. = FALSE)
  }
  frame
}

# fold the four city rows into their enclosing districts so the 32 census
# reporting rows collapse to the 28 districts geoBoundaries ADM2 carries.
aggregate_cities <- function(district_rows) {
  target <- ifelse(
    district_rows[["terr_name"]] %in% names(city_parent),
    city_parent[district_rows[["terr_name"]]],
    district_rows[["terr_name"]]
  )
  count_cols <- nab_labels
  agg <- aggregate(district_rows[, count_cols], by = list(terr_name = target), FUN = sum)
  agg[order(agg[["terr_name"]]), ]
}

# derive the headline counts for one census row. table E5 allocates every
# usual resident to a denomination or to no religion with no not-stated
# residual, so the denominator is the printed total.
derive_counts <- function(rows) {
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
# Africa Albers Equal Area covers Malawi without a UTM-zone seam.
africa_aea <- paste(
  "+proj=aea +lat_1=20 +lat_2=-23 +lat_0=0 +lon_0=25",
  "+x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"
)

# prepare the district boundary layer from the geoBoundaries MWI ADM2 file.
read_boundary <- function(path) {
  gb <- st_read(path, quiet = TRUE)
  if (nrow(gb) != 28L) stop("expected 28 geoBoundaries MWI ADM2 districts", call. = FALSE)
  gb <- st_make_valid(gb)
  gb_metric <- st_transform(gb, africa_aea)

  gb[["area_name"]] <- as.character(gb[["shapeName"]])
  gb[["area_code"]] <- mw_slug(gb[["area_name"]])
  gb[["area_unit_id"]] <- paste0(boundary_set_id, ":", gb[["area_code"]])
  gb[["boundary_set_id"]] <- boundary_set_id
  gb[["boundary_level"]] <- boundary_level
  gb[["shape_id"]] <- as.character(gb[["shapeID"]])
  gb[["join_name"]] <- mw_norm(gb[["area_name"]])
  gb[["land_area_sq_km"]] <- as.numeric(st_area(gb_metric)) / 1e6

  if (any(duplicated(gb[["join_name"]]))) {
    stop("duplicate district join names in the boundary layer", call. = FALSE)
  }
  gb
}

# match the aggregated census district rows to the boundary layer by name.
match_to_boundary <- function(census_district, boundary) {
  source_key <- mw_norm(census_district[["terr_name"]])
  boundary_index <- match(source_key, boundary[["join_name"]])
  if (any(is.na(boundary_index))) {
    missing <- census_district[is.na(boundary_index), "terr_name"]
    stop("unmatched MW district rows: ", paste(missing, collapse = "; "), call. = FALSE)
  }
  if (any(duplicated(boundary_index))) stop("duplicate matched district boundaries", call. = FALSE)
  if (length(boundary_index) != nrow(boundary)) {
    stop("unexpected matched district count", call. = FALSE)
  }
  counts <- derive_counts(census_district)
  data.frame(
    census_district,
    counts,
    area_code = boundary[["area_code"]][boundary_index],
    area_name = boundary[["area_name"]][boundary_index],
    area_unit_id = boundary[["area_unit_id"]][boundary_index],
    land_area_sq_km = boundary[["land_area_sq_km"]][boundary_index],
    stringsAsFactors = FALSE
  )
}

# build one schema-shaped area-summary row for one district.
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
    population_total_basis = "table E5 district total (usual residents); every resident is allocated to a denomination or to no religion, so no not-stated residual is excluded",
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
      "cities_folded_into_parent_districts",
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
  stop("simplified MW boundary remains above 3 MB", call. = FALSE)
}

# create the source-dataset records for the area-summary document.
source_datasets <- function() {
  list(
    list(
      source_dataset_id = census_dataset_id,
      name = "NSO 2018 Malawi Population and Housing Census Main Report, table E5: population of Malawi by denomination, region, and district",
      provider = "National Statistical Office of Malawi (NSO)",
      url = census_pdf_url,
      retrieval_date = retrieval_date,
      local_path = census_pdf_path,
      licence = list(
        name = "NSO census report, open download; no explicit reuse licence stated",
        url = census_landing_url,
        attribution = "National Statistical Office of Malawi (NSO)"
      ),
      citation = "National Statistical Office of Malawi, 2018 Malawi Population and Housing Census Main Report, Table E5.",
      access_limits = NULL,
      redistribution_limits = "The census PDF is not committed; the derived public product attributes NSO Malawi and links the source.",
      notes = "Table E5 gives 32 district and city rows, three region subtotals, and the MALAWI national row across 10 denomination categories; parsed with pdftotext -layout. Every usual resident is allocated, so no not-stated residual exists. The four city rows fold into their enclosing districts to match the 28 geoBoundaries ADM2 polygons."
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "geoBoundaries MWI ADM2 (2020 districts)",
      provider = "geoBoundaries (William & Mary geoLab)",
      url = geoboundaries_gj_url,
      retrieval_date = retrieval_date,
      local_path = geoboundaries_path,
      licence = list(
        name = "Creative Commons Attribution 3.0 IGO (CC BY 3.0 IGO); boundary source NSO Malawi and OCHA ROSEA via HDX",
        url = geoboundaries_meta_url,
        attribution = "geoBoundaries (gbOpen); boundary source National Statistics Office of Malawi and OCHA ROSEA"
      ),
      citation = "Runfola et al., geoBoundaries MWI ADM2 (gbOpen), district boundaries, 2020.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary is committed with CC BY 3.0 IGO attribution to NSO Malawi and OCHA ROSEA.",
      notes = "28 ADM2 districts; shapeISO is empty for every feature, so a district-name slug is used as the area code."
    )
  )
}

# create the indicator metadata for the district product.
indicators_for_district <- function() {
  denominator_note <- paste(
    "Percentages use the table E5 district total of usual residents as the",
    "denominator. Table E5 allocates every resident to a denomination or to no",
    "religion, so there is no not-stated category to exclude."
  )
  list(
    list(
      indicator_id = "population_total",
      label = "Census usual-resident denominator",
      description = "District total of usual residents in table E5 (cities folded into their enclosing districts).",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "table E5 district total; four city rows added to their parent districts.",
      temporal_coverage = "2018",
      spatial_coverage = "Malawi districts (geoBoundaries ADM2) in the 2018 census.",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious affiliation %",
      description = "Share of usual residents declaring any named denomination.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * (Catholic + CCAP + SDA/Baptist/Apostolic + Anglican + Pentecostal + Other Christian + Islam + Traditional + Other Denomination) / district total.",
      temporal_coverage = "2018",
      spatial_coverage = "Malawi districts (geoBoundaries ADM2) in the 2018 census.",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "No religion %",
      description = "Share of usual residents in the No Religion category.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * No Religion / district total.",
      temporal_coverage = "2018",
      spatial_coverage = "Malawi districts (geoBoundaries ADM2) in the 2018 census.",
      quality_notes = denominator_note
    )
  )
}

# define the choropleth layers exposed by the shared region map.
visual_layers_for_district <- function() {
  list(
    list(
      visual_layer_id = "mw-district-religious-affiliation",
      label = "Religious affiliation %",
      description = "Malawi census 2018 religious-affiliation share.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "usual residents"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = "All nine named-denomination categories count as religious affiliation."
    ),
    list(
      visual_layer_id = "mw-district-no-religion",
      label = "No religion %",
      description = "Malawi census 2018 no-religion share.",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "usual residents"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = "No religion is the No Religion category; there is no not-stated category in table E5."
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
      vintage = "2020",
      source_dataset_id = boundary_dataset_id
    ),
    site_snapshot = list(
      source_dataset_id = NULL,
      snapshot_date = NULL,
      basis = "no governed Malawi OpenStreetMap place-of-worship snapshot is included in this country data-map release",
      notes = "The Malawi page exposes census 2018 religious-affiliation and no-religion metrics only; place-density metrics are hidden until a governed Malawi place layer is built."
    ),
    source_datasets = source_datasets(),
    indicators = indicators_for_district(),
    visual_layers = visual_layers_for_district(),
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

census <- read_census(census_pdf_path)
national <- census[census[["is_national"]], , drop = FALSE]
regions <- census[census[["is_region"]], , drop = FALSE]
census_district_raw <- census[!census[["is_national"]] & !census[["is_region"]], , drop = FALSE]
if (nrow(census_district_raw) != 32L) stop("expected 32 district/city rows", call. = FALSE)
if (nrow(national) != 1L) stop("expected one national row", call. = FALSE)
if (nrow(regions) != 3L) stop("expected three region subtotal rows", call. = FALSE)

census_district <- aggregate_cities(census_district_raw)
if (nrow(census_district) != 28L) stop("expected 28 districts after city aggregation", call. = FALSE)

boundary <- read_boundary(geoboundaries_path)
matched <- match_to_boundary(census_district, boundary)
matched <- matched[order(matched[["area_name"]]), ]

# reconcile the district rows against the MALAWI national row for every metric,
# both before (32 rows) and after (28 rows) folding the cities into districts.
national_counts <- derive_counts(national)
recon_fields <- c("population_total", "religious_affiliation_count", "no_religion_count")
reconcile <- function(source_frame, label) {
  counts <- derive_counts(source_frame)
  lapply(recon_fields, function(field) {
    district_sum <- sum(counts[[field]])
    national_value <- national_counts[[field]][[1]]
    list(
      year = year,
      scope = label,
      metric = field,
      district_sum = district_sum,
      national_total = national_value,
      difference = district_sum - national_value
    )
  })
}
national_reconciliation <- c(
  reconcile(census_district_raw, "32_reporting_rows"),
  reconcile(census_district, "28_districts_after_city_merge")
)
for (check in national_reconciliation) {
  if (check[["difference"]] != 0) {
    stop("national reconciliation failed for ", check[["scope"]], "/", check[["metric"]], call. = FALSE)
  }
}

boundary_write <- write_simplified_boundary(
  boundary,
  boundary_out,
  c("area_code", "area_name", "area_unit_id", "boundary_set_id",
    "boundary_level", "shape_id", "land_area_sq_km")
)
if (row_count_file(boundary_out) != nrow(boundary)) {
  stop("district boundary feature count changed during simplification", call. = FALSE)
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

validation_checks <- c(
  "Table E5 is the 2018 Main Report population-by-denomination-region-district table; the MALAWI row, three region subtotals, and 32 district/city rows are parsed with pdftotext -layout from the both-sexes block only.",
  "Every parsed row's 10 denomination columns sum exactly to its printed total.",
  "The 32 district/city rows sum exactly to the MALAWI national row for the total, religious affiliation, and no religion; the 28 districts after folding the four cities into their parents also sum exactly to the national row.",
  "All 28 aggregated district census rows join to the 28 geoBoundaries MWI ADM2 features by normalised name, with no unmatched rows on either side.",
  sprintf("The simplified district boundary GeoJSON writes to %d bytes after %d m simplification.", boundary_write[["bytes"]], boundary_write[["tolerance_m"]]),
  "Percentages use the table E5 usual-resident total as the denominator; the source has no not-stated category, so nothing is excluded.",
  "The 2018 census wave is the only wave shipped: the 2008 Main Report reports religion only as a single national table with four coarse categories (Christian, Muslim, Other, None) and no district breakdown, so it is neither comparable nor sub-nationally retrievable."
)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:mw-census-religion:mw:2018:nso-main-report-table-e5",
  dataset_id = "mw-census-religion:mw:2018:nso-main-report-table-e5",
  dataset_version_id = paste0("mw-census-religion:mw:2018:nso-main-report-table-e5:", substr(sha256_file(summary_json_out), 1, 12)),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "mw-census-religion",
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
      waves = c("2018"),
      district_boundary_set = boundary_set_id,
      district_boundary_simplification_tolerance_m = boundary_write[["tolerance_m"]],
      pdf_extraction = "poppler pdftotext -layout, table E5 both-sexes block",
      denominator = "table E5 district usual-resident total (no not-stated category)",
      city_aggregation = "Lilongwe City into Lilongwe; Blantyre City into Blantyre; Zomba City into Zomba; Mzuzu City into Mzimba",
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
    provider = "National Statistical Office of Malawi (NSO); geoBoundaries (William & Mary geoLab)",
    source_dataset_ids = c(census_dataset_id, boundary_dataset_id),
    source_urls = c(census_pdf_url, census_landing_url, geoboundaries_meta_url, geoboundaries_gj_url),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = licence_text,
    citation = "NSO, 2018 Malawi Population and Housing Census Main Report, Table E5; geoBoundaries MWI ADM2 (gbOpen) 2020.",
    raw_redistribution = "The census PDFs and the geoBoundaries source GeoJSON are not committed. They remain in data/raw/mw_census/ and await any project-controlled raw archive upload."
  ),
  input_manifests = list(),
  raw_sources = list(
    raw_source_record(
      census_pdf_path, census_pdf_url, "pdf", 36L, census_dataset_id, TRUE, "2018",
      "2018 Malawi PHC Main Report PDF (NSO, hosted by UNFPA Malawi); table E5 yields the MALAWI row, three region subtotals, and 32 district/city rows across 10 denomination categories."
    ),
    raw_source_record(
      geoboundaries_path, geoboundaries_gj_url, "geojson", 28L, boundary_dataset_id, TRUE, "2020",
      "geoBoundaries MWI ADM2 GeoJSON; 28 district features. shapeISO empty, so a district-name slug is the area code."
    ),
    raw_source_record(
      geoboundaries_meta_path, geoboundaries_meta_url, "json", NA_integer_, boundary_dataset_id, FALSE, "2020",
      "geoBoundaries MWI ADM2 metadata; records the CC BY 3.0 IGO licence and the NSO Malawi / OCHA ROSEA boundary source."
    ),
    raw_source_record(
      census_2008_pdf_path, "http://conrema.org/wp-content/uploads/2019/01/Malawi-Census-Main-Report-2008.pdf", "pdf", 1L, census_dataset_id, FALSE, "2008",
      "2008 Malawi PHC Main Report PDF; table 3.2 reports religion only at national level with four coarse categories (Christian, Muslim, Other, None), so no 2008 district religion wave is retrievable or comparable."
    )
  ),
  durable_files = list(
    manifest_file_record(summary_json_out, "Malawi district area summary with NSO census 2018 religious-affiliation and no-religion metrics.", licence_status),
    manifest_file_record(summary_csv_out, "Flattened Malawi district area summary with NSO census 2018 religious-affiliation and no-religion metrics.", licence_status),
    manifest_file_record(boundary_out, "Simplified Malawi district boundary GeoJSON derived from geoBoundaries MWI ADM2 (2020).", "geoboundaries_cc_by_3_0_igo")
  ),
  derived_outputs = list(
    list(
      uri = paste0("repo:", summary_json_out),
      sha256 = sha256_file(summary_json_out),
      built_by = script_id,
      notes = "28 district reporting units x 1 census year; denominator is the table E5 usual-resident total."
    ),
    list(
      uri = paste0("repo:", boundary_out),
      sha256 = sha256_file(boundary_out),
      built_by = script_id,
      notes = sprintf("28 geoBoundaries MWI ADM2 district features simplified at %d m tolerance.", boundary_write[["tolerance_m"]])
    )
  ),
  validation = list(
    checks = validation_checks,
    join_coverage = list(district = list(join_coverage)),
    national_reconciliation = national_reconciliation,
    national_excluded_share_percent = 0,
    boundary_validation = list(
      source_mw_feature_count = nrow(boundary),
      output_feature_count = row_count_file(boundary_out),
      expected_feature_count = nrow(boundary),
      output_bytes = boundary_write[["bytes"]],
      simplification_tolerance_m = boundary_write[["tolerance_m"]],
      unmatched_boundary_features = list(),
      unmatched_census_areas = list()
    )
  ),
  construct_notes = list(
    "The public map displays two headline metrics for 2018: religious affiliation percent and no religion percent.",
    "The denominator is the table E5 district total of usual residents; the source allocates every resident, so there is no not-stated category to exclude.",
    "Religious affiliation combines the nine named-denomination categories: Catholic, CCAP, SDA/Baptist/Apostolic, Anglican, Pentecostal, Other Christian Denominations, Islam, Traditional, and Other Denomination.",
    "No religion is the No Religion category.",
    "Table E5's Other Denomination column folds Buddhism, Hinduism, and other non-Christian denominations that the national table 3.4 reports as separate rows; 992,304 nationally = 983,587 other non-Christian + 5,506 Buddhism + 3,211 Hinduism.",
    "The census breaks out four cities (Lilongwe City, Blantyre City, Zomba City, Mzuzu City) as their own rows. geoBoundaries ADM2 has no city polygons, so each city is folded into the district that encloses it (Mzuzu City into Mzimba); the map's district values therefore cover the whole district including its city."
  ),
  deferred_sources = list(
    list(
      source_dataset_id = "nso-2008-phc-religion",
      url = "http://conrema.org/wp-content/uploads/2019/01/Malawi-Census-Main-Report-2008.pdf",
      local_path = census_2008_pdf_path,
      notes = "The 2008 Malawi PHC Main Report reports religion only in Table 3.2 at national level with four coarse categories (Christian 82.7%, Muslim 13.0%, Other 1.9%, None 2.5%) alongside 1998; no district breakdown is published there, and the coarse categories are not comparable to the 2018 ten-denomination table. A 2008 district religion wave is deferred until a sub-national, category-comparable source is located."
    )
  ),
  privacy = "public",
  licence_status = licence_status,
  licence_basis = licence_basis,
  downstream_status = "public",
  source_datasets = source_datasets(),
  notes = "The committed products contain the derived district area summary and simplified boundary only. On-page attribution cites NSO Malawi and geoBoundaries (CC BY 3.0 IGO)."
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
cat("national reconciliation: exact for total, religious affiliation, and no religion (32 reporting rows and 28 districts)\n")
