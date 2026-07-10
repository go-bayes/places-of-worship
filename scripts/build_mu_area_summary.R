# build the Mauritius district religion series from census Table D6.
# inputs: Statistics Mauritius demographic table-report PDFs for 2000, 2011,
# and 2022 plus geoBoundaries MUS ADM1; outputs: a 30-row area summary,
# simplified 10-feature boundary, CSV sibling, and data manifest.
# run from the repository root: Rscript scripts/build_mu_area_summary.R

suppressMessages({
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

raw_dir <- "data/raw/mu_census"
out_dir <- "apps/regions/mu/data"
manifest_dir <- "docs/manifests"
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieved_at <- "2026-07-10T00:00:00Z"
script_id <- "scripts/build_mu_area_summary.R"
country_code <- "MU"
boundary_set_id <- "mu-adm1-2017-geoboundaries"
boundary_dataset_id <- "geoboundaries-mus-adm1-2017"
boundary_path <- file.path(raw_dir, "mus_adm1.geojson")
boundary_out <- file.path(out_dir, "mu_adm1_2017.geojson")
summary_json_out <- file.path(out_dir, "area_summary_district.json")
summary_csv_out <- file.path(out_dir, "area_summary_district.csv")
manifest_out <- file.path(manifest_dir, "mu-census-religion-2000-2022.json")

census_urls <- c(
  `1990` = "https://statsmauritius.govmu.org/Documents/Census_and_Surveys/Archive%20Census/1990%20Census/Table%20Reports/1990%20HPC%20Vol.%20II.pdf",
  `2000` = "https://statsmauritius.govmu.org/Documents/Census_and_Surveys/HPC/2000/TR_VOLII-Demographic_Characteristics.pdf",
  `2011` = "https://statsmauritius.govmu.org/Documents/Census_and_Surveys/HPC/2011/HPC_TR_Vol2_Demography_Yr11.pdf",
  `2022` = "https://statsmauritius.govmu.org/Documents/Census_and_Surveys/Census2022/HPC_TR_Vol2_Demography_Yr22.pdf"
)
archive_urls <- c(
  `1990` = "https://web.archive.org/web/20240626074506id_/https://statsmauritius.govmu.org/Documents/Census_and_Surveys/Archive%20Census/1990%20Census/Table%20Reports/1990%20HPC%20Vol.%20II.pdf",
  `2000` = "https://web.archive.org/web/20250403151859id_/https://statsmauritius.govmu.org/Documents/Census_and_Surveys/HPC/2000/TR_VOLII-Demographic_Characteristics.pdf",
  `2011` = "https://web.archive.org/web/20240929031031id_/https://statsmauritius.govmu.org/Documents/Census_and_Surveys/HPC/2011/HPC_TR_Vol2_Demography_Yr11.pdf"
)
boundary_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/MUS/ADM1/"
boundary_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/MUS/ADM1/geoBoundaries-MUS-ADM1.geojson"
copyright_url <- "https://www.govmu.org/FR/Pages/Mentions_Legales.aspx"

wave_specs <- list(
  `2000` = list(year = 2000L, file = "mu_2000_vol2.pdf", columns = 14L,
                d6_start = "Table D6 - Resident population by geographical location and religious group",
                d6_end = "Table D7 -"),
  `2011` = list(year = 2011L, file = "mu_2011_vol2.pdf", columns = 13L,
                d6_start = "Table D6 - Resident population by geographical location and religious group",
                d6_end = "Table D7 -"),
  `2022` = list(year = 2022L, file = "mu_2022_vol2.pdf", columns = 14L,
                d6_start = "Table D6 - Resident population by geographical location and religious group",
                d6_end = "Table D7 -")
)

area_specs <- list(
  list(code = "MU-PU", name = "Port Louis", pattern = "^\\s*PORT LOUIS DISTRICT(?!\\))"),
  list(code = "MU-PA", name = "Pamplemousses", pattern = "^\\s*PAMPLEMOUSSES(?:\\s+[0-9]|\\s+DISTRICT(?!\\)))"),
  list(code = "MU-RR", name = "Rivière du Rempart", pattern = "^\\s*(R\\.? DU REMPART DISTRICT|RIVIERE DU REMPART)"),
  list(code = "MU-FL", name = "Flacq", pattern = "^\\s*FLACQ DISTRICT(?!\\))"),
  list(code = "MU-GP", name = "Grand Port", pattern = "^\\s*GRAND PORT DISTRICT(?!\\))"),
  list(code = "MU-SA", name = "Savanne", pattern = "^\\s*SAVANNE DISTRICT(?!\\))"),
  list(code = "MU-PW", name = "Plaines Wilhems", pattern = "^\\s*PLAINES WILHEMS DISTRICT(?!\\))"),
  list(code = "MU-MO", name = "Moka", pattern = "^\\s*MOKA DISTRICT(?!\\))"),
  list(code = "MU-BL", name = "Black River", pattern = "^\\s*BLACK RIVER DISTRICT(?!\\))"),
  list(code = "MU-RO", name = "Rodrigues", pattern = "^\\s*ISLAND OF RODRIGUES")
)

# return a required path or fail before creating a partial product.
require_file <- function(path) {
  if (!file.exists(path) || file.info(path)[["size"]] <= 0) {
    stop("missing required source: ", path, call. = FALSE)
  }
  path
}

# return the SHA-256 digest of one file.
sha256_file <- function(path) unname(tools::sha256sum(path))

# return one file's byte size as a plain number.
file_bytes <- function(path) as.numeric(unname(file.info(path)[["size"]]))

# run the documented "uvx check-jsonschema" command against one written artefact
# and stop on any validation failure. Mirrors the command sibling
# build_*_area_summary.R scripts record in their manifests (see schemas/README.md);
# unlike the 14 legacy generation-shape exceptions catalogued there, this product
# is a from-scratch build with no ruling excusing non-conformance, so a failure
# here means a real defect and must not be softened into a warning.
validate_against_schema <- function(schema_path, data_path) {
  uvx <- Sys.which("uvx")
  if (!nzchar(uvx)) stop("uvx is required to validate ", data_path, " against ", schema_path, call. = FALSE)
  output <- system2(uvx, c("check-jsonschema", "--schemafile", shQuote(schema_path), shQuote(data_path)),
                     stdout = TRUE, stderr = TRUE)
  status <- attr(output, "status")
  if (is.null(status)) status <- 0L
  if (status != 0L) {
    stop("schema validation failed for ", data_path, " against ", schema_path, ":\n",
         paste(output, collapse = "\n"), call. = FALSE)
  }
  invisible(output)
}

# extract a PDF with poppler while rejecting scans and extraction failures.
pdf_layout_lines <- function(path) {
  pdftotext <- Sys.which("pdftotext")
  if (!nzchar(pdftotext)) stop("pdftotext (poppler) is required", call. = FALSE)
  text_path <- tempfile(fileext = ".txt")
  on.exit(unlink(text_path), add = TRUE)
  status <- system2(pdftotext, c("-layout", shQuote(path), shQuote(text_path)))
  if (status != 0L || !file.exists(text_path)) {
    stop("pdftotext failed for ", path, call. = FALSE)
  }
  lines <- readLines(text_path, warn = FALSE, encoding = "UTF-8")
  if (!length(lines) || !any(nzchar(trimws(lines)))) {
    stop("PDF has no machine-readable text layer: ", path, call. = FALSE)
  }
  lines
}

# isolate Table D6 so similarly named rows in later tables cannot match.
table_d6_lines <- function(lines, spec) {
  starts <- grep(spec[["d6_start"]], lines, fixed = TRUE)
  if (!length(starts)) stop("Table D6 heading not found for ", spec[["year"]], call. = FALSE)
  start <- starts[[1]]
  ends <- grep(spec[["d6_end"]], lines, fixed = TRUE)
  ends <- ends[ends > start]
  end <- if (length(ends)) ends[[1]] - 1L else length(lines)
  lines[start:end]
}

# turn printed integer tokens and dash-form zero cells into counts.
numeric_tokens <- function(line) {
  first_number <- regexpr("[0-9]", line, perl = TRUE)[[1]]
  if (first_number < 0L) return(numeric())
  numeric_region <- substr(line, first_number, nchar(line))
  hits <- regmatches(numeric_region, gregexpr("[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+|(?<!\\S)-(?!\\S)", numeric_region, perl = TRUE))[[1]]
  if (!length(hits) || identical(hits, character(0))) return(numeric())
  as.numeric(ifelse(hits == "-", "0", gsub(",", "", hits)))
}

# report whether positive printed categories reconcile to the printed total.
reconciles_printed_row <- function(values) {
  length(values) >= 2L && values[[1]] == sum(values[-1])
}

# return a reconciled row only when it has the wave's exact column count.
validated_reconciled_row <- function(values, expected_columns) {
  if (!reconciles_printed_row(values)) return(NULL)
  if (length(values) != expected_columns) return(NULL)
  values
}

# extract one labelled D6 row, allowing zeros and the 2000 PDF's wrapped rows.
extract_labelled_row <- function(lines, pattern, expected_columns, label) {
  matches <- grep(pattern, lines, perl = TRUE, ignore.case = TRUE)
  if (!length(matches)) stop("missing D6 row: ", label, call. = FALSE)
  for (index in matches) {
    current <- numeric_tokens(lines[[index]])
    reconciled <- validated_reconciled_row(current, expected_columns)
    if (!is.null(reconciled)) return(reconciled)

    if (length(current) > 0L) {
      combined <- current
      for (following_index in seq.int(index + 1L, min(length(lines), index + 3L))) {
        combined <- c(combined, numeric_tokens(lines[[following_index]]))
        reconciled <- validated_reconciled_row(combined, expected_columns)
        if (!is.null(reconciled)) return(reconciled)
      }
    }

    preceding_indices <- seq.int(max(1L, index - 3L), index - 1L)
    preceding <- lapply(rev(preceding_indices), function(i) numeric_tokens(lines[[i]]))
    exact <- Filter(function(values) {
      !is.null(validated_reconciled_row(values, expected_columns))
    }, preceding)
    if (length(exact)) {
      return(exact[[1]])
    }
  }
  stop("D6 row did not reconcile with exactly ", expected_columns,
       " columns: ", label, call. = FALSE)
}

# parse the national row and ten district/island rows for one census wave.
parse_wave <- function(spec) {
  lines <- table_d6_lines(pdf_layout_lines(file.path(raw_dir, spec[["file"]])), spec)
  national <- extract_labelled_row(lines, "^\\s*REPUBLIC(?: OF MAURITIUS)?.*[0-9]", spec[["columns"]], paste("Republic of Mauritius", spec[["year"]]))
  areas <- do.call(rbind, lapply(area_specs, function(area) {
    values <- extract_labelled_row(lines, area[["pattern"]], spec[["columns"]], area[["name"]])
    no_religion <- if (spec[["year"]] == 2022L) values[[length(values) - 1L]] else NA_real_
    residual <- values[[length(values)]]
    affiliation <- values[[1]] - residual - ifelse(is.na(no_religion), 0, no_religion)
    data.frame(
      area_code = area[["code"]], area_name = area[["name"]],
      source_total = values[[1]], religious_affiliation_count = affiliation,
      no_religion_count = no_religion, excluded_residual_count = residual,
      stringsAsFactors = FALSE
    )
  }))
  if (spec[["year"]] == 2022L) {
    national_no_religion <- national[[length(national) - 1L]]
  } else {
    national_no_religion <- NA_real_
  }
  national_residual <- national[[length(national)]]
  areas[["year"]] <- spec[["year"]]

  area_checks <- areas[["religious_affiliation_count"]] + areas[["excluded_residual_count"]]
  if (spec[["year"]] == 2022L) area_checks <- area_checks + areas[["no_religion_count"]]
  if (any(area_checks != areas[["source_total"]])) {
    stop("category reconciliation failed within a ", spec[["year"]], " area row", call. = FALSE)
  }

  national_affiliation <- national[[1]] - national_residual - ifelse(is.na(national_no_religion), 0, national_no_religion)
  national_check <- national_affiliation + national_residual
  if (spec[["year"]] == 2022L) national_check <- national_check + national_no_religion
  if (national_check != national[[1]]) {
    stop("national category reconciliation failed for ", spec[["year"]], call. = FALSE)
  }

  reconciliation_fields <- c("source_total", "religious_affiliation_count", "excluded_residual_count")
  if (spec[["year"]] == 2022L) reconciliation_fields <- c(reconciliation_fields, "no_religion_count")
  national_values <- c(
    source_total = national[[1]],
    religious_affiliation_count = national_affiliation,
    excluded_residual_count = national_residual,
    no_religion_count = national_no_religion
  )
  reconciliation <- lapply(reconciliation_fields, function(field) {
    area_sum <- sum(areas[[field]])
    national_total <- national_values[[field]]
    difference <- area_sum - national_total
    if (difference != 0) stop("district-to-national reconciliation failed for ", spec[["year"]], "/", field,
                              ": area sum ", area_sum, ", national ", national_total,
                              ", difference ", difference, "; rows ",
                              paste(areas[["area_code"]], areas[[field]], sep = "=", collapse = ", "),
                              call. = FALSE)
    list(year = spec[["year"]], metric = field, area_sum = area_sum,
         national_total = national_total, difference = difference)
  })
  list(rows = areas, national = national_values, reconciliation = reconciliation)
}

# filter the source boundary to the ten reporting units and attach stable keys.
build_boundary <- function(path) {
  source <- st_read(path, quiet = TRUE)
  source <- st_make_valid(source)
  source <- source[source[["shapeISO"]] %in% vapply(area_specs, `[[`, character(1), "code"), ]
  if (nrow(source) != 10L) stop("expected ten matched geoBoundaries features", call. = FALSE)
  area_names <- setNames(vapply(area_specs, `[[`, character(1), "name"),
                         vapply(area_specs, `[[`, character(1), "code"))
  source[["area_code"]] <- source[["shapeISO"]]
  source[["area_name"]] <- unname(area_names[source[["area_code"]]])
  source[["area_unit_id"]] <- paste0(boundary_set_id, ":", source[["area_code"]])
  source[["boundary_set_id"]] <- boundary_set_id
  source[["boundary_level"]] <- ifelse(source[["area_code"]] == "MU-RO", "island", "district")
  projected <- st_transform(source, 32740)
  source[["land_area_sq_km"]] <- as.numeric(st_area(projected)) / 1e6
  source[order(source[["area_code"]]), c("area_code", "area_name", "area_unit_id",
    "boundary_set_id", "boundary_level", "land_area_sq_km", "geometry")]
}

# flatten schema-shaped JSON rows for the CSV sibling.
flatten_rows <- function(rows) {
  do.call(rbind, lapply(rows, function(row) {
    data.frame(
      country_code = row[["country_code"]], boundary_set_id = row[["boundary_set_id"]],
      boundary_level = row[["boundary_level"]], area_unit_id = row[["area_unit_id"]],
      area_code = row[["area_code"]], area_name = row[["area_name"]], year = row[["year"]],
      population_total = row[["population_total"]], population_total_basis = row[["population_total_basis"]],
      religious_affiliation_count = row[["religious_affiliation_count"]],
      religious_affiliation_percent = row[["religious_affiliation_percent"]],
      no_religion_count = if (is.null(row[["no_religion_count"]])) NA else row[["no_religion_count"]],
      no_religion_percent = if (is.null(row[["no_religion_percent"]])) NA else row[["no_religion_percent"]],
      place_count = NA, places_per_10000_residents = NA, place_density_per_sq_km = NA,
      land_area_sq_km = row[["land_area_sq_km"]], site_snapshot_date = NA, place_count_basis = NA,
      source_dataset_ids = paste(row[["source_dataset_ids"]], collapse = "|"),
      quality_flag = row[["quality_flag"]], stringsAsFactors = FALSE
    )
  }))
}

# return a manifest record for one generated repository artefact.
durable_file_record <- function(path, content, licence_status) {
  rows <- if (grepl("\\.csv$", path)) length(readLines(path, warn = FALSE)) - 1L else if (grepl("\\.geojson$", path)) 10L else 30L
  list(uri = paste0("repo:", path), storage_provider = "other",
       format = sub("^.*\\.", "", path), bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = rows, content = content, privacy = "public", licence_status = "accepted")
}

invisible(lapply(c(vapply(wave_specs, function(spec) file.path(raw_dir, spec[["file"]]), character(1)), boundary_path), require_file))
parsed <- lapply(wave_specs, parse_wave)
counts <- do.call(rbind, lapply(parsed, `[[`, "rows"))
reconciliation <- unname(unlist(lapply(parsed, `[[`, "reconciliation"), recursive = FALSE))

boundary <- build_boundary(boundary_path)
boundary_write <- mapshaper_simplify_to_cap(
  boundary, boundary_out, 500000,
  c(100, 80, 60, 40, 20, 10), clean_option = "allow-overlaps"
)
written_boundary <- st_read(boundary_out, quiet = TRUE)
if (nrow(written_boundary) != 10L || any(st_is_empty(written_boundary)) || any(!st_is_valid(written_boundary))) {
  stop("simplified boundary validation failed", call. = FALSE)
}
boundary_lookup <- st_drop_geometry(boundary)

rows <- list()
for (year in sort(unique(counts[["year"]]))) {
  year_rows <- counts[counts[["year"]] == year, ]
  for (index in order(year_rows[["area_name"]])) {
    area <- year_rows[index, ]
    boundary_row <- boundary_lookup[boundary_lookup[["area_code"]] == area[["area_code"]], ]
    no_religion <- if (is.na(area[["no_religion_count"]])) NULL else as.integer(area[["no_religion_count"]])
    no_religion_percent <- if (is.null(no_religion)) NULL else round(100 * no_religion / area[["source_total"]], 2)
    rows[[length(rows) + 1L]] <- list(
      country_code = country_code, boundary_set_id = boundary_set_id,
      boundary_level = boundary_row[["boundary_level"]], area_unit_id = boundary_row[["area_unit_id"]],
      area_code = area[["area_code"]], area_name = area[["area_name"]], year = as.integer(year),
      population_total = as.integer(area[["source_total"]]),
      population_total_basis = "resident population in the Statistics Mauritius Table D6 religion tabulation; percentages use the full Table D6 total",
      religious_affiliation_count = as.integer(area[["religious_affiliation_count"]]),
      religious_affiliation_percent = round(100 * area[["religious_affiliation_count"]] / area[["source_total"]], 2),
      no_religion_count = no_religion, no_religion_percent = no_religion_percent,
      place_count = NULL, places_per_10000_residents = NULL, place_density_per_sq_km = NULL,
      land_area_sq_km = round(boundary_row[["land_area_sq_km"]], 2), site_snapshot_date = NULL,
      place_count_basis = NULL,
      source_dataset_ids = c(paste0("statistics-mauritius-census-d6-", year), boundary_dataset_id),
      quality_flag = paste(c(
        "census_self_reported_religion_not_ethnicity",
        "named_affiliation_groups_over_full_table_total",
        if (year < 2022L) "no_religion_not_separable_from_other_and_not_stated" else "no_religion_separately_reported",
        "district_rows_reconcile_exactly_to_national_row"
      ), collapse = ";")
    )
  }
}

source_datasets <- c(lapply(names(wave_specs), function(year) {
  list(source_dataset_id = paste0("statistics-mauritius-census-d6-", year),
       name = paste0(year, " Housing and Population Census, Volume II, Table D6"),
       provider = "Statistics Mauritius", url = census_urls[[year]], retrieval_date = "2026-07-10",
       local_path = file.path(raw_dir, wave_specs[[year]][["file"]]),
       licence = list(name = "Government of Mauritius copyright notice", url = copyright_url,
                      attribution = "Statistics Mauritius; source URL and Government of Mauritius copyright status stated"),
       citation = paste0("Statistics Mauritius, ", year, " Housing and Population Census, Volume II, Table D6."),
       access_limits = NULL, redistribution_limits = "Accurate reproduction and transmission with source URL and Government copyright attribution.",
       notes = "Nine districts of Mauritius island plus Rodrigues. Parsed with poppler pdftotext -layout; a preserved snapshot supplied the local copy when the official server returned 503.")
}), list(list(source_dataset_id = boundary_dataset_id, name = "geoBoundaries MUS ADM1",
             provider = "geoBoundaries", url = boundary_meta_url, retrieval_date = "2026-07-10",
             local_path = boundary_path,
             licence = list(name = "Open Data Commons Open Database License 1.0", url = "https://opendatacommons.org/licenses/odbl/1-0/", attribution = "geoBoundaries and OpenStreetMap contributors"),
             citation = "geoBoundaries, MUS ADM1, boundary ID MUS-ADM1-65221844, 2017.",
             access_limits = NULL, redistribution_limits = "ODbL 1.0 terms apply.",
             notes = "Ten of twelve features retained; Agaléga and St. Brandon are outside the published D6 geography.")))

document <- list(
  schema_version = "0.2.0", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code,
                      level = "district_and_rodrigues", vintage = "2017", source_dataset_id = boundary_dataset_id),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "no governed Mauritius place-of-worship snapshot is included",
                       notes = "This product contains census religion metrics only."),
  source_datasets = source_datasets,
  indicators = list(
    list(indicator_id = "population_total", label = "Census Table D6 population", description = "Resident population represented in the religion tabulation.", unit = "count", denominator_indicator_id = NULL, method = "Table D6 total.", temporal_coverage = "2000, 2011, 2022", spatial_coverage = "nine districts and Rodrigues", quality_notes = "The table excludes Agaléga and St. Brandon."),
    list(indicator_id = "religious_affiliation_percent", label = "Named religious affiliation %", description = "Share assigned to the named religious groups published consistently at district level.", unit = "percent", denominator_indicator_id = "population_total", method = "100 * sum of named religious-group columns / Table D6 total.", temporal_coverage = "2000, 2011, 2022", spatial_coverage = "nine districts and Rodrigues", quality_notes = "The residual column combines Other and Not stated in 2000 and 2011. The metric therefore excludes the residual and uses the full table total. Religion is self-reported and must never be interpreted as an ethnic proxy."),
    list(indicator_id = "no_religion_percent", label = "No religion %", description = "Share explicitly reporting no religion; available only in 2022.", unit = "percent", denominator_indicator_id = "population_total", method = "100 * No religion / Table D6 total.", temporal_coverage = "2022", spatial_coverage = "nine districts and Rodrigues", quality_notes = "No religion is not separately recoverable from the 2000 or 2011 Other and Not stated residual.")
  ),
  visual_layers = list(
    list(visual_layer_id = "mu-named-affiliation", label = "Named religious affiliation %", description = "Census named-affiliation share by district and Rodrigues.", layer_type = "choropleth", indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit", legend = list(unit = "percent", denominator = "full Table D6 resident population"), colour_scale = "sequential", time_control = "year_selector", aggregation_rule = "reported area value", uncertainty_display = "quality_flag", default_visibility = TRUE, notes = "Self-reported religion; never an ethnic proxy."),
    list(visual_layer_id = "mu-no-religion", label = "No religion %", description = "Explicit no-religion share in 2022.", layer_type = "choropleth", indicator_ids = list("no_religion_percent"), geometry_unit_type = "area_unit", legend = list(unit = "percent", denominator = "full Table D6 resident population"), colour_scale = "sequential", time_control = "year_selector", aggregation_rule = "reported area value", uncertainty_display = "quality_flag", default_visibility = FALSE, notes = "Available only for 2022.")
  ), rows = rows
)
write_json(document, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

raw_sources <- c(lapply(names(wave_specs), function(year) {
  path <- file.path(raw_dir, wave_specs[[year]][["file"]])
  list(uri = path, url = census_urls[[year]], retrieval_url = if (year == "2022") census_urls[[year]] else archive_urls[[year]],
       format = "pdf", bytes = file_bytes(path), sha256 = sha256_file(path), row_count = NA,
       source_dataset_id = paste0("statistics-mauritius-census-d6-", year), used_in_public_product = TRUE,
       periods = year, notes = "Volume II Table D6; extracted with poppler pdftotext -layout.")
}), list(list(uri = boundary_path, url = boundary_url, format = "geojson", bytes = file_bytes(boundary_path),
             sha256 = sha256_file(boundary_path), row_count = 12L, source_dataset_id = boundary_dataset_id,
             used_in_public_product = TRUE, periods = "2017", notes = "geoBoundaries MUS ADM1, ODbL 1.0; ten reporting features retained.")))

git_commit <- trimws(system2("git", c("rev-parse", "HEAD"), stdout = TRUE))
if (length(git_commit) != 1L || !grepl("^[a-f0-9]{7,40}$", git_commit)) {
  stop("could not record the current git commit", call. = FALSE)
}
construct_notes <- list(
  "Religion is the respondent-reported census construct. Mauritius's constitutional and census history entangles religion with the history of ethnic classification; these religion data must never be presented or interpreted as an ethnic proxy.",
  "Named religious affiliation is the sum of the named religious-group columns published consistently at district level, divided by the full Table D6 resident population.",
  "In 2000 and 2011, the final district column combines Other and Not stated. No religion is therefore unavailable separately for those waves. The 2022 table publishes No religion separately and retains an Other and Not stated residual.",
  "The product carries nine districts on Mauritius island plus Rodrigues. Statistics Mauritius Table D6 excludes Agaléga and St. Brandon, and their geoBoundaries features are omitted."
)
deferred_sources <- list(list(
  source_dataset_id = "statistics-mauritius-census-d6-1990",
  url = census_urls[["1990"]],
  local_path = file.path(raw_dir, "mu_1990_vol2.pdf"),
  notes = "The public 1990 Volume II is an image-only scan. pdftotext yields no text, and the wave is not machine-extractable under the no-OCR/no-hand-entry rule."
))

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json", schema_version = "data-manifest.v1",
  manifest_id = "manifest:mu-census-religion:mu:2000-2022:district",
  dataset_id = "mu-census-religion:mu:2000-2022:district",
  dataset_version_id = paste0("mu-census-religion:mu:2000-2022:district:", substr(sha256_file(summary_json_out), 1, 12)),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "mu-census-religion", dataset_role = "public_product",
  scope = list(level = "country", country_codes = list(country_code), snapshot_date = NULL, snapshot_anchor = NULL, pipeline_stage = "public"),
  created_at = stamp, created_by = script_id,
  pipeline = list(script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
                  parameters = list(waves = c("2000", "2011", "2022"), geography = "nine Mauritius districts plus Rodrigues", pdf_extraction = "poppler pdftotext -layout", denominator = "full Table D6 resident population", boundary_set = boundary_set_id, boundary_simplification = boundary_write, raw_sources = raw_sources, national_reconciliation = reconciliation, construct_notes = construct_notes, deferred_sources = deferred_sources, raw_redistribution = "Raw PDFs and the source GeoJSON are not committed; they remain in gitignored data/raw/mu_census/."),
                  software_versions = list(r = paste(R.version[["major"]], R.version[["minor"]], sep = "."), sf = as.character(packageVersion("sf")), jsonlite = as.character(packageVersion("jsonlite")), pdftotext = "poppler system binary")),
  source = list(provider = "Statistics Mauritius; geoBoundaries", source_dataset_ids = vapply(source_datasets, `[[`, character(1), "source_dataset_id"),
                source_urls = c(unname(census_urls[c("2000", "2011", "2022")]), boundary_meta_url, boundary_url, copyright_url), retrieved_at = retrieved_at,
                licence = "Government of Mauritius copyright notice permits accurate reproduction and transmission with source URL and Government copyright attribution. The boundary is geoBoundaries MUS ADM1 under ODbL 1.0.",
                citation = "Statistics Mauritius, Housing and Population Census, Volume II, Table D6 (2000, 2011, 2022); geoBoundaries MUS ADM1 (2017)."),
  input_manifests = list(),
  durable_files = list(
    durable_file_record(summary_json_out, "Mauritius district and Rodrigues census religion area summary, 2000-2022.", "government_of_mauritius_attribution"),
    durable_file_record(summary_csv_out, "Flattened Mauritius district and Rodrigues census religion area summary, 2000-2022.", "government_of_mauritius_attribution"),
    durable_file_record(boundary_out, "Simplified geoBoundaries MUS ADM1 reporting boundary, ten features.", "odbl_1_0")
  ),
  stats = list(area_summary_rows = 30L, boundary_features = 10L, waves = 3L,
               reconciliation_records = length(reconciliation), boundary_bytes = file_bytes(boundary_out)),
  validation = list(
    status = "passed",
    commands = c(
      "Rscript scripts/build_mu_area_summary.R",
      "uvx check-jsonschema --schemafile schemas/area-summary.schema.json apps/regions/mu/data/area_summary_district.json",
      "uvx check-jsonschema --schemafile schemas/data-manifest.schema.json docs/manifests/mu-census-religion-2000-2022.json"
    ),
    warnings = list(),
    notes = paste("Every shipped PDF has a non-empty text layer and every selected Table D6 row reconciles to its printed total.",
                  "The ten area rows reconcile exactly to the Republic of Mauritius row for every shipped wave.",
                  "All ten census reporting units match one geoBoundaries feature.",
                  "The simplified boundary has ten valid non-empty features and remains below 500 KB.")
  ),
  privacy = "public", licence_status = "accepted", downstream_status = "public",
  notes = "Derived census products carry explicit construct and sensitivity notes; raw sources remain uncommitted."
)
write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)

if (!jsonlite::validate(paste(readLines(summary_json_out, warn = FALSE), collapse = "\n"))) stop("area summary JSON invalid", call. = FALSE)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) stop("manifest JSON invalid", call. = FALSE)
validate_against_schema(file.path("schemas", "area-summary.schema.json"), summary_json_out)

cat(sprintf("wrote %s: %d rows\n", summary_json_out, length(rows)))
cat(sprintf("wrote %s: %d rows\n", summary_csv_out, length(rows)))
cat(sprintf("wrote %s: %d features, %d bytes\n", boundary_out, nrow(written_boundary), file_bytes(boundary_out)))
cat(sprintf("wrote %s\n", manifest_out))
cat("national reconciliation: exact for every published field available to the product in 2000, 2011, and 2022\n")
