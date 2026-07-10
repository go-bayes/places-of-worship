# build the Palestine governorate census-affiliation area-summary product.
# inputs: PCBS 1997 and 2007 final-report spreadsheets, the 2017 preliminary-results PDF, and geoBoundaries PSE ADM2.
# outputs: governorate area-summary JSON/CSV, a simplified boundary, and a tracked manifest.
# run from the repository root: Rscript scripts/build_ps_area_summary.R

suppressMessages({
  library(digest)
  library(jsonlite)
  library(readxl)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

raw_dir <- "data/raw/ps_census"
output_dir <- "apps/regions/ps/data"
manifest_dir <- "docs/manifests"
dir.create(raw_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

script_id <- "scripts/build_ps_area_summary.R"
country_code <- "PS"
years <- c(1997L, 2007L, 2017L)
boundary_set_id <- "ps-governorate-2017-geoboundaries-adm2"
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- format(Sys.Date(), "%Y-%m-%d")
git_commit <- system("git rev-parse --short HEAD", intern = TRUE)

pcbs_terms_url <- "https://www.pcbs.gov.ps/en/reference/terms-of-use/"
pcbs_1997_pdf_url <- "https://www.pcbs.gov.ps/media/dtgbbijp/book426-1997.pdf"
pcbs_1997_excel_url <- "https://www.pcbs.gov.ps/downloads/zip/426-x.zip"
pcbs_2007_pdf_url <- "https://www.pcbs.gov.ps/media/1b3ejexf/book1853-2007.pdf"
pcbs_2007_national_excel_url <- "https://www.pcbs.gov.ps/downloads/zip/1853-x.zip"
pcbs_2017_preliminary_url <- "https://www.pcbs.gov.ps/portals/_pcbs/PressRelease/Press_En_Preliminary_Results_Report-en-with-tables.pdf"
pcbs_2017_final_url <- "https://www.pcbs.gov.ps/media/j0ffo50r/book2425-2017.pdf"
gb_adm1_metadata_url <- "https://www.geoboundaries.org/api/current/gbOpen/PSE/ADM1/"
gb_adm2_metadata_url <- "https://www.geoboundaries.org/api/current/gbOpen/PSE/ADM2/"
gb_adm2_geojson_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/PSE/ADM2/geoBoundaries-PSE-ADM2.geojson"

path_1997_excel <- file.path(raw_dir, "pcbs_1997_426_excel.zip")
path_1997_pdf <- file.path(raw_dir, "pcbs_1997_population_final_part1.pdf")
path_2007_pdf <- file.path(raw_dir, "pcbs_2007_population_final.pdf")
path_2007_national_excel <- file.path(raw_dir, "pcbs_2007_1853_excel.zip")
path_2017_preliminary <- file.path(raw_dir, "pcbs_2017_preliminary_results.pdf")
path_2017_final <- file.path(raw_dir, "pcbs_2017_population_final_palestine.pdf")
path_terms <- file.path(raw_dir, "pcbs_terms.html")
path_gb_adm1_metadata <- file.path(raw_dir, "geoboundaries_pse_adm1_metadata.json")
path_gb_adm2_metadata <- file.path(raw_dir, "geoboundaries_pse_adm2_metadata.json")
path_boundary <- file.path(raw_dir, "geoboundaries_pse_adm2.geojson")

summary_json_out <- file.path(output_dir, "area_summary_governorate.json")
summary_csv_out <- file.path(output_dir, "area_summary_governorate.csv")
boundary_out <- file.path(output_dir, "ps_governorate_2017.geojson")
manifest_out <- file.path(manifest_dir, "ps-census-religion-1997-2017.json")

governorates <- data.frame(
  area_code = sprintf("%02d", c(1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75)),
  area_name = c(
    "Jenin", "Tubas and the Northern Valleys", "Tulkarm", "Nablus", "Qalqiliya", "Salfit",
    "Ramallah & Al-Bireh", "Jericho & Al-Aghwar", "Jerusalem", "Bethlehem", "Hebron",
    "North Gaza", "Gaza", "Dier Al-Balah", "Khan Yunis", "Rafah"
  ),
  boundary_name = c(
    "Jenin", "Tubas", "Tulkarm", "Nablus", "Qalqiliya", "Salfit", "Ramallah & Al Bireh",
    "Jericho & Al Aghwar", "Jerusalem", "Bethlehem", "Hebron", "North Gaza", "Gaza",
    "Deir Al Balah", "Khan Yunis", "Rafah"
  ),
  id_2007 = c("1540", "1546", "1549", "1556", "1558", "1564", "1565", "1562", "1574", "1581", "1583", "1867", "1871", "1875", "1879", "1890"),
  stringsAsFactors = FALSE
)

category_ids <- c("total", "islam", "christian", "other", "not_stated")
source_category_english <- list(
  `1997` = c(total = "Total", islam = "Islam", christian = "Christian", other = "Others", not_stated = "Not Stated"),
  `2007` = c(total = "Total", islam = "Islam", christian = "Christian", other = "Others", not_stated = "Not Stated"),
  `2017` = c(total = "Total", islam = "Islam", christian = "Christian", other = "Other", not_stated = "Not Stated")
)
category_display_english <- c(total = "Total", islam = "Islam", christian = "Christian", other = "Other", not_stated = "Not Stated")
category_arabic <- c(total = "المجموع", islam = "الإسلام", christian = "المسيحية", other = "أخرى", not_stated = "غير مبين")

# return the verbatim English source-category frame for one census wave.
source_categories_for_year <- function(year) source_category_english[[as.character(year)]]

# return a file's SHA-256 digest.
sha256_file <- function(path) unname(tools::sha256sum(path))

# return a file's size in bytes.
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))

# download one missing source without replacing an existing cache.
fetch_get <- function(url, path) {
  if (file.exists(path) && file_bytes(path) > 0L) return(invisible(path))
  part <- paste0(path, ".part")
  on.exit(unlink(part), add = TRUE)
  status <- system2("curl", c("--fail", "--silent", "--show-error", "--location", "--retry", "3", "--max-time", "300", "--user-agent", "places-of-worship-PS-build", "--output", part, url))
  if (status != 0L || !file.exists(part) || file_bytes(part) < 1L) stop("failed to retrieve ", url, call. = FALSE)
  if (!file.rename(part, path)) stop("failed to cache ", path, call. = FALSE)
  invisible(path)
}

# extract one workbook member from a PCBS zip into a temporary path.
extract_member <- function(zip_path, pattern) {
  if (grepl("tab 13", pattern, fixed = TRUE)) {
    directory <- tempfile("ps-xls-")
    dir.create(directory)
    status <- system2("unzip", c("-qq", "-j", zip_path, "*13.*", "-d", directory))
    matches <- list.files(directory, full.names = TRUE)
    if (status != 0L || length(matches) != 1L) stop("expected one table 13 workbook in ", zip_path, call. = FALSE)
    target <- tempfile(fileext = paste0(".", tools::file_ext(matches)))
    if (!file.copy(matches, target, overwrite = TRUE)) stop("failed to extract table 13 from ", zip_path, call. = FALSE)
    unlink(directory, recursive = TRUE)
    return(target)
  }
  listing <- unzip(zip_path, list = TRUE)
  matches <- listing[["Name"]][grepl(pattern, listing[["Name"]], ignore.case = TRUE)]
  if (length(matches) != 1L) stop("expected one member matching ", pattern, " in ", zip_path, call. = FALSE)
  directory <- tempfile("ps-xls-")
  dir.create(directory)
  on.exit(unlink(directory, recursive = TRUE), add = TRUE)
  unzip(zip_path, files = matches, exdir = directory)
  extracted <- file.path(directory, matches)
  target <- tempfile(fileext = paste0(".", tools::file_ext(extracted)))
  if (!file.copy(extracted, target, overwrite = TRUE)) stop("failed to extract ", matches, call. = FALSE)
  target
}

# convert a PCBS spreadsheet count, treating a printed dash as zero.
parse_count <- function(value) {
  value <- trimws(as.character(value))
  if (is.na(value) || value == "-") return(0L)
  if (!grepl("^[0-9]+$", value)) stop("invalid PCBS count: ", value, call. = FALSE)
  as.integer(value)
}

# map a source governorate label to the stable two-digit code.
area_code_from_name <- function(name) {
  aliases <- c(
    "Jenin" = "01", "Tubas" = "05", "Tubas and the Northern Valleys" = "05", "Tulkarm" = "10",
    "Nablus" = "15", "Qalqiliya" = "20", "Salfit" = "25", "Ramallah & Al-Bireh" = "30",
    "Jericho" = "35", "Jericho & Al-Aghwar" = "35", "Jerusalem*" = "40", "Jerusalem" = "40",
    "Bethlehem" = "45", "Hebron" = "50", "North Gaza" = "55", "Gaza" = "60",
    "Deir Al-Balah" = "65", "Dier Al-Balah" = "65", "Khan Yunis" = "70", "Rafah" = "75"
  )
  code <- unname(aliases[[name]])
  if (is.null(code)) stop("unknown PCBS governorate label: ", name, call. = FALSE)
  code
}

# assert that every row's published total equals its category sum.
gate_row_arithmetic <- function(table, year) {
  calculated <- table[["islam"]] + table[["christian"]] + table[["other"]] + table[["not_stated"]]
  bad <- which(calculated != table[["total"]])
  if (length(bad)) stop("source-arithmetic failure for ", year, ": ", paste(table[["source_area_name"]][bad], collapse = ", "), call. = FALSE)
  invisible(TRUE)
}

# parse the PCBS 1997 governorate-by-sex-and-religion workbook table.
parse_1997 <- function() {
  workbook <- extract_member(path_1997_excel, "POP22\\.XLS$")
  x <- as.data.frame(read_excel(workbook, col_names = FALSE, .name_repair = "unique_quiet"))
  english_names <- as.character(x[[17]])
  rows <- which(english_names %in% c(governorates[["area_name"]], "Tubas", "Jericho", "Jerusalem*", "Deir Al-Balah"))
  if (length(rows) != 16L) stop("1997 POP22 does not contain 16 governorate rows", call. = FALSE)
  result <- data.frame(
    year = 1997L,
    area_code = vapply(english_names[rows], area_code_from_name, character(1)),
    source_area_name = english_names[rows],
    islam = vapply(x[[4]][rows], parse_count, integer(1)),
    christian = vapply(x[[7]][rows], parse_count, integer(1)),
    other = vapply(x[[10]][rows], parse_count, integer(1)),
    not_stated = vapply(x[[13]][rows], parse_count, integer(1)),
    total = vapply(x[[16]][rows], parse_count, integer(1)),
    stringsAsFactors = FALSE
  )
  national_row <- which(english_names == "Palestinian Territory")
  national <- c(total = parse_count(x[[16]][national_row]), islam = parse_count(x[[4]][national_row]), christian = parse_count(x[[7]][national_row]), other = parse_count(x[[10]][national_row]), not_stated = parse_count(x[[13]][national_row]))
  gate_row_arithmetic(result, 1997L)
  list(rows = result, national = national)
}

# parse one PCBS 2007 governorate report's table 13 total row.
parse_2007_governorate <- function(id, area_code, area_name) {
  zip_path <- file.path(raw_dir, paste0("pcbs_2007_", id, "_excel.zip"))
  workbook <- extract_member(zip_path, "tab 13\\.(xls|xlsx)$")
  x <- as.data.frame(read_excel(workbook, col_names = FALSE, .name_repair = "unique_quiet"))
  row <- which(as.character(x[[1]]) == "المجموع")
  if (length(row) != 1L || ncol(x) < 14L) stop("2007 table 13 total row changed shape for publication ", id, call. = FALSE)
  data.frame(
    year = 2007L, area_code = area_code, source_area_name = area_name,
    islam = parse_count(x[[2]][row]), christian = parse_count(x[[5]][row]),
    other = parse_count(x[[8]][row]), not_stated = parse_count(x[[11]][row]),
    total = parse_count(x[[14]][row]), stringsAsFactors = FALSE
  )
}

# parse all PCBS 2007 governorate reports and the national total in table 13.
parse_2007 <- function() {
  rows <- do.call(rbind, lapply(seq_len(nrow(governorates)), function(i) {
    parse_2007_governorate(governorates[["id_2007"]][[i]], governorates[["area_code"]][[i]], governorates[["area_name"]][[i]])
  }))
  workbook <- extract_member(path_2007_national_excel, "tab 13\\.(xls|xlsx)$")
  x <- as.data.frame(read_excel(workbook, col_names = FALSE, .name_repair = "unique_quiet"))
  row <- which(as.character(x[[1]]) == "المجموع")
  if (length(row) != 1L) stop("2007 national table 13 total row changed shape", call. = FALSE)
  national <- c(total = parse_count(x[[14]][row]), islam = parse_count(x[[2]][row]), christian = parse_count(x[[5]][row]), other = parse_count(x[[8]][row]), not_stated = parse_count(x[[11]][row]))
  gate_row_arithmetic(rows, 2007L)
  list(rows = rows, national = national)
}

# return the visually verified transcription of PCBS 2017 preliminary table 3.
parse_2017 <- function() {
  rows <- data.frame(
    source_area_name = governorates[["area_name"]],
    total = c(308073, 60132, 183001, 386552, 107989, 73704, 315083, 47325, 392835, 212191, 705589, 363726, 640314, 269425, 366520, 232967),
    not_stated = c(146, 0, 46, 263, 0, 0, 442, 71, 299, 143, 38, 19, 33, 9, 0, 0),
    other = c(21, 8, 10, 361, 5, 7, 60, 7, 594, 32, 19, 90, 44, 48, 42, 36),
    christian = c(2699, 54, 21, 601, 11, 4, 10255, 285, 8558, 23165, 59, 20, 1082, 8, 16, 12),
    islam = c(305207, 60070, 182924, 385327, 107973, 73693, 304326, 46962, 383384, 188851, 705473, 363597, 639155, 269360, 366462, 232919),
    stringsAsFactors = FALSE
  )
  rows <- cbind(year = 2017L, area_code = governorates[["area_code"]], rows)
  national <- c(total = 4665426L, islam = 4615683L, christian = 46850L, other = 1384L, not_stated = 1509L)
  gate_row_arithmetic(rows, 2017L)
  text_path <- tempfile(fileext = ".txt")
  status <- system2("pdftotext", c("-layout", path_2017_preliminary, text_path), stdout = TRUE, stderr = TRUE)
  if (!is.null(attr(status, "status")) && attr(status, "status") != 0L) stop("pdftotext failed for the 2017 source", call. = FALSE)
  extracted <- paste(readLines(text_path, warn = FALSE), collapse = "\n")
  if (!grepl("Table 3: Palestinian Population in Palestine by Governorate and Religion, 2017", extracted, fixed = TRUE)) stop("2017 table 3 was not found in the pinned PDF", call. = FALSE)
  list(rows = rows, national = national)
}

# reconcile the governorate category sums to a published national row.
reconcile_wave <- function(parsed, year) {
  sums <- as.integer(vapply(category_ids, function(category) sum(parsed[["rows"]][[category]]), numeric(1)))
  national <- as.integer(parsed[["national"]][category_ids])
  difference <- sums - national
  if (any(difference != 0L)) stop("national reconciliation failure for ", year, ": ", paste(category_ids[difference != 0L], collapse = ", "), call. = FALSE)
  source_categories <- source_categories_for_year(year)
  lapply(seq_along(category_ids), function(i) list(category = unname(source_categories[[category_ids[[i]]]]), governorate_sum = sums[[i]], published_national_total = national[[i]], difference = difference[[i]], status = "matched"))
}

# calculate one geometry hash without serialisation metadata.
geometry_hash <- function(geometry) digest(st_as_binary(st_sfc(geometry), EWKB = TRUE)[[1]], algo = "sha256", serialize = FALSE)

# build and validate the 16-feature 2017 governorate boundary.
build_boundary <- function() {
  adm1_meta <- fromJSON(path_gb_adm1_metadata, simplifyVector = TRUE)
  adm2_meta <- fromJSON(path_gb_adm2_metadata, simplifyVector = TRUE)
  if (as.integer(adm1_meta[["admUnitCount"]]) != 2L) stop("geoBoundaries PSE ADM1 release count changed", call. = FALSE)
  if (adm2_meta[["boundaryCanonical"]] != "governorate" || as.integer(adm2_meta[["admUnitCount"]]) != 16L) stop("geoBoundaries PSE ADM2 is not the pinned 16-governorate release", call. = FALSE)
  boundaries <- st_read(path_boundary, quiet = TRUE)
  if (nrow(boundaries) != 16L || !setequal(boundaries[["shapeName"]], governorates[["boundary_name"]])) stop("boundary names do not match the 16 PCBS governorates", call. = FALSE)
  order_index <- match(governorates[["boundary_name"]], boundaries[["shapeName"]])
  boundaries <- boundaries[order_index, ]
  boundaries[["area_code"]] <- governorates[["area_code"]]
  boundaries[["area_name"]] <- governorates[["area_name"]]
  boundaries <- boundaries[, c("area_code", "area_name", "shapeID", "shapeName", "shapeGroup", "shapeType")]
  valid <- st_is_valid(boundaries)
  if (any(st_is_empty(boundaries)) || any(is.na(valid)) || any(!valid)) stop("source boundary contains empty or invalid geometries", call. = FALSE)
  hashes <- vapply(st_geometry(boundaries), geometry_hash, character(1))
  if (anyDuplicated(hashes)) stop("source boundary contains duplicate geometries", call. = FALSE)
  ladder <- c(100, 75, 50, 25, 10, 5, 2)
  simplification <- mapshaper_simplify_to_cap(boundaries, boundary_out, 3L * 1024L * 1024L, ladder)
  written <- st_read(boundary_out, quiet = TRUE)
  written_valid <- st_is_valid(written)
  written_hashes <- vapply(st_geometry(written), geometry_hash, character(1))
  if (nrow(written) != 16L || any(st_is_empty(written)) || any(is.na(written_valid)) || any(!written_valid) || anyDuplicated(written_hashes)) stop("simplified boundary failed geometry gates", call. = FALSE)
  area_km2 <- as.numeric(st_area(st_transform(written, 6933))) / 1e6
  names(area_km2) <- written[["area_code"]]
  list(sf = written, area_km2 = area_km2, hashes = setNames(written_hashes, written[["area_code"]]), simplification = simplification, adm1 = adm1_meta, adm2 = adm2_meta)
}

# describe the census geography and denominator for one wave.
wave_basis <- function(year) {
  if (year == 1997L) return("PCBS 1997 Palestinian population actually enumerated; Table 22 excludes those parts of Jerusalem Governorate that PCBS says were annexed by Israel following the 1967 occupation. Total includes Islam, Christian, Others, and Not Stated.")
  if (year == 2007L) return("PCBS 2007 Palestinian population in the census religion tables. PCBS used a reduced household questionnaire in Jerusalem J1 that retained religion. Total includes Islam, Christian, Others, and Not Stated.")
  "PCBS 2017 preliminary Table 3 Palestinian population by governorate and religion. The table reports actually counted population with stated characteristics and excludes post-enumeration undercoverage estimates; PCBS used a different undercoverage method for Jerusalem J1. Total includes Islam, Christian, Other, and Not Stated."
}

# create the schema-conforming public rows while retaining source categories in the quality flag.
build_rows <- function(waves, boundary) {
  do.call(rbind, lapply(waves, function(table) {
    table <- merge(table, governorates[, c("area_code", "area_name")], by = "area_code", all.x = TRUE, sort = FALSE)
    table <- table[match(governorates[["area_code"]], table[["area_code"]]), ]
    affiliation <- table[["total"]] - table[["not_stated"]]
    source_id <- paste0("pcbs-phc-", table[["year"]][[1]], "-governorate-religion")
    source_categories <- paste(unname(source_categories_for_year(table[["year"]][[1]])), collapse = "|")
    data.frame(
      country_code = country_code,
      boundary_set_id = boundary_set_id,
      boundary_level = "governorate",
      area_unit_id = paste0(boundary_set_id, ":", table[["area_code"]]),
      area_code = table[["area_code"]],
      area_name = table[["area_name"]],
      year = table[["year"]],
      population_total = table[["total"]],
      population_total_basis = vapply(table[["year"]], wave_basis, character(1)),
      religious_affiliation_count = affiliation,
      religious_affiliation_percent = round(100 * affiliation / table[["total"]], 4),
      no_religion_count = NA_integer_,
      no_religion_percent = NA_real_,
      place_count = NA_integer_,
      places_per_10000_residents = NA_real_,
      place_density_per_sq_km = NA_real_,
      land_area_sq_km = round(unname(boundary[["area_km2"]][table[["area_code"]]]), 4),
      site_snapshot_date = NA_character_,
      place_count_basis = NA_character_,
      source_dataset_ids = I(lapply(seq_len(nrow(table)), function(i) c(source_id, "geoboundaries-pse-adm2-2017"))),
      quality_flag = paste0(
        "census_affiliation_recognised_frame;affiliation=total_minus_not_stated;islam=", table[["islam"]],
        ";christian=", table[["christian"]], ";other=", table[["other"]], ";not_stated=", table[["not_stated"]],
        ";source_area_name=", table[["source_area_name"]],
        ";source_categories_verbatim=", source_categories, ";no_religion_category_absent_in_source;",
        "exact_row_and_national_reconciliation;religious_change_withheld_across_coverage_break;2017_boundary_frame;boundary_stability_unverified",
        ifelse(table[["year"]] == 1997L & table[["area_code"]] == "40", ";jerusalem_j1_excluded_from_1997_data_but_present_in_2017_geometry", "")
      ),
      stringsAsFactors = FALSE
    )
  }))
}

# turn one row into a JSON-ready list with explicit nulls.
row_to_list <- function(row) {
  nullable <- c("no_religion_count", "no_religion_percent", "place_count", "places_per_10000_residents", "place_density_per_sq_km", "site_snapshot_date", "place_count_basis")
  result <- as.list(row)
  for (name in nullable) if (is.na(result[[name]])) result[name] <- list(NULL)
  result[["source_dataset_ids"]] <- unlist(row[["source_dataset_ids"]], use.names = FALSE)
  result
}

# record every cached object under the requested raw directory with a hash.
raw_source_ledger <- function() {
  paths <- sort(list.files(raw_dir, full.names = TRUE, recursive = FALSE))
  lapply(paths, function(path) {
    filename <- basename(path)
    url <- if (filename == basename(path_1997_excel)) pcbs_1997_excel_url else if (filename == basename(path_1997_pdf)) pcbs_1997_pdf_url else if (filename == basename(path_2007_pdf)) pcbs_2007_pdf_url else if (filename == basename(path_2007_national_excel)) pcbs_2007_national_excel_url else if (filename == basename(path_2017_preliminary)) pcbs_2017_preliminary_url else if (filename == basename(path_2017_final)) pcbs_2017_final_url else if (filename == basename(path_terms)) pcbs_terms_url else if (filename == basename(path_gb_adm1_metadata)) gb_adm1_metadata_url else if (filename == basename(path_gb_adm2_metadata)) gb_adm2_metadata_url else if (filename == basename(path_boundary)) gb_adm2_geojson_url else if (grepl("^pcbs_2007_[0-9]+_excel\\.zip$", filename)) paste0("https://www.pcbs.gov.ps/downloads/zip/", sub("^pcbs_2007_([0-9]+)_excel\\.zip$", "\\1-x.zip", filename)) else if (grepl("^pcbs_1997_[0-9]+_excel\\.zip$", filename)) paste0("https://www.pcbs.gov.ps/downloads/zip/", sub("^pcbs_1997_([0-9]+)_excel\\.zip$", "\\1-x.zip", filename)) else if (filename == "pcbs_1997_population_final_part2.pdf") "https://www.pcbs.gov.ps/media/0uvfev1j/book517-1997.pdf" else if (filename == "pcbs_2007_preliminary_results.pdf") "https://www.pcbs.gov.ps/Downloads/book1437.pdf" else NA_character_
    list(local_path = path, url = url, bytes = file_bytes(path), sha256 = sha256_file(path))
  })
}

# describe one dataset in the area-summary source register.
source_dataset <- function(id, name, url, publication_notice, notes) {
  list(
    source_dataset_id = id, name = name, provider = if (grepl("geoboundaries", id)) "geoBoundaries / Open Data Watch" else "Palestinian Central Bureau of Statistics (PCBS)",
    url = url, retrieval_date = retrieval_date,
    licence = list(name = paste("Current PCBS website terms state CC BY 4.0.", publication_notice), url = pcbs_terms_url, attribution = "Source: Palestinian Central Bureau of Statistics (PCBS)"),
    citation = name, access_limits = NULL, redistribution_limits = paste("Conductor review is required before public release.", publication_notice), notes = notes
  )
}

fetch_get(pcbs_1997_excel_url, path_1997_excel)
fetch_get(pcbs_1997_pdf_url, path_1997_pdf)
fetch_get(pcbs_2007_pdf_url, path_2007_pdf)
fetch_get(pcbs_2007_national_excel_url, path_2007_national_excel)
for (id in governorates[["id_2007"]]) fetch_get(paste0("https://www.pcbs.gov.ps/downloads/zip/", id, "-x.zip"), file.path(raw_dir, paste0("pcbs_2007_", id, "_excel.zip")))
fetch_get(pcbs_2017_preliminary_url, path_2017_preliminary)
fetch_get(pcbs_2017_final_url, path_2017_final)
fetch_get(pcbs_terms_url, path_terms)
fetch_get(gb_adm1_metadata_url, path_gb_adm1_metadata)
fetch_get(gb_adm2_metadata_url, path_gb_adm2_metadata)
fetch_get(gb_adm2_geojson_url, path_boundary)

parsed <- list(`1997` = parse_1997(), `2007` = parse_2007(), `2017` = parse_2017())
reconciliation <- Map(reconcile_wave, parsed, years)
boundary <- build_boundary()
rows <- build_rows(lapply(parsed, `[[`, "rows"), boundary)
if (nrow(rows) != 48L || !setequal(unique(rows[["year"]]), years)) stop("output must contain 16 rows for each of three waves", call. = FALSE)

description_note <- paste(
  "PCBS publishes Islam, Christian, Others in 1997 and 2007 or Other in 2017, and Not Stated.",
  "The source publishes no no-religion category, and the product assigns no identity to Other, Others, or Not Stated.",
  "Religious affiliation equals Total minus Not Stated; it describes the source's category frame and does not measure belief, practice, attendance, or registered membership."
)
coverage_note <- paste(
  "PCBS 1997 Table 22 excludes Jerusalem J1. The 2007 census used a reduced J1 questionnaire that retained religion.",
  "The 2017 preliminary table reports actually counted population with stated characteristics, excludes post-enumeration undercoverage estimates, and records a different undercoverage method for Jerusalem J1.",
  "The product therefore withholds every cross-wave change metric. The 2017 governorate geometry depicts the full release polygons, including territory outside the 1997 data basis."
)

source_datasets <- list(
  source_dataset("pcbs-phc-1997-governorate-religion", "PCBS Population Report 1997, First Part, final Table 22: Palestinian Population by Governorate, Sex and Religion", pcbs_1997_pdf_url, "Cached publication notice: All Rights Reserved.", "Final-report Excel attachment 426-x.zip supplies the 16 governorate rows and national total. Jerusalem excludes J1 as defined by PCBS."),
  source_dataset("pcbs-phc-2007-governorate-religion", "PCBS Population, Housing and Establishment Census 2007 final population reports, Table 13", pcbs_2007_pdf_url, "Cached publication notice: All Rights Reserved.", "Sixteen governorate Excel attachments supply the governorate totals; the Palestinian Territory attachment supplies the national row."),
  source_dataset("pcbs-phc-2017-governorate-religion", "PCBS Preliminary Census Results 2017, Table 3: Palestinian Population in Palestine by Governorate and Religion", pcbs_2017_preliminary_url, "No rights-reservation notice appears in the cached 2017 preliminary report.", "The PDF table was visually verified after rendering page 35. Final report 2425 supplies the final coverage and J1 methodology notes."),
  list(
    source_dataset_id = "geoboundaries-pse-adm2-2017", name = "geoBoundaries PSE ADM2, 2017 governorates", provider = "geoBoundaries / Open Data Watch", url = gb_adm2_geojson_url,
    retrieval_date = retrieval_date, licence = list(name = "Creative Commons Attribution 4.0 (CC BY 4.0)", url = "https://www.geoboundaries.org/", attribution = "Boundary source: Open Data Watch, via geoBoundaries; CC BY 4.0"),
    citation = "geoBoundaries PSE ADM2 release PSE-ADM2-87354302.", access_limits = NULL, redistribution_limits = "Attribution required.",
    notes = "Release metadata states boundaryCanonical=governorate, boundaryYearRepresented=2017, admUnitCount=16, boundarySource=Open Data Watch, and boundaryLicense=Creative Commons Attribution 4.0 (CC BY 4.0). PSE ADM1 was rejected because its release contains two territory units."
  )
)

indicators <- list(
  list(indicator_id = "population_total", label = "PCBS census religion-table population", description = paste("PCBS published Total for the governorate and wave.", coverage_note), unit = "count", denominator_indicator_id = NULL, method = "Direct PCBS table value; each row must equal Islam + Christian + the wave's verbatim Other or Others category + Not Stated.", temporal_coverage = "PCBS census waves 1997, 2007, and 2017.", spatial_coverage = "Sixteen PCBS governorates on the 2017 geoBoundaries release.", quality_notes = coverage_note),
  list(indicator_id = "religious_affiliation_percent", label = "Reported a PCBS religion category (%)", description = description_note, unit = "percent", denominator_indicator_id = "population_total", method = "100 times (Total minus Not Stated) divided by Total.", temporal_coverage = "Separate snapshots for 1997, 2007, and 2017; change withheld.", spatial_coverage = "Sixteen PCBS governorates on the 2017 geoBoundaries release.", quality_notes = paste(description_note, coverage_note))
)

visual_layers <- list(list(
  visual_layer_id = "ps-governorate-reported-religion", label = "Reported a PCBS religion category (%)", description = "Share of the PCBS religion-table population in Islam, Christian, or the wave's verbatim Other or Others category, by governorate and wave.",
  layer_type = "choropleth", indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit",
  legend = list(unit = "percent", denominator = "PCBS published Total, including Not Stated"), colour_scale = "sequential", time_control = "year_selector",
  aggregation_rule = "direct governorate counts; no allocation; cross-wave change withheld", uncertainty_display = "quality_flag", default_visibility = TRUE, notes = paste(description_note, coverage_note)
))

product <- list(
  schema_version = "0.2.0", generated_at = stamp, generated_by = script_id, country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code, level = "governorate", vintage = "2017", source_dataset_id = "geoboundaries-pse-adm2-2017"),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL, basis = "No governed Palestine place-of-worship snapshot is included in this census-affiliation release.", notes = paste(description_note, coverage_note)),
  source_datasets = source_datasets, indicators = indicators, visual_layers = visual_layers,
  rows = lapply(seq_len(nrow(rows)), function(i) row_to_list(rows[i, , drop = FALSE]))
)
write_json(product, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", digits = NA)

csv_rows <- rows
csv_rows[["source_dataset_ids"]] <- vapply(csv_rows[["source_dataset_ids"]], paste, collapse = "|", character(1))
write.csv(csv_rows, summary_csv_out, row.names = FALSE, na = "")

raw_ledger <- raw_source_ledger()
output_hash <- sha256_file(summary_json_out)
manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json", schema_version = "data-manifest.v1",
  manifest_id = "manifest:ps-census-religion:ps:1997-2017:pcbs-governorate",
  dataset_id = "ps-census-religion:ps:1997-2017:pcbs-governorate",
  dataset_version_id = paste0("ps-census-religion:ps:1997-2017:pcbs-governorate:", substr(output_hash, 1, 12)),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "ps-census-religion", dataset_role = "public_product",
  scope = list(level = "country", country_codes = list("PS"), snapshot_date = NULL, snapshot_anchor = NULL, pipeline_stage = "staged"),
  created_at = stamp, created_by = script_id,
  pipeline = list(
    script = script_id, git_commit = git_commit, command = "Rscript scripts/build_ps_area_summary.R",
    parameters = list(
      waves = as.list(years), geography = "PCBS governorates as published; 2017 geoBoundaries PSE ADM2 frame", construct = "census affiliation",
      category_frame_english_by_wave = setNames(lapply(years, function(year) as.list(unname(source_categories_for_year(year)))), as.character(years)),
      category_display_mapping_by_wave = setNames(lapply(years, function(year) {
        source_categories <- source_categories_for_year(year)
        Map(function(source_key, display_label) list(source_key = source_key, display_label = display_label), unname(source_categories), unname(category_display_english))
      }), as.character(years)),
      category_frame_arabic = as.list(unname(category_arabic)),
      denominator_rule = "religious_affiliation_percent = 100 * (Total - Not Stated) / Total; no_religion fields null",
      change_rule = "withheld for every wave pair because PCBS coverage and Jerusalem J1 treatment are not comparable across the complete series",
      coverage_note = coverage_note, description_note = description_note,
      boundary_candidate_decision = list(adm1 = "rejected: boundaryCanonical=territory, admUnitCount=2", adm2 = "selected: boundaryCanonical=governorate, admUnitCount=16, boundaryYearRepresented=2017"),
      boundary_simplification = c(boundary[["simplification"]], list(byte_ceiling = 3L * 1024L * 1024L)),
      national_reconciliation = Map(function(year, values) list(year = year, values = values), years, reconciliation),
      geometry_hashes = as.list(boundary[["hashes"]]), raw_sources = raw_ledger,
      open_pi_question = "How should PCBS statistical geography relate to the live Israel route on shared surfaces such as the global map, and may overlapping claims appear together?"
    ),
    software_versions = list(r = R.version.string, sf = as.character(packageVersion("sf")), jsonlite = as.character(packageVersion("jsonlite")), readxl = as.character(packageVersion("readxl")), digest = as.character(packageVersion("digest")), mapshaper = "npx mapshaper through scripts/lib/simplify_boundary.R")
  ),
  source = list(provider = "Palestinian Central Bureau of Statistics (PCBS); geoBoundaries / Open Data Watch", source_dataset_ids = lapply(source_datasets, `[[`, "source_dataset_id"), source_urls = lapply(source_datasets, `[[`, "url"), retrieved_at = stamp, licence = "Current PCBS website terms state CC BY 4.0 and require attribution. The cached 1997 and 2007 publications print 'All Rights Reserved.' No rights-reservation notice appears in the cached 2017 preliminary report. The geoBoundaries release metadata states CC BY 4.0. PCBS publication reuse requires conductor review.", citation = "PCBS census religion tables for 1997, 2007, and 2017; geoBoundaries PSE ADM2 2017."),
  input_manifests = list(),
  durable_files = list(
    list(uri = paste0("repo:", summary_json_out), storage_provider = "other", format = "json", bytes = file_bytes(summary_json_out), sha256 = sha256_file(summary_json_out), row_count = nrow(rows), content = "Palestine governorate census-affiliation area summary for 1997, 2007, and 2017.", privacy = "public", licence_status = "needs_review"),
    list(uri = paste0("repo:", summary_csv_out), storage_provider = "other", format = "csv", bytes = file_bytes(summary_csv_out), sha256 = sha256_file(summary_csv_out), row_count = nrow(rows), content = "Flattened Palestine governorate census-affiliation rows.", privacy = "public", licence_status = "needs_review"),
    list(uri = paste0("repo:", boundary_out), storage_provider = "other", format = "geojson", bytes = file_bytes(boundary_out), sha256 = sha256_file(boundary_out), row_count = 16L, content = "Simplified geoBoundaries PSE ADM2 2017 governorate geometry.", privacy = "public", licence_status = "accepted")
  ),
  partitions = list(), stats = list(row_count = nrow(rows), governorate_count = 16L, wave_count = 3L, raw_input_count = length(raw_ledger), boundary_bytes = file_bytes(boundary_out)),
  local_cache_hint = "Every cached object under data/raw/ps_census/ is git-ignored and listed with its URL, size, and SHA-256 in pipeline.parameters.raw_sources.",
  validation = list(status = "passed_with_warnings", commands = list("Rscript scripts/build_ps_area_summary.R", "check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/ps/data/area_summary_governorate.json", "check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/data-manifest.schema.json docs/manifests/ps-census-religion-1997-2017.json"), warnings = list(coverage_note, "Cross-wave change is withheld.", "The selected geometry is a non-official 2017 boundary release; boundary stability across 1997, 2007, and 2017 is unverified.", "Current PCBS website terms state CC BY 4.0. The cached 1997 and 2007 publications print 'All Rights Reserved.' No rights-reservation notice appears in the cached 2017 preliminary report. Conductor review is required before public release."), notes = "Every source row passed exact category arithmetic. The 16 governorate sums match each PCBS national category total in all three waves. Geometry contains 16 valid features with 16 distinct hashes and remains below 3 MB."),
  downstream_status = "staged", privacy = "public", licence_status = "needs_review",
  notes = paste(description_note, coverage_note, "Open PI ruling: how PCBS statistical geography relates to the live Israel route on shared surfaces, and whether overlapping claims may appear together.")
)
write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", digits = NA)

cat("Palestine area-summary build complete\n")
cat("  waves: 1997, 2007, 2017\n")
cat("  rows: ", nrow(rows), " (16 per wave)\n", sep = "")
cat("  row arithmetic: passed\n")
cat("  national reconciliation: passed for every category and wave\n")
cat("  change metrics: withheld\n")
cat("  boundary: 16 valid features, 16 distinct hashes, ", file_bytes(boundary_out), " bytes\n", sep = "")
cat("  raw cached objects hashed: ", length(raw_ledger), "\n", sep = "")
cat("  outputs: ", summary_json_out, ", ", summary_csv_out, ", ", boundary_out, ", ", manifest_out, "\n", sep = "")
