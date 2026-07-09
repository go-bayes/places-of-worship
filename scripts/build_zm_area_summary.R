# build the zambia province area-summary product from the 2022 and 2010 censuses.
# inputs: the 2022 Census of Population and Housing Series B Religion Descriptive
# Tables (table B.1, population (de facto) by religion affiliation and province),
# the 2022 Census National Analytical Report (figures 3.13-3.16 as the category
# reconciliation authority and the 2010/2022 province population comparison
# table), the ten 2010 provincial analytical reports (figure 4.10 religion
# percentages, read from the rendered chart data labels), and the geoBoundaries
# ZMB ADM1 (10 provinces) GeoJSON.
# outputs: apps/regions/zm/data/zm_province_2011.geojson,
# apps/regions/zm/data/area_summary_province.{json,csv}, and
# docs/manifests/zm-census-religion-2010-2022.json.
# run from the repo root: Rscript scripts/build_zm_area_summary.R
# table B.1 is parsed from the PDF with poppler pdftotext -layout; the 2010
# figure percentages are transcribed chart data labels verified against each
# figure page and reconciled by row sum.

suppressMessages({
  library(jsonlite)
  library(sf)
})

raw_dir <- "data/raw/zm_census"
zm_dir <- "apps/regions/zm/data"
manifest_dir <- "docs/manifests"
dir.create(zm_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- "2026-07-09"
script_id <- "scripts/build_zm_area_summary.R"
country_code <- "ZM"
years <- c(2010L, 2022L)

boundary_set_id <- "zm-province-2011-geoboundaries-adm1"
boundary_level <- "province"
census_2022_dataset_id <- "zamstats-2022-cph-series-b-table-b1-religion-by-province"
census_2010_dataset_id <- "zamstats-2010-cph-provincial-analytical-reports-figure-4-10-religion"
analytical_2022_dataset_id <- "zamstats-2022-cph-national-analytical-report"
boundary_dataset_id <- "geoboundaries-zmb-adm1-2011"

# source urls recorded in the manifest and the on-page attribution. every
# report is an open download from the ZamStats WordPress uploads area.
religion_tables_url <- "https://www.zamstats.gov.zm/wp-content/uploads/2026/04/Religion-Descriptive-Tables-Final.pdf"
analytical_2022_url <- "https://www.zamstats.gov.zm/wp-content/uploads/2025/08/2022-Census-National-Analytical-Report.pdf"
census_landing_url <- "https://www.zamstats.gov.zm/population-census/"
provincial_2010_base_url <- "https://www.zamstats.gov.zm/wp-content/uploads/2023/12/"
national_2010_url <- "https://www.zamstats.gov.zm/wp-content/uploads/2023/12/National-Analytical-Report-2010-Census.pdf"
questionnaire_url <- "https://www.zamstats.gov.zm/wp-content/uploads/2023/12/2022-CPH-Institutional-Qre-FV_15June2022.pdf"
geoboundaries_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/ZMB/ADM1/"
geoboundaries_gj_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/ZMB/ADM1/geoBoundaries-ZMB-ADM1.geojson"
geoboundaries_adm2_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/ZMB/ADM2/"
geoboundaries_adm2_gj_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/ZMB/ADM2/geoBoundaries-ZMB-ADM2.geojson"

religion_tables_path <- file.path(raw_dir, "zm_2022_religion_descriptive_tables.pdf")
analytical_2022_path <- file.path(raw_dir, "zm_2022_national_analytical.pdf")
national_2010_path <- file.path(raw_dir, "zm_2010_national_analytical.pdf")
questionnaire_path <- file.path(raw_dir, "zm_2022_questionnaire.pdf")
geoboundaries_path <- file.path(raw_dir, "geoBoundaries-ZMB-ADM1.geojson")
geoboundaries_meta_path <- file.path(raw_dir, "gb_zmb_adm1_meta.json")
geoboundaries_adm2_path <- file.path(raw_dir, "geoBoundaries-ZMB-ADM2.geojson")
geoboundaries_adm2_meta_path <- file.path(raw_dir, "gb_zmb_adm2_meta.json")
lusaka_2000_path <- file.path(raw_dir, "zm_2000_lusaka.pdf")

boundary_out <- file.path(zm_dir, "zm_province_2011.geojson")
summary_json_out <- file.path(zm_dir, "area_summary_province.json")
summary_csv_out <- file.path(zm_dir, "area_summary_province.csv")
manifest_out <- file.path(manifest_dir, "zm-census-religion-2010-2022.json")

licence_text <- paste(
  "ZamStats 2022 Census of Population and Housing Series B Religion Descriptive",
  "Tables, table B.1 (population (de facto) by religion affiliation and",
  "province), and the ten 2010 Census provincial analytical reports, figure",
  "4.10 (percentage distribution of population by religious affiliation). The",
  "Zambia Statistics Agency publishes the census reports for open download; no",
  "explicit reuse licence is stated, so the derived product attributes ZamStats",
  "and links the source of record. Boundaries are geoBoundaries ZMB ADM1 (10",
  "provinces), Creative Commons Attribution 4.0 International, boundary source",
  "Zambia Data Hub (Zambia NSDI, Ministry of Lands and Natural Resources)."
)
licence_status <- "zamstats_census_open_report_attribution_geoboundaries_cc_by_4_0"

# the ten provinces in table B.1 printed order, with the table's own spelling.
province_order_2022 <- c(
  "Central", "Copperbelt", "Eastern", "Luapula", "Lusaka",
  "Muchinga", "Northern", "NorthWestern", "Southern", "Western"
)

# table B.1 value columns in printed left-to-right order. the printed header
# lists the questionnaire code order (Christianity, Islam, Judaism, Hinduism,
# Buddhism, Bahai Faith, Sikhism, African Traditional Religion, Non-Religious,
# Other Religious Groups), but that labelling is inconsistent with the census's
# own analytical figures: under it African Traditional would be 463 persons
# (figure 3.13 prints 0.2 percent, about 30,000) and Non-Religious would be
# 9,238 (figures 3.13-3.15 print 1.3 percent national, 1.8/0.8 male/female,
# about 233,000). the unique column assignment consistent with figures
# 3.13-3.16 of the 2022 National Analytical Report and with the bundled
# tables B.2/B.3 is used here: column 4 African Traditional (30,502 national),
# column 9 Judaism (463), column 10 Other Religious Groups (9,238), column 11
# Non-Religious (233,260). the reconciliation assertions below fail loudly if
# a corrected reprint changes any of these values.
category_cols <- c(
  "total", "christianity", "islam", "african_traditional", "hinduism",
  "buddhism", "bahai", "sikhism", "judaism", "other_religious_groups",
  "non_religious"
)

# the nine named-religion columns that make up religious affiliation; every
# category except non-religious. table B.1 allocates every de facto person to
# one of the ten groups, so the named religions plus non-religious exhaust the
# total.
affiliation_cols_2022 <- c(
  "christianity", "islam", "african_traditional", "hinduism", "buddhism",
  "bahai", "sikhism", "judaism", "other_religious_groups"
)

# national values of table B.1 in printed column order, asserted against the
# parse so the label reconciliation above cannot drift silently.
national_2022_expected <- c(
  total = 18340343, christianity = 17966377, islam = 88803,
  african_traditional = 30502, hinduism = 2106, buddhism = 7531,
  bahai = 910, sikhism = 1153, judaism = 463,
  other_religious_groups = 9238, non_religious = 233260
)

# per-province Christianity percentages printed in figure 3.16 of the 2022
# National Analytical Report; asserting the parsed counts reproduce them pins
# the Christianity and total columns independently of the header question.
fig_3_16_christianity <- c(
  Central = 99.0, Copperbelt = 98.6, Eastern = 95.9, Luapula = 97.2,
  Lusaka = 97.6, Muchinga = 99.4, Northern = 98.2, NorthWestern = 96.5,
  Southern = 99.1, Western = 98.7
)

# figure 4.10 of each 2010 provincial analytical report: percentage
# distribution of the population by religious affiliation (Protestant,
# Catholic, Muslim, Other, None), transcribed from the printed chart data
# labels on the rendered figure pages (percent of the province's population,
# one decimal). counts are not published, so the 2010 wave ships percent-only.
fig_2010 <- data.frame(
  terr_name = c("Central", "Copperbelt", "Eastern", "Luapula", "Lusaka",
                "Muchinga", "Northern", "North Western", "Southern", "Western"),
  protestant = c(81.6, 75.7, 65.6, 69.1, 75.0, 77.2, 59.3, 81.9, 86.2, 84.2),
  catholic = c(14.0, 20.7, 27.0, 27.0, 20.0, 19.1, 37.9, 11.7, 11.0, 11.3),
  muslim = c(0.3, 0.5, 1.2, 0.1, 0.9, 0.1, 0.3, 0.2, 0.2, 0.1),
  other = c(2.8, 1.9, 3.4, 1.0, 2.2, 2.9, 1.2, 2.0, 1.2, 1.1),
  none = c(1.0, 1.0, 2.6, 2.7, 1.6, 0.6, 1.3, 4.0, 1.4, 3.3),
  stringsAsFactors = FALSE
)

# figure 4.10 of the 2010 National Analytical Report, recorded for context:
# Protestant 75.3, Catholic 20.2, Muslim 0.5, Other 2.0, None 1.8 (sum 99.8).
national_2010_none_percent <- 1.8

# the source pdf for each 2010 provincial figure, keyed by census spelling.
provincial_2010_files <- c(
  "Central" = "zm_2010_central.pdf",
  "Copperbelt" = "zm_2010_copperbelt.pdf",
  "Eastern" = "zm_2010_eastern.pdf",
  "Luapula" = "zm_2010_luapula.pdf",
  "Lusaka" = "zm_2010_lusaka.pdf",
  "Muchinga" = "zm_2010_muchinga.pdf",
  "Northern" = "zm_2010_northern.pdf",
  "North Western" = "zm_2010_northwestern.pdf",
  "Southern" = "zm_2010_southern.pdf",
  "Western" = "zm_2010_western.pdf"
)
provincial_2010_urls <- c(
  "Central" = "Central-Province-Analytical-Report-2010-Census.pdf",
  "Copperbelt" = "Copperbelt-Province-Analytical-Report-2010-Census.pdf",
  "Eastern" = "Eastern-Province-Analytical-Report-2010-Census.pdf",
  "Luapula" = "Luapula-Province-Analytical-Report-2010-Census.pdf",
  "Lusaka" = "Lusaka-Province-Analytical-Report-2010-Census.pdf",
  "Muchinga" = "Muchinga-Province-Analytical-Report-2010-Census.pdf",
  "Northern" = "Northern-Province-Analytical-Report-2010-Census.pdf",
  "North Western" = "North-Western-Province-Analytical-Report-2010-Census.pdf",
  "Southern" = "Southern-Province-Analytical-Report-2010-Census.pdf",
  "Western" = "Western-Province-Analytical-Report-2010-Census.pdf"
)

# stop early if a required raw source has not been downloaded.
require_file <- function(path) {
  if (!file.exists(path)) stop("missing required source: ", path, call. = FALSE)
}

# compute the sha-256 digest for a local file.
sha256_file <- function(path) {
  unname(tools::sha256sum(path))
}

# return file size in bytes for manifest records.
file_bytes <- function(path) {
  as.numeric(unname(file.info(path)[["size"]]))
}

# return NULL for a scalar that should serialise as JSON null.
null_if_na <- function(value) {
  if (length(value) == 0L || is.na(value) || !is.finite(value)) return(NULL)
  value
}

# count rows or features for CSV, GeoJSON, and area-summary JSON files.
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$", path)) {
    geo <- fromJSON(path, simplifyVector = FALSE)
    return(length(geo[["features"]]))
  }
  if (grepl("\\.json$", path)) {
    json <- fromJSON(path, simplifyVector = FALSE)
    if (!is.null(json[["rows"]])) return(length(json[["rows"]]))
  }
  NA_integer_
}

# normalise a province label so census and geoBoundaries spellings compare
# equal: lowercase, drop punctuation and spaces ("NorthWestern",
# "North Western", and "North-Western" all become "northwestern").
zm_norm <- function(x) {
  x <- tolower(trimws(as.character(x)))
  gsub("[^a-z0-9]+", "", x)
}

# run pdftotext -layout and return the text lines.
pdf_layout_lines <- function(pdf_path) {
  pdftotext <- Sys.which("pdftotext")
  if (!nzchar(pdftotext)) {
    stop("pdftotext (poppler) is required to parse the census PDFs", call. = FALSE)
  }
  layout_path <- tempfile(fileext = ".txt")
  on.exit(unlink(layout_path), add = TRUE)
  status <- system2(pdftotext, c("-layout", shQuote(pdf_path), shQuote(layout_path)))
  if (status != 0L) stop("pdftotext failed on ", pdf_path, call. = FALSE)
  readLines(layout_path, warn = FALSE)
}

# extract table B.1 from the Religion Descriptive Tables PDF: the Zambia row
# and the ten province rows, eleven comma-formatted integers each.
read_census_2022 <- function(pdf_path) {
  txt <- pdf_layout_lines(pdf_path)
  # the table title also appears on the contents page, so every occurrence is
  # tried and the first window that parses all eleven rows wins.
  hdr <- grep("TABLE B\\.1: POPULATION \\(DE FACTO\\) BY RELIGION AFFILIATION AND\\s+PROVINCE", txt)
  if (length(hdr) < 1L) stop("could not locate table B.1", call. = FALSE)

  num <- "[0-9][0-9,]*"
  pat <- paste0("^\\s*([A-Za-z][A-Za-z ]*?)\\s+(", num, "(?:\\s+", num, "){10})\\s*$")
  parse_ints <- function(s) as.numeric(gsub(",", "", strsplit(trimws(s), "\\s+")[[1]]))
  expected_rows <- c("Zambia", province_order_2022)

  for (start in hdr) {
    b2 <- grep("TABLE B\\.2:", txt)
    b2 <- b2[b2 > start][1]
    if (is.na(b2)) b2 <- min(start + 40L, length(txt) + 1L)
    window <- txt[start:(b2 - 1L)]

    matched <- list()
    for (line in window) {
      m <- regmatches(line, regexec(pat, line, perl = TRUE))[[1]]
      if (length(m) != 3L) next
      matched[[trimws(m[2])]] <- parse_ints(m[3])
    }
    if (length(setdiff(expected_rows, names(matched))) == 0L) {
      mat <- do.call(rbind, matched[expected_rows])
      colnames(mat) <- category_cols
      return(mat)
    }
  }
  stop("could not parse all eleven table B.1 rows from any occurrence", call. = FALSE)
}

# extract the 2010/2022 province population comparison table from the 2022
# National Analytical Report (table under section 2.3): province, 2010
# population, 2022 population. the North Western label wraps across two lines,
# so rows are read in printed order and asserted against the Total row.
read_population_comparison <- function(pdf_path) {
  txt <- pdf_layout_lines(pdf_path)
  anchor <- grep("^\\s*Total\\s+13,092,666\\s+19,693,423", txt)
  if (length(anchor) < 1L) {
    stop("could not locate the 2010/2022 population comparison table", call. = FALSE)
  }
  window <- txt[anchor[1]:(anchor[1] + 30L)]
  pat <- "^\\s*([A-Za-z][A-Za-z ]*?)\\s+([0-9][0-9,]*)\\s+([0-9][0-9,]*)\\s+\\d+\\.\\d"
  rows <- list()
  for (line in window) {
    m <- regmatches(line, regexec(pat, line, perl = TRUE))[[1]]
    if (length(m) != 4L) next
    rows[[length(rows) + 1L]] <- list(
      name = trimws(m[2]),
      pop_2010 = as.numeric(gsub(",", "", m[3])),
      pop_2022 = as.numeric(gsub(",", "", m[4]))
    )
  }
  # printed order after the Total/Rural/Urban rows; the wrapped "North
  # Western" label matches as a bare "Western" in seventh place.
  province_rows <- Filter(function(r) !r[["name"]] %in% c("Total", "Rural", "Urban"), rows)
  if (length(province_rows) != 10L) {
    stop("expected 10 province rows in the population comparison table", call. = FALSE)
  }
  printed_order <- c("Central", "Copperbelt", "Eastern", "Luapula", "Lusaka",
                     "Muchinga", "Northern", "North Western", "Southern", "Western")
  names_found <- vapply(province_rows, function(r) r[["name"]], character(1))
  # the label may extract whole ("North Western") or wrap to a bare "Western"
  # in seventh place depending on the poppler line join; accept either.
  wrapped_order <- c("Central", "Copperbelt", "Eastern", "Luapula", "Lusaka",
                     "Muchinga", "Northern", "Western", "Southern", "Western")
  if (!identical(names_found, printed_order) && !identical(names_found, wrapped_order)) {
    stop("population comparison rows not in the expected printed order: ",
         paste(names_found, collapse = "; "), call. = FALSE)
  }
  out <- data.frame(
    terr_name = printed_order,
    pop_2010 = vapply(province_rows, function(r) r[["pop_2010"]], numeric(1)),
    pop_2022 = vapply(province_rows, function(r) r[["pop_2022"]], numeric(1)),
    stringsAsFactors = FALSE
  )
  if (sum(out[["pop_2010"]]) != 13092666) {
    stop("2010 province populations do not sum to the printed total", call. = FALSE)
  }
  if (sum(out[["pop_2022"]]) != 19693423) {
    stop("2022 province populations do not sum to the printed total", call. = FALSE)
  }
  out
}

# metric CRS for area computation and metre-tolerance simplification;
# Africa Albers Equal Area covers Zambia without a UTM-zone seam.
africa_aea <- paste(
  "+proj=aea +lat_1=20 +lat_2=-23 +lat_0=0 +lon_0=25",
  "+x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"
)

# prepare the province boundary layer from the geoBoundaries ZMB ADM1 file;
# shapeISO carries the ISO 3166-2 ZM-NN codes used as area codes.
read_boundary <- function(path) {
  gb <- st_read(path, quiet = TRUE)
  if (nrow(gb) != 10L) stop("expected 10 geoBoundaries ZMB ADM1 provinces", call. = FALSE)
  gb <- st_make_valid(gb)
  gb_metric <- st_transform(gb, africa_aea)

  gb[["area_name"]] <- as.character(gb[["shapeName"]])
  gb[["area_code"]] <- as.character(gb[["shapeISO"]])
  gb[["area_unit_id"]] <- paste0(boundary_set_id, ":", gb[["area_code"]])
  gb[["boundary_set_id"]] <- boundary_set_id
  gb[["boundary_level"]] <- boundary_level
  gb[["shape_id"]] <- as.character(gb[["shapeID"]])
  gb[["join_name"]] <- zm_norm(gb[["area_name"]])
  gb[["land_area_sq_km"]] <- as.numeric(st_area(gb_metric)) / 1e6

  if (any(duplicated(gb[["join_name"]]))) {
    stop("duplicate province join names in the boundary layer", call. = FALSE)
  }
  if (any(!nzchar(gb[["area_code"]]))) {
    stop("a geoBoundaries province has an empty shapeISO code", call. = FALSE)
  }
  gb
}

# match census rows to the boundary layer by normalised province name.
boundary_index_for <- function(terr_names, boundary) {
  index <- match(zm_norm(terr_names), boundary[["join_name"]])
  if (any(is.na(index))) {
    stop("unmatched ZM province rows: ",
         paste(terr_names[is.na(index)], collapse = "; "), call. = FALSE)
  }
  if (any(duplicated(index))) stop("duplicate matched province boundaries", call. = FALSE)
  index
}

# build one schema-shaped area-summary row.
build_area_row <- function(area_code, area_name, area_unit_id, land_area_sq_km,
                           year, population_total, population_total_basis,
                           affiliation_count, affiliation_percent,
                           no_religion_count, no_religion_percent,
                           source_ids, quality_flag) {
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = area_unit_id,
    area_code = as.character(area_code),
    area_name = area_name,
    year = year,
    population_total = null_if_na(as.integer(population_total)),
    population_total_basis = population_total_basis,
    religious_affiliation_count = null_if_na(as.integer(affiliation_count)),
    religious_affiliation_percent = null_if_na(affiliation_percent),
    no_religion_count = null_if_na(as.integer(no_religion_count)),
    no_religion_percent = null_if_na(no_religion_percent),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(land_area_sq_km, 2),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = source_ids,
    quality_flag = quality_flag
  )
}

# flatten area-summary rows for the CSV sibling.
flatten_rows <- function(rows) {
  csv_scalar <- function(value, missing_value) {
    if (is.null(value)) return(missing_value)
    value
  }
  do.call(rbind, lapply(rows, function(row) {
    data.frame(
      country_code = row[["country_code"]],
      boundary_set_id = row[["boundary_set_id"]],
      boundary_level = row[["boundary_level"]],
      area_unit_id = row[["area_unit_id"]],
      area_code = row[["area_code"]],
      area_name = row[["area_name"]],
      year = row[["year"]],
      population_total = csv_scalar(row[["population_total"]], NA_integer_),
      population_total_basis = row[["population_total_basis"]],
      religious_affiliation_count = csv_scalar(row[["religious_affiliation_count"]], NA_integer_),
      religious_affiliation_percent = csv_scalar(row[["religious_affiliation_percent"]], NA_real_),
      no_religion_count = csv_scalar(row[["no_religion_count"]], NA_integer_),
      no_religion_percent = csv_scalar(row[["no_religion_percent"]], NA_real_),
      place_count = NA_integer_,
      places_per_10000_residents = NA_real_,
      place_density_per_sq_km = NA_real_,
      land_area_sq_km = row[["land_area_sq_km"]],
      site_snapshot_date = NA,
      place_count_basis = NA,
      source_dataset_ids = paste(row[["source_dataset_ids"]], collapse = "|"),
      quality_flag = row[["quality_flag"]],
      stringsAsFactors = FALSE
    )
  }))
}

# write the boundary, increasing simplification tolerance until it is small.
write_simplified_boundary <- function(boundary, output_path, field_names) {
  boundary_fields <- boundary[, field_names]
  tolerances <- c(50, 100, 200, 500, 1000, 1500, 2000)
  for (tolerance in tolerances) {
    candidate <- st_transform(boundary_fields, africa_aea)
    candidate <- st_simplify(candidate, dTolerance = tolerance, preserveTopology = TRUE)
    candidate <- st_make_valid(st_transform(candidate, 4326))
    if (any(st_is_empty(candidate))) next
    st_write(
      candidate,
      output_path,
      driver = "GeoJSON",
      delete_dsn = TRUE,
      quiet = TRUE,
      layer_options = c("COORDINATE_PRECISION=5")
    )
    bytes <- file_bytes(output_path)
    if (bytes <= 3000000L) return(list(tolerance_m = tolerance, bytes = bytes))
  }
  stop("simplified ZM boundary remains above 3 MB", call. = FALSE)
}

# create the source-dataset records for the area-summary document.
source_datasets <- function() {
  list(
    list(
      source_dataset_id = census_2022_dataset_id,
      name = "ZamStats 2022 CPH Series B Religion Descriptive Tables, table B.1: population (de facto) by religion affiliation and province",
      provider = "Zambia Statistics Agency (ZamStats)",
      url = religion_tables_url,
      retrieval_date = retrieval_date,
      local_path = religion_tables_path,
      licence = list(
        name = "ZamStats census report, open download; no explicit reuse licence stated",
        url = census_landing_url,
        attribution = "Zambia Statistics Agency (ZamStats)"
      ),
      citation = "Zambia Statistics Agency, 2022 Census of Population and Housing, Series B Religion Descriptive Tables, Table B.1.",
      access_limits = NULL,
      redistribution_limits = "The census PDF is not committed; the derived public product attributes ZamStats and links the source.",
      notes = paste(
        "Table B.1 gives the de facto population in ten religion groups for the ten provinces plus the Zambia row;",
        "parsed with pdftotext -layout. The printed column header lists the questionnaire code order, which is",
        "inconsistent with the census's own analytical figures; the adopted column assignment (African Traditional",
        "30,502; Judaism 463; Other Religious Groups 9,238; Non-Religious 233,260 national) is the unique reading",
        "consistent with figures 3.13-3.16 of the 2022 National Analytical Report and with tables B.2/B.3.",
        "Every person is allocated to one of the ten groups, so no not-stated residual exists.",
        "District tables (B.4/B.5) publish only Christianity against a bundled remainder and cannot separate no religion."
      )
    ),
    list(
      source_dataset_id = census_2010_dataset_id,
      name = "ZamStats 2010 Census provincial analytical reports, figure 4.10: percentage distribution of population by religious affiliation (ten provinces)",
      provider = "Zambia Statistics Agency (ZamStats; then Central Statistical Office)",
      url = paste0(provincial_2010_base_url, "Lusaka-Province-Analytical-Report-2010-Census.pdf"),
      retrieval_date = retrieval_date,
      local_path = file.path(raw_dir, "zm_2010_lusaka.pdf"),
      licence = list(
        name = "ZamStats census reports, open download; no explicit reuse licence stated",
        url = census_landing_url,
        attribution = "Zambia Statistics Agency (ZamStats)"
      ),
      citation = "Central Statistical Office of Zambia, 2010 Census of Population and Housing, Provincial Analytical Reports (ten volumes), Figure 4.10.",
      access_limits = NULL,
      redistribution_limits = "The census PDFs are not committed; the derived public product attributes ZamStats and links the source.",
      notes = paste(
        "Each provincial report prints figure 4.10 with five percentage data labels (Protestant, Catholic, Muslim,",
        "Other, None; percent of the province's population, one decimal). Counts are not published at province level,",
        "so the 2010 wave ships percentages only. The reports were published after the 2011 provincial reform and",
        "tabulate the 2010 census on the current ten provinces, including Muchinga."
      )
    ),
    list(
      source_dataset_id = analytical_2022_dataset_id,
      name = "ZamStats 2022 Census National Analytical Report (figures 3.13-3.16 religion; section 2.3 population by province, 2010 and 2022)",
      provider = "Zambia Statistics Agency (ZamStats)",
      url = analytical_2022_url,
      retrieval_date = retrieval_date,
      local_path = analytical_2022_path,
      licence = list(
        name = "ZamStats census report, open download; no explicit reuse licence stated",
        url = census_landing_url,
        attribution = "Zambia Statistics Agency (ZamStats)"
      ),
      citation = "Zambia Statistics Agency, 2022 Census of Population and Housing National Analytical Report.",
      access_limits = NULL,
      redistribution_limits = "The census PDF is not committed; the derived public product attributes ZamStats and links the source.",
      notes = paste(
        "Used in two ways: the religion figures 3.13-3.16 are the authority for reconciling table B.1's category",
        "labels, and the section 2.3 comparison table supplies the 2010 census population by province on the",
        "current ten-province structure (total 13,092,666), shown as context for the percent-only 2010 wave."
      )
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "geoBoundaries ZMB ADM1 (10 provinces)",
      provider = "geoBoundaries (William & Mary geoLab)",
      url = geoboundaries_gj_url,
      retrieval_date = retrieval_date,
      local_path = geoboundaries_path,
      licence = list(
        name = "Creative Commons Attribution 4.0 International (CC BY 4.0); boundary source Zambia Data Hub (Zambia NSDI)",
        url = geoboundaries_meta_url,
        attribution = "geoBoundaries (gbOpen); boundary source Zambia Data Hub"
      ),
      citation = "Runfola et al., geoBoundaries ZMB ADM1 (gbOpen), province boundaries.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary is committed with CC BY 4.0 attribution to geoBoundaries and Zambia Data Hub.",
      notes = "10 ADM1 provinces matching the post-2011 provincial structure both census waves report on; shapeISO carries the ISO 3166-2 ZM-NN codes used as area codes. Source data update 2023-01-19."
    )
  )
}

# create the indicator metadata for the province product.
indicators_for_province <- function() {
  denominator_note <- paste(
    "2022 percentages use the table B.1 de facto province total as the",
    "denominator; every person is allocated to one of the ten religion groups,",
    "so there is no not-stated category to exclude. 2010 values are the",
    "percentages printed in each provincial analytical report's figure 4.10",
    "(percent of the province's population, one decimal); counts are not",
    "published at province level for 2010."
  )
  list(
    list(
      indicator_id = "population_total",
      label = "Census population denominator",
      description = "2022: de facto province total in table B.1. 2010: census population by province from the 2022 National Analytical Report comparison table (context for the percent-only wave).",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "2022: table B.1 province total. 2010: section 2.3 comparison table of the 2022 National Analytical Report.",
      temporal_coverage = "2010, 2022",
      spatial_coverage = "Zambia provinces (geoBoundaries ADM1) as re-tabulated on the post-2011 ten-province structure.",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious affiliation %",
      description = "Share of persons declaring any named religion.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "2022: 100 * (sum of the nine named-religion groups) / province de facto total. 2010: Protestant + Catholic + Muslim + Other as printed in figure 4.10.",
      temporal_coverage = "2010, 2022",
      spatial_coverage = "Zambia provinces (geoBoundaries ADM1).",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "No religion %",
      description = "Share of persons reporting no religion.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "2022: 100 * Non-Religious / province de facto total (column assignment reconciled against the analytical-report figures). 2010: the None percentage as printed in figure 4.10.",
      temporal_coverage = "2010, 2022",
      spatial_coverage = "Zambia provinces (geoBoundaries ADM1).",
      quality_notes = denominator_note
    )
  )
}

# define the choropleth layers exposed by the shared region map.
visual_layers_for_province <- function() {
  list(
    list(
      visual_layer_id = "zm-province-religious-affiliation",
      label = "Religious affiliation %",
      description = "Zambia census 2010-2022 religious-affiliation share.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "persons in the census religion tabulation"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = "All named-religion groups count as religious affiliation in both waves."
    ),
    list(
      visual_layer_id = "zm-province-no-religion",
      label = "No religion %",
      description = "Zambia census 2010-2022 no-religion share.",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "persons in the census religion tabulation"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = "2022: the Non-Religious group of table B.1 (column assignment reconciled against the analytical-report figures). 2010: the None category of figure 4.10."
    )
  )
}

# assemble the schema-compatible area-summary document.
area_summary_document <- function(rows) {
  list(
    schema_version = "0.2.0",
    generated_at = stamp,
    generated_by = script_id,
    country_code = country_code,
    boundary_set = list(
      boundary_set_id = boundary_set_id,
      country_code = country_code,
      level = boundary_level,
      vintage = "2011",
      source_dataset_id = boundary_dataset_id
    ),
    site_snapshot = list(
      source_dataset_id = NULL,
      snapshot_date = NULL,
      basis = "no governed Zambia OpenStreetMap place-of-worship snapshot is included in this country data-map release",
      notes = "The Zambia page exposes census religious-affiliation and no-religion metrics only; place-density metrics are hidden until a governed Zambia place layer is built."
    ),
    source_datasets = source_datasets(),
    indicators = indicators_for_province(),
    visual_layers = visual_layers_for_province(),
    rows = rows
  )
}

# create a manifest durable-file record for one generated output.
manifest_file_record <- function(path, content, licence_status_value) {
  list(
    uri = paste0("repo:", path),
    storage_provider = "git_repository",
    format = sub("^.*\\.", "", path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    row_count = row_count_file(path),
    content = content,
    privacy = "public",
    licence_status = licence_status_value
  )
}

# create a manifest raw-source record for one local source file.
raw_source_record <- function(path, url, format, row_count, source_id, used, periods, notes) {
  list(
    uri = path,
    url = url,
    format = format,
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    row_count = row_count,
    source_dataset_id = source_id,
    used_in_public_product = used,
    periods = periods,
    notes = notes
  )
}

required_sources <- c(religion_tables_path, analytical_2022_path, geoboundaries_path,
                      file.path(raw_dir, provincial_2010_files))
invisible(lapply(required_sources, require_file))

# ---- 2022 wave: parse and reconcile table B.1 ----
census_2022 <- read_census_2022(religion_tables_path)
national_2022 <- census_2022["Zambia", ]
province_2022 <- census_2022[province_order_2022, , drop = FALSE]

# the parsed national row must equal the printed national values exactly; this
# pins the column assignment the reconciliation note documents.
if (!all(national_2022 == national_2022_expected)) {
  stop("table B.1 national row does not match the recorded printed values", call. = FALSE)
}
# every row's ten religion groups sum to its printed total.
component_sum <- rowSums(census_2022[, category_cols[-1]])
if (any(component_sum != census_2022[, "total"])) {
  stop("a table B.1 row's ten religion groups do not sum to its printed total", call. = FALSE)
}
# every category's ten province values sum to its printed national value.
for (col in category_cols) {
  if (sum(province_2022[, col]) != national_2022[[col]]) {
    stop("table B.1 column '", col, "' does not sum to its national value", call. = FALSE)
  }
}
# the parsed counts must reproduce the analytical report's printed percentages:
# figure 3.16 Christianity share per province, and figure 3.13 nationally
# (Christianity 98.0, Islam 0.5, African Traditional 0.2, Other 0.1, None 1.3).
christianity_percent <- round(100 * province_2022[, "christianity"] / province_2022[, "total"], 1)
if (!all(christianity_percent == fig_3_16_christianity[province_order_2022])) {
  stop("province Christianity shares do not reproduce figure 3.16", call. = FALSE)
}
fig_3_13_check <- c(
  christianity = 98.0, islam = 0.5, african_traditional = 0.2, none = 1.3
)
national_total_2022 <- national_2022[["total"]]
fig_3_13_observed <- c(
  christianity = round(100 * national_2022[["christianity"]] / national_total_2022, 1),
  islam = round(100 * national_2022[["islam"]] / national_total_2022, 1),
  african_traditional = round(100 * national_2022[["african_traditional"]] / national_total_2022, 1),
  none = round(100 * national_2022[["non_religious"]] / national_total_2022, 1)
)
if (!all(fig_3_13_observed == fig_3_13_check)) {
  stop("the reconciled 2022 category assignment does not reproduce figure 3.13", call. = FALSE)
}
other_small_sum <- sum(national_2022[c("judaism", "hinduism", "buddhism", "bahai", "sikhism", "other_religious_groups")])
if (round(100 * other_small_sum / national_total_2022, 1) != 0.1) {
  stop("the residual named-religion groups do not reproduce figure 3.13's Other share", call. = FALSE)
}

affiliation_2022 <- rowSums(province_2022[, affiliation_cols_2022])
no_religion_2022 <- province_2022[, "non_religious"]
if (any(affiliation_2022 + no_religion_2022 != province_2022[, "total"])) {
  stop("2022 affiliation plus no religion does not equal the province total", call. = FALSE)
}

# ---- 2010 wave: verify the transcribed figure percentages ----
fig_2010_sums <- rowSums(fig_2010[, c("protestant", "catholic", "muslim", "other", "none")])
if (any(fig_2010_sums < 99.5 | fig_2010_sums > 100.5)) {
  stop("a 2010 provincial figure's five percentages do not sum to about 100", call. = FALSE)
}
fig_2010[["religious_affiliation_percent"]] <- round(
  fig_2010[["protestant"]] + fig_2010[["catholic"]] + fig_2010[["muslim"]] + fig_2010[["other"]], 1
)
fig_2010[["no_religion_percent"]] <- fig_2010[["none"]]

# ---- populations and boundary ----
population_comparison <- read_population_comparison(analytical_2022_path)

boundary <- read_boundary(geoboundaries_path)
idx_2022 <- boundary_index_for(province_order_2022, boundary)
idx_2010 <- boundary_index_for(fig_2010[["terr_name"]], boundary)
idx_pop <- boundary_index_for(population_comparison[["terr_name"]], boundary)
pop_2010_by_join <- numeric(nrow(boundary))
pop_2010_by_join[idx_pop] <- population_comparison[["pop_2010"]]

boundary_write <- write_simplified_boundary(
  boundary,
  boundary_out,
  c("area_code", "area_name", "area_unit_id", "boundary_set_id",
    "boundary_level", "shape_id", "land_area_sq_km")
)
if (row_count_file(boundary_out) != nrow(boundary)) {
  stop("province boundary feature count changed during simplification", call. = FALSE)
}

# ---- assemble rows: 2010 then 2022, provinces in area-name order ----
basis_2022 <- paste(
  "table B.1 de facto province total; the religion tables report the de facto",
  "population (18,340,343 national), below the de jure 2022 census population",
  "(19,693,423); every de facto person is allocated to one of ten religion",
  "groups, so no not-stated residual is excluded"
)
basis_2010 <- paste(
  "2010 census population by province (post-2011 ten-province re-tabulation)",
  "from the 2022 National Analytical Report section 2.3 comparison table,",
  "shown for context; figure 4.10 percentages are shares of the province's",
  "population and counts are not published"
)
flag_2022 <- paste(
  "full_response_denominator",
  "no_not_stated_category_in_source",
  "named_religions_in_religious_affiliation",
  "b1_category_labels_reconciled_against_analytical_report_figures",
  sep = ";"
)
flag_2010 <- paste(
  "percent_only_from_printed_figure_labels",
  "one_decimal_source_precision",
  "counts_not_published_at_province_level",
  "named_religions_in_religious_affiliation",
  sep = ";"
)

rows <- list()
order_2010 <- order(boundary[["area_name"]][idx_2010])
for (i in order_2010) {
  b <- idx_2010[i]
  rows[[length(rows) + 1L]] <- build_area_row(
    area_code = boundary[["area_code"]][b],
    area_name = boundary[["area_name"]][b],
    area_unit_id = boundary[["area_unit_id"]][b],
    land_area_sq_km = boundary[["land_area_sq_km"]][b],
    year = 2010L,
    population_total = pop_2010_by_join[b],
    population_total_basis = basis_2010,
    affiliation_count = NA,
    affiliation_percent = fig_2010[["religious_affiliation_percent"]][i],
    no_religion_count = NA,
    no_religion_percent = fig_2010[["no_religion_percent"]][i],
    source_ids = c(census_2010_dataset_id, analytical_2022_dataset_id, boundary_dataset_id),
    quality_flag = flag_2010
  )
}
order_2022 <- order(boundary[["area_name"]][idx_2022])
for (i in order_2022) {
  b <- idx_2022[i]
  rows[[length(rows) + 1L]] <- build_area_row(
    area_code = boundary[["area_code"]][b],
    area_name = boundary[["area_name"]][b],
    area_unit_id = boundary[["area_unit_id"]][b],
    land_area_sq_km = boundary[["land_area_sq_km"]][b],
    year = 2022L,
    population_total = province_2022[i, "total"],
    population_total_basis = basis_2022,
    affiliation_count = affiliation_2022[i],
    affiliation_percent = round(100 * affiliation_2022[i] / province_2022[i, "total"], 2),
    no_religion_count = no_religion_2022[i],
    no_religion_percent = round(100 * no_religion_2022[i] / province_2022[i, "total"], 2),
    source_ids = c(census_2022_dataset_id, boundary_dataset_id),
    quality_flag = flag_2022
  )
}

write_json(area_summary_document(rows), summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

join_coverage <- lapply(years, function(y) {
  list(
    boundary_level = boundary_level,
    year = y,
    matched_area_count = 10L,
    expected_area_count = nrow(boundary),
    missing_area_names = list()
  )
})

# ---- national reconciliation ----
national_reconciliation <- list(
  list(
    year = 2022L,
    metric = "population_total",
    province_sum = sum(province_2022[, "total"]),
    national_total = national_2022[["total"]],
    difference = sum(province_2022[, "total"]) - national_2022[["total"]]
  ),
  list(
    year = 2022L,
    metric = "religious_affiliation_count",
    province_sum = sum(affiliation_2022),
    national_total = national_2022[["total"]] - national_2022[["non_religious"]],
    difference = sum(affiliation_2022) - (national_2022[["total"]] - national_2022[["non_religious"]])
  ),
  list(
    year = 2022L,
    metric = "no_religion_count",
    province_sum = sum(no_religion_2022),
    national_total = national_2022[["non_religious"]],
    difference = sum(no_religion_2022) - national_2022[["non_religious"]]
  ),
  list(
    year = 2010L,
    metric = "population_total",
    province_sum = sum(population_comparison[["pop_2010"]]),
    national_total = 13092666,
    difference = sum(population_comparison[["pop_2010"]]) - 13092666
  )
)
for (check in national_reconciliation) {
  if (check[["difference"]] != 0) {
    stop("national reconciliation failed for ", check[["year"]], "/", check[["metric"]], call. = FALSE)
  }
}

national_affiliation_2022 <- national_2022[["total"]] - national_2022[["non_religious"]]
de_jure_gap_2022 <- 19693423 - national_2022[["total"]]

validation_checks <- c(
  "Table B.1 is the 2022 CPH Series B Religion Descriptive Tables population-by-religion-affiliation-and-province table (de facto); the Zambia row and ten province rows are parsed with pdftotext -layout.",
  "The printed B.1 column header lists the questionnaire code order, which is inconsistent with the census's own analytical figures: under it African Traditional would be 463 persons against figure 3.13's 0.2 percent and Non-Religious 9,238 against figures 3.13-3.15's 1.3 percent national (1.8/0.8 male/female, 1.5/0.9 rural/urban). The adopted assignment (African Traditional 30,502; Judaism 463; Other Religious Groups 9,238; Non-Religious 233,260) is the unique reading that reproduces figures 3.13-3.16 exactly and is asserted in the build.",
  "Every B.1 row's ten religion groups sum exactly to its printed total, and every column's ten province values sum exactly to its national value.",
  "The parsed counts reproduce figure 3.16's per-province Christianity percentages (all ten provinces) and figure 3.13's national percentages (Christianity 98.0, Islam 0.5, African Traditional 0.2, Other 0.1, None 1.3) at one-decimal rounding.",
  "The ten 2022 province rows sum exactly to the national row for the denominator, religious affiliation, and no religion.",
  "The 2010 wave is percent-only: each provincial analytical report's figure 4.10 prints five percentage data labels (Protestant, Catholic, Muslim, Other, None); the transcribed values sum to 99.7-100.0 per province and counts are not published at province level.",
  "The 2010 census population by province (post-2011 ten-province re-tabulation, total 13,092,666) is parsed from the 2022 National Analytical Report section 2.3 comparison table and sums exactly to the printed totals for 2010 and 2022.",
  "All ten census province rows join to the ten geoBoundaries ZMB ADM1 features by normalised name for both waves (NorthWestern / North Western / North-Western normalise equal).",
  sprintf("The simplified province boundary GeoJSON writes to %d bytes after %d m simplification.", boundary_write[["bytes"]], boundary_write[["tolerance_m"]]),
  sprintf("The B.1 de facto total (%d) is %d below the de jure 2022 census population (19,693,423); the religion tables are a de facto tabulation and the gap sits outside them.", as.integer(national_2022[["total"]]), as.integer(de_jure_gap_2022)),
  "District religion for 2022 is deferred: tables B.4/B.5 publish only Christianity against a bundled Other Religious Groups remainder (which includes the non-religious), so neither headline metric can be computed for the 116 districts."
)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:zm-census-religion:zm:2010-2022:zamstats-series-b-and-provincial-reports",
  dataset_id = "zm-census-religion:zm:2010-2022:zamstats-series-b-and-provincial-reports",
  dataset_version_id = paste0("zm-census-religion:zm:2010-2022:zamstats-series-b-and-provincial-reports:", substr(sha256_file(summary_json_out), 1, 12)),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "zm-census-religion",
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
    git_commit = NULL,
    command = paste("Rscript", script_id),
    parameters = list(
      waves = c("2010", "2022"),
      province_boundary_set = boundary_set_id,
      province_boundary_simplification_tolerance_m = boundary_write[["tolerance_m"]],
      pdf_extraction = "poppler pdftotext -layout for table B.1 and the population comparison table; 2010 figure 4.10 percentages transcribed from the printed chart data labels on the rendered figure pages",
      denominator = "2022: table B.1 de facto province total (no not-stated category); 2010: percent of province population as printed",
      category_reconciliation = "B.1 column labels reconciled against 2022 National Analytical Report figures 3.13-3.16; Non-Religious is the 233,260-national column",
      omitted_metrics = c("religious_change", "places_per_10000_residents", "place_density_per_sq_km")
    ),
    software_versions = list(
      r = paste(R.version[["major"]], R.version[["minor"]], sep = "."),
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")),
      pdftotext = "poppler pdftotext (system)"
    )
  ),
  source = list(
    provider = "Zambia Statistics Agency (ZamStats); geoBoundaries (William & Mary geoLab)",
    source_dataset_ids = c(census_2022_dataset_id, census_2010_dataset_id, analytical_2022_dataset_id, boundary_dataset_id),
    source_urls = c(religion_tables_url, analytical_2022_url, census_landing_url, geoboundaries_meta_url, geoboundaries_gj_url),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = licence_text,
    citation = "ZamStats, 2022 CPH Series B Religion Descriptive Tables, Table B.1; CSO/ZamStats, 2010 Census Provincial Analytical Reports, Figure 4.10; geoBoundaries ZMB ADM1 (gbOpen).",
    raw_redistribution = "The census PDFs and the geoBoundaries source GeoJSON are not committed. They remain in data/raw/zm_census/ and await any project-controlled raw archive upload."
  ),
  input_manifests = list(),
  raw_sources = c(
    list(
      raw_source_record(
        religion_tables_path, religion_tables_url, "pdf", 11L, census_2022_dataset_id, TRUE, "2022",
        "2022 CPH Series B Religion Descriptive Tables PDF (ZamStats); table B.1 yields the ten religion groups for the ten provinces plus the Zambia row. Printed column labels reconciled against the analytical-report figures (see validation)."
      ),
      raw_source_record(
        analytical_2022_path, analytical_2022_url, "pdf", 10L, analytical_2022_dataset_id, TRUE, "2010, 2022",
        "2022 CPH National Analytical Report PDF (ZamStats); figures 3.13-3.16 are the category reconciliation authority and section 2.3 supplies the 2010 province populations on the ten-province structure."
      ),
      raw_source_record(
        geoboundaries_path, geoboundaries_gj_url, "geojson", 10L, boundary_dataset_id, TRUE, "2011",
        "geoBoundaries ZMB ADM1 GeoJSON; 10 province features with ISO 3166-2 ZM-NN shapeISO codes, matching the post-2011 provincial structure. CC BY 4.0, boundary source Zambia Data Hub."
      ),
      raw_source_record(
        geoboundaries_meta_path, geoboundaries_meta_url, "json", NA_integer_, boundary_dataset_id, FALSE, "2011",
        "geoBoundaries ZMB ADM1 metadata; records the CC BY 4.0 licence and the Zambia Data Hub boundary source."
      ),
      raw_source_record(
        questionnaire_path, questionnaire_url, "pdf", NA_integer_, census_2022_dataset_id, FALSE, "2022",
        "2022 CPH institutional questionnaire; documents the religion question's code order (1 Christianity ... 9 Non-Religious, 10 Other Religious Groups), which table B.1's printed header follows while its value columns do not."
      ),
      raw_source_record(
        national_2010_path, national_2010_url, "pdf", NA_integer_, census_2010_dataset_id, FALSE, "2010",
        "2010 Census National Analytical Report PDF; religion appears only as national figure 4.10 (Protestant 75.3, Catholic 20.2, Muslim 0.5, Other 2.0, None 1.8), recorded as the national context for the 2010 provincial figures."
      ),
      raw_source_record(
        geoboundaries_adm2_path, geoboundaries_adm2_gj_url, "geojson", 116L, boundary_dataset_id, FALSE, "2022",
        "geoBoundaries ZMB ADM2 GeoJSON; 116 district features (CC BY 4.0, source GRID3/Office of the Surveyor General) matching the census's post-2011 116-district structure. Downloaded for the district probe; unused because tables B.4/B.5 cannot separate no religion."
      ),
      raw_source_record(
        geoboundaries_adm2_meta_path, geoboundaries_adm2_meta_url, "json", NA_integer_, boundary_dataset_id, FALSE, "2022",
        "geoBoundaries ZMB ADM2 metadata; records the CC BY 4.0 licence and the GRID3/Office of the Surveyor General boundary source."
      ),
      raw_source_record(
        lusaka_2000_path, "https://www.zamstats.gov.zm/wp-content/uploads/2023/12/Lusaka-Province-Analytical-Report.pdf", "pdf", NA_integer_, "cso-2000-census-religion", FALSE, "2000",
        "2000 Census Lusaka Province Analytical Report PDF; probed for a 2000 religion wave and found to carry no religion content."
      )
    ),
    lapply(names(provincial_2010_files), function(prov) {
      raw_source_record(
        file.path(raw_dir, provincial_2010_files[[prov]]),
        paste0(provincial_2010_base_url, provincial_2010_urls[[prov]]),
        "pdf", 1L, census_2010_dataset_id, TRUE, "2010",
        sprintf("2010 Census %s Province Analytical Report PDF; figure 4.10 supplies the province's five religion percentages.", prov)
      )
    })
  ),
  durable_files = list(
    manifest_file_record(summary_json_out, "Zambia province area summary with census 2010 (percent-only) and 2022 religious-affiliation and no-religion metrics.", licence_status),
    manifest_file_record(summary_csv_out, "Flattened Zambia province area summary with census 2010 (percent-only) and 2022 religious-affiliation and no-religion metrics.", licence_status),
    manifest_file_record(boundary_out, "Simplified Zambia province boundary GeoJSON derived from geoBoundaries ZMB ADM1 (10 post-2011 provinces).", "geoboundaries_cc_by_4_0")
  ),
  derived_outputs = list(
    list(
      uri = paste0("repo:", summary_json_out),
      sha256 = sha256_file(summary_json_out),
      built_by = script_id,
      notes = "10 province reporting units x 2 census years; 2022 denominator is the table B.1 de facto total, 2010 rows are percent-only."
    ),
    list(
      uri = paste0("repo:", boundary_out),
      sha256 = sha256_file(boundary_out),
      built_by = script_id,
      notes = sprintf("10 geoBoundaries ZMB ADM1 province features simplified at %d m tolerance.", boundary_write[["tolerance_m"]])
    )
  ),
  validation = list(
    checks = validation_checks,
    join_coverage = list(province = join_coverage),
    national_reconciliation = national_reconciliation,
    national_excluded_share_percent = 0,
    boundary_validation = list(
      source_zm_feature_count = nrow(boundary),
      output_feature_count = row_count_file(boundary_out),
      expected_feature_count = nrow(boundary),
      output_bytes = boundary_write[["bytes"]],
      simplification_tolerance_m = boundary_write[["tolerance_m"]],
      unmatched_boundary_features = list(),
      unmatched_census_areas = list()
    )
  ),
  construct_notes = list(
    "The public map displays two headline metrics for 2010 and 2022: religious affiliation percent and no religion percent.",
    "2022: the denominator is the table B.1 de facto province total; the census allocates every de facto person to one of ten religion groups, so there is no not-stated category to exclude. Religious affiliation combines the nine named-religion groups (Christianity, Islam, African Traditional Religion, Hinduism, Buddhism, Bahai Faith, Sikhism, Judaism, Other Religious Groups); no religion is the Non-Religious group.",
    "Table B.1's printed column header lists the questionnaire code order, but its value columns cannot carry those labels: the unique assignment consistent with the 2022 National Analytical Report figures 3.13-3.16 and with tables B.2/B.3 puts African Traditional at 30,502, Judaism at 463, Other Religious Groups at 9,238, and Non-Religious at 233,260 nationally. The build asserts this reconciliation; the split among the small named-religion columns does not affect either headline metric.",
    "The B.1 de facto total (18,340,343) sits 1,353,080 below the de jure 2022 census population (19,693,423); the religion tables are a de facto tabulation and the gap sits outside them.",
    "2010: the provincial analytical reports print religion as figure 4.10 percentages only (Protestant, Catholic, Muslim, Other, None; one decimal); counts are not published at province level, so the 2010 rows carry percentages without counts. Religious affiliation is Protestant + Catholic + Muslim + Other; no religion is None. The reports re-tabulate the 2010 census on the current ten provinces, including Muchinga (created 2011).",
    "District religion for 2022 is deferred: tables B.4 and B.5 publish only Christianity against a bundled Other Religious Groups remainder that includes the non-religious, so neither headline metric can be computed for the 116 districts."
  ),
  deferred_sources = list(
    list(
      source_dataset_id = "zamstats-2022-cph-series-b-tables-b4-b5-religion-by-district",
      url = religion_tables_url,
      local_path = religion_tables_path,
      notes = "Tables B.4/B.5 publish 2022 religion by province, district (116), and constituency, but only as Christianity against a bundled Other Religious Groups remainder that includes the non-religious. Neither religious affiliation (named religions) nor no religion can be separated at district level, so the district product is deferred until ZamStats publishes the full category breakdown below province level (the ADM2 boundary route is geoBoundaries ZMB ADM2, 116 districts, CC BY 4.0, source GRID3/Office of the Surveyor General, matching the census's 116-district structure)."
    ),
    list(
      source_dataset_id = "cso-2010-census-volume-11-national-descriptive-tables",
      url = "https://catalog.hathitrust.org/Record/102488827",
      local_path = NULL,
      notes = "The 2010 Census Volume 11 (National Descriptive Tables) may tabulate religion with counts below the national level, but it is catalogued as a print volume (HathiTrust) and is not on the current ZamStats site. The 2010 wave therefore ships from the provincial analytical report figures (percent-only); a count-based 2010 product is deferred until a digital copy of Volume 11 or an equivalent tabulation is located."
    ),
    list(
      source_dataset_id = "cso-2000-census-religion",
      url = "https://www.zamstats.gov.zm/census-and-statistics/",
      local_path = lusaka_2000_path,
      notes = "The 2000 census provincial analytical reports on the ZamStats site carry no religion content (probed: Lusaka Province Analytical Report, zero matches for 'religio'). Zambia 2000 religion microdata exists in IPUMS International (registration required, no redistribution), so a 2000 wave is deferred."
    ),
    list(
      source_dataset_id = "zambia-data-portal-census-religion",
      url = "https://zambia.opendataforafrica.org/",
      local_path = NULL,
      notes = "The Zambia Data Portal (opendataforafrica.org) returned HTTP 403 to automated retrieval during this build; its census gallery could not be probed for machine-readable religion tables. Recorded as an open probe."
    )
  ),
  privacy = "public",
  licence_status = licence_status,
  downstream_status = "public",
  source_datasets = source_datasets(),
  notes = "The committed products contain the derived province area summary and simplified boundary only. On-page attribution cites ZamStats and geoBoundaries (CC BY 4.0, Zambia Data Hub)."
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
manifest_text <- paste(readLines(manifest_out, warn = FALSE), collapse = "\n")
if (!jsonlite::validate(manifest_text)) stop("manifest JSON failed jsonlite validation", call. = FALSE)

cat(sprintf("wrote %s: %d rows\n", summary_json_out, length(rows)))
cat(sprintf("wrote %s: %d rows\n", summary_csv_out, row_count_file(summary_csv_out)))
cat(sprintf("wrote %s: %d features, %d bytes at %d m\n", boundary_out, row_count_file(boundary_out), as.integer(file_bytes(boundary_out)), boundary_write[["tolerance_m"]]))
cat(sprintf("wrote %s\n", manifest_out))
cat(sprintf("join coverage: 10/10 for 2010 and 2022\n"))
cat(sprintf("2022 national denominator (de facto): %d; religious affiliation: %d (%.2f%%); no religion: %d (%.2f%%)\n",
            as.integer(national_2022[["total"]]),
            as.integer(national_affiliation_2022),
            100 * national_affiliation_2022 / national_2022[["total"]],
            as.integer(national_2022[["non_religious"]]),
            100 * national_2022[["non_religious"]] / national_2022[["total"]]))
cat(sprintf("2022 de facto vs de jure population gap: %d\n", as.integer(de_jure_gap_2022)))
cat(sprintf("2010 national figure: None %.1f%% (percent-only wave; province sums 99.7-100.0)\n", national_2010_none_percent))
cat("national reconciliation: exact for the 2022 denominator, religious affiliation, and no religion, and for the 2010 province populations\n")
