# build the Burkina Faso census-affiliation regional product from INSD PDFs.
#
# the builder is intentionally fail-fast. the 2006 exact-count table passes
# every regional reconciliation gate. five rows in the 2019 published percentage table
# sum to 99.9 or 100.1 against the printed 100.0 total, so the current source
# fails the every-row gate before any public product, manifest, or simplified
# boundary is written. the exact gate stands until the pi rules on a derived
# rounding bound for one-decimal percent tables (estonia precedent: bounds
# derived from the source's own rounding, never arbitrary tolerances).

suppressMessages({
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

raw_dir <- "data/raw/bf_census"
output_dir <- "apps/regions/bf/data"
manifest_dir <- "docs/manifests"

pdf_2006 <- file.path(raw_dir, "bf_2006_theme2_etat_structure.pdf")
pdf_2019 <- file.path(raw_dir, "bf_2019_resultats_definitifs.pdf")
boundary_path <- file.path(raw_dir, "geoBoundaries-BFA-ADM1.geojson")
boundary_metadata_path <- file.path(raw_dir, "gb_bfa_adm1_meta.json")

boundary_set_id <- "bf-region-2017-geoboundaries-adm1"
boundary_output <- file.path(output_dir, "bf_region_2017.geojson")
summary_output <- file.path(output_dir, "area_summary_region.json")
summary_csv_output <- file.path(output_dir, "area_summary_region.csv")
manifest_output <- file.path(manifest_dir, "bf-census-religion-2006-2019.json")

# stop when a required cached source is absent.
require_file <- function(path) {
  if (!file.exists(path)) stop("missing required source: ", path, call. = FALSE)
}

# run poppler's layout-preserving extractor and return its lines.
pdf_layout_lines <- function(path) {
  pdftotext <- Sys.which("pdftotext")
  if (!nzchar(pdftotext)) stop("pdftotext (Poppler) is required", call. = FALSE)
  output <- tempfile(fileext = ".txt")
  on.exit(unlink(output), add = TRUE)
  status <- system2(pdftotext, c("-layout", shQuote(path), shQuote(output)))
  if (status != 0L) stop("pdftotext failed on ", path, call. = FALSE)
  readLines(output, warn = FALSE)
}

# normalise source text for exact row-presence assertions without changing digits.
normalise_source_text <- function(lines) {
  text <- paste(lines, collapse = "\n")
  text <- gsub("Boucle du\\s*\\n\\s*Mouhoun", "Boucle du Mouhoun", text)
  text <- gsub("[[:space:]]+", " ", text)
  trimws(text)
}

# format an integer with the source's French thousands grouping.
source_integer <- function(value) {
  format(as.integer(value), big.mark = " ", scientific = FALSE, trim = TRUE)
}

# format a one-decimal source percentage with a decimal comma.
source_percent <- function(value) {
  sub("\\.", ",", sprintf("%.1f", value), fixed = FALSE)
}

# require the cached PDF text to contain every transcribed row in source order.
assert_transcription_present <- function(source_text, rows, value_columns, formatter) {
  for (i in seq_len(nrow(rows))) {
    pieces <- c(rows[["source_name"]][i], vapply(
      rows[i, value_columns, drop = FALSE], formatter, character(1)
    ))
    pattern <- paste(vapply(pieces, function(x) {
      gsub(" ", "[[:space:]]+", x, fixed = TRUE)
    }, character(1)), collapse = "[[:space:]]+")
    if (!grepl(pattern, source_text, perl = TRUE)) {
      stop("transcribed row not found in pdftotext output: ", rows[["source_name"]][i], call. = FALSE)
    }
  }
}

# return the exact-count 2006 regional table transcribed from Table A5.5.
table_2006 <- function() {
  data.frame(
    source_name = c(
      "Boucle du Mouhoun", "Cascades", "Centre", "Centre-est", "Centre-nord",
      "Centre-ouest", "Centre-sud", "Est", "Hauts-bassins", "Nord",
      "Plateau central", "Sahel", "Sud-ouest", "Total"
    ),
    animiste = c(215991, 75355, 13193, 56869, 284058, 239960, 116393, 371710, 160726, 120129, 76937, 16274, 402714, 2150309),
    musulman = c(896957, 407112, 966141, 808210, 717072, 476872, 311781, 462538, 1061969, 946920, 415321, 933964, 80292, 8485149),
    catholique = c(255349, 35826, 625034, 240034, 167530, 374447, 173202, 217480, 192201, 90691, 176316, 6328, 109798, 2664236),
    protestant = c(64220, 6961, 104412, 20102, 26621, 80374, 35465, 135417, 39867, 23214, 23462, 4779, 20260, 585154),
    autre = c(5755, 2776, 16887, 4713, 4980, 6541, 3220, 8999, 8245, 4253, 3693, 5877, 3546, 79485),
    sans_religion = c(4477, 3778, 1723, 2088, 1764, 8372, 1382, 16140, 6596, 589, 643, 1220, 4157, 52929),
    printed_total = c(1442749, 531808, 1727390, 1132016, 1202025, 1186566, 641443, 1212284, 1469604, 1185796, 696372, 968442, 620767, 14017262),
    stringsAsFactors = FALSE
  )
}

# return the rounded-percentage 2019 regional table transcribed from Table 10.
table_2019 <- function() {
  data.frame(
    source_name = c(
      "Boucle du Mouhoun", "Cascades", "Centre", "Centre-Est", "Centre-Nord",
      "Centre-Ouest", "Centre-Sud", "Est", "Hauts-Bassins", "Nord",
      "Plateau Central", "Sahel", "Sud-Ouest", "Burkina Faso"
    ),
    animiste = c(9.5, 8.5, 0.3, 1.7, 13.8, 8.9, 7.6, 20.3, 6.4, 6.0, 4.1, 0.5, 48.1, 9.0),
    musulman = c(64.9, 81.5, 61.2, 77.2, 67.3, 45.8, 54.2, 34.6, 76.2, 82.6, 66.1, 97.3, 19.5, 63.8),
    catholique = c(18.6, 6.1, 31.3, 19.0, 15.6, 35.7, 28.9, 22.3, 12.3, 8.4, 25.6, 1.0, 23.1, 20.1),
    protestant = c(6.0, 1.7, 6.9, 1.9, 3.1, 8.5, 8.9, 21.0, 3.9, 2.7, 4.1, 0.7, 7.0, 6.2),
    autre = c(0.2, 0.2, 0.2, 0.1, 0.0, 0.2, 0.2, 0.4, 0.2, 0.0, 0.0, 0.0, 0.4, 0.2),
    sans_religion = c(0.8, 1.9, 0.1, 0.2, 0.2, 0.9, 0.3, 1.4, 1.0, 0.3, 0.1, 0.4, 2.0, 0.7),
    printed_percent_total = rep(100.0, 14),
    collected_basis = c(1762184, 764449, 2693142, 1428228, 1424407, 1562563, 744260, 1579001, 2046976, 1582564, 922488, 836374, 825202, 18171838),
    full_resident_total = c(1901269, 812466, 3030384, 1580508, 1874669, 1660135, 788731, 1942805, 2239840, 1722115, 978614, 1098177, 875442, 20505155),
    stringsAsFactors = FALSE
  )
}

# stop unless every row's mutually exclusive categories equal its printed total.
assert_exact_row_reconciliation <- function(rows, categories, total_column, wave) {
  calculated <- rowSums(rows[, categories, drop = FALSE])
  difference <- round(calculated - rows[[total_column]], 10)
  failed <- which(difference != 0)
  if (length(failed) > 0L) {
    details <- paste0(
      rows[["source_name"]][failed], " (category sum=", sprintf("%.1f", calculated[failed]),
      ", printed total=", sprintf("%.1f", rows[[total_column]][failed]),
      ", difference=", sprintf("%+.1f", difference[failed]), ")"
    )
    stop(
      wave, " every-row reconciliation failed: ", paste(details, collapse = "; "),
      ". no value was allocated, rounded, or tuned; product writing stopped.",
      call. = FALSE
    )
  }
  invisible(TRUE)
}

# stop unless regional exact counts reproduce every national category total.
assert_2006_local_to_national <- function(rows, categories) {
  local <- rows[rows[["source_name"]] != "Total", , drop = FALSE]
  national <- rows[rows[["source_name"]] == "Total", , drop = FALSE]
  differences <- colSums(local[, c(categories, "printed_total"), drop = FALSE]) -
    unlist(national[1, c(categories, "printed_total"), drop = FALSE], use.names = FALSE)
  if (any(differences != 0)) {
    stop("2006 regional counts do not reproduce the national row exactly", call. = FALSE)
  }
  invisible(TRUE)
}

# stop unless the 2019 regional collected bases and full totals match national rows.
assert_2019_population_reconciliation <- function(rows) {
  local <- rows[rows[["source_name"]] != "Burkina Faso", , drop = FALSE]
  national <- rows[rows[["source_name"]] == "Burkina Faso", , drop = FALSE]
  if (sum(local[["collected_basis"]]) != national[["collected_basis"]][1]) {
    stop("2019 regional collected-person bases do not reproduce the national basis", call. = FALSE)
  }
  if (sum(local[["full_resident_total"]]) != national[["full_resident_total"]][1]) {
    stop("2019 regional full resident totals do not reproduce the national total", call. = FALSE)
  }
  invisible(TRUE)
}

# return stable region codes shared by the census and boundary labels.
region_codes <- function() {
  c(
    "Boucle du Mouhoun" = "boucle-du-mouhoun", "Cascades" = "cascades",
    "Centre" = "centre", "Centre-Est" = "centre-est", "Centre-Nord" = "centre-nord",
    "Centre-Ouest" = "centre-ouest", "Centre-Sud" = "centre-sud", "Est" = "est",
    "Hauts-Bassins" = "hauts-bassins", "Nord" = "nord",
    "Plateau Central" = "plateau-central", "Sahel" = "sahel", "Sud-Ouest" = "sud-ouest"
  )
}

# validate and simplify the 13-feature boundary if every census gate passes.
build_boundary <- function() {
  boundary <- st_read(boundary_path, quiet = TRUE)
  if (nrow(boundary) != 13L) stop("expected 13 geoBoundaries ADM1 features", call. = FALSE)
  boundary <- st_make_valid(boundary)
  validity <- st_is_valid(boundary)
  if (any(st_is_empty(boundary)) || any(is.na(validity)) || any(!validity)) {
    stop("source boundary contains empty or invalid geometries", call. = FALSE)
  }
  hashes <- vapply(st_as_binary(st_geometry(boundary), EWKB = TRUE), digest::digest,
                   character(1), algo = "sha256", serialize = FALSE)
  if (anyDuplicated(hashes)) stop("source boundary contains duplicate geometries", call. = FALSE)

  codes <- region_codes()
  if (!setequal(boundary[["shapeName"]], names(codes))) {
    stop("census and boundary region names do not match exactly", call. = FALSE)
  }
  boundary[["area_code"]] <- unname(codes[boundary[["shapeName"]]])
  boundary[["area_name"]] <- boundary[["shapeName"]]
  boundary[["area_unit_id"]] <- paste0(boundary_set_id, ":", boundary[["area_code"]])
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- "region"
  boundary <- boundary[, c("area_code", "area_name", "area_unit_id", "boundary_set_id", "boundary_level")]

  dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
  simplification <- mapshaper_simplify_to_cap(
    boundary, boundary_output, max_bytes = 3000000L,
    keep_percentages = c(100, 80, 60, 40, 30, 20, 15, 10, 7, 5),
    clean_option = "allow-overlaps"
  )
  written <- st_read(boundary_output, quiet = TRUE)
  written_validity <- st_is_valid(written)
  written_hashes <- vapply(st_as_binary(st_geometry(written), EWKB = TRUE), digest::digest,
                           character(1), algo = "sha256", serialize = FALSE)
  if (nrow(written) != 13L || any(st_is_empty(written)) || any(!written_validity) ||
      anyDuplicated(written_hashes) || file.info(boundary_output)[["size"]] > 3000000L) {
    stop("simplified boundary failed feature, validity, distinctness, or byte-cap gate", call. = FALSE)
  }
  list(boundary = written, simplification = simplification)
}

for (path in c(pdf_2006, pdf_2019, boundary_path, boundary_metadata_path)) require_file(path)

categories <- c("animiste", "musulman", "catholique", "protestant", "autre", "sans_religion")
rows_2006 <- table_2006()
rows_2019 <- table_2019()

text_2006 <- normalise_source_text(pdf_layout_lines(pdf_2006))
text_2019 <- normalise_source_text(pdf_layout_lines(pdf_2019))
assert_transcription_present(text_2006, rows_2006, c(categories, "printed_total"), source_integer)
assert_transcription_present(
  text_2019, rows_2019, c(categories, "printed_percent_total"), source_percent
)

assert_exact_row_reconciliation(rows_2006, categories, "printed_total", "2006")
assert_2006_local_to_national(rows_2006, categories)
assert_2019_population_reconciliation(rows_2019)

# this gate currently stops on five source rows. later code must remain
# unreachable until INSD publishes a corrected or more precise table.
assert_exact_row_reconciliation(rows_2019, categories, "printed_percent_total", "2019")

# keep the mandatory boundary path explicit for a future corrected source.
boundary_result <- build_boundary()
stop(
  "all census and boundary gates passed, but public product writing is not implemented: ",
  "INSD publication reuse permission must first be resolved",
  call. = FALSE
)
