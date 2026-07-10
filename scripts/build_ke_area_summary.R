# build the kenya county area-summary product from the KNBS 2019 census.
# inputs: the 2019 Kenya Population and Housing Census Volume IV PDF
# (table 2.30, distribution of population by religious affiliation and county)
# and the geoBoundaries KEN ADM1 (2020 counties) GeoJSON.
# outputs: apps/regions/ke/data/ke_county_2020.geojson,
# apps/regions/ke/data/area_summary_county.{json,csv}, and
# docs/manifests/ke-census-religion-2019.json.
# run from the repo root: Rscript scripts/build_ke_area_summary.R
# the table is parsed from the PDF with poppler pdftotext -layout; every
# number comes from table 2.30 and is reconciled against the KENYA row.

suppressMessages({
  library(jsonlite)
  library(sf)
})

raw_dir <- "data/raw/ke_census"
ke_dir <- "apps/regions/ke/data"
manifest_dir <- "docs/manifests"
dir.create(ke_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- "2026-07-09"
script_id <- "scripts/build_ke_area_summary.R"
country_code <- "KE"
year <- 2019L

boundary_set_id <- "ke-county-2020-geoboundaries-adm1"
boundary_level <- "county"
census_dataset_id <- "knbs-2019-kphc-vol4-table-2-30-religion-by-county"
boundary_dataset_id <- "geoboundaries-ken-adm1-2020"

# source urls recorded in the manifest and the on-page attribution.
census_pdf_url <- "https://www.knbs.or.ke/wp-content/uploads/2023/09/2019-Kenya-population-and-Housing-Census-Volume-4-Distribution-of-Population-by-Socio-Economic-Characteristics.pdf"
census_landing_url <- "https://www.knbs.or.ke/reports/kenya-census-2019/"
religious_affiliation_url <- "https://www.knbs.or.ke/religious-affiliation/"
census_2009_pdf_url <- "https://www.knbs.or.ke/wp-content/uploads/2023/09/2009-Kenya-population-and-Housing-Census-Volume-2-Population-and-Household-Distribution-by-Socio-Economic-Characteristics.pdf"
geoboundaries_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/KEN/ADM1/"
geoboundaries_gj_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/KEN/ADM1/geoBoundaries-KEN-ADM1_simplified.geojson"

census_pdf_path <- file.path(raw_dir, "knbs_2019_volume_iv.pdf")
census_2009_pdf_path <- file.path(raw_dir, "knbs_2009_volume_ii.pdf")
geoboundaries_path <- file.path(raw_dir, "geoBoundaries-KEN-ADM1.geojson")
geoboundaries_meta_path <- file.path(raw_dir, "geoboundaries_ken_adm1_meta.json")

boundary_out <- file.path(ke_dir, "ke_county_2020.geojson")
summary_json_out <- file.path(ke_dir, "area_summary_county.json")
summary_csv_out <- file.path(ke_dir, "area_summary_county.csv")
manifest_out <- file.path(manifest_dir, "ke-census-religion-2019.json")

licence_text <- paste(
  "KNBS 2019 Kenya Population and Housing Census, Volume IV (Distribution of",
  "Population by Socio-Economic Characteristics), table 2.30. KNBS publishes",
  "the census reports for open download; no explicit reuse licence is stated,",
  "so the derived product attributes KNBS and links the source of record.",
  "Boundaries are geoBoundaries KEN ADM1 (2020 counties), released to the",
  "public domain, derived from the RCMRD GeoPortal via the Africa GeoPortal."
)
licence_status <- "accepted"
# terms identity preserved separately from the shipping decision (schema v2)
licence_basis <- "knbs_census_open_download_attribution_geoboundaries_public_domain"

# the 13 religious-affiliation columns of table 2.30, in printed order, plus
# the leading total. african_instituted = African Instituted Churches.
nab_labels <- c(
  "total", "catholic", "protestant", "evangelical", "african_instituted",
  "orthodox", "other_christian", "islam", "hindu", "traditionists",
  "other_religion", "no_religion", "dont_know", "not_stated"
)

# the ten named-religion columns that make up religious affiliation.
affiliation_cols <- c(
  "catholic", "protestant", "evangelical", "african_instituted", "orthodox",
  "other_christian", "islam", "hindu", "traditionists", "other_religion"
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

# normalise a county label so the census and geoBoundaries spellings compare
# equal: uppercase, punctuation to spaces, collapse whitespace.
ke_norm <- function(x) {
  x <- toupper(trimws(as.character(x)))
  x <- gsub("[^A-Z0-9]+", " ", x)
  trimws(gsub("\\s+", " ", x))
}

# geoBoundaries names one county "Tharaka"; the census names it
# "Tharaka-Nithi". alias the boundary spelling onto the census spelling.
ke_join_alias <- function(norm_name) {
  ifelse(norm_name == "THARAKA", "THARAKA NITHI", norm_name)
}

# extract table 2.30 with poppler pdftotext -layout, then parse the KENYA row
# and the 47 county rows. each data row is a name followed by 14 comma-
# formatted integers (total plus the 13 religion columns).
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
  # the real table header carries no table-of-contents leader dots.
  header_line <- "Table 2\\.30: Distribution of Population by Religious Affiliation and County"
  hdr <- grep(header_line, txt)
  hdr_real <- hdr[!grepl("\\.\\.\\.", txt[hdr])]
  if (length(hdr_real) != 1L) stop("could not locate table 2.30", call. = FALSE)
  end <- grep("Table 2\\.31", txt)
  end_real <- min(end[end > hdr_real])
  window <- txt[hdr_real:end_real]

  pat <- "^\\s*([A-Z][A-Z '/.-]*[A-Z])\\s+([0-9][0-9,]*(?:\\s+[0-9][0-9,]*){13})\\s*$"
  data_lines <- window[grepl(pat, window, perl = TRUE)]
  matches <- regmatches(data_lines, regexec(pat, data_lines, perl = TRUE))
  names_v <- trimws(vapply(matches, `[`, character(1), 2L))
  nums_v <- vapply(matches, `[`, character(1), 3L)

  parse_row <- function(s) as.numeric(gsub(",", "", strsplit(trimws(s), "\\s+")[[1]]))
  mat <- do.call(rbind, lapply(nums_v, parse_row))
  colnames(mat) <- nab_labels

  frame <- data.frame(
    terr_name = names_v,
    is_national = names_v == "KENYA",
    mat,
    stringsAsFactors = FALSE
  )
  # every row's 13 religion columns must sum to its printed total.
  component_sum <- rowSums(frame[, nab_labels[-1]])
  if (any(component_sum != frame[["total"]])) {
    stop("a table 2.30 row's components do not sum to its total", call. = FALSE)
  }
  frame
}

# derive the stated-response denominator and headline counts for one census
# row. the denominator excludes Don't Know and Not Stated; religious
# affiliation is the ten named-religion columns; no religion is the
# No religion/Atheists column.
derive_counts <- function(rows) {
  religious_affiliation <- rowSums(rows[, affiliation_cols, drop = FALSE])
  no_religion <- rows[["no_religion"]]
  denominator <- rows[["total"]] - rows[["dont_know"]] - rows[["not_stated"]]
  data.frame(
    population_total = denominator,
    religious_affiliation_count = religious_affiliation,
    no_religion_count = no_religion,
    excluded_count = rows[["dont_know"]] + rows[["not_stated"]],
    religious_affiliation_percent = round(100 * religious_affiliation / denominator, 2),
    no_religion_percent = round(100 * no_religion / denominator, 2),
    stringsAsFactors = FALSE
  )
}

# metric CRS for area computation and metre-tolerance simplification;
# Africa Albers Equal Area covers Kenya without a UTM-zone seam.
africa_aea <- paste(
  "+proj=aea +lat_1=20 +lat_2=-23 +lat_0=0 +lon_0=25",
  "+x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"
)

# prepare the county boundary layer from the geoBoundaries KEN ADM1 file.
read_boundary <- function(path) {
  gb <- st_read(path, quiet = TRUE)
  if (nrow(gb) != 47L) stop("expected 47 geoBoundaries KEN ADM1 counties", call. = FALSE)
  gb <- st_make_valid(gb)
  gb_metric <- st_transform(gb, africa_aea)

  gb[["area_code"]] <- as.character(gb[["shapeISO"]])
  # display names follow the census's official county names where the
  # boundary file abbreviates (geoBoundaries "Tharaka" is Tharaka-Nithi)
  gb[["area_name"]] <- ifelse(
    as.character(gb[["shapeName"]]) == "Tharaka",
    "Tharaka-Nithi",
    as.character(gb[["shapeName"]])
  )
  gb[["area_unit_id"]] <- paste0(boundary_set_id, ":", gb[["area_code"]])
  gb[["boundary_set_id"]] <- boundary_set_id
  gb[["boundary_level"]] <- boundary_level
  gb[["shape_id"]] <- as.character(gb[["shapeID"]])
  gb[["join_name"]] <- ke_join_alias(ke_norm(gb[["shapeName"]]))
  gb[["land_area_sq_km"]] <- as.numeric(st_area(gb_metric)) / 1e6

  if (any(duplicated(gb[["join_name"]]))) {
    stop("duplicate county join names in the boundary layer", call. = FALSE)
  }
  gb
}

# match the census county rows to the boundary layer by normalised name.
match_to_boundary <- function(census_county, boundary) {
  source_key <- ke_norm(census_county[["terr_name"]])
  boundary_index <- match(source_key, boundary[["join_name"]])
  if (any(is.na(boundary_index))) {
    missing <- census_county[is.na(boundary_index), "terr_name"]
    stop("unmatched KE county rows: ", paste(missing, collapse = "; "), call. = FALSE)
  }
  if (any(duplicated(boundary_index))) stop("duplicate matched county boundaries", call. = FALSE)
  if (length(boundary_index) != nrow(boundary)) {
    stop("unexpected matched county count", call. = FALSE)
  }
  counts <- derive_counts(census_county)
  data.frame(
    census_county,
    counts,
    area_code = boundary[["area_code"]][boundary_index],
    area_name = boundary[["area_name"]][boundary_index],
    area_unit_id = boundary[["area_unit_id"]][boundary_index],
    land_area_sq_km = boundary[["land_area_sq_km"]][boundary_index],
    stringsAsFactors = FALSE
  )
}

# build one schema-shaped area-summary row for one county.
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
    population_total_basis = "stated religion-response denominator: table 2.30 total minus Don't Know and Not Stated",
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
      "stated_response_denominator",
      "dont_know_and_not_stated_excluded_from_denominator",
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
  stop("simplified KE boundary remains above 3 MB", call. = FALSE)
}

# create the source-dataset records for the area-summary document.
source_datasets <- function() {
  list(
    list(
      source_dataset_id = census_dataset_id,
      name = "KNBS 2019 KPHC Volume IV, table 2.30: distribution of population by religious affiliation and county",
      provider = "Kenya National Bureau of Statistics (KNBS)",
      url = census_pdf_url,
      retrieval_date = retrieval_date,
      local_path = census_pdf_path,
      licence = list(
        name = "KNBS census reports, open download; no explicit reuse licence stated",
        url = census_landing_url,
        attribution = "Kenya National Bureau of Statistics (KNBS)"
      ),
      citation = "Kenya National Bureau of Statistics, 2019 Kenya Population and Housing Census, Volume IV, Table 2.30.",
      access_limits = NULL,
      redistribution_limits = "The census PDF is not committed; the derived public product attributes KNBS and links the source.",
      notes = "Table 2.30 gives 47 counties plus the KENYA national row across 13 religion categories; parsed with pdftotext -layout. The stated-response denominator excludes Don't Know and Not Stated."
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "geoBoundaries KEN ADM1 (2020 counties)",
      provider = "geoBoundaries (William & Mary geoLab)",
      url = geoboundaries_gj_url,
      retrieval_date = retrieval_date,
      local_path = geoboundaries_path,
      licence = list(
        name = "Public Domain (geoBoundaries Open); source RCMRD GeoPortal via Africa GeoPortal",
        url = geoboundaries_meta_url,
        attribution = "geoBoundaries (gbOpen), boundary source RCMRD GeoPortal"
      ),
      citation = "Runfola et al., geoBoundaries KEN ADM1 (gbOpen), county boundaries, 2020.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary is committed; geoBoundaries gbOpen is public domain.",
      notes = "47 ADM1 counties; shapeISO carries the ISO 3166-2 KE-NN codes used as area codes."
    )
  )
}

# create the indicator metadata for the county product.
indicators_for_county <- function() {
  denominator_note <- paste(
    "Percentages use a stated religion-response denominator: the table 2.30",
    "county total minus Don't Know and Not Stated. Those two residual",
    "categories are excluded from the denominator, not counted as no religion."
  )
  list(
    list(
      indicator_id = "population_total",
      label = "Stated religion-response denominator",
      description = "County total minus the Don't Know and Not Stated categories in table 2.30.",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "table 2.30 total minus Don't Know minus Not Stated.",
      temporal_coverage = "2019",
      spatial_coverage = "Kenya counties (geoBoundaries ADM1) in the 2019 census.",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious affiliation %",
      description = "Share of the stated-response denominator declaring any named religion.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * (Catholic + Protestant + Evangelical Churches + African Instituted Churches + Orthodox + Other Christian + Islam + Hindu + Traditionists + Other Religion) / (total - Don't Know - Not Stated).",
      temporal_coverage = "2019",
      spatial_coverage = "Kenya counties (geoBoundaries ADM1) in the 2019 census.",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "No religion %",
      description = "Share of the stated-response denominator in the No religion/Atheists category.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * No religion/Atheists / (total - Don't Know - Not Stated).",
      temporal_coverage = "2019",
      spatial_coverage = "Kenya counties (geoBoundaries ADM1) in the 2019 census.",
      quality_notes = denominator_note
    )
  )
}

# define the choropleth layers exposed by the shared region map.
visual_layers_for_county <- function() {
  list(
    list(
      visual_layer_id = "ke-county-religious-affiliation",
      label = "Religious affiliation %",
      description = "Kenya census 2019 religious-affiliation share.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "stated religion responses"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = "All ten named-religion categories count as religious affiliation."
    ),
    list(
      visual_layer_id = "ke-county-no-religion",
      label = "No religion %",
      description = "Kenya census 2019 no-religion share.",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "stated religion responses"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = "No religion is the No religion/Atheists category; Don't Know and Not Stated are excluded from the denominator."
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
      basis = "no governed Kenya OpenStreetMap place-of-worship snapshot is included in this country data-map release",
      notes = "The Kenya page exposes census 2019 religious-affiliation and no-religion metrics only; place-density metrics are hidden until a governed Kenya place layer is built."
    ),
    source_datasets = source_datasets(),
    indicators = indicators_for_county(),
    visual_layers = visual_layers_for_county(),
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
census_county <- census[!census[["is_national"]], , drop = FALSE]
national <- census[census[["is_national"]], , drop = FALSE]
if (nrow(census_county) != 47L) stop("expected 47 county rows", call. = FALSE)
if (nrow(national) != 1L) stop("expected one national row", call. = FALSE)

boundary <- read_boundary(geoboundaries_path)
matched <- match_to_boundary(census_county, boundary)
matched <- matched[order(matched[["area_name"]]), ]

# reconcile the county rows against the KENYA national row for every component.
national_counts <- derive_counts(national)
county_counts <- derive_counts(census_county)
recon_fields <- c(
  "population_total", "religious_affiliation_count",
  "no_religion_count", "excluded_count"
)
national_reconciliation <- lapply(recon_fields, function(field) {
  county_sum <- sum(county_counts[[field]])
  national_value <- national_counts[[field]][[1]]
  list(
    year = year,
    metric = field,
    county_sum = county_sum,
    national_total = national_value,
    difference = county_sum - national_value
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
  stop("county boundary feature count changed during simplification", call. = FALSE)
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

# the religion table total is smaller than the enumerated population because
# people in institutions, hotels, hospitals, prisons, and outdoor sleepers
# were not asked the religion question (table 2.30 note).
national_excluded_share <- round(
  100 * national_counts[["excluded_count"]][[1]] / national[["total"]], 4
)

validation_checks <- c(
  "Table 2.30 is the 2019 KPHC Volume IV religious-affiliation-by-county table; the KENYA row plus 47 counties are parsed with pdftotext -layout.",
  "Every parsed row's 13 religion columns sum exactly to its printed total.",
  "The 47 county rows sum exactly to the KENYA national row for the denominator, religious affiliation, no religion, and the excluded (Don't Know + Not Stated) residual.",
  "All 47 county census rows join to the 47 geoBoundaries KEN ADM1 features by normalised name (geoBoundaries 'Tharaka' aliased to the census 'Tharaka-Nithi').",
  sprintf("The simplified county boundary GeoJSON writes to %d bytes after %d m simplification.", boundary_write[["bytes"]], boundary_write[["tolerance_m"]]),
  "Percentages use a stated-response denominator: table 2.30 total minus Don't Know and Not Stated. Those residuals are excluded, not counted as no religion.",
  "The 2019 census wave is the only wave shipped: the 2009 census (Volume II, Table 12) publishes religion at national level only, with no county or district breakdown."
)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:ke-census-religion:ke:2019:knbs-vol4-table-2-30",
  dataset_id = "ke-census-religion:ke:2019:knbs-vol4-table-2-30",
  dataset_version_id = paste0("ke-census-religion:ke:2019:knbs-vol4-table-2-30:", substr(sha256_file(summary_json_out), 1, 12)),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "ke-census-religion",
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
      waves = c("2019"),
      county_boundary_set = boundary_set_id,
      county_boundary_simplification_tolerance_m = boundary_write[["tolerance_m"]],
      pdf_extraction = "poppler pdftotext -layout, table 2.30 window",
      denominator = "table 2.30 total minus Don't Know and Not Stated",
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
    provider = "Kenya National Bureau of Statistics (KNBS); geoBoundaries (William & Mary geoLab)",
    source_dataset_ids = c(census_dataset_id, boundary_dataset_id),
    source_urls = c(census_pdf_url, census_landing_url, religious_affiliation_url, geoboundaries_meta_url, geoboundaries_gj_url),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = licence_text,
    citation = "KNBS, 2019 KPHC Volume IV, Table 2.30; geoBoundaries KEN ADM1 (gbOpen) 2020.",
    raw_redistribution = "The census PDFs and the geoBoundaries source GeoJSON are not committed. They remain in data/raw/ke_census/ and await any project-controlled raw archive upload."
  ),
  input_manifests = list(),
  raw_sources = list(
    raw_source_record(
      census_pdf_path, census_pdf_url, "pdf", 48L, census_dataset_id, TRUE, "2019",
      "2019 KPHC Volume IV PDF; table 2.30 yields the KENYA row plus 47 counties across 13 religion categories."
    ),
    raw_source_record(
      geoboundaries_path, geoboundaries_gj_url, "geojson", 47L, boundary_dataset_id, TRUE, "2020",
      "geoBoundaries KEN ADM1 simplified GeoJSON; 47 county features with shapeISO ISO 3166-2 codes."
    ),
    raw_source_record(
      geoboundaries_meta_path, geoboundaries_meta_url, "json", NA_integer_, boundary_dataset_id, FALSE, "2020",
      "geoBoundaries KEN ADM1 metadata; records the Public Domain licence and RCMRD GeoPortal boundary source."
    ),
    raw_source_record(
      census_2009_pdf_path, census_2009_pdf_url, "pdf", 1L, census_dataset_id, FALSE, "2009",
      "2009 KPHC Volume II PDF; table 12 publishes religion at national level only, so no 2009 county/district wave is retrievable."
    )
  ),
  durable_files = list(
    manifest_file_record(summary_json_out, "Kenya county area summary with KNBS census 2019 religious-affiliation and no-religion metrics.", licence_status),
    manifest_file_record(summary_csv_out, "Flattened Kenya county area summary with KNBS census 2019 religious-affiliation and no-religion metrics.", licence_status),
    manifest_file_record(boundary_out, "Simplified Kenya county boundary GeoJSON derived from geoBoundaries KEN ADM1 (2020).", "geoboundaries_public_domain")
  ),
  derived_outputs = list(
    list(
      uri = paste0("repo:", summary_json_out),
      sha256 = sha256_file(summary_json_out),
      built_by = script_id,
      notes = "47 county reporting units x 1 census year; denominator is total minus Don't Know and Not Stated."
    ),
    list(
      uri = paste0("repo:", boundary_out),
      sha256 = sha256_file(boundary_out),
      built_by = script_id,
      notes = sprintf("47 geoBoundaries KEN ADM1 county features simplified at %d m tolerance.", boundary_write[["tolerance_m"]])
    )
  ),
  validation = list(
    checks = validation_checks,
    join_coverage = list(county = list(join_coverage)),
    national_reconciliation = national_reconciliation,
    national_excluded_share_percent = national_excluded_share,
    boundary_validation = list(
      source_ke_feature_count = nrow(boundary),
      output_feature_count = row_count_file(boundary_out),
      expected_feature_count = nrow(boundary),
      output_bytes = boundary_write[["bytes"]],
      simplification_tolerance_m = boundary_write[["tolerance_m"]],
      unmatched_boundary_features = list(),
      unmatched_census_areas = list()
    )
  ),
  construct_notes = list(
    "The public map displays two headline metrics for 2019: religious affiliation percent and no religion percent.",
    "The denominator is the stated religion-response population: the table 2.30 county total minus Don't Know and Not Stated.",
    "Religious affiliation combines the ten named-religion categories: Catholic, Protestant, Evangelical Churches, African Instituted Churches, Orthodox, Other Christian, Islam, Hindu, Traditionists, and Other Religion.",
    "No religion is the No religion/Atheists category.",
    "Don't Know and Not Stated are small nationally and are excluded from the denominator rather than counted as no religion.",
    "The religion table total (47,213,282) is smaller than the enumerated population (47,564,296): the census note states the religion question was not asked of people in institutions, hotels, hospitals, prisons, and among travellers and outdoor sleepers."
  ),
  deferred_sources = list(
    list(
      source_dataset_id = "knbs-2009-kphc-vol2-religion",
      url = census_2009_pdf_url,
      local_path = census_2009_pdf_path,
      notes = "The 2009 KPHC Volume II reports religion only in Table 12 at national level (Kenya total column); no county or district breakdown is published there, and 2009 predates the 47-county geography. A 2009 county/district religion wave is deferred until a sub-national source is located."
    )
  ),
  privacy = "public",
  licence_status = licence_status,
  licence_basis = licence_basis,
  downstream_status = "public",
  source_datasets = source_datasets(),
  notes = "The committed products contain the derived county area summary and simplified boundary only. On-page attribution cites KNBS and geoBoundaries."
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
cat(sprintf("national excluded (Don't Know + Not Stated) share of table total: %.4f%%\n", national_excluded_share))
cat("national reconciliation: exact for denominator, religious affiliation, no religion, and excluded residual\n")
