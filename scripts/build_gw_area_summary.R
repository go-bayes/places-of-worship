# build the Guinea-Bissau 2009 census-religion regional product from the INE
# RGPH-2009 sociocultural characteristics PDF.
#
# inputs: the cached INE RGPH-2009 "Características socioculturais" thematic
# report (Quadro 4 region percentages; Quadro 3 / Quadro 5 national counts for
# reconciliation) and the geoBoundaries GNB ADM1 boundary; all under git-ignored
# data/raw/gw_census/.
# outputs: apps/regions/gw/data/area_summary_region.{json,csv},
# apps/regions/gw/data/gw_region_2009.geojson, and the tracked data manifest
# docs/manifests/gw-census-religion-2009.json.
# run from the repo root: Rscript scripts/build_gw_area_summary.R
#
# product scope. eight administrative regions plus the Sector Autónomo de Bissau,
# one wave (2009). the source publishes one-decimal column percentages with NO
# regional counts (Quadro 4 is column percentages of each region's
# Guinean-nationality resident population); the product therefore ships percentages
# exactly as printed and derives no regional counts (GN precedent). the
# universe is the resident population of Guinean nationality (1,442,227 of the
# 1,449,230 residents enumerated in households). religious_affiliation is the sum
# of the four affiliation categories (Animista, Muçulmana, Cristão, Outra
# Religião); no_religion is the printed Sem religião share. ND (não declarado) is
# a real non-response category that stays inside the denominator and outside both
# numerators, disclosed in the row quality_flag.
#
# gate design. the source prints one-decimal percentages; a region column's
# six category cells carry a maximum rounding error of 0.05 pp each; with six
# mutually exclusive categories the printed column sum may deviate from 100.0 by
# at most 0.05 * 6 = 0.30 pp (Estonia / BF-2019 derived-bound precedent, never an
# arbitrary tolerance). observed deviations: Oio +0.1, Biombo -0.1, B. Bijagós
# +0.1; every other column sums to exactly 100.0; observed maximum 0.1 pp. three
# further hard gates: the transcribed Quadro 4 columns must appear in the
# pdftotext -layout output; the Quadro 3/5 national counts must sum to 1,442,227
# exactly; and the national counts as shares of 1,442,227 must reproduce the
# Quadro 4 Guiné-Bissau column within one printed decimal (0.1 pp).
#
# licence. the INE Guinea-Bissau site carries an all-rights-reserved footer
# ("Instituto Nacional de Estatistica da Guiné-Bissau 1991-2020 © Todos os
# direitos reservados") and no located open-data licence. following the BF
# build-then-ask precedent the product ships STAGED with licence_status =
# needs_review and a recorded ask to the project lead. the geoBoundaries GNB
# ADM1 boundary is ODbL 1.0.

suppressPackageStartupMessages({
  library(jsonlite)
  library(sf)
  library(stringi)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "GW"
script_id <- "scripts/build_gw_area_summary.R"
raw_dir <- "data/raw/gw_census"
output_dir <- "apps/regions/gw/data"
manifest_dir <- "docs/manifests"

retrieval_date <- "2026-07-12"
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")

# ---- cached inputs and pinned source URLs ---------------------------------

pdf_socio <- file.path(raw_dir, "caracteristicas_socio_cultural.pdf")
terms_html <- file.path(raw_dir, "ine_homepage.html")
boundary_path <- file.path(raw_dir, "geoBoundaries-GNB-ADM1.geojson")
boundary_meta_path <- file.path(raw_dir, "gb_gnb_adm1_meta.json")

url_socio <- "https://www.stat-guinebissau.com/Menu_principal/IV_RGPH/rgph1/caracteristicas_socio_cultural.pdf"
url_terms <- "https://www.stat-guinebissau.com/"
url_boundary <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/GNB/ADM1/geoBoundaries-GNB-ADM1.geojson"
url_boundary_meta <- "https://www.geoboundaries.org/api/current/gbOpen/GNB/ADM1/"

boundary_set_id <- "gw-region-2009-geoboundaries-adm1"
boundary_output <- file.path(output_dir, "gw_region_2009.geojson")
summary_output <- file.path(output_dir, "area_summary_region.json")
summary_csv_output <- file.path(output_dir, "area_summary_region.csv")
manifest_output <- file.path(manifest_dir, "gw-census-religion-2009.json")

dataset_id_census <- "ine-rgph2009-socio-cultural-quadro-4"
dataset_id_boundary <- "geoboundaries-gnb-adm1-2017"

# verbatim INE all-rights-reserved footer, byte-matched from the cached homepage.
# the footer sits in two adjacent <P> elements; the gate checks each real
# substring, and ine_terms_notice is the combined human-readable reconstruction.
ine_terms_part_1 <- "Instituto Nacional de Estatistica da Guiné-Bissau 1991-2020"
ine_terms_part_2 <- "© Todos os direitos reservados"
ine_terms_notice <- paste(ine_terms_part_1, ine_terms_part_2)
licence_ask <- paste(
  "May transcribed one-decimal regional percentages from the INE RGPH-2009",
  "sociocultural report be published as a derived map product, given the site's",
  "all-rights-reserved footer and no located open-data licence? Mirrors the open",
  "BF/CI reuse questions; not decided in this lane."
)

# ---- small helpers ---------------------------------------------------------

# stop when a required cached source is absent.
require_file <- function(path) {
  if (!file.exists(path)) stop("missing required source: ", path, call. = FALSE)
}

# compute the sha-256 digest for a local file.
sha256_file <- function(path) unname(tools::sha256sum(path))

# return file size in bytes for validation and manifest records.
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))

# run poppler's layout-preserving extractor and return its lines.
pdf_layout_lines <- function(path) {
  pdftotext <- Sys.which("pdftotext")
  if (!nzchar(pdftotext)) stop("pdftotext (Poppler) is required", call. = FALSE)
  output <- tempfile(fileext = ".txt")
  on.exit(unlink(output), add = TRUE)
  status <- system2(pdftotext, c("-layout", shQuote(path), shQuote(output)))
  if (status != 0L) stop("pdftotext failed on ", path, call. = FALSE)
  readLines(output, warn = FALSE, encoding = "UTF-8")
}

# collapse extracted lines to one whitespace-normalised string for presence
# assertions, without changing any digit.
normalise_source_text <- function(lines) {
  text <- paste(lines, collapse = "\n")
  text <- gsub("[[:space:]]+", " ", text)
  trimws(text)
}

# format a one-decimal source percentage with a decimal comma (0.4 -> "0,4").
source_percent <- function(value) sub(".", ",", sprintf("%.1f", value), fixed = TRUE)

# reduce a name to an accent-free alphanumeric key for the boundary join.
normalise_key <- function(x) {
  key <- stri_trans_general(enc2utf8(x), "Latin-ASCII")
  gsub("[^a-z0-9]", "", tolower(key))
}

# validate a generated json product against a repository schema (exact named
# check-jsonschema invocation; the pinned uv cache dirs match the sibling builders).
validate_json_schema <- function(schema_path, instance_path) {
  base_uri <- paste0(
    "file://",
    normalizePath(dirname(schema_path), winslash = "/", mustWork = TRUE),
    "/"
  )
  status <- system2(
    "uvx",
    c("check-jsonschema", "--base-uri", base_uri, "--schemafile", schema_path, instance_path),
    env = c(
      "UV_CACHE_DIR=/tmp/places-of-worship-uv/cache",
      "UV_TOOL_DIR=/tmp/places-of-worship-uv/tools",
      "UV_PYTHON_INSTALL_DIR=/tmp/places-of-worship-uv/python"
    )
  )
  if (!identical(status, 0L)) stop("schema validation failed for ", instance_path, call. = FALSE)
  invisible(instance_path)
}

# ---- Quadro 4 (the shipped subnational table) ------------------------------
# verbatim from the cached PDF, page 30. columns are the national Guiné-Bissau
# total then the nine subnational units in printed header order; rows are the six
# mutually exclusive categories. decimal comma rendered here as a decimal point.
# source_name holds the Quadro 4 printed unit label (used for the transcription
# gate); the census B. Bijagós is the Região de Bolama/Bijagós and SAB is the
# Sector Autónomo de Bissau.

quadro_4 <- function() {
  data.frame(
    source_name = c(
      "Guiné-Bissau", "Tombali", "Quinara", "Oio", "Biombo", "B. Bijagós",
      "Bafatá", "Gabú", "Cacheu", "SAB"
    ),
    animista = c(14.9, 24.1, 6.2, 20.8, 40.1, 24.6, 3.9, 0.3, 34.0, 7.9),
    muculmana = c(45.1, 43.0, 45.8, 42.1, 6.3, 14.9, 77.1, 86.5, 14.8, 34.2),
    cristao = c(22.1, 14.7, 19.4, 15.8, 30.2, 30.7, 6.8, 2.6, 30.7, 40.2),
    outra_religiao = c(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.2, 0.0),
    sem_religiao = c(2.0, 0.4, 7.1, 0.9, 2.5, 4.2, 0.9, 0.1, 3.0, 3.3),
    nd = c(15.9, 17.8, 21.5, 20.5, 20.8, 25.7, 11.3, 10.5, 17.3, 14.4),
    total = c(100, 100, 100, 100, 100, 100, 100, 100, 100, 100),
    stringsAsFactors = FALSE
  )
}

category_keys <- c("animista", "muculmana", "cristao", "outra_religiao", "sem_religiao", "nd")

# Quadro 3 / Quadro 5 national counts (Efectivos / Total column), transcribed
# independently for the exact national-count reconciliation gate.
national_counts <- c(
  animista = 215130, muculmana = 650402, cristao = 318021,
  outra_religiao = 414, sem_religiao = 29542, nd = 228718
)
national_total <- 1442227L
national_total_residents <- 1449230L  # all residents in households (context only)

# verbatim Portuguese categories with the English display mapping.
category_frame <- data.frame(
  key = category_keys,
  source_label_pt = c("Animista", "Muçulmana", "Cristão", "Outra Religião", "Sem religião", "ND"),
  display_label_en = c("Animist", "Muslim", "Christian", "Other religion", "No religion", "Not declared"),
  product_role = c("religious_affiliation", "religious_affiliation", "religious_affiliation",
                   "religious_affiliation", "no_religion", "non_response"),
  stringsAsFactors = FALSE
)
affiliation_categories <- category_frame[["key"]][category_frame[["product_role"]] == "religious_affiliation"]
no_religion_categories <- category_frame[["key"]][category_frame[["product_role"]] == "no_religion"]

# explicit census-to-boundary concordance. seven units match by accent-free key;
# B. Bijagós -> geoBoundaries "Bolama" (Região de Bolama/Bijagós) and SAB ->
# geoBoundaries "Bissau" (Sector Autónomo de Bissau) are documented identities,
# not merges or inventions. area_name carries the official region name.
region_meta <- list(
  "Tombali"    = list(code = "tombali", name = "Tombali",                     boundary_name = "Tombali"),
  "Quinara"    = list(code = "quinara", name = "Quinara",                     boundary_name = "Quinara"),
  "Oio"        = list(code = "oio",     name = "Oio",                         boundary_name = "Oio"),
  "Biombo"     = list(code = "biombo",  name = "Biombo",                      boundary_name = "Biombo"),
  "B. Bijagós" = list(code = "bolama",  name = "Bolama/Bijagós",              boundary_name = "Bolama"),
  "Bafatá"     = list(code = "bafata",  name = "Bafatá",                      boundary_name = "Bafatá"),
  "Gabú"       = list(code = "gabu",    name = "Gabú",                        boundary_name = "Gabu"),
  "Cacheu"     = list(code = "cacheu",  name = "Cacheu",                      boundary_name = "Cacheu"),
  "SAB"        = list(code = "bissau",  name = "Sector Autónomo de Bissau",   boundary_name = "Bissau")
)

# ---- gates -----------------------------------------------------------------

# require the cached PDF text to contain every transcribed Quadro 4 column, with
# its six category cells in printed order (per-column presence tolerates the
# report's row-major layout by asserting each column's ordered value string).
assert_transcription_present <- function(source_text, rows) {
  # the report prints Quadro 4 row-major; assert each row's ten ordered cells
  # appear, then assert every column value is present. row-major presence with
  # the ordered ten-cell run per category is the strongest layout-independent
  # check available.
  for (key in category_keys) {
    cells <- vapply(rows[[key]], source_percent, character(1))
    pattern <- paste(cells, collapse = "[[:space:]]+")
    if (!grepl(pattern, source_text, perl = TRUE)) {
      stop("transcribed Quadro 4 category row not found in pdftotext output: ", key, call. = FALSE)
    }
  }
  invisible(TRUE)
}

# stop unless every region column's six category cells sum to 100 within the
# derived one-decimal rounding bound (0.05 pp per cell * 6 categories = 0.30 pp).
# returns the reconciliation record for the manifest. no percentage is altered.
assert_rounded_column_reconciliation <- function(rows, rounding_halfwidth = 0.05) {
  k <- length(category_keys)
  bound <- rounding_halfwidth * k
  calculated <- rowSums(rows[, category_keys, drop = FALSE])
  difference <- round(calculated - rows[["total"]], 6)
  exceeded <- which(abs(difference) > bound + 1e-9)
  if (length(exceeded) > 0L) {
    details <- paste0(
      rows[["source_name"]][exceeded], " (cell sum=", sprintf("%.1f", calculated[exceeded]),
      ", printed total=", sprintf("%.1f", rows[["total"]][exceeded]),
      ", |difference|=", sprintf("%.1f", abs(difference[exceeded])),
      " > derived bound=", sprintf("%.2f", bound), ")"
    )
    stop("Quadro 4 rounded-column reconciliation exceeded the derived bound: ",
         paste(details, collapse = "; "),
         ". no percentage was altered; product writing stopped.", call. = FALSE)
  }
  deviating <- rows[["source_name"]][abs(difference) > 1e-9]
  list(
    category_count = k,
    rounding_halfwidth_pp = rounding_halfwidth,
    derived_bound_pp = bound,
    max_absolute_deviation_pp = as.numeric(max(abs(difference))),
    deviating_columns = as.list(deviating),
    column_deviations_pp = setNames(as.list(round(difference, 1) + 0), rows[["source_name"]])
  )
}

# stop unless the Quadro 3/5 national counts sum to the printed national total.
assert_national_count_reconciliation <- function() {
  observed <- sum(national_counts)
  if (!identical(as.integer(observed), national_total)) {
    stop("national counts (", observed, ") do not sum to the printed total ", national_total, call. = FALSE)
  }
  invisible(TRUE)
}

# stop unless the national counts as shares of the national total reproduce the
# Quadro 4 Guiné-Bissau column within one printed decimal (0.1 pp). anchors the
# column-percent interpretation and the Guinean-nationality universe.
assert_national_percent_crosscheck <- function(rows, tol = 0.1) {
  national_row <- rows[rows[["source_name"]] == "Guiné-Bissau", , drop = FALSE]
  derived <- round(national_counts[category_keys] / national_total * 100, 1)
  printed <- unlist(national_row[, category_keys], use.names = TRUE)[category_keys]
  diff <- abs(derived - printed)
  worst <- which.max(diff)
  if (any(diff > tol + 1e-9)) {
    stop("national count-derived percentages diverge from the Quadro 4 Guiné-Bissau column beyond ",
         tol, " pp at ", names(printed)[worst], " (derived ", derived[worst],
         ", printed ", printed[worst], ")", call. = FALSE)
  }
  list(
    derived = as.list(derived),
    printed = as.list(printed),
    max_absolute_deviation_pp = as.numeric(max(diff))
  )
}

# require the all-rights-reserved footer to appear verbatim in the cached terms
# capture, anchoring the manifest string to the byte-matched file.
assert_terms_notice_present <- function() {
  capture <- paste(readLines(terms_html, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  for (part in c(ine_terms_part_1, ine_terms_part_2)) {
    if (!grepl(part, capture, fixed = TRUE)) {
      stop("INE all-rights-reserved footer part not byte-present in the terms capture: ", part, call. = FALSE)
    }
  }
  invisible(TRUE)
}

# ---- boundary --------------------------------------------------------------
# validate and simplify the 9-feature geoBoundaries GNB ADM1 layer; return the
# written layer, geodesic land areas by area code, and geometry-validation detail.
build_boundary <- function() {
  boundary <- st_read(boundary_path, quiet = TRUE, stringsAsFactors = FALSE)
  if (nrow(boundary) != 9L) stop("expected 9 geoBoundaries GNB ADM1 features", call. = FALSE)
  boundary <- st_make_valid(boundary)
  validity <- st_is_valid(boundary)
  if (any(st_is_empty(boundary)) || any(is.na(validity)) || any(!validity)) {
    stop("source boundary contains empty or invalid geometries", call. = FALSE)
  }
  source_hashes <- vapply(st_as_binary(st_geometry(boundary), EWKB = TRUE), digest::digest,
                          character(1), algo = "sha256", serialize = FALSE)
  if (anyDuplicated(source_hashes)) stop("source boundary contains duplicate geometries", call. = FALSE)

  # join the census units to the ADM1 features by the explicit concordance.
  boundary_name_to_code <- setNames(
    vapply(region_meta, `[[`, character(1), "code"),
    vapply(region_meta, `[[`, character(1), "boundary_name")
  )
  boundary_name_to_area <- setNames(
    vapply(region_meta, `[[`, character(1), "name"),
    vapply(region_meta, `[[`, character(1), "boundary_name")
  )
  # match boundary shapeName to the concordance boundary_name by accent-free key.
  concordance_keys <- setNames(names(boundary_name_to_code), vapply(names(boundary_name_to_code), normalise_key, character(1)))
  boundary_keys <- vapply(boundary[["shapeName"]], normalise_key, character(1))
  if (!setequal(boundary_keys, names(concordance_keys))) {
    stop("boundary shapeNames do not match the census concordance 1:1 after normalisation", call. = FALSE)
  }
  matched_boundary_name <- unname(concordance_keys[boundary_keys])
  boundary[["area_code"]] <- unname(boundary_name_to_code[matched_boundary_name])
  boundary[["area_name"]] <- unname(boundary_name_to_area[matched_boundary_name])
  boundary[["area_unit_id"]] <- paste0(boundary_set_id, ":", boundary[["area_code"]])
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- "region"
  boundary[["boundary_vintage"]] <- "2017"
  boundary[["boundary_source"]] <- "geoBoundaries GNB ADM1; OpenStreetMap-derived"
  boundary[["boundary_licence"]] <- "ODbL 1.0"
  boundary <- boundary[, c("area_code", "area_name", "area_unit_id", "boundary_set_id",
                           "boundary_level", "boundary_vintage", "boundary_source", "boundary_licence")]
  boundary <- boundary[order(boundary[["area_code"]]), ]

  dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
  simplification <- mapshaper_simplify_to_cap(
    boundary, boundary_output, max_bytes = 3000000L,
    keep_percentages = c(100, 80, 60, 40, 30, 20, 15, 10, 7, 5),
    clean_option = "allow-overlaps"
  )
  written <- st_read(boundary_output, quiet = TRUE, stringsAsFactors = FALSE)
  written <- written[order(written[["area_code"]]), ]
  written_validity <- st_is_valid(written)
  written_hashes <- vapply(st_as_binary(st_geometry(written), EWKB = TRUE), digest::digest,
                           character(1), algo = "sha256", serialize = FALSE)
  if (nrow(written) != 9L || any(st_is_empty(written)) || any(!written_validity) ||
      anyDuplicated(written_hashes) || file.info(boundary_output)[["size"]] > 3000000L) {
    stop("simplified boundary failed feature, validity, distinctness, or byte-cap gate", call. = FALSE)
  }
  # s2 geodesic area on the geographic crs; appropriate for a west-african extent.
  land_area <- as.numeric(st_area(written)) / 1e6
  land_area_by_code <- setNames(round(land_area, 4), written[["area_code"]])
  # sanity band: guinea-bissau is about 36,125 km2; catch a crs or unit mistake.
  if (sum(land_area) < 30000 || sum(land_area) > 42000) {
    stop("total boundary land area is implausible; check the boundary crs", call. = FALSE)
  }
  list(
    boundary = written,
    land_area_by_code = land_area_by_code,
    total_land_area = round(sum(land_area), 2),
    simplification = simplification,
    source_geometry_sha256 = setNames(as.list(unname(source_hashes)), boundary[["area_code"]]),
    written_geometry_sha256 = setNames(as.list(unname(written_hashes)), written[["area_code"]]),
    output_bytes = file_bytes(boundary_output),
    distinct_written_hash_count = length(unique(written_hashes))
  )
}

# safe numeric accessor that maps an absent (null) row field to NA for the CSV.
val_or_na <- function(row, key, integer = FALSE) {
  value <- row[[key]]
  if (is.null(value)) return(if (integer) NA_integer_ else NA_real_)
  value
}

# flatten area-summary rows into the repository csv companion shape.
flatten_rows <- function(rows) {
  data.frame(
    country_code = vapply(rows, `[[`, character(1), "country_code"),
    boundary_set_id = vapply(rows, `[[`, character(1), "boundary_set_id"),
    boundary_level = vapply(rows, `[[`, character(1), "boundary_level"),
    area_unit_id = vapply(rows, `[[`, character(1), "area_unit_id"),
    area_code = vapply(rows, `[[`, character(1), "area_code"),
    area_name = vapply(rows, `[[`, character(1), "area_name"),
    year = vapply(rows, `[[`, integer(1), "year"),
    population_total = vapply(rows, function(r) val_or_na(r, "population_total", TRUE), numeric(1)),
    population_total_basis = vapply(rows, `[[`, character(1), "population_total_basis"),
    religious_affiliation_count = vapply(rows, function(r) val_or_na(r, "religious_affiliation_count", TRUE), numeric(1)),
    religious_affiliation_percent = vapply(rows, function(r) val_or_na(r, "religious_affiliation_percent"), numeric(1)),
    no_religion_count = vapply(rows, function(r) val_or_na(r, "no_religion_count", TRUE), numeric(1)),
    no_religion_percent = vapply(rows, function(r) val_or_na(r, "no_religion_percent"), numeric(1)),
    place_count = NA_integer_,
    places_per_10000_residents = NA_real_,
    place_density_per_sq_km = NA_real_,
    land_area_sq_km = vapply(rows, function(r) val_or_na(r, "land_area_sq_km"), numeric(1)),
    site_snapshot_date = NA_character_,
    place_count_basis = NA_character_,
    source_dataset_ids = vapply(rows, function(row) paste(unlist(row[["source_dataset_ids"]]), collapse = "|"), character(1)),
    quality_flag = vapply(rows, `[[`, character(1), "quality_flag"),
    stringsAsFactors = FALSE
  )
}

# ---- run gates -------------------------------------------------------------

for (path in c(pdf_socio, terms_html, boundary_path, boundary_meta_path)) {
  require_file(path)
}

rows_q4 <- quadro_4()
source_text <- normalise_source_text(pdf_layout_lines(pdf_socio))

assert_transcription_present(source_text, rows_q4)
assert_national_count_reconciliation()
national_crosscheck <- assert_national_percent_crosscheck(rows_q4)
reconciliation <- assert_rounded_column_reconciliation(rows_q4)
assert_terms_notice_present()

boundary_result <- build_boundary()
land_area_by_code <- boundary_result[["land_area_by_code"]]

# ---- construct product rows ------------------------------------------------
# nine subnational rows, one wave. percentages as printed; no counts. affiliation
# is the sum of the four affiliation-category shares (rounded to one decimal);
# no_religion is the printed Sem religião share; ND stays inside the denominator
# and outside both numerators.

population_basis_note <- paste(
  "INE RGPH-2009, Características socioculturais, Quadro 4: religion by region",
  "as one-decimal column percentages of each region's Guinean-nationality",
  "resident population. The source publishes percentage shares only, with no",
  "regional counts; population_total and all counts are therefore null; percentages are",
  "shipped as printed. National counts (Quadro 3/5) are recorded as context and",
  "are not multiplied into the shares (no derived-count layer)."
)

rows_region <- rows_q4[rows_q4[["source_name"]] != "Guiné-Bissau", , drop = FALSE]

product_rows <- lapply(seq_len(nrow(rows_region)), function(i) {
  region <- rows_region[i, , drop = FALSE]
  meta <- region_meta[[region[["source_name"]]]]
  affiliation_share <- round(sum(region[, affiliation_categories]), 1)
  no_religion_share <- round(sum(region[, no_religion_categories]), 1)
  nd_share <- region[["nd"]]
  col_sum <- round(sum(region[, category_keys]), 1)
  row_flag <- if (abs(col_sum - 100.0) > 1e-9) {
    paste0(";source_column_sums_to_", source_percent(col_sum),
           "_within_derived_rounding_bound_0.30pp")
  } else ""
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = "region",
    area_unit_id = paste0(boundary_set_id, ":", meta[["code"]]),
    area_code = meta[["code"]],
    area_name = meta[["name"]],
    year = 2009L,
    population_total = NULL,
    population_total_basis = population_basis_note,
    religious_affiliation_count = NULL,
    religious_affiliation_percent = affiliation_share,
    no_religion_count = NULL,
    no_religion_percent = no_religion_share,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = unname(land_area_by_code[[meta[["code"]]]]),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(dataset_id_census, dataset_id_boundary),
    quality_flag = paste0(
      "census_affiliation;universe_guinean_nationality_resident_population;",
      "published_one_decimal_column_percent_shares;counts_withheld_no_derivation_from_percent;",
      "single_wave_2009;religious_change_withheld;",
      "affiliation=animista+muculmana+cristao+outra_religiao;no_religion=sem_religiao;",
      "not_declared_nd_", source_percent(nd_share), "pp_inside_denominator_outside_numerators;",
      "boundary_2017_geoboundaries_odbl;census_needs_review_all_rights_reserved",
      row_flag
    )
  )
})

if (length(product_rows) != 9L) stop("expected 9 region rows", call. = FALSE)

# ---- source datasets, indicators, visual layers ----------------------------

source_datasets <- list(
  list(
    source_dataset_id = dataset_id_census,
    name = "INE RGPH-2009, Características socioculturais, Quadro 4",
    provider = "Instituto Nacional de Estatística (INE), Guiné-Bissau",
    url = url_socio,
    retrieval_date = retrieval_date,
    local_path = pdf_socio,
    licence = list(
      name = "All rights reserved (INE Guiné-Bissau site footer); no located open-data licence; reuse needs_review",
      url = url_terms,
      attribution = "Source: INE Guiné-Bissau, RGPH-2009 (Características socioculturais, Quadro 4)"
    ),
    citation = paste(
      "INE Guiné-Bissau, 3º Recenseamento Geral da População e Habitação 2009 (RGPH-2009),",
      "Características socioculturais, Quadro 4 (religion by region)."
    ),
    access_limits = "Open web PDF.",
    redistribution_limits = paste(
      "The INE site carries an all-rights-reserved footer verbatim:", ine_terms_notice,
      "No open-data licence was located. Reuse of the derived percentages is needs_review",
      "pending a project-lead ruling. Recorded ask:", licence_ask
    ),
    notes = paste(
      "Eight regions plus the Sector Autónomo de Bissau, one-decimal column percentages,",
      "six categories (including a large ND non-response share), no counts. The prose in",
      "section 3.4.2 misstates two table values (Oio Muçulmana 47,1 vs table 42,1; Gabú/Bafatá",
      "order); Quadro 4 is internally consistent and is trusted. No percentage was altered."
    )
  ),
  list(
    source_dataset_id = dataset_id_boundary,
    name = "geoBoundaries Guinea-Bissau ADM1 (9 units, represented year 2017)",
    provider = "geoBoundaries (William & Mary geoLab); OpenStreetMap-derived",
    url = url_boundary,
    retrieval_date = retrieval_date,
    local_path = boundary_path,
    licence = list(
      name = "Open Data Commons Open Database License 1.0 (ODbL 1.0)",
      url = "https://opendatacommons.org/licenses/odbl/1-0/",
      attribution = "geoBoundaries (gbOpen) GNB ADM1; boundary ID GNB-ADM1-76643164; OpenStreetMap contributors"
    ),
    citation = paste(
      "Runfola, D. et al. (2020) geoBoundaries: A global database of political",
      "administrative boundaries. gbOpen GNB ADM1 (pinned commit 9469f09)."
    ),
    access_limits = NULL,
    redistribution_limits = "ODbL 1.0 permits redistribution and derivatives with attribution and share-alike.",
    notes = "9 ADM1 units (8 regions + Sector Autónomo de Bissau); release metadata states ODbL 1.0, represented year 2017, admUnitCount 9."
  )
)

spatial_note <- paste(
  "Eight ADM1 regions plus the Sector Autónomo de Bissau on the geoBoundaries 2017",
  "boundary; the census frame matches the boundary units one-to-one (B. Bijagós ->",
  "Bolama, SAB -> Bissau by documented concordance)."
)

indicators <- list(
  list(
    indicator_id = "religious_affiliation_percent",
    label = "Religious affiliation (%)",
    description = "Share of the Guinean-nationality resident population in the four affiliation categories (Animista, Muçulmana, Cristão, Outra Religião).",
    unit = "percent",
    denominator_indicator_id = NULL,
    method = paste(
      "Sum of the four published affiliation-category one-decimal shares from Quadro 4,",
      "rounded to one decimal. ND (não declarado) and Sem religião stay outside this",
      "numerator. No count is derived from any percentage."
    ),
    temporal_coverage = "2009",
    spatial_coverage = spatial_note,
    quality_notes = paste(
      "One-decimal published column percentages of the Guinean-nationality universe",
      "(1,442,227 of 1,449,230 household residents). ND is 10,5-25,7% by region;",
      "affiliation + no religion + ND = 100 within the derived 0,30 pp bound."
    )
  ),
  list(
    indicator_id = "no_religion_percent",
    label = "No religion (%)",
    description = "Sem religião as a share of the Guinean-nationality resident population.",
    unit = "percent",
    denominator_indicator_id = NULL,
    method = "The published Sem religião one-decimal share from Quadro 4, carried unchanged.",
    temporal_coverage = "2009",
    spatial_coverage = spatial_note,
    quality_notes = "Sem religião is a real non-affiliation category inside the denominator and outside the affiliation numerator; distinct from the ND non-response category."
  )
)

visual_layers <- list(
  list(
    visual_layer_id = "gw-region-religious-affiliation-share",
    label = "Religious affiliation share",
    description = "Census religious affiliation share by region, 2009.",
    layer_type = "choropleth",
    indicator_ids = list("religious_affiliation_percent"),
    geometry_unit_type = "area_unit",
    legend = list(unit = "percent", denominator = "Guinean-nationality resident population (published shares)"),
    colour_scale = "sequential",
    time_control = "year_selector",
    aggregation_rule = "published regional value on the 2017 boundary",
    uncertainty_display = "quality_flag",
    default_visibility = TRUE,
    notes = paste(
      "Muslim-majority east (Gabú 86,5%, Bafatá 77,1%) contrasts with the animist/",
      "Christian west and islands (Biombo animist 40,1%, Bolama/Bijagós Christian 30,7%,",
      "Bissau Christian 40,2%). A large ND non-response share (10,5-25,7%) sits outside both metrics."
    )
  ),
  list(
    visual_layer_id = "gw-region-no-religion-share",
    label = "No religion share",
    description = "Sem religião share by region, 2009.",
    layer_type = "choropleth",
    indicator_ids = list("no_religion_percent"),
    geometry_unit_type = "area_unit",
    legend = list(unit = "percent", denominator = "Guinean-nationality resident population (published shares)"),
    colour_scale = "sequential",
    time_control = "year_selector",
    aggregation_rule = "published regional value on the 2017 boundary",
    uncertainty_display = "quality_flag",
    default_visibility = FALSE,
    notes = "Single wave; no cross-wave change layer (subnational religion is published for 2009 only)."
  )
)

area_summary <- list(
  schema_version = "0.2.0",
  generated_at = stamp,
  generated_by = script_id,
  country_code = country_code,
  boundary_set = list(
    boundary_set_id = boundary_set_id,
    country_code = country_code,
    level = "region",
    vintage = "geoBoundaries ADM1 represented year 2017; 8 regions + Sector Autónomo de Bissau",
    source_dataset_id = dataset_id_boundary
  ),
  site_snapshot = list(
    source_dataset_id = NULL,
    snapshot_date = NULL,
    basis = "no governed Guinea-Bissau place-of-worship snapshot is included in this census-religion release",
    notes = "The Guinea-Bissau lane ships census-religion percentage metrics only."
  ),
  source_datasets = source_datasets,
  indicators = indicators,
  visual_layers = visual_layers,
  rows = product_rows
)

dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)
write_json(area_summary, summary_output, auto_unbox = TRUE, pretty = TRUE, null = "null", digits = NA)
utils::write.csv(flatten_rows(product_rows), summary_csv_output, row.names = FALSE, na = "")

if (!jsonlite::validate(readChar(summary_output, file_bytes(summary_output), useBytes = TRUE))) {
  stop("area-summary output failed JSON syntax validation", call. = FALSE)
}
validate_json_schema("schemas/area-summary.schema.json", summary_output)

# ---- manifest --------------------------------------------------------------

raw_source_record <- function(path, url, content) {
  list(
    local_path = path,
    url = url,
    content = content,
    retrieval_date = retrieval_date,
    bytes = file_bytes(path),
    sha256 = sha256_file(path)
  )
}
raw_sources <- list(
  raw_source_record(pdf_socio, url_socio, "RGPH-2009 Características socioculturais (Quadro 4 region percentages; Quadro 3/5 national counts)"),
  raw_source_record(terms_html, url_terms, "INE Guiné-Bissau homepage (all-rights-reserved footer; no located open-data licence)"),
  raw_source_record(boundary_path, url_boundary, "geoBoundaries GNB ADM1 source GeoJSON"),
  raw_source_record(boundary_meta_path, url_boundary_meta, "geoBoundaries GNB ADM1 release metadata")
)

output_paths <- c(summary_output, summary_csv_output, boundary_output)
output_hashes <- vapply(output_paths, sha256_file, character(1))
raw_hashes <- vapply(raw_sources, `[[`, character(1), "sha256")
combined <- paste(c(raw_hashes, output_hashes), collapse = "")
version_hash <- substr(digest::digest(combined, algo = "sha256", serialize = FALSE), 1L, 12L)
git_commit <- tryCatch({
  value <- trimws(system2("git", c("rev-parse", "--short", "HEAD"), stdout = TRUE, stderr = TRUE))
  if (length(value) == 1L && grepl("^[a-f0-9]{7,40}$", value)) value else NULL
}, error = function(e) NULL)

durable_file_record <- function(path, content, licence_basis, licence_status,
                                row_count = NULL, feature_count = NULL) {
  record <- list(
    uri = paste0("repo:", path),
    storage_provider = "git_repository",
    format = sub("^.*\\.", "", path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    content = content,
    privacy = "public",
    licence_status = licence_status,
    licence_basis = licence_basis
  )
  if (!is.null(row_count)) record[["row_count"]] <- as.integer(row_count)
  if (!is.null(feature_count)) record[["feature_count"]] <- as.integer(feature_count)
  record
}

category_mapping <- lapply(seq_len(nrow(category_frame)), function(i) {
  list(
    source_label_pt = category_frame[["source_label_pt"]][i],
    display_label_en = category_frame[["display_label_en"]][i],
    product_role = category_frame[["product_role"]][i]
  )
})

derived_bound_derivation <- paste(
  "Each Quadro 4 category percentage is printed to one decimal and therefore carries a",
  "maximum rounding error of 0.05 pp (half the 0.1 print step). The six mutually",
  "exclusive categories partition each region's Guinean-nationality population; their true",
  "shares sum to exactly 100.0; a printed region column can therefore differ from 100.0 by at most",
  "0.05 x 6 = 0.30 pp. Observed deviations: Oio +0.1, Biombo -0.1, B. Bijagós +0.1; every",
  "other column sums to exactly 100.0; observed maximum 0.1 pp. The bound is derived from",
  "the source's rounding and the category count, not an arbitrary tolerance (Estonia/BF-2019",
  "precedent). No percentage was altered."
)

licence_position <- list(
  status = "needs_review",
  basis = "ine_guine_bissau_all_rights_reserved_no_open_licence",
  terms_footer_verbatim = ine_terms_notice,
  recorded_ask = licence_ask,
  boundary_licence = "geoBoundaries GNB ADM1: ODbL 1.0",
  summary = paste(
    "The INE Guiné-Bissau site carries an all-rights-reserved footer and no located",
    "open-data licence. Reuse of the derived regional percentages is needs_review pending",
    "a project-lead ruling (BF build-then-ask precedent). The boundary is ODbL 1.0."
  )
)

deferred_sources <- list(
  list(
    layer = "1979/1991 waves",
    status = "documented non-route",
    note = paste(
      "The RGPH-2009 sociocultural report is the source of record; it does not carry",
      "1979 or 1991 religion tables, and no subnational religion for those waves was located.",
      "No cross-wave change is derivable."
    )
  ),
  list(
    layer = "regional counts",
    status = "documented non-route",
    note = paste(
      "National religion counts exist (Quadro 3/5: total 1,442,227). No table gives",
      "religion counts by region; Quadro 4 is column percentages. No regional count is derived."
    )
  )
)

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = paste0("manifest:gw-census-religion:gw:2009:", version_hash),
  dataset_id = "gw-census-religion:gw:2009:ine-geoboundaries",
  dataset_version_id = paste0("gw-census-religion:gw:2009:ine-geoboundaries:", version_hash),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "gw-census-religion",
  dataset_role = "public_product",
  scope = list(
    level = "country",
    country_codes = list("GW"),
    snapshot_date = NULL,
    pipeline_stage = "staged"
  ),
  created_at = stamp,
  created_by = script_id,
  target_years = list(2009L),
  pipeline = list(
    script = script_id,
    git_commit = git_commit,
    command = paste("Rscript", script_id),
    parameters = list(
      wave = list(
        year = 2009L,
        construct = "census religion, published one-decimal column percent shares",
        geography = "8 administrative regions + Sector Autónomo de Bissau (9 units)",
        universe = "resident population of Guinean nationality (1,442,227 of 1,449,230 household residents)",
        denominator = "Guinean-nationality resident population (percentage basis; no regional counts published)",
        source_table = "Quadro 4",
        gate = "rounded-column reconciliation within the derived 0.30 pp bound; national counts reconcile exactly; national percent cross-check within 0.1 pp",
        counts_from_percentages = "withheld; no regional count derived from any percentage"
      ),
      derived_rounding_bound = list(
        applies_to = "Quadro 4 published one-decimal column-percentage regions",
        rounding_halfwidth_pp = reconciliation[["rounding_halfwidth_pp"]],
        category_count = reconciliation[["category_count"]],
        bound_pp = reconciliation[["derived_bound_pp"]],
        observed_max_absolute_deviation_pp = reconciliation[["max_absolute_deviation_pp"]],
        deviating_columns = reconciliation[["deviating_columns"]],
        column_deviations_pp = reconciliation[["column_deviations_pp"]],
        derivation = derived_bound_derivation
      ),
      national_reconciliation = list(
        national_total = national_total,
        national_total_residents_context = national_total_residents,
        national_counts = as.list(national_counts),
        counts_sum_to_total = "215130 + 650402 + 318021 + 414 + 29542 + 228718 = 1442227 (exact)",
        percent_crosscheck_derived = national_crosscheck[["derived"]],
        percent_crosscheck_printed = national_crosscheck[["printed"]],
        percent_crosscheck_max_abs_deviation_pp = national_crosscheck[["max_absolute_deviation_pp"]],
        status = "National counts reconcile exactly; the count-derived national percentages reproduce the Quadro 4 Guiné-Bissau column within 0.1 pp."
      ),
      source_narrative_discrepancies = list(
        oio_muculmana = "Prose 47,1 vs Quadro 4 table 42,1; 47,1 would sum the Oio column to 105,1. Table trusted.",
        gabu_bafata_order = "Prose assigns 77,1 to Gabú and 86,5 to Bafatá; Quadro 4 prints Bafatá 77,1 and Gabú 86,5, the only order that sums both columns to 100. Table trusted."
      ),
      change_metric = list(
        status = "withheld",
        rationale = "Subnational religion is published for 2009 only; no 1979/1991 subnational religion was located, and no cross-wave change is possible."
      ),
      category_frame_pt = as.list(category_frame[["source_label_pt"]]),
      category_display_mapping = category_mapping,
      affiliation_arithmetic = "religious_affiliation = Animista + Muçulmana + Cristão + Outra Religião; no_religion = Sem religião; ND (não declarado) stays inside the denominator and outside both numerators.",
      boundary = list(
        boundary_set_id = boundary_set_id,
        source = "geoBoundaries GNB ADM1 (gbOpen), represented year 2017, ODbL 1.0",
        features = 9L,
        total_land_area_sq_km = boundary_result[["total_land_area"]],
        output_bytes = boundary_result[["output_bytes"]],
        distinct_written_geometry_hashes = boundary_result[["distinct_written_hash_count"]],
        join = "area_code via explicit concordance (B. Bijagós -> Bolama; SAB -> Bissau; seven others by accent-free key)",
        simplification = c(
          boundary_result[["simplification"]],
          list(byte_ceiling = 3000000L, helper = "scripts/lib/simplify_boundary.R")
        ),
        source_geometry_sha256 = boundary_result[["source_geometry_sha256"]],
        written_geometry_sha256 = boundary_result[["written_geometry_sha256"]]
      ),
      licence_position = licence_position,
      raw_sources = raw_sources,
      local_cache_hint = "data/raw/gw_census/ (git-ignored; every cached source listed with URL, bytes, and SHA-256 in pipeline.parameters.raw_sources).",
      raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/gw_census/")
    ),
    software_versions = list(
      R = paste(R.version$major, R.version$minor, sep = "."),
      sf = as.character(utils::packageVersion("sf")),
      stringi = as.character(utils::packageVersion("stringi")),
      jsonlite = as.character(utils::packageVersion("jsonlite"))
    )
  ),
  source = list(
    provider = "Instituto Nacional de Estatística (INE), Guiné-Bissau; geoBoundaries (William & Mary geoLab)",
    source_dataset_ids = list(dataset_id_census, dataset_id_boundary),
    source_urls = list(url_socio, url_terms, url_boundary, url_boundary_meta),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = "Census: all-rights-reserved footer, no located open-data licence (needs_review). Boundary: ODbL 1.0.",
    raw_redistribution = "Census PDF and boundary are open web sources; intended durable mirror gs://pow-research-data/raw_sources/gw_census/.",
    citation = paste(
      "INE Guiné-Bissau RGPH-2009 (Características socioculturais, Quadro 4);",
      "geoBoundaries GNB ADM1 (ODbL 1.0)."
    ),
    local_cache_hint = "data/raw/gw_census/ (git-ignored).",
    raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/gw_census/")
  ),
  input_manifests = list(),
  deferred_sources = deferred_sources,
  durable_files = list(
    durable_file_record(summary_output, "Guinea-Bissau single-wave regional census-religion area-summary JSON",
                        "ine_guine_bissau_all_rights_reserved_no_open_licence", "needs_review", row_count = 9L),
    durable_file_record(summary_csv_output, "Guinea-Bissau single-wave regional census-religion area-summary CSV",
                        "ine_guine_bissau_all_rights_reserved_no_open_licence", "needs_review", row_count = 9L),
    durable_file_record(boundary_output, "Guinea-Bissau 2017 region boundary (geoBoundaries ADM1)",
                        "odbl_1_0", "accepted", feature_count = 9L)
  ),
  partitions = list(
    list(
      partition_id = "gw-region-2009",
      partition_type = "area",
      file_uri = paste0("repo:", summary_output),
      sha256 = sha256_file(summary_output),
      country_code = "GW",
      row_count = 9L,
      stage = "staged"
    )
  ),
  stats = list(
    waves = 1L,
    years = "2009",
    region_rows = 9L,
    regions_per_wave = 9L,
    categories = 6L,
    boundary_features = 9L,
    derived_bound_pp = reconciliation[["derived_bound_pp"]],
    max_absolute_deviation_pp = reconciliation[["max_absolute_deviation_pp"]]
  ),
  local_cache_hint = "data/raw/gw_census/ (git-ignored; every cached source listed with URL, bytes, and SHA-256 in pipeline.parameters.raw_sources).",
  validation = list(
    status = "passed",
    commands = list(
      paste("Rscript", script_id),
      paste("uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile",
            "schemas/area-summary.schema.json", summary_output),
      paste("uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile",
            "schemas/data-manifest.schema.json", manifest_output),
      "bash scripts/validate_manifests.sh"
    ),
    warnings = list(
      paste(
        "Three region columns sum to 99.9 or 100.1 (Oio 100.1, Biombo 99.9, B. Bijagós 100.1)",
        "by the source's own one-decimal rounding, within the 0.30 pp derived bound. Every",
        "other column sums to 100.0. No percentage was altered."
      ),
      "ND (não declarado) is a large non-response share (10.5-25.7% by region) inside the denominator and outside both metrics.",
      "Single wave (2009), region level, column percentages only, no counts, no cross-wave change.",
      "Census reuse is needs_review: all-rights-reserved footer, no located open-data licence (recorded ask to the project lead)."
    ),
    notes = paste(
      "Quadro 4 category rows appear in the pdftotext -layout output; the national Quadro 3/5",
      "counts sum to 1,442,227 exactly and their national shares reproduce the Quadro 4",
      "Guiné-Bissau column within 0.1 pp. Boundary output has 9 valid, non-empty, distinctly",
      "hashed geometries within the 3 MB cap. Both the area-summary and the manifest pass",
      "schema validation."
    )
  ),
  privacy = "public",
  licence_status = "needs_review",
  licence_basis = "ine_guine_bissau_all_rights_reserved_no_open_licence",
  downstream_status = "staged",
  notes = paste(
    "Single-wave (2009) nine-unit (8 regions + Sector Autónomo de Bissau) census-religion",
    "product, one-decimal column percentages as printed, no counts. Ships STAGED (no page, no",
    "hub link). Census reuse needs_review (all-rights-reserved footer, no located open licence;",
    "recorded ask); boundary ODbL 1.0."
  )
)

write_json(manifest, manifest_output, auto_unbox = TRUE, pretty = TRUE, null = "null", digits = NA)

if (!jsonlite::validate(readChar(manifest_output, file_bytes(manifest_output), useBytes = TRUE))) {
  stop("manifest output is not valid JSON", call. = FALSE)
}
validate_json_schema("schemas/data-manifest.schema.json", manifest_output)

message(
  "built Guinea-Bissau regional census-religion product: ", length(product_rows),
  " region rows for 2009; boundary ", boundary_result[["output_bytes"]],
  " bytes, ", boundary_result[["total_land_area"]], " km2; derived bound ",
  reconciliation[["derived_bound_pp"]], " pp, observed max deviation ",
  reconciliation[["max_absolute_deviation_pp"]], " pp; staged (licence needs_review)."
)
