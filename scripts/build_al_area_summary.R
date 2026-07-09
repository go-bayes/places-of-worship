# build the albania prefecture area-summary product from the 2011 and 2023
# population and housing censuses (INSTAT).
# inputs: the Census 2023 prefecture table "Tab. 1.13 Popullsia banuese sipas
# besimit fetar dhe gjinise" (resident population by religion and sex, by
# prefecture; SpreadsheetML .xls with one worksheet per prefecture), the twelve
# Census 2011 prefecture result booklets (each carrying table 1.1.13, resident
# population by religious affiliation), and the geoBoundaries ALB ADM1 (12
# prefectures) GeoJSON.
# outputs: apps/regions/al/data/al_prefecture_2023.geojson,
# apps/regions/al/data/area_summary_prefecture.{json,csv}, and
# docs/manifests/al-census-religion-2011-2023.json.
# run from the repo root: Rscript scripts/build_al_area_summary.R
# two census waves ship. both the 2011 and the 2023 census asked religious
# belief and published prefecture-level results on the same 12-prefecture (qark)
# geography. religion is a famously contested and non-response-heavy question in
# albania: in both waves a large share either preferred not to answer or was not
# stated/available, so those non-response categories are their own bucket,
# excluded from the stated-response denominator. the two headline shares use the
# stated-response denominator (population implied by named religions plus the
# atheist category, i.e. excluding the non-response categories).

suppressMessages({
  library(jsonlite)
  library(sf)
  library(xml2)
})

raw_dir <- "data/raw/al_census"
al_dir <- "apps/regions/al/data"
manifest_dir <- "docs/manifests"
dir.create(al_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- "2026-07-09"
script_id <- "scripts/build_al_area_summary.R"
country_code <- "AL"
years <- c(2011L, 2023L)

boundary_set_id <- "al-prefecture-2023-geoboundaries-adm1"
boundary_level <- "prefecture"
religion_2011_dataset_id <- "instat-census2011-prefecture-booklets-tab1113-religion"
religion_2023_dataset_id <- "instat-census2023-tab113-religion-by-prefecture"
boundary_dataset_id <- "geoboundaries-alb-adm1-2023"

# source urls recorded in the manifest and the on-page attribution.
census_landing_url <- "https://www.instat.gov.al/en/themes/censuses/census-of-population-and-housing/"
census_2011_pub_url <- "https://www.instat.gov.al/en/themes/censuses/census-of-population-and-housing/publications/2011/publications-of-population-and-housing-census-2011/"
tab113_2023_url <- "https://www.instat.gov.al/media/14411/tab_1_13_popullsia-banuese-sipas-besimit-fetar-dhe-gjinis%C3%AB_qarqe.xls"
geoboundaries_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/ALB/ADM1/"
geoboundaries_gj_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/ALB/ADM1/geoBoundaries-ALB-ADM1.geojson"

tab113_2023_path <- file.path(raw_dir, "al_2023_tab_1_13_religion_prefecture.xls")
geoboundaries_path <- file.path(raw_dir, "geoBoundaries-ALB-ADM1.geojson")
geoboundaries_meta_path <- file.path(raw_dir, "gb_alb_adm1_meta.json")

boundary_out <- file.path(al_dir, "al_prefecture_2023.geojson")
summary_json_out <- file.path(al_dir, "area_summary_prefecture.json")
summary_csv_out <- file.path(al_dir, "area_summary_prefecture.csv")
manifest_out <- file.path(manifest_dir, "al-census-religion-2011-2023.json")

# the twelve prefectures, spelled with diacritics as geoBoundaries and the
# census tables name them; these double as the join key (geoBoundaries shapeName
# matches exactly, so no name fix is needed). the vector order is alphabetical
# by the ascii transliteration, matching the 2011 booklet file order.
prefectures <- c("Berat", "Dibër", "Durrës", "Elbasan", "Fier",
                 "Gjirokastër", "Korçë", "Kukës", "Lezhë",
                 "Shkodër", "Tiranë", "Vlorë")
# 2011 prefecture booklet file slugs, in the same order as `prefectures`.
booklet_slugs <- c("berat", "diber", "durres", "elbasan", "fier", "gjirokaster",
                   "korce", "kukes", "lezhe", "shkoder", "tirane", "vlore")

licence_text <- paste(
  "Religion by prefecture is the Albanian Institute of Statistics (INSTAT),",
  "Population and Housing Census. The 2023 wave is table Tab. 1.13 (resident",
  "population by religion and sex, by prefecture); the 2011 wave is table 1.1.13",
  "(resident population by religious affiliation) in each of the twelve prefecture",
  "result booklets. INSTAT publishes its census results for open download and",
  "requests attribution; no explicit reuse licence is stated on the results, so",
  "the derived product attributes INSTAT and links the source of record.",
  "Boundaries are geoBoundaries ALB ADM1 (12 prefectures), boundary licence Public",
  "Domain, boundary source geoBoundaries and Wikipedia",
  "(geoboundaries.org/api/current/gbOpen/ALB/ADM1)."
)
licence_status <- "instat_census_open_release_attribution_geoboundaries_public_domain"

# ---- category harmonisation ----
# named religions counted as religious affiliation in both waves. "believers
# without denomination" (besimtare te pacilesuar; those who answered "I don't
# belong to any religion, but I am a believer") is counted as affiliation, per
# the czechia "verici" precedent: a self-declared believer is affiliated even
# without a named denomination. this is a documented modelling call; excluding
# it would lower the affiliation share, and its share grew sharply from 2011 to
# 2023, so the reading notes report it explicitly. "atheists" is the only
# no-religion category. the non-response categories (prefer not to answer, and
# not-stated/not-relevant in 2011 / not-available in 2023) are excluded from the
# stated-response denominator.
cats_2011 <- c("muslim", "bektashi", "catholic", "orthodox", "evangelist",
               "other_christian", "believers_wo_denom", "atheist",
               "other_religion", "prefer_not", "not_stated")
named_2011 <- c("muslim", "bektashi", "catholic", "orthodox", "evangelist",
                "other_christian", "believers_wo_denom", "other_religion")
nonresponse_2011 <- c("prefer_not", "not_stated")

# 2023 table categories, in printed row order (rows 6..15 of each worksheet).
cats_2023 <- c("muslim", "bektashi", "catholic", "orthodox", "evangelical",
               "other_religion", "believers_wo_denom", "atheist",
               "prefer_not", "not_available")
named_2023 <- c("muslim", "bektashi", "catholic", "orthodox", "evangelical",
                "other_religion", "believers_wo_denom")
nonresponse_2023 <- c("prefer_not", "not_available")

# printed national counts, used to reconcile the parsed prefecture sums (these
# are cross-checks, not inputs; the shipped numbers come from the parse).
national_2011 <- c(total = 2800138L, muslim = 1587608L, bektashi = 58628L,
                   catholic = 280921L, orthodox = 188992L, evangelist = 3797L,
                   other_christian = 1919L, believers_wo_denom = 153630L,
                   atheist = 69995L, other_religion = 602L, prefer_not = 386024L,
                   not_stated = 68022L)
national_2023 <- c(total = 2402113L, muslim = 1101718L, bektashi = 115644L,
                   catholic = 201530L, orthodox = 173645L, evangelical = 9658L,
                   other_religion = 3670L, believers_wo_denom = 332155L,
                   atheist = 85311L, prefer_not = 244331L, not_available = 134451L)

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
  if (grepl("\\.geojson$", path)) return(length(fromJSON(path, simplifyVector = FALSE)[["features"]]))
  if (grepl("\\.json$", path)) {
    json <- fromJSON(path, simplifyVector = FALSE)
    if (!is.null(json[["rows"]])) return(length(json[["rows"]]))
  }
  NA_integer_
}

# ---- parse the 2023 spreadsheetML religion table ----
# each worksheet is one prefecture; rows 6..15 (the rows whose first data cell is
# a plain integer, after the total row) carry the ten religion categories in the
# printed order. the total row (population) is the first integer-first-cell row.
# returns a per-prefecture named list of category counts plus a total.
parse_2023 <- function(xls_path) {
  doc <- read_xml(xls_path)
  ns <- c(ss = "urn:schemas-microsoft-com:office:spreadsheet")
  sheets <- xml_find_all(doc, ".//ss:Worksheet", ns)
  out <- list()
  for (sh in sheets) {
    nm <- xml_attr(sh, "ss:Name", ns = ns)
    rows <- xml_find_all(sh, ".//ss:Row", ns)
    # first numeric cell per row, keeping only rows whose first data value parses
    # as a pure integer (the total + ten category rows).
    firsts <- c()
    for (r in rows) {
      cells <- xml_find_all(r, "./ss:Cell/ss:Data", ns)
      if (length(cells) == 0L) next
      # the first cell is the (blank) label column; take the first cell whose
      # text is a plain integer, i.e. the Total column count.
      vals <- xml_text(cells)
      vals <- vals[grepl("^[0-9]+$", vals)]
      if (length(vals) > 0L) firsts <- c(firsts, as.integer(vals[1]))
    }
    if (length(firsts) < 11L) stop("prefecture ", nm, " has fewer than 11 numeric rows", call. = FALSE)
    total <- firsts[1]
    cat_vals <- setNames(firsts[2:11], cats_2023)
    out[[nm]] <- c(list(total = total), as.list(cat_vals))
  }
  out
}

# map the 2023 worksheet names (ascii, e.g. "Diber") onto the diacritic display
# names used everywhere else in the product.
ascii_key <- function(x) {
  x <- tolower(x)
  x <- gsub("ë", "e", x); x <- gsub("ç", "c", x)
  gsub("[^a-z]", "", x)
}

# ---- parse a single 2011 prefecture booklet (table 1.1.13) ----
# runs pdftotext -layout, anchors on the english "Muslims" label inside the
# religion table, and reads the first number on the line preceding each english
# category label. returns a named list of category counts plus a total.
first_number <- function(line) {
  m <- regmatches(line, regexpr("[0-9]{1,3}(?:[  ][0-9]{3})+|[0-9]+", line))
  if (length(m) == 0L) return(NA_integer_)
  as.integer(gsub("[  ]", "", m))
}
# english labels for the 2011 table 1.1.13, keyed to the harmonised category ids.
labels_2011 <- c("Total" = "total", "Muslims" = "muslim", "Bektashi" = "bektashi",
                 "Catholics" = "catholic", "Orthodox" = "orthodox",
                 "Evangelists" = "evangelist", "Other Christians" = "other_christian",
                 "Believers without denomination" = "believers_wo_denom",
                 "Atheists" = "atheist", "Others" = "other_religion",
                 "Prefer not to answer" = "prefer_not",
                 "Not relevant/not stated" = "not_stated")
parse_2011_booklet <- function(pdf_path) {
  pdftotext <- Sys.which("pdftotext")
  if (!nzchar(pdftotext)) stop("pdftotext (poppler) is required", call. = FALSE)
  txt_path <- tempfile(fileext = ".txt")
  on.exit(unlink(txt_path), add = TRUE)
  status <- system2(pdftotext, c("-layout", shQuote(pdf_path), shQuote(txt_path)))
  if (status != 0L) stop("pdftotext failed on ", pdf_path, call. = FALSE)
  lines <- readLines(txt_path, warn = FALSE, encoding = "UTF-8")
  # anchor on the first standalone "Muslims" english label (the religion table).
  anchor <- which(trimws(lines) == "Muslims")
  if (length(anchor) == 0L) stop("no religion table found in ", pdf_path, call. = FALSE)
  anchor <- anchor[1]
  win <- lines[max(1L, anchor - 6L):min(length(lines), anchor + 40L)]
  vals <- list()
  for (k in seq_along(win)) {
    ls <- sub("\\*+$", "", trimws(win[k]))
    if (!(ls %in% names(labels_2011))) next
    key <- unname(labels_2011[ls])
    for (back in (k - 1L):max(1L, k - 3L)) {
      v <- first_number(win[back])
      if (!is.na(v) && v > 0L) { vals[[key]] <- v; break }
    }
  }
  vals
}

# compute the two headline shares from a category vector using the
# stated-response denominator (named religions plus atheists, excluding the
# non-response categories). also returns the non-response count and share.
headline_shares <- function(cat_vals, named, nonresponse, total) {
  named_sum <- sum(unlist(cat_vals[named]))
  no_rel <- cat_vals[["atheist"]]
  nonresp <- sum(unlist(cat_vals[nonresponse]))
  stated <- named_sum + no_rel
  list(
    affiliation_percent = round(100 * named_sum / stated, 2),
    no_religion_percent = round(100 * no_rel / stated, 2),
    stated_total = stated,
    nonresponse_count = nonresp,
    nonresponse_percent = round(100 * nonresp / total, 2)
  )
}

# metric CRS for area and metre-tolerance simplification; lambert azimuthal
# equal area centred on albania keeps every prefecture true.
al_laea <- "+proj=laea +lat_0=41 +lon_0=20 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"
al_slug <- function(x) {
  x <- ascii_key(x)
  x
}

read_boundary <- function(path) {
  gb <- st_read(path, quiet = TRUE)
  if (nrow(gb) != 12L) stop("expected 12 geoBoundaries ALB ADM1 prefectures", call. = FALSE)
  gb <- st_make_valid(gb)
  gb_metric <- st_transform(gb, al_laea)
  gb[["area_name"]] <- as.character(gb[["shapeName"]])
  if (any(!(gb[["area_name"]] %in% prefectures))) {
    stop("geoBoundaries prefecture name not in the census set: ",
         paste(setdiff(gb[["area_name"]], prefectures), collapse = "; "), call. = FALSE)
  }
  gb[["area_code"]] <- vapply(gb[["area_name"]], al_slug, character(1))
  gb[["area_unit_id"]] <- paste0(boundary_set_id, ":", gb[["area_code"]])
  gb[["boundary_set_id"]] <- boundary_set_id
  gb[["boundary_level"]] <- boundary_level
  gb[["prefecture_iso"]] <- as.character(gb[["shapeISO"]])
  gb[["shape_id"]] <- as.character(gb[["shapeID"]])
  gb[["land_area_sq_km"]] <- as.numeric(st_area(gb_metric)) / 1e6
  if (any(duplicated(gb[["area_code"]]))) stop("duplicate prefecture area codes", call. = FALSE)
  missing <- setdiff(prefectures, gb[["area_name"]])
  if (length(missing) > 0L) stop("census prefectures absent from geoBoundaries: ",
                                  paste(missing, collapse = "; "), call. = FALSE)
  gb
}

build_area_row <- function(area_code, area_name, area_unit_id, land_area_sq_km,
                           year, population_total, population_total_basis,
                           affiliation_percent, no_religion_percent,
                           source_ids, quality_flag) {
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = area_unit_id,
    area_code = as.character(area_code),
    area_name = area_name,
    year = year,
    population_total = null_if_na(as.integer(population_total)),
    population_total_basis = population_total_basis,
    religious_affiliation_count = NULL,
    religious_affiliation_percent = null_if_na(affiliation_percent),
    no_religion_count = NULL,
    no_religion_percent = null_if_na(no_religion_percent),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(land_area_sq_km, 2),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = source_ids,
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
      religious_affiliation_count = NA_integer_,
      religious_affiliation_percent = csv_scalar(row[["religious_affiliation_percent"]], NA_real_),
      no_religion_count = NA_integer_,
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

# write the boundary, increasing simplification tolerance until it is small.
# albania is a small country, so a light tolerance keeps the prefecture outlines
# crisp while staying well under the size budget.
write_simplified_boundary <- function(boundary, output_path, field_names) {
  boundary_fields <- boundary[, field_names]
  tolerances <- c(50, 100, 200, 500, 1000)
  for (tolerance in tolerances) {
    candidate <- st_transform(boundary_fields, al_laea)
    candidate <- st_simplify(candidate, dTolerance = tolerance, preserveTopology = TRUE)
    candidate <- st_make_valid(st_transform(candidate, 4326))
    if (any(st_is_empty(candidate))) next
    st_write(candidate, output_path, driver = "GeoJSON", delete_dsn = TRUE,
             quiet = TRUE, layer_options = c("COORDINATE_PRECISION=5"))
    bytes <- file_bytes(output_path)
    if (bytes <= 3000000L) return(list(tolerance_m = tolerance, bytes = bytes))
  }
  stop("simplified AL prefecture boundary remains above 3 MB", call. = FALSE)
}

denominator_note <- paste(
  "Percentages use the stated-response denominator (the prefecture population",
  "implied by named religions plus the atheist category, i.e. excluding the",
  "non-response categories: prefer-not-to-answer and not-stated/not-available).",
  "Religious affiliation is every named religion (Muslim, Bektashi, Catholic,",
  "Orthodox, Evangelical, other religion, and believers without denomination); no",
  "religion is the Atheist category. The two shares sum to 100 percent of stated",
  "responses. Non-response is historically large in Albania, where the census",
  "religion question is contested: nationally about 16.2 percent of residents in",
  "2011 and 15.8 percent in 2023 gave no usable religious answer, so the",
  "stated-response shares rest on a base that excludes roughly one resident in six."
)

source_datasets <- function() {
  list(
    list(
      source_dataset_id = religion_2023_dataset_id,
      name = "INSTAT Population and Housing Census 2023, Tab. 1.13: resident population by religion and sex, by prefecture",
      provider = "Institute of Statistics of Albania (INSTAT)",
      url = tab113_2023_url,
      retrieval_date = retrieval_date,
      local_path = tab113_2023_path,
      licence = list(
        name = "INSTAT census results, open download; attribution requested, no explicit reuse licence stated",
        url = census_landing_url,
        attribution = "Institute of Statistics of Albania (INSTAT)"
      ),
      citation = "INSTAT, Population and Housing Census 2023, Tab. 1.13 (resident population by religion and sex, by prefecture).",
      access_limits = NULL,
      redistribution_limits = "The source table is not committed; the derived public product attributes INSTAT and links the source.",
      notes = paste(
        "SpreadsheetML workbook with one worksheet per prefecture. Each worksheet prints the resident population total and",
        "ten religion categories in printed order: Muslim, Muslim-Bektashi, Christian-Catholic, Christian-Orthodox,",
        "Christian-Evangelical (Protestant), Other religion or faith, Believers without denomination (besimtare te",
        "pacilesuar), Atheists, Prefer not to answer, and Not available. The parsed prefecture sums reproduce the printed",
        "national counts exactly (total 2,402,113)."
      )
    ),
    list(
      source_dataset_id = religion_2011_dataset_id,
      name = "INSTAT Population and Housing Census 2011, prefecture result booklets, table 1.1.13: resident population by religious affiliation",
      provider = "Institute of Statistics of Albania (INSTAT)",
      url = census_2011_pub_url,
      retrieval_date = retrieval_date,
      local_path = file.path(raw_dir, "al_2011_11_tirane.pdf"),
      licence = list(
        name = "INSTAT census results, open download; attribution requested, no explicit reuse licence stated",
        url = census_landing_url,
        attribution = "Institute of Statistics of Albania (INSTAT)"
      ),
      citation = "INSTAT, Population and Housing Census 2011, prefecture result booklets, table 1.1.13.",
      access_limits = NULL,
      redistribution_limits = "The source booklet PDFs are not committed; the derived public product attributes INSTAT and links the source.",
      notes = paste(
        "Twelve prefecture result booklets (one per qark). Table 1.1.13 prints the resident population total and eleven",
        "religion categories: Muslims, Bektashi, Catholics, Orthodox, Evangelists, Other Christians, Believers without",
        "denomination, Atheists, Others, Prefer not to answer, and Not relevant/not stated. The booklet footnote defines",
        "believers without denomination as persons who answered 'I don't belong to any religion, but I am a believer'. The",
        "parsed prefecture sums reproduce the printed national counts exactly (total 2,800,138)."
      )
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "geoBoundaries ALB ADM1 (12 prefectures)",
      provider = "geoBoundaries (William & Mary geoLab)",
      url = geoboundaries_gj_url,
      retrieval_date = retrieval_date,
      local_path = geoboundaries_path,
      licence = list(
        name = "Public Domain (geoBoundaries gbOpen; boundary source geoBoundaries and Wikipedia)",
        url = geoboundaries_meta_url,
        attribution = "geoBoundaries (gbOpen); boundary source geoBoundaries and Wikipedia"
      ),
      citation = "Runfola et al., geoBoundaries ALB ADM1 (gbOpen), prefecture boundaries.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary is committed with attribution to geoBoundaries; the boundary licence is Public Domain.",
      notes = "12 ADM1 prefectures. The geoBoundaries shapeName matches the census prefecture names exactly (with diacritics), so the join is by name with no correction. Source data update 2023-01-19."
    )
  )
}

indicators_for_prefecture <- function() {
  list(
    list(
      indicator_id = "population_total",
      label = "Census population denominator",
      description = "Prefecture total resident population (INSTAT Census, 2011 and 2023).",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "Exact prefecture resident-population total from the census religion table (2011 table 1.1.13 booklets; 2023 Tab. 1.13).",
      temporal_coverage = "2011, 2023",
      spatial_coverage = "Albania prefectures (geoBoundaries ALB ADM1, 12 prefectures).",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious affiliation %",
      description = "Share of stated responses declaring any named religion (including believers without denomination).",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * (sum of named-religion counts) / (named-religion counts + atheist count).",
      temporal_coverage = "2011, 2023",
      spatial_coverage = "Albania prefectures (geoBoundaries ALB ADM1).",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "No religion %",
      description = "Share of stated responses reporting atheism.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * (atheist count) / (named-religion counts + atheist count).",
      temporal_coverage = "2011, 2023",
      spatial_coverage = "Albania prefectures (geoBoundaries ALB ADM1).",
      quality_notes = denominator_note
    )
  )
}

visual_layers_for_prefecture <- function() {
  list(
    list(
      visual_layer_id = "al-prefecture-religious-affiliation",
      label = "Religious affiliation %",
      description = "Albania census 2011-2023 religious-affiliation share by prefecture.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "stated responses in the census religion tabulation"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = "All named religions, including believers without denomination, count as religious affiliation in both waves."
    ),
    list(
      visual_layer_id = "al-prefecture-no-religion",
      label = "No religion %",
      description = "Albania census 2011-2023 no-religion (atheist) share by prefecture.",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "stated responses in the census religion tabulation"),
      colour_scale = "sequential",
      time_control = "year_selector",
      aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = "The Atheist category of each prefecture in both waves; the large non-response bucket is excluded from the denominator."
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
      vintage = "2023",
      source_dataset_id = boundary_dataset_id
    ),
    site_snapshot = list(
      source_dataset_id = NULL,
      snapshot_date = NULL,
      basis = "no governed Albania OpenStreetMap place-of-worship snapshot is included in this country data-map release",
      notes = "The Albania page exposes census religious-affiliation and no-religion metrics only; place-density metrics are hidden until a governed Albania place layer is built."
    ),
    source_datasets = source_datasets(),
    indicators = indicators_for_prefecture(),
    visual_layers = visual_layers_for_prefecture(),
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
booklet_paths <- file.path(raw_dir, sprintf("al_2011_%d_%s.pdf", seq_along(booklet_slugs), booklet_slugs))
required_sources <- c(tab113_2023_path, geoboundaries_path, booklet_paths)
invisible(lapply(required_sources, require_file))

# ---- parse 2023 ----
raw23 <- parse_2023(tab113_2023_path)
# map ascii worksheet names -> diacritic display names.
name_by_key <- setNames(prefectures, vapply(prefectures, ascii_key, character(1)))
rel23 <- setNames(vector("list", length(prefectures)), prefectures)
for (nm in names(raw23)) {
  disp <- name_by_key[[ascii_key(nm)]]
  if (is.null(disp)) stop("2023 worksheet name did not map to a prefecture: ", nm, call. = FALSE)
  rel23[[disp]] <- raw23[[nm]]
}
for (p in prefectures) if (is.null(rel23[[p]])) stop("missing 2023 prefecture: ", p, call. = FALSE)

# ---- parse 2011 ----
rel11 <- setNames(vector("list", length(prefectures)), prefectures)
for (i in seq_along(prefectures)) {
  vals <- parse_2011_booklet(booklet_paths[i])
  for (k in c("total", cats_2011)) {
    if (is.null(vals[[k]])) stop("missing 2011 category ", k, " for ", prefectures[i], call. = FALSE)
  }
  # every prefecture total must equal the sum of its categories.
  s <- sum(unlist(vals[cats_2011]))
  if (s != vals[["total"]]) stop("2011 ", prefectures[i], " total ", vals[["total"]],
                                 " != sum of categories ", s, call. = FALSE)
  rel11[[prefectures[i]]] <- vals
}

# ---- national reconciliation: parsed prefecture sums vs printed national ----
reconcile <- function(rel, cats, national, label) {
  parsed <- c(total = sum(vapply(prefectures, function(p) rel[[p]][["total"]], numeric(1))))
  for (cc in cats) parsed[cc] <- sum(vapply(prefectures, function(p) rel[[p]][[cc]], numeric(1)))
  diffs <- list()
  for (nm in names(national)) {
    d <- as.integer(parsed[[nm]]) - as.integer(national[[nm]])
    diffs[[nm]] <- d
    if (d != 0L) stop(label, " reconciliation failed for ", nm, ": parsed ", parsed[[nm]],
                      " vs national ", national[[nm]], call. = FALSE)
  }
  list(parsed = parsed, diffs = diffs)
}
recon11 <- reconcile(rel11, cats_2011, national_2011, "2011")
recon23 <- reconcile(rel23, cats_2023, national_2023, "2023")

# ---- per-prefecture headline shares per wave ----
shares11 <- lapply(prefectures, function(p) headline_shares(rel11[[p]], named_2011, nonresponse_2011, rel11[[p]][["total"]]))
names(shares11) <- prefectures
shares23 <- lapply(prefectures, function(p) headline_shares(rel23[[p]], named_2023, nonresponse_2023, rel23[[p]][["total"]]))
names(shares23) <- prefectures

# national stated-response shares (for reporting).
nat_share <- function(rel, named, nonresponse, total) headline_shares(
  setNames(lapply(c(named, "atheist", nonresponse), function(cc)
    sum(vapply(prefectures, function(p) rel[[p]][[cc]], numeric(1)))), c(named, "atheist", nonresponse)),
  named, nonresponse, total)
nat11 <- nat_share(rel11, named_2011, nonresponse_2011, national_2011[["total"]])
nat23 <- nat_share(rel23, named_2023, nonresponse_2023, national_2023[["total"]])

# ---- boundary ----
boundary <- read_boundary(geoboundaries_path)
boundary_write <- write_simplified_boundary(
  boundary, boundary_out,
  c("area_code", "area_name", "area_unit_id", "boundary_set_id",
    "boundary_level", "prefecture_iso", "shape_id", "land_area_sq_km")
)
if (row_count_file(boundary_out) != nrow(boundary)) {
  stop("prefecture boundary feature count changed during simplification", call. = FALSE)
}

# ---- assemble rows: waves ascending, prefectures in area-name order ----
basis_by_year <- function(y, nonresp_label) paste0(
  "prefecture resident-population total from INSTAT Census ", y, " (",
  if (y == 2011L) "prefecture booklet table 1.1.13" else "Tab. 1.13", "); ",
  "the stated-response denominator for the percentages excludes the non-response ",
  "categories (prefer-not-to-answer and ", nonresp_label, ")"
)
flag_by_year <- function(y, share) paste(
  "stated_response_denominator_excludes_nonresponse",
  "named_religions_in_religious_affiliation",
  "believers_without_denomination_counted_as_affiliation",
  "no_religion_category_is_atheist",
  "population_denominator_exact_from_census_religion_table",
  paste0("nonresponse_share_of_residents_percent=", share[["nonresponse_percent"]]),
  if (y == 2011L) "census_2011_first_post_communist_religion_question" else "boundaries_geoboundaries_adm1_2023_vintage",
  sep = ";"
)

order_idx <- order(boundary[["area_name"]])
rows <- list()
build_wave <- function(y, rel, shares, nonresp_label) {
  for (i in order_idx) {
    p <- boundary[["area_name"]][i]
    s <- shares[[p]]
    rows[[length(rows) + 1L]] <<- build_area_row(
      area_code = boundary[["area_code"]][i], area_name = p,
      area_unit_id = boundary[["area_unit_id"]][i], land_area_sq_km = boundary[["land_area_sq_km"]][i],
      year = y, population_total = rel[[p]][["total"]], population_total_basis = basis_by_year(y, nonresp_label),
      affiliation_percent = s[["affiliation_percent"]], no_religion_percent = s[["no_religion_percent"]],
      source_ids = if (y == 2011L) c(religion_2011_dataset_id, boundary_dataset_id) else c(religion_2023_dataset_id, boundary_dataset_id),
      quality_flag = flag_by_year(y, s)
    )
  }
}
build_wave(2011L, rel11, shares11, "not-stated/not-relevant")
build_wave(2023L, rel23, shares23, "not-available")

write_json(area_summary_document(rows), summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

join_coverage <- lapply(years, function(y) {
  list(boundary_level = boundary_level, year = y,
       matched_area_count = 12L, expected_area_count = nrow(boundary),
       missing_area_names = list())
})

national_reconciliation <- list(
  list(year = 2011L, metric = "population_total", area_sum = as.integer(recon11[["parsed"]][["total"]]),
       national_total = unname(national_2011[["total"]]), difference = recon11[["diffs"]][["total"]]),
  list(year = 2023L, metric = "population_total", area_sum = as.integer(recon23[["parsed"]][["total"]]),
       national_total = unname(national_2023[["total"]]), difference = recon23[["diffs"]][["total"]])
)

validation_checks <- c(
  "Two census waves ship (2011, 2023). Both the 2011 and the 2023 Albanian censuses asked religious belief and published prefecture-level results on the same twelve-prefecture (qark) geography; every prefecture in every wave joins the geoBoundaries ALB ADM1 features by name.",
  "The parsed prefecture category counts sum exactly to the printed national counts in both waves (2011 total 2,800,138; 2023 total 2,402,113), and each prefecture total equals the sum of its own religion categories.",
  "Percentages use the stated-response denominator (named religions plus the atheist category, excluding the non-response categories); religious affiliation and no religion sum to 100 percent of stated responses in every prefecture and wave.",
  "Believers without denomination (persons who answered 'I don't belong to any religion, but I am a believer') are counted as religious affiliation, per the Czechia believers-without-denomination precedent. Their share grew sharply from 5.49 percent of residents in 2011 to 13.82 percent in 2023, so it is reported explicitly; excluding it would lower the affiliation share.",
  sprintf("Non-response is historically large in Albania's contested religion question: nationally %.2f percent of residents in 2011 and %.2f percent in 2023 gave no usable religious answer (prefer-not-to-answer plus not-stated/not-available), and these are excluded from the stated-response denominator.", nat11[["nonresponse_percent"]], nat23[["nonresponse_percent"]]),
  "All 12 census prefectures join to the 12 geoBoundaries ALB ADM1 features by name (Berat, Diber, Durres, Elbasan, Fier, Gjirokaster, Korce, Kukes, Lezhe, Shkoder, Tirane, Vlore, with diacritics); geoBoundaries shapeName matches the census names exactly, so no name fix is required.",
  sprintf("The simplified prefecture boundary GeoJSON writes to %d bytes after %d m simplification (12 prefecture features).", as.integer(boundary_write[["bytes"]]), boundary_write[["tolerance_m"]]),
  "The 2001 census did not publish a comparable prefecture religion table in this source sweep (the 2001 question set differs), so 2001 is not shipped; a municipality-level downscaling of either wave is deferred."
)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:al-census-religion:al:2011-2023:instat-census",
  dataset_id = "al-census-religion:al:2011-2023:instat-census",
  dataset_version_id = paste0("al-census-religion:al:2011-2023:instat-census:", substr(sha256_file(summary_json_out), 1, 12)),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "al-census-religion",
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
      waves = c("2011", "2023"),
      prefecture_boundary_set = boundary_set_id,
      prefecture_boundary_simplification_tolerance_m = boundary_write[["tolerance_m"]],
      extraction = "2023 Tab. 1.13 SpreadsheetML parsed with xml2 (12 worksheets); 2011 table 1.1.13 parsed from the 12 prefecture booklet PDFs with poppler pdftotext -layout",
      denominator = "stated responses (named religions plus atheists, excluding prefer-not-to-answer and not-stated/not-available); affiliation = named religions including believers without denomination, no religion = atheists",
      subnational_geography = "geoBoundaries ALB ADM1 (12 prefectures), joined by name",
      omitted_metrics = c("religious_change", "places_per_10000_residents", "place_density_per_sq_km"),
      counts_published = "religion is published as counts; the product ships the two headline shares with the exact prefecture population as denominator",
      believers_without_denomination = "counted as religious affiliation per the Czechia precedent; share 5.49% (2011) to 13.82% (2023) of residents nationally"
    ),
    software_versions = list(
      r = paste(R.version[["major"]], R.version[["minor"]], sep = "."),
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")),
      xml2 = as.character(packageVersion("xml2")),
      pdftotext = "poppler pdftotext (system)"
    )
  ),
  source = list(
    provider = "Institute of Statistics of Albania (INSTAT); geoBoundaries (William & Mary geoLab)",
    source_dataset_ids = c(religion_2011_dataset_id, religion_2023_dataset_id, boundary_dataset_id),
    source_urls = c(census_2011_pub_url, tab113_2023_url, geoboundaries_meta_url, geoboundaries_gj_url),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = licence_text,
    citation = "INSTAT, Population and Housing Census 2011 (prefecture booklets, table 1.1.13) and 2023 (Tab. 1.13); geoBoundaries ALB ADM1 (gbOpen).",
    raw_redistribution = "The census source tables and booklet PDFs and the geoBoundaries source GeoJSON are not committed. They remain in data/raw/al_census/ and await any project-controlled raw archive upload."
  ),
  input_manifests = list(),
  raw_sources = c(
    list(
      raw_source_record(tab113_2023_path, tab113_2023_url, "xls", 12L, religion_2023_dataset_id, TRUE, "2023",
        "Census 2023 Tab. 1.13 SpreadsheetML; one worksheet per prefecture, resident population by religion (10 categories) and sex."),
      raw_source_record(geoboundaries_path, geoboundaries_gj_url, "geojson", 12L, boundary_dataset_id, TRUE, "2023",
        "geoBoundaries ALB ADM1 GeoJSON; 12 prefecture features. Boundary licence Public Domain, boundary source geoBoundaries and Wikipedia."),
      raw_source_record(geoboundaries_meta_path, geoboundaries_meta_url, "json", NA_integer_, boundary_dataset_id, FALSE, "2023",
        "geoBoundaries ALB ADM1 metadata; records the Public Domain boundary licence, boundary source, and the pinned release commit 9469f09.")
    ),
    lapply(seq_along(booklet_paths), function(i) raw_source_record(
      booklet_paths[i], sprintf("%s (booklet %d, %s)", census_2011_pub_url, i, booklet_slugs[i]),
      "pdf", 12L, religion_2011_dataset_id, TRUE, "2011",
      sprintf("Census 2011 prefecture booklet for %s; table 1.1.13 supplies the resident population by religious affiliation (11 categories).", prefectures[i])))
  ),
  durable_files = list(
    manifest_file_record(summary_json_out, "Albania prefecture area summary with census 2011 and 2023 religious-affiliation and no-religion metrics.", licence_status),
    manifest_file_record(summary_csv_out, "Flattened Albania prefecture area summary with census 2011 and 2023 religious-affiliation and no-religion metrics.", licence_status),
    manifest_file_record(boundary_out, "Simplified Albania prefecture boundary GeoJSON derived from geoBoundaries ALB ADM1 (12 prefectures).", "geoboundaries_public_domain")
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out),
         built_by = script_id, notes = "12 prefecture reporting units x 2 census years (2011, 2023); stated-response denominator, percent-primary."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out),
         built_by = script_id, notes = sprintf("12 geoBoundaries ALB ADM1 prefecture features simplified at %d m tolerance.", boundary_write[["tolerance_m"]]))
  ),
  validation = list(
    checks = validation_checks,
    join_coverage = list(prefecture = join_coverage),
    national_reconciliation = national_reconciliation,
    national_stated_response = list(
      "2011" = list(year = 2011L, affiliation_percent = nat11[["affiliation_percent"]],
                    no_religion_percent = nat11[["no_religion_percent"]],
                    nonresponse_share_of_residents_percent = nat11[["nonresponse_percent"]],
                    believers_without_denomination_share_of_residents_percent = round(100 * national_2011[["believers_wo_denom"]] / national_2011[["total"]], 2)),
      "2023" = list(year = 2023L, affiliation_percent = nat23[["affiliation_percent"]],
                    no_religion_percent = nat23[["no_religion_percent"]],
                    nonresponse_share_of_residents_percent = nat23[["nonresponse_percent"]],
                    believers_without_denomination_share_of_residents_percent = round(100 * national_2023[["believers_wo_denom"]] / national_2023[["total"]], 2))
    ),
    boundary_validation = list(
      source_al_prefecture_count = 12L,
      output_feature_count = row_count_file(boundary_out),
      expected_feature_count = nrow(boundary),
      output_bytes = boundary_write[["bytes"]],
      simplification_tolerance_m = boundary_write[["tolerance_m"]],
      unmatched_boundary_features = list(),
      unmatched_census_areas = list(),
      name_fixes = list()
    )
  ),
  construct_notes = list(
    "The public map displays two headline metrics for 2011 and 2023 at prefecture level: religious affiliation percent and no religion percent.",
    "Percentages use the stated-response denominator: named religions plus the atheist category, excluding the non-response categories. Religious affiliation is every named religion (Muslim, Bektashi, Catholic, Orthodox, Evangelical, other religion, believers without denomination); no religion is the Atheist category. The two shares sum to 100 percent of stated responses.",
    "Non-response is historically large and the religion question is politically contested in Albania. In 2011 the non-response categories (prefer not to answer, plus not-relevant/not-stated) were 16.22 percent of residents nationally; in 2023 (prefer not to answer, plus not available) they were 15.77 percent. These are excluded from the stated-response denominator, so the shares rest on a base that omits roughly one resident in six.",
    "Believers without denomination are counted as religious affiliation (the census footnote defines them as persons who answered 'I don't belong to any religion, but I am a believer'). This is a documented modelling call, following the Czechia believers precedent. Their national share rose from 5.49 percent of residents in 2011 to 13.82 percent in 2023, so a growing part of the affiliation figure is undenominational belief rather than a named religion.",
    "The 2011 census asked religious belief for the first time since the fall of communism, and the Orthodox Autocephalous Church of Albania publicly disputed the 2011 Orthodox figure. The product ships INSTAT's published counts as the record and does not adjudicate the dispute; the large non-response share is the main reason to read every share with care.",
    "Categories differ slightly between waves: 2011 reports Other Christians and Others as separate small categories, while 2023 folds minor faiths into a single Other religion category. Both are grouped under named-religion affiliation, so the two headline shares stay comparable across waves."
  ),
  deferred_sources = list(
    list(
      source_dataset_id = "instat-census-2001-religion",
      url = census_landing_url,
      local_path = NULL,
      notes = "The 2001 census did not expose a comparable prefecture religion table in this source sweep; the 2001 question set differs. A 2001 wave is deferred rather than fabricated."
    ),
    list(
      source_dataset_id = "instat-census-municipality-religion",
      url = census_landing_url,
      local_path = NULL,
      notes = "INSTAT publishes 2023 census results down to municipality level, and the 2011 booklets carry commune-level detail. The first product anchors on the 12 prefectures for 2011-2023 comparability; a municipality (bashki) downscaling is deferred to a later build."
    )
  ),
  privacy = "public",
  licence_status = licence_status,
  downstream_status = "public",
  source_datasets = source_datasets(),
  notes = "The committed products contain the derived prefecture area summary and simplified boundary only. On-page attribution cites INSTAT and geoBoundaries (boundary licence Public Domain, source geoBoundaries and Wikipedia)."
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
manifest_text <- paste(readLines(manifest_out, warn = FALSE), collapse = "\n")
if (!jsonlite::validate(manifest_text)) stop("manifest JSON failed jsonlite validation", call. = FALSE)

cat(sprintf("wrote %s: %d rows\n", summary_json_out, length(rows)))
cat(sprintf("wrote %s: %d rows\n", summary_csv_out, row_count_file(summary_csv_out)))
cat(sprintf("wrote %s: %d features, %d bytes at %d m\n", boundary_out, row_count_file(boundary_out),
            as.integer(file_bytes(boundary_out)), boundary_write[["tolerance_m"]]))
cat(sprintf("wrote %s\n", manifest_out))
cat("join coverage: 12/12 prefectures for 2011 and 2023 (geoBoundaries shapeName == census name, no fixes)\n")
cat(sprintf("2011 national reconciliation: parsed total %d vs printed %d (diff %d)\n",
            as.integer(recon11[["parsed"]][["total"]]), national_2011[["total"]], recon11[["diffs"]][["total"]]))
cat(sprintf("2023 national reconciliation: parsed total %d vs printed %d (diff %d)\n",
            as.integer(recon23[["parsed"]][["total"]]), national_2023[["total"]], recon23[["diffs"]][["total"]]))
cat(sprintf("2011 national stated-response: affiliation %.2f%%, no religion %.2f%%; non-response %.2f%% of residents; believers-without-denom %.2f%%\n",
            nat11[["affiliation_percent"]], nat11[["no_religion_percent"]], nat11[["nonresponse_percent"]],
            round(100 * national_2011[["believers_wo_denom"]] / national_2011[["total"]], 2)))
cat(sprintf("2023 national stated-response: affiliation %.2f%%, no religion %.2f%%; non-response %.2f%% of residents; believers-without-denom %.2f%%\n",
            nat23[["affiliation_percent"]], nat23[["no_religion_percent"]], nat23[["nonresponse_percent"]],
            round(100 * national_2023[["believers_wo_denom"]] / national_2023[["total"]], 2)))
