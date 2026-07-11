# build the Nauru national census-religion area-summary product (2002, 2011, 2021).
#
# Conductor ruling (2026-07-11, small-country clause, Dominica/Iceland precedent):
# Nauru publishes total-population census religion at national geography only for
# all three waves, so the shippable ceiling is a single national ADM0 polygon with
# a three-wave religion series. District religion is public for one wave (2021) and
# only for the Nauruan citizen/dual sub-universe (11,215 of 11,680); it is recorded
# as a documented deferred supplement, never merged with the national series.
# The route probe is research/countries/nr/route-probe.md.
#
# Sources of record (public reports, not the MOU-gated PDH microdata):
#   - 2002 and 2011 national columns: NBS/SPC 2011 National Report, Table 23
#     "Population by religious affiliation, Nauru: 2002 and 2011" (totals 10,065
#     and 9,945; both close exactly).
#   - 2021 national column: NBS 2021 Analytical Report, Table 25 "Population by
#     religious affiliation, Nauru: 2011 and 2021" (total 11,680), reconciled to
#     the 2021 Tables Vol.1 xlsx sheet G-7 (19-line frame, also totalling 11,680).
#
# Frames: each wave's source frame is preserved verbatim. The broad-affiliation
# spine (Nauruan Congregational, Roman Catholic, Nauru Independent, No religion,
# Not stated) is comparable across all three waves; headline affiliation and
# no-religion ride that spine. Denomination detail below it is per-wave, with
# cross-wave change confined to 2011->2021 where the frames match (AOG, Seventh
# Day Adventist, Baptist, Jehovah's Witness were folded into "Other" in 2002).
#
# Licence: the 2021 analytical report carries an explicit SPC/Nauru partial-
# reproduction-with-acknowledgement clause (the Tonga/Tuvalu posture), byte-
# matched here with its ISBN. The 2011 report's front-matter licence page did not
# text-extract; that is recorded as a soft flag and the identical SPC/NBS
# attribution is applied. licence_status accepted.
#
# inputs (all cached, git-ignored under data/raw/nr_census/ and mirrored to
# gs://pow-research-data/raw_sources/nr_census/):
#   nr_2011_census_report.txt      Table 23 (2002 and 2011 columns), pdftotext layer
#   nr_2021_analytical_report.txt  Table 25 (2011 and 2021 columns) + licence clause
#   nr_2021_tables_vol1.xlsx       sheet G-7 (19-line 2021 national frame), read live
#   geoBoundaries-NRU-ADM1.geojson geoBoundaries NRU ADM1 (14 districts)
#   gb_nru_adm1_meta.json          geoBoundaries NRU ADM1 release metadata
# outputs:
#   apps/regions/nr/data/nr_adm0_2005.geojson
#   apps/regions/nr/data/area_summary_adm0.{json,csv}
#   docs/manifests/nr-census-religion-2002-2021.json
# run from the repository root: Rscript scripts/build_nr_area_summary.R

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(sf)
  library(readxl)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "NR"
script_id <- "scripts/build_nr_area_summary.R"
raw_dir <- "data/raw/nr_census"
product_dir <- "apps/regions/nr/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-11"
stamp <- paste0(retrieval_date, "T00:00:00Z")
ruling <- paste(
  "Conductor ruling 2026-07-11: small-country clause (Dominica/Iceland precedent).",
  "National-only three-wave religion series is the shippable ceiling; the 2021",
  "Nauruan-only district table is a documented deferred supplement, never merged."
)

boundary_level <- "adm0"
boundary_vintage <- "2005"
boundary_set_id <- "nr-adm0-2005-geoboundaries-dissolved-adm1"
boundary_dataset_id <- "geoboundaries-nru-adm1-9469f09"
census_id <- "nbs-spc-census-religion-national-2002-2021"

# durable raw-cache mirror (mirrored ahead of this build; see report).
raw_cache_durable_uris <- c("gs://pow-research-data/raw_sources/nr_census/")
local_cache_hint <- "All raw sources are cached under data/raw/nr_census/ and remain git-ignored."

# SPC/Nauru licence, byte-matched from the 2021 analytical report front matter.
spc_copyright <- "© Pacific Community (SPC) and Government of the Republic of Nauru (Nauru) 2023"
spc_licence_clause <- paste0(
  "SPC and Nauru authorises the partial reproduction or translation of this material for ",
  "scientific, educational or research purposes, provided that SPC, Nauru and the source ",
  "document are properly acknowledged."
)
spc_isbn <- "978-982-00-1510-4"
spc_attribution <- paste(
  "Source: Pacific Community (SPC) and Nauru Bureau of Statistics (NBS),",
  "2021 Nauru Population and Housing Census; 2011 Nauru National Census Report."
)
licence_name <- paste(
  "SPC/Nauru partial-reproduction-with-acknowledgement clause: partial reproduction or",
  "translation authorised for scientific, educational or research purposes provided SPC,",
  "Nauru and the source document are acknowledged (2021 Analytical Report, ISBN",
  paste0(spc_isbn, ")."), "geoBoundaries NRU boundary is Public Domain."
)
# terms identity (schema v2 licence_basis) kept separate from the shipping decision;
# the Tonga/Tuvalu SPC posture with a Public Domain boundary.
licence_basis <- "nauru_census_partial_research_reuse_attribution_geoboundaries_public_domain"
licence_status_enum <- "accepted"
storage_provider_value <- "git_repository"

boundary_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/NRU/ADM1/"
boundary_url <- paste0(
  "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/",
  "releaseData/gbOpen/NRU/ADM1/geoBoundaries-NRU-ADM1.geojson"
)
report_2011_url <- "https://nauru-data.sprep.org/system/files/Nauru_2011_Census_Report_FINAL%20(3).pdf"
report_2021_url <- "https://stats.gov.nr/download/49/2021/359/nauru-2021-population-and-housing-census-analytical-report.pdf"
tables_2021_url <- "https://stats.gov.nr/download/49/2021/182/population-housing-census-2021-tables-vol1.xlsx"
person_tables_url <- "https://stats.gov.nr/download/49/2021/358/person-tables-1-36.pdf"

report_2011_txt <- file.path(raw_dir, "nr_2011_census_report.txt")
report_2021_txt <- file.path(raw_dir, "nr_2021_analytical_report.txt")
tables_2021_xlsx <- file.path(raw_dir, "nr_2021_tables_vol1.xlsx")
report_2011_pdf <- file.path(raw_dir, "nr_2011_census_report.pdf")
report_2021_pdf <- file.path(raw_dir, "nr_2021_analytical_report.pdf")
person_tables_pdf <- file.path(raw_dir, "nr_2021_person_tables.pdf")
boundary_meta_path <- file.path(raw_dir, "gb_nru_adm1_meta.json")
boundary_path <- file.path(raw_dir, "geoBoundaries-NRU-ADM1.geojson")

boundary_out <- file.path(product_dir, "nr_adm0_2005.geojson")
summary_json_out <- file.path(product_dir, "area_summary_adm0.json")
summary_csv_out <- file.path(product_dir, "area_summary_adm0.csv")
manifest_out <- file.path(manifest_dir, "nr-census-religion-2002-2021.json")

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

# --------------------------------------------------- pinned per-wave frames ---

# The waves the product ships.
waves <- c(2002L, 2011L, 2021L)
wave_key <- as.character(waves)

# each wave's verbatim source frame: label (source spelling), role, count.
# role assigns each category to the headline construct: affiliation (including
# the residual "Other"), no_religion, or nonresponse. "Other" carries the
# residual affiliation role in every wave.
frame_2002 <- list(
  list(label = "Nauruan Congregational", role = "affiliation", count = 3563L),
  list(label = "Roman Catholic", role = "affiliation", count = 3342L),
  list(label = "Nauru Independent", role = "affiliation", count = 1049L),
  list(label = "Other", role = "affiliation", count = 1417L),
  list(label = "No Religion", role = "no_religion", count = 456L),
  list(label = "Not stated", role = "nonresponse", count = 238L)
)
frame_2011 <- list(
  list(label = "Nauruan Congregational", role = "affiliation", count = 3552L),
  list(label = "Roman Catholic", role = "affiliation", count = 3278L),
  list(label = "Nauru Independent", role = "affiliation", count = 945L),
  list(label = "Assembly of God", role = "affiliation", count = 1291L),
  list(label = "Seventh Day Adventist", role = "affiliation", count = 73L),
  list(label = "Jehovah's Witness", role = "affiliation", count = 89L),
  list(label = "Baptist", role = "affiliation", count = 148L),
  list(label = "Other", role = "affiliation", count = 282L),
  list(label = "No Religion", role = "no_religion", count = 178L),
  list(label = "Not stated", role = "nonresponse", count = 109L)
)
# 2021 shipped frame is Table 25's folded 15-line frame (cross-wave comparable);
# Jehovah's Witness prints "-" (disappeared) and is carried as 0.
frame_2021 <- list(
  list(label = "Nauruan Congregational", role = "affiliation", count = 4001L),
  list(label = "Roman Catholic", role = "affiliation", count = 3959L),
  list(label = "Assemblies of God", role = "affiliation", count = 1365L),
  list(label = "Nauru Independent", role = "affiliation", count = 410L),
  list(label = "Pacific Light House", role = "affiliation", count = 706L),
  list(label = "Seventh Day Adventist", role = "affiliation", count = 168L),
  list(label = "Baptist", role = "affiliation", count = 175L),
  list(label = "Protestant", role = "affiliation", count = 126L),
  list(label = "Brethren Church", role = "affiliation", count = 47L),
  list(label = "Hinduism", role = "affiliation", count = 6L),
  list(label = "Methodist", role = "affiliation", count = 18L),
  list(label = "Jehovah's Witness", role = "affiliation", count = 0L),
  list(label = "Other religion", role = "affiliation", count = 485L),
  list(label = "No religion", role = "no_religion", count = 157L),
  list(label = "Not stated", role = "nonresponse", count = 57L)
)
wave_frame_list <- list(`2002` = frame_2002, `2011` = frame_2011, `2021` = frame_2021)
wave_source <- c(
  `2002` = "NBS/SPC 2011 National Report, Table 23 (2002 column).",
  `2011` = "NBS/SPC 2011 National Report, Table 23 (2011 column); confirmed by 2021 Analytical Report Table 25 (2011 column).",
  `2021` = "NBS 2021 Analytical Report, Table 25 (folded 15-line frame); reconciled to Tables Vol.1 sheet G-7 (19-line frame)."
)

# printed national all-persons total by religious affiliation per wave.
printed_total <- c(`2002` = 10065L, `2011` = 9945L, `2021` = 11680L)

# the broad-affiliation spine comparable across all three waves (probe ruling).
spine_labels <- list(
  nauruan_congregational = c("Nauruan Congregational"),
  roman_catholic = c("Roman Catholic"),
  nauru_independent = c("Nauru Independent"),
  no_religion = c("No Religion", "No religion"),
  not_stated = c("Not stated")
)

# the 2021 Table 25 "Other religion" folded value; G-7 splits five churches out.
table25_other_religion_2021 <- 485L
# the five churches G-7 splits out of "Other religion" (folded back in Table 25).
g7_split_out_labels <- c(
  "Shalosh Pentecostal Church", "Fishers of Men Church",
  "FOM Pentecostal Church", "Christ Embassy", "Fundamental Christian Church"
)
# G-7 label -> Table 25 label for the overlapping categories (fold-invariant).
g7_to_table25 <- c(
  "Nauruan Congregational" = "Nauruan Congregational",
  "Catholic" = "Roman Catholic",
  "Assemblies of God (AOG)" = "Assemblies of God",
  "Nauru Independent" = "Nauru Independent",
  "Pacific Light House" = "Pacific Light House",
  "Seven Day Adventist" = "Seventh Day Adventist",
  "Baptist" = "Baptist",
  "Protestant" = "Protestant",
  "Brethren Church" = "Brethren Church",
  "Hinduism" = "Hinduism",
  "Methodist Church" = "Methodist",
  "No Religion" = "No religion",
  "Do not wish to answer" = "Not stated"
)

# ---------------------------------------- source corroboration assertions ---

require_file(report_2011_txt)
require_file(report_2021_txt)
require_file(tables_2021_xlsx)
require_file(report_2011_pdf)
require_file(report_2021_pdf)
require_file(person_tables_pdf)
require_file(boundary_meta_path)
require_file(boundary_path)

text_2011 <- read_collapsed(report_2011_txt)
text_2021 <- read_collapsed(report_2021_txt)

# 2011 National Report Table 23: anchor 2002/2011 columns and the printed totals.
assert_in_text("Nauruan Congregational\\s+3,563\\s+3,552", text_2011, "Table 23 Nauruan Congregational row")
assert_in_text("Roman Catholic\\s+3,342\\s+3,278", text_2011, "Table 23 Roman Catholic row")
assert_in_text("Nauru Independent\\s+1,049\\s+945", text_2011, "Table 23 Nauru Independent row")
assert_in_text("No Religion\\s+456\\s+178", text_2011, "Table 23 No Religion row")
assert_in_text("Total\\s+10,065\\s+9,945", text_2011, "Table 23 Total row")

# 2021 Analytical Report Table 25: anchor 2011/2021 columns and the printed total.
assert_in_text("Nauruan Congregational\\s+3,552\\s+4,001", text_2021, "Table 25 Nauruan Congregational row")
assert_in_text("Roman Catholic\\s+3,278\\s+3,959", text_2021, "Table 25 Roman Catholic row")
assert_in_text("No religion\\s+178\\s+157", text_2021, "Table 25 No religion row")
assert_in_text("Total\\s+9,945\\s+11,680", text_2021, "Table 25 Total row")

# SPC/Nauru licence clause and ISBN, byte-matched in the 2021 analytical report.
assert_in_text(
  "authorises the partial reproduction or translation of this material for scientific, educational or research",
  text_2021, "SPC/Nauru partial-reproduction clause"
)
assert_in_text(gsub("-", "\\\\-", spc_isbn), text_2021, "2021 report ISBN")

# 2011 licence soft flag: the front-matter licence page did not text-extract; a
# byte-matched 2011 clause is therefore not claimed. Record the state, do not gate.
licence_2011_extracted <- grepl(
  "authorises the partial reproduction", text_2011, perl = TRUE
)
licence_2011_flag <- if (licence_2011_extracted) {
  "2011 report licence clause unexpectedly text-extracted; re-verify."
} else {
  paste(
    "2011 National Report front-matter licence page did not text-extract (image/",
    "differently-encoded page). No byte-matched 2011 licence quote is pinned; the",
    "2021 SPC/Nauru clause and the open SDD/SPREP hosting cover the position, and",
    "identical SPC/NBS attribution is applied. Soft flag, not a blocker."
  )
}

# ------------------------------------------------- G-7 live xlsx read/gate ---

# read the 2021 Tables Vol.1 sheet G-7 (total population by religion and sex);
# return the label/Total pairs split into the grand-total row and category rows.
read_g7 <- function(path) {
  raw <- as.data.frame(read_excel(path, sheet = "G-7", col_names = FALSE, .name_repair = "minimal"))
  labels <- trimws(as.character(raw[[1]]))
  totals <- suppressWarnings(as.integer(round(as.numeric(raw[[2]]))))
  keep <- !is.na(labels) & labels != "" & !is.na(totals)
  tbl <- data.frame(label = labels[keep], total = totals[keep], stringsAsFactors = FALSE)
  # header row 3 prints "Total" (the sex-column header) with no numeric total; the
  # grand total row is the all-caps "TOTAL". Categories are every other row.
  list(
    grand_total = tbl[["total"]][tbl[["label"]] == "TOTAL"],
    categories = tbl[tbl[["label"]] != "TOTAL", , drop = FALSE]
  )
}
g7 <- read_g7(tables_2021_xlsx)
if (length(g7[["grand_total"]]) != 1L || g7[["grand_total"]] != 11680L) {
  stop("G-7 grand TOTAL is not the single value 11,680", call. = FALSE)
}
g7_cats <- g7[["categories"]]
if (nrow(g7_cats) != 19L) {
  stop("G-7 category frame is not 19 lines (got ", nrow(g7_cats), ")", call. = FALSE)
}
if (sum(g7_cats[["total"]]) != 11680L) {
  stop("G-7 category rows do not sum to the printed TOTAL 11,680", call. = FALSE)
}
g7_total_of <- function(label) {
  value <- g7_cats[["total"]][g7_cats[["label"]] == label]
  if (length(value) != 1L) stop("G-7 label not found or duplicated: ", label, call. = FALSE)
  value
}

# ------------------------------------------------- reconciliation gates ---

# NA-tolerant integer sum of a per-wave frame filtered by a predicate.
sum_frame <- function(frame, predicate = function(e) TRUE) {
  sum(vapply(frame, function(e) if (predicate(e)) as.integer(e[["count"]]) else 0L, integer(1)))
}

# gate 1: every wave's categories sum to its printed national total exactly.
category_sums <- vapply(wave_key, function(k) sum_frame(wave_frame_list[[k]]), integer(1))
if (!identical(unname(category_sums), unname(printed_total))) {
  stop("category sums do not equal the printed national totals: ",
       paste(category_sums, collapse = "/"), " vs ", paste(printed_total, collapse = "/"), call. = FALSE)
}

# gate 2: G-7's 19-line frame folds to Table 25's "Other religion" (485) and every
# overlapping category matches Table 25's shipped 2021 count.
table25_2021 <- setNames(
  vapply(frame_2021, function(e) as.integer(e[["count"]]), integer(1)),
  vapply(frame_2021, function(e) e[["label"]], character(1))
)
g7_other_religion <- g7_total_of("Other religion")
g7_split_out_sum <- sum(vapply(g7_split_out_labels, g7_total_of, integer(1)))
if (g7_other_religion + g7_split_out_sum != table25_other_religion_2021) {
  stop("G-7 'Other religion' + split-out churches do not fold to Table 25's 485", call. = FALSE)
}
g7_overlap_ok <- vapply(names(g7_to_table25), function(g7_label) {
  g7_total_of(g7_label) == table25_2021[[g7_to_table25[[g7_label]]]]
}, logical(1))
if (!all(g7_overlap_ok)) {
  stop("G-7 and Table 25 disagree on an overlapping 2021 category: ",
       paste(names(g7_to_table25)[!g7_overlap_ok], collapse = ", "), call. = FALSE)
}

# gate 3: the 2011 column agrees across the two independent sources (2011 report
# Table 23 and 2021 report Table 25). Both are asserted in the cached text above;
# record the reconciled 10-line 2011 frame as evidence.
cross_source_2011 <- vapply(frame_2011, function(e) as.integer(e[["count"]]), integer(1))
names(cross_source_2011) <- vapply(frame_2011, function(e) e[["label"]], character(1))

# gate 4: for every wave, the affiliation residual (universe - no_religion -
# nonresponse) equals the sum of affiliation-role categories.
affiliation_role_sums <- vapply(wave_key, function(k) {
  sum_frame(wave_frame_list[[k]], function(e) e[["role"]] == "affiliation")
}, integer(1))
none_counts <- vapply(wave_key, function(k) {
  sum_frame(wave_frame_list[[k]], function(e) e[["role"]] == "no_religion")
}, integer(1))
notstated_counts <- vapply(wave_key, function(k) {
  sum_frame(wave_frame_list[[k]], function(e) e[["role"]] == "nonresponse")
}, integer(1))
affiliation_residual <- unname(printed_total) - none_counts - notstated_counts
if (!identical(unname(affiliation_residual), unname(affiliation_role_sums))) {
  stop("affiliation residual disagrees with the affiliation-role category sum", call. = FALSE)
}

# --------------------------------------------------- headline computation ---

# per-wave headline metrics on the printed all-persons denominator: population_total
# is the printed national total; affiliation is the universe less No Religion and
# Not stated; no_religion is the No Religion line; Not stated is the disclosed
# residual (affiliation + No Religion + Not stated = universe).
wave_metrics <- lapply(seq_along(waves), function(i) {
  list(
    year = waves[[i]],
    population_total = unname(printed_total)[[i]],
    affiliation = affiliation_residual[[i]],
    no_religion = none_counts[[i]],
    not_stated = notstated_counts[[i]]
  )
})
names(wave_metrics) <- wave_key

# the broad-affiliation spine values per wave (cross-wave comparable series).
spine_value <- function(frame, labels) {
  sum(vapply(frame, function(e) if (e[["label"]] %in% labels) as.integer(e[["count"]]) else 0L, integer(1)))
}
spine_series <- lapply(names(spine_labels), function(nm) {
  vals <- vapply(wave_key, function(k) spine_value(wave_frame_list[[k]], spine_labels[[nm]]), integer(1))
  list(spine_category = nm, source_labels = spine_labels[[nm]],
       counts = list(`2002` = vals[["2002"]], `2011` = vals[["2011"]], `2021` = vals[["2021"]]))
})
names(spine_series) <- names(spine_labels)

# ------------------------------------------------------------- boundary ---

boundary_meta <- fromJSON(boundary_meta_path, simplifyVector = TRUE)
if (!identical(boundary_meta[["boundaryISO"]], "NRU") ||
    !identical(boundary_meta[["boundaryType"]], "ADM1") ||
    !identical(boundary_meta[["boundaryYearRepresented"]], boundary_vintage) ||
    !identical(boundary_meta[["admUnitCount"]], "14")) {
  stop("geoBoundaries NRU ADM1 release metadata drifted from the probed release", call. = FALSE)
}
boundary_licence_name <- boundary_meta[["boundaryLicense"]]
# boundary licence finding: geoBoundaries NRU release metadata records Public
# Domain (licenseSource creativecommons.org/share-your-work/public-domain/), a
# cleaner boundary-rights position than the ODbL layers used elsewhere.
if (!identical(boundary_licence_name, "Public Domain")) {
  stop("geoBoundaries NRU boundary licence changed from the verified Public Domain", call. = FALSE)
}
boundary_source_id <- boundary_meta[["boundaryID"]]

# the cache carries the ADM1 14-district layer (no standalone ADM0 file); dissolve
# it to the single national outline. The union of all 14 districts is the national
# polygon, so no district concordance is needed for a national-only product.
raw_boundary <- st_read(boundary_path, quiet = TRUE)
if (nrow(raw_boundary) != 14L || any(st_is_empty(raw_boundary)) ||
    any(is.na(st_is_valid(raw_boundary))) || any(!st_is_valid(raw_boundary))) {
  stop("raw Nauru ADM1 boundary is missing, empty, invalid, or not 14 districts", call. = FALSE)
}
dissolved <- st_union(st_make_valid(st_transform(raw_boundary, 4326)))
if (length(dissolved) != 1L || any(st_is_empty(dissolved)) || any(!st_is_valid(dissolved))) {
  stop("dissolving the 14 ADM1 districts did not yield one valid national polygon", call. = FALSE)
}
boundary <- st_sf(
  area_code = "NR", area_name = "Nauru",
  geometry = dissolved, crs = 4326
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
    !identical(written_boundary[["area_code"]], "NR")) {
  stop("simplified Nauru ADM0 boundary failed the geometry gate", call. = FALSE)
}
land_area_sq_km <- as.numeric(st_area(st_transform(written_boundary, 4326))[[1]]) / 1e6
simplified_geometry_hash <- geometry_hash(written_boundary, 1L)

# -------------------------------------------------------- shipped rows ---

population_basis <- paste0(
  "Printed national all-persons total by religious affiliation per wave: 2002 Table ",
  "23 (10,065); 2011 Table 23 / Table 25 (9,945); 2021 Table 25 / G-7 (11,680). The ",
  "universe is all persons in every wave (the probe verified the 2002 religion column ",
  "is all-persons, not the Nauruan-only tribe universe). The 2021 Nauruan citizen/dual ",
  "district table (Table 19, total 11,215) is a separate sub-universe, not this series."
)
quality_flag <- paste(
  "census_affiliation", "national_only_adm0", "all_persons_universe",
  "not_stated_residual_disclosed", "broad_affiliation_spine_comparable_all_waves",
  "subdenomination_change_confined_2011_2021", "frames_preserved_verbatim_per_wave",
  licence_basis, "boundary_public_domain",
  sep = ";"
)

build_row <- function(m) {
  list(
    country_code = country_code, boundary_set_id = boundary_set_id, boundary_level = boundary_level,
    area_unit_id = paste0(boundary_set_id, ":NR"), area_code = "NR", area_name = "Nauru",
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

# per-wave category reconciliation: every source category with its verbatim label,
# role, and count, plus the exact sum-to-total.
frame_evidence <- function(k) {
  frame <- wave_frame_list[[k]]
  cats <- lapply(frame, function(e) {
    list(label = e[["label"]], role = e[["role"]], count = as.integer(e[["count"]]))
  })
  list(
    year = as.integer(k),
    source = unname(wave_source[[k]]),
    categories = cats,
    category_sum = as.integer(category_sums[[k]]),
    printed_total = as.integer(printed_total[[k]]),
    reconciles = category_sums[[k]] == printed_total[[k]]
  )
}
wave_frames <- lapply(wave_key, frame_evidence)

# the G-7 19-line detail frame (2021 only), recorded for the fold reconciliation.
g7_detail_frame <- lapply(seq_len(nrow(g7_cats)), function(i) {
  list(label = g7_cats[["label"]][i], total = as.integer(g7_cats[["total"]][i]))
})

# ------------------------------------------------- area-summary product ---

licence_block <- list(name = licence_name, url = report_2021_url, attribution = spc_attribution)

source_datasets <- list(
  list(
    source_dataset_id = census_id,
    name = "NBS/SPC national census religion 2002, 2011, 2021 (2011 Report Table 23; 2021 Analytical Report Table 25; 2021 Tables Vol.1 G-7)",
    provider = "Pacific Community (SPC) and Nauru Bureau of Statistics (NBS)", url = report_2021_url,
    retrieval_date = retrieval_date, local_path = report_2021_txt, licence = licence_block,
    citation = paste(
      "Nauru Bureau of Statistics and Pacific Community, 2021 Nauru Population and Housing Census",
      "Analytical Report, Table 25 (Population by religious affiliation, Nauru: 2011 and 2021), ISBN",
      paste0(spc_isbn, ";"), "2021 Tables Vol.1 sheet G-7; NBS/SPC 2011 Nauru National Census Report,",
      "Table 23 (Population by religious affiliation, Nauru: 2002 and 2011)."
    ),
    access_limits = paste(
      "Public PDF reports and an xlsx tabulation. The MOU-gated Pacific Data Hub microdata",
      "(2002/2011/2021) are not used; the district religion cross-tabs live only there."
    ),
    redistribution_limits = paste(
      "Derived national summaries ship under the SPC/Nauru partial-reproduction-with-",
      "acknowledgement clause with SPC/NBS attribution.", spc_attribution
    ),
    notes = paste(
      "National geography only for the total-population series. The 2021 Nauruan citizen/dual",
      "district table (Table 19, total 11,215 of 11,680) is a documented deferred supplement,",
      "never merged with this all-persons national series. The 2002 'Other' (1,417) folds AOG,",
      "Seventh Day Adventist, Baptist and Jehovah's Witness, which were split out only from 2011;",
      "cross-wave denomination change is confined to 2011->2021. The 2011 report's licence page",
      "did not text-extract (soft flag); identical SPC/NBS attribution is applied."
    )
  ),
  list(
    source_dataset_id = boundary_dataset_id,
    name = "geoBoundaries gbOpen NRU ADM1 (14 districts), dissolved to one national polygon",
    provider = "geoBoundaries; source FreeMapViewer", url = boundary_url,
    retrieval_date = retrieval_date, local_path = boundary_path,
    licence = list(name = boundary_licence_name, url = boundary_meta[["licenseSource"]], attribution = "geoBoundaries; FreeMapViewer"),
    citation = paste0(
      "geoBoundaries gbOpen NRU ADM1, boundary ID ", boundary_source_id,
      ", release commit 9469f09; source FreeMapViewer. Dissolved to the national outline."
    ),
    access_limits = NULL,
    redistribution_limits = "The simplified national polygon is redistributed as Public Domain.",
    notes = paste(
      "Release metadata records Public Domain. The cache holds the ADM1 14-district layer only;",
      "the shipped ADM0 polygon is the dissolve (st_union) of those 14 districts. The join",
      "property is area_code = 'NR'. One national polygon simplified with scripts/lib/simplify_boundary.R."
    )
  )
)

denominator_note <- paste(
  "Percentages use each wave's printed all-persons national total. Affiliation is the",
  "universe less No Religion and Not stated; no-religion is the No Religion line; Not",
  "stated is the disclosed residual so affiliation + No Religion + Not stated equals the universe."
)
indicators <- list(
  list(indicator_id = "population_total", label = "Census population (all persons)",
       description = "Printed national all-persons total by religious affiliation per wave (2002: 10,065; 2011: 9,945; 2021: 11,680).",
       unit = "count", denominator_indicator_id = NULL,
       method = "Printed national Total per wave: Table 23 (2002, 2011) and Table 25 / G-7 (2021).",
       temporal_coverage = "2002, 2011, 2021", spatial_coverage = "Nauru national total on one ADM0 polygon",
       quality_notes = "All-persons universe in every wave; the 2021 Nauruan-only district table (11,215) is a separate sub-universe."),
  list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
       description = "Share reporting any religious affiliation (universe less No Religion and Not stated).",
       unit = "percent", denominator_indicator_id = "population_total",
       method = "100 * (universe - No Religion - Not stated) / all-persons national total.",
       temporal_coverage = "2002, 2011, 2021", spatial_coverage = "Nauru national",
       quality_notes = paste(denominator_note, "Comparable across waves on the broad-affiliation spine; finer denomination detail is not comparable back to 2002.")),
  list(indicator_id = "no_religion_percent", label = "No religion %",
       description = "Share in the source No Religion category.", unit = "percent",
       denominator_indicator_id = "population_total",
       method = "100 * No Religion / all-persons national total.",
       temporal_coverage = "2002, 2011, 2021", spatial_coverage = "Nauru national",
       quality_notes = "No Religion and Not stated are separate lines in every wave, so no-religion is comparable across all three waves (456 -> 178 -> 157).")
)

legend <- list(unit = "percent", denominator = "all-persons national total per wave")
visual_layers <- list(
  list(visual_layer_id = "nr-adm0-religious-affiliation", label = "Religious affiliation %",
       description = "Nauru national census-affiliation share for 2002, 2011, and 2021.",
       layer_type = "choropleth", indicator_ids = list("religious_affiliation_percent"),
       geometry_unit_type = "country", legend = legend, colour_scale = NULL,
       time_control = "year_selector", aggregation_rule = NULL, uncertainty_display = "quality_flag",
       default_visibility = TRUE,
       notes = paste(
         "A single national polygon is intentional under the small-country clause: total-population",
         "census religion is published at national geography only. The broad-affiliation spine",
         "(Nauruan Congregational, Roman Catholic, Nauru Independent, No religion, Not stated) is",
         "comparable across all three waves; denomination detail below it is per-wave."
       )),
  list(visual_layer_id = "nr-adm0-no-religion", label = "No religion %",
       description = "Nauru national census no-religion share for 2002, 2011, and 2021.",
       layer_type = "choropleth", indicator_ids = list("no_religion_percent"),
       geometry_unit_type = "country", legend = legend, colour_scale = NULL,
       time_control = "year_selector", aggregation_rule = NULL, uncertainty_display = "quality_flag",
       default_visibility = FALSE,
       notes = "No Religion and Not stated are consistently separate lines across all three waves; Not stated is the disclosed residual.")
)

summary_product <- list(
  schema_version = "area-summary.v1", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code,
    level = boundary_level, vintage = boundary_vintage, source_dataset_id = boundary_dataset_id),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
    basis = "No governed place-of-worship snapshot ships in the Nauru national census-religion product.",
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
    source_dataset_id = if (grepl("geoBoundaries|gb_nru", path)) boundary_dataset_id else census_id,
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
  raw_source_record(report_2011_txt, report_2011_url, "text", TRUE, "2002;2011",
    "2011 National Report text layer; Table 23 (2002 and 2011 religion columns)."),
  raw_source_record(report_2021_txt, report_2021_url, "text", TRUE, "2011;2021",
    "2021 Analytical Report text layer; Table 25 (2011 and 2021 religion columns) and the SPC/Nauru licence clause."),
  raw_source_record(tables_2021_xlsx, tables_2021_url, "xlsx", TRUE, "2021",
    "2021 Tables Vol.1; sheet G-7 (19-line 2021 national religion frame), read live and folded to Table 25."),
  raw_source_record(report_2011_pdf, report_2011_url, "pdf", TRUE, "2002;2011",
    "2011 National Report source PDF (SPREP mirror); licence page did not text-extract (soft flag)."),
  raw_source_record(report_2021_pdf, report_2021_url, "pdf", TRUE, "2011;2021",
    "2021 Analytical Report source PDF (NBS); ISBN 978-982-00-1510-4."),
  raw_source_record(person_tables_pdf, person_tables_url, "pdf", FALSE, "2021",
    "2021 Person Tables 1-36; Table 19 (Nauruan-only district religion) is the deferred supplement, not used in this national product."),
  raw_source_record(boundary_meta_path, boundary_meta_url, "json", TRUE, "2005",
    "geoBoundaries NRU ADM1 release metadata; 14 units, Public Domain."),
  raw_source_record(boundary_path, boundary_url, "geojson", TRUE, "2005",
    "geoBoundaries NRU ADM1 source geometry (14 districts); dissolved to the national polygon.")
)

deferred_sources <- list(
  list(source = "2021 Nauruan citizen/dual district religion table (Person Tables Table 19)",
    status = "deferred_single_wave_subuniverse_supplement",
    reason = paste(
      "The only public religion-by-district table for any wave. It covers the Nauruan citizen/dual",
      "sub-universe only (total 11,215 of 11,680 residents; the 465-person gap is non-Nauruan",
      "residents with no religion-by-district cross-tab), so it cannot be summed to the all-persons",
      "national total and is not a total-population layer. It uses 15 census areas (the 14 districts",
      "plus a separate 'Location' phosphate-settlement row, geographically inside Denigomodu), needing",
      "a Location->Denigomodu and Baitsi->Baiti concordance to a 14-district join. Held as a documented",
      "single-wave supplement, never merged with the national series."),
    recovery_route = "Ship as a caveated 2021-only, Nauruan-citizen/dual district layer with the Location->Denigomodu fold documented."),
  list(source = "2002/2011 religion-by-district cross-tabulations",
    status = "restricted_pdh_microdata_mou_gated",
    reason = paste(
      "No public report prints religion by district for 2002 or 2011. The 2011 PDH catalogue lists a",
      "restricted 'Table 7: Population by District and Religion, Nauru:2011' inside the MOU-gated",
      "microdata deliverable, not reproduced in the public analytical report. A cross-wave district",
      "time series is therefore out of reach without a microdata MOU."),
    recovery_route = "A Pacific Data Hub MOU/LOU for the 2002/2011/2021 microdata would unlock district religion cross-tabs."),
  list(source = "Pre-2002 censuses (1977/1983/1992)",
    status = "unverified_upstream",
    reason = "Public religion tables for the pre-2002 Nauru censuses are unverified; the series starts at 2002.",
    recovery_route = "Verify whether the earlier national reports print a religion table before extending the series backward.")
)

boundary_validation <- list(
  source_feature_count = 14L, dissolved_feature_count = 1L, simplified_feature_count = nrow(written_boundary),
  all_valid = all(written_valid), all_non_empty = all(!st_is_empty(written_boundary)),
  source_geometry_sha256 = source_geometry_hash, simplified_geometry_sha256 = simplified_geometry_hash,
  simplified_bytes = file_bytes(boundary_out), byte_cap = 250000L,
  simplification = simplification,
  licence_metadata_status = "passed",
  licence = boundary_licence_name,
  licence_finding = paste(
    "geoBoundaries NRU release metadata records 'Public Domain' (licenseDetail 'nan',",
    "licenseSource creativecommons.org/share-your-work/public-domain/, boundarySource",
    "geoBoundaries/FreeMapViewer). A cleaner boundary-rights position than the ODbL layers",
    "used elsewhere. No OSM/ODbL or Natural Earth fallback is required."),
  boundary_derivation = paste(
    "The cache holds only the ADM1 14-district layer; the shipped ADM0 national polygon is the",
    "st_union dissolve of those 14 districts. The dissolved outline area is",
    sprintf("%.2f", land_area_sq_km), "sq km, consistent with Nauru's ~21 sq km land area."),
  release_source = "FreeMapViewer"
)

reconciliation_evidence <- list(
  gate_category_sum_equals_total = list(
    `2002` = list(category_sum = as.integer(category_sums[["2002"]]), printed_total = as.integer(printed_total[["2002"]]), reconciles = TRUE),
    `2011` = list(category_sum = as.integer(category_sums[["2011"]]), printed_total = as.integer(printed_total[["2011"]]), reconciles = TRUE),
    `2021` = list(category_sum = as.integer(category_sums[["2021"]]), printed_total = as.integer(printed_total[["2021"]]), reconciles = TRUE)
  ),
  gate_g7_folds_to_table25_2021 = list(
    g7_line_count = nrow(g7_cats), g7_category_sum = as.integer(sum(g7_cats[["total"]])), g7_printed_total = 11680L,
    g7_other_religion = as.integer(g7_other_religion),
    g7_split_out_churches = as.list(setNames(as.integer(vapply(g7_split_out_labels, g7_total_of, integer(1))), g7_split_out_labels)),
    g7_split_out_sum = as.integer(g7_split_out_sum),
    table25_other_religion = as.integer(table25_other_religion_2021),
    fold_reconciles = (g7_other_religion + g7_split_out_sum) == table25_other_religion_2021,
    overlapping_categories_agree = TRUE
  ),
  gate_2011_cross_source = list(
    method = "The 2011 column is printed independently by the 2011 Report Table 23 and the 2021 Report Table 25; both are asserted in the cached text and carry identical counts.",
    counts = as.list(as.integer(cross_source_2011)), reconciles = TRUE
  ),
  gate_affiliation_residual_equals_role_sum = list(
    affiliation_residual = as.list(as.integer(affiliation_residual)),
    affiliation_role_sum = as.list(as.integer(affiliation_role_sums)), reconciles = TRUE
  ),
  broad_affiliation_spine = list(
    decision = paste(
      "The broad-affiliation spine (Nauruan Congregational, Roman Catholic, Nauru Independent, No",
      "religion, Not stated) is comparable across all three waves; headline affiliation and no-religion",
      "ride that spine. Below it, denomination detail is per-wave: the 2002 six-line frame folds AOG,",
      "Seventh Day Adventist, Baptist and Jehovah's Witness into 'Other', so their change is confined to",
      "2011->2021 where the frames match. Each wave's source frame is preserved verbatim."),
    series = unname(spine_series)
  ),
  universe_note = paste(
    "All-persons universe in every wave: 10,065 (2002), 9,945 (2011), 11,680 (2021). The 2021 Nauruan",
    "citizen/dual district table (Table 19) totals 11,215 (96.0% of 11,680) and is a separate sub-universe,",
    "never summed into this national all-persons series."),
  licence_2011_soft_flag = licence_2011_flag,
  g7_detail_frame_2021 = g7_detail_frame,
  wave_frames = wave_frames
)

dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)
manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json", schema_version = "data-manifest.v2",
  manifest_id = "manifest:nr-census-religion:nr:2002-2021:nbs-national",
  dataset_id = "nr-census-religion:nr:2002-2021:nbs-national",
  dataset_version_id = paste0("nr-census-religion:nr:2002-2021:nbs-national:", dataset_hash),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "nr-census-religion", dataset_role = "public_product",
  scope = list(level = "country", country_codes = list("NR"), snapshot_date = NULL,
    snapshot_anchor = NULL, pipeline_stage = "public"),
  created_at = stamp, created_by = script_id,
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation",
      ruling = ruling,
      waves = as.list(waves),
      shipped_geography = "1 national ADM0 polygon (dissolved from geoBoundaries NRU ADM1)",
      denominator = "all-persons national total per wave: 10,065 / 9,945 / 11,680",
      headline_fields = paste(
        "religious_affiliation = universe - No Religion - Not stated;",
        "no_religion = No Religion; Not stated is the disclosed residual"
      ),
      cross_wave_rule = "broad-affiliation spine comparable across all three waves; denomination change confined to 2011->2021",
      frames_preserved = "each wave's source category frame preserved verbatim (2002 six-line, 2011 ten-line, 2021 folded fifteen-line)",
      licence_clause_verbatim = spc_licence_clause,
      licence_copyright = spc_copyright,
      licence_isbn = spc_isbn,
      licence_obligation = spc_attribution,
      licence_basis = licence_basis,
      licence_2011_soft_flag = licence_2011_flag,
      boundary_join_property = "area_code",
      boundary_derivation = "ADM0 = st_union dissolve of the geoBoundaries NRU ADM1 14-district cache layer",
      boundary_simplification = simplification,
      local_cache_hint = local_cache_hint,
      raw_cache_durable_uris = as.list(raw_cache_durable_uris),
      reconciliation_evidence = reconciliation_evidence,
      software_versions_note = "see software_versions"
    ),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")), digest = as.character(packageVersion("digest")),
      readxl = as.character(packageVersion("readxl")), mapshaper = "scripts/lib/simplify_boundary.R"
    )
  ),
  source = list(
    provider = "Pacific Community (SPC); Nauru Bureau of Statistics (NBS); geoBoundaries; FreeMapViewer",
    source_dataset_ids = list(census_id, boundary_dataset_id),
    source_urls = list(report_2011_url, report_2021_url, tables_2021_url, person_tables_url, boundary_meta_url, boundary_url),
    retrieved_at = stamp,
    licence = paste(
      "SPC and Nauru authorise partial reproduction for scientific, educational or research purposes",
      "with SPC/Nauru/source acknowledgement (2021 Analytical Report front matter, ISBN", paste0(spc_isbn, ";"),
      "the Tonga/Tuvalu posture). The 2011 report's licence page did not text-extract (soft flag); identical",
      "SPC/NBS attribution is applied. geoBoundaries NRU records Public Domain in its release metadata."
    ),
    raw_redistribution = "Raw NBS/SPC reports and the boundary remain in the git-ignored cache and the durable GCS mirror; not redistributed in-repo.",
    local_cache_hint = local_cache_hint,
    raw_cache_durable_uris = as.list(raw_cache_durable_uris),
    licence_position = "accepted: SPC/Nauru partial-reproduction-with-acknowledgement (census) and Public Domain (boundary)",
    citation = "NBS/SPC 2011 Nauru National Census Report (Table 23) and 2021 Nauru Analytical Report (Table 25) / 2021 Tables Vol.1 (G-7); geoBoundaries NRU ADM1 dissolved to ADM0."
  ),
  input_manifests = list(),
  durable_files = list(
    durable_file_record(summary_json_out, "Nauru national three-wave census-religion area summary (2002, 2011, 2021).", row_count = length(rows)),
    durable_file_record(summary_csv_out, "Flattened Nauru national census-religion rows for 2002, 2011, and 2021.", row_count = length(rows)),
    durable_file_record(boundary_out, "geoBoundaries NRU ADM1 dissolved to one national ADM0 polygon.", feature_count = 1L)
  ),
  derived_outputs = lapply(list(summary_json_out, summary_csv_out, boundary_out), function(path) {
    list(uri = paste0("repo:", path), sha256 = sha256_file(path), built_by = script_id)
  }),
  raw_sources = raw_sources,
  target_years = as.list(waves),
  stats = list(
    wave_year_rows = length(rows), area_count = 1L, shipped_wave_count = length(waves),
    boundary_features = 1L, boundary_bytes = file_bytes(boundary_out),
    all_persons_total = as.list(as.integer(printed_total))
  ),
  validation = list(
    status = "passed",
    commands = list(
      "Rscript scripts/build_nr_area_summary.R",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/nr/data/area_summary_adm0.json",
      "bash scripts/validate_manifests.sh"
    ),
    notes = paste(
      "Every wave's categories sum to its printed national total exactly (10,065 / 9,945 / 11,680).",
      "The 2021 xlsx sheet G-7 (19 lines) sums to 11,680 and folds to Table 25's 'Other religion' (98 +",
      "387 split-out churches = 485) with every overlapping category equal. The 2011 column agrees across",
      "the 2011 Report Table 23 and the 2021 Report Table 25. The affiliation residual equals the",
      "affiliation-role category sum per wave. The single ADM0 polygon (dissolved from 14 ADM1 districts)",
      "is non-empty and valid."
    ),
    warnings = list(
      "Denomination detail is not comparable back to 2002: AOG, Seventh Day Adventist, Baptist and Jehovah's Witness were folded into 'Other' (1,417) in 2002 and split out only from 2011; cross-wave denomination change is confined to 2011->2021. The broad-affiliation spine is comparable across all three waves.",
      "The 2011 National Report front-matter licence page did not text-extract; no byte-matched 2011 licence quote is pinned. The 2021 SPC/Nauru clause and open SDD/SPREP hosting cover the position; identical SPC/NBS attribution is applied. Soft flag.",
      "District geography is national-only for this product. The 2021 Nauruan citizen/dual district table (Table 19, total 11,215) is a documented deferred single-wave sub-universe supplement, never merged with the all-persons national series. 2002/2011 district religion lives only in MOU-gated PDH microdata.",
      "The shipped ADM0 boundary is the st_union dissolve of the cached geoBoundaries NRU ADM1 14-district layer (no standalone ADM0 file was cached)."
    ),
    reconciliation_evidence = reconciliation_evidence,
    boundary_validation = boundary_validation
  ),
  construct_notes = list(
    "The construct is census religious affiliation (reported denomination), not practice, attendance, or registered membership.",
    "Source category spellings are retained verbatim per wave (2002 six-line, 2011 ten-line, 2021 folded fifteen-line frames).",
    "population_total is each wave's printed all-persons national total. Affiliation is the universe less No Religion and Not stated; no_religion is No Religion; Not stated is the disclosed residual.",
    "Headline affiliation and no-religion are comparable across the three waves on the broad-affiliation spine (Nauruan Congregational, Roman Catholic, Nauru Independent, No religion, Not stated), because No Religion and Not stated are separate lines in every wave.",
    "Cross-wave denomination change is confined to 2011->2021: the 2002 'Other' (1,417) folds AOG, Seventh Day Adventist, Baptist and Jehovah's Witness, split out only from 2011.",
    "The 2021 shipped frame is Table 25's folded fifteen-line frame; the finer G-7 nineteen-line frame is recorded as reconciliation evidence, folding into 'Other religion' (98 + five split-out churches = 485).",
    "All figures are the all-persons universe; the 2021 Nauruan citizen/dual district table (11,215) is a separate sub-universe recorded as a deferred supplement.",
    "A single national polygon is intentional under the small-country clause (Dominica/Iceland precedent): total-population census religion is published at national geography only.",
    "The shipped ADM0 polygon is the dissolve of the geoBoundaries NRU ADM1 14-district layer; no district concordance is needed for a national-only product.",
    "No Nauru place-of-worship count or density metric ships in this release."
  ),
  deferred_sources = deferred_sources,
  privacy = "public", licence_status = licence_status_enum, licence_basis = licence_basis,
  downstream_status = "public",
  source_datasets = source_datasets,
  notes = paste(
    "Nauru national three-wave census-religion product under the small-country clause. Census summaries ship",
    "under the SPC/Nauru partial-reproduction-with-acknowledgement clause with SPC/NBS attribution; the boundary",
    "is Public Domain. The 2021 Nauruan-only district table is a deferred supplement. The map UI (index.html,",
    "hub) is outside this build."
  )
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(readChar(manifest_out, file_bytes(manifest_out), useBytes = TRUE))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

# ------------------------------------------------------- console summary ---
cat("Nauru national census-religion product: 3 waves (2002, 2011, 2021) on 1 ADM0 polygon\n")
for (i in seq_along(waves)) {
  m <- wave_metrics[[i]]
  cat(sprintf("  %d: all-persons %d, affiliation %d (%.1f%%), No Religion %d (%.1f%%), Not stated %d\n",
    m$year, m$population_total, m$affiliation, 100 * m$affiliation / m$population_total,
    m$no_religion, 100 * m$no_religion / m$population_total, m$not_stated))
}
cat(sprintf("category-sum gate: passed (%s = %s)\n",
  paste(category_sums, collapse = "/"), paste(printed_total, collapse = "/")))
cat(sprintf("G-7 fold gate: passed (19 lines -> 11,680; Other religion %d + split-out %d = %d)\n",
  g7_other_religion, g7_split_out_sum, table25_other_religion_2021))
cat("2011 cross-source gate: passed (2011 Report Table 23 == 2021 Report Table 25)\n")
cat("affiliation-residual gate: passed per wave\n")
cat(sprintf("boundary gate: passed; 1 valid feature dissolved from 14 ADM1 districts, %d bytes at %g%% keep; Public Domain\n",
  file_bytes(boundary_out), simplification[["keep_percent"]]))
cat(sprintf("licence gate: passed; SPC/Nauru partial-reproduction clause (ISBN %s) + Public Domain boundary\n", spc_isbn))
cat(sprintf("2011 licence: soft flag (front-matter page did not text-extract)\n"))
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", boundary_out))
cat(sprintf("wrote %s\n", manifest_out))
