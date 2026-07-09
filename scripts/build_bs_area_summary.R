# build the bahamas island area-summary product from the 2010 census.
# inputs: the eighteen BNSI 2010 Census island reports (each Table 7.0, total
# population by sex, age group and religion), the 2010 Census First Release
# Report (Table 7.0, all-bahamas religion) as the national reconciliation
# authority, and the geoBoundaries BHS ADM1 (32 local government districts)
# GeoJSON, dissolved up to the eighteen census islands the reports use.
# outputs: apps/regions/bs/data/bs_island_2020.geojson,
# apps/regions/bs/data/area_summary_island.{json,csv}, and
# docs/manifests/bs-census-religion-2010.json.
# run from the repo root: Rscript scripts/build_bs_area_summary.R
# only the 2010 wave is mappable subnationally: the 2022 census publishes
# religion for All Bahamas only (by age and sex), so 2022 is national context
# recorded in the card and overview, not a map layer.
# the island religion tables are parsed with poppler pdftotext -layout; the two
# headline metrics need only each island's grand TOTAL, NONE and NOT STATED
# rows, and the eighteen islands reconcile exactly to the national report.

suppressMessages({
  library(jsonlite)
  library(sf)
})

raw_dir <- "data/raw/bs_census"
bs_dir <- "apps/regions/bs/data"
manifest_dir <- "docs/manifests"
dir.create(bs_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- "2026-07-09"
script_id <- "scripts/build_bs_area_summary.R"
country_code <- "BS"
years <- c(2010L)

boundary_set_id <- "bs-island-2020-geoboundaries-adm1-dissolved"
boundary_level <- "island"
census_2010_dataset_id <- "bnsi-2010-census-island-reports-table-7-religion"
national_2010_dataset_id <- "bnsi-2010-census-first-release-table-7-religion-all-bahamas"
national_2022_dataset_id <- "bnsi-2022-census-first-release-table-6-religion-all-bahamas"
boundary_dataset_id <- "geoboundaries-bhs-adm1-2020"

# source urls recorded in the manifest and the on-page attribution.
census_landing_url <- "https://stats.gov.bs/subjects/population-and-demography/"
first_release_2010_url <- "https://stats.gov.bs/wp-content/uploads/2020/08/Microsoft-Word-2010-CENSUS-FIRST-RELEASE-REPORT.pdf"
first_release_2022_url <- "https://cdn.bahamas.gov.bs/tenant/tenantbnsi/documents/2022-Census-Report-1st-Release-12-February-2025-FINAL-20250526040559.pdf"
island_report_base_url <- "https://stats.gov.bs/wp-content/uploads/2020/08/"
geoboundaries_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/BHS/ADM1/"
geoboundaries_gj_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/BHS/ADM1/geoBoundaries-BHS-ADM1.geojson"

geoboundaries_path <- file.path(raw_dir, "geoBoundaries-BHS-ADM1.geojson")
geoboundaries_meta_path <- file.path(raw_dir, "gb_bhs_adm1_meta.json")
national_2010_path <- file.path(raw_dir, "bs_2010_first_release.pdf")
national_2022_path <- file.path(raw_dir, "bs_2022_first_release.pdf")

boundary_out <- file.path(bs_dir, "bs_island_2020.geojson")
summary_json_out <- file.path(bs_dir, "area_summary_island.json")
summary_csv_out <- file.path(bs_dir, "area_summary_island.csv")
manifest_out <- file.path(manifest_dir, "bs-census-religion-2010.json")

licence_text <- paste(
  "BNSI 2010 Census of Population and Housing island reports (eighteen volumes,",
  "each Table 7.0, total population by sex, age group and religion) and the 2010",
  "Census First Release Report (Table 7.0, All Bahamas). The Bahamas National",
  "Statistical Institute publishes the census reports for open download; no",
  "explicit reuse licence is stated, so the derived product attributes BNSI and",
  "links the source of record. Boundaries are geoBoundaries BHS ADM1 (32 local",
  "government districts) dissolved to the eighteen census islands, Creative",
  "Commons Attribution 4.0 International, boundary source recorded by",
  "geoBoundaries as the Caribbean GeoPortal."
)
licence_status <- "bnsi_census_open_report_attribution_geoboundaries_cc_by_4_0"

# the eighteen census islands: report file, the census label, an area-code slug,
# and the geoBoundaries ADM1 district shapeNames that dissolve up to the island.
# the six-district Abaco, four-district Andros, three-district Eleuthera and
# Grand Bahama, and two-district Exuma and San Salvador groups reproduce the
# census's island geography; every one of the 32 districts belongs to exactly
# one island. Rum Cay carries no separate 2010 report and is tabulated with San
# Salvador (the census's historical "San Salvador & Rum Cay" unit).
islands <- list(
  list(key = "abaco", name = "Abaco", file = "bs_2010_abaco.pdf",
       url = "ABACO-2010-CENSUS-REPORT.pdf",
       districts = c("Central Abaco", "North Abaco", "South Abaco", "Moore's Island", "Grand Cay", "Hope Town")),
  list(key = "acklins", name = "Acklins", file = "bs_2010_acklins.pdf",
       url = "ACKLINS-2010-CENSUS-REPORT.pdf",
       districts = c("Acklins")),
  list(key = "andros", name = "Andros", file = "bs_2010_andros.pdf",
       url = "ANDROS-2010-CENSUS-REPORT.pdf",
       districts = c("Central Andros", "North Andros", "South Andros", "Mangrove Cay")),
  list(key = "berry-islands", name = "Berry Islands", file = "bs_2010_berry_islands.pdf",
       url = "BERRY-ISLANDS-2010-CENSUS-REPORT.pdf",
       districts = c("Berry Islands")),
  list(key = "bimini", name = "Bimini", file = "bs_2010_bimini.pdf",
       url = "BIMINIS-2010-CENSUS-REPORT.pdf",
       districts = c("Biminis")),
  list(key = "cat-island", name = "Cat Island", file = "bs_2010_cat_island.pdf",
       url = "CAT-ISLAND-2010-CENSUS-REPORT.pdf",
       districts = c("Cat Island")),
  list(key = "crooked-island", name = "Crooked Island", file = "bs_2010_crooked_island.pdf",
       url = "CROOKED-ISLAND-2010-CENSUS-REPORT.pdf",
       districts = c("Crooked Island")),
  list(key = "eleuthera", name = "Eleuthera", file = "bs_2010_eleuthera.pdf",
       url = "ELEUTHERA-2010-CENSUS-REPORT.pdf",
       districts = c("Central Eleuthera", "North Eleuthera", "South Eleuthera")),
  list(key = "exuma-and-cays", name = "Exuma and Cays", file = "bs_2010_exuma_cays.pdf",
       url = "EXUMA-CAYS-2010-CENSUS-REPORT.pdf",
       districts = c("Exuma", "Black Point")),
  list(key = "grand-bahama", name = "Grand Bahama", file = "bs_2010_grand_bahama.pdf",
       url = "GRAND-BAHAMA-2010-CENSUS-REPORT.pdf",
       districts = c("City of Freeport", "East Grand Bahama", "West Grand Bahama")),
  list(key = "harbour-island", name = "Harbour Island", file = "bs_2010_harbour_island.pdf",
       url = "HARBOUR-ISLAND-2010-CENSUS-REPORT.pdf",
       districts = c("Harbour Island")),
  list(key = "inagua", name = "Inagua", file = "bs_2010_inagua.pdf",
       url = "INAGUA-2010-CENSUS-REPORT.pdf",
       districts = c("Inagua")),
  list(key = "long-island", name = "Long Island", file = "bs_2010_long_island.pdf",
       url = "LONG-ISLAND-2010-CENSUS-REPORT.pdf",
       districts = c("Long Island")),
  list(key = "mayaguana", name = "Mayaguana", file = "bs_2010_mayaguana.pdf",
       url = "MAYAGUANA-2010-CENSUS-REPORT.pdf",
       districts = c("Mayaguana")),
  list(key = "new-providence", name = "New Providence", file = "bs_2010_new_providence.pdf",
       url = "NEW-PROVIDENCE-2010-CENSUS-REPORT.pdf",
       districts = c("New Providence")),
  list(key = "ragged-island", name = "Ragged Island", file = "bs_2010_ragged_island.pdf",
       url = "RAGGED-ISLAND-2010-CENSUS-REPORT.pdf",
       districts = c("Ragged Island")),
  list(key = "san-salvador", name = "San Salvador", file = "bs_2010_san_salvador.pdf",
       url = "SAN-SALVADOR-2010-CENSUS-REPORT.pdf",
       districts = c("San Salvador", "Rum Cay")),
  list(key = "spanish-wells", name = "Spanish Wells", file = "bs_2010_spanish_wells.pdf",
       url = "SPANISH-WELLS-2010-CENSUS-REPORT.pdf",
       districts = c("Spanish Wells"))
)

# national 2010 religion figures (First Release Report, Table 7.0, All Bahamas);
# the eighteen islands must sum to these exactly.
national_2010 <- list(total = 351461L, none = 6561L, not_stated = 9050L)
national_2010[["affiliation"]] <- national_2010[["total"]] - national_2010[["none"]] - national_2010[["not_stated"]]

# national 2022 religion figures (2022 First Release, Table 6.0, All Bahamas),
# recorded for the card/overview as national context only; 2022 religion is not
# published below the national level, so it is not a map layer.
national_2022 <- list(total = 398165L, none = 24677L, not_stated = 19075L)

# stop early if a required raw source has not been downloaded.
require_file <- function(path) {
  if (!file.exists(path)) stop("missing required source: ", path, call. = FALSE)
}

sha256_file <- function(path) unname(tools::sha256sum(path))
file_bytes <- function(path) as.numeric(unname(file.info(path)[["size"]]))

null_if_na <- function(value) {
  if (length(value) == 0L || is.na(value) || !is.finite(value)) return(NULL)
  value
}

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

# run pdftotext -layout and return the text lines.
pdf_layout_lines <- function(pdf_path) {
  pdftotext <- Sys.which("pdftotext")
  if (!nzchar(pdftotext)) stop("pdftotext (poppler) is required", call. = FALSE)
  layout_path <- tempfile(fileext = ".txt")
  on.exit(unlink(layout_path), add = TRUE)
  status <- system2(pdftotext, c("-layout", shQuote(pdf_path), shQuote(layout_path)))
  if (status != 0L) stop("pdftotext failed on ", pdf_path, call. = FALSE)
  readLines(layout_path, warn = FALSE)
}

# collapse a kerned category label ("TOT AL", "SEVENT H DAY") to compare names.
collapse_label <- function(x) toupper(gsub("\\s+", "", x))

# parse Table 7.0 (population by sex, age group and religion) from a census
# report: return the grand TOTAL, NONE, NOT STATED, and the summed named-
# religion affiliation. the header also appears in the table of contents, so
# every occurrence is tried and the first whose data region carries the grand
# TOTAL and a NONE row wins. category labels wrap and collide across reports
# (two rows reduce to "DENOMINATION"), so affiliation sums the row list rather
# than a deduped set; only TOTAL/NONE/NOT STATED are read by name.
parse_religion <- function(pdf_path) {
  txt <- pdf_layout_lines(pdf_path)
  up <- toupper(txt)
  heads <- which(grepl("TOTAL POPULATION", up) & grepl("AND RELIGION", up))
  if (length(heads) < 1L) stop("no religion table header in ", pdf_path, call. = FALSE)

  # a data row: a text label then >=8 integer columns (total + age groups)
  row_pat <- "^\\s*([A-Za-z'()./,& -]+?)\\s+((?:[0-9][0-9,]*)(?:\\s+[0-9][0-9,]*){7,})\\s*$"

  for (start in heads) {
    racial <- which(grepl("RACIAL GROUP", up))
    end <- racial[racial > start][1]
    if (is.na(end)) end <- length(txt) + 1L
    region <- txt[start:(end - 1L)]

    labels <- character(0)
    values <- numeric(0)
    for (line in region) {
      m <- regmatches(line, regexec(row_pat, line, perl = TRUE))[[1]]
      if (length(m) != 3L) next
      label <- collapse_label(m[2])
      if (label %in% c("MALE", "FEMALE")) next
      first_num <- as.numeric(gsub(",", "", strsplit(trimws(m[3]), "\\s+")[[1]][1]))
      labels <- c(labels, label)
      values <- c(values, first_num)
    }
    if ("TOTAL" %in% labels && "NONE" %in% labels) {
      total <- values[match("TOTAL", labels)]
      none <- values[match("NONE", labels)]
      ns_idx <- match("NOTSTATED", labels)
      not_stated <- if (is.na(ns_idx)) 0 else values[ns_idx]
      special <- labels %in% c("TOTAL", "NONE", "NOTSTATED")
      affiliation <- sum(values[!special])
      return(list(total = total, none = none, not_stated = not_stated,
                  affiliation = affiliation))
    }
  }
  stop("no religion data region with TOTAL and NONE in ", pdf_path, call. = FALSE)
}

# metric CRS for area computation; Lambert azimuthal equal area centred on the
# archipelago keeps every island true.
bahamas_laea <- "+proj=laea +lat_0=24.5 +lon_0=-76 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"

# dissolve the geoBoundaries ADM1 district layer up to the eighteen census
# islands, one multipolygon per island with land area from the metric CRS.
build_island_boundary <- function(path) {
  gb <- st_read(path, quiet = TRUE)
  if (nrow(gb) != 32L) stop("expected 32 geoBoundaries BHS ADM1 districts", call. = FALSE)
  gb <- st_make_valid(gb)
  gb[["shapeName"]] <- as.character(gb[["shapeName"]])

  # map every district to its island; a district assigned to no island, or to
  # more than one, fails loudly so the mapping stays exhaustive and disjoint.
  district_to_island <- character(0)
  for (isl in islands) {
    for (d in isl[["districts"]]) {
      if (d %in% names(district_to_island)) {
        stop("district assigned to two islands: ", d, call. = FALSE)
      }
      district_to_island[[d]] <- isl[["key"]]
    }
  }
  unmapped <- setdiff(gb[["shapeName"]], names(district_to_island))
  if (length(unmapped) > 0L) {
    stop("districts not mapped to an island: ", paste(unmapped, collapse = "; "), call. = FALSE)
  }
  extra <- setdiff(names(district_to_island), gb[["shapeName"]])
  if (length(extra) > 0L) {
    stop("island mapping names districts absent from geoBoundaries: ",
         paste(extra, collapse = "; "), call. = FALSE)
  }

  gb[["island_key"]] <- unname(district_to_island[gb[["shapeName"]]])
  gb_metric <- st_transform(gb, bahamas_laea)

  keys <- vapply(islands, function(i) i[["key"]], character(1))
  names <- vapply(islands, function(i) i[["name"]], character(1))
  geoms <- vector("list", length(keys))
  areas <- numeric(length(keys))
  for (i in seq_along(keys)) {
    parts <- gb_metric[gb_metric[["island_key"]] == keys[i], ]
    dissolved <- st_union(parts)
    areas[i] <- as.numeric(st_area(dissolved)) / 1e6
    geoms[[i]] <- st_transform(dissolved, 4326)
  }
  out <- st_sf(
    area_code = keys,
    area_name = names,
    area_unit_id = paste0(boundary_set_id, ":", keys),
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    land_area_sq_km = round(areas, 2),
    # one sfg per island: c() would concatenate the sfg list into a single
    # union geometry that st_sf silently recycles across every row.
    geometry = do.call(st_sfc, c(lapply(geoms, function(g) st_geometry(g)[[1]]),
                                 list(crs = 4326)))
  )
  out <- st_make_valid(out)
  out
}

# write the boundary with mapshaper's topology-preserving simplification.
write_simplified_boundary <- function(boundary, output_path, field_names) {
  boundary_fields <- boundary[, field_names]
  tmp_input <- tempfile(fileext = ".geojson")
  on.exit(unlink(tmp_input), add = TRUE)
  npm_cache <- tempfile("npm-cache-")
  dir.create(npm_cache, showWarnings = FALSE, recursive = TRUE)
  on.exit(unlink(npm_cache, recursive = TRUE), add = TRUE)
  st_write(boundary_fields, tmp_input, driver = "GeoJSON", delete_dsn = TRUE,
           quiet = TRUE, layer_options = c("COORDINATE_PRECISION=5"))

  # 3% remains above the byte ceiling after dissolving the full source, so 2.5%
  # is the final fallback while still retaining more vertices than the old layer.
  keep_percentages <- c(40, 30, 20, 15, 10, 7, 5, 3, 2.5)
  method <- "mapshaper weighted keep-shapes"
  clean_option <- "allow-overlaps"
  for (keep_percent in keep_percentages) {
    unlink(output_path)
    status <- system2(
      "npx",
      c(
        "--yes", "mapshaper", tmp_input,
        "-simplify", "weighted", "keep-shapes", sprintf("%g%%", keep_percent),
        "-clean", clean_option,
        "-o", "precision=0.00001", "format=geojson", output_path
      ),
      env = paste0("NPM_CONFIG_CACHE=", npm_cache)
    )
    if (status != 0L || !file.exists(output_path)) {
      stop("mapshaper simplification failed at ", keep_percent, "%", call. = FALSE)
    }
    # mapshaper output is trusted but verified; the old sf ladder had this guard.
    written <- st_read(output_path, quiet = TRUE)
    written_valid <- st_is_valid(written)
    if (any(st_is_empty(written)) || any(is.na(written_valid)) || any(!written_valid)) {
      stop("mapshaper simplification produced empty or invalid BS geometries", call. = FALSE)
    }
    bytes <- file_bytes(output_path)
    # the archipelago's thousands of cays need mapshaper's weighted
    # Visvalingam path: it preserves coastline character at the same byte size
    # better than a metre tolerance over dissolved island polygons. allow-overlaps
    # stops clean from treating sea gaps between separate islands as errors.
    if (bytes <= 3000000L) {
      return(list(method = method, clean_option = clean_option,
                  keep_percent = keep_percent, bytes = bytes))
    }
  }
  stop("mapshaper-simplified BS island boundary remains above 3 MB", call. = FALSE)
}

# build one schema-shaped area-summary row (2010, percent + count).
build_area_row <- function(area_code, area_name, area_unit_id, land_area_sq_km,
                           population_total, affiliation_count, affiliation_percent,
                           no_religion_count, no_religion_percent, quality_flag) {
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = area_unit_id,
    area_code = as.character(area_code),
    area_name = area_name,
    year = 2010L,
    population_total = null_if_na(as.integer(population_total)),
    population_total_basis = paste(
      "island total population from the report's Table 7.0 religion tabulation",
      "(equals the enumerated island population); the stated-response denominator",
      "for the percentages excludes the not-stated count"
    ),
    religious_affiliation_count = null_if_na(as.integer(affiliation_count)),
    religious_affiliation_percent = null_if_na(affiliation_percent),
    no_religion_count = null_if_na(as.integer(no_religion_count)),
    no_religion_percent = null_if_na(no_religion_percent),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(land_area_sq_km, 2),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = c(census_2010_dataset_id, national_2010_dataset_id, boundary_dataset_id),
    quality_flag = quality_flag
  )
}

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

source_datasets <- function() {
  list(
    list(
      source_dataset_id = census_2010_dataset_id,
      name = "BNSI 2010 Census island reports (eighteen volumes), Table 7.0: total population by sex, age group and religion",
      provider = "Bahamas National Statistical Institute (BNSI)",
      url = paste0(island_report_base_url, "NEW-PROVIDENCE-2010-CENSUS-REPORT.pdf"),
      retrieval_date = retrieval_date,
      local_path = file.path(raw_dir, "bs_2010_new_providence.pdf"),
      licence = list(
        name = "BNSI census reports, open download; no explicit reuse licence stated",
        url = census_landing_url,
        attribution = "Bahamas National Statistical Institute (BNSI)"
      ),
      citation = "Bahamas National Statistical Institute, 2010 Census of Population and Housing, island reports (eighteen volumes), Table 7.0.",
      access_limits = NULL,
      redistribution_limits = "The census PDFs are not committed; the derived public product attributes BNSI and links the source.",
      notes = paste(
        "Each island report prints Table 7.0 (total population by sex, age group and religion) for that island.",
        "The two headline metrics need each island's grand TOTAL, NONE and NOT STATED rows; smaller islands collapse",
        "minor denominations into an OTHER category (Lutheran, Methodist, Presbyterian, Judaism), which does not",
        "affect religious affiliation (every named religion) or no religion (the NONE category). Each report's named",
        "religions plus NONE plus NOT STATED reconcile exactly to its island total, and the eighteen islands reconcile",
        "exactly to the national First Release Report (total 351,461; none 6,561; not stated 9,050)."
      )
    ),
    list(
      source_dataset_id = national_2010_dataset_id,
      name = "BNSI 2010 Census First Release Report, Table 7.0: total population by sex, age group and religion (All Bahamas)",
      provider = "Bahamas National Statistical Institute (BNSI)",
      url = first_release_2010_url,
      retrieval_date = retrieval_date,
      local_path = national_2010_path,
      licence = list(
        name = "BNSI census report, open download; no explicit reuse licence stated",
        url = census_landing_url,
        attribution = "Bahamas National Statistical Institute (BNSI)"
      ),
      citation = "Bahamas National Statistical Institute, 2010 Census First Release Report, Table 7.0 (All Bahamas).",
      access_limits = NULL,
      redistribution_limits = "The census PDF is not committed; the derived public product attributes BNSI and links the source.",
      notes = "National reconciliation authority: the eighteen island Table 7.0 values sum exactly to this All Bahamas table for total, no religion, not stated and affiliation."
    ),
    list(
      source_dataset_id = national_2022_dataset_id,
      name = "BNSI 2022 Census First Release Report, Table 6.0: leading religious denominations (All Bahamas, 2022 with 2010 comparison)",
      provider = "Bahamas National Statistical Institute (BNSI)",
      url = first_release_2022_url,
      retrieval_date = retrieval_date,
      local_path = national_2022_path,
      licence = list(
        name = "BNSI census report, open download; no explicit reuse licence stated",
        url = "https://www.bnsi.stats.gov.bs/population-census",
        attribution = "Bahamas National Statistical Institute (BNSI)"
      ),
      citation = "Bahamas National Statistical Institute, 2022 Census of Population and Housing First Release Report, Table 6.0 (All Bahamas).",
      access_limits = NULL,
      redistribution_limits = "Recorded as national context only. The 2022 census states plainly that religion is reported by age group and sex for All Bahamas, so no 2022 subnational religion table exists to map.",
      notes = paste(
        "National context, not a map layer. 2022 All Bahamas total 398,165; leading denominations Baptist 135,875,",
        "Anglican 47,456, Other Christian/Non-Denominational 35,296, Roman Catholic 34,749; none 24,677; not stated 19,075.",
        "The report states religion (and other topics) are reported by age group and sex for All Bahamas only, so 2022",
        "cannot be mapped subnationally. A BNSI data request should ask for the 2022 religion tabulation by island",
        "(and by supervisory district), the geography the 2022 population tables already use."
      )
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "geoBoundaries BHS ADM1 (32 local government districts)",
      provider = "geoBoundaries (William & Mary geoLab)",
      url = geoboundaries_gj_url,
      retrieval_date = retrieval_date,
      local_path = geoboundaries_path,
      licence = list(
        name = "Creative Commons Attribution 4.0 International (CC BY 4.0); boundary source recorded by geoBoundaries as the Caribbean GeoPortal",
        url = geoboundaries_meta_url,
        attribution = "geoBoundaries (gbOpen); boundary source Caribbean GeoPortal"
      ),
      citation = "Runfola et al., geoBoundaries BHS ADM1 (gbOpen), district boundaries.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary is committed with CC BY 4.0 attribution to geoBoundaries and the Caribbean GeoPortal.",
      notes = paste(
        "32 ADM1 local government districts, dissolved to the eighteen census islands the 2010 reports use.",
        "The gbOpen metadata records the boundary source field as 'Haiti GeoPortal', which appears to be a metadata",
        "error; the boundarySourceURL resolves to the Caribbean GeoPortal (haiti.caribbeangeoportal.com/datasets/caribgeoportal).",
        "Source data update 2023-01-19."
      )
    )
  )
}

denominator_note <- paste(
  "2010 percentages use the stated-response denominator (island total population",
  "minus the not-stated count). Religious affiliation is every named religion",
  "(the report's denominations plus its OTHER category); no religion is the",
  "NONE category. Affiliation and no religion sum to 100 percent of stated",
  "responses. Counts are the exact figures printed in each island report's Table 7.0."
)

indicators_for_island <- function() {
  list(
    list(
      indicator_id = "population_total",
      label = "Census population",
      description = "Island total population from the 2010 report's Table 7.0 religion tabulation.",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "Grand TOTAL row of each island's Table 7.0.",
      temporal_coverage = "2010",
      spatial_coverage = "Bahamas census islands (geoBoundaries ADM1 districts dissolved to islands).",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious affiliation %",
      description = "Share of stated responses declaring any named religion.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * (island total - none - not stated) / (island total - not stated).",
      temporal_coverage = "2010",
      spatial_coverage = "Bahamas census islands.",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "No religion %",
      description = "Share of stated responses reporting no religion (the NONE category).",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * none / (island total - not stated).",
      temporal_coverage = "2010",
      spatial_coverage = "Bahamas census islands.",
      quality_notes = denominator_note
    )
  )
}

visual_layers_for_island <- function() {
  list(
    list(
      visual_layer_id = "bs-island-religious-affiliation",
      label = "Religious affiliation %",
      description = "Bahamas census 2010 religious-affiliation share by island.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "stated responses in the census religion tabulation"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = "All named religions count as religious affiliation."
    ),
    list(
      visual_layer_id = "bs-island-no-religion",
      label = "No religion %",
      description = "Bahamas census 2010 no-religion share by island.",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "stated responses in the census religion tabulation"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = "The NONE category of each island's Table 7.0."
    )
  )
}

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
      vintage = "2020",
      source_dataset_id = boundary_dataset_id
    ),
    site_snapshot = list(
      source_dataset_id = NULL,
      snapshot_date = NULL,
      basis = "no governed Bahamas OpenStreetMap place-of-worship snapshot is included in this country data-map release",
      notes = "The Bahamas page exposes census religious-affiliation and no-religion metrics only; place-density metrics are hidden until a governed Bahamas place layer is built."
    ),
    source_datasets = source_datasets(),
    indicators = indicators_for_island(),
    visual_layers = visual_layers_for_island(),
    rows = rows
  )
}

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

raw_source_record <- function(path, url, format, row_count, source_id, used, periods, notes) {
  list(
    uri = path, url = url, format = format,
    bytes = if (file.exists(path)) file_bytes(path) else NULL,
    sha256 = if (file.exists(path)) sha256_file(path) else NULL,
    row_count = row_count, source_dataset_id = source_id,
    used_in_public_product = used, periods = periods, notes = notes
  )
}

# ---- require raw sources ----
island_paths <- vapply(islands, function(i) file.path(raw_dir, i[["file"]]), character(1))
required_sources <- c(geoboundaries_path, national_2010_path, island_paths)
invisible(lapply(required_sources, require_file))

# ---- parse island religion and reconcile ----
parsed <- lapply(islands, function(isl) {
  h <- parse_religion(file.path(raw_dir, isl[["file"]]))
  # each island reconciles internally: named religions + none + not stated = total
  if (h[["affiliation"]] + h[["none"]] + h[["not_stated"]] != h[["total"]]) {
    stop("island ", isl[["key"]], " Table 7.0 does not reconcile internally", call. = FALSE)
  }
  h
})
names(parsed) <- vapply(islands, function(i) i[["key"]], character(1))

# the eighteen islands must sum exactly to the national First Release table.
sum_total <- sum(vapply(parsed, function(p) p[["total"]], numeric(1)))
sum_none <- sum(vapply(parsed, function(p) p[["none"]], numeric(1)))
sum_ns <- sum(vapply(parsed, function(p) p[["not_stated"]], numeric(1)))
sum_aff <- sum(vapply(parsed, function(p) p[["affiliation"]], numeric(1)))
if (sum_total != national_2010[["total"]]) stop("island totals do not sum to the national total", call. = FALSE)
if (sum_none != national_2010[["none"]]) stop("island none do not sum to the national none", call. = FALSE)
if (sum_ns != national_2010[["not_stated"]]) stop("island not-stated do not sum to the national not-stated", call. = FALSE)
if (sum_aff != national_2010[["affiliation"]]) stop("island affiliation do not sum to the national affiliation", call. = FALSE)

# ---- boundary ----
boundary <- build_island_boundary(geoboundaries_path)
if (nrow(boundary) != length(islands)) stop("island boundary count mismatch", call. = FALSE)
boundary_write <- write_simplified_boundary(
  boundary, boundary_out,
  c("area_code", "area_name", "area_unit_id", "boundary_set_id", "boundary_level", "land_area_sq_km")
)
if (row_count_file(boundary_out) != nrow(boundary)) {
  stop("island boundary feature count changed during simplification", call. = FALSE)
}

# ---- assemble rows in area-name order ----
flag_2010 <- paste(
  "stated_response_denominator_excludes_not_stated",
  "named_religions_in_religious_affiliation",
  "none_category_is_no_religion",
  "island_reports_reconcile_to_national_first_release",
  sep = ";"
)

order_idx <- order(vapply(islands, function(i) i[["name"]], character(1)))
rows <- list()
for (i in order_idx) {
  isl <- islands[[i]]
  p <- parsed[[isl[["key"]]]]
  b <- match(isl[["key"]], boundary[["area_code"]])
  stated <- p[["total"]] - p[["not_stated"]]
  rows[[length(rows) + 1L]] <- build_area_row(
    area_code = boundary[["area_code"]][b],
    area_name = boundary[["area_name"]][b],
    area_unit_id = boundary[["area_unit_id"]][b],
    land_area_sq_km = boundary[["land_area_sq_km"]][b],
    population_total = p[["total"]],
    affiliation_count = p[["affiliation"]],
    affiliation_percent = round(100 * p[["affiliation"]] / stated, 2),
    no_religion_count = p[["none"]],
    no_religion_percent = round(100 * p[["none"]] / stated, 2),
    quality_flag = flag_2010
  )
}

write_json(area_summary_document(rows), summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

join_coverage <- list(list(
  boundary_level = boundary_level, year = 2010L,
  matched_area_count = length(islands), expected_area_count = nrow(boundary),
  missing_area_names = list()
))

national_stated <- national_2010[["total"]] - national_2010[["not_stated"]]
national_reconciliation <- list(
  list(year = 2010L, metric = "population_total", area_sum = sum_total,
       national_total = national_2010[["total"]], difference = sum_total - national_2010[["total"]]),
  list(year = 2010L, metric = "religious_affiliation_count", area_sum = sum_aff,
       national_total = national_2010[["affiliation"]], difference = sum_aff - national_2010[["affiliation"]]),
  list(year = 2010L, metric = "no_religion_count", area_sum = sum_none,
       national_total = national_2010[["none"]], difference = sum_none - national_2010[["none"]]),
  list(year = 2010L, metric = "not_stated_count", area_sum = sum_ns,
       national_total = national_2010[["not_stated"]], difference = sum_ns - national_2010[["not_stated"]])
)

validation_checks <- c(
  "Each of the eighteen BNSI 2010 island reports prints Table 7.0 (total population by sex, age group and religion), parsed with pdftotext -layout.",
  "Within each island report the named religions plus NONE plus NOT STATED reconcile exactly to the island total.",
  sprintf("The eighteen islands sum exactly to the national First Release Report Table 7.0: total %d, no religion %d, not stated %d, affiliation %d.",
          as.integer(national_2010[["total"]]), as.integer(national_2010[["none"]]),
          as.integer(national_2010[["not_stated"]]), as.integer(national_2010[["affiliation"]])),
  "Percentages use the stated-response denominator (island total minus not stated); religious affiliation and no religion sum to 100 percent of stated responses.",
  "The 32 geoBoundaries BHS ADM1 districts map disjointly and exhaustively onto the eighteen census islands; Rum Cay (no separate report) is dissolved into San Salvador, matching the census's historical San Salvador & Rum Cay unit.",
  sprintf("The dissolved island boundary GeoJSON writes to %d bytes after %s simplification at %g%% keep, cleaned with %s (18 island features).",
          as.integer(boundary_write[["bytes"]]), boundary_write[["method"]],
          boundary_write[["keep_percent"]], boundary_write[["clean_option"]]),
  "2022 religion is national only: the 2022 First Release states religion is reported by age group and sex for All Bahamas, so no 2022 subnational religion table exists to map. 2022 national figures are recorded as context."
)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:bs-census-religion:bs:2010:bnsi-island-reports",
  dataset_id = "bs-census-religion:bs:2010:bnsi-island-reports",
  dataset_version_id = paste0("bs-census-religion:bs:2010:bnsi-island-reports:", substr(sha256_file(summary_json_out), 1, 12)),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "bs-census-religion",
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
      waves = c("2010"),
      island_boundary_set = boundary_set_id,
      island_boundary_simplification = list(
        method = boundary_write[["method"]],
        clean_option = boundary_write[["clean_option"]],
        keep_percent = boundary_write[["keep_percent"]],
        bytes = boundary_write[["bytes"]]
      ),
      pdf_extraction = "poppler pdftotext -layout for Table 7.0 of each island report and the national First Release Report",
      denominator = "stated responses (island total minus not stated); affiliation = named religions, no religion = NONE",
      subnational_geography = "geoBoundaries BHS ADM1 (32 districts) dissolved to the eighteen census islands the 2010 reports use",
      omitted_metrics = c("religious_change", "places_per_10000_residents", "place_density_per_sq_km"),
      national_only_wave_2022 = "2022 religion is All Bahamas only; recorded as context, not mapped"
    ),
    software_versions = list(
      r = paste(R.version[["major"]], R.version[["minor"]], sep = "."),
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")),
      pdftotext = "poppler pdftotext (system)"
    )
  ),
  source = list(
    provider = "Bahamas National Statistical Institute (BNSI); geoBoundaries (William & Mary geoLab)",
    source_dataset_ids = c(census_2010_dataset_id, national_2010_dataset_id, national_2022_dataset_id, boundary_dataset_id),
    source_urls = c(census_landing_url, first_release_2010_url, first_release_2022_url, geoboundaries_meta_url, geoboundaries_gj_url),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = licence_text,
    citation = "BNSI, 2010 Census island reports, Table 7.0; BNSI, 2010 Census First Release Report, Table 7.0; geoBoundaries BHS ADM1 (gbOpen).",
    raw_redistribution = "The census PDFs and the geoBoundaries source GeoJSON are not committed. They remain in data/raw/bs_census/ and await any project-controlled raw archive upload."
  ),
  input_manifests = list(),
  raw_sources = c(
    lapply(islands, function(isl) {
      raw_source_record(
        file.path(raw_dir, isl[["file"]]),
        paste0(island_report_base_url, isl[["url"]]),
        "pdf", 1L, census_2010_dataset_id, TRUE, "2010",
        sprintf("2010 Census %s report; Table 7.0 supplies the island's total, none and not-stated religion counts.", isl[["name"]])
      )
    }),
    list(
      raw_source_record(national_2010_path, first_release_2010_url, "pdf", NA_integer_, national_2010_dataset_id, TRUE, "2010",
        "2010 Census First Release Report; Table 7.0 (All Bahamas) is the national reconciliation authority for the island sums."),
      raw_source_record(national_2022_path, first_release_2022_url, "pdf", NA_integer_, national_2022_dataset_id, FALSE, "2022",
        "2022 Census First Release Report; Table 6.0 (All Bahamas) religion, recorded as national context. Religion is reported by age and sex for All Bahamas only, so 2022 is not mapped."),
      raw_source_record(geoboundaries_path, geoboundaries_gj_url, "geojson", 32L, boundary_dataset_id, TRUE, "2020",
        "geoBoundaries BHS ADM1 GeoJSON; 32 local government districts, dissolved to the eighteen census islands. CC BY 4.0."),
      raw_source_record(geoboundaries_meta_path, geoboundaries_meta_url, "json", NA_integer_, boundary_dataset_id, FALSE, "2020",
        "geoBoundaries BHS ADM1 metadata; records the CC BY 4.0 licence. The boundarySource field reads 'Haiti GeoPortal' (apparent metadata error); the boundarySourceURL resolves to the Caribbean GeoPortal.")
    )
  ),
  durable_files = list(
    manifest_file_record(summary_json_out, "Bahamas island area summary with census 2010 religious-affiliation and no-religion metrics.", licence_status),
    manifest_file_record(summary_csv_out, "Flattened Bahamas island area summary with census 2010 religious-affiliation and no-religion metrics.", licence_status),
    manifest_file_record(boundary_out, "Simplified Bahamas island boundary GeoJSON derived from geoBoundaries BHS ADM1 (32 districts) dissolved to 18 islands.", "geoboundaries_cc_by_4_0")
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out),
         built_by = script_id, notes = "18 island reporting units x 1 census year (2010); stated-response denominator."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out),
         built_by = script_id, notes = sprintf("18 island features dissolved from 32 geoBoundaries BHS ADM1 districts, simplified with %s at %g%% keep and cleaned with %s.",
                                               boundary_write[["method"]], boundary_write[["keep_percent"]],
                                               boundary_write[["clean_option"]]))
  ),
  validation = list(
    checks = validation_checks,
    join_coverage = list(island = join_coverage),
    national_reconciliation = national_reconciliation,
    national_excluded_share_percent = round(100 * national_2010[["not_stated"]] / national_2010[["total"]], 2),
    boundary_validation = list(
      source_bs_district_count = 32L,
      dissolved_island_count = nrow(boundary),
      output_feature_count = row_count_file(boundary_out),
      expected_feature_count = nrow(boundary),
      output_bytes = boundary_write[["bytes"]],
      simplification_method = boundary_write[["method"]],
      simplification_clean_option = boundary_write[["clean_option"]],
      simplification_keep_percent = boundary_write[["keep_percent"]],
      unmatched_boundary_features = list(),
      unmatched_census_areas = list()
    )
  ),
  construct_notes = list(
    "The public map displays two headline metrics for 2010 at island level: religious affiliation percent and no religion percent.",
    "Percentages use the stated-response denominator: island total population minus the not-stated count. Religious affiliation is every named religion (each report's listed denominations plus its OTHER catch-all); no religion is the NONE category. The two shares sum to 100 percent of stated responses.",
    "Counts are the exact figures printed in each island report's Table 7.0. Smaller islands collapse minor denominations (Lutheran, Methodist, Presbyterian, Judaism) into OTHER, which does not affect either headline metric.",
    "The eighteen census islands are the geoBoundaries BHS ADM1 32 local government districts dissolved up to islands; each district belongs to exactly one island. Rum Cay carries no separate 2010 report and is tabulated with San Salvador (the census's historical San Salvador & Rum Cay unit).",
    "2022 religion is national only: the 2022 First Release Report states religion is reported by age group and sex for All Bahamas, so it cannot be mapped subnationally. 2022 national figures (Baptist 135,875; Anglican 47,456; Other Christian/Non-Denominational 35,296; Roman Catholic 34,749; none 24,677) are recorded as context."
  ),
  deferred_sources = list(
    list(
      source_dataset_id = "bnsi-2022-census-religion-by-island",
      url = "https://www.bnsi.stats.gov.bs/population-census",
      local_path = national_2022_path,
      notes = "The 2022 census publishes religion for All Bahamas only (by age and sex); no island or supervisory-district religion table is public. The 2022 First Release states 'more detailed Census data will be forthcoming'. A BNSI data request should ask for the 2022 religion tabulation by island and by supervisory district, the geography the 2022 population tables already use, which would add a mappable 2022 wave and a 2010-2022 change layer."
    ),
    list(
      source_dataset_id = "bnsi-2000-census-religion-by-island",
      url = census_landing_url,
      local_path = NULL,
      notes = "The 2010 First Release notes a 2000 census religion comparison at national level. A 2000 subnational religion wave was not located in this sweep; a 2000 island tabulation (if held by BNSI) is deferred."
    )
  ),
  privacy = "public",
  licence_status = licence_status,
  downstream_status = "public",
  source_datasets = source_datasets(),
  notes = "The committed products contain the derived island area summary and simplified boundary only. On-page attribution cites BNSI and geoBoundaries (CC BY 4.0, Caribbean GeoPortal)."
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
manifest_text <- paste(readLines(manifest_out, warn = FALSE), collapse = "\n")
if (!jsonlite::validate(manifest_text)) stop("manifest JSON failed jsonlite validation", call. = FALSE)

cat(sprintf("wrote %s: %d rows\n", summary_json_out, length(rows)))
cat(sprintf("wrote %s: %d rows\n", summary_csv_out, row_count_file(summary_csv_out)))
cat(sprintf("wrote %s: %d features, %d bytes with %s at %g%% keep, clean %s\n", boundary_out, row_count_file(boundary_out),
            as.integer(file_bytes(boundary_out)), boundary_write[["method"]], boundary_write[["keep_percent"]],
            boundary_write[["clean_option"]]))
cat(sprintf("wrote %s\n", manifest_out))
cat(sprintf("join coverage: %d/%d islands for 2010\n", length(islands), nrow(boundary)))
cat(sprintf("2010 national denominator: %d; stated: %d; affiliation: %d (%.2f%%); no religion: %d (%.2f%%); not stated: %d (%.2f%%)\n",
            as.integer(national_2010[["total"]]), as.integer(national_stated),
            as.integer(national_2010[["affiliation"]]), 100 * national_2010[["affiliation"]] / national_stated,
            as.integer(national_2010[["none"]]), 100 * national_2010[["none"]] / national_stated,
            as.integer(national_2010[["not_stated"]]), 100 * national_2010[["not_stated"]] / national_2010[["total"]]))
cat("national reconciliation: exact for total, affiliation, no religion, and not stated\n")
