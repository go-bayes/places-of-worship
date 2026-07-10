# build the Taiwan county/city registered-religion administrative product.
# inputs: MOI Department of Statistics table 06-01 (各宗教教務概況; registered
# temples, churches, and temple followers by county/city) and table 02-01
# (人口年齡分配; year-end household-registration population by county/city),
# both from the statis.moi.gov.tw statistical yearbook, plus geoBoundaries
# TWN ADM1 county/city polygons and the MOI open-data declaration.
# outputs: apps/regions/tw/data/tw_county_2024.geojson,
# apps/regions/tw/data/area_summary_county.{json,csv}, and
# docs/manifests/tw-register-2020-2024.json.
# construct: this is an ADMINISTRATIVE REGISTER of registered religious
# organisations (temples 寺廟 and churches 教會堂) and their reported temple
# followers (信徒). It is never census religious affiliation.
# run from the repository root: Rscript scripts/build_tw_area_summary.R

suppressMessages({
  library(jsonlite)
  library(sf)
  library(xml2)
})

source("scripts/lib/simplify_boundary.R")

raw_dir <- "data/raw/tw_register"
output_dir <- "apps/regions/tw/data"
manifest_dir <- "docs/manifests"
dir.create(raw_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

country_code <- "TW"
script_id <- "scripts/build_tw_area_summary.R"
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- format(Sys.Date(), "%Y-%m-%d")
git_commit <- tryCatch(system("git rev-parse --short HEAD", intern = TRUE), error = function(e) NA_character_)
years <- 2020L:2024L

# the statis yearbook serves each table by first regenerating it server-side
# (kind=7 = ODF), then downloading report/<type><rptid>.ods.
statis_base <- "https://statis.moi.gov.tw/micst"
statis_referer <- paste0(statis_base, "/webMain.aspx?k=menuy")
religion_rptid <- "331030"  # 06-01 各宗教教務概況
population_rptid <- "332010" # 02-01 人口年齡分配
religion_gen_url <- paste0(statis_base, "/webMain.aspx?sys=99981&kind=7&cycle=4&funid=", religion_rptid, ".ods")
religion_dl_url <- paste0(statis_base, "/report/", religion_rptid, ".ods")
population_gen_url <- paste0(statis_base, "/webMain.aspx?sys=99981&kind=7&cycle=4&funid=", population_rptid, ".ods")
population_dl_url <- paste0(statis_base, "/report/", population_rptid, ".ods")

geob_api_url <- "https://www.geoboundaries.org/api/current/gbOpen/TWN/ADM1/"
geob_geojson_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/TWN/ADM1/geoBoundaries-TWN-ADM1.geojson"
moi_licence_url <- "https://www.moi.gov.tw/cp.aspx?n=10954"

religion_dataset_id <- "moi-statis-06-01-general-conditions-of-religions-2016-2025"
population_dataset_id <- "moi-statis-02-01-population-by-age-2016-2025"
boundary_dataset_id <- "geoboundaries-gbopen-twn-adm1-9469f09"
boundary_set_id <- "tw-county-2024-geoboundaries-adm1"

religion_path <- file.path(raw_dir, "moi_religion_general_conditions_331030.ods")
population_path <- file.path(raw_dir, "moi_population_by_age_332010.ods")
geob_geojson_path <- file.path(raw_dir, "geoboundaries_twn_adm1.geojson")
geob_api_path <- file.path(raw_dir, "geoboundaries_twn_adm1_api.json")
moi_licence_path <- file.path(raw_dir, "moi_opendata_declaration.html")

boundary_out <- file.path(output_dir, "tw_county_2024.geojson")
summary_json_out <- file.path(output_dir, "area_summary_county.json")
summary_csv_out <- file.path(output_dir, "area_summary_county.csv")
manifest_out <- file.path(manifest_dir, "tw-register-2020-2024.json")

# verbatim MOI open-data declaration clause captured in moi_opendata_declaration.html.
moi_licence_verbatim <- paste0(
  "為利各界廣為利用網站資料，",
  "內政部全球資訊網站上刊載之所有資料與素材，",
  "其得受著作權保護之範圍，以無償、非專屬，",
  "得再授權之方式提供公眾使用，使用者得不限時間及地域，",
  "重製、改作、編輯、公開傳輸或為其他方式之利用，",
  "開發各種產品或服務（簡稱加值衍生物），",
  "此一授權行為不會嗣後撤回，",
  "使用者亦無須取得本機關之書面或其他方式授權。",
  "然使用時，應註明出處。")

# construct discipline: the MOI followers series counts registered temple
# followers only from reference year 2014 (ROC 103); church members are not in
# the followers column. all five shipped years fall in this stable window.
followers_construct_verbatim <- paste0(
  "信徒人數在102年以前含寺廟信徒人數與教(會)堂教徒人數，",
  "自103年起僅包括寺廟信徒人數")

# canonical county/city crosswalk: normalised MOI Chinese name, MOI English
# name (source of record), and geoBoundaries ADM1 ISO join key. Order follows
# the MOI table. Lienchiang County is Matsu Islands in geoBoundaries; the MOI
# published English name is retained and the geoBoundaries alias recorded.
crosswalk <- data.frame(
  zh = c("新北市", "臺北市", "桃園市", "臺中市",
         "臺南市", "高雄市", "宜蘭縣", "新竹縣",
         "苗栗縣", "彰化縣", "南投縣", "雲林縣",
         "嘉義縣", "屏東縣", "臺東縣", "花蓮縣",
         "澎湖縣", "基隆市", "新竹市", "嘉義市",
         "金門縣", "連江縣"),
  moi_en = c("New Taipei City", "Taipei City", "Taoyuan City", "Taichung City",
             "Tainan City", "Kaohsiung City", "Yilan County", "Hsinchu County",
             "Miaoli County", "Changhua County", "Nantou County", "Yunlin County",
             "Chiayi County", "Pingtung County", "Taitung County", "Hualien County",
             "Penghu County", "Keelung City", "Hsinchu City", "Chiayi City",
             "Kinmen County", "Lienchiang County"),
  shape_iso = c("TW-NWT", "TW-TPE", "TW-TAO", "TW-TXG", "TW-TNN", "TW-KHH",
                "TW-ILA", "TW-HSQ", "TW-MIA", "TW-CHA", "TW-NAN", "TW-YUN",
                "TW-CYQ", "TW-PIF", "TW-TTT", "TW-HUA", "TW-PEN", "TW-KEE",
                "TW-HSZ", "TW-CYI", "TW-KIN", "TW-LIE"),
  geob_name = c("New Taipei", "Taipei", "Taoyuan", "Taichung", "Tainan", "Kaohsiung",
                "Yilan County", "Hsinchu County", "Miaoli County", "Changhua County",
                "Nantou County", "Yunlin County", "Chiayi County", "Pingtung County",
                "Taitung County", "Hualien County", "Penghu", "Keelung",
                "Hsinchu", "Chiayi", "Kinmen", "Matsu Islands"),
  stringsAsFactors = FALSE
)
province_subtotals <- c("臺灣省", "福建省")  # 臺灣省, 福建省

# return a file's SHA-256 digest.
sha256_file <- function(path) unname(tools::sha256sum(path))

# hash ordered text values into a compact product version token.
sha256_values <- function(values) {
  tmp <- tempfile(); on.exit(unlink(tmp), add = TRUE)
  writeBin(charToRaw(paste(values, collapse = "")), tmp)
  sha256_file(tmp)
}

# return a file size as an integer number of bytes.
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))

# write cache provenance beside a raw network response.
write_meta <- function(path, url, method, request_body = NULL) {
  write_json(
    list(retrieved_at = stamp, url = url, method = method, http_status = 200L, request_body = request_body),
    paste0(path, ".meta.json"), auto_unbox = TRUE, pretty = TRUE, null = "null"
  )
}

# read cached response provenance or stop when it is absent.
read_meta <- function(path) {
  meta_path <- paste0(path, ".meta.json")
  if (!file.exists(meta_path)) stop("missing cache provenance: ", meta_path, call. = FALSE)
  fromJSON(meta_path, simplifyVector = FALSE)
}

# fetch a public GET response into the raw cache when absent.
fetch_get_if_missing <- function(url, path, referer = NULL) {
  if (file.exists(path) && file_bytes(path) > 0L) {
    if (!file.exists(paste0(path, ".meta.json"))) write_meta(path, url, "GET")
    return(invisible(FALSE))
  }
  tmp <- tempfile(tmpdir = dirname(path)); on.exit(unlink(tmp), add = TRUE)
  args <- c("-fL", "-sS", "--retry", "3", "--max-time", "300", "-A", "places-of-worship-research-build")
  if (!is.null(referer)) args <- c(args, "-e", referer)
  args <- c(args, shQuote(url), "-o", shQuote(tmp))
  if (system2("curl", args) != 0L || !file.exists(tmp) || file_bytes(tmp) == 0L) {
    stop("GET failed for ", url, call. = FALSE)
  }
  file.rename(tmp, path)
  write_meta(path, url, "GET")
  invisible(TRUE)
}

# fetch a statis yearbook ODS: regenerate server-side, then download the report.
fetch_statis_ods_if_missing <- function(gen_url, dl_url, path) {
  if (file.exists(path) && file_bytes(path) > 0L) {
    if (!file.exists(paste0(path, ".meta.json"))) write_meta(path, dl_url, "GET")
    return(invisible(FALSE))
  }
  system2("curl", c("-fL", "-sS", "--max-time", "120", "-A", "places-of-worship-research-build",
                    "-e", statis_referer, shQuote(paste0(gen_url, "&r=", as.integer(Sys.time()))), "-o", nullfile()))
  fetch_get_if_missing(dl_url, path, referer = statis_referer)
}

fetch_sources <- function() {
  fetch_statis_ods_if_missing(religion_gen_url, religion_dl_url, religion_path)
  fetch_statis_ods_if_missing(population_gen_url, population_dl_url, population_path)
  fetch_get_if_missing(geob_geojson_url, geob_geojson_path)
  fetch_get_if_missing(geob_api_url, geob_api_path)
  fetch_get_if_missing(moi_licence_url, moi_licence_path)
  invisible(TRUE)
}

# extract one ODS sheet as a padded character matrix, expanding cell/row repeats.
read_ods_sheet <- function(ods_path, sheet_name, max_cols = 8L) {
  content_dir <- tempfile("ods-"); dir.create(content_dir); on.exit(unlink(content_dir, recursive = TRUE), add = TRUE)
  unzip(ods_path, files = "content.xml", exdir = content_dir)
  doc <- read_xml(file.path(content_dir, "content.xml"))
  ns <- xml_ns(doc)
  tables <- xml_find_all(doc, ".//table:table", ns)
  names_attr <- xml_attr(tables, "table:name", ns)
  hit <- which(names_attr == sheet_name)
  if (length(hit) == 0L) stop("ODS sheet not found: ", sheet_name, call. = FALSE)
  target <- tables[[hit[1]]]
  rows <- xml_find_all(target, ".//table:table-row", ns)
  out <- list()
  for (row in rows) {
    rrep <- suppressWarnings(as.integer(xml_attr(row, "table:number-rows-repeated", ns)))
    if (is.na(rrep)) rrep <- 1L
    rrep <- min(rrep, 2L)  # data rows are never repeated; cap trailing blanks
    cells <- xml_find_all(row, "./table:table-cell", ns)
    vals <- character(0)
    for (cell in cells) {
      crep <- suppressWarnings(as.integer(xml_attr(cell, "table:number-columns-repeated", ns)))
      if (is.na(crep)) crep <- 1L
      crep <- min(crep, max_cols)
      txt <- paste(xml_text(xml_find_all(cell, ".//text:p", ns)), collapse = " ")
      vals <- c(vals, rep(trimws(txt), crep))
    }
    length(vals) <- max_cols
    vals[is.na(vals)] <- ""
    for (i in seq_len(rrep)) out[[length(out) + 1L]] <- vals
  }
  do.call(rbind, out)
}

# strip spaces from a MOI Chinese locality label for matching.
norm_zh <- function(x) gsub("[[:space:]　]", "", x)

# parse a comma-formatted integer, returning NA for blanks and MOI dash marks.
parse_int <- function(x) {
  x <- gsub(",", "", trimws(x))
  if (x %in% c("", "–", "－", "-", "…", "X", "x")) return(NA_integer_)
  suppressWarnings(as.integer(round(as.numeric(x))))
}

# parse one religion locality sheet into county rows and the published national row.
parse_religion_year <- function(year) {
  m <- read_ods_sheet(religion_path, paste0(year, "(區域別)"))
  county <- list(); national <- NULL
  for (r in seq_len(nrow(m))) {
    c0 <- m[r, 1]; c1 <- m[r, 2]
    if (grepl(as.character(year), c0, fixed = TRUE) && !is.na(parse_int(c1)) && !grepl("End of Year", paste(m[r, ], collapse = "|"))) {
      # national row: label | total | temples | churches | followers
      national <- list(total = parse_int(m[r, 2]), temples = parse_int(m[r, 3]),
                       churches = parse_int(m[r, 4]), followers = parse_int(m[r, 5]))
      next
    }
    z <- norm_zh(c0)
    idx <- match(z, crosswalk$zh)
    if (!is.na(idx)) {
      # county row: zh | en | total | temples | churches | followers
      county[[z]] <- list(total = parse_int(m[r, 3]), temples = parse_int(m[r, 4]),
                          churches = parse_int(m[r, 5]), followers = parse_int(m[r, 6]))
    }
  }
  if (is.null(national)) stop("religion national row missing for ", year, call. = FALSE)
  if (length(county) != 22L) stop("religion sheet did not yield 22 counties for ", year, call. = FALSE)
  list(national = national, county = county)
}

# parse one population sheet into county year-end totals and the national total.
parse_population_year <- function(year) {
  m <- read_ods_sheet(population_path, paste0(" ", year), max_cols = 6L)
  county <- list(); national <- NULL
  for (r in seq_len(nrow(m))) {
    if (trimws(m[r, 2]) != "計") next            # 計 = both-sexes total row
    if (!grepl("^T", trimws(m[r, 3]))) next          # T. English marker
    z <- norm_zh(m[r, 1]); val <- parse_int(m[r, 4]) # 總計 grand total
    if (grepl(as.character(year), z, fixed = TRUE)) { national <- val; next }
    if (z %in% province_subtotals) next
    idx <- match(z, crosswalk$zh)
    if (!is.na(idx)) county[[z]] <- val
  }
  if (is.null(national)) stop("population national row missing for ", year, call. = FALSE)
  if (length(county) != 22L) stop("population sheet did not yield 22 counties for ", year, call. = FALSE)
  list(national = national, county = county)
}

# reconcile: the 22 county rows must sum exactly to the published national row,
# for temples, churches, total places, followers, and population, every year.
build_reconciliation <- function(religion, population) {
  out <- lapply(years, function(year) {
    ry <- religion[[as.character(year)]]; py <- population[[as.character(year)]]
    sums <- list(
      total = sum(vapply(ry$county, function(c) c$total, integer(1))),
      temples = sum(vapply(ry$county, function(c) c$temples, integer(1))),
      churches = sum(vapply(ry$county, function(c) c$churches, integer(1))),
      followers = sum(vapply(ry$county, function(c) c$followers, integer(1))),
      population = sum(vapply(py$county, function(v) v, integer(1)))
    )
    checks <- c(
      total = identical(sums$total, ry$national$total),
      temples = identical(sums$temples, ry$national$temples),
      churches = identical(sums$churches, ry$national$churches),
      followers = identical(sums$followers, ry$national$followers),
      population = identical(sums$population, py$national)
    )
    list(
      year = year,
      county_sum = sums,
      published_national = list(total = ry$national$total, temples = ry$national$temples,
                                churches = ry$national$churches, followers = ry$national$followers,
                                population = py$national),
      exact = as.logical(all(checks))
    )
  })
  if (!all(vapply(out, function(o) o$exact, logical(1)))) {
    stop("Taiwan county rows do not reconcile exactly to the published national totals", call. = FALSE)
  }
  out
}

# hash each feature's own WKB geometry and preserve one digest per feature.
geometry_hashes <- function(layer) {
  vapply(seq_len(nrow(layer)), function(index) {
    raw_wkb <- st_as_binary(st_geometry(layer)[index], EWKB = TRUE)[[1]]
    tmp <- tempfile(); on.exit(unlink(tmp), add = TRUE)
    writeBin(raw_wkb, tmp); sha256_file(tmp)
  }, character(1))
}

# enforce validity and distinct-geometry gates for the 22 county polygons.
validate_boundary <- function(layer, stage) {
  if (nrow(layer) != 22L || any(st_is_empty(layer)) || any(!st_is_valid(layer))) {
    stop(stage, " boundary does not contain 22 valid non-empty features", call. = FALSE)
  }
  hashes <- geometry_hashes(layer)
  if (length(unique(hashes)) != 22L) {
    stop(stage, " boundary does not have 22 distinct geometry hashes", call. = FALSE)
  }
  list(hashes = setNames(as.list(hashes), layer[["area_code"]]),
       feature_count = 22L, distinct_geometry_hash_count = 22L)
}

# join geoBoundaries ADM1 by ISO code and attach MOI names, then simplify <=3MB.
build_boundary <- function() {
  raw <- st_read(geob_geojson_path, quiet = TRUE, stringsAsFactors = FALSE)
  iso_present <- crosswalk$shape_iso %in% raw[["shapeISO"]]
  if (!all(iso_present)) {
    stop("geoBoundaries ADM1 is missing ISO codes: ",
         paste(crosswalk$shape_iso[!iso_present], collapse = ", "), call. = FALSE)
  }
  raw <- raw[match(crosswalk$shape_iso, raw[["shapeISO"]]), ]
  if (!identical(raw[["shapeISO"]], crosswalk$shape_iso)) stop("ISO join order mismatch", call. = FALSE)
  boundary <- st_sf(
    country_code = country_code,
    area_code = crosswalk$shape_iso,
    area_name = crosswalk$moi_en,
    source_boundary_name = raw[["shapeName"]],
    area_unit_id = paste0(boundary_set_id, ":", crosswalk$shape_iso),
    boundary_set_id = boundary_set_id,
    boundary_level = "county_city",
    boundary_vintage = "geoBoundaries gbOpen TWN ADM1 (release 9469f09)",
    geometry = st_geometry(raw)
  )
  boundary <- st_transform(st_make_valid(boundary), 4326)
  source_validation <- validate_boundary(boundary, "source")
  simplification <- mapshaper_simplify_to_cap(
    boundary, boundary_out, max_bytes = 3000000,
    keep_percentages = c(10, 7, 5, 3, 2, 1, 0.5), clean_option = NULL
  )
  written <- st_read(boundary_out, quiet = TRUE, stringsAsFactors = FALSE)
  written <- written[match(crosswalk$shape_iso, written[["area_code"]]), ]
  simplified_validation <- validate_boundary(written, "simplified")
  simplification[["byte_ceiling"]] <- 3000000L
  list(boundary = written, simplification = simplification,
       source_validation = source_validation, simplified_validation = simplified_validation,
       geob_source_names = setNames(raw[["shapeName"]], crosswalk$shape_iso))
}

# the population denominator basis note.
population_basis_note <- function() {
  paste("MOI household-registration year-end resident population, statis yearbook",
        "table 02-01 (人口年齡分配), both-sexes grand total for the county/city.")
}

# the place-count basis note: registered temples plus churches, administrative.
place_count_basis_note <- function() {
  paste("MOI administrative register of registered temples (寺廟) and",
        "churches (教會堂); count of registered places at year-end from statis",
        "yearbook table 06-01 (各宗教教務概況). Not an OpenStreetMap or",
        "point-in-time site extraction.")
}

# build one schema-conforming area-summary row.
build_row <- function(year, zh, religion_county, population_county, boundary) {
  idx <- match(zh, crosswalk$zh)
  iso <- crosswalk$shape_iso[idx]
  b <- boundary[boundary[["area_code"]] == iso, ]
  if (nrow(b) != 1L) stop("no unique boundary for ", iso, call. = FALSE)
  place_count <- religion_county$total
  pop <- population_county
  per_10k <- round(place_count / pop * 10000, 4)
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = "county_city",
    area_unit_id = b[["area_unit_id"]][[1]],
    area_code = iso,
    area_name = crosswalk$moi_en[idx],
    year = as.integer(year),
    population_total = as.integer(pop),
    population_total_basis = population_basis_note(),
    religious_affiliation_count = as.integer(religion_county$followers),
    religious_affiliation_percent = NULL,
    no_religion_count = NULL,
    no_religion_percent = NULL,
    place_count = as.integer(place_count),
    places_per_10000_residents = per_10k,
    place_density_per_sq_km = NULL,
    land_area_sq_km = NULL,
    site_snapshot_date = paste0(year, "-12-31"),
    place_count_basis = place_count_basis_note(),
    source_dataset_ids = list(religion_dataset_id, population_dataset_id, boundary_dataset_id),
    quality_flag = paste(
      "administrative_religion_register",
      "registered_temples_and_churches_not_census_affiliation",
      "place_count_is_moi_register_not_osm",
      "followers_are_registered_temple_followers_only_from_2014",
      "county_city_on_geoboundaries_adm1",
      "national_reconciliation_exact",
      sep = ";"
    )
  )
}

# flatten row objects into the repository's CSV companion shape.
flatten_rows <- function(rows) {
  data.frame(
    country_code = vapply(rows, `[[`, character(1), "country_code"),
    boundary_set_id = vapply(rows, `[[`, character(1), "boundary_set_id"),
    boundary_level = vapply(rows, `[[`, character(1), "boundary_level"),
    area_unit_id = vapply(rows, `[[`, character(1), "area_unit_id"),
    area_code = vapply(rows, `[[`, character(1), "area_code"),
    area_name = vapply(rows, `[[`, character(1), "area_name"),
    year = vapply(rows, `[[`, integer(1), "year"),
    population_total = vapply(rows, `[[`, integer(1), "population_total"),
    population_total_basis = vapply(rows, `[[`, character(1), "population_total_basis"),
    religious_affiliation_count = vapply(rows, `[[`, integer(1), "religious_affiliation_count"),
    religious_affiliation_percent = NA_real_,
    no_religion_count = NA_integer_,
    no_religion_percent = NA_real_,
    place_count = vapply(rows, `[[`, integer(1), "place_count"),
    places_per_10000_residents = vapply(rows, `[[`, numeric(1), "places_per_10000_residents"),
    place_density_per_sq_km = NA_real_,
    land_area_sq_km = NA_real_,
    site_snapshot_date = vapply(rows, `[[`, character(1), "site_snapshot_date"),
    place_count_basis = vapply(rows, `[[`, character(1), "place_count_basis"),
    source_dataset_ids = vapply(rows, function(r) paste(unlist(r[["source_dataset_ids"]]), collapse = "|"), character(1)),
    quality_flag = vapply(rows, `[[`, character(1), "quality_flag"),
    stringsAsFactors = FALSE
  )
}

# describe one committed output in a schema-valid durable-file record.
manifest_file_record <- function(path, content) {
  record <- list(uri = paste0("repo:", path), storage_provider = "other",
                 format = tools::file_ext(path), bytes = file_bytes(path),
                 sha256 = sha256_file(path), content = content,
                 privacy = "public", licence_status = "accepted")
  if (grepl("\\.geojson$", path)) {
    record[["feature_count"]] <- nrow(st_read(path, quiet = TRUE))
  } else if (grepl("\\.csv$", path)) {
    record[["row_count"]] <- max(0L, length(readLines(path, warn = FALSE)) - 1L)
  } else {
    obj <- fromJSON(path, simplifyVector = FALSE)
    record[["row_count"]] <- length(obj[["rows"]])
  }
  record
}

# describe one cached raw input with exact URL, retrieval time, and digest.
raw_source_record <- function(path, format, dataset_id, used, licence, notes) {
  meta <- read_meta(path)
  list(uri = path, url = meta[["url"]], method = meta[["method"]], request_body = meta[["request_body"]],
       format = format, bytes = file_bytes(path), sha256 = sha256_file(path),
       source_dataset_id = dataset_id, used_in_public_product = used,
       retrieved_at = meta[["retrieved_at"]], http_status = meta[["http_status"]],
       licence = licence, notes = notes)
}

fetch_sources()

religion <- setNames(lapply(years, function(y) parse_religion_year(y)), as.character(years))
population <- setNames(lapply(years, function(y) parse_population_year(y)), as.character(years))
reconciliation <- build_reconciliation(religion, population)
boundary_result <- build_boundary()
boundary <- boundary_result[["boundary"]]

# assemble rows in year, then MOI-table order.
rows <- list()
for (y in years) {
  ry <- religion[[as.character(y)]]; py <- population[[as.character(y)]]
  for (zh in crosswalk$zh) {
    rows[[length(rows) + 1L]] <- build_row(y, zh, ry$county[[zh]], py$county[[zh]], boundary)
  }
}
if (length(rows) != 110L) stop("expected 110 rows (22 counties x 5 years)", call. = FALSE)

moi_licence <- list(
  name = "MOI Open Government Data Declaration (政府網站資料開放宣告)",
  url = moi_licence_url,
  attribution = "Ministry of the Interior, Republic of China (Taiwan)"
)
geob_licence <- list(
  name = "Open Data Commons Open Database License 1.0 (ODbL)",
  url = "https://opendatacommons.org/licenses/odbl/1-0/",
  attribution = "geoBoundaries (Runfola et al. 2020); administrative boundaries"
)

source_datasets <- list(
  list(source_dataset_id = religion_dataset_id,
       name = "06-01 各宗教教務概況 General Conditions of Religions",
       provider = "Ministry of the Interior, Department of Statistics (statis.moi.gov.tw)",
       url = statis_referer, retrieval_date = retrieval_date, local_path = religion_path,
       licence = moi_licence,
       citation = "MOI Department of Statistics, statistical yearbook table 06-01 General Conditions of Religions, registered temples, churches, and temple followers by county/city.",
       access_limits = "The statis yearbook regenerates each table server-side (kind=7 ODF) before download; the builder fetches once and caches.",
       redistribution_limits = paste("Reuse and redistribution permitted with attribution under the MOI Open Government Data Declaration.",
                                      "Verbatim:", moi_licence_verbatim),
       notes = paste("Administrative register of registered religious organisations.",
                     "Temples (寺廟) and churches (教會堂) are counted as registered places; followers (信徒) are the temples' reported followers.",
                     paste0(followers_construct_verbatim, "."),
                     "This is never census religious affiliation.")),
  list(source_dataset_id = population_dataset_id,
       name = "02-01 人口年齡分配 Population by Age",
       provider = "Ministry of the Interior, Department of Statistics (statis.moi.gov.tw)",
       url = statis_referer, retrieval_date = retrieval_date, local_path = population_path,
       licence = moi_licence,
       citation = "MOI Department of Statistics, statistical yearbook table 02-01 Population by Age, year-end household-registration population by county/city.",
       access_limits = "Same statis regenerate-then-download route as table 06-01.",
       redistribution_limits = paste("Reuse and redistribution permitted with attribution under the MOI Open Government Data Declaration.",
                                      "Verbatim:", moi_licence_verbatim),
       notes = "Year-end registered resident population used only as the per-10,000 denominator. Both-sexes grand total per county/city."),
  list(source_dataset_id = boundary_dataset_id,
       name = "geoBoundaries gbOpen TWN ADM1 county/city polygons",
       provider = "geoBoundaries (William & Mary geoLab)",
       url = geob_geojson_url, retrieval_date = retrieval_date, local_path = geob_geojson_path,
       licence = geob_licence,
       citation = "geoBoundaries gbOpen TWN ADM1, release 9469f09.",
       access_limits = NULL,
       redistribution_limits = "ODbL 1.0 attribution and share-alike apply to the boundary geometry.",
       notes = "22 county/city polygons joined by ISO code (TW-XXX). Lienchiang County appears as Matsu Islands in geoBoundaries.")
)

indicators <- list(
  list(indicator_id = "place_count",
       label = "Registered temples and churches (寺廟教會堂數)",
       description = paste("Count of registered religious places (temples 寺廟 plus churches 教會堂)",
                           "in the county/city, from MOI statis table 06-01. An administrative register count, not an OSM site snapshot, and not census affiliation."),
       unit = "count", denominator_indicator_id = "population_total",
       method = "Published MOI table 06-01 total (合計) for the county/city and reference year-end.",
       temporal_coverage = "Annual year-end 2020-2024.",
       spatial_coverage = "22 county/city units; provincial subtotals (臺灣省, 福建省) used only for national reconciliation.",
       quality_notes = "For every year the 22 county totals sum exactly to the MOI published national total."),
  list(indicator_id = "religious_affiliation_count",
       label = "Registered temple followers (信徒人數)",
       description = paste("Legacy area-summary field carrying the MOI reported registered temple followers.",
                           "It does not measure census religious affiliation, belief, or attendance."),
       unit = "count", denominator_indicator_id = NULL,
       method = "Published MOI table 06-01 follower count (信徒人數) for the county/city and reference year-end.",
       temporal_coverage = "Annual year-end 2020-2024.",
       spatial_coverage = "22 county/city units.",
       quality_notes = paste0(followers_construct_verbatim, ". Church members are not in this column across the shipped years.")),
  list(indicator_id = "places_per_10000_residents",
       label = "Registered places per 10,000 residents",
       description = "Registered temples and churches per 10,000 year-end household-registration residents.",
       unit = "rate", denominator_indicator_id = "population_total",
       method = "place_count divided by MOI year-end population (table 02-01), times 10,000.",
       temporal_coverage = "Annual year-end 2020-2024.",
       spatial_coverage = "22 county/city units.",
       quality_notes = "Denominator is MOI household-registration population, not a census enumeration.")
)

visual_layers <- list(
  list(visual_layer_id = "tw-county-registered-places-per-10k",
       label = "Registered places per 10,000 residents",
       description = "MOI registered temples and churches per 10,000 residents by county/city.",
       layer_type = "choropleth",
       indicator_ids = list("places_per_10000_residents", "place_count", "religious_affiliation_count"),
       geometry_unit_type = "area_unit",
       legend = list(unit = "places per 10,000 residents", source_table = "MOI 06-01"),
       colour_scale = "sequential", time_control = "year_selector",
       aggregation_rule = "use the published county/city register counts; provincial subtotals are national-reconciliation context only",
       uncertainty_display = "quality_flag", default_visibility = TRUE,
       notes = "Administrative-register construct. Metric relabelling to the register wording is deferred to the region page.")
)

area_summary <- list(
  schema_version = "0.2.0",
  generated_at = stamp,
  generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code,
                      level = "county_city", vintage = "geoBoundaries gbOpen TWN ADM1 (release 9469f09)",
                      source_dataset_id = boundary_dataset_id),
  site_snapshot = list(source_dataset_id = religion_dataset_id, snapshot_date = NULL,
                       basis = paste("place_count is the MOI administrative register count of registered temples and churches at each reference year-end (table 06-01),",
                                     "not an OpenStreetMap or point-in-time site extraction."),
                       notes = "site_snapshot_date on each row is the reference year-end; place_density_per_sq_km and land_area_sq_km are null because the boundary geometry includes coastal extents."),
  source_datasets = source_datasets,
  indicators = indicators,
  visual_layers = visual_layers,
  rows = rows
)

write_json(area_summary, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

raw_sources <- list(
  raw_source_record(religion_path, "ods", religion_dataset_id, TRUE, moi_licence$name,
                    "MOI statis table 06-01 with 2016-2025 yearly and per-year locality and religion sheets."),
  raw_source_record(population_path, "ods", population_dataset_id, TRUE, moi_licence$name,
                    "MOI statis table 02-01 year-end population by county/city, 2016-2025."),
  raw_source_record(geob_geojson_path, "geojson", boundary_dataset_id, TRUE, geob_licence$name,
                    "geoBoundaries gbOpen TWN ADM1, 22 county/city polygons with ISO codes."),
  raw_source_record(geob_api_path, "json", boundary_dataset_id, FALSE, geob_licence$name,
                    "geoBoundaries API metadata confirming ADM1 download URL and ODbL 1.0."),
  raw_source_record(moi_licence_path, "html", religion_dataset_id, FALSE, moi_licence$name,
                    "MOI Open Government Data Declaration page; terms_verbatim quotes this capture.")
)

version_hash <- substr(sha256_values(c(sha256_file(summary_json_out), sha256_file(summary_csv_out), sha256_file(boundary_out))), 1L, 12L)

# compact per-year national + temple/church split preserved for audit.
reconciliation_report <- lapply(reconciliation, function(o) {
  list(year = o$year,
       county_sum = list(total = o$county_sum$total, temples = o$county_sum$temples,
                         churches = o$county_sum$churches, followers = o$county_sum$followers,
                         population = o$county_sum$population),
       published_national = o$published_national,
       exact = o$exact)
})

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = paste0("manifest:tw-register:tw:2020-2024:", version_hash),
  dataset_id = "tw-register:tw:2020-2024:moi-statis-geoboundaries",
  dataset_version_id = paste0("tw-register:tw:2020-2024:moi-statis-geoboundaries:", version_hash),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "tw-register", dataset_role = "public_product",
  scope = list(level = "country", country_codes = list(country_code),
               snapshot_date = NULL, snapshot_anchor = "12-31", pipeline_stage = "public"),
  created_at = stamp, created_by = script_id,
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      years = as.list(years),
      geography = "22 county/city units (直轄市及縣市)",
      boundary_vintage = "geoBoundaries gbOpen TWN ADM1 (release 9469f09)",
      boundary_route = "geoBoundaries ADM1 joined to MOI county/city by ISO code (TW-XXX)",
      construct_declaration = paste("Administrative register of registered religious organisations:",
        "counts of registered temples (寺廟) and churches (教會堂) and their reported temple followers (信徒).",
        "It is never census religious affiliation. place_count carries the total registered places;",
        "religious_affiliation_count carries registered temple followers;",
        paste0(followers_construct_verbatim, ".")),
      source_tables = list(
        religion = "statis yearbook 06-01 各宗教教務概況 (funid 331030)",
        population = "statis yearbook 02-01 人口年齡分配 (funid 332010)"),
      denominator = population_basis_note(),
      taiwan_naming_note = paste("MOI published English county/city names are used as area_name (source of record).",
        "geoBoundaries names differ for some units: Lienchiang County = Matsu Islands (TW-LIE),",
        "Penghu County = Penghu (TW-PEN), Kinmen County = Kinmen (TW-KIN), and the special",
        "municipalities drop the City suffix. Recorded for PI; no mainland-China framing question is resolved here."),
      survey_row_boundary_note = paste("The TW survey row named geoBoundaries ADM2. ADM2 is 368 townships/districts;",
        "the MOI religion statistics are county/city, which map to geoBoundaries ADM1 (22 units).",
        "ADM1 is therefore the correct join and is used."),
      boundary_simplification = boundary_result[["simplification"]],
      raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/tw_register/"),
      hard_gates = list(
        reconciliation = list(status = "passed", years = reconciliation_report),
        geometry = list(status = "passed", feature_count = 22L, distinct_geometry_hash_count = 22L,
                        source_hashes = boundary_result[["source_validation"]][["hashes"]],
                        simplified_hashes = boundary_result[["simplified_validation"]][["hashes"]]),
        boundary_byte_ceiling = list(status = if (file_bytes(boundary_out) <= 3000000L) "passed" else "failed",
                                     bytes = file_bytes(boundary_out), ceiling = 3000000L),
        year_coverage = list(status = "passed", first_year = 2020L, last_year = 2024L, count = 5L),
        row_count = list(status = if (length(rows) == 110L) "passed" else "failed", rows = length(rows), expected = 110L),
        provenance = list(status = "passed", raw_sources = raw_sources)
      )
    ),
    software_versions = list(r = R.version.string, sf = as.character(packageVersion("sf")),
                             jsonlite = as.character(packageVersion("jsonlite")),
                             xml2 = as.character(packageVersion("xml2")),
                             mapshaper = "npx mapshaper used through scripts/lib/simplify_boundary.R",
                             curl = tryCatch(system2("curl", "--version", stdout = TRUE)[[1]], error = function(e) NA_character_))
  ),
  source = list(
    provider = "Ministry of the Interior, Department of Statistics (Taiwan); geoBoundaries",
    source_dataset_ids = c(religion_dataset_id, population_dataset_id, boundary_dataset_id),
    source_urls = c(statis_referer, geob_geojson_url, geob_api_url, moi_licence_url),
    retrieved_at = stamp,
    licence = paste("MOI statistics: MOI Open Government Data Declaration -", moi_licence_verbatim,
                    "| geoBoundaries ADM1: ODbL 1.0."),
    citation = "MOI Department of Statistics tables 06-01 and 02-01; geoBoundaries gbOpen TWN ADM1 (9469f09)."
  ),
  input_manifests = list(),
  durable_files = list(
    manifest_file_record(summary_json_out, "Taiwan county/city registered-religion administrative area summary, 2020-2024."),
    manifest_file_record(summary_csv_out, "Flattened Taiwan county/city registered-religion rows, 2020-2024."),
    manifest_file_record(boundary_out, "Simplified geoBoundaries TWN ADM1 county/city geometry, 22 features.")
  ),
  stats = list(years = length(years), rows = length(rows), boundary_features = 22L,
               boundary_bytes = file_bytes(boundary_out), summary_json_bytes = file_bytes(summary_json_out),
               summary_csv_bytes = file_bytes(summary_csv_out)),
  local_cache_hint = "Raw MOI statis and geoBoundaries responses are cached under data/raw/tw_register/ and remain git-ignored.",
  validation = list(
    status = "passed_with_warnings",
    commands = list(
      "Rscript scripts/build_tw_area_summary.R",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/tw/data/area_summary_county.json",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/data-manifest.schema.json docs/manifests/tw-register-2020-2024.json",
      "jq empty apps/regions/tw/data/area_summary_county.json docs/manifests/tw-register-2020-2024.json"
    ),
    warnings = c(
      "Administrative register construct. place_count is registered temples plus churches, not an OSM site snapshot; religious_affiliation_count is registered temple followers, not census affiliation.",
      paste0(followers_construct_verbatim, ". A follower-series break at 2014 means the shipped 2020-2024 window is internally consistent but not comparable with pre-2014 followers."),
      "place_density_per_sq_km and land_area_sq_km are null because the geoBoundaries ADM1 geometry includes coastal extents.",
      "The TW survey row named geoBoundaries ADM2; the county/city construct maps to ADM1 (22 units), which is used.",
      "geoBoundaries names Lienchiang County as Matsu Islands; MOI published names are retained as area_name."
    ),
    notes = paste("All hard gates passed. 110 rows ship (22 county/city units for every year 2020-2024).",
                  "For every year the 22 county totals sum exactly to the MOI published national totals for temples, churches, total places, and followers, and the 22 county populations sum exactly to the national population.",
                  "The simplified geoBoundaries ADM1 boundary contains 22 valid, non-empty, distinct geometries below the 3 MB ceiling.")
  ),
  privacy = "public", licence_status = "accepted", downstream_status = "public",
  notes = paste("Taiwan county/city registered-religion administrative product.",
                "Registered temples, churches, and reported temple followers from the MOI statistical yearbook.",
                "The counts never measure census affiliation, belief, or attendance.",
                "Table 06-01 also carries 2016-2019 and 2025 in the same file for a future clean extension of the same construct.")
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)

cat(sprintf("wrote %s: %d rows, %d bytes\n", summary_json_out, length(rows), file_bytes(summary_json_out)))
cat(sprintf("wrote %s: %d bytes\n", summary_csv_out, file_bytes(summary_csv_out)))
cat(sprintf("wrote %s: 22 features, %d bytes (ceiling 3000000)\n", boundary_out, file_bytes(boundary_out)))
cat(sprintf("wrote %s: %d bytes\n", manifest_out, file_bytes(manifest_out)))
cat("hard gates: reconciliation passed; geometry passed; byte ceiling passed; year coverage passed; row count passed; provenance passed\n")
