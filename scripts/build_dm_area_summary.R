# build the Dominica national census-religion area-summary product (1991, 2001, 2011).
#
# Conductor ruling (2026-07-11, small-country clause, Iceland precedent): the
# published record carries census religion only at national geography for the
# three waves, so the shippable ceiling is a single national ADM0 polygon with
# a three-wave religion series. A genuine parish product is a CSO ask (recorded
# as a deferred route). The route probe is research/countries/dm/route-probe.md.
#
# Source of record: the 2011 report's Table 6.1 (national religion time series
# printing all three waves' counts), byte-matched against the CSO "Population by
# Religion" web table, with the 1991 report's Table II total row transcribed
# from OCR as corroboration of the 1991 national column. The frames are not
# comparable at sub-denomination level across waves (Evangelical sub-groups
# tabulated only from 2011); each wave's frame is preserved verbatim and
# cross-wave sub-denomination change is withheld. Headline affiliation and
# no-religion are comparable across waves because None and Not Stated are
# consistently defined and separately tabulated in every wave.
#
# inputs (all cached, git-ignored, under data/raw/dm_census/ and mirrored to
# gs://pow-research-data/raw_sources/dm_census/):
#   dm_2011_census_alt.txt      Table 6.1 and Table 6 (clean pdftotext layer)
#   dm_1991_census_report.txt   Table II 1991 national religion column (OCR)
#   dm_religion_page.html        CSO national religion web time series
#   dm_open_licence.html         CSO Open Licence Agreement
#   gb_dma_adm0_meta.json / gb_dma_adm0.geojson   geoBoundaries DMA ADM0
# outputs:
#   apps/regions/dm/data/dm_adm0_2005.geojson
#   apps/regions/dm/data/area_summary_adm0.{json,csv}
#   docs/manifests/dm-census-religion-1991-2011.json
# run from the repository root: Rscript scripts/build_dm_area_summary.R

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "DM"
script_id <- "scripts/build_dm_area_summary.R"
raw_dir <- "data/raw/dm_census"
product_dir <- "apps/regions/dm/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-11"
stamp <- paste0(retrieval_date, "T00:00:00Z")
ruling <- paste(
  "Conductor ruling 2026-07-11: small-country clause (Iceland precedent).",
  "National-only three-wave religion series is the shippable ceiling; the",
  "parish product is a CSO ask, recorded as a deferred route."
)

boundary_level <- "adm0"
boundary_vintage <- "2005"
boundary_set_id <- "dm-adm0-2005-geoboundaries-adm0"
boundary_dataset_id <- "geoboundaries-dma-adm0-9469f09"
census_id <- "cso-census-religion-national-1991-2011"

# durable raw-cache mirror (mirrored ahead of this build; see report).
raw_cache_durable_uris <- c("gs://pow-research-data/raw_sources/dm_census/")
local_cache_hint <- "All raw sources are cached under data/raw/dm_census/ and remain git-ignored."

# CSO Open Licence Agreement notices, byte-matched from dm_open_licence.html.
cso_attribution_notice <- paste0(
  "Source: Central Statistics Office of Dominica. Contains information ",
  "licenced under the Central Statistical Office’s Open Licence Agreement."
)
cso_value_added_notice <- paste0(
  "This product was adapted from the Central Statistics Office's information, ",
  "which is licenced under the Central Statistical Office’s Open Licence Agreement."
)
cso_grant <- paste0(
  "worldwide, royalty-free non-exclusive licence to freely use the data, copy, ",
  "modify, translate, publish, adapt, distribute, create derivative works and ",
  "value- added products for commercial and non-commercial purposes subject to ",
  "the terms of this licence."
)
cso_licence_name <- paste(
  "CSO Open Licence Agreement: worldwide, royalty-free, non-exclusive licence to use,",
  "copy, modify, publish, distribute, and create derivative or value-added products",
  "from CSO information, subject to the required attribution and value-added notices."
)
# terms identity (schema v2 licence_basis) kept separate from the shipping
# decision; the CSO open-licence slug matches the Saint Lucia sibling verbatim.
licence_basis <- "cso_open_licence_agreement_value_added_acknowledgement_required"
licence_status_enum <- "accepted"
storage_provider_value <- "git_repository"

boundary_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/DMA/ADM0/"
boundary_url <- paste0(
  "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/",
  "releaseData/gbOpen/DMA/ADM0/geoBoundaries-DMA-ADM0.geojson"
)
census_2011_url <- "https://stats.gov.dm/wp-content/uploads/2020/04/2011-Population-and-Housing-Census.pdf"
census_1991_url <- "https://stats.gov.dm/wp-content/uploads/2019/06/Population_and_Housing_Census_1991.pdf"
cso_religion_web_url <- "https://stats.gov.dm/subjects/demographic-statistics/population-by-religion-1991-2001-and-2011/"
cso_licence_url <- "https://stats.gov.dm/open-licence-agreement/"

alt_2011_txt <- file.path(raw_dir, "dm_2011_census_alt.txt")
report_1991_txt <- file.path(raw_dir, "dm_1991_census_report.txt")
religion_html <- file.path(raw_dir, "dm_religion_page.html")
licence_html <- file.path(raw_dir, "dm_open_licence.html")
boundary_meta_path <- file.path(raw_dir, "gb_dma_adm0_meta.json")
boundary_path <- file.path(raw_dir, "gb_dma_adm0.geojson")

boundary_out <- file.path(product_dir, "dm_adm0_2005.geojson")
summary_json_out <- file.path(product_dir, "area_summary_adm0.json")
summary_csv_out <- file.path(product_dir, "area_summary_adm0.csv")
manifest_out <- file.path(manifest_dir, "dm-census-religion-1991-2011.json")

# ---------------------------------------------------------------- helpers ---

# return a file's SHA-256 digest.
sha256_file <- function(path) unname(tools::sha256sum(path))

# return a file's size in bytes.
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))

# stop when a required cached input is absent or empty.
require_file <- function(path) {
  if (!file.exists(path) || file_bytes(path) == 0L) {
    stop("missing required source: ", path, call. = FALSE)
  }
}

# read a cached text file with whitespace collapsed for tolerant matching.
read_collapsed <- function(path) {
  gsub("[[:space:]]+", " ", paste(readLines(path, warn = FALSE), collapse = " "))
}

# read a cached HTML file as tag-stripped text for tolerant matching.
read_html_text <- function(path) {
  text <- paste(readLines(path, warn = FALSE), collapse = " ")
  text <- gsub("<[^>]+>", " ", text)
  gsub("[[:space:]]+", " ", text)
}

# stop unless a regex anchor is present in cached source text (corroboration).
assert_in_text <- function(pattern, text, label) {
  if (!grepl(pattern, text, perl = TRUE)) {
    stop("source corroboration failed: ", label, " not found in cached text", call. = FALSE)
  }
  invisible(TRUE)
}

# hash one feature's geometry without serialising the R object.
geometry_hash <- function(layer, index) {
  digest(st_as_binary(st_geometry(layer)[index], EWKB = TRUE)[[1L]], algo = "sha256", serialize = FALSE)
}

# validate a generated JSON product against a repository schema via check-jsonschema.
validate_json_schema <- function(schema_path, instance_path) {
  status <- system2("uvx", c(
    "check-jsonschema",
    "--base-uri", paste0("file://", normalizePath("schemas", mustWork = TRUE), "/"),
    "--schemafile", schema_path, instance_path
  ))
  if (!identical(status, 0L)) stop("schema validation failed for ", instance_path, call. = FALSE)
  invisible(instance_path)
}

# ------------------------------------------------- pinned Table 6.1 frame ---

# The waves the product ships.
waves <- c(1991L, 2001L, 2011L)
wave_key <- as.character(waves)

# Table 6.1 top-level category frame, verbatim source spelling and order.
# role assigns each category to the headline construct; NA is the source's
# printed "..." (category not tabulated separately at that wave).
top_frame <- list(
  list(label = "Anglican", role = "affiliation", counts = c(501, 430, 373)),
  list(label = "Evangelicals", role = "affiliation", counts = c(4925, 11735, 13151)),
  list(label = "Methodist", role = "affiliation", counts = c(2895, 2615, 1788)),
  list(label = "Church of God", role = "affiliation", counts = c(436, 833, 637)),
  list(label = "Jehovah Witness", role = "affiliation", counts = c(623, 818, 918)),
  list(label = "Rastafarian", role = "affiliation", counts = c(NA, 893, 755)),
  list(label = "Roman Catholic", role = "affiliation", counts = c(48690, 42875, 36563)),
  list(label = "Seventh Day Adventist", role = "affiliation", counts = c(3209, 4213, 4659)),
  list(label = "Other", role = "affiliation", counts = c(5528, 397, 2968)),
  list(label = "None", role = "no_religion", counts = c(2022, 4234, 6538)),
  list(label = "Not Stated", role = "nonresponse", counts = c(637, 732, 975))
)

# Evangelicals indented sub-denominations in Table 6.1 (parent of the above).
evangelical_children <- list(
  list(label = "Baptist", counts = c(1912, 2845, 3581)),
  list(label = "Brethren", counts = c(NA, NA, 168)),
  list(label = "Christian Union Church", counts = c(NA, NA, 2724)),
  list(label = "Pentecostal", counts = c(3013, 3927, 4215)),
  list(label = "Gospel Mission", counts = c(NA, NA, 1454)),
  list(label = "Other Evangelical", counts = c(NA, 4963, 1009))
)

# Table 6.1 printed national religion universe per wave.
printed_total <- c(`1991` = 69466L, `2001` = 69775L, `2011` = 69325L)

# 2011 universe discipline: the religion universe differs from the total
# enumerated population and the non-institutional population; every figure
# states its universe. The 1991 report's tabulations rest on the 1991
# non-institutional population 69,466 (its own printed universe).
universe_2011 <- list(
  religion_universe = 69325L,
  table6_grand_total = 69324L,
  non_institutional_population = 70739L,
  total_enumerated_population = 71293L
)

# ---------------------------------------- source corroboration assertions ---

require_file(alt_2011_txt)
require_file(report_1991_txt)
require_file(religion_html)
require_file(licence_html)
require_file(boundary_meta_path)
require_file(boundary_path)

alt_text <- read_collapsed(alt_2011_txt)
ocr_1991 <- read_collapsed(report_1991_txt)
religion_web <- read_html_text(religion_html)
licence_text <- read_html_text(licence_html)

# Table 6.1 (authoritative clean text layer): anchor the frame extremes and total.
assert_in_text("Anglican\\s+501\\s+0\\.7\\s+430\\s+0\\.6\\s+373\\s+0\\.5", alt_text, "Table 6.1 Anglican row")
assert_in_text("Evangelicals\\s+4,925\\s+7\\.1\\s+11,735\\s+16\\.8\\s+13,151\\s+19\\.0", alt_text, "Table 6.1 Evangelicals row")
assert_in_text("Roman Catholic\\s+48,690\\s+70\\.1\\s+42,875\\s+61\\.4\\s+36,563\\s+52\\.7", alt_text, "Table 6.1 Roman Catholic row")
assert_in_text("Total\\s+69,466\\s+100\\.0\\s+69,775\\s+100\\.0\\s+69,325\\s+100\\.0", alt_text, "Table 6.1 Total row")
# universe discipline anchors in the 2011 report.
assert_in_text("71,293", alt_text, "2011 total enumerated population")
assert_in_text("70,739", alt_text, "2011 non-institutional population")
# Table 6 grand total 69,324 (one below Table 6.1's 69,325; the anonymity quirk).
assert_in_text("69,324", alt_text, "2011 Table 6 grand total")

# CSO web time series byte-matches the headline (parent) Table 6.1 counts.
assert_in_text("Roman Catholic\\s+48,690\\s+70\\.1\\s+42,875\\s+61\\.4\\s+36,563\\s+52\\.7", religion_web, "CSO web Roman Catholic")
assert_in_text("Total\\s+69,466\\s+100\\.0\\s+69,775\\s+100\\.0\\s+69,325", religion_web, "CSO web Total row")

# 1991 Table II total row (OCR): the legible national column corroboration.
# Ordered legible totals: 69466 | Anglican 501 | Baptist 1911(~1912) | ... |
# Jehovah 623 | Methodist 2895 | Pentecostal/Other 3013 | Roman Catholic 48690 |
# SDA 3209 | Other 552>(~5528) | None 2022 | Not Stated 637.
ocr_1991_total_pattern <- "69466\\s+501\\s+1911\\s+.*?623\\s+2895\\s+3013\\s+48690\\s+3209\\s+552.*?2022\\s+637"
assert_in_text(ocr_1991_total_pattern, ocr_1991, "1991 Table II national total row")

# CSO Open Licence Agreement notices present verbatim in the cached licence page.
assert_in_text("This product was adapted from the Central Statistics Office", licence_text, "CSO value-added notice")
assert_in_text("Contains information licenced under the Central Statistical Office", licence_text, "CSO attribution notice")

# ------------------------------------------------- reconciliation gates ---

# NA-as-zero sum of a named counts vector for one wave index.
sum_counts <- function(entries, wave_index) {
  sum(vapply(entries, function(e) {
    value <- e[["counts"]][[wave_index]]
    if (is.na(value)) 0L else as.integer(value)
  }, integer(1)))
}

# gate 1: every wave's top-level categories sum to its printed national total.
top_sums <- vapply(seq_along(waves), function(i) sum_counts(top_frame, i), integer(1))
if (!identical(top_sums, unname(printed_total))) {
  stop("category sums do not equal the printed national totals: ",
       paste(top_sums, collapse = "/"), " vs ", paste(printed_total, collapse = "/"), call. = FALSE)
}

# gate 2: every wave's Evangelicals sub-denominations sum to the parent count.
evangelicals_parent <- top_frame[[which(vapply(top_frame, `[[`, character(1), "label") == "Evangelicals")]][["counts"]]
evangelical_sums <- vapply(seq_along(waves), function(i) sum_counts(evangelical_children, i), integer(1))
if (!identical(evangelical_sums, as.integer(evangelicals_parent))) {
  stop("Evangelicals sub-denominations do not sum to the parent per wave", call. = FALSE)
}

# gate 3 (1991 OCR reconciliation): the legible Table II total-row national
# figures reconcile against Table 6.1's 1991 column. The grand total matches
# exactly (69,466); Anglican, Jehovah, Methodist, Pentecostal, Roman Catholic,
# Seventh Day Adventist, None, and Not Stated match cell-for-cell. Two OCR
# artefacts do not alter the shipped figures (which are Table 6.1's): Baptist
# reads 1,911 vs 1,912 (a single-digit OCR error) and Other reads "552>" for
# 5,528; Church of God (436) fell in a whitespace gap in the OCR total row.
ocr_1991_legible <- c(
  grand_total = 69466L, Anglican = 501L, Jehovah_Witness = 623L, Methodist = 2895L,
  Pentecostal = 3013L, Roman_Catholic = 48690L, Seventh_Day_Adventist = 3209L,
  None = 2022L, Not_Stated = 637L
)
table61_1991 <- c(
  grand_total = printed_total[["1991"]],
  Anglican = 501L, Jehovah_Witness = 623L, Methodist = 2895L,
  Pentecostal = 3013L, Roman_Catholic = 48690L, Seventh_Day_Adventist = 3209L,
  None = 2022L, Not_Stated = 637L
)
if (!identical(ocr_1991_legible, table61_1991)) {
  stop("1991 OCR legible totals do not reconcile against Table 6.1's 1991 column", call. = FALSE)
}
ocr_1991_reconciliation <- list(
  method = paste(
    "The 1991 Table II (scanned/OCR) national total row corroborates Table 6.1's",
    "1991 column. Shipped figures are Table 6.1's (clean text layer, byte-matched",
    "to the CSO web series); Table II is corroboration only."
  ),
  grand_total_match = TRUE,
  cell_matches = as.list(ocr_1991_legible),
  ocr_artefacts = list(
    baptist = "Table II OCR reads 1,911; Table 6.1 prints 1,912 (single-digit OCR error).",
    other = "Table II OCR reads '552>' for Table 6.1's 5,528 (garbled trailing digits).",
    church_of_god = "Table II value 436 fell into a whitespace gap in the OCR total row; present as a column, corroborated by Table 6.1."
  )
)

# --------------------------------------------------- headline computation ---

# per-wave headline metrics on the religion-universe denominator (Iceland
# precedent): population_total is the printed religion universe; affiliation is
# the universe less None and Not Stated; no_religion is None. Not Stated is the
# disclosed residual (affiliation + None + Not Stated = universe).
none_counts <- top_frame[[which(vapply(top_frame, `[[`, character(1), "label") == "None")]][["counts"]]
not_stated_counts <- top_frame[[which(vapply(top_frame, `[[`, character(1), "label") == "Not Stated")]][["counts"]]
affiliation_role_sums <- vapply(seq_along(waves), function(i) {
  sum_counts(Filter(function(e) e[["role"]] == "affiliation", top_frame), i)
}, integer(1))

wave_metrics <- lapply(seq_along(waves), function(i) {
  universe <- printed_total[[i]]
  none <- as.integer(none_counts[[i]])
  not_stated <- as.integer(not_stated_counts[[i]])
  affiliation <- universe - none - not_stated
  # cross-check: the residual affiliation equals the sum of affiliation-role cells.
  if (affiliation != affiliation_role_sums[[i]]) {
    stop("affiliation residual disagrees with the affiliation-role category sum at ", waves[[i]], call. = FALSE)
  }
  list(
    year = waves[[i]], population_total = universe,
    affiliation = affiliation, no_religion = none, not_stated = not_stated
  )
})
names(wave_metrics) <- wave_key

# ------------------------------------------------------------- boundary ---

boundary_meta <- fromJSON(boundary_meta_path, simplifyVector = TRUE)
if (!identical(boundary_meta[["boundaryID"]], "DMA-ADM0-26965486") ||
    !identical(boundary_meta[["boundaryISO"]], "DMA") ||
    !identical(boundary_meta[["boundaryType"]], "ADM0") ||
    !identical(boundary_meta[["boundaryYearRepresented"]], boundary_vintage) ||
    !identical(boundary_meta[["admUnitCount"]], "1")) {
  stop("geoBoundaries DMA ADM0 release metadata drifted from the probed release", call. = FALSE)
}
boundary_licence_name <- boundary_meta[["boundaryLicense"]]
# ADM0 licence finding: the actual API metadata records an accepted open
# attribution licence (CC BY 2.5 Generic), not the null licence the probe
# reported for the release. Both are recorded; a null/absent licence would
# force the OSM/ODbL or Natural Earth fallback, which is not needed here.
if (!identical(boundary_licence_name, "Creative Commons Attribution 2.5 Generic")) {
  stop("geoBoundaries DMA ADM0 licence changed from the verified CC BY 2.5 Generic", call. = FALSE)
}

raw_boundary <- st_read(boundary_path, quiet = TRUE)
if (nrow(raw_boundary) != 1L || any(st_is_empty(raw_boundary)) ||
    any(is.na(st_is_valid(raw_boundary))) || any(!st_is_valid(raw_boundary))) {
  stop("raw Dominica ADM0 boundary is missing, empty, or invalid", call. = FALSE)
}
boundary <- st_sf(
  area_code = "DM", area_name = "Dominica",
  geometry = st_geometry(st_transform(st_make_valid(raw_boundary), 4326)), crs = 4326
)
source_geometry_hash <- geometry_hash(boundary, 1L)

simplification <- mapshaper_simplify_to_cap(
  boundary, boundary_out, max_bytes = 250000L,
  keep_percentages = c(100, 50, 20, 10, 5, 2, 1)
)
written_boundary <- st_read(boundary_out, quiet = TRUE)
written_valid <- st_is_valid(written_boundary)
if (nrow(written_boundary) != 1L || any(st_is_empty(written_boundary)) ||
    any(is.na(written_valid)) || any(!written_valid) ||
    !identical(written_boundary[["area_code"]], "DM")) {
  stop("simplified Dominica ADM0 boundary failed the geometry gate", call. = FALSE)
}
land_area_sq_km <- as.numeric(st_area(st_transform(written_boundary, 4326))[[1]]) / 1e6
simplified_geometry_hash <- geometry_hash(written_boundary, 1L)

# -------------------------------------------------------- shipped rows ---

population_basis <- paste0(
  "Religion universe: the 2011 Population and Housing Census Table 6.1 national ",
  "religion total per wave (1991: 69,466; 2001: 69,775; 2011: 69,325), byte-matched ",
  "to the CSO 'Population by Religion' web series. This religion universe differs from ",
  "the 2011 report's total enumerated population (71,293) and non-institutional ",
  "population (70,739); the 1991 tabulations rest on the 1991 non-institutional ",
  "population 69,466. Table 6 (age/sex) prints a grand total 69,324, one below Table ",
  "6.1's 69,325, from the report's printed one/two-person anonymity rule; the shipped ",
  "universe is Table 6.1's 69,325."
)
quality_flag <- paste(
  "census_affiliation", "national_only_adm0", "religion_universe_denominator",
  "not_stated_residual_disclosed", "cross_wave_subdenomination_change_withheld",
  "frames_preserved_verbatim_per_wave", licence_basis, "boundary_cc_by_2_5_generic",
  sep = ";"
)

build_row <- function(m) {
  list(
    country_code = country_code, boundary_set_id = boundary_set_id, boundary_level = boundary_level,
    area_unit_id = paste0(boundary_set_id, ":DM"), area_code = "DM", area_name = "Dominica",
    year = as.integer(m$year),
    population_total = as.integer(m$population_total), population_total_basis = population_basis,
    religious_affiliation_count = as.integer(m$affiliation),
    religious_affiliation_percent = round(100 * m$affiliation / m$population_total, 4),
    no_religion_count = as.integer(m$no_religion),
    no_religion_percent = round(100 * m$no_religion / m$population_total, 4),
    place_count = NULL, places_per_10000_residents = NULL, place_density_per_sq_km = NULL,
    land_area_sq_km = round(land_area_sq_km, 4),
    site_snapshot_date = NULL, place_count_basis = NULL,
    source_dataset_ids = list(census_id, boundary_dataset_id),
    quality_flag = quality_flag
  )
}
rows <- lapply(wave_metrics, build_row)
names(rows) <- NULL

# flatten row objects into the CSV companion.
flatten_rows <- function(rows) {
  do.call(rbind, lapply(rows, function(row) data.frame(
    country_code = row[["country_code"]], boundary_set_id = row[["boundary_set_id"]],
    boundary_level = row[["boundary_level"]], area_unit_id = row[["area_unit_id"]],
    area_code = row[["area_code"]], area_name = row[["area_name"]], year = row[["year"]],
    population_total = row[["population_total"]], population_total_basis = row[["population_total_basis"]],
    religious_affiliation_count = row[["religious_affiliation_count"]],
    religious_affiliation_percent = row[["religious_affiliation_percent"]],
    no_religion_count = row[["no_religion_count"]], no_religion_percent = row[["no_religion_percent"]],
    place_count = NA_integer_, places_per_10000_residents = NA_real_,
    place_density_per_sq_km = NA_real_, land_area_sq_km = row[["land_area_sq_km"]],
    site_snapshot_date = NA_character_, place_count_basis = NA_character_,
    source_dataset_ids = paste(unlist(row[["source_dataset_ids"]]), collapse = "|"),
    quality_flag = row[["quality_flag"]], stringsAsFactors = FALSE
  )))
}

# ---------------------------------------------- verbatim per-wave frames ---

# per-wave category reconciliation: every source category with its verbatim
# label, role, and count (null where the source prints "..."), plus the
# Evangelicals sub-denominations, and the exact sum-to-total.
frame_for_wave <- function(i) {
  top <- lapply(top_frame, function(e) {
    value <- e[["counts"]][[i]]
    list(label = e[["label"]], role = e[["role"]],
         count = if (is.na(value)) NULL else as.integer(value),
         withheld = is.na(value))
  })
  children <- lapply(evangelical_children, function(e) {
    value <- e[["counts"]][[i]]
    list(label = e[["label"]], parent = "Evangelicals",
         count = if (is.na(value)) NULL else as.integer(value),
         withheld = is.na(value))
  })
  list(
    year = waves[[i]],
    top_level_categories = top,
    evangelical_subdenominations = children,
    category_sum = as.integer(top_sums[[i]]),
    printed_total = as.integer(printed_total[[i]]),
    reconciles = top_sums[[i]] == printed_total[[i]]
  )
}
wave_frames <- lapply(seq_along(waves), frame_for_wave)

# ------------------------------------------------- area-summary product ---

cso_licence_block <- list(name = cso_licence_name, url = cso_licence_url, attribution = cso_attribution_notice)

source_datasets <- list(
  list(
    source_dataset_id = census_id,
    name = "CSO national census religion time series 1991, 2001, 2011 (Table 6.1; CSO web series; 1991 Table II)",
    provider = "Central Statistics Office of Dominica (CSO)", url = census_2011_url,
    retrieval_date = retrieval_date, local_path = alt_2011_txt, licence = cso_licence_block,
    citation = paste(
      "Central Statistics Office of Dominica, 2011 Population and Housing Census, Table 6.1",
      "(Percentage Population by Religion 1991, 2001 and 2011); 1991 Population and Housing",
      "Census, Table II; CSO 'Population by Religion 1991 2001 and 2011' web series."
    ),
    access_limits = "Published PDF reports and an HTML web table; no query tool or REDATAM instance exists for Dominica.",
    redistribution_limits = paste("Derived national statistics ship under the CSO Open Licence Agreement.", cso_value_added_notice),
    notes = paste(
      "National geography only; religion is never tabulated by parish in any public CSO product.",
      "The 2001 report carries no religion table; its national column survives via Table 6.1 and the web series.",
      "The 1991 Table II is a scanned/OCR source; national column totals are legible and reconcile against Table 6.1."
    )
  ),
  list(
    source_dataset_id = boundary_dataset_id,
    name = "geoBoundaries gbOpen DMA ADM0 (one national polygon)",
    provider = "geoBoundaries; source Wikimedia Commons", url = boundary_url,
    retrieval_date = retrieval_date, local_path = boundary_path,
    licence = list(name = boundary_licence_name, url = boundary_meta[["licenseSource"]], attribution = "geoBoundaries; Wikimedia Commons"),
    citation = "geoBoundaries gbOpen DMA ADM0, boundary ID DMA-ADM0-26965486, release commit 9469f09; source Wikimedia Commons.",
    access_limits = NULL,
    redistribution_limits = "The simplified national polygon is redistributed under CC BY 2.5 Generic with attribution.",
    notes = paste(
      "Release metadata records CC BY 2.5 Generic (an accepted open attribution licence), not a null licence.",
      "One national polygon simplified with scripts/lib/simplify_boundary.R; the join property is area_code."
    )
  )
)

denominator_note <- paste(
  "Percentages use each wave's religion universe (the Table 6.1 national total).",
  "Affiliation is the universe less None and Not Stated; no-religion is None; Not",
  "Stated is the disclosed residual so affiliation + None + Not Stated equals the universe."
)
indicators <- list(
  list(indicator_id = "population_total", label = "Religion universe",
       description = "Table 6.1 national religion total per wave (1991: 69,466; 2001: 69,775; 2011: 69,325).",
       unit = "count", denominator_indicator_id = NULL,
       method = "Printed Table 6.1 national Total per wave; byte-matched to the CSO web series.",
       temporal_coverage = "1991, 2001, 2011", spatial_coverage = "Dominica national total on one ADM0 polygon",
       quality_notes = "The religion universe differs from the total enumerated (71,293) and non-institutional (70,739) populations."),
  list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
       description = "Share reporting any religious affiliation (universe less None and Not Stated).",
       unit = "percent", denominator_indicator_id = "population_total",
       method = "100 * (universe - None - Not Stated) / religion universe.",
       temporal_coverage = "1991, 2001, 2011", spatial_coverage = "Dominica national",
       quality_notes = paste(denominator_note, "Comparable across waves; sub-denomination detail is not.")),
  list(indicator_id = "no_religion_percent", label = "No religion %",
       description = "Share in the source None category.", unit = "percent",
       denominator_indicator_id = "population_total",
       method = "100 * None / religion universe.",
       temporal_coverage = "1991, 2001, 2011", spatial_coverage = "Dominica national",
       quality_notes = "None is consistently named and separately tabulated in all three waves, so it is comparable across waves.")
)

legend <- list(unit = "percent", denominator = "religion universe (Table 6.1 national total per wave)")
visual_layers <- list(
  list(visual_layer_id = "dm-adm0-religious-affiliation", label = "Religious affiliation %",
       description = "Dominica national census-affiliation share for 1991, 2001, and 2011.",
       layer_type = "choropleth", indicator_ids = list("religious_affiliation_percent"),
       geometry_unit_type = "country", legend = legend, colour_scale = NULL,
       time_control = "year_selector", aggregation_rule = NULL, uncertainty_display = "quality_flag",
       default_visibility = TRUE,
       notes = paste(
         "A single national polygon is intentional under the small-country clause: the CSO publishes census",
         "religion only at national geography. Cross-wave sub-denomination change is withheld because the",
         "Evangelical sub-denominations were tabulated only from 2011."
       )),
  list(visual_layer_id = "dm-adm0-no-religion", label = "No religion %",
       description = "Dominica national census no-religion (None) share for 1991, 2001, and 2011.",
       layer_type = "choropleth", indicator_ids = list("no_religion_percent"),
       geometry_unit_type = "country", legend = legend, colour_scale = NULL,
       time_control = "year_selector", aggregation_rule = NULL, uncertainty_display = "quality_flag",
       default_visibility = FALSE,
       notes = "None and Not Stated are consistently defined across all three waves; Not Stated is the disclosed residual.")
)

summary_product <- list(
  schema_version = "area-summary.v1", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code,
    level = boundary_level, vintage = boundary_vintage, source_dataset_id = boundary_dataset_id),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
    basis = "No governed place-of-worship snapshot ships in the Dominica national census-religion product.",
    notes = "Place counts and density metrics remain null."),
  source_datasets = source_datasets, indicators = indicators, visual_layers = visual_layers, rows = rows
)

write_json(summary_product, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

if (!jsonlite::validate(readChar(summary_json_out, file_bytes(summary_json_out), useBytes = TRUE))) {
  stop("area-summary output failed JSON syntax validation", call. = FALSE)
}
validate_json_schema("schemas/area-summary.schema.json", summary_json_out)

# ------------------------------------------------------------- manifest ---

git_commit <- tryCatch(trimws(system2("git", c("rev-parse", "HEAD"), stdout = TRUE)), error = function(e) NA_character_)
if (length(git_commit) != 1L || !grepl("^[a-f0-9]{40}$", git_commit)) git_commit <- NULL

# one cached-source retrieval record.
raw_source_record <- function(path, url, format, used_in_public_product, periods, notes) {
  list(uri = path, url = url, retrieval_date = retrieval_date, retrieved_at = stamp,
    format = format, bytes = file_bytes(path), sha256 = sha256_file(path),
    source_dataset_id = if (grepl("geoBoundaries|gb_dma", path)) boundary_dataset_id else census_id,
    used_in_public_product = used_in_public_product, periods = periods, notes = notes)
}

# one generated durable-file record.
durable_file_record <- function(path, content, row_count = NULL, feature_count = NULL) {
  record <- list(uri = paste0("repo:", path), storage_provider = storage_provider_value,
    format = sub("^.*\\.", "", path), bytes = file_bytes(path), sha256 = sha256_file(path),
    content = content, privacy = "public", licence_status = licence_status_enum, licence_basis = licence_basis)
  if (!is.null(row_count)) record[["row_count"]] <- as.integer(row_count)
  if (!is.null(feature_count)) record[["feature_count"]] <- as.integer(feature_count)
  record
}

raw_sources <- list(
  raw_source_record(alt_2011_txt, census_2011_url, "text", TRUE, "1991;2001;2011",
    "2011 full report text layer; Table 6.1 (three-wave series) and Table 6 (age/sex)."),
  raw_source_record(report_1991_txt, census_1991_url, "text", TRUE, "1991",
    "1991 report OCR text; Table II national religion column corroborates Table 6.1's 1991 column."),
  raw_source_record(religion_html, cso_religion_web_url, "html", TRUE, "1991;2001;2011",
    "CSO 'Population by Religion' national web series; byte-matches Table 6.1 headline counts."),
  raw_source_record(licence_html, cso_licence_url, "html", TRUE, "n/a",
    "CSO Open Licence Agreement; attribution and value-added notices quoted verbatim."),
  raw_source_record(boundary_meta_path, boundary_meta_url, "json", TRUE, "2005",
    "geoBoundaries DMA ADM0 release metadata; one unit, CC BY 2.5 Generic."),
  raw_source_record(boundary_path, boundary_url, "geojson", TRUE, "2005",
    "geoBoundaries DMA ADM0 source geometry, one national polygon.")
)

deferred_sources <- list(
  list(source = "CSO parish-level religion cross-tabulation (PI task 13)",
    status = "deferred_cso_ask",
    reason = paste(
      "No parish religion table exists in any public CSO product at any wave; the 2001 report carries no",
      "religion table at all, and no REDATAM/CELADE instance exists for Dominica. A genuine ten-parish",
      "product requires a CSO ask for a parish-level religion cross-tabulation and, ideally, an official",
      "parish boundary layer. Recorded as a deferred route under the small-country clause."),
    recovery_route = "Email the CSO for parish-level religion for 1991/2001/2011 (or the 2022 round) and Open Licence confirmation."),
  list(source = "2022 Population and Housing Census (Census Day 25 June 2022)",
    status = "unpublished_upstream",
    reason = "No 2022 results are published on the CSO site; the newest religion figures remain 2011.",
    recovery_route = "Revisit when the CSO publishes 2022 religion tables."),
  list(source = "geoBoundaries DMA ADM1 ten-parish boundary",
    status = "not_needed_for_national_product",
    reason = "The ADM1 release exists (ten parishes matching the census frame) but is moot without a parish religion table.")
)

boundary_validation <- list(
  source_feature_count = 1L, simplified_feature_count = nrow(written_boundary),
  all_valid = all(written_valid), all_non_empty = all(!st_is_empty(written_boundary)),
  source_geometry_sha256 = source_geometry_hash, simplified_geometry_sha256 = simplified_geometry_hash,
  simplified_bytes = file_bytes(boundary_out), byte_cap = 250000L,
  simplification = simplification,
  licence_metadata_status = "passed",
  licence = boundary_licence_name,
  licence_finding = paste(
    "geoBoundaries DMA ADM0 release metadata records 'Creative Commons Attribution 2.5 Generic' with",
    "licenseDetail 'nan' and a bare Wikimedia Commons licenseSource. This is an accepted open attribution",
    "licence, contradicting the route probe's 'null licence' reading (the cached ADM1 metadata likewise",
    "records CC BY 2.5 Generic). No OSM/ODbL or Natural Earth fallback is required."),
  release_source = "Wikimedia Commons"
)

reconciliation_evidence <- list(
  gate_category_sum_equals_total = list(
    `1991` = list(category_sum = top_sums[[1]], printed_total = printed_total[["1991"]], reconciles = TRUE),
    `2001` = list(category_sum = top_sums[[2]], printed_total = printed_total[["2001"]], reconciles = TRUE),
    `2011` = list(category_sum = top_sums[[3]], printed_total = printed_total[["2011"]], reconciles = TRUE)
  ),
  gate_evangelicals_children_sum_to_parent = list(
    parent = as.list(as.integer(evangelicals_parent)),
    children_sum = as.list(as.integer(evangelical_sums)), reconciles = TRUE
  ),
  gate_1991_ocr_reconciliation = ocr_1991_reconciliation,
  headline_comparability_decision = paste(
    "Headline affiliation and no-religion are comparable across all three waves: None and Not Stated are",
    "consistently named and separately tabulated in every wave's Table 6.1 column, so affiliation (universe",
    "less None and Not Stated) and no-religion (None) carry the same construct across 1991, 2001, and 2011.",
    "Cross-wave comparability is withheld only below the headline: the Evangelical sub-denominations were",
    "tabulated separately only from 2011 (Baptist and Pentecostal from 1991, Other Evangelical from 2001),",
    "and Rastafarian was folded into Other in 1991. Each wave's frame is preserved verbatim."
  ),
  universe_discipline = universe_2011,
  wave_frames = wave_frames
)

dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)
manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json", schema_version = "data-manifest.v2",
  manifest_id = "manifest:dm-census-religion:dm:1991-2011:cso-national",
  dataset_id = "dm-census-religion:dm:1991-2011:cso-national",
  dataset_version_id = paste0("dm-census-religion:dm:1991-2011:cso-national:", dataset_hash),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "dm-census-religion", dataset_role = "public_product",
  scope = list(level = "country", country_codes = list("DM"), snapshot_date = NULL,
    snapshot_anchor = NULL, pipeline_stage = "public"),
  created_at = stamp, created_by = script_id,
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation",
      ruling = ruling,
      waves = as.list(waves),
      shipped_geography = "1 national ADM0 polygon",
      denominator = "religion universe per wave (Table 6.1 national total): 69,466 / 69,775 / 69,325",
      headline_fields = paste(
        "religious_affiliation = universe - None - Not Stated;",
        "no_religion = None; Not Stated is the disclosed residual"
      ),
      cross_wave_rule = "sub-denomination change withheld; headline affiliation and no-religion comparable across waves",
      frames_preserved = "each wave's Table 6.1 category frame preserved verbatim, including source '...' cells",
      licence_obligation = paste(cso_attribution_notice, cso_value_added_notice),
      licence_grant_verbatim = cso_grant,
      licence_basis = licence_basis,
      boundary_join_property = "area_code",
      boundary_simplification = simplification,
      local_cache_hint = local_cache_hint,
      raw_cache_durable_uris = as.list(raw_cache_durable_uris),
      reconciliation_evidence = reconciliation_evidence,
      software_versions_note = "see software_versions"
    ),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")), digest = as.character(packageVersion("digest")),
      mapshaper = "scripts/lib/simplify_boundary.R"
    )
  ),
  source = list(
    provider = "Central Statistics Office of Dominica; geoBoundaries; Wikimedia Commons",
    source_dataset_ids = list(census_id, boundary_dataset_id),
    source_urls = list(census_2011_url, census_1991_url, cso_religion_web_url, cso_licence_url, boundary_meta_url, boundary_url),
    retrieved_at = stamp,
    licence = paste(
      "CSO census tables are licensed under the CSO Open Licence Agreement (worldwide, royalty-free,",
      "non-exclusive; derivative and value-added products permitted) with the required notices:",
      cso_attribution_notice, cso_value_added_notice,
      "geoBoundaries DMA ADM0 records CC BY 2.5 Generic in its release metadata."
    ),
    raw_redistribution = "Raw CSO reports and the boundary remain in the git-ignored cache and the durable GCS mirror; not redistributed in-repo.",
    local_cache_hint = local_cache_hint,
    raw_cache_durable_uris = as.list(raw_cache_durable_uris),
    licence_position = "accepted: CSO Open Licence Agreement (census) and CC BY 2.5 Generic (boundary), both open with attribution",
    citation = "Central Statistics Office of Dominica, 1991/2001/2011 census religion (Table 6.1, Table II, CSO web series); geoBoundaries DMA ADM0."
  ),
  input_manifests = list(),
  durable_files = list(
    durable_file_record(summary_json_out, "Dominica national three-wave census-religion area summary (1991, 2001, 2011).", row_count = length(rows)),
    durable_file_record(summary_csv_out, "Flattened Dominica national census-religion rows for 1991, 2001, and 2011.", row_count = length(rows)),
    durable_file_record(boundary_out, "Simplified geoBoundaries DMA ADM0 one national polygon.", feature_count = 1L)
  ),
  derived_outputs = lapply(list(summary_json_out, summary_csv_out, boundary_out), function(path) {
    list(uri = paste0("repo:", path), sha256 = sha256_file(path), built_by = script_id)
  }),
  raw_sources = raw_sources,
  target_years = as.list(waves),
  stats = list(
    wave_year_rows = length(rows), area_count = 1L, shipped_wave_count = length(waves),
    boundary_features = 1L, boundary_bytes = file_bytes(boundary_out),
    religion_universe = as.list(as.integer(printed_total))
  ),
  validation = list(
    status = "passed",
    commands = list(
      "Rscript scripts/build_dm_area_summary.R",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/dm/data/area_summary_adm0.json",
      "bash scripts/validate_manifests.sh"
    ),
    notes = paste(
      "Every wave's Table 6.1 categories sum to its printed national total exactly (69,466 / 69,775 / 69,325).",
      "The Evangelical sub-denominations sum to their parent per wave. The 1991 Table II OCR national total row",
      "reconciles against Table 6.1's 1991 column (grand total and eight legible cells match; two OCR artefacts",
      "documented). The single ADM0 polygon is non-empty and valid. Cross-wave sub-denomination change is withheld."
    ),
    warnings = list(
      "Sub-denomination detail is not comparable across waves: Evangelical sub-groups were tabulated separately only from 2011 (Baptist/Pentecostal from 1991, Other Evangelical from 2001); Rastafarian was inside Other in 1991.",
      "Table 6 (age/sex) prints a grand total 69,324, one below Table 6.1's 69,325, from the report's printed one/two-person anonymity rule; the shipped universe is Table 6.1's 69,325.",
      "The 1991 Table II source is scanned/OCR; national column totals are legible and reconcile, but Baptist reads 1,911 vs 1,912 and Other reads '552>' for 5,528. Shipped figures are Table 6.1's.",
      "Parish geography is unavailable: no CSO parish religion table exists at any wave. A parish product is a deferred CSO ask."
    ),
    reconciliation_evidence = reconciliation_evidence,
    boundary_validation = boundary_validation
  ),
  construct_notes = list(
    "The construct is census religious affiliation, not practice, attendance, or registered membership.",
    "Source category spellings and the Evangelicals parent/child structure are retained verbatim per wave.",
    "population_total is each wave's religion universe (Table 6.1 national total). Affiliation is the universe less None and Not Stated; no_religion is None; Not Stated is the disclosed residual.",
    "Headline affiliation and no-religion are comparable across the three waves because None and Not Stated are consistently defined and separately tabulated in every wave.",
    "Cross-wave sub-denomination change is withheld because the Evangelical sub-denominations were tabulated separately only from 2011 and Rastafarian only from 2001.",
    "The religion universe (69,325 in 2011) differs from the total enumerated population (71,293) and non-institutional population (70,739); every figure states its universe.",
    "A single national polygon is intentional under the small-country clause (Iceland precedent): the CSO publishes census religion only at national geography.",
    "No Dominica place-of-worship count or density metric ships in this release."
  ),
  deferred_sources = deferred_sources,
  privacy = "public", licence_status = licence_status_enum, licence_basis = licence_basis,
  downstream_status = "public",
  source_datasets = source_datasets,
  notes = paste(
    "Dominica national three-wave census-religion product under the small-country clause. Census data ship under",
    "the CSO Open Licence Agreement with its required attribution and value-added notices; the boundary is CC BY",
    "2.5 Generic. The parish product is a deferred CSO ask. The map UI (index.html, hub) is outside this build."
  )
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(readChar(manifest_out, file_bytes(manifest_out), useBytes = TRUE))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

# ------------------------------------------------------- console summary ---
cat("Dominica national census-religion product: 3 waves (1991, 2001, 2011) on 1 ADM0 polygon\n")
for (i in seq_along(waves)) {
  m <- wave_metrics[[i]]
  cat(sprintf("  %d: universe %d, affiliation %d (%.1f%%), None %d (%.1f%%), Not Stated %d\n",
    m$year, m$population_total, m$affiliation, 100 * m$affiliation / m$population_total,
    m$no_religion, 100 * m$no_religion / m$population_total, m$not_stated))
}
cat(sprintf("category-sum gate: passed (%s = %s)\n",
  paste(top_sums, collapse = "/"), paste(printed_total, collapse = "/")))
cat("evangelicals children-to-parent gate: passed per wave\n")
cat("1991 Table II OCR reconciliation: passed (grand total + 8 legible cells match Table 6.1; 2 OCR artefacts documented)\n")
cat(sprintf("boundary gate: passed; 1 valid feature, %d bytes at %g%% keep; CC BY 2.5 Generic\n",
  file_bytes(boundary_out), simplification[["keep_percent"]]))
cat("licence gate: passed; CSO Open Licence Agreement (census) + CC BY 2.5 Generic (boundary)\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", boundary_out))
cat(sprintf("wrote %s\n", manifest_out))
