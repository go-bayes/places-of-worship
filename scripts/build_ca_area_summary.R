# build the canada area-summary products from Statistics Canada religion data.
# inputs: data/raw/ca_census profile, tabulation, and boundary downloads.
# outputs: apps/regions/ca/data area summaries and vintage boundary GeoJSON,
# plus docs/manifests/ca-census-religion-2001-2021.json.
# run from the repo root: Rscript scripts/build_ca_area_summary.R

suppressMessages({
  library(sf)
  library(jsonlite)
  library(xml2)
})

repo_root <- normalizePath(
  if (basename(getwd()) == "scripts") ".." else ".",
  mustWork = TRUE
)

raw_dir_rel <- "data/raw/ca_census"
ca_dir_rel <- "apps/regions/ca/data"
manifest_dir_rel <- "docs/manifests"

raw_dir <- file.path(repo_root, raw_dir_rel)
ca_dir <- file.path(repo_root, ca_dir_rel)
manifest_dir <- file.path(repo_root, manifest_dir_rel)
dir.create(ca_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

retrieval_date <- "2026-07-07"

source_url_2021_pr <- paste0(
  "https://www12.statcan.gc.ca/census-recensement/2021/dp-pd/prof/",
  "details/download-telecharger/comp_download.cfm?",
  "Lang=E&T=1&Geo1=PR&Code1=01&SearchText=Canada&SearchType=Begins",
  "&GENDERlist=1,2,3&STATISTIClist=1&HEADERlist=0&GEONO=001"
)
source_url_2021_csd <- paste0(
  "https://www12.statcan.gc.ca/census-recensement/2021/dp-pd/prof/",
  "details/download-telecharger/comp/GetFile.cfm?",
  "Lang=E&FILETYPE=CSV&GEONO=005"
)
source_url_2011_pr <- paste0(
  "https://www12.statcan.gc.ca/nhs-enm/2011/dp-pd/prof/details/",
  "download-telecharger/comprehensive/comp_download.cfm?",
  "CTLG=99-004-XWE2011001&FMT=CSV101&Lang=E&Geo1=PR&Code1=01",
  "&Data=Count&SearchText=&SearchType=Begins&SearchPR=01&A1=All",
  "&B1=All&Custom=&TABID=1"
)
source_url_2011_csd <- paste0(
  "https://www12.statcan.gc.ca/nhs-enm/2011/dp-pd/prof/details/",
  "download-telecharger/comprehensive/comp_download.cfm?",
  "CTLG=99-004-XWE2011001&FMT=CSV301&Lang=E&Geo1=PR&Code1=01",
  "&Data=Count&SearchText=&SearchType=Begins&SearchPR=01&A1=All",
  "&B1=All&Custom=&TABID=1"
)
source_url_2011_cd <- paste0(
  "https://www12.statcan.gc.ca/nhs-enm/2011/dp-pd/prof/details/",
  "download-telecharger/comprehensive/comp_download.cfm?",
  "CTLG=99-004-XWE2011001&FMT=CSV701&Lang=E&Geo1=PR&Code1=01",
  "&Data=Count&SearchText=&SearchType=Begins&SearchPR=01&A1=All",
  "&B1=All&Custom=&TABID=1"
)
source_url_2001_table <- paste0(
  "https://www12.statcan.gc.ca/open-gc-ouvert/2001/",
  "95F0450XCB2001006.ZIP"
)
source_url_2021_csd_boundary <- paste0(
  "https://www12.statcan.gc.ca/census-recensement/2021/geo/sip-pis/",
  "boundary-limites/files-fichiers/lcsd000a21a_e.zip"
)
source_url_2021_cd_boundary <- paste0(
  "https://www12.statcan.gc.ca/census-recensement/2021/geo/sip-pis/",
  "boundary-limites/files-fichiers/lcd_000a21a_e.zip"
)
source_url_2011_csd_boundary <- paste0(
  "https://www12.statcan.gc.ca/census-recensement/2011/geo/bound-limit/",
  "files-fichiers/gcsd000b11a_e.zip"
)
source_url_2011_cd_boundary <- paste0(
  "https://www12.statcan.gc.ca/census-recensement/2011/geo/bound-limit/",
  "files-fichiers/gcd_000b11a_e.zip"
)
source_url_2001_cd_boundary <- paste0(
  "https://www12.statcan.gc.ca/census-recensement/2011/geo/bound-limit/",
  "files-fichiers/gcd_000b01a_e.zip"
)
licence_url <- "https://www.statcan.gc.ca/en/reference/licence"

zip_2021_pr <- "98-401-X2021001_eng_CSV.zip"
zip_2021_csd <- "98-401-X2021005_eng_CSV.zip"
zip_2011_pr <- "99-004-XWE2011001-101_CSV.zip"
zip_2011_csd <- "99-004-XWE2011001-301_CSV.zip"
zip_2011_cd <- "99-004-XWE2011001-701_CSV.zip"
zip_2001_xml <- "95F0450XCB2001006_XML.zip"
zip_2021_boundary <- "lcsd000a21a_e.zip"
zip_2021_cd_boundary <- "lcd_000a21a_e.zip"
zip_2011_boundary <- "gcsd000b11a_e.zip"
zip_2011_cd_boundary <- "gcd_000b11a_e.zip"
zip_2001_boundary <- "gcd_000b01a_e.zip"

path_2021_pr <- file.path(raw_dir, zip_2021_pr)
path_2021_csd <- file.path(raw_dir, zip_2021_csd)
path_2011_pr <- file.path(raw_dir, zip_2011_pr)
path_2011_csd <- file.path(raw_dir, zip_2011_csd)
path_2011_cd <- file.path(raw_dir, zip_2011_cd)
path_2001_xml <- file.path(raw_dir, zip_2001_xml)
path_2021_boundary <- file.path(raw_dir, zip_2021_boundary)
path_2021_cd_boundary <- file.path(raw_dir, zip_2021_cd_boundary)
path_2011_boundary <- file.path(raw_dir, zip_2011_boundary)
path_2011_cd_boundary <- file.path(raw_dir, zip_2011_cd_boundary)
path_2001_boundary <- file.path(raw_dir, zip_2001_boundary)
sources_csv_rel <- file.path(raw_dir_rel, "sources.csv")
sources_csv <- file.path(repo_root, sources_csv_rel)

summary_2021_json_rel <- file.path(ca_dir_rel, "area_summary_cd_2021.json")
summary_2021_csv_rel <- file.path(ca_dir_rel, "area_summary_cd_2021.csv")
boundary_2021_rel <- file.path(ca_dir_rel, "cd_2021.geojson")
summary_2011_json_rel <- file.path(ca_dir_rel, "area_summary_cd_2011.json")
summary_2011_csv_rel <- file.path(ca_dir_rel, "area_summary_cd_2011.csv")
boundary_2011_rel <- file.path(ca_dir_rel, "cd_2011.geojson")
summary_2001_json_rel <- file.path(ca_dir_rel, "area_summary_cd_2001.json")
summary_2001_csv_rel <- file.path(ca_dir_rel, "area_summary_cd_2001.csv")
boundary_2001_rel <- file.path(ca_dir_rel, "cd_2001.geojson")
manifest_out_rel <- file.path(manifest_dir_rel, "ca-census-religion-2001-2021.json")

summary_2021_json <- file.path(repo_root, summary_2021_json_rel)
summary_2021_csv <- file.path(repo_root, summary_2021_csv_rel)
boundary_2021_out <- file.path(repo_root, boundary_2021_rel)
summary_2011_json <- file.path(repo_root, summary_2011_json_rel)
summary_2011_csv <- file.path(repo_root, summary_2011_csv_rel)
boundary_2011_out <- file.path(repo_root, boundary_2011_rel)
summary_2001_json <- file.path(repo_root, summary_2001_json_rel)
summary_2001_csv <- file.path(repo_root, summary_2001_csv_rel)
boundary_2001_out <- file.path(repo_root, boundary_2001_rel)
manifest_out <- file.path(repo_root, manifest_out_rel)

dataset_id_2021_csd <- "statcan-2021-census-profile-religion-csd"
dataset_id_2021_cd <- "statcan-2021-census-profile-religion-cd"
dataset_id_2021_pr <- "statcan-2021-census-profile-religion-pr"
dataset_id_2011_csd <- "statcan-2011-nhs-profile-religion-csd"
dataset_id_2011_cd <- "statcan-2011-nhs-profile-religion-cd"
dataset_id_2011_pr <- "statcan-2011-nhs-profile-religion-pr"
dataset_id_2001_cd <- "statcan-2001-census-religion-age-95f0450xcb2001006"
dataset_id_2021_boundary <- "statcan-2021-csd-cartographic-boundary"
dataset_id_2021_cd_boundary <- "statcan-2021-cd-cartographic-boundary"
dataset_id_2011_boundary <- "statcan-2011-csd-cartographic-boundary"
dataset_id_2011_cd_boundary <- "statcan-2011-cd-cartographic-boundary"
dataset_id_2001_boundary <- "statcan-2001-cd-cartographic-boundary"

boundary_tolerance_floor_m <- 40
boundary_tolerance_cap_m <- 1500
boundary_tolerance_base_factor <- 0.008
boundary_tolerance_scale <- 1.3
boundary_max_simplification_iterations <- 4L
boundary_coordinate_precision <- 4L
boundary_size_budget_bytes <- 4 * 1024 * 1024
boundary_ring_guard_min_points <- 8L
boundary_analysis_crs <- 3347

rounding_base <- 10L
expected_subnational_units <- 13L
subnational_2021_levels <- c("Province", "Territory")

population_total_basis_2021 <- paste(
  "total responses for religion for the population in private households,",
  "25% sample data, Census Profile 2021"
)
population_total_basis_2011 <- paste(
  "total responses for religion for the population in private households,",
  "voluntary National Household Survey 2011"
)
population_total_basis_2001 <- paste(
  "total responses for religion, total age groups, 20% sample data,",
  "2001 Census topic-based tabulation 95F0450XCB2001006"
)

# stop early if a required raw source has not been downloaded.
require_file <- function(path) {
  if (!file.exists(path)) stop("missing required source: ", path, call. = FALSE)
}

# compute the sha-256 digest for a local file.
sha256_file <- function(path) {
  unname(tools::sha256sum(path))
}

# return file size in bytes for generated-output records.
file_bytes <- function(path) {
  unname(file.info(path)[["size"]])
}

# count data rows or features for manifest and QA records.
row_count_file <- function(path) {
  if (grepl("[.]csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("[.]geojson$", path)) {
    geo <- fromJSON(path, simplifyVector = FALSE)
    return(length(geo[["features"]]))
  }
  if (grepl("[.]json$", path)) {
    json <- fromJSON(path, simplifyVector = FALSE)
    if (!is.null(json[["rows"]])) return(length(json[["rows"]]))
  }
  NA_integer_
}

# coerce published counts while keeping suppressed or blank cells missing.
numeric_count <- function(x) {
  suppressWarnings(as.numeric(gsub(",", "", x, fixed = TRUE)))
}

# normalise source text before writing JSON artefacts.
utf8_text <- function(x) {
  iconv(x, from = "", to = "UTF-8", sub = "byte")
}

# read one zip member after filtering large text files to target lines.
read_filtered_zip_lines <- function(zip_path, member, keep_line) {
  con <- unz(zip_path, member, open = "rt")
  on.exit(close(con), add = TRUE)
  header <- readLines(con, n = 1L, warn = FALSE)
  kept <- character()
  repeat {
    chunk <- readLines(con, n = 50000L, warn = FALSE)
    if (!length(chunk)) break
    kept <- c(kept, chunk[keep_line(chunk)])
  }
  if (!length(kept)) {
    stop("no target rows found in ", basename(zip_path), " member ", member, call. = FALSE)
  }
  list(header = header, lines = kept)
}

# read one csv zip member after filtering large files to target lines.
read_filtered_zip_csv <- function(zip_path, member, keep_line) {
  filtered <- read_filtered_zip_lines(zip_path, member, keep_line)
  text_lines <- iconv(c(filtered[["header"]], filtered[["lines"]]), from = "", to = "UTF-8", sub = "byte")
  read.csv(
    text = paste(text_lines, collapse = "\n"),
    stringsAsFactors = FALSE,
    check.names = FALSE,
    colClasses = "character"
  )
}

# read a complete small csv member from a zip as character columns.
read_zip_csv <- function(zip_path, member) {
  read.csv(
    unz(zip_path, member),
    stringsAsFactors = FALSE,
    check.names = FALSE,
    colClasses = "character"
  )
}

# return the first zip member whose name matches a regular expression.
zip_member <- function(zip_path, pattern) {
  listing <- utils::unzip(zip_path, list = TRUE)
  matches <- listing[["Name"]][grepl(pattern, listing[["Name"]])]
  if (length(matches) != 1L) {
    stop("expected one zip member matching ", pattern, " in ", basename(zip_path), call. = FALSE)
  }
  matches[[1]]
}

# extract 2021 profile rows for total religion and no religion.
read_2021_counts <- function(zip_path, member, level_filter = NULL) {
  keep_line <- function(lines) {
    grepl(
      ',1949,"Total - Religion for the population in private households - 25% sample data"',
      lines,
      fixed = TRUE,
      useBytes = TRUE
    ) |
      grepl(',1973,"  No religion and secular perspectives"', lines, fixed = TRUE, useBytes = TRUE)
  }
  data <- read_filtered_zip_csv(zip_path, member, keep_line)
  if (!is.null(level_filter)) data <- data[data[["GEO_LEVEL"]] %in% level_filter, , drop = FALSE]
  total <- data[data[["CHARACTERISTIC_ID"]] == "1949", , drop = FALSE]
  none <- data[data[["CHARACTERISTIC_ID"]] == "1973", , drop = FALSE]
  index <- match(total[["DGUID"]], none[["DGUID"]])
  if (anyNA(index)) stop("2021 religion rows are incomplete", call. = FALSE)

  out <- data.frame(
    code = total[["DGUID"]],
    alt_code = total[["ALT_GEO_CODE"]],
    name = total[["GEO_NAME"]],
    geo_level = total[["GEO_LEVEL"]],
    province_code = ifelse(
      total[["GEO_LEVEL"]] %in% c("Census subdivision", "Census division"),
      substr(total[["ALT_GEO_CODE"]], 1L, 2L),
      total[["ALT_GEO_CODE"]]
    ),
    total = numeric_count(total[["C1_COUNT_TOTAL"]]),
    no_religion = numeric_count(none[["C1_COUNT_TOTAL"]][index]),
    source_quality_flag = total[["DATA_QUALITY_FLAG"]],
    stringsAsFactors = FALSE
  )
  out[["religious_affiliation"]] <- out[["total"]] - out[["no_religion"]]
  out
}

# parse one filtered 2011 NHS profile religion line.
parse_2011_line <- function(line, geography) {
  split_line <- strsplit(line, ",Religion,", fixed = TRUE, useBytes = TRUE)[[1]]
  if (length(split_line) != 2L) stop("could not parse 2011 religion line", call. = FALSE)
  prefix_parts <- strsplit(split_line[[1]], ",", fixed = TRUE, useBytes = TRUE)[[1]]
  tail_parts <- strsplit(split_line[[2]], ",", fixed = TRUE, useBytes = TRUE)[[1]]
  if (length(prefix_parts) < 3L || length(tail_parts) < 3L) {
    stop("could not parse 2011 religion fields", call. = FALSE)
  }
  data.frame(
    Geo_Code = prefix_parts[[1]],
    Prov_Name = prefix_parts[[2]],
    GNR = prefix_parts[[length(prefix_parts)]],
    Characteristic = tail_parts[[1]],
    Total = tail_parts[[3]],
    name = if (geography == "pr") prefix_parts[[2]] else NA_character_,
    stringsAsFactors = FALSE
  )
}

# extract 2011 NHS profile rows for total religion and no affiliation.
read_2011_counts <- function(zip_path, members, geography) {
  keep_line <- function(lines) {
    grepl(
      ",Religion,Total population in private households by religion,",
      lines,
      fixed = TRUE,
      useBytes = TRUE
    ) |
      grepl(",Religion,  No religious affiliation,", lines, fixed = TRUE, useBytes = TRUE)
  }
  pieces <- lapply(members, function(member) {
    filtered <- read_filtered_zip_lines(zip_path, member, keep_line)
    rows <- lapply(filtered[["lines"]], parse_2011_line, geography = geography)
    do.call(rbind, rows)
  })
  data <- do.call(rbind, pieces)
  total <- data[data[["Characteristic"]] == "Total population in private households by religion", , drop = FALSE]
  none <- data[data[["Characteristic"]] == "  No religious affiliation", , drop = FALSE]
  index <- match(total[["Geo_Code"]], none[["Geo_Code"]])
  if (anyNA(index)) stop("2011 religion rows are incomplete", call. = FALSE)

  name <- if (geography %in% c("csd", "cd")) rep(NA_character_, nrow(total)) else total[["name"]]
  province_code <- if (geography %in% c("csd", "cd")) {
    substr(total[["Geo_Code"]], 1L, 2L)
  } else {
    total[["Geo_Code"]]
  }
  out <- data.frame(
    code = total[["Geo_Code"]],
    alt_code = total[["Geo_Code"]],
    name = name,
    geo_level = geography,
    province_code = province_code,
    total = numeric_count(total[["Total"]]),
    no_religion = numeric_count(none[["Total"]][index]),
    source_quality_flag = total[["GNR"]],
    stringsAsFactors = FALSE
  )
  out[["religious_affiliation"]] <- out[["total"]] - out[["no_religion"]]
  out
}

# parse codelists from the small 2001 SDMX structure file.
read_2001_geo_codelist <- function(zip_path) {
  tmp <- tempfile("ca_2001_structure_")
  dir.create(tmp)
  on.exit(unlink(tmp, recursive = TRUE), add = TRUE)
  utils::unzip(zip_path, files = "Structure_95F0450XCB2001006.xml", exdir = tmp)
  doc <- read_xml(file.path(tmp, "Structure_95F0450XCB2001006.xml"))
  codes <- xml_find_all(
    doc,
    "//*[local-name()='CodeList' and @id='CL_GEO']/*[local-name()='Code']"
  )
  code_info <- lapply(codes, function(code) {
    geography_type <- xml_text(xml_find_first(
      code,
      paste0(
        ".//*[local-name()='Annotation'",
        " and ./*[local-name()='AnnotationType' and text()='Geography Type Acronym']]",
        "/*[local-name()='AnnotationTitle']"
      )
    ))
    quality_flag <- xml_text(xml_find_first(
      code,
      paste0(
        ".//*[local-name()='Annotation'",
        " and ./*[local-name()='AnnotationType' and text()='Data Quality Flag']]",
        "/*[local-name()='AnnotationText']"
      )
    ))
    data.frame(
      code = xml_attr(code, "value"),
      name = trimws(xml_text(xml_find_first(code, "./*[local-name()='Description']"))),
      geo_type = geography_type,
      source_quality_flag = quality_flag,
      stringsAsFactors = FALSE
    )
  })
  do.call(rbind, code_info)
}

# stream the 2001 generic SDMX XML and keep only total-age religion counts.
read_2001_generic_counts <- function(zip_path) {
  con <- unz(zip_path, "Generic_95F0450XCB2001006.xml", open = "rt")
  on.exit(close(con), add = TRUE)
  current_geo <- NA_character_
  current_religion <- NA_character_
  current_age <- NA_character_
  rows <- list()
  row_index <- 0L
  value_pattern <- '.*value="([^"]+)".*'

  repeat {
    lines <- readLines(con, n = 50000L, warn = FALSE)
    if (!length(lines)) break
    for (line in lines) {
      if (grepl('concept="GEO"', line, fixed = TRUE)) {
        current_geo <- sub(value_pattern, "\\1", line)
      } else if (grepl('concept="ReligWI"', line, fixed = TRUE)) {
        current_religion <- sub(value_pattern, "\\1", line)
      } else if (grepl('concept="Age"', line, fixed = TRUE)) {
        current_age <- sub(value_pattern, "\\1", line)
      } else if (
        grepl("ObsValue", line, fixed = TRUE) &&
          identical(current_age, "1") &&
          current_religion %in% c("1", "13")
      ) {
        row_index <- row_index + 1L
        rows[[row_index]] <- data.frame(
          code = current_geo,
          religion_code = current_religion,
          value = as.numeric(sub(value_pattern, "\\1", line)),
          stringsAsFactors = FALSE
        )
      }
    }
  }
  if (!length(rows)) stop("no 2001 religion rows parsed", call. = FALSE)
  do.call(rbind, rows)
}

# assemble 2001 census division, province, and national religion counts.
read_2001_counts <- function(zip_path) {
  code_info <- read_2001_geo_codelist(zip_path)
  counts <- read_2001_generic_counts(zip_path)
  total <- counts[counts[["religion_code"]] == "1", , drop = FALSE]
  none <- counts[counts[["religion_code"]] == "13", , drop = FALSE]
  index <- match(total[["code"]], none[["code"]])
  if (anyNA(index)) stop("2001 religion rows are incomplete", call. = FALSE)
  merged <- merge(
    data.frame(
      code = total[["code"]],
      total = total[["value"]],
      no_religion = none[["value"]][index],
      stringsAsFactors = FALSE
    ),
    code_info,
    by = "code",
    all.x = TRUE
  )
  merged[["religious_affiliation"]] <- merged[["total"]] - merged[["no_religion"]]
  merged[["alt_code"]] <- merged[["code"]]
  merged[["province_code"]] <- ifelse(nchar(merged[["code"]]) >= 4L, substr(merged[["code"]], 1L, 2L), merged[["code"]])
  merged
}

# read a shapefile zip and return the single shapefile as an sf object.
read_zip_shapefile <- function(zip_path) {
  tmp <- tempfile("ca_boundary_")
  dir.create(tmp)
  on.exit(unlink(tmp, recursive = TRUE), add = TRUE)
  utils::unzip(zip_path, exdir = tmp)
  shp <- list.files(tmp, pattern = "[.]shp$", full.names = TRUE)
  if (length(shp) != 1L) stop("expected one shapefile in ", basename(zip_path), call. = FALSE)
  st_read(shp, quiet = TRUE)
}

# prepare the 2021 CSD cartographic boundary layer for the shared map.
read_2021_boundary <- function(zip_path) {
  boundary <- read_zip_shapefile(zip_path)
  st_sf(
    area_code = boundary[["DGUID"]],
    alt_geo_code = boundary[["CSDUID"]],
    area_name = utf8_text(boundary[["CSDNAME"]]),
    pruid = boundary[["PRUID"]],
    land_area_sq_km = as.numeric(boundary[["LANDAREA"]]),
    geometry = st_geometry(boundary)
  )
}

# prepare the 2021 CD cartographic boundary layer for the shared map.
read_2021_cd_boundary <- function(zip_path) {
  boundary <- read_zip_shapefile(zip_path)
  st_sf(
    area_code = boundary[["DGUID"]],
    alt_geo_code = boundary[["CDUID"]],
    area_name = utf8_text(boundary[["CDNAME"]]),
    pruid = boundary[["PRUID"]],
    land_area_sq_km = as.numeric(boundary[["LANDAREA"]]),
    geometry = st_geometry(boundary)
  )
}

# prepare the 2011 CSD cartographic boundary layer for the shared map.
read_2011_boundary <- function(zip_path) {
  boundary <- read_zip_shapefile(zip_path)
  area <- as.numeric(st_area(st_transform(boundary, boundary_analysis_crs))) / 1e6
  st_sf(
    area_code = boundary[["CSDUID"]],
    alt_geo_code = boundary[["CSDUID"]],
    area_name = utf8_text(boundary[["CSDNAME"]]),
    pruid = boundary[["PRUID"]],
    land_area_sq_km = area,
    geometry = st_geometry(boundary)
  )
}

# prepare the 2011 CD cartographic boundary layer for the shared map.
read_2011_cd_boundary <- function(zip_path) {
  boundary <- read_zip_shapefile(zip_path)
  area <- as.numeric(st_area(st_transform(boundary, boundary_analysis_crs))) / 1e6
  st_sf(
    area_code = boundary[["CDUID"]],
    alt_geo_code = boundary[["CDUID"]],
    area_name = utf8_text(boundary[["CDNAME"]]),
    pruid = boundary[["PRUID"]],
    land_area_sq_km = area,
    geometry = st_geometry(boundary)
  )
}

# polygonise the official 2001 AVCE00 arcs and label them with CD codes.
read_2001_boundary <- function(zip_path) {
  old_s2 <- sf_use_s2()
  sf_use_s2(FALSE)
  on.exit(sf_use_s2(old_s2), add = TRUE)

  tmp <- tempfile("ca_2001_cd_boundary_")
  dir.create(tmp)
  on.exit(unlink(tmp, recursive = TRUE), add = TRUE)
  utils::unzip(zip_path, exdir = tmp)
  e00 <- list.files(tmp, pattern = "gcd_000b02a_e[.]e00$", recursive = TRUE, full.names = TRUE)
  if (length(e00) != 1L) stop("expected one 2001 CD e00 boundary file", call. = FALSE)

  arcs <- st_read(e00, layer = "ARC", quiet = TRUE)
  labels <- st_read(e00, layer = "LAB", quiet = TRUE)
  polygons <- st_collection_extract(st_polygonize(st_union(st_geometry(arcs))), "POLYGON")
  polygon_sf <- st_sf(poly_id = seq_along(polygons), geometry = polygons)
  labelled <- st_join(labels, polygon_sf, join = st_within, left = FALSE)
  if (nrow(labelled) != length(polygons)) {
    stop("2001 CD polygon labels do not cover every polygon", call. = FALSE)
  }

  labelled_df <- st_drop_geometry(labelled)
  parts <- merge(
    polygon_sf,
    labelled_df[c("poly_id", "CDUID", "CDNAME", "CDTYPE", "PRUID")],
    by = "poly_id"
  )
  split_index <- split(seq_len(nrow(parts)), parts[["CDUID"]])
  geometries <- lapply(split_index, function(index) st_combine(st_geometry(parts[index, ]))[[1]])
  keys <- parts[match(names(split_index), parts[["CDUID"]]), c("CDUID", "CDNAME", "CDTYPE", "PRUID")]
  boundary <- st_sf(st_drop_geometry(keys), geometry = st_sfc(geometries, crs = st_crs(parts)))
  area <- as.numeric(st_area(st_transform(boundary, boundary_analysis_crs))) / 1e6
  st_sf(
    area_code = boundary[["CDUID"]],
    alt_geo_code = boundary[["CDUID"]],
    area_name = utf8_text(boundary[["CDNAME"]]),
    pruid = boundary[["PRUID"]],
    land_area_sq_km = area,
    geometry = st_geometry(boundary)
  )
}

# return per-feature simplification tolerances from projected feature areas.
boundary_tolerances <- function(boundary_sf, factor) {
  pmin(
    boundary_tolerance_cap_m,
    pmax(
      boundary_tolerance_floor_m,
      factor * sqrt(as.numeric(st_area(st_geometry(boundary_sf))))
    )
  )
}

# count points in the largest polygon outer ring for one geometry.
largest_outer_ring_point_count <- function(geometry, crs = 4326) {
  if (st_is_empty(geometry)) return(NA_integer_)
  geometry_type <- as.character(st_geometry_type(geometry))
  polygons <- if (geometry_type == "POLYGON") {
    list(geometry)
  } else if (geometry_type == "MULTIPOLYGON") {
    lapply(geometry, st_polygon)
  } else {
    extracted <- suppressWarnings(
      st_cast(st_collection_extract(st_sfc(geometry, crs = crs), "POLYGON"), "POLYGON")
    )
    lapply(seq_along(extracted), function(index) extracted[[index]])
  }
  if (length(polygons) == 0L) return(NA_integer_)

  polygon_sfc <- do.call(st_sfc, c(polygons, list(crs = crs)))
  polygon_areas <- as.numeric(st_area(st_transform(polygon_sfc, boundary_analysis_crs)))
  largest_polygon <- polygon_sfc[[which.max(polygon_areas)]]
  nrow(largest_polygon[[1]])
}

# simplify one feature, lowering tolerance only to satisfy the ring guard.
simplify_boundary_geometry <- function(geometry, crs, tolerance) {
  adjusted_tolerance <- tolerance
  for (attempt in seq_len(8L)) {
    candidate <- st_simplify(
      st_sfc(geometry, crs = crs),
      dTolerance = adjusted_tolerance,
      preserveTopology = TRUE
    )[[1]]
    point_count <- largest_outer_ring_point_count(candidate, crs = crs)
    if (is.na(point_count) || point_count >= boundary_ring_guard_min_points) {
      return(list(
        geometry = candidate,
        tolerance = adjusted_tolerance,
        guard_adjusted = adjusted_tolerance < tolerance
      ))
    }
    adjusted_tolerance <- adjusted_tolerance / 2
  }

  list(
    geometry = geometry,
    tolerance = 0,
    guard_adjusted = TRUE
  )
}

# simplify projected boundary geometries with each feature's own tolerance.
simplify_boundary <- function(boundary_sf, factor) {
  initial_tolerances <- boundary_tolerances(boundary_sf, factor)
  crs <- st_crs(boundary_sf)
  simplified <- lapply(seq_along(initial_tolerances), function(index) {
    simplify_boundary_geometry(
      st_geometry(boundary_sf)[[index]],
      crs,
      initial_tolerances[[index]]
    )
  })
  simplified_geometry <- st_sfc(
    lapply(simplified, function(item) item[["geometry"]]),
    crs = crs
  )
  st_geometry(boundary_sf) <- simplified_geometry

  list(
    boundary = boundary_sf,
    initial_tolerances = initial_tolerances,
    final_tolerances = vapply(simplified, function(item) item[["tolerance"]], numeric(1)),
    guard_adjusted = vapply(simplified, function(item) item[["guard_adjusted"]], logical(1))
  )
}

# write the smallest area-scaled boundary that meets the file-size budget.
write_simplified_boundary <- function(boundary_sf, output_path) {
  projected <- st_transform(st_make_valid(boundary_sf), boundary_analysis_crs)
  result <- NULL
  for (iteration in seq_len(boundary_max_simplification_iterations)) {
    factor <- boundary_tolerance_base_factor * boundary_tolerance_scale^(iteration - 1L)
    simplified <- simplify_boundary(projected, factor)
    candidate <- st_transform(simplified[["boundary"]], 4326)
    st_write(
      candidate,
      output_path,
      layer_options = paste0("COORDINATE_PRECISION=", boundary_coordinate_precision),
      delete_dsn = TRUE,
      quiet = TRUE
    )

    result <- list(
      factor = factor,
      iteration = iteration,
      initial_tolerances = simplified[["initial_tolerances"]],
      final_tolerances = simplified[["final_tolerances"]],
      guard_adjusted_features = sum(simplified[["guard_adjusted"]]),
      bytes = file_bytes(output_path)
    )
    if (result[["bytes"]] <= boundary_size_budget_bytes) return(result)
  }

  stop(
    "boundary output remains above 4 MB after maximum area-scaled simplification iterations: ",
    output_path,
    call. = FALSE
  )
}

# read back the boundary product and stop if real features are over-simplified.
validate_boundary_ring_points <- function(path) {
  boundary_geojson <- st_read(path, quiet = TRUE)
  geometry <- st_geometry(boundary_geojson)
  non_empty <- !st_is_empty(geometry)
  point_counts <- vapply(geometry, largest_outer_ring_point_count, integer(1))
  real_point_counts <- point_counts[non_empty]

  if (any(real_point_counts < boundary_ring_guard_min_points, na.rm = TRUE)) {
    failed_codes <- boundary_geojson[["area_code"]][non_empty][
      real_point_counts < boundary_ring_guard_min_points
    ]
    stop(
      paste(
        "simplified boundary outer-ring guard failed:",
        length(failed_codes),
        "features have fewer than",
        boundary_ring_guard_min_points,
        "points in the largest polygon outer ring; examples:",
        paste(head(failed_codes, 10), collapse = ", ")
      ),
      call. = FALSE
    )
  }

  list(
    min = min(real_point_counts, na.rm = TRUE),
    median = stats::median(real_point_counts, na.rm = TRUE),
    max = max(real_point_counts, na.rm = TRUE),
    below_12 = sum(real_point_counts < 12, na.rm = TRUE),
    guard_minimum = boundary_ring_guard_min_points
  )
}

# attach census counts to one vintage boundary table.
join_counts_to_boundary <- function(counts, boundary, level_label) {
  matched_boundary <- match(boundary[["area_code"]], counts[["code"]])
  missing_counts <- boundary[["area_code"]][is.na(matched_boundary)]
  missing_boundary <- counts[["code"]][is.na(match(counts[["code"]], boundary[["area_code"]]))]
  if (length(missing_counts) > 0L || length(missing_boundary) > 0L) {
    stop(
      paste(
        level_label,
        "census/boundary join incomplete;",
        "boundary_without_counts=", length(missing_counts),
        "counts_without_boundary=", length(missing_boundary)
      ),
      call. = FALSE
    )
  }
  cbind(
    st_drop_geometry(boundary),
    counts[matched_boundary, setdiff(names(counts), c("code", "name"))],
    stringsAsFactors = FALSE
  )
}

# build one public area-summary row from joined counts and boundary data.
build_area_row <- function(row, country_code, boundary_set_id, boundary_level,
                           year, population_total_basis, source_dataset_ids,
                           quality_flag) {
  population_total <- as.integer(round(row[["total"]]))
  no_religion_count <- as.integer(round(row[["no_religion"]]))
  religious_affiliation_count <- as.integer(round(row[["religious_affiliation"]]))
  row_flags <- quality_flag
  if (is.na(population_total) || is.na(no_religion_count) || is.na(religious_affiliation_count)) {
    row_flags <- paste(c(row_flags[nzchar(row_flags)], "suppressed_denominator"), collapse = ";")
  }
  has_population <- !is.na(population_total) && population_total > 0L
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = paste0(boundary_set_id, ":", row[["area_code"]]),
    area_code = row[["area_code"]],
    area_name = row[["area_name"]],
    year = year,
    population_total = population_total,
    population_total_basis = population_total_basis,
    religious_affiliation_count = religious_affiliation_count,
    religious_affiliation_percent = if (has_population) {
      round(100 * religious_affiliation_count / population_total, 2)
    } else {
      NA_real_
    },
    no_religion_count = no_religion_count,
    no_religion_percent = if (has_population) {
      round(100 * no_religion_count / population_total, 2)
    } else {
      NA_real_
    },
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(as.numeric(row[["land_area_sq_km"]]), 2),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = source_dataset_ids,
    source_data_quality_flag = row[["source_quality_flag"]],
    quality_flag = row_flags
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
      source_data_quality_flag = row[["source_data_quality_flag"]],
      quality_flag = row[["quality_flag"]],
      stringsAsFactors = FALSE
    )
  }))
}

# write area-summary json and csv siblings with an array-valued rows field.
write_area_summary <- function(rows, json_path, csv_path) {
  write_json(
    list(schema_version = "area-summary.v1", country_code = "CA", rows = unname(rows)),
    json_path,
    auto_unbox = TRUE,
    pretty = TRUE,
    null = "null",
    na = "null"
  )
  write.csv(flatten_rows(rows), csv_path, row.names = FALSE, na = "")
}

# aggregate count components to province or national validation units.
aggregate_counts <- function(counts, group_values) {
  metrics <- c("total", "no_religion", "religious_affiliation")
  grouped <- stats::aggregate(
    counts[metrics],
    by = list(code = group_values),
    FUN = function(x) sum(x, na.rm = TRUE)
  )
  component_counts <- stats::aggregate(
    data.frame(component_count = rep(1L, nrow(counts))),
    by = list(code = group_values),
    FUN = sum
  )
  merge(grouped, component_counts, by = "code", all.x = TRUE)
}

# return the theoretical maximum residual allowed under base-10 rounding.
rounding_residual_bound <- function(component_count) {
  as.integer(rounding_base * (component_count + 1L))
}

# compare derived sums with a source-level StatCan row.
compare_one_unit <- function(source_row, derived_row, label) {
  metrics <- c("total", "no_religion", "religious_affiliation")
  component_count <- as.integer(derived_row[["component_count"]])
  bound <- rounding_residual_bound(component_count)
  differences <- lapply(metrics, function(metric) {
    source_value <- as.integer(round(source_row[[metric]]))
    derived_value <- as.integer(round(derived_row[[metric]]))
    list(
      metric = metric,
      source_total = source_value,
      derived_sum = derived_value,
      difference = derived_value - source_value
    )
  })
  max_abs_difference <- max(abs(vapply(differences, function(item) item[["difference"]], integer(1))))
  list(
    label = label,
    code = source_row[["code"]],
    name = source_row[["name"]],
    component_count = component_count,
    rounding_residual_bound = bound,
    status = if (max_abs_difference == 0) {
      "exact"
    } else if (max_abs_difference <= bound) {
      "within_rounding_bound"
    } else {
      "failed"
    },
    max_abs_difference = max_abs_difference,
    differences = differences
  )
}

# compare all source rows at one validation level with derived sums.
compare_level <- function(source_counts, derived_counts, label) {
  lapply(seq_len(nrow(source_counts)), function(index) {
    source_row <- as.list(source_counts[index, ])
    derived_match <- derived_counts[derived_counts[["code"]] == source_row[["code"]], , drop = FALSE]
    if (nrow(derived_match) != 1L) {
      stop("missing derived validation row for ", label, " ", source_row[["code"]], call. = FALSE)
    }
    compare_one_unit(source_row, as.list(derived_match[1, ]), label)
  })
}

# stop if any validation record exceeds the coded rounding bound.
assert_validation_passed <- function(records, label) {
  failed <- vapply(records, function(record) identical(record[["status"]], "failed"), logical(1))
  if (any(failed)) {
    stop(label, " reconciliation exceeded the coded rounding bound", call. = FALSE)
  }
}

# stop when the validation tier omits a province or territory.
assert_validation_unit_count <- function(source_counts, expected_units, label) {
  observed_units <- nrow(source_counts)
  if (observed_units != expected_units) {
    stop(
      label,
      " validation unit count was ",
      observed_units,
      "; expected ",
      expected_units,
      call. = FALSE
    )
  }
}

# return the largest reconciliation difference in a validation record list.
max_validation_difference <- function(records) {
  max(vapply(records, function(item) item[["max_abs_difference"]], integer(1)))
}

# return the largest coded rounding bound in a validation record list.
max_validation_bound <- function(records) {
  max(vapply(records, function(item) item[["rounding_residual_bound"]], integer(1)))
}

# summarise validation records in one manifest-note line.
validation_note_line <- function(year, level, records) {
  statuses <- unique(vapply(records, function(item) item[["status"]], character(1)))
  paste0(
    year, " ", level, " reconciliation: ", paste(statuses, collapse = "/"),
    "; units=", length(records),
    "; max_abs_difference=", max_validation_difference(records),
    "; max_rounding_bound=", max_validation_bound(records)
  )
}

# select validation records for a source-code subgroup.
filter_validation_records <- function(records, codes) {
  records[vapply(records, function(record) record[["code"]] %in% codes, logical(1))]
}

# summarise territory-level residuals in one manifest-note line.
territory_validation_note_line <- function(year, records) {
  residuals <- vapply(records, function(record) {
    paste0(record[["name"]], " (", record[["code"]], ")=", record[["max_abs_difference"]])
  }, character(1))
  paste0(
    year, " territory reconciliation residuals: units=", length(records),
    "; max_abs_difference=", max_validation_difference(records),
    "; residuals=", paste(residuals, collapse = "; ")
  )
}

# write the ignored raw-source ledger required for the launch.
write_sources_ledger <- function() {
  licence_text <- paste(
    "Statistics Canada Open Licence;",
    "this does not constitute an endorsement by Statistics Canada;",
    licence_url
  )
  filenames <- c(
    zip_2021_pr, zip_2021_csd, zip_2011_pr, zip_2011_csd,
    zip_2011_cd, zip_2001_xml, zip_2021_boundary, zip_2021_cd_boundary, zip_2011_boundary,
    zip_2011_cd_boundary, zip_2001_boundary
  )
  urls <- c(
    source_url_2021_pr, source_url_2021_csd, source_url_2011_pr, source_url_2011_csd,
    source_url_2011_cd, source_url_2001_table, source_url_2021_csd_boundary,
    source_url_2021_cd_boundary, source_url_2011_csd_boundary, source_url_2011_cd_boundary,
    source_url_2001_cd_boundary
  )
  source_rows <- data.frame(
    filename = filenames,
    url = urls,
    retrieval_date = retrieval_date,
    publisher = "Statistics Canada",
    licence_text = licence_text,
    sha256 = vapply(file.path(raw_dir, filenames), sha256_file, character(1)),
    stringsAsFactors = FALSE
  )
  write.csv(source_rows, sources_csv, row.names = FALSE, na = "")
  source_rows
}

# return the current git commit for manifest lineage.
current_git_commit <- function() {
  commit <- tryCatch(
    system("git rev-parse --short HEAD", intern = TRUE),
    error = function(error) character(0)
  )
  if (length(commit) == 0L || is.na(commit[[1]]) || !nzchar(commit[[1]])) {
    stop("could not determine git commit for manifest", call. = FALSE)
  }
  commit[[1]]
}

# create a schema-valid durable-file record for a generated output.
manifest_file_record <- function(rel_path, abs_path, content, row_count = NULL, feature_count = NULL) {
  list(
    uri = paste0("repo:", rel_path),
    storage_provider = "other",
    format = sub("^.*[.]", "", rel_path),
    bytes = file_bytes(abs_path),
    sha256 = sha256_file(abs_path),
    row_count = row_count,
    feature_count = feature_count,
    content = content,
    privacy = "public",
    licence_status = "accepted"
  )
}

# return a stable manifest creation timestamp for same-version rebuilds.
manifest_created_at <- function(path, dataset_version_id) {
  fallback <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  if (!file.exists(path)) return(fallback)
  existing <- tryCatch(
    fromJSON(path, simplifyVector = FALSE),
    error = function(error) NULL
  )
  if (
    is.null(existing) ||
      !identical(existing[["dataset_version_id"]], dataset_version_id) ||
      is.null(existing[["created_at"]]) ||
      !nzchar(existing[["created_at"]])
  ) {
    return(fallback)
  }
  existing[["created_at"]]
}

# build all rows for one wave and write its output files.
build_wave <- function(counts, boundary, boundary_out, summary_json, summary_csv,
                       boundary_set_id, boundary_level, year,
                       population_total_basis, source_dataset_ids,
                       quality_flag, level_label) {
  joined <- join_counts_to_boundary(counts, boundary, level_label)
  rows <- lapply(seq_len(nrow(joined)), function(index) {
    build_area_row(
      as.list(joined[index, ]),
      "CA",
      boundary_set_id,
      boundary_level,
      year,
      population_total_basis,
      source_dataset_ids,
      quality_flag
    )
  })
  write_area_summary(rows, summary_json, summary_csv)
  simplification <- write_simplified_boundary(boundary, boundary_out)
  ring_summary <- validate_boundary_ring_points(boundary_out)
  list(
    rows = rows,
    joined = joined,
    simplification = simplification,
    ring_summary = ring_summary
  )
}

required_files <- c(
  path_2021_pr, path_2021_csd, path_2011_pr, path_2011_csd,
  path_2011_cd, path_2001_xml, path_2021_boundary, path_2021_cd_boundary, path_2011_boundary,
  path_2011_cd_boundary, path_2001_boundary
)
invisible(lapply(required_files, require_file))
source_ledger <- write_sources_ledger()

member_2021_pr <- zip_member(path_2021_pr, "English_CSV_data[.]csv$")
member_2021_csd <- zip_member(path_2021_csd, "English_CSV_data[.]csv$")
member_2011_pr <- zip_member(path_2011_pr, "101[.]csv$")
members_2011_csd <- utils::unzip(path_2011_csd, list = TRUE)[["Name"]]
members_2011_csd <- members_2011_csd[grepl("301-.*[.]csv$", members_2011_csd)]
member_2011_cd <- zip_member(path_2011_cd, "701[.]csv$")

message("reading 2021 religion counts")
counts_2021_csd <- read_2021_counts(path_2021_csd, member_2021_csd, "Census subdivision")
counts_2021_cd <- read_2021_counts(path_2021_csd, member_2021_csd, "Census division")
counts_2021_pr <- read_2021_counts(path_2021_pr, member_2021_pr, c("Country", subnational_2021_levels))
counts_2021_pr[["code"]] <- counts_2021_pr[["alt_code"]]
message("reading 2011 NHS religion counts")
counts_2011_csd <- read_2011_counts(path_2011_csd, members_2011_csd, "csd")
counts_2011_cd <- read_2011_counts(path_2011_cd, member_2011_cd, "cd")
counts_2011_pr <- read_2011_counts(path_2011_pr, member_2011_pr, "pr")
message("reading 2001 census religion counts")
counts_2001_all <- read_2001_counts(path_2001_xml)
counts_2001_cd <- counts_2001_all[counts_2001_all[["geo_type"]] == "CD", , drop = FALSE]
counts_2001_pr <- counts_2001_all[
  counts_2001_all[["geo_type"]] == "PR" &
    (counts_2001_all[["code"]] == "01" | nchar(counts_2001_all[["code"]]) == 2L),
  ,
  drop = FALSE
]

message("reading vintage boundaries")
boundary_2021_csd <- read_2021_boundary(path_2021_boundary)
boundary_2021 <- read_2021_cd_boundary(path_2021_cd_boundary)
boundary_2011_csd <- read_2011_boundary(path_2011_boundary)
boundary_2011 <- read_2011_cd_boundary(path_2011_cd_boundary)
boundary_2001 <- read_2001_boundary(path_2001_boundary)

message("validating 2021 against source province/territory and national totals")
province_2021_source <- counts_2021_pr[
  counts_2021_pr[["geo_level"]] %in% subnational_2021_levels,
  ,
  drop = FALSE
]
territory_2021_source <- counts_2021_pr[counts_2021_pr[["geo_level"]] == "Territory", , drop = FALSE]
national_2021_source <- counts_2021_pr[counts_2021_pr[["geo_level"]] == "Country", , drop = FALSE]
assert_validation_unit_count(
  province_2021_source,
  expected_subnational_units,
  "2021 province/territory"
)
province_2021_derived <- aggregate_counts(counts_2021_cd, counts_2021_cd[["province_code"]])
national_2021_derived <- aggregate_counts(counts_2021_cd, rep("01", nrow(counts_2021_cd)))
validation_2021_province <- compare_level(province_2021_source, province_2021_derived, "province")
validation_2021_territory <- filter_validation_records(
  validation_2021_province,
  territory_2021_source[["code"]]
)
validation_2021_national <- compare_level(national_2021_source, national_2021_derived, "national")
assert_validation_passed(validation_2021_province, "2021 province/territory")
assert_validation_passed(validation_2021_national, "2021 national")

message("validating 2011 CSD attempt against source province and national totals")
province_2011_source <- counts_2011_pr[counts_2011_pr[["code"]] != "01", , drop = FALSE]
national_2011_source <- counts_2011_pr[counts_2011_pr[["code"]] == "01", , drop = FALSE]
assert_validation_unit_count(
  province_2011_source,
  expected_subnational_units,
  "2011 province/territory"
)
province_2011_csd_derived <- aggregate_counts(counts_2011_csd, counts_2011_csd[["province_code"]])
national_2011_csd_derived <- aggregate_counts(counts_2011_csd, rep("01", nrow(counts_2011_csd)))
validation_2011_csd_province <- compare_level(province_2011_source, province_2011_csd_derived, "province")
validation_2011_csd_national <- compare_level(national_2011_source, national_2011_csd_derived, "national")

message("validating 2011 CD fallback against source province and national totals")
province_2011_derived <- aggregate_counts(counts_2011_cd, counts_2011_cd[["province_code"]])
national_2011_derived <- aggregate_counts(counts_2011_cd, rep("01", nrow(counts_2011_cd)))
validation_2011_province <- compare_level(province_2011_source, province_2011_derived, "province")
validation_2011_national <- compare_level(national_2011_source, national_2011_derived, "national")
assert_validation_passed(validation_2011_province, "2011 province")
assert_validation_passed(validation_2011_national, "2011 national")

message("validating 2001 against source province and national totals")
province_2001_source <- counts_2001_pr[counts_2001_pr[["code"]] != "01", , drop = FALSE]
national_2001_source <- counts_2001_pr[counts_2001_pr[["code"]] == "01", , drop = FALSE]
assert_validation_unit_count(
  province_2001_source,
  expected_subnational_units,
  "2001 province/territory"
)
province_2001_derived <- aggregate_counts(counts_2001_cd, substr(counts_2001_cd[["code"]], 1L, 2L))
national_2001_derived <- aggregate_counts(counts_2001_cd, rep("01", nrow(counts_2001_cd)))
validation_2001_province <- compare_level(province_2001_source, province_2001_derived, "province")
validation_2001_national <- compare_level(national_2001_source, national_2001_derived, "national")
assert_validation_passed(validation_2001_province, "2001 province")
assert_validation_passed(validation_2001_national, "2001 national")

message("writing 2021 CD fallback outputs")
wave_2021 <- build_wave(
  counts_2021_cd,
  boundary_2021,
  boundary_2021_out,
  summary_2021_json,
  summary_2021_csv,
  "ca-cd-2021-statcan",
  "cd_2021",
  2021L,
  population_total_basis_2021,
  c(dataset_id_2021_cd, dataset_id_2021_cd_boundary),
  "",
  "2021 CD"
)

message("writing 2011 CD fallback outputs")
wave_2011 <- build_wave(
  counts_2011_cd,
  boundary_2011,
  boundary_2011_out,
  summary_2011_json,
  summary_2011_csv,
  "ca-cd-2011-statcan",
  "cd_2011",
  2011L,
  population_total_basis_2011,
  c(dataset_id_2011_cd, dataset_id_2011_cd_boundary),
  "voluntary_survey_nhs",
  "2011 CD"
)

message("writing 2001 CD outputs")
wave_2001 <- build_wave(
  counts_2001_cd,
  boundary_2001,
  boundary_2001_out,
  summary_2001_json,
  summary_2001_csv,
  "ca-cd-2001-statcan",
  "cd_2001",
  2001L,
  population_total_basis_2001,
  c(dataset_id_2001_cd, dataset_id_2001_boundary),
  "",
  "2001 CD"
)

all_summary_hash <- sha256_file(summary_2021_json)
dataset_version_id <- paste0(
  "ca-census-religion:ca:2001-2021:",
  substr(all_summary_hash, 1L, 12L)
)
stamp <- manifest_created_at(manifest_out, dataset_version_id)

validation_notes <- paste(
  "wave 2021 row output:",
  length(wave_2021[["rows"]]),
  "CD rows; join coverage:",
  nrow(wave_2021[["joined"]]),
  "of",
  nrow(counts_2021_cd),
  "CD rows matched 2021 Statistics Canada CD boundaries. The 2021 CSD attempt had",
  nrow(counts_2021_csd),
  "source CSD rows, but the 2021 CSD boundary output remained above the 4 MB budget after the required area-scaled simplification iterations.",
  validation_note_line(2021, "province/territory", validation_2021_province),
  territory_validation_note_line(2021, validation_2021_territory),
  validation_note_line(2021, "national", validation_2021_national),
  "wave 2011 row output:",
  length(wave_2011[["rows"]]),
  "CD rows; every row carries quality_flag=voluntary_survey_nhs because the 2011 source is the voluntary National Household Survey.",
  paste0(
    "2011 CSD attempt failed reconciliation; CSD rows=",
    nrow(counts_2011_csd),
    "; ",
    validation_note_line(2011, "CSD province attempt", validation_2011_csd_province),
    "; ",
    validation_note_line(2011, "CSD national attempt", validation_2011_csd_national)
  ),
  validation_note_line(2011, "province", validation_2011_province),
  validation_note_line(2011, "national", validation_2011_national),
  "wave 2001 row output:",
  length(wave_2001[["rows"]]),
  "CD rows; the 2001 CD boundary layer was derived from the official AVCE00 arc and label layers by polygonising arcs and combining labelled polygon parts by CDUID.",
  validation_note_line(2001, "province", validation_2001_province),
  validation_note_line(2001, "national", validation_2001_national),
  paste0(
    "rounding acceptance rule: max_abs_difference must be <= ",
    rounding_base,
    " * (component_count + 1), a theoretical base-10 random-rounding residual bound for the aggregated small-area components plus the independently rounded source total."
  ),
  paste0(
    "boundary 2021 CD bytes=", file_bytes(boundary_2021_out),
    "; factor=", signif(wave_2021[["simplification"]][["factor"]], 5),
    "; guard_adjusted_features=", wave_2021[["simplification"]][["guard_adjusted_features"]]
  ),
  paste0(
    "boundary 2011 CD bytes=", file_bytes(boundary_2011_out),
    "; factor=", signif(wave_2011[["simplification"]][["factor"]], 5),
    "; guard_adjusted_features=", wave_2011[["simplification"]][["guard_adjusted_features"]]
  ),
  paste0(
    "boundary 2001 CD bytes=", file_bytes(boundary_2001_out),
    "; factor=", signif(wave_2001[["simplification"]][["factor"]], 5),
    "; guard_adjusted_features=", wave_2001[["simplification"]][["guard_adjusted_features"]]
  ),
  "construct notes: 2021 religion is Census Profile 25% sample data; 2011 religion is the voluntary NHS; 2001 religion is 20% sample Census tabulation 95F0450XCB2001006.",
  "source correction: the launch brief named 97F0006XCB2001006, but the official open StatCan XML product that resolves for the named 2001 religion-by-age table is 95F0450XCB2001006.",
  "deferred stretch waves: 1991 and 1981 CD outputs were not built because open StatCan religion tables and period CD boundary files did not resolve in this pass.",
  "no cross-vintage correspondence was created; each wave renders on its own boundary vintage.",
  sep = "\n"
)

durable_files <- list(
  manifest_file_record(
    summary_2021_json_rel,
    summary_2021_json,
    "Canada 2021 CD area summary with Census Profile 25% sample religion metrics after CSD boundary size fallback.",
    row_count = row_count_file(summary_2021_json),
    feature_count = NULL
  ),
  manifest_file_record(
    summary_2021_csv_rel,
    summary_2021_csv,
    "Flattened Canada 2021 CD area summary.",
    row_count = row_count_file(summary_2021_csv),
    feature_count = NULL
  ),
  manifest_file_record(
    boundary_2021_rel,
    boundary_2021_out,
    "Simplified 2021 Statistics Canada CD cartographic boundary GeoJSON.",
    row_count = NULL,
    feature_count = row_count_file(boundary_2021_out)
  ),
  manifest_file_record(
    summary_2011_json_rel,
    summary_2011_json,
    "Canada 2011 CD area summary with voluntary NHS religion metrics after CSD reconciliation failed.",
    row_count = row_count_file(summary_2011_json),
    feature_count = NULL
  ),
  manifest_file_record(
    summary_2011_csv_rel,
    summary_2011_csv,
    "Flattened Canada 2011 CD voluntary NHS area summary.",
    row_count = row_count_file(summary_2011_csv),
    feature_count = NULL
  ),
  manifest_file_record(
    boundary_2011_rel,
    boundary_2011_out,
    "Simplified 2011 Statistics Canada CD cartographic boundary GeoJSON.",
    row_count = NULL,
    feature_count = row_count_file(boundary_2011_out)
  ),
  manifest_file_record(
    summary_2001_json_rel,
    summary_2001_json,
    "Canada 2001 CD area summary with 2001 Census 20% sample religion metrics.",
    row_count = row_count_file(summary_2001_json),
    feature_count = NULL
  ),
  manifest_file_record(
    summary_2001_csv_rel,
    summary_2001_csv,
    "Flattened Canada 2001 CD area summary.",
    row_count = row_count_file(summary_2001_csv),
    feature_count = NULL
  ),
  manifest_file_record(
    boundary_2001_rel,
    boundary_2001_out,
    "Simplified 2001 Statistics Canada CD cartographic boundary GeoJSON derived from AVCE00 arcs and labels.",
    row_count = NULL,
    feature_count = row_count_file(boundary_2001_out)
  )
)

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:ca-census-religion:ca:2001-2021",
  dataset_id = "ca-census-religion:ca:2001-2021",
  dataset_version_id = dataset_version_id,
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "ca-census-religion",
  dataset_role = "public_product",
  scope = list(
    level = "country",
    country_codes = list("CA"),
    snapshot_date = NULL,
    snapshot_anchor = NULL,
    pipeline_stage = "public"
  ),
  created_at = stamp,
  created_by = "scripts/build_ca_area_summary.R",
  pipeline = list(
    script = "scripts/build_ca_area_summary.R",
    git_commit = current_git_commit(),
    command = "Rscript scripts/build_ca_area_summary.R",
    parameters = list(
      waves_built = "2001, 2011, 2021",
      waves_deferred = "1981, 1991",
      boundary_sets = "cd_2021, cd_2011, cd_2001",
      boundary_simplification_rule = paste(
        "area-scaled per-feature pmin(1500, pmax(40, factor * sqrt(st_area_m2)));",
        "ring guard minimum 8 outer-ring points; output budget 4 MB per level"
      ),
      denominator_2021 = population_total_basis_2021,
      denominator_2011 = population_total_basis_2011,
      denominator_2001 = population_total_basis_2001
    ),
    software_versions = list(
      r = paste(R.version$major, R.version$minor, sep = "."),
      sf = as.character(utils::packageVersion("sf")),
      jsonlite = as.character(utils::packageVersion("jsonlite")),
      xml2 = as.character(utils::packageVersion("xml2"))
    )
  ),
  source = list(
    provider = "Statistics Canada",
    source_dataset_ids = list(
      dataset_id_2021_csd,
      dataset_id_2021_cd,
      dataset_id_2021_pr,
      dataset_id_2011_csd,
      dataset_id_2011_cd,
      dataset_id_2011_pr,
      dataset_id_2001_cd,
      dataset_id_2021_boundary,
      dataset_id_2021_cd_boundary,
      dataset_id_2011_boundary,
      dataset_id_2011_cd_boundary,
      dataset_id_2001_boundary
    ),
    source_urls = list(
      source_url_2021_pr,
      source_url_2021_csd,
      source_url_2011_pr,
      source_url_2011_csd,
      source_url_2011_cd,
      source_url_2001_table,
      source_url_2021_csd_boundary,
      source_url_2021_cd_boundary,
      source_url_2011_csd_boundary,
      source_url_2011_cd_boundary,
      source_url_2001_cd_boundary,
      licence_url
    ),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = paste(
      "Statistics Canada Open Licence.",
      "Contains information licensed under the Statistics Canada Open Licence;",
      "adapted products do not constitute an endorsement by Statistics Canada.",
      licence_url
    ),
    citation = paste(
      "Statistics Canada. Census Profile, 2021 Census, religion topic;",
      "National Household Survey Profile, 2011, religion topic;",
      "2001 Census topic-based tabulation 95F0450XCB2001006;",
      "and 2021, 2011, and 2001 cartographic boundary files. The 2021 public layer uses CD because the CSD boundary could not meet the 4 MB budget; the 2011 public layer uses CD because the CSD product failed province and national reconciliation."
    )
  ),
  input_manifests = list(),
  durable_files = durable_files,
  partitions = list(
    list(
      partition_id = "country:CA",
      partition_type = "country",
      country_code = "CA",
      file_uri = paste0("repo:", summary_2021_json_rel),
      sha256 = sha256_file(summary_2021_json),
      row_count = row_count_file(summary_2021_json),
      feature_count = NULL
    )
  ),
  stats = list(
    waves_built = 3L,
    rows_2021 = length(wave_2021[["rows"]]),
    rows_2011 = length(wave_2011[["rows"]]),
    rows_2001 = length(wave_2001[["rows"]]),
    source_rows_2021 = nrow(counts_2021_cd),
    source_rows_2021_csd_attempt = nrow(counts_2021_csd),
    source_rows_2011 = nrow(counts_2011_cd),
    source_rows_2011_csd_attempt = nrow(counts_2011_csd),
    source_rows_2001 = nrow(counts_2001_cd),
    join_matched_rows_2021 = nrow(wave_2021[["joined"]]),
    join_matched_rows_2011 = nrow(wave_2011[["joined"]]),
    join_matched_rows_2001 = nrow(wave_2001[["joined"]]),
    province_validation_max_abs_difference_2021 = max_validation_difference(validation_2021_province),
    national_validation_max_abs_difference_2021 = max_validation_difference(validation_2021_national),
    province_validation_max_abs_difference_2011_csd_attempt = max_validation_difference(validation_2011_csd_province),
    national_validation_max_abs_difference_2011_csd_attempt = max_validation_difference(validation_2011_csd_national),
    province_validation_max_abs_difference_2011 = max_validation_difference(validation_2011_province),
    national_validation_max_abs_difference_2011 = max_validation_difference(validation_2011_national),
    province_validation_max_abs_difference_2001 = max_validation_difference(validation_2001_province),
    national_validation_max_abs_difference_2001 = max_validation_difference(validation_2001_national),
    boundary_geojson_bytes_2021 = file_bytes(boundary_2021_out),
    boundary_geojson_bytes_2011 = file_bytes(boundary_2011_out),
    boundary_geojson_bytes_2001 = file_bytes(boundary_2001_out),
    raw_source_rows = nrow(source_ledger)
  ),
  local_cache_hint = "Raw Statistics Canada downloads and sources.csv are in data/raw/ca_census/. The directory is git-ignored and should be promoted to project-controlled storage before reuse outside this build.",
  validation = list(
    status = "passed_with_warnings",
    commands = list("Rscript scripts/build_ca_area_summary.R"),
    warnings = list(
      "2011 source is the voluntary National Household Survey and is flagged voluntary_survey_nhs.",
      "2021 Census subdivision boundaries exceeded the 4 MB budget after the required simplification, so the public 2021 layer falls back to census divisions.",
      "2011 Census subdivision rows failed source reconciliation, so the public 2011 layer falls back to census divisions.",
      "1991 and 1981 stretch waves were deferred because open StatCan tables and period boundaries did not resolve in this pass.",
      "The launch brief's 2001 catalogue number was corrected to the official StatCan XML product 95F0450XCB2001006."
    ),
    notes = validation_notes
  ),
  privacy = "public",
  licence_status = "accepted",
  downstream_status = "public",
  notes = validation_notes
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null")
manifest_text <- readChar(manifest_out, nchars = file_bytes(manifest_out), useBytes = TRUE)
if (!jsonlite::validate(manifest_text)) stop("manifest json failed syntax validation", call. = FALSE)

message("wrote ", manifest_out_rel)
