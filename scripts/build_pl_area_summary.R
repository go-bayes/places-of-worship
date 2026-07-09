# build the poland diocesan catholic-practice area-summary product from iskk.
# inputs: transcribed iskk annual dominicantes/communicantes rates, the
# 41-feature post-2004 diocese boundary layer, and the raw provenance metadata.
# outputs: apps/regions/pl/data/area_summary_diocese.{json,csv} and
# docs/manifests/pl-attendance-2014-2024.json.
# run from the repo root: Rscript scripts/build_pl_area_summary.R

suppressMessages({
  library(jsonlite)
  library(sf)
})

raw_dir <- "data/raw/pl_practice"
pl_dir <- "apps/regions/pl/data"
manifest_dir <- "docs/manifests"
dir.create(pl_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
script_id <- "scripts/build_pl_area_summary.R"
country_code <- "PL"
retrieval_date <- "2026-07-09"

rates_path <- file.path(raw_dir, "iskk_diocese_rates.csv")
rates_meta_path <- file.path(raw_dir, "iskk_diocese_rates_meta.json")
name_concordance_path <- file.path(raw_dir, "diocese_names.csv")
boundary_path <- file.path(pl_dir, "pl_diocese_2004.geojson")
boundary_meta_path <- file.path(raw_dir, "pl_diocese_2004_meta.json")
digitisation_report_path <- file.path(raw_dir, "digitisation_report.json")

summary_json_out <- file.path(pl_dir, "area_summary_diocese.json")
summary_csv_out <- file.path(pl_dir, "area_summary_diocese.csv")
manifest_out <- file.path(manifest_dir, "pl-attendance-2014-2024.json")

boundary_set_id <- "pl_diocese_2004"
boundary_level <- "diocese"
attendance_dataset_id <- "iskk-dominicantes-communicantes-diocese-2014-2024"
source_pdf_dataset_id <- "iskk-annuarium-statisticum-ecclesiae-in-polonia"
boundary_dataset_id <- "pl-diocese-2004-mixed-osm-gisco-gmina"
name_concordance_dataset_id <- "pl-diocese-name-concordance-draft"
digitisation_dataset_id <- "pl-diocese-2004-gmina-digitisation-report"

expected_years <- c(2014L:2019L, 2021L:2024L)
expected_area_count <- 41L

obligati_basis_note <- paste(
  "Rates ship without a count base. ISKK dominicantes and communicantes",
  "are counts-based percentages over obligati: Catholics obliged to attend",
  "Sunday Mass, excluding children under seven, the sick and infirm, the",
  "very elderly, and travellers. ISKK counts one October or November Sunday",
  "per year. The 2020 count did not take place because of COVID-19, and",
  "2013 is not freely published."
)
slot_warning <- paste(
  "The area-summary schema uses legacy field slots. In this Poland product,",
  "religious_affiliation_percent stores dominicantes and no_religion_percent",
  "stores communicantes. Both values are Catholic practice rates over",
  "obligati, never affiliation, and never population shares."
)
boundary_licence_note <- paste(
  "The 41-diocese boundary layer mixes 24 OpenStreetMap religious",
  "administration anchor polygons, attributed to © OpenStreetMap",
  "contributors under the Open Database Licence (ODbL), with 17 polygons",
  "digitised from Eurostat/GISCO Local Administrative Units 2024 gmina",
  "geometry. The digitisation method is gmina_digitisation_from_GISCO_LAU_2024",
  "with Wikipedia deanery evidence; authoritative GIS-Expert/KUL polygons",
  "remain pending."
)

iskk_pdf_index_url <- "https://iskk.pl/publikacje/"
iskk_dashboard_url <- "https://iskk.pl/dominicantes/"
gisco_lau_download_url <- "https://gisco-services.ec.europa.eu/distribution/v2/lau/geojson/LAU_RG_01M_2024_4326.geojson"
gisco_lau_page_url <- "https://gisco-services.ec.europa.eu/distribution/v2/lau/download/"
odbl_url <- "https://opendatacommons.org/licenses/odbl/"
osm_url <- "https://www.openstreetmap.org/"
gis_expert_url <- "https://www.gis-expert.pl/mapy-religijnosci-polakow"

# map exact iskk table labels to the boundary area_code values.
iskk_to_area_code <- c(
  "białostocka" = "bialystok",
  "bielsko-żywiecka" = "bielsko_zywiec",
  "bydgoska" = "bydgoszcz",
  "częstochowska" = "czestochowa",
  "drohiczyńska" = "drohiczyn",
  "elbląska" = "elblag",
  "ełcka" = "elk",
  "gdańska" = "gdansk",
  "gliwicka" = "gliwice",
  "gnieźnieńska" = "gniezno",
  "kaliska" = "kalisz",
  "katowicka" = "katowice",
  "kielecka" = "kielce",
  "koszalińsko-kołobrzeska" = "koszalin_kolobrzeg",
  "krakowska" = "krakow",
  "legnicka" = "legnica",
  "lubelska" = "lublin",
  "łomżyńska" = "lomza",
  "łowicka" = "lowicz",
  "łódzka" = "lodz",
  "opolska" = "opole",
  "pelplińska" = "pelplin",
  "płocka" = "plock",
  "poznańska" = "poznan",
  "przemyska" = "przemysl",
  "radomska" = "radom",
  "rzeszowska" = "rzeszow",
  "sandomierska" = "sandomierz",
  "siedlecka" = "siedlce",
  "sosnowiecka" = "sosnowiec",
  "szczecińsko-kamieńska" = "szczecin_kamien",
  "świdnicka" = "swidnica",
  "tarnowska" = "tarnow",
  "toruńska" = "torun",
  "warmińska" = "warmia",
  "warszawska" = "warszawa",
  "warszawsko-praska" = "warszawa_praga",
  "włocławska" = "wloclawek",
  "wrocławska" = "wroclaw",
  "zamojsko-lubaczowska" = "zamosc_lubaczow",
  "zielonogórsko-gorzowska" = "zielona_gora_gorzow"
)

required_sources <- c(
  rates_path,
  rates_meta_path,
  name_concordance_path,
  boundary_path,
  boundary_meta_path,
  digitisation_report_path
)

# stop early when a cached local source is absent.
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

# count rows or features for CSV, GeoJSON, and area-summary JSON files.
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) {
    return(max(0L, length(readLines(path, warn = FALSE, encoding = "UTF-8")) - 1L))
  }
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

# read a scalar GeoJSON property and normalise null to NA.
feature_property <- function(feature, key, default = NA) {
  value <- feature[["properties"]][[key]]
  if (is.null(value)) return(default)
  value
}

# convert a data frame to a list of row records for JSON arrays.
dataframe_records <- function(data) {
  if (nrow(data) == 0L) return(list())
  lapply(seq_len(nrow(data)), function(i) as.list(data[i, , drop = FALSE]))
}

# read the 41-feature boundary layer and expose only row-level properties.
read_boundary <- function(path) {
  geo <- fromJSON(path, simplifyVector = FALSE)
  features <- geo[["features"]]
  if (length(features) != expected_area_count) {
    stop("expected 41 diocese boundary features, found ", length(features), call. = FALSE)
  }

  boundary <- data.frame(
    area_code = vapply(features, feature_property, character(1), key = "area_code", default = NA_character_),
    area_name = vapply(features, feature_property, character(1), key = "area_name", default = NA_character_),
    area_name_en = vapply(features, feature_property, character(1), key = "area_name_en", default = NA_character_),
    boundary_set_id = vapply(features, feature_property, character(1), key = "boundary_set_id", default = NA_character_),
    boundary_level = vapply(features, feature_property, character(1), key = "boundary_level", default = NA_character_),
    boundary_basis = vapply(features, feature_property, character(1), key = "boundary_basis", default = NA_character_),
    confidence = vapply(features, feature_property, character(1), key = "confidence", default = NA_character_),
    computed_area_km2 = vapply(features, feature_property, numeric(1), key = "computed_area_km2", default = NA_real_),
    published_area_km2 = vapply(features, feature_property, numeric(1), key = "published_area_km2", default = NA_real_),
    published_area_deviation_percent = vapply(features, feature_property, numeric(1), key = "published_area_deviation_percent", default = NA_real_),
    stringsAsFactors = FALSE
  )

  if (anyDuplicated(boundary[["area_code"]])) stop("duplicate boundary area_code", call. = FALSE)
  if (!all(boundary[["boundary_set_id"]] == boundary_set_id)) stop("unexpected boundary_set_id", call. = FALSE)
  if (!all(boundary[["boundary_level"]] == boundary_level)) stop("unexpected boundary_level", call. = FALSE)
  if (any(is.na(boundary[["computed_area_km2"]]))) {
    # osm anchor features omit the area property; compute it from geometry
    boundary_sf <- st_read(path, quiet = TRUE)
    boundary_area <- st_transform(boundary_sf, 2180)
    computed_by_code <- setNames(as.numeric(st_area(boundary_area)) / 1e6,
                                 boundary_sf[["area_code"]])
    fill_idx <- is.na(boundary[["computed_area_km2"]])
    boundary[["computed_area_km2"]][fill_idx] <- computed_by_code[boundary[["area_code"]][fill_idx]]
  }
  if (any(is.na(boundary[["computed_area_km2"]]))) stop("boundary layer lacks computable areas", call. = FALSE)
  boundary[order(boundary[["area_code"]]), ]
}

# read and validate the transcribed ISKK practice-rate table.
read_rates <- function(path) {
  rates <- read.csv(path, stringsAsFactors = FALSE, check.names = FALSE, fileEncoding = "UTF-8")
  required_cols <- c(
    "year", "diocese_name_iskk", "dominicantes_percent",
    "communicantes_percent", "source_document", "source_table", "source_page"
  )
  missing_cols <- setdiff(required_cols, names(rates))
  if (length(missing_cols) > 0L) {
    stop("ISKK rates CSV is missing columns: ", paste(missing_cols, collapse = ", "), call. = FALSE)
  }

  rates[["year"]] <- as.integer(rates[["year"]])
  rates[["dominicantes_percent"]] <- as.numeric(rates[["dominicantes_percent"]])
  rates[["communicantes_percent"]] <- as.numeric(rates[["communicantes_percent"]])
  rates[["source_page"]] <- as.integer(rates[["source_page"]])

  years <- sort(unique(rates[["year"]]))
  if (!identical(years, expected_years)) {
    stop("unexpected ISKK year coverage: ", paste(years, collapse = ", "), call. = FALSE)
  }
  if (nrow(rates) != (expected_area_count + 1L) * length(expected_years)) {
    stop("expected 420 ISKK rows including Ogółem, found ", nrow(rates), call. = FALSE)
  }
  if (any(is.na(rates[["dominicantes_percent"]]) | rates[["dominicantes_percent"]] < 0 |
          rates[["dominicantes_percent"]] > 100)) {
    stop("dominicantes values must be non-missing percentages within [0, 100]", call. = FALSE)
  }
  if (any(is.na(rates[["communicantes_percent"]]) | rates[["communicantes_percent"]] < 0 |
          rates[["communicantes_percent"]] > 100)) {
    stop("communicantes values must be non-missing percentages within [0, 100]", call. = FALSE)
  }

  rates
}

# verify the explicit concordance against the draft concordance file.
validate_concordance <- function(boundary) {
  concordance <- read.csv(name_concordance_path, stringsAsFactors = FALSE, check.names = FALSE,
                          fileEncoding = "UTF-8")
  if (!all(c("area_code", "polish_official_name") %in% names(concordance))) {
    stop("draft diocese name concordance lacks required columns", call. = FALSE)
  }
  if (length(iskk_to_area_code) != expected_area_count) {
    stop("explicit ISKK concordance must contain 41 dioceses", call. = FALSE)
  }
  if (anyDuplicated(names(iskk_to_area_code)) || anyDuplicated(unname(iskk_to_area_code))) {
    stop("explicit ISKK concordance has duplicate names or area codes", call. = FALSE)
  }
  missing_from_boundary <- setdiff(unname(iskk_to_area_code), boundary[["area_code"]])
  if (length(missing_from_boundary) > 0L) {
    stop("explicit ISKK concordance maps to unknown boundary area_code values: ",
         paste(missing_from_boundary, collapse = ", "), call. = FALSE)
  }
  missing_from_draft <- setdiff(unname(iskk_to_area_code), concordance[["area_code"]])
  if (length(missing_from_draft) > 0L) {
    stop("explicit ISKK concordance maps area codes absent from draft CSV: ",
         paste(missing_from_draft, collapse = ", "), call. = FALSE)
  }
  invisible(TRUE)
}

# build a compact quality flag that carries joined boundary provenance.
quality_flag_for_boundary <- function(boundary_row) {
  confidence <- boundary_row[["confidence"]]
  if (is.na(confidence) || !nzchar(confidence)) confidence <- "null"
  paste(
    paste0("boundary_basis=", boundary_row[["boundary_basis"]]),
    paste0("confidence=", confidence),
    "counts_based_practice_rate",
    "obligati_denominator",
    "single_count_sunday",
    sep = ";"
  )
}

# join rates to boundaries and return area-summary rows plus audit tables.
build_rows <- function(rates, boundary) {
  national <- rates[rates[["diocese_name_iskk"]] == "Ogółem", ]
  dioceses <- rates[rates[["diocese_name_iskk"]] != "Ogółem", ]

  if (nrow(national) != length(expected_years)) {
    stop("expected one Ogółem context row per source year", call. = FALSE)
  }
  missing_iskk_names <- setdiff(unique(dioceses[["diocese_name_iskk"]]), names(iskk_to_area_code))
  if (length(missing_iskk_names) > 0L) {
    stop("unjoined ISKK diocese names: ", paste(missing_iskk_names, collapse = ", "), call. = FALSE)
  }
  missing_expected_names <- setdiff(names(iskk_to_area_code), unique(dioceses[["diocese_name_iskk"]]))
  if (length(missing_expected_names) > 0L) {
    stop("expected ISKK diocese names absent from CSV: ",
         paste(missing_expected_names, collapse = ", "), call. = FALSE)
  }

  dioceses[["area_code"]] <- unname(iskk_to_area_code[dioceses[["diocese_name_iskk"]]])
  boundary_index <- match(dioceses[["area_code"]], boundary[["area_code"]])
  if (any(is.na(boundary_index))) {
    unjoined <- dioceses[["diocese_name_iskk"]][is.na(boundary_index)]
    stop("ISKK names mapped to missing boundary features: ", paste(unjoined, collapse = ", "), call. = FALSE)
  }

  join_summary <- do.call(rbind, lapply(expected_years, function(year_value) {
    year_rows <- dioceses[dioceses[["year"]] == year_value, ]
    missing_area_codes <- setdiff(boundary[["area_code"]], year_rows[["area_code"]])
    duplicate_area_codes <- unique(year_rows[["area_code"]][duplicated(year_rows[["area_code"]])])
    national_context_row <- national[national[["year"]] == year_value, ]
    data.frame(
      boundary_level = boundary_level,
      year = year_value,
      matched_area_count = length(unique(year_rows[["area_code"]])),
      expected_area_count = expected_area_count,
      national_context_row_present = nrow(national_context_row) == 1L,
      missing_area_names = paste(missing_area_codes, collapse = "|"),
      duplicate_area_codes = paste(duplicate_area_codes, collapse = "|"),
      stringsAsFactors = FALSE
    )
  }))

  failed <- join_summary[join_summary[["matched_area_count"]] != expected_area_count |
                           nzchar(join_summary[["missing_area_names"]]) |
                           nzchar(join_summary[["duplicate_area_codes"]]) |
                           !join_summary[["national_context_row_present"]], ]
  if (nrow(failed) > 0L) {
    print(failed, row.names = FALSE)
    stop("hard gate failed: every year must join 41/41 dioceses", call. = FALSE)
  }

  dioceses <- dioceses[order(dioceses[["year"]], dioceses[["area_code"]]), ]
  rows <- vector("list", nrow(dioceses))
  for (i in seq_len(nrow(dioceses))) {
    boundary_row <- boundary[boundary[["area_code"]] == dioceses[["area_code"]][i], ]
    if (nrow(boundary_row) != 1L) stop("boundary join failed for ", dioceses[["area_code"]][i], call. = FALSE)
    rows[[i]] <- list(
      country_code = country_code,
      boundary_set_id = boundary_set_id,
      boundary_level = boundary_level,
      area_unit_id = paste0(boundary_set_id, ":", dioceses[["area_code"]][i]),
      area_code = dioceses[["area_code"]][i],
      area_name = boundary_row[["area_name"]],
      year = as.integer(dioceses[["year"]][i]),
      population_total = NULL,
      population_total_basis = obligati_basis_note,
      religious_affiliation_count = NULL,
      religious_affiliation_percent = dioceses[["dominicantes_percent"]][i],
      no_religion_count = NULL,
      no_religion_percent = dioceses[["communicantes_percent"]][i],
      place_count = NULL,
      places_per_10000_residents = NULL,
      place_density_per_sq_km = NULL,
      land_area_sq_km = round(boundary_row[["computed_area_km2"]], 2),
      site_snapshot_date = NULL,
      place_count_basis = NULL,
      source_dataset_ids = c(attendance_dataset_id, boundary_dataset_id),
      quality_flag = quality_flag_for_boundary(boundary_row)
    )
  }

  national_context <- national[order(national[["year"]]), c(
    "year", "diocese_name_iskk", "dominicantes_percent", "communicantes_percent",
    "source_document", "source_table", "source_page"
  )]

  list(rows = rows, join_summary = join_summary, national_context = national_context)
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
      name = "ISKK Annuarium Statisticum diocese-level dominicantes and communicantes rates",
      provider = "Instytut Statystyki Kościoła Katolickiego (ISKK)",
      url = iskk_pdf_index_url,
      retrieval_date = retrieval_date,
      local_path = rates_path,
      licence = list(
        name = "Published aggregate figures in free public ISKK PDFs; reuse terms require review before broad redistribution",
        url = iskk_pdf_index_url,
        attribution = "Instytut Statystyki Kościoła Katolickiego"
      ),
      citation = "ISKK, Annuarium Statisticum Ecclesiae in Polonia, annual diocese-level dominicantes and communicantes tables.",
      access_limits = "The public PDFs expose aggregate diocese rates; parish-level panel data and the e-Dominicantes reporting workflow are not publicly downloadable as bulk data.",
      redistribution_limits = "The product redistributes derived diocese-year percentages with attribution and does not redistribute source PDFs.",
      notes = paste(
        "CSV rows retain Ogółem as national context and the 41 Latin-rite",
        "territorial dioceses for 2014-2019 and 2021-2024. 2020 has no count",
        "because of COVID-19. 2013 was not freely published in the source search."
      )
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "Poland post-2004 Catholic diocese boundary layer, mixed OSM and GISCO-gmina digitisation",
      provider = "OpenStreetMap contributors; Eurostat/GISCO; project digitisation",
      url = gisco_lau_page_url,
      retrieval_date = retrieval_date,
      local_path = boundary_path,
      licence = list(
        name = "Mixed boundary basis: ODbL OpenStreetMap anchors plus Eurostat/GISCO LAU-derived digitised polygons",
        url = odbl_url,
        attribution = "© OpenStreetMap contributors; Eurostat/GISCO Local Administrative Units 2024"
      ),
      citation = "Project-assembled post-2004 Poland Catholic diocese layer from OpenStreetMap religious-administration boundaries and Eurostat/GISCO LAU 2024 gmina geometry.",
      access_limits = "Authoritative GIS-Expert/KUL church polygons are not included; permission or purchase remains pending.",
      redistribution_limits = "The public layer must preserve OSM attribution, ODbL obligations for OSM-derived anchors, and Eurostat/GISCO source acknowledgement for digitised polygons.",
      notes = boundary_licence_note
    )
  )
}

# define the practice indicators represented in the legacy field slots.
indicators_for_diocese <- function() {
  temporal <- "2014-2019 and 2021-2024 (2020 no count; 2013 not freely published)"
  list(
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Mass attendance (dominicantes), % of obliged Catholics",
      description = paste(
        "Legacy area-summary field slot used for dominicantes. This value is",
        "a counts-based Mass-attendance rate over obligati, never affiliation,",
        "and never a population share."
      ),
      unit = "percent",
      denominator_indicator_id = NULL,
      method = "ISKK dominicantes: persons physically present at Sunday Mass on the annual count Sunday divided by obligati.",
      temporal_coverage = temporal,
      spatial_coverage = "41 Latin-rite territorial Catholic dioceses in Poland on post-2004 boundaries.",
      quality_notes = obligati_basis_note
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "Communion (communicantes), % of obliged Catholics",
      description = paste(
        "Legacy area-summary field slot used for communicantes. This value is",
        "a counts-based Communion rate over obligati, never no-religion",
        "affiliation, never religious affiliation, and never a population share."
      ),
      unit = "percent",
      denominator_indicator_id = NULL,
      method = "ISKK communicantes: persons receiving communion on the annual count Sunday divided by obligati.",
      temporal_coverage = temporal,
      spatial_coverage = "41 Latin-rite territorial Catholic dioceses in Poland on post-2004 boundaries.",
      quality_notes = obligati_basis_note
    )
  )
}

# define the choropleth layers represented by the practice product.
visual_layers_for_diocese <- function() {
  list(
    list(
      visual_layer_id = "pl-diocese-dominicantes",
      label = "Mass attendance (dominicantes), % of obliged Catholics",
      description = "Counts-based Mass-attendance rate over obligati by Catholic diocese.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "obliged Catholics (obligati)"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported ISKK diocese rate",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = "This layer reports Catholic practice rather than religious affiliation."
    ),
    list(
      visual_layer_id = "pl-diocese-communicantes",
      label = "Communion (communicantes), % of obliged Catholics",
      description = "Counts-based communion rate over obligati by Catholic diocese.",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "obliged Catholics (obligati)"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported ISKK diocese rate",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = "This layer reports Catholic practice rather than no-religion affiliation."
    )
  )
}

# assemble the area-summary document.
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
      vintage = "2004-present",
      source_dataset_id = boundary_dataset_id
    ),
    site_snapshot = list(
      source_dataset_id = NULL,
      snapshot_date = NULL,
      basis = "no governed Poland OpenStreetMap place-of-worship snapshot is included in this practice-lane release",
      notes = "The Poland practice lane exposes ISKK Catholic practice rates by diocese only; place-density metrics are null."
    ),
    source_datasets = source_datasets(),
    indicators = indicators_for_diocese(),
    visual_layers = visual_layers_for_diocese(),
    rows = rows
  )
}

# create a manifest durable-file record for one local output or reused layer.
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

# create a manifest raw-source record for a local file with computed metadata.
raw_file_record <- function(path, url, format, source_id, used, periods, notes) {
  list(
    uri = path,
    url = url,
    format = format,
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    source_dataset_id = source_id,
    used_in_public_product = used,
    periods = periods,
    retrieved_at = NULL,
    http_status = NULL,
    notes = notes
  )
}

# create manifest records for ISKK PDFs, using SHA-256s pinned in raw metadata.
iskk_pdf_records <- function(rates_meta) {
  docs <- rates_meta[["source_documents"]]
  lapply(names(docs), function(year_key) {
    doc <- docs[[year_key]]
    table <- doc[["source_table_diocese"]]
    page <- doc[["source_page_diocese"]]
    if (is.null(table)) table <- "no diocese table"
    if (is.null(page)) page <- "not applicable"
    list(
      uri = doc[["path"]],
      url = doc[["url"]],
      format = "pdf",
      bytes = doc[["bytes"]],
      sha256 = doc[["sha256"]],
      source_dataset_id = source_pdf_dataset_id,
      used_in_public_product = year_key %in% as.character(expected_years),
      periods = year_key,
      retrieved_at = doc[["download_timestamp_utc"]],
      http_status = 200L,
      notes = paste("Source document", doc[["source_document"]], "table:", table, "page:", page)
    )
  })
}

# summarise the boundary basis and confidence flags for manifest validation.
boundary_summary <- function(boundary) {
  basis_counts <- as.data.frame(table(boundary[["boundary_basis"]]), stringsAsFactors = FALSE)
  names(basis_counts) <- c("boundary_basis", "feature_count")
  confidence_values <- ifelse(is.na(boundary[["confidence"]]), "null", boundary[["confidence"]])
  confidence_counts <- as.data.frame(table(confidence_values), stringsAsFactors = FALSE)
  names(confidence_counts) <- c("confidence", "feature_count")
  list(
    feature_count = nrow(boundary),
    boundary_basis_counts = dataframe_records(basis_counts),
    confidence_counts = dataframe_records(confidence_counts),
    low_confidence_area_codes = boundary[["area_code"]][!is.na(boundary[["confidence"]]) &
                                                           boundary[["confidence"]] == "low"]
  )
}

# build the manifest document for the Poland attendance product.
manifest_document <- function(rows, join_summary, national_context, boundary, rates_meta) {
  wikipedia <- rates_meta[["cross_checks"]][["wikipedia"]]
  deferred <- list(
    list(item = "2013", status = "deferred", reason = rates_meta[["years_without_csv_rows"]][["2013"]]),
    list(item = "2020", status = "deferred", reason = rates_meta[["years_without_csv_rows"]][["2020"]]),
    list(item = "pre-2014 series", status = "deferred",
         reason = "Earlier public series work needs source extraction plus period-specific diocese boundaries and concordances."),
    list(item = "authoritative polygons", status = "deferred",
         reason = "GIS-Expert/KUL polygons remain pending permission or purchase; the current layer uses OSM anchors and GISCO-gmina digitisation.")
  )
  validation_tests <- c(
    "CSV coverage is exactly 420 rows: Ogółem plus 41 Latin-rite territorial dioceses for each of ten counted years.",
    "Ogółem is retained as national reconciliation context and excluded from the 410 area-summary rows.",
    "The explicit ISKK-name concordance maps every non-national source row to a boundary area_code.",
    "Every product year joins 41/41 dioceses; missing and duplicate area codes are hard failures.",
    "Dominicantes and communicantes values are non-missing percentages within [0, 100].",
    paste0(
      "Wikipedia cross-check from raw metadata compared ", wikipedia[["comparisons_count"]],
      " retained rows for 2022-2024; discrepancies recorded: ",
      wikipedia[["discrepancies_count"]], "."
    ),
    "The boundary layer has 41 features and carries boundary_basis plus confidence into every row quality_flag."
  )
  raw_sources <- c(
    list(
      raw_file_record(
        rates_path, iskk_pdf_index_url, "csv", attendance_dataset_id, TRUE,
        paste(expected_years, collapse = ","),
        "Transcribed ISKK diocese-level dominicantes and communicantes rates; Ogółem retained for context only."
      ),
      raw_file_record(
        rates_meta_path, iskk_pdf_index_url, "json", attendance_dataset_id, TRUE,
        paste(expected_years, collapse = ","),
        "Raw metadata with source PDF URLs, hashes, source-table provenance, validation, and Wikipedia cross-check results."
      )
    ),
    iskk_pdf_records(rates_meta),
    list(
      raw_file_record(
        name_concordance_path, NULL, "csv", name_concordance_dataset_id, TRUE,
        "not applicable",
        "Draft source-name concordance; the build script contains the explicit audited ISKK-name mapping."
      ),
      raw_file_record(
        boundary_path, gisco_lau_page_url, "geojson", boundary_dataset_id, TRUE,
        "2004-present",
        boundary_licence_note
      ),
      raw_file_record(
        boundary_meta_path, osm_url, "json", boundary_dataset_id, TRUE,
        "2004-present",
        "Boundary assembly metadata for the OSM extraction route and rejected incomplete OSM-only layer."
      ),
      raw_file_record(
        digitisation_report_path, gisco_lau_download_url, "json", digitisation_dataset_id, TRUE,
        "2004-present",
        "Digitisation report documenting the GISCO LAU gmina source, the method, validation, and low-confidence dioceses."
      )
    )
  )
  source_urls <- unique(c(
    vapply(rates_meta[["source_documents"]], `[[`, character(1), "url"),
    iskk_pdf_index_url,
    iskk_dashboard_url,
    osm_url,
    odbl_url,
    gisco_lau_page_url,
    gisco_lau_download_url,
    gis_expert_url
  ))

  list(
    "$schema" = "../../schemas/data-manifest.schema.json",
    schema_version = "data-manifest.v1",
    manifest_id = "manifest:pl-attendance:pl:2014-2024:iskk-diocese",
    dataset_id = "pl-attendance:pl:2014-2024:iskk-diocese",
    dataset_version_id = paste0("pl-attendance:pl:2014-2024:iskk-diocese:", substr(sha256_file(summary_json_out), 1, 12)),
    manifest_sha256 = NULL,
    supersedes_manifest_id = NULL,
    superseded_by_manifest_id = NULL,
    dataset_family = "pl-attendance",
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
        coverage_decision = "ship 2014-2019 and 2021-2024; omit 2020 because no count occurred and omit 2013 because no free source PDF was found",
        headline_metric = "Mass attendance (dominicantes), % of obliged Catholics",
        secondary_metric = "Communion (communicantes), % of obliged Catholics",
        denominator = obligati_basis_note,
        boundary_set = boundary_set_id,
        row_count = length(rows),
        expected_join = "41 dioceses per counted year",
        legacy_slot_mapping = list(
          religious_affiliation_percent = "dominicantes_percent",
          no_religion_percent = "communicantes_percent"
        ),
        omitted_metrics = c("population_total", "religious_affiliation_count",
                            "no_religion_count", "places_per_10000_residents",
                            "place_density_per_sq_km")
      ),
      software_versions = list(
        r = paste(R.version[["major"]], R.version[["minor"]], sep = "."),
        jsonlite = as.character(packageVersion("jsonlite")),
        sf = as.character(packageVersion("sf"))
      )
    ),
    source = list(
      provider = "Instytut Statystyki Kościoła Katolickiego; OpenStreetMap contributors; Eurostat/GISCO",
      source_dataset_ids = c(attendance_dataset_id, source_pdf_dataset_id, boundary_dataset_id,
                             name_concordance_dataset_id, digitisation_dataset_id),
      source_urls = source_urls,
      retrieved_at = rates_meta[["created_at_utc"]],
      licence = paste(
        "ISKK rates are published aggregate figures in free public PDFs and are used with attribution.",
        boundary_licence_note
      ),
      citation = "ISKK, Annuarium Statisticum Ecclesiae in Polonia; © OpenStreetMap contributors; Eurostat/GISCO Local Administrative Units 2024.",
      raw_redistribution = "The committed product contains derived rates and a mixed-source boundary layer; source PDFs and raw boundary caches remain in data/raw/pl_practice/."
    ),
    input_manifests = list(),
    raw_sources = raw_sources,
    durable_files = list(
      manifest_file_record(summary_json_out, "Poland diocesan area summary with ISKK dominicantes and communicantes practice rates.", "needs_review"),
      manifest_file_record(summary_csv_out, "Flattened Poland diocesan area summary with ISKK dominicantes and communicantes practice rates.", "needs_review"),
      manifest_file_record(boundary_path, "Poland post-2004 Catholic diocese boundary GeoJSON, 41 features.", "needs_review")
    ),
    derived_outputs = list(
      list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out),
           built_by = script_id, notes = "41 dioceses x 10 counted years = 410 rows."),
      list(uri = paste0("repo:", summary_csv_out), sha256 = sha256_file(summary_csv_out),
           built_by = script_id, notes = "Flattened CSV sidecar for the 410-row Poland diocese practice product.")
    ),
    validation = list(
      status = "passed_with_warnings",
      commands = list(paste("Rscript", script_id)),
      tests = validation_tests,
      join_coverage = list(diocese = dataframe_records(join_summary)),
      national_context_rows = dataframe_records(national_context),
      wikipedia_cross_check = wikipedia,
      boundary_validation = boundary_summary(boundary),
      warnings = c(
        "Seven gmina-digitised boundary features are flagged low confidence.",
        "The boundary layer remains provisional pending authoritative GIS-Expert/KUL polygons.",
        "ISKK reuse terms should be confirmed before broad redistribution."
      ),
      notes = "Validation passed for source coverage, 41/41 joins per year, JSON syntax, row count, and boundary provenance flags."
    ),
    construct_notes = list(
      slot_warning,
      obligati_basis_note,
      "The national Ogółem row is not a diocese and is not written to area-summary rows.",
      boundary_licence_note
    ),
    deferred_items = deferred,
    privacy = "public",
    licence_status = "needs_review",
    downstream_status = "public",
    source_datasets = source_datasets(),
    notes = "The Poland practice lane area-summary product is a data product only; page, index, and hub wiring are out of scope for this lane."
  )
}

invisible(lapply(required_sources, require_file))

rates_meta <- fromJSON(rates_meta_path, simplifyVector = FALSE)
boundary <- read_boundary(boundary_path)
validate_concordance(boundary)
rates <- read_rates(rates_path)
joined <- build_rows(rates, boundary)
rows <- joined[["rows"]]
join_summary <- joined[["join_summary"]]
national_context <- joined[["national_context"]]

if (length(rows) != expected_area_count * length(expected_years)) {
  stop("expected 410 area-summary rows, found ", length(rows), call. = FALSE)
}

write_json(
  area_summary_document(rows),
  summary_json_out,
  auto_unbox = TRUE,
  pretty = TRUE,
  null = "null",
  na = "null",
  digits = NA
)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "", fileEncoding = "UTF-8")

summary_text <- paste(readLines(summary_json_out, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
if (!jsonlite::validate(summary_text)) stop("area-summary JSON failed jsonlite validation", call. = FALSE)
if (row_count_file(summary_json_out) != 410L || row_count_file(summary_csv_out) != 410L) {
  stop("area-summary row-count validation failed", call. = FALSE)
}

manifest <- manifest_document(rows, join_summary, national_context, boundary, rates_meta)
write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE,
           null = "null", na = "null", digits = NA)
manifest_text <- paste(readLines(manifest_out, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
if (!jsonlite::validate(manifest_text)) stop("manifest JSON failed jsonlite validation", call. = FALSE)

cat("join coverage:\n")
print(join_summary[, c("year", "matched_area_count", "expected_area_count",
                       "national_context_row_present")], row.names = FALSE)
cat(sprintf("wrote %s: %d rows\n", summary_json_out, row_count_file(summary_json_out)))
cat(sprintf("wrote %s: %d rows\n", summary_csv_out, row_count_file(summary_csv_out)))
cat(sprintf("wrote %s\n", manifest_out))
cat("indicators:\n")
for (indicator in indicators_for_diocese()) {
  cat(sprintf("- %s: %s\n", indicator[["indicator_id"]], indicator[["label"]]))
}
