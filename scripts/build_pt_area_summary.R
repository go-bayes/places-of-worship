# build the portugal municipality area-summary product from ine census religion data.
# inputs: ine api json/xml exports for 2011 and 2021 religion indicators,
# plus caop 2021 administrative-area shapefile archives under data/raw/pt_census/.
# outputs: apps/regions/pt/data/pt_municipality_caop2021.geojson,
# apps/regions/pt/data/area_summary_municipality.{json,csv}, and
# docs/manifests/pt-census-religion-2011-2021.json.
# run from the repo root: Rscript scripts/build_pt_area_summary.R

suppressMessages({
  library(jsonlite)
  library(sf)
})

raw_dir <- "data/raw/pt_census"
pt_dir <- "apps/regions/pt/data"
manifest_dir <- "docs/manifests"
dir.create(pt_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- "2026-07-09"
script_id <- "scripts/build_pt_area_summary.R"
country_code <- "PT"
boundary_set_id <- "pt-municipality-caop2021"
boundary_dataset_id <- "dgt-caop-2021"
census_2011_dataset_id <- "ine-censos-2011-indicator-0006396"
census_2021_dataset_id <- "ine-censos-2021-indicator-0011644"

indicator_2011 <- "0006396"
indicator_2021 <- "0011644"
ine_terms_url <- "https://www.ine.pt/xportal/xmain?xpid=INE&xpgid=ine_cont_inst&INST=3585857"
ine_api_docs_url <- "https://www.ine.pt/xportal/xmain?xpid=INE&xpgid=ine_api_v2"
caop_page_url <- "https://www.dgterritorio.gov.pt/atividades/cartografia/cartografia-tematica/caop"
dgt_open_data_url <- "https://www.dgterritorio.gov.pt/dados-abertos"

# build the public ine indicator page url for a source table.
indicator_url <- function(indicator_id) {
  paste0(
    "https://www.ine.pt/xportal/xmain?xpid=INE&xpgid=ine_indicadores",
    "&indOcorrCod=", indicator_id, "&contexto=bd&selTab=tab2"
  )
}

# build the ine api data url for a source table and geography selector.
api_data_url <- function(indicator_id, dim2) {
  paste0(
    "https://www.ine.pt/ine/json_indicador/pindica.jsp?op=2",
    "&varcd=", indicator_id,
    "&DIM1=T&DIM2=", dim2,
    "&lang=PT"
  )
}

# build the ine api metadata url for a source table.
api_meta_url <- function(indicator_id) {
  paste0("https://www.ine.pt/ine/json_indicador/pindicaMeta.jsp?varcd=", indicator_id, "&lang=PT")
}

# build the ine xml catalogue url for a source table.
api_catalog_url <- function(indicator_id) {
  paste0("https://www.ine.pt/ine/xml_indic.jsp?opc=1&varcd=", indicator_id, "&lang=PT")
}

summary_json_out <- file.path(pt_dir, "area_summary_municipality.json")
summary_csv_out <- file.path(pt_dir, "area_summary_municipality.csv")
boundary_out <- file.path(pt_dir, "pt_municipality_caop2021.geojson")
manifest_out <- file.path(manifest_dir, "pt-census-religion-2011-2021.json")

required_sources <- list(
  list(
    path = file.path(raw_dir, "ine_0011644_municipality.json"),
    format = "json",
    url = api_data_url(indicator_2021, "lvl@5"),
    source_dataset_id = census_2021_dataset_id,
    notes = "INE API data extract for indicator 0011644, municipality level, Census 2021, NUTS 2013 geography; used for 2021 municipality rows."
  ),
  list(
    path = file.path(raw_dir, "ine_0011644_national.json"),
    format = "json",
    url = api_data_url(indicator_2021, "PT"),
    source_dataset_id = census_2021_dataset_id,
    notes = "INE API data extract for indicator 0011644, Portugal row; used for national reconciliation."
  ),
  list(
    path = file.path(raw_dir, "ine_0011644_meta.json"),
    format = "json",
    url = api_meta_url(indicator_2021),
    source_dataset_id = census_2021_dataset_id,
    notes = "INE API metadata for indicator 0011644."
  ),
  list(
    path = file.path(raw_dir, "ine_0011644_catalog.xml"),
    format = "xml",
    url = api_catalog_url(indicator_2021),
    source_dataset_id = census_2021_dataset_id,
    notes = "INE catalogue record for indicator 0011644."
  ),
  list(
    path = file.path(raw_dir, "ine_0006396_municipality.json"),
    format = "json",
    url = api_data_url(indicator_2011, "lvl@5"),
    source_dataset_id = census_2011_dataset_id,
    notes = "INE API data extract for indicator 0006396, municipality level, Census 2011; used for 2011 municipality rows."
  ),
  list(
    path = file.path(raw_dir, "ine_0006396_national.json"),
    format = "json",
    url = api_data_url(indicator_2011, "PT"),
    source_dataset_id = census_2011_dataset_id,
    notes = "INE API data extract for indicator 0006396, Portugal row; used for national reconciliation."
  ),
  list(
    path = file.path(raw_dir, "ine_0006396_meta.json"),
    format = "json",
    url = api_meta_url(indicator_2011),
    source_dataset_id = census_2011_dataset_id,
    notes = "INE API metadata for indicator 0006396."
  ),
  list(
    path = file.path(raw_dir, "ine_0006396_catalog.xml"),
    format = "xml",
    url = api_catalog_url(indicator_2011),
    source_dataset_id = census_2011_dataset_id,
    notes = "INE catalogue record for indicator 0006396."
  ),
  list(
    path = file.path(raw_dir, "caop2021_continente_aad.zip"),
    format = "zip",
    url = "https://www.dgterritorio.gov.pt/sites/default/files/ficheiros-cartografia/Cont_AAD_CAOP2021.zip",
    source_dataset_id = boundary_dataset_id,
    notes = "DGT CAOP 2021 administrative-area polygon archive for mainland Portugal."
  ),
  list(
    path = file.path(raw_dir, "caop2021_madeira_aad.zip"),
    format = "zip",
    url = "https://www.dgterritorio.gov.pt/sites/default/files/ficheiros-cartografia/ArqMadeira_AAD_CAOP2021.zip",
    source_dataset_id = boundary_dataset_id,
    notes = "DGT CAOP 2021 administrative-area polygon archive for Madeira."
  ),
  list(
    path = file.path(raw_dir, "caop2021_acores_oriental_aad.zip"),
    format = "zip",
    url = "https://www.dgterritorio.gov.pt/sites/default/files/ficheiros-cartografia/ArqAcores_GOriental_AAd_CAOP2021.zip",
    source_dataset_id = boundary_dataset_id,
    notes = "DGT CAOP 2021 administrative-area polygon archive for the Azores oriental group."
  ),
  list(
    path = file.path(raw_dir, "caop2021_acores_central_aad.zip"),
    format = "zip",
    url = "https://www.dgterritorio.gov.pt/sites/default/files/ficheiros-cartografia/ArqAcores_GCentral_AAd_CAOP2021.zip",
    source_dataset_id = boundary_dataset_id,
    notes = "DGT CAOP 2021 administrative-area polygon archive for the Azores central group."
  ),
  list(
    path = file.path(raw_dir, "caop2021_acores_ocidental_aad.zip"),
    format = "zip",
    url = "https://www.dgterritorio.gov.pt/sites/default/files/ficheiros-cartografia/ArqAcores_GOcidental_AAd_CAOP2021.zip",
    source_dataset_id = boundary_dataset_id,
    notes = "DGT CAOP 2021 administrative-area polygon archive for the Azores occidental group."
  ),
  list(
    path = file.path(raw_dir, "caop2021_metadata.pdf"),
    format = "pdf",
    url = "https://www.dgterritorio.gov.pt/sites/default/files/ficheiros-cartografia/Metadados_CAOP2021.pdf",
    source_dataset_id = boundary_dataset_id,
    notes = "DGT CAOP 2021 metadata PDF."
  )
)

# stop early when an expected raw source has not been cached.
require_file <- function(path) {
  if (!file.exists(path)) stop("missing required source: ", path, call. = FALSE)
}

invisible(lapply(vapply(required_sources, `[[`, character(1), "path"), require_file))

# compute the sha-256 digest for a local file.
sha256_file <- function(path) {
  unname(tools::sha256sum(path))
}

# return file size in bytes for manifest records.
file_bytes <- function(path) {
  as.integer(unname(file.info(path)[["size"]]))
}

# parse an ine api json file and return the first indicator object.
read_ine_object <- function(path) {
  parsed <- fromJSON(path, simplifyVector = FALSE)
  if (!is.list(parsed) || length(parsed) != 1L) {
    stop("unexpected INE JSON wrapper in ", path, call. = FALSE)
  }
  parsed[[1]]
}

# convert one ine api extract to a rectangular table for the requested year.
read_ine_year_rows <- function(path, year) {
  object <- read_ine_object(path)
  year_key <- as.character(year)
  records <- object[["Dados"]][[year_key]]
  if (is.null(records) || !length(records)) {
    stop("missing INE data rows for ", year, " in ", path, call. = FALSE)
  }
  rows <- do.call(rbind, lapply(records, function(record) {
    data.frame(
      indicator_code = object[["IndicadorCod"]],
      indicator_title = object[["IndicadorDsg"]],
      extraction_time = object[["DataExtracao"]],
      last_update = object[["DataUltimoAtualizacao"]],
      year = as.integer(year),
      area_code = record[["geocod"]],
      area_name = record[["geodsg"]],
      category_code = record[["dim_3"]],
      category_name = record[["dim_3_t"]],
      value = as.numeric(record[["valor"]]),
      stringsAsFactors = FALSE
    )
  }))
  rows
}

# return the source dataset id for one census year.
census_dataset_for_year <- function(year) {
  if (year == 2011L) return(census_2011_dataset_id)
  if (year == 2021L) return(census_2021_dataset_id)
  stop("unsupported year: ", year, call. = FALSE)
}

wave_specs <- list(
  `2011` = list(
    year = 2011L,
    dataset_id = census_2011_dataset_id,
    indicator_code = indicator_2011,
    municipality_path = file.path(raw_dir, "ine_0006396_municipality.json"),
    national_path = file.path(raw_dir, "ine_0006396_national.json"),
    total_category = "T",
    no_response_category = "9",
    no_religion_category = "8",
    affiliated_categories = as.character(1:7),
    denominator_note = "population resident aged 15 and over with a stated religion response: INE indicator 0006396 Total minus Não resposta",
    denominator_formula = "Total - Não resposta",
    affiliated_formula = "Católica + Ortodoxa + Protestante + Outra cristã + Judaica + Muçulmana + Outra não cristã",
    no_religion_formula = "Sem religião",
    quality_flags = c(
      "universe_age15plus",
      "denominator_stated_response",
      "non_response_excluded",
      "category_detail_changes_across_waves"
    )
  ),
  `2021` = list(
    year = 2021L,
    dataset_id = census_2021_dataset_id,
    indicator_code = indicator_2021,
    municipality_path = file.path(raw_dir, "ine_0011644_municipality.json"),
    national_path = file.path(raw_dir, "ine_0011644_national.json"),
    total_category = "T",
    no_response_category = NULL,
    no_religion_category = "11",
    affiliated_categories = as.character(1:10),
    denominator_note = "population resident aged 15 and over with a stated religion response: INE indicator 0011644 Total; the API extract exposes no Não resposta category",
    denominator_formula = "Total",
    affiliated_formula = "Católica + Ortodoxa + Protestante/Evangélica + Testemunhas do Jeová + Outra cristã + Budista + Hindu + Judaica + Muçulmana + Outra não cristã",
    no_religion_formula = "Sem religião",
    quality_flags = c(
      "universe_age15plus",
      "denominator_stated_response",
      "source_no_non_response_category",
      "category_detail_changes_across_waves"
    )
  )
)

# return a single source count for one area/category combination.
lookup_category_value <- function(rows, area_code, category_code) {
  hit <- rows[rows[["area_code"]] == area_code & rows[["category_code"]] == category_code, ]
  if (nrow(hit) != 1L) {
    stop(
      sprintf("expected one row for area %s category %s; found %d", area_code, category_code, nrow(hit)),
      call. = FALSE
    )
  }
  hit[["value"]][[1]]
}

# validate source category accounting for one area or national table.
derive_counts_for_area <- function(rows, area_code, spec) {
  total <- lookup_category_value(rows, area_code, spec[["total_category"]])
  no_religion <- lookup_category_value(rows, area_code, spec[["no_religion_category"]])
  affiliated <- sum(vapply(spec[["affiliated_categories"]], function(category_code) {
    lookup_category_value(rows, area_code, category_code)
  }, numeric(1)))
  no_response <- if (is.null(spec[["no_response_category"]])) {
    0
  } else {
    lookup_category_value(rows, area_code, spec[["no_response_category"]])
  }
  denominator <- if (is.null(spec[["no_response_category"]])) total else total - no_response
  category_sum <- affiliated + no_religion
  if (!identical(as.numeric(denominator), as.numeric(category_sum))) {
    stop(
      sprintf(
        "category reconciliation failed for %s in %s: denominator %s vs category sum %s",
        area_code,
        spec[["year"]],
        denominator,
        category_sum
      ),
      call. = FALSE
    )
  }
  list(
    total_category_count = total,
    no_response_count = no_response,
    population_total = denominator,
    religious_affiliation_count = affiliated,
    no_religion_count = no_religion
  )
}

# summarise the category labels used by one wave for manifest notes.
category_label_summary <- function(rows, spec) {
  national <- rows[rows[["area_code"]] == "PT", ]
  labels <- national[match(
    c(spec[["affiliated_categories"]], spec[["no_religion_category"]], spec[["no_response_category"]]),
    national[["category_code"]]
  ), c("category_code", "category_name")]
  labels <- labels[!is.na(labels[["category_code"]]), ]
  paste(paste(labels[["category_code"]], labels[["category_name"]], sep = "="), collapse = "; ")
}

# create one schema-shaped area-summary row.
build_area_row <- function(area, spec, counts, boundary_lookup) {
  source <- counts[counts[["year"]] == spec[["year"]] & counts[["area_code"]] == area[["area_code"]], ]
  boundary <- boundary_lookup[boundary_lookup[["area_code"]] == area[["area_code"]], ]
  if (nrow(source) != 1L) {
    stop("missing count row for ", area[["area_code"]], " in ", spec[["year"]], call. = FALSE)
  }
  if (nrow(boundary) != 1L) {
    stop("missing boundary row for ", area[["area_code"]], call. = FALSE)
  }
  denominator <- source[["population_total"]][[1]]
  affiliation <- source[["religious_affiliation_count"]][[1]]
  no_religion <- source[["no_religion_count"]][[1]]
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = "municipality",
    area_unit_id = paste0(boundary_set_id, ":", area[["area_code"]]),
    area_code = area[["area_code"]],
    area_name = area[["area_name"]],
    year = spec[["year"]],
    population_total = as.integer(denominator),
    population_total_basis = spec[["denominator_note"]],
    religious_affiliation_count = as.integer(affiliation),
    religious_affiliation_percent = round(100 * affiliation / denominator, 2),
    no_religion_count = as.integer(no_religion),
    no_religion_percent = round(100 * no_religion / denominator, 2),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(boundary[["land_area_sq_km"]][[1]], 2),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = c(spec[["dataset_id"]], boundary_dataset_id),
    quality_flag = paste(unique(spec[["quality_flags"]]), collapse = ";")
  )
}

# flatten area-summary rows for the csv sibling.
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
      population_total = row[["population_total"]],
      population_total_basis = row[["population_total_basis"]],
      religious_affiliation_count = row[["religious_affiliation_count"]],
      religious_affiliation_percent = row[["religious_affiliation_percent"]],
      no_religion_count = row[["no_religion_count"]],
      no_religion_percent = row[["no_religion_percent"]],
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

# read one caop archive and place it in the common projected crs.
read_caop_archive <- function(path) {
  source <- st_read(paste0("/vsizip/", normalizePath(path)), quiet = TRUE, options = "ENCODING=UTF-8")
  source[["area_code"]] <- substr(as.character(source[["Dicofre"]]), 1, 4)
  source[["source_archive"]] <- basename(path)
  source <- st_transform(source, 3035)
  source[c("area_code", "Concelho", "Dicofre", "source_archive", "geometry")]
}

# dissolve caop parish-level polygons to municipality polygons.
build_boundary_product <- function(paths, areas, output_path) {
  raw_boundaries <- do.call(rbind, lapply(paths, read_caop_archive))
  raw_boundaries <- st_make_valid(raw_boundaries)
  boundary_codes <- sort(unique(raw_boundaries[["area_code"]]))
  census_codes <- sort(areas[["area_code"]])
  missing_boundary <- setdiff(census_codes, boundary_codes)
  extra_boundary <- setdiff(boundary_codes, census_codes)
  if (length(missing_boundary) || length(extra_boundary)) {
    stop(
      "CAOP/census municipality code mismatch; missing boundary: ",
      paste(missing_boundary, collapse = ", "),
      "; extra boundary: ",
      paste(extra_boundary, collapse = ", "),
      call. = FALSE
    )
  }

  area_names <- setNames(areas[["area_name"]], areas[["area_code"]])
  groups <- split(seq_len(nrow(raw_boundaries)), raw_boundaries[["area_code"]])
  dissolved <- do.call(rbind, lapply(names(groups), function(area_code) {
    index <- groups[[area_code]]
    piece <- raw_boundaries[index, ]
    geometry <- st_make_valid(st_union(st_geometry(piece)))
    st_sf(
      area_code = area_code,
      area_name = unname(area_names[[area_code]]),
      area_unit_id = paste0(boundary_set_id, ":", area_code),
      boundary_set_id = boundary_set_id,
      boundary_level = "municipality",
      source_freguesia_count = length(unique(piece[["Dicofre"]])),
      source_boundary_archives = paste(sort(unique(piece[["source_archive"]])), collapse = "|"),
      land_area_sq_km = as.numeric(st_area(geometry)) / 1e6,
      geometry = geometry
    )
  }))
  dissolved <- dissolved[order(dissolved[["area_code"]]), ]

  tolerances <- c(100, 200, 500, 1000, 1500, 2000, 3000, 5000, 8000, 12000, 16000)
  chosen_tolerance <- NA_real_
  chosen_bytes <- NA_integer_
  for (tolerance in tolerances) {
    candidate <- st_simplify(dissolved, dTolerance = tolerance, preserveTopology = TRUE)
    candidate <- st_make_valid(st_transform(candidate, 4326))
    st_write(candidate, output_path, delete_dsn = TRUE, quiet = TRUE)
    chosen_bytes <- file_bytes(output_path)
    chosen_tolerance <- tolerance
    if (chosen_bytes <= 3 * 1024 * 1024) break
  }
  if (file_bytes(output_path) > 3 * 1024 * 1024) {
    stop("boundary output remains above 3 MB after maximum simplification", call. = FALSE)
  }

  list(
    boundary = dissolved,
    lookup = st_drop_geometry(dissolved)[c("area_code", "area_name", "land_area_sq_km")],
    validation = list(
      source_feature_count = nrow(raw_boundaries),
      source_freguesia_count = length(unique(raw_boundaries[["Dicofre"]])),
      derived_feature_count = nrow(dissolved),
      expected_feature_count = nrow(areas),
      unmapped_boundary_features = extra_boundary,
      unmapped_census_areas = missing_boundary,
      simplified_boundary_bytes = file_bytes(output_path),
      simplification_tolerance_m = chosen_tolerance
    )
  )
}

# return row or feature counts for manifest records where cheap to compute.
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$", path)) {
    geo <- fromJSON(path, simplifyVector = FALSE)
    return(length(geo[["features"]]))
  }
  if (grepl("\\.json$", path)) {
    json <- fromJSON(path, simplifyVector = FALSE)
    if (!is.null(json[["rows"]])) return(length(json[["rows"]]))
    if (is.list(json) && length(json) == 1L && !is.null(json[[1]][["Dados"]])) {
      return(sum(vapply(json[[1]][["Dados"]], length, integer(1))))
    }
    return(length(json))
  }
  if (grepl("\\.zip$", path)) {
    layers <- try(st_layers(paste0("/vsizip/", normalizePath(path))), silent = TRUE)
    if (!inherits(layers, "try-error")) return(sum(layers[["features"]]))
  }
  NA_integer_
}

# create a manifest durable-file record for one generated output.
manifest_file_record <- function(path, content, licence_status = "open_cc_by_4_0_with_attribution") {
  list(
    uri = paste0("repo:", path),
    storage_provider = "git_repository",
    format = sub("^.*\\.", "", path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    row_count = row_count_file(path),
    content = content,
    privacy = "public",
    licence_status = licence_status
  )
}

# create a manifest raw-source record for one cached input.
raw_source_record <- function(source) {
  list(
    uri = source[["path"]],
    format = source[["format"]],
    bytes = file_bytes(source[["path"]]),
    sha256 = sha256_file(source[["path"]]),
    row_count = row_count_file(source[["path"]]),
    notes = source[["notes"]]
  )
}

# validate municipality sums against the ine portugal row for one wave.
validate_against_national <- function(area_counts, national_rows, spec) {
  national_counts <- derive_counts_for_area(national_rows, "PT", spec)
  area_year <- area_counts[area_counts[["year"]] == spec[["year"]], ]
  result <- list(
    year = spec[["year"]],
    area_count = nrow(area_year),
    total_category_area_sum = sum(area_year[["total_category_count"]]),
    total_category_national = national_counts[["total_category_count"]],
    total_category_difference = sum(area_year[["total_category_count"]]) - national_counts[["total_category_count"]],
    no_response_area_sum = sum(area_year[["no_response_count"]]),
    no_response_national = national_counts[["no_response_count"]],
    no_response_difference = sum(area_year[["no_response_count"]]) - national_counts[["no_response_count"]],
    population_total_area_sum = sum(area_year[["population_total"]]),
    population_total_national = national_counts[["population_total"]],
    population_total_difference = sum(area_year[["population_total"]]) - national_counts[["population_total"]],
    religious_affiliation_area_sum = sum(area_year[["religious_affiliation_count"]]),
    religious_affiliation_national = national_counts[["religious_affiliation_count"]],
    religious_affiliation_difference = sum(area_year[["religious_affiliation_count"]]) - national_counts[["religious_affiliation_count"]],
    no_religion_area_sum = sum(area_year[["no_religion_count"]]),
    no_religion_national = national_counts[["no_religion_count"]],
    no_religion_difference = sum(area_year[["no_religion_count"]]) - national_counts[["no_religion_count"]]
  )
  diffs <- unlist(result[grepl("_difference$", names(result))])
  if (any(diffs != 0)) {
    stop("national validation failed for ", spec[["year"]], call. = FALSE)
  }
  result
}

municipality_2011 <- read_ine_year_rows(file.path(raw_dir, "ine_0006396_municipality.json"), 2011L)
municipality_2021 <- read_ine_year_rows(file.path(raw_dir, "ine_0011644_municipality.json"), 2021L)
national_2011 <- read_ine_year_rows(file.path(raw_dir, "ine_0006396_national.json"), 2011L)
national_2021 <- read_ine_year_rows(file.path(raw_dir, "ine_0011644_national.json"), 2021L)

municipality_2011 <- municipality_2011[grepl("^[0-9]{4}$", municipality_2011[["area_code"]]), ]
municipality_2021 <- municipality_2021[grepl("^[0-9]{4}$", municipality_2021[["area_code"]]), ]

areas_2011 <- unique(municipality_2011[c("area_code", "area_name")])
areas_2021 <- unique(municipality_2021[c("area_code", "area_name")])
areas_2011 <- areas_2011[order(areas_2011[["area_code"]]), ]
areas_2021 <- areas_2021[order(areas_2021[["area_code"]]), ]
if (!identical(areas_2011[["area_code"]], areas_2021[["area_code"]])) {
  stop("2011 and 2021 municipality code sets differ", call. = FALSE)
}
areas <- areas_2021
if (nrow(areas) != 308L) stop("expected 308 Portugal municipalities", call. = FALSE)

all_counts <- do.call(rbind, lapply(wave_specs, function(spec) {
  rows <- if (spec[["year"]] == 2011L) municipality_2011 else municipality_2021
  do.call(rbind, lapply(areas[["area_code"]], function(area_code) {
    derived <- derive_counts_for_area(rows, area_code, spec)
    data.frame(
      year = spec[["year"]],
      area_code = area_code,
      total_category_count = derived[["total_category_count"]],
      no_response_count = derived[["no_response_count"]],
      population_total = derived[["population_total"]],
      religious_affiliation_count = derived[["religious_affiliation_count"]],
      no_religion_count = derived[["no_religion_count"]],
      stringsAsFactors = FALSE
    )
  }))
}))

all_counts[["religious_affiliation_percent"]] <- round(
  100 * all_counts[["religious_affiliation_count"]] / all_counts[["population_total"]],
  2
)
all_counts[["no_religion_percent"]] <- round(
  100 * all_counts[["no_religion_count"]] / all_counts[["population_total"]],
  2
)

caop_paths <- file.path(raw_dir, c(
  "caop2021_continente_aad.zip",
  "caop2021_madeira_aad.zip",
  "caop2021_acores_oriental_aad.zip",
  "caop2021_acores_central_aad.zip",
  "caop2021_acores_ocidental_aad.zip"
))
boundary_product <- build_boundary_product(caop_paths, areas, boundary_out)

rows <- unname(unlist(lapply(wave_specs, function(spec) {
  lapply(seq_len(nrow(areas)), function(index) {
    build_area_row(
      as.list(areas[index, ]),
      spec,
      all_counts,
      boundary_product[["lookup"]]
    )
  })
}), recursive = FALSE))

source_datasets <- list(
  list(
    source_dataset_id = census_2021_dataset_id,
    name = "População residente com 15 e mais anos de idade (N.º) por Local de residência à data dos Censos [2021] (NUTS - 2013) e Religião; Decenal",
    provider = "Instituto Nacional de Estatística (INE), Portugal",
    url = indicator_url(indicator_2021),
    retrieval_date = retrieval_date,
    local_path = file.path(raw_dir, "ine_0011644_municipality.json"),
    licence = list(
      name = "Creative Commons CC BY Atribuição 4.0",
      url = "https://creativecommons.org/licenses/by/4.0/deed.pt",
      attribution = "Instituto Nacional de Estatística, Portugal"
    ),
    citation = "Instituto Nacional de Estatística (Portugal). Indicator 0011644, Census 2021 resident population aged 15 and over by place of residence at the Census date (NUTS 2013) and religion.",
    access_limits = NULL,
    redistribution_limits = "INE states that statistical information on its portal is free and may be used and reused under Creative Commons CC BY Atribuição 4.0 with source identification.",
    notes = "The API extract exposes the named religion categories, Sem religião, and Total for the age-15-plus religion-response universe; it exposes no Não resposta category."
  ),
  list(
    source_dataset_id = census_2011_dataset_id,
    name = "População residente com 15 e mais anos de idade (N.º) por Local de residência (à data dos Censos 2011) e Religião; Decenal",
    provider = "Instituto Nacional de Estatística (INE), Portugal",
    url = indicator_url(indicator_2011),
    retrieval_date = retrieval_date,
    local_path = file.path(raw_dir, "ine_0006396_municipality.json"),
    licence = list(
      name = "Creative Commons CC BY Atribuição 4.0",
      url = "https://creativecommons.org/licenses/by/4.0/deed.pt",
      attribution = "Instituto Nacional de Estatística, Portugal"
    ),
    citation = "Instituto Nacional de Estatística (Portugal). Indicator 0006396, Census 2011 resident population aged 15 and over by place of residence at the Census date and religion.",
    access_limits = NULL,
    redistribution_limits = "INE states that statistical information on its portal is free and may be used and reused under Creative Commons CC BY Atribuição 4.0 with source identification.",
    notes = "The 2011 API extract includes a Não resposta category. The public denominator excludes that category."
  ),
  list(
    source_dataset_id = boundary_dataset_id,
    name = "Carta Administrativa Oficial de Portugal 2021 (CAOP 2021)",
    provider = "Direção-Geral do Território (DGT), Portugal",
    url = caop_page_url,
    retrieval_date = retrieval_date,
    local_path = paste(caop_paths, collapse = "|"),
    licence = list(
      name = "Creative Commons Attribution 4.0 (CC BY 4.0)",
      url = "https://creativecommons.org/licenses/by/4.0/",
      attribution = "Direção-Geral do Território"
    ),
    citation = "Direção-Geral do Território. Carta Administrativa Oficial de Portugal, versão 2021.",
    access_limits = NULL,
    redistribution_limits = "DGT open geographic downloads are subject to CC BY 4.0 attribution to Direção-Geral do Território.",
    notes = "The source polygons are parish-level CAOP administrative areas for mainland Portugal, Madeira, and the three Azores groups. The build dissolves them to the 308 municipality DICO codes."
  )
)

indicators <- list(
  list(
    indicator_id = "population_total",
    label = "Religion-response denominator",
    description = "Residents aged 15 and over in the municipality and census wave with a valid stated religion/no-religion response.",
    unit = "count",
    denominator_indicator_id = NULL,
    method = "2011: INE 0006396 Total minus Não resposta. 2021: INE 0011644 Total; the 2021 API extract exposes no Não resposta category.",
    temporal_coverage = "2011, 2021",
    spatial_coverage = "Portugal municipalities on CAOP 2021 boundaries.",
    quality_notes = "The denominator is the source religion-response total for the age-15-plus universe, not the full resident population."
  ),
  list(
    indicator_id = "religious_affiliation_percent",
    label = "Religious affiliation %",
    description = "Share of the source religion-response denominator reporting any named religion.",
    unit = "percent",
    denominator_indicator_id = "population_total",
    method = paste(
      "2011: 100 * (Católica + Ortodoxa + Protestante + Outra cristã + Judaica + Muçulmana + Outra não cristã) / (Total - Não resposta).",
      "2021: 100 * (Católica + Ortodoxa + Protestante/Evangélica + Testemunhas do Jeová + Outra cristã + Budista + Hindu + Judaica + Muçulmana + Outra não cristã) / Total."
    ),
    temporal_coverage = "2011, 2021",
    spatial_coverage = "Portugal municipalities on CAOP 2021 boundaries.",
    quality_notes = "The headline construct is any named religion; detailed denomination categories are not crosswalked across waves."
  ),
  list(
    indicator_id = "no_religion_percent",
    label = "No religion %",
    description = "Share of the source religion-response denominator reporting Sem religião.",
    unit = "percent",
    denominator_indicator_id = "population_total",
    method = "2011: 100 * Sem religião / (Total - Não resposta). 2021: 100 * Sem religião / Total.",
    temporal_coverage = "2011, 2021",
    spatial_coverage = "Portugal municipalities on CAOP 2021 boundaries.",
    quality_notes = "Sem religião is the INE source label in both shipped waves."
  )
)

visual_layers <- list(
  list(
    visual_layer_id = "pt-municipality-religious-affiliation-percent",
    label = "Religious affiliation %",
    description = "Municipality choropleth of religious-affiliation percentage.",
    layer_type = "choropleth",
    indicator_ids = I(c("religious_affiliation_percent")),
    geometry_unit_type = "area_unit",
    legend = list(unit = "percent", denominator = "age-15-plus stated religion/no-religion response"),
    colour_scale = "sequential",
    time_control = "year_selector",
    aggregation_rule = "precomputed by municipality and census year",
    uncertainty_display = "quality_flag",
    default_visibility = TRUE,
    notes = NULL
  ),
  list(
    visual_layer_id = "pt-municipality-no-religion-percent",
    label = "No religion %",
    description = "Municipality choropleth of no-religion percentage.",
    layer_type = "choropleth",
    indicator_ids = I(c("no_religion_percent")),
    geometry_unit_type = "area_unit",
    legend = list(unit = "percent", denominator = "age-15-plus stated religion/no-religion response"),
    colour_scale = "sequential",
    time_control = "year_selector",
    aggregation_rule = "precomputed by municipality and census year",
    uncertainty_display = "quality_flag",
    default_visibility = FALSE,
    notes = NULL
  )
)

summary <- list(
  schema_version = "0.1.0",
  generated_at = stamp,
  generated_by = script_id,
  country_code = country_code,
  boundary_set = list(
    boundary_set_id = boundary_set_id,
    country_code = country_code,
    level = "municipality",
    vintage = "2021",
    source_dataset_id = boundary_dataset_id
  ),
  site_snapshot = list(
    source_dataset_id = NULL,
    snapshot_date = NULL,
    basis = "no Portugal place-of-worship snapshot is included in this country data-map release",
    notes = "The Portugal page exposes census affiliation, no-religion, and change metrics only; OSM place-density metrics are hidden until a governed Portugal place layer is built."
  ),
  source_datasets = source_datasets,
  indicators = indicators,
  visual_layers = visual_layers,
  rows = rows
)

write(toJSON(summary, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null"), summary_json_out)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

national_validation <- list(
  validate_against_national(all_counts, national_2011, wave_specs[["2011"]]),
  validate_against_national(all_counts, national_2021, wave_specs[["2021"]])
)

join_coverage <- unname(lapply(wave_specs, function(spec) {
  list(
    year = spec[["year"]],
    matched_area_count = sum(all_counts[["year"]] == spec[["year"]] & !is.na(all_counts[["population_total"]])),
    expected_area_count = nrow(areas),
    missing_area_names = character(0)
  )
}))

for (coverage in join_coverage) {
  if (coverage[["matched_area_count"]] != coverage[["expected_area_count"]]) {
    stop("join coverage failed for ", coverage[["year"]], call. = FALSE)
  }
}
if (boundary_product[["validation"]][["derived_feature_count"]] != 308L) {
  stop("boundary feature count validation failed", call. = FALSE)
}

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:pt-census-religion:pt:2011-2021:ine-api-caop2021",
  dataset_id = "pt-census-religion:pt:2011-2021:ine-api-caop2021",
  dataset_version_id = paste0(
    "pt-census-religion:pt:2011-2021:ine-api-caop2021:",
    substr(sha256_file(summary_json_out), 1, 12)
  ),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "pt-census-religion",
  dataset_role = "public_product",
  scope = list(
    level = "country",
    country_codes = I(c("PT")),
    snapshot_date = NULL,
    snapshot_anchor = NULL,
    pipeline_stage = "public"
  ),
  created_at = stamp,
  created_by = script_id,
  pipeline = list(
    script = script_id,
    git_commit = NULL,
    command = "Rscript scripts/build_pt_area_summary.R",
    parameters = list(
      waves = c("2011", "2021"),
      boundary_set = boundary_set_id,
      boundary_simplification_tolerance_m = boundary_product[["validation"]][["simplification_tolerance_m"]],
      denominator = "2011 Total minus Não resposta; 2021 Total because no Não resposta category is exposed in the 2021 API extract"
    ),
    software_versions = list(
      r = paste(R.version[["major"]], R.version[["minor"]], sep = "."),
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite"))
    )
  ),
  source = list(
    provider = "Instituto Nacional de Estatística (INE), Portugal; Direção-Geral do Território (DGT), Portugal",
    source_dataset_ids = c(census_2011_dataset_id, census_2021_dataset_id, boundary_dataset_id),
    source_urls = c(
      indicator_url(indicator_2011),
      indicator_url(indicator_2021),
      api_data_url(indicator_2011, "lvl@5"),
      api_data_url(indicator_2021, "lvl@5"),
      ine_api_docs_url,
      ine_terms_url,
      caop_page_url,
      dgt_open_data_url
    ),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = "INE states that statistical information on its portal is free and may be used and reused under Creative Commons CC BY Atribuição 4.0 with source identification. DGT states that geographic downloads from its data centre are subject to CC BY 4.0 with attribution to Direção-Geral do Território.",
    citation = "Instituto Nacional de Estatística (Portugal), indicators 0006396 and 0011644; Direção-Geral do Território, Carta Administrativa Oficial de Portugal 2021.",
    raw_redistribution = "Raw INE JSON/XML exports and CAOP shapefile archives are not committed. They remain in data/raw/pt_census/ and await any project-controlled raw archive upload."
  ),
  input_manifests = list(),
  raw_sources = lapply(required_sources, raw_source_record),
  durable_files = list(
    manifest_file_record(summary_json_out, "Portugal municipality area summary with INE Census 2011 and 2021 stated-response religion metrics."),
    manifest_file_record(summary_csv_out, "Flattened Portugal municipality area summary with INE Census 2011 and 2021 stated-response religion metrics."),
    manifest_file_record(boundary_out, "Simplified Portugal municipality boundary GeoJSON dissolved from CAOP 2021 administrative areas.")
  ),
  derived_outputs = list(
    list(
      uri = paste0("repo:", summary_json_out),
      sha256 = sha256_file(summary_json_out),
      built_by = script_id,
      notes = "308 municipality reporting units x 2 census years; denominator is the source age-15-plus stated religion/no-religion response total."
    ),
    list(
      uri = paste0("repo:", boundary_out),
      sha256 = sha256_file(boundary_out),
      built_by = script_id,
      notes = paste0(
        "308 municipality features dissolved from CAOP 2021 administrative-area polygons; simplified at ",
        boundary_product[["validation"]][["simplification_tolerance_m"]],
        " m tolerance."
      )
    )
  ),
  validation = list(
    checks = c(
      "INE indicator 0006396 and 0011644 API JSON files were downloaded for municipality rows and Portugal national rows.",
      "For 2011, municipality sums match the INE Portugal row exactly for Total, Não resposta, stated-response denominator, religious affiliation, and Sem religião.",
      "For 2021, municipality sums match the INE Portugal row exactly for Total, stated-response denominator, religious affiliation, and Sem religião; no Não resposta category is exposed in the 2021 API extract.",
      "CAOP 2021 source polygons dissolve to 308 municipality features, matching both INE municipality code sets.",
      "The simplified boundary GeoJSON is at or below 3 MB."
    ),
    join_coverage = join_coverage,
    state_validation = national_validation,
    boundary_validation = boundary_product[["validation"]]
  ),
  deferred_sources = list(
    list(
      source_dataset_id = "ine-censos-2021-indicator-0012311",
      url = indicator_url("0012311"),
      local_path = NULL,
      notes = "Verified as the Census 2021 NUTS 2024 version of the same religion indicator. The build uses indicator 0011644 because it is the Census 2021 NUTS 2013 table and aligns with the 2011 municipality-code frame."
    ),
    list(
      source_dataset_id = "ine-censos-2001-1991-1981-religion-municipality",
      url = "https://www.ine.pt/xportal/xmain?xpid=INE&xpgid=ine_base_dados&contexto=bd&selTab=tab2",
      local_path = NULL,
      notes = "Time-boxed INE database searches for municipality-level religion indicators for 2001, 1991, and 1981 did not expose stable indicator pages. These waves are deferred until exact official tables and a clean municipality-code correspondence are pinned."
    )
  ),
  construct_notes = list(
    list(
      year = 2011L,
      indicator_code = indicator_2011,
      denominator = "Total - Não resposta",
      religious_affiliation_formula = wave_specs[["2011"]][["affiliated_formula"]],
      no_religion_formula = wave_specs[["2011"]][["no_religion_formula"]],
      source_categories = category_label_summary(national_2011, wave_specs[["2011"]])
    ),
    list(
      year = 2021L,
      indicator_code = indicator_2021,
      denominator = "Total",
      religious_affiliation_formula = wave_specs[["2021"]][["affiliated_formula"]],
      no_religion_formula = wave_specs[["2021"]][["no_religion_formula"]],
      source_categories = category_label_summary(national_2021, wave_specs[["2021"]])
    )
  )
)

manifest_text <- toJSON(manifest, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null")
if (!validate(manifest_text)) stop("manifest json failed syntax validation", call. = FALSE)
write(manifest_text, manifest_out)

cat("Portugal area summary built: ", nrow(areas), " municipalities x ", length(wave_specs), " waves\n", sep = "")
for (result in national_validation) {
  cat(
    result[["year"]],
    ": denominator ",
    result[["population_total_area_sum"]],
    " vs ",
    result[["population_total_national"]],
    " (diff ",
    result[["population_total_difference"]],
    "); religious_affiliation ",
    result[["religious_affiliation_area_sum"]],
    " vs ",
    result[["religious_affiliation_national"]],
    " (diff ",
    result[["religious_affiliation_difference"]],
    "); no_religion ",
    result[["no_religion_area_sum"]],
    " vs ",
    result[["no_religion_national"]],
    " (diff ",
    result[["no_religion_difference"]],
    ")\n",
    sep = ""
  )
}
cat(
  "Boundary output: ",
  row_count_file(boundary_out),
  " features, ",
  file_bytes(boundary_out),
  " bytes, tolerance ",
  boundary_product[["validation"]][["simplification_tolerance_m"]],
  " m\n",
  sep = ""
)
