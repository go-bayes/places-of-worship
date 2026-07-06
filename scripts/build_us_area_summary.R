# build the us county area-summary product from arda churches and church
# membership / u.s. religion census county files.
# inputs: data/raw/us_rcms/ county and state validation workbooks, the 2020
# county boundary geojson, and apps/regions/us/data/source/fips_crosswalk_to_2020.csv.
# outputs: apps/regions/us/data/area_summary_county.{json,csv}, tracked source
# extracts, and docs/manifests/us-rcms-county-1952-2020.json.
# run from the repo root: Rscript scripts/build_us_area_summary.R

suppressMessages({
  library(readxl)
  library(jsonlite)
})

us_dir <- "apps/regions/us/data"
src_dir <- file.path(us_dir, "source")
raw_dir <- "data/raw/us_rcms"
manifest_dir <- "docs/manifests"
dir.create(src_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- "2026-07-06"
boundary_dataset_id <- "census-bureau-cb-county-2020"
crosswalk_dataset_id <- "us-fips-crosswalk-to-2020"
crosswalk_path <- file.path(src_dir, "fips_crosswalk_to_2020.csv")

crosswalk <- read.csv(crosswalk_path, stringsAsFactors = FALSE, colClasses = "character")
crosswalk[["start_year"]] <- as.integer(crosswalk[["start_year"]])
crosswalk[["end_year"]] <- as.integer(crosswalk[["end_year"]])
crosswalk[["old_fips"]] <- sprintf("%05d", as.integer(crosswalk[["old_fips"]]))
crosswalk[["new_fips"]] <- sprintf("%05d", as.integer(crosswalk[["new_fips"]]))

geojson <- fromJSON(file.path(us_dir, "counties_2020.geojson"), simplifyVector = FALSE)
features <- geojson[["features"]]

# return a geojson property with a stable missing value.
geo_prop <- function(feature, key, missing = NA_character_) {
  value <- feature[["properties"]][[key]]
  if (is.null(value)) missing else value
}

geoids <- vapply(features, geo_prop, character(1), key = "GEOID")
name20 <- data.frame(
  fips = geoids,
  name = vapply(features, geo_prop, character(1), key = "NAME"),
  state = vapply(features, geo_prop, character(1), key = "STUSPS"),
  state_name = vapply(features, geo_prop, character(1), key = "STATE_NAME"),
  land_area_sq_km = vapply(features, function(feature) {
    area <- feature[["properties"]][["ALAND"]]
    if (is.null(area)) NA_real_ else as.numeric(area) / 1e6
  }, numeric(1)),
  stringsAsFactors = FALSE
)
name20[["state_fips"]] <- substr(name20[["fips"]], 1, 2)
state_lookup <- unique(name20[c("state_fips", "state", "state_name")])
state_lookup[["state_name_upper"]] <- toupper(state_lookup[["state_name"]])

# sum a numeric vector while preserving all-missing groups as missing.
sum_or_na <- function(values) {
  if (all(is.na(values))) NA_real_ else sum(values, na.rm = TRUE)
}

# convert a state/county pair to a five-digit county fips string.
make_fips <- function(state_values, county_values) {
  paste0(sprintf("%02d", as.integer(state_values)), sprintf("%03d", as.integer(county_values)))
}

# coerce a raw numeric column without allowing factor conversions.
numeric_col <- function(raw, column_name) {
  as.numeric(raw[[column_name]])
}

# produce a compact comma-separated label for manifest lists.
collapse_values <- function(values) {
  values <- sort(unique(values[!is.na(values) & nzchar(values)]))
  if (!length(values)) "" else paste(values, collapse = ", ")
}

# parse one arda county workbook into the common source row shape.
read_county_wave <- function(spec) {
  raw <- read_excel(file.path(raw_dir, spec[["filename"]]), sheet = spec[["sheet"]])
  if (nrow(raw) != spec[["expected_rows"]]) {
    stop(sprintf("%s expected %d rows, found %d", spec[["filename"]], spec[["expected_rows"]], nrow(raw)))
  }

  if (is.null(spec[["fips_col"]])) {
    original_fips <- make_fips(raw[[spec[["state_col"]]]], raw[[spec[["county_col"]]]])
  } else {
    original_fips <- sprintf("%05d", as.integer(raw[[spec[["fips_col"]]]]))
  }

  if (is.null(spec[["state_col"]])) {
    source_state_fips <- substr(original_fips, 1, 2)
  } else {
    source_state_fips <- sprintf("%02d", as.integer(raw[[spec[["state_col"]]]]))
  }

  source_county_name <- as.character(raw[[spec[["name_col"]]]])
  if (!is.null(spec[["name_has_state_suffix"]]) && spec[["name_has_state_suffix"]]) {
    source_state <- trimws(sub("^.*,\\s*", "", source_county_name))
    source_county_name <- trimws(sub(",\\s*[A-Z]{2}$", "", source_county_name))
  } else if (!is.null(spec[["state_abbr_col"]])) {
    source_state <- as.character(raw[[spec[["state_abbr_col"]]]])
  } else {
    state_match <- match(source_state_fips, state_lookup[["state_fips"]])
    source_state <- state_lookup[["state"]][state_match]
  }

  data.frame(
    year = spec[["year"]],
    source_dataset_id = spec[["source_id"]],
    original_fips = original_fips,
    source_state_fips = source_state_fips,
    source_state = source_state,
    source_county_name = source_county_name,
    cng = numeric_col(raw, spec[["cng_col"]]),
    adh = numeric_col(raw, spec[["adh_col"]]),
    pop = numeric_col(raw, spec[["pop_col"]]),
    stringsAsFactors = FALSE
  )
}

# apply the year-appropriate fips crosswalk before the 2020-boundary join.
apply_crosswalk <- function(source_rows, year) {
  active <- crosswalk[crosswalk[["start_year"]] <= year & year <= crosswalk[["end_year"]], ]
  match_index <- match(source_rows[["original_fips"]], active[["old_fips"]])
  remap <- !is.na(match_index)
  mapped_rows <- source_rows
  mapped_rows[["mapped_fips"]] <- source_rows[["original_fips"]]
  mapped_rows[["crosswalked"]] <- remap
  mapped_rows[["crosswalk_note"]] <- ""
  mapped_rows[["crosswalk_old_name"]] <- ""
  mapped_rows[["crosswalk_new_name"]] <- ""

  if (any(remap)) {
    mapped_rows[["mapped_fips"]][remap] <- active[["new_fips"]][match_index[remap]]
    mapped_rows[["crosswalk_note"]][remap] <- active[["note"]][match_index[remap]]
    mapped_rows[["crosswalk_old_name"]][remap] <- active[["old_name"]][match_index[remap]]
    mapped_rows[["crosswalk_new_name"]][remap] <- active[["new_name"]][match_index[remap]]
  }

  mapped_rows
}

# aggregate source rows that crosswalk onto the same 2020 county.
aggregate_mapped_rows <- function(mapped_rows) {
  groups <- split(seq_len(nrow(mapped_rows)), mapped_rows[["mapped_fips"]])
  pieces <- lapply(names(groups), function(fips) {
    index <- groups[[fips]]
    data.frame(
      fips = fips,
      source_rows = length(index),
      original_fips = collapse_values(mapped_rows[["original_fips"]][index]),
      source_state_fips = collapse_values(mapped_rows[["source_state_fips"]][index]),
      cng = sum_or_na(mapped_rows[["cng"]][index]),
      adh = sum_or_na(mapped_rows[["adh"]][index]),
      pop = sum_or_na(mapped_rows[["pop"]][index]),
      crosswalked = any(mapped_rows[["crosswalked"]][index]),
      crosswalk_note = collapse_values(mapped_rows[["crosswalk_note"]][index]),
      stringsAsFactors = FALSE
    )
  })
  out <- do.call(rbind, pieces)
  out[order(out[["fips"]]), ]
}

# build the exact row contract consumed by the shared region map.
build_area_rows <- function(agg, year, source_id, study_name) {
  lapply(seq_len(nrow(agg)), function(index) {
    row <- agg[index, ]
    name_index <- match(row[["fips"]], name20[["fips"]])
    pop <- row[["pop"]]
    adh <- row[["adh"]]
    pct <- if (is.finite(pop) && pop > 0 && is.finite(adh)) round(100 * adh / pop, 2) else NA_real_
    land_area <- name20[["land_area_sq_km"]][name_index]
    flags <- character(0)
    if (year < 2010) flags <- c(flags, "wave_coverage_differs")
    if (row[["crosswalked"]]) flags <- c(flags, "boundary_change_crosswalked")
    source_ids <- c(source_id, boundary_dataset_id, crosswalk_dataset_id)

    list(
      country_code = "US",
      boundary_set_id = "us-county-2020",
      boundary_level = "county",
      area_unit_id = paste0("us-county-2020:", row[["fips"]]),
      area_code = row[["fips"]],
      area_name = paste0(name20[["name"]][name_index], ", ", name20[["state"]][name_index]),
      year = year,
      population_total = if (is.finite(pop)) pop else NULL,
      population_total_basis = paste0("county population as reported by the ", study_name, " ", year),
      religious_affiliation_count = if (is.finite(adh)) adh else NULL,
      religious_affiliation_percent = if (is.finite(pct)) pct else NULL,
      no_religion_count = NULL,
      no_religion_percent = NULL,
      place_count = NULL,
      places_per_10000_residents = NULL,
      place_density_per_sq_km = NULL,
      land_area_sq_km = if (is.finite(land_area)) round(land_area, 2) else NULL,
      site_snapshot_date = NULL,
      place_count_basis = NULL,
      quality_flag = paste(flags, collapse = ";"),
      source_dataset_ids = source_ids
    )
  })
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
      population_total = if (is.null(row[["population_total"]])) NA else row[["population_total"]],
      population_total_basis = row[["population_total_basis"]],
      religious_affiliation_count = if (is.null(row[["religious_affiliation_count"]])) NA else row[["religious_affiliation_count"]],
      religious_affiliation_percent = if (is.null(row[["religious_affiliation_percent"]])) NA else row[["religious_affiliation_percent"]],
      no_religion_count = NA,
      no_religion_percent = NA,
      place_count = NA,
      places_per_10000_residents = NA,
      place_density_per_sq_km = NA,
      land_area_sq_km = if (is.null(row[["land_area_sq_km"]])) NA else row[["land_area_sq_km"]],
      site_snapshot_date = NA,
      place_count_basis = NA,
      source_dataset_ids = paste(row[["source_dataset_ids"]], collapse = "|"),
      quality_flag = row[["quality_flag"]],
      stringsAsFactors = FALSE
    )
  }))
}

# read one arda state workbook used only as validation evidence.
read_state_validation <- function(spec) {
  raw <- read_excel(file.path(raw_dir, spec[["filename"]]), sheet = spec[["sheet"]])
  if (nrow(raw) != spec[["expected_rows"]]) {
    stop(sprintf("%s expected %d rows, found %d", spec[["filename"]], spec[["expected_rows"]], nrow(raw)))
  }

  if (!is.null(spec[["state_col"]])) {
    state_fips <- sprintf("%02d", as.integer(raw[[spec[["state_col"]]]]))
  } else {
    state_names <- toupper(as.character(raw[[spec[["state_name_col"]]]]))
    state_fips <- state_lookup[["state_fips"]][match(state_names, state_lookup[["state_name_upper"]])]
  }

  out <- data.frame(
    state_fips = state_fips,
    state_name = if (!is.null(spec[["state_name_col"]])) as.character(raw[[spec[["state_name_col"]]]]) else NA_character_,
    cng = numeric_col(raw, spec[["cng_col"]]),
    adh = numeric_col(raw, spec[["adh_col"]]),
    pop = numeric_col(raw, spec[["pop_col"]]),
    stringsAsFactors = FALSE
  )

  if (!is.null(spec[["exclude_state_fips"]])) {
    out <- out[!(out[["state_fips"]] %in% spec[["exclude_state_fips"]]), ]
  }

  out
}

# sum county source rows to state totals before any county crosswalk.
aggregate_source_states <- function(source_rows) {
  groups <- split(seq_len(nrow(source_rows)), source_rows[["source_state_fips"]])
  pieces <- lapply(names(groups), function(state_fips) {
    index <- groups[[state_fips]]
    data.frame(
      state_fips = state_fips,
      cng = sum_or_na(source_rows[["cng"]][index]),
      adh = sum_or_na(source_rows[["adh"]][index]),
      pop = sum_or_na(source_rows[["pop"]][index]),
      source_county_rows = length(index),
      stringsAsFactors = FALSE
    )
  })
  out <- do.call(rbind, pieces)
  out[order(out[["state_fips"]]), ]
}

# compare county-summed states with arda's state-level publication.
validate_against_states <- function(source_rows, state_rows, state_source_id) {
  county_states <- aggregate_source_states(source_rows)
  matched <- sort(intersect(county_states[["state_fips"]], state_rows[["state_fips"]]))
  county_match <- county_states[match(matched, county_states[["state_fips"]]), ]
  state_match <- state_rows[match(matched, state_rows[["state_fips"]]), ]
  cng_diff <- county_match[["cng"]] - state_match[["cng"]]
  adh_diff <- county_match[["adh"]] - state_match[["adh"]]
  pop_diff <- county_match[["pop"]] - state_match[["pop"]]
  mismatch <- abs(cng_diff) > 1e-9 | abs(adh_diff) > 1e-9 | abs(pop_diff) > 1e-9
  state_name_match <- state_lookup[["state_name"]][match(matched, state_lookup[["state_fips"]])]

  mismatch_states <- lapply(which(mismatch), function(index) {
    list(
      state_fips = matched[[index]],
      state_name = state_name_match[[index]],
      cng_diff = cng_diff[[index]],
      adh_diff = adh_diff[[index]],
      pop_diff = pop_diff[[index]]
    )
  })

  missing_in_state_file <- sort(setdiff(county_states[["state_fips"]], state_rows[["state_fips"]]))
  extra_in_state_file <- sort(setdiff(state_rows[["state_fips"]], county_states[["state_fips"]]))
  result <- if (!length(mismatch_states) && !length(missing_in_state_file) && !length(extra_in_state_file)) {
    "exact"
  } else if (!length(mismatch_states)) {
    "matched_states_exact_with_state_file_coverage_difference"
  } else {
    "mismatch_against_state_file"
  }

  list(
    state_source_dataset_id = state_source_id,
    result = result,
    matched_state_count = length(matched),
    county_state_count = nrow(county_states),
    validation_state_count = nrow(state_rows),
    missing_in_state_file = missing_in_state_file,
    extra_in_state_file = extra_in_state_file,
    county_sums_matched_states = list(
      congregations = sum_or_na(county_match[["cng"]]),
      adherents = sum_or_na(county_match[["adh"]]),
      population = sum_or_na(county_match[["pop"]])
    ),
    state_sums_matched_states = list(
      congregations = sum_or_na(state_match[["cng"]]),
      adherents = sum_or_na(state_match[["adh"]]),
      population = sum_or_na(state_match[["pop"]])
    ),
    differences_matched_states = list(
      congregations = sum_or_na(cng_diff),
      adherents = sum_or_na(adh_diff),
      population = sum_or_na(pop_diff)
    ),
    mismatch_state_count = length(mismatch_states),
    mismatch_states = mismatch_states
  )
}

# build source-dataset metadata for county rows and validation files.
make_arda_source <- function(spec, role) {
  list(
    source_dataset_id = spec[["source_id"]],
    name = spec[["display_name"]],
    provider = spec[["provider"]],
    url = paste0("https://www.thearda.com/data-archive?fid=", spec[["fid"]]),
    retrieval_date = retrieval_date,
    local_path = file.path(raw_dir, spec[["filename"]]),
    codebook_local_path = file.path(raw_dir, spec[["codebook_filename"]]),
    role = role,
    licence = list(
      name = "no formal EULA; ARDA click-through research-use terms",
      url = paste0("https://www.thearda.com/data-archive?fid=", spec[["fid"]], "&tab=3"),
      attribution = paste0("Association of Religion Data Archives (ARDA) and ", spec[["original_study"]])
    ),
    citation = spec[["citation"]],
    access_limits = "None found: file hosted on OSF, downloadable without account/login. ARDA shows an in-page acknowledgement of citation/responsible-use/as-is/Indiana-law terms before revealing the download links.",
    redistribution_limits = "No explicit restriction on derived or aggregated products found; attribute ARDA and the original study.",
    notes = spec[["notes"]]
  )
}

# compute a tracked file record for the docs manifest.
durable_file <- function(path, row_count = NULL, content = "") {
  info <- file.info(path)
  list(
    uri = paste0("repo:", path),
    storage_provider = "other",
    format = tools::file_ext(path),
    bytes = as.integer(info[["size"]]),
    sha256 = unname(tools::sha256sum(path)),
    row_count = row_count,
    content = content,
    privacy = "public",
    licence_status = "accepted"
  )
}

county_specs <- list(
  list(
    year = 1952, fid = "CMS52CNT", source_id = "cms-1952-county-file",
    filename = "CMS52CNT_county.xls", codebook_filename = "CMS52CNT_codebook.txt",
    sheet = "CMS52CNT_data1", expected_rows = 3075,
    fips_col = NULL, state_col = "STCODE", county_col = "CCODE",
    name_col = "CNAME", name_has_state_suffix = TRUE, state_abbr_col = NULL,
    cng_col = "TOTCHUR", adh_col = "TOTMEMB", pop_col = "TOTPOP",
    study_name = "Churches and Church Membership in the United States",
    display_name = "Churches and Church Membership in the United States, 1952 (Counties)",
    provider = "Association of Religion Data Archives (ARDA); original study by the National Council of Churches",
    original_study = "Churches and Church Membership in the United States, 1952",
    citation = "(1956). Churches and Church Membership in the United States: An Enumeration and Analysis by Counties, States and Regions. National Council of Churches: New York.",
    notes = "County file carries CNAME, STCODE, CCODE, TOTCHUR, TOTMEMB, and TOTPOP. Coverage is continental United States plus District of Columbia; Alaska and Hawaii are absent. The file includes a 'Negro Missions' estimate rather than systematic historically Black denomination coverage."
  ),
  list(
    year = 1971, fid = "CMS71CNT", source_id = "cms-1971-county-file",
    filename = "CMS71CNT_county.xls", codebook_filename = "CMS71CNT_codebook.txt",
    sheet = "CMS71CNT_data1", expected_rows = 3141,
    fips_col = "FIPS", state_col = "STATE", county_col = "COUNTY",
    name_col = "NAME", name_has_state_suffix = TRUE, state_abbr_col = NULL,
    cng_col = "CHTOTAL", adh_col = "TOTADH", pop_col = "TOTPOP",
    study_name = "Churches and Church Membership in the United States",
    display_name = "Churches and Church Membership in the United States, 1971 (Counties)",
    provider = "Association of Religion Data Archives (ARDA); original study by Johnson, Picard, and Quinn for Glenmary Research Center",
    original_study = "Churches and Church Membership in the United States, 1971",
    citation = "Johnson, D. W., Picard, P., & Quinn, B. (1974). Churches and Church Membership in the United States. Glenmary Research Center: Washington, D.C.",
    notes = "County file carries NAME, STATE, COUNTY, FIPS, CHTOTAL, TOTMEM, TOTADH, and TOTPOP. ARDA summary states the 53 included denominations represented an estimated 81 percent of church membership in the United States."
  ),
  list(
    year = 1980, fid = "CMS80CNT", source_id = "cms-1980-county-file",
    filename = "CMS80CNT_county.xlsx", codebook_filename = "CMS80CNT_codebook.txt",
    sheet = "Data", expected_rows = 3141,
    fips_col = "FIPS", state_col = "STATE", county_col = "COUNTY",
    name_col = "NAME", name_has_state_suffix = TRUE, state_abbr_col = NULL,
    cng_col = "NOCTOT80", adh_col = "ADHTOT80", pop_col = "TOTPOP",
    study_name = "Churches and Church Membership in the United States",
    display_name = "Churches and Church Membership in the United States, 1980 (Counties)",
    provider = "Association of Religion Data Archives (ARDA); original study by Glenmary Research Center",
    original_study = "Churches and Church Membership in the United States, 1980",
    citation = "Churches and Church Membership in the United States, 1980. Glenmary Research Center.",
    notes = "County file carries NAME, STATE, COUNTY, FIPS, NOCTOT80, MEMTOT80, ADHTOT80, and TOTPOP. ARDA summary reports four Black denominations participated and four other large Black churches did not."
  ),
  list(
    year = 1990, fid = "CMS90CNT", source_id = "cms-1990-county-file",
    filename = "CMS90CNT_county.xlsx", codebook_filename = "CMS90CNT_codebook.txt",
    sheet = "Data", expected_rows = 3141,
    fips_col = "FIPS", state_col = "STATE", county_col = "COUNTY",
    name_col = "NAME", name_has_state_suffix = TRUE, state_abbr_col = NULL,
    cng_col = "CHTOTAL", adh_col = "TOTADH", pop_col = "TOTPOP",
    study_name = "Churches and Church Membership in the United States",
    display_name = "Churches and Church Membership in the United States, 1990 (Counties)",
    provider = "Association of Religion Data Archives (ARDA); original study by the Association of Statisticians of American Religious Bodies",
    original_study = "Churches and Church Membership in the United States, 1990",
    citation = "Churches and Church Membership in the United States, 1990. Association of Statisticians of American Religious Bodies.",
    notes = "County file carries NAME, STATE, COUNTY, FIPS, CHTOTAL, TOTMEM, TOTADH, and TOTPOP. ARDA summary reports three predominantly Black denominations participated; other Black denominations remained undercovered."
  ),
  list(
    year = 2000, fid = "RCMSCY", source_id = "usrc-2000-county-file",
    filename = "RCMSCY_county.xlsx", codebook_filename = "RCMSCY_codebook.txt",
    sheet = "Data", expected_rows = 3142,
    fips_col = "FIP", state_col = "STCOD", county_col = "CTYCOD",
    name_col = "COUNTY", name_has_state_suffix = FALSE, state_abbr_col = "STATEAB",
    cng_col = "TOTCG", adh_col = "TOTAD", pop_col = "POP200",
    study_name = "U.S. Religion Census - Religious Congregations and Membership Study",
    display_name = "U.S. Religion Census - Religious Congregations and Membership Study, 2000 (County File)",
    provider = "Association of Religion Data Archives (ARDA); original study by the Association of Statisticians of American Religious Bodies",
    original_study = "U.S. Religion Census Religious Congregations and Membership Study, 2000",
    citation = "U.S. Religion Census: Religious Congregations and Membership Study, 2000 (County File). Association of Statisticians of American Religious Bodies.",
    notes = "County file carries TOTCG, TOTAD, POP200, FIP, STCOD, CTYCOD, STATE, COUNTY, and STATEAB. ARDA summary states all historically African-American denominations were absent from this wave."
  ),
  list(
    year = 2010, fid = "RCMSCY10", source_id = "usrc-2010-county-file",
    filename = "RCMSCY10_county.xlsx", codebook_filename = "RCMSCY10_codebook.txt",
    sheet = "Data", expected_rows = 3149,
    fips_col = "FIPS", state_col = "STCODE", county_col = "CNTYCODE",
    name_col = "CNTYNAME", name_has_state_suffix = FALSE, state_abbr_col = "STABBR",
    cng_col = "TOTCNG", adh_col = "TOTADH", pop_col = "POP2010",
    study_name = "U.S. Religion Census - Religious Congregations and Membership Study",
    display_name = "U.S. Religion Census - Religious Congregations and Membership Study, 2010 (County File)",
    provider = "Association of Religion Data Archives (ARDA); data collected by Grammich, Hadaway, Houseal, Jones, Krindatch, Stanley, and Taylor for ASARB",
    original_study = "U.S. Religion Census Religious Congregations and Membership Study, 2010",
    citation = "Grammich, C., Hadaway, K., Houseal, R., Jones, D. E., Krindatch, A., Stanley, R., & Taylor, R. H. (2018). U.S. Religion Census Religious Congregations and Membership Study, 2010 (County File).",
    notes = "County file carries FIPS, STCODE, STABBR, STNAME, CNTYCODE, CNTYNAME, POP2010, TOTCNG, and TOTADH. Some county FIPS values require crosswalks to the 2020 boundary set."
  ),
  list(
    year = 2020, fid = "RCMSCY20", source_id = "usrc-2020-county-file",
    filename = "RCMSCY20_county.xlsx", codebook_filename = "RCMSCY20_codebook.txt",
    sheet = "Data", expected_rows = 3143,
    fips_col = "FIPS", state_col = "STCOD", county_col = "CTYCOD",
    name_col = "COUNAM", name_has_state_suffix = FALSE, state_abbr_col = "STABBREV",
    cng_col = "TOTCNG_2020", adh_col = "TOTADH_2020", pop_col = "POP2020",
    study_name = "U.S. Religion Census - Religious Congregations and Membership Study",
    display_name = "U.S. Religion Census - Religious Congregations and Membership Study, 2020 (County File)",
    provider = "Association of Religion Data Archives (ARDA); data collected by Grammich, Hadaway, Houseal, Jones, Krindatch, Stanley, and Thumma",
    original_study = "U.S. Religion Census Religious Congregations and Membership Study, 2020",
    citation = "U.S. Religion Census: Religious Congregations and Membership Study, 2020 (County File). Association of Statisticians of American Religious Bodies.",
    notes = "County file carries FIPS, COUNAM, STABBREV, STATNAM, POP2020, TOTCNG_2020, and TOTADH_2020. It joins directly to all 2020 county boundaries."
  )
)

state_validation_specs <- list(
  list(
    year = 1952, fid = "CMS52ST", source_id = "cms-1952-state-file",
    filename = "CMS52ST_state.xls", codebook_filename = "CMS52ST_codebook.txt",
    sheet = "CMS52ST_data1", expected_rows = 49, state_col = "STCODE", state_name_col = NULL,
    cng_col = "TOTCHUR", adh_col = "TOTMEMB", pop_col = "TOTPOP",
    display_name = "Churches and Church Membership in the United States, 1952 (States)",
    provider = "Association of Religion Data Archives (ARDA); original study by the National Council of Churches",
    original_study = "Churches and Church Membership in the United States, 1952",
    citation = "(1956). Churches and Church Membership in the United States: An Enumeration and Analysis by Counties, States and Regions. National Council of Churches: New York.",
    notes = "State validation file used to compare county-summed congregations, members, and population."
  ),
  list(
    year = 1971, fid = "CMS71ST", source_id = "cms-1971-state-file",
    filename = "CMS71ST_state.xls", codebook_filename = "CMS71ST_codebook.txt",
    sheet = "CMS71ST_data1", expected_rows = 50, state_col = NULL, state_name_col = "NAME",
    cng_col = "CHTOTAL", adh_col = "TOTADH", pop_col = "TOTPOP",
    display_name = "Churches and Church Membership in the United States, 1971 (States)",
    provider = "Association of Religion Data Archives (ARDA); original study by Johnson, Picard, and Quinn for Glenmary Research Center",
    original_study = "Churches and Church Membership in the United States, 1971",
    citation = "Johnson, D. W., Picard, P., & Quinn, B. (1974). Churches and Church Membership in the United States. Glenmary Research Center: Washington, D.C.",
    notes = "State validation file has 50 states and omits the District of Columbia county row present in the county file."
  ),
  list(
    year = 1980, fid = "CMS80ST", source_id = "cms-1980-state-file",
    filename = "CMS80ST_state.xlsx", codebook_filename = "CMS80ST_codebook.txt",
    sheet = "Data", expected_rows = 50, state_col = "STATE", state_name_col = "STATENA",
    cng_col = "NOCTOT80", adh_col = "ADHTOT80", pop_col = "TOTPOP",
    display_name = "Churches and Church Membership in the United States, 1980 (States)",
    provider = "Association of Religion Data Archives (ARDA); original study by Glenmary Research Center",
    original_study = "Churches and Church Membership in the United States, 1980",
    citation = "Churches and Church Membership in the United States, 1980. Glenmary Research Center.",
    notes = "State validation file has 50 states and omits the District of Columbia county row present in the county file."
  ),
  list(
    year = 1990, fid = "CMS90ST", source_id = "cms-1990-state-file",
    filename = "CMS90ST_state.xlsx", codebook_filename = "CMS90ST_codebook.txt",
    sheet = "Data", expected_rows = 50, state_col = "STATE", state_name_col = "STATENA",
    cng_col = "TOTCH", adh_col = "TOTADH", pop_col = "TOTPOP",
    display_name = "Churches and Church Membership in the United States, 1990 (States)",
    provider = "Association of Religion Data Archives (ARDA); original study by the Association of Statisticians of American Religious Bodies",
    original_study = "Churches and Church Membership in the United States, 1990",
    citation = "Churches and Church Membership in the United States, 1990. Association of Statisticians of American Religious Bodies.",
    notes = "State validation file has 50 states and omits the District of Columbia county row present in the county file."
  ),
  list(
    year = 2000, fid = "RCMSST", source_id = "usrc-2000-state-file",
    filename = "RCMSST_state.xlsx", codebook_filename = "RCMSST_codebook.txt",
    sheet = "Data", expected_rows = 51, state_col = "FIP", state_name_col = "STATENAM",
    cng_col = "TOTCG", adh_col = "TOTAD", pop_col = "POP2000",
    display_name = "U.S. Religion Census - Religious Congregations and Membership Study, 2000 (State File)",
    provider = "Association of Religion Data Archives (ARDA); original study by the Association of Statisticians of American Religious Bodies",
    original_study = "U.S. Religion Census Religious Congregations and Membership Study, 2000",
    citation = "U.S. Religion Census: Religious Congregations and Membership Study, 2000 (State File). Association of Statisticians of American Religious Bodies.",
    notes = "State validation file used to compare county-summed congregations, adherents, and population."
  ),
  list(
    year = 2010, fid = "RCMSST10", source_id = "usrc-2010-state-file",
    filename = "RCMSST10_state.xlsx", codebook_filename = "RCMSST10_codebook.txt",
    sheet = "Data", expected_rows = 51, state_col = "STCODE", state_name_col = "STNAME",
    cng_col = "TOTCNG", adh_col = "TOTADH", pop_col = "POP2010",
    display_name = "U.S. Religion Census - Religious Congregations and Membership Study, 2010 (State File)",
    provider = "Association of Religion Data Archives (ARDA); data collected by Grammich, Hadaway, Houseal, Jones, Krindatch, Stanley, and Taylor for ASARB",
    original_study = "U.S. Religion Census Religious Congregations and Membership Study, 2010",
    citation = "U.S. Religion Census: Religious Congregations and Membership Study, 2010 (State File). Association of Statisticians of American Religious Bodies.",
    notes = "State validation file used to compare county-summed congregations, adherents, and population."
  ),
  list(
    year = 2020, fid = "RCMSST20", source_id = "usrc-2020-state-file",
    filename = "RCMSST20_state.xlsx", codebook_filename = "RCMSST20_codebook.txt",
    sheet = "Data", expected_rows = 52, state_col = "STCOD", state_name_col = "STATNAM",
    cng_col = "TOTCNG_2020", adh_col = "TOTADH_2020", pop_col = "POP2020",
    exclude_state_fips = "99",
    display_name = "U.S. Religion Census - Religious Congregations and Membership Study, 2020 (State File)",
    provider = "Association of Religion Data Archives (ARDA); data collected by Grammich, Hadaway, Houseal, Jones, Krindatch, Stanley, and Thumma",
    original_study = "U.S. Religion Census Religious Congregations and Membership Study, 2020",
    citation = "U.S. Religion Census: Religious Congregations and Membership Study, 2020 (State File). Association of Statisticians of American Religious Bodies.",
    notes = "State validation file includes a national row coded 99; that row is excluded from state comparisons."
  )
)

skipped_waves <- list(
  list(year = 1936, fid = "1936CENSCT", available = TRUE, county_level = TRUE,
       county_identifier_scheme = "FIPST and FIPCNT state/county identifiers in the county codebook",
       population_present = FALSE, total_all_bodies_present = FALSE,
       reason_not_built = "Fails the Phase 2 inclusion rule: no same-study county population field and no all-bodies total-members field exposed in the county codebook."),
  list(year = 1926, fid = "1926CENSCT", available = TRUE, county_level = TRUE,
       county_identifier_scheme = "FIPST and FIPCNT state/county identifiers in the county codebook",
       population_present = FALSE, total_all_bodies_present = FALSE,
       reason_not_built = "Fails the Phase 2 inclusion rule: no same-study county population field and no all-bodies total-members field exposed in the county codebook."),
  list(year = 1916, fid = "1916CENSCT", available = TRUE, county_level = TRUE,
       county_identifier_scheme = "FIPST and FIPCNT state/county identifiers in the county codebook",
       population_present = FALSE, total_all_bodies_present = FALSE,
       reason_not_built = "Fails the Phase 2 inclusion rule: no same-study county population field and no all-bodies total-members field exposed in the county codebook."),
  list(year = 1906, fid = "1906CENSCT", available = TRUE, county_level = TRUE,
       county_identifier_scheme = "FIPST and FIPCNT state/county identifiers in the county codebook",
       population_present = FALSE, total_all_bodies_present = FALSE,
       reason_not_built = "Fails the Phase 2 inclusion rule: no same-study county population field; the apparent total field is Protestant-only, not an all-bodies total."),
  list(year = 1890, fid = "1890CENSCT", available = TRUE, county_level = TRUE,
       county_identifier_scheme = "state and county naming with weaker join identifiers than the later FIPS-coded files",
       population_present = FALSE, total_all_bodies_present = FALSE,
       reason_not_built = "Pre-1906 file exists at ARDA but is outside this build and fails the same-study population requirement.")
)

state_validation_by_year <- setNames(lapply(state_validation_specs, function(spec) {
  read_state_validation(spec)
}), vapply(state_validation_specs, function(spec) as.character(spec[["year"]]), character(1)))

rows <- list()
wave_validation <- list()
rows_by_year <- list()
source_extract_files <- list()

for (spec in county_specs) {
  source_rows <- read_county_wave(spec)
  mapped_rows <- apply_crosswalk(source_rows, spec[["year"]])
  source_unmatched <- mapped_rows[!(mapped_rows[["mapped_fips"]] %in% geoids), ]
  joined_rows <- mapped_rows[mapped_rows[["mapped_fips"]] %in% geoids, ]
  agg <- aggregate_mapped_rows(joined_rows)
  name_index <- match(agg[["fips"]], name20[["fips"]])
  extract <- data.frame(
    fips = agg[["fips"]],
    name = name20[["name"]][name_index],
    state = name20[["state"]][name_index],
    cng = agg[["cng"]],
    adh = agg[["adh"]],
    pop = agg[["pop"]],
    quality_flag = vapply(seq_len(nrow(agg)), function(index) {
      flags <- character(0)
      if (spec[["year"]] < 2010) flags <- c(flags, "wave_coverage_differs")
      if (agg[["crosswalked"]][index]) flags <- c(flags, "boundary_change_crosswalked")
      paste(flags, collapse = ";")
    }, character(1)),
    original_fips = agg[["original_fips"]],
    crosswalk_note = agg[["crosswalk_note"]],
    stringsAsFactors = FALSE
  )
  extract <- extract[order(extract[["fips"]]), ]
  extract_path <- file.path(src_dir, sprintf("us_rcms_county_%d_extract.csv", spec[["year"]]))
  write.csv(extract, extract_path, row.names = FALSE, na = "")
  source_extract_files[[as.character(spec[["year"]])]] <- list(path = extract_path, row_count = nrow(extract))

  rows <- c(rows, build_area_rows(agg, spec[["year"]], spec[["source_id"]], spec[["study_name"]]))
  rows_by_year[[as.character(spec[["year"]])]] <- nrow(agg)
  state_spec_index <- match(spec[["year"]], vapply(state_validation_specs, function(item) item[["year"]], numeric(1)))
  state_source_id <- state_validation_specs[[state_spec_index]][["source_id"]]
  state_check <- validate_against_states(source_rows, state_validation_by_year[[as.character(spec[["year"]])]], state_source_id)
  missing_boundary_fips <- sort(setdiff(geoids, agg[["fips"]]))
  crosswalked_rows <- mapped_rows[mapped_rows[["crosswalked"]], ]
  unmatched_list <- lapply(seq_len(nrow(source_unmatched)), function(index) {
    list(
      original_fips = source_unmatched[["original_fips"]][[index]],
      mapped_fips = source_unmatched[["mapped_fips"]][[index]],
      source_name = source_unmatched[["source_county_name"]][[index]]
    )
  })

  wave_validation[[as.character(spec[["year"]])]] <- list(
    year = spec[["year"]],
    fid = spec[["fid"]],
    available = TRUE,
    county_level = TRUE,
    county_identifier_scheme = if (is.null(spec[["fips_col"]])) "state code plus county code, combined to 5-digit FIPS" else paste0("5-digit FIPS column ", spec[["fips_col"]]),
    population_present = TRUE,
    population_field = spec[["pop_col"]],
    source_rows = nrow(source_rows),
    complete_source_rows = sum(is.finite(source_rows[["cng"]]) & is.finite(source_rows[["adh"]]) & is.finite(source_rows[["pop"]])),
    source_rows_after_crosswalk_join = nrow(joined_rows),
    mapped_area_rows = nrow(agg),
    mapped_complete_area_rows = sum(is.finite(agg[["cng"]]) & is.finite(agg[["adh"]]) & is.finite(agg[["pop"]])),
    join_coverage = paste0(nrow(agg), "/", length(geoids)),
    missing_2020_boundary_count = length(missing_boundary_fips),
    missing_2020_boundary_fips = missing_boundary_fips,
    unmatchable_source_count = nrow(source_unmatched),
    unmatchable_source_counties = unmatched_list,
    crosswalked_source_row_count = nrow(crosswalked_rows),
    crosswalked_source_fips = sort(unique(crosswalked_rows[["original_fips"]])),
    validation = state_check
  )

  cat(sprintf("%d: %d source rows -> %d mapped 2020 counties; join coverage %d/%d\n",
              spec[["year"]], nrow(source_rows), nrow(agg), nrow(agg), length(geoids)))
}

source_datasets <- c(
  lapply(county_specs, make_arda_source, role = "map_source"),
  lapply(state_validation_specs, make_arda_source, role = "validation_source"),
  list(
    list(
      source_dataset_id = boundary_dataset_id,
      name = "2020 Cartographic Boundary File, Counties, 1:5,000,000",
      provider = "U.S. Census Bureau",
      url = "https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_county_5m.zip",
      retrieval_date = retrieval_date,
      local_path = "apps/regions/us/data/counties_2020.geojson",
      role = "boundary",
      licence = list(
        name = "U.S. government work (public domain)",
        url = "https://www.census.gov/geographies/mapping-files/time-series/geo/carto-boundary-file.html",
        attribution = "U.S. Census Bureau"
      ),
      citation = "U.S. Census Bureau (2021). 2020 Cartographic Boundary Files, Counties.",
      access_limits = NULL,
      redistribution_limits = "None; public domain.",
      notes = "Filtered to 50 states plus District of Columbia (3143 of 3234 features); territories dropped to match RCMS coverage."
    ),
    list(
      source_dataset_id = crosswalk_dataset_id,
      name = "US county FIPS crosswalk to 2020 county boundaries (derived)",
      provider = "Places of Worship project derivation, sourced from U.S. Census Bureau county-change documentation and source-workbook FIPS/name checks",
      url = "https://www.census.gov/programs-surveys/geography/technical-documentation/county-changes.2010.html",
      retrieval_date = retrieval_date,
      local_path = crosswalk_path,
      role = "crosswalk",
      licence = list(
        name = "derived from public-domain Census Bureau documentation",
        url = NULL,
        attribution = "U.S. Census Bureau county-change records; derivation by the Places of Worship project"
      ),
      citation = "Derived crosswalk; sourced from U.S. Census Bureau county-change documentation and source-workbook FIPS/name checks.",
      access_limits = NULL,
      redistribution_limits = "None.",
      notes = "Year-scoped crosswalk from historical county FIPS codes to the 2020 county boundary set. Multi-successor historical areas are mapped to one documented successor and flagged boundary_change_crosswalked."
    )
  )
)

indicators <- list(
  list(
    indicator_id = "population_total",
    label = "Resident population",
    description = "Resident population as reported in the corresponding ARDA county file and used as the denominator for adherents per 100 population.",
    unit = "count",
    denominator_indicator_id = NULL,
    method = "Read from each wave's same-study county population field.",
    temporal_coverage = "1952, 1971, 1980, 1990, 2000, 2010, 2020",
    spatial_coverage = "US counties, joined to the 2020 boundary set where a defensible FIPS join or crosswalk exists.",
    quality_notes = "The population denominator comes from the same ARDA study file as the adherent count; no external population splicing is used."
  ),
  list(
    indicator_id = "religious_affiliation_percent",
    label = "Adherents per 100 population",
    description = "Congregational adherents reported to ARDA / the U.S. Religion Census per 100 residents. This is institutional adherence claimed by participating religious bodies, not census self-identification.",
    unit = "percent",
    denominator_indicator_id = "population_total",
    method = "100 * total adherents (or members in 1952) divided by same-study county population.",
    temporal_coverage = "1952, 1971, 1980, 1990, 2000, 2010, 2020",
    spatial_coverage = "US counties, 2020 boundary set",
    quality_notes = "Religious-body participation and definitions differ by wave. The 1952 file has only a Negro Missions estimate, the 1971 file covers 53 denominations, the 1980 and 1990 files include partial Black-denomination coverage, and the 2000 file excludes historically African-American denominations."
  ),
  list(
    indicator_id = "religious_change",
    label = "Change in adherents per 100 population",
    description = "Wave-to-wave percentage-point change in adherents per 100 population.",
    unit = "percentage points",
    denominator_indicator_id = "population_total",
    method = "Later wave adherents-per-100 minus the previous available wave's adherents-per-100 for the same 2020 county.",
    temporal_coverage = "1952-2020 adjacent available waves",
    spatial_coverage = "US counties, 2020 boundary set",
    quality_notes = "Treat wave-to-wave change as directional. Source coverage, definitions, and county-boundary crosswalks differ across the historical sequence."
  )
)

validation_warnings <- unlist(lapply(names(wave_validation), function(year_key) {
  item <- wave_validation[[year_key]]
  state_result <- item[["validation"]][["result"]]
  warnings <- character(0)
  if (!identical(state_result, "exact")) {
    warnings <- c(warnings, sprintf("%s state validation result: %s", year_key, state_result))
  }
  if (item[["missing_2020_boundary_count"]] > 0) {
    warnings <- c(warnings, sprintf("%s has %d 2020 boundary counties without a mapped source row", year_key, item[["missing_2020_boundary_count"]]))
  }
  if (item[["unmatchable_source_count"]] > 0) {
    warnings <- c(warnings, sprintf("%s has %d source rows that remain unmatchable after crosswalk", year_key, item[["unmatchable_source_count"]]))
  }
  warnings
}), use.names = FALSE)

manifest <- list(
  schema_version = "0.2.0",
  generated_at = stamp,
  generated_by = "scripts/build_us_area_summary.R",
  country_code = "US",
  boundary_set = list(
    boundary_set_id = "us-county-2020",
    country_code = "US",
    level = "county",
    vintage = "2020",
    source_dataset_id = boundary_dataset_id
  ),
  site_snapshot = list(
    source_dataset_id = NULL,
    snapshot_date = NULL,
    basis = "no OpenStreetMap place-of-worship layer built yet for the US",
    notes = "place_count and its derived rates are omitted (not zero) pending a US OSM extraction pass."
  ),
  source_datasets = source_datasets,
  indicators = indicators,
  data_status = "adherents_live_historical",
  data_status_note = "County-level adherents/members and congregations are live for qualifying ARDA waves from 1952 through 2020. Federal Census of Religious Bodies county files from 1906 through 1936 are not included because they lack same-study county population fields.",
  validation = list(
    status = if (length(validation_warnings)) "passed_with_warnings" else "passed",
    warnings = validation_warnings,
    waves = wave_validation,
    skipped_waves = skipped_waves
  ),
  rows = rows
)

json_path <- file.path(us_dir, "area_summary_county.json")
csv_path <- file.path(us_dir, "area_summary_county.csv")
write_json(manifest, json_path, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
flat <- flatten_rows(rows)
write.csv(flat, csv_path, row.names = FALSE, na = "")

durable_files <- c(
  list(
    durable_file(json_path, row_count = length(rows), content = "US county area summary JSON with embedded source attribution and validation details."),
    durable_file(csv_path, row_count = nrow(flat), content = "Flattened CSV sibling of the US county area summary."),
    durable_file(file.path(us_dir, "counties_2020.geojson"), row_count = NULL, content = "2020 county boundary GeoJSON used for the join."),
    durable_file(crosswalk_path, row_count = nrow(crosswalk), content = "Year-scoped FIPS crosswalk to the 2020 county boundary set.")
  ),
  lapply(names(source_extract_files), function(year_key) {
    item <- source_extract_files[[year_key]]
    durable_file(item[["path"]], row_count = item[["row_count"]], content = paste0("Tracked extracted county totals for ", year_key, "."))
  })
)

area_hash <- unname(tools::sha256sum(json_path))
docs_manifest <- list(
  schema_version = "us-rcms-county-manifest.v1",
  manifest_id = paste0("manifest:us-rcms-county:us:1952-2020:", substr(area_hash, 1, 12)),
  dataset_id = "us-rcms-county:us:1952-2020:public",
  dataset_version_id = paste0("us-rcms-county:us:1952-2020:public:", substr(area_hash, 1, 12)),
  manifest_sha256 = NULL,
  dataset_family = "us-rcms-county",
  dataset_role = "public_product",
  scope = list(
    level = "country",
    country_codes = list("US"),
    snapshot_date = NULL,
    snapshot_anchor = NULL,
    pipeline_stage = "public"
  ),
  created_at = stamp,
  created_by = "scripts/build_us_area_summary.R",
  pipeline = list(
    script = "scripts/build_us_area_summary.R",
    git_commit = NULL,
    command = "Rscript scripts/build_us_area_summary.R",
    parameters = list(waves = names(rows_by_year), boundary_set = "us-county-2020"),
    software_versions = list(r = paste(R.version[["major"]], R.version[["minor"]], sep = "."))
  ),
  source = list(
    provider = "Association of Religion Data Archives (ARDA), original Churches and Church Membership / U.S. Religion Census studies, and U.S. Census Bureau county boundaries",
    source_dataset_ids = vapply(source_datasets, function(item) item[["source_dataset_id"]], character(1)),
    source_urls = unique(vapply(source_datasets, function(item) item[["url"]], character(1))),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = "ARDA click-through research-use terms for source workbooks; U.S. Census Bureau boundary files public domain. Derived products attribute ARDA, the original studies, and the U.S. Census Bureau.",
    citation = "See source_datasets for per-wave citations."
  ),
  durable_files = durable_files,
  stats = list(
    boundary_count = length(geoids),
    total_area_rows = length(rows),
    rows_by_year = rows_by_year
  ),
  validation = list(
    status = if (length(validation_warnings)) "passed_with_warnings" else "passed",
    commands = list("Rscript scripts/build_us_area_summary.R"),
    warnings = as.list(validation_warnings),
    notes = "Wave-level validation compares county sums with the corresponding ARDA state file where available. Federal Census of Religious Bodies county files were checked for inclusion-rule fields and skipped because county population is absent.",
    waves = wave_validation,
    skipped_waves = skipped_waves
  ),
  privacy = "public",
  licence_status = "accepted",
  downstream_status = "public",
  source_datasets = source_datasets,
  notes = "The map uses 2020 county boundaries for every wave. Pre-2010 rows are flagged wave_coverage_differs; crosswalked rows also include boundary_change_crosswalked."
)

docs_manifest_path <- file.path(manifest_dir, "us-rcms-county-1952-2020.json")
write_json(docs_manifest, docs_manifest_path, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)

cat(sprintf("\nwrote %s: %d rows across %d waves\n", json_path, length(rows), length(county_specs)))
cat(sprintf("wrote %s\n", docs_manifest_path))
cat("done\n")
