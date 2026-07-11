# build the Cambodia census-religion province product from the NIS 2019 report.
#
# inputs (git-ignored, under data/raw/kh_census/; SHA-256s recorded in
# research/countries/kh/route-probe.md):
#   gpc2019_final_en.pdf   NIS General Population Census of Cambodia 2019, final
#                          report; Table 2.5.1 "Percentage distribution of
#                          population by religion, area, and province, 2008-2019".
#   priority_tables_A-H.xlsx  2019 priority-table workbook; Table A4 national
#                          religion counts (the count anchor for the national row).
#   gb_khm_adm1.geojson    geoBoundaries KHM ADM1 (25 provinces), ODbL 1.0.
#   gb_khm_adm1_meta.json  release metadata (licence record).
# outputs:
#   apps/regions/kh/data/kh_province_2017.geojson  simplified province boundary
#   apps/regions/kh/data/area_summary_province.{json,csv}
#   docs/manifests/kh-census-religion-2008-2019.json
# run from the repository root: Rscript scripts/build_kh_area_summary.R
#
# gate design. Table 2.5.1 publishes one-decimal percentages for four religion
# categories (Buddhist, Muslims, Christians, Other) by province, for 2008 and
# 2019, on the current 25-province frame. NIS re-bases the four categories to
# 100 percent (the "Not Stated" column of the count table is excluded); the
# printed footnote asserts "The sum of the four religion categories amounts to
# 100 percent". The true (unrounded) shares therefore sum to exactly 100.0; the
# printed one-decimal cells carry rounding and a k-category row sum may deviate
# from 100.0 by at most 0.05 * k percentage points. this is the Burkina Faso /
# Estonia derived-rounding-bound situation (PI, 2026-07-10: bounds derived from
# the source's own rounding, never arbitrary tolerances). with k = 4 categories
# the bound is 0.20 percentage points; every transcribed row deviates by at most
# 0.1 and passes. no percentage is altered and every per-row deviation is
# recorded. the national row is separately anchored to the Table A4 count-derived
# re-based percentages (97.1/2.0/0.3/0.5), whose five categories sum to
# 15,552,211 exactly. any gate failure stops the build before a product is
# written.
#
# metric slots follow the ratified two-slot minority-share design
# (docs/development/minority-share-metric.md, PI task 6, 2026-07-11). the
# four-category frame is re-based to 100 and carries no non-affiliation category,
# so the two legacy slots carry declared constructs: religious_affiliation_percent
# is the Buddhist (reference-group) share -- Buddhist is the largest published
# category nationally in 2019 at 97.1 percent, declared once and held constant --
# and no_religion_percent is the minority share, the exact complement (the summed
# Muslims/Christians/Other share), not a measure of no religion. the two slots sum
# to 100.0 in every row. religious_change now differences the Buddhist share across
# 2008-2019, computable on the shared frame for 23 provinces but withheld for
# Mondul Kiri and Ratanak Kiri, whose large "Other" (highland indigenous) share
# shifts the report attributes to reclassification. licence_status is accepted:
# NIS asserts bare all-rights-reserved copyright (the Cote d'Ivoire / Iran
# situation), and the project lead confirmed on 2026-07-11 (PI task 9) that the
# derived-summaries-with-attribution ruling extends to Cambodia, so the derived
# summaries ship with NIS attribution and the raw PDF/workbook stay git-ignored.

suppressMessages({
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

raw_dir <- "data/raw/kh_census"
output_dir <- "apps/regions/kh/data"
manifest_dir <- "docs/manifests"

retrieval_date <- "2026-07-11"
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
script_id <- "scripts/build_kh_area_summary.R"
country_code <- "KH"

pdf_2019 <- file.path(raw_dir, "gpc2019_final_en.pdf")
workbook_2019 <- file.path(raw_dir, "priority_tables_A-H.xlsx")
boundary_path <- file.path(raw_dir, "gb_khm_adm1.geojson")
boundary_meta_path <- file.path(raw_dir, "gb_khm_adm1_meta.json")

# source urls (retrieved 2026-07-11; see route-probe.md for the sha-256 record).
url_2019 <- "https://nis.gov.kh/wp-content/uploads/2025/09/Final-General-Population-Census-2019-English.pdf"
url_workbook <- "https://nis.gov.kh/wp-content/uploads/2025/09/Final-Priority-Tables-A-H.xlsx"
url_boundary <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/KHM/ADM1/geoBoundaries-KHM-ADM1.geojson"
url_boundary_meta <- "https://www.geoboundaries.org/api/current/gbOpen/KHM/ADM1/"
url_nis <- "https://nis.gov.kh/"

boundary_set_id <- "kh-province-2017-geoboundaries-adm1"
boundary_level <- "province"
boundary_output <- file.path(output_dir, "kh_province_2017.geojson")
summary_output <- file.path(output_dir, "area_summary_province.json")
summary_csv_output <- file.path(output_dir, "area_summary_province.csv")
manifest_output <- file.path(manifest_dir, "kh-census-religion-2008-2019.json")

dataset_id_census <- "nis-gpc-2019-table-2-5-1-religion-province"
dataset_id_anchor <- "nis-gpc-2019-priority-table-a4-religion-national"
dataset_id_boundary <- "geoboundaries-khm-adm1-2017"

waves <- c(2008L, 2019L)

# verbatim category labels as printed in Table 2.5.1. the 2008 and 2019 column
# heads differ by one letter (Christians vs Christian); both are recorded as
# printed and never merged. the internal keys are stable across waves.
category_keys <- c("bud", "mus", "chr", "oth")
category_labels_verbatim <- list(
  `2008` = c(bud = "Buddhist", mus = "Muslims", chr = "Christians", oth = "Other"),
  `2019` = c(bud = "Buddhist", mus = "Muslims", chr = "Christian",  oth = "Other")
)
# the Table A4 count-anchor frame (five categories, distinct label set). recorded
# as the count-anchor frame, never applied to the Table 2.5.1 source fields.
a4_labels <- c("Buddhism", "Islam", "Christianity", "Other", "Not Stated")

# Table A4 national religion counts (2019 de facto population). these anchor the
# national row and its re-basing; the five categories sum to the total exactly.
a4_counts <- c(
  Buddhism = 15096757L, Islam = 317649L, Christianity = 49160L,
  Other = 85443L, `Not Stated` = 3202L
)
a4_total <- 15552211L
# the national row printed in Table 2.5.1 (2019), the re-basing target.
national_2019_printed <- c(bud = 97.1, mus = 2.0, chr = 0.3, oth = 0.5)

# reference group for the two-slot minority-share design (minority-share-metric.md,
# ratified 2026-07-11 / PI task 6). Buddhist is the product's largest published
# category at the national level in the most recent wave (2019: 97.1 percent),
# declared once and held constant across every wave and area.
# religious_affiliation_percent carries the Buddhist share; no_religion_percent
# carries the minority share (the exact complement, the summed Muslims/Christians/
# Other share). the reference share is never a measure of affiliation versus
# non-affiliation, and the minority share is arithmetic on published categories,
# never a measure of no religion, belief, practice, or secularity.
reference_group_key <- "bud"
reference_group_label <- "Buddhist"
reference_group_national_2019_share <- unname(national_2019_printed[["bud"]])

# provinces whose 2008-2019 change is withheld: the report attributes their large
# "Other" (highland indigenous) share shifts to reclassification.
change_withheld_provinces <- c("Mondul Kiri", "Ratanak Kiri")

# verbatim NIS reuse position (route-probe.md). the site footer asserts bare
# all-rights-reserved copyright; no permissive licence exists.
nis_footer_khmer <- "© 2025 វិទ្យាស្ថានជាតិស្ថិតិ ក្រសួងផែនការ នៃរាជរដ្ឋាភិបាលកម្ពុជា។ រក្សាសិទ្ធគ្រប់យ៉ាង។"
nis_footer_en <- "(c) 2025 National Institute of Statistics, Ministry of Planning of the Royal Government of Cambodia. All rights reserved."
nis_position <- paste(
  "NIS asserts bare all-rights-reserved copyright with no permissive licence.",
  "The NIS website footer (https://nis.gov.kh/) states, verbatim,",
  paste0("“", nis_footer_khmer, "” (“", nis_footer_en, "”);"),
  "the closing phrase is “all rights reserved”. This is the Cote d'Ivoire /",
  "Iran situation: under the ratified precedent (PI, 2026-07-10/11) derived",
  "category summaries, not the raw source tables, may publish with NIS / Ministry",
  "of Planning attribution under PI approval, with the raw PDF and workbook staying",
  "git-ignored. The project lead confirmed that ruling for Cambodia on 2026-07-11",
  "(PI task 9); the derived summaries ship with NIS / Ministry of Planning attribution."
)
page_gate_position <- paste(
  "Under the ratified two-slot minority-share design (minority-share-metric.md, PI",
  "task 6, 2026-07-11) the shared religious_affiliation_percent slot carries the",
  "Buddhist (reference-group) share and no_religion_percent carries the minority",
  "share (the exact complement, the summed Muslims/Christians/Other share). Each page",
  "relabels the two slots verbatim via metricLabels: the affiliation slot as",
  "“Buddhist (%)” and the no-religion slot as “Minority share (%)”, with the note",
  "“share outside Cambodia's largest published category, Buddhist”. The flat-100",
  "presentation gate is resolved; both slots now carry declared constructs."
)

# stop when a required cached source is absent.
require_file <- function(path) {
  if (!file.exists(path)) stop("missing required source: ", path, call. = FALSE)
}

# compute the sha-256 digest for a local file.
sha256_file <- function(path) unname(tools::sha256sum(path))

# return file size in bytes for validation and manifest records.
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))

# turn a province name into a stable lowercase hyphenated area code (join key).
slugify <- function(value) {
  slug <- tolower(trimws(value))
  slug <- gsub("[^a-z0-9]+", "-", slug)
  gsub("^-|-$", "", slug)
}

# format a one-decimal source percentage for a verbatim pdf presence assertion.
source_percent <- function(value) sprintf("%.1f", value)

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

# validate a generated json product against a repository schema with check-jsonschema.
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

# Table 2.5.1 verbatim: source_name and the eight one-decimal percentage cells
# (four categories x two waves), in printed row order. Total/Urban/Rural precede
# the 25 provinces and are used for reconciliation, not as product rows.
table_2_5_1 <- function() {
  data.frame(
    source_name = c(
      "Total", "Urban", "Rural",
      "Banteay Meanchey", "Battambang", "Kampong Cham", "Kampong Chhnang",
      "Kampong Speu", "Kampong Thom", "Kampot", "Kandal", "Koh Kong", "Kratie",
      "Mondul Kiri", "Phnom Penh", "Preah Vihear", "Prey Veng", "Pursat",
      "Ratanak Kiri", "Siem Reap", "Preah Sihanouk", "Stung Treng", "Svay Rieng",
      "Takeo", "Otdar Meanchey", "Kep", "Pailin", "Tbong Khmum"
    ),
    bud2008 = c(96.9, 97.4, 96.8, 99.2, 98.3, 97.6, 94.7, 99.7, 99.0, 97.1, 98.0, 95.2, 94.0, 54.7, 97.5, 99.4, 99.5, 97.4, 49.3, 99.7, 94.5, 96.1, 99.7, 99.1, 99.8, 98.7, 99.1, 88.9),
    mus2008 = c( 1.9,  1.6,  2.0,  0.5,  1.3,  2.3,  4.2,  0.1,  0.6,  2.7,  1.2,  4.6,  5.6,  5.5,  1.5,  0.3,  0.1,  2.4,  1.3,  0.2,  4.7,  1.3,  0.1,  0.7,  0.1,  1.2,  0.7, 11.0),
    chr2008 = c( 0.4,  0.8,  0.3,  0.3,  0.3,  0.1,  0.4,  0.2,  0.4,  0.2,  0.7,  0.2,  0.4,  4.4,  0.8,  0.3,  0.2,  0.2,  2.3,  0.1,  0.7,  0.4,  0.2,  0.2,  0.1,  0.0,  0.2,  0.1),
    oth2008 = c( 0.8,  0.2,  0.9,  0.0,  0.0,  0.0,  0.7,  0.0,  0.0,  0.0,  0.1,  0.0,  0.1, 35.5,  0.1,  0.0,  0.1,  0.0, 47.2,  0.0,  0.1,  2.2,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0),
    bud2019 = c(97.1, 97.7, 96.7, 99.3, 98.3, 97.6, 93.1, 99.8, 98.6, 96.9, 98.3, 95.1, 93.1, 70.4, 97.8, 99.1, 99.5, 96.9, 73.4, 99.3, 96.2, 93.6, 99.8, 99.2, 99.5, 97.5, 98.3, 88.1),
    mus2019 = c( 2.0,  1.6,  2.3,  0.4,  1.4,  2.3,  5.8,  0.1,  1.0,  2.8,  1.2,  4.6,  6.6,  4.4,  1.6,  0.5,  0.2,  3.0,  1.3,  0.2,  3.6,  4.7,  0.1,  0.6,  0.2,  1.7,  1.0, 11.8),
    chr2019 = c( 0.3,  0.4,  0.2,  0.2,  0.3,  0.1,  0.3,  0.1,  0.3,  0.2,  0.4,  0.2,  0.2,  4.0,  0.5,  0.3,  0.3,  0.1,  2.1,  0.4,  0.2,  0.4,  0.1,  0.1,  0.3,  0.7,  0.7,  0.1),
    oth2019 = c( 0.5,  0.2,  0.8,  0.0,  0.0,  0.0,  0.9,  0.0,  0.0,  0.0,  0.1,  0.0,  0.1, 21.2,  0.1,  0.0,  0.0,  0.0, 23.2,  0.1,  0.0,  1.3,  0.1,  0.0,  0.0,  0.1,  0.0,  0.0),
    stringsAsFactors = FALSE
  )
}

# census province name -> geoBoundaries shapeName. maps only spelling differences
# and invents no geography; the other 21 names match verbatim.
name_concordance <- c(
  "Banteay Meanchey" = "Bantey Meanchey",
  "Mondul Kiri" = "Mondulkiri",
  "Otdar Meanchey" = "Oddar Meanchey",
  "Ratanak Kiri" = "Ratanakiri Province"
)

# stop unless every row's four printed cells sum to 100.0 within the bound derived
# from the source's own one-decimal rounding. returns the per-row deviations.
#
# derivation: each printed percentage carries a maximum rounding error of
# rounding_halfwidth = 0.05 percentage points (half the 0.1 print step). the four
# mutually exclusive categories partition the re-based basis, so their true shares
# sum to exactly 100.0; the printed row sum can therefore differ from 100.0 by at
# most rounding_halfwidth * k. with k = 4 the bound is 0.20 percentage points. the
# bound is a function of the source's rounding and the category count, never an
# arbitrary tolerance.
assert_row_reconciliation <- function(rows, wave, rounding_halfwidth = 0.05) {
  cols <- paste0(category_keys, wave)
  k <- length(category_keys)
  bound <- rounding_halfwidth * k
  calculated <- rowSums(rows[, cols, drop = FALSE])
  difference <- round(calculated - 100.0, 6)
  exceeded <- which(abs(difference) > bound + 1e-9)
  if (length(exceeded) > 0L) {
    details <- paste0(
      rows[["source_name"]][exceeded], " (category sum=", sprintf("%.1f", calculated[exceeded]),
      ", |difference|=", sprintf("%.1f", abs(difference[exceeded])),
      " > derived bound=", sprintf("%.2f", bound), ")"
    )
    stop(
      wave, " row reconciliation exceeded the derived bound: ", paste(details, collapse = "; "),
      ". no percentage was altered; product writing stopped.", call. = FALSE
    )
  }
  list(
    wave = wave,
    category_count = k,
    rounding_halfwidth = rounding_halfwidth,
    derived_bound = bound,
    max_absolute_deviation = as.numeric(max(abs(difference))),
    row_deviations = setNames(as.list(round(difference, 1) + 0), rows[["source_name"]])
  )
}

# stop unless the Table A4 five categories sum to the printed total and their
# re-based (ex-"Not Stated") one-decimal percentages reproduce the national row.
assert_national_anchor <- function() {
  if (sum(a4_counts) != a4_total) {
    stop("Table A4 categories do not sum to ", a4_total, call. = FALSE)
  }
  rebased_basis <- a4_total - a4_counts[["Not Stated"]]
  rebased <- c(
    bud = a4_counts[["Buddhism"]], mus = a4_counts[["Islam"]],
    chr = a4_counts[["Christianity"]], oth = a4_counts[["Other"]]
  ) / rebased_basis * 100
  rebased_1dp <- round(rebased, 1)
  if (!isTRUE(all.equal(unname(rebased_1dp[category_keys]),
                        unname(national_2019_printed[category_keys])))) {
    stop("Table A4 re-based percentages do not match the Table 2.5.1 national row", call. = FALSE)
  }
  list(
    a4_total = a4_total,
    a4_sum_check = sum(a4_counts),
    rebased_basis = as.integer(rebased_basis),
    rebased_percent = setNames(as.list(round(unname(rebased[category_keys]), 4)), category_keys),
    rebased_percent_1dp = setNames(as.list(unname(rebased_1dp[category_keys])), category_keys),
    national_row_printed = as.list(national_2019_printed)
  )
}

# require the cached 2019 pdf text to contain every transcribed row verbatim
# (source_name followed by its eight one-decimal cells in printed order).
assert_transcription_present <- function(source_text, rows) {
  value_cols <- c(paste0(category_keys, "2008"), paste0(category_keys, "2019"))
  for (i in seq_len(nrow(rows))) {
    pieces <- c(
      rows[["source_name"]][i],
      vapply(rows[i, value_cols, drop = FALSE], source_percent, character(1))
    )
    pattern <- paste(vapply(pieces, function(x) {
      gsub(" ", "[[:space:]]+", gsub("([.\\\\])", "\\\\\\1", x), fixed = TRUE)
    }, character(1)), collapse = "[[:space:]]+")
    if (!grepl(pattern, source_text, perl = TRUE)) {
      stop("transcribed row not found in pdftotext output: ", rows[["source_name"]][i], call. = FALSE)
    }
  }
  invisible(TRUE)
}

# validate, label, simplify and write the 25-feature boundary; return the written
# layer, geodesic land areas by area code, and geometry-validation detail.
build_boundary <- function(province_names) {
  boundary <- st_read(boundary_path, quiet = TRUE)
  if (nrow(boundary) != 25L) stop("expected 25 geoBoundaries ADM1 features", call. = FALSE)
  boundary <- st_make_valid(boundary)
  validity <- st_is_valid(boundary)
  if (any(st_is_empty(boundary)) || any(is.na(validity)) || any(!validity)) {
    stop("source boundary contains empty or invalid geometries", call. = FALSE)
  }
  source_hashes <- vapply(st_as_binary(st_geometry(boundary), EWKB = TRUE), digest::digest,
                          character(1), algo = "sha256", serialize = FALSE)
  if (anyDuplicated(source_hashes)) stop("source boundary contains duplicate geometries", call. = FALSE)

  # map each census province name to its geoBoundaries shapeName and assert 25:25.
  boundary_for_census <- ifelse(province_names %in% names(name_concordance),
                                name_concordance[province_names], province_names)
  missing <- setdiff(boundary_for_census, boundary[["shapeName"]])
  extra <- setdiff(boundary[["shapeName"]], boundary_for_census)
  if (length(missing) || length(extra) || nrow(boundary) != 25L) {
    stop("boundary-census join is not exactly 25:25 (missing: ",
         paste(missing, collapse = ", "), "; extra: ", paste(extra, collapse = ", "), ")",
         call. = FALSE)
  }

  lookup <- data.frame(
    shapeName = boundary_for_census,
    area_code = slugify(province_names),
    area_name = province_names,
    stringsAsFactors = FALSE
  )
  idx <- match(boundary[["shapeName"]], lookup$shapeName)
  boundary[["area_code"]] <- lookup$area_code[idx]
  boundary[["area_name"]] <- lookup$area_name[idx]
  boundary[["area_unit_id"]] <- paste0(boundary_set_id, ":", boundary[["area_code"]])
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- boundary_level
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
  if (nrow(written) != 25L || any(st_is_empty(written)) || any(!written_validity) ||
      anyDuplicated(written_hashes) || file.info(boundary_output)[["size"]] > 3000000L) {
    stop("simplified boundary failed feature, validity, distinctness, or byte-cap gate", call. = FALSE)
  }
  # s2 geodesic area on the geographic crs; appropriate for the cambodian extent.
  land_area <- as.numeric(st_area(written)) / 1e6
  land_area_by_code <- setNames(round(land_area, 4), written[["area_code"]])
  # sanity band: cambodia is about 181,000 km2; catch a crs or unit mistake.
  if (sum(land_area) < 170000 || sum(land_area) > 195000) {
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

# flatten area-summary rows into the repository csv companion shape.
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
      population_total = NA_integer_,
      population_total_basis = row$population_total_basis,
      religious_affiliation_count = NA_integer_,
      religious_affiliation_percent = row$religious_affiliation_percent,
      no_religion_count = NA_integer_,
      no_religion_percent = row$no_religion_percent,
      place_count = NA_integer_,
      places_per_10000_residents = NA_real_,
      place_density_per_sq_km = NA_real_,
      land_area_sq_km = row$land_area_sq_km,
      site_snapshot_date = NA_character_,
      place_count_basis = NA_character_,
      source_dataset_ids = paste(unlist(row$source_dataset_ids), collapse = "|"),
      quality_flag = row$quality_flag,
      stringsAsFactors = FALSE
    )
  }))
}

# ---- run gates -------------------------------------------------------------

for (path in c(pdf_2019, workbook_2019, boundary_path, boundary_meta_path)) {
  require_file(path)
}

full_table <- table_2_5_1()
province_rows <- full_table[!(full_table[["source_name"]] %in% c("Total", "Urban", "Rural")), , drop = FALSE]
context_rows <- full_table[full_table[["source_name"]] %in% c("Total", "Urban", "Rural"), , drop = FALSE]
if (nrow(province_rows) != 25L) stop("expected 25 province rows", call. = FALSE)

# transcription presence: every row (context + province) must appear verbatim.
pdf_text <- paste(pdf_layout_lines(pdf_2019), collapse = "\n")
pdf_text <- gsub("[[:space:]]+", " ", pdf_text)
assert_transcription_present(pdf_text, full_table)

# every-row rounded reconciliation within the derived 0.20 pp bound, per wave.
reconciliation <- list(
  `2008` = assert_row_reconciliation(province_rows, "2008"),
  `2019` = assert_row_reconciliation(province_rows, "2019")
)
# context rows (Total/Urban/Rural) reconcile under the same bound.
context_reconciliation <- list(
  `2008` = assert_row_reconciliation(context_rows, "2008"),
  `2019` = assert_row_reconciliation(context_rows, "2019")
)
national_anchor <- assert_national_anchor()

boundary_result <- build_boundary(province_rows[["source_name"]])
land_area_by_code <- boundary_result[["land_area_by_code"]]

# ---- construct product rows ------------------------------------------------

population_total_basis <- paste(
  "No source publishes religion counts or a total population by province for either",
  "wave; Table 2.5.1 publishes one-decimal percentage shares only. population_total,",
  "the per-category counts, religious_affiliation_count and no_religion_count are",
  "therefore null and no count is derived from any percentage. The four categories",
  "are re-based to 100 percent (the count table's “Not Stated” column is excluded).",
  "Under the two-slot minority-share design religious_affiliation_percent carries the",
  "Buddhist (reference-group) share and no_religion_percent carries the minority share",
  "(the exact complement, the summed Muslims/Christians/Other share); the per-category",
  "composition is carried verbatim in quality_flag."
)

# assemble one schema-shaped row for a province and wave.
build_row <- function(province, wave) {
  code <- slugify(province)
  row <- province_rows[province_rows[["source_name"]] == province, , drop = FALSE]
  cols <- paste0(category_keys, wave)
  values <- unlist(row[, cols], use.names = FALSE)
  labels <- category_labels_verbatim[[as.character(wave)]]
  composition <- paste(
    sprintf("%s=%.1f", labels[category_keys], values), collapse = "|"
  )
  row_sum <- round(sum(values), 1)
  # two-slot minority-share re-emit. the reference share is the printed Buddhist
  # cell; the minority share is its exact one-decimal complement (100 minus the
  # Buddhist share), equal at the source's rounding to the summed Muslims/
  # Christians/Other share. the two partition the re-based frame and sum to 100.0.
  reference_share <- values[match(reference_group_key, category_keys)]
  minority_share <- round(100 - reference_share, 1)
  change_token <- if (province %in% change_withheld_provinces) {
    "change_withheld_reclassification_highland_other_share"
  } else {
    "change_computable_2008_2019"
  }
  flags <- paste(
    "census_religion_distribution",
    "frame_rebased_to_100_four_categories",
    "reference_group_buddhist_largest_published_category",
    "religious_affiliation_percent_is_buddhist_reference_share",
    "no_religion_percent_is_minority_share_exact_complement",
    "minority_share_arithmetic_on_published_categories_not_no_religion",
    "not_stated_excluded_from_rebased_frame",
    paste0("composition_", wave, ":", composition),
    paste0("buddhist_share=", sprintf("%.1f", reference_share)),
    paste0("minority_share=", sprintf("%.1f", minority_share)),
    paste0("printed_row_sum=", sprintf("%.1f", row_sum)),
    "row_sum_within_derived_bound_0.20pp",
    "boundary_2017_geoboundaries_odbl",
    change_token,
    sep = ";"
  )
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = paste0(boundary_set_id, ":", code),
    area_code = code,
    area_name = province,
    year = as.integer(wave),
    population_total = NULL,
    population_total_basis = population_total_basis,
    religious_affiliation_count = NULL,
    religious_affiliation_percent = reference_share,
    no_religion_count = NULL,
    no_religion_percent = minority_share,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = unname(land_area_by_code[[code]]),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(dataset_id_census, dataset_id_anchor, dataset_id_boundary),
    quality_flag = flags
  )
}

# rows in (area_code, year) order for a stable product.
ordered_provinces <- province_rows[["source_name"]][order(slugify(province_rows[["source_name"]]))]
all_rows <- unlist(
  lapply(ordered_provinces, function(p) lapply(waves, function(w) build_row(p, w))),
  recursive = FALSE
)
if (length(all_rows) != 50L) stop("expected 50 province-wave rows (25 x 2)", call. = FALSE)

# ---- two-slot minority-share gates -----------------------------------------

# exact-complement gate: the two re-emitted slots partition the re-based frame, so
# religious_affiliation_percent (Buddhist share) + no_religion_percent (minority
# share) must equal 100.0 exactly in every row.
complement_deviations <- vapply(all_rows, function(r) {
  round((r[["religious_affiliation_percent"]] + r[["no_religion_percent"]]) - 100, 6)
}, numeric(1))
complement_max_deviation <- max(abs(complement_deviations))
if (complement_max_deviation > 1e-9) {
  stop("two-slot exact-complement gate failed: Buddhist share + minority share != 100.0 in ",
       sum(abs(complement_deviations) > 1e-9), " rows; product writing stopped.", call. = FALSE)
}

# national reference-share gate: the reference group is the largest published
# category nationally in the most recent wave, and its share must reproduce 97.1 at
# the printed rounding (Table A4 counts re-based, matching the Table 2.5.1 national
# row). anchors the declared reference group to the source evidence.
if (!isTRUE(all.equal(reference_group_national_2019_share, 97.1)) ||
    !isTRUE(all.equal(national_anchor[["rebased_percent_1dp"]][[reference_group_key]], 97.1))) {
  stop("national 2019 Buddhist reference share does not reproduce 97.1; product writing stopped.",
       call. = FALSE)
}

# ---- source datasets, indicators, visual layers ----------------------------

source_datasets <- list(
  list(
    source_dataset_id = dataset_id_census,
    name = "NIS General Population Census of Cambodia 2019, final report, Table 2.5.1: percentage distribution of population by religion, area and province, 2008-2019",
    provider = "National Institute of Statistics (NIS), Ministry of Planning, Royal Government of Cambodia",
    url = url_2019,
    retrieval_date = retrieval_date,
    local_path = pdf_2019,
    licence = list(
      name = "NIS all-rights-reserved; derived summaries ship with attribution (PI task 9, 2026-07-11)",
      url = url_nis,
      attribution = "National Institute of Statistics, Ministry of Planning, Cambodia"
    ),
    citation = "National Institute of Statistics, Ministry of Planning, General Population Census of Cambodia 2019: Final Report, Table 2.5.1.",
    access_limits = "Open web PDF hosted by NIS.",
    redistribution_limits = nis_position,
    notes = paste(
      "Table 2.5.1 prints one-decimal percentages for four religion categories",
      "(2008 heads: Buddhist, Muslims, Christians, Other; 2019 heads: Buddhist,",
      "Muslims, Christian, Other) by province for 2008 and 2019 on the current",
      "25-province frame. The 2008 block is NIS's own retabulation onto the current",
      "frame, with Tbong Khmum (created 2013) shown separately. No source publishes",
      "religion counts by province; percentages only are extracted."
    )
  ),
  list(
    source_dataset_id = dataset_id_anchor,
    name = "NIS General Population Census of Cambodia 2019, priority-table workbook, Table A4: de facto population by religion (national counts)",
    provider = "National Institute of Statistics (NIS), Ministry of Planning, Royal Government of Cambodia",
    url = url_workbook,
    retrieval_date = retrieval_date,
    local_path = workbook_2019,
    licence = list(
      name = "NIS all-rights-reserved; derived summaries ship with attribution (PI task 9, 2026-07-11)",
      url = url_nis,
      attribution = "National Institute of Statistics, Ministry of Planning, Cambodia"
    ),
    citation = "National Institute of Statistics, Ministry of Planning, General Population Census of Cambodia 2019: Final Priority Tables A-H, Table A4.",
    access_limits = "Open web XLSX hosted by NIS.",
    redistribution_limits = nis_position,
    notes = paste(
      "Table A4 national counts (Buddhism 15,096,757; Islam 317,649; Christianity",
      "49,160; Other 85,443; Not Stated 3,202) sum to 15,552,211 exactly. Re-based",
      "to exclude Not Stated (basis 15,549,009), the four categories round to",
      "97.1/2.0/0.3/0.5, matching the Table 2.5.1 national row. Used as the national",
      "count anchor; its five-category label set (Buddhism, Islam, Christianity,",
      "Other, Not Stated) is the count-anchor frame and is not applied to the Table",
      "2.5.1 source fields."
    )
  ),
  list(
    source_dataset_id = dataset_id_boundary,
    name = "geoBoundaries Cambodia ADM1 (25 provinces, represented year 2017)",
    provider = "geoBoundaries (William & Mary geoLab); source OpenStreetMap, Wambacher",
    url = url_boundary,
    retrieval_date = retrieval_date,
    local_path = boundary_path,
    licence = list(
      name = "Open Data Commons Open Database License 1.0 (ODbL); share-alike with attribution",
      url = "https://opendatacommons.org/licenses/odbl/1-0/",
      attribution = "geoBoundaries (gbOpen) KHM ADM1; boundary ID KHM-ADM1-37992800; source OpenStreetMap contributors, Wambacher"
    ),
    citation = "Runfola, D. et al. (2020) geoBoundaries: A global database of political administrative boundaries. gbOpen KHM ADM1 (pinned commit 9469f09).",
    access_limits = NULL,
    redistribution_limits = "ODbL 1.0 is a share-alike open licence: the derived boundary layer carries attribution and share-alike (Ghana / Malaysia OSM-ODbL precedent).",
    notes = "25 ADM1 provinces; release metadata records boundary ID KHM-ADM1-37992800, represented year 2017 (after the 2013 Tboung Khmum split), ODbL 1.0, source OpenStreetMap/Wambacher."
  )
)

spatial_note <- "Twenty-five ADM1 provinces on the geoBoundaries 2017 boundary, shared by both census waves (2008 retabulated onto the same 25-province frame)."
# declared reference group and its evidence, carried on the indicators block per
# the two-slot minority-share design.
reference_declaration <- paste(
  "Two-slot minority-share design (minority-share-metric.md, ratified 2026-07-11, PI",
  "task 6). The reference group is Buddhist, the product's largest published category",
  "at the national level in the most recent wave (2019: 97.1 percent, from the Table",
  "A4 counts re-based to exclude Not Stated, reproducing the Table 2.5.1 national",
  "row), declared once and held constant across every wave and area."
)
indicators <- list(
  list(
    indicator_id = "religious_affiliation_percent",
    label = "Buddhist (%)",
    description = paste(
      "The Buddhist (reference-group) share: the share of the re-based four-category",
      "frame reporting Buddhist, relabelled verbatim on the page as “Buddhist (%)”. This",
      "slot names the reference group and carries its share of the frame; it is never a",
      "measure of affiliation versus non-affiliation."
    ),
    unit = "percent",
    denominator_indicator_id = NULL,
    method = paste(
      reference_declaration,
      "This slot carries that reference group's share of the frame in each province and",
      "wave (the printed Table 2.5.1 Buddhist cell). National 2019 reference share: 97.1."
    ),
    temporal_coverage = "2008, 2019",
    spatial_coverage = spatial_note,
    quality_notes = paste(
      "Printed one-decimal cells; the four categories sum to 99.9-100.1 by rounding,",
      "within the derived 0.20 pp bound, and no percentage is altered. The Buddhist share",
      "is the exact complement of the minority share carried in no_religion_percent; the",
      "two sum to 100.0 in every row."
    )
  ),
  list(
    indicator_id = "no_religion_percent",
    label = "Minority share (%)",
    description = paste(
      "The minority share: the summed share of every published category outside the",
      "reference group (Muslims, Christians, Other). Relabelled verbatim on the page as",
      "“Minority share (%)”, with the note “share outside Cambodia's largest published",
      "category, Buddhist”. It reuses the no_religion_percent slot and is not a measure",
      "of no religion."
    ),
    unit = "percent",
    denominator_indicator_id = NULL,
    method = paste(
      "Arithmetic on published affiliation categories: the exact complement of the",
      "Buddhist reference share (100 minus the Buddhist share), equal at the source's",
      "one-decimal rounding to the summed Muslims/Christians/Other share. It is not a",
      "measure of no religion, belief, practice, or secularity."
    ),
    temporal_coverage = "2008, 2019",
    spatial_coverage = spatial_note,
    quality_notes = paste(
      "Reuses the no_religion_percent slot for the minority-share construct (the Israel",
      "two-slot precedent); the re-based frame has no no-religion category. Highest where",
      "the map is most informative (2019: Mondul Kiri 29.6, Ratanak Kiri 26.6, Tbong Khmum 11.9)."
    )
  ),
  list(
    indicator_id = "religious_change",
    label = "Change in the Buddhist share, 2008-2019",
    description = "Cross-wave change in the Buddhist (reference-group) share on the shared 25-province frame.",
    unit = "percent_point",
    denominator_indicator_id = NULL,
    method = paste(
      "Difference of the 2008 and 2019 Buddhist reference share (carried in",
      "religious_affiliation_percent and in each row's quality_flag composition) on the",
      "shared re-based frame. Withheld for Mondul Kiri and Ratanak Kiri, whose large",
      "Other (highland indigenous) share shifts the 2019 report attributes to",
      "reclassification; those rows carry change_withheld_reclassification_highland_other_share."
    ),
    temporal_coverage = "2008, 2019",
    spatial_coverage = spatial_note,
    quality_notes = "The reference share varies across waves, so headline change is a real quantity (the change in the largest group's share), differenced for 23 provinces and withheld for the two highland provinces."
  )
)

visual_layers <- list(
  list(
    visual_layer_id = "kh-province-buddhist-share",
    label = "Buddhist (%)",
    description = "Buddhist (reference-group) share by province, 2008 and 2019 (NIS 2019 census Table 2.5.1).",
    layer_type = "choropleth",
    indicator_ids = list("religious_affiliation_percent"),
    geometry_unit_type = "area_unit",
    legend = NULL,
    colour_scale = "shared sequential",
    time_control = "year_selector",
    aggregation_rule = "published province value on the shared 2017 boundary",
    uncertainty_display = "quality_flag",
    default_visibility = TRUE,
    notes = paste(
      "The religious_affiliation_percent slot carries the Buddhist reference-group share",
      "(minority-share design); the page relabels it verbatim as “Buddhist (%)”. It is the",
      "exact complement of the minority-share layer."
    )
  ),
  list(
    visual_layer_id = "kh-province-minority-share",
    label = "Minority share (%)",
    description = "Minority share by province (share outside Cambodia's largest published category, Buddhist), 2008 and 2019.",
    layer_type = "choropleth",
    indicator_ids = list("no_religion_percent"),
    geometry_unit_type = "area_unit",
    legend = NULL,
    colour_scale = "shared sequential",
    time_control = "year_selector",
    aggregation_rule = "published province value on the shared 2017 boundary",
    uncertainty_display = "quality_flag",
    default_visibility = FALSE,
    notes = paste(
      "The no_religion_percent slot carries the minority share (the summed Muslims/",
      "Christians/Other share, the exact complement of the Buddhist share); the page",
      "relabels it verbatim as “Minority share (%)”. It is not a measure of no religion.",
      "Highest where the map is most informative (2019: Mondul Kiri 29.6, Ratanak Kiri 26.6, Tbong Khmum 11.9)."
    )
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
    level = boundary_level,
    vintage = "geoBoundaries ADM1 represented year 2017; shared by both census waves",
    source_dataset_id = dataset_id_boundary
  ),
  site_snapshot = list(
    source_dataset_id = NULL,
    snapshot_date = NULL,
    basis = "no governed Cambodia place-of-worship snapshot is included in this census-religion release",
    notes = "The Cambodia lane ships census religion-distribution metrics only."
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

raw_source_record <- function(path, url, content, source_dataset_id, used = TRUE) {
  list(
    uri = path,
    url = url,
    format = sub("^.*\\.", "", path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    source_dataset_id = source_dataset_id,
    used_in_public_product = used,
    content = content,
    retrieval_date = retrieval_date,
    local_cache_hint = paste0(path, " (git-ignored)"),
    raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/kh_census/")
  )
}
raw_sources <- list(
  raw_source_record(pdf_2019, url_2019,
    "NIS GPC 2019 final report; Table 2.5.1 province religion percentages (2008 and 2019) extracted with pdftotext -layout.",
    dataset_id_census),
  raw_source_record(workbook_2019, url_workbook,
    "NIS GPC 2019 priority-table workbook; Table A4 national religion counts (the national count anchor).",
    dataset_id_anchor),
  raw_source_record(boundary_path, url_boundary,
    "geoBoundaries KHM ADM1 source GeoJSON (25 province features), joined to the census provinces via the spelling concordance.",
    dataset_id_boundary),
  raw_source_record(boundary_meta_path, url_boundary_meta,
    "geoBoundaries KHM ADM1 release metadata; records boundary ID KHM-ADM1-37992800, 25 units, ODbL 1.0.",
    dataset_id_boundary, used = FALSE)
)

output_paths <- c(summary_output, summary_csv_output, boundary_output)
output_hashes <- vapply(output_paths, sha256_file, character(1))
raw_hashes <- vapply(raw_sources, `[[`, character(1), "sha256")
combined <- paste(c(raw_hashes, output_hashes), collapse = "")
version_hash <- substr(digest::digest(combined, algo = "sha256", serialize = FALSE), 1L, 12L)
git_commit <- tryCatch(trimws(system2("git", c("rev-parse", "--short", "HEAD"), stdout = TRUE)),
                       error = function(e) NULL)
if (length(git_commit) == 0L || !nzchar(git_commit)) git_commit <- NULL

durable_file_record <- function(path, content, licence_status, licence_basis,
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

# category-frame record: verbatim per-wave labels plus the count-anchor frame.
category_frame_record <- list(
  table_2_5_1_verbatim = list(
    `2008` = as.list(unname(category_labels_verbatim[["2008"]][category_keys])),
    `2019` = as.list(unname(category_labels_verbatim[["2019"]][category_keys]))
  ),
  count_anchor_frame_a4 = as.list(a4_labels),
  english_display_mapping = list(
    note = paste(
      "Any English display mapping (for example collapsing the 2008 “Christians”",
      "and 2019 “Christian” heads to a single display label) is documented here",
      "and never applied to the source fields; the product stores the verbatim",
      "per-wave labels."
    ),
    bud = "Buddhist", mus = "Muslim", chr = "Christian", oth = "Other"
  )
)

derived_bound_derivation <- paste(
  "Each Table 2.5.1 percentage is printed to one decimal and carries a maximum",
  "rounding error of 0.05 percentage points (half the 0.1 print step). The four",
  "mutually exclusive categories are re-based to partition the classified basis;",
  "their true shares sum to exactly 100.0, so the printed row sum can differ from",
  "100.0 by at most 0.05 x 4 = 0.20 percentage points. Every transcribed province",
  "and context row deviates by at most 0.1 (99.9 / 100.0 / 100.1), within the 0.20",
  "bound. No percentage was altered. The bound is derived from the source's",
  "rounding and the category count, not an arbitrary tolerance (Estonia / Burkina",
  "Faso precedent)."
)

licence_basis_product <- "nis_all_rights_reserved_derived_summary_attribution_geoboundaries_odbl_1_0"
licence_basis_census <- "nis_all_rights_reserved_derived_summary_attribution"
licence_basis_boundary <- "geoboundaries_odbl_1_0"

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = paste0("manifest:kh-census-religion:kh:2008-2019:", version_hash),
  dataset_id = "kh-census-religion:kh:2008-2019:nis-geoboundaries",
  dataset_version_id = paste0("kh-census-religion:kh:2008-2019:nis-geoboundaries:", version_hash),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "kh-census-religion",
  dataset_role = "staged_evidence",
  scope = list(
    level = "country",
    country_codes = list("KH"),
    snapshot_date = NULL,
    pipeline_stage = "staged"
  ),
  created_at = stamp,
  created_by = script_id,
  target_years = waves,
  pipeline = list(
    script = script_id,
    git_commit = git_commit,
    command = paste("Rscript", script_id),
    parameters = list(
      waves = list(
        list(
          year = 2008L,
          construct = "census religion distribution, one-decimal percent shares",
          geography = "25 provinces (NIS retabulation onto the current frame)",
          basis = "re-based four-category shares; no counts published",
          gate = "every-row reconciliation within the derived 0.20 pp bound"
        ),
        list(
          year = 2019L,
          construct = "census religion distribution, one-decimal percent shares",
          geography = "25 provinces",
          basis = "re-based four-category shares; national counts in Table A4",
          gate = "every-row reconciliation within the derived 0.20 pp bound; national row anchored to Table A4"
        )
      ),
      category_frame = category_frame_record,
      counts_from_percentages = "withheld; no count or population total is derived from any percentage (no province population is published for either wave)",
      derived_rounding_bound = list(
        applies_to = "Table 2.5.1 one-decimal percentage rows, both waves",
        rounding_halfwidth_pp = reconciliation[["2019"]][["rounding_halfwidth"]],
        category_count = reconciliation[["2019"]][["category_count"]],
        bound_pp = reconciliation[["2019"]][["derived_bound"]],
        observed_max_absolute_deviation_pp = max(
          reconciliation[["2008"]][["max_absolute_deviation"]],
          reconciliation[["2019"]][["max_absolute_deviation"]]
        ),
        province_row_deviations_pp = list(
          `2008` = reconciliation[["2008"]][["row_deviations"]],
          `2019` = reconciliation[["2019"]][["row_deviations"]]
        ),
        context_row_deviations_pp = list(
          `2008` = context_reconciliation[["2008"]][["row_deviations"]],
          `2019` = context_reconciliation[["2019"]][["row_deviations"]]
        ),
        derivation = derived_bound_derivation
      ),
      national_anchor = national_anchor,
      reference_group = list(
        design = "two-slot minority-share design (docs/development/minority-share-metric.md, ratified 2026-07-11, PI task 6)",
        reference_group = reference_group_label,
        reference_group_key = reference_group_key,
        basis = "the product's largest published category at the national level in the most recent wave (2019), declared once and held constant across every wave and area",
        national_2019_reference_share = reference_group_national_2019_share,
        national_2019_reference_share_evidence = paste(
          "Table A4 counts re-based to exclude Not Stated give Buddhist",
          paste0(national_anchor[["rebased_percent"]][[reference_group_key]], ","),
          "rounding to 97.1 and reproducing the Table 2.5.1 national (Total) row."
        ),
        religious_affiliation_percent = "Buddhist (reference-group) share of the re-based four-category frame",
        no_religion_percent = "minority share: the exact complement (100 minus the Buddhist share), equal at the source's rounding to the summed Muslims/Christians/Other share; not a measure of no religion",
        exact_complement_gate = "religious_affiliation_percent + no_religion_percent = 100.0 in every row",
        exact_complement_observed_max_deviation_pp = complement_max_deviation,
        page_relabelling = "metricLabels relabels the affiliation slot as “Buddhist (%)” and the no-religion slot as “Minority share (%)”, note “share outside Cambodia's largest published category, Buddhist”"
      ),
      change_metric = list(
        status = "computable_generally_withheld_two_provinces",
        computable = paste(
          "Change across 2008-2019 is computable for 23 provinces: same four-category",
          "re-based frame, same 25-unit geography. religious_change differences the",
          "Buddhist (reference-group) share carried in religious_affiliation_percent (and",
          "in the quality_flag composition), a real quantity now that the headline slot",
          "varies across waves."
        ),
        withheld_provinces = as.list(change_withheld_provinces),
        withheld_rationale = paste(
          "The 2019 final report attributes the large 2008-2019 Other (highland",
          "indigenous) share shifts in Mondul Kiri (Other 35.5 -> 21.2) and Ratanak",
          "Kiri (Other 47.2 -> 23.2) to reclassification, not to real change; change is",
          "withheld for those two provinces with per-row disclosure in quality_flag."
        )
      ),
      page_publication_gate = page_gate_position,
      boundary = list(
        boundary_set_id = boundary_set_id,
        source = "geoBoundaries KHM ADM1 (gbOpen), represented year 2017, ODbL 1.0",
        features = 25L,
        total_land_area_sq_km = boundary_result[["total_land_area"]],
        output_bytes = boundary_result[["output_bytes"]],
        distinct_written_geometry_hashes = boundary_result[["distinct_written_hash_count"]],
        name_concordance = as.list(paste(names(name_concordance), name_concordance, sep = " -> ")),
        simplification = c(
          boundary_result[["simplification"]],
          list(byte_ceiling = 3000000L, helper = "scripts/lib/simplify_boundary.R")
        ),
        source_geometry_sha256 = boundary_result[["source_geometry_sha256"]],
        written_geometry_sha256 = boundary_result[["written_geometry_sha256"]]
      ),
      licence_position = list(
        status = "accepted",
        nis_footer_verbatim_khmer = nis_footer_khmer,
        nis_footer_verbatim_english = nis_footer_en,
        summary = nis_position,
        pi_task_9_ruling = "PI task 9 (2026-07-11): the project lead confirmed that the Cote d'Ivoire / Iran derived-summaries-with-attribution ruling extends to Cambodia (NIS all-rights-reserved). The derived category summaries ship with NIS / Ministry of Planning attribution; the raw PDF and workbook stay git-ignored."
      ),
      raw_sources = raw_sources,
      local_cache_hint = "data/raw/kh_census/ (git-ignored; every cached source listed with URL, bytes, and SHA-256 in pipeline.parameters.raw_sources).",
      raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/kh_census/")
    ),
    software_versions = list(
      r = paste(R.version[["major"]], R.version[["minor"]], sep = "."),
      sf = as.character(utils::packageVersion("sf")),
      jsonlite = as.character(utils::packageVersion("jsonlite"))
    )
  ),
  source = list(
    provider = "National Institute of Statistics (NIS), Ministry of Planning, Cambodia; geoBoundaries (William & Mary geoLab)",
    source_dataset_ids = list(dataset_id_census, dataset_id_anchor, dataset_id_boundary),
    source_urls = list(url_2019, url_workbook, url_boundary, url_boundary_meta, url_nis),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = nis_position,
    citation = paste(
      "NIS, General Population Census of Cambodia 2019: Final Report (Table 2.5.1)",
      "and Final Priority Tables A-H (Table A4); geoBoundaries KHM ADM1 (ODbL 1.0)."
    ),
    raw_redistribution = "The census PDF and workbook are not committed; they remain in data/raw/kh_census/ pending any project-controlled raw archive. The geoBoundaries source GeoJSON is likewise not committed.",
    local_cache_hint = "data/raw/kh_census/ (git-ignored)"
  ),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = list(
    durable_file_record(summary_output,
      "Cambodia two-wave province area-summary JSON (2008, 2019) with NIS census religion-distribution metrics under the two-slot minority-share design.",
      "accepted", licence_basis_census, row_count = length(all_rows)),
    durable_file_record(summary_csv_output,
      "Flattened Cambodia two-wave province area-summary CSV (2008, 2019).",
      "accepted", licence_basis_census, row_count = length(all_rows)),
    durable_file_record(boundary_output,
      "Simplified Cambodia province boundary GeoJSON derived from geoBoundaries KHM ADM1 (25 provinces).",
      "accepted", licence_basis_boundary, feature_count = 25L)
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_output), sha256 = sha256_file(summary_output),
         built_by = script_id,
         notes = sprintf("%d rows = 25 provinces x 2 waves (2008, 2019); percentages only, counts withheld.", length(all_rows))),
    list(uri = paste0("repo:", boundary_output), sha256 = sha256_file(boundary_output),
         built_by = script_id,
         notes = sprintf("25 province features from geoBoundaries KHM ADM1, simplified to %d bytes.", boundary_result[["output_bytes"]]))
  ),
  partitions = list(
    list(
      partition_id = "kh-province-2008",
      partition_type = "area",
      file_uri = paste0("repo:", summary_output),
      sha256 = sha256_file(summary_output),
      country_code = "KH"
    ),
    list(
      partition_id = "kh-province-2019",
      partition_type = "area",
      file_uri = paste0("repo:", summary_output),
      sha256 = sha256_file(summary_output),
      country_code = "KH"
    )
  ),
  stats = list(
    waves = 2L,
    years = "2008, 2019",
    province_rows = length(all_rows),
    provinces_per_wave = 25L,
    categories = 4L,
    boundary_features = 25L,
    derived_bound_pp = reconciliation[["2019"]][["derived_bound"]],
    max_absolute_deviation_pp = max(
      reconciliation[["2008"]][["max_absolute_deviation"]],
      reconciliation[["2019"]][["max_absolute_deviation"]]
    )
  ),
  local_cache_hint = "data/raw/kh_census/ (git-ignored; every cached source listed with URL, bytes, and SHA-256 in pipeline.parameters.raw_sources).",
  validation = list(
    status = "passed",
    commands = list(
      paste("Rscript", script_id),
      paste("uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json", summary_output),
      paste("uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/data-manifest.schema.json", manifest_output),
      "bash scripts/validate_manifests.sh"
    ),
    warnings = list(
      paste(
        "Licence: NIS asserts bare all-rights-reserved copyright with no permissive",
        "licence. The project lead confirmed on 2026-07-11 (PI task 9) that the Cote",
        "d'Ivoire / Iran derived-summaries-with-attribution ruling extends to Cambodia,",
        "so the derived summaries ship with NIS attribution (licence_status accepted)."
      ),
      paste(
        "Metric slots: under the ratified two-slot minority-share design (PI task 6,",
        "2026-07-11) religious_affiliation_percent carries the Buddhist (reference-group)",
        "share and no_religion_percent carries the minority share (the exact complement,",
        "the summed Muslims/Christians/Other share). The two slots sum to 100.0 in every",
        "row; the flat-100 presentation gate is resolved."
      ),
      paste(
        "Change withheld for Mondul Kiri and Ratanak Kiri: the report attributes",
        "their large Other-share shifts to reclassification. religious_change (the",
        "difference in the Buddhist share) is computable for the other 23 provinces."
      ),
      paste(
        "Rows carry one-decimal percentages that sum to 99.9-100.1 by the source's",
        "own rounding, within the derived 0.20 pp bound. No percentage was altered",
        "and no count was derived from a percentage."
      )
    ),
    national_reconciliation = list(
      a4_five_category_sum = national_anchor[["a4_sum_check"]],
      a4_total = national_anchor[["a4_total"]],
      rebased_basis = national_anchor[["rebased_basis"]],
      rebased_percent_1dp = national_anchor[["rebased_percent_1dp"]],
      national_row_printed = national_anchor[["national_row_printed"]],
      status = "Table A4 five categories sum to 15,552,211 exactly; re-based four categories reproduce the Table 2.5.1 national row 97.1/2.0/0.3/0.5."
    ),
    boundary_validation = list(
      source_feature_count = 25L,
      output_feature_count = length(fromJSON(boundary_output, simplifyVector = FALSE)[["features"]]),
      expected_feature_count = 25L,
      distinct_geometry_hashes = boundary_result[["distinct_written_hash_count"]],
      output_bytes = boundary_result[["output_bytes"]],
      total_land_area_sq_km = boundary_result[["total_land_area"]],
      simplification_keep_percent = boundary_result[["simplification"]][["keep_percent"]]
    ),
    notes = paste(
      "Every province and context row reconciles within the derived 0.20 pp bound.",
      "The national row matches the Table A4 count-derived re-based percentages. The",
      "boundary output has 25 valid, non-empty, distinctly hashed geometries within",
      "the 3 MB cap. Both the area-summary and the manifest pass schema validation."
    )
  ),
  construct_notes = list(
    "Table 2.5.1 publishes one-decimal percentage shares for four religion categories by province for 2008 and 2019 on the current 25-province frame; no source publishes religion counts or a total population by province, so counts and population totals are null and none is derived from a percentage.",
    "The four categories are re-based to 100 percent (the count table's Not Stated column is excluded) with no non-affiliation category, so the two legacy slots carry declared constructs under the ratified minority-share design: religious_affiliation_percent is the Buddhist (reference-group) share and no_religion_percent is the minority share, the exact complement (the summed Muslims/Christians/Other share). The two slots sum to 100.0 in every row, and the per-category composition is carried verbatim in each row's quality_flag.",
    "The verbatim category labels differ by wave: 2008 heads are Buddhist, Muslims, Christians, Other; 2019 heads are Buddhist, Muslims, Christian, Other. Both label sets are recorded as printed and never merged. The Table A4 count-anchor frame (Buddhism, Islam, Christianity, Other, Not Stated) is recorded separately and not applied to the Table 2.5.1 source fields.",
    "religious_change differences the Buddhist (reference-group) share across 2008-2019 on the shared frame, computable for 23 provinces but withheld for Mondul Kiri and Ratanak Kiri, whose large Other (highland indigenous) share shifts the 2019 report attributes to reclassification.",
    "Boundaries are geoBoundaries KHM ADM1 (25 provinces, ODbL 1.0, OpenStreetMap/Wambacher); the derived boundary carries attribution and share-alike (Ghana / Malaysia OSM-ODbL precedent). Both waves join to the one 25-province geometry (2008 already retabulated onto the current frame), so no cross-wave concordance is needed."
  ),
  deferred_sources = list(
    list(
      source_dataset_id = "nis-gpc-1998-religion-national",
      url = "https://nis.gov.kh/wp-content/uploads/2025/09/General-Population-Census1998.pdf",
      local_path = file.path(raw_dir, "gpc1998.pdf"),
      notes = "1998 census religion is published at the national level only (24 provinces then; no province x religion table located). National-only; not mapped."
    ),
    list(
      source_dataset_id = "nis-camstat-religion-national",
      url = "https://camstat.nis.gov.kh/",
      local_path = file.path(raw_dir, "df_culture.csv"),
      notes = "CamStat SDMX carries the religion indicator at the national level only (percentages) for 1998, 2008 and 2019; a national cross-check, not a subnational source."
    ),
    list(
      source_dataset_id = "nis-gpc-2008-native-province-religion",
      url = "https://nis.gov.kh/wp-content/uploads/2025/09/GPC2008_Report_ENG.pdf",
      local_path = file.path(raw_dir, "gpc2008_report_en.pdf"),
      notes = "The 2008 census final report PDF is a scanned image with no text layer; any 2008-native province religion table would need OCR and is not required, because Table 2.5.1 already republishes the 2008 province percentages on the current frame."
    )
  ),
  privacy = "public",
  licence_status = "accepted",
  licence_basis = licence_basis_product,
  downstream_status = "staged",
  source_datasets = source_datasets,
  notes = paste(
    "Staged for conductor review. The NIS all-rights-reserved derived-summaries-with-",
    "attribution ruling was confirmed for Cambodia by the project lead on 2026-07-11",
    "(PI task 9), so licence_status is accepted; the flat-share presentation gate (PI",
    "task 6) is resolved by the ratified two-slot minority-share re-emit. The committed",
    "products contain the derived province area summary and a simplified boundary only.",
    "On-page attribution cites NIS / Ministry of Planning and geoBoundaries (ODbL 1.0,",
    "OpenStreetMap/Wambacher)."
  )
)

write_json(manifest, manifest_output, auto_unbox = TRUE, pretty = TRUE, null = "null", digits = NA)

if (!jsonlite::validate(readChar(manifest_output, file_bytes(manifest_output), useBytes = TRUE))) {
  stop("manifest output is not valid JSON", call. = FALSE)
}
validate_json_schema("schemas/data-manifest.schema.json", manifest_output)

message(
  "built Cambodia province census-religion product: ", length(all_rows),
  " rows across 2008 and 2019; two-slot minority-share re-emit (Buddhist share / minority",
  " share), exact-complement max deviation ", complement_max_deviation, " pp; boundary ",
  boundary_result[["output_bytes"]], " bytes, ", boundary_result[["distinct_written_hash_count"]],
  " distinct geometries; derived bound ", reconciliation[["2019"]][["derived_bound"]],
  " pp, observed max deviation ",
  max(reconciliation[["2008"]][["max_absolute_deviation"]],
      reconciliation[["2019"]][["max_absolute_deviation"]]),
  " pp; licence accepted (PI task 9)."
)
