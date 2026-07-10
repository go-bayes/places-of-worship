# build the Liechtenstein municipality census-affiliation product.
# inputs: Statistics Liechtenstein population-structure workbooks for the
# 2010, 2015, and 2020 censuses plus the official Hoheitsgrenzen archive.
# outputs: apps/regions/li/data/area_summary_municipality.{json,csv},
# apps/regions/li/data/li_municipality_2021.geojson, and
# docs/manifests/li-census-religion-2010-2020.json.
# run from the repository root: Rscript scripts/build_li_area_summary.R

suppressMessages({
  library(digest)
  library(jsonlite)
  library(readxl)
  library(sf)
})

source("scripts/lib/simplify_boundary.R")

raw_dir <- "data/raw/li_census"
output_dir <- "apps/regions/li/data"
manifest_dir <- "docs/manifests"
dir.create(raw_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

country_code <- "LI"
years <- c(2010L, 2015L, 2020L)
script_id <- "scripts/build_li_area_summary.R"
retrieval_date <- format(Sys.Date(), "%Y-%m-%d")
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
git_commit <- system("git rev-parse --short HEAD", intern = TRUE)

boundary_vintage <- "2021"
boundary_set_id <- "li-municipality-2021-llv-hoheitsgrenzen"
boundary_level <- "municipality"
table_dataset_ids <- c(
  `2010` = "statistik-li-census-2010-population-structure",
  `2015` = "statistik-li-census-2015-population-structure",
  `2020` = "statistik-li-census-2020-population-structure"
)
boundary_dataset_id <- "llv-hoheitsgrenzen-municipality-2021"
boundary_terms_dataset_id <- "llv-hoheitsgrenzen-open-data-terms"
boundary_metadata_dataset_id <- "geocat-li-hoheitsgrenzen-metadata"

etab_url <- "https://www.statistikportal.li/etab/213.001d"
source_page_url <- "https://www.statistikportal.li/de/themen/bevoelkerung/bevoelkerungsstruktur"
table_urls <- c(
  `2010` = paste0(
    "https://www.statistikportal.li/statistikportal/publications/",
    "151-amt-fuer-statistik/111-volkszaehlung/2010/01/1/",
    "111.2010.01_02_vz-2010-bd1-tabellen.xls"
  ),
  `2015` = paste0(
    "https://www.statistikportal.li/statistikportal/publications/",
    "213-bevoelkerungsstruktur/2015/01/1/",
    "213.2015.01_02_bevoelkerungsstruktur-2015-tabellen.xlsx"
  ),
  `2020` = paste0(
    "https://www.statistikportal.li/statistikportal/publications/",
    "213-bevoelkerungsstruktur/2020/01/1/",
    "213.2020.01.1_02_bevoelkerungsstruktur-2020-tabellen.xlsx"
  )
)
boundary_download_page_url <- "https://service.geo.llv.li/download/"
boundary_url <- "https://service.geo.llv.li/download/getfile.php?theme=hgredxf"
boundary_terms_url <- "https://service.geo.llv.li/download/hgredxf/licence.txt"
boundary_metadata_url <- paste0(
  "https://www.geocat.ch/geonetwork/srv/ger/csw?service=CSW&version=2.0.2&",
  "request=GetRecordById&id=7dd0cb7f-43f9-4db4-b83f-66b43a47f943&",
  "elementSetName=full&outputSchema=http://www.isotc211.org/2005/gmd"
)

table_paths <- c(
  `2010` = file.path(raw_dir, "li_population_structure_2010.xls"),
  `2015` = file.path(raw_dir, "li_population_structure_2015.xlsx"),
  `2020` = file.path(raw_dir, "li_population_structure_2020.xlsx")
)
boundary_download_page_path <- file.path(raw_dir, "llv_geodata_download.html")
boundary_path <- file.path(raw_dir, "llv_hoheitsgrenzen.zip")
boundary_terms_path <- file.path(raw_dir, "llv_hoheitsgrenzen_licence.txt")
boundary_metadata_path <- file.path(raw_dir, "geocat_hoheitsgrenzen.xml")

summary_json_out <- file.path(output_dir, "area_summary_municipality.json")
summary_csv_out <- file.path(output_dir, "area_summary_municipality.csv")
boundary_out <- file.path(output_dir, paste0("li_municipality_", boundary_vintage, ".geojson"))
manifest_out <- file.path(manifest_dir, "li-census-religion-2010-2020.json")

municipality_codes <- c(
  "Vaduz" = "7001", "Triesen" = "7002", "Balzers" = "7003",
  "Triesenberg" = "7004", "Schaan" = "7005", "Planken" = "7006",
  "Eschen" = "7007", "Mauren" = "7008", "Gamprin" = "7009",
  "Ruggell" = "7010", "Schellenberg" = "7011"
)

categories_2010_2015 <- c(
  "Römisch-katholisch", "Evangelisch-reformiert",
  "Evangelisch-lutherisch", "Andere protestantische Kirchen",
  "Christlich-orthodox", "Andere christliche Kirchen", "Islamisch",
  "Buddhistisch", "Andere Religionen", "Keine Zugehörigkeit", "Ohne Angabe"
)
categories_2020 <- c(
  "Römisch-katholisch", "Evangelisch (reformiert, protestantisch)",
  "Evangelisch-lutherisch", "Andere protestantische Kirchen",
  "Christlich-orthodox", "Andere christliche Kirchen", "Islamisch",
  "Buddhistisch", "Andere Religionen", "Keine Zugehörigkeit", "Ohne Angabe"
)
expected_categories <- list(
  `2010` = categories_2010_2015,
  `2015` = categories_2010_2015,
  `2020` = categories_2020
)

english_display_labels <- c(
  "Römisch-katholisch" = "Roman Catholic",
  "Evangelisch-reformiert" = "Evangelical Reformed",
  "Evangelisch (reformiert, protestantisch)" = "Evangelical (Reformed, Protestant)",
  "Evangelisch-lutherisch" = "Evangelical Lutheran",
  "Andere protestantische Kirchen" = "Other Protestant churches",
  "Christlich-orthodox" = "Christian Orthodox",
  "Andere christliche Kirchen" = "Other Christian churches",
  "Islamisch" = "Islamic",
  "Buddhistisch" = "Buddhist",
  "Andere Religionen" = "Other religions",
  "Keine Zugehörigkeit" = "No affiliation",
  "Ohne Angabe" = "Not stated"
)

# return a file's SHA-256 digest.
sha256_file <- function(path) unname(tools::sha256sum(path))

# return a file size as an integer number of bytes.
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))

# stop when a required file is absent or empty.
require_file <- function(path) {
  if (!file.exists(path) || file_bytes(path) < 1L) {
    stop("missing required file: ", path, call. = FALSE)
  }
}

# fetch one source and retain its original retrieval timestamp in a sidecar.
fetch_file <- function(url, path) {
  meta_path <- paste0(path, ".meta.json")
  if (!file.exists(path) || file_bytes(path) < 1L) {
    args <- c(
      "-L", "--fail", "--retry", "3", "--max-time", "300", "-sS",
      "-A", "places-of-worship-research-build", "-o", path, url
    )
    status <- system2("curl", shQuote(args))
    if (!identical(status, 0L) || !file.exists(path) || file_bytes(path) < 1L) {
      stop("failed to retrieve ", url, call. = FALSE)
    }
  }
  if (!file.exists(meta_path)) {
    write_json(
      list(url = url, retrieved_at = stamp, http_status = 200L),
      meta_path,
      auto_unbox = TRUE,
      pretty = TRUE
    )
  }
  invisible(path)
}

# read the retrieval sidecar for a cached source.
read_meta <- function(path) {
  meta_path <- paste0(path, ".meta.json")
  if (!file.exists(meta_path)) stop("missing retrieval metadata: ", meta_path, call. = FALSE)
  fromJSON(meta_path, simplifyVector = FALSE)
}

# convert a source table cell to an exact integer count.
source_count <- function(value, context) {
  if (length(value) != 1L || is.na(value)) stop("missing count for ", context, call. = FALSE)
  if (is.character(value) && trimws(value) == "-") return(0L)
  parsed <- suppressWarnings(as.numeric(value))
  if (is.na(parsed) || parsed != round(parsed)) stop("non-integer count for ", context, call. = FALSE)
  as.integer(parsed)
}

# parse one published municipality religion table without harmonising labels.
parse_wave <- function(year, path) {
  spec <- if (year %in% c(2010L, 2015L)) {
    list(sheet = "1.08", area_row = 5L, total_row = 6L, label_col = 1L, national_col = 2L, area_cols = 3:13)
  } else {
    list(sheet = "1.108", area_row = 10L, total_row = 11L, label_col = 3L, national_col = 4L, area_cols = 5:15)
  }
  sheet <- read_excel(path, sheet = spec[["sheet"]], col_names = FALSE, .name_repair = "minimal")
  area_names <- as.character(unlist(sheet[spec[["area_row"]], spec[["area_cols"]]]))
  if (!identical(area_names, names(municipality_codes))) {
    stop("unexpected municipality order in ", year, call. = FALSE)
  }
  category_rows <- seq.int(spec[["total_row"]] + 1L, spec[["total_row"]] + 11L)
  categories <- as.character(unlist(sheet[category_rows, spec[["label_col"]]]))
  if (!identical(categories, expected_categories[[as.character(year)]])) {
    stop("published category list changed in ", year, call. = FALSE)
  }
  values <- matrix(0L, nrow = 12L, ncol = 12L)
  rownames(values) <- c("Bevölkerung", categories)
  colnames(values) <- c("Liechtenstein", area_names)
  source_rows <- c(spec[["total_row"]], category_rows)
  source_cols <- c(spec[["national_col"]], spec[["area_cols"]])
  for (row_index in seq_along(source_rows)) {
    for (column_index in seq_along(source_cols)) {
      values[row_index, column_index] <- source_count(
        sheet[[source_cols[[column_index]]]][[source_rows[[row_index]]]],
        paste(year, rownames(values)[[row_index]], colnames(values)[[column_index]])
      )
    }
  }
  list(
    year = year,
    source_dataset_id = unname(table_dataset_ids[[as.character(year)]]),
    categories = categories,
    values = values
  )
}

# classify a source category for the legacy headline slots.
category_role <- function(category) {
  if (category == "Keine Zugehörigkeit") return("no_affiliation")
  if (category == "Ohne Angabe") return("not_stated")
  "named_religion"
}

# enforce exact within-area and municipality-to-national reconciliation.
validate_wave <- function(parsed) {
  year <- parsed[["year"]]
  values <- parsed[["values"]]
  category_rows <- rownames(values) != "Bevölkerung"
  within_area_differences <- values["Bevölkerung", ] - colSums(values[category_rows, , drop = FALSE])
  if (any(within_area_differences != 0L)) {
    stop("within-area category reconciliation failed for ", year, call. = FALSE)
  }
  municipality_columns <- colnames(values) != "Liechtenstein"
  national_differences <- values[, "Liechtenstein"] - rowSums(values[, municipality_columns, drop = FALSE])
  if (any(national_differences != 0L)) {
    stop("municipality-to-national reconciliation failed for ", year, call. = FALSE)
  }
  list(
    year = year,
    municipality_count = sum(municipality_columns),
    category_count = sum(category_rows),
    within_area_category_sums_exact = TRUE,
    municipality_category_sums_exact = TRUE,
    max_absolute_difference = 0L,
    category_reconciliation = lapply(rownames(values), function(category) {
      list(
        source_category_de = category,
        municipality_sum = unname(sum(values[category, municipality_columns])),
        published_national_total = unname(values[category, "Liechtenstein"]),
        difference = unname(national_differences[[category]]),
        status = "matched"
      )
    })
  )
}

# build the official 11-municipality layer from the 30 archived polygon parts.
build_boundary <- function(path) {
  extracted_dir <- tempfile("li-hoheitsgrenzen-")
  dir.create(extracted_dir, recursive = TRUE)
  on.exit(unlink(extracted_dir, recursive = TRUE), add = TRUE)
  members <- c(
    "Ge_Gemeindegrenze_A.shp", "Ge_Gemeindegrenze_A.shx",
    "Ge_Gemeindegrenze_A.dbf", "Ge_Gemeindegrenze_A.cpg"
  )
  extracted <- unzip(path, files = members, exdir = extracted_dir)
  if (length(extracted) != length(members)) stop("boundary archive members changed", call. = FALSE)
  source <- st_read(file.path(extracted_dir, "Ge_Gemeindegrenze_A.shp"), quiet = TRUE, options = "ENCODING=UTF-8")
  required <- c("R2_NAME", "R2_BFSNR")
  if (nrow(source) != 30L || !all(required %in% names(source))) {
    stop("expected 30 official municipality polygon parts", call. = FALSE)
  }
  source_bbox <- st_bbox(source)
  if (source_bbox[["xmin"]] < 2500000 || source_bbox[["xmax"]] > 3000000 ||
      source_bbox[["ymin"]] < 1000000 || source_bbox[["ymax"]] > 1500000) {
    stop("boundary coordinates do not match the Swiss LV95 range", call. = FALSE)
  }
  source <- st_set_crs(source, 2056)
  if (any(st_is_empty(source)) || any(!st_is_valid(source))) {
    stop("official municipality source has empty or invalid polygons", call. = FALSE)
  }
  source[["area_code"]] <- as.character(source[["R2_BFSNR"]])
  source[["area_name"]] <- as.character(source[["R2_NAME"]])
  if (!setequal(source[["area_code"]], unname(municipality_codes))) {
    stop("official municipality codes do not match the census tables", call. = FALSE)
  }
  area_codes <- unname(municipality_codes)
  geometries <- lapply(area_codes, function(code) {
    st_union(st_geometry(source[source[["area_code"]] == code, ]))
  })
  boundary <- st_sf(
    area_code = area_codes,
    area_name = names(municipality_codes),
    geometry = st_sfc(lapply(geometries, function(geometry) geometry[[1L]]), crs = 2056)
  )
  boundary <- st_make_valid(boundary)
  boundary[["area_unit_id"]] <- paste(boundary_set_id, boundary[["area_code"]], sep = ":")
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- boundary_level
  boundary[["land_area_sq_km"]] <- as.numeric(st_area(boundary)) / 1e6
  boundary <- st_transform(boundary, 4326)
  boundary[, c(
    "area_code", "area_name", "area_unit_id", "boundary_set_id",
    "boundary_level", "land_area_sq_km", "geometry"
  )]
}

# simplify the municipality layer and enforce validity and distinct hashes.
write_boundary <- function(boundary) {
  simplification <- mapshaper_simplify_to_cap(
    boundary,
    boundary_out,
    max_bytes = 800000,
    keep_percentages = c(100, 75, 50, 25, 15, 10, 7.5, 5, 3, 2, 1),
    clean_option = "allow-overlaps"
  )
  written <- st_read(boundary_out, quiet = TRUE)
  validity <- st_is_valid(written)
  if (nrow(written) != 11L || any(st_is_empty(written)) || any(is.na(validity)) || any(!validity)) {
    stop("simplified boundary did not retain 11 valid non-empty features", call. = FALSE)
  }
  if (!setequal(written[["area_code"]], unname(municipality_codes))) {
    stop("simplified boundary municipality codes changed", call. = FALSE)
  }
  hashes <- vapply(st_as_binary(st_geometry(written), EWKB = TRUE), function(wkb) {
    digest(wkb, algo = "sha256", serialize = FALSE)
  }, character(1))
  if (length(unique(hashes)) != 11L) stop("municipality geometry hashes are not distinct", call. = FALSE)
  simplification[["byte_ceiling"]] <- 800000L
  list(
    layer = written,
    simplification = simplification,
    valid_feature_count = sum(validity),
    geometry_hashes = setNames(as.list(hashes), written[["area_code"]])
  )
}

# build one schema-conforming municipality-year row.
build_row <- function(parsed, area_name, boundary) {
  values <- parsed[["values"]]
  categories <- parsed[["categories"]]
  roles <- vapply(categories, category_role, character(1))
  population_total <- unname(values["Bevölkerung", area_name])
  religious_affiliation_count <- unname(sum(values[categories[roles == "named_religion"], area_name]))
  no_religion_count <- unname(values["Keine Zugehörigkeit", area_name])
  area_code <- unname(municipality_codes[[area_name]])
  area <- boundary[boundary[["area_code"]] == area_code, ]
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = area[["area_unit_id"]][[1]],
    area_code = area_code,
    area_name = area_name,
    year = parsed[["year"]],
    population_total = population_total,
    population_total_basis = paste(
      "Full-enumeration census affiliation table total for the permanent population;",
      "Ohne Angabe remains in the denominator."
    ),
    religious_affiliation_count = religious_affiliation_count,
    religious_affiliation_percent = round(100 * religious_affiliation_count / population_total, 4),
    no_religion_count = no_religion_count,
    no_religion_percent = round(100 * no_religion_count / population_total, 4),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(area[["land_area_sq_km"]][[1]], 4),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(parsed[["source_dataset_id"]], boundary_dataset_id),
    quality_flag = paste(
      "full_enumeration_census_affiliation",
      "source_categories_as_published",
      "not_stated_in_denominator",
      "exact_municipality_national_reconciliation",
      "current_2021_boundary_frame",
      sep = ";"
    )
  )
}

# declare the standard census-affiliation headline indicators.
indicators <- function() {
  temporal <- "2010, 2015, and 2020 full-enumeration censuses."
  spatial <- "Eleven Liechtenstein municipalities."
  category_note <- paste(
    "Every wave retains its published categories. The 2020 label Evangelisch",
    "(reformiert, protestantisch) replaces the 2010/2015 label",
    "Evangelisch-reformiert and is not harmonised into a denomination trend."
  )
  list(
    list(
      indicator_id = "population_total",
      label = "Permanent population",
      description = "Permanent population in the source census municipality table.",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "Published municipality population total in Statistics Liechtenstein table 213.001d and its source workbooks.",
      temporal_coverage = temporal,
      spatial_coverage = spatial,
      quality_notes = "The total includes Ohne Angabe, the source's not-stated religion category."
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious affiliation (%)",
      description = "Share of the permanent population assigned to one of the source's named religion categories.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 times the sum of each wave's published named religion categories divided by the published municipality total.",
      temporal_coverage = temporal,
      spatial_coverage = spatial,
      quality_notes = paste(category_note, "Ohne Angabe remains in the denominator.")
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "Keine Zugehörigkeit (%) — No affiliation",
      description = "Share of the permanent population in the source category Keine Zugehörigkeit (No affiliation).",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 times the published Keine Zugehörigkeit municipality count divided by the published municipality total.",
      temporal_coverage = temporal,
      spatial_coverage = spatial,
      quality_notes = "The source category name and framing are retained; Ohne Angabe remains a separate not-stated category in the denominator."
    )
  )
}

# flatten row objects into the repository's CSV companion shape.
flatten_rows <- function(rows) {
  # return one required character field from a row.
  get_character <- function(row, field) row[[field]]
  # return one required integer field from a row.
  get_integer <- function(row, field) row[[field]]
  # return one required numeric field from a row.
  get_numeric <- function(row, field) row[[field]]
  data.frame(
    country_code = vapply(rows, get_character, character(1), "country_code"),
    boundary_set_id = vapply(rows, get_character, character(1), "boundary_set_id"),
    boundary_level = vapply(rows, get_character, character(1), "boundary_level"),
    area_unit_id = vapply(rows, get_character, character(1), "area_unit_id"),
    area_code = vapply(rows, get_character, character(1), "area_code"),
    area_name = vapply(rows, get_character, character(1), "area_name"),
    year = vapply(rows, get_integer, integer(1), "year"),
    population_total = vapply(rows, get_integer, integer(1), "population_total"),
    population_total_basis = vapply(rows, get_character, character(1), "population_total_basis"),
    religious_affiliation_count = vapply(rows, get_integer, integer(1), "religious_affiliation_count"),
    religious_affiliation_percent = vapply(rows, get_numeric, numeric(1), "religious_affiliation_percent"),
    no_religion_count = vapply(rows, get_integer, integer(1), "no_religion_count"),
    no_religion_percent = vapply(rows, get_numeric, numeric(1), "no_religion_percent"),
    place_count = NA_integer_,
    places_per_10000_residents = NA_real_,
    place_density_per_sq_km = NA_real_,
    land_area_sq_km = vapply(rows, get_numeric, numeric(1), "land_area_sq_km"),
    site_snapshot_date = NA_character_,
    place_count_basis = NA_character_,
    source_dataset_ids = vapply(rows, function(row) paste(unlist(row[["source_dataset_ids"]]), collapse = "|"), character(1)),
    quality_flag = vapply(rows, get_character, character(1), "quality_flag"),
    stringsAsFactors = FALSE
  )
}

# return a stable row or feature count for a generated artefact.
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
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
    licence_status = "statistics_li_cc_by_4_0_and_llv_boundary_terms"
  )
}

# describe one raw cached source with its URL, retrieval time, and digest.
raw_source_record <- function(path, url, format, source_dataset_id, notes) {
  meta <- read_meta(path)
  list(
    uri = path,
    url = url,
    retrieval_date = substr(meta[["retrieved_at"]], 1L, 10L),
    retrieved_at = meta[["retrieved_at"]],
    format = format,
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    source_dataset_id = source_dataset_id,
    used_in_public_product = TRUE,
    notes = notes
  )
}

# record every source label and its faithful English display label by wave as construct-note prose.
category_mapping <- function(parsed_waves) {
  lapply(parsed_waves, function(parsed) {
    entries <- vapply(parsed[["categories"]], function(category) {
      paste0(
        category, " => ", unname(english_display_labels[[category]]),
        " [product role: ", category_role(category), "; harmonisation: as_published]"
      )
    }, character(1))
    paste0("Category mapping for ", parsed[["year"]], ": ", paste(entries, collapse = "; "), ".")
  })
}

# describe the source datasets used by the public product.
source_datasets <- function() {
  table_sources <- lapply(years, function(year) {
    year_text <- as.character(year)
    extension <- tools::file_ext(table_paths[[year_text]])
    list(
      source_dataset_id = unname(table_dataset_ids[[year_text]]),
      name = paste("Statistics Liechtenstein population structure", year, "municipality religion table"),
      provider = "Statistics Liechtenstein, Office of Statistics",
      url = unname(table_urls[[year_text]]),
      retrieval_date = retrieval_date,
      local_path = unname(table_paths[[year_text]]),
      licence = list(
        name = "Creative Commons Attribution 4.0 International (CC BY 4.0)",
        url = "https://creativecommons.org/licenses/by/4.0/",
        attribution = "Statistics Liechtenstein, Office of Statistics; extracted, translated, and adapted"
      ),
      citation = paste0(
        "Statistics Liechtenstein. Population structure ", year,
        ", municipality religion table; table 1.08", if (year == 2020L) " (published as 1.108)" else "", "."
      ),
      access_limits = NULL,
      redistribution_limits = "CC BY 4.0 attribution applies; this product identifies the extraction, English display-label translation, and adaptation.",
      notes = paste(
        "Versioned", toupper(extension), "workbook behind table 213.001d;",
        "full-enumeration census affiliation for the permanent population."
      )
    )
  })
  c(table_sources, list(
    list(
      source_dataset_id = boundary_dataset_id,
      name = "Hoheitsgrenzen Liechtenstein municipality polygons",
      provider = "Liechtenstein National Administration, Office of Civil Engineering and Geoinformation",
      url = boundary_url,
      retrieval_date = retrieval_date,
      local_path = boundary_path,
      licence = list(
        name = "LLV geodata reuse terms, version 1.0 (10 September 2018)",
        url = boundary_terms_url,
        attribution = "Liechtenstein National Administration, Office of Civil Engineering and Geoinformation"
      ),
      citation = "Liechtenstein National Administration. Hoheitsgrenzen municipality boundary archive; polygon members dated 10 September 2021.",
      access_limits = NULL,
      redistribution_limits = "Commercial and non-commercial use, modification, and redistribution are permitted with source attribution; modified data must be passed to third parties under the same conditions.",
      notes = paste(
        "The archive contains 30 Ge_Gemeindegrenze_A polygon parts for 11 municipalities.",
        "It omits a PRJ file; the LV95 coordinate range establishes EPSG:2056 for conversion to WGS84."
      )
    )
  ))
}

for (year in years) fetch_file(table_urls[[as.character(year)]], table_paths[[as.character(year)]])
fetch_file(boundary_download_page_url, boundary_download_page_path)
fetch_file(boundary_url, boundary_path)
fetch_file(boundary_terms_url, boundary_terms_path)
fetch_file(boundary_metadata_url, boundary_metadata_path)

parsed_waves <- lapply(years, function(year) parse_wave(year, table_paths[[as.character(year)]]))
reconciliation <- lapply(parsed_waves, validate_wave)
boundary <- build_boundary(boundary_path)
boundary_result <- write_boundary(boundary)
written_boundary <- boundary_result[["layer"]]

rows <- unlist(lapply(parsed_waves, function(parsed) {
  lapply(names(municipality_codes), function(area_name) build_row(parsed, area_name, written_boundary))
}), recursive = FALSE)
if (length(rows) != 33L) stop("expected 33 municipality-year rows", call. = FALSE)

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
    basis = "no governed Liechtenstein place-of-worship snapshot is included in this census-affiliation release",
    notes = "The product ships census-affiliation metrics and municipal geometry only; place-density fields are null."
  ),
  source_datasets = source_datasets(),
  indicators = indicators(),
  visual_layers = list(
    list(
      visual_layer_id = "li-municipality-religious-affiliation",
      label = "Religious affiliation (%)",
      description = "Census-affiliation share by municipality for 2010, 2015, and 2020.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "permanent population, including Ohne Angabe"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "sum each wave's named religion categories as published; do not harmonise the denomination labels",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = "The 2020 Protestant source-label break remains explicit in the manifest."
    ),
    list(
      visual_layer_id = "li-municipality-no-affiliation",
      label = "Keine Zugehörigkeit (%) — No affiliation",
      description = "Share in the source category Keine Zugehörigkeit (No affiliation).",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "permanent population, including Ohne Angabe"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "published Keine Zugehörigkeit municipality count",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = "The source's no-affiliation framing is retained; Ohne Angabe stays separate."
    )
  ),
  rows = rows
)

write_json(area_summary, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

raw_sources <- list(
  raw_source_record(table_paths[["2010"]], table_urls[["2010"]], "xls", table_dataset_ids[["2010"]], "Versioned 2010 workbook; sheet 1.08 supplies the national and 11 municipality totals for all 11 categories."),
  raw_source_record(table_paths[["2015"]], table_urls[["2015"]], "xlsx", table_dataset_ids[["2015"]], "Versioned 2015 workbook; sheet 1.08 supplies the national and 11 municipality totals for all 11 categories."),
  raw_source_record(table_paths[["2020"]], table_urls[["2020"]], "xlsx", table_dataset_ids[["2020"]], "Versioned 2020 workbook; sheet 1.108 supplies the national and 11 municipality totals for all 11 categories."),
  raw_source_record(boundary_download_page_path, boundary_download_page_url, "html", boundary_dataset_id, "Official geodata download page naming the Hoheitsgrenzen dataset, its format, terms route, metadata record, and download route."),
  raw_source_record(boundary_path, boundary_url, "zip", boundary_dataset_id, "Official Hoheitsgrenzen archive; the 30 Ge_Gemeindegrenze_A polygon parts dated 10 September 2021 dissolve to 11 municipalities."),
  raw_source_record(boundary_terms_path, boundary_terms_url, "txt", boundary_terms_dataset_id, "Official boundary reuse terms, version 1.0 dated 10 September 2018."),
  raw_source_record(boundary_metadata_path, boundary_metadata_url, "xml", boundary_metadata_dataset_id, "Official geocat.ch CSW metadata record 7dd0cb7f-43f9-4db4-b83f-66b43a47f943 for Hoheitsgrenzen Liechtenstein.")
)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:li-census-religion:li:2010-2020:table-213.001d",
  dataset_id = "li-census-religion:li:2010-2020:table-213.001d",
  dataset_version_id = paste0("li-census-religion:li:2010-2020:table-213.001d:", substr(sha256_file(summary_json_out), 1L, 12L)),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "li-census-religion",
  dataset_role = "public_product",
  scope = list(
    level = "country", country_codes = list(country_code), snapshot_date = NULL,
    snapshot_anchor = NULL, pipeline_stage = "public"
  ),
  created_at = stamp,
  created_by = script_id,
  pipeline = list(
    script = script_id,
    git_commit = git_commit,
    command = paste("Rscript", script_id),
    parameters = list(
      table = "213.001d Ständige Bevölkerung nach Religion, Heimat, Geschlecht und Gemeinde",
      waves = years,
      geography = "11 municipalities",
      construct = "full-enumeration census affiliation for the permanent population",
      denominator = "published permanent-population total; Ohne Angabe retained",
      category_rule = "retain every wave's source categories and labels; sum named categories only for the standard affiliation headline",
      historical_scope_rule = "1980, 1990, and 2000 archival Wohnbevölkerung tables are outside table 213.001d and outside this permanent-population series",
      boundary_source_vintage = "2021-09-10 archive member timestamp",
      boundary_simplification = boundary_result[["simplification"]],
      local_cache_hint = "Raw Statistics Liechtenstein workbooks and official boundary inputs are cached under data/raw/li_census/ and remain git-ignored.",
      retrieval_routes = list(
        list(purpose = "interactive table", method = "GET", url = etab_url, notes = "PX-Web selection page; announces 2010, 2015, and 2020 and offers CSV/XLSX output."),
        list(purpose = "2010 versioned workbook", method = "GET", url = table_urls[["2010"]], notes = "Stable XLS export used by the build."),
        list(purpose = "2015 versioned workbook", method = "GET", url = table_urls[["2015"]], notes = "Stable XLSX export used by the build."),
        list(purpose = "2020 versioned workbook", method = "GET", url = table_urls[["2020"]], notes = "Stable XLSX export used by the build."),
        list(purpose = "official municipality boundary", method = "GET", url = boundary_url, notes = "Stable Hoheitsgrenzen ZIP route from the official geodata download page.")
      )
    ),
    software_versions = list(
      r = R.version.string,
      readxl = as.character(packageVersion("readxl")),
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")),
      digest = as.character(packageVersion("digest")),
      mapshaper = "npx mapshaper used through scripts/lib/simplify_boundary.R"
    )
  ),
  source = list(
    provider = "Statistics Liechtenstein; Liechtenstein National Administration",
    source_dataset_ids = c(unname(table_dataset_ids), boundary_dataset_id, boundary_terms_dataset_id, boundary_metadata_dataset_id),
    source_urls = c(unname(table_urls), etab_url, source_page_url, boundary_download_page_url, boundary_url, boundary_terms_url, boundary_metadata_url),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = "Statistics Liechtenstein publication metadata states CC BY 4.0. The official Hoheitsgrenzen archive has separate LLV geodata reuse terms that permit use, modification, and same-conditions redistribution with attribution.",
    citation = "Statistics Liechtenstein table 213.001d and 2010/2015/2020 population-structure workbooks; Liechtenstein National Administration Hoheitsgrenzen municipality polygons."
  ),
  durable_files = list(
    manifest_file_record(summary_json_out, "Liechtenstein municipality census-affiliation area summary for 2010, 2015, and 2020."),
    manifest_file_record(summary_csv_out, "Flattened Liechtenstein municipality census-affiliation area-summary rows."),
    manifest_file_record(boundary_out, "Simplified official 2021 Liechtenstein municipality geometry with 11 features.")
  ),
  raw_sources = raw_sources,
  validation = list(
    status = "passed",
    commands = list(
      "Rscript scripts/build_li_area_summary.R",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/li/data/area_summary_municipality.json",
      "jq empty docs/manifests/li-census-religion-2010-2020.json"
    ),
    warnings = list(
      "Table 213.001d exposes 2010, 2015, and 2020 only; the 1980-2000 archival Wohnbevölkerung tables are outside this product.",
      "The 2020 source replaces Evangelisch-reformiert with Evangelisch (reformiert, protestantisch); the product records the break and does not smooth it.",
      "The official boundary archive lacks a PRJ file; its LV95 coordinate range is interpreted as EPSG:2056 before WGS84 export."
    ),
    notes = paste(
      "All 12 published rows per wave (population plus 11 categories) reconcile exactly from 11 municipalities to the national row.",
      "Every municipality's 11 categories sum exactly to its published population total.",
      "All 11 output geometries are valid, non-empty, and have distinct SHA-256 WKB hashes."
    ),
    stats = list(
      waves = length(years),
      rows = length(rows),
      categories_per_wave = "2010=11;2015=11;2020=11",
      boundary_source_polygon_parts = 30L,
      boundary_features = 11L,
      boundary_valid_features = boundary_result[["valid_feature_count"]],
      distinct_geometry_hashes = length(unique(unlist(boundary_result[["geometry_hashes"]]))),
      boundary_bytes = file_bytes(boundary_out),
      summary_json_bytes = file_bytes(summary_json_out),
      summary_csv_bytes = file_bytes(summary_csv_out)
    ),
    reconciliation = reconciliation,
    boundary_validation = list(
      source_polygon_parts = 30L,
      output_feature_count = 11L,
      valid_feature_count = boundary_result[["valid_feature_count"]],
      distinct_geometry_hash_count = length(unique(unlist(boundary_result[["geometry_hashes"]]))),
      geometry_sha256_by_bfs_code = boundary_result[["geometry_hashes"]],
      source_crs_interpretation = "EPSG:2056 from the archive's LV95 coordinate range; the ZIP omits a PRJ file",
      output_crs = "EPSG:4326"
    )
  ),
  construct_notes = c(list(
    "The construct is census affiliation: Statistics Liechtenstein asks which religious community the respondent belongs to. It does not measure belief or participation in religious practice.",
    "The public headline uses the source population denominator. Ohne Angabe remains in that denominator and outside both the named-religion and Keine Zugehörigkeit counts.",
    "Keine Zugehörigkeit and Ohne Angabe retain the source's German labels and separate framing in every wave.",
    "The named-religion headline sums the categories published in each wave. The manifest retains every source label and a faithful English display label; it does not create a harmonised denomination series.",
    "Table 213.001d and its current workbooks expose municipality religion for 2010, 2015, and 2020. Earlier archival censuses use Wohnbevölkerung rather than the current Ständige Bevölkerung frame and are not appended to this product.",
    paste0(
      "Category break for 2010, 2015: Evangelisch-reformiert => ",
      english_display_labels[["Evangelisch-reformiert"]], "; treatment: as_published."
    ),
    paste0(
      "Category break for 2020: Evangelisch (reformiert, protestantisch) => ",
      english_display_labels[["Evangelisch (reformiert, protestantisch)"]],
      "; treatment: as_published; no continuity merge."
    )
  ), category_mapping(parsed_waves)),
  privacy = "public",
  licence_status = "accepted",
  downstream_status = "public",
  source_datasets = source_datasets(),
  notes = "The committed product contains derived municipality summaries and simplified official geometry only. UI and hub wiring are outside this build."
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)

cat(sprintf("export route: %s\n", etab_url))
cat(sprintf("waves shipped: %s\n", paste(years, collapse = ", ")))
cat(sprintf("category counts: %s\n", paste(vapply(parsed_waves, function(x) paste0(x[["year"]], "=", length(x[["categories"]])), character(1)), collapse = ", ")))
cat("reconciliation gate: passed; every municipality and national category sum matched exactly\n")
cat("geometry gate: passed; 11 valid features with 11 distinct SHA-256 WKB hashes\n")
cat("provenance gate: passed; every raw input has URL, retrieval date, and SHA-256\n")
cat(sprintf("wrote %s: %d rows, %d bytes\n", summary_json_out, length(rows), file_bytes(summary_json_out)))
cat(sprintf("wrote %s: %d rows, %d bytes\n", summary_csv_out, row_count_file(summary_csv_out), file_bytes(summary_csv_out)))
cat(sprintf("wrote %s: %d features, %d bytes\n", boundary_out, row_count_file(boundary_out), file_bytes(boundary_out)))
cat(sprintf("wrote %s: %d bytes\n", manifest_out, file_bytes(manifest_out)))
