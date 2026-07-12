# build the Myanmar state/region census-religion area-summary product (STAGED, held
# for the PI's eyes on sensitivity — the Pakistan precedent, not a licence gate).
# see research/countries/mm/route-probe.md for full provenance and sha256.
#
# source of record: 2014 Myanmar Population and Housing Census, "The Union Report:
# Religion — Census Report Volume 2-C" (Department of Population, July 2016), Table 1
# "Number and percentage of persons by religion and State/Region for the enumerated
# population, and estimated non-enumerated population". 15 units (14 states/regions +
# Nay Pyi Taw Union Territory), 7 verbatim categories.
#
# TWO PRESENTATIONS, KEPT SEPARATE (never blended into one number):
#   Part I  (Table 1)  — ENUMERATED population counts by state/region and religion.
#                        This is the COUNT BASIS: every row's denominator is the
#                        printed ENUMERATED total, and affiliation/no-religion math
#                        uses only enumerated counts.
#   Part II (Figure 3 / Table 2 col "2014**") — the ESTIMATED-total presentation that
#                        includes the ~1.09M non-enumerated Rakhine population under the
#                        report's stated assumption that they are affiliated with Islam.
#                        The record publishes this ONLY at the Union level (national
#                        percentages, denominator 51,486,253). It is carried as disclosed
#                        national CONTEXT in the manifest, never as a state/region row and
#                        never blended into the enumerated denominators.
# Every row carries the estimated non-enumerated count as disclosed context; the three
# affected rows (Kachin, Kayin, Rakhine) carry the non-enumeration flag, and Rakhine
# additionally carries the report's own statement that the enumerated Rakhine and Union
# profile is inconclusive.
#
# outputs: apps/regions/mm/data/{area_summary_state_region.json, .csv,
#   mm_state_region_2014.geojson} and docs/manifests/mm-census-religion-2014.json.
# run from the repository root: Rscript scripts/build_mm_area_summary.R

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "MM"
script_id <- "scripts/build_mm_area_summary.R"
raw_dir <- "data/raw/mm_census"
product_dir <- "apps/regions/mm/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-12"
stamp <- paste0(retrieval_date, "T00:00:00Z")
git_commit <- tryCatch(trimws(system2("git", c("rev-parse", "--short", "HEAD"), stdout = TRUE)),
                       error = function(e) NULL)
if (length(git_commit) != 1L || !grepl("^[a-f0-9]{7,40}$", git_commit)) git_commit <- NULL

wave <- 2014L

# ---- dataset ids ---------------------------------------------------------------
d_census <- "mm-census-2014-union-report-2c-religion-table1-state-region"
d_boundary <- "ocha-codab-mmr-adm1-mimu"
boundary_set_id <- "mm-state-region-2014-ocha-codab-adm1"
licence_basis_slug <- "dop_bare_copyright_attribution_derived_rates"
boundary_licence_basis_slug <- "ocha_codab_cc_by_igo"

# ---- source urls and cached paths ----------------------------------------------
url_census <- "https://www.dop.gov.mm/sites/dop.gov.mm/files/publication_docs/union_2-c_religion_en_0.pdf"
url_census_unfpa <- "https://myanmar.unfpa.org/sites/default/files/pub-pdf/UNION_2C_Religion_EN.pdf"
url_boundary <- "https://data.humdata.org/dataset/3ac9b527-dff2-4b9f-a16e-476aa821896a/resource/d4a2319a-2917-4c90-acbf-70c1f62f7224/download/mmr_admin_boundaries.shp.zip"
url_boundary_meta <- "https://data.humdata.org/api/3/action/package_show?id=cod-ab-mmr"
url_dop_terms <- "https://www.dop.gov.mm/en"

path_census <- file.path(raw_dir, "union_2c_religion_en.pdf")
path_census_unfpa <- file.path(raw_dir, "unfpa_union_2c_religion_en.pdf")
path_boundary_zip <- file.path(raw_dir, "mmr_admin_boundaries.shp.zip")
path_boundary_shp <- file.path(raw_dir, "codab/mmr_admin1.shp")
path_boundary_meta <- file.path(raw_dir, "hdx_mmr.json")
path_dop_terms <- file.path(raw_dir, "dop_home.html")

geojson_out <- file.path(product_dir, "mm_state_region_2014.geojson")
summary_json_out <- file.path(product_dir, "area_summary_state_region.json")
summary_csv_out <- file.path(product_dir, "area_summary_state_region.csv")
manifest_out <- file.path(manifest_dir, "mm-census-religion-2014.json")

# ---- source-integrity: pinned sha256s from the route probe (hard gate) ---------
expected_sha256 <- c(
  "union_2c_religion_en.pdf"       = "f875d08da9dd5ecb8e6e202bfd8bd5f61a9c6a06f3c2f9c7897aebca345ca567",
  "unfpa_union_2c_religion_en.pdf" = "e959c13f5e4e6881610d88f3cfcb984f6ed4f9a73fc2127e884c7d717bba72cd",
  "mmr_admin_boundaries.shp.zip"   = "a208a057f3d5e475fd64eb67d306e900e010762a0db96f28f52f46b247c077bd",
  "hdx_mmr.json"                   = "47fd6cf7512364e5a6920fb9eb0af895f4351f7cc3851212977017119bf057e4"
)

# ---- verbatim category frame ---------------------------------------------------
# seven categories exactly as printed in Table 1 (and Table 2). English is the
# publication language; there is no translation step.
top_cats <- c("Buddhist", "Christian", "Islam", "Hindu", "Animist",
              "Other religion", "No religion")

# ---- 2014 enumerated presentation (Part I, Table 1) ----------------------------
# columns: total (enumerated), 7 categories, estimated non-enumerated population.
# transcribed verbatim from Table 1; "-" percentage cells in the source are display
# rounding only and do not affect these integer counts. dashes read as nil.
region <- c("Kachin", "Kayah", "Kayin", "Chin", "Sagaing", "Tanintharyi", "Bago",
            "Magway", "Mandalay", "Mon", "Rakhine", "Yangon", "Shan", "Ayeyawady",
            "Nay Pyi Taw")
slug <- c("kachin", "kayah", "kayin", "chin", "sagaing", "tanintharyi", "bago",
          "magway", "mandalay", "mon", "rakhine", "yangon", "shan", "ayeyawady",
          "nay_pyi_taw")
# census state/region -> dissolved COD-AB adm1_name (18 -> 15 units).
boundary_name <- c(
  Kachin = "Kachin", Kayah = "Kayah", Kayin = "Kayin", Chin = "Chin",
  Sagaing = "Sagaing", Tanintharyi = "Tanintharyi", Bago = "Bago",
  Magway = "Magway", Mandalay = "Mandalay", Mon = "Mon", Rakhine = "Rakhine",
  Yangon = "Yangon", Shan = "Shan", Ayeyawady = "Ayeyarwady",
  `Nay Pyi Taw` = "Nay Pyi Taw")

# one row per state/region: total, Buddhist, Christian, Islam, Hindu, Animist,
# Other religion, No religion, estimated non-enumerated.
m <- rbind(
  Kachin      = c(1642841, 1050610, 555037,  26789,   5738,   3972,    474,   221,   46600),
  Kayah       = c( 286627,  142896, 131237,   3197,    269,   5518,   3451,    59,       0),
  Kayin       = c(1504326, 1271766, 142875,  68459,   9585,   1340,  10194,   107,   69753),
  Chin        = c( 478801,   62079, 408730,    690,    106,   1830,   5292,    74,       0),
  Sagaing     = c(5325347, 4909960, 349377,  58987,   2793,     89,   2928,  1213,       0),
  Tanintharyi = c(1408401, 1231719, 100758,  72074,   2386,    576,    567,   321,       0),
  Bago        = c(4867373, 4550698, 142528,  56753, 100166,   4296,  12687,   245,       0),
  Magway      = c(3917055, 3870316,  27015,  12311,   2318,   3353,   1467,   275,       0),
  Mandalay    = c(6165723, 5898160,  65061, 187785,  11689,    188,   2301,   539,       0),
  Mon         = c(2054393, 1901667,  10791, 119086,  21076,    109,   1523,   141,       0),
  Rakhine     = c(2098807, 2019370,  36791,  28731,   9791,   2711,    759,   654, 1090000),
  Yangon      = c(7360703, 6697673, 232249, 345612,  75474,    512,   7260,  1923,       0),
  Shan        = c(5824432, 4755834, 569389,  58918,   5416, 383072,  27036, 24767,       0),
  Ayeyawady   = c(6184829, 5699665, 388348,  84073,   5440,    459,   6600,   244,       0),
  `Nay Pyi Taw` = c(1160242, 1123036,  12293,  24030,    516,     20,    286,    61,      0)
)
colnames(m) <- c("total", top_cats, "est_non_enumerated")

# printed Union control row (enumerated), and the estimated-total presentation anchors.
nat_enum <- c(total = 50279900, Buddhist = 45185449, Christian = 3172479,
              Islam = 1147495, Hindu = 252763, Animist = 408045,
              `Other religion` = 82825, `No religion` = 30844)
nat_est_non_enumerated <- 1206353L               # Kachin 46,600 + Kayin 69,753 + Rakhine 1,090,000
nat_estimated_overall <- 51486253L               # enumerated 50,279,900 + est. non-enumerated 1,206,353
# printed Union percentages, both presentations (Table 1 % and Table 2 cols 2014*/2014**).
nat_pct_enumerated <- c(Buddhist = 89.8, Christian = 6.3, Islam = 2.3, Hindu = 0.5,
                        Animist = 0.8, `Other religion` = 0.2, `No religion` = 0.1)
nat_pct_estimated <- c(Buddhist = 87.9, Christian = 6.2, Islam = 4.3, Hindu = 0.5,
                       Animist = 0.8, `Other religion` = 0.2, `No religion` = 0.1)
# the three states with a non-zero estimated non-enumerated population.
affected_states <- c("Kachin", "Kayin", "Rakhine")

# ---- reconciliation gates (fail-fast; stop, do not tune) -----------------------
# every state row's 7 categories sum to its printed ENUMERATED total; every category
# column sums to its printed Union total; the estimated non-enumerated column sums to
# the printed Union non-enumerated total; and enumerated + non-enumerated equals the
# printed estimated overall population. any deviation stops the build.
records <- list()
for (r in rownames(m)) {
  row_sum <- sum(m[r, top_cats])
  if (row_sum != m[r, "total"]) {
    stop(sprintf("row gate FAILED for %s: categories sum %d != printed enumerated total %d",
                 r, row_sum, m[r, "total"]), call. = FALSE)
  }
  records[[length(records) + 1L]] <- data.frame(
    margin = "state_row", key = r, computed = row_sum,
    printed = unname(m[r, "total"]), difference = 0L, stringsAsFactors = FALSE)
}
for (c in top_cats) {
  col_sum <- sum(m[, c])
  if (col_sum != nat_enum[[c]]) {
    stop(sprintf("column gate FAILED for %s: state sum %d != printed Union %d",
                 c, col_sum, nat_enum[[c]]), call. = FALSE)
  }
  records[[length(records) + 1L]] <- data.frame(
    margin = "religion_column", key = c, computed = col_sum,
    printed = unname(nat_enum[[c]]), difference = 0L, stringsAsFactors = FALSE)
}
if (sum(m[, "total"]) != nat_enum[["total"]]) {
  stop(sprintf("grand gate FAILED: state enumerated sum %d != printed Union %d",
               sum(m[, "total"]), nat_enum[["total"]]), call. = FALSE)
}
if (sum(nat_enum[top_cats]) != nat_enum[["total"]]) {
  stop("Union category-total gate FAILED", call. = FALSE)
}
if (sum(m[, "est_non_enumerated"]) != nat_est_non_enumerated) {
  stop(sprintf("non-enumerated gate FAILED: state sum %d != printed Union %d",
               sum(m[, "est_non_enumerated"]), nat_est_non_enumerated), call. = FALSE)
}
if (nat_enum[["total"]] + nat_est_non_enumerated != nat_estimated_overall) {
  stop("estimated-overall gate FAILED", call. = FALSE)
}
rec_df <- do.call(rbind, records)
message(sprintf("gate: PASSED (15 state rows + 7 religion columns close to enumerated Union %d; est. non-enumerated %d; estimated overall %d)",
                nat_enum[["total"]], nat_est_non_enumerated, nat_estimated_overall))

# soft cross-check: computed Union shares against the printed Table 1/Table 2 percentages.
share_crosscheck <- lapply(top_cats, function(c) {
  computed <- round(100 * nat_enum[[c]] / nat_enum[["total"]], 1)
  list(category = c, computed_enumerated_pct = computed,
       printed_enumerated_pct = unname(nat_pct_enumerated[[c]]),
       within_0_1pp = abs(computed - nat_pct_enumerated[[c]]) <= 0.1,
       printed_estimated_overall_pct = unname(nat_pct_estimated[[c]]))
})
names(share_crosscheck) <- top_cats

# ---- source integrity ----------------------------------------------------------
sha256_file <- function(path) unname(tools::sha256sum(path))
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))
for (fn in names(expected_sha256)) {
  p <- file.path(raw_dir, fn)
  if (!file.exists(p)) stop("missing cached raw input: ", p, call. = FALSE)
  got <- sha256_file(p)
  if (!identical(got, expected_sha256[[fn]])) {
    stop("sha256 mismatch for ", fn, ": expected ", expected_sha256[[fn]], " got ", got, call. = FALSE)
  }
}

# confirm the boundary licence from the HDX metadata before use.
bmeta <- fromJSON(path_boundary_meta, simplifyVector = FALSE)
if (!identical(bmeta[["result"]][["license_id"]], "cc-by-igo")) {
  stop("OCHA COD-AB MMR licence metadata changed (expected cc-by-igo)", call. = FALSE)
}

# ---- boundary: COD-AB ADM1 (18 units) dissolved to the 15-unit census frame -----
# Bago is split East/West and Shan is split East/North/South in the COD; the census
# frame uses whole Bago and whole Shan. dissolve those sub-units back into their single
# parent state by exact complete-unit partition (Kazakhstan reverse-fold precedent):
# the union of the child polygons equals the parent, so this is geometric, not an
# invented concordance. 18 - 1 (Bago) - 2 (Shan) = 15.
geometry_hashes <- function(layer) {
  vapply(seq_len(nrow(layer)), function(i) {
    digest(st_as_binary(st_geometry(layer)[i], EWKB = TRUE)[[1L]], algo = "sha256", serialize = FALSE)
  }, character(1))
}

cod <- st_make_valid(st_read(path_boundary_shp, quiet = TRUE, stringsAsFactors = FALSE))
if (nrow(cod) != 18L) stop("COD-AB MMR ADM1 feature count is not 18", call. = FALSE)
dissolve_map <- c(`Bago (East)` = "Bago", `Bago (West)` = "Bago",
                  `Shan (East)` = "Shan", `Shan (North)` = "Shan", `Shan (South)` = "Shan")
cod[["dissolve_name"]] <- ifelse(cod[["adm1_name"]] %in% names(dissolve_map),
                                 unname(dissolve_map[cod[["adm1_name"]]]), cod[["adm1_name"]])
cod_15 <- aggregate(cod["dissolve_name"], by = list(name = cod[["dissolve_name"]]),
                    FUN = function(x) x[1], do_union = TRUE)
cod_15 <- st_make_valid(cod_15)
if (nrow(cod_15) != 15L) stop("dissolved COD-AB frame is not 15 units", call. = FALSE)

# join census states to the dissolved boundary; require a one-to-one match.
target <- unname(boundary_name[region])
idx <- match(target, cod_15[["name"]])
if (anyNA(idx) || anyDuplicated(idx) || length(idx) != length(region)) {
  stop("census states and boundary features do not join one-to-one", call. = FALSE)
}
boundary <- cod_15[idx, ]
boundary[["area_name"]] <- region
boundary[["area_code"]] <- slug
boundary[["boundary_source_name"]] <- target
# Myanmar-centred equal-area projection for land areas.
mm_laea <- "+proj=laea +lat_0=21 +lon_0=96 +datum=WGS84 +units=m +no_defs"
boundary[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(boundary, mm_laea))) / 1e6
boundary <- st_transform(boundary, 4326)
boundary <- boundary[c("area_code", "area_name", "boundary_source_name",
                       "land_area_sq_km", "geometry")]

# simplify to a page-friendly cap; re-validate count + distinctness.
simplification <- mapshaper_simplify_to_cap(
  boundary, geojson_out, max_bytes = 900000L,
  keep_percentages = c(30, 20, 12, 8, 5, 3, 2),
  clean_option = "allow-overlaps")
written <- st_read(geojson_out, quiet = TRUE, stringsAsFactors = FALSE)
written <- written[match(boundary[["area_code"]], written[["area_code"]]), ]
if (anyNA(written[["area_code"]])) stop("simplified boundary lost an area code", call. = FALSE)
if (nrow(written) != 15L) stop("simplified boundary count is not 15", call. = FALSE)
w_valid <- st_is_valid(written)
if (any(st_is_empty(written)) || any(is.na(w_valid)) || any(!w_valid)) {
  stop("simplified boundary has empty or invalid geometries", call. = FALSE)
}
bhashes <- geometry_hashes(written)
if (length(unique(bhashes)) != 15L) stop("simplified geometry hashes not distinct", call. = FALSE)
land_area <- setNames(written[["land_area_sq_km"]], written[["area_name"]])
message(sprintf("boundary: PASSED (15 distinct features, %d bytes at %g%% keep)",
                file_bytes(geojson_out), simplification[["keep_percent"]]))

# ---- disclosure and description notes (render the record) ----------------------
# the census's own words on the non-enumeration, carried on every affected surface.
non_enumeration_note <- paste(
  "The 2014 Census enumerated 50,279,900 persons. An estimated 1,090,000 persons in",
  "Rakhine State, 69,753 in Kayin State and 46,600 in Kachin State were not enumerated",
  "(1,206,353 in total, 2.3 per cent of the estimated overall population of 51,486,253).",
  "This product's counts and shares are the ENUMERATED population only (Part I of the",
  "Census Report Volume 2-C). The estimated non-enumerated population is carried as",
  "disclosed context and is never added into any state/region count or share.")

rakhine_caveat <- paste(
  "The Department of Population states that the size of the non-enumerated population in",
  "Rakhine State is significant enough to affect the results on religion at both the",
  "Rakhine State and the Union level, and that the Part I (enumerated) results are",
  "\"inconclusive in terms of drawing a profile on the composition of religion in Rakhine",
  "State and at the Union level\". The report's Part II applies the assumption that the",
  "non-enumerated Rakhine population is mainly affiliated with the Islamic faith; under",
  "that assumption the Union-level share of Islam rises from 2.3 per cent (enumerated) to",
  "4.3 per cent (estimated overall). That Part II adjustment is a Union-level presentation",
  "in the record and is NOT distributed to any state/region row in this product.")

description_note <- paste(
  "This product renders the religion categories of the 2014 Myanmar Population and Housing",
  "Census exactly as the Department of Population prints them in \"The Union Report:",
  "Religion — Census Report Volume 2-C\" (July 2016), Table 1. The seven published",
  "categories are Buddhist, Christian, Islam, Hindu, Animist, Other religion, and No",
  "religion. The counts are the enumerated population by state/region; nothing is combined,",
  "reallocated, or estimated. The census presents two figures for the national religious",
  "composition and this product keeps them separate: an ENUMERATED presentation (Part I,",
  "denominator 50,279,900) shown here per state/region, and an ESTIMATED-total presentation",
  "(Part II, denominator 51,486,253) that adds the non-enumerated Rakhine population under",
  "the report's stated Islam assumption and that the record publishes only at the Union",
  "level. The two presentations are never blended.")
description_sentinel <- "The two presentations are never blended."

# the two-slot design tokens are the same on every row (ordinary two-slot, no residual).
flag_common <- paste(
  "census_affiliation", "enumerated_population_count_basis",
  "single_select_reported_religion",
  "religious_affiliation_percent_is_summed_affiliation_share_enumerated",
  "no_religion_percent_is_no_religion_category_enumerated",
  "seven_categories_sum_exactly_to_enumerated_total_no_residual",
  "estimated_non_enumerated_disclosed_context_never_blended",
  "estimated_total_presentation_union_level_only_see_manifest",
  "change_withhold_2014_vs_2024_frame_and_universe_break",
  "census_licence_bare_copyright_attribution_derived_rates_staged",
  sep = ";")

population_basis <- paste(
  "2014 Myanmar Census, Union Report Volume 2-C (Religion), Table 1: printed ENUMERATED",
  "state/region total. The denominator is the enumerated population.", non_enumeration_note)

# ---- build one schema-shaped row -----------------------------------------------
make_row <- function(rg) {
  pop <- as.integer(m[rg, "total"])
  no_rel <- as.integer(m[rg, "No religion"])
  affiliation <- pop - no_rel
  aff_pct <- round(100 * affiliation / pop, 4)
  no_pct <- round(100 * no_rel / pop, 4)
  non_enum <- as.integer(m[rg, "est_non_enumerated"])
  breakdown <- paste(paste0(top_cats, "=", m[rg, top_cats]), collapse = ";")
  affected <- rg %in% affected_states
  flag <- paste0(
    flag_common,
    ";estimated_non_enumerated=", non_enum,
    ";non_enumeration_affected=", tolower(as.character(affected)),
    ";source_categories_verbatim=", breakdown)
  if (affected) flag <- paste0(flag, ";non_enumeration_note=", non_enumeration_note)
  if (identical(rg, "Rakhine")) flag <- paste0(flag, ";rakhine_inconclusive_caveat=", rakhine_caveat)
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = "state_region",
    area_unit_id = paste(boundary_set_id, slug[[which(region == rg)]], sep = ":"),
    area_code = slug[[which(region == rg)]],
    area_name = rg,
    year = wave,
    population_total = pop,
    population_total_basis = if (affected) paste(population_basis, "This state/region has a non-enumerated population; see the disclosure.") else population_basis,
    religious_affiliation_count = as.integer(affiliation),
    religious_affiliation_percent = aff_pct,
    no_religion_count = no_rel,
    no_religion_percent = no_pct,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = unname(round(land_area[[rg]], 4)),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(d_census, d_boundary),
    quality_flag = flag
  )
}

rows <- lapply(region, make_row)

# gate: the two metric slots are exact complements in every row (7 categories, no
# residual, so affiliation + no-religion = 100 exactly on the enumerated denominator).
for (r in rows) {
  if (round(r[["religious_affiliation_percent"]] + r[["no_religion_percent"]], 4) != 100) {
    stop("metric slots not exact complements (percent) for ", r[["area_code"]], call. = FALSE)
  }
  if (r[["religious_affiliation_count"]] + r[["no_religion_count"]] != r[["population_total"]]) {
    stop("metric slots not exact complements (count) for ", r[["area_code"]], call. = FALSE)
  }
}

# ---- product declarations ------------------------------------------------------
temporal_cov <- "2014 Myanmar Population and Housing Census, Union Report Volume 2-C (Religion), Table 1."
spatial_cov <- "Fifteen units: fourteen States and Regions plus Nay Pyi Taw Union Territory, as printed in Table 1."
quality_cov <- paste(description_note, non_enumeration_note, rakhine_caveat)

census_licence_name <- paste(
  "No stated reuse terms. The 2014 Census Religion report (Department of Population,",
  "Census Report Volume 2-C) carries no reuse or copyright clause in the publication; the",
  "Department of Population website footer (www.dop.gov.mm, retrieved 2026-07-12) asserts",
  "only \"Department of Population © 2026\" with no reuse grant. The report is also",
  "mirrored openly by UNFPA Myanmar and the Myanmar Information Management Unit (MIMU).",
  "This build ships DERIVED state/region rates with attribution to the Department of",
  "Population, under the project's derived-summaries-with-attribution stance for",
  "bare-copyright sources; raw PDFs stay git-ignored. licence_status is needs_review and",
  "the product is held STAGED for sensitivity (see notes), not on the licence.")

source_datasets <- function() {
  list(
    list(
      source_dataset_id = d_census,
      name = "Myanmar 2014 Population and Housing Census, The Union Report: Religion — Census Report Volume 2-C, Table 1 (persons by religion and State/Region)",
      provider = "Department of Population, Ministry of Labour, Immigration and Population, Myanmar",
      url = url_census, retrieval_date = retrieval_date, local_path = path_census,
      licence = list(name = census_licence_name, url = url_dop_terms,
                     attribution = "Department of Population, Ministry of Labour, Immigration and Population, The 2014 Myanmar Population and Housing Census, The Union Report: Religion (Census Report Volume 2-C), July 2016"),
      citation = "Department of Population, The 2014 Myanmar Population and Housing Census, The Union Report: Religion, Census Report Volume 2-C, Table 1, Nay Pyi Taw, July 2016.",
      access_limits = "Open PDF download from the Department of Population; an identical mirror is published by UNFPA Myanmar (sha256 pinned in the manifest).",
      redistribution_limits = "No stated reuse terms; derived state/region rates ship with attribution under the derived-summaries-with-attribution stance. Raw PDFs stay git-ignored.",
      notes = paste("Table 1 gives the enumerated population by religion for 15 units plus an estimated non-enumerated column.", non_enumeration_note)),
    list(
      source_dataset_id = d_boundary,
      name = "OCHA COD-AB Myanmar Subnational Administrative Boundaries, ADM1 (source: Myanmar Information Management Unit), dissolved to the 15-unit census frame",
      provider = "OCHA Field Information Services Section (FISS); boundary source Myanmar Information Management Unit (MIMU)",
      url = url_boundary, retrieval_date = retrieval_date, local_path = path_boundary_zip,
      licence = list(name = "Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO)", url = url_boundary_meta,
                     attribution = "OCHA / MIMU, Myanmar Common Operational Dataset - Administrative Boundaries (CC BY-IGO)"),
      citation = "OCHA COD-AB Myanmar ADM1 (source: MIMU), dissolved from 18 to the 15-unit census State/Region frame.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary is committed under CC BY-IGO with attribution to OCHA/MIMU.",
      notes = "The COD ADM1 carries 18 units (Bago split East/West; Shan split East/North/South). Bago (East)+(West) and Shan (East)+(North)+(South) are dissolved into whole Bago and whole Shan by exact complete-unit partition, reconstructing the 15-unit census frame.")
  )
}

indicators <- function() {
  list(
    list(indicator_id = "population_total", label = "Census enumerated population",
         description = paste("Enumerated state/region population in the 2014 census religion table.", non_enumeration_note),
         unit = "count", denominator_indicator_id = NULL,
         method = "Printed enumerated total from Union Report Volume 2-C, Table 1.",
         temporal_coverage = temporal_cov, spatial_coverage = spatial_cov,
         quality_notes = quality_cov),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
         description = "Share of the enumerated population reporting affiliation with a named religion (Buddhist, Christian, Islam, Hindu, Animist, or Other religion).",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (enumerated population - No religion) / enumerated population. Denominator is the enumerated population only; the non-enumerated population is never blended in.",
         temporal_coverage = temporal_cov, spatial_coverage = spatial_cov,
         quality_notes = paste("The seven categories sum exactly to the enumerated total (no not-stated residual), so affiliation and No-religion shares sum to 100 on the enumerated denominator.", quality_cov)),
    list(indicator_id = "no_religion_percent", label = "No religion %",
         description = "Share of the enumerated population in the census \"No religion\" category.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (No religion) / enumerated population.",
         temporal_coverage = temporal_cov, spatial_coverage = spatial_cov,
         quality_notes = paste("\"No religion\" is a printed census category (0.1 per cent nationally).", quality_cov))
  )
}

visual_layers <- function() {
  list(
    list(visual_layer_id = "mm-state-region-religious-affiliation", label = "Religious affiliation %",
         description = "Myanmar 2014 census-affiliation share by state/region (enumerated population).",
         layer_type = "choropleth", indicator_ids = list("religious_affiliation_percent"),
         geometry_unit_type = "area_unit", legend = list(unit = "percent", denominator = "enumerated state/region population"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "reported state/region value; enumerated counts as published; no allocation",
         uncertainty_display = "quality_flag", default_visibility = TRUE,
         notes = paste(non_enumeration_note, rakhine_caveat)),
    list(visual_layer_id = "mm-state-region-no-religion", label = "No religion %",
         description = "Myanmar 2014 census No-religion share by state/region (enumerated population).",
         layer_type = "choropleth", indicator_ids = list("no_religion_percent"),
         geometry_unit_type = "area_unit", legend = list(unit = "percent", denominator = "enumerated state/region population"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "reported state/region value; enumerated counts as published; no allocation",
         uncertainty_display = "quality_flag", default_visibility = FALSE,
         notes = non_enumeration_note)
  )
}

# ---- write area-summary product ------------------------------------------------
summary_product <- list(
  schema_version = "area-summary.v1", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code,
                      level = "state_region",
                      vintage = "2014 census 15-unit State/Region frame (OCHA COD-AB ADM1 dissolved from 18)",
                      source_dataset_id = d_boundary),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "No governed Myanmar place-of-worship snapshot is included in this census-religion release.",
                       notes = "The product ships census-religion metrics and state/region geometry only; place-density fields are null."),
  source_datasets = source_datasets(), indicators = indicators(),
  visual_layers = visual_layers(), rows = rows
)
write_json(summary_product, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(summary_json_out, warn = FALSE), collapse = "\n"))) {
  stop("area-summary JSON is invalid", call. = FALSE)
}

# hard gate: the description note is present in the shipped product.
product_text <- paste(readLines(summary_json_out, warn = FALSE), collapse = "\n")
if (!grepl(description_sentinel, product_text, fixed = TRUE)) {
  stop("description note absent from the shipped product", call. = FALSE)
}

# ---- csv companion -------------------------------------------------------------
flatten_rows <- function(rows) {
  do.call(rbind, lapply(rows, function(r) {
    data.frame(
      country_code = r[["country_code"]], boundary_set_id = r[["boundary_set_id"]],
      boundary_level = r[["boundary_level"]], area_unit_id = r[["area_unit_id"]],
      area_code = r[["area_code"]], area_name = r[["area_name"]], year = r[["year"]],
      population_total = r[["population_total"]], population_total_basis = r[["population_total_basis"]],
      religious_affiliation_count = r[["religious_affiliation_count"]],
      religious_affiliation_percent = r[["religious_affiliation_percent"]],
      no_religion_count = r[["no_religion_count"]], no_religion_percent = r[["no_religion_percent"]],
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
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$", path)) return(length(fromJSON(path, simplifyVector = FALSE)[["features"]]))
  if (grepl("\\.json$", path)) return(length(fromJSON(path, simplifyVector = FALSE)[["rows"]]))
  NA_integer_
}
durable_file_record <- function(path, content, lic_basis) {
  list(uri = paste0("repo:", path), storage_provider = "git_repository", format = sub("^.*\\.", "", path),
       bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = if (grepl("area_summary|\\.csv$", path)) row_count_file(path) else NULL,
       feature_count = if (grepl("\\.geojson$", path)) row_count_file(path) else NULL,
       content = content, privacy = "public",
       licence_status = "needs_review", licence_basis = lic_basis)
}
raw_source_record <- function(path, url, format, used, dataset_id, notes) {
  list(uri = path, url = url, format = format, bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = NULL, source_dataset_id = dataset_id, used_in_public_product = used,
       periods = "2014", notes = notes,
       local_cache_hint = paste0(path, " (git-ignored by .gitignore data/ rule)"),
       raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/mm_census/"))
}
reconciliation_block <- function(rec) lapply(seq_len(nrow(rec)), function(i) as.list(rec[i, ]))

raw_sources <- list(
  raw_source_record(path_census, url_census, "pdf", TRUE, d_census,
    "2014 Census Union Report Volume 2-C (Religion), Department of Population, July 2016; Table 1 state/region religion. 17-page release; enumerated Union total 50,279,900."),
  raw_source_record(path_census_unfpa, url_census_unfpa, "pdf", FALSE, d_census,
    "UNFPA Myanmar mirror of the same report; Table 1 values byte-verified identical to the DoP file."),
  raw_source_record(path_boundary_zip, url_boundary, "shp_zip", TRUE, d_boundary,
    "OCHA COD-AB MMR shapefile (source MIMU, valid_on 2024-02-15, v01); ADM1 has 18 units, dissolved to the 15-unit census frame. CC BY-IGO."),
  raw_source_record(path_boundary_meta, url_boundary_meta, "json", FALSE, d_boundary,
    "HDX COD-AB MMR metadata; records license_id cc-by-igo, dataset_source 'Myanmar Information Management Unit (MIMU)', org OCHA FISS."),
  raw_source_record(path_dop_terms, url_dop_terms, "html", FALSE, d_census,
    "Department of Population website home page; footer asserts 'Department of Population © 2026' with no reuse clause (licence-vacuum evidence).")
)

deferred_sources <- list(
  list(source_dataset_id = "mm-census-2024-religion-by-state-region", status = "deferred",
       url = "https://www.dop.gov.mm/en/publication-category/2024-provisional-result",
       reason = paste("The 2024 Myanmar Population and Housing Census (conducted 1-15 October 2024 under the State",
                      "Administration Council military government) has released only provisional results so far.",
                      "The provisional-results report tabulates population by state/region and sex but publishes NO",
                      "religion breakdown by state/region; the only 2024 religion figures are national headlines",
                      "(reported Buddhist ~91.3%). The 2024 census enumerated 32,191,407 and estimated 19,125,349",
                      "(total 51,316,756) — substantial areas were not enumerated for security/access reasons, a",
                      "larger non-enumeration than 2014. Detailed 2024 results are announced for release before the",
                      "end of 2025. 2024 is a frame-and-universe break from 2014 (CHANGE-WITHHOLD); it is not built",
                      "or blended here, and any future 2024 wave ships on its own frame with the same render-the-record",
                      "and non-enumeration disclosure care.")),
  list(source_dataset_id = "mm-census-2014-religion-township", status = "deferred",
       url = url_census,
       reason = paste("Only the state/region cross-tab (Table 1) is published in Volume 2-C. Township-level religion",
                      "is not in this report, and the README flags that public mapping below state/region may be",
                      "inappropriate given conflict, displacement, and minority-safety conditions. No sub-state layer",
                      "is built.")),
  list(source_dataset_id = "mm-census-1973-1983-religion-subnational", status = "deferred",
       url = url_census,
       reason = "The 1973 and 1983 censuses are cited in Volume 2-C Table 2 at the Union level only (percentages by religion). No machine-readable subnational 1973/1983 religion table was recovered; a print route only.")
)

validation <- list(
  status = "passed",
  commands = list(
    "Rscript scripts/build_mm_area_summary.R",
    "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/mm/data/area_summary_state_region.json",
    "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/data-manifest.schema.json docs/manifests/mm-census-religion-2014.json",
    "bash scripts/validate_manifests.sh"
  ),
  gates = list(
    source_integrity_sha256 = "passed",
    row_category_sum_equals_enumerated_total = "passed (15/15)",
    religion_column_equals_union_total = "passed (7/7)",
    non_enumerated_column_sum = "passed (1,206,353)",
    enumerated_plus_non_enumerated_equals_estimated_overall = "passed (51,486,253)",
    metric_slots_exact_complement = "passed",
    presentations_not_blended = "passed (rows carry enumerated counts only; estimated-total presentation recorded as Union-level context)",
    boundary_15_units_distinct = "passed",
    description_note_in_product = grepl(description_sentinel, product_text, fixed = TRUE)
  ),
  both_margins_close_to_enumerated_union = unname(nat_enum[["total"]]),
  estimated_non_enumerated_union = nat_est_non_enumerated,
  estimated_overall_population = nat_estimated_overall,
  reconciliation = reconciliation_block(rec_df),
  union_share_crosscheck = share_crosscheck,
  boundary_validation = list(
    status = "passed", feature_count = 15L,
    distinct_geometry_hashes = length(unique(bhashes)),
    output_bytes = file_bytes(geojson_out),
    licence = bmeta[["result"]][["license_title"]],
    dissolve = "Bago (East)+(West) -> Bago; Shan (East)+(North)+(South) -> Shan; 18 -> 15"),
  notes = paste(
    "Every state row's 7 enumerated categories sum to its printed enumerated total; every religion",
    "column sums to the printed enumerated Union total (50,279,900). The estimated non-enumerated",
    "column sums to 1,206,353 and enumerated + non-enumerated = 51,486,253, both exactly as printed.",
    "The estimated-total presentation (Part II, Islam assumption, Union level) is recorded as context",
    "and never blended into a state/region row."),
  warnings = list(
    "SENSITIVITY HOLD: this product is STAGED and its page is held for the PI's eyes (the Pakistan sensitivity line), regardless of licence.",
    "Non-enumeration: ~1,090,000 persons in Rakhine (predominantly Rohingya Muslims), 69,753 in Kayin and 46,600 in Kachin were not enumerated; the enumerated Rakhine and Union religion profile is stated by the Department of Population to be inconclusive.",
    "Two presentations are kept strictly separate: enumerated counts (count basis) per state/region, and the estimated-total (with non-enumerated Rakhine assumed Islam) at Union level only.",
    "CHANGE-WITHHOLD: the 2024 census is a frame-and-universe break with no published state/region religion table; it is deferred, not blended.",
    "Census licence is a bare-copyright vacuum (DoP footer only); derived rates ship with attribution, licence_status needs_review."
  )
)

licence_note_verbatim <- "Department of Population © 2026"

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = "manifest:mm-census-religion:mm:2014:dop-state-region",
  dataset_id = "mm-census-religion:mm:2014:dop-state-region",
  dataset_version_id = paste0("mm-census-religion:mm:2014:dop-state-region:", substr(sha256_file(summary_json_out), 1L, 12L)),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "mm-census-religion", dataset_role = "public_product",
  scope = list(level = "country", country_codes = list("MM"), snapshot_date = NULL,
               snapshot_anchor = NULL, pipeline_stage = "staged"),
  created_at = stamp, created_by = script_id,
  target_years = list(2014L),
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census religion (seven-category self-identification, enumerated population)",
      shipped_waves = list(2014L),
      shipped_geography = "15 units: 14 States/Regions + Nay Pyi Taw Union Territory",
      boundary_set = boundary_set_id,
      source_table = "Union Report Volume 2-C (Religion), Table 1 (persons by religion and State/Region, enumerated population, and estimated non-enumerated population)",
      universe = "enumerated resident population, all ages (2014 Census Night 29 March 2014)",
      denominator = "printed enumerated state/region total; affiliation = enumerated total - No religion",
      slot_design = paste(
        "Ordinary two-slot (Kazakhstan/SB precedent; Myanmar has a real No-religion category, not the",
        "minority-share design). religious_affiliation_percent is the summed share of Buddhist + Christian +",
        "Islam + Hindu + Animist + Other religion on the enumerated denominator. no_religion_percent is the",
        "single No-religion category. The seven categories sum exactly to the enumerated total (no not-stated",
        "residual), so the two shares sum to 100."),
      category_frame_verbatim = as.list(top_cats),
      two_presentations = list(
        enumerated = list(scope = "state/region (shipped as rows)",
                          union_total = unname(nat_enum[["total"]]),
                          union_pct = as.list(nat_pct_enumerated)),
        estimated_overall = list(scope = "Union level only (context, NOT a row; NOT blended)",
                                 union_total = nat_estimated_overall,
                                 assumption = "the report assumes the non-enumerated Rakhine population is mainly affiliated with the Islamic faith",
                                 union_pct = as.list(nat_pct_estimated))
      ),
      non_enumeration = list(
        note = non_enumeration_note,
        rakhine_caveat = rakhine_caveat,
        estimated_non_enumerated_by_state = list(Rakhine = 1090000L, Kayin = 69753L, Kachin = 46600L),
        estimated_non_enumerated_union = nat_est_non_enumerated,
        estimated_overall_population = nat_estimated_overall),
      description_note = description_note,
      change_withhold = paste(
        "The 2024 census (conducted October 2024 under the State Administration Council military government,",
        "with substantial areas not enumerated: 32,191,407 enumerated + 19,125,349 estimated = 51,316,756) is",
        "a frame-and-universe break from 2014 and publishes no state/region religion table yet; it is deferred,",
        "never blended with 2014."),
      boundary_derivation = "OCHA COD-AB MMR ADM1 (source MIMU, 18 units, CC BY-IGO, valid_on 2024-02-15) dissolved to the 15-unit census State/Region frame: Bago (East)+(West) -> Bago; Shan (East)+(North)+(South) -> Shan (exact complete-unit partition).",
      omitted_metrics = list("place_count", "places_per_10000_residents", "place_density_per_sq_km"),
      boundary_simplification = simplification,
      dop_website_copyright_verbatim = licence_note_verbatim,
      local_cache_hint = "All raw sources are cached under data/raw/mm_census/ and remain git-ignored.",
      raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/mm_census/ (pending mirror)"),
      retrieval_record = raw_sources
    ),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")), digest = as.character(packageVersion("digest")),
      pdftotext = tryCatch(system2("pdftotext", "-v", stdout = TRUE, stderr = TRUE)[1], error = function(e) "pdftotext (poppler)"),
      mapshaper = "scripts/lib/simplify_boundary.R (npx mapshaper)"
    )
  ),
  source = list(
    provider = "Department of Population, Ministry of Labour, Immigration and Population, Myanmar; OCHA/MIMU COD-AB",
    source_dataset_ids = list(d_census, d_boundary),
    source_urls = list(url_census, url_census_unfpa, url_boundary, url_boundary_meta, url_dop_terms),
    retrieved_at = stamp,
    licence = census_licence_name,
    citation = "Department of Population, The 2014 Myanmar Population and Housing Census, The Union Report: Religion, Census Report Volume 2-C, Table 1 (July 2016); OCHA COD-AB Myanmar ADM1 (source MIMU, CC BY-IGO).",
    raw_redistribution = "The census PDFs and the boundary source files are not committed; they remain in data/raw/mm_census/.",
    local_cache_hint = "data/raw/mm_census/ (git-ignored by .gitignore data/ rule)",
    licence_position = "needs_review"
  ),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = list(
    durable_file_record(summary_json_out, "Myanmar state/region 2014 census-affiliation area summary (15 units, enumerated population; non-enumeration disclosed).", licence_basis_slug),
    durable_file_record(summary_csv_out, "Flattened Myanmar state/region 2014 census-affiliation rows.", licence_basis_slug),
    durable_file_record(geojson_out, "Simplified OCHA COD-AB Myanmar 15-unit State/Region boundary GeoJSON (2014 frame, dissolved).", boundary_licence_basis_slug)
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id,
         notes = "15 state/region rows, 2014 enumerated population; non-enumeration disclosed per row; estimated-total presentation carried as Union-level context, never blended."),
    list(uri = paste0("repo:", summary_csv_out), sha256 = sha256_file(summary_csv_out), built_by = script_id,
         notes = "CSV companion (15 rows)."),
    list(uri = paste0("repo:", geojson_out), sha256 = sha256_file(geojson_out), built_by = script_id,
         notes = "15 state/region features from OCHA COD-AB (dissolved from 18), simplified with mapshaper.")
  ),
  deferred_sources = deferred_sources,
  construct_notes = list(description_note, non_enumeration_note, rakhine_caveat,
    "Slot design: ordinary two-slot (Myanmar has a real No-religion category). Affiliation = enumerated total minus No religion; No-religion = the No-religion category; the two shares sum to 100 on the enumerated denominator.",
    "Boundary: OCHA COD-AB MMR ADM1 (source MIMU, CC BY-IGO) dissolved from 18 to the 15-unit census frame (Bago and Shan sub-units folded into their parents)."),
  validation = validation,
  privacy = "public",
  licence_status = "needs_review",
  licence_basis = licence_basis_slug,
  downstream_status = "staged",
  source_datasets = source_datasets(),
  notes = paste(
    "STAGED build held for the PI's eyes (sensitivity, not licence — the Pakistan line). Derived state/region",
    "area summaries plus a 15-unit boundary; no page, no hub link, nothing committed by this lane. The 2014",
    "census enumerated Rakhine (predominantly Rohingya Muslims), Kayin and Kachin non-enumeration is disclosed",
    "on every affected row and surface in the record's own words; the enumerated and estimated-total",
    "presentations are rendered separately and never blended. On-page attribution, when a page is built, must",
    "cite the Department of Population (Union Report Volume 2-C, Religion) and OCHA/MIMU COD-AB (CC BY-IGO).")
)
write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

# ---- report --------------------------------------------------------------------
cat("MYANMAR 2014 state/region census-religion product (STAGED — held for the PI)\n")
cat(sprintf("units: 15 (14 states/regions + Nay Pyi Taw); rows: %d\n", length(rows)))
cat(sprintf("gate: enumerated Union %d; est. non-enumerated %d; estimated overall %d\n",
            nat_enum[["total"]], nat_est_non_enumerated, nat_estimated_overall))
cat("Union enumerated shares (computed vs printed Table 1 / estimated-overall Table 2):\n")
for (c in top_cats) {
  sc <- share_crosscheck[[c]]
  cat(sprintf("  %-15s %6.1f%% (printed %4.1f)   est.overall printed %4.1f\n",
              c, sc[["computed_enumerated_pct"]], sc[["printed_enumerated_pct"]], sc[["printed_estimated_overall_pct"]]))
}
cat(sprintf("boundary: 15 distinct features, %d bytes; licence CC BY-IGO (COD-AB, source MIMU)\n", file_bytes(geojson_out)))
cat("licence (census): bare-copyright vacuum; derived rates with attribution; needs_review; STAGED\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", geojson_out))
cat(sprintf("wrote %s\n", manifest_out))
