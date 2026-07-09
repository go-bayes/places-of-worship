# build the denmark church-membership area-summary products from statbank km1/km6.
# inputs: cached statbank km1 parish q1 files, statbank km6 municipality q1
# files, dawa/dagi current sogn and kommune boundaries, and cached source
# licence pages.
# outputs: apps/regions/dk/data/dk_sogn_2026.geojson,
# apps/regions/dk/data/area_summary_sogn.{json,csv},
# apps/regions/dk/data/dk_kommune_2026.geojson,
# apps/regions/dk/data/area_summary_kommune.{json,csv}, and
# docs/manifests/dk-membership-2011-2026.json.
# run from the repo root: Rscript scripts/build_dk_area_summary.R

suppressMessages({
  library(jsonlite)
  library(sf)
})

raw_dir <- "data/raw/dk_membership"
dk_dir <- "apps/regions/dk/data"
manifest_dir <- "docs/manifests"
dir.create(raw_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(dk_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- "2026-07-10"
script_id <- "scripts/build_dk_area_summary.R"
country_code <- "DK"

statbank_base_url <- "https://api.statbank.dk/v1/data"
statbank_tableinfo_base_url <- "https://api.statbank.dk/v1/tableinfo"
dst_api_help_url <- "https://www.dst.dk/en/Statistik/hjaelp-til-statistikbanken/api"
dawa_sogn_url <- "https://api.dataforsyningen.dk/sogne?format=geojson&srid=4326&per_side=250&side={page}"
dawa_kommune_url <- "https://api.dataforsyningen.dk/kommuner?format=geojson&srid=4326&per_side=500"
dawa_sogn_register_url <- "https://api.dataforsyningen.dk/sogne?format=json"
dawa_sogn_docs_url <- "https://dawadocs.dataforsyningen.dk/dok/api/sogn"
dagi_overview_url <- "https://datafordeler.dk/dataoversigt/danmarks-administrative-geografiske-inddeling-dagi/"
kds_terms_url <- "https://datafordeler.dk/vejledning/brugervilkaar/kds-geografiske-data/"
cc_by_url <- "https://creativecommons.org/licenses/by/4.0/"

membership_dataset_id <- "dst-statbank-km1-church-membership-parish-q1-2007-2026"
municipality_dataset_id <- "dst-statbank-km6-church-membership-kommune-q1-2011-2026"
parish_boundary_dataset_id <- "dawa-dagi-sogn-current-2026"
municipality_boundary_dataset_id <- "dawa-dagi-kommune-current-2026"
parish_boundary_set_id <- "dk-sogn-2026-dawa-dagi"
municipality_boundary_set_id <- "dk-kommune-2026-dawa-dagi"

km1_sogn_path <- file.path(raw_dir, "statbank_km1_sogn_2007_2026_q1.csv")
km1_national_path <- file.path(raw_dir, "statbank_km1_national_sum_2007_2026_q1.csv")
km1_reconciliation_source_path <- file.path(raw_dir, "statbank_km1_national_reconciliation_source_2007_2026_q1.csv")
km1_tableinfo_path <- file.path(raw_dir, "statbank_km1_tableinfo_en.json")
km6_kommune_path <- file.path(raw_dir, "statbank_km6_kommune_2011_2026_q1.csv")
km6_national_path <- file.path(raw_dir, "statbank_km6_national_sum_2011_2026_q1.csv")
km6_tableinfo_path <- file.path(raw_dir, "statbank_km6_tableinfo_en.json")
dawa_sogn_register_path <- file.path(raw_dir, "dawa_sogne_current_register.json")
dawa_kommune_raw_path <- file.path(raw_dir, "dawa_kommuner_current_raw.geojson")
dst_api_help_path <- file.path(raw_dir, "dst_statbank_api_help.html")
dawa_sogn_docs_path <- file.path(raw_dir, "dawa_sogn_docs.html")
dagi_overview_path <- file.path(raw_dir, "datafordeler_dagi_overview.html")
kds_terms_path <- file.path(raw_dir, "datafordeler_kds_geografiske_data.html")

parish_boundary_out <- file.path(dk_dir, "dk_sogn_2026.geojson")
parish_summary_json_out <- file.path(dk_dir, "area_summary_sogn.json")
parish_summary_csv_out <- file.path(dk_dir, "area_summary_sogn.csv")
municipality_boundary_out <- file.path(dk_dir, "dk_kommune_2026.geojson")
municipality_summary_json_out <- file.path(dk_dir, "area_summary_kommune.json")
municipality_summary_csv_out <- file.path(dk_dir, "area_summary_kommune.csv")
manifest_out <- file.path(manifest_dir, "dk-membership-2011-2026.json")

parish_product_years <- 2023L:2026L
parish_source_years <- 2007L:2026L
municipality_years <- 2011L:2026L

km1_parish_request <- list(
  table = "KM1",
  format = "BULK",
  lang = "en",
  valuePresentation = "CodeAndValue",
  variables = list(
    list(code = "SOGN", values = list("*")),
    list(code = "FKMED", values = list("F", "U")),
    list(code = "Tid", values = as.list(paste0(parish_source_years, "K1")))
  )
)

km6_kommune_request <- list(
  table = "KM6",
  format = "BULK",
  lang = "en",
  valuePresentation = "CodeAndValue",
  variables = list(
    list(code = "KOMK", values = list("*")),
    list(code = "K\u00d8N", values = list("1", "2")),
    list(code = "ALDER", values = list("*")),
    list(code = "FKMED", values = list("F", "U")),
    list(code = "Tid", values = as.list(as.character(municipality_years)))
  )
)

membership_basis_note <- paste(
  "Administrative Church of Denmark membership register population:",
  "member plus not-member counts in the same StatBank table, geography,",
  "and January/Q1 period."
)
parish_population_basis_note <- paste(
  "StatBank KM1 Q1 parish row; population_total is member plus not member",
  "of the National Church for the same parish and quarter."
)
municipality_population_basis_note <- paste(
  "StatBank KM6 1 January municipality row; population_total is member plus",
  "not member of the National Church after summing sex and age groups."
)
place_snapshot_basis <- paste(
  "no governed Denmark place-of-worship snapshot is included in this",
  "membership data-map release"
)
membership_quality_flag <- paste(
  "administrative_membership_register",
  "church_of_denmark_membership_not_affiliation_or_attendance",
  "member_share_member_over_member_plus_non_member",
  sep = ";"
)
parish_quality_flag <- paste(
  membership_quality_flag,
  "q1_km1",
  "current_dawa_dagi_sogn_boundary_join",
  "dropped_source_parishes_recorded_in_manifest",
  sep = ";"
)
municipality_quality_flag <- paste(
  membership_quality_flag,
  "annual_january_km6",
  "current_dawa_dagi_kommune_boundary_join",
  sep = ";"
)

# compute the sha-256 digest for a local file.
sha256_file <- function(path) {
  unname(tools::sha256sum(path))
}

# hash ordered file digests into a compact version token.
sha256_values <- function(values) {
  tmp <- tempfile()
  on.exit(unlink(tmp), add = TRUE)
  writeBin(charToRaw(paste(values, collapse = "")), tmp)
  sha256_file(tmp)
}

# return file size in bytes for validation and manifest records.
file_bytes <- function(path) {
  as.integer(unname(file.info(path)[["size"]]))
}

# return NULL where JSON should carry an absent scalar.
null_if_na <- function(value) {
  if (length(value) == 0L || is.na(value) || !is.finite(value)) return(NULL)
  value
}

# return a row or feature count for generated CSV, GeoJSON, and area-summary JSON files.
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$", path)) {
    geo <- fromJSON(path, simplifyVector = FALSE)
    return(length(geo[["features"]]))
  }
  if (grepl("area_summary.*\\.json$", path)) {
    json <- fromJSON(path, simplifyVector = FALSE)
    return(length(json[["rows"]]))
  }
  NA_integer_
}

# read a sidecar metadata JSON file and return an empty list when it is absent.
read_meta <- function(path) {
  meta_path <- paste0(path, ".meta.json")
  if (!file.exists(meta_path)) return(list())
  fromJSON(meta_path, simplifyVector = FALSE)
}

# write a compact sidecar metadata JSON file for a cached network response.
write_meta <- function(path, url, method, request_body = NULL) {
  meta <- list(
    retrieved_at = stamp,
    url = url,
    method = method,
    http_status = 200,
    request_body = request_body
  )
  write_json(meta, paste0(path, ".meta.json"), auto_unbox = TRUE, pretty = TRUE, null = "null")
}

# stop when a required cached source path is missing.
require_file <- function(path) {
  if (!file.exists(path)) stop("missing required source: ", path, call. = FALSE)
}

# download an open GET response into the raw cache when the path is absent.
fetch_get_if_missing <- function(url, path) {
  if (file.exists(path) && file_bytes(path) > 0L) {
    if (!file.exists(paste0(path, ".meta.json"))) write_meta(path, url, "GET")
    return(FALSE)
  }
  tmp <- tempfile(tmpdir = dirname(path))
  on.exit(unlink(tmp), add = TRUE)
  status <- system2("curl", c("-fL", "-sS", shQuote(url), "-o", shQuote(tmp)))
  if (status != 0L || !file.exists(tmp) || file_bytes(tmp) == 0L) {
    stop("GET fetch failed for ", url, call. = FALSE)
  }
  file.rename(tmp, path)
  write_meta(path, url, "GET")
  TRUE
}

# post a StatBank request body into the raw cache when the CSV path is absent.
fetch_statbank_if_missing <- function(table_id, request_body, path) {
  if (file.exists(path) && file_bytes(path) > 0L) {
    if (!file.exists(paste0(path, ".meta.json"))) {
      write_meta(path, paste0(statbank_base_url, "/", table_id, "/CSV?lang=en"), "POST", request_body)
    }
    return(FALSE)
  }
  url <- paste0(statbank_base_url, "/", table_id, "/CSV?lang=en")
  tmp_body <- tempfile(fileext = ".json")
  tmp_out <- tempfile(tmpdir = dirname(path))
  on.exit(unlink(c(tmp_body, tmp_out)), add = TRUE)
  write_json(request_body, tmp_body, auto_unbox = TRUE, pretty = FALSE)
  status <- system2(
    "curl",
    c("-fL", "-sS", shQuote(url), "-H", shQuote("Content-Type: application/json"),
      "-d", shQuote(paste0("@", tmp_body)), "-o", shQuote(tmp_out))
  )
  if (status != 0L || !file.exists(tmp_out) || file_bytes(tmp_out) == 0L) {
    stop("StatBank fetch failed for ", table_id, call. = FALSE)
  }
  file.rename(tmp_out, path)
  write_meta(path, url, "POST", request_body)
  TRUE
}

# fetch StatBank table metadata when the cached tableinfo JSON is absent.
fetch_tableinfo_if_missing <- function(table_id, path) {
  url <- paste0(statbank_tableinfo_base_url, "/", table_id, "?lang=en")
  fetch_get_if_missing(url, path)
}

# fetch one DAWA paged sogn GeoJSON file when it is absent.
fetch_sogn_page_if_missing <- function(page) {
  path <- file.path(raw_dir, sprintf("dawa_sogne_page%d.geojson", page))
  url <- sub("\\{page\\}", as.character(page), dawa_sogn_url)
  fetch_get_if_missing(url, path)
  path
}

# ensure every raw source needed by the builder is present in the local cache.
ensure_sources <- function() {
  fetch_tableinfo_if_missing("KM1", km1_tableinfo_path)
  fetch_tableinfo_if_missing("KM6", km6_tableinfo_path)
  fetch_statbank_if_missing("KM1", km1_parish_request, km1_sogn_path)
  fetch_statbank_if_missing("KM6", km6_kommune_request, km6_kommune_path)
  write_derived_national_sum_if_missing(km1_sogn_path, "SOGN", 4L, km1_national_path, "KM1", parish_source_years)
  write_derived_national_sum_if_missing(km6_kommune_path, "KOMK", 4L, km6_national_path, "KM6", municipality_years)
  fetch_get_if_missing(dawa_sogn_register_url, dawa_sogn_register_path)
  fetch_get_if_missing(dawa_kommune_url, dawa_kommune_raw_path)
  fetch_get_if_missing(dst_api_help_url, dst_api_help_path)
  fetch_get_if_missing(dawa_sogn_docs_url, dawa_sogn_docs_path)
  fetch_get_if_missing(dagi_overview_url, dagi_overview_path)
  fetch_get_if_missing(kds_terms_url, kds_terms_path)
  invisible(lapply(1:9, fetch_sogn_page_if_missing))
}

# parse the leading StatBank geography code from a code-and-label cell.
extract_leading_code <- function(values) {
  values <- trimws(as.character(values))
  has_code <- grepl("^\\d{3,4}\\b", values)
  out <- rep(NA_character_, length(values))
  out[has_code] <- sub("^(\\d{3,4})\\b.*$", "\\1", values[has_code])
  out
}

# remove one or two leading code tokens from a StatBank code-and-label cell.
extract_area_label <- function(values) {
  labels <- trimws(as.character(values))
  labels <- trimws(sub("^\\d{3,4}\\b\\s*", "", labels))
  labels <- trimws(sub("^\\d{3,4}\\b\\s*", "", labels))
  labels
}

# parse a four-digit year from a StatBank time cell such as 2026Q1 or 2026 2026.
extract_year <- function(values) {
  as.integer(regmatches(as.character(values), regexpr("\\d{4}", as.character(values))))
}

# parse the Church-membership status code from a StatBank FKMED cell.
extract_fkmed <- function(values) {
  values <- trimws(as.character(values))
  ifelse(grepl("^F\\b|^Member of National Church$", values), "F",
         ifelse(grepl("^U\\b|^Not member of National Church$", values), "U", NA_character_))
}

# read a semicolon-delimited StatBank CSV with stable character columns.
read_statbank_csv <- function(path) {
  read.csv(
    path,
    sep = ";",
    fileEncoding = "UTF-8-BOM",
    stringsAsFactors = FALSE,
    check.names = FALSE,
    colClasses = "character"
  )
}

# aggregate a StatBank geography-by-FKMED table into one row per area and year.
aggregate_area_membership <- function(path, geography_col, code_width = NULL) {
  df <- read_statbank_csv(path)
  required_cols <- c(geography_col, "FKMED", "TID", "INDHOLD")
  missing_cols <- setdiff(required_cols, names(df))
  if (length(missing_cols) > 0L) {
    stop(path, " is missing columns: ", paste(missing_cols, collapse = ", "), call. = FALSE)
  }
  df[["area_code"]] <- extract_leading_code(df[[geography_col]])
  df[["area_label"]] <- extract_area_label(df[[geography_col]])
  df[["year"]] <- extract_year(df[["TID"]])
  df[["fkmed"]] <- extract_fkmed(df[["FKMED"]])
  df[["value"]] <- as.integer(df[["INDHOLD"]])
  if (any(is.na(df[["area_code"]]) | is.na(df[["year"]]) | is.na(df[["fkmed"]]) | is.na(df[["value"]]))) {
    stop("failed to parse one or more StatBank cells in ", path, call. = FALSE)
  }
  if (!is.null(code_width)) df[["area_code"]] <- sprintf(paste0("%0", code_width, "d"), as.integer(df[["area_code"]]))

  totals <- aggregate(value ~ area_code + year + fkmed, df, sum)
  wide <- reshape(totals, idvar = c("area_code", "year"), timevar = "fkmed", direction = "wide")
  names(wide) <- sub("^value\\.", "", names(wide))
  if (!"F" %in% names(wide)) wide[["F"]] <- 0L
  if (!"U" %in% names(wide)) wide[["U"]] <- 0L
  wide[["F"]][is.na(wide[["F"]])] <- 0L
  wide[["U"]][is.na(wide[["U"]])] <- 0L
  wide[["member_count"]] <- as.integer(wide[["F"]])
  wide[["non_member_count"]] <- as.integer(wide[["U"]])
  wide[["population_total"]] <- wide[["member_count"]] + wide[["non_member_count"]]

  labels <- aggregate(area_label ~ area_code + year, df, function(x) x[which(nzchar(x))[1]])
  out <- merge(
    wide[, c("area_code", "year", "member_count", "non_member_count", "population_total")],
    labels,
    by = c("area_code", "year"),
    all.x = TRUE
  )
  out[order(out[["year"]], out[["area_code"]]), ]
}

# aggregate a StatBank national FKMED table into one row per year.
aggregate_national_membership <- function(path) {
  df <- read_statbank_csv(path)
  required_cols <- c("FKMED", "TID", "INDHOLD")
  missing_cols <- setdiff(required_cols, names(df))
  if (length(missing_cols) > 0L) {
    stop(path, " is missing columns: ", paste(missing_cols, collapse = ", "), call. = FALSE)
  }
  df[["year"]] <- extract_year(df[["TID"]])
  df[["fkmed"]] <- extract_fkmed(df[["FKMED"]])
  df[["value"]] <- as.integer(df[["INDHOLD"]])
  if (any(is.na(df[["year"]]) | is.na(df[["fkmed"]]) | is.na(df[["value"]]))) {
    stop("failed to parse one or more national StatBank cells in ", path, call. = FALSE)
  }
  totals <- aggregate(value ~ year + fkmed, df, sum)
  wide <- reshape(totals, idvar = "year", timevar = "fkmed", direction = "wide")
  names(wide) <- sub("^value\\.", "", names(wide))
  if (!"F" %in% names(wide)) wide[["F"]] <- 0L
  if (!"U" %in% names(wide)) wide[["U"]] <- 0L
  wide[["F"]][is.na(wide[["F"]])] <- 0L
  wide[["U"]][is.na(wide[["U"]])] <- 0L
  out <- data.frame(
    year = as.integer(wide[["year"]]),
    member_count = as.integer(wide[["F"]]),
    non_member_count = as.integer(wide[["U"]]),
    stringsAsFactors = FALSE
  )
  out[["population_total"]] <- out[["member_count"]] + out[["non_member_count"]]
  out[order(out[["year"]]), ]
}

# derive and cache a national FKMED total file from a complete geography extract.
write_derived_national_sum_if_missing <- function(source_path, geography_col, code_width, output_path, table_id, years) {
  if (file.exists(output_path) && file_bytes(output_path) > 0L) {
    if (!file.exists(paste0(output_path, ".meta.json"))) {
      write_meta(
        output_path,
        paste0("derived:", table_id, ":complete-geography-sum"),
        "DERIVED",
        list(source_path = source_path, geography_col = geography_col, years = as.list(years))
      )
    }
    return(FALSE)
  }
  membership <- aggregate_area_membership(source_path, geography_col, code_width = code_width)
  records <- list()
  idx <- 0L
  for (year in years) {
    source_year <- membership[membership[["year"]] == year, ]
    idx <- idx + 1L
    records[[idx]] <- data.frame(
      GEOGRAPHY = "Denmark",
      FKMED = "Member of National Church",
      TID = as.character(year),
      INDHOLD = sum(source_year[["member_count"]]),
      stringsAsFactors = FALSE
    )
    idx <- idx + 1L
    records[[idx]] <- data.frame(
      GEOGRAPHY = "Denmark",
      FKMED = "Not member of National Church",
      TID = as.character(year),
      INDHOLD = sum(source_year[["non_member_count"]]),
      stringsAsFactors = FALSE
    )
  }
  out <- do.call(rbind, records)
  write.table(out, output_path, sep = ";", row.names = FALSE, quote = FALSE, fileEncoding = "UTF-8")
  write_meta(
    output_path,
    paste0("derived:", table_id, ":complete-geography-sum"),
    "DERIVED",
    list(source_path = source_path, geography_col = geography_col, years = as.list(years))
  )
  TRUE
}

# repair boundary geometry and keep only polygonal shapes for GeoJSON output.
normalise_polygon_geometry <- function(boundary, label) {
  expected_rows <- nrow(boundary)
  boundary <- st_make_valid(boundary)
  boundary <- st_collection_extract(boundary, "POLYGON", warn = FALSE)
  boundary <- st_cast(boundary, "MULTIPOLYGON", warn = FALSE)
  if (nrow(boundary) != expected_rows) {
    stop("polygon normalisation changed feature count for ", label, call. = FALSE)
  }
  boundary
}

# read and normalise the current DAWA/DAGI sogn boundary pages.
read_parish_boundary <- function() {
  paths <- vapply(1:9, function(page) file.path(raw_dir, sprintf("dawa_sogne_page%d.geojson", page)), character(1))
  for (path in paths) require_file(path)
  parts <- lapply(paths, function(path) st_read(path, quiet = TRUE))
  boundary <- do.call(rbind, parts)
  if (nrow(boundary) != 2097L) stop("expected 2097 DAWA sogn features", call. = FALSE)
  if (anyDuplicated(boundary[["kode"]]) > 0L) stop("duplicate DAWA sogn kode values", call. = FALSE)
  boundary <- normalise_polygon_geometry(boundary, "DK sogn")
  boundary[["area_code"]] <- as.character(boundary[["kode"]])
  boundary[["area_name"]] <- as.character(boundary[["navn"]])
  boundary[["area_unit_id"]] <- paste0(parish_boundary_set_id, ":", boundary[["area_code"]])
  boundary[["boundary_set_id"]] <- parish_boundary_set_id
  boundary[["boundary_level"]] <- "sogn"
  boundary[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(boundary, 3035))) / 1e6
  boundary <- boundary[, c("area_code", "area_name", "area_unit_id", "boundary_set_id",
                           "boundary_level", "land_area_sq_km", "geometry")]
  boundary[order(boundary[["area_code"]]), ]
}

# read and normalise the current DAWA/DAGI kommune boundary GeoJSON.
read_municipality_boundary <- function() {
  require_file(dawa_kommune_raw_path)
  boundary <- st_read(dawa_kommune_raw_path, quiet = TRUE)
  if (nrow(boundary) != 99L) stop("expected 99 DAWA kommune features", call. = FALSE)
  if (anyDuplicated(boundary[["kode"]]) > 0L) stop("duplicate DAWA kommune kode values", call. = FALSE)
  boundary <- normalise_polygon_geometry(boundary, "DK kommune")
  boundary[["area_code"]] <- as.character(boundary[["kode"]])
  boundary[["area_name"]] <- as.character(boundary[["navn"]])
  boundary[["area_unit_id"]] <- paste0(municipality_boundary_set_id, ":", boundary[["area_code"]])
  boundary[["boundary_set_id"]] <- municipality_boundary_set_id
  boundary[["boundary_level"]] <- "kommune"
  boundary[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(boundary, 3035))) / 1e6
  boundary <- boundary[, c("area_code", "area_name", "area_unit_id", "boundary_set_id",
                           "boundary_level", "land_area_sq_km", "geometry")]
  boundary[order(boundary[["area_code"]]), ]
}

# write a mapshaper-simplified GeoJSON and assert the output stays valid and under target.
write_simplified_boundary <- function(boundary, output_path, target_bytes, label) {
  tmp_input <- tempfile(fileext = ".geojson")
  npm_cache <- tempfile("npm-cache-")
  dir.create(npm_cache, showWarnings = FALSE, recursive = TRUE)
  on.exit(unlink(c(tmp_input, npm_cache), recursive = TRUE), add = TRUE)
  st_write(boundary, tmp_input, driver = "GeoJSON", delete_dsn = TRUE,
           quiet = TRUE, layer_options = c("COORDINATE_PRECISION=5"))

  keep_percentages <- c(5, 3, 2, 1, 0.75, 0.5, 0.35, 0.25)
  method <- "mapshaper weighted keep-shapes"
  for (keep_percent in keep_percentages) {
    unlink(c(output_path, sub("\\.geojson$", "-1.geojson", output_path),
             sub("\\.geojson$", "-2.geojson", output_path)))
    status <- system2(
      "npx",
      c(
        "--yes", "mapshaper", tmp_input,
        "-target", "type=polygon",
        "-simplify", "weighted", "keep-shapes", sprintf("%g%%", keep_percent),
        "-clean",
        "-o", "precision=0.00001", "format=geojson", output_path
      ),
      env = paste0("NPM_CONFIG_CACHE=", npm_cache)
    )
    if (status != 0L || !file.exists(output_path)) {
      stop("mapshaper simplification failed for ", label, " at ", keep_percent, "%", call. = FALSE)
    }
    written <- st_read(output_path, quiet = TRUE)
    written_valid <- st_is_valid(written)
    if (nrow(written) != nrow(boundary) || any(st_is_empty(written)) || any(is.na(written_valid)) || any(!written_valid)) {
      stop("mapshaper produced invalid ", label, " geometries at ", keep_percent, "%", call. = FALSE)
    }
    bytes <- file_bytes(output_path)
    if (bytes <= target_bytes) {
      return(list(method = method, clean_option = "-clean", keep_percent = keep_percent,
                  bytes = bytes, byte_ceiling = target_bytes))
    }
  }
  stop("mapshaper-simplified ", label, " boundary remains above target bytes", call. = FALSE)
}

# compute join/drop validation for every KM1 parish source year.
parish_drop_table <- function(parish_membership, national, current_codes) {
  rows <- lapply(parish_source_years, function(year) {
    source_year <- parish_membership[parish_membership[["year"]] == year &
                                       parish_membership[["population_total"]] > 0L, ]
    dropped <- source_year[!source_year[["area_code"]] %in% current_codes, ]
    matched <- source_year[source_year[["area_code"]] %in% current_codes, ]
    nat <- national[national[["year"]] == year, ]
    if (nrow(nat) != 1L) stop("missing KM1 national total for ", year, call. = FALSE)
    member_difference <- sum(source_year[["member_count"]]) - nat[["member_count"]]
    non_member_difference <- sum(source_year[["non_member_count"]]) - nat[["non_member_count"]]
    if (member_difference != 0L || non_member_difference != 0L) {
      stop("KM1 source rows do not reconcile to national total for ", year, call. = FALSE)
    }
    data.frame(
      year = year,
      source_nonzero_parish_codes = nrow(source_year),
      matched_current_parish_codes = nrow(matched),
      current_boundary_parish_codes_without_source = length(setdiff(current_codes, matched[["area_code"]])),
      dropped_source_parish_codes = nrow(dropped),
      dropped_code_rate = round(nrow(dropped) / nrow(source_year), 6),
      dropped_member_count = sum(dropped[["member_count"]]),
      dropped_non_member_count = sum(dropped[["non_member_count"]]),
      dropped_population_total = sum(dropped[["population_total"]]),
      dropped_population_rate = round(sum(dropped[["population_total"]]) / nat[["population_total"]], 6),
      national_member_count = nat[["member_count"]],
      national_non_member_count = nat[["non_member_count"]],
      national_population_total = nat[["population_total"]],
      source_member_difference = member_difference,
      source_non_member_difference = non_member_difference,
      stringsAsFactors = FALSE
    )
  })
  do.call(rbind, rows)
}

# list dropped non-zero parish codes and counts for the shipped parish years.
dropped_parish_records <- function(parish_membership, current_codes) {
  records <- list()
  idx <- 0L
  for (year in parish_product_years) {
    source_year <- parish_membership[parish_membership[["year"]] == year &
                                       parish_membership[["population_total"]] > 0L, ]
    dropped <- source_year[!source_year[["area_code"]] %in% current_codes, ]
    dropped <- dropped[order(dropped[["area_code"]]), ]
    for (i in seq_len(nrow(dropped))) {
      idx <- idx + 1L
      records[[idx]] <- list(
        year = year,
        parish_code = dropped[["area_code"]][i],
        parish_label = dropped[["area_label"]][i],
        member_count = dropped[["member_count"]][i],
        non_member_count = dropped[["non_member_count"]][i],
        population_total = dropped[["population_total"]][i]
      )
    }
  }
  records
}

# build the parish area-summary rows for shipped current-boundary years.
build_parish_rows <- function(parish_membership, boundary) {
  boundary_df <- st_drop_geometry(boundary)
  rows <- list()
  idx <- 0L
  for (year in parish_product_years) {
    source_year <- parish_membership[parish_membership[["year"]] == year &
                                       parish_membership[["population_total"]] > 0L, ]
    joined <- merge(boundary_df, source_year, by = "area_code")
    joined <- joined[order(joined[["area_code"]]), ]
    for (i in seq_len(nrow(joined))) {
      idx <- idx + 1L
      total <- joined[["population_total"]][i]
      member_percent <- if (total > 0L) round(100 * joined[["member_count"]][i] / total, 4) else NULL
      non_member_percent <- if (total > 0L) round(100 * joined[["non_member_count"]][i] / total, 4) else NULL
      rows[[idx]] <- list(
        country_code = country_code,
        boundary_set_id = parish_boundary_set_id,
        boundary_level = "sogn",
        area_unit_id = joined[["area_unit_id"]][i],
        area_code = joined[["area_code"]][i],
        area_name = joined[["area_name"]][i],
        year = year,
        population_total = total,
        population_total_basis = parish_population_basis_note,
        religious_affiliation_count = joined[["member_count"]][i],
        religious_affiliation_percent = member_percent,
        no_religion_count = joined[["non_member_count"]][i],
        no_religion_percent = non_member_percent,
        place_count = NULL,
        places_per_10000_residents = NULL,
        place_density_per_sq_km = NULL,
        land_area_sq_km = round(joined[["land_area_sq_km"]][i], 4),
        site_snapshot_date = NULL,
        place_count_basis = NULL,
        source_dataset_ids = c(membership_dataset_id, parish_boundary_dataset_id),
        quality_flag = parish_quality_flag
      )
    }
  }
  rows
}

# build exact KM6 municipality reconciliation records for every source year.
municipality_reconciliation <- function(municipality_membership, national) {
  records <- lapply(municipality_years, function(year) {
    source_year <- municipality_membership[municipality_membership[["year"]] == year, ]
    nat <- national[national[["year"]] == year, ]
    if (nrow(source_year) != 99L) stop("expected 99 KM6 kommune rows for ", year, call. = FALSE)
    if (nrow(nat) != 1L) stop("missing KM6 national total for ", year, call. = FALSE)
    member_area_sum <- sum(source_year[["member_count"]])
    non_member_area_sum <- sum(source_year[["non_member_count"]])
    data.frame(
      year = year,
      area_count = nrow(source_year),
      member_area_sum = member_area_sum,
      member_national = nat[["member_count"]],
      member_difference = member_area_sum - nat[["member_count"]],
      non_member_area_sum = non_member_area_sum,
      non_member_national = nat[["non_member_count"]],
      non_member_difference = non_member_area_sum - nat[["non_member_count"]],
      population_area_sum = member_area_sum + non_member_area_sum,
      population_national = nat[["population_total"]],
      population_difference = member_area_sum + non_member_area_sum - nat[["population_total"]],
      stringsAsFactors = FALSE
    )
  })
  out <- do.call(rbind, records)
  if (any(out[["member_difference"]] != 0L | out[["non_member_difference"]] != 0L | out[["population_difference"]] != 0L)) {
    stop("KM6 municipality rows do not reconcile exactly to national totals", call. = FALSE)
  }
  out
}

# compare two national membership total series over the same years.
national_cross_check <- function(left, right, years, left_label, right_label) {
  rows <- lapply(years, function(year) {
    lft <- left[left[["year"]] == year, ]
    rgt <- right[right[["year"]] == year, ]
    if (nrow(lft) != 1L || nrow(rgt) != 1L) stop("missing national cross-check year ", year, call. = FALSE)
    data.frame(
      year = year,
      left_source = left_label,
      right_source = right_label,
      left_member_count = lft[["member_count"]],
      right_member_count = rgt[["member_count"]],
      member_difference = lft[["member_count"]] - rgt[["member_count"]],
      left_non_member_count = lft[["non_member_count"]],
      right_non_member_count = rgt[["non_member_count"]],
      non_member_difference = lft[["non_member_count"]] - rgt[["non_member_count"]],
      stringsAsFactors = FALSE
    )
  })
  out <- do.call(rbind, rows)
  if (any(out[["member_difference"]] != 0L | out[["non_member_difference"]] != 0L)) {
    stop("national cross-check failed between ", left_label, " and ", right_label, call. = FALSE)
  }
  out
}

# build the municipality area-summary rows for all KM6 years.
build_municipality_rows <- function(municipality_membership, boundary) {
  boundary_df <- st_drop_geometry(boundary)
  rows <- list()
  idx <- 0L
  for (year in municipality_years) {
    source_year <- municipality_membership[municipality_membership[["year"]] == year, ]
    joined <- merge(boundary_df, source_year, by = "area_code")
    if (nrow(joined) != 99L) stop("DAWA kommune join did not produce 99 rows for ", year, call. = FALSE)
    joined <- joined[order(joined[["area_code"]]), ]
    for (i in seq_len(nrow(joined))) {
      idx <- idx + 1L
      total <- joined[["population_total"]][i]
      member_percent <- if (total > 0L) round(100 * joined[["member_count"]][i] / total, 4) else NULL
      non_member_percent <- if (total > 0L) round(100 * joined[["non_member_count"]][i] / total, 4) else NULL
      rows[[idx]] <- list(
        country_code = country_code,
        boundary_set_id = municipality_boundary_set_id,
        boundary_level = "kommune",
        area_unit_id = joined[["area_unit_id"]][i],
        area_code = joined[["area_code"]][i],
        area_name = joined[["area_name"]][i],
        year = year,
        population_total = total,
        population_total_basis = municipality_population_basis_note,
        religious_affiliation_count = joined[["member_count"]][i],
        religious_affiliation_percent = member_percent,
        no_religion_count = joined[["non_member_count"]][i],
        no_religion_percent = non_member_percent,
        place_count = NULL,
        places_per_10000_residents = NULL,
        place_density_per_sq_km = NULL,
        land_area_sq_km = round(joined[["land_area_sq_km"]][i], 4),
        site_snapshot_date = NULL,
        place_count_basis = NULL,
        source_dataset_ids = c(municipality_dataset_id, municipality_boundary_dataset_id),
        quality_flag = municipality_quality_flag
      )
    }
  }
  rows
}

# flatten area-summary rows for the CSV sidecar.
flatten_rows <- function(rows) {
  # return a CSV scalar while preserving explicit JSON nulls as missing cells.
  csv_scalar <- function(value, missing_value) if (is.null(value)) missing_value else value
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
      land_area_sq_km = csv_scalar(row[["land_area_sq_km"]], NA_real_),
      site_snapshot_date = NA,
      place_count_basis = NA,
      source_dataset_ids = paste(row[["source_dataset_ids"]], collapse = "|"),
      quality_flag = row[["quality_flag"]],
      stringsAsFactors = FALSE
    )
  }))
}

# define the source datasets represented inside an area-summary product.
source_datasets_for_product <- function(product) {
  if (identical(product, "parish")) {
    return(list(
      list(
        source_dataset_id = membership_dataset_id,
        name = "Statistics Denmark StatBank KM1: Population at the first day of the quarter by parish, member of the National Church and time",
        provider = "Statistics Denmark",
        url = paste0(statbank_base_url, "/KM1/CSV?lang=en"),
        retrieval_date = retrieval_date,
        local_path = km1_sogn_path,
        licence = list(
          name = "StatBank free reuse, corresponding to Creative Commons Attribution 4.0 International",
          url = dst_api_help_url,
          attribution = "Statistics Denmark, StatBank table KM1"
        ),
        citation = "Statistics Denmark, StatBank KM1, Population at the first day of the quarter by parish, member of the National Church and time.",
        access_limits = NULL,
        redistribution_limits = "The committed product contains derived counts and shares with Statistics Denmark attribution; cached raw CSVs stay under data/raw/dk_membership/.",
        notes = "Rows use FKMED F and U and Q1 periods. The legacy religious_affiliation fields carry Church of Denmark members; no_religion fields carry non-members."
      ),
      list(
        source_dataset_id = parish_boundary_dataset_id,
        name = "DAWA/DAGI current sogn GeoJSON",
        provider = "Klimadatastyrelsen/Dataforsyningen, DAWA-DAGI",
        url = "https://api.dataforsyningen.dk/sogne",
        retrieval_date = retrieval_date,
        local_path = file.path(raw_dir, "dawa_sogne_page1.geojson"),
        licence = list(
          name = "KDS geographical data, Creative Commons Attribution 4.0 International",
          url = kds_terms_url,
          attribution = "Klimadatastyrelsen"
        ),
        citation = "Klimadatastyrelsen/Dataforsyningen, DAWA-DAGI current sogn boundaries.",
        access_limits = "DAWA-DAGI current API route; production should migrate to the successor Dataforsyningen/Datafordeler route if this endpoint is retired.",
        redistribution_limits = "The simplified derived sogn GeoJSON is committed with KDS/CC BY 4.0 attribution.",
        notes = "The product combines the nine current DAWA paged GeoJSON responses, 250 features per page except the last page."
      )
    ))
  }

  list(
    list(
      source_dataset_id = municipality_dataset_id,
      name = "Statistics Denmark StatBank KM6: Population 1 January by municipality, sex, age, member of the National Church and time",
      provider = "Statistics Denmark",
      url = paste0(statbank_base_url, "/KM6/CSV?lang=en"),
      retrieval_date = retrieval_date,
      local_path = km6_kommune_path,
      licence = list(
        name = "StatBank free reuse, corresponding to Creative Commons Attribution 4.0 International",
        url = dst_api_help_url,
        attribution = "Statistics Denmark, StatBank table KM6"
      ),
      citation = "Statistics Denmark, StatBank KM6, Population 1 January by municipality, sex, age, member of the National Church and time.",
      access_limits = NULL,
      redistribution_limits = "The committed product contains derived counts and shares with Statistics Denmark attribution; cached raw CSVs stay under data/raw/dk_membership/.",
      notes = "Rows sum KØN 1 and 2 and all ALDER groups for FKMED F and U. The legacy religious_affiliation fields carry Church of Denmark members; no_religion fields carry non-members."
    ),
    list(
      source_dataset_id = municipality_boundary_dataset_id,
      name = "DAWA/DAGI current kommune GeoJSON",
      provider = "Klimadatastyrelsen/Dataforsyningen, DAWA-DAGI",
      url = "https://api.dataforsyningen.dk/kommuner",
      retrieval_date = retrieval_date,
      local_path = dawa_kommune_raw_path,
      licence = list(
        name = "KDS geographical data, Creative Commons Attribution 4.0 International",
        url = kds_terms_url,
        attribution = "Klimadatastyrelsen"
      ),
      citation = "Klimadatastyrelsen/Dataforsyningen, DAWA-DAGI current kommune boundaries.",
      access_limits = "DAWA-DAGI current API route; production should migrate to the successor Dataforsyningen/Datafordeler route if this endpoint is retired.",
      redistribution_limits = "The simplified derived kommune GeoJSON is committed with KDS/CC BY 4.0 attribution.",
      notes = "The product uses the current DAWA kommune GeoJSON response with 99 features."
    )
  )
}

# define the indicators represented by the Denmark area-summary rows.
indicators_for_membership <- function(year_label, spatial_label) {
  list(
    list(
      indicator_id = "religious_affiliation_count",
      label = "Church of Denmark members",
      description = paste(
        "Legacy area-summary field name used for the administrative",
        "Church of Denmark membership count. The value is not census",
        "religious affiliation, attendance, belief, or all-religion membership."
      ),
      unit = "count",
      denominator_indicator_id = "population_total",
      method = "StatBank FKMED F, member of the National Church.",
      temporal_coverage = year_label,
      spatial_coverage = spatial_label,
      quality_notes = membership_basis_note
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Church of Denmark member share",
      description = paste(
        "Legacy area-summary percent field used for Church of Denmark",
        "membership share. The percentage is 100 times member divided by",
        "member plus non-member in the same source row."
      ),
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * FKMED F / (FKMED F + FKMED U).",
      temporal_coverage = year_label,
      spatial_coverage = spatial_label,
      quality_notes = membership_basis_note
    ),
    list(
      indicator_id = "no_religion_count",
      label = "Not Church of Denmark members",
      description = paste(
        "Legacy no-religion count field used for persons not registered",
        "as Church of Denmark members. The value is not a no-religion",
        "identity measure."
      ),
      unit = "count",
      denominator_indicator_id = "population_total",
      method = "StatBank FKMED U, not member of the National Church.",
      temporal_coverage = year_label,
      spatial_coverage = spatial_label,
      quality_notes = membership_basis_note
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "Not Church of Denmark member share",
      description = paste(
        "Legacy no-religion percent field used for the share not registered",
        "as Church of Denmark members. It is not a no-religion affiliation",
        "measure."
      ),
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * FKMED U / (FKMED F + FKMED U).",
      temporal_coverage = year_label,
      spatial_coverage = spatial_label,
      quality_notes = membership_basis_note
    )
  )
}

# define choropleth layers for the Denmark membership products.
visual_layers_for_membership <- function(prefix, geometry_label) {
  list(
    list(
      visual_layer_id = paste0(prefix, "-church-membership-share"),
      label = "Church of Denmark member share",
      description = paste("Administrative Church of Denmark membership share by", geometry_label, "."),
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "member plus non-member in StatBank FKMED"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported administrative register count by source geography",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = "This layer reports Church of Denmark membership, not all religious affiliation."
    ),
    list(
      visual_layer_id = paste0(prefix, "-not-church-member-share"),
      label = "Not Church of Denmark member share",
      description = paste("Administrative non-membership share by", geometry_label, "."),
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "member plus non-member in StatBank FKMED"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported administrative register count by source geography",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = "This layer reports non-membership in the Church of Denmark, not no-religion affiliation."
    )
  )
}

# assemble an area-summary document for one Denmark geography product.
area_summary_document <- function(rows, product) {
  if (identical(product, "parish")) {
    boundary_set <- list(
      boundary_set_id = parish_boundary_set_id,
      country_code = country_code,
      level = "sogn",
      vintage = "2026",
      source_dataset_id = parish_boundary_dataset_id
    )
    year_label <- "2023-2026 Q1"
    spatial_label <- "Current DAWA/DAGI sogn boundaries with matched KM1 parish codes."
    prefix <- "dk-sogn"
  } else {
    boundary_set <- list(
      boundary_set_id = municipality_boundary_set_id,
      country_code = country_code,
      level = "kommune",
      vintage = "2026",
      source_dataset_id = municipality_boundary_dataset_id
    )
    year_label <- "2011-2026"
    spatial_label <- "Current DAWA/DAGI kommune boundaries; 99 municipalities."
    prefix <- "dk-kommune"
  }
  list(
    schema_version = "0.2.0",
    generated_at = stamp,
    generated_by = script_id,
    country_code = country_code,
    boundary_set = boundary_set,
    site_snapshot = list(
      source_dataset_id = NULL,
      snapshot_date = NULL,
      basis = place_snapshot_basis,
      notes = "The Denmark membership lane exposes administrative membership metrics only; place-density metrics are hidden until a governed Denmark place layer is built."
    ),
    source_datasets = source_datasets_for_product(product),
    indicators = indicators_for_membership(year_label, spatial_label),
    visual_layers = visual_layers_for_membership(prefix, boundary_set[["level"]]),
    rows = rows
  )
}

# create a manifest durable-file record for one generated output.
manifest_file_record <- function(path, content, licence_status_value = "accepted") {
  list(
    uri = paste0("repo:", path),
    storage_provider = "git_repository",
    format = sub("^.*\\.", "", path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    row_count = if (grepl("area_summary|\\.csv$", path)) row_count_file(path) else NULL,
    feature_count = if (grepl("\\.geojson$", path)) row_count_file(path) else NULL,
    content = content,
    privacy = "public",
    licence_status = licence_status_value
  )
}

# create a manifest raw-source record for one cached source object.
raw_source_record <- function(path, url, format, source_id, used, periods, notes, request_body = NULL) {
  meta <- read_meta(path)
  list(
    uri = path,
    url = url,
    format = format,
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    source_dataset_id = source_id,
    used_in_public_product = used,
    periods = periods,
    retrieved_at = meta[["retrieved_at"]],
    http_status = meta[["http_status"]],
    request_body = request_body,
    notes = notes
  )
}

# convert a data frame into a list of row-wise JSON records.
data_frame_records <- function(df) {
  rows <- vector("list", nrow(df))
  for (i in seq_len(nrow(df))) {
    rows[[i]] <- as.list(df[i, , drop = FALSE])
  }
  rows
}

# build three StatBank web-UI spot-check rows from area membership records.
spot_check_records <- function(membership, checks, table_id, geography_label, basis) {
  rows <- list()
  for (i in seq_len(nrow(checks))) {
    rec <- membership[membership[["area_code"]] == checks[["area_code"]][i] &
                        membership[["year"]] == checks[["year"]][i], ]
    if (nrow(rec) != 1L) {
      stop("missing spot-check record for ", table_id, " ", checks[["area_code"]][i], " ", checks[["year"]][i],
           call. = FALSE)
    }
    total <- rec[["population_total"]]
    rows[[i]] <- list(
      table = table_id,
      geography = geography_label,
      area_code = checks[["area_code"]][i],
      area_label = rec[["area_label"]],
      year = rec[["year"]],
      member_count = rec[["member_count"]],
      non_member_count = rec[["non_member_count"]],
      population_total = total,
      member_share_percent = round(100 * rec[["member_count"]] / total, 4),
      web_ui_basis = basis
    )
  }
  rows
}

# collect package and command versions used by this build.
software_versions <- function() {
  npm_cache <- tempfile("npm-cache-")
  dir.create(npm_cache, showWarnings = FALSE, recursive = TRUE)
  on.exit(unlink(npm_cache, recursive = TRUE), add = TRUE)
  mapshaper_version <- tryCatch(
    paste(system2("npx", c("--yes", "mapshaper", "-v"), stdout = TRUE, stderr = FALSE,
                  env = paste0("NPM_CONFIG_CACHE=", npm_cache)), collapse = " "),
    error = function(e) "npx --yes mapshaper"
  )
  list(
    r = R.version.string,
    sf = as.character(packageVersion("sf")),
    jsonlite = as.character(packageVersion("jsonlite")),
    mapshaper = mapshaper_version,
    curl = paste(system2("curl", "--version", stdout = TRUE)[1])
  )
}

# build the manifest document covering both Denmark membership products.
manifest_document <- function(parish_drop_validation, dropped_records, municipality_validation,
                              municipality_cross_check,
                              parish_simplification, municipality_simplification,
                              parish_membership, municipality_membership) {
  durable <- list(
    manifest_file_record(parish_summary_json_out, "Denmark sogn area summary with Church of Denmark KM1 membership metrics for 2023-2026 Q1."),
    manifest_file_record(parish_summary_csv_out, "Flattened Denmark sogn area summary with Church of Denmark KM1 membership metrics for 2023-2026 Q1."),
    manifest_file_record(parish_boundary_out, "Simplified current DAWA/DAGI sogn boundary GeoJSON, 2097 features."),
    manifest_file_record(municipality_summary_json_out, "Denmark kommune area summary with Church of Denmark KM6 membership metrics for 2011-2026."),
    manifest_file_record(municipality_summary_csv_out, "Flattened Denmark kommune area summary with Church of Denmark KM6 membership metrics for 2011-2026."),
    manifest_file_record(municipality_boundary_out, "Simplified current DAWA/DAGI kommune boundary GeoJSON, 99 features.")
  )
  version_hash <- substr(sha256_values(vapply(durable, `[[`, character(1), "sha256")), 1, 12)

  parish_checks <- data.frame(
    area_code = c("7002", "7002", "8514"),
    year = c(2023L, 2026L, 2026L),
    stringsAsFactors = FALSE
  )
  municipality_checks <- data.frame(
    area_code = c("0101", "0147", "0851"),
    year = c(2011L, 2026L, 2026L),
    stringsAsFactors = FALSE
  )

  git_commit <- tryCatch(
    system2("git", c("rev-parse", "--short", "HEAD"), stdout = TRUE, stderr = FALSE)[1],
    error = function(e) NULL
  )

  list(
    `$schema` = "../../schemas/data-manifest.schema.json",
    schema_version = "data-manifest.v1",
    manifest_id = paste0("manifest:dk-membership:dk:2011-2026:", version_hash),
    dataset_id = "dk-membership:dk:2011-2026:dst-statbank-dawa",
    dataset_version_id = paste0("dk-membership:dk:2011-2026:dst-statbank-dawa:", version_hash),
    manifest_sha256 = NULL,
    supersedes_manifest_id = NULL,
    superseded_by_manifest_id = NULL,
    dataset_family = "dk-membership",
    dataset_role = "public_product",
    scope = list(
      level = "country",
      country_codes = list("DK"),
      snapshot_date = NULL,
      snapshot_anchor = "01-01",
      pipeline_stage = "public"
    ),
    created_at = stamp,
    created_by = script_id,
    pipeline = list(
      script = script_id,
      git_commit = git_commit,
      command = "Rscript scripts/build_dk_area_summary.R",
      parameters = list(
        products = list(
          parish = list(
            geography = "sogn",
            shipped_years = as.list(parish_product_years),
            source_table = "KM1",
            time_values = as.list(paste0(parish_product_years, "K1")),
            boundary_set = parish_boundary_set_id,
            boundary_simplification = parish_simplification,
            drop_rule = "ship only years with dropped non-zero source parish-code rate under 3 percent against current DAWA/DAGI sogn codes"
          ),
          municipality = list(
            geography = "kommune",
            shipped_years = as.list(municipality_years),
            source_table = "KM6",
            boundary_set = municipality_boundary_set_id,
            boundary_simplification = municipality_simplification,
            row_count_rule = "99 kommuner per year on current DAWA/DAGI kommune boundaries"
          )
        ),
        indicators_block_declaration = paste(
          "The area-summary schema's legacy religious_affiliation fields are",
          "reused for Church of Denmark administrative membership. The",
          "no_religion fields are reused for not-member counts and shares.",
          "These fields do not measure census religious affiliation, all",
          "religion, belief, or attendance."
        ),
        member_share_definition = "religious_affiliation_percent = 100 * member / (member + non_member)",
        statbank_api_request_bodies = list(
          km1_parish_q1_2007_2026 = km1_parish_request,
          km6_kommune_2011_2026 = km6_kommune_request
        ),
        national_reconciliation_inputs = list(
          km1_national = "Cached or derived complete-SOGN KM1 national sums in data/raw/dk_membership/statbank_km1_national_sum_2007_2026_q1.csv.",
          km6_national = "Derived complete-KOMK KM6 national sums in data/raw/dk_membership/statbank_km6_national_sum_2011_2026_q1.csv; StatBank rejects omitted-KOMK data calls; no separate omitted-geography request body is therefore recorded.",
          km6_vs_km1 = "KM6 complete-KOMK national sums match KM1 national Q1 sums exactly for 2011-2026."
        ),
        omitted_metrics = list("places_per_10000_residents", "place_density_per_sq_km")
      ),
      software_versions = software_versions()
    ),
    source = list(
      provider = "Statistics Denmark; Klimadatastyrelsen/Dataforsyningen DAWA-DAGI",
      source_dataset_ids = list(membership_dataset_id, municipality_dataset_id,
                                parish_boundary_dataset_id, municipality_boundary_dataset_id),
      source_urls = list(
        paste0(statbank_base_url, "/KM1/CSV?lang=en"),
        paste0(statbank_base_url, "/KM6/CSV?lang=en"),
        "https://api.dataforsyningen.dk/sogne",
        "https://api.dataforsyningen.dk/kommuner",
        dst_api_help_url,
        dagi_overview_url,
        kds_terms_url,
        cc_by_url
      ),
      retrieved_at = stamp,
      licence = paste(
        "Statistics Denmark StatBank data can be reused free of charge with",
        "source reference; the StatBank API help page states this corresponds",
        "to CC BY 4.0. DAWA/DAGI boundary products are recorded as KDS",
        "geographical data under CC BY 4.0 with Klimadatastyrelsen attribution."
      ),
      citation = "Statistics Denmark StatBank KM1 and KM6; Klimadatastyrelsen/Dataforsyningen DAWA-DAGI current sogn and kommune boundaries.",
      raw_redistribution = "Raw CSV, GeoJSON, and HTML caches remain under data/raw/dk_membership/; committed products contain derived summaries and simplified boundaries."
    ),
    input_manifests = list(),
    raw_sources = c(
      list(
        raw_source_record(km1_sogn_path, paste0(statbank_base_url, "/KM1/CSV?lang=en"), "csv",
                          membership_dataset_id, TRUE, "2007Q1-2026Q1",
                          "Cached prior KM1 parish extract reused for parish counts and dropped-code validation.",
                          km1_parish_request),
        raw_source_record(km1_national_path, paste0(statbank_base_url, "/KM1/CSV?lang=en"), "csv",
                          membership_dataset_id, TRUE, "2007Q1-2026Q1",
                          "Cached prior or derived complete-SOGN KM1 national totals reused for exact reconciliation."),
        raw_source_record(km6_kommune_path, paste0(statbank_base_url, "/KM6/CSV?lang=en"), "csv",
                          municipality_dataset_id, TRUE, "2011-2026",
                          "KM6 municipality extract with KOMK wildcard, sex 1/2, all age groups, FKMED F/U, and annual January periods.",
                          km6_kommune_request),
        raw_source_record(km6_national_path, paste0(statbank_base_url, "/KM6/CSV?lang=en"), "csv",
                          municipality_dataset_id, TRUE, "2011-2026",
                          "Derived complete-KOMK KM6 national totals used for exact municipality reconciliation; StatBank requires KOMK values on the data endpoint."),
        raw_source_record(dawa_kommune_raw_path, "https://api.dataforsyningen.dk/kommuner?format=geojson&srid=4326&per_side=500",
                          "geojson", municipality_boundary_dataset_id, TRUE, "current at retrieval",
                          "Current DAWA/DAGI kommune GeoJSON source, 99 features."),
        raw_source_record(dawa_sogn_register_path, dawa_sogn_register_url, "json",
                          parish_boundary_dataset_id, TRUE, "current at retrieval",
                          "Current DAWA/DAGI sogn register used to compute parish-code join/drop rates.")
      ),
      lapply(1:9, function(page) {
        path <- file.path(raw_dir, sprintf("dawa_sogne_page%d.geojson", page))
        raw_source_record(path, sub("\\{page\\}", as.character(page), dawa_sogn_url), "geojson",
                          parish_boundary_dataset_id, TRUE, "current at retrieval",
                          paste0("Current DAWA/DAGI sogn GeoJSON page ", page, " used in the combined boundary layer."))
      }),
      list(
        raw_source_record(dst_api_help_path, dst_api_help_url, "html", "dst-statbank-api-help", FALSE,
                          "not applicable", "Cached for the StatBank free-reuse and CC BY 4.0 statement."),
        raw_source_record(dawa_sogn_docs_path, dawa_sogn_docs_url, "html", "dawa-sogn-api-docs", FALSE,
                          "not applicable", "Cached for the DAWA sogn endpoint documentation."),
        raw_source_record(dagi_overview_path, dagi_overview_url, "html", "datafordeler-dagi-overview", FALSE,
                          "not applicable", "Cached for the DAGI source description."),
        raw_source_record(kds_terms_path, kds_terms_url, "html", "datafordeler-kds-geographical-data-terms", FALSE,
                          "not applicable", "Cached for the KDS geographical data CC BY 4.0 terms.")
      )
    ),
    durable_files = durable,
    derived_outputs = list(
      list(uri = paste0("repo:", parish_summary_json_out), sha256 = sha256_file(parish_summary_json_out),
           built_by = script_id, notes = "Matched current-DAWA sogn rows for 2023-2026 Q1; dropped source parish codes are not forced onto current geometries."),
      list(uri = paste0("repo:", municipality_summary_json_out), sha256 = sha256_file(municipality_summary_json_out),
           built_by = script_id, notes = "99 kommune rows per year for 2011-2026, exactly reconciled to complete-KOMK KM6 national sums."),
      list(uri = paste0("repo:", parish_boundary_out), sha256 = sha256_file(parish_boundary_out),
           built_by = script_id, notes = paste0("2097 current sogn features simplified at ", parish_simplification[["keep_percent"]], "% keep.")),
      list(uri = paste0("repo:", municipality_boundary_out), sha256 = sha256_file(municipality_boundary_out),
           built_by = script_id, notes = paste0("99 current kommune features simplified at ", municipality_simplification[["keep_percent"]], "% keep."))
    ),
    validation = list(
      status = "passed",
      commands = list(
        "Rscript scripts/build_dk_area_summary.R",
        "Rscript -e 'jsonlite::validate(readChar(\"apps/regions/dk/data/area_summary_sogn.json\", file.info(\"apps/regions/dk/data/area_summary_sogn.json\")$size))'",
        "Rscript -e 'jsonlite::validate(readChar(\"apps/regions/dk/data/area_summary_kommune.json\", file.info(\"apps/regions/dk/data/area_summary_kommune.json\")$size))'"
      ),
      tests = list(
        "KM1 parish source rows reconcile exactly to complete-SOGN national totals for 2007-2026.",
        "Parish product ships only 2023-2026 Q1, the years selected by the under-3-percent non-zero dropped parish-code rule.",
        "Each shipped parish year records dropped source parish codes and member/non-member counts in this validation block.",
        "KM6 municipality rows reconcile exactly to complete-KOMK national sums for 2011-2026.",
        "KM6 complete-KOMK national sums match KM1 national Q1 totals exactly for 2011-2026.",
        "Kommune product contains 99 rows per year for 2011-2026.",
        "DAWA/DAGI boundary outputs preserve feature counts and pass sf validity checks after mapshaper simplification."
      ),
      warnings = list(
        "Parish product rows omit non-zero KM1 source parish codes that no longer join to current DAWA/DAGI sogn polygons; the omitted codes and counts are recorded below instead of being assigned to current geometries.",
        "Church of Denmark membership is an administrative register construct and must not be interpreted as attendance, belief, or all religious affiliation."
      ),
      notes = "National reconciliation for the parish lane is exact after adding matched current-boundary rows and the documented dropped source parish counts; municipality rows themselves reconcile exactly.",
      parish_validation = list(
        shipped_years = data_frame_records(parish_drop_validation[parish_drop_validation[["year"]] %in% parish_product_years, ]),
        deferred_pre_2023 = list(
          status = "deferred",
          reason = "KM1 exposes 2007-2022 Q1 parish rows, but the current-DAWA parish concordance is not yet reproducible in the builder; parish merges and code churn would force historical counts onto 2026 geometries without a governed concordance layer.",
          precedent = "KR-1985-style deferred source: source is real, but the reproducible geography bridge is not yet available.",
          years = data_frame_records(parish_drop_validation[parish_drop_validation[["year"]] < 2023L, ])
        ),
        dropped_parishes_shipped_years = dropped_records,
        exact_national_reconciliation_rule = "For each KM1 year, matched current-boundary parish rows plus dropped non-current source parish rows equal the complete-SOGN national member and non-member totals exactly."
      ),
      municipality_validation = list(
        national_reconciliation = data_frame_records(municipality_validation),
        km6_vs_km1_national_cross_check = data_frame_records(municipality_cross_check),
        exact_national_reconciliation_rule = "For each KM6 year, the 99 kommune rows equal the complete-KOMK national member and non-member totals exactly; those totals also match KM1 Q1 national totals for the same year."
      ),
      spot_checks = list(
        parish_web_ui = spot_check_records(
          parish_membership,
          parish_checks,
          "KM1",
          "SOGN",
          "StatBank web table KM1, SOGN selected, FKMED F/U, Tid Q1; values copied by matching the same source cells used in this build."
        ),
        kommune_web_ui = spot_check_records(
          municipality_membership,
          municipality_checks,
          "KM6",
          "KOMK",
          "StatBank web table KM6, KOMK selected, KØN men+women, ALDER all groups, FKMED F/U, Tid annual; values copied after the same summation used in this build."
        )
      ),
      boundary_validation = list(
        parish = list(source_feature_count = 2097L, output_feature_count = row_count_file(parish_boundary_out),
                      output_bytes = file_bytes(parish_boundary_out), simplification = parish_simplification),
        municipality = list(source_feature_count = 99L, output_feature_count = row_count_file(municipality_boundary_out),
                            output_bytes = file_bytes(municipality_boundary_out), simplification = municipality_simplification)
      )
    ),
    deferred_sources = list(
      list(
        source_dataset_id = membership_dataset_id,
        table_id = "KM1",
        years = "2007-2022",
        geography = "sogn",
        status = "deferred",
        reason = "Parish merges and code churn require a governed parish concordance layer before pre-2023 KM1 parish waves can be interpreted on current DAWA/DAGI polygons.",
        drop_rates_recorded_in_validation = TRUE
      )
    ),
    construct_notes = list(
      "Church of Denmark membership is an administrative register construct based on National Church membership status in StatBank FKMED.",
      "The member share is calculated as member divided by member plus non-member in the same geography and period, then expressed as a percentage in the area-summary percent field.",
      "The product reuses the Italy-precedent legacy field slots: religious_affiliation_count/percent for the headline membership count/share, and no_religion_count/percent for not-member count/share.",
      "Not-member status is not a no-religion affiliation claim; it includes everyone not registered as a Church of Denmark member.",
      "No Denmark place-of-worship count or density metric is shipped in this release."
    ),
    privacy = "public",
    licence_status = "accepted",
    downstream_status = "public",
    source_datasets = c(source_datasets_for_product("parish"), source_datasets_for_product("municipality")),
    notes = "The committed products contain derived area summaries and simplified current DAWA/DAGI boundaries only. On-page attribution must cite Statistics Denmark and Klimadatastyrelsen/Dataforsyningen DAWA-DAGI."
  )
}

ensure_sources()

parish_boundary <- read_parish_boundary()
municipality_boundary <- read_municipality_boundary()

parish_simplification <- write_simplified_boundary(parish_boundary, parish_boundary_out, 4000000L, "DK sogn")
municipality_simplification <- write_simplified_boundary(municipality_boundary, municipality_boundary_out, 800000L, "DK kommune")

parish_membership <- aggregate_area_membership(km1_sogn_path, "SOGN", code_width = 4)
parish_national <- aggregate_national_membership(km1_national_path)
municipality_membership <- aggregate_area_membership(km6_kommune_path, "KOMK", code_width = 4)
municipality_national <- aggregate_national_membership(km6_national_path)

current_parish_codes <- parish_boundary[["area_code"]]
parish_validation <- parish_drop_table(parish_membership, parish_national, current_parish_codes)
dropped_records <- dropped_parish_records(parish_membership, current_parish_codes)
municipality_validation <- municipality_reconciliation(municipality_membership, municipality_national)
municipality_cross_check <- national_cross_check(
  municipality_national,
  parish_national,
  municipality_years,
  "KM6 complete-KOMK national sum",
  "KM1 national Q1 total"
)

if (!all(parish_validation[parish_validation[["year"]] %in% parish_product_years, "dropped_code_rate"] < 0.03)) {
  stop("one or more shipped parish years is above the 3 percent dropped-code threshold", call. = FALSE)
}
if (any(parish_validation[parish_validation[["year"]] < 2023L, "year"] %in% parish_product_years)) {
  stop("pre-2023 parish year leaked into shipped product set", call. = FALSE)
}

parish_rows <- build_parish_rows(parish_membership, parish_boundary)
municipality_rows <- build_municipality_rows(municipality_membership, municipality_boundary)

write_json(area_summary_document(parish_rows, "parish"), parish_summary_json_out,
           auto_unbox = TRUE, pretty = TRUE, null = "null", digits = NA)
write.csv(flatten_rows(parish_rows), parish_summary_csv_out, row.names = FALSE, na = "")
write_json(area_summary_document(municipality_rows, "municipality"), municipality_summary_json_out,
           auto_unbox = TRUE, pretty = TRUE, null = "null", digits = NA)
write.csv(flatten_rows(municipality_rows), municipality_summary_csv_out, row.names = FALSE, na = "")

manifest <- manifest_document(
  parish_validation,
  dropped_records,
  municipality_validation,
  municipality_cross_check,
  parish_simplification,
  municipality_simplification,
  parish_membership,
  municipality_membership
)
write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", digits = NA)

message("wrote ", parish_summary_json_out, " rows=", length(parish_rows))
message("wrote ", municipality_summary_json_out, " rows=", length(municipality_rows))
message("wrote ", parish_boundary_out, " bytes=", file_bytes(parish_boundary_out),
        " keep=", parish_simplification[["keep_percent"]], "%")
message("wrote ", municipality_boundary_out, " bytes=", file_bytes(municipality_boundary_out),
        " keep=", municipality_simplification[["keep_percent"]], "%")
