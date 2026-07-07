# build the mexico area-summary product from INEGI ITER census religion data.
# inputs: INEGI ITER CSV ZIPs for 2000, 2010, and 2020, and the INEGI 2020
# Marco Geoestadistico integrated municipal boundary ZIP. Raw archives remain
# ignored under data/raw/mx_census/.
# outputs: apps/regions/mx/data/mx_municipality_2020.geojson,
# apps/regions/mx/data/area_summary_municipality.{json,csv},
# data/raw/mx_census/sources.csv, and
# docs/manifests/mx-census-religion-2000-2020.json.
# run from the repo root: Rscript scripts/build_mx_area_summary.R

suppressMessages({
  library(dplyr)
  library(jsonlite)
  library(readr)
  library(sf)
})

raw_dir <- "data/raw/mx_census"
mx_dir <- "apps/regions/mx/data"
manifest_dir <- "docs/manifests"
dir.create(raw_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(mx_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- format(Sys.Date(), "%Y-%m-%d")

script_id <- "scripts/build_mx_area_summary.R"
country_code <- "MX"
boundary_set_id <- "mx-municipality-2020-inegi-marco"
boundary_dataset_id <- "inegi-marco-geoestadistico-cpv2020-municipal"
census_2010_dataset_id <- "inegi-cpv-2010-iter-locality"
census_2020_dataset_id <- "inegi-cpv-2020-iter-locality"
census_2000_dataset_id <- "inegi-cgpv-2000-iter-locality"

iter_2020_url <- "https://www.inegi.org.mx/contenidos/programas/ccpv/2020/datosabiertos/iter/iter_00_cpv2020_csv.zip"
iter_2010_url <- "https://www.inegi.org.mx/contenidos/programas/ccpv/2010/datosabiertos/iter_nal_2010_csv.zip"
iter_2000_url <- "https://www.inegi.org.mx/contenidos/programas/ccpv/2000/datosabiertos/cgpv2000_iter_00_csv.zip"
boundary_url <- "https://www.inegi.org.mx/contenidos/productos/prod_serv/contenidos/espanol/bvinegi/productos/geografia/marcogeo/889463807469/mg_2020_integrado.zip"
boundary_product_url <- "https://www.inegi.org.mx/app/biblioteca/ficha.html?upc=889463807469"
inegi_terms_url <- "https://www.inegi.org.mx/inegi/terminos.html"

licence_text <- paste(
  "INEGI open downloads subject to INEGI terms at",
  inegi_terms_url,
  "and product/source attribution. The Marco Geoestadistico CPV 2020",
  "product page marks SHP downloads with INEGI's data-open standard."
)

iter_specs <- list(
  list(
    year = 2000L,
    dataset_id = census_2000_dataset_id,
    filename = "cgpv2000_iter_00_csv.zip",
    url = iter_2000_url,
    member = "cgpv2000_iter_00/conjunto_de_datos/cgpv2000_iter_00.csv",
    fields = c(
      catholic = "p5_catolic",
      non_catholic_religion = "p5_ncatoli",
      non_catholic_or_no_religion = "p5_sinreli"
    ),
    derivation = "age5plus_two_field",
    quality_flags = c(
      "construct_two_field_age5plus_derivation",
      "universe_age5plus"
    ),
    denominator_note = "population aged 5 and over with a stated response: p5_catolic plus p5_sinreli in INEGI CGPV 2000 ITER (ages 5+ universe; later waves count the full population)",
    construct_note = "JB's 2026-07-07 ruling ratifies the 2000 derivation: population_total is p5_catolic + p5_sinreli, religious_affiliation_count is p5_catolic + p5_ncatoli, and no_religion_count is p5_sinreli - p5_ncatoli."
  ),
  list(
    year = 2010L,
    dataset_id = census_2010_dataset_id,
    filename = "iter_nal_2010_csv.zip",
    url = iter_2010_url,
    member = "iter_00_cpv2010/conjunto_de_datos/iter_00_cpv2010.csv",
    fields = c(
      catholic = "pcatolica",
      protestant_evangelical = "pncatolica",
      other_religion = "potras_rel",
      no_religion = "psin_relig"
    ),
    quality_flags = c(
      "category_crosswalk_limited_to_four_top_level_constructs",
      "uses_2020_municipality_boundary_without_split_merge_concordance",
      "source_field_pncatolica_mapped_to_pro_crieva_construct"
    ),
    denominator_note = "sum of pcatolica, pncatolica, potras_rel, and psin_relig in INEGI CPV 2010 ITER",
    construct_note = "The 2010 source field pncatolica is used for the Protestant/evangelical/biblical construct described by the INEGI dictionary."
  ),
  list(
    year = 2020L,
    dataset_id = census_2020_dataset_id,
    filename = "iter_00_cpv2020_csv.zip",
    url = iter_2020_url,
    member = "iter_00_cpv2020/conjunto_de_datos/conjunto_de_datos_iter_00CSV20.csv",
    fields = c(
      catholic = "PCATOLICA",
      protestant_evangelical = "PRO_CRIEVA",
      other_religion = "POTRAS_REL",
      no_religion = "PSIN_RELIG"
    ),
    quality_flags = c(
      "category_crosswalk_limited_to_four_top_level_constructs",
      "uses_iter_municipality_total_due_locality_suppression"
    ),
    denominator_note = "sum of PCATOLICA, PRO_CRIEVA, POTRAS_REL, and PSIN_RELIG in INEGI CPV 2020 ITER",
    construct_note = "The 2020 source exposes the four requested top-level constructs directly."
  )
)

raw_downloads <- list(
  list(
    filename = "iter_00_cpv2020_csv.zip",
    url = iter_2020_url,
    publisher = "Instituto Nacional de Estadistica y Geografia (INEGI)",
    source_dataset_id = census_2020_dataset_id,
    used_in_public_product = TRUE,
    periods = "2020",
    notes = "INEGI CPV 2020 ITER national CSV ZIP; used for the 2020 municipality rows."
  ),
  list(
    filename = "iter_nal_2010_csv.zip",
    url = iter_2010_url,
    publisher = "Instituto Nacional de Estadistica y Geografia (INEGI)",
    source_dataset_id = census_2010_dataset_id,
    used_in_public_product = TRUE,
    periods = "2010",
    notes = "INEGI CPV 2010 ITER national CSV ZIP; used for the 2010 municipality rows."
  ),
  list(
    filename = "cgpv2000_iter_00_csv.zip",
    url = iter_2000_url,
    publisher = "Instituto Nacional de Estadistica y Geografia (INEGI)",
    source_dataset_id = census_2000_dataset_id,
    used_in_public_product = TRUE,
    periods = "2000",
    notes = "INEGI CGPV 2000 ITER national CSV ZIP; used for the 2000 municipality rows with the ages 5+ derivation ratified on 2026-07-07."
  ),
  list(
    filename = "mg_2020_integrado.zip",
    url = boundary_url,
    publisher = "Instituto Nacional de Estadistica y Geografia (INEGI)",
    source_dataset_id = boundary_dataset_id,
    used_in_public_product = TRUE,
    periods = "2020",
    notes = "INEGI Marco Geoestadistico, Censo de Poblacion y Vivienda 2020, integrated product; municipal layer conjunto_de_datos/00mun.* is used."
  )
)

# compute the sha-256 digest for a local file.
sha256_file <- function(path) {
  unname(tools::sha256sum(path))
}

# return file size in bytes for manifest and source records.
file_bytes <- function(path) {
  as.integer(unname(file.info(path)[["size"]]))
}

# return row or feature counts for generated files where cheap to compute.
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

# parse INEGI count cells, keeping suppressed cells unavailable.
parse_inegi_count <- function(value) {
  value <- trimws(as.character(value))
  value[value %in% c("", "*", "N/D", "NA")] <- NA_character_
  suppressWarnings(as.numeric(value))
}

# derive ratified 2000 age-5-plus counts from INEGI p5 fields.
derive_age5plus_counts <- function(p5_catolic, p5_ncatoli, p5_sinreli) {
  list(
    population_total = p5_catolic + p5_sinreli,
    religious_affiliation_count = p5_catolic + p5_ncatoli,
    no_religion_count = p5_sinreli - p5_ncatoli
  )
}

# convert an R value to NULL when JSON should carry a missing scalar.
null_if_na <- function(value) {
  if (length(value) == 0L || is.na(value) || !is.finite(value)) return(NULL)
  value
}

# return the source dataset id for one built census year.
census_dataset_for_year <- function(year) {
  if (year == 2000L) return(census_2000_dataset_id)
  if (year == 2010L) return(census_2010_dataset_id)
  if (year == 2020L) return(census_2020_dataset_id)
  stop("unsupported year: ", year, call. = FALSE)
}

# return the ITER wave specification for one built census year.
iter_spec_for_year <- function(year) {
  hits <- Filter(function(spec) spec[["year"]] == year, iter_specs)
  if (length(hits) != 1L) stop("unsupported year: ", year, call. = FALSE)
  hits[[1]]
}

# compare municipality rows with state and national total rows from one ITER file.
validate_iter_totals <- function(df, field_map, year) {
  fields <- toupper(unname(field_map))
  metric_names <- names(field_map)
  municipalities <- df[df[["ENTIDAD"]] != "00" & df[["MUN"]] != "000" & df[["LOC"]] == "0000", ]
  state_totals <- df[df[["ENTIDAD"]] != "00" & df[["MUN"]] == "000" & df[["LOC"]] == "0000", ]
  national <- df[df[["ENTIDAD"]] == "00" & df[["MUN"]] == "000" & df[["LOC"]] == "0000", ]

  state_checks <- lapply(metric_names, function(metric) {
    field <- toupper(field_map[[metric]])
    by_state <- aggregate(
      parse_inegi_count(municipalities[[field]]),
      by = list(state_code = municipalities[["ENTIDAD"]]),
      FUN = function(value) sum(value, na.rm = TRUE)
    )
    names(by_state)[2] <- "municipality_sum"
    source_state <- data.frame(
      state_code = state_totals[["ENTIDAD"]],
      state_total = parse_inegi_count(state_totals[[field]]),
      stringsAsFactors = FALSE
    )
    merged <- merge(by_state, source_state, by = "state_code", all = TRUE, sort = FALSE)
    difference <- merged[["municipality_sum"]] - merged[["state_total"]]
    list(
      metric = metric,
      source_field = field,
      state_count = nrow(merged),
      states_with_difference = sum(difference != 0, na.rm = TRUE),
      max_abs_difference = if (length(difference)) max(abs(difference), na.rm = TRUE) else 0
    )
  })

  national_checks <- lapply(metric_names, function(metric) {
    field <- toupper(field_map[[metric]])
    municipality_sum <- sum(parse_inegi_count(municipalities[[field]]), na.rm = TRUE)
    national_total <- parse_inegi_count(national[[field]][1])
    list(
      metric = metric,
      source_field = field,
      municipality_sum = municipality_sum,
      national_total = national_total,
      difference = municipality_sum - national_total
    )
  })

  list(
    year = year,
    state_validation = state_checks,
    national_validation = national_checks
  )
}

# compare derived public metrics with the source national total row.
validate_headline_totals <- function(df, counts, spec) {
  field_map <- toupper(spec[["fields"]])
  names(field_map) <- names(spec[["fields"]])
  national <- df[df[["ENTIDAD"]] == "00" & df[["MUN"]] == "000" & df[["LOC"]] == "0000", ]

  if (identical(spec[["derivation"]], "age5plus_two_field")) {
    p5_catolic <- parse_inegi_count(national[[field_map[["catholic"]]]])[1]
    p5_ncatoli <- parse_inegi_count(national[[field_map[["non_catholic_religion"]]]])[1]
    p5_sinreli <- parse_inegi_count(national[[field_map[["non_catholic_or_no_religion"]]]])[1]
    if (is.finite(p5_sinreli) && is.finite(p5_ncatoli) && p5_sinreli < p5_ncatoli) {
      stop(
        sprintf(
          "national 2000 source inconsistency: p5_sinreli (%s) is smaller than p5_ncatoli (%s); input appears corrupted",
          p5_sinreli,
          p5_ncatoli
        ),
        call. = FALSE
      )
    }
    national_totals <- unlist(
      derive_age5plus_counts(p5_catolic, p5_ncatoli, p5_sinreli),
      use.names = TRUE
    )
  } else {
    catholic <- parse_inegi_count(national[[field_map[["catholic"]]]])[1]
    protestant_evangelical <- parse_inegi_count(national[[field_map[["protestant_evangelical"]]]])[1]
    other_religion <- parse_inegi_count(national[[field_map[["other_religion"]]]])[1]
    no_religion <- parse_inegi_count(national[[field_map[["no_religion"]]]])[1]
    religious_affiliation <- catholic + protestant_evangelical + other_religion
    national_totals <- c(
      population_total = religious_affiliation + no_religion,
      religious_affiliation_count = religious_affiliation,
      no_religion_count = no_religion
    )
  }

  lapply(names(national_totals), function(metric) {
    municipality_sum <- sum(counts[[metric]], na.rm = TRUE)
    list(
      year = spec[["year"]],
      metric = metric,
      municipality_sum = municipality_sum,
      national_total = national_totals[[metric]],
      difference = municipality_sum - national_totals[[metric]]
    )
  })
}

# compare summed locality rows with official ITER municipality total rows.
validate_locality_sums <- function(df, field_map, year) {
  fields <- toupper(unname(field_map))
  metric_names <- names(field_map)
  localities <- df[df[["ENTIDAD"]] != "00" & df[["MUN"]] != "000" & df[["LOC"]] != "0000", ]
  totals <- df[df[["ENTIDAD"]] != "00" & df[["MUN"]] != "000" & df[["LOC"]] == "0000", ]
  localities[["area_code"]] <- paste0(localities[["ENTIDAD"]], localities[["MUN"]])
  totals[["area_code"]] <- paste0(totals[["ENTIDAD"]], totals[["MUN"]])

  metric_checks <- lapply(metric_names, function(metric) {
    field <- toupper(field_map[[metric]])
    locality_values <- parse_inegi_count(localities[[field]])
    locality_sums <- aggregate(
      locality_values,
      by = list(area_code = localities[["area_code"]]),
      FUN = function(value) sum(value, na.rm = TRUE)
    )
    names(locality_sums)[2] <- "locality_sum"
    official <- data.frame(
      area_code = totals[["area_code"]],
      official_total = parse_inegi_count(totals[[field]]),
      stringsAsFactors = FALSE
    )
    merged <- merge(locality_sums, official, by = "area_code", all = TRUE, sort = FALSE)
    difference <- merged[["locality_sum"]] - merged[["official_total"]]
    list(
      metric = metric,
      source_field = field,
      suppressed_locality_cells = sum(localities[[field]] == "*", na.rm = TRUE),
      municipality_count = nrow(merged),
      municipalities_with_difference = sum(difference != 0, na.rm = TRUE),
      max_abs_difference = if (length(difference)) max(abs(difference), na.rm = TRUE) else 0
    )
  })

  list(
    year = year,
    locality_rows = nrow(localities),
    official_municipality_total_rows = nrow(totals),
    checks = metric_checks
  )
}

# read one ITER CSV and return official municipality counts plus validation.
read_iter_wave <- function(spec) {
  zip_path <- file.path(raw_dir, spec[["filename"]])
  if (!file.exists(zip_path)) stop("missing source archive: ", zip_path, call. = FALSE)
  df <- read_csv(
    unz(zip_path, spec[["member"]]),
    col_types = cols(.default = col_character()),
    show_col_types = FALSE,
    progress = FALSE
  )
  names(df) <- toupper(names(df))

  field_map <- toupper(spec[["fields"]])
  names(field_map) <- names(spec[["fields"]])
  required <- c("ENTIDAD", "NOM_ENT", "MUN", "NOM_MUN", "LOC", "NOM_LOC", unname(field_map))
  missing <- setdiff(required, names(df))
  if (length(missing)) {
    stop("missing expected ITER columns for ", spec[["year"]], ": ", paste(missing, collapse = ", "), call. = FALSE)
  }

  municipalities <- df[df[["ENTIDAD"]] != "00" & df[["MUN"]] != "000" & df[["LOC"]] == "0000", required]
  base_counts <- data.frame(
    year = spec[["year"]],
    state_code = municipalities[["ENTIDAD"]],
    municipality_code = municipalities[["MUN"]],
    area_code = paste0(municipalities[["ENTIDAD"]], municipalities[["MUN"]]),
    state_name_source = municipalities[["NOM_ENT"]],
    municipality_name_source = municipalities[["NOM_MUN"]],
    source_dataset_id = spec[["dataset_id"]],
    source_fields = paste(names(field_map), field_map, sep = "=", collapse = "|"),
    stringsAsFactors = FALSE
  )

  if (identical(spec[["derivation"]], "age5plus_two_field")) {
    p5_catolic <- parse_inegi_count(municipalities[[field_map[["catholic"]]]])
    p5_ncatoli <- parse_inegi_count(municipalities[[field_map[["non_catholic_religion"]]]])
    p5_sinreli <- parse_inegi_count(municipalities[[field_map[["non_catholic_or_no_religion"]]]])
    inconsistent <- is.finite(p5_sinreli) & is.finite(p5_ncatoli) & p5_sinreli < p5_ncatoli
    age5plus_counts <- derive_age5plus_counts(p5_catolic, p5_ncatoli, p5_sinreli)
    no_religion <- age5plus_counts[["no_religion_count"]]
    religious_affiliation <- age5plus_counts[["religious_affiliation_count"]]
    population_total <- age5plus_counts[["population_total"]]
    no_religion[inconsistent] <- NA_real_
    religious_affiliation[inconsistent] <- NA_real_
    population_total[inconsistent] <- NA_real_

    counts <- data.frame(
      base_counts,
      catholic_count = p5_catolic,
      protestant_evangelical_count = NA_real_,
      other_religion_count = NA_real_,
      non_catholic_religion_count = p5_ncatoli,
      non_catholic_or_no_religion_count = p5_sinreli,
      no_religion_count = no_religion,
      religious_affiliation_count = religious_affiliation,
      population_total = population_total,
      source_quality_flag = ifelse(inconsistent, "source_inconsistent", ""),
      stringsAsFactors = FALSE
    )
    counts[["source_fields"]] <- paste(
      c(
        "catholic=p5_catolic",
        "non_catholic_religion=p5_ncatoli",
        "non_catholic_or_no_religion=p5_sinreli",
        "population_total=p5_catolic+p5_sinreli",
        "religious_affiliation_count=p5_catolic+p5_ncatoli",
        "no_religion_count=p5_sinreli-p5_ncatoli"
      ),
      collapse = "|"
    )
  } else {
    counts <- data.frame(
      base_counts,
      catholic_count = parse_inegi_count(municipalities[[field_map[["catholic"]]]]),
      protestant_evangelical_count = parse_inegi_count(municipalities[[field_map[["protestant_evangelical"]]]]),
      other_religion_count = parse_inegi_count(municipalities[[field_map[["other_religion"]]]]),
      non_catholic_religion_count = NA_real_,
      non_catholic_or_no_religion_count = NA_real_,
      no_religion_count = parse_inegi_count(municipalities[[field_map[["no_religion"]]]]),
      source_quality_flag = "",
      stringsAsFactors = FALSE
    )
    counts[["religious_affiliation_count"]] <- counts[["catholic_count"]] +
      counts[["protestant_evangelical_count"]] +
      counts[["other_religion_count"]]
    counts[["population_total"]] <- counts[["religious_affiliation_count"]] + counts[["no_religion_count"]]
  }

  counts[["religious_affiliation_percent"]] <- ifelse(
    counts[["population_total"]] > 0,
    round(100 * counts[["religious_affiliation_count"]] / counts[["population_total"]], 2),
    NA_real_
  )
  counts[["no_religion_percent"]] <- ifelse(
    counts[["population_total"]] > 0,
    round(100 * counts[["no_religion_count"]] / counts[["population_total"]], 2),
    NA_real_
  )

  list(
    counts = counts,
    total_validation = validate_iter_totals(df, spec[["fields"]], spec[["year"]]),
    locality_validation = validate_locality_sums(df, spec[["fields"]], spec[["year"]]),
    headline_validation = validate_headline_totals(df, counts, spec),
    source_inconsistent_count = sum(counts[["source_quality_flag"]] == "source_inconsistent", na.rm = TRUE)
  )
}

# read the INEGI 2020 municipality catalogue for state names and display labels.
read_municipality_catalog <- function(boundary_zip) {
  catalog <- read_delim(
    unz(boundary_zip, "catalogos/municipios.csv"),
    delim = ";",
    skip = 3,
    col_names = c("state_code", "state_name", "municipality_code", "municipality_name"),
    col_types = cols(.default = col_character()),
    locale = locale(encoding = "Latin1"),
    show_col_types = FALSE,
    progress = FALSE,
    trim_ws = TRUE
  )
  catalog <- catalog[!is.na(catalog[["state_code"]]) & nzchar(catalog[["state_code"]]), ]
  catalog[["area_code"]] <- paste0(catalog[["state_code"]], catalog[["municipality_code"]])
  catalog[["area_name"]] <- paste0(catalog[["municipality_name"]], ", ", catalog[["state_name"]])
  catalog[!duplicated(catalog[["area_code"]]), ]
}

# read, label, measure, simplify, and write the INEGI municipal boundary layer.
write_boundary_product <- function(boundary_zip, output_path) {
  layer_path <- paste0("/vsizip/", normalizePath(boundary_zip), "/conjunto_de_datos/00mun.shp")
  boundaries_raw <- st_read(layer_path, quiet = TRUE)
  catalog <- read_municipality_catalog(boundary_zip)

  boundaries_raw[["area_code"]] <- as.character(boundaries_raw[["CVEGEO"]])
  boundaries <- merge(
    boundaries_raw[, c("area_code", "CVE_ENT", "CVE_MUN", "NOMGEO")],
    catalog[, c("area_code", "area_name", "state_name", "municipality_name")],
    by = "area_code",
    all.x = TRUE,
    sort = FALSE
  )
  if (any(is.na(boundaries[["area_name"]]))) {
    missing_codes <- paste(boundaries[["area_code"]][is.na(boundaries[["area_name"]])], collapse = ", ")
    stop("missing municipality catalogue names for boundary codes: ", missing_codes, call. = FALSE)
  }

  boundaries <- boundaries[order(boundaries[["area_code"]]), ]
  boundaries <- st_make_valid(boundaries)
  area_table <- st_drop_geometry(boundaries)
  area_table[["land_area_sq_km"]] <- as.numeric(st_area(boundaries)) / 1e6
  area_table <- area_table[, c("area_code", "area_name", "state_name", "municipality_name", "land_area_sq_km")]

  tolerances <- c(1000, 1500, 2000, 3000, 5000, 8000, 12000)
  chosen_tolerance <- tail(tolerances, 1)
  chosen_bytes <- NA_integer_
  for (tolerance in tolerances) {
    candidate <- st_simplify(boundaries[, c("area_code", "area_name")], dTolerance = tolerance, preserveTopology = TRUE)
    candidate <- st_make_valid(st_transform(candidate, 4326))
    st_write(candidate, output_path, quiet = TRUE, delete_dsn = TRUE)
    chosen_bytes <- file_bytes(output_path)
    chosen_tolerance <- tolerance
    if (chosen_bytes <= 3000000L) break
  }

  list(
    area_table = area_table,
    source_feature_count = nrow(boundaries_raw),
    output_feature_count = row_count_file(output_path),
    simplification_tolerance_m = chosen_tolerance,
    output_bytes = chosen_bytes
  )
}

# build one schema-shaped area-summary row for a boundary/year pair.
build_area_row <- function(area, year, count_rows) {
  area_code <- area[["area_code"]][1]
  source <- count_rows[count_rows[["year"]] == year & count_rows[["area_code"]] == area_code, ]
  source_ids <- c(census_dataset_for_year(year), boundary_dataset_id)
  flags <- iter_spec_for_year(year)[["quality_flags"]]

  source_quality_flag <- if (nrow(source)) source[["source_quality_flag"]][1] else ""
  if (nzchar(source_quality_flag)) {
    flags <- c(flags, strsplit(source_quality_flag, ";", fixed = TRUE)[[1]])
  }
  source_inconsistent <- "source_inconsistent" %in% flags

  if (!nrow(source) || source_inconsistent || !is.finite(source[["population_total"]][1])) {
    if (!nrow(source)) {
      flags <- c(flags, "source_area_missing_for_wave")
    }
    if (nrow(source) && !source_inconsistent && !is.finite(source[["population_total"]][1])) {
      flags <- c(flags, "source_values_missing_for_wave")
    }
    population_total <- NULL
    religious_affiliation_count <- NULL
    religious_affiliation_percent <- NULL
    no_religion_count <- NULL
    no_religion_percent <- NULL
  } else {
    population_total <- as.integer(round(source[["population_total"]][1]))
    religious_affiliation_count <- as.integer(round(source[["religious_affiliation_count"]][1]))
    religious_affiliation_percent <- null_if_na(source[["religious_affiliation_percent"]][1])
    no_religion_count <- as.integer(round(source[["no_religion_count"]][1]))
    no_religion_percent <- null_if_na(source[["no_religion_percent"]][1])
  }

  basis <- iter_spec_for_year(year)[["denominator_note"]]

  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = "municipality",
    area_unit_id = paste0(boundary_set_id, ":", area_code),
    area_code = area_code,
    area_name = area[["area_name"]][1],
    year = year,
    population_total = population_total,
    population_total_basis = basis,
    religious_affiliation_count = religious_affiliation_count,
    religious_affiliation_percent = religious_affiliation_percent,
    no_religion_count = no_religion_count,
    no_religion_percent = no_religion_percent,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(area[["land_area_sq_km"]][1], 2),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = source_ids,
    quality_flag = paste(unique(flags), collapse = ";")
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

# create shared indicator metadata for the municipality product.
indicators_for_municipality <- function() {
  caveat <- paste(
    "The 2000 denominator covers people aged 5 and over with a stated response.",
    "The 2010 and 2020 denominators sum the four retained INEGI ITER constructs."
  )
  list(
    list(
      indicator_id = "population_total",
      label = "Religion-response denominator",
      description = "People counted in the public religion denominator for each wave.",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "For 2000, sum p5_catolic and p5_sinreli. For 2010 and 2020, sum the four retained ITER constructs after using INEGI municipality total rows.",
      temporal_coverage = "2000, 2010, 2020",
      spatial_coverage = "Mexico municipalities on INEGI 2020 Marco Geoestadistico boundaries",
      quality_notes = caveat
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious affiliation %",
      description = "Share of the wave-specific denominator in the retained religious-affiliation categories.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "For 2000, 100 * (p5_catolic + p5_ncatoli) / (p5_catolic + p5_sinreli). For 2010 and 2020, 100 * (Catholic + Protestant/evangelical/biblical + other religion) / four-construct denominator.",
      temporal_coverage = "2000, 2010, 2020",
      spatial_coverage = "Mexico municipalities on INEGI 2020 Marco Geoestadistico boundaries",
      quality_notes = caveat
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "No religion %",
      description = "Share of the wave-specific denominator in the INEGI no-religion/no-affiliation category.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "For 2000, 100 * (p5_sinreli - p5_ncatoli) / (p5_catolic + p5_sinreli). For 2010 and 2020, 100 * no religion / four-construct denominator.",
      temporal_coverage = "2000, 2010, 2020",
      spatial_coverage = "Mexico municipalities on INEGI 2020 Marco Geoestadistico boundaries",
      quality_notes = caveat
    )
  )
}

# define the choropleth layers exposed by the shared region map.
visual_layers_for_municipality <- function() {
  list(
    list(
      visual_layer_id = "mx-municipality-religious-affiliation",
      label = "Religious affiliation %",
      description = "Mexico census religion affiliation share.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = NULL,
      colour_scale = "shared sequential blue",
      time_control = "year_selector",
      aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = "2000 rows cover people aged 5 and over; 2010 rows use 2020 boundaries without a split/merge concordance."
    ),
    list(
      visual_layer_id = "mx-municipality-no-religion",
      label = "No religion %",
      description = "Mexico census no-religion share in the wave-specific denominator.",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = NULL,
      colour_scale = "shared sequential blue",
      time_control = "year_selector",
      aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = "The 2000 no-religion count is p5_sinreli minus p5_ncatoli. The no-religion label is PSIN_RELIG in 2020 and psin_relig in 2010."
    )
  )
}

# create source-dataset records for the area-summary document.
source_datasets <- function() {
  list(
    list(
      source_dataset_id = census_2000_dataset_id,
      name = "INEGI CGPV 2000 ITER national locality CSV",
      provider = "Instituto Nacional de Estadistica y Geografia (INEGI)",
      url = iter_2000_url,
      retrieval_date = retrieval_date,
      local_path = file.path(raw_dir, "cgpv2000_iter_00_csv.zip"),
      licence = list(name = "INEGI terms", url = inegi_terms_url, attribution = "Instituto Nacional de Estadistica y Geografia (INEGI)"),
      citation = "INEGI, XII Censo General de Poblacion y Vivienda 2000, ITER national CSV.",
      access_limits = NULL,
      redistribution_limits = "Raw archive is not committed; derived public products attribute INEGI and link to the source.",
      notes = "Used for 2000 municipality rows. The public metrics use p5_catolic, p5_ncatoli, and p5_sinreli for the population aged 5 and over."
    ),
    list(
      source_dataset_id = census_2010_dataset_id,
      name = "INEGI CPV 2010 ITER national locality CSV",
      provider = "Instituto Nacional de Estadistica y Geografia (INEGI)",
      url = iter_2010_url,
      retrieval_date = retrieval_date,
      local_path = file.path(raw_dir, "iter_nal_2010_csv.zip"),
      licence = list(name = "INEGI terms", url = inegi_terms_url, attribution = "Instituto Nacional de Estadistica y Geografia (INEGI)"),
      citation = "INEGI, Censo de Poblacion y Vivienda 2010, ITER national CSV.",
      access_limits = NULL,
      redistribution_limits = "Raw archive is not committed; derived public products attribute INEGI and link to the source.",
      notes = "Used for 2010 municipality rows. Source field pncatolica is mapped to the Protestant/evangelical/biblical construct described by the INEGI dictionary."
    ),
    list(
      source_dataset_id = census_2020_dataset_id,
      name = "INEGI CPV 2020 ITER national locality CSV",
      provider = "Instituto Nacional de Estadistica y Geografia (INEGI)",
      url = iter_2020_url,
      retrieval_date = retrieval_date,
      local_path = file.path(raw_dir, "iter_00_cpv2020_csv.zip"),
      licence = list(name = "INEGI terms", url = inegi_terms_url, attribution = "Instituto Nacional de Estadistica y Geografia (INEGI)"),
      citation = "INEGI, Censo de Poblacion y Vivienda 2020, ITER national CSV.",
      access_limits = NULL,
      redistribution_limits = "Raw archive is not committed; derived public products attribute INEGI and link to the source.",
      notes = "Used for 2020 municipality rows. The file exposes PCATOLICA, PRO_CRIEVA, POTRAS_REL, and PSIN_RELIG directly."
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "INEGI Marco Geoestadistico, Censo de Poblacion y Vivienda 2020, municipal layer",
      provider = "Instituto Nacional de Estadistica y Geografia (INEGI)",
      url = boundary_product_url,
      retrieval_date = retrieval_date,
      local_path = file.path(raw_dir, "mg_2020_integrado.zip"),
      licence = list(name = "INEGI terms and data-open product marking", url = inegi_terms_url, attribution = "Instituto Nacional de Estadistica y Geografia (INEGI)"),
      citation = "INEGI, Marco Geoestadistico, Censo de Poblacion y Vivienda 2020, conjunto_de_datos/00mun.",
      access_limits = NULL,
      redistribution_limits = "Raw archive is not committed; simplified derived boundary GeoJSON attributes INEGI and links to the source.",
      notes = "Municipal boundaries are simplified from the official 2020 integrated municipal layer."
    )
  )
}

# create a schema-compatible area-summary document.
area_summary_document <- function(rows) {
  list(
    schema_version = "0.2.0",
    generated_at = stamp,
    generated_by = script_id,
    country_code = country_code,
    boundary_set = list(
      boundary_set_id = boundary_set_id,
      country_code = country_code,
      level = "municipality",
      vintage = "2020",
      source_dataset_id = boundary_dataset_id
    ),
    site_snapshot = list(
      source_dataset_id = NULL,
      snapshot_date = NULL,
      basis = "no governed Mexico OpenStreetMap place-of-worship snapshot is included in this country data-map release",
      notes = "The Mexico page exposes INEGI census affiliation and no-religion metrics only; place-density metrics are hidden until a governed Mexico place layer is built."
    ),
    source_datasets = source_datasets(),
    indicators = indicators_for_municipality(),
    visual_layers = visual_layers_for_municipality(),
    rows = rows
  )
}

# create one CSV row for the ignored raw-source catalogue.
source_record <- function(item) {
  path <- file.path(raw_dir, item[["filename"]])
  if (!file.exists(path)) stop("missing source file for sources.csv: ", path, call. = FALSE)
  data.frame(
    filename = item[["filename"]],
    url = item[["url"]],
    retrieval_date = retrieval_date,
    publisher = item[["publisher"]],
    licence_text = licence_text,
    sha256 = sha256_file(path),
    bytes = file_bytes(path),
    source_dataset_id = item[["source_dataset_id"]],
    used_in_public_product = item[["used_in_public_product"]],
    periods = item[["periods"]],
    notes = item[["notes"]],
    stringsAsFactors = FALSE
  )
}

# create a manifest durable-file record for one generated output.
manifest_file_record <- function(path, content, licence_status = "inegi_terms_attribution_required") {
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

# report join coverage for one built census year.
join_coverage <- function(boundary_codes, count_rows, year) {
  source_codes <- unique(count_rows[count_rows[["year"]] == year, "area_code"])
  value_codes <- unique(count_rows[count_rows[["year"]] == year & is.finite(count_rows[["population_total"]]), "area_code"])
  missing <- sort(setdiff(boundary_codes, source_codes))
  extra <- sort(setdiff(source_codes, boundary_codes))
  list(
    year = year,
    matched_area_count = length(intersect(boundary_codes, source_codes)),
    matched_value_count = length(intersect(boundary_codes, value_codes)),
    expected_area_count = length(boundary_codes),
    source_area_count = length(source_codes),
    missing_area_codes = as.list(missing),
    extra_source_area_codes = as.list(extra)
  )
}

# convert sources.csv rows into manifest raw-source records.
raw_source_manifest_records <- function(sources_csv) {
  lapply(seq_len(nrow(sources_csv)), function(index) {
    row <- sources_csv[index, ]
    list(
      uri = file.path(raw_dir, row[["filename"]]),
      url = row[["url"]],
      format = sub("^.*\\.", "", row[["filename"]]),
      bytes = row[["bytes"]],
      sha256 = row[["sha256"]],
      source_dataset_id = row[["source_dataset_id"]],
      used_in_public_product = row[["used_in_public_product"]],
      periods = row[["periods"]],
      notes = row[["notes"]]
    )
  })
}

boundary_zip <- file.path(raw_dir, "mg_2020_integrado.zip")
boundary_out <- file.path(mx_dir, "mx_municipality_2020.geojson")
boundary_info <- write_boundary_product(boundary_zip, boundary_out)
area_table <- boundary_info[["area_table"]][order(boundary_info[["area_table"]][["area_code"]]), ]

wave_results <- lapply(iter_specs, read_iter_wave)
count_rows <- do.call(rbind, lapply(wave_results, `[[`, "counts"))
count_rows <- count_rows[order(count_rows[["year"]], count_rows[["area_code"]]), ]
extract_path <- file.path(raw_dir, "mx_iter_religion_municipality_extract_2000_2020.csv")
write.csv(count_rows, extract_path, row.names = FALSE, na = "")

area_split <- split(area_table, seq_len(nrow(area_table)))
years <- c(2000L, 2010L, 2020L)
# unname: split() names the pieces "1","2",... and unlist would weld those
# onto inner indices, turning rows into a named list that serialises as a
# json object; the runtime requires rows to be an array
municipality_rows <- unname(unlist(lapply(area_split, function(area) {
  lapply(years, function(year) build_area_row(area, year, count_rows))
}), recursive = FALSE))

summary_out <- file.path(mx_dir, "area_summary_municipality.json")
csv_out <- file.path(mx_dir, "area_summary_municipality.csv")
write_json(area_summary_document(municipality_rows), summary_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(municipality_rows), csv_out, row.names = FALSE, na = "")

derived_extract_record <- list(
  filename = basename(extract_path),
  url = extract_path,
  publisher = "Places of Worship project derivation from INEGI ITER",
  source_dataset_id = "mx-iter-religion-municipality-extract-2000-2020",
  used_in_public_product = TRUE,
  periods = "2000|2010|2020",
  notes = "Ignored local extract of municipality-level religion counts used to build the area-summary product."
)
sources_csv <- do.call(rbind, c(lapply(raw_downloads, source_record), list(source_record(derived_extract_record))))
write.csv(sources_csv, file.path(raw_dir, "sources.csv"), row.names = FALSE, na = "")

join_checks <- lapply(years, function(year) join_coverage(area_table[["area_code"]], count_rows, year))
total_validation <- lapply(wave_results, `[[`, "total_validation")
locality_validation <- lapply(wave_results, `[[`, "locality_validation")
headline_validation <- lapply(wave_results, `[[`, "headline_validation")
source_inconsistent_counts <- setNames(
  vapply(wave_results, `[[`, integer(1), "source_inconsistent_count"),
  vapply(iter_specs, function(spec) as.character(spec[["year"]]), character(1))
)
source_value_missing_counts <- setNames(
  vapply(years, function(year) {
    rows <- count_rows[count_rows[["year"]] == year, ]
    sum(!is.finite(rows[["population_total"]]) & rows[["source_quality_flag"]] != "source_inconsistent", na.rm = TRUE)
  }, integer(1)),
  as.character(years)
)

validation_checks <- c(
  "All four downloaded INEGI ZIP archives pass unzip integrity tests before this script is run.",
  sprintf("INEGI 2020 municipal boundary layer has %d source features and %d output features.", boundary_info[["source_feature_count"]], boundary_info[["output_feature_count"]]),
  sprintf("Municipal boundary GeoJSON writes to %d bytes after %d m simplification.", boundary_info[["output_bytes"]], boundary_info[["simplification_tolerance_m"]]),
  "Published counts use official ITER municipality total rows (LOC=0000); locality-sum reconciliation results are recorded because 2020 small-locality suppression prevents exact reconstruction from locality rows alone.",
  "State and national totals are reconciled from municipality rows for each built wave and retained in validation.state_validation and validation.national_validation.",
  sprintf("The 2000 guard found %d municipality rows where p5_sinreli is smaller than p5_ncatoli.", source_inconsistent_counts[["2000"]]),
  sprintf(
    "The 2000 source has %d municipality total row%s with unavailable public metric values.",
    source_value_missing_counts[["2000"]],
    ifelse(source_value_missing_counts[["2000"]] == 1L, "", "s")
  )
)

docs_manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = paste0("manifest:mx-census-religion:mx:2000-2020:", substr(sha256_file(summary_out), 1, 12)),
  dataset_id = "mx-census-religion:mx:2000-2020:inegi-iter",
  dataset_version_id = paste0("mx-census-religion:mx:2000-2020:inegi-iter:", substr(sha256_file(summary_out), 1, 12)),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "mx-census-religion",
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
      waves = c("2000", "2010", "2020"),
      municipality_boundary_set = boundary_set_id,
      municipality_boundary_simplification_tolerance_m = boundary_info[["simplification_tolerance_m"]],
      denominator = "2000: p5_catolic plus p5_sinreli for ages 5+; 2010 and 2020: sum of the four retained INEGI ITER constructs",
      omitted_metrics = c("religious_change", "places_per_10000_residents", "place_density_per_sq_km")
    ),
    software_versions = list(
      r = paste(R.version[["major"]], R.version[["minor"]], sep = "."),
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")),
      readr = as.character(packageVersion("readr")),
      dplyr = as.character(packageVersion("dplyr"))
    )
  ),
  source = list(
    provider = "Instituto Nacional de Estadistica y Geografia (INEGI)",
    source_dataset_ids = c(census_2000_dataset_id, census_2010_dataset_id, census_2020_dataset_id, boundary_dataset_id),
    source_urls = c(iter_2000_url, iter_2010_url, iter_2020_url, boundary_url, boundary_product_url, inegi_terms_url),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = licence_text,
    citation = "INEGI, Censos de Poblacion y Vivienda 2000, 2010 and 2020, ITER; INEGI, Marco Geoestadistico, Censo de Poblacion y Vivienda 2020.",
    raw_redistribution = "Raw INEGI ZIP archives and the local municipality extract are not committed. They remain in data/raw/mx_census/ with sources.csv checksums and await any project-controlled raw archive upload."
  ),
  input_manifests = list(),
  raw_sources = raw_source_manifest_records(sources_csv),
  durable_files = list(
    manifest_file_record(summary_out, "Mexico municipality area summary with INEGI ITER religion metrics."),
    manifest_file_record(csv_out, "Flattened Mexico municipality area summary with INEGI ITER religion metrics."),
    manifest_file_record(boundary_out, "Simplified Mexico 2020 municipality boundary GeoJSON derived from INEGI Marco Geoestadistico CPV 2020.")
  ),
  derived_outputs = list(
    list(
      uri = paste0("repo:", summary_out),
      sha256 = sha256_file(summary_out),
      built_by = script_id,
      notes = sprintf("%d municipalities x 3 census years; 2000 and 2010 have source rows for fewer municipality codes than the 2020 boundary set.", nrow(area_table))
    ),
    list(
      uri = paste0("repo:", boundary_out),
      sha256 = sha256_file(boundary_out),
      built_by = script_id,
      notes = sprintf("INEGI 2020 municipal layer simplified at %d m tolerance.", boundary_info[["simplification_tolerance_m"]])
    )
  ),
  validation = list(
    checks = validation_checks,
    join_coverage = list(municipality = join_checks),
    state_validation = lapply(total_validation, `[[`, "state_validation"),
    national_validation = lapply(total_validation, `[[`, "national_validation"),
    headline_national_validation = headline_validation,
    locality_sum_validation = locality_validation,
    source_inconsistency_guard = list(
      year = 2000,
      condition = "p5_sinreli < p5_ncatoli",
      inconsistent_row_count = source_inconsistent_counts[["2000"]]
    ),
    source_value_missing = list(
      year = 2000,
      unavailable_value_count = source_value_missing_counts[["2000"]],
      unavailable_area_codes = as.list(sort(count_rows[count_rows[["year"]] == 2000L & !is.finite(count_rows[["population_total"]]), "area_code"]))
    ),
    boundary_validation = list(
      municipality_source_feature_count = boundary_info[["source_feature_count"]],
      municipality_output_feature_count = boundary_info[["output_feature_count"]],
      municipality_output_bytes = boundary_info[["output_bytes"]],
      municipality_simplification_tolerance_m = boundary_info[["simplification_tolerance_m"]],
      unmapped_boundary_features = as.list(sort(setdiff(area_table[["area_code"]], count_rows[count_rows[["year"]] == 2020L, "area_code"]))),
      extra_source_area_codes_2020 = as.list(sort(setdiff(count_rows[count_rows[["year"]] == 2020L, "area_code"], area_table[["area_code"]])))
    )
  ),
  construct_notes = list(
    "The public map displays two headline metrics across 2000, 2010, and 2020: religious affiliation percent and no religion percent.",
    "For 2000, population_total = p5_catolic + p5_sinreli; religious_affiliation_count = p5_catolic + p5_ncatoli; no_religion_count = p5_sinreli - p5_ncatoli.",
    "The 2000 source universe is people aged 5 and over with a stated response; 2010 and 2020 count the full population in the four retained religion constructs.",
    "Every 2000 row carries quality_flag universe_age5plus. Rows would also carry source_inconsistent and null public metric values if p5_sinreli were smaller than p5_ncatoli.",
    "The 2010 source field pncatolica is mapped to the Protestant/evangelical/biblical construct because the dictionary label names Protestantes, evangelicas y biblicas.",
    "The 2020 source fields are PCATOLICA, PRO_CRIEVA, POTRAS_REL, and PSIN_RELIG.",
    "No full denomination crosswalk or trend layer is attempted; category labels changed across waves.",
    "Municipality rows use 2020 boundaries without a split/merge concordance for 2010."
  ),
  privacy = "public",
  licence_status = "inegi_terms_attribution_required",
  downstream_status = "public",
  source_datasets = source_datasets(),
  notes = "The committed products contain derived area summaries and simplified boundaries only. On-page attribution must cite INEGI, INEGI terms, and the Marco Geoestadistico boundary source."
)

manifest_out <- file.path(manifest_dir, "mx-census-religion-2000-2020.json")
write_json(docs_manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)

cat(sprintf("wrote %s: %d rows\n", summary_out, length(municipality_rows)))
cat(sprintf("wrote %s: %d rows\n", csv_out, row_count_file(csv_out)))
cat(sprintf("wrote %s: %d features, %d bytes\n", boundary_out, row_count_file(boundary_out), file_bytes(boundary_out)))
cat(sprintf("wrote %s\n", manifest_out))
cat("done\n")
