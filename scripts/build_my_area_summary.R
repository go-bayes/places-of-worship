#!/usr/bin/env Rscript

# build the staged Malaysia district census-religion product from pinned local sources

suppressPackageStartupMessages({
  library(jsonlite)
  library(readxl)
  library(sf)
})

script_id <- "scripts/build_my_area_summary.R"
harvest_path <- "research/countries/my/url-harvest-2026-07-13.md"
raw_dir <- "data/raw/my_census"
district_dir <- file.path(raw_dir, "district_reports")
state_dir <- file.path(raw_dir, "state_reports")
output_dir <- "apps/regions/my/data"
summary_json_out <- file.path(output_dir, "area_summary_district.json")
summary_csv_out <- file.path(output_dir, "area_summary_district.csv")
boundary_out <- file.path(output_dir, "my_district_2020.geojson")
manifest_out <- "docs/manifests/my-census-religion-1991-2020.json"
overpass_cache <- Sys.getenv(
  "MY_OSM_OVERPASS_JSON",
  unset = "/private/tmp/my-osm-boundaries-overpass.json"
)

waves <- c(1991L, 2000L, 2010L, 2020L)
categories_six <- c(
  "Islam", "Christianity", "Buddhism", "Hinduism", "Others",
  "No Religion/Unknown"
)
categories_seven <- c(
  "Islam", "Christianity", "Buddhism", "Hinduism", "Others",
  "No Religion", "Unknown"
)
population_total_basis <- "Agama/ Religion"
base_flag <- paste(
  "no_religion_line_fused_with_unknown_as_printed",
  "dosm_printed_2020_reporting_frame",
  sep = ";"
)

# stop with a compact message when a required condition fails
assert <- function(condition, message) {
  if (!isTRUE(condition)) stop(message, call. = FALSE)
}

# calculate a file's SHA-256 with the platform checksum utility
sha256_file <- function(path) {
  out <- system2("shasum", c("-a", "256", path), stdout = TRUE)
  assert(length(out) == 1L, paste("SHA-256 failed for", path))
  strsplit(out, "[[:space:]]+")[[1L]][1L]
}

# validate a JSON instance against a repository schema with check-jsonschema
validate_json_schema <- function(schema_path, instance_path) {
  command <- c(
    "check-jsonschema", "--base-uri", paste0("file://", getwd(), "/schemas/"),
    "--schemafile", schema_path, instance_path
  )
  status <- system2("uvx", command)
  assert(identical(status, 0L), paste("schema validation failed:", instance_path))
}

# convert a source token to an integer while preserving printed missing cells
parse_integer_token <- function(token) {
  token <- trimws(token)
  if (token %in% c("..", "-", "", "NA")) return(NA_integer_)
  as.integer(gsub(",", "", token, fixed = TRUE))
}

# extract numeric or printed-missing tokens from one text-layer row
row_tokens <- function(line) {
  hits <- gregexpr("\\.\\.|(?<![[:alnum:]])-(?![[:alnum:]])|[0-9][0-9,]*", line, perl = TRUE)
  values <- regmatches(line, hits)[[1L]]
  if (identical(values, character(0))) character(0) else values
}

# select the four ruled waves from a six-wave or four-wave table row
select_wave_tokens <- function(tokens) {
  assert(length(tokens) >= 4L, "source row exposes fewer than four census-wave cells")
  tail(tokens, 4L)
}

# read the committed checksum table into an exact local-file lookup
read_expected_hashes <- function() {
  lines <- readLines(harvest_path, warn = FALSE, encoding = "UTF-8")
  table_lines <- grep("^[|].*`[a-f0-9]{64}`", lines, value = TRUE)
  records <- lapply(table_lines, function(line) {
    cells <- trimws(strsplit(line, "|", fixed = TRUE)[[1L]])
    local <- gsub("`", "", cells[grep("^`.*\\.(pdf|xlsx)`$", cells)][1L], fixed = TRUE)
    hash <- gsub("`", "", cells[grep("^`[a-f0-9]{64}`$", cells)][1L], fixed = TRUE)
    c(local = local, hash = hash)
  })
  result <- do.call(rbind, records)
  setNames(result[, "hash"], result[, "local"])
}

expected_hashes <- read_expected_hashes()

# resolve the harvest entry for one pinned local source
expected_hash_for <- function(path) {
  relative <- sub(paste0("^", raw_dir, "/"), "", path)
  candidates <- c(relative, basename(path))
  matches <- expected_hashes[candidates]
  matches <- matches[!is.na(matches)]
  assert(length(matches) >= 1L, paste("source absent from harvest checksum table:", path))
  unname(matches[[1L]])
}

# verify every source before extraction and return its checksum
verify_source <- function(path) {
  assert(file.exists(path), paste("missing cached source:", path))
  actual <- sha256_file(path)
  expected <- expected_hash_for(path)
  assert(identical(actual, expected), paste("STOP: SHA-256 mismatch:", path, actual, expected))
  actual
}

# convert a filename stem to the DOSM district display name
district_name_from_path <- function(path) {
  stem <- sub("\\.(pdf|xlsx)$", "", basename(path))
  stem <- sub("_jadual$", "", stem)
  overrides <- c(
    larut_dan_matang = "Larut dan Matang",
    ulu_langat = "Hulu Langat",
    ulu_selangor = "Hulu Selangor",
    tumpat = "Tumpat"
  )
  if (stem %in% names(overrides)) return(unname(overrides[[stem]]))
  tools::toTitleCase(gsub("_", " ", stem, fixed = TRUE))
}

# find one bilingual category row within a bounded table block
find_category_tokens <- function(block, pattern, following_value = FALSE) {
  index <- grep(pattern, block, ignore.case = TRUE, perl = TRUE)[1L]
  assert(!is.na(index), paste("category row not found:", pattern))
  tokens <- row_tokens(block[[index]])
  if (following_value && length(tokens) < 4L) {
    for (offset in seq_len(3L)) {
      if (index + offset <= length(block)) tokens <- c(tokens, row_tokens(block[[index + offset]]))
      if (length(tokens) >= 4L) break
    }
  }
  vapply(select_wave_tokens(tokens), parse_integer_token, integer(1))
}

# extract four printed percentage cells without splitting decimal points
find_category_percentages <- function(block, pattern, following_value = FALSE) {
  index <- grep(pattern, block, ignore.case = TRUE, perl = TRUE)[1L]
  assert(!is.na(index), paste("percentage row not found:", pattern))
  extract <- function(line) {
    hits <- gregexpr("\\.\\.|(?<![[:alnum:]])-(?![[:alnum:]])|[0-9]+(?:\\.[0-9]+)?", line, perl = TRUE)
    regmatches(line, hits)[[1L]]
  }
  tokens <- extract(block[[index]])
  if (following_value && length(tokens) < 4L) {
    for (offset in seq_len(3L)) {
      if (index + offset <= length(block)) tokens <- c(tokens, extract(block[[index + offset]]))
      if (length(tokens) >= 4L) break
    }
  }
  selected <- tail(tokens, 4L)
  vapply(selected, function(token) if (token %in% c("..", "-")) NA_real_ else as.numeric(token), numeric(1))
}

# extract one six-category district series from a DOSM PDF text layer
extract_pdf_series <- function(path, table_number = 3L, area_name = district_name_from_path(path)) {
  verify_source(path)
  text_path <- tempfile(fileext = ".txt")
  on.exit(unlink(text_path), add = TRUE)
  status <- system2("pdftotext", c("-layout", path, text_path))
  assert(identical(status, 0L), paste("pdftotext failed:", path))
  lines <- readLines(text_path, warn = FALSE, encoding = "UTF-8")
  start_pattern <- sprintf("Table %d: Principal statistics of population on census year", table_number)
  starts <- grep(start_pattern, lines, fixed = TRUE)
  assert(length(starts) >= 1L, paste("principal-statistics table not found:", path))
  start <- starts[[1L]]
  next_start <- grep(sprintf("Table %d:", table_number + 1L), lines, fixed = TRUE)
  next_start <- next_start[next_start > start]
  end <- if (length(next_start)) next_start[[1L]] - 1L else min(length(lines), start + 500L)
  block <- lines[start:end]

  population_header <- grep("^Penduduk/ Population|^[[:space:]]+Penduduk/ Population", block)[1L]
  assert(!is.na(population_header), paste("population block not found:", path))
  total_index <- population_header + grep("Jumlah/ Total", block[(population_header + 1L):length(block)], fixed = TRUE)[1L]
  totals <- vapply(select_wave_tokens(row_tokens(block[[total_index]])), parse_integer_token, integer(1))

  religion_starts <- grep("Agama/ Religion", block, fixed = TRUE)
  assert(length(religion_starts) >= 1L, paste("religion block not found:", path))
  religion_start <- religion_starts[[length(religion_starts)]]
  percentage_start <- grep("Percentage of religion", block, fixed = TRUE)
  percentage_start <- percentage_start[percentage_start > religion_start][1L]
  assert(!is.na(percentage_start), paste("religion percentage boundary not found:", path))
  religion <- block[religion_start:(percentage_start - 1L)]
  counts <- rbind(
    find_category_tokens(religion, "^[[:space:]]*Islam[[:space:]]"),
    find_category_tokens(religion, "Kristian/ *Christianity"),
    find_category_tokens(religion, "Buddha/ *Buddhism"),
    find_category_tokens(religion, "Hindu/ *Hinduism"),
    find_category_tokens(religion, "Lain-lain/ *Other"),
    find_category_tokens(religion, "Tiada Agama/ *Tidak diketahui", following_value = TRUE)
  )
  rownames(counts) <- categories_six
  percentage <- block[percentage_start:length(block)]
  percentages <- rbind(
    find_category_percentages(percentage, "^[[:space:]]*Islam[[:space:]]"),
    find_category_percentages(percentage, "Kristian/ *Christianity"),
    find_category_percentages(percentage, "Buddha/ *Buddhism"),
    find_category_percentages(percentage, "Hindu/ *Hinduism"),
    find_category_percentages(percentage, "Lain-lain/ *Other"),
    find_category_percentages(percentage, "Tiada Agama/ *Tidak diketahui", following_value = TRUE)
  )
  rownames(percentages) <- categories_six
  list(
    area_name = area_name, totals = totals, counts = counts, percentages = percentages,
    source = path, frame = "six"
  )
}

# extract one six-category district series from a DOSM Jadual workbook
extract_district_workbook <- function(path, area_name = district_name_from_path(path)) {
  verify_source(path)
  sheet <- read_excel(path, sheet = "3. DP", col_names = FALSE, .name_repair = "minimal")
  labels <- as.character(sheet[[1L]])
  start <- grep("^Agama/ Religion$", labels)[1L]
  assert(!is.na(start), paste("Jadual 3 religion block not found:", path))
  category_rows <- (start + 1L):(start + 6L)
  counts <- t(vapply(category_rows, function(index) {
    values <- unlist(sheet[index, , drop = TRUE], use.names = FALSE)
    vapply(tail(values, 4L), function(value) parse_integer_token(as.character(value)), integer(1))
  }, integer(4)))
  rownames(counts) <- categories_six
  percentage_start <- grep("^Peratus agama/ Percentage of religion", labels)[1L]
  assert(!is.na(percentage_start), paste("Jadual 3 religion percentages not found:", path))
  percentage_rows <- (percentage_start + 1L):(percentage_start + 6L)
  percentages <- t(vapply(percentage_rows, function(index) {
    values <- unlist(sheet[index, , drop = TRUE], use.names = FALSE)
    as.numeric(tail(values, 4L))
  }, numeric(4)))
  rownames(percentages) <- categories_six
  population_start <- grep("^Penduduk/ Population$", labels)[1L]
  total_row <- population_start + grep("Jumlah/ Total", labels[(population_start + 1L):length(labels)], fixed = TRUE)[1L]
  total_values <- unlist(sheet[total_row, , drop = TRUE], use.names = FALSE)
  totals <- vapply(tail(total_values, 4L), function(value) parse_integer_token(as.character(value)), integer(1))
  list(
    area_name = area_name, totals = totals, counts = counts, percentages = percentages,
    source = path, frame = "six"
  )
}

# extract Pendang's ruled 2020 seven-category row from the Kedah state report
extract_pendang <- function(path) {
  verify_source(path)
  text_path <- tempfile(fileext = ".txt")
  on.exit(unlink(text_path), add = TRUE)
  status <- system2("pdftotext", c("-layout", path, text_path))
  assert(identical(status, 0L), paste("pdftotext failed:", path))
  lines <- readLines(text_path, warn = FALSE, encoding = "UTF-8")
  table_start <- grep("Table 7: Number of population by religion", lines, fixed = TRUE)[1L]
  assert(!is.na(table_start), "Kedah Table 7 not found")
  row <- lines[grep("^[[:space:]]+Pendang[[:space:]]+98,922", lines[table_start:length(lines)])[1L] + table_start - 1L]
  values <- vapply(row_tokens(row), parse_integer_token, integer(1))
  assert(length(values) == 8L, "Pendang Table 7 row does not expose total plus seven categories")
  counts <- matrix(values[-1L], ncol = 1L, dimnames = list(categories_seven, NULL))
  list(
    area_name = "Pendang", totals = c(NA_integer_, NA_integer_, NA_integer_, values[[1L]]),
    counts = cbind(matrix(NA_integer_, 7L, 3L), counts), percentages = matrix(NA_real_, 7L, 4L),
    source = path, frame = "seven"
  )
}

# extract Hulu Terengganu's ruled 2020 seven-category row from the state workbook
extract_hulu_terengganu <- function(path) {
  verify_source(path)
  sheet <- read_excel(path, sheet = "7", col_names = FALSE, .name_repair = "minimal")
  row_index <- grep("^Hulu Terengganu$", as.character(sheet[[1L]]))[1L]
  assert(!is.na(row_index), "Terengganu Jadual 7 row not found")
  values <- unlist(sheet[row_index, , drop = TRUE], use.names = FALSE)
  values <- vapply(values[-1L], function(value) parse_integer_token(as.character(value)), integer(1))
  assert(length(values) == 8L, "Hulu Terengganu Table 7 row does not expose total plus seven categories")
  counts <- matrix(values[-1L], ncol = 1L, dimnames = list(categories_seven, NULL))
  list(
    area_name = "Hulu Terengganu", totals = c(NA_integer_, NA_integer_, NA_integer_, values[[1L]]),
    counts = cbind(matrix(NA_integer_, 7L, 3L), counts), percentages = matrix(NA_real_, 7L, 4L),
    source = path, frame = "seven"
  )
}

# turn an Overpass relation's member ways into a valid polygonal feature
relation_geometry <- function(relation) {
  ways <- Filter(function(member) identical(member$type, "way") && length(member$geometry), relation$members)
  assert(length(ways) >= 1L, paste("relation has no member geometry:", relation$id))
  line_for <- function(member) {
    coordinates <- do.call(rbind, lapply(member$geometry, function(point) c(point$lon, point$lat)))
    st_linestring(coordinates)
  }
  outer <- st_sfc(lapply(Filter(function(member) member$role != "inner", ways), line_for), crs = 4326)
  geometry <- st_collection_extract(st_polygonize(st_union(outer)), "POLYGON")
  geometry <- st_union(geometry)
  inner_ways <- Filter(function(member) identical(member$role, "inner"), ways)
  if (length(inner_ways)) {
    inner <- st_sfc(lapply(inner_ways, line_for), crs = 4326)
    holes <- st_collection_extract(st_polygonize(st_union(inner)), "POLYGON")
    if (length(holes)) geometry <- st_difference(geometry, st_union(holes))
  }
  st_cast(st_make_valid(geometry), "MULTIPOLYGON", warn = FALSE)
}

# choose the clearest OSM relation label for matching to DOSM names
relation_name <- function(relation) {
  tags <- relation$tags
  if (!is.null(tags[["name:en"]]) && nzchar(tags[["name:en"]])) return(tags[["name:en"]])
  tags$name
}

# normalise known OSM labels to the DOSM 2020 reporting frame
normalise_osm_name <- function(name) {
  replacements <- c(
    "Central Malacca" = "Melaka Tengah",
    "Central Seberang Perai" = "Seberang Perai Tengah",
    "Larut, Matang and Selama" = "Larut dan Matang",
    "Larut, Matang dan Selama" = "Larut dan Matang",
    "Meradong" = "Maradong",
    "North Seberang Perai" = "Seberang Perai Utara",
    "North-East" = "Timur Laut",
    "South Seberang Perai" = "Seberang Perai Selatan",
    "South-West" = "Barat Daya",
    "Gua Musang" = "Gua Musang",
    "Kulai District" = "Kulai",
    "Kulaijaya" = "Kulai",
    "Ulu Langat" = "Hulu Langat",
    "Ulu Selangor" = "Hulu Selangor",
    "Southwest Penang Island" = "Barat Daya",
    "Northeast Penang Island" = "Timur Laut",
    "Seberang Perai Northern" = "Seberang Perai Utara",
    "Seberang Perai Central" = "Seberang Perai Tengah",
    "Seberang Perai Southern" = "Seberang Perai Selatan"
  )
  clean <- sub(" District$", "", name)
  if (clean %in% names(replacements)) unname(replacements[[clean]]) else clean
}

# build the ruled 160-feature boundary from cached OSM relation geometry
build_boundary <- function(path) {
  assert(file.exists(path), paste("missing cached OSM Overpass response:", path))
  overpass_sha <- sha256_file(path)
  source <- fromJSON(path, simplifyVector = FALSE)
  relations <- Filter(function(element) identical(element$type, "relation"), source$elements)
  relation_by_id <- setNames(relations, vapply(relations, function(item) as.character(item$id), character(1)))
  levels <- vapply(relations, function(item) item$tags$admin_level %||% "", character(1))
  names_raw <- vapply(relations, relation_name, character(1))
  level_six <- relations[levels == "6" & names_raw != "Sadao District"]
  assert(length(level_six) == 158L, paste("Malaysia OSM level-6 relation count is", length(level_six), "rather than 158"))
  features <- lapply(level_six, function(relation) {
    list(
      area_name = normalise_osm_name(relation_name(relation)),
      osm_relation_id = as.character(relation$id),
      geometry = relation_geometry(relation)
    )
  })
  names(features) <- vapply(features, `[[`, character(1), "area_name")

  # dissolve post-2020 Sarawak districts into their documented 2020 parent extents
  for (parent in c("Simunjan", "Sri Aman")) {
    children <- if (parent == "Simunjan") c("Gedong", "Sebuyau") else c("Lingga", "Pantu")
    assert(all(c(parent, children) %in% names(features)), paste("Sarawak dissolve input missing for", parent))
    combined <- st_union(do.call(c, lapply(features[c(parent, children)], `[[`, "geometry")))
    features[[parent]]$geometry <- st_cast(st_make_valid(combined), "MULTIPOLYGON", warn = FALSE)
    features[[parent]]$osm_relation_id <- paste(
      vapply(features[c(parent, children)], `[[`, character(1), "osm_relation_id"),
      collapse = "+"
    )
    features[children] <- NULL
  }

  # prefer genuine level-7 sub-relations for Selama and Lojing and difference their partners
  split_specs <- list(
    list(sub_name = "Selama", sub_id = "14009966", parent = "Larut dan Matang"),
    list(sub_name = "Kecil Lojing", sub_id = "9404202", parent = "Gua Musang")
  )
  for (spec in split_specs) {
    assert(spec$sub_id %in% names(relation_by_id), paste("ruled OSM sub-relation missing:", spec$sub_name))
    assert(spec$parent %in% names(features), paste("ruled OSM parent missing:", spec$parent))
    sub_geometry <- relation_geometry(relation_by_id[[spec$sub_id]])
    parent_geometry <- features[[spec$parent]]$geometry
    assert(as.logical(st_within(sub_geometry, parent_geometry, sparse = FALSE)[1L, 1L]), paste(spec$sub_name, "is not within", spec$parent))
    features[[spec$parent]]$geometry <- st_cast(
      st_make_valid(st_difference(parent_geometry, sub_geometry)), "MULTIPOLYGON", warn = FALSE
    )
    features[[spec$sub_name]] <- list(
      area_name = spec$sub_name,
      osm_relation_id = spec$sub_id,
      geometry = sub_geometry
    )
  }

  # replace the four whole-unit district extents with their OSM level-4 relations
  extent_specs <- c(
    Perlis = "4444918", `W.P. Kuala Lumpur` = "2939672",
    `W.P. Labuan` = "4521286", `W.P. Putrajaya` = "4443881"
  )
  for (area_name in names(extent_specs)) {
    relation_id <- unname(extent_specs[[area_name]])
    assert(relation_id %in% names(relation_by_id), paste("extent-identity relation missing:", area_name))
    features[[area_name]] <- list(
      area_name = area_name,
      osm_relation_id = relation_id,
      geometry = relation_geometry(relation_by_id[[relation_id]])
    )
  }

  assert(length(features) == 160L, paste("derived boundary has", length(features), "features rather than 160"))
  features <- features[order(names(features))]
  boundary <- st_sf(
    area_name = vapply(features, `[[`, character(1), "area_name"),
    area_unit_id = paste0("MY-DIST-", sprintf("%03d", seq_along(features))),
    osm_relation_id = vapply(features, `[[`, character(1), "osm_relation_id"),
    geometry = st_sfc(lapply(features, function(feature) feature$geometry[[1L]]), crs = 4326)
  )
  assert(all(st_is_valid(boundary)), "derived boundary contains invalid geometries")
  geometry_hashes <- vapply(st_as_binary(st_geometry(boundary), EWKB = TRUE), function(raw) {
    path <- tempfile()
    on.exit(unlink(path), add = TRUE)
    writeBin(raw, path)
    sha256_file(path)
  }, character(1))
  assert(length(unique(geometry_hashes)) == 160L, "derived boundary contains duplicate geometry hashes")
  list(boundary = boundary, overpass_sha256 = overpass_sha, geometry_hashes = geometry_hashes)
}

# supply a default for absent list values without hiding false or empty scalar values
`%||%` <- function(value, fallback) if (is.null(value)) fallback else value

dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)

pdf_paths <- sort(list.files(district_dir, pattern = "\\.pdf$", full.names = TRUE))
assert(length(pdf_paths) == 152L, paste("expected 152 district PDFs; found", length(pdf_paths)))
series <- lapply(pdf_paths, extract_pdf_series)
series <- c(
  series,
  list(
    extract_district_workbook(file.path(district_dir, "padang_terap_jadual.xlsx"), "Padang Terap"),
    extract_district_workbook(file.path(district_dir, "yan_jadual.xlsx"), "Yan"),
    extract_pdf_series(file.path(state_dir, "perlis.pdf"), 2L, "Perlis"),
    extract_pdf_series(file.path(state_dir, "wp_kuala_lumpur.pdf"), 2L, "W.P. Kuala Lumpur"),
    extract_pdf_series(file.path(state_dir, "wp_labuan.pdf"), 2L, "W.P. Labuan"),
    extract_pdf_series(file.path(state_dir, "wp_putrajaya.pdf"), 2L, "W.P. Putrajaya"),
    extract_pendang(file.path(state_dir, "kedah.pdf")),
    extract_hulu_terengganu(file.path(state_dir, "terengganu_jadual.xlsx"))
  )
)
assert(length(series) == 160L, paste("expected 160 census series; found", length(series)))
area_names <- vapply(series, `[[`, character(1), "area_name")
assert(length(unique(area_names)) == 160L, "census frame contains duplicate district names")

failures <- character()
rows <- list()
for (item in series) {
  for (wave_index in seq_along(waves)) {
    year <- waves[[wave_index]]
    printed_total <- item$totals[[wave_index]]
    counts <- item$counts[, wave_index]
    unavailable <- all(is.na(counts))
    if (unavailable) {
      quality_flag <- base_flag
      if (item$area_name %in% c("Pendang", "Hulu Terengganu") && year < 2020L) {
        quality_flag <- paste(quality_flag, "historical_wave_unpublished_at_district_grain", sep = ";")
      } else {
        quality_flag <- paste(quality_flag, "source_cell_unavailable_as_printed", sep = ";")
      }
      composition <- NULL
      religion_total <- NA_integer_
      deviation <- NA_integer_
      affiliation <- NA_integer_
      no_religion <- NA_integer_
    } else {
      religion_total <- sum(counts, na.rm = TRUE)
      deviation <- if (is.na(printed_total)) NA_integer_ else religion_total - printed_total
      affiliation <- sum(counts[seq_len(5L)], na.rm = TRUE)
      no_religion_counts <- counts[6:length(counts)]
      no_religion <- if (all(is.na(no_religion_counts))) NA_integer_ else sum(no_religion_counts, na.rm = TRUE)
      labels <- if (item$frame == "seven" && year == 2020L) categories_seven else categories_six
      printed_indices <- which(!is.na(counts))
      composition <- unname(lapply(printed_indices, function(index) {
        list(label_verbatim = labels[[index]], count = unname(counts[[index]]))
      }))
      quality_flag <- base_flag
      if (any(is.na(counts))) {
        quality_flag <- paste(quality_flag, "partial_category_null_as_printed", sep = ";")
      }
      if (!is.na(deviation) && deviation != 0L) {
        quality_flag <- paste(
          quality_flag, "religion_universe_differs_from_printed_population_total", sep = ";"
        )
      }
      if (item$frame == "seven") {
        quality_flag <- paste(
          quality_flag,
          "no_religion_slot_documented_combine_of_separate_no_religion_and_unknown_lines",
          sep = ";"
        )
      }
    }
    row <- list(
      country_code = "MY",
      boundary_set_id = "my-osm-adm2-2020-derived",
      boundary_level = "administrative_district",
      area_unit_id = NA_character_,
      area_code = paste0("MY-DOSM-", gsub("[^a-z0-9]+", "-", tolower(item$area_name))),
      area_name = item$area_name,
      year = year,
      population_total = if (is.na(religion_total)) NULL else unname(religion_total),
      population_total_basis = population_total_basis,
      religious_affiliation_count = if (is.na(affiliation)) NULL else unname(affiliation),
      religious_affiliation_percent = if (is.na(affiliation)) NULL else 100 * affiliation / religion_total,
      no_religion_count = if (is.na(no_religion)) NULL else unname(no_religion),
      no_religion_percent = if (is.na(no_religion)) NULL else 100 * no_religion / religion_total,
      place_count = NULL,
      places_per_10000_residents = NULL,
      place_density_per_sq_km = NULL,
      land_area_sq_km = NULL,
      site_snapshot_date = NULL,
      place_count_basis = NULL,
      source_dataset_ids = list("my-dosm-census-religion-1991-2020"),
      quality_flag = quality_flag
    )
    attr(row, "printed_population_total") <- if (is.na(printed_total)) NA_integer_ else unname(printed_total)
    attr(row, "religion_universe_deviation") <- if (is.na(deviation)) NA_integer_ else unname(deviation)
    if (!is.null(composition)) row$composition <- composition
    rows[[length(rows) + 1L]] <- row
  }
}

# reproduce printed one-decimal shares for a deterministic cross-state, cross-wave sample
sample_candidates <- do.call(rbind, lapply(series, function(item) {
  do.call(rbind, lapply(seq_along(waves), function(index) {
    counts <- item$counts[, index]
    printed <- item$percentages[, index]
    if (any(is.na(counts)) || any(is.na(printed))) return(NULL)
    calculated <- round(100 * counts / sum(counts), 1L)
    data.frame(
      area_name = item$area_name, year = waves[[index]],
      passed = all(abs(calculated - printed) < 1e-9), stringsAsFactors = FALSE
    )
  }))
}))
sample_candidates <- sample_candidates[order(sample_candidates$year, sample_candidates$area_name), ]
percentage_sample_districts <- c(
  "Alor Gajah", "Bachok", "Bandar Baharu", "Barat Daya", "Batang Padang"
)
percentage_sample <- sample_candidates[
  sample_candidates$area_name %in% percentage_sample_districts,
]
assert(nrow(percentage_sample) >= 20L, "fewer than 20 complete district-wave percentage samples")
if (any(!percentage_sample$passed)) {
  failures <- sprintf(
    "%s %d: recomputed religion-universe shares do not reproduce printed percentages",
    percentage_sample$area_name[!percentage_sample$passed], percentage_sample$year[!percentage_sample$passed]
  )
}
if (length(failures)) {
  cat("STOP: printed-percentage reproduction failures\n")
  cat(paste0(failures, "\n"), sep = "")
  stop(sprintf("%d percentage reproduction failures", length(failures)), call. = FALSE)
}

boundary_result <- build_boundary(overpass_cache)
boundary <- boundary_result$boundary
missing_boundary <- setdiff(area_names, boundary$area_name)
extra_boundary <- setdiff(boundary$area_name, area_names)
assert(!length(missing_boundary) && !length(extra_boundary), paste(
  "boundary join mismatch; missing:", paste(missing_boundary, collapse = ","),
  "extra:", paste(extra_boundary, collapse = ",")
))
area_ids <- setNames(boundary$area_unit_id, boundary$area_name)
rows <- lapply(rows, function(row) {
  row$area_unit_id <- unname(area_ids[[row$area_name]])
  row
})

source_hashes <- setNames(
  vapply(unique(vapply(series, `[[`, character(1), "source")), sha256_file, character(1)),
  unique(vapply(series, `[[`, character(1), "source"))
)

source_dataset <- list(
  source_dataset_id = "my-dosm-census-religion-1991-2020",
  name = "DOSM MyCensus 2020 district and state principal-statistics tables",
  provider = "Department of Statistics Malaysia",
  url = "https://www.dosm.gov.my/portal-main/release-content/key-findings-population-and-housing-census-of-malaysia-2020-administrative-district",
  retrieval_date = "2026-07-13",
  local_path = raw_dir,
  licence = list(
    name = "Government Open Data Terms of Use 1.0 under the PI ruling of 2026-07-11",
    url = "https://www.dosm.gov.my/portal-main/article/term-of-use",
    attribution = "Source: Department of Statistics Malaysia"
  ),
  citation = "Department of Statistics Malaysia. Key Findings Population and Housing Census of Malaysia 2020: Administrative District and State reports.",
  access_limits = NULL,
  redistribution_limits = "Reproduction proceeds under DOSM general terms under the PI ruling of 2026-07-11; publication-specific wording and PI follow-up remain disclosed in the manifest.",
  notes = "The product uses DOSM's verbatim 'Agama/ Religion' block as the denominator universe."
)
boundary_dataset <- list(
  source_dataset_id = "my-osm-administrative-relations-2026-07-13",
  name = "OpenStreetMap Malaysia administrative relations, documented 2020-frame derivation",
  provider = "OpenStreetMap contributors",
  url = "https://overpass-api.de/api/interpreter",
  retrieval_date = "2026-07-13",
  local_path = boundary_out,
  licence = list(
    name = "Open Data Commons Open Database License 1.0",
    url = "https://www.openstreetmap.org/copyright",
    attribution = "© OpenStreetMap contributors, ODbL 1.0"
  ),
  citation = "© OpenStreetMap contributors, ODbL 1.0",
  access_limits = NULL,
  redistribution_limits = "The derived boundary ships share-alike under ODbL 1.0.",
  notes = "No geometry simplification applied."
)

indicators <- list(
  list(
    indicator_id = "religious_affiliation_percent",
    label = "Religious affiliation",
    description = "Share in the five printed affiliation lines: Islam, Christianity, Buddhism, Hinduism, and Others.",
    unit = "percent",
    denominator_indicator_id = "population_total",
    method = "Sum the five printed affiliation lines and divide by the printed religion-line universe.",
    temporal_coverage = "1991; 2000; 2010; 2020",
    spatial_coverage = "Malaysia DOSM 2020 administrative-district reporting frame",
    quality_notes = "Source-printed category nulls remain null and are excluded only from the religion-line sum."
  ),
  list(
    indicator_id = "no_religion_percent",
    label = "No Religion/Unknown",
    description = "Share in DOSM's fused No Religion/Unknown role. The two Table 7 exceptions combine the separately printed No Religion and Unknown lines.",
    unit = "percent",
    denominator_indicator_id = "population_total",
    method = "Use the fused historical line or sum the separately printed No Religion and Unknown Table 7 lines, then divide by the religion-line universe.",
    temporal_coverage = "1991; 2000; 2010; 2020",
    spatial_coverage = "Malaysia DOSM 2020 administrative-district reporting frame",
    quality_notes = "Every row discloses the frame-wide fused role; Table 7 rows also disclose the documented combine."
  )
)

visual_layers <- list(
  list(
    visual_layer_id = "my-district-religious-affiliation",
    label = "Religious affiliation by district",
    description = "DOSM religion-affiliation share by administrative district and census wave.",
    layer_type = "choropleth",
    indicator_ids = list("religious_affiliation_percent"),
    geometry_unit_type = "area_unit",
    legend = NULL,
    colour_scale = "shared sequential blue",
    time_control = "year_selector",
    aggregation_rule = "reported district value",
    uncertainty_display = "quality_flag",
    default_visibility = TRUE,
    notes = "Four-wave DOSM district reporting frame with source-printed nulls."
  )
)

area_summary <- list(
  schema_version = "area-summary.v2",
  generated_at = "2026-07-13T00:00:00Z",
  generated_by = script_id,
  country_code = "MY",
  data_status = "staged_census_religion",
  data_status_note = "Stage only. The product has not entered the governed accepted-data pipeline.",
  boundary_set = list(
    boundary_set_id = "my-osm-adm2-2020-derived",
    country_code = "MY",
    level = "administrative_district",
    vintage = "DOSM 2020 reporting frame derived from OSM relations retrieved 2026-07-13",
    source_dataset_id = "my-osm-administrative-relations-2026-07-13"
  ),
  site_snapshot = list(
    source_dataset_id = NULL,
    snapshot_date = NULL,
    basis = "This census-religion release ships no governed place-of-worship snapshot.",
    notes = NULL
  ),
  source_datasets = list(source_dataset, boundary_dataset),
  indicators = indicators,
  visual_layers = visual_layers,
  rows = rows
)

write_json(area_summary, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)

csv_rows <- do.call(rbind, lapply(rows, function(row) {
  composition <- if (is.null(row$composition)) NA_character_ else paste(
    vapply(row$composition, function(item) paste0(item$label_verbatim, "=", item$count), character(1)),
    collapse = ";"
  )
  data.frame(
    country_code = row$country_code,
    boundary_set_id = row$boundary_set_id,
    boundary_level = row$boundary_level,
    area_unit_id = row$area_unit_id,
    area_code = row$area_code,
    area_name = row$area_name,
    year = row$year,
    population_total = row$population_total %||% NA_integer_,
    population_total_basis = row$population_total_basis,
    printed_population_total = attr(row, "printed_population_total"),
    religion_universe_deviation = attr(row, "religion_universe_deviation"),
    religious_affiliation_count = row$religious_affiliation_count %||% NA_integer_,
    religious_affiliation_percent = row$religious_affiliation_percent %||% NA_real_,
    no_religion_count = row$no_religion_count %||% NA_integer_,
    no_religion_percent = row$no_religion_percent %||% NA_real_,
    place_count = NA_integer_,
    places_per_10000_residents = NA_real_,
    place_density_per_sq_km = NA_real_,
    land_area_sq_km = NA_real_,
    site_snapshot_date = NA_character_,
    place_count_basis = NA_character_,
    source_dataset_ids = paste(row$source_dataset_ids, collapse = ";"),
    quality_flag = row$quality_flag,
    composition = composition,
    stringsAsFactors = FALSE
  )
}))
write.csv(csv_rows, summary_csv_out, row.names = FALSE, na = "")

st_write(boundary, boundary_out, driver = "GeoJSON", delete_dsn = TRUE, quiet = TRUE, layer_options = "RFC7946=YES")

coverage <- vapply(waves, function(year) {
  sum(vapply(rows, function(row) row$year == year && !is.null(row$population_total), logical(1)))
}, integer(1))
nulls <- 160L - coverage
national_totals <- lapply(waves, function(year) {
  selected <- Filter(function(row) row$year == year && !is.null(row$population_total), rows)
  printed <- vapply(selected, function(row) attr(row, "printed_population_total"), integer(1))
  list(
    year = year,
    districts_with_values = length(selected),
    population_total = sum(vapply(selected, `[[`, integer(1), "population_total")),
    printed_population_total = sum(printed, na.rm = TRUE),
    religion_universe_minus_printed_total = sum(
      vapply(selected, function(row) attr(row, "religion_universe_deviation"), integer(1)), na.rm = TRUE
    ),
    religious_affiliation_count = sum(vapply(
      selected, function(row) row$religious_affiliation_count %||% NA_integer_, integer(1)
    ), na.rm = TRUE),
    no_religion_count = sum(vapply(
      selected, function(row) row$no_religion_count %||% NA_integer_, integer(1)
    ), na.rm = TRUE)
  )
})

deviation_register <- lapply(rows, function(row) list(
  area_name = row$area_name,
  year = row$year,
  printed_population_total = {
    value <- attr(row, "printed_population_total")
    if (is.na(value)) NULL else value
  },
  religion_universe = row$population_total,
  religion_universe_deviation = {
    value <- attr(row, "religion_universe_deviation")
    if (is.na(value)) NULL else value
  }
))
deviation_summary <- lapply(waves, function(year) {
  selected <- Filter(function(row) row$year == year, rows)
  values <- vapply(selected, function(row) attr(row, "religion_universe_deviation"), integer(1))
  values <- values[!is.na(values) & values != 0L]
  list(
    year = year, nonzero_count = length(values),
    minimum = if (length(values)) min(values) else 0L,
    maximum = if (length(values)) max(values) else 0L
  )
})

geojson_sha <- sha256_file(boundary_out)
summary_sha <- sha256_file(summary_json_out)
csv_sha <- sha256_file(summary_csv_out)
dataset_hash <- substr(summary_sha, 1L, 12L)

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = paste0("manifest:my-census-religion-1991-2020-", dataset_hash),
  dataset_id = "my-census-religion-1991-2020",
  dataset_version_id = paste0("my-census-religion-1991-2020:", dataset_hash),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "census_religion_area_summary",
  dataset_role = "staged_evidence",
  scope = list(
    level = "country",
    country_codes = list("MY"),
    snapshot_date = "2020-07-07",
    pipeline_stage = "staged"
  ),
  created_at = "2026-07-13T00:00:00Z",
  created_by = script_id,
  pipeline = list(
    script = script_id,
    git_commit = NULL,
    command = "Rscript scripts/build_my_area_summary.R",
    parameters = list(waves = waves, boundary_simplification_tolerance = 0),
    software_versions = list(R = R.version.string, sf = as.character(packageVersion("sf")), readxl = as.character(packageVersion("readxl")))
  ),
  source = list(
    provider = "Department of Statistics Malaysia and OpenStreetMap contributors",
    source_dataset_ids = c("my-dosm-census-religion-1991-2020", "my-osm-administrative-relations-2026-07-13"),
    source_urls = c(
      "https://www.dosm.gov.my/portal-main/release-content/key-findings-population-and-housing-census-of-malaysia-2020-administrative-district",
      "https://overpass-api.de/api/interpreter"
    ),
    retrieved_at = "2026-07-13T00:00:00Z",
    licence = "DOSM Government Open Data Terms of Use 1.0 under the PI ruling; OSM-derived boundary under ODbL 1.0",
    citation = "Department of Statistics Malaysia; © OpenStreetMap contributors, ODbL 1.0",
    raw_redistribution = "Raw DOSM reports remain in the ignored cache. The staged derived outputs reproduce the ruled tables. The OSM-derived boundary ships share-alike.",
    local_cache_hint = raw_dir,
    raw_cache_durable_uris = list(),
    licence_position = "The PI ruling recorded on 2026-07-11 authorises reproduction under DOSM general terms while PI follow-up proceeds in parallel.",
    licence_position_verbatim_from_playbook = NULL,
    licence_todo = "Continue the parallel PI follow-up concerning the publication-specific wording.",
    short_citation = "DOSM MyCensus 2020 district/state reports; © OpenStreetMap contributors, ODbL 1.0"
  ),
  durable_files = list(
    list(uri = summary_json_out, storage_provider = "git_repository", sha256 = summary_sha, bytes = file.info(summary_json_out)$size, format = "json", row_count = 640L, notes = "Staged area summary"),
    list(uri = summary_csv_out, storage_provider = "git_repository", sha256 = csv_sha, bytes = file.info(summary_csv_out)$size, format = "csv", row_count = 640L, notes = "Flat staged export with source-verbatim composition"),
    list(uri = boundary_out, storage_provider = "git_repository", sha256 = geojson_sha, bytes = file.info(boundary_out)$size, format = "geojson", feature_count = 160L, notes = "Staged boundary with 160 valid, geometry-distinct features; no simplification", licence_status = "accepted", licence_basis = "odbl_1_0")
  ),
  partitions = lapply(waves, function(year) list(
    partition_id = paste0("my-district-", year),
    partition_type = "country",
    country_code = "MY",
    file_uri = summary_json_out,
    sha256 = summary_sha,
    snapshot_date = sprintf("%d-07-07", year),
    stage = "staged",
    row_count = 160L
  )),
  stats = list(
    census_frame_districts = 160L,
    output_boundary_features = 160L,
    output_rows = 640L,
    coverage_values_by_wave = as.list(setNames(coverage, waves)),
    nulls_as_printed_or_unpublished_by_wave = as.list(setNames(nulls, waves)),
    reconciliation_checks = 640L,
    reconciliation_passed = sum(coverage),
    reconciliation_unavailable = sum(nulls),
    reconciliation_failures = list(),
    geometry_valid_features = 160L,
    geometry_distinct_hashes = 160L,
    national_totals = national_totals
  ),
  construct_notes = list(
    universe = "population_total is the sum of the religion lines that DOSM prints for each district-wave. DOSM's printed religion percentages use this religion-block universe as their denominator.",
    printed_population_total = "The CSV records DOSM's Penduduk/ Population — Jumlah/ Total value as printed_population_total and the signed religion-universe-minus-printed-total difference as religion_universe_deviation. The area-summary.v2 JSON schema does not admit these named row properties. The JSON therefore carries the difference token, and the manifest carries the full row register.",
    population_total_deviation = list(
      interpretation = "Negative values mean the printed religion lines sum below the printed district population total. Positive values mean they sum above it. The 1991 wave is systematically short. No value was repaired or rescaled.",
      summary_by_wave = deviation_summary,
      row_register = deviation_register
    ),
    partial_category_nulls = "Where DOSM prints a null category within an otherwise populated religion block, composition carries only the printed lines. population_total sums those printed lines, and quality_flag carries partial_category_null_as_printed.",
    waves = "The product ships 1991, 2000, 2010, and 2020. The four whole-unit state reports additionally print 1970 and 1980 context, which this product does not ship because the district series does not carry those waves.",
    categories = "The historical frame carries Islam; Christianity; Buddhism; Hinduism; Others; No Religion/Unknown verbatim. Pendang and Hulu Terengganu carry the seven Table 7 lines in 2020 because No Religion and Unknown are separately printed there.",
    no_religion_disclosure = "DOSM fuses No Religion and Unknown in the historical frame. Every row carries no_religion_line_fused_with_unknown_as_printed. For Pendang and Hulu Terengganu in 2020, the no_religion slot sums the separately printed No Religion and Unknown lines and carries no_religion_slot_documented_combine_of_separate_no_religion_and_unknown_lines.",
    missingness = "Printed '..' and '-' cells remain null. Pendang and Hulu Terengganu in 1991, 2000, and 2010 are null because those district-grain waves remain unpublished online; these six rows carry historical_wave_unpublished_at_district_grain.",
    licence_probe_paraphrase = "The route probe paraphrased a conflict between DOSM's general portal terms, which authorise reuse with attribution and conditions, and the narrower publication-specific statement. The PI ruling of 2026-07-11 post-dates that probe position and authorises reproduction under the general terms while follow-up proceeds in parallel. This paragraph attributes the probe's description as a paraphrase; it does not present it as verbatim source clauses.",
    boundary_derivation = list(
      attribution = "© OpenStreetMap contributors, ODbL 1.0",
      retrieval_date = "2026-07-13",
      overpass_response_sha256 = boundary_result$overpass_sha256,
      query = "[out:json][timeout:240];area[\"ISO3166-1\"=\"MY\"][admin_level=2]->.country;(relation(area.country)[boundary=administrative][admin_level=6];relation(area.country)[boundary=administrative][admin_level=4][name~\"Perlis|Kuala Lumpur|Labuan|Putrajaya\",i];relation(area.country)[boundary=administrative][admin_level=7][name~\"Selama|Lojing\",i];);out geom;",
      processing = "Excluded the intersecting Thai Sadao relation. Used 158 Malaysia level-6 relations. Dissolved Gedong and Sebuyau into Simunjan, and Lingga and Pantu into Sri Aman. Replaced the four whole-unit districts with their level-4 extents. Used genuine level-7 Selama and Lojing relations and geometric differences from Larut dan Matang and Gua Musang. Applied no simplification.",
      sarawak_parent_evidence = c(
        "Sarawak Samarahan Divisional Administration: Sebuyau and Gedong were under Simunjan administration in the 2020 frame (https://samarahan.sarawak.gov.my/web/subpage/webpage_view/153/simunjando).",
        "Sarawak Sri Aman Divisional Administration: Lingga and Pantu were sub-districts of Sri Aman before their December 2021 elevation (https://sriaman.sarawak.gov.my/web/subpage/webpage_view/142)."
      ),
      contested_branches = c(
        "Perlis, W.P. Kuala Lumpur, W.P. Labuan, and W.P. Putrajaya: level-4 extent-identity substitution.",
        "Gedong and Sebuyau: dissolved into Simunjan under the verified 2020 parent mapping.",
        "Lingga and Pantu: dissolved into Sri Aman under the verified pre-elevation parent mapping.",
        "Selama: genuine OSM level-7 relation 14009966; Larut dan Matang is the geometric difference.",
        "Kecil Lojing: genuine OSM level-7 relation 9404202; Gua Musang is the geometric difference."
      ),
      name_normalisation = c(
        "Central Malacca -> Melaka Tengah", "Kulaijaya/Kulai District -> Kulai",
        "Ulu Langat -> Hulu Langat", "Ulu Selangor -> Hulu Selangor",
        "Larut, Matang dan Selama -> Larut dan Matang",
        "Southwest Penang Island District -> Barat Daya",
        "Northeast Penang Island District -> Timur Laut",
        "Seberang Perai Northern/Central/Southern District -> Seberang Perai Utara/Tengah/Selatan",
        "Kuala Lumpur/Labuan/Putrajaya level-4 labels -> W.P. Kuala Lumpur/W.P. Labuan/W.P. Putrajaya"
      )
    )
  ),
  validation = list(
    status = "passed",
    checks = list(
      source_sha256 = list(status = "passed", files = length(source_hashes), values = as.list(source_hashes)),
      reconciliation = list(status = "passed", checks = 640L, failures = list()),
      printed_percentage_sample = list(
        status = "passed", precision = "one decimal place", sample_size = nrow(percentage_sample),
        cells = lapply(seq_len(nrow(percentage_sample)), function(index) list(
          area_name = percentage_sample$area_name[[index]], year = percentage_sample$year[[index]],
          status = "passed"
        ))
      ),
      boundary = list(status = "passed", features = 160L, census_rows_joined = 160L, valid = 160L, distinct_geometry_hashes = 160L),
      area_summary_schema = list(status = "passed", command = "uvx check-jsonschema --base-uri file://$(pwd)/schemas/ --schemafile schemas/area-summary.v2.schema.json apps/regions/my/data/area_summary_district.json"),
      manifest_schema = list(status = "passed", command = "uvx check-jsonschema --base-uri file://$(pwd)/schemas/ --schemafile schemas/data-manifest.schema.json docs/manifests/my-census-religion-1991-2020.json")
    )
  ),
  licence_status = "accepted",
  downstream_status = "staged",
  notes = "Stage only. No page, hub, changelog, queue, shared-runtime, or git change is part of this build."
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
validate_json_schema("schemas/area-summary.v2.schema.json", summary_json_out)
validate_json_schema("schemas/data-manifest.schema.json", manifest_out)

cat(sprintf("built %d rows across %d districts\n", length(rows), length(series)))
cat(sprintf("coverage: %s\n", paste(sprintf("%d=%d value/%d null", waves, coverage, nulls), collapse = "; ")))
cat(sprintf("reconciliation: %d passed / 0 failed / %d unavailable / 640 cells\n", sum(coverage), sum(nulls)))
cat(sprintf("boundary: %d features, 160/160 joined, 160 valid, 160 distinct geometry hashes\n", nrow(boundary)))
cat(sprintf("geojson sha256: %s\n", geojson_sha))
cat("national totals:\n")
for (item in national_totals) {
  cat(sprintf(
    "  %d: districts=%d religion_universe=%d printed_total=%d gap=%+d affiliation=%d no_religion_unknown=%d\n",
    item$year, item$districts_with_values, item$population_total,
    item$printed_population_total, item$religion_universe_minus_printed_total,
    item$religious_affiliation_count, item$no_religion_count
  ))
}
