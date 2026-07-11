# build the Pakistan district boundary product for the 2023 census-religion frame
# from the gated OCHA COD-AB PAK ADM2 layer (CC BY 3.0 IGO), joined by name to the
# committed 136-row census roster in apps/regions/pk/data/area_summary_district.json.
# inputs (all cached, git-ignored; sha256 gated in research/countries/pk/boundary-probe.md):
#   data/raw/pk_census/geoBoundaries-PAK-ADM2.geojson -> 160-unit ADM2 geometry
#     (geoBoundaries gbHumanitarian mirror PAK-ADM2-19695364, pinned commit 9469f09;
#      the same WFP-SDI/HDX COD-AB v01 layer the probe recommends, CC BY 3.0 IGO)
#   data/raw/pk_census/cod_ab_pak_admin_boundaries.xlsx -> COD ADM2 attribute table
#     (adm2_name, adm2_pcode, adm1_name) used to attach P-code + province and to
#     drive the in-scope filter and the phantom drop
#   data/raw/pk_census/gb_pak_adm2_humanitarian_meta.json -> boundary licence metadata
# the geoBoundaries shapeName set is identical to the COD adm2_name set (160 unique,
# no duplicates), so geometry joins to the attribute table one-to-one by name.
# scope: keep the four provinces + ICT (136 in-scope units), drop the 24 AJK+GB units
# and the abolished Lehri phantom (PK218) -> 135 COD polygons. West Karachi (PK729)
# is relabelled as the single documented Keamari combine feature (the licensed COD
# vintage pre-dates the 2020 Karachi West / Keamari split). the crosswalk to census
# area_codes is pinned (every non-identity mapping listed below); a NEW mismatch stops
# the build rather than guessing.
# output: apps/regions/pk/data/pk_district_2022.geojson (135 features), simplified to
# web weight with scripts/lib/simplify_boundary.R. this is a DATA-ONLY build: no page,
# no hub edit, no commit (the conductor gates and commits).
# run from the repo root: Rscript scripts/build_pk_boundary.R

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(readxl)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "PK"
script_id <- "scripts/build_pk_boundary.R"
raw_dir <- "data/raw/pk_census"
product_dir <- "apps/regions/pk/data"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)

boundary_level <- "district"
boundary_vintage <- "2022"                       # COD-AB v01 valid_on 2022-09-09
boundary_licence <- "CC BY 3.0 IGO"
boundary_source <- paste(
  "OCHA COD-AB PAK ADM2 v01 (valid 2022-09-09), World Food Programme SDI / HDX;",
  "geometry via the geoBoundaries gbHumanitarian mirror PAK-ADM2-19695364 (pinned commit 9469f09)")

geojson_path <- file.path(raw_dir, "geoBoundaries-PAK-ADM2.geojson")
xlsx_path <- file.path(raw_dir, "cod_ab_pak_admin_boundaries.xlsx")
meta_path <- file.path(raw_dir, "gb_pak_adm2_humanitarian_meta.json")
census_path <- file.path(product_dir, "area_summary_district.json")
boundary_out <- file.path(product_dir, "pk_district_2022.geojson")

# ---- pinned crosswalk ----------------------------------------------------------
# province code prefix used by the committed census area_codes.
prov_prefix <- c(`Khyber Pakhtunkhwa` = "kp", Punjab = "pb", Sindh = "sd",
                 Balochistan = "bl", Islamabad = "ict")
inscope_adm1 <- names(prov_prefix)

# every NON-identity COD shapeName -> census area_code mapping, keyed by adm2_pcode
# (resolved in research/countries/pk/boundary-probe.md; each entry is pinned). all
# other in-scope units map by identity: prefix + "-" + slug(adm2_name).
crosswalk_override <- c(
  PK507 = "kp-lower-chitral",       # COD "Chitral Lower"
  PK508 = "kp-upper-chitral",       # COD "Chitral Upper"
  PK509 = "kp-dera-ismail-khan",    # COD "D. I. Khan"
  PK515 = "kp-lower-kohistan",      # COD "Kohistan Lower"
  PK516 = "kp-upper-kohistan",      # COD "Kohistan Upper"
  PK534 = "kp-torghar",             # COD "Tor Ghar"
  PK618 = "pb-layyah",              # COD "Leiah"
  PK702 = "sd-karachi-central",     # COD "Central Karachi" (word order flipped)
  PK704 = "sd-karachi-east",        # COD "East Karachi"
  PK712 = "sd-korangi",             # COD "Korangi Karachi"
  PK714 = "sd-malir",               # COD "Malir Karachi"
  PK719 = "sd-shaheed-benazirabad", # COD "Shaheed Benazir Abad"
  PK721 = "sd-karachi-south",       # COD "South Karachi"
  PK233 = "bl-surab"                # COD "Shaheed Sikandarabad" (dual official name)
)
# Malakand (PK521) maps by identity to kp-malakand; only the census area_name differs
# ("Malakand Protected Area" vs COD "Malakand"), so it needs no code override.
lehri_pcode <- "PK218"                  # abolished 2018; census 2023 correctly omits it
westkar_pcode <- "PK729"                # COD "West Karachi": the Keamari combine feature
combined_code <- "karachi_west_keamari_combined"

slug <- function(s) gsub(" ", "-", tolower(trimws(s)))
sha256_file <- function(path) unname(tools::sha256sum(path))
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))
require_file <- function(path) {
  if (!file.exists(path) || file_bytes(path) == 0L) stop("missing required input: ", path, call. = FALSE)
}
# hash each feature's geometry (EWKB) to prove per-feature distinctness.
geometry_hashes <- function(layer) {
  vapply(seq_len(nrow(layer)), function(i) {
    digest(st_as_binary(st_geometry(layer)[i], EWKB = TRUE)[[1L]], algo = "sha256", serialize = FALSE)
  }, character(1))
}

invisible(lapply(c(geojson_path, xlsx_path, meta_path, census_path), require_file))

# ---- confirm the pinned boundary licence, unit count, and type before use ------
meta <- fromJSON(meta_path, simplifyVector = TRUE)
if (!identical(meta[["admUnitCount"]], "160") ||
    !identical(meta[["boundaryType"]], "ADM2") ||
    !grepl("CC BY 3.0 IGO", meta[["boundaryLicense"]], fixed = TRUE)) {
  stop("geoBoundaries PAK ADM2 licence, unit count, or type metadata changed", call. = FALSE)
}

# ---- COD attribute table (name -> P-code, province) ----------------------------
att <- as.data.frame(read_excel(xlsx_path, sheet = "pak_admin2"))[, c("adm2_name", "adm2_pcode", "adm1_name")]
if (nrow(att) != 160L || anyDuplicated(att[["adm2_name"]])) {
  stop("COD ADM2 attribute table is not 160 unique-named rows", call. = FALSE)
}

# ---- census roster (single source of truth for area_name) ----------------------
census_rows <- fromJSON(census_path, simplifyVector = FALSE)[["rows"]]
census_name <- setNames(vapply(census_rows, `[[`, character(1), "area_name"),
                        vapply(census_rows, `[[`, character(1), "area_code"))
census_codes <- names(census_name)
if (length(census_codes) != 136L) stop("census roster is not 136 rows", call. = FALSE)

# ---- boundary geometry: join, filter, drop phantom, assign codes ---------------
gb <- st_make_valid(st_read(geojson_path, quiet = TRUE, stringsAsFactors = FALSE))
if (nrow(gb) != 160L) stop("geoBoundaries PAK ADM2 feature count is not 160", call. = FALSE)

idx <- match(gb[["shapeName"]], att[["adm2_name"]])
if (anyNA(idx)) stop("a geoBoundaries shapeName has no COD attribute-table match", call. = FALSE)
gb[["cod_shape_name"]] <- gb[["shapeName"]]
gb[["adm2_pcode"]] <- att[["adm2_pcode"]][idx]
gb[["adm1_name"]] <- att[["adm1_name"]][idx]

# keep the four provinces + ICT; drop AJK (10) + GB (14) out-of-scope units.
gb <- gb[gb[["adm1_name"]] %in% inscope_adm1, ]
if (nrow(gb) != 136L) stop(sprintf("in-scope unit count is %d, expected 136", nrow(gb)), call. = FALSE)
# drop the abolished Lehri phantom (present in COD v01, absent from the 2023 census).
gb <- gb[gb[["adm2_pcode"]] != lehri_pcode, ]
if (nrow(gb) != 135L) stop(sprintf("post-Lehri-drop count is %d, expected 135", nrow(gb)), call. = FALSE)

# assign census area_code: pinned override, else identity slug on the COD name.
gb[["area_code"]] <- ifelse(
  gb[["adm2_pcode"]] %in% names(crosswalk_override),
  crosswalk_override[gb[["adm2_pcode"]]],
  paste0(prov_prefix[gb[["adm1_name"]]], "-", slug(gb[["cod_shape_name"]])))
# relabel West Karachi as the single documented Keamari combine feature.
gb[["area_code"]][gb[["adm2_pcode"]] == westkar_pcode] <- combined_code

# ---- crosswalk gates (stop on any roster surprise) -----------------------------
if (anyDuplicated(gb[["area_code"]])) {
  dup <- gb[["area_code"]][duplicated(gb[["area_code"]])]
  stop("duplicated feature area_code(s): ", paste(dup, collapse = ", "), call. = FALSE)
}
one_to_one <- setdiff(gb[["area_code"]], combined_code)
expected_one_to_one <- setdiff(census_codes, c("sd-keamari", "sd-karachi-west"))
if (!setequal(one_to_one, expected_one_to_one)) {
  stop("one-to-one feature codes do not equal the census roster minus {sd-keamari, sd-karachi-west}\n",
       "  in features not census: ", paste(setdiff(one_to_one, census_codes), collapse = ", "), "\n",
       "  census not one-to-one: ", paste(setdiff(census_codes, c(one_to_one, "sd-keamari", "sd-karachi-west")), collapse = ", "),
       call. = FALSE)
}
if (!(combined_code %in% gb[["area_code"]])) stop("combined Keamari feature is missing", call. = FALSE)

# ---- per-feature area_name (census naming) -------------------------------------
combined_name <- "Karachi West and Keamari districts (combined boundary)"
combine_declaration <- paste(
  "The 2023 census publishes Karachi West and Keamari as separate districts; the",
  "licensed COD-AB v01 boundary vintage (valid 2022-09-09) pre-dates the 21 August",
  "2020 split that carved Keamari out of Karachi West, so this single COD West",
  "Karachi polygon is a boundary-driven display combine of the two census units",
  "(KI KPC/KUC precedent). No geometry is invented or split.")
gb[["area_name"]] <- vapply(gb[["area_code"]], function(cc) {
  if (identical(cc, combined_code)) return(combined_name)
  nm <- census_name[[cc]]
  if (is.null(nm)) stop("no census area_name for code ", cc, call. = FALSE)
  nm
}, character(1))

# carry the documented-combine declaration only on the combined feature.
gb[["boundary_source"]] <- boundary_source
gb[["boundary_licence"]] <- boundary_licence
gb[["boundary_vintage"]] <- boundary_vintage
gb[["boundary_combine_note"]] <- ifelse(gb[["area_code"]] == combined_code, combine_declaration, NA_character_)

# stable feature order: province then area_code.
gb <- gb[order(match(gb[["adm1_name"]], inscope_adm1), gb[["area_code"]]), ]

# keep only the pinned per-feature properties (+ the combine note on the one feature).
gb <- gb[, c("area_code", "area_name", "cod_shape_name", "boundary_source",
             "boundary_licence", "boundary_vintage", "boundary_combine_note")]

# ---- extent gate (four provinces + ICT span ~60.9-75.4 E, 23.7-36.9 N; AJK/GB
# dropped, so the eastern edge stops well short of the ~77.8 E full-country max; no
# dateline handling is needed at these longitudes) -------------------------------
bbox <- st_bbox(st_transform(st_make_valid(gb), 4326))
if (bbox[["xmin"]] < 60.0 || bbox[["xmin"]] > 61.5 ||
    bbox[["xmax"]] < 74.5 || bbox[["xmax"]] > 76.0 ||
    bbox[["ymin"]] < 23.0 || bbox[["ymin"]] > 24.5 ||
    bbox[["ymax"]] < 36.0 || bbox[["ymax"]] > 37.5) {
  stop("boundary bbox does not match the expected four-provinces + ICT extent", call. = FALSE)
}

# ---- simplify to web weight, then re-validate ----------------------------------
gb <- st_transform(st_make_valid(gb), 4326)
simplification <- mapshaper_simplify_to_cap(
  gb, boundary_out,
  max_bytes = 2500000L,
  keep_percentages = c(100, 75, 50, 30, 20, 15, 10, 7, 5),
  clean_option = "allow-overlaps")

written <- st_read(boundary_out, quiet = TRUE, stringsAsFactors = FALSE)
written <- written[match(gb[["area_code"]], written[["area_code"]]), ]
if (anyNA(written[["area_code"]])) stop("simplified boundary lost an area_code", call. = FALSE)
if (nrow(written) != 135L) stop("simplified boundary does not contain 135 features", call. = FALSE)
w_valid <- st_is_valid(written)
if (any(st_is_empty(written)) || any(is.na(w_valid)) || any(!w_valid)) {
  stop("simplified boundary has empty or invalid geometries", call. = FALSE)
}
geom_hashes <- geometry_hashes(written)
if (length(unique(geom_hashes)) != 135L) stop("simplified boundary geometry hashes are not distinct", call. = FALSE)

# ---- report --------------------------------------------------------------------
cat(sprintf("boundary: PASSED (135 valid distinct features, %d bytes at %g%% keep)\n",
            file_bytes(boundary_out), simplification[["keep_percent"]]))
cat(sprintf("crosswalk: 134 one-to-one + 1 combined (%s); AJK 10 + GB 14 + Lehri phantom dropped\n", combined_code))
cat(sprintf("geometry hashes: %d distinct of 135\n", length(unique(geom_hashes))))
cat(sprintf("boundary sha256: %s\n", sha256_file(boundary_out)))
cat(sprintf("wrote %s\n", boundary_out))
