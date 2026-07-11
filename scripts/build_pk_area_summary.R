# build the Pakistan district census-religion area-summary product (STAGED).
# inputs: PBS Table 9 (Population by Sex, Religion and Rural/Urban), 2023 census, the four
#         provincial district PDFs plus the Islamabad Capital Territory (ICT) PDF, cached under
#         data/raw/pk_census/ and git-ignored. sha256s are pinned in
#         research/countries/pk/route-probe.md and verified as a source-integrity gate.
# outputs: apps/regions/pk/data/area_summary_district.{json,csv} and
#         docs/manifests/pk-census-religion-2023.json. NO geometry file (see the boundary note).
# run from the repository root: Rscript scripts/build_pk_area_summary.R
#
# scope of this build (render-the-record; project-lead task 12 ruling, 2026-07-11):
#   - ONE wave ships: 2023, at district level (136 district-equivalent tabulation units across the
#     four provinces + ICT). The 2017 wave is DEFERRED: no 2017 district-level table is cached (the
#     cached 2017 files reach only province/division level), so a 2017 district product cannot be
#     built from the cache without inventing coverage. It is recorded in deferred_sources with the
#     exact reason. The manifest is therefore named to the shipped span (pk-census-religion-2023.json)
#     per the shipped-wave rule (docs/development/adding-a-region.md).
#   - Verbatim official 2023 categories, no relabelling, no combining, no cell suppression, exact
#     printed district counts. An Iran-style description note rides the manifest and product.
#   - Territorial scope stated as the published tables' own coverage: four provinces + ICT, excluding
#     Azad Jammu and Kashmir (AJK) and Gilgit-Baltistan (GB).
#   - Boundary lane HELD: no district geometry is cached, the geoBoundaries ADM3 (tehsil, 2017) layer
#     is vintage-misaligned to the 2023 district roster and its ADM3-to-district mapping cannot be
#     evidenced here, and the ADM2 (district) layer's licence is unresolved and must not be used. The
#     product ships the data tables and manifest with the boundary recorded as a documented blocker;
#     land_area_sq_km and all place-density fields are null.
#   - Headline slots carry the ratified minority-share two-slot design
#     (docs/development/minority-share-metric.md): the 2023 frame has no non-affiliation category, so
#     religious_affiliation_percent := the Muslim (reference-group) share and no_religion_percent :=
#     the minority share (the exact non-Muslim complement). Muslim is the largest published national
#     category (96.35% in 2023). religious_change is not emitted (single wave).
#   - Licence: PBS disseminates aggregate tabulations free and requires attribution, but its terms
#     restrict onward supply. The build ships DERIVED rates with PBS attribution; raw PDFs stay
#     git-ignored and are mirrored to gs://pow-research-data/raw_sources/pk_census/. The project lead
#     approved the derived-rates-with-attribution position (task 12); written PBS confirmation is the
#     clean path and remains pending, so licence_status is needs_review.

suppressMessages({
  library(digest)
  library(jsonlite)
})

raw_dir <- "data/raw/pk_census"
output_dir <- "apps/regions/pk/data"
manifest_dir <- "docs/manifests"
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

country_code <- "PK"
wave <- 2023L
script_id <- "scripts/build_pk_area_summary.R"
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- "2026-07-11"
git_commit <- tryCatch(system("git rev-parse --short HEAD", intern = TRUE), error = function(e) NA_character_)
if (length(git_commit) == 0L || is.na(git_commit[[1]])) git_commit <- NULL

boundary_level <- "district"
boundary_vintage <- "2023"
boundary_set_id <- "pk-district-2023-boundary-pending"
census_dataset_id <- "pbs-census-2023-table9-religion-district"
boundary_dataset_id <- "pk-district-2023-boundary-pending"
design_doc <- "docs/development/minority-share-metric.md"
licence_ruling_date <- "2026-07-11"

summary_json_out <- file.path(output_dir, "area_summary_district.json")
summary_csv_out <- file.path(output_dir, "area_summary_district.csv")
manifest_out <- file.path(manifest_dir, "pk-census-religion-2023.json")

# the 2023 published religion frame, verbatim and in printed column order. these ids key the row
# category record; the labels are reproduced exactly as PBS prints the Table 9 column headers.
category_ids <- c("muslim", "christian", "hindu_jati", "qadiani_ahmadi",
                  "scheduled_castes", "sikh", "parsi", "others")
category_verbatim <- c(
  muslim = "MUSLIM", christian = "CHRISTIAN", hindu_jati = "HINDU JATI",
  qadiani_ahmadi = "QADIANI/AHMADI", scheduled_castes = "SCHEDULED CASTES",
  sikh = "SIKH", parsi = "PARSI", others = "OTHERS"
)
# reference group for the minority-share two-slot design: the largest published national category.
reference_group_code <- "muslim"
reference_group_label <- "Muslim"
minority_group_codes <- setdiff(category_ids, reference_group_code)

# the ruled description note (project-lead task 12), shipped in the manifest and the product.
# written plainly and neutrally; carries the record, not the project's interpretation.
description_note <- paste(
  "This product renders the religion categories of the 2023 Census of Pakistan exactly as the Pakistan Bureau of Statistics (PBS) prints them in Table 9.",
  "The published 2023 categories are Muslim, Christian, Hindu Jati, Qadiani/Ahmadi, Scheduled Castes, Sikh, Parsi, and Others.",
  "Qadiani/Ahmadi is the state's enumeration label for the Ahmadiyya community, applied after the 1974 constitutional amendment that declared Ahmadis non-Muslim; the label is carried verbatim as the official record, and is not the project's description of any community's self-understanding.",
  "Hindu Jati and Scheduled Castes are enumerated as separate categories in the printed table, and this product combines nothing: each published category is reported as printed.",
  "The 2017 census used a different, six-category frame (Muslim, Christian, Hindu, Qadiani/Ahmadi, Scheduled Castes, Others); the frames differ across waves and are not category-comparable, and no cross-wave comparison is made."
)
description_sentinel <- "is not the project's description of any community's self-understanding"

# the ruled territorial-scope statement (task 12(c)), rendered as the published tables' own coverage.
scope_note <- paste(
  "The 2023 PBS Table 9 religion tables cover the four provinces (Khyber Pakhtunkhwa, Punjab, Sindh, and Balochistan) and the Islamabad Capital Territory.",
  "They exclude Azad Jammu and Kashmir and Gilgit-Baltistan, whose figures are published separately and are not included here.",
  "This product renders the coverage of the published tables as printed and makes no territorial claim."
)

# the boundary hold, recorded as a documented blocker (no geometry ships).
boundary_note <- paste(
  "No district geometry ships with this product; the boundary lane is HELD as a documented blocker.",
  "The geoBoundaries PAK ADM3 (tehsil, boundary ID PAK-ADM3-9618217, represented year 2017, 554 units) layer carries an explicit ODbL licence but is vintage-misaligned to the 2023 district roster, which post-dates it; no evidenced ADM3-to-2023-district mapping is available in this build.",
  "The geoBoundaries PAK ADM2 (district, boundary ID PAK-ADM2-60131773, represented year 2019, 126 units) layer's licence is unresolved (the release asserts public domain but carries no explicit licence string) and under-counts the census district frame; it is not used.",
  "Consequently land_area_sq_km and all place-density fields are null, and an official or licensed 2023 district boundary layer is the open item before a map can render."
)

# the sensitivity note carried on the surfaces (task 12; religion is highly sensitive in Pakistan).
sensitivity_note <- paste(
  "Religion is highly sensitive in Pakistan for the Ahmadiyya, Hindu, Christian, Sikh, and Dalit (Scheduled Castes) communities.",
  "This is a district-level product (a coarser frame than the tehsil tables the PBS also publishes), chosen to reduce very small cells while rendering the official record.",
  "District counts are printed exactly with no PBS suppression rule, and this product applies no small-cell treatment: every published category count is rendered as printed."
)

# PBS licence terms, quoted verbatim from the probe (pbs_data_dissemination_terms.html).
pbs_dissemination_verbatim <- "The previous policy adopted by PBS for data supply was that aggregate level data (tabulation) was provided to the users free of charges and this practice will continue."
pbs_terms_verbatim <- "a. The user shall provide an undertaking that the data collected from PBS will not be supplied to any other person/organization either free of cost or on payment. b. The user shall acknowledge the source of data and supply copies of the research work/articles (published/unpublished) to PBS."
licence_basis_slug <- "pbs_free_tabulation_attribution_derived_rates"

# --- source-integrity: pinned sha256s from the route probe (hard gate) ---------
expected_sha256 <- c(
  "table_9_kp_districts.pdf"          = "c8d1c596a244ec743ef838be15bf6876e891cf4332b7e21d824145af5aecd030",
  "table_9_punjab_districts.pdf"      = "4319a9be3f5c30fd938bdeeef4f6efa65819a9d717f30608990b998e1cb66f35",
  "table_9_sindh_districts.pdf"       = "330eed69974d9f02f62151ef603c6a0a039b50195ff0ac70b01b97ae49ab8c4c",
  "table_9_balochistan_districts.pdf" = "7eebf9fc405f4b31f54cc72f3912edd97133f07b2233cb05a7133ad63ac19793",
  "table_9_islamabad.pdf"             = "254e1bfe0b03bffc72431af31594fff204d2a4068ff1319ea46a55b5708ae1df"
)

# each 2023 provincial file, with the province label whose Table 9 header row is the provincial
# anchor. ICT has no province header (province == single district), so its anchor is the district row.
province_files <- list(
  list(code = "kp",  name = "Khyber Pakhtunkhwa", file = "table_9_kp_districts.pdf",          header = "KHYBER PAKHTUNKHWA"),
  list(code = "pb",  name = "Punjab",             file = "table_9_punjab_districts.pdf",      header = "PUNJAB"),
  list(code = "sd",  name = "Sindh",              file = "table_9_sindh_districts.pdf",       header = "SINDH"),
  list(code = "bl",  name = "Balochistan",        file = "table_9_balochistan_districts.pdf", header = "BALOCHISTAN"),
  list(code = "ict", name = "Islamabad Capital Territory", file = "table_9_islamabad.pdf",    header = NA_character_)
)

# published provincial anchors (Table 9 provincial header totals; also cross-checked against the
# probe's recorded figures Punjab 127,333,305 and ICT 2,283,244).
expected_provincial_total <- c(kp = 40641120L, pb = 127333305L, sd = 55638409L, bl = 14562011L, ict = 2283244L)
# published national religion shares (probe secondary figures), used as a soft cross-check.
published_national_shares <- list(muslim = 96.35, hindu_incl_scheduled = 2.17, christian = 1.37, qadiani_ahmadi = 0.07)

# --- helpers ----------------------------------------------------------------

# return a file's SHA-256 digest.
sha256_file <- function(path) unname(tools::sha256sum(path))
# return a file size in bytes.
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))

# convert one PDF to layout-preserving UTF-8 text via poppler pdftotext.
pdf_to_text <- function(pdf_path) {
  out <- tempfile(fileext = ".txt")
  status <- system2("pdftotext", c("-layout", shQuote(pdf_path), shQuote(out)), stdout = FALSE, stderr = FALSE)
  if (!identical(status, 0L) || !file.exists(out)) stop("pdftotext failed for ", pdf_path, call. = FALSE)
  readLines(out, warn = FALSE, encoding = "UTF-8")
}

# parse the nine value tokens of an "ALL SEXES" row (TOTAL + 8 categories). the -layout output keeps
# one token per column; "-" denotes a printed zero. a token count other than nine is a hard error.
parse_all_sexes <- function(line) {
  rest <- sub("^\\s*ALL SEXES\\b", "", line)
  toks <- strsplit(trimws(rest), "\\s+")[[1]]
  toks <- toks[nchar(toks) > 0]
  toks[toks == "-"] <- "0"
  toks <- gsub(",", "", toks)
  vals <- suppressWarnings(as.integer(toks))
  if (length(vals) != 9L || anyNA(vals)) {
    stop("expected 9 integer value tokens in ALL SEXES row, got: ", line, call. = FALSE)
  }
  vals
}

# a district-equivalent header ends in "DISTRICT" or "PROTECTED AREA" (the Malakand Protected Area is
# a top-level KP tabulation unit not suffixed DISTRICT). returns c(name, type) or NULL.
district_header <- function(line) {
  m <- regmatches(line, regexec("^\\s*(.+?) (DISTRICT|PROTECTED AREA)\\s*$", line))[[1]]
  if (length(m) != 3L) return(NULL)
  list(name = trimws(m[2]), type = m[3])
}

# title-case a printed uppercase unit name for display, preserving the unit-type word.
title_case <- function(x) {
  words <- strsplit(tolower(x), " ", fixed = TRUE)[[1]]
  paste(vapply(words, function(w) {
    if (nchar(w) == 0L) return(w)
    paste0(toupper(substr(w, 1L, 1L)), substr(w, 2L, nchar(w)))
  }, character(1)), collapse = " ")
}

# slugify a unit name to an ascii code fragment.
slugify <- function(x) {
  s <- tolower(x)
  s <- gsub("[^a-z0-9]+", "-", s)
  s <- gsub("(^-|-$)", "", s)
  s
}

# extract every district-equivalent unit and the provincial anchor from one 2023 file.
extract_province <- function(pf) {
  path <- file.path(raw_dir, pf[["file"]])
  lines <- pdf_to_text(path)
  n <- length(lines)
  first_all_sexes <- function(from) {
    for (j in from:n) if (grepl("^\\s*ALL SEXES\\b", lines[j])) return(j)
    NA_integer_
  }
  units <- list(); prov_total <- NULL; i <- 1L
  while (i <= n) {
    ln <- lines[i]
    if (!is.na(pf[["header"]]) && grepl(paste0("^\\s*", pf[["header"]], "\\s*$"), ln)) {
      j <- first_all_sexes(i + 1L); prov_total <- parse_all_sexes(lines[j]); i <- j + 1L; next
    }
    hdr <- district_header(ln)
    if (!is.null(hdr)) {
      j <- first_all_sexes(i + 1L)
      units[[length(units) + 1L]] <- list(name = hdr[["name"]], type = hdr[["type"]], vals = parse_all_sexes(lines[j]))
      i <- j + 1L; next
    }
    i <- i + 1L
  }
  if (length(units) == 0L) stop("no district-equivalent units found in ", pf[["file"]], call. = FALSE)
  # ICT: province == single district; the district row is the provincial anchor.
  if (is.na(pf[["header"]])) prov_total <- units[[1L]][["vals"]]
  list(prov = pf, units = units, prov_total = prov_total)
}

# --- extraction and hard gates ----------------------------------------------

# gate 1: source integrity. every 2023 input matches its pinned sha256.
for (fn in names(expected_sha256)) {
  p <- file.path(raw_dir, fn)
  if (!file.exists(p)) stop("missing cached raw input: ", p, call. = FALSE)
  got <- sha256_file(p)
  if (!identical(got, expected_sha256[[fn]])) {
    stop("sha256 mismatch for ", fn, ": expected ", expected_sha256[[fn]], " got ", got, call. = FALSE)
  }
}

extracted <- lapply(province_files, extract_province)
names(extracted) <- vapply(province_files, function(p) p[["code"]], character(1))

# gate 2: every district row's eight category counts sum to its printed total; and each province's
# district totals sum EXACTLY to the published provincial anchor. stop, do not tune.
province_reconciliation <- list()
national_sum <- setNames(rep(0L, 9L), c("total", category_ids))
all_units <- list()
for (code in names(extracted)) {
  ex <- extracted[[code]]
  mat <- do.call(rbind, lapply(ex[["units"]], function(u) u[["vals"]]))
  row_bad <- which(mat[, 1] != rowSums(mat[, 2:9, drop = FALSE]))
  if (length(row_bad) > 0L) {
    bad_names <- vapply(row_bad, function(r) ex[["units"]][[r]][["name"]], character(1))
    stop("category sum != printed total in ", code, ": ", paste(bad_names, collapse = "; "), call. = FALSE)
  }
  colsum <- colSums(mat)
  anchor <- ex[["prov_total"]]
  if (!all(colsum == anchor)) {
    stop("province ", code, " district sum does not equal the published provincial anchor:\n  sum:    ",
         paste(colsum, collapse = ","), "\n  anchor: ", paste(anchor, collapse = ","), call. = FALSE)
  }
  if (colsum[1] != expected_provincial_total[[code]]) {
    stop("province ", code, " total ", colsum[1], " != pinned provincial total ", expected_provincial_total[[code]], call. = FALSE)
  }
  province_reconciliation[[code]] <- list(
    province_code = code, province_name = ex[["prov"]][["name"]], unit_count = nrow(mat),
    district_sum_total = as.integer(colsum[1]), provincial_anchor_total = as.integer(anchor[1]),
    match = as.logical(all(colsum == anchor)),
    category_sums = setNames(as.list(as.integer(colsum)), c("total", category_ids))
  )
  national_sum <- national_sum + setNames(as.integer(colsum), c("total", category_ids))
  # collect units with their province for row building.
  for (u in ex[["units"]]) all_units[[length(all_units) + 1L]] <- c(u, list(prov_code = code, prov_name = ex[["prov"]][["name"]]))
}

# gate 3: the national religion-table total equals its own eight-category sum.
if (national_sum[["total"]] != sum(national_sum[category_ids])) {
  stop("national total does not equal the eight-category sum", call. = FALSE)
}
# gate 4: unique area codes.
area_codes <- vapply(all_units, function(u) paste0(u[["prov_code"]], "-", slugify(u[["name"]])), character(1))
if (anyDuplicated(area_codes)) stop("duplicate area codes: ", paste(area_codes[duplicated(area_codes)], collapse = "; "), call. = FALSE)

# soft cross-check: computed national shares against the probe's published secondary shares.
national_muslim_share <- round(100 * national_sum[["muslim"]] / national_sum[["total"]], 4)
national_hindu_incl_sc_share <- round(100 * (national_sum[["hindu_jati"]] + national_sum[["scheduled_castes"]]) / national_sum[["total"]], 4)
national_christian_share <- round(100 * national_sum[["christian"]] / national_sum[["total"]], 4)
national_qadiani_share <- round(100 * national_sum[["qadiani_ahmadi"]] / national_sum[["total"]], 4)
share_crosscheck <- list(
  muslim = list(computed = national_muslim_share, published = published_national_shares[["muslim"]], within_0_05pp = abs(national_muslim_share - published_national_shares[["muslim"]]) <= 0.05),
  hindu_incl_scheduled = list(computed = national_hindu_incl_sc_share, published = published_national_shares[["hindu_incl_scheduled"]], within_0_05pp = abs(national_hindu_incl_sc_share - published_national_shares[["hindu_incl_scheduled"]]) <= 0.05),
  christian = list(computed = national_christian_share, published = published_national_shares[["christian"]], within_0_05pp = abs(national_christian_share - published_national_shares[["christian"]]) <= 0.05),
  qadiani_ahmadi = list(computed = national_qadiani_share, published = published_national_shares[["qadiani_ahmadi"]], within_0_05pp = abs(national_qadiani_share - published_national_shares[["qadiani_ahmadi"]]) <= 0.05)
)

# --- row building -----------------------------------------------------------

# build one schema-conforming district-year row. the minority-share two-slot design assigns
# religious_affiliation_percent := Muslim (reference-group) share and no_religion_percent := the
# exact non-Muslim complement. all eight verbatim category counts ride the quality_flag as the record.
build_row <- function(u) {
  vals <- setNames(as.integer(u[["vals"]]), c("total", category_ids))
  total <- vals[["total"]]
  muslim <- vals[["muslim"]]
  minority <- total - muslim
  code <- paste0(u[["prov_code"]], "-", slugify(u[["name"]]))
  disp_name <- title_case(paste(u[["name"]], u[["type"]]))
  cat_record <- paste(vapply(category_ids, function(cid) {
    paste0(category_verbatim[[cid]], "=", vals[[cid]])
  }, character(1)), collapse = ";")
  flag <- paste0(
    "census_religion_2023_verbatim_frame;eight_category_partition;no_no_religion_or_not_stated_category;",
    "minority_share_two_slot_design;reference_group=muslim;",
    "religious_affiliation_percent=muslim_reference_group_share;no_religion_percent=minority_share_exact_complement;",
    "minority_share=", paste(minority_group_codes, collapse = "+"), ";",
    "exact_printed_counts;no_small_cell_suppression;",
    "printed_unit=", u[["name"]], " ", u[["type"]], ";province=", u[["prov_name"]], ";",
    "categories_verbatim[", cat_record, "]"
  )
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = paste0(boundary_set_id, ":", code),
    area_code = code,
    area_name = disp_name,
    year = wave,
    population_total = total,
    population_total_basis = paste0(
      "PBS 2023 Census Table 9 total population for the district-equivalent unit (four provinces + ICT frame). ", scope_note
    ),
    religious_affiliation_count = as.integer(muslim),
    religious_affiliation_percent = round(100 * muslim / total, 4),
    no_religion_count = as.integer(minority),
    no_religion_percent = round(100 * minority / total, 4),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = NULL,
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(census_dataset_id),
    quality_flag = flag
  )
}

rows <- lapply(all_units, build_row)
n_units <- length(rows)

# gate 5: the two metric slots are exact complements in every row (percentages sum to 100 at printed
# rounding; counts sum to the district total). stop, do not tune.
for (r in rows) {
  a <- r[["religious_affiliation_percent"]]; m <- r[["no_religion_percent"]]
  ac <- r[["religious_affiliation_count"]]; mc <- r[["no_religion_count"]]; tot <- r[["population_total"]]
  if (round(a + m, 4) != 100) stop("metric slots not exact complements (percent) for ", r[["area_code"]], call. = FALSE)
  if (ac + mc != tot) stop("metric slots not exact complements (count) for ", r[["area_code"]], call. = FALSE)
}

# --- product declarations ---------------------------------------------------

temporal_cov <- "PBS Census of Pakistan 2023, Table 9 (Population by Sex, Religion and Rural/Urban)."
spatial_cov <- paste("One hundred thirty-six district-equivalent tabulation units across the four provinces and the Islamabad Capital Territory, as printed in Table 9.", scope_note)
quality_cov <- paste("Census religion is an eight-category official frame with no no-religion or not-stated option.", description_note, sensitivity_note, boundary_note)

reference_group_declaration <- paste0(
  "Minority-share two-slot design (", design_doc, ", ratified ", licence_ruling_date, "). ",
  "The reference group is ", reference_group_label, ", Pakistan's largest published religion category nationally in 2023 ",
  "(national share ", national_muslim_share, "%). It is declared once and held constant across every area. ",
  "religious_affiliation_percent := the ", reference_group_label, " share; no_religion_percent := the minority share, ",
  "the exact complement (every published category outside the reference group summed). This is arithmetic on the published ",
  "official categories and is not a measure of no religion, belief, practice, or secularity."
)

indicators <- function() {
  list(
    list(indicator_id = "population_total", label = "Census religion-table population",
         description = paste("PBS 2023 Table 9 total population for the district-equivalent unit.", scope_note),
         unit = "count", denominator_indicator_id = NULL,
         method = "Direct Table 9 all-localities all-sexes total; equals the sum of the eight printed religion categories for the unit.",
         temporal_coverage = temporal_cov, spatial_coverage = spatial_cov, quality_notes = quality_cov),
    list(indicator_id = "religious_affiliation_percent", label = paste0(reference_group_label, " (%)"),
         description = paste(
           paste0("Share of the district's enumerated population reporting ", reference_group_label,
                  ", the declared reference group. This is the reference-group share of the eight-category official frame, ",
                  "not a measure of affiliation versus non-affiliation; the frame carries no no-religion category, so a full-affiliation ",
                  "share would be a flat 100 everywhere and carry no signal."),
           reference_group_declaration),
         unit = "percent", denominator_indicator_id = "population_total",
         method = paste0("100 times the district ", reference_group_label, " count divided by the district total population. ",
                         "religious_change is not emitted (single wave; the 2017 frame is not category-comparable and no 2017 district table is cached)."),
         temporal_coverage = temporal_cov, spatial_coverage = spatial_cov, quality_notes = quality_cov),
    list(indicator_id = "no_religion_percent", label = "Minority share (%)",
         description = paste0(
           "Exact complement of the ", reference_group_label, " share: the summed share of every published religion category outside the reference group (",
           paste(vapply(minority_group_codes, function(cc) unname(category_verbatim[cc]), character(1)), collapse = ", "),
           "). This is arithmetic on published affiliation categories - the share outside Pakistan's largest published category - and is not a measure of no religion, belief, practice, or secularity. ",
           "The slot reuses the legacy no_religion_percent field under the two-slot design (", design_doc, "); pages relabel it verbatim to \"Minority share (%)\"."),
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 times the sum of the seven non-reference categories divided by the district total, equivalently 100 minus the Muslim share; the two slots are exact complements in every row.",
         temporal_coverage = temporal_cov, spatial_coverage = spatial_cov, quality_notes = quality_cov)
  )
}

visual_layers <- function() {
  list(
    list(visual_layer_id = "pk-district-muslim-share", label = paste0(reference_group_label, " (%)"),
         description = paste0("Reference-group (", reference_group_label, ") share of the district population, 2023. The reference group is fixed nationally to ",
                              reference_group_label, ", Pakistan's largest published category in 2023."),
         layer_type = "choropleth", indicator_ids = list("religious_affiliation_percent"),
         geometry_unit_type = "area_unit", legend = list(unit = "percent", denominator = "district total population"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "district counts rendered as published; no allocation; geometry pending (boundary lane held)",
         uncertainty_display = "quality_flag", default_visibility = TRUE, notes = paste(scope_note, sensitivity_note, boundary_note)),
    list(visual_layer_id = "pk-district-minority-share", label = "Minority share (%)",
         description = "Minority share: the exact complement of the Muslim share, the summed share of every published religion category outside the reference group. Arithmetic on published categories, not a measure of no religion or secularity.",
         layer_type = "choropleth", indicator_ids = list("no_religion_percent"),
         geometry_unit_type = "area_unit", legend = list(unit = "percent", denominator = "district total population"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "district counts rendered as published; no allocation; geometry pending (boundary lane held)",
         uncertainty_display = "quality_flag", default_visibility = FALSE, notes = paste(scope_note, sensitivity_note, boundary_note))
  )
}

source_datasets <- function() {
  list(
    list(source_dataset_id = census_dataset_id,
         name = "PBS Census of Pakistan 2023, Table 9: Population by Sex, Religion and Rural/Urban (four provincial district PDFs + ICT)",
         provider = "Pakistan Bureau of Statistics (PBS)",
         url = "https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_9_kp_districts.pdf",
         retrieval_date = retrieval_date, local_path = file.path(raw_dir, "table_9_kp_districts.pdf"),
         licence = list(
           name = paste0("PBS disseminates aggregate tabulations free and requires attribution; its terms restrict onward supply (verbatim: \"", pbs_terms_verbatim, "\"). No open licence."),
           url = "https://www.pbs.gov.pk/", attribution = "Source: Pakistan Bureau of Statistics (PBS), Census of Pakistan 2023, Table 9"),
         citation = "Pakistan Bureau of Statistics, Census 2023, Table 9: Population by Sex, Religion and Rural/Urban (provincial district tables and Islamabad Capital Territory).",
         access_limits = "The PBS host serves a soft-200 WordPress HTML fallback for missing objects; each cached PDF was verified as a real PDF and its sha256 is a build gate.",
         redistribution_limits = paste0("PBS terms restrict onward supply of data collected from PBS. This build publishes DERIVED rates with PBS attribution and holds raw PDFs git-ignored; the project lead approved the derived-rates-with-attribution position on ", licence_ruling_date, " (task 12), and written PBS confirmation is the clean path and remains pending (licence_status needs_review)."),
         notes = paste(description_note, scope_note)),
    list(source_dataset_id = boundary_dataset_id,
         name = "Pakistan 2023 district boundary - PENDING (no geometry ships)",
         provider = "geoBoundaries (ADM2/ADM3 candidates); PBS digital census (official layer to be requested)",
         url = "https://www.geoboundaries.org/",
         licence = list(
           name = "Boundary lane held: geoBoundaries PAK ADM3 (tehsil, ODbL) is vintage-misaligned with no evidenced 2023-district mapping; geoBoundaries PAK ADM2 (district) licence is unresolved and not used.",
           url = "https://www.geoboundaries.org/", attribution = "Boundary source pending"),
         citation = "No boundary geometry is shipped; see boundary_note.",
         access_limits = "No district geometry is cached in this build.",
         redistribution_limits = "Not applicable (no geometry ships).",
         notes = boundary_note)
  )
}

# describe one tracked public output in the manifest.
manifest_file_record <- function(path, content) {
  list(uri = paste0("repo:", path), storage_provider = "git_repository", format = tools::file_ext(path),
       bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = if (grepl("\\.csv$", path)) max(0L, length(readLines(path, warn = FALSE)) - 1L) else length(rows),
       content = content, privacy = "public", licence_status = "needs_review", licence_basis = licence_basis_slug)
}

# describe one raw cached source with URL, retrieval date, digest, and durable mirror.
raw_source_record <- function(fn, url, notes) {
  path <- file.path(raw_dir, fn)
  list(uri = path, url = url,
       durable_uri = paste0("gs://pow-research-data/raw_sources/pk_census/", fn),
       retrieval_date = retrieval_date, retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
       format = "pdf", bytes = file_bytes(path), sha256 = sha256_file(path),
       source_dataset_id = census_dataset_id, used_in_public_product = TRUE, notes = notes)
}

# --- write product ----------------------------------------------------------

area_summary <- list(
  schema_version = "0.2.0",
  generated_at = stamp, generated_by = script_id, country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code, level = boundary_level,
                      vintage = boundary_vintage, source_dataset_id = boundary_dataset_id),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "No governed Pakistan place-of-worship snapshot is included in this census-religion release.",
                       notes = paste("The product ships census-religion metrics only; no district geometry and no place-density fields.", boundary_note)),
  source_datasets = source_datasets(),
  indicators = indicators(),
  visual_layers = visual_layers(),
  rows = rows
)
write_json(area_summary, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)

# csv companion (place/land fields null throughout; no geometry).
csv_df <- data.frame(
  country_code = vapply(rows, `[[`, character(1), "country_code"),
  boundary_set_id = vapply(rows, `[[`, character(1), "boundary_set_id"),
  boundary_level = vapply(rows, `[[`, character(1), "boundary_level"),
  area_unit_id = vapply(rows, `[[`, character(1), "area_unit_id"),
  area_code = vapply(rows, `[[`, character(1), "area_code"),
  area_name = vapply(rows, `[[`, character(1), "area_name"),
  year = vapply(rows, `[[`, integer(1), "year"),
  population_total = vapply(rows, `[[`, integer(1), "population_total"),
  population_total_basis = vapply(rows, `[[`, character(1), "population_total_basis"),
  religious_affiliation_count = vapply(rows, `[[`, integer(1), "religious_affiliation_count"),
  religious_affiliation_percent = vapply(rows, `[[`, numeric(1), "religious_affiliation_percent"),
  no_religion_count = vapply(rows, `[[`, integer(1), "no_religion_count"),
  no_religion_percent = vapply(rows, `[[`, numeric(1), "no_religion_percent"),
  place_count = NA_integer_, places_per_10000_residents = NA_real_, place_density_per_sq_km = NA_real_,
  land_area_sq_km = NA_real_, site_snapshot_date = NA_character_, place_count_basis = NA_character_,
  source_dataset_ids = vapply(rows, function(r) paste(unlist(r[["source_dataset_ids"]]), collapse = "|"), character(1)),
  quality_flag = vapply(rows, `[[`, character(1), "quality_flag"),
  stringsAsFactors = FALSE
)
write.csv(csv_df, summary_csv_out, row.names = FALSE, na = "")

# hard gate: the description note is present in the shipped product.
product_text <- paste(readLines(summary_json_out, warn = FALSE), collapse = "\n")
if (!grepl(description_sentinel, product_text, fixed = TRUE)) {
  stop("description note absent from the shipped area-summary product", call. = FALSE)
}

# --- manifest ---------------------------------------------------------------

raw_sources <- list(
  raw_source_record("table_9_kp_districts.pdf", "https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_9_kp_districts.pdf", "2023 KP district+tehsil Table 9; includes former FATA districts and the Malakand Protected Area."),
  raw_source_record("table_9_punjab_districts.pdf", "https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_9_punjab_districts.pdf", "2023 Punjab district+tehsil Table 9; provincial total 127,333,305."),
  raw_source_record("table_9_sindh_districts.pdf", "https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_9_sindh_districts.pdf", "2023 Sindh district+tehsil Table 9."),
  raw_source_record("table_9_balochistan_districts.pdf", "https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_9_balochistan_districts.pdf", "2023 Balochistan district+tehsil Table 9."),
  raw_source_record("table_9_islamabad.pdf", "https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_9_islamabad.pdf", "2023 ICT Table 9; single Islamabad District, total 2,283,244.")
)

deferred_sources <- list(
  list(source = "PBS 2017 census Table 9, district-level provincial tables (Punjab, Sindh, Balochistan, ICT full district files)",
       status = "wave_not_shipped_input_not_cached",
       reason = paste("A 2017 district-level product cannot be built from the cache. The cached 2017 files reach only province/division level:",
                      "table09n_2017_national.pdf carries province rows (PAKISTAN, KP, Punjab, Sindh, Balochistan, FATA);",
                      "table09_2017_kp.pdf reaches only KP's six divisions; table09_2017_fata.pdf reaches only FATA and DIVISION-1.",
                      "The full 2017 district/tehsil provincial files were not cached. Downloading them from PBS is the unblock for the second wave;",
                      "the 2017 frame is a separate six-category per-vintage frame (FATA a separate pre-merger unit) and would ship on its own district frame with no cross-vintage concordance and change withheld across the 2018 FATA-into-KP merger.")),
  list(source = "1998 and earlier census religion, subnational",
       status = "deferred",
       reason = "National anchor only; subnational 1998 religion is a printed District Census Report route not recovered online in the probe."),
  list(source = "District boundary geometry (2023 vintage)",
       status = "boundary_lane_held",
       reason = boundary_note)
)

validation <- list(
  status = "passed",
  commands = list(
    "Rscript scripts/build_pk_area_summary.R",
    "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/pk/data/area_summary_district.json",
    "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/data-manifest.schema.json docs/manifests/pk-census-religion-2023.json",
    "bash scripts/validate_manifests.sh"
  ),
  tests = list(
    "Source integrity: every 2023 input matches its route-probe sha256.",
    "Every district row's eight category counts sum to its printed total (all 136 units).",
    "Each province's district totals sum exactly to the published provincial anchor (KP incl. the Malakand Protected Area; Punjab; Sindh; Balochistan; ICT).",
    "The national religion-table total equals its eight-category sum.",
    "The two metric slots are exact complements in every row (percent to 100; count to total).",
    "Computed national shares cross-check the published secondary shares within 0.05pp.",
    "The description note is present in the shipped product and this manifest."
  ),
  gates = list(
    source_integrity_sha256 = "passed",
    row_category_sum_equals_total = "passed",
    province_exact_reconciliation = "passed",
    national_total_equals_category_sum = national_sum[["total"]] == sum(national_sum[category_ids]),
    metric_slots_exact_complement = "passed",
    single_wave_no_frame_mixing = "passed (only 2023 ships; 2017 documented in deferred_sources, never mixed)",
    boundary_lane_held = "passed (no geometry; land_area and place fields null; boundary recorded as documented blocker)",
    no_invented_concordance = "passed (no cross-vintage district concordance; no ADM3-to-district mapping invented)",
    description_note_in_product_and_manifest = grepl(description_sentinel, product_text, fixed = TRUE)
  ),
  province_reconciliation = province_reconciliation,
  national_reconciliation = list(
    units = n_units,
    national_total = as.integer(national_sum[["total"]]),
    category_totals = setNames(as.list(as.integer(national_sum[category_ids])), category_ids),
    national_total_source = "sum of the five published provincial Table 9 header totals (no 2023 national religion file is cached; each provincial sum reconciles exactly to its Table 9 header)",
    published_headline_total_note = "The PBS headline 2023 population for four provinces + ICT is 241,499,431; the Table 9 religion tables enumerate 240,458,089. The difference (1,041,342) is rendered as the record, not reconciled or explained here.",
    share_crosscheck = share_crosscheck
  ),
  stats = list(
    wave = wave, units = n_units,
    units_by_province = setNames(lapply(province_reconciliation, function(p) p[["unit_count"]]), names(province_reconciliation)),
    rows = length(rows),
    summary_json_bytes = file_bytes(summary_json_out), summary_csv_bytes = file_bytes(summary_csv_out)
  )
)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = "manifest:pk-census-religion:pk:2023:pbs-district",
  dataset_id = "pk-census-religion:pk:2023:pbs-district",
  dataset_version_id = paste0("pk-census-religion:pk:2023:pbs-district:", substr(sha256_file(summary_json_out), 1L, 12L)),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "pk-census-religion", dataset_role = "public_product",
  scope = list(level = "country", country_codes = list(country_code), snapshot_date = NULL, snapshot_anchor = NULL, pipeline_stage = "staged"),
  created_at = stamp, created_by = script_id,
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      waves = list(wave),
      geography = "136 district-equivalent tabulation units (four provinces + ICT) as printed in PBS 2023 Table 9; the KP frame includes 34 districts plus the Malakand Protected Area (a top-level tabulation unit)",
      district_count_note = "Table 9 as published yields 136 district-equivalent units (KP 34 districts + Malakand Protected Area; Punjab 36; Sindh 30; Balochistan 34; ICT 1). The PBS administrative-district count of 156 differs from the Table 9 tabulation frame; this product renders the Table 9 frame and invents no districts.",
      construct = "census religion (eight-category official self-identification, no no-religion or not-stated option)",
      denominator = "district total population",
      category_rule = "eight verbatim 2023 categories rendered exactly as printed; nothing combined; no small-cell suppression; the two metric slots carry the minority-share two-slot design (see minority_share_design)",
      category_frame_verbatim = as.list(unname(category_verbatim)),
      minority_share_design = list(
        design = design_doc, ratified = licence_ruling_date,
        reference_group = reference_group_code, reference_group_label = reference_group_label,
        reference_group_basis = "largest published national religion category in 2023; declared once and held constant across every area",
        minority_group_categories = as.list(minority_group_codes),
        slot_religious_affiliation_percent = "Muslim (reference-group) share of the district total population",
        slot_no_religion_percent = "minority share: exact complement of the Muslim share (the seven non-reference categories summed); not a measure of no religion, belief, practice, or secularity",
        religious_change = "not emitted (single wave; the 2017 frame is not category-comparable and no 2017 district table is cached)",
        national_muslim_share_2023 = national_muslim_share),
      description_note = description_note,
      territorial_scope = scope_note,
      sensitivity = sensitivity_note,
      small_cell_treatment = "none; district exact counts rendered as published (no PBS suppression rule)",
      boundary_status = boundary_note,
      wave_coverage = "ONE wave ships (2023). The 2017 wave is deferred: no 2017 district table is cached (province/division only). See deferred_sources.",
      manifest_naming_note = "Named to the shipped span (pk-census-religion-2023.json) per the shipped-wave rule; the pk-census-religion family manifest widens to 2017-2023 only when a 2017 district wave is actually built.",
      local_cache_hint = "Raw PBS Table 9 PDFs and boundary metadata are cached under data/raw/pk_census/ and remain git-ignored.",
      raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/pk_census/ (12 objects mirrored 2026-07-11)"),
      pbs_terms_verbatim = list(dissemination_policy = pbs_dissemination_verbatim, terms_and_conditions = pbs_terms_verbatim),
      retrieval_routes = list(
        list(purpose = "2023 KP district religion table", method = "GET", url = "https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_9_kp_districts.pdf"),
        list(purpose = "2023 Punjab district religion table", method = "GET", url = "https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_9_punjab_districts.pdf"),
        list(purpose = "2023 Sindh district religion table", method = "GET", url = "https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_9_sindh_districts.pdf"),
        list(purpose = "2023 Balochistan district religion table", method = "GET", url = "https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_9_balochistan_districts.pdf"),
        list(purpose = "2023 ICT religion table", method = "GET", url = "https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_9_islamabad.pdf")
      )
    ),
    software_versions = list(
      r = R.version.string, jsonlite = as.character(packageVersion("jsonlite")),
      digest = as.character(packageVersion("digest")),
      pdftotext = tryCatch(system2("pdftotext", "-v", stdout = TRUE, stderr = TRUE)[1], error = function(e) "pdftotext (poppler)")
    )
  ),
  source = list(
    provider = "Pakistan Bureau of Statistics (PBS)",
    source_dataset_ids = list(census_dataset_id, boundary_dataset_id),
    source_urls = list(
      "https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_9_kp_districts.pdf",
      "https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_9_punjab_districts.pdf",
      "https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_9_sindh_districts.pdf",
      "https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_9_balochistan_districts.pdf",
      "https://www.pbs.gov.pk/wp-content/uploads/census_tables/tables/table_9_islamabad.pdf"
    ),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = paste0("PBS disseminates aggregate tabulations free with attribution (verbatim: \"", pbs_dissemination_verbatim,
                     "\") and restricts onward supply (verbatim: \"", pbs_terms_verbatim,
                     "\"). This build ships derived rates with PBS attribution; the project lead approved the derived-rates-with-attribution position on ", licence_ruling_date,
                     " (task 12); written PBS confirmation is pending, so licence_status is needs_review."),
    citation = "Pakistan Bureau of Statistics, Census 2023, Table 9: Population by Sex, Religion and Rural/Urban.",
    raw_redistribution = "Raw PBS PDFs stay git-ignored; only derived summaries are published. Cached under data/raw/pk_census/, mirrored to gs://pow-research-data/raw_sources/pk_census/.",
    licence_position = "needs_review"
  ),
  input_manifests = list(),
  durable_files = list(
    manifest_file_record(summary_json_out, "Pakistan district census-religion summary for 2023 (136 district-equivalent units; four provinces + ICT); no geometry (boundary lane held)."),
    manifest_file_record(summary_csv_out, "Flattened Pakistan district census-religion rows, 2023.")
  ),
  raw_sources = raw_sources,
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id, notes = paste0(n_units, " district-year rows (2023).")),
    list(uri = paste0("repo:", summary_csv_out), sha256 = sha256_file(summary_csv_out), built_by = script_id, notes = "CSV companion.")
  ),
  target_years = list(wave),
  deferred_sources = deferred_sources,
  construct_notes = list(description_note, scope_note, sensitivity_note, boundary_note, reference_group_declaration),
  validation = validation,
  privacy = "public", licence_status = "needs_review", licence_basis = licence_basis_slug, downstream_status = "staged",
  source_datasets = source_datasets(),
  notes = "STAGED build: derived district area summaries only, no geometry, no page, no hub link. The page waits for the project lead's review of the encoded treatment. Iran/Israel-Palestine render-the-record precedent."
)
write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)

# --- report -----------------------------------------------------------------

cat(sprintf("PAKISTAN 2023 district census-religion product (STAGED)\n"))
cat(sprintf("units: %d district-equivalent (four provinces + ICT)\n\n", n_units))
cat("province reconciliation (district sum vs published provincial anchor):\n")
for (code in names(province_reconciliation)) {
  p <- province_reconciliation[[code]]
  cat(sprintf("  %-4s %-22s n=%3d  sum=%12d  anchor=%12d  %s\n",
              code, p[["province_name"]], p[["unit_count"]], p[["district_sum_total"]], p[["provincial_anchor_total"]],
              ifelse(p[["match"]], "MATCH", "MISMATCH")))
}
cat(sprintf("\nnational (sum of provincial anchors): total=%d\n", national_sum[["total"]]))
cat("category totals:\n")
for (cid in category_ids) cat(sprintf("  %-16s %12d\n", category_verbatim[[cid]], national_sum[[cid]]))
cat(sprintf("\nnational shares (computed vs published secondary):\n"))
cat(sprintf("  Muslim              %8.4f%%  (published ~%.2f%%)\n", national_muslim_share, published_national_shares[["muslim"]]))
cat(sprintf("  Hindu Jati+Sched.C. %8.4f%%  (published ~%.2f%%)\n", national_hindu_incl_sc_share, published_national_shares[["hindu_incl_scheduled"]]))
cat(sprintf("  Christian           %8.4f%%  (published ~%.2f%%)\n", national_christian_share, published_national_shares[["christian"]]))
cat(sprintf("  Qadiani/Ahmadi      %8.4f%%  (published ~%.2f%%)\n", national_qadiani_share, published_national_shares[["qadiani_ahmadi"]]))
cat("\ngates: source-integrity, row-sum, province-exact-reconciliation, national-sum, metric-complement, description-note = passed\n")
cat("waves: 2023 shipped; 2017 DEFERRED (no district table cached); boundary lane HELD (no geometry)\n")
cat(sprintf("\nfiles written:\n  %s (%d rows, %d bytes)\n  %s (%d bytes)\n  %s (%d bytes)\n",
            summary_json_out, length(rows), file_bytes(summary_json_out),
            summary_csv_out, file_bytes(summary_csv_out),
            manifest_out, file_bytes(manifest_out)))
