# build the switzerland canton religion area-summary products from bfs/fso.
# inputs: bfs stat-tab/px-web census religion cube, bfs structural survey
# religion workbook, swissboundaries3d canton boundaries, and opendata.swiss
# licence metadata.
# outputs: apps/regions/ch/data/ch_canton_2026.geojson,
# apps/regions/ch/data/area_summary_canton_census.{json,csv},
# apps/regions/ch/data/area_summary_canton_survey.{json,csv}, and
# docs/manifests/ch-census-religion-1970-2000.json plus
# docs/manifests/ch-structural-survey-religion-2010-2024.json.
# run from the repo root: Rscript scripts/build_ch_area_summary.R

suppressMessages({
  library(jsonlite)
  library(readxl)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

raw_dir <- "data/raw/ch_religion"
ch_dir <- "apps/regions/ch/data"
manifest_dir <- "docs/manifests"
dir.create(raw_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(ch_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- format(Sys.Date(), "%Y-%m-%d")
script_id <- "scripts/build_ch_area_summary.R"
country_code <- "CH"
boundary_level <- "canton"
boundary_set_id <- "ch-canton-2026-swissboundaries3d"
survey_reconciliation_tolerance <- 5

census_dataset_id <- "bfs-px-x-4001000000-122-census-religion-canton-1970-2000"
survey_dataset_id <- "bfs-je-d-01080202-structural-survey-religion-canton-2010-2024"
boundary_dataset_id <- "swisstopo-swissboundaries3d-cantons-2026-01"

census_api_url <- "https://www.pxweb.bfs.admin.ch/api/v1/de/px-x-4001000000_122/px-x-4001000000_122.px"
census_package_url <- "https://opendata.swiss/api/3/action/package_show?id=wohnbevolkerung-am-wirtschaftlichen-wohnsitz-nach-region-und-religion"
survey_package_url <- "https://opendata.swiss/api/3/action/package_show?id=religionszugehorigkeit-nach-grossregion-und-kanton"
survey_workbook_url <- "https://dam-api.bfs.admin.ch/hub/api/dam/assets/36347568/master"
survey_asset_meta_url <- "https://dam-api.bfs.admin.ch/hub/api/dam/assets/36347568"
boundary_package_url <- "https://opendata.swiss/api/3/action/package_show?id=swissboundaries3d"
boundary_stac_url <- "https://data.geo.admin.ch/api/stac/v0.9/collections/ch.swisstopo.swissboundaries3d/items/swissboundaries3d_2026-01"
boundary_zip_url <- "https://data.geo.admin.ch/ch.swisstopo.swissboundaries3d/swissboundaries3d_2026-01/swissboundaries3d_2026-01_2056_5728.gpkg.zip"
opendata_terms_url <- "https://opendata.swiss/en/terms-of-use/"

census_meta_path <- file.path(raw_dir, "bfs_px_x_4001000000_122_meta_de.json")
census_data_path <- file.path(raw_dir, "bfs_px_x_4001000000_122_canton_religion_1970_2000.json")
census_package_path <- file.path(raw_dir, "opendata_bfs_px_x_4001000000_122_package.json")
survey_package_path <- file.path(raw_dir, "opendata_bfs_je_d_01080202_package.json")
survey_asset_meta_path <- file.path(raw_dir, "bfs_asset_36347568_meta_de.json")
survey_workbook_path <- file.path(raw_dir, "bfs_je-d-01.08.02.02_religion_canton_2010_2024.xlsx")
boundary_package_path <- file.path(raw_dir, "opendata_swissboundaries3d_package.json")
boundary_stac_path <- file.path(raw_dir, "swissboundaries3d_2026-01_stac.json")
boundary_zip_path <- file.path(raw_dir, "swissboundaries3d_2026-01_2056_5728.gpkg.zip")
opendata_terms_path <- file.path(raw_dir, "opendata_swiss_terms_of_use.html")

boundary_out <- file.path(ch_dir, "ch_canton_2026.geojson")
census_summary_json_out <- file.path(ch_dir, "area_summary_canton_census.json")
census_summary_csv_out <- file.path(ch_dir, "area_summary_canton_census.csv")
survey_summary_json_out <- file.path(ch_dir, "area_summary_canton_survey.json")
survey_summary_csv_out <- file.path(ch_dir, "area_summary_canton_survey.csv")
census_manifest_out <- file.path(manifest_dir, "ch-census-religion-1970-2000.json")
survey_manifest_out <- file.path(manifest_dir, "ch-structural-survey-religion-2010-2024.json")

fso_terms_by_ask <- paste(
  "opendata.swiss OPEN-BY-ASK / terms_by_ask: non-commercial reuse is",
  "allowed with source attribution; commercial reuse requires permission from",
  "the data owner."
)
swisstopo_terms_by <- paste(
  "opendata.swiss OPEN-BY / terms_by: free use with source attribution."
)
census_population_basis <- paste(
  "FSO federal population census religion indicator at economic residence;",
  "the denominator is Religion - Total, no-religion is Keine Zugehörigkeit,",
  "and Ohne Angabe remains in the denominator but outside religious_affiliation_count."
)
survey_population_basis <- paste(
  "FSO structural survey religion indicator, permanent resident population",
  "aged 15+; rows are weighted sample estimates with category confidence",
  "intervals in the source workbook."
)
place_snapshot_basis <- paste(
  "no governed Switzerland OpenStreetMap place-of-worship snapshot is",
  "included in this country data-map release"
)

canton_number_to_code <- c(
  "1" = "ZH", "2" = "BE", "3" = "LU", "4" = "UR", "5" = "SZ",
  "6" = "OW", "7" = "NW", "8" = "GL", "9" = "ZG", "10" = "FR",
  "11" = "SO", "12" = "BS", "13" = "BL", "14" = "SH", "15" = "AR",
  "16" = "AI", "17" = "SG", "18" = "GR", "19" = "AG", "20" = "TG",
  "21" = "TI", "22" = "VD", "23" = "VS", "24" = "NE", "25" = "GE",
  "26" = "JU"
)

canton_px_to_code <- c(
  "1" = "ZH", "185" = "BE", "612" = "LU", "725" = "UR",
  "747" = "SZ", "784" = "OW", "793" = "NW", "806" = "GL",
  "837" = "ZG", "850" = "FR", "1100" = "SO", "1237" = "BS",
  "1242" = "BL", "1334" = "SH", "1375" = "AR", "1399" = "AI",
  "1407" = "SG", "1512" = "GR", "1739" = "AG", "1983" = "TG",
  "2072" = "TI", "2326" = "VD", "2730" = "VS", "2904" = "NE",
  "2973" = "GE", "3020" = "JU"
)

survey_area_to_code <- c(
  "Zürich" = "ZH", "Bern / Berne" = "BE", "Luzern" = "LU",
  "Uri" = "UR", "Schwyz" = "SZ", "Obwalden" = "OW",
  "Nidwalden" = "NW", "Glarus" = "GL", "Zug" = "ZG",
  "Fribourg / Freiburg" = "FR", "Solothurn" = "SO",
  "Basel-Stadt" = "BS", "Basel-Landschaft" = "BL",
  "Schaffhausen" = "SH", "Appenzell A. Rh." = "AR",
  "Appenzell I. Rh." = "AI", "St. Gallen" = "SG",
  "Graubünden / Grigioni / Grischun" = "GR", "Aargau" = "AG",
  "Thurgau" = "TG", "Ticino" = "TI", "Vaud" = "VD",
  "Valais / Wallis" = "VS", "Neuchâtel" = "NE", "Genève" = "GE",
  "Jura" = "JU"
)

# compute the sha-256 digest for a local file.
sha256_file <- function(path) {
  unname(tools::sha256sum(path))
}

# hash ordered values into a compact version token.
sha256_values <- function(values) {
  tmp <- tempfile()
  on.exit(unlink(tmp), add = TRUE)
  writeBin(charToRaw(paste(values, collapse = "")), tmp)
  sha256_file(tmp)
}

# return file size in bytes for manifest records.
file_bytes <- function(path) {
  as.integer(unname(file.info(path)[["size"]]))
}

# return NULL where JSON should carry an absent scalar.
null_if_na <- function(value) {
  if (length(value) == 0L || is.null(value) || is.na(value) || !is.finite(value)) return(NULL)
  value
}

# return a scalar suitable for flat CSV output.
csv_scalar <- function(value, missing) {
  if (length(value) == 0L || is.null(value)) return(missing)
  value
}

# write compact retrieval metadata for a cached raw response.
write_meta <- function(path, url, method, request_body = NULL) {
  meta <- list(
    retrieved_at = stamp,
    url = url,
    method = method,
    http_status = 200,
    request_body = request_body
  )
  write_json(meta, paste0(path, ".meta.json"), auto_unbox = TRUE,
             pretty = TRUE, null = "null")
}

# download a GET response into the raw cache if the file is absent.
fetch_get_if_missing <- function(url, path) {
  if (file.exists(path) && file_bytes(path) > 0L) {
    if (!file.exists(paste0(path, ".meta.json"))) write_meta(path, url, "GET")
    return(FALSE)
  }
  tmp <- tempfile(tmpdir = dirname(path))
  on.exit(unlink(tmp), add = TRUE)
  status <- system2(
    "curl",
    c("-fL", "-sS", "-A", "places-of-worship-CH-probe", "-o", tmp, url)
  )
  if (status != 0L || !file.exists(tmp) || file_bytes(tmp) == 0L) {
    stop("GET fetch failed for ", url, call. = FALSE)
  }
  file.rename(tmp, path)
  write_meta(path, url, "GET")
  TRUE
}

# post a JSON request body into the raw cache if the file is absent.
fetch_post_json_if_missing <- function(url, request_body, path) {
  if (file.exists(path) && file_bytes(path) > 0L) {
    if (!file.exists(paste0(path, ".meta.json"))) write_meta(path, url, "POST", request_body)
    return(FALSE)
  }
  body_path <- tempfile(fileext = ".json")
  tmp <- tempfile(tmpdir = dirname(path))
  on.exit(unlink(c(body_path, tmp)), add = TRUE)
  write_json(request_body, body_path, auto_unbox = TRUE, pretty = FALSE)
  status <- system2(
    "curl",
    c(
      "-fL", "-sS", "-A", "places-of-worship-CH-probe",
      "-H", "Content-Type:application/json",
      "-X", "POST", "--data-binary", paste0("@", body_path),
      "-o", tmp, url
    )
  )
  if (status != 0L || !file.exists(tmp) || file_bytes(tmp) == 0L) {
    stop("POST fetch failed for ", url, call. = FALSE)
  }
  file.rename(tmp, path)
  write_meta(path, url, "POST", request_body)
  TRUE
}

# read a sidecar retrieval metadata file.
read_meta <- function(path) {
  meta_path <- paste0(path, ".meta.json")
  if (!file.exists(meta_path)) return(list())
  fromJSON(meta_path, simplifyVector = FALSE)
}

# return a stable current git commit token for manifest provenance.
git_commit_short <- function() {
  commit <- tryCatch(
    system2("git", c("rev-parse", "--short", "HEAD"), stdout = TRUE, stderr = FALSE),
    error = function(e) NA_character_
  )
  if (length(commit) != 1L || is.na(commit) || !nzchar(commit)) return("0000000")
  commit
}

# convert named JSON-stat category index and labels into an ordered table.
jsonstat_categories <- function(dim) {
  index <- unlist(dim[["category"]][["index"]])
  labels <- unlist(dim[["category"]][["label"]])
  values <- names(sort(index))
  data.frame(
    value = values,
    label = unname(labels[values]),
    stringsAsFactors = FALSE
  )
}

# convert one JSON-stat value to a numeric scalar.
jsonstat_value_at <- function(values, index) {
  if (index > length(values) || is.null(values[[index]])) return(NA_real_)
  as.numeric(values[[index]])
}

# read the swissBOUNDARIES3D canton layer and normalise its join fields.
read_boundary <- function(zip_path) {
  tmp_dir <- tempfile("ch-boundary-")
  dir.create(tmp_dir, recursive = TRUE)
  on.exit(unlink(tmp_dir, recursive = TRUE), add = TRUE)
  unzip(zip_path, exdir = tmp_dir)
  gpkg <- list.files(tmp_dir, pattern = "\\.gpkg$", recursive = TRUE, full.names = TRUE)
  if (length(gpkg) != 1L) stop("expected one swissBOUNDARIES3D geopackage", call. = FALSE)

  cantons <- st_read(gpkg, layer = "tlm_kantonsgebiet", quiet = TRUE)
  if (nrow(cantons) != 26L) stop("expected 26 canton boundary features", call. = FALSE)
  cantons <- st_zm(cantons, drop = TRUE, what = "ZM")
  cantons <- st_make_valid(cantons)
  cantons <- st_cast(cantons, "MULTIPOLYGON", warn = FALSE)

  area_codes <- unname(canton_number_to_code[as.character(cantons[["kantonsnummer"]])])
  if (any(is.na(area_codes))) stop("unmapped canton numbers in boundary source", call. = FALSE)
  cantons[["area_code"]] <- area_codes
  cantons[["area_name"]] <- as.character(cantons[["name"]])
  cantons[["area_unit_id"]] <- paste0(boundary_set_id, ":", cantons[["area_code"]])
  cantons[["boundary_set_id"]] <- boundary_set_id
  cantons[["boundary_level"]] <- boundary_level
  cantons[["land_area_sq_km"]] <- round(as.numeric(st_area(st_transform(cantons, 2056))) / 1e6, 4)

  out <- st_transform(
    cantons[, c("area_code", "area_name", "area_unit_id", "boundary_set_id",
                "boundary_level", "land_area_sq_km")],
    4326
  )
  out[order(out[["area_code"]]), ]
}

# return a boundary lookup table without geometry.
boundary_lookup <- function(boundary) {
  data.frame(
    area_code = boundary[["area_code"]],
    area_name = boundary[["area_name"]],
    area_unit_id = boundary[["area_unit_id"]],
    land_area_sq_km = boundary[["land_area_sq_km"]],
    stringsAsFactors = FALSE
  )
}

# read and verify the census JSON-stat response as a long table.
read_census_long <- function(path) {
  px <- fromJSON(path, simplifyVector = FALSE)
  expected_ids <- c("Jahr", "Kanton (-) / Bezirk (>>) / Gemeinde (......)", "Religion")
  if (!identical(unlist(px[["id"]]), expected_ids)) {
    stop("unexpected census JSON-stat dimension order", call. = FALSE)
  }
  years <- jsonstat_categories(px[["dimension"]][["Jahr"]])
  areas <- jsonstat_categories(px[["dimension"]][["Kanton (-) / Bezirk (>>) / Gemeinde (......)"]])
  religions <- jsonstat_categories(px[["dimension"]][["Religion"]])
  values <- px[["value"]]

  rows <- vector("list", length = nrow(years) * nrow(areas) * nrow(religions))
  idx <- 1L
  out_idx <- 1L
  for (year_idx in seq_len(nrow(years))) {
    for (area_idx in seq_len(nrow(areas))) {
      for (religion_idx in seq_len(nrow(religions))) {
        rows[[out_idx]] <- data.frame(
          year = as.integer(years[["label"]][year_idx]),
          source_area_value = areas[["value"]][area_idx],
          source_area_label = areas[["label"]][area_idx],
          religion_value = religions[["value"]][religion_idx],
          religion_label = religions[["label"]][religion_idx],
          count = as.integer(round(jsonstat_value_at(values, idx))),
          stringsAsFactors = FALSE
        )
        idx <- idx + 1L
        out_idx <- out_idx + 1L
      }
    }
  }
  do.call(rbind, rows)
}

# build area-summary rows from the census full-count cube.
build_census_rows <- function(long, boundary_table) {
  rows <- list()
  out_idx <- 1L
  canton_codes <- unname(canton_px_to_code)
  for (year in sort(unique(long[["year"]]))) {
    for (source_value in names(canton_px_to_code)) {
      area_code <- unname(canton_px_to_code[[source_value]])
      slice <- long[long[["year"]] == year & long[["source_area_value"]] == source_value, ]
      if (nrow(slice) == 0L) stop("missing census area-year slice for ", area_code, " ", year, call. = FALSE)
      values <- setNames(slice[["count"]], slice[["religion_label"]])
      pop_total <- values[["Religion - Total"]]
      no_religion <- values[["Keine Zugehörigkeit"]]
      unknown <- values[["Ohne Angabe"]]
      religious <- pop_total - no_religion - unknown
      boundary_row <- boundary_table[boundary_table[["area_code"]] == area_code, ]
      quality <- paste(
        "federal_census_full_count",
        "economic_residence",
        "current_26_canton_source_frame",
        "ohne_angabe_excluded_from_religious_affiliation_numerator",
        sep = ";"
      )
      if (area_code == "JU" && year == 1970L) {
        quality <- paste(quality, "source_reports_jura_on_current_frame_before_1979_canton_creation", sep = ";")
      }
      rows[[out_idx]] <- list(
        country_code = country_code,
        boundary_set_id = boundary_set_id,
        boundary_level = boundary_level,
        area_unit_id = boundary_row[["area_unit_id"]],
        area_code = area_code,
        area_name = boundary_row[["area_name"]],
        year = as.integer(year),
        population_total = as.integer(pop_total),
        population_total_basis = census_population_basis,
        religious_affiliation_count = as.integer(religious),
        religious_affiliation_percent = round(100 * religious / pop_total, 2),
        no_religion_count = as.integer(no_religion),
        no_religion_percent = round(100 * no_religion / pop_total, 2),
        place_count = NULL,
        places_per_10000_residents = NULL,
        place_density_per_sq_km = NULL,
        land_area_sq_km = boundary_row[["land_area_sq_km"]],
        site_snapshot_date = NULL,
        place_count_basis = NULL,
        source_dataset_ids = c(census_dataset_id, boundary_dataset_id),
        quality_flag = quality
      )
      out_idx <- out_idx + 1L
    }
  }
  if (!identical(sort(unique(vapply(rows, `[[`, character(1), "area_code"))), sort(canton_codes))) {
    stop("census rows do not cover the expected 26 canton codes", call. = FALSE)
  }
  rows
}

# reconcile census canton sums against the national row for every category.
reconcile_census <- function(long) {
  years <- sort(unique(long[["year"]]))
  categories <- sort(unique(long[["religion_label"]]))
  records <- list()
  out_idx <- 1L
  for (year in years) {
    for (category in categories) {
      national <- long[long[["year"]] == year & long[["source_area_value"]] == "0" &
                         long[["religion_label"]] == category, "count"]
      canton_sum <- sum(long[long[["year"]] == year &
                               long[["source_area_value"]] %in% names(canton_px_to_code) &
                               long[["religion_label"]] == category, "count"])
      diff <- canton_sum - national
      records[[out_idx]] <- data.frame(
        year = year,
        category = category,
        canton_sum = canton_sum,
        national = national,
        difference = diff,
        stringsAsFactors = FALSE
      )
      out_idx <- out_idx + 1L
    }
  }
  out <- do.call(rbind, records)
  if (any(out[["difference"]] != 0L)) {
    stop("census canton sums do not reconcile exactly to the national row", call. = FALSE)
  }
  out
}

# coerce one worksheet cell to a numeric estimate, preserving suppressed cells as NA.
survey_numeric <- function(value) {
  text <- trimws(as.character(value))
  text[text %in% c("", "NA", "X", "...")] <- NA_character_
  suppressWarnings(as.numeric(gsub("[’']", "", text)))
}

# confirm that the structural survey sheet carries the expected CI columns.
assert_survey_ci_columns <- function(sheet, year) {
  header <- as.character(unlist(sheet[4, c(4, 6, 8, 10, 12, 14, 16, 18)]))
  if (!all(grepl("Vertrauens", header))) {
    stop("structural survey sheet ", year, " lacks the expected canton CI columns", call. = FALSE)
  }
}

# read the structural-survey workbook into canton rows and reconciliation records.
build_survey_rows <- function(workbook_path, boundary_table) {
  sheet_years <- sort(as.integer(grep("^20[0-9]{2}$", excel_sheets(workbook_path), value = TRUE)))
  expected_years <- 2010L:2024L
  if (!identical(sheet_years, expected_years)) {
    stop("unexpected structural survey sheet years", call. = FALSE)
  }

  rows <- list()
  reconciliation <- list()
  out_idx <- 1L
  rec_idx <- 1L
  for (year in sheet_years) {
    sheet <- suppressMessages(
      read_excel(workbook_path, sheet = as.character(year), col_names = FALSE, .name_repair = "minimal")
    )
    names(sheet) <- paste0("v", seq_len(ncol(sheet)))
    if (ncol(sheet) < 18L) stop("structural survey sheet has fewer than 18 columns: ", year, call. = FALSE)
    assert_survey_ci_columns(sheet, year)

    filled <- sheet[!is.na(sheet[["v1"]]), ]
    national <- filled[filled[["v1"]] == "Total", ]
    cantons <- filled[filled[["v1"]] %in% names(survey_area_to_code), ]
    if (nrow(national) != 1L) stop("missing national survey row for ", year, call. = FALSE)
    if (nrow(cantons) != 26L) stop("expected 26 canton survey rows for ", year, call. = FALSE)

    cantons[["area_code"]] <- unname(survey_area_to_code[cantons[["v1"]]])
    canton_total <- survey_numeric(cantons[["v2"]])
    canton_none <- survey_numeric(cantons[["v15"]])
    canton_unknown <- survey_numeric(cantons[["v17"]])
    national_total <- survey_numeric(national[["v2"]])
    national_none <- survey_numeric(national[["v15"]])
    national_unknown <- survey_numeric(national[["v17"]])
    total_diff <- sum(canton_total) - national_total
    none_diff <- sum(canton_none) - national_none
    if (max(abs(total_diff), abs(none_diff)) > survey_reconciliation_tolerance) {
      stop("structural survey total or no-religion rows do not reconcile for ", year, call. = FALSE)
    }
    unknown_complete <- all(!is.na(canton_unknown))
    unknown_diff <- if (unknown_complete) sum(canton_unknown) - national_unknown else NA_real_
    affiliation_diff <- if (unknown_complete) {
      sum(canton_total - canton_none - canton_unknown) -
        (national_total - national_none - national_unknown)
    } else {
      NA_real_
    }
    reconciliation[[rec_idx]] <- data.frame(
      year = year,
      total_difference_raw = total_diff,
      no_religion_difference_raw = none_diff,
      unknown_difference_raw = unknown_diff,
      affiliation_difference_raw = affiliation_diff,
      suppressed_unknown_canton_count = sum(is.na(canton_unknown)),
      stringsAsFactors = FALSE
    )
    rec_idx <- rec_idx + 1L

    for (row_idx in seq_len(nrow(cantons))) {
      area_code <- cantons[["area_code"]][row_idx]
      boundary_row <- boundary_table[boundary_table[["area_code"]] == area_code, ]
      total <- survey_numeric(cantons[["v2"]][row_idx])
      no_religion <- survey_numeric(cantons[["v15"]][row_idx])
      unknown <- survey_numeric(cantons[["v17"]][row_idx])
      has_unknown <- !is.na(unknown)
      religious <- if (has_unknown) total - no_religion - unknown else NA_real_
      quality <- paste(
        "sample_survey_estimate",
        "weighted_count_estimate",
        "resident_population_age15plus",
        "confidence_intervals_in_source_workbook",
        "not_comparable_to_census_counts",
        sep = ";"
      )
      if (!has_unknown) {
        quality <- paste(
          quality,
          "unknown_affiliation_suppressed_religious_affiliation_not_derived",
          sep = ";"
        )
      }
      rows[[out_idx]] <- list(
        country_code = country_code,
        boundary_set_id = boundary_set_id,
        boundary_level = boundary_level,
        area_unit_id = boundary_row[["area_unit_id"]],
        area_code = area_code,
        area_name = boundary_row[["area_name"]],
        year = as.integer(year),
        population_total = as.integer(round(total)),
        population_total_basis = survey_population_basis,
        religious_affiliation_count = if (has_unknown) as.integer(round(religious)) else NULL,
        religious_affiliation_percent = if (has_unknown) round(100 * religious / total, 2) else NULL,
        no_religion_count = as.integer(round(no_religion)),
        no_religion_percent = round(100 * no_religion / total, 2),
        place_count = NULL,
        places_per_10000_residents = NULL,
        place_density_per_sq_km = NULL,
        land_area_sq_km = boundary_row[["land_area_sq_km"]],
        site_snapshot_date = NULL,
        place_count_basis = NULL,
        source_dataset_ids = c(survey_dataset_id, boundary_dataset_id),
        quality_flag = quality
      )
      out_idx <- out_idx + 1L
    }
  }
  list(rows = rows, reconciliation = do.call(rbind, reconciliation))
}

# convert area-summary rows to a flat CSV table.
flatten_rows <- function(rows) {
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

# count rows or features for generated files.
row_or_feature_count <- function(path) {
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

# describe the source datasets used in a census area-summary document.
census_source_datasets <- function() {
  list(
    list(
      source_dataset_id = census_dataset_id,
      name = "Wohnbevölkerung am wirtschaftlichen Wohnsitz nach institutionellen Gliederungen und Religion, 1970-2000",
      provider = "Federal Statistical Office (FSO/BFS)",
      url = census_api_url,
      retrieval_date = retrieval_date,
      local_path = census_data_path,
      licence = list(
        name = "opendata.swiss OPEN-BY-ASK / terms_by_ask",
        url = "https://opendata.swiss/terms-of-use#terms_by_ask",
        attribution = "Source: Federal Statistical Office (FSO/BFS)"
      ),
      citation = "Federal Statistical Office, population at economic residence by institutional divisions and religion, 1970-2000.",
      access_limits = "Public PX-Web API route.",
      redistribution_limits = "Raw source is not committed; commercial reuse requires permission from the data owner under OPEN-BY-ASK.",
      notes = "Machine-readable canton rows are available for 1970, 1980, 1990 and 2000."
    ),
    boundary_source_dataset()
  )
}

# describe the source datasets used in a survey area-summary document.
survey_source_datasets <- function() {
  list(
    list(
      source_dataset_id = survey_dataset_id,
      name = "Religionszugehörigkeit nach Grossregion und Kanton",
      provider = "Federal Statistical Office (FSO/BFS)",
      url = survey_workbook_url,
      retrieval_date = retrieval_date,
      local_path = survey_workbook_path,
      licence = list(
        name = "opendata.swiss OPEN-BY-ASK / terms_by_ask",
        url = "https://opendata.swiss/terms-of-use#terms_by_ask",
        attribution = "Source: Federal Statistical Office (FSO/BFS)"
      ),
      citation = "Federal Statistical Office, structural survey, religious affiliation by major region and canton, 2010-2024.",
      access_limits = "Public DAM workbook route.",
      redistribution_limits = "Raw source is not committed; commercial reuse requires permission from the data owner under OPEN-BY-ASK.",
      notes = "This is a sample survey of the permanent resident population aged 15+ and includes confidence intervals by category in the workbook."
    ),
    boundary_source_dataset()
  )
}

# describe the swisstopo boundary source dataset.
boundary_source_dataset <- function() {
  list(
    source_dataset_id = boundary_dataset_id,
    name = "swissBOUNDARIES3D canton boundaries, 2026-01",
    provider = "swisstopo",
    url = boundary_zip_url,
    retrieval_date = retrieval_date,
    local_path = boundary_zip_path,
    licence = list(
      name = "opendata.swiss OPEN-BY / terms_by",
      url = "https://opendata.swiss/terms-of-use#terms_by",
      attribution = "Source: swisstopo"
    ),
    citation = "swisstopo, swissBOUNDARIES3D, 2026-01 canton boundary layer.",
    access_limits = "Public download route through data.geo.admin.ch.",
    redistribution_limits = "Derived simplified GeoJSON is committed with attribution.",
    notes = "The tlm_kantonsgebiet layer has 26 canton features."
  )
}

# construct indicator metadata for the census product.
census_indicators <- function(years) {
  list(
    list(
      indicator_id = "ch.census_population_total",
      label = "Census population total",
      description = "Full-count federal census population at economic residence in the FSO religion cube.",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "Read from the Religion - Total category for each canton-year.",
      temporal_coverage = paste(range(years), collapse = "-"),
      spatial_coverage = "26 Swiss cantons",
      quality_notes = "The PX cube reports all years on the source's institutional canton frame; Jura is present in the 1970 row before the 1979 canton creation."
    ),
    list(
      indicator_id = "ch.census_religious_affiliation_percent",
      label = "Census religious-affiliation share",
      description = "Share of the census population with a stated religious affiliation, excluding Keine Zugehörigkeit and Ohne Angabe from the numerator.",
      unit = "percent",
      denominator_indicator_id = "ch.census_population_total",
      method = "100 * (Religion - Total - Keine Zugehörigkeit - Ohne Angabe) / Religion - Total.",
      temporal_coverage = paste(range(years), collapse = "-"),
      spatial_coverage = "26 Swiss cantons",
      quality_notes = "This is a census affiliation construct and must not be compared as one time series with the structural survey estimates."
    ),
    list(
      indicator_id = "ch.census_no_religion_percent",
      label = "Census no-religion share",
      description = "Share of the census population recorded as Keine Zugehörigkeit.",
      unit = "percent",
      denominator_indicator_id = "ch.census_population_total",
      method = "100 * Keine Zugehörigkeit / Religion - Total.",
      temporal_coverage = paste(range(years), collapse = "-"),
      spatial_coverage = "26 Swiss cantons",
      quality_notes = "Full-count census category."
    )
  )
}

# construct indicator metadata for the structural-survey product.
survey_indicators <- function(years) {
  list(
    list(
      indicator_id = "ch.structural_survey_population_estimate",
      label = "Structural survey population estimate",
      description = "Weighted sample-survey estimate for the permanent resident population aged 15+.",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "Read from the annual structural survey workbook's Total column by canton.",
      temporal_coverage = paste(range(years), collapse = "-"),
      spatial_coverage = "26 Swiss cantons",
      quality_notes = "This denominator differs from the census population count and has survey uncertainty."
    ),
    list(
      indicator_id = "ch.structural_survey_religious_affiliation_estimate_percent",
      label = "Structural survey religious-affiliation estimate",
      description = "Estimated share with a religious affiliation, excluding Ohne Religionszugehörigkeit and Religionszugehörigkeit unbekannt when the unknown category is published for the canton.",
      unit = "percent",
      denominator_indicator_id = "ch.structural_survey_population_estimate",
      method = "100 * (Total - Ohne Religionszugehörigkeit - Religionszugehörigkeit unbekannt) / Total when unknown affiliation is not suppressed.",
      temporal_coverage = paste(range(years), collapse = "-"),
      spatial_coverage = "26 Swiss cantons",
      quality_notes = "Rows are flagged sample_survey_estimate. The source workbook publishes confidence intervals by category; the legacy area-summary row schema has no CI columns, and affiliation is null where unknown affiliation is suppressed."
    ),
    list(
      indicator_id = "ch.structural_survey_no_religion_estimate_percent",
      label = "Structural survey no-religion estimate",
      description = "Estimated share reporting no religious affiliation.",
      unit = "percent",
      denominator_indicator_id = "ch.structural_survey_population_estimate",
      method = "100 * Ohne Religionszugehörigkeit / Total.",
      temporal_coverage = paste(range(years), collapse = "-"),
      spatial_coverage = "26 Swiss cantons",
      quality_notes = "The source workbook publishes confidence intervals for the no-religion estimate in every canton-year."
    )
  )
}

# construct visual-layer metadata for the census product.
census_visual_layers <- function() {
  list(
    list(
      visual_layer_id = "ch.census_religious_affiliation_percent",
      label = "Census religious-affiliation share",
      description = "Full-count census affiliation share by canton.",
      layer_type = "choropleth",
      indicator_ids = list("ch.census_religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = NULL,
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "none",
      uncertainty_display = "none",
      default_visibility = TRUE,
      notes = "Census construct only; not a structural-survey continuation."
    ),
    list(
      visual_layer_id = "ch.census_no_religion_percent",
      label = "Census no-religion share",
      description = "Full-count census no-religion share by canton.",
      layer_type = "choropleth",
      indicator_ids = list("ch.census_no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = NULL,
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "none",
      uncertainty_display = "none",
      default_visibility = FALSE,
      notes = "Census construct only."
    )
  )
}

# construct visual-layer metadata for the structural-survey product.
survey_visual_layers <- function() {
  list(
    list(
      visual_layer_id = "ch.structural_survey_religious_affiliation_estimate_percent",
      label = "Structural survey religious-affiliation estimate",
      description = "Sample-survey affiliation estimate by canton, aged 15+.",
      layer_type = "choropleth",
      indicator_ids = list("ch.structural_survey_religious_affiliation_estimate_percent"),
      geometry_unit_type = "area_unit",
      legend = NULL,
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "none",
      uncertainty_display = "confidence intervals in source workbook",
      default_visibility = TRUE,
      notes = "Sample-survey construct only; not a census continuation."
    ),
    list(
      visual_layer_id = "ch.structural_survey_no_religion_estimate_percent",
      label = "Structural survey no-religion estimate",
      description = "Sample-survey no-religion estimate by canton, aged 15+.",
      layer_type = "choropleth",
      indicator_ids = list("ch.structural_survey_no_religion_estimate_percent"),
      geometry_unit_type = "area_unit",
      legend = NULL,
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "none",
      uncertainty_display = "confidence intervals in source workbook",
      default_visibility = FALSE,
      notes = "The no-religion estimate is complete for every canton-year."
    )
  )
}

# construct an area-summary document for one Switzerland construct product.
area_summary_document <- function(rows, product) {
  years <- sort(unique(vapply(rows, `[[`, integer(1), "year")))
  list(
    schema_version = "0.2.0",
    generated_at = stamp,
    generated_by = script_id,
    country_code = country_code,
    boundary_set = list(
      boundary_set_id = boundary_set_id,
      country_code = country_code,
      level = boundary_level,
      vintage = "2026",
      source_dataset_id = boundary_dataset_id
    ),
    site_snapshot = list(
      source_dataset_id = NULL,
      snapshot_date = NULL,
      basis = place_snapshot_basis,
      notes = paste(
        "The Switzerland release exposes canton religion-area summaries only;",
        "place-density metrics remain null until a governed place layer is built."
      )
    ),
    source_datasets = if (product == "census") census_source_datasets() else survey_source_datasets(),
    indicators = if (product == "census") census_indicators(years) else survey_indicators(years),
    visual_layers = if (product == "census") census_visual_layers() else survey_visual_layers(),
    rows = rows
  )
}

# create a durable-file record for one generated output.
manifest_file_record <- function(path, content, licence_status_value = "accepted") {
  list(
    uri = paste0("repo:", path),
    storage_provider = "other",
    format = sub("^.*\\.", "", path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    row_count = if (grepl("area_summary|\\.csv$", path)) row_or_feature_count(path) else NULL,
    feature_count = if (grepl("\\.geojson$", path)) row_or_feature_count(path) else NULL,
    content = content,
    privacy = "public",
    licence_status = licence_status_value
  )
}

# write a schema-shaped data manifest for a generated product.
write_manifest <- function(path, product, output_paths, source_urls, stats, warnings, notes) {
  output_hashes <- vapply(output_paths, sha256_file, character(1))
  version_hash <- substr(sha256_values(c(output_hashes, stats)), 1L, 12L)
  dataset_id <- if (product == "census") {
    "ch-census-religion:ch:1970-2000:bfs-px-canton"
  } else {
    "ch-structural-survey-religion:ch:2010-2024:bfs-canton"
  }
  family <- if (product == "census") "ch-census-religion" else "ch-structural-survey-religion"
  manifest <- list(
    `$schema` = "../../schemas/data-manifest.schema.json",
    schema_version = "data-manifest.v1",
    manifest_id = paste0("manifest:", dataset_id, ":", version_hash),
    dataset_id = dataset_id,
    dataset_version_id = paste0(dataset_id, ":", version_hash),
    manifest_sha256 = NULL,
    supersedes_manifest_id = NULL,
    superseded_by_manifest_id = NULL,
    dataset_family = family,
    dataset_role = "public_product",
    scope = list(
      level = "country",
      country_codes = list("CH"),
      snapshot_date = NULL,
      snapshot_anchor = NULL,
      pipeline_stage = "public"
    ),
    created_at = stamp,
    created_by = script_id,
    pipeline = list(
      script = script_id,
      git_commit = git_commit_short(),
      command = "Rscript scripts/build_ch_area_summary.R",
      parameters = list(
        product = product,
        boundary_set = boundary_set_id,
        construct_split = paste(
          "Census full-count affiliation and structural-survey age-15-plus",
          "weighted estimates are shipped as separate area-summary products."
        )
      ),
      software_versions = list(
        r = paste(R.version$major, R.version$minor, sep = "."),
        sf = as.character(packageVersion("sf")),
        readxl = as.character(packageVersion("readxl")),
        jsonlite = as.character(packageVersion("jsonlite")),
        mapshaper = "npx --yes mapshaper"
      )
    ),
    source = list(
      provider = if (product == "census") "Federal Statistical Office (FSO/BFS); swisstopo" else "Federal Statistical Office (FSO/BFS); swisstopo",
      source_dataset_ids = if (product == "census") {
        c(census_dataset_id, boundary_dataset_id)
      } else {
        c(survey_dataset_id, boundary_dataset_id)
      },
      source_urls = unique(source_urls),
      retrieved_at = stamp,
      licence = paste(fso_terms_by_ask, swisstopo_terms_by, sep = " Boundary source: "),
      citation = if (product == "census") {
        "Federal Statistical Office, population at economic residence by institutional divisions and religion, 1970-2000; swisstopo, swissBOUNDARIES3D 2026-01."
      } else {
        "Federal Statistical Office, structural survey, religious affiliation by major region and canton, 2010-2024; swisstopo, swissBOUNDARIES3D 2026-01."
      }
    ),
    input_manifests = list(),
    durable_files = unname(Map(
      function(output_path, content) manifest_file_record(output_path, content),
      output_paths,
      c("simplified canton boundary", "area-summary JSON", "area-summary CSV")
    )),
    partitions = list(),
    stats = stats,
    local_cache_hint = raw_dir,
    validation = list(
      status = if (length(warnings) == 0L) "passed" else "passed_with_warnings",
      commands = c(
        "Rscript scripts/build_ch_area_summary.R",
        "Rscript -e 'jsonlite::validate(readChar(\"apps/regions/ch/data/area_summary_canton_census.json\", file.info(\"apps/regions/ch/data/area_summary_canton_census.json\")$size))'",
        "Rscript -e 'jsonlite::validate(readChar(\"apps/regions/ch/data/area_summary_canton_survey.json\", file.info(\"apps/regions/ch/data/area_summary_canton_survey.json\")$size))'"
      ),
      warnings = warnings,
      notes = notes
    ),
    privacy = "public",
    licence_status = "accepted",
    downstream_status = "public",
    notes = notes
  )
  write_json(manifest, path, auto_unbox = TRUE, pretty = TRUE, null = "null",
             na = "null", digits = NA)
}

census_request <- list(
  query = list(
    list(code = "Jahr", selection = list(filter = "all", values = list("*"))),
    list(
      code = "Kanton (-) / Bezirk (>>) / Gemeinde (......)",
      selection = list(filter = "item", values = c("0", names(canton_px_to_code)))
    ),
    list(code = "Religion", selection = list(filter = "all", values = list("*")))
  ),
  response = list(format = "JSON-stat2")
)

invisible(fetch_get_if_missing(census_package_url, census_package_path))
invisible(fetch_get_if_missing(census_api_url, census_meta_path))
invisible(fetch_post_json_if_missing(census_api_url, census_request, census_data_path))
invisible(fetch_get_if_missing(survey_package_url, survey_package_path))
invisible(fetch_get_if_missing(survey_asset_meta_url, survey_asset_meta_path))
invisible(fetch_get_if_missing(survey_workbook_url, survey_workbook_path))
invisible(fetch_get_if_missing(boundary_package_url, boundary_package_path))
invisible(fetch_get_if_missing(boundary_stac_url, boundary_stac_path))
invisible(fetch_get_if_missing(boundary_zip_url, boundary_zip_path))
invisible(fetch_get_if_missing(opendata_terms_url, opendata_terms_path))

boundary <- read_boundary(boundary_zip_path)
boundary_table <- boundary_lookup(boundary)
boundary_write <- mapshaper_simplify_to_cap(
  boundary,
  boundary_out,
  max_bytes = 900000,
  keep_percentages = c(90, 75, 60, 45, 30, 20, 15, 10, 7, 5, 3, 2, 1),
  clean_option = "skip"
)
if (row_or_feature_count(boundary_out) != 26L) {
  stop("simplified canton boundary does not contain 26 features", call. = FALSE)
}

census_long <- read_census_long(census_data_path)
census_reconciliation <- reconcile_census(census_long)
census_rows <- build_census_rows(census_long, boundary_table)
census_years <- sort(unique(vapply(census_rows, `[[`, integer(1), "year")))
if (!identical(census_years, c(1970L, 1980L, 1990L, 2000L))) {
  stop("unexpected census product years", call. = FALSE)
}

survey_build <- build_survey_rows(survey_workbook_path, boundary_table)
survey_rows <- survey_build[["rows"]]
survey_reconciliation <- survey_build[["reconciliation"]]

write_json(area_summary_document(census_rows, "census"), census_summary_json_out,
           auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null",
           digits = NA)
write.csv(flatten_rows(census_rows), census_summary_csv_out, row.names = FALSE, na = "")

write_json(area_summary_document(survey_rows, "survey"), survey_summary_json_out,
           auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null",
           digits = NA)
write.csv(flatten_rows(survey_rows), survey_summary_csv_out, row.names = FALSE, na = "")

for (json_path in c(census_summary_json_out, survey_summary_json_out)) {
  json_text <- paste(readLines(json_path, warn = FALSE), collapse = "\n")
  if (!jsonlite::validate(json_text)) stop("invalid JSON written: ", json_path, call. = FALSE)
}

census_stats <- list(
  row_count = length(census_rows),
  canton_count = 26L,
  year_count = length(census_years),
  years = paste(census_years, collapse = ","),
  census_reconciliation_categories = nrow(census_reconciliation),
  census_reconciliation_max_abs_difference = max(abs(census_reconciliation[["difference"]])),
  boundary_keep_percent = boundary_write[["keep_percent"]],
  boundary_bytes = boundary_write[["bytes"]],
  construct = "federal_census_full_count_affiliation"
)

survey_years <- sort(unique(vapply(survey_rows, `[[`, integer(1), "year")))
suppressed_unknown_rows <- sum(grepl("unknown_affiliation_suppressed", vapply(survey_rows, `[[`, character(1), "quality_flag")))
survey_stats <- list(
  row_count = length(survey_rows),
  canton_count = 26L,
  year_count = length(survey_years),
  years = paste(range(survey_years), collapse = "-"),
  total_reconciliation_max_abs_raw_difference = max(abs(survey_reconciliation[["total_difference_raw"]])),
  no_religion_reconciliation_max_abs_raw_difference = max(abs(survey_reconciliation[["no_religion_difference_raw"]])),
  suppressed_unknown_canton_years = suppressed_unknown_rows,
  boundary_keep_percent = boundary_write[["keep_percent"]],
  boundary_bytes = boundary_write[["bytes"]],
  construct = "structural_survey_weighted_age15plus_estimate"
)

write_manifest(
  census_manifest_out,
  "census",
  c(boundary_out, census_summary_json_out, census_summary_csv_out),
  c(census_package_url, census_api_url, boundary_package_url, boundary_stac_url,
    boundary_zip_url, opendata_terms_url),
  census_stats,
  warnings = character(),
  notes = paste(
    "Census affiliation rows are full-count census counts. The product uses",
    "the source's current 26-canton frame; Jura appears in the 1970 row as a",
    "source-provided current-frame historical roll-up."
  )
)

write_manifest(
  survey_manifest_out,
  "survey",
  c(boundary_out, survey_summary_json_out, survey_summary_csv_out),
  c(survey_package_url, survey_asset_meta_url, survey_workbook_url,
    boundary_package_url, boundary_stac_url, boundary_zip_url, opendata_terms_url),
  survey_stats,
  warnings = c(
    "Structural-survey rows are weighted sample estimates for the resident population aged 15+ and are not census counts.",
    "The source workbook includes confidence intervals by category, but the legacy area-summary row schema has no CI columns.",
    paste0(
      "Survey canton total and no-religion estimates are checked against the workbook national row with a ",
      survey_reconciliation_tolerance,
      "-person tolerance for weighted-estimate decimal residuals."
    ),
    paste0(
      suppressed_unknown_rows,
      " canton-year rows have suppressed unknown-affiliation cells, so religious_affiliation_count and religious_affiliation_percent are null for those rows."
    )
  ),
  notes = paste(
    "The survey product is separate from the census product because the",
    "denominator, measurement design and uncertainty differ. Canton total and",
    "no-religion estimates are compared with the workbook's national row before",
    "integer rounding; small decimal residuals reflect weighted estimates,",
    "and suppressed unknown-affiliation cells prevent exact",
    "canton reconstruction of the affiliation-excluding-unknown numerator in",
    "the affected rows."
  )
)

message("wrote ", boundary_out, " (", file_bytes(boundary_out), " bytes)")
message("wrote ", census_summary_json_out, " (", length(census_rows), " rows)")
message("wrote ", survey_summary_json_out, " (", length(survey_rows), " rows)")
