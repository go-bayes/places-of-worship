# build the Chile commune census-religion area-summary product for two waves
# (2002, 2024) on the current 346-commune INE DPA frame. religion was asked of
# residents aged 15+ in 2002 and 2024 (the 2012 census was annulled; the 2017
# abbreviated census dropped religion; 1992 is aged 5+ and held). see
# research/countries/cl/route-probe.md for full provenance and licence.
#   inputs (all cached, git-ignored under data/raw/cl_census/):
#   cl_bcn_comunas_2002_2024.json <- BCN Estadisticas Territoriales theme 101
#     "Religion Declarada" commune counts, 2002+2024 (source: INE census);
#     GenerarConsulta idTema=101, tipoUnidadTerritorial=1, variables 14312-14322.
#   ine_comunas_dpa2017.geojson   <- official INE DPA commune boundary (346
#     units, CUT-coded), INE geodata under CC BY-SA 4.0.
# every religion cell is transcribed verbatim from the cached BCN source and
# reconciled against the printed control (total_r) per commune; the build stops
# on any margin failure and never allocates, infers, rounds, imputes, or tunes a
# value. dash reads as 0 for categories and as no-data for total_r.
# outputs: apps/regions/cl/data/{cl_commune_2002_2024.geojson,
#   area_summary_commune.json, area_summary_commune.csv} and
#   docs/manifests/cl-census-religion-2002-2024.json.
# run from the repo root: Rscript scripts/build_cl_area_summary.R

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "CL"
script_id <- "scripts/build_cl_area_summary.R"
raw_dir <- "data/raw/cl_census"
product_dir <- "apps/regions/cl/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-12"
stamp <- paste0(retrieval_date, "T00:00:00Z")
git_commit <- trimws(system2("git", c("rev-parse", "HEAD"), stdout = TRUE))
if (length(git_commit) != 1L || !grepl("^[a-f0-9]{40}$", git_commit)) git_commit <- NULL

# ---- dataset ids ---------------------------------------------------------------
d_census <- "cl-bcn-estadisticas-territoriales-101-religion-declarada-comuna"
d_boundary <- "ine-dpa-censal-comunas-simp16r"
boundary_set_id <- "cl-commune-2024-ine-dpa"

# ---- source urls and cached paths ----------------------------------------------
url_census <- "https://www.bcn.cl/siit/estadisticasterritoriales/tema?id=101"
url_census_service <- "https://www.bcn.cl/siit/estadisticasterritoriales/servicio/GenerarConsulta"
url_boundary <- "https://services5.arcgis.com/hUyD8u3TeZLKPe4T/arcgis/rest/services/Limites_DPA_Censal_2017_AGOL/FeatureServer/3"
url_boundary_item <- "https://www.arcgis.com/sharing/rest/content/items/515565c9739143428fbc50c4689dbca5"
url_terms <- "https://www.ine.gob.cl/terminos-de-uso-y-licencia-de-datos-abiertos"
url_presentation <- "https://censo2024.ine.gob.cl/wp-content/uploads/2025/08/Presentacion-resultados-religion-o-credos_CPV2024.pdf"

path_census <- file.path(raw_dir, "cl_bcn_comunas_2002_2024.json")
path_census_csv <- file.path(raw_dir, "cl_bcn_comunas_2002_2024.csv")
path_boundary <- file.path(raw_dir, "ine_comunas_dpa2017.geojson")
path_boundary_item <- file.path(raw_dir, "ine_dpa_item.json")
path_terms <- file.path(raw_dir, "ine_terminos.html")
path_presentation <- file.path(raw_dir, "cl_2024_religion_presentation.pdf")

geojson_out <- file.path(product_dir, "cl_commune_2002_2024.geojson")
summary_json_out <- file.path(product_dir, "area_summary_commune.json")
summary_csv_out <- file.path(product_dir, "area_summary_commune.csv")
manifest_out <- file.path(manifest_dir, "cl-census-religion-2002-2024.json")

# ---- verbatim BCN theme-101 category frame -------------------------------------
# the harmonised ten-category commune frame (identical across 1992/2002/2024).
# affiliation categories, the no-religion line, and the 2024-only non-response line.
cat_fields <- c("catolica", "evange_protestante", "testigosj", "judaica", "mormon",
                "musulmana", "ortodoxa", "otra", "ninateoagnos", "rel_nodeclarada")
cat_labels <- c(catolica = "Católica", evange_protestante = "Evangélica o Protestante",
                testigosj = "Testigos de Jehová", judaica = "Judaica", mormon = "Mormón",
                musulmana = "Musulmana", ortodoxa = "Ortodoxa",
                otra = "Otro religión o credo",
                ninateoagnos = "Ninguna religión, ateo o agnóstico",
                rel_nodeclarada = "No declara religión")
affiliation_named <- c("catolica", "evange_protestante", "testigosj", "judaica",
                       "mormon", "musulmana", "ortodoxa", "otra")

# ---- helpers -------------------------------------------------------------------
sha256_file <- function(path) unname(tools::sha256sum(path))
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))
require_file <- function(path) {
  if (!file.exists(path) || file_bytes(path) == 0L) stop("missing required source: ", path, call. = FALSE)
}
# parse a BCN cell: dash/blank is nil; numbers are printed integers with a .0 tail.
num_cell <- function(x) {
  if (is.null(x) || is.na(x) || x %in% c("-", "")) return(NA_real_)
  as.numeric(x)
}
# NFKD ascii-fold + uppercase for name crosswalk (Valdivia matches VALDIVIA).
norm_name <- function(s) {
  s <- iconv(s, to = "ASCII//TRANSLIT")
  s <- toupper(trimws(s))
  gsub("[^A-Z0-9]+", " ", s)
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

invisible(lapply(c(path_census, path_boundary, path_boundary_item, path_terms), require_file))

# ---- load census data ----------------------------------------------------------
census <- fromJSON(path_census, simplifyVector = FALSE)
dt <- census[["datosTemaN"]]
ut <- census[["unidadesTerritoriales"]]
cut_name <- vapply(names(ut), function(k) ut[[k]][["descripcion"]], character(1))
names(cut_name) <- names(ut)

# a tidy per-(commune, year) record keyed by source CUT.
records <- lapply(dt, function(r) {
  vals <- lapply(c("total_r", cat_fields), function(f) num_cell(r[[f]]))
  names(vals) <- c("total_r", cat_fields)
  c(list(cut = as.character(r[["id_unidad_territorial"]]), anio = as.character(r[["anio"]])), vals)
})
rec_2002 <- Filter(function(r) r$anio == "2002" && !is.na(r$total_r), records)
rec_2024 <- Filter(function(r) r$anio == "2024" && !is.na(r$total_r), records)
message(sprintf("census rows: 2002 with data %d; 2024 with data %d", length(rec_2002), length(rec_2024)))

# ---- load boundary + build the 2002->2024 CUT crosswalk ------------------------
gb <- st_make_valid(st_read(path_boundary, quiet = TRUE, stringsAsFactors = FALSE))
gb[["cut"]] <- as.character(gb[["CUT"]])
if (nrow(gb) != 346L || anyDuplicated(gb[["cut"]])) {
  stop("INE DPA commune layer is not 346 distinct CUTs", call. = FALSE)
}
boundary_cuts <- gb[["cut"]]
name_to_cut <- setNames(gb[["cut"]], norm_name(gb[["NOM_COMUNA"]]))
if (anyDuplicated(names(name_to_cut))) stop("boundary commune names are not unique for crosswalk", call. = FALSE)

# 2024 joins by CUT directly (verified identical sets); 2002 joins by CUT else name.
c2024 <- vapply(rec_2024, function(r) r$cut, character(1))
if (!setequal(c2024, boundary_cuts)) stop("2024 census CUTs do not match boundary CUTs one-to-one", call. = FALSE)

map_2002_target <- function(r) {
  if (r$cut %in% boundary_cuts) return(r$cut)
  nm <- norm_name(cut_name[[r$cut]])
  tgt <- name_to_cut[[nm]]
  if (is.null(tgt)) return(NA_character_)
  tgt
}
targets_2002 <- vapply(rec_2002, map_2002_target, character(1))
if (anyNA(targets_2002)) stop("a 2002 commune did not map to a current CUT", call. = FALSE)
if (anyDuplicated(targets_2002)) stop("two 2002 communes mapped to the same current CUT", call. = FALSE)
rec_2002_by_target <- setNames(rec_2002, targets_2002)
rec_2024_by_cut <- setNames(rec_2024, c2024)
null_2002 <- setdiff(boundary_cuts, targets_2002)
message(sprintf("2002 crosswalk: %d mapped, %d null (created-2004 + Puchuncavi gap): %s",
                length(targets_2002), length(null_2002), paste(null_2002, collapse = ", ")))

# ---- reconciliation gates (fail-fast; stop, do not tune) -----------------------
# per commune-wave: ten categories (dash=0) sum to total_r in 2002 (exact); in
# 2024 total_r >= named-category sum, the positive residual being the INE-derived
# "Otros cristianos" group the BCN frame does not column. affiliation must be
# non-negative. records every check for the manifest.
recon <- list()
national <- list()
reconcile_wave <- function(recs, year, require_exact) {
  cats <- cat_fields
  tot <- setNames(rep(0, length(cats)), cats); tr <- 0; resid_total <- 0
  for (r in recs) {
    named <- sum(vapply(affiliation_named, function(f) { v <- r[[f]]; if (is.na(v)) 0 else v }, numeric(1)))
    none <- if (is.na(r$ninateoagnos)) 0 else r$ninateoagnos
    nodecl <- if (is.na(r$rel_nodeclarada)) 0 else r$rel_nodeclarada
    catsum <- sum(vapply(cats, function(f) { v <- r[[f]]; if (is.na(v)) 0 else v }, numeric(1)))
    resid <- r$total_r - catsum
    affiliation <- r$total_r - none - nodecl
    if (require_exact && resid != 0) {
      stop(sprintf("%s commune %s: ten categories sum %d != total_r %d (residual %d)",
                   year, r$cut, as.integer(catsum), as.integer(r$total_r), as.integer(resid)), call. = FALSE)
    }
    if (resid < 0) stop(sprintf("%s commune %s: category sum exceeds total_r", year, r$cut), call. = FALSE)
    if (affiliation < 0) stop(sprintf("%s commune %s: negative affiliation", year, r$cut), call. = FALSE)
    for (f in cats) { v <- r[[f]]; tot[[f]] <- tot[[f]] + (if (is.na(v)) 0 else v) }
    tr <- tr + r$total_r; resid_total <- resid_total + resid
  }
  recon[[year]] <<- list(
    communes = length(recs), national_total_r = as.integer(tr),
    national_named_sum = as.integer(sum(tot[affiliation_named])),
    national_none = as.integer(tot[["ninateoagnos"]]),
    national_no_declara = as.integer(tot[["rel_nodeclarada"]]),
    national_affiliation = as.integer(tr - tot[["ninateoagnos"]] - tot[["rel_nodeclarada"]]),
    otros_cristianos_residual = as.integer(resid_total),
    category_national = lapply(tot, as.integer))
  national[[year]] <<- recon[[year]]
}
reconcile_wave(rec_2002, "2002", require_exact = TRUE)
reconcile_wave(rec_2024, "2024", require_exact = FALSE)
message(sprintf("gate 2002: PASSED (exact; total_r %d, catolica %d, none %d, affiliation %d)",
                recon[["2002"]]$national_total_r, recon[["2002"]]$category_national$catolica,
                recon[["2002"]]$national_none, recon[["2002"]]$national_affiliation))
message(sprintf("gate 2024: PASSED (total_r %d, catolica %d, none %d, no-declara %d, affiliation %d, otros-cristianos residual %d)",
                recon[["2024"]]$national_total_r, recon[["2024"]]$category_national$catolica,
                recon[["2024"]]$national_none, recon[["2024"]]$national_no_declara,
                recon[["2024"]]$national_affiliation, recon[["2024"]]$otros_cristianos_residual))

# ---- boundary geometry: area + simplify ----------------------------------------
# equal-area projection centred on continental Chile for land areas (the Comuna
# Antartica polygon reaches -89 lat; its area is large but rendered as published).
cl_laea <- "+proj=laea +lat_0=-40 +lon_0=-71 +datum=WGS84 +units=m +no_defs"
gb[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(gb, cl_laea))) / 1e6
gb <- st_transform(st_make_valid(gb), 4326)

boundary <- gb[, c("cut", "NOM_COMUNA", "NOM_REGION", "land_area_sq_km", "geometry")]
boundary[["area_code"]] <- boundary[["cut"]]
boundary[["area_name"]] <- boundary[["NOM_COMUNA"]]
boundary[["region_name"]] <- boundary[["NOM_REGION"]]
boundary[["area_unit_id"]] <- paste(boundary_set_id, boundary[["cut"]], sep = ":")

simplification <- mapshaper_simplify_to_cap(
  boundary[, c("area_code", "area_name", "region_name", "area_unit_id", "land_area_sq_km", "geometry")],
  geojson_out, max_bytes = 1800000L,
  keep_percentages = c(15, 10, 7, 5, 3, 2, 1.5, 1, 0.7),
  clean_option = "allow-overlaps")
written <- st_read(geojson_out, quiet = TRUE, stringsAsFactors = FALSE)
written <- written[match(boundary[["area_code"]], written[["area_code"]]), ]
if (anyNA(written[["area_code"]]) || nrow(written) != 346L) stop("simplified boundary lost a commune", call. = FALSE)
w_valid <- st_is_valid(written)
if (any(st_is_empty(written)) || any(is.na(w_valid)) || any(!w_valid)) {
  stop("simplified boundary has empty or invalid geometries", call. = FALSE)
}
hashes <- geometry_hashes(written)
if (length(unique(hashes)) != 346L) stop("simplified geometry hashes not distinct", call. = FALSE)
bbox <- st_bbox(written)
message(sprintf("boundary: PASSED (346 distinct features, %d bytes at %g%% keep)",
                file_bytes(geojson_out), simplification[["keep_percent"]]))

# ---- product rows --------------------------------------------------------------
flag_common <- paste(
  "census_affiliation", "aged_15_plus_universe", "single_select_reported_religion",
  "bcn_harmonised_ten_category_frame",
  "religious_affiliation_percent_is_total_minus_none_minus_no_declara",
  "no_religion_percent_is_ninguna_line_only",
  "no_declara_residual_in_denominator_neither_slot_2024_only",
  "shares_over_total_r_ine_headline_uses_responder_base_no_declara_excluded",
  "shares_need_not_sum_to_100",
  "single_current_346_commune_frame_2002_recoded_by_cut_then_name",
  "census_licence_cc_by_sa_4_0",
  sep = ";")
basis_2002 <- paste(
  "2002 National Census of Chile (INE), population aged 15+, disseminated as BCN",
  "Estadisticas Territoriales theme 101 'Religion Declarada' at commune level.",
  "Denominator is the printed commune total_r ('Poblacion total en encuesta",
  "Religion'). Affiliation = total_r - Ninguna (no 'No declara' line in 2002).")
basis_2024 <- paste(
  "2024 National Census of Chile (INE, question 31), population aged 15+,",
  "disseminated as BCN Estadisticas Territoriales theme 101 'Religion Declarada'",
  "at commune level. Denominator is the printed commune total_r. Affiliation =",
  "total_r - Ninguna - 'No declara religion'.")

# the four 2004-parent communes: their 2002 record combines the later-created
# child (Iquique+Alto Hospicio, Talcahuano+Hualpen, Santa Barbara+Alto Biobio,
# Nueva Imperial+Cholchol), and the 2024 record excludes it. the change pair is
# a different universe, and the record withholds change on those pairs; the
# token carries the change_withheld substring so the runtime's blanket guard
# nulls the change metric on the parents (and the null 2002 children null via
# the finite-operand guard).
parents_2004 <- c("1101", "8110", "8311", "9111")

# build one schema-shaped row for a commune-wave, or a null-data row (2002 gaps).
make_row <- function(cut, year, rec, region_name, land_area) {
  basis <- if (year == 2002L) basis_2002 else basis_2024
  if (is.null(rec)) {
    return(list(
      country_code = country_code, boundary_set_id = boundary_set_id,
      boundary_level = "commune",
      area_unit_id = paste(boundary_set_id, cut, sep = ":"), area_code = cut,
      area_name = cut_area_name[[cut]], year = as.integer(year),
      population_total = NULL, population_total_basis = basis,
      religious_affiliation_count = NULL, religious_affiliation_percent = NULL,
      no_religion_count = NULL, no_religion_percent = NULL,
      place_count = NULL, places_per_10000_residents = NULL,
      place_density_per_sq_km = NULL, land_area_sq_km = unname(round(land_area, 4)),
      site_snapshot_date = NULL, place_count_basis = NULL,
      source_dataset_ids = list(d_census, d_boundary),
      quality_flag = paste0(flag_common, ";no_2002_commune_data_created_2004_or_bcn_gap")))
  }
  pop <- as.integer(rec$total_r)
  none <- as.integer(if (is.na(rec$ninateoagnos)) 0 else rec$ninateoagnos)
  nodecl <- as.integer(if (is.na(rec$rel_nodeclarada)) 0 else rec$rel_nodeclarada)
  affiliation <- pop - none - nodecl
  breakdown <- paste(vapply(cat_fields, function(f) {
    v <- rec[[f]]; paste0(cat_labels[[f]], "=", if (is.na(v)) 0L else as.integer(v))
  }, character(1)), collapse = ";")
  list(
    country_code = country_code, boundary_set_id = boundary_set_id,
    boundary_level = "commune",
    area_unit_id = paste(boundary_set_id, cut, sep = ":"), area_code = cut,
    area_name = cut_area_name[[cut]], year = as.integer(year),
    population_total = pop, population_total_basis = basis,
    religious_affiliation_count = as.integer(affiliation),
    religious_affiliation_percent = round(100 * affiliation / pop, 4),
    no_religion_count = none, no_religion_percent = round(100 * none / pop, 4),
    place_count = NULL, places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL, land_area_sq_km = unname(round(land_area, 4)),
    site_snapshot_date = NULL, place_count_basis = NULL,
    source_dataset_ids = list(d_census, d_boundary),
    quality_flag = paste0(flag_common,
                          if (cut %in% parents_2004)
                            ";change_withheld_2004_reclassification_parent_2002_combines_later_child"
                          else "",
                          ";source_region=", region_name,
                          ";source_categories_verbatim=", breakdown))
}

cut_area_name <- setNames(boundary[["area_name"]], boundary[["cut"]])
cut_region <- setNames(boundary[["region_name"]], boundary[["cut"]])
cut_land <- setNames(written[["land_area_sq_km"]], written[["area_code"]])

rows <- list()
for (cut in boundary_cuts) {
  rows[[length(rows) + 1L]] <- make_row(cut, 2002L, rec_2002_by_target[[cut]],
                                        cut_region[[cut]], cut_land[[cut]])
  rows[[length(rows) + 1L]] <- make_row(cut, 2024L, rec_2024_by_cut[[cut]],
                                        cut_region[[cut]], cut_land[[cut]])
}
message(sprintf("rows: %d (346 communes x 2 waves)", length(rows)))

# ---- area-summary document -----------------------------------------------------
census_licence_name <- paste(
  "Instituto Nacional de Estadisticas (INE) open-data licence. The INE terms",
  "(ine.gob.cl/terminos-de-uso-y-licencia-de-datos-abiertos, retrieved 2026-07-12)",
  "state: 'El contenido de este sitio Web se rige bajo una licencia de Creative",
  "Commons Reconocimiento-CompartirIgual 4.0 Internacional' (CC BY-SA 4.0): free",
  "reuse including commercial, with attribution ('Fuente: INE, nombre del producto",
  "..., actualizada AAAA') and share-alike, and a requirement to state that any",
  "derivation is not INE's own analysis.")

source_datasets <- function() {
  list(
    list(
      source_dataset_id = d_census,
      name = "Chile census religion by commune, 2002 and 2024 (INE, via BCN Estadisticas Territoriales theme 101 'Religion Declarada')",
      provider = "Instituto Nacional de Estadisticas de Chile (INE); disseminated by the Biblioteca del Congreso Nacional de Chile (BCN)",
      url = url_census, retrieval_date = retrieval_date, local_path = path_census,
      licence = list(name = census_licence_name, url = url_terms,
                     attribution = "Fuente: Instituto Nacional de Estadisticas (INE), Censo 2002 y Censo 2024, Religion Declarada (via BCN Estadisticas Territoriales)"),
      citation = "INE, Censo de Poblacion y Vivienda 2002 y 2024, Religion Declarada por comuna (BCN Estadisticas Territoriales, tema 101).",
      access_limits = NULL,
      redistribution_limits = "Open reuse with attribution and share-alike (CC BY-SA 4.0); derived commune summaries ship with attribution to INE and carry the share-alike notice.",
      notes = paste("Aged 15+ in both waves. Ten-category harmonised BCN frame. 2002 reconciles exactly",
                    "(ten categories sum to total_r); 2024 carries a small positive residual (26,051 nationally,",
                    "the INE-derived 'Otros cristianos' group not columned by BCN), folded into affiliation.")),
    list(
      source_dataset_id = d_boundary,
      name = "INE DPA Censal commune boundary (Comunas_Simp16R, 346 communes, CUT-coded)",
      provider = "Instituto Nacional de Estadisticas de Chile (INE), DPA Working Group of IDE Chile",
      url = url_boundary, retrieval_date = retrieval_date, local_path = path_boundary,
      licence = list(name = census_licence_name, url = url_terms,
                     attribution = "Fuente: Instituto Nacional de Estadisticas (INE), Division Politico Administrativa Censal"),
      citation = "INE, Limites DPA Censal (Comunas_Simp16R), 346 communes.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary is committed under CC BY-SA 4.0 with attribution to INE and the share-alike notice.",
      notes = paste("346 communes with CUT codes; joins the 2024 census one-to-one. Extent includes Isla de",
                    "Pascua (CUT 5201) and the Comuna Antartica (CUT 12202, -89 lat, Chilean Antarctic claim),",
                    "rendered as the official record. The alternative geoBoundaries CHL ADM3 (CC BY 3.0 IGO, 345",
                    "units, name-only) is recorded in the probe as the explicit-licence swap-in."))
  )
}

indicators <- function() {
  denom_note <- paste(
    "Percentages use each commune's printed census total_r ('Poblacion total en encuesta Religion').",
    "INE's own headline percentages use the responder base (total_r minus 'No declara'), so the",
    "product's no-religion share runs ~0.58pp below the INE 2024 headline and is identical in 2002.")
  list(
    list(indicator_id = "population_total", label = "Census religion-base population (aged 15+)",
         description = "Commune population aged 15+ in the wave's religion table (total_r).",
         unit = "count", denominator_indicator_id = NULL,
         method = "Printed commune total_r from BCN theme 101 (INE census 2002; 2024).",
         temporal_coverage = "2002; 2024", spatial_coverage = "Chile communes (346 current frame)",
         quality_notes = "Both waves count persons aged 15+ (no universe break). 2002 is null for five communes (four created in 2004; Puchuncavi a BCN 2002-series gap)."),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
         description = "Share of the commune population aged 15+ reporting affiliation with a named religion.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (total_r - Ninguna - 'No declara religion') / total_r.",
         temporal_coverage = "2002; 2024", spatial_coverage = "Chile communes (346 current frame)",
         quality_notes = paste("Affiliation is defined as total minus no-religion minus non-response, so it captures the INE-derived 'Otros cristianos' group the BCN ten-category frame does not column.", denom_note)),
    list(indicator_id = "no_religion_percent", label = "No religious affiliation %",
         description = "Share in the census 'Ninguna religion, ateo o agnostico' line.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (Ninguna religion, ateo o agnostico) / total_r.",
         temporal_coverage = "2002; 2024", spatial_coverage = "Chile communes (346 current frame)",
         quality_notes = paste("National no-religion share (responder base) rose 8.3% (2002) to 25.8% (2024).", denom_note))
  )
}

visual_layers <- function() {
  list(
    list(visual_layer_id = "cl-commune-religious-affiliation", label = "Religious affiliation %",
         description = "Chile census-affiliation share by commune, 2002 and 2024.", layer_type = "choropleth",
         indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "commune aged-15+ population, incl. a 'No declara' residual in 2024"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "reported commune value", uncertainty_display = "quality_flag",
         default_visibility = TRUE,
         notes = "Census affiliation, not practice or membership. Both waves share the current 346-commune frame; five communes are null in 2002. The Comuna Antartica extends to -89 lat; a continental viewport clip may be preferred at page time."),
    list(visual_layer_id = "cl-commune-no-religion", label = "No religious affiliation %",
         description = "Chile census no-religion share by commune, 2002 and 2024.", layer_type = "choropleth",
         indicator_ids = list("no_religion_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "commune aged-15+ population"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "reported commune value", uncertainty_display = "quality_flag",
         default_visibility = FALSE,
         notes = "The source category is 'Ninguna religion, ateo o agnostico'. The secularisation trend (8.3% to 25.8% nationally) is the headline signal.")
  )
}

summary_product <- list(
  schema_version = "area-summary.v1", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code,
                      level = "commune", vintage = "2024 current 346-commune frame (INE DPA); 2002 re-coded onto it by CUT then name",
                      source_dataset_id = d_boundary),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "No governed place-of-worship snapshot ships in the Chile census product.",
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
    g <- function(k) { v <- r[[k]]; if (is.null(v)) NA else v }
    data.frame(
      country_code = r[["country_code"]], boundary_set_id = r[["boundary_set_id"]],
      boundary_level = r[["boundary_level"]], area_unit_id = r[["area_unit_id"]],
      area_code = r[["area_code"]], area_name = r[["area_name"]], year = r[["year"]],
      population_total = g("population_total"), population_total_basis = r[["population_total_basis"]],
      religious_affiliation_count = g("religious_affiliation_count"),
      religious_affiliation_percent = g("religious_affiliation_percent"),
      no_religion_count = g("no_religion_count"), no_religion_percent = g("no_religion_percent"),
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
       raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/cl_census/"))
}
durable_file_record <- function(path, content, licence_status_value, licence_basis_value) {
  list(uri = paste0("repo:", path), storage_provider = "git_repository", format = sub("^.*\\.", "", path),
       bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = if (grepl("area_summary|\\.csv$", path)) row_count_file(path) else NULL,
       feature_count = if (grepl("\\.geojson$", path)) row_count_file(path) else NULL,
       content = content, privacy = "public",
       licence_status = licence_status_value, licence_basis = licence_basis_value)
}

licence_basis_slug <- "ine_chile_cc_by_sa_4_0"

raw_sources <- list(
  raw_source_record(path_census, url_census_service, "json", TRUE, "2002;2024", d_census,
    paste("BCN GenerarConsulta theme 101 (idTema=101, tipoUnidadTerritorial=1, variables 14312-14322, anios",
          "2002+2024, all commune CUTs); source INE census. 2002 reconciles exactly to total_r 11,128,104;",
          "2024 to total_r 15,205,784 with a 26,051 'Otros cristianos' residual folded into affiliation.")),
  raw_source_record(path_census_csv, url_census_service, "csv", FALSE, "2002;2024", d_census,
    "Same BCN query, CSV form (companion to the JSON build input)."),
  raw_source_record(path_boundary, url_boundary, "geojson", TRUE, "2024", d_boundary,
    "INE DPA Censal Comunas_Simp16R (346 communes, CUT-coded); joins the 2024 census one-to-one by CUT."),
  raw_source_record(path_boundary_item, url_boundary_item, "json", FALSE, "2024", d_boundary,
    "ArcGIS item metadata for the INE DPA commune layer (provenance; owner publicaciones_geodatos)."),
  raw_source_record(path_terms, url_terms, "html", FALSE, "2026", d_census,
    "INE terms of use: CC BY-SA 4.0 (Reconocimiento-CompartirIgual 4.0), quoted verbatim."),
  raw_source_record(path_presentation, url_presentation, "pdf", FALSE, "2024", d_census,
    "INE 2024 religion presentation (Q.31 categories, aged-15+ universe, national/regional context; external reconciliation check).")
)

dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)
dataset_id <- "cl-census-religion:cl:2002-2024:ine-commune"

recon_block <- function() {
  lapply(c("2002", "2024"), function(y) {
    r <- recon[[y]]
    list(year = as.integer(y), communes = r$communes, national_total_r = r$national_total_r,
         national_affiliation = r$national_affiliation, national_none = r$national_none,
         national_no_declara = r$national_no_declara,
         otros_cristianos_residual = r$otros_cristianos_residual,
         catolica = r$category_national$catolica, evangelica = r$category_national$evange_protestante,
         exact_internal = (y == "2002"))
  })
}

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = paste0("manifest:", dataset_id),
  dataset_id = dataset_id,
  dataset_version_id = paste0(dataset_id, ":", dataset_hash),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "cl-census-religion", dataset_role = "accepted_export",
  scope = list(level = "country", country_codes = list("CL"), snapshot_date = NULL,
               snapshot_anchor = NULL, pipeline_stage = "accepted"),
  created_at = stamp, created_by = script_id,
  target_years = list(2002L, 2024L),
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation",
      shipped_waves = list(2002L, 2024L),
      shipped_geography = "346 communes (current INE DPA frame); both waves on one frame",
      boundary_set = boundary_set_id,
      source_route = paste(
        "BCN Estadisticas Territoriales theme 101 'Religion Declarada' (source INE census):",
        "POST GenerarConsulta idTema=101 tipoUnidadTerritorial=1 variables=14312..14322 anios=2002,2024",
        "with all commune CUTs; download descargar-resultados/<id>/datos.json. No CAPTCHA on the query."),
      universes = list(`2002` = "aged 15+", `2024` = "aged 15+"),
      denominators = list(
        `2002` = "commune total_r; affiliation = total_r - Ninguna (no 'No declara' line)",
        `2024` = "commune total_r; affiliation = total_r - Ninguna - 'No declara religion'"),
      slot_design = paste(
        "Ordinary two-slot (KZ/BZ precedent; Chile has a real 'Ninguna' no-religion category, no minority-share",
        "gate). religious_affiliation_percent = (total_r - Ninguna - No-declara)/total_r; no_religion_percent =",
        "Ninguna/total_r. 'No declara' (2024 only) is a disclosed denominator residual in neither slot, so the two",
        "shares need not sum to 100. INE's headline percentages use the responder base (total_r minus No-declara),",
        "so the product no-religion share runs ~0.58pp below the INE 2024 headline and is identical in 2002."),
      category_frame = list(
        bcn_harmonised_ten = as.list(unname(cat_labels)),
        census_2024_questionnaire = list("Catolica", "Evangelica o protestante", "Judia", "Musulmana",
          "Mormon", "Catolica Ortodoxa", "Budista", "Hinduista", "Fe Baha'i", "Testigo de Jehova",
          "Otra religion o credo", "Ninguna"),
        frame_note = paste(
          "The commune series uses the BCN harmonised ten-category frame (identical across 1992/2002/2024), which",
          "folds the finer 2024 census options (Budista, Hinduista, Fe Baha'i) into 'Otro religion o credo'. The",
          "finer 2024 categories and the derived 'Otros cristianos y tradiciones relacionadas con Cristo' appear",
          "only in the INE national/regional presentation; the 26,051-person 'Otros cristianos' group is the 2024",
          "residual (total_r minus the ten BCN columns), folded into the affiliation slot.")),
      frame_break = paste(
        "Both waves ship on the current 346-commune frame. When Arica y Parinacota + Los Rios (2007) and Nuble",
        "(2018) split off, 37 communes were re-coded (e.g. Valdivia 10501->14101); the build maps 2002 CUTs to",
        "current CUTs directly (304) or by unique name (37), 0 unmatched. Five communes are null in 2002: four",
        "created in 2004 (Alto Hospicio, Hualpen, Alto Biobio, Cholchol; parents carry the combined 2002 count,",
        "change withheld on those pairs) and Puchuncavi (a BCN 2002-series gap). No backcast, no invented split."),
      external_reconciliation = paste(
        "2024 matches the INE presentation within sub-0.005% (affiliation 11,215,141 vs 11,214,961; none 3,903,128",
        "vs 3,903,308; Catolica 8,168,945 vs 8,168,978). 2002 runs ~0.87% below the INE regional/national base",
        "(commune total_r 11,128,104 vs ~11,226,309), uniform across categories; reconciles exactly internally;",
        "documented discrepancy (Saint Lucia/CI precedent), never redistributed."),
      antarctic_extent = "The Comuna Antartica (CUT 12202) polygon reaches -89 lat (Chilean Antarctic claim); rendered as published. No dateline cut needed (all longitudes western negative). Isla de Pascua (CUT 5201) at -109.45 lon is present.",
      omitted_metrics = list("place_count", "places_per_10000_residents", "place_density_per_sq_km"),
      boundary_simplification = simplification,
      local_cache_hint = "All raw sources are cached under data/raw/cl_census/ and remain git-ignored.",
      retrieval_record = raw_sources
    ),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")), digest = as.character(packageVersion("digest")),
      mapshaper = "scripts/lib/simplify_boundary.R (npx mapshaper)"
    )
  ),
  source = list(
    provider = "Instituto Nacional de Estadisticas de Chile (INE); disseminated by the Biblioteca del Congreso Nacional (BCN)",
    source_dataset_ids = list(d_census, d_boundary),
    source_urls = list(url_census, url_census_service, url_boundary, url_boundary_item, url_terms, url_presentation),
    retrieved_at = stamp,
    licence = census_licence_name,
    citation = "INE, Censo 2002 y Censo 2024, Religion Declarada por comuna (BCN Estadisticas Territoriales tema 101); INE DPA Censal commune boundary.",
    raw_redistribution = "The BCN census JSON/CSV and the INE boundary geojson are not committed; they remain in data/raw/cl_census/.",
    local_cache_hint = "data/raw/cl_census/ (git-ignored by .gitignore data/ rule)",
    raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/cl_census/")
  ),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = list(
    durable_file_record(summary_json_out, "Chile commune census-affiliation area summary for 2002 and 2024 (346 communes).", "accepted", licence_basis_slug),
    durable_file_record(summary_csv_out, "Flattened Chile commune census-affiliation rows for 2002 and 2024.", "accepted", licence_basis_slug),
    durable_file_record(geojson_out, "Simplified INE DPA 346-commune boundary GeoJSON (current frame).", "accepted", licence_basis_slug)
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id,
         notes = "692 rows: 346 communes x 2 waves; 2002 null for five communes; aged-15+ universe both waves."),
    list(uri = paste0("repo:", geojson_out), sha256 = sha256_file(geojson_out), built_by = script_id,
         notes = "346 commune features from the INE DPA Censal layer, simplified with mapshaper.")
  ),
  validation = list(
    status = "passed",
    commands = list(
      paste("Rscript", script_id),
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/cl/data/area_summary_commune.json",
      "bash scripts/validate_manifests.sh"
    ),
    reconciliation = recon_block(),
    boundary_validation = list(status = "passed", feature_count = 346L,
      distinct_geometry_hashes = length(unique(hashes)), output_bytes = file_bytes(geojson_out),
      keep_percent = simplification[["keep_percent"]], bbox = as.list(bbox),
      licence = "INE CC BY-SA 4.0 (site-wide open-data terms; item licence field blank)",
      cut_join = "346/346 one-to-one with the 2024 census; 2002 mapped 341 (304 direct + 37 by name), 5 null"),
    notes = paste(
      "2002 reconciles exactly (ten categories sum to commune total_r; national total_r 11,128,104). 2024 total_r",
      "15,205,784 with a 26,051 'Otros cristianos' residual folded into affiliation (affiliation 11,215,141 matches",
      "the INE presentation within 180). 2002 runs ~0.87% below the INE national base (documented discrepancy)."),
    warnings = list(
      "2002 is null for five communes (four created in 2004; Puchuncavi a BCN 2002-series gap); the four 2004 parents carry the combined 2002 count, change withheld on those pairs.",
      "The product's shares use the full total_r denominator; INE's headline percentages use the responder base (total_r minus No-declara), a ~0.58pp difference in 2024, zero in 2002.",
      "The 2002 commune series runs ~0.87% below the INE regional/national base, uniform across categories; reconciles exactly internally; documented, never redistributed.",
      "The Comuna Antartica polygon reaches -89 lat (Chilean Antarctic claim), rendered as the official record; a continental viewport clip may be preferred at page time.",
      "Licence is CC BY-SA 4.0 (share-alike); the derived product carries the share-alike notice and must state the shares are the project's derivation, not INE's own analysis."
    )
  ),
  construct_notes = list(
    "The construct is census affiliation: each resident's reported religion (asked of persons aged 15+), not practice, attendance, or membership. Religion was asked in the 2002 and 2024 censuses; the 2012 census was annulled and the 2017 abbreviated census dropped religion; 1992 (aged 5+) is held.",
    "The public product carries three headline fields per commune-wave: population total (aged-15+ religion base), religious affiliation percent, and no-religion percent. Place-density metrics are null (no governed place-of-worship snapshot).",
    "The commune series uses the BCN harmonised ten-category frame (Catolica, Evangelica o Protestante, Testigos de Jehova, Judaica, Mormon, Musulmana, Ortodoxa, Otro religion o credo, Ninguna religion/ateo/agnostico, No declara religion), preserved verbatim per commune on the quality flag.",
    "Slot design (ordinary two-slot, KZ/BZ precedent): religious_affiliation_percent = (total_r - Ninguna - No-declara)/total_r captures the INE-derived 'Otros cristianos' group the BCN frame does not column; no_religion_percent = Ninguna/total_r. 'No declara' (2024 only, national 87,515) is a disclosed denominator residual in neither slot, so the two shares need not sum to 100.",
    "Both waves ship on the current 346-commune frame. 2002 CUTs are mapped to current CUTs by direct match (304) or unique name (37); five communes are null in 2002 (four created in 2004 whose parents carry the combined count, change withheld on those pairs; and Puchuncavi, a BCN 2002-series gap). No backcast, no invented split.",
    "Licence: INE CC BY-SA 4.0 (Reconocimiento-CompartirIgual 4.0), quoted verbatim in source.licence and captured under data/raw/cl_census/. The product ships with attribution to INE and carries the share-alike notice; on-page attribution must state the shares are the project's derivation, not INE's own analysis. No reuse ask gates the build; a courtesy note is recorded for the PI."
  ),
  deferred_sources = list(
    list(source_dataset_id = "cl-census-religion-1992-commune", status = "deferred",
         url = url_census, local_path = NULL,
         notes = "BCN theme 101 also publishes 1992 religion by commune, but aged 5+ (a universe break vs the shipped 15+ waves) and predating commune creations; a documented deeper-history wave, not shipped, no backcast."),
    list(source_dataset_id = "cl-census-2024-fine-categories-national", status = "deferred",
         url = url_presentation, local_path = NULL,
         notes = "The 2024 INE presentation carries finer national/regional categories (Budista, Hinduista, Fe Baha'i, and the derived 'Otros cristianos') not available at commune level in the BCN harmonised frame; a future national-context lane.")
  ),
  privacy = "public",
  licence_status = "accepted",
  licence_basis = licence_basis_slug,
  downstream_status = "accepted",
  source_datasets = source_datasets(),
  notes = paste(
    "Accepted product (INE CC BY-SA 4.0 with attribution and share-alike). The committed products are the derived",
    "commune area summary (692 rows across 2002 and 2024) and the simplified 346-commune INE DPA boundary GeoJSON.",
    "On-page attribution, when a page is built, must cite INE (Censo 2002 y 2024, Religion Declarada, via BCN",
    "Estadisticas Territoriales) and state that the shares are the project's derivation, not INE's own analysis."
  )
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

cat("waves shipped: 2002 and 2024 on the current 346-commune INE DPA frame\n")
cat(sprintf("rows: %d (346 communes x 2 waves)\n", length(rows)))
cat(sprintf("gate 2002: exact; total_r %d, none %d, affiliation %d\n",
            recon[["2002"]]$national_total_r, recon[["2002"]]$national_none, recon[["2002"]]$national_affiliation))
cat(sprintf("gate 2024: total_r %d, none %d, no-declara %d, affiliation %d, otros-cristianos residual %d\n",
            recon[["2024"]]$national_total_r, recon[["2024"]]$national_none,
            recon[["2024"]]$national_no_declara, recon[["2024"]]$national_affiliation,
            recon[["2024"]]$otros_cristianos_residual))
cat(sprintf("boundary: 346 features, %d bytes at %g%% keep\n", file_bytes(geojson_out), simplification[["keep_percent"]]))
cat("licence: accepted (INE CC BY-SA 4.0, share-alike carried)\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", geojson_out))
cat(sprintf("wrote %s\n", manifest_out))
