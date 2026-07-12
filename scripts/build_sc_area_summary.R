# build the Seychelles district census-religion area-summary product for a single
# wave (2022) on the official 27-district OCHA COD-AB (Seychelles NBS) admin-3 frame.
# inputs (all cached, git-ignored, sha256 in research/countries/sc/route-probe.md):
#   data/raw/sc_census/sc_2022_census_report.pdf -> Table B4.1 "Population in all
#     households by religion and region/district, 2022" (integer counts, 8 categories,
#     transcribed verbatim below and reconciled against the printed control totals)
#   data/raw/sc_census/syc_adm_nbs2010_SHP.zip -> COD-AB SYC ADM3 (27 districts, from
#     the Seychelles National Bureau of Statistics; CC BY-IGO)
#   data/raw/sc_census/hdx_cod_ab_syc.json -> COD-AB HDX metadata (licence, source)
# every religion cell is transcribed verbatim from Table B4.1 (all households) and
# reconciled against the printed control totals here; the build stops on any margin
# mismatch and never allocates, infers, rounds, imputes, or tunes a value.
# the census presents religion over 7 regions with district/island leaf rows. the 25
# granite-island districts and the La Digue leaf join the official 27 COD districts
# one-to-one; the single official "Other Islands" district takes the exact aggregate
# of the census's inner-island leaves (except La Digue) plus the outer-island leaves.
# there is no standalone No-religion line (the questionnaire collected it, but the
# published table folds the non-religious into "Other (Specify)"), so no_religion is
# null and disclosed; affiliation counts the five clearly-religious categories.
# outputs: apps/regions/sc/data/sc_district_2020.geojson,
#   apps/regions/sc/data/area_summary_district.{json,csv}, and
#   docs/manifests/sc-census-religion-2022.json.
# run from the repo root: Rscript scripts/build_sc_area_summary.R
# STAGED product: no page, no hub link. census licence needs_review (NBS all-rights-
# reserved with a prior-consent clause; derived summaries ship staged with attribution
# under build-then-ask); boundary CC BY-IGO (accepted).

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "SC"
script_id <- "scripts/build_sc_area_summary.R"
raw_dir <- "data/raw/sc_census"
product_dir <- "apps/regions/sc/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-12"
stamp <- paste0(retrieval_date, "T00:00:00Z")
git_commit <- trimws(system2("git", c("rev-parse", "HEAD"), stdout = TRUE))
if (length(git_commit) != 1L || !grepl("^[a-f0-9]{40}$", git_commit)) git_commit <- NULL

# COD-AB SYC ADM3 is the NBS admin-3 district frame published on HDX in 2020.
boundary_level <- "district"
boundary_vintage <- "2020"
boundary_set_id <- "sc-district-2020-cod-ab-nbs-adm3"

d2022 <- "sc-census-2022-table-b4-1-religion-by-district"
d_boundary <- "cod-ab-syc-nbs-adm3-2020"

# ---- source urls and cached paths ----------------------------------------------
url_report <- "https://www.nbs.gov.sc/downloads/1555-seychelles-population-and-housing-census-2022"
url_report_archive <- "https://web.archive.org/web/20260703110307id_/https://www.nbs.gov.sc/downloads/1555-seychelles-population-and-housing-census-2022/download"
url_terms <- "https://www.nbs.gov.sc/terms-and-conditions"
url_cod_page <- "https://data.humdata.org/dataset/seychelles-subnational-administrative-boundaries"
url_cod_shp <- "https://data.humdata.org/dataset/9ac1737f-cd33-4458-86e8-aec90eeffda2/resource/de3bca8b-f522-46ba-b4d2-e1c52034fcc0/download/syc_adm_nbs2010_shp.zip"
url_cod_meta <- "https://data.humdata.org/api/3/action/package_show?id=cod-ab-syc"

path_report <- file.path(raw_dir, "sc_2022_census_report.pdf")
path_terms <- file.path(raw_dir, "nbs_terms_verbatim.txt")
boundary_zip <- file.path(raw_dir, "syc_adm_nbs2010_SHP.zip")
boundary_meta_path <- file.path(raw_dir, "hdx_cod_ab_syc.json")

boundary_out <- file.path(product_dir, "sc_district_2020.geojson")
summary_json_out <- file.path(product_dir, "area_summary_district.json")
summary_csv_out <- file.path(product_dir, "area_summary_district.csv")
manifest_out <- file.path(manifest_dir, "sc-census-religion-2022.json")

# ---- 2022 Table B4.1 (integer counts; 8-category frame) ------------------------
# verbatim source category order (Table B4.1). the first five are clearly-religious
# affiliations; "Unable to classify" and "Missing" are non-response residuals; "Other
# (Specify)" mixes minority religions (Baha'i, Buddhist) with the non-religious per the
# printed note, so it is a disclosed residual, not part of the affiliation numerator.
cat_2022 <- c("Catholic", "Anglican", "Islam", "Hindu", "Christian (Other)",
              "Unable to classify", "Other (Specify)", "Missing")
# the five categories that make up the religious-affiliation numerator.
affiliation_cats <- c("Catholic", "Anglican", "Islam", "Hindu", "Christian (Other)")

# per-district Both-population counts in cat_2022 order (verbatim from Table B4.1, all
# households). the 26 directly-joined districts (25 granite + La Digue).
district_counts <- list(
  `English River`      = c(2355,214,74,124,372,13,188,168),
  `Mont Buxton`        = c(1964,144,116,47,244,12,113,138),
  `Saint Louis`        = c(1873,282,145,205,194,15,176,377),
  `Bel Air`            = c(1528,236,68,136,209,29,156,257),
  `Mont Fleuri`        = c(2033,149,113,150,224,22,180,635),
  `Plaisance`          = c(2512,161,90,125,301,3,180,313),
  `Roche Caiman`       = c(1554,160,113,242,296,12,160,620),
  `Les Mamelles`       = c(1492,123,73,41,194,9,82,201),
  `Ile Perseverance`   = c(3458,232,133,13,612,27,213,722),
  `Cascade`            = c(2951,94,193,1337,272,80,157,1575),
  `Pointe Larue`       = c(2373,115,71,104,296,8,123,177),
  `Anse Aux Pins`      = c(2792,121,68,91,372,20,168,266),
  `Anse Royale`        = c(3067,237,107,146,536,35,253,171),
  `Takamaka`           = c(2306,49,57,330,265,13,133,375),
  `Au Cap`             = c(3206,292,87,221,634,27,232,469),
  `Baie Lazare`        = c(2838,68,155,75,305,41,239,544),
  `Anse Boileau`       = c(2961,121,52,77,440,26,211,707),
  `Grand Anse Mahé`    = c(2336,144,98,131,267,12,199,238),
  `Port Glaud`         = c(1788,63,63,20,217,12,178,432),
  `Belombre`           = c(2370,304,108,126,305,20,226,364),
  `Beau Vallon`        = c(2854,202,70,158,383,35,313,725),
  `Glacis`             = c(2673,166,126,71,268,53,213,233),
  `Anse Etoile`        = c(3489,349,163,442,425,33,334,242),
  `Baie Ste Anne`      = c(2383,319,39,122,451,44,380,534),
  `Grand Anse Praslin` = c(1703,772,53,85,394,15,188,400),
  `La Digue`           = c(1989,62,58,159,318,31,232,284)
)

# the two region roll-ups the "Other Islands" district is derived from (verbatim).
la_digue_inner_rollup <- c(2050,62,63,182,329,33,244,661)   # total 3,624
outer_islands_rollup  <- c(43,1,0,707,5,0,4,228)            # total 988
# COD "Other Islands" district = Outer Islands roll-up + (La Digue & Inner Islands
# roll-up minus the La Digue leaf) = the exact aggregate of every island leaf except
# La Digue. an exact partition of published leaves to the official district frame.
other_islands <- outer_islands_rollup +
  (la_digue_inner_rollup - district_counts[["La Digue"]])   # total 1,479
district_counts[["Other Islands"]] <- other_islands

# printed national control totals (Table B4.1 Seychelles row).
total_2022_cat <- setNames(c(62952L,5180L,2498L,5508L,8810L,649L,5243L,11772L), cat_2022)
national_2022 <- 102612L

# crosswalk: census display label -> COD ADM3_EN (boundary canonical name). all
# identical except the four noted; "Other Islands" is identical in both.
census_to_cod <- c(
  `English River` = "English River", `Mont Buxton` = "Mont Buxton",
  `Saint Louis` = "Saint Louis", `Bel Air` = "Bel Air", `Mont Fleuri` = "Mont Fleuri",
  `Plaisance` = "Plaisance", `Roche Caiman` = "Roche Caiman", `Les Mamelles` = "Les Mamelles",
  `Ile Perseverance` = "Perseverance Island", `Cascade` = "Cascade",
  `Pointe Larue` = "Pointe Larue", `Anse Aux Pins` = "Anse Aux Pins",
  `Anse Royale` = "Anse Royale", `Takamaka` = "Takamaka", `Au Cap` = "Au Cap",
  `Baie Lazare` = "Baie Lazare", `Anse Boileau` = "Anse Boileau",
  `Grand Anse Mahé` = "Grand Anse Mahe", `Port Glaud` = "Port Glaud",
  `Belombre` = "Belombre", `Beau Vallon` = "Beau Vallon", `Glacis` = "Glacis",
  `Anse Etoile` = "Anse Etoile", `Baie Ste Anne` = "Baie Sainte Anne",
  `Grand Anse Praslin` = "Grand Anse Praslin", `La Digue` = "La Digue",
  `Other Islands` = "Other Islands"
)
census_names <- names(census_to_cod)

# assemble the per-category matrix (category -> named census-district vector).
m2022 <- setNames(lapply(seq_along(cat_2022), function(i) {
  setNames(as.integer(vapply(census_names, function(d) district_counts[[d]][[i]], numeric(1))), census_names)
}), cat_2022)

# ---- reconciliation gate (fail-fast; stop, do not tune) -------------------------
# integer wave: every district row (its 8 categories) sums to the district total; the
# 27-district partition sums, per category, to the printed national category total;
# and the grand total closes to 102,612. any nonzero deviation stops the build.
reconcile_wave <- function(mat, cats, national, cat_totals) {
  records <- list()
  district_total <- setNames(integer(length(census_names)), census_names)
  for (d in census_names) {
    row_sum <- sum(vapply(cats, function(c) mat[[c]][[d]], numeric(1)))
    district_total[[d]] <- as.integer(row_sum)
    records[[length(records) + 1L]] <- data.frame(
      margin = "district_row", key = d, computed = as.integer(row_sum),
      stringsAsFactors = FALSE)
  }
  for (c in cats) {
    col_sum <- sum(mat[[c]])
    if (col_sum != cat_totals[[c]]) {
      stop(sprintf("2022 religion-row gate FAILED for %s: 27-district sum %d != printed national %d",
                   c, as.integer(col_sum), cat_totals[[c]]), call. = FALSE)
    }
    records[[length(records) + 1L]] <- data.frame(
      margin = "religion_column", key = c, computed = as.integer(col_sum),
      stringsAsFactors = FALSE)
  }
  if (sum(district_total) != national) {
    stop(sprintf("2022 grand gate FAILED: district-total sum %d != printed national %d",
                 as.integer(sum(district_total)), national), call. = FALSE)
  }
  if (sum(cat_totals) != national) {
    stop(sprintf("2022 category-total gate FAILED: category-total sum %d != printed national %d",
                 as.integer(sum(cat_totals)), national), call. = FALSE)
  }
  list(records = do.call(rbind, records), district_total = district_total)
}

rec_2022 <- reconcile_wave(m2022, cat_2022, national_2022, total_2022_cat)
district_total <- rec_2022[["district_total"]]
message(sprintf("gate 2022: PASSED (integer-exact; 27 districts close to %d)", national_2022))

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
district_slug <- function(name) {
  s <- tolower(name)
  s <- gsub("[éè]", "e", s)
  s <- gsub("[^a-z0-9]+", "_", s)
  gsub("^_|_$", "", s)
}

required_inputs <- c(path_report, boundary_zip, boundary_meta_path)
invisible(lapply(required_inputs, require_file))

# confirm the pinned COD-AB licence and source before use.
boundary_metadata <- fromJSON(boundary_meta_path, simplifyVector = FALSE)[["result"]]
boundary_licence <- boundary_metadata[["license_title"]]
if (!identical(boundary_licence, "Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO)") ||
    !identical(boundary_metadata[["dataset_source"]], "Seychelles National Bureau of Statistics")) {
  stop("COD-AB SYC licence or source metadata changed", call. = FALSE)
}

# read the ADM3 district layer directly from the cached shapefile zip (reproducible).
adm3_vsizip <- paste0("/vsizip/", normalizePath(boundary_zip), "/syc_admbnda_adm3_nbs2010.shp")

# Seychelles-centred equal-area projection for land areas (compact granite core plus
# far-flung outer coral islands; a single laea centred on Mahé suffices for areas).
sc_laea <- "+proj=laea +lat_0=-4.6 +lon_0=55.5 +datum=WGS84 +units=m +no_defs"

# join the 27 census districts one-to-one to the COD ADM3 features via the crosswalk.
build_boundary <- function(vsizip_path) {
  boundary <- st_make_valid(st_read(vsizip_path, quiet = TRUE, stringsAsFactors = FALSE))
  if (nrow(boundary) != 27L) stop("COD-AB SYC ADM3 feature count is not 27", call. = FALSE)
  target_cod <- unname(census_to_cod[census_names])
  idx <- match(target_cod, boundary[["ADM3_EN"]])
  if (anyNA(idx) || anyDuplicated(idx) || !setequal(idx, seq_len(27L))) {
    stop("census districts and COD ADM3 features do not join one-to-one", call. = FALSE)
  }
  boundary <- boundary[idx, ]
  boundary[["area_name"]] <- unname(census_to_cod[census_names])
  boundary[["census_label"]] <- census_names
  boundary[["area_code"]] <- boundary[["ADM3_PCODE"]]
  boundary[["area_unit_id"]] <- paste(boundary_set_id, boundary[["ADM3_PCODE"]], sep = ":")
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- boundary_level
  boundary[["boundary_vintage"]] <- boundary_vintage
  boundary[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(boundary, sc_laea))) / 1e6
  boundary <- st_transform(st_make_valid(boundary), 4326)
  boundary[c("area_code", "area_name", "census_label", "area_unit_id",
             "boundary_set_id", "boundary_level", "boundary_vintage",
             "land_area_sq_km", "geometry")]
}

boundary <- build_boundary(adm3_vsizip)

# full-extent gate: Seychelles spans lon ~46.2 to 56.3E (outer coral islands) and lat
# ~-10.2 to -3.7N; wholly east of the prime meridian and far from the antimeridian.
bbox <- st_bbox(boundary)
if (bbox[["xmin"]] < 45.5 || bbox[["xmin"]] > 47.5 ||
    bbox[["xmax"]] < 55.5 || bbox[["xmax"]] > 57.0 ||
    bbox[["ymin"]] < -11.0 || bbox[["ymin"]] > -9.5 ||
    bbox[["ymax"]] < -4.5 || bbox[["ymax"]] > -3.0) {
  stop("boundary bbox does not match the expected Seychelles extent", call. = FALSE)
}

simplification <- mapshaper_simplify_to_cap(
  boundary, boundary_out,
  max_bytes = 1500000L,
  keep_percentages = c(100, 75, 50, 30, 20, 10, 5, 2),
  clean_option = "allow-overlaps"
)
written <- st_read(boundary_out, quiet = TRUE, stringsAsFactors = FALSE)
written <- written[match(boundary[["area_code"]], written[["area_code"]]), ]
if (anyNA(written[["area_code"]])) stop("simplified boundary lost an area code", call. = FALSE)
if (nrow(written) != 27L) stop("simplified boundary does not contain 27 features", call. = FALSE)
w_valid <- st_is_valid(written)
if (any(st_is_empty(written)) || any(is.na(w_valid)) || any(!w_valid)) {
  stop("simplified boundary has empty or invalid geometries", call. = FALSE)
}
geom_hashes <- geometry_hashes(written)
if (length(unique(geom_hashes)) != 27L) stop("simplified boundary geometry hashes are not distinct", call. = FALSE)
message(sprintf("boundary: PASSED (27 valid distinct features, %d bytes at %g%% keep)",
                file_bytes(boundary_out), simplification[["keep_percent"]]))

land_area <- setNames(round(written[["land_area_sq_km"]], 4), written[["census_label"]])
area_unit <- setNames(written[["area_unit_id"]], written[["census_label"]])
area_code <- setNames(written[["area_code"]], written[["census_label"]])
area_name <- setNames(written[["area_name"]], written[["census_label"]])

# ---- product rows --------------------------------------------------------------
# slot design (extended two-slot). religious_affiliation is the sum of the five
# clearly-religious categories (Catholic, Anglican, Islam, Hindu, Christian (Other)).
# no_religion is NULL: the 2022 table publishes no standalone No-religion line (the
# non-religious are folded into "Other (Specify)"). Other (Specify), Unable to classify
# and Missing stay in the denominator and in neither slot, so the affiliation share is
# below 100 by construction. counts are integer.

flag_common <- paste(
  "census_affiliation", "all_households_universe", "single_select_reported_religion",
  "religious_affiliation_percent_is_five_named_religions_share",
  "no_religion_not_separately_tabulated_folded_into_other_specify",
  "other_specify_unable_to_classify_missing_are_disclosed_residuals",
  "affiliation_share_below_100_by_construction",
  "single_wave_2022_district_product",
  "denominator_is_all_households_population_102612",
  "licence_needs_review_nbs_all_rights_reserved_prior_consent_build_then_ask",
  "boundary_cc_by_igo_ocha_cod_ab_nbs",
  sep = ";")
flag_2022 <- paste(
  "frame_2022_eight_category_integer_counts",
  "affiliation=Catholic+Anglican+Islam+Hindu+Christian(Other)",
  "no_religion_line=absent(null)",
  "table_3_2_vs_b4_1_discrepancy=5_persons_christian_other_vs_unable_to_classify",
  flag_common, sep = ";")

basis_2022 <- paste(
  "Seychelles Population and Housing Census 2022, Table B4.1 'Population in all",
  "households by religion and region/district' (integer counts). The denominator is the",
  "district all-households population. Religious affiliation is the sum of the five",
  "clearly-religious categories; no standalone No-religion line is published.")

# build one schema-shaped area-summary row, carrying the verbatim per-district
# category breakdown on the quality flag (source_categories_verbatim pattern).
make_row <- function(d) {
  cat_vec <- setNames(vapply(cat_2022, function(c) as.integer(m2022[[c]][[d]]), integer(1)), cat_2022)
  pop <- as.integer(district_total[[d]])
  affiliation <- as.integer(sum(cat_vec[affiliation_cats]))
  aff_pct <- round(100 * affiliation / pop, 4)
  breakdown <- paste(vapply(cat_2022, function(c) paste0(c, "=", cat_vec[[c]]), character(1)),
                     collapse = ";")
  full_flag <- paste0(flag_2022, ";source_categories_verbatim=", breakdown)
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = unname(area_unit[[d]]),
    area_code = unname(area_code[[d]]),
    area_name = unname(area_name[[d]]),
    year = 2022L,
    population_total = pop,
    population_total_basis = basis_2022,
    religious_affiliation_count = affiliation,
    religious_affiliation_percent = aff_pct,
    no_religion_count = NULL,
    no_religion_percent = NULL,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = unname(land_area[[d]]),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(d2022, d_boundary),
    quality_flag = full_flag
  )
}

rows <- lapply(census_names, make_row)

# ---- area-summary document -----------------------------------------------------

licence_needs_review_text <- paste(
  "The Seychelles National Bureau of Statistics (NBS) Terms and Conditions",
  "(nbs.gov.sc/terms-and-conditions) state: 'You may reproduce short extracts from the",
  "content appearing on the site provided that the source is stated and prior written",
  "consent is obtained from the NBS' and 'All rights not expressly granted are",
  "reserved.' The website footer reads 'Copyright (c) 2026 National Bureau of Statistics",
  "Seychelles. All Rights Reserved.' Under the standing build-then-ask ruling the derived",
  "aggregate summaries ship staged with NBS attribution while a reuse confirmation is",
  "sought (courtesy ask to ceo@nbs.gov.sc, not sent). Licence status: needs_review. The",
  "boundary is the OCHA COD-AB, sourced from NBS, licensed CC BY-IGO (accepted).")

nbs_attribution <- paste(
  "Source: Seychelles National Bureau of Statistics, Population and Housing Census 2022",
  "(Table B4.1). Derived district religion shares; contains NBS information reproduced",
  "with attribution pending reuse confirmation.")
cod_attribution <- "Administrative boundaries: OCHA COD-AB, source Seychelles National Bureau of Statistics (CC BY-IGO)."

source_datasets <- function() {
  list(
    list(
      source_dataset_id = d2022,
      name = "Seychelles Population and Housing Census 2022, Table B4.1: Population in all households by religion and region/district",
      provider = "Seychelles National Bureau of Statistics (NBS)",
      url = url_report, retrieval_date = retrieval_date, local_path = path_report,
      licence = list(name = licence_needs_review_text, url = url_terms, attribution = nbs_attribution),
      citation = "Seychelles National Bureau of Statistics, Population and Housing Census 2022, Table B4.1.",
      access_limits = "The nbs.gov.sc /downloads component WAF-blocks scripted retrieval; the report was cached from a byte-faithful Internet Archive snapshot.",
      redistribution_limits = "Derived district religion summaries ship staged with NBS attribution under build-then-ask; the raw census PDF is not committed. NBS Terms require prior written consent for reproduction of site content (needs_review).",
      notes = paste("Integer counts; 8-category frame; all-households universe (national 102,612). The 27-district",
                    "partition closes exactly at every margin. There is no standalone No-religion line (folded into",
                    "'Other (Specify)'). A 5-person Table 3.2 vs Table B4.1 split discrepancy (Christian (Other) /",
                    "Unable to classify) is documented; the build renders Table B4.1 verbatim.")),
    list(
      source_dataset_id = d_boundary,
      name = "OCHA COD-AB Seychelles, admin level 3 (27 districts)",
      provider = "OCHA (HDX); source Seychelles National Bureau of Statistics; vetted by ITOS",
      url = url_cod_page, retrieval_date = retrieval_date, local_path = boundary_zip,
      licence = list(name = boundary_licence, url = url_cod_page, attribution = cod_attribution),
      citation = "OCHA COD-AB Seychelles (cod-ab-syc), syc_admbnda_adm3_nbs2010, 27 districts.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary is committed under CC BY-IGO (attribution to OCHA / Seychelles NBS).",
      notes = paste("27 ADM3 districts sourced from NBS, including Perseverance Island. The 25 granite districts and",
                    "La Digue join the census one-to-one; the single 'Other Islands' district takes the exact aggregate",
                    "of the census inner-island (except La Digue) and outer-island leaves. Extent lon 46.20-56.29E,",
                    "lat -10.21 to -3.71N; far from the antimeridian, no dateline handling needed."))
  )
}

indicators <- function() {
  denom_note <- paste(
    "Percentages use each district's all-households population Total. Other (Specify),",
    "Unable to classify, and Missing stay in the denominator and outside the affiliation",
    "numerator, so the affiliation share is below 100% by construction.")
  list(
    list(indicator_id = "population_total", label = "Census population total",
         description = "District all-households population represented in the 2022 religion table.",
         unit = "count", denominator_indicator_id = NULL,
         method = "Sum of the eight printed religion categories per district (Table B4.1, all households).",
         temporal_coverage = "2022", spatial_coverage = "Seychelles districts (27)",
         quality_notes = "Religion is asked of the whole resident population (no age restriction). The denominator is the all-households population (national 102,612), matching the census total population and the Table 3.2 religion total."),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
         description = "Share of the district population reporting one of the five clearly-religious categories (Catholic, Anglican, Islam, Hindu, Christian (Other)).",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (Catholic + Anglican + Islam + Hindu + Christian (Other)) / population.",
         temporal_coverage = "2022", spatial_coverage = "Seychelles districts (27)",
         quality_notes = paste("Single wave (2022): religion is cross-tabulated by district only in the 2022 census. National religion is published for 2010 and 2022 (Table 3.2); 2010 district religion is unconfirmed and 2002/1994 religion is not in retrieved products.", denom_note)),
    list(indicator_id = "no_religion_percent", label = "No religious affiliation %",
         description = "Not separately tabulated in the 2022 census; null.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "Null. The 2022 report publishes no standalone No-religion line; the questionnaire's No-religion/Atheist responses are folded into 'Other (Specify)' (with Baha'i and Buddhist).",
         temporal_coverage = "2022", spatial_coverage = "Seychelles districts (27)",
         quality_notes = "No-religion is null and disclosed, never derived from 'Other (Specify)'. A genuine no-religion share would require an NBS data request for the unfolded tabulation.")
  )
}

visual_layers <- function() {
  list(
    list(visual_layer_id = "sc-district-religious-affiliation", label = "Religious affiliation %",
         description = "Seychelles census-affiliation share by district (2022).", layer_type = "choropleth",
         indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "district all-households population, incl. disclosed residuals"),
         colour_scale = "sequential", time_control = "none",
         aggregation_rule = "reported district value; Other Islands is the exact island-leaf aggregate", uncertainty_display = "quality_flag",
         default_visibility = TRUE,
         notes = "Census affiliation (five clearly-religious categories), not practice, attendance, or membership. Single wave (2022). No standalone no-religion share is published.")
  )
}

summary_product <- list(
  schema_version = "area-summary.v1", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code,
                      level = boundary_level, vintage = boundary_vintage, source_dataset_id = d_boundary),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "No governed place-of-worship snapshot ships in the Seychelles census product.",
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
      no_religion_count = NA_integer_, no_religion_percent = NA_real_,
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
       raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/sc_census/"))
}

durable_file_record <- function(path, content, licence_status_value, licence_basis_value) {
  list(uri = paste0("repo:", path), storage_provider = "git_repository", format = sub("^.*\\.", "", path),
       bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = if (grepl("area_summary|\\.csv$", path)) row_count_file(path) else NULL,
       feature_count = if (grepl("\\.geojson$", path)) row_count_file(path) else NULL,
       content = content, privacy = "public",
       licence_status = licence_status_value, licence_basis = licence_basis_value)
}

licence_basis_slug <- "nbs_all_rights_reserved_prior_consent"

raw_sources <- list(
  raw_source_record(path_report, url_report_archive, "pdf", TRUE, "2022", d2022,
    "2022 Census report (Internet Archive snapshot); Table B4.1 religion by district (integer counts, all households). 27-district partition closes to 102,612."),
  raw_source_record(path_terms, url_terms, "text", FALSE, "2026", d2022,
    "NBS Terms and Conditions (verbatim): prior written consent required to reproduce content; all rights reserved."),
  raw_source_record(boundary_zip, url_cod_shp, "shapefile-zip", TRUE, "2020", d_boundary,
    "OCHA COD-AB SYC shapefile zip; ADM3 (27 districts) from NBS, CC BY-IGO. Includes Perseverance Island."),
  raw_source_record(boundary_meta_path, url_cod_meta, "json", FALSE, "2020", d_boundary,
    "OCHA COD-AB SYC HDX metadata; records CC BY-IGO and dataset_source Seychelles National Bureau of Statistics.")
)

dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)
dataset_id <- "sc-census-religion:sc:2022:nbs-district"

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = paste0("manifest:", dataset_id),
  dataset_id = dataset_id,
  dataset_version_id = paste0(dataset_id, ":", dataset_hash),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "sc-census-religion", dataset_role = "staged_evidence",
  scope = list(level = "country", country_codes = list("SC"), snapshot_date = NULL,
               snapshot_anchor = NULL, pipeline_stage = "staged"),
  created_at = stamp, created_by = script_id,
  target_years = list(2022L),
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation",
      shipped_waves = list(2022L),
      shipped_geography = "27 Seychelles districts on OCHA COD-AB NBS ADM3 (23 Mahé + 2 Praslin + La Digue + Other Islands)",
      boundary_set = boundary_set_id,
      source_tables = list(
        `2022` = "2022 Census Table B4.1 Population in all households by religion and region/district (integer counts, 8 categories)"
      ),
      universes = list(
        `2022` = "all-households population, all persons, all ages (national 102,612); matches the census total population and the Table 3.2 religion total. Table B4.2 (conventional households, 89,273) is a documented sub-universe, not shipped."
      ),
      method_note = paste(
        "The 2022 religion cross-tab (Table B4.1) is integer counts by district. Every cell is transcribed verbatim.",
        "The 25 granite districts and the La Digue leaf join the 27 COD ADM3 districts one-to-one; the single official",
        "'Other Islands' district takes the exact aggregate of the census inner-island (except La Digue) and outer-island",
        "leaves (Outer Islands 988 + (La Digue & Inner Islands 3,624 - La Digue 3,133) = 1,479). Every value summed is a",
        "published census leaf; the aggregation is an exact partition to the official district frame, never a redistribution."
      ),
      denominators = list(
        `2022` = "district all-households population Total; affiliation = Catholic + Anglican + Islam + Hindu + Christian (Other)"
      ),
      slot_design = paste(
        "Extended two-slot. religious_affiliation_percent is the share reporting one of the five clearly-religious",
        "categories (Catholic, Anglican, Islam, Hindu, Christian (Other)). no_religion_percent is NULL: the 2022 report",
        "publishes no standalone No-religion line (the questionnaire's No-religion/Atheist responses are folded into",
        "'Other (Specify)', which the printed note says includes Baha'i, Buddhist, non-religious). Other (Specify),",
        "Unable to classify and Missing stay in the denominator and in neither slot, so the affiliation share is below",
        "100 by construction. No minority-share (task-6) treatment is needed (affiliation is a genuine share, not a",
        "flat-100 frame), but the absent no-religion line is disclosed."
      ),
      category_frames = list(
        `2022` = as.list(cat_2022),
        affiliation_categories = as.list(affiliation_cats),
        alignment_note = paste(
          "Single-wave product: religion is cross-tabulated by district only in the 2022 census (Table B4.1). National",
          "religion is published for 2010 and 2022 (Table 3.2, categories Catholic, Anglican, Islam, Hindu, Christian",
          "(other), Other, Unable to classify, Not specified/missing). 2010 district religion is unconfirmed and would",
          "sit on a pre-Perseverance-Island frame; 2002/1994 religion is in no retrieved product. The 2022 frame is",
          "preserved verbatim."
        )
      ),
      documented_discrepancy = paste(
        "A 5-person discrepancy between Table 3.2 (national) and Table B4.1 (district): Table 3.2 prints Christian",
        "(other) 8,805 and Unable to classify 654; Table B4.1 prints 8,810 and 649. Both sum to 102,612; the split of",
        "the same 9,459 persons differs by 5. The build renders Table B4.1 (the district source) verbatim and documents",
        "the discrepancy (Saint Lucia / Côte d'Ivoire documented-discrepancy treatment)."
      ),
      change_rule = paste(
        "Single wave (2022): no cross-wave district change layer. National religion context exists for 2010 and 2022",
        "(Table 3.2 national totals), but the subnational (district) product is 2022-only."
      ),
      no_religion_treatment = list(
        `2022` = "no standalone No-religion line; folded into 'Other (Specify)' with Baha'i/Buddhist per the printed note. no_religion is null and disclosed, never derived."
      ),
      held_and_deferred = paste(
        "A 2010 district religion wave would require the 2010 census report (not retrieved) and a pre-Perseverance frame;",
        "2002 and 1994 religion appear in no retrieved product. National 2010 religion (Table 3.2) is deeper-history",
        "national context, not a district product. Table B4.2 (conventional households, 89,273) is a documented",
        "sub-universe. A genuine no-religion share and the historic district waves are NBS data requests (courtesy asks)."
      ),
      territorial_note = "Seychelles has no external territorial dispute affecting the district frame.",
      omitted_metrics = list("no_religion_percent", "places_per_10000_residents", "place_density_per_sq_km"),
      boundary_simplification = simplification,
      local_cache_hint = "All raw sources are cached under data/raw/sc_census/ and remain git-ignored.",
      retrieval_record = raw_sources
    ),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")), digest = as.character(packageVersion("digest")),
      mapshaper = "scripts/lib/simplify_boundary.R (npx mapshaper)"
    )
  ),
  source = list(
    provider = "Seychelles National Bureau of Statistics (NBS); OCHA COD-AB (source NBS)",
    source_dataset_ids = list(d2022, d_boundary),
    source_urls = list(url_report, url_report_archive, url_terms, url_cod_page, url_cod_shp, url_cod_meta),
    retrieved_at = stamp,
    licence = licence_needs_review_text,
    citation = "NBS Population and Housing Census 2022 Table B4.1; OCHA COD-AB SYC ADM3 (source NBS).",
    raw_redistribution = "The census PDF and the COD-AB shapefile zip are not committed; they remain in data/raw/sc_census/.",
    local_cache_hint = "data/raw/sc_census/ (git-ignored by .gitignore data/ rule)",
    raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/sc_census/"),
    licence_position = "needs_review: NBS all-rights-reserved with a prior-consent reproduction clause; derived summaries staged with attribution under build-then-ask. Boundary CC BY-IGO (accepted).",
    licence_todo = "PI ruling to extend the derived-summaries-with-attribution stance to NBS (CI/MONSTAT/DCS line), or an NBS reuse confirmation (ceo@nbs.gov.sc)."
  ),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = list(
    durable_file_record(summary_json_out, "Seychelles 27-district census-affiliation area summary for 2022.", "needs_review", licence_basis_slug),
    durable_file_record(summary_csv_out, "Flattened Seychelles 27-district census-affiliation rows for 2022.", "needs_review", licence_basis_slug),
    durable_file_record(boundary_out, "Simplified OCHA COD-AB SYC ADM3 27-district boundary GeoJSON.", "accepted", "cc_by_igo_ocha_cod_ab")
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id,
         notes = "27 districts x 1 wave = 27 rows; all-households universe; no standalone no-religion line (null)."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out), built_by = script_id,
         notes = "27 district features from OCHA COD-AB SYC ADM3, simplified with mapshaper weighted keep-shapes.")
  ),
  validation = list(
    status = "passed_with_warnings",
    commands = list(
      paste("Rscript", script_id),
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/sc/data/area_summary_district.json",
      "bash scripts/validate_manifests.sh"
    ),
    gate_2022 = list(status = "passed", grand_total_closes_to = national_2022,
                     district_row_checks = length(census_names), religion_column_checks = length(cat_2022),
                     records = lapply(seq_len(nrow(rec_2022[["records"]])), function(i) as.list(rec_2022[["records"]][i, ])),
                     national_category_totals = as.list(total_2022_cat),
                     other_islands_aggregate = as.list(setNames(as.integer(other_islands), cat_2022))),
    boundary_validation = list(status = "passed", feature_count = 27L,
                               distinct_geometry_hashes = length(unique(geom_hashes)),
                               bbox = list(xmin = unname(bbox[["xmin"]]), ymin = unname(bbox[["ymin"]]),
                                           xmax = unname(bbox[["xmax"]]), ymax = unname(bbox[["ymax"]])),
                               dateline_note = "extent lon 46.20 to 56.29E, lat -10.21 to -3.71N; far from the antimeridian, no dateline handling needed",
                               output_bytes = file_bytes(boundary_out), simplification = simplification,
                               licence = boundary_licence, adm_unit_count = 27L,
                               includes_perseverance_island = TRUE),
    join_coverage = list(matched_districts = 27L, expected_districts = 27L, unmatched_districts = list(), unused_boundary_features = list()),
    notes = paste(
      "2022 Table B4.1 closes integer-exact at every margin (national total 102,612). Boundary joins 27/27 to OCHA",
      "COD-AB SYC ADM3 (25 granite districts + La Digue direct; Other Islands as the exact island-leaf aggregate) with",
      "27 distinct geometry hashes."
    ),
    warnings = list(
      "STAGED product: no page, no hub link. The page and the single-wave-subnational display decision are the conductor's (parallel to Barbados/Guyana/Antigua).",
      "Licence needs_review: NBS Terms require prior written consent to reproduce content ('All rights not expressly granted are reserved'). Derived summaries ship staged with attribution under build-then-ask; the unblock is a PI ruling (CI/MONSTAT/DCS line) or an NBS reuse confirmation. The boundary is CC BY-IGO (accepted).",
      "No standalone No-religion line: the questionnaire collected No-religion/Atheist, but the published table folds the non-religious into 'Other (Specify)'. no_religion is null and disclosed, never derived.",
      "Single wave (2022): religion is cross-tabulated by district only in 2022. National religion is published for 2010 and 2022 (Table 3.2); 2010 district religion is unconfirmed, 2002/1994 religion is not in retrieved products.",
      "A 5-person Table 3.2 vs Table B4.1 discrepancy (Christian (Other) / Unable to classify) is documented; the build renders Table B4.1 verbatim.",
      "The 'Other Islands' district religion is the exact aggregate of the census inner-island (except La Digue) and outer-island leaf rows, matching the single official Other Islands administrative district."
    )
  ),
  construct_notes = list(
    "The construct is census affiliation: each resident's reported religion (questionnaire Q.01.11 'What is [Name's] religion?', single-select), asked of the whole resident population, not practice, attendance, or membership.",
    "The public product carries two headline fields per district: population total and religious affiliation percent. No-religion percent is null (not separately tabulated). Place-density metrics are null (no governed place-of-worship snapshot).",
    "Single wave (2022): religion is cross-tabulated by district only in the 2022 census (Table B4.1). National religion is published for 2010 and 2022 (Table 3.2); 2010 district religion is unconfirmed, and 2002/1994 religion is in no retrieved product.",
    "Slot design (extended two-slot): religious_affiliation_percent is the share reporting one of the five clearly-religious categories (Catholic, Anglican, Islam, Hindu, Christian (Other)). Other (Specify), Unable to classify and Missing stay in the denominator and in neither slot, so the affiliation share is below 100 by construction. There is no standalone No-religion line; no_religion is null and disclosed.",
    "The 27-district frame is the official OCHA COD-AB (source NBS), including Perseverance Island. The single 'Other Islands' district religion is the exact aggregate of the census's inner-island (except La Digue) and outer-island leaves; every value is a published census figure.",
    "Licence needs_review: NBS asserts all rights reserved and requires prior written consent to reproduce content. Under build-then-ask the derived aggregate summaries ship staged with NBS attribution; the boundary is CC BY-IGO (accepted)."
  ),
  deferred_sources = list(
    list(source_dataset_id = "sc-census-2022-table-3-2-national-religion-2010-2022", status = "deferred",
         url = url_report, local_path = path_report,
         notes = paste("2022 Census Table 3.2: national religion for 2010 (total 90,945) and 2022 (102,612). A deeper-history",
                       "national two-wave series, not a district product; documented as context.")),
    list(source_dataset_id = "sc-census-2022-table-b4-2-conventional-households", status = "deferred",
         url = url_report, local_path = path_report,
         notes = "Table B4.2: religion by district for conventional households only (89,273). A documented sub-universe, not the shipped all-households product."),
    list(source_dataset_id = "sc-census-2010-district-religion", status = "unverified_upstream",
         url = url_report, local_path = NULL,
         notes = "2010 district religion is unconfirmed (the 2010 report was not retrieved) and would sit on a pre-Perseverance-Island frame. An NBS data request or the 2010 report would be needed for a two-wave district product."),
    list(source_dataset_id = "sc-census-unfolded-no-religion", status = "not_published",
         url = url_report, local_path = NULL,
         notes = "The questionnaire collected No-religion/Atheist but the published table folds them into 'Other (Specify)'. A genuine no-religion share is an NBS data request (courtesy ask)."),
    list(source_dataset_id = "nbs-reuse-confirmation", status = "not_pinned",
         url = "https://www.nbs.gov.sc/terms-and-conditions", local_path = NULL,
         notes = "NBS Terms require prior written consent for reproduction. A PI ruling (CI/MONSTAT/DCS line) or an NBS reuse confirmation (ceo@nbs.gov.sc) would move the census licence to accepted; recorded as a courtesy ask for the PI.")
  ),
  privacy = "public",
  licence_status = "needs_review",
  licence_basis = licence_basis_slug,
  downstream_status = "staged",
  source_datasets = source_datasets(),
  notes = paste(
    "STAGED product (no page, no hub link). The committed products are the derived 27-district area summary (27 rows",
    "for 2022) and the simplified OCHA COD-AB SYC ADM3 boundary. Census licence needs_review (NBS all-rights-reserved",
    "with a prior-consent clause; derived summaries ship staged with attribution under build-then-ask); boundary CC",
    "BY-IGO (accepted). Single-wave district product; the page decision is the conductor's, parallel to Barbados/Guyana."
  )
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

cat("wave shipped: 2022 on 27 Seychelles districts\n")
cat(sprintf("rows: %d (27 districts x 1 wave)\n", length(rows)))
cat(sprintf("gate 2022: passed integer-exact; 27-district partition closes to %d\n", national_2022))
cat(sprintf("boundary gate: passed; 27/27 join, %d distinct geometry hashes, %d bytes at %g%% keep\n",
            length(unique(geom_hashes)), file_bytes(boundary_out), simplification[["keep_percent"]]))
cat("licence gate: needs_review (NBS all-rights-reserved, prior consent); boundary CC BY-IGO accepted\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", boundary_out))
cat(sprintf("wrote %s\n", manifest_out))
