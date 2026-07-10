# build the Bangladesh 2022 district area-summary product from BBS Table P08.
# inputs (git-ignored, under data/raw/bd_census/):
#   phc2022_national_report_vol1.pdf  BBS Population and Housing Census 2022,
#                                     National Report (Volume I); Table P08
#                                     "Population by Religion, Sex and District".
#   geoboundaries_bgd_adm2.geojson    geoBoundaries BGD ADM2 (64 districts).
#   geoboundaries_bgd_adm2_metadata.json  release metadata (licence record).
# outputs:
#   apps/regions/bd/data/bd_district_2022.geojson  simplified district boundary
#   apps/regions/bd/data/area_summary_district_2022.{json,csv}
#   docs/manifests/bd-census-religion-2022.json
# run from the repository root: Rscript scripts/build_bd_area_summary.R
#
# gates (stop, do not tune): the parse must yield exactly 1 national + 8
# divisions + 64 districts; every Male+Female cell must equal its Total; every
# district must sum to its division and every division to the national row for
# all fifteen count columns; the verified national category totals must match
# byte-for-byte; the boundary must join the census districts exactly 64:64; and
# the simplified boundary must fall under three megabytes. Any failure stops the
# build before a product is written.

suppressMessages({
  library(jsonlite)
  library(sf)
})

raw_dir <- "data/raw/bd_census"
out_dir <- "apps/regions/bd/data"
manifest_dir <- "docs/manifests"
dir.create(out_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- "2026-07-10"
script_id <- "scripts/build_bd_area_summary.R"
country_code <- "BD"
census_year <- 2022L

boundary_set_id <- "bd-district-2022-geoboundaries-adm2"
boundary_level <- "district"
census_dataset_id <- "bbs-phc-2022-table-p08-religion-district"
boundary_dataset_id <- "geoboundaries-bgd-adm2"

census_pdf_path <- file.path(raw_dir, "phc2022_national_report_vol1.pdf")
boundary_path <- file.path(raw_dir, "geoboundaries_bgd_adm2.geojson")
boundary_meta_path <- file.path(raw_dir, "geoboundaries_bgd_adm2_metadata.json")

census_pdf_url <- "https://objectstorage.ap-dcc-gazipur-1.oraclecloud15.com/n/axvjbnqprylg/b/V2Ministry/o/office-bbs/2024/12/9ce5bd160bb14a1ab1eabe886adddb9a.pdf"
bbs_site_url <- "https://bbs.gov.bd/"
boundary_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/BGD/ADM2/geoBoundaries-BGD-ADM2.geojson"
boundary_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/BGD/ADM2/"

boundary_out <- file.path(out_dir, "bd_district_2022.geojson")
summary_json_out <- file.path(out_dir, "area_summary_district_2022.json")
summary_csv_out <- file.path(out_dir, "area_summary_district_2022.csv")
manifest_out <- file.path(manifest_dir, "bd-census-religion-2022.json")

# category frame as printed in Table P08, in column order.
categories <- c("Muslim", "Hindu", "Christian", "Buddhist", "Others")

# verified national category totals (Table P08, male+female basis). these anchor
# the extraction against pdftotext column drift; a mismatch stops the build.
national_expected <- c(
  Muslim = 150415066L, Hindu = 13143749L, Christian = 488555L,
  Buddhist = 1001927L, Others = 101195L
)

# census district spelling -> geoBoundaries ADM2 shapeName. the two sources name
# the same 64 districts; this maps only anglicised-spelling differences and
# invents no geography. every other district name matches verbatim.
name_concordance <- c(
  "Barishal" = "Barisal",
  "Chattogram" = "Chittagong",
  "Cumilla" = "Comilla",
  "Brahmanbaria" = "Brahamanbaria",
  "Bogura" = "Bogra",
  "Jashore" = "Jessore",
  "Moulvibazar" = "Maulvibazar",
  "Netrokona" = "Netrakona",
  "Chapainawabganj" = "Nawabganj"
)

# stop early when a raw source required for the governed build is missing.
require_file <- function(path) {
  if (!file.exists(path)) stop("missing required source: ", path, call. = FALSE)
}

# compute the sha-256 digest for a local file.
sha256_file <- function(path) unname(tools::sha256sum(path))

# return file size in bytes for manifest records.
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))

# turn a district name into a stable lowercase area code used as the join key.
slugify <- function(value) {
  slug <- tolower(trimws(value))
  slug <- gsub("[^a-z0-9]+", "_", slug)
  gsub("^_|_$", "", slug)
}

# extract Table P08 rows from the census PDF with poppler pdftotext -layout.
# returns a data frame with the row name and the fifteen integer count columns.
read_table_p08 <- function(pdf_path) {
  require_file(pdf_path)
  if (nchar(Sys.which("pdftotext")) == 0L) {
    stop("pdftotext (poppler) is required to extract Table P08", call. = FALSE)
  }
  txt_path <- tempfile(fileext = ".txt")
  on.exit(unlink(txt_path), add = TRUE)
  status <- system2("pdftotext", c("-layout", shQuote(pdf_path), shQuote(txt_path)))
  if (!identical(status, 0L)) stop("pdftotext failed on ", pdf_path, call. = FALSE)
  lines <- readLines(txt_path, warn = FALSE)

  start <- grep("Table P08 Population by Religion, Sex and District", lines, fixed = TRUE)
  end <- grep("Table P09", lines, fixed = TRUE)
  if (!length(start)) stop("Table P08 marker not found", call. = FALSE)
  if (!length(end)) stop("Table P09 end marker not found", call. = FALSE)
  region <- lines[start[1]:(end[end > start[1]][1] - 1L)]

  rows <- list()
  for (ln in region) {
    s <- trimws(ln)
    if (!nzchar(s)) next
    # a data row is a name followed by exactly fifteen integers.
    m <- regmatches(s, regexec("^([A-Za-z][A-Za-z. '-]*?)\\s+([0-9][0-9 ]*)$", s))[[1]]
    if (length(m) != 3L) next
    ints <- as.integer(strsplit(trimws(m[3]), "\\s+")[[1]])
    if (length(ints) != 15L || any(is.na(ints))) next
    rows[[length(rows) + 1L]] <- c(list(name = trimws(m[2])), as.list(ints))
  }
  if (!length(rows)) stop("no Table P08 data rows parsed", call. = FALSE)
  df <- do.call(rbind, lapply(rows, function(r) {
    data.frame(name = r$name, matrix(unlist(r[-1]), nrow = 1), stringsAsFactors = FALSE)
  }))
  colnames(df) <- c(
    "name",
    paste(rep(categories, each = 3), rep(c("T", "M", "F"), times = 5), sep = "_")
  )
  df
}

# fail-fast reconciliation of Table P08: cell sex totals, district-to-division,
# division-to-national, and the verified national anchor. returns the district
# rows on success and stops on any nonzero difference.
reconcile_p08 <- function(df) {
  count_cols <- setdiff(colnames(df), "name")
  total_cols <- paste0(categories, "_T")

  # every Male + Female must equal the printed Total, per category and row.
  for (cat in categories) {
    bad <- which(df[[paste0(cat, "_M")]] + df[[paste0(cat, "_F")]] != df[[paste0(cat, "_T")]])
    if (length(bad)) {
      stop("sex-total reconciliation failed for ", cat, " in rows: ",
           paste(df$name[bad], collapse = ", "), call. = FALSE)
    }
  }

  is_division <- grepl(" Division$", df$name)
  is_national <- df$name == "National"
  if (sum(is_national) != 1L) stop("expected exactly one National row", call. = FALSE)
  if (sum(is_division) != 8L) {
    stop("expected 8 division rows, found ", sum(is_division), call. = FALSE)
  }

  # assign each district to the most recent preceding division, in table order.
  division_of <- rep(NA_character_, nrow(df))
  current <- NA_character_
  for (i in seq_len(nrow(df))) {
    if (is_national[i]) next
    if (is_division[i]) { current <- df$name[i]; next }
    division_of[i] <- current
  }
  districts <- df[!is_division & !is_national, , drop = FALSE]
  district_div <- division_of[!is_division & !is_national]
  if (nrow(districts) != 64L) {
    stop("expected 64 district rows, found ", nrow(districts), call. = FALSE)
  }
  if (any(is.na(district_div))) stop("a district row precedes any division", call. = FALSE)

  # districts must sum to their division for all fifteen columns.
  for (div in df$name[is_division]) {
    members <- districts[district_div == div, count_cols, drop = FALSE]
    div_row <- df[df$name == div, count_cols, drop = FALSE]
    diff <- colSums(members) - unlist(div_row)
    if (any(diff != 0)) {
      stop("district-to-division reconciliation failed for ", div, call. = FALSE)
    }
  }

  # divisions must sum to the national row for all fifteen columns.
  div_rows <- df[is_division, count_cols, drop = FALSE]
  nat_row <- df[is_national, count_cols, drop = FALSE]
  diff <- colSums(div_rows) - unlist(nat_row)
  if (any(diff != 0)) stop("division-to-national reconciliation failed", call. = FALSE)

  # the national category totals must match the verified anchor exactly.
  nat_totals <- setNames(unlist(df[is_national, total_cols]), categories)
  if (!all(nat_totals[names(national_expected)] == national_expected)) {
    stop("national category totals do not match the verified anchor", call. = FALSE)
  }

  districts$division <- district_div
  districts
}

# convert NA to a JSON null scalar.
null_if_na <- function(value) {
  if (length(value) == 0L || is.na(value) || !is.finite(value)) return(NULL)
  value
}

# build the source-dataset records for the product.
source_datasets <- function() {
  list(
    list(
      source_dataset_id = census_dataset_id,
      name = "Population and Housing Census 2022, National Report (Volume I), Table P08: Population by Religion, Sex and District",
      provider = "Bangladesh Bureau of Statistics (BBS), Statistics and Informatics Division, Ministry of Planning",
      url = census_pdf_url,
      retrieval_date = retrieval_date,
      local_path = census_pdf_path,
      licence = list(
        name = "BBS copyright asserted; reuse terms unresolved",
        url = bbs_site_url,
        attribution = "Bangladesh Bureau of Statistics"
      ),
      citation = "Bangladesh Bureau of Statistics, Population and Housing Census 2022, National Report (Volume I), November 2023 (revised January 2024), ISBN 978-984-475-201-6, Table P08.",
      access_limits = "The canonical bbs.portal.gov.bd host was unreachable; the report was retrieved from the BBS Oracle Cloud object-storage mirror. TLS chain validation failed for the bbs.gov.bd hosts in the local environment.",
      redistribution_limits = "The report front matter asserts copyright (c) BBS with no open-reuse licence located. The raw PDF is not committed; this derived product is held in staging until BBS reuse terms are established.",
      notes = "Table P08 reports Muslim, Hindu, Christian, Buddhist, and Others by Total, Male and Female for 64 districts in 8 divisions plus a national row. The sex-classified table excludes the 8,124 hijra (third-gender) persons who are religion-classified only in Table 3.2.15; the district table therefore sums to 165,150,492 rather than the full 165,158,616 population."
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "geoBoundaries BGD ADM2 (district) boundaries",
      provider = "geoBoundaries (William & Mary geoLab); source Bangladesh Bureau of Statistics and OCHA ROAP",
      url = boundary_meta_url,
      retrieval_date = retrieval_date,
      local_path = boundary_path,
      licence = list(
        name = "Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO)",
        url = "https://creativecommons.org/licenses/by/3.0/igo/",
        attribution = "geoBoundaries; Bangladesh Bureau of Statistics; OCHA ROAP"
      ),
      citation = "geoBoundaries BGD ADM2, boundary ID BGD-ADM2-16705992, release commit 9469f09.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary attributes geoBoundaries and its BBS/OCHA sources under CC BY 3.0 IGO.",
      notes = "64 features; boundaryYearRepresented 2020; the 64-district set is stable across the 2011 and 2022 census waves."
    )
  )
}

# build the indicator records for the product.
indicators <- function() {
  list(
    list(
      indicator_id = "population_total",
      label = "Population classified by religion (male + female)",
      description = "Sum of the five Table P08 religion categories in the district; the sex-classified population.",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "Sum of the Total columns for Muslim, Hindu, Christian, Buddhist and Others in Table P08.",
      temporal_coverage = "2022",
      spatial_coverage = "Bangladesh districts (zila), 64 units",
      quality_notes = "The Table P08 basis excludes the 8,124 hijra (third-gender) persons nationally, who are religion-classified only in the division-level Table 3.2.15. There is no not-stated or non-response category."
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious affiliation %",
      description = "Share of the classified population reporting one of the five census religion categories.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * (Muslim + Hindu + Christian + Buddhist + Others) / population_total. Every person is classified into a religion category; this therefore equals 100 for every district.",
      temporal_coverage = "2022",
      spatial_coverage = "Bangladesh districts (zila), 64 units",
      quality_notes = "Bangladesh's census records no no-religion and no not-stated category; affiliation is therefore 100 percent in every district. The per-district composition (Muslim, Hindu, Christian, Buddhist, Others counts) is carried verbatim in each row's quality_flag."
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "No religion %",
      description = "Unavailable: the BBS census religion frame has no no-religion category.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "Not calculated. The frame is Muslim, Hindu, Christian, Buddhist, Others, with no no-religion or not-stated category.",
      temporal_coverage = "2022",
      spatial_coverage = "Bangladesh districts (zila), 64 units",
      quality_notes = "Rows carry no_religion_category_absent and null no_religion_count/no_religion_percent."
    )
  )
}

# build the single choropleth visual layer exposed for the product.
visual_layers <- function() {
  list(list(
    visual_layer_id = "bd-district-2022-religious-affiliation",
    label = "Religious affiliation %",
    description = "Population and Housing Census 2022 religious-affiliation share by district.",
    layer_type = "choropleth",
    indicator_ids = list("religious_affiliation_percent"),
    geometry_unit_type = "area_unit",
    legend = NULL,
    colour_scale = "shared sequential blue",
    time_control = "year_selector",
    aggregation_rule = "reported district value",
    uncertainty_display = "quality_flag",
    default_visibility = TRUE,
    notes = "No no-religion layer is exposed because the census frame has no no-religion category. Affiliation is 100 percent everywhere; the informative detail is the per-category composition in each row's quality_flag."
  ))
}

# assemble one schema-shaped area-summary row for a district.
build_row <- function(area_code, area_name, land_area_sq_km, counts) {
  total <- sum(counts[paste0(categories, "_T")])
  composition <- paste(
    sprintf("%s=%d", categories, as.integer(counts[paste0(categories, "_T")])),
    collapse = ";"
  )
  flags <- paste0(
    "census_affiliation_recognised_frame;",
    "affiliation=100_all_persons_classified;",
    composition, ";",
    "source_categories_verbatim=Muslim|Hindu|Christian|Buddhist|Others;",
    "no_religion_category_absent;not_stated_category_absent;",
    "sex_classified_basis_excludes_hijra;",
    "exact_district_division_national_reconciliation"
  )
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = paste0(boundary_set_id, ":", area_code),
    area_code = area_code,
    area_name = area_name,
    year = census_year,
    population_total = as.integer(total),
    population_total_basis = "Sum of the five Table P08 religion categories (Muslim, Hindu, Christian, Buddhist, Others), the male + female classified population; excludes hijra (third gender), who are religion-classified only at division level in Table 3.2.15. This product renders the BBS census record of religious affiliation as the source publishes it; the recognised categories are Muslim, Hindu, Christian, Buddhist and Others, with no no-religion and no not-stated category.",
    religious_affiliation_count = as.integer(total),
    religious_affiliation_percent = 100,
    no_religion_count = NULL,
    no_religion_percent = NULL,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(land_area_sq_km, 2),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = c(census_dataset_id, boundary_dataset_id),
    quality_flag = flags
  )
}

# flatten the area-summary rows for the CSV sibling.
flatten_rows <- function(rows) {
  do.call(rbind, lapply(rows, function(row) {
    data.frame(
      country_code = row$country_code,
      boundary_set_id = row$boundary_set_id,
      boundary_level = row$boundary_level,
      area_unit_id = row$area_unit_id,
      area_code = row$area_code,
      area_name = row$area_name,
      year = row$year,
      population_total = row$population_total,
      population_total_basis = row$population_total_basis,
      religious_affiliation_count = row$religious_affiliation_count,
      religious_affiliation_percent = row$religious_affiliation_percent,
      no_religion_count = NA_integer_,
      no_religion_percent = NA_real_,
      place_count = NA_integer_,
      places_per_10000_residents = NA_real_,
      place_density_per_sq_km = NA_real_,
      land_area_sq_km = row$land_area_sq_km,
      site_snapshot_date = NA,
      place_count_basis = NA,
      source_dataset_ids = paste(row$source_dataset_ids, collapse = "|"),
      quality_flag = row$quality_flag,
      stringsAsFactors = FALSE
    )
  }))
}

# return feature or row counts for generated files.
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$", path)) {
    return(length(fromJSON(path, simplifyVector = FALSE)[["features"]]))
  }
  if (grepl("\\.json$", path)) {
    j <- fromJSON(path, simplifyVector = FALSE)
    if (!is.null(j[["rows"]])) return(length(j[["rows"]]))
  }
  NA_integer_
}

# validate a JSON file by parsing its contents.
validate_json_file <- function(path) {
  jsonlite::validate(paste(readLines(path, warn = FALSE), collapse = "\n"))
}

# read, label, measure, simplify, and write the district boundary layer. joins
# the geoBoundaries features to the census districts via the spelling
# concordance and stops unless the join is exactly 64:64.
write_boundary_product <- function(path, census_names, output_path) {
  raw <- st_read(path, quiet = TRUE)
  if (!"shapeName" %in% names(raw)) stop("boundary lacks shapeName property", call. = FALSE)

  # map each census district name to its geoBoundaries shapeName.
  boundary_for_census <- ifelse(census_names %in% names(name_concordance),
                                name_concordance[census_names], census_names)
  boundary_names <- raw[["shapeName"]]
  missing <- setdiff(boundary_for_census, boundary_names)
  extra <- setdiff(boundary_names, boundary_for_census)
  if (length(missing) || length(extra) || nrow(raw) != 64L) {
    stop("boundary-census join is not exactly 64:64 (missing: ",
         paste(missing, collapse = ", "), "; extra: ",
         paste(extra, collapse = ", "), ")", call. = FALSE)
  }

  # attach the census area code and name to each feature by its shapeName.
  lookup <- data.frame(
    shapeName = boundary_for_census,
    area_code = slugify(census_names),
    area_name = census_names,
    stringsAsFactors = FALSE
  )
  idx <- match(raw[["shapeName"]], lookup$shapeName)
  raw[["area_code"]] <- lookup$area_code[idx]
  raw[["area_name"]] <- lookup$area_name[idx]

  boundaries <- raw[order(raw[["area_code"]]), c("area_code", "area_name")]
  boundaries <- st_make_valid(boundaries)
  projected <- st_make_valid(st_transform(boundaries, 8857))
  area_table <- st_drop_geometry(boundaries)
  area_table[["land_area_sq_km"]] <- as.numeric(st_area(projected)) / 1e6

  tolerances <- c(250, 500, 750, 1000, 1500, 2000, 3000, 5000, 8000, 12000, 20000)
  chosen_tolerance <- tail(tolerances, 1)
  chosen_bytes <- NA_integer_
  for (tolerance in tolerances) {
    candidate <- st_simplify(projected, dTolerance = tolerance, preserveTopology = TRUE)
    candidate <- st_make_valid(st_transform(candidate, 4326))
    st_write(candidate, output_path, quiet = TRUE, delete_dsn = TRUE)
    chosen_bytes <- file_bytes(output_path)
    chosen_tolerance <- tolerance
    if (chosen_bytes <= 3000000L) break
  }
  if (chosen_bytes > 3000000L) {
    stop("boundary output remains larger than 3 MB after maximum simplification", call. = FALSE)
  }

  list(
    area_table = area_table,
    source_feature_count = nrow(raw),
    output_feature_count = row_count_file(output_path),
    simplification_tolerance_m = chosen_tolerance,
    output_bytes = chosen_bytes
  )
}

# --- build ---------------------------------------------------------------

require_file(census_pdf_path)
require_file(boundary_path)
require_file(boundary_meta_path)

p08 <- read_table_p08(census_pdf_path)
districts <- reconcile_p08(p08)

boundary_info <- write_boundary_product(boundary_path, districts$name, boundary_out)
area_table <- boundary_info[["area_table"]]

# build one row per district, joined by the slugified area code.
rows <- unname(lapply(seq_len(nrow(area_table)), function(i) {
  area_code <- area_table$area_code[i]
  district_name <- area_table$area_name[i]
  src <- districts[districts$name == district_name, , drop = FALSE]
  if (nrow(src) != 1L) stop("expected one census row for ", district_name, call. = FALSE)
  counts <- unlist(src[, setdiff(colnames(src), c("name", "division"))])
  build_row(area_code, district_name, area_table$land_area_sq_km[i], counts)
}))

# join coverage must be exactly 64:64 by area code.
census_codes <- sort(slugify(districts$name))
boundary_codes <- sort(area_table$area_code)
if (!identical(census_codes, boundary_codes)) {
  stop("area-code join coverage failed between census and boundary", call. = FALSE)
}

area_summary <- list(
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
    basis = "no governed Bangladesh OpenStreetMap place-of-worship snapshot is included in this country data-map release",
    notes = "The Bangladesh page exposes the census religious-affiliation share only; place-density metrics are hidden until a governed Bangladesh place layer is built."
  ),
  source_datasets = source_datasets(),
  indicators = indicators(),
  visual_layers = visual_layers(),
  rows = rows
)

write_json(area_summary, summary_json_out, auto_unbox = TRUE, pretty = TRUE,
           null = "null", na = "null", digits = NA)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")
if (!validate_json_file(summary_json_out)) stop("invalid summary JSON", call. = FALSE)

version_hash <- substr(sha256_file(summary_json_out), 1, 12)

# manifest durable-file record for one generated output.
manifest_file_record <- function(path, content, licence_status) {
  list(
    uri = paste0("repo:", path),
    storage_provider = "git_repository",
    format = sub("^.*\\.", "", path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    row_count = row_count_file(path),
    content = content,
    privacy = "public",
    licence_status = licence_status
  )
}

# manifest raw-source record for one cached input.
raw_file_record <- function(path, url, notes, source_dataset_id, used = TRUE) {
  list(
    uri = path,
    url = url,
    format = sub("^.*\\.", "", path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    source_dataset_id = source_dataset_id,
    used_in_public_product = used,
    notes = notes
  )
}

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = paste0("manifest:bd-census-religion:bd:2022:", version_hash),
  dataset_id = "bd-census-religion:bd:2022:bbs-phc2022-district",
  dataset_version_id = paste0("bd-census-religion:bd:2022:bbs-phc2022-district:", version_hash),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "bd-census-religion",
  dataset_role = "staged_evidence",
  scope = list(
    level = "country",
    country_codes = list(country_code),
    snapshot_date = NULL,
    snapshot_anchor = NULL,
    pipeline_stage = "staged"
  ),
  created_at = stamp,
  created_by = script_id,
  pipeline = list(
    script = script_id,
    git_commit = NULL,
    command = paste("Rscript", script_id),
    parameters = list(
      waves = "2022",
      geography = "64 districts (zila) in 8 divisions",
      construct = "census religious affiliation in the BBS recognised categories",
      category_frame = as.list(categories),
      source_table = "Table P08: Population by Religion, Sex and District, 2022",
      affiliation_rule = "affiliation = 100 percent; every person is classified into one of Muslim, Hindu, Christian, Buddhist, Others; no no-religion or not-stated category; no_religion fields null",
      denominator = "sum of the five religion Total columns (male + female classified population); excludes 8,124 hijra classified only at division level",
      name_concordance = as.list(paste(names(name_concordance), name_concordance, sep = " -> ")),
      boundary_source_vintage = "geoBoundaries BGD ADM2, boundaryYearRepresented 2020",
      boundary_simplification_tolerance_m = boundary_info[["simplification_tolerance_m"]],
      omitted_metrics = c("no_religion_percent visual layer", "religious_change",
                          "places_per_10000_residents", "place_density_per_sq_km")
    ),
    software_versions = list(
      r = paste(R.version[["major"]], R.version[["minor"]], sep = "."),
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite"))
    )
  ),
  source = list(
    provider = "Bangladesh Bureau of Statistics (BBS); geoBoundaries (W&M geoLab), BBS/OCHA ROAP",
    source_dataset_ids = c(census_dataset_id, boundary_dataset_id),
    source_urls = c(census_pdf_url, bbs_site_url, boundary_url, boundary_meta_url),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = "Census: BBS copyright asserted (ISBN 978-984-475-201-6); no open-reuse licence located, reuse terms unresolved. Boundary: CC BY 3.0 IGO (geoBoundaries; BBS; OCHA ROAP).",
    citation = "Bangladesh Bureau of Statistics, Population and Housing Census 2022, National Report (Volume I), Table P08; geoBoundaries BGD ADM2.",
    raw_redistribution = "Raw census PDF and boundary GeoJSON are not committed. They remain in data/raw/bd_census/ pending any project-controlled raw archive."
  ),
  input_manifests = list(),
  raw_sources = list(
    raw_file_record(census_pdf_path, census_pdf_url,
      "BBS PHC 2022 National Report (Volume I). Table P08 extracted with pdftotext -layout; 64 districts reconcile exactly to 8 divisions and the national row.",
      census_dataset_id),
    raw_file_record(boundary_path, boundary_url,
      "geoBoundaries BGD ADM2, 64 district features, joined to the census districts via the spelling concordance.",
      boundary_dataset_id),
    raw_file_record(boundary_meta_path, boundary_meta_url,
      "geoBoundaries BGD ADM2 release metadata; records boundary ID BGD-ADM2-16705992, 64 units, CC BY 3.0 IGO.",
      boundary_dataset_id)
  ),
  durable_files = list(
    manifest_file_record(summary_json_out, "Bangladesh 2022 district area summary with BBS census religious-affiliation metrics.", "needs_review"),
    manifest_file_record(summary_csv_out, "Flattened Bangladesh 2022 district area summary.", "needs_review"),
    manifest_file_record(boundary_out, "Simplified Bangladesh district boundary GeoJSON derived from geoBoundaries BGD ADM2.", "accepted")
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out),
         built_by = script_id, notes = sprintf("%d districts; denominator is the sum of the five Table P08 religion categories.", length(rows))),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out),
         built_by = script_id, notes = sprintf("geoBoundaries BGD ADM2 simplified at %d m tolerance to %d bytes.", boundary_info[["simplification_tolerance_m"]], boundary_info[["output_bytes"]]))
  ),
  validation = list(
    status = "passed",
    checks = list(
      "Table P08 parsed to exactly 1 national + 8 division + 64 district rows.",
      "Every Male + Female cell equals its printed Total across all five categories and all rows.",
      "Every district sums to its division and every division to the national row for all fifteen count columns.",
      "National category totals match the verified anchor: Muslim 150,415,066; Hindu 13,143,749; Christian 488,555; Buddhist 1,001,927; Others 101,195.",
      "The census-boundary district join is exactly 64:64 after the anglicised-spelling concordance.",
      sprintf("The simplified boundary has %d features and %d bytes after %d m simplification.",
              boundary_info[["output_feature_count"]], boundary_info[["output_bytes"]], boundary_info[["simplification_tolerance_m"]]),
      "The area-summary schema allows null no_religion values; rows carry null no-religion and no_religion_category_absent.",
      "Census publication reuse rights are unresolved: BBS asserts copyright and no open-reuse licence was located. The product is held in staging."
    ),
    join_coverage = list(
      matched_area_count = length(rows),
      expected_area_count = nrow(area_table),
      source_area_count = nrow(districts)
    ),
    boundary_validation = list(
      source_feature_count = boundary_info[["source_feature_count"]],
      output_feature_count = boundary_info[["output_feature_count"]],
      output_bytes = boundary_info[["output_bytes"]],
      simplification_tolerance_m = boundary_info[["simplification_tolerance_m"]]
    )
  ),
  deferred_sources = list(
    list(
      source_dataset_id = "bbs-phc-2011-community-report-series",
      url = "http://nsds.bbs.gov.bd/en/posts/95/Preliminary%20Report%20on%20Population%20and%20Housing%20Census%202022",
      local_path = file.path(raw_dir, "phc2011_community_sherpur.pdf"),
      notes = "The 2011 census published religion down to community (union) level via the per-zila Community Report series (Table C-13, same 5-category frame). One zila (Sherpur) is cached as a frame witness. A consolidated 64-zila 2011 product is deferred: it would require assembling 64 community reports or locating a single machine-readable national volume."
    ),
    list(
      source_dataset_id = "bbs-census-2001-1991-1981-subnational-religion",
      url = bbs_site_url,
      local_path = NULL,
      notes = "National religion figures are established for 2001, 1991 and 1981, but no machine-readable subnational religion file was located online for these waves in this probe. The audit row's 1981-2022 subnational span is therefore only verified for 2022 (district) and 2011 (community); 2001, 1991 and 1981 subnational religion remains unpinned."
    )
  ),
  construct_notes = list(
    "The BBS census religion frame is Muslim, Hindu, Christian, Buddhist and Others. There is no no-religion category and no not-stated category.",
    "religious_affiliation_percent is 100 in every district because every enumerated person is classified into a religion. The informative detail is the per-category composition, carried verbatim in each row's quality_flag.",
    "no_religion_count and no_religion_percent are null for every row and every row carries no_religion_category_absent.",
    "The district table (Table P08) is the sex-classified basis and excludes the 8,124 hijra (third gender) persons nationally, who are religion-classified only in the division-level Table 3.2.15.",
    "Religion figures in Bangladesh are politically salient for minority populations; the product renders the BBS record exactly and names the recognised categories neutrally, with no editorial framing."
  ),
  privacy = "public",
  licence_status = "needs_review",
  downstream_status = "staged",
  source_datasets = source_datasets(),
  notes = "Staged, not public: the census reuse licence is unresolved. The committed products contain the derived area summary and a simplified district boundary only. On-page attribution cites BBS and geoBoundaries with the CC BY 3.0 IGO boundary licence."
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!validate_json_file(manifest_out)) stop("invalid manifest JSON", call. = FALSE)

cat(sprintf("wrote %s: %d rows\n", summary_json_out, length(rows)))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s: %d features, %d bytes\n", boundary_out, row_count_file(boundary_out), file_bytes(boundary_out)))
cat(sprintf("wrote %s\n", manifest_out))
cat("done\n")
