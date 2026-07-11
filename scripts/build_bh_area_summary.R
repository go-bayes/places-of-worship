# build the Bahrain 2020 national census-religion area-summary product.
#
# Conductor ruling (2026-07-11, small-country clause + minority-share two-slot
# design): Bahrain publishes census religion nationally only, in a single
# machine-readable openly licensed wave (2020) on the iGA open-data portal
# data.gov.bh, in a flat two-line Muslim/Others frame (مسلم / أخرى) that sums
# to the total by construction. The shippable ceiling is therefore ONE national
# ADM0 polygon carrying a single-wave (2020) all-persons Muslim/Others series.
# The route probe is research/countries/bh/route-probe.md.
#
# MINORITY-SHARE TWO-SLOT DESIGN (docs/development/minority-share-metric.md,
# BD/KH/LK precedent): the frame qualifies (two published categories summing to
# the total, no no-religion and no not-stated line). religious_affiliation_percent
# carries the reference-group share (Muslim, Bahrain's largest published
# category); no_religion_percent carries its exact complement, the minority share
# (the Others line). The no_religion slot key is the legacy runtime field name and
# carries no no-religion, belief, practice, or secularity semantics here. The two
# slots sum to 100 in the row by construction.
#
# SOURCE-OF-RECORD RULE: counts come from the iGA 2020 census religion cut
# (religion x nationality x sex, 8 rows). A second published cut (sex x age-group
# x religion x nationality, 112 rows) reconciles independently to the identical
# margins and is recorded as published detail, not as data rows.
#
# GATES (stop, never tune): both cached cuts must reconcile independently to
# Muslim 1,111,533 / Others 390,102 / total 1,501,635; the two metric slots must
# be exact complements; the boundary must be exactly 1 valid national polygon.
#
# 2010 HELD: the 2010 census religion national total (1,234,571 / Muslim 866,888
# / non-Muslim 367,683) survives only in secondary and blocked-government-page
# sources; its primary portal is dead and it is absent from data.gov.bh. No 2010
# rows, no change metric; single_wave_2020 token, no change_withheld token.
#
# Licence: explicit open licence. Bahrain Open Government Data License v1.0
# (20 May 2025), byte-matched from the cached licence PDF; the required §3.3c
# attribution statement and §3.3b self-analysis disclaimer are quoted verbatim.
# Boundary: geoBoundaries BHR ADM0 (1 unit, ODbL 1.0, boundaryYearRepresented
# 2017); OpenStreetMap contributors attribution.
#
# inputs (all cached, git-ignored under data/raw/bh_census/):
#   bh_2020_religion.csv            cut 1: religion x nationality x sex (8 rows)
#   bh_2020_religion_agegroups.csv  cut 2: sex x age-group x religion x nationality (112 rows)
#   bh_2020_religion_api.json       cut 1 via Opendatasoft API (corroboration)
#   bh_2020_meta.json               dataset metadata (publisher, attributions)
#   bh_open_data_license.pdf/.txt   OGDL v1.0 licence (byte-matched quotes)
#   gb_bhr_adm0_meta.json           geoBoundaries BHR ADM0 release metadata
#   geoBoundaries-BHR-ADM0.geojson  geoBoundaries BHR ADM0 (1 national polygon)
# outputs:
#   apps/regions/bh/data/bh_national.geojson
#   apps/regions/bh/data/area_summary_national.{json,csv}
#   docs/manifests/bh-census-religion-2020.json
# run from the repository root: Rscript scripts/build_bh_area_summary.R

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "BH"
script_id <- "scripts/build_bh_area_summary.R"
raw_dir <- "data/raw/bh_census"
product_dir <- "apps/regions/bh/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-11"
stamp <- paste0(retrieval_date, "T00:00:00Z")
census_year <- 2020L

ruling <- paste(
  "Conductor ruling 2026-07-11: small-country clause (national-only ceiling) plus the",
  "minority-share two-slot design (BD/KH/LK precedent). Bahrain publishes census religion",
  "nationally only, in a single machine-readable open-licensed wave (2020) on data.gov.bh,",
  "in a flat two-line Muslim/Others frame summing to the total by construction. The product",
  "is one national ADM0 polygon carrying a single-wave 2020 all-persons Muslim/Others series;",
  "religious_affiliation_percent is the reference-group (Muslim) share and no_religion_percent",
  "its exact complement, the minority share (the Others line). 2010 is HELD (dead portal,",
  "absent from the open-data portal): no 2010 rows and no change metric."
)

boundary_level <- "adm0"
boundary_vintage <- "2017"
boundary_set_id <- "bh-adm0-2017-geoboundaries"
boundary_dataset_id <- "geoboundaries-bhr-adm0-9469f09"
census_id <- "iga-bh-census-2020-religion-national"

# minority-share design: the reference group is the largest published national
# category, held constant for the single national row.
reference_group_en <- "Muslim"
reference_group_ar <- "مسلم"
minority_group_en <- "Others"
minority_group_ar <- "أخرى"
metric_round_digits <- 4L

licence_basis <- "bahrain_open_government_data_license_v1_0_attribution_geoboundaries_odbl_1_0"
licence_status_enum <- "accepted"
storage_provider_value <- "git_repository"

# Bahrain Open Government Data License v1.0 (20 May 2025), byte-matched from the
# cached licence PDF text layer.
licence_name <- "Bahrain Open Government Data License, Version 1.0 (20 May 2025)"
licence_url <- "https://www.nea.gov.bh/Documents/OpenDataLicense.pdf"
licence_scope_1 <- paste(
  "This license applies to all datasets officially published by the Government of Bahrain",
  "through its open data portal (www.data.gov.bh) or any other government website that",
  "published government open data."
)
licence_grant_3_1 <- paste(
  "This license allows you royalty-free, non-exclusive use of the datasets for the following",
  "purposes: (a) sharing, copying, distributing or transmitting the datasets. (b) adapting the",
  "datasets to suit your needs. (c) using the datasets for applications that you develop or",
  "integrate with. (d) commercializing the applications that you develop using the datasets."
)
licence_attribution_3_3a <- paste(
  "Include attribution by clearly stating in your applications, research, articles, or websites",
  "containing the datasets, the source of the datasets and the date the datasets were extracted."
)
licence_disclaimer_3_3b <- paste(
  "Clearly indicate that any analysis or transformation of data is made by you and shall not be",
  "attributed to the Information and eGovernment Authority (iGA) or the concerned government entity."
)
licence_statement_3_3c <- paste0(
  "Datasets provided by the Information & eGovernment Authority via www.data.gov.bh are governed ",
  "by the Bahrain Open Government Data License available at www.nea.gov.bh/Documents/OpenDataLicense.pdf. ",
  "To the fullest extent permitted by law, the government is not liable for any damage or loss of any ",
  "kind caused directly or indirectly by the use or availability of the datasets or any derived ",
  "analyses or applications."
)
# the shipping attribution string (§3.3a source + extraction date) and disclaimer.
census_attribution <- paste0(
  "Source: Information & eGovernment Authority via www.data.gov.bh (Population by Religion, ",
  "Nationality and Sex - Census 2020), extracted 2026-07-11. ", licence_disclaimer_3_3b
)

boundary_attribution <- "geoBoundaries; OpenStreetMap contributors"

# source URLs.
census_cut1_url <- "https://www.data.gov.bh/api/explore/v2.1/catalog/datasets/population-by-religion-nationality-and-sex-census-2020/exports/csv"
census_cut2_url <- "https://www.data.gov.bh/api/explore/v2.1/catalog/datasets/population-by-sex-age-groups-and-religion-census-2020/exports/csv"
census_cut1_api_url <- "https://www.data.gov.bh/api/explore/v2.1/catalog/datasets/population-by-religion-nationality-and-sex-census-2020/records?limit=100"
census_meta_url <- "https://www.data.gov.bh/api/explore/v2.1/catalog/datasets/population-by-religion-nationality-and-sex-census-2020/"
census_portal_url <- "https://www.data.gov.bh/explore/dataset/population-by-religion-nationality-and-sex-census-2020/"
licence_pdf_url <- "https://nea.gov.bh/Documents/OpenDataLicense.pdf"
boundary_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/BHR/ADM0/"
boundary_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/BHR/ADM0/geoBoundaries-BHR-ADM0.geojson"

# cached input paths.
cut1_csv <- file.path(raw_dir, "bh_2020_religion.csv")
cut2_csv <- file.path(raw_dir, "bh_2020_religion_agegroups.csv")
cut1_api <- file.path(raw_dir, "bh_2020_religion_api.json")
census_meta_path <- file.path(raw_dir, "bh_2020_meta.json")
licence_pdf_path <- file.path(raw_dir, "bh_open_data_license.pdf")
licence_txt_path <- file.path(raw_dir, "bh_open_data_license.txt")
boundary_meta_path <- file.path(raw_dir, "gb_bhr_adm0_meta.json")
boundary_path <- file.path(raw_dir, "geoBoundaries-BHR-ADM0.geojson")

# outputs.
boundary_out <- file.path(product_dir, "bh_national.geojson")
summary_json_out <- file.path(product_dir, "area_summary_national.json")
summary_csv_out <- file.path(product_dir, "area_summary_national.csv")
manifest_out <- file.path(manifest_dir, "bh-census-religion-2020.json")

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

# read a semicolon-delimited iGA export, stripping any UTF-8 BOM on the header.
read_iga_csv <- function(path) {
  df <- read.csv(path, sep = ";", stringsAsFactors = FALSE, check.names = FALSE,
                 encoding = "UTF-8", fileEncoding = "UTF-8")
  names(df) <- sub("^﻿", "", names(df))
  names(df)[1] <- sub("^﻿", "", names(df)[1])
  df
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

# ------------------------------------------------ pinned expected margins ---

# the published 2020 margins both cuts must reconcile to (probe, verified).
expected_muslim <- 1111533L
expected_others <- 390102L
expected_total <- 1501635L

# --------------------------------------------------- read + reconcile cuts ---

require_file(cut1_csv); require_file(cut2_csv); require_file(cut1_api)
require_file(census_meta_path); require_file(licence_pdf_path); require_file(licence_txt_path)
require_file(boundary_meta_path); require_file(boundary_path)

cut1 <- read_iga_csv(cut1_csv)
cut2 <- read_iga_csv(cut2_csv)

# helper: religion-margin reconciliation for one cut. stops on any mismatch.
reconcile_cut <- function(df, label) {
  if (!all(c("religion", "population") %in% names(df))) {
    stop("cut ", label, " lacks expected columns", call. = FALSE)
  }
  df$population <- as.integer(df$population)
  muslim <- sum(df$population[df$religion == "Muslim"])
  others <- sum(df$population[df$religion == "Others"])
  total <- sum(df$population)
  if (muslim != expected_muslim || others != expected_others || total != expected_total) {
    stop(sprintf("cut %s does not reconcile: Muslim %d / Others %d / total %d (expected %d / %d / %d)",
                 label, muslim, others, total, expected_muslim, expected_others, expected_total),
         call. = FALSE)
  }
  list(rows = nrow(df), muslim = as.integer(muslim), others = as.integer(others), total = as.integer(total))
}

cut1_recon <- reconcile_cut(cut1, "religion x nationality x sex")
cut2_recon <- reconcile_cut(cut2, "sex x age-group x religion x nationality")

# both cuts close independently to the identical margins.
if (cut1_recon$rows != 8L) stop("cut 1 expected 8 rows, found ", cut1_recon$rows, call. = FALSE)
if (cut2_recon$rows != 112L) stop("cut 2 expected 112 rows, found ", cut2_recon$rows, call. = FALSE)

# nationality structure from cut 1 (the informative citizen/non-citizen cut).
cut1$population <- as.integer(cut1$population)
bahraini_total <- sum(cut1$population[cut1$nationality == "Bahraini"])
nonbahraini_total <- sum(cut1$population[cut1$nationality == "Non-Bahraini"])
bahraini_muslim <- sum(cut1$population[cut1$nationality == "Bahraini" & cut1$religion == "Muslim"])
bahraini_others <- sum(cut1$population[cut1$nationality == "Bahraini" & cut1$religion == "Others"])
nonbahraini_others <- sum(cut1$population[cut1$nationality == "Non-Bahraini" & cut1$religion == "Others"])
if (bahraini_total + nonbahraini_total != expected_total) {
  stop("nationality margins do not close to the published total", call. = FALSE)
}
bahraini_muslim_pct <- round(100 * bahraini_muslim / bahraini_total, 2)
nonbahraini_share_of_minority <- round(100 * nonbahraini_others / expected_others, 2)

# ------------------------------------------ licence corroboration (byte-match) ---

licence_text <- paste(readLines(licence_txt_path, warn = FALSE, encoding = "UTF-8"), collapse = " ")
licence_text_collapsed <- gsub("[[:space:]]+", " ", licence_text)
assert_in_text <- function(pattern, label) {
  if (!grepl(pattern, licence_text_collapsed, fixed = TRUE)) {
    stop("licence corroboration failed: ", label, " not found in cached licence text", call. = FALSE)
  }
  invisible(TRUE)
}
assert_in_text("royalty-free, non-exclusive use of the", "OGDL v1.0 grant clause 3.1")
assert_in_text("any analysis or transformation of data is made", "OGDL v1.0 self-analysis disclaimer 3.3b")
assert_in_text("governed by the", "OGDL v1.0 required attribution statement 3.3c")

# --------------------------------------------------- minority-share metrics ---

reference_count <- expected_muslim
minority_count <- expected_others
reference_pct <- round(100 * reference_count / expected_total, metric_round_digits)
minority_pct <- round(100 * minority_count / expected_total, metric_round_digits)
# complement gate: the two slots must sum to 100 exactly.
if (abs(reference_pct + minority_pct - 100) > 1e-9) {
  stop("minority-share complement gate failed: slots do not sum to 100", call. = FALSE)
}

# --------------------------------------------------------------- boundary ---

boundary_meta <- fromJSON(boundary_meta_path, simplifyVector = TRUE)
if (!identical(boundary_meta[["boundaryISO"]], "BHR") ||
    !identical(boundary_meta[["boundaryType"]], "ADM0") ||
    !identical(boundary_meta[["boundaryYearRepresented"]], boundary_vintage) ||
    !identical(boundary_meta[["admUnitCount"]], "1")) {
  stop("geoBoundaries BHR ADM0 release metadata drifted from the probed release", call. = FALSE)
}
boundary_licence_name <- boundary_meta[["boundaryLicense"]]
if (!identical(boundary_licence_name, "Open Data Commons Open Database License 1.0")) {
  stop("geoBoundaries BHR boundary licence changed from the verified ODbL 1.0", call. = FALSE)
}
boundary_source_id <- boundary_meta[["boundaryID"]]

# the cache carries a native ADM0 single national polygon; no dissolve is needed.
raw_boundary <- st_read(boundary_path, quiet = TRUE)
raw_boundary <- st_make_valid(st_transform(raw_boundary, 4326))
if (nrow(raw_boundary) != 1L || any(st_is_empty(raw_boundary)) ||
    any(is.na(st_is_valid(raw_boundary))) || any(!st_is_valid(raw_boundary))) {
  stop("raw Bahrain ADM0 boundary is missing, empty, invalid, or not 1 national polygon", call. = FALSE)
}
boundary <- st_sf(
  area_code = "bahrain", area_name = "Bahrain",
  geometry = st_geometry(raw_boundary), crs = 4326
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
    !identical(written_boundary[["area_code"]], "bahrain")) {
  stop("simplified Bahrain ADM0 boundary failed the geometry gate", call. = FALSE)
}
land_area_sq_km <- as.numeric(st_area(st_transform(written_boundary, 4326))[[1]]) / 1e6
simplified_geometry_hash <- geometry_hash(written_boundary, 1L)

# ----------------------------------------------------------- shipped row ---

# verbatim two-line frame with counts, English and Arabic labels as published.
source_categories_verbatim <- paste0(
  reference_group_en, " (", reference_group_ar, ") = ", reference_count, "; ",
  minority_group_en, " (", minority_group_ar, ") = ", minority_count
)

population_basis <- paste0(
  "All persons, Bahrain 2020 census (Total ", expected_total, "; Bahraini ", bahraini_total,
  ", Non-Bahraini ", nonbahraini_total, "), from the iGA data.gov.bh cut Population by Religion, ",
  "Nationality and Sex - Census 2020. Under the minority-share two-slot design the two metric slots ",
  "carry the reference-group (Muslim) share and its exact complement, the minority share (the Others ",
  "line); the published frame is two lines only (Muslim / Others, مسلم / أخرى) with no no-religion ",
  "and no not-stated category. The census does not split Muslim into Sunni/Shia."
)

quality_flag <- paste(
  "census_affiliation",
  "census_flat_frame_minority_share_design",
  "national_only_adm0",
  "all_persons_universe",
  "two_slot_minority_share_design",
  "reference_group=muslim",
  sprintf("reference_share_pct=%s;minority_share_pct=%s", reference_pct, minority_pct),
  "minority_share=others_line",
  paste0("source_categories_verbatim=", source_categories_verbatim),
  "no_religion_slot_carries_minority_share_not_secularity",
  "no_religion_category_absent;not_stated_category_absent",
  "muslim_others_frame_no_sunni_shia_split",
  "single_wave_2020",
  sprintf("two_cuts_reconcile_muslim_%d_others_%d_total_%d", expected_muslim, expected_others, expected_total),
  licence_basis,
  "boundary_odbl_1_0",
  sep = ";"
)

row <- list(
  country_code = country_code,
  boundary_set_id = boundary_set_id,
  boundary_level = boundary_level,
  area_unit_id = paste0(boundary_set_id, ":bahrain"),
  area_code = "bahrain",
  area_name = "Bahrain",
  year = census_year,
  population_total = as.integer(expected_total),
  population_total_basis = population_basis,
  religious_affiliation_count = as.integer(reference_count),
  religious_affiliation_percent = reference_pct,
  no_religion_count = as.integer(minority_count),
  no_religion_percent = minority_pct,
  place_count = NULL,
  places_per_10000_residents = NULL,
  place_density_per_sq_km = NULL,
  land_area_sq_km = round(land_area_sq_km, 4),
  site_snapshot_date = NULL,
  place_count_basis = NULL,
  source_dataset_ids = list(census_id, boundary_dataset_id),
  quality_flag = quality_flag
)
rows <- list(row)

# flatten the single row into the CSV companion.
flatten_rows <- function(rows) {
  do.call(rbind, lapply(rows, function(r) data.frame(
    country_code = r[["country_code"]], boundary_set_id = r[["boundary_set_id"]],
    boundary_level = r[["boundary_level"]], area_unit_id = r[["area_unit_id"]],
    area_code = r[["area_code"]], area_name = r[["area_name"]], year = r[["year"]],
    population_total = r[["population_total"]], population_total_basis = r[["population_total_basis"]],
    religious_affiliation_count = r[["religious_affiliation_count"]],
    religious_affiliation_percent = r[["religious_affiliation_percent"]],
    no_religion_count = r[["no_religion_count"]], no_religion_percent = r[["no_religion_percent"]],
    place_count = NA_integer_, places_per_10000_residents = NA_real_,
    place_density_per_sq_km = NA_real_, land_area_sq_km = r[["land_area_sq_km"]],
    site_snapshot_date = NA_character_, place_count_basis = NA_character_,
    source_dataset_ids = paste(unlist(r[["source_dataset_ids"]]), collapse = "|"),
    quality_flag = r[["quality_flag"]], stringsAsFactors = FALSE
  )))
}

# ------------------------------------------------- area-summary product ---

census_meta <- fromJSON(census_meta_path, simplifyVector = TRUE)
publisher <- census_meta[["metas"]][["default"]][["publisher"]]

source_datasets <- list(
  list(
    source_dataset_id = census_id,
    name = "Population by Religion, Nationality and Sex - Census 2020 (Information & eGovernment Authority, data.gov.bh)",
    provider = "Information & eGovernment Authority (iGA), Kingdom of Bahrain",
    url = census_portal_url, retrieval_date = retrieval_date, local_path = cut1_csv,
    licence = list(name = licence_name, url = licence_url, attribution = census_attribution),
    citation = paste(
      "Information & eGovernment Authority, Bahrain 2020 Census: Population by Religion, Nationality",
      "and Sex (data.gov.bh); corroborated by Population by Sex, Age Groups and Religion - Census 2020."
    ),
    access_limits = paste(
      "Public machine-readable tables on the iGA Opendatasoft portal data.gov.bh. Religion is published",
      "at national geography only; no wave crosses religion with governorate. The 2010 census religion",
      "table is absent from data.gov.bh and its primary portal (census2010.gov.bh) is offline."
    ),
    redistribution_limits = paste(
      "Derived national summaries ship under the Bahrain Open Government Data License v1.0 with the",
      "§3.3c attribution statement and the §3.3b self-analysis disclaimer.", census_attribution
    ),
    notes = paste(
      "Two independent 2020 census religion cuts are published and reconcile exactly to the same",
      "margins: religion x nationality x sex (8 rows) and sex x age-group x religion x nationality",
      "(112 rows), both Muslim 1,111,533 / Others 390,102 / total 1,501,635. The census frame is two",
      "lines only (Muslim / Others, مسلم / أخرى); it does not split Muslim into Sunni/Shia and does not",
      "divide the Others residual. Among Bahraini nationals Others is tiny (2,295 of 712,362, so",
      "~99.7% Muslim); the minority is almost entirely Non-Bahraini expatriates (387,807 of 390,102).",
      "Publisher:", publisher, "(attributions: Information & eGovernment Authority)."
    )
  ),
  list(
    source_dataset_id = boundary_dataset_id,
    name = "geoBoundaries gbOpen BHR ADM0 (1 native national polygon)",
    provider = "geoBoundaries (William & Mary geoLab); source OpenStreetMap, Wambacher",
    url = boundary_url, retrieval_date = retrieval_date, local_path = boundary_path,
    licence = list(name = boundary_licence_name,
                   url = "https://opendatacommons.org/licenses/odbl/1-0/",
                   attribution = boundary_attribution),
    citation = paste0(
      "geoBoundaries gbOpen BHR ADM0, boundary ID ", boundary_source_id,
      ", release commit 9469f09; boundaryYearRepresented 2017, source OpenStreetMap / Wambacher."
    ),
    access_limits = NULL,
    redistribution_limits = paste(
      "The simplified national polygon is redistributed under ODbL 1.0 with OpenStreetMap contributors",
      "attribution."
    ),
    notes = paste(
      "Native ADM0 single polygon (admUnitCount 1); no dissolve is needed. The join property is",
      "area_code = 'bahrain'. Simplified with scripts/lib/simplify_boundary.R. Bahrain is an",
      "archipelago represented as one MultiPolygon; a national ADM0 outline needs no subnational",
      "concordance and no dateline handling."
    )
  )
)

denominator_note <- paste(
  "The single percentage denominator is the all-persons 2020 census total (1,501,635). Under the",
  "minority-share two-slot design religious_affiliation_percent is the reference-group (Muslim) share",
  "and no_religion_percent is its exact complement, the minority share (the Others line); the two slots",
  "sum to 100 by construction. The no_religion slot carries no no-religion, belief, practice, or",
  "secularity semantics — it is arithmetic on the published Muslim/Others frame."
)

indicators <- list(
  list(indicator_id = "population_total", label = "Census population (all persons)",
       description = "Bahrain 2020 census all-persons total classified by the Muslim/Others religion frame.",
       unit = "count", denominator_indicator_id = NULL,
       method = "Published total of the two-line Muslim/Others census frame (1,501,635); both published cuts reconcile to it.",
       temporal_coverage = "2020", spatial_coverage = "Bahrain national total on one ADM0 polygon",
       quality_notes = "All-persons universe (Bahraini 712,362; Non-Bahraini 789,273). No sub-universe restriction; no not-stated line."),
  list(indicator_id = "religious_affiliation_percent", label = "Muslim (%)",
       description = paste(
         "Reference-group share: the share of Bahrain's 2020 census population reporting the reference",
         "group, Muslim. Declared construct under the minority-share design (project-lead ruling",
         "2026-07-11): the reference group is Bahrain's largest published national category, held",
         "constant. The value is that group's share of the census frame, never a measure of affiliation",
         "versus non-affiliation."),
       unit = "percent", denominator_indicator_id = "population_total",
       method = "100 * Muslim / all-persons total.",
       temporal_coverage = "2020", spatial_coverage = "Bahrain national",
       quality_notes = paste(
         "Reference group Muslim (1,111,533 / 1,501,635 = 74.0215%). The two-line frame (Muslim / Others,",
         "مسلم / أخرى) has no no-religion and no not-stated category and no Sunni/Shia split. The verbatim",
         "frame with counts is carried in the row's quality_flag.")),
  list(indicator_id = "no_religion_percent", label = "Minority share (%)",
       description = paste(
         "Minority share: the exact complement of the reference-group share, the Others line of the",
         "published frame (all residents classified outside Muslim). This is arithmetic on the published",
         "affiliation frame, the share outside Bahrain's largest published category. It is not a measure",
         "of no religion, belief, practice, or secularity."),
       unit = "percent", denominator_indicator_id = "population_total",
       method = "100 * Others / all-persons total; equivalently 100 minus the Muslim share. The two slots are exact complements.",
       temporal_coverage = "2020", spatial_coverage = "Bahrain national",
       quality_notes = paste(denominator_note,
         "The minority is almost entirely Non-Bahraini expatriates (387,807 of 390,102); Bahraini",
         "nationals are ~99.7% Muslim."))
)

legend <- list(unit = "percent", denominator = "all-persons 2020 census total")
visual_layers <- list(
  list(visual_layer_id = "bh-adm0-muslim-share", label = "Muslim (%)",
       description = "Bahrain 2020 census reference-group (Muslim) share, national.",
       layer_type = "choropleth", indicator_ids = list("religious_affiliation_percent"),
       geometry_unit_type = "country", legend = legend, colour_scale = NULL,
       time_control = "year_selector", aggregation_rule = NULL, uncertainty_display = "quality_flag",
       default_visibility = TRUE,
       notes = paste(
         "A single national polygon is intentional under the small-country clause: Bahrain publishes",
         "census religion at national geography only, in a flat two-line Muslim/Others frame. Reference-group",
         "share under the minority-share design; the verbatim frame with counts is carried in the row's",
         "quality_flag.")),
  list(visual_layer_id = "bh-adm0-minority-share", label = "Minority share (%)",
       description = "Bahrain 2020 census minority share (the Others line), national.",
       layer_type = "choropleth", indicator_ids = list("no_religion_percent"),
       geometry_unit_type = "country", legend = legend, colour_scale = NULL,
       time_control = "year_selector", aggregation_rule = NULL, uncertainty_display = "quality_flag",
       default_visibility = FALSE,
       notes = paste(
         "Minority share: arithmetic on the published Muslim/Others frame, the share outside the reference",
         "group. Not a measure of no religion, belief, practice, or secularity."))
)

summary_product <- list(
  schema_version = "area-summary.v1", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code,
    level = boundary_level, vintage = boundary_vintage, source_dataset_id = boundary_dataset_id),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
    basis = "No governed place-of-worship snapshot ships in the Bahrain national census-religion product.",
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

git_commit <- tryCatch(trimws(system2("git", c("rev-parse", "HEAD"), stdout = TRUE, stderr = FALSE)),
                       error = function(e) NA_character_)
if (length(git_commit) != 1L || is.na(git_commit) || !grepl("^[a-f0-9]{40}$", git_commit)) git_commit <- NULL

# one cached-source retrieval record.
raw_source_record <- function(path, url, format, used_in_public_product, notes) {
  list(uri = path, url = url, retrieval_date = retrieval_date, retrieved_at = stamp,
    format = format, bytes = file_bytes(path), sha256 = sha256_file(path),
    source_dataset_id = if (grepl("geoBoundaries|gb_bhr", path)) boundary_dataset_id else census_id,
    used_in_public_product = used_in_public_product, notes = notes)
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
  raw_source_record(cut1_csv, census_cut1_url, "csv", TRUE,
    "Cut 1: religion x nationality x sex (8 rows). Source of record for the shipped row; reconciles to Muslim 1,111,533 / Others 390,102 / total 1,501,635."),
  raw_source_record(cut2_csv, census_cut2_url, "csv", TRUE,
    "Cut 2: sex x age-group x religion x nationality (112 rows). Independent published detail; reconciles to the identical margins. Recorded as detail, not shipped as data rows."),
  raw_source_record(cut1_api, census_cut1_api_url, "json", FALSE,
    "Cut 1 via the Opendatasoft records API (8 records); corroborates the CSV export."),
  raw_source_record(census_meta_path, census_meta_url, "json", TRUE,
    "Dataset metadata: publisher Information & eGovernment Authority, attributions, per-dataset licence field null (portal terms bind OGDL v1.0)."),
  raw_source_record(licence_pdf_path, licence_pdf_url, "pdf", TRUE,
    "Bahrain Open Government Data License v1.0 (20 May 2025) source PDF; the byte-matched §3.1 grant, §3.3b disclaimer, and §3.3c attribution statement."),
  raw_source_record(licence_txt_path, licence_pdf_url, "text", TRUE,
    "pdftotext extraction of the OGDL v1.0 licence; the licence clauses are byte-matched in this text layer at build time."),
  raw_source_record(boundary_meta_path, boundary_meta_url, "json", TRUE,
    "geoBoundaries BHR ADM0 release metadata; 1 native national unit, ODbL 1.0, boundaryYearRepresented 2017."),
  raw_source_record(boundary_path, boundary_url, "geojson", TRUE,
    "geoBoundaries BHR ADM0 source geometry (1 native national MultiPolygon), simplified to the shipped boundary.")
)

deferred_sources <- list(
  list(source = "2010 census religion national total",
    status = "held_no_machine_readable_open_table",
    reason = paste(
      "The 2010 census published a national Muslim/non-Muslim count (total 1,234,571; Muslim 866,888;",
      "non-Muslim 367,683), but its primary portal (census2010.gov.bh) is offline (DNS gone) and the",
      "figure is absent from data.gov.bh. It survives only in secondary and government-description",
      "sources; the Ministry of Information page (mia.gov.bh) that cites the CIO 2010 census blocks",
      "curl/WebFetch (HTTP 405) and the in-app browser reaches only a human-verification interstitial",
      "the project does not complete. No 2010 rows and no 2010->2020 change metric are shipped."),
    recovery_route = "A person-at-the-keyboard capture of the mia.gov.bh page, or a machine-readable 2010 census religion table on an open portal, would unlock a caveated historical annotation (never a portal-equal wave)."),
  list(source = "Religion by governorate (any wave)",
    status = "unavailable_no_public_table",
    reason = paste(
      "No Bahrain census wave publishes religion by governorate. The 2020 catalogue carries many",
      "governorate-dimensioned tables (population, education, marital status, labour, buildings,",
      "households) but none crosses religion. A subnational religion layer is out of reach."),
    recovery_route = "An iGA governorate-by-religion tabulation would unlock a subnational layer; none is published."),
  list(source = "Sunni/Shia split; non-Muslim denomination split",
    status = "not_published",
    reason = paste(
      "The census religion table groups all Muslims into one line (no Sunni/Shia) and does not split",
      "the Others residual (Christian/Hindu/etc.). The sibling iGA births dataset uses a finer",
      "Christian/Jewish/Muslim/Others frame, but that is vital registration, not the census, and is not",
      "conflated with the census religion frame."),
    recovery_route = "None; the census is deliberately grouped as Muslim/Others.")
)

boundary_validation <- list(
  source_feature_count = 1L, simplified_feature_count = nrow(written_boundary),
  all_valid = all(written_valid), all_non_empty = all(!st_is_empty(written_boundary)),
  source_geometry_sha256 = source_geometry_hash, simplified_geometry_sha256 = simplified_geometry_hash,
  simplified_bytes = file_bytes(boundary_out), byte_cap = 250000L,
  simplification = simplification,
  licence_metadata_status = "passed", licence = boundary_licence_name,
  licence_finding = paste(
    "geoBoundaries BHR ADM0 release metadata records Open Data Commons Open Database License 1.0",
    "(ODbL 1.0), boundaryYearRepresented 2017, admUnitCount 1, source OpenStreetMap / Wambacher.",
    "One native national polygon; no dissolve needed."),
  boundary_derivation = paste(
    "The cache holds a native ADM0 single MultiPolygon; the shipped boundary is that polygon re-tagged",
    "with area_code = 'bahrain' and simplified. The outline area is", sprintf("%.2f", land_area_sq_km),
    "sq km, consistent with Bahrain's ~765 sq km land area."),
  release_source = "geoBoundaries / OpenStreetMap contributors, Wambacher"
)

reconciliation_evidence <- list(
  gate_both_cuts_reconcile = list(
    expected = list(muslim = expected_muslim, others = expected_others, total = expected_total),
    cut_religion_nationality_sex = list(rows = cut1_recon$rows, muslim = cut1_recon$muslim,
      others = cut1_recon$others, total = cut1_recon$total, reconciles = TRUE),
    cut_age_group = list(rows = cut2_recon$rows, muslim = cut2_recon$muslim,
      others = cut2_recon$others, total = cut2_recon$total, reconciles = TRUE),
    note = "Two independently published 2020 census religion cuts close to the identical margins."),
  gate_minority_share_complement = list(
    reference_group = "Muslim", reference_share_pct = reference_pct,
    minority_share_pct = minority_pct, sum = reference_pct + minority_pct, reconciles = TRUE),
  nationality_structure = list(
    bahraini_total = bahraini_total, non_bahraini_total = nonbahraini_total,
    bahraini_muslim = bahraini_muslim, bahraini_others = bahraini_others,
    bahraini_muslim_pct = bahraini_muslim_pct,
    non_bahraini_others = nonbahraini_others,
    non_bahraini_share_of_minority_pct = nonbahraini_share_of_minority,
    note = paste(
      "The citizen/non-citizen cut is the informative one: Bahraini nationals are ~99.7% Muslim",
      "(2,295 Others of 712,362); the minority is almost entirely Non-Bahraini expatriates",
      "(387,807 of 390,102, 99.4%). Manifest context, not a data row.")),
  published_detail_cuts = list(
    list(cut = "population-by-religion-nationality-and-sex-census-2020",
      dimension = "religion x nationality x sex", rows = 8L,
      role = "source of record for the shipped national row"),
    list(cut = "population-by-sex-age-groups-and-religion-census-2020",
      dimension = "sex x age-group x religion x nationality", rows = 112L,
      role = "independent published detail; reconciles to the identical margins; not shipped as data rows")),
  source_categories_verbatim = list(
    list(en = reference_group_en, ar = reference_group_ar, role = "reference_group", count = reference_count),
    list(en = minority_group_en, ar = minority_group_ar, role = "minority_share", count = minority_count))
)

licence_capture <- list(
  name = licence_name, url = licence_url,
  scope_1 = licence_scope_1, grant_3_1 = licence_grant_3_1,
  attribution_3_3a = licence_attribution_3_3a,
  self_analysis_disclaimer_3_3b = licence_disclaimer_3_3b,
  required_statement_3_3c = licence_statement_3_3c,
  capture_source = licence_txt_path, capture_sha256 = sha256_file(licence_txt_path),
  pdf_sha256 = sha256_file(licence_pdf_path),
  per_dataset_licence_field = "null (metas.default.license); the portal terms (§1) bind all data.gov.bh datasets to OGDL v1.0",
  publisher = publisher)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = "manifest:bh-census-religion:bh:2020:iga-national",
  dataset_id = "bh-census-religion:bh:2020:iga-national",
  dataset_version_id = paste0("bh-census-religion:bh:2020:iga-national:", substr(sha256_file(summary_json_out), 1, 12)),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "bh-census-religion",
  dataset_role = "public_product",
  scope = list(level = "country", country_codes = list(country_code),
    snapshot_date = NULL, snapshot_anchor = NULL, pipeline_stage = "public"),
  created_at = stamp, created_by = script_id,
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation (minority-share two-slot design)",
      ruling = ruling,
      waves = list(2020L),
      shipped_geography = "1 native national ADM0 polygon (geoBoundaries BHR ADM0)",
      universe = "all persons (Total 1,501,635; Bahraini 712,362; Non-Bahraini 789,273)",
      denominator = "all-persons 2020 census total (1,501,635)",
      metric_design = "minority-share (project-lead ruling 2026-07-11, task 6; BD/KH/LK precedent)",
      reference_group = "Muslim",
      reference_group_basis = "largest published national category in the single published wave (2020), held constant for the national row",
      reference_group_national_share = "Muslim: 1,111,533 / 1,501,635 = 74.0215%",
      minority_share_definition = "the Others line (390,102 / 1,501,635 = 25.9785%), the exact complement of the Muslim share",
      affiliation_rule = "religious_affiliation_percent = 100 * Muslim / total (reference-group share); no_religion_percent = 100 * Others / total (minority share, exact complement); the two slots sum to 100",
      source_categories_verbatim = "Muslim (مسلم) = 1,111,533; Others (أخرى) = 390,102",
      frame_note = "two lines only (Muslim / Others); no Sunni/Shia split, no not-stated line, no no-religion line",
      source_of_record_rule = "the religion x nationality x sex cut (8 rows) supplies the national row; the sex x age-group x religion x nationality cut (112 rows) is independent published detail reconciling to the identical margins",
      detail_cuts_recorded = "both published cuts recorded as detail with reconciliation stated; neither becomes a data row",
      held_2010 = "2010 census religion national total HELD (dead portal, absent from data.gov.bh); no 2010 rows, no change metric, single_wave_2020 token, no change_withheld token",
      boundary_source_vintage = "geoBoundaries BHR ADM0, boundaryYearRepresented 2017",
      boundary_derivation = "native geoBoundaries BHR ADM0 single MultiPolygon re-tagged area_code='bahrain' and simplified",
      boundary_join_property = "area_code",
      licence_basis = licence_basis,
      licence_capture = licence_capture,
      reconciliation_evidence = reconciliation_evidence,
      omitted_metrics = list("religious_change (single wave; 2010 held)",
                             "places_per_10000_residents", "place_density_per_sq_km",
                             "subnational religion (no governorate-by-religion table in any wave)")
    ),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")), digest = as.character(packageVersion("digest")),
      mapshaper = "scripts/lib/simplify_boundary.R")
  ),
  source = list(
    provider = "Information & eGovernment Authority (iGA), Kingdom of Bahrain; geoBoundaries; OpenStreetMap contributors",
    source_dataset_ids = list(census_id, boundary_dataset_id),
    source_urls = list(census_portal_url, census_cut1_url, census_cut2_url, census_meta_url,
                       licence_pdf_url, boundary_meta_url, boundary_url),
    retrieved_at = stamp,
    licence = paste(
      "Census: Bahrain Open Government Data License v1.0 (20 May 2025) — royalty-free rights to share,",
      "adapt and commercialize with attribution (§3.1); required §3.3c attribution statement and §3.3b",
      "self-analysis disclaimer quoted verbatim from the cached licence PDF. Boundary: Open Data Commons",
      "Open Database License 1.0 (geoBoundaries; OpenStreetMap contributors)."),
    raw_redistribution = "Raw iGA CSV/JSON cuts, the licence PDF, and the boundary remain in the git-ignored cache; not redistributed in-repo.",
    local_cache_hint = "All raw sources are cached under data/raw/bh_census/ and remain git-ignored.",
    licence_position = "accepted: explicit open licence (Bahrain OGDL v1.0 for the census; ODbL 1.0 for the boundary)",
    citation = "Bahrain 2020 Census: Population by Religion, Nationality and Sex (iGA, data.gov.bh); geoBoundaries BHR ADM0."
  ),
  input_manifests = list(),
  durable_files = list(
    durable_file_record(summary_json_out, "Bahrain 2020 national census-religion area summary (minority-share two-slot design).", row_count = length(rows)),
    durable_file_record(summary_csv_out, "Flattened Bahrain 2020 national census-religion row.", row_count = length(rows)),
    durable_file_record(boundary_out, "geoBoundaries BHR ADM0 native national polygon (simplified).", feature_count = nrow(written_boundary))
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id),
    list(uri = paste0("repo:", summary_csv_out), sha256 = sha256_file(summary_csv_out), built_by = script_id),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out), built_by = script_id)
  ),
  raw_sources = raw_sources,
  deferred_sources = deferred_sources,
  target_years = list(2020L),
  construct_notes = list(
    "The Bahrain 2020 census religion frame is two lines only: Muslim / Others (مسلم / أخرى). There is no no-religion category and no not-stated category; the frame sums to the total by construction. The census does not split Muslim into Sunni/Shia and does not divide the Others residual.",
    "Minority-share design (project-lead ruling 2026-07-11, task 6; BD/KH/LK precedent): because the frame is flat, the two legacy metric slots carry declared constructs. religious_affiliation_percent is the reference-group share (Muslim); no_religion_percent is its exact complement, the minority share (the Others line). The two slots sum to 100.",
    "The reference group is Muslim, Bahrain's largest published national category in the single published wave (2020), held constant. The reference-group value is that group's share of the census frame, never a measure of affiliation versus non-affiliation. National evidence: 1,111,533 / 1,501,635 = 74.0215%.",
    "The minority share is arithmetic on the published Muslim/Others frame, the share outside the reference group. It is not a measure of no religion, belief, practice, minority status in law, or self-understood identity. The no_religion slot key is the legacy runtime field name and carries no no-religion semantics here.",
    "The verbatim two-line frame with counts (Muslim (مسلم) = 1,111,533; Others (أخرى) = 390,102) is carried in the row's quality_flag.",
    "The citizen/non-citizen structure is manifest context: Bahraini nationals are ~99.7% Muslim (2,295 Others of 712,362); the minority is almost entirely Non-Bahraini expatriates (387,807 of 390,102).",
    "2010 is HELD: the 2010 census religion national total survives only in secondary and blocked-government-page sources (primary portal offline, absent from data.gov.bh). No 2010 rows and no change metric ship."
  ),
  stats = list(
    wave_year_rows = length(rows), area_count = 1L, shipped_wave_count = 1L,
    boundary_features = nrow(written_boundary), boundary_bytes = file_bytes(boundary_out),
    all_persons_total = expected_total, muslim = expected_muslim, others = expected_others,
    muslim_pct = reference_pct, minority_pct = minority_pct
  ),
  validation = list(
    status = "passed",
    commands = list(
      "Rscript scripts/build_bh_area_summary.R",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/bh/data/area_summary_national.json",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/data-manifest.schema.json docs/manifests/bh-census-religion-2020.json",
      "bash scripts/validate_manifests.sh"
    ),
    notes = paste(
      "Both published 2020 census religion cuts reconcile independently to Muslim 1,111,533 / Others",
      "390,102 / total 1,501,635 (cut 1: religion x nationality x sex, 8 rows; cut 2: sex x age-group x",
      "religion x nationality, 112 rows). The two metric slots are exact complements (74.0215% +",
      "25.9785% = 100). The Bahrain OGDL v1.0 grant, §3.3b disclaimer and §3.3c attribution statement",
      "are byte-matched in the cached licence text. The single native ADM0 polygon is non-empty and",
      "valid."),
    warnings = list(
      "Minority-share design: religious_affiliation_percent carries the reference-group (Muslim) share and no_religion_percent its exact complement, the minority share (the Others line); the no_religion slot carries no no-religion semantics. The frame has no no-religion and no not-stated category.",
      "Single wave (2020): 2010 census religion is HELD (dead portal, absent from data.gov.bh; the mia.gov.bh government citation blocks command-line fetch and the in-app browser reaches only a human-verification interstitial). No 2010 rows and no change metric; a person-at-the-keyboard capture is the only recovery route.",
      "National geography only: no Bahrain census wave publishes religion by governorate, so no subnational religion layer is possible.",
      "The census does not split Muslim into Sunni/Shia and does not divide the Others residual; the sibling iGA births dataset uses a finer Christian/Jewish/Muslim/Others frame but is vital registration, not the census."
    ),
    reconciliation_evidence = reconciliation_evidence,
    boundary_validation = boundary_validation
  ),
  privacy = "public",
  licence_status = licence_status_enum,
  downstream_status = "public",
  notes = paste(
    "Public product under an explicit open licence. One national ADM0 polygon carrying a single-wave",
    "2020 all-persons Muslim/Others series under the minority-share two-slot design. On-page attribution",
    "cites the Information & eGovernment Authority via www.data.gov.bh under the Bahrain Open Government",
    "Data License v1.0 (with the §3.3b self-analysis disclaimer), and geoBoundaries / OpenStreetMap",
    "contributors under ODbL 1.0 for the boundary."
  )
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(readChar(manifest_out, file_bytes(manifest_out), useBytes = TRUE))) {
  stop("manifest output failed JSON syntax validation", call. = FALSE)
}
validate_json_schema("schemas/data-manifest.schema.json", manifest_out)

cat(sprintf("wrote %s: %d row(s)\n", summary_json_out, length(rows)))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s: %d feature(s), %d bytes\n", boundary_out, nrow(written_boundary), file_bytes(boundary_out)))
cat(sprintf("wrote %s\n", manifest_out))
cat(sprintf("reconcile cut1(%d rows) & cut2(%d rows): Muslim %d / Others %d / total %d\n",
            cut1_recon$rows, cut2_recon$rows, expected_muslim, expected_others, expected_total))
cat(sprintf("minority-share: Muslim %.4f%% + Others %.4f%% = %.4f%%\n",
            reference_pct, minority_pct, reference_pct + minority_pct))
cat("done\n")
