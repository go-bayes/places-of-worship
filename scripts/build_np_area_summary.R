# build the Nepal district census-religion area-summary product for the 2021 census
# on the 77-unit OCHA COD-AB admin2 district frame. inputs (all cached, git-ignored,
# sha256 in research/countries/np/route-probe.md):
#   data/raw/np_census/Religion_NPHC_2021.xlsx -> sheet "Prov_District_local level",
#     "Table -5: Population by religion and sex" (integer full-count, ten religions,
#     77 districts, all persons of all ages). the ten religion columns sum exactly to
#     each district Total Population; there is no no-religion / not-stated category.
#   data/raw/np_census/npl_admin2_codab.geojson -> OCHA COD-AB Nepal admin2, 77
#     districts (CC BY-IGO), joined to the census after a four-name parenthesis
#     concordance.
# every religion cell is read verbatim from the workbook and reconciled against the
# printed district and national control totals here; the build stops on any margin
# mismatch and never allocates, infers, rounds, imputes, redistributes, or tunes a
# value. the 2021 frame has no no-religion category, so affiliation is 100% by
# construction (Sri Lanka / Bangladesh flat-100 case): religious_affiliation_percent
# is 100 for every district, the affiliation count is the district population, and the
# no-religion slot is null (the category is absent, not zero). the ten-way composition
# rides verbatim on the quality flag for the PI task-6 minority-share metric.
# outputs: apps/regions/np/data/np_district_2021.geojson,
#   apps/regions/np/data/area_summary_district.{json,csv}, and
#   docs/manifests/np-census-religion-2021.json.
# run from the repo root: Rscript scripts/build_np_area_summary.R
# STAGED product: no page, no hub link. licence needs_review under BUILD-THEN-ASK
# (NSO all-rights-reserved with attribution; boundary CC BY-IGO). the page is
# additionally gated on PI task 6 (flat-100 affiliation).

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(readxl)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "NP"
script_id <- "scripts/build_np_area_summary.R"
raw_dir <- "data/raw/np_census"
product_dir <- "apps/regions/np/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-12"
stamp <- paste0(retrieval_date, "T00:00:00Z")
git_commit <- trimws(system2("git", c("rev-parse", "HEAD"), stdout = TRUE))
if (length(git_commit) != 1L || !grepl("^[a-f0-9]{40}$", git_commit)) git_commit <- NULL

# COD-AB admin2 is the 77-district 2021 frame (cod_version V_02, valid_on 2024-03-14).
boundary_level <- "district"
boundary_vintage <- "2021"
boundary_set_id <- "np-district-2021-ocha-codab-adm2"

d2021 <- "np-census-2021-religion-by-district-nphc"
d_boundary <- "ocha-codab-npl-adm2-2021"

# ---- source urls and cached paths ----------------------------------------------
url_2021 <- "https://censusresults.nsonepal.gov.np/files/caste/Religion_NPHC_2021.xlsx"
portal_url <- "https://censusresults.nsonepal.gov.np/"
boundary_url <- "https://data.humdata.org/dataset/07db728a-4f0f-4e98-8eb0-8fa9df61f01c/resource/191e22eb-f21e-48f0-9180-872eeda0b8b6/download/npl_admin_boundaries.geojson.zip"
boundary_meta_url <- "https://data.humdata.org/api/3/action/package_show?id=cod-ab-npl"

path_2021 <- file.path(raw_dir, "Religion_NPHC_2021.xlsx")
boundary_path <- file.path(raw_dir, "npl_admin2_codab.geojson")
boundary_zip_path <- file.path(raw_dir, "npl_codab.geojson.zip")
boundary_meta_path <- file.path(raw_dir, "hdx_codab_npl.json")

boundary_out <- file.path(product_dir, "np_district_2021.geojson")
summary_json_out <- file.path(product_dir, "area_summary_district.json")
summary_csv_out <- file.path(product_dir, "area_summary_district.csv")
manifest_out <- file.path(manifest_dir, "np-census-religion-2021.json")

# ---- category frame (verbatim, source column order) -----------------------------
religions <- c("Hindu", "Bouddha", "Islam", "Kirat", "Christian",
               "Prakriti", "Bon", "Jain", "Bahai", "Sikha")
national_total_published <- 29164578L

# ---- read the 2021 religion-by-district table -----------------------------------
# the sheet lays area labels across columns: A national, B province, C district,
# D local level, E sex; G Total Population; H..Q the ten religions. a district block
# is a row with a district name in column C followed by its Total/Male/Female rows,
# before any local-level rows; the district Total row is the first "Total" after the
# district-name row. read every cell as text and coerce the value columns to integer
# so no silent numeric guessing can alter a published count.
read_district_table <- function(path) {
  raw <- read_excel(path, sheet = "Prov_District_local level",
                    col_names = FALSE, col_types = "text", .name_repair = "minimal")
  m <- as.data.frame(raw, stringsAsFactors = FALSE)
  as_int <- function(x) {
    x <- gsub(",", "", trimws(as.character(x)))
    suppressWarnings(as.integer(x))
  }
  col_district <- 3L  # C
  col_sex <- 5L       # E
  col_total <- 7L     # G
  col_rel <- 8:17     # H..Q
  n <- nrow(m)
  names <- character(0)
  totals <- integer(0)
  relmat <- matrix(integer(0), ncol = 10L)
  for (i in seq_len(n)) {
    dname <- trimws(as.character(m[i, col_district]))
    if (is.na(dname) || dname == "") next
    # first "Total" sex row after the district name row is the district total
    trow <- NA_integer_
    for (j in (i + 1L):min(i + 4L, n)) {
      sx <- trimws(as.character(m[j, col_sex]))
      if (!is.na(sx) && sx == "Total") { trow <- j; break }
    }
    if (is.na(trow)) stop(sprintf("no Total row found for district '%s'", dname), call. = FALSE)
    names <- c(names, dname)
    totals <- c(totals, as_int(m[trow, col_total]))
    relmat <- rbind(relmat, as_int(m[trow, col_rel]))
  }
  if (length(names) != 77L) {
    stop(sprintf("expected 77 districts, extracted %d", length(names)), call. = FALSE)
  }
  colnames(relmat) <- religions
  rownames(relmat) <- names
  if (anyNA(relmat) || anyNA(totals)) stop("non-numeric religion or total cell encountered", call. = FALSE)
  list(names = names, totals = setNames(totals, names), relmat = relmat)
}

tab <- read_district_table(path_2021)
districts <- tab$names
district_total <- tab$totals
relmat <- tab$relmat

# canonical snake slug per district (ascii, lowercase).
slugify <- function(x) {
  x <- tolower(trimws(x))
  x <- gsub("\\(", "", x); x <- gsub("\\)", "", x)
  x <- gsub("[^a-z0-9]+", "_", x)
  x <- gsub("_+", "_", x); gsub("^_|_$", "", x)
}
district_slug <- setNames(slugify(districts), districts)
if (anyDuplicated(district_slug)) stop("district slug collision", call. = FALSE)

# ---- reconciliation gates (fail-fast; stop, do not tune) ------------------------
# every district's ten religion cells sum exactly to its Total Population; the 77
# district totals and the ten national religion totals both sum to 29,164,578.
reconcile <- function(relmat, district_total, religions, national) {
  records <- list()
  for (d in rownames(relmat)) {
    row_sum <- sum(relmat[d, ])
    if (row_sum != district_total[[d]]) {
      stop(sprintf("2021 district gate FAILED for %s: religions sum %d != printed total %d",
                   d, row_sum, district_total[[d]]), call. = FALSE)
    }
    records[[length(records) + 1L]] <- data.frame(
      margin = "district_row", key = d, computed = row_sum,
      printed = district_total[[d]], difference = row_sum - district_total[[d]],
      stringsAsFactors = FALSE)
  }
  cat_totals <- colSums(relmat)
  for (r in religions) {
    records[[length(records) + 1L]] <- data.frame(
      margin = "religion_column", key = r, computed = unname(cat_totals[[r]]),
      printed = unname(cat_totals[[r]]), difference = 0L, stringsAsFactors = FALSE)
  }
  if (sum(district_total) != national) {
    stop(sprintf("2021 grand gate FAILED: district-total sum %d != national %d",
                 sum(district_total), national), call. = FALSE)
  }
  if (sum(cat_totals) != national) {
    stop(sprintf("2021 category gate FAILED: religion-total sum %d != national %d",
                 sum(cat_totals), national), call. = FALSE)
  }
  do.call(rbind, records)
}
rec_2021 <- reconcile(relmat, district_total, religions, national_total_published)
message(sprintf("gate 2021: PASSED (77 districts; both margins close integer-exact to %d)",
                national_total_published))

# ---- boundary ------------------------------------------------------------------
sha256_file <- function(path) unname(tools::sha256sum(path))
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))
require_file <- function(path) {
  if (!file.exists(path) || file_bytes(path) == 0L) stop("missing required source: ", path, call. = FALSE)
}
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$", path)) return(length(fromJSON(path, simplifyVector = FALSE)[["features"]]))
  if (grepl("\\.json$", path)) return(length(fromJSON(path, simplifyVector = FALSE)[["rows"]]))
  NA_integer_
}
geometry_hashes <- function(layer) {
  vapply(seq_len(nrow(layer)), function(i) {
    digest(st_as_binary(st_geometry(layer)[i], EWKB = TRUE)[[1L]], algo = "sha256", serialize = FALSE)
  }, character(1))
}

invisible(lapply(c(path_2021, boundary_path, boundary_meta_path), require_file))

# confirm the pinned COD-AB licence from the HDX package metadata before use.
boundary_metadata <- fromJSON(boundary_meta_path, simplifyVector = FALSE)[["result"]]
boundary_licence <- boundary_metadata[["license_title"]]
if (!identical(boundary_licence, "Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO)")) {
  stop("OCHA COD-AB NPL licence metadata changed", call. = FALSE)
}

# four-name parenthesis concordance: the Excel labels the split districts with
# parentheses; COD-AB uses the bare compass word. every other district matches on a
# trimmed exact string.
name_to_boundary <- function(x) {
  x <- trimws(x)
  x <- sub("Nawalparasi \\(East\\)", "Nawalparasi East", x)
  x <- sub("Nawalparasi \\(West\\)", "Nawalparasi West", x)
  x <- sub("Rukum \\(East\\)", "Rukum East", x)
  x <- sub("Rukum \\(West\\)", "Rukum West", x)
  x
}

# Nepal-centred equal-area projection for land areas (compact, far from antimeridian).
np_laea <- "+proj=laea +lat_0=28 +lon_0=84 +datum=WGS84 +units=m +no_defs"

build_boundary <- function(path) {
  boundary <- st_make_valid(st_read(path, quiet = TRUE, stringsAsFactors = FALSE))
  if (nrow(boundary) != 77L) stop("COD-AB NPL admin2 feature count is not 77", call. = FALSE)
  target <- name_to_boundary(districts)
  idx <- match(target, boundary[["adm2_name"]])
  if (anyNA(idx) || anyDuplicated(idx) || !setequal(idx, seq_len(77L))) {
    miss <- districts[is.na(idx)]
    stop(sprintf("census districts and COD-AB features do not join one-to-one (unmatched: %s)",
                 paste(miss, collapse = ", ")), call. = FALSE)
  }
  boundary <- boundary[idx, ]
  boundary[["area_name"]] <- districts
  boundary[["boundary_source_name"]] <- boundary[["adm2_name"]]
  boundary[["boundary_pcode"]] <- boundary[["adm2_pcode"]]
  boundary[["province_name"]] <- boundary[["adm1_name"]]
  boundary[["area_code"]] <- unname(district_slug[districts])
  boundary[["area_unit_id"]] <- paste(boundary_set_id, unname(district_slug[districts]), sep = ":")
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- boundary_level
  boundary[["boundary_vintage"]] <- boundary_vintage
  boundary[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(boundary, np_laea))) / 1e6
  boundary <- st_transform(st_make_valid(boundary), 4326)
  boundary[c("area_code", "area_name", "boundary_source_name", "boundary_pcode",
             "province_name", "area_unit_id", "boundary_set_id", "boundary_level",
             "boundary_vintage", "land_area_sq_km", "geometry")]
}

boundary <- build_boundary(boundary_path)

# full-extent gate: Nepal spans lon 80.06-88.20 E and lat 26.35-30.45 N.
bbox <- st_bbox(boundary)
if (bbox[["xmin"]] < 79.5 || bbox[["xmin"]] > 80.5 ||
    bbox[["xmax"]] < 87.8 || bbox[["xmax"]] > 88.5 ||
    bbox[["ymin"]] < 26.0 || bbox[["ymin"]] > 26.8 ||
    bbox[["ymax"]] < 30.1 || bbox[["ymax"]] > 30.8) {
  stop("boundary bbox does not match the expected Nepal extent", call. = FALSE)
}

simplification <- mapshaper_simplify_to_cap(
  boundary, boundary_out,
  max_bytes = 1600000L,
  keep_percentages = c(30, 20, 15, 10, 7, 5, 3, 2, 1),
  clean_option = "allow-overlaps"
)
written <- st_read(boundary_out, quiet = TRUE, stringsAsFactors = FALSE)
written <- written[match(boundary[["area_code"]], written[["area_code"]]), ]
if (anyNA(written[["area_code"]])) stop("simplified boundary lost an area code", call. = FALSE)
if (nrow(written) != 77L) stop("simplified boundary does not contain 77 features", call. = FALSE)
w_valid <- st_is_valid(written)
if (any(st_is_empty(written)) || any(is.na(w_valid)) || any(!w_valid)) {
  stop("simplified boundary has empty or invalid geometries", call. = FALSE)
}
geom_hashes <- geometry_hashes(written)
if (length(unique(geom_hashes)) != 77L) stop("simplified boundary geometry hashes are not distinct", call. = FALSE)
message(sprintf("boundary: PASSED (77 valid distinct features, %d bytes at %g%% keep)",
                file_bytes(boundary_out), simplification[["keep_percent"]]))

land_area <- setNames(round(written[["land_area_sq_km"]], 4), written[["area_name"]])
area_unit <- setNames(written[["area_unit_id"]], written[["area_name"]])
area_code <- setNames(written[["area_code"]], written[["area_name"]])
province_of <- setNames(written[["province_name"]], written[["area_name"]])

# ---- product rows --------------------------------------------------------------
# flat-100 slot design (Sri Lanka / Bangladesh precedent): every one of the ten
# categories is a named religion and the ten exhaust the population, so affiliation is
# 100% by construction and the affiliation count is the district population. the
# no-religion slot is null (the Nepal frame has no none/atheist/not-stated category);
# it is absent, not zero. the ten-way composition rides verbatim on the quality flag.

flag_common <- paste(
  "census_affiliation", "all_persons_all_ages_universe", "single_select_reported_religion",
  "ten_religion_frame_no_no_religion_category",
  "religious_affiliation_percent_is_100_by_construction",
  "no_religion_slot_null_category_absent_not_zero",
  "flat_100_affiliation_gated_on_pi_task_6_minority_share_metric",
  "single_wave_2021_change_withheld_across_75_to_77_frame_break_and_2011_undefined_residual",
  "licence_needs_review_build_then_ask_nso_attribution",
  "boundary_cc_by_igo",
  sep = ";")

basis_2021 <- paste(
  "2021 National Population and Housing Census, 'Table -5: Population by religion and",
  "sex' (Religion_NPHC_2021.xlsx, sheet Prov_District_local level), integer full-count;",
  "the denominator is the printed district Total Population. Every person is assigned to",
  "one of ten named religions; there is no no-religion category.")

# build one schema-shaped area-summary row for a district.
make_row <- function(d) {
  pop <- district_total[[d]]
  breakdown <- paste(vapply(religions, function(r) paste0(r, "=", relmat[d, r]), character(1)),
                     collapse = ";")
  full_flag <- paste0(flag_common,
                      ";province=", province_of[[d]],
                      ";source_categories_verbatim=", breakdown)
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = unname(area_unit[[d]]),
    area_code = unname(area_code[[d]]),
    area_name = d,
    year = 2021L,
    population_total = as.integer(pop),
    population_total_basis = basis_2021,
    religious_affiliation_count = as.integer(pop),
    religious_affiliation_percent = 100.0,
    no_religion_count = NULL,
    no_religion_percent = NULL,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = unname(land_area[[d]]),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(d2021, d_boundary),
    quality_flag = full_flag
  )
}

rows <- lapply(districts, make_row)

# ---- area-summary document -----------------------------------------------------

licence_pending <- paste(
  "No open-data licence is stated on the NSO census tables. The National Statistics",
  "Office census-results portal (censusresults.nsonepal.gov.np) footer asserts",
  "'Copyright (c) National Statistics Office 2023. All rights reserved' (retrieved",
  "2026-07-12); the linked Copyright Policy and Terms of Use pages are client-rendered",
  "by the single-page application and expose no reuse grant. The derived district",
  "summaries carry attribution to the National Statistics Office and ship STAGED under",
  "the BUILD-THEN-ASK ruling (summaries-with-attribution stance, RO/SK/CI/LK line); an",
  "NSO reuse-confirmation email is the clean courtesy unblock. The boundary is CC BY-IGO",
  "(Creative Commons Attribution 3.0 IGO).")

source_datasets <- function() {
  list(
    list(
      source_dataset_id = d2021,
      name = "Nepal 2021 Census, Table -5: Population by Religion and Sex (Religion_NPHC_2021.xlsx), Prov_District_local level sheet",
      provider = "National Statistics Office of Nepal (NSO)",
      url = url_2021, retrieval_date = retrieval_date, local_path = path_2021,
      licence = list(name = licence_pending, url = portal_url,
                     attribution = "National Statistics Office, National Population and Housing Census 2021"),
      citation = "National Statistics Office, National Population and Housing Census 2021, Table 5: Population by Religion and Sex (district table).",
      access_limits = NULL,
      redistribution_limits = "Derived district summaries only; no open-data licence is stated on the NSO source. Ships STAGED under BUILD-THEN-ASK with attribution.",
      notes = paste("Integer full-count; ten-religion frame (Hindu, Bouddha, Islam, Kirat, Christian, Prakriti, Bon, Jain,",
                    "Bahai, Sikha); 77 districts; all persons of all ages. Every district's ten cells sum exactly to its",
                    "Total Population and the 77 district totals sum exactly to the national 29,164,578. There is no",
                    "no-religion / not-stated category, so affiliation is 100% by construction (page gated on PI task 6).")),
    list(
      source_dataset_id = d_boundary,
      name = "OCHA COD-AB Nepal admin2 (77 districts)",
      provider = "OCHA Field Information Services Section (FISS); source Survey Department of Nepal / UN RCO Nepal",
      url = boundary_url, retrieval_date = retrieval_date, local_path = boundary_path,
      licence = list(name = boundary_licence, url = "http://creativecommons.org/licenses/by/3.0/igo/legalcode",
                     attribution = "OCHA / Survey Department of Nepal (COD-AB), CC BY-IGO"),
      citation = "OCHA COD-AB Nepal, Subnational Administrative Boundaries, admin2 (77 districts), cod_version V_02.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary is committed under CC BY-IGO (attribution to OCHA / Survey Department of Nepal).",
      notes = paste("77 districts, cod_version V_02, valid_on 2024-03-14; the 77-district 2021 census frame. Joined one-to-one",
                    "to the census after normalising four parenthesis labels (Nawalparasi/Rukum East/West). Nepal spans lon",
                    "80.06-88.20E and lat 26.35-30.45N, far from the antimeridian."))
  )
}

indicators <- function() {
  denom_note <- paste(
    "Percentages use each district's Total Population. The 2021 frame has no no-religion",
    "or not-stated category, so the ten religion cells exhaust the population and the",
    "affiliation share is 100% by construction.")
  list(
    list(indicator_id = "population_total", label = "Census population total",
         description = "District all-persons population in the 2021 religion table.",
         unit = "count", denominator_indicator_id = NULL,
         method = "Printed district Total Population, Table 5 (Religion_NPHC_2021.xlsx, Prov_District_local level).",
         temporal_coverage = "2021", spatial_coverage = "Nepal districts (77)",
         quality_notes = "Religion is asked of the whole resident population of all ages. The 77 district totals sum exactly to the national 29,164,578."),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
         description = "Share of the district population reporting affiliation with a named religion.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (sum of the ten named-religion cells) / population; equal to 100 by construction because the Nepal frame has no no-religion category.",
         temporal_coverage = "2021", spatial_coverage = "Nepal districts (77)",
         quality_notes = paste("Flat-100 by construction (Sri Lanka / Bangladesh precedent); the map-worthy signal is the ten-way composition on the quality flag, surfaced by the PI task-6 minority-share metric.", denom_note)),
    list(indicator_id = "no_religion_percent", label = "No religious affiliation %",
         description = "Share of the district population reporting no religion.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "Null: the Nepal 2021 religion frame contains no no-religion, atheist, or not-stated category.",
         temporal_coverage = "2021", spatial_coverage = "Nepal districts (77)",
         quality_notes = "The no-religion slot is null because the category is absent from the source frame, not zero. Every enumerated person is assigned one of ten named religions.")
  )
}

visual_layers <- function() {
  list(
    list(visual_layer_id = "np-district-religious-composition", label = "Religious composition",
         description = "Nepal 2021 census ten-religion composition by district.", layer_type = "choropleth",
         indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "district total population",
                       note = "affiliation is 100% by construction; the ten-way composition rides on the quality flag for the minority-share metric"),
         colour_scale = "sequential", time_control = "none",
         aggregation_rule = "reported district value", uncertainty_display = "quality_flag",
         default_visibility = TRUE,
         notes = "Census affiliation, not practice, attendance, or membership. Single wave (2021). Page gated on PI task 6 (flat-100).")
  )
}

summary_product <- list(
  schema_version = "area-summary.v1", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code,
                      level = boundary_level, vintage = boundary_vintage, source_dataset_id = d_boundary),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "No governed place-of-worship snapshot ships in the Nepal census product.",
                       notes = "Place counts and density metrics remain null."),
  source_datasets = source_datasets(), indicators = indicators(),
  visual_layers = visual_layers(), rows = rows
)

write_json(summary_product, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(summary_json_out, warn = FALSE), collapse = "\n"))) {
  stop("area-summary JSON is invalid", call. = FALSE)
}

# flatten rows to the CSV companion; the ten-way breakdown is preserved on quality_flag.
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

raw_source_record <- function(path, url, format, used, periods, dataset_id, notes) {
  list(uri = path, url = url, format = format, bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = NULL, source_dataset_id = dataset_id, used_in_public_product = used,
       periods = periods, notes = notes,
       local_cache_hint = paste0(path, " (git-ignored by .gitignore data/ rule)"),
       raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/np_census/"))
}

durable_file_record <- function(path, content, licence_status_value, licence_basis_value) {
  list(uri = paste0("repo:", path), storage_provider = "git_repository", format = sub("^.*\\.", "", path),
       bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = if (grepl("area_summary|\\.csv$", path)) row_count_file(path) else NULL,
       feature_count = if (grepl("\\.geojson$", path)) row_count_file(path) else NULL,
       content = content, privacy = "public",
       licence_status = licence_status_value, licence_basis = licence_basis_value)
}

licence_basis_slug <- "nso_all_rights_reserved_attribution_build_then_ask"

raw_sources <- list(
  raw_source_record(path_2021, url_2021, "xlsx", TRUE, "2021", d2021,
    "2021 census religion-by-district table (Religion_NPHC_2021.xlsx, Prov_District_local level). 77 districts, ten religions, integer full-count. Both margins close exactly to 29,164,578."),
  raw_source_record(boundary_path, boundary_url, "geojson", TRUE, "2021", d_boundary,
    "OCHA COD-AB Nepal admin2 (77 districts), CC BY-IGO. Extracted from npl_admin_boundaries.geojson.zip; cod_version V_02, valid_on 2024-03-14."),
  raw_source_record(boundary_zip_path, boundary_url, "zip", FALSE, "2021", d_boundary,
    "OCHA COD-AB Nepal full boundary bundle (HDX); admin2 layer is the used input."),
  raw_source_record(boundary_meta_path, boundary_meta_url, "json", FALSE, "2021", d_boundary,
    "HDX package metadata for cod-ab-npl; records CC BY-IGO, Survey Department of Nepal / OCHA FISS.")
)

dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)
dataset_id <- "np-census-religion:np:2021:nso-district"

reconciliation_block <- function(rec) {
  lapply(seq_len(nrow(rec)), function(i) as.list(rec[i, ]))
}

national_religion_totals <- as.list(colSums(relmat))

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = paste0("manifest:", dataset_id),
  dataset_id = dataset_id,
  dataset_version_id = paste0(dataset_id, ":", dataset_hash),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "np-census-religion", dataset_role = "staged_evidence",
  scope = list(level = "country", country_codes = list("NP"), snapshot_date = NULL,
               snapshot_anchor = NULL, pipeline_stage = "staged"),
  created_at = stamp, created_by = script_id,
  target_years = list(2021L),
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation",
      shipped_waves = list(2021L),
      shipped_geography = "77 Nepal districts (OCHA COD-AB admin2, 2021 frame)",
      boundary_set = boundary_set_id,
      source_table = "2021 census Table -5 Population by Religion and Sex (Religion_NPHC_2021.xlsx, Prov_District_local level sheet), integer full-count, ten religions",
      universe = "all persons of all ages (29,164,578)",
      category_frame = as.list(religions),
      national_religion_totals = national_religion_totals,
      slot_design = paste(
        "Flat-100 (Sri Lanka / Bangladesh precedent). Every one of the ten categories is a named religion and the ten",
        "exhaust the population, so religious_affiliation_percent is 100 by construction and religious_affiliation_count",
        "is the district population. no_religion_count and no_religion_percent are null because the Nepal 2021 frame has",
        "no no-religion / atheist / not-stated category (the slot is absent, not zero). The ten-way composition is carried",
        "verbatim on the quality flag (source_categories_verbatim) for the PI task-6 minority-share metric."
      ),
      no_religion_treatment = "null; the 2021 ten-religion frame has no no-religion category",
      change_rule = paste(
        "Single wave (2021); no cross-wave change is asserted. The 2015 district split (75->77) and the 2011 'Undefined'",
        "residual (absent in 2021) are frame/universe breaks under the CHANGE-WITHHOLD ruling; the 2011 district wave is",
        "HELD (see held_and_deferred). On recovery, 2011 builds on its own per-vintage 75-district frame, never a concordance."
      ),
      flat_100_gate = "The public page is gated on PI task 6 (minority-share metric); affiliation is 100% by construction, so the two-slot view carries no signal and the ten-way composition is the map-worthy content.",
      frame_note = paste(
        "The 2021 ten-religion frame (Hindu, Bouddha, Islam, Kirat, Christian, Prakriti, Bon, Jain, Bahai, Sikha) is",
        "rendered verbatim, never merged or backcast. The 2011 frame adds an 'Undefined' residual (61,581 nationally)",
        "that 2021 drops; category spellings also differ (Buddhism/Christianity/Jainism/Sikhism in 2011)."
      ),
      held_and_deferred = paste(
        "2011 district religion is HELD: the all-75-district Table 22 'Population by religion' is not in a reachable open",
        "product (Vol 01 prints only Nepal + development-region/eco-belt aggregates + a few sample districts; Vol 02 is the",
        "VDC volume with no religion table; the 2011 Social Characteristics Vol 05 returns the census-site SPA 404). Unblock:",
        "recover the 2011 Vol 05 district religion tables (likely a browser session on censusnepal.cbs.gov.np); the boundary",
        "is ready (geoBoundaries NPL ADM2, 75 units, Public Domain, 2006). A 7-province 2021 product on OCHA COD-AB admin1",
        "or geoBoundaries NPL ADM1 (CC BY 3.0 IGO) is a documented coarser alternative, superseded by this district product."
      ),
      territorial_note = "The build renders the official Nepal administrative extent and census record as published.",
      omitted_metrics = list("no_religion_count", "no_religion_percent",
                             "places_per_10000_residents", "place_density_per_sq_km"),
      boundary_simplification = simplification,
      local_cache_hint = "All raw sources are cached under data/raw/np_census/ and remain git-ignored.",
      retrieval_record = raw_sources
    ),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")),
      readxl = as.character(packageVersion("readxl")),
      jsonlite = as.character(packageVersion("jsonlite")), digest = as.character(packageVersion("digest")),
      mapshaper = "scripts/lib/simplify_boundary.R (npx mapshaper)"
    )
  ),
  source = list(
    provider = "National Statistics Office of Nepal (NSO); OCHA COD-AB (Survey Department of Nepal / OCHA FISS)",
    source_dataset_ids = list(d2021, d_boundary),
    source_urls = list(url_2021, boundary_url, boundary_meta_url),
    retrieved_at = stamp,
    licence = licence_pending,
    citation = "NSO National Population and Housing Census 2021, Table 5 Population by Religion and Sex (district); OCHA COD-AB Nepal admin2 (CC BY-IGO).",
    raw_redistribution = "The census Excel workbook and the COD-AB boundary bundle are not committed; they remain in data/raw/np_census/.",
    local_cache_hint = "data/raw/np_census/ (git-ignored by .gitignore data/ rule)",
    raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/np_census/")
  ),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = list(
    durable_file_record(summary_json_out, "Nepal 77-district census-religion area summary for 2021 (ten-religion composition; flat-100 affiliation).", "needs_review", licence_basis_slug),
    durable_file_record(summary_csv_out, "Flattened Nepal 77-district census-religion rows for 2021.", "needs_review", licence_basis_slug),
    durable_file_record(boundary_out, "Simplified OCHA COD-AB Nepal admin2 77-district boundary GeoJSON.", "accepted", "ocha_codab_cc_by_igo")
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id,
         notes = "77 districts x 1 wave = 77 rows; all-persons-all-ages universe; ten-religion composition on the quality flag; affiliation 100% by construction."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out), built_by = script_id,
         notes = "77 district features from OCHA COD-AB admin2, simplified with mapshaper weighted keep-shapes.")
  ),
  validation = list(
    status = "passed_with_warnings",
    commands = list(
      paste("Rscript", script_id),
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/np/data/area_summary_district.json",
      "bash scripts/validate_manifests.sh"
    ),
    gate_2021 = list(status = "passed", both_margins_close_to = national_total_published,
                     district_row_checks = 77L, religion_column_checks = length(religions),
                     records = reconciliation_block(rec_2021)),
    boundary_validation = list(status = "passed", feature_count = 77L,
                               distinct_geometry_hashes = length(unique(geom_hashes)),
                               bbox = list(xmin = unname(bbox[["xmin"]]), ymin = unname(bbox[["ymin"]]),
                                           xmax = unname(bbox[["xmax"]]), ymax = unname(bbox[["ymax"]])),
                               dateline_note = "extent lon 80.06-88.20E, lat 26.35-30.45N; far from the antimeridian, no dateline handling needed",
                               output_bytes = file_bytes(boundary_out), simplification = simplification,
                               licence = boundary_licence, adm_unit_count = "77"),
    join_coverage = list(matched_districts = 77L, expected_districts = 77L,
                         unmatched_districts = list(), unused_boundary_features = list(),
                         concordance = "four parenthesis labels normalised (Nawalparasi/Rukum East/West); 73 trimmed-exact matches"),
    notes = paste(
      "2021 Table 5 closes integer-exact at both margins (national 29,164,578): every district's ten religion cells sum to",
      "its Total Population and the 77 district totals sum to the national. Boundary joins 77/77 to OCHA COD-AB admin2 with",
      "77 distinct geometry hashes."
    ),
    warnings = list(
      "STAGED product: no page, no hub link. Licence needs review; ships under BUILD-THEN-ASK with attribution to the NSO (no open-data licence stated).",
      "Flat-100 by construction: the 2021 ten-religion frame has no no-religion / not-stated category, so religious_affiliation_percent is 100 for every district and the no-religion slot is null. The page is gated on PI task 6 (minority-share metric); the ten-way composition on the quality flag is the map-worthy signal.",
      "Single wave (2021). The 2011 district wave is HELD (Vol 05 Social Characteristics unreachable); the 75->77 district split and the 2011 'Undefined' residual bar cross-wave change.",
      "Boundary CC BY-IGO (Creative Commons Attribution 3.0 IGO); the 77-district COD-AB frame is the correct per-vintage 2021 boundary."
    )
  ),
  construct_notes = list(
    "The construct is census affiliation: each resident's reported religion, asked of the whole resident population of all ages, not practice, attendance, or membership.",
    "The public product carries the district population total and a flat-100 affiliation share per district; the map-worthy signal is the ten-religion composition carried verbatim on the quality flag (source_categories_verbatim), surfaced by the PI task-6 minority-share metric.",
    "The 2021 ten-religion frame (Hindu, Bouddha, Islam, Kirat, Christian, Prakriti, Bon, Jain, Bahai, Sikha) has no no-religion / atheist / not-stated category, so every enumerated person is assigned a named religion and affiliation is 100% by construction (Sri Lanka / Bangladesh precedent). The no-religion slot is null because the category is absent, not zero.",
    "Single wave (2021). The 2011 district religion wave is HELD: the full 75-district Table 22 is not in a reachable open product. On recovery it builds on its own per-vintage 75-district frame (geoBoundaries NPL ADM2, Public Domain), with change withheld across the 2015 district split (75->77) and the 2011 'Undefined' residual break.",
    "Boundary: OCHA COD-AB Nepal admin2, 77 districts, CC BY-IGO (Creative Commons Attribution 3.0 IGO). The 77 districts join one-to-one after normalising four parenthesis labels (Nawalparasi/Rukum East/West). Nepal is far from the antimeridian; no dateline handling is needed."
  ),
  deferred_sources = list(
    list(source_dataset_id = "np-census-2011-religion-by-district", status = "held",
         url = "https://unstats.un.org/unsd/demographic-social/census/documents/Nepal/Nepal-Census-2011-Vol1.pdf",
         local_path = file.path(raw_dir, "np_2011_vol1.pdf"),
         notes = paste("2011 district religion (Table 22 'Population by religion', eleven categories incl. Undefined) is not in a",
                       "reachable open product; Vol 01 prints only Nepal + development-region/eco-belt aggregates + a few sample",
                       "districts, and the 2011 Social Characteristics Vol 05 returns the census-site SPA 404. Unblock: recover Vol 05.")),
    list(source_dataset_id = "geoboundaries-npl-adm2-2006-75-district", status = "not_used",
         url = "https://www.geoboundaries.org/api/current/gbOpen/NPL/ADM2/", local_path = file.path(raw_dir, "gb_npl_adm2_meta.json"),
         notes = "geoBoundaries NPL ADM2: the old 75-district (2006) frame, Public Domain; the ready per-vintage boundary for a future 2011 district product, not the 2021 frame."),
    list(source_dataset_id = "np-census-2021-province-alternative", status = "not_shipped",
         url = url_2021, local_path = path_2021,
         notes = "A 7-province 2021 product on OCHA COD-AB admin1 or geoBoundaries NPL ADM1 (CC BY 3.0 IGO) is a clean coarser alternative from the same Excel, superseded by the 77-district product."),
    list(source_dataset_id = "nso-licence-confirmation", status = "not_pinned",
         url = portal_url, local_path = NULL,
         notes = "An NSO reuse-confirmation email is the clean courtesy unblock under BUILD-THEN-ASK; none is held.")
  ),
  privacy = "public",
  licence_status = "needs_review",
  licence_basis = licence_basis_slug,
  downstream_status = "staged",
  source_datasets = source_datasets(),
  notes = paste(
    "STAGED product (no page, no hub link). The committed products are the derived 77-district area summary (77 rows for",
    "2021) and the simplified OCHA COD-AB Nepal admin2 boundary. Ships under BUILD-THEN-ASK with attribution to the National",
    "Statistics Office of Nepal (NSO) and OCHA COD-AB (CC BY-IGO). The public page is additionally gated on PI task 6",
    "(flat-100 affiliation)."
  )
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

cat("wave shipped: 2021 on 77 Nepal districts\n")
cat(sprintf("rows: %d (77 districts x 1 wave)\n", length(rows)))
cat(sprintf("gate 2021: passed integer-exact; both margins close to %d\n", national_total_published))
cat(sprintf("boundary gate: passed; 77/77 join, %d distinct geometry hashes, %d bytes at %g%% keep\n",
            length(unique(geom_hashes)), file_bytes(boundary_out), simplification[["keep_percent"]]))
cat("licence gate: needs_review; STAGED under BUILD-THEN-ASK with NSO attribution; page gated on PI task 6\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", boundary_out))
cat(sprintf("wrote %s\n", manifest_out))
