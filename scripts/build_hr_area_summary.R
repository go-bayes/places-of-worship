# build the Croatia county census-affiliation area-summary product.
# inputs: Croatian Bureau of Statistics census tables for 2001, 2011, and 2021,
# methodology and terms pages, and the State Geodetic Administration INSPIRE WFS.
# outputs: apps/regions/hr/data/area_summary_county.{json,csv}, a simplified
# county GeoJSON, and docs/manifests/hr-census-religion-2001-2021.json.
# run from the repository root: Rscript scripts/build_hr_area_summary.R

suppressMessages({
  library(digest)
  library(jsonlite)
  library(readxl)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

raw_dir <- "data/raw/hr_census"
output_dir <- "apps/regions/hr/data"
manifest_dir <- "docs/manifests"
dir.create(raw_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

country_code <- "HR"
years <- c(2001L, 2011L, 2021L)
retrieval_date <- "2026-07-10"
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
script_id <- "scripts/build_hr_area_summary.R"
git_commit <- system("git rev-parse --short HEAD", intern = TRUE)
boundary_level <- "county"
boundary_vintage <- "2026"
boundary_set_id <- paste0("hr-county-", boundary_vintage, "-dgu-au")
census_dataset_id <- "dzs-census-religion-county-2001-2021"
boundary_dataset_id <- paste0("dgu-inspire-administrative-units-counties-", boundary_vintage)
terms_dataset_id <- "dzs-website-terms"
boundary_terms_dataset_id <- "dgu-administrative-units-open-licence-metadata"

results_2001_en_url <- "https://web.dzs.hr/Eng/censuses/Census2001/Popis/E01_02_04/E01_02_04.html"
results_2001_hr_url <- "https://web.dzs.hr/Hrv/censuses/Census2001/Popis/H01_02_04/H01_02_04.html"
method_2001_url <- "https://web.dzs.hr/Eng/censuses/Census2001/census_met.htm"
territory_2001_url <- "https://web.dzs.hr/Eng/censuses/Census2001/census_terr.htm"
results_2011_en_url <- "https://web.dzs.hr/eng/censuses/census2011/results/xls/Grad_03_EN.xls"
results_2011_hr_url <- "https://web.dzs.hr/hrv/censuses/census2011/results/xls/Grad_03_HR.xls"
method_2011_url <- "https://web.dzs.hr/Eng/censuses/census2011/results/censusmetod.htm"
results_2021_page_url <- "https://dzs.gov.hr/u-fokusu/popis-2021/popisni-upitnik/english/results/1501"
results_2021_url <- "https://podaci.dzs.hr/media/td3jvrbu/popis_2021-stanovnistvo_po_gradovima_opcinama.xlsx"
method_2021_url <- "https://podaci.dzs.hr/2021/en/39858"
dzs_terms_url <- "https://dzs.gov.hr/uvjeti-koristenja/76"
dgu_wfs_url <- "https://geoportal.dgu.hr/services/inspire/au/wfs"
dgu_capabilities_url <- paste0(dgu_wfs_url, "?service=WFS&request=GetCapabilities&version=2.0.0")
dgu_metadata_url <- paste0(
  "https://geoportal.nipp.hr/geonetwork/srv/hrv/xml.metadata.get?uuid=",
  "08b28e14-01d7-4142-ae8e-217bf2a8d21b"
)
dgu_open_licence_url <- "https://data.gov.hr/otvorena-dozvola"
dgu_boundary_url <- paste0(
  dgu_wfs_url,
  "?service=WFS&version=2.0.0&request=GetFeature",
  "&typeNames=au%3AAU.AdministrativeUnit",
  "&cql_filter=national_level%3D%272ndOrder%27",
  "&outputFormat=application%2Fjson&srsName=EPSG%3A4326"
)

results_2001_en_path <- file.path(raw_dir, "dzs_2001_religion_counties_en.html")
results_2001_hr_path <- file.path(raw_dir, "dzs_2001_religion_counties_hr.html")
method_2001_path <- file.path(raw_dir, "dzs_2001_methodology_en.html")
territory_2001_path <- file.path(raw_dir, "dzs_2001_territorial_constitution_en.html")
results_2011_en_path <- file.path(raw_dir, "dzs_2011_religion_towns_municipalities_en.xls")
results_2011_hr_path <- file.path(raw_dir, "dzs_2011_religion_towns_municipalities_hr.xls")
method_2011_path <- file.path(raw_dir, "dzs_2011_methodology_en.html")
results_2021_page_path <- file.path(raw_dir, "dzs_2021_results_en.html")
results_2021_path <- file.path(raw_dir, "dzs_2021_population_towns_municipalities.xlsx")
method_2021_path <- file.path(raw_dir, "dzs_2021_methodology_en.html")
dzs_terms_path <- file.path(raw_dir, "dzs_website_terms_hr.html")
dgu_capabilities_path <- file.path(raw_dir, "dgu_administrative_units_wfs_capabilities.xml")
dgu_metadata_path <- file.path(raw_dir, "dgu_administrative_units_metadata.xml")
dgu_open_licence_path <- file.path(raw_dir, "croatian_open_licence.html")
dgu_boundary_path <- file.path(raw_dir, paste0("dgu_counties_", retrieval_date, ".geojson"))

summary_json_out <- file.path(output_dir, "area_summary_county.json")
summary_csv_out <- file.path(output_dir, "area_summary_county.csv")
boundary_out <- file.path(output_dir, paste0("hr_county_", boundary_vintage, ".geojson"))
manifest_out <- file.path(manifest_dir, "hr-census-religion-2001-2021.json")

county_codes <- sprintf("%02d", 1:21)
county_names_hr <- c(
  "Zagrebačka županija", "Krapinsko-zagorska županija", "Sisačko-moslavačka županija",
  "Karlovačka županija", "Varaždinska županija", "Koprivničko-križevačka županija",
  "Bjelovarsko-bilogorska županija", "Primorsko-goranska županija", "Ličko-senjska županija",
  "Virovitičko-podravska županija", "Požeško-slavonska županija", "Brodsko-posavska županija",
  "Zadarska županija", "Osječko-baranjska županija", "Šibensko-kninska županija",
  "Vukovarsko-srijemska županija", "Splitsko-dalmatinska županija", "Istarska županija",
  "Dubrovačko-neretvanska županija", "Međimurska županija", "Grad Zagreb"
)
names(county_names_hr) <- county_codes

codes_2001 <- c(
  "TOTAL", "CATHOLIC_CHURCH", "GREEK_CATHOLIC_CHURCH", "OLD_CATHOLIC_CHURCH",
  "ORTHODOX_CHURCH", "ORTHODOX_BULGARIAN", "ORTHODOX_MONTENEGRIN", "ORTHODOX_GREEK",
  "ORTHODOX_MACEDONIAN", "ORTHODOX_ROMANIAN", "ORTHODOX_RUSSIAN", "ORTHODOX_SERBIAN",
  "ISLAMIC_RELIGIOUS_COMMUNITY", "JEWISH_RELIGIOUS_COMMUNITY", "ADVENTIST_CHURCH",
  "BAPTIST_CHURCH", "EVANGELIC_CHURCH", "JEHOVAHS_WITNESSES", "CALVINIST_CHURCH",
  "METHODIST_CHURCH", "CHRIST_PENTECOSTAL_CHURCH", "OTHER_RELIGIONS",
  "AGNOSTIC_AND_UNCOMMITTED", "NON_BELIEVERS", "UNKNOWN"
)
labels_2001_hr <- c(
  "Ukupno", "Katolička crkva", "Grkokatolička crkva", "Starokatolička crkva",
  "Pravoslavna crkva — svega", "Bugarska pravoslavna crkva", "Crnogorska pravoslavna crkva",
  "Grčka pravoslavna crkva", "Makedonska pravoslavna crkva", "Rumunjska pravoslavna crkva",
  "Ruska pravoslavna crkva", "Srpska pravoslavna crkva", "Islamska vjerska zajednica",
  "Židovska vjerska zajednica", "Adventistička crkva", "Baptistička crkva",
  "Evangelička crkva", "Jehovini svjedoci", "Kalvinistička crkva", "Metodistička crkva",
  "Kristova pentekostna crkva", "Ostale vjere", "Agnostici i neizjašnjeni",
  "Nisu vjernici", "Nepoznato"
)
labels_2001_en <- c(
  "Total", "Catholic Church", "Greek Catholic Church", "Old-Catholic Church",
  "Orthodox Church — All", "Bulgarian Orthodox Church", "Montenegrin Orthodox Church",
  "Greek Orthodox Church", "Macedonian Orthodox Church", "Romanian Orthodox Church",
  "Russian Orthodox Church", "Serbian Orthodox Church", "Islamic Religious Community",
  "Jewish Religious Community", "Adventist Church", "Baptist Church", "Evangelic Church",
  "Jehovah's Witnesses", "Calvinist Church", "Methodist Church", "Christ Pentecostal Church",
  "Other religions", "Agnostic and uncommitted", "Non-believers", "Unknown"
)

codes_modern <- c(
  "TOTAL", "CATHOLICS", "ORTHODOX", "PROTESTANTS", "OTHER_CHRISTIANS", "MUSLIMS",
  "JEWS", "ORIENTAL_RELIGIONS", "OTHER_RELIGIONS_MOVEMENTS_WORLDVIEWS",
  "AGNOSTICS_AND_SCEPTICS", "NOT_RELIGIOUS_AND_ATHEISTS", "NOT_DECLARED", "UNKNOWN"
)
labels_modern_hr <- c(
  "Ukupno", "Katolici", "Pravoslavci", "Protestanti", "Ostali kršćani", "Muslimani",
  "Židovi", "Istočne religije", "Ostale religije, pokreti i svjetonazori",
  "Agnostici i skeptici", "Nisu vjernici i ateisti", "Ne izjašnjavaju se", "Nepoznato"
)
labels_modern_en <- c(
  "Total", "Catholics", "Orthodox", "Protestants", "Other Christians", "Muslims", "Jews",
  "Oriental religions", "Other religions, movements and life philosophies",
  "Agnostics and sceptics", "Not religious and atheists", "Not declared", "Unknown"
)

# return a file's SHA-256 digest.
sha256_file <- function(path) unname(tools::sha256sum(path))

# return a file's size in bytes.
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))

# fetch one public source and record its first successful retrieval.
fetch_file <- function(url, path) {
  if (file.exists(path) && file_bytes(path) > 0L) return(invisible(path))
  temporary_path <- paste0(path, ".part")
  on.exit(unlink(temporary_path), add = TRUE)
  status <- system2(
    "curl",
    c(
      "--http1.1", "-L", "--fail", "--silent", "--show-error", "--retry", "3",
      "--max-time", "900", "-A", "places-of-worship-HR-build", "-o", shQuote(temporary_path), shQuote(url)
    )
  )
  if (!identical(status, 0L) || !file.exists(temporary_path) || file_bytes(temporary_path) < 1L) {
    stop("failed to retrieve ", url, call. = FALSE)
  }
  if (!file.rename(temporary_path, path)) stop("failed to cache ", path, call. = FALSE)
  write_json(
    list(url = url, retrieved_at = stamp, http_status = 200L),
    paste0(path, ".meta.json"),
    auto_unbox = TRUE,
    pretty = TRUE
  )
  invisible(path)
}

# read a raw source's retrieval metadata sidecar.
read_meta <- function(path) {
  meta_path <- paste0(path, ".meta.json")
  if (!file.exists(meta_path)) stop("missing retrieval metadata: ", meta_path, call. = FALSE)
  fromJSON(meta_path, simplifyVector = FALSE)
}

# convert one published integer cell, including a source dash for zero.
published_integer <- function(value) {
  cleaned <- trimws(gsub("[^0-9-]", "", value))
  cleaned[cleaned == "-"] <- "0"
  output <- suppressWarnings(as.integer(cleaned))
  if (any(is.na(output))) stop("non-integer census value encountered", call. = FALSE)
  output
}

# extract table-body rows from one Windows-1250 DZS HTML table.
html_table_rows <- function(path) {
  source <- iconv(
    readChar(path, file.info(path)[["size"]], useBytes = TRUE),
    from = "windows-1250",
    to = "UTF-8"
  )
  body <- regmatches(source, regexpr("(?is)<tbody.*?</tbody>", source, perl = TRUE))
  if (length(body) != 1L || !nzchar(body)) stop("DZS HTML table body is absent", call. = FALSE)
  rows <- regmatches(body, gregexpr("(?is)<tr.*?</tr>", body, perl = TRUE))[[1L]]
  lapply(rows, function(row) {
    cells <- regmatches(row, gregexpr("(?is)<td[^>]*>.*?</td>", row, perl = TRUE))[[1L]]
    text <- gsub("(?is)<[^>]+>", "", cells, perl = TRUE)
    trimws(gsub("[[:space:]]+", " ", gsub("&nbsp;", " ", text, fixed = TRUE)))
  })
}

# parse the national and 21 county rows from a 2001 DZS HTML table.
parse_2001 <- function(path) {
  rows <- html_table_rows(path)
  data_rows <- rows[lengths(rows) == 26L & !vapply(rows, function(x) grepl("Percentage|Postotak", x[[1L]]), logical(1))]
  if (length(data_rows) != 22L) stop("expected one national and 21 county rows in 2001", call. = FALSE)
  values <- do.call(rbind, lapply(data_rows, function(row) published_integer(row[-1L])))
  colnames(values) <- codes_2001
  data.frame(
    source_area_name = vapply(data_rows, `[[`, character(1), 1L),
    area_code = c("00", county_codes),
    values,
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
}

# parse one 2011 DZS workbook and retain national and county count rows.
parse_2011 <- function(path) {
  source <- read_excel(path, sheet = 1L, col_names = FALSE, col_types = "text")
  selected <- is.na(source[[2L]]) & is.na(source[[3L]]) &
    grepl("^(Republic|County|City|Republika|Zagrebačka|Krapinsko|Sisačko|Karlovačka|Varaždinska|Koprivničko|Bjelovarsko|Primorsko|Ličko|Virovitičko|Požeško|Brodsko|Zadarska|Osječko|Šibensko|Vukovarsko|Splitsko|Istarska|Dubrovačko|Međimurska|Grad Zagreb)", source[[1L]]) &
    grepl("^[0-9]+$", source[[4L]])
  source <- source[selected, , drop = FALSE]
  if (nrow(source) != 22L) stop("expected one national and 21 county rows in 2011", call. = FALSE)
  values <- vapply(seq(4L, 28L, 2L), function(index) published_integer(source[[index]]), integer(22L))
  colnames(values) <- codes_modern
  data.frame(
    source_area_name = source[[1L]],
    area_code = c("00", county_codes),
    values,
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
}

# parse the bilingual 2021 DZS workbook's religion sheet.
parse_2021 <- function(path) {
  source <- read_excel(path, sheet = "2.", col_names = FALSE, col_types = "text")
  selected <- is.na(source[[2L]]) & is.na(source[[4L]]) & is.na(source[[5L]]) &
    !is.na(source[[3L]]) & grepl("^[0-9]+$", source[[6L]])
  source <- source[selected, , drop = FALSE]
  if (nrow(source) != 22L) stop("expected one national and 21 county rows in 2021", call. = FALSE)
  values <- vapply(seq(6L, 30L, 2L), function(index) published_integer(source[[index]]), integer(22L))
  colnames(values) <- codes_modern
  data.frame(
    source_area_name = source[[3L]],
    area_code = c("00", county_codes),
    values,
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
}

# validate bilingual category labels at the two workbook sources.
validate_workbook_labels <- function() {
  source_2011_hr <- read_excel(results_2011_hr_path, col_names = FALSE, col_types = "text", n_max = 2L)
  source_2011_en <- read_excel(results_2011_en_path, col_names = FALSE, col_types = "text", n_max = 2L)
  observed_2011_hr <- as.character(unlist(source_2011_hr[2L, seq(4L, 28L, 2L)], use.names = FALSE))
  observed_2011_en <- as.character(unlist(source_2011_en[2L, seq(4L, 28L, 2L)], use.names = FALSE))
  if (!identical(observed_2011_hr, labels_modern_hr) || !identical(observed_2011_en, labels_modern_en)) {
    stop("2011 DZS religion labels changed", call. = FALSE)
  }
  source_2021 <- read_excel(results_2021_path, sheet = "2.", col_names = FALSE, col_types = "text", n_max = 8L)
  observed_2021 <- as.character(unlist(source_2021[8L, seq(6L, 30L, 2L)], use.names = FALSE))
  if (length(observed_2021) != 13L ||
      !all(vapply(seq_along(labels_modern_hr), function(index) {
        grepl(labels_modern_hr[[index]], observed_2021[[index]], fixed = TRUE) &&
          grepl(gsub("Other Christians", "Other Christians", labels_modern_en[[index]]), observed_2021[[index]], fixed = TRUE)
      }, logical(1)))) {
    stop("2021 DZS bilingual religion labels changed", call. = FALSE)
  }
  invisible(TRUE)
}

# return a source category's product role for one wave.
category_role <- function(year, code) {
  if (code == "TOTAL") return("population_total")
  if (year == 2001L && startsWith(code, "ORTHODOX_") && code != "ORTHODOX_CHURCH") {
    return("affiliation_detail_not_summed")
  }
  named <- if (year == 2001L) {
    c(codes_2001[2:5], codes_2001[13:22])
  } else {
    codes_modern[2:9]
  }
  if (code %in% named) return("religious_affiliation")
  if (code %in% c("NON_BELIEVERS", "NOT_RELIGIOUS_AND_ATHEISTS")) return("no_religion")
  if (code %in% c("AGNOSTIC_AND_UNCOMMITTED", "AGNOSTICS_AND_SCEPTICS")) return("agnostic_outside_headlines")
  if (code == "NOT_DECLARED") return("not_declared")
  if (code == "UNKNOWN") return("unknown")
  stop("unclassified category: ", code, call. = FALSE)
}

# enforce within-area and county-to-national exact reconciliation for one wave.
validate_wave <- function(year, data) {
  codes <- if (year == 2001L) codes_2001 else codes_modern
  county <- data[data[["area_code"]] != "00", , drop = FALSE]
  national <- data[data[["area_code"]] == "00", , drop = FALSE]
  if (nrow(county) != 21L || nrow(national) != 1L || !identical(county[["area_code"]], county_codes)) {
    stop("wave geography changed for ", year, call. = FALSE)
  }
  exclusive <- if (year == 2001L) c(codes_2001[2:5], codes_2001[13:25]) else codes_modern[-1L]
  within_difference <- rowSums(data[, exclusive, drop = FALSE]) - data[["TOTAL"]]
  if (any(within_difference != 0L)) stop("within-area reconciliation failed for ", year, call. = FALSE)
  reconciliation <- lapply(codes, function(code) {
    county_sum <- sum(county[[code]])
    national_total <- national[[code]][[1L]]
    difference <- county_sum - national_total
    if (difference != 0L) stop("county-national reconciliation failed for ", year, " ", code, call. = FALSE)
    list(
      source_code = code,
      source_name_hr = if (year == 2001L) labels_2001_hr[[match(code, codes_2001)]] else labels_modern_hr[[match(code, codes_modern)]],
      source_display_en = if (year == 2001L) labels_2001_en[[match(code, codes_2001)]] else labels_modern_en[[match(code, codes_modern)]],
      county_sum = county_sum,
      published_national_total = national_total,
      difference = difference,
      status = "matched"
    )
  })
  list(
    year = year,
    county_count = nrow(county),
    published_category_rows_including_total = length(codes),
    mutually_exclusive_categories_excluding_total = length(exclusive),
    within_area_category_sums_exact = TRUE,
    county_category_sums_exact = TRUE,
    max_absolute_difference = 0L,
    national_total = national[["TOTAL"]][[1L]],
    national_not_declared = if (year == 2001L) NULL else national[["NOT_DECLARED"]][[1L]],
    national_unknown = national[["UNKNOWN"]][[1L]],
    category_reconciliation = reconciliation
  )
}

# build the official current county layer from the DGU INSPIRE response.
build_boundary <- function(path) {
  source <- st_read(path, quiet = TRUE)
  required <- c("maticni_broj", "naziv", "opis_vrste_prostorne_jedinice", "national_level")
  if (!all(required %in% names(source))) stop("DGU boundary fields changed", call. = FALSE)
  source[["maticni_broj"]] <- sprintf("%02d", as.integer(source[["maticni_broj"]]))
  source <- source[source[["national_level"]] == "2ndOrder", ]
  if (nrow(source) != 21L || !setequal(source[["maticni_broj"]], county_codes)) {
    stop("expected 21 DGU second-order administrative units", call. = FALSE)
  }
  observed_names <- setNames(source[["naziv"]], source[["maticni_broj"]])
  if (!identical(unname(observed_names[county_codes]), unname(county_names_hr[county_codes]))) {
    stop("DGU county names changed", call. = FALSE)
  }
  source <- st_make_valid(source)
  if (any(st_is_empty(source)) || any(!st_is_valid(source))) stop("DGU county geometry is invalid", call. = FALSE)
  source[["area_code"]] <- source[["maticni_broj"]]
  source[["area_name"]] <- source[["naziv"]]
  source[["area_unit_id"]] <- paste(boundary_set_id, source[["area_code"]], sep = ":")
  source[["boundary_set_id"]] <- boundary_set_id
  source[["boundary_level"]] <- boundary_level
  source[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(source, 3035))) / 1e6
  source <- st_transform(source, 4326)
  source[order(source[["area_code"]]), c(
    "area_code", "area_name", "area_unit_id", "boundary_set_id", "boundary_level",
    "land_area_sq_km", "geometry"
  )]
}

# simplify and validate the shipped county boundary.
write_boundary <- function(boundary) {
  simplification <- mapshaper_simplify_to_cap(
    boundary,
    boundary_out,
    max_bytes = 1500000,
    keep_percentages = c(100, 75, 50, 25, 15, 10, 7.5, 5, 3, 2, 1),
    clean_option = "allow-overlaps"
  )
  written <- st_read(boundary_out, quiet = TRUE)
  validity <- st_is_valid(written)
  if (nrow(written) != 21L || any(st_is_empty(written)) || any(is.na(validity)) || any(!validity)) {
    stop("simplified boundary did not retain 21 valid features", call. = FALSE)
  }
  if (!setequal(written[["area_code"]], county_codes)) stop("county codes changed during simplification", call. = FALSE)
  hashes <- vapply(st_as_binary(st_geometry(written), EWKB = TRUE), function(wkb) {
    digest(wkb, algo = "sha256", serialize = FALSE)
  }, character(1))
  if (length(unique(hashes)) != 21L) stop("county geometry hashes are not distinct", call. = FALSE)
  simplification[["byte_ceiling"]] <- 1500000L
  list(
    layer = written,
    simplification = simplification,
    valid_feature_count = sum(validity),
    geometry_hashes = setNames(as.list(hashes), written[["area_code"]])
  )
}

# return the named affiliation codes for one wave.
affiliation_codes <- function(year) {
  if (year == 2001L) c(codes_2001[2:5], codes_2001[13:22]) else codes_modern[2:9]
}

# build one county-year area-summary row from published counts.
build_row <- function(year, area_code, data, boundary) {
  source <- data[data[["area_code"]] == area_code, , drop = FALSE]
  area <- boundary[boundary[["area_code"]] == area_code, ]
  if (nrow(source) != 1L || nrow(area) != 1L) stop("missing county row for ", year, " ", area_code, call. = FALSE)
  population_total <- source[["TOTAL"]][[1L]]
  religious_affiliation_count <- sum(source[, affiliation_codes(year), drop = FALSE])
  no_religion_code <- if (year == 2001L) "NON_BELIEVERS" else "NOT_RELIGIOUS_AND_ATHEISTS"
  no_religion_count <- source[[no_religion_code]][[1L]]
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = area[["area_unit_id"]][[1L]],
    area_code = area_code,
    area_name = area[["area_name"]][[1L]],
    year = year,
    population_total = population_total,
    population_total_basis = paste(
      "Croatian Bureau of Statistics census population total; headline percentages use",
      "the whole census population and retain all response and non-response categories in the denominator."
    ),
    religious_affiliation_count = religious_affiliation_count,
    religious_affiliation_percent = round(100 * religious_affiliation_count / population_total, 4),
    no_religion_count = no_religion_count,
    no_religion_percent = round(100 * no_religion_count / population_total, 4),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(area[["land_area_sq_km"]][[1L]], 4),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = as.list(c(census_dataset_id, boundary_dataset_id)),
    quality_flag = paste0(
      "full_enumeration_census_affiliation;voluntary_declaration;whole_population_denominator;",
      "exact_county_national_reconciliation;current_dgu_boundary_frame;",
      "boundary_stability_2001_2021_unverified;agnostic_category_outside_headline_no_religion"
    )
  )
}

# declare the product's three public indicators.
indicators <- function() {
  temporal <- "Croatian Bureau of Statistics population censuses 2001, 2011, and 2021."
  spatial <- paste(
    "Twenty counties and the City of Zagreb as published by the Croatian Bureau of Statistics,",
    "joined by source order and official county code to the current State Geodetic Administration layer."
  )
  comparability <- paste(
    "The 2001 category Agnostici i neizjašnjeni (Agnostic and uncommitted) combines an",
    "agnostic response with non-declaration. It remains outside both headline numerators.",
    "The 2021 category Ostali kršćani (Other Christians) also changed composition because",
    "96.47% of the category answered Christian without naming a denomination."
  )
  list(
    list(
      indicator_id = "population_total",
      label = "Census population",
      description = "Published census population for the county and wave.",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "Use the Croatian Bureau of Statistics published county total.",
      temporal_coverage = temporal,
      spatial_coverage = spatial,
      quality_notes = "The statistical definition of total population changed between the 2001 and 2011 censuses."
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Census religious affiliation (%)",
      description = "Share of the whole census population in a published religious-affiliation category.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 times the sum of mutually exclusive published religious-affiliation categories divided by population_total.",
      temporal_coverage = temporal,
      spatial_coverage = spatial,
      quality_notes = comparability
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "No religion (%)",
      description = "Share of the whole census population in Nisu vjernici or Nisu vjernici i ateisti.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 times the explicit source no-religion category divided by population_total; agnostic categories remain separate.",
      temporal_coverage = temporal,
      spatial_coverage = spatial,
      quality_notes = comparability
    )
  )
}

# flatten row objects into the CSV companion.
flatten_rows <- function(rows) {
  data.frame(
    country_code = vapply(rows, `[[`, character(1), "country_code"),
    boundary_set_id = vapply(rows, `[[`, character(1), "boundary_set_id"),
    boundary_level = vapply(rows, `[[`, character(1), "boundary_level"),
    area_unit_id = vapply(rows, `[[`, character(1), "area_unit_id"),
    area_code = vapply(rows, `[[`, character(1), "area_code"),
    area_name = vapply(rows, `[[`, character(1), "area_name"),
    year = vapply(rows, `[[`, integer(1), "year"),
    population_total = vapply(rows, `[[`, integer(1), "population_total"),
    population_total_basis = vapply(rows, `[[`, character(1), "population_total_basis"),
    religious_affiliation_count = vapply(rows, `[[`, integer(1), "religious_affiliation_count"),
    religious_affiliation_percent = vapply(rows, `[[`, numeric(1), "religious_affiliation_percent"),
    no_religion_count = vapply(rows, `[[`, integer(1), "no_religion_count"),
    no_religion_percent = vapply(rows, `[[`, numeric(1), "no_religion_percent"),
    place_count = NA_integer_,
    places_per_10000_residents = NA_real_,
    place_density_per_sq_km = NA_real_,
    land_area_sq_km = vapply(rows, `[[`, numeric(1), "land_area_sq_km"),
    site_snapshot_date = NA_character_,
    place_count_basis = NA_character_,
    source_dataset_ids = vapply(rows, function(row) paste(unlist(row[["source_dataset_ids"]]), collapse = "|"), character(1)),
    quality_flag = vapply(rows, `[[`, character(1), "quality_flag"),
    stringsAsFactors = FALSE
  )
}

# return a generated artefact's row or feature count.
row_count_file <- function(path) {
  if (grepl("[.]csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("[.]geojson$", path)) return(nrow(st_read(path, quiet = TRUE)))
  object <- fromJSON(path, simplifyVector = FALSE)
  if (!is.null(object[["rows"]])) return(length(object[["rows"]]))
  NA_integer_
}

# describe one tracked public output in the manifest.
manifest_file_record <- function(path, content) {
  list(
    uri = paste0("repo:", path),
    storage_provider = "other",
    format = tools::file_ext(path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    row_count = row_count_file(path),
    content = content,
    privacy = "public",
    licence_status = "accepted"
  )
}

# describe one raw cached source with provenance fields.
raw_source_record <- function(path, url, format, source_dataset_id, used, notes) {
  meta <- read_meta(path)
  list(
    uri = path,
    url = url,
    retrieval_date = substr(meta[["retrieved_at"]], 1L, 10L),
    retrieved_at = meta[["retrieved_at"]],
    http_status = meta[["http_status"]],
    format = format,
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    source_dataset_id = source_dataset_id,
    used_in_public_product = used,
    notes = notes
  )
}

# return a faithful category mapping note for one wave.
category_mapping <- function(year) {
  codes <- if (year == 2001L) codes_2001 else codes_modern
  labels_hr <- if (year == 2001L) labels_2001_hr else labels_modern_hr
  labels_en <- if (year == 2001L) labels_2001_en else labels_modern_en
  entries <- vapply(seq_along(codes), function(index) {
    paste0(
      codes[[index]], " ", labels_hr[[index]], " => ", labels_en[[index]],
      " [product role: ", category_role(year, codes[[index]]), "; harmonisation: as_published]"
    )
  }, character(1))
  paste0("Category mapping for ", year, ": ", paste(entries, collapse = "; "), ".")
}

# describe the census and boundary datasets used by the area summary.
source_datasets <- function() {
  list(
    list(
      source_dataset_id = census_dataset_id,
      name = "Croatian Bureau of Statistics population by religion, county rows, 2001, 2011, and 2021 censuses",
      provider = "Croatian Bureau of Statistics (DZS)",
      url = results_2021_page_url,
      retrieval_date = retrieval_date,
      local_path = results_2021_path,
      licence = list(
        name = "Croatian Bureau of Statistics website terms; source attribution required",
        url = dzs_terms_url,
        attribution = "Source: Croatian Bureau of Statistics (DZS)"
      ),
      citation = "Croatian Bureau of Statistics, Population by Religion, by Towns/Municipalities, 2001, 2011, and 2021 censuses; published county rows.",
      access_limits = NULL,
      redistribution_limits = "DZS terms require the full name of the Croatian Bureau of Statistics as the data source; the terms page does not assign a named open licence.",
      notes = "The product uses the national and 21 county rows from each wave and retains every published category in validation and mappings."
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = paste0(
        "State Geodetic Administration Infrastructure for Spatial Information in Europe (INSPIRE) ",
        "Administrative Units, counties, retrieved ", retrieval_date
      ),
      provider = "State Geodetic Administration (DGU)",
      url = dgu_boundary_url,
      retrieval_date = retrieval_date,
      local_path = dgu_boundary_path,
      licence = list(
        name = "Croatian Open Licence as linked by the official metadata record",
        url = dgu_open_licence_url,
        attribution = "Source: State Geodetic Administration (DGU), Administrative Units INSPIRE"
      ),
      citation = paste0(
        "State Geodetic Administration, Administrative Units INSPIRE Web Feature Service (WFS), ",
        "21 second-order units, retrieved ", retrieval_date, "."
      ),
      access_limits = NULL,
      redistribution_limits = "The official metadata states that reuse follows the Croatian Open Licence and that public access has no limitations.",
      notes = "The current WFS response is filtered to national_level=2ndOrder and simplified for the shipped product."
    )
  )
}

fetch_file(results_2001_en_url, results_2001_en_path)
fetch_file(results_2001_hr_url, results_2001_hr_path)
fetch_file(method_2001_url, method_2001_path)
fetch_file(territory_2001_url, territory_2001_path)
fetch_file(results_2011_en_url, results_2011_en_path)
fetch_file(results_2011_hr_url, results_2011_hr_path)
fetch_file(method_2011_url, method_2011_path)
fetch_file(results_2021_page_url, results_2021_page_path)
fetch_file(results_2021_url, results_2021_path)
fetch_file(method_2021_url, method_2021_path)
fetch_file(dzs_terms_url, dzs_terms_path)
fetch_file(dgu_capabilities_url, dgu_capabilities_path)
fetch_file(dgu_metadata_url, dgu_metadata_path)
fetch_file(dgu_open_licence_url, dgu_open_licence_path)
fetch_file(dgu_boundary_url, dgu_boundary_path)

validate_workbook_labels()
data_2001_en <- parse_2001(results_2001_en_path)
data_2001_hr <- parse_2001(results_2001_hr_path)
if (!identical(data_2001_en[, c("area_code", codes_2001)], data_2001_hr[, c("area_code", codes_2001)])) {
  stop("2001 Croatian and English tables differ", call. = FALSE)
}
data_2011_en <- parse_2011(results_2011_en_path)
data_2011_hr <- parse_2011(results_2011_hr_path)
if (!identical(data_2011_en[, c("area_code", codes_modern)], data_2011_hr[, c("area_code", codes_modern)])) {
  stop("2011 Croatian and English workbooks differ", call. = FALSE)
}
data_2021 <- parse_2021(results_2021_path)
wave_data <- list("2001" = data_2001_en, "2011" = data_2011_en, "2021" = data_2021)
reconciliation <- lapply(years, function(year) validate_wave(year, wave_data[[as.character(year)]]))

boundary_stability_note <- paste(
  "Geometric stability of Croatian county boundaries across 2001, 2011, and 2021 was not verified.",
  "The common current boundary join uses the 21 county positions and official codes shared by the published DZS county rows and the current DGU layer.",
  "Code identity does not prove polygon stability, and the product reports no county-level change statistic as a same-polygon comparison."
)
geography_note <- paste(
  "DZS publishes religion by town/municipality in every wave, but the source geographies are wave-specific:",
  "122 towns and 423 municipalities in 2001, 127 towns and 429 municipalities in 2011, and",
  "128 towns and 428 municipalities in 2021. DZS publishes no three-wave religion table rebased to one",
  "local-government frame. The build therefore uses the complete 21-county fallback and creates no unofficial concordance."
)
response_note <- paste(
  "The 2001 source combines Agnostici i neizjašnjeni (Agnostic and uncommitted), which mixes an",
  "agnostic response with non-declaration. The 2011 and 2021 sources instead publish Agnostici i skeptici",
  "(Agnostics and sceptics), Ne izjašnjavaju se (Not declared), and Nepoznato (Unknown) separately.",
  "All remain distinct source categories. Headline shares use the whole population denominator."
)
classification_2021_note <- paste(
  "The 2021 workbook notes that Ostali kršćani (Other Christians) includes people who answered Christian",
  "without a denomination; 96.47% of that category did so, and 87.26% of those respondents named",
  "the Catholic Church when asked about religious community. The build retains the published category",
  "and does not reassign those people. This classification break limits cross-wave interpretation."
)

boundary <- build_boundary(dgu_boundary_path)
boundary_result <- write_boundary(boundary)
written_boundary <- boundary_result[["layer"]]
rows <- unlist(lapply(years, function(year) {
  lapply(county_codes, function(area_code) {
    build_row(year, area_code, wave_data[[as.character(year)]], written_boundary)
  })
}), recursive = FALSE)
if (length(rows) != 63L) stop("expected 63 county-year rows", call. = FALSE)

area_summary <- list(
  schema_version = "0.2.0",
  generated_at = stamp,
  generated_by = script_id,
  country_code = country_code,
  boundary_set = list(
    boundary_set_id = boundary_set_id,
    country_code = country_code,
    level = boundary_level,
    vintage = boundary_vintage,
    source_dataset_id = boundary_dataset_id
  ),
  site_snapshot = list(
    source_dataset_id = NULL,
    snapshot_date = NULL,
    basis = "no governed Croatia place-of-worship snapshot is included in this census-affiliation release",
    notes = "The product ships census-affiliation metrics and county geometry only; place-density fields are null."
  ),
  source_datasets = source_datasets(),
  indicators = indicators(),
  visual_layers = list(
    list(
      visual_layer_id = "hr-county-religious-affiliation",
      label = "Census religious affiliation (%)",
      description = "Religious-affiliation share of the whole census population by county for 2001, 2011, and 2021.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "whole census population"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "sum mutually exclusive source religious-affiliation categories and divide by population_total",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = paste(response_note, classification_2021_note, boundary_stability_note)
    ),
    list(
      visual_layer_id = "hr-county-no-religion",
      label = "No religion (%)",
      description = "Share of the whole census population in the explicit source no-religion category.",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "whole census population"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "Nisu vjernici or Nisu vjernici i ateisti divided by population_total; agnostic categories remain separate",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = paste(response_note, boundary_stability_note)
    )
  ),
  rows = rows
)
write_json(area_summary, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

raw_sources <- list(
  raw_source_record(results_2001_en_path, results_2001_en_url, "html", census_dataset_id, TRUE, "English 2001 national and county religion rows."),
  raw_source_record(results_2001_hr_path, results_2001_hr_url, "html", census_dataset_id, TRUE, "Croatian 2001 table used to verify counts and source labels."),
  raw_source_record(method_2001_path, method_2001_url, "html", census_dataset_id, TRUE, "2001 construct and voluntary-answer methodology."),
  raw_source_record(territory_2001_path, territory_2001_url, "html", census_dataset_id, TRUE, "2001 territorial constitution and local-government counts."),
  raw_source_record(results_2011_en_path, results_2011_en_url, "xls", census_dataset_id, TRUE, "English 2011 national, county, town, and municipality religion table."),
  raw_source_record(results_2011_hr_path, results_2011_hr_url, "xls", census_dataset_id, TRUE, "Croatian 2011 workbook used to verify counts and source labels."),
  raw_source_record(method_2011_path, method_2011_url, "html", census_dataset_id, TRUE, "2011 construct, response handling, and geography methodology."),
  raw_source_record(results_2021_page_path, results_2021_page_url, "html", census_dataset_id, TRUE, "Official results page that pins the 2021 workbook link."),
  raw_source_record(results_2021_path, results_2021_url, "xlsx", census_dataset_id, TRUE, "Bilingual 2021 workbook; sheet 2 supplies religion rows."),
  raw_source_record(method_2021_path, method_2021_url, "html", census_dataset_id, TRUE, "2021 methodology and territorial constitution."),
  raw_source_record(dzs_terms_path, dzs_terms_url, "html", terms_dataset_id, TRUE, "DZS terms requiring source attribution."),
  raw_source_record(dgu_capabilities_path, dgu_capabilities_url, "xml", boundary_dataset_id, TRUE, "Official DGU INSPIRE WFS capabilities."),
  raw_source_record(dgu_metadata_path, dgu_metadata_url, "xml", boundary_terms_dataset_id, TRUE, "Official metadata links the Croatian Open Licence and states no public-access limitation."),
  raw_source_record(dgu_open_licence_path, dgu_open_licence_url, "html", boundary_terms_dataset_id, TRUE, "Croatian Open Licence page linked by DGU metadata."),
  raw_source_record(dgu_boundary_path, dgu_boundary_url, "geojson", boundary_dataset_id, TRUE, "Current 21 DGU second-order administrative units.")
)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = paste0("manifest:hr-census-religion:hr:2001-2021:county-dgu-", boundary_vintage),
  dataset_id = paste0("hr-census-religion:hr:2001-2021:county-dgu-", boundary_vintage),
  dataset_version_id = paste0(
    "hr-census-religion:hr:2001-2021:county-dgu-", boundary_vintage, ":",
    substr(sha256_file(summary_json_out), 1L, 12L)
  ),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "hr-census-religion",
  dataset_role = "public_product",
  scope = list(
    level = "country",
    country_codes = list(country_code),
    snapshot_date = NULL,
    snapshot_anchor = NULL,
    pipeline_stage = "public"
  ),
  created_at = stamp,
  created_by = script_id,
  pipeline = list(
    script = script_id,
    git_commit = git_commit,
    command = paste("Rscript", script_id),
    parameters = list(
      waves = years,
      geography = "21 published county rows: 20 counties and the City of Zagreb",
      construct = "self-declared census religious affiliation",
      denominator = "whole census population",
      category_rule = "retain every source category; sum only mutually exclusive religious-affiliation categories; keep agnostic, non-declaration, and unknown categories distinct",
      boundary_source_vintage = boundary_vintage,
      boundary_simplification = boundary_result[["simplification"]],
      local_cache_hint = paste(
        "Raw Croatian Bureau of Statistics (DZS) tables, methods, and terms and State Geodetic",
        "Administration (DGU) geometry are cached under data/raw/hr_census/ and remain git-ignored."
      ),
      retrieval_routes = list(
        list(purpose = "2001 bilingual religion table", method = "GET", url = results_2001_en_url, notes = "National and 21 county rows plus town/municipality links."),
        list(purpose = "2011 religion workbook", method = "GET", url = results_2011_en_url, notes = "National, county, town, and municipality rows."),
        list(purpose = "2021 religion workbook", method = "GET", url = results_2021_url, notes = "Sheet 2; link pinned by the official results page."),
        list(purpose = "official current county boundary", method = "Web Feature Service (WFS) GetFeature", url = dgu_boundary_url, notes = "Filter national_level=2ndOrder.")
      )
    ),
    software_versions = list(
      r = R.version.string,
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")),
      readxl = as.character(packageVersion("readxl")),
      digest = as.character(packageVersion("digest")),
      mapshaper = "npx mapshaper through scripts/lib/simplify_boundary.R"
    )
  ),
  source = list(
    provider = "Croatian Bureau of Statistics (DZS); State Geodetic Administration (DGU)",
    source_dataset_ids = list(census_dataset_id, boundary_dataset_id, terms_dataset_id, boundary_terms_dataset_id),
    source_urls = list(
      results_2001_en_url, results_2001_hr_url, method_2001_url, territory_2001_url,
      results_2011_en_url, results_2011_hr_url, method_2011_url, results_2021_page_url,
      results_2021_url, method_2021_url, dzs_terms_url, dgu_boundary_url,
      dgu_capabilities_url, dgu_metadata_url, dgu_open_licence_url
    ),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = paste(
      "DZS website terms require naming the Croatian Bureau of Statistics as source and assign no named open licence.",
      "DGU metadata states that Administrative Units reuse follows the Croatian Open Licence and that public access has no limitations."
    ),
    citation = paste(
      "Croatian Bureau of Statistics census religion tables, 2001, 2011, and 2021;",
      "State Geodetic Administration Infrastructure for Spatial Information in Europe (INSPIRE)",
      "Administrative Units Web Feature Service (WFS)."
    )
  ),
  input_manifests = list(),
  durable_files = list(
    manifest_file_record(summary_json_out, "Croatia county census-affiliation area summary for 2001, 2011, and 2021."),
    manifest_file_record(summary_csv_out, "Flattened Croatia county census-affiliation rows."),
    manifest_file_record(boundary_out, "Simplified current DGU county geometry.")
  ),
  raw_sources = raw_sources,
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id, notes = "63 county-year rows."),
    list(uri = paste0("repo:", summary_csv_out), sha256 = sha256_file(summary_csv_out), built_by = script_id, notes = "CSV companion."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out), built_by = script_id, notes = "21 simplified current county features.")
  ),
  validation = list(
    status = "passed",
    commands = list(
      "Rscript scripts/build_hr_area_summary.R",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/hr/data/area_summary_county.json",
      "jq empty docs/manifests/hr-census-religion-2001-2021.json",
      "jq -e '.validation.status == \"passed\" and (.construct_notes | length > 0) and (.validation.reconciliation | length == 3)' docs/manifests/hr-census-religion-2001-2021.json"
    ),
    warnings = list(geography_note, response_note, classification_2021_note, boundary_stability_note),
    notes = paste(
      "Every mutually exclusive category sum equals its published area total.",
      "Every county category sum equals the published national row exactly for all three waves.",
      "The boundary has 21 valid, non-empty features with 21 distinct SHA-256 Well-Known Binary (WKB) hashes."
    ),
    stats = list(
      waves = length(years),
      rows = length(rows),
      counties_per_wave = 21L,
      published_category_rows_per_wave = "2001=25;2011=13;2021=13",
      mutually_exclusive_categories_per_wave = "2001=17;2011=12;2021=12",
      boundary_features = 21L,
      boundary_valid_features = boundary_result[["valid_feature_count"]],
      distinct_geometry_hashes = length(unique(unlist(boundary_result[["geometry_hashes"]]))),
      boundary_bytes = file_bytes(boundary_out),
      summary_json_bytes = file_bytes(summary_json_out),
      summary_csv_bytes = file_bytes(summary_csv_out)
    ),
    reconciliation = reconciliation,
    boundary_validation = list(
      output_feature_count = 21L,
      valid_feature_count = boundary_result[["valid_feature_count"]],
      distinct_geometry_hash_count = length(unique(unlist(boundary_result[["geometry_hashes"]]))),
      geometry_sha256_by_county_code = boundary_result[["geometry_hashes"]],
      source_crs = "EPSG:4326",
      area_calculation_crs = "EPSG:3035",
      output_crs = "EPSG:4326",
      source_vintage = boundary_vintage,
      historical_polygon_stability = "unverified"
    )
  ),
  construct_notes = c(list(
    "The construct is self-declared census religious affiliation. It does not measure belief, practice, attendance, or registered church membership.",
    "Headline percentages use the whole census population. Not-declared, unknown, and mixed agnostic/non-declaration categories stay in the denominator and outside both headline numerators.",
    response_note,
    classification_2021_note,
    "The statistical definition of total population changed between the 2001 and 2011 censuses; population and affiliation shares are therefore not perfectly comparable across that break.",
    geography_note,
    boundary_stability_note,
    "DZS is expanded as Croatian Bureau of Statistics. DGU is expanded as State Geodetic Administration on every public-facing product surface before either acronym is used."
  ), lapply(years, category_mapping)),
  deferred_sources = list(
    list(
      source = "DZS town/municipality religion rows for 2001, 2011, and 2021",
      status = "wave_specific_geography_not_shipped",
      reason = "The local-government frames differ and DZS publishes no three-wave religion table rebased to one frame; the project forbids an unofficial concordance."
    )
  ),
  privacy = "public",
  licence_status = "accepted",
  downstream_status = "public",
  source_datasets = source_datasets(),
  notes = "The committed product contains derived county summaries and simplified official current county geometry only. Croatia UI and hub wiring are outside this build."
)
write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)

cat(sprintf("2001 endpoint: %s\n", results_2001_en_url))
cat(sprintf("2011 endpoint: %s\n", results_2011_en_url))
cat(sprintf("2021 endpoint: %s\n", results_2021_url))
cat(sprintf("boundary endpoint: %s\n", dgu_boundary_url))
cat(sprintf("waves x geography: %s x 21 counties (20 counties plus the City of Zagreb)\n", paste(years, collapse = ", ")))
cat("geography decision: county fallback; no unofficial town/municipality concordance\n")
cat("category counts: 2001=25, 2011=13, 2021=13 published rows including total\n")
cat("reconciliation gate: passed; all area category sums and county-to-national sums matched exactly\n")
cat(sprintf("geometry gate: passed; %d valid features and %d distinct geometry hashes\n", boundary_result[["valid_feature_count"]], length(unique(unlist(boundary_result[["geometry_hashes"]])))))
cat("provenance gate: passed; URL, retrieval date, byte size, and SHA-256 recorded for every source\n")
cat(sprintf("wrote %s: %d rows\n", summary_json_out, length(rows)))
cat(sprintf("wrote %s: %d rows\n", summary_csv_out, nrow(flatten_rows(rows))))
cat(sprintf("wrote %s: %d features, %d bytes\n", boundary_out, nrow(written_boundary), file_bytes(boundary_out)))
cat(sprintf("wrote %s\n", manifest_out))
