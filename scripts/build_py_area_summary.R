# build the Paraguay 2002 census-religion department product from the CELADE-hosted
# INE REDATAM Webserver cross-tabulation (base CPV2002).
#
# inputs: the cached REDATAM cross-tab output HTML (religion by department, by sex)
# under git-ignored data/raw/py_census/, the geoBoundaries PRY ADM1 boundary and its
# release metadata (also cached there).
# outputs: apps/regions/py/data/area_summary_department.{json,csv},
# apps/regions/py/data/py_department_2002.geojson, and the tracked data manifest
# docs/manifests/py-census-religion-2002.json.
# run from the repo root: Rscript scripts/build_py_area_summary.R
#
# product scope. seventeen departments plus the Asunción capital district, one wave
# (2002). the universe is the population aged 10 and over (the 2002 census asked
# religion only of persons 10+; cuadro P16 title: "Población de 10 años y más de edad
# por sexo, según tipo de religión"). counts as extracted; the detailed REDATAM
# denomination list is recoded to the published national P16 seven-group frame and
# each department's seven-group counts reconcile exactly to the national P16 totals.
#
# route. the department table is produced by a live cross-tab against the CELADE INE
# REDATAM Webserver (accepted under the StatsBank/DATAcube official-dissemination
# ruling, queue row 95). the exact query parameters (base CPV2002, ITEM CRUCPOB, ROW
# PERSONA.religion, COLUMN PERSONA.sexo, AREABREAK DEPTO, SELECTION ALL) are recorded
# in the manifest; the engine's HTML output is cached and sha-256-pinned, so the
# build is deterministic from the cache and parametrically reproducible from the query.
#
# gate design. the recode is validated by the data itself: the seven recoded national
# group totals must equal the published P16 totals exactly (total 3,892,603 and every
# group), and each department's seven groups must sum to that department's REDATAM
# total exactly. the REDATAM output also appends its own all-country RESUMEN block; the
# build cross-checks that this block equals the sum over the 18 departments per detailed
# label. no count is ever altered to force a match; a mismatch stops the build.
#
# licence. Paraguay open-data licence (Decreto 4064 / Ley 5282/2014), which authorises
# extracción and transformación with attribution; licence_status accepted. boundary
# geoBoundaries PRY ADM1 CC BY 4.0 (DGEEC-sourced).

suppressPackageStartupMessages({
  library(jsonlite)
  library(sf)
  library(stringi)
  library(digest)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "PY"
script_id <- "scripts/build_py_area_summary.R"
raw_dir <- "data/raw/py_census"
output_dir <- "apps/regions/py/data"
manifest_dir <- "docs/manifests"

retrieval_date <- "2026-07-12"
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")

# ---- cached inputs and pinned source URLs ---------------------------------

redatam_html <- file.path(raw_dir, "redatam_religion_by_departamento_2002.html")
crucpob_form_html <- file.path(raw_dir, "redatam_crucpob_form.html")
boundary_path <- file.path(raw_dir, "geoBoundaries-PRY-ADM1.geojson")
boundary_meta_path <- file.path(raw_dir, "gb_pry_adm1_meta.json")

url_portal <- "https://prod.redatam.org/binpry/RpWebEngine.exe/Portal?BASE=CPV2002"
url_crosstab <- "https://prod.redatam.org/binpry/RpWebStats.exe/CrossTab?"
url_licence <- "https://www.ine.gov.py/microdatos/license.php"
url_boundary <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/PRY/ADM1/geoBoundaries-PRY-ADM1.geojson"
url_boundary_meta <- "https://www.geoboundaries.org/api/current/gbOpen/PRY/ADM1/"

# the exact REDATAM cross-tab POST parameters (RpWebStats.exe/CrossTab). recorded so
# the live query is parametrically reproducible per the official-dissemination ruling.
redatam_query <- list(
  base = "CPV2002",
  item = "CRUCPOB",
  main = "WebServerMain.inl",
  mode = "RUN",
  row = "PERSONA.religion",
  row_label = "Religión que profesa",
  column = "PERSONA.sexo",
  column_label = "Sexo",
  control = "",
  areabreak = "DEPTO",
  areabreak_label = "Departamento",
  selection = "ALL",
  universe = "",
  filter = "",
  format = "HTML",
  percent = "PCT_1",
  endpoint = url_crosstab,
  portal = url_portal
)

boundary_set_id <- "py-department-2002-geoboundaries-adm1"
boundary_output <- file.path(output_dir, "py_department_2002.geojson")
summary_output <- file.path(output_dir, "area_summary_department.json")
summary_csv_output <- file.path(output_dir, "area_summary_department.csv")
manifest_output <- file.path(manifest_dir, "py-census-religion-2002.json")

dataset_id_census <- "ine-cpv2002-redatam-religion-departamento"
dataset_id_boundary <- "geoboundaries-pry-adm1"

wave_year <- 2002L

# published national cuadro P-16 group totals (aged 10+), verbatim from the INE
# "Total País" sociocultural fascicle; the exact reconciliation target.
p16_targets <- c(
  `Católica`         = 3489531L,
  `Evangélicas`      = 239573L,
  `Otras cristianas` = 44275L,
  `Indígena`         = 25219L,
  `Otras religiones` = 12465L,
  `No tiene`         = 44334L,
  `No informado`     = 37206L
)
p16_total <- 3892603L

# the seven P16 verbatim group labels in published order.
p16_groups <- names(p16_targets)

# ---- recode: detailed REDATAM denomination -> P16 seven-group frame ---------
# every detailed label the REDATAM "Religión que profesa" variable emits is assigned
# to exactly one P16 group. the assignment is fixed and fully determined: it reproduces
# all seven published P16 national totals exactly (the reconciliation gate below).
# three assignments the arithmetic forces and that the office's own grouping confirms:
#   - the three Orthodox labels (Ortodoxa, Rusa, Otras - Ortodoxa) fall under CATÓLICA,
#     not Otras cristianas (their sum 1,445 is exactly P16 Católica minus REDATAM
#     "Católica"); the census groups the apostolic/orthodox churches with Católica.
#   - "Monte de Sión" falls under OTRAS CRISTIANAS, not Evangélicas.
#   - every "Indígena + X" mixed label falls under INDÍGENA (indigenous-primary).
# "Sin religión" is the no-religion group (P16 "No tiene"); "No especificado" is the
# non-response group (P16 "No informado"), which stays inside the denominator and
# outside both the affiliation and no-religion slots.
recode_table <- list(
  `Católica` = c(
    "Católica", "Ortodoxa", "Rusa", "Otras - Ortodoxa"
  ),
  `Evangélicas` = c(
    "Alianza Cristiana y Misionera", "Anglicana", "Asamblea de Dios",
    "Bautista. Bautista Maranata", "Centro Fam. de Adoración. Aposent",
    "Comunidad Cristiana", "Hermanos Libres", "Independientes", "Iglesia de Dios",
    "Iglesia de Dios de la Profecía", "Luterana", "Mennonita", "Metodista",
    "Metodista Libre", "Nazarena", "Neotestamentaria", "Pentecostal",
    "Presbiteriana", "Otras - Evangélica"
  ),
  `Otras cristianas` = c(
    "Adventista", "Dios es amor", "Iglesia Universal - Pare de Sufri",
    "Iglesia de la Unificación - Moon", "Mormones", "Pueblo de Dios",
    "Testigos de Jehova", "Otros grupos Pseudo-Cristianos", "Monte de Sión"
  ),
  `Indígena` = c(
    "Religión indígena", "Indígena + anglicana", "Indígena + evangélica",
    "Indígena + mennonita", "Indígena + otras religiones", "Indígena + católica"
  ),
  `Otras religiones` = c(
    "Judaismo", "Islamica - Musulmana", "Hinduismo(Tao)",
    "Espiritualistas - E.C.Basilio", "Fe Bahía", "Rosacruces", "Umbanda",
    "Otras, Espiritismo", "Budismo", "Reyukai", "Sintoismo",
    "Relig. no incluidas en las anteri", "Otra religión No Especificada",
    "Mentalistas(Meditación Transcende"
  ),
  `No tiene` = c("Sin religión"),
  `No informado` = c("No especificado")
)
# flat label -> group lookup
group_of <- unlist(lapply(names(recode_table), function(g) {
  setNames(rep(g, length(recode_table[[g]])), recode_table[[g]])
}))

# the five affiliated groups (the religious_affiliation slot); the no-religion group;
# and the non-response group (in the denominator, outside both slots).
affiliation_groups <- c("Católica", "Evangélicas", "Otras cristianas",
                        "Indígena", "Otras religiones")
no_religion_group <- "No tiene"      # REDATAM verbatim "Sin religión"
non_response_group <- "No informado" # REDATAM verbatim "No especificado"

# ---- department metadata (census code -> official name -> boundary key) -----
# the REDATAM AREA # is the official DGEEC department code (00 = Asunción capital
# district, 01-17 the departments). area_name carries the official accented name;
# boundary_key is the accent-free key used to join to the geoBoundaries shapeName.
department_meta <- list(
  "00" = list(name = "Asunción",          redatam = "ASUNCION",         boundary = "ASUNCION"),
  "01" = list(name = "Concepción",        redatam = "CONCEPCION",       boundary = "CONCEPCION"),
  "02" = list(name = "San Pedro",         redatam = "SAN PEDRO",        boundary = "SAN PEDRO"),
  "03" = list(name = "Cordillera",        redatam = "CORDILLERA",       boundary = "CORDILLERA"),
  "04" = list(name = "Guairá",            redatam = "GUAIRA",           boundary = "GUAIRA"),
  "05" = list(name = "Caaguazú",          redatam = "CAAGUAZU",         boundary = "CAAGUAZU"),
  "06" = list(name = "Caazapá",           redatam = "CAAZAPA",          boundary = "CAAZAPA"),
  "07" = list(name = "Itapúa",            redatam = "ITAPUA",           boundary = "ITAPUA"),
  "08" = list(name = "Misiones",          redatam = "MISIONES",         boundary = "MISIONES"),
  "09" = list(name = "Paraguarí",         redatam = "PARAGUARI",        boundary = "PARAGUARI"),
  "10" = list(name = "Alto Paraná",       redatam = "ALTO PARANA",      boundary = "ALTO PARANA"),
  "11" = list(name = "Central",           redatam = "CENTRAL",          boundary = "CENTRAL"),
  "12" = list(name = "Ñeembucú",          redatam = "NEEMBUCU",         boundary = "ÑEEMBUCU"),
  "13" = list(name = "Amambay",           redatam = "AMAMBAY",          boundary = "AMAMBAY"),
  "14" = list(name = "Canindeyú",         redatam = "CANINDEYU",        boundary = "CANINDEYU"),
  "15" = list(name = "Presidente Hayes",  redatam = "PRESIDENTE HAYES", boundary = "PRESIDENTE HAYES"),
  "16" = list(name = "Boquerón",          redatam = "BOQUERON",         boundary = "BOQUERON"),
  "17" = list(name = "Alto Paraguay",     redatam = "ALTO PARAGUAY",    boundary = "ALTO PARAGUAY")
)

# ---- small helpers ---------------------------------------------------------

require_file <- function(path) {
  if (!file.exists(path)) stop("missing required source: ", path, call. = FALSE)
}
sha256_file <- function(path) unname(tools::sha256sum(path))
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))

# reduce a name to an accent-free alphanumeric key for the boundary join.
normalise_key <- function(x) {
  key <- stri_trans_general(enc2utf8(x), "Latin-ASCII")
  gsub("[^a-z0-9]", "", tolower(key))
}

# named check-jsonschema invocation (pinned uv cache dirs match sibling builders).
validate_json_schema <- function(schema_path, instance_path) {
  base_uri <- paste0("file://",
    normalizePath(dirname(schema_path), winslash = "/", mustWork = TRUE), "/")
  status <- system2("uvx",
    c("check-jsonschema", "--base-uri", base_uri, "--schemafile", schema_path, instance_path),
    env = c(
      "UV_CACHE_DIR=/tmp/places-of-worship-uv/cache",
      "UV_TOOL_DIR=/tmp/places-of-worship-uv/tools",
      "UV_PYTHON_INSTALL_DIR=/tmp/places-of-worship-uv/python"
    ))
  if (!identical(status, 0L)) stop("schema validation failed for ", instance_path, call. = FALSE)
  invisible(instance_path)
}

# ---- parse the cached REDATAM cross-tab HTML -------------------------------
# the engine prints one block per department (headed "AREA # NN <NAME>") then a
# trailing all-country RESUMEN block (no AREA header). each data row is a detailed
# denomination label followed by three cells: Varón, Mujer, Total. counts use a
# thousands space (and "-" for zero). returns a long data frame of the 18 departments
# plus the parsed RESUMEN block for the cross-check.
parse_redatam <- function(path) {
  raw <- paste(readLines(path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  trs <- regmatches(raw, gregexpr("(?s)<tr>.*?</tr>", raw, perl = TRUE))[[1]]
  strip_cells <- function(tr) {
    tds <- regmatches(tr, gregexpr("(?s)<td[^>]*>.*?</td>", tr, perl = TRUE))[[1]]
    txt <- gsub("<[^>]+>", " ", tds)
    txt <- gsub("&nbsp;", " ", txt, fixed = TRUE)
    txt <- gsub("&oacute;", "ó", txt, fixed = TRUE); txt <- gsub("&aacute;", "á", txt, fixed = TRUE)
    txt <- gsub("&eacute;", "é", txt, fixed = TRUE); txt <- gsub("&iacute;", "í", txt, fixed = TRUE)
    txt <- gsub("&uacute;", "ú", txt, fixed = TRUE); txt <- gsub("&ntilde;", "ñ", txt, fixed = TRUE)
    txt <- gsub("&Ntilde;", "Ñ", txt, fixed = TRUE); txt <- gsub("&agrave;", "à", txt, fixed = TRUE)
    trimws(txt)
  }
  parse_num <- function(s) {
    s <- gsub("[ .]", "", s)
    if (s %in% c("-", "")) return(0L)
    as.integer(s)
  }
  header_labels <- c("Varón", "Mujer", "Total", "Religión que profesa", "Sexo", "")
  records <- list()
  cur_code <- NA_character_; cur_name <- NA_character_
  for (tr in trs) {
    cs <- strip_cells(tr)
    joined <- paste(cs, collapse = " ")
    m <- regexpr("AREA # (\\d+)", joined, perl = TRUE)
    if (m > 0) {
      code <- sub(".*AREA # (\\d+).*", "\\1", joined, perl = TRUE)
      idx <- which(grepl("AREA #", cs))
      nm <- NA_character_
      if (length(idx) > 0) {
        after <- cs[(idx[1] + 1):length(cs)]
        after <- after[nzchar(after)]
        if (length(after) > 0) nm <- after[1]
      }
      cur_code <- code; cur_name <- nm
      next
    }
    ne <- cs[nzchar(cs)]
    if (length(ne) >= 4 && !is.na(cur_code)) {
      label <- ne[1]
      if (label %in% header_labels) next
      tail3 <- ne[(length(ne) - 2):length(ne)]
      if (all(grepl("^[-0-9 .]+$", tail3))) {
        records[[length(records) + 1]] <- data.frame(
          area_code = cur_code, area_name_redatam = cur_name, label = label,
          varon = parse_num(tail3[1]), mujer = parse_num(tail3[2]),
          total = parse_num(tail3[3]), stringsAsFactors = FALSE
        )
      }
    }
  }
  df <- do.call(rbind, records)

  # split AREA 17: the real Alto Paraguay block runs until the second "Católica"
  # row; the run from the second "Católica" onward is the trailing all-country
  # RESUMEN block. this is deterministic (each real department lists every label
  # once, so a repeat only occurs where the RESUMEN is appended after AREA # 17).
  a17 <- df[df$area_code == "17", , drop = FALSE]
  cat_rows <- which(a17$label == "Católica")
  if (length(cat_rows) != 2L) {
    stop("expected exactly two 'Católica' rows in AREA # 17 (real block + RESUMEN); found ",
         length(cat_rows), call. = FALSE)
  }
  split_at <- cat_rows[2]
  alto_real <- a17[seq_len(split_at - 1L), , drop = FALSE]
  resumen <- a17[seq(split_at, nrow(a17)), , drop = FALSE]
  dept <- rbind(df[df$area_code != "17", , drop = FALSE], alto_real)
  list(dept = dept, resumen = resumen)
}

# ---- gates -----------------------------------------------------------------

# reproduce the probe's recorded Asunción first block exactly (Católica 375,726 by
# sex 170,855 / 204,871; Sin religión 6,606; Religión indígena 48; Ortodoxa 8; Rusa 32).
assert_probe_match <- function(dept) {
  asu <- dept[dept$area_code == "00", , drop = FALSE]
  get <- function(lab, col) {
    r <- asu[asu$label == lab, , drop = FALSE]
    if (nrow(r) != 1L) stop("probe-anchor label missing in Asunción: ", lab, call. = FALSE)
    r[[col]]
  }
  checks <- list(
    c(get("Católica", "total"), 375726), c(get("Católica", "varon"), 170855),
    c(get("Católica", "mujer"), 204871), c(get("Sin religión", "total"), 6606),
    c(get("Religión indígena", "total"), 48), c(get("Ortodoxa", "total"), 8),
    c(get("Rusa", "total"), 32)
  )
  for (ck in checks) {
    if (ck[1] != ck[2]) {
      stop("REDATAM output diverges from the recorded probe (Asunción): got ", ck[1],
           " expected ", ck[2], ". STOP: live query differs from the probe.", call. = FALSE)
    }
  }
  invisible(TRUE)
}

# every detailed label must map to exactly one P16 group; none unassigned.
assert_recode_complete <- function(dept) {
  labs <- unique(dept$label)
  unassigned <- setdiff(labs, names(group_of))
  if (length(unassigned) > 0) {
    stop("STOP: detailed REDATAM labels have no P16 group assignment (ambiguous, not guessed): ",
         paste(unassigned, collapse = "; "), call. = FALSE)
  }
  invisible(TRUE)
}

# cross-check: the REDATAM RESUMEN block equals the sum over the 18 departments,
# per detailed label. confirms the AREA # 17 split and the extraction's internal
# consistency. no count is altered.
assert_resumen_crosscheck <- function(dept, resumen) {
  dept_by_label <- tapply(dept$total, dept$label, sum)
  res_by_label <- tapply(resumen$total, resumen$label, sum)
  labs <- union(names(dept_by_label), names(res_by_label))
  mism <- character()
  for (l in labs) {
    a <- ifelse(is.na(dept_by_label[l]), 0L, dept_by_label[l])
    b <- ifelse(is.na(res_by_label[l]), 0L, res_by_label[l])
    if (a != b) mism <- c(mism, sprintf("%s (depts=%d, RESUMEN=%d)", l, a, b))
  }
  if (length(mism) > 0) {
    stop("STOP: department sums differ from the REDATAM RESUMEN block: ",
         paste(mism, collapse = "; "), call. = FALSE)
  }
  invisible(sum(dept$total))
}

# ---- build department group table ------------------------------------------
# recode each department's detailed counts to the seven P16 groups.
build_group_table <- function(dept) {
  dept$group <- group_of[dept$label]
  grp <- aggregate(total ~ area_code + group, data = dept, FUN = sum)
  # wide matrix: rows = department codes, columns = seven P16 groups (0 where absent)
  codes <- names(department_meta)
  mat <- matrix(0L, nrow = length(codes), ncol = length(p16_groups),
                dimnames = list(codes, p16_groups))
  for (i in seq_len(nrow(grp))) {
    mat[grp$area_code[i], grp$group[i]] <- as.integer(grp$total[i])
  }
  mat
}

# national reconciliation: recoded national group totals must equal P16 exactly.
assert_national_reconciliation <- function(mat) {
  recode_natl <- colSums(mat)[p16_groups]
  diffs <- recode_natl - p16_targets[p16_groups]
  if (any(diffs != 0L)) {
    detail <- paste(sprintf("%s: recode=%d P16=%d diff=%d", p16_groups,
                            recode_natl, p16_targets[p16_groups], diffs), collapse = "; ")
    stop("STOP: national reconciliation to P16 is not exact: ", detail,
         ". No count altered; build stopped.", call. = FALSE)
  }
  if (sum(recode_natl) != p16_total) {
    stop("STOP: recoded national total ", sum(recode_natl), " != P16 total ", p16_total, call. = FALSE)
  }
  as.list(recode_natl)
}

# per-department internal reconciliation: the seven groups must sum to the
# department's REDATAM total exactly (affiliation + no-religion + non-response).
assert_department_reconciliation <- function(mat, dept) {
  dept_total <- tapply(dept$total, dept$area_code, sum)
  for (code in rownames(mat)) {
    row_sum <- sum(mat[code, ])
    if (row_sum != dept_total[code]) {
      stop("STOP: department ", code, " seven-group sum ", row_sum,
           " != REDATAM department total ", dept_total[code], call. = FALSE)
    }
  }
  invisible(TRUE)
}

# ---- boundary --------------------------------------------------------------
# validate and simplify the 18-feature geoBoundaries PRY ADM1 layer; join to the
# census department codes by accent-free shapeName key; return the written layer,
# geodesic land areas by code, and geometry-validation detail.
build_boundary <- function() {
  boundary <- st_read(boundary_path, quiet = TRUE, stringsAsFactors = FALSE)
  if (nrow(boundary) != 18L) stop("expected 18 geoBoundaries PRY ADM1 features", call. = FALSE)
  boundary <- st_make_valid(boundary)
  validity <- st_is_valid(boundary)
  if (any(st_is_empty(boundary)) || any(is.na(validity)) || any(!validity)) {
    stop("source boundary contains empty or invalid geometries", call. = FALSE)
  }
  source_hashes <- vapply(st_as_binary(st_geometry(boundary), EWKB = TRUE), digest,
                          character(1), algo = "sha256", serialize = FALSE)
  if (anyDuplicated(source_hashes)) stop("source boundary contains duplicate geometries", call. = FALSE)

  # join: boundary shapeName -> accent-free key -> census department code.
  key_to_code <- setNames(names(department_meta),
                          vapply(department_meta, function(m) normalise_key(m$boundary), character(1)))
  boundary_keys <- vapply(boundary[["shapeName"]], normalise_key, character(1))
  if (!setequal(boundary_keys, names(key_to_code))) {
    stop("boundary shapeNames do not match the census department concordance 1:1", call. = FALSE)
  }
  boundary[["area_code"]] <- unname(key_to_code[boundary_keys])
  code_to_name <- vapply(department_meta, function(m) m$name, character(1))
  boundary[["area_name"]] <- unname(code_to_name[boundary[["area_code"]]])
  boundary[["area_unit_id"]] <- paste0(boundary_set_id, ":", boundary[["area_code"]])
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- "department"
  boundary <- boundary[, c("area_code", "area_name", "area_unit_id", "boundary_set_id",
                           "boundary_level")]
  boundary <- boundary[order(boundary[["area_code"]]), ]

  dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
  # 12 MB source; simplify topology-preserving to <= 3 MB (ladder descends as needed).
  simplification <- mapshaper_simplify_to_cap(
    boundary, boundary_output, max_bytes = 3000000L,
    keep_percentages = c(60, 40, 30, 20, 15, 10, 8, 6, 5, 4, 3),
    clean_option = "allow-overlaps"
  )
  written <- st_read(boundary_output, quiet = TRUE, stringsAsFactors = FALSE)
  written <- written[order(written[["area_code"]]), ]
  written_validity <- st_is_valid(written)
  written_hashes <- vapply(st_as_binary(st_geometry(written), EWKB = TRUE), digest,
                           character(1), algo = "sha256", serialize = FALSE)
  if (nrow(written) != 18L || any(st_is_empty(written)) || any(!written_validity) ||
      anyDuplicated(written_hashes) || file.info(boundary_output)[["size"]] > 3000000L) {
    stop("simplified boundary failed feature, validity, distinctness, or byte-cap gate", call. = FALSE)
  }
  land_area <- as.numeric(st_area(written)) / 1e6
  land_area_by_code <- setNames(round(land_area, 4), written[["area_code"]])
  # sanity band: Paraguay is about 406,752 km2; catch a crs or unit mistake.
  if (sum(land_area) < 380000 || sum(land_area) > 430000) {
    stop("total boundary land area is implausible; check the boundary crs", call. = FALSE)
  }
  list(
    written = written,
    land_area_by_code = land_area_by_code,
    total_land_area = round(sum(land_area), 2),
    simplification = simplification,
    source_geometry_sha256 = setNames(as.list(unname(source_hashes)), boundary[["area_code"]]),
    written_geometry_sha256 = setNames(as.list(unname(written_hashes)), written[["area_code"]]),
    output_bytes = file_bytes(boundary_output),
    distinct_written_hash_count = length(unique(written_hashes))
  )
}

# ---- run parse + gates -----------------------------------------------------

for (path in c(redatam_html, crucpob_form_html, boundary_path, boundary_meta_path)) {
  require_file(path)
}

parsed <- parse_redatam(redatam_html)
dept <- parsed$dept
resumen <- parsed$resumen

assert_probe_match(dept)
assert_recode_complete(dept)
resumen_grand <- assert_resumen_crosscheck(dept, resumen)
mat <- build_group_table(dept)
national_recode <- assert_national_reconciliation(mat)
assert_department_reconciliation(mat, dept)

boundary_result <- build_boundary()
land_area_by_code <- boundary_result[["land_area_by_code"]]

# ---- small-cell tokens -----------------------------------------------------
# small_denominator_under_100: the department's denominator (population aged 10+)
# under 100 persons. small_cell_under_10: any shipped seven-group category count
# under 10 (the small-cell rule's numerator marker; the count still renders exactly).
small_denominator_codes <- rownames(mat)[rowSums(mat) < 100L]
small_cell_codes <- rownames(mat)[apply(mat, 1, function(r) any(r < 10L))]
small_cell_detail <- lapply(small_cell_codes, function(code) {
  cells <- mat[code, ][mat[code, ] < 10L]
  list(area_code = code, area_name = department_meta[[code]]$name,
       cells = setNames(as.list(as.integer(cells)), names(cells)))
})

# ---- construct product rows ------------------------------------------------
population_basis_note <- paste(
  "Population aged 10 and over enumerated in the 2002 census (the religion question,",
  "'Religión que profesa', was asked only of persons 10+; national cuadro P16 universe",
  "'Población de 10 años y más de edad'). Counts extracted from the CELADE INE REDATAM",
  "Webserver (base CPV2002) cross-tabulation of religion by department; the detailed",
  "denomination list is recoded to the published P16 seven-group frame. The denominator",
  "includes the non-response group 'No informado' (REDATAM 'No especificado')."
)

product_rows <- lapply(names(department_meta), function(code) {
  meta <- department_meta[[code]]
  counts <- mat[code, ]
  denom <- as.integer(sum(counts))
  affiliation <- as.integer(sum(counts[affiliation_groups]))
  no_religion <- as.integer(counts[no_religion_group])
  non_response <- as.integer(counts[non_response_group])
  # composition: all seven P16 verbatim groups with their counts, published order.
  composition <- lapply(p16_groups, function(g) {
    list(label_verbatim = g, count = as.integer(counts[g]))
  })
  flags <- c(
    "census_affiliation_religion_que_profesa",
    "universe_population_aged_10_plus",
    "redatam_live_crosstab_recoded_to_p16_seven_groups",
    "national_reconciliation_exact_per_group",
    "single_wave_2002",
    "religious_change_withheld",
    "no_religion_group_sin_religion_p16_no_tiene",
    "non_response_no_informado_no_especificado_inside_denominator_outside_slots",
    "boundary_geoboundaries_adm1_ccby40"
  )
  if (code %in% small_denominator_codes) flags <- c(flags, "small_denominator_under_100")
  if (code %in% small_cell_codes) flags <- c(flags, "small_cell_under_10")
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = "department",
    area_unit_id = paste0(boundary_set_id, ":", code),
    area_code = code,
    area_name = meta$name,
    year = wave_year,
    population_total = denom,
    population_total_basis = population_basis_note,
    religious_affiliation_count = affiliation,
    religious_affiliation_percent = round(100 * affiliation / denom, 4),
    no_religion_count = no_religion,
    no_religion_percent = round(100 * no_religion / denom, 4),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = unname(land_area_by_code[[code]]),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(dataset_id_census, dataset_id_boundary),
    quality_flag = paste(flags, collapse = ";"),
    composition = composition
  )
})

if (length(product_rows) != 18L) stop("expected 18 department rows", call. = FALSE)

# ---- source datasets, indicators, visual layers ----------------------------

licence_grant_verbatim <- paste(
  "Licencia de Uso de la Información y los Datos Abiertos Públicos propiedad del Estado",
  "Paraguayo (Decreto 4064 - Ley Nro. 5282/2014). Otorga la autorización gratuita,",
  "perpetua y no exclusiva de uso y/o transformación (copia, extracción, reproducción,",
  "distribución, comunicación pública, adaptación, transformación) con las condiciones:",
  "citar la fuente pública; citar la fecha de última actualización; no sugerir un uso",
  "oficial o patrocinado por el Estado Paraguayo."
)

source_datasets <- list(
  list(
    source_dataset_id = dataset_id_census,
    name = "INE Paraguay CPV2002 REDATAM cross-tabulation: Religión que profesa by Departamento",
    provider = "Instituto Nacional de Estadística (INE), Paraguay (DGEEC-era census); CELADE/CEPAL REDATAM Webserver",
    url = url_crosstab,
    retrieval_date = retrieval_date,
    local_path = redatam_html,
    licence = list(
      name = "Paraguay open-data licence (Decreto 4064 / Ley 5282/2014); extracción and transformación authorised with attribution",
      url = url_licence,
      attribution = "Fuente: INE Paraguay, Censo Nacional de Población y Viviendas 2002; contenido regido por la Licencia de Uso de la Información Pública (Decreto 4064 / Ley 5282/2014). No es un producto oficial ni patrocinado por el Estado Paraguayo."
    ),
    citation = paste(
      "INE Paraguay, Censo Nacional de Población y Viviendas 2002; department-grain",
      "religion cross-tabulation via the CELADE-hosted REDATAM Webserver (base CPV2002,",
      "variable 'Religión que profesa', break Departamento). National frame: cuadro P16."
    ),
    access_limits = "Public online processing (CELADE REDATAM Webserver); results generated on demand.",
    redistribution_limits = paste(
      "Open reuse under the Paraguay open-data licence.", licence_grant_verbatim
    ),
    notes = paste(
      "Live cross-tab; the engine output is cached and sha-256-pinned, and the exact query",
      "parameters are recorded in the manifest (base CPV2002, ITEM CRUCPOB, ROW",
      "PERSONA.religion, COLUMN PERSONA.sexo, AREABREAK DEPTO, SELECTION ALL). The detailed",
      "denomination list is recoded to the P16 seven groups; all seven national group totals",
      "reconcile to P16 exactly (total 3,892,603)."
    )
  ),
  list(
    source_dataset_id = dataset_id_boundary,
    name = "geoBoundaries Paraguay ADM1 (18 units: 17 departments + Asunción)",
    provider = "geoBoundaries (William & Mary geoLab); sourced from DGEEC",
    url = url_boundary,
    retrieval_date = retrieval_date,
    local_path = boundary_path,
    licence = list(
      name = "Creative Commons Attribution 4.0 International (CC BY 4.0)",
      url = "https://creativecommons.org/licenses/by/4.0/",
      attribution = "geoBoundaries (gbOpen) PRY ADM1; boundary ID PRY-ADM1-63826900; source DGEEC"
    ),
    citation = paste(
      "Runfola, D. et al. (2020) geoBoundaries: A global database of political administrative",
      "boundaries. gbOpen PRY ADM1 (pinned commit 9469f09)."
    ),
    access_limits = NULL,
    redistribution_limits = "CC BY 4.0 permits redistribution and derivatives with attribution.",
    notes = "18 ADM1 units; release metadata: boundaryID PRY-ADM1-63826900, CC BY 4.0, source DGEEC, admUnitCount 18, represented year 2012."
  )
)

spatial_note <- "17 departments plus the Asunción capital district (18 units) on the geoBoundaries PRY ADM1 layer; the census frame joins the boundary units one-to-one by department name."

indicators <- list(
  list(
    indicator_id = "religious_affiliation_percent",
    label = "Religious affiliation (%)",
    description = "Share of the population aged 10+ affiliated with any religion (P16 groups Católica, Evangélicas, Otras cristianas, Indígena, Otras religiones).",
    unit = "percent",
    denominator_indicator_id = "population_total",
    method = paste(
      "Sum of the five affiliated P16 group counts over the department's population aged",
      "10+ (all responses, including the 'No informado' non-response group). Detailed",
      "REDATAM denominations recoded to the P16 seven-group frame; counts as extracted."
    ),
    temporal_coverage = "2002",
    spatial_coverage = spatial_note,
    quality_notes = paste(
      "Universe: population aged 10+ (the religion question was asked only of persons 10+).",
      "The seven recoded national group totals equal the published P16 totals exactly. The",
      "Indígena group is a small cell (0-1 persons) in four central departments."
    )
  ),
  list(
    indicator_id = "no_religion_percent",
    label = "No religion (%)",
    description = "Share of the population aged 10+ reporting no religion (P16 'No tiene'; REDATAM 'Sin religión').",
    unit = "percent",
    denominator_indicator_id = "population_total",
    method = "The 'Sin religión' (P16 'No tiene') count over the department's population aged 10+.",
    temporal_coverage = "2002",
    spatial_coverage = spatial_note,
    quality_notes = "No religion is a real non-affiliation category inside the denominator and outside the affiliation slot; distinct from the 'No informado' non-response group, which stays in the denominator and outside both slots."
  ),
  list(
    indicator_id = "population_total",
    label = "Population aged 10+ (religion universe)",
    description = "Population aged 10 and over enumerated in the 2002 census, the religion-question universe and the share denominator.",
    unit = "count",
    denominator_indicator_id = NULL,
    method = "Sum of the seven P16 group counts per department from the REDATAM cross-tabulation.",
    temporal_coverage = "2002",
    spatial_coverage = spatial_note,
    quality_notes = "Departments sum to the national P16 total of 3,892,603 exactly."
  )
)

visual_layers <- list(
  list(
    visual_layer_id = "py-department-religious-affiliation-share",
    label = "Religious affiliation share",
    description = "Census religious affiliation share by department, 2002.",
    layer_type = "choropleth",
    indicator_ids = list("religious_affiliation_percent"),
    geometry_unit_type = "area_unit",
    legend = list(unit = "percent", denominator = "population aged 10+"),
    colour_scale = "sequential",
    time_control = "year_selector",
    aggregation_rule = "published department value on the geoBoundaries ADM1 layer",
    uncertainty_display = "quality_flag",
    default_visibility = TRUE,
    notes = "Catholic-majority nationally (89.6%); the Boquerón and Presidente Hayes Chaco departments carry the largest Evangelical and Mennonite shares."
  ),
  list(
    visual_layer_id = "py-department-no-religion-share",
    label = "No religion share",
    description = "Census no-religion share by department, 2002.",
    layer_type = "choropleth",
    indicator_ids = list("no_religion_percent"),
    geometry_unit_type = "area_unit",
    legend = list(unit = "percent", denominator = "population aged 10+"),
    colour_scale = "sequential",
    time_control = "year_selector",
    aggregation_rule = "published department value on the geoBoundaries ADM1 layer",
    uncertainty_display = "quality_flag",
    default_visibility = FALSE,
    notes = "Single wave; no cross-wave change layer (department religion is available for 2002 only)."
  )
)

area_summary <- list(
  schema_version = "area-summary.v2",
  generated_at = stamp,
  generated_by = script_id,
  country_code = country_code,
  data_status = "census_religion_live",
  data_status_note = paste(
    "Census religious affiliation is live for the 18 first-level units (17 departments +",
    "Asunción) in 2002, from the CELADE INE REDATAM Webserver (base CPV2002) cross-tab of",
    "'Religión que profesa' by Departamento, recoded to the published P16 seven-group frame.",
    "Single wave: the 2012 and 2022 censuses carry no religion variable, and 1992 is not in",
    "REDATAM, so no cross-wave change is possible."
  ),
  boundary_set = list(
    boundary_set_id = boundary_set_id,
    country_code = country_code,
    level = "department",
    vintage = "geoBoundaries PRY ADM1 (gbOpen); 18 units, DGEEC-sourced",
    source_dataset_id = dataset_id_boundary
  ),
  site_snapshot = list(
    source_dataset_id = NULL,
    snapshot_date = NULL,
    basis = "no governed Paraguay place-of-worship snapshot is included in this census-religion release",
    notes = "The Paraguay lane ships census-religion count and share metrics only; place metrics are null."
  ),
  source_datasets = source_datasets,
  indicators = indicators,
  visual_layers = visual_layers,
  rows = product_rows
)

dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)
write_json(area_summary, summary_output, auto_unbox = TRUE, pretty = TRUE, null = "null", digits = NA)

# flat CSV companion (no composition; slot counts and shares only)
csv_df <- do.call(rbind, lapply(product_rows, function(r) {
  data.frame(
    country_code = r$country_code, boundary_set_id = r$boundary_set_id,
    boundary_level = r$boundary_level, area_unit_id = r$area_unit_id,
    area_code = r$area_code, area_name = r$area_name, year = r$year,
    population_total = r$population_total, population_total_basis = r$population_total_basis,
    religious_affiliation_count = r$religious_affiliation_count,
    religious_affiliation_percent = r$religious_affiliation_percent,
    no_religion_count = r$no_religion_count, no_religion_percent = r$no_religion_percent,
    place_count = NA_integer_, places_per_10000_residents = NA_real_,
    place_density_per_sq_km = NA_real_, land_area_sq_km = r$land_area_sq_km,
    site_snapshot_date = NA_character_, place_count_basis = NA_character_,
    source_dataset_ids = paste(unlist(r$source_dataset_ids), collapse = "|"),
    quality_flag = r$quality_flag, stringsAsFactors = FALSE
  )
}))
utils::write.csv(csv_df, summary_csv_output, row.names = FALSE, na = "")

if (!jsonlite::validate(readChar(summary_output, file_bytes(summary_output), useBytes = TRUE))) {
  stop("area-summary output failed JSON syntax validation", call. = FALSE)
}
validate_json_schema("schemas/area-summary.v2.schema.json", summary_output)

# ---- manifest --------------------------------------------------------------

raw_source_record <- function(path, url, content) {
  list(local_path = path, url = url, content = content, retrieval_date = retrieval_date,
       bytes = file_bytes(path), sha256 = sha256_file(path))
}
raw_sources <- list(
  raw_source_record(redatam_html, url_crosstab,
    "REDATAM CPV2002 cross-tab output: Religión que profesa by Departamento, by sex (18 department blocks + all-country RESUMEN)"),
  raw_source_record(crucpob_form_html, url_crosstab,
    "REDATAM CPV2002 cross-tab query form (CRUCPOB): variable list and control names (query-parameter provenance)"),
  raw_source_record(boundary_path, url_boundary, "geoBoundaries PRY ADM1 source GeoJSON (18 units)"),
  raw_source_record(boundary_meta_path, url_boundary_meta, "geoBoundaries PRY ADM1 release metadata (CC BY 4.0, DGEEC source)")
)

output_paths <- c(summary_output, summary_csv_output, boundary_output)
output_hashes <- vapply(output_paths, sha256_file, character(1))
raw_hashes <- vapply(raw_sources, `[[`, character(1), "sha256")
combined <- paste(c(raw_hashes, output_hashes), collapse = "")
version_hash <- substr(digest(combined, algo = "sha256", serialize = FALSE), 1L, 12L)
git_commit <- tryCatch({
  value <- trimws(system2("git", c("rev-parse", "--short", "HEAD"), stdout = TRUE, stderr = TRUE))
  if (length(value) == 1L && grepl("^[a-f0-9]{7,40}$", value)) value else NULL
}, error = function(e) NULL)

durable_file_record <- function(path, content, licence_basis, licence_status,
                                row_count = NULL, feature_count = NULL) {
  record <- list(
    uri = paste0("repo:", path), storage_provider = "git_repository",
    format = sub("^.*\\.", "", path), bytes = file_bytes(path), sha256 = sha256_file(path),
    content = content, privacy = "public", licence_status = licence_status, licence_basis = licence_basis)
  if (!is.null(row_count)) record[["row_count"]] <- as.integer(row_count)
  if (!is.null(feature_count)) record[["feature_count"]] <- as.integer(feature_count)
  record
}

# full recode table for the manifest: detailed label -> P16 group, with the national
# detailed count (from the 18 departments) for auditability.
dept_by_label <- tapply(dept$total, dept$label, sum)
recode_manifest <- lapply(names(recode_table), function(g) {
  list(p16_group = g,
       detailed_labels = lapply(recode_table[[g]], function(l)
         list(label = l, national_count = as.integer(ifelse(is.na(dept_by_label[l]), 0L, dept_by_label[l])))),
       group_national_count = as.integer(national_recode[[g]]),
       p16_published_total = as.integer(p16_targets[[g]]))
})

small_cell_manifest <- list(
  rule = "docs/development/small-cell-rule.md",
  small_denominator_under_100 = list(
    threshold = 100L,
    basis = "department population aged 10+ (the metric denominator)",
    row_count = length(small_denominator_codes),
    rows = as.list(small_denominator_codes)
  ),
  small_cell_under_10 = list(
    threshold = 10L,
    basis = "any shipped P16 seven-group category count under 10 (count renders exactly; marker flags fragility)",
    row_count = length(small_cell_codes),
    rows = small_cell_detail,
    note = "All small cells fall on the Indígena group in central departments (Cordillera 1, Misiones 0, Paraguarí 0, Ñeembucú 1); zero and single-person cells render exactly, none suppressed."
  )
)

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = paste0("manifest:py-census-religion:py:2002:", version_hash),
  dataset_id = "py-census-religion:py:2002:redatam-geoboundaries",
  dataset_version_id = paste0("py-census-religion:py:2002:redatam-geoboundaries:", version_hash),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "py-census-religion",
  dataset_role = "public_product",
  scope = list(level = "country", country_codes = list("PY"), snapshot_date = NULL, pipeline_stage = "staged"),
  created_at = stamp,
  created_by = script_id,
  target_years = list(2002L),
  pipeline = list(
    script = script_id,
    git_commit = git_commit,
    command = paste("Rscript", script_id),
    parameters = list(
      wave = list(
        year = 2002L,
        construct = "census religion (Religión que profesa), counts by department, recoded to the P16 seven-group frame",
        geography = "17 departments + Asunción capital district (18 units)",
        universe = "population aged 10 and over (P16 universe 'Población de 10 años y más de edad'; religion asked only of persons 10+)",
        denominator = "population aged 10+ (all responses, including the 'No informado' non-response group)",
        national_frame = "cuadro P16 (Total País), seven groups, aged 10+",
        gate = "seven recoded national group totals equal P16 exactly; each department's seven groups sum to its REDATAM total exactly; RESUMEN cross-check exact"
      ),
      redatam_query = redatam_query,
      redatam_route_note = paste(
        "Live cross-tab against the CELADE-hosted INE REDATAM Webserver, accepted under the",
        "StatsBank/DATAcube official-dissemination ruling (queue row 95). POST to",
        "RpWebStats.exe/CrossTab with the parameters in redatam_query; the engine returns a",
        "wrapper page whose iframe references a generated tempo table. The table HTML is cached",
        "(raw_sources) and sha-256-pinned, so the build is deterministic from the cache."
      ),
      recode = list(
        frame = "P16 seven groups: Católica, Evangélicas, Otras cristianas, Indígena, Otras religiones, No tiene, No informado",
        detailed_label_count = length(unique(dept$label)),
        forced_assignments = list(
          orthodox_to_catolica = "Ortodoxa (25) + Rusa (470) + Otras - Ortodoxa (950) = 1,445 fall under Católica, not Otras cristianas; this is exactly P16 Católica (3,489,531) minus REDATAM 'Católica' (3,488,086). The census groups the apostolic/orthodox churches with Católica.",
          monte_de_sion_to_otras_cristianas = "Monte de Sión (233) falls under Otras cristianas, not Evangélicas.",
          indigena_mixed_to_indigena = "All 'Indígena + X' mixed labels (anglicana, evangélica, mennonita, otras religiones, católica) fall under Indígena; their sum with 'Religión indígena' is exactly P16 Indígena (25,219)."
        ),
        no_religion_group = "No tiene (REDATAM verbatim 'Sin religión')",
        non_response_group = "No informado (REDATAM verbatim 'No especificado'); inside the denominator, outside both slots",
        table = recode_manifest
      ),
      national_reconciliation = list(
        p16_total = p16_total,
        p16_targets = as.list(p16_targets),
        recode_national = national_recode,
        resumen_grand_total = as.integer(resumen_grand),
        status = "All seven recoded national group totals equal the published P16 totals exactly; recoded total 3,892,603 = P16 total; the REDATAM RESUMEN block equals the sum over the 18 departments per detailed label. No count was altered."
      ),
      probe_anchor = list(
        source = "research/countries/py/route-probe.md",
        asuncion_catolica_total = 375726L, asuncion_catolica_varon = 170855L,
        asuncion_catolica_mujer = 204871L, asuncion_sin_religion = 6606L,
        asuncion_religion_indigena = 48L, asuncion_ortodoxa = 8L, asuncion_rusa = 32L,
        status = "Re-run reproduces the probe's recorded Asunción first block exactly."
      ),
      small_cell = small_cell_manifest,
      change_metric = list(
        status = "withheld",
        rationale = "Department religion is available for 2002 only (2012/2022 censuses carry no religion variable; 1992 is not in REDATAM). No cross-wave change is possible."
      ),
      boundary = list(
        boundary_set_id = boundary_set_id,
        source = "geoBoundaries PRY ADM1 (gbOpen), boundaryID PRY-ADM1-63826900, CC BY 4.0, source DGEEC",
        features = 18L,
        total_land_area_sq_km = boundary_result[["total_land_area"]],
        output_bytes = boundary_result[["output_bytes"]],
        distinct_written_geometry_hashes = boundary_result[["distinct_written_hash_count"]],
        join = "area_code via accent-free shapeName key (18/18, one-to-one; ÑEEMBUCU<->NEEMBUCU by accent handling)",
        simplification = c(boundary_result[["simplification"]],
                           list(byte_ceiling = 3000000L, helper = "scripts/lib/simplify_boundary.R")),
        source_geometry_sha256 = boundary_result[["source_geometry_sha256"]],
        written_geometry_sha256 = boundary_result[["written_geometry_sha256"]]
      ),
      licence_position = list(
        status = "accepted",
        basis = "paraguay_open_data_licence_ley_5282_2014",
        grant_verbatim = licence_grant_verbatim,
        boundary_licence = "geoBoundaries PRY ADM1: CC BY 4.0 (source DGEEC)",
        attribution = "Fuente: INE Paraguay, Censo Nacional de Población y Viviendas 2002; contenido regido por la Licencia de Uso de la Información Pública (Decreto 4064 / Ley 5282/2014); no es un producto oficial ni patrocinado por el Estado Paraguayo.",
        summary = "Paraguay's open-data licence (Decreto 4064 / Ley 5282/2014) explicitly authorises extracción and transformación with attribution; the REDATAM extraction sits inside the grant. Boundary CC BY 4.0."
      ),
      raw_sources = raw_sources,
      local_cache_hint = "data/raw/py_census/ (git-ignored; every cached source listed with URL, bytes, and SHA-256).",
      raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/py_census/")
    ),
    software_versions = list(
      R = paste(R.version$major, R.version$minor, sep = "."),
      sf = as.character(utils::packageVersion("sf")),
      stringi = as.character(utils::packageVersion("stringi")),
      jsonlite = as.character(utils::packageVersion("jsonlite")),
      digest = as.character(utils::packageVersion("digest"))
    )
  ),
  source = list(
    provider = "Instituto Nacional de Estadística (INE), Paraguay; CELADE/CEPAL REDATAM; geoBoundaries (William & Mary geoLab)",
    source_dataset_ids = list(dataset_id_census, dataset_id_boundary),
    source_urls = list(url_portal, url_crosstab, url_licence, url_boundary, url_boundary_meta),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = "Census: Paraguay open-data licence (Decreto 4064 / Ley 5282/2014), accepted. Boundary: CC BY 4.0.",
    raw_redistribution = "REDATAM output is a public online-processing result; boundary is an open web source; intended durable mirror gs://pow-research-data/raw_sources/py_census/.",
    citation = "INE Paraguay CPV2002 (REDATAM, religion by department; national frame cuadro P16); geoBoundaries PRY ADM1 (CC BY 4.0).",
    local_cache_hint = "data/raw/py_census/ (git-ignored).",
    raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/py_census/")
  ),
  input_manifests = list(),
  deferred_sources = list(
    list(layer = "1992 wave", status = "documented non-route",
         note = "The 1992 census is not offered in the REDATAM Webserver and no departmental 1992 religion table was located on INE; not extractable."),
    list(layer = "2012 / 2022 waves", status = "documented non-route",
         note = "The 2012 and 2022 censuses carry no religion variable (REDATAM CPV2022 'relig' search returns no results); no later wave is possible."),
    list(layer = "district (distrito) grain", status = "available, not built",
         note = "REDATAM offers 'Quiebre de Area = Distrito'; a district product would bite the small-cell rule hard on the detailed frame. Department grain is shipped for this lane.")
  ),
  durable_files = list(
    durable_file_record(summary_output, "Paraguay single-wave department census-religion area-summary JSON (v2, seven-group composition)",
                        "paraguay_open_data_licence_ley_5282_2014", "accepted", row_count = 18L),
    durable_file_record(summary_csv_output, "Paraguay single-wave department census-religion area-summary CSV",
                        "paraguay_open_data_licence_ley_5282_2014", "accepted", row_count = 18L),
    durable_file_record(boundary_output, "Paraguay department boundary (geoBoundaries PRY ADM1, 18 units)",
                        "cc_by_4_0", "accepted", feature_count = 18L)
  ),
  partitions = list(
    list(partition_id = "py-department-2002", partition_type = "area",
         file_uri = paste0("repo:", summary_output), sha256 = sha256_file(summary_output),
         country_code = "PY", row_count = 18L, stage = "staged")
  ),
  stats = list(
    waves = 1L, years = "2002", department_rows = 18L, departments_per_wave = 18L,
    p16_groups = 7L, detailed_labels = length(unique(dept$label)), boundary_features = 18L,
    national_total = p16_total,
    small_denominator_under_100_rows = length(small_denominator_codes),
    small_cell_under_10_rows = length(small_cell_codes)
  ),
  local_cache_hint = "data/raw/py_census/ (git-ignored; every cached source listed with URL, bytes, and SHA-256).",
  validation = list(
    status = "passed",
    commands = list(
      paste("Rscript", script_id),
      paste("uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile",
            "schemas/area-summary.v2.schema.json", summary_output),
      paste("uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile",
            "schemas/data-manifest.schema.json", manifest_output),
      "bash scripts/validate_area_summaries.sh",
      "bash scripts/validate_manifests.sh"
    ),
    warnings = list(
      "Single wave (2002), department level; no cross-wave change (2012/2022 carry no religion variable; 1992 not in REDATAM).",
      "The Indígena group is a small cell (0-1 persons) in four central departments (Cordillera, Misiones, Paraguarí, Ñeembucú); small_cell_under_10 flags those rows. Counts render exactly.",
      "Live REDATAM query: the cached engine output is sha-256-pinned; the exact query parameters are recorded for parametric reproducibility."
    ),
    notes = paste(
      "Re-run reproduces the probe's Asunción first block exactly. The seven recoded national",
      "group totals equal the published P16 totals exactly (total 3,892,603); each department's",
      "seven groups sum to its REDATAM total exactly; the REDATAM RESUMEN block cross-checks",
      "against the 18-department sums. Boundary output has 18 valid, non-empty, distinctly",
      "hashed geometries within the 3 MB cap. Area-summary (v2) and manifest pass schema validation."
    )
  ),
  privacy = "public",
  licence_status = "accepted",
  licence_basis = "paraguay_open_data_licence_ley_5282_2014",
  downstream_status = "staged",
  notes = paste(
    "Single-wave (2002) 18-unit (17 departments + Asunción) census-religion product; counts by",
    "the P16 seven-group frame with per-row seven-group composition, recoded from the CELADE INE",
    "REDATAM live cross-tab and reconciled to the national P16 totals exactly. Ships STAGED (no",
    "page, no hub link). Census reuse accepted under the Paraguay open-data licence; boundary CC BY 4.0."
  )
)

write_json(manifest, manifest_output, auto_unbox = TRUE, pretty = TRUE, null = "null", digits = NA)

if (!jsonlite::validate(readChar(manifest_output, file_bytes(manifest_output), useBytes = TRUE))) {
  stop("manifest output is not valid JSON", call. = FALSE)
}
validate_json_schema("schemas/data-manifest.schema.json", manifest_output)

message(
  "built Paraguay department census-religion product: ", length(product_rows),
  " department rows for 2002; boundary ", boundary_result[["output_bytes"]],
  " bytes, ", boundary_result[["total_land_area"]], " km2; national reconciliation exact",
  " (total ", p16_total, "); small_cell_under_10 rows ", length(small_cell_codes), "; accepted."
)
