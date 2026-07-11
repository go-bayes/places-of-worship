# build the Kosovo municipality census-religion area-summary product for two waves
# (2011, 2024) on a single 38-municipality frame. both waves live in one machine-
# readable KAS ASKdata PxWeb table, census2024_10.px ("Population by religion and
# sex at country and municipal level for the years 2011 and 2024"), cached as a
# JSON-stat2 cube. the 2011 census omitted the four northern Serb-majority
# municipalities (Leposaviq, Zubin Potok, Zveqan, North Mitrovica) — a boycott
# rendered as published (empty cells -> null features), never repaired; the 2024
# census enumerated them only partially (a continued northern boycott, visible in
# the tiny 2024 counts). the two waves ride the same boundary frame, so no
# concordance is invented; no cross-wave municipal change is claimed (CHANGE-
# WITHHOLD across the northern coverage break).
# see research/countries/xk/route-probe.md for full provenance and sha256.
#   inputs (all cached, git-ignored under data/raw/xk_census/):
#   census2024_10_religion.json <- ASKdata PxWeb JSON-stat2 cube (Total sex slice,
#     both years, KOSOVA + 38 municipalities, 6 religion categories + Total)
#   geoBoundaries-XKX-ADM2.geojson <- 38 municipalities (CC BY-SA 2.0, 2017 vintage)
# every religion cell is read verbatim from the cached cube and reconciled against
# the national control row here; the build stops on any margin mismatch and never
# allocates, infers, rounds, imputes, or tunes a value. empty 2011 northern cells
# read as null (absent enumeration), never zero-with-meaning.
# outputs: apps/regions/xk/data/{xk_municipality.geojson, area_summary_municipality.json,
#   area_summary_municipality.csv} and docs/manifests/xk-census-religion-2011-2024.json.
# run from the repo root: Rscript scripts/build_xk_area_summary.R

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "XK"
script_id <- "scripts/build_xk_area_summary.R"
raw_dir <- "data/raw/xk_census"
product_dir <- "apps/regions/xk/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-12"
stamp <- paste0(retrieval_date, "T00:00:00Z")
git_commit <- trimws(system2("git", c("rev-parse", "HEAD"), stdout = TRUE))
if (length(git_commit) != 1L || !grepl("^[a-f0-9]{40}$", git_commit)) git_commit <- NULL

# ---- dataset ids ---------------------------------------------------------------
d_census <- "xk-census-2011-2024-religion-by-municipality"
d_gb <- "geoboundaries-xkx-adm2-2017"
boundary_set_id <- "xk-municipality-geoboundaries-adm2"

# ---- source urls and cached paths ----------------------------------------------
url_px_table <- "https://askdata.rks-gov.net/pxweb/en/ASKdata/ASKdata__Census%20population__1_Demographic_Characteristics/census2024_10.px/"
url_px_meta_en <- "https://askdata.rks-gov.net/api/v1/en/ASKdata/Census%20population/1_Demographic_Characteristics/census2024_10.px"
url_px_meta_sq <- "https://askdata.rks-gov.net/api/v1/sq/ASKdata/Census%20population/1_Demographic_Characteristics/census2024_10.px"
url_px_meta_sr <- "https://askdata.rks-gov.net/api/v1/sr/ASKdata/Census%20population/1_Demographic_Characteristics/census2024_10.px"
url_pdf <- "https://askapi.rks-gov.net/Custom/bffbac3c-f325-4b18-b0e3-755dcb4cccf0.pdf"
url_gb <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/XKX/ADM2/geoBoundaries-XKX-ADM2.geojson"
url_gb_meta <- "https://www.geoboundaries.org/api/current/gbOpen/XKX/ADM2/"

path_cube <- file.path(raw_dir, "census2024_10_religion.json")
path_meta_en <- file.path(raw_dir, "census2024_10_meta.json")
path_meta_sq <- file.path(raw_dir, "census2024_10_meta_sq.json")
path_meta_sr <- file.path(raw_dir, "census2024_10_meta_sr.json")
path_pdf <- file.path(raw_dir, "xk_2024_first_final_results.pdf")
path_gb <- file.path(raw_dir, "geoBoundaries-XKX-ADM2.geojson")
path_gb_meta <- file.path(raw_dir, "gb_xkx_adm2_meta.json")

geojson_out <- file.path(product_dir, "xk_municipality.geojson")
summary_json_out <- file.path(product_dir, "area_summary_municipality.json")
summary_csv_out <- file.path(product_dir, "area_summary_municipality.csv")
manifest_out <- file.path(manifest_dir, "xk-census-religion-2011-2024.json")

sha256_file <- function(path) unname(tools::sha256sum(path))
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))
require_file <- function(path) {
  if (!file.exists(path) || file_bytes(path) == 0L) stop("missing required source: ", path, call. = FALSE)
}
invisible(lapply(c(path_cube, path_meta_en, path_meta_sq, path_meta_sr, path_gb, path_gb_meta), require_file))

# ---- verbatim category frame (three languages) ---------------------------------
# six substantive categories plus Total, identical across both waves. labels are
# transcribed verbatim from the cached PxWeb metadata (en/sq/sr) whose sha256 are
# in the manifest retrieval record. RELIGJIONI value order: Total, Islam, Orthodox,
# Catholic, Others, No religious affiliation, Prefers not to answer.
rel_en <- c("Total", "Islam", "Orthodox", "Catholic", "Others",
            "No religious affiliation", "Prefers not to answer")
rel_sq <- c("Gjithsej", "Islam", "Ortodoks", "Katolik", "Të tjerë",
            "Asnjë besim fetar", "Preferon të mos përgjigjet")
rel_sr <- c("Ukupno", "Islam", "Pravoslavni", "Katolički", "Ostali",
            "Nema versku pripadnost", "Preferira da ne odgovori")
# indices into the 0-based RELIGJIONI dimension.
i_total <- 0L; i_islam <- 1L; i_orth <- 2L; i_cath <- 3L
i_others <- 4L; i_norel <- 5L; i_refused <- 6L
substantive_idx <- c(i_islam, i_orth, i_cath, i_others, i_norel, i_refused)
affiliation_idx <- c(i_islam, i_orth, i_cath, i_others)

# ---- municipality frame and boundary crosswalk ---------------------------------
# census KOMUNA value order 1..38 (0 = KOSOVA national row). census English name,
# product slug, and geoBoundaries ADM2 shapeName. the one non-obvious pair is
# Drenas (geoBoundaries) <-> Gllogoc (census); all others are transliteration.
muni <- read.csv(text = "
census_index,census_name,slug,gb_name
1,Deçan,decan,Municipality of Deçan
2,Gjakovë,gjakove,Municipality of Gjakova
3,Gllogoc,gllogoc,Municipality of Drenas
4,Gjilan,gjilan,Municipality of Gjilan
5,Dragash,dragash,Municipality of Dragash
6,Istog,istog,Municipality of Istog
7,Kaçanik,kacanik,Municipality of Kaçanik
8,Klinë,kline,Municipality of Klina
9,Fushë Kosovë,fushe_kosove,Municipality of Fushë Kosovë
10,Kamenicë,kamenice,Municipality of Kamenica
11,Mitrovicë,mitrovice,Municipality of Mitrovica
12,Leposaviq,leposaviq,Municipality of Leposaviq
13,Lipjan,lipjan,Municipality of Lipjan
14,Novobërdë,novoberde,Municipality of Novobërdë
15,Obiliq,obiliq,Municipality of Obiliq
16,Rahovec,rahovec,Municipality of Rahovec
17,Pejë,peje,Municipality of Peja
18,Podujevë,podujeve,Municipality of Podujeva
19,Prishtinë,prishtine,Municipality of Pristina
20,Prizren,prizren,Municipality of Prizren
21,Skënderaj,skenderaj,Municipality of Skenderaj
22,Shtime,shtime,Municipality of Shtime
23,Shtërpcë,shterpce,Municipality of Shtërpcë
24,Suharekë,suhareke,Municipality of Suhareka
25,Ferizaj,ferizaj,Municipality of Ferizaj
26,Viti,viti,Municipality of Viti
27,Vushtrri,vushtrri,Municipality of Vushtrri
28,Zubin Potok,zubin_potok,Municipality of Zubin Potok
29,Zveqan,zveqan,Municipality of Zveçan
30,Malishevë,malisheve,Municipality of Malisheva
31,Junik,junik,Municipality of Junik
32,Mamushë,mamushe,Municipality of Mamusha
33,Hani i Elezit,hani_i_elezit,Municipality of Han i Elezit
34,Graçanicë,gracanice,Municipality of Gracanica
35,Ranillug,ranillug,Municipality of Ranillug
36,Partesh,partesh,Municipality of Partesh
37,Kllokot,kllokot,Municipality of Kllokot
38,Mitrovicë e Veriut,mitrovice_e_veriut,Municipality of North Mitrovica
", stringsAsFactors = FALSE, encoding = "UTF-8", strip.white = TRUE)
if (nrow(muni) != 38L) stop("municipality crosswalk is not 38 rows", call. = FALSE)

# ---- read the cached JSON-stat2 cube -------------------------------------------
# dimensions in id order: KOMUNA(39), Viti(2), Gjinia(1, Total only), RELIGJIONI(7).
# value array is row-major over category index order; nulls (absent enumeration)
# become NA. confirm the shape and the KOMUNA/Viti/RELIGJIONI label order before use.
cube <- fromJSON(path_cube, simplifyVector = FALSE)
sz <- unlist(cube[["size"]])
if (!identical(unlist(cube[["id"]]), c("KOMUNA", "Viti", "Gjinia", "RELIGJIONI")) ||
    !identical(as.integer(sz), c(39L, 2L, 1L, 7L))) {
  stop("cached cube dimensions changed; expected KOMUNA(39) Viti(2) Gjinia(1) RELIGJIONI(7)", call. = FALSE)
}
# confirm the Year dimension order (position 0 = 2024, position 1 = 2011).
viti_labels <- unlist(cube[["dimension"]][["Viti"]][["category"]][["label"]])
year_pos_2024 <- which(viti_labels == "2024") - 1L
year_pos_2011 <- which(viti_labels == "2011") - 1L
if (length(year_pos_2024) != 1L || length(year_pos_2011) != 1L) {
  stop("cube Year dimension does not carry exactly 2024 and 2011", call. = FALSE)
}
# confirm the religion label order matches the verbatim en frame.
rel_labels_cube <- unlist(cube[["dimension"]][["RELIGJIONI"]][["category"]][["label"]])
if (!identical(unname(rel_labels_cube), rel_en)) {
  stop("cube RELIGJIONI labels do not match the expected verbatim frame", call. = FALSE)
}
# confirm KOMUNA position 0 is the national KOSOVA row and positions 1..38 match
# the crosswalk census names in order.
kom_labels <- unname(unlist(cube[["dimension"]][["KOMUNA"]][["category"]][["label"]]))
if (kom_labels[1] != "KOSOVA") stop("cube KOMUNA position 0 is not KOSOVA", call. = FALSE)
if (!identical(kom_labels[2:39], muni[["census_name"]])) {
  stop("cube municipality order does not match the crosswalk", call. = FALSE)
}

values <- cube[["value"]]  # length 39*2*1*7 = 546 list, NULL for absent cells
nY <- 2L; nS <- 1L; nR <- 7L
# read one cell: municipality position m (0..38), year position y, religion r (0..6).
cell <- function(m, y, r) {
  idx <- ((m * nY + y) * nS + 0L) * nR + r + 1L
  v <- values[[idx]]
  if (is.null(v)) return(NA_real_) else return(as.numeric(v))
}
# a substantive cell rendered blank by PxWeb is a true zero (the category had no
# respondents), provable because the present cells already sum to the printed
# Total; read blank-with-present-total as 0. only a null Total marks an absent
# (unenumerated) municipality. the row gate below fails fast on any genuine
# suppression (present cells that do not close to Total).
cell0 <- function(m, y, r) {
  v <- cell(m, y, r)
  if (is.na(v)) 0 else v
}

# ---- reconciliation gates (fail-fast; stop, do not tune) -----------------------
# for each wave: every present municipality row sums across the six substantive
# categories to its printed total; every religion column sums across present
# municipalities to the printed KOSOVA national total; grand totals reconcile.
# absent municipalities (Total is NA) are carried as null and excluded from sums.
reconcile_wave <- function(year_label, ypos) {
  records <- list()
  present <- integer(0); absent <- character(0)
  colsum <- setNames(rep(0, length(substantive_idx)), rel_en[substantive_idx + 1L])
  totsum <- 0
  for (k in seq_len(38L)) {
    tot <- cell(k, ypos, i_total)
    if (is.na(tot)) {
      # absent (unenumerated) only when the Total itself is null.
      absent <- c(absent, muni[["census_name"]][k]); next
    }
    cats <- vapply(substantive_idx, function(r) cell0(k, ypos, r), numeric(1))
    s <- sum(cats)
    if (s != tot) {
      stop(sprintf("%s municipality gate FAILED for %s: categories sum %g != printed total %g",
                   year_label, muni[["census_name"]][k], s, tot), call. = FALSE)
    }
    present <- c(present, k)
    totsum <- totsum + tot
    colsum <- colsum + cats
    records[[length(records) + 1L]] <- data.frame(
      year = year_label, margin = "municipality_row", key = muni[["census_name"]][k],
      computed = s, printed = tot, difference = 0, stringsAsFactors = FALSE)
  }
  nat_tot <- cell(0L, ypos, i_total)
  for (j in seq_along(substantive_idx)) {
    r <- substantive_idx[j]
    nat <- cell(0L, ypos, r)
    if (colsum[j] != nat) {
      stop(sprintf("%s religion-column gate FAILED for %s: municipality sum %g != printed national %g",
                   year_label, rel_en[r + 1L], colsum[j], nat), call. = FALSE)
    }
    records[[length(records) + 1L]] <- data.frame(
      year = year_label, margin = "religion_column", key = rel_en[r + 1L],
      computed = unname(colsum[j]), printed = nat, difference = 0, stringsAsFactors = FALSE)
  }
  if (totsum != nat_tot) {
    stop(sprintf("%s grand gate FAILED: municipality-total sum %g != printed national %g",
                 year_label, totsum, nat_tot), call. = FALSE)
  }
  nat_cats <- vapply(substantive_idx, function(r) cell(0L, ypos, r), numeric(1))
  if (sum(nat_cats) != nat_tot) {
    stop(sprintf("%s category-total gate FAILED: national category sum %g != printed national %g",
                 year_label, sum(nat_cats), nat_tot), call. = FALSE)
  }
  list(records = do.call(rbind, records), present = present, absent = absent,
       national_total = nat_tot)
}

rec_2011 <- reconcile_wave("2011", year_pos_2011)
rec_2024 <- reconcile_wave("2024", year_pos_2024)
expected_absent_2011 <- c("Leposaviq", "Zubin Potok", "Zveqan", "Mitrovicë e Veriut")
if (!setequal(rec_2011$absent, expected_absent_2011)) {
  stop("2011 absent municipalities differ from the recorded northern boycott set", call. = FALSE)
}
if (length(rec_2024$absent) != 0L) stop("2024 has unexpected absent municipalities", call. = FALSE)
message(sprintf("gate 2011: PASSED (both margins close to %g; %d enumerated + %d absent northern municipalities)",
                rec_2011$national_total, length(rec_2011$present), length(rec_2011$absent)))
message(sprintf("gate 2024: PASSED (both margins close to %g; 38 municipalities present)",
                rec_2024$national_total))

# ---- boundary layer ------------------------------------------------------------
geometry_hashes <- function(layer) {
  vapply(seq_len(nrow(layer)), function(i) {
    digest(st_as_binary(st_geometry(layer)[i], EWKB = TRUE)[[1L]], algo = "sha256", serialize = FALSE)
  }, character(1))
}
# confirm the boundary licence, unit count, and type before use.
gb_meta <- fromJSON(path_gb_meta, simplifyVector = FALSE)
if (!identical(gb_meta[["boundaryLicense"]], "Creative Commons Attribution-ShareAlike 2.0") ||
    !identical(gb_meta[["admUnitCount"]], "38") ||
    !identical(gb_meta[["boundaryType"]], "ADM2")) {
  stop("geoBoundaries XKX ADM2 licence, unit count, or type metadata changed", call. = FALSE)
}

# Kosovo-centred equal-area projection for land areas (no dateline crossing).
xk_laea <- "+proj=laea +lat_0=42.6 +lon_0=21 +datum=WGS84 +units=m +no_defs"

gb <- st_make_valid(st_read(path_gb, quiet = TRUE, stringsAsFactors = FALSE))
if (nrow(gb) != 38L) stop("geoBoundaries XKX ADM2 feature count is not 38", call. = FALSE)
idx <- match(muni[["gb_name"]], gb[["shapeName"]])
if (anyNA(idx) || anyDuplicated(idx)) {
  stop("census municipalities and boundary features do not join one-to-one", call. = FALSE)
}
boundary <- gb[idx, ]
boundary[["area_name"]] <- muni[["census_name"]]
boundary[["area_code"]] <- muni[["slug"]]
boundary[["area_unit_id"]] <- paste(boundary_set_id, muni[["slug"]], sep = ":")
boundary[["boundary_set_id"]] <- boundary_set_id
boundary[["boundary_level"]] <- "municipality"
boundary[["boundary_source_name"]] <- muni[["gb_name"]]
boundary[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(boundary, xk_laea))) / 1e6
boundary <- st_transform(st_make_valid(boundary), 4326)
boundary <- boundary[c("area_code", "area_name", "boundary_source_name", "area_unit_id",
                       "boundary_set_id", "boundary_level", "land_area_sq_km", "geometry")]

# simplify with the mandatory helper; re-validate count + distinctness.
simplification <- mapshaper_simplify_to_cap(
  boundary, geojson_out, max_bytes = 900000L,
  keep_percentages = c(30, 20, 12, 8, 5, 3, 2),
  clean_option = "allow-overlaps")
written <- st_read(geojson_out, quiet = TRUE, stringsAsFactors = FALSE)
written <- written[match(boundary[["area_code"]], written[["area_code"]]), ]
if (anyNA(written[["area_code"]])) stop("simplified boundary lost an area code", call. = FALSE)
if (nrow(written) != 38L) stop("simplified boundary count is not 38", call. = FALSE)
w_valid <- st_is_valid(written)
if (any(st_is_empty(written)) || any(is.na(w_valid)) || any(!w_valid)) {
  stop("simplified boundary has empty or invalid geometries", call. = FALSE)
}
bnd_hashes <- geometry_hashes(written)
if (length(unique(bnd_hashes)) != 38L) stop("simplified geometry hashes not distinct", call. = FALSE)
bnd_bbox <- st_bbox(written)
land_by_slug <- setNames(written[["land_area_sq_km"]], written[["area_code"]])
message(sprintf("boundary: PASSED (38 distinct features, %d bytes at %g%% keep)",
                file_bytes(geojson_out), simplification[["keep_percent"]]))

# ---- product rows --------------------------------------------------------------
# ordinary two-slot design (KZ/BZ precedent): religious_affiliation_percent is the
# summed share of Islam + Orthodox + Catholic + Others; no_religion_percent is the
# single No-religious-affiliation line. Prefers-not-to-answer stays in the
# denominator and in neither slot, so the two shares need not sum to 100.
flag_common <- paste(
  "census_affiliation", "usually_resident_population_all_ages_universe",
  "single_select_reported_religion",
  "religious_affiliation_percent_is_summed_affiliation_share",
  "no_religion_percent_is_no_religious_affiliation_line_only",
  "prefers_not_to_answer_residual_in_denominator_neither_slot",
  "shares_need_not_sum_to_100",
  "northern_coverage_break_2011_absent_2024_partial_boycott_no_cross_wave_change",
  "census_licence_open_reuse_with_attribution",
  sep = ";")

basis_2011 <- paste(
  "2011 Kosovo Population and Housing Census, KAS ASKdata table census2024_10",
  "'Population by religion and sex at country and municipal level' (Year 2011, Total",
  "sex), usually resident population of all ages; the denominator is the printed",
  "municipality total. Religious affiliation is the municipality population minus the",
  "No-religious-affiliation and Prefers-not-to-answer lines. The four northern",
  "municipalities were not enumerated (boycott) and carry null values.")
basis_2024 <- paste(
  "2024 Kosovo Population and Housing Census, KAS ASKdata table census2024_10",
  "'Population by religion and sex at country and municipal level' (Year 2024, Total",
  "sex), usually resident population of all ages; the denominator is the printed",
  "municipality total. Religious affiliation is the municipality population minus the",
  "No-religious-affiliation and Prefers-not-to-answer lines. The northern four",
  "municipalities were only partially enumerated (continued boycott); counts are",
  "rendered as published.")

# build one schema-shaped row, carrying the verbatim trilingual per-municipality
# category breakdown. absent (boycotted, unenumerated) municipalities emit nulls.
make_row <- function(k, year_label, ypos, basis) {
  slug <- muni[["slug"]][k]
  name <- muni[["census_name"]][k]
  tot <- cell(k, ypos, i_total)
  land <- unname(round(land_by_slug[[slug]], 4))
  # all schema-required fields are present in the literal; nullable ones default to
  # NULL (rendered as JSON null) and the enumerated branch overwrites with values.
  base <- list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = "municipality",
    area_unit_id = paste(boundary_set_id, slug, sep = ":"),
    area_code = slug,
    area_name = name,
    year = as.integer(year_label),
    population_total = NULL,
    population_total_basis = basis,
    religious_affiliation_count = NULL,
    religious_affiliation_percent = NULL,
    no_religion_count = NULL,
    no_religion_percent = NULL,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = land,
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(d_census, d_gb),
    quality_flag = NULL)
  if (is.na(tot)) {
    # boycotted / unenumerated: render the coverage gap as null, never repair.
    base$quality_flag <- paste0(
      flag_common, ";source_municipality_name_sq=", name,
      ";coverage=not_enumerated_2011_northern_boycott;value=null_not_zero")
    return(base)
  }
  pop <- as.integer(tot)
  norel <- as.integer(cell0(k, ypos, i_norel))
  refused <- as.integer(cell0(k, ypos, i_refused))
  affiliation <- pop - norel - refused
  # verbatim breakdown: trilingual label = count for each substantive category
  # (a PxWeb-blank cell is a true zero, forced by the row closing to Total).
  vals <- vapply(substantive_idx, function(r) as.integer(cell0(k, ypos, r)), integer(1))
  breakdown <- paste(sprintf("%s/%s/%s=%d",
                             rel_en[substantive_idx + 1L], rel_sq[substantive_idx + 1L],
                             rel_sr[substantive_idx + 1L], vals), collapse = ";")
  base$population_total <- pop
  base$religious_affiliation_count <- as.integer(affiliation)
  base$religious_affiliation_percent <- round(100 * affiliation / pop, 4)
  base$no_religion_count <- norel
  base$no_religion_percent <- round(100 * norel / pop, 4)
  base$quality_flag <- paste0(
    flag_common, ";source_municipality_name_sq=", name,
    ";source_categories_verbatim=", breakdown)
  base
}

rows <- c(
  lapply(seq_len(38L), make_row, year_label = "2011", ypos = year_pos_2011, basis = basis_2011),
  lapply(seq_len(38L), make_row, year_label = "2024", ypos = year_pos_2024, basis = basis_2024))

# ---- area-summary document -----------------------------------------------------
census_licence_name <- paste(
  "Kosovo Agency of Statistics open reuse grant. The 2024 First Final Results report",
  "(askapi.rks-gov.net/Custom/bffbac3c-f325-4b18-b0e3-755dcb4cccf0.pdf, front matter,",
  "retrieved 2026-07-12) states: '© Kosovo Agency of Statistics. Reuse is authorised",
  "provided the source is acknowledged.' An open licence conditioned only on source",
  "acknowledgement.")

source_datasets <- function() {
  list(
    list(
      source_dataset_id = d_census,
      name = "Kosovo 2011 and 2024 Population and Housing Census: population by religion and sex at country and municipal level (KAS ASKdata census2024_10)",
      provider = "Kosovo Agency of Statistics (KAS / Agjencia e Statistikave të Kosovës)",
      url = url_px_table, retrieval_date = retrieval_date, local_path = path_cube,
      licence = list(name = census_licence_name, url = url_pdf,
                     attribution = "Kosovo Agency of Statistics, 2011 and 2024 Population and Housing Census"),
      citation = "Kosovo Agency of Statistics, Population and Housing Census 2011 and 2024, table 'Population by religion and sex at country and municipal level' (ASKdata census2024_10).",
      access_limits = NULL,
      redistribution_limits = "Open reuse with source acknowledgement; derived municipality summaries ship with attribution to the Kosovo Agency of Statistics.",
      notes = paste("Usually resident population, all ages. One PxWeb table carries both waves and all 38 municipalities.",
                    "Both margins close exactly (2011 national 1,739,825; 2024 national 1,585,566). Six-category frame",
                    "(Islam, Orthodox, Catholic, Others, No religious affiliation, Prefers not to answer). The four northern",
                    "municipalities are absent in 2011 (boycott) and only partially enumerated in 2024; rendered as published.")),
    list(
      source_dataset_id = d_gb,
      name = "geoBoundaries XKX ADM2 (38 municipalities, 2017 vintage)",
      provider = "geoBoundaries (William & Mary geoLab); boundary source OpenStreetMap, Wambacher",
      url = url_gb, retrieval_date = retrieval_date, local_path = path_gb,
      licence = list(name = "Creative Commons Attribution-ShareAlike 2.0 (CC BY-SA 2.0)", url = url_gb_meta,
                     attribution = "geoBoundaries (gbOpen); boundary source OpenStreetMap contributors (CC BY-SA 2.0)"),
      citation = "geoBoundaries XKX ADM2 (gbOpen, pinned 9469f09), 38 municipality boundaries.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary is committed under CC BY-SA 2.0 (OpenStreetMap via geoBoundaries); the share-alike and attribution apply.",
      notes = "38 ADM2 municipalities, boundaryYearRepresented 2017; the census 38-municipality frame joins one-to-one after a name crosswalk (Drenas <-> Gllogoc the one non-obvious pair). Both waves ride this single boundary set.")
  )
}

indicators <- function() {
  denom_note <- paste(
    "Percentages use each municipality's printed census population total. The Prefers-",
    "not-to-answer line stays in the denominator and outside both headline numerators,",
    "so the two shares need not sum to 100%.")
  list(
    list(indicator_id = "population_total", label = "Census population total",
         description = "Municipality usually-resident population represented in the wave's religion table.",
         unit = "count", denominator_indicator_id = NULL,
         method = "Printed municipality total from KAS ASKdata census2024_10 (Year slice, Total sex).",
         temporal_coverage = "2011; 2024", spatial_coverage = "Kosovo municipalities (38 frame; 4 northern absent in 2011)",
         quality_notes = "Usually resident population, all ages. The four northern municipalities are not enumerated in 2011 (boycott, null) and only partially enumerated in 2024; no cross-wave municipal change is claimed across this coverage break."),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
         description = "Share of the municipality population reporting affiliation with a named religion (Islam, Orthodox, Catholic, or Others).",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (population - No religious affiliation - Prefers not to answer) / population.",
         temporal_coverage = "2011; 2024", spatial_coverage = "Kosovo municipalities (38 frame; 4 northern absent in 2011)",
         quality_notes = paste("The six substantive categories are identical across waves (Islam, Orthodox, Catholic, Others, No religious affiliation, Prefers not to answer), preserved verbatim in Albanian, Serbian, and English. Affiliation is read as levels per wave, not as cross-wave change (northern coverage break).", denom_note)),
    list(indicator_id = "no_religion_percent", label = "No religious affiliation %",
         description = "Share in the census No-religious-affiliation line (Asnjë besim fetar / Nema versku pripadnost).",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (No religious affiliation line) / population. Prefers not to answer is not part of this slot.",
         temporal_coverage = "2011; 2024", spatial_coverage = "Kosovo municipalities (38 frame; 4 northern absent in 2011)",
         quality_notes = paste("The No-religious-affiliation and Prefers-not-to-answer lines grow sharply between waves (national 1,242 -> 7,899 and 9,708 -> 23,718); read as levels per wave, never as cross-wave change across the coverage break.", denom_note))
  )
}

visual_layers <- function() {
  list(
    list(visual_layer_id = "xk-municipality-religious-affiliation", label = "Religious affiliation %",
         description = "Kosovo census-affiliation share by municipality.", layer_type = "choropleth",
         indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "municipality usually-resident population, including a Prefers-not-to-answer residual"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "reported municipality value", uncertainty_display = "quality_flag",
         default_visibility = TRUE,
         notes = "Census affiliation, not practice or membership. In 2011 the four northern municipalities render as no-data (not enumerated); in 2024 they carry partial-boycott low counts."),
    list(visual_layer_id = "xk-municipality-no-religion", label = "No religious affiliation %",
         description = "Kosovo census No-religious-affiliation share by municipality.", layer_type = "choropleth",
         indicator_ids = list("no_religion_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "municipality usually-resident population"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "reported municipality value", uncertainty_display = "quality_flag",
         default_visibility = FALSE,
         notes = "The source category is No religious affiliation (Asnjë besim fetar). Prefers not to answer is excluded from this slot.")
  )
}

summary_product <- list(
  schema_version = "area-summary.v1", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code,
                      level = "municipality", vintage = "38-municipality frame (geoBoundaries XKX ADM2, 2017); shared across the 2011 and 2024 waves",
                      source_dataset_id = d_gb),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "No governed place-of-worship snapshot ships in the Kosovo census product.",
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
  na_int <- function(x) if (is.null(x)) NA_integer_ else as.integer(x)
  na_num <- function(x) if (is.null(x)) NA_real_ else as.numeric(x)
  do.call(rbind, lapply(rows, function(r) {
    data.frame(
      country_code = r[["country_code"]], boundary_set_id = r[["boundary_set_id"]],
      boundary_level = r[["boundary_level"]], area_unit_id = r[["area_unit_id"]],
      area_code = r[["area_code"]], area_name = r[["area_name"]], year = r[["year"]],
      population_total = na_int(r[["population_total"]]), population_total_basis = r[["population_total_basis"]],
      religious_affiliation_count = na_int(r[["religious_affiliation_count"]]),
      religious_affiliation_percent = na_num(r[["religious_affiliation_percent"]]),
      no_religion_count = na_int(r[["no_religion_count"]]), no_religion_percent = na_num(r[["no_religion_percent"]]),
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
       raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/xk_census/"))
}
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$", path)) return(length(fromJSON(path, simplifyVector = FALSE)[["features"]]))
  if (grepl("\\.json$", path)) return(length(fromJSON(path, simplifyVector = FALSE)[["rows"]]))
  NA_integer_
}
durable_file_record <- function(path, content, licence_status_value, licence_basis_value) {
  list(uri = paste0("repo:", path), storage_provider = "git_repository", format = sub("^.*\\.", "", path),
       bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = if (grepl("area_summary|\\.csv$", path)) row_count_file(path) else NULL,
       feature_count = if (grepl("\\.geojson$", path)) row_count_file(path) else NULL,
       content = content, privacy = "public",
       licence_status = licence_status_value, licence_basis = licence_basis_value)
}
reconciliation_block <- function(rec) lapply(seq_len(nrow(rec)), function(i) as.list(rec[i, ]))

licence_basis_slug <- "xk_kas_open_reuse_with_attribution"

raw_sources <- list(
  raw_source_record(path_cube, url_px_meta_en, "json_stat2", TRUE, "2011;2024", d_census,
    "ASKdata PxWeb JSON-stat2 cube (census2024_10, Total sex, both years, KOSOVA + 38 municipalities). Both margins close (2011: 1,739,825; 2024: 1,585,566)."),
  raw_source_record(path_meta_en, url_px_meta_en, "json", FALSE, "2011;2024", d_census,
    "PxWeb metadata (en): KOMUNA(39), Viti(2024/2011), Gjinia, RELIGJIONI(Total, Islam, Orthodox, Catholic, Others, No religious affiliation, Prefers not to answer)."),
  raw_source_record(path_meta_sq, url_px_meta_sq, "json", FALSE, "2011;2024", d_census,
    "PxWeb metadata (sq/Albanian): verbatim category labels (Islam, Ortodoks, Katolik, Të tjerë, Asnjë besim fetar, Preferon të mos përgjigjet)."),
  raw_source_record(path_meta_sr, url_px_meta_sr, "json", FALSE, "2011;2024", d_census,
    "PxWeb metadata (sr/Serbian): verbatim category labels (Islam, Pravoslavni, Katolički, Ostali, Nema versku pripadnost, Preferira da ne odgovori)."),
  raw_source_record(path_pdf, url_pdf, "pdf", FALSE, "2024", d_census,
    "2024 First Final Results report; verbatim licence in front matter ('© Kosovo Agency of Statistics. Reuse is authorised provided the source is acknowledged.'); Tab. 3.6 national religion figures match the cube."),
  raw_source_record(path_gb, url_gb, "geojson", TRUE, "2017", d_gb,
    "geoBoundaries XKX ADM2 GeoJSON; 38 municipalities, CC BY-SA 2.0. Pinned commit 9469f09."),
  raw_source_record(path_gb_meta, url_gb_meta, "json", FALSE, "2017", d_gb,
    "geoBoundaries XKX ADM2 metadata; records CC BY-SA 2.0, boundarySource OpenStreetMap/Wambacher, admUnitCount 38.")
)

dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)
dataset_id <- "xk-census-religion:xk:2011-2024:kas-municipality"

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = paste0("manifest:", dataset_id),
  dataset_id = dataset_id,
  dataset_version_id = paste0(dataset_id, ":", dataset_hash),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "xk-census-religion", dataset_role = "accepted_export",
  scope = list(level = "country", country_codes = list("XK"), snapshot_date = NULL,
               snapshot_anchor = NULL, pipeline_stage = "accepted"),
  created_at = stamp, created_by = script_id,
  target_years = list(2011L, 2024L),
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation",
      shipped_waves = list(2011L, 2024L),
      shipped_geography = "38 Kosovo municipalities (2011: 34 enumerated + 4 northern absent; 2024: 38 present)",
      boundary_set = boundary_set_id,
      source_table = "KAS ASKdata census2024_10 'Population by religion and sex at country and municipal level for the years 2011 and 2024' (Total sex slice)",
      universe = "usually resident population, all ages",
      denominator = "printed municipality total; affiliation = population - No religious affiliation - Prefers not to answer",
      slot_design = paste(
        "Ordinary two-slot (KZ/BZ precedent, not the minority-share design; Kosovo has a real",
        "No-religious-affiliation category). religious_affiliation_percent is the summed share of Islam +",
        "Orthodox + Catholic + Others. no_religion_percent is the single No-religious-affiliation line.",
        "Prefers-not-to-answer stays in the denominator and in neither slot, so the two shares need not sum to 100."
      ),
      category_frame = list(
        english = as.list(rel_en),
        albanian = as.list(rel_sq),
        serbian = as.list(rel_sr),
        note = paste(
          "Six substantive categories plus Total, identical across both waves, preserved verbatim in",
          "Albanian (portal sq), Serbian (portal sr), and English (portal en). The printed 2024 report uses the",
          "English variants Islamic/Other/No religion/Preferred not to answer for the same categories; the build",
          "carries the portal English labels with the Albanian and Serbian originals on every row's quality flag."
        )
      ),
      coverage_break = paste(
        "The 2011 census omitted the four northern Serb-majority municipalities (Leposaviq, Zubin Potok, Zveqan,",
        "North Mitrovica) entirely (boycott; North Mitrovica did not yet exist as a separate municipality — carved",
        "from Mitrovica in 2013), rendered as null features. The 2024 census enumerated those four only partially",
        "(continued boycott, tiny counts), rendered as published. The two waves cover different territory in the",
        "north, so no cross-wave municipal change is claimed (CHANGE-WITHHOLD); each wave ships as levels on the",
        "shared 38-municipality boundary frame."
      ),
      boundary_derivation = "geoBoundaries XKX ADM2 (38 units, CC BY-SA 2.0, 2017); direct one-to-one join after a name crosswalk (Drenas <-> Gllogoc the one non-obvious pair). Both waves ride this single boundary set.",
      omitted_metrics = list("places_per_10000_residents", "place_density_per_sq_km"),
      boundary_simplification = simplification,
      local_cache_hint = "All raw sources are cached under data/raw/xk_census/ and remain git-ignored.",
      retrieval_record = raw_sources
    ),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")), digest = as.character(packageVersion("digest")),
      mapshaper = "scripts/lib/simplify_boundary.R (npx mapshaper)"
    )
  ),
  source = list(
    provider = "Kosovo Agency of Statistics (KAS); geoBoundaries (William & Mary geoLab) from OpenStreetMap",
    source_dataset_ids = list(d_census, d_gb),
    source_urls = list(url_px_table, url_px_meta_en, url_px_meta_sq, url_px_meta_sr, url_pdf, url_gb, url_gb_meta),
    retrieved_at = stamp,
    licence = census_licence_name,
    citation = "KAS Population and Housing Census 2011 and 2024, religion by municipality (ASKdata census2024_10); geoBoundaries XKX ADM2 (CC BY-SA 2.0).",
    raw_redistribution = "The census cube, metadata, PDF, and boundary source files are not committed; they remain in data/raw/xk_census/.",
    local_cache_hint = "data/raw/xk_census/ (git-ignored by .gitignore data/ rule)",
    raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/xk_census/")
  ),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = list(
    durable_file_record(summary_json_out, "Kosovo municipality census-affiliation area summary for 2011 and 2024 (38-municipality frame).", "accepted", licence_basis_slug),
    durable_file_record(summary_csv_out, "Flattened Kosovo municipality census-affiliation rows for 2011 and 2024.", "accepted", licence_basis_slug),
    durable_file_record(geojson_out, "Simplified geoBoundaries XKX ADM2 38-municipality boundary GeoJSON.", "accepted", "geoboundaries_cc_by_sa_2_0")
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id,
         notes = "76 rows: 38 municipalities x 2 waves; 2011 northern four are null (unenumerated boycott); no suppressed cells elsewhere."),
    list(uri = paste0("repo:", geojson_out), sha256 = sha256_file(geojson_out), built_by = script_id,
         notes = "38 municipality features from geoBoundaries XKX ADM2, simplified with mapshaper.")
  ),
  validation = list(
    status = "passed",
    commands = list(
      paste("Rscript", script_id),
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/xk/data/area_summary_municipality.json",
      "bash scripts/validate_manifests.sh"
    ),
    gate_2011 = list(status = "passed", both_margins_close_to = rec_2011$national_total,
                     municipality_row_checks = length(rec_2011$present),
                     absent_municipalities = as.list(rec_2011$absent),
                     religion_column_checks = length(substantive_idx),
                     records = reconciliation_block(rec_2011$records)),
    gate_2024 = list(status = "passed", both_margins_close_to = rec_2024$national_total,
                     municipality_row_checks = length(rec_2024$present),
                     religion_column_checks = length(substantive_idx),
                     records = reconciliation_block(rec_2024$records)),
    boundary_validation = list(
      status = "passed", feature_count = 38L,
      distinct_geometry_hashes = length(unique(bnd_hashes)),
      bbox = as.list(bnd_bbox), output_bytes = file_bytes(geojson_out),
      licence = gb_meta[["boundaryLicense"]], adm_unit_count = gb_meta[["admUnitCount"]]),
    join_coverage = list(matched = 38L, expected = 38L),
    notes = paste(
      "2011 (34 enumerated municipalities) and 2024 (38 municipalities) each close exactly at both margins: every",
      "enumerated municipality row and every religion column sum to the printed national total (1,739,825 in 2011;",
      "1,585,566 in 2024). The four northern municipalities are absent in 2011 (null, not imputed) and partially",
      "enumerated in 2024. Boundary joins 38/38."
    ),
    warnings = list(
      "Northern coverage break: the four northern Serb-majority municipalities (Leposaviq, Zubin Potok, Zveqan, North Mitrovica) are unenumerated in 2011 (null features) and only partially enumerated in 2024 (continued boycott); no cross-wave municipal change is claimed.",
      "The Prefers-not-to-answer line is a disclosed denominator residual (national 0.56% in 2011, 1.50% in 2024), in neither headline slot; affiliation and no-religion shares need not sum to 100%.",
      "PxWeb renders a genuine zero as a blank cell: 21 small-category cells in 2024 (0 in 2011) are blank in the source and read as zero, a reading forced by every such row closing exactly to its printed Total; the row gate stops the build on any blank that would break the reconciliation (genuine suppression).",
      "Boundary CC BY-SA 2.0 (share-alike): the simplified derived boundary carries the ShareAlike and attribution notice."
    )
  ),
  construct_notes = list(
    "The construct is census affiliation: each resident's reported religion (asked of the usually resident population of all ages), not practice, attendance, or membership. Religion by municipality is published for 2011 and 2024 in KAS ASKdata table census2024_10.",
    "The public product carries three headline fields per municipality-wave: population total, religious affiliation percent, and no-religion percent. Place-density metrics are null (no governed place-of-worship snapshot).",
    "The six substantive categories (Islam, Orthodox, Catholic, Others, No religious affiliation, Prefers not to answer) are identical across waves and preserved verbatim in Albanian, Serbian, and English on every row's quality flag.",
    "Slot design (ordinary two-slot, KZ/BZ precedent): religious_affiliation_percent is the summed share of Islam + Orthodox + Catholic + Others; no_religion_percent is the single No-religious-affiliation line. Prefers-not-to-answer is a disclosed residual kept in the denominator and in neither slot, so the two shares need not sum to 100.",
    "Coverage: the 2011 census omitted the four northern Serb-majority municipalities entirely (boycott; North Mitrovica was carved from Mitrovica in 2013 and did not yet exist as a separate municipality) — rendered as null features, never imputed. The 2024 census enumerated those four only partially (continued boycott, tiny counts), rendered as published. No cross-wave municipal change is claimed across this coverage break (CHANGE-WITHHOLD).",
    "Both waves ride the single geoBoundaries XKX ADM2 38-municipality frame (CC BY-SA 2.0, 2017); the census municipalities join one-to-one after a name crosswalk, the one non-obvious pair being Drenas (geoBoundaries) <-> Gllogoc (census).",
    "Kosovo's international status is contested; the product takes no position and renders the official KAS record on the official 38-municipality frame under the country code XK (XKX in geoBoundaries), separate from Serbia.",
    "Licence: the census data ship under the KAS open reuse grant ('Reuse is authorised provided the source is acknowledged', quoted verbatim in the manifest source.licence and captured under data/raw/xk_census/). No reuse ask is needed; the product ships with attribution to the Kosovo Agency of Statistics."
  ),
  deferred_sources = list(
    list(source_dataset_id = "xk-census-religion-by-sex", status = "deferred",
         url = url_px_table, local_path = NULL,
         notes = "The same census2024_10 table splits religion by sex (Male/Female) within each municipality-wave. Only the Total-sex slice is shipped; the sex cut is a deeper future product."),
    list(source_dataset_id = "xk-census-religion-with-estimation", status = "deferred",
         url = url_px_table, local_path = NULL,
         notes = "KAS publishes 'with estimation' population products for some characteristics (e.g. ethnicity census2024_63). The religion table census2024_10 is the enumerated (non-estimated) version; the estimated variant is not mixed in.")
  ),
  privacy = "public",
  licence_status = "accepted",
  licence_basis = licence_basis_slug,
  downstream_status = "accepted",
  source_datasets = source_datasets(),
  notes = paste(
    "Accepted product (open KAS reuse licence with attribution). The committed products are the derived municipality",
    "area summary (76 rows across 2011 and 2024) and one geoBoundaries XKX ADM2 38-municipality boundary GeoJSON.",
    "On-page attribution, when a page is built, must cite the Kosovo Agency of Statistics and geoBoundaries",
    "(CC BY-SA 2.0, OpenStreetMap contributors)."
  )
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

cat("waves shipped: 2011 (34 enumerated + 4 null northern), 2024 (38) on the geoBoundaries XKX ADM2 frame\n")
cat(sprintf("rows: %d (38 x 2 waves)\n", length(rows)))
cat(sprintf("gate 2011: passed; both margins close to %g\n", rec_2011$national_total))
cat(sprintf("gate 2024: passed; both margins close to %g\n", rec_2024$national_total))
cat(sprintf("boundary: 38 features, %d bytes\n", file_bytes(geojson_out)))
cat("licence: accepted (KAS open reuse with attribution); CC BY-SA 2.0 boundary\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", geojson_out))
cat(sprintf("wrote %s\n", manifest_out))
