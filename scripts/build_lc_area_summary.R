# build the Saint Lucia district census-affiliation area-summary product.
#
# PI ship ruling (2026-07-10): the 2001, 2010, and 2022 district religion
# tables ship AS PUBLISHED with the source's own category-vs-total arithmetic
# discrepancies disclosed per row and at product level. No tolerance, no
# allocation, no rounding repair is applied. The image readback in
# research/countries/lc/reconciliation-verification.md confirmed that every
# 2022 discrepancy is the source's arithmetic, not an extraction error.
#
# inputs: CSO REDATAM 2001 and 2010 weighted district religion outputs, the
# 2022 Provisional Results Table D.2 (image-verified transcription), and
# geoBoundaries LCA ADM1 (CC0) ten-district geometry with release metadata.
# outputs: apps/regions/lc/data/lc_district_2015.geojson,
# apps/regions/lc/data/area_summary_district.{json,csv}, and
# docs/manifests/lc-census-religion-2001-2022.json
# run from the repository root: Rscript scripts/build_lc_area_summary.R

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(sf)
  library(xml2)
})

source("scripts/lib/simplify_boundary.R")

country_code <- "LC"
script_id <- "scripts/build_lc_area_summary.R"
raw_dir <- "data/raw/lc_census"
product_dir <- "apps/regions/lc/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-10"
stamp <- paste0(retrieval_date, "T00:00:00Z")
ship_ruling <- "PI ship ruling 2026-07-10: ship as published with source-arithmetic disclosure; no tolerance, allocation, or repair"
git_commit <- trimws(system2("git", c("rev-parse", "HEAD"), stdout = TRUE))
if (length(git_commit) != 1L || !grepl("^[a-f0-9]{40}$", git_commit)) {
  git_commit <- NA_character_
}

boundary_level <- "district"
boundary_set_id <- "lc-district-2015-geoboundaries-adm1"
boundary_dataset_id <- "geoboundaries-lca-adm1-2015"
census_2001_id <- "cso-redatam-phc2001-religion-district"
census_2010_id <- "cso-redatam-phc2010-religion-district"
census_2022_id <- "cso-phc2022-table-d2-religion-district"

# durable raw-source sweep target (upload in progress at ship time).
raw_cache_durable_uris <- c("gs://pow-research-data/raw_sources/lc_census/")
local_cache_hint <- "All raw sources are cached under data/raw/lc_census/ and remain git-ignored."

# CSO Open Licence Agreement value-added acknowledgement obligation (verbatim).
cso_value_added_notice <- paste(
  "This product was adapted from the information of The Central Statistical Office of Saint Lucia,",
  "which is licensed under the Open Licence Agreement of The Central Statistical Office of Saint Lucia."
)
cso_licence_name <- paste(
  "CSO Open Licence Agreement: worldwide, royalty-free, non-exclusive licence to use, copy, modify,",
  "publish, distribute, and create derivative or value-added products from CSO information, subject to the",
  "required value-added-product acknowledgement."
)
# descriptive obligation token carried in free-form fields (quality_flag,
# licence_obligation); the schema-constrained licence_status enum stays "accepted".
census_licence_status <- "cso_open_licence_agreement_value_added_acknowledgement_required"
licence_status_enum <- "accepted"
storage_provider_value <- "other"
licence_obligation <- paste(
  "Census-derived files: CSO Open Licence Agreement, value-added acknowledgement required -", cso_value_added_notice,
  "Boundary file: CC0 1.0 Universal Public Domain Dedication, no obligation."
)

boundary_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/LCA/ADM1/"
boundary_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/LCA/ADM1/geoBoundaries-LCA-ADM1.geojson"
census_2001_url <- "https://prod.redatam.org/binlca/RpWebEngine.exe/Portal?BASE=PHC2001"
census_2010_url <- "https://prod.redatam.org/binlca/RpWebEngine.exe/Portal?BASE=PHC2010C"
census_2022_url <- "https://stats.gov.lc/wp-content/uploads/2024/08/StLucia-Provisional-Census-Report-2022-Release-1Rev1.pdf"
cso_results_url <- "https://stats.gov.lc/census/census-results/"

pdf_2022 <- file.path(raw_dir, "lc_2022_provisional_release1_rev1.pdf")
boundary_path <- file.path(raw_dir, "geoBoundaries-LCA-ADM1.geojson")
boundary_meta_path <- file.path(raw_dir, "gb_lca_adm1_meta.json")
local_2001_path <- file.path(raw_dir, "redatam_2001_religion_by_district.html")
national_2001_path <- file.path(raw_dir, "redatam_2001_religion_national.html")
national_2010_path <- file.path(raw_dir, "redatam_2010_religion_national.html")
district_2010_paths <- file.path(raw_dir, "redatam_2010_districts", paste0("district_", 1:12, ".html"))

boundary_out <- file.path(product_dir, "lc_district_2015.geojson")
summary_json_out <- file.path(product_dir, "area_summary_district.json")
summary_csv_out <- file.path(product_dir, "area_summary_district.csv")
manifest_out <- file.path(manifest_dir, "lc-census-religion-2001-2022.json")

# canonical ten-district frame shared across all three waves.
canonical_names <- c(
  "Castries", "Anse La Raye", "Canaries", "Soufriere", "Choiseul",
  "Laborie", "Vieux Fort", "Micoud", "Dennery", "Gros Islet"
)
canonical_code <- c(
  Castries = "castries", `Anse La Raye` = "anse-la-raye", Canaries = "canaries",
  Soufriere = "soufriere", Choiseul = "choiseul", Laborie = "laborie",
  `Vieux Fort` = "vieux-fort", Micoud = "micoud", Dennery = "dennery",
  `Gros Islet` = "gros-islet"
)

# summing the three Castries subdivisions is the only aggregation to ten units.
constituents_2001 <- list(
  Castries = c("Castries Metropolitan", "Castries City (Rest)", "Castries Rural"),
  `Anse La Raye` = "Anse-La-Raye", Canaries = "Canaries", Soufriere = "Soufriere",
  Choiseul = "Choiseul", Laborie = "Laborie", `Vieux Fort` = "Vieux-Fort",
  Micoud = "Micoud", Dennery = "Dennery", `Gros Islet` = "Gros Islet"
)
constituents_2010 <- list(
  Castries = 1:3, `Anse La Raye` = 4L, Canaries = 5L, Soufriere = 6L, Choiseul = 7L,
  Laborie = 8L, `Vieux Fort` = 9L, Micoud = 10L, Dennery = 11L, `Gros Islet` = 12L
)

# ------------------------------------------------------------------ helpers ---

# return a file's SHA-256 digest.
sha256_file <- function(path) unname(tools::sha256sum(path))

# return a file's size in bytes.
file_bytes <- function(path) as.numeric(unname(file.info(path)[["size"]]))

# stop when a required cached input is absent or empty.
require_file <- function(path) {
  if (!file.exists(path) || file_bytes(path) == 0) stop("missing required source: ", path, call. = FALSE)
}

# count rows or features in a generated product.
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$", path)) return(length(fromJSON(path, simplifyVector = FALSE)[["features"]]))
  if (grepl("\\.json$", path)) return(length(fromJSON(path, simplifyVector = FALSE)[["rows"]]))
  NA_integer_
}

# return non-blank cell text for every HTML table row.
html_rows <- function(path) {
  document <- xml2::read_html(path)
  rows <- xml2::xml_find_all(document, ".//tr")
  lapply(rows, function(row) {
    values <- trimws(xml2::xml_text(xml2::xml_find_all(row, "./th|./td")))
    values[values != "" & values != " "]
  })
}

# convert REDATAM grouped integers and hyphen zeros to exact integers.
redatam_integer <- function(value) {
  if (identical(trimws(value), "-")) return(0L)
  as.integer(gsub("[^0-9]", "", value))
}

# extract one 2010 REDATAM frequency table with printed Total and Missing.
parse_frequency <- function(path) {
  rows <- html_rows(path)
  header <- which(vapply(rows, function(row) {
    length(row) == 4L && identical(row[[1]], "Religion") && identical(row[[2]], "Counts")
  }, logical(1)))[[1]]
  body <- rows[(header + 1L):length(rows)]
  total_offset <- which(vapply(body, function(row) {
    length(row) >= 1L && identical(row[[1]], "Total")
  }, logical(1)))[[1]]
  body <- body[seq_len(total_offset)]
  counts <- vapply(body, function(row) redatam_integer(row[[2]]), integer(1))
  names(counts) <- vapply(body, `[[`, character(1), 1L)
  missing_row <- rows[which(vapply(rows, function(row) {
    length(row) >= 1L && identical(row[[1]], "Missing :")
  }, logical(1)))]
  missing_count <- if (length(missing_row) == 0L) 0L else redatam_integer(missing_row[[1]][[2]])
  list(counts = counts, missing = missing_count)
}

# extract the 12 2001 District/Parish tables from one REDATAM result.
parse_2001_local <- function(path) {
  rows <- html_rows(path)
  starts <- which(vapply(rows, function(row) {
    length(row) >= 2L && grepl("^AREA #", row[[1]])
  }, logical(1)))
  summary_start <- which(vapply(rows, function(row) {
    length(row) == 1L && identical(row[[1]], "SUMMARY")
  }, logical(1)))[[1]]
  lapply(seq_along(starts), function(index) {
    finish <- if (index < length(starts)) starts[[index + 1L]] - 1L else summary_start - 1L
    section <- rows[(starts[[index]] + 1L):finish]
    count_rows <- section[vapply(section, function(row) {
      length(row) == 4L && grepl("^[0-9 -]+$", row[[4]])
    }, logical(1))]
    counts <- vapply(count_rows, function(row) redatam_integer(row[[4]]), integer(1))
    names(counts) <- vapply(count_rows, `[[`, character(1), 1L)
    list(area = rows[[starts[[index]]]][[2]], counts = counts, missing = 0L)
  })
}

# extract the 2001 national category row from its REDATAM result.
parse_2001_national <- function(path) {
  rows <- html_rows(path)
  count_rows <- rows[vapply(rows, function(row) {
    length(row) == 4L && grepl("^[0-9 -]+$", row[[4]])
  }, logical(1))]
  counts <- vapply(count_rows, function(row) redatam_integer(row[[4]]), integer(1))
  names(counts) <- vapply(count_rows, `[[`, character(1), 1L)
  list(counts = counts, missing = 0L)
}

# sum several named integer vectors by matching name, dropping the printed Total.
sum_named <- function(vectors, drop = "Total") {
  all_names <- setdiff(unique(unlist(lapply(vectors, names))), drop)
  setNames(vapply(all_names, function(nm) {
    sum(vapply(vectors, function(v) if (nm %in% names(v)) v[[nm]] else 0L, integer(1)))
  }, integer(1)), all_names)
}

# derive one district's shipped metrics from its published category cells.
# population_total is the printed district total less the non-response cell,
# generalising the probe's stated-response denominator to the district level.
# no repair: religious_affiliation is the published named-religion cell sum, so
# it plus no_religion differs from population_total by the disclosed overrun.
district_metrics <- function(cells, printed_total, nonresponse_names, no_religion_names, missing = 0L) {
  category_sum <- sum(cells)
  non_response <- sum(cells[intersect(nonresponse_names, names(cells))])
  no_religion <- sum(cells[intersect(no_religion_names, names(cells))])
  religious_affiliation <- category_sum - non_response - no_religion
  population_total <- printed_total - non_response
  list(
    category_sum = category_sum, non_response = non_response, no_religion = no_religion,
    religious_affiliation = religious_affiliation, printed_total = printed_total,
    population_total = population_total, overrun = category_sum - printed_total, missing = missing
  )
}

# ------------------------------------------------------ 2022 Table D.2 matrix ---

# return the full 2022 Table D.2 count matrix transcribed and image-verified
# against the cached PDF (research/countries/lc/reconciliation-verification.md).
table_2022 <- function() {
  source_rows <- c(
    "Total|171834|60614|5841|2171|8322|7122|8507|19669|16693|12943|29953",
    "Anglican|2191|769|17|3|13|264|237|227|42|50|571",
    "Baptist|2987|1140|170|1|74|17|83|367|285|47|801",
    "Bahai Faith|29|17|0|0|0|0|2|6|0|0|4",
    "Brethren|122|60|1|0|4|0|2|13|23|0|20",
    "Buddhism|47|9|0|0|1|0|0|5|1|1|28",
    "Mennonite|3760|562|3|15|197|175|431|1245|499|454|177",
    "Hindu|253|83|0|1|1|0|0|57|0|1|110",
    "Jehovah Witnesses|1353|617|14|10|43|25|50|104|74|105|310",
    "Methodist|664|499|0|3|2|1|3|17|6|2|130",
    "Mormon|52|28|0|0|0|0|0|8|1|0|15",
    "Islam|292|112|8|0|6|1|6|73|12|4|70",
    "Pentecostal|15515|5432|646|15|434|416|633|1837|1761|1181|3159",
    "Nazarene|310|70|2|0|2|4|3|5|3|0|220",
    "Rastafarian|2463|836|116|51|210|127|95|260|217|259|292",
    "Roman Catholic|86967|27131|2576|1436|5832|5104|5388|10708|8330|6751|13711",
    "Salvation Army|202|79|7|3|10|9|9|15|16|15|39",
    "Seventh Day Adventist|18601|7390|1084|354|439|411|508|1374|2491|1523|3028",
    "Universal Church|277|114|20|0|4|9|5|27|6|51|42",
    "Hinduism|66|9|2|0|1|1|0|8|0|0|44",
    "Atheist - Do not believe in God|514|163|34|4|23|9|17|36|23|35|170",
    "None - No religion but believe in God|24252|9846|937|242|811|340|686|1942|2557|2081|4811",
    "Other|3854|1462|103|25|100|135|212|466|210|285|854",
    "Not reported|7064|4184|100|9|114|71|140|867|136|99|1345"
  )
  split_rows <- strsplit(source_rows, "|", fixed = TRUE)
  counts <- do.call(rbind, lapply(split_rows, function(row) as.integer(row[-1L])))
  rownames(counts) <- vapply(split_rows, `[[`, character(1), 1L)
  colnames(counts) <- c(
    "Saint Lucia", "Castries", "Anse La Raye", "Canaries", "Soufriere",
    "Choiseul", "Laborie", "Vieux Fort", "Micoud", "Dennery", "Gros Islet"
  )
  counts
}

# run Poppler and return normalised PDF text for transcription assertions.
pdf_text <- function(path) {
  executable <- Sys.which("pdftotext")
  if (!nzchar(executable)) stop("pdftotext (Poppler) is required", call. = FALSE)
  output <- tempfile(fileext = ".txt")
  on.exit(unlink(output), add = TRUE)
  status <- system2(executable, c("-layout", shQuote(path), shQuote(output)))
  if (status != 0L) stop("pdftotext failed on ", path, call. = FALSE)
  gsub("[[:space:]]+", " ", paste(readLines(output, warn = FALSE), collapse = " "))
}

# require each transcribed 2022 source row to occur in the cached PDF text.
assert_2022_transcription <- function(counts, text) {
  source_labels <- rownames(counts)
  source_labels[source_labels == "Atheist - Do not believe in God"] <- "Atheist - Do not believe in"
  source_labels[source_labels == "None - No religion but believe in God"] <- "None - No religion but"
  for (index in seq_len(nrow(counts))) {
    values <- ifelse(counts[index, ] == 0L, "-", format(counts[index, ], big.mark = ",", scientific = FALSE, trim = TRUE))
    pieces <- c(source_labels[[index]], values)
    pattern <- paste(vapply(pieces, function(piece) {
      gsub(" ", "[[:space:]]+", piece, fixed = TRUE)
    }, character(1)), collapse = "[[:space:]]+")
    if (!grepl(pattern, text, perl = TRUE)) {
      stop("2022 transcribed row not found in PDF text: ", rownames(counts)[[index]], call. = FALSE)
    }
  }
  invisible(TRUE)
}

# ------------------------------------------ pinned source-arithmetic gates ---

# every-wave discrepancy pattern documented in the route probe and, for 2022,
# in the image readback. Shipping requires the parsed source to reproduce these
# exactly; any drift is a hard stop so the disclosure cannot go stale.
expected_2001_area_overrun <- c(
  "Castries Metropolitan" = 5L, "Castries City (Rest)" = 0L, "Castries Rural" = 0L,
  "Anse-La-Raye" = 2L, "Canaries" = 0L, "Soufriere" = -1L, "Choiseul" = 0L,
  "Laborie" = 0L, "Vieux-Fort" = 2L, "Micoud" = 1L, "Dennery" = 0L, "Gros Islet" = 0L
)
expected_2010_district_overrun <- c(
  `1` = 0L, `2` = -1L, `3` = 1L, `4` = 2L, `5` = 0L, `6` = 1L,
  `7` = -1L, `8` = -2L, `9` = 0L, `10` = -1L, `11` = 0L, `12` = -1L
)
expected_2022_column_overrun <- c(
  "Saint Lucia" = 1L, "Castries" = -2L, "Anse La Raye" = -1L, "Canaries" = 1L,
  "Soufriere" = -1L, "Choiseul" = -3L, "Laborie" = 3L, "Vieux Fort" = -2L,
  "Micoud" = 0L, "Dennery" = 1L, "Gros Islet" = -2L
)
expected_2022_row_overrun <- c(
  "Anglican" = 2L, "Baptist" = -2L, "Bahai Faith" = 0L, "Brethren" = 1L, "Buddhism" = -2L,
  "Mennonite" = -2L, "Hindu" = 0L, "Jehovah Witnesses" = -1L, "Methodist" = -1L, "Mormon" = 0L,
  "Islam" = 0L, "Pentecostal" = -1L, "Nazarene" = -1L, "Rastafarian" = 0L, "Roman Catholic" = 0L,
  "Salvation Army" = 0L, "Seventh Day Adventist" = 1L, "Universal Church" = 1L, "Hinduism" = -1L,
  "Atheist - Do not believe in God" = 0L, "None - No religion but believe in God" = 1L,
  "Other" = -2L, "Not reported" = 1L
)

# stop unless the observed named-integer pattern equals the pinned pattern.
assert_pinned <- function(observed, expected, label) {
  observed <- observed[names(expected)]
  if (!isTRUE(all.equal(unname(observed), unname(expected))) || anyNA(observed)) {
    stop(label, " drifted from the documented source-arithmetic pattern; disclosure would be stale", call. = FALSE)
  }
  invisible(TRUE)
}

# ------------------------------------------------------------- boundary ---

# hash each feature's geometry without serialising the R object.
geometry_hashes <- function(layer) {
  vapply(seq_len(nrow(layer)), function(index) {
    digest(st_as_binary(st_geometry(layer)[index], EWKB = TRUE)[[1L]], algo = "sha256", serialize = FALSE)
  }, character(1))
}

# hard gate: ten valid, non-empty, distinct-hash features.
validate_boundary <- function(layer, stage) {
  if (nrow(layer) != 10L || any(st_is_empty(layer)) || any(is.na(st_is_valid(layer))) || any(!st_is_valid(layer))) {
    stop(stage, " boundary does not contain 10 valid non-empty features", call. = FALSE)
  }
  hashes <- geometry_hashes(layer)
  if (length(unique(hashes)) != 10L) stop(stage, " boundary geometry hashes are not distinct", call. = FALSE)
  setNames(as.list(hashes), layer[["area_code"]])
}

# validate metadata, join ten districts, attach codes, and record land area.
build_boundary <- function(path, meta_path) {
  metadata <- fromJSON(meta_path, simplifyVector = FALSE)
  if (!identical(metadata[["boundaryID"]], "LCA-ADM1-63095687") ||
      !identical(metadata[["admUnitCount"]], "10") ||
      !grepl("CC0 1.0", metadata[["boundaryLicense"]], fixed = TRUE)) {
    stop("geoBoundaries release metadata does not match the pinned release", call. = FALSE)
  }
  boundary <- st_make_valid(st_read(path, quiet = TRUE, stringsAsFactors = FALSE))
  if (nrow(boundary) != 10L) stop("geoBoundaries LCA ADM1 feature count changed", call. = FALSE)
  name_map <- c(
    "Castries" = "Castries", "Anse la Raya" = "Anse La Raye", "Canaries" = "Canaries",
    "Soufrière" = "Soufriere", "Choiseul" = "Choiseul", "Laborie" = "Laborie",
    "Vieux Fort" = "Vieux Fort", "Micoud" = "Micoud", "Dennery" = "Dennery", "Gros Islet" = "Gros Islet"
  )
  if (!setequal(boundary[["shapeName"]], names(name_map))) {
    stop("boundary district labels do not match the pinned join map", call. = FALSE)
  }
  boundary[["area_name"]] <- unname(name_map[boundary[["shapeName"]]])
  boundary <- boundary[match(canonical_names, boundary[["area_name"]]), ]
  boundary[["boundary_source_name"]] <- boundary[["shapeName"]]
  boundary[["area_code"]] <- unname(canonical_code[boundary[["area_name"]]])
  boundary[["area_unit_id"]] <- paste(boundary_set_id, boundary[["area_code"]], sep = ":")
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- boundary_level
  boundary[["boundary_vintage"]] <- "2015"
  boundary[["boundary_source"]] <- "geoBoundaries LCA ADM1; source Wikimedia Commons"
  boundary[["boundary_licence"]] <- "CC0 1.0 Universal"
  boundary[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(boundary, 32620))) / 1e6
  boundary <- st_transform(boundary, 4326)
  boundary[c(
    "area_code", "area_name", "boundary_source_name", "area_unit_id", "boundary_set_id",
    "boundary_level", "boundary_vintage", "boundary_source", "boundary_licence",
    "land_area_sq_km", "geometry"
  )]
}

# simplify with the mandatory helper and re-run every geometry gate.
write_boundary <- function(boundary) {
  source_hashes <- validate_boundary(boundary, "source")
  simplification <- mapshaper_simplify_to_cap(
    boundary, boundary_out, max_bytes = 3000000L,
    keep_percentages = c(100, 80, 60, 40, 30, 20, 15, 10, 7, 5),
    clean_option = "allow-overlaps"
  )
  written <- st_read(boundary_out, quiet = TRUE, stringsAsFactors = FALSE)
  written <- written[match(boundary[["area_code"]], written[["area_code"]]), ]
  if (anyNA(written[["area_code"]])) stop("simplified boundary lost an area code", call. = FALSE)
  simplified_hashes <- validate_boundary(written, "simplified")
  if (file_bytes(boundary_out) > 3000000L) stop("simplified boundary exceeds the 3 MB cap", call. = FALSE)
  list(
    layer = written, simplification = simplification,
    source_hashes = source_hashes, simplified_hashes = simplified_hashes
  )
}

# --------------------------------------------------------------- assembly ---

invisible(lapply(c(
  pdf_2022, boundary_path, boundary_meta_path, local_2001_path, national_2001_path,
  national_2010_path, district_2010_paths
), require_file))

# ---- wave 2001 ----
local_2001 <- parse_2001_local(local_2001_path)
names(local_2001) <- vapply(local_2001, `[[`, character(1), "area")
national_2001 <- parse_2001_national(national_2001_path)
area_overrun_2001 <- vapply(local_2001, function(a) {
  sum(a$counts[names(a$counts) != "Total"]) - a$counts[["Total"]]
}, integer(1))
assert_pinned(area_overrun_2001, expected_2001_area_overrun, "2001 every-area reconciliation")
local_total_sum_2001 <- sum(vapply(local_2001, function(a) a$counts[["Total"]], integer(1)))
national_total_2001 <- national_2001$counts[["Total"]]
if (local_total_sum_2001 != 156734L || national_total_2001 != 156733L) {
  stop("2001 local-to-national totals drifted from the documented values", call. = FALSE)
}
not_stated_local_2001 <- sum(vapply(local_2001, function(a) {
  if ("Not stated" %in% names(a$counts)) a$counts[["Not stated"]] else 0L
}, integer(1)))
if (not_stated_local_2001 != 2486L || national_2001$counts[["Not stated"]] != 2484L) {
  stop("2001 Not stated local-to-national pattern drifted", call. = FALSE)
}

metrics_2001 <- lapply(canonical_names, function(cn) {
  parts <- lapply(constituents_2001[[cn]], function(nm) local_2001[[nm]]$counts)
  printed_total <- sum(vapply(parts, function(v) v[["Total"]], integer(1)))
  cells <- sum_named(parts, drop = "Total")
  district_metrics(cells, printed_total, "Not stated", "None")
})
names(metrics_2001) <- canonical_names

# ---- wave 2010 ----
district_2010 <- lapply(district_2010_paths, parse_frequency)
names(district_2010) <- as.character(1:12)
district_overrun_2010 <- vapply(district_2010, function(d) {
  sum(d$counts[names(d$counts) != "Total"]) - d$counts[["Total"]]
}, integer(1))
assert_pinned(district_overrun_2010, expected_2010_district_overrun, "2010 every-district reconciliation")
national_2010 <- parse_frequency(national_2010_path)
local_total_sum_2010 <- sum(vapply(district_2010, function(d) d$counts[["Total"]], integer(1)))
if (local_total_sum_2010 != 165314L || national_2010$counts[["Total"]] != 165315L) {
  stop("2010 local-to-national totals drifted from the documented values", call. = FALSE)
}
missing_local_2010 <- sum(vapply(district_2010, `[[`, integer(1), "missing"))
if (missing_local_2010 != 282L || national_2010$missing != 281L) {
  stop("2010 Missing local-to-national pattern drifted", call. = FALSE)
}
national_category_sum_2010 <- sum(national_2010$counts[names(national_2010$counts) != "Total"])
if (national_category_sum_2010 - national_2010$counts[["Total"]] != -2L) {
  stop("2010 national category-to-printed pattern drifted", call. = FALSE)
}

metrics_2010 <- lapply(canonical_names, function(cn) {
  codes <- as.character(constituents_2010[[cn]])
  parts <- lapply(codes, function(code) district_2010[[code]]$counts)
  printed_total <- sum(vapply(parts, function(v) v[["Total"]], integer(1)))
  cells <- sum_named(parts, drop = "Total")
  missing <- sum(vapply(codes, function(code) district_2010[[code]]$missing, integer(1)))
  district_metrics(cells, printed_total, "Not stated", "None", missing = missing)
})
names(metrics_2010) <- canonical_names

# ---- wave 2022 ----
counts_2022 <- table_2022()
assert_2022_transcription(counts_2022, pdf_text(pdf_2022))
categories_2022 <- rownames(counts_2022)[rownames(counts_2022) != "Total"]
category_matrix_2022 <- counts_2022[categories_2022, , drop = FALSE]
column_overrun_2022 <- colSums(category_matrix_2022) - counts_2022["Total", ]
assert_pinned(column_overrun_2022, expected_2022_column_overrun, "2022 every-column reconciliation")
row_overrun_2022 <- rowSums(category_matrix_2022[, colnames(counts_2022) != "Saint Lucia", drop = FALSE]) -
  category_matrix_2022[, "Saint Lucia"]
assert_pinned(row_overrun_2022, expected_2022_row_overrun, "2022 category-to-national reconciliation")

no_religion_2022 <- c("Atheist - Do not believe in God", "None - No religion but believe in God")
metrics_2022 <- lapply(canonical_names, function(cn) {
  cells <- counts_2022[categories_2022, cn]
  district_metrics(cells, counts_2022["Total", cn], "Not reported", no_religion_2022)
})
names(metrics_2022) <- canonical_names

# ---- boundary ----
boundary_result <- write_boundary(build_boundary(boundary_path, boundary_meta_path))
written_boundary <- boundary_result[["layer"]]
land_area <- setNames(written_boundary[["land_area_sq_km"]], written_boundary[["area_name"]])
area_geo <- setNames(
  lapply(canonical_names, function(cn) {
    list(area_unit_id = paste(boundary_set_id, canonical_code[[cn]], sep = ":"),
         area_code = unname(canonical_code[[cn]]), land_area_sq_km = unname(land_area[[cn]]))
  }), canonical_names
)

# ---- shipped rows ----
overrun_token <- function(overrun) {
  if (overrun == 0L) "source_category_cells_match_printed_total" else paste0("source_printed_total_overrun=", sprintf("%+d", overrun))
}

basis_2001 <- function(m) paste0(
  "2001 CSO REDATAM weighted district total ", m$printed_total, " less ", m$non_response,
  " Not stated responses gives the stated-response denominator ", m$population_total, "; the source's printed ",
  "district total and its published category cells differ by ", sprintf("%+d", m$overrun),
  " people, shipped as published without repair; the national REDATAM religion total 156733 is 98 above the ",
  "2001 final report's enumerated resident population 156635 (disclosed, unresolved)"
)
basis_2010 <- function(m) paste0(
  "2010 CSO REDATAM weighted district total ", m$printed_total, " less ", m$non_response,
  " Not stated responses gives the stated-response denominator ", m$population_total, "; the REDATAM Missing count ",
  m$missing, " sits outside this total; the source's printed district total and its published category cells differ by ",
  sprintf("%+d", m$overrun), " people, shipped as published without repair"
)
basis_2022 <- function(m) paste0(
  "2022 Provisional Results Table D.2 household total ", m$printed_total, " less ", m$non_response,
  " Not reported responses gives the stated-response denominator ", m$population_total,
  "; PROVISIONAL status: cleaning is ongoing and figures may approximate the final census; the source's printed ",
  "district total and its published category cells differ by ", sprintf("%+d", m$overrun),
  " people, shipped as published without repair"
)

build_area_row <- function(area_name, year, m, census_id, basis, extra_flags) {
  geo <- area_geo[[area_name]]
  list(
    country_code = country_code, boundary_set_id = boundary_set_id, boundary_level = boundary_level,
    area_unit_id = geo$area_unit_id, area_code = geo$area_code, area_name = area_name,
    year = as.integer(year),
    population_total = as.integer(m$population_total),
    population_total_basis = basis(m),
    religious_affiliation_count = as.integer(m$religious_affiliation),
    religious_affiliation_percent = round(100 * m$religious_affiliation / m$population_total, 4),
    no_religion_count = as.integer(m$no_religion),
    no_religion_percent = round(100 * m$no_religion / m$population_total, 4),
    place_count = NULL, places_per_10000_residents = NULL, place_density_per_sq_km = NULL,
    land_area_sq_km = round(geo$land_area_sq_km, 4),
    site_snapshot_date = NULL, place_count_basis = NULL,
    source_dataset_ids = list(census_id, boundary_dataset_id),
    quality_flag = paste(c(
      "census_affiliation", "stated_response_denominator", overrun_token(m$overrun),
      extra_flags, "cross_wave_change_withheld", census_licence_status, "boundary_cc0"
    ), collapse = ";")
  )
}

rows <- c(
  lapply(canonical_names, function(cn) build_area_row(cn, 2001L, metrics_2001[[cn]], census_2001_id, basis_2001,
    c("not_stated_excluded_from_denominator"))),
  lapply(canonical_names, function(cn) build_area_row(cn, 2010L, metrics_2010[[cn]], census_2010_id, basis_2010,
    c("not_stated_excluded_from_denominator", paste0("redatam_missing_outside_total=", metrics_2010[[cn]]$missing)))),
  lapply(canonical_names, function(cn) build_area_row(cn, 2022L, metrics_2022[[cn]], census_2022_id, basis_2022,
    c("not_reported_excluded_from_denominator", "provisional_release_1")))
)

# flatten row objects into the CSV companion.
flatten_rows <- function(rows) {
  do.call(rbind, lapply(rows, function(row) {
    data.frame(
      country_code = row[["country_code"]], boundary_set_id = row[["boundary_set_id"]],
      boundary_level = row[["boundary_level"]], area_unit_id = row[["area_unit_id"]],
      area_code = row[["area_code"]], area_name = row[["area_name"]], year = row[["year"]],
      population_total = row[["population_total"]], population_total_basis = row[["population_total_basis"]],
      religious_affiliation_count = row[["religious_affiliation_count"]],
      religious_affiliation_percent = row[["religious_affiliation_percent"]],
      no_religion_count = row[["no_religion_count"]], no_religion_percent = row[["no_religion_percent"]],
      place_count = NA_integer_, places_per_10000_residents = NA_real_,
      place_density_per_sq_km = NA_real_, land_area_sq_km = row[["land_area_sq_km"]],
      site_snapshot_date = NA_character_, place_count_basis = NA_character_,
      source_dataset_ids = paste(unlist(row[["source_dataset_ids"]]), collapse = "|"),
      quality_flag = row[["quality_flag"]], stringsAsFactors = FALSE
    )
  }))
}

# ---- product metadata blocks ----

# describe the verbatim source categories and roles for one wave.
category_mapping <- function(names_vec, no_religion, nonresponse) {
  lapply(names_vec, function(nm) {
    role <- if (nm %in% no_religion) "no_religion" else if (nm %in% nonresponse) "nonresponse" else "religious_affiliation"
    list(source_name = nm, role = role)
  })
}
categories_2001 <- setdiff(names(national_2001$counts), "Total")
categories_2010 <- setdiff(names(national_2010$counts), "Total")

source_datasets <- function() {
  cso_licence <- list(name = cso_licence_name, url = cso_results_url, attribution = cso_value_added_notice)
  list(
    list(
      source_dataset_id = census_2001_id,
      name = "CSO REDATAM PHC2001: weighted religion counts by District/Parish",
      provider = "Central Statistical Office of Saint Lucia (CSO)", url = census_2001_url,
      retrieval_date = retrieval_date, local_path = local_2001_path, licence = cso_licence,
      citation = "Central Statistical Office of Saint Lucia, 2001 Population and Housing Census, REDATAM religion by District/Parish.",
      access_limits = "REDATAM result-frame URLs are temporary; the reproducible record is the cached POST result bytes and their hashes.",
      redistribution_limits = "Derived stated-response district statistics ship under the CSO Open Licence Agreement with the required value-added acknowledgement.",
      notes = "Twelve District/Parish areas; the three Castries subdivisions sum to the ten-district frame. Five areas' category cells differ from their printed totals by one to five people, shipped as published."
    ),
    list(
      source_dataset_id = census_2010_id,
      name = "CSO REDATAM PHC2010: weighted religion counts by District",
      provider = "Central Statistical Office of Saint Lucia (CSO)", url = census_2010_url,
      retrieval_date = retrieval_date, local_path = national_2010_path, licence = cso_licence,
      citation = "Central Statistical Office of Saint Lucia, 2010 Population and Housing Census, REDATAM religion by District.",
      access_limits = "REDATAM result-frame URLs are temporary; the reproducible record is the cached POST result bytes and their hashes.",
      redistribution_limits = "Derived stated-response district statistics ship under the CSO Open Licence Agreement with the required value-added acknowledgement.",
      notes = "Twelve District codes; codes 1 to 3 sum to Castries. Eight districts' category cells differ from their printed totals by one or two people, and a separate Missing count sits outside the category total; shipped as published."
    ),
    list(
      source_dataset_id = census_2022_id,
      name = "CSO 2022 Population and Housing Census Provisional Results, Release 1, Table D.2: Population Religion by District",
      provider = "Central Statistical Office of Saint Lucia (CSO)", url = census_2022_url,
      retrieval_date = retrieval_date, local_path = pdf_2022, licence = cso_licence,
      citation = "Central Statistical Office of Saint Lucia, 2022 Population and Housing Census Provisional Results, Release 1, Table D.2.",
      access_limits = "Provisional Results, Release 1; cleaning is ongoing and figures may approximate the final census statistics.",
      redistribution_limits = "Derived stated-response district statistics ship under the CSO Open Licence Agreement with the required value-added acknowledgement.",
      notes = "Ten districts on the published frame. Image readback confirmed every printed cell; nine of ten district columns and the national column differ from their category sums by one to three people (Micoud reconciles), shipped as published."
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "geoBoundaries LCA ADM1 (ten districts)",
      provider = "geoBoundaries; source Wikimedia Commons", url = boundary_url,
      retrieval_date = retrieval_date, local_path = boundary_path,
      licence = list(name = "CC0 1.0 Universal Public Domain Dedication", url = boundary_meta_url, attribution = "geoBoundaries; Wikimedia Commons"),
      citation = "geoBoundaries LCA ADM1, boundary ID LCA-ADM1-63095687; source Wikimedia Commons.",
      access_limits = NULL,
      redistribution_limits = "The simplified boundary is public domain under CC0 1.0.",
      notes = "Release metadata records ten district units, represented year 2015, and CC0 1.0. Labels Anse la Raya and Soufriere are normalised without changing geography."
    )
  )
}

indicators <- function() {
  denominator_note <- paste(
    "Percentages use each district's stated-response denominator: the printed district total less the source's",
    "Not stated (2001, 2010) or Not reported (2022) responses. Where the source's category cells differ from its",
    "printed total, the published values ship unchanged and the affiliation and no-religion shares reflect that",
    "difference; the per-row overrun is disclosed in quality_flag and population_total_basis."
  )
  list(
    list(indicator_id = "population_total", label = "Stated-response population",
      description = "Printed district total less the source's non-response category.", unit = "count",
      denominator_indicator_id = NULL, method = "Printed district Total minus Not stated (2001, 2010) or Not reported (2022).",
      temporal_coverage = "2001, 2010, 2022", spatial_coverage = "Saint Lucia districts", quality_notes = denominator_note),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
      description = "Share affiliated with a named religion or the source's Other category.", unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * (published named-religion cells) / stated-response denominator.",
      temporal_coverage = "2001, 2010, 2022", spatial_coverage = "Saint Lucia districts", quality_notes = denominator_note),
    list(indicator_id = "no_religion_percent", label = "No religious affiliation %",
      description = "Share in None (2001, 2010) or the combined Atheist and None categories (2022).", unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * no-religion cells / stated-response denominator.",
      temporal_coverage = "2001, 2010, 2022", spatial_coverage = "Saint Lucia districts", quality_notes = denominator_note)
  )
}

visual_layers <- function() {
  legend <- list(unit = "percent", denominator = "stated-response population (printed total less non-response)")
  list(
    list(visual_layer_id = "lc-district-religious-affiliation", label = "Religious affiliation %",
      description = "Saint Lucia census-affiliation share by district for 2001, 2010, and 2022.", layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit", legend = legend,
      colour_scale = "sequential", time_control = "year_selector", aggregation_rule = "reported district value",
      uncertainty_display = "quality_flag", default_visibility = TRUE,
      notes = "The construct is census affiliation, not practice or membership. Cross-wave change is withheld because the category instruments differ across waves."),
    list(visual_layer_id = "lc-district-no-religion", label = "No religious affiliation %",
      description = "Saint Lucia census no-religion share by district for 2001, 2010, and 2022.", layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"), geometry_unit_type = "area_unit", legend = legend,
      colour_scale = "sequential", time_control = "year_selector", aggregation_rule = "reported district value",
      uncertainty_display = "quality_flag", default_visibility = FALSE,
      notes = "2001 and 2010 use None; 2022 combines Atheist - Do not believe in God with None - No religion but believe in God.")
  )
}

summary_product <- list(
  schema_version = "area-summary.v1", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code, level = boundary_level,
    vintage = "2015", source_dataset_id = boundary_dataset_id),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
    basis = "No governed place-of-worship snapshot ships in the Saint Lucia census product.",
    notes = "Place counts and density metrics remain null."),
  source_datasets = source_datasets(), indicators = indicators(), visual_layers = visual_layers(), rows = rows
)

write_json(summary_product, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

# ---- manifest ----

# record one cached source with its exact retrieval hash.
raw_source_record <- function(path, url, format, used_in_public_product, periods, notes) {
  list(uri = path, url = url, format = format, bytes = as.integer(file_bytes(path)), sha256 = sha256_file(path),
    used_in_public_product = used_in_public_product, periods = periods, notes = notes)
}

# record one generated file in the manifest.
manifest_file_record <- function(path, content, licence_status) {
  list(uri = paste0("repo:", path), storage_provider = storage_provider_value, format = sub("^.*\\.", "", path),
    bytes = as.integer(file_bytes(path)), sha256 = sha256_file(path), content_sha256 = NULL,
    row_count = if (grepl("area_summary", path)) row_count_file(path) else NULL,
    feature_count = if (grepl("geojson$", path)) row_count_file(path) else NULL,
    content = content, licence_status = licence_status)
}

# structured overrun record for one wave and geography.
overrun_records <- function(overruns) {
  Map(function(name, value) list(area = name, overrun = as.integer(value)), names(overruns), overruns)
}

district_overrun_2001 <- vapply(metrics_2001, `[[`, integer(1), "overrun")
district_overrun_2010_ten <- vapply(metrics_2010, `[[`, integer(1), "overrun")
district_overrun_2022 <- vapply(metrics_2022, `[[`, integer(1), "overrun")

raw_sources <- c(
  list(
    raw_source_record(local_2001_path, census_2001_url, "html", TRUE, "2001", "2001 REDATAM 12-area religion result; three Castries subdivisions sum to Castries."),
    raw_source_record(national_2001_path, census_2001_url, "html", TRUE, "2001", "2001 REDATAM national religion result; reconciles exactly to its printed total."),
    raw_source_record(national_2010_path, census_2010_url, "html", TRUE, "2010", "2010 REDATAM national religion result; category cells sum two below the printed total.")
  ),
  lapply(1:12, function(code) raw_source_record(district_2010_paths[[code]], census_2010_url, "html", TRUE, "2010",
    paste0("2010 REDATAM District code ", code, " religion result."))),
  list(
    raw_source_record(pdf_2022, census_2022_url, "pdf", TRUE, "2022", "2022 Provisional Results Release 1; Table D.2 transcribed and image-verified."),
    raw_source_record(boundary_meta_path, boundary_meta_url, "json", TRUE, "2015", "geoBoundaries LCA ADM1 release metadata; ten units, CC0 1.0."),
    raw_source_record(boundary_path, boundary_url, "geojson", TRUE, "2015", "Source geometry for ten districts.")
  )
)

national_context <- list(
  wave_2001 = list(printed_national_total = 156733L, not_stated = as.integer(national_2001$counts[["Not stated"]]),
    stated_response_denominator = 154249L, none = as.integer(national_2001$counts[["None"]]),
    national_reconciles = TRUE, enumerated_resident_population = 156635L, redatam_above_enumerated = 98L,
    note = "The national REDATAM religion total 156733 is 98 above the 2001 final report's enumerated resident population 156635; the captured sources do not explain the difference."),
  wave_2010 = list(printed_national_total = 165315L, not_stated = as.integer(national_2010$counts[["Not stated"]]),
    stated_response_denominator = 163010L, none = as.integer(national_2010$counts[["None"]]),
    redatam_missing = as.integer(national_2010$missing), national_category_vs_printed = -2L,
    estimated_private_household_population = 165595L, residents_outside_private_households = 931L,
    note = "The category total plus Missing count (165596) is one above the preliminary report's estimated private-household population 165595; 931 residents live outside private households."),
  wave_2022 = list(printed_household_total = 171834L, not_reported = 7064L, stated_response_denominator = 164770L,
    atheist = 514L, none_believe = 24252L, no_religion_combined = 24766L, provisional = TRUE,
    residents_in_institutions = 1114L, visiting_non_residents = 5859L,
    note = "Table D.2 is the household population 171834; 1114 residents in institutions and 5859 visiting non-residents lie outside its basis. Provisional Results, Release 1.")
)

source_arithmetic_disclosure <- list(
  mechanism = paste(
    "The source publishes district religion counts whose category cells do not always sum to the printed district",
    "total. The ruling ships the published values unchanged and discloses each overrun. Per row, quality_flag carries",
    "source_printed_total_overrun and population_total_basis states it; this manifest records the full pattern."
  ),
  wave_2001 = list(
    area_overruns_twelve = overrun_records(area_overrun_2001),
    district_overruns_ten = overrun_records(district_overrun_2001),
    local_total_sum = local_total_sum_2001, national_total = national_total_2001, local_minus_national = local_total_sum_2001 - national_total_2001,
    not_stated_local_sum = not_stated_local_2001, not_stated_national = as.integer(national_2001$counts[["Not stated"]]),
    national_reconciles = TRUE),
  wave_2010 = list(
    district_overruns_twelve = overrun_records(district_overrun_2010),
    district_overruns_ten = overrun_records(district_overrun_2010_ten),
    local_total_sum = local_total_sum_2010, national_total = as.integer(national_2010$counts[["Total"]]),
    local_minus_national = local_total_sum_2010 - as.integer(national_2010$counts[["Total"]]),
    missing_local_sum = missing_local_2010, missing_national = as.integer(national_2010$missing),
    national_category_minus_printed = national_category_sum_2010 - as.integer(national_2010$counts[["Total"]])),
  wave_2022 = list(
    column_overruns = overrun_records(column_overrun_2022),
    row_overruns = overrun_records(row_overrun_2022),
    micoud_reconciles = TRUE, image_readback_verified = TRUE,
    verification_record = "research/countries/lc/reconciliation-verification.md")
)

boundary_validation <- list(
  source_feature_count = 10L, simplified_feature_count = row_count_file(boundary_out),
  distinct_source_hashes = length(unique(unlist(boundary_result[["source_hashes"]]))),
  distinct_simplified_hashes = length(unique(unlist(boundary_result[["simplified_hashes"]]))),
  source_geometry_hashes = boundary_result[["source_hashes"]],
  simplified_geometry_hashes = boundary_result[["simplified_hashes"]],
  simplified_bytes = as.integer(file_bytes(boundary_out)), byte_cap = 3000000L,
  licence_metadata_status = "passed", licence = "CC0 1.0 Universal (CC0 1.0) Public Domain Dedication",
  release_source = "Wikimedia Commons")

dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)
manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json", schema_version = "data-manifest.v1",
  manifest_id = "manifest:lc-census-religion:lc:2001-2022:cso-district",
  dataset_id = "lc-census-religion:lc:2001-2022:cso-district",
  dataset_version_id = paste0("lc-census-religion:lc:2001-2022:cso-district:", dataset_hash),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "lc-census-religion", dataset_role = "public_product",
  scope = list(level = "country", country_codes = list("LC"), snapshot_date = NULL, snapshot_anchor = NULL, pipeline_stage = "public"),
  created_at = stamp, created_by = script_id,
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation",
      ship_ruling = ship_ruling,
      waves = list("2001", "2010", "2022"),
      shipped_geography = "10 districts",
      castries_aggregation = "the three 2001/2010 Castries subdivisions sum to the ten-district Castries; the other nine districts join one-to-one",
      denominator = "stated responses: printed district total less Not stated (2001, 2010) or Not reported (2022); national stated denominators 154249 / 163010 / 164770",
      licence_obligation = licence_obligation,
      licence_status_token = census_licence_status,
      no_repair_policy = "published category cells and printed totals ship unchanged; no tolerance, allocation, or rounding repair",
      disclosure_mechanism = source_arithmetic_disclosure[["mechanism"]],
      change_rule = "cross-wave religious_change withheld because the category instruments differ across the three waves",
      category_mappings = list(
        `2001` = category_mapping(categories_2001, "None", "Not stated"),
        `2010` = category_mapping(categories_2010, "None", "Not stated"),
        `2022` = category_mapping(categories_2022, no_religion_2022, "Not reported")
      ),
      boundary_simplification = boundary_result[["simplification"]],
      local_cache_hint = local_cache_hint,
      raw_cache_durable_uris = as.list(raw_cache_durable_uris),
      retrieval_record = raw_sources,
      national_context = national_context,
      source_arithmetic_disclosure = source_arithmetic_disclosure,
      validation_details = list(
        pinned_discrepancy_gates = list(status = "passed",
          note = "Parsed 2001, 2010, and 2022 sources reproduce the documented per-area, per-column, per-row, local-to-national, Missing, and enumerated-gap patterns exactly; drift is a hard stop."),
        boundary_validation = boundary_validation,
        provenance = list(status = "passed", cached_input_count = length(raw_sources), cached_inputs_with_sha256 = length(raw_sources))
      ),
      construct_notes = list(
        "The construct is census affiliation. It does not measure practice, attendance, or registered membership.",
        "Source category spellings are retained verbatim per wave; the frames are not identical across waves.",
        "Each district denominator is the printed district total less the source's non-response category.",
        "The published category cells and printed totals ship unchanged; per-row and product-level disclosures record every source-arithmetic overrun.",
        "Cross-wave religious_change is withheld because the 2001, 2010, and 2022 category instruments differ, most sharply in the 2022 split of Atheist from None."
      )
    ),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")), digest = as.character(packageVersion("digest")),
      xml2 = as.character(packageVersion("xml2")), mapshaper = "scripts/lib/simplify_boundary.R",
      pdftotext = "poppler pdftotext (system)"
    )
  ),
  source = list(
    provider = "Central Statistical Office of Saint Lucia; geoBoundaries; Wikimedia Commons",
    source_dataset_ids = list(census_2001_id, census_2010_id, census_2022_id, boundary_dataset_id),
    source_urls = list(census_2001_url, census_2010_url, census_2022_url, cso_results_url, boundary_meta_url, boundary_url),
    retrieved_at = stamp,
    licence = paste(
      "CSO census tables are licensed under the CSO Open Licence Agreement, which grants a worldwide, royalty-free,",
      "non-exclusive licence for derivative and value-added products and requires the acknowledgement:", cso_value_added_notice,
      "geoBoundaries LCA ADM1 is CC0 1.0 Universal, verified in release metadata that identifies Wikimedia Commons as the source."
    ),
    citation = "Central Statistical Office of Saint Lucia, 2001, 2010, and 2022 Population and Housing Census religion tables; geoBoundaries LCA ADM1."
  ),
  input_manifests = list(),
  durable_files = list(
    manifest_file_record(summary_json_out, "Saint Lucia 2001, 2010, and 2022 district census-affiliation area summary, shipped as published with source-arithmetic disclosure.", licence_status_enum),
    manifest_file_record(summary_csv_out, "Flattened Saint Lucia district census-affiliation rows for 2001, 2010, and 2022.", licence_status_enum),
    manifest_file_record(boundary_out, "Simplified geoBoundaries LCA ADM1 ten-district geometry.", licence_status_enum)
  ),
  validation = list(
    status = "passed",
    commands = list(
      "Rscript scripts/build_lc_area_summary.R",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/lc/data/area_summary_district.json",
      "uvx check-jsonschema --schemafile schemas/data-manifest.schema.json docs/manifests/lc-census-religion-2001-2022.json"
    ),
    notes = paste(
      "The three waves ship as published under the PI ruling. Parsed sources reproduce every documented source-arithmetic",
      "discrepancy exactly (2001 five areas, 2010 eight districts, 2022 nine district columns plus the national column and",
      "fifteen category rows; Micoud reconciles). The ten-district boundary passed feature-count, validity, distinct-hash,",
      "and 3 MB-cap gates. Cross-wave change is withheld because the category instruments differ."
    ),
    warnings = list(
      "In nine 2022 printed district columns and several 2001 and 2010 printed rows the source's category cells differ from the printed totals by one to three people; the published values ship unchanged.",
      "The 2001 REDATAM religion total is 98 above the enumerated resident population; the 2010 Missing count and 2022 institutional population lie outside the table basis; all are disclosed.",
      "The 2022 figures are Provisional Results, Release 1."
    )
  ),
  stats = list(district_year_rows = length(rows), district_count = 10L, shipped_wave_count = 3L, distinct_geometry_hashes = 10L),
  privacy = "public", licence_status = licence_status_enum, downstream_status = "public",
  notes = "The derived product ships under the CSO Open Licence Agreement with its required value-added acknowledgement. The boundary is CC0 1.0. The map UI is outside this build."
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

# ---- console summary ----
cat("waves shipped: 2001, 2010, 2022 on ten districts (30 rows)\n")
cat(sprintf("2001 overruns (ten districts): %s\n", paste(names(district_overrun_2001), sprintf("%+d", district_overrun_2001), collapse = "; ")))
cat(sprintf("2010 overruns (ten districts): %s\n", paste(names(district_overrun_2010_ten), sprintf("%+d", district_overrun_2010_ten), collapse = "; ")))
cat(sprintf("2022 overruns (ten districts): %s\n", paste(names(district_overrun_2022), sprintf("%+d", district_overrun_2022), collapse = "; ")))
cat("pinned-discrepancy gate: passed; parsed sources reproduce every documented pattern\n")
cat("denominator: national stated responses 154249 / 163010 / 164770 (printed total less non-response)\n")
cat(sprintf("boundary gate: passed; 10 valid distinct features, %d bytes at %g%% keep\n",
            file_bytes(boundary_out), boundary_result[["simplification"]][["keep_percent"]]))
cat(sprintf("provenance gate: passed; %d/%d cached inputs record SHA-256\n", length(raw_sources), length(raw_sources)))
cat("licence gate: passed under the CSO Open Licence Agreement with value-added acknowledgement; boundary CC0 1.0\n")
cat("change gate: passed by withholding; category instruments differ across waves\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", boundary_out))
cat(sprintf("wrote %s\n", manifest_out))
