# build the Bosnia and Herzegovina municipality census-religion area-summary product
# for a single wave (2013) on the post-Dayton 142-unit municipal frame. religion by
# municipality comes from the BHAS 2013 census, Book 2 (Ethnicity/nationality,
# Religion, Mother tongue), Table 5.1 "Stanovništvo prema vjeroispovijesti i spolu,
# po općinama/gradovima" (Population by religion and sex, by municipalities/cities).
# the source XLSX carries 21 verbatim religion categories over 141 level-3
# municipalities plus Brčko District, and reconciles exactly at both margins to the
# BHAS resident-population total 3,531,159. see research/countries/ba/route-probe.md
# for full provenance, the political dispute (RS institute rejected the BHAS
# methodology; BHAS is rendered as the official state publication), the boundary name
# crosswalk, and the 1991 HOLD (1991 measured ethnicity, not religion; no licensed
# pre-war municipal boundary).
#   inputs (all cached under data/raw/ba_census/, git-ignored):
#   K2_T5-1_B.xlsx            <- Table 5.1 religion x municipality (the product source)
#   geoBoundaries-BIH-ADM3.geojson <- 142-unit 2013 municipal boundary (Public Domain)
#   gb_bih_adm3_meta.json     <- geoBoundaries release licence metadata
# every religion cell is read verbatim from the cached XLSX (dash "-" reads as nil/0)
# and reconciled against the printed control totals; the build stops on any margin
# mismatch and never allocates, infers, rounds, imputes, redistributes, or tunes.
# outputs: apps/regions/ba/data/{ba_municipality_2013.geojson,
#   area_summary_municipality.json, area_summary_municipality.csv} and
#   docs/manifests/ba-census-religion-2013.json.
# run from the repo root: Rscript scripts/build_ba_area_summary.R

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(readxl)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")
sf::sf_use_s2(FALSE)  # the geoBoundaries ADM3 polygons carry self-intersections; planar ops

country_code <- "BA"
script_id <- "scripts/build_ba_area_summary.R"
raw_dir <- "data/raw/ba_census"
product_dir <- "apps/regions/ba/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-12"
stamp <- paste0(retrieval_date, "T00:00:00Z")
git_commit <- trimws(system2("git", c("rev-parse", "HEAD"), stdout = TRUE))
if (length(git_commit) != 1L || !grepl("^[a-f0-9]{40}$", git_commit)) git_commit <- NULL

# ---- dataset ids ---------------------------------------------------------------
d_census <- "ba-census-2013-book2-t5-1-religion-by-municipality"
d_gb <- "geoboundaries-bih-adm3-2013"
boundary_set_id <- "ba-municipality-2013-geoboundaries-adm3"

# ---- source urls and cached paths ----------------------------------------------
url_census <- "https://www.popis.gov.ba/popis2013/doc/Knjiga2/BOS/K2_T5-1_B.xlsx"
url_book2 <- "https://www.popis.gov.ba/popis2013/doc/Knjiga2/K2_B_E.pdf"
url_gb <- "https://github.com/wmgeolab/geoBoundaries/raw/f549eab/releaseData/gbOpen/BIH/ADM3/geoBoundaries-BIH-ADM3.geojson"
url_gb_meta <- "https://www.geoboundaries.org/api/current/gbOpen/BIH/ADM3/"

path_census <- file.path(raw_dir, "K2_T5-1_B.xlsx")
path_book2 <- file.path(raw_dir, "K2_B_E.pdf")
path_gb <- file.path(raw_dir, "geoBoundaries-BIH-ADM3.geojson")
path_gb_meta <- file.path(raw_dir, "gb_bih_adm3_meta.json")

geojson_out <- file.path(product_dir, "ba_municipality_2013.geojson")
summary_json_out <- file.path(product_dir, "area_summary_municipality.json")
summary_csv_out <- file.path(product_dir, "area_summary_municipality.csv")
manifest_out <- file.path(manifest_dir, "ba-census-religion-2013.json")

require_file <- function(path) {
  if (!file.exists(path) || file.info(path)[["size"]] == 0L) {
    stop("missing required source: ", path, call. = FALSE)
  }
}
invisible(lapply(c(path_census, path_book2, path_gb, path_gb_meta), require_file))

# ---- verbatim category frame (21 religion lines, source column order) ----------
# each entry is the verbatim Bosnian label and its published English translation, in
# the printed column order of Table 5.1 (columns 5..24; column 4 is the Total).
cat_bs <- c("Islamska", "Pravoslavna", "Katolička", "Muslimanska", "Rimokatolička",
            "Srpska", "Jehovini svjedoci", "Grkokatolička", "Protestantska", "Romska",
            "Hrišćanska", "Bošnjačka", "Hrvat", "Adventistička", "Bosanac",
            "Agnostik", "Ateist", "Ostali", "Ne izjašnjava se", "Nepoznato")
cat_en <- c("Islam", "Orthodox", "Catholic", "Muslim", "Roman Catholic",
            "Serbian", "Jehovah's Witnesses", "Greek Catholic", "Protestant", "Romani",
            "Christian", "Bosniak", "Croat", "Adventist", "Bosnian",
            "Agnostic", "Atheist", "Others", "Undeclared", "Unknown")
# slot roles (RENDER-THE-RECORD: the 21 lines are preserved verbatim on the quality
# flag; the two headline slots are derived aggregates for the map, not a merge of the
# published record). no-religion = the two explicitly non-religious lines (Agnostic,
# Atheist); non-response residual = Undeclared + Unknown, kept in the denominator and
# in neither slot; affiliation = every remaining named-religion line.
no_religion_cats <- c("Agnostik", "Ateist")
non_response_cats <- c("Ne izjašnjava se", "Nepoznato")
affiliation_cats <- setdiff(cat_bs, c(no_religion_cats, non_response_cats))

# printed national control row (level 0, BiH, Ukupno/Total), transcribed from the
# XLSX for a fail-fast identity check against the extracted source.
nat_expected <- c(
  Total = 3531159, Islamska = 1790454, Pravoslavna = 1085760, Katolička = 536333,
  Muslimanska = 22068, Rimokatolička = 6799, Srpska = 3898, `Jehovini svjedoci` = 1171,
  Grkokatolička = 982, Protestantska = 655, Romska = 612, Hrišćanska = 567,
  Bošnjačka = 411, Hrvat = 275, Adventistička = 193, Bosanac = 154, Agnostik = 10816,
  Ateist = 27853, Ostali = 2870, `Ne izjašnjava se` = 32700, Nepoznato = 6588)

# ---- extract the religion x municipality table ---------------------------------
# the XLSX has a hierarchy Level column (0 BiH, 1 entity, 2 canton, 3 municipality)
# and a Sex column; the leaf municipal units are the 141 level-3 rows plus Brčko
# District (a level-1 unit with no children), each on its Ukupno/Total sex row.
raw <- as.data.frame(suppressMessages(read_excel(path_census, sheet = 1, col_names = FALSE)))
lvl <- suppressWarnings(as.integer(raw[[1]]))
sex <- raw[[3]]
area_raw <- raw[[2]]
is_total_sex <- grepl("Ukupno", sex)

mun_rows <- which(!is.na(lvl) & lvl == 3L & is_total_sex)
brc_rows <- which(!is.na(lvl) & lvl == 1L & is_total_sex & grepl("BRČKO", area_raw))
if (length(mun_rows) != 141L) stop("expected 141 level-3 municipalities, got ", length(mun_rows), call. = FALSE)
if (length(brc_rows) != 1L) stop("expected exactly one Brčko District leaf, got ", length(brc_rows), call. = FALSE)
leaf <- c(mun_rows, brc_rows)

# the verbatim source area name is the first line of the bilingual area cell.
census_name <- gsub("\r?\n.*", "", area_raw[leaf])
# category matrix: columns 5..24 are the 21 religion lines; "-" reads as nil (0).
cat_cols <- 5:24
mat <- sapply(cat_cols, function(j) {
  v <- suppressWarnings(as.numeric(raw[[j]][leaf]))
  v[is.na(v)] <- 0L
  as.integer(v)
})
colnames(mat) <- cat_bs
total_printed <- as.integer(suppressWarnings(as.numeric(raw[[4]][leaf])))

# ---- reconciliation gates (fail-fast; stop, do not tune) -----------------------
# every municipality row's 21 categories sum to its printed Total; every religion
# column sums to the printed national total; leaf totals sum to the national total.
records <- list()
for (i in seq_along(leaf)) {
  row_sum <- sum(mat[i, ])
  if (row_sum != total_printed[i]) {
    stop(sprintf("2013 municipality gate FAILED for %s: 21 categories sum %d != printed Total %d",
                 census_name[i], row_sum, total_printed[i]), call. = FALSE)
  }
  records[[length(records) + 1L]] <- data.frame(
    margin = "municipality_row", key = census_name[i],
    computed = row_sum, printed = total_printed[i], difference = 0L, stringsAsFactors = FALSE)
}
col_sums <- colSums(mat)
for (cb in cat_bs) {
  if (col_sums[[cb]] != nat_expected[[cb]]) {
    stop(sprintf("2013 religion-column gate FAILED for %s: municipality sum %d != printed national %d",
                 cb, col_sums[[cb]], nat_expected[[cb]]), call. = FALSE)
  }
  records[[length(records) + 1L]] <- data.frame(
    margin = "religion_column", key = cb,
    computed = unname(col_sums[[cb]]), printed = unname(nat_expected[[cb]]), difference = 0L,
    stringsAsFactors = FALSE)
}
if (sum(total_printed) != nat_expected[["Total"]]) {
  stop(sprintf("2013 grand gate FAILED: leaf-total sum %d != printed national %d",
               sum(total_printed), nat_expected[["Total"]]), call. = FALSE)
}
if (sum(nat_expected[cat_bs]) != nat_expected[["Total"]]) {
  stop("2013 national category-sum gate FAILED", call. = FALSE)
}
rec_2013 <- do.call(rbind, records)
message(sprintf("gate 2013: PASSED (both margins close to %d; 142 municipality rows, 21 religion columns)",
                nat_expected[["Total"]]))

# ---- boundary: geoBoundaries BIH ADM3 (142 units, 2013, Public Domain) ---------
# confirm the release licence, unit count, and type before use.
gb_meta <- fromJSON(path_gb_meta, simplifyVector = FALSE)
if (!identical(gb_meta[["boundaryLicense"]], "Public Domain") ||
    !identical(gb_meta[["admUnitCount"]], "142") ||
    !identical(gb_meta[["boundaryType"]], "ADM3")) {
  stop("geoBoundaries BIH ADM3 licence, unit count, or type metadata changed", call. = FALSE)
}
gb <- st_make_valid(st_read(path_gb, quiet = TRUE, stringsAsFactors = FALSE))
if (nrow(gb) != 142L) stop("geoBoundaries BIH ADM3 feature count is not 142", call. = FALSE)

# documented census -> geoBoundaries name crosswalk. the geoBoundaries ADM3 layer
# (Wikimedia Commons source) uses English/alternate municipality names and carries
# three data-quality quirks resolved here by centroid inspection (see the probe):
#   - one polygon is mislabelled "Republika Srpska"; its centroid (19.30E, 43.82N)
#     is Višegrad, so it is Višegrad, keyed by shapeID.
#   - two polygons share the name "Novi Grad": the western one (16.47E) is the RS
#     municipality Novi Grad, the Sarajevo one (18.34E) is Novi Grad Sarajevo; keyed
#     by shapeID.
#   - "Kupra na Uni" is a typo for Krupa na Uni.
# every other municipality joins by shapeName after accent/space normalisation.
crosswalk_name <- c(
  "DOBOJ-ISTOK" = "Doboj East", "DOBOJ-JUG" = "Doboj Jug",
  "FOČA - FBiH" = "Foča-Ustikolina", "FOČA - RS" = "Foča",
  "PALE - FBiH" = "Pale-Prača", "PALE - RS" = "Pale",
  "TRNOVO - FBiH" = "Trnovo (BiH)", "TRNOVO - RS" = "Trnovo (RS)",
  "KUPRES - FBiH" = "Kupres (BiH)", "KUPRES - RS" = "Kupres",
  "GRAD MOSTAR" = "Mostar", "PROZOR" = "Prozor-Rama",
  "CENTAR SARAJEVO" = "Centar", "STARI GRAD SARAJEVO" = "Stari Grad",
  "KRUPA NA UNI" = "Kupra na Uni", "NOVO GORAŽDE" = "Ustiprača")
# duplicate-name / mislabelled features keyed by geoBoundaries shapeID.
crosswalk_id <- c(
  "NOVI GRAD SARAJEVO" = "43093233B94913651340481",
  "NOVI GRAD" = "43093233B49947296698025",
  "VIŠEGRAD" = "43093233B37160773543814")

# accent/space normalisation for the plain-name join.
norm <- function(x) {
  x <- toupper(trimws(x))
  x <- chartr("ČĆĐŠŽ", "CCDSZ", x)
  x <- gsub("LJ", "LJ", x)
  x <- gsub("[[:space:]]+", " ", x)
  x
}
gb_norm <- norm(gb[["shapeName"]])

# resolve each census leaf to exactly one geoBoundaries feature index.
resolve_idx <- function(nm) {
  if (grepl("BRČKO", nm)) return(which(gb[["shapeName"]] == "Brcko District"))
  if (nm %in% names(crosswalk_id)) return(which(gb[["shapeID"]] == crosswalk_id[[nm]]))
  target <- if (nm %in% names(crosswalk_name)) crosswalk_name[[nm]] else nm
  which(gb_norm == norm(target))
}
idx <- vapply(census_name, function(nm) {
  hit <- resolve_idx(nm)
  if (length(hit) != 1L) stop("census municipality '", nm, "' resolved to ", length(hit),
                              " geoBoundaries features (expected 1)", call. = FALSE)
  hit
}, integer(1))
if (anyDuplicated(idx)) {
  dup <- census_name[idx %in% idx[duplicated(idx)]]
  stop("census municipalities map to the same boundary feature: ", paste(dup, collapse = ", "), call. = FALSE)
}
if (length(unique(idx)) != 142L) stop("boundary join is not 142/142", call. = FALSE)
message(sprintf("boundary join: PASSED (142/142 municipalities matched; %d via name crosswalk, %d via shapeID)",
                sum(census_name %in% names(crosswalk_name)), sum(census_name %in% names(crosswalk_id))))

# ---- ASCII snake_case slugs from the verbatim census names (unique) ------------
slugify <- function(x) {
  x <- chartr("ČĆĐŠŽčćđšžĐ", "CCDSZccdszD", x)
  x <- gsub("Đ", "Dj", x, fixed = TRUE)
  x <- iconv(x, to = "ASCII//TRANSLIT")
  x <- tolower(x)
  x <- gsub("[^a-z0-9]+", "_", x)
  x <- gsub("^_|_$", "", x)
  x
}
# Brčko's verbatim area name is long; give it a stable short slug.
slug_source <- ifelse(grepl("BRČKO", census_name), "brcko_distrikt", census_name)
slug <- slugify(slug_source)
if (anyDuplicated(slug)) stop("duplicate area slug generated: ",
                              paste(slug[duplicated(slug)], collapse = ", "), call. = FALSE)

# ---- assemble the boundary layer -----------------------------------------------
ba_laea <- "+proj=laea +lat_0=44 +lon_0=18 +datum=WGS84 +units=m +no_defs"
boundary <- gb[idx, ]
boundary[["area_name"]] <- census_name
boundary[["area_code"]] <- slug
boundary[["boundary_source_name"]] <- boundary[["shapeName"]]
boundary[["area_unit_id"]] <- paste(boundary_set_id, slug, sep = ":")
boundary[["boundary_set_id"]] <- boundary_set_id
boundary[["boundary_level"]] <- "municipality"
boundary[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(boundary, ba_laea))) / 1e6
boundary <- st_transform(st_make_valid(boundary), 4326)
boundary <- boundary[c("area_code", "area_name", "boundary_source_name", "area_unit_id",
                       "boundary_set_id", "boundary_level", "land_area_sq_km", "geometry")]

# simplify with the mandatory helper; re-validate count + distinctness.
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
if (anyNA(written[["area_code"]])) stop("simplified boundary lost an area code", call. = FALSE)
if (nrow(written) != 142L) stop("simplified boundary count mismatch", call. = FALSE)
w_valid <- st_is_valid(written)
if (any(st_is_empty(written)) || any(is.na(w_valid)) || any(!w_valid)) {
  stop("simplified boundary has empty or invalid geometries", call. = FALSE)
}
hashes <- geometry_hashes(written)
if (length(unique(hashes)) != 142L) stop("simplified geometry hashes not distinct", call. = FALSE)
bbox <- st_bbox(written)
message(sprintf("boundary 2013: PASSED (142 distinct features, %d bytes at %g%% keep)",
                as.integer(file.info(geojson_out)[["size"]]), simplification[["keep_percent"]]))

land_area <- setNames(written[["land_area_sq_km"]], written[["area_code"]])

# ---- product rows --------------------------------------------------------------
population_total_basis <- paste(
  "BHAS 2013 Census, Book 2 (Ethnicity/nationality, Religion, Mother tongue), Table 5.1",
  "'Stanovništvo prema vjeroispovijesti i spolu, po općinama/gradovima' (Population by",
  "religion and sex, by municipalities/cities), Ukupno/Total (both sexes, all ages). The",
  "denominator is the printed municipality total (the BHAS resident-population count).")

flag_common <- paste(
  "census_declared_religion", "all_persons_all_ages_universe",
  "single_select_declared_religion",
  "religious_affiliation_percent_is_summed_named_religion_share",
  "no_religion_percent_is_agnostic_plus_atheist",
  "non_response_undeclared_plus_unknown_in_denominator_neither_slot",
  "shares_need_not_sum_to_100",
  "single_wave_2013_only_1991_held_ethnicity_not_religion_and_no_licensed_prewar_boundary",
  "bhas_official_state_publication_rs_institute_disputed_methodology",
  "boundary_geoboundaries_adm3_public_domain_2013_frame_with_name_crosswalk",
  sep = ";")

make_row <- function(i) {
  pop <- total_printed[i]
  no_rel <- sum(mat[i, no_religion_cats])
  non_resp <- sum(mat[i, non_response_cats])
  affiliation <- pop - no_rel - non_resp
  # verbatim per-municipality breakdown: Bosnian label = count, in source order.
  breakdown <- paste(paste0(cat_bs, "=", mat[i, cat_bs]), collapse = ";")
  full_flag <- paste0(flag_common, ";source_area_name=", census_name[i],
                      ";boundary_source_name=", boundary[["boundary_source_name"]][i],
                      ";source_categories_verbatim=", breakdown)
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = "municipality",
    area_unit_id = paste(boundary_set_id, slug[i], sep = ":"),
    area_code = slug[i],
    area_name = census_name[i],
    year = 2013L,
    population_total = as.integer(pop),
    population_total_basis = population_total_basis,
    religious_affiliation_count = as.integer(affiliation),
    religious_affiliation_percent = round(100 * affiliation / pop, 4),
    no_religion_count = as.integer(no_rel),
    no_religion_percent = round(100 * no_rel / pop, 4),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = unname(round(land_area[[slug[i]]], 4)),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(d_census, d_gb),
    quality_flag = full_flag
  )
}
rows <- lapply(seq_along(leaf), make_row)

# ---- area-summary document -----------------------------------------------------
census_licence_name <- paste(
  "Agency for Statistics of Bosnia and Herzegovina (BHAS) attribution request. The",
  "2013 Census Book 2 front matter (K2_B_E.pdf, retrieved 2026-07-12) states, in the",
  "Director's foreword: 'Molimo korisnike da prilikom upotrebe podataka obavezno navedu",
  "izvor.' / 'Users are kindly requested to mention data source.' Publisher: Agencija za",
  "statistiku Bosne i Hercegovine / Agency for Statistics of Bosnia and Herzegovina,",
  "Zelenih beretki 26, Sarajevo. No open-data licence is stated; derived municipality",
  "summaries ship with attribution to BHAS under the standing BUILD-THEN-ASK ruling.")

source_datasets <- function() {
  list(
    list(
      source_dataset_id = d_census,
      name = "Bosnia and Herzegovina 2013 Census, Book 2 (Ethnicity/nationality, Religion, Mother tongue), Table 5.1: Population by religion and sex, by municipalities/cities",
      provider = "Agency for Statistics of Bosnia and Herzegovina (BHAS)",
      url = url_census, retrieval_date = retrieval_date, local_path = path_census,
      licence = list(name = census_licence_name, url = url_book2,
                     attribution = "Agency for Statistics of Bosnia and Herzegovina, 2013 Census of Population, Households and Dwellings"),
      citation = "Agency for Statistics of Bosnia and Herzegovina, Census of Population, Households and Dwellings in Bosnia and Herzegovina 2013, Final Results, Book 2, Table 5.1 (Population by religion and sex, by municipalities/cities).",
      access_limits = NULL,
      redistribution_limits = "No open-data licence stated; BHAS requests source attribution. Derived municipality summaries ship with attribution to BHAS (BUILD-THEN-ASK); a BHAS reuse-confirmation courtesy ask is recorded for the PI.",
      notes = paste("All persons, all ages; 142 municipal units (141 level-3 municipalities +",
                    "Brčko District). Both margins close exactly to the BHAS resident-population total",
                    "3,531,159. 21 verbatim religion categories; dash '-' reads as nil. No cell suppression.",
                    "The 2013 census was politically disputed: the Republika Srpska institute of statistics",
                    "(RZS) rejected the BHAS residence methodology and published its own entity results; this",
                    "product renders the BHAS state-level publication as the official record and takes no",
                    "position on the dispute.")),
    list(
      source_dataset_id = d_gb,
      name = "geoBoundaries BIH ADM3 (142 municipalities, 2013 vintage)",
      provider = "geoBoundaries (William & Mary geoLab); boundary source Wikimedia Commons",
      url = url_gb, retrieval_date = retrieval_date, local_path = path_gb,
      licence = list(name = "Public Domain (geoBoundaries gbOpen release metadata: boundaryLicense 'Public Domain', licenseSource commons.wikimedia.org/wiki/File)", url = url_gb_meta,
                     attribution = "geoBoundaries (gbOpen), BIH ADM3; boundary source Wikimedia Commons (Public Domain)"),
      citation = "geoBoundaries BIH ADM3 (gbOpen, pinned f549eab), 142 municipality boundaries, boundaryYearRepresented 2013.",
      access_limits = NULL,
      redistribution_limits = "Public Domain per the geoBoundaries release metadata; the simplified derived boundary is committed with attribution to geoBoundaries and Wikimedia Commons.",
      notes = paste("142 ADM3 units, boundaryYearRepresented 2013 — the exact post-Dayton municipal frame of",
                    "the 2013 census. A documented name crosswalk (16 name entries + 3 shapeID entries) joins the",
                    "census municipalities one-to-one, resolving three geoBoundaries data quirks: a polygon",
                    "mislabelled 'Republika Srpska' that is Višegrad by centroid, two 'Novi Grad' polygons",
                    "(RS Novi Grad vs Novi Grad Sarajevo), and the typo 'Kupra na Uni' for Krupa na Uni."))
  )
}

indicators <- function() {
  denom_note <- paste(
    "Percentages use each municipality's printed census population total. The two",
    "non-response lines (Ne izjašnjava se / Undeclared and Nepoznato / Unknown) stay in",
    "the denominator and outside both headline numerators, so the two shares need not sum",
    "to 100%.")
  list(
    list(indicator_id = "population_total", label = "Census population total",
         description = "Municipality resident population represented in the 2013 religion table (Table 5.1, Total).",
         unit = "count", denominator_indicator_id = NULL,
         method = "Printed municipality Total column of Book 2 Table 5.1.",
         temporal_coverage = "2013", spatial_coverage = "Bosnia and Herzegovina municipalities (142 units)",
         quality_notes = "The 2013 census counts all persons of all ages (religion was asked of the whole resident population). Single wave: 1991 is not shipped (1991 measured ethnicity, not religion, and no licensed pre-war municipal boundary exists)."),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
         description = "Share of the municipality population declaring a named religion (all religion lines except Agnostic, Atheist, Undeclared, and Unknown).",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (population - Agnostic - Atheist - Undeclared - Unknown) / population.",
         temporal_coverage = "2013", spatial_coverage = "Bosnia and Herzegovina municipalities (142 units)",
         quality_notes = paste("The 21 verbatim religion categories (Islamska, Pravoslavna, Katolička, …, Ostali) are preserved per municipality on the quality flag; the headline affiliation slot is their summed share.", denom_note)),
    list(indicator_id = "no_religion_percent", label = "No religious affiliation %",
         description = "Share declaring Agnostik (Agnostic) or Ateist (Atheist).",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (Agnostik + Ateist) / population. Undeclared and Unknown are not part of this slot.",
         temporal_coverage = "2013", spatial_coverage = "Bosnia and Herzegovina municipalities (142 units)",
         quality_notes = paste("The census has no single 'no religion' line; the no-religion slot sums the two explicitly non-religious declared lines (Agnostic, Atheist). National no-religion share is 1.1% (38,669 of 3,531,159).", denom_note))
  )
}

visual_layers <- function() {
  list(
    list(visual_layer_id = "ba-municipality-religious-affiliation", label = "Religious affiliation %",
         description = "Bosnia and Herzegovina 2013 census declared-religion share by municipality.", layer_type = "choropleth",
         indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "municipality resident population, including non-response residual"),
         colour_scale = "sequential", time_control = "none",
         aggregation_rule = "reported municipality value", uncertainty_display = "quality_flag",
         default_visibility = TRUE,
         notes = "Census declared religion, not practice or membership. Single wave (2013). The individual religion categories (Islam, Orthodox, Catholic, and the smaller lines) are carried verbatim on the per-municipality quality flag."),
    list(visual_layer_id = "ba-municipality-no-religion", label = "No religious affiliation %",
         description = "Bosnia and Herzegovina 2013 census Agnostic+Atheist share by municipality.", layer_type = "choropleth",
         indicator_ids = list("no_religion_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "municipality resident population"),
         colour_scale = "sequential", time_control = "none",
         aggregation_rule = "reported municipality value", uncertainty_display = "quality_flag",
         default_visibility = FALSE,
         notes = "The source lines are Agnostik and Ateist. Undeclared and Unknown are non-response, excluded from this slot.")
  )
}

summary_product <- list(
  schema_version = "area-summary.v1", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code,
                      level = "municipality", vintage = "2013 post-Dayton municipal frame (142 units)",
                      source_dataset_id = d_gb),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "No governed place-of-worship snapshot ships in the Bosnia and Herzegovina census product.",
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
sha256_file <- function(path) unname(tools::sha256sum(path))
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$", path)) return(length(fromJSON(path, simplifyVector = FALSE)[["features"]]))
  if (grepl("\\.json$", path)) return(length(fromJSON(path, simplifyVector = FALSE)[["rows"]]))
  NA_integer_
}
raw_source_record <- function(path, url, format, used, dataset_id, notes) {
  list(uri = path, url = url, format = format, bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = NULL, source_dataset_id = dataset_id, used_in_public_product = used,
       periods = "2013", notes = notes,
       local_cache_hint = paste0(path, " (git-ignored by .gitignore data/ rule)"),
       raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/ba_census/"))
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

licence_basis_slug <- "ba_bhas_attribution_request_build_then_ask"

raw_sources <- list(
  raw_source_record(path_census, url_census, "xlsx", TRUE, d_census,
    "BHAS 2013 Census Book 2 Table 5.1 (religion x municipality) XLSX; 142 leaf units, 21 categories. Both margins close to 3,531,159."),
  raw_source_record(path_book2, url_book2, "pdf", FALSE, d_census,
    "BHAS 2013 Census Book 2 full publication (BS/EN); carries the licence/attribution statement in the Director's foreword and the printed Table 5.1."),
  raw_source_record(path_gb, url_gb, "geojson", TRUE, d_gb,
    "geoBoundaries BIH ADM3 GeoJSON; 142 municipalities, Public Domain, boundaryYearRepresented 2013. Pinned commit f549eab."),
  raw_source_record(path_gb_meta, url_gb_meta, "json", FALSE, d_gb,
    "geoBoundaries BIH ADM3 release metadata; records boundaryLicense 'Public Domain', boundarySource Wikimedia Commons, admUnitCount 142, boundaryYearRepresented 2013.")
)

dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)
dataset_id <- "ba-census-religion:ba:2013:bhas-municipality"

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = paste0("manifest:", dataset_id),
  dataset_id = dataset_id,
  dataset_version_id = paste0(dataset_id, ":", dataset_hash),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "ba-census-religion", dataset_role = "accepted_export",
  scope = list(level = "country", country_codes = list("BA"), snapshot_date = NULL,
               snapshot_anchor = NULL, pipeline_stage = "accepted"),
  created_at = stamp, created_by = script_id,
  target_years = list(2013L),
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census declared religion",
      shipped_waves = list(2013L),
      shipped_geography = "142 Bosnia and Herzegovina municipalities (141 level-3 + Brčko District)",
      boundary_set = boundary_set_id,
      source_table = "Book 2 Table 5.1 Stanovništvo prema vjeroispovijesti i spolu, po općinama/gradovima (Ukupno/Total)",
      universe = "all persons, all ages (religion asked of the whole resident population)",
      denominator = "printed municipality Total; affiliation = population - Agnostic - Atheist - Undeclared - Unknown",
      slot_design = paste(
        "Ordinary two-slot (KZ/BZ precedent). religious_affiliation_percent is the summed share of every",
        "named-religion line (Islamska, Pravoslavna, Katolička, Muslimanska, Rimokatolička, Srpska, Jehovini",
        "svjedoci, Grkokatolička, Protestantska, Romska, Hrišćanska, Bošnjačka, Hrvat, Adventistička, Bosanac,",
        "Ostali). no_religion_percent sums the two explicitly non-religious declared lines (Agnostik, Ateist).",
        "The two non-response lines (Ne izjašnjava se, Nepoznato) stay in the denominator and in neither slot,",
        "so the two shares need not sum to 100. All 21 verbatim categories are preserved per municipality on",
        "the quality flag; the slots are derived aggregates for the map, not a merge of the published record."),
      category_frame = list(
        bosnian = as.list(cat_bs),
        english = as.list(cat_en),
        no_religion_lines = as.list(no_religion_cats),
        non_response_lines = as.list(non_response_cats),
        note = paste("The 21 categories are transcribed in the printed column order of Table 5.1. Several are",
                     "ethnonym-in-religion-field declarations (Romska, Bošnjačka, Hrvat, Bosanac) rendered",
                     "verbatim; none is invented, merged, or redistributed.")),
      dispute_note = paste(
        "The 2013 census was politically disputed. The Republika Srpska institute of statistics (RZS) rejected",
        "the BHAS residence-based methodology and published separate entity results; the state-level BHAS total",
        "is 3,531,159 residents. This product renders the BHAS publication as the official state record",
        "(RENDER-THE-RECORD) and states the dispute neutrally; no number is repaired or reconciled to RZS."),
      frame_note = paste(
        "Single wave (2013) on the post-Dayton 142-unit municipal frame. 1991 is HELD (CHANGE-WITHHOLD): the",
        "1991 SFRY census measured ethnicity/nationality (nacionalna pripadnost), not religion, so no 1991",
        "municipality religion table exists, and no open licensed pre-war (109-municipality) boundary vector is",
        "available. See deferred_sources and the route probe for the exact unblock."),
      boundary_derivation = paste(
        "geoBoundaries BIH ADM3 (142 units, Public Domain, boundaryYearRepresented 2013). Joined one-to-one via",
        "a documented crosswalk: 16 name-mapped entries (e.g. Doboj East, Foča-Ustikolina, Pale-Prača, Trnovo",
        "(BiH)/(RS), Kupres (BiH)/Kupres, Mostar, Prozor-Rama, Centar, Stari Grad, Kupra na Uni typo, Ustiprača)",
        "and 3 shapeID entries for the mislabelled/duplicate polygons (Višegrad labelled 'Republika Srpska';",
        "two 'Novi Grad' polygons for RS Novi Grad and Novi Grad Sarajevo)."),
      omitted_metrics = list("places_per_10000_residents", "place_density_per_sq_km"),
      boundary_simplification = simplification,
      local_cache_hint = "All raw sources are cached under data/raw/ba_census/ and remain git-ignored.",
      retrieval_record = raw_sources
    ),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")), digest = as.character(packageVersion("digest")),
      readxl = as.character(packageVersion("readxl")),
      mapshaper = "scripts/lib/simplify_boundary.R (npx mapshaper)"
    )
  ),
  source = list(
    provider = "Agency for Statistics of Bosnia and Herzegovina (BHAS); geoBoundaries (William & Mary geoLab) / Wikimedia Commons",
    source_dataset_ids = list(d_census, d_gb),
    source_urls = list(url_census, url_book2, url_gb, url_gb_meta),
    retrieved_at = stamp,
    licence = census_licence_name,
    citation = "BHAS 2013 Census Book 2 Table 5.1 (Population by religion and sex, by municipalities/cities); geoBoundaries BIH ADM3 (Public Domain, 2013 frame).",
    raw_redistribution = "The census XLSX/PDF and the boundary source file are not committed; they remain in data/raw/ba_census/.",
    local_cache_hint = "data/raw/ba_census/ (git-ignored by .gitignore data/ rule)",
    raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/ba_census/")
  ),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = list(
    durable_file_record(summary_json_out, "Bosnia and Herzegovina municipality census declared-religion area summary for 2013 (142 municipalities).", "needs_review", licence_basis_slug),
    durable_file_record(summary_csv_out, "Flattened Bosnia and Herzegovina municipality census declared-religion rows for 2013.", "needs_review", licence_basis_slug),
    durable_file_record(geojson_out, "Simplified geoBoundaries BIH ADM3 142-municipality boundary GeoJSON (2013 frame).", "accepted", "geoboundaries_public_domain")
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id,
         notes = "142 rows (2013); all-persons universe; both margins close to 3,531,159; no suppressed cells."),
    list(uri = paste0("repo:", geojson_out), sha256 = sha256_file(geojson_out), built_by = script_id,
         notes = "142 municipality features from geoBoundaries BIH ADM3, simplified with mapshaper.")
  ),
  validation = list(
    status = "passed",
    commands = list(
      paste("Rscript", script_id),
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/ba/data/area_summary_municipality.json",
      "bash scripts/validate_manifests.sh"
    ),
    gate_2013 = list(status = "passed", both_margins_close_to = unname(nat_expected[["Total"]]),
                     municipality_row_checks = 142L, religion_column_checks = length(cat_bs),
                     records = reconciliation_block(rec_2013)),
    boundary_validation = list(status = "passed", feature_count = 142L,
                               distinct_geometry_hashes = length(unique(hashes)),
                               bbox = as.list(bbox), output_bytes = file_bytes(geojson_out),
                               licence = gb_meta[["boundaryLicense"]], adm_unit_count = gb_meta[["admUnitCount"]],
                               year_represented = gb_meta[["boundaryYearRepresented"]],
                               crosswalk = "16 name entries + 3 shapeID entries (Višegrad mislabelled 'Republika Srpska'; two 'Novi Grad'; 'Kupra na Uni' typo)"),
    join_coverage = list(matched = 142L, expected = 142L),
    notes = paste(
      "2013 (142 municipalities) closes exactly at both margins: every municipality row's 21 categories sum to",
      "its printed Total and every religion column sums to the printed national total 3,531,159. Boundary joins",
      "142/142 via the documented crosswalk. Dash '-' cells read as nil; no cell suppression."),
    warnings = list(
      "Single wave (2013). 1991 is HELD: the 1991 census measured ethnicity, not religion, and no open licensed pre-war municipal boundary exists (CHANGE-WITHHOLD; no cross-wave metric).",
      "Political dispute: the Republika Srpska institute (RZS) rejected the BHAS residence methodology; BHAS is rendered as the official state publication and the dispute is stated neutrally.",
      "The two non-response lines (Undeclared, Unknown) are a disclosed denominator residual; affiliation and no-religion shares need not sum to 100%.",
      "Boundary is geoBoundaries ADM3 (Wikimedia Commons, Public Domain); a documented name/shapeID crosswalk resolves three source data quirks."
    )
  ),
  construct_notes = list(
    "The construct is census declared religion: each resident's declared religious affiliation (Izjašnjavanje o vjeroispovijesti), asked of all persons of all ages in the 2013 census — whether the person considers himself/herself a member of a religion or not — not practice, attendance, or membership.",
    "The public product carries three headline fields per municipality: population total, religious affiliation percent, and no-religion percent. Place-density metrics are null (no governed place-of-worship snapshot).",
    "The 21 verbatim religion categories (Islamska, Pravoslavna, Katolička, Muslimanska, Rimokatolička, Srpska, Jehovini svjedoci, Grkokatolička, Protestantska, Romska, Hrišćanska, Bošnjačka, Hrvat, Adventistička, Bosanac, Agnostik, Ateist, Ostali, Ne izjašnjava se, Nepoznato) are preserved per municipality on the quality flag. Several are ethnonym-in-religion-field declarations rendered verbatim; none is invented, merged, or redistributed.",
    "Slot design (ordinary two-slot, KZ/BZ precedent): religious_affiliation_percent sums every named-religion line; no_religion_percent sums the two explicitly non-religious lines (Agnostik, Ateist); the two non-response lines (Ne izjašnjava se, Nepoznato) stay in the denominator and in neither slot, so the two shares need not sum to 100.",
    "Single wave. 1991 is HELD (CHANGE-WITHHOLD): the 1991 SFRY census measured ethnicity/nationality (nacionalna pripadnost), not religion, so there is no 1991 municipality religion table to render, and no open licensed pre-war (109-municipality) boundary vector exists. The exact unblock is an official BHAS/FZS 1991 municipality religion cross-tab under a stated open licence AND a licensed pre-war municipal boundary — both currently absent.",
    "Political dispute: the 2013 census was contested. The Republika Srpska institute of statistics (RZS) rejected the BHAS residence-based methodology and published separate entity results; the BHAS state-level resident total is 3,531,159. This product renders the BHAS publication as the official state record and states the dispute neutrally; no number is reconciled to the RZS figures.",
    "Licence: no open-data licence is stated on the BHAS census products; the 2013 Book 2 foreword requests that users cite the source ('Users are kindly requested to mention data source'). The product ships derived municipality summaries with attribution to BHAS under the standing BUILD-THEN-ASK ruling; a BHAS reuse-confirmation courtesy ask is recorded for the PI. The boundary is Public Domain per the geoBoundaries release metadata."
  ),
  deferred_sources = list(
    list(source_dataset_id = "ba-census-1991-religion-by-municipality", status = "held",
         url = "https://fzs.ba/", local_path = NULL,
         notes = paste("The 1991 SFRY census measured ethnicity/nationality, not religion (the queue row's",
                       "'ethno-religious affiliation proxy'), so no 1991 municipality religion table exists to",
                       "render. The frame is the pre-war ~109-municipality opština frame, a hard break from the",
                       "post-Dayton 142-unit frame. Unblock: an official BHAS/FZS 1991 municipality RELIGION",
                       "cross-tab under a stated open licence AND a licensed pre-war municipal boundary vector.",
                       "Both are currently absent; a 1991 ethnicity product would be a different construct and is",
                       "out of scope for this religion product.")),
    list(source_dataset_id = "ba-census-2013-book2-t3-ethnicity-religion-crosstab", status = "deferred",
         url = url_book2, local_path = NULL,
         notes = paste("Book 2 Table 3 cross-tabs ethnicity/national affiliation by religion nationally; a",
                       "future national-context lane, not a municipality series.")),
    list(source_dataset_id = "ba-census-2013-book2-t5-1-religion-by-sex", status = "deferred",
         url = url_census, local_path = NULL,
         notes = "Table 5.1 also splits religion by sex within municipality; only the Ukupno/Total (both sexes) block is shipped. The sex cut is a deeper future product.")
  ),
  privacy = "public",
  licence_status = "needs_review",
  licence_basis = licence_basis_slug,
  downstream_status = "accepted",
  source_datasets = source_datasets(),
  notes = paste(
    "Accepted product shipped under BUILD-THEN-ASK with attribution (BHAS requests source attribution; no open",
    "licence stated — licence_status needs_review, a BHAS courtesy ask recorded for the PI). The committed",
    "products are the derived municipality area summary (142 rows, 2013) and the simplified geoBoundaries BIH",
    "ADM3 boundary GeoJSON (Public Domain). Single wave; 1991 held. On-page attribution, when a page is built,",
    "must cite the Agency for Statistics of Bosnia and Herzegovina (2013 Census) and geoBoundaries / Wikimedia",
    "Commons (Public Domain), and must state the 2013 census dispute neutrally."
  )
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

cat("wave shipped: 2013 (142 municipalities) on the post-Dayton municipal frame\n")
cat(sprintf("rows: %d\n", length(rows)))
cat(sprintf("gate 2013: passed; both margins close to %d\n", nat_expected[["Total"]]))
cat(sprintf("boundary 2013: 142 features, %d bytes\n", file_bytes(geojson_out)))
cat("national no-religion (Agnostic+Atheist): 38,669 (1.10%); affiliation: 3,453,202 (97.79%)\n")
cat("licence: needs_review (BHAS attribution request; BUILD-THEN-ASK); boundary Public Domain\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", geojson_out))
cat(sprintf("wrote %s\n", manifest_out))
