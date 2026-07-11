# build the Niue national census-religion area-summary product (1986-2022, eight waves).
#
# Conductor ruling (2026-07-11, small-country clause, Iceland/Dominica/Nauru precedent):
# Niue publishes census religion at national geography only in every wave, never by
# village, so the shippable ceiling is a single national ADM0 polygon carrying an
# eight-wave national religious-affiliation series. The route probe is
# research/countries/nu/route-probe.md.
#
# SOURCE-OF-RECORD RULE (load-bearing, non-negotiable): each wave's counts come from
# its CONTEMPORANEOUS report.
#   - 1986/1991/1997/2001/2006 from the 2006 report's Appendix Table 2 (nine-category
#     frame with a separate "Not stated" line; every column reconciles to its Total).
#   - 2011/2017/2022 from the 2022 report's Table 3.3 for its OWN three waves only
#     (no separate "Not stated" line; refusals are folded into "Others").
# The 2022 report's republished 1997/2001/2006 columns are corrupted: they do not
# self-reconcile (+1 / -17 / +6 row-sum offsets) and diverge from the contemporaneous
# 2006 appendix (e.g. 2006 Ekalesia 954 vs 956, LDS 123 vs 127, JW 31 vs 28, None 154
# vs 43+101=144). Those republished columns are NEVER used as a source; they are carried
# only as a documented discrepancy record (Saint Lucia / Cote d'Ivoire render-the-record
# precedent). No cell is redistributed.
#
# Slot conventions (ordinary two-slot): religious_affiliation = summed named religious
# categories (Ekalesia + Roman Catholic/Catholic + Latter Day Saints + Seventh Day
# Adventist + Jehovah's Witness + Others); no_religion = the "None" line. "Not stated"
# (where a separate line exists, i.e. the 2006-appendix waves) stays in the denominator
# and in neither slot, disclosed per row. In the 2011/2017/2022 Table 3.3 frame there is
# no separate "Not stated" line: refusals are folded into "Others" and thus counted in
# affiliation, disclosed per row.
#
# Universe: resident population as published per wave (each report's "resident
# population by religious affiliation" total). Same-body renamed lines are mapped to a
# stable display label only where the probe documents the identity (Ekalesia Niue ==
# Ekalesia; Roman Catholic == Catholic); each mapping is recorded in the manifest.
#
# Licence: the SPC-family partial-reproduction-with-acknowledgement clause is byte-
# matched in the 2006 (SPC) and 2011 (Statistics Niue) reports and quoted verbatim with
# each capture sha256. The 2017 report carries only the copyright line (the reuse
# sentence did not text-extract; soft flag). The 2022 report carries NO reuse clause
# (documented vacuum) - only a required citation. Ship national summaries with Statistics
# Niue / SPC attribution under the census-family clause and the standing build-then-ask
# ruling. The geoBoundaries NIU ADM0 boundary is CC BY 4.0.
#
# inputs (all cached, git-ignored under data/raw/nu_census/):
#   nu_2006_census_report.{txt,pdf}  Appendix Table 2 (1986-2006 national religion columns)
#   nu_2022_census_report.{txt,pdf}  Table 3.3 (2011/2017/2022 national religion columns)
#   nu_2011_census_report.{txt,pdf}  context/corroboration (counts sourced from 2022 Table 3.3)
#   nu_2017_census_report.{txt,pdf}  context/corroboration (counts sourced from 2022 Table 3.3)
#   nu_2001_census_report.{txt,pdf}  context (its religion-by-area appendix is absent from the PDF)
#   geoBoundaries-NIU-ADM0.geojson   geoBoundaries NIU ADM0 (1 native national polygon)
#   gb_niu_ADM0_meta.json            geoBoundaries NIU ADM0 release metadata
# outputs:
#   apps/regions/nu/data/nu_national.geojson
#   apps/regions/nu/data/area_summary_national.{json,csv}
#   docs/manifests/nu-census-religion-1986-2022.json
# run from the repository root: Rscript scripts/build_nu_area_summary.R

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "NU"
script_id <- "scripts/build_nu_area_summary.R"
raw_dir <- "data/raw/nu_census"
product_dir <- "apps/regions/nu/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-11"
stamp <- paste0(retrieval_date, "T00:00:00Z")
ruling <- paste(
  "Conductor ruling 2026-07-11: small-country clause (Iceland/Dominica/Nauru precedent).",
  "National-only eight-wave religion series on one ADM0 polygon is the shippable ceiling;",
  "Niue never publishes religion below the national total in any wave. Each wave's counts",
  "come from its contemporaneous report; the 2022 report's corrupted republished 1997/2001/",
  "2006 columns are a documented discrepancy record, never a source."
)

boundary_level <- "adm0"
boundary_vintage <- "2021"
boundary_set_id <- "nu-adm0-2021-geoboundaries"
boundary_dataset_id <- "geoboundaries-niu-adm0-9469f09"
census_id <- "nso-spc-census-religion-national-1986-2022"

local_cache_hint <- "All raw sources are cached under data/raw/nu_census/ and remain git-ignored."

# SPC-family partial-reproduction clauses, byte-matched from the report front matter.
licence_clause_2011 <- paste0(
  "Statistics Niue authorises the partial reproduction or translation of this material for ",
  "scientific, educational or research purposes, provided that Statistics Niue and the source ",
  "document are properly acknowledged."
)
licence_clause_2006 <- paste0(
  "SPC authorises the partial reproduction or translation of this material for scientific, ",
  "educational or research purposes, provided that SPC and the source document are properly ",
  "acknowledged."
)
copyright_2011 <- "© Copyright Statistics Niue, Government of Niue 2012"
copyright_2006 <- "© Copyright Secretariat of the Pacific Community 2008"
citation_2022 <- "2022 Niue Census of Population and Household Report, Niue Statistics Office, Alofi"
spc_attribution <- paste(
  "Source: Statistics Niue and the Pacific Community (SPC), Niue Census of Population and",
  "Housing (2006 report Appendix Table 2 for 1986-2006; 2022 report Table 3.3 for 2011/2017/2022)."
)
licence_name <- paste(
  "Niue census SPC-family partial-reproduction-with-acknowledgement clause: partial reproduction",
  "or translation authorised for scientific, educational or research purposes provided Statistics",
  "Niue / SPC and the source document are acknowledged (2011 and 2006 reports, byte-matched). The",
  "2022 report carries no reuse clause (documented vacuum); covered by the census-family clause and",
  "the build-then-ask ruling. geoBoundaries NIU ADM0 boundary is CC BY 4.0."
)
# terms identity (schema licence_basis slug); the shipping decision stays in licence_status.
licence_basis <- "niue_census_partial_reproduction_research_reuse_attribution_geoboundaries_cc_by_4_0"
licence_status_enum <- "accepted"
storage_provider_value <- "git_repository"

boundary_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/NIU/ADM0/"
boundary_url <- paste0(
  "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/",
  "releaseData/gbOpen/NIU/ADM0/geoBoundaries-NIU-ADM0.geojson"
)
report_2006_url <- "https://niuestatistics.nu/download/35/census/474/niu_2006_population_profile.pdf"
report_2022_url <- "https://niuestatistics.nu/download/35/census/2793/2022-niue-census-of-population-and-housing-report.pdf"
report_2011_url <- "https://niuestatistics.nu/download/35/census/2040/niue-2011-cenus-population-profile.pdf"
report_2017_url <- "https://niuestatistics.nu/download/35/census/1460/2019-niue-pophh-census-2-0.pdf"
report_2001_url <- "https://niuestatistics.nu/download/35/census/569/niue-population-and-household-census-2001-2.pdf"

report_2006_txt <- file.path(raw_dir, "nu_2006_census_report.txt")
report_2022_txt <- file.path(raw_dir, "nu_2022_census_report.txt")
report_2011_txt <- file.path(raw_dir, "nu_2011_census_report.txt")
report_2017_txt <- file.path(raw_dir, "nu_2017_census_report.txt")
report_2001_txt <- file.path(raw_dir, "nu_2001_census_report.txt")
report_2006_pdf <- file.path(raw_dir, "nu_2006_census_report.pdf")
report_2022_pdf <- file.path(raw_dir, "nu_2022_census_report.pdf")
report_2011_pdf <- file.path(raw_dir, "nu_2011_census_report.pdf")
report_2017_pdf <- file.path(raw_dir, "nu_2017_census_report.pdf")
report_2001_pdf <- file.path(raw_dir, "nu_2001_census_report.pdf")
boundary_meta_path <- file.path(raw_dir, "gb_niu_ADM0_meta.json")
boundary_path <- file.path(raw_dir, "geoBoundaries-NIU-ADM0.geojson")

boundary_out <- file.path(product_dir, "nu_national.geojson")
summary_json_out <- file.path(product_dir, "area_summary_national.json")
summary_csv_out <- file.path(product_dir, "area_summary_national.csv")
manifest_out <- file.path(manifest_dir, "nu-census-religion-1986-2022.json")

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

# ------------------------------------------------ pinned per-wave frames ---

# waves the product ships, in publication order.
waves <- c(1986L, 1991L, 1997L, 2001L, 2006L, 2011L, 2017L, 2022L)
wave_key <- as.character(waves)

# frame A: 2006 report Appendix Table 2 (1986-2006), nine-category frame with a
# separate "Not stated" line. Verbatim labels retained from the source table.
frameA_labels <- c("Ekalesia Niue", "Latter Day Saints", "Roman Catholic",
                   "Jehovah's Witness", "Seventh Day Adventist", "Others", "None", "Not stated")
frameA_roles <- c("affiliation", "affiliation", "affiliation", "affiliation",
                  "affiliation", "affiliation", "no_religion", "nonresponse")
# rows = frameA_labels, columns = 1986, 1991, 1997, 2001, 2006 (verbatim counts).
frameA_counts <- matrix(c(
  1749, 1588, 1330, 1093, 956,   # Ekalesia Niue
  307,  237,  206,  158,  127,   # Latter Day Saints
  170,  139,  133,  128,  138,   # Roman Catholic
  33,   47,   46,   43,   28,    # Jehovah's Witness
  77,   46,   51,   25,   6,     # Seventh Day Adventist
  135,  111,  76,   151,  139,   # Others
  48,   68,   77,   34,   43,    # None
  12,   3,    169,  104,  101    # Not stated (2006 includes 1 refusal, per the source note)
), nrow = 8, byrow = TRUE)
colnames(frameA_counts) <- c("1986", "1991", "1997", "2001", "2006")
rownames(frameA_counts) <- frameA_labels

# frame B: 2022 report Table 3.3 (2011/2017/2022), no separate "Not stated" line
# (refusals folded into "Others"). Verbatim labels retained from the source table;
# column order as printed is Ekalesia, Catholic, SDA, LDS, JW, Others, None.
frameB_labels <- c("Ekalesia", "Catholic", "Seventh Day Adventist", "Latter Day Saints",
                   "Jehovah's Witness", "Others", "None")
frameB_roles <- c("affiliation", "affiliation", "affiliation", "affiliation",
                  "affiliation", "affiliation", "no_religion")
# rows = frameB_labels, columns = 2011, 2017, 2022 (verbatim counts).
frameB_counts <- matrix(c(
  978, 981, 961,   # Ekalesia
  146, 134, 114,   # Catholic
  15,  23,  44,    # Seventh Day Adventist
  146, 139, 137,   # Latter Day Saints
  29,  43,  31,    # Jehovah's Witness
  117, 130, 165,   # Others
  29,  141, 112    # None
), nrow = 7, byrow = TRUE)
colnames(frameB_counts) <- c("2011", "2017", "2022")
rownames(frameB_counts) <- frameB_labels

# printed resident-population total by religious affiliation per wave.
printed_total <- c(`1986` = 2531L, `1991` = 2239L, `1997` = 2088L, `2001` = 1736L,
                   `2006` = 1538L, `2011` = 1460L, `2017` = 1591L, `2022` = 1564L)

# assemble one wave's frame (list of label/role/count) from the source matrix.
build_frame <- function(labels, roles, counts, year_col) {
  vals <- as.integer(counts[, year_col])
  lapply(seq_along(labels), function(i) {
    list(label = labels[[i]], role = roles[[i]], count = vals[[i]])
  })
}
wave_frame_list <- list(
  `1986` = build_frame(frameA_labels, frameA_roles, frameA_counts, "1986"),
  `1991` = build_frame(frameA_labels, frameA_roles, frameA_counts, "1991"),
  `1997` = build_frame(frameA_labels, frameA_roles, frameA_counts, "1997"),
  `2001` = build_frame(frameA_labels, frameA_roles, frameA_counts, "2001"),
  `2006` = build_frame(frameA_labels, frameA_roles, frameA_counts, "2006"),
  `2011` = build_frame(frameB_labels, frameB_roles, frameB_counts, "2011"),
  `2017` = build_frame(frameB_labels, frameB_roles, frameB_counts, "2017"),
  `2022` = build_frame(frameB_labels, frameB_roles, frameB_counts, "2022")
)
wave_frame_id <- c(`1986` = "A", `1991` = "A", `1997` = "A", `2001` = "A",
                   `2006` = "A", `2011` = "B", `2017` = "B", `2022` = "B")
wave_source <- c(
  `1986` = "2006 report, Appendix Table 2 (1986 column), nine-category frame with separate Not stated.",
  `1991` = "2006 report, Appendix Table 2 (1991 column), nine-category frame with separate Not stated.",
  `1997` = "2006 report, Appendix Table 2 (1997 column). The 2022 Table 3.3 republication of 1997 is corrupted and not used.",
  `2001` = "2006 report, Appendix Table 2 (2001 column). The 2022 Table 3.3 republication of 2001 is corrupted and not used.",
  `2006` = "2006 report, Appendix Table 2 (2006 column). The 2022 Table 3.3 republication of 2006 is corrupted and not used.",
  `2011` = "2022 report, Table 3.3 (2011 column); no separate Not stated line (refusals folded into Others).",
  `2017` = "2022 report, Table 3.3 (2017 column); no separate Not stated line (refusals folded into Others).",
  `2022` = "2022 report, Table 3.3 (2022 column); of 165 'Others', 53 were refusals folded in (source note)."
)

# same-body renamed-line mappings, documented in the probe (identity is the same church).
label_identity_mappings <- list(
  list(display_label = "Ekalesia Niue", frameA_label = "Ekalesia Niue", frameB_label = "Ekalesia",
       note = "London Missionary Society successor church; printed 'Ekalesia Niue' in the 2006 appendix and 'Ekalesia' in the 2022 Table 3.3."),
  list(display_label = "Roman Catholic", frameA_label = "Roman Catholic", frameB_label = "Catholic",
       note = "Same body; printed 'Roman Catholic' in the 2006 appendix and 'Catholic' in the 2022 Table 3.3.")
)

# the comparable broad affiliation spine across all eight waves (probe ruling); each
# entry lists the verbatim source labels that carry it in either frame.
spine_labels <- list(
  ekalesia_niue = c("Ekalesia Niue", "Ekalesia"),
  roman_catholic = c("Roman Catholic", "Catholic"),
  latter_day_saints = c("Latter Day Saints"),
  seventh_day_adventist = c("Seventh Day Adventist"),
  jehovahs_witness = c("Jehovah's Witness"),
  others = c("Others"),
  no_religion = c("None"),
  not_stated = c("Not stated")
)

# --------------------------------------- 2022 republication discrepancy record ---

# the 2022 report Table 3.3 as printed (six waves in one place). The recent three
# (2011/2017/2022) ARE the source of record; the historical three (1997/2001/2006) are
# corrupted republications recorded only as a discrepancy, never used.
repub_labels <- c("Ekalesia", "Catholic", "Seventh Day Adventist", "Latter Day Saints",
                  "Jehovah's Witness", "Others", "None")
repub_counts <- matrix(c(
  1336, 1094, 954,   # Ekalesia
  125,  122,  138,   # Catholic
  42,   17,   6,     # Seventh Day Adventist
  209,  156,  123,   # Latter Day Saints
  42,   35,   31,    # Jehovah's Witness
  84,   156,  138,   # Others
  251,  139,  154    # None
), nrow = 7, byrow = TRUE)
colnames(repub_counts) <- c("1997", "2001", "2006")
rownames(repub_counts) <- repub_labels
repub_printed_total <- c(`1997` = 2088L, `2001` = 1736L, `2006` = 1538L)

# ------------------------------------------- source corroboration assertions ---

require_file(report_2006_txt); require_file(report_2006_pdf)
require_file(report_2022_txt); require_file(report_2022_pdf)
require_file(report_2011_txt); require_file(report_2011_pdf)
require_file(report_2017_txt); require_file(report_2017_pdf)
require_file(report_2001_txt); require_file(report_2001_pdf)
require_file(boundary_meta_path); require_file(boundary_path)

text_2006 <- read_collapsed(report_2006_txt)
text_2022 <- read_collapsed(report_2022_txt)
text_2011 <- read_collapsed(report_2011_txt)

# 2006 Appendix Table 2: anchor each source-of-record historical row and the Total row.
assert_in_text("Appendix Table 2: Religion", text_2006, "2006 Appendix Table 2 heading")
assert_in_text("Total 2,531 2,239 2,088 1,736 1,538", text_2006, "2006 appendix Total row")
assert_in_text("Ekalesia Niue 1,749 1,588 1,330 1,093 956", text_2006, "2006 appendix Ekalesia Niue row")
assert_in_text("Latter Day Saints 307 237 206 158 127", text_2006, "2006 appendix Latter Day Saints row")
assert_in_text("Roman Catholic 170 139 133 128 138", text_2006, "2006 appendix Roman Catholic row")
assert_in_text("Seventh Day Adventist 77 46 51 25 6", text_2006, "2006 appendix Seventh Day Adventist row")
assert_in_text("Others 135 111 76 151 139", text_2006, "2006 appendix Others row")
assert_in_text("None 48 68 77 34 43", text_2006, "2006 appendix None row")
assert_in_text("Not stated 12 3 169 104", text_2006, "2006 appendix Not stated row")

# 2022 Table 3.3: anchor the source-of-record recent three rows and the discrepancy rows.
assert_in_text("Resident population by religious affiliation", text_2022, "2022 Table 3.3 heading")
assert_in_text("2011 978 146 15 146 29 117 29 1460", text_2022, "2022 Table 3.3 2011 row")
assert_in_text("2017 981 134 23 139 43 130 141 1591", text_2022, "2022 Table 3.3 2017 row")
assert_in_text("2022 961 114 44 137 31 165 112 1564", text_2022, "2022 Table 3.3 2022 row")
assert_in_text("1997 1336 125 42 209 42 84 251 2088", text_2022, "2022 Table 3.3 1997 republication row")
assert_in_text("2001 1094 122 17 156 35 156 139 1736", text_2022, "2022 Table 3.3 2001 republication row")
assert_in_text("2006 954 138 6 123 31 138 154 1538", text_2022, "2022 Table 3.3 2006 republication row")

# SPC-family partial-reproduction clauses, byte-matched in the 2006 and 2011 reports.
assert_in_text(
  "SPC authorises the partial reproduction or translation of this material for scientific",
  text_2006, "2006 SPC partial-reproduction clause"
)
assert_in_text(
  "Statistics Niue authorises the partial reproduction or translation of this material for scientific",
  text_2011, "2011 Statistics Niue partial-reproduction clause"
)
# 2022 vacuum: confirm the required-citation line is present and no reuse clause extracts.
assert_in_text("Niue Statistics Office, Alofi", text_2022, "2022 required-citation line")
text_2022_has_reuse_clause <- grepl("authorises the partial reproduction", text_2022, perl = TRUE)
if (text_2022_has_reuse_clause) {
  stop("2022 report unexpectedly carries a reuse clause; re-verify the licence vacuum", call. = FALSE)
}
licence_capture <- list(
  clause_2006 = list(quote = licence_clause_2006, copyright = copyright_2006,
                     source = report_2006_txt, capture_sha256 = sha256_file(report_2006_txt)),
  clause_2011 = list(quote = licence_clause_2011, copyright = copyright_2011,
                     source = report_2011_txt, capture_sha256 = sha256_file(report_2011_txt)),
  vacuum_2022 = list(required_citation = citation_2022, source = report_2022_txt,
                     capture_sha256 = sha256_file(report_2022_txt),
                     note = "2022 report carries no reuse clause (documented vacuum); only a required citation."),
  soft_flag_2017 = paste(
    "2017 report front matter carries only the copyright line ('© Statistics Niue, 2019'); the",
    "partial-reproduction sentence did not text-extract. Soft flag; the 2006/2011 census-family",
    "clause is operative. The 2017 counts are sourced from the 2022 Table 3.3, not the 2017 report."
  )
)

# --------------------------------------------------- reconciliation gates ---

# NA-tolerant integer sum of a per-wave frame filtered by a predicate.
sum_frame <- function(frame, predicate = function(e) TRUE) {
  sum(vapply(frame, function(e) if (predicate(e)) as.integer(e[["count"]]) else 0L, integer(1)))
}

# gate 1: every wave's category lines sum to its printed resident total exactly.
category_sums <- vapply(wave_key, function(k) sum_frame(wave_frame_list[[k]]), integer(1))
if (!identical(unname(category_sums), unname(printed_total))) {
  stop("category sums do not equal the printed resident totals: ",
       paste(category_sums, collapse = "/"), " vs ", paste(printed_total, collapse = "/"), call. = FALSE)
}

# gate 2: slot arithmetic. affiliation-role sum == total - no_religion - nonresponse.
none_counts <- vapply(wave_key, function(k) sum_frame(wave_frame_list[[k]], function(e) e[["role"]] == "no_religion"), integer(1))
notstated_counts <- vapply(wave_key, function(k) sum_frame(wave_frame_list[[k]], function(e) e[["role"]] == "nonresponse"), integer(1))
affiliation_role_sums <- vapply(wave_key, function(k) sum_frame(wave_frame_list[[k]], function(e) e[["role"]] == "affiliation"), integer(1))
affiliation_residual <- unname(printed_total) - none_counts - notstated_counts
if (!identical(unname(affiliation_residual), unname(affiliation_role_sums))) {
  stop("affiliation residual disagrees with the affiliation-role category sum", call. = FALSE)
}

# gate 3 (discrepancy record, NOT a source): the 2022 republication historical columns
# do NOT self-reconcile. Record the row-sum offsets; the build sources these waves from
# the 2006 appendix instead. This gate asserts the documented corruption, never tunes it.
repub_row_sums <- vapply(colnames(repub_counts), function(y) sum(as.integer(repub_counts[, y])), integer(1))
repub_offsets <- repub_row_sums - unname(repub_printed_total[colnames(repub_counts)])
expected_offsets <- c(`1997` = 1L, `2001` = -17L, `2006` = 6L)
if (!identical(setNames(repub_offsets, colnames(repub_counts)), expected_offsets)) {
  stop("the 2022 republication offsets drifted from the documented +1/-17/+6", call. = FALSE)
}
# the republication also diverges category-by-category from the 2006 appendix for the
# overlapping waves; record the differences for the discrepancy evidence.
appendix_overlap <- frameA_counts[, c("1997", "2001", "2006")]
# align the two frames on the common named categories for a like-for-like comparison.
spine_to_frameA <- c(Ekalesia = "Ekalesia Niue", Catholic = "Roman Catholic",
                     `Seventh Day Adventist` = "Seventh Day Adventist",
                     `Latter Day Saints` = "Latter Day Saints",
                     `Jehovah's Witness` = "Jehovah's Witness", Others = "Others")
repub_divergences <- lapply(colnames(repub_counts), function(y) {
  per_cat <- lapply(names(spine_to_frameA), function(b) {
    repub_val <- as.integer(repub_counts[b, y])
    appx_val <- as.integer(appendix_overlap[spine_to_frameA[[b]], y])
    list(category = b, republished_2022 = repub_val, appendix_2006 = appx_val, delta = repub_val - appx_val)
  })
  # None comparison: the 2022 single None line vs the appendix None + Not stated.
  repub_none <- as.integer(repub_counts["None", y])
  appx_none_plus_ns <- as.integer(appendix_overlap["None", y]) + as.integer(appendix_overlap["Not stated", y])
  list(
    year = as.integer(y),
    republished_row_sum = as.integer(repub_row_sums[[y]]),
    printed_total = as.integer(repub_printed_total[[y]]),
    row_sum_offset = as.integer(repub_offsets[[which(colnames(repub_counts) == y)]]),
    categories = per_cat,
    none_republished = repub_none,
    none_appendix_plus_not_stated = appx_none_plus_ns,
    none_delta = repub_none - appx_none_plus_ns
  )
})

# --------------------------------------------------- headline computation ---

# per-wave headline metrics on the printed resident denominator: affiliation is the
# summed named religious categories (the affiliation-role sum), no_religion is the None
# line, not_stated is the disclosed residual (frame A only; folded into Others in frame B).
wave_metrics <- lapply(seq_along(waves), function(i) {
  list(
    year = waves[[i]],
    population_total = unname(printed_total)[[i]],
    affiliation = affiliation_role_sums[[i]],
    no_religion = none_counts[[i]],
    not_stated = notstated_counts[[i]],
    frame = unname(wave_frame_id)[[i]]
  )
})
names(wave_metrics) <- wave_key

# the broad-affiliation spine values per wave (cross-wave comparable series).
spine_value <- function(frame, labels) {
  sum(vapply(frame, function(e) if (e[["label"]] %in% labels) as.integer(e[["count"]]) else 0L, integer(1)))
}
spine_series <- lapply(names(spine_labels), function(nm) {
  counts <- lapply(wave_key, function(k) spine_value(wave_frame_list[[k]], spine_labels[[nm]]))
  names(counts) <- wave_key
  list(spine_category = nm, source_labels = as.list(spine_labels[[nm]]), counts = counts)
})
names(spine_series) <- names(spine_labels)

# ------------------------------------------------------------- boundary ---

boundary_meta <- fromJSON(boundary_meta_path, simplifyVector = TRUE)
if (!identical(boundary_meta[["boundaryISO"]], "NIU") ||
    !identical(boundary_meta[["boundaryType"]], "ADM0") ||
    !identical(boundary_meta[["boundaryYearRepresented"]], boundary_vintage) ||
    !identical(boundary_meta[["admUnitCount"]], "1")) {
  stop("geoBoundaries NIU ADM0 release metadata drifted from the probed release", call. = FALSE)
}
boundary_licence_name <- boundary_meta[["boundaryLicense"]]
if (!identical(boundary_licence_name, "Creative Commons Attribution 4.0 International (CC BY 4.0)")) {
  stop("geoBoundaries NIU boundary licence changed from the verified CC BY 4.0", call. = FALSE)
}
boundary_source_id <- boundary_meta[["boundaryID"]]

# the cache carries a native ADM0 single national polygon; no dissolve is needed.
raw_boundary <- st_read(boundary_path, quiet = TRUE)
raw_boundary <- st_make_valid(st_transform(raw_boundary, 4326))
if (nrow(raw_boundary) != 1L || any(st_is_empty(raw_boundary)) ||
    any(is.na(st_is_valid(raw_boundary))) || any(!st_is_valid(raw_boundary))) {
  stop("raw Niue ADM0 boundary is missing, empty, invalid, or not 1 national polygon", call. = FALSE)
}
boundary <- st_sf(
  area_code = "niue", area_name = "Niue",
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
    !identical(written_boundary[["area_code"]], "niue")) {
  stop("simplified Niue ADM0 boundary failed the geometry gate", call. = FALSE)
}
land_area_sq_km <- as.numeric(st_area(st_transform(written_boundary, 4326))[[1]]) / 1e6
simplified_geometry_hash <- geometry_hash(written_boundary, 1L)

# -------------------------------------------------------- shipped rows ---

# per-row population basis: universe, source of record, and the Not stated handling.
population_basis <- function(m) {
  base <- sprintf(
    "Resident population by religious affiliation, %d = %d, from %s",
    m$year, m$population_total, unname(wave_source[[as.character(m$year)]])
  )
  ns <- if (m$frame == "A") {
    sprintf(" Not stated = %d stays in the denominator and in neither slot (disclosed).", m$not_stated)
  } else {
    " No separate Not stated line in the 2022 Table 3.3 frame; refusals are folded into 'Others' and thus counted in affiliation (disclosed)."
  }
  paste0(base, ns)
}

# per-row quality flag: shared tokens + frame-specific Not stated token + source token.
quality_flag_row <- function(m) {
  frame_token <- if (m$frame == "A") {
    "not_stated_separate_line_in_denominator_disclosed;source_2006_appendix_table2"
  } else {
    "not_stated_folded_into_others_disclosed;source_2022_table3_3"
  }
  paste(
    "census_affiliation", "national_only_adm0", "resident_population_universe",
    "two_slot_affiliation_none", "verbatim_source_categories_preserved",
    "documented_2022_republication_discrepancy_not_used_as_source",
    frame_token, licence_basis, "boundary_cc_by_4_0",
    sep = ";"
  )
}

build_row <- function(m) {
  list(
    country_code = country_code, boundary_set_id = boundary_set_id, boundary_level = boundary_level,
    area_unit_id = paste0(boundary_set_id, ":niue"), area_code = "niue", area_name = "Niue",
    year = as.integer(m$year),
    population_total = as.integer(m$population_total), population_total_basis = population_basis(m),
    religious_affiliation_count = as.integer(m$affiliation),
    religious_affiliation_percent = round(100 * m$affiliation / m$population_total, 4),
    no_religion_count = as.integer(m$no_religion),
    no_religion_percent = round(100 * m$no_religion / m$population_total, 4),
    place_count = NULL, places_per_10000_residents = NULL, place_density_per_sq_km = NULL,
    land_area_sq_km = round(land_area_sq_km, 4),
    site_snapshot_date = NULL, place_count_basis = NULL,
    source_dataset_ids = list(census_id, boundary_dataset_id),
    quality_flag = quality_flag_row(m)
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

# per-wave category reconciliation: verbatim label, role, count, and the sum-to-total.
frame_evidence <- function(k) {
  frame <- wave_frame_list[[k]]
  cats <- lapply(frame, function(e) list(label = e[["label"]], role = e[["role"]], count = as.integer(e[["count"]])))
  list(
    year = as.integer(k), frame = unname(wave_frame_id[[k]]),
    source = unname(wave_source[[k]]),
    source_categories_verbatim = as.list(vapply(frame, function(e) e[["label"]], character(1))),
    categories = cats,
    category_sum = as.integer(category_sums[[k]]),
    printed_total = as.integer(printed_total[[k]]),
    reconciles = category_sums[[k]] == printed_total[[k]]
  )
}
wave_frames <- lapply(wave_key, frame_evidence)

# ------------------------------------------------- area-summary product ---

licence_block <- list(name = licence_name, url = report_2022_url, attribution = spc_attribution)

source_datasets <- list(
  list(
    source_dataset_id = census_id,
    name = "Statistics Niue / SPC national census religion 1986-2022 (2006 report Appendix Table 2 for 1986-2006; 2022 report Table 3.3 for 2011/2017/2022)",
    provider = "Statistics Niue (Niue Statistics Office) and the Pacific Community (SPC)",
    url = report_2022_url, retrieval_date = retrieval_date, local_path = report_2022_txt,
    licence = licence_block,
    citation = paste(
      "Niue Statistics Office and Pacific Community, Niue Census of Population and Housing:",
      "2006 report Appendix Table 2 (Religion, 1986-2006) for the 1986/1991/1997/2001/2006 columns;",
      "2022 report Table 3.3 (Resident population by religious affiliation, 1997 to 2022) for the",
      "2011/2017/2022 columns. Required citation:", paste0(citation_2022, ".")
    ),
    access_limits = paste(
      "Public PDF reports on the niuestatistics.nu portal. No machine-readable religion tabulation",
      "was located. The 2011/2022 census microdata (Pacific Data Hub / SDD / ILO) are MOU-gated and",
      "are not used; they carry no public village religion table."
    ),
    redistribution_limits = paste(
      "Derived national summaries ship under the SPC-family partial-reproduction-with-acknowledgement",
      "clause with Statistics Niue / SPC attribution.", spc_attribution
    ),
    notes = paste(
      "National geography only in every wave; Niue never publishes religion below the national total.",
      "Source-of-record rule: the 2022 report's republished 1997/2001/2006 columns are corrupted (row",
      "sums off by +1/-17/+6 and diverging from the 2006 appendix) and are NEVER used as a source; the",
      "2006 Appendix Table 2 supplies 1986-2006, and the 2022 Table 3.3 supplies its own 2011/2017/2022.",
      "Frame seam: pre-2011 splits 'None' from 'Not stated'; 2011/2017/2022 fold refusals into 'Others'",
      "and print only 'None'. Same-body renamed lines are mapped to a stable display label (Ekalesia Niue",
      "== Ekalesia; Roman Catholic == Catholic). The 2017 reuse clause did not text-extract (soft flag)",
      "and the 2022 report carries no reuse clause (documented vacuum)."
    )
  ),
  list(
    source_dataset_id = boundary_dataset_id,
    name = "geoBoundaries gbOpen NIU ADM0 (1 native national polygon)",
    provider = "geoBoundaries; source Sentinel-2 10m Land Cover (ESA)", url = boundary_url,
    retrieval_date = retrieval_date, local_path = boundary_path,
    licence = list(name = boundary_licence_name, url = "https://creativecommons.org/licenses/by/4.0/",
                   attribution = "geoBoundaries; Sentinel-2 10m Land Cover (ESA)"),
    citation = paste0(
      "geoBoundaries gbOpen NIU ADM0, boundary ID ", boundary_source_id,
      ", release commit 9469f09; source Sentinel-2 10m Land Cover raster-to-polygon (2021)."
    ),
    access_limits = NULL,
    redistribution_limits = "The simplified national polygon is redistributed under CC BY 4.0 with geoBoundaries / Sentinel-2 attribution.",
    notes = paste(
      "Native ADM0 single polygon (admUnitCount 1); no dissolve is needed. The join property is",
      "area_code = 'niue'. Simplified with scripts/lib/simplify_boundary.R. Niue is a single raised-coral",
      "island with no outlying dependencies, so there is no dateline or small-island bbox trap."
    )
  )
)

denominator_note <- paste(
  "Percentages use each wave's printed resident-population total. Affiliation is the summed named",
  "religious categories (Ekalesia/Ekalesia Niue, Roman Catholic/Catholic, Latter Day Saints, Seventh",
  "Day Adventist, Jehovah's Witness, Others); no-religion is the 'None' line; 'Not stated' (a separate",
  "line in the 1986-2006 waves) stays in the denominator and in neither slot, so affiliation + None +",
  "Not stated equals the universe. In 2011/2017/2022 there is no separate Not stated line (refusals",
  "folded into Others), so affiliation + None equals the universe."
)
indicators <- list(
  list(indicator_id = "population_total", label = "Census resident population",
       description = "Printed national resident-population total by religious affiliation per wave (1986-2022).",
       unit = "count", denominator_indicator_id = NULL,
       method = "Printed resident Total per wave: 2006 Appendix Table 2 (1986-2006) and 2022 Table 3.3 (2011/2017/2022).",
       temporal_coverage = "1986, 1991, 1997, 2001, 2006, 2011, 2017, 2022",
       spatial_coverage = "Niue national total on one ADM0 polygon",
       quality_notes = "Resident-population universe in every wave (2,531 -> 1,564). Not the census-night figure."),
  list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
       description = "Share reporting any named religious category (the summed affiliation lines).",
       unit = "percent", denominator_indicator_id = "population_total",
       method = "100 * (summed named religious categories) / resident-population total per wave.",
       temporal_coverage = "1986, 1991, 1997, 2001, 2006, 2011, 2017, 2022", spatial_coverage = "Niue national",
       quality_notes = paste(denominator_note, "Comparable across waves on the broad-affiliation spine; the pre-2011 / 2011+ frame seam (Not stated split vs folded into Others) is disclosed per row.")),
  list(indicator_id = "no_religion_percent", label = "No religion %",
       description = "Share in the source 'None' category.", unit = "percent",
       denominator_indicator_id = "population_total",
       method = "100 * None / resident-population total per wave.",
       temporal_coverage = "1986, 1991, 1997, 2001, 2006, 2011, 2017, 2022", spatial_coverage = "Niue national",
       quality_notes = "'None' is a separate line in every wave, so no-religion is comparable across all eight waves.")
)

legend <- list(unit = "percent", denominator = "resident-population total per wave")
visual_layers <- list(
  list(visual_layer_id = "nu-adm0-religious-affiliation", label = "Religious affiliation %",
       description = "Niue national census-affiliation share for 1986 through 2022 (eight waves).",
       layer_type = "choropleth", indicator_ids = list("religious_affiliation_percent"),
       geometry_unit_type = "country", legend = legend, colour_scale = NULL,
       time_control = "year_selector", aggregation_rule = NULL, uncertainty_display = "quality_flag",
       default_visibility = TRUE,
       notes = paste(
         "A single national polygon is intentional under the small-country clause: Niue publishes census",
         "religion at national geography only. The broad-affiliation spine (Ekalesia Niue, Roman Catholic,",
         "Latter Day Saints, Seventh Day Adventist, Jehovah's Witness, Others, None) is comparable across",
         "all eight waves; the pre-2011 / 2011+ 'Not stated' frame seam is disclosed."
       )),
  list(visual_layer_id = "nu-adm0-no-religion", label = "No religion %",
       description = "Niue national census no-religion share for 1986 through 2022 (eight waves).",
       layer_type = "choropleth", indicator_ids = list("no_religion_percent"),
       geometry_unit_type = "country", legend = legend, colour_scale = NULL,
       time_control = "year_selector", aggregation_rule = NULL, uncertainty_display = "quality_flag",
       default_visibility = FALSE,
       notes = "'None' is a separate line in every wave; in 1986-2006 'Not stated' is separate and disclosed, and in 2011/2017/2022 refusals are folded into 'Others'.")
)

summary_product <- list(
  schema_version = "area-summary.v1", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code,
    level = boundary_level, vintage = boundary_vintage, source_dataset_id = boundary_dataset_id),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
    basis = "No governed place-of-worship snapshot ships in the Niue national census-religion product.",
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
    source_dataset_id = if (grepl("geoBoundaries|gb_niu", path)) boundary_dataset_id else census_id,
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
  raw_source_record(report_2006_txt, report_2006_url, "text", TRUE, "1986;1991;1997;2001;2006",
    "2006 report text layer; Appendix Table 2 supplies the 1986-2006 source-of-record columns."),
  raw_source_record(report_2006_pdf, report_2006_url, "pdf", TRUE, "1986;1991;1997;2001;2006",
    "2006 report source PDF; carries the byte-matched SPC partial-reproduction clause."),
  raw_source_record(report_2022_txt, report_2022_url, "text", TRUE, "2011;2017;2022",
    "2022 report text layer; Table 3.3 supplies the 2011/2017/2022 source-of-record columns and the corrupted 1997/2001/2006 republication (discrepancy record only)."),
  raw_source_record(report_2022_pdf, report_2022_url, "pdf", TRUE, "2011;2017;2022",
    "2022 report source PDF; carries no reuse clause (documented licence vacuum), only a required citation."),
  raw_source_record(report_2011_txt, report_2011_url, "text", FALSE, "2011",
    "2011 report text layer; carries the byte-matched Statistics Niue partial-reproduction clause. Counts sourced from the 2022 Table 3.3, not here."),
  raw_source_record(report_2011_pdf, report_2011_url, "pdf", FALSE, "2011",
    "2011 report source PDF; context and licence corroboration (2011 counts come from the 2022 Table 3.3)."),
  raw_source_record(report_2017_txt, report_2017_url, "text", FALSE, "2017",
    "2017 report text layer; reuse clause did not text-extract (soft flag). Counts sourced from the 2022 Table 3.3, not here."),
  raw_source_record(report_2017_pdf, report_2017_url, "pdf", FALSE, "2017",
    "2017 report source PDF; context (2017 counts come from the 2022 Table 3.3)."),
  raw_source_record(report_2001_txt, report_2001_url, "text", FALSE, "2001",
    "2001 report text layer; its religion-by-area appendix (Table 25) is absent from the published PDF. 2001 counts come from the 2006 Appendix Table 2."),
  raw_source_record(report_2001_pdf, report_2001_url, "pdf", FALSE, "2001",
    "2001 report source PDF; truncated (appendix absent). Context only."),
  raw_source_record(boundary_meta_path, boundary_meta_url, "json", TRUE, "2021",
    "geoBoundaries NIU ADM0 release metadata; 1 native national unit, CC BY 4.0."),
  raw_source_record(boundary_path, boundary_url, "geojson", TRUE, "2021",
    "geoBoundaries NIU ADM0 source geometry (1 native national polygon), simplified to the shipped boundary.")
)

deferred_sources <- list(
  list(source = "Religion by village / area (any wave)",
    status = "unavailable_no_public_table",
    reason = paste(
      "No Niue census wave publishes religion below the national total. The many 'by village' tables",
      "cover population, households, dwellings, water, waste, and internet, never religion. The 2001",
      "report's ToC lists a 'Religion, Gender and Area' appendix (Table 25), but the published PDF is",
      "truncated and that appendix is absent; even if recovered, 'Area' there is the two-area/large-",
      "village split, not a 14-village frame, and a single-wave fragment. The 14-village geoBoundaries",
      "NIU ADM1 layer is clean and build-ready but has no religion data to carry."),
    recovery_route = "An NSO village religion tabulation, or the MOU-gated 2011/2022 microdata, would unlock a village layer."),
  list(source = "2022 report Table 3.3 republished 1997/2001/2006 columns",
    status = "documented_discrepancy_not_used_as_source",
    reason = paste(
      "The 2022 Table 3.3 reprints 1997/2001/2006 but the columns are corrupted: row sums are off by",
      "+1 / -17 / +6 and diverge from the contemporaneous 2006 appendix (e.g. 2006 Ekalesia 954 vs 956,",
      "LDS 123 vs 127, JW 31 vs 28; the 2022 single None 154 vs the appendix None 43 + Not stated 101 =",
      "144). The build sources these waves from the reconciling 2006 Appendix Table 2 instead and carries",
      "the republication only as a discrepancy record (Saint Lucia / Cote d'Ivoire precedent). No cell is",
      "redistributed."),
    recovery_route = "None needed; the contemporaneous 2006 appendix is the correct source and reconciles exactly."),
  list(source = "Pre-1986 censuses",
    status = "unverified_upstream",
    reason = "The 2006 Appendix Table 2 series begins at 1986; earlier national religion tables are unverified.",
    recovery_route = "Verify whether pre-1986 Niue census reports print a national religion table before extending the series backward.")
)

boundary_validation <- list(
  source_feature_count = 1L, simplified_feature_count = nrow(written_boundary),
  all_valid = all(written_valid), all_non_empty = all(!st_is_empty(written_boundary)),
  source_geometry_sha256 = source_geometry_hash, simplified_geometry_sha256 = simplified_geometry_hash,
  simplified_bytes = file_bytes(boundary_out), byte_cap = 250000L,
  simplification = simplification,
  licence_metadata_status = "passed", licence = boundary_licence_name,
  licence_finding = paste(
    "geoBoundaries NIU ADM0 release metadata records CC BY 4.0 (boundaryYearRepresented 2021,",
    "admUnitCount 1, source Sentinel-2 10m Land Cover raster-to-polygon). One native national polygon;",
    "no dissolve needed."),
  boundary_derivation = paste(
    "The cache holds a native ADM0 single polygon; the shipped boundary is that polygon re-tagged with",
    "area_code = 'niue' and simplified. The outline area is", sprintf("%.2f", land_area_sq_km),
    "sq km, consistent with Niue's ~260 sq km land area."),
  release_source = "geoBoundaries / Sentinel-2 10m Land Cover (ESA)"
)

reconciliation_evidence <- list(
  gate_category_sum_equals_total = setNames(lapply(wave_key, function(k) {
    list(category_sum = as.integer(category_sums[[k]]), printed_total = as.integer(printed_total[[k]]),
         reconciles = category_sums[[k]] == printed_total[[k]])
  }), wave_key),
  gate_affiliation_slot_arithmetic = list(
    method = "affiliation-role sum == resident total - None - Not stated per wave",
    affiliation_role_sum = as.list(setNames(as.integer(affiliation_role_sums), wave_key)),
    affiliation_residual = as.list(setNames(as.integer(affiliation_residual), wave_key)),
    none = as.list(setNames(as.integer(none_counts), wave_key)),
    not_stated = as.list(setNames(as.integer(notstated_counts), wave_key)),
    reconciles = TRUE
  ),
  discrepancy_record_2022_republication = list(
    rule = paste(
      "The 2022 report Table 3.3 republished 1997/2001/2006 columns are corrupted and are NEVER used as",
      "a source; those waves are taken from the reconciling 2006 Appendix Table 2. Recorded here only as a",
      "documented discrepancy (Saint Lucia / Cote d'Ivoire precedent). No cell is redistributed."),
    row_sum_offsets = as.list(setNames(as.integer(repub_offsets), colnames(repub_counts))),
    per_wave = repub_divergences
  ),
  label_identity_mappings = label_identity_mappings,
  frame_seam = paste(
    "Pre-2011 waves (2006 Appendix Table 2) split 'None' from 'Not stated' (nine-category frame). The",
    "2011/2017/2022 waves (2022 Table 3.3) fold refusals into 'Others' and print only 'None' (seven-",
    "category frame). Each wave's native frame is preserved verbatim; no cell is redistributed across the seam."),
  broad_affiliation_spine = list(
    decision = paste(
      "The broad-affiliation spine (Ekalesia Niue/Ekalesia, Roman Catholic/Catholic, Latter Day Saints,",
      "Seventh Day Adventist, Jehovah's Witness, Others, None, and Not stated where present) is comparable",
      "across all eight waves. Same-body renamed lines map to a stable display label (Ekalesia Niue ==",
      "Ekalesia; Roman Catholic == Catholic)."),
    series = unname(spine_series)
  ),
  universe_note = paste(
    "Resident-population universe in every wave: 2,531 (1986), 2,239 (1991), 2,088 (1997), 1,736 (2001),",
    "1,538 (2006), 1,460 (2011), 1,591 (2017), 1,564 (2022). Not the census-night figure (2022 census",
    "night 1,681, of whom 1,564 were usual residents; Table 3.3 uses the resident total)."),
  licence_capture = licence_capture,
  wave_frames = wave_frames
)

dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)
manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json", schema_version = "data-manifest.v2",
  manifest_id = "manifest:nu-census-religion:nu:1986-2022:nso-national",
  dataset_id = "nu-census-religion:nu:1986-2022:nso-national",
  dataset_version_id = paste0("nu-census-religion:nu:1986-2022:nso-national:", dataset_hash),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "nu-census-religion", dataset_role = "public_product",
  scope = list(level = "country", country_codes = list("NU"), snapshot_date = NULL,
    snapshot_anchor = NULL, pipeline_stage = "public"),
  created_at = stamp, created_by = script_id,
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation",
      ruling = ruling,
      waves = as.list(waves),
      shipped_geography = "1 native national ADM0 polygon (geoBoundaries NIU ADM0)",
      denominator = "resident-population total per wave: 2531/2239/2088/1736/1538/1460/1591/1564",
      headline_fields = paste(
        "religious_affiliation = summed named religious categories; no_religion = None;",
        "Not stated is the disclosed residual (separate line 1986-2006; folded into Others 2011/2017/2022)"
      ),
      source_of_record_rule = paste(
        "1986-2006 from the 2006 Appendix Table 2; 2011/2017/2022 from the 2022 Table 3.3.",
        "The 2022 republished 1997/2001/2006 columns are corrupted and never used as a source."
      ),
      cross_wave_rule = "broad-affiliation spine comparable across all eight waves; pre-2011/2011+ Not stated frame seam disclosed",
      frames_preserved = "each wave's source category frame preserved verbatim (2006 appendix nine-line; 2022 Table 3.3 seven-line)",
      label_identity_mappings = label_identity_mappings,
      licence_clause_2011_verbatim = licence_clause_2011,
      licence_clause_2006_verbatim = licence_clause_2006,
      licence_copyright_2011 = copyright_2011,
      licence_copyright_2006 = copyright_2006,
      licence_capture = licence_capture,
      licence_vacuum_2022 = paste("2022 report carries no reuse clause; required citation:", citation_2022),
      licence_obligation = spc_attribution,
      licence_basis = licence_basis,
      boundary_join_property = "area_code",
      boundary_derivation = "native geoBoundaries NIU ADM0 single polygon re-tagged area_code='niue' and simplified",
      boundary_simplification = simplification,
      local_cache_hint = local_cache_hint,
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
    provider = "Statistics Niue (Niue Statistics Office); Pacific Community (SPC); geoBoundaries; Sentinel-2 10m Land Cover (ESA)",
    source_dataset_ids = list(census_id, boundary_dataset_id),
    source_urls = list(report_2006_url, report_2022_url, report_2011_url, report_2017_url, report_2001_url, boundary_meta_url, boundary_url),
    retrieved_at = stamp,
    licence = paste(
      "Statistics Niue / SPC authorise partial reproduction for scientific, educational or research",
      "purposes with Statistics Niue / SPC / source acknowledgement (byte-matched in the 2011 and 2006",
      "reports). The 2017 reuse clause did not text-extract (soft flag) and the 2022 report carries no",
      "reuse clause (documented vacuum); both are covered by the census-family clause and the build-then-",
      "ask ruling. geoBoundaries NIU ADM0 is CC BY 4.0."
    ),
    raw_redistribution = "Raw Statistics Niue / SPC reports and the boundary remain in the git-ignored cache; not redistributed in-repo.",
    local_cache_hint = local_cache_hint,
    licence_position = "accepted: SPC-family partial-reproduction-with-acknowledgement (census) and CC BY 4.0 (boundary)",
    citation = "Niue Census of Population and Housing: 2006 report Appendix Table 2 (1986-2006) and 2022 report Table 3.3 (2011/2017/2022); geoBoundaries NIU ADM0."
  ),
  input_manifests = list(),
  durable_files = list(
    durable_file_record(summary_json_out, "Niue national eight-wave census-religion area summary (1986-2022).", row_count = length(rows)),
    durable_file_record(summary_csv_out, "Flattened Niue national census-religion rows for 1986 through 2022.", row_count = length(rows)),
    durable_file_record(boundary_out, "geoBoundaries NIU ADM0 native national polygon (simplified).", feature_count = 1L)
  ),
  derived_outputs = lapply(list(summary_json_out, summary_csv_out, boundary_out), function(path) {
    list(uri = paste0("repo:", path), sha256 = sha256_file(path), built_by = script_id)
  }),
  raw_sources = raw_sources,
  target_years = as.list(waves),
  stats = list(
    wave_year_rows = length(rows), area_count = 1L, shipped_wave_count = length(waves),
    boundary_features = 1L, boundary_bytes = file_bytes(boundary_out),
    resident_total = as.list(as.integer(printed_total))
  ),
  validation = list(
    status = "passed",
    commands = list(
      "Rscript scripts/build_nu_area_summary.R",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/nu/data/area_summary_national.json",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/data-manifest.schema.json docs/manifests/nu-census-religion-1986-2022.json"
    ),
    notes = paste(
      "Every wave's category lines sum to its printed resident total exactly (2531/2239/2088/1736/1538/",
      "1460/1591/1564). The affiliation-role sum equals resident total - None - Not stated per wave. The",
      "2022 republished 1997/2001/2006 columns do NOT self-reconcile (+1/-17/+6) and diverge from the 2006",
      "appendix; they are recorded as a discrepancy and never used as a source. The single native ADM0",
      "polygon is non-empty and valid."
    ),
    warnings = list(
      "Frame seam: the 1986-2006 waves (2006 Appendix Table 2) split 'None' from 'Not stated'; the 2011/2017/2022 waves (2022 Table 3.3) fold refusals into 'Others' and print only 'None'. Each wave's native frame is preserved verbatim; the seam is disclosed per row and no cell is redistributed.",
      "Source-of-record rule: the 2022 report's republished 1997/2001/2006 columns are corrupted (row sums off by +1/-17/+6 and diverging from the 2006 appendix) and are NEVER used as a source; those waves come from the 2006 Appendix Table 2.",
      "The 2017 report's reuse clause did not text-extract (soft flag) and the 2022 report carries no reuse clause (documented vacuum). Both are covered by the byte-matched 2006/2011 census-family clause and the build-then-ask ruling; an NSO courtesy confirmation for the 2022 wave is the only tidy-up.",
      "National geography only: Niue never publishes religion below the national total in any wave. The 14-village geoBoundaries NIU ADM1 layer is clean and build-ready but has no religion data to carry."
    ),
    reconciliation_evidence = reconciliation_evidence,
    boundary_validation = boundary_validation
  ),
  construct_notes = list(
    "The construct is census religious affiliation (reported denomination), not practice, attendance, or registered membership.",
    "Source category spellings are retained verbatim per wave (2006 appendix nine-line frame; 2022 Table 3.3 seven-line frame).",
    "population_total is each wave's printed resident-population total. Affiliation is the summed named religious categories; no_religion is 'None'; 'Not stated' is the disclosed residual where a separate line exists (1986-2006).",
    "Same-body renamed lines map to a stable display label only where the probe documents the identity: Ekalesia Niue == Ekalesia; Roman Catholic == Catholic.",
    "Source-of-record rule (non-negotiable): 1986-2006 from the 2006 Appendix Table 2; 2011/2017/2022 from the 2022 Table 3.3. The 2022 report's republished 1997/2001/2006 columns are corrupted and are never a source.",
    "Frame seam: the 2011/2017/2022 Table 3.3 folds refusals into 'Others' (no separate Not stated line), so 'Others' carries a non-response component disclosed per row; the pre-2011 waves keep 'None' and 'Not stated' separate.",
    "A single national polygon is intentional under the small-country clause (Iceland/Dominica/Nauru precedent): Niue publishes census religion at national geography only.",
    "The shipped ADM0 polygon is the native geoBoundaries NIU ADM0 single polygon; no dissolve or district concordance is needed.",
    "No Niue place-of-worship count or density metric ships in this release."
  ),
  deferred_sources = deferred_sources,
  privacy = "public", licence_status = licence_status_enum, licence_basis = licence_basis,
  downstream_status = "public",
  source_datasets = source_datasets,
  notes = paste(
    "Niue national eight-wave census-religion product under the small-country clause. Census summaries ship",
    "under the SPC-family partial-reproduction-with-acknowledgement clause with Statistics Niue / SPC",
    "attribution; the boundary is CC BY 4.0. The 2022 report's corrupted republished history is a documented",
    "discrepancy, never a source. The map UI (index.html, hub) is outside this build."
  )
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(readChar(manifest_out, file_bytes(manifest_out), useBytes = TRUE))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

# ------------------------------------------------------- console summary ---
cat("Niue national census-religion product: 8 waves (1986-2022) on 1 native ADM0 polygon\n")
for (i in seq_along(waves)) {
  m <- wave_metrics[[i]]
  cat(sprintf("  %d (frame %s): resident %d, affiliation %d (%.1f%%), None %d (%.1f%%), Not stated %s\n",
    m$year, m$frame, m$population_total, m$affiliation, 100 * m$affiliation / m$population_total,
    m$no_religion, 100 * m$no_religion / m$population_total,
    if (m$frame == "A") as.character(m$not_stated) else "folded-in-Others"))
}
cat(sprintf("category-sum gate: passed (%s = %s)\n",
  paste(category_sums, collapse = "/"), paste(printed_total, collapse = "/")))
cat("affiliation-slot gate: passed per wave\n")
cat(sprintf("2022 republication discrepancy record: offsets 1997 +%d / 2001 %d / 2006 +%d (never used as source)\n",
  repub_offsets[["1997"]], repub_offsets[["2001"]], repub_offsets[["2006"]]))
cat(sprintf("boundary gate: passed; 1 valid native ADM0 feature, %d bytes at %g%% keep; CC BY 4.0\n",
  file_bytes(boundary_out), simplification[["keep_percent"]]))
cat("licence gate: passed; 2006/2011 SPC-family clause byte-matched; 2022 vacuum documented\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", boundary_out))
cat(sprintf("wrote %s\n", manifest_out))
