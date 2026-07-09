# build the germany kreis area-summary product from zensus 2011 and 2022.
# inputs: Zensusdatenbank table 1000X-1014 flat CSV export for GEOLK1,
# Zensusdatenbank table 1000A-1018 JSON output for GEOLK4, and BKG VG250
# annual Kreis boundary archives for 2011 and 2022.
# outputs: apps/regions/de/data/de_kreis_2011.geojson,
# apps/regions/de/data/de_kreis_2022.geojson,
# apps/regions/de/data/area_summary_kreis.{json,csv}, and
# docs/manifests/de-census-religion-2011-2022.json.
# run from the repo root: Rscript scripts/build_de_area_summary.R

suppressMessages({
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

raw_dir <- "data/raw/de_census"
de_dir <- "apps/regions/de/data"
manifest_dir <- "docs/manifests"
dir.create(raw_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(de_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- "2026-07-09"
script_id <- "scripts/build_de_area_summary.R"
country_code <- "DE"
years <- c(2011L, 2022L)

boundary_level <- "kreis"
boundary_set_id_2011 <- "de-kreis-2011-bkg-vg250"
boundary_set_id_2022 <- "de-kreis-2022-bkg-vg250"
boundary_dataset_id_2011 <- "bkg-vg250-krs-2011-01-01"
boundary_dataset_id_2022 <- "bkg-vg250-krs-2022-01-01"
census_dataset_id_2011 <- "zensus-2011-1000x-1014-religion-geolk1"
census_dataset_id_2022 <- "zensus-2022-1000a-1018-religion-geolk4"
category_dataset_id <- "zensus-relzg2-religion-legal-membership"

zensus_base <- "https://ergebnisse.zensus2022.de/proxy/api/rest"
zensus_2011_structure_url <- paste0(zensus_base, "/tables/1000X-1014/structure")
zensus_2011_flat_url <- paste0(zensus_base, "/tables/1000X-1014/download/ffcsv/de")
zensus_2022_geolk_url <- paste0(zensus_base, "/tables/1000A-1018/data?GEOLK4=%2A")
zensus_2022_default_url <- paste0(zensus_base, "/tables/1000A-1018/data")
relzg2_values_url <- paste0(zensus_base, "/variables/RELZG2/values")
relzg2_info_url <- paste0(zensus_base, "/variables/RELZG2/information")
geolk1_values_url <- paste0(zensus_base, "/variables/GEOLK1/values")
geolk4_values_url <- paste0(zensus_base, "/variables/GEOLK4/values")
zensus_about_url <- "https://ergebnisse.zensus2022.de/datenbank/online/"
dl_de_by_20_url <- "https://www.govdata.de/dl-de/by-2-0"

vg250_2011_url <- paste0(
  "https://daten.gdz.bkg.bund.de/produkte/vg/vg250_ebenen_0101/",
  "2011/vg250_01-01.utm32s.shape.ebenen.zip"
)
vg250_2022_url <- paste0(
  "https://daten.gdz.bkg.bund.de/produkte/vg/vg250_ebenen_0101/",
  "2022/vg250_01-01.utm32s.shape.ebenen.zip"
)
bkg_product_url <- paste0(
  "https://gdz.bkg.bund.de/index.php/default/digitale-geodaten/",
  "verwaltungsgebiete/verwaltungsgebiete-1-250-000-stand-01-01-vg250-01-01.html"
)

zensus_2011_structure_path <- file.path(raw_dir, "1000X-1014_structure.json")
zensus_2011_state_path <- file.path(raw_dir, "1000X-1014_geolk1_state.json")
zensus_2011_flat_zip_path <- file.path(raw_dir, "1000X-1014_geolk1_flat.zip")
zensus_2022_geolk_path <- file.path(raw_dir, "1000A-1018_geolk4_data.json")
zensus_2022_default_path <- file.path(raw_dir, "1000A-1018_default_data.json")
relzg2_values_path <- file.path(raw_dir, "RELZG2_values.json")
relzg2_info_path <- file.path(raw_dir, "RELZG2_information.json")
geolk1_values_path <- file.path(raw_dir, "GEOLK1_values.json")
geolk4_values_path <- file.path(raw_dir, "GEOLK4_values.json")
vg250_2011_path <- file.path(raw_dir, "vg250_2011_01-01_utm32s_shape_ebenen.zip")
vg250_2022_path <- file.path(raw_dir, "vg250_2022_01-01_utm32s_shape_ebenen.zip")

boundary_2011_out <- file.path(de_dir, "de_kreis_2011.geojson")
boundary_2022_out <- file.path(de_dir, "de_kreis_2022.geojson")
summary_json_out <- file.path(de_dir, "area_summary_kreis.json")
summary_csv_out <- file.path(de_dir, "area_summary_kreis.csv")
manifest_out <- file.path(manifest_dir, "de-census-religion-2011-2022.json")

licence_text <- paste(
  "Zensus religion data are from the Zensusdatenbank of the Statistical Offices",
  "of the Federation and the Länder, licensed under Data licence Germany -",
  "attribution - Version 2.0 (dl-de/by-2-0). BKG VG250 boundaries are used",
  "under dl-de/by-2-0 with attribution © GeoBasis-DE / BKG."
)

population_basis <- paste(
  "Zensus compact religion table total persons (Insgesamt) for the Kreis and",
  "wave. The religion variable RELZG2 records legal membership in a",
  "public-law religious society; it is not a belief or attendance measure."
)

residual_note <- paste(
  "RELZG2 has three compact categories: Evangelische Kirche",
  "(öffentlich-rechtlich), Römisch-katholische Kirche (öffentlich-rechtlich),",
  "and Sonstige, keine, ohne Angabe. The residual combines other, no",
  "public-law membership, and no response; no separate no-religion metric is",
  "fabricated."
)

category_map <- list(
  list(
    source_code = "REL-EV-OR",
    source_label = "Evangelische Kirche (öffentlich-rechtlich)",
    mapped_role = "religious_affiliation_count",
    notes = "Protestant public-law church membership; included in legal-membership affiliation."
  ),
  list(
    source_code = "REL-RK-OR",
    source_label = "Römisch-katholische Kirche (öffentlich-rechtlich)",
    mapped_role = "religious_affiliation_count",
    notes = "Roman Catholic public-law church membership; included in legal-membership affiliation."
  ),
  list(
    source_code = "REL-SONST-X",
    source_label = "Sonstige, keine, ohne Angabe",
    mapped_role = "residual_not_shipped_as_no_religion",
    notes = "Combined residual; not used as no religion because other public-law membership, no public-law membership, and no response are not separated."
  )
)

# stop early if an expected local source is absent after the fetch step.
require_file <- function(path) {
  if (!file.exists(path) || file.info(path)[["size"]] == 0) {
    stop("missing required source: ", path, call. = FALSE)
  }
}

# compute a sha-256 digest for a local file.
sha256_file <- function(path) {
  unname(tools::sha256sum(path))
}

# return the byte size for manifest and validation records.
file_bytes <- function(path) {
  as.integer(unname(file.info(path)[["size"]]))
}

# return the current Git commit used to build the manifest.
current_git_commit <- function() {
  result <- tryCatch(
    system2("git", c("rev-parse", "--short", "HEAD"), stdout = TRUE, stderr = TRUE),
    error = function(e) character()
  )
  commit <- if (length(result)) result[[1]] else NA_character_
  if (is.na(commit) || !grepl("^[a-f0-9]{7,40}$", commit)) {
    stop("could not resolve a valid Git commit for the manifest", call. = FALSE)
  }
  commit
}

# return NULL for scalar values that should serialise as JSON null.
null_if_na <- function(value) {
  if (length(value) == 0L || is.na(value) || !is.finite(value)) return(NULL)
  value
}

# count rows or features for generated CSV, JSON, and GeoJSON outputs.
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

# test whether an existing ZIP cache can be opened before trusting it.
valid_zip <- function(path) {
  if (!grepl("\\.zip$", path)) return(TRUE)
  if (!file.exists(path) || file.info(path)[["size"]] == 0) return(FALSE)
  result <- try(utils::unzip(path, list = TRUE), silent = TRUE)
  !inherits(result, "try-error")
}

# download a source file with curl, preserving partially completed archives.
download_file <- function(url, path, resume = TRUE) {
  if (valid_zip(path) && file.exists(path) && file.info(path)[["size"]] > 0) return(invisible(path))
  tmp <- paste0(path, ".part")
  if (file.exists(path) && !valid_zip(path) && !file.exists(tmp)) file.rename(path, tmp)
  args <- c("-L", "--fail", "--show-error", "--silent")
  if (resume && file.exists(tmp)) args <- c(args, "--continue-at", "-")
  args <- c(args, "-o", tmp, url)
  status <- system2("curl", args)
  if (status != 0L) stop("curl failed for ", url, call. = FALSE)
  file.rename(tmp, path)
  invisible(path)
}

# build the Zensus table-state JSON that selects the 2011 Kreis variable.
prepare_2011_state <- function() {
  download_file(zensus_2011_structure_url, zensus_2011_structure_path, resume = FALSE)
  if (file.exists(zensus_2011_state_path) && file.info(zensus_2011_state_path)[["size"]] > 0) {
    return(invisible(zensus_2011_state_path))
  }
  structure <- fromJSON(zensus_2011_structure_path, simplifyVector = FALSE)
  state <- structure[["initialState"]]
  # 1000X-1014 exposes GEOLK1 as block v5 in the current web-app structure.
  state[["tableStructure"]][["colTitle"]][[2]][["blockCode"]] <- "v5"
  write_json(state, zensus_2011_state_path, auto_unbox = TRUE, pretty = TRUE, null = "null")
  invisible(zensus_2011_state_path)
}

# download the slow but official flat-CSV export for 2011 Kreis rows.
download_2011_flat_export <- function() {
  prepare_2011_state()
  if (file.exists(zensus_2011_flat_zip_path) && file.info(zensus_2011_flat_zip_path)[["size"]] > 0) {
    return(invisible(zensus_2011_flat_zip_path))
  }
  tmp <- paste0(zensus_2011_flat_zip_path, ".part")
  args <- c(
    "--max-time", "180",
    "-L", "--fail", "--show-error", "--silent",
    "-X", "POST",
    "-H", "Content-Type: application/json",
    "--data-binary", paste0("@", zensus_2011_state_path),
    "-o", tmp,
    zensus_2011_flat_url
  )
  status <- system2("curl", args)
  if (status != 0L) stop("Zensus 2011 flat export failed", call. = FALSE)
  file.rename(tmp, zensus_2011_flat_zip_path)
  invisible(zensus_2011_flat_zip_path)
}

# fetch all raw sources needed by the build.
fetch_sources <- function() {
  download_2011_flat_export()
  download_file(zensus_2022_geolk_url, zensus_2022_geolk_path, resume = FALSE)
  download_file(zensus_2022_default_url, zensus_2022_default_path, resume = FALSE)
  download_file(relzg2_values_url, relzg2_values_path, resume = FALSE)
  download_file(relzg2_info_url, relzg2_info_path, resume = FALSE)
  download_file(geolk1_values_url, geolk1_values_path, resume = FALSE)
  download_file(geolk4_values_url, geolk4_values_path, resume = FALSE)
  download_file(vg250_2011_url, vg250_2011_path)
  download_file(vg250_2022_url, vg250_2022_path)
}

# read a Zensus variable-values file into a code-to-label lookup.
read_value_lookup <- function(path) {
  values <- fromJSON(path, simplifyVector = FALSE)
  out <- vapply(values, function(item) item[["name"]][["de"]], character(1))
  names(out) <- vapply(values, function(item) item[["code"]], character(1))
  out
}

# normalise the compact religion category code for the flat 2011 CSV.
religion_code <- function(code) {
  if (is.na(code) || code == "") return("%TOTAL%")
  code
}

# parse the 2011 flat CSV export into one row per Kreis plus national totals.
read_2011_census <- function(zip_path) {
  exdir <- tempfile("zensus2011-flat-")
  dir.create(exdir)
  utils::unzip(zip_path, exdir = exdir)
  csv_path <- list.files(exdir, pattern = "_de_flat\\.csv$", full.names = TRUE)
  if (length(csv_path) != 1L) stop("expected one 2011 flat CSV", call. = FALSE)
  raw <- read.csv2(csv_path, stringsAsFactors = FALSE, check.names = FALSE)
  counts <- raw[raw[["value_unit"]] == "Anzahl", , drop = FALSE]
  counts[["religion_code"]] <- vapply(counts[["2_variable_attribute_code"]], religion_code, character(1))

  area_counts <- counts[counts[["1_variable_code"]] == "GEOLK1", , drop = FALSE]
  national_counts <- counts[counts[["1_variable_code"]] == "GEODL1" &
                              counts[["1_variable_attribute_code"]] == "DG", , drop = FALSE]
  if (length(unique(area_counts[["1_variable_attribute_code"]])) != 412L) {
    stop("expected 412 GEOLK1 rows for Zensus 2011", call. = FALSE)
  }
  if (nrow(national_counts) != 4L) stop("expected four 2011 national category rows", call. = FALSE)

  area_codes <- sort(unique(area_counts[["1_variable_attribute_code"]]))
  rows <- do.call(rbind, lapply(area_codes, function(code) {
    subset <- area_counts[area_counts[["1_variable_attribute_code"]] == code, , drop = FALSE]
    values <- setNames(subset[["value"]], subset[["religion_code"]])
    data.frame(
      area_code = code,
      area_name = subset[["1_variable_attribute_label"]][[1]],
      total = as.integer(values[["%TOTAL%"]]),
      protestant = as.integer(values[["REL-EV-OR"]]),
      catholic = as.integer(values[["REL-RK-OR"]]),
      residual = as.integer(values[["REL-SONST-X"]]),
      stringsAsFactors = FALSE
    )
  }))
  national_values <- setNames(national_counts[["value"]], national_counts[["religion_code"]])
  national <- c(
    total = as.integer(national_values[["%TOTAL%"]]),
    protestant = as.integer(national_values[["REL-EV-OR"]]),
    catholic = as.integer(national_values[["REL-RK-OR"]]),
    residual = as.integer(national_values[["REL-SONST-X"]])
  )
  list(rows = rows, national = national)
}

# flatten one JSON-stat-like Zensus data cube into ordinary rows.
flatten_zensus_cube <- function(cube) {
  ids <- unlist(cube[["id"]])
  sizes <- as.integer(unlist(cube[["size"]]))
  categories <- lapply(ids, function(id) {
    index <- unlist(cube[["dimension"]][[id]][["category"]][["index"]])
    names(sort(index))
  })
  names(categories) <- ids
  values <- unlist(cube[["value"]])
  statuses <- unlist(cube[["status"]])

  records <- vector("list", length(values))
  for (i in seq_along(values)) {
    rem <- i - 1L
    coords <- integer(length(sizes))
    for (d in seq(from = length(sizes), to = 1L)) {
      coords[[d]] <- rem %% sizes[[d]]
      rem <- rem %/% sizes[[d]]
    }
    rec <- as.list(vapply(seq_along(ids), function(d) categories[[d]][[coords[[d]] + 1L]], character(1)))
    names(rec) <- ids
    rec[["value"]] <- values[[i]]
    rec[["status"]] <- if (length(statuses) >= i) statuses[[i]] else NA_character_
    records[[i]] <- rec
  }
  do.call(rbind.data.frame, c(records, stringsAsFactors = FALSE))
}

# parse the 2022 Zensus JSON output into one row per Kreis plus national totals.
read_2022_census <- function(path, geolk4_values_path) {
  parsed <- fromJSON(path, simplifyVector = FALSE)
  cubes <- if (!is.null(parsed[["data"]])) parsed[["data"]] else parsed
  area_cube <- cubes[[which(vapply(cubes, function(cube) "GEOLK4" %in% unlist(cube[["id"]]), logical(1)))[[1]]]]
  national_cube <- cubes[[which(vapply(cubes, function(cube) "GEODL1" %in% unlist(cube[["id"]]), logical(1)))[[1]]]]
  area <- flatten_zensus_cube(area_cube)
  national <- flatten_zensus_cube(national_cube)
  lookup <- read_value_lookup(geolk4_values_path)

  counts <- area[area[["STAG"]] == "2022-05-15" &
                   area[["content"]] == "PRS018$ID0006", , drop = FALSE]
  if (length(unique(counts[["GEOLK4"]])) != 400L) stop("expected 400 GEOLK4 rows for Zensus 2022", call. = FALSE)
  area_codes <- sort(unique(counts[["GEOLK4"]]))
  rows <- do.call(rbind, lapply(area_codes, function(code) {
    subset <- counts[counts[["GEOLK4"]] == code, , drop = FALSE]
    values <- setNames(as.integer(round(subset[["value"]])), subset[["RELZG2"]])
    data.frame(
      area_code = code,
      area_name = unname(lookup[[code]]),
      total = values[["%TOTAL%"]],
      protestant = values[["REL-EV-OR"]],
      catholic = values[["REL-RK-OR"]],
      residual = values[["REL-SONST-X"]],
      stringsAsFactors = FALSE
    )
  }))

  national_counts <- national[national[["STAG"]] == "2022-05-15" &
                                national[["content"]] == "PRS001$ID0004", , drop = FALSE]
  national_values <- setNames(as.integer(round(national_counts[["value"]])), national_counts[["RELZG2"]])
  national_out <- c(
    total = national_values[["%TOTAL%"]],
    protestant = national_values[["REL-EV-OR"]],
    catholic = national_values[["REL-RK-OR"]],
    residual = national_values[["REL-SONST-X"]]
  )
  list(rows = rows, national = national_out)
}

# extract the VG250 Kreis shapefile from an annual archive and read it.
read_vg250_kreis <- function(zip_path, boundary_set_id, census_rows, use_mv_reform = FALSE) {
  exdir <- tempfile("vg250-")
  dir.create(exdir)
  utils::unzip(zip_path, exdir = exdir)
  candidates <- list.files(
    exdir,
    pattern = "vg250_krs\\.shp$",
    recursive = TRUE,
    full.names = TRUE,
    ignore.case = TRUE
  )
  if (!use_mv_reform) candidates <- candidates[!grepl("mv_kreisreform", candidates)]
  if (length(candidates) == 0L) stop("no VG250 Kreis shapefile found in ", zip_path, call. = FALSE)
  shp <- candidates[[1]]
  boundary <- st_read(shp, quiet = TRUE, options = "ENCODING=latin1")
  boundary <- st_make_valid(boundary)
  fields <- names(boundary)
  code_field <- intersect(c("AGS", "RS", "ARS"), fields)[[1]]
  name_field <- intersect(c("GEN", "NAME"), fields)[[1]]
  type_field <- intersect(c("BEZ", "BEZ_KRS"), fields)
  type_field <- if (length(type_field)) type_field[[1]] else NA_character_

  boundary[["area_code"]] <- substr(as.character(boundary[[code_field]]), 1L, 5L)
  source_attrs <- data.frame(
    area_code = boundary[["area_code"]],
    vg250_name = as.character(boundary[[name_field]]),
    vg250_type = if (!is.na(type_field)) as.character(boundary[[type_field]]) else NA_character_,
    stringsAsFactors = FALSE
  )
  source_attrs <- source_attrs[!duplicated(source_attrs[["area_code"]]), , drop = FALSE]
  if (any(duplicated(boundary[["area_code"]]))) {
    boundary <- aggregate(
      boundary[, c("area_code")],
      by = list(area_code = boundary[["area_code"]]),
      FUN = function(x) x[[1]],
      do_union = TRUE
    )
  }
  boundary <- boundary[order(boundary[["area_code"]]), ]
  match_idx <- match(boundary[["area_code"]], census_rows[["area_code"]])
  if (any(is.na(match_idx))) {
    missing <- boundary[["area_code"]][is.na(match_idx)]
    stop("VG250 Kreis features absent from census rows: ", paste(missing, collapse = ", "), call. = FALSE)
  }
  extra <- setdiff(census_rows[["area_code"]], boundary[["area_code"]])
  if (length(extra) > 0L) stop("census Kreis rows absent from VG250: ", paste(extra, collapse = ", "), call. = FALSE)

  boundary_metric <- st_transform(boundary, 3035)
  boundary[["area_name"]] <- census_rows[["area_name"]][match_idx]
  boundary[["area_unit_id"]] <- paste0(boundary_set_id, ":", boundary[["area_code"]])
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- boundary_level
  source_idx <- match(boundary[["area_code"]], source_attrs[["area_code"]])
  boundary[["vg250_name"]] <- source_attrs[["vg250_name"]][source_idx]
  boundary[["vg250_type"]] <- source_attrs[["vg250_type"]][source_idx]
  boundary[["land_area_sq_km"]] <- as.numeric(st_area(boundary_metric)) / 1e6
  boundary
}

# write a simplified GeoJSON with mapshaper's clean and precision ladder.
write_simplified_boundary <- function(boundary, output_path, field_names, max_bytes = 1500000L) {
  candidate <- st_transform(boundary[, field_names], 4326)
  ladder <- c(40, 30, 20, 15, 10, 7.5, 5, 3, 2, 1)
  attr(ladder, "mapshaper_method") <- "dp"
  simplification <- mapshaper_simplify_to_cap(
    candidate,
    output_path,
    max_bytes = max_bytes,
    keep_percentages = ladder,
    clean_option = NULL
  )
  simplification[["keep"]] <- sprintf("%g%%", simplification[["keep_percent"]])
  simplification[["mapshaper_output"]] <- NA_character_
  simplification
}

# derive legal-membership affiliation counts and shares from compact categories.
derive_metrics <- function(rows) {
  affiliation <- rows[["protestant"]] + rows[["catholic"]]
  data.frame(
    rows,
    religious_affiliation_count = affiliation,
    religious_affiliation_percent = round(100 * affiliation / rows[["total"]], 2),
    stringsAsFactors = FALSE
  )
}

# create one area-summary row for a Kreis and wave.
build_area_row <- function(row, year, boundary_set_id, boundary_dataset_id, census_dataset_id, land_area_sq_km) {
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = paste0(boundary_set_id, ":", row[["area_code"]]),
    area_code = as.character(row[["area_code"]]),
    area_name = row[["area_name"]],
    year = year,
    population_total = null_if_na(as.integer(row[["total"]])),
    population_total_basis = population_basis,
    religious_affiliation_count = null_if_na(as.integer(row[["religious_affiliation_count"]])),
    religious_affiliation_percent = null_if_na(row[["religious_affiliation_percent"]]),
    no_religion_count = NULL,
    no_religion_percent = NULL,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(land_area_sq_km, 2),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = c(census_dataset_id, boundary_dataset_id),
    quality_flag = paste(
      "legal_membership_public_law_religious_society",
      "compact_residual_other_none_no_response",
      "no_religion_not_separable",
      "period_boundary_vintage",
      sep = ";"
    )
  )
}

# flatten area-summary rows for the CSV sibling.
flatten_rows <- function(rows) {
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
      no_religion_count = NA_integer_,
      no_religion_percent = NA_real_,
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

# create the source-dataset records for the area-summary document.
source_datasets <- function() {
  list(
    list(
      source_dataset_id = census_dataset_id_2011,
      name = "Zensus 2011 table 1000X-1014: Personen: Religion, GEOLK1 Kreis export",
      provider = "Statistische Ämter des Bundes und der Länder",
      url = zensus_2011_flat_url,
      retrieval_date = retrieval_date,
      local_path = zensus_2011_flat_zip_path,
      licence = list(
        name = "Datenlizenz Deutschland - Namensnennung - Version 2.0",
        url = dl_de_by_20_url,
        attribution = "© Statistische Ämter des Bundes und der Länder"
      ),
      citation = "Statistische Ämter des Bundes und der Länder, Zensus 2011, table 1000X-1014 Personen: Religion.",
      access_limits = NULL,
      redistribution_limits = "The raw flat export is cached under data/raw/de_census and not committed; the derived product carries attribution.",
      notes = paste(
        "GEOLK1 is Landkreise und kreisfreie Städte on the Zensus 2011 reference date, 2011-05-09.",
        residual_note
      )
    ),
    list(
      source_dataset_id = census_dataset_id_2022,
      name = "Zensus 2022 table 1000A-1018: Personen: Religion, GEOLK4 Kreis JSON output",
      provider = "Statistische Ämter des Bundes und der Länder",
      url = zensus_2022_geolk_url,
      retrieval_date = retrieval_date,
      local_path = zensus_2022_geolk_path,
      licence = list(
        name = "Datenlizenz Deutschland - Namensnennung - Version 2.0",
        url = dl_de_by_20_url,
        attribution = "© Statistische Ämter des Bundes und der Länder"
      ),
      citation = "Statistische Ämter des Bundes und der Länder, Zensus 2022, table 1000A-1018 Personen: Religion.",
      access_limits = NULL,
      redistribution_limits = "The raw JSON response is cached under data/raw/de_census and not committed; the derived product carries attribution.",
      notes = paste(
        "GEOLK4 is Landkreise u. krsfr. Städte on the Zensus 2022 reference date, 2022-05-15.",
        residual_note
      )
    ),
    list(
      source_dataset_id = boundary_dataset_id_2011,
      name = "BKG VG250 Kreis boundaries, 1 January 2011",
      provider = "Bundesamt für Kartographie und Geodäsie (BKG)",
      url = vg250_2011_url,
      retrieval_date = retrieval_date,
      local_path = vg250_2011_path,
      licence = list(
        name = "Datenlizenz Deutschland - Namensnennung - Version 2.0",
        url = dl_de_by_20_url,
        attribution = "© GeoBasis-DE / BKG"
      ),
      citation = "Bundesamt für Kartographie und Geodäsie, VG250 administrative areas, Kreis layer, 1 January 2011.",
      access_limits = NULL,
      redistribution_limits = "The raw BKG archive is cached under data/raw/de_census and not committed; the simplified derived boundary carries BKG attribution.",
      notes = "The archive also includes an mv_kreisreform folder for the September 2011 Mecklenburg-Vorpommern reform. The build uses the main de1101 Kreis layer because the Zensus 2011 table is dated 9 May 2011."
    ),
    list(
      source_dataset_id = boundary_dataset_id_2022,
      name = "BKG VG250 Kreis boundaries, 1 January 2022",
      provider = "Bundesamt für Kartographie und Geodäsie (BKG)",
      url = vg250_2022_url,
      retrieval_date = retrieval_date,
      local_path = vg250_2022_path,
      licence = list(
        name = "Datenlizenz Deutschland - Namensnennung - Version 2.0",
        url = dl_de_by_20_url,
        attribution = "© GeoBasis-DE / BKG"
      ),
      citation = "Bundesamt für Kartographie und Geodäsie, VG250 administrative areas, Kreis layer, 1 January 2022.",
      access_limits = NULL,
      redistribution_limits = "The raw BKG archive is cached under data/raw/de_census and not committed; the simplified derived boundary carries BKG attribution.",
      notes = "The 1 January 2022 VG250 Kreis code set matches the Zensus 2022 GEOLK4 Kreis code set for 15 May 2022."
    )
  )
}

# create indicator metadata for the Kreis product.
indicators_for_kreis <- function() {
  denominator_note <- paste(population_basis, residual_note)
  list(
    list(
      indicator_id = "population_total",
      label = "Zensus compact religion table total",
      description = "Total persons in the compact Zensus RELZG2 religion table for the Kreis and wave.",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "Reported Insgesamt count in table 1000X-1014 for 2011 and table 1000A-1018 for 2022.",
      temporal_coverage = "2011, 2022",
      spatial_coverage = "Germany Kreise on each wave's Zensus geography vintage.",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Public-law church membership %",
      description = "Share of the compact table total legally belonging to the Protestant public-law church or Roman Catholic public-law church.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * (REL-EV-OR + REL-RK-OR) / Insgesamt.",
      temporal_coverage = "2011, 2022",
      spatial_coverage = "Germany Kreise on each wave's Zensus geography vintage.",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "No public-law religious membership %",
      description = "Not published in this compact two-wave product because the residual combines other, none, and no response.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "Not calculated; REL-SONST-X is not a no-religion category.",
      temporal_coverage = "2011, 2022",
      spatial_coverage = "Germany Kreise on each wave's Zensus geography vintage.",
      quality_notes = residual_note
    )
  )
}

# define the choropleth layer exposed by the shared region map.
visual_layers_for_kreis <- function() {
  list(
    list(
      visual_layer_id = "de-kreis-public-law-church-membership",
      label = "Public-law church membership %",
      description = "Zensus 2011 and 2022 legal membership in Protestant or Roman Catholic public-law churches by Kreis.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "Zensus compact RELZG2 table total"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = residual_note
    )
  )
}

# assemble the area-summary document.
area_summary_document <- function(rows) {
  list(
    schema_version = "area-summary.v1",
    generated_at = stamp,
    generated_by = script_id,
    country_code = country_code,
    boundary_set = list(
      boundary_set_id = "de-kreis-period-bkg-vg250",
      country_code = country_code,
      level = boundary_level,
      vintage = "2011 and 2022 period Kreis vintages",
      source_dataset_id = paste(boundary_dataset_id_2011, boundary_dataset_id_2022, sep = "|")
    ),
    site_snapshot = list(
      source_dataset_id = NULL,
      snapshot_date = NULL,
      basis = "no governed Germany OpenStreetMap place-of-worship snapshot is included in this country data-map release",
      notes = "The Germany product exposes the Zensus legal-membership census metric only; place-density metrics are hidden until a governed Germany place layer is built."
    ),
    source_datasets = source_datasets(),
    indicators = indicators_for_kreis(),
    visual_layers = visual_layers_for_kreis(),
    rows = rows
  )
}

# create a manifest durable-file record for one generated output.
manifest_file_record <- function(path, content, licence_status = "accepted") {
  is_geo <- grepl("\\.geojson$", path)
  list(
    uri = paste0("repo:", path),
    storage_provider = "other",
    format = sub("^.*\\.", "", path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    row_count = if (is_geo) NULL else row_count_file(path),
    feature_count = if (is_geo) row_count_file(path) else NULL,
    content = content,
    privacy = "public",
    licence_status = licence_status
  )
}

# create a manifest raw-source record for one local cached source.
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

# compare Kreis category sums with national totals and return residuals.
reconcile_to_national <- function(rows, national, year) {
  fields <- c("total", "protestant", "catholic", "residual")
  lapply(fields, function(field) {
    area_sum <- sum(rows[[field]])
    national_total <- as.integer(national[[field]])
    list(
      year = year,
      metric = field,
      area_sum = area_sum,
      national_total = national_total,
      difference = area_sum - national_total
    )
  })
}

# summarise within-area total-vs-category residuals from the source counts.
category_sum_residual <- function(rows) {
  diffs <- rows[["total"]] - (rows[["protestant"]] + rows[["catholic"]] + rows[["residual"]])
  list(
    max_abs_difference = as.integer(max(abs(diffs))),
    nonzero_area_count = as.integer(sum(diffs != 0L))
  )
}

fetch_sources()

required_sources <- c(
  zensus_2011_flat_zip_path, zensus_2022_geolk_path, relzg2_values_path,
  relzg2_info_path, geolk1_values_path, geolk4_values_path,
  vg250_2011_path, vg250_2022_path
)
invisible(lapply(required_sources, require_file))

census_2011 <- read_2011_census(zensus_2011_flat_zip_path)
census_2022 <- read_2022_census(zensus_2022_geolk_path, geolk4_values_path)

metrics_2011 <- derive_metrics(census_2011[["rows"]])
metrics_2022 <- derive_metrics(census_2022[["rows"]])
recon_2011 <- reconcile_to_national(census_2011[["rows"]], census_2011[["national"]], 2011L)
recon_2022 <- reconcile_to_national(census_2022[["rows"]], census_2022[["national"]], 2022L)
residuals_2011 <- category_sum_residual(census_2011[["rows"]])
residuals_2022 <- category_sum_residual(census_2022[["rows"]])

boundary_2011 <- read_vg250_kreis(vg250_2011_path, boundary_set_id_2011, metrics_2011)
boundary_2022 <- read_vg250_kreis(vg250_2022_path, boundary_set_id_2022, metrics_2022)

boundary_fields <- c(
  "area_code", "area_name", "area_unit_id", "boundary_set_id",
  "boundary_level", "vg250_name", "vg250_type", "land_area_sq_km"
)
boundary_write_2011 <- write_simplified_boundary(boundary_2011, boundary_2011_out, boundary_fields)
boundary_write_2022 <- write_simplified_boundary(boundary_2022, boundary_2022_out, boundary_fields)

if (row_count_file(boundary_2011_out) != nrow(boundary_2011)) {
  stop("2011 boundary feature count changed during simplification", call. = FALSE)
}
if (row_count_file(boundary_2022_out) != nrow(boundary_2022)) {
  stop("2022 boundary feature count changed during simplification", call. = FALSE)
}

metrics_2011 <- metrics_2011[order(metrics_2011[["area_code"]]), ]
metrics_2022 <- metrics_2022[order(metrics_2022[["area_code"]]), ]
boundary_2011 <- boundary_2011[order(boundary_2011[["area_code"]]), ]
boundary_2022 <- boundary_2022[order(boundary_2022[["area_code"]]), ]

rows <- c(
  lapply(seq_len(nrow(metrics_2011)), function(i) {
    build_area_row(
      metrics_2011[i, , drop = FALSE], 2011L, boundary_set_id_2011,
      boundary_dataset_id_2011, census_dataset_id_2011,
      boundary_2011[["land_area_sq_km"]][[i]]
    )
  }),
  lapply(seq_len(nrow(metrics_2022)), function(i) {
    build_area_row(
      metrics_2022[i, , drop = FALSE], 2022L, boundary_set_id_2022,
      boundary_dataset_id_2022, census_dataset_id_2022,
      boundary_2022[["land_area_sq_km"]][[i]]
    )
  })
)

write_json(area_summary_document(rows), summary_json_out, auto_unbox = TRUE,
           pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

validation_checks <- c(
  "Zensus 2011 table 1000X-1014 uses GEOLK1, Landkreise und kreisfreie Städte, on the 9 May 2011 territory; 412 Kreis rows ship.",
  "Zensus 2022 table 1000A-1018 uses GEOLK4, Landkreise u. krsfr. Städte (Stand 15.05.22), on the 15 May 2022 territory; 400 Kreis rows ship.",
  "The two waves use separate period boundary sets rather than a cross-vintage concordance. This avoids aggregating or interpolating Mecklenburg-Vorpommern's post-census 2011 reform, Goettingen's 2016 merger, Eisenach's 2021 change, and other Kreis-set differences.",
  "The BKG 2011 archive includes an mv_kreisreform folder, but the build uses the main de1101 Kreis layer because the 2011 Zensus table is dated 9 May 2011, before the September 2011 Mecklenburg-Vorpommern reform.",
  "Hard reconciliation against the published Deutschland rows fails because Deutschland totals include persons assignable to no Kreis, including German personnel stationed abroad, and because the Zensus results database documents subpopulation non-additivity. The tested regional rows use content PRS018, and the tested Deutschland rows use content PRS001; Zensus metadata entries label both content codes as Persons.",
  sprintf("2011 GEOLK1 regional sums minus the published Deutschland PRS001 rows: total %+d, protestant %+d, catholic %+d, residual %+d.", recon_2011[[1]][["difference"]], recon_2011[[2]][["difference"]], recon_2011[[3]][["difference"]], recon_2011[[4]][["difference"]]),
  sprintf("2022 GEOLK4 regional sums minus the published Deutschland PRS001 rows: total %+d, protestant %+d, catholic %+d, residual %+d.", recon_2022[[1]][["difference"]], recon_2022[[2]][["difference"]], recon_2022[[3]][["difference"]], recon_2022[[4]][["difference"]]),
  "The Protestant and Catholic regional sums match the Deutschland rows within ±17 persons, which supports category integrity.",
  sprintf("Within-area category sums also show small source residuals: max absolute total-minus-category difference is %d persons across %d 2011 Kreis rows and %d persons across %d 2022 Kreis rows.", residuals_2011[["max_abs_difference"]], residuals_2011[["nonzero_area_count"]], residuals_2022[["max_abs_difference"]], residuals_2022[["nonzero_area_count"]]),
  "Religious affiliation is REL-EV-OR plus REL-RK-OR. No-religion metrics are null because REL-SONST-X combines other, no public-law membership, and no response.",
  sprintf("The 2011 simplified Kreis boundary GeoJSON writes to %d bytes after mapshaper -clean -simplify dp %s keep-shapes -o precision=0.00001.", boundary_write_2011[["bytes"]], boundary_write_2011[["keep"]]),
  sprintf("The 2022 simplified Kreis boundary GeoJSON writes to %d bytes after mapshaper -clean -simplify dp %s keep-shapes -o precision=0.00001.", boundary_write_2022[["bytes"]], boundary_write_2022[["keep"]])
)

validation_notes <- paste(
  paste(validation_checks, collapse = "\n"),
  paste0(
    "\n2011 national totals: total=", census_2011[["national"]][["total"]],
    "; protestant=", census_2011[["national"]][["protestant"]],
    "; catholic=", census_2011[["national"]][["catholic"]],
    "; residual=", census_2011[["national"]][["residual"]], "."
  ),
  paste0(
    "\n2022 national totals: total=", census_2022[["national"]][["total"]],
    "; protestant=", census_2022[["national"]][["protestant"]],
    "; catholic=", census_2022[["national"]][["catholic"]],
    "; residual=", census_2022[["national"]][["residual"]], "."
  )
)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:de-census-religion:de:2011-2022:zensus",
  dataset_id = "de-census-religion:de:2011-2022:zensus",
  dataset_version_id = paste0("de-census-religion:de:2011-2022:zensus:", substr(sha256_file(summary_json_out), 1, 12)),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "de-census-religion",
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
    git_commit = current_git_commit(),
    command = paste("Rscript", script_id),
    parameters = list(
      waves_built = "2011, 2022",
      geography = "Kreis; each wave uses its own Zensus geography vintage",
      boundary_sets = paste(boundary_set_id_2011, boundary_set_id_2022, sep = ", "),
      boundary_simplification = "mapshaper -clean -simplify dp <ladder> keep-shapes -o precision=0.00001; max 1.5 MB",
      denominator = "Zensus compact RELZG2 table total persons (Insgesamt)",
      omitted_metrics = c("no_religion_percent", "religious_change", "places_per_10000_residents", "place_density_per_sq_km"),
      reconciliation = "published Deutschland rows do not exactly equal Kreis sums because Deutschland totals include persons assignable to no Kreis and the Zensus results database documents subpopulation non-additivity"
    ),
    software_versions = list(
      r = paste(R.version[["major"]], R.version[["minor"]], sep = "."),
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite"))
    )
  ),
  source = list(
    provider = "Statistische Ämter des Bundes und der Länder; Bundesamt für Kartographie und Geodäsie (BKG)",
    source_dataset_ids = c(census_dataset_id_2011, census_dataset_id_2022, boundary_dataset_id_2011, boundary_dataset_id_2022),
    source_urls = c(
      zensus_about_url, zensus_2011_structure_url, zensus_2011_flat_url,
      zensus_2022_geolk_url, relzg2_values_url, relzg2_info_url,
      vg250_2011_url, vg250_2022_url, bkg_product_url, dl_de_by_20_url
    ),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = licence_text,
    citation = "Zensusdatenbank tables 1000X-1014 and 1000A-1018; BKG VG250 annual Kreis boundary archives."
  ),
  input_manifests = list(),
  durable_files = list(
    manifest_file_record(summary_json_out, "Germany Kreis area summary with Zensus 2011 and 2022 legal public-law church membership metrics."),
    manifest_file_record(summary_csv_out, "Flattened Germany Kreis area summary with Zensus 2011 and 2022 legal public-law church membership metrics."),
    manifest_file_record(boundary_2011_out, "Simplified BKG VG250 2011 Kreis boundary GeoJSON.", "accepted"),
    manifest_file_record(boundary_2022_out, "Simplified BKG VG250 2022 Kreis boundary GeoJSON.", "accepted")
  ),
  partitions = list(
    list(
      partition_id = "country:DE",
      partition_type = "country",
      country_code = country_code,
      file_uri = paste0("repo:", summary_json_out),
      sha256 = sha256_file(summary_json_out),
      row_count = row_count_file(summary_json_out),
      feature_count = NULL
    )
  ),
  stats = list(
    waves_built = 2L,
    rows_2011 = nrow(metrics_2011),
    rows_2022 = nrow(metrics_2022),
    boundary_features_2011 = row_count_file(boundary_2011_out),
    boundary_features_2022 = row_count_file(boundary_2022_out),
    boundary_geojson_bytes_2011 = file_bytes(boundary_2011_out),
    boundary_geojson_bytes_2022 = file_bytes(boundary_2022_out),
    national_total_2011 = census_2011[["national"]][["total"]],
    national_total_2022 = census_2022[["national"]][["total"]],
    religious_affiliation_national_percent_2011 = round(100 * (census_2011[["national"]][["protestant"]] + census_2011[["national"]][["catholic"]]) / census_2011[["national"]][["total"]], 2),
    religious_affiliation_national_percent_2022 = round(100 * (census_2022[["national"]][["protestant"]] + census_2022[["national"]][["catholic"]]) / census_2022[["national"]][["total"]], 2)
  ),
  local_cache_hint = "Raw Zensus responses and BKG VG250 archives are cached under data/raw/de_census/. The directory is git-ignored and should be promoted to project-controlled raw storage before reuse outside this build.",
  validation = list(
    status = "passed_with_warnings",
    commands = list("Rscript scripts/build_de_area_summary.R"),
    warnings = c(
      "Hard national reconciliation against the published Deutschland rows fails for both waves because Deutschland totals include persons assignable to no Kreis, including German personnel stationed abroad, and because the Zensus results database documents subpopulation non-additivity.",
      "The build preserves source counts and does not distribute the national residual across Kreise."
    ),
    notes = validation_notes
  ),
  privacy = "public",
  licence_status = "accepted",
  downstream_status = "public",
  notes = paste(
    validation_notes,
    "Category mapping table:",
    paste(vapply(category_map, function(item) {
      paste(item[["source_code"]], item[["source_label"]], "=>", item[["mapped_role"]])
    }, character(1)), collapse = "; ")
  )
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)

cat("wrote ", summary_json_out, " rows=", row_count_file(summary_json_out), "\n", sep = "")
cat("wrote ", boundary_2011_out, " features=", row_count_file(boundary_2011_out),
    " bytes=", file_bytes(boundary_2011_out), "\n", sep = "")
cat("wrote ", boundary_2022_out, " features=", row_count_file(boundary_2022_out),
    " bytes=", file_bytes(boundary_2022_out), "\n", sep = "")
cat("wrote ", manifest_out, "\n", sep = "")
