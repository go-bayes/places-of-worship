# build the Burkina Faso census-affiliation regional product from INSD PDFs.
#
# inputs: cached INSD RGPH PDF tables (2006 exact counts, 2019 published
# one-decimal percentages) and the geoBoundaries BFA ADM1 boundary; all under
# git-ignored data/raw/bf_census/.
# outputs: apps/regions/bf/data/area_summary_region.{json,csv},
# apps/regions/bf/data/bf_region_2017.geojson, and the tracked data manifest
# docs/manifests/bf-census-religion-2006-2019.json.
# run from the repo root: Rscript scripts/build_bf_area_summary.R
#
# gate design. the 2006 exact-count table keeps the every-row exact
# reconciliation gate. the 2019 published-percentage table is gated by a bound
# derived from the source's own rounding, ratified by the PI on 2026-07-10
# (estonia precedent: bounds derived from the source's rounding, never arbitrary
# tolerances). each printed one-decimal percentage carries a maximum rounding
# error of 0.05 percentage points; a k-category row sum may therefore deviate from the
# printed 100.0 total by at most 0.05 * k; with the six mutually exclusive
# categories the bound is 0.30 percentage points. the five flagged 2019 rows
# deviate by 0.1 (99.9 or 100.1), within the bound. no percentage is altered.
#
# the product ships to STAGING: privacy is public but licence_status is
# needs_review because INSD publication reuse rights are unresolved (the cached
# legal page reserves all rights and subjects published data to a named Accord de
# licence de données ouvertes whose text was not captured; the PI follow-up stays open). the
# manifest records the INSD position verbatim.

suppressMessages({
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

raw_dir <- "data/raw/bf_census"
output_dir <- "apps/regions/bf/data"
manifest_dir <- "docs/manifests"

retrieval_date <- "2026-07-10"
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
script_id <- "scripts/build_bf_area_summary.R"
country_code <- "BF"

pdf_2006 <- file.path(raw_dir, "bf_2006_theme2_etat_structure.pdf")
pdf_2019 <- file.path(raw_dir, "bf_2019_resultats_definitifs.pdf")
pdf_1996 <- file.path(raw_dir, "bf_1996_rapport_rgph_1.pdf")
pdf_2006_booklet <- file.path(raw_dir, "bf_2006_resultats_definitifs.pdf")
boundary_path <- file.path(raw_dir, "geoBoundaries-BFA-ADM1.geojson")
boundary_metadata_path <- file.path(raw_dir, "gb_bfa_adm1_meta.json")
legal_html_path <- file.path(raw_dir, "insd_mentions_legales.html")
catalog_terms_path <- file.path(raw_dir, "insd_rgph2019_catalog_terms.html")

# source urls (retrieved 2026-07-10; see route-probe.md for sha-256 record).
url_2006 <- "https://www.insd.bf/sites/default/files/2021-12/Theme2-Etat_et_structure_de_la_population.pdf"
url_2019 <- "https://www.insd.bf/sites/default/files/2022-07/Rapport%20resultats%20definitifs%20RGPH%202019.pdf"
url_1996 <- "https://microdata.insd.bf/index.php/catalog/42/download/253"
url_2006_booklet <- "https://www.insd.bf/sites/default/files/2021-12/Resultats_definitifs_RGPH_2006.pdf"
url_boundary <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/BFA/ADM1/geoBoundaries-BFA-ADM1.geojson"
url_boundary_meta <- "https://www.geoboundaries.org/api/current/gbOpen/BFA/ADM1/"
url_legal <- "https://www.insd.bf/fr/mentions-legales"
url_catalog_terms <- "https://microdata.insd.bf/index.php/catalog/69"

boundary_set_id <- "bf-region-2017-geoboundaries-adm1"
boundary_output <- file.path(output_dir, "bf_region_2017.geojson")
summary_output <- file.path(output_dir, "area_summary_region.json")
summary_csv_output <- file.path(output_dir, "area_summary_region.csv")
manifest_output <- file.path(manifest_dir, "bf-census-religion-2006-2019.json")

dataset_id_2006 <- "insd-rgph-2006-etat-structure"
dataset_id_2019 <- "insd-rgph-2019-resultats-definitifs"
dataset_id_boundary <- "geoboundaries-bfa-adm1-2017"

# verbatim INSD publication-terms strings captured from the cached pages. these
# are the recorded licence position; publication reuse rights stay unresolved.
insd_legal_footer_verbatim <- "© 2020 INSD - Tous droits reservés"
insd_open_data_agreement_verbatim <- paste0(
  "L’accès aux Données publiées par l’Institut national de la statistique ",
  "et de la démographie, y compris les Données mises à disposition sur ce ",
  "site web et sur l’Open Data Portal, ainsi que leur utilisation, sont ",
  "soumis aux exigences énoncées dans l’Accord de licence de données ouvertes."
)
insd_catalog_terms_verbatim <- paste0(
  "Les données et autres matériels ne seront pas redistribués ou vendus ",
  "à d'autres personnes, institutions ou organisations sans l'accord écrit l'INSD."
)
insd_position <- paste(
  "INSD publication reuse rights are unresolved. The cached legal page footer states",
  paste0("“", insd_legal_footer_verbatim, "”"),
  "and the same page subjects published data to a named Accord de licence de données ouvertes",
  paste0("(“", insd_open_data_agreement_verbatim, "”)"),
  "whose linked text was not captured in this cache. The cached 2019 microdata catalogue terms state",
  paste0("“", insd_catalog_terms_verbatim, "”;"),
  "those catalogue terms govern the microdata and do not establish a publication",
  "licence for the cached census PDFs or a derived map product."
)
insd_pi_followup <- paste(
  "Open PI follow-up (2026-07-10): the legal page names and links an Accord de licence",
  "de données ouvertes (Open Data Agreement) governing published INSD data, hosted with",
  "the Open Data Portal (burkinafaso.opendataforafrica.org); its text was not captured.",
  "The reuse position stays needs_review pending the PI reviewing that agreement.",
  "Publication to staging proceeds under the PI ship ruling of 2026-07-10."
)

# stop when a required cached source is absent.
require_file <- function(path) {
  if (!file.exists(path)) stop("missing required source: ", path, call. = FALSE)
}

# compute the sha-256 digest for a local file.
sha256_file <- function(path) {
  unname(tools::sha256sum(path))
}

# return file size in bytes for validation and manifest records.
file_bytes <- function(path) {
  as.integer(unname(file.info(path)[["size"]]))
}

# run poppler's layout-preserving extractor and return its lines.
pdf_layout_lines <- function(path) {
  pdftotext <- Sys.which("pdftotext")
  if (!nzchar(pdftotext)) stop("pdftotext (Poppler) is required", call. = FALSE)
  output <- tempfile(fileext = ".txt")
  on.exit(unlink(output), add = TRUE)
  status <- system2(pdftotext, c("-layout", shQuote(path), shQuote(output)))
  if (status != 0L) stop("pdftotext failed on ", path, call. = FALSE)
  readLines(output, warn = FALSE)
}

# normalise source text for exact row-presence assertions without changing digits.
normalise_source_text <- function(lines) {
  text <- paste(lines, collapse = "\n")
  text <- gsub("Boucle du\\s*\\n\\s*Mouhoun", "Boucle du Mouhoun", text)
  text <- gsub("[[:space:]]+", " ", text)
  trimws(text)
}

# format an integer with the source's French thousands grouping.
source_integer <- function(value) {
  format(as.integer(value), big.mark = " ", scientific = FALSE, trim = TRUE)
}

# format a one-decimal source percentage with a decimal comma.
source_percent <- function(value) {
  sub("\\.", ",", sprintf("%.1f", value), fixed = FALSE)
}

# reduce a region name to an accent-free alphanumeric join key so the 2006
# lowercase spellings ("Centre-est") and the 2019/boundary spellings
# ("Centre-Est") map to the same stable area code.
normalise_region_key <- function(x) {
  gsub("[^a-z0-9]", "", tolower(x))
}

# validate a generated json product against a repository schema.
validate_json_schema <- function(schema_path, instance_path) {
  base_uri <- paste0(
    "file://",
    normalizePath(dirname(schema_path), winslash = "/", mustWork = TRUE),
    "/"
  )
  status <- system2(
    "uvx",
    c(
      "check-jsonschema",
      "--base-uri", base_uri,
      "--schemafile", schema_path,
      instance_path
    ),
    env = c(
      "UV_CACHE_DIR=/tmp/places-of-worship-uv/cache",
      "UV_TOOL_DIR=/tmp/places-of-worship-uv/tools",
      "UV_PYTHON_INSTALL_DIR=/tmp/places-of-worship-uv/python"
    )
  )
  if (!identical(status, 0L)) {
    stop("schema validation failed for ", instance_path, call. = FALSE)
  }
  invisible(instance_path)
}

# require the cached PDF text to contain every transcribed row in source order.
assert_transcription_present <- function(source_text, rows, value_columns, formatter) {
  for (i in seq_len(nrow(rows))) {
    pieces <- c(rows[["source_name"]][i], vapply(
      rows[i, value_columns, drop = FALSE], formatter, character(1)
    ))
    pattern <- paste(vapply(pieces, function(x) {
      gsub(" ", "[[:space:]]+", x, fixed = TRUE)
    }, character(1)), collapse = "[[:space:]]+")
    if (!grepl(pattern, source_text, perl = TRUE)) {
      stop("transcribed row not found in pdftotext output: ", rows[["source_name"]][i], call. = FALSE)
    }
  }
}

# return the exact-count 2006 regional table transcribed from Table A5.5.
table_2006 <- function() {
  data.frame(
    source_name = c(
      "Boucle du Mouhoun", "Cascades", "Centre", "Centre-est", "Centre-nord",
      "Centre-ouest", "Centre-sud", "Est", "Hauts-bassins", "Nord",
      "Plateau central", "Sahel", "Sud-ouest", "Total"
    ),
    animiste = c(215991, 75355, 13193, 56869, 284058, 239960, 116393, 371710, 160726, 120129, 76937, 16274, 402714, 2150309),
    musulman = c(896957, 407112, 966141, 808210, 717072, 476872, 311781, 462538, 1061969, 946920, 415321, 933964, 80292, 8485149),
    catholique = c(255349, 35826, 625034, 240034, 167530, 374447, 173202, 217480, 192201, 90691, 176316, 6328, 109798, 2664236),
    protestant = c(64220, 6961, 104412, 20102, 26621, 80374, 35465, 135417, 39867, 23214, 23462, 4779, 20260, 585154),
    autre = c(5755, 2776, 16887, 4713, 4980, 6541, 3220, 8999, 8245, 4253, 3693, 5877, 3546, 79485),
    sans_religion = c(4477, 3778, 1723, 2088, 1764, 8372, 1382, 16140, 6596, 589, 643, 1220, 4157, 52929),
    printed_total = c(1442749, 531808, 1727390, 1132016, 1202025, 1186566, 641443, 1212284, 1469604, 1185796, 696372, 968442, 620767, 14017262),
    stringsAsFactors = FALSE
  )
}

# return the rounded-percentage 2019 regional table transcribed from Table 10.
table_2019 <- function() {
  data.frame(
    source_name = c(
      "Boucle du Mouhoun", "Cascades", "Centre", "Centre-Est", "Centre-Nord",
      "Centre-Ouest", "Centre-Sud", "Est", "Hauts-Bassins", "Nord",
      "Plateau Central", "Sahel", "Sud-Ouest", "Burkina Faso"
    ),
    animiste = c(9.5, 8.5, 0.3, 1.7, 13.8, 8.9, 7.6, 20.3, 6.4, 6.0, 4.1, 0.5, 48.1, 9.0),
    musulman = c(64.9, 81.5, 61.2, 77.2, 67.3, 45.8, 54.2, 34.6, 76.2, 82.6, 66.1, 97.3, 19.5, 63.8),
    catholique = c(18.6, 6.1, 31.3, 19.0, 15.6, 35.7, 28.9, 22.3, 12.3, 8.4, 25.6, 1.0, 23.1, 20.1),
    protestant = c(6.0, 1.7, 6.9, 1.9, 3.1, 8.5, 8.9, 21.0, 3.9, 2.7, 4.1, 0.7, 7.0, 6.2),
    autre = c(0.2, 0.2, 0.2, 0.1, 0.0, 0.2, 0.2, 0.4, 0.2, 0.0, 0.0, 0.0, 0.4, 0.2),
    sans_religion = c(0.8, 1.9, 0.1, 0.2, 0.2, 0.9, 0.3, 1.4, 1.0, 0.3, 0.1, 0.4, 2.0, 0.7),
    printed_percent_total = rep(100.0, 14),
    collected_basis = c(1762184, 764449, 2693142, 1428228, 1424407, 1562563, 744260, 1579001, 2046976, 1582564, 922488, 836374, 825202, 18171838),
    full_resident_total = c(1901269, 812466, 3030384, 1580508, 1874669, 1660135, 788731, 1942805, 2239840, 1722115, 978614, 1098177, 875442, 20505155),
    stringsAsFactors = FALSE
  )
}

# verbatim French categories with separate English display labels.
category_frame <- data.frame(
  key = c("animiste", "musulman", "catholique", "protestant", "autre", "sans_religion"),
  source_label_fr = c("Animiste", "Musulman", "Catholique", "Protestant", "Autre", "Sans religion"),
  display_label_en = c("Animist", "Muslim", "Catholic", "Protestant", "Other religion", "No religion"),
  product_role = c(
    "religious_affiliation", "religious_affiliation", "religious_affiliation",
    "religious_affiliation", "religious_affiliation", "no_religion"
  ),
  stringsAsFactors = FALSE
)
categories <- category_frame[["key"]]
affiliation_categories <- category_frame[["key"]][category_frame[["product_role"]] == "religious_affiliation"]
no_religion_categories <- category_frame[["key"]][category_frame[["product_role"]] == "no_religion"]

# return stable region codes shared by the census and boundary labels.
region_codes <- function() {
  c(
    "Boucle du Mouhoun" = "boucle-du-mouhoun", "Cascades" = "cascades",
    "Centre" = "centre", "Centre-Est" = "centre-est", "Centre-Nord" = "centre-nord",
    "Centre-Ouest" = "centre-ouest", "Centre-Sud" = "centre-sud", "Est" = "est",
    "Hauts-Bassins" = "hauts-bassins", "Nord" = "nord",
    "Plateau Central" = "plateau-central", "Sahel" = "sahel", "Sud-Ouest" = "sud-ouest"
  )
}

# stop unless every row's mutually exclusive categories equal its printed total.
assert_exact_row_reconciliation <- function(rows, categories, total_column, wave) {
  calculated <- rowSums(rows[, categories, drop = FALSE])
  difference <- round(calculated - rows[[total_column]], 10)
  failed <- which(difference != 0)
  if (length(failed) > 0L) {
    details <- paste0(
      rows[["source_name"]][failed], " (category sum=", format(calculated[failed], big.mark = ""),
      ", printed total=", format(rows[[total_column]][failed], big.mark = ""),
      ", difference=", sprintf("%+.0f", difference[failed]), ")"
    )
    stop(
      wave, " every-row exact reconciliation failed: ", paste(details, collapse = "; "),
      ". no value was allocated, rounded, or tuned; product writing stopped.",
      call. = FALSE
    )
  }
  invisible(TRUE)
}

# stop unless regional exact counts reproduce every national category total.
assert_2006_local_to_national <- function(rows, categories) {
  local <- rows[rows[["source_name"]] != "Total", , drop = FALSE]
  national <- rows[rows[["source_name"]] == "Total", , drop = FALSE]
  differences <- colSums(local[, c(categories, "printed_total"), drop = FALSE]) -
    unlist(national[1, c(categories, "printed_total"), drop = FALSE], use.names = FALSE)
  if (any(differences != 0)) {
    stop("2006 regional counts do not reproduce the national row exactly", call. = FALSE)
  }
  invisible(TRUE)
}

# stop unless the 2019 regional collected bases and full totals match national rows.
assert_2019_population_reconciliation <- function(rows) {
  local <- rows[rows[["source_name"]] != "Burkina Faso", , drop = FALSE]
  national <- rows[rows[["source_name"]] == "Burkina Faso", , drop = FALSE]
  if (sum(local[["collected_basis"]]) != national[["collected_basis"]][1]) {
    stop("2019 regional collected-person bases do not reproduce the national basis", call. = FALSE)
  }
  if (sum(local[["full_resident_total"]]) != national[["full_resident_total"]][1]) {
    stop("2019 regional full resident totals do not reproduce the national total", call. = FALSE)
  }
  invisible(TRUE)
}

# stop unless every row's rounded category percentages sum to its printed total
# within the bound derived from the source's own one-decimal rounding.
#
# derivation: each printed percentage is rounded to one decimal; it therefore carries a
# maximum rounding error of rounding_halfwidth = 0.05 percentage points (half of
# the 0.1 print step). the k mutually exclusive categories partition the basis,
# so their true shares sum to exactly 100.0; the printed row sum can therefore
# differ from 100.0 by at most the accumulated per-cell error, 0.05 * k. with
# k = 6 categories the bound is 0.30 percentage points. the bound is a function
# of the source's rounding and the category count, not an arbitrary tolerance.
assert_rounded_row_reconciliation <- function(rows, categories, total_column, wave,
                                              rounding_halfwidth = 0.05) {
  k <- length(categories)
  bound <- rounding_halfwidth * k
  calculated <- rowSums(rows[, categories, drop = FALSE])
  difference <- round(calculated - rows[[total_column]], 6)
  exceeded <- which(abs(difference) > bound + 1e-9)
  if (length(exceeded) > 0L) {
    details <- paste0(
      rows[["source_name"]][exceeded], " (category sum=", sprintf("%.1f", calculated[exceeded]),
      ", printed total=", sprintf("%.1f", rows[[total_column]][exceeded]),
      ", |difference|=", sprintf("%.1f", abs(difference[exceeded])),
      " > derived bound=", sprintf("%.2f", bound), ")"
    )
    stop(
      wave, " rounded-row reconciliation exceeded the derived bound: ",
      paste(details, collapse = "; "),
      ". no percentage was altered; product writing stopped.",
      call. = FALSE
    )
  }
  list(
    category_count = k,
    rounding_halfwidth = rounding_halfwidth,
    derived_bound = bound,
    max_absolute_deviation = as.numeric(max(abs(difference))),
    row_deviations = setNames(as.list(round(difference, 1) + 0), rows[["source_name"]])
  )
}

# validate and simplify the 13-feature boundary; return the written layer, its
# geodesic land areas by area code, and geometry-validation details.
build_boundary <- function() {
  boundary <- st_read(boundary_path, quiet = TRUE)
  if (nrow(boundary) != 13L) stop("expected 13 geoBoundaries ADM1 features", call. = FALSE)
  boundary <- st_make_valid(boundary)
  validity <- st_is_valid(boundary)
  if (any(st_is_empty(boundary)) || any(is.na(validity)) || any(!validity)) {
    stop("source boundary contains empty or invalid geometries", call. = FALSE)
  }
  source_hashes <- vapply(st_as_binary(st_geometry(boundary), EWKB = TRUE), digest::digest,
                          character(1), algo = "sha256", serialize = FALSE)
  if (anyDuplicated(source_hashes)) stop("source boundary contains duplicate geometries", call. = FALSE)

  codes <- region_codes()
  if (!setequal(boundary[["shapeName"]], names(codes))) {
    stop("census and boundary region names do not match exactly", call. = FALSE)
  }
  boundary[["area_code"]] <- unname(codes[boundary[["shapeName"]]])
  boundary[["area_name"]] <- boundary[["shapeName"]]
  boundary[["area_unit_id"]] <- paste0(boundary_set_id, ":", boundary[["area_code"]])
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- "region"
  boundary <- boundary[, c("area_code", "area_name", "area_unit_id", "boundary_set_id", "boundary_level")]
  boundary <- boundary[order(boundary[["area_code"]]), ]

  dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
  simplification <- mapshaper_simplify_to_cap(
    boundary, boundary_output, max_bytes = 3000000L,
    keep_percentages = c(100, 80, 60, 40, 30, 20, 15, 10, 7, 5),
    clean_option = "allow-overlaps"
  )
  written <- st_read(boundary_output, quiet = TRUE)
  written <- written[order(written[["area_code"]]), ]
  written_validity <- st_is_valid(written)
  written_hashes <- vapply(st_as_binary(st_geometry(written), EWKB = TRUE), digest::digest,
                           character(1), algo = "sha256", serialize = FALSE)
  if (nrow(written) != 13L || any(st_is_empty(written)) || any(!written_validity) ||
      anyDuplicated(written_hashes) || file.info(boundary_output)[["size"]] > 3000000L) {
    stop("simplified boundary failed feature, validity, distinctness, or byte-cap gate", call. = FALSE)
  }
  # s2 geodesic area on the geographic crs; appropriate for a west-african extent.
  land_area <- as.numeric(st_area(written)) / 1e6
  land_area_by_code <- setNames(round(land_area, 4), written[["area_code"]])
  # sanity band: burkina faso is about 273,000 km2; catch a crs or unit mistake.
  if (sum(land_area) < 250000 || sum(land_area) > 300000) {
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

# safe numeric accessor that maps an absent (null) row field to NA.
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
    source_dataset_ids = vapply(
      rows,
      function(row) paste(unlist(row[["source_dataset_ids"]]), collapse = "|"),
      character(1)
    ),
    quality_flag = vapply(rows, `[[`, character(1), "quality_flag"),
    stringsAsFactors = FALSE
  )
}

# ---- run gates -------------------------------------------------------------

for (path in c(pdf_2006, pdf_2019, boundary_path, boundary_metadata_path,
               legal_html_path, catalog_terms_path)) {
  require_file(path)
}

rows_2006 <- table_2006()
rows_2019 <- table_2019()

text_2006 <- normalise_source_text(pdf_layout_lines(pdf_2006))
text_2019 <- normalise_source_text(pdf_layout_lines(pdf_2019))
assert_transcription_present(text_2006, rows_2006, c(categories, "printed_total"), source_integer)
assert_transcription_present(
  text_2019, rows_2019, c(categories, "printed_percent_total"), source_percent
)

# 2006 exact-count gates remain exact.
assert_exact_row_reconciliation(rows_2006, categories, "printed_total", "2006")
assert_2006_local_to_national(rows_2006, categories)
# 2019 published-percentage row gate under the PI-ratified derived rounding bound.
assert_2019_population_reconciliation(rows_2019)
reconciliation_2019 <- assert_rounded_row_reconciliation(
  rows_2019, categories, "printed_percent_total", "2019"
)

boundary_result <- build_boundary()
land_area_by_code <- boundary_result[["land_area_by_code"]]

# ---- construct product rows ------------------------------------------------

canonical_name_by_code <- setNames(names(region_codes()), unname(region_codes()))
code_by_norm_name <- setNames(
  unname(region_codes()),
  vapply(names(region_codes()), normalise_region_key, character(1))
)

# map a wave's source region name to the shared stable area code.
area_code_for <- function(source_name) {
  code <- code_by_norm_name[[normalise_region_key(source_name)]]
  if (is.null(code)) stop("no area code for region: ", source_name, call. = FALSE)
  code
}

basis_2006 <- paste(
  "INSD RGPH 2006 État et structure de la population, Table A5.5: full resident",
  "population. The six mutually exclusive category counts sum exactly to this",
  "regional total and, across regions, to the national total 14,017,262."
)

# 2006 regional rows: exact counts on the full-resident denominator.
rows_2006_region <- rows_2006[rows_2006[["source_name"]] != "Total", , drop = FALSE]
product_rows_2006 <- lapply(seq_len(nrow(rows_2006_region)), function(i) {
  region <- rows_2006_region[i, , drop = FALSE]
  code <- area_code_for(region[["source_name"]])
  total <- as.integer(region[["printed_total"]])
  affiliation <- as.integer(sum(region[, affiliation_categories]))
  no_religion <- as.integer(sum(region[, no_religion_categories]))
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = "region",
    area_unit_id = paste0(boundary_set_id, ":", code),
    area_code = code,
    area_name = unname(canonical_name_by_code[[code]]),
    year = 2006L,
    population_total = total,
    population_total_basis = basis_2006,
    religious_affiliation_count = affiliation,
    religious_affiliation_percent = round(100 * affiliation / total, 2),
    no_religion_count = no_religion,
    no_religion_percent = round(100 * no_religion / total, 2),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = unname(land_area_by_code[[code]]),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(dataset_id_2006, dataset_id_boundary),
    quality_flag = paste(
      "census_affiliation", "denominator_full_resident_population",
      "published_census_counts", "exact_row_reconciliation",
      "boundary_2017_geoboundaries", "no_cross_wave_change",
      sep = ";"
    )
  )
})

# 2019 regional rows: published one-decimal percent shares on the
# collected-person basis. counts are withheld; none is derived from percentages.
rows_2019_region <- rows_2019[rows_2019[["source_name"]] != "Burkina Faso", , drop = FALSE]
product_rows_2019 <- lapply(seq_len(nrow(rows_2019_region)), function(i) {
  region <- rows_2019_region[i, , drop = FALSE]
  code <- area_code_for(region[["source_name"]])
  collected <- as.integer(region[["collected_basis"]])
  outside_basis <- as.integer(region[["full_resident_total"]] - region[["collected_basis"]])
  affiliation_share <- round(sum(region[, affiliation_categories]), 1)
  no_religion_share <- round(sum(region[, no_religion_categories]), 1)
  basis_2019 <- paste0(
    "INSD RGPH 2019 final-results report, Table 10: collected-person effectif ",
    "(population whose data were collected during enumeration). Percentages are ",
    "shares of this basis. Nationally 18,171,838 collected of 20,505,155 full ",
    "residents, leaving 2,333,317 residents represented only by estimates for ",
    "incompletely enumerated localities and outside this basis. This region: ",
    format(collected, big.mark = ","), " collected; ",
    format(outside_basis, big.mark = ","), " residents outside the basis."
  )
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = "region",
    area_unit_id = paste0(boundary_set_id, ":", code),
    area_code = code,
    area_name = unname(canonical_name_by_code[[code]]),
    year = 2019L,
    population_total = collected,
    population_total_basis = basis_2019,
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
    source_dataset_ids = list(dataset_id_2019, dataset_id_boundary),
    quality_flag = paste(
      "census_affiliation", "denominator_collected_person_basis",
      "published_one_decimal_percent_shares", "counts_withheld_no_derivation_from_percent",
      "row_sum_within_derived_rounding_bound", "boundary_2017_geoboundaries",
      "no_cross_wave_change",
      sep = ";"
    )
  )
})

all_rows <- c(product_rows_2006, product_rows_2019)
if (length(all_rows) != 26L) stop("expected 26 region-wave rows (13 x 2)", call. = FALSE)

# ---- source datasets, indicators, visual layers ----------------------------

source_datasets <- list(
  list(
    source_dataset_id = dataset_id_2006,
    name = "INSD RGPH 2006, État et structure de la population, Table A5.5",
    provider = "Institut national de la statistique et de la démographie (INSD)",
    url = url_2006,
    retrieval_date = retrieval_date,
    local_path = pdf_2006,
    licence = list(
      name = "Publication reuse rights unresolved (INSD; needs_review)",
      url = NULL,
      attribution = "Institut national de la statistique et de la démographie (INSD)"
    ),
    citation = paste(
      "INSD, Recensement général de la population et de l'habitation 2006,",
      "État et structure de la population, Table A5.5 (13 regions)."
    ),
    access_limits = "Open web PDF.",
    redistribution_limits = insd_position,
    notes = paste(
      "Exact category counts for 13 regions and the national row on the full",
      "resident denominator 14,017,262. The 45 provincial rows in Tables A5.4-A5.6",
      "remain a documented but unverified route and are not extracted in this lane."
    )
  ),
  list(
    source_dataset_id = dataset_id_2019,
    name = "INSD RGPH 2019 final-results report, Table 10",
    provider = "Institut national de la statistique et de la démographie (INSD)",
    url = url_2019,
    retrieval_date = retrieval_date,
    local_path = pdf_2019,
    licence = list(
      name = "Publication reuse rights unresolved (INSD; needs_review)",
      url = NULL,
      attribution = "Institut national de la statistique et de la démographie (INSD)"
    ),
    citation = paste(
      "INSD, Cinquième Recensement Général de la Population et de l'Habitation",
      "du Burkina Faso: Rapport des résultats définitifs, Table 10 (13 regions)."
    ),
    access_limits = "Open web PDF.",
    redistribution_limits = insd_position,
    notes = paste(
      "Published one-decimal percentage shares on the collected-person basis",
      "(18,171,838 nationally). Five regional rows sum to 99.9 or 100.1 by the",
      "source's own rounding, within the derived bound of 0.30 percentage points.",
      "Counts are not derived from the percentages."
    )
  ),
  list(
    source_dataset_id = dataset_id_boundary,
    name = "geoBoundaries Burkina Faso ADM1 (13 regions, represented year 2017)",
    provider = "geoBoundaries (William & Mary geoLab); underlying source World Bank",
    url = url_boundary,
    retrieval_date = retrieval_date,
    local_path = boundary_path,
    licence = list(
      name = "Creative Commons Attribution 4.0 International (CC BY 4.0)",
      url = "https://creativecommons.org/licenses/by/4.0/",
      attribution = "geoBoundaries (gbOpen) BFA ADM1; boundary ID BFA-ADM1-92566538; source World Bank"
    ),
    citation = paste(
      "Runfola, D. et al. (2020) geoBoundaries: A global database of political",
      "administrative boundaries. gbOpen BFA ADM1 (pinned commit 9469f09)."
    ),
    access_limits = NULL,
    redistribution_limits = "CC BY 4.0 permits redistribution and derivatives with attribution.",
    notes = "13 ADM1 regions; release metadata states CC BY 4.0, canonical level Region, represented year 2017."
  )
)

spatial_note <- paste(
  "Thirteen ADM1 regions on the geoBoundaries 2017 boundary, shared by both waves.",
  "The product reports no cross-wave change statistic."
)
indicators <- list(
  list(
    indicator_id = "population_total",
    label = "Population (denominator basis)",
    description = paste(
      "For 2006, the full resident population. For 2019, the collected-person",
      "effectif that is the published percentage basis."
    ),
    unit = "count",
    denominator_indicator_id = NULL,
    method = "Use the published regional total for each wave without adjustment.",
    temporal_coverage = "2006, 2019",
    spatial_coverage = spatial_note,
    quality_notes = paste(
      "The 2006 and 2019 denominators differ in basis (full resident vs.",
      "collected person); the two waves are not differenced."
    )
  ),
  list(
    indicator_id = "religious_affiliation_count",
    label = "Religious affiliation (count)",
    description = "People in the five affiliation categories (Animiste, Musulman, Catholique, Protestant, Autre).",
    unit = "count",
    denominator_indicator_id = "population_total",
    method = paste(
      "2006 only: sum the five published affiliation category counts. 2019 counts",
      "are withheld because the source publishes percentages only and no count is",
      "derived from a percentage."
    ),
    temporal_coverage = "2006",
    spatial_coverage = spatial_note,
    quality_notes = "Null for 2019 rows."
  ),
  list(
    indicator_id = "religious_affiliation_percent",
    label = "Religious affiliation (%)",
    description = "Share of the basis in the five affiliation categories.",
    unit = "percent",
    denominator_indicator_id = "population_total",
    method = paste(
      "2006: 100 x affiliation count / full resident total. 2019: sum of the five",
      "published affiliation-category one-decimal shares, carried as published."
    ),
    temporal_coverage = "2006, 2019",
    spatial_coverage = spatial_note,
    quality_notes = paste(
      "2019 shares are one-decimal published values; a regional row may sum with",
      "the no-religion share to 99.9 or 100.1 within the derived rounding bound."
    )
  ),
  list(
    indicator_id = "no_religion_count",
    label = "No religion (count)",
    description = "People in the Sans religion category.",
    unit = "count",
    denominator_indicator_id = "population_total",
    method = "2006 only: the published Sans religion count. 2019 counts are withheld.",
    temporal_coverage = "2006",
    spatial_coverage = spatial_note,
    quality_notes = "Null for 2019 rows."
  ),
  list(
    indicator_id = "no_religion_percent",
    label = "No religion (%)",
    description = "Sans religion as a share of the basis.",
    unit = "percent",
    denominator_indicator_id = "population_total",
    method = paste(
      "2006: 100 x Sans religion count / full resident total. 2019: the published",
      "Sans religion one-decimal share."
    ),
    temporal_coverage = "2006, 2019",
    spatial_coverage = spatial_note,
    quality_notes = "The Sans religion category is inside the denominator and outside the affiliation numerator."
  )
)

visual_layers <- list(
  list(
    visual_layer_id = "bf-region-religious-affiliation-share",
    label = "Religious affiliation share",
    description = "Census religious affiliation share by region for 2006 and 2019.",
    layer_type = "choropleth",
    indicator_ids = list("religious_affiliation_percent"),
    geometry_unit_type = "area_unit",
    legend = list(unit = "percent", denominator = "wave-specific published basis"),
    colour_scale = "sequential",
    time_control = "year_selector",
    aggregation_rule = "published regional value on the shared 2017 boundary",
    uncertainty_display = "quality_flag",
    default_visibility = TRUE,
    notes = paste(
      "2006 values are exact-count shares; 2019 values are published one-decimal",
      "shares on the collected-person basis. The waves are shown side by side, not",
      "differenced."
    )
  ),
  list(
    visual_layer_id = "bf-region-no-religion-share",
    label = "No religion share",
    description = "Sans religion share by region for 2006 and 2019.",
    layer_type = "choropleth",
    indicator_ids = list("no_religion_percent"),
    geometry_unit_type = "area_unit",
    legend = list(unit = "percent", denominator = "wave-specific published basis"),
    colour_scale = "sequential",
    time_control = "year_selector",
    aggregation_rule = "published regional value on the shared 2017 boundary",
    uncertainty_display = "quality_flag",
    default_visibility = FALSE,
    notes = "No cross-wave change layer: the two waves use different denominator bases."
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
    vintage = "geoBoundaries ADM1 represented year 2017; shared by both census waves",
    source_dataset_id = dataset_id_boundary
  ),
  site_snapshot = list(
    source_dataset_id = NULL,
    snapshot_date = NULL,
    basis = "no governed Burkina Faso place-of-worship snapshot is included in this census-affiliation release",
    notes = "The Burkina Faso lane ships census-affiliation metrics only."
  ),
  source_datasets = source_datasets,
  indicators = indicators,
  visual_layers = visual_layers,
  rows = all_rows
)
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)
write_json(area_summary, summary_output, auto_unbox = TRUE, pretty = TRUE, null = "null", digits = NA)
utils::write.csv(flatten_rows(all_rows), summary_csv_output, row.names = FALSE, na = "")

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
  raw_source_record(pdf_2006, url_2006, "2006 thematic report (Table A5.5 exact regional counts)"),
  raw_source_record(pdf_2019, url_2019, "2019 final-results report (Table 10 regional percentages)"),
  raw_source_record(pdf_1996, url_1996, "1996 Volume I (national religion table; context only)"),
  raw_source_record(pdf_2006_booklet, url_2006_booklet, "2006 final-results booklet (programme record; context only)"),
  raw_source_record(boundary_path, url_boundary, "geoBoundaries BFA ADM1 source GeoJSON"),
  raw_source_record(boundary_metadata_path, url_boundary_meta, "geoBoundaries BFA ADM1 release metadata"),
  raw_source_record(legal_html_path, url_legal, "INSD legal page capture (all-rights-reserved footer; Open Data Agreement reference)"),
  raw_source_record(catalog_terms_path, url_catalog_terms, "INSD 2019 microdata catalogue terms capture")
)

output_paths <- c(summary_output, summary_csv_output, boundary_output)
output_hashes <- vapply(output_paths, sha256_file, character(1))
raw_hashes <- vapply(raw_sources, `[[`, character(1), "sha256")
combined <- paste(c(raw_hashes, output_hashes), collapse = "")
version_hash <- substr(digest::digest(combined, algo = "sha256", serialize = FALSE), 1L, 12L)
git_commit <- trimws(system2("git", c("rev-parse", "--short", "HEAD"), stdout = TRUE))

durable_file_record <- function(path, content, row_count = NULL, feature_count = NULL) {
  record <- list(
    uri = paste0("repo:", path),
    storage_provider = "other",
    format = sub("^.*\\.", "", path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    content = content,
    privacy = "public",
    licence_status = "needs_review"
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
  "Each 2019 category percentage is printed to one decimal and therefore carries a maximum",
  "rounding error of 0.05 percentage points (half the 0.1 print step). The six",
  "mutually exclusive categories partition the collected-person basis; their true",
  "shares sum to exactly 100.0; the printed row sum can therefore differ from 100.0",
  "by at most 0.05 x 6 = 0.30 percentage points. Five regional rows (Cascades,",
  "Centre-Est, Centre-Sud, Sahel, Sud-Ouest) sum to 99.9 or 100.1, deviating by 0.1,",
  "within the 0.30 bound. The observed maximum absolute deviation is 0.1. No",
  "percentage was altered. The bound is derived from the source's rounding and the",
  "category count, not an arbitrary tolerance (Estonia precedent)."
)

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = paste0("manifest:bf-census-religion:bf:2006-2019:", version_hash),
  dataset_id = "bf-census-religion:bf:2006-2019:insd-geoboundaries",
  dataset_version_id = paste0("bf-census-religion:bf:2006-2019:insd-geoboundaries:", version_hash),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "bf-census-religion",
  dataset_role = "public_product",
  scope = list(
    level = "country",
    country_codes = list("BF"),
    snapshot_date = NULL,
    pipeline_stage = "staged"
  ),
  created_at = stamp,
  created_by = script_id,
  pipeline = list(
    script = script_id,
    git_commit = git_commit,
    command = paste("Rscript", script_id),
    parameters = list(
      waves = list(
        list(
          year = 2006L,
          construct = "census affiliation, exact counts",
          geography = "13 regions",
          denominator = "full resident population 14,017,262",
          gate = "every-row exact reconciliation (2006 stays exact)"
        ),
        list(
          year = 2019L,
          construct = "census affiliation, published one-decimal percent shares",
          geography = "13 regions",
          denominator = paste(
            "collected-person basis 18,171,838; full resident total 20,505,155;",
            "2,333,317 residents outside the basis (estimate-represented)"
          ),
          gate = "rounded-row reconciliation within the derived 0.30 pp bound",
          counts_from_percentages = "withheld; no count derived from any percentage"
        ),
        list(
          year = 1996L,
          construct = "census affiliation, national only",
          role = "national context; predates the 13-region frame; not in the product"
        )
      ),
      derived_rounding_bound = list(
        applies_to = "2019 published one-decimal percentage rows",
        rounding_halfwidth_pp = reconciliation_2019[["rounding_halfwidth"]],
        category_count = reconciliation_2019[["category_count"]],
        bound_pp = reconciliation_2019[["derived_bound"]],
        observed_max_absolute_deviation_pp = reconciliation_2019[["max_absolute_deviation"]],
        row_deviations_pp = reconciliation_2019[["row_deviations"]],
        derivation = derived_bound_derivation
      ),
      change_metric = list(
        status = "withheld",
        rationale = paste(
          "The 2006 metric is exact counts on the full resident population; the 2019",
          "metric is rounded percentage shares on the collected-person basis. The two",
          "waves use different constructs and denominator bases; no cross-wave",
          "change is derived. 1996 religion is national only and predates the",
          "13-region frame."
        )
      ),
      category_frame_fr = as.list(category_frame[["source_label_fr"]]),
      category_display_mapping = category_mapping,
      boundary = list(
        boundary_set_id = boundary_set_id,
        source = "geoBoundaries BFA ADM1 (gbOpen), represented year 2017, CC BY 4.0",
        features = 13L,
        total_land_area_sq_km = boundary_result[["total_land_area"]],
        output_bytes = boundary_result[["output_bytes"]],
        distinct_written_geometry_hashes = boundary_result[["distinct_written_hash_count"]],
        simplification = c(
          boundary_result[["simplification"]],
          list(byte_ceiling = 3000000L, helper = "scripts/lib/simplify_boundary.R")
        ),
        source_geometry_sha256 = boundary_result[["source_geometry_sha256"]],
        written_geometry_sha256 = boundary_result[["written_geometry_sha256"]]
      ),
      reconciliation_2019_population = list(
        collected_basis_national = 18171838L,
        full_resident_national = 20505155L,
        outside_basis_national = 2333317L,
        status = "regional bases and totals reproduce the national rows exactly"
      ),
      licence_position = list(
        status = "needs_review",
        insd_legal_footer_verbatim = insd_legal_footer_verbatim,
        insd_open_data_agreement_verbatim = insd_open_data_agreement_verbatim,
        insd_catalog_terms_verbatim = insd_catalog_terms_verbatim,
        summary = insd_position,
        open_pi_followup = insd_pi_followup
      ),
      raw_sources = raw_sources,
      local_cache_hint = "data/raw/bf_census/ (git-ignored; every cached source listed with URL, bytes, and SHA-256 in pipeline.parameters.raw_sources).",
      raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/bf_census/")
    ),
    software_versions = list(
      R = paste(R.version$major, R.version$minor, sep = "."),
      sf = as.character(utils::packageVersion("sf")),
      jsonlite = as.character(utils::packageVersion("jsonlite"))
    )
  ),
  source = list(
    provider = "Institut national de la statistique et de la démographie (INSD); geoBoundaries (William & Mary geoLab)",
    source_dataset_ids = list(dataset_id_2006, dataset_id_2019, dataset_id_boundary),
    source_urls = list(url_2006, url_2019, url_boundary, url_boundary_meta, url_legal, url_catalog_terms),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = insd_position,
    citation = paste(
      "INSD RGPH 2006 (État et structure de la population, Table A5.5) and RGPH 2019",
      "(Rapport des résultats définitifs, Table 10); geoBoundaries BFA ADM1 (CC BY 4.0)."
    )
  ),
  input_manifests = list(),
  durable_files = list(
    durable_file_record(summary_output, "Burkina Faso two-wave regional area-summary JSON", row_count = 26L),
    durable_file_record(summary_csv_output, "Burkina Faso two-wave regional area-summary CSV", row_count = 26L),
    durable_file_record(boundary_output, "Burkina Faso 2017 region boundary (geoBoundaries ADM1)", feature_count = 13L)
  ),
  partitions = list(
    list(
      partition_id = "bf-region-2006",
      partition_type = "area",
      file_uri = paste0("repo:", summary_output),
      sha256 = sha256_file(summary_output),
      country_code = "BF"
    ),
    list(
      partition_id = "bf-region-2019",
      partition_type = "area",
      file_uri = paste0("repo:", summary_output),
      sha256 = sha256_file(summary_output),
      country_code = "BF"
    )
  ),
  stats = list(
    waves = 2L,
    years = "2006, 2019",
    region_rows = 26L,
    regions_per_wave = 13L,
    categories = 6L,
    boundary_features = 13L,
    derived_bound_2019_pp = reconciliation_2019[["derived_bound"]],
    max_absolute_deviation_2019_pp = reconciliation_2019[["max_absolute_deviation"]]
  ),
  local_cache_hint = "data/raw/bf_census/ (git-ignored; every cached source listed with URL, bytes, and SHA-256 in pipeline.parameters.raw_sources).",
  validation = list(
    status = "passed",
    commands = list(
      paste("Rscript", script_id),
      paste(
        "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile",
        "schemas/area-summary.schema.json", summary_output
      ),
      paste(
        "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile",
        "schemas/data-manifest.schema.json", manifest_output
      )
    ),
    warnings = list(
      paste(
        "Licence: INSD publication reuse rights are unresolved. The cached legal",
        "page reserves all rights and points to an external Open Data Agreement",
        "whose linked text was not captured; the PI follow-up stays open. The product is staged."
      ),
      paste(
        "The 2019 rows carry published one-decimal percentages; five regional rows",
        "sum to 99.9 or 100.1 within the 0.30 percentage-point derived bound. No",
        "percentage was altered and no count was derived from a percentage."
      ),
      paste(
        "The 2006 and 2019 waves use different denominator bases; the product",
        "reports no cross-wave change. 1996 religion is national context only.",
        "The 45 provincial rows stay documented-unverified and are not extracted."
      )
    ),
    notes = paste(
      "2006 exact-count rows reconcile exactly to their printed regional totals and",
      "to the national row. 2019 rows pass the derived rounding-bound gate. The",
      "boundary output has 13 valid, non-empty, distinctly hashed geometries within",
      "the 3 MB cap. Both the area-summary and the manifest pass schema validation."
    )
  ),
  privacy = "public",
  licence_status = "needs_review",
  downstream_status = "staged",
  notes = paste(
    "Regional census-affiliation product for 2006 (exact counts, full resident",
    "denominator) and 2019 (published one-decimal percent shares, collected-person",
    "basis). Cross-wave change is withheld. Staged pending INSD publication reuse",
    "resolution;", insd_pi_followup
  )
)

write_json(manifest, manifest_output, auto_unbox = TRUE, pretty = TRUE, null = "null", digits = NA)

if (!jsonlite::validate(readChar(manifest_output, file_bytes(manifest_output), useBytes = TRUE))) {
  stop("manifest output is not valid JSON", call. = FALSE)
}
validate_json_schema("schemas/data-manifest.schema.json", manifest_output)

message(
  "built Burkina Faso regional census-affiliation product: ", length(all_rows),
  " rows across 2006 and 2019; boundary ", boundary_result[["output_bytes"]],
  " bytes; 2019 derived bound ", reconciliation_2019[["derived_bound"]],
  " pp, observed max deviation ", reconciliation_2019[["max_absolute_deviation"]], " pp; staged (needs_review)."
)
