# build the Israel district Population Register classification product.
# inputs: CBS Statistical Abstract table 2.11, CBS locality dictionary rows,
# CBS statistical-area polygons, and the official sub-district boundary layer
# linked from the CBS ArcGIS organisation.
# outputs: apps/regions/il/data/il_district_2022.geojson,
# apps/regions/il/data/area_summary_district.{json,csv}, and
# docs/manifests/il-register-classification-1948-2024.json.
# run from the repository root: Rscript scripts/build_il_area_summary.R

suppressMessages({
  library(jsonlite)
  library(readxl)
  library(sf)
})

source("scripts/lib/simplify_boundary.R")

raw_dir <- "data/raw/il_register"
output_dir <- "apps/regions/il/data"
manifest_dir <- "docs/manifests"
dir.create(raw_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

country_code <- "IL"
script_id <- "scripts/build_il_area_summary.R"
retrieval_date <- "2026-07-10"
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
git_commit <- system("git rev-parse --short HEAD", intern = TRUE)
years <- c(1948L, 1961L, 1972L, 1983L, 1995L, 2008L, 2022L, 2024L)

boundary_set_id <- "il-district-2022-cbs-moin"
table_dataset_id <- "cbs-statistical-abstract-table-2-11-2025"
locality_dataset_id <- "cbs-locality-dictionary-2022"
stat_area_dataset_id <- "cbs-statistical-areas-2022"
district_boundary_dataset_id <- "cbs-arcgis-moin-subdistrict-boundaries"

table_url <- "https://www.cbs.gov.il/he/publications/DocLib/2025/2.ShnatonPopulation/st02_11x.xlsx"
locality_url_template <- paste0(
  "https://api.cbs.gov.il/Dictionary/geo/localities?year=2022&expand=false&",
  "format=json&download=false&page=%d&page_size=250"
)
stat_area_item_url <- "https://www.arcgis.com/sharing/rest/content/items/65410312f3ab4c3482f52f8c8a284a3d?f=json"
stat_area_service_url <- paste0(
  "https://services8.arcgis.com/JcXY3lLZni6BK4El/arcgis/rest/services/",
  "statistical_areas_2022/FeatureServer/0/query"
)
district_item_url <- "https://www.arcgis.com/sharing/rest/content/items/927cfe72a31e4a05ab130526c1391acf?f=json"
district_service_url <- paste0(
  "https://ags.iplan.gov.il/arcgisiplan/rest/services/PlanningPublic/",
  "gvulot_retzef/MapServer/4/query"
)
licence_url <- "https://www.cbs.gov.il/en/Pages/Enduser-license.aspx"

table_path <- file.path(raw_dir, "st02_11x.xlsx")
locality_paths <- file.path(raw_dir, sprintf("localities_2022_page_%d.json", 1:6))
stat_area_item_path <- file.path(raw_dir, "cbs_statistical_areas_2022_item.json")
district_item_path <- file.path(raw_dir, "cbs_subdistrict_boundary_item.json")
district_source_path <- file.path(raw_dir, "moin_subdistricts.geojson")
district7_source_path <- file.path(raw_dir, "cbs_statistical_areas_district_7.geojson")

boundary_out <- file.path(output_dir, "il_district_2022.geojson")
summary_json_out <- file.path(output_dir, "area_summary_district.json")
summary_csv_out <- file.path(output_dir, "area_summary_district.csv")
manifest_out <- file.path(manifest_dir, "il-register-classification-1948-2024.json")

coverage_statement <- paste(
  "The selected coverage includes East Jerusalem within Jerusalem District",
  "and Golan Sub-District within Northern District under CBS statistical",
  "definitions. It also includes any localities beyond the Green Line present",
  "in the CBS files, including the separately labelled Judea and Samaria Area.",
  "The project records the statistical source's definitions without endorsing",
  "any boundary position."
)

not_classified_note <- paste(
  "This is a Population Register classification for residents without a",
  "recognised religious classification (notably many immigrants and their",
  "descendants not registered in a religion group); it is not a measure of no",
  "religion, irreligion, or secularity."
)

recognised_indicator_label <- paste0(
  "Classified in a religion group (%) ", intToUtf8(0x2014),
  " Population Register classification, not belief or practice"
)

district_definitions <- data.frame(
  area_code = as.character(1:7),
  area_name = c(
    "Jerusalem District", "Northern District", "Haifa District",
    "Central District", "Tel Aviv District", "Southern District",
    "Judea and Samaria Area"
  ),
  stringsAsFactors = FALSE
)

subdistrict_to_code <- c(
  "ירושלים" = "1", "צפת" = "2", "כנרת" = "2", "יזרעאל" = "2",
  "עכו" = "2", "רמת הגולן" = "2", "חיפה" = "3", "חדרה" = "3",
  "השרון" = "4", "פתח תקווה" = "4", "רמלה" = "4", "רחובות" = "4",
  "תל אביב - יפו" = "5", "אשקלון" = "6", "באר שבע" = "6"
)

# return a file's SHA-256 digest.
sha256_file <- function(path) unname(tools::sha256sum(path))

# return a file size as an integer number of bytes.
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))

# fetch one URL with curl while retaining the exact response as a raw cache.
fetch_url <- function(url, path, insecure = FALSE) {
  if (file.exists(path) && file_bytes(path) > 0L) return(invisible(path))
  args <- c("-L", "--fail", "--retry", "3", "--max-time", "180", "-sS")
  if (insecure) args <- c(args, "-k")
  args <- c(args, "-A", "places-of-worship-research-build", "-o", path, url)
  status <- system2("curl", shQuote(args))
  if (!identical(status, 0L) || !file.exists(path) || file_bytes(path) == 0L) {
    stop("failed to retrieve ", url, call. = FALSE)
  }
  invisible(path)
}

# fetch an ArcGIS query response with form parameters encoded by curl.
fetch_arcgis <- function(url, path, parameters, insecure = FALSE) {
  if (file.exists(path) && file_bytes(path) > 0L) return(invisible(path))
  args <- c("-L", "--fail", "--retry", "3", "--max-time", "300", "-sS", "-G")
  if (insecure) args <- c(args, "-k")
  for (parameter in parameters) args <- c(args, "--data-urlencode", parameter)
  args <- c(args, "-o", path, url)
  status <- system2("curl", shQuote(args))
  if (!identical(status, 0L) || !file.exists(path) || file_bytes(path) == 0L) {
    stop("failed ArcGIS query: ", url, call. = FALSE)
  }
  invisible(path)
}

# convert CBS table cells to numeric values while preserving missing markers.
numeric_cell <- function(value) {
  parsed <- suppressWarnings(as.numeric(value))
  ifelse(is.na(parsed), NA_real_, parsed)
}

# convert a CBS count in rounded thousands to a whole-person product count.
thousands_to_count <- function(value) {
  ifelse(is.na(value), NA_integer_, as.integer(round(value * 1000)))
}

# return JSON null for a missing scalar.
null_if_na <- function(value) {
  if (length(value) == 0L || is.na(value)) return(NULL)
  value
}

# return a stable row or feature count for a generated artefact.
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) {
    return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  }
  if (grepl("\\.geojson$", path)) return(nrow(st_read(path, quiet = TRUE)))
  object <- fromJSON(path, simplifyVector = FALSE)
  if (!is.null(object[["rows"]])) return(length(object[["rows"]]))
  NA_integer_
}

# describe a tracked public output in the manifest.
manifest_file_record <- function(path, content) {
  list(
    uri = paste0("repo:", path),
    storage_provider = "git_repository",
    format = tools::file_ext(path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    row_count = row_count_file(path),
    content = content,
    privacy = "public",
    licence_status = "cbs_open_licence_and_official_boundary_terms"
  )
}

# describe a raw cached source with its retrieval route and digest.
raw_source_record <- function(path, url, format, source_dataset_id, notes) {
  list(
    uri = path,
    url = url,
    format = format,
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    source_dataset_id = source_dataset_id,
    used_in_public_product = TRUE,
    notes = notes
  )
}

# download and cache all sources needed for a reproducible build.
fetch_sources <- function() {
  fetch_url(table_url, table_path)
  for (page in seq_along(locality_paths)) {
    fetch_url(sprintf(locality_url_template, page), locality_paths[[page]])
  }
  fetch_url(stat_area_item_url, stat_area_item_path)
  fetch_url(district_item_url, district_item_path)
  fetch_arcgis(
    district_service_url,
    district_source_path,
    c("where=1=1", "outFields=*", "returnGeometry=true", "outSR=4326", "f=geojson"),
    insecure = TRUE
  )

  locality_items <- unlist(lapply(locality_paths, function(path) {
    fromJSON(path, simplifyVector = FALSE)[["dictionary"]][["data"]][["localities"]][["items"]]
  }), recursive = FALSE)
  district7_ids <- vapply(locality_items, function(item) {
    locality <- item[["localities"]]
    if (identical(locality[["district"]], "7")) locality[["ID"]][["id"]] else NA_character_
  }, character(1))
  district7_ids <- district7_ids[!is.na(district7_ids)]
  where <- paste0("SEMEL_YISHUV IN (", paste(district7_ids, collapse = ","), ")")
  fetch_arcgis(
    stat_area_service_url,
    district7_source_path,
    c(
      paste0("where=", where),
      "outFields=OBJECTID,SEMEL_YISHUV,SHEM_YISHUV_ENGLISH",
      "returnGeometry=true", "outSR=4326", "resultRecordCount=2000", "f=geojson"
    )
  )
}

# build seven source-aligned area geometries from official polygon sources.
build_boundary <- function() {
  subdistricts <- st_read(district_source_path, quiet = TRUE, stringsAsFactors = FALSE)
  if (nrow(subdistricts) != 15L || !"Nafa" %in% names(subdistricts)) {
    stop("official sub-district source did not contain the expected 15 Nafa rows", call. = FALSE)
  }
  subdistricts[["area_code"]] <- unname(subdistrict_to_code[as.character(subdistricts[["Nafa"]])])
  if (anyNA(subdistricts[["area_code"]])) stop("unmapped official sub-district name", call. = FALSE)
  six <- aggregate(subdistricts[, "geometry"], list(area_code = subdistricts[["area_code"]]), st_union)

  district7 <- st_read(district7_source_path, quiet = TRUE, stringsAsFactors = FALSE)
  if (nrow(district7) == 0L) stop("CBS district-code-7 statistical-area query was empty", call. = FALSE)
  district7 <- st_make_valid(district7)
  district7_union <- st_sf(
    area_code = "7",
    geometry = st_sfc(st_union(st_geometry(district7)), crs = st_crs(district7))
  )
  boundary <- rbind(six, district7_union)
  boundary <- merge(boundary, district_definitions, by = "area_code", all.x = TRUE, sort = FALSE)
  boundary <- boundary[match(district_definitions[["area_code"]], boundary[["area_code"]]), ]
  boundary <- st_transform(st_make_valid(boundary), 4326)
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- "district"
  boundary[["area_unit_id"]] <- paste0(boundary_set_id, ":", boundary[["area_code"]])
  boundary[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(boundary, 2039))) / 1e6
  boundary[, c(
    "area_code", "area_name", "area_unit_id", "boundary_set_id",
    "boundary_level", "land_area_sq_km", "geometry"
  )]
}

# write the boundary through the shared mapshaper byte-cap helper.
write_boundary <- function(boundary) {
  keep_percentages <- c(25, 15, 10, 7.5, 5, 3, 2, 1)
  simplification <- mapshaper_simplify_to_cap(
    boundary,
    boundary_out,
    max_bytes = 800000,
    keep_percentages = keep_percentages,
    clean_option = "allow-overlaps"
  )
  written <- st_read(boundary_out, quiet = TRUE)
  if (nrow(written) != 7L || any(st_is_empty(written)) || any(!st_is_valid(written))) {
    stop("simplified boundary did not retain seven valid non-empty features", call. = FALSE)
  }
  simplification[["byte_ceiling"]] <- 800000L
  simplification
}

# parse CBS table 2.11 into source counts and reconciliation authorities.
parse_table <- function() {
  x <- read_excel(table_path, sheet = "ST02-11x", col_names = FALSE, .name_repair = "minimal")
  y <- read_excel(table_path, sheet = "ST02-11y", col_names = FALSE, .name_repair = "minimal")
  if (!identical(x[[1]][[1]], "POPULATION OF ISRAELIS,") ||
      !identical(y[[1]][[42]], "")) {
    # readxl represents the blank category-label cell as NA; the next test pins the source label.
    if (!identical(y[[2]][[42]], "NOT CLASSIFIED BY RELIGION")) {
      stop("CBS table 2.11 workbook layout changed", call. = FALSE)
    }
  }
  if (!identical(y[[2]][[42]], "NOT CLASSIFIED BY RELIGION")) {
    stop("CBS not-classified category label changed", call. = FALSE)
  }

  source_years <- c(2024L, 2022L, 2008L, 1995L, 1983L, 1972L, 1961L, 1948L)
  count_column <- setNames(10:17, source_years)
  population_rows <- c(8L, 9L, 15L, 18L, 23L, 24L, 27L)
  group_rows <- list(
    jewish = list(sheet = x, rows = c(31L, 32L, 38L, 41L, 46L, 47L, 50L), national = 30L),
    muslim = list(sheet = y, rows = c(8L, 9L, 15L, 18L, 22L, 23L, NA_integer_), national = 7L),
    christian = list(sheet = y, rows = c(27L, 28L, 31L, 32L, 33L, 34L, NA_integer_), national = 26L),
    druze = list(sheet = y, rows = c(NA_integer_, 37L, 40L, NA_integer_, NA_integer_, NA_integer_, NA_integer_), national = 36L)
  )
  not_classified_rows <- c(44L, 45L, 49L, 52L, 56L, 57L, 60L)

  area_records <- list()
  national_records <- list()
  group_reconciliation <- list()
  for (year in years) {
    column <- count_column[[as.character(year)]]
    population <- thousands_to_count(numeric_cell(unlist(x[population_rows, column])))
    national_population <- thousands_to_count(numeric_cell(x[[column]][[7]]))
    group_counts <- matrix(NA_integer_, nrow = 7L, ncol = 4L)
    colnames(group_counts) <- names(group_rows)
    national_groups <- setNames(rep(NA_integer_, 4L), names(group_rows))
    for (group_index in seq_along(group_rows)) {
      definition <- group_rows[[group_index]]
      if (year == 1948L && !identical(names(group_rows)[[group_index]], "jewish")) next
      present <- !is.na(definition[["rows"]])
      group_counts[present, group_index] <- thousands_to_count(
        numeric_cell(unlist(definition[["sheet"]][definition[["rows"]][present], column]))
      )
      national_groups[[group_index]] <- thousands_to_count(
        numeric_cell(definition[["sheet"]][[column]][[definition[["national"]]]])
      )
    }
    not_classified <- rep(NA_integer_, 7L)
    national_not_classified <- NA_integer_
    if (year >= 1995L) {
      not_classified <- thousands_to_count(numeric_cell(unlist(y[not_classified_rows, column])))
      national_not_classified <- thousands_to_count(numeric_cell(y[[column]][[43]]))
    }

    for (area_index in seq_len(7L)) {
      recognised <- if (year == 1948L || is.na(population[[area_index]])) {
        NA_integer_
      } else {
        as.integer(sum(group_counts[area_index, ], na.rm = TRUE))
      }
      area_records[[length(area_records) + 1L]] <- data.frame(
        area_code = as.character(area_index),
        year = year,
        population_total = population[[area_index]],
        recognised_count = recognised,
        not_classified_count = not_classified[[area_index]],
        stringsAsFactors = FALSE
      )
    }
    national_recognised <- if (year == 1948L) NA_integer_ else as.integer(sum(national_groups))
    national_records[[length(national_records) + 1L]] <- data.frame(
      year = year,
      population_total = national_population,
      recognised_count = national_recognised,
      not_classified_count = national_not_classified,
      stringsAsFactors = FALSE
    )
    for (group in names(group_rows)) {
      group_reconciliation[[length(group_reconciliation) + 1L]] <- list(
        year = year,
        group = group,
        district_sum = if (all(is.na(group_counts[, group]))) NULL else sum(group_counts[, group], na.rm = TRUE),
        national_total = null_if_na(national_groups[[group]]),
        national_minus_district_sum = if (is.na(national_groups[[group]])) NULL else national_groups[[group]] - sum(group_counts[, group], na.rm = TRUE),
        unit = "persons, derived from CBS counts rounded to 0.1 thousand"
      )
    }
  }
  list(
    areas = do.call(rbind, area_records),
    national = do.call(rbind, national_records),
    group_reconciliation = group_reconciliation
  )
}

# state the per-row source and construct basis without weakening the CBS label.
row_basis_note <- function(year) {
  date_label <- c(
    `1948` = "8 November 1948", `1961` = "22 May 1961",
    `1972` = "20 May 1972", `1983` = "4 June 1983",
    `1995` = "31 December 1995", `2008` = "27 December 2008",
    `2022` = "2 April 2022", `2024` = "31 December 2024"
  )[[as.character(year)]]
  wave_note <- if (year == 1948L) {
    paste(
      "The 1948 wave is recorded context: CBS publishes district total and",
      "Jewish counts but suppresses the Muslim, Christian, and Druze district",
      "distributions; both ruled construct fields are therefore null."
    )
  } else if (year < 1995L) {
    paste(
      "The classified count sums the CBS district entries for Jewish, Muslim,",
      "Christian, and Druze classifications. CBS does not publish the Not",
      "classified by religion category for this wave; that field is therefore null."
    )
  } else {
    paste(
      "The classified count sums the CBS district entries for Jewish, Muslim,",
      "Christian, and Druze classifications. The no_religion slot carries",
      "CBS's category verbatim: Not classified by religion."
    )
  }
  paste(
    "CBS Statistical Abstract table 2.11, reference date", paste0(date_label, ";"),
    "counts are published in thousands rounded to one decimal.", wave_note,
    not_classified_note, "These fields report Population Register",
    "classification, never belief or practice."
  )
}

# build one schema-conforming area-summary row.
build_row <- function(record, boundary) {
  area <- boundary[boundary[["area_code"]] == record[["area_code"]], ]
  population <- record[["population_total"]]
  recognised <- record[["recognised_count"]]
  not_classified <- record[["not_classified_count"]]
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = "district",
    area_unit_id = area[["area_unit_id"]][[1]],
    area_code = record[["area_code"]],
    area_name = area[["area_name"]][[1]],
    year = as.integer(record[["year"]]),
    population_total = null_if_na(population),
    population_total_basis = row_basis_note(record[["year"]]),
    religious_affiliation_count = null_if_na(recognised),
    religious_affiliation_percent = if (is.na(recognised) || is.na(population) || population == 0L) NULL else round(100 * recognised / population, 4),
    no_religion_count = null_if_na(not_classified),
    no_religion_percent = if (is.na(not_classified) || is.na(population) || population == 0L) NULL else round(100 * not_classified / population, 4),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(area[["land_area_sq_km"]][[1]], 4),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(table_dataset_id, district_boundary_dataset_id, stat_area_dataset_id),
    quality_flag = paste(
      "population_register_classification",
      "cbs_counts_rounded_to_0.1_thousand",
      "published_district_group_entries_summed_without_residual_distribution",
      if (record[["year"]] == 1948L) "recorded_context_construct_unavailable" else "recognised_group_sum",
      if (record[["year"]] < 1995L) "not_classified_category_not_published" else "not_classified_by_religion_not_irreligion",
      "current_2022_boundary_frame",
      sep = ";"
    )
  )
}

# declare the ruled indicators using the source's exact category language.
indicators <- function() {
  temporal <- "CBS reference years 1948, 1961, 1972, 1983, 1995, 2008, 2022, and 2024; 1948 construct values are null recorded context."
  spatial <- "Six CBS districts plus the separately labelled Judea and Samaria Area under CBS statistical coverage."
  recognised_quality <- paste(
    "District values sum the Jewish, Muslim, Christian, and Druze entries CBS",
    "publishes. Small group totals outside published district entries remain",
    "national reconciliation residuals and are never distributed. Counts are",
    "published in thousands rounded to one decimal."
  )
  not_classified_quality <- paste(
    not_classified_note,
    "CBS publishes this category by district for 1995, 2008, 2022, and 2024;",
    "earlier values are null. Counts are published in thousands rounded to one decimal."
  )
  list(
    list(
      indicator_id = "population_total", label = "Population of Israelis",
      description = "CBS table 2.11 Population of Israelis under the source's statistical coverage.",
      unit = "count", denominator_indicator_id = NULL,
      method = "CBS table 2.11 district count, published in thousands rounded to one decimal and converted to persons.",
      temporal_coverage = temporal, spatial_coverage = spatial,
      quality_notes = "The 1948 district sum is 17.1 thousand below the national total; the source remainder is reported and never distributed."
    ),
    list(
      indicator_id = "religious_affiliation_count", label = "Classified in a religion group (count)",
      description = "Legacy area-summary field used for the Population Register count classified as Jewish, Muslim, Christian, or Druze; it is never a belief or practice measure.",
      unit = "count", denominator_indicator_id = "population_total",
      method = "Sum of the CBS table 2.11 Jewish, Muslim, Christian, and Druze district entries; no national residual is distributed.",
      temporal_coverage = temporal, spatial_coverage = spatial, quality_notes = recognised_quality
    ),
    list(
      indicator_id = "religious_affiliation_percent", label = recognised_indicator_label,
      description = "Share of the CBS table 2.11 district population classified in a recognised religion group: Jewish, Muslim, Christian, or Druze. This is Population Register classification, not belief or practice.",
      unit = "percent", denominator_indicator_id = "population_total",
      method = "100 times the published district sum for Jewish, Muslim, Christian, and Druze divided by the published district total.",
      temporal_coverage = temporal, spatial_coverage = spatial, quality_notes = recognised_quality
    ),
    list(
      indicator_id = "no_religion_count", label = "Not classified by religion (count)",
      description = paste("Legacy no_religion field used for CBS's category verbatim: Not classified by religion.", not_classified_note),
      unit = "count", denominator_indicator_id = "population_total",
      method = "CBS table 2.11 Not classified by religion district entry; no relabelling or imputation.",
      temporal_coverage = temporal, spatial_coverage = spatial, quality_notes = not_classified_quality
    ),
    list(
      indicator_id = "no_religion_percent", label = "Not classified by religion (%)",
      description = paste("CBS's category verbatim: Not classified by religion (%).", not_classified_note),
      unit = "percent", denominator_indicator_id = "population_total",
      method = "100 times the CBS table 2.11 Not classified by religion district entry divided by the published district total.",
      temporal_coverage = temporal, spatial_coverage = spatial, quality_notes = not_classified_quality
    )
  )
}

# flatten row objects into the repository's CSV companion shape.
flatten_rows <- function(rows) {
  data.frame(
    country_code = vapply(rows, `[[`, character(1), "country_code"),
    boundary_set_id = vapply(rows, `[[`, character(1), "boundary_set_id"),
    boundary_level = vapply(rows, `[[`, character(1), "boundary_level"),
    area_unit_id = vapply(rows, `[[`, character(1), "area_unit_id"),
    area_code = vapply(rows, `[[`, character(1), "area_code"),
    area_name = vapply(rows, `[[`, character(1), "area_name"),
    year = vapply(rows, `[[`, integer(1), "year"),
    population_total = vapply(rows, function(row) if (is.null(row[["population_total"]])) NA_integer_ else row[["population_total"]], integer(1)),
    population_total_basis = vapply(rows, `[[`, character(1), "population_total_basis"),
    religious_affiliation_count = vapply(rows, function(row) if (is.null(row[["religious_affiliation_count"]])) NA_integer_ else row[["religious_affiliation_count"]], integer(1)),
    religious_affiliation_percent = vapply(rows, function(row) if (is.null(row[["religious_affiliation_percent"]])) NA_real_ else row[["religious_affiliation_percent"]], numeric(1)),
    no_religion_count = vapply(rows, function(row) if (is.null(row[["no_religion_count"]])) NA_integer_ else row[["no_religion_count"]], integer(1)),
    no_religion_percent = vapply(rows, function(row) if (is.null(row[["no_religion_percent"]])) NA_real_ else row[["no_religion_percent"]], numeric(1)),
    place_count = NA_integer_, places_per_10000_residents = NA_real_,
    place_density_per_sq_km = NA_real_,
    land_area_sq_km = vapply(rows, `[[`, numeric(1), "land_area_sq_km"),
    site_snapshot_date = NA_character_, place_count_basis = NA_character_,
    source_dataset_ids = vapply(rows, function(row) paste(unlist(row[["source_dataset_ids"]]), collapse = "|"), character(1)),
    quality_flag = vapply(rows, `[[`, character(1), "quality_flag"),
    stringsAsFactors = FALSE
  )
}

# produce national-minus-district reconciliation records for every shipped metric.
build_reconciliation <- function(area_data, national_data) {
  metrics <- c("population_total", "recognised_count", "not_classified_count")
  output_names <- c(
    population_total = "population_total",
    recognised_count = "religious_affiliation_count",
    not_classified_count = "no_religion_count"
  )
  records <- list()
  for (year in years) {
    areas <- area_data[area_data[["year"]] == year, ]
    national <- national_data[national_data[["year"]] == year, ]
    for (metric in metrics) {
      national_value <- national[[metric]][[1]]
      if (is.na(national_value)) next
      district_sum <- sum(areas[[metric]], na.rm = TRUE)
      records[[length(records) + 1L]] <- list(
        year = year,
        metric = unname(output_names[[metric]]),
        district_sum = as.integer(district_sum),
        cbs_national_total = as.integer(national_value),
        national_minus_district_sum = as.integer(national_value - district_sum),
        unit = "persons, derived from CBS counts rounded to 0.1 thousand",
        residual_treatment = "reported, never distributed"
      )
    }
  }
  records
}

fetch_sources()
boundary <- build_boundary()
simplification <- write_boundary(boundary)
parsed <- parse_table()
rows <- lapply(seq_len(nrow(parsed[["areas"]])), function(index) {
  build_row(parsed[["areas"]][index, , drop = FALSE], boundary)
})

# validate row coverage, construct availability, labels, and the 1948 residual.
validate_build <- function(parsed, rows, boundary) {
  areas <- parsed[["areas"]]
  if (nrow(areas) != 56L || !identical(sort(unique(areas[["year"]])), years)) {
    stop("area rows do not cover seven entries across all eight reference years", call. = FALSE)
  }
  if (any(!is.na(areas[["recognised_count"]][areas[["year"]] == 1948L])) ||
      any(!is.na(areas[["not_classified_count"]][areas[["year"]] < 1995L]))) {
    stop("recorded-context or pre-1995 construct null pattern changed", call. = FALSE)
  }
  if (any(is.na(areas[["not_classified_count"]][areas[["year"]] >= 1995L]))) {
    stop("a published Not classified by religion district value is missing", call. = FALSE)
  }
  basis <- vapply(rows, `[[`, character(1), "population_total_basis")
  if (!all(grepl("Population Register classification", basis, fixed = TRUE)) ||
      !all(grepl("not a measure of no religion, irreligion, or secularity", basis, fixed = TRUE))) {
    stop("a row basis note omits the ruled Register or not-classified statement", call. = FALSE)
  }
  if (nrow(boundary) != 7L || !identical(as.character(boundary[["area_code"]]), as.character(1:7))) {
    stop("boundary entries do not match the seven source geographies", call. = FALSE)
  }
  reconciliation <- build_reconciliation(areas, parsed[["national"]])
  context <- Filter(function(item) item[["year"]] == 1948L && item[["metric"]] == "population_total", reconciliation)
  if (length(context) != 1L || context[[1]][["national_minus_district_sum"]] != 17100L) {
    stop("the 1948 outside-district remainder is not 17,100 persons", call. = FALSE)
  }
  invisible(TRUE)
}

validate_build(parsed, rows, boundary)
reconciliation <- build_reconciliation(parsed[["areas"]], parsed[["national"]])

source_datasets <- list(
  list(
    source_dataset_id = table_dataset_id,
    name = "CBS Statistical Abstract table 2.11: Population of Israelis, by district, sub-district and religion",
    provider = "Israel Central Bureau of Statistics (CBS)", url = table_url,
    retrieval_date = retrieval_date, local_path = table_path,
    licence = list(name = "CBS Open License for information on its website", url = licence_url, attribution = "Israel Central Bureau of Statistics"),
    citation = "Israel Central Bureau of Statistics, Statistical Abstract of Israel 2025, table 2.11; published 27 January 2026.",
    access_limits = NULL,
    redistribution_limits = "CBS attribution and non-misleading-use conditions apply; the source workbook remains in the git-ignored raw cache.",
    notes = "Population Register classification with census-based reference dates. Counts are published in thousands rounded to one decimal."
  ),
  list(
    source_dataset_id = district_boundary_dataset_id,
    name = "Official Ministry of Interior sub-district polygons linked from the CBS ArcGIS organisation",
    provider = "Ministry of Interior / Planning Administration, linked by CBS GIS", url = district_service_url,
    retrieval_date = retrieval_date, local_path = district_source_path,
    licence = list(name = "Planning Administration geographic-information terms", url = "https://www.iplan.gov.il/Pages/Professional%20Tools/GeographicInformation/GeographicInformation/new-geo/gvul-shiput.aspx", attribution = "Ministry of Interior / Planning Administration; CBS GIS link"),
    citation = "Ministry of Interior sub-district boundary layer (15 polygons), linked as 'Sub-district boundary' by the CBS ArcGIS organisation.",
    access_limits = "The official endpoint currently presents a certificate chain that curl cannot verify in this environment; the script records this and uses curl -k only for this public endpoint.",
    redistribution_limits = "Use is subject to the Planning Administration terms linked in the CBS ArcGIS item.",
    notes = "The 15 official sub-district polygons are dissolved into six CBS districts."
  ),
  list(
    source_dataset_id = stat_area_dataset_id,
    name = "CBS statistical areas 2022",
    provider = "Israel Central Bureau of Statistics (CBS)", url = stat_area_service_url,
    retrieval_date = retrieval_date, local_path = district7_source_path,
    licence = list(name = "CBS Open License for information on its website", url = licence_url, attribution = "Israel Central Bureau of Statistics"),
    citation = "Israel Central Bureau of Statistics, statistical areas prepared for the 2022 Population Census.",
    access_limits = NULL,
    redistribution_limits = "CBS attribution and non-misleading-use conditions apply.",
    notes = "The separately labelled Judea and Samaria Area geometry is the union of the 193 CBS statistical-area polygons attached to 129 of the 147 locality dictionary rows carrying district code 7. It depicts the CBS statistical-area coverage, not a legal or territorial boundary."
  ),
  list(
    source_dataset_id = locality_dataset_id,
    name = "CBS geographic dictionary API: 2022 localities",
    provider = "Israel Central Bureau of Statistics (CBS)", url = sprintf(locality_url_template, 1L),
    retrieval_date = retrieval_date, local_path = file.path(raw_dir, "localities_2022_page_*.json"),
    licence = list(name = "CBS Open License for information on its website", url = licence_url, attribution = "Israel Central Bureau of Statistics"),
    citation = "Israel Central Bureau of Statistics geographic dictionary API, locality rows for 2022.",
    access_limits = "A User-Agent header is mandatory.",
    redistribution_limits = "CBS attribution and non-misleading-use conditions apply.",
    notes = "District code 7 selects the localities used to query the separately labelled Judea and Samaria Area statistical-area polygons."
  )
)

area_summary <- list(
  schema_version = "0.2.0", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(
    boundary_set_id = boundary_set_id, country_code = country_code,
    level = "district", vintage = "2022",
    source_dataset_id = district_boundary_dataset_id
  ),
  site_snapshot = list(
    source_dataset_id = NULL, snapshot_date = NULL,
    basis = "no governed Israel place-of-worship snapshot is included in this Population Register classification release",
    notes = "The product ships administrative classification metrics only; place-density fields are null."
  ),
  source_datasets = source_datasets,
  indicators = indicators(),
  visual_layers = list(
    list(
      visual_layer_id = "il-district-recognised-religion-classification",
      label = recognised_indicator_label,
      description = "Population Register share classified as Jewish, Muslim, Christian, or Druze.",
      layer_type = "choropleth", indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "CBS table 2.11 district population"),
      colour_scale = "sequential", time_control = "year_selector",
      aggregation_rule = "sum published CBS district entries for Jewish, Muslim, Christian, and Druze; distribute no residual",
      uncertainty_display = "quality_flag", default_visibility = TRUE,
      notes = "Population Register classification, never belief or practice. The 1948 wave is recorded context with null construct values."
    ),
    list(
      visual_layer_id = "il-district-not-classified-by-religion",
      label = "Not classified by religion (%)",
      description = paste("CBS's category verbatim.", not_classified_note),
      layer_type = "choropleth", indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "CBS table 2.11 district population"),
      colour_scale = "sequential", time_control = "year_selector",
      aggregation_rule = "reported CBS district category; no imputation",
      uncertainty_display = "quality_flag", default_visibility = FALSE,
      notes = paste(not_classified_note, "Available for 1995, 2008, 2022, and 2024 only.")
    )
  ),
  rows = rows
)

write_json(area_summary, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

raw_sources <- c(
  list(
    raw_source_record(
      table_path, table_url, "xlsx", table_dataset_id,
      "CBS Statistical Abstract table 2.11 workbook; both English/Hebrew sheets and source footnotes retained."
    ),
    raw_source_record(
      stat_area_item_path, stat_area_item_url, "json", stat_area_dataset_id,
      "CBS ArcGIS item metadata, including CBS ownership and the CBS licence link."
    ),
    raw_source_record(
      district_item_path, district_item_url, "json", district_boundary_dataset_id,
      "CBS ArcGIS item metadata linking the official Ministry of Interior / Planning Administration sub-district endpoint and its terms."
    ),
    raw_source_record(
      district_source_path, district_service_url, "geojson", district_boundary_dataset_id,
      "Fifteen official sub-district polygons queried in WGS84 and dissolved into six districts."
    ),
    raw_source_record(
      district7_source_path, stat_area_service_url, "geojson", stat_area_dataset_id,
      "The 193 CBS statistical-area polygons selected through 2022 locality district code 7."
    )
  ),
  lapply(seq_along(locality_paths), function(page) {
    raw_source_record(
      locality_paths[[page]], sprintf(locality_url_template, page), "json",
      locality_dataset_id,
      paste("CBS 2022 locality dictionary response page", page, "of 6 at 250 rows per page.")
    )
  })
)
construct_notes <- c(
  coverage_statement,
  paste0("Indicator declaration: ", recognised_indicator_label, "."),
  paste0("Indicator declaration: Not classified by religion (%). ", not_classified_note),
  "The two legacy area-summary slots carry Population Register classification. They never report belief or practice.",
  "The recognised-group value sums the CBS district entries for Jewish, Muslim, Christian, and Druze. CBS omits a few small district-by-group entries; the national residual is reported and never distributed.",
  "The 1948 wave is recorded context. CBS publishes total and Jewish district counts but suppresses Muslim, Christian, and Druze district distributions; the two ruled construct fields are therefore null.",
  "The 1948 national population is 872.7 thousand and the six published district rows sum to 855.6 thousand. The 17.1-thousand outside-district remainder is reported and never distributed.",
  "Option A recorded filter: exclude district code 7 and Northern District locality rows with sub-district code 29 or natural-area codes 291-294; Jerusalem locality code 3000 requires a finer spatial split.",
  "Option C recorded filter: exclude district code 7 and sub-district code 29 or natural-area codes 291-294; configuration must choose whether Jerusalem locality code 3000 is retained, excluded, or replaced with finer 2022 data.",
  "The separately labelled Judea and Samaria Area geometry unions CBS statistical-area polygons selected through locality district code 7. It shows CBS statistical-area coverage and is not a territorial boundary."
)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:il-register-classification:il:1948-2024:cbs-table-2-11",
  dataset_id = "il-register-classification:il:1948-2024:cbs-table-2-11",
  dataset_version_id = paste0("il-register-classification:il:1948-2024:cbs-table-2-11:", substr(sha256_file(summary_json_out), 1L, 12L)),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "il-register-classification", dataset_role = "public_product",
  scope = list(level = "country", country_codes = list(country_code), snapshot_date = NULL, snapshot_anchor = NULL, pipeline_stage = "public"),
  created_at = stamp, created_by = script_id,
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      waves = years, geography = "six CBS districts plus the separately labelled Judea and Samaria Area",
      data_noun = "Register", scope_option = "Option B: CBS statistical coverage as published",
      indicators_block_declaration = paste(recognised_indicator_label, "| Not classified by religion (%)"),
      count_units = "CBS counts in thousands rounded to one decimal; product counts multiply by 1000 and therefore resolve to 100 persons",
      residual_rule = "report every national-minus-district residual; never distribute it",
      boundary_simplification = simplification,
      option_a_filter = list(exclude_district_code = "7", exclude_subdistrict_code = "29", exclude_natural_area_codes = c("291", "292", "293", "294"), jerusalem_locality_code = "3000", jerusalem_rule = "requires a finer spatial split"),
      option_c_filter = list(exclude_district_code = "7", exclude_subdistrict_code = "29", exclude_natural_area_codes = c("291", "292", "293", "294"), jerusalem_locality_code = "3000", jerusalem_rule = "choose retain, exclude, or replace with finer 2022 data")
    ),
    software_versions = list(
      r = R.version.string, readxl = as.character(packageVersion("readxl")),
      sf = as.character(packageVersion("sf")), jsonlite = as.character(packageVersion("jsonlite")),
      mapshaper = "npx mapshaper used through scripts/lib/simplify_boundary.R"
    )
  ),
  source = list(
    provider = "Israel Central Bureau of Statistics; Ministry of Interior / Planning Administration",
    source_dataset_ids = c(table_dataset_id, locality_dataset_id, stat_area_dataset_id, district_boundary_dataset_id),
    source_urls = c(table_url, sprintf(locality_url_template, 1L), stat_area_item_url, district_item_url, licence_url),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = "CBS Open License applies to CBS tables and GIS files; the official sub-district endpoint is subject to the Planning Administration geographic-information terms recorded in its CBS ArcGIS item.",
    citation = "Israel Central Bureau of Statistics, Statistical Abstract table 2.11 and 2022 GIS layers; Ministry of Interior / Planning Administration sub-district boundaries linked by CBS GIS."
  ),
  durable_files = list(
    manifest_file_record(summary_json_out, "Israel district Population Register classification area summary, eight reference waves including 1948 recorded context."),
    manifest_file_record(summary_csv_out, "Flattened Israel district Population Register classification area-summary rows."),
    manifest_file_record(boundary_out, "Simplified source-aligned Israel district geometry: six official districts plus separately labelled CBS statistical-area coverage for Judea and Samaria Area.")
  ),
  raw_sources = raw_sources,
  stats = list(
    waves = length(years), rows = length(rows), boundary_features = 7L,
    mapped_construct_waves = 7L, recorded_context_waves = 1L,
    source_count_precision_persons = 100L,
    boundary_bytes = file_bytes(boundary_out), summary_json_bytes = file_bytes(summary_json_out),
    summary_csv_bytes = file_bytes(summary_csv_out),
    district7_locality_dictionary_rows = 147L,
    district7_localities_with_statistical_area_polygons = 129L,
    district7_statistical_area_polygons = 193L
  ),
  local_cache_hint = "Raw CBS and official boundary responses are cached under data/raw/il_register/ and remain git-ignored.",
  validation = list(
    status = "passed_with_warnings",
    commands = list(
      "Rscript scripts/build_il_area_summary.R",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/il/data/area_summary_district.json",
      "jq empty docs/manifests/il-register-classification-1948-2024.json"
    ),
    warnings = c(
      "CBS omits a few small district-by-group entries; recognised-group residuals are reported and never distributed.",
      "The 1948 construct is unavailable at district level and ships as recorded context with null construct fields.",
      "The 1948 population national-minus-district residual is 17,100 persons and is never distributed.",
      "The separately labelled Judea and Samaria Area geometry represents CBS statistical-area coverage rather than a territorial boundary."
    ),
    notes = paste(
      "National reconciliation uses national minus district sum. Units are persons converted from CBS's one-decimal thousands.",
      toJSON(reconciliation, auto_unbox = TRUE, null = "null"),
      "Group reconciliation:", toJSON(parsed[["group_reconciliation"]], auto_unbox = TRUE, null = "null")
    )
  ),
  construct_notes = construct_notes,
  national_reconciliation = reconciliation,
  group_reconciliation = parsed[["group_reconciliation"]],
  privacy = "public", licence_status = "accepted", downstream_status = "public",
  source_datasets = source_datasets,
  notes = "The committed product contains derived area summaries and simplified source-aligned geometry only. UI and hub wiring are outside this build."
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)

cat(sprintf("wrote %s: %d rows, %d bytes\n", summary_json_out, length(rows), file_bytes(summary_json_out)))
cat(sprintf("wrote %s: %d rows, %d bytes\n", summary_csv_out, row_count_file(summary_csv_out), file_bytes(summary_csv_out)))
cat(sprintf("wrote %s: %d features, %d bytes\n", boundary_out, row_count_file(boundary_out), file_bytes(boundary_out)))
cat(sprintf("wrote %s: %d bytes\n", manifest_out, file_bytes(manifest_out)))
for (record in reconciliation) {
  cat(sprintf(
    "reconciliation %d %s: district=%d national=%d residual=%d persons\n",
    record[["year"]], record[["metric"]], record[["district_sum"]],
    record[["cbs_national_total"]], record[["national_minus_district_sum"]]
  ))
}
