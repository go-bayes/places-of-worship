# build the Grenada 2021 PRELIMINARY census-religion parish product from Table 23
# ("Population by Religion and Parish") of the CSO 2021 preliminary census results.
#
# inputs: the cached 2021 preliminary results PDF and the geoBoundaries GRD ADM1
# boundary with its release metadata, all under git-ignored data/raw/gd_census/.
# Table 23's 26x8 count grid is transcribed verbatim into this script (source order,
# source spellings including the "Mormom" and "Independent Baptiste" sic labels) and
# the build re-derives every printed margin as a fail-fast gate.
# outputs: apps/regions/gd/data/area_summary_parish.{json,csv},
# apps/regions/gd/data/gd_parish_2021.geojson, and the tracked data manifest
# docs/manifests/gd-census-religion-2021.json.
# run from the repo root: Rscript scripts/build_gd_area_summary.R
#
# product scope. seven parish units, one wave (2021, PRELIMINARY). the universe is the
# whole enumerated 2021 census population, all ages (national total 108,279). Table 23
# prints eight disjoint columns; the Town of St. George column is rolled into the
# St. George parish column (the census defines the town as part of the parish, and the
# seven-unit geoBoundaries ADM1 layer carries no separate town polygon). counts are
# carried verbatim; no category is merged or translated.
#
# preliminary disclosure. the source is the 2021 PRELIMINARY report (a final 2021 report
# is not yet published). every row carries a prominent preliminary-source token, the
# manifest names the source as preliminary throughout, and the product regenerates when
# the final report lands. ruling: PI, 2026-07-12 (queue row 83;
# research/countries/gd/route-probe.md is the record).
#
# slot design. Table 23 carries two distinct no-religion lines, "Atheist" (49) and
# "No Religious Affiliation" (6,444), both marked no-religion in the probe frame, plus a
# separate "Not Stated" non-response line (7,698). the no_religion slot is the sum of the
# two no-religion lines (Atheist + No Religious Affiliation); both stay distinct in the
# per-row composition. the religious_affiliation slot is the 22 named affiliations plus
# the "Other (Specify)" residual affiliation. "Not Stated" is non-response: inside the
# denominator, outside both slots.
#
# gate design. the transcribed grid is validated against Table 23's own printed margins:
# every one of the 26 religion rows must sum across the 8 columns to its printed national
# total; every one of the 8 columns must sum over the 26 rows to its printed column total;
# both national margins must equal 108,279; and after the Town-of-St.-George roll-up the
# 7 parishes must sum to 108,279 at every category and margin. integer-exact, no
# tolerance. any nonzero deviation stops the build; no count is allocated, inferred,
# imputed, or tuned.
#
# licence. CSO Open Licence Agreement (free reuse, commercial and non-commercial, with an
# acknowledgement-of-source notice); licence_status accepted. boundary geoBoundaries GRD
# ADM1 CC BY-SA 2.0 (OpenStreetMap contributors; the derived boundary ships share-alike).

suppressPackageStartupMessages({
  library(jsonlite)
  library(sf)
  library(stringi)
  library(digest)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "GD"
script_id <- "scripts/build_gd_area_summary.R"
raw_dir <- "data/raw/gd_census"
output_dir <- "apps/regions/gd/data"
manifest_dir <- "docs/manifests"

retrieval_date <- "2026-07-12"
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")

# ---- cached inputs and pinned source URLs ---------------------------------

census_pdf <- file.path(raw_dir, "gd_2021_prelim.pdf")
boundary_path <- file.path(raw_dir, "geoBoundaries-GRD-ADM1.geojson")
boundary_meta_path <- file.path(raw_dir, "gb_grd_adm1_meta.json")
licence_json <- file.path(raw_dir, "gd_ola_wp_rest.json")

url_census_pdf <- "https://stats.gov.gd/wp-content/uploads/2025/04/2021-National-Housing-Population-Census-Results-Latest-PRELIMINARY.pdf"
url_boundary <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/GRD/ADM1/geoBoundaries-GRD-ADM1.geojson"
url_boundary_meta <- "https://www.geoboundaries.org/api/current/gbOpen/GRD/ADM1/"
url_licence <- "https://stats.gov.gd/open-licence-agreement/"

boundary_set_id <- "gd-parish-2021-geoboundaries-adm1"
boundary_output <- file.path(output_dir, "gd_parish_2021.geojson")
summary_output <- file.path(output_dir, "area_summary_parish.json")
summary_csv_output <- file.path(output_dir, "area_summary_parish.csv")
manifest_output <- file.path(manifest_dir, "gd-census-religion-2021.json")

dataset_id_census <- "cso-gd-2021-preliminary-table23-religion-parish"
dataset_id_boundary <- "geoboundaries-grd-adm1"

wave_year <- 2021L
national_total <- 108279L

# ---- Table 23 source grid (transcribed verbatim; never merged or translated) --
# the 26 religion categories in printed source order, with the source spellings
# preserved exactly ("Mormom" sic, "Independent Baptiste" sic, "Jehovah Witnesses",
# "Muslim"). the source prints all-caps table headers; labels are rendered here in the
# probe's title-case frame with spellings unchanged. printed "-" cells are structural
# zeros and transcribe as 0. roles: 22 named affiliations, one residual affiliation
# ("Other (Specify)"), two distinct no-religion lines ("Atheist", "No Religious
# Affiliation"), and one non-response line ("Not Stated").
category_labels <- c(
  "Anglican", "Buddhist", "Bahai", "Brethren", "Church of God", "Evangelical",
  "Hindu", "Independent Baptiste", "Jehovah Witnesses", "Methodist", "Mennonite",
  "Moravian", "Mormom", "Muslim", "Pentecostal", "Presbyterian", "Rastafarian",
  "Roman Catholic", "Salvation Army", "Seventh Day Adventist", "Spiritual Baptist",
  "Lutheran", "Atheist", "No Religious Affiliation", "Other (Specify)", "Not Stated"
)

# the 8 source columns in printed order. "Town of St. George" is a separate source
# column that this build rolls into "St. George" (departure three, approved by the PI
# ruling); "Carriacou & Petite Martinique" is the Southern Grenadine Islands dependency.
source_columns <- c(
  "ST.GEORGE", "TOWN OF ST.GEORGE", "ST.JOHN", "ST.MARK", "ST.PATRICK",
  "ST.ANDREW", "ST.DAVID", "CARRIACOU & PETITE MARTINIQUE"
)

# the 26x8 count grid, verbatim from Table 23 (rows = categories, columns = source
# columns above). each row's printed national Total is held separately (printed_row_total)
# and each column's printed Total separately (printed_col_total); the build re-derives
# both and stops on any mismatch.
grid <- rbind(
  c(2942,  445,  641,  304,  677, 1421,  438, 1048),  # Anglican
  c(   3,   11,    0,    2,    0,    0,    2,    6),   # Buddhist
  c(  14,    0,    0,    0,    0,    1,    0,    0),   # Bahai
  c( 200,    7,    4,    0,    1,    7,   91,    2),   # Brethren
  c(1065,   50,  168,   26,  219, 2098,  203,   71),  # Church of God
  c(1071,   35,  115,   24,  477,  490,  166,  175),  # Evangelical
  c(  87,   40,    1,    1,    1,    6,   15,    0),   # Hindu
  c( 813,   26,   53,   65,  122,  279,  234,   33),  # Independent Baptiste
  c( 478,   43,   67,    8,   87,  197,  154,   63),  # Jehovah Witnesses
  c(1113,   57,   12,    8,    7,   79,   58,   34),  # Methodist
  c( 202,    2,    2,    0,    0,    2,   72,    0),   # Mennonite
  c(  12,    0,    0,    0,    0,    0,    5,    0),   # Moravian
  c(  75,    1,    0,    0,    0,   13,    2,    4),   # Mormom
  c( 247,   15,   15,    2,   20,   76,   14,    7),   # Muslim
  c(9121,  356,  618,  684, 1019, 5702, 3738,  343),  # Pentecostal
  c( 105,   26,   14,  125,   79,   89,   28,    1),   # Presbyterian
  c( 402,   39,  129,   66,  112,  211,  151,   44),  # Rastafarian
  c(12701, 773, 3216, 1162, 2133, 7243, 4992, 1925),  # Roman Catholic
  c(  32,   11,    0,    0,    0,    5,    1,    0),   # Salvation Army
  c(3124,  162, 1161,  890, 1890, 4615, 1154,  347),  # Seventh Day Adventist
  c( 628,   48,  103,  188,   87,  316,  435,   38),  # Spiritual Baptist
  c(  34,    0,    0,    0,    0,    0,    7,    0),   # Lutheran
  c(  23,   12,    3,    5,    1,    0,    2,    3),   # Atheist
  c(2849,   81,  556,  184,  360, 1131, 1067,  216),  # No Religious Affiliation
  c( 596,   17,  326,  158,  194,  120,  228,   77),  # Other (Specify)
  c(4159,  424,  569,   36,  360,  654, 1186,  310)   # Not Stated
)
storage.mode(grid) <- "integer"
dimnames(grid) <- list(category_labels, source_columns)

# printed national row totals (Table 23 Total column), verbatim.
printed_row_total <- c(
  Anglican = 7916L, Buddhist = 24L, Bahai = 15L, Brethren = 312L,
  `Church of God` = 3900L, Evangelical = 2553L, Hindu = 151L,
  `Independent Baptiste` = 1625L, `Jehovah Witnesses` = 1097L, Methodist = 1368L,
  Mennonite = 280L, Moravian = 17L, Mormom = 95L, Muslim = 396L,
  Pentecostal = 21581L, Presbyterian = 467L, Rastafarian = 1154L,
  `Roman Catholic` = 34145L, `Salvation Army` = 49L, `Seventh Day Adventist` = 13343L,
  `Spiritual Baptist` = 1843L, Lutheran = 41L, Atheist = 49L,
  `No Religious Affiliation` = 6444L, `Other (Specify)` = 1716L, `Not Stated` = 7698L
)

# printed column totals (Table 23 Total row), verbatim.
printed_col_total <- c(
  `ST.GEORGE` = 42096L, `TOWN OF ST.GEORGE` = 2681L, `ST.JOHN` = 7773L,
  `ST.MARK` = 3938L, `ST.PATRICK` = 7846L, `ST.ANDREW` = 24755L,
  `ST.DAVID` = 14443L, `CARRIACOU & PETITE MARTINIQUE` = 4747L
)

# slot role assignment over the 26 verbatim categories.
no_religion_categories <- c("Atheist", "No Religious Affiliation")
non_response_categories <- c("Not Stated")
affiliation_categories <- setdiff(category_labels,
                                  c(no_religion_categories, non_response_categories))

# ---- parish concordance (source columns -> boundary features) --------------
# the roll-up: the eight source columns map to the seven geoBoundaries GRD ADM1
# features, joined by the boundary shapeISO (unambiguous, present on every feature).
# "Town of St. George" has no ADM1 polygon and rolls into "St. George" (GD-03). The
# census "Carriacou & Petite Martinique" dependency is the "Southern Grenadine Islands"
# polygon (GD-10). area_name carries the public parish label.
parish_meta <- list(
  list(area_code = "GD-01", area_name = "Saint Andrew",
       shape_iso = "GD-01", shape_name = "Saint Andrew",
       source_columns = c("ST.ANDREW")),
  list(area_code = "GD-02", area_name = "Saint David",
       shape_iso = "GD-02", shape_name = "Saint David",
       source_columns = c("ST.DAVID")),
  list(area_code = "GD-03", area_name = "Saint George",
       shape_iso = "GD-03", shape_name = "Saint George",
       source_columns = c("ST.GEORGE", "TOWN OF ST.GEORGE")),
  list(area_code = "GD-04", area_name = "Saint John",
       shape_iso = "GD-04", shape_name = "Saint John",
       source_columns = c("ST.JOHN")),
  list(area_code = "GD-05", area_name = "Saint Mark",
       shape_iso = "GD-05", shape_name = "Saint Mark",
       source_columns = c("ST.MARK")),
  list(area_code = "GD-06", area_name = "Saint Patrick",
       shape_iso = "GD-06", shape_name = "Saint Patrick",
       source_columns = c("ST.PATRICK")),
  list(area_code = "GD-10", area_name = "Carriacou & Petite Martinique",
       shape_iso = "GD-10", shape_name = "Southern Grenadine Islands",
       source_columns = c("CARRIACOU & PETITE MARTINIQUE"))
)
parish_codes <- vapply(parish_meta, function(m) m$area_code, character(1))

# ---- small helpers ---------------------------------------------------------

require_file <- function(path) {
  if (!file.exists(path)) stop("missing required source: ", path, call. = FALSE)
}
sha256_file <- function(path) unname(tools::sha256sum(path))
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))

# named check-jsonschema invocation (pinned uv cache dirs match sibling builders so the
# repo uv.lock is never touched).
validate_json_schema <- function(schema_path, instance_path) {
  base_uri <- paste0("file://",
    normalizePath(dirname(schema_path), winslash = "/", mustWork = TRUE), "/")
  status <- system2("uvx",
    c("check-jsonschema", "--base-uri", base_uri, "--schemafile", schema_path, instance_path),
    env = c(
      "UV_CACHE_DIR=/tmp/places-of-worship-uv/cache",
      "UV_TOOL_DIR=/tmp/places-of-worship-uv/tools",
      "UV_PYTHON_INSTALL_DIR=/tmp/places-of-worship-uv/python"
    ))
  if (!identical(status, 0L)) stop("schema validation failed for ", instance_path, call. = FALSE)
  invisible(instance_path)
}

# ---- reconciliation gates (fail-fast on any nonzero deviation) -------------

# every religion row must sum across the 8 source columns to its printed national total.
assert_row_margins <- function() {
  derived <- rowSums(grid)
  diffs <- derived - printed_row_total[category_labels]
  if (any(diffs != 0L)) {
    bad <- category_labels[diffs != 0L]
    detail <- paste(sprintf("%s: derived=%d printed=%d", bad,
                            derived[bad], printed_row_total[bad]), collapse = "; ")
    stop("STOP: Table 23 row margins do not reconcile: ", detail,
         ". No count altered; build stopped.", call. = FALSE)
  }
  invisible(TRUE)
}

# every source column must sum over the 26 rows to its printed column total.
assert_col_margins <- function() {
  derived <- colSums(grid)
  diffs <- derived - printed_col_total[source_columns]
  if (any(diffs != 0L)) {
    bad <- source_columns[diffs != 0L]
    detail <- paste(sprintf("%s: derived=%d printed=%d", bad,
                            derived[bad], printed_col_total[bad]), collapse = "; ")
    stop("STOP: Table 23 column margins do not reconcile: ", detail,
         ". No count altered; build stopped.", call. = FALSE)
  }
  invisible(TRUE)
}

# both national margins must equal the printed national total.
assert_national_margin <- function() {
  by_rows <- sum(printed_row_total)
  by_cols <- sum(printed_col_total)
  grand <- sum(grid)
  if (by_rows != national_total || by_cols != national_total || grand != national_total) {
    stop("STOP: national margin is not ", national_total, " (rows=", by_rows,
         ", cols=", by_cols, ", grid=", grand, ")", call. = FALSE)
  }
  invisible(TRUE)
}

# ---- roll up the 8 source columns into the 7 parish units ------------------
# each parish's 26-category counts are the (integer) sum of its source columns; for six
# parishes that is a single column, for St. George it is ST.GEORGE + TOWN OF ST.GEORGE.
build_parish_grid <- function() {
  mat <- matrix(0L, nrow = length(category_labels), ncol = length(parish_codes),
                dimnames = list(category_labels, parish_codes))
  for (m in parish_meta) {
    cols <- m$source_columns
    mat[, m$area_code] <- if (length(cols) == 1L) grid[, cols] else rowSums(grid[, cols, drop = FALSE])
  }
  storage.mode(mat) <- "integer"
  mat
}

# after the roll-up: every parish column must still sum to national at each category, and
# the 7 parish totals must sum to the national total exactly.
assert_parish_reconciliation <- function(parish_grid) {
  cat_diffs <- rowSums(parish_grid) - printed_row_total[category_labels]
  if (any(cat_diffs != 0L)) {
    bad <- category_labels[cat_diffs != 0L]
    stop("STOP: post-roll-up category margins broke for: ", paste(bad, collapse = "; "),
         call. = FALSE)
  }
  parish_totals <- colSums(parish_grid)
  if (sum(parish_totals) != national_total) {
    stop("STOP: parish totals sum to ", sum(parish_totals), " not ", national_total,
         call. = FALSE)
  }
  # St. George parish total must equal the exact sum of the two rolled columns.
  sg_expected <- printed_col_total[["ST.GEORGE"]] + printed_col_total[["TOWN OF ST.GEORGE"]]
  if (parish_totals[["GD-03"]] != sg_expected) {
    stop("STOP: St. George roll-up total ", parish_totals[["GD-03"]], " != ",
         sg_expected, " (ST.GEORGE + TOWN OF ST.GEORGE)", call. = FALSE)
  }
  invisible(parish_totals)
}

# ---- boundary --------------------------------------------------------------
# validate and simplify the 7-feature geoBoundaries GRD ADM1 layer; join to the parish
# concordance by shapeISO; return the written layer, geodesic land areas by code, and
# geometry-validation detail (per-feature hashes, never c()-ed sfg lists).
build_boundary <- function() {
  boundary <- st_read(boundary_path, quiet = TRUE, stringsAsFactors = FALSE)
  if (nrow(boundary) != 7L) stop("expected 7 geoBoundaries GRD ADM1 features", call. = FALSE)
  boundary <- st_make_valid(boundary)
  validity <- st_is_valid(boundary)
  if (any(st_is_empty(boundary)) || any(is.na(validity)) || any(!validity)) {
    stop("source boundary contains empty or invalid geometries", call. = FALSE)
  }
  source_hashes <- vapply(st_as_binary(st_geometry(boundary), EWKB = TRUE), digest,
                          character(1), algo = "sha256", serialize = FALSE)
  if (anyDuplicated(source_hashes)) stop("source boundary contains duplicate geometries", call. = FALSE)

  # join: boundary shapeISO -> parish area_code (7/7, one-to-one).
  iso_to_code <- setNames(vapply(parish_meta, function(m) m$area_code, character(1)),
                          vapply(parish_meta, function(m) m$shape_iso, character(1)))
  boundary_iso <- boundary[["shapeISO"]]
  if (!setequal(boundary_iso, names(iso_to_code))) {
    stop("boundary shapeISO values do not match the parish concordance 1:1", call. = FALSE)
  }
  boundary[["area_code"]] <- unname(iso_to_code[boundary_iso])
  code_to_name <- setNames(vapply(parish_meta, function(m) m$area_name, character(1)),
                           parish_codes)
  boundary[["area_name"]] <- unname(code_to_name[boundary[["area_code"]]])
  boundary[["area_unit_id"]] <- paste0(boundary_set_id, ":", boundary[["area_code"]])
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- "parish"
  boundary <- boundary[, c("area_code", "area_name", "area_unit_id", "boundary_set_id",
                           "boundary_level")]
  boundary <- boundary[order(boundary[["area_code"]]), ]

  dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
  # small source layer; simplify topology-preserving well under the 3 MB cap.
  simplification <- mapshaper_simplify_to_cap(
    boundary, boundary_output, max_bytes = 3000000L,
    keep_percentages = c(30, 20, 15, 10, 8, 6, 5, 4, 3),
    clean_option = "allow-overlaps"
  )
  written <- st_read(boundary_output, quiet = TRUE, stringsAsFactors = FALSE)
  written <- written[order(written[["area_code"]]), ]
  written_validity <- st_is_valid(written)
  written_hashes <- vapply(st_as_binary(st_geometry(written), EWKB = TRUE), digest,
                           character(1), algo = "sha256", serialize = FALSE)
  if (nrow(written) != 7L || any(st_is_empty(written)) || any(!written_validity) ||
      anyDuplicated(written_hashes) || file.info(boundary_output)[["size"]] > 3000000L) {
    stop("simplified boundary failed feature, validity, distinctness, or byte-cap gate", call. = FALSE)
  }
  land_area <- as.numeric(st_area(written)) / 1e6
  land_area_by_code <- setNames(round(land_area, 4), written[["area_code"]])
  # sanity band: Grenada is about 344 km2; catch a crs or unit mistake.
  if (sum(land_area) < 300 || sum(land_area) > 400) {
    stop("total boundary land area is implausible; check the boundary crs", call. = FALSE)
  }
  list(
    written = written,
    land_area_by_code = land_area_by_code,
    total_land_area = round(sum(land_area), 2),
    simplification = simplification,
    source_geometry_sha256 = setNames(as.list(unname(source_hashes)), boundary[["area_code"]]),
    written_geometry_sha256 = setNames(as.list(unname(written_hashes)), written[["area_code"]]),
    output_bytes = file_bytes(boundary_output),
    distinct_written_hash_count = length(unique(written_hashes))
  )
}

# ---- run gates -------------------------------------------------------------

for (path in c(census_pdf, boundary_path, boundary_meta_path, licence_json)) {
  require_file(path)
}

assert_row_margins()
assert_col_margins()
assert_national_margin()
parish_grid <- build_parish_grid()
parish_totals <- assert_parish_reconciliation(parish_grid)

boundary_result <- build_boundary()
land_area_by_code <- boundary_result[["land_area_by_code"]]

# ---- small-cell tokens -----------------------------------------------------
# small_denominator_under_100: a parish whose denominator (parish total) is under 100
# (none in Grenada; the smallest parish is Carriacou & Petite Martinique at 4,747).
# small_cell_under_10: any shipped verbatim category count under 10 in the parish (a
# per-category share a downstream consumer derives would then rest on fewer than ten
# people). the count itself renders exactly; the token marks fragility, per the ratified
# small-cell rule (docs/development/small-cell-rule.md).
small_denominator_codes <- parish_codes[colSums(parish_grid) < 100L]
small_cell_codes <- parish_codes[apply(parish_grid, 2, function(col) any(col < 10L))]
small_cell_detail <- lapply(small_cell_codes, function(code) {
  cells <- parish_grid[, code][parish_grid[, code] < 10L]
  meta <- parish_meta[[which(parish_codes == code)]]
  list(area_code = code, area_name = meta$area_name,
       cells = setNames(as.list(as.integer(cells)), names(cells)))
})

# ---- construct product rows ------------------------------------------------
population_basis_note <- paste(
  "Whole enumerated 2021 census population, all ages, from Table 23 ('Population by",
  "Religion and Parish') of the CSO 2021 PRELIMINARY census results. The parish",
  "denominator is the sum of all 26 verbatim religion categories, including the",
  "'Not Stated' non-response line. PRELIMINARY source: figures are official CSO counts",
  "and reconcile exactly, but may be revised when the final 2021 report is published."
)

denominator_note <- "share of the parish's whole 2021 census population (all 26 categories, including 'Not Stated')"

product_rows <- lapply(parish_meta, function(meta) {
  code <- meta$area_code
  counts <- parish_grid[, code]
  denom <- as.integer(sum(counts))
  affiliation <- as.integer(sum(counts[affiliation_categories]))
  no_religion <- as.integer(sum(counts[no_religion_categories]))
  non_response <- as.integer(sum(counts[non_response_categories]))
  # composition: all 26 verbatim categories with their parish counts, source order.
  composition <- lapply(category_labels, function(lab) {
    list(label_verbatim = lab, count = as.integer(counts[lab]))
  })
  flags <- c(
    "census_2021_preliminary_release",
    "source_cso_2021_preliminary_table_23_population_by_religion_and_parish",
    "universe_whole_2021_census_population_all_ages",
    "religious_affiliation_slot_22_named_affiliations_plus_other_specify",
    "no_religion_slot_atheist_plus_no_religious_affiliation_two_distinct_lines",
    "not_stated_non_response_inside_denominator_outside_slots",
    "single_wave_2021",
    "religious_change_withheld",
    "boundary_geoboundaries_grd_adm1_ccbysa20"
  )
  if (length(meta$source_columns) > 1L) {
    flags <- c(flags, "town_of_st_george_rolled_into_st_george_parish")
  }
  if (code %in% small_denominator_codes) flags <- c(flags, "small_denominator_under_100")
  if (code %in% small_cell_codes) flags <- c(flags, "small_cell_under_10")
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = "parish",
    area_unit_id = paste0(boundary_set_id, ":", code),
    area_code = code,
    area_name = meta$area_name,
    year = wave_year,
    population_total = denom,
    population_total_basis = population_basis_note,
    religious_affiliation_count = affiliation,
    religious_affiliation_percent = round(100 * affiliation / denom, 4),
    no_religion_count = no_religion,
    no_religion_percent = round(100 * no_religion / denom, 4),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = unname(land_area_by_code[[code]]),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(dataset_id_census, dataset_id_boundary),
    quality_flag = paste(flags, collapse = ";"),
    composition = composition
  )
})

if (length(product_rows) != 7L) stop("expected 7 parish rows", call. = FALSE)

# national slot totals (for the manifest and message).
national_affiliation <- sum(printed_row_total[affiliation_categories])
national_no_religion <- sum(printed_row_total[no_religion_categories])
national_non_response <- sum(printed_row_total[non_response_categories])

# ---- source datasets, indicators, visual layers ----------------------------

licence_grant_verbatim <- paste(
  "The Central Statistical Office of Grenada grants you (an individual or a legal entity",
  "that you are authorized to represent) a worldwide, royalty-free non-exclusive licence",
  "to freely use the data, copy, modify, translate, publish, adapt, distribute, create",
  "derivative works and value-added products for commercial and non-commercial purposes",
  "subject to the terms of this licence."
)
licence_attribution <- paste(
  "This product was adapted from the Central Statistical Office of Grenada's information,",
  "which is licensed under the Central Statistical Office's Open Licence Agreement.",
  "Source: Central Statistical Office of Grenada, 2021 Population and Housing Census",
  "(PRELIMINARY results), Table 23."
)

source_datasets <- list(
  list(
    source_dataset_id = dataset_id_census,
    name = "CSO Grenada 2021 Preliminary Census, Table 23: Population by Religion and Parish",
    provider = "Central Statistical Office of Grenada (CSO)",
    url = url_census_pdf,
    retrieval_date = retrieval_date,
    local_path = census_pdf,
    licence = list(
      name = "Central Statistical Office of Grenada Open Licence Agreement (free reuse, commercial and non-commercial, with acknowledgement of source)",
      url = url_licence,
      attribution = licence_attribution
    ),
    citation = paste(
      "Central Statistical Office of Grenada, 2021 National Population and Housing Census",
      "Results (PRELIMINARY), Table 23 'Population by Religion and Parish'. Preliminary",
      "release; superseded by the final 2021 report when published."
    ),
    access_limits = "Public direct PDF download from stats.gov.gd.",
    redistribution_limits = paste(
      "Open reuse under the CSO Open Licence Agreement with the required acknowledgement",
      "of source.", licence_grant_verbatim
    ),
    notes = paste(
      "PRELIMINARY source (uploaded April 2025); a final 2021 report is not yet published.",
      "Table 23 is count-valued over 26 verbatim categories and 8 columns, integer-exact to",
      "108,279 at both margins. The Town of St. George column is rolled into St. George",
      "parish to match the 7-unit boundary."
    )
  ),
  list(
    source_dataset_id = dataset_id_boundary,
    name = "geoBoundaries Grenada ADM1 (7 parish units)",
    provider = "geoBoundaries (William & Mary geoLab); source OpenStreetMap, Wikipedia",
    url = url_boundary,
    retrieval_date = retrieval_date,
    local_path = boundary_path,
    licence = list(
      name = "Creative Commons Attribution-ShareAlike 2.0 (CC BY-SA 2.0)",
      url = "https://creativecommons.org/licenses/by-sa/2.0/",
      attribution = "geoBoundaries (gbOpen) GRD ADM1; boundary source OpenStreetMap contributors; derived boundary shared under CC BY-SA."
    ),
    citation = paste(
      "Runfola, D. et al. (2020) geoBoundaries: A global database of political administrative",
      "boundaries. gbOpen GRD ADM1 (pinned commit 9469f09)."
    ),
    access_limits = NULL,
    redistribution_limits = "CC BY-SA 2.0 permits redistribution and derivatives with attribution and share-alike.",
    notes = "7 ADM1 units; release metadata: boundaryType ADM1, CC BY-SA 2.0, source OpenStreetMap/Wikipedia, admUnitCount 7, represented year 2017."
  )
)

spatial_note <- "Seven parish units on the geoBoundaries GRD ADM1 layer; six parishes join one-to-one, and the Town of St. George column is rolled into the St. George parish feature. Carriacou & Petite Martinique is the Southern Grenadine Islands dependency polygon."

indicators <- list(
  list(
    indicator_id = "religious_affiliation_percent",
    label = "Religious affiliation (%)",
    description = "Share of the parish's 2021 census population affiliated with any religion (the 22 named affiliations plus the 'Other (Specify)' residual affiliation).",
    unit = "percent",
    denominator_indicator_id = "population_total",
    method = paste(
      "Sum of the 22 named affiliation categories plus 'Other (Specify)' over the parish's",
      "whole 2021 census population (all 26 categories, including 'Not Stated'). Counts",
      "carried verbatim from Table 23; no category merged or translated."
    ),
    temporal_coverage = "2021 (preliminary)",
    spatial_coverage = spatial_note,
    quality_notes = paste(
      "PRELIMINARY source; figures reconcile exactly but may be revised. The 'Not Stated'",
      "non-response line stays inside the denominator and outside the affiliation slot."
    )
  ),
  list(
    indicator_id = "no_religion_percent",
    label = "No religion (%)",
    description = "Share of the parish's 2021 census population reporting no religion (the two distinct no-religion lines 'Atheist' and 'No Religious Affiliation', summed).",
    unit = "percent",
    denominator_indicator_id = "population_total",
    method = "Sum of the 'Atheist' and 'No Religious Affiliation' counts over the parish's whole 2021 census population. Both lines stay distinct in the per-row composition.",
    temporal_coverage = "2021 (preliminary)",
    spatial_coverage = spatial_note,
    quality_notes = "The no-religion slot combines the two distinct no-religion lines Table 23 prints; both are substantive no-religion responses, distinct from the 'Not Stated' non-response line, which stays inside the denominator and outside both slots."
  ),
  list(
    indicator_id = "population_total",
    label = "Population (2021 census, religion universe)",
    description = "Whole enumerated 2021 census population, all ages, the religion cross-tab universe and the share denominator.",
    unit = "count",
    denominator_indicator_id = NULL,
    method = "Sum of the 26 verbatim religion category counts per parish from Table 23.",
    temporal_coverage = "2021 (preliminary)",
    spatial_coverage = spatial_note,
    quality_notes = "Parishes sum to the national 2021 total of 108,279 exactly."
  )
)

visual_layers <- list(
  list(
    visual_layer_id = "gd-parish-religious-affiliation-share",
    label = "Religious affiliation share",
    description = "Census religious affiliation share by parish, 2021 (preliminary).",
    layer_type = "choropleth",
    indicator_ids = list("religious_affiliation_percent"),
    geometry_unit_type = "area_unit",
    legend = list(unit = "percent", denominator = "whole 2021 census population"),
    colour_scale = "sequential",
    time_control = "year_selector",
    aggregation_rule = "published parish value on the geoBoundaries ADM1 layer (Town of St. George rolled into St. George)",
    uncertainty_display = "quality_flag",
    default_visibility = TRUE,
    notes = "PRELIMINARY 2021 release; Roman Catholic and Pentecostal are the largest affiliations nationally."
  ),
  list(
    visual_layer_id = "gd-parish-no-religion-share",
    label = "No religion share",
    description = "Census no-religion share by parish, 2021 (preliminary).",
    layer_type = "choropleth",
    indicator_ids = list("no_religion_percent"),
    geometry_unit_type = "area_unit",
    legend = list(unit = "percent", denominator = "whole 2021 census population"),
    colour_scale = "sequential",
    time_control = "year_selector",
    aggregation_rule = "published parish value on the geoBoundaries ADM1 layer",
    uncertainty_display = "quality_flag",
    default_visibility = FALSE,
    notes = "Single wave; no cross-wave change layer (parish religion is available for 2021 only, and only in the preliminary release)."
  )
)

area_summary <- list(
  schema_version = "area-summary.v2",
  generated_at = stamp,
  generated_by = script_id,
  country_code = country_code,
  data_status = "census_religion_preliminary",
  data_status_note = paste(
    "Census religious affiliation is live for the 7 parish units in 2021 from Table 23 of",
    "the CSO 2021 PRELIMINARY census results ('Population by Religion and Parish'). The",
    "source is a preliminary release: figures are official CSO counts and reconcile exactly",
    "to 108,279, but may be revised when the final 2021 report is published; the product",
    "regenerates then. Single wave: religion is a national series only in 2001 and 2011, so",
    "no cross-wave parish change is possible."
  ),
  boundary_set = list(
    boundary_set_id = boundary_set_id,
    country_code = country_code,
    level = "parish",
    vintage = "geoBoundaries GRD ADM1 (gbOpen); 7 units, OpenStreetMap/Wikipedia-sourced",
    source_dataset_id = dataset_id_boundary
  ),
  site_snapshot = list(
    source_dataset_id = NULL,
    snapshot_date = NULL,
    basis = "no governed Grenada place-of-worship snapshot is included in this census-religion release",
    notes = "The Grenada lane ships census-religion count and share metrics only; place metrics are null."
  ),
  source_datasets = source_datasets,
  indicators = indicators,
  visual_layers = visual_layers,
  rows = product_rows
)

dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)
write_json(area_summary, summary_output, auto_unbox = TRUE, pretty = TRUE, null = "null", digits = NA)

# flat CSV companion (no composition; slot counts and shares only)
csv_df <- do.call(rbind, lapply(product_rows, function(r) {
  data.frame(
    country_code = r$country_code, boundary_set_id = r$boundary_set_id,
    boundary_level = r$boundary_level, area_unit_id = r$area_unit_id,
    area_code = r$area_code, area_name = r$area_name, year = r$year,
    population_total = r$population_total, population_total_basis = r$population_total_basis,
    religious_affiliation_count = r$religious_affiliation_count,
    religious_affiliation_percent = r$religious_affiliation_percent,
    no_religion_count = r$no_religion_count, no_religion_percent = r$no_religion_percent,
    place_count = NA_integer_, places_per_10000_residents = NA_real_,
    place_density_per_sq_km = NA_real_, land_area_sq_km = r$land_area_sq_km,
    site_snapshot_date = NA_character_, place_count_basis = NA_character_,
    source_dataset_ids = paste(unlist(r$source_dataset_ids), collapse = "|"),
    quality_flag = r$quality_flag, stringsAsFactors = FALSE
  )
}))
utils::write.csv(csv_df, summary_csv_output, row.names = FALSE, na = "")

if (!jsonlite::validate(readChar(summary_output, file_bytes(summary_output), useBytes = TRUE))) {
  stop("area-summary output failed JSON syntax validation", call. = FALSE)
}
validate_json_schema("schemas/area-summary.v2.schema.json", summary_output)

# ---- manifest --------------------------------------------------------------

raw_source_record <- function(path, url, content) {
  list(local_path = path, url = url, content = content, retrieval_date = retrieval_date,
       bytes = file_bytes(path), sha256 = sha256_file(path))
}
raw_sources <- list(
  raw_source_record(census_pdf, url_census_pdf,
    "CSO Grenada 2021 PRELIMINARY census results PDF; Table 23 'Population by Religion and Parish' (26 verbatim categories x 8 columns, integer-exact to 108,279)"),
  raw_source_record(boundary_path, url_boundary, "geoBoundaries GRD ADM1 source GeoJSON (7 parish units)"),
  raw_source_record(boundary_meta_path, url_boundary_meta, "geoBoundaries GRD ADM1 release metadata (CC BY-SA 2.0, OpenStreetMap/Wikipedia source)"),
  raw_source_record(licence_json, url_licence, "CSO Open Licence Agreement text captured via the stats.gov.gd WordPress REST endpoint (licence grant and acknowledgement-of-source notice, verbatim)")
)

output_paths <- c(summary_output, summary_csv_output, boundary_output)
output_hashes <- vapply(output_paths, sha256_file, character(1))
raw_hashes <- vapply(raw_sources, `[[`, character(1), "sha256")
combined <- paste(c(raw_hashes, output_hashes), collapse = "")
version_hash <- substr(digest(combined, algo = "sha256", serialize = FALSE), 1L, 12L)
git_commit <- tryCatch({
  value <- trimws(system2("git", c("rev-parse", "--short", "HEAD"), stdout = TRUE, stderr = TRUE))
  if (length(value) == 1L && grepl("^[a-f0-9]{7,40}$", value)) value else NULL
}, error = function(e) NULL)

durable_file_record <- function(path, content, licence_basis, licence_status,
                                row_count = NULL, feature_count = NULL) {
  record <- list(
    uri = paste0("repo:", path), storage_provider = "git_repository",
    format = sub("^.*\\.", "", path), bytes = file_bytes(path), sha256 = sha256_file(path),
    content = content, privacy = "public", licence_status = licence_status, licence_basis = licence_basis)
  if (!is.null(row_count)) record[["row_count"]] <- as.integer(row_count)
  if (!is.null(feature_count)) record[["feature_count"]] <- as.integer(feature_count)
  record
}

# full parish concordance for the manifest: source columns -> boundary feature.
concordance_manifest <- lapply(parish_meta, function(m) {
  list(area_code = m$area_code, area_name = m$area_name, shape_iso = m$shape_iso,
       shape_name = m$shape_name, source_columns = as.list(m$source_columns),
       parish_total = as.integer(parish_totals[[m$area_code]]))
})

# per-category national frame for the manifest (verbatim label, role, national count).
frame_manifest <- lapply(category_labels, function(lab) {
  role <- if (lab %in% no_religion_categories) "no_religion" else
          if (lab %in% non_response_categories) "non_response" else
          if (lab == "Other (Specify)") "residual_affiliation" else "affiliation"
  list(label_verbatim = lab, role = role, national_count = as.integer(printed_row_total[[lab]]))
})

small_cell_manifest <- list(
  rule = "docs/development/small-cell-rule.md",
  small_denominator_under_100 = list(
    threshold = 100L,
    basis = "parish population total (the metric denominator)",
    row_count = length(small_denominator_codes),
    rows = as.list(small_denominator_codes),
    note = "No Grenada parish falls under 100; the smallest parish is Carriacou & Petite Martinique (4,747)."
  ),
  small_cell_under_10 = list(
    threshold = 10L,
    basis = "any shipped verbatim category count under 10 in the parish (a downstream per-category share would rest on fewer than ten people; the count renders exactly)",
    row_count = length(small_cell_codes),
    rows = small_cell_detail,
    note = "Six of the seven parishes carry at least one category count under 10; the combined St. George parish is the exception (its smallest category, Moravian, is 12). Counts render exactly; none suppressed."
  )
)

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = paste0("manifest:gd-census-religion:gd:2021:", version_hash),
  dataset_id = "gd-census-religion:gd:2021:preliminary-table23-geoboundaries",
  dataset_version_id = paste0("gd-census-religion:gd:2021:preliminary-table23-geoboundaries:", version_hash),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "gd-census-religion",
  dataset_role = "public_product",
  scope = list(level = "country", country_codes = list("GD"), snapshot_date = NULL, pipeline_stage = "staged"),
  created_at = stamp,
  created_by = script_id,
  target_years = list(2021L),
  pipeline = list(
    script = script_id,
    git_commit = git_commit,
    command = paste("Rscript", script_id),
    parameters = list(
      wave = list(
        year = 2021L,
        status = "PRELIMINARY",
        construct = "census religion (Population by Religion and Parish, Table 23), counts by parish, 26 verbatim categories",
        geography = "7 parish units (6 parishes + Carriacou & Petite Martinique), after rolling Town of St. George into St. George parish",
        universe = "whole enumerated 2021 census population, all ages (national total 108,279)",
        denominator = "whole parish 2021 census population (all 26 categories, including the 'Not Stated' non-response line)",
        source = "CSO Grenada 2021 National Population and Housing Census Results (PRELIMINARY), Table 23",
        gate = "each of 26 religion rows sums across 8 columns to its printed national total; each of 8 columns sums over 26 rows to its printed column total; both national margins equal 108,279; after the roll-up the 7 parishes sum to 108,279 at every category and margin"
      ),
      preliminary_disclosure = list(
        status = "preliminary",
        ruling = "PI, 2026-07-12: build the 2021 PRELIMINARY wave with preliminary status disclosed on every surface; regenerate when the final report lands (queue row 83; research/countries/gd/route-probe.md is the record).",
        row_token = "census_2021_preliminary_release",
        regeneration = "Supersede with the CSO final 2021 census report when published."
      ),
      slot_design = list(
        no_religion_slot = "Atheist + No Religious Affiliation (the two distinct no-religion lines Table 23 prints; national 49 + 6,444 = 6,493). Both lines are marked no-religion in the probe frame; both are substantive no-religion responses. They stay distinct in the per-row composition.",
        no_religion_basis = "The probe (research/countries/gd/route-probe.md) records Table 23 as printing two distinct no-religion-type lines, 'Atheist' and 'No Religious Affiliation', and one separate 'Not Stated' non-response line; the no_religion slot is the sum of the two no-religion lines.",
        religious_affiliation_slot = "The 22 named affiliations plus 'Other (Specify)' residual affiliation (national 94,088).",
        non_response = "'Not Stated' (national 7,698): inside the denominator, outside both slots.",
        national_totals = list(
          affiliation = as.integer(national_affiliation),
          no_religion = as.integer(national_no_religion),
          not_stated_non_response = as.integer(national_non_response),
          total = national_total
        )
      ),
      category_frame = list(
        category_count = length(category_labels),
        preservation = "26 verbatim categories in source order, source spellings preserved ('Mormom' sic, 'Independent Baptiste' sic, 'Jehovah Witnesses', 'Muslim'); the source prints all-caps table headers, rendered here in the probe's title-case frame with spellings unchanged. No category merged or translated; the two no-religion lines stay distinct.",
        table = frame_manifest
      ),
      reconciliation = list(
        national_total = national_total,
        row_margin_status = "All 26 religion rows sum across the 8 columns to their printed national totals exactly.",
        col_margin_status = "All 8 columns sum over the 26 rows to their printed column totals exactly.",
        parish_margin_status = "After the Town-of-St.-George roll-up, the 7 parishes sum to 108,279 at every category and margin exactly.",
        printed_column_totals = as.list(printed_col_total),
        parish_totals = setNames(as.list(as.integer(parish_totals)), parish_codes),
        status = "Integer-exact at every margin; no count allocated, inferred, imputed, or tuned."
      ),
      roll_up = list(
        rule = "Town of St. George rolled into St. George parish (departure three, approved by the PI ruling).",
        basis = "Table 23 prints the Town of St. George (2,681) as a separate column from the St. George parish column (42,096); the census defines the town as part of the parish, and the 7-unit geoBoundaries ADM1 layer carries no separate town polygon. St. George parish row = 42,096 + 2,681 = 44,777 (exact, lossless).",
        concordance = concordance_manifest
      ),
      small_cell = small_cell_manifest,
      change_metric = list(
        status = "withheld",
        rationale = "Parish religion is available for 2021 only (religion is a national series in 2001 and 2011, not a parish cross-tab). No cross-wave parish change is possible."
      ),
      boundary = list(
        boundary_set_id = boundary_set_id,
        source = "geoBoundaries GRD ADM1 (gbOpen), CC BY-SA 2.0, source OpenStreetMap/Wikipedia",
        features = 7L,
        total_land_area_sq_km = boundary_result[["total_land_area"]],
        output_bytes = boundary_result[["output_bytes"]],
        distinct_written_geometry_hashes = boundary_result[["distinct_written_hash_count"]],
        join = "area_code via boundary shapeISO (7/7, one-to-one); Southern Grenadine Islands (GD-10) <-> census Carriacou & Petite Martinique; Town of St. George rolled into Saint George (GD-03)",
        simplification = c(boundary_result[["simplification"]],
                           list(byte_ceiling = 3000000L, helper = "scripts/lib/simplify_boundary.R")),
        source_geometry_sha256 = boundary_result[["source_geometry_sha256"]],
        written_geometry_sha256 = boundary_result[["written_geometry_sha256"]]
      ),
      licence_position = list(
        status = "accepted",
        basis = "cso_grenada_open_licence_agreement",
        grant_verbatim = licence_grant_verbatim,
        boundary_licence = "geoBoundaries GRD ADM1: CC BY-SA 2.0 (OpenStreetMap contributors; derived boundary ships share-alike)",
        attribution = licence_attribution,
        summary = "The CSO Open Licence Agreement grants free reuse (commercial and non-commercial) with an acknowledgement-of-source notice; the derived parish summary sits inside the grant and carries the required notice. Boundary CC BY-SA 2.0."
      ),
      raw_sources = raw_sources,
      local_cache_hint = "data/raw/gd_census/ (git-ignored; every cached source listed with URL, bytes, and SHA-256).",
      raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/gd_census/")
    ),
    software_versions = list(
      R = paste(R.version$major, R.version$minor, sep = "."),
      sf = as.character(utils::packageVersion("sf")),
      stringi = as.character(utils::packageVersion("stringi")),
      jsonlite = as.character(utils::packageVersion("jsonlite")),
      digest = as.character(utils::packageVersion("digest"))
    )
  ),
  source = list(
    provider = "Central Statistical Office of Grenada (CSO); geoBoundaries (William & Mary geoLab)",
    source_dataset_ids = list(dataset_id_census, dataset_id_boundary),
    source_urls = list(url_census_pdf, url_boundary, url_boundary_meta, url_licence),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = "Census: CSO Grenada Open Licence Agreement, accepted (2021 PRELIMINARY source). Boundary: CC BY-SA 2.0.",
    raw_redistribution = "The census PDF is a public direct download; the boundary is an open web source; intended durable mirror gs://pow-research-data/raw_sources/gd_census/.",
    citation = "CSO Grenada 2021 National Population and Housing Census Results (PRELIMINARY), Table 23 (religion by parish); geoBoundaries GRD ADM1 (CC BY-SA 2.0).",
    local_cache_hint = "data/raw/gd_census/ (git-ignored).",
    raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/gd_census/")
  ),
  input_manifests = list(),
  deferred_sources = list(
    list(layer = "2001 / 2011 waves", status = "documented non-route",
         note = "Religion is published nationally only in 2001 and 2011 (2011 Census Report Table 2.3.1, non-institutional population in private dwellings); no parish cross-tab exists for either wave. The clean unblock is a CSO data request for a religion-by-parish cross-tab (recorded as a courtesy ask, not sent)."),
    list(layer = "final 2021 report", status = "awaited",
         note = "The built wave is the 2021 PRELIMINARY release; a final 2021 report is not yet published on the CSO site. Regenerate and supersede when it lands.")
  ),
  durable_files = list(
    durable_file_record(summary_output, "Grenada single-wave parish census-religion area-summary JSON (v2, 26-category composition; 2021 PRELIMINARY)",
                        "cso_grenada_open_licence_agreement", "accepted", row_count = 7L),
    durable_file_record(summary_csv_output, "Grenada single-wave parish census-religion area-summary CSV (2021 PRELIMINARY)",
                        "cso_grenada_open_licence_agreement", "accepted", row_count = 7L),
    durable_file_record(boundary_output, "Grenada parish boundary (geoBoundaries GRD ADM1, 7 units)",
                        "cc_by_sa_2_0", "accepted", feature_count = 7L)
  ),
  partitions = list(
    list(partition_id = "gd-parish-2021", partition_type = "area",
         file_uri = paste0("repo:", summary_output), sha256 = sha256_file(summary_output),
         country_code = "GD", row_count = 7L, stage = "staged")
  ),
  stats = list(
    waves = 1L, years = "2021", parish_rows = 7L, parishes_per_wave = 7L,
    categories = length(category_labels), source_columns = length(source_columns),
    boundary_features = 7L, national_total = national_total,
    national_affiliation = as.integer(national_affiliation),
    national_no_religion = as.integer(national_no_religion),
    national_not_stated = as.integer(national_non_response),
    small_denominator_under_100_rows = length(small_denominator_codes),
    small_cell_under_10_rows = length(small_cell_codes)
  ),
  local_cache_hint = "data/raw/gd_census/ (git-ignored; every cached source listed with URL, bytes, and SHA-256).",
  validation = list(
    status = "passed",
    commands = list(
      paste("Rscript", script_id),
      paste("uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile",
            "schemas/area-summary.v2.schema.json", summary_output),
      paste("uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile",
            "schemas/data-manifest.schema.json", manifest_output),
      "bash scripts/validate_area_summaries.sh",
      "bash scripts/validate_manifests.sh"
    ),
    warnings = list(
      "PRELIMINARY 2021 source: figures are official CSO counts and reconcile exactly, but may be revised when the final 2021 report is published; regenerate then.",
      "Single wave (2021), parish level; no cross-wave change (2001/2011 religion is national only).",
      "Town of St. George rolled into St. George parish to match the 7-unit boundary (exact, lossless, disclosed).",
      "The no-religion slot combines the two distinct no-religion lines (Atheist + No Religious Affiliation); both stay distinct in composition.",
      "Six of seven parishes carry small_cell_under_10 (a verbatim category count under 10); counts render exactly."
    ),
    notes = paste(
      "Table 23 reconciles integer-exact at every margin: all 26 religion rows sum across the",
      "8 columns to their printed national totals; all 8 columns sum over the 26 rows to their",
      "printed column totals; both national margins equal 108,279; after the roll-up the 7",
      "parishes sum to 108,279 at every category and margin. Boundary output has 7 valid,",
      "non-empty, distinctly hashed geometries within the 3 MB cap. Area-summary (v2) and",
      "manifest pass schema validation. PRELIMINARY source; regenerate on the final 2021 report."
    )
  ),
  privacy = "public",
  licence_status = "accepted",
  licence_basis = "cso_grenada_open_licence_agreement",
  downstream_status = "staged",
  notes = paste(
    "Single-wave (2021 PRELIMINARY) 7-unit parish census-religion product; counts by 26",
    "verbatim categories with per-row 26-category composition, transcribed from Table 23 of",
    "the CSO 2021 preliminary census results and reconciled to 108,279 exactly at every",
    "margin. Town of St. George rolled into St. George parish (disclosed). Ships STAGED (no",
    "page, no hub link). Census reuse accepted under the CSO Open Licence Agreement; boundary",
    "CC BY-SA 2.0. Regenerate when the final 2021 report is published."
  )
)

write_json(manifest, manifest_output, auto_unbox = TRUE, pretty = TRUE, null = "null", digits = NA)

if (!jsonlite::validate(readChar(manifest_output, file_bytes(manifest_output), useBytes = TRUE))) {
  stop("manifest output is not valid JSON", call. = FALSE)
}
validate_json_schema("schemas/data-manifest.schema.json", manifest_output)

message(
  "built Grenada parish census-religion product: ", length(product_rows),
  " parish rows for 2021 (PRELIMINARY); boundary ", boundary_result[["output_bytes"]],
  " bytes, ", boundary_result[["total_land_area"]], " km2; national reconciliation exact",
  " (total ", national_total, "; affiliation ", national_affiliation, ", no-religion ",
  national_no_religion, ", not-stated ", national_non_response, "); small_cell_under_10 rows ",
  length(small_cell_codes), "; accepted."
)
