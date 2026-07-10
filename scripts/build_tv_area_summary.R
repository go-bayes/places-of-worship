# build the tuvalu region area-summary product from the census religion tables.
# inputs: the 2012 Population and Housing Census Volume 1 Analytical Report
# (summary-indicators table "Population of individual religions by region of
# residence"), the 2017 Population & Housing Mini-Census Preliminary Report
# (table "Resident population by religious denominations and region of
# residence"), and the geoBoundaries TUV ADM1 (8 island) GeoJSON.
# outputs: apps/regions/tv/data/tv_region_2017.geojson,
# apps/regions/tv/data/area_summary_region.{json,csv}, and
# docs/manifests/tv-census-religion-2012-2022.json.
# run from the repo root: Rscript scripts/build_tv_area_summary.R
#
# GEOGRAPHY DECISION (recorded in research/countries/tv/route-probe.md):
# no official Tuvalu census publishes religion by island. Every published
# religion tabulation reaches only a two-region split, National / Funafuti /
# Outer Islands. The build therefore ships a two-region frame (Funafuti versus
# the seven dissolved outer islands) for 2012 and 2017. The 2022 census
# publishes religion for the whole country only (Figure 5, percentages), so
# 2022 is national context, not a map layer. This departs from the queue's
# island-level ask on the authority of the source record.

suppressMessages({
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

raw_dir <- "data/raw/tv_census"
tv_dir <- "apps/regions/tv/data"
manifest_dir <- "docs/manifests"
dir.create(tv_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- "2026-07-11"
script_id <- "scripts/build_tv_area_summary.R"
country_code <- "TV"

boundary_set_id <- "tv-region-2017-geoboundaries-adm1-dissolved"
boundary_level <- "region"
census_2012_dataset_id <- "tuvalu-2012-census-vol1-religion-by-region"
census_2017_dataset_id <- "tuvalu-2017-minicensus-religion-by-region"
census_2022_dataset_id <- "tuvalu-2022-census-religion-national"
boundary_dataset_id <- "geoboundaries-tuv-adm1-2017"

# source urls recorded in the manifest.
census_2012_url <- "https://www.fao.org/fileadmin/templates/ess/ess_test_folder/World_Census_Agriculture/Country_info_2010/Reports/Reports_6/TUV_ENG_REP_2012.pdf"
census_2017_url <- "https://finance.gov.tv/wp-content/uploads/2022/05/Mini-Census-2017-Preliminary-Report.pdf"
census_2022_url <- "https://stats.gov.tv/download/85/population-and-housing-census/1836/tuvalu_2022_census_report.pdf"
census_landing_url <- "https://stats.gov.tv/category/census-and-surveys/population-census/"
geoboundaries_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/TUV/ADM1/"
geoboundaries_gj_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/TUV/ADM1/geoBoundaries-TUV-ADM1.geojson"

census_2012_path <- file.path(raw_dir, "tv_2012_census_vol1_fao.pdf")
census_2017_path <- file.path(raw_dir, "tv_2017_minicensus_prelim.pdf")
census_2022_path <- file.path(raw_dir, "tv_2022_census_report.pdf")
geoboundaries_path <- file.path(raw_dir, "geoBoundaries-TUV-ADM1.geojson")
geoboundaries_meta_path <- file.path(raw_dir, "gb_tuv_adm1_meta.json")

boundary_out <- file.path(tv_dir, "tv_region_2017.geojson")
summary_json_out <- file.path(tv_dir, "area_summary_region.json")
summary_csv_out <- file.path(tv_dir, "area_summary_region.csv")
manifest_out <- file.path(manifest_dir, "tv-census-religion-2012-2022.json")

licence_text <- paste(
  "Tuvalu 2012 Population and Housing Census Volume 1 Analytical Report",
  "(Central Statistics Division, Government of Tuvalu) and the Tuvalu 2017",
  "Population & Housing Mini-Census Preliminary Report (Central Statistics",
  "Division, Ministry of Finance). Both reports reserve commercial or",
  "for-profit reproduction and authorise partial reproduction for scientific,",
  "educational or research purposes provided the CSD and the source document",
  "are acknowledged. The 2022 report adds the Pacific Community (SPC) as a",
  "joint copyright holder under the same partial-research-reuse terms. The",
  "derived product carries attribution and does not claim an unrestricted",
  "open-data licence for the census counts. Boundaries are geoBoundaries TUV",
  "ADM1 (8 island units), Open Data Commons Open Database License 1.0, boundary",
  "source recorded by geoBoundaries as OpenStreetMap and Wambacher."
)
licence_status <- "tuvalu_census_partial_research_reuse_attribution_geoboundaries_odbl_1_0"

# the two published regions: the geoBoundaries ADM1 island shapeNames that
# dissolve up to each region. Funafuti is the single capital atoll; Outer
# Islands is the dissolve of the other seven ADM1 units. Niulakita (the ninth
# Tuvaluan island, administered with Niutao) has no separate ADM1 feature and
# is counted within the census Outer Islands region.
regions <- list(
  list(key = "funafuti", name = "Funafuti",
       districts = c("Funafuti")),
  list(key = "outer-islands", name = "Outer Islands",
       districts = c("Nanumea", "Nanumanga", "Niutao", "Nui", "Vaitupu",
                     "Nukufetau", "Nukulaelae"))
)

# category role mapping shared by both waves. "None" supplies no religion;
# "Refused" is non-response and stays in the denominator outside both headline
# numerators (the Tonga Pacific precedent); every other category is affiliation.
no_religion_label <- "None"
non_response_label <- "Refused"

# verbatim census religion tables, per wave, per region (Funafuti, Outer
# Islands). Source spellings preserved from each report. The printed national
# column is retained so each category reconciles Funafuti + Outer == national.
# 2012: "Population of individual religions by region of residence" (Vol 1).
wave_2012 <- list(
  year = 2012L,
  source_spelling = "as printed in the 2012 Volume 1 Analytical Report summary indicators",
  categories = list(
    list(label = "Ekalesia Kelisiano Tuvalu", funafuti = 4274L, outer = 4844L, national = 9118L),
    list(label = "Seventh Day Adventist",     funafuti = 207L,  outer = 89L,   national = 296L),
    list(label = "Jehova's Witness",          funafuti = 106L,  outer = 30L,   national = 136L),
    list(label = "Bahai",                     funafuti = 120L,  outer = 89L,   national = 209L),
    list(label = "Brethren",                  funafuti = 221L,  outer = 100L,  national = 321L),
    list(label = "Assembly Of God",           funafuti = 95L,   outer = 2L,    national = 97L),
    list(label = "Catholic",                  funafuti = 70L,   outer = 12L,   national = 82L),
    list(label = "Latter Day Saint",          funafuti = 98L,   outer = 12L,   national = 110L),
    list(label = "None",                      funafuti = 16L,   outer = 1L,    national = 17L),
    list(label = "Refused",                   funafuti = 2L,    outer = 0L,    national = 2L),
    list(label = "Other",                     funafuti = 227L,  outer = 25L,   national = 252L)
  ),
  # independent resident-population anchor: the 2012 age-structure rows
  # (<15, 15-59, 60+) sum to these region totals, matching the religion columns.
  resident_anchor = list(national = 10640L, funafuti = 5436L, outer = 5204L)
)

# 2017: "Resident population by religious denominations and region of residence".
wave_2017 <- list(
  year = 2017L,
  source_spelling = "as printed in the 2017 Mini-Census Preliminary Report summary indicators",
  categories = list(
    list(label = "Ekalesia Kelisiano Tuvalu", funafuti = 5108L, outer = 3915L, national = 9023L),
    list(label = "Seventh Day Adventist",     funafuti = 219L,  outer = 47L,   national = 266L),
    list(label = "Jehova's Witness",          funafuti = 128L,  outer = 27L,   national = 155L),
    list(label = "Bahai",                     funafuti = 99L,   outer = 58L,   national = 157L),
    list(label = "Brethren",                  funafuti = 238L,  outer = 58L,   national = 296L),
    list(label = "Assemblies of God",         funafuti = 138L,  outer = 17L,   national = 155L),
    list(label = "Catholic",                  funafuti = 39L,   outer = 14L,   national = 53L),
    list(label = "Latter Day Saints",         funafuti = 84L,   outer = 8L,    national = 92L),
    list(label = "None",                      funafuti = 25L,   outer = 1L,    national = 26L),
    list(label = "Refused",                   funafuti = 13L,   outer = 1L,    national = 14L),
    list(label = "Other",                     funafuti = 229L,  outer = 41L,   national = 270L)
  ),
  # the 2017 report prints "Resident population by region of residence"
  # 10,507 / 6,320 / 4,187 directly, matching the religion columns.
  resident_anchor = list(national = 10507L, funafuti = 6320L, outer = 4187L)
)

waves <- list(wave_2012, wave_2017)

# 2022 national religion (Figure 5 shares), recorded as context only. The 2022
# report publishes religion for the whole country and is therefore not a map layer.
national_2022_shares <- list(
  resident_population = 10643L,
  shares_percent = list(EKT = 86, Brethren = 3, AOG = 2, SDA = 2, Catholic = 1,
                        LDS = 1, Bahaii = 1, `Jehovah's Witness` = 1, Other = 2,
                        None = 0, Refused = 0, `Not stated` = 1)
)

# stop early if a required raw source has not been downloaded.
require_file <- function(path) {
  if (!file.exists(path)) stop("missing required source: ", path, call. = FALSE)
}
sha256_file <- function(path) unname(tools::sha256sum(path))
file_bytes <- function(path) as.numeric(unname(file.info(path)[["size"]]))
null_if_na <- function(value) {
  if (length(value) == 0L || is.na(value) || !is.finite(value)) return(NULL)
  value
}

row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$", path)) {
    geo <- fromJSON(path, simplifyVector = FALSE)
    return(length(geo[["features"]]))
  }
  if (grepl("\\.json$", path)) {
    json <- fromJSON(path, simplifyVector = FALSE)
    if (!is.null(json[["rows"]])) return(length(json[["rows"]]))
  }
  NA_integer_
}

# ---- exact row reconciliation gate ----
# for every wave and category, Funafuti + Outer Islands must equal the printed
# national value; failing rows are recorded precisely and the build stops.
reconcile_wave <- function(wave) {
  failing <- character(0)
  for (cat in wave[["categories"]]) {
    if (cat[["funafuti"]] + cat[["outer"]] != cat[["national"]]) {
      failing <- c(failing, sprintf("%d %s: Funafuti %d + Outer %d = %d != national %d",
        wave[["year"]], cat[["label"]], cat[["funafuti"]], cat[["outer"]],
        cat[["funafuti"]] + cat[["outer"]], cat[["national"]]))
    }
  }
  fun_tot <- sum(vapply(wave[["categories"]], function(c) c[["funafuti"]], integer(1)))
  out_tot <- sum(vapply(wave[["categories"]], function(c) c[["outer"]], integer(1)))
  nat_tot <- sum(vapply(wave[["categories"]], function(c) c[["national"]], integer(1)))
  a <- wave[["resident_anchor"]]
  if (fun_tot != a[["funafuti"]]) failing <- c(failing, sprintf("%d Funafuti column sum %d != resident anchor %d", wave[["year"]], fun_tot, a[["funafuti"]]))
  if (out_tot != a[["outer"]])    failing <- c(failing, sprintf("%d Outer column sum %d != resident anchor %d", wave[["year"]], out_tot, a[["outer"]]))
  if (nat_tot != a[["national"]]) failing <- c(failing, sprintf("%d national column sum %d != resident anchor %d", wave[["year"]], nat_tot, a[["national"]]))
  if (fun_tot + out_tot != nat_tot) failing <- c(failing, sprintf("%d Funafuti %d + Outer %d = %d != national %d", wave[["year"]], fun_tot, out_tot, fun_tot + out_tot, nat_tot))
  if (length(failing) > 0L) {
    stop("RECONCILIATION FAILURE (stop-don't-tune):\n  ", paste(failing, collapse = "\n  "), call. = FALSE)
  }
  list(funafuti = fun_tot, outer = out_tot, national = nat_tot)
}

# derive a region's headline metrics from the wave's category list.
region_metrics <- function(wave, region_key) {
  col <- if (region_key == "funafuti") "funafuti" else "outer"
  total <- 0L; none <- 0L; refused <- 0L; affiliation <- 0L
  for (cat in wave[["categories"]]) {
    v <- cat[[col]]
    total <- total + v
    if (cat[["label"]] == no_religion_label) none <- none + v
    else if (cat[["label"]] == non_response_label) refused <- refused + v
    else affiliation <- affiliation + v
  }
  list(total = total, none = none, refused = refused, affiliation = affiliation)
}

# ---- boundary: dissolve geoBoundaries ADM1 (8 islands) to the two regions ----
# metric CRS: Lambert azimuthal equal area centred on Tuvalu keeps island area
# true across the ~5-degree north-south spread of the archipelago.
tuvalu_laea <- "+proj=laea +lat_0=-8 +lon_0=178 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"

build_region_boundary <- function(path) {
  gb <- st_read(path, quiet = TRUE)
  if (nrow(gb) != 8L) stop("expected 8 geoBoundaries TUV ADM1 island units, got ", nrow(gb), call. = FALSE)
  gb <- st_make_valid(gb)
  gb[["shapeName"]] <- as.character(gb[["shapeName"]])

  # map every island to its region; an island assigned to no region, or to more
  # than one, fails loudly so the mapping stays exhaustive and disjoint.
  island_to_region <- character(0)
  for (r in regions) {
    for (d in r[["districts"]]) {
      if (d %in% names(island_to_region)) stop("island assigned to two regions: ", d, call. = FALSE)
      island_to_region[[d]] <- r[["key"]]
    }
  }
  unmapped <- setdiff(gb[["shapeName"]], names(island_to_region))
  if (length(unmapped) > 0L) stop("islands not mapped to a region: ", paste(unmapped, collapse = "; "), call. = FALSE)
  extra <- setdiff(names(island_to_region), gb[["shapeName"]])
  if (length(extra) > 0L) stop("region mapping names islands absent from geoBoundaries: ", paste(extra, collapse = "; "), call. = FALSE)

  gb[["region_key"]] <- unname(island_to_region[gb[["shapeName"]]])
  gb_metric <- st_transform(gb, tuvalu_laea)

  keys <- vapply(regions, function(r) r[["key"]], character(1))
  names <- vapply(regions, function(r) r[["name"]], character(1))
  geoms <- vector("list", length(keys))
  areas <- numeric(length(keys))
  for (i in seq_along(keys)) {
    parts <- gb_metric[gb_metric[["region_key"]] == keys[i], ]
    dissolved <- st_union(parts)
    areas[i] <- as.numeric(st_area(dissolved)) / 1e6
    geoms[[i]] <- st_transform(dissolved, 4326)
  }
  out <- st_sf(
    area_code = keys,
    area_name = names,
    area_unit_id = paste0(boundary_set_id, ":", keys),
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    land_area_sq_km = round(areas, 2),
    # one sfg per region: c() would concatenate the sfg list into a single
    # union geometry that st_sf silently recycles across every row (the BS trap).
    geometry = do.call(st_sfc, c(lapply(geoms, function(g) st_geometry(g)[[1]]),
                                 list(crs = 4326)))
  )
  out <- st_make_valid(out)
  out
}

write_simplified_boundary <- function(boundary, output_path, field_names) {
  boundary_fields <- boundary[, field_names]
  # the source layer is tiny; keep-shapes at a high percentage stays well under
  # the 3 MB ceiling. allow-overlaps stops clean from treating the sea gaps
  # between the seven dissolved outer islands as errors (the archipelago trap).
  keep_percentages <- c(100, 80, 60, 40, 20, 10)
  mapshaper_simplify_to_cap(
    boundary_fields,
    output_path,
    max_bytes = 3000000L,
    keep_percentages = keep_percentages,
    clean_option = "allow-overlaps"
  )
}

# per-feature distinct geometry hashes (the BS trap: verify the two regions are
# genuinely distinct geometries, not one recycled union).
geometry_hashes <- function(path) {
  g <- st_read(path, quiet = TRUE)
  vapply(seq_len(nrow(g)), function(i) {
    substr(digest_wkb(st_geometry(g)[[i]]), 1, 16)
  }, character(1))
}
digest_wkb <- function(geom) {
  wkb <- sf::st_as_binary(st_sfc(geom))
  # base R hash without extra packages: sha256 of the raw WKB bytes.
  tmp <- tempfile(); on.exit(unlink(tmp), add = TRUE)
  writeBin(wkb[[1]], tmp)
  unname(tools::sha256sum(tmp))
}

# ---- require raw sources ----
required_sources <- c(census_2012_path, census_2017_path, census_2022_path,
                      geoboundaries_path, geoboundaries_meta_path)
invisible(lapply(required_sources, require_file))

# ---- reconcile every wave ----
recon <- lapply(waves, reconcile_wave)
names(recon) <- vapply(waves, function(w) as.character(w[["year"]]), character(1))

# ---- boundary ----
boundary <- build_region_boundary(geoboundaries_path)
if (nrow(boundary) != length(regions)) stop("region boundary count mismatch", call. = FALSE)
boundary_write <- write_simplified_boundary(
  boundary, boundary_out,
  c("area_code", "area_name", "area_unit_id", "boundary_set_id", "boundary_level", "land_area_sq_km")
)
if (row_count_file(boundary_out) != nrow(boundary)) {
  stop("region boundary feature count changed during simplification", call. = FALSE)
}
hashes <- geometry_hashes(boundary_out)
if (length(unique(hashes)) != nrow(boundary)) {
  stop("region geometries are not distinct (BS trap): ", paste(hashes, collapse = ", "), call. = FALSE)
}

# ---- assemble rows: 2 regions x 2 waves ----
quality_flag_base <- paste(
  "two_region_frame_funafuti_vs_outer_islands",
  "no_official_island_level_religion_table",
  "resident_population_denominator_refused_outside_numerators",
  "none_category_is_no_religion",
  "region_categories_reconcile_to_national",
  sep = ";"
)

population_basis <- paste(
  "resident population enumerated in the census religion tabulation for the",
  "region (Funafuti or Outer Islands); the denominator for the percentages is",
  "this region total, with the census Refused count retained in the denominator",
  "and outside both headline numerators"
)

build_area_row <- function(wave, region) {
  m <- region_metrics(wave, region[["key"]])
  b <- match(region[["key"]], boundary[["area_code"]])
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = boundary[["area_unit_id"]][b],
    area_code = region[["key"]],
    area_name = boundary[["area_name"]][b],
    year = wave[["year"]],
    population_total = null_if_na(as.integer(m[["total"]])),
    population_total_basis = population_basis,
    religious_affiliation_count = null_if_na(as.integer(m[["affiliation"]])),
    religious_affiliation_percent = null_if_na(round(100 * m[["affiliation"]] / m[["total"]], 2)),
    no_religion_count = null_if_na(as.integer(m[["none"]])),
    no_religion_percent = null_if_na(round(100 * m[["none"]] / m[["total"]], 2)),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(boundary[["land_area_sq_km"]][b], 2),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = c(
      if (wave[["year"]] == 2012L) census_2012_dataset_id else census_2017_dataset_id,
      boundary_dataset_id),
    quality_flag = quality_flag_base
  )
}

rows <- list()
# emit in (region, year) order: both regions, both years.
for (r in regions) {
  for (w in waves) {
    rows[[length(rows) + 1L]] <- build_area_row(w, r)
  }
}

flatten_rows <- function(rows) {
  csv_scalar <- function(value, missing_value) if (is.null(value)) missing_value else value
  do.call(rbind, lapply(rows, function(row) {
    data.frame(
      country_code = row[["country_code"]],
      boundary_set_id = row[["boundary_set_id"]],
      boundary_level = row[["boundary_level"]],
      area_unit_id = row[["area_unit_id"]],
      area_code = row[["area_code"]],
      area_name = row[["area_name"]],
      year = row[["year"]],
      population_total = csv_scalar(row[["population_total"]], NA_integer_),
      population_total_basis = row[["population_total_basis"]],
      religious_affiliation_count = csv_scalar(row[["religious_affiliation_count"]], NA_integer_),
      religious_affiliation_percent = csv_scalar(row[["religious_affiliation_percent"]], NA_real_),
      no_religion_count = csv_scalar(row[["no_religion_count"]], NA_integer_),
      no_religion_percent = csv_scalar(row[["no_religion_percent"]], NA_real_),
      place_count = NA_integer_,
      places_per_10000_residents = NA_real_,
      place_density_per_sq_km = NA_real_,
      land_area_sq_km = row[["land_area_sq_km"]],
      site_snapshot_date = NA,
      place_count_basis = NA,
      source_dataset_ids = paste(row[["source_dataset_ids"]], collapse = "|"),
      quality_flag = row[["quality_flag"]],
      stringsAsFactors = FALSE
    )
  }))
}

denominator_note <- paste(
  "Percentages use each region's resident-population denominator. Religious",
  "affiliation is every named religion plus the report's Other category; no",
  "religion is the None category. The census Refused count stays in the",
  "denominator and outside both numerators; the two headline shares therefore do not",
  "sum to 100 percent. Tuvalu is close to universally affiliated (about 99.7",
  "percent); the headline affiliation and no-religion metrics therefore vary little",
  "between regions; the substantive subnational contrast is denominational",
  "(a lower Ekalesia Kelisiano Tuvalu share on Funafuti than on the Outer",
  "Islands), which the shared headline metric set does not carry."
)

source_datasets <- function() {
  list(
    list(
      source_dataset_id = census_2012_dataset_id,
      name = "Tuvalu 2012 Population and Housing Census, Volume 1 Analytical Report: religion by region of residence",
      provider = "Central Statistics Division (CSD), Government of Tuvalu",
      url = census_2012_url,
      retrieval_date = retrieval_date,
      local_path = census_2012_path,
      licence = list(
        name = "CSD census report; commercial reproduction reserved, partial reproduction authorised for scientific, educational or research purposes with acknowledgement",
        url = census_landing_url,
        attribution = "Central Statistics Division, Government of Tuvalu"
      ),
      citation = "Central Statistics Division, Tuvalu 2012 Population and Housing Census, Volume 1 Analytical Report.",
      access_limits = NULL,
      redistribution_limits = "The census PDF is not committed; the derived product attributes CSD and links the source. Official CSD publication retrieved from the FAO World Census of Agriculture country-reports mirror.",
      notes = paste(
        "Summary-indicators table 'Population of individual religions by region of residence' gives National / Funafuti /",
        "Outer Islands counts for eleven categories. No island-level religion table is published. Region column sums",
        "reconcile to the resident population implied by the age-structure rows (national 10,640; Funafuti 5,436; Outer 5,204)."
      )
    ),
    list(
      source_dataset_id = census_2017_dataset_id,
      name = "Tuvalu 2017 Population & Housing Mini-Census Preliminary Report: religion by region of residence",
      provider = "Central Statistics Division, Ministry of Finance, Economic Planning and Industries, Tuvalu",
      url = census_2017_url,
      retrieval_date = retrieval_date,
      local_path = census_2017_path,
      licence = list(
        name = "CSD mini-census report; commercial reproduction reserved, partial reproduction authorised for scientific, educational or research purposes with acknowledgement",
        url = census_landing_url,
        attribution = "Central Statistics Division, Ministry of Finance, Tuvalu"
      ),
      citation = "Central Statistics Division, Tuvalu 2017 Population & Housing Mini-Census Preliminary Report.",
      access_limits = NULL,
      redistribution_limits = "The census PDF is not committed; the derived product attributes CSD and links the source.",
      notes = paste(
        "Table 'Resident population by religious denominations and region of residence' gives National / Funafuti /",
        "Outer Islands counts for eleven categories. The 2017 collection is a mini-census, a lighter instrument than the",
        "2012 full census. Region column sums match the printed resident population (national 10,507; Funafuti 6,320; Outer 4,187)."
      )
    ),
    list(
      source_dataset_id = census_2022_dataset_id,
      name = "Tuvalu 2022 Census on Population and Housing Report: religion national distribution (Figure 5)",
      provider = "Pacific Community (SPC) and Central Statistics Division (CSD), Tuvalu",
      url = census_2022_url,
      retrieval_date = retrieval_date,
      local_path = census_2022_path,
      licence = list(
        name = "SPC and Tuvalu CSD census report; commercial reproduction reserved, partial reproduction authorised for scientific, educational or research purposes with acknowledgement",
        url = census_landing_url,
        attribution = "Pacific Community (SPC) and Tuvalu Central Statistics Division"
      ),
      citation = "Pacific Community and Central Statistics Division, Tuvalu 2022 Census on Population and Housing Report.",
      access_limits = NULL,
      redistribution_limits = "Recorded as national context only. The 2022 report publishes religion for the whole country (Figure 5 shares); no 2022 subnational religion table therefore exists to map.",
      notes = paste(
        "National context, not a map layer. Figure 5 gives the 2022 national religion distribution as percentages:",
        "EKT 86, Brethren 3, AOG 2, SDA 2, Catholic 1, LDS 1, Bahaii 1, Jehovah's Witness 1, Other 2, None 0, Refused 0,",
        "Not stated 1. These are chart shares, not an exact count table, and are not mapped."
      )
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "geoBoundaries TUV ADM1 (8 island units)",
      provider = "geoBoundaries (William & Mary geoLab)",
      url = geoboundaries_gj_url,
      retrieval_date = retrieval_date,
      local_path = geoboundaries_path,
      licence = list(
        name = "Open Data Commons Open Database License 1.0; boundary source recorded by geoBoundaries as OpenStreetMap and Wambacher",
        url = geoboundaries_meta_url,
        attribution = "geoBoundaries (gbOpen); boundary source OpenStreetMap, Wambacher"
      ),
      citation = "Runfola et al., geoBoundaries TUV ADM1 (gbOpen), island boundaries.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary is committed with ODbL 1.0 attribution to geoBoundaries and OpenStreetMap.",
      notes = paste(
        "8 ADM1 island units (Nanumea, Nanumanga, Niutao, Nui, Vaitupu, Nukufetau, Funafuti, Nukulaelae), dissolved to",
        "two census regions: Funafuti alone, and the seven others as Outer Islands. Niulakita (the ninth Tuvaluan island,",
        "administered with Niutao) has no separate ADM1 feature and is counted within the census Outer Islands region.",
        "boundaryYearRepresented 2017; source data update 2023-01-19."
      )
    )
  )
}

indicators_for_region <- function() {
  list(
    list(
      indicator_id = "population_total",
      label = "Census resident population",
      description = "Region resident population from the census religion tabulation.",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "Sum of the eleven religion categories in the region column of each wave's table.",
      temporal_coverage = "2012; 2017",
      spatial_coverage = "Tuvalu census regions (Funafuti; Outer Islands).",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious affiliation %",
      description = "Share of the region resident population declaring any named religion.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * (region total - None - Refused) / region total.",
      temporal_coverage = "2012; 2017",
      spatial_coverage = "Tuvalu census regions.",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "No religion %",
      description = "Share of the region resident population reporting no religion (the None category).",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * None / region total.",
      temporal_coverage = "2012; 2017",
      spatial_coverage = "Tuvalu census regions.",
      quality_notes = denominator_note
    )
  )
}

visual_layers_for_region <- function() {
  list(
    list(
      visual_layer_id = "tv-region-religious-affiliation",
      label = "Religious affiliation %",
      description = "Tuvalu census religious-affiliation share by region, 2012 and 2017.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "region resident population in the census religion tabulation"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = "All named religions plus Other count as religious affiliation; None is no religion; Refused stays in the denominator."
    ),
    list(
      visual_layer_id = "tv-region-no-religion",
      label = "No religion %",
      description = "Tuvalu census no-religion share by region, 2012 and 2017.",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "region resident population in the census religion tabulation"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = "The None category of each region's religion table."
    )
  )
}

area_summary_document <- function(rows) {
  list(
    schema_version = "0.2.0",
    generated_at = stamp,
    generated_by = script_id,
    country_code = country_code,
    boundary_set = list(
      boundary_set_id = boundary_set_id,
      country_code = country_code,
      level = boundary_level,
      vintage = "2017",
      source_dataset_id = boundary_dataset_id
    ),
    site_snapshot = list(
      source_dataset_id = NULL,
      snapshot_date = NULL,
      basis = "no governed Tuvalu OpenStreetMap place-of-worship snapshot is included in this country data-map release",
      notes = "The Tuvalu product exposes census religious-affiliation and no-religion metrics only; place-density metrics are hidden until a governed Tuvalu place layer is built."
    ),
    source_datasets = source_datasets(),
    indicators = indicators_for_region(),
    visual_layers = visual_layers_for_region(),
    rows = rows
  )
}

manifest_file_record <- function(path, content, licence_status_value) {
  list(
    uri = paste0("repo:", path),
    storage_provider = "git_repository",
    format = sub("^.*\\.", "", path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    row_count = row_count_file(path),
    content = content,
    privacy = "public",
    licence_status = licence_status_value
  )
}

raw_source_record <- function(path, url, format, row_count, source_id, used, periods, notes) {
  list(
    uri = path, url = url, format = format,
    bytes = if (file.exists(path)) file_bytes(path) else NULL,
    sha256 = if (file.exists(path)) sha256_file(path) else NULL,
    row_count = row_count, source_dataset_id = source_id,
    used_in_public_product = used, periods = periods, notes = notes,
    local_cache_hint = paste0(path, " (git-ignored)"),
    raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/tv_census/")
  )
}

write_json(area_summary_document(rows), summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

# ---- validation records ----
join_coverage <- list(list(
  boundary_level = boundary_level, year = 2012L,
  matched_area_count = length(regions), expected_area_count = nrow(boundary),
  missing_area_names = list()
), list(
  boundary_level = boundary_level, year = 2017L,
  matched_area_count = length(regions), expected_area_count = nrow(boundary),
  missing_area_names = list()
))

national_reconciliation <- unlist(lapply(waves, function(w) {
  r <- recon[[as.character(w[["year"]])]]
  fun <- region_metrics(w, "funafuti"); out <- region_metrics(w, "outer-islands")
  list(
    list(year = w[["year"]], metric = "population_total", area_sum = fun[["total"]] + out[["total"]],
         national_total = w[["resident_anchor"]][["national"]], difference = (fun[["total"]] + out[["total"]]) - w[["resident_anchor"]][["national"]]),
    list(year = w[["year"]], metric = "religious_affiliation_count", area_sum = fun[["affiliation"]] + out[["affiliation"]],
         national_total = w[["resident_anchor"]][["national"]] - sum(vapply(w[["categories"]], function(c) if (c[["label"]] %in% c(no_religion_label, non_response_label)) c[["national"]] else 0L, integer(1))),
         difference = 0L),
    list(year = w[["year"]], metric = "no_religion_count", area_sum = fun[["none"]] + out[["none"]],
         national_total = sum(vapply(w[["categories"]], function(c) if (c[["label"]] == no_religion_label) c[["national"]] else 0L, integer(1))),
         difference = 0L)
  )
}), recursive = FALSE)

validation_checks <- c(
  "The 2012 Volume 1 Analytical Report and the 2017 Mini-Census Preliminary Report each publish religion only by region of residence (National / Funafuti / Outer Islands); neither publishes religion by island; a two-region frame is therefore the finest official geography.",
  "For every wave and category, Funafuti + Outer Islands equals the printed national value; the eleven-category column sums match the resident population (2012: 10,640 / 5,436 / 5,204; 2017: 10,507 / 6,320 / 4,187).",
  "Percentages use each region's resident-population denominator; religious affiliation is every named religion plus Other, no religion is None, and Refused stays in the denominator outside both numerators.",
  sprintf("The 8 geoBoundaries TUV ADM1 island units dissolve disjointly and exhaustively to the two census regions; Funafuti is one unit, the other seven form Outer Islands. Niulakita has no ADM1 feature and is counted within Outer Islands. Output geometries carry %d distinct hashes.", length(unique(hashes))),
  sprintf("The dissolved region boundary GeoJSON writes to %d bytes after %s simplification at %g%% keep, cleaned with %s (2 region features).",
          as.integer(boundary_write[["bytes"]]), boundary_write[["method"]],
          boundary_write[["keep_percent"]], boundary_write[["clean_option"]]),
  "2022 religion is national only: the 2022 report publishes religion as a national distribution (Figure 5 shares); no 2022 subnational religion table therefore exists to map. 2022 national shares are recorded as context.",
  "Tuvalu is close to universally affiliated (about 99.7 percent); the headline affiliation and no-religion metrics therefore vary little between regions; the substantive subnational contrast is denominational (lower EKT share on Funafuti), which the shared headline metric set does not carry."
)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:tv-census-religion:tv:2012-2022:csd-region-reports",
  dataset_id = "tv-census-religion:tv:2012-2022:csd-region-reports",
  dataset_version_id = paste0("tv-census-religion:tv:2012-2022:csd-region-reports:", substr(sha256_file(summary_json_out), 1, 12)),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "tv-census-religion",
  dataset_role = "public_product",
  scope = list(level = "country", country_codes = list(country_code),
               snapshot_date = NULL, snapshot_anchor = NULL, pipeline_stage = "public"),
  created_at = stamp,
  created_by = script_id,
  target_years = c(2012L, 2017L),
  pipeline = list(
    script = script_id,
    git_commit = NULL,
    command = paste("Rscript", script_id),
    parameters = list(
      waves = c("2012", "2017"),
      geography = "two-region (Funafuti; Outer Islands)",
      region_boundary_set = boundary_set_id,
      region_boundary_simplification = list(
        method = boundary_write[["method"]],
        clean_option = boundary_write[["clean_option"]],
        keep_percent = boundary_write[["keep_percent"]],
        bytes = boundary_write[["bytes"]]
      ),
      extraction = "religion-by-region tables read from the 2012 Volume 1 and 2017 Mini-Census reports; counts embedded verbatim and reconciled",
      denominator = "region resident population; affiliation = named religions + Other; no religion = None; Refused retained in denominator outside numerators",
      subnational_geography = "geoBoundaries TUV ADM1 (8 island units) dissolved to two census regions",
      omitted_metrics = c("places_per_10000_residents", "place_density_per_sq_km"),
      national_only_wave_2022 = "2022 religion is a national distribution (Figure 5 shares); recorded as context, not mapped",
      island_level_not_available = "no official Tuvalu census publishes religion by island; the finest official religion geography is the two-region Funafuti / Outer Islands split"
    ),
    software_versions = list(
      r = paste(R.version[["major"]], R.version[["minor"]], sep = "."),
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite"))
    )
  ),
  source = list(
    provider = "Central Statistics Division, Tuvalu; Pacific Community (SPC); geoBoundaries (William & Mary geoLab)",
    source_dataset_ids = c(census_2012_dataset_id, census_2017_dataset_id, census_2022_dataset_id, boundary_dataset_id),
    source_urls = c(census_2012_url, census_2017_url, census_2022_url, census_landing_url, geoboundaries_meta_url, geoboundaries_gj_url),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = licence_text,
    citation = "CSD, Tuvalu 2012 Census Vol 1; CSD, Tuvalu 2017 Mini-Census Preliminary Report; SPC and CSD, Tuvalu 2022 Census Report; geoBoundaries TUV ADM1 (gbOpen).",
    raw_redistribution = "The census PDFs and the geoBoundaries source GeoJSON are not committed. They remain in data/raw/tv_census/ and await any project-controlled raw archive upload.",
    local_cache_hint = "data/raw/tv_census/ (git-ignored by .gitignore:120 'data/')",
    raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/tv_census/")
  ),
  input_manifests = list(),
  raw_sources = list(
    raw_source_record(census_2012_path, census_2012_url, "pdf", NA_integer_, census_2012_dataset_id, TRUE, "2012",
      "2012 Volume 1 Analytical Report; 'Population of individual religions by region of residence' supplies the 2012 Funafuti and Outer Islands religion counts. Official CSD publication retrieved from the FAO country-reports mirror."),
    raw_source_record(census_2017_path, census_2017_url, "pdf", NA_integer_, census_2017_dataset_id, TRUE, "2017",
      "2017 Mini-Census Preliminary Report; 'Resident population by religious denominations and region of residence' supplies the 2017 Funafuti and Outer Islands religion counts."),
    raw_source_record(census_2022_path, census_2022_url, "pdf", NA_integer_, census_2022_dataset_id, FALSE, "2022",
      "2022 Census Report; Figure 5 national religion shares, recorded as context. Religion is published for the whole country only; 2022 is therefore not mapped."),
    raw_source_record(geoboundaries_path, geoboundaries_gj_url, "geojson", 8L, boundary_dataset_id, TRUE, "2017",
      "geoBoundaries TUV ADM1 GeoJSON; 8 island units dissolved to two census regions. ODbL 1.0."),
    raw_source_record(geoboundaries_meta_path, geoboundaries_meta_url, "json", NA_integer_, boundary_dataset_id, FALSE, "2017",
      "geoBoundaries TUV ADM1 metadata; records the ODbL 1.0 licence, boundarySource 'OpenStreetMap, Wambacher', admUnitCount 8.")
  ),
  durable_files = list(
    manifest_file_record(summary_json_out, "Tuvalu region area summary with census 2012 and 2017 religious-affiliation and no-religion metrics.", licence_status),
    manifest_file_record(summary_csv_out, "Flattened Tuvalu region area summary with census 2012 and 2017 religious-affiliation and no-religion metrics.", licence_status),
    manifest_file_record(boundary_out, "Simplified Tuvalu region boundary GeoJSON derived from geoBoundaries TUV ADM1 (8 island units) dissolved to 2 regions.", "geoboundaries_odbl_1_0")
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out),
         built_by = script_id, notes = "2 region reporting units x 2 census waves (2012, 2017); resident-population denominator."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out),
         built_by = script_id, notes = sprintf("2 region features dissolved from 8 geoBoundaries TUV ADM1 island units, simplified with %s at %g%% keep, cleaned with %s.",
                                               boundary_write[["method"]], boundary_write[["keep_percent"]], boundary_write[["clean_option"]]))
  ),
  validation = list(
    checks = validation_checks,
    join_coverage = list(region = join_coverage),
    national_reconciliation = national_reconciliation,
    boundary_validation = list(
      source_tuv_island_count = 8L,
      dissolved_region_count = nrow(boundary),
      output_feature_count = row_count_file(boundary_out),
      expected_feature_count = nrow(boundary),
      distinct_geometry_hashes = length(unique(hashes)),
      geometry_hashes = as.list(hashes),
      output_bytes = boundary_write[["bytes"]],
      simplification_method = boundary_write[["method"]],
      simplification_clean_option = boundary_write[["clean_option"]],
      simplification_keep_percent = boundary_write[["keep_percent"]],
      niulakita_note = "Niulakita (the ninth Tuvaluan island) has no geoBoundaries ADM1 feature and is counted within the census Outer Islands region.",
      unmatched_boundary_features = list(),
      unmatched_census_areas = list()
    )
  ),
  construct_notes = list(
    "The public product displays two headline metrics at region level for 2012 and 2017: religious affiliation percent and no religion percent.",
    "Geography is two-region (Funafuti versus Outer Islands), the finest geography at which any Tuvalu census publishes religion. No official island-level religion table exists for any wave.",
    "Percentages use the region resident-population denominator. Religious affiliation is every named religion plus the report's Other category; no religion is the None category. The census Refused count stays in the denominator and outside both numerators; the two shares therefore do not sum to 100 percent.",
    "Tuvalu is close to universally religiously affiliated (about 99.7 percent); the headline affiliation and no-religion metrics therefore differ little between the two regions. The substantive subnational variation is denominational, notably a lower Ekalesia Kelisiano Tuvalu share on Funafuti than on the Outer Islands, which the shared headline metric set does not represent.",
    "The two regions are the geoBoundaries TUV ADM1 8 island units dissolved up to Funafuti and Outer Islands; each island belongs to exactly one region. Niulakita has no separate ADM1 feature and is counted within Outer Islands.",
    "2022 religion is national only: the 2022 report publishes religion as a national distribution (Figure 5 shares: EKT 86, Brethren 3, AOG 2, SDA 2, Catholic 1, LDS 1, Bahaii 1, Jehovah's Witness 1, Other 2, None 0, Refused 0, Not stated 1). It cannot be mapped subnationally and is recorded as context."
  ),
  deferred_sources = list(
    list(
      source_dataset_id = "tuvalu-census-religion-by-island-microdata",
      url = "https://microdata.pacificdata.org/index.php/catalog/269",
      local_path = NULL,
      notes = "PDH hosts the 2012 (catalog 50) and 2017 (catalog 269) census microdata with a record-level religion variable, from which an island-level religion tabulation could be built. Microdata access is licensed and any such tabulation would be a project-produced table, not an official published table. An island-level religion table request to the Tuvalu CSD (statistics@gov.tv) would supply the queue's island geography with official authority."
    ),
    list(
      source_dataset_id = "tuvalu-2022-census-religion-by-island",
      url = census_2022_url,
      local_path = census_2022_path,
      notes = "The 2022 report publishes religion for the whole country only (Figure 5). A 2022 island or region religion tabulation, if held by CSD/SPC, would add a mappable 2022 wave and a change layer on the same geography."
    )
  ),
  privacy = "public",
  licence_status = licence_status,
  downstream_status = "public",
  source_datasets = source_datasets(),
  notes = "The committed products contain the derived region area summary and simplified boundary only. On-page attribution cites the Tuvalu CSD, SPC (2022), and geoBoundaries (ODbL 1.0, OpenStreetMap/Wambacher)."
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
manifest_text <- paste(readLines(manifest_out, warn = FALSE), collapse = "\n")
if (!jsonlite::validate(manifest_text)) stop("manifest JSON failed jsonlite validation", call. = FALSE)

cat(sprintf("wrote %s: %d rows\n", summary_json_out, length(rows)))
cat(sprintf("wrote %s: %d rows\n", summary_csv_out, row_count_file(summary_csv_out)))
cat(sprintf("wrote %s: %d features, %d bytes with %s at %g%% keep, clean %s\n", boundary_out, row_count_file(boundary_out),
            as.integer(file_bytes(boundary_out)), boundary_write[["method"]], boundary_write[["keep_percent"]],
            boundary_write[["clean_option"]]))
cat(sprintf("distinct geometry hashes: %d/%d\n", length(unique(hashes)), nrow(boundary)))
cat(sprintf("wrote %s\n", manifest_out))
for (w in waves) {
  fun <- region_metrics(w, "funafuti"); out <- region_metrics(w, "outer-islands")
  cat(sprintf("%d Funafuti: total %d, affiliation %d (%.2f%%), none %d (%.2f%%), refused %d\n",
              w[["year"]], fun[["total"]], fun[["affiliation"]], 100 * fun[["affiliation"]] / fun[["total"]],
              fun[["none"]], 100 * fun[["none"]] / fun[["total"]], fun[["refused"]]))
  cat(sprintf("%d Outer Islands: total %d, affiliation %d (%.2f%%), none %d (%.2f%%), refused %d\n",
              w[["year"]], out[["total"]], out[["affiliation"]], 100 * out[["affiliation"]] / out[["total"]],
              out[["none"]], 100 * out[["none"]] / out[["total"]], out[["refused"]]))
}
cat("reconciliation: exact for every wave and category (Funafuti + Outer = national)\n")
