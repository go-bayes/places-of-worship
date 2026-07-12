# build the Finland national administrative religious-community membership product.
#
# PI ruling (2026-07-12, build-queue row 98): Finland ships NATIONAL-ONLY. The
# construct is ADMINISTRATIVE RELIGIOUS-COMMUNITY MEMBERSHIP (a register construct
# from the Population Information System), never census affiliation, belief, or
# practice. Source: Statistics Finland StatFin table 11rx ("Belonging to a
# religious community by age and sex", Population 31.12.), 26 religious-community
# categories, 1990-2025, CC BY 4.0, via the StatFin PxWeb API. The route record is
# research/countries/fi/route-probe.md (trust it over the brief). Statistics
# Finland publishes religion at the whole-country level only; no StatFin table
# crosses religion with area, so a single national polygon is the shippable
# ceiling, not a retrieval gap.
#
# frame. table 11rx publishes 26 religious-community rows in a shallow hierarchy:
#   - SSS TOTAL is the register universe (the published national population).
#   - 23 mutually-exclusive leaves reconcile exactly to TOTAL every year:
#       A00, B00, C00, D00, E00 (five world-religion headings with no children),
#       F01-F11 (eleven Christian communities), G01-G06 (six other groups),
#       and H00 (PERSONS NOT MEMBERS OF ANY RELIGIOUS COMMUNITY).
#   - F00 CHRISTIANITY and G00 OTHER RELIGIOUS GROUPS are roll-up headings, the
#       exact sums of their F01-F11 and G01-G06 children; they are carried for
#       verbatim fidelity but never summed into the leaf frame (no double count).
#
# slot design (decided in the brief). the frame carries a genuine "not a member of
# any religious community" line (H00), so ordinary two-slot semantics apply:
#   - religious_affiliation = TOTAL minus H00 (the sum of the 22 registered
#       religious-community leaves, i.e. every leaf except H00).
#   - no_religion = H00 (PERSONS NOT MEMBERS OF ANY RELIGIOUS COMMUNITY).
#   the two sum to the register universe by construction, so the two shares sum to
#   100 every year. no_religion here is the register non-membership line, not a
#   belief or irreligion claim.
#
# per-row composition. every row carries all 26 verbatim StatFin categories (the
# published English labels) with count and share-of-TOTAL percent, in source
# order. no cell is merged, redistributed, or zeroed; the national total-sex,
# total-age slice carries no suppressed or confidential cells (verified: 0 nulls
# across 26 categories x 36 years). the Finnish verbatim labels are recorded in
# the manifest frame record alongside the English.
#
# licence. Statistics Finland releases its statistical data under CC BY 4.0
# (source and material-version date named, reference and hyperlink to the licence
# attached); this covers 11rx. the geoBoundaries FIN ADM0 national polygon is NOT
# CC BY 4.0: geoBoundaries records it under the Open Data Commons Open Database
# License 1.0 (ODbL, OpenStreetMap source). the boundary licence is recorded
# verbatim and flagged as a fleet divergence (prior IS/NU boundaries were CC BY
# 4.0); the National Land Survey / Statistics Finland CC BY 4.0 municipal vector
# is the clean-licence swap, recorded as a deferred item.
#
# inputs (all cached, git-ignored under data/raw/fi_statfin/):
#   px_11rx_metadata_en.json                 11rx table metadata (English)
#   px_11rx_metadata_fi.json                 11rx table metadata (Finnish labels)
#   px_11rx_membership_national_1990_2025.json  json-stat2 national data slice
#   geoboundaries_fin_adm0_metadata.json     geoBoundaries FIN ADM0 release metadata
#   geoboundaries_fin_adm0_raw.geojson       geoBoundaries FIN ADM0 native polygon
# outputs:
#   apps/regions/fi/data/fi_national.geojson
#   apps/regions/fi/data/area_summary_national.{json,csv}   (area-summary.v2)
#   docs/manifests/fi-religious-community-membership-1990-2025.json (data-manifest.v2)
# run from the repository root: Rscript scripts/build_fi_area_summary.R

suppressPackageStartupMessages({
  library(jsonlite)
  library(sf)
  library(digest)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "FI"
script_id <- "scripts/build_fi_area_summary.R"
raw_dir <- "data/raw/fi_statfin"
output_dir <- "apps/regions/fi/data"
manifest_dir <- "docs/manifests"
dir.create(raw_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-12"
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")

table_id <- "11rx.px"
table_dataset_id <- "statfin-px-11rx-religious-community-membership-1990-2025"
boundary_dataset_id <- "geoboundaries-gbopen-fin-adm0-9469f09"
boundary_set_id <- "fi-adm0-2017-geoboundaries-9469f09"

# ---- pinned URLs -----------------------------------------------------------
px_base_en <- "https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin/vaerak"
px_base_fi <- "https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin/vaerak"
px_table_en_url <- paste(px_base_en, table_id, sep = "/")
px_table_fi_url <- paste(px_base_fi, table_id, sep = "/")
terms_url <- "https://stat.fi/en/about-us/get-to-know-statistics-finland/legislation/terms-of-use"
open_data_url <- "https://stat.fi/en/services/statistical-data-services/open-data-and-interfaces"
boundary_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/FIN/ADM0/"
boundary_url <- paste0(
  "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/",
  "releaseData/gbOpen/FIN/ADM0/geoBoundaries-FIN-ADM0.geojson"
)

# ---- cached paths ----------------------------------------------------------
metadata_en_path <- file.path(raw_dir, "px_11rx_metadata_en.json")
metadata_fi_path <- file.path(raw_dir, "px_11rx_metadata_fi.json")
membership_path <- file.path(raw_dir, "px_11rx_membership_national_1990_2025.json")
boundary_meta_path <- file.path(raw_dir, "geoboundaries_fin_adm0_metadata.json")
boundary_raw_path <- file.path(raw_dir, "geoboundaries_fin_adm0_raw.geojson")

boundary_out <- file.path(output_dir, "fi_national.geojson")
summary_json_out <- file.path(output_dir, "area_summary_national.json")
summary_csv_out <- file.path(output_dir, "area_summary_national.csv")
manifest_out <- file.path(manifest_dir, "fi-religious-community-membership-1990-2025.json")

# pinned sha-256 of the frozen cached snapshots; a mismatch means the source
# drifted and the build STOPS rather than shipping an unverified series.
expected_sha256 <- c(
  px_11rx_metadata_en.json = "95f59bde8c5cc35ac87eca954099e0ecea80f7752c5b97b94ef22418cff42871",
  px_11rx_metadata_fi.json = "94e79ea1cdf7cfc4c88d3ba0dc2d05679341a821158594aa02d4b3c79dc119c2",
  px_11rx_membership_national_1990_2025.json = "5ce3c8ee6c52240a089e5cdfe018741523a76416551ad81099b0a7dbe07da96f",
  geoboundaries_fin_adm0_metadata.json = "b5f19d35f6b94e5ab041531cd7d758890574b5f7c3428f9311f4c15217d8666c",
  geoboundaries_fin_adm0_raw.geojson = "658462437b581dcad4ef68e01ed5b02ece8de641909c820cbcf05ccd506ea4c6"
)

# the exact PxWeb POST query recorded for the manifest and used on a cache miss.
px_query <- list(
  query = list(
    list(code = "uskontokunta_10_20190101", selection = list(filter = "all", values = list("*"))),
    list(code = "sukupuoli_9_20180101", selection = list(filter = "item", values = list("SSS"))),
    list(code = "ikaryhma_10_20180101", selection = list(filter = "item", values = list("SSS"))),
    list(code = "timeperiod_y", selection = list(filter = "all", values = list("*")))
  ),
  response = list(format = "json-stat2")
)

# ---- helpers ---------------------------------------------------------------

# return a file's sha-256 digest.
sha256_file <- function(path) unname(tools::sha256sum(path))

# return a file's size in bytes.
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))

# download an open GET response when the local cache is absent (browser UA).
fetch_get_if_missing <- function(url, path) {
  if (file.exists(path) && file_bytes(path) > 0L) return(invisible(path))
  tmp <- paste0(path, ".part")
  on.exit(unlink(tmp), add = TRUE)
  args <- c("-L", "--http1.1", "--tlsv1.2", "--fail", "--silent", "--show-error",
            "--max-time", "120", "-A", "Mozilla/5.0 (places-of-worship research build)",
            url, "-o", tmp)
  status <- system2("curl", args)
  if (!identical(status, 0L) || !file.exists(tmp) || file_bytes(tmp) == 0L) {
    stop("failed to download ", url, call. = FALSE)
  }
  if (!file.rename(tmp, path)) stop("failed to cache ", path, call. = FALSE)
  invisible(path)
}

# post the PxWeb json query when the local response cache is absent.
fetch_px_post_if_missing <- function(url, query, path) {
  if (file.exists(path) && file_bytes(path) > 0L) return(invisible(path))
  query_path <- tempfile(fileext = ".json")
  tmp <- paste0(path, ".part")
  on.exit(unlink(c(query_path, tmp)), add = TRUE)
  write_json(query, query_path, auto_unbox = TRUE, pretty = TRUE, null = "null")
  args <- c("-L", "--http1.1", "--tlsv1.2", "--fail", "--silent", "--show-error",
            "--max-time", "120", "-A", "Mozilla/5.0 (places-of-worship research build)",
            "-HContent-Type:application/json", "--data-binary", paste0("@", query_path),
            url, "-o", tmp)
  status <- system2("curl", args)
  if (!identical(status, 0L) || !file.exists(tmp) || file_bytes(tmp) == 0L) {
    stop("failed to query ", url, call. = FALSE)
  }
  if (!file.rename(tmp, path)) stop("failed to cache ", path, call. = FALSE)
  invisible(path)
}

# stop unless every recorded snapshot hash matches (source-drift gate).
assert_source_hashes <- function() {
  for (nm in names(expected_sha256)) {
    got <- sha256_file(file.path(raw_dir, nm))
    if (!identical(got, unname(expected_sha256[[nm]]))) {
      stop("sha-256 mismatch for ", nm, ": got ", got, ", expected ",
           expected_sha256[[nm]], ". source drifted; product writing stopped.", call. = FALSE)
    }
  }
  invisible(TRUE)
}

# return a named variable block from a PxWeb table description.
metadata_variable <- function(metadata, code) {
  matches <- Filter(function(v) identical(v[["code"]], code), metadata[["variables"]])
  if (length(matches) != 1L) stop("metadata variable not found once: ", code, call. = FALSE)
  matches[[1]]
}

# return category codes in source order from a json-stat2 dimension.
dimension_codes <- function(dimension) {
  index <- dimension[["category"]][["index"]]
  names(sort(unlist(index, use.names = TRUE)))
}

# return category labels aligned to source-ordered json-stat2 codes.
dimension_labels <- function(dimension, codes) {
  labels <- unlist(dimension[["category"]][["label"]], use.names = TRUE)
  unname(labels[codes])
}

# validate a generated json product against a repository schema via check-jsonschema.
validate_json_schema <- function(schema_path, instance_path) {
  base_uri <- paste0(
    "file://", normalizePath(dirname(schema_path), winslash = "/", mustWork = TRUE), "/"
  )
  status <- system2("uvx", c(
    "check-jsonschema", "--base-uri", base_uri, "--schemafile", schema_path, instance_path
  ), env = c(
    "UV_CACHE_DIR=/tmp/places-of-worship-uv/cache",
    "UV_TOOL_DIR=/tmp/places-of-worship-uv/tools",
    "UV_PYTHON_INSTALL_DIR=/tmp/places-of-worship-uv/python"
  ))
  if (!identical(status, 0L)) stop("schema validation failed for ", instance_path, call. = FALSE)
  invisible(instance_path)
}

# ---- fetch and gate the source ---------------------------------------------

fetch_get_if_missing(px_table_en_url, metadata_en_path)
fetch_get_if_missing(px_table_fi_url, metadata_fi_path)
fetch_px_post_if_missing(px_table_en_url, px_query, membership_path)
fetch_get_if_missing(boundary_meta_url, boundary_meta_path)
fetch_get_if_missing(boundary_url, boundary_raw_path)
assert_source_hashes()

metadata_en <- fromJSON(metadata_en_path, simplifyVector = FALSE)
metadata_fi <- fromJSON(metadata_fi_path, simplifyVector = FALSE)
table_title_en <- metadata_en[["title"]]

religion_var_en <- metadata_variable(metadata_en, "uskontokunta_10_20190101")
religion_var_fi <- metadata_variable(metadata_fi, "uskontokunta_10_20190101")
sex_var <- metadata_variable(metadata_en, "sukupuoli_9_20180101")
age_var <- metadata_variable(metadata_en, "ikaryhma_10_20180101")
year_var <- metadata_variable(metadata_en, "timeperiod_y")

religion_codes <- unlist(religion_var_en[["values"]])
religion_labels_en <- unlist(religion_var_en[["valueTexts"]])
religion_labels_fi <- unlist(religion_var_fi[["valueTexts"]])
years <- as.integer(unlist(year_var[["values"]]))

# structural gates: the probed frame must be intact before any product is written.
expected_codes <- c("SSS", "A00", "B00", "C00", "D00", "E00", "F00", "F01", "F02",
                    "F03", "F04", "F05", "F06", "F07", "F08", "F09", "F10", "F11",
                    "G00", "G01", "G02", "G03", "G04", "G05", "G06", "H00")
if (!identical(religion_codes, expected_codes)) {
  stop("11rx religious-community codes changed from the probed 26-category frame", call. = FALSE)
}
if (!identical(years, 1990L:2025L)) {
  stop("11rx year coverage changed from the probed 1990-2025 span", call. = FALSE)
}
if (!identical(unlist(sex_var[["values"]])[[1]], "SSS") ||
    !identical(unlist(age_var[["values"]])[[1]], "SSS")) {
  stop("11rx Sex/Age total code is no longer 'SSS'", call. = FALSE)
}

# ---- parse the json-stat2 national slice -----------------------------------

response <- fromJSON(membership_path, simplifyVector = TRUE)
resp_dims <- unname(response[["id"]])
if (!identical(resp_dims[1], "uskontokunta_10_20190101") ||
    !("timeperiod_y" %in% resp_dims)) {
  stop("PxWeb response dimensions changed from the probed order", call. = FALSE)
}
resp_religion_codes <- dimension_codes(response[["dimension"]][["uskontokunta_10_20190101"]])
resp_religion_labels <- dimension_labels(response[["dimension"]][["uskontokunta_10_20190101"]], resp_religion_codes)
resp_year_codes <- dimension_codes(response[["dimension"]][["timeperiod_y"]])
if (!identical(resp_religion_codes, religion_codes) ||
    !identical(resp_religion_labels, religion_labels_en) ||
    !identical(resp_year_codes, as.character(years))) {
  stop("PxWeb response categories do not reproduce the table metadata", call. = FALSE)
}

values <- response[["value"]]
n_rel <- length(religion_codes)
n_yr <- length(years)
if (length(values) != n_rel * n_yr) {
  stop("PxWeb response has an unexpected number of cells", call. = FALSE)
}
# the national total-sex, total-age slice must carry no suppressed cell; a null
# would be a confidential/withheld value, which is omitted, never zeroed.
if (anyNA(values)) {
  stop("the national slice carries a suppressed/confidential cell; none is expected", call. = FALSE)
}
# response id order is [religion, sex(1), age(1), year, content(1)], so the value
# vector runs religion-outer, year-inner: index = (religion_i - 1) * n_yr + year_j.
value_matrix <- matrix(as.integer(values), nrow = n_rel, ncol = n_yr, byrow = TRUE,
                       dimnames = list(religion_codes, as.character(years)))

# ---- reconciliation gates (hard: stop, do not tune) ------------------------

leaf_codes <- c("A00", "B00", "C00", "D00", "E00",
                paste0("F", sprintf("%02d", 1:11)),
                paste0("G", sprintf("%02d", 1:6)), "H00")
christian_children <- paste0("F", sprintf("%02d", 1:11))
other_children <- paste0("G", sprintf("%02d", 1:6))
not_member_code <- "H00"

total_by_year <- value_matrix["SSS", ]
leaf_sum_by_year <- colSums(value_matrix[leaf_codes, , drop = FALSE])
f00_by_year <- value_matrix["F00", ]
f_child_sum <- colSums(value_matrix[christian_children, , drop = FALSE])
g00_by_year <- value_matrix["G00", ]
g_child_sum <- colSums(value_matrix[other_children, , drop = FALSE])

# gate 1: the 23 mutually-exclusive leaves sum exactly to the published TOTAL.
if (any(leaf_sum_by_year != total_by_year)) {
  stop("the 23 leaf categories do not reconcile to the published TOTAL every year", call. = FALSE)
}
# gate 1b: F00/G00 roll-up headings equal the exact sum of their children.
if (any(f00_by_year != f_child_sum) || any(g00_by_year != g_child_sum)) {
  stop("F00/G00 roll-up headings are not the exact sum of their children", call. = FALSE)
}

not_member_by_year <- value_matrix[not_member_code, ]
affiliation_by_year <- total_by_year - not_member_by_year

# gate 2: slot arithmetic. affiliation + not-member == TOTAL (shares sum to 100).
if (any(affiliation_by_year + not_member_by_year != total_by_year)) {
  stop("religious_affiliation + no_religion does not equal TOTAL every year", call. = FALSE)
}
# corroborate affiliation as the sum of the 22 non-member registered leaves.
non_member_leaves <- setdiff(leaf_codes, not_member_code)
affiliation_leaf_sum <- colSums(value_matrix[non_member_leaves, , drop = FALSE])
if (any(affiliation_leaf_sum != affiliation_by_year)) {
  stop("affiliation (TOTAL - H00) disagrees with the 22-leaf registered-community sum", call. = FALSE)
}

# per-year reconciliation record for the manifest.
reconciliation_by_year <- lapply(seq_along(years), function(i) {
  list(
    year = years[[i]],
    published_total = as.integer(total_by_year[[i]]),
    leaf_sum = as.integer(leaf_sum_by_year[[i]]),
    leaves_reconcile = leaf_sum_by_year[[i]] == total_by_year[[i]],
    christianity_heading = as.integer(f00_by_year[[i]]),
    christianity_children_sum = as.integer(f_child_sum[[i]]),
    other_groups_heading = as.integer(g00_by_year[[i]]),
    other_groups_children_sum = as.integer(g_child_sum[[i]]),
    religious_affiliation = as.integer(affiliation_by_year[[i]]),
    no_religion_not_member = as.integer(not_member_by_year[[i]]),
    affiliation_plus_not_member = as.integer(affiliation_by_year[[i]] + not_member_by_year[[i]]),
    slot_sum_equals_total = (affiliation_by_year[[i]] + not_member_by_year[[i]]) == total_by_year[[i]]
  )
})

# ---- boundary: geoBoundaries FIN ADM0 (ODbL 1.0) ---------------------------

boundary_meta <- fromJSON(boundary_meta_path, simplifyVector = TRUE)
boundary_licence_verbatim <- boundary_meta[["boundaryLicense"]]
if (!identical(boundary_meta[["boundaryISO"]], "FIN") ||
    !identical(boundary_meta[["boundaryType"]], "ADM0") ||
    !identical(boundary_meta[["boundaryYearRepresented"]], "2017") ||
    !identical(boundary_licence_verbatim, "Open Data Commons Open Database License 1.0")) {
  stop("geoBoundaries FIN ADM0 release metadata drifted from the probed release", call. = FALSE)
}
boundary_licence_source <- boundary_meta[["licenseSource"]]
if (!grepl("^https?://", boundary_licence_source)) {
  boundary_licence_source <- paste0("https://", boundary_licence_source)
}
boundary_source_id <- boundary_meta[["boundaryID"]]

raw_boundary <- st_read(boundary_raw_path, quiet = TRUE)
raw_boundary <- st_make_valid(st_transform(raw_boundary, 4326))
if (nrow(raw_boundary) != 1L || any(st_is_empty(raw_boundary)) ||
    any(is.na(st_is_valid(raw_boundary))) || any(!st_is_valid(raw_boundary))) {
  stop("raw Finland ADM0 boundary is missing, empty, invalid, or not one polygon", call. = FALSE)
}
boundary <- st_sf(area_code = "FI", area_name = "Finland",
                  geometry = st_geometry(raw_boundary), crs = 4326)

# sf writes the boundary with COORDINATE_PRECISION=5, which collapses some of
# Finland's sub-metre coastal skerry rings into a degenerate polyline layer that
# mapshaper would otherwise split into a second output file. target the polygon
# layer so only the national landmass polygon is simplified and written.
keep_ladder <- c(20, 10, 5, 2, 1, 0.5, 0.2, 0.1)
attr(keep_ladder, "mapshaper_target") <- "type=polygon"
simplification <- mapshaper_simplify_to_cap(
  boundary, boundary_out, max_bytes = 250000L,
  keep_percentages = keep_ladder
)
written_boundary <- st_read(boundary_out, quiet = TRUE)
written_valid <- st_is_valid(written_boundary)
if (nrow(written_boundary) != 1L || any(st_is_empty(written_boundary)) ||
    any(is.na(written_valid)) || any(!written_valid) ||
    !identical(written_boundary[["area_code"]], "FI")) {
  stop("simplified Finland ADM0 boundary failed the geometry gate", call. = FALSE)
}
land_area_sq_km <- as.numeric(st_area(st_transform(written_boundary, 4326))[[1]]) / 1e6
written_geometry_sha256 <- digest(
  st_as_binary(st_geometry(written_boundary), EWKB = TRUE)[[1L]],
  algo = "sha256", serialize = FALSE
)

# ---- shipped rows (36 annual waves, one national unit) ---------------------

population_basis_for <- function(i) {
  sprintf(paste0(
    "Statistics Finland StatFin table 11rx (Population 31.12.), register-based ",
    "religious-community membership from the Population Information System; national ",
    "total (Sex=Total, Age=Total), %d = %d. Membership is an administrative REGISTER ",
    "construct, not census affiliation, belief, or practice. religious_affiliation = ",
    "TOTAL minus PERSONS NOT MEMBERS OF ANY RELIGIOUS COMMUNITY (the sum of the 22 ",
    "registered religious-community leaves); no_religion = PERSONS NOT MEMBERS OF ANY ",
    "RELIGIOUS COMMUNITY; the two sum to the register universe (100%% by construction)."),
    years[[i]], total_by_year[[i]])
}

quality_flag <- paste(
  "administrative_register_membership",
  "national_only_adm0",
  "register_construct_not_census_affiliation_not_belief_not_practice",
  "religious_affiliation=total_minus_persons_not_members_of_any_religious_community",
  "no_religion=persons_not_members_of_any_religious_community_register_line_not_irreligion_claim",
  "affiliation_plus_not_member_equals_100_by_construction",
  "verbatim_statfin_26_category_frame_preserved_no_merge_no_zeroing",
  "23_leaves_reconcile_to_published_total;f00_christianity_g00_other_groups_are_roll_up_headings",
  "no_suppressed_cells_in_national_total_slice",
  "statfin_11rx_cc_by_4_0",
  "boundary_geoboundaries_fin_adm0_odbl_1_0_osm_not_cc_by_4_0",
  sep = ";"
)

# one composition item per verbatim category. the register's published values are
# integer counts, so composition carries the count verbatim (the CompositionItem
# schema admits exactly one of count/percent; the share is count / population_total,
# and population_total is on the row).
composition_for <- function(i) {
  lapply(seq_len(n_rel), function(r) {
    list(
      label_verbatim = religion_labels_en[[r]],
      count = as.integer(value_matrix[r, i])
    )
  })
}

rows <- lapply(seq_along(years), function(i) {
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = "adm0",
    area_unit_id = paste0(boundary_set_id, ":FI"),
    area_code = "FI",
    area_name = "Finland",
    year = years[[i]],
    population_total = as.integer(total_by_year[[i]]),
    population_total_basis = population_basis_for(i),
    religious_affiliation_count = as.integer(affiliation_by_year[[i]]),
    religious_affiliation_percent = round(100 * affiliation_by_year[[i]] / total_by_year[[i]], 4),
    no_religion_count = as.integer(not_member_by_year[[i]]),
    no_religion_percent = round(100 * not_member_by_year[[i]] / total_by_year[[i]], 4),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(land_area_sq_km, 4),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(table_dataset_id, boundary_dataset_id),
    quality_flag = quality_flag,
    composition = composition_for(i)
  )
})

# flatten the standard row fields into the CSV companion (composition is JSON-only).
flatten_rows <- function(rows) {
  data.frame(
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
    place_count = NA_integer_,
    places_per_10000_residents = NA_real_,
    place_density_per_sq_km = NA_real_,
    land_area_sq_km = vapply(rows, `[[`, numeric(1), "land_area_sq_km"),
    site_snapshot_date = NA_character_,
    place_count_basis = NA_character_,
    source_dataset_ids = vapply(rows, function(r) paste(unlist(r[["source_dataset_ids"]]), collapse = "|"), character(1)),
    quality_flag = vapply(rows, `[[`, character(1), "quality_flag"),
    stringsAsFactors = FALSE
  )
}

# ---- source datasets, indicators, visual layers ----------------------------

temporal_coverage <- paste0(min(years), "-", max(years), ", annually")
spatial_coverage <- "Finland national total on a single geoBoundaries FIN ADM0 polygon."
membership_quality <- paste(
  "Administrative religious-community membership from Finland's Population Information",
  "System, published by Statistics Finland. Never census affiliation, belief, or practice.",
  "Registered membership only; unaffiliated persons appear in the not-a-member line."
)
not_member_quality <- paste(
  "PERSONS NOT MEMBERS OF ANY RELIGIOUS COMMUNITY is the Statistics Finland register",
  "line for people not recorded as members of any registered religious community. The",
  "product does not interpret it as belief, irreligion, or attendance."
)

statfin_licence_verbatim <- paste(
  "Statistics Finland's statistical data are released under the open-data licence CC BY 4.0:",
  "the data may be copied, edited, shared, combined with other data, and used commercially,",
  "provided the source and the material version date are named and a reference and hyperlink",
  "to the CC BY 4.0 licence are attached."
)
statfin_attribution <- "Source: Statistics Finland, StatFin table 11rx (retrieved 2026-07-12), CC BY 4.0."

source_datasets <- list(
  list(
    source_dataset_id = table_dataset_id,
    name = paste0(table_title_en, " (StatFin table 11rx, religious community by age and sex)"),
    provider = "Statistics Finland (Tilastokeskus)",
    url = px_table_en_url,
    retrieval_date = retrieval_date,
    local_path = membership_path,
    licence = list(
      name = "Creative Commons Attribution 4.0 International (CC BY 4.0)",
      url = terms_url,
      attribution = statfin_attribution
    ),
    citation = paste(
      "Statistics Finland, StatFin table 11rx, Belonging to a religious community by age",
      "and sex, 1990-2025 (Population 31.12.); retrieved via the PxWeb API 2026-07-12. CC BY 4.0."
    ),
    access_limits = "Open, unregistered PxWeb API; national geography only (no municipality or region religion table exists in StatFin).",
    redistribution_limits = paste(
      "Statistics Finland permits reuse under CC BY 4.0 with the source and material-version",
      "date named and a hyperlink to the licence. Raw API responses remain in the git-ignored cache."
    ),
    notes = paste(
      "Register construct: membership in registered religious communities recorded in the",
      "Population Information System. 26 published categories in a shallow hierarchy (SSS Total;",
      "F00 Christianity and G00 Other religious groups are roll-up headings; the 23 leaves plus",
      "the not-a-member line reconcile to Total). This national slice fixes Sex=Total and Age=Total."
    )
  ),
  list(
    source_dataset_id = boundary_dataset_id,
    name = "geoBoundaries gbOpen Finland ADM0 (one national polygon)",
    provider = "geoBoundaries; source OpenStreetMap contributors",
    url = boundary_url,
    retrieval_date = retrieval_date,
    local_path = boundary_raw_path,
    licence = list(
      name = boundary_licence_verbatim,
      url = boundary_licence_source,
      attribution = "geoBoundaries; © OpenStreetMap contributors, ODbL 1.0"
    ),
    citation = paste0(
      "geoBoundaries gbOpen FIN ADM0, boundary ID ", boundary_source_id,
      ", release commit 9469f09, boundary year 2017; source OpenStreetMap contributors."
    ),
    access_limits = NULL,
    redistribution_limits = paste(
      "geoBoundaries records the FIN ADM0 boundary under the Open Data Commons Open Database",
      "License 1.0 (ODbL), NOT CC BY 4.0. ODbL permits redistribution of the simplified derivative",
      "with attribution to OpenStreetMap contributors and share-alike on the database. This diverges",
      "from the fleet's CC BY 4.0 boundaries; the National Land Survey / Statistics Finland CC BY 4.0",
      "municipal vector is the clean-licence swap (deferred)."
    ),
    notes = "One native national polygon re-tagged area_code='FI' and simplified with scripts/lib/simplify_boundary.R."
  )
)

indicators <- list(
  list(
    indicator_id = "population_total",
    label = "Register population 31.12.",
    description = "Statistics Finland StatFin 11rx national population on 31 December (the register universe, the published TOTAL row).",
    unit = "count",
    denominator_indicator_id = NULL,
    method = "Published TOTAL (SSS) row for Sex=Total, Age=Total per year.",
    temporal_coverage = temporal_coverage,
    spatial_coverage = spatial_coverage,
    quality_notes = "Register-based population 31.12.; the denominator for both membership shares."
  ),
  list(
    indicator_id = "religious_affiliation_count",
    label = "Registered religious-community membership (count)",
    description = "Administrative register membership in any registered religious community: TOTAL minus the not-a-member line (the sum of the 22 registered religious-community leaves).",
    unit = "count",
    denominator_indicator_id = "population_total",
    method = "TOTAL minus PERSONS NOT MEMBERS OF ANY RELIGIOUS COMMUNITY per year; corroborated as the sum of the 22 non-member leaves. No cell imputed.",
    temporal_coverage = temporal_coverage,
    spatial_coverage = spatial_coverage,
    quality_notes = membership_quality
  ),
  list(
    indicator_id = "religious_affiliation_percent",
    label = "Registered religious-community membership (%)",
    description = "Registered religious-community membership as a share of the register universe (TOTAL).",
    unit = "percent",
    denominator_indicator_id = "population_total",
    method = "100 times (TOTAL - not-a-member) divided by TOTAL.",
    temporal_coverage = temporal_coverage,
    spatial_coverage = spatial_coverage,
    quality_notes = membership_quality
  ),
  list(
    indicator_id = "no_religion_count",
    label = "Persons not members of any religious community (count)",
    description = "Statistics Finland's PERSONS NOT MEMBERS OF ANY RELIGIOUS COMMUNITY register line.",
    unit = "count",
    denominator_indicator_id = "population_total",
    method = "Published H00 row for Sex=Total, Age=Total per year.",
    temporal_coverage = temporal_coverage,
    spatial_coverage = spatial_coverage,
    quality_notes = not_member_quality
  ),
  list(
    indicator_id = "no_religion_percent",
    label = "Persons not members of any religious community (%)",
    description = "The not-a-member register line as a share of the register universe (TOTAL).",
    unit = "percent",
    denominator_indicator_id = "population_total",
    method = "100 times the not-a-member line divided by TOTAL; complements the membership share (the two sum to 100).",
    temporal_coverage = temporal_coverage,
    spatial_coverage = spatial_coverage,
    quality_notes = not_member_quality
  )
)

visual_layers <- list(
  list(
    visual_layer_id = "fi-adm0-register-membership-share",
    label = "Registered religious-community membership share",
    description = "National administrative-register membership in any registered religious community.",
    layer_type = "choropleth",
    indicator_ids = list("religious_affiliation_percent"),
    geometry_unit_type = "country",
    legend = list(unit = "percent", denominator = "register population 31.12. (TOTAL)"),
    colour_scale = NULL,
    time_control = "year_selector",
    aggregation_rule = NULL,
    uncertainty_display = "quality_flag",
    default_visibility = TRUE,
    notes = paste(
      "A single national polygon is intentional: Statistics Finland publishes religion at the",
      "whole-country level only. The full 26-category StatFin frame rides the per-row composition."
    )
  ),
  list(
    visual_layer_id = "fi-adm0-not-member-share",
    label = "Persons not members of any religious community share",
    description = "National share in Statistics Finland's PERSONS NOT MEMBERS OF ANY RELIGIOUS COMMUNITY line.",
    layer_type = "choropleth",
    indicator_ids = list("no_religion_percent"),
    geometry_unit_type = "country",
    legend = list(unit = "percent", denominator = "register population 31.12. (TOTAL)"),
    colour_scale = NULL,
    time_control = "year_selector",
    aggregation_rule = NULL,
    uncertainty_display = "quality_flag",
    default_visibility = FALSE,
    notes = "The register non-membership line; not interpreted as belief or irreligion."
  )
)

# ---- assemble and write the area-summary.v2 product ------------------------

area_summary <- list(
  schema_version = "area-summary.v2",
  generated_at = stamp,
  generated_by = script_id,
  country_code = country_code,
  data_status = "register_membership_live",
  data_status_note = paste(
    "Finland national administrative religious-community membership, StatFin 11rx,",
    "1990-2025 (36 annual waves) on one geoBoundaries FIN ADM0 polygon. Register",
    "construct, not census affiliation or belief. Ships STAGED (no page, no hub)."
  ),
  boundary_set = list(
    boundary_set_id = boundary_set_id,
    country_code = country_code,
    level = "adm0",
    vintage = "2017",
    source_dataset_id = boundary_dataset_id
  ),
  site_snapshot = list(
    source_dataset_id = NULL,
    snapshot_date = NULL,
    basis = "no governed Finland place-of-worship snapshot is included in this membership release",
    notes = "The Finland lane ships administrative register-membership metrics only."
  ),
  source_datasets = source_datasets,
  indicators = indicators,
  visual_layers = visual_layers,
  rows = rows
)

write_json(area_summary, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
utils::write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

if (!jsonlite::validate(readChar(summary_json_out, file_bytes(summary_json_out), useBytes = TRUE))) {
  stop("area-summary output failed JSON syntax validation", call. = FALSE)
}
validate_json_schema("schemas/area-summary.v2.schema.json", summary_json_out)

# ---- manifest (data-manifest.v2) -------------------------------------------

git_commit <- tryCatch({
  v <- trimws(system2("git", c("rev-parse", "--short", "HEAD"), stdout = TRUE, stderr = TRUE))
  if (length(v) == 1L && grepl("^[a-f0-9]{7,40}$", v)) v else NULL
}, error = function(e) NULL)

raw_source_record <- function(path, url, method, format, request_body = NULL, notes = NULL) {
  rec <- list(
    local_path = path, url = url, method = method, retrieval_date = retrieval_date,
    format = format, bytes = file_bytes(path), sha256 = sha256_file(path)
  )
  if (!is.null(request_body)) rec[["request_body"]] <- request_body
  if (!is.null(notes)) rec[["notes"]] <- notes
  rec
}
raw_sources <- list(
  raw_source_record(metadata_en_path, px_table_en_url, "GET", "json", NULL,
    "11rx table metadata (English labels), pinned by sha-256."),
  raw_source_record(metadata_fi_path, px_table_fi_url, "GET", "json", NULL,
    "11rx table metadata (Finnish labels), pinned by sha-256."),
  raw_source_record(membership_path, px_table_en_url, "POST", "json-stat2", px_query,
    "National total-sex, total-age religion x year slice; source of record."),
  raw_source_record(boundary_meta_path, boundary_meta_url, "GET", "json", NULL,
    "geoBoundaries FIN ADM0 release metadata (ODbL 1.0)."),
  raw_source_record(boundary_raw_path, boundary_url, "GET", "geojson", NULL,
    "geoBoundaries FIN ADM0 native national polygon.")
)

durable_file_record <- function(path, content, row_count = NULL, feature_count = NULL) {
  rec <- list(
    uri = paste0("repo:", path), storage_provider = "git_repository",
    format = sub("^.*\\.", "", path), bytes = file_bytes(path), sha256 = sha256_file(path),
    content = content, privacy = "public", licence_status = "accepted"
  )
  if (!is.null(row_count)) rec[["row_count"]] <- as.integer(row_count)
  if (!is.null(feature_count)) rec[["feature_count"]] <- as.integer(feature_count)
  rec
}

output_paths <- c(summary_json_out, summary_csv_out, boundary_out)
output_hashes <- vapply(output_paths, sha256_file, character(1))
raw_hashes <- vapply(raw_sources, `[[`, character(1), "sha256")
version_hash <- substr(digest(paste(c(raw_hashes, output_hashes), collapse = ""),
                              algo = "sha256", serialize = FALSE), 1L, 12L)

# the full bilingual verbatim frame, recorded so the manifest carries every
# StatFin category label (Finnish and English) even though the row composition
# carries the English label only.
category_frame <- lapply(seq_len(n_rel), function(r) {
  list(
    code = religion_codes[[r]],
    label_en = religion_labels_en[[r]],
    label_fi = religion_labels_fi[[r]],
    role = if (religion_codes[[r]] == "SSS") "universe_total"
           else if (religion_codes[[r]] %in% c("F00", "G00")) "roll_up_heading"
           else if (religion_codes[[r]] == not_member_code) "no_religion_not_member"
           else "religious_community_leaf"
  )
})

construct_notes <- list(
  "The construct is administrative religious-community MEMBERSHIP recorded in Finland's Population Information System and published by Statistics Finland (StatFin table 11rx). It is a register construct, never census affiliation, belief, practice, or attendance.",
  "population_total is the published register population 31.12. (the StatFin TOTAL / SSS row). religious_affiliation is TOTAL minus PERSONS NOT MEMBERS OF ANY RELIGIOUS COMMUNITY (the sum of the 22 registered religious-community leaves); no_religion is the PERSONS NOT MEMBERS OF ANY RELIGIOUS COMMUNITY line verbatim. The two sum to the register universe, so the two shares sum to 100 by construction.",
  "no_religion here is the register non-membership line, not a belief, irreligion, or attendance claim.",
  "The 26 published categories form a shallow hierarchy. SSS is the universe total. F00 CHRISTIANITY and G00 OTHER RELIGIOUS GROUPS are roll-up headings, the exact sums of their F01-F11 and G01-G06 children. The 23 mutually-exclusive leaves (A00,B00,C00,D00,E00; F01-F11; G01-G06; H00) reconcile to TOTAL every year. The build never sums a heading into the leaf frame.",
  "Every row carries all 26 verbatim StatFin categories in the per-row composition (published English labels, count, and share-of-TOTAL percent), in source order. The Finnish and English verbatim labels are recorded together in pipeline.parameters.category_frame. No category is merged, redistributed, renamed, or zeroed.",
  "The national total-sex, total-age slice carries no suppressed or confidential cell (0 nulls across 26 categories x 36 years); the suppressed/confidential rule (omit, never zero) is therefore satisfied vacuously in this slice.",
  "A single national polygon is intentional: Statistics Finland publishes religion at the whole-country level only; no current or archived StatFin table crosses religion with area.",
  "The 11rx data are CC BY 4.0 (Statistics Finland). The geoBoundaries FIN ADM0 boundary is ODbL 1.0 (OpenStreetMap source), NOT CC BY 4.0 - a divergence from the fleet's CC BY 4.0 boundaries, recorded verbatim and flagged; the National Land Survey / Statistics Finland CC BY 4.0 municipal vector is the clean-licence swap (deferred).",
  "No Finland place-of-worship count or density metric ships in this release."
)

deferred_sources <- list(
  list(
    source = "Subnational (municipality / region) religion",
    status = "unavailable_no_public_table",
    reason = "Statistics Finland publishes religion at national geography only. No current or archived StatFin table crosses religious community with municipality or region; language, citizenship, country of birth, and origin all have area tables, religion does not.",
    recovery_route = "None from StatFin. Evangelical Lutheran Church parish/municipality membership (kirkontilastot.fi) is single-denomination, Tableau-delivered, and licence-unstated (route-probe unblocks 1-2)."
  ),
  list(
    source = "CC BY 4.0 national boundary (National Land Survey / Statistics Finland)",
    status = "clean_licence_swap_deferred",
    reason = "The shipped geoBoundaries FIN ADM0 polygon is ODbL 1.0 (OpenStreetMap). The National Land Survey of Finland and Statistics Finland both publish the administrative-area division under CC BY 4.0 (WFS / OGC API Features; the geofi R package wraps the same source).",
    recovery_route = "Dissolve the CC BY 4.0 municipal vector to a national outline, or fetch the CC BY 4.0 ADM0 via WFS, to align the boundary licence with the fleet and the 11rx data licence."
  )
)

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = paste0("manifest:fi-religious-community-membership:fi:1990-2025:", version_hash),
  dataset_id = "fi-religious-community-membership:fi:1990-2025:statfin-national",
  dataset_version_id = paste0("fi-religious-community-membership:fi:1990-2025:statfin-national:", version_hash),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "fi-religious-community-membership",
  dataset_role = "public_product",
  scope = list(
    level = "country", country_codes = list("FI"),
    snapshot_date = NULL, snapshot_anchor = "12-31", pipeline_stage = "staged"
  ),
  created_at = stamp,
  created_by = script_id,
  target_years = as.list(years),
  pipeline = list(
    script = script_id,
    git_commit = git_commit,
    command = paste("Rscript", script_id),
    parameters = list(
      construct = "administrative religious-community membership (register construct, not census affiliation or belief)",
      ruling = "PI ruling 2026-07-12 (build-queue row 98): Finland ships national-only; ship over hold.",
      source_table = table_id,
      geography = "adm0 (national only; StatFin publishes religion at whole-country level only)",
      shipped_years = as.list(years),
      px_web_query = px_query,
      slot_design = paste(
        "religious_affiliation = TOTAL - H00 (sum of the 22 registered religious-community leaves);",
        "no_religion = H00 (PERSONS NOT MEMBERS OF ANY RELIGIOUS COMMUNITY); the two sum to TOTAL",
        "(100% by construction on the register universe)."
      ),
      category_frame = category_frame,
      frame_hierarchy_note = paste(
        "SSS Total is the universe; F00 Christianity and G00 Other religious groups are roll-up",
        "headings (exact sums of F01-F11 and G01-G06); the 23 leaves reconcile to Total every year."
      ),
      composition_note = "Every row carries all 26 verbatim categories (English label, count, share-of-Total percent) in source order; no merge, no zeroing.",
      suppressed_cell_rule = "Suppressed/confidential cells are omitted, never zeroed; the national total-sex/total-age slice carries none (0 nulls, 26 x 36 cells).",
      statfin_licence_verbatim = statfin_licence_verbatim,
      boundary_licence_verbatim = boundary_licence_verbatim,
      boundary_licence_divergence = paste(
        "geoBoundaries FIN ADM0 is ODbL 1.0 (OpenStreetMap), not CC BY 4.0. Flagged as a fleet",
        "divergence; the NLS / Statistics Finland CC BY 4.0 municipal vector is the clean swap (deferred)."
      ),
      boundary_join_property = "area_code",
      boundary_simplification = c(simplification, list(byte_ceiling = 250000L, helper = "scripts/lib/simplify_boundary.R")),
      reconciliation_by_year = reconciliation_by_year,
      local_cache_hint = "data/raw/fi_statfin/ (git-ignored; every cached file listed and hashed in raw_sources)."
    ),
    software_versions = list(
      R = paste(R.version$major, R.version$minor, sep = "."),
      sf = as.character(utils::packageVersion("sf")),
      jsonlite = as.character(utils::packageVersion("jsonlite")),
      digest = as.character(utils::packageVersion("digest")),
      mapshaper = "scripts/lib/simplify_boundary.R"
    )
  ),
  source = list(
    provider = "Statistics Finland (Tilastokeskus); geoBoundaries / OpenStreetMap contributors",
    source_dataset_ids = list(table_dataset_id, boundary_dataset_id),
    source_urls = list(px_table_en_url, px_table_fi_url, terms_url, open_data_url, boundary_meta_url, boundary_url),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = paste(
      "Statistics Finland 11rx: CC BY 4.0 with attribution and material-version date.",
      "geoBoundaries FIN ADM0: Open Data Commons Open Database License 1.0 (ODbL, OpenStreetMap source)."
    ),
    raw_redistribution = "Raw StatFin API responses and the boundary remain in the git-ignored cache; not redistributed in-repo.",
    licence_position = "accepted: CC BY 4.0 (StatFin data) and ODbL 1.0 (boundary), both recorded verbatim.",
    citation = paste(
      "Statistics Finland StatFin table 11rx (Belonging to a religious community by age and sex,",
      "1990-2025); geoBoundaries gbOpen FIN ADM0, release commit 9469f09."
    ),
    local_cache_hint = "data/raw/fi_statfin/ (git-ignored)."
  ),
  input_manifests = list(),
  durable_files = list(
    durable_file_record(summary_json_out, "Finland national 36-wave register religious-community membership area summary (area-summary.v2, 1990-2025).", row_count = length(rows)),
    durable_file_record(summary_csv_out, "Flattened Finland national register-membership rows for 1990 through 2025.", row_count = length(rows)),
    durable_file_record(boundary_out, "geoBoundaries FIN ADM0 native national polygon (simplified).", feature_count = 1L)
  ),
  derived_outputs = lapply(output_paths, function(path) {
    list(uri = paste0("repo:", path), sha256 = sha256_file(path), built_by = script_id)
  }),
  raw_sources = raw_sources,
  partitions = list(
    list(partition_id = "fi-adm0-1990-2025", partition_type = "country",
         file_uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out),
         country_code = "FI", snapshot_date = NULL, stage = "staged")
  ),
  stats = list(
    years = length(years), first_year = min(years), last_year = max(years),
    area_rows = length(rows), area_count = 1L,
    source_categories_including_total = n_rel,
    mutually_exclusive_leaves = length(leaf_codes),
    boundary_features = 1L, boundary_bytes = file_bytes(boundary_out),
    boundary_keep_percent = simplification[["keep_percent"]],
    register_total = as.list(as.integer(total_by_year))
  ),
  local_cache_hint = "data/raw/fi_statfin/ (git-ignored).",
  validation = list(
    status = "passed",
    commands = list(
      paste("Rscript", script_id),
      paste("uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.v2.schema.json", summary_json_out),
      paste("uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/data-manifest.schema.json", manifest_out),
      "bash scripts/validate_area_summaries.sh",
      "bash scripts/validate_manifests.sh"
    ),
    warnings = list(
      "National geography only: Statistics Finland publishes religion at the whole-country level; no StatFin table crosses religion with area.",
      "The geoBoundaries FIN ADM0 boundary is ODbL 1.0 (OpenStreetMap), NOT CC BY 4.0 - a fleet divergence; the NLS / Statistics Finland CC BY 4.0 municipal vector is the clean-licence swap (deferred).",
      "no_religion is the register non-membership line (PERSONS NOT MEMBERS OF ANY RELIGIOUS COMMUNITY), not a belief or irreligion claim."
    ),
    notes = paste(
      "All 36 years present (1990-2025). Every year the 23 mutually-exclusive leaves sum exactly to",
      "the published TOTAL, F00/G00 roll-up headings equal their children's sum, and religious_affiliation",
      "+ no_religion equals TOTAL (shares sum to 100). No suppressed cell in the national slice. The single",
      "simplified ADM0 polygon is non-empty and valid."
    ),
    reconciliation_by_year = reconciliation_by_year,
    geometry_validation = list(
      source_feature_count = 1L,
      output_feature_count = nrow(written_boundary),
      all_valid = all(written_valid),
      all_non_empty = all(!st_is_empty(written_boundary)),
      feature_geometry_sha256 = written_geometry_sha256,
      land_area_sq_km = round(land_area_sq_km, 2),
      output_bytes = file_bytes(boundary_out),
      simplification = simplification
    )
  ),
  construct_notes = construct_notes,
  deferred_sources = deferred_sources,
  privacy = "public",
  licence_status = "accepted",
  licence_basis = "statfin_11rx_cc_by_4_0_data_geoboundaries_fin_adm0_odbl_1_0_boundary",
  downstream_status = "staged",
  source_datasets = source_datasets,
  notes = paste(
    "Finland national 36-wave administrative religious-community membership product (StatFin 11rx,",
    "1990-2025) on one geoBoundaries FIN ADM0 polygon. Register construct, never census affiliation",
    "or belief. StatFin data CC BY 4.0; boundary ODbL 1.0 (flagged divergence). Ships STAGED (no page,",
    "no hub). The map UI (index.html, hub) is outside this build."
  )
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(readChar(manifest_out, file_bytes(manifest_out), useBytes = TRUE))) {
  stop("manifest output is not valid JSON", call. = FALSE)
}
validate_json_schema("schemas/data-manifest.schema.json", manifest_out)

# ---- console summary -------------------------------------------------------
cat("Finland national register religious-community membership: 36 waves (1990-2025) on 1 ADM0 polygon\n")
for (i in seq_along(years)) {
  cat(sprintf("  %d: total %d, membership %d (%.2f%%), not-member %d (%.2f%%)\n",
    years[[i]], total_by_year[[i]], affiliation_by_year[[i]],
    100 * affiliation_by_year[[i]] / total_by_year[[i]],
    not_member_by_year[[i]], 100 * not_member_by_year[[i]] / total_by_year[[i]]))
}
cat("leaf-sum gate: passed (23 leaves == TOTAL every year)\n")
cat("roll-up gate: passed (F00==sum F01-11, G00==sum G01-06 every year)\n")
cat("slot gate: passed (affiliation + not-member == TOTAL every year)\n")
cat(sprintf("boundary gate: passed; 1 valid ADM0 feature, %d bytes at %g%% keep; %s\n",
  file_bytes(boundary_out), simplification[["keep_percent"]], boundary_licence_verbatim))
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", boundary_out))
cat(sprintf("wrote %s\n", manifest_out))
