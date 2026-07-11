# build the Samoa (WS) constituency census-religion area-summary product (STAGED, NO GEOMETRY).
# inputs: Samoa Bureau of Statistics (SBS) 2021 Census tables workbook, sheet "Table 2"
#         (Total population by sex, religion and place of residence, 2021), cached under
#         data/raw/ws_census/ and git-ignored. The sha256 is pinned in
#         research/countries/ws/route-probe.md and verified as a source-integrity gate.
# outputs: apps/regions/ws/data/area_summary_constituency.{json,csv} and
#         docs/manifests/ws-census-religion-2021.json. NO geometry file (see the boundary note).
# run from the repository root: Rscript scripts/build_ws_area_summary.R
#
# scope of this build (STAGED, NO GEOMETRY; project-lead PI task 3 ruling, 2026-07-11 "USE FOR NOW"):
#   - ONE wave ships: 2021, at constituency-district level (51 units), the finest level a future
#     licensed boundary layer or published concordance will plausibly match. The 4 statistical regions
#     ride the manifest as recorded roll-up context; the 339-village detail is preserved in the raw
#     cache and documented as the deeper route. The 2006/2011/2016 waves publish religion only at
#     national or urban-rural level and are recorded as documented non-routes, never waves.
#   - Verbatim official 2021 categories (26), read directly from the workbook header, no relabelling,
#     no combining, no cell suppression, exact printed counts.
#   - The 2021 frame carries a REAL non-affiliation category (NO RELIGION; 132 nationally), so the
#     ordinary two-slot semantics apply, NOT the minority-share design: religious_affiliation_percent
#     := the share reporting any of the 25 religious-affiliation categories, and no_religion_percent
#     := the NO RELIGION share. The two slots are exact complements. religious_change is not emitted
#     (single wave).
#   - Boundary lane HELD: no boundary geometry ships. No licensed layer matches the census partition
#     at any level (geoBoundaries WSM ADM1 = 11 traditional districts, ADM2 = 43 districts; the census
#     is 4 regions / 51 constituencies / 339 villages). An ADM2 concordance would be inferred, which
#     the stop-don't-tune rule forbids. The product ships the data tables and manifest with the
#     boundary recorded as a documented blocker; land_area_sq_km and all place-density fields are null.
#     The SBS ask (reuse confirmation plus a licensed constituency/village layer or a published
#     concordance) is named as the unblock.
#   - Licence: the SBS 2021 report prints only a bare copyright with no reuse grant. The build ships
#     DERIVED aggregate rates with SBS attribution under the project lead's use-for-now ruling
#     (2026-07-11); raw inputs stay git-ignored and are mirrored to
#     gs://pow-research-data/raw_sources/ws_census/. Written SBS confirmation is the clean path and
#     remains pending, so licence_status is needs_review.

suppressMessages({
  library(readxl)
  library(digest)
  library(jsonlite)
})

raw_dir <- "data/raw/ws_census"
output_dir <- "apps/regions/ws/data"
manifest_dir <- "docs/manifests"
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

country_code <- "WS"
wave <- 2021L
script_id <- "scripts/build_ws_area_summary.R"
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- "2026-07-11"
git_commit <- tryCatch(system("git rev-parse --short HEAD", intern = TRUE), error = function(e) NA_character_)
if (length(git_commit) == 0L || is.na(git_commit[[1]])) git_commit <- NULL

boundary_level <- "constituency"
boundary_vintage <- "2021"
boundary_set_id <- "ws-constituency-2021-boundary-pending"
census_dataset_id <- "sbs-census-2021-table2-religion-constituency"
boundary_dataset_id <- "ws-constituency-2021-boundary-pending"
licence_ruling_date <- "2026-07-11"

workbook <- file.path(raw_dir, "ws_2021_census_tables.xlsx")
report_pdf <- file.path(raw_dir, "ws_2021_final_report.pdf")
workbook_url <- "https://www.sbs.gov.ws/wp-content/uploads/2022/12/CensusTablesEXCELFiles.xlsx"
report_url <- "https://sbs.gov.ws/documents/census/2021/Census-2021-Final-Report_221122_051222.pdf"

summary_json_out <- file.path(output_dir, "area_summary_constituency.json")
summary_csv_out <- file.path(output_dir, "area_summary_constituency.csv")
manifest_out <- file.path(manifest_dir, "ws-census-religion-2021.json")

# pinned source-integrity digest from the route probe (hard gate).
expected_sha256 <- c(
  "ws_2021_census_tables.xlsx" = "910835e462db535ebd2f1bb2f1f4581136b6c90431f31cb34c0e5f2b55dec884",
  "ws_2021_final_report.pdf"   = "59fd92c6e36f379949915dc2f7d142bd4c54a037497044be6a7befab3de1ddbc"
)

# the four statistical regions, named exactly as the workbook prints them; the region row is the
# roll-up parent of its constituencies. region short codes give unique area codes.
region_names <- c("Apia Urban Area", "North West Upolu", "Rest of Upolu", "Savaii")
region_codes <- c("Apia Urban Area" = "aua", "North West Upolu" = "nwu",
                  "Rest of Upolu" = "rou", "Savaii" = "sav")
national_name <- "Samoa"

# the SBS copyright line, verbatim from the cached 2021 report bytes (probe record; two spaces after
# the copyright mark are preserved exactly).
sbs_copyright_verbatim <- "Copyright ©  Samoa Bureau of Statistics (SBS), Apia, Samoa, 2022."
licence_basis_slug <- "sbs_bare_copyright_derived_aggregates_attribution"

# --- ruled notes carried on the product and manifest ------------------------

# the construct-and-frame note: verbatim categories, the real non-affiliation category, ordinary slots.
description_note <- paste(
  "This product renders the 26 religion categories of the 2021 Census of Samoa exactly as the Samoa Bureau of Statistics (SBS) prints them in the census tables workbook, sheet Table 2 (Total population by sex, religion and place of residence, 2021).",
  "The categories are carried verbatim, including their irregular source spellings and spacing (for example LATTER  DAY SAINTS, ASO FITU  (SISDAC), PABTISM); nothing is relabelled, combined, or suppressed.",
  "The construct is census affiliation: the table counts the whole resident population by stated church or religion, and does not measure practice, attendance, or registered membership.",
  "The 2021 frame carries a real NO RELIGION category (132 people nationally), so the ordinary two-slot semantics apply and the minority-share design does not: religious_affiliation_percent is the share reporting any of the 25 religious-affiliation categories, and no_religion_percent is the NO RELIGION share.",
  "The two slots are exact complements of the enumerated population. religious_change is not emitted, because only the 2021 wave publishes a subnational religion table."
)
description_sentinel <- "the ordinary two-slot semantics apply and the minority-share design does not"

# the territorial-and-hierarchy scope statement, as the workbook states it.
scope_note <- paste(
  "The 2021 census enumerates the whole resident population of Samoa and partitions it at four nested levels: the nation, four statistical regions (Apia Urban Area, North West Upolu, Rest of Upolu, Savaii), 51 constituency-districts (the 2021 Faipule/electoral districts), and 339 villages.",
  "This product ships the 51 constituency-districts as the primary level, the finest level a future licensed boundary layer or published concordance will plausibly match.",
  "The four statistical regions ride this manifest as recorded roll-up context, and the 339-village detail is preserved in the git-ignored raw cache and documented as the deeper route; neither ships as product rows.",
  "Every level reconciles exactly on the cached workbook, with no value allocated, inferred, rounded, or tuned."
)

# the boundary hold, recorded as a documented blocker (no geometry ships).
boundary_note <- paste(
  "No boundary geometry ships with this product; the boundary lane is HELD as a documented blocker.",
  "No licensed polygon layer matches the 2021 census religion partition at any level. geoBoundaries WSM ADM1 (11 traditional districts, represented year 2018, CC BY-SA 3.0) has no census roll-up to 11 units; geoBoundaries WSM ADM2 (43 districts, represented year 2011, CC BY 4.0) uses a 2011 East/West split into which the 51 numeric 2021 constituencies do not nest one-to-one, and no official 2021-constituency-to-ADM2 concordance was published.",
  "Aggregating the census to match ADM2 would require an inferred concordance, which the stop-don't-tune rule forbids; no licensed 4-region or 339-village polygon layer was located either.",
  "Consequently land_area_sq_km and all place-density fields are null. The unblock is the SBS ask: written confirmation of reuse terms plus a licensed constituency or village boundary layer, or a published constituency-to-district concordance."
)

# --- helpers ----------------------------------------------------------------

# return a file's SHA-256 digest.
sha256_file <- function(path) unname(tools::sha256sum(path))
# return a file size in bytes.
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))
# slugify a unit name to an ascii code fragment.
slugify <- function(x) {
  s <- tolower(x)
  s <- gsub("[^a-z0-9]+", "-", s)
  s <- gsub("(^-|-$)", "", s)
  s
}

# --- source-integrity gate --------------------------------------------------

# gate 1: every declared input matches its pinned route-probe sha256.
for (fn in names(expected_sha256)) {
  p <- file.path(raw_dir, fn)
  if (!file.exists(p)) stop("missing cached raw input: ", p, call. = FALSE)
  got <- sha256_file(p)
  if (!identical(got, expected_sha256[[fn]])) {
    stop("sha256 mismatch for ", fn, ": expected ", expected_sha256[[fn]], " got ", got, call. = FALSE)
  }
}

# --- read the workbook ------------------------------------------------------

# Table 2 layout: column 1 is the place label; then 27 three-column groups (TOTAL, then the 26 religion
# categories) each printed as Total / MALE / FEMALE. The group "Total" columns are 2, 5, 8, ..., i.e.
# 2 + 3*(0:26). Row 1 is the sheet title, row 2 the category headers, row 3 the Total/MALE/FEMALE
# subheaders, and rows 4.. the area rows, closed by a "Source:" footnote row.
raw <- as.data.frame(read_excel(workbook, sheet = "Table 2", col_names = FALSE, .name_repair = "minimal"))
tot_cols <- 2L + 3L * (0:26)              # 27 columns: TOTAL + 26 category totals
cat_hdr_cols <- 2L + 3L * (1:26)          # the 26 category header columns in row 2

# read the 26 category headers verbatim from the workbook; trim only surrounding whitespace and stray
# carriage-return/newline artifacts, and preserve internal spacing (the double spaces are the record).
category_verbatim <- trimws(gsub("[\r\n]+", " ", as.character(unlist(raw[2, cat_hdr_cols]))))
category_verbatim <- trimws(category_verbatim)
if (length(category_verbatim) != 26L || anyNA(category_verbatim) || any(category_verbatim == "")) {
  stop("expected 26 verbatim category headers in Table 2 row 2", call. = FALSE)
}
# the final category must be the non-affiliation slot; the ordinary two-slot semantics depend on it.
no_religion_idx <- 26L
if (!identical(toupper(category_verbatim[no_religion_idx]), "NO RELIGION")) {
  stop("the 26th category is not NO RELIGION; the ordinary-slot assumption fails", call. = FALSE)
}
category_ids <- vapply(category_verbatim, slugify, character(1))
if (anyDuplicated(category_ids)) {
  # disambiguate any slug collision by appending the printed order index.
  dup <- duplicated(category_ids) | duplicated(category_ids, fromLast = TRUE)
  category_ids[dup] <- paste0(category_ids[dup], "-", which(dup))
}
names(category_verbatim) <- category_ids

# find the data block: rows 4 through the row before the "Source:" footnote.
foot <- which(grepl("^\\s*Source:", raw[[1]]))
if (length(foot) != 1L) stop("could not locate the single Source: footnote row", call. = FALSE)
data_rows <- 4:(foot[1] - 1L)
labels <- trimws(as.character(raw[[1]][data_rows]))
# 27-column integer matrix of Total values (TOTAL + 26 categories) for every area row.
M <- sapply(tot_cols, function(c) suppressWarnings(as.integer(raw[data_rows, c])))
colnames(M) <- c("TOTAL", category_ids)
if (anyNA(M)) stop("non-integer or missing value in a Table 2 total column", call. = FALSE)
n_rows <- nrow(M)

# --- hierarchical parse -----------------------------------------------------

# assign each area row a level. the national row is the single "Samoa" row; the four region rows are
# the named statistical regions; within each region block the rows are a depth-first sequence of
# [constituency, its villages...]. because every total is strictly positive (min 4) and each
# constituency equals the exact sum of the contiguous villages that follow it, a running-sum walk
# recovers the constituency/village split unambiguously. the parse is then hard-checked against the
# probe's pinned structure (1 / 4 / 51 / 339) and exact reconciliation at every level.
level <- rep(NA_character_, n_rows)
nat_pos <- which(labels == national_name)
if (length(nat_pos) != 1L || nat_pos != 1L) stop("national row (Samoa) not found at the top of the block", call. = FALSE)
level[nat_pos] <- "national"
reg_pos <- match(region_names, labels)
if (anyNA(reg_pos)) stop("a named statistical region row is missing from Table 2", call. = FALSE)
level[reg_pos] <- "region"

parent_region <- rep(NA_character_, n_rows)   # region label for every constituency and village
parent_constituency <- rep(NA_character_, n_rows)  # constituency label for every village
region_child_counts <- list()

reg_order <- order(reg_pos)
reg_pos_sorted <- reg_pos[reg_order]
region_names_sorted <- region_names[reg_order]
for (i in seq_along(reg_pos_sorted)) {
  r <- reg_pos_sorted[i]
  block_start <- r + 1L
  block_end <- if (i < length(reg_pos_sorted)) reg_pos_sorted[i + 1L] - 1L else n_rows
  block <- block_start:block_end
  region_label <- region_names_sorted[i]
  con_total_acc <- setNames(rep(0L, 27L), colnames(M))
  n_con <- 0L; n_vil <- 0L
  j <- 1L
  while (j <= length(block)) {
    ci <- block[j]
    level[ci] <- "constituency"; parent_region[ci] <- region_label; n_con <- n_con + 1L
    ctot <- M[ci, ]
    acc <- setNames(rep(0L, 27L), colnames(M))
    k <- j + 1L
    while (k <= length(block) && acc[["TOTAL"]] < ctot[["TOTAL"]]) {
      vi <- block[k]
      level[vi] <- "village"; parent_region[vi] <- region_label; parent_constituency[vi] <- labels[ci]
      acc <- acc + M[vi, ]; n_vil <- n_vil + 1L; k <- k + 1L
    }
    if (!all(acc == ctot)) {
      stop("constituency ", labels[ci], " does not equal the exact sum of its villages (TOTAL ",
           ctot[["TOTAL"]], " vs village sum ", acc[["TOTAL"]], ")", call. = FALSE)
    }
    con_total_acc <- con_total_acc + ctot
    j <- k
  }
  if (!all(con_total_acc == M[r, ])) {
    stop("region ", region_label, " does not equal the exact sum of its constituencies", call. = FALSE)
  }
  region_child_counts[[region_label]] <- list(constituencies = n_con, villages = n_vil,
                                              region_total = as.integer(M[r, "TOTAL"]))
}

# gate 2: the parse reproduces the probe's pinned hierarchy exactly.
n_national <- sum(level == "national"); n_region <- sum(level == "region")
n_constituency <- sum(level == "constituency"); n_village <- sum(level == "village")
if (anyNA(level)) stop("an area row was left unclassified by the hierarchical parse", call. = FALSE)
if (!identical(c(n_national, n_region, n_constituency, n_village), c(1L, 4L, 51L, 339L))) {
  stop("hierarchy counts ", n_national, "/", n_region, "/", n_constituency, "/", n_village,
       " do not match the probe's pinned 1/4/51/339", call. = FALSE)
}

# gate 3: row-internal reconciliation. every area row's 26 category totals sum to its TOTAL column.
row_bad <- which(M[, "TOTAL"] != rowSums(M[, category_ids, drop = FALSE]))
if (length(row_bad) > 0L) {
  stop("row-internal mismatch (26 categories != TOTAL) at: ",
       paste(labels[row_bad], collapse = "; "), call. = FALSE)
}

# gate 4: hierarchical reconciliation at every level and every category (villages->constituencies,
# constituencies->regions, regions->national), across all 27 columns, zero mismatches.
recon <- list()
# villages -> constituencies
con_rows <- which(level == "constituency")
vil_mismatch <- 0L
for (ci in con_rows) {
  kids <- which(level == "village" & parent_constituency == labels[ci] & parent_region == parent_region[ci])
  if (length(kids) == 0L) next  # a constituency may have no separate village rows if it is itself a leaf
  s <- colSums(M[kids, , drop = FALSE])
  if (!all(s == M[ci, ])) vil_mismatch <- vil_mismatch + 1L
}
# constituencies -> regions
reg_rows <- which(level == "region")
reg_mismatch <- 0L
for (ri in reg_rows) {
  kids <- which(level == "constituency" & parent_region == labels[ri])
  s <- colSums(M[kids, , drop = FALSE])
  if (!all(s == M[ri, ])) reg_mismatch <- reg_mismatch + 1L
}
# regions -> national
national_row <- M[nat_pos, ]
region_sum <- colSums(M[reg_rows, , drop = FALSE])
nat_ok <- all(region_sum == national_row)
if (vil_mismatch > 0L || reg_mismatch > 0L || !nat_ok) {
  stop("hierarchical reconciliation failed: village->constituency mismatches=", vil_mismatch,
       " constituency->region mismatches=", reg_mismatch, " region->national ok=", nat_ok, call. = FALSE)
}

# national headline figures for the record.
national_total <- as.integer(national_row[["TOTAL"]])
national_no_religion <- as.integer(national_row[[category_ids[no_religion_idx]]])
national_affiliated <- national_total - national_no_religion
national_affiliation_share <- round(100 * national_affiliated / national_total, 4)
national_no_religion_share <- round(100 * national_no_religion / national_total, 4)

# --- row building (constituency primary level) ------------------------------

# build one schema-conforming constituency-year row. ordinary two-slot semantics:
# religious_affiliation_count := TOTAL - NO RELIGION (the 25 religious-affiliation categories),
# no_religion_count := NO RELIGION. the 26 verbatim category counts ride the quality_flag as the record.
build_row <- function(ci) {
  vals <- M[ci, ]
  total <- as.integer(vals[["TOTAL"]])
  no_rel <- as.integer(vals[[category_ids[no_religion_idx]]])
  affiliated <- total - no_rel
  region_label <- parent_region[ci]
  code <- paste0(region_codes[[region_label]], "-", slugify(labels[ci]))
  cat_record <- paste(vapply(seq_len(26L), function(k) {
    paste0(category_verbatim[[k]], "=", as.integer(vals[[category_ids[k]]]))
  }, character(1)), collapse = ";")
  flag <- paste0(
    "census_religion_2021_verbatim_frame;26_category_partition;real_no_religion_category;",
    "ordinary_two_slot_semantics;",
    "religious_affiliation_percent=any_of_25_affiliation_categories;no_religion_percent=no_religion_share;",
    "exact_complements;exact_printed_counts;no_small_cell_suppression;",
    "primary_level=constituency;region=", region_label, ";",
    "categories_verbatim[", cat_record, "]"
  )
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = paste0(boundary_set_id, ":", code),
    area_code = code,
    area_name = labels[ci],
    year = wave,
    population_total = total,
    population_total_basis = paste0(
      "SBS 2021 Census Table 2 total resident population for the constituency-district (the row's TOTAL column). ", scope_note
    ),
    religious_affiliation_count = as.integer(affiliated),
    religious_affiliation_percent = round(100 * affiliated / total, 4),
    no_religion_count = as.integer(no_rel),
    no_religion_percent = round(100 * no_rel / total, 4),
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

rows <- lapply(con_rows, build_row)
n_units <- length(rows)

# gate 5: the two metric slots are exact complements in every row (percentages sum to 100 at printed
# rounding; counts sum to the constituency total). stop, do not tune.
for (r in rows) {
  a <- r[["religious_affiliation_percent"]]; nr <- r[["no_religion_percent"]]
  ac <- r[["religious_affiliation_count"]]; nc <- r[["no_religion_count"]]; tot <- r[["population_total"]]
  if (round(a + nr, 4) != 100) stop("metric slots not exact complements (percent) for ", r[["area_code"]], call. = FALSE)
  if (ac + nc != tot) stop("metric slots not exact complements (count) for ", r[["area_code"]], call. = FALSE)
}

# gate 6: unique area codes.
area_codes <- vapply(rows, function(r) r[["area_code"]], character(1))
if (anyDuplicated(area_codes)) {
  stop("duplicate area codes: ", paste(area_codes[duplicated(area_codes)], collapse = "; "), call. = FALSE)
}

# --- product declarations ---------------------------------------------------

temporal_cov <- "SBS Census of Samoa 2021, Table 2 (Total population by sex, religion and place of residence)."
spatial_cov <- paste("Fifty-one constituency-districts (the 2021 Faipule/electoral districts), as printed in Table 2.", scope_note)
quality_cov <- paste("Census religion is a 26-category official frame that includes a real NO RELIGION category.", description_note, boundary_note)

indicators <- function() {
  list(
    list(indicator_id = "population_total", label = "Census resident population",
         description = paste("SBS 2021 Table 2 total resident population for the constituency-district.", scope_note),
         unit = "count", denominator_indicator_id = NULL,
         method = "Direct Table 2 TOTAL column; equals the sum of the 26 printed religion categories for the unit, and the exact sum of the unit's villages.",
         temporal_coverage = temporal_cov, spatial_coverage = spatial_cov, quality_notes = quality_cov),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation (%)",
         description = paste0(
           "Share of the constituency's enumerated resident population reporting any of the 25 religious-affiliation categories in the 2021 frame (every category except NO RELIGION). ",
           "The 2021 frame carries a real NO RELIGION category, so this is an ordinary affiliation share, not the minority-share reference-group construct. It is the exact complement of no_religion_percent."),
         unit = "percent", denominator_indicator_id = "population_total",
         method = paste0("100 times (constituency TOTAL minus NO RELIGION) divided by constituency TOTAL. ",
                         "religious_change is not emitted (single subnational wave; 2006/2011/2016 publish religion only at national or urban-rural level)."),
         temporal_coverage = temporal_cov, spatial_coverage = spatial_cov, quality_notes = quality_cov),
    list(indicator_id = "no_religion_percent", label = "No religion (%)",
         description = paste0(
           "Share of the constituency's enumerated resident population recorded in the NO RELIGION category of the 2021 frame. ",
           "This is a real census category (132 people nationally), reported as printed; it is the exact complement of religious_affiliation_percent."),
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 times the constituency NO RELIGION count divided by constituency TOTAL; the two slots are exact complements in every row.",
         temporal_coverage = temporal_cov, spatial_coverage = spatial_cov, quality_notes = quality_cov)
  )
}

visual_layers <- function() {
  list(
    list(visual_layer_id = "ws-constituency-affiliation-share", label = "Religious affiliation (%)",
         description = "Share of the constituency population reporting any religious affiliation (all categories except NO RELIGION), 2021.",
         layer_type = "choropleth", indicator_ids = list("religious_affiliation_percent"),
         geometry_unit_type = "area_unit", legend = list(unit = "percent", denominator = "constituency total resident population"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "constituency counts rendered as published; no allocation; geometry pending (boundary lane held)",
         uncertainty_display = "quality_flag", default_visibility = TRUE, notes = boundary_note),
    list(visual_layer_id = "ws-constituency-no-religion-share", label = "No religion (%)",
         description = "Share of the constituency population recorded as NO RELIGION, 2021; a real census category reported as printed.",
         layer_type = "choropleth", indicator_ids = list("no_religion_percent"),
         geometry_unit_type = "area_unit", legend = list(unit = "percent", denominator = "constituency total resident population"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "constituency counts rendered as published; no allocation; geometry pending (boundary lane held)",
         uncertainty_display = "quality_flag", default_visibility = FALSE, notes = boundary_note)
  )
}

census_licence_name <- paste0(
  "SBS asserts a bare copyright with no explicit reuse grant (verbatim: \"", sbs_copyright_verbatim,
  "\"). No SBS terms-of-use or open-data licence page was located. This build ships derived aggregate rates with SBS attribution under the project lead's use-for-now ruling (", licence_ruling_date,
  "); written SBS confirmation of reuse terms is pending, so the licence position is needs_review."
)

source_datasets <- function() {
  list(
    list(source_dataset_id = census_dataset_id,
         name = "SBS Census of Samoa 2021, Table 2: Total population by sex, religion and place of residence (census tables workbook)",
         provider = "Samoa Bureau of Statistics (SBS)",
         url = workbook_url,
         retrieval_date = retrieval_date, local_path = workbook,
         licence = list(name = census_licence_name, url = "https://www.sbs.gov.ws/",
                        attribution = "Source: Samoa Bureau of Statistics (SBS), Census of Samoa 2021, Table 2"),
         citation = "Samoa Bureau of Statistics, Population and Housing Census 2021, Table 2: Total population by sex, religion and place of residence.",
         access_limits = "Public download from the SBS website; the workbook sha256 is a build gate.",
         redistribution_limits = paste0(
           "SBS grants no explicit reproduction permission; the 2021 report prints only a bare copyright. This build publishes DERIVED aggregate rates with SBS attribution and holds raw inputs git-ignored; the project lead approved the use-for-now position on ", licence_ruling_date,
           " (PI task 3), and written SBS confirmation of reuse terms is the clean path and remains pending (licence_status needs_review)."),
         notes = paste(description_note, scope_note)),
    list(source_dataset_id = boundary_dataset_id,
         name = "Samoa 2021 constituency boundary - PENDING (no geometry ships)",
         provider = "geoBoundaries (WSM ADM1/ADM2 candidates); SBS (licensed constituency/village layer or concordance to be requested)",
         url = "https://www.geoboundaries.org/",
         licence = list(
           name = "Boundary lane held: no licensed layer matches the census partition at any level; geoBoundaries WSM ADM1 (11 traditional districts) and ADM2 (43 districts) do not nest to the 4-region / 51-constituency / 339-village census geography, and an ADM2 concordance would be inferred.",
           url = "https://www.geoboundaries.org/", attribution = "Boundary source pending"),
         citation = "No boundary geometry is shipped; see boundary_note.",
         access_limits = "No 2021 constituency, region, or village geometry is cached in this build.",
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
       durable_uri = paste0("gs://pow-research-data/raw_sources/ws_census/", fn),
       retrieval_date = retrieval_date, retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
       format = tools::file_ext(fn), bytes = file_bytes(path), sha256 = sha256_file(path),
       source_dataset_id = census_dataset_id, used_in_public_product = TRUE, notes = notes)
}

# --- write product ----------------------------------------------------------

area_summary <- list(
  schema_version = "0.2.0",
  generated_at = stamp, generated_by = script_id, country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code, level = boundary_level,
                      vintage = boundary_vintage, source_dataset_id = boundary_dataset_id),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "No governed Samoa place-of-worship snapshot is included in this census-religion release.",
                       notes = paste("The product ships census-religion metrics only; no constituency geometry and no place-density fields.", boundary_note)),
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

# hard gate: the construct note is present in the shipped product.
product_text <- paste(readLines(summary_json_out, warn = FALSE), collapse = "\n")
if (!grepl(description_sentinel, product_text, fixed = TRUE)) {
  stop("construct note absent from the shipped area-summary product", call. = FALSE)
}

# --- manifest ---------------------------------------------------------------

# region roll-up context: the four statistical regions recorded as parents of the shipped constituencies.
region_rollup <- lapply(region_names, function(rn) {
  rc <- region_child_counts[[rn]]
  list(region = rn, region_code = unname(region_codes[[rn]]),
       region_total = rc[["region_total"]],
       constituencies = rc[["constituencies"]], villages = rc[["villages"]])
})

raw_sources <- list(
  raw_source_record("ws_2021_census_tables.xlsx", workbook_url,
    "2021 census tables workbook; sheet Table 2 is the source of record for the subnational religion counts (national, 4 regions, 51 constituencies, 339 villages; 26 categories)."),
  raw_source_record("ws_2021_final_report.pdf", report_url,
    "2021 Basic Tables report; supplies the verbatim SBS copyright line, the Statistics Act 2015 reference, and a top-six-religion district summary (not the full 26-category table).")
)

deferred_sources <- list(
  list(source = "SBS 2016 Census Brief No.1, Table 5 (Population by type of church affiliation)",
       status = "documented_non_route",
       reason = "National only, by sex, with a Not Stated category; no subnational religion cross-tab in the public briefs. Not a wave."),
  list(source = "SBS 2011 Census tables, Table 20 (Religion by urban-rural residence)",
       status = "documented_non_route",
       reason = "National and urban-rural only; no district or village religion table. PDH 2011 microdata is the only finer route and is not built here. Not a wave."),
  list(source = "SBS 2006 Census, Table 5 (religion by major age groups and sex)",
       status = "documented_non_route",
       reason = "National only, by age; the 2006 subnational Table 2 cross-tabs region, Faipule district and village by age and sex, not by religion. Religion and geography sit on separate 2006 tables. Not a wave."),
  list(source = "339-village religion detail (2021 Table 2 leaf level)",
       status = "deeper_route_preserved",
       reason = "The full 339-village religion table reconciles exactly and is preserved in the git-ignored raw cache (and its durable mirror). It is not shipped as product rows: the constituency level is the primary level a future licensed boundary or concordance will plausibly match. A village product is buildable the moment a licensed 339-village layer is secured."),
  list(source = "2021 constituency / village / region boundary geometry",
       status = "boundary_lane_held",
       reason = boundary_note)
)

validation <- list(
  status = "passed",
  commands = list(
    "Rscript scripts/build_ws_area_summary.R",
    "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/ws/data/area_summary_constituency.json",
    "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/data-manifest.schema.json docs/manifests/ws-census-religion-2021.json",
    "bash scripts/validate_manifests.sh"
  ),
  tests = list(
    "Source integrity: the 2021 workbook and report match their route-probe sha256.",
    "Verbatim frame: 26 category headers read from Table 2; the 26th is NO RELIGION (a real non-affiliation category), so ordinary two-slot semantics hold.",
    "Hierarchical parse reproduces the probe's pinned structure exactly: 1 national, 4 regions, 51 constituencies, 339 villages.",
    "Row-internal: every one of the 395 area rows sums its 26 category totals to its TOTAL column.",
    "Hierarchical reconciliation across all 27 columns: villages roll to constituencies, constituencies to regions, regions to national, zero mismatches.",
    "The two metric slots are exact complements in every constituency row (percent to 100; count to total).",
    "The construct note is present in the shipped product and this manifest."
  ),
  gates = list(
    source_integrity_sha256 = "passed",
    verbatim_frame_no_religion_present = "passed (26th category is NO RELIGION; ordinary two-slot semantics)",
    hierarchy_counts_match_probe = paste0("passed (", n_national, "/", n_region, "/", n_constituency, "/", n_village, ")"),
    row_internal_category_sum_equals_total = "passed (all 395 rows)",
    hierarchical_reconciliation_exact = "passed (village->constituency, constituency->region, region->national; all 27 columns; zero mismatches)",
    metric_slots_exact_complement = "passed",
    single_wave_no_frame_mixing = "passed (only 2021 subnational ships; 2006/2011/2016 documented as non-routes)",
    boundary_lane_held = "passed (no geometry; land_area and place fields null; boundary recorded as documented blocker)",
    no_invented_concordance = "passed (no ADM2 concordance inferred; village detail preserved, not shipped)",
    construct_note_in_product_and_manifest = grepl(description_sentinel, product_text, fixed = TRUE)
  ),
  hierarchy = list(national = n_national, regions = n_region, constituencies = n_constituency, villages = n_village),
  region_rollup = region_rollup,
  national_reconciliation = list(
    national_total = national_total,
    no_religion_count = national_no_religion,
    religious_affiliation_count = national_affiliated,
    religious_affiliation_share_percent = national_affiliation_share,
    no_religion_share_percent = national_no_religion_share,
    category_totals = setNames(as.list(as.integer(national_row[category_ids])), unname(category_verbatim)),
    note = "The national row equals the exact sum of the four regions, the 51 constituencies, and the 339 villages across TOTAL and all 26 categories."
  ),
  stats = list(
    wave = wave, primary_units = n_units,
    region_units = n_region, constituency_units = n_constituency, village_units = n_village,
    rows = length(rows),
    summary_json_bytes = file_bytes(summary_json_out), summary_csv_bytes = file_bytes(summary_csv_out)
  )
)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = "manifest:ws-census-religion:ws:2021:sbs-constituency",
  dataset_id = "ws-census-religion:ws:2021:sbs-constituency",
  dataset_version_id = paste0("ws-census-religion:ws:2021:sbs-constituency:", substr(sha256_file(summary_json_out), 1L, 12L)),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "ws-census-religion", dataset_role = "public_product",
  scope = list(level = "country", country_codes = list(country_code), snapshot_date = NULL, snapshot_anchor = NULL, pipeline_stage = "staged"),
  created_at = stamp, created_by = script_id,
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      waves = list(wave),
      geography = "51 constituency-districts (2021 Faipule/electoral districts) as the primary level; the 4 statistical regions ride as roll-up context and the 339 villages are the preserved deeper route",
      primary_level = boundary_level,
      hierarchy = list(national = 1L, regions = 4L, constituencies = 51L, villages = 339L),
      region_rollup = region_rollup,
      construct = "census affiliation (26-category official frame; a real NO RELIGION category is present, so ordinary affiliation/no-religion slots apply)",
      denominator = "constituency total resident population",
      category_rule = "26 verbatim 2021 categories read from Table 2 and rendered exactly as printed; nothing combined; no small-cell suppression",
      category_frame_verbatim = as.list(unname(category_verbatim)),
      headline_slots = list(
        design = "ordinary two-slot semantics (a real NO RELIGION category is present; the minority-share design of docs/development/minority-share-metric.md does not apply)",
        slot_religious_affiliation_percent = "share reporting any of the 25 religious-affiliation categories (TOTAL minus NO RELIGION)",
        slot_no_religion_percent = "NO RELIGION share, a real census category",
        exact_complement = TRUE,
        religious_change = "not emitted (single subnational wave; 2006/2011/2016 are national or urban-rural only)",
        national_affiliation_share_2021 = national_affiliation_share,
        national_no_religion_share_2021 = national_no_religion_share),
      description_note = description_note,
      territorial_scope = scope_note,
      boundary_status = boundary_note,
      small_cell_treatment = "none; constituency exact counts rendered as published (no SBS suppression rule)",
      wave_coverage = "ONE subnational wave ships (2021). 2006/2011/2016 publish religion only at national or urban-rural level and are recorded in deferred_sources as documented non-routes, never waves.",
      manifest_naming_note = "Named to the shipped span (ws-census-religion-2021.json) per the shipped-wave rule; the family manifest widens only when another real subnational wave is built.",
      local_cache_hint = "Raw SBS workbook, report, and boundary candidates are cached under data/raw/ws_census/ and remain git-ignored.",
      raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/ws_census/ (22 objects mirrored 2026-07-11)"),
      sbs_copyright_verbatim = sbs_copyright_verbatim,
      sbs_ask = "The project-lead use-for-now ruling (PI task 3, 2026-07-11) proceeds under attribution while the PI sends the SBS ask: written reuse confirmation plus a licensed constituency/village boundary layer or a published constituency-to-district concordance.",
      retrieval_routes = list(
        list(purpose = "2021 census tables workbook (Table 2 subnational religion)", method = "GET", url = workbook_url),
        list(purpose = "2021 Basic Tables report (copyright, Statistics Act 2015, top-six district summary)", method = "GET", url = report_url)
      )
    ),
    software_versions = list(
      r = R.version.string, jsonlite = as.character(packageVersion("jsonlite")),
      digest = as.character(packageVersion("digest")), readxl = as.character(packageVersion("readxl"))
    )
  ),
  source = list(
    provider = "Samoa Bureau of Statistics (SBS)",
    source_dataset_ids = list(census_dataset_id, boundary_dataset_id),
    source_urls = list(workbook_url, report_url),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = census_licence_name,
    citation = "Samoa Bureau of Statistics, Population and Housing Census 2021, Table 2: Total population by sex, religion and place of residence.",
    raw_redistribution = "Raw SBS inputs stay git-ignored; only derived aggregate summaries are published. Cached under data/raw/ws_census/, mirrored to gs://pow-research-data/raw_sources/ws_census/.",
    licence_position = "needs_review"
  ),
  input_manifests = list(),
  durable_files = list(
    manifest_file_record(summary_json_out, "Samoa constituency census-religion summary for 2021 (51 constituency-districts; 4 regions as roll-up context); no geometry (boundary lane held)."),
    manifest_file_record(summary_csv_out, "Flattened Samoa constituency census-religion rows, 2021.")
  ),
  raw_sources = raw_sources,
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id, notes = paste0(n_units, " constituency-year rows (2021).")),
    list(uri = paste0("repo:", summary_csv_out), sha256 = sha256_file(summary_csv_out), built_by = script_id, notes = "CSV companion.")
  ),
  target_years = list(wave),
  deferred_sources = deferred_sources,
  construct_notes = list(description_note, scope_note, boundary_note),
  validation = validation,
  privacy = "public", licence_status = "needs_review", licence_basis = licence_basis_slug, downstream_status = "staged",
  source_datasets = source_datasets(),
  notes = "STAGED build: derived constituency area summaries only, no geometry, no page, no hub link. Pakistan no-geometry precedent. The page waits for the conductor's review; the SBS ask (reuse confirmation + a matching boundary layer or concordance) is the unblock."
)
write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)

# --- report -----------------------------------------------------------------

cat(sprintf("SAMOA 2021 constituency census-religion product (STAGED, NO GEOMETRY)\n"))
cat(sprintf("hierarchy: %d national / %d regions / %d constituencies / %d villages\n\n",
            n_national, n_region, n_constituency, n_village))
cat("region roll-up (constituencies / villages / region total):\n")
for (rr in region_rollup) {
  cat(sprintf("  %-18s con=%2d vil=%3d total=%7d\n", rr[["region"]], rr[["constituencies"]], rr[["villages"]], rr[["region_total"]]))
}
cat(sprintf("\nnational total: %d  (affiliated %d = %.4f%%;  NO RELIGION %d = %.4f%%)\n",
            national_total, national_affiliated, national_affiliation_share, national_no_religion, national_no_religion_share))
cat("\nheadline-slot case: ORDINARY (a real NO RELIGION category is present; minority-share design does not apply)\n")
cat("gates: source-integrity, verbatim-frame, hierarchy-counts, row-internal, hierarchical-reconciliation, metric-complement, construct-note = passed\n")
cat("waves: 2021 subnational shipped; 2006/2011/2016 documented non-routes; boundary lane HELD (no geometry)\n")
cat(sprintf("\nfiles written:\n  %s (%d rows, %d bytes)\n  %s (%d bytes)\n  %s (%d bytes)\n",
            summary_json_out, length(rows), file_bytes(summary_json_out),
            summary_csv_out, file_bytes(summary_csv_out),
            manifest_out, file_bytes(manifest_out)))
