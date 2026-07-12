# build the North Macedonia municipality census-religion area-summary product for the
# single 2021 wave on the 80-municipality frame. religion is transcribed verbatim from
# the official State Statistical Office (SSO) 2021 census book, English edition, table
# T-06 "Total resident population by religious affiliation and sex, by municipalities",
# which prints thirteen religion categories across the eighty municipalities plus a City
# of Skopje aggregate and the national row. the 2002 wave is HELD, not shipped: the 2002
# census religion table (Book X, "ethnic affiliation, mother tongue and religion") is on
# the pre-2004 (1996) 123-municipality frame, for which no licensed boundary exists; the
# 2004 re-tabulation (Book XIII) carries total population and ethnicity but NOT religion.
# see research/countries/mk/route-probe.md for full provenance, the 2002 hold, and sha256.
#   inputs (all cached, git-ignored under data/raw/mk_census/):
#   mk_2021_census_book_en.pdf   <- SSO 2021 census book (EN); table T-06 parsed here
#   codab/mkd_admbnda_adm2_2025_AB.shp <- OCHA COD-AB 2025 ADM2 (80 units, CC BY-IGO)
#   hdx_mkd_codab.json           <- HDX licence metadata for the boundary (cc-by-igo)
# every religion cell is parsed verbatim from the cached PDF (pdftotext -layout) and
# reconciled against the printed control totals; the build STOPS on any margin mismatch
# and never allocates, infers, rounds, imputes, redistributes, or tunes a value. a "-"
# reads as nil. the administratively-sourced universe component and the non-response
# residuals are rendered as published, never repaired.
# outputs: apps/regions/mk/data/{mk_municipality_2021.geojson, area_summary_municipality.json,
#   area_summary_municipality.csv} and docs/manifests/mk-census-religion-2021.json.
# run from the repo root: Rscript scripts/build_mk_area_summary.R

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "MK"
script_id <- "scripts/build_mk_area_summary.R"
raw_dir <- "data/raw/mk_census"
product_dir <- "apps/regions/mk/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-12"
stamp <- paste0(retrieval_date, "T00:00:00Z")
git_commit <- trimws(system2("git", c("rev-parse", "HEAD"), stdout = TRUE))
if (length(git_commit) != 1L || !grepl("^[a-f0-9]{40}$", git_commit)) git_commit <- NULL

# ---- dataset ids ---------------------------------------------------------------
d2021 <- "mk-census-2021-book-t06-religion-by-municipality"
d_cod <- "ocha-codab-mkd-adm2-2025"
boundary_set_2021 <- "mk-municipality-2021-ocha-codab-adm2"

# ---- source urls and cached paths ----------------------------------------------
url_2021_book <- "https://www.stat.gov.mk/publikacii/2022/POPIS_DZS_web_EN.pdf"
url_2021_book_mk <- "https://www.stat.gov.mk/publikacii/2022/POPIS_DZS_web_MK.pdf"
url_cod <- "https://data.humdata.org/dataset/f7b918d3-9633-4142-8ae5-2358ca87ff3f/resource/9ac00088-e0d1-47b0-a4cd-06500776e93b/download/mkd_adm_2025_ab_shp.zip"
url_cod_meta <- "https://data.humdata.org/api/3/action/package_show?id=cod-ab-mkd"
url_terms <- "https://www.stat.gov.mk/KopjrajtStatistika_en.aspx"

path_book_en <- file.path(raw_dir, "mk_2021_census_book_en.pdf")
path_book_mk <- file.path(raw_dir, "mk_2021_census_book_mk.pdf")
path_cod_zip <- file.path(raw_dir, "mkd_codab_2025_shp.zip")
path_cod_shp <- file.path(raw_dir, "codab/mkd_admbnda_adm2_2025_AB.shp")
path_cod_meta <- file.path(raw_dir, "hdx_mkd_codab.json")

geojson_out <- file.path(product_dir, "mk_municipality_2021.geojson")
summary_json_out <- file.path(product_dir, "area_summary_municipality.json")
summary_csv_out <- file.path(product_dir, "area_summary_municipality.csv")
manifest_out <- file.path(manifest_dir, "mk-census-religion-2021.json")

sha256_file <- function(path) unname(tools::sha256sum(path))
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))
require_file <- function(path) {
  if (!file.exists(path) || file_bytes(path) == 0L) stop("missing required source: ", path, call. = FALSE)
}
invisible(lapply(c(path_book_en, path_cod_shp, path_cod_meta), require_file))

# ---- verbatim category frame (EN from the SSO English edition; MK from the MK edition) ----
# thirteen religion categories, printed order of table T-06. the last three
# (Undeclared, Unknown, Taken-from-administrative-sources) are denominator residuals.
cats13 <- c("Orthodox", "Muslim (Islam)", "Catholic", "Christian", "Protestant",
            "Evangelical", "Evangelical Methodist", "Jehovah's Witnesses", "Other",
            "Non-believer (atheist)", "Undeclared", "Unknown",
            "Taken from administrative sources")
cats13_mk <- c("Православни", "Муслимани (ислам)", "Католици", "Христијани", "Протестанти",
               "Евангелисти", "Евангелисти-методисти", "Јеховини сведоци", "Друго",
               "Не е верник (атеист)", "Не се изјаснил", "Непознато",
               "Лица за кои податоците се преземени од административни извори")
names(cats13_mk) <- cats13
affiliation_cats <- c("Orthodox", "Muslim (Islam)", "Catholic", "Christian", "Protestant",
                      "Evangelical", "Evangelical Methodist", "Jehovah's Witnesses", "Other")
no_religion_cat <- "Non-believer (atheist)"
residual_cats <- c("Undeclared", "Unknown", "Taken from administrative sources")

# printed national control totals (REPUBLIC OF NORTH MACEDONIA row of table T-06).
nat_anchor <- c("Orthodox" = 847390L, "Muslim (Islam)" = 590878L, "Catholic" = 6746L,
                "Christian" = 242579L, "Protestant" = 1313L, "Evangelical" = 678L,
                "Evangelical Methodist" = 889L, "Jehovah's Witnesses" = 1137L,
                "Other" = 1221L, "Non-believer (atheist)" = 8764L, "Undeclared" = 1964L,
                "Unknown" = 894L, "Taken from administrative sources" = 132260L)
nat_total <- 1836713L
national_name <- "REPUBLIC OF NORTH MACEDONIA"
skopje_aggregate_name <- "City of Skopje"
skopje_10 <- c("Aerodrom", "Butel", "Gazi Baba", "Gjorche Petrov", "Karposh",
               "Kisela Voda", "Saraj", "Centar", "Chair", "Shuto Orizari")

# ---- parse table T-06 from the cached PDF (self-contained, fail-fast) -----------
# the table prints the eighty municipalities in seven column groups of two categories
# each (group 1 carries Population + Orthodox); every group repeats the municipality
# rows in the same order. we read each group's two category TOTAL columns (the first of
# every Total/Male/Female triple) and join by municipality name across groups.
book_txt <- tempfile(fileext = ".txt")
on.exit(unlink(book_txt), add = TRUE)
extract_ok <- system2("pdftotext", c("-layout", shQuote(path_book_en), shQuote(book_txt)),
                      stdout = FALSE, stderr = FALSE)
if (!file.exists(book_txt) || file_bytes(book_txt) == 0L) {
  stop("pdftotext failed to extract the 2021 census book text", call. = FALSE)
}
lines <- readLines(book_txt, warn = FALSE, encoding = "UTF-8")

# group starts: the seven table-T-06 label lines carry the phrase below; the table ends
# at the T-07 mother-tongue table. detection is by content, never by fixed line numbers.
start_marker <- "TOTAL RESIDENT POPULATION IN THE REPUBLIC OF NORTH MACEDONIA BY"
# a group STARTS on the page whose first token is the table label "Т-06"; the
# continuation page carries the label at the end of the line and is not a start.
starts <- which(grepl(start_marker, lines, fixed = TRUE) & grepl("^\\s*\\S*-06", lines, perl = TRUE))
if (length(starts) != 7L) stop("expected 7 T-06 column groups, found ", length(starts), call. = FALSE)
end_idx <- which(grepl("MOTHER TONGUE AND SEX, CENSUS 2021", lines, fixed = TRUE))
end_idx <- end_idx[end_idx > starts[7]][1]
if (is.na(end_idx)) end_idx <- length(lines) + 1L
bounds <- c(starts, end_idx)

# group index -> the two categories printed in that group (fixed table design).
group_cats <- list(
  c("_population", "Orthodox"),
  c("Muslim (Islam)", "Catholic"),
  c("Christian", "Protestant"),
  c("Evangelical", "Evangelical Methodist"),
  c("Jehovah's Witnesses", "Other"),
  c("Non-believer (atheist)", "Undeclared"),
  c("Unknown", "Taken from administrative sources"))
# header words that must appear in each group (drift guard).
group_assert <- list("ORTHODOX", c("MUSLIM (ISLAM)", "CATHOLIC"), c("CHRISTIAN", "PROTESTANT"),
                     "EVANGELICAL", c("JEHOVAH", "OTHER"), c("NON-BELIEVER", "UNDECLARED"),
                     c("UNKNOWN", "ADMINISTRATIVE"))

skip_exact <- c("TOTAL", "MALE", "FEMALE", "POPULATION", "ORTHODOX", "CATHOLIC", "CHRISTIAN",
                "PROTESTANT", "EVANGELICAL", "UNKNOWN", "UNDECLARED", "OTHER", "SOURCES", "MACEDONIA")
skip_prefix <- c("CENSUS OF POPULATION", "RELIGIOUS AFFILIATION", "MUSLIM", "JEHOVAH",
                 "NON-BELIEVER", "TAKEN FROM", "REPUBLIC OF", "EVANGELICAL METHODIST")
is_row_name <- function(name) {
  u <- toupper(trimws(name))
  if (u %in% skip_exact) return(FALSE)
  if (any(startsWith(u, skip_prefix))) return(FALSE)
  if (grepl("-06", u, fixed = TRUE)) return(FALSE)
  TRUE
}
parse_num <- function(tok) {
  tok <- trimws(tok)
  if (tok %in% c("-", "")) return(0L)
  as.integer(gsub("[ ,]", "", tok))
}

# data[[municipality]] is a named integer vector over the thirteen categories + _population.
data_env <- new.env(parent = emptyenv())
for (g in seq_len(7L)) {
  seg <- lines[bounds[g]:(bounds[g + 1L] - 1L)]
  seg_up <- toupper(paste(seg, collapse = " "))
  for (w in group_assert[[g]]) {
    if (!grepl(w, seg_up, fixed = TRUE)) {
      stop(sprintf("group %d header drift: expected '%s' not found", g, w), call. = FALSE)
    }
  }
  cat_a <- group_cats[[g]][1]; cat_b <- group_cats[[g]][2]
  for (i in seq_along(seg)) {
    ln <- seg[i]
    # skip the national number line (pure numbers adjacent to the REPUBLIC label).
    if (grepl("^\\s*[0-9-]", ln)) {
      ctx <- paste0(if (i > 1L) seg[i - 1L] else "", if (i < length(seg)) seg[i + 1L] else "")
      if (grepl("REPUBLIC OF|MACEDONIA", ctx) && grepl("^[0-9 -]+$", trimws(ln))) next
    }
    m <- regmatches(ln, regexec("^\\s*(?:[0-9]{1,3}\\s+)?([A-Za-z][A-Za-z .'’–-]+?)\\s{2,}([0-9-].*)$", ln, perl = TRUE))[[1]]
    if (length(m) != 3L) next
    name <- trimws(m[2])
    if (!is_row_name(name)) next
    toks <- strsplit(trimws(m[3]), "\\s{2,}", perl = TRUE)[[1]]
    vals <- vapply(toks, parse_num, integer(1))
    if (length(vals) < 6L) next
    rec <- if (exists(name, envir = data_env, inherits = FALSE)) get(name, envir = data_env) else integer(0)
    rec[cat_a] <- vals[1]
    rec[cat_b] <- vals[4]
    assign(name, rec, envir = data_env)
  }
}

row_names <- ls(data_env)
munis <- setdiff(row_names, skopje_aggregate_name)
if (length(munis) != 80L) stop("expected 80 municipalities, parsed ", length(munis), call. = FALSE)
if (!(skopje_aggregate_name %in% row_names)) stop("City of Skopje aggregate row missing", call. = FALSE)

# assemble the 80 x 13 matrix in a stable municipality order.
munis <- sort(munis)
mat <- matrix(0L, nrow = length(munis), ncol = length(cats13), dimnames = list(munis, cats13))
pop <- integer(length(munis)); names(pop) <- munis
for (n in munis) {
  rec <- get(n, envir = data_env)
  if (is.na(rec["_population"])) stop("missing population for ", n, call. = FALSE)
  pop[n] <- rec["_population"]
  for (c in cats13) {
    v <- rec[c]
    if (is.na(v)) stop(sprintf("missing category '%s' for %s", c, n), call. = FALSE)
    mat[n, c] <- v
  }
}

# ---- reconciliation gates (fail-fast; stop, do not tune) -----------------------
recs <- list()
# gate 1: each municipality's thirteen categories sum to its printed population total.
for (n in munis) {
  s <- sum(mat[n, ])
  if (s != pop[n]) stop(sprintf("municipality gate FAILED for %s: categories sum %d != population %d", n, s, pop[n]), call. = FALSE)
  recs[[length(recs) + 1L]] <- data.frame(margin = "municipality_row", key = n, computed = s, printed = unname(pop[n]), difference = 0L, stringsAsFactors = FALSE)
}
# gate 2: each religion column sums to the printed national anchor.
for (c in cats13) {
  s <- sum(mat[, c])
  if (s != nat_anchor[[c]]) stop(sprintf("religion-column gate FAILED for %s: municipality sum %d != printed national %d", c, s, nat_anchor[[c]]), call. = FALSE)
  recs[[length(recs) + 1L]] <- data.frame(margin = "religion_column", key = c, computed = s, printed = unname(nat_anchor[[c]]), difference = 0L, stringsAsFactors = FALSE)
}
# gate 3: municipality populations sum to the printed national total.
if (sum(pop) != nat_total) stop(sprintf("grand gate FAILED: municipality population sum %d != printed national %d", sum(pop), nat_total), call. = FALSE)
# gate 4: national categories sum to the national total.
if (sum(nat_anchor) != nat_total) stop("national category-sum gate FAILED", call. = FALSE)
# gate 5: the City of Skopje aggregate equals the sum of its ten constituent municipalities.
skopje_rec <- get(skopje_aggregate_name, envir = data_env)
for (c in c(cats13, "_population")) {
  agg_v <- skopje_rec[c]; part_v <- if (c == "_population") sum(pop[skopje_10]) else sum(mat[skopje_10, c])
  if (is.na(agg_v) || agg_v != part_v) stop(sprintf("Skopje partition gate FAILED for %s: aggregate %s != parts %d", c, agg_v, part_v), call. = FALSE)
}
rec_df <- do.call(rbind, recs)
message(sprintf("gate 2021: PASSED (80 municipality rows, 13 religion columns; both margins close to %d)", nat_total))
message("gate Skopje partition: PASSED (City of Skopje = sum of its 10 municipalities)")

# ---- boundary: OCHA COD-AB 2025 ADM2 (80 municipalities, CC BY-IGO) -------------
cod_meta <- fromJSON(path_cod_meta, simplifyVector = FALSE)
if (!identical(cod_meta[["result"]][["license_id"]], "cc-by-igo")) {
  stop("OCHA COD-AB MKD licence metadata changed", call. = FALSE)
}
# census English municipality name -> COD ADM2_EN name (transliteration crosswalk; the
# fifteen entries differ only by the Cyrillic ц rendered "ts"/"tse"/"tsi" vs "c"/"ce"/"ci".
# every mapping is one-to-one; no geometry is merged or split.
cross <- c(
  "Bogdanci" = "Bogdantsi", "Brvenica" = "Brvenitsa", "Debarca" = "Debartsa",
  "Jegunovce" = "Jegunovtse", "Karbinci" = "Karbintsi", "Kavadarci" = "Kavadartsi",
  "Makedonska Kamenica" = "Makedonska Kamenitsa", "Novaci" = "Novatsi",
  "Petrovec" = "Petrovets", "Plasnica" = "Plasnitsa", "Rankovce" = "Rankovtse",
  "Strumica" = "Strumitsa", "Tearce" = "Teartse", "Vinica" = "Vinitsa",
  "Zrnovci" = "Zrnovtsi")
cod_name_for <- function(muni) if (muni %in% names(cross)) unname(cross[muni]) else muni

cod <- st_make_valid(st_read(path_cod_shp, quiet = TRUE, stringsAsFactors = FALSE))
if (nrow(cod) != 80L) stop("COD-AB MKD ADM2 feature count is not 80", call. = FALSE)
cod[["boundary_source_name"]] <- cod[["ADM2_EN"]]

# a snake_case slug per municipality for stable identifiers.
slugify <- function(x) {
  s <- tolower(x)
  s <- gsub("[^a-z0-9]+", "_", s)
  gsub("^_|_$", "", s)
}
slug <- slugify(munis)
if (anyDuplicated(slug)) stop("municipality slugs are not unique", call. = FALSE)

target <- vapply(munis, cod_name_for, character(1))
idx <- match(target, cod[["boundary_source_name"]])
if (anyNA(idx) || anyDuplicated(idx)) {
  stop("census municipalities and COD features do not join one-to-one: ",
       paste(munis[is.na(idx)], collapse = ", "), call. = FALSE)
}
boundary <- cod[idx, ]
boundary[["area_name"]] <- munis
boundary[["area_code"]] <- slug
boundary[["area_unit_id"]] <- paste(boundary_set_2021, slug, sep = ":")
boundary[["boundary_set_id"]] <- boundary_set_2021
boundary[["boundary_level"]] <- "municipality"
boundary[["boundary_vintage"]] <- "2021 census 80-municipality frame (OCHA COD-AB 2025 ADM2)"
# MK-centred equal-area projection for land areas (no dateline crossing).
mk_laea <- "+proj=laea +lat_0=41.6 +lon_0=21.7 +datum=WGS84 +units=m +no_defs"
boundary[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(boundary, mk_laea))) / 1e6
boundary <- st_transform(st_make_valid(boundary), 4326)
boundary <- boundary[c("area_code", "area_name", "boundary_source_name", "area_unit_id",
                       "boundary_set_id", "boundary_level", "boundary_vintage",
                       "land_area_sq_km", "geometry")]

geometry_hashes <- function(layer) {
  vapply(seq_len(nrow(layer)), function(i) {
    digest(st_as_binary(st_geometry(layer)[i], EWKB = TRUE)[[1L]], algo = "sha256", serialize = FALSE)
  }, character(1))
}
simplification <- mapshaper_simplify_to_cap(
  boundary, geojson_out, max_bytes = 900000L,
  keep_percentages = c(30, 20, 12, 8, 5, 3, 2), clean_option = "allow-overlaps")
written <- st_read(geojson_out, quiet = TRUE, stringsAsFactors = FALSE)
written <- written[match(boundary[["area_code"]], written[["area_code"]]), ]
if (anyNA(written[["area_code"]]) || nrow(written) != 80L) stop("simplified boundary lost a unit", call. = FALSE)
w_valid <- st_is_valid(written)
if (any(st_is_empty(written)) || any(is.na(w_valid)) || any(!w_valid)) stop("simplified boundary invalid", call. = FALSE)
hashes <- geometry_hashes(written)
if (length(unique(hashes)) != 80L) stop("simplified geometry hashes not distinct", call. = FALSE)
land_area <- setNames(written[["land_area_sq_km"]], written[["area_name"]])
bbox <- st_bbox(written)
message(sprintf("boundary 2021: PASSED (80 distinct features, %d bytes at %g%% keep)",
                file_bytes(geojson_out), simplification[["keep_percent"]]))

# ---- product rows (ordinary two-slot design, SB/FM/KZ precedent) ---------------
# religious_affiliation_percent = summed share of the nine affiliation categories;
# no_religion_percent = the single Non-believer (atheist) line. the three residuals
# (Undeclared, Unknown, Taken-from-administrative-sources) stay in the denominator and
# in neither slot, so the two shares need not sum to 100.
flag_common <- paste(
  "census_affiliation", "total_resident_population_universe",
  "single_select_reported_religion",
  "religious_affiliation_percent_is_summed_affiliation_share",
  "no_religion_percent_is_non_believer_atheist_line_only",
  "undeclared_unknown_admin_sources_residuals_in_denominator_neither_slot",
  "administratively_sourced_component_rendered_as_published_never_repaired",
  "shares_need_not_sum_to_100",
  "single_wave_2002_held_frame_break_no_cross_wave_change",
  "sso_copyright_ships_with_attribution_courtesy_ask_recorded",
  sep = ";")
basis_2021 <- paste(
  "2021 Census of Population, Households and Dwellings in the Republic of North Macedonia,",
  "State Statistical Office, book (English edition), table T-06 'Total resident population",
  "by religious affiliation and sex, by municipalities'. The universe is the total resident",
  "population (1,836,713), which includes 132,260 persons whose data were taken from",
  "administrative sources. The denominator is each municipality's printed population total.")

make_row <- function(n) {
  population <- as.integer(pop[n])
  no_rel <- as.integer(mat[n, no_religion_cat])
  affiliation <- as.integer(sum(mat[n, affiliation_cats]))
  aff_pct <- round(100 * affiliation / population, 4)
  no_pct <- round(100 * no_rel / population, 4)
  breakdown <- paste(paste0(cats13_mk[cats13], "=", mat[n, cats13]), collapse = ";")
  full_flag <- paste0(flag_common, ";source_categories_verbatim=", breakdown)
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_2021,
    boundary_level = "municipality",
    area_unit_id = paste(boundary_set_2021, slug[which(munis == n)], sep = ":"),
    area_code = slug[which(munis == n)],
    area_name = n,
    year = 2021L,
    population_total = population,
    population_total_basis = basis_2021,
    religious_affiliation_count = affiliation,
    religious_affiliation_percent = aff_pct,
    no_religion_count = no_rel,
    no_religion_percent = no_pct,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = unname(round(land_area[[n]], 4)),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(d2021, d_cod),
    quality_flag = full_flag
  )
}
rows <- lapply(munis, make_row)

# ---- area-summary document -----------------------------------------------------
census_licence_name <- paste(
  "State Statistical Office of the Republic of North Macedonia. The SSO asserts copyright",
  "('© Државен завод за статистика' / '© State Statistical Office',",
  "stat.gov.mk/KopjrajtStatistika_en.aspx, retrieved 2026-07-12) with no stated open-data",
  "licence; each census book carries the instruction 'When using data contained here,",
  "please cite the source'. Under the project BUILD-THEN-ASK ruling the derived municipality",
  "summaries ship with attribution to the State Statistical Office; an SSO reuse-confirmation",
  "email is the clean courtesy unblock, recorded for the PI.")

source_datasets <- function() {
  list(
    list(
      source_dataset_id = d2021,
      name = "North Macedonia 2021 Census, book table T-06: Total resident population by religious affiliation and sex, by municipalities",
      provider = "State Statistical Office of the Republic of North Macedonia",
      url = url_2021_book, retrieval_date = retrieval_date, local_path = path_book_en,
      licence = list(name = census_licence_name, url = url_terms,
                     attribution = "State Statistical Office of the Republic of North Macedonia, Census of Population, Households and Dwellings 2021"),
      citation = "State Statistical Office of the Republic of North Macedonia, Census of Population, Households and Dwellings, 2021 (book, table T-06).",
      access_limits = NULL,
      redistribution_limits = "SSO asserts copyright with no open-data licence; derived municipality summaries ship with attribution under BUILD-THEN-ASK. The census book PDF is not committed.",
      notes = paste("Total resident population universe (1,836,713), including 132,260 persons whose data were taken from",
                    "administrative sources. Thirteen religion categories; both margins close exactly. English edition parsed;",
                    "Macedonian category names taken verbatim from the Macedonian edition (POPIS_DZS_web_MK.pdf).")),
    list(
      source_dataset_id = d_cod,
      name = "OCHA COD-AB North Macedonia ADM2 (2025), 80 municipalities",
      provider = "OCHA Field Information Services Section; source EuroGeographics and the SSO NTES nomenclature",
      url = url_cod, retrieval_date = retrieval_date, local_path = path_cod_zip,
      licence = list(name = "Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO)", url = url_cod_meta,
                     attribution = "OCHA, Common Operational Dataset - Administrative Boundaries (CC BY-IGO); source EuroGeographics and SSO"),
      citation = "OCHA COD-AB North Macedonia ADM2 (2025), 80 municipalities.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary is committed under CC BY-IGO with attribution to OCHA.",
      notes = "80 ADM2 municipalities matching the 2021 census frame; joined to the census names by a 15-entry Cyrillic-to-Latin transliteration crosswalk (one-to-one, no geometry merged or split).")
  )
}

indicators <- function() {
  denom_note <- paste(
    "Percentages use each municipality's printed total resident population. The Undeclared,",
    "Unknown, and administratively-sourced lines stay in the denominator and outside both",
    "headline numerators, so the two shares need not sum to 100%.")
  list(
    list(indicator_id = "population_total", label = "Total resident population",
         description = "Municipality total resident population represented in census table T-06.",
         unit = "count", denominator_indicator_id = NULL,
         method = "Printed municipality total, 2021 census book table T-06.",
         temporal_coverage = "2021", spatial_coverage = "North Macedonia municipalities (80)",
         quality_notes = "The 2021 total resident population (1,836,713) includes 132,260 persons whose data, including religion, were taken from administrative sources; that component is rendered as its own published category, never repaired or redistributed."),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
         description = "Share of the municipality population reporting affiliation with a named religion (Orthodox, Muslim/Islam, Catholic, Christian, Protestant, Evangelical, Evangelical Methodist, Jehovah's Witnesses, or Other).",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (sum of the nine affiliation categories) / total resident population.",
         temporal_coverage = "2021", spatial_coverage = "North Macedonia municipalities (80)",
         quality_notes = paste("Thirteen verbatim census categories are preserved on the per-municipality quality flag.", denom_note)),
    list(indicator_id = "no_religion_percent", label = "No religious affiliation %",
         description = "Share in the census Non-believer (atheist) line (Не е верник (атеист)).",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (Non-believer (atheist) line) / total resident population. Undeclared, Unknown, and administratively-sourced persons are not part of this slot.",
         temporal_coverage = "2021", spatial_coverage = "North Macedonia municipalities (80)",
         quality_notes = paste("The Non-believer (atheist) national share is small (0.48%); the administratively-sourced residual (7.20%) is disclosed and never folded into the no-religion slot.", denom_note))
  )
}

visual_layers <- function() {
  list(
    list(visual_layer_id = "mk-municipality-religious-affiliation", label = "Religious affiliation %",
         description = "North Macedonia census-affiliation share by municipality, 2021.", layer_type = "choropleth",
         indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "municipality total resident population, including undeclared, unknown, and administratively-sourced residuals"),
         colour_scale = "sequential", time_control = "none",
         aggregation_rule = "reported municipality value", uncertainty_display = "quality_flag",
         default_visibility = TRUE,
         notes = "Census affiliation, not practice or membership. Single 2021 wave (2002 is HELD; see the manifest and route probe)."),
    list(visual_layer_id = "mk-municipality-no-religion", label = "No religious affiliation %",
         description = "North Macedonia census non-believer (atheist) share by municipality, 2021.", layer_type = "choropleth",
         indicator_ids = list("no_religion_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "municipality total resident population"),
         colour_scale = "sequential", time_control = "none",
         aggregation_rule = "reported municipality value", uncertainty_display = "quality_flag",
         default_visibility = FALSE,
         notes = "The source category is Non-believer (atheist). Undeclared, Unknown, and administratively-sourced persons are excluded from this slot.")
  )
}

summary_product <- list(
  schema_version = "area-summary.v1", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_2021, country_code = country_code,
                      level = "municipality", vintage = "2021 census 80-municipality frame",
                      source_dataset_id = d_cod),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "No governed place-of-worship snapshot ships in the North Macedonia census product.",
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
raw_source_record <- function(path, url, format, used, periods, dataset_id, notes) {
  list(uri = path, url = url, format = format, bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = NULL, source_dataset_id = dataset_id, used_in_public_product = used,
       periods = periods, notes = notes,
       local_cache_hint = paste0(path, " (git-ignored by .gitignore data/ rule)"),
       raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/mk_census/"))
}
durable_file_record <- function(path, content, licence_status_value, licence_basis_value) {
  list(uri = paste0("repo:", path), storage_provider = "git_repository", format = sub("^.*\\.", "", path),
       bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = if (grepl("area_summary|\\.csv$", path)) length(rows) else NULL,
       feature_count = if (grepl("\\.geojson$", path)) 80L else NULL,
       content = content, privacy = "public",
       licence_status = licence_status_value, licence_basis = licence_basis_value)
}
reconciliation_block <- function(rec) lapply(seq_len(nrow(rec)), function(i) as.list(rec[i, ]))

licence_basis_slug <- "mk_sso_copyright_ships_with_attribution"

raw_sources <- list(
  raw_source_record(path_book_en, url_2021_book, "pdf", TRUE, "2021", d2021,
    "SSO 2021 census book, English edition; table T-06 parsed for religion by municipality. Both margins close to 1,836,713."),
  raw_source_record(path_book_mk, url_2021_book_mk, "pdf", FALSE, "2021", d2021,
    "SSO 2021 census book, Macedonian edition; verbatim Macedonian religion category names taken from its table T-06."),
  raw_source_record(path_cod_zip, url_cod, "shp_zip", TRUE, "2025", d_cod,
    "OCHA COD-AB MKD ADM2 shapefile (2025, 80 municipalities, CC BY-IGO). Joined to the census by a 15-entry transliteration crosswalk."),
  raw_source_record(path_cod_meta, url_cod_meta, "json", FALSE, "2025", d_cod,
    "HDX COD-AB MKD metadata; records license_id cc-by-igo, source EuroGeographics and SSO NTES.")
)

dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)
dataset_id <- "mk-census-religion:mk:2021:sso-municipality"

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = paste0("manifest:", dataset_id),
  dataset_id = dataset_id,
  dataset_version_id = paste0(dataset_id, ":", dataset_hash),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "mk-census-religion", dataset_role = "staged_evidence",
  scope = list(level = "country", country_codes = list("MK"), snapshot_date = NULL,
               snapshot_anchor = NULL, pipeline_stage = "staged"),
  created_at = stamp, created_by = script_id,
  target_years = list(2021L),
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation",
      shipped_waves = list(2021L),
      shipped_geography = "80 North Macedonia municipalities (2021 census frame)",
      boundary_sets = list(`2021` = boundary_set_2021),
      source_tables = list(`2021` = "2021 census book table T-06 (religious affiliation by municipality)"),
      universes = list(`2021` = "total resident population (1,836,713), including 132,260 administratively-sourced persons"),
      denominators = list(`2021` = "printed municipality total resident population; affiliation = sum of nine affiliation categories"),
      slot_design = paste(
        "Ordinary two-slot (SB/FM/KZ precedent; North Macedonia has a real Non-believer (atheist) category).",
        "religious_affiliation_percent is the summed share of Orthodox + Muslim (Islam) + Catholic + Christian +",
        "Protestant + Evangelical + Evangelical Methodist + Jehovah's Witnesses + Other. no_religion_percent is the",
        "single Non-believer (atheist) line. Undeclared, Unknown, and administratively-sourced persons stay in the",
        "denominator and in neither slot, so the two shares need not sum to 100."),
      category_frames = list(
        top_level_en = as.list(cats13),
        top_level_mk = as.list(unname(cats13_mk[cats13])),
        affiliation_categories = as.list(affiliation_cats),
        no_religion_category = no_religion_cat,
        residual_categories = as.list(residual_cats),
        category_note = paste(
          "Thirteen categories printed verbatim in census table T-06, English edition (Macedonian names from the",
          "Macedonian edition). The English edition footnote states religion categories refer to occurrences over 500",
          "at the country level; this is a category-selection note, not cell suppression. No cell is suppressed in the",
          "municipality table.")),
      frame_break = paste(
        "Single 2021 wave on the 80-municipality frame. The 2002 census religion table (Book X) is on the pre-2004",
        "(1996) 123-municipality frame and is HELD: no licensed 123-municipality boundary exists, and the 2004",
        "re-tabulation (Book XIII) carries total population and ethnicity but NOT religion (CHANGE-WITHHOLD across the",
        "2004 reorganisation). No cross-wave change is claimed."),
      boundary_derivation = list(
        `2021` = "OCHA COD-AB MKD ADM2 (80 units, CC BY-IGO, 2025); one-to-one join via a 15-entry Cyrillic-to-Latin transliteration crosswalk (c<->ts). No geometry merged or split."),
      transliteration_crosswalk = as.list(setNames(unname(cross), names(cross))),
      omitted_metrics = list("places_per_10000_residents", "place_density_per_sq_km"),
      boundary_simplification = list(`2021` = simplification),
      local_cache_hint = "All raw sources are cached under data/raw/mk_census/ and remain git-ignored.",
      retrieval_record = raw_sources
    ),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")), digest = as.character(packageVersion("digest")),
      pdftotext = "poppler pdftotext -layout", mapshaper = "scripts/lib/simplify_boundary.R (npx mapshaper)"
    )
  ),
  source = list(
    provider = "State Statistical Office of the Republic of North Macedonia; OCHA COD-AB (EuroGeographics/SSO)",
    source_dataset_ids = list(d2021, d_cod),
    source_urls = list(url_2021_book, url_2021_book_mk, url_cod, url_cod_meta, url_terms),
    retrieved_at = stamp,
    licence = census_licence_name,
    citation = "SSO 2021 Census book table T-06 (religion by municipality); OCHA COD-AB MKD ADM2 (CC BY-IGO).",
    raw_redistribution = "The census book PDFs and the boundary source zip are not committed; they remain in data/raw/mk_census/.",
    local_cache_hint = "data/raw/mk_census/ (git-ignored by .gitignore data/ rule)",
    raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/mk_census/")
  ),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = list(
    durable_file_record(summary_json_out, "North Macedonia municipality census-affiliation area summary, 2021 (80 municipalities).", "accepted", licence_basis_slug),
    durable_file_record(summary_csv_out, "Flattened North Macedonia municipality census-affiliation rows, 2021.", "accepted", licence_basis_slug),
    durable_file_record(geojson_out, "Simplified OCHA COD-AB MKD 80-municipality boundary GeoJSON (2021 frame).", "accepted", "ocha_codab_cc_by_igo")
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id,
         notes = "80 rows: 80 municipalities (2021); total resident population universe; no suppressed cells."),
    list(uri = paste0("repo:", geojson_out), sha256 = sha256_file(geojson_out), built_by = script_id,
         notes = "80 municipality features from OCHA COD-AB MKD ADM2, simplified with mapshaper.")
  ),
  validation = list(
    status = "passed",
    commands = list(
      paste("Rscript", script_id),
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/mk/data/area_summary_municipality.json",
      "bash scripts/validate_manifests.sh"
    ),
    gate_2021 = list(status = "passed", both_margins_close_to = nat_total,
                     municipality_row_checks = 80L, religion_column_checks = length(cats13),
                     skopje_partition_check = "passed",
                     records = reconciliation_block(rec_df)),
    boundary_validation = list(
      `2021` = list(status = "passed", feature_count = 80L,
                    distinct_geometry_hashes = length(unique(hashes)),
                    bbox = as.list(bbox), output_bytes = file_bytes(geojson_out),
                    licence = cod_meta[["result"]][["license_title"]],
                    crosswalk_entries = length(cross))),
    join_coverage = list(matched_2021 = 80L, expected_2021 = 80L),
    notes = paste(
      "2021 (80 municipalities) closes exactly at both margins: every municipality row (thirteen categories) sums to",
      "its printed population, and every religion column sums to the printed national total (1,836,713). The City of",
      "Skopje aggregate equals the sum of its ten constituent municipalities. Boundary joins 80/80."),
    warnings = list(
      "Single 2021 wave. The 2002 census religion table (Book X) is on the pre-2004 123-municipality frame with no licensed boundary and is HELD; the 2004 re-tabulation (Book XIII) excludes religion.",
      "The total resident population universe (1,836,713) includes 132,260 administratively-sourced persons (7.20%) whose religion is a distinct published category ('Taken from administrative sources'); it is rendered as published, never repaired or redistributed.",
      "Undeclared, Unknown, and administratively-sourced lines are disclosed denominator residuals in neither headline slot; affiliation and no-religion shares need not sum to 100%.",
      "Boundary names join the census by a 15-entry Cyrillic-to-Latin transliteration crosswalk (c<->ts); every mapping is one-to-one with no geometry merged or split."
    )
  ),
  construct_notes = list(
    "The construct is census affiliation: each resident's reported religion (asked of the resident population), not practice, attendance, or membership.",
    "The public product carries three headline fields per municipality: total resident population, religious affiliation percent, and no-religion percent. Place-density metrics are null (no governed place-of-worship snapshot).",
    "Thirteen verbatim census categories (Orthodox, Muslim (Islam), Catholic, Christian, Protestant, Evangelical, Evangelical Methodist, Jehovah's Witnesses, Other, Non-believer (atheist), Undeclared, Unknown, Taken from administrative sources) are preserved per municipality on the quality flag, with Macedonian originals.",
    "Slot design (ordinary two-slot, SB/FM/KZ precedent): religious_affiliation_percent is the summed share of the nine affiliation categories; no_religion_percent is the single Non-believer (atheist) line. Undeclared, Unknown, and administratively-sourced persons are disclosed residuals kept in the denominator and in neither slot, so the two shares need not sum to 100.",
    "Universe: the 2021 total resident population (1,836,713) includes 132,260 persons whose data, including religion, were taken from administrative sources (the combined-census methodology). That component is rendered as its own published religion category, never repaired or redistributed.",
    "Single wave: the 2002 census religion-by-municipality table (Book X, ethnic affiliation, mother tongue and religion) is on the pre-2004 (1996) 123-municipality frame. No licensed 123-municipality boundary exists, and the 2004 re-tabulation (Book XIII) carries total population and ethnicity but not religion, so 2002 is HELD (documented in the route probe), not shipped.",
    "Licence: the SSO asserts copyright with no stated open-data licence; each census book instructs 'When using data contained here, please cite the source'. The derived municipality summaries ship with attribution to the State Statistical Office under the BUILD-THEN-ASK ruling; an SSO reuse-confirmation email is recorded for the PI."
  ),
  deferred_sources = list(
    list(source_dataset_id = "mk-census-2002-book-x-religion-by-settlement", status = "held",
         url = "https://www.stat.gov.mk/Publikacii/knigaX.pdf", local_path = "data/raw/mk_census/mk_2002_knigaX.pdf",
         notes = paste("2002 census Book X 'Total population according to ethnic affiliation, mother tongue and religion,",
                       "final data by settlements'. Five religion categories (Orthodox 1,310,184; Muslim/Islam 674,015;",
                       "Catholic 7,008; Protestant 520; Other 30,820; total 2,022,547) on the pre-2004 123-municipality",
                       "(1996) frame. HELD: no licensed 123-municipality boundary exists. Unblock: (a) a licensed 1996/123",
                       "municipality boundary; or (b) an SSO re-tabulation of 2002 religion onto the 2004/current frame",
                       "(parallel to Book XIII's total-population/ethnicity re-tabulation); or (c) an SSO-published",
                       "settlement-to-current-municipality concordance to exactly re-aggregate Book X's settlement religion.")),
    list(source_dataset_id = "mk-2021-religion-sex-urban-rural", status = "deferred",
         url = url_2021_book, local_path = NULL,
         notes = "The 2021 census also splits religion by sex within municipality (and religion by ethnicity, mother tongue nationally). Only the both-sexes municipality block is shipped; the sex cut is a deeper future product.")
  ),
  privacy = "public",
  licence_status = "accepted",
  licence_basis = licence_basis_slug,
  downstream_status = "staged",
  source_datasets = source_datasets(),
  notes = paste(
    "Product built under BUILD-THEN-ASK: derived municipality summaries ship with attribution while an SSO",
    "reuse-confirmation ask is recorded for the PI (licence_status needs_review). The committed products are the",
    "derived municipality area summary (80 rows, 2021) and one boundary GeoJSON (OCHA COD-AB 80-municipality 2021",
    "frame). On-page attribution must cite the State Statistical Office of the Republic of North Macedonia and OCHA",
    "COD-AB (CC BY-IGO). The 2002 wave is HELD (see deferred_sources)."
  )
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

cat("wave shipped: 2021 (80 municipalities) on OCHA COD-AB 2025 ADM2\n")
cat(sprintf("rows: %d\n", length(rows)))
cat(sprintf("gate 2021: passed; both margins close to %d\n", nat_total))
cat(sprintf("boundary 2021: 80 features, %d bytes\n", file_bytes(geojson_out)))
cat("2002: HELD (Book X on the 123-municipality 1996 frame; no licensed boundary)\n")
cat("licence: accepted under BUILD-THEN-ASK (SSO copyright; ships with attribution); staged pending SSO courtesy ask\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", geojson_out))
cat(sprintf("wrote %s\n", manifest_out))
