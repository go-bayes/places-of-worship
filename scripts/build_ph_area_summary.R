# build the Philippines 2020 census-religion province area-summary product.
# inputs: cached PSA 2020 statistical table (TABLE A, household population by
# religious affiliation for 129 categories at region/province/HUC), the PSA
# press release and technical notes, and geoBoundaries gbOpen PHL ADM2.
# outputs: apps/regions/ph/data/ph_adm2_2020.geojson,
# apps/regions/ph/data/area_summary_adm2.{json,csv}, and
# docs/manifests/ph-census-religion-2020.json.
# run from the repo root: Rscript scripts/build_ph_area_summary.R
#
# geography ruling: ship at province level with each highly urbanised city (HUC)
# folded into its census host province, matching the geoBoundaries ADM2 layer.
# The National Capital Region has no provinces; its 16 cities and one
# municipality aggregate into the four geoBoundaries NCR legislative-district
# polygons. Isabela City keeps its own geoBoundaries polygon (it is a separate
# ADM2 unit tabulated under Region IX, distinct from Basilan). Cotabato City has
# no separate census row (folded into Maguindanao), so its geoBoundaries polygon
# is merged into Maguindanao. The BARMM Special Geographic Area (Interim Province
# 1) has no polygon: it is a documented unmapped residue reconciled only in the
# national roll-up, never distributed (Norway Unknown-diocese precedent).

suppressMessages({
  library(readxl)
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

raw_dir <- "data/raw/ph_census"
output_dir <- "apps/regions/ph/data"
manifest_dir <- "docs/manifests"
dir.create(output_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

retrieval_date <- "2026-07-11"
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
script_id <- "scripts/build_ph_area_summary.R"
country_code <- "PH"
wave_year <- 2020L

census_dataset_id <- "psa-2020-cph-religious-affiliation-table-a"
boundary_dataset_id <- "geoboundaries-gbopen-phl-adm2-41af8f1"
boundary_set_id <- "ph-adm2-2020-geoboundaries-41af8f1"

# source urls (documented; PSA is Cloudflare-gated and worked from cache only).
census_release_url <- "https://psa.gov.ph/content/religious-affiliation-philippines-2020-census-population-and-housing"
census_table_url <- "https://psa.gov.ph/system/files/phcd/3_Statistical Table for Religious Affiliation (for Posting)_RML_12082022_PMMJ_CRD_1.xlsx"
press_release_url <- "https://psa.gov.ph/system/files/phcd/1_Press Release on Religious Affiliation_RML_01272023_FJRA_PMMJ_CRD-signed_0.pdf"
tech_notes_url <- "https://psa.gov.ph/system/files/phcd/2_Technical Notes for Religious Affiliation_RML_12082022_PMMJ_CRD_0.pdf"
terms_url <- "https://psa.gov.ph/terms-of-use"
boundary_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/PHL/ADM2/"
boundary_url <- "https://github.com/wmgeolab/geoBoundaries/raw/41af8f1/releaseData/gbOpen/PHL/ADM2/geoBoundaries-PHL-ADM2_simplified.geojson"

census_xlsx_path <- file.path(raw_dir, "stat_table_2020_religion.xlsx")
press_release_path <- file.path(raw_dir, "pr_2020_religion.pdf")
tech_notes_path <- file.path(raw_dir, "tech_notes_2020_religion.pdf")
boundary_meta_path <- file.path(raw_dir, "geoboundaries_phl_adm2_meta.json")
boundary_raw_path <- file.path(raw_dir, "geoBoundaries-PHL-ADM2_simplified.geojson")

boundary_out <- file.path(output_dir, "ph_adm2_2020.geojson")
summary_json_out <- file.path(output_dir, "area_summary_adm2.json")
summary_csv_out <- file.path(output_dir, "area_summary_adm2.csv")
manifest_out <- file.path(manifest_dir, "ph-census-religion-2020.json")

# expected exact anchors from the PSA press release and cached table.
national_total_expected <- 108667043L
sga_total_expected <- 215348L
headline_expected <- c(
  "Roman Catholic, excluding Catholic Charismatics" = 85645362L,
  "Islam" = 6981710L,
  "Iglesia ni Cristo" = 2806524L
)
census_xlsx_sha256_expected <- "73d8fa9729dbed6a3b7fdab4bae64f43315fde09deaeaa66eda1a13c7fbe7709"

# ---- small helpers -----------------------------------------------------------

# stop early when a raw source required for the governed build is missing.
require_file <- function(path) {
  if (!file.exists(path)) stop("missing required source: ", path, call. = FALSE)
}

# compute the sha-256 digest for a local file.
sha256_file <- function(path) {
  unname(tools::sha256sum(path))
}

# hash ordered raw bytes into a compact version token.
sha256_bytes <- function(bytes) {
  tmp <- tempfile()
  on.exit(unlink(tmp), add = TRUE)
  writeBin(bytes, tmp)
  sha256_file(tmp)
}

# hash ordered text values into a version token.
sha256_values <- function(values) {
  sha256_bytes(charToRaw(paste(values, collapse = "")))
}

# return file size in bytes for validation and manifest records.
file_bytes <- function(path) {
  as.integer(unname(file.info(path)[["size"]]))
}

# collapse whitespace (including the source's embedded CR/LF) into single spaces.
norm_ws <- function(x) {
  trimws(gsub("\\s+", " ", x))
}

# strip a trailing parenthetical qualifier used by the census for a province row.
strip_paren <- function(x) {
  trimws(sub("\\s*\\(.*\\)\\s*$", "", x))
}

# validate a generated json product against its repository schema.
validate_json_schema <- function(schema_path, instance_path) {
  base_uri <- paste0(
    "file://",
    normalizePath(dirname(schema_path), winslash = "/", mustWork = TRUE),
    "/"
  )
  status <- system2(
    "uvx",
    c("check-jsonschema", "--base-uri", base_uri, "--schemafile", schema_path, instance_path)
  )
  if (!identical(status, 0L)) {
    stop("output failed schema validation: ", instance_path, call. = FALSE)
  }
  invisible(instance_path)
}

# ---- read and parse the cached PSA table ------------------------------------

require_file(census_xlsx_path)
require_file(press_release_path)
require_file(tech_notes_path)
require_file(boundary_meta_path)
require_file(boundary_raw_path)

if (!identical(sha256_file(census_xlsx_path), census_xlsx_sha256_expected)) {
  stop("cached PSA table sha256 does not match the probed value", call. = FALSE)
}

raw <- as.data.frame(suppressMessages(
  read_excel(census_xlsx_path, sheet = 1, col_names = FALSE, col_types = "text")
))
if (ncol(raw) != 131L) {
  stop("cached PSA table does not have the expected 131 columns", call. = FALSE)
}

# the 129 category labels sit on header row 4, columns 3..131; the household
# population total is column 2; area names are column 1.
category_labels <- norm_ws(as.character(raw[4L, 3:131]))
if (length(category_labels) != 129L || category_labels[1] != "None") {
  stop("category header row is not the expected 129-column frame with None first", call. = FALSE)
}
if (!("Not reported" %in% category_labels)) {
  stop("expected a Not reported category in the 129-column frame", call. = FALSE)
}

area_names <- norm_ws(raw[[1L]])
# integer count vector for one data row across the 129 categories.
row_counts <- function(r) {
  v <- suppressWarnings(as.numeric(unlist(raw[r, 3:131])))
  v
}
row_total <- function(r) suppressWarnings(as.numeric(raw[[2L]][r]))
is_data_row <- function(r) !(is.na(raw[[1L]][r]) & is.na(raw[[2L]][r]))

# the printed hierarchy: Philippines (row 6), then 17 region blocks. Each block
# opens with a region row and is followed by its component rows (provinces and
# HUCs) until the next blank separator. Region rows were read directly from the
# cached table and are asserted against the region count below.
national_row <- 6L
region_rows <- c(8L, 27L, 36L, 42L, 49L, 60L, 68L, 76L, 84L, 94L,
                 103L, 112L, 119L, 128L, 136L, 143L, 151L)
region_names <- area_names[region_rows]
if (length(region_rows) != 17L) stop("expected 17 census regions", call. = FALSE)

# component rows for each region: data rows strictly between this region row and
# the next region row (blank separators are skipped by is_data_row).
region_block_end <- c(region_rows[-1] - 1L, 157L)
component_rows <- lapply(seq_along(region_rows), function(k) {
  candidates <- (region_rows[k] + 1L):region_block_end[k]
  candidates[vapply(candidates, is_data_row, logical(1))]
})
names(component_rows) <- region_names

# ---- source reconciliation gates (fail fast) --------------------------------

national_counts <- row_counts(national_row)
national_total <- as.integer(row_total(national_row))
if (national_total != national_total_expected) {
  stop("national household population differs from the expected 108,667,043", call. = FALSE)
}
if (sum(national_counts) != national_total) {
  stop("the 129 national category cells do not sum to the household population", call. = FALSE)
}
for (nm in names(headline_expected)) {
  got <- as.integer(national_counts[match(nm, category_labels)])
  if (is.na(got) || got != headline_expected[[nm]]) {
    stop("headline category mismatch for ", nm, call. = FALSE)
  }
}

region_total_vec <- vapply(region_rows, function(r) as.integer(row_total(r)), integer(1))
if (sum(region_total_vec) != national_total) {
  stop("the 17 region totals do not sum to the national total", call. = FALSE)
}
region_count_matrix <- vapply(region_rows, row_counts, numeric(129))
if (!all(rowSums(region_count_matrix) == national_counts)) {
  stop("region per-category sums do not reconcile to the national frame", call. = FALSE)
}

# every region equals the exact sum of its printed component rows (total and
# per-category), before any HUC folding.
for (k in seq_along(region_rows)) {
  comp <- component_rows[[k]]
  comp_total <- sum(vapply(comp, function(r) as.integer(row_total(r)), integer(1)))
  if (comp_total != region_total_vec[k]) {
    stop("region ", region_names[k], " total differs from its component sum", call. = FALSE)
  }
  comp_cat <- rowSums(vapply(comp, row_counts, numeric(129)))
  if (!all(comp_cat == region_count_matrix[, k])) {
    stop("region ", region_names[k], " per-category sums differ from components", call. = FALSE)
  }
}

# the None slot is present: report it as the verbatim no-religion category.
none_index <- match("None", category_labels)
not_reported_index <- match("Not reported", category_labels)
none_national <- as.integer(national_counts[none_index])
not_reported_national <- as.integer(national_counts[not_reported_index])

# ---- named-category decomposition (top ten, PSA press-release Table 1) -------

# the cut is data-derived: the ten largest specific affiliations by national
# count. The source carries five aggregate "Other" grouping columns that are not
# specific denominations; they are excluded from candidacy and fall into the
# exact Other-categories residual. This reproduces PSA press-release Table 1
# exactly (ranks 1-10, then an exact Other residual, None, and Not reported).
residual_group_labels <- c(
  "Other Baptists", "Other Evangelical Churches", "Other Methodists",
  "Other Protestants", "Other religious affiliations"
)
if (!all(residual_group_labels %in% category_labels)) {
  stop("expected five aggregate Other grouping columns in the source frame", call. = FALSE)
}
residual_group_indices <- match(residual_group_labels, category_labels)
religion_indices <- setdiff(seq_len(129L), c(none_index, not_reported_index))
# named candidates: specific affiliations only (exclude the aggregate Other groups).
named_candidate_indices <- setdiff(religion_indices, residual_group_indices)
named_order <- named_candidate_indices[order(-national_counts[named_candidate_indices])]
named_indices <- named_order[seq_len(10L)]
named_labels <- category_labels[named_indices]
named_threshold <- as.integer(national_counts[named_indices[10L]])
other_indices <- setdiff(religion_indices, named_indices)

pr_named_expected <- c(
  "Roman Catholic, excluding Catholic Charismatics",
  "Islam", "Iglesia ni Cristo", "Seventh Day Adventist", "Aglipay",
  "Iglesia Filipina Independiente", "Bible Baptist Church",
  "United Church of Christ in the Philippines", "Jehovah's Witness",
  "Church of Christ"
)
if (!setequal(named_labels, pr_named_expected)) {
  stop("the ten largest categories differ from the PSA press-release Table 1 set", call. = FALSE)
}

# decompose any count vector into named + exact Other residual + None + Not
# reported, and assert the parts sum to the row total exactly.
decompose <- function(counts, total) {
  named <- as.integer(counts[named_indices])
  other <- as.integer(sum(counts[other_indices]))
  none <- as.integer(counts[none_index])
  not_reported <- as.integer(counts[not_reported_index])
  if (sum(named) + other + none + not_reported != as.integer(total)) {
    stop("named-plus-residual decomposition does not sum to the area total", call. = FALSE)
  }
  list(named = named, other = other, none = none, not_reported = not_reported)
}
national_decomp <- decompose(national_counts, national_total)

# ---- fold HUCs into host units ----------------------------------------------

# every component row is classified as a province, an HUC folded into a host
# province, an NCR city aggregated into a legislative-district unit, the
# stand-alone Isabela City unit, or the unmapped Special Geographic Area.
huc_host <- c(
  "City of Baguio" = "Benguet",
  "City of Angeles" = "Pampanga",
  "City of Olongapo" = "Zambales",
  "City of Lucena" = "Quezon",
  "City of Puerto Princesa" = "Palawan",
  "City of Iloilo" = "Iloilo",
  "City of Bacolod" = "Negros Occidental",
  "City of Cebu" = "Cebu",
  "City of Lapu-Lapu" = "Cebu",
  "City of Mandaue" = "Cebu",
  "City of Tacloban" = "Leyte",
  "City of Zamboanga" = "Zamboanga del Sur",
  "City of Iligan" = "Lanao del Norte",
  "City of Cagayan de Oro" = "Misamis Oriental",
  "City of Davao" = "Davao del Sur",
  "City of General Santos (Dadiangas)" = "South Cotabato",
  "City of Butuan" = "Agusan del Norte"
)
ncr_district <- c(
  "City of Manila" = "NCR, City of Manila, First District",
  "City of Mandaluyong" = "NCR, Second District",
  "City of Marikina" = "NCR, Second District",
  "City of Pasig" = "NCR, Second District",
  "Quezon City" = "NCR, Second District",
  "City of San Juan" = "NCR, Second District",
  "City of Caloocan" = "NCR, Third District",
  "City of Malabon" = "NCR, Third District",
  "City of Navotas" = "NCR, Third District",
  "City of Valenzuela" = "NCR, Third District",
  "City of Las Piñas" = "NCR, Fourth District",
  "City of Makati" = "NCR, Fourth District",
  "City of Muntinlupa" = "NCR, Fourth District",
  "City of Parañaque" = "NCR, Fourth District",
  "Pasay City" = "NCR, Fourth District",
  "City of Taguig" = "NCR, Fourth District",
  "Municipality of Pateros" = "NCR, Fourth District"
)
# census province display name -> geoBoundaries shapeName, only where the two
# authorities disagree beyond a stripped parenthetical (2019 provincial rename).
province_crosswalk <- c("Davao de Oro" = "Compostela Valley")
sga_name <- "Interim Province 1"

# accumulate a per-unit list of counts, total, region, and geoBoundaries join
# name. Every mapped unit resolves to exactly one geoBoundaries polygon.
units <- list()
add_unit <- function(key, join_name, region, counts, total, kind) {
  if (is.null(units[[key]])) {
    units[[key]] <<- list(
      join_name = join_name, region = region, kind = kind,
      counts = counts, total = as.integer(total),
      members = character(0)
    )
  } else {
    units[[key]][["counts"]] <<- units[[key]][["counts"]] + counts
    units[[key]][["total"]] <<- units[[key]][["total"]] + as.integer(total)
  }
  units[[key]][["members"]] <<- c(units[[key]][["members"]], key)
}

huc_fold_log <- list()
sga_counts <- NULL
sga_total <- 0L
for (k in seq_along(region_rows)) {
  region <- region_names[k]
  for (r in component_rows[[k]]) {
    nm <- area_names[r]
    cnt <- row_counts(r)
    tot <- row_total(r)
    if (region == "National Capital Region") {
      district <- ncr_district[[nm]]
      if (is.null(district) || is.na(district)) stop("unmapped NCR city: ", nm, call. = FALSE)
      add_unit(district, district, region, cnt, tot, "ncr_district")
      huc_fold_log[[length(huc_fold_log) + 1L]] <- list(city = nm, host = district, kind = "ncr_city_to_district")
    } else if (nm == sga_name) {
      sga_counts <- cnt
      sga_total <- as.integer(tot)
    } else if (nm %in% names(huc_host)) {
      host <- huc_host[[nm]]
      add_unit(host, strip_paren(host), region, cnt, tot, "province")
      huc_fold_log[[length(huc_fold_log) + 1L]] <- list(city = nm, host = host, kind = "huc_to_host_province")
    } else if (nm == "City of Isabela") {
      add_unit("City of Isabela", "City of Isabela", region, cnt, tot, "independent_huc")
    } else {
      # province row: fold-target key is its own name.
      join_nm <- strip_paren(nm)
      if (!is.na(province_crosswalk[join_nm])) join_nm <- province_crosswalk[[join_nm]]
      add_unit(nm, join_nm, region, cnt, tot, "province")
    }
  }
}

if (is.null(sga_counts) || sga_total != sga_total_expected) {
  stop("Special Geographic Area residue not found or wrong total", call. = FALSE)
}

# mapped units must reconcile exactly to national minus the SGA residue.
mapped_total <- sum(vapply(units, function(u) u[["total"]], integer(1)))
if (mapped_total + sga_total != national_total) {
  stop("mapped-unit totals plus the SGA residue do not equal the national total", call. = FALSE)
}
mapped_counts <- Reduce(`+`, lapply(units, function(u) u[["counts"]]))
if (!all(mapped_counts + sga_counts == national_counts)) {
  stop("mapped-unit per-category sums plus the SGA residue do not equal the national frame", call. = FALSE)
}

# ---- boundary layer ----------------------------------------------------------

boundary_metadata <- fromJSON(boundary_meta_path, simplifyVector = TRUE)
if (!identical(boundary_metadata[["boundaryISO"]], "PHL") ||
    !identical(boundary_metadata[["boundaryType"]], "ADM2") ||
    !identical(boundary_metadata[["boundaryYearRepresented"]], "2020") ||
    !identical(boundary_metadata[["admUnitCount"]], "87") ||
    !grepl("CC BY 3.0 IGO", boundary_metadata[["boundaryLicense"]], fixed = TRUE)) {
  stop("geoBoundaries PHL ADM2 metadata changed from the probed values", call. = FALSE)
}

gb <- st_read(boundary_raw_path, quiet = TRUE)
gb[["shape_name"]] <- norm_ws(gb[["shapeName"]])
gb <- st_make_valid(gb)
if (nrow(gb) != 87L) stop("geoBoundaries ADM2 layer does not have 87 features", call. = FALSE)

# merge the Cotabato City polygon into Maguindanao: the census tabulates Cotabato
# City inside Maguindanao (no separate row), while geoBoundaries splits them.
maguindanao_geom <- st_union(st_geometry(gb[gb[["shape_name"]] %in% c("Maguindanao", "Cotabato City"), ]))
gb_merged <- gb[gb[["shape_name"]] != "Cotabato City", ]
st_geometry(gb_merged)[gb_merged[["shape_name"]] == "Maguindanao"] <- maguindanao_geom
gb_merged <- st_make_valid(gb_merged)
if (nrow(gb_merged) != 86L) stop("merged geoBoundaries layer does not have 86 features", call. = FALSE)

# join every mapped unit to exactly one geoBoundaries polygon by join name.
unit_keys <- names(units)
unit_join_names <- vapply(units, function(u) u[["join_name"]], character(1))
gb_names <- gb_merged[["shape_name"]]
missing_in_gb <- setdiff(unit_join_names, gb_names)
extra_in_gb <- setdiff(gb_names, unit_join_names)
if (length(missing_in_gb) || length(extra_in_gb)) {
  stop("boundary join is not one-to-one; missing: ",
       paste(missing_in_gb, collapse = ", "), "; extra: ",
       paste(extra_in_gb, collapse = ", "), call. = FALSE)
}
if (length(unit_keys) != 86L) stop("expected 86 mapped units", call. = FALSE)

# order the boundary layer to the unit order and attach area identity.
match_idx <- match(unit_join_names, gb_names)
gb_ordered <- gb_merged[match_idx, ]
area_codes <- gb_ordered[["shapeID"]]
land_area_sq_km <- as.numeric(st_area(st_transform(gb_ordered, 8857))) / 1e6

feature_layer <- st_sf(
  area_code = area_codes,
  area_name = unit_keys,
  region = vapply(units, function(u) u[["region"]], character(1)),
  geometry = st_geometry(st_transform(gb_ordered, 4326)),
  crs = 4326
)

simplification <- mapshaper_simplify_to_cap(
  feature_layer,
  boundary_out,
  max_bytes = 1900000,
  keep_percentages = c(60, 45, 30, 20, 12, 8, 5, 3)
)

written_boundary <- st_read(boundary_out, quiet = TRUE)
written_valid <- st_is_valid(written_boundary)
if (nrow(written_boundary) != 86L || any(st_is_empty(written_boundary)) ||
    any(is.na(written_valid)) || any(!written_valid)) {
  stop("simplified PH ADM2 boundary failed the geometry gate", call. = FALSE)
}
geometry_hashes <- vapply(
  st_as_binary(st_geometry(written_boundary), EWKB = TRUE),
  sha256_bytes, character(1)
)
if (anyDuplicated(geometry_hashes) != 0L) {
  stop("simplified boundary features do not all have distinct geometry hashes", call. = FALSE)
}

# ---- area-summary rows -------------------------------------------------------

population_basis <- paste(
  "PSA 2020 Census of Population and Housing, household population (the universe",
  "of the religion table); this differs from total population. HUCs are folded",
  "into their census host province and NCR cities into the four NCR legislative",
  "districts; Cotabato City is inside Maguindanao and Isabela City is a separate",
  "ADM2 unit. The BARMM Special Geographic Area (Interim Province 1) has no",
  "polygon and is excluded from the mapped rows; it is reconciled in the national",
  "roll-up only."
)
quality_flag_base <- paste(
  "household_population_universe",
  "roman_catholic_excludes_catholic_charismatics",
  "no_religion_slot_is_verbatim_none_category",
  sep = ";"
)
# province units that actually absorbed at least one folded HUC census row.
folded_hosts <- unique(vapply(
  Filter(function(x) x[["kind"]] == "huc_to_host_province", huc_fold_log),
  function(x) x[["host"]], character(1)
))

# assemble one schema-shaped row per mapped unit.
rows <- lapply(unit_keys, function(key) {
  u <- units[[key]]
  idx <- match(key, unit_keys)
  decomp <- decompose(u[["counts"]], u[["total"]])
  affiliation <- as.integer(u[["total"]] - decomp[["none"]] - decomp[["not_reported"]])
  total <- as.integer(u[["total"]])
  flags <- quality_flag_base
  if (key %in% folded_hosts) flags <- paste(flags, "huc_folded_into_host_province", sep = ";")
  if (grepl("^Maguindanao", key)) flags <- paste(flags, "includes_cotabato_city_polygon_merged", sep = ";")
  if (key == "City of Isabela") flags <- paste(flags, "separate_adm2_unit_within_region_ix", sep = ";")
  if (u[["kind"]] == "ncr_district") flags <- paste(flags, "ncr_cities_aggregated_to_legislative_district", sep = ";")
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = "adm2",
    area_unit_id = paste0(boundary_set_id, ":", area_codes[idx]),
    area_code = area_codes[idx],
    area_name = key,
    year = wave_year,
    population_total = total,
    population_total_basis = population_basis,
    religious_affiliation_count = affiliation,
    religious_affiliation_percent = round(100 * affiliation / total, 4),
    no_religion_count = as.integer(decomp[["none"]]),
    no_religion_percent = round(100 * decomp[["none"]] / total, 4),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(land_area_sq_km[idx], 4),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(census_dataset_id, boundary_dataset_id),
    quality_flag = flags
  )
})

# flatten rows into the csv companion shape.
flatten_rows <- function(rows) {
  do.call(rbind, lapply(rows, function(row) {
    data.frame(
      country_code = row[["country_code"]],
      boundary_set_id = row[["boundary_set_id"]],
      boundary_level = row[["boundary_level"]],
      area_unit_id = row[["area_unit_id"]],
      area_code = row[["area_code"]],
      area_name = row[["area_name"]],
      year = row[["year"]],
      population_total = row[["population_total"]],
      population_total_basis = row[["population_total_basis"]],
      religious_affiliation_count = row[["religious_affiliation_count"]],
      religious_affiliation_percent = row[["religious_affiliation_percent"]],
      no_religion_count = row[["no_religion_count"]],
      no_religion_percent = row[["no_religion_percent"]],
      place_count = NA_integer_,
      places_per_10000_residents = NA_real_,
      place_density_per_sq_km = NA_real_,
      land_area_sq_km = row[["land_area_sq_km"]],
      site_snapshot_date = NA_character_,
      place_count_basis = NA_character_,
      source_dataset_ids = paste(unlist(row[["source_dataset_ids"]]), collapse = "|"),
      quality_flag = row[["quality_flag"]],
      stringsAsFactors = FALSE
    )
  }))
}

# ---- indicators, layers, source datasets, area-summary document -------------

temporal_coverage <- "2020, single census wave"
spatial_coverage <- "86 mapped geoBoundaries ADM2 units (81 provinces with HUCs folded in, four NCR districts, Isabela City); the BARMM Special Geographic Area is an unmapped national-reconciliation residue."

source_datasets <- list(
  list(
    source_dataset_id = census_dataset_id,
    name = "PSA 2020 CPH Table A: Household Population by Religious Affiliation, Region, Province, and Highly Urbanized City",
    provider = "Philippine Statistics Authority (PSA)",
    url = census_table_url,
    retrieval_date = retrieval_date,
    local_path = census_xlsx_path,
    licence = list(
      name = "Creative Commons Attribution 4.0 International (CC BY 4.0)",
      url = terms_url,
      attribution = "Philippine Statistics Authority, 2020 Census of Population and Housing"
    ),
    citation = "Philippine Statistics Authority, 2020 Census of Population and Housing, Table A: Household Population by Religious Affiliation, Region, Province, and Highly Urbanized City (release 2023-70, 22 February 2023).",
    access_limits = "PSA is behind a Cloudflare JavaScript challenge; automated fetchers are blocked. The table was retrieved once through a cleared browser session and worked from the local cache thereafter.",
    redistribution_limits = "PSA statistical tables are Open Data under CC BY; the raw workbook stays in the git-ignored cache and derived public products attribute PSA and link to the terms page.",
    notes = "Universe is the household population (108,667,043), not total population. Roman Catholic is the excluding-Catholic-Charismatics column, matching the press-release headline."
  ),
  list(
    source_dataset_id = boundary_dataset_id,
    name = "geoBoundaries gbOpen PHL ADM2 (Provinces)",
    provider = "geoBoundaries; sources NAMRIA, PSA, OCHA Philippines",
    url = boundary_url,
    retrieval_date = retrieval_date,
    local_path = boundary_raw_path,
    licence = list(
      name = "Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO)",
      url = "https://data.humdata.org/about/license",
      attribution = "geoBoundaries; NAMRIA / PSA / OCHA Philippines"
    ),
    citation = "geoBoundaries gbOpen PHL ADM2 (boundaryID PHL-ADM2-2640588, boundary year 2020), release commit 41af8f1.",
    access_limits = NULL,
    redistribution_limits = "The simplified derivative is redistributed under CC BY 3.0 IGO with attribution.",
    notes = "87 ADM2 units. The Cotabato City polygon is merged into Maguindanao to match the census tabulation, giving 86 mapped units."
  )
)

indicators <- list(
  list(
    indicator_id = "population_total",
    label = "Household population",
    description = "PSA 2020 CPH household population in the mapped ADM2 unit (the universe of the religion table).",
    unit = "count",
    denominator_indicator_id = NULL,
    method = "Sum of the household population over the census rows folded into the mapped unit.",
    temporal_coverage = temporal_coverage,
    spatial_coverage = spatial_coverage,
    quality_notes = "Household population differs from total population; change over time is withheld until the 2010 and 2015 waves are pinned."
  ),
  list(
    indicator_id = "religious_affiliation_percent",
    label = "Religious affiliation %",
    description = "Share of the household population that reported any religious affiliation.",
    unit = "percent",
    denominator_indicator_id = "population_total",
    method = "100 * (household population - None - Not reported) / household population. None is the verbatim no-religion category; Not reported is non-response and is excluded from the numerator.",
    temporal_coverage = temporal_coverage,
    spatial_coverage = spatial_coverage,
    quality_notes = "The affiliation share varies with the None and Not reported shares; it is not flat by construction."
  ),
  list(
    indicator_id = "no_religion_percent",
    label = "No religion %",
    description = "Share of the household population in the census None category (no religious affiliation).",
    unit = "percent",
    denominator_indicator_id = "population_total",
    method = "100 * None / household population. None is the PSA verbatim label; Not reported is kept separate and is not treated as no religion.",
    temporal_coverage = temporal_coverage,
    spatial_coverage = spatial_coverage,
    quality_notes = "None is 43,931 nationally (0.0%); the no-religion share is small and the category is carried verbatim, not inferred."
  )
)

visual_layers <- list(
  list(
    visual_layer_id = "ph-adm2-religious-affiliation",
    label = "Religious affiliation %",
    description = "PSA 2020 CPH religious-affiliation share of the household population.",
    layer_type = "choropleth",
    indicator_ids = list("religious_affiliation_percent"),
    geometry_unit_type = "area_unit",
    legend = NULL,
    colour_scale = "shared sequential blue",
    time_control = "year_selector",
    aggregation_rule = "reported unit value after HUC folding",
    uncertainty_display = "quality_flag",
    default_visibility = TRUE,
    notes = "Roman Catholic uses the excluding-Catholic-Charismatics column, matching the PSA headline."
  ),
  list(
    visual_layer_id = "ph-adm2-no-religion",
    label = "No religion %",
    description = "PSA 2020 CPH None (no religious affiliation) share of the household population.",
    layer_type = "choropleth",
    indicator_ids = list("no_religion_percent"),
    geometry_unit_type = "area_unit",
    legend = NULL,
    colour_scale = "shared sequential blue",
    time_control = "year_selector",
    aggregation_rule = "reported unit value after HUC folding",
    uncertainty_display = "quality_flag",
    default_visibility = FALSE,
    notes = "None is the PSA verbatim category and is small (0.0% nationally)."
  )
)

area_summary <- list(
  schema_version = "0.2.0",
  generated_at = stamp,
  generated_by = script_id,
  country_code = country_code,
  boundary_set = list(
    boundary_set_id = boundary_set_id,
    country_code = country_code,
    level = "adm2",
    vintage = "2020",
    source_dataset_id = boundary_dataset_id
  ),
  site_snapshot = list(
    source_dataset_id = NULL,
    snapshot_date = NULL,
    basis = "no governed Philippines place-of-worship snapshot is included in this census-religion release",
    notes = "The Philippines page exposes PSA 2020 census religious-affiliation percentages only; place-density metrics are hidden until a governed place layer is built."
  ),
  source_datasets = source_datasets,
  indicators = indicators,
  visual_layers = visual_layers,
  rows = rows
)

write_json(area_summary, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", digits = NA)
utils::write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

if (!jsonlite::validate(readChar(summary_json_out, file_bytes(summary_json_out), useBytes = TRUE))) {
  stop("area-summary output failed JSON syntax validation", call. = FALSE)
}
validate_json_schema("schemas/area-summary.schema.json", summary_json_out)

# ---- manifest ----------------------------------------------------------------

# full 129-category national frame, in the source column order.
national_frame <- lapply(seq_len(129L), function(i) {
  list(
    column_index = i,
    label = category_labels[i],
    national_count = as.integer(national_counts[i])
  )
})
# named-row reconciliation: named ten + Other residual + None + Not reported.
named_reconciliation <- list(
  named_categories = lapply(seq_along(named_indices), function(j) {
    list(
      rank = j,
      label = named_labels[j],
      national_count = as.integer(national_counts[named_indices[j]])
    )
  }),
  other_categories_residual = as.integer(national_decomp[["other"]]),
  none = as.integer(national_decomp[["none"]]),
  not_reported = as.integer(national_decomp[["not_reported"]]),
  reconciled_total = as.integer(
    sum(national_decomp[["named"]]) + national_decomp[["other"]] +
      national_decomp[["none"]] + national_decomp[["not_reported"]]
  ),
  national_total = national_total
)

huc_mapping_records <- lapply(huc_fold_log, function(x) {
  list(city = x[["city"]], host_unit = x[["host"]], kind = x[["kind"]])
})
name_normalisations <- list(
  list(census = "Davao de Oro (Compostela Valley)", geoboundaries = "Compostela Valley", basis = "province renamed in 2019; geoBoundaries retains the former name"),
  list(census = "Cotabato (North Cotabato)", geoboundaries = "Cotabato", basis = "stripped parenthetical disambiguator"),
  list(census = "Samar (Western Samar)", geoboundaries = "Samar", basis = "stripped parenthetical disambiguator"),
  list(census = "Maguindanao (including the City of Cotabato)", geoboundaries = "Maguindanao", basis = "stripped operational parenthetical; Cotabato City polygon merged into Maguindanao"),
  list(census = "Basilan (excluding the City of Isabela)", geoboundaries = "Basilan", basis = "stripped operational parenthetical; Isabela City ships as a separate unit")
)

durable_file_record <- function(path, content, row_count = NULL, feature_count = NULL) {
  record <- list(
    uri = paste0("repo:", path),
    storage_provider = "git_repository",
    format = sub("^.*\\.", "", path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    content = content,
    privacy = "public",
    licence_status = "accepted",
    licence_basis = "cc_by"
  )
  if (!is.null(row_count)) record[["row_count"]] <- as.integer(row_count)
  if (!is.null(feature_count)) record[["feature_count"]] <- as.integer(feature_count)
  record
}
raw_source_record <- function(path, url, method = "GET") {
  list(
    local_path = path,
    url = url,
    method = method,
    retrieval_date = retrieval_date,
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/ph_census/")
  )
}

raw_paths <- c(census_xlsx_path, press_release_path, tech_notes_path, boundary_meta_path, boundary_raw_path)
raw_urls <- c(census_table_url, press_release_url, tech_notes_url, boundary_meta_url, boundary_url)
raw_sources <- lapply(seq_along(raw_paths), function(i) raw_source_record(raw_paths[i], raw_urls[i]))
raw_hashes <- vapply(raw_sources, `[[`, character(1), "sha256")
output_paths <- c(summary_json_out, summary_csv_out, boundary_out)
output_hashes <- vapply(output_paths, sha256_file, character(1))
version_hash <- substr(sha256_values(c(raw_hashes, output_hashes)), 1L, 12L)
git_commit <- tryCatch(
  trimws(system2("git", c("rev-parse", "--short", "HEAD"), stdout = TRUE, stderr = FALSE)),
  error = function(e) NULL
)
if (length(git_commit) == 0L || !nzchar(git_commit)) git_commit <- NULL

schema_command <- paste(
  "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile",
  "schemas/area-summary.schema.json", summary_json_out
)

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = paste0("manifest:ph-census-religion:ph:2020:", version_hash),
  dataset_id = "ph-census-religion:ph:2020:psa-geoboundaries",
  dataset_version_id = paste0("ph-census-religion:ph:2020:psa-geoboundaries:", version_hash),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "ph-census-religion",
  dataset_role = "public_product",
  scope = list(
    level = "country",
    country_codes = list("PH"),
    snapshot_date = NULL,
    snapshot_anchor = NULL,
    pipeline_stage = "public"
  ),
  created_at = stamp,
  created_by = script_id,
  target_years = list(2020L),
  pipeline = list(
    script = script_id,
    git_commit = git_commit,
    command = paste("Rscript", script_id),
    parameters = list(
      wave = "2020",
      geography = "adm2",
      universe = "household population (108,667,043); differs from total population",
      boundary_set = boundary_set_id,
      category_selection = list(
        rule = paste(
          "The ten largest affiliations by national household-population count are",
          "kept as named categories; Other categories is the exact national sum of",
          "the remaining religion columns; None and Not reported are carried as",
          "separate PSA source-named slots. This reproduces PSA press-release Table 1."
        ),
        cut_threshold_national_count = named_threshold,
        cut_threshold_basis = "the ten largest specific affiliations, excluding the source's five aggregate Other grouping columns; equivalently every specific affiliation with national household-population count >= 429,921 (the tenth-largest, Church of Christ)",
        excluded_aggregate_groups = as.list(residual_group_labels),
        named_labels = as.list(named_labels),
        residual_label = "Other categories",
        no_religion_label = "None",
        non_response_label = "Not reported",
        source_frame_categories = 129L
      ),
      huc_folding = list(
        rule = "Each HUC is folded into its census host province; NCR cities aggregate into the four NCR legislative-district polygons; Cotabato City is inside Maguindanao (polygon merged); Isabela City is a separate ADM2 unit.",
        huc_to_host_count = length(huc_fold_log),
        mappings = huc_mapping_records
      ),
      name_normalisations = name_normalisations,
      boundary_simplification = c(
        simplification,
        list(byte_ceiling = 1900000, helper = "scripts/lib/simplify_boundary.R")
      )
    ),
    software_versions = list(
      R = paste(R.version$major, R.version$minor, sep = "."),
      sf = as.character(utils::packageVersion("sf")),
      readxl = as.character(utils::packageVersion("readxl")),
      jsonlite = as.character(utils::packageVersion("jsonlite"))
    )
  ),
  source = list(
    provider = "Philippine Statistics Authority; geoBoundaries (NAMRIA/PSA/OCHA)",
    source_dataset_ids = list(census_dataset_id, boundary_dataset_id),
    source_urls = list(census_release_url, census_table_url, press_release_url, tech_notes_url, terms_url, boundary_meta_url, boundary_url),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = "PSA publishes its statistical tables as Open Data under CC BY (terms page and a public-domain footer); geoBoundaries records the PHL ADM2 source as CC BY 3.0 IGO.",
    citation = "Philippine Statistics Authority, 2020 CPH Table A on Religious Affiliation; geoBoundaries gbOpen PHL ADM2 (PHL-ADM2-2640588, 2020), release commit 41af8f1.",
    local_cache_hint = "data/raw/ph_census/ (git-ignored; every cached file is listed and hashed in raw_sources)",
    licence_position = "PSA Open Data CC BY (statistical tables); geoBoundaries CC BY 3.0 IGO (boundary). The census microdata carry restrictive terms and are not used.",
    licence_position_verbatim_from_playbook = "The statistical tables (or datasets) including documents (collectively as material) on this site are classified under Open Data with Creative Commons Attribution License (cc-by).",
    raw_redistribution = "Raw PSA workbook, press release, technical notes, and geoBoundaries source are not committed; they stay in data/raw/ph_census/, mirrored to gs://pow-research-data/raw_sources/ph_census/ (5 objects, 2026-07-11)."
  ),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = list(
    durable_file_record(summary_json_out, "Philippines 2020 ADM2 area summary with PSA census religious-affiliation metrics.", row_count = length(rows)),
    durable_file_record(summary_csv_out, "Flattened Philippines 2020 ADM2 area summary.", row_count = length(rows)),
    durable_file_record(boundary_out, "Simplified Philippines ADM2 (2020) boundary GeoJSON derived from geoBoundaries, Cotabato City merged into Maguindanao.", feature_count = nrow(written_boundary))
  ),
  derived_outputs = lapply(output_paths, function(path) {
    list(uri = paste0("repo:", path), sha256 = sha256_file(path), built_by = script_id)
  }),
  stats = list(
    wave_year = wave_year,
    mapped_area_rows = length(rows),
    boundary_features = nrow(written_boundary),
    source_frame_categories = 129L,
    named_categories = length(named_indices),
    national_household_population = national_total,
    none_national = none_national,
    not_reported_national = not_reported_national,
    sga_residue = sga_total,
    boundary_bytes = file_bytes(boundary_out)
  ),
  local_cache_hint = "data/raw/ph_census/ (git-ignored; every cached file is listed and hashed below)",
  validation = list(
    status = "passed",
    commands = list(paste("Rscript", script_id), schema_command),
    warnings = list(
      "Single wave (2020). The 2010 CPH and 2015 POPCEN province religion tables are not yet pinned; change over time is withheld until they are located and the frames and denominators are reconciled.",
      "Household population is the religion-table universe and differs from total population; any future 2010/2015 extension must reconcile universes before reporting change.",
      "The BARMM Special Geographic Area (Interim Province 1, 215,348 persons) has no ADM2 polygon and is not a mapped row; it is reconciled in the national roll-up only and never distributed."
    ),
    notes = paste(
      "All source reconciliation gates pass exactly: the 129 national category cells",
      "sum to 108,667,043 (residual 0); the 17 regions sum to national per category;",
      "every region equals its printed component sum; Roman Catholic 85,645,362,",
      "Islam 6,981,710, and Iglesia ni Cristo 2,806,524 match the press release; the",
      "named-ten-plus-Other-plus-None-plus-Not-reported decomposition sums to every",
      "area total; and the 86 mapped units plus the SGA residue equal the national",
      "frame per category. The boundary join is one-to-one across all 86 units."
    ),
    national_category_reconciliation = list(
      national_total = national_total,
      category_cell_sum = as.integer(sum(national_counts)),
      residual = as.integer(national_total - sum(national_counts))
    ),
    headline_category_check = list(
      roman_catholic_excluding_charismatics = as.integer(headline_expected[[1]]),
      islam = as.integer(headline_expected[[2]]),
      iglesia_ni_cristo = as.integer(headline_expected[[3]])
    ),
    named_row_reconciliation = named_reconciliation,
    mapped_residue_reconciliation = list(
      mapped_total = as.integer(mapped_total),
      sga_residue = sga_total,
      national_total = national_total,
      reconciles = (mapped_total + sga_total == national_total)
    ),
    join_coverage = list(
      mapped_units = length(unit_keys),
      boundary_features = nrow(written_boundary),
      geoboundaries_source_features = 87L,
      cotabato_city_merged_into_maguindanao = TRUE,
      missing_join_names = as.list(missing_in_gb),
      extra_boundary_names = as.list(extra_in_gb)
    ),
    geometry_validation = list(
      output_feature_count = nrow(written_boundary),
      all_valid = all(written_valid),
      all_non_empty = all(!st_is_empty(written_boundary)),
      distinct_geometry_hash_gate = anyDuplicated(geometry_hashes) == 0L,
      output_bytes = file_bytes(boundary_out),
      simplification = simplification
    ),
    none_category_finding = "present: the 129-category frame includes a verbatim None (no religious affiliation) column of 43,931 nationally, so the no-religion slot is wired to it and the affiliation share is not flat by construction; the Philippines does not share the BD/KH/PW flat-affiliation gate."
  ),
  privacy = "public",
  licence_status = "accepted",
  licence_basis = "cc_by",
  downstream_status = "public",
  notes = paste(
    "Committed products are the derived ADM2 area summary and a simplified boundary",
    "only. On-page attribution must cite the Philippine Statistics Authority (CC BY)",
    "and geoBoundaries (CC BY 3.0 IGO)."
  ),
  construct_notes = list(
    "The universe is the household population (108,667,043), the universe of the PSA religion table; it differs from total population.",
    "religious_affiliation_count is household population minus None minus Not reported: persons who reported a religious affiliation. Not reported is non-response and is not treated as no religion.",
    "no_religion_count is the PSA None category (43,931 nationally, 0.0%), carried verbatim, not inferred.",
    "Roman Catholic uses the excluding-Catholic-Charismatics column (85,645,362), matching the PSA press-release headline; Catholic Charismatic (74,096) falls inside the Other categories residual.",
    "The named ten affiliations reproduce PSA press-release Table 1; Other categories is their exact national residual (8,954,291) and every area total is reconciled the same way.",
    "Each HUC is folded into its census host province; NCR cities aggregate into the four NCR legislative-district polygons; Cotabato City is inside Maguindanao (polygon merged); Isabela City is a separate ADM2 unit.",
    "The BARMM Special Geographic Area (Interim Province 1) has no polygon and is an unmapped national-reconciliation residue, never distributed to mapped units."
  ),
  deferred_sources = list(
    list(
      source_dataset_id = "psa-2010-cph-religious-affiliation",
      url = census_release_url,
      local_path = NULL,
      notes = "2010 CPH collected religion at province level but the consolidated province table was not pinned to an exact URL; deferred for a future time-series extension."
    ),
    list(
      source_dataset_id = "psa-2015-popcen-religious-affiliation",
      url = census_release_url,
      local_path = NULL,
      notes = "2015 POPCEN collected religion on a total-population universe; the consolidated province table was not pinned and the universe differs from 2020, so it is deferred until frames and denominators are reconciled."
    )
  ),
  source_datasets = source_datasets
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", digits = NA)
if (!jsonlite::validate(readChar(manifest_out, file_bytes(manifest_out), useBytes = TRUE))) {
  stop("manifest output is not valid JSON", call. = FALSE)
}
validate_json_schema("schemas/data-manifest.schema.json", manifest_out)

message(
  "built Philippines ADM2 religion product: ", length(rows), " mapped rows, ",
  "boundary ", file_bytes(boundary_out), " bytes at ",
  simplification[["keep_percent"]], "% keep; SGA residue ", sga_total, " reconciled in the national roll-up"
)
