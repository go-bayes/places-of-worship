# build the Federated States of Micronesia state census-religion area-summary
# product for 2000, 2010, and 2023 (four states: Yap, Chuuk, Pohnpei, Kosrae).
# inputs (all cached, git-ignored, verified by sha256 in the route probe):
#   data/raw/fm_census/fm_2000_{yap,chuuk,pohnpei,kosrae}.pdf -> Table B10/B10a-d
#     "Marital Status and Religion by ... Usual Residence" (text-extractable counts)
#   data/raw/fm_census/fm_2010_basic_tabulation.xlsx -> Table B09 "Religion by State"
#   data/raw/fm_census/fm_2023_basic_tables.xlsx     -> Table B6 "Religion by State"
#   data/raw/fm_census/geoBoundaries-FSM-ADM1.geojson -> 4-state ADM1 boundary
#   data/raw/fm_census/gb_fsm_adm1_meta.json          -> boundary licence metadata
# every religion table is transcribed verbatim from its cached source (the exact
# cells were extracted and margin-verified before transcription) and reconciled
# against the printed control totals here; the build stops on any margin mismatch
# that is not a documented, disclosed source discrepancy, and never allocates,
# infers, rounds, imputes a suppressed cell, or tunes a value.
# outputs: apps/regions/fm/data/fm_state_2019.geojson,
#   apps/regions/fm/data/area_summary_state.{json,csv}, and
#   docs/manifests/fm-census-religion-2000-2023.json.
# run from the repo root: Rscript scripts/build_fm_area_summary.R
# this is a STAGED product: no page, no hub link; licence needs review pending PI
# task 15 (no reuse terms stated on any wave's religion table; the boundary is
# cleanly CC BY 3.0 IGO).

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "FM"
script_id <- "scripts/build_fm_area_summary.R"
raw_dir <- "data/raw/fm_census"
product_dir <- "apps/regions/fm/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-11"
stamp <- paste0(retrieval_date, "T00:00:00Z")
boundary_level <- "state"
boundary_set_id <- "fm-state-2019-geoboundaries-adm1"

d2000 <- "fm-census-2000-state-reports-table-b10-religion"
d2010 <- "fm-census-2010-basic-tabulation-table-b09-religion"
d2023 <- "fm-census-2023-basic-tables-table-b6-religion"
d_boundary <- "geoboundaries-fsm-adm1-2019"

reports_2000_url <- "https://sdd.spc.int/fm"  # SPC SDD digital library, FSM 2000 state reports
xlsx_2010_url <- "https://stats.gov.fm/download/18/population-statistics/600/fsm-basic-tabulation-2010-census-of-population-and-housing.xlsx"
xlsx_2023_url <- "https://stats.gov.fm/download/18/population-statistics/2210/fsm-basic-tables-2023-population-housing-census.xlsx"
census_hub_url <- "https://stats.gov.fm"
boundary_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/FSM/ADM1/geoBoundaries-FSM-ADM1.geojson"
boundary_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/FSM/ADM1/"

# the four 2000 state-report source urls (see the route-probe retrieval record).
url_2000_yap <- "https://pacificweb.org/wp-content/uploads/2018/05/2000-Yap-Census-Report_Final.pdf"
url_2000_chuuk <- "https://pacificweb.org/wp-content/uploads/2018/05/2000-Chuuk-Census-Report_Final.pdf"
url_2000_pohnpei <- "https://www.pacificweb.org/DOCS/fsm/2000PohnpeiCensus/2000%20Pohnpei%20Census%20Report_Final.pdf"
url_2000_kosrae <- "https://fsm-data.sprep.org/system/files/FSM-2000-Census-Kosrae.pdf"

path_2000_yap <- file.path(raw_dir, "fm_2000_yap.pdf")
path_2000_chuuk <- file.path(raw_dir, "fm_2000_chuuk.pdf")
path_2000_pohnpei <- file.path(raw_dir, "fm_2000_pohnpei.pdf")
path_2000_kosrae <- file.path(raw_dir, "fm_2000_kosrae.pdf")
path_2010 <- file.path(raw_dir, "fm_2010_basic_tabulation.xlsx")
path_2023 <- file.path(raw_dir, "fm_2023_basic_tables.xlsx")
path_2023_factsheet <- file.path(raw_dir, "fm_2023_factsheet.pdf")
boundary_path <- file.path(raw_dir, "geoBoundaries-FSM-ADM1.geojson")
boundary_meta_path <- file.path(raw_dir, "gb_fsm_adm1_meta.json")

boundary_out <- file.path(product_dir, "fm_state_2019.geojson")
summary_json_out <- file.path(product_dir, "area_summary_state.json")
summary_csv_out <- file.path(product_dir, "area_summary_state.csv")
manifest_out <- file.path(manifest_dir, "fm-census-religion-2000-2023.json")

# canonical state order matches the 2010/2023 workbook column order and the
# geoBoundaries feature set; the four display names join shapeName one-to-one.
states <- c("Yap", "Chuuk", "Pohnpei", "Kosrae")
# geoBoundaries ISO 3166-2 code per state, used as the stable join area_code.
state_iso <- c(Yap = "FM-YAP", Chuuk = "FM-TRK", Pohnpei = "FM-PNI", Kosrae = "FM-KSA")

# helper: build a state-named integer vector from values in canonical order.
sv <- function(...) setNames(as.integer(c(...)), states)

# ---- 2000 Table B10/B10a-d (all persons, all ages; eight-way frame) -------------
# transcribed from the four state-report appendix "RELIGION / All persons" blocks.
# source label variants are preserved in the manifest; the canonical frame is used
# for reconciliation. category order below:
cat_2000 <- c("Roman Catholic", "Congregational", "Seventh Day Adventist (SDA)",
              "Baptist", "Latter Day Saints (Mormon)", "Other Religion",
              "Refused", "No Religion")
# vectors run in canonical state order (Yap, Chuuk, Pohnpei, Kosrae).
m2000 <- list(
  `Roman Catholic`              = sv( 9363, 28422, 18439,  141),
  Congregational                = sv(  378, 23074, 12576, 6851),
  `Seventh Day Adventist (SDA)` = sv(   81,   171,   428,  113),
  Baptist                       = sv(   31,   194,   626,  121),
  `Latter Day Saints (Mormon)`  = sv(  121,   362,   471,  169),
  `Other Religion`              = sv(  618,  1346,  1823,  279),
  Refused                       = sv(   37,     6,    11,    3),
  `No Religion`                 = sv(  612,    20,   112,    9)
)
# printed "All persons" state totals from each report's Table B10 religion block.
total_2000 <- sv(11241, 53595, 34486, 7686)
national_2000 <- 107008L

# ---- 2010 Table B09 (all persons, all ages; twelve-way frame) -------------------
cat_2010 <- c("Roman Catholic", "Congregation/Protestant", "Mormon", "Baptist",
              "Seven Day Adventist (SDA)", "Assembly of God", "Apostolic",
              "Pentecostal", "Jehovah Witnesses", "Other religions",
              "No religion", "Refused")
# the workbook prints a Kosrae Apostolic dash ("-") meaning nil; recorded as 0.
m2010 <- list(
  `Roman Catholic`            = sv(9304, 26940, 19833,  153),
  `Congregation/Protestant`   = sv( 796, 20051, 12937, 5762),
  Mormon                      = sv( 208,   466,   659,  253),
  Baptist                     = sv( 206,   190,   617,  132),
  `Seven Day Adventist (SDA)` = sv( 143,   251,   349,   88),
  `Assembly of God`           = sv( 170,    85,   367,   55),
  Apostolic                   = sv(   7,   242,   301,    0),
  Pentecostal                 = sv(  13,   153,   193,  103),
  `Jehovah Witnesses`         = sv( 123,    47,   243,   28),
  `Other religions`           = sv( 114,   177,   278,   11),
  `No religion`               = sv( 281,    25,   389,   28),
  Refused                     = sv(  12,    27,    30,    3)
)
# printed FSM "Total" column per religion (row control for 2010).
total_2010_cat <- c(`Roman Catholic` = 56230L, `Congregation/Protestant` = 39546L,
                    Mormon = 1586L, Baptist = 1145L, `Seven Day Adventist (SDA)` = 831L,
                    `Assembly of God` = 677L, Apostolic = 550L, Pentecostal = 462L,
                    `Jehovah Witnesses` = 441L, `Other religions` = 580L,
                    `No religion` = 723L, Refused = 72L)
total_2010_state <- sv(11377, 48654, 36196, 6616)
national_2010 <- 102843L

# ---- 2023 Table B6 (all persons; eleven-way frame; small cells suppressed) -------
# NA marks a printed "*" cell: "Value is suppressed for confidentiality reasons or
# is zero" (source note). Suppressed cells are rendered null and never imputed,
# even where a margin would recover them.
cat_2023 <- c("Roman Catholic", "Congregation/Protestant", "Assembly of God",
              "Pentecostal", "Apostolic", "Baptist", "SDA", "Mormon",
              "Jehovah's Witness", "Other religion", "No religion/Refused")
NA_ <- NA_integer_
m2023 <- list(
  `Roman Catholic`          = sv( 8449, 18559, 14850,  86),
  `Congregation/Protestant` = sv(  496, 14168,  8894, 4515),
  `Assembly of God`         = sv(  185,   NA_,   337,  61),
  Pentecostal               = sv(   33,    78,   152,  59),
  Apostolic                 = sv(  NA_,   177,   293, NA_),
  Baptist                   = sv(  376,    21,   400, 115),
  SDA                       = sv(   73,   100,   261,  76),
  Mormon                    = sv(  147,   218,   506, 119),
  `Jehovah's Witness`       = sv(  112,    71,    67, NA_),
  `Other religion`          = sv(  480,   444,   238,  32),
  `No religion/Refused`     = sv(  388,    36,   103, NA_)
)
# printed FSM "Total" column per religion (row control for 2023).
total_2023_cat <- c(`Roman Catholic` = 41944L, `Congregation/Protestant` = 28073L,
                    `Assembly of God` = 594L, Pentecostal = 322L, Apostolic = 473L,
                    Baptist = 913L, SDA = 511L, Mormon = 990L,
                    `Jehovah's Witness` = 264L, `Other religion` = 1195L,
                    `No religion/Refused` = 538L)
# printed state "Total" row and the printed national grand total (they disagree by
# one person: the state totals sum to 75,818, the printed national is 75,817).
total_2023_state <- sv(10739, 33885, 26102, 5092)
national_2023_printed <- 75817L

# the documented 2023 discrepancies, disclosed and never repaired:
# 1. national grand total is one below the sum of the four printed state totals.
disc_2023_national_gap <- 1L
# 2. three fully-observed religion rows print a Total one above their four-state
#    sum: Baptist (913 vs 912), SDA (511 vs 510), Other religion (1195 vs 1194).
disc_2023_row_gaps <- c(Baptist = 1L, SDA = 1L, `Other religion` = 1L)
# 3. asterisk-suppressed cells (state index within the canonical order).
disc_2023_suppressed <- list(
  `Assembly of God` = "Chuuk",
  Apostolic = c("Yap", "Kosrae"),
  `Jehovah's Witness` = "Kosrae",
  `No religion/Refused` = "Kosrae"
)

# ---- reconciliation gates (fail-fast; stop, do not tune) ------------------------

# reconcile an all-closing wave: every state column sums to its printed state
# total, every religion row sums to its printed category total (when provided),
# and both margins sum to the printed national grand total.
reconcile_closed <- function(mat, cats, state_totals, national, year, cat_totals = NULL) {
  records <- list()
  for (s in states) {
    col_sum <- sum(vapply(cats, function(c) mat[[c]][[s]], integer(1)))
    if (col_sum != state_totals[[s]]) {
      stop(sprintf("%d state gate FAILED for %s: categories sum %d != printed total %d",
                   year, s, col_sum, state_totals[[s]]), call. = FALSE)
    }
    records[[length(records) + 1L]] <- data.frame(
      year = year, margin = "state_column", key = s,
      computed = col_sum, printed = state_totals[[s]], difference = 0L,
      stringsAsFactors = FALSE)
  }
  if (!is.null(cat_totals)) {
    for (c in cats) {
      row_sum <- sum(mat[[c]])
      if (row_sum != cat_totals[[c]]) {
        stop(sprintf("%d religion-row gate FAILED for %s: four-state sum %d != printed %d",
                     year, c, row_sum, cat_totals[[c]]), call. = FALSE)
      }
      records[[length(records) + 1L]] <- data.frame(
        year = year, margin = "religion_row", key = c,
        computed = row_sum, printed = cat_totals[[c]], difference = 0L,
        stringsAsFactors = FALSE)
    }
  }
  if (sum(state_totals) != national) {
    stop(sprintf("%d grand gate FAILED: state-total sum %d != printed national %d",
                 year, sum(state_totals), national), call. = FALSE)
  }
  do.call(rbind, records)
}

# reconcile the 2023 wave against its documented discrepancies. every observed
# margin must match the printed control exactly, or differ by exactly the
# disclosed amount; suppressed cells must match the disclosed suppression set.
# any other deviation stops the build.
reconcile_2023 <- function() {
  records <- list()
  # verify the suppression pattern matches the disclosed set exactly.
  observed_supp <- list()
  for (c in cat_2023) {
    na_states <- states[is.na(m2023[[c]])]
    if (length(na_states) > 0L) observed_supp[[c]] <- na_states
  }
  if (!identical(lapply(observed_supp, sort), lapply(disc_2023_suppressed, sort))) {
    stop("2023 suppression pattern does not match the disclosed set", call. = FALSE)
  }
  # religion-row margins: printed Total minus the four-state (observed) sum.
  for (c in cat_2023) {
    obs_sum <- sum(m2023[[c]], na.rm = TRUE)
    suppressed <- any(is.na(m2023[[c]]))
    printed <- total_2023_cat[[c]]
    diff <- printed - obs_sum
    if (suppressed) {
      # suppressed rows cannot be closed from printed cells; record, do not assert.
      note <- "suppressed_cell_present_row_not_closable"
    } else {
      expected <- if (c %in% names(disc_2023_row_gaps)) disc_2023_row_gaps[[c]] else 0L
      if (diff != expected) {
        stop(sprintf("2023 religion-row gate FAILED for %s: printed %d - four-state sum %d = %d, disclosed %d",
                     c, printed, obs_sum, diff, expected), call. = FALSE)
      }
      note <- if (expected == 0L) "closes_exactly" else "printed_total_one_above_state_sum_disclosed"
    }
    records[[length(records) + 1L]] <- data.frame(
      year = 2023L, margin = "religion_row", key = c,
      computed = obs_sum, printed = printed, difference = diff,
      note = note, stringsAsFactors = FALSE)
  }
  # national grand margin: the printed national is one below the state-total sum.
  state_sum <- sum(total_2023_state)
  gap <- state_sum - national_2023_printed
  if (gap != disc_2023_national_gap) {
    stop(sprintf("2023 national gap gate FAILED: state-total sum %d - printed national %d = %d, disclosed %d",
                 state_sum, national_2023_printed, gap, disc_2023_national_gap), call. = FALSE)
  }
  records[[length(records) + 1L]] <- data.frame(
    year = 2023L, margin = "national_grand", key = "FSM",
    computed = state_sum, printed = national_2023_printed, difference = gap,
    note = "printed_national_one_below_state_sum_disclosed", stringsAsFactors = FALSE)
  do.call(rbind, records)
}

rec_2000 <- reconcile_closed(m2000, cat_2000, total_2000, national_2000, 2000L)
rec_2010 <- reconcile_closed(m2010, cat_2010, total_2010_state, national_2010, 2010L, total_2010_cat)
rec_2023 <- reconcile_2023()

message(sprintf("gate 2000: PASSED (four states close to %d)", national_2000))
message(sprintf("gate 2010: PASSED (both margins close to %d)", national_2010))
message("gate 2023: PASSED (one-person national gap and three +1 row gaps disclosed; 5 suppressed cells null)")

# ---- boundary ------------------------------------------------------------------

# return a file's SHA-256 digest.
sha256_file <- function(path) unname(tools::sha256sum(path))
# return a file's size in bytes.
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))
# stop when a required cached input is absent or empty.
require_file <- function(path) {
  if (!file.exists(path) || file_bytes(path) == 0L) stop("missing required source: ", path, call. = FALSE)
}
# count rows or features in a generated product.
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$", path)) return(length(fromJSON(path, simplifyVector = FALSE)[["features"]]))
  if (grepl("\\.json$", path)) return(length(fromJSON(path, simplifyVector = FALSE)[["rows"]]))
  NA_integer_
}
# hash each feature's geometry (EWKB) to prove distinctness.
geometry_hashes <- function(layer) {
  vapply(seq_len(nrow(layer)), function(i) {
    digest(st_as_binary(st_geometry(layer)[i], EWKB = TRUE)[[1L]], algo = "sha256", serialize = FALSE)
  }, character(1))
}

required_inputs <- c(path_2000_yap, path_2000_chuuk, path_2000_pohnpei, path_2000_kosrae,
                     path_2010, path_2023, boundary_path, boundary_meta_path)
invisible(lapply(required_inputs, require_file))

# confirm the pinned boundary licence, unit count, and type before use.
boundary_metadata <- fromJSON(boundary_meta_path, simplifyVector = FALSE)
if (!identical(boundary_metadata[["boundaryLicense"]], "Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO)") ||
    !identical(boundary_metadata[["admUnitCount"]], "4") ||
    !identical(boundary_metadata[["boundaryType"]], "ADM1")) {
  stop("geoBoundaries FSM ADM1 licence, unit count, or type metadata changed", call. = FALSE)
}

# FSM-centred equal-area projection for land areas and geometry checks.
fm_laea <- "+proj=laea +lat_0=6 +lon_0=150 +datum=WGS84 +units=m +no_defs"

# join the four census states one-to-one to the geoBoundaries ADM1 features.
build_boundary <- function(path) {
  boundary <- st_read(path, quiet = TRUE, stringsAsFactors = FALSE)
  if (nrow(boundary) != 4L) stop("geoBoundaries FSM ADM1 feature count is not 4", call. = FALSE)
  idx <- match(states, boundary[["shapeName"]])
  if (anyNA(idx) || anyDuplicated(idx) || !setequal(idx, seq_len(4L))) {
    stop("census states and geoBoundaries features do not join one-to-one", call. = FALSE)
  }
  boundary <- boundary[idx, ]
  boundary[["area_name"]] <- states
  boundary[["boundary_source_name"]] <- boundary[["shapeName"]]
  boundary[["area_code"]] <- unname(state_iso[states])
  boundary[["area_unit_id"]] <- paste(boundary_set_id, unname(state_iso[states]), sep = ":")
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- boundary_level
  boundary[["boundary_vintage"]] <- "2019"
  boundary[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(boundary, fm_laea))) / 1e6
  boundary <- st_transform(st_make_valid(boundary), 4326)
  boundary[c("area_code", "area_name", "boundary_source_name", "area_unit_id",
             "boundary_set_id", "boundary_level", "boundary_vintage",
             "land_area_sq_km", "geometry")]
}

boundary <- build_boundary(boundary_path)

# full-extent gate: the bounding box must span the far-southern outlier atolls
# (Pohnpei's Kapingamarangi near 1.03N) and Yap's western outer islands
# (Ulithi/Ngulu near 137.5E), not just the four main high islands.
bbox <- st_bbox(boundary)
if (bbox[["ymin"]] > 1.05 || bbox[["xmin"]] > 137.6 || bbox[["ymax"]] < 10.0 || bbox[["xmax"]] < 163.0) {
  stop("boundary bbox does not span the full FSM extent (missing outer atolls)", call. = FALSE)
}

# simplify with the mandatory helper and re-validate feature count and distinctness.
simplification <- mapshaper_simplify_to_cap(
  boundary, boundary_out,
  max_bytes = 900000L,
  keep_percentages = c(100, 75, 50, 30, 20, 10, 5),
  clean_option = "allow-overlaps"
)
written <- st_read(boundary_out, quiet = TRUE, stringsAsFactors = FALSE)
written <- written[match(boundary[["area_code"]], written[["area_code"]]), ]
if (anyNA(written[["area_code"]])) stop("simplified boundary lost an area code", call. = FALSE)
if (nrow(written) != 4L) stop("simplified boundary does not contain 4 features", call. = FALSE)
w_valid <- st_is_valid(written)
if (any(st_is_empty(written)) || any(is.na(w_valid)) || any(!w_valid)) {
  stop("simplified boundary has empty or invalid geometries", call. = FALSE)
}
geom_hashes <- geometry_hashes(written)
if (length(unique(geom_hashes)) != 4L) stop("simplified boundary geometry hashes are not distinct", call. = FALSE)
message(sprintf("boundary: PASSED (4 valid distinct features, %d bytes at %g%% keep)",
                file_bytes(boundary_out), simplification[["keep_percent"]]))

land_area <- setNames(round(written[["land_area_sq_km"]], 4), written[["area_name"]])
area_unit <- setNames(written[["area_unit_id"]], written[["area_name"]])
area_code <- setNames(written[["area_code"]], written[["area_name"]])

# ---- product rows --------------------------------------------------------------

# the no-religion slot combines the wave's no-religion and non-response cells so
# the series matches 2023's merged "No religion/Refused" line; if any component
# is a suppressed cell (2023 Kosrae) the combined value is null (not imputed).
no_religion_cats <- list(
  `2000` = c("No Religion", "Refused"),
  `2010` = c("No religion", "Refused"),
  `2023` = c("No religion/Refused")
)

flag_common <- "census_affiliation;all_persons_all_ages_universe;no_universe_break_2000_to_2023;broad_affiliation_comparable_across_all_three_waves;denomination_detail_confined_to_2010_2023;licence_needs_review_pending_pi_task_15;boundary_ccby30igo"
flag_2000 <- paste("frame_2000_eight_way",
                   "no_religion_is_no_religion_plus_refused_combined",
                   "denominations_assembly_apostolic_pentecostal_jehovah_folded_into_other_religion",
                   flag_common, sep = ";")
flag_2010 <- paste("frame_2010_twelve_way",
                   "no_religion_is_no_religion_plus_refused_combined",
                   flag_common, sep = ";")
flag_2023 <- paste("frame_2023_eleven_way",
                   "no_religion_is_no_religion_refused_merged_line",
                   "source_national_total_one_below_state_sum_disclosed",
                   "source_row_totals_baptist_sda_other_religion_one_above_state_sum_disclosed",
                   "small_cells_asterisk_suppressed_rendered_null_never_imputed",
                   flag_common, sep = ";")
flag_2023_kosrae <- paste0(flag_2023, ";no_religion_cell_suppressed;affiliation_withheld_because_no_religion_suppressed")

basis_2000 <- paste(
  "2000 FSM Census state-report Table B10/B10a-d 'Marital Status and Religion by",
  "... Usual Residence', all persons of all ages; the denominator is the printed",
  "state All-persons total. Broad affiliation is population minus the combined",
  "No Religion and Refused cells.")
basis_2010 <- paste(
  "2010 FSM Census Basic Tabulation Table B09 'Religion by State of Usual",
  "Residence', all persons; the denominator is the printed state Total. Broad",
  "affiliation is population minus the combined No religion and Refused cells.")
basis_2023 <- paste(
  "2023 FSM Census Basic Tables Table B6 'Religion by State', all persons; the",
  "denominator is the printed state Total. Broad affiliation is population minus",
  "the merged No religion/Refused cell. The Kosrae No religion/Refused cell is",
  "asterisk-suppressed, so both no-religion and affiliation are null for Kosrae",
  "2023 and are never imputed from the national margin.")

# compute the combined no-religion count for a state-wave, or NA when any
# component cell is suppressed.
no_religion_count <- function(mat, year, s) {
  cats <- no_religion_cats[[as.character(year)]]
  parts <- vapply(cats, function(c) mat[[c]][[s]], integer(1))
  if (anyNA(parts)) return(NA_integer_) else return(sum(parts))
}

# build one schema-shaped area-summary row.
make_row <- function(s, year, pop, affiliation, no_religion, flag, basis, dataset_id) {
  aff_pct <- if (is.na(affiliation)) NULL else round(100 * affiliation / pop, 4)
  no_pct <- if (is.na(no_religion)) NULL else round(100 * no_religion / pop, 4)
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = unname(area_unit[[s]]),
    area_code = unname(area_code[[s]]),
    area_name = s,
    year = as.integer(year),
    population_total = as.integer(pop),
    population_total_basis = basis,
    religious_affiliation_count = if (is.na(affiliation)) NULL else as.integer(affiliation),
    religious_affiliation_percent = aff_pct,
    no_religion_count = if (is.na(no_religion)) NULL else as.integer(no_religion),
    no_religion_percent = no_pct,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = unname(land_area[[s]]),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(dataset_id, d_boundary),
    quality_flag = flag
  )
}

waves <- list(
  list(year = 2000L, mat = m2000, totals = total_2000, flag = flag_2000, basis = basis_2000, dataset = d2000),
  list(year = 2010L, mat = m2010, totals = total_2010_state, flag = flag_2010, basis = basis_2010, dataset = d2010),
  list(year = 2023L, mat = m2023, totals = total_2023_state, flag = flag_2023, basis = basis_2023, dataset = d2023)
)

rows <- list()
for (w in waves) {
  for (s in states) {
    pop <- w$totals[[s]]
    no_rel <- no_religion_count(w$mat, w$year, s)
    aff <- if (is.na(no_rel)) NA_integer_ else pop - no_rel
    flag <- if (w$year == 2023L && s == "Kosrae") flag_2023_kosrae else w$flag
    rows[[length(rows) + 1L]] <- make_row(s, w$year, pop, aff, no_rel, flag, w$basis, w$dataset)
  }
}

# ---- area-summary document -----------------------------------------------------

licence_pending <- paste(
  "No reuse licence is stated on the FSM census religion tables in any wave (2000",
  "state reports, 2010 Basic Tabulation, 2023 Basic Tables). The derived state",
  "summaries carry attribution to the FSM Statistics Division (and SPC SDD for the",
  "2000 reports) and ship STAGED pending a PI licence ruling (summaries-not-raw-data",
  "stance). The restricted Pacific Data Hub microdata are unused and do not bind.")

source_datasets <- function() {
  list(
    list(
      source_dataset_id = d2000,
      name = "FSM 2000 Census of Population and Housing, state reports, Table B10/B10a-d: Religion by Usual Residence",
      provider = "FSM Division of Statistics; Secretariat of the Pacific Community, Statistics for Development Division (SPC SDD)",
      url = reports_2000_url, retrieval_date = retrieval_date, local_path = path_2000_kosrae,
      licence = list(name = licence_pending, url = census_hub_url,
                     attribution = "FSM Division of Statistics and SPC SDD, 2000 FSM Census of Population and Housing"),
      citation = "FSM Division of Statistics and SPC SDD, 2000 FSM Census of Population and Housing, state reports (Yap, Chuuk, Pohnpei, Kosrae), Table B10/B10a-d.",
      access_limits = NULL,
      redistribution_limits = "Derived state summaries only; no reuse licence is stated. Ships STAGED pending a PI ruling.",
      notes = paste("All persons, all ages; eight-way frame with distinct No Religion and Refused columns.",
                    "Each state's religion block closes exactly to its printed All-persons total; the four sum to 107,008.",
                    "Source label variants: Kosrae prints 'None'/'Other religion'; Yap, Chuuk, Pohnpei print",
                    "'No Religion'/'Other Religion'; three reports misspell 'Seveth Day Adventist (SDA)'.")),
    list(
      source_dataset_id = d2010,
      name = "FSM Basic Tabulation, 2010 Census of Population and Housing, Table B09: Religion by State of Usual Residence",
      provider = "FSM Statistics Division (stats.gov.fm)",
      url = xlsx_2010_url, retrieval_date = retrieval_date, local_path = path_2010,
      licence = list(name = licence_pending, url = census_hub_url,
                     attribution = "FSM Statistics Division, 2010 FSM Census of Population and Housing"),
      citation = "FSM Statistics Division, Basic Tabulation, 2010 Census of Population and Housing, Table B09.",
      access_limits = NULL,
      redistribution_limits = "Derived state summaries only; no reuse licence is stated. Ships STAGED pending a PI ruling.",
      notes = paste("All persons; twelve-way frame. Both margins close exactly: every religion row and every",
                    "state column sum to the printed national total of 102,843. The Kosrae Apostolic dash is nil (0).")),
    list(
      source_dataset_id = d2023,
      name = "FSM Basic Tables, 2023 Population and Housing Census, Table B6: Religion by State",
      provider = "FSM Statistics Division (stats.gov.fm)",
      url = xlsx_2023_url, retrieval_date = retrieval_date, local_path = path_2023,
      licence = list(name = licence_pending, url = census_hub_url,
                     attribution = "FSM Statistics Division, 2023 FSM Population and Housing Census"),
      citation = "FSM Statistics Division, Basic Tables, 2023 Population and Housing Census, Table B6.",
      access_limits = NULL,
      redistribution_limits = "Derived state summaries only; no reuse licence is stated. Ships STAGED pending a PI ruling.",
      notes = paste("All persons; eleven-way frame with the No religion/Refused line merged. Three documented",
                    "source discrepancies are disclosed and never repaired: the printed national total (75,817) is",
                    "one below the sum of the four printed state totals (75,818); the Baptist (913), SDA (511), and",
                    "Other religion (1,195) row totals are each one above their four-state sum; and small cells",
                    "(Assembly of God in Chuuk; Apostolic in Yap and Kosrae; Jehovah's Witness in Kosrae; No",
                    "religion/Refused in Kosrae) are asterisk-suppressed, rendered null.")),
    list(
      source_dataset_id = d_boundary,
      name = "geoBoundaries FSM ADM1 (4 states)",
      provider = "geoBoundaries (William & Mary geoLab); source OCHA ROP, FSM Division of Statistics, SPC SDD",
      url = boundary_url, retrieval_date = retrieval_date, local_path = boundary_path,
      licence = list(name = "Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO)", url = boundary_meta_url,
                     attribution = "geoBoundaries (gbOpen); boundary source OCHA ROP, FSM Division of Statistics, SPC SDD"),
      citation = "geoBoundaries FSM ADM1 (gbOpen, pinned 9469f09), 4 state boundaries.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary is committed with CC BY 3.0 IGO attribution.",
      notes = paste("4 ADM1 states (Yap, Chuuk, Pohnpei, Kosrae), boundaryYearRepresented 2019, joined one-to-one",
                    "on shapeName with no concordance needed. The extent spans longitude 137.5E (Yap outer islands)",
                    "to 163.0E (Kosrae) and latitude 1.0N (Pohnpei's Kapingamarangi) to 10.1N."))
  )
}

indicators <- function() {
  list(
    list(indicator_id = "population_total", label = "Census population total",
         description = "State all-persons population represented in the wave's religion table.",
         unit = "count", denominator_indicator_id = NULL,
         method = "Printed state All-persons total: 2000 Table B10, 2010 Table B09, 2023 Table B6.",
         temporal_coverage = "2000; 2010; 2023", spatial_coverage = "FSM states (4)",
         quality_notes = "Every wave counts all persons of all ages; there is no universe break, so state denominators are directly comparable across 2000-2023. The population falls from 107,008 to 102,843 to 75,817, driven by Chuuk out-migration; this is a population change, never a religion change."),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
         description = "Share of the state population with a stated religious affiliation (broad, all bodies).",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (population - combined no-religion/refused) / population. Comparable across all three waves at the broad-affiliation level; null for Kosrae 2023 (suppressed no-religion cell).",
         temporal_coverage = "2000; 2010; 2023", spatial_coverage = "FSM states (4)",
         quality_notes = "Broad affiliation is comparable across all three waves because every wave counts all persons and the denominational split-out of Assembly of God, Apostolic, Pentecostal, and Jehovah's Witness from 2000's Other Religion does not change the has-a-religion total. Denomination-level change is limited to the matched 2010-2023 pair."),
    list(indicator_id = "no_religion_percent", label = "No religious affiliation %",
         description = "Share reporting no religion or refusing to answer (combined to match the 2023 merged line).",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (No religion + Refused) / population for 2000 and 2010; 100 * (No religion/Refused) / population for 2023. Null for Kosrae 2023 (suppressed).",
         temporal_coverage = "2000; 2010; 2023", spatial_coverage = "FSM states (4)",
         quality_notes = "2000 and 2010 print separate No religion and Refused lines; 2023 merges them. The combined slot mixes persons with no religion and non-response and is used for comparability with the 2023 merged line.")
  )
}

visual_layers <- function() {
  list(
    list(visual_layer_id = "fm-state-religious-affiliation", label = "Religious affiliation %",
         description = "FSM census-affiliation share by state.", layer_type = "choropleth",
         indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "state all-persons total"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "reported state value", uncertainty_display = "quality_flag",
         default_visibility = TRUE,
         notes = "Census affiliation, not practice, attendance, or membership. Comparable across all three waves at the broad-affiliation level. Kosrae 2023 is null (suppressed no-religion cell)."),
    list(visual_layer_id = "fm-state-no-religion", label = "No religious affiliation %",
         description = "FSM combined no-religion/refused share by state.", layer_type = "choropleth",
         indicator_ids = list("no_religion_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "state all-persons total"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "reported state value", uncertainty_display = "quality_flag",
         default_visibility = FALSE,
         notes = "Combines No religion and Refused to match the 2023 merged line; mixes no-religion with non-response. Kosrae 2023 is null (suppressed).")
  )
}

summary_product <- list(
  schema_version = "area-summary.v1", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code,
                      level = boundary_level, vintage = "2019", source_dataset_id = d_boundary),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "No governed place-of-worship snapshot ships in the FSM census product.",
                       notes = "Place counts and density metrics remain null."),
  source_datasets = source_datasets(), indicators = indicators(),
  visual_layers = visual_layers(), rows = rows
)

write_json(summary_product, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(summary_json_out, warn = FALSE), collapse = "\n"))) {
  stop("area-summary JSON is invalid", call. = FALSE)
}

# flatten rows to the CSV companion.
flatten_rows <- function(rows) {
  do.call(rbind, lapply(rows, function(r) {
    data.frame(
      country_code = r[["country_code"]], boundary_set_id = r[["boundary_set_id"]],
      boundary_level = r[["boundary_level"]], area_unit_id = r[["area_unit_id"]],
      area_code = r[["area_code"]], area_name = r[["area_name"]], year = r[["year"]],
      population_total = r[["population_total"]], population_total_basis = r[["population_total_basis"]],
      religious_affiliation_count = if (is.null(r[["religious_affiliation_count"]])) NA_integer_ else r[["religious_affiliation_count"]],
      religious_affiliation_percent = if (is.null(r[["religious_affiliation_percent"]])) NA_real_ else r[["religious_affiliation_percent"]],
      no_religion_count = if (is.null(r[["no_religion_count"]])) NA_integer_ else r[["no_religion_count"]],
      no_religion_percent = if (is.null(r[["no_religion_percent"]])) NA_real_ else r[["no_religion_percent"]],
      place_count = NA_integer_, places_per_10000_residents = NA_real_,
      place_density_per_sq_km = NA_real_, land_area_sq_km = r[["land_area_sq_km"]],
      site_snapshot_date = NA_character_, place_count_basis = NA_character_,
      source_dataset_ids = paste(unlist(r[["source_dataset_ids"]]), collapse = "|"),
      quality_flag = r[["quality_flag"]], stringsAsFactors = FALSE
    )
  }))
}
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

# ---- manifest ------------------------------------------------------------------

# record one cached source with its retrieval hash and durable mirror.
raw_source_record <- function(path, url, format, used, periods, dataset_id, notes) {
  list(uri = path, url = url, format = format, bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = NULL, source_dataset_id = dataset_id, used_in_public_product = used,
       periods = periods, notes = notes,
       local_cache_hint = paste0(path, " (git-ignored by .gitignore data/ rule)"),
       raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/fm_census/"))
}

# record one generated file in the manifest.
durable_file_record <- function(path, content, licence_status_value, licence_basis_value) {
  list(uri = paste0("repo:", path), storage_provider = "git_repository", format = sub("^.*\\.", "", path),
       bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = if (grepl("area_summary|\\.csv$", path)) row_count_file(path) else NULL,
       feature_count = if (grepl("\\.geojson$", path)) row_count_file(path) else NULL,
       content = content, privacy = "public",
       licence_status = licence_status_value, licence_basis = licence_basis_value)
}

licence_basis_slug <- "fsm_statistics_division_no_stated_terms_pending_pi_task_15"

raw_sources <- list(
  raw_source_record(path_2000_yap, url_2000_yap, "pdf", TRUE, "2000", d2000,
    "2000 Yap state report; Table B10 religion block closes to the printed All-persons total of 11,241."),
  raw_source_record(path_2000_chuuk, url_2000_chuuk, "pdf", TRUE, "2000", d2000,
    "2000 Chuuk state report; Table B10/B10a-d religion block closes to the printed All-persons total of 53,595."),
  raw_source_record(path_2000_pohnpei, url_2000_pohnpei, "pdf", TRUE, "2000", d2000,
    "2000 Pohnpei state report; Table B10 religion block closes to the printed All-persons total of 34,486."),
  raw_source_record(path_2000_kosrae, url_2000_kosrae, "pdf", TRUE, "2000", d2000,
    "2000 Kosrae state report; Table B10 religion block closes to the printed All-persons total of 7,686."),
  raw_source_record(path_2010, xlsx_2010_url, "xlsx", TRUE, "2010", d2010,
    "2010 Basic Tabulation; Table B09 Religion by State. Both margins close to 102,843. Kosrae Apostolic dash is nil."),
  raw_source_record(path_2023, xlsx_2023_url, "xlsx", TRUE, "2023", d2023,
    "2023 Basic Tables; Table B6 Religion by State. National total 75,817 is one below the state-total sum 75,818; Baptist/SDA/Other religion row totals are one above their four-state sums; five small cells asterisk-suppressed."),
  raw_source_record(path_2023_factsheet, "https://stats.gov.fm/download/74/2023-phc-ig-and-tables/2108/2023-fsm-census-factsheet.pdf", "pdf", FALSE, "2023", d2023,
    "2023 FSM Census factsheet; contextual, not a table source."),
  raw_source_record(boundary_path, boundary_url, "geojson", TRUE, "2019", d_boundary,
    "geoBoundaries FSM ADM1 GeoJSON; 4 states, CC BY 3.0 IGO. Pinned commit 9469f09."),
  raw_source_record(boundary_meta_path, boundary_meta_url, "json", FALSE, "2019", d_boundary,
    "geoBoundaries FSM ADM1 metadata; records CC BY 3.0 IGO, boundarySource 'OCHA ROP, FSM Division of Statistics, SPC SDD', admUnitCount 4.")
)

dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)
dataset_id <- "fm-census-religion:fm:2000-2023:statistics-division-state"

reconciliation_block <- function(rec) {
  lapply(seq_len(nrow(rec)), function(i) as.list(rec[i, ]))
}

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = paste0("manifest:", dataset_id),
  dataset_id = dataset_id,
  dataset_version_id = paste0(dataset_id, ":", dataset_hash),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "fm-census-religion", dataset_role = "staged_evidence",
  scope = list(level = "country", country_codes = list("FM"), snapshot_date = NULL,
               snapshot_anchor = NULL, pipeline_stage = "staged"),
  created_at = stamp, created_by = script_id,
  target_years = list(2000L, 2010L, 2023L),
  pipeline = list(
    script = script_id, git_commit = NULL, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation",
      shipped_waves = list(2000L, 2010L, 2023L),
      shipped_geography = "4 FSM states (Yap, Chuuk, Pohnpei, Kosrae)",
      boundary_set = boundary_set_id,
      source_tables = list(
        `2000` = "State-report Table B10/B10a-d Marital Status and Religion by Usual Residence (all persons, all ages)",
        `2010` = "Basic Tabulation Table B09 Religion by State of Usual Residence (all persons)",
        `2023` = "Basic Tables Table B6 Religion by State (all persons)"
      ),
      universes = list(
        `2000` = "all persons, all ages",
        `2010` = "all persons, all ages",
        `2023` = "all persons, all ages"
      ),
      denominators = list(
        `2000` = "printed state All-persons total; affiliation = population minus (No Religion + Refused)",
        `2010` = "printed state Total; affiliation = population minus (No religion + Refused)",
        `2023` = "printed state Total; affiliation = population minus (No religion/Refused); null for Kosrae (suppressed)"
      ),
      category_frames = list(
        `2000` = as.list(cat_2000),
        `2010` = as.list(cat_2010),
        `2023` = as.list(cat_2023),
        alignment_note = paste(
          "All three waves share one all-persons universe, so there is no universe break and broad affiliation is",
          "comparable across the full 2000-2023 span. The 2000 eight-way frame folds Assembly of God, Apostolic,",
          "Pentecostal, and Jehovah's Witness into 'Other Religion'; 2010 and 2023 split them out. Denomination-level",
          "change is therefore confined to the matched 2010-2023 pair; only broad affiliation is published across all",
          "three waves. The always-separate spine (Roman Catholic, Congregation/Protestant, SDA, Baptist, Mormon) is",
          "comparable across all three. Frames are preserved verbatim per wave and never merged. 2000 source label",
          "variants: Kosrae prints 'None' and 'Other religion' where Yap/Chuuk/Pohnpei print 'No Religion' and 'Other",
          "Religion', and three reports misspell 'Seveth Day Adventist (SDA)'."
        )
      ),
      change_rule = paste(
        "Broad religious-affiliation change is readable across all three waves (2000, 2010, 2023) because every wave",
        "counts all persons of all ages with no universe break. Denomination-level change is limited to the matched",
        "2010-2023 pair (2000 folds four bodies into Other Religion). The sharp population decline (107,008 to 102,843",
        "to 75,817, driven by Chuuk out-migration) is read within each state's own wave denominator and is never",
        "treated as a religion change."
      ),
      no_religion_treatment = list(
        `2000` = "combined No Religion + Refused, verbatim labels; mixes no-religion with non-response",
        `2010` = "combined No religion + Refused, verbatim labels; mixes no-religion with non-response",
        `2023` = "single merged No religion/Refused line; null for Kosrae (asterisk-suppressed, never imputed)"
      ),
      documented_source_discrepancies_2023 = list(
        national_total_gap = paste(
          "The printed national total (75,817) is one below the sum of the four printed state totals",
          "(10,739 + 33,885 + 26,102 + 5,092 = 75,818). The printed values govern; the one-person gap is disclosed",
          "and never absorbed into any state row (no product row is the national total)."
        ),
        religion_row_gaps = paste(
          "Three fully-observed religion rows print a Total one above their four-state sum: Baptist (913 vs 912),",
          "SDA (511 vs 510), and Other religion (1,195 vs 1,194). Disclosed, never repaired; these rows are not summed",
          "into any state product row."
        ),
        suppressed_cells = paste(
          "Small cells are asterisk-suppressed ('Value is suppressed for confidentiality reasons or is zero'):",
          "Assembly of God in Chuuk; Apostolic in Yap and Kosrae; Jehovah's Witness in Kosrae; No religion/Refused",
          "in Kosrae. They are rendered null and never imputed, even where a national margin would recover the value",
          "(the MONSTAT z precedent)."
        )
      ),
      microdata_position = paste(
        "The Pacific Data Hub microdata records (catalog/109 for 2000, catalog/9 for 2010, catalog/806 for 2022/2023)",
        "are restricted (confidentiality declaration required under FSM Public Law 5-77) and are unused; the build",
        "reads only the published aggregate tables, so those restrictions do not bind the product (the Nauru reasoning)."
      ),
      omitted_metrics = list("places_per_10000_residents", "place_density_per_sq_km"),
      boundary_simplification = simplification,
      local_cache_hint = "All raw sources are cached under data/raw/fm_census/ and remain git-ignored.",
      retrieval_record = raw_sources
    ),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")), digest = as.character(packageVersion("digest")),
      mapshaper = "scripts/lib/simplify_boundary.R (npx mapshaper)"
    )
  ),
  source = list(
    provider = "FSM Statistics Division (Division of Statistics / National Statistics Office); SPC SDD (2000 reports); geoBoundaries (William & Mary geoLab)",
    source_dataset_ids = list(d2000, d2010, d2023, d_boundary),
    source_urls = list(reports_2000_url, xlsx_2010_url, xlsx_2023_url, census_hub_url, boundary_url, boundary_meta_url),
    retrieved_at = stamp,
    licence = paste(
      "No reuse licence is stated on the FSM census religion tables in any wave; a stats.gov.fm/terms-of-use page",
      "returns 404 and the 2000 state reports carry no rights statement. The derived state summaries carry attribution",
      "to the FSM Statistics Division (and SPC SDD for 2000) and ship STAGED pending a PI licence ruling (task 15) under",
      "the summaries-not-raw-data stance (as with Cote d'Ivoire, Iran, and Palau). The restricted Pacific Data Hub",
      "microdata are unused and non-binding (the Nauru reasoning). Boundaries are geoBoundaries FSM ADM1, Creative",
      "Commons Attribution 3.0 IGO, boundary source OCHA ROP, FSM Division of Statistics, and SPC SDD."
    ),
    citation = "FSM 2000 state reports Table B10/B10a-d; 2010 Basic Tabulation Table B09; 2023 Basic Tables Table B6; geoBoundaries FSM ADM1 (gbOpen).",
    raw_redistribution = "The census PDFs, workbooks, and the geoBoundaries source GeoJSON are not committed; they remain in data/raw/fm_census/.",
    local_cache_hint = "data/raw/fm_census/ (git-ignored by .gitignore data/ rule)"
  ),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = list(
    durable_file_record(summary_json_out, "FSM 4-state census-affiliation area summary for 2000, 2010, 2023.", "needs_review", licence_basis_slug),
    durable_file_record(summary_csv_out, "Flattened FSM 4-state census-affiliation rows for 2000, 2010, 2023.", "needs_review", licence_basis_slug),
    durable_file_record(boundary_out, "Simplified geoBoundaries FSM ADM1 4-state boundary GeoJSON.", "accepted", "geoboundaries_ccby30igo")
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id,
         notes = "4 states x 3 waves = 12 rows; all-persons universe in every wave; Kosrae 2023 affiliation and no-religion null (suppressed)."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out), built_by = script_id,
         notes = "4 state features from geoBoundaries FSM ADM1, simplified with mapshaper weighted keep-shapes.")
  ),
  validation = list(
    status = "passed_with_warnings",
    commands = list(
      paste("Rscript", script_id),
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/fm/data/area_summary_state.json",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/data-manifest.schema.json docs/manifests/fm-census-religion-2000-2023.json",
      "bash scripts/validate_manifests.sh"
    ),
    gate_2000 = list(status = "passed", national_close_to = national_2000,
                     state_column_checks = 4L, religion_row_checks = 0L,
                     records = reconciliation_block(rec_2000)),
    gate_2010 = list(status = "passed", both_margins_close_to = national_2010,
                     state_column_checks = 4L, religion_row_checks = length(cat_2010),
                     records = reconciliation_block(rec_2010)),
    gate_2023 = list(status = "passed_with_disclosed_discrepancies",
                     national_printed = national_2023_printed,
                     state_total_sum = sum(total_2023_state),
                     national_one_person_gap = disc_2023_national_gap,
                     row_gaps_disclosed = as.list(disc_2023_row_gaps),
                     suppressed_cells = disc_2023_suppressed,
                     records = reconciliation_block(rec_2023)),
    boundary_validation = list(status = "passed", feature_count = 4L, distinct_geometry_hashes = length(unique(geom_hashes)),
                               geometry_hashes = as.list(geom_hashes),
                               bbox = list(xmin = unname(bbox[["xmin"]]), ymin = unname(bbox[["ymin"]]),
                                           xmax = unname(bbox[["xmax"]]), ymax = unname(bbox[["ymax"]])),
                               full_extent_note = "bbox spans lon 137.5-163.0E and lat 1.0-10.1N, covering Yap's Ulithi/Ngulu outer islands and Pohnpei's Kapingamarangi/Nukuoro southern atolls; a main-high-island bbox would drop them",
                               output_bytes = file_bytes(boundary_out), simplification = simplification,
                               licence = boundary_metadata[["boundaryLicense"]], adm_unit_count = boundary_metadata[["admUnitCount"]]),
    join_coverage = list(matched_states = 4L, expected_states = 4L, unmatched_states = list(), unused_boundary_features = list()),
    notes = paste(
      "2000 four state columns close exactly to the printed All-persons totals and sum to 107,008. 2010 both margins",
      "(every religion row and every state column) close exactly to 102,843. 2023 carries three disclosed source",
      "discrepancies unrepaired (one-person national gap; three +1 religion-row totals; five suppressed cells rendered",
      "null). Boundary joins 4/4 to geoBoundaries FSM ADM1 with 4 distinct geometry hashes."
    ),
    warnings = list(
      "STAGED product: no page, no hub link. Licence needs review pending PI task 15; no reuse terms are stated on any wave's religion table.",
      "2023 Table B6 has three documented source discrepancies disclosed and never repaired: national total 75,817 is one below the state-total sum 75,818; Baptist/SDA/Other religion row totals are one above their four-state sums; five small cells are asterisk-suppressed and rendered null.",
      "Kosrae 2023 religious affiliation and no-religion are null because the No religion/Refused cell is suppressed; the value is not imputed from the national margin.",
      "Broad-affiliation change is comparable across all three waves; denomination-level change is limited to the matched 2010-2023 pair (2000 folds four bodies into Other Religion).",
      "The 2023 probe brief stated only two source discrepancies (one-person national gap; suppression); the builder additionally found and discloses the Baptist/SDA/Other religion +1 row-total gaps against the four-state sums."
    )
  ),
  construct_notes = list(
    "The construct is census affiliation: each resident's reported religion (2000-2023 questionnaire religion item, asked of all persons regardless of age and sex), not practice, attendance, or membership.",
    "The public product carries three headline fields per state-wave: population total, religious affiliation percent, and broad no-religion percent. Place-density metrics are null (no governed place-of-worship snapshot).",
    "Every wave counts all persons of all ages, so there is no universe break and the state denominators are directly comparable across 2000, 2010, and 2023. Broad religious affiliation is therefore comparable across the full span.",
    "The 2000 eight-way frame folds Assembly of God, Apostolic, Pentecostal, and Jehovah's Witness into 'Other Religion'; 2010 and 2023 split them out. Denomination-level change is confined to the matched 2010-2023 pair; only broad affiliation is published across all three waves. Frames are preserved verbatim per wave and never merged.",
    "No-religion slot: 2000 and 2010 print separate No religion and Refused lines, combined here to match 2023's single merged No religion/Refused line. The combined slot mixes persons with no religion and refusals to answer.",
    "2023 Table B6 documented source facts, disclosed and never repaired: the printed national total (75,817) is one below the sum of the four printed state totals (75,818); the Baptist (913), SDA (511), and Other religion (1,195) row totals are each one above their four-state sums; and five small cells are asterisk-suppressed (rendered null, never imputed). Kosrae 2023 affiliation and no-religion are null in consequence.",
    "The population falls sharply across the span (107,008 to 102,843 to 75,817), driven by Chuuk out-migration. The build reads religious shares within each state's own wave denominator and never treats the population decline as a religion change.",
    "Boundary: geoBoundaries FSM ADM1, 4 states, CC BY 3.0 IGO. The four states join one-to-one on shapeName with no concordance needed. The full extent spans longitude 137.5E (Yap's Ulithi/Ngulu outer islands) to 163.0E (Kosrae) and latitude 1.0N (Pohnpei's Kapingamarangi and Nukuoro southern atolls) to 10.1N; a bounding box around the four main high islands would drop the outer atolls."
  ),
  deferred_sources = list(
    list(source_dataset_id = "fm-census-1994-1973-religion-by-state", status = "deferred",
         url = reports_2000_url, local_path = NULL,
         notes = paste("Religion was asked in the 1973 (Trust Territory), 1994, and 2000 FSM censuses. The 2000 state",
                       "reports print 1973/1994/2000 comparisons at state level (Table 7.1) and 1994/2000 at municipality",
                       "level (Table 7.2) in percentages, not counts, and on the older Trust Territory geography for 1973.",
                       "Extending the series before 2000 needs the 1994 and 1973 count tables located and their frames",
                       "reconciled; a future-research route.")),
    list(source_dataset_id = "fm-census-2010-2023-denomination-series", status = "deferred",
         url = NULL, local_path = NULL,
         notes = "A denomination-level time series is a 2010-2023 matter (shared split-out frame); it is not shipped in this broad-affiliation product."),
    list(source_dataset_id = "fm-census-2000-2023-municipality-level", status = "deferred",
         url = NULL, local_path = NULL,
         notes = "The 2000 appendix tables carry municipality-within-state detail; the 2010/2023 workbooks publish only state level. A municipality product is not verified as public for 2010/2023 and is not shipped."),
    list(source_dataset_id = "fm-statistics-division-licence-confirmation", status = "not_pinned",
         url = census_hub_url, local_path = NULL,
         notes = "An FSM Statistics Division reuse-confirmation email is the clean unblock for the licence gate (PI task 15); none is held.")
  ),
  privacy = "public",
  licence_status = "needs_review",
  licence_basis = licence_basis_slug,
  downstream_status = "staged",
  source_datasets = source_datasets(),
  notes = paste(
    "STAGED product (no page, no hub link) pending a PI licence ruling (task 15). The committed products are the",
    "derived 4-state area summary (12 rows across 2000, 2010, 2023) and the simplified geoBoundaries FSM ADM1 boundary.",
    "On-page attribution, when a page is built, must cite the FSM Statistics Division (and SPC SDD for the 2000 reports)",
    "and geoBoundaries (CC BY 3.0 IGO, OCHA ROP / FSM Division of Statistics / SPC SDD)."
  )
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

cat("waves shipped: 2000, 2010, 2023 (all persons) on 4 FSM states\n")
cat(sprintf("rows: %d (4 states x 3 waves)\n", length(rows)))
cat(sprintf("gate 2000: passed; four states close to %d\n", national_2000))
cat(sprintf("gate 2010: passed; both margins close to %d\n", national_2010))
cat(sprintf("gate 2023: passed with disclosed discrepancies; national %d vs state-sum %d (gap %d); row gaps Baptist/SDA/Other +1; 5 cells suppressed\n",
            national_2023_printed, sum(total_2023_state), disc_2023_national_gap))
cat(sprintf("boundary gate: passed; 4/4 join, %d distinct geometry hashes, %d bytes at %g%% keep\n",
            length(unique(geom_hashes)), file_bytes(boundary_out), simplification[["keep_percent"]]))
cat("change: broad affiliation comparable across all three waves; denomination change 2010-2023 only\n")
cat("licence gate: needs_review; STAGED pending PI task 15; no reuse terms stated on any wave\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", boundary_out))
cat(sprintf("wrote %s\n", manifest_out))
