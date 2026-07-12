# build the Republic of the Marshall Islands (RMI) census-religion area-summary
# product for a single wave, 2021, at atoll/island level (25 census rows).
# inputs (all cached, git-ignored, verified by sha256 in the route probe):
#   data/raw/mh_census/mh_2021_census_vol1.pdf -> Table 9 "Population by Urban/Rural
#     and atoll by religion" (text-extractable; 25 atoll rows x 16 religion categories)
#   data/raw/mh_census/geoBoundaries-MHL-ADM1.geojson -> 24-atoll ADM1 boundary
#   data/raw/mh_census/gb_mhl_adm1_meta.json          -> boundary licence metadata
# Table 9 is transcribed verbatim from the cached PDF text layer and reconciled at
# every margin here (each atoll's 16 cells sum to its printed total; the 25 rows sum
# column-wise to the national totals for all 16 categories; Rural + Urban = Total for
# every category). the build stops on any margin mismatch and never allocates,
# infers, imputes, or tunes a cell.
# outputs: apps/regions/mh/data/mh_atoll_2017.geojson,
#   apps/regions/mh/data/area_summary_atoll.{json,csv}, and
#   docs/manifests/mh-census-religion-2021.json.
# run from the repo root: Rscript scripts/build_mh_area_summary.R
# this is a STAGED product: no page, no hub link. the source carries an explicit
# EPPSO/SPC partial-reproduction-with-acknowledgement clause (quoted verbatim in the
# manifest); the product ships with attribution under the build-then-ask ruling while
# an EPPSO courtesy ask goes out; the boundary is ODbL 1.0.

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "MH"
script_id <- "scripts/build_mh_area_summary.R"
raw_dir <- "data/raw/mh_census"
product_dir <- "apps/regions/mh/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-11"
stamp <- paste0(retrieval_date, "T00:00:00Z")
boundary_level <- "atoll"
boundary_set_id <- "mh-atoll-2017-geoboundaries-adm1"

d2021 <- "mh-census-2021-vol1-table-9-religion"
d_boundary <- "geoboundaries-mhl-adm1-2017"

census_2021_url <- "https://rmihealth.org/media/attachments/2025/08/08/marshall_islands_2021_census_vol1_table_report.pdf"
analytical_2021_url <- "https://www.infomarshallislands.com/wp-content/uploads/2025/04/Marshall-Islands-Census-2021.pdf"
census_lib_url <- "https://sdd.spc.int/digital_library/republic-marshall-islands-2021-census-report-volume-1-basic-tables-and"
boundary_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/MHL/ADM1/geoBoundaries-MHL-ADM1.geojson"
boundary_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/MHL/ADM1/"

census_2021_path <- file.path(raw_dir, "mh_2021_census_vol1.pdf")
analytical_2021_path <- file.path(raw_dir, "mh_2021_infomi.pdf")
boundary_path <- file.path(raw_dir, "geoBoundaries-MHL-ADM1.geojson")
boundary_meta_path <- file.path(raw_dir, "gb_mhl_adm1_meta.json")

boundary_out <- file.path(product_dir, "mh_atoll_2017.geojson")
summary_json_out <- file.path(product_dir, "area_summary_atoll.json")
summary_csv_out <- file.path(product_dir, "area_summary_atoll.csv")
manifest_out <- file.path(manifest_dir, "mh-census-religion-2021.json")

# canonical atoll order matches the printed Table 9 roster (printed numbering 1-26
# with #23 absent). 25 atoll/island rows. Bikini and Rongelap print zero population.
atolls <- c(
  "Ailinglaplap", "Ailuk", "Arno", "Aur", "Bikini", "Ebon", "Enewetak", "Jabat",
  "Jaluit", "Kili", "Kwajalein", "Lae", "Lib", "Likiep", "Majuro", "Maloelap",
  "Mejit", "Mili", "Namdrik", "Namu", "Rongelap", "Ujae", "Utirik", "Wotho", "Wotje"
)
# the census extra row Bikini (population 0) has no geoBoundaries ADM1 polygon; the
# record is kept in the data with a disclosure flag and the map joins the other 24.
atoll_no_polygon <- "Bikini"

# snake_case slug per atoll: names are single tokens, so the slug is lower-case.
slug <- setNames(tolower(atolls), atolls)

# the 16 religion categories in Table 9 header (column) order, verbatim spellings.
categories <- c(
  "United Church of Christ", "Roman Catholic", "Assembly of God", "Jehovah's Witness",
  "Reformed Congregational Church", "Mormon", "Seventh Day Adventist", "Bukot Nan Jesus",
  "None", "Full Gospel", "Salvation Army", "Other (specify)", "Protestant Church",
  "New Beginning Church", "Baptist Church", "Batkan Light House Church"
)
# the single no-religion line in the frame; "Other (specify)" is a residual religious
# affiliation, not a no-religion slot. there is no separate refused/not-stated line.
no_religion_category <- "None"

# denomination-taxonomy.json code for each printed Table 9 category, assigned only
# where the verbatim label maps to a single taxonomy denomination unambiguously. the
# indigenous and locally-named bodies (Bukot Nan Jesus, New Beginning Church, Batkan
# Light House Church), the generic "Protestant Church" and "Full Gospel" rollups, the
# residual "Other (specify)", and the "None" no-religion line have no unambiguous code
# and ship without one under area-summary.v2. "United Church of Christ" and "Reformed
# Congregational Church" each sit between two plausible codes (church_of_christ /
# congregational and reformed / congregational), so both are left unmapped rather than
# guessed. "Mormon" is the census's own name for the Latter-day Saints body.
category_taxonomy <- c(
  "United Church of Christ"        = NA_character_,
  "Roman Catholic"                 = "christian.catholic",
  "Assembly of God"                = NA_character_,
  "Jehovah's Witness"              = "christian.jehovahs_witnesses",
  "Reformed Congregational Church" = NA_character_,
  "Mormon"                         = "christian.latter_day_saints",
  "Seventh Day Adventist"          = "christian.seventh_day_adventist",
  "Bukot Nan Jesus"                = NA_character_,
  "None"                           = NA_character_,
  "Full Gospel"                    = NA_character_,
  "Salvation Army"                 = "christian.salvation_army",
  "Other (specify)"                = NA_character_,
  "Protestant Church"              = NA_character_,
  "New Beginning Church"           = NA_character_,
  "Baptist Church"                 = "christian.baptist",
  "Batkan Light House Church"      = NA_character_
)

# helper: build an atoll-named integer vector from a row of 16 category values given
# in the category (column) order above.
row16 <- function(...) {
  v <- as.integer(c(...))
  if (length(v) != length(categories)) {
    stop("row does not carry exactly 16 category cells", call. = FALSE)
  }
  setNames(v, categories)
}

# ---- Table 9 atoll rows (verbatim; each row is the 16 category cells) ------------
# transcribed from mh_2021_census_vol1.pdf Table 9 (pages 18-19 of the report).
tab <- list(
  Ailinglaplap = row16( 728,  88,  98,   1,  33,  13,  37,  38,   0,   0,   1,   7,   0, 128,   0,   0),
  Ailuk        = row16( 168,   1,  66,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0),
  Arno         = row16( 445,  26, 342,   2,   0,   2,   3,  81,  11, 148,  71,   9,   0,   0,   0,   0),
  Aur          = row16( 250,   1,  17,   0,  48,   0,   0,   0,   1,   0,   0,   0,   0,   0,   0,   0),
  Bikini       = row16(   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0),
  Ebon         = row16( 397,   1,   0,   0,   0,   1,   6,  36,   1,   0,   0,  15,   0,  12,   0,   0),
  Enewetak     = row16( 228,   5,  59,   1,   0,   0,   0,   0,   2,   0,   0,   0,   0,   0,   1,   0),
  Jabat        = row16(  75,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0),
  Jaluit       = row16( 691, 125,   2,   0,  88,   2,   8,   5,   0,   0, 122,  10,   0,   0,   5,   0),
  Kili         = row16( 276,   2,  68,   0,   0,   0,   0,   0,   0,   0,   0,   1,  68,   0,   0,   0),
  Kwajalein    = row16(4915, 988,1094, 117, 258, 789, 127, 352,  26, 458, 148,  94,  39, 295,  39,   0),
  Lae          = row16(  77,   0,   0,   0,  19,  37,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0),
  Lib          = row16( 156,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0),
  Likiep       = row16(  37, 162,  25,   0,   0,   0,   0,   0,   0,   4,   0,   0,   0,   0,   0,   0),
  Majuro       = row16(9341,2346,3507, 415, 482,1480, 445, 723, 376,1349, 612, 969, 310, 152, 117, 249),
  Maloelap     = row16( 350,   1,  44,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0),
  Mejit        = row16( 139,   0,  66,   1,   0,   0,   0,   6,   6,   0,   0,   6,   0,   6,   0,   0),
  Mili         = row16( 318,   1, 137,   1,   0,  16,   0,   0,  12,   0,   0,  12,   0,   0,   0,   0),
  Namdrik      = row16( 153,  83,  51,   0,   2,   5,   0,   4,   0,   0,   0,   1,   0,   0,   0,   0),
  Namu         = row16( 409,   0,  31,   0,   0,   0,  83,   0,   1,   0,   0,   1,   0,   0,   0,   0),
  Rongelap     = row16(   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0),
  Ujae         = row16( 248,   0,  58,   0,   0,   4,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0),
  Utirik       = row16( 126,   0,  71,   0,   0,   1,   0,   0,   0,  59,   0,   2,   5,   0,   0,   0),
  Wotho        = row16(  80,   1,   7,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0),
  Wotje        = row16( 313,  32, 121,   0,   0,  13,  11,   1,   8,  68,   0,   1,  93,   0,   0,   0)
)

# printed atoll Total column (control margin 1, per atoll).
total_atoll <- setNames(as.integer(c(
  1172, 235, 1140, 317, 0, 469, 296, 75, 1058, 415, 9739, 133, 156, 228, 22873,
  395, 230, 497, 299, 525, 0, 310, 264, 88, 661)), atolls)

# printed national category Total row (control margin 2, per category).
total_category <- setNames(as.integer(c(
  19920, 3863, 5864, 538, 930, 2363, 720, 1246, 444, 2086, 954, 1128, 515, 593,
  162, 249)), categories)
national_total <- 41575L

# printed Rural and Urban national splits per category (control margin 3).
rural_category <- setNames(as.integer(c(
  5664, 529, 1263, 6, 190, 94, 148, 171, 42, 279, 194, 65, 166, 146, 6, 0)), categories)
urban_category <- setNames(as.integer(c(
  14256, 3334, 4601, 532, 740, 2269, 572, 1075, 402, 1807, 760, 1063, 349, 447,
  156, 249)), categories)
rural_total <- 8963L
urban_total <- 32612L

# ---- reconciliation gates (fail-fast; stop, do not tune) ------------------------

reconcile_wave <- function() {
  records <- list()
  # margin 1: every atoll row's 16 cells sum to its printed atoll total.
  for (a in atolls) {
    row_sum <- sum(tab[[a]])
    if (row_sum != total_atoll[[a]]) {
      stop(sprintf("row gate FAILED for %s: 16 cells sum %d != printed total %d",
                   a, row_sum, total_atoll[[a]]), call. = FALSE)
    }
    records[[length(records) + 1L]] <- data.frame(
      margin = "atoll_row", key = a, computed = row_sum,
      printed = total_atoll[[a]], difference = 0L, stringsAsFactors = FALSE)
  }
  # margin 2: every category column's 25-atoll sum equals the printed national total.
  for (c in categories) {
    col_sum <- sum(vapply(atolls, function(a) tab[[a]][[c]], integer(1)))
    if (col_sum != total_category[[c]]) {
      stop(sprintf("column gate FAILED for %s: 25-atoll sum %d != printed national %d",
                   c, col_sum, total_category[[c]]), call. = FALSE)
    }
    records[[length(records) + 1L]] <- data.frame(
      margin = "category_column", key = c, computed = col_sum,
      printed = total_category[[c]], difference = 0L, stringsAsFactors = FALSE)
  }
  # margin 3: Rural + Urban = Total for every category and for the grand total.
  for (c in categories) {
    ru_sum <- rural_category[[c]] + urban_category[[c]]
    if (ru_sum != total_category[[c]]) {
      stop(sprintf("urban/rural gate FAILED for %s: rural %d + urban %d = %d != total %d",
                   c, rural_category[[c]], urban_category[[c]], ru_sum, total_category[[c]]),
           call. = FALSE)
    }
    records[[length(records) + 1L]] <- data.frame(
      margin = "urban_rural_split", key = c, computed = ru_sum,
      printed = total_category[[c]], difference = 0L, stringsAsFactors = FALSE)
  }
  # grand margins: atoll totals, category totals, and the urban/rural split all sum
  # to the printed national grand total.
  if (sum(total_atoll) != national_total) {
    stop(sprintf("grand gate FAILED: atoll-total sum %d != national %d",
                 sum(total_atoll), national_total), call. = FALSE)
  }
  if (sum(total_category) != national_total) {
    stop(sprintf("grand gate FAILED: category-total sum %d != national %d",
                 sum(total_category), national_total), call. = FALSE)
  }
  if (rural_total + urban_total != national_total) {
    stop(sprintf("grand gate FAILED: rural %d + urban %d != national %d",
                 rural_total, urban_total, national_total), call. = FALSE)
  }
  records[[length(records) + 1L]] <- data.frame(
    margin = "national_grand", key = "RMI", computed = sum(total_atoll),
    printed = national_total, difference = 0L, stringsAsFactors = FALSE)
  do.call(rbind, records)
}

rec_2021 <- reconcile_wave()
message(sprintf("gate 2021: PASSED (25 atoll rows, 16 categories, all margins close to %d; rural %d + urban %d)",
                national_total, rural_total, urban_total))

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

required_inputs <- c(census_2021_path, boundary_path, boundary_meta_path)
invisible(lapply(required_inputs, require_file))

# confirm the pinned boundary licence, unit count, and type before use.
boundary_metadata <- fromJSON(boundary_meta_path, simplifyVector = FALSE)
if (!identical(boundary_metadata[["boundaryLicense"]], "Open Data Commons Open Database License 1.0") ||
    !identical(boundary_metadata[["admUnitCount"]], "24") ||
    !identical(boundary_metadata[["boundaryType"]], "ADM1")) {
  stop("geoBoundaries MHL ADM1 licence, unit count, or type metadata changed", call. = FALSE)
}

# atolls carried by the boundary: every atoll except the no-polygon Bikini row.
boundary_atolls <- setdiff(atolls, atoll_no_polygon)

# RMI-centred equal-area projection for land areas and geometry checks.
mh_laea <- "+proj=laea +lat_0=9 +lon_0=167 +datum=WGS84 +units=m +no_defs"

# join the 24 census atolls (all except Bikini) one-to-one to the geoBoundaries
# ADM1 features by shapeName; no spelling concordance is needed.
build_boundary <- function(path) {
  boundary <- st_read(path, quiet = TRUE, stringsAsFactors = FALSE)
  if (nrow(boundary) != 24L) stop("geoBoundaries MHL ADM1 feature count is not 24", call. = FALSE)
  idx <- match(boundary_atolls, boundary[["shapeName"]])
  if (anyNA(idx) || anyDuplicated(idx) || !setequal(idx, seq_len(24L))) {
    stop("census atolls and geoBoundaries features do not join one-to-one", call. = FALSE)
  }
  boundary <- boundary[idx, ]
  boundary[["area_name"]] <- boundary_atolls
  boundary[["boundary_source_name"]] <- boundary[["shapeName"]]
  boundary[["area_code"]] <- unname(slug[boundary_atolls])
  boundary[["area_unit_id"]] <- paste(boundary_set_id, unname(slug[boundary_atolls]), sep = ":")
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- boundary_level
  boundary[["boundary_vintage"]] <- "2017"
  boundary[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(boundary, mh_laea))) / 1e6
  boundary <- st_transform(st_make_valid(boundary), 4326)
  boundary[c("area_code", "area_name", "boundary_source_name", "area_unit_id",
             "boundary_set_id", "boundary_level", "boundary_vintage",
             "land_area_sq_km", "geometry")]
}

boundary <- build_boundary(boundary_path)

# full-extent gate: the bounding box must span the western atolls (Enewetak near
# 160.9E), the eastern atolls (Mili near 172.2E), the southern atolls (Ebon near
# 4.6N), and the northern atolls (Bikar/Utirik near 14.6N). no dateline handling is
# needed (the extent is wholly east-positive, well west of 180).
bbox <- st_bbox(boundary)
if (bbox[["xmin"]] > 161.0 || bbox[["xmax"]] < 172.0 ||
    bbox[["ymin"]] > 5.0 || bbox[["ymax"]] < 14.5) {
  stop("boundary bbox does not span the full RMI atoll extent", call. = FALSE)
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
if (nrow(written) != 24L) stop("simplified boundary does not contain 24 features", call. = FALSE)
w_valid <- st_is_valid(written)
if (any(st_is_empty(written)) || any(is.na(w_valid)) || any(!w_valid)) {
  stop("simplified boundary has empty or invalid geometries", call. = FALSE)
}
geom_hashes <- geometry_hashes(written)
if (length(unique(geom_hashes)) != 24L) stop("simplified boundary geometry hashes are not distinct", call. = FALSE)
message(sprintf("boundary: PASSED (24 valid distinct features, %d bytes at %g%% keep)",
                file_bytes(boundary_out), simplification[["keep_percent"]]))

# land area, unit id, and area code keyed by atoll display name; Bikini has none.
land_area <- setNames(round(written[["land_area_sq_km"]], 4), written[["area_name"]])
area_unit <- setNames(written[["area_unit_id"]], written[["area_name"]])
area_code <- setNames(written[["area_code"]], written[["area_name"]])

# ---- product rows --------------------------------------------------------------

# the verbatim source frame recorded on every row (the 16 Table 9 categories).
source_categories_verbatim <- paste(categories, collapse = "|")

flag_base <- paste(
  "census_affiliation",
  "all_persons_all_ages_universe",
  "denominator_resident_population_atoll_total",
  "affiliation=sum_of_fifteen_religious_categories",
  "no_religion=none_line_only_no_separate_refused_or_notstated",
  "single_wave_2021",
  "source_frame_2021_sixteen_category",
  "licence_needs_review_pending_pi_ruling_eppso_spc_partial_reproduction_clause",
  "boundary_odbl_1_0",
  sep = ";")
flag_bikini <- paste0(flag_base,
  ";zero_population_atoll;no_boundary_feature_map_join_excludes_bikini;shares_null_zero_denominator")
flag_rongelap <- paste0(flag_base,
  ";zero_population_atoll;has_boundary_feature;shares_null_zero_denominator")

pop_basis <- paste(
  "2021 RMI Census Volume 1 Table 9 'Population by Urban/Rural and atoll by religion',",
  "all persons of all ages; the denominator is the printed atoll Total. Religious",
  "affiliation is the sum of the fifteen religious categories (every category except",
  "None); no-religion is the printed None line only. Zero-population atolls (Bikini,",
  "Rongelap) carry zero counts and null shares (zero denominator)."
)

# build one schema-shaped area-summary row. pop 0 yields null shares (0/0).
make_row <- function(a) {
  pop <- total_atoll[[a]]
  none <- tab[[a]][[no_religion_category]]
  affiliation <- pop - none
  has_pop <- pop > 0L
  has_geom <- a %in% boundary_atolls
  flag <- if (a == "Bikini") flag_bikini else if (a == "Rongelap") flag_rongelap else flag_base
  # structured area-summary.v2 composition: one item per printed Table 9 category for
  # this atoll, carrying the source-verbatim label and the exact published atoll count.
  # the census prints counts, not percentages, so no percent is derived. every Table 9
  # cell is a printed integer with no confidentiality suppression, so all sixteen
  # categories emit, including printed zeros; the sixteen counts sum to the atoll total,
  # the None cell equals no_religion_count, and the other fifteen sum to
  # religious_affiliation_count. taxonomy_code links to denomination-taxonomy.json only
  # where the mapping is unambiguous.
  composition <- lapply(categories, function(cat) {
    item <- list(label_verbatim = cat, count = as.integer(tab[[a]][[cat]]))
    tax <- category_taxonomy[[cat]]
    if (!is.na(tax)) item[["taxonomy_code"]] <- tax
    item
  })
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = if (has_geom) unname(area_unit[[a]]) else paste(boundary_set_id, slug[[a]], sep = ":"),
    area_code = unname(slug[[a]]),
    area_name = a,
    year = 2021L,
    population_total = as.integer(pop),
    population_total_basis = pop_basis,
    religious_affiliation_count = as.integer(affiliation),
    religious_affiliation_percent = if (has_pop) round(100 * affiliation / pop, 4) else NULL,
    no_religion_count = as.integer(none),
    no_religion_percent = if (has_pop) round(100 * none / pop, 4) else NULL,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = if (has_geom) unname(land_area[[a]]) else NULL,
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(d2021, d_boundary),
    quality_flag = flag,
    composition = composition
  )
}

rows <- lapply(atolls, make_row)

# ---- area-summary document -----------------------------------------------------

licence_pending <- paste(
  "The 2021 RMI Census Volume 1 carries an explicit EPPSO/SPC partial-reproduction-",
  "with-acknowledgement clause (quoted verbatim in the manifest). The derived atoll",
  "summaries carry attribution to the RMI Economic Policy, Planning and Statistics",
  "Office (EPPSO) and the Pacific Community (SPC) and ship under the build-then-ask",
  "ruling while an EPPSO courtesy reuse-confirmation ask goes out; a PI ruling",
  "confirms the clause suffices for the project's derived summaries."
)

source_datasets <- function() {
  list(
    list(
      source_dataset_id = d2021,
      name = "RMI 2021 Census Report Volume 1: Basic Tables and Administrative Report, Table 9: Population by Urban/Rural and atoll by religion",
      provider = "RMI Economic Policy, Planning and Statistics Office (EPPSO); Pacific Community (SPC), Statistics for Development Division",
      url = census_2021_url, retrieval_date = retrieval_date, local_path = census_2021_path,
      licence = list(name = licence_pending, url = census_lib_url,
                     attribution = "Marshall Islands EPPSO and Pacific Community (SPC), 2021 RMI Census of Population and Housing"),
      citation = "Marshall Islands EPPSO and SPC, 2021 RMI Census Report Volume 1: Basic Tables and Administrative Report, Table 9.",
      access_limits = NULL,
      redistribution_limits = "Derived atoll summaries only. Ships with EPPSO/SPC attribution under the partial-reproduction clause and the build-then-ask ruling, pending a PI licence ruling.",
      notes = paste("All persons, all ages; 25 atoll/island rows x 16 religion categories.",
                    "Every atoll row closes to its printed total, the 25 rows close column-wise to the",
                    "national totals for all 16 categories, and Rural (8,963) + Urban (32,612) = Total",
                    "(41,575). Bikini and Rongelap print zero population.")),
    list(
      source_dataset_id = d_boundary,
      name = "geoBoundaries MHL ADM1 (24 atolls)",
      provider = "geoBoundaries (William & Mary geoLab); source OpenStreetMap, Wambacher",
      url = boundary_url, retrieval_date = retrieval_date, local_path = boundary_path,
      licence = list(name = "Open Data Commons Open Database License 1.0", url = boundary_meta_url,
                     attribution = "geoBoundaries (gbOpen); boundary source OpenStreetMap contributors, Wambacher"),
      citation = "geoBoundaries MHL ADM1 (gbOpen, pinned 9469f09), 24 atoll boundaries.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary is committed with ODbL 1.0 attribution (OpenStreetMap contributors).",
      notes = paste("24 ADM1 atolls, boundaryYearRepresented 2017, joined one-to-one on shapeName with no",
                    "concordance needed. The census carries 25 atoll rows; the extra Bikini row (population 0)",
                    "has no ADM1 polygon and is kept in the data with a disclosure flag. Extent 160.9-172.2 E,",
                    "4.6-14.6 N; wholly east-positive, so no antimeridian handling is needed."))
  )
}

indicators <- function() {
  list(
    list(indicator_id = "population_total", label = "Census population total",
         description = "Atoll all-persons population represented in the 2021 religion table.",
         unit = "count", denominator_indicator_id = NULL,
         method = "Printed atoll Total from 2021 Census Volume 1 Table 9.",
         temporal_coverage = "2021", spatial_coverage = "RMI atolls/islands (25 rows; 24 mapped)",
         quality_notes = "All persons of all ages. Bikini and Rongelap print zero population (resettlement history)."),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
         description = "Share of the atoll population with a stated religious affiliation (all fifteen religious bodies).",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (atoll Total - None) / atoll Total. Null for zero-population atolls (Bikini, Rongelap).",
         temporal_coverage = "2021", spatial_coverage = "RMI atolls/islands (25 rows; 24 mapped)",
         quality_notes = "Affiliation sums the fifteen religious categories, including Other (specify) as a residual religious affiliation. Only the None line is treated as no-religion."),
    list(indicator_id = "no_religion_percent", label = "No religious affiliation %",
         description = "Share reporting no religion (the printed None line).",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * None / atoll Total. Null for zero-population atolls (Bikini, Rongelap).",
         temporal_coverage = "2021", spatial_coverage = "RMI atolls/islands (25 rows; 24 mapped)",
         quality_notes = "The frame carries a single None line and no separate refused or not-stated line, so no-religion is the None count exactly and every other category stays in the affiliation denominator.")
  )
}

visual_layers <- function() {
  list(
    list(visual_layer_id = "mh-atoll-religious-affiliation", label = "Religious affiliation %",
         description = "RMI census-affiliation share by atoll.", layer_type = "choropleth",
         indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "atoll all-persons total"),
         colour_scale = "sequential", time_control = "none",
         aggregation_rule = "reported atoll value", uncertainty_display = "quality_flag",
         default_visibility = TRUE,
         notes = "Census affiliation, not practice, attendance, or membership. Single wave (2021). Bikini and Rongelap are null (zero population); Bikini has no boundary feature."),
    list(visual_layer_id = "mh-atoll-no-religion", label = "No religious affiliation %",
         description = "RMI None-line share by atoll.", layer_type = "choropleth",
         indicator_ids = list("no_religion_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "atoll all-persons total"),
         colour_scale = "sequential", time_control = "none",
         aggregation_rule = "reported atoll value", uncertainty_display = "quality_flag",
         default_visibility = FALSE,
         notes = "The printed None line only (444 nationally); no separate refused or not-stated line exists. Zero-population atolls are null.")
  )
}

summary_product <- list(
  schema_version = "area-summary.v2", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code,
                      level = boundary_level, vintage = "2017", source_dataset_id = d_boundary),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "No governed place-of-worship snapshot ships in the RMI census product.",
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
      place_density_per_sq_km = NA_real_,
      land_area_sq_km = if (is.null(r[["land_area_sq_km"]])) NA_real_ else r[["land_area_sq_km"]],
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
       raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/mh_census/"))
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

licence_basis_slug <- "eppso_spc_partial_reproduction_with_acknowledgement_pending_pi_ruling"

# the EPPSO/SPC reuse clause, quoted verbatim from the cached 2021 Volume 1 front
# matter (sha256 5a99ec72...4f3dd3). the office is spelled "EPSSO" in this line.
eppso_spc_clause_verbatim <- paste(
  "© Pacific Community (SPC), the Marshall Islands Economic Policy, Planning and",
  "Statistics Office (EPSSO) 2022. All rights for commercial/for profit reproduction",
  "or translation, in any form, reserved. SPC and the EPSSO authorise the partial",
  "reproduction or translation of this material for scientific, educational or research",
  "purposes, provided that SPC and EPSSO, and the source document are properly",
  "acknowledged. Permission to reproduce the document and/or translate in whole, in any",
  "form, whether for commercial/for profit or non-profit purposes, must be requested in",
  "writing. Original SPC and the EPSSO artwork may not be altered or separately",
  "published without permission."
)

raw_sources <- list(
  raw_source_record(census_2021_path, census_2021_url, "pdf", TRUE, "2021", d2021,
    paste("2021 Census Volume 1 (rmihealth.org mirror); Table 9 Religion by Urban/Rural and atoll",
          "(text-extractable). Every margin closes: atoll rows to printed totals, 25 rows column-wise to",
          "the 16 national category totals, Rural + Urban = Total = 41,575. SHA-256 matches the route probe.")),
  raw_source_record(analytical_2021_path, analytical_2021_url, "pdf", FALSE, "1999,2021", d2021,
    paste("2021 Analytical Report (infomarshallislands.com mirror); Figure 3.3 national 1999-vs-2021",
          "affiliation-percentage comparison. Contextual only; no atoll counts and no product rows derive from it.")),
  raw_source_record(boundary_path, boundary_url, "geojson", TRUE, "2017", d_boundary,
    "geoBoundaries MHL ADM1 GeoJSON; 24 atolls, ODbL 1.0. Pinned commit 9469f09. Joins the census roster minus Bikini."),
  raw_source_record(boundary_meta_path, boundary_meta_url, "json", FALSE, "2017", d_boundary,
    "geoBoundaries MHL ADM1 metadata; records ODbL 1.0, boundarySource 'OpenStreetMap, Wambacher', admUnitCount 24, boundaryYearRepresented 2017.")
)

dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)
dataset_id <- "mh-census-religion:mh:2021:eppso-spc-atoll"

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
  dataset_family = "mh-census-religion", dataset_role = "staged_evidence",
  scope = list(level = "country", country_codes = list("MH"), snapshot_date = NULL,
               snapshot_anchor = NULL, pipeline_stage = "staged"),
  created_at = stamp, created_by = script_id,
  target_years = list(2021L),
  pipeline = list(
    script = script_id, git_commit = NULL, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation",
      shipped_waves = list(2021L),
      shipped_geography = "25 RMI atoll/island rows (24 mapped; Bikini unmapped, population 0)",
      boundary_set = boundary_set_id,
      source_tables = list(
        `2021` = "Volume 1 Table 9 Population by Urban/Rural and atoll by religion (all persons, all ages)"
      ),
      universes = list(`2021` = "all persons, all ages (41,575)"),
      denominators = list(
        `2021` = "printed atoll Total; affiliation = atoll Total minus None; no-religion = None line only"
      ),
      category_frame = list(
        `2021` = as.list(categories),
        source_categories_verbatim = source_categories_verbatim,
        no_religion_treatment = paste(
          "The frame carries a single 'None' line (444 nationally) and no separate refused or not-stated",
          "line, so no-religion is the None count exactly and every other category (including 'Other",
          "(specify)') stays in the affiliation denominator as a religious body."
        )
      ),
      change_rule = paste(
        "Single wave (2021 only). No atoll-level change metric is emitted; no religious_change and no",
        "change_withheld token is produced. The atoll counts exist for 2021 alone."
      ),
      national_context_not_shipped = paste(
        "The 2021 Analytical Report (Figure 3.3) carries a national 1999-vs-2021 affiliation-percentage",
        "comparison. It is recorded as context only and does not become data rows: 1999 religion (Table 11)",
        "is a three-sector urban/rural table with an image-only body (HELD, needs OCR), and 2011 has no",
        "public religion table in any located report (HELD, licensed microdata only)."
      ),
      bikini_handling = paste(
        "The census prints 25 atoll rows; geoBoundaries MHL ADM1 has 24 polygons. Bikini (population 0) has",
        "no polygon: the record is kept in the area summary with a zero-population, no-boundary-feature",
        "disclosure flag, and the map joins the other 24. Rongelap (also population 0) has a polygon and is",
        "mapped; both zero-population atolls carry zero counts and null shares (zero denominator)."
      ),
      omitted_metrics = list("places_per_10000_residents", "place_density_per_sq_km"),
      boundary_simplification = simplification,
      local_cache_hint = "All raw sources are cached under data/raw/mh_census/ and remain git-ignored.",
      retrieval_record = raw_sources
    ),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")), digest = as.character(packageVersion("digest")),
      mapshaper = "scripts/lib/simplify_boundary.R (npx mapshaper)"
    )
  ),
  source = list(
    provider = "RMI Economic Policy, Planning and Statistics Office (EPPSO); Pacific Community (SPC) Statistics for Development Division; geoBoundaries (William & Mary geoLab); OpenStreetMap contributors, Wambacher",
    source_dataset_ids = list(d2021, d_boundary),
    source_urls = list(census_2021_url, analytical_2021_url, census_lib_url, boundary_url, boundary_meta_url),
    retrieved_at = stamp,
    licence = paste(
      "The 2021 RMI Census Volume 1 carries an explicit EPPSO/SPC partial-reproduction-with-acknowledgement",
      "clause, quoted verbatim in this manifest's licence_position_verbatim_from_playbook field. The derived",
      "atoll summaries carry attribution to the RMI EPPSO and the Pacific Community (SPC) and ship with",
      "attribution under the build-then-ask ruling while an EPPSO courtesy reuse-confirmation ask goes out; a",
      "PI ruling confirms the clause suffices for the project's derived summaries. The PDH microdata",
      "(catalog/812) are licensed/restricted and unused. Boundaries are geoBoundaries MHL ADM1, Open Data",
      "Commons Open Database License 1.0, attribution OpenStreetMap contributors and Wambacher."
    ),
    citation = "Marshall Islands EPPSO and SPC, 2021 RMI Census Report Volume 1, Table 9; geoBoundaries MHL ADM1 (gbOpen).",
    raw_redistribution = "The census PDFs and the geoBoundaries source GeoJSON are not committed; they remain in data/raw/mh_census/.",
    local_cache_hint = "data/raw/mh_census/ (git-ignored by .gitignore data/ rule)",
    licence_position = "ship_with_attribution_under_partial_reproduction_clause_pending_pi_ruling",
    licence_position_verbatim_from_playbook = eppso_spc_clause_verbatim,
    licence_todo = "Send an EPPSO/SPC courtesy reuse-confirmation email; confirm the partial-reproduction clause suffices for the derived atoll summaries under a PI ruling."
  ),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = list(
    durable_file_record(summary_json_out, "RMI 25-row atoll census-affiliation area summary for 2021 (24 mapped; Bikini unmapped).", "needs_review", licence_basis_slug),
    durable_file_record(summary_csv_out, "Flattened RMI 25-row atoll census-affiliation rows for 2021.", "needs_review", licence_basis_slug),
    durable_file_record(boundary_out, "Simplified geoBoundaries MHL ADM1 24-atoll boundary GeoJSON.", "accepted", "geoboundaries_odbl_1_0")
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id,
         notes = "25 atoll rows x 1 wave = 25 rows; all-persons universe; Bikini and Rongelap zero population with null shares."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out), built_by = script_id,
         notes = "24 atoll features from geoBoundaries MHL ADM1, simplified with mapshaper weighted keep-shapes; Bikini has no polygon.")
  ),
  validation = list(
    status = "passed_with_warnings",
    commands = list(
      paste("Rscript", script_id),
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/mh/data/area_summary_atoll.json",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/data-manifest.schema.json docs/manifests/mh-census-religion-2021.json",
      "bash scripts/validate_manifests.sh"
    ),
    gate_2021 = list(status = "passed", national_close_to = national_total,
                     atoll_row_checks = length(atolls),
                     category_column_checks = length(categories),
                     urban_rural_split_checks = length(categories),
                     rural_total = rural_total, urban_total = urban_total,
                     records = reconciliation_block(rec_2021)),
    boundary_validation = list(status = "passed", feature_count = 24L,
                               distinct_geometry_hashes = length(unique(geom_hashes)),
                               geometry_hashes = as.list(geom_hashes),
                               bbox = list(xmin = unname(bbox[["xmin"]]), ymin = unname(bbox[["ymin"]]),
                                           xmax = unname(bbox[["xmax"]]), ymax = unname(bbox[["ymax"]])),
                               full_extent_note = "bbox spans lon 160.9-172.2E and lat 4.6-14.6N; wholly east-positive, no antimeridian handling needed",
                               output_bytes = file_bytes(boundary_out), simplification = simplification,
                               licence = boundary_metadata[["boundaryLicense"]], adm_unit_count = boundary_metadata[["admUnitCount"]]),
    join_coverage = list(matched_atolls = 24L, expected_boundary_atolls = 24L,
                         unmapped_census_rows = list("Bikini"),
                         unmatched_atolls = list(), unused_boundary_features = list()),
    notes = paste(
      "The single 2021 wave reconciles at every margin with zero difference: 25 atoll rows close to their",
      "printed totals, the 25 rows close column-wise to the 16 national category totals, and Rural (8,963)",
      "+ Urban (32,612) = Total (41,575). Boundary joins 24/24 to geoBoundaries MHL ADM1 with 24 distinct",
      "geometry hashes; the 25th census row (Bikini, population 0) has no polygon and is kept in the data."
    ),
    warnings = list(
      "STAGED product: no page, no hub link. Licence needs review pending a PI ruling; the source carries an explicit EPPSO/SPC partial-reproduction-with-acknowledgement clause and the product ships with attribution under the build-then-ask ruling.",
      "Single wave (2021). No atoll-level change metric exists; no change_withheld token is emitted.",
      "Bikini (census row 25, population 0) has no geoBoundaries ADM1 polygon; the record is kept with a disclosure flag and the map joins 24 atolls. Rongelap (also population 0) has a polygon and is mapped. Both carry null shares (zero denominator).",
      "The 1999-vs-2021 national affiliation comparison (Analytical Report Figure 3.3) is recorded as context only and is not a data row; 1999 atoll (three-sector image-only) and 2011 (no public religion table) are both HELD.",
      "The route-probe map annotation naming Kili's second body 'New Beginning Church (68)' does not match Table 9 under the verbatim column order: Kili's two 68-cells are Assembly of God (position 3) and Protestant Church (position 13); New Beginning Church is 0 for Kili. The table governs; the annotation is narrative and does not affect the counts."
    )
  ),
  construct_notes = list(
    "The construct is census affiliation: each resident's reported religion (2021 questionnaire item P6, asked of all persons; for a young child, the religion of the parents), not practice, attendance, or membership.",
    "The public product carries three headline fields per atoll: population total, religious affiliation percent, and no-religion percent. Place-density metrics are null (no governed place-of-worship snapshot).",
    "Single wave: the atoll-level religion table exists for 2021 only, so the product is a snapshot, not a change series. No atoll-level change metric is emitted and no change_withheld token is produced.",
    "The 16-category frame is preserved verbatim: United Church of Christ, Roman Catholic, Assembly of God, Jehovah's Witness, Reformed Congregational Church, Mormon, Seventh Day Adventist, Bukot Nan Jesus, None, Full Gospel, Salvation Army, Other (specify), Protestant Church, New Beginning Church, Baptist Church, Batkan Light House Church.",
    "No-religion slot: the frame carries a single None line (444 nationally) and no separate refused or not-stated line, so no-religion is the None count exactly and every other category (including Other (specify)) stays in the affiliation denominator as a religious body.",
    "Bikini join gap: the census prints 25 atoll rows; geoBoundaries MHL ADM1 has 24 polygons. Bikini (population 0) has no polygon and is kept in the data with a disclosure flag; the map joins the other 24. Rongelap (also population 0) has a polygon and is mapped. Both zero-population atolls carry zero counts and null shares.",
    "National context, not shipped as data: the 2021 Analytical Report (Figure 3.3) carries a national 1999-vs-2021 affiliation-percentage comparison. 1999 religion (Table 11) is a three-sector urban/rural table with an image-only body (HELD, needs OCR); 2011 has no public religion table in any located report (HELD, licensed microdata only).",
    "Boundary: geoBoundaries MHL ADM1, 24 atolls, ODbL 1.0 (attribution OpenStreetMap contributors, Wambacher). The 24 atolls join one-to-one on shapeName with no concordance needed. The extent spans longitude 160.9E (Enewetak) to 172.2E (Mili) and latitude 4.6N (Ebon) to 14.6N (northern atolls); wholly east-positive, so no antimeridian handling is needed."
  ),
  deferred_sources = list(
    list(source_dataset_id = "mh-census-2011-religion-by-atoll", status = "deferred",
         url = census_lib_url, local_path = NULL,
         notes = paste("Religion was collected in 2011 (questionnaire item P6) but never cross-tabulated in any located",
                       "public 2011 output; the analytical report has no religion chapter and the summary report no",
                       "religion table. The only 2011 religion route is the licensed Pacific Data Hub microdata",
                       "(catalog/22), a HELD restricted source. Unblock: an EPPSO/SPC custom tabulation or a released",
                       "2011 basic-tables volume.")),
    list(source_dataset_id = "mh-census-1999-religion-by-atoll", status = "deferred",
         url = "https://sdd.spc.int/digital_library/marshall-islands-census-report-1999", local_path = NULL,
         notes = paste("The 1999 religion table (Table 11) is a three-sector urban/rural split (urban Majuro, urban",
                       "Ebeye, rural), not by atoll, and its table body is image-only (no text layer; needs OCR). It",
                       "supports a national/sector percentage context, not an atoll wave.")),
    list(source_dataset_id = "mh-eppso-spc-licence-confirmation", status = "not_pinned",
         url = census_lib_url, local_path = NULL,
         notes = "An EPPSO/SPC reuse-confirmation email is the clean confirmation for the licence gate under the build-then-ask ruling; none is held.")
  ),
  privacy = "public",
  licence_status = "needs_review",
  licence_basis = licence_basis_slug,
  downstream_status = "staged",
  source_datasets = source_datasets(),
  notes = paste(
    "STAGED product (no page, no hub link) pending a PI licence ruling. The committed products are the derived",
    "25-row atoll area summary (single 2021 wave; 24 mapped, Bikini unmapped) and the simplified geoBoundaries",
    "MHL ADM1 24-atoll boundary. On-page attribution, when a page is built, must cite the Marshall Islands EPPSO",
    "and the Pacific Community (SPC), and geoBoundaries (ODbL 1.0, OpenStreetMap contributors / Wambacher)."
  )
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

cat("wave shipped: 2021 (all persons) on 25 RMI atoll/island rows (24 mapped; Bikini unmapped)\n")
cat(sprintf("rows: %d (25 atolls x 1 wave)\n", length(rows)))
cat(sprintf("gate 2021: passed; all margins close to %d (rural %d + urban %d)\n",
            national_total, rural_total, urban_total))
cat(sprintf("boundary gate: passed; 24/24 join, %d distinct geometry hashes, %d bytes at %g%% keep\n",
            length(unique(geom_hashes)), file_bytes(boundary_out), simplification[["keep_percent"]]))
cat("change: single wave; no atoll-level change metric; no change_withheld token\n")
cat("licence gate: needs_review; STAGED; EPPSO/SPC partial-reproduction clause; ships with attribution under build-then-ask\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", boundary_out))
cat(sprintf("wrote %s\n", manifest_out))
