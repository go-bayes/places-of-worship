# build the italy regional practice area-summary product from istat avq.
# inputs: cached istat sdmx responses for the "religious observances - regions
# and type of municipality" avq dataflow, the cached istat 2026 generalised
# administrative-boundary zip, and cached istat source/licence pages.
# outputs: apps/regions/it/data/it_region_2026.geojson,
# apps/regions/it/data/area_summary_region.{json,csv}, and
# docs/manifests/it-attendance-2001-2025.json.
# run from the repo root: Rscript scripts/build_it_area_summary.R
# the source publishes regional values for 2001-2003 and 2005-2025. 2004 is
# absent from the pulled table and is therefore not interpolated or fabricated.

suppressMessages({
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

raw_dir <- "data/raw/it_practice"
it_dir <- "apps/regions/it/data"
manifest_dir <- "docs/manifests"
dir.create(it_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- "2026-07-09"
script_id <- "scripts/build_it_area_summary.R"
country_code <- "IT"

boundary_set_id <- "it-region-2026-istat-generalised"
boundary_level <- "region"
attendance_dataset_id <- "istat-avq-religious-observances-regions-2001-2025"
dataflow_dataset_id <- "istat-sdmx-dataflow-it1-allstubs"
dsd_dataset_id <- "istat-avq-persons-dsd"
codelist_dataset_id <- "istat-avq-persons-codelists"
boundary_dataset_id <- "istat-confini-amministrativi-regioni-2026-generalizzati"
boundary_landing_dataset_id <- "istat-boundary-landing-page"
legal_notice_dataset_id <- "istat-legal-notice"

dataflow_id <- "83_63_DF_DCCV_AVQ_PERSONE_136"
dataflow_name <- "Religious observances - regions and type of municipality"

dataflow_url <- "https://esploradati.istat.it/SDMXWS/rest/dataflow/IT1?detail=allstubs"
dsd_url <- paste0("https://esploradati.istat.it/SDMXWS/rest/dataflow/IT1/",
                  dataflow_id, "/1.0?references=children")
codelist_url <- paste0(
  "https://esploradati.istat.it/SDMXWS/rest/codelist/IT1/",
  "CL_FREQ+CL_ITTER107+CL_TIPO_DATO_AVQ+CL_MISURA_AVQ+CL_SEXISTAT1+",
  "CL_ETA1+CL_TITOLO_STUDIO+CL_CONDIZIONE_DICH+CL_FLAG+CL_UNIT_MEASURE+",
  "CL_UNIT_MULT/1.0"
)
attendance_query_key <- paste0(
  "A.IT+ITC1+ITC2+ITC3+ITC4+ITDA+ITD3+ITD4+ITD5+ITE1+ITE2+ITE3+",
  "ITE4+ITF1+ITF2+ITF3+ITF4+ITF5+ITF6+ITG1+ITG2.",
  "6_WEEK_RELIG+6_NEVER_RELIG.HSC...."
)
attendance_url <- paste0(
  "https://esploradati.istat.it/SDMXWS/rest/data/",
  dataflow_id, "/", attendance_query_key, "?detail=full"
)
boundary_url <- "https://www.istat.it/storage/cartografia/confini_amministrativi/generalizzati/2026/Limiti01012026_g.zip"
boundary_landing_url <- "https://www.istat.it/notizia/confini-delle-unita-amministrative-a-fini-statistici-al-1-gennaio-2018-2/"
legal_notice_url <- "https://www.istat.it/en/legal-notice/"
cc_by_url <- "https://creativecommons.org/licenses/by/4.0/"

dataflow_path <- file.path(raw_dir, "istat_dataflow_it1_allstubs.json")
dataflow_meta_path <- file.path(raw_dir, "istat_dataflow_it1_allstubs.meta.json")
dsd_path <- file.path(raw_dir, paste0("istat_", dataflow_id, "_dataflow_references_children.json"))
dsd_meta_path <- file.path(raw_dir, paste0("istat_", dataflow_id, "_dataflow_references_children.meta.json"))
codelist_path <- file.path(raw_dir, "istat_avq_dimension_codelists.json")
codelist_meta_path <- file.path(raw_dir, "istat_avq_dimension_codelists.meta.json")
attendance_path <- file.path(raw_dir, paste0("istat_", dataflow_id, "_attendance_weekly_never_regions.csv"))
attendance_meta_path <- file.path(raw_dir, paste0("istat_", dataflow_id, "_attendance_weekly_never_regions.meta.json"))
boundary_zip_path <- file.path(raw_dir, "istat_limiti01012026_g.zip")
boundary_zip_meta_path <- file.path(raw_dir, "istat_limiti01012026_g.meta.json")
boundary_landing_path <- file.path(raw_dir, "istat_boundary_landing.html")
boundary_landing_meta_path <- file.path(raw_dir, "istat_boundary_landing.meta.json")
legal_notice_path <- file.path(raw_dir, "istat_legal_notice.html")
legal_notice_meta_path <- file.path(raw_dir, "istat_legal_notice.meta.json")

boundary_out <- file.path(it_dir, "it_region_2026.geojson")
summary_json_out <- file.path(it_dir, "area_summary_region.json")
summary_csv_out <- file.path(it_dir, "area_summary_region.csv")
manifest_out <- file.path(manifest_dir, "it-attendance-2001-2025.json")

population_basis_note <- paste(
  "Resident population aged 6+; respondents aged 14+ answer directly,",
  "and for children aged 6-13 a parent answers by proxy. The published",
  "value is already a percentage."
)
quality_flag_value <- paste(
  "sample_survey_estimate",
  "sampling_error_not_machine_readable",
  "regional_sampling_error_bands_in_annual_nota_metodologica",
  "self_reported_attendance",
  "resident_population_aged_6_plus",
  sep = ";"
)
construct_note <- paste(
  "Italy's AVQ measure is a self-reported sample-survey estimate of worship",
  "attendance frequency among the resident population aged 6 and over. It is",
  "not religious affiliation and not a doorway count. Poland's dominicantes",
  "is a count of persons physically present at Mass on one count Sunday,",
  "expressed over obliged Catholics. The Italy survey percentages and Poland",
  "count percentages must not be placed on one axis or compared directly."
)
licence_text <- paste(
  "ISTAT AVQ aggregate data and ISTAT boundary/source pages are used under",
  "Istat's legal notice: unless otherwise stated, website content is licensed",
  "under Creative Commons Attribution 4.0 International. Attribution: Istat.",
  "The boundary source is ISTAT Confini delle unità amministrative a fini",
  "statistici, 2026, versione generalizzata, WGS84."
)
licence_status <- "accepted"
# terms identity preserved separately from the shipping decision (schema v2)
licence_basis <- "istat_cc_by_4_0"

sdmx_region_to_istat <- c(
  "ITC1" = "01",
  "ITC2" = "02",
  "ITC4" = "03",
  "ITDA" = "04",
  "ITD3" = "05",
  "ITD4" = "06",
  "ITC3" = "07",
  "ITD5" = "08",
  "ITE1" = "09",
  "ITE2" = "10",
  "ITE3" = "11",
  "ITE4" = "12",
  "ITF1" = "13",
  "ITF2" = "14",
  "ITF3" = "15",
  "ITF4" = "16",
  "ITF5" = "17",
  "ITF6" = "18",
  "ITG1" = "19",
  "ITG2" = "20"
)

national_spot_checks_expected <- data.frame(
  year = c(2001L, 2019L, 2022L),
  weekly_attendance_percent = c(36.4, 25.1, 18.8),
  never_attending_percent = c(15.9, 27.0, 31.1)
)

# stop early if a required cached source has not been saved.
require_file <- function(path) {
  if (!file.exists(path)) stop("missing required source: ", path, call. = FALSE)
}

# compute the sha-256 digest for a local file.
sha256_file <- function(path) {
  unname(tools::sha256sum(path))
}

# return file size in bytes for manifest records.
file_bytes <- function(path) {
  as.integer(unname(file.info(path)[["size"]]))
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

# read the retrieval metadata sidecar written when a raw response was cached.
read_meta <- function(path) {
  if (!file.exists(path)) return(list())
  fromJSON(path, simplifyVector = FALSE)
}

# extract a compact code-label table from an SDMX codelist response.
codelist_items <- function(codelist_json, codelist_id) {
  codelists <- codelist_json[["data"]][["codelists"]]
  idx <- which(vapply(codelists, function(cl) identical(cl[["id"]], codelist_id), logical(1)))
  if (length(idx) != 1L) stop("expected one codelist for ", codelist_id, call. = FALSE)
  items <- codelists[[idx]][["items"]]
  if (is.null(items)) items <- codelists[[idx]][["codes"]]
  if (is.null(items)) stop("codelist has neither items nor codes: ", codelist_id, call. = FALSE)
  data.frame(
    id = vapply(items, `[[`, character(1), "id"),
    label = vapply(items, function(item) {
      labels <- unique(c(item[["name"]], unlist(item[["names"]], use.names = FALSE)))
      paste(labels[!is.na(labels)], collapse = " | ")
    }, character(1)),
    stringsAsFactors = FALSE
  )
}

# convert the cached ISTAT AVQ CSV to one region-year row per source year.
build_attendance_rows <- function(path, codelist_json, boundary) {
  avq <- read.csv(path, stringsAsFactors = FALSE, check.names = FALSE)
  required_cols <- c(
    "FREQ", "REF_AREA", "DATA_TYPE", "MEASURE", "SEX", "AGE",
    "EDU_LEV_HIGHEST", "LABOUR_PROFESS_STATUS_B", "TIME_PERIOD", "OBS_VALUE"
  )
  missing_cols <- setdiff(required_cols, names(avq))
  if (length(missing_cols) > 0L) {
    stop("attendance CSV is missing columns: ", paste(missing_cols, collapse = ", "), call. = FALSE)
  }
  if (!all(avq[["FREQ"]] == "A")) stop("attendance CSV contains non-annual rows", call. = FALSE)
  if (!all(avq[["MEASURE"]] == "HSC")) stop("attendance CSV contains non-percent measure rows", call. = FALSE)
  if (!all(avq[["SEX"]] == "9")) stop("attendance CSV does not use the expected total-sex code 9", call. = FALSE)
  if (!all(avq[["AGE"]] == "Y_GE6")) stop("attendance CSV does not use age 6+ rows only", call. = FALSE)
  if (!all(avq[["EDU_LEV_HIGHEST"]] == "99")) stop("attendance CSV does not use total education rows only", call. = FALSE)
  if (!all(avq[["LABOUR_PROFESS_STATUS_B"]] == "99")) stop("attendance CSV does not use total occupation rows only", call. = FALSE)
  if (!all(avq[["DATA_TYPE"]] %in% c("6_WEEK_RELIG", "6_NEVER_RELIG"))) {
    stop("attendance CSV contains unexpected data types", call. = FALSE)
  }
  if (any(is.na(avq[["OBS_VALUE"]]) | avq[["OBS_VALUE"]] < 0 | avq[["OBS_VALUE"]] > 100)) {
    stop("attendance values must be non-missing percentages within [0, 100]", call. = FALSE)
  }

  data_type_labels <- codelist_items(codelist_json, "CL_TIPO_DATO_AVQ")
  weekly_label <- data_type_labels[["label"]][match("6_WEEK_RELIG", data_type_labels[["id"]])]
  never_label <- data_type_labels[["label"]][match("6_NEVER_RELIG", data_type_labels[["id"]])]
  if (is.na(weekly_label) || is.na(never_label)) stop("religious-practice labels not found in codelist", call. = FALSE)

  national <- avq[avq[["REF_AREA"]] == "IT", ]
  spot <- reshape(
    national[, c("TIME_PERIOD", "DATA_TYPE", "OBS_VALUE")],
    idvar = "TIME_PERIOD",
    timevar = "DATA_TYPE",
    direction = "wide"
  )
  names(spot) <- sub("^OBS_VALUE\\.", "", names(spot))
  for (i in seq_len(nrow(national_spot_checks_expected))) {
    yr <- national_spot_checks_expected[["year"]][i]
    observed <- spot[spot[["TIME_PERIOD"]] == yr, ]
    if (nrow(observed) != 1L) stop("missing national spot-check year ", yr, call. = FALSE)
    if (!isTRUE(all.equal(observed[["6_WEEK_RELIG"]],
                          national_spot_checks_expected[["weekly_attendance_percent"]][i],
                          tolerance = 1e-9))) {
      stop("weekly national spot check failed for ", yr, call. = FALSE)
    }
    if (!isTRUE(all.equal(observed[["6_NEVER_RELIG"]],
                          national_spot_checks_expected[["never_attending_percent"]][i],
                          tolerance = 1e-9))) {
      stop("never-attending national spot check failed for ", yr, call. = FALSE)
    }
  }

  regional <- avq[avq[["REF_AREA"]] != "IT", ]
  regional[["area_code"]] <- unname(sdmx_region_to_istat[regional[["REF_AREA"]]])
  if (any(is.na(regional[["area_code"]]))) {
    stop("unmapped SDMX region code in attendance CSV", call. = FALSE)
  }
  years <- sort(unique(regional[["TIME_PERIOD"]]))
  expected_years <- c(2001L, 2002L, 2003L, 2005L:2025L)
  if (!identical(years, expected_years)) {
    stop("unexpected source-year coverage: ", paste(years, collapse = ", "), call. = FALSE)
  }
  if (2004L %in% years) stop("source-year coverage unexpectedly includes 2004", call. = FALSE)
  for (yr in years) {
    for (data_type in c("6_WEEK_RELIG", "6_NEVER_RELIG")) {
      codes <- sort(unique(regional[["area_code"]][regional[["TIME_PERIOD"]] == yr &
                                              regional[["DATA_TYPE"]] == data_type]))
      if (!identical(codes, sprintf("%02d", 1:20))) {
        stop("region coverage failed for ", yr, " / ", data_type, call. = FALSE)
      }
    }
  }

  wide <- reshape(
    regional[, c("area_code", "TIME_PERIOD", "DATA_TYPE", "OBS_VALUE")],
    idvar = c("area_code", "TIME_PERIOD"),
    timevar = "DATA_TYPE",
    direction = "wide"
  )
  names(wide) <- sub("^OBS_VALUE\\.", "", names(wide))
  wide <- wide[order(wide[["TIME_PERIOD"]], wide[["area_code"]]), ]

  rows <- vector("list", nrow(wide))
  for (i in seq_len(nrow(wide))) {
    b <- boundary[boundary[["area_code"]] == wide[["area_code"]][i], ]
    if (nrow(b) != 1L) stop("boundary join failed for area ", wide[["area_code"]][i], call. = FALSE)
    rows[[i]] <- list(
      country_code = country_code,
      boundary_set_id = boundary_set_id,
      boundary_level = boundary_level,
      area_unit_id = b[["area_unit_id"]],
      area_code = wide[["area_code"]][i],
      area_name = b[["area_name"]],
      year = as.integer(wide[["TIME_PERIOD"]][i]),
      population_total = NULL,
      population_total_basis = population_basis_note,
      religious_affiliation_count = NULL,
      religious_affiliation_percent = round(wide[["6_WEEK_RELIG"]][i], 1),
      no_religion_count = NULL,
      no_religion_percent = round(wide[["6_NEVER_RELIG"]][i], 1),
      place_count = NULL,
      places_per_10000_residents = NULL,
      place_density_per_sq_km = NULL,
      land_area_sq_km = round(b[["land_area_sq_km"]], 2),
      site_snapshot_date = NULL,
      place_count_basis = NULL,
      source_dataset_ids = c(attendance_dataset_id, boundary_dataset_id),
      quality_flag = quality_flag_value
    )
  }

  list(
    rows = rows,
    years = years,
    weekly_label = weekly_label,
    never_label = never_label,
    national_spot_checks = national_spot_checks_expected
  )
}

# read and normalise the official ISTAT regional boundary shapefile.
read_boundary <- function(path) {
  td <- tempfile("it-boundary-")
  dir.create(td, showWarnings = FALSE, recursive = TRUE)
  on.exit(unlink(td, recursive = TRUE), add = TRUE)
  unzip(path, exdir = td)
  shp <- file.path(td, "Reg01012026_g", "Reg01012026_g_WGS84.shp")
  if (!file.exists(shp)) stop("region shapefile not found inside boundary zip", call. = FALSE)
  reg <- st_read(shp, quiet = TRUE)
  if (nrow(reg) != 20L) stop("expected 20 ISTAT region features", call. = FALSE)
  valid <- st_is_valid(reg)
  if (any(st_is_empty(reg)) || any(is.na(valid)) || any(!valid)) {
    stop("source ISTAT region boundary contains empty or invalid geometries", call. = FALSE)
  }
  reg[["area_code"]] <- sprintf("%02d", as.integer(reg[["COD_REG"]]))
  reg[["area_name"]] <- as.character(reg[["DEN_REG"]])
  reg[["area_unit_id"]] <- paste0(boundary_set_id, ":", reg[["area_code"]])
  reg[["boundary_set_id"]] <- boundary_set_id
  reg[["boundary_level"]] <- boundary_level
  reg[["land_area_sq_km"]] <- as.numeric(st_area(reg)) / 1e6
  reg <- reg[, c("area_code", "area_name", "area_unit_id", "boundary_set_id",
                 "boundary_level", "land_area_sq_km", "geometry")]
  reg <- st_transform(reg, 4326)
  reg <- reg[order(reg[["area_code"]]), ]
  expected_names <- c(
    "Piemonte", "Valle d'Aosta/Vallée d'Aoste", "Lombardia",
    "Trentino-Alto Adige/Südtirol", "Veneto", "Friuli-Venezia Giulia",
    "Liguria", "Emilia-Romagna", "Toscana", "Umbria", "Marche", "Lazio",
    "Abruzzo", "Molise", "Campania", "Puglia", "Basilicata", "Calabria",
    "Sicilia", "Sardegna"
  )
  if (!identical(reg[["area_name"]], expected_names)) {
    stop("ISTAT region names differ from expected 2026 official order", call. = FALSE)
  }
  reg
}

# write a mapshaper-simplified GeoJSON and assert it remains valid.
write_simplified_boundary <- function(boundary, output_path, field_names) {
  boundary_fields <- boundary[, field_names]
  keep_percentages <- c(90, 75, 60, 45, 30, 20, 15, 10, 7, 5, 3, 2, 1)
  mapshaper_simplify_to_cap(
    boundary_fields,
    output_path,
    max_bytes = 800000L,
    keep_percentages = keep_percentages,
    clean_option = NULL
  )
}

# flatten area-summary rows for the CSV sidecar.
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

# describe every source dataset used by the area-summary document.
source_datasets <- function() {
  list(
    list(
      source_dataset_id = attendance_dataset_id,
      name = paste0("ISTAT AVQ IstatData dataflow ", dataflow_id, ": ", dataflow_name),
      provider = "Istat",
      url = attendance_url,
      retrieval_date = retrieval_date,
      local_path = attendance_path,
      licence = list(
        name = "Creative Commons Attribution 4.0 International (CC BY 4.0), unless otherwise stated",
        url = legal_notice_url,
        attribution = "Istat"
      ),
      citation = "Istat, Aspetti della vita quotidiana (AVQ), religious observances by region and type of municipality.",
      access_limits = "Istat SDMX endpoint rate limit: about five queries per minute per IP; cached source used for builds.",
      redistribution_limits = "The committed product contains derived regional percentages and source attribution; raw SDMX responses stay in gitignored data/raw/it_practice/.",
      notes = paste(
        "Rows use DATA_TYPE 6_WEEK_RELIG and 6_NEVER_RELIG, MEASURE HSC",
        "(per 100 people with the same characteristics), SEX 9, AGE Y_GE6,",
        "EDU_LEV_HIGHEST 99, and LABOUR_PROFESS_STATUS_B 99. The denominator",
        "is resident population aged 6 and over; 6-13 responses are supplied",
        "by parental proxy. Source years are 2001-2003 and 2005-2025; 2004 is",
        "not present in the source pull."
      )
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "Istat 2026 generalised administrative boundaries, regions",
      provider = "Istat",
      url = boundary_url,
      retrieval_date = retrieval_date,
      local_path = boundary_zip_path,
      licence = list(
        name = "Creative Commons Attribution 4.0 International (CC BY 4.0), unless otherwise stated",
        url = legal_notice_url,
        attribution = "Istat"
      ),
      citation = "Istat, Confini delle unità amministrative a fini statistici, 2026, versione generalizzata, Reg01012026_g.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived region GeoJSON is committed with Istat CC BY 4.0 attribution.",
      notes = "The source ZIP contains the WGS84 generalised region shapefile Reg01012026_g_WGS84; the product keeps the 20 region features and transforms them to EPSG:4326 GeoJSON."
    )
  )
}

# define the indicators represented in the area-summary rows.
indicators_for_region <- function(years, weekly_label, never_label) {
  temporal <- paste0(min(years), "-", max(years), " (2004 absent from source)")
  list(
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Weekly attendance %",
      description = paste(
        "Legacy area-summary field name used for the headline practice metric:",
        paste0(weekly_label, "."),
        "This value is self-reported attendance at a place of worship at least",
        "once a week; it is not religious affiliation."
      ),
      unit = "percent",
      denominator_indicator_id = NULL,
      method = "ISTAT AVQ DATA_TYPE 6_WEEK_RELIG, MEASURE HSC, total sex, age 6+, total education, total occupation.",
      temporal_coverage = temporal,
      spatial_coverage = "Italy regions (20 ISTAT regions).",
      quality_notes = paste(population_basis_note, "Sampling-error bands are not machine-readable in the SDMX pull; they are documented in the annual Nota metodologica.")
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "Never attending %",
      description = paste(
        "Legacy area-summary field name used for the secondary practice metric:",
        paste0(never_label, "."),
        "This value is the share reporting never attending a place of worship,",
        "and it is not a no-religion affiliation category."
      ),
      unit = "percent",
      denominator_indicator_id = NULL,
      method = "ISTAT AVQ DATA_TYPE 6_NEVER_RELIG, MEASURE HSC, total sex, age 6+, total education, total occupation.",
      temporal_coverage = temporal,
      spatial_coverage = "Italy regions (20 ISTAT regions).",
      quality_notes = paste(population_basis_note, "Sampling-error bands are not machine-readable in the SDMX pull; they are documented in the annual Nota metodologica.")
    )
  )
}

# define the choropleth layers represented by the practice product.
visual_layers_for_region <- function() {
  list(
    list(
      visual_layer_id = "it-region-weekly-attendance",
      label = "Weekly attendance %",
      description = "Self-reported weekly attendance at a place of worship, percent of resident population aged 6+.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "resident population aged 6+"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported survey estimate by region",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = "This layer reports survey-practice rather than affiliation."
    ),
    list(
      visual_layer_id = "it-region-never-attending",
      label = "Never attending %",
      description = "Self-reported never attending a place of worship, percent of resident population aged 6+.",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "resident population aged 6+"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported survey estimate by region",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = "This layer reports non-attendance in a survey-practice table rather than census no-religion affiliation."
    )
  )
}

# assemble the area-summary document.
area_summary_document <- function(rows, years, weekly_label, never_label) {
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
      basis = "no governed Italy OpenStreetMap place-of-worship snapshot is included in this country data-map release",
      notes = "The Italy practice lane exposes AVQ regional religious-attendance survey metrics only; place-density metrics are hidden until a governed Italy place layer is built."
    ),
    source_datasets = source_datasets(),
    indicators = indicators_for_region(years, weekly_label, never_label),
    visual_layers = visual_layers_for_region(),
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

# create a manifest raw-source record for one cached source object.
raw_source_record <- function(path, meta_path, url, format, source_id, used, periods, notes) {
  meta <- read_meta(meta_path)
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
    notes = notes
  )
}

required_sources <- c(
  dataflow_path, dataflow_meta_path, dsd_path, dsd_meta_path, codelist_path,
  codelist_meta_path, attendance_path, attendance_meta_path, boundary_zip_path,
  boundary_zip_meta_path, boundary_landing_path, boundary_landing_meta_path,
  legal_notice_path, legal_notice_meta_path
)
invisible(lapply(required_sources, require_file))

dataflow_json <- fromJSON(dataflow_path, simplifyVector = FALSE)
flows <- dataflow_json[["data"]][["dataflows"]]
flow_idx <- which(vapply(flows, function(flow) identical(flow[["id"]], dataflow_id), logical(1)))
if (length(flow_idx) != 1L) stop("expected exactly one AVQ religious-practice dataflow", call. = FALSE)
if (!identical(flows[[flow_idx]][["name"]], dataflow_name)) {
  stop("AVQ religious-practice dataflow label changed", call. = FALSE)
}

dsd_json <- fromJSON(dsd_path, simplifyVector = FALSE)
dims <- dsd_json[["data"]][["dataStructures"]][[1]][["dataStructureComponents"]][["dimensionList"]][["dimensions"]]
dim_order <- vapply(dims, `[[`, character(1), "id")
expected_dim_order <- c("FREQ", "REF_AREA", "DATA_TYPE", "MEASURE", "SEX", "AGE",
                        "EDU_LEV_HIGHEST", "LABOUR_PROFESS_STATUS_B")
if (!identical(dim_order, expected_dim_order)) {
  stop("unexpected AVQ dimension order: ", paste(dim_order, collapse = ", "), call. = FALSE)
}

codelist_json <- fromJSON(codelist_path, simplifyVector = FALSE)
boundary <- read_boundary(boundary_zip_path)
attendance <- build_attendance_rows(attendance_path, codelist_json, boundary)
rows <- attendance[["rows"]]
years <- attendance[["years"]]

boundary_write <- write_simplified_boundary(
  boundary,
  boundary_out,
  c("area_code", "area_name", "area_unit_id", "boundary_set_id",
    "boundary_level", "land_area_sq_km")
)
if (row_count_file(boundary_out) != nrow(boundary)) {
  stop("region boundary feature count changed during simplification", call. = FALSE)
}

write_json(
  area_summary_document(rows, years, attendance[["weekly_label"]], attendance[["never_label"]]),
  summary_json_out,
  auto_unbox = TRUE,
  pretty = TRUE,
  null = "null",
  na = "null",
  digits = NA
)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

summary_text <- paste(readLines(summary_json_out, warn = FALSE), collapse = "\n")
if (!jsonlite::validate(summary_text)) stop("area-summary JSON failed jsonlite validation", call. = FALSE)

join_coverage <- lapply(years, function(yr) {
  list(
    boundary_level = boundary_level,
    year = yr,
    matched_area_count = 20L,
    expected_area_count = 20L,
    missing_area_names = list()
  )
})

validation_checks <- c(
  "Dataflow-list cache contains 83_63_DF_DCCV_AVQ_PERSONE_136, labelled Religious observances - regions and type of municipality.",
  "DSD dimension order is FREQ, REF_AREA, DATA_TYPE, MEASURE, SEX, AGE, EDU_LEV_HIGHEST, LABOUR_PROFESS_STATUS_B, TIME_PERIOD.",
  "One data call retrieved annual HSC percentages for Italy plus the 20 regions, DATA_TYPE 6_WEEK_RELIG and 6_NEVER_RELIG, all available years.",
  "The product includes source years 2001-2003 and 2005-2025. The source pull does not publish 2004 for this table; no 2004 row is created.",
  "Every covered source year has all 20 regions for weekly attendance and never attending.",
  "All attendance percentages are within [0, 100].",
  "The official ISTAT boundary source has 20 non-empty valid region geometries; the simplified output also has 20 non-empty valid features and is below 800 KB.",
  "Sampling-error band values were not present in the SDMX machine-readable pull; the quality flag points readers to the annual Nota metodologica."
)

spot_checks <- lapply(seq_len(nrow(national_spot_checks_expected)), function(i) {
  list(
    year = national_spot_checks_expected[["year"]][i],
    source_area = "IT",
    weekly_attendance_percent = national_spot_checks_expected[["weekly_attendance_percent"]][i],
    never_attending_percent = national_spot_checks_expected[["never_attending_percent"]][i],
    status = "matched published national row in the ISTAT AVQ source table"
  )
})

raw_sources <- list(
  raw_source_record(
    dataflow_path, dataflow_meta_path, dataflow_url, "json", dataflow_dataset_id, TRUE, "not applicable",
    "Filtered locally to pin dataflow 83_63_DF_DCCV_AVQ_PERSONE_136. The API response contains the full IT1 allstubs list because the SDMX dataflow endpoint does not provide a text-search filter."
  ),
  raw_source_record(
    dsd_path, dsd_meta_path, dsd_url, "json", dsd_dataset_id, TRUE, "not applicable",
    "Dataflow metadata call with references=children; used to assert the DSD and dimension order."
  ),
  raw_source_record(
    codelist_path, codelist_meta_path, codelist_url, "json", codelist_dataset_id, TRUE, "not applicable",
    "Combined codelist call for the dimension codelists named by the DSD; used to pin DATA_TYPE labels and denominator codes."
  ),
  raw_source_record(
    attendance_path, attendance_meta_path, attendance_url, "csv", attendance_dataset_id, TRUE, paste(years, collapse = ","),
    "Single data call for annual HSC percentages, Italy plus 20 regions, DATA_TYPE 6_WEEK_RELIG and 6_NEVER_RELIG. The returned rows use SEX=9, AGE=Y_GE6, EDU=99 and LABOUR=99."
  ),
  raw_source_record(
    boundary_zip_path, boundary_zip_meta_path, boundary_url, "zip", boundary_dataset_id, TRUE, "2026",
    "ISTAT 2026 generalised administrative-boundary ZIP; only Reg01012026_g_WGS84 is used."
  ),
  raw_source_record(
    boundary_landing_path, boundary_landing_meta_path, boundary_landing_url, "html", boundary_landing_dataset_id, FALSE, "2026",
    "ISTAT boundary landing page cached for the 2026 generalised WGS84 link and boundary description."
  ),
  raw_source_record(
    legal_notice_path, legal_notice_meta_path, legal_notice_url, "html", legal_notice_dataset_id, FALSE, "not applicable",
    "ISTAT legal notice cached for the CC BY 4.0 licence statement."
  )
)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:it-attendance:it:2001-2025:istat-avq-region",
  dataset_id = "it-attendance:it:2001-2025:istat-avq-region",
  dataset_version_id = paste0("it-attendance:it:2001-2025:istat-avq-region:", substr(sha256_file(summary_json_out), 1, 12)),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "it-attendance",
  dataset_role = "public_product",
  scope = list(level = "country", country_codes = list(country_code),
               snapshot_date = NULL, snapshot_anchor = NULL, pipeline_stage = "public"),
  created_at = stamp,
  created_by = script_id,
  pipeline = list(
    script = script_id,
    git_commit = NULL,
    command = paste("Rscript", script_id),
    parameters = list(
      sdmx_dataflow_id = dataflow_id,
      sdmx_dataflow_label = dataflow_name,
      sdmx_queries = list(
        dataflow_list = dataflow_url,
        dsd = dsd_url,
        codelists = codelist_url,
        data = attendance_url
      ),
      coverage_decision = "include every source year published in the pulled regional table: 2001-2003 and 2005-2025; 2004 is absent and is not imputed",
      headline_metric = "weekly attendance at a place of worship, percent of resident population aged 6+",
      secondary_metric = "never attending a place of worship, percent of resident population aged 6+",
      denominator = population_basis_note,
      boundary_set = boundary_set_id,
      boundary_simplification = list(
        method = boundary_write[["method"]],
        clean_option = boundary_write[["clean_option"]],
        keep_percent = boundary_write[["keep_percent"]],
        bytes = boundary_write[["bytes"]],
        byte_ceiling = 800000L
      ),
      omitted_metrics = c("religious_affiliation", "places_per_10000_residents", "place_density_per_sq_km")
    ),
    software_versions = list(
      r = paste(R.version[["major"]], R.version[["minor"]], sep = "."),
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")),
      mapshaper = "npx --yes mapshaper"
    )
  ),
  source = list(
    provider = "Istat",
    source_dataset_ids = c(attendance_dataset_id, dataflow_dataset_id, dsd_dataset_id,
                           codelist_dataset_id, boundary_dataset_id,
                           boundary_landing_dataset_id, legal_notice_dataset_id),
    source_urls = c(dataflow_url, dsd_url, codelist_url, attendance_url,
                    boundary_url, boundary_landing_url, legal_notice_url, cc_by_url),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = licence_text,
    citation = "Istat, Aspetti della vita quotidiana (AVQ), religious observances by region and type of municipality; Istat, Confini delle unità amministrative a fini statistici, 2026.",
    raw_redistribution = "Raw SDMX responses, HTML pages and the source shapefile ZIP are not committed. They remain in gitignored data/raw/it_practice/ with SHA-256 sidecars."
  ),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = list(
    manifest_file_record(summary_json_out, "Italy regional area summary with AVQ self-reported weekly and never attendance metrics.", licence_status),
    manifest_file_record(summary_csv_out, "Flattened Italy regional area summary with AVQ self-reported weekly and never attendance metrics.", licence_status),
    manifest_file_record(boundary_out, "Simplified ISTAT 2026 generalised region boundary GeoJSON, 20 features.", licence_status)
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out),
         built_by = script_id, notes = sprintf("20 regions x %d source years; 2004 absent from source.", length(years))),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out),
         built_by = script_id, notes = sprintf("20 ISTAT region features simplified with %s at %g%% keep and %s.",
                                               boundary_write[["method"]], boundary_write[["keep_percent"]],
                                               boundary_write[["clean_option"]]))
  ),
  validation = list(
    tests = validation_checks,
    join_coverage = list(region = join_coverage),
    national_spot_checks = spot_checks,
    boundary_validation = list(
      source_region_count = 20L,
      output_feature_count = row_count_file(boundary_out),
      expected_feature_count = 20L,
      output_bytes = boundary_write[["bytes"]],
      simplification_method = boundary_write[["method"]],
      simplification_clean_option = boundary_write[["clean_option"]],
      simplification_keep_percent = boundary_write[["keep_percent"]],
      unmatched_boundary_features = list(),
      unmatched_attendance_regions = list()
    )
  ),
  construct_notes = list(
    construct_note,
    "The area-summary schema currently uses legacy metric keys religious_affiliation_percent and no_religion_percent. In this Italy product those keys are mapped to weekly attendance percent and never-attending percent respectively; the indicators and visual layer labels carry the practice construct.",
    population_basis_note,
    "The SDMX pull gives point estimates only. Regional estimates are sample-survey estimates with sampling error; sampling-error bands should be taken from the annual Nota metodologica when a page or report needs bands.",
    "CC BY 4.0 attribution: Istat."
  ),
  privacy = "public",
  licence_status = licence_status,
  licence_basis = licence_basis,
  downstream_status = "public",
  source_datasets = source_datasets(),
  notes = "The committed products contain derived AVQ practice estimates and the simplified ISTAT regional boundary. The Italy region page, hub card and overview are out of scope for this lane."
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE,
           null = "null", na = "null", digits = NA)
manifest_text <- paste(readLines(manifest_out, warn = FALSE), collapse = "\n")
if (!jsonlite::validate(manifest_text)) stop("manifest JSON failed jsonlite validation", call. = FALSE)

cat(sprintf("wrote %s: %d rows\n", summary_json_out, length(rows)))
cat(sprintf("wrote %s: %d rows\n", summary_csv_out, row_count_file(summary_csv_out)))
cat(sprintf("wrote %s: %d features, %d bytes with %s at %g%% keep, %s\n",
            boundary_out, row_count_file(boundary_out), as.integer(file_bytes(boundary_out)),
            boundary_write[["method"]], boundary_write[["keep_percent"]],
            boundary_write[["clean_option"]]))
cat(sprintf("wrote %s\n", manifest_out))
