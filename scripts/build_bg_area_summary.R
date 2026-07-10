# build the Bulgaria district census-affiliation area-summary product.
# inputs: NSI census tables for 2001, 2011, and 2021 and GISCO NUTS 3 2021.
# outputs: district area-summary JSON/CSV, a simplified boundary, and a manifest.
# run from the repository root: Rscript scripts/build_bg_area_summary.R

suppressMessages({
  library(digest)
  library(jsonlite)
  library(sf)
  library(xml2)
})
source("scripts/lib/simplify_boundary.R")

raw_dir <- "data/raw/bg_census"
output_dir <- "apps/regions/bg/data"
manifest_dir <- "docs/manifests"
dir.create(raw_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

country_code <- "BG"
years <- c(2001L, 2011L, 2021L)
script_id <- "scripts/build_bg_area_summary.R"
retrieval_date <- format(Sys.Date(), "%Y-%m-%d")
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
git_commit <- system("git rev-parse --short HEAD", intern = TRUE)
boundary_level <- "district"
boundary_vintage <- "2021"
boundary_set_id <- "bg-district-2021-gisco-nuts3"

census_2001_dataset_id <- "nsi-bg-census-2001-religion-district"
census_2011_dataset_id <- "nsi-bg-census-2011-religion-district"
census_2021_dataset_id <- "nsi-bg-census-2021-religion-district"
boundary_dataset_id <- "eurostat-gisco-nuts3-2021-bg"
nsi_terms_dataset_id <- "nsi-bg-licence-v2"

census_2001_url <- "https://www.nsi.bg/Census/Religion.htm"
census_2001_method_url <- "https://www.nsi.bg/Census/StrReligion.htm"
census_2011_report_url <- "https://censusresults.nsi.bg/Census/Reports/2/2/R10.aspx"
census_2011_population_url <- "https://censusresults.nsi.bg/Census/Reports/2/2/R15.aspx"
census_2011_method_url <- "https://www.nsi.bg/census2011/PDOCS2/Census2011final_en.pdf"
census_2021_district_url <- "https://www.nsi.bg/infostat/2001"
census_2021_municipality_url <- "https://www.nsi.bg/infostat/2024"
census_2021_method_url <- "https://www.nsi.bg/index.php/en/file/24020/Census2021-ethnos_en.pdf"

published_basis <- list(
  `2001` = list(
    rule = "NSI's published presentation uses the full census population, including Cannot self-identify and Not shown.",
    national_denominator = 7928901L,
    citation = paste0("NSI, Structure of the population by religious denomination (", census_2001_method_url, ").")
  ),
  `2011` = list(
    rule = "NSI's R10 presentation uses the 5,758,301 voluntary-question respondents out of 7,364,570 census residents.",
    national_denominator = 5758301L,
    citation = paste0("NSI, Census 2011 final results and report R10 (", census_2011_report_url, ").")
  ),
  `2021` = list(
    rule = "NSI's published presentation uses the 5,903,108 people with religion information, excluding 616,681 administrative additions with no religion information from 6,519,789 residents.",
    national_denominator = 5903108L,
    citation = paste0("NSI, Census 2021 ethno-cultural characteristics, footnote 3 (", census_2021_method_url, ").")
  )
)

published_headline_shares <- list(
  `2001` = c(ORTHODOX = 82.6, MUSLIM = 12.2, CATHOLIC = 0.6, PROTESTANT = 0.5),
  `2011` = c(ORTHODOX = 76.0, CATHOLIC = 0.8, PROTESTANT = 1.1, MUSLIM_ALL = 10.0, OTHER_RELIGIONS = 0.2, NO_RELIGION = 4.7, CANNOT_DETERMINE = 7.1),
  `2021` = c(CHRISTIAN = 71.5, MUSLIM = 10.8, NO_RELIGION = 5.2, CANNOT_DETERMINE = 4.4, DECLINED = 8.0)
)
nsi_terms_url <- paste0(
  "https://www.nsi.bg/pages/licenz-za-izpolzvaneto-na-statisticheskata-",
  "informaciya-proizvejdana-i-razprostranyavana-ot-nacionalniya-",
  "statisticheski-institut-485"
)
gisco_boundary_url <- paste0(
  "https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/",
  "NUTS_RG_01M_2021_4326_LEVL_3.geojson"
)
gisco_terms_url <- paste0(
  "https://ec.europa.eu/eurostat/web/gisco/geodata/statistical-units/",
  "territorial-units-statistics"
)
eurostat_copyright_url <- "https://ec.europa.eu/eurostat/help/copyright-notice"

district_map <- data.frame(
  area_code = c(
    "BLG", "BGS", "VAR", "VTR", "VID", "VRC", "GAB", "DOB", "KRZ", "KNL",
    "LOV", "MON", "PAZ", "PER", "PVN", "PDV", "RAZ", "RSE", "SLS", "SLV",
    "SML", "SFO", "SOF", "SZR", "TGV", "HKV", "SHU", "JAM"
  ),
  area_name_bg = c(
    "Благоевград", "Бургас", "Варна", "Велико Търново", "Видин", "Враца",
    "Габрово", "Добрич", "Кърджали", "Кюстендил", "Ловеч", "Монтана",
    "Пазарджик", "Перник", "Плевен", "Пловдив", "Разград", "Русе",
    "Силистра", "Сливен", "Смолян", "София", "София (столица)",
    "Стара Загора", "Търговище", "Хасково", "Шумен", "Ямбол"
  ),
  area_name_2011_bg = c(
    "Благоевград", "Бургас", "Варна", "Велико Търново", "Видин", "Враца",
    "Габрово", "Добрич", "Кърджали", "Кюстендил", "Ловеч", "Монтана",
    "Пазарджик", "Перник", "Плевен", "Пловдив", "Разград", "Русе",
    "Силистра", "Сливен", "Смолян", "Софийска", "София",
    "Стара Загора", "Търговище", "Хасково", "Шумен", "Ямбол"
  ),
  nuts3_code = c(
    "BG413", "BG341", "BG331", "BG321", "BG311", "BG313", "BG322", "BG332",
    "BG425", "BG415", "BG315", "BG312", "BG423", "BG414", "BG314", "BG421",
    "BG324", "BG323", "BG325", "BG342", "BG424", "BG412", "BG411", "BG344",
    "BG334", "BG422", "BG333", "BG343"
  ),
  stringsAsFactors = FALSE
)
district_codes <- district_map[["area_code"]]

category_definitions <- list(
  `2001` = data.frame(
    source_code = c("TOTAL", "ORTHODOX", "CATHOLIC", "PROTESTANT", "MUSLIM", "OTHER", "CANNOT_DETERMINE", "NOT_SHOWN"),
    source_name_bg = c("Общо", "Източно православно", "Католическо", "Протестантско", "Мюсюлманско", "Друго", "Не се самоопределя", "Непоказано"),
    source_display_en = c("Total", "Eastern Orthodox", "Catholic", "Protestant", "Muslim", "Other religion", "Cannot self-identify", "Not shown"),
    role = c("total", rep("named_religion", 5), "cannot_determine", "nonresponse"),
    stringsAsFactors = FALSE
  ),
  `2011` = data.frame(
    source_code = c("TOTAL", "ORTHODOX", "CATHOLIC", "PROTESTANT", "MUSLIM_ALL", "OTHER_RELIGIONS", "NO_RELIGION", "CANNOT_DETERMINE"),
    source_name_bg = c("Общо", "Източноправославно", "Католическо", "Протестантско", "Мюсюлманско - общо", "Други вероизповедания", "Няма", "Не се самоопределя"),
    source_display_en = c("Total", "Eastern Orthodox", "Catholic", "Protestant", "Muslim, total", "Other religions", "No religion", "Cannot self-identify"),
    role = c("total", rep("named_religion", 5), "no_religion", "cannot_determine"),
    stringsAsFactors = FALSE
  ),
  `2021` = data.frame(
    source_code = c("TOTAL", "CHRISTIAN", "MUSLIM", "JEWISH", "OTHER", "NO_RELIGION", "CANNOT_DETERMINE", "DECLINED", "UNKNOWN"),
    source_name_bg = c("Общо", "Християнско", "Мюсюлманско", "Юдейско", "Друго", "Нямам", "Не мога да определя", "Не желая да отговоря", "Непоказано"),
    source_display_en = c("Total", "Christian", "Muslim", "Jewish", "Other religion", "No religion", "Cannot determine", "Do not want to answer", "Unknown"),
    role = c("total", rep("named_religion", 4), "no_religion", "cannot_determine", "declined", "nonresponse"),
    stringsAsFactors = FALSE
  )
)

source_categories_2011 <- data.frame(
  source_code = c("TOTAL", "ORTHODOX", "CATHOLIC", "PROTESTANT", "SUNNI", "SHIA", "MUSLIM", "ARMENIAN_APOSTOLIC", "JEWISH", "OTHER", "NO_RELIGION", "CANNOT_DETERMINE"),
  source_name_bg = c("Общо", "Източноправославно", "Католическо", "Протестантско", "Мюсюлмаснко-сунитско", "Мюсюлманско-шиитско", "Мюсюлманско", "Арменско апостолическо православно", "Израилтянско/юдаизъм", "Друго", "Няма", "Не се самоопределя"),
  source_display_en = c("Total", "Eastern Orthodox", "Catholic", "Protestant", "Sunni Muslim", "Shia Muslim", "Muslim, unspecified", "Armenian Apostolic Orthodox", "Jewish/Judaism", "Other religion", "No religion", "Cannot self-identify"),
  role = c("total", rep("named_religion", 9), "no_religion", "cannot_determine"),
  stringsAsFactors = FALSE
)

census_2001_path <- file.path(raw_dir, "nsi_census_2001_religion_district.html")
census_2001_method_path <- file.path(raw_dir, "nsi_census_2001_religion_method.html")
census_2011_national_path <- file.path(raw_dir, "nsi_census_2011_religion_national.html")
census_2011_population_path <- file.path(raw_dir, "nsi_census_2011_population_district.html")
census_2011_method_path <- file.path(raw_dir, "nsi_census_2011_main_results_en.pdf")
census_2021_district_path <- file.path(raw_dir, "nsi_infostat_2021_religion_district.html")
census_2021_municipality_path <- file.path(raw_dir, "nsi_infostat_2021_religion_municipality_route.html")
census_2021_method_path <- file.path(raw_dir, "nsi_census_2021_ethnocultural_en.pdf")
nsi_terms_path <- file.path(raw_dir, "nsi_licence_v2.html")
gisco_boundary_path <- file.path(raw_dir, "gisco_nuts3_2021_4326.geojson")
gisco_terms_path <- file.path(raw_dir, "gisco_nuts_terms.html")
eurostat_copyright_path <- file.path(raw_dir, "eurostat_copyright.html")
summary_json_out <- file.path(output_dir, "area_summary_district.json")
summary_csv_out <- file.path(output_dir, "area_summary_district.csv")
boundary_out <- file.path(output_dir, "bg_district_2021.geojson")
manifest_out <- file.path(manifest_dir, "bg-census-religion-2001-2021.json")

# return a file's SHA-256 digest.
sha256_file <- function(path) unname(tools::sha256sum(path))

# return a file's size in bytes.
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))

# preserve retrieval metadata beside a raw cached source.
write_meta <- function(path, url, method = "GET", request_body = NULL) {
  meta_path <- paste0(path, ".meta.json")
  if (file.exists(meta_path)) return(invisible(meta_path))
  write_json(
    list(
      url = url,
      method = method,
      retrieved_at = stamp,
      http_status = 200L,
      request_body = request_body
    ),
    meta_path,
    auto_unbox = TRUE,
    pretty = TRUE,
    null = "null"
  )
  invisible(meta_path)
}

# fetch one GET source and retain its first successful cached response.
fetch_get <- function(url, path) {
  if (!file.exists(path) || file_bytes(path) < 1L) {
    temporary_path <- paste0(path, ".part")
    on.exit(unlink(temporary_path), add = TRUE)
    status <- system2(
      "curl",
      c(
        "--fail", "--silent", "--show-error", "--location", "--retry", "3",
        "--max-time", "300", "--user-agent", "places-of-worship-BG-build",
        "--output", temporary_path, url
      )
    )
    if (status != 0L || !file.exists(temporary_path) || file_bytes(temporary_path) < 1L) {
      stop("failed to retrieve ", url, call. = FALSE)
    }
    if (!file.rename(temporary_path, path)) stop("failed to cache ", path, call. = FALSE)
  }
  write_meta(path, url)
  invisible(path)
}

# fetch one form POST and record its complete request body.
fetch_post <- function(url, path, fields) {
  if (!file.exists(path) || file_bytes(path) < 1L) {
    temporary_path <- paste0(path, ".part")
    on.exit(unlink(temporary_path), add = TRUE)
    field_args <- unlist(lapply(names(fields), function(name) {
      unlist(lapply(fields[[name]], function(value) c("--data-urlencode", paste0(name, "=", value))))
    }), use.names = FALSE)
    status <- system2(
      "curl",
      c(
        "--fail", "--silent", "--show-error", "--location", "--retry", "3",
        "--max-time", "300", "--user-agent", "places-of-worship-BG-build",
        "--output", temporary_path, field_args, url
      )
    )
    if (status != 0L || !file.exists(temporary_path) || file_bytes(temporary_path) < 1L) {
      stop("failed to retrieve POST response from ", url, call. = FALSE)
    }
    if (!file.rename(temporary_path, path)) stop("failed to cache ", path, call. = FALSE)
  }
  write_meta(path, url, "POST", fields)
  invisible(path)
}

# read retrieval metadata recorded for one cached source.
read_meta <- function(path) {
  meta_path <- paste0(path, ".meta.json")
  if (!file.exists(meta_path)) stop("missing retrieval metadata: ", meta_path, call. = FALSE)
  fromJSON(meta_path, simplifyVector = FALSE)
}

# normalise whitespace while retaining the source's Bulgarian wording.
normalise_text <- function(value) {
  value <- gsub("\u00a0", " ", value, fixed = TRUE)
  value <- gsub("[[:space:]]+", " ", value)
  trimws(value)
}

# parse a displayed integer that may contain spaces or non-breaking spaces.
parse_count <- function(value) {
  value <- normalise_text(value)
  if (value == "-") return(0L)
  if (value == "..") return(NA_integer_)
  clean <- gsub("[^0-9-]", "", value)
  if (!grepl("^-?[0-9]+$", clean)) stop("invalid count: ", value, call. = FALSE)
  as.integer(clean)
}

# read legacy Windows-1251 HTML without losing Bulgarian labels.
read_windows_1251_html <- function(path) {
  raw <- readBin(path, "raw", n = file_bytes(path))
  converted <- iconv(rawToChar(raw), from = "WINDOWS-1251", to = "UTF-8")
  if (is.na(converted)) stop("failed to convert Windows-1251 HTML: ", path, call. = FALSE)
  read_html(converted)
}

# map one Bulgarian district label to the stable NSI three-letter code.
district_code_from_name <- function(name, column = "area_name_bg") {
  clean <- normalise_text(name)
  index <- match(clean, district_map[[column]])
  if (is.na(index)) stop("unknown district label: ", clean, call. = FALSE)
  district_map[["area_code"]][[index]]
}

# parse the complete 2001 district table into exact category counts.
parse_2001 <- function(path) {
  document <- read_windows_1251_html(path)
  rows <- xml_find_all(xml_find_first(document, "//table"), ".//tr")
  data_rows <- rows[3:length(rows)]
  parsed <- lapply(data_rows, function(row) {
    cells <- normalise_text(xml_text(xml_find_all(row, "./th|./td")))
    if (length(cells) != 9L) stop("2001 table row changed shape", call. = FALSE)
    area_code <- if (cells[[1L]] == "България") "BG" else district_code_from_name(cells[[1L]])
    data.frame(
      area_code = area_code,
      source_code = category_definitions[["2001"]][["source_code"]],
      value = vapply(cells[2:9], parse_count, integer(1)),
      stringsAsFactors = FALSE
    )
  })
  result <- do.call(rbind, parsed)
  if (!setequal(unique(result[["area_code"]]), c("BG", district_codes))) {
    stop("2001 table does not contain the country and 28 districts", call. = FALSE)
  }
  result
}

# parse one 2011 religion report page into exact category counts.
parse_2011_religion_page <- function(path, area_code) {
  document <- read_html(path)
  table <- tail(xml_find_all(document, "//table"), 1L)[[1L]]
  rows <- xml_find_all(table, ".//tr")
  data_rows <- rows[3:length(rows)]
  labels <- vapply(data_rows, function(row) {
    normalise_text(xml_text(xml_find_first(row, "./th|./td")))
  }, character(1))
  values <- vapply(data_rows, function(row) {
    cells <- xml_find_all(row, "./th|./td")
    parse_count(xml_text(cells[[2L]]))
  }, integer(1))
  expected <- source_categories_2011[["source_name_bg"]]
  if (!identical(labels, expected)) {
    stop("2011 religion categories changed for ", area_code, call. = FALSE)
  }
  names(values) <- source_categories_2011[["source_code"]]
  suppressed_codes <- names(values)[is.na(values)]
  if (!all(suppressed_codes %in% c("ARMENIAN_APOSTOLIC", "JEWISH"))) {
    stop("2011 suppression affected a headline category for ", area_code, call. = FALSE)
  }
  muslim_total <- sum(values[c("SUNNI", "SHIA", "MUSLIM")])
  other_religions <- values[["TOTAL"]] - sum(
    values[c("ORTHODOX", "CATHOLIC", "PROTESTANT")],
    muslim_total,
    values[c("NO_RELIGION", "CANNOT_DETERMINE")]
  )
  if (other_religions < values[["OTHER"]]) {
    stop("derived other-religions group is inconsistent for ", area_code, call. = FALSE)
  }
  grouped_values <- c(
    TOTAL = values[["TOTAL"]],
    ORTHODOX = values[["ORTHODOX"]],
    CATHOLIC = values[["CATHOLIC"]],
    PROTESTANT = values[["PROTESTANT"]],
    MUSLIM_ALL = muslim_total,
    OTHER_RELIGIONS = other_religions,
    NO_RELIGION = values[["NO_RELIGION"]],
    CANNOT_DETERMINE = values[["CANNOT_DETERMINE"]]
  )
  data.frame(
    area_code = area_code,
    source_code = category_definitions[["2011"]][["source_code"]],
    value = unname(grouped_values),
    stringsAsFactors = FALSE
  )
}

# parse the 2011 district population table used to measure omitted responses.
parse_2011_population <- function(path) {
  document <- read_html(path)
  table <- tail(xml_find_all(document, "//table"), 1L)[[1L]]
  rows <- xml_find_all(table, ".//tr")
  data_rows <- rows[3:length(rows)]
  parsed <- lapply(data_rows, function(row) {
    cells <- xml_find_all(row, "./th|./td")
    name <- normalise_text(xml_text(cells[[1L]]))
    code <- if (name == "Общо") "BG" else district_code_from_name(name, "area_name_2011_bg")
    data.frame(area_code = code, population_total = parse_count(xml_text(cells[[2L]])))
  })
  result <- do.call(rbind, parsed)
  if (!setequal(result[["area_code"]], c("BG", district_codes))) {
    stop("2011 population report does not contain the country and 28 districts", call. = FALSE)
  }
  result
}

# parse the 2021 Infostat pivot response into exact category counts.
parse_2021 <- function(path) {
  document <- read_html(path)
  table <- xml_find_first(document, "//table[contains(@class,'pivot')]")
  if (inherits(table, "xml_missing")) stop("2021 Infostat response has no pivot table", call. = FALSE)
  header_cells <- xml_find_all(table, ".//thead/tr[last()]/th")
  labels <- normalise_text(gsub("[0-9]+$", "", xml_text(header_cells)))
  expected <- category_definitions[["2021"]][["source_name_bg"]]
  if (!identical(labels, expected)) stop("2021 Infostat categories changed", call. = FALSE)
  rows <- xml_find_all(table, ".//tbody/tr")
  parsed <- lapply(rows, function(row) {
    row_name <- normalise_text(xml_text(xml_find_first(row, "./th")))
    code <- if (row_name == "Общо за страната") "BG" else district_code_from_name(row_name)
    values <- vapply(xml_find_all(row, "./td"), function(cell) {
      parse_count(xml_attr(cell, "data-value"))
    }, integer(1))
    if (length(values) != length(expected)) stop("2021 Infostat row changed shape", call. = FALSE)
    data.frame(
      area_code = code,
      source_code = category_definitions[["2021"]][["source_code"]],
      value = values,
      stringsAsFactors = FALSE
    )
  })
  result <- do.call(rbind, parsed)
  if (!setequal(unique(result[["area_code"]]), c("BG", district_codes))) {
    stop("2021 Infostat response does not contain the country and 28 districts", call. = FALSE)
  }
  result
}

# return a named category vector for one area.
area_values <- function(rows, area_code) {
  subset <- rows[rows[["area_code"]] == area_code, , drop = FALSE]
  if (anyDuplicated(subset[["source_code"]])) stop("duplicate category for ", area_code, call. = FALSE)
  setNames(subset[["value"]], subset[["source_code"]])
}

# enforce category, district, and national reconciliation for one census wave.
validate_wave <- function(year, rows, full_population = NULL) {
  definitions <- category_definitions[[as.character(year)]]
  expected_codes <- definitions[["source_code"]]
  if (!setequal(unique(rows[["source_code"]]), expected_codes)) {
    stop("wave ", year, " has an unexpected category set", call. = FALSE)
  }
  if (!setequal(unique(rows[["area_code"]]), c("BG", district_codes))) {
    stop("wave ", year, " has an incomplete geography", call. = FALSE)
  }
  national <- area_values(rows, "BG")
  district_reconciliation <- lapply(expected_codes, function(code) {
    district_sum <- sum(rows[["value"]][rows[["area_code"]] != "BG" & rows[["source_code"]] == code])
    difference <- district_sum - national[[code]]
    if (difference != 0L) stop("district reconciliation failed for ", year, " ", code, call. = FALSE)
    list(
      source_code = code,
      source_name_bg = definitions[["source_name_bg"]][[match(code, expected_codes)]],
      source_display_en = definitions[["source_display_en"]][[match(code, expected_codes)]],
      district_sum = district_sum,
      published_national_total = national[[code]],
      difference = difference,
      status = "matched"
    )
  })
  for (area_code in c("BG", district_codes)) {
    values <- area_values(rows, area_code)
    if (sum(values[names(values) != "TOTAL"]) != values[["TOTAL"]]) {
      stop("within-area category reconciliation failed for ", year, " ", area_code, call. = FALSE)
    }
  }
  if (year == 2001L) {
    population_total <- national[["TOTAL"]]
    published_denominator <- national[["TOTAL"]]
    nonresponse_count <- national[["NOT_SHOWN"]]
    refusal_count <- NA_integer_
    cannot_determine_count <- national[["CANNOT_DETERMINE"]]
  } else if (year == 2011L) {
    if (is.null(full_population)) stop("2011 full population is required", call. = FALSE)
    population_total <- full_population[["population_total"]][full_population[["area_code"]] == "BG"]
    published_denominator <- national[["TOTAL"]]
    nonresponse_count <- population_total - published_denominator
    refusal_count <- NA_integer_
    cannot_determine_count <- national[["CANNOT_DETERMINE"]]
    if (sum(full_population[["population_total"]][full_population[["area_code"]] != "BG"]) != population_total) {
      stop("2011 district population totals do not reconcile nationally", call. = FALSE)
    }
  } else {
    population_total <- national[["TOTAL"]]
    published_denominator <- national[["TOTAL"]] - national[["UNKNOWN"]]
    nonresponse_count <- national[["UNKNOWN"]]
    refusal_count <- national[["DECLINED"]]
    cannot_determine_count <- national[["CANNOT_DETERMINE"]]
  }
  if (published_denominator != published_basis[[as.character(year)]][["national_denominator"]]) {
    stop("published denominator could not be reproduced for ", year, call. = FALSE)
  }
  list(
    year = year,
    district_count = 28L,
    published_category_rows_including_total = length(expected_codes),
    mutually_exclusive_categories_excluding_total = length(expected_codes) - 1L,
    national_population_total = population_total,
    national_published_denominator = published_denominator,
    national_published_denominator_percent_of_population = round(100 * published_denominator / population_total, 4),
    national_nonresponse_count = nonresponse_count,
    national_nonresponse_percent = round(100 * nonresponse_count / population_total, 4),
    national_refusal_count = refusal_count,
    national_cannot_determine_count = cannot_determine_count,
    within_area_category_sums_exact = TRUE,
    district_category_sums_exact = TRUE,
    max_absolute_difference = 0L,
    category_reconciliation = district_reconciliation
  )
}

# reproduce the rounded headline percentages in each cited NSI release.
validate_published_shares <- function(year, rows) {
  national <- area_values(rows, "BG")
  denominator <- published_basis[[as.character(year)]][["national_denominator"]]
  published <- published_headline_shares[[as.character(year)]]
  lapply(names(published), function(source_code) {
    computed <- 100 * national[[source_code]] / denominator
    reproduced <- round(computed, 1) == published[[source_code]]
    if (!reproduced) {
      stop("published headline share could not be reproduced for ", year, " ", source_code, call. = FALSE)
    }
    list(
      source_code = source_code,
      count = national[[source_code]],
      denominator = denominator,
      computed_percent = round(computed, 4),
      published_percent = published[[source_code]],
      published_rounding_digits = 1L,
      status = "matched"
    )
  })
}

# build and label the 28-feature GISCO NUTS 3 boundary.
build_boundary <- function(path) {
  source <- st_read(path, quiet = TRUE)
  required <- c("NUTS_ID", "LEVL_CODE", "CNTR_CODE", "NAME_LATN")
  if (!all(required %in% names(source))) stop("GISCO fields changed", call. = FALSE)
  source <- source[source[["CNTR_CODE"]] == country_code & source[["LEVL_CODE"]] == 3L, ]
  if (nrow(source) != 28L || !setequal(source[["NUTS_ID"]], district_map[["nuts3_code"]])) {
    stop("expected 28 Bulgarian NUTS 3 features", call. = FALSE)
  }
  source[["area_code"]] <- district_map[["area_code"]][match(source[["NUTS_ID"]], district_map[["nuts3_code"]])]
  source[["area_name"]] <- source[["NAME_LATN"]]
  source[["area_unit_id"]] <- paste(boundary_set_id, source[["area_code"]], sep = ":")
  source[["boundary_set_id"]] <- boundary_set_id
  source[["boundary_level"]] <- boundary_level
  source[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(source, 3035))) / 1e6
  source <- st_transform(source, 4326)
  source[order(source[["area_code"]]), c(
    "area_code", "area_name", "area_unit_id", "boundary_set_id",
    "boundary_level", "land_area_sq_km", "geometry"
  )]
}

# simplify the boundary and enforce valid, distinct feature geometry.
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
  if (nrow(written) != 28L || any(st_is_empty(written)) || any(is.na(validity)) || any(!validity)) {
    stop("simplified boundary did not retain 28 valid features", call. = FALSE)
  }
  hashes <- vapply(st_as_binary(st_geometry(written), EWKB = TRUE), function(wkb) {
    digest(wkb, algo = "sha256", serialize = FALSE)
  }, character(1))
  if (length(unique(hashes)) != 28L) stop("district geometry hashes are not distinct", call. = FALSE)
  simplification[["byte_ceiling"]] <- 1500000L
  list(
    layer = written,
    simplification = simplification,
    valid_feature_count = sum(validity),
    geometry_hashes = setNames(as.list(hashes), written[["area_code"]])
  )
}

# return category roles for one wave as a named vector.
category_roles <- function(year) {
  definitions <- category_definitions[[as.character(year)]]
  setNames(definitions[["role"]], definitions[["source_code"]])
}

# build one schema-conforming district-year row on NSI's published wave basis.
build_row <- function(year, area_code, rows, population_2011, boundary) {
  values <- area_values(rows, area_code)
  roles <- category_roles(year)
  religious_affiliation_count <- sum(values[names(roles)[roles == "named_religion"]])
  no_religion_code <- names(roles)[roles == "no_religion"]
  no_religion_count <- if (length(no_religion_code) == 1L) values[[no_religion_code]] else NA_integer_
  if (year == 2001L) {
    population_total <- values[["TOTAL"]]
    nonresponse_count <- values[["NOT_SHOWN"]]
    published_denominator <- population_total
    residual_count <- values[["CANNOT_DETERMINE"]] + values[["NOT_SHOWN"]]
  } else if (year == 2011L) {
    population_total <- population_2011[["population_total"]][population_2011[["area_code"]] == area_code]
    published_denominator <- values[["TOTAL"]]
    nonresponse_count <- population_total - published_denominator
    residual_count <- values[["CANNOT_DETERMINE"]]
  } else {
    population_total <- values[["TOTAL"]]
    nonresponse_count <- values[["UNKNOWN"]]
    published_denominator <- population_total - nonresponse_count
    residual_count <- values[["CANNOT_DETERMINE"]] + values[["DECLINED"]]
  }
  no_religion_for_reconciliation <- if (is.na(no_religion_count)) 0L else no_religion_count
  if (religious_affiliation_count + no_religion_for_reconciliation + residual_count != published_denominator) {
    stop("headline counts do not exhaust the published denominator for ", year, " ", area_code, call. = FALSE)
  }
  area <- boundary[boundary[["area_code"]] == area_code, ]
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
      published_basis[[as.character(year)]][["rule"]],
      published_basis[[as.character(year)]][["citation"]]
    ),
    religious_affiliation_count = religious_affiliation_count,
    religious_affiliation_percent = round(100 * religious_affiliation_count / published_denominator, 4),
    no_religion_count = if (is.na(no_religion_count)) NULL else no_religion_count,
    no_religion_percent = if (is.na(no_religion_count)) NULL else round(100 * no_religion_count / published_denominator, 4),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(area[["land_area_sq_km"]][[1L]], 4),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = as.list(c(
      switch(as.character(year), `2001` = census_2001_dataset_id, `2011` = census_2011_dataset_id, `2021` = census_2021_dataset_id),
      boundary_dataset_id
    )),
    quality_flag = paste0(
      "full_enumeration_census_affiliation;voluntary_question;",
      switch(as.character(year),
        `2001` = "nsi_published_full_population_denominator;",
        `2011` = "nsi_published_r10_voluntary_respondent_denominator;",
        `2021` = "nsi_published_religion_information_denominator;"
      ),
      "source_nonresponse_share_percent=",
      sprintf("%.4f", 100 * nonresponse_count / population_total), ";",
      if (year == 2001L) "no_no_religion_category_in_source;" else "",
      "religious_change_withheld_across_instrument_break;",
      "exact_district_national_reconciliation;current_2021_boundary_frame"
    )
  )
}

# declare the standard census-affiliation indicators with product-level warnings.
indicators <- function(comparability_note) {
  temporal <- "NSI population censuses 2001, 2011, and 2021."
  spatial <- "Twenty-eight NSI districts joined through an explicit code concordance to the Eurostat Geographic Information System of the Commission (GISCO) nomenclature of territorial units for statistics (NUTS) level 3 boundary for 2021."
  list(
    list(
      indicator_id = "population_total",
      label = "Census population",
      description = "Full census population for the district and wave.",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "Published NSI district population total.",
      temporal_coverage = temporal,
      spatial_coverage = spatial,
      quality_notes = "Religion-question response is measured separately and varies substantially by wave."
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious affiliation on NSI's published basis (%)",
      description = "Share in a published religion category on the denominator used in NSI's presentation for that wave.",
      unit = "percent",
      denominator_indicator_id = NULL,
      method = "100 times the sum of mutually exclusive published religion categories divided by NSI's published denominator for that wave: full population in 2001, R10 voluntary-question respondents in 2011, and people with religion information in 2021.",
      temporal_coverage = temporal,
      spatial_coverage = spatial,
      quality_notes = comparability_note
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "No religion on NSI's published basis (%)",
      description = "Share in the published no-religion category on NSI's published denominator; unavailable for 2001 because the census did not offer that category.",
      unit = "percent",
      denominator_indicator_id = NULL,
      method = "100 times the published no-religion count divided by the R10 voluntary-question respondent total in 2011 or the population with religion information in 2021; null for 2001.",
      temporal_coverage = "NSI population censuses 2011 and 2021; the 2001 value is null.",
      spatial_coverage = spatial,
      quality_notes = comparability_note
    )
  )
}

# flatten row objects into the CSV companion shape.
flatten_rows <- function(rows) {
  value_or_na <- function(row, name, mode) {
    value <- row[[name]]
    if (is.null(value)) return(if (mode == "integer") NA_integer_ else NA_real_)
    value
  }
  data.frame(
    country_code = vapply(rows, `[[`, character(1), "country_code"),
    boundary_set_id = vapply(rows, `[[`, character(1), "boundary_set_id"),
    boundary_level = vapply(rows, `[[`, character(1), "boundary_level"),
    area_unit_id = vapply(rows, `[[`, character(1), "area_unit_id"),
    area_code = vapply(rows, `[[`, character(1), "area_code"),
    area_name = vapply(rows, `[[`, character(1), "area_name"),
    year = vapply(rows, `[[`, integer(1), "year"),
    population_total = vapply(rows, function(x) value_or_na(x, "population_total", "integer"), integer(1)),
    population_total_basis = vapply(rows, `[[`, character(1), "population_total_basis"),
    religious_affiliation_count = vapply(rows, function(x) value_or_na(x, "religious_affiliation_count", "integer"), integer(1)),
    religious_affiliation_percent = vapply(rows, function(x) value_or_na(x, "religious_affiliation_percent", "double"), numeric(1)),
    no_religion_count = vapply(rows, function(x) value_or_na(x, "no_religion_count", "integer"), integer(1)),
    no_religion_percent = vapply(rows, function(x) value_or_na(x, "no_religion_percent", "double"), numeric(1)),
    place_count = NA_integer_,
    places_per_10000_residents = NA_real_,
    place_density_per_sq_km = NA_real_,
    land_area_sq_km = vapply(rows, `[[`, numeric(1), "land_area_sq_km"),
    site_snapshot_date = NA_character_,
    place_count_basis = NA_character_,
    source_dataset_ids = vapply(rows, function(x) paste(unlist(x[["source_dataset_ids"]]), collapse = "|"), character(1)),
    quality_flag = vapply(rows, `[[`, character(1), "quality_flag"),
    stringsAsFactors = FALSE
  )
}

# describe source datasets in the area-summary and manifest products.
source_datasets <- function() {
  nsi_licence <- list(
    name = "NSI Licence v2.0; attribution required; derivative-work distribution clause requires review",
    url = nsi_terms_url,
    attribution = "National Statistical Institute of Bulgaria"
  )
  list(
    list(
      source_dataset_id = census_2001_dataset_id,
      name = "NSI Census 2001: population by district and religious denomination",
      provider = "National Statistical Institute of Bulgaria (NSI)",
      url = census_2001_url,
      retrieval_date = retrieval_date,
      local_path = census_2001_path,
      licence = nsi_licence,
      citation = paste0("National Statistical Institute of Bulgaria, Census 2001 district table and Structure of the population by religious denomination, ", census_2001_method_url, "."),
      access_limits = "Legacy Windows-1251 HTML table; no bulk API.",
      redistribution_limits = "NSI Licence v2.0 states that derivative and collective works may not be distributed; publication requires conductor review.",
      notes = "NSI's presentation reports Eastern Orthodox as 6,552,751 people or 82.6% of the full population of 7,928,901; the product uses that full-population basis."
    ),
    list(
      source_dataset_id = census_2011_dataset_id,
      name = "NSI Census 2011: population by residence, age, and religious denomination",
      provider = "National Statistical Institute of Bulgaria (NSI)",
      url = census_2011_report_url,
      retrieval_date = retrieval_date,
      local_path = census_2011_national_path,
      licence = nsi_licence,
      citation = "National Statistical Institute of Bulgaria, Census 2011 final results, report R10 and district population report R15.",
      access_limits = "One cached HTML response per district; requests are serialised and reused from cache.",
      redistribution_limits = "NSI Licence v2.0 states that derivative and collective works may not be distributed; publication requires conductor review.",
      notes = "R10 publishes 5,758,301 voluntary-question respondents and the religion categories; R15 supplies the full census population of 7,364,570 for disclosure."
    ),
    list(
      source_dataset_id = census_2021_dataset_id,
      name = "NSI Infostat Census 2021: population by religious denomination, regions, and districts",
      provider = "National Statistical Institute of Bulgaria (NSI)",
      url = census_2021_district_url,
      retrieval_date = retrieval_date,
      local_path = census_2021_district_path,
      licence = nsi_licence,
      citation = "National Statistical Institute of Bulgaria, Infostat definition 2001, Census 2021 religious denomination by district.",
      access_limits = "Form POST route; one cached response contains the country and all 28 districts.",
      redistribution_limits = "NSI Licence v2.0 states that derivative and collective works may not be distributed; publication requires conductor review.",
      notes = "The Census 2021 release calculates shares among 5,903,108 people with religion information after excluding 616,681 administrative additions with no religion information from 6,519,789 residents. The municipality route is Infostat definition 2024, but only the 2021 wave is available there."
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "Eurostat Geographic Information System of the Commission (GISCO) nomenclature of territorial units for statistics (NUTS) level 3, 2021 Bulgaria boundary",
      provider = "Eurostat Geographic Information System of the Commission (GISCO)",
      url = gisco_boundary_url,
      retrieval_date = retrieval_date,
      local_path = gisco_boundary_path,
      licence = list(
        name = "European Commission reuse policy; source acknowledgement required",
        url = eurostat_copyright_url,
        attribution = "Eurostat GISCO"
      ),
      citation = "Eurostat GISCO, NUTS 3 2021, 1:1 million, EPSG:4326.",
      access_limits = NULL,
      redistribution_limits = "Modified geometry must identify the modification and carry Eurostat attribution and disclaimer.",
      notes = "The script filters 28 Bulgarian NUTS 3 features and simplifies them for the map product."
    )
  )
}

# record one cached source with URL, retrieval metadata, and SHA-256.
raw_source_record <- function(path, dataset_id, format, used, notes) {
  meta <- read_meta(path)
  list(
    uri = path,
    url = meta[["url"]],
    method = meta[["method"]],
    format = format,
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    source_dataset_id = dataset_id,
    used_in_public_product = used,
    retrieved_at = meta[["retrieved_at"]],
    http_status = meta[["http_status"]],
    request_body = meta[["request_body"]],
    notes = notes
  )
}

# describe one committed output using the manifest's durable-file keys.
manifest_file_record <- function(path, content, row_count = NULL, feature_count = NULL) {
  list(
    uri = paste0("repo:", path),
    storage_provider = "other",
    format = tools::file_ext(path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    content_sha256 = NULL,
    row_count = row_count,
    feature_count = feature_count,
    content = content,
    privacy = "public",
    licence_status = if (grepl("bg_district", path)) "accepted" else "needs_review"
  )
}

# validate a generated area-summary product against its JSON schema.
validate_area_summary <- function(path) {
  base_uri <- paste0(
    "file://",
    normalizePath("schemas", winslash = "/", mustWork = TRUE),
    "/"
  )
  status <- system2(
    "uvx",
    c(
      "check-jsonschema", "--base-uri", base_uri,
      "--schemafile", "schemas/area-summary.schema.json", path
    ),
    env = c(
      "UV_CACHE_DIR=/tmp/places-of-worship-uv/cache",
      "UV_TOOL_DIR=/tmp/places-of-worship-uv/tools",
      "UV_PYTHON_INSTALL_DIR=/tmp/places-of-worship-uv/python"
    )
  )
  if (status != 0L) stop("area-summary schema validation failed", call. = FALSE)
  invisible(path)
}

# convert one wave's category definitions into manifest mapping records.
category_mapping <- function(year) {
  definitions <- category_definitions[[as.character(year)]]
  lapply(seq_len(nrow(definitions)), function(index) {
    source_code <- definitions[["source_code"]][[index]]
    list(
      source_code = source_code,
      source_name_bg = definitions[["source_name_bg"]][[index]],
      source_display_en = definitions[["source_display_en"]][[index]],
      product_role = definitions[["role"]][[index]],
      harmonisation = if (year == 2011L && source_code %in% c("MUSLIM_ALL", "OTHER_RELIGIONS")) {
        "exact_group_from_published_leaves"
      } else {
        "as_published"
      }
    )
  })
}

fetch_get(census_2001_url, census_2001_path)
fetch_get(census_2001_method_url, census_2001_method_path)
fetch_get(census_2011_report_url, census_2011_national_path)
for (area_code in district_codes) {
  path <- file.path(raw_dir, paste0("nsi_census_2011_religion_", tolower(area_code), ".html"))
  fetch_get(paste0(census_2011_report_url, "?OBL=", area_code), path)
  Sys.sleep(0.2)
}
fetch_get(census_2011_population_url, census_2011_population_path)
fetch_get(census_2011_method_url, census_2011_method_path)

infostat_fields <- list(
  "filters[ekatte_preb_2011_2021][]" = c("BG", district_codes),
  "filters[Relig_Denom][]" = as.character(0:8),
  "filters[periods][]" = "2021",
  filter = "1",
  "filters[filter]" = "filter",
  "filters[post]" = "1"
)
fetch_post(census_2021_district_url, census_2021_district_path, infostat_fields)
fetch_get(census_2021_municipality_url, census_2021_municipality_path)
fetch_get(census_2021_method_url, census_2021_method_path)
fetch_get(nsi_terms_url, nsi_terms_path)
fetch_get(gisco_boundary_url, gisco_boundary_path)
fetch_get(gisco_terms_url, gisco_terms_path)
fetch_get(eurostat_copyright_url, eurostat_copyright_path)

rows_2001 <- parse_2001(census_2001_path)
rows_2011 <- do.call(rbind, c(
  list(parse_2011_religion_page(census_2011_national_path, "BG")),
  lapply(district_codes, function(area_code) {
    parse_2011_religion_page(
      file.path(raw_dir, paste0("nsi_census_2011_religion_", tolower(area_code), ".html")),
      area_code
    )
  })
))
population_2011 <- parse_2011_population(census_2011_population_path)
rows_2021 <- parse_2021(census_2021_district_path)

reconciliation <- list(
  validate_wave(2001L, rows_2001),
  validate_wave(2011L, rows_2011, population_2011),
  validate_wave(2021L, rows_2021)
)
published_share_reproduction <- setNames(lapply(years, function(year) {
  validate_published_shares(year, switch(as.character(year), `2001` = rows_2001, `2011` = rows_2011, `2021` = rows_2021))
}), as.character(years))
comparability_note <- paste0(
  "NSI's published basis is the full population in 2001; 5,758,301 voluntary-question respondents out of 7,364,570 residents in 2011; and 5,903,108 people with religion information after excluding 616,681 administrative additions with no religion information from 6,519,789 residents in 2021. ",
  "These bases are incompatible instruments. The product therefore withholds religious_change between every pair of waves. ",
  "The responding share and response categories also changed across waves; the separate snapshots may reflect changing respondent composition as well as changing affiliation."
)
boundary_stability_note <- paste(
  "Geometric stability of Bulgarian district boundaries across 2001, 2011, and 2021 was not verified.",
  "The common 2021 geometry uses an explicit concordance between NSI district codes and GISCO NUTS 3 codes."
)

boundary_result <- write_boundary(build_boundary(gisco_boundary_path))
written_boundary <- boundary_result[["layer"]]
wave_rows <- list(`2001` = rows_2001, `2011` = rows_2011, `2021` = rows_2021)
rows <- unlist(lapply(years, function(year) {
  lapply(district_codes, function(area_code) {
    build_row(year, area_code, wave_rows[[as.character(year)]], population_2011, written_boundary)
  })
}), recursive = FALSE)
if (length(rows) != 84L) stop("expected 84 district-year rows", call. = FALSE)

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
    basis = "no governed Bulgaria place-of-worship snapshot is included in this census-affiliation release",
    notes = "The product ships census-affiliation metrics and district geometry only; place-density fields are null."
  ),
  source_datasets = source_datasets(),
  indicators = indicators(comparability_note),
  visual_layers = list(
    list(
      visual_layer_id = "bg-district-religious-affiliation",
      label = "Religious affiliation on NSI's published basis (%)",
      description = "Census-affiliation share on NSI's published denominator for each wave by district for 2001, 2011, and 2021.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "NSI's published wave basis"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "sum mutually exclusive published religion categories and divide by NSI's published denominator for that wave; do not calculate cross-wave change",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = paste(comparability_note, boundary_stability_note)
    ),
    list(
      visual_layer_id = "bg-district-no-religion",
      label = "No religion on NSI's published basis (%)",
      description = "Published no-religion share for 2011 and 2021; unavailable for 2001 because the source offered no no-religion category.",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "NSI's published basis for 2011 or 2021"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "published no-religion count divided by NSI's published denominator for the wave; null in 2001; do not calculate cross-wave change",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = comparability_note
    )
  ),
  rows = rows
)
write_json(area_summary, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")
validate_area_summary(summary_json_out)

raw_sources <- c(
  list(
    raw_source_record(census_2001_path, census_2001_dataset_id, "html", TRUE, "Census 2001 country and district religion table."),
    raw_source_record(census_2001_method_path, census_2001_dataset_id, "html", TRUE, "Census 2001 definition, voluntary-question statement, and non-response presentation."),
    raw_source_record(census_2011_national_path, census_2011_dataset_id, "html", TRUE, "Census 2011 national respondent table."),
    raw_source_record(census_2011_population_path, census_2011_dataset_id, "html", TRUE, "Census 2011 full district population table."),
    raw_source_record(census_2011_method_path, census_2011_dataset_id, "pdf", TRUE, "Census 2011 main results and voluntary-question presentation."),
    raw_source_record(census_2021_district_path, census_2021_dataset_id, "html", TRUE, "Infostat definition 2001 POST response for country and all districts."),
    raw_source_record(census_2021_municipality_path, census_2021_dataset_id, "html", FALSE, "Infostat definition 2024 route proving 2021 municipality availability."),
    raw_source_record(census_2021_method_path, census_2021_dataset_id, "pdf", TRUE, "Census 2021 ethno-cultural results and respondent-based presentation."),
    raw_source_record(nsi_terms_path, nsi_terms_dataset_id, "html", TRUE, "NSI Licence v2.0, including attribution and derivative-work clauses."),
    raw_source_record(gisco_boundary_path, boundary_dataset_id, "geojson", TRUE, "All-Europe NUTS 3 2021 GeoJSON filtered to Bulgaria."),
    raw_source_record(gisco_terms_path, boundary_dataset_id, "html", TRUE, "GISCO NUTS download description."),
    raw_source_record(eurostat_copyright_path, boundary_dataset_id, "html", TRUE, "Eurostat reuse and attribution policy.")
  ),
  lapply(district_codes, function(area_code) {
    raw_source_record(
      file.path(raw_dir, paste0("nsi_census_2011_religion_", tolower(area_code), ".html")),
      census_2011_dataset_id,
      "html",
      TRUE,
      paste("Census 2011 religion report for district", area_code)
    )
  })
)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:bg-census-religion:bg:2001-2021:nsi-gisco",
  dataset_id = "bg-census-religion:bg:2001-2021:nsi-gisco",
  dataset_version_id = paste0(
    "bg-census-religion:bg:2001-2021:nsi-gisco:",
    substr(sha256_file(summary_json_out), 1L, 12L)
  ),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "bg-census-religion",
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
      geography = "28 NSI districts mapped to GISCO NUTS 3 2021",
      construct = "census affiliation from the voluntary religion question",
      denominator = list(
        `2001` = published_basis[["2001"]],
        `2011` = published_basis[["2011"]],
        `2021` = published_basis[["2021"]]
      ),
      instrument_rule = "The three published bases differ. religious_change is withheld between every pair of waves; the snapshots retain the respondent-composition warning.",
      category_rule = "retain every source leaf label in the manifest; use exact broader groups for the 2011 released product where confidential leaf cells occur",
      boundary_source_vintage = boundary_vintage,
      boundary_simplification = boundary_result[["simplification"]],
      local_cache_hint = "Raw NSI pages, reports, terms, and GISCO geometry are cached under data/raw/bg_census/ and remain git-ignored.",
      retrieval_routes = list(
        list(purpose = "2001 district table", method = "GET", url = census_2001_url),
        list(purpose = "2011 national and district reports", method = "GET", url = paste0(census_2011_report_url, "?OBL={NSI_DISTRICT_CODE}")),
        list(purpose = "2011 full district populations", method = "GET", url = census_2011_population_url),
        list(purpose = "2021 district table", method = "POST", url = census_2021_district_url, notes = "Infostat definition 2001; select BG plus all level-4 districts and religion codes 0-8."),
        list(purpose = "2021 municipality route", method = "GET/POST", url = census_2021_municipality_url, notes = "Infostat definition 2024; 2021 only."),
        list(purpose = "boundary", method = "GET", url = gisco_boundary_url)
      ),
      reconciliation = reconciliation,
      published_share_reproduction = published_share_reproduction,
      boundary_validation = list(
        output_feature_count = 28L,
        valid_feature_count = boundary_result[["valid_feature_count"]],
        distinct_geometry_hash_count = length(unique(unlist(boundary_result[["geometry_hashes"]]))),
        geometry_sha256_by_district_code = boundary_result[["geometry_hashes"]],
        source_crs = "EPSG:4326",
        area_calculation_crs = "EPSG:3035",
        output_crs = "EPSG:4326"
      ),
      category_mappings = setNames(lapply(years, category_mapping), as.character(years)),
      source_leaf_categories_2011 = lapply(seq_len(nrow(source_categories_2011)), function(index) {
        list(
          source_code = source_categories_2011[["source_code"]][[index]],
          source_name_bg = source_categories_2011[["source_name_bg"]][[index]],
          source_display_en = source_categories_2011[["source_display_en"]][[index]],
          product_role = source_categories_2011[["role"]][[index]]
        )
      })
    ),
    software_versions = list(
      r = R.version.string,
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")),
      xml2 = as.character(packageVersion("xml2")),
      digest = as.character(packageVersion("digest")),
      mapshaper = "npx mapshaper through scripts/lib/simplify_boundary.R"
    )
  ),
  source = list(
    provider = "National Statistical Institute of Bulgaria (NSI); Eurostat Geographic Information System of the Commission (GISCO)",
    source_dataset_ids = list(census_2001_dataset_id, census_2011_dataset_id, census_2021_dataset_id, boundary_dataset_id, nsi_terms_dataset_id),
    source_urls = list(census_2001_url, census_2001_method_url, census_2011_report_url, census_2011_population_url, census_2011_method_url, census_2021_district_url, census_2021_municipality_url, census_2021_method_url, nsi_terms_url, gisco_boundary_url, gisco_terms_url, eurostat_copyright_url),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = paste(
      "NSI Licence v2.0 permits reproduction, distribution, and use, including commercial use, with attribution,",
      "but states that derivative and collective works may not be distributed; the derived census product therefore requires conductor review before publication.",
      "Eurostat GISCO material is reusable with source acknowledgement and a modification disclaimer."
    ),
    citation = "National Statistical Institute of Bulgaria censuses 2001, 2011, and 2021; Eurostat GISCO NUTS 3 2021."
  ),
  input_manifests = list(),
  raw_sources = raw_sources,
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id, notes = "84 district-year rows."),
    list(uri = paste0("repo:", summary_csv_out), sha256 = sha256_file(summary_csv_out), built_by = script_id, notes = "CSV companion."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out), built_by = script_id, notes = "28 simplified district features.")
  ),
  durable_files = list(
    manifest_file_record(summary_json_out, "Bulgaria district census-affiliation area summary for 2001, 2011, and 2021.", row_count = 84L),
    manifest_file_record(summary_csv_out, "Flattened Bulgaria district census-affiliation rows.", row_count = 84L),
    manifest_file_record(boundary_out, "Simplified GISCO NUTS 3 2021 Bulgaria geometry.", feature_count = 28L)
  ),
  validation = list(
    status = "passed_with_warnings",
    commands = list(
      "Rscript scripts/build_bg_area_summary.R",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/bg/data/area_summary_district.json"
    ),
    warnings = list(
      "NSI Licence v2.0 includes a clause against distributing derivative and collective works; conductor review is required before publication.",
      boundary_stability_note
    ),
    notes = paste(
      "All released-group count, published-denominator, published-headline-share, wave, geography, and geometry gates passed exactly.",
      "religious_change is withheld between every pair of waves because the published bases differ."
    )
  ),
  stats = list(
    district_year_rows = 84L,
    district_count = 28L,
    wave_count = 3L,
    boundary_valid_features = boundary_result[["valid_feature_count"]],
    distinct_geometry_hashes = length(unique(unlist(boundary_result[["geometry_hashes"]])))
  ),
  construct_notes = list(
    "The construct is census affiliation from the voluntary religion question. It does not measure belief, practice, attendance, or registered membership.",
    "NSI's published 2001 shares use the full population. NSI's 2011 shares use the R10 voluntary-question respondent total. NSI's 2021 shares exclude administrative additions with no religion information.",
    comparability_note,
    "The 2001 census offered no no-religion category. The product leaves no_religion_count and no_religion_percent null for 2001.",
    "The 2011 district report suppresses some Armenian Apostolic Orthodox and Jewish all-age cells as confidential under Article 25 of the Statistics Act. The product exactly derives the published broader Други вероизповедания (Other religions) group as the respondent total less every unsuppressed mutually exclusive category; it does not estimate or expose a suppressed leaf value.",
    "The product preserves Cannot self-identify, Cannot determine, Do not want to answer, and Unknown as distinct source categories where published.",
    "District is the primary geography because all three waves publish complete district category tables. The pinned municipality route contains 2021 only.",
    boundary_stability_note
  ),
  deferred_sources = list(
    list(
      source = census_2021_municipality_url,
      status = "extra_level_not_shipped",
      reason = "Infostat definition 2024 publishes municipalities for 2021 only; no matching municipal route was pinned for 2001 or 2011."
    )
  ),
  privacy = "public",
  licence_status = "needs_review",
  downstream_status = "staged",
  source_datasets = source_datasets(),
  notes = "The generated files are uncommitted. Do not publish the derived NSI summaries until the conductor resolves the Licence v2.0 derivative-work clause."
)
write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
invisible(fromJSON(manifest_out, simplifyVector = FALSE))

cat(sprintf("export routes pinned: 2001=%s; 2011=%s?OBL={code}; 2021 district=%s; 2021 municipality=%s\n", census_2001_url, census_2011_report_url, census_2021_district_url, census_2021_municipality_url))
cat("waves x geography: 2001, 2011, 2021 x 28 districts; municipality deferred because only 2021 is pinned\n")
cat(sprintf("category counts including total: 2001=%d; 2011=%d source leaves and %d exact product groups; 2021=%d\n", reconciliation[[1]][["published_category_rows_including_total"]], nrow(source_categories_2011), reconciliation[[2]][["published_category_rows_including_total"]], reconciliation[[3]][["published_category_rows_including_total"]]))
cat(sprintf("national non-response: 2001=%d (%.4f%%); 2011=%d (%.4f%%); 2021=%d (%.4f%%)\n", reconciliation[[1]][["national_nonresponse_count"]], reconciliation[[1]][["national_nonresponse_percent"]], reconciliation[[2]][["national_nonresponse_count"]], reconciliation[[2]][["national_nonresponse_percent"]], reconciliation[[3]][["national_nonresponse_count"]], reconciliation[[3]][["national_nonresponse_percent"]]))
cat("published basis: 2001=full population 7,928,901; 2011=R10 voluntary-question respondents 5,758,301 of 7,364,570 residents; 2021=5,903,108 people with religion information of 6,519,789 residents\n")
cat("published-share gate: passed; cited NSI headline shares reproduced at their published one-decimal precision\n")
cat("religious_change: withheld between every wave pair because the published bases differ; respondent-composition warning retained\n")
cat("reconciliation gate: passed; every district and national released-group sum matched exactly\n")
cat("wave gate: passed; 2001, 2011, and 2021 are present\n")
cat("geometry gate: passed; 28 valid features with 28 distinct SHA-256 WKB hashes\n")
cat("boundary-stability gate: unverified and disclosed; common 2021 geometry used\n")
cat("licence gate: needs review; NSI Licence v2.0 derivative-work clause requires conductor review before publication\n")
