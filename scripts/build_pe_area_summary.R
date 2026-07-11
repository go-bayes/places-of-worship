# build the Peru department census-religion area-summary product for two comparable
# waves (2007, 2017) on a 25-unit departmental frame (24 departments plus the
# Provincia Constitucional del Callao; Lima is the whole department, Lima province
# plus Region Lima, matching the 2007 published frame). inputs (all cached,
# git-ignored, sha256 in research/countries/pe/route-probe.md):
#   data/raw/pe_census/pe_2017_resultados_definitivos_tomo03.pdf -> CUADRO Nº 1
#     "Poblacion censada de 12 y mas anos de edad ... segun departamento ... y
#     religion que profesa" (exact counts, four categories, Total column)
#   data/raw/pe_census/pe_2007_perfil_sociodemografico.pdf -> CUADRO Nº 2.46
#     "Poblacion censada de 12 y mas anos de edad, por tipo de religion que profesa,
#     segun departamento, 2007" (exact department Total plus one-decimal category
#     percentages)
#   data/raw/pe_census/geoBoundaries-PER-ADM1.geojson -> 26-feature ADM1 boundary
#   data/raw/pe_census/gb_per_adm1_meta.json          -> boundary licence metadata
# every wave shares the census universe (population aged 12 and over) and the four
# verbatim INEI categories (Catolica, Evangelica, Otra, Ninguna), so the series is
# comparable across 2007-2017. 2017 ships exact published counts; 2007 ships the
# exact published department Total with category counts DERIVED from the published
# one-decimal percentages under a recorded rounding bound (the Burkina Faso 2019
# derived-bound precedent). the build stops on any margin failure and never
# allocates, infers, imputes, or tunes a value.
# outputs: apps/regions/pe/data/pe_department_2008.geojson,
#   apps/regions/pe/data/area_summary_department.{json,csv}, and
#   docs/manifests/pe-census-religion-2007-2017.json.
# run from the repo root: Rscript scripts/build_pe_area_summary.R
# STAGED product: no page, no hub link; licence needs_review (INEI states no explicit
# reuse grant on its census results; ships with attribution under build-then-ask).

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "PE"
script_id <- "scripts/build_pe_area_summary.R"
raw_dir <- "data/raw/pe_census"
product_dir <- "apps/regions/pe/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-12"
stamp <- paste0(retrieval_date, "T00:00:00Z")
git_commit <- trimws(system2("git", c("rev-parse", "HEAD"), stdout = TRUE))
if (length(git_commit) != 1L || !grepl("^[a-f0-9]{40}$", git_commit)) git_commit <- NULL

boundary_level <- "department"
boundary_vintage <- "2008"
boundary_set_id <- "pe-department-2008-geoboundaries-adm1"

d2017 <- "pe-census-2017-resultados-definitivos-cuadro1-religion-by-department"
d2007 <- "pe-census-2007-perfil-cuadro-2-46-religion-by-department"
d_boundary <- "geoboundaries-per-adm1-2008"

url_2017 <- "https://www.inei.gob.pe/media/MenuRecursivo/publicaciones_digitales/Est/Lib1544/00TOMO_03.pdf"
url_2007 <- "https://www.inei.gob.pe/media/MenuRecursivo/publicaciones_digitales/Est/Lib1136/libro.pdf"
inei_terms_url <- "https://www.inei.gob.pe/media/odisea/Terminos_y_Condiciones_ODISEA.pdf"
inei_home_url <- "https://www.inei.gob.pe"
boundary_url <- "https://github.com/wmgeolab/geoBoundaries/raw/90a1d52/releaseData/gbOpen/PER/ADM1/geoBoundaries-PER-ADM1.geojson"
boundary_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/PER/ADM1/"

path_2017 <- file.path(raw_dir, "pe_2017_resultados_definitivos_tomo03.pdf")
path_2007 <- file.path(raw_dir, "pe_2007_perfil_sociodemografico.pdf")
path_terms <- file.path(raw_dir, "inei_terminos_condiciones_odisea.pdf")
boundary_path <- file.path(raw_dir, "geoBoundaries-PER-ADM1.geojson")
boundary_meta_path <- file.path(raw_dir, "gb_per_adm1_meta.json")

boundary_out <- file.path(product_dir, "pe_department_2008.geojson")
summary_json_out <- file.path(product_dir, "area_summary_department.json")
summary_csv_out <- file.path(product_dir, "area_summary_department.csv")
manifest_out <- file.path(manifest_dir, "pe-census-religion-2007-2017.json")

# ---- canonical 25-unit departmental frame --------------------------------------
# display name, area slug, and geoBoundaries shapeName concordance (identity where
# absent). Lima dissolves two geoBoundaries polygons; Callao maps to El Callao.
display <- c("Amazonas", "Áncash", "Apurímac", "Arequipa", "Ayacucho", "Cajamarca",
             "Callao", "Cusco", "Huancavelica", "Huánuco", "Ica", "Junín",
             "La Libertad", "Lambayeque", "Lima", "Loreto", "Madre de Dios",
             "Moquegua", "Pasco", "Piura", "Puno", "San Martín", "Tacna",
             "Tumbes", "Ucayali")
slug <- c("amazonas", "ancash", "apurimac", "arequipa", "ayacucho", "cajamarca",
          "callao", "cusco", "huancavelica", "huanuco", "ica", "junin",
          "la_libertad", "lambayeque", "lima", "loreto", "madre_de_dios",
          "moquegua", "pasco", "piura", "puno", "san_martin", "tacna",
          "tumbes", "ucayali")
names(slug) <- display
# census display -> geoBoundaries shapeName(s). Lima is a two-polygon dissolve
# (Region Lima "Lima" plus the "Municipalidad Metropolitana de Lima" = Lima province).
boundary_names <- list(
  Amazonas = "Amazonas", `Áncash` = "Ancash", `Apurímac` = "Apurímac",
  Arequipa = "Arequipa", Ayacucho = "Ayacucho", Cajamarca = "Cajamarca",
  Callao = "El Callao", Cusco = "Cusco", Huancavelica = "Huancavelica",
  `Huánuco` = "Huánuco", Ica = "Ica", `Junín` = "Junín", `La Libertad` = "La Libertad",
  Lambayeque = "Lambayeque",
  Lima = c("Lima", "Municipalidad Metropolitana de Lima"),
  Loreto = "Loreto", `Madre de Dios` = "Madre de Dios", Moquegua = "Moquegua",
  Pasco = "Pasco", Piura = "Piura", Puno = "Puno", `San Martín` = "San Martín",
  Tacna = "Tacna", Tumbes = "Tumbes", Ucayali = "Ucayali")

# ---- 2017 CUADRO Nº 1: exact published counts (Total column, all persons 12+) ----
# verbatim category order: Catolica, Evangelica, Otra 1/, Ninguna. transcribed from
# the cached PDF and margin-verified before transcription.
t17   <- c(281605, 850507, 315006, 1118223, 479120, 1026734, 799608, 950323, 266825, 551601, 662444, 969059, 1379613, 935564, 7782282, 623029, 105503, 142211, 196780, 1410686, 944083, 608404, 269027, 171351, 356803)
cat17 <- c(179874, 652615, 245586, 932142, 362165, 774428, 607399, 748407, 194220, 375083, 539790, 718465, 941814, 744958, 5995692, 419438, 74443, 114676, 131701, 1196169, 774536, 366581, 203754, 134380, 207023)
eva17 <- c(64696, 132624, 55641, 70419, 98252, 182469, 94533, 127394, 67350, 145711, 67956, 180771, 272271, 128087, 844302, 150604, 16664, 10389, 46886, 150323, 75218, 134509, 24051, 25279, 98420)
otr17 <- c(14376, 25700, 7520, 68454, 6305, 35720, 54334, 43047, 1547, 10580, 29839, 24633, 66093, 32049, 454117, 26831, 6529, 9841, 7020, 38800, 65855, 38756, 23911, 5299, 18716)
nin17 <- c(22659, 39568, 6259, 47208, 12398, 34117, 43342, 31475, 3708, 20227, 24859, 45190, 99435, 30470, 488171, 26156, 7867, 7305, 11173, 25394, 28474, 68558, 17311, 6393, 32644)
national_2017 <- 23196391L
cat_nat_2017 <- c(Catolica = 17635339L, Evangelica = 3264819L, Otra = 1115872L, Ninguna = 1180361L)

# ---- 2007 CUADRO Nº 2.46: exact department Total plus one-decimal percentages -----
t07    <- c(262668, 802493, 287184, 914344, 438479, 1009763, 690756, 857125, 312007, 538672, 550646, 908615, 1224099, 847524, 6751252, 616805, 81819, 129568, 208879, 1241301, 955740, 531118, 228739, 152086, 308820)
cat07p <- c(67.8, 83.0, 83.1, 87.2, 81.1, 79.9, 82.4, 83.4, 76.6, 75.2, 87.4, 79.3, 76.1, 84.6, 83.1, 72.9, 78.5, 85.4, 74.2, 88.7, 81.8, 65.8, 80.6, 84.0, 65.2)
eva07p <- c(18.1, 12.4, 13.5, 6.5, 16.3, 14.2, 12.3, 11.0, 21.8, 20.9, 8.4, 15.8, 16.5, 11.0, 10.8, 19.8, 11.6, 7.0, 19.5, 8.3, 7.9, 19.5, 8.5, 11.6, 22.9)
otr07p <- c(7.5, 2.1, 2.1, 3.9, 1.1, 3.0, 2.8, 3.5, 0.5, 1.5, 2.4, 2.1, 3.5, 2.3, 3.1, 4.4, 5.6, 4.7, 3.0, 2.0, 7.2, 6.2, 7.1, 2.2, 5.1)
nin07p <- c(6.5, 2.6, 1.3, 2.4, 1.5, 2.9, 2.6, 2.1, 1.1, 2.4, 1.8, 2.9, 4.0, 2.0, 3.0, 2.8, 4.4, 2.8, 3.2, 1.1, 3.1, 8.5, 3.8, 2.1, 6.7)
national_2007 <- 20850502L

# ---- reconciliation gates (fail-fast; stop, do not tune) ------------------------
# 2017: every department's four categories sum to its printed Total, every category
# sums across departments to the printed national margin, and the grand total holds.
recs_2017 <- list()
for (i in seq_along(display)) {
  s <- cat17[i] + eva17[i] + otr17[i] + nin17[i]
  if (s != t17[i]) stop(sprintf("2017 gate FAILED for %s: categories sum %d != printed Total %d", display[i], s, t17[i]), call. = FALSE)
  recs_2017[[length(recs_2017) + 1L]] <- data.frame(year = 2017L, margin = "department_total", key = display[i], computed = s, printed = t17[i], difference = 0L, stringsAsFactors = FALSE)
}
cat_sums_2017 <- c(Catolica = sum(cat17), Evangelica = sum(eva17), Otra = sum(otr17), Ninguna = sum(nin17))
for (k in names(cat_nat_2017)) {
  if (cat_sums_2017[[k]] != cat_nat_2017[[k]]) stop(sprintf("2017 category-margin gate FAILED for %s: sum %d != printed %d", k, cat_sums_2017[[k]], cat_nat_2017[[k]]), call. = FALSE)
  recs_2017[[length(recs_2017) + 1L]] <- data.frame(year = 2017L, margin = "religion_row", key = k, computed = cat_sums_2017[[k]], printed = cat_nat_2017[[k]], difference = 0L, stringsAsFactors = FALSE)
}
if (sum(t17) != national_2017) stop(sprintf("2017 grand gate FAILED: %d != %d", sum(t17), national_2017), call. = FALSE)
if (sum(cat_nat_2017) != national_2017) stop("2017 national category totals do not sum to national", call. = FALSE)
message(sprintf("gate 2017: PASSED (25 department totals and 4 category margins close exactly to %d)", national_2017))

# 2007: department Totals sum exactly to national; every department's published
# one-decimal percentages sum to 100 within the +/-0.1pp one-decimal rounding band.
# category counts are DERIVED from the percentages under a recorded bound.
if (sum(t07) != national_2007) stop(sprintf("2007 grand gate FAILED: %d != %d", sum(t07), national_2007), call. = FALSE)
recs_2007 <- list()
pct_band <- 0.15  # tolerance on the sum of four one-decimal percentages (4 * 0.05 rounded up)
for (i in seq_along(display)) {
  psum <- cat07p[i] + eva07p[i] + otr07p[i] + nin07p[i]
  if (abs(psum - 100) > pct_band) stop(sprintf("2007 percentage gate FAILED for %s: published shares sum to %.1f (outside 100 +/- %.2f)", display[i], psum, pct_band), call. = FALSE)
  recs_2007[[length(recs_2007) + 1L]] <- data.frame(year = 2007L, margin = "published_percentage_sum", key = display[i], computed = psum, printed = 100, difference = round(psum - 100, 4), stringsAsFactors = FALSE)
}
recs_2007[[length(recs_2007) + 1L]] <- data.frame(year = 2007L, margin = "department_total", key = "PERU", computed = sum(t07), printed = national_2007, difference = 0L, stringsAsFactors = FALSE)
message(sprintf("gate 2007: PASSED (25 department Totals close exactly to %d; every published percentage row sums to 100 +/- %.2f)", national_2007, pct_band))

# ---- boundary ------------------------------------------------------------------
sha256_file <- function(path) unname(tools::sha256sum(path))
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))
require_file <- function(path) if (!file.exists(path) || file_bytes(path) == 0L) stop("missing required source: ", path, call. = FALSE)
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$", path)) return(length(fromJSON(path, simplifyVector = FALSE)[["features"]]))
  if (grepl("\\.json$", path)) return(length(fromJSON(path, simplifyVector = FALSE)[["rows"]]))
  NA_integer_
}
geometry_hashes <- function(layer) {
  vapply(seq_len(nrow(layer)), function(i) digest(st_as_binary(st_geometry(layer)[i], EWKB = TRUE)[[1L]], algo = "sha256", serialize = FALSE), character(1))
}

invisible(lapply(c(path_2017, path_2007, boundary_path, boundary_meta_path), require_file))

# confirm the pinned boundary licence, unit count, and type before use.
boundary_metadata <- fromJSON(boundary_meta_path, simplifyVector = FALSE)
if (!identical(boundary_metadata[["boundaryLicense"]], "Public Domain") ||
    !identical(boundary_metadata[["admUnitCount"]], "26") ||
    !identical(boundary_metadata[["boundaryType"]], "ADM1")) {
  stop("geoBoundaries PER ADM1 licence, unit count, or type metadata changed", call. = FALSE)
}

# Peru-centred equal-area projection for land areas (western hemisphere, no dateline).
pe_laea <- "+proj=laea +lat_0=-10 +lon_0=-75 +datum=WGS84 +units=m +no_defs"

# dissolve the 26 geoBoundaries features into the 25 census departments (Lima unions
# two polygons); every other unit maps one-to-one by shapeName.
build_boundary <- function(path) {
  raw <- st_make_valid(st_read(path, quiet = TRUE, stringsAsFactors = FALSE))
  if (nrow(raw) != 26L) stop("geoBoundaries PER ADM1 feature count is not 26", call. = FALSE)
  used <- character(0)
  geoms <- vector("list", length(display))
  for (i in seq_along(display)) {
    want <- boundary_names[[display[i]]]
    idx <- match(want, raw[["shapeName"]])
    if (anyNA(idx)) stop(sprintf("boundary name(s) not found for %s: %s", display[i], paste(want, collapse = ", ")), call. = FALSE)
    used <- c(used, raw[["shapeName"]][idx])
    g <- st_geometry(raw)[idx]
    geoms[[i]] <- if (length(idx) > 1L) st_union(st_make_valid(g))[[1L]] else g[[1L]]
  }
  if (length(unique(used)) != 26L) stop("boundary dissolve did not consume all 26 features exactly once", call. = FALSE)
  boundary <- st_sf(
    area_code = unname(slug[display]),
    area_name = display,
    boundary_source_name = vapply(display, function(d) paste(boundary_names[[d]], collapse = " + "), character(1)),
    area_unit_id = paste(boundary_set_id, unname(slug[display]), sep = ":"),
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    boundary_vintage = boundary_vintage,
    geometry = st_sfc(geoms, crs = st_crs(raw))
  )
  boundary <- st_make_valid(boundary)
  boundary[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(boundary, pe_laea))) / 1e6
  st_transform(boundary, 4326)
}

boundary <- build_boundary(boundary_path)
if (nrow(boundary) != 25L) stop("dissolved boundary is not 25 features", call. = FALSE)

# full-extent gate: Peru spans roughly lon -81.4..-68.6, lat -18.4..-0.0; western
# hemisphere, no antimeridian crossing.
bbox <- st_bbox(boundary)
if (bbox[["xmin"]] < -81.5 || bbox[["xmin"]] > -80.5 || bbox[["xmax"]] < -69.5 || bbox[["xmax"]] > -68.0 ||
    bbox[["ymin"]] < -18.6 || bbox[["ymin"]] > -17.5 || bbox[["ymax"]] < -0.5 || bbox[["ymax"]] > 0.5) {
  stop("boundary bbox does not match the expected Peru extent", call. = FALSE)
}

simplification <- mapshaper_simplify_to_cap(
  boundary, boundary_out,
  max_bytes = 900000L,
  keep_percentages = c(60, 40, 25, 15, 10, 6, 4),
  clean_option = "allow-overlaps"
)
written <- st_read(boundary_out, quiet = TRUE, stringsAsFactors = FALSE)
written <- written[match(boundary[["area_code"]], written[["area_code"]]), ]
if (anyNA(written[["area_code"]])) stop("simplified boundary lost an area code", call. = FALSE)
if (nrow(written) != 25L) stop("simplified boundary does not contain 25 features", call. = FALSE)
w_valid <- st_is_valid(written)
if (any(st_is_empty(written)) || any(is.na(w_valid)) || any(!w_valid)) stop("simplified boundary has empty or invalid geometries", call. = FALSE)
geom_hashes <- geometry_hashes(written)
if (length(unique(geom_hashes)) != 25L) stop("simplified boundary geometry hashes are not distinct", call. = FALSE)
message(sprintf("boundary: PASSED (25 valid distinct features, %d bytes at %g%% keep)", file_bytes(boundary_out), simplification[["keep_percent"]]))

land_area <- setNames(round(written[["land_area_sq_km"]], 4), written[["area_name"]])
area_unit <- setNames(written[["area_unit_id"]], written[["area_name"]])
area_code <- setNames(written[["area_code"]], written[["area_name"]])

# ---- product rows --------------------------------------------------------------
# slot design (ordinary two-slot): religious_affiliation_percent is the summed share
# of the three religious-affiliation categories (Catolica + Evangelica + Otra);
# no_religion_percent is the single Ninguna line. the INEI four-category frame is a
# complete partition of the answering population aged 12+, so the two shares sum to
# 100 by construction (there is no separate non-response line in this table); the
# richer Catolica/Evangelica/Otra signal rides on the quality flag verbatim.
round4 <- function(x) round(x, 4)

make_row_2017 <- function(i) {
  pop <- t17[i]; no_rel <- nin17[i]; aff <- cat17[i] + eva17[i] + otr17[i]
  breakdown <- sprintf("Católica=%d;Evangélica=%d;Otra=%d;Ninguna=%d", cat17[i], eva17[i], otr17[i], nin17[i])
  flag <- paste0(
    "census_affiliation;universe_population_12_plus;frame_four_category_catolica_evangelica_otra_ninguna;",
    "religious_affiliation_percent_is_catolica_plus_evangelica_plus_otra;no_religion_percent_is_ninguna_line;",
    "frame_partitions_answering_population_shares_sum_to_100_by_construction;",
    "counts_exact_published;comparable_2007_2017;licence_needs_review_build_then_ask;boundary_public_domain;",
    "source_categories_verbatim=", breakdown)
  list(country_code = country_code, boundary_set_id = boundary_set_id, boundary_level = boundary_level,
       area_unit_id = unname(area_unit[[display[i]]]), area_code = unname(area_code[[display[i]]]), area_name = display[i],
       year = 2017L, population_total = as.integer(pop),
       population_total_basis = "2017 Census (INEI, Resultados Definitivos, CUADRO Nº 1): printed department Total of the population aged 12 and over.",
       religious_affiliation_count = as.integer(aff), religious_affiliation_percent = round4(100 * aff / pop),
       no_religion_count = as.integer(no_rel), no_religion_percent = round4(100 * no_rel / pop),
       place_count = NULL, places_per_10000_residents = NULL, place_density_per_sq_km = NULL,
       land_area_sq_km = unname(land_area[[display[i]]]), site_snapshot_date = NULL, place_count_basis = NULL,
       source_dataset_ids = list(d2017, d_boundary), quality_flag = flag)
}

# 2007 derived-count bound: each derived category count = round(Total * pct/100); the
# per-category rounding error is bounded by Total * 0.0005 (half of the 0.1pp step).
make_row_2007 <- function(i) {
  pop <- t07[i]
  no_rel <- as.integer(round(pop * nin07p[i] / 100))
  aff <- pop - no_rel
  cat_c <- round(pop * cat07p[i] / 100); eva_c <- round(pop * eva07p[i] / 100); otr_c <- round(pop * otr07p[i] / 100)
  bound <- ceiling(pop * 0.0005)
  breakdown <- sprintf("Católica=%.1f%%;Evangélica=%.1f%%;Otra=%.1f%%;Ninguna=%.1f%%", cat07p[i], eva07p[i], otr07p[i], nin07p[i])
  derived <- sprintf("Católica~%d;Evangélica~%d;Otra~%d;Ninguna~%d", as.integer(cat_c), as.integer(eva_c), as.integer(otr_c), no_rel)
  flag <- paste0(
    "census_affiliation;universe_population_12_plus;frame_four_category_catolica_evangelica_otra_ninguna;",
    "religious_affiliation_percent_is_100_minus_ninguna;no_religion_percent_is_published_ninguna_percentage;",
    "frame_partitions_answering_population_shares_sum_to_100_by_construction;",
    "department_total_exact_published;category_counts_derived_from_one_decimal_percentages;",
    sprintf("derived_count_rounding_bound_per_category=+/-%d;", as.integer(bound)),
    "comparable_2007_2017;licence_needs_review_build_then_ask;boundary_public_domain;",
    "source_percentages_verbatim=", breakdown, ";derived_counts=", derived)
  list(country_code = country_code, boundary_set_id = boundary_set_id, boundary_level = boundary_level,
       area_unit_id = unname(area_unit[[display[i]]]), area_code = unname(area_code[[display[i]]]), area_name = display[i],
       year = 2007L, population_total = as.integer(pop),
       population_total_basis = "2007 Census (INEI, Perfil Sociodemografico, CUADRO Nº 2.46): printed department Total of the population aged 12 and over.",
       religious_affiliation_count = as.integer(aff), religious_affiliation_percent = round4(100 - nin07p[i]),
       no_religion_count = as.integer(no_rel), no_religion_percent = round4(nin07p[i]),
       place_count = NULL, places_per_10000_residents = NULL, place_density_per_sq_km = NULL,
       land_area_sq_km = unname(land_area[[display[i]]]), site_snapshot_date = NULL, place_count_basis = NULL,
       source_dataset_ids = list(d2007, d_boundary), quality_flag = flag)
}

rows <- c(lapply(seq_along(display), make_row_2007), lapply(seq_along(display), make_row_2017))

# ---- area-summary document -----------------------------------------------------
licence_note <- paste(
  "INEI publishes the 2007 and 2017 census results openly on its institutional portal",
  "(www.inei.gob.pe). No Creative Commons or explicit data-reuse licence is stated on",
  "the published results tables. The reachable INEI 'Terminos y Condiciones' (ODISEA)",
  "govern the interactive participation services of the portal, not reuse of the",
  "statistical tables. The INEI microdata access policy (ANDA, webinei.inei.gob.pe) was",
  "unreachable from the build environment and could not be quoted. Under the build-then-ask",
  "ruling the derived department summaries ship with attribution to INEI and licence",
  "status needs_review; an INEI reuse-confirmation ask is recorded for the PI. The",
  "boundary is Public Domain (geoBoundaries PER ADM1, Wikimedia Commons source).")

source_datasets <- function() {
  list(
    list(source_dataset_id = d2007,
         name = "Peru 2007 Census (XI de Poblacion, VI de Vivienda), Perfil Sociodemografico del Peru, CUADRO Nº 2.46: population aged 12+ by religion, by department",
         provider = "Instituto Nacional de Estadistica e Informatica (INEI)", url = url_2007, retrieval_date = retrieval_date, local_path = path_2007,
         licence = list(name = licence_note, url = inei_terms_url, attribution = "Instituto Nacional de Estadistica e Informatica (INEI), Censos Nacionales 2007: XI de Poblacion y VI de Vivienda"),
         citation = "INEI, Censos Nacionales 2007: XI de Poblacion y VI de Vivienda, Perfil Sociodemografico del Peru, CUADRO Nº 2.46.",
         access_limits = NULL,
         redistribution_limits = "Derived department summaries only; no explicit reuse licence stated on the INEI source. Ships STAGED, needs_review, under build-then-ask with INEI attribution.",
         notes = "Universe: population aged 12 and over. The table prints the exact department Total (count) plus one-decimal category percentages (Catolica, Evangelica, Otra, Ninguna). Department Totals sum exactly to the national 20,850,502; category counts are DERIVED from the published percentages under a recorded per-category rounding bound. Frame is 25 units: Lima is the whole department (Lima province plus Region Lima)."),
    list(source_dataset_id = d2017,
         name = "Peru 2017 Census (XII de Poblacion, VII de Vivienda), Resultados Definitivos, CUADRO Nº 1: population aged 12+ by department, area, sex, and religion",
         provider = "Instituto Nacional de Estadistica e Informatica (INEI)", url = url_2017, retrieval_date = retrieval_date, local_path = path_2017,
         licence = list(name = licence_note, url = inei_terms_url, attribution = "Instituto Nacional de Estadistica e Informatica (INEI), Censos Nacionales 2017: XII de Poblacion, VII de Vivienda y III de Comunidades Indigenas"),
         citation = "INEI, Censos Nacionales 2017: XII de Poblacion, VII de Vivienda y III de Comunidades Indigenas, Resultados Definitivos, CUADRO Nº 1.",
         access_limits = NULL,
         redistribution_limits = "Derived department summaries only; no explicit reuse licence stated on the INEI source. Ships STAGED, needs_review, under build-then-ask with INEI attribution.",
         notes = "Universe: population aged 12 and over. Exact published counts, four categories (Catolica, Evangelica, Otra, Ninguna). Every department's categories sum to its printed Total and every category sums across departments to the printed national margin; the grand total is 23,196,391. The 2017 table splits Lima into Provincia de Lima and Region Lima (a 26-unit frame); this product aggregates them to DEPARTAMENTO LIMA to match the 2007 25-unit frame."),
    list(source_dataset_id = d_boundary,
         name = "geoBoundaries PER ADM1 (26 features; 25 departments after dissolving Lima)",
         provider = "geoBoundaries (William & Mary geoLab); boundary source Wikimedia Commons", url = boundary_url, retrieval_date = retrieval_date, local_path = boundary_path,
         licence = list(name = "Public Domain", url = boundary_meta_url, attribution = "geoBoundaries (gbOpen); boundary source Wikimedia Commons"),
         citation = "geoBoundaries PER ADM1 (gbOpen, pinned 90a1d52), 26 features dissolved to 25 departments.",
         access_limits = NULL,
         redistribution_limits = "The simplified derived boundary is committed under Public Domain; no attribution obligation on the geometry.",
         notes = "boundaryLicense 'Public Domain', licenseSource commons.wikimedia.org/wiki/File, boundaryYearRepresented 2008, admUnitCount 26. The 26 features dissolve to the 25 census departments: 'Lima' (Region Lima) and 'Municipalidad Metropolitana de Lima' (Lima province) union into DEPARTAMENTO LIMA; 'El Callao' maps to the Provincia Constitucional del Callao; the other 23 map one-to-one. Western hemisphere, no antimeridian handling."))
}

indicators <- function() {
  denom_note <- "Percentages use each department's printed census population Total (population aged 12 and over). The four INEI categories partition the answering population, so religious_affiliation_percent and no_religion_percent sum to 100 by construction."
  list(
    list(indicator_id = "population_total", label = "Census population 12+ total",
         description = "Department population aged 12 and over represented in the census religion table.",
         unit = "count", denominator_indicator_id = NULL,
         method = "Printed department Total: 2007 CUADRO Nº 2.46, 2017 CUADRO Nº 1.",
         temporal_coverage = "2007; 2017", spatial_coverage = "Peru departments (25)",
         quality_notes = "Both waves count the population aged 12 and over; there is no universe break, so department denominators are comparable across 2007-2017. The population grows from 20,850,502 to 23,196,391; this is a population change, never a religion change."),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
         description = "Share of the department population aged 12+ reporting a religion (Catolica, Evangelica, or Otra).",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "2017: 100 * (Catolica + Evangelica + Otra) / Total, exact. 2007: 100 - published Ninguna percentage.",
         temporal_coverage = "2007; 2017", spatial_coverage = "Peru departments (25)",
         quality_notes = paste("Comparable across both waves at the affiliation/no-religion level. The Catolica/Evangelica/Otra composition is the richer signal and rides verbatim on each row's quality flag (exact counts in 2017, one-decimal percentages in 2007).", denom_note)),
    list(indicator_id = "no_religion_percent", label = "No religious affiliation %",
         description = "Share of the department population aged 12+ in the census 'Ninguna' (no religion) line.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "2017: 100 * Ninguna / Total, exact. 2007: the published one-decimal Ninguna percentage.",
         temporal_coverage = "2007; 2017", spatial_coverage = "Peru departments (25)",
         quality_notes = paste("No-religion varies markedly across departments (2017: from ~2% in Piura/Apurimac to ~11% in San Martin) and grows nationally from 2.9% (2007) to 5.1% (2017).", denom_note)))
}

visual_layers <- function() {
  list(
    list(visual_layer_id = "pe-department-religious-affiliation", label = "Religious affiliation %",
         description = "Peru census-affiliation share by department, 2007 and 2017.", layer_type = "choropleth",
         indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "department population aged 12 and over"),
         colour_scale = "sequential", time_control = "year_selector", aggregation_rule = "reported department value",
         uncertainty_display = "quality_flag", default_visibility = TRUE,
         notes = "Census affiliation, not practice, attendance, or membership. Affiliation and no-religion sum to 100 by construction; the Catolica/Evangelica/Otra composition rides on the quality flag."),
    list(visual_layer_id = "pe-department-no-religion", label = "No religious affiliation %",
         description = "Peru census no-religion (Ninguna) share by department, 2007 and 2017.", layer_type = "choropleth",
         indicator_ids = list("no_religion_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "department population aged 12 and over"),
         colour_scale = "sequential", time_control = "year_selector", aggregation_rule = "reported department value",
         uncertainty_display = "quality_flag", default_visibility = FALSE,
         notes = "The source category is 'Ninguna' (no religion). Exact in 2017; published one-decimal percentage in 2007."))
}

summary_product <- list(
  schema_version = "area-summary.v1", generated_at = stamp, generated_by = script_id, country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code, level = boundary_level, vintage = boundary_vintage, source_dataset_id = d_boundary),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "No governed place-of-worship snapshot ships in the Peru census product.",
                       notes = "Place counts and density metrics remain null."),
  source_datasets = source_datasets(), indicators = indicators(), visual_layers = visual_layers(), rows = rows)

write_json(summary_product, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(summary_json_out, warn = FALSE), collapse = "\n"))) stop("area-summary JSON is invalid", call. = FALSE)

flatten_rows <- function(rows) {
  do.call(rbind, lapply(rows, function(r) data.frame(
    country_code = r[["country_code"]], boundary_set_id = r[["boundary_set_id"]], boundary_level = r[["boundary_level"]],
    area_unit_id = r[["area_unit_id"]], area_code = r[["area_code"]], area_name = r[["area_name"]], year = r[["year"]],
    population_total = r[["population_total"]], population_total_basis = r[["population_total_basis"]],
    religious_affiliation_count = r[["religious_affiliation_count"]], religious_affiliation_percent = r[["religious_affiliation_percent"]],
    no_religion_count = r[["no_religion_count"]], no_religion_percent = r[["no_religion_percent"]],
    place_count = NA_integer_, places_per_10000_residents = NA_real_, place_density_per_sq_km = NA_real_,
    land_area_sq_km = r[["land_area_sq_km"]], site_snapshot_date = NA_character_, place_count_basis = NA_character_,
    source_dataset_ids = paste(unlist(r[["source_dataset_ids"]]), collapse = "|"), quality_flag = r[["quality_flag"]],
    stringsAsFactors = FALSE)))
}
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

# ---- manifest ------------------------------------------------------------------
raw_source_record <- function(path, url, format, used, periods, dataset_id, notes) {
  list(uri = path, url = url, format = format, bytes = file_bytes(path), sha256 = sha256_file(path), row_count = NULL,
       source_dataset_id = dataset_id, used_in_public_product = used, periods = periods, notes = notes,
       local_cache_hint = paste0(path, " (git-ignored by .gitignore data/ rule)"),
       raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/pe_census/"))
}
durable_file_record <- function(path, content, licence_status_value, licence_basis_value) {
  list(uri = paste0("repo:", path), storage_provider = "git_repository", format = sub("^.*\\.", "", path),
       bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = if (grepl("area_summary|\\.csv$", path)) row_count_file(path) else NULL,
       feature_count = if (grepl("\\.geojson$", path)) row_count_file(path) else NULL,
       content = content, privacy = "public", licence_status = licence_status_value, licence_basis = licence_basis_value)
}
licence_basis_slug <- "inei_no_explicit_reuse_grant_build_then_ask"

raw_sources <- list(
  raw_source_record(path_2017, url_2017, "pdf", TRUE, "2017", d2017, "2017 Resultados Definitivos TOMO 03; CUADRO Nº 1 religion by department (exact counts). Margins close to 23,196,391."),
  raw_source_record(path_2007, url_2007, "pdf", TRUE, "2007", d2007, "2007 Perfil Sociodemografico; CUADRO Nº 2.46 religion by department (exact Total plus one-decimal percentages). Totals sum to 20,850,502."),
  raw_source_record(path_terms, inei_terms_url, "pdf", FALSE, NULL, d2017, "INEI Terminos y Condiciones (ODISEA); interactive-services terms, not a data-reuse grant. Quoted in the route probe."),
  raw_source_record(boundary_path, boundary_url, "geojson", TRUE, "2008", d_boundary, "geoBoundaries PER ADM1 GeoJSON; 26 features, Public Domain (Wikimedia Commons). Pinned commit 90a1d52. Dissolved to 25 departments."),
  raw_source_record(boundary_meta_path, boundary_meta_url, "json", FALSE, "2008", d_boundary, "geoBoundaries PER ADM1 metadata; Public Domain, boundaryYearRepresented 2008, admUnitCount 26."))

dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)
dataset_id <- "pe-census-religion:pe:2007-2017:inei-department"
reconciliation_block <- function(rec) lapply(rec, function(r) as.list(r))

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json", schema_version = "data-manifest.v2",
  manifest_id = paste0("manifest:", dataset_id), dataset_id = dataset_id,
  dataset_version_id = paste0(dataset_id, ":", dataset_hash), manifest_sha256 = NULL,
  supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "pe-census-religion", dataset_role = "staged_evidence",
  scope = list(level = "country", country_codes = list("PE"), snapshot_date = NULL, snapshot_anchor = NULL, pipeline_stage = "staged"),
  created_at = stamp, created_by = script_id, target_years = list(2007L, 2017L),
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation (religion professed, population aged 12 and over)",
      shipped_waves = list(2007L, 2017L),
      shipped_geography = "25 Peru departments (24 departments plus Provincia Constitucional del Callao; Lima is the whole department)",
      boundary_set = boundary_set_id,
      source_tables = list(`2007` = "Perfil Sociodemografico CUADRO Nº 2.46 (Total exact + one-decimal category percentages)", `2017` = "Resultados Definitivos CUADRO Nº 1 (exact counts, four categories)"),
      universes = list(`2007` = "population aged 12 and over", `2017` = "population aged 12 and over"),
      category_frame = list("Católica", "Evangélica", "Otra", "Ninguna"),
      slot_design = "Ordinary two-slot. religious_affiliation_percent = Catolica + Evangelica + Otra share; no_religion_percent = Ninguna share. The four INEI categories partition the answering population aged 12+, so the two shares sum to 100 by construction (no separate non-response line). The Catolica/Evangelica/Otra composition rides verbatim on each row's quality flag.",
      wave_precision = list(
        `2017` = "Exact published counts; department and category margins close exactly to 23,196,391.",
        `2007` = "Exact published department Totals (sum exactly to 20,850,502); category counts DERIVED from published one-decimal percentages under a per-category rounding bound of ceiling(Total*0.0005); no_religion_percent is the published Ninguna percentage verbatim."),
      change_rule = "Affiliation and no-religion change is readable across 2007-2017 (same universe, same frame, no break). The Catolica/Evangelica/Otra detail is comparable at one-decimal precision (2007 published percentages vs 2017 exact). Population growth (20.85M to 23.20M) is never treated as a religion change.",
      lima_frame_note = "The 2017 table splits Lima into Provincia de Lima and Region Lima (a 26-unit frame that matches the geoBoundaries ADM1 split exactly); this product aggregates them to DEPARTAMENTO LIMA to share the 2007 25-unit frame. The 26-unit split is a documented deeper option for 2017 alone.",
      held_1993_wave = "1993 religion is comparable at the NATIONAL level only (INEI Perfil 2007 CUADRO Nº 2.44 re-tabulates 1993 for population 12+ and the four categories: Total 15,483,790; Catolica 13,786,001; Evangelica 1,042,888; Otra 432,760; Ninguna 222,141). No department-level 1993 table at the 12+/four-category universe was reachable (the 2007 tabulados host censos.inei.gob.pe and the microdata ANDA host webinei.inei.gob.pe were both unreachable from the build environment). The contemporaneous 1993 profile publishes an ALL-AGES three-category table (Catolica/Otra/Ninguna, Evangelica folded into Otra) on a different universe and frame; it is not backcast or merged. 1993 is HELD for the department product.",
      finer_geography_note = "Province (ADM2, 196 units, geoBoundaries CC BY 3.0 IGO) and district (ADM3, ~1874 units) religion counts exist via INEI REDATAM (censos2017.inei.gob.pe/redatam) and the census microdata, but REDATAM is session-bound and the microdata/ANDA host was unreachable. District via REDATAM/microdata is the documented deeper route.",
      omitted_metrics = list("places_per_10000_residents", "place_density_per_sq_km"),
      boundary_simplification = simplification,
      local_cache_hint = "All raw sources are cached under data/raw/pe_census/ and remain git-ignored.",
      retrieval_record = raw_sources),
    software_versions = list(r = R.version.string, sf = as.character(packageVersion("sf")), jsonlite = as.character(packageVersion("jsonlite")), digest = as.character(packageVersion("digest")), mapshaper = "scripts/lib/simplify_boundary.R (npx mapshaper)")),
  source = list(
    provider = "Instituto Nacional de Estadistica e Informatica (INEI); geoBoundaries (William & Mary geoLab)",
    source_dataset_ids = list(d2007, d2017, d_boundary),
    source_urls = list(url_2007, url_2017, inei_terms_url, boundary_url, boundary_meta_url),
    retrieved_at = stamp, licence = licence_note,
    citation = "INEI Censos Nacionales 2007 (Perfil CUADRO 2.46) and 2017 (Resultados Definitivos CUADRO 1); geoBoundaries PER ADM1 (gbOpen).",
    raw_redistribution = "The census PDFs and the geoBoundaries source GeoJSON are not committed; they remain in data/raw/pe_census/.",
    local_cache_hint = "data/raw/pe_census/ (git-ignored by .gitignore data/ rule)",
    raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/pe_census/")),
  input_manifests = list(), raw_sources = raw_sources,
  durable_files = list(
    durable_file_record(summary_json_out, "Peru 25-department census-affiliation area summary for 2007 and 2017.", "needs_review", licence_basis_slug),
    durable_file_record(summary_csv_out, "Flattened Peru 25-department census-affiliation rows for 2007 and 2017.", "needs_review", licence_basis_slug),
    durable_file_record(boundary_out, "Simplified geoBoundaries PER ADM1 boundary dissolved to 25 departments.", "accepted", "geoboundaries_public_domain")),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id, notes = "25 departments x 2 waves = 50 rows; population 12+ universe in both waves."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out), built_by = script_id, notes = "25 department features from geoBoundaries PER ADM1 (Lima dissolved), simplified with mapshaper.")),
  validation = list(
    status = "passed_with_warnings",
    commands = list("Rscript scripts/build_pe_area_summary.R",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/pe/data/area_summary_department.json",
      "bash scripts/validate_manifests.sh"),
    gate_2017 = list(status = "passed", national_total = national_2017, department_checks = length(display), category_checks = length(cat_nat_2017), records = reconciliation_block(recs_2017)),
    gate_2007 = list(status = "passed", national_total = national_2007, department_total_exact = TRUE, percentage_band = pct_band, records = reconciliation_block(recs_2007)),
    boundary_validation = list(status = "passed", feature_count = 25L, distinct_geometry_hashes = length(unique(geom_hashes)),
      geometry_hashes = as.list(geom_hashes),
      bbox = list(xmin = unname(bbox[["xmin"]]), ymin = unname(bbox[["ymin"]]), xmax = unname(bbox[["xmax"]]), ymax = unname(bbox[["ymax"]])),
      dateline_note = "Peru is wholly in the western hemisphere; no antimeridian handling needed.",
      output_bytes = file_bytes(boundary_out), simplification = simplification,
      licence = boundary_metadata[["boundaryLicense"]], adm_unit_count = boundary_metadata[["admUnitCount"]]),
    join_coverage = list(matched_departments = 25L, expected_departments = 25L, unmatched = list(), unused_boundary_features = list()),
    notes = "2017 CUADRO 1 closes exactly at every margin (23,196,391). 2007 CUADRO 2.46 department Totals sum exactly to 20,850,502; category counts are derived from published one-decimal percentages under a recorded rounding bound. Boundary dissolves 26 geoBoundaries features to 25 departments with distinct geometry hashes.",
    warnings = list(
      "STAGED product: no page, no hub link. Licence needs_review; INEI states no explicit reuse grant on its census results (ODISEA terms are interactive-services terms; the ANDA microdata licence host was unreachable). Ships with INEI attribution under build-then-ask; an INEI reuse-confirmation ask is recorded for the PI.",
      "2007 category counts are DERIVED from published one-decimal percentages (BF-2019 derived-bound precedent); the department Total and the no-religion percentage are exact-published. Per-category rounding bound recorded per row.",
      "The four INEI categories partition the answering population, so religious_affiliation_percent and no_religion_percent sum to 100 by construction (relevant to the PI minority-share/task-6 page design; a page is out of scope here).",
      "1993 is comparable at the national level only (Perfil CUADRO 2.44, 12+/four-category); no department 1993 table at that universe was reachable. HELD, not backcast.",
      "Finer geography (province ADM2, district ADM3) exists via INEI REDATAM and microdata but REDATAM is session-bound and the microdata/ANDA host was unreachable; district via REDATAM/microdata is the documented deeper route.")),
  construct_notes = list(
    "The construct is census affiliation: each resident's professed religion (INEI question, population aged 12 and over), not practice, attendance, or membership.",
    "The public product carries three headline fields per department-wave: population 12+ total, religious affiliation percent, and no-religion percent. Place-density metrics are null (no governed place-of-worship snapshot).",
    "Both waves count the population aged 12 and over with the same four verbatim INEI categories (Catolica, Evangelica, Otra, Ninguna), so there is no universe or frame break and the department series is comparable across 2007-2017.",
    "Slot design (ordinary two-slot): religious_affiliation_percent = Catolica + Evangelica + Otra share; no_religion_percent = Ninguna share. The frame partitions the answering population, so the two shares sum to 100 by construction; the Catolica/Evangelica/Otra composition (the richer signal) rides verbatim on each row's quality flag.",
    "2017 ships exact published counts. 2007 ships the exact published department Total and the published Ninguna percentage; the Catolica/Evangelica/Otra counts are DERIVED from the published one-decimal percentages under a recorded per-category rounding bound (BF-2019 precedent).",
    "1993 is HELD for the department product: it is comparable only at the national level (Perfil CUADRO 2.44, 12+/four-category), and no department-level 1993 table at that universe was reachable. The contemporaneous 1993 all-ages three-category table is a different universe and frame and is neither backcast nor merged.",
    "Boundary: geoBoundaries PER ADM1, Public Domain (Wikimedia Commons). 26 features dissolve to the 25 census departments: 'Lima' and 'Municipalidad Metropolitana de Lima' union into DEPARTAMENTO LIMA; 'El Callao' maps to the Provincia Constitucional del Callao. Peru is western-hemisphere; no dateline handling."),
  deferred_sources = list(
    list(source_dataset_id = "pe-census-district-redatam", status = "deferred", url = "https://censos2017.inei.gob.pe/redatam/", local_path = NULL,
         notes = "District (ADM3, ~1874) and province (ADM2, 196) religion counts exist via INEI REDATAM and the census microdata. REDATAM is session-bound (browser work) and the microdata/ANDA host (webinei.inei.gob.pe) was unreachable from the build environment. The district product also needs a licensed ADM3 boundary (geoBoundaries offers no PER ADM3; INEI/IGN or datosabiertos.gob.pe would supply it). A documented deeper route."),
    list(source_dataset_id = "pe-census-1993-religion-by-department", status = "deferred", url = url_2007, local_path = NULL,
         notes = "1993 is comparable at the national level (Perfil 2007 CUADRO 2.44, population 12+, four categories). A department-level 1993 table at the 12+/four-category universe needs the 1993 tabulados (censos.inei.gob.pe, unreachable) or the 1993 microdata reprocessed. HELD."),
    list(source_dataset_id = "inei-licence-confirmation", status = "not_pinned", url = inei_home_url, local_path = NULL,
         notes = "INEI states no explicit reuse licence on its census results, and the ANDA microdata access policy was unreachable. An INEI reuse-confirmation ask is the clean unblock (PI action); none is held.")),
  privacy = "public", licence_status = "needs_review", licence_basis = licence_basis_slug, downstream_status = "staged",
  source_datasets = source_datasets(),
  notes = "STAGED product (no page, no hub link) pending a PI licence ruling. The committed products are the derived 25-department area summary (50 rows across 2007 and 2017) and the simplified geoBoundaries PER ADM1 boundary dissolved to 25 departments. On-page attribution, when a page is built, must cite the Instituto Nacional de Estadistica e Informatica (INEI) and geoBoundaries (Public Domain, Wikimedia Commons).")

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) stop("manifest JSON is invalid", call. = FALSE)

cat("waves shipped: 2007, 2017 (population 12+) on 25 Peru departments\n")
cat(sprintf("rows: %d (25 departments x 2 waves)\n", length(rows)))
cat(sprintf("gate 2017: passed; margins close to %d\n", national_2017))
cat(sprintf("gate 2007: passed; department Totals sum to %d; category counts derived under a rounding bound\n", national_2007))
cat(sprintf("boundary gate: passed; 25/25 features, %d distinct geometry hashes, %d bytes at %g%% keep\n", length(unique(geom_hashes)), file_bytes(boundary_out), simplification[["keep_percent"]]))
cat("change: affiliation and no-religion comparable across 2007-2017; 1993 HELD (national-only)\n")
cat("licence gate: needs_review; STAGED under build-then-ask; INEI states no explicit reuse grant\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", boundary_out))
cat(sprintf("wrote %s\n", manifest_out))
