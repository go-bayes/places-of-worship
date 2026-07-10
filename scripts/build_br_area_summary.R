# build the brazil area-summary products from IBGE SIDRA census religion data.
# inputs: IBGE SIDRA aggregate 137 for 2000/2010, SIDRA aggregate 9537 for
# 2022, IBGE 2022 malhas, and IBGE localities metadata. Raw API responses are
# cached under data/raw/br_census/ and remain ignored.
# outputs: apps/regions/br/data/br_{municipality,uf}_2022.geojson,
# apps/regions/br/data/area_summary_{municipality,uf}.{json,csv}, and
# docs/manifests/br-census-religion-2000-2022.json.
# run from the repo root: Rscript scripts/build_br_area_summary.R

suppressMessages({
  library(sf)
  library(jsonlite)
})

raw_dir <- "data/raw/br_census"
br_dir <- "apps/regions/br/data"
manifest_dir <- "docs/manifests"
dir.create(raw_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(br_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- format(Sys.Date(), "%Y-%m-%d")
refresh_sources <- identical(Sys.getenv("BR_CENSUS_REFRESH"), "1")
rate_limit_sleep <- 0.25

census_137_dataset_id <- "ibge-sidra-137-religion-2000-2010"
census_9537_dataset_id <- "ibge-sidra-9537-religion-age10plus-2022"
municipality_boundary_dataset_id <- "ibge-malhas-municipality-2022"
uf_boundary_dataset_id <- "ibge-malhas-uf-2022"
localities_dataset_id <- "ibge-localidades-municipios-ufs"
municipality_boundary_set_id <- "br-municipality-2022-ibge"
uf_boundary_set_id <- "br-uf-2022-ibge"

sidra_137_meta_url <- "https://servicodados.ibge.gov.br/api/v3/agregados/137/metadados"
sidra_9537_meta_url <- "https://servicodados.ibge.gov.br/api/v3/agregados/9537/metadados"
municipality_boundary_url <- "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio&periodo=2022"
uf_boundary_url <- "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=UF&periodo=2022"
municipality_localities_url <- "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado"
uf_localities_url <- "https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=id"
sidra_base_url <- "https://servicodados.ibge.gov.br/api/v3/agregados"

licence_text <- paste(
  "IBGE public API data; no explicit machine-readable redistribution licence",
  "was found in the SIDRA, malhas, or localities API responses during this",
  "build. Derived public products attribute Instituto Brasileiro de Geografia",
  "e Estatística (IBGE) and link to the source API URLs."
)

# compute the sha-256 digest for a local file.
sha256_file <- function(path) {
  unname(tools::sha256sum(path))
}

# return file size in bytes for manifest and source records.
file_bytes <- function(path) {
  as.integer(unname(file.info(path)[["size"]]))
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
    if (is.list(json)) return(length(json))
  }
  NA_integer_
}

# download one source file unless the cache should be reused.
download_source <- function(url, path) {
  if (!refresh_sources && file.exists(path)) {
    message("using cached ", path)
    return(invisible(FALSE))
  }
  message("downloading ", basename(path))
  utils::download.file(url, path, mode = "wb", quiet = TRUE)
  Sys.sleep(rate_limit_sleep)
  invisible(TRUE)
}

# construct a SIDRA aggregate query URL with encoded query parameters.
sidra_query_url <- function(aggregate_id, periods, variable_id, localities, classifications) {
  paste0(
    sidra_base_url, "/", aggregate_id, "/periodos/", periods, "/variaveis/", variable_id,
    "?localidades=", utils::URLencode(localities, reserved = TRUE),
    "&classificacao=", utils::URLencode(classifications, reserved = TRUE)
  )
}

# map the source Portuguese category to the compact analysis label.
normalise_religion_label <- function(label_pt) {
  label_map <- c(
    "Total" = "total",
    "Sem religião" = "no_religion",
    "Sem declaração" = "not_declared"
  )
  if (label_pt %in% names(label_map)) return(unname(label_map[[label_pt]]))
  "other"
}

# parse SIDRA's string values; in count tables "-" behaves as a zero cell.
parse_sidra_value <- function(value) {
  if (is.null(value) || !nzchar(value) || value %in% c("...", "X")) return(NA_real_)
  if (identical(value, "-")) return(0)
  as.numeric(gsub(",", ".", value, fixed = TRUE))
}

# read one SIDRA JSON response into long source rows.
parse_sidra_file <- function(path, aggregate_id, variable_id) {
  payload <- fromJSON(path, simplifyVector = FALSE)
  pieces <- list()
  index <- 1L
  for (variable in payload) {
    for (result in variable[["resultados"]]) {
      classifications <- result[["classificacoes"]]
      religion <- classifications[[which(vapply(classifications, function(item) item[["id"]] == "133", logical(1)))[1]]]
      category_id <- names(religion[["categoria"]])[[1]]
      category_label_pt <- unname(religion[["categoria"]][[1]])
      category_label_normalised <- normalise_religion_label(category_label_pt)
      for (series in result[["series"]]) {
        locality <- series[["localidade"]]
        area_code <- as.character(locality[["id"]])
        area_level_id <- locality[["nivel"]][["id"]]
        area_level_name <- locality[["nivel"]][["nome"]]
        for (year in names(series[["serie"]])) {
          value_raw <- series[["serie"]][[year]]
          value <- parse_sidra_value(value_raw)
          pieces[[index]] <- data.frame(
            aggregate_id = as.character(aggregate_id),
            variable_id = as.character(variable_id),
            variable_label = variable[["variavel"]],
            variable_unit = variable[["unidade"]],
            year = as.integer(year),
            area_level_id = area_level_id,
            area_level_name = area_level_name,
            area_code = area_code,
            area_name_source = locality[["nome"]],
            religion_classification_id = "133",
            religion_category_id = as.character(category_id),
            religion_label_pt = category_label_pt,
            religion_label_normalised = category_label_normalised,
            value_raw = value_raw,
            value = value,
            stringsAsFactors = FALSE
          )
          index <- index + 1L
        }
      }
    }
  }
  out <- do.call(rbind, pieces)
  out[order(out[["year"]], out[["area_code"]], out[["religion_category_id"]]), ]
}

# create one CSV row for the ignored raw-source catalogue.
source_record <- function(filename, url, publisher, notes, aggregate_id = NA_character_,
                          variable_id = NA_character_, classification_ids = NA_character_,
                          periods = NA_character_, territorial_level = NA_character_) {
  path <- file.path(raw_dir, filename)
  data.frame(
    filename = filename,
    url = url,
    retrieval_date = retrieval_date,
    publisher = publisher,
    licence_text = licence_text,
    sha256 = sha256_file(path),
    bytes = file_bytes(path),
    aggregate_id = aggregate_id,
    variable_id = variable_id,
    classification_ids = classification_ids,
    periods = periods,
    territorial_level = territorial_level,
    notes = notes,
    stringsAsFactors = FALSE
  )
}

# return the source dataset id for a census year.
census_dataset_for_year <- function(year) {
  if (year == 2022L) census_9537_dataset_id else census_137_dataset_id
}

# produce a compact count table from long SIDRA rows for one area/year.
counts_for_area_year <- function(source_rows, area_code, year) {
  hit <- source_rows[source_rows[["area_code"]] == area_code & source_rows[["year"]] == year, ]
  if (!nrow(hit)) return(NULL)
  values <- setNames(hit[["value"]], hit[["religion_label_normalised"]])
  list(
    total = values[["total"]],
    no_religion = values[["no_religion"]],
    not_declared = values[["not_declared"]]
  )
}

# build one row under the shared area-summary row contract.
build_area_row <- function(area, year, source_rows, boundary_set_id, boundary_level,
                           boundary_dataset_id, pre_2022_boundary_note) {
  counts <- counts_for_area_year(source_rows, area[["area_code"]], year)
  source_ids <- c(census_dataset_for_year(year), boundary_dataset_id, localities_dataset_id)
  flags <- character(0)
  if (year == 2022L) flags <- c(flags, "age_universe_10_plus")
  if (year < 2022L && nzchar(pre_2022_boundary_note)) flags <- c(flags, pre_2022_boundary_note)

  has_complete_counts <- !is.null(counts) && all(vapply(
    counts,
    function(value) length(value) == 1L && is.finite(value),
    logical(1)
  ))

  if (!has_complete_counts) {
    flags <- c(flags, "source_area_missing_or_suppressed_for_wave")
    population_total <- NULL
    affiliated <- NULL
    no_religion <- NULL
    pct_affiliated <- NULL
    pct_no_religion <- NULL
  } else {
    stated <- counts[["total"]] - counts[["not_declared"]]
    no_religion <- counts[["no_religion"]]
    affiliated <- stated - no_religion
    population_total <- as.integer(round(stated))
    pct_affiliated <- if (stated > 0) round(100 * affiliated / stated, 2) else NULL
    pct_no_religion <- if (stated > 0) round(100 * no_religion / stated, 2) else NULL
    affiliated <- as.integer(round(affiliated))
    no_religion <- as.integer(round(no_religion))
  }

  basis <- if (year == 2022L) {
    "people aged 10 years or older in SIDRA table 9537, variable 140, category Total minus Sem declaração"
  } else {
    "resident population in SIDRA table 137, variable 93, category Total minus Sem declaração"
  }

  list(
    country_code = "BR",
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = paste0(boundary_set_id, ":", area[["area_code"]]),
    area_code = area[["area_code"]],
    area_name = area[["area_name"]],
    year = year,
    population_total = population_total,
    population_total_basis = basis,
    religious_affiliation_count = affiliated,
    religious_affiliation_percent = pct_affiliated,
    no_religion_count = no_religion,
    no_religion_percent = pct_no_religion,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(area[["land_area_sq_km"]], 2),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = source_ids,
    quality_flag = paste(flags, collapse = ";")
  )
}

# flatten area-summary rows for the CSV sibling.
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
      population_total = if (is.null(row[["population_total"]])) NA_integer_ else row[["population_total"]],
      population_total_basis = row[["population_total_basis"]],
      religious_affiliation_count = if (is.null(row[["religious_affiliation_count"]])) NA_integer_ else row[["religious_affiliation_count"]],
      religious_affiliation_percent = if (is.null(row[["religious_affiliation_percent"]])) NA_real_ else row[["religious_affiliation_percent"]],
      no_religion_count = if (is.null(row[["no_religion_count"]])) NA_integer_ else row[["no_religion_count"]],
      no_religion_percent = if (is.null(row[["no_religion_percent"]])) NA_real_ else row[["no_religion_percent"]],
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

# create shared indicator metadata for one boundary level.
indicators_for_level <- function(boundary_label) {
  list(
    list(
      indicator_id = "population_total",
      label = "Religion-response denominator",
      description = "People in the SIDRA religion table after excluding Sem declaração. The 2022 denominator is limited to people aged 10 years or older.",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "For 2000 and 2010, SIDRA table 137 variable 93 category Total minus Sem declaração. For 2022, SIDRA table 9537 variable 140 category Total minus Sem declaração.",
      temporal_coverage = "2000, 2010, 2022",
      spatial_coverage = paste("Brazil", boundary_label, "on IBGE 2022 boundaries"),
      quality_notes = "The 2022 wave changes the age universe to people aged 10 years or older; 2000 and 2010 cover resident population."
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious affiliation %",
      description = "Share of the religion-response denominator not in the Sem religião category.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * (denominator minus Sem religião) / denominator.",
      temporal_coverage = "2000, 2010, 2022",
      spatial_coverage = paste("Brazil", boundary_label, "on IBGE 2022 boundaries"),
      quality_notes = "This is a non-no-religion share among responses with a religion-table category, not a harmonised denomination series. The 2022 age universe is not the same as the 2000/2010 universe."
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "No religion %",
      description = "Share of the religion-response denominator in the Sem religião category.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * Sem religião / denominator.",
      temporal_coverage = "2000, 2010, 2022",
      spatial_coverage = paste("Brazil", boundary_label, "on IBGE 2022 boundaries"),
      quality_notes = "The source category label is Sem religião in all three built waves."
    )
  )
}

# define the choropleth layers exposed by the shared region map.
visual_layers_for_level <- function(level_id) {
  list(
    list(
      visual_layer_id = paste0("br-", level_id, "-religious-affiliation"),
      label = "Religious affiliation %",
      description = "Brazil census religion-response affiliation share.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = NULL,
      colour_scale = "shared sequential blue",
      time_control = "year_selector",
      aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = "The 2022 wave is people aged 10 years or older; pre-2022 municipality rows use 2022 boundaries without a split/merge concordance."
    ),
    list(
      visual_layer_id = paste0("br-", level_id, "-no-religion"),
      label = "No religion %",
      description = "Brazil census religion-response no-religion share.",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = NULL,
      colour_scale = "shared sequential blue",
      time_control = "year_selector",
      aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = "The source category label is Sem religião."
    )
  )
}

# create a schema-compatible area-summary document for one level.
area_summary_document <- function(level_id, boundary_set_id, boundary_dataset_id,
                                  boundary_label, rows, source_datasets) {
  list(
    schema_version = "0.2.0",
    generated_at = stamp,
    generated_by = "scripts/build_br_area_summary.R",
    country_code = "BR",
    boundary_set = list(
      boundary_set_id = boundary_set_id,
      country_code = "BR",
      level = level_id,
      vintage = "2022",
      source_dataset_id = boundary_dataset_id
    ),
    site_snapshot = list(
      source_dataset_id = NULL,
      snapshot_date = NULL,
      basis = "no governed Brazil OpenStreetMap place-of-worship snapshot is included in this country data-map release",
      notes = "The Brazil page exposes census affiliation and no-religion metrics only; place-density metrics are hidden until a governed Brazil place layer is built."
    ),
    source_datasets = source_datasets,
    indicators = indicators_for_level(boundary_label),
    visual_layers = visual_layers_for_level(level_id),
    rows = rows
  )
}

# create a manifest durable-file record for one generated output.
manifest_file_record <- function(path, content, licence_status = "needs_review", licence_basis = "ibge_public_api_terms_not_explicit") {
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

# compare source rows at two levels for each year and category.
validate_level_sums <- function(lower_rows, upper_rows, lower_label, upper_label, years) {
  lapply(years, function(year) {
    categories <- sort(unique(upper_rows[upper_rows[["year"]] == year, "religion_label_normalised"]))
    category_checks <- lapply(categories, function(category) {
      lower_hit <- lower_rows[lower_rows[["year"]] == year &
                                lower_rows[["religion_label_normalised"]] == category, ]
      upper_hit <- upper_rows[upper_rows[["year"]] == year &
                                upper_rows[["religion_label_normalised"]] == category, ]
      lower_sum <- sum(lower_hit[["value"]], na.rm = TRUE)
      upper_sum <- sum(upper_hit[["value"]], na.rm = TRUE)
      list(
        category = category,
        lower_sum = lower_sum,
        upper_sum = upper_sum,
        difference = lower_sum - upper_sum
      )
    })
    list(
      year = year,
      lower_level = lower_label,
      upper_level = upper_label,
      categories = category_checks
    )
  })
}

# report join coverage for one level and year.
join_coverage <- function(boundary_codes, source_rows, year) {
  source_codes <- unique(source_rows[source_rows[["year"]] == year &
                                       source_rows[["religion_label_normalised"]] == "total" &
                                       is.finite(source_rows[["value"]]), "area_code"])
  missing <- sort(setdiff(boundary_codes, source_codes))
  extra <- sort(setdiff(source_codes, boundary_codes))
  list(
    year = year,
    matched_area_count = length(intersect(boundary_codes, source_codes)),
    expected_area_count = length(boundary_codes),
    source_area_count = length(source_codes),
    missing_area_codes = as.list(missing),
    extra_source_area_codes = as.list(extra)
  )
}

download_source(sidra_137_meta_url, file.path(raw_dir, "sidra_137_metadata.json"))
download_source(sidra_9537_meta_url, file.path(raw_dir, "sidra_9537_metadata.json"))
download_source(municipality_boundary_url, file.path(raw_dir, "ibge_malhas_municipality_2022_minima.geojson"))
download_source(uf_boundary_url, file.path(raw_dir, "ibge_malhas_uf_2022_minima.geojson"))
download_source(municipality_localities_url, file.path(raw_dir, "ibge_localidades_municipios_nivelado.json"))
download_source(uf_localities_url, file.path(raw_dir, "ibge_localidades_ufs.json"))

uf_localities <- fromJSON(file.path(raw_dir, "ibge_localidades_ufs.json"), simplifyDataFrame = TRUE)
uf_lookup <- data.frame(
  uf_code = sprintf("%02d", as.integer(uf_localities[["id"]])),
  uf_sigla = uf_localities[["sigla"]],
  uf_name = uf_localities[["nome"]],
  stringsAsFactors = FALSE
)
uf_lookup <- uf_lookup[order(uf_lookup[["uf_code"]]), ]

sidra_specs <- list()
for (uf_code in uf_lookup[["uf_code"]]) {
  sidra_specs[[length(sidra_specs) + 1L]] <- list(
    filename = sprintf("sidra_137_2000_2010_municipios_uf_%s.json", uf_code),
    aggregate_id = "137",
    periods = "2000|2010",
    variable_id = "93",
    localities = sprintf("N6[N3[%s]]", uf_code),
    classifications = "133[0,2836,2837]",
    level = "municipality"
  )
  sidra_specs[[length(sidra_specs) + 1L]] <- list(
    filename = sprintf("sidra_9537_2022_municipios_uf_%s.json", uf_code),
    aggregate_id = "9537",
    periods = "2022",
    variable_id = "140",
    localities = sprintf("N6[N3[%s]]", uf_code),
    classifications = "133[95278,2836,2837]|2[6794]|58[95253]",
    level = "municipality"
  )
}
sidra_specs <- c(
  sidra_specs,
  list(
    list(filename = "sidra_137_2000_2010_ufs.json", aggregate_id = "137", periods = "2000|2010",
         variable_id = "93", localities = "N3[all]", classifications = "133[0,2836,2837]", level = "uf"),
    list(filename = "sidra_9537_2022_ufs.json", aggregate_id = "9537", periods = "2022",
         variable_id = "140", localities = "N3[all]", classifications = "133[95278,2836,2837]|2[6794]|58[95253]", level = "uf"),
    list(filename = "sidra_137_2000_2010_brazil.json", aggregate_id = "137", periods = "2000|2010",
         variable_id = "93", localities = "N1[all]", classifications = "133[0,2836,2837]", level = "country"),
    list(filename = "sidra_9537_2022_brazil.json", aggregate_id = "9537", periods = "2022",
         variable_id = "140", localities = "N1[all]", classifications = "133[95278,2836,2837]|2[6794]|58[95253]", level = "country")
  )
)

for (spec in sidra_specs) {
  url <- sidra_query_url(
    spec[["aggregate_id"]], spec[["periods"]], spec[["variable_id"]],
    spec[["localities"]], spec[["classifications"]]
  )
  download_source(url, file.path(raw_dir, spec[["filename"]]))
  spec[["url"]] <- url
}

municipality_specs <- sidra_specs[vapply(sidra_specs, function(item) identical(item[["level"]], "municipality"), logical(1))]
uf_specs <- sidra_specs[vapply(sidra_specs, function(item) identical(item[["level"]], "uf"), logical(1))]
country_specs <- sidra_specs[vapply(sidra_specs, function(item) identical(item[["level"]], "country"), logical(1))]

municipality_source_rows <- do.call(rbind, lapply(municipality_specs, function(spec) {
  parse_sidra_file(file.path(raw_dir, spec[["filename"]]), spec[["aggregate_id"]], spec[["variable_id"]])
}))
uf_source_rows <- do.call(rbind, lapply(uf_specs, function(spec) {
  parse_sidra_file(file.path(raw_dir, spec[["filename"]]), spec[["aggregate_id"]], spec[["variable_id"]])
}))
country_source_rows <- do.call(rbind, lapply(country_specs, function(spec) {
  parse_sidra_file(file.path(raw_dir, spec[["filename"]]), spec[["aggregate_id"]], spec[["variable_id"]])
}))

municipality_source_rows[["uf_code"]] <- substr(municipality_source_rows[["area_code"]], 1, 2)
municipality_source_rows <- merge(municipality_source_rows, uf_lookup, by = "uf_code", all.x = TRUE, sort = FALSE)
uf_source_rows[["uf_code"]] <- uf_source_rows[["area_code"]]
uf_source_rows <- merge(uf_source_rows, uf_lookup, by = "uf_code", all.x = TRUE, sort = FALSE)

municipality_extract_path <- file.path(raw_dir, "sidra_religion_extract_municipality.csv")
uf_extract_path <- file.path(raw_dir, "sidra_religion_extract_uf.csv")
country_extract_path <- file.path(raw_dir, "sidra_religion_extract_brazil.csv")
write.csv(municipality_source_rows, municipality_extract_path, row.names = FALSE, na = "")
write.csv(uf_source_rows, uf_extract_path, row.names = FALSE, na = "")
write.csv(country_source_rows, country_extract_path, row.names = FALSE, na = "")

municipality_localities <- fromJSON(file.path(raw_dir, "ibge_localidades_municipios_nivelado.json"), simplifyDataFrame = TRUE)
municipality_lookup <- data.frame(
  area_code = sprintf("%07d", as.integer(municipality_localities[["municipio-id"]])),
  municipality_name = municipality_localities[["municipio-nome"]],
  uf_sigla = municipality_localities[["UF-sigla"]],
  uf_name = municipality_localities[["UF-nome"]],
  stringsAsFactors = FALSE
)
municipality_lookup[["area_name"]] <- paste0(municipality_lookup[["municipality_name"]], " - ", municipality_lookup[["uf_sigla"]])
municipality_lookup <- municipality_lookup[!duplicated(municipality_lookup[["area_code"]]), ]

sf_use_s2(FALSE)
municipality_boundaries_raw <- st_read(file.path(raw_dir, "ibge_malhas_municipality_2022_minima.geojson"), quiet = TRUE)
municipality_boundaries_raw[["area_code"]] <- as.character(municipality_boundaries_raw[["codarea"]])
municipality_boundaries <- merge(
  municipality_boundaries_raw[, "area_code"],
  municipality_lookup[, c("area_code", "area_name")],
  by = "area_code", all.x = TRUE, sort = FALSE
)
if (any(is.na(municipality_boundaries[["area_name"]]))) {
  stop("missing municipality names for boundary codes", call. = FALSE)
}
municipality_area <- st_drop_geometry(municipality_boundaries)
municipality_area[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(municipality_boundaries, 5880))) / 1e6
municipality_area <- municipality_area[order(municipality_area[["area_code"]]), ]

uf_boundaries_raw <- st_read(file.path(raw_dir, "ibge_malhas_uf_2022_minima.geojson"), quiet = TRUE)
uf_boundaries_raw[["area_code"]] <- as.character(uf_boundaries_raw[["codarea"]])
uf_area_lookup <- data.frame(
  area_code = uf_lookup[["uf_code"]],
  area_name = paste0(uf_lookup[["uf_name"]], " - ", uf_lookup[["uf_sigla"]]),
  stringsAsFactors = FALSE
)
uf_boundaries <- merge(uf_boundaries_raw[, "area_code"], uf_area_lookup, by = "area_code", all.x = TRUE, sort = FALSE)
if (any(is.na(uf_boundaries[["area_name"]]))) {
  stop("missing UF names for boundary codes", call. = FALSE)
}
uf_area <- st_drop_geometry(uf_boundaries)
uf_area[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(uf_boundaries, 5880))) / 1e6
uf_area <- uf_area[order(uf_area[["area_code"]]), ]

municipality_boundaries_out <- municipality_boundaries[order(municipality_boundaries[["area_code"]]), ]
municipality_boundaries_out <- st_transform(
  st_simplify(st_transform(municipality_boundaries_out, 5880), dTolerance = 2000, preserveTopology = TRUE),
  4326
)
municipality_boundary_out <- file.path(br_dir, "br_municipality_2022.geojson")
st_write(municipality_boundaries_out, municipality_boundary_out, quiet = TRUE, delete_dsn = TRUE)

uf_boundaries_out <- uf_boundaries[order(uf_boundaries[["area_code"]]), ]
uf_boundaries_out <- st_transform(
  st_simplify(st_transform(uf_boundaries_out, 5880), dTolerance = 5000, preserveTopology = TRUE),
  4326
)
uf_boundary_out <- file.path(br_dir, "br_uf_2022.geojson")
st_write(uf_boundaries_out, uf_boundary_out, quiet = TRUE, delete_dsn = TRUE)

years <- c(2000L, 2010L, 2022L)
municipality_rows <- unlist(lapply(seq_len(nrow(municipality_area)), function(index) {
  area <- municipality_area[index, ]
  lapply(years, function(year) {
    build_area_row(
      area, year, municipality_source_rows, municipality_boundary_set_id,
      "municipality", municipality_boundary_dataset_id,
      "uses_2022_municipality_boundary_without_split_merge_concordance"
    )
  })
}), recursive = FALSE)

uf_rows <- unlist(lapply(seq_len(nrow(uf_area)), function(index) {
  area <- uf_area[index, ]
  lapply(years, function(year) {
    build_area_row(
      area, year, uf_source_rows, uf_boundary_set_id,
      "uf", uf_boundary_dataset_id, ""
    )
  })
}), recursive = FALSE)

source_datasets_municipality <- list(
  list(
    source_dataset_id = census_137_dataset_id,
    name = "SIDRA aggregate 137: População residente, por religião",
    provider = "Instituto Brasileiro de Geografia e Estatística (IBGE), SIDRA",
    url = sidra_137_meta_url,
    retrieval_date = retrieval_date,
    local_path = "data/raw/br_census/sidra_137_metadata.json",
    licence = list(name = "IBGE public API terms not explicit in API response", url = NULL, attribution = "Instituto Brasileiro de Geografia e Estatística (IBGE)"),
    citation = "IBGE, Censo Demográfico, SIDRA table 137, variable 93, classification 133.",
    access_limits = NULL,
    redistribution_limits = "No explicit machine-readable redistribution licence found in the API response; attribute IBGE and link to the source.",
    notes = "Used for 2000 and 2010 resident population by religion. Extracted categories: Total (0), Sem religião (2836), and Sem declaração (2837)."
  ),
  list(
    source_dataset_id = census_9537_dataset_id,
    name = "SIDRA aggregate 9537: Pessoas de 10 anos ou mais de idade, por religião, segundo o sexo e os grupos de idade",
    provider = "Instituto Brasileiro de Geografia e Estatística (IBGE), SIDRA",
    url = sidra_9537_meta_url,
    retrieval_date = retrieval_date,
    local_path = "data/raw/br_census/sidra_9537_metadata.json",
    licence = list(name = "IBGE public API terms not explicit in API response", url = NULL, attribution = "Instituto Brasileiro de Geografia e Estatística (IBGE)"),
    citation = "IBGE, Censo Demográfico 2022, SIDRA table 9537, variable 140, classifications 133, 2, and 58.",
    access_limits = NULL,
    redistribution_limits = "No explicit machine-readable redistribution licence found in the API response; attribute IBGE and link to the source.",
    notes = "Used for 2022 people aged 10 years or older by religion, with Sexo=Total (6794) and Grupo de idade=Total (95253). Extracted religion categories: Total (95278), Sem religião (2836), and Sem declaração (2837)."
  ),
  list(
    source_dataset_id = municipality_boundary_dataset_id,
    name = "IBGE malhas, Brazil municipalities, 2022, minimum quality",
    provider = "Instituto Brasileiro de Geografia e Estatística (IBGE)",
    url = municipality_boundary_url,
    retrieval_date = retrieval_date,
    local_path = "data/raw/br_census/ibge_malhas_municipality_2022_minima.geojson",
    licence = list(name = "IBGE public API terms not explicit in API response", url = NULL, attribution = "Instituto Brasileiro de Geografia e Estatística (IBGE)"),
    citation = "IBGE malhas API, Brazil municipality geometries, periodo=2022, qualidade=minima.",
    access_limits = NULL,
    redistribution_limits = "No explicit machine-readable redistribution licence found in the API response; attribute IBGE and link to the source.",
    notes = "Simplified to 2,000 m tolerance in EPSG:5880 before export to GeoJSON."
  ),
  list(
    source_dataset_id = localities_dataset_id,
    name = "IBGE localities API, municipalities and federative units",
    provider = "Instituto Brasileiro de Geografia e Estatística (IBGE)",
    url = municipality_localities_url,
    retrieval_date = retrieval_date,
    local_path = "data/raw/br_census/ibge_localidades_municipios_nivelado.json",
    licence = list(name = "IBGE public API terms not explicit in API response", url = NULL, attribution = "Instituto Brasileiro de Geografia e Estatística (IBGE)"),
    citation = "IBGE localities API, municipalities with nested UF fields; IBGE localities API, states.",
    access_limits = NULL,
    redistribution_limits = "No explicit machine-readable redistribution licence found in the API response; attribute IBGE and link to the source.",
    notes = "Used to add municipality and UF names to the malha features and area-summary rows."
  )
)

source_datasets_uf <- c(
  source_datasets_municipality[1:2],
  list(
    list(
      source_dataset_id = uf_boundary_dataset_id,
      name = "IBGE malhas, Brazil federative units, 2022, minimum quality",
      provider = "Instituto Brasileiro de Geografia e Estatística (IBGE)",
      url = uf_boundary_url,
      retrieval_date = retrieval_date,
      local_path = "data/raw/br_census/ibge_malhas_uf_2022_minima.geojson",
      licence = list(name = "IBGE public API terms not explicit in API response", url = NULL, attribution = "Instituto Brasileiro de Geografia e Estatística (IBGE)"),
      citation = "IBGE malhas API, Brazil UF geometries, periodo=2022, qualidade=minima.",
      access_limits = NULL,
      redistribution_limits = "No explicit machine-readable redistribution licence found in the API response; attribute IBGE and link to the source.",
      notes = "Simplified to 5,000 m tolerance in EPSG:5880 before export to GeoJSON."
    )
  ),
  source_datasets_municipality[4]
)
source_datasets_all <- c(
  source_datasets_municipality[1:3],
  source_datasets_uf[3],
  source_datasets_municipality[4]
)

municipality_summary <- area_summary_document(
  "municipality", municipality_boundary_set_id, municipality_boundary_dataset_id,
  "municipalities", municipality_rows, source_datasets_municipality
)
uf_summary <- area_summary_document(
  "uf", uf_boundary_set_id, uf_boundary_dataset_id,
  "federative units", uf_rows, source_datasets_uf
)

municipality_json_out <- file.path(br_dir, "area_summary_municipality.json")
municipality_csv_out <- file.path(br_dir, "area_summary_municipality.csv")
uf_json_out <- file.path(br_dir, "area_summary_uf.json")
uf_csv_out <- file.path(br_dir, "area_summary_uf.csv")
write_json(municipality_summary, municipality_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(municipality_rows), municipality_csv_out, row.names = FALSE, na = "")
write_json(uf_summary, uf_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(uf_rows), uf_csv_out, row.names = FALSE, na = "")

source_records <- list(
  source_record("sidra_137_metadata.json", sidra_137_meta_url, "IBGE/SIDRA", "Metadata for aggregate 137.", "137", "93", "133", "1991|2000|2010", "N1,N2,N3,N6"),
  source_record("sidra_9537_metadata.json", sidra_9537_meta_url, "IBGE/SIDRA", "Metadata for aggregate 9537.", "9537", "140", "133|2|58", "2022", "N1,N2,N3,N6"),
  source_record("ibge_malhas_municipality_2022_minima.geojson", municipality_boundary_url, "IBGE", "Raw 2022 municipality malha, minimum quality.", NA, NA, NA, "2022", "N6"),
  source_record("ibge_malhas_uf_2022_minima.geojson", uf_boundary_url, "IBGE", "Raw 2022 UF malha, minimum quality.", NA, NA, NA, "2022", "N3"),
  source_record("ibge_localidades_municipios_nivelado.json", municipality_localities_url, "IBGE", "Municipality names and UF membership.", NA, NA, NA, NA, "N6"),
  source_record("ibge_localidades_ufs.json", uf_localities_url, "IBGE", "UF names.", NA, NA, NA, NA, "N3"),
  source_record("sidra_religion_extract_municipality.csv", municipality_extract_path, "Places of Worship project derivation from IBGE/SIDRA", "Long source extract with Portuguese category labels and normalised labels alongside.", "137|9537", "93|140", "133|2|58", "2000|2010|2022", "N6"),
  source_record("sidra_religion_extract_uf.csv", uf_extract_path, "Places of Worship project derivation from IBGE/SIDRA", "Long UF source extract with Portuguese category labels and normalised labels alongside.", "137|9537", "93|140", "133|2|58", "2000|2010|2022", "N3"),
  source_record("sidra_religion_extract_brazil.csv", country_extract_path, "Places of Worship project derivation from IBGE/SIDRA", "Long national source extract with Portuguese category labels and normalised labels alongside.", "137|9537", "93|140", "133|2|58", "2000|2010|2022", "N1")
)
for (spec in sidra_specs) {
  url <- sidra_query_url(
    spec[["aggregate_id"]], spec[["periods"]], spec[["variable_id"]],
    spec[["localities"]], spec[["classifications"]]
  )
  source_records[[length(source_records) + 1L]] <- source_record(
    spec[["filename"]], url, "IBGE/SIDRA",
    paste("Raw SIDRA response for", spec[["level"]], "level."),
    spec[["aggregate_id"]], spec[["variable_id"]], spec[["classifications"]],
    spec[["periods"]], spec[["level"]]
  )
}
sources_csv <- do.call(rbind, source_records)
write.csv(sources_csv, file.path(raw_dir, "sources.csv"), row.names = FALSE, na = "")

municipality_join_coverage <- lapply(years, function(year) {
  join_coverage(municipality_area[["area_code"]], municipality_source_rows, year)
})
uf_join_coverage <- lapply(years, function(year) {
  join_coverage(uf_area[["area_code"]], uf_source_rows, year)
})
municipality_to_uf_validation <- validate_level_sums(municipality_source_rows, uf_source_rows, "municipality", "uf", years)
uf_to_country_validation <- validate_level_sums(uf_source_rows, country_source_rows, "uf", "country", years)

validation_checks <- c(
  sprintf("SIDRA aggregate 137 metadata resolved with periods 1991, 2000 and 2010; this build uses 2000 and 2010, variable 93, classification 133."),
  sprintf("SIDRA aggregate 9537 metadata resolved with period 2022; this build uses variable 140, religion classification 133, Sexo=Total (2:6794), and Grupo de idade=Total (58:95253)."),
  sprintf("Municipality boundary layer has %d IBGE 2022 features and writes to %s bytes after 2,000 m simplification.", nrow(municipality_area), file_bytes(municipality_boundary_out)),
  sprintf("UF boundary layer has %d IBGE 2022 features and writes to %s bytes after 5,000 m simplification.", nrow(uf_area), file_bytes(uf_boundary_out)),
  "SIDRA '-' count cells are preserved in value_raw and interpreted as zero for derived count totals.",
  "Municipality source sums were compared with SIDRA UF rows for Total, Sem religião, and Sem declaração.",
  "UF source sums were compared with SIDRA Brazil rows for Total, Sem religião, and Sem declaração."
)

durable_files <- list(
  manifest_file_record(municipality_json_out, "Brazil municipality area summary with IBGE SIDRA stated-response religion metrics."),
  manifest_file_record(municipality_csv_out, "Flattened Brazil municipality area summary with IBGE SIDRA stated-response religion metrics."),
  manifest_file_record(municipality_boundary_out, "Simplified Brazil 2022 municipality boundary GeoJSON derived from IBGE malhas."),
  manifest_file_record(uf_json_out, "Brazil UF area summary with IBGE SIDRA stated-response religion metrics."),
  manifest_file_record(uf_csv_out, "Flattened Brazil UF area summary with IBGE SIDRA stated-response religion metrics."),
  manifest_file_record(uf_boundary_out, "Simplified Brazil 2022 UF boundary GeoJSON derived from IBGE malhas.")
)

raw_source_files <- lapply(seq_len(nrow(sources_csv)), function(index) {
  row <- sources_csv[index, ]
  list(
    uri = file.path(raw_dir, row[["filename"]]),
    url = row[["url"]],
    format = sub("^.*\\.", "", row[["filename"]]),
    bytes = row[["bytes"]],
    sha256 = row[["sha256"]],
    aggregate_id = if (is.na(row[["aggregate_id"]])) NULL else row[["aggregate_id"]],
    variable_id = if (is.na(row[["variable_id"]])) NULL else row[["variable_id"]],
    classification_ids = if (is.na(row[["classification_ids"]])) NULL else row[["classification_ids"]],
    periods = if (is.na(row[["periods"]])) NULL else row[["periods"]],
    territorial_level = if (is.na(row[["territorial_level"]])) NULL else row[["territorial_level"]],
    notes = row[["notes"]]
  )
})

docs_manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = paste0("manifest:br-census-religion:br:2000-2022:", substr(sha256_file(municipality_json_out), 1, 12)),
  dataset_id = "br-census-religion:br:2000-2022:ibge-sidra",
  dataset_version_id = paste0("br-census-religion:br:2000-2022:ibge-sidra:", substr(sha256_file(municipality_json_out), 1, 12)),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "br-census-religion",
  dataset_role = "public_product",
  scope = list(
    level = "country",
    country_codes = list("BR"),
    snapshot_date = NULL,
    snapshot_anchor = NULL,
    pipeline_stage = "public"
  ),
  created_at = stamp,
  created_by = "scripts/build_br_area_summary.R",
  pipeline = list(
    script = "scripts/build_br_area_summary.R",
    git_commit = NULL,
    command = "Rscript scripts/build_br_area_summary.R",
    parameters = list(
      waves = c("2000", "2010", "2022"),
      municipality_boundary_set = municipality_boundary_set_id,
      uf_boundary_set = uf_boundary_set_id,
      municipality_boundary_simplification_tolerance_m = 2000,
      uf_boundary_simplification_tolerance_m = 5000,
      denominator = "Total minus Sem declaração",
      omitted_metrics = c("religious_change", "places_per_10000_residents", "place_density_per_sq_km")
    ),
    software_versions = list(
      r = paste(R.version[["major"]], R.version[["minor"]], sep = "."),
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite"))
    )
  ),
  source = list(
    provider = "Instituto Brasileiro de Geografia e Estatística (IBGE), SIDRA and malhas APIs",
    source_dataset_ids = c(census_137_dataset_id, census_9537_dataset_id, municipality_boundary_dataset_id, uf_boundary_dataset_id, localities_dataset_id),
    source_urls = c(sidra_137_meta_url, sidra_9537_meta_url, municipality_boundary_url, uf_boundary_url, municipality_localities_url, uf_localities_url),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = licence_text,
    citation = "Instituto Brasileiro de Geografia e Estatística (IBGE), Censo Demográfico, SIDRA tables 137 and 9537; IBGE malhas API, 2022 municipality and UF geometries.",
    raw_redistribution = "Raw SIDRA JSON, raw malhas, localities JSON, and long source extracts are not committed. They remain in data/raw/br_census/ and await any project-controlled raw archive upload."
  ),
  input_manifests = list(),
  raw_sources = raw_source_files,
  durable_files = durable_files,
  derived_outputs = list(
    list(
      uri = paste0("repo:", municipality_json_out),
      sha256 = sha256_file(municipality_json_out),
      built_by = "scripts/build_br_area_summary.R",
      notes = sprintf("%d municipalities x 3 census years; denominator equals Total minus Sem declaração.", nrow(municipality_area))
    ),
    list(
      uri = paste0("repo:", uf_json_out),
      sha256 = sha256_file(uf_json_out),
      built_by = "scripts/build_br_area_summary.R",
      notes = sprintf("%d federative units x 3 census years; denominator equals Total minus Sem declaração.", nrow(uf_area))
    ),
    list(
      uri = paste0("repo:", municipality_boundary_out),
      sha256 = sha256_file(municipality_boundary_out),
      built_by = "scripts/build_br_area_summary.R",
      notes = "IBGE 2022 municipality malha simplified at 2,000 m tolerance."
    ),
    list(
      uri = paste0("repo:", uf_boundary_out),
      sha256 = sha256_file(uf_boundary_out),
      built_by = "scripts/build_br_area_summary.R",
      notes = "IBGE 2022 UF malha simplified at 5,000 m tolerance."
    )
  ),
  validation = list(
    checks = validation_checks,
    join_coverage = list(
      municipality = municipality_join_coverage,
      uf = uf_join_coverage
    ),
    state_validation = municipality_to_uf_validation,
    national_validation = uf_to_country_validation,
    boundary_validation = list(
      municipality_source_feature_count = nrow(municipality_boundaries_raw),
      municipality_output_feature_count = row_count_file(municipality_boundary_out),
      municipality_output_bytes = file_bytes(municipality_boundary_out),
      municipality_simplification_tolerance_m = 2000,
      uf_source_feature_count = nrow(uf_boundaries_raw),
      uf_output_feature_count = row_count_file(uf_boundary_out),
      uf_output_bytes = file_bytes(uf_boundary_out),
      uf_simplification_tolerance_m = 5000,
      unmapped_boundary_features = list(),
      unmapped_locality_rows = as.list(sort(setdiff(municipality_lookup[["area_code"]], municipality_area[["area_code"]])))
    )
  ),
  construct_notes = list(
    "2000 and 2010 use SIDRA aggregate 137, variable 93: População residente.",
    "2022 uses SIDRA aggregate 9537, variable 140: Pessoas de 10 anos ou mais de idade.",
    "The 2022 age-universe break is flagged in every 2022 area-summary row as age_universe_10_plus.",
    "The municipality layer is anchored on 2022 municipality boundaries. Pre-2022 municipality rows are not concorded across splits and mergers, and the page omits the religious_change metric."
  ),
  privacy = "public",
  licence_status = "needs_review", licence_basis = "ibge_public_api_terms_not_explicit",
  downstream_status = "public",
  source_datasets = source_datasets_all,
  notes = "Portuguese SIDRA category labels are preserved in the ignored long source extracts with normalised labels alongside. The committed products contain only derived area summaries and simplified boundaries."
)

manifest_out <- file.path(manifest_dir, "br-census-religion-2000-2022.json")
write_json(docs_manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)

cat(sprintf("wrote %s: %d rows\n", municipality_json_out, length(municipality_rows)))
cat(sprintf("wrote %s: %d rows\n", uf_json_out, length(uf_rows)))
cat(sprintf("municipality boundary bytes: %d\n", file_bytes(municipality_boundary_out)))
cat(sprintf("UF boundary bytes: %d\n", file_bytes(uf_boundary_out)))
cat(sprintf("wrote %s\n", manifest_out))
cat("done\n")
