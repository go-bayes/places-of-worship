#!/usr/bin/env Rscript

# build the provisional measurement-regime declarations from committed metadata
suppressPackageStartupMessages(library(jsonlite))

manifest_dir <- "docs/manifests"
region_dir <- "apps/regions"
json_output <- "apps/global/data/measurement_regimes.json"
csv_output <- "apps/global/data/measurement_regimes.csv"

row_fields <- c(
  "country_code", "manifest_path", "instrument", "wave_count", "year_min",
  "year_max", "geography_grain", "grain_label_verbatim", "value_basis",
  "no_religion_category", "not_stated_handling", "universe_basis_verbatim",
  "licence_posture", "small_cell_marks", "boundary_licence_verbatim"
)

vocabulary <- list(
  instrument = c("census_affiliation", "survey_estimate", "administrative_register_membership", "register_of_organisations", "administrative_infrastructure", "attendance_survey", "unknown"),
  geography_grain = c("national", "adm1", "adm2", "mixed", "other"),
  value_basis = c("counts", "percent_only", "counts_and_percent", "weighted_estimates_with_uncertainty", "unknown"),
  no_religion_category = c("present", "absent_in_published_frame", "reference_complement_only", "not_applicable_register_construct", "unknown"),
  not_stated_handling = c("separate_line_in_denominator", "folded_or_prorated", "absent", "not_applicable", "unknown"),
  licence_posture = c("accepted_open", "needs_review_build_then_ask", "consent_first_hold", "mixed", "unknown"),
  small_cell_marks = c("present", "absent", "unknown")
)

# return a stable scalar string or the declared unknown value
scalar_or_unknown <- function(value) {
  if (is.null(value) || length(value) != 1L || is.na(value) || !nzchar(as.character(value))) {
    return("unknown")
  }
  as.character(value)
}

# flatten metadata while retaining exact JSON-style key paths
flatten_metadata <- function(value, prefix = "") {
  output <- list()
  if (is.list(value)) {
    value_names <- names(value)
    if (is.null(value_names)) value_names <- as.character(seq_along(value) - 1L)
    for (i in seq_along(value)) {
      child_prefix <- if (nzchar(prefix)) paste(prefix, value_names[[i]], sep = ".") else value_names[[i]]
      output <- c(output, flatten_metadata(value[[i]], child_prefix))
    }
  } else if (length(value) == 1L && !is.na(value)) {
    output[[prefix]] <- as.character(value)
  }
  output
}

# collect scalar metadata values whose key paths match a pattern
metadata_matches <- function(flat, path_pattern) {
  paths <- names(flat)
  flat[grepl(path_pattern, paths, ignore.case = TRUE, perl = TRUE)]
}

# select quality tokens exactly as committed in area-summary rows
quality_tokens <- function(products) {
  flags <- unlist(lapply(products, function(product) {
    if (is.null(product$rows)) return(character())
    vapply(product$rows, function(row) scalar_or_unknown(row$quality_flag), character(1))
  }), use.names = FALSE)
  flags <- flags[flags != "unknown"]
  tokens <- trimws(unlist(strsplit(flags, "[;|]", perl = TRUE), use.names = FALSE))
  sort(unique(tokens[nzchar(tokens)]))
}

# return the first exact quality token matching a declared rule
first_token <- function(tokens, pattern) {
  hit <- tokens[grepl(pattern, tokens, ignore.case = TRUE, perl = TRUE)]
  if (length(hit) == 0L) return(NULL)
  hit[[1]]
}

# construct a value and its mandatory provenance pointer
declared <- function(value, source) list(value = value, source = source)

# classify an instrument only from manifest metadata
extract_instrument <- function(manifest, flat) {
  family <- scalar_or_unknown(manifest$dataset_family)
  corpus <- tolower(paste(unlist(flat, use.names = FALSE), collapse = " | "))
  instrument_source <- function(family_pattern, metadata_pattern) {
    if (grepl(family_pattern, family, ignore.case = TRUE, perl = TRUE)) return("manifest:dataset_family")
    hits <- names(flat)[grepl(metadata_pattern, unlist(flat, use.names = FALSE), ignore.case = TRUE, perl = TRUE)]
    if (length(hits) == 0L) return(NULL)
    paste0("manifest:", hits[[1]])
  }
  if (grepl("attendance", family, fixed = TRUE)) return(declared("attendance_survey", "manifest:dataset_family"))
  if (grepl("survey", family, fixed = TRUE)) return(declared("survey_estimate", "manifest:dataset_family"))
  if (grepl("membership", family, fixed = TRUE)) return(declared("administrative_register_membership", "manifest:dataset_family"))
  if (grepl("register", family, fixed = TRUE)) return(declared("register_of_organisations", "manifest:dataset_family"))
  if (grepl("census", family, fixed = TRUE)) return(declared("census_affiliation", "manifest:dataset_family"))
  if (grepl("attendance", family, fixed = TRUE) || grepl("self_reported_attendance|single_count_sunday", corpus)) {
    return(declared("attendance_survey", instrument_source("attendance", "self_reported_attendance|single_count_sunday")))
  }
  if (grepl("survey", family, fixed = TRUE) || grepl("survey|weighted.*estimate", corpus)) {
    return(declared("survey_estimate", instrument_source("survey", "survey|weighted.*estimate")))
  }
  if (grepl("membership", family, fixed = TRUE) || grepl("administrative_membership_register|legal_membership", corpus)) {
    return(declared("administrative_register_membership", instrument_source("membership", "administrative_membership_register|legal_membership")))
  }
  if (grepl("register", family, fixed = TRUE) || grepl("registered temples|register of religious", corpus)) {
    return(declared("register_of_organisations", instrument_source("register", "registered temples|register of religious")))
  }
  if (grepl("census", family, fixed = TRUE) || grepl("census_affiliation|full_enumeration_census", corpus)) {
    return(declared("census_affiliation", instrument_source("census", "census_affiliation|full_enumeration_census")))
  }
  declared("unknown", NULL)
}

# derive wave years from product rows, with manifest target years as a fallback
extract_years <- function(manifest, products) {
  years <- suppressWarnings(as.integer(unlist(lapply(products, function(product) {
    if (is.null(product$rows)) return(integer())
    vapply(product$rows, function(row) row$year %||% NA_integer_, integer(1))
  }), use.names = FALSE)))
  years <- sort(unique(years[!is.na(years)]))
  source <- "area_summary:rows[].year"
  if (length(years) == 0L && !is.null(manifest$target_years)) {
    years <- sort(unique(as.integer(unlist(manifest$target_years))))
    years <- years[!is.na(years)]
    source <- "manifest:target_years"
  }
  if (length(years) == 0L) {
    return(list(wave_count = declared(0L, "derived:no declared years"), year_min = declared("unknown", NULL), year_max = declared("unknown", NULL)))
  }
  list(
    wave_count = declared(length(years), source),
    year_min = declared(min(years), source),
    year_max = declared(max(years), source)
  )
}

# classify the committed boundary-level labels
extract_geography <- function(products) {
  labels <- sort(unique(unlist(lapply(products, function(product) {
    if (is.null(product$rows)) return(character())
    vapply(product$rows, function(row) scalar_or_unknown(row$boundary_level), character(1))
  }), use.names = FALSE)))
  labels <- labels[labels != "unknown"]
  label_value <- if (length(labels) == 0L) "unknown" else paste(labels, collapse = " | ")
  label_source <- if (length(labels) == 0L) NULL else "area_summary:rows[].boundary_level"
  if (length(labels) == 0L) return(list(grain = declared("other", "derived:no declared boundary level"), label = declared("unknown", NULL)))
  national_labels <- c("adm0")
  adm1_labels <- c("area", "area_council", "atoll", "autonomous_community", "bundesland", "canton", "commune", "concelho", "constituency", "county", "county_city", "department", "diocese", "district", "governorate", "island", "judet", "kommune", "kraj", "macro_region", "municipality", "parish", "planning_area", "prefecture", "province", "raion", "region", "sco_ca", "sido", "state", "state_region", "territorial_authority", "uf")
  adm2_labels <- c("adm2", "cd_2001", "cd_2011", "cd_2021", "county_1850", "county_1860", "county_1870", "county_1890", "county_1930", "district_2001", "district_2011", "ew_ltla", "kreis", "lau_2021", "ni_lgd", "sa2", "si_gun_gu", "sogn", "statistical_area_2", "sub_prefecture_or_commune")
  classes <- unique(ifelse(labels %in% national_labels, "national", ifelse(labels %in% adm1_labels, "adm1", ifelse(labels %in% adm2_labels, "adm2", "other"))))
  grain <- if (length(classes) == 1L) classes[[1]] else "mixed"
  list(grain = declared(grain, "derived from area_summary:rows[].boundary_level"), label = declared(label_value, label_source))
}

# derive value publication basis from row fields and indicator declarations
extract_value_basis <- function(products, tokens) {
  indicator_text <- tolower(paste(unlist(lapply(products, function(product) product$indicators), use.names = FALSE), collapse = " | "))
  if (grepl("weighted", indicator_text) && grepl("confidence|uncertainty|interval|margin", indicator_text)) {
    return(declared("weighted_estimates_with_uncertainty", "area_summary:indicators[].method/unit"))
  }
  rows <- unlist(lapply(products, function(product) product$rows), recursive = FALSE)
  names_present <- unique(unlist(lapply(rows, names), use.names = FALSE))
  count_fields <- grep("(_count$|population_total$)", names_present, value = TRUE)
  percent_fields <- grep("(_percent$|_share$)", names_present, value = TRUE)
  has_non_null <- function(fields) any(vapply(rows, function(row) any(vapply(fields, function(field) !is.null(row[[field]]) && length(row[[field]]) == 1L && !is.na(row[[field]]), logical(1))), logical(1)))
  has_counts <- length(count_fields) > 0L && has_non_null(count_fields)
  has_percent <- length(percent_fields) > 0L && has_non_null(percent_fields)
  if (has_counts && has_percent) return(declared("counts_and_percent", "area_summary:rows[] count and percent indicator fields"))
  if (has_counts) return(declared("counts", "area_summary:rows[] count indicator fields"))
  if (has_percent) return(declared("percent_only", "area_summary:rows[] percent indicator fields"))
  declared("unknown", NULL)
}

# classify the published no-religion frame from exact declarations
extract_no_religion <- function(products, tokens) {
  register_token <- first_token(tokens, "membership_not_affiliation|administrative_(membership|religion)_register|registered_temples|legal_membership")
  if (!is.null(register_token)) return(declared("not_applicable_register_construct", paste0("quality_flag token: ", register_token)))
  complement_token <- first_token(tokens, "reference_group=|reference_complement|minority_share.*complement|exact_complement")
  if (!is.null(complement_token)) return(declared("reference_complement_only", paste0("quality_flag token: ", complement_token)))
  absent_token <- first_token(tokens, "no_religion_category_absent|no_no_religion|no such category|no standalone no.religion|no_religion_not_separable")
  present_token <- first_token(tokens, "no_religion_(percent|slot|line)|explicit_source_no.religion|no religion category|none category")
  rows <- unlist(lapply(products, function(product) product$rows), recursive = FALSE)
  has_published_value <- any(vapply(rows, function(row) !is.null(row$no_religion_percent) && length(row$no_religion_percent) == 1L && !is.na(row$no_religion_percent), logical(1)))
  if (!is.null(absent_token) && (!is.null(present_token) || has_published_value)) return(declared("unknown", NULL))
  if (!is.null(absent_token)) return(declared("absent_in_published_frame", paste0("quality_flag token: ", absent_token)))
  if (!is.null(present_token)) return(declared("present", paste0("quality_flag token: ", present_token)))
  if (has_published_value) {
    return(declared("present", "area_summary:rows[].no_religion_percent"))
  }
  declared("unknown", NULL)
}

# classify not-stated treatment from exact quality declarations
extract_not_stated <- function(tokens, no_religion_value, products) {
  if (no_religion_value == "not_applicable_register_construct") return(declared("not_applicable", "derived from declared register construct"))
  folded <- first_token(tokens, "folded|prorat|combined_no_religion_not_stated|no.religion/not.stated")
  separate <- first_token(tokens, "not_stated_in_denominator|not.stated.*retained_in_denominator|unknown.*in_denominator|non.response.*in_denominator|undeclared.*in_denominator|separate.*denominator")
  absent <- first_token(tokens, "not_stated_category_absent|no_not_stated|source_no_non_response_category")
  kinds <- Filter(Negate(is.null), list(folded = folded, separate = separate, absent = absent))
  if (length(kinds) != 1L) return(declared("unknown", NULL))
  name <- names(kinds)[[1]]
  years <- unique(unlist(lapply(products, function(product) vapply(product$rows %||% list(), function(row) row$year %||% NA_integer_, integer(1))), use.names = FALSE))
  if (name == "absent" && sum(!is.na(years)) > 1L) return(declared("unknown", NULL))
  value <- c(folded = "folded_or_prorated", separate = "separate_line_in_denominator", absent = "absent")[[name]]
  declared(value, paste0("quality_flag token: ", kinds[[1]]))
}

# take a single verbatim universe declaration without reconciling conflicts
extract_universe <- function(manifest, products, flat) {
  direct <- metadata_matches(flat, "^pipeline\\.parameters\\.(universe|denominator|construct\\.universe)$")
  direct <- unique(unlist(direct, use.names = FALSE))
  if (length(direct) == 1L) return(declared(direct[[1]], paste0("manifest:", names(metadata_matches(flat, "^pipeline\\.parameters\\.(universe|denominator|construct\\.universe)$"))[[1]])))
  bases <- sort(unique(unlist(lapply(products, function(product) {
    if (is.null(product$rows)) return(character())
    vapply(product$rows, function(row) scalar_or_unknown(row$population_total_basis), character(1))
  }), use.names = FALSE)))
  bases <- bases[bases != "unknown"]
  if (length(bases) == 1L) return(declared(bases[[1]], "area_summary:rows[].population_total_basis"))
  declared("unknown", NULL)
}

# map licence status and basis fields only
extract_licence <- function(manifest) {
  status <- tolower(scalar_or_unknown(manifest$licence_status))
  basis <- tolower(scalar_or_unknown(manifest$licence_basis))
  source <- if (status != "unknown" && basis != "unknown") "manifest:licence_status + licence_basis" else if (status != "unknown") "manifest:licence_status" else NULL
  if (grepl("consent.first|hold", basis)) return(declared("consent_first_hold", source))
  if (status %in% c("accepted", "open", "approved")) return(declared("accepted_open", source))
  if (grepl("needs.review|pending|staged", status) || grepl("needs.review|build.then.ask|pending", basis)) return(declared("needs_review_build_then_ask", source))
  if (grepl("mixed", status) || grepl("mixed", basis)) return(declared("mixed", source))
  declared("unknown", NULL)
}

# detect exact small-cell declarations in quality flags
extract_small_cells <- function(tokens) {
  present <- first_token(tokens, "small_cell_under|small.cell.suppress|small_denominator|rr3_small_denominator")
  absent <- first_token(tokens, "no_small_cell_suppression|no_small_cell_treatment")
  if (!is.null(present) && is.null(absent)) return(declared("present", paste0("quality_flag token: ", present)))
  if (!is.null(absent) && is.null(present)) return(declared("absent", paste0("quality_flag token: ", absent)))
  declared("unknown", NULL)
}

# return one verbatim boundary licence from a boundary-labelled source dataset
extract_boundary_licence <- function(manifest) {
  datasets <- manifest$source_datasets
  if (is.null(datasets)) return(declared("unknown", NULL))
  candidates <- list()
  for (i in seq_along(datasets)) {
    dataset <- datasets[[i]]
    descriptor <- tolower(paste(unlist(dataset[c("name", "provider", "notes", "source_dataset_id")]), collapse = " | "))
    licence <- if (is.list(dataset$licence)) scalar_or_unknown(dataset$licence$name) else scalar_or_unknown(dataset$licence)
    if (grepl("boundary|geobound|gisco|gadm|dawa|geoportal|shapefile", descriptor) && licence != "unknown") {
      candidates[[length(candidates) + 1L]] <- list(value = licence, source = sprintf("manifest:source_datasets.%d.licence.name", i - 1L))
    }
  }
  values <- unique(vapply(candidates, `[[`, character(1), "value"))
  if (length(values) != 1L) return(declared("unknown", NULL))
  declared(values[[1]], candidates[[which(vapply(candidates, `[[`, character(1), "value") == values[[1]])[[1]]]]$source)
}

# provide a null-coalescing helper without external dependencies
`%||%` <- function(left, right) if (is.null(left)) right else left
`%notin%` <- function(left, right) !(left %in% right)

manifest_paths <- sort(list.files(manifest_dir, pattern = "\\.json$", full.names = TRUE))
product_paths <- sort(list.files(region_dir, pattern = "^area_summary_.*\\.json$", recursive = TRUE, full.names = TRUE))
product_paths <- product_paths[!grepl("/_shared/", product_paths, fixed = TRUE)]
products <- lapply(product_paths, fromJSON, simplifyVector = FALSE)
names(products) <- product_paths

# collect manifest source identifiers without flattening large product rows
manifest_source_ids <- function(manifest) {
  unique(c(
    scalar_or_unknown(manifest$dataset_id),
    unlist(manifest$source$source_dataset_ids %||% character(), use.names = FALSE),
    unlist(lapply(manifest$source_datasets %||% list(), function(dataset) dataset$source_dataset_id %||% character()), use.names = FALSE)
  ))
}

# collect product source identifiers from declared source blocks and rows
product_source_ids <- function(product) {
  unique(c(
    unlist(lapply(product$source_datasets %||% list(), function(dataset) dataset$source_dataset_id %||% character()), use.names = FALSE),
    unlist(lapply(product$rows %||% list(), function(row) row$source_dataset_ids %||% character()), use.names = FALSE)
  ))
}

product_ids <- lapply(products, product_source_ids)

region_codes <- sort(unique(sub("/.*", "", sub(paste0("^", region_dir, "/"), "", product_paths))))
rows <- list()
provenance <- list()
mapped_manifests <- character()
covered_regions <- character()

for (manifest_path in manifest_paths) {
  manifest <- fromJSON(manifest_path, simplifyVector = FALSE)
  country_codes <- toupper(unlist(manifest$scope$country_codes %||% character(), use.names = FALSE))
  is_nz_osm <- basename(manifest_path) == "osm-pow-nz-2013-2025-raw-ohsome-dffb55663f94.json"
  if (is_nz_osm) country_codes <- "NZ"
  if (identical(country_codes, "NZ") && !is_nz_osm) next
  if (length(country_codes) != 1L || tolower(country_codes[[1]]) %notin% region_codes) next
  country_code <- country_codes[[1]]
  country_products <- products[grepl(paste0("^", region_dir, "/", tolower(country_code), "/data/"), names(products))]
  if (length(country_products) == 0L) next

  manifest_ids <- manifest_source_ids(manifest)
  match_scores <- vapply(names(country_products), function(path) length(intersect(manifest_ids, product_ids[[path]])), integer(1))
  fully_declared <- vapply(names(country_products), function(path) length(setdiff(product_ids[[path]], manifest_ids)) == 0L, logical(1))
  if (any(fully_declared)) {
    country_products <- country_products[fully_declared]
  } else if (max(match_scores) > 0L) {
    country_products <- country_products[match_scores == max(match_scores)]
  }
  target_years <- suppressWarnings(as.integer(unlist(manifest$target_years %||% integer(), use.names = FALSE)))
  target_years <- target_years[!is.na(target_years)]
  if (length(target_years) > 0L) {
    country_products <- lapply(country_products, function(product) {
      product$rows <- Filter(function(row) is.null(row$year) || as.integer(row$year) %in% target_years, product$rows)
      product
    })
  }

  flat <- flatten_metadata(manifest)
  tokens <- quality_tokens(country_products)
  instrument <- extract_instrument(manifest, flat)
  years <- extract_years(manifest, country_products)
  geography <- extract_geography(country_products)
  value_basis <- extract_value_basis(country_products, tokens)
  no_religion <- extract_no_religion(country_products, tokens)
  not_stated <- extract_not_stated(tokens, no_religion$value, country_products)
  universe <- extract_universe(manifest, country_products, flat)
  licence <- extract_licence(manifest)
  small_cells <- extract_small_cells(tokens)
  boundary_licence <- extract_boundary_licence(manifest)

  declarations <- list(
    country_code = declared(country_code, "manifest:scope.country_codes.0"),
    manifest_path = declared(manifest_path, "manifest:file path"),
    instrument = instrument,
    wave_count = years$wave_count,
    year_min = years$year_min,
    year_max = years$year_max,
    geography_grain = geography$grain,
    grain_label_verbatim = geography$label,
    value_basis = value_basis,
    no_religion_category = no_religion,
    not_stated_handling = not_stated,
    universe_basis_verbatim = universe,
    licence_posture = licence,
    small_cell_marks = small_cells,
    boundary_licence_verbatim = boundary_licence
  )
  row <- lapply(declarations, `[[`, "value")
  row <- row[row_fields]
  row_key <- manifest_path
  rows[[row_key]] <- row
  provenance[[row_key]] <- lapply(declarations, `[[`, "source")
  mapped_manifests <- c(mapped_manifests, manifest_path)
  covered_regions <- c(covered_regions, tolower(country_code))
}

# stop if coverage or row identity diverges from the committed corpus
stopifnot(length(rows) == length(mapped_manifests))
stopifnot(length(unique(mapped_manifests)) == length(mapped_manifests))
stopifnot(setequal(region_codes, unique(covered_regions)))

# validate all controlled fields and provenance before emission
for (row_key in names(rows)) {
  row <- rows[[row_key]]
  stopifnot(identical(names(row), row_fields))
  for (field in names(vocabulary)) stopifnot(row[[field]] %in% vocabulary[[field]])
  stopifnot(is.numeric(row$wave_count) || is.integer(row$wave_count))
  stopifnot(row$wave_count >= 0L)
  for (field in row_fields) {
    value <- row[[field]]
    is_unknown <- identical(value, "unknown")
    if (!is_unknown && (is.null(provenance[[row_key]][[field]]) || !nzchar(provenance[[row_key]][[field]]))) {
      stop(sprintf("known value lacks provenance: %s / %s", row_key, field))
    }
  }
}

rows <- unname(rows)
output <- list(
  generated_at = "2026-07-13",
  generated_by = "scripts/build_measurement_regime_table.R",
  vocabulary_version = "v1-provisional",
  rows = rows,
  provenance = provenance
)

dir.create(dirname(json_output), recursive = TRUE, showWarnings = FALSE)
write_json(output, json_output, pretty = TRUE, auto_unbox = TRUE, na = "null", digits = NA)

# write a flat CSV and prove that every cell round-trips as text
row_frame <- do.call(rbind.data.frame, c(lapply(rows, function(row) lapply(row, as.character)), stringsAsFactors = FALSE))
write.csv(row_frame, csv_output, row.names = FALSE, na = "")
round_trip <- read.csv(csv_output, colClasses = "character", check.names = FALSE, na.strings = NULL)
stopifnot(identical(names(round_trip), names(row_frame)))
stopifnot(identical(as.matrix(round_trip), as.matrix(row_frame)))

# parse the emitted JSON and revalidate the row count
parsed <- fromJSON(json_output, simplifyVector = FALSE)
stopifnot(length(parsed$rows) == length(mapped_manifests))

unmapped <- setdiff(manifest_paths, mapped_manifests)
cat(sprintf("wrote %d rows from %d manifests; %d manifests unmapped\n", length(rows), length(manifest_paths), length(unmapped)))
if (length(unmapped) > 0L) cat(paste(unmapped, collapse = "\n"), "\n")
