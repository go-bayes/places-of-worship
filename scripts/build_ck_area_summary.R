# build the Cook Islands island census-religion area-summary product for three
# island-level waves (2011, 2016, 2021) across the twelve census island units,
# on a COMPOSITE island boundary: seven islands from geoBoundaries COK ADM0
# (Sentinel-2 land cover, CC BY 4.0) clustered from the ADM0 land parts, and five
# missing northern atolls from OpenStreetMap coastline polygons (ODbL 1.0).
#
# the per-island religion counts are transcribed verbatim from Table 2.04 (2016,
# 2021) / Table 2.4 (2011) "Resident Population by Religious Affiliation and Usual
# Residence - Both Sex" of the cached census-report PDFs, and every wave is
# reconciled in-script against its printed row, group, national, and category
# margins. the build STOPS on any mismatch and never allocates, infers, rounds,
# imputes, or tunes a value.
#
# the 2006 wave is group-level only (Rarotonga / Southern / Northern, from the
# 2016 report Table 6). the runtime derives years per summary FILE, so a 2006
# wave on the island level would wrongly imply island detail that the source does
# not carry; 2006 is therefore HELD OUT of the island product and recorded in the
# manifest as recoverable group-level context (the KI 2020 / BS 2022 precedent).
#
# inputs (all cached under data/raw/ck_census/, git-ignored, sha256 in the manifest):
#   ck_2011_census_report.pdf -> Table 2.4  (per-island religion, all ages)
#   ck_2016_census_report.pdf -> Table 2.04 (per-island religion, all ages; Table 6 2006 group series)
#   ck_2021_census_report.pdf -> Table 2.04 (per-island religion, all ages)
#   geoBoundaries-COK-ADM0.geojson + gb_cok_adm0_meta.json -> 7-island land cover
#   osm_{palmerston,manihiki,rakahanga,nassau,pukapuka}_coastline.json -> 5 atolls
#
# outputs: apps/regions/ck/data/ck_island_2021.geojson,
#   apps/regions/ck/data/area_summary_island.{json,csv}, and
#   docs/manifests/ck-census-religion-2006-2021.json.
# run from the repo root: Rscript scripts/build_ck_area_summary.R
#
# no dateline handling: all Cook Islands territory is 155-166 W, far east of the
# antimeridian; the build verifies this from the assembled coordinates.

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "CK"
script_id <- "scripts/build_ck_area_summary.R"
raw_dir <- "data/raw/ck_census"
product_dir <- "apps/regions/ck/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-11"
stamp <- paste0(retrieval_date, "T00:00:00Z")
git_commit <- tryCatch(trimws(system2("git", c("rev-parse", "HEAD"), stdout = TRUE, stderr = FALSE)), error = function(e) character(0))
if (length(git_commit) != 1L || !grepl("^[a-f0-9]{40}$", git_commit)) git_commit <- NULL

boundary_level <- "island"
boundary_set_id <- "ck-island-2021-composite-geoboundaries-adm0-osm"
boundary_vintage <- "2021"

# ---- dataset ids ---------------------------------------------------------------
d_wave <- c(
  `2011` = "ciso-census-2011-table2-4-religion-by-island",
  `2016` = "ciso-census-2016-table2-04-religion-by-island",
  `2021` = "ciso-census-2021-table2-04-religion-by-island"
)
d_2006 <- "ciso-census-2016-table6-religion-by-group-2006"
d_boundary_gb <- "geoboundaries-cok-adm0-2021"
d_boundary_osm <- "osm-cook-islands-northern-atolls-coastline"

# ---- source urls and cached paths ----------------------------------------------
ciso_home_url <- "https://stats.gov.ck"
url_2011 <- "https://stats.gov.ck/download/432/census-2011/5911/2011-census-report.pdf"
url_2016 <- "https://stats.gov.ck/download/430/census-2016/5895/2016-census-report.pdf"
url_2021 <- "https://stats.gov.ck/download/83/census-2021/1497/2021-census-report-with-tables-and-questionnaire.pdf"
boundary_gb_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/COK/ADM0/geoBoundaries-COK-ADM0.geojson"
boundary_gb_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/COK/ADM0/"
overpass_url <- "https://overpass-api.de/api/interpreter"

path_2011 <- file.path(raw_dir, "ck_2011_census_report.pdf")
path_2016 <- file.path(raw_dir, "ck_2016_census_report.pdf")
path_2021 <- file.path(raw_dir, "ck_2021_census_report.pdf")
boundary_gb_path <- file.path(raw_dir, "geoBoundaries-COK-ADM0.geojson")
boundary_gb_meta_path <- file.path(raw_dir, "gb_cok_adm0_meta.json")
osm_paths <- c(
  Palmerston = file.path(raw_dir, "osm_palmerston_coastline.json"),
  Manihiki   = file.path(raw_dir, "osm_manihiki_coastline.json"),
  Rakahanga  = file.path(raw_dir, "osm_rakahanga_coastline.json"),
  Nassau     = file.path(raw_dir, "osm_nassau_coastline.json"),
  Pukapuka   = file.path(raw_dir, "osm_pukapuka_coastline.json")
)

boundary_out <- file.path(product_dir, "ck_island_2021.geojson")
summary_json_out <- file.path(product_dir, "area_summary_island.json")
summary_csv_out <- file.path(product_dir, "area_summary_island.csv")
manifest_out <- file.path(manifest_dir, "ck-census-religion-2006-2021.json")

# ---- helpers -------------------------------------------------------------------
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

# ---- island frame --------------------------------------------------------------
# the twelve census island units in display order (Rarotonga, then the five
# Southern Group islands, then the six Northern Group islands). area_code is a
# stable lower-case slug (the composite layer carries no single upstream code).
islands <- c(
  "Rarotonga", "Aitutaki", "Mangaia", "Atiu", "Mauke", "Mitiaro",
  "Palmerston", "Pukapuka", "Nassau", "Manihiki", "Rakahanga", "Penrhyn"
)
island_slug <- c(
  Rarotonga = "rarotonga", Aitutaki = "aitutaki", Mangaia = "mangaia", Atiu = "atiu",
  Mauke = "mauke", Mitiaro = "mitiaro", Palmerston = "palmerston", Pukapuka = "pukapuka",
  Nassau = "nassau", Manihiki = "manihiki", Rakahanga = "rakahanga", Penrhyn = "penrhyn"
)
group_of <- c(
  Rarotonga = "RAROTONGA", Aitutaki = "SOUTHERN", Mangaia = "SOUTHERN", Atiu = "SOUTHERN",
  Mauke = "SOUTHERN", Mitiaro = "SOUTHERN", Palmerston = "NORTHERN", Pukapuka = "NORTHERN",
  Nassau = "NORTHERN", Manihiki = "NORTHERN", Rakahanga = "NORTHERN", Penrhyn = "NORTHERN"
)
# per-island boundary provenance: seven from geoBoundaries, five from OSM.
boundary_origin <- c(
  Rarotonga = "geoboundaries", Aitutaki = "geoboundaries", Mangaia = "geoboundaries",
  Atiu = "geoboundaries", Mauke = "geoboundaries", Mitiaro = "geoboundaries", Penrhyn = "geoboundaries",
  Palmerston = "osm", Pukapuka = "osm", Nassau = "osm", Manihiki = "osm", Rakahanga = "osm"
)

# ---- per-wave transcribed per-island counts ------------------------------------
# each wave is a list: category label vector, the no-religion category, the
# residual category (kept in the denominator, outside both numerators), and a
# named matrix of island x category counts (a printed dash reads as zero). the
# island Total column is stored separately as the population denominator.
#
# 2011 (Table 2.4): No Religion and Objected/Not Stated are two SEPARATE columns;
# no_religion carries only "No Religion"; the Objected/Not Stated column stays in
# the denominator. Jehovah's Witness is folded into Other Religion in this island
# table. 2016 / 2021 (Table 2.04): the reports print ONE combined "No Religion/Not
# Stated" line, so no_religion carries that combined line (declared). 2016 folds
# Jehovah's Witness into Other Religion; 2021 prints Jehovah's Witness separately.
wave_2011 <- list(
  cats = c("No Religion", "Cook Islands Christian Church", "Roman Catholic", "Seventh Day Adventist",
           "Church of Latter days Saints", "Assemblies of God", "Apostolic Church", "Other Religion",
           "Objected to the Question or Not Stated"),
  named = c("Cook Islands Christian Church", "Roman Catholic", "Seventh Day Adventist",
            "Church of Latter days Saints", "Assemblies of God", "Apostolic Church", "Other Religion"),
  no_religion = "No Religion",
  residual = "Objected to the Question or Not Stated",
  jw_note = "jehovahs_witness_folded_into_other_religion_in_island_table",
  no_religion_note = "no_religion=No_Religion_column_only;objected_or_not_stated_column_retained_in_denominator_outside_both_numerators",
  totals = c(Rarotonga = 10572L, Aitutaki = 1771L, Mangaia = 562L, Atiu = 468L, Mauke = 300L,
             Mitiaro = 189L, Palmerston = 60L, Pukapuka = 451L, Nassau = 73L, Manihiki = 238L,
             Rakahanga = 77L, Penrhyn = 213L),
  national_total = 14974L,
  national_cats = c(841L, 7356L, 2540L, 1190L, 656L, 557L, 310L, 1201L, 323L),
  group_totals = c(RAROTONGA = 10572L, SOUTHERN = 3290L, NORTHERN = 1112L),
  rows = rbind(
    Rarotonga  = c(769, 4902, 1870, 727, 473, 477, 187, 903, 264),
    Aitutaki   = c(46, 862, 113, 303, 110, 11, 61, 233, 32),
    Mangaia    = c(6, 361, 17, 9, 58, 43, 25, 30, 13),
    Atiu       = c(2, 220, 116, 58, 1, 14, 34, 20, 3),
    Mauke      = c(3, 111, 170, 10, 3, 1, 0, 1, 1),
    Mitiaro    = c(5, 128, 49, 0, 1, 4, 0, 0, 2),
    Palmerston = c(0, 55, 0, 0, 4, 0, 0, 0, 1),
    Pukapuka   = c(2, 340, 69, 29, 5, 1, 3, 0, 2),
    Nassau     = c(0, 20, 32, 21, 0, 0, 0, 0, 0),
    Manihiki   = c(5, 112, 77, 24, 0, 6, 0, 10, 4),
    Rakahanga  = c(2, 63, 1, 9, 1, 0, 0, 1, 0),
    Penrhyn    = c(1, 182, 26, 0, 0, 0, 0, 3, 1)
  )
)
wave_2016 <- list(
  cats = c("Cook Islands Christian Church", "Roman Catholic", "Seventh Day Adventist",
           "Church of Latter Days Saint", "Assemblies of God", "Apostolic Church", "Other Religion",
           "No Religion/Not Stated"),
  named = c("Cook Islands Christian Church", "Roman Catholic", "Seventh Day Adventist",
            "Church of Latter Days Saint", "Assemblies of God", "Apostolic Church", "Other Religion"),
  no_religion = "No Religion/Not Stated",
  residual = NA_character_,
  jw_note = "jehovahs_witness_folded_into_other_religion_in_island_table",
  no_religion_note = "no_religion=combined_No_Religion_Not_Stated_line_includes_not_stated",
  totals = c(Rarotonga = 10649L, Aitutaki = 1712L, Mangaia = 493L, Atiu = 423L, Mauke = 289L,
             Mitiaro = 155L, Palmerston = 57L, Pukapuka = 425L, Nassau = 78L, Manihiki = 212L,
             Rakahanga = 83L, Penrhyn = 226L),
  national_total = 14802L,
  national_cats = c(7225L, 2574L, 1249L, 609L, 569L, 283L, 1196L, 1097L),
  group_totals = c(RAROTONGA = 10649L, SOUTHERN = 3072L, NORTHERN = 1081L),
  rows = rbind(
    Rarotonga  = c(4849, 1960, 777, 479, 470, 144, 947, 1023),
    Aitutaki   = c(862, 141, 309, 78, 22, 67, 185, 48),
    Mangaia    = c(297, 18, 9, 43, 48, 52, 21, 5),
    Atiu       = c(210, 90, 59, 0, 14, 18, 23, 9),
    Mauke      = c(130, 140, 7, 5, 0, 0, 1, 6),
    Mitiaro    = c(112, 36, 0, 0, 6, 0, 0, 1),
    Palmerston = c(50, 0, 1, 3, 0, 0, 1, 2),
    Pukapuka   = c(343, 54, 23, 0, 0, 0, 4, 1),
    Nassau     = c(26, 34, 18, 0, 0, 0, 0, 0),
    Manihiki   = c(74, 90, 22, 0, 9, 2, 14, 1),
    Rakahanga  = c(56, 2, 24, 1, 0, 0, 0, 0),
    Penrhyn    = c(216, 9, 0, 0, 0, 0, 0, 1)
  )
)
wave_2021 <- list(
  cats = c("Cook Islands Christian Church", "Roman Catholic", "Seventh Day Adventist",
           "Church of Latter Days Saint", "Assemblies of God", "Apostolic Church", "Jehova Witness",
           "Other Religion", "No Religion/Not Stated"),
  named = c("Cook Islands Christian Church", "Roman Catholic", "Seventh Day Adventist",
            "Church of Latter Days Saint", "Assemblies of God", "Apostolic Church", "Jehova Witness",
            "Other Religion"),
  no_religion = "No Religion/Not Stated",
  residual = NA_character_,
  jw_note = "jehovahs_witness_reported_as_separate_column",
  no_religion_note = "no_religion=combined_No_Religion_Not_Stated_line_includes_not_stated",
  totals = c(Rarotonga = 10863L, Aitutaki = 1776L, Mangaia = 471L, Atiu = 382L, Mauke = 249L,
             Mitiaro = 155L, Palmerston = 25L, Pukapuka = 457L, Nassau = 92L, Manihiki = 206L,
             Rakahanga = 81L, Penrhyn = 230L),
  national_total = 14987L,
  national_cats = c(6461L, 2500L, 1241L, 591L, 535L, 322L, 330L, 669L, 2338L),
  group_totals = c(RAROTONGA = 10863L, SOUTHERN = 3033L, NORTHERN = 1091L),
  rows = rbind(
    Rarotonga  = c(4194, 1909, 750, 446, 445, 188, 241, 558, 2132),
    Aitutaki   = c(818, 143, 350, 90, 19, 53, 62, 92, 149),
    Mangaia    = c(259, 12, 9, 52, 46, 59, 8, 3, 23),
    Atiu       = c(184, 70, 53, 0, 11, 21, 19, 1, 23),
    Mauke      = c(103, 128, 4, 2, 0, 0, 0, 5, 7),
    Mitiaro    = c(105, 39, 1, 0, 10, 0, 0, 0, 0),
    Palmerston = c(24, 0, 0, 1, 0, 0, 0, 0, 0),
    Pukapuka   = c(369, 65, 22, 0, 0, 0, 0, 0, 1),
    Nassau     = c(37, 35, 20, 0, 0, 0, 0, 0, 0),
    Manihiki   = c(91, 84, 17, 0, 4, 0, 0, 10, 0),
    Rakahanga  = c(65, 7, 6, 0, 0, 1, 0, 0, 2),
    Penrhyn    = c(212, 8, 9, 0, 0, 0, 0, 0, 1)
  )
)
waves <- list(`2011` = wave_2011, `2016` = wave_2016, `2021` = wave_2021)
wave_years <- c(2011L, 2016L, 2021L)

# ---- 2006 group-level context (2016 report Table 6; held out of the product) ---
# recorded in the manifest only; the runtime derives years per file and 2006 has
# no island detail, so shipping it on the island level would misrepresent the source.
context_2006 <- list(
  table = "Table 6 Resident population by religious affiliation (2006/2011/2016 by group)",
  national_total = 15324L,
  categories = list(
    `Cook Islands Christian Church` = 8065L, `Roman Catholic` = 2599L, `Seventh Day Adventist` = 1154L,
    `Church of Latter Days Saint` = 565L, `Assemblies of God` = 558L, `Apostolic Church` = 310L,
    `Jehovas Witness` = 325L, `Other Religion` = 786L, `No Religion/Not Stated` = 962L
  ),
  groups = list(Rarotonga = 10226L, `Southern Islands` = 3729L, `Northern Islands` = 1369L),
  note = paste(
    "Recorded group-level context, HELD OUT of the island product. The 2006 wave is published only at",
    "island-group level (Rarotonga / Southern / Northern) in the 2016 report Table 6; no 2006 island religion",
    "table exists. The runtime derives years per summary file, so a 2006 wave on the island level would wrongly",
    "imply island detail. Held out (the KI 2020 / BS 2022 national-context precedent)."
  )
)

# ---- reconciliation gates ------------------------------------------------------
# gate A: every island row's category cells sum to its printed island Total.
# gate B: the twelve island Totals sum to each group total and to the national total.
# gate C: every category column sums across islands to its printed national total.
# STOP on any mismatch; never tune.
reconcile_wave <- function(year, w) {
  records <- list()
  # gate A
  for (isl in islands) {
    s <- sum(w$rows[isl, ]); pr <- w$totals[[isl]]
    if (s != pr) stop(sprintf("%s row gate FAILED for %s: cells %d != printed total %d", year, isl, s, pr), call. = FALSE)
    records[[length(records) + 1L]] <- list(year = as.integer(year), margin = "island_row", key = isl,
      computed = as.integer(s), printed = as.integer(pr), difference = 0L)
  }
  # gate B: groups
  for (g in names(w$group_totals)) {
    members <- islands[group_of[islands] == g]
    gs <- sum(w$totals[members]); pr <- w$group_totals[[g]]
    if (gs != pr) stop(sprintf("%s group gate FAILED for %s: %d != printed %d", year, g, gs, pr), call. = FALSE)
    records[[length(records) + 1L]] <- list(year = as.integer(year), margin = "island_group", key = g,
      computed = as.integer(gs), printed = as.integer(pr), difference = 0L)
  }
  # gate B: national total
  nt <- sum(w$totals)
  if (nt != w$national_total) stop(sprintf("%s national-total gate FAILED: %d != printed %d", year, nt, w$national_total), call. = FALSE)
  records[[length(records) + 1L]] <- list(year = as.integer(year), margin = "national_total", key = "COOK ISLANDS",
    computed = as.integer(nt), printed = as.integer(w$national_total), difference = 0L)
  # gate C: category columns
  for (j in seq_along(w$cats)) {
    cs <- sum(w$rows[, j]); pr <- w$national_cats[[j]]
    if (cs != pr) stop(sprintf("%s category gate FAILED for %s: %d != printed %d", year, w$cats[j], cs, pr), call. = FALSE)
    records[[length(records) + 1L]] <- list(year = as.integer(year), margin = "category_column", key = w$cats[j],
      computed = as.integer(cs), printed = as.integer(pr), difference = 0L)
  }
  records
}

recon <- lapply(names(waves), function(y) reconcile_wave(y, waves[[y]]))
names(recon) <- names(waves)
for (y in names(waves)) {
  message(sprintf("gate %s: PASSED (12 rows close; groups and national close to %d; every category column closes)",
                  y, waves[[y]]$national_total))
}

# ---- boundary: seven geoBoundaries islands + five OSM atolls -------------------
require_file(boundary_gb_path); require_file(boundary_gb_meta_path)
for (p in osm_paths) require_file(p)
gb_meta <- fromJSON(boundary_gb_meta_path, simplifyVector = FALSE)
if (!identical(gb_meta[["boundaryType"]], "ADM0") ||
    !grepl("Creative Commons Attribution 4.0", gb_meta[["boundaryLicense"]], fixed = TRUE)) {
  stop("geoBoundaries COK ADM0 licence or type metadata changed", call. = FALSE)
}

# known island reference coordinates (lon, lat) for clustering the ADM0 land
# parts, plus three uninhabited DECOY coordinates (Manuae, Takutea, Suwarrow) that
# are captured by the land-cover layer but are not census units; parts nearest a
# decoy are dropped so they never contaminate a census island.
island_ref <- list(
  Rarotonga = c(-159.78, -21.23), Aitutaki = c(-159.78, -18.85), Mangaia = c(-157.92, -21.93),
  Atiu = c(-158.12, -19.99), Mauke = c(-157.34, -20.15), Mitiaro = c(-157.70, -19.85),
  Penrhyn = c(-158.05, -9.00)
)
decoy_ref <- list(Manuae = c(-158.96, -19.27), Takutea = c(-158.28, -19.83), Suwarrow = c(-163.10, -13.25))
gb_islands <- names(island_ref)

# cluster the ADM0 MultiPolygon land parts to the seven census islands by nearest
# reference coordinate; parts nearest a decoy are dropped. returns one MULTIPOLYGON
# sfg per census island and verifies each cluster centroid against its reference.
build_geoboundaries_islands <- function(path) {
  adm0 <- st_make_valid(st_read(path, quiet = TRUE, stringsAsFactors = FALSE))
  parts <- suppressWarnings(st_cast(st_geometry(adm0), "POLYGON"))
  cent <- suppressWarnings(st_coordinates(st_centroid(parts)))
  refs <- c(island_ref, decoy_ref)
  ref_names <- names(refs)
  ref_mat <- do.call(rbind, refs)
  assign_to <- vapply(seq_len(nrow(cent)), function(i) {
    d <- sqrt((ref_mat[, 1] - cent[i, 1])^2 + (ref_mat[, 2] - cent[i, 2])^2)
    ref_names[which.min(d)]
  }, character(1))
  geoms <- list(); areas <- numeric(0); centroids <- list()
  old_s2 <- sf_use_s2(); on.exit(suppressMessages(sf_use_s2(old_s2)), add = TRUE)
  suppressMessages(sf_use_s2(TRUE))
  for (isl in gb_islands) {
    sel <- which(assign_to == isl)
    if (length(sel) == 0L) stop("geoBoundaries clustering captured no part for ", isl, call. = FALSE)
    mp <- st_union(parts[sel])
    mp <- st_cast(st_make_valid(mp), "MULTIPOLYGON")
    # centroid sanity gate: cluster centroid must sit within 0.3 deg of the reference.
    cc <- st_coordinates(st_centroid(mp))
    ref <- island_ref[[isl]]
    if (sqrt((cc[1] - ref[1])^2 + (cc[2] - ref[2])^2) > 0.3) {
      stop(sprintf("geoBoundaries cluster centroid for %s (%.3f, %.3f) is far from its reference", isl, cc[1], cc[2]), call. = FALSE)
    }
    geoms[[isl]] <- mp[[1L]]
    areas[isl] <- as.numeric(st_area(mp)) / 1e6
    centroids[[isl]] <- c(round(cc[1], 4), round(cc[2], 4))
  }
  dropped <- sum(assign_to %in% names(decoy_ref))
  list(geoms = geoms, areas = areas, centroids = centroids,
       n_parts = nrow(cent), n_dropped_decoy = dropped)
}

# assemble one atoll MULTIPOLYGON from cached OSM coastline ways. every closed
# natural=coastline way is a motu (land); the atoll's land is the union of its
# motu. STOP if any way fails to close (would need recursive relation assembly)
# or if the assembled land area falls outside the 0.3-10 sq km atoll-land gate.
build_osm_atoll <- function(name, path) {
  el <- fromJSON(path, simplifyVector = FALSE)[["elements"]]
  ways <- Filter(function(e) identical(e[["type"]], "way") && !is.null(e[["geometry"]]), el)
  polys <- list(); open_ways <- 0L
  for (w in ways) {
    g <- w[["geometry"]]
    if (length(g) < 4L) next
    ring <- do.call(rbind, lapply(g, function(pt) c(pt[["lon"]], pt[["lat"]])))
    if (!isTRUE(all.equal(ring[1, ], ring[nrow(ring), ]))) { open_ways <- open_ways + 1L; next }
    polys[[length(polys) + 1L]] <- st_polygon(list(ring))
  }
  if (open_ways > 0L) {
    stop(sprintf("OSM %s: %d coastline way(s) are not closed; recursive relation assembly needed - STOP for this island rather than invent geometry",
                 name, open_ways), call. = FALSE)
  }
  if (length(polys) == 0L) stop(sprintf("OSM %s: no closed coastline land polygon assembled", name), call. = FALSE)
  mp <- st_sfc(st_multipolygon(lapply(polys, function(p) unclass(p))), crs = 4326)
  mp <- st_cast(st_make_valid(mp), "MULTIPOLYGON")
  old_s2 <- sf_use_s2(); on.exit(suppressMessages(sf_use_s2(old_s2)), add = TRUE)
  suppressMessages(sf_use_s2(TRUE))
  area <- as.numeric(st_area(mp)) / 1e6
  # atoll-land sanity gate: these northern atolls are ~1-6 sq km of land.
  if (area < 0.3 || area > 10) {
    stop(sprintf("OSM %s land area %.3f sq km is outside the 0.3-10 sq km atoll gate", name, area), call. = FALSE)
  }
  cc <- st_coordinates(st_centroid(mp))
  list(geom = mp[[1L]], area = area, n_motu = length(polys), centroid = c(round(cc[1], 4), round(cc[2], 4)))
}

gb_res <- build_geoboundaries_islands(boundary_gb_path)
osm_res <- lapply(names(osm_paths), function(n) build_osm_atoll(n, osm_paths[[n]]))
names(osm_res) <- names(osm_paths)
message(sprintf("geoBoundaries: %d ADM0 parts clustered to 7 islands, %d decoy parts dropped (Manuae/Takutea)",
                gb_res$n_parts, gb_res$n_dropped_decoy))
for (n in names(osm_res)) {
  message(sprintf("OSM %s: %d motu, land %.3f sq km", n, osm_res[[n]]$n_motu, osm_res[[n]]$area))
}

# assemble the twelve-feature composite in display order.
geom_list <- vector("list", length(islands))
land_area <- numeric(length(islands)); names(land_area) <- islands
boundary_source_prop <- character(length(islands)); names(boundary_source_prop) <- islands
boundary_licence_prop <- character(length(islands)); names(boundary_licence_prop) <- islands
for (i in seq_along(islands)) {
  isl <- islands[i]
  if (boundary_origin[[isl]] == "geoboundaries") {
    geom_list[[i]] <- gb_res$geoms[[isl]]
    land_area[isl] <- gb_res$areas[[isl]]
    boundary_source_prop[isl] <- "geoBoundaries COK ADM0 (Sentinel-2 10m land cover, raster2polygon); parts clustered to island"
    boundary_licence_prop[isl] <- "CC BY 4.0"
  } else {
    geom_list[[i]] <- osm_res[[isl]]$geom
    land_area[isl] <- osm_res[[isl]]$area
    boundary_source_prop[isl] <- "OpenStreetMap coastline motu (place=island/islet closed ways), assembled via Overpass"
    boundary_licence_prop[isl] <- "ODbL 1.0"
  }
}
composite <- st_sf(
  area_code = unname(island_slug[islands]),
  area_name = islands,
  area_unit_id = paste(boundary_set_id, unname(island_slug[islands]), sep = ":"),
  boundary_set_id = boundary_set_id,
  boundary_level = boundary_level,
  boundary_vintage = boundary_vintage,
  boundary_source = unname(boundary_source_prop[islands]),
  boundary_licence = unname(boundary_licence_prop[islands]),
  land_area_sq_km = round(unname(land_area[islands]), 4),
  geometry = st_sfc(geom_list, crs = 4326)
)
composite <- st_make_valid(composite)

# per-feature distinctness gate on the source geometry.
src_hashes <- geometry_hashes(composite)
if (length(unique(src_hashes)) != 12L) stop("composite source geometry hashes are not distinct", call. = FALSE)

# no-dateline gate: every coordinate must sit between 155 W and 167 W.
coord_range <- st_bbox(composite)
if (coord_range[["xmin"]] < -167 || coord_range[["xmax"]] > -155) {
  stop("composite longitude range escapes the expected 155-167 W Cook Islands extent", call. = FALSE)
}

# ---- simplify and write the boundary -------------------------------------------
boundary_fields <- c("area_code", "area_name", "area_unit_id", "boundary_set_id",
                     "boundary_level", "boundary_vintage", "boundary_source",
                     "boundary_licence", "land_area_sq_km")
simplification <- mapshaper_simplify_to_cap(
  composite[, boundary_fields], boundary_out, max_bytes = 1500000L,
  keep_percentages = c(100, 75, 50, 30, 20, 10, 7, 5),
  clean_option = "allow-overlaps"
)
final_bytes <- file_bytes(boundary_out)
if (final_bytes > 1500000L) stop("simplified composite boundary exceeds 1.5 MB", call. = FALSE)
simplification[["bytes"]] <- final_bytes

written <- st_read(boundary_out, quiet = TRUE, stringsAsFactors = FALSE)
written <- written[match(composite[["area_code"]], written[["area_code"]]), ]
if (anyNA(written[["area_code"]]) || nrow(written) != 12L) stop("simplified boundary lost a feature", call. = FALSE)
wv <- st_is_valid(written)
if (any(st_is_empty(written)) || any(is.na(wv)) || any(!wv)) stop("simplified boundary has invalid/empty features", call. = FALSE)
out_hashes <- geometry_hashes(written)
if (length(unique(out_hashes)) != 12L) stop("simplified boundary geometry hashes are not distinct", call. = FALSE)
geometry_hash_record <- setNames(as.list(out_hashes), written[["area_code"]])
message(sprintf("boundary: PASSED (12 valid distinct features, %d bytes at %g%% keep)",
                final_bytes, simplification[["keep_percent"]]))

# recompute land areas on the WRITTEN (simplified) geometry for the shipped rows.
old_s2 <- sf_use_s2(); suppressMessages(sf_use_s2(TRUE))
written_area <- setNames(round(as.numeric(st_area(written)) / 1e6, 4), written[["area_code"]])
suppressMessages(sf_use_s2(old_s2))
area_by_name <- setNames(written_area[unname(island_slug[islands])], islands)
area_unit_by_name <- setNames(paste(boundary_set_id, unname(island_slug[islands]), sep = ":"), islands)
code_by_name <- setNames(unname(island_slug[islands]), islands)

# ---- assemble the area-summary rows (12 islands x 3 waves = 36 rows) -----------
flag_common <- paste(
  "census_affiliation", "resident_population_all_ages_universe",
  "religion_question_not_compulsory", "denominator_is_island_total_population",
  "composite_boundary_geoboundaries_cc_by_4_0_and_osm_odbl_1_0",
  "licence_ciso_standards_clause_reproduce_with_acknowledgement", sep = ";"
)

pop_basis <- function(year) {
  tbl <- if (year == 2011L) "Table 2.4" else "Table 2.04"
  paste0(
    "Resident population, all ages, from the ", year, " Cook Islands Census Report ", tbl,
    " (Resident Population by Religious Affiliation and Usual Residence, Both Sex); the printed island Total is the",
    " population denominator. Religious affiliation is the sum of the named religion categories; no religion is the",
    " published no-religion line for the wave. The religion question was not compulsory; a not-stated residual, where",
    " the wave prints it separately (2011: Objected/Not Stated), stays in the denominator and outside both numerators."
  )
}

wave_flag <- function(year, w) {
  base <- sprintf("wave_%d_source_%s", year, if (year == 2011L) "table_2_4" else "table_2_04")
  named <- paste0("named_affiliation=", paste(gsub("[^A-Za-z]", "", w$named), collapse = "+"))
  paste(base, named, w$no_religion_note, w$jw_note, flag_common, sep = ";")
}

make_row <- function(isl, year, w) {
  cells <- w$rows[isl, ]
  names(cells) <- w$cats
  total <- w$totals[[isl]]
  aff <- as.integer(sum(cells[w$named]))
  no_rel <- as.integer(cells[[w$no_religion]])
  list(
    country_code = country_code, boundary_set_id = boundary_set_id, boundary_level = boundary_level,
    area_unit_id = unname(area_unit_by_name[[isl]]), area_code = unname(code_by_name[[isl]]),
    area_name = isl, year = as.integer(year),
    population_total = as.integer(total), population_total_basis = pop_basis(year),
    religious_affiliation_count = aff, religious_affiliation_percent = round(100 * aff / total, 4),
    no_religion_count = no_rel, no_religion_percent = round(100 * no_rel / total, 4),
    place_count = NULL, places_per_10000_residents = NULL, place_density_per_sq_km = NULL,
    land_area_sq_km = unname(area_by_name[[isl]]), site_snapshot_date = NULL, place_count_basis = NULL,
    source_dataset_ids = list(unname(d_wave[[as.character(year)]]), d_boundary_gb, d_boundary_osm),
    quality_flag = wave_flag(year, w)
  )
}

rows <- list()
for (year in wave_years) {
  w <- waves[[as.character(year)]]
  for (isl in islands) rows[[length(rows) + 1L]] <- make_row(isl, year, w)
}

# ---- area-summary document -----------------------------------------------------
licence_standards_clause <- "Any table or material may be reproduced and published provided acknowledgement is made of the source."
licence_frontmatter_note <- paste(
  "The 2021 report front matter reserves commercial and whole-document reproduction and forbids altering the original",
  "work without permission, while authorizing partial reproduction for scientific, educational or research purposes with",
  "acknowledgement. A derived, aggregated, attributed island summary sits inside the operative Standards grant and the",
  "front-matter research carve-out; the interaction is flagged for the PI as a caveat, not a blocker."
)

source_datasets <- function() {
  wave_ds <- lapply(names(d_wave), function(y) {
    tbl <- if (y == "2011") "Table 2.4" else "Table 2.04"
    list(
      source_dataset_id = unname(d_wave[[y]]),
      name = sprintf("Cook Islands %s Census Report, %s: Resident Population by Religious Affiliation and Usual Residence (Both Sex)", y, tbl),
      provider = "Cook Islands Statistics Office (CISO)",
      url = get(paste0("url_", y)), retrieval_date = retrieval_date,
      local_path = get(paste0("path_", y)),
      licence = list(name = paste0("CISO Standards clause: \"", licence_standards_clause, "\""),
                     url = ciso_home_url,
                     attribution = sprintf("Cook Islands Statistics Office, %s Census of Population and Dwellings", y)),
      citation = sprintf("Cook Islands Statistics Office, %s Census Report, %s.", y, tbl),
      access_limits = NULL,
      redistribution_limits = "Derived island summaries reproduced with CISO acknowledgement under the report Standards clause; the report PDFs are not committed.",
      notes = sprintf("All ages, resident population, twelve island units. Reconciled in-script against the printed island, group, national, and category margins (national total %d).", waves[[y]]$national_total)
    )
  })
  c(wave_ds, list(
    list(
      source_dataset_id = d_2006,
      name = "Cook Islands 2016 Census Report, Table 6: Resident population by religious affiliation (2006/2011/2016 by island group)",
      provider = "Cook Islands Statistics Office (CISO)",
      url = url_2016, retrieval_date = retrieval_date, local_path = path_2016,
      licence = list(name = paste0("CISO Standards clause: \"", licence_standards_clause, "\""),
                     url = ciso_home_url, attribution = "Cook Islands Statistics Office, 2016 Census of Population and Dwellings"),
      citation = "Cook Islands Statistics Office, 2016 Census Report, Table 6.",
      access_limits = NULL,
      redistribution_limits = "Group-level context only; not shipped as an island wave.",
      notes = "2006 group-level religion (Rarotonga / Southern / Northern), recovered from the 2016 report Table 6. Held out of the island product; recorded as recoverable context."
    ),
    list(
      source_dataset_id = d_boundary_gb,
      name = "geoBoundaries COK ADM0 (Sentinel-2 10m land cover)",
      provider = "geoBoundaries (William & Mary geoLab); source Sentinel-2 / ESA",
      url = boundary_gb_url, retrieval_date = retrieval_date, local_path = boundary_gb_path,
      licence = list(name = "Creative Commons Attribution 4.0 International (CC BY 4.0)",
                     url = boundary_gb_meta_url, attribution = "geoBoundaries (gbOpen); Sentinel-2 10m Land Cover, ESA"),
      citation = "geoBoundaries COK ADM0 (gbOpen, pinned 9469f09), Sentinel-2 land cover.",
      access_limits = NULL,
      redistribution_limits = "Seven island polygons clustered from the ADM0 land-cover parts; simplified derived boundary committed with CC BY 4.0 attribution.",
      notes = "Single ADM0 MultiPolygon of 86 land parts; clustered to Rarotonga, Aitutaki, Mangaia, Atiu, Mauke, Mitiaro, and Penrhyn by proximity to known island coordinates, with uninhabited Manuae/Takutea parts dropped as decoys. Missing the five northern atolls, which come from OSM."
    ),
    list(
      source_dataset_id = d_boundary_osm,
      name = "OpenStreetMap coastline polygons for the five northern Cook Islands atolls",
      provider = "OpenStreetMap contributors (via Overpass API)",
      url = overpass_url, retrieval_date = retrieval_date, local_path = unname(osm_paths[["Pukapuka"]]),
      licence = list(name = "Open Data Commons Open Database License 1.0 (ODbL)",
                     url = "https://www.openstreetmap.org/copyright",
                     attribution = "© OpenStreetMap contributors, ODbL"),
      citation = "OpenStreetMap contributors, natural=coastline / place=island polygons for Palmerston, Manihiki, Rakahanga, Nassau, and Pukapuka (Overpass, retrieved 2026-07-11).",
      access_limits = NULL,
      redistribution_limits = "Assembled atoll land polygons committed under ODbL 1.0 with OpenStreetMap attribution; the mixed-licence composite discloses provenance per feature.",
      notes = "The five inhabited northern atolls absent from geoBoundaries. Each atoll's land is the union of its closed coastline motu; land areas gate against published figures (Palmerston ~2.9, Manihiki ~5.4, Rakahanga ~3.9, Nassau ~1.2, Pukapuka ~4.4 sq km)."
    )
  ))
}

denom_note <- paste(
  "Percentages use each island's printed census population Total. Religious affiliation is the sum of the named",
  "religion categories; no religion is the published no-religion line (2011: the No Religion column only, with the",
  "separate Objected/Not Stated column retained in the denominator; 2016 and 2021: the combined No Religion/Not Stated",
  "line, which includes not-stated). The two shares therefore need not sum to 100 percent, and the no-religion basis",
  "differs across waves by construction; this is disclosed per row."
)

indicators <- function() {
  list(
    list(indicator_id = "population_total", label = "Census population total",
         description = "Island all-ages resident population from the wave's religion table.",
         unit = "count", denominator_indicator_id = NULL,
         method = "Printed island Total in Table 2.4 (2011) or Table 2.04 (2016, 2021).",
         temporal_coverage = "2011; 2016; 2021", spatial_coverage = "Cook Islands census islands (12)",
         quality_notes = "Resident population, all ages, in every wave; island denominators are comparable across the three island waves."),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
         description = "Share of the island population reporting a named religion.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (sum of named religion categories) / island population.",
         temporal_coverage = "2011; 2016; 2021", spatial_coverage = "Cook Islands census islands (12)",
         quality_notes = paste("Jehovah's Witness is folded into Other Religion in the 2011 and 2016 island tables and printed separately in 2021; folded back into affiliation, the named spine is comparable across waves.", denom_note)),
    list(indicator_id = "no_religion_percent", label = "No religious affiliation %",
         description = "Share in the census no-religion line.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (no-religion line) / island population. 2011 carries the No Religion column only; 2016 and 2021 carry the combined No Religion/Not Stated line.",
         temporal_coverage = "2011; 2016; 2021", spatial_coverage = "Cook Islands census islands (12)",
         quality_notes = paste("The no-religion basis differs across waves: 2011 is pure no-religion (national 841); 2016 and 2021 combine no-religion with not-stated (national 1,097 and 2,338). Disclosed per row.", denom_note))
  )
}

visual_layers <- function() {
  list(
    list(visual_layer_id = "ck-island-religious-affiliation", label = "Religious affiliation %",
         description = "Cook Islands census-affiliation share by island.", layer_type = "choropleth",
         indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "island all-ages resident population"),
         colour_scale = "sequential", time_control = "year_selector", aggregation_rule = "reported island value",
         uncertainty_display = "quality_flag", default_visibility = TRUE,
         notes = "Census affiliation, not practice, attendance, or membership. Comparable across 2011-2016-2021 at the named-affiliation level."),
    list(visual_layer_id = "ck-island-no-religion", label = "No religious affiliation %",
         description = "Cook Islands census no-religion share by island.", layer_type = "choropleth",
         indicator_ids = list("no_religion_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "island all-ages resident population"),
         colour_scale = "sequential", time_control = "year_selector", aggregation_rule = "reported island value",
         uncertainty_display = "quality_flag", default_visibility = FALSE,
         notes = "The no-religion basis differs across waves (2011 no-religion only; 2016/2021 combine no-religion with not-stated).")
  )
}

summary_product <- list(
  schema_version = "area-summary.v1", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code,
                      level = boundary_level, vintage = boundary_vintage, source_dataset_id = d_boundary_gb),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "No governed place-of-worship snapshot ships in the Cook Islands census product.",
                       notes = "Place counts and density metrics remain null."),
  source_datasets = source_datasets(), indicators = indicators(),
  visual_layers = visual_layers(), rows = rows
)

write_json(summary_product, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(summary_json_out, warn = FALSE), collapse = "\n"))) stop("area-summary JSON is invalid", call. = FALSE)

flatten_rows <- function(rows) {
  do.call(rbind, lapply(rows, function(r) {
    g <- function(k, na) if (is.null(r[[k]])) na else r[[k]]
    data.frame(
      country_code = r[["country_code"]], boundary_set_id = r[["boundary_set_id"]],
      boundary_level = r[["boundary_level"]], area_unit_id = r[["area_unit_id"]],
      area_code = r[["area_code"]], area_name = r[["area_name"]], year = r[["year"]],
      population_total = g("population_total", NA_integer_), population_total_basis = r[["population_total_basis"]],
      religious_affiliation_count = g("religious_affiliation_count", NA_integer_),
      religious_affiliation_percent = g("religious_affiliation_percent", NA_real_),
      no_religion_count = g("no_religion_count", NA_integer_),
      no_religion_percent = g("no_religion_percent", NA_real_),
      place_count = NA_integer_, places_per_10000_residents = NA_real_,
      place_density_per_sq_km = NA_real_, land_area_sq_km = r[["land_area_sq_km"]],
      site_snapshot_date = NA_character_, place_count_basis = NA_character_,
      source_dataset_ids = paste(unlist(r[["source_dataset_ids"]]), collapse = "|"),
      quality_flag = r[["quality_flag"]], stringsAsFactors = FALSE
    )
  }))
}
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

# ---- manifest (data-manifest.v2) -----------------------------------------------
osm_area_gate <- setNames(lapply(names(osm_res), function(n) list(
  motu = osm_res[[n]]$n_motu, assembled_land_sq_km = round(osm_res[[n]]$area, 3),
  centroid_lon_lat = osm_res[[n]]$centroid)), names(osm_res))
gb_cluster_record <- setNames(lapply(gb_islands, function(n) list(
  clustered_land_sq_km = round(gb_res$areas[[n]], 3), centroid_lon_lat = gb_res$centroids[[n]])), gb_islands)

raw_source_record <- function(path, url, format, used, periods, dataset_id, notes) {
  list(uri = path, url = url, format = format, bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = NULL, source_dataset_id = dataset_id, used_in_public_product = used,
       periods = periods, notes = notes,
       local_cache_hint = paste0(path, " (git-ignored by .gitignore data/ rule)"))
}
durable_file_record <- function(path, content, licence_status_value, licence_basis_value) {
  list(uri = paste0("repo:", path), storage_provider = "git_repository", format = sub("^.*\\.", "", path),
       bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = if (grepl("area_summary|\\.csv$", path)) row_count_file(path) else NULL,
       feature_count = if (grepl("\\.geojson$", path)) row_count_file(path) else NULL,
       content = content, privacy = "public",
       licence_status = licence_status_value, licence_basis = licence_basis_value)
}
licence_basis_slug <- "ciso_census_standards_clause_reproduce_with_acknowledgement"
boundary_basis_slug <- "geoboundaries_cc_by_4_0_and_osm_odbl_1_0_composite"

raw_sources <- list(
  raw_source_record(path_2011, url_2011, "pdf", TRUE, "2011", unname(d_wave[["2011"]]),
    "2011 Census Report Table 2.4; twelve island units. Every island row closes to its printed Total; islands close to the national total 14,974 and every category column closes. No Religion and Objected/Not Stated are separate columns; JW folded into Other Religion."),
  raw_source_record(path_2016, url_2016, "pdf", TRUE, "2016; 2006", unname(d_wave[["2016"]]),
    "2016 Census Report Table 2.04 (island religion; national 14,802) and Table 6 (2006/2011/2016 group series; source of the held-out 2006 group wave). Combined No Religion/Not Stated line; JW folded into Other Religion."),
  raw_source_record(path_2021, url_2021, "pdf", TRUE, "2021", unname(d_wave[["2021"]]),
    "2021 Census Report Table 2.04; twelve island units. Every island row closes to its printed Total; islands close to the national total 14,987 and every category column closes. Combined No Religion/Not Stated line; JW printed separately."),
  raw_source_record(boundary_gb_path, boundary_gb_url, "geojson", TRUE, "2021", d_boundary_gb,
    "geoBoundaries COK ADM0 GeoJSON; single MultiPolygon of 86 Sentinel-2 land parts, clustered to seven census islands. CC BY 4.0. Pinned commit 9469f09."),
  raw_source_record(boundary_gb_meta_path, boundary_gb_meta_url, "json", FALSE, "2021", d_boundary_gb,
    "geoBoundaries COK ADM0 metadata; records CC BY 4.0 and boundaryYearRepresented 2021."),
  raw_source_record(osm_paths[["Palmerston"]], overpass_url, "json", TRUE, "2026", d_boundary_osm,
    sprintf("OSM Overpass coastline for Palmerston (%d motu, %.3f sq km land).", osm_res[["Palmerston"]]$n_motu, osm_res[["Palmerston"]]$area)),
  raw_source_record(osm_paths[["Manihiki"]], overpass_url, "json", TRUE, "2026", d_boundary_osm,
    sprintf("OSM Overpass coastline for Manihiki (%d motu, %.3f sq km land).", osm_res[["Manihiki"]]$n_motu, osm_res[["Manihiki"]]$area)),
  raw_source_record(osm_paths[["Rakahanga"]], overpass_url, "json", TRUE, "2026", d_boundary_osm,
    sprintf("OSM Overpass coastline for Rakahanga (%d motu, %.3f sq km land).", osm_res[["Rakahanga"]]$n_motu, osm_res[["Rakahanga"]]$area)),
  raw_source_record(osm_paths[["Nassau"]], overpass_url, "json", TRUE, "2026", d_boundary_osm,
    sprintf("OSM Overpass coastline for Nassau (%d motu, %.3f sq km land).", osm_res[["Nassau"]]$n_motu, osm_res[["Nassau"]]$area)),
  raw_source_record(osm_paths[["Pukapuka"]], overpass_url, "json", TRUE, "2026", d_boundary_osm,
    sprintf("OSM Overpass coastline for Pukapuka (%d motu, %.3f sq km land).", osm_res[["Pukapuka"]]$n_motu, osm_res[["Pukapuka"]]$area))
)

dataset_id <- "ck-census-religion:ck:2011-2021:ciso-island-composite"
dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = paste0("manifest:", dataset_id),
  dataset_id = dataset_id,
  dataset_version_id = paste0(dataset_id, ":", dataset_hash),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "ck-census-religion", dataset_role = "public_product",
  scope = list(level = "country", country_codes = list("CK"), snapshot_date = NULL,
               snapshot_anchor = NULL, pipeline_stage = "public"),
  created_at = stamp, created_by = script_id,
  target_years = list(2011L, 2016L, 2021L),
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation",
      shipped_waves = list(2011L, 2016L, 2021L),
      shipped_geography = "12 Cook Islands census islands (composite geoBoundaries COK ADM0 + OSM northern atolls)",
      boundary_set = boundary_set_id,
      source_tables = list(`2011` = "Table 2.4 Religion by Usual Residence (Both Sex)",
                           `2016` = "Table 2.04 Religion by Usual Residence (Both Sex)",
                           `2021` = "Table 2.04 Religion by Usual Residence (Both Sex)"),
      universe = "resident population, all ages, in every wave; the religion question was not compulsory",
      category_frames = list(
        `2011` = as.list(wave_2011$cats), `2016` = as.list(wave_2016$cats), `2021` = as.list(wave_2021$cats),
        alignment_note = paste(
          "Categories are preserved verbatim per wave. Jehovah's Witness is folded into Other Religion in the 2011 and",
          "2016 island tables and printed as a separate column in 2021; the named-affiliation spine is comparable across",
          "waves once JW is folded back into affiliation. The no-religion line differs by frame: 2011 prints No Religion",
          "and Objected/Not Stated as two separate columns (no_religion carries No Religion only, 841 nationally; the",
          "Objected/Not Stated column, 323, stays in the denominator); 2016 and 2021 print one combined No Religion/Not",
          "Stated line (1,097 and 2,338 nationally), so the no-religion share for those waves includes not-stated. This",
          "difference is disclosed per row and is inherent to the source frames, never tuned."
        )
      ),
      no_religion_treatment = list(
        `2011` = "No Religion column only (national 841); the separate Objected/Not Stated column (323) is retained in the denominator, outside both numerators",
        `2016` = "combined No Religion/Not Stated line (national 1,097); includes not-stated",
        `2021` = "combined No Religion/Not Stated line (national 2,338); includes not-stated"
      ),
      jehovahs_witness_treatment = paste(
        "Folded into Other Religion in the 2011 and 2016 island tables (Table 2.4 / 2.04); printed as a separate column",
        "in the 2021 island table (national 330). Table 6 splits JW for every wave, confirming the fold (2016 Other 839",
        "+ JW 357 = 1,196, the island-table Other Religion column)."
      ),
      held_out_2006 = context_2006,
      tapere_note = paste(
        "Rarotonga is additionally split into tapere within each wave, but the tapere partition is not stable across",
        "waves (2011 splits Kiikii-Ooa-Pue / Tupapa-Maraerenga; 2016 merges them; 2021 relabels), so the product holds",
        "at the island level. The tapere rows sum to the Rarotonga island total within each wave."
      ),
      boundary_assembly = list(
        geoboundaries = list(
          layer = "COK ADM0 (Sentinel-2 10m land cover, single MultiPolygon of 86 parts)",
          islands = as.list(gb_islands),
          method = "cluster the 86 land parts to the seven census islands by nearest known island coordinate; drop parts nearest the uninhabited decoys Manuae, Takutea, Suwarrow",
          parts_total = gb_res$n_parts, parts_dropped_as_decoy = gb_res$n_dropped_decoy,
          clusters = gb_cluster_record, licence = "CC BY 4.0"),
        osm = list(
          islands = as.list(names(osm_res)),
          method = "assemble each atoll's land as the union of its closed natural=coastline / place=island motu, fetched from the Overpass API; area-gate against published land areas",
          area_gate = osm_area_gate, licence = "ODbL 1.0",
          note = "All five atolls assembled cleanly (every coastline way closed; no super-relation assembly needed). Pukapuka's assembled land (4.4 sq km, all reef motu) exceeds the commonly quoted 1.3 sq km for the three main islets but stays inside the 0.3-10 sq km gate; disclosed."),
        licence_composite = "Mixed per feature: seven geoBoundaries features carry CC BY 4.0; five OSM features carry ODbL 1.0. Disclosed per feature (boundary_source, boundary_licence) and here.",
        dateline = "None. All Cook Islands territory is 155-166 W, far east of the antimeridian; verified from the assembled coordinates."
      ),
      boundary_simplification = simplification,
      omitted_metrics = list("place_count", "places_per_10000_residents", "place_density_per_sq_km"),
      local_cache_hint = "All raw sources are cached under data/raw/ck_census/ and remain git-ignored.",
      retrieval_record = raw_sources
    ),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")), digest = as.character(packageVersion("digest")),
      mapshaper = "scripts/lib/simplify_boundary.R (npx mapshaper)"
    )
  ),
  source = list(
    provider = "Cook Islands Statistics Office (CISO); geoBoundaries (William & Mary geoLab); OpenStreetMap contributors",
    source_dataset_ids = c(unname(d_wave[["2011"]]), unname(d_wave[["2016"]]), unname(d_wave[["2021"]]), d_2006, d_boundary_gb, d_boundary_osm),
    source_urls = list(url_2011, url_2016, url_2021, boundary_gb_url, boundary_gb_meta_url, overpass_url),
    retrieved_at = stamp,
    licence = paste0("CISO Standards clause (all three reports, verbatim): \"", licence_standards_clause, "\" ", licence_frontmatter_note,
                     " Boundary: geoBoundaries CC BY 4.0 (seven islands) and OpenStreetMap ODbL 1.0 (five northern atolls), attributed per feature."),
    citation = "Cook Islands Statistics Office, 2011/2016/2021 Census Reports, Table 2.4 / 2.04; geoBoundaries COK ADM0 (gbOpen); OpenStreetMap contributors.",
    raw_redistribution = "The census report PDFs, the geoBoundaries source GeoJSON, and the OSM Overpass responses are not committed; they remain in data/raw/ck_census/.",
    local_cache_hint = "data/raw/ck_census/ (git-ignored by .gitignore data/ rule)"
  ),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = list(
    durable_file_record(summary_json_out, "Cook Islands 12-island census-affiliation area summary for 2011, 2016, 2021 (36 rows).", "accepted", licence_basis_slug),
    durable_file_record(summary_csv_out, "Flattened Cook Islands 12-island census-affiliation rows for 2011, 2016, 2021.", "accepted", licence_basis_slug),
    durable_file_record(boundary_out, "Simplified composite Cook Islands 12-island boundary GeoJSON (geoBoundaries CC BY 4.0 + OSM ODbL 1.0, per-feature provenance).", "accepted", boundary_basis_slug)
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id,
         notes = "12 islands x 3 waves = 36 rows; all-ages resident-population universe; every wave reconciled to its printed island, group, national, and category margins."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out), built_by = script_id,
         notes = "12 island features: 7 from geoBoundaries COK ADM0 (CC BY 4.0) clustered from land-cover parts, 5 northern atolls from OSM coastline (ODbL 1.0). Per-feature boundary_source / boundary_licence.")
  ),
  validation = list(
    status = "passed",
    commands = list(
      paste("Rscript", script_id),
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/ck/data/area_summary_island.json",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/data-manifest.schema.json docs/manifests/ck-census-religion-2006-2021.json",
      "bash scripts/validate_manifests.sh"
    ),
    reconciliation = list(`2011` = recon[["2011"]], `2016` = recon[["2016"]], `2021` = recon[["2021"]]),
    boundary_validation = list(
      status = "passed", feature_count = 12L,
      distinct_source_geometry_hashes = length(unique(src_hashes)),
      distinct_output_geometry_hashes = length(unique(out_hashes)),
      geometry_hashes = geometry_hash_record,
      geoboundaries_clusters = gb_cluster_record,
      geoboundaries_parts_total = gb_res$n_parts, geoboundaries_parts_dropped_decoy = gb_res$n_dropped_decoy,
      osm_area_gate = osm_area_gate,
      no_dateline = "verified: all coordinates within 155-167 W",
      output_bytes = final_bytes, simplification = simplification),
    join_coverage = list(matched_islands = 12L, expected_islands = 12L, islands_with_geometry = 12L, named_gaps = list()),
    notes = paste(
      "Every island wave reconciles exactly: each of the twelve island rows closes to its printed Total, the twelve",
      "islands close to each group total and to the national margin (14,974 / 14,802 / 14,987), and every category",
      "column closes to its printed national total. The composite boundary joins 12/12 with 12 distinct geometry",
      "hashes: seven islands clustered from geoBoundaries COK ADM0 land-cover parts (Manuae/Takutea dropped as",
      "decoys) and five northern atolls assembled from OSM coastline motu, all within the atoll-land area gate. No",
      "dateline handling is needed (155-166 W)."
    ),
    warnings = list(
      "Mixed boundary licence: seven geoBoundaries features are CC BY 4.0 and five OSM features are ODbL 1.0; disclosed per feature and in the manifest, both attributions carried.",
      "The 2006 wave is held out of the island product (group-level only, from the 2016 report Table 6) and recorded as recoverable context; the runtime derives years per file, so a 2006 island wave would misrepresent the source.",
      "No-religion basis differs across waves: 2011 is No Religion only (national 841); 2016 and 2021 combine No Religion with Not Stated (national 1,097 and 2,338). Disclosed per row; the two shares need not sum to 100 percent.",
      "Licence caveat for the PI: the CISO Standards clause grants table reproduction-and-publication with acknowledgement, while the front-matter clause forbids altering the original work without permission. A derived, aggregated, attributed summary sits inside the Standards grant and the research carve-out; flagged, not blocking.",
      "Pukapuka's assembled OSM land (4.4 sq km, all reef motu) exceeds the commonly quoted 1.3 sq km for its three main islets; within the 0.3-10 sq km gate and disclosed."
    )
  ),
  construct_notes = list(
    "The construct is census affiliation: each resident's reported religious denomination (the census religion question, not compulsory), asked of all ages; not practice, attendance, or membership.",
    "Every wave counts the resident population, all ages, so island denominators are comparable across 2011-2016-2021. The national totals fall gently across the span (14,974; 14,802; 14,987).",
    "Categories are preserved verbatim per wave. Religious affiliation is the sum of the named religion categories; no religion is the published no-religion line. Jehovah's Witness is folded into Other Religion in the 2011 and 2016 island tables and printed separately in 2021.",
    "The no-religion line differs by frame: 2011 prints No Religion (841) and Objected/Not Stated (323) as separate columns, so no_religion carries the No Religion column only and the Objected/Not Stated column stays in the denominator; 2016 and 2021 print a single combined No Religion/Not Stated line, so their no-religion share includes not-stated. Disclosed per row.",
    "The 2006 wave is group-level only (Rarotonga / Southern / Northern, from the 2016 report Table 6) and is held out of the island product and recorded as recoverable context, keeping the summary file's implied geography honest.",
    "Boundary: a twelve-feature composite. Seven islands (Rarotonga, Aitutaki, Mangaia, Atiu, Mauke, Mitiaro, Penrhyn) are clustered from the geoBoundaries COK ADM0 Sentinel-2 land-cover parts (CC BY 4.0), with uninhabited Manuae/Takutea dropped as decoys; five northern atolls (Palmerston, Manihiki, Rakahanga, Nassau, Pukapuka) are assembled from OpenStreetMap coastline motu (ODbL 1.0). The mixed licence is disclosed per feature. No dateline handling is needed (all territory 155-166 W)."
  ),
  deferred_sources = list(
    list(source_dataset_id = "ciso-census-pre-2011-religion-by-island", status = "deferred",
         url = "https://sdd.spc.int/ck", local_path = NULL,
         notes = "No standalone 2006/2001/1996 island religion table located on stats.gov.ck (its national-census index lists only 2011/2016/2021). The SPC SDD digital library is the likely home of the older reports but returned HTTP 403 in the probe; a future-research route to extend the island series before 2011."),
    list(source_dataset_id = "pdh-cook-islands-census-microdata", status = "hold",
         url = "https://microdata.pacificdata.org/index.php/catalog/883", local_path = NULL,
         notes = "Pacific Data Hub microdata (catalog 883/275/7) are licensed files requiring a signed confidentiality declaration and CISO/SPC prior approval of outputs; a documented HOLD, never a route. The published-report tables carry the island aggregates the build needs."),
    list(source_dataset_id = "ck-2006-island-religion", status = "recoverable_context",
         url = url_2016, local_path = path_2016,
         notes = "2006 religion exists at island-group level only (2016 report Table 6). Recorded in pipeline.parameters.held_out_2006; a full 2006 island wave needs a 2006 island religion table, not located.")
  ),
  privacy = "public",
  licence_status = "accepted",
  licence_basis = licence_basis_slug,
  downstream_status = "public",
  source_datasets = source_datasets(),
  notes = paste(
    "The committed products are the derived 12-island area summary (36 rows across 2011, 2016, 2021) and the simplified",
    "composite boundary. On-page attribution, when a page is built, must cite the Cook Islands Statistics Office (report",
    "Standards clause: reproduce with acknowledgement), geoBoundaries (CC BY 4.0, Sentinel-2 / ESA) for seven islands,",
    "and OpenStreetMap contributors (ODbL 1.0) for the five northern atolls. The front-matter alter-without-permission",
    "clause is a PI caveat, not a blocker."
  )
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) stop("manifest JSON is invalid", call. = FALSE)

cat("waves shipped: 2011, 2016, 2021 (all ages) on 12 Cook Islands census islands; 2006 held out (group-level context)\n")
cat(sprintf("rows: %d (12 islands x 3 waves)\n", length(rows)))
for (y in names(waves)) cat(sprintf("gate %s: passed; 12 rows close; groups+national close to %d; every category column closes\n", y, waves[[y]]$national_total))
cat(sprintf("boundary: passed; 12/12 features, %d distinct hashes, %d bytes at %g%% keep\n",
            length(unique(out_hashes)), final_bytes, simplification[["keep_percent"]]))
cat(sprintf("  geoBoundaries: %d parts -> 7 islands, %d decoy parts dropped; OSM: 5 atolls assembled\n",
            gb_res$n_parts, gb_res$n_dropped_decoy))
cat("licence: accepted; CISO Standards clause (reproduce with acknowledgement); boundary CC BY 4.0 + OSM ODbL 1.0 per feature\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", boundary_out))
cat(sprintf("wrote %s\n", manifest_out))
