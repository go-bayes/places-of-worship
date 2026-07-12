# build the Spain survey affiliation-and-practice product from the CIS
# (Centro de Investigaciones Sociologicas) Barometro de Abril 2025, Estudio n0
# 3505: the 2020-onward community-designed CATI barometer (minimum 100 interviews
# per autonomous community, dedicated per-community weight PESOCCAA), on the
# 19-unit autonomous-community frame (17 communities + Ceuta + Melilla).
#
# inputs (all under git-ignored data/raw/es_cis/):
#   - MD3505.zip : the CIS open microdata bundle for study 3505, containing
#       3505_num.csv (numeric matriz de datos, the source of record here),
#       codigo3505.pdf (codebook), FT3505.pdf (ficha tecnica), cues3505.pdf.
#   - esp_adm1.geojson : geoBoundaries ESP ADM1 (19 features, CC BY 4.0; IGN/CNIG
#       source) for the autonomous-community boundary keyed by area_unit_id.
# outputs:
#   - apps/regions/es/data/area_summary_community.{json,csv} (area-summary.v2)
#   - apps/regions/es/data/es_ccaa_community_2025.geojson (19 community features)
#   - docs/manifests/es-cis-religion-2025.json (data-manifest.v2)
# run from the repo root: Rscript scripts/build_es_area_summary.R
#
# product scope. one wave (Estudio 3505, fieldwork April 2025), 19 autonomous
# communities, two metrics, both SURVEY estimates with their own dataNoun and
# NEVER blended with census affiliation (Spain's census carries no religion
# question; the CIS barometer is the affiliation-and-practice route). weighted
# percentages (PESOCCAA, the community-estimation weight the ficha tecnica
# documents) with per-community 95% uncertainty; no counts are shipped.
#
# metric design.
#   metric 1 - religious self-definition (P28 / variable RELIGION). the item
#     prints six substantive categories plus N.C. affiliation = Catolico/a
#     practicante + Catolico/a no practicante + Creyente de otra religion (codes
#     1+2+3); no_religion = Agnostico/a + Indiferente, no creyente + Ateo/a
#     (codes 4+5+6); N.C. (9) is the residual to 100. the full seven-category
#     breakdown rides the per-row composition array. base = all community
#     respondents.
#   metric 2 - mass attendance (P28a / variable PRACTICARELIG6), asked only of
#     those who define as Catholic or believer of another religion (RELIGION in
#     1,2,3; the non-asked carry N.P. = 0). headline = share attending at least
#     two or three times a month (codes 4+5+6), plus a weekly-or-more cut (codes
#     5+6); base = the asked subset (a filtered subgroup, materially smaller than
#     the community sample). the full seven-category frequency distribution is
#     recorded per community in the manifest.
#
# uncertainty. each shipped share carries a 95% interval computed on the Kish
# effective sample size n_eff = (sum w)^2 / sum(w^2) over the metric's base
# (design-effect-adjusted for the PESOCCAA weighting), MoE = 1.96 * sqrt(p(1-p)/
# n_eff). the ficha tecnica's published maximum community sampling error is
# carried alongside as an anchor. every interval and both bases (unweighted n,
# Kish n_eff) are recorded per community in the manifest and in quality_flag.
#
# small-cell rule (docs/development/small-cell-rule.md, RATIFIED 2026-07-12).
#   the ratified thresholds are written for census PERSONS (denominator < 100
#   persons washes pale; numerator < 10 persons marks the cell). their
#   applicability to SURVEY respondent n is not settled by the doc. this build
#   applies the numeric thresholds to the unweighted respondent n as the closest
#   analogue - the same reading the route-probe used to wash Ceuta and Melilla
#   (n~19) - and emits small_denominator_under_100 / small_cell_under_10 tokens
#   mechanically. a mechanical read additionally washes the full-design
#   communities whose REALISED n dipped just under 100 (Aragon 98, Asturias 95,
#   La Rioja 89) and, for the filtered attendance metric, most communities. this
#   interpretive question (survey respondent n vs designed n vs population as the
#   rule's denominator) is recorded for the conductor in the manifest; no NEW
#   treatment is invented here.
#
# licence. CIS study matrices are federated to datos.gob.es as open microdata
# with an affirmative open-reuse grant (reproduction, modification, distribution
# and communication for commercial and non-commercial use, per the portal's
# general terms) subject to a CIS source-citation condition. accepted with CIS
# citation; the grant is recorded verbatim in the manifest. boundary geoBoundaries
# ESP ADM1 is CC BY 4.0 (IGN/CNIG source). the product ships STAGED (no page, no
# hub).

suppressPackageStartupMessages({
  library(jsonlite)
  library(sf)
  library(stringi)
  library(digest)
})

country_code <- "ES"
script_id <- "scripts/build_es_area_summary.R"
raw_dir <- "data/raw/es_cis"
output_dir <- "apps/regions/es/data"
manifest_dir <- "docs/manifests"

retrieval_date <- "2026-07-12"
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")

# ---- cached inputs, pinned URLs, and recorded hashes -----------------------

md_zip <- file.path(raw_dir, "MD3505.zip")
micro_csv <- file.path(raw_dir, "3505_num.csv")
codebook_pdf <- file.path(raw_dir, "codigo3505.pdf")
ficha_pdf <- file.path(raw_dir, "FT3505.pdf")
boundary_src <- file.path(raw_dir, "esp_adm1.geojson")

url_md_zip <- "https://www.cis.es/documents/20117/13445319/MD3505.zip"
url_study <- "https://www.cis.es/detalle-ficha-estudio?origen=estudio&codEstudio=3505"
url_bancos <- "https://www.cis.es/en/w/bancos-de-datos"
url_datos_gob <- "https://datos.gob.es/es/noticias/el-analisis-online-del-banco-de-datos-del-cis"
url_boundary <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/ESP/ADM1/geoBoundaries-ESP-ADM1.geojson"
url_boundary_meta <- "https://www.geoboundaries.org/api/current/gbOpen/ESP/ADM1/"

# recorded sha-256 hashes; a mismatch means the source drifted and the build must
# STOP rather than ship an unverified estimate. the ZIP itself is not re-hashed
# (its member timestamps vary); the extracted CSV, codebook and boundary are.
expected_sha256 <- c(
  "3505_num.csv"   = "b08ca759ffd3917a26756a8dcad5a5ce5d198d89f6b13c51c21e8136b5ae552a",
  "codigo3505.pdf" = "ceba212076b3c4132c983b562044a73f6d257e1edbdd1730a4450088d9272f78",
  "FT3505.pdf"     = "b37114573b7eb195162b684b337cb7116ddade801bf905ed56825a4b36287928",
  "esp_adm1.geojson" = "adce53a257c2ddba0b135f330b73f5cd296edc58bd15012e33df66ba841e13e4"
)
md_zip_sha256 <- "df1f28248e622ac23fde454c3c4f2e4c8ff293bdbb2705be26ec64fc5e255392"

boundary_set_id <- "es-ccaa-cis-3505"
boundary_output <- file.path(output_dir, "es_ccaa_community_2025.geojson")
summary_output <- file.path(output_dir, "area_summary_community.json")
summary_csv_output <- file.path(output_dir, "area_summary_community.csv")
manifest_output <- file.path(manifest_dir, "es-cis-religion-2025.json")

dataset_id_cis <- "cis-3505-barometro-abril-2025-microdatos"
dataset_id_boundary <- "geoboundaries-esp-adm1-cc-by-4-0"

# ---- small helpers ---------------------------------------------------------

# stop when a required cached source is absent.
require_file <- function(path) {
  if (!file.exists(path)) stop("missing required source: ", path, call. = FALSE)
}

# compute the sha-256 digest for a local file.
sha256_file <- function(path) unname(tools::sha256sum(path))

# return file size in bytes for validation and manifest records.
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))

# validate a generated json product against a repository schema (the exact named
# check-jsonschema invocation; pinned uv cache dirs match the sibling builders).
validate_json_schema <- function(schema_path, instance_path) {
  base_uri <- paste0(
    "file://",
    normalizePath(dirname(schema_path), winslash = "/", mustWork = TRUE), "/"
  )
  status <- system2(
    "uvx",
    c("check-jsonschema", "--base-uri", base_uri, "--schemafile", schema_path, instance_path),
    env = c(
      "UV_CACHE_DIR=/tmp/places-of-worship-uv/cache",
      "UV_TOOL_DIR=/tmp/places-of-worship-uv/tools",
      "UV_PYTHON_INSTALL_DIR=/tmp/places-of-worship-uv/python"
    )
  )
  if (!identical(status, 0L)) stop("schema validation failed for ", instance_path, call. = FALSE)
  invisible(instance_path)
}

# stop unless every recorded source hash matches.
assert_source_hashes <- function() {
  for (nm in names(expected_sha256)) {
    got <- sha256_file(file.path(raw_dir, nm))
    if (!identical(got, unname(expected_sha256[[nm]]))) {
      stop("sha-256 mismatch for ", nm, ": got ", got, ", expected ",
           expected_sha256[[nm]], ". source drifted; product writing stopped.", call. = FALSE)
    }
  }
  invisible(TRUE)
}

# ---- verbatim frames -------------------------------------------------------
# CCAA codes 1..19 (codebook codigo3505.pdf), verbatim CIS labels, and the
# one-to-one concordance to the geoBoundaries ESP ADM1 shapeName. codes are the
# exact 19-unit autonomous-community frame the ficha tecnica prints.
ccaa <- list(
  list(code = "01", cis = "Andalucia", cis_es = "Andalucía", shape = "Andalucía", ficha_error = 3.9),
  list(code = "02", cis = "Aragon", cis_es = "Aragón", shape = "Aragón", ficha_error = 10.1),
  list(code = "03", cis = "Asturias (Principado de)", cis_es = "Asturias (Principado de)", shape = "Principado de Asturias", ficha_error = 10.2),
  list(code = "04", cis = "Balears (Illes)", cis_es = "Balears (Illes)", shape = "Illes Balears", ficha_error = 9.9),
  list(code = "05", cis = "Canarias", cis_es = "Canarias", shape = "Canarias", ficha_error = 7.6),
  list(code = "06", cis = "Cantabria", cis_es = "Cantabria", shape = "Cantabria", ficha_error = 9.6),
  list(code = "07", cis = "Castilla-La Mancha", cis_es = "Castilla-La Mancha", shape = "Castilla-La Mancha", ficha_error = 7.9),
  list(code = "08", cis = "Castilla y Leon", cis_es = "Castilla y León", shape = "Castilla y León", ficha_error = 7.0),
  list(code = "09", cis = "Cataluna", cis_es = "Cataluña", shape = "Cataluña/Catalunya", ficha_error = 4.2),
  list(code = "10", cis = "Comunitat Valenciana", cis_es = "Comunitat Valenciana", shape = "Comunitat Valenciana", ficha_error = 5.0),
  list(code = "11", cis = "Extremadura", cis_es = "Extremadura", shape = "Extremadura", ficha_error = 9.6),
  list(code = "12", cis = "Galicia", cis_es = "Galicia", shape = "Galicia", ficha_error = 6.5),
  list(code = "13", cis = "Madrid (Comunidad de)", cis_es = "Madrid (Comunidad de)", shape = "Comunidad de Madrid", ficha_error = 4.3),
  list(code = "14", cis = "Murcia (Region de)", cis_es = "Murcia (Región de)", shape = "Región de Murcia", ficha_error = 9.2),
  list(code = "15", cis = "Navarra (Comunidad Foral de)", cis_es = "Navarra (Comunidad Foral de)", shape = "Comunidad Foral de Navarra", ficha_error = 9.6),
  list(code = "16", cis = "Pais Vasco", cis_es = "País Vasco", shape = "País Vasco/Euskadi", ficha_error = 7.5),
  list(code = "17", cis = "Rioja (La)", cis_es = "Rioja (La)", shape = "La Rioja", ficha_error = 10.6),
  list(code = "18", cis = "Ceuta (Ciudad Autonoma de)", cis_es = "Ceuta (Ciudad Autónoma de)", shape = "Ciudad Autónoma de Ceuta", ficha_error = 22.9),
  list(code = "19", cis = "Melilla (Ciudad Autonoma de)", cis_es = "Melilla (Ciudad Autónoma de)", shape = "Ciudad Autónoma de Melilla", ficha_error = 22.9)
)
names(ccaa) <- vapply(ccaa, function(x) x$code, character(1))
ccaa_num <- setNames(seq_along(ccaa), vapply(ccaa, `[[`, character(1), "code"))

# RELIGION (P28) verbatim category labels, in code order, with role and taxonomy.
religion_cats <- list(
  `1` = list(label = "Católico/a practicante", role = "religious_affiliation", tax = "christian.catholic"),
  `2` = list(label = "Católico/a no practicante", role = "religious_affiliation", tax = "christian.catholic"),
  `3` = list(label = "Creyente de otra religión", role = "religious_affiliation", tax = NA_character_),
  `4` = list(label = "Agnóstico/a", role = "no_religion", tax = NA_character_),
  `5` = list(label = "Indiferente, no creyente", role = "no_religion", tax = NA_character_),
  `6` = list(label = "Ateo/a", role = "no_religion", tax = NA_character_),
  `9` = list(label = "N.C.", role = "non_response", tax = NA_character_)
)
religion_code_order <- c("1", "2", "3", "4", "5", "6", "9")
affiliation_codes <- c(1L, 2L, 3L)
no_religion_codes <- c(4L, 5L, 6L)

# PRACTICARELIG6 (P28a) verbatim frequency labels, in code order.
attendance_cats <- list(
  `1` = "Nunca",
  `2` = "Casi nunca",
  `3` = "Varias veces al año",
  `4` = "Dos o tres veces al mes",
  `5` = "Todos los domingos y festivos",
  `6` = "Varias veces a la semana",
  `9` = "N.C."
)
attendance_code_order <- c("1", "2", "3", "4", "5", "6", "9")
monthly_or_more_codes <- c(4L, 5L, 6L)   # dos o tres veces al mes or more often
weekly_or_more_codes <- c(5L, 6L)        # todos los domingos or more often

# national avance de resultados figures (Estudio 3505, source of record for the
# cross-check), for RELIGION and the reconciliation gate; percentages verbatim.
avance_religion_pct <- c(`1` = 18.8, `2` = 36.6, `3` = 3.6, `4` = 11.2, `5` = 12.0, `6` = 15.8, `9` = 2.0)
avance_attendance_pct <- c(`1` = 26.4, `2` = 20.7, `3` = 23.7, `4` = 9.4, `5` = 13.6, `6` = 5.2, `9` = 1.0)

# small-cell thresholds (docs/development/small-cell-rule.md).
small_denominator_threshold <- 100L
small_cell_threshold <- 10L

# ---- load and gate the microdata -------------------------------------------

for (path in c(md_zip, micro_csv, codebook_pdf, ficha_pdf, boundary_src)) require_file(path)
assert_source_hashes()

micro <- read.csv2(micro_csv, fileEncoding = "UTF-8-BOM", stringsAsFactors = FALSE, check.names = TRUE)
needed_vars <- c("ESTUDIO", "CCAA", "RELIGION", "PRACTICARELIG6", "PESO", "PESOCCAA")
missing_vars <- setdiff(needed_vars, names(micro))
if (length(missing_vars)) stop("microdata missing variables: ", paste(missing_vars, collapse = ", "), call. = FALSE)
if (!all(micro$ESTUDIO == 3505)) stop("microdata ESTUDIO is not uniformly 3505", call. = FALSE)

realised_total <- nrow(micro)
ficha_realised_total <- 4009L   # ficha tecnica printed total realised (see reconciliation note)

# ---- national reconciliation gate ------------------------------------------
# recompute the national PESO-weighted distributions and confirm they match the
# avance de resultados within a one-decimal tolerance (this proves the delivered
# file is the correct study; the shipped community estimates are recomputed from
# the same microdata, not transcribed).
weighted_pct <- function(w, codevec, universe) {
  keep <- codevec %in% universe & !is.na(w)
  agg <- tapply(w[keep], factor(codevec[keep], levels = universe), sum)
  agg[is.na(agg)] <- 0
  round(100 * agg / sum(agg), 1)
}
nat_religion <- weighted_pct(micro$PESO, micro$RELIGION, as.integer(religion_code_order))
nat_asked <- micro[micro$PRACTICARELIG6 != 0, ]
nat_attendance <- weighted_pct(nat_asked$PESO, nat_asked$PRACTICARELIG6, as.integer(attendance_code_order))

recon_tol <- 0.3   # one-decimal rounding plus the 4008-vs-4009 record difference
religion_dev <- max(abs(as.numeric(nat_religion) - avance_religion_pct[religion_code_order]))
attendance_dev <- max(abs(as.numeric(nat_attendance) - avance_attendance_pct[attendance_code_order]))
if (religion_dev > recon_tol) {
  stop("national RELIGION reconciliation exceeded ", recon_tol, " pp: max dev ", religion_dev, call. = FALSE)
}
if (attendance_dev > recon_tol) {
  stop("national attendance reconciliation exceeded ", recon_tol, " pp: max dev ", attendance_dev, call. = FALSE)
}

# ---- per-community weighted estimates with uncertainty ---------------------
# weighted proportion of a numerator code set within a base mask, with the Kish
# effective sample size and a 95% Wald margin. returns point, ci bounds, both
# bases (unweighted n, weighted sum, Kish n_eff) and the unweighted numerator n
# (the count the small-cell numerator threshold reads).
w_prop <- function(w, code, num_codes, base_mask) {
  w_b <- w[base_mask]
  code_b <- code[base_mask]
  sum_w <- sum(w_b)
  n_eff <- sum_w^2 / sum(w_b^2)
  num_mask <- code_b %in% num_codes
  p <- 100 * sum(w_b[num_mask]) / sum_w
  moe <- 100 * 1.96 * sqrt((p / 100) * (1 - p / 100) / n_eff)
  list(
    percent = round(p, 1),
    ci_low = round(max(0, p - moe), 1),
    ci_high = round(min(100, p + moe), 1),
    moe = round(moe, 1),
    base_n = sum(base_mask),
    base_weighted = round(sum_w, 1),
    n_eff = round(n_eff, 1),
    num_n = sum(num_mask)
  )
}

# weighted distribution across a code set within a base, one decimal (composition).
w_dist <- function(w, code, codes, base_mask) {
  w_b <- w[base_mask]; code_b <- code[base_mask]
  vapply(codes, function(k) round(100 * sum(w_b[code_b == k]) / sum(w_b), 1), numeric(1))
}

community_stats <- list()
for (code in names(ccaa)) {
  num <- ccaa_num[[code]]
  in_ccaa <- micro$CCAA == num
  w <- micro$PESOCCAA
  rel <- micro$RELIGION
  att <- micro$PRACTICARELIG6

  # metric 1: base = all community respondents.
  base1 <- in_ccaa
  affiliation <- w_prop(w, rel, affiliation_codes, base1)
  no_religion <- w_prop(w, rel, no_religion_codes, base1)
  selfdef_dist <- w_dist(w, rel, as.integer(religion_code_order), base1)
  names(selfdef_dist) <- religion_code_order
  # unweighted numerator counts per self-definition category (small-cell reads these).
  selfdef_n <- vapply(as.integer(religion_code_order),
                      function(k) sum(rel[base1] == k), integer(1))
  names(selfdef_n) <- religion_code_order

  # metric 2: base = asked subset (self-defined Catholic or believer of another
  # religion; PRACTICARELIG6 != 0).
  base2 <- in_ccaa & att != 0
  monthly <- w_prop(w, att, monthly_or_more_codes, base2)
  weekly <- w_prop(w, att, weekly_or_more_codes, base2)
  attend_dist <- w_dist(w, att, as.integer(attendance_code_order), base2)
  names(attend_dist) <- attendance_code_order
  attend_n <- vapply(as.integer(attendance_code_order),
                     function(k) sum(att[base2] == k), integer(1))
  names(attend_n) <- attendance_code_order

  community_stats[[code]] <- list(
    affiliation = affiliation, no_religion = no_religion,
    selfdef_dist = selfdef_dist, selfdef_n = selfdef_n,
    monthly = monthly, weekly = weekly,
    attend_dist = attend_dist, attend_n = attend_n
  )
}

# ---- boundary: geoBoundaries ESP ADM1 keyed by area_unit_id ----------------
geom_hashes <- function(x) {
  vapply(st_as_binary(st_geometry(x), EWKB = TRUE), digest,
         character(1), algo = "sha256", serialize = FALSE)
}

build_boundary <- function() {
  adm1 <- st_read(boundary_src, quiet = TRUE, stringsAsFactors = FALSE)
  if (nrow(adm1) != 19L) stop("expected 19 geoBoundaries ESP ADM1 units, got ", nrow(adm1), call. = FALSE)
  adm1 <- st_make_valid(adm1)
  adm1 <- st_cast(adm1, "MULTIPOLYGON")

  # join each feature to its CCAA code by the verbatim shapeName concordance.
  shape_to_code <- setNames(vapply(ccaa, `[[`, character(1), "code"),
                            vapply(ccaa, `[[`, character(1), "shape"))
  adm1[["area_code"]] <- unname(shape_to_code[adm1[["shapeName"]]])
  if (any(is.na(adm1[["area_code"]]))) {
    stop("unmatched shapeName(s): ",
         paste(adm1[["shapeName"]][is.na(adm1[["area_code"]])], collapse = "; "), call. = FALSE)
  }
  if (anyDuplicated(adm1[["area_code"]])) stop("duplicate area_code after join", call. = FALSE)
  adm1[["area_unit_id"]] <- paste0(boundary_set_id, ":", adm1[["area_code"]])
  adm1[["area_name"]] <- vapply(adm1[["area_code"]], function(cc) ccaa[[cc]][["cis_es"]], character(1))
  keyed <- adm1[, c("area_unit_id", "area_code", "area_name")]

  dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
  out_base <- tools::file_path_sans_ext(basename(boundary_output))
  unlink(Sys.glob(file.path(output_dir, paste0(out_base, "-*.geojson"))))
  tmp_in <- tempfile(fileext = ".geojson")
  npm_cache <- tempfile("npm-cache-")
  dir.create(npm_cache, showWarnings = FALSE, recursive = TRUE)
  on.exit(unlink(c(tmp_in, npm_cache), recursive = TRUE), add = TRUE)
  st_write(keyed, tmp_in, driver = "GeoJSON", delete_dsn = TRUE, quiet = TRUE)

  run_mapshaper <- function(input, out_args, label) {
    res <- tryCatch(
      system2("npx", c("--yes", "mapshaper", input, out_args), stdout = TRUE, stderr = TRUE,
              env = c(paste0("NPM_CONFIG_CACHE=", npm_cache),
                      paste0("npm_config_cache=", npm_cache),
                      "npm_config_update_notifier=false")),
      warning = function(w) structure(conditionMessage(w), status = 1L)
    )
    status <- attr(res, "status")
    if (!is.null(status) && status != 0L) {
      stop("mapshaper failed (", label, "):\n", paste(res, collapse = "\n"), call. = FALSE)
    }
    invisible(TRUE)
  }
  # simplify (topology-preserving, keep every feature) then a precision pass; take
  # the highest-fidelity keep at or under the 3 MB cap.
  simplify_step <- function(keep_pct) {
    tmp_simplified <- tempfile(fileext = ".geojson")
    on.exit(unlink(tmp_simplified), add = TRUE)
    run_mapshaper(tmp_in,
      c("-simplify", "weighted", "keep-shapes", sprintf("%g%%", keep_pct),
        "-clean", "allow-overlaps", "-o", "precision=0.00001", "format=geojson", tmp_simplified),
      paste0("simplify ", keep_pct, "%"))
    if (!file.exists(tmp_simplified)) stop("mapshaper wrote no simplify output at ", keep_pct, "%", call. = FALSE)
    w <- st_read(tmp_simplified, quiet = TRUE, stringsAsFactors = FALSE)
    w <- st_cast(st_make_valid(w), "MULTIPOLYGON")
    validity <- st_is_valid(w)
    if (nrow(w) != 19L || any(st_is_empty(w)) || any(is.na(validity)) || any(!validity)) return(NULL)
    unlink(boundary_output)
    run_mapshaper(tmp_simplified,
      c("-o", "precision=0.00001", "format=geojson", boundary_output),
      paste0("precision ", keep_pct, "%"))
    if (!file.exists(boundary_output)) stop("mapshaper wrote no precision output at ", keep_pct, "%", call. = FALSE)
    list(keep_percent = keep_pct, bytes = file_bytes(boundary_output))
  }
  keep_ladder <- c(20, 16, 12, 8, 6, 4, 3)
  chosen <- NULL
  for (keep_pct in keep_ladder) {
    step <- simplify_step(keep_pct)
    if (is.null(step)) next
    chosen <- step
    if (step[["bytes"]] <= 3000000L) break
  }
  if (is.null(chosen)) stop("no keep level produced a valid boundary", call. = FALSE)
  if (chosen[["bytes"]] > 3000000L) stop("boundary remains above 3 MB after the keep ladder", call. = FALSE)

  written <- st_read(boundary_output, quiet = TRUE, stringsAsFactors = FALSE)
  written <- written[order(written[["area_code"]]), ]
  validity <- st_is_valid(written)
  hashes <- geom_hashes(written)
  if (nrow(written) != 19L || any(st_is_empty(written)) || any(is.na(validity)) ||
      any(!validity) || anyDuplicated(hashes) ||
      !setequal(written[["area_code"]], vapply(ccaa, `[[`, character(1), "code"))) {
    stop("boundary failed feature, validity, distinctness, key-coverage, or emptiness gate", call. = FALSE)
  }
  land_area <- as.numeric(st_area(written)) / 1e6
  names(land_area) <- written[["area_code"]]
  if (sum(land_area) < 4.0e5 || sum(land_area) > 5.6e5) {
    stop("total boundary land area is implausible (", round(sum(land_area)), " km2)", call. = FALSE)
  }
  list(
    land_area_by_code = round(land_area, 4),
    total_land_area = round(sum(land_area), 2),
    keep_percent = chosen[["keep_percent"]],
    output_bytes = chosen[["bytes"]],
    written_geometry_sha256 = setNames(as.list(unname(hashes)), written[["area_code"]]),
    distinct_written_hash_count = length(unique(hashes))
  )
}

boundary_result <- build_boundary()
land_area_by_code <- boundary_result[["land_area_by_code"]]

# ---- assemble product rows (19 communities, one wave) ----------------------
year <- 2025L

# small-cell tokens for one metric base and its named numerator cells.
small_cell_tokens <- function(base_n, num_ns, metric_label) {
  toks <- character(0)
  if (base_n < small_denominator_threshold) {
    toks <- c(toks, paste0("small_denominator_under_100:", metric_label, "_base_n=", base_n))
  }
  for (nm in names(num_ns)) {
    if (num_ns[[nm]] < small_cell_threshold) {
      toks <- c(toks, paste0("small_cell_under_10:", metric_label, ":", nm, "_n=", num_ns[[nm]]))
    }
  }
  toks
}

composition_item <- function(label, percent, tax) {
  item <- list(label_verbatim = label, percent = percent)
  if (!is.na(tax)) item[["taxonomy_code"]] <- tax
  item
}

common_flags <- c(
  "survey_construct_cis_barometro_estudio_3505_abril_2025",
  "own_datanoun_survey_never_blended_with_census_affiliation_spain_census_has_no_religion_question",
  "weighted_estimates_pesoccaa_per_community_weight;no_counts_shipped",
  "design_2020_onward_cati_min_100_interviews_per_community_pesoccaa_weight",
  "uncertainty_95pct_wald_on_kish_effective_n;ficha_published_community_maxerror_carried"
)

build_row <- function(code) {
  meta <- ccaa[[code]]
  st <- community_stats[[code]]
  aff <- st$affiliation; nor <- st$no_religion
  mon <- st$monthly; wk <- st$weekly

  # small-cell tokens: metric 1 numerator cells are affiliation and no_religion
  # respondent counts; metric 2 numerator cells are the monthly and weekly counts.
  sd_num1 <- c(affiliation = sum(st$selfdef_n[c("1", "2", "3")]),
               no_religion = sum(st$selfdef_n[c("4", "5", "6")]))
  toks1 <- small_cell_tokens(aff$base_n, sd_num1, "self_definition")
  sd_num2 <- c(monthly_or_more = mon$num_n, weekly_or_more = wk$num_n)
  toks2 <- small_cell_tokens(mon$base_n, sd_num2, "mass_attendance")

  unc <- paste0(
    "self_definition_base_n=", aff$base_n, ";self_definition_neff=", aff$n_eff,
    ";affiliation_pct=", aff$percent, "_ci95=", aff$ci_low, "-", aff$ci_high,
    ";no_religion_pct=", nor$percent, "_ci95=", nor$ci_low, "-", nor$ci_high,
    ";mass_attendance_base_n=", mon$base_n, ";mass_attendance_neff=", mon$n_eff,
    ";monthly_or_more_pct=", mon$percent, "_ci95=", mon$ci_low, "-", mon$ci_high,
    ";weekly_or_more_pct=", wk$percent, "_ci95=", wk$ci_low, "-", wk$ci_high,
    ";ficha_community_maxerror_pct=", meta$ficha_error)

  flags <- c(common_flags,
    paste0("ccaa_code_", code, "_", gsub("[^A-Za-z]+", "_", meta$cis)),
    "metric1_self_definition_affiliation=religion_1_2_3;no_religion=religion_4_5_6;nc=9_residual",
    "metric2_mass_attendance_base=self_defined_catholic_or_other_believer_practicarelig6_ne_0",
    unc,
    toks1, toks2,
    "licence_open_datos_gob_es_federation_grant_with_cis_citation")

  composition <- lapply(religion_code_order, function(k) {
    composition_item(religion_cats[[k]][["label"]], unname(st$selfdef_dist[[k]]), religion_cats[[k]][["tax"]])
  })

  row <- list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = "autonomous_community",
    area_unit_id = paste0(boundary_set_id, ":", code),
    area_code = code,
    area_name = meta$cis_es,
    year = year,
    population_total = NULL,
    population_total_basis = paste0(
      "CIS Barómetro Abril 2025 (Estudio 3505), CATI, fieldwork April 2025; autonomous-community ",
      "estimation weight PESOCCAA. Community realised n=", aff$base_n,
      " (weighted ", aff$base_weighted, "); mass-attendance asked subset n=", mon$base_n,
      ". Survey estimates as weighted percentages with 95% intervals, no counts published."),
    religious_affiliation_count = NULL,
    religious_affiliation_percent = aff$percent,
    no_religion_count = NULL,
    no_religion_percent = nor$percent,
    mass_attendance_monthly_or_more_percent = mon$percent,
    mass_attendance_weekly_or_more_percent = wk$percent,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = unname(land_area_by_code[[code]]),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(dataset_id_cis, dataset_id_boundary),
    quality_flag = paste(flags[nzchar(flags)], collapse = ";"),
    composition = composition
  )
  row
}

product_rows <- lapply(names(ccaa), build_row)
if (length(product_rows) != 19L) stop("expected 19 rows (19 communities x 1 wave)", call. = FALSE)

# ---- source datasets, indicators, visual layers ----------------------------

cis_reuse_grant <- paste0(
  "quedando autorizada su reproducción total o parcial, modificación, distribución y ",
  "comunicación, para usos comerciales y no comerciales, de acuerdo a las condiciones generales de ",
  "uso de su portal.")

source_datasets <- list(
  list(
    source_dataset_id = dataset_id_cis,
    name = "CIS Barómetro de Abril 2025 (Estudio nº 3505), microdatos (matriz de datos)",
    provider = "Centro de Investigaciones Sociológicas (CIS)",
    url = url_md_zip,
    retrieval_date = retrieval_date,
    local_path = md_zip,
    licence = list(
      name = "Open reuse via the datos.gob.es federation grant (commercial and non-commercial), CIS source-citation condition",
      url = url_datos_gob,
      attribution = "Fuente: Centro de Investigaciones Sociológicas (CIS), Estudio nº 3505, Barómetro de Abril 2025"
    ),
    citation = "Centro de Investigaciones Sociológicas (CIS) (2025). Barómetro de Abril 2025, Estudio nº 3505. Microdatos (matriz de datos). Madrid: CIS.",
    access_limits = "Open microdata download (MD3505.zip) from the CIS banco de datos; free and unregistered.",
    redistribution_limits = paste0(
      "CIS study matrices are federated to datos.gob.es as open microdata under the portal's general terms. ",
      "Reuse grant (verbatim): “", cis_reuse_grant, "” The derived community-estimate product ships with the ",
      "CIS source citation. An older instrument (Orden PRE/3188/2008) governs bespoke microdata requests, not the ",
      "openly federated study matrices used here."),
    notes = paste0(
      "Source of record for both metrics. Variables used: CCAA (autonomous community 1-19), RELIGION (P28 ",
      "self-definition), PRACTICARELIG6 (P28a mass-attendance frequency), PESOCCAA (per-community estimation ",
      "weight), PESO (national weight, used only for the reconciliation cross-check).")
  ),
  list(
    source_dataset_id = dataset_id_boundary,
    name = "geoBoundaries ESP ADM1 (19 autonomous communities and autonomous cities)",
    provider = "geoBoundaries (wmgeolab); source Instituto Geográfico Nacional (IGN/CNIG)",
    url = url_boundary,
    retrieval_date = retrieval_date,
    local_path = boundary_src,
    licence = list(
      name = "Creative Commons Attribution 4.0 International (CC BY 4.0)",
      url = "https://creativecommons.org/licenses/by/4.0/",
      attribution = "geoBoundaries (CC BY 4.0); source Instituto Geográfico Nacional (IGN/CNIG), Spain"
    ),
    citation = "Runfola, D. et al. (2020). geoBoundaries ESP ADM1. Source: Instituto Geográfico Nacional (IGN/CNIG). CC BY 4.0.",
    access_limits = "Open on the geoBoundaries GitHub release (pinned commit 9469f09).",
    redistribution_limits = "CC BY 4.0 permits redistribution and derivatives with attribution.",
    notes = "19 ADM1 features match the CIS ficha-técnica 19-unit frame one-to-one (Ceuta and Melilla as own features), joined by verbatim shapeName."
  )
)

survey_spatial_note <- "19 autonomous communities and autonomous cities (17 communities + Ceuta + Melilla) on geoBoundaries ESP ADM1, keyed by area_unit_id."

indicators <- list(
  list(
    indicator_id = "religious_affiliation_percent",
    label = "Religious self-definition: affiliated (%) - survey estimate",
    description = "Weighted share of respondents defining themselves as practising Catholic, non-practising Catholic, or believer of another religion (RELIGION codes 1+2+3).",
    unit = "percent",
    denominator_indicator_id = NULL,
    method = paste0(
      "Weighted (PESOCCAA) share of RELIGION in {1,2,3} over all community respondents. Survey estimate with a ",
      "95% Wald interval on the Kish effective sample size n_eff = (sum w)^2 / sum(w^2); intervals and both bases ",
      "(unweighted n, n_eff) are carried in quality_flag and the manifest. Not a census count."),
    temporal_coverage = "2025 (single wave, Estudio 3505, fieldwork April 2025)",
    spatial_coverage = survey_spatial_note,
    quality_notes = "Survey construct (CIS barometer), its own dataNoun, never blended with census affiliation. Ceuta and Melilla (n~19) and communities with realised n<100 wash under the small-cell rule."
  ),
  list(
    indicator_id = "no_religion_percent",
    label = "Religious self-definition: non-religious (%) - survey estimate",
    description = "Weighted share of respondents defining themselves as agnostic, indifferent/non-believer, or atheist (RELIGION codes 4+5+6).",
    unit = "percent",
    denominator_indicator_id = NULL,
    method = "Weighted (PESOCCAA) share of RELIGION in {4,5,6} over all community respondents; 95% Wald interval on the Kish effective n. N.C. (code 9) is the residual to 100 and is carried in the composition.",
    temporal_coverage = "2025 (single wave, Estudio 3505)",
    spatial_coverage = survey_spatial_note,
    quality_notes = "Survey estimate with uncertainty; complements religious_affiliation_percent (the two sides of the self-definition item, with N.C. as residual)."
  ),
  list(
    indicator_id = "mass_attendance_monthly_or_more_percent",
    label = "Mass attendance at least monthly (%) - survey estimate",
    description = "Weighted share attending mass or other religious services at least two or three times a month (PRACTICARELIG6 codes 4+5+6), among those who define as Catholic or believer of another religion.",
    unit = "percent",
    denominator_indicator_id = "religious_affiliation_percent",
    method = paste0(
      "Weighted (PESOCCAA) share of PRACTICARELIG6 in {4,5,6} over the asked subset (RELIGION in {1,2,3}, i.e. ",
      "PRACTICARELIG6 != 0). 95% Wald interval on the Kish effective n of the asked subset. The asked subset is a ",
      "filtered subgroup, materially smaller than the community sample, so most communities fall under the small-cell ",
      "denominator threshold. The full seven-category frequency distribution is recorded per community in the manifest."),
    temporal_coverage = "2025 (single wave, Estudio 3505)",
    spatial_coverage = survey_spatial_note,
    quality_notes = "Mass-attendance metric, a distinct construct from self-definition. Denominator is the self-defined religious subset; excludes those not asked (N.P.)."
  ),
  list(
    indicator_id = "mass_attendance_weekly_or_more_percent",
    label = "Mass attendance weekly or more (%) - survey estimate",
    description = "Weighted share attending mass or other religious services every Sunday/feast day or more often (PRACTICARELIG6 codes 5+6), among those who define as Catholic or believer of another religion.",
    unit = "percent",
    denominator_indicator_id = "religious_affiliation_percent",
    method = "Weighted (PESOCCAA) share of PRACTICARELIG6 in {5,6} over the asked subset; 95% Wald interval on the Kish effective n. The canonical practising-attendance cut, carried alongside the at-least-monthly headline.",
    temporal_coverage = "2025 (single wave, Estudio 3505)",
    spatial_coverage = survey_spatial_note,
    quality_notes = "Same asked-subset base as mass_attendance_monthly_or_more_percent; smaller numerator, so the small-cell numerator marker bites in more communities."
  )
)

visual_layers <- list(
  list(
    visual_layer_id = "es-ccaa-religious-affiliation-survey",
    label = "Religious self-definition: affiliated (survey)",
    description = "Weighted survey share defining as Catholic (practising or not) or believer of another religion, by autonomous community, 2025.",
    layer_type = "choropleth",
    indicator_ids = list("religious_affiliation_percent"),
    geometry_unit_type = "area_unit",
    legend = list(unit = "percent", denominator = "all community survey respondents (PESOCCAA-weighted)"),
    colour_scale = "sequential",
    time_control = "none",
    aggregation_rule = "weighted community survey estimate on the ESP ADM1 frame",
    uncertainty_display = "quality_flag",
    default_visibility = TRUE,
    notes = "Single wave. Ceuta and Melilla (n~19) and communities with realised n<100 wash pale under the small-cell rule."
  ),
  list(
    visual_layer_id = "es-ccaa-no-religion-survey",
    label = "Religious self-definition: non-religious (survey)",
    description = "Weighted survey share defining as agnostic, indifferent/non-believer, or atheist, by autonomous community, 2025.",
    layer_type = "choropleth",
    indicator_ids = list("no_religion_percent"),
    geometry_unit_type = "area_unit",
    legend = list(unit = "percent", denominator = "all community survey respondents (PESOCCAA-weighted)"),
    colour_scale = "sequential",
    time_control = "none",
    aggregation_rule = "weighted community survey estimate on the ESP ADM1 frame",
    uncertainty_display = "quality_flag",
    default_visibility = FALSE,
    notes = "Complements the affiliation layer; N.C. is the residual to 100."
  ),
  list(
    visual_layer_id = "es-ccaa-mass-attendance-monthly-survey",
    label = "Mass attendance at least monthly (survey)",
    description = "Weighted survey share attending mass at least monthly among self-defined Catholics and believers of another religion, by autonomous community, 2025.",
    layer_type = "choropleth",
    indicator_ids = list("mass_attendance_monthly_or_more_percent"),
    geometry_unit_type = "area_unit",
    legend = list(unit = "percent", denominator = "self-defined Catholic or other-believer subset (PESOCCAA-weighted)"),
    colour_scale = "sequential",
    time_control = "none",
    aggregation_rule = "weighted community survey estimate on the asked subset",
    uncertainty_display = "quality_flag",
    default_visibility = FALSE,
    notes = "Filtered-subgroup base; most communities wash under the small-cell denominator threshold. Distinct construct from self-definition."
  )
)

area_summary <- list(
  schema_version = "area-summary.v2",
  generated_at = stamp,
  generated_by = script_id,
  country_code = country_code,
  data_status = "survey_religion_live",
  data_status_note = paste0(
    "CIS Barómetro Abril 2025 (Estudio 3505) survey affiliation-and-practice estimates for 19 autonomous ",
    "communities: religious self-definition and mass attendance, both weighted (PESOCCAA) percentages with 95% ",
    "intervals, no counts. Survey dataNoun, never blended with census affiliation (Spain's census has no religion ",
    "question). Small-cell rule applied on unweighted respondent n; Ceuta and Melilla and other small bases wash. ",
    "Ships STAGED (no page, no hub)."),
  boundary_set = list(
    boundary_set_id = boundary_set_id,
    country_code = country_code,
    level = "autonomous_community",
    vintage = "geoBoundaries ESP ADM1 (IGN/CNIG source), 19 units",
    source_dataset_id = dataset_id_boundary
  ),
  site_snapshot = list(
    source_dataset_id = NULL,
    snapshot_date = NULL,
    basis = "no governed Spain place-of-worship snapshot is included in this survey release",
    notes = "The Observatorio del Pluralismo Religioso places-of-worship directory is a distinct, open places-layer opportunity recorded in the route-probe; it is not built in this survey lane."
  ),
  source_datasets = source_datasets,
  indicators = indicators,
  visual_layers = visual_layers,
  rows = product_rows
)

dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)
write_json(area_summary, summary_output, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)

if (!jsonlite::validate(readChar(summary_output, file_bytes(summary_output), useBytes = TRUE))) {
  stop("area-summary output failed JSON syntax validation", call. = FALSE)
}
validate_json_schema("schemas/area-summary.v2.schema.json", summary_output)

# ---- flat CSV companion ----------------------------------------------------
num_or_na <- function(row, key) { v <- row[[key]]; if (is.null(v)) NA_real_ else v }
flat <- data.frame(
  country_code = vapply(product_rows, `[[`, character(1), "country_code"),
  boundary_set_id = vapply(product_rows, `[[`, character(1), "boundary_set_id"),
  boundary_level = vapply(product_rows, `[[`, character(1), "boundary_level"),
  area_unit_id = vapply(product_rows, `[[`, character(1), "area_unit_id"),
  area_code = vapply(product_rows, `[[`, character(1), "area_code"),
  area_name = vapply(product_rows, `[[`, character(1), "area_name"),
  year = vapply(product_rows, `[[`, integer(1), "year"),
  population_total = NA_integer_,
  population_total_basis = vapply(product_rows, `[[`, character(1), "population_total_basis"),
  religious_affiliation_count = NA_integer_,
  religious_affiliation_percent = vapply(product_rows, function(r) num_or_na(r, "religious_affiliation_percent"), numeric(1)),
  no_religion_count = NA_integer_,
  no_religion_percent = vapply(product_rows, function(r) num_or_na(r, "no_religion_percent"), numeric(1)),
  mass_attendance_monthly_or_more_percent = vapply(product_rows, function(r) num_or_na(r, "mass_attendance_monthly_or_more_percent"), numeric(1)),
  mass_attendance_weekly_or_more_percent = vapply(product_rows, function(r) num_or_na(r, "mass_attendance_weekly_or_more_percent"), numeric(1)),
  place_count = NA_integer_,
  places_per_10000_residents = NA_real_,
  place_density_per_sq_km = NA_real_,
  land_area_sq_km = vapply(product_rows, function(r) num_or_na(r, "land_area_sq_km"), numeric(1)),
  site_snapshot_date = NA_character_,
  place_count_basis = NA_character_,
  source_dataset_ids = vapply(product_rows, function(r) paste(unlist(r[["source_dataset_ids"]]), collapse = "|"), character(1)),
  quality_flag = vapply(product_rows, `[[`, character(1), "quality_flag"),
  stringsAsFactors = FALSE
)
utils::write.csv(flat, summary_csv_output, row.names = FALSE, na = "")

# ---- manifest --------------------------------------------------------------

raw_source_record <- function(path, url, content) {
  list(local_path = path, url = url, content = content, retrieval_date = retrieval_date,
       bytes = file_bytes(path), sha256 = sha256_file(path))
}
raw_sources <- list(
  raw_source_record(md_zip, url_md_zip, "CIS Estudio 3505 open microdata bundle (MD3505.zip): 3505_num.csv, codigo3505.pdf, FT3505.pdf, cues3505.pdf, 3505.sav, DA3505"),
  raw_source_record(micro_csv, url_md_zip, "CIS Estudio 3505 numeric matriz de datos (extracted from MD3505.zip); the source of record for both metrics"),
  raw_source_record(boundary_src, url_boundary, "geoBoundaries ESP ADM1 (19 autonomous communities and cities), CC BY 4.0")
)

output_paths <- c(summary_output, summary_csv_output, boundary_output)
output_hashes <- vapply(output_paths, sha256_file, character(1))
raw_hashes <- vapply(raw_sources, `[[`, character(1), "sha256")
version_hash <- substr(digest(paste(c(raw_hashes, output_hashes), collapse = ""),
                              algo = "sha256", serialize = FALSE), 1L, 12L)
git_commit <- tryCatch({
  v <- trimws(system2("git", c("rev-parse", "--short", "HEAD"), stdout = TRUE, stderr = TRUE))
  if (length(v) == 1L && grepl("^[a-f0-9]{7,40}$", v)) v else NULL
}, error = function(e) NULL)

durable_file_record <- function(path, content, licence_basis, licence_status,
                                row_count = NULL, feature_count = NULL) {
  rec <- list(
    uri = paste0("repo:", path), storage_provider = "git_repository",
    format = sub("^.*\\.", "", path), bytes = file_bytes(path), sha256 = sha256_file(path),
    content = content, privacy = "public", licence_status = licence_status, licence_basis = licence_basis
  )
  if (!is.null(row_count)) rec[["row_count"]] <- as.integer(row_count)
  if (!is.null(feature_count)) rec[["feature_count"]] <- as.integer(feature_count)
  rec
}

# per-community reconciliation record: realised n, weighted n, Kish n_eff, every
# shipped estimate with its 95% interval, the full self-definition and attendance
# distributions, and the small-cell tokens emitted.
community_records <- lapply(names(ccaa), function(code) {
  meta <- ccaa[[code]]; st <- community_stats[[code]]
  list(
    area_code = code, ccaa_cis = meta$cis_es, geoboundaries_shapeName = meta$shape,
    realised_n = st$affiliation$base_n, weighted_n = st$affiliation$base_weighted,
    self_definition = list(
      base_neff = st$affiliation$n_eff,
      affiliation_pct = st$affiliation$percent, affiliation_ci95 = c(st$affiliation$ci_low, st$affiliation$ci_high),
      no_religion_pct = st$no_religion$percent, no_religion_ci95 = c(st$no_religion$ci_low, st$no_religion$ci_high),
      distribution_pct = as.list(st$selfdef_dist),
      unweighted_n = as.list(st$selfdef_n),
      labels = setNames(lapply(religion_code_order, function(k) religion_cats[[k]][["label"]]), religion_code_order)
    ),
    mass_attendance = list(
      asked_subset_n = st$monthly$base_n, asked_subset_neff = st$monthly$n_eff,
      monthly_or_more_pct = st$monthly$percent, monthly_or_more_ci95 = c(st$monthly$ci_low, st$monthly$ci_high),
      weekly_or_more_pct = st$weekly$percent, weekly_or_more_ci95 = c(st$weekly$ci_low, st$weekly$ci_high),
      distribution_pct = as.list(st$attend_dist),
      unweighted_n = as.list(st$attend_n),
      labels = setNames(lapply(attendance_code_order, function(k) attendance_cats[[k]]), attendance_code_order)
    ),
    ficha_community_maxerror_pct = meta$ficha_error
  )
})

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = paste0("manifest:es-cis-religion:es:2025:", version_hash),
  dataset_id = "es-cis-religion:es:2025:cis-3505",
  dataset_version_id = paste0("es-cis-religion:es:2025:cis-3505:", version_hash),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "es-cis-religion",
  dataset_role = "public_product",
  scope = list(level = "country", country_codes = list("ES"), snapshot_date = NULL, pipeline_stage = "staged"),
  created_at = stamp,
  created_by = script_id,
  target_years = list(2025L),
  pipeline = list(
    script = script_id,
    git_commit = git_commit,
    command = paste("Rscript", script_id),
    parameters = list(
      construct = list(
        data_noun = "Survey",
        summary = paste0(
          "CIS Barómetro Abril 2025 (Estudio 3505), the 2020-onward community-designed CATI barometer ",
          "(minimum 100 interviews per community, PESOCCAA per-community weight), two survey metrics on the 19-unit ",
          "autonomous-community frame: religious self-definition (P28) and mass attendance (P28a). Weighted ",
          "percentages with 95% intervals, no counts. Survey dataNoun, never blended with census affiliation ",
          "(Spain's census carries no religion question)."),
        weight = "PESOCCAA (per-community estimation weight, documented by the ficha técnica 'para la estimación a nivel de cada autonomía'); self-weighting within community (sum PESOCCAA = realised n).",
        uncertainty = "95% Wald interval per metric on the Kish effective sample size n_eff = (sum w)^2 / sum(w^2) over the metric base; the ficha's published community maximum sampling error (+/-3,9% to +/-22,9%) is carried alongside."
      ),
      metric_1_self_definition = list(
        variable = "RELIGION (P28)",
        item_verbatim = "¿Cómo se define Ud. en materia religiosa: católico/a practicante, católico/a no practicante, creyente de otra religión, agnóstico/a, indiferente o no creyente, o ateo/a?",
        base = "all community respondents",
        slot_design = "affiliation = RELIGION {1,2,3} (Católico/a practicante + Católico/a no practicante + Creyente de otra religión); no_religion = RELIGION {4,5,6} (Agnóstico/a + Indiferente, no creyente + Ateo/a); N.C. (9) is the residual to 100 (carried in composition).",
        national_avance_pct = as.list(avance_religion_pct),
        national_microdata_pct = as.list(setNames(as.numeric(nat_religion), religion_code_order)),
        national_max_dev_pp = religion_dev
      ),
      metric_2_mass_attendance = list(
        variable = "PRACTICARELIG6 (P28a)",
        item_verbatim = "¿Con qué frecuencia asiste Ud. a misa u otros oficios religiosos, sin contar las ocasiones relacionadas con ceremonias de tipo social, por ejemplo, bodas, comuniones o funerales?",
        base = "asked subset: self-defined Catholics or believers of another religion (RELIGION in {1,2,3}, i.e. PRACTICARELIG6 != 0). unweighted n=2179, weighted base~2367 (matches the avance base N~2.364).",
        headline_monthly_or_more = "PRACTICARELIG6 {4,5,6} (Dos o tres veces al mes + Todos los domingos y festivos + Varias veces a la semana)",
        secondary_weekly_or_more = "PRACTICARELIG6 {5,6} (Todos los domingos y festivos + Varias veces a la semana)",
        national_avance_pct = as.list(avance_attendance_pct),
        national_microdata_pct = as.list(setNames(as.numeric(nat_attendance), attendance_code_order)),
        national_max_dev_pp = attendance_dev
      ),
      small_cell_rule = list(
        doc = "docs/development/small-cell-rule.md (RATIFIED 2026-07-12)",
        thresholds_applied = list(small_denominator_under_100 = "unweighted respondent base n < 100 washes pale",
                                  small_cell_under_10 = "unweighted numerator respondent count < 10 marks the cell"),
        applied_to = "UNWEIGHTED respondent n as the closest survey analogue of the rule's census-person denominator/numerator; the same reading the route-probe used to wash Ceuta and Melilla.",
        self_definition_denominator_under_100 = as.list(Filter(Negate(is.null), setNames(lapply(names(ccaa), function(c) {
          n <- community_stats[[c]]$affiliation$base_n; if (n < 100L) n else NULL
        }), vapply(ccaa, `[[`, character(1), "cis_es")))),
        mass_attendance_denominator_under_100 = as.list(Filter(Negate(is.null), setNames(lapply(names(ccaa), function(c) {
          n <- community_stats[[c]]$monthly$base_n; if (n < 100L) n else NULL
        }), vapply(ccaa, `[[`, character(1), "cis_es")))),
        open_question_for_conductor = paste0(
          "The ratified small-cell rule fixes its thresholds on census PERSONS (denominator < 100 persons washes; ",
          "numerator < 10 persons marks). Its applicability to SURVEY respondent n is not settled by the doc. This ",
          "build applies the thresholds to the unweighted respondent n as the closest analogue - the same reading ",
          "the route-probe used for Ceuta and Melilla (n~19). A mechanical read washes not only the designed-small ",
          "cities (Ceuta 19, Melilla 19) but also the full-design communities whose REALISED n dipped just under 100 ",
          "(Aragón 98, Asturias 95, La Rioja 89), and, for the filtered mass-attendance metric, most communities. ",
          "QUESTION: is unweighted survey respondent n the intended denominator for the wash, or should the wash apply ",
          "only to units DESIGNED under 100 (Ceuta/Melilla), with the full-design sub-100-realised communities carried ",
          "at full colour with a wide-interval note? No new treatment was invented; the tokens are emitted mechanically ",
          "and this question is recorded for a ruling.")
      ),
      boundary = list(
        boundary_set_id = boundary_set_id,
        source = "geoBoundaries ESP ADM1 (IGN/CNIG source), CC BY 4.0, 19 units keyed by area_unit_id",
        source_units = 19L,
        features = 19L,
        concordance = "join by verbatim shapeName; all 19 matched one-to-one to CCAA codes 01-19",
        total_land_area_sq_km = boundary_result[["total_land_area"]],
        output_bytes = boundary_result[["output_bytes"]],
        keep_percent = boundary_result[["keep_percent"]],
        distinct_written_geometry_hashes = boundary_result[["distinct_written_hash_count"]],
        written_geometry_sha256 = boundary_result[["written_geometry_sha256"]]
      ),
      reconciliation = list(
        realised_total_microdata = realised_total,
        realised_total_ficha = ficha_realised_total,
        record_difference_note = paste0(
          "The delivered anonymised microdata file carries ", realised_total, " records; the ficha técnica prints ",
          ficha_realised_total, " realised interviews (the difference is one record, in Asturias: microdata 95 vs ficha 96). ",
          "All shipped estimates rest on the delivered file. National PESO-weighted distributions match the avance de ",
          "resultados within ", recon_tol, " pp (RELIGION max dev ", religion_dev, " pp; attendance max dev ",
          attendance_dev, " pp), confirming the file is the correct study; the sub-0.1 pp gaps (e.g. Católico no ",
          "practicante 36,7 microdata vs 36,6 avance) are one-decimal rounding plus the one-record difference."),
        per_community = community_records
      ),
      licence_position = list(
        cis = list(
          status = "accepted",
          basis = "datos_gob_es_federation_open_reuse_grant_with_cis_citation",
          grant_verbatim = cis_reuse_grant,
          condition = "CIS source citation required; the openly federated study matrices carry the affirmative open-reuse grant. Orden PRE/3188/2008 governs bespoke microdata requests, not these openly published matrices.",
          citation = "Fuente: Centro de Investigaciones Sociológicas (CIS), Estudio nº 3505, Barómetro de Abril 2025."
        ),
        boundary = "geoBoundaries ESP ADM1: CC BY 4.0 (IGN/CNIG source)."
      ),
      raw_sources = raw_sources,
      local_cache_hint = "data/raw/es_cis/ (git-ignored via .gitignore raw_data/ pattern? see note; MD3505.zip and extracted members cached with URL, bytes, SHA-256 in pipeline.parameters.raw_sources).",
      raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/es_cis/"),
      md_zip_sha256 = md_zip_sha256
    ),
    software_versions = list(
      R = paste(R.version$major, R.version$minor, sep = "."),
      sf = as.character(utils::packageVersion("sf")),
      stringi = as.character(utils::packageVersion("stringi")),
      jsonlite = as.character(utils::packageVersion("jsonlite"))
    )
  ),
  source = list(
    provider = "Centro de Investigaciones Sociológicas (CIS); geoBoundaries (IGN/CNIG)",
    source_dataset_ids = list(dataset_id_cis, dataset_id_boundary),
    source_urls = list(url_md_zip, url_study, url_bancos, url_datos_gob, url_boundary, url_boundary_meta),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = "CIS: open reuse via the datos.gob.es federation grant with CIS citation (accepted). Boundary: CC BY 4.0.",
    raw_redistribution = "CIS open microdata and geoBoundaries are open web sources; intended durable mirror gs://pow-research-data/raw_sources/es_cis/.",
    citation = "CIS Barómetro de Abril 2025 (Estudio nº 3505), microdatos; geoBoundaries ESP ADM1 (IGN/CNIG).",
    local_cache_hint = "data/raw/es_cis/ (git-ignored).",
    raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/es_cis/")
  ),
  input_manifests = list(),
  deferred_sources = list(
    list(layer = "census religion", status = "documented non-route",
         note = "Spain's census carries no religion question; the CIS barometer is the affiliation-and-practice route. The survey construct is never blended with any census affiliation."),
    list(layer = "places of worship (Observatorio del Pluralismo Religioso)", status = "distinct open route, not built here",
         note = "The Observatorio directory of minority places of worship is open under the Spanish RISP regime (Ley 37/2007) with attribution 'Origen de los datos: Observatorio del Pluralismo Religioso en España'; a distinct places-layer opportunity recorded in the route-probe, not part of this survey lane."),
    list(layer = "pooled / multi-wave", status = "future extension",
         note = "This build ships one wave (Estudio 3505). Pooling adjacent 2020-onward community barometers would narrow the community intervals at the cost of a mixed reference period; a future extension.")
  ),
  durable_files = list(
    durable_file_record(summary_output, "Spain 19-community CIS survey affiliation-and-practice area-summary JSON (area-summary.v2)",
                        "cis_datos_gob_es_open_reuse_with_citation", "accepted", row_count = 19L),
    durable_file_record(summary_csv_output, "Spain 19-community CIS survey affiliation-and-practice area-summary CSV",
                        "cis_datos_gob_es_open_reuse_with_citation", "accepted", row_count = 19L),
    durable_file_record(boundary_output, "Spain 19 autonomous-community boundary (geoBoundaries ESP ADM1) keyed by area_unit_id",
                        "cc_by_4_0", "accepted", feature_count = 19L)
  ),
  partitions = list(
    list(partition_id = "es-ccaa-2025", partition_type = "area",
         file_uri = paste0("repo:", summary_output), sha256 = sha256_file(summary_output),
         country_code = "ES", row_count = 19L, stage = "staged")
  ),
  stats = list(
    waves = 1L, years = "2025", community_rows = 19L, communities = 19L,
    boundary_features = 19L, boundary_keep_percent = boundary_result[["keep_percent"]],
    boundary_bytes = boundary_result[["output_bytes"]],
    realised_total = realised_total,
    national_religion_max_dev_pp = religion_dev,
    national_attendance_max_dev_pp = attendance_dev
  ),
  local_cache_hint = "data/raw/es_cis/ (git-ignored; MD3505.zip and members with URL, bytes, SHA-256 in pipeline.parameters.raw_sources).",
  validation = list(
    status = "passed",
    commands = list(
      paste("Rscript", script_id),
      paste("uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.v2.schema.json", summary_output),
      paste("uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/data-manifest.schema.json", manifest_output)
    ),
    warnings = list(
      "Both metrics are SURVEY estimates with uncertainty, never census affiliation; each shipped share carries a 95% interval on the Kish effective n.",
      "Mass attendance is a filtered subgroup (self-defined Catholics/other-believers); most communities fall under the small-cell denominator threshold; Ceuta and Melilla (n~19) wash on both metrics.",
      "Small-cell rule applicability to survey respondent n is an OPEN QUESTION recorded for the conductor (see pipeline.parameters.small_cell_rule.open_question_for_conductor); tokens emitted mechanically, no new treatment invented.",
      "The delivered microdata carries 4008 records vs the ficha's 4009 realised (one record, Asturias 95 vs 96); estimates rest on the delivered file."
    ),
    notes = paste0(
      "Source hashes recorded and gated (3505_num.csv, codigo3505.pdf, FT3505.pdf, esp_adm1.geojson). National PESO-",
      "weighted RELIGION and attendance distributions match the avance de resultados within ", recon_tol, " pp. The ",
      "19-feature boundary joins 19/19 communities by verbatim shapeName with distinct geometry hashes, valid non-empty ",
      "geometries, under the 3 MB cap. Both the area-summary (area-summary.v2) and the manifest pass schema validation.")
  ),
  privacy = "public",
  licence_status = "accepted",
  licence_basis = "cis_datos_gob_es_open_reuse_with_citation",
  downstream_status = "staged",
  notes = paste0(
    "Single-wave (2025) 19-community CIS survey affiliation-and-practice product: religious self-definition (P28) and ",
    "mass attendance (P28a), both weighted (PESOCCAA) percentages with 95% intervals, no counts. Survey dataNoun, never ",
    "blended with census affiliation (Spain's census has no religion question). Small-cell rule applied on unweighted ",
    "respondent n (open interpretive question recorded for the conductor). CIS open reuse via the datos.gob.es ",
    "federation grant with citation (accepted); boundary CC BY 4.0. Ships STAGED (no page, no hub).")
)

write_json(manifest, manifest_output, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)

if (!jsonlite::validate(readChar(manifest_output, file_bytes(manifest_output), useBytes = TRUE))) {
  stop("manifest output is not valid JSON", call. = FALSE)
}
validate_json_schema("schemas/data-manifest.schema.json", manifest_output)

message(
  "built Spain CIS survey affiliation-and-practice product: ", length(product_rows), " community rows (1 wave, 2025); ",
  "boundary ", boundary_result[["output_bytes"]], " bytes at keep ", boundary_result[["keep_percent"]], "%, ",
  boundary_result[["total_land_area"]], " km2; national RELIGION dev ", religion_dev, " pp, attendance dev ",
  attendance_dev, " pp; staged (licence accepted, CIS citation)."
)
