# build the Cabo Verde concelho census religion/spirituality area-summary product for
# two waves (2010, 2021) on the 22-unit geoBoundaries CPV ADM1 concelho frame. inputs
# (all cached, git-ignored, sha256 in research/countries/cv/route-probe.md):
#   data/raw/cv_census/cv_2010_national_cvnumeros.xls -> sheet "Relig_3 " (Tabela 12,
#     "Populacao residente com 15 anos ou mais segundo a religiao por sexo e concelho"),
#     integer counts, 14 categories, 22 concelhos + Cabo Verde national row.
#   data/raw/cv_census/cv_2021_quadros_<slug>.xlsx (22 files) -> per-concelho RELIGIAO_1
#     sheet (Tabela 54, "... com 15 anos ou mais segundo religiao ou espiritualidade
#     pelo meio de residencia e o sexo"), integer counts, 15 categories.
#   data/raw/cv_census/cv_2021_national_cvnumeros_corrigido.xlsx -> national Tabela 52
#     (context; national control totals hard-coded below as the reconciliation target).
#   data/raw/cv_census/geoBoundaries-CPV-ADM1.geojson -> 22-concelho ADM1 boundary.
#   data/raw/cv_census/gb_cpv_adm1_meta.json -> boundary licence metadata (ODbL 1.0).
# every concelho religion cell is read verbatim from the INE workbooks and reconciled
# against the published national control totals here (both margins close exactly: 2010
# to 336,049 and 2021 to 352,494); the build stops on any margin mismatch and never
# allocates, infers, rounds, imputes, or tunes a value. the religion/spirituality
# question is voluntary and asked of residents aged 15 and over, so the universe is the
# published resident population 15+; every surface carries the age-15+ voluntary caveat.
# outputs: apps/regions/cv/data/cv_concelho_2017.geojson,
#   apps/regions/cv/data/area_summary_concelho.{json,csv}, and
#   docs/manifests/cv-census-religion-2010-2021.json.
# run from the repo root: Rscript scripts/build_cv_area_summary.R
# STAGED product: no page, no hub link. licence needs_review under BUILD-THEN-ASK: INE's
# Politica de Difusao (Principio 10) states free and universal access to published
# statistics at www.ine.cv, and statistical confidentiality (segredo estatistico)
# protects only individual microdata; no explicit reuse/derivative grant was found, so
# the derived summaries ship with attribution to INE and an INE reuse-confirmation ask is
# recorded for the PI. boundary ODbL 1.0 (OpenStreetMap).

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(readxl)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "CV"
script_id <- "scripts/build_cv_area_summary.R"
raw_dir <- "data/raw/cv_census"
product_dir <- "apps/regions/cv/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-12"
stamp <- paste0(retrieval_date, "T00:00:00Z")
git_commit <- trimws(system2("git", c("rev-parse", "HEAD"), stdout = TRUE))
if (length(git_commit) != 1L || !grepl("^[a-f0-9]{40}$", git_commit)) git_commit <- NULL

# geoBoundaries boundaryYearRepresented is 2017 for CPV ADM1.
boundary_level <- "concelho"
boundary_vintage <- "2017"
boundary_set_id <- "cv-concelho-2017-geoboundaries-adm1"

d2010 <- "cv-census-2010-cvnumeros-table-12-religion-by-concelho"
d2021 <- "cv-census-2021-quadros-concelho-religion-espiritualidade"
d_boundary <- "geoboundaries-cpv-adm1-2017"

# ---- source urls and cached paths ----------------------------------------------
url_2010 <- "https://bdmi.ine.cv/site_deploy_api/Uploads/20251209_085254_1c628c72-ddfd-4301-8494-1c159b147216.xls"
url_2021_nat <- "https://bdmi.ine.cv/site_deploy_api/Uploads/20251126_152821_9cb2b311-0e9c-4d2a-9007-51557896ec8f.xlsx"
url_2021_api <- "https://bdmi.ine.cv/site_deploy_api/api/Census/content/paginated/3"
url_politica <- "https://bdmi.ine.cv/site_deploy_api/Uploads/20260226_155512_a23cdbcd-cdab-4a2a-b414-e1be3029b9c5.pdf"
ine_home <- "https://ine.cv/"
boundary_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/CPV/ADM1/geoBoundaries-CPV-ADM1.geojson"
boundary_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/CPV/ADM1/"

path_2010 <- file.path(raw_dir, "cv_2010_national_cvnumeros.xls")
path_2021_nat <- file.path(raw_dir, "cv_2021_national_cvnumeros_corrigido.xlsx")
path_politica <- file.path(raw_dir, "cv_ine_politica_de_difusao.pdf")
boundary_path <- file.path(raw_dir, "geoBoundaries-CPV-ADM1.geojson")
boundary_meta_path <- file.path(raw_dir, "gb_cpv_adm1_meta.json")

boundary_out <- file.path(product_dir, "cv_concelho_2017.geojson")
summary_json_out <- file.path(product_dir, "area_summary_concelho.json")
summary_csv_out <- file.path(product_dir, "area_summary_concelho.csv")
manifest_out <- file.path(manifest_dir, "cv-census-religion-2010-2021.json")

# ---- canonical 22-concelho frame and crosswalk ---------------------------------
# the boundary shapeName is the canonical area_name; the census concelho labels differ
# by wave (2010 uses "S. Vicente"/"Calheta de S. Miguel"; 2021 uses "Sao Vicente"/
# "Sao Miguel"). the frame is stable across both waves (all 22 concelhos existed in 2010
# and 2021; Calheta de S. Miguel was renamed Sao Miguel, same territory), so this is a
# genuine two-wave series on identical geography. columns: area_code (slug), area_name
# (= boundary shapeName), label_2010 (Tabela 12 concelho label), slug_2021 (per-concelho
# workbook filename slug).
crosswalk <- data.frame(
  area_code = c(
    "ribeira_grande_santo_antao", "paul", "porto_novo", "sao_vicente", "ribeira_brava",
    "tarrafal_sao_nicolau", "sal", "boa_vista", "maio", "tarrafal", "santa_catarina",
    "santa_cruz", "praia", "sao_domingos", "sao_miguel", "sao_salvador_do_mundo",
    "sao_lourenco_dos_orgaos", "ribeira_grande_de_santiago", "mosteiros", "sao_filipe",
    "santa_catarina_do_fogo", "brava"),
  area_name = c(
    "Ribeira Grande", "Paul", "Porto Novo", "São Vicente", "Ribeira Brava",
    "Tarrafal de São Nicolau", "Sal", "Boa Vista", "Maio", "Tarrafal", "Santa Catarina",
    "Santa Cruz", "Praia", "São Domingos", "São Miguel", "São Salvador do Mundo",
    "São Lourenço dos Órgãos", "Ribeira Grande de Santiago", "Mosteiros", "São Filipe",
    "Santa Catarina do Fogo", "Brava"),
  label_2010 = c(
    "Ribeira Grande", "Paul", "Porto Novo", "S. Vicente", "Ribeira Brava",
    "Tarrafal de S. Nicolau", "Sal", "Boavista", "Maio", "Tarrafal", "Santa Catarina",
    "Santa Cruz", "Praia", "S. Domingos", "Calheta de S. Miguel", "S. Salvador do Mundo",
    "S. Lourenço dos Órgãos", "Ribeira Grande de Santiago", "Mosteiros", "S. Filipe",
    "Santa Catarina do Fogo", "Brava"),
  slug_2021 = c(
    "ribeira_grande_de_santo_antao", "paul", "porto_novo", "sao_vicente", "ribeira_brava",
    "tarrafal_de_s_nicolau", "sal", "boa_vista", "maio", "tarrafal_de_santiago",
    "santa_catarina_de_santiago", "santa_cruz", "praia", "sao_domingos", "sao_miguel",
    "sao_salvador_do_mundo", "sao_lourenco_dos_orgaos", "ribeira_grande_de_santiago",
    "mosteiros", "sao_filipe_fogo", "santa_catarina_do_fogo", "brava"),
  stringsAsFactors = FALSE)

# ---- verbatim category frames (per wave; never merged across the instrument break) ---
# 2010 frame (Tabela 12), 14 categories in printed column order.
cat_2010 <- c("Adventista", "Assembleia de Deus", "Católica", "Deus é amor",
              "Igreja do Nazareno", "Islâmica", "Judaica", "Nova Apastólica",
              "Racionalismo Cristão", "Testemunho de Jeová", "Universal do Reino de Deus",
              "Outra", "Sem religião", "ND")
# 2021 frame (national Tabela 52 spellings), 15 categories in printed order. per-concelho
# workbooks carry trivial spelling variants (e.g. "Racionalismo Cristão",
# "Últimos Dias"); the national table spelling is the canonical rendered frame.
cat_2021 <- c("Adventista", "Assembleia de Deus", "Católica", "Deus é Amor",
              "Igreja do Nazareno / Protestante", "Islâmica / Muçulmano", "Judaica",
              "Nova Apastólica", "Racionalismo Critão", "Testemunha de Jeová",
              "Universal do Reino de Deus",
              "Jesus Cristo dos Santos dos últimos dias / Mórmons",
              "Outra", "Sem religião", "Não sabe / Não respondeu")

no_rel_label_2010 <- "Sem religião"
non_resp_label_2010 <- "ND"
no_rel_label_2021 <- "Sem religião"
non_resp_label_2021 <- "Não sabe / Não respondeu"

# published national control totals (reconciliation targets; verified against INE Tabela
# 12 national row and Tabela 52 Cabo Verde column). the build gates every category and
# both grand totals against these; any nonzero deviation stops the build.
natcat_2010 <- setNames(c(5147L, 3101L, 259723L, 382L, 5644L, 6008L, 25L, 1773L, 6263L,
                          3498L, 1379L, 4264L, 36272L, 2570L), cat_2010)
national_2010 <- 336049L
natcat_2021 <- setNames(c(6626L, 730L, 255511L, 300L, 6175L, 4616L, 23L, 1719L, 6129L,
                          4083L, 2802L, 3565L, 4090L, 54814L, 1311L), cat_2021)
national_2021 <- 352494L

# ---- readers -------------------------------------------------------------------
# read the 2010 Tabela 12 concelho block for one census label: returns the concelho 15+
# Total plus the 14 category counts (printed column order). label matches column 1; the
# concelho's "Total" row is the first "Total" after the concelho header row.
read_2010 <- function(sheet_df, label, natrow) {
  hits <- which(trimws(sheet_df[[1]]) == label)
  hits <- hits[hits > natrow]
  if (length(hits) == 0L) stop("2010: concelho header not found: ", label, call. = FALSE)
  header_row <- hits[1L]
  totals <- which(trimws(sheet_df[[1]]) == "Total")
  totals <- totals[totals > header_row]
  if (length(totals) == 0L) stop("2010: Total row not found for ", label, call. = FALSE)
  tr <- totals[1L]
  total <- as.integer(sheet_df[tr, 2L])
  vals <- as.integer(unlist(sheet_df[tr, 3:16]))
  if (anyNA(vals) || is.na(total)) stop("2010: non-numeric cell for ", label, call. = FALSE)
  list(total = total, counts = setNames(vals, cat_2010))
}

# read one 2021 per-concelho workbook: locate the RELIGIAO_1 sheet, find the concelho
# "Total" row and the first numeric column to its right ("Ambos os sexos"), then read the
# 15 category rows (fixed printed order). robust to the varying label-column offset.
read_2021 <- function(path) {
  sheets <- excel_sheets(path)
  rel <- sheets[grepl("RELIG", toupper(sheets))]
  if (length(rel) == 0L) stop("2021: no religion sheet in ", path, call. = FALSE)
  s1 <- rel[grepl("1[^0-9]*$", rel)]
  sheet <- if (length(s1)) s1[1L] else rel[1L]
  df <- as.data.frame(read_excel(path, sheet = sheet, col_names = FALSE,
                                 col_types = "text", .name_repair = "minimal"))
  idx <- which(vapply(seq_len(nrow(df)), function(i) {
    any(!is.na(df[i, ]) & trimws(as.character(df[i, ])) == "Total")
  }, logical(1)))
  if (length(idx) == 0L) stop("2021: Total row not found in ", path, call. = FALSE)
  r <- idx[1L]
  c <- which(!is.na(df[r, ]) & trimws(as.character(df[r, ])) == "Total")[1L]
  numcol <- NA_integer_
  for (cc in (c + 1L):ncol(df)) {
    x <- suppressWarnings(as.integer(df[r, cc]))
    if (!is.na(x)) { numcol <- cc; break }
  }
  if (is.na(numcol)) stop("2021: no numeric total column in ", path, call. = FALSE)
  total <- as.integer(df[r, numcol])
  vals <- integer(0)
  rr <- r + 1L
  while (length(vals) < 15L && rr <= nrow(df)) {
    x <- suppressWarnings(as.integer(df[rr, numcol]))
    has_label <- any(vapply(seq_len(numcol - 1L),
                            function(j) !is.na(df[rr, j]) && nzchar(trimws(df[rr, j])), logical(1)))
    if (!is.na(x) && has_label) vals <- c(vals, x)
    rr <- rr + 1L
  }
  if (length(vals) != 15L) stop("2021: expected 15 categories in ", path, call. = FALSE)
  list(total = total, counts = setNames(vals, cat_2021))
}

# ---- read all concelho counts --------------------------------------------------
sha256_file <- function(path) unname(tools::sha256sum(path))
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))
require_file <- function(path) {
  if (!file.exists(path) || file_bytes(path) == 0L) stop("missing required source: ", path, call. = FALSE)
}

quadros_path <- function(slug) file.path(raw_dir, paste0("cv_2021_quadros_", slug, ".xlsx"))
required_inputs <- c(path_2010, boundary_path, boundary_meta_path,
                     quadros_path(crosswalk$slug_2021))
invisible(lapply(required_inputs, require_file))

sheet_2010 <- as.data.frame(read_excel(path_2010, sheet = "Relig_3 ", col_names = FALSE,
                                       col_types = "text", .name_repair = "minimal"))
natrow_2010 <- which(trimws(sheet_2010[[1]]) == "Ambos os sexos")[1L]
if (is.na(natrow_2010)) stop("2010: national 'Ambos os sexos' row not found", call. = FALSE)

wave_2010 <- lapply(seq_len(nrow(crosswalk)), function(i)
  read_2010(sheet_2010, crosswalk$label_2010[i], natrow_2010))
names(wave_2010) <- crosswalk$area_code

wave_2021 <- lapply(seq_len(nrow(crosswalk)), function(i)
  read_2021(quadros_path(crosswalk$slug_2021[i])))
names(wave_2021) <- crosswalk$area_code

# ---- reconciliation gate (fail-fast; stop, do not tune) -------------------------
# integer waves: every concelho internal sum, every category national sum, and the grand
# total must close exactly. any nonzero deviation stops the build.
reconcile_wave <- function(wave, cats, natcat, national, year) {
  records <- list()
  cat_totals <- setNames(rep(0L, length(cats)), cats)
  grand <- 0L
  for (code in names(wave)) {
    w <- wave[[code]]
    internal <- sum(w$counts)
    if (internal != w$total) {
      stop(sprintf("%d internal gate FAILED for %s: category sum %d != printed total %d",
                   year, code, as.integer(internal), w$total), call. = FALSE)
    }
    cat_totals <- cat_totals + w$counts
    grand <- grand + w$total
    records[[length(records) + 1L]] <- data.frame(
      year = year, margin = "concelho_total", key = code,
      computed = as.integer(internal), printed = as.integer(w$total),
      difference = as.integer(internal - w$total), stringsAsFactors = FALSE)
  }
  for (cc in cats) {
    if (cat_totals[[cc]] != natcat[[cc]]) {
      stop(sprintf("%d category gate FAILED for %s: 22-concelho sum %d != national %d",
                   year, cc, as.integer(cat_totals[[cc]]), natcat[[cc]]), call. = FALSE)
    }
    records[[length(records) + 1L]] <- data.frame(
      year = year, margin = "religion_category", key = cc,
      computed = as.integer(cat_totals[[cc]]), printed = as.integer(natcat[[cc]]),
      difference = as.integer(cat_totals[[cc]] - natcat[[cc]]), stringsAsFactors = FALSE)
  }
  if (grand != national) {
    stop(sprintf("%d grand gate FAILED: concelho-total sum %d != published national %d",
                 year, as.integer(grand), national), call. = FALSE)
  }
  do.call(rbind, records)
}

rec_2010 <- reconcile_wave(wave_2010, cat_2010, natcat_2010, national_2010, 2010L)
message(sprintf("gate 2010: PASSED (integer-exact; both margins close to %d)", national_2010))
rec_2021 <- reconcile_wave(wave_2021, cat_2021, natcat_2021, national_2021, 2021L)
message(sprintf("gate 2021: PASSED (integer-exact; both margins close to %d)", national_2021))

# ---- boundary ------------------------------------------------------------------
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

# confirm the pinned boundary licence, unit count, and type before use.
boundary_metadata <- fromJSON(boundary_meta_path, simplifyVector = FALSE)
if (!identical(boundary_metadata[["boundaryLicense"]], "Open Data Commons Open Database License 1.0") ||
    !identical(boundary_metadata[["admUnitCount"]], "22") ||
    !identical(boundary_metadata[["boundaryType"]], "ADM1")) {
  stop("geoBoundaries CPV ADM1 licence, unit count, or type metadata changed", call. = FALSE)
}
boundary_licence <- boundary_metadata[["boundaryLicense"]]

# Cabo Verde-centred equal-area projection for land areas (compact, far from antimeridian).
cv_laea <- "+proj=laea +lat_0=16 +lon_0=-24 +datum=WGS84 +units=m +no_defs"

# join the 22 census concelhos one-to-one to the geoBoundaries ADM1 features by shapeName
# (the canonical area_name), then order the layer to the crosswalk row order.
build_boundary <- function(path) {
  boundary <- st_make_valid(st_read(path, quiet = TRUE, stringsAsFactors = FALSE))
  if (nrow(boundary) != 22L) stop("geoBoundaries CPV ADM1 feature count is not 22", call. = FALSE)
  idx <- match(crosswalk$area_name, boundary[["shapeName"]])
  if (anyNA(idx) || anyDuplicated(idx) || !setequal(idx, seq_len(22L))) {
    stop("census concelhos and geoBoundaries features do not join one-to-one by name", call. = FALSE)
  }
  boundary <- boundary[idx, ]
  boundary[["area_name"]] <- crosswalk$area_name
  boundary[["boundary_source_name"]] <- boundary[["shapeName"]]
  boundary[["area_code"]] <- crosswalk$area_code
  boundary[["area_unit_id"]] <- paste(boundary_set_id, crosswalk$area_code, sep = ":")
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- boundary_level
  boundary[["boundary_vintage"]] <- boundary_vintage
  boundary[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(boundary, cv_laea))) / 1e6
  boundary <- st_transform(st_make_valid(boundary), 4326)
  boundary[c("area_code", "area_name", "boundary_source_name", "area_unit_id",
             "boundary_set_id", "boundary_level", "boundary_vintage",
             "land_area_sq_km", "geometry")]
}

boundary <- build_boundary(boundary_path)

# full-extent gate: Cabo Verde spans lon -25.4 to -22.7 E and lat 14.8 to 17.2 N.
bbox <- st_bbox(boundary)
if (bbox[["xmin"]] < -25.6 || bbox[["xmin"]] > -25.0 ||
    bbox[["xmax"]] < -22.9 || bbox[["xmax"]] > -22.4 ||
    bbox[["ymin"]] < 14.6 || bbox[["ymin"]] > 15.0 ||
    bbox[["ymax"]] < 17.0 || bbox[["ymax"]] > 17.4) {
  stop("boundary bbox does not match the expected Cabo Verde extent", call. = FALSE)
}

simplification <- mapshaper_simplify_to_cap(
  boundary, boundary_out,
  max_bytes = 900000L,
  keep_percentages = c(100, 75, 50, 30, 20, 10, 5),
  clean_option = "allow-overlaps"
)
written <- st_read(boundary_out, quiet = TRUE, stringsAsFactors = FALSE)
written <- written[match(boundary[["area_code"]], written[["area_code"]]), ]
if (anyNA(written[["area_code"]])) stop("simplified boundary lost an area code", call. = FALSE)
if (nrow(written) != 22L) stop("simplified boundary does not contain 22 features", call. = FALSE)
w_valid <- st_is_valid(written)
if (any(st_is_empty(written)) || any(is.na(w_valid)) || any(!w_valid)) {
  stop("simplified boundary has empty or invalid geometries", call. = FALSE)
}
geom_hashes <- geometry_hashes(written)
if (length(unique(geom_hashes)) != 22L) stop("simplified boundary geometry hashes are not distinct", call. = FALSE)
message(sprintf("boundary: PASSED (22 valid distinct features, %d bytes at %g%% keep)",
                file_bytes(boundary_out), simplification[["keep_percent"]]))

land_area <- setNames(round(written[["land_area_sq_km"]], 4), crosswalk$area_code)
area_unit <- setNames(written[["area_unit_id"]], crosswalk$area_code)
area_code_v <- setNames(written[["area_code"]], crosswalk$area_code)
area_name_v <- setNames(written[["area_name"]], crosswalk$area_code)

# ---- product rows --------------------------------------------------------------
# slot design (ordinary two-slot, BZ/SB/FM/KI precedent): religious_affiliation is the
# concelho 15+ population minus the "Sem religiao" line and minus the non-response line;
# no_religion is the single "Sem religiao" line. the non-response line (2010 "ND"; 2021
# "Nao sabe / Nao respondeu") stays in the denominator and in neither slot, so the two
# shares need not sum to 100. Cabo Verde has a real, regionally-varying "Sem religiao"
# category, so no minority-share (task-6) treatment applies.

flag_common <- paste(
  "census_affiliation", "voluntary_question",
  "denominator_population_age_15_plus", "religion_or_spirituality_construct",
  "single_select_reported_religion_or_spirituality",
  "religious_affiliation_percent_excludes_no_religion_and_nonresponse",
  "no_religion_percent_is_sem_religiao_line_only",
  "nonresponse_line_in_denominator_not_in_either_slot",
  "two_shares_need_not_sum_to_100",
  "stable_22_concelho_frame_2010_and_2021",
  "religious_change_withheld_across_2010_2021_instrument_break",
  "licence_needs_review_ine_politica_de_difusao_free_universal_access_build_then_ask",
  "boundary_odbl_1_0_openstreetmap",
  sep = ";")

flag_by_year <- list(
  `2010` = paste("frame_2010_fourteen_category_integer_counts", "no_religion_line=Sem religiao",
                 "nonresponse_line=ND", flag_common, sep = ";"),
  `2021` = paste("frame_2021_fifteen_category_integer_counts", "no_religion_line=Sem religiao",
                 "nonresponse_line=Nao sabe / Nao respondeu", flag_common, sep = ";"))

basis_by_year <- list(
  `2010` = paste(
    "IV Recenseamento Geral da Populacao e Habitacao (Censo 2010), Cabo Verde em Numeros",
    "national workbook, sheet Relig_3 (Tabela 12): Populacao residente com 15 anos ou mais",
    "segundo a religiao por sexo e concelho. The denominator is the printed concelho 15+",
    "Total; religious affiliation is that total minus the 'Sem religiao' line and minus",
    "the 'ND' non-response line."),
  `2021` = paste(
    "V Recenseamento Geral da Populacao e Habitacao (Censo 2021), per-concelho Quadros por",
    "Concelho workbook, sheet RELIGIAO_1 (Tabela 54): Populacao residente no concelho com",
    "15 anos ou mais segundo religiao ou espiritualidade pelo meio de residencia e o sexo.",
    "The denominator is the printed concelho 15+ Total; religious affiliation is that total",
    "minus the 'Sem religiao' line and minus the 'Nao sabe / Nao respondeu' non-response line."))

# build one schema-shaped area-summary row, carrying the verbatim per-concelho category
# breakdown on the quality flag (source_categories_verbatim pattern).
make_row <- function(code, year, counts, total, cats, no_rel_label, non_resp_label,
                     flag, basis, dataset_id) {
  no_rel <- counts[[no_rel_label]]
  non_resp <- counts[[non_resp_label]]
  affiliation <- total - no_rel - non_resp
  aff_pct <- round(100 * affiliation / total, 4)
  no_pct <- round(100 * no_rel / total, 4)
  breakdown <- paste(vapply(cats, function(c) paste0(c, "=", as.integer(counts[[c]])), character(1)),
                     collapse = ";")
  full_flag <- paste0(flag, ";source_categories_verbatim=", breakdown)
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = unname(area_unit[[code]]),
    area_code = unname(area_code_v[[code]]),
    area_name = unname(area_name_v[[code]]),
    year = as.integer(year),
    population_total = as.integer(total),
    population_total_basis = basis,
    religious_affiliation_count = as.integer(affiliation),
    religious_affiliation_percent = aff_pct,
    no_religion_count = as.integer(no_rel),
    no_religion_percent = no_pct,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = unname(land_area[[code]]),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(dataset_id, d_boundary),
    quality_flag = full_flag
  )
}

rows <- list()
for (code in crosswalk$area_code) {
  rows[[length(rows) + 1L]] <- make_row(code, 2010L, wave_2010[[code]]$counts,
    wave_2010[[code]]$total, cat_2010, no_rel_label_2010, non_resp_label_2010,
    flag_by_year[["2010"]], basis_by_year[["2010"]], d2010)
}
for (code in crosswalk$area_code) {
  rows[[length(rows) + 1L]] <- make_row(code, 2021L, wave_2021[[code]]$counts,
    wave_2021[[code]]$total, cat_2021, no_rel_label_2021, non_resp_label_2021,
    flag_by_year[["2021"]], basis_by_year[["2021"]], d2021)
}

# ---- licence text --------------------------------------------------------------
licence_text <- paste(
  "The National Statistics Institute of Cabo Verde (Instituto Nacional de Estatistica,",
  "INE; www.ine.cv) publishes no explicit open-data reuse licence and asserts no explicit",
  "all-rights-reserved copyright over its statistical tables. INE's Politica de Difusao",
  "(Dissemination Policy, PDF, principle 10, retrieved 2026-07-12) states: 'O acesso a",
  "informacao estatistica produzida pelo INE e tendencialmente gratuito e universal. Toda",
  "a informacao estatistica disponivel em www.ine.cv, pode ser acedida gratuitamente.'",
  "(Access to the statistical information produced by INE is generally free and universal;",
  "all statistical information available at www.ine.cv can be accessed free of charge.)",
  "Statistical confidentiality (segredo estatistico, Lei n. 48/IX/2019 do Sistema",
  "Estatistico Nacional, art. 10) protects only individual microdata, which this product",
  "never touches. Under the standing BUILD-THEN-ASK ruling the derived concelho summaries",
  "ship with attribution to INE (source line 'Fonte: INE, Censo 2010 / Censo 2021');",
  "licence_status is needs_review and an INE reuse-confirmation ask is recorded for the PI.",
  "The boundary is Open Data Commons Open Database License 1.0 (OpenStreetMap).")

ine_attribution <- "Fonte: Instituto Nacional de Estatistica (INE), Cabo Verde, Censo 2010 e Censo 2021."

# ---- area-summary document -----------------------------------------------------

source_datasets <- function() {
  list(
    list(
      source_dataset_id = d2010,
      name = "Cabo Verde 2010 Census (RGPH 2010), Cabo Verde em Numeros national workbook, Tabela 12: Populacao residente com 15 anos ou mais segundo a religiao por sexo e concelho",
      provider = "Instituto Nacional de Estatistica (INE), Cabo Verde",
      url = url_2010, retrieval_date = retrieval_date, local_path = path_2010,
      licence = list(name = licence_text, url = ine_home, attribution = ine_attribution),
      citation = "INE Cabo Verde, IV Recenseamento Geral da Populacao e Habitacao (Censo 2010), Cabo Verde em Numeros, Tabela 12.",
      access_limits = NULL,
      redistribution_limits = "Derived concelho summaries ship with attribution to INE under BUILD-THEN-ASK (needs_review); the raw census workbook is not committed.",
      notes = paste("Integer counts; 14-category frame; universe is resident population aged 15+ (voluntary",
                    "religion question). Both margins close exactly: every concelho internal sum equals its",
                    "printed Total, every category sums across the 22 concelhos to the national Tabela 12 total,",
                    "and the grand total is 336,049. No cell suppression.")),
    list(
      source_dataset_id = d2021,
      name = "Cabo Verde 2021 Census (RGPH 2021), Quadros por Concelho workbooks, Tabela 54: Populacao residente no concelho com 15 anos ou mais segundo religiao ou espiritualidade",
      provider = "Instituto Nacional de Estatistica (INE), Cabo Verde",
      url = url_2021_api, retrieval_date = retrieval_date, local_path = raw_dir,
      licence = list(name = licence_text, url = ine_home, attribution = ine_attribution),
      citation = "INE Cabo Verde, V Recenseamento Geral da Populacao e Habitacao (Censo 2021), Quadros por Concelho, Tabela 54.",
      access_limits = NULL,
      redistribution_limits = "Derived concelho summaries ship with attribution to INE under BUILD-THEN-ASK (needs_review); the 22 raw per-concelho workbooks are not committed.",
      notes = paste("Integer counts; 15-category frame (religion or spirituality); universe is resident",
                    "population aged 15+ (voluntary question). Both margins close exactly: every concelho",
                    "internal sum equals its printed Total, every category sums across the 22 per-concelho",
                    "workbooks to the national Tabela 52 total, and the grand total is 352,494. The per-concelho",
                    "workbook spellings vary trivially; the national Tabela 52 spelling is the canonical frame.")),
    list(
      source_dataset_id = d_boundary,
      name = "geoBoundaries CPV ADM1 (22 concelhos)",
      provider = "geoBoundaries (William & Mary geoLab); boundary source OpenStreetMap",
      url = boundary_url, retrieval_date = retrieval_date, local_path = boundary_path,
      licence = list(name = boundary_licence, url = boundary_meta_url,
                     attribution = "geoBoundaries (gbOpen); boundary source (c) OpenStreetMap contributors, ODbL"),
      citation = "geoBoundaries CPV ADM1 (gbOpen, pinned 9469f09), 22 concelho boundaries.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary is committed under Open Data Commons Open Database License 1.0 (share-alike; attribution to OpenStreetMap contributors).",
      notes = paste("22 ADM1 concelhos, boundaryYearRepresented 2017, joined one-to-one to the census concelhos",
                    "by shapeName. The extent spans lon -25.4 to -22.7E and lat 14.8 to 17.2N, far from the",
                    "antimeridian; no dateline handling is needed."))
  )
}

indicators <- function() {
  denom_note <- paste(
    "Percentages use each concelho's resident-population-15+ Total. The non-response line",
    "(2010 'ND'; 2021 'Nao sabe / Nao respondeu') stays in the denominator and in neither",
    "share, so the two headline shares need not sum to 100%.")
  list(
    list(indicator_id = "population_total", label = "Census population aged 15+ (religion universe)",
         description = "Concelho resident population aged 15 and over represented in the religion/spirituality table.",
         unit = "count", denominator_indicator_id = NULL,
         method = "Printed concelho Total from the 2010 Tabela 12 and the 2021 Tabela 54 religion tables.",
         temporal_coverage = "2010; 2021", spatial_coverage = "Cabo Verde concelhos (22)",
         quality_notes = paste("The religion/spirituality question is voluntary and asked of residents aged 15 and over,",
                               "so the universe is the published resident population aged 15+ (national 336,049 in 2010 and",
                               "352,494 in 2021), not the whole population.")),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
         description = "Share of the concelho population aged 15+ reporting affiliation with a named religion or spirituality.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (population_15plus - Sem religiao - non-response) / population_15plus.",
         temporal_coverage = "2010; 2021", spatial_coverage = "Cabo Verde concelhos (22)",
         quality_notes = paste("Two waves (2010, 2021) on the stable 22-concelho frame. The category frame changed",
                               "across the 2010->2021 instrument break (2021 splits Igreja do Nazareno / Protestante,",
                               "adds a Mormon line, renames Islamica -> Islamica / Muculmano and ND -> Nao sabe / Nao",
                               "respondeu), so fine-category change is not asserted; the headline affiliation and",
                               "no-religion shares are comparable across waves.", denom_note)),
    list(indicator_id = "no_religion_percent", label = "No religion %",
         description = "Share of the concelho population aged 15+ in the census 'Sem religiao' line.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * Sem religiao / population_15plus.",
         temporal_coverage = "2010; 2021", spatial_coverage = "Cabo Verde concelhos (22)",
         quality_notes = paste("The national no-religion share rose from 10.8% in 2010 (36,272 / 336,049) to 15.6% in",
                               "2021 (54,814 / 352,494); the construct is the share reporting 'Sem religiao', read within",
                               "each concelho's own 15+ denominator.", denom_note))
  )
}

visual_layers <- function() {
  list(
    list(visual_layer_id = "cv-concelho-religious-affiliation", label = "Religious affiliation %",
         description = "Cabo Verde census affiliation share by concelho (2010, 2021).", layer_type = "choropleth",
         indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "concelho resident population aged 15+"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "reported concelho value", uncertainty_display = "quality_flag",
         default_visibility = TRUE,
         notes = "Census affiliation (voluntary question, aged 15+), not practice, attendance, or membership. Two waves."),
    list(visual_layer_id = "cv-concelho-no-religion", label = "No religion %",
         description = "Cabo Verde census no-religion share by concelho (2010, 2021).", layer_type = "choropleth",
         indicator_ids = list("no_religion_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "concelho resident population aged 15+"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "reported concelho value", uncertainty_display = "quality_flag",
         default_visibility = FALSE,
         notes = "The source category is 'Sem religiao'. The non-response line stays in the denominator; the two shares need not sum to 100.")
  )
}

summary_product <- list(
  schema_version = "area-summary.v1", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code,
                      level = boundary_level, vintage = boundary_vintage, source_dataset_id = d_boundary),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "No governed place-of-worship snapshot ships in the Cabo Verde census product.",
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
      religious_affiliation_count = r[["religious_affiliation_count"]],
      religious_affiliation_percent = r[["religious_affiliation_percent"]],
      no_religion_count = r[["no_religion_count"]],
      no_religion_percent = r[["no_religion_percent"]],
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
  list(uri = path, url = url, format = format,
       bytes = if (file.exists(path)) file_bytes(path) else 0L,
       sha256 = if (file.exists(path)) sha256_file(path) else NULL,
       row_count = NULL, source_dataset_id = dataset_id, used_in_public_product = used,
       periods = periods, notes = notes,
       local_cache_hint = paste0(path, " (git-ignored by .gitignore data/ rule)"),
       raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/cv_census/"))
}

durable_file_record <- function(path, content, licence_status_value, licence_basis_value) {
  list(uri = paste0("repo:", path), storage_provider = "git_repository", format = sub("^.*\\.", "", path),
       bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = if (grepl("area_summary|\\.csv$", path)) row_count_file(path) else NULL,
       feature_count = if (grepl("\\.geojson$", path)) row_count_file(path) else NULL,
       content = content, privacy = "public",
       licence_status = licence_status_value, licence_basis = licence_basis_value)
}

licence_basis_slug <- "ine_cv_attribution_build_then_ask"

# per-concelho 2021 workbook retrieval records (22 files).
quadros_records <- lapply(seq_len(nrow(crosswalk)), function(i) {
  p <- quadros_path(crosswalk$slug_2021[i])
  raw_source_record(p,
    "https://bdmi.ine.cv/site_deploy_api/api/GenericFile/GetFile?publicationType=censo",
    "xlsx", TRUE, "2021", d2021,
    paste0("2021 Quadros por Concelho workbook for ", crosswalk$area_name[i],
           "; sheet RELIGIAO_1 (Tabela 54), religion or spirituality by residence and sex, aged 15+."))
})

raw_sources <- c(list(
  raw_source_record(path_2010, url_2010, "xls", TRUE, "2010", d2010,
    "2010 Cabo Verde em Numeros national workbook; sheet Relig_3 (Tabela 12), religion by sex and concelho, aged 15+. Both margins close to 336,049."),
  raw_source_record(path_2021_nat, url_2021_nat, "xlsx", FALSE, "2021", d2021,
    "2021 Cabo Verde em Numeros - CORRIGIDO national workbook; sheet RELIGIAO_ESPIRITUALIDADE_1 (Tabela 52), national religion or spirituality, aged 15+. Source of the national control totals (national 352,494). Religion is not cross-tabbed by concelho in this national file; the concelho values come from the per-concelho Quadros workbooks."),
  raw_source_record(path_politica, url_politica, "pdf", FALSE, "2026", d2010,
    "INE Politica de Difusao (Dissemination Policy) PDF; principle 10 states free and universal access to statistics at www.ine.cv. Licence evidence, not a data source.")),
  quadros_records,
  list(
  raw_source_record(boundary_path, boundary_url, "geojson", TRUE, "2017", d_boundary,
    "geoBoundaries CPV ADM1 GeoJSON; 22 concelhos, ODbL 1.0 (OpenStreetMap). Pinned commit 9469f09."),
  raw_source_record(boundary_meta_path, boundary_meta_url, "json", FALSE, "2017", d_boundary,
    "geoBoundaries CPV ADM1 metadata; records ODbL 1.0, boundaryYearRepresented 2017, admUnitCount 22.")))

dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)
dataset_id <- "cv-census-religion:cv:2010-2021:ine-concelho"

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
  dataset_family = "cv-census-religion", dataset_role = "staged_evidence",
  scope = list(level = "country", country_codes = list("CV"), snapshot_date = NULL,
               snapshot_anchor = NULL, pipeline_stage = "staged"),
  created_at = stamp, created_by = script_id,
  target_years = list(2010L, 2021L),
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census religion or spirituality (voluntary question, residents aged 15+)",
      shipped_waves = list(2010L, 2021L),
      shipped_geography = "22 Cabo Verde concelhos (municipalities), stable across both waves",
      boundary_set = boundary_set_id,
      source_tables = list(
        `2010` = "2010 Cabo Verde em Numeros national workbook, sheet Relig_3 (Tabela 12): religion by sex and concelho, aged 15+ (14 categories)",
        `2021` = "2021 Quadros por Concelho workbooks (22 files), sheet RELIGIAO_1 (Tabela 54): religion or spirituality by residence and sex, aged 15+ (15 categories)"
      ),
      universes = list(
        `2010` = "resident population aged 15 and over (national 336,049); voluntary religion question",
        `2021` = "resident population aged 15 and over (national 352,494); voluntary religion or spirituality question"
      ),
      method_note = paste(
        "Each concelho's religion counts are read verbatim from the INE workbooks and reconciled against the",
        "published national control totals: every concelho internal sum equals its printed 15+ Total, every",
        "category sums across the 22 concelhos to the national table total (Tabela 12 in 2010, Tabela 52 in",
        "2021), and the grand totals are 336,049 (2010) and 352,494 (2021). No value is allocated, inferred,",
        "imputed, rounded, or tuned."
      ),
      denominators = list(
        `2010` = "printed concelho 15+ Total; affiliation = Total - Sem religiao - ND",
        `2021` = "printed concelho 15+ Total; affiliation = Total - Sem religiao - (Nao sabe / Nao respondeu)"
      ),
      slot_design = paste(
        "Ordinary two-slot (BZ/SB/FM/KI precedent). religious_affiliation_percent is the share of the concelho",
        "population aged 15+ reporting a named religion or spirituality (Total minus Sem religiao minus the",
        "non-response line); no_religion_percent is the single Sem religiao line. The non-response line (2010",
        "ND; 2021 Nao sabe / Nao respondeu) stays in the denominator and in neither slot, so the two shares need",
        "not sum to 100. Cabo Verde has a real, regionally-varying Sem religiao category (national 10.8% in 2010,",
        "15.6% in 2021), so no minority-share (task-6) treatment applies."
      ),
      category_frames = list(
        `2010` = as.list(cat_2010),
        `2021` = as.list(cat_2021),
        alignment_note = paste(
          "The category frame changed across the 2010->2021 instrument break: 2021 splits 'Igreja do Nazareno /",
          "Protestante' (2010 'Igreja do Nazareno'), adds 'Jesus Cristo dos Santos dos ultimos dias / Mormons' as",
          "a separate line (folded into Outra in 2010), renames 'Islamica' -> 'Islamica / Muculmano',",
          "'Testemunho de Jeova' -> 'Testemunha de Jeova', and 'ND' -> 'Nao sabe / Nao respondeu', and the",
          "construct is named 'religiao' in 2010 and 'religiao ou espiritualidade' in 2021. Fine-category change",
          "is not asserted across the break; the headline affiliation and no-religion shares are comparable. The",
          "2021 per-concelho workbooks carry trivial spelling variants; the national Tabela 52 spelling is the",
          "canonical rendered frame."
        )
      ),
      change_rule = paste(
        "Two waves (2010, 2021) on the stable 22-concelho frame. Change is withheld on the fine categories across",
        "the instrument break; the headline affiliation and no-religion shares are comparable across waves."
      ),
      no_religion_treatment = list(
        `2010` = "single 'Sem religiao' line (national 36,272; 10.8%); separate 'ND' non-response line kept in denominator",
        `2021` = "single 'Sem religiao' line (national 54,814; 15.6%); separate 'Nao sabe / Nao respondeu' non-response line kept in denominator"
      ),
      voluntary_and_universe_note = paste(
        "The religion/spirituality question is voluntary and asked of residents aged 15 and over. The universe on",
        "every surface is the published resident population aged 15+, not the whole population; the non-response",
        "line rides in the denominator and is disclosed, never repaired."
      ),
      omitted_metrics = list("places_per_10000_residents", "place_density_per_sq_km"),
      boundary_simplification = simplification,
      local_cache_hint = "All raw sources are cached under data/raw/cv_census/ and remain git-ignored.",
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
    provider = "Instituto Nacional de Estatistica (INE), Cabo Verde; geoBoundaries (William & Mary geoLab)",
    source_dataset_ids = list(d2010, d2021, d_boundary),
    source_urls = list(url_2010, url_2021_nat, url_2021_api, url_politica, ine_home, boundary_url, boundary_meta_url),
    retrieved_at = stamp,
    licence = licence_text,
    citation = "INE Cabo Verde, Censo 2010 (Tabela 12) and Censo 2021 (Tabela 54, Quadros por Concelho); geoBoundaries CPV ADM1 (gbOpen).",
    raw_redistribution = "The census workbooks and the geoBoundaries source GeoJSON are not committed; they remain in data/raw/cv_census/.",
    local_cache_hint = "data/raw/cv_census/ (git-ignored by .gitignore data/ rule)",
    raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/cv_census/")
  ),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = list(
    durable_file_record(summary_json_out, "Cabo Verde 22-concelho census religion/spirituality area summary for 2010 and 2021.", "needs_review", licence_basis_slug),
    durable_file_record(summary_csv_out, "Flattened Cabo Verde 22-concelho census religion rows for 2010 and 2021.", "needs_review", licence_basis_slug),
    durable_file_record(boundary_out, "Simplified geoBoundaries CPV ADM1 22-concelho boundary GeoJSON.", "accepted", "geoboundaries_odbl_1_0")
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id,
         notes = "22 concelhos x 2 waves = 44 rows; resident-population-15+ universe; no suppressed cells."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out), built_by = script_id,
         notes = "22 concelho features from geoBoundaries CPV ADM1, simplified with mapshaper weighted keep-shapes.")
  ),
  validation = list(
    status = "passed_with_warnings",
    commands = list(
      paste("Rscript", script_id),
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/cv/data/area_summary_concelho.json",
      "bash scripts/validate_manifests.sh"
    ),
    gate_2010 = list(status = "passed", both_margins_close_to = national_2010,
                     concelho_total_checks = 22L, religion_category_checks = length(cat_2010),
                     records = reconciliation_block(rec_2010)),
    gate_2021 = list(status = "passed", both_margins_close_to = national_2021,
                     concelho_total_checks = 22L, religion_category_checks = length(cat_2021),
                     records = reconciliation_block(rec_2021)),
    boundary_validation = list(status = "passed", feature_count = 22L,
                               distinct_geometry_hashes = length(unique(geom_hashes)),
                               geometry_hashes = as.list(geom_hashes),
                               bbox = list(xmin = unname(bbox[["xmin"]]), ymin = unname(bbox[["ymin"]]),
                                           xmax = unname(bbox[["xmax"]]), ymax = unname(bbox[["ymax"]])),
                               dateline_note = "extent lon -25.4 to -22.7E, lat 14.8 to 17.2N; far from the antimeridian, no dateline handling needed",
                               output_bytes = file_bytes(boundary_out), simplification = simplification,
                               licence = boundary_licence, adm_unit_count = boundary_metadata[["admUnitCount"]]),
    join_coverage = list(matched_concelhos = 22L, expected_concelhos = 22L, unmatched_concelhos = list(), unused_boundary_features = list()),
    notes = paste(
      "2010 (Tabela 12) closes integer-exact at both margins (national 336,049); 2021 (22 per-concelho Tabela 54",
      "workbooks) closes integer-exact at both margins (national 352,494). Boundary joins 22/22 to geoBoundaries",
      "CPV ADM1 by shapeName with 22 distinct geometry hashes."
    ),
    warnings = list(
      "STAGED product: no page, no hub link. The page decision is the conductor's.",
      "Licence needs_review: INE publishes no explicit reuse licence; the Politica de Difusao (principle 10) states free and universal access to statistics at www.ine.cv, and segredo estatistico protects only individual microdata. Ships with attribution under BUILD-THEN-ASK; an INE reuse-confirmation ask is recorded for the PI.",
      "The religion/spirituality question is voluntary and asked of residents aged 15+; the universe on every surface is the published resident population aged 15+, and the non-response line (2010 ND; 2021 Nao sabe / Nao respondeu) rides in the denominator, disclosed, never repaired.",
      "The category frame changed across the 2010->2021 instrument break; fine-category change is not asserted, the headline affiliation and no-religion shares are comparable.",
      "The two headline shares need not sum to 100 (the non-response line stays in the denominator and in neither slot)."
    )
  ),
  construct_notes = list(
    "The construct is census religion or spirituality: each resident's reported religion (2010) or religion/spirituality (2021), asked of the resident population aged 15 and over as a voluntary question, not practice, attendance, or membership.",
    "The public product carries three headline fields per concelho-wave: population aged 15+, religious affiliation percent, and no-religion percent. Place-density metrics are null (no governed place-of-worship snapshot).",
    "Two waves (2010, 2021) on the stable 22-concelho frame. The 2010 concelho counts come from the national workbook Tabela 12 (religion by sex and concelho); the 2021 concelho counts come from the 22 per-concelho Quadros workbooks Tabela 54 (the 2021 national workbook publishes religion only nationally).",
    "The religion/spirituality question is voluntary and asked of residents aged 15+; the universe on every surface is the published resident population aged 15+ (336,049 in 2010, 352,494 in 2021), and the non-response line rides in the denominator, disclosed, never repaired.",
    "Slot design (ordinary two-slot, BZ/SB/FM/KI precedent): religious_affiliation_percent is the share reporting a named religion or spirituality (Total minus Sem religiao minus the non-response line); no_religion_percent is the single Sem religiao line. Cabo Verde has a real, regionally-varying Sem religiao category, so no minority-share (task-6) treatment applies; the two shares need not sum to 100.",
    "Licence needs_review under BUILD-THEN-ASK: INE's Politica de Difusao (principle 10) states free and universal access to published statistics at www.ine.cv, and segredo estatistico protects only individual microdata; no explicit reuse grant was found, so the derived concelho summaries ship with attribution to INE and an INE reuse-confirmation ask is recorded for the PI. The boundary is geoBoundaries CPV ADM1, 22 concelhos, Open Data Commons Open Database License 1.0 (OpenStreetMap), joined one-to-one by shapeName."
  ),
  deferred_sources = list(
    list(source_dataset_id = "cv-census-2021-religion-by-age-and-residence", status = "deferred",
         url = url_2021_api, local_path = raw_dir,
         notes = "The 2021 per-concelho workbooks also carry Tabela 55 (religion by age group) and the residence (urbano/rural) and sex splits of Tabela 54; only the concelho totals are shipped. Documented, not used."),
    list(source_dataset_id = "cv-census-2010-religion-by-age-and-residence", status = "deferred",
         url = url_2010, local_path = path_2010,
         notes = "The 2010 workbook carries religion by age group (Tabela 11) and by residence/sex (Tabela 10); only the concelho totals (Tabela 12) are shipped. Documented, not used."),
    list(source_dataset_id = "ine-cv-reuse-confirmation", status = "not_pinned",
         url = ine_home, local_path = NULL,
         notes = "An INE reuse-confirmation would move the licence from needs_review to accepted; recorded as a courtesy ask for the PI (do not send).")
  ),
  privacy = "public",
  licence_status = "needs_review",
  licence_basis = licence_basis_slug,
  downstream_status = "staged",
  source_datasets = source_datasets(),
  notes = paste(
    "STAGED product (no page, no hub link). The committed products are the derived 22-concelho area summary (44",
    "rows: 22 concelhos x 2 waves) and the simplified geoBoundaries CPV ADM1 boundary. Licence needs_review (INE",
    "Politica de Difusao free-and-universal-access; ships with attribution under BUILD-THEN-ASK, INE reuse ask",
    "recorded for the PI); boundary ODbL 1.0 (OpenStreetMap). Two-wave concelho product on a stable frame; the",
    "page decision is the conductor's."
  )
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

cat("waves shipped: 2010 and 2021 on 22 Cabo Verde concelhos\n")
cat(sprintf("rows: %d (22 concelhos x 2 waves)\n", length(rows)))
cat(sprintf("gate 2010: passed integer-exact; both margins close to %d\n", national_2010))
cat(sprintf("gate 2021: passed integer-exact; both margins close to %d\n", national_2021))
cat(sprintf("boundary gate: passed; 22/22 join, %d distinct geometry hashes, %d bytes at %g%% keep\n",
            length(unique(geom_hashes)), file_bytes(boundary_out), simplification[["keep_percent"]]))
cat("licence gate: needs_review; INE Politica de Difusao free-and-universal access; BUILD-THEN-ASK attribution\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", boundary_out))
cat(sprintf("wrote %s\n", manifest_out))
