# build the Guinea 2014 census-religion regional product from the INS RGPH-3 PDF.
#
# inputs: the cached INS RGPH-3 "État et structure de la population" thematic
# report (Table 5.10 region percentages, plus Tables 5.09/5.11 for the national
# reconciliation and 1996 context) and the geoBoundaries GIN ADM1 boundary; all
# under git-ignored data/raw/gn_census/.
# outputs: apps/regions/gn/data/area_summary_region.{json,csv},
# apps/regions/gn/data/gn_region_2014.geojson, and the tracked data manifest
# docs/manifests/gn-census-religion-2014.json.
# run from the repo root: Rscript scripts/build_gn_area_summary.R
#
# product scope. eight administrative regions, one wave (2014). the source
# publishes one-decimal percentages with NO counts, so the product ships
# percentages exactly as printed and derives no counts (conductor ruling
# 2026-07-11; the probe's rounding-slack analysis stands, and the BF-2019
# derived-bound treatment covers percent arithmetic). religious_affiliation is
# the sum of the four affiliation categories (Musulmane, Chrétienne, Animiste,
# Autre religion); no_religion is the printed Sans religion share. Sans religion
# is a real non-affiliation slot, so ordinary slot semantics apply (this is not
# a flat-frame product).
#
# gate design. the source prints one-decimal percentages, so a row's five cells
# carry a maximum rounding error of 0.05 pp each; with five mutually exclusive
# categories the printed row sum may deviate from 100.0 by at most 0.05 * 5 =
# 0.25 pp (BF-2019/Estonia derived-bound precedent, never an arbitrary
# tolerance). FINDING: the source's Faranah row prints 0,8 / 89,1 / 9,7 / 0,1 /
# 0,2, which sum to 99,9 (deviation 0.1 pp, within the 0.25 bound) against the
# printed Ensemble 100,0. every other printed row sums to exactly 100.0. this
# contradicts the task's stated expectation that every row sums to exactly
# 100.0; the deviation is a genuine source rounding artefact, is not tuned, and
# is disclosed here and in the manifest. the exact-100.0 assumption is therefore
# replaced by the derived-bound gate. two further hard gates: the transcribed
# Table 5.10 rows must appear verbatim in the pdftotext -layout output, and the
# Ensemble row must equal the independently transcribed Table 5.09 Total column
# and Table 5.11 2014 Ensemble row.
#
# licence. the INS routes reuse of its published Données to the "Accord de
# licence de données ouvertes" (byte-matched from the rendered hdemdob portal
# page, CC BY 4.0), and the INS website terms extend that Accord to
# website-published Données, which includes the thematic-report tables
# (conductor ruling 2026-07-11). licence_status is accepted; both required
# French attribution notices ride verbatim in the manifest. the geoBoundaries
# GIN ADM1 boundary is CC BY 3.0 IGO. the product ships STAGED pending the
# project lead's reaction to the conductor's view.

suppressPackageStartupMessages({
  library(jsonlite)
  library(sf)
  library(stringi)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "GN"
script_id <- "scripts/build_gn_area_summary.R"
raw_dir <- "data/raw/gn_census"
output_dir <- "apps/regions/gn/data"
manifest_dir <- "docs/manifests"

retrieval_date <- "2026-07-11"
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")

# ---- cached inputs and pinned source URLs ---------------------------------

pdf_etat <- file.path(raw_dir, "RGPH3_etat_structure.pdf")
pdf_menages <- file.path(raw_dir, "RGPH3_caracteristiques_des_menages.pdf")
licence_capture <- file.path(raw_dir, "hdemdob_accord_licence_ouverte.txt")
conditions_html <- file.path(raw_dir, "conditions_generales.html")
boundary_path <- file.path(raw_dir, "geoBoundaries-GIN-ADM1.geojson")
boundary_meta_path <- file.path(raw_dir, "gb_gin_adm1_meta.json")

url_etat <- "https://www.stat-guinee.org/images/Documents/Publications/INS/rapports_enquetes/RGPH3/RGPH3_etat_structure.pdf"
url_menages <- "https://www.stat-guinee.org/images/Documents/Publications/INS/rapports_enquetes/RGPH3/RGPH3_caracteristiques_des_menages.pdf"
url_licence <- "https://guinea.opendataforafrica.org/hdemdob"
url_conditions <- "https://www.stat-guinee.org/index.php/autres-publications-ssn/2-uncategorised/414-mention-legales"
url_boundary <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/GIN/ADM1/geoBoundaries-GIN-ADM1.geojson"
url_boundary_meta <- "https://www.geoboundaries.org/api/current/gbOpen/GIN/ADM1/"

boundary_set_id <- "gn-region-2014-geoboundaries-adm1"
boundary_output <- file.path(output_dir, "gn_region_2014.geojson")
summary_output <- file.path(output_dir, "area_summary_region.json")
summary_csv_output <- file.path(output_dir, "area_summary_region.csv")
manifest_output <- file.path(manifest_dir, "gn-census-religion-2014.json")

dataset_id_census <- "ins-rgph3-2014-etat-structure-table-5-10"
dataset_id_boundary <- "geoboundaries-gin-adm1-2017"

# ---- verbatim licence strings (byte-matched from the cached capture) -------
# the two required attribution notices and the operative grant clauses,
# reproduced exactly as captured in data/raw/gn_census/hdemdob_accord_licence_ouverte.txt.

licence_grant_cc_by_4_0 <- paste0(
  "Toutes les données et jeux de données publiés par la GUINEE sur ce portail de ",
  "données accessibles mis à disposition par la Banque Africaine de Développement ",
  "sont fournis sous la licence internationale Creative Commons Attribution 4.0 (CC-BY 4.0)."
)
licence_octroi <- paste0(
  "L'INS vous accorde (à vous, personne physique ou entité juridique que vous êtes ",
  "autorisé à représenter) une licence mondiale, gratuite et non exclusive vous ",
  "permettant d'utiliser librement les données, de les copier, modifier, traduire, ",
  "publier, adapter, distribuer, de créer des œuvres dérivées et des produits à ",
  "valeur ajoutée à des fins commerciales et non commerciales, sous réserve des ",
  "conditions de la présente licence."
)
# REQUIRED attribution notice 1 (Mention de la source).
attribution_source_notice <- paste0(
  "Source : INS. Contient des informations sous licence conformément à l'Accord de ",
  "licence de données ouvertes de l'INS."
)
# REQUIRED attribution notice 2 (Produits à valeur ajoutée). the doubled "de de"
# is present in the source capture and is preserved verbatim.
attribution_value_added_notice <- paste0(
  "Ce produit a été adapté à partir des informations de de l'Institut National de ",
  "Statistique, qui sont sous licence conformément à l'Accord de licence de données ",
  "ouvertes de l'INS."
)
licence_limitation <- paste0(
  "La licence accordée ici se limite exclusivement aux données de la Guinée publiées ",
  "sur cette plateforme de données ouvertes et ne s'étend pas aux données, logiciels ",
  "et codes sources de tiers."
)
ins_terms_extension_note <- paste0(
  "The INS website terms (data/raw/gn_census/conditions_generales.html) route reuse of ",
  "\"les Données publiées par l'Institut national de la statistique, y compris les Données ",
  "mises à disposition sur ce site web et sur https://guinea.opendataforafrica.org\" to this ",
  "Accord, extending the CC BY 4.0 grant to the website-published Données, which includes the ",
  "thematic-report tables transcribed here (conductor ruling 2026-07-11)."
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

# collapse extracted lines to one whitespace-normalised string for row-presence
# assertions, without changing any digit.
normalise_source_text <- function(lines) {
  text <- paste(lines, collapse = "\n")
  text <- gsub("[[:space:]]+", " ", text)
  trimws(text)
}

# format a one-decimal source percentage with a decimal comma (0.8 -> "0,8").
source_percent <- function(value) sub(".", ",", sprintf("%.1f", value), fixed = TRUE)

# reduce a region name to an accent-free alphanumeric join key, so the census
# spelling ("Boké", "N'Zérékoré") and the ASCII geoBoundaries spelling ("Boke",
# "Nzerekore") map to the same stable area code.
normalise_region_key <- function(x) {
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

# ---- Table 5.10 (the shipped subnational table) ----------------------------
# verbatim from the cached PDF, page 88; percentages as printed, decimal comma
# rendered here as a decimal point. the apostrophe in "N'Zérékoré" is the
# straight apostrophe used in Table 5.10 (watched per the probe).

table_5_10 <- function() {
  data.frame(
    source_name = c(
      "Boké", "Conakry", "Faranah", "Kankan", "Kindia", "Labé", "Mamou",
      "N'Zérékoré", "Ensemble"
    ),
    sans_religion = c(0.3, 0.3, 0.8, 0.2, 0.5, 0.2, 0.1, 14.2, 2.4),
    musulmane = c(96.8, 94.8, 89.1, 98.7, 97.2, 99.4, 99.4, 46.7, 89.1),
    chretienne = c(2.8, 4.8, 9.7, 1.1, 2.3, 0.4, 0.5, 28.1, 6.8),
    animiste = c(0.1, 0.0, 0.1, 0.0, 0.0, 0.0, 0.0, 10.4, 1.6),
    autres_religions = c(0.0, 0.1, 0.2, 0.0, 0.0, 0.0, 0.0, 0.6, 0.1),
    ensemble = c(100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0, 100.0),
    stringsAsFactors = FALSE
  )
}

# the 2014 national frame, transcribed independently from Table 5.09 (Total
# column) and Table 5.11 (2014 Ensemble row) for the Ensemble reconciliation gate.
national_5_09_total <- c(sans_religion = 2.4, musulmane = 89.1, chretienne = 6.8, animiste = 1.6, autres_religions = 0.1)
national_5_11_2014_ensemble <- c(sans_religion = 2.4, musulmane = 89.1, chretienne = 6.8, animiste = 1.6, autres_religions = 0.1)

category_keys <- c("sans_religion", "musulmane", "chretienne", "animiste", "autres_religions")

# verbatim French categories with the probe's English display mapping.
category_frame <- data.frame(
  key = category_keys,
  source_label_fr = c("Sans religion", "Musulmane", "Chrétienne", "Animiste", "Autre religion"),
  display_label_en = c("No religion", "Muslim", "Christian", "Animist", "Other religion"),
  product_role = c("no_religion", "religious_affiliation", "religious_affiliation",
                   "religious_affiliation", "religious_affiliation"),
  stringsAsFactors = FALSE
)
affiliation_categories <- category_frame[["key"]][category_frame[["product_role"]] == "religious_affiliation"]
no_religion_categories <- category_frame[["key"]][category_frame[["product_role"]] == "no_religion"]

# stable region codes shared by the census display name and the boundary.
region_codes <- c(
  "Boké" = "boke", "Conakry" = "conakry", "Faranah" = "faranah", "Kankan" = "kankan",
  "Kindia" = "kindia", "Labé" = "labe", "Mamou" = "mamou", "N'Zérékoré" = "nzerekore"
)

# ---- gates -----------------------------------------------------------------

# require the cached PDF text to contain every transcribed Table 5.10 row, with
# its five percentage cells in printed order and the printed Ensemble total.
assert_transcription_present <- function(source_text, rows) {
  value_columns <- c(category_keys, "ensemble")
  for (i in seq_len(nrow(rows))) {
    pieces <- c(
      rows[["source_name"]][i],
      vapply(rows[i, value_columns], source_percent, character(1))
    )
    pattern <- paste(vapply(pieces, function(x) {
      gsub(" ", "[[:space:]]+", x, fixed = TRUE)
    }, character(1)), collapse = "[[:space:]]+")
    if (!grepl(pattern, source_text, perl = TRUE)) {
      stop("transcribed Table 5.10 row not found in pdftotext output: ",
           rows[["source_name"]][i], call. = FALSE)
    }
  }
  invisible(TRUE)
}

# stop unless every printed row's five category cells sum to its printed total
# within the derived one-decimal rounding bound (0.05 pp per cell * 5 categories
# = 0.25 pp). returns the reconciliation record for the manifest. no percentage
# is altered.
assert_rounded_row_reconciliation <- function(rows, rounding_halfwidth = 0.05) {
  k <- length(category_keys)
  bound <- rounding_halfwidth * k
  calculated <- rowSums(rows[, category_keys, drop = FALSE])
  difference <- round(calculated - rows[["ensemble"]], 6)
  exceeded <- which(abs(difference) > bound + 1e-9)
  if (length(exceeded) > 0L) {
    details <- paste0(
      rows[["source_name"]][exceeded], " (cell sum=", sprintf("%.1f", calculated[exceeded]),
      ", printed total=", sprintf("%.1f", rows[["ensemble"]][exceeded]),
      ", |difference|=", sprintf("%.1f", abs(difference[exceeded])),
      " > derived bound=", sprintf("%.2f", bound), ")"
    )
    stop("Table 5.10 rounded-row reconciliation exceeded the derived bound: ",
         paste(details, collapse = "; "),
         ". no percentage was altered; product writing stopped.", call. = FALSE)
  }
  deviating <- rows[["source_name"]][abs(difference) > 1e-9]
  list(
    category_count = k,
    rounding_halfwidth_pp = rounding_halfwidth,
    derived_bound_pp = bound,
    max_absolute_deviation_pp = as.numeric(max(abs(difference))),
    deviating_rows = as.list(deviating),
    row_deviations_pp = setNames(as.list(round(difference, 1) + 0), rows[["source_name"]])
  )
}

# stop unless the Table 5.10 Ensemble row equals the independently transcribed
# Table 5.09 Total column and Table 5.11 2014 Ensemble row.
assert_ensemble_reconciliation <- function(rows) {
  ensemble <- unlist(rows[rows[["source_name"]] == "Ensemble", category_keys], use.names = TRUE)
  if (!isTRUE(all.equal(ensemble[category_keys], national_5_09_total[category_keys], tolerance = 0))) {
    stop("Table 5.10 Ensemble row does not equal the Table 5.09 Total column", call. = FALSE)
  }
  if (!isTRUE(all.equal(ensemble[category_keys], national_5_11_2014_ensemble[category_keys], tolerance = 0))) {
    stop("Table 5.10 Ensemble row does not equal the Table 5.11 2014 Ensemble row", call. = FALSE)
  }
  invisible(TRUE)
}

# require both national reconciliation vectors to appear verbatim in the source
# text, so the constants above are anchored to the cached PDF.
assert_national_rows_present <- function(source_text) {
  ensemble_cells <- vapply(national_5_09_total[category_keys], source_percent, character(1))
  pattern <- paste(ensemble_cells, collapse = "[[:space:]]+")
  if (!grepl(pattern, source_text, perl = TRUE)) {
    stop("national 2014 frame (2,4 89,1 6,8 1,6 0,1) not found in source text", call. = FALSE)
  }
  invisible(TRUE)
}

# require both mandatory French attribution notices to appear verbatim in the
# cached licence capture, anchoring the manifest strings to the byte-matched file.
assert_licence_notices_present <- function() {
  capture <- paste(readLines(licence_capture, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  for (notice in c(attribution_source_notice, attribution_value_added_notice)) {
    if (!grepl(notice, capture, fixed = TRUE)) {
      stop("required attribution notice not byte-present in the licence capture: ", notice, call. = FALSE)
    }
  }
  invisible(TRUE)
}

# ---- boundary --------------------------------------------------------------
# validate and simplify the 8-feature geoBoundaries GIN ADM1 layer; return the
# written layer, geodesic land areas by area code, and geometry-validation detail.
build_boundary <- function() {
  boundary <- st_read(boundary_path, quiet = TRUE, stringsAsFactors = FALSE)
  if (nrow(boundary) != 8L) stop("expected 8 geoBoundaries GIN ADM1 features", call. = FALSE)
  boundary <- st_make_valid(boundary)
  validity <- st_is_valid(boundary)
  if (any(st_is_empty(boundary)) || any(is.na(validity)) || any(!validity)) {
    stop("source boundary contains empty or invalid geometries", call. = FALSE)
  }
  source_hashes <- vapply(st_as_binary(st_geometry(boundary), EWKB = TRUE), digest::digest,
                          character(1), algo = "sha256", serialize = FALSE)
  if (anyDuplicated(source_hashes)) stop("source boundary contains duplicate geometries", call. = FALSE)

  # join Table 5.10 region names to the ADM1 features by accent-free key.
  boundary_key <- vapply(boundary[["shapeName"]], normalise_region_key, character(1))
  census_key <- vapply(names(region_codes), normalise_region_key, character(1))
  if (!setequal(boundary_key, census_key)) {
    stop("census and boundary region names do not match 1:1 after normalisation", call. = FALSE)
  }
  code_by_key <- setNames(unname(region_codes), census_key)
  name_by_key <- setNames(names(region_codes), census_key)
  boundary[["area_code"]] <- unname(code_by_key[boundary_key])
  boundary[["area_name"]] <- unname(name_by_key[boundary_key])
  boundary[["area_unit_id"]] <- paste0(boundary_set_id, ":", boundary[["area_code"]])
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- "region"
  boundary[["boundary_vintage"]] <- "2017"
  boundary[["boundary_source"]] <- "geoBoundaries GIN ADM1; source World Food Programme, OCHA ROWCA"
  boundary[["boundary_licence"]] <- "CC BY 3.0 IGO"
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
  if (nrow(written) != 8L || any(st_is_empty(written)) || any(!written_validity) ||
      anyDuplicated(written_hashes) || file.info(boundary_output)[["size"]] > 3000000L) {
    stop("simplified boundary failed feature, validity, distinctness, or byte-cap gate", call. = FALSE)
  }
  # s2 geodesic area on the geographic crs; appropriate for a west-african extent.
  land_area <- as.numeric(st_area(written)) / 1e6
  land_area_by_code <- setNames(round(land_area, 4), written[["area_code"]])
  # sanity band: guinea is about 245,860 km2; catch a crs or unit mistake.
  if (sum(land_area) < 210000 || sum(land_area) > 280000) {
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

for (path in c(pdf_etat, licence_capture, conditions_html, boundary_path, boundary_meta_path)) {
  require_file(path)
}

rows_5_10 <- table_5_10()
source_text <- normalise_source_text(pdf_layout_lines(pdf_etat))

assert_transcription_present(source_text, rows_5_10)
assert_national_rows_present(source_text)
assert_ensemble_reconciliation(rows_5_10)
reconciliation <- assert_rounded_row_reconciliation(rows_5_10)
assert_licence_notices_present()

boundary_result <- build_boundary()
land_area_by_code <- boundary_result[["land_area_by_code"]]

# ---- construct product rows ------------------------------------------------
# eight region rows, one wave. percentages as printed; no counts. affiliation is
# the sum of the four affiliation-category shares (rounded to one decimal, as the
# BF-2019 sibling carries published percentage sums); no_religion is the printed
# Sans religion share.

population_basis_note <- paste(
  "INS RGPH-3 2014, État et structure de la population, Table 5.10: resident",
  "population by administrative region. The source publishes one-decimal",
  "percentage shares only, with no counts, so population_total and all counts",
  "are null; percentages are shipped as printed. Region resident totals exist in",
  "Table 2.09 but are not multiplied into the shares (no derived-count layer)."
)

rows_region <- rows_5_10[rows_5_10[["source_name"]] != "Ensemble", , drop = FALSE]

product_rows <- lapply(seq_len(nrow(rows_region)), function(i) {
  region <- rows_region[i, , drop = FALSE]
  key <- normalise_region_key(region[["source_name"]])
  code <- unname(region_codes[[region[["source_name"]]]])
  affiliation_share <- round(sum(region[, affiliation_categories]), 1)
  no_religion_share <- round(sum(region[, no_religion_categories]), 1)
  row_sum <- round(sum(region[, category_keys]), 1)
  row_flag <- if (abs(row_sum - 100.0) > 1e-9) {
    paste0(";source_row_sums_to_", source_percent(row_sum),
           "_within_derived_rounding_bound_0.25pp")
  } else ""
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = "region",
    area_unit_id = paste0(boundary_set_id, ":", code),
    area_code = code,
    area_name = region[["source_name"]],
    year = 2014L,
    population_total = NULL,
    population_total_basis = population_basis_note,
    religious_affiliation_count = NULL,
    religious_affiliation_percent = affiliation_share,
    no_religion_count = NULL,
    no_religion_percent = no_religion_share,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = unname(land_area_by_code[[code]]),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(dataset_id_census, dataset_id_boundary),
    quality_flag = paste0(
      "census_affiliation;denominator_resident_population;",
      "published_one_decimal_percent_shares;counts_withheld_no_derivation_from_percent;",
      "single_wave_2014;religious_change_withheld;",
      "affiliation=musulmane+chretienne+animiste+autre_religion;no_religion=sans_religion;",
      "boundary_2017_geoboundaries_cc_by_3_0_igo;census_cc_by_4_0_ins_accord",
      row_flag
    )
  )
})

if (length(product_rows) != 8L) stop("expected 8 region rows", call. = FALSE)

# ---- source datasets, indicators, visual layers ----------------------------

source_datasets <- list(
  list(
    source_dataset_id = dataset_id_census,
    name = "INS RGPH-3 2014, État et structure de la population, Table 5.10",
    provider = "Institut National de la Statistique (INS), Guinée",
    url = url_etat,
    retrieval_date = retrieval_date,
    local_path = pdf_etat,
    licence = list(
      name = "Creative Commons Attribution 4.0 International (CC BY 4.0), via the INS Accord de licence de données ouvertes",
      url = "https://creativecommons.org/licenses/by/4.0/",
      attribution = attribution_source_notice
    ),
    citation = paste(
      "INS, Recensement Général de la Population et de l'Habitation 2014 (RGPH-3),",
      "État et structure de la population, Table 5.10 (religion by administrative region)."
    ),
    access_limits = "Open web PDF.",
    redistribution_limits = paste(
      "CC BY 4.0 via the INS Accord de licence de données ouvertes permits redistribution",
      "and derivatives with attribution.", ins_terms_extension_note
    ),
    notes = paste(
      "Eight administrative regions, one-decimal percentages, five categories, no counts.",
      "The Faranah row's five cells sum to 99.9 by the source's own rounding (within the",
      "0.25 pp derived bound); no percentage was altered."
    )
  ),
  list(
    source_dataset_id = dataset_id_boundary,
    name = "geoBoundaries Guinea ADM1 (8 regions, represented year 2017)",
    provider = "geoBoundaries (William & Mary geoLab); underlying source World Food Programme, OCHA ROWCA",
    url = url_boundary,
    retrieval_date = retrieval_date,
    local_path = boundary_path,
    licence = list(
      name = "Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO)",
      url = "https://creativecommons.org/licenses/by/3.0/igo/",
      attribution = "geoBoundaries (gbOpen) GIN ADM1; boundary ID GIN-ADM1-385441; source WFP/OCHA ROWCA"
    ),
    citation = paste(
      "Runfola, D. et al. (2020) geoBoundaries: A global database of political",
      "administrative boundaries. gbOpen GIN ADM1 (pinned commit 9469f09)."
    ),
    access_limits = NULL,
    redistribution_limits = "CC BY 3.0 IGO permits redistribution and derivatives with attribution.",
    notes = "8 ADM1 regions; release metadata states CC BY 3.0 IGO, represented year 2017, admUnitCount 8."
  )
)

spatial_note <- paste(
  "Eight ADM1 regions on the geoBoundaries 2017 boundary; the census region frame is",
  "stable across the 1983/1996/2014 vintages, so the region layer needs no concordance."
)

indicators <- list(
  list(
    indicator_id = "religious_affiliation_percent",
    label = "Religious affiliation (%)",
    description = "Share of the resident population in the four affiliation categories (Musulmane, Chrétienne, Animiste, Autre religion).",
    unit = "percent",
    denominator_indicator_id = NULL,
    method = paste(
      "Sum of the four published affiliation-category one-decimal shares from Table 5.10,",
      "rounded to one decimal. No count is derived from any percentage."
    ),
    temporal_coverage = "2014",
    spatial_coverage = spatial_note,
    quality_notes = paste(
      "One-decimal published shares. The Faranah row's five categories sum to 99.9 by the",
      "source's rounding, so its affiliation (99.1) plus no-religion (0.8) sum to 99.9,",
      "within the 0.25 pp derived bound."
    )
  ),
  list(
    indicator_id = "no_religion_percent",
    label = "No religion (%)",
    description = "Sans religion as a share of the resident population.",
    unit = "percent",
    denominator_indicator_id = NULL,
    method = "The published Sans religion one-decimal share from Table 5.10, carried unchanged.",
    temporal_coverage = "2014",
    spatial_coverage = spatial_note,
    quality_notes = "Sans religion is a real non-affiliation category inside the denominator and outside the affiliation numerator."
  )
)

visual_layers <- list(
  list(
    visual_layer_id = "gn-region-religious-affiliation-share",
    label = "Religious affiliation share",
    description = "Census religious affiliation share by region, 2014.",
    layer_type = "choropleth",
    indicator_ids = list("religious_affiliation_percent"),
    geometry_unit_type = "area_unit",
    legend = list(unit = "percent", denominator = "resident population (published shares)"),
    colour_scale = "sequential",
    time_control = "year_selector",
    aggregation_rule = "published regional value on the 2017 boundary",
    uncertainty_display = "quality_flag",
    default_visibility = TRUE,
    notes = paste(
      "N'Zérékoré (46.7% Muslim, 28.1% Christian, 10.4% Animist, 14.2% no religion) is the",
      "map-worthy contrast against the near-uniform 89-99% Muslim north."
    )
  ),
  list(
    visual_layer_id = "gn-region-no-religion-share",
    label = "No religion share",
    description = "Sans religion share by region, 2014.",
    layer_type = "choropleth",
    indicator_ids = list("no_religion_percent"),
    geometry_unit_type = "area_unit",
    legend = list(unit = "percent", denominator = "resident population (published shares)"),
    colour_scale = "sequential",
    time_control = "year_selector",
    aggregation_rule = "published regional value on the 2017 boundary",
    uncertainty_display = "quality_flag",
    default_visibility = FALSE,
    notes = "Single wave; no cross-wave change layer (subnational religion is published for 2014 only)."
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
    vintage = "geoBoundaries ADM1 represented year 2017; the census region frame is stable across 1983/1996/2014",
    source_dataset_id = dataset_id_boundary
  ),
  site_snapshot = list(
    source_dataset_id = NULL,
    snapshot_date = NULL,
    basis = "no governed Guinea place-of-worship snapshot is included in this census-religion release",
    notes = "The Guinea lane ships census-religion percentage metrics only."
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
  raw_source_record(pdf_etat, url_etat, "RGPH-3 État et structure (Table 5.10 region percentages; Tables 5.09/5.11 national)"),
  raw_source_record(pdf_menages, url_menages, "RGPH-3 Caractéristiques des ménages (checked; no religion table; negative control)"),
  raw_source_record(licence_capture, url_licence, "INS Accord de licence de données ouvertes capture (CC BY 4.0; both required attribution notices)"),
  raw_source_record(conditions_html, url_conditions, "INS website terms (routes website Données to the Accord)"),
  raw_source_record(boundary_path, url_boundary, "geoBoundaries GIN ADM1 source GeoJSON"),
  raw_source_record(boundary_meta_path, url_boundary_meta, "geoBoundaries GIN ADM1 release metadata")
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
    source_label_fr = category_frame[["source_label_fr"]][i],
    display_label_en = category_frame[["display_label_en"]][i],
    product_role = category_frame[["product_role"]][i]
  )
})

derived_bound_derivation <- paste(
  "Each Table 5.10 category percentage is printed to one decimal and therefore carries a",
  "maximum rounding error of 0.05 pp (half the 0.1 print step). The five mutually",
  "exclusive categories partition the resident population; their true shares sum to",
  "exactly 100.0, so the printed row sum can differ from 100.0 by at most 0.05 x 5 =",
  "0.25 pp. FINDING: the Faranah row (0,8 / 89,1 / 9,7 / 0,1 / 0,2) sums to 99,9,",
  "deviating by 0.1 pp against the printed Ensemble 100,0; every other printed row sums",
  "to exactly 100.0. This contradicts the task's stated expectation that every row sums",
  "to exactly 100.0; the deviation is a genuine source rounding artefact, is within the",
  "0.25 pp bound, and no percentage was altered. The bound is derived from the source's",
  "rounding and the category count, not an arbitrary tolerance (Estonia/BF-2019 precedent)."
)

licence_position <- list(
  status = "accepted",
  basis = "ins_accord_de_licence_ouverte_cc_by_4_0",
  grant_cc_by_4_0_verbatim = licence_grant_cc_by_4_0,
  octroi_verbatim = licence_octroi,
  attribution_source_notice_verbatim = attribution_source_notice,
  attribution_value_added_notice_verbatim = attribution_value_added_notice,
  limitation_verbatim = licence_limitation,
  ins_terms_extension = ins_terms_extension_note,
  boundary_licence = "geoBoundaries GIN ADM1: CC BY 3.0 IGO",
  summary = paste(
    "INS routes reuse of its published Données to the Accord de licence de données ouvertes",
    "(CC BY 4.0), byte-matched from the rendered hdemdob portal page; the INS website terms",
    "extend that Accord to website-published Données, which includes the thematic-report",
    "tables. Conductor ruling 2026-07-11: licence accepted, both required French attribution",
    "notices carried verbatim. Boundary is CC BY 3.0 IGO."
  )
)

deferred_sources <- list(
  list(
    wave = 1996L,
    status = "documented non-route",
    published_geography = "national by residence only (Table 5.11, retrospective in the 2014 report)",
    note = paste(
      "The 1996 national row (Ensemble: Sans religion 4,1; Musulmane 86,8; Chrétienne 6,7;",
      "Animiste 2,0; Autres 0,4; Total 100) may ride as recorded context, never as a wave.",
      "No published subnational 1996 religion table exists; subnational figures survive only",
      "in the barred IPUMS microdata."
    )
  ),
  list(
    wave = 1983L,
    status = "documented non-route",
    published_geography = "none published",
    note = paste(
      "No INS-published national or subnational 1983 religion table was located. Religion is",
      "coded in the IPUMS 1983 sample but the microdata licence hold bars its use."
    )
  ),
  list(
    layer = "prefecture",
    status = "documented non-route",
    note = paste(
      "No published table gives religion by prefecture for any wave. Prefecture population",
      "totals exist (appendix Tables A.03-A.05) but carry no religion cross-tabulation."
    )
  )
)

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = paste0("manifest:gn-census-religion:gn:2014:", version_hash),
  dataset_id = "gn-census-religion:gn:2014:ins-geoboundaries",
  dataset_version_id = paste0("gn-census-religion:gn:2014:ins-geoboundaries:", version_hash),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "gn-census-religion",
  dataset_role = "public_product",
  scope = list(
    level = "country",
    country_codes = list("GN"),
    snapshot_date = NULL,
    pipeline_stage = "staged"
  ),
  created_at = stamp,
  created_by = script_id,
  target_years = list(2014L),
  pipeline = list(
    script = script_id,
    git_commit = git_commit,
    command = paste("Rscript", script_id),
    parameters = list(
      wave = list(
        year = 2014L,
        construct = "census religion, published one-decimal percent shares",
        geography = "8 administrative regions",
        denominator = "resident population (percentage basis; no counts published)",
        source_table = "Table 5.10",
        gate = "rounded-row reconciliation within the derived 0.25 pp bound; Ensemble matches Tables 5.09/5.11",
        counts_from_percentages = "withheld; no count derived from any percentage"
      ),
      derived_rounding_bound = list(
        applies_to = "Table 5.10 published one-decimal percentage rows",
        rounding_halfwidth_pp = reconciliation[["rounding_halfwidth_pp"]],
        category_count = reconciliation[["category_count"]],
        bound_pp = reconciliation[["derived_bound_pp"]],
        observed_max_absolute_deviation_pp = reconciliation[["max_absolute_deviation_pp"]],
        deviating_rows = reconciliation[["deviating_rows"]],
        row_deviations_pp = reconciliation[["row_deviations_pp"]],
        derivation = derived_bound_derivation
      ),
      ensemble_reconciliation = list(
        table_5_10_ensemble = as.list(national_5_09_total),
        table_5_09_total = as.list(national_5_09_total),
        table_5_11_2014_ensemble = as.list(national_5_11_2014_ensemble),
        status = "Table 5.10 Ensemble equals the Table 5.09 Total column and the Table 5.11 2014 Ensemble row exactly"
      ),
      change_metric = list(
        status = "withheld",
        rationale = "Subnational religion is published for 2014 only; 1983 and 1996 have no published subnational religion, so no cross-wave change is possible."
      ),
      category_frame_fr = as.list(category_frame[["source_label_fr"]]),
      category_display_mapping = category_mapping,
      affiliation_arithmetic = "religious_affiliation = Musulmane + Chrétienne + Animiste + Autre religion; no_religion = Sans religion (per conductor ruling 2026-07-11; trust the source rather than 100 minus Sans religion).",
      boundary = list(
        boundary_set_id = boundary_set_id,
        source = "geoBoundaries GIN ADM1 (gbOpen), represented year 2017, CC BY 3.0 IGO",
        features = 8L,
        total_land_area_sq_km = boundary_result[["total_land_area"]],
        output_bytes = boundary_result[["output_bytes"]],
        distinct_written_geometry_hashes = boundary_result[["distinct_written_hash_count"]],
        join = "area_code, 1:1 by accent-free region key (N'Zérékoré apostrophe watched)",
        simplification = c(
          boundary_result[["simplification"]],
          list(byte_ceiling = 3000000L, helper = "scripts/lib/simplify_boundary.R")
        ),
        source_geometry_sha256 = boundary_result[["source_geometry_sha256"]],
        written_geometry_sha256 = boundary_result[["written_geometry_sha256"]]
      ),
      licence_position = licence_position,
      raw_sources = raw_sources,
      local_cache_hint = "data/raw/gn_census/ (git-ignored; every cached source listed with URL, bytes, and SHA-256 in pipeline.parameters.raw_sources).",
      raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/gn_census/")
    ),
    software_versions = list(
      R = paste(R.version$major, R.version$minor, sep = "."),
      sf = as.character(utils::packageVersion("sf")),
      stringi = as.character(utils::packageVersion("stringi")),
      jsonlite = as.character(utils::packageVersion("jsonlite"))
    )
  ),
  source = list(
    provider = "Institut National de la Statistique (INS), Guinée; geoBoundaries (William & Mary geoLab)",
    source_dataset_ids = list(dataset_id_census, dataset_id_boundary),
    source_urls = list(url_etat, url_menages, url_licence, url_conditions, url_boundary, url_boundary_meta),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = "Census: CC BY 4.0 via the INS Accord de licence de données ouvertes (accepted). Boundary: CC BY 3.0 IGO.",
    raw_redistribution = "Census PDF and boundary are open web sources; both mirrored to gs://pow-research-data/raw_sources/gn_census/.",
    citation = paste(
      "INS RGPH-3 2014 (État et structure de la population, Table 5.10);",
      "geoBoundaries GIN ADM1 (CC BY 3.0 IGO)."
    ),
    local_cache_hint = "data/raw/gn_census/ (git-ignored).",
    raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/gn_census/")
  ),
  input_manifests = list(),
  deferred_sources = deferred_sources,
  durable_files = list(
    durable_file_record(summary_output, "Guinea single-wave regional census-religion area-summary JSON",
                        "ins_accord_de_licence_ouverte_cc_by_4_0", "accepted", row_count = 8L),
    durable_file_record(summary_csv_output, "Guinea single-wave regional census-religion area-summary CSV",
                        "ins_accord_de_licence_ouverte_cc_by_4_0", "accepted", row_count = 8L),
    durable_file_record(boundary_output, "Guinea 2017 region boundary (geoBoundaries ADM1)",
                        "cc_by_3_0_igo", "accepted", feature_count = 8L)
  ),
  partitions = list(
    list(
      partition_id = "gn-region-2014",
      partition_type = "area",
      file_uri = paste0("repo:", summary_output),
      sha256 = sha256_file(summary_output),
      country_code = "GN",
      row_count = 8L,
      stage = "staged"
    )
  ),
  stats = list(
    waves = 1L,
    years = "2014",
    region_rows = 8L,
    regions_per_wave = 8L,
    categories = 5L,
    boundary_features = 8L,
    derived_bound_pp = reconciliation[["derived_bound_pp"]],
    max_absolute_deviation_pp = reconciliation[["max_absolute_deviation_pp"]]
  ),
  local_cache_hint = "data/raw/gn_census/ (git-ignored; every cached source listed with URL, bytes, and SHA-256 in pipeline.parameters.raw_sources).",
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
        "The Faranah Table 5.10 row's five cells sum to 99.9 (deviation 0.1 pp), not 100.0.",
        "This is a genuine source rounding artefact within the 0.25 pp derived bound, contradicting",
        "the task's stated expectation of exact-100.0 rows. No percentage was altered."
      ),
      "Single wave (2014), region level, percentages only, no counts, no cross-wave change.",
      "The 1996 national row and 1983 are documented non-routes (deferred_sources); no published subnational religion beyond 2014 exists."
    ),
    notes = paste(
      "Table 5.10 rows appear verbatim in the pdftotext -layout output; the Ensemble row equals",
      "the Table 5.09 Total column and the Table 5.11 2014 Ensemble row exactly. Boundary output",
      "has 8 valid, non-empty, distinctly hashed geometries within the 3 MB cap. Both the",
      "area-summary and the manifest pass schema validation."
    )
  ),
  privacy = "public",
  licence_status = "accepted",
  licence_basis = "ins_accord_de_licence_ouverte_cc_by_4_0",
  downstream_status = "staged",
  notes = paste(
    "Single-wave (2014) eight-region census-religion product, one-decimal percentages as",
    "printed, no counts. Ships STAGED (no page, no hub link) pending the project lead's",
    "reaction to the conductor's task-8 view. Licence accepted (CC BY 4.0 via the INS Accord;",
    "boundary CC BY 3.0 IGO)."
  )
)

write_json(manifest, manifest_output, auto_unbox = TRUE, pretty = TRUE, null = "null", digits = NA)

if (!jsonlite::validate(readChar(manifest_output, file_bytes(manifest_output), useBytes = TRUE))) {
  stop("manifest output is not valid JSON", call. = FALSE)
}
validate_json_schema("schemas/data-manifest.schema.json", manifest_output)

message(
  "built Guinea regional census-religion product: ", length(product_rows),
  " region rows for 2014; boundary ", boundary_result[["output_bytes"]],
  " bytes, ", boundary_result[["total_land_area"]], " km2; derived bound ",
  reconciliation[["derived_bound_pp"]], " pp, observed max deviation ",
  reconciliation[["max_absolute_deviation_pp"]], " pp (Faranah); staged (accepted licence)."
)
