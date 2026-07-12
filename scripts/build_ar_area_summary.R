# build the Argentina survey-religion macro-region product from the CEIL-CONICET
# national surveys on religious beliefs and attitudes (Programa Sociedad, Cultura
# y Religión), two waves: Primera Encuesta 2008 and Segunda Encuesta 2019.
#
# inputs (all under git-ignored data/raw/ar_survey/):
#   - primera-encuesta-2008.pdf : 2008 report of record (bahia.gob.ar mirror),
#     region table "La religión de los Argentinos – según región".
#   - ii25-2encuestacreencias.pdf : 2019 Informe de Investigación nº 25, source of
#     record for the 2019 wave, chart "Adscripción religiosa según región" (p. 14).
#   - COD-AB ARG ADM2 (UNHCR 2017) shapefile for the custom macro-region dissolve.
# outputs:
#   - apps/regions/ar/data/area_summary_region.{json,csv} (area-summary.v2)
#   - apps/regions/ar/data/ar_macroregion_2008_2019.geojson (6 macro-region features)
#   - docs/manifests/ar-survey-religion-2008-2019.json (data-manifest.v2)
# run from the repo root: Rscript scripts/build_ar_area_summary.R
#
# product scope. six standard Argentine macro-regions (AMBA, Centro, NOA, NEA,
# Cuyo, Patagonia), two waves. this is a SURVEY construct with its own dataNoun
# ("Survey"); it is never blended with census affiliation (Argentina's national
# census dropped religion after 1960). one-decimal percentages only, no counts
# (GN/GW percentages-only precedent). per-region shares rest on subsamples of
# roughly 400 and carry a materially larger, unpublished margin than the national
# +/- 2% at 95%.
#
# slot design.
#   2008 (five printed categories partition the region column): affiliation =
#   Católica + Evangélica + Testigos de Jehová/Mormones + Otras; no_religion =
#   Indiferentes (the report defines Indiferentes verbatim as "Agnósticos, Ateos y
#   Ninguna Religión de Pertenencia"). the five-category column sums to 100 within
#   the derived one-decimal bound (0.05 pp x 5 = 0.25 pp).
#   2019: no_religion = printed Sin religión. the chart prints only values above 2%
#   ("Se consignan en el gráfico valores superiores al 2%"), so a full affiliation
#   sum is NOT printed per region. affiliation is therefore the sum of the PRINTED
#   affiliation categories only (Católica + Evangélica + any printed Testigos de
#   Jehová/Mormones minor) and is flagged as a DISCLOSED LOWER BOUND under the
#   Georgia-2002 lower-bound-affiliation precedent. no unprinted value is derived.
#
# cross-wave change. the 2008 and 2019 category frames differ (2008 Indiferentes
# vs 2019 Sin religión + No sabe, and the 2019 affiliation is a lower bound). every
# row carries a change_withheld_* flag so the runtime guard nulls the change metric
# across these non-identical constructs.
#
# licence. 2019 wave: CC BY-NC-SA 4.0 via the peer-reviewed article (Mallimaci,
# Esquivel & Giménez Béliveau 2020, Sociedad y Religión 30(55)); the non-commercial
# clause is a genuine condition and a project-lead / PI ruling is pending (new
# licence class for the corpus). 2008 wave: needs_review build-then-ask with
# CEIL-CONICET attribution (no located open licence for the 2008 report). boundary:
# COD-AB ARG ADM2 (UNHCR 2017; IGN source) is CC BY-IGO. the product ships STAGED
# (no page, no hub) pending the PI licence ruling.

suppressPackageStartupMessages({
  library(jsonlite)
  library(sf)
  library(stringi)
  library(digest)
})

country_code <- "AR"
script_id <- "scripts/build_ar_area_summary.R"
raw_dir <- "data/raw/ar_survey"
output_dir <- "apps/regions/ar/data"
manifest_dir <- "docs/manifests"

retrieval_date <- "2026-07-12"
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")

# ---- cached inputs, pinned URLs, and probe-recorded hashes -----------------

pdf_2008 <- file.path(raw_dir, "primera-encuesta-2008.pdf")
pdf_2019 <- file.path(raw_dir, "ii25-2encuestacreencias.pdf")
codab_zip <- file.path(raw_dir, "arg_adm_unhcr2017_shp.zip")
codab_adm2 <- file.path(raw_dir, "codab", "arg_admbnda_adm2_unhcr2017.shp")

url_2008 <- "https://www.bahia.gob.ar/wp-content/uploads/2021/12/Primera-Encuesta-Nacional-CEIL-CONICET-2008-Dres.-Fortunato-Mallimaci-Juan-Cruz-Esquivel-Lic.-Gabriela-Irraz%C3%A1bal.pdf"
url_2019 <- "https://www.ceil-conicet.gov.ar/wp-content/uploads/2019/11/ii25-2encuestacreencias.pdf"
url_article <- "https://www.redalyc.org/journal/3872/387266813004/"
url_codab <- "https://data.humdata.org/dataset/c661e398-66cf-4a9f-9607-4962c72d1ccf/resource/9f3b2c43-ad1c-406a-85dd-d387c5e3ffb3/download/arg_adm_unhcr2017_shp.zip"
url_codab_meta <- "https://data.humdata.org/api/3/action/package_show?id=cod-ab-arg"

# the probe recorded these sha-256 hashes; a mismatch means the source drifted and
# the build must STOP rather than ship an unverified percentage.
expected_sha256 <- c(
  "primera-encuesta-2008.pdf"   = "0c90dad2a860a0afad33ef5d1405f69de15184ecda66718c08ef3dc3195c35f1",
  "ii25-2encuestacreencias.pdf" = "722fcf81c14b9e119a7ba75c52e1d6f3dec76119603e7ed6b97168d8ef680f40"
)

boundary_set_id <- "ar-macroregion-codab-adm2-dissolve"
boundary_output <- file.path(output_dir, "ar_macroregion_2008_2019.geojson")
summary_output <- file.path(output_dir, "area_summary_region.json")
summary_csv_output <- file.path(output_dir, "area_summary_region.csv")
manifest_output <- file.path(manifest_dir, "ar-survey-religion-2008-2019.json")

dataset_id_2008 <- "ceil-conicet-2008-primera-encuesta-region-table"
dataset_id_2019 <- "ceil-conicet-2019-informe25-adscripcion-region"
dataset_id_article <- "mallimaci-esquivel-gimenez-beliveau-2020-sociedad-y-religion-30-55"
dataset_id_boundary <- "codab-arg-adm2-unhcr2017"

# ---- small helpers ---------------------------------------------------------

# stop when a required cached source is absent.
require_file <- function(path) {
  if (!file.exists(path)) stop("missing required source: ", path, call. = FALSE)
}

# compute the sha-256 digest for a local file.
sha256_file <- function(path) unname(tools::sha256sum(path))

# return file size in bytes for validation and manifest records.
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))

# run poppler's layout-preserving extractor and return its lines.
pdf_layout_lines <- function(path) {
  pdftotext <- Sys.which("pdftotext")
  if (!nzchar(pdftotext)) stop("pdftotext (Poppler) is required", call. = FALSE)
  out <- tempfile(fileext = ".txt")
  on.exit(unlink(out), add = TRUE)
  status <- system2(pdftotext, c("-layout", shQuote(path), shQuote(out)))
  if (status != 0L) stop("pdftotext failed on ", path, call. = FALSE)
  readLines(out, warn = FALSE, encoding = "UTF-8")
}

# collapse extracted lines to one string for presence assertions; no digit changes.
normalise_source_text <- function(lines) {
  text <- paste(lines, collapse = "\n")
  trimws(gsub("[[:space:]]+", " ", text))
}

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

# ---- transcribed source tables (verbatim) ----------------------------------
# region order used throughout: amba, centro, noa, nea, cuyo, patagonia.
region_order <- c("amba", "centro", "noa", "nea", "cuyo", "patagonia")

# 2008 region table "La religión de los Argentinos – según región" (Base: 2403
# casos; Fuente: Datos propios). the report labels the AMBA column "Capital y GBA"
# and the Patagonia column "Sur". five printed categories partition each column.
# values verbatim; decimal points as printed.
tab_2008 <- list(
  catolica     = c(amba = 69.1, centro = 79.2, noa = 91.7, nea = 84.0, cuyo = 82.6, patagonia = 61.5),
  indiferentes = c(amba = 18.0, centro =  9.4, noa =  1.8, nea =  3.2, cuyo =  5.3, patagonia = 11.7),
  evangelica   = c(amba =  9.1, centro =  8.3, noa =  3.7, nea = 11.8, cuyo = 10.0, patagonia = 21.6),
  testigos     = c(amba =  1.4, centro =  2.7, noa =  2.1, nea =  0.8, cuyo =  1.8, patagonia =  3.7),
  otras        = c(amba =  2.3, centro =  0.4, noa =  0.7, nea =  0.1, cuyo =  0.4, patagonia =  1.5)
)

# 2019 chart "Adscripción religiosa según región" (Informe nº 25, p. 14; Base:
# 2421 casos). only values above 2% are printed. the printed affiliation
# categories are Católica, Evangélica, and (Centro/Cuyo only) Testigos de
# Jehová/Mormones; Sin religión is the printed no-religion category. values
# verbatim; NA means "not printed" (below the 2% threshold), never zero.
tab_2019 <- list(
  catolica     = c(amba = 56.4, centro = 65.7, noa = 76.0, nea = 67.4, cuyo = 69.6, patagonia = 51.0),
  sin_religion = c(amba = 26.2, centro = 18.6, noa =  5.0, nea =  7.0, cuyo = 13.2, patagonia = 24.3),
  evangelica   = c(amba = 15.0, centro = 11.3, noa = 16.7, nea = 23.1, cuyo = 14.5, patagonia = 24.4),
  testigos     = c(amba = NA_real_, centro = 2.5, noa = NA_real_, nea = NA_real_, cuyo = 2.6, patagonia = NA_real_)
)

# national ("Total país") context, recorded in the manifest only (no boundary
# feature, so no product row). 2019 national is fully printed on the p.10 donut.
national_context <- list(
  y2008 = list(catolica = 76.5),
  y2019 = list(catolica = 62.9, sin_religion = 18.9, evangelica = 15.3,
               sin_religion_parts = list(ninguna = 9.7, ateo = 6.0, agnostico = 3.2),
               evangelica_parts = list(pentecostales = 13.0, otros_evangelicos = 2.3),
               testigos = 1.4, otras = 1.2, no_sabe = 0.3)
)

# verbatim category labels per wave, in printed order, with the taxonomy code
# where a single denomination is unambiguous. Testigos de Jehová/Mormones combines
# two denominations (Jehovah's Witnesses + Latter-day Saints), so it carries no
# single taxonomy code; Indiferentes, Sin religión, Otras and No sabe are not
# denominations and carry none.
labels_2008 <- list(
  catolica     = list(label = "Católica", tax = "christian.catholic"),
  indiferentes = list(label = "Indiferentes", tax = NA_character_),
  evangelica   = list(label = "Evangélica", tax = "christian.evangelical"),
  testigos     = list(label = "Testigos de Jehová / Mormones", tax = NA_character_),
  otras        = list(label = "Otras", tax = NA_character_)
)
labels_2019 <- list(
  catolica     = list(label = "Católica", tax = "christian.catholic"),
  sin_religion = list(label = "Sin religión", tax = NA_character_),
  evangelica   = list(label = "Evangélica", tax = "christian.evangelical"),
  testigos     = list(label = "Testigos de Jehová/Mormones", tax = NA_character_)
)

# verbatim definition strings recorded on the product / manifest.
indiferentes_definition <- "Indiferentes: Agnósticos, Ateos y Ninguna Religión de Pertenencia."
above_2pct_caption <- "Se consignan en el gráfico valores superiores al 2%"

# region display metadata.
region_meta <- list(
  amba      = list(name = "AMBA", label_2008 = "Capital y GBA",
                   long = "AMBA (CABA + 24 partidos del Gran Buenos Aires)"),
  centro    = list(name = "Centro", label_2008 = "Centro",
                   long = "Centro / Pampeana (rest of Buenos Aires province + Córdoba + Entre Ríos + La Pampa + Santa Fe)"),
  noa       = list(name = "NOA", label_2008 = "NOA",
                   long = "NOA / Noroeste (Catamarca, Jujuy, La Rioja, Salta, Santiago del Estero, Tucumán)"),
  nea       = list(name = "NEA", label_2008 = "NEA",
                   long = "NEA / Nordeste (Corrientes, Chaco, Formosa, Misiones)"),
  cuyo      = list(name = "Cuyo", label_2008 = "Cuyo",
                   long = "Cuyo (Mendoza, San Juan, San Luis)"),
  patagonia = list(name = "Patagonia", label_2008 = "Sur",
                   long = "Patagonia / Sur (Chubut, Neuquén, Río Negro, Santa Cruz, Tierra del Fuego)")
)

# ---- macro-region composition from COD-AB ADM2 -----------------------------
# the INDEC "24 partidos del Gran Buenos Aires" that, with CABA, compose AMBA.
# source: INDEC, ¿Qué es el Gran Buenos Aires? (2003) — CABA plus these 24
# partidos of Buenos Aires province.
amba_24_partidos <- c(
  "Almirante Brown", "Avellaneda", "Berazategui", "Esteban Echeverría", "Ezeiza",
  "Florencio Varela", "General San Martín", "Hurlingham", "Ituzaingó", "José C. Paz",
  "La Matanza", "Lanús", "Lomas de Zamora", "Malvinas Argentinas", "Merlo", "Moreno",
  "Morón", "Quilmes", "San Fernando", "San Isidro", "San Miguel", "Tigre",
  "Tres de Febrero", "Vicente López"
)

# province -> macro-region for the whole-province groupings (AMBA/Centro split of
# Buenos Aires is handled separately). province strings match COD-AB ADM1_ES
# verbatim (note "Río negro" and "Ciudad de Buenos Aires").
province_region <- c(
  "Córdoba" = "centro", "Entre Ríos" = "centro", "La Pampa" = "centro", "Santa Fe" = "centro",
  "Catamarca" = "noa", "Jujuy" = "noa", "La Rioja" = "noa", "Salta" = "noa",
  "Santiago del Estero" = "noa", "Tucumán" = "noa",
  "Corrientes" = "nea", "Chaco" = "nea", "Formosa" = "nea", "Misiones" = "nea",
  "Mendoza" = "cuyo", "San Juan" = "cuyo", "San Luis" = "cuyo",
  "Chubut" = "patagonia", "Neuquén" = "patagonia", "Río negro" = "patagonia",
  "Santa Cruz" = "patagonia", "Tierra del Fuego" = "patagonia"
)

# assign one macro-region to one ADM2 unit (province + department). CABA -> AMBA;
# Buenos Aires province is split (24 GBA partidos -> AMBA, the rest -> Centro);
# every other province groups whole.
assign_region <- function(prov, dept) {
  if (identical(prov, "Ciudad de Buenos Aires")) return("amba")
  if (identical(prov, "Buenos Aires")) return(if (dept %in% amba_24_partidos) "amba" else "centro")
  r <- province_region[[prov]]
  if (is.null(r)) return(NA_character_)
  r
}

# ---- gates -----------------------------------------------------------------

# stop unless every cached PDF hash matches the probe's recorded value.
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

# require an ordered run of one-decimal values to appear in the layout text with
# flexible whitespace. every shipped percentage is byte-matched to its source PDF.
assert_value_run <- function(source_text, values, label) {
  cells <- sprintf("%.1f", values)
  pattern <- paste(cells, collapse = "[[:space:]]+")
  if (!grepl(pattern, source_text, perl = TRUE)) {
    stop("value run not found in source text for ", label, ": ", pattern, call. = FALSE)
  }
  invisible(TRUE)
}

# 2008: assert each of the five printed category rows appears with its six ordered
# column values (Capital y GBA, Centro, NEA, NOA, Cuyo, Sur — the report's column
# order, distinct from region_order).
assert_2008_transcription <- function(source_text) {
  col2008 <- c("amba", "centro", "nea", "noa", "cuyo", "patagonia")
  for (cat in names(tab_2008)) assert_value_run(source_text, tab_2008[[cat]][col2008], paste0("2008 ", cat))
  if (!grepl("Agn.sticos, Ateos y Ninguna Religi.n de Pertenencia", source_text, perl = TRUE)) {
    stop("2008 Indiferentes definition not found in source text", call. = FALSE)
  }
  invisible(TRUE)
}

# 2019: assert the printed above-2% caption, each region's printed Católica / Sin
# religión / Evangélica triplet in chart order, and the two printed Testigos minors.
assert_2019_transcription <- function(source_text) {
  if (!grepl("Se consignan en el gr.fico valores superiores al 2%", source_text, perl = TRUE)) {
    stop("2019 above-2% caption not found in source text", call. = FALSE)
  }
  for (r in region_order) {
    trip <- c(tab_2019$catolica[[r]], tab_2019$sin_religion[[r]], tab_2019$evangelica[[r]])
    assert_value_run(source_text, trip, paste0("2019 ", r, " triplet"))
  }
  # printed Testigos minors appear next to their region label on the chart.
  if (!grepl("Centro[[:space:]]+2.5", source_text, perl = TRUE)) stop("2019 Centro 2.5 minor not found", call. = FALSE)
  if (!grepl("Cuyo[[:space:]]+2.6", source_text, perl = TRUE)) stop("2019 Cuyo 2.6 minor not found", call. = FALSE)
  invisible(TRUE)
}

# ---- boundary: custom dissolve from COD-AB ADM2 ----------------------------
# read the 526-unit COD-AB ADM2 layer, assign each unit a macro-region, dissolve
# to six features with a topology-preserving mapshaper simplify under a 3 MB cap,
# then validate feature count, validity, non-emptiness, and distinct geometry hashes.
geom_hashes <- function(x) {
  vapply(st_as_binary(st_geometry(x), EWKB = TRUE), digest,
         character(1), algo = "sha256", serialize = FALSE)
}

build_boundary <- function() {
  adm2 <- st_read(codab_adm2, quiet = TRUE, stringsAsFactors = FALSE)
  if (nrow(adm2) != 526L) stop("expected 526 COD-AB ARG ADM2 units, got ", nrow(adm2), call. = FALSE)
  adm2 <- st_make_valid(adm2)
  # cast to a single homogeneous MULTIPOLYGON type: without this the GDAL GeoJSON
  # writer emits a handful of features as GeometryCollection, which mapshaper then
  # splits into a stray line layer and a suffixed output filename.
  adm2 <- st_cast(adm2, "MULTIPOLYGON")

  adm2[["region"]] <- mapply(assign_region, adm2[["ADM1_ES"]], adm2[["ADM2_ES"]])
  if (any(is.na(adm2[["region"]]))) {
    stop("unassigned ADM2 units: ", sum(is.na(adm2[["region"]])), call. = FALSE)
  }
  # record the exact partido membership for the manifest (documents the BA split).
  ba <- adm2[adm2[["ADM1_ES"]] %in% c("Buenos Aires", "Ciudad de Buenos Aires"), ]
  amba_members <- ba[["ADM2_PCODE"]][ba[["region"]] == "amba"]
  matched_partidos <- sort(intersect(amba_24_partidos, adm2[["ADM2_ES"]][adm2[["ADM1_ES"]] == "Buenos Aires"]))
  if (length(matched_partidos) != 24L) {
    stop("expected all 24 GBA partidos in Buenos Aires province, matched ",
         length(matched_partidos), call. = FALSE)
  }
  region_unit_counts <- table(adm2[["region"]])

  dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
  # defensively clear any stale suffixed split outputs from an interrupted run so a
  # rebuild can never ship a leftover artefact alongside the single shipped file.
  out_base <- tools::file_path_sans_ext(basename(boundary_output))
  unlink(Sys.glob(file.path(output_dir, paste0(out_base, "-*.geojson"))))
  regioned <- adm2[, "region"]
  tmp_in <- tempfile(fileext = ".geojson")
  npm_cache <- tempfile("npm-cache-")
  dir.create(npm_cache, showWarnings = FALSE, recursive = TRUE)
  on.exit(unlink(c(tmp_in, npm_cache), recursive = TRUE), add = TRUE)
  # no COORDINATE_PRECISION here: that option pushes the GDAL writer to emit some
  # features as GeometryCollection. mapshaper applies its own output precision below.
  st_write(regioned, tmp_in, driver = "GeoJSON", delete_dsn = TRUE, quiet = TRUE)

  # one keep step: mapshaper dissolves and simplifies (topology-preserving) to a
  # temp file, sf repairs the one self-intersection mapshaper leaves and casts to a
  # single MULTIPOLYGON type, then a final mapshaper precision pass writes the small
  # shipped geojson. returns the validated written layer and byte size, or NULL if
  # the geometry cannot be made valid at this keep.
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
  simplify_step <- function(keep_pct) {
    tmp_simplified <- tempfile(fileext = ".geojson")
    tmp_valid <- tempfile(fileext = ".geojson")
    on.exit(unlink(c(tmp_simplified, tmp_valid)), add = TRUE)
    run_mapshaper(tmp_in,
      c("-dissolve", "region", "-simplify", "weighted", "keep-shapes", sprintf("%g%%", keep_pct),
        "-clean", "allow-overlaps", "-o", "precision=0.00001", "format=geojson", tmp_simplified),
      paste0("simplify ", keep_pct, "%"))
    if (!file.exists(tmp_simplified)) stop("mapshaper wrote no simplify output at ", keep_pct, "%", call. = FALSE)
    w <- st_read(tmp_simplified, quiet = TRUE, stringsAsFactors = FALSE)
    w <- st_cast(st_make_valid(w), "MULTIPOLYGON")
    validity <- st_is_valid(w)
    if (nrow(w) != 6L || any(st_is_empty(w)) || any(is.na(validity)) || any(!validity)) return(NULL)
    st_write(w, tmp_valid, driver = "GeoJSON", delete_dsn = TRUE, quiet = TRUE)
    unlink(boundary_output)
    run_mapshaper(tmp_valid,
      c("-o", "precision=0.00001", "format=geojson", boundary_output),
      paste0("precision ", keep_pct, "%"))
    if (!file.exists(boundary_output)) stop("mapshaper wrote no precision output at ", keep_pct, "%", call. = FALSE)
    list(keep_percent = keep_pct, bytes = file_bytes(boundary_output))
  }

  # ladder from higher to lower keep; take the highest-fidelity step at or under the cap.
  keep_ladder <- c(30, 24, 20, 16, 12, 8, 6)
  chosen <- NULL
  for (keep_pct in keep_ladder) {
    step <- simplify_step(keep_pct)
    if (is.null(step)) next
    chosen <- step
    if (step[["bytes"]] <= 3000000L) break
  }
  if (is.null(chosen)) stop("no keep level produced a valid boundary", call. = FALSE)
  if (chosen[["bytes"]] > 3000000L) {
    stop("dissolved boundary remains above 3 MB after the keep ladder", call. = FALSE)
  }

  written <- st_read(boundary_output, quiet = TRUE, stringsAsFactors = FALSE)
  written <- written[order(written[["region"]]), ]
  validity <- st_is_valid(written)
  hashes <- geom_hashes(written)
  if (nrow(written) != 6L || any(st_is_empty(written)) || any(is.na(validity)) ||
      any(!validity) || anyDuplicated(hashes)) {
    stop("dissolved boundary failed feature, validity, distinctness, or emptiness gate", call. = FALSE)
  }
  # geodesic area on the geographic crs (s2); Argentina continental ~2.78M km2,
  # larger with the South Atlantic islands COD-AB carries under Tierra del Fuego.
  land_area <- as.numeric(st_area(written)) / 1e6
  names(land_area) <- written[["region"]]
  if (sum(land_area) < 2.3e6 || sum(land_area) > 3.6e6) {
    stop("total boundary land area is implausible (", round(sum(land_area)), " km2)", call. = FALSE)
  }
  list(
    written = written,
    land_area_by_region = round(land_area, 4),
    total_land_area = round(sum(land_area), 2),
    keep_percent = chosen[["keep_percent"]],
    output_bytes = chosen[["bytes"]],
    written_geometry_sha256 = setNames(as.list(unname(hashes)), written[["region"]]),
    distinct_written_hash_count = length(unique(hashes)),
    region_unit_counts = as.list(setNames(as.integer(region_unit_counts), names(region_unit_counts))),
    amba_partido_pcodes = sort(amba_members),
    matched_partidos = matched_partidos
  )
}

# ---- run gates -------------------------------------------------------------

for (path in c(pdf_2008, pdf_2019, codab_zip, codab_adm2)) require_file(path)
assert_source_hashes()

text_2008 <- normalise_source_text(pdf_layout_lines(pdf_2008))
text_2019 <- normalise_source_text(pdf_layout_lines(pdf_2019))
assert_2008_transcription(text_2008)
assert_2019_transcription(text_2019)

boundary_result <- build_boundary()
land_area_by_region <- boundary_result[["land_area_by_region"]]

# ---- derive slot values and column sums ------------------------------------
# 2008 affiliation is the full four-category sum (all categories printed); the
# five-category column sum is recorded against the derived one-decimal bound.
round1 <- function(x) round(x, 1)
aff_2008 <- setNames(numeric(length(region_order)), region_order)
norel_2008 <- setNames(numeric(length(region_order)), region_order)
colsum_2008 <- setNames(numeric(length(region_order)), region_order)
for (r in region_order) {
  aff_2008[[r]] <- round1(tab_2008$catolica[[r]] + tab_2008$evangelica[[r]] +
                            tab_2008$testigos[[r]] + tab_2008$otras[[r]])
  norel_2008[[r]] <- tab_2008$indiferentes[[r]]
  colsum_2008[[r]] <- round1(tab_2008$catolica[[r]] + tab_2008$indiferentes[[r]] +
                               tab_2008$evangelica[[r]] + tab_2008$testigos[[r]] + tab_2008$otras[[r]])
}
# derived one-decimal bound for a five-category partition: 0.05 pp x 5 = 0.25 pp.
bound_2008 <- 0.05 * 5
dev_2008 <- round(colsum_2008 - 100, 1) + 0
if (any(abs(dev_2008) > bound_2008 + 1e-9)) {
  stop("2008 column sum exceeded the derived 0.25 pp bound: ",
       paste(sprintf("%s=%.1f", names(colsum_2008), colsum_2008), collapse = ", "), call. = FALSE)
}

# 2019 affiliation is the printed-only lower bound: Católica + Evangélica + printed
# Testigos (NA where not printed). the printed-value sum (incl. Sin religión) is
# recorded to document that printed values do NOT sum to 100 (below-2% omissions).
aff_2019 <- setNames(numeric(length(region_order)), region_order)
norel_2019 <- setNames(numeric(length(region_order)), region_order)
printed_sum_2019 <- setNames(numeric(length(region_order)), region_order)
for (r in region_order) {
  testigos <- tab_2019$testigos[[r]]
  aff_parts <- c(tab_2019$catolica[[r]], tab_2019$evangelica[[r]], if (!is.na(testigos)) testigos)
  aff_2019[[r]] <- round1(sum(aff_parts))
  norel_2019[[r]] <- tab_2019$sin_religion[[r]]
  printed_parts <- c(tab_2019$catolica[[r]], tab_2019$sin_religion[[r]], tab_2019$evangelica[[r]],
                     if (!is.na(testigos)) testigos)
  printed_sum_2019[[r]] <- round1(sum(printed_parts))
}

# ---- build product rows (12: six regions x two waves) ----------------------
# composition carries the printed category shares verbatim per row; 2008 has all
# five categories, 2019 only the printed ones.
composition_item <- function(label, percent, tax) {
  item <- list(label_verbatim = label, percent = percent)
  if (!is.na(tax)) item[["taxonomy_code"]] <- tax
  item
}

change_flag <- "change_withheld_2008_indiferentes_vs_2019_sin_religion_and_2019_affiliation_disclosed_lower_bound"
common_flags <- c(
  "survey_construct_ceil_conicet_encuesta_creencias_y_actitudes_religiosas",
  "own_datanoun_survey_never_blended_with_census_affiliation",
  "percentages_only_no_counts_no_derivation_from_percent",
  "region_frame_stable_across_waves_amba_centro_noa_nea_cuyo_patagonia",
  "regional_estimates_from_subsamples_~400_uncertainty_larger_than_national_2pct_margin_at_95",
  change_flag,
  "boundary_codab_adm2_unhcr2017_custom_dissolve_cc_by_igo",
  "amba_split_caba_plus_24_gba_partidos_indec;centro_takes_rest_of_buenos_aires_province"
)

build_row <- function(region, year) {
  meta <- region_meta[[region]]
  area_unit_id <- paste0(boundary_set_id, ":", region)
  base <- list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = "macro_region",
    area_unit_id = area_unit_id,
    area_code = region,
    area_name = meta[["name"]],
    year = as.integer(year),
    population_total = NULL,
    religious_affiliation_count = NULL,
    no_religion_count = NULL,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = unname(land_area_by_region[[region]]),
    site_snapshot_date = NULL,
    place_count_basis = NULL
  )
  if (year == 2008) {
    comp <- lapply(names(tab_2008), function(cat) {
      composition_item(labels_2008[[cat]][["label"]], tab_2008[[cat]][[region]], labels_2008[[cat]][["tax"]])
    })
    dev <- dev_2008[[region]]
    colsum_flag <- if (abs(dev) > 1e-9)
      paste0("source_column_sums_to_", sprintf("%.1f", colsum_2008[[region]]),
             "_within_derived_0.25pp_one_decimal_bound") else NULL
    flags <- c(common_flags,
      "wave_2008_primera_encuesta_ceil_conicet_2403_casos_source_label_capital_y_gba=amba_sur=patagonia",
      "affiliation=catolica+evangelica+testigos_mormones+otras;no_religion=indiferentes",
      "indiferentes_defined_agnosticos_ateos_y_ninguna_religion_de_pertenencia",
      colsum_flag,
      "licence_needs_review_2008_build_then_ask_ceil_conicet_attribution")
    row <- c(base, list(
      population_total_basis = paste0(
        "CEIL-CONICET Primera Encuesta 2008, region table (Base: 2403 casos, national); ",
        "survey estimate as one-decimal percentages, no counts published. ",
        "Region subsample roughly 400; larger unpublished margin than the national +/- 2% at 95%."),
      religious_affiliation_percent = aff_2008[[region]],
      no_religion_percent = norel_2008[[region]],
      source_dataset_ids = list(dataset_id_2008, dataset_id_boundary),
      quality_flag = paste(flags[nzchar(flags)], collapse = ";"),
      composition = comp
    ))
  } else {
    comp <- list()
    for (cat in names(labels_2019)) {
      v <- tab_2019[[cat]][[region]]
      if (is.na(v)) next
      comp[[length(comp) + 1]] <- composition_item(labels_2019[[cat]][["label"]], v, labels_2019[[cat]][["tax"]])
    }
    printed_testigos <- if (!is.na(tab_2019$testigos[[region]]))
      paste0(";printed_testigos_mormones_minor_", sprintf("%.1f", tab_2019$testigos[[region]])) else ""
    flags <- c(common_flags,
      "wave_2019_segunda_encuesta_informe_25_source_of_record_2421_casos",
      paste0("chart_prints_only_values_above_2pct_", gsub(" ", "_", above_2pct_caption)),
      "affiliation_is_disclosed_lower_bound_printed_above_2pct_affiliation_categories_only_below_2pct_omitted",
      paste0("affiliation=catolica+evangelica+printed_testigos_mormones", printed_testigos, ";no_religion=sin_religion"),
      paste0("printed_values_sum_to_", sprintf("%.1f", printed_sum_2019[[region]]),
             "_do_not_sum_to_100_below_2pct_categories_omitted"),
      "licence_cc_by_nc_sa_4_0_via_mallimaci_esquivel_gimenez_beliveau_2020_noncommercial_pi_ruling_pending")
    row <- c(base, list(
      population_total_basis = paste0(
        "CEIL-CONICET Segunda Encuesta 2019 (Informe nº 25), region chart (Base: 2421 casos, national); ",
        "survey estimate as one-decimal percentages, no counts published. Universe 18+ in urban ",
        "localities of at least 5,000 inhabitants. Region subsample roughly 400; larger unpublished ",
        "margin than the national +/- 2% at 95%."),
      religious_affiliation_percent = aff_2019[[region]],
      no_religion_percent = norel_2019[[region]],
      source_dataset_ids = list(dataset_id_2019, dataset_id_article, dataset_id_boundary),
      quality_flag = paste(flags[nzchar(flags)], collapse = ";"),
      composition = comp
    ))
  }
  row
}

product_rows <- list()
for (year in c(2008, 2019)) {
  for (region in region_order) {
    product_rows[[length(product_rows) + 1]] <- build_row(region, year)
  }
}
if (length(product_rows) != 12L) stop("expected 12 rows (6 regions x 2 waves)", call. = FALSE)

# ---- source datasets, indicators, visual layers ----------------------------

source_datasets <- list(
  list(
    source_dataset_id = dataset_id_2008,
    name = "CEIL-CONICET Primera Encuesta Nacional sobre Creencias y Actitudes Religiosas en Argentina (2008), region table",
    provider = "Programa Sociedad, Cultura y Religión, CEIL-CONICET",
    url = url_2008,
    retrieval_date = retrieval_date,
    local_path = pdf_2008,
    licence = list(
      name = "No located open licence (CEIL-CONICET report); reuse needs_review, build-then-ask",
      url = NULL,
      attribution = "Source: CEIL-CONICET, Primera Encuesta Nacional sobre Creencias y Actitudes Religiosas en Argentina (2008); dirs. Fortunato Mallimaci, Juan Cruz Esquivel, Lic. Gabriela Irrazábal"
    ),
    citation = "Mallimaci, F., Esquivel, J. C., Irrazábal, G. (2008). Primera Encuesta Nacional sobre Creencias y Actitudes Religiosas en Argentina. CEIL-CONICET. Region table 'La religión de los Argentinos – según región' (Base 2403 casos).",
    access_limits = "Open web PDF (bahia.gob.ar mirror).",
    redistribution_limits = "No located open-data licence for the 2008 report; reuse of the derived regional percentages is needs_review pending a project-lead ruling (build-then-ask, CEIL-CONICET attribution).",
    notes = paste0("Five printed categories partition each region column. ", indiferentes_definition,
                   " AMBA is printed 'Capital y GBA'; Patagonia is printed 'Sur'.")
  ),
  list(
    source_dataset_id = dataset_id_2019,
    name = "CEIL-CONICET Segunda Encuesta Nacional sobre Creencias y Actitudes Religiosas en Argentina (2019), Informe de Investigación nº 25",
    provider = "Programa Sociedad, Cultura y Religión, CEIL-CONICET",
    url = url_2019,
    retrieval_date = retrieval_date,
    local_path = pdf_2019,
    licence = list(
      name = "CC BY-NC-SA 4.0 via the peer-reviewed article (non-commercial; PI/project-lead ruling pending)",
      url = "https://creativecommons.org/licenses/by-nc-sa/4.0/",
      attribution = "Source: CEIL-CONICET, Segunda Encuesta Nacional sobre Creencias y Actitudes Religiosas en Argentina (2019), Informe nº 25"
    ),
    citation = "CEIL-CONICET (2019). Segunda Encuesta Nacional sobre Creencias y Actitudes Religiosas en Argentina, Informe de Investigación nº 25 (ISSN 1515-7466). Chart 'Adscripción religiosa según región', p. 14 (Base 2421 casos).",
    access_limits = "Open web PDF.",
    redistribution_limits = paste0(
      "The 2019 regional table is carried under CC BY-NC-SA 4.0 via the peer-reviewed article ",
      "(Mallimaci, Esquivel & Giménez Béliveau 2020). The non-commercial clause is a genuine condition; ",
      "a project-lead / PI licence ruling is pending (a new licence class for the corpus). The Informe nº 25 ",
      "chart is the source of record for the figures. The chart prints only values above 2% ('", above_2pct_caption, "')."),
    notes = "The 2019 affiliation share is a disclosed lower bound: only above-2% affiliation categories are printed, so unprinted below-2% categories are omitted and no unprinted value is derived."
  ),
  list(
    source_dataset_id = dataset_id_article,
    name = "Mallimaci, Esquivel & Giménez Béliveau (2020), Sociedad y Religión 30(55): licence basis for the 2019 wave",
    provider = "CONICET; Sociedad y Religión (Sociología, Antropología e Historia de la Religión en el Cono Sur)",
    url = url_article,
    retrieval_date = retrieval_date,
    local_path = NULL,
    licence = list(
      name = "Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)",
      url = "https://creativecommons.org/licenses/by-nc-sa/4.0/",
      attribution = "Mallimaci, F., Esquivel, J. C. & Giménez Béliveau, V. (2020), Sociedad y Religión 30(55), CONICET"
    ),
    citation = "Mallimaci, F., Esquivel, J. C., & Giménez Béliveau, V. (2020). Religiones y creencias en Argentina (2008-2019). Resultados de la Segunda Encuesta Nacional de Creencias y actitudes religiosas en Argentina. Sociedad y Religión, 30(55).",
    access_limits = "Open access (redalyc).",
    redistribution_limits = "CC BY-NC-SA 4.0: reuse with attribution, non-commercial, share-alike. Verbatim: 'Esta obra está bajo una Licencia Creative Commons Atribución-NoComercial-CompartirIgual 4.0 Internacional'.",
    notes = "The article carries a 2019 regional table whose Católica/Evangélica columns diverge from the Informe nº 25 chart (see the manifest discrepancy note); the Informe chart is the source of record for the shipped figures."
  ),
  list(
    source_dataset_id = dataset_id_boundary,
    name = "COD-AB Argentina ADM2 (UNHCR 2017; Instituto Geográfico Nacional source), 526 departments/partidos",
    provider = "UNHCR / OCHA ROLAC; Instituto Geográfico Nacional (IGN), Argentina",
    url = url_codab,
    retrieval_date = retrieval_date,
    local_path = codab_zip,
    licence = list(
      name = "Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO)",
      url = "https://data.humdata.org/dataset/cod-ab-arg",
      attribution = "OCHA / UNHCR COD-AB Argentina (2017); source Instituto Geográfico Nacional"
    ),
    citation = "OCHA/UNHCR (2017). Argentina - Subnational Administrative Boundaries (COD-AB), ADM2. Source: Instituto Geográfico Nacional.",
    access_limits = "Open on the Humanitarian Data Exchange.",
    redistribution_limits = "CC BY-IGO permits redistribution and derivatives with attribution.",
    notes = paste0(
      "Chosen over geoBoundaries ARG ADM2: geoBoundaries carries only shapeName (department) with no ",
      "province field, and Argentine department names repeat across provinces, so a province-based dissolve ",
      "is ambiguous. COD-AB carries ADM1_ES (province) + ADM2_ES (department) + INDEC ADM2_PCODE, which makes ",
      "the six-region dissolve and the AMBA/Centro split of Buenos Aires province unambiguous.")
  )
)

survey_spatial_note <- "Six standard Argentine macro-regions on a custom COD-AB ADM2 dissolve (AMBA = CABA + 24 GBA partidos; Centro takes the rest of Buenos Aires province; the other four regions are whole-province groupings)."

indicators <- list(
  list(
    indicator_id = "religious_affiliation_percent",
    label = "Religious affiliation (%) — survey",
    description = "Share of survey respondents reporting a religious affiliation. 2008: Católica + Evangélica + Testigos de Jehová/Mormones + Otras. 2019: a disclosed lower bound (printed above-2% affiliation categories only).",
    unit = "percent",
    denominator_indicator_id = NULL,
    method = paste0(
      "2008: sum of the four printed affiliation-category shares (all categories printed; column sums to 100 ",
      "within the derived 0.25 pp one-decimal bound). 2019: sum of the PRINTED affiliation categories only ",
      "(Católica + Evangélica + any printed Testigos de Jehová/Mormones), a disclosed lower bound because the ",
      "chart prints only values above 2% and below-2% categories are omitted; no unprinted value is derived."),
    temporal_coverage = "2008, 2019 (each wave a separate cross-section; no cross-wave change)",
    spatial_coverage = survey_spatial_note,
    quality_notes = "Survey construct (CEIL-CONICET), its own dataNoun, never blended with census affiliation. Per-region estimates rest on subsamples of roughly 400 and carry a larger unpublished margin than the national +/- 2% at 95%."
  ),
  list(
    indicator_id = "no_religion_percent",
    label = "No religion (%) — survey",
    description = "2008: Indiferentes (agnostics, atheists and no-affiliation combined). 2019: printed Sin religión.",
    unit = "percent",
    denominator_indicator_id = NULL,
    method = "2008: the printed Indiferentes share, carried unchanged. 2019: the printed Sin religión share, carried unchanged.",
    temporal_coverage = "2008, 2019",
    spatial_coverage = survey_spatial_note,
    quality_notes = paste0("The frames differ across waves: ", indiferentes_definition,
                           " The 2019 wave replaces Indiferentes with an explicit Sin religión slot plus a separate No sabe slot; no cross-wave change is shipped.")
  )
)

visual_layers <- list(
  list(
    visual_layer_id = "ar-macroregion-religious-affiliation-share-survey",
    label = "Religious affiliation share (survey)",
    description = "Survey religious affiliation share by macro-region, 2008 and 2019 (2019 a disclosed lower bound).",
    layer_type = "choropleth",
    indicator_ids = list("religious_affiliation_percent"),
    geometry_unit_type = "area_unit",
    legend = list(unit = "percent", denominator = "survey respondents (published one-decimal shares)"),
    colour_scale = "sequential",
    time_control = "year_selector",
    aggregation_rule = "published regional survey value on the macro-region dissolve",
    uncertainty_display = "quality_flag",
    default_visibility = TRUE,
    notes = "Two waves, each a separate cross-section; no cross-wave change layer (2008 Indiferentes vs 2019 Sin religión, and the 2019 affiliation is a printed-only lower bound)."
  ),
  list(
    visual_layer_id = "ar-macroregion-no-religion-share-survey",
    label = "No religion share (survey)",
    description = "Survey no-religion share by macro-region: 2008 Indiferentes, 2019 Sin religión.",
    layer_type = "choropleth",
    indicator_ids = list("no_religion_percent"),
    geometry_unit_type = "area_unit",
    legend = list(unit = "percent", denominator = "survey respondents (published one-decimal shares)"),
    colour_scale = "sequential",
    time_control = "year_selector",
    aggregation_rule = "published regional survey value on the macro-region dissolve",
    uncertainty_display = "quality_flag",
    default_visibility = FALSE,
    notes = "2008 Indiferentes and 2019 Sin religión are non-identical constructs; each wave is shown as its own cross-section."
  )
)

area_summary <- list(
  schema_version = "area-summary.v2",
  generated_at = stamp,
  generated_by = script_id,
  country_code = country_code,
  data_status = "survey_religion_live",
  data_status_note = paste0(
    "Survey religious affiliation (CEIL-CONICET Encuesta sobre Creencias y Actitudes Religiosas) is live for six ",
    "macro-regions in 2008 and 2019. Its own survey dataNoun; never blended with census affiliation (the Argentine ",
    "census dropped religion after 1960). Percentages only, no counts. The 2019 affiliation is a disclosed lower ",
    "bound (chart prints only values above 2%). Ships STAGED pending a PI licence ruling (2019 CC BY-NC-SA 4.0 ",
    "non-commercial; 2008 needs_review build-then-ask)."),
  boundary_set = list(
    boundary_set_id = boundary_set_id,
    country_code = country_code,
    level = "macro_region",
    vintage = "COD-AB ARG ADM2 (UNHCR 2017) custom dissolve to six macro-regions",
    source_dataset_id = dataset_id_boundary
  ),
  site_snapshot = list(
    source_dataset_id = NULL,
    snapshot_date = NULL,
    basis = "no governed Argentina place-of-worship snapshot is included in this survey-religion release",
    notes = "The Argentina lane ships survey-religion percentage metrics only."
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
val_or_na <- function(row, key, integer = FALSE) {
  v <- row[[key]]
  if (is.null(v)) return(if (integer) NA_integer_ else NA_real_)
  v
}
flat <- data.frame(
  country_code = vapply(product_rows, `[[`, character(1), "country_code"),
  boundary_set_id = vapply(product_rows, `[[`, character(1), "boundary_set_id"),
  boundary_level = vapply(product_rows, `[[`, character(1), "boundary_level"),
  area_unit_id = vapply(product_rows, `[[`, character(1), "area_unit_id"),
  area_code = vapply(product_rows, `[[`, character(1), "area_code"),
  area_name = vapply(product_rows, `[[`, character(1), "area_name"),
  year = vapply(product_rows, `[[`, integer(1), "year"),
  population_total = vapply(product_rows, function(r) val_or_na(r, "population_total", TRUE), numeric(1)),
  population_total_basis = vapply(product_rows, `[[`, character(1), "population_total_basis"),
  religious_affiliation_count = vapply(product_rows, function(r) val_or_na(r, "religious_affiliation_count", TRUE), numeric(1)),
  religious_affiliation_percent = vapply(product_rows, function(r) val_or_na(r, "religious_affiliation_percent"), numeric(1)),
  no_religion_count = vapply(product_rows, function(r) val_or_na(r, "no_religion_count", TRUE), numeric(1)),
  no_religion_percent = vapply(product_rows, function(r) val_or_na(r, "no_religion_percent"), numeric(1)),
  place_count = NA_integer_,
  places_per_10000_residents = NA_real_,
  place_density_per_sq_km = NA_real_,
  land_area_sq_km = vapply(product_rows, function(r) val_or_na(r, "land_area_sq_km"), numeric(1)),
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
  raw_source_record(pdf_2008, url_2008, "CEIL-CONICET Primera Encuesta 2008 report (region table 'La religión de los Argentinos – según región')"),
  raw_source_record(pdf_2019, url_2019, "CEIL-CONICET Segunda Encuesta 2019 Informe nº 25 (chart 'Adscripción religiosa según región', p. 14)"),
  raw_source_record(codab_zip, url_codab, "COD-AB Argentina ADM0/1/2 (UNHCR 2017) shapefile bundle")
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

category_mapping_2008 <- lapply(names(tab_2008), function(cat) {
  role <- if (cat == "indiferentes") "no_religion" else "religious_affiliation"
  list(source_label = labels_2008[[cat]][["label"]], product_role = role,
       taxonomy_code = labels_2008[[cat]][["tax"]])
})
category_mapping_2019 <- lapply(names(labels_2019), function(cat) {
  role <- if (cat == "sin_religion") "no_religion" else "religious_affiliation"
  list(source_label = labels_2019[[cat]][["label"]], product_role = role,
       taxonomy_code = labels_2019[[cat]][["tax"]],
       printed = if (cat == "testigos") "above 2% only (Centro, Cuyo)" else "printed per region")
})

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = paste0("manifest:ar-survey-religion:ar:2008-2019:", version_hash),
  dataset_id = "ar-survey-religion:ar:2008-2019:ceil-conicet-codab",
  dataset_version_id = paste0("ar-survey-religion:ar:2008-2019:ceil-conicet-codab:", version_hash),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "ar-survey-religion",
  dataset_role = "public_product",
  scope = list(level = "country", country_codes = list("AR"), snapshot_date = NULL, pipeline_stage = "staged"),
  created_at = stamp,
  created_by = script_id,
  target_years = list(2008L, 2019L),
  pipeline = list(
    script = script_id,
    git_commit = git_commit,
    command = paste("Rscript", script_id),
    parameters = list(
      construct = list(
        data_noun = "Survey",
        summary = paste0(
          "CEIL-CONICET national survey on religious beliefs and attitudes (Programa Sociedad, Cultura y ",
          "Religión), religious affiliation by six macro-regions, two waves. Survey construct, its own dataNoun, ",
          "never blended with census affiliation (Argentina's census dropped religion after 1960). Percentages ",
          "only, one decimal, no counts (GN/GW percentages-only precedent)."),
        national_margin = "+/- 2% at 95% (national Total País only); per-region subsamples of roughly 400 carry a larger, unpublished margin."
      ),
      wave_2008 = list(
        year = 2008L,
        source = "CEIL-CONICET Primera Encuesta 2008 report, region table 'La religión de los Argentinos – según región' (Base 2403 casos)",
        printed_labels = "Capital y GBA (=AMBA), Centro, NEA, NOA, Cuyo, Sur (=Patagonia)",
        slot_design = "affiliation = Católica + Evangélica + Testigos de Jehová/Mormones + Otras; no_religion = Indiferentes.",
        indiferentes_definition_verbatim = indiferentes_definition,
        column_sum_bound = list(
          derivation = "Five printed categories partition each region column; each one-decimal cell carries at most 0.05 pp rounding error, so a printed column may differ from 100.0 by at most 0.05 x 5 = 0.25 pp.",
          bound_pp = bound_2008,
          column_sums = as.list(round(colsum_2008, 1)),
          deviations_pp = as.list(dev_2008),
          observed_max_absolute_deviation_pp = max(abs(dev_2008)),
          status = "Every 2008 region column sums to 100 within [99.9, 100.1] (0.1 pp observed, under the 0.25 pp bound). No percentage was altered."
        ),
        affiliation_lower_bound = "not a lower bound; all five categories printed."
      ),
      wave_2019 = list(
        year = 2019L,
        source = "CEIL-CONICET Segunda Encuesta 2019, Informe nº 25, chart 'Adscripción religiosa según región', p. 14 (Base 2421 casos) — source of record",
        above_2pct_caption_verbatim = above_2pct_caption,
        slot_design = "no_religion = printed Sin religión. affiliation = disclosed LOWER BOUND: sum of PRINTED affiliation categories only (Católica + Evangélica + any printed Testigos de Jehová/Mormones). No unprinted below-2% value is derived (Georgia-2002 lower-bound-affiliation precedent).",
        printed_testigos_minor = list(centro = 2.5, cuyo = 2.6, note = "The only printed minor affiliation values; identified as the Testigos de Jehová/Mormones (cyan) segment from the p.14 chart render."),
        affiliation_lower_bound = as.list(round(aff_2019, 1)),
        no_religion = as.list(round(norel_2019, 1)),
        printed_value_sums = list(
          sums = as.list(round(printed_sum_2019, 1)),
          note = "Printed values (Católica + Sin religión + Evangélica + any printed Testigos) do NOT sum to 100 per region: below-2% categories (Testigos where under 2%, Otras, No sabe) are omitted by the chart's above-2% rule. The unprinted remainder is NOT distributed and NOT derived."
        )
      ),
      change_metric = list(
        status = "withheld",
        token = change_flag,
        rationale = "The 2008 and 2019 category frames differ (2008 Indiferentes vs 2019 Sin religión + No sabe) and the 2019 affiliation is a printed-only lower bound; no cross-wave change is comparable. Every row carries a change_withheld_* flag that trips the runtime guard."
      ),
      category_mapping_2008 = category_mapping_2008,
      category_mapping_2019 = category_mapping_2019,
      national_context = national_context,
      informe_vs_article_discrepancy = paste0(
        "The peer-reviewed article (Mallimaci, Esquivel & Giménez Béliveau 2020, CC BY-NC-SA 4.0) carries a 2019 ",
        "regional table whose Católica/Evangélica columns diverge from the Informe nº 25 chart (most sharply for ",
        "Patagonia: Católica 51.0 report vs 57.9 article; Evangélica 24.4 report vs 18.2 article), while the ",
        "no-religion column matches closely across all six regions. The Informe nº 25 chart is the source of record ",
        "for the shipped figures (official report, values read directly from the PDF text layer and confirmed ",
        "against the p.14 chart render). The article table was extracted via a reading model from the redalyc HTML ",
        "and was not re-verified against the article PDF in this build; the discrepancy is carried, not resolved, ",
        "and does not affect the shipped Informe values."),
      boundary = list(
        boundary_set_id = boundary_set_id,
        source = "COD-AB ARG ADM2 (UNHCR 2017; IGN source), CC BY-IGO, custom dissolve to six macro-regions",
        source_choice = "geoBoundaries ARG ADM2 (CC BY 3.0 IGO) was rejected as attribute-mismatched: it carries only shapeName (department) with no province field, and Argentine department names repeat across provinces, so a province-based dissolve is ambiguous. COD-AB carries ADM1_ES + ADM2_ES + INDEC ADM2_PCODE.",
        source_units = 526L,
        features = 6L,
        region_unit_counts = boundary_result[["region_unit_counts"]],
        total_land_area_sq_km = boundary_result[["total_land_area"]],
        output_bytes = boundary_result[["output_bytes"]],
        distinct_written_geometry_hashes = boundary_result[["distinct_written_hash_count"]],
        simplification = list(method = "mapshaper -dissolve region -simplify weighted keep-shapes -clean allow-overlaps",
                              keep_percent = boundary_result[["keep_percent"]], byte_ceiling = 3000000L),
        amba_split = list(
          rule = "AMBA = Ciudad Autónoma de Buenos Aires (all 15 comunas) + the INDEC 24 partidos del Gran Buenos Aires; Centro takes the remaining Buenos Aires-province partidos.",
          partido_source = "INDEC, ¿Qué es el Gran Buenos Aires? (2003): CABA + 24 partidos.",
          amba_24_partidos = as.list(amba_24_partidos),
          amba_24_partido_pcodes = as.list(boundary_result[["amba_partido_pcodes"]]),
          matched_count = length(boundary_result[["matched_partidos"]])
        ),
        written_geometry_sha256 = boundary_result[["written_geometry_sha256"]]
      ),
      licence_position = list(
        wave_2019 = list(
          status = "needs_review",
          basis = "cc_by_nc_sa_4_0_via_mallimaci_esquivel_gimenez_beliveau_2020_noncommercial_pi_ruling_pending",
          licence = "CC BY-NC-SA 4.0 (article basis; non-commercial, share-alike, attribution)",
          condition = "The non-commercial clause is a genuine condition; a PI / project-lead ruling is pending (a new licence class for the corpus). Page is HELD.",
          verbatim = "Esta obra está bajo una Licencia Creative Commons Atribución-NoComercial-CompartirIgual 4.0 Internacional"
        ),
        wave_2008 = list(
          status = "needs_review",
          basis = "ceil_conicet_2008_report_no_located_open_licence_build_then_ask",
          recorded_ask = "May CEIL-CONICET 2008 regional percentages be shipped as a derived survey-construct map product? No open licence for the 2008 report was located; build-then-ask needs_review with CEIL-CONICET attribution (the probe's recorded ask stands)."
        ),
        boundary = "COD-AB ARG ADM2 (UNHCR 2017): CC BY-IGO."
      ),
      raw_sources = raw_sources,
      local_cache_hint = "data/raw/ar_survey/ (git-ignored; every cached source listed with URL, bytes, and SHA-256 in pipeline.parameters.raw_sources).",
      raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/ar_survey/")
    ),
    software_versions = list(
      R = paste(R.version$major, R.version$minor, sep = "."),
      sf = as.character(utils::packageVersion("sf")),
      stringi = as.character(utils::packageVersion("stringi")),
      jsonlite = as.character(utils::packageVersion("jsonlite"))
    )
  ),
  source = list(
    provider = "Programa Sociedad, Cultura y Religión, CEIL-CONICET; COD-AB Argentina (UNHCR/IGN)",
    source_dataset_ids = list(dataset_id_2008, dataset_id_2019, dataset_id_article, dataset_id_boundary),
    source_urls = list(url_2008, url_2019, url_article, url_codab, url_codab_meta),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = "2019: CC BY-NC-SA 4.0 (needs_review, PI ruling pending). 2008: no located open licence (needs_review, build-then-ask). Boundary: CC BY-IGO.",
    raw_redistribution = "Report PDFs and boundary are open web sources; intended durable mirror gs://pow-research-data/raw_sources/ar_survey/.",
    citation = "CEIL-CONICET Encuesta Nacional sobre Creencias y Actitudes Religiosas en Argentina, 2008 (Primera) and 2019 (Segunda, Informe nº 25); COD-AB Argentina ADM2 (UNHCR 2017, IGN).",
    local_cache_hint = "data/raw/ar_survey/ (git-ignored).",
    raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/ar_survey/")
  ),
  input_manifests = list(),
  deferred_sources = list(
    list(layer = "census religion", status = "documented non-route",
         note = "Argentina's national census dropped religious affiliation after 1960 (report p. 24: 'Desde 1960, el Censo Nacional de Población dejó de interrogar sobre las adscripciones religiosas'). There is no modern census-religion route; the survey construct is the only route and is never blended with census affiliation."),
    list(layer = "regional counts", status = "documented non-route",
         note = "Neither wave publishes regional counts; both publish one-decimal percentages by region. No count is derived from any percentage."),
    list(layer = "cross-wave change", status = "documented non-route",
         note = "The 2008 and 2019 frames differ and the 2019 affiliation is a lower bound; no cross-wave change metric ships (change_withheld on every row).")
  ),
  durable_files = list(
    durable_file_record(summary_output, "Argentina two-wave macro-region survey-religion area-summary JSON (area-summary.v2)",
                        "ceil_conicet_survey_2019_cc_by_nc_sa_pi_pending_2008_needs_review", "needs_review", row_count = 12L),
    durable_file_record(summary_csv_output, "Argentina two-wave macro-region survey-religion area-summary CSV",
                        "ceil_conicet_survey_2019_cc_by_nc_sa_pi_pending_2008_needs_review", "needs_review", row_count = 12L),
    durable_file_record(boundary_output, "Argentina six macro-region boundary (COD-AB ADM2 dissolve)",
                        "cc_by_igo", "accepted", feature_count = 6L)
  ),
  partitions = list(
    list(partition_id = "ar-macroregion-2008-2019", partition_type = "area",
         file_uri = paste0("repo:", summary_output), sha256 = sha256_file(summary_output),
         country_code = "AR", row_count = 12L, stage = "staged")
  ),
  stats = list(
    waves = 2L, years = "2008, 2019", region_rows = 12L, regions_per_wave = 6L,
    boundary_features = 6L, boundary_keep_percent = boundary_result[["keep_percent"]],
    boundary_bytes = boundary_result[["output_bytes"]],
    col_sum_2008_bound_pp = bound_2008, col_sum_2008_max_dev_pp = max(abs(dev_2008))
  ),
  local_cache_hint = "data/raw/ar_survey/ (git-ignored; every cached source listed with URL, bytes, and SHA-256 in pipeline.parameters.raw_sources).",
  validation = list(
    status = "passed",
    commands = list(
      paste("Rscript", script_id),
      paste("uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.v2.schema.json", summary_output),
      paste("uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/data-manifest.schema.json", manifest_output),
      "bash scripts/validate_area_summaries.sh"
    ),
    warnings = list(
      "2019 affiliation is a DISCLOSED LOWER BOUND: the chart prints only values above 2%, so below-2% affiliation categories are omitted; printed values do not sum to 100. No unprinted value is derived.",
      "Per-region estimates rest on survey subsamples of roughly 400 and carry a larger unpublished margin than the national +/- 2% at 95%.",
      "The 2008 and 2019 category frames differ; no cross-wave change ships (change_withheld on every row).",
      "2019 reuse is CC BY-NC-SA 4.0 (non-commercial); a PI licence ruling is pending and the page is HELD. 2008 reuse is needs_review (build-then-ask)."
    ),
    notes = paste0(
      "Both PDF hashes byte-match the probe (2008 0c90dad2..., 2019 722fcf81...). Every shipped 2008 table value ",
      "and 2019 chart value appears in the pdftotext -layout output; the 2019 printed minors (Centro 2.5, Cuyo 2.6) ",
      "were confirmed as the Testigos de Jehová/Mormones segment from the p.14 chart render. The six-feature ",
      "boundary dissolve joins 6/6 regions with distinct geometry hashes, valid non-empty geometries, under the 3 MB ",
      "cap; all 526 COD-AB ADM2 units are assigned to exactly one region and all 24 GBA partidos match. Both the ",
      "area-summary (area-summary.v2) and the manifest pass schema validation.")
  ),
  privacy = "public",
  licence_status = "needs_review",
  licence_basis = "ceil_conicet_survey_2019_cc_by_nc_sa_pi_pending_2008_needs_review",
  downstream_status = "staged",
  notes = paste0(
    "Two-wave (2008, 2019) six-macro-region survey-religion product (CEIL-CONICET), one-decimal percentages only, ",
    "no counts. Survey dataNoun, never blended with census affiliation. 2019 affiliation is a disclosed lower bound ",
    "(chart prints only values above 2%). Custom COD-AB ADM2 dissolve (AMBA = CABA + 24 GBA partidos; Centro takes ",
    "the rest of Buenos Aires province). Ships STAGED (no page, no hub): 2019 CC BY-NC-SA 4.0 non-commercial with a ",
    "PI ruling pending; 2008 needs_review build-then-ask.")
)

write_json(manifest, manifest_output, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)

if (!jsonlite::validate(readChar(manifest_output, file_bytes(manifest_output), useBytes = TRUE))) {
  stop("manifest output is not valid JSON", call. = FALSE)
}
validate_json_schema("schemas/data-manifest.schema.json", manifest_output)

message(
  "built Argentina survey-religion product: ", length(product_rows), " rows (6 macro-regions x 2 waves); ",
  "boundary ", boundary_result[["output_bytes"]], " bytes at keep ", boundary_result[["keep_percent"]], "%, ",
  boundary_result[["total_land_area"]], " km2; 2008 col-sum max dev ", max(abs(dev_2008)), " pp (bound ",
  bound_2008, " pp); staged (licence needs_review, PI ruling pending)."
)
