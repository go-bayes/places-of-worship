# build the south korea census-religion area-summary product from kosis csvs.
# inputs: kosis mass csv zips for 1995, 2005, and 2015, and the 2018 kostat-derived
# southkorea-maps municipality geojson under data/raw/kr_census/.
# outputs: apps/regions/kr/data/kr_si_gun_gu_2018_harmonised.geojson,
# apps/regions/kr/data/area_summary_si_gun_gu.{json,csv},
# apps/regions/kr/data/kr_sido_2018_harmonised.geojson,
# apps/regions/kr/data/area_summary_sido.{json,csv}, and
# docs/manifests/kr-census-religion-1995-2015.json.
# run from the repo root: Rscript scripts/build_kr_area_summary.R

suppressMessages({
  library(sf)
  library(jsonlite)
})

raw_dir <- "data/raw/kr_census"
kr_dir <- "apps/regions/kr/data"
manifest_dir <- "docs/manifests"
dir.create(kr_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- "2026-07-09"
script_id <- "scripts/build_kr_area_summary.R"
country_code <- "KR"
boundary_set_id <- "kr-si-gun-gu-2018-kostat-harmonised"
sido_boundary_set_id <- "kr-sido-2018-kostat-harmonised"
boundary_dataset_id <- "southkorea-maps-kostat-municipalities-2018"
census_2005_dataset_id <- "kosis-dt-1in0505-religion-si-gun-gu-2005"
census_2015_dataset_id <- "kosis-dt-1pm1502-religion-si-gun-gu-2015"
census_1995_dataset_id <- "kosis-dt-1in9506-religion-admin-1995"
census_1985_dataset_id <- "kosis-dt-1in8505-religion-sido-1985"

kosis_stat_url <- function(tbl_id) {
  paste0("https://kosis.kr/statHtml/statHtml.do?orgId=101&tblId=", tbl_id, "&conn_path=I3")
}

kosis_mass_url <- function(tbl_id) {
  paste0("http://kosis.kr/statisticsList/mass/mass_list.jsp?org_id=101&tbl_id=", tbl_id, "&vw_cd=MT_ZTITLE&list_id=&process=statHtml")
}

source_urls <- list(
  kosis_2005 = kosis_stat_url("DT_1IN0505"),
  kosis_2015 = kosis_stat_url("DT_1PM1502"),
  kosis_1995 = kosis_stat_url("DT_1IN9506"),
  kosis_1985 = kosis_stat_url("DT_1IN8505"),
  southkorea_maps_boundary = "https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-municipalities-2018-geo.json",
  southkorea_maps_readme = "https://github.com/southkorea/southkorea-maps",
  kogl = "https://www.kogl.or.kr/info/license.do"
)

wave_specs <- list(
  list(
    year = 2005L,
    table_id = "DT_1IN0505",
    dataset_id = census_2005_dataset_id,
    zip_path = file.path(raw_dir, "kosis_101_DT_1IN0505_F_2005.zip"),
    table_name = "성/연령/종교별 인구-시군구",
    total_col = "내국인 (명)",
    religious_total_col = "종교있음 (명)",
    no_religion_col = "종교없음 (명)",
    unknown_col = "미상 (명)",
    age_total_labels = c("합계"),
    named_religion_cols = c(
      "불교 (명)",
      "기독교(개신교) (명)",
      "기독교(천주교) (명)",
      "유교 (명)",
      "원불교 (명)",
      "증산교 (명)",
      "천도교 (명)",
      "대종교 (명)",
      "기타 (명)"
    ),
    denominator_note = "KOSIS DT_1IN0505 table total 내국인 (명); 미상 (unknown) remains in the denominator.",
    quality_flags = c("full_count_census", "unknown_category_in_denominator")
  ),
  list(
    year = 2015L,
    table_id = "DT_1PM1502",
    dataset_id = census_2015_dataset_id,
    zip_path = file.path(raw_dir, "kosis_101_DT_1PM1502_F_2015.zip"),
    table_name = "성, 연령 및 종교별 인구-시군구",
    total_col = "계",
    religious_total_col = "종교있음-계",
    no_religion_col = "종교없음-계",
    unknown_col = NULL,
    age_total_labels = c("합계"),
    named_religion_cols = c(
      "불교",
      "기독교(개신교)",
      "기독교(천주교)",
      "원불교",
      "유교",
      "천도교",
      "대순진리회",
      "대종교",
      "기타"
    ),
    denominator_note = "KOSIS DT_1PM1502 table total 계; 2015 religion was collected in the 20% sample survey of the register-based census.",
    quality_flags = c("sample_survey_20pct", "register_based_census_sample_survey")
  )
)

# 1995 maps the printed categories into the existing broad product scheme:
# every named religion column, including 기타, contributes to religious
# affiliation; 종교없음 maps to no religion; 미상 remains in the denominator.
wave_spec_1995 <- list(
  year = 1995L,
  table_id = "DT_1IN9506",
  dataset_id = census_1995_dataset_id,
  zip_path = file.path(raw_dir, "kosis_101_DT_1IN9506_F_1995.zip"),
  table_name = "행정구역/성/연령별 종교인구",
  total_col = "계",
  religious_total_col = "종교있음",
  no_religion_col = "종교없음",
  unknown_col = "미상",
  age_total_labels = c("계"),
  named_religion_cols = c(
    "불교",
    "개신교",
    "천주교",
    "유교",
    "원불교",
    "천도교",
    "대종교",
    "대순진리회",
    "기타"
  ),
  denominator_note = "KOSIS DT_1IN9506 table total 계; 미상 (unknown) remains in the denominator.",
  quality_flags = c("full_count_census", "unknown_category_in_denominator", "1995_current_sido_concordance")
)

sido_wave_specs <- c(list(wave_spec_1995), wave_specs)

boundary_raw_path <- file.path(raw_dir, "skorea_municipalities_2018_geo.json")
boundary_out <- file.path(kr_dir, "kr_si_gun_gu_2018_harmonised.geojson")
summary_json_out <- file.path(kr_dir, "area_summary_si_gun_gu.json")
summary_csv_out <- file.path(kr_dir, "area_summary_si_gun_gu.csv")
sido_boundary_out <- file.path(kr_dir, "kr_sido_2018_harmonised.geojson")
sido_summary_json_out <- file.path(kr_dir, "area_summary_sido.json")
sido_summary_csv_out <- file.path(kr_dir, "area_summary_sido.csv")
manifest_out <- file.path(manifest_dir, "kr-census-religion-1995-2015.json")

# korea keeps the historical binary 3 MiB ceiling; scripts that already used
# decimal caps keep those decimal byte ceilings in the mapshaper helper calls.
kr_boundary_max_bytes <- 3 * 1024 * 1024

district_groups <- list(
  "31010" = c("31011", "31012", "31013", "31014"),
  "31020" = c("31021", "31022", "31023"),
  "31040" = c("31041", "31042"),
  "31090" = c("31091", "31092"),
  "31100" = c("31101", "31103", "31104"),
  "31190" = c("31191", "31192", "31193"),
  "33040" = c("33041", "33042", "33043", "33044"),
  "34010" = c("34011", "34012"),
  "35010" = c("35011", "35012"),
  "37010" = c("37011", "37012"),
  "38110" = c("38111", "38112", "38113", "38114", "38115")
)

parent_area_names <- c(
  "31010" = "Suwon-si",
  "31020" = "Seongnam-si",
  "31040" = "Anyang-si",
  "31090" = "Ansan-si",
  "31100" = "Goyang-si",
  "31190" = "Yongin-si",
  "33040" = "Cheongju-si",
  "34010" = "Cheonan-si",
  "35010" = "Jeonju-si",
  "37010" = "Pohang-si",
  "38110" = "Changwon-si",
  "29010" = "Sejong-si",
  "31280" = "Yeoju-si",
  "34070" = "Gyeryong-si",
  "34080" = "Dangjin-si",
  "39010" = "Jeju-si",
  "39020" = "Seogwipo-si"
)

sido_area_names <- c(
  "11" = "Seoul",
  "21" = "Busan",
  "22" = "Daegu",
  "23" = "Incheon",
  "24" = "Gwangju",
  "25" = "Daejeon",
  "26" = "Ulsan",
  "29" = "Sejong",
  "31" = "Gyeonggi-do",
  "32" = "Gangwon-do",
  "33" = "Chungcheongbuk-do",
  "34" = "Chungcheongnam-do",
  "35" = "Jeollabuk-do",
  "36" = "Jeollanam-do",
  "37" = "Gyeongsangbuk-do",
  "38" = "Gyeongsangnam-do",
  "39" = "Jeju-do"
)

source_code_map_2005 <- list(
  "29010" = c("34320"),
  "31280" = c("31320"),
  "33040" = c("33010", "33310"),
  "34070" = c("34090"),
  "34080" = c("34390"),
  "38110" = c("38010", "38020", "38040"),
  "39010" = c("39010", "39310"),
  "39020" = c("39020", "39320")
)

# stop early if a required raw source has not been downloaded.
require_file <- function(path) {
  if (!file.exists(path)) stop("missing required source: ", path, call. = FALSE)
}

# compute the sha-256 digest for a local file.
sha256_file <- function(path) {
  unname(tools::sha256sum(path))
}

# hash ordered product hashes for manifest version tokens.
sha256_values <- function(values) {
  tmp <- tempfile()
  on.exit(unlink(tmp), add = TRUE)
  writeBin(charToRaw(paste(values, collapse = "")), tmp)
  sha256_file(tmp)
}

# return file size in bytes for manifest and validation records.
file_bytes <- function(path) {
  as.integer(unname(file.info(path)[["size"]]))
}

# return a row or feature count for csv, json, geojson, and zip records.
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$|\\.json$", path) && !grepl("area_summary", path)) {
    geo <- fromJSON(path, simplifyVector = FALSE)
    if (!is.null(geo[["features"]])) return(length(geo[["features"]]))
  }
  if (grepl("area_summary.*\\.json$", path)) {
    json <- fromJSON(path, simplifyVector = FALSE)
    return(length(json[["rows"]]))
  }
  if (grepl("\\.zip$", path)) {
    listing <- utils::unzip(path, list = TRUE)
    csv_member <- listing[grepl("\\.csv$", listing[["Name"]], ignore.case = TRUE), "Name"][1]
    if (!is.na(csv_member)) {
      return(max(0L, length(readLines(unz(path, csv_member), warn = FALSE, encoding = "CP949")) - 3L))
    }
  }
  NA_integer_
}

# return NULL where JSON should carry an absent scalar.
null_if_na <- function(value) {
  if (length(value) == 0L || is.na(value) || !is.finite(value)) return(NULL)
  value
}

# return a scalar value or a typed NA for the CSV sibling.
csv_scalar <- function(row, field, missing) {
  value <- row[[field]]
  if (is.null(value) || length(value) == 0L) return(missing)
  value
}

# parse a KOSIS count cell as an integer-valued numeric.
parse_count <- function(value) {
  suppressWarnings(as.numeric(gsub(",", "", as.character(value), fixed = TRUE)))
}

# remove the leading apostrophe KOSIS uses to preserve code strings.
clean_kosis_code <- function(value) {
  sub("^'", "", trimws(as.character(value)))
}

# convert source romanisations into readable English map labels.
normalise_area_name <- function(code, name_eng) {
  if (code %in% names(parent_area_names)) return(unname(parent_area_names[[code]]))
  name <- trimws(as.character(name_eng))
  if (code == "31250" && name == "Gwangju") return("Gwangju-si")
  if (!grepl("-", name) && grepl("(si|gun|gu)$", name)) {
    name <- sub("(si|gun|gu)$", "-\\1", name)
  }
  name
}

# return the source CSV member inside a KOSIS mass ZIP.
csv_member <- function(zip_path) {
  members <- utils::unzip(zip_path, list = TRUE)[["Name"]]
  hit <- members[grepl("\\.csv$", members, ignore.case = TRUE)]
  if (length(hit) != 1L) stop("expected one csv member in ", zip_path, call. = FALSE)
  hit[[1]]
}

# read a KOSIS mass CSV and retain total-sex, total-age rows.
read_kosis_wave <- function(spec) {
  require_file(spec[["zip_path"]])
  lines <- readLines(
    unz(spec[["zip_path"]], csv_member(spec[["zip_path"]]), encoding = "CP949"),
    warn = FALSE
  )
  lines <- iconv(lines, from = "CP949", to = "UTF-8")
  raw <- read.csv(
    text = paste(lines, collapse = "\n"),
    skip = 2,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  area_code_col <- grep("^C행정구역", names(raw), value = TRUE)[1]
  area_name_col <- grep("^행정구역", names(raw), value = TRUE)[1]
  required_cols <- c(
    area_code_col,
    area_name_col,
    "성별",
    "연령별",
    "시점",
    spec[["total_col"]],
    spec[["religious_total_col"]],
    spec[["no_religion_col"]],
    spec[["named_religion_cols"]]
  )
  if (!is.null(spec[["unknown_col"]])) required_cols <- c(required_cols, spec[["unknown_col"]])
  missing <- setdiff(required_cols, names(raw))
  if (length(missing)) {
    stop("missing expected KOSIS columns for ", spec[["year"]], ": ", paste(missing, collapse = ", "), call. = FALSE)
  }

  rows <- raw[raw[["성별"]] == "계" & raw[["연령별"]] %in% spec[["age_total_labels"]], ]
  rows[["area_code"]] <- clean_kosis_code(rows[[area_code_col]])
  rows[["area_name_source"]] <- trimws(rows[[area_name_col]])
  rows[["year"]] <- as.integer(rows[["시점"]])
  rows
}

# return source KOSIS rows that make up one public product unit.
source_codes_for_area <- function(year, area_code) {
  if (year == 2005L && area_code %in% names(source_code_map_2005)) {
    return(source_code_map_2005[[area_code]])
  }
  area_code
}

# aggregate one or more KOSIS source rows into the public metrics.
aggregate_source_counts <- function(source_rows, source_codes, spec) {
  matches <- source_rows[source_rows[["area_code"]] %in% source_codes, ]
  if (nrow(matches) != length(source_codes)) {
    missing <- setdiff(source_codes, matches[["area_code"]])
    stop("missing source rows for ", spec[["year"]], ": ", paste(missing, collapse = ", "), call. = FALSE)
  }
  total <- sum(parse_count(matches[[spec[["total_col"]]]]), na.rm = TRUE)
  religious_total <- sum(parse_count(matches[[spec[["religious_total_col"]]]]), na.rm = TRUE)
  religious_named <- sum(vapply(spec[["named_religion_cols"]], function(col) {
    sum(parse_count(matches[[col]]), na.rm = TRUE)
  }, numeric(1)))
  if (!isTRUE(all.equal(religious_total, religious_named, tolerance = 0))) {
    stop(
      "religious category sum does not match source religious total for ",
      spec[["year"]], " / ", paste(source_codes, collapse = "+"),
      call. = FALSE
    )
  }
  no_religion <- sum(parse_count(matches[[spec[["no_religion_col"]]]]), na.rm = TRUE)
  unknown <- if (is.null(spec[["unknown_col"]])) 0 else {
    sum(parse_count(matches[[spec[["unknown_col"]]]]), na.rm = TRUE)
  }
  list(
    population_total = as.integer(round(total)),
    religious_affiliation_count = as.integer(round(religious_named)),
    no_religion_count = as.integer(round(no_religion)),
    unknown_count = as.integer(round(unknown))
  )
}

# aggregate source rows where one or more rows must be subtracted from a total.
aggregate_source_counts_signed <- function(source_rows, include_codes, subtract_codes, spec) {
  include_matches <- source_rows[source_rows[["area_code"]] %in% include_codes, ]
  if (nrow(include_matches) != length(include_codes)) {
    missing <- setdiff(include_codes, include_matches[["area_code"]])
    stop("missing included source rows for ", spec[["year"]], ": ", paste(missing, collapse = ", "), call. = FALSE)
  }
  subtract_matches <- source_rows[source_rows[["area_code"]] %in% subtract_codes, ]
  if (nrow(subtract_matches) != length(subtract_codes)) {
    missing <- setdiff(subtract_codes, subtract_matches[["area_code"]])
    stop("missing subtracted source rows for ", spec[["year"]], ": ", paste(missing, collapse = ", "), call. = FALSE)
  }

  signed_sum <- function(col) {
    sum(parse_count(include_matches[[col]]), na.rm = TRUE) -
      sum(parse_count(subtract_matches[[col]]), na.rm = TRUE)
  }

  total <- signed_sum(spec[["total_col"]])
  religious_total <- signed_sum(spec[["religious_total_col"]])
  religious_named <- sum(vapply(spec[["named_religion_cols"]], signed_sum, numeric(1)))
  if (!isTRUE(all.equal(religious_total, religious_named, tolerance = 0))) {
    stop(
      "religious category sum does not match source religious total for ",
      spec[["year"]], " / ", paste(include_codes, collapse = "+"),
      if (length(subtract_codes)) paste0(" minus ", paste(subtract_codes, collapse = "+")) else "",
      call. = FALSE
    )
  }
  no_religion <- signed_sum(spec[["no_religion_col"]])
  unknown <- if (is.null(spec[["unknown_col"]])) 0 else signed_sum(spec[["unknown_col"]])
  values <- c(total, religious_named, no_religion, unknown)
  if (any(values < 0, na.rm = TRUE)) {
    stop("negative signed source count for ", spec[["year"]], call. = FALSE)
  }

  list(
    population_total = as.integer(round(total)),
    religious_affiliation_count = as.integer(round(religious_named)),
    no_religion_count = as.integer(round(no_religion)),
    unknown_count = as.integer(round(unknown))
  )
}

# return source dataset id for one built wave.
census_dataset_for_year <- function(year) {
  if (year == 1995L) return(census_1995_dataset_id)
  if (year == 2005L) return(census_2005_dataset_id)
  if (year == 2015L) return(census_2015_dataset_id)
  stop("unsupported year: ", year, call. = FALSE)
}

# return the wave specification for one built year.
spec_for_year <- function(year) {
  hits <- Filter(function(spec) spec[["year"]] == year, wave_specs)
  if (length(hits) != 1L) stop("unsupported year: ", year, call. = FALSE)
  hits[[1]]
}

# return the sido wave specification for one built year.
sido_spec_for_year <- function(year) {
  hits <- Filter(function(spec) spec[["year"]] == year, sido_wave_specs)
  if (length(hits) != 1L) stop("unsupported year: ", year, call. = FALSE)
  hits[[1]]
}

# return quality flags for one public area and wave.
quality_flags_for_area <- function(area_code, year, source_codes) {
  flags <- spec_for_year(year)[["quality_flags"]]
  if (area_code %in% names(district_groups)) {
    flags <- c(flags, "boundary_dissolved_from_2018_district_features")
  }
  if (year == 2005L && area_code %in% names(source_code_map_2005)) {
    flags <- c(flags, "2005_source_codes_aggregated_to_2018_harmonised_unit")
  }
  if (year == 2005L && area_code == "29010") {
    flags <- c(flags, "sejong_2012_boundary_not_comparable_uses_yeongi_predecessor_only")
  }
  paste(unique(flags), collapse = ";")
}

# build one schema-shaped area-summary row.
build_area_row <- function(area, year, source_rows_by_year) {
  spec <- spec_for_year(year)
  area_code <- area[["area_code"]][[1]]
  source_codes <- source_codes_for_area(year, area_code)
  counts <- aggregate_source_counts(source_rows_by_year[[as.character(year)]], source_codes, spec)
  pct_affiliated <- if (counts[["population_total"]] > 0) {
    round(100 * counts[["religious_affiliation_count"]] / counts[["population_total"]], 2)
  } else {
    NA_real_
  }
  pct_no_religion <- if (counts[["population_total"]] > 0) {
    round(100 * counts[["no_religion_count"]] / counts[["population_total"]], 2)
  } else {
    NA_real_
  }

  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = "si_gun_gu",
    area_unit_id = paste0(boundary_set_id, ":", area_code),
    area_code = area_code,
    area_name = area[["area_name"]][[1]],
    year = year,
    population_total = counts[["population_total"]],
    population_total_basis = spec[["denominator_note"]],
    religious_affiliation_count = counts[["religious_affiliation_count"]],
    religious_affiliation_percent = null_if_na(pct_affiliated),
    no_religion_count = counts[["no_religion_count"]],
    no_religion_percent = null_if_na(pct_no_religion),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(area[["land_area_sq_km"]][[1]], 2),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = c(census_dataset_for_year(year), boundary_dataset_id),
    quality_flag = quality_flags_for_area(area_code, year, source_codes)
  )
}

# detect whether 1995 can split Ulsan from the printed Gyeongsangnam-do row.
detect_1995_concordance_branch <- function(source_rows) {
  has_gyeongnam <- nrow(source_rows[source_rows[["area_code"]] == "38", ]) == 1L
  has_ulsan_si <- nrow(source_rows[source_rows[["area_code"]] == "38020", ]) == 1L
  if (has_gyeongnam && has_ulsan_si) return("adm2_split")
  if (has_gyeongnam) return("sido_only")
  stop("1995 source lacks the printed Gyeongsangnam-do row", call. = FALSE)
}

# return the source-row rule for one current-sido area and wave.
sido_source_rule <- function(year, area_code, concordance_branch) {
  if (year == 1995L) {
    if (area_code == "29") {
      return(list(
        include = character(0),
        subtract = character(0),
        is_null = TRUE,
        basis_note = "Sejong did not exist in 1995; no 1995 source row can be assigned to the current Sejong sido.",
        flags = c("1995_sejong_not_yet_created", "value_null_by_concordance")
      ))
    }
    if (area_code == "26") {
      if (concordance_branch == "adm2_split") {
        return(list(
          include = "38020",
          subtract = character(0),
          is_null = FALSE,
          basis_note = "1995 Ulsan uses the Ulsan-si row (울산시, source code 38020) inside the printed Gyeongsangnam-do table.",
          flags = c("1995_ulsan_split_from_gyeongsangnam_do")
        ))
      }
      return(list(
        include = character(0),
        subtract = character(0),
        is_null = TRUE,
        basis_note = "The 1995 table is sido-only in this source extract; Ulsan cannot be separated from Gyeongsangnam-do.",
        flags = c("1995_ulsan_not_separable_from_gyeongsangnam_do", "value_null_by_concordance")
      ))
    }
    if (area_code == "38" && concordance_branch == "adm2_split") {
      return(list(
        include = "38",
        subtract = "38020",
        is_null = FALSE,
        basis_note = "1995 Gyeongsangnam-do subtracts the Ulsan-si row (울산시, source code 38020) from the printed Gyeongsangnam-do total.",
        flags = c("1995_gyeongsangnam_do_excludes_ulsan_si")
      ))
    }
    return(list(
      include = area_code,
      subtract = character(0),
      is_null = FALSE,
      basis_note = "1995 source row maps one-to-one to the current sido frame.",
      flags = c("1995_sido_one_to_one")
    ))
  }

  if (year == 2005L) {
    if (area_code == "29") {
      return(list(
        include = "34320",
        subtract = character(0),
        is_null = FALSE,
        basis_note = "2005 Sejong uses the Yeongi-gun predecessor row (source code 34320), matching the existing si/gun/gu convention.",
        flags = c("sejong_2012_boundary_not_comparable_uses_yeongi_predecessor_only")
      ))
    }
    if (area_code == "34") {
      return(list(
        include = "34",
        subtract = "34320",
        is_null = FALSE,
        basis_note = "2005 Chungcheongnam-do subtracts Yeongi-gun (source code 34320) because that predecessor row is assigned to current Sejong.",
        flags = c("2005_chungcheongnam_do_excludes_yeongi_for_sejong_partition")
      ))
    }
  }

  list(
    include = area_code,
    subtract = character(0),
    is_null = FALSE,
    basis_note = if (year == 2015L) {
      "2015 source row maps one-to-one to the current sido frame."
    } else {
      "2005 source row maps one-to-one to the current sido frame."
    },
    flags = character(0)
  )
}

# return quality flags for one public sido and wave.
sido_quality_flags_for_area <- function(area_code, year, rule, spec) {
  flags <- c(spec[["quality_flags"]], rule[["flags"]])
  paste(unique(flags), collapse = ";")
}

# build one schema-shaped current-sido area-summary row.
build_sido_row <- function(area, year, source_rows_by_year, concordance_branch) {
  spec <- sido_spec_for_year(year)
  area_code <- area[["area_code"]][[1]]
  rule <- sido_source_rule(year, area_code, concordance_branch)
  basis <- paste(spec[["denominator_note"]], rule[["basis_note"]])

  if (isTRUE(rule[["is_null"]])) {
    return(list(
      country_code = country_code,
      boundary_set_id = sido_boundary_set_id,
      boundary_level = "sido",
      area_unit_id = paste0(sido_boundary_set_id, ":", area_code),
      area_code = area_code,
      area_name = area[["area_name"]][[1]],
      year = year,
      population_total = NULL,
      population_total_basis = basis,
      religious_affiliation_count = NULL,
      religious_affiliation_percent = NULL,
      no_religion_count = NULL,
      no_religion_percent = NULL,
      place_count = NULL,
      places_per_10000_residents = NULL,
      place_density_per_sq_km = NULL,
      land_area_sq_km = round(area[["land_area_sq_km"]][[1]], 2),
      site_snapshot_date = NULL,
      place_count_basis = NULL,
      source_dataset_ids = c(census_dataset_for_year(year), boundary_dataset_id),
      quality_flag = sido_quality_flags_for_area(area_code, year, rule, spec)
    ))
  }

  counts <- aggregate_source_counts_signed(
    source_rows_by_year[[as.character(year)]],
    rule[["include"]],
    rule[["subtract"]],
    spec
  )
  pct_affiliated <- if (counts[["population_total"]] > 0) {
    round(100 * counts[["religious_affiliation_count"]] / counts[["population_total"]], 2)
  } else {
    NA_real_
  }
  pct_no_religion <- if (counts[["population_total"]] > 0) {
    round(100 * counts[["no_religion_count"]] / counts[["population_total"]], 2)
  } else {
    NA_real_
  }

  list(
    country_code = country_code,
    boundary_set_id = sido_boundary_set_id,
    boundary_level = "sido",
    area_unit_id = paste0(sido_boundary_set_id, ":", area_code),
    area_code = area_code,
    area_name = area[["area_name"]][[1]],
    year = year,
    population_total = counts[["population_total"]],
    population_total_basis = basis,
    religious_affiliation_count = counts[["religious_affiliation_count"]],
    religious_affiliation_percent = null_if_na(pct_affiliated),
    no_religion_count = counts[["no_religion_count"]],
    no_religion_percent = null_if_na(pct_no_religion),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(area[["land_area_sq_km"]][[1]], 2),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = c(census_dataset_for_year(year), boundary_dataset_id),
    quality_flag = sido_quality_flags_for_area(area_code, year, rule, spec)
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
      population_total = csv_scalar(row, "population_total", NA_integer_),
      population_total_basis = row[["population_total_basis"]],
      religious_affiliation_count = csv_scalar(row, "religious_affiliation_count", NA_integer_),
      religious_affiliation_percent = csv_scalar(row, "religious_affiliation_percent", NA_real_),
      no_religion_count = csv_scalar(row, "no_religion_count", NA_integer_),
      no_religion_percent = csv_scalar(row, "no_religion_percent", NA_real_),
      place_count = NA_integer_,
      places_per_10000_residents = NA_real_,
      place_density_per_sq_km = NA_real_,
      land_area_sq_km = csv_scalar(row, "land_area_sq_km", NA_real_),
      site_snapshot_date = NA,
      place_count_basis = NA,
      source_dataset_ids = paste(row[["source_dataset_ids"]], collapse = "|"),
      quality_flag = row[["quality_flag"]],
      stringsAsFactors = FALSE
    )
  }))
}

# create indicator metadata for the South Korea product.
indicators_for_si_gun_gu <- function() {
  list(
    list(
      indicator_id = "population_total",
      label = "Religion table denominator",
      description = "People in the KOSIS religion table denominator for the area and census year.",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "2005: KOSIS DT_1IN0505 내국인 (명). 2015: KOSIS DT_1PM1502 계, from the 20% sample survey of the register-based census.",
      temporal_coverage = "2005, 2015",
      spatial_coverage = "South Korea si/gun/gu reporting units harmonised to a 2018 KoStat-derived boundary layer.",
      quality_notes = "2005 keeps 미상 (unknown) in the denominator. 2015 rows are sample_survey_20pct."
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious affiliation %",
      description = "Share of the table denominator in named religion categories.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * sum(named religion categories) / table total. Named categories include Buddhist, Protestant, Catholic, Won Buddhism, Confucianism, Cheondogyo, Daesoon Jinrihoe or Jeungsan where separately reported, Daejonggyo where separately reported, and other.",
      temporal_coverage = "2005, 2015",
      spatial_coverage = "South Korea si/gun/gu reporting units harmonised to a 2018 KoStat-derived boundary layer.",
      quality_notes = "The broad any-religion construct is retained; no denomination crosswalk is attempted."
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "No religion %",
      description = "Share of the table denominator in the KOSIS no-religion category.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * no religion / table total.",
      temporal_coverage = "2005, 2015",
      spatial_coverage = "South Korea si/gun/gu reporting units harmonised to a 2018 KoStat-derived boundary layer.",
      quality_notes = "No religion is 종교없음 (명) in 2005 and 종교없음-계 in 2015."
    )
  )
}

# create visual-layer metadata for the shared region runtime.
visual_layers_for_si_gun_gu <- function() {
  list(
    list(
      visual_layer_id = "kr-si-gun-gu-religious-affiliation",
      label = "Religious affiliation %",
      description = "South Korea census religious-affiliation share by harmonised si/gun/gu.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "KOSIS religion table total"),
      colour_scale = "shared sequential blue",
      time_control = "year_selector",
      aggregation_rule = "reported or explicitly aggregated KOSIS area value",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = "2015 values are 20% sample-survey estimates from the register-based census."
    ),
    list(
      visual_layer_id = "kr-si-gun-gu-no-religion",
      label = "No religion %",
      description = "South Korea census no-religion share by harmonised si/gun/gu.",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "KOSIS religion table total"),
      colour_scale = "shared sequential blue",
      time_control = "year_selector",
      aggregation_rule = "reported or explicitly aggregated KOSIS area value",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = "2005 keeps the source unknown category in the denominator."
    )
  )
}

# create indicator metadata for the current-sido product.
indicators_for_sido <- function() {
  list(
    list(
      indicator_id = "population_total",
      label = "Religion table denominator",
      description = "People in the KOSIS religion table denominator for the area and census year.",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "1995: KOSIS DT_1IN9506 계. 2005: KOSIS DT_1IN0505 내국인 (명). 2015: KOSIS DT_1PM1502 계, from the 20% sample survey of the register-based census.",
      temporal_coverage = "1995, 2005, 2015",
      spatial_coverage = "South Korea current sido reporting units harmonised to a 2018 KoStat-derived boundary layer.",
      quality_notes = "1995 and 2005 keep 미상 (unknown) in the denominator. 2015 rows are sample_survey_20pct."
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Religious affiliation %",
      description = "Share of the table denominator in named religion categories.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * sum(named religion categories) / table total. The 1995 기타 column maps to the existing other/residual component inside religious affiliation.",
      temporal_coverage = "1995, 2005, 2015",
      spatial_coverage = "South Korea current sido reporting units harmonised to a 2018 KoStat-derived boundary layer.",
      quality_notes = "The broad any-religion construct is retained; no denomination crosswalk is attempted."
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "No religion %",
      description = "Share of the table denominator in the KOSIS no-religion category.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * no religion / table total.",
      temporal_coverage = "1995, 2005, 2015",
      spatial_coverage = "South Korea current sido reporting units harmonised to a 2018 KoStat-derived boundary layer.",
      quality_notes = "No religion is 종교없음 in 1995, 종교없음 (명) in 2005, and 종교없음-계 in 2015."
    )
  )
}

# create visual-layer metadata for the current-sido product.
visual_layers_for_sido <- function() {
  list(
    list(
      visual_layer_id = "kr-sido-religious-affiliation",
      label = "Religious affiliation %",
      description = "South Korea census religious-affiliation share by current sido.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "KOSIS religion table total"),
      colour_scale = "shared sequential blue",
      time_control = "year_selector",
      aggregation_rule = "reported, explicitly aggregated, or explicitly subtracted KOSIS area value",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = "1995 Ulsan is split from Gyeongsangnam-do; 2015 values are 20% sample-survey estimates from the register-based census."
    ),
    list(
      visual_layer_id = "kr-sido-no-religion",
      label = "No religion %",
      description = "South Korea census no-religion share by current sido.",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "KOSIS religion table total"),
      colour_scale = "shared sequential blue",
      time_control = "year_selector",
      aggregation_rule = "reported, explicitly aggregated, or explicitly subtracted KOSIS area value",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = "1995 and 2005 keep the source unknown category in the denominator."
    )
  )
}

# create source-dataset records for the area-summary document.
source_datasets <- function(include_1995 = FALSE) {
  records <- list()
  if (include_1995) {
    records <- c(records, list(list(
      source_dataset_id = census_1995_dataset_id,
      name = "KOSIS DT_1IN9506: 행정구역/성/연령별 종교인구",
      provider = "Korean Statistical Information Service (KOSIS), Statistics Korea",
      url = source_urls[["kosis_1995"]],
      retrieval_date = retrieval_date,
      local_path = wave_spec_1995[["zip_path"]],
      licence = list(
        name = "Korea Open Government License Type 1 (source indication)",
        url = source_urls[["kogl"]],
        attribution = "Korean Statistical Information Service (KOSIS), Statistics Korea"
      ),
      citation = "KOSIS table DT_1IN9506, 행정구역/성/연령별 종교인구, 1995 Population Census.",
      access_limits = NULL,
      redistribution_limits = "Raw KOSIS mass CSV ZIP is not committed; derived public products attribute KOSIS.",
      notes = "Used for 1995 current-sido rows. The table includes province/metropolitan rows and sub-provincial rows; Ulsan-si is split from the printed Gyeongsangnam-do total, and Sejong is null because it did not exist in 1995. The denominator is 계, and 미상 (unknown) remains in the denominator. Printed 1995 categories map as follows: 불교, 개신교, 천주교, 유교, 원불교, 천도교, 대종교, 대순진리회, and 기타 all contribute to religious_affiliation_count; 기타 is the residual other category; 종교없음 maps to no_religion_count."
    )))
  }
  c(records, list(
    list(
      source_dataset_id = census_2005_dataset_id,
      name = "KOSIS DT_1IN0505: 성/연령/종교별 인구-시군구",
      provider = "Korean Statistical Information Service (KOSIS), Statistics Korea",
      url = source_urls[["kosis_2005"]],
      retrieval_date = retrieval_date,
      local_path = wave_specs[[1]][["zip_path"]],
      licence = list(
        name = "Korea Open Government License Type 1 (source indication)",
        url = source_urls[["kogl"]],
        attribution = "Korean Statistical Information Service (KOSIS), Statistics Korea"
      ),
      citation = "KOSIS table DT_1IN0505, 성/연령/종교별 인구-시군구, 2005 Population Census.",
      access_limits = NULL,
      redistribution_limits = "Raw KOSIS mass CSV ZIP is not committed; derived public products attribute KOSIS.",
      notes = "Used for 2005 rows. The denominator is 내국인 (명), and 미상 (unknown) remains in the denominator."
    ),
    list(
      source_dataset_id = census_2015_dataset_id,
      name = "KOSIS DT_1PM1502: 성별/연령별/종교별 인구-시군구",
      provider = "Korean Statistical Information Service (KOSIS), Statistics Korea",
      url = source_urls[["kosis_2015"]],
      retrieval_date = retrieval_date,
      local_path = wave_specs[[2]][["zip_path"]],
      licence = list(
        name = "Korea Open Government License Type 1 (source indication)",
        url = source_urls[["kogl"]],
        attribution = "Korean Statistical Information Service (KOSIS), Statistics Korea"
      ),
      citation = "KOSIS table DT_1PM1502, 성별/연령별/종교별 인구-시군구, 2015 Population Census.",
      access_limits = NULL,
      redistribution_limits = "Raw KOSIS mass CSV ZIP is not committed; derived public products attribute KOSIS.",
      notes = "Used for 2015 rows. Religion was asked in the 20% sample survey of the register-based census."
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "southkorea-maps KoStat 2018 municipalities GeoJSON",
      provider = "southkorea-maps from KoStat administrative boundary geodata",
      url = source_urls[["southkorea_maps_boundary"]],
      retrieval_date = retrieval_date,
      local_path = boundary_raw_path,
      licence = list(
        name = "Korea Open Government License Type 1 / KOSTAT free share-remix attribution basis",
        url = source_urls[["kogl"]],
        attribution = "KoStat / southkorea-maps"
      ),
      citation = "southkorea-maps, skorea-municipalities-2018-geo.json, derived from KoStat administrative division geodata.",
      access_limits = NULL,
      redistribution_limits = "Derived simplified boundary GeoJSON attributes KoStat and southkorea-maps.",
      notes = "The product dissolves 2018 district geometries to parent cities where KOSIS publishes parent-city rows and uses documented predecessor-code aggregations for 2005."
    )
  ))
}

# create the schema-shaped area-summary document.
area_summary_document <- function(rows) {
  list(
    schema_version = "0.2.0",
    generated_at = stamp,
    generated_by = script_id,
    country_code = country_code,
    boundary_set = list(
      boundary_set_id = boundary_set_id,
      country_code = country_code,
      level = "si_gun_gu",
      vintage = "2018-harmonised-for-2005-2015",
      source_dataset_id = boundary_dataset_id
    ),
    site_snapshot = list(
      source_dataset_id = NULL,
      snapshot_date = NULL,
      basis = "no governed South Korea place-of-worship snapshot is included in this country data-map release",
      notes = "The South Korea page exposes KOSIS census affiliation and no-religion metrics only; place-density metrics are hidden until a governed South Korea place layer is built."
    ),
    source_datasets = source_datasets(),
    indicators = indicators_for_si_gun_gu(),
    visual_layers = visual_layers_for_si_gun_gu(),
    rows = rows
  )
}

# create the schema-shaped current-sido area-summary document.
sido_area_summary_document <- function(rows) {
  list(
    schema_version = "0.2.0",
    generated_at = stamp,
    generated_by = script_id,
    country_code = country_code,
    boundary_set = list(
      boundary_set_id = sido_boundary_set_id,
      country_code = country_code,
      level = "sido",
      vintage = "2018-harmonised-for-1995-2015",
      source_dataset_id = boundary_dataset_id
    ),
    site_snapshot = list(
      source_dataset_id = NULL,
      snapshot_date = NULL,
      basis = "no governed South Korea place-of-worship snapshot is included in this country data-map release",
      notes = "The South Korea sido product exposes KOSIS census affiliation and no-religion metrics only; place-density metrics are hidden until a governed South Korea place layer is built."
    ),
    source_datasets = source_datasets(include_1995 = TRUE),
    indicators = indicators_for_sido(),
    visual_layers = visual_layers_for_sido(),
    rows = rows
  )
}

# create a manifest durable-file record for one generated output.
manifest_file_record <- function(path, content, licence_status = "kogl_type_1_attribution") {
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

# create a manifest raw-source record for a local source file.
raw_source_record <- function(path, source_dataset_id, url, notes, used_in_public_product = TRUE, periods = NULL) {
  list(
    uri = path,
    url = url,
    format = sub("^.*\\.", "", path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    row_count = row_count_file(path),
    source_dataset_id = source_dataset_id,
    used_in_public_product = used_in_public_product,
    periods = periods,
    notes = notes
  )
}

# compare public area rows with the source national row for a wave.
validate_against_national <- function(rows_flat, source_rows, spec) {
  national <- source_rows[source_rows[["area_code"]] == "00", ]
  if (nrow(national) != 1L) stop("expected one national source row for ", spec[["year"]], call. = FALSE)
  area_year <- rows_flat[rows_flat[["year"]] == spec[["year"]], ]
  source_total <- parse_count(national[[spec[["total_col"]]]])
  source_religious <- sum(vapply(spec[["named_religion_cols"]], function(col) {
    parse_count(national[[col]])
  }, numeric(1)))
  source_no_religion <- parse_count(national[[spec[["no_religion_col"]]]])
  source_unknown <- if (is.null(spec[["unknown_col"]])) 0 else parse_count(national[[spec[["unknown_col"]]]])

  result <- list(
    year = spec[["year"]],
    area_count = nrow(area_year),
    population_total_area_sum = sum(area_year[["population_total"]], na.rm = TRUE),
    population_total_national = source_total,
    population_total_difference = sum(area_year[["population_total"]], na.rm = TRUE) - source_total,
    religious_affiliation_area_sum = sum(area_year[["religious_affiliation_count"]], na.rm = TRUE),
    religious_affiliation_national = source_religious,
    religious_affiliation_difference = sum(area_year[["religious_affiliation_count"]], na.rm = TRUE) - source_religious,
    no_religion_area_sum = sum(area_year[["no_religion_count"]], na.rm = TRUE),
    no_religion_national = source_no_religion,
    no_religion_difference = sum(area_year[["no_religion_count"]], na.rm = TRUE) - source_no_religion,
    unknown_area_sum = if (spec[["year"]] == 2005L) {
      sum(vapply(area_year[["area_code"]], function(code) {
        aggregate_source_counts(source_rows, source_codes_for_area(2005L, code), spec)[["unknown_count"]]
      }, integer(1)))
    } else {
      0L
    },
    unknown_national = source_unknown
  )
  result[["unknown_difference"]] <- result[["unknown_area_sum"]] - result[["unknown_national"]]
  result
}

# compare current-sido rows with the source national row for a wave.
validate_sido_against_national <- function(rows_flat, source_rows_by_year, spec, area_codes, concordance_branch) {
  source_rows <- source_rows_by_year[[as.character(spec[["year"]])]]
  national <- source_rows[source_rows[["area_code"]] == "00", ]
  if (nrow(national) != 1L) stop("expected one national source row for ", spec[["year"]], call. = FALSE)
  area_year <- rows_flat[rows_flat[["year"]] == spec[["year"]], ]
  source_total <- parse_count(national[[spec[["total_col"]]]])
  source_religious <- sum(vapply(spec[["named_religion_cols"]], function(col) {
    parse_count(national[[col]])
  }, numeric(1)))
  source_no_religion <- parse_count(national[[spec[["no_religion_col"]]]])
  source_unknown <- if (is.null(spec[["unknown_col"]])) 0 else parse_count(national[[spec[["unknown_col"]]]])

  unknown_area_sum <- sum(vapply(area_codes, function(code) {
    rule <- sido_source_rule(spec[["year"]], code, concordance_branch)
    if (isTRUE(rule[["is_null"]])) return(0L)
    aggregate_source_counts_signed(source_rows, rule[["include"]], rule[["subtract"]], spec)[["unknown_count"]]
  }, integer(1)))

  result <- list(
    year = spec[["year"]],
    area_count = nrow(area_year),
    non_null_population_area_count = sum(!is.na(area_year[["population_total"]])),
    population_total_area_sum = sum(area_year[["population_total"]], na.rm = TRUE),
    population_total_national = source_total,
    population_total_difference = sum(area_year[["population_total"]], na.rm = TRUE) - source_total,
    religious_affiliation_area_sum = sum(area_year[["religious_affiliation_count"]], na.rm = TRUE),
    religious_affiliation_national = source_religious,
    religious_affiliation_difference = sum(area_year[["religious_affiliation_count"]], na.rm = TRUE) - source_religious,
    no_religion_area_sum = sum(area_year[["no_religion_count"]], na.rm = TRUE),
    no_religion_national = source_no_religion,
    no_religion_difference = sum(area_year[["no_religion_count"]], na.rm = TRUE) - source_no_religion,
    unknown_area_sum = unknown_area_sum,
    unknown_national = source_unknown
  )
  result[["unknown_difference"]] <- result[["unknown_area_sum"]] - result[["unknown_national"]]
  result
}

# compare the built 1995 Gyeongsangnam-do and Ulsan split with the source row.
validate_1995_gyeongnam_ulsan_split <- function(rows_flat, source_rows, concordance_branch) {
  spec <- wave_spec_1995
  printed <- aggregate_source_counts_signed(source_rows, "38", character(0), spec)
  if (concordance_branch != "adm2_split") {
    return(list(
      branch = concordance_branch,
      status = "not_applicable",
      reason = "The 1995 source extract lacks a separable Ulsan-si sub-provincial row."
    ))
  }

  gyeongnam <- rows_flat[rows_flat[["year"]] == 1995L & rows_flat[["area_code"]] == "38", ]
  ulsan <- rows_flat[rows_flat[["year"]] == 1995L & rows_flat[["area_code"]] == "26", ]
  if (nrow(gyeongnam) != 1L || nrow(ulsan) != 1L) {
    stop("expected one built 1995 row each for Gyeongsangnam-do and Ulsan", call. = FALSE)
  }
  built_unknown <- sum(vapply(c("38", "26"), function(code) {
    rule <- sido_source_rule(1995L, code, concordance_branch)
    aggregate_source_counts_signed(source_rows, rule[["include"]], rule[["subtract"]], spec)[["unknown_count"]]
  }, integer(1)))
  result <- list(
    branch = concordance_branch,
    status = "passed",
    printed_gyeongsangnam_do_population_total = printed[["population_total"]],
    built_gyeongsangnam_do_plus_ulsan_population_total = sum(gyeongnam[["population_total"]], ulsan[["population_total"]], na.rm = TRUE),
    population_total_difference = sum(gyeongnam[["population_total"]], ulsan[["population_total"]], na.rm = TRUE) - printed[["population_total"]],
    printed_gyeongsangnam_do_religious_affiliation_count = printed[["religious_affiliation_count"]],
    built_gyeongsangnam_do_plus_ulsan_religious_affiliation_count = sum(gyeongnam[["religious_affiliation_count"]], ulsan[["religious_affiliation_count"]], na.rm = TRUE),
    religious_affiliation_difference = sum(gyeongnam[["religious_affiliation_count"]], ulsan[["religious_affiliation_count"]], na.rm = TRUE) - printed[["religious_affiliation_count"]],
    printed_gyeongsangnam_do_no_religion_count = printed[["no_religion_count"]],
    built_gyeongsangnam_do_plus_ulsan_no_religion_count = sum(gyeongnam[["no_religion_count"]], ulsan[["no_religion_count"]], na.rm = TRUE),
    no_religion_difference = sum(gyeongnam[["no_religion_count"]], ulsan[["no_religion_count"]], na.rm = TRUE) - printed[["no_religion_count"]],
    printed_gyeongsangnam_do_unknown_count = printed[["unknown_count"]],
    built_gyeongsangnam_do_plus_ulsan_unknown_count = built_unknown,
    unknown_difference = built_unknown - printed[["unknown_count"]]
  )
  if (result[["population_total_difference"]] != 0 ||
      result[["religious_affiliation_difference"]] != 0 ||
      result[["no_religion_difference"]] != 0 ||
      result[["unknown_difference"]] != 0) {
    stop("1995 Gyeongsangnam-do/Ulsan split validation failed", call. = FALSE)
  }
  result
}

# dissolve the 2018 boundary file to the harmonised product units.
write_boundary_product <- function(input_path, output_path) {
  require_file(input_path)
  boundary <- st_read(input_path, quiet = TRUE)
  boundary[["source_code"]] <- as.character(boundary[["code"]])
  child_map <- unlist(lapply(names(district_groups), function(parent) {
    setNames(rep(parent, length(district_groups[[parent]])), district_groups[[parent]])
  }))
  boundary[["area_code"]] <- ifelse(
    boundary[["source_code"]] %in% names(child_map),
    unname(child_map[boundary[["source_code"]]]),
    boundary[["source_code"]]
  )
  boundary[["area_name"]] <- vapply(
    seq_len(nrow(boundary)),
    function(index) normalise_area_name(boundary[["area_code"]][[index]], boundary[["name_eng"]][[index]]),
    character(1)
  )

  boundary_5179 <- st_make_valid(st_transform(boundary, 5179))
  groups <- split(seq_len(nrow(boundary_5179)), boundary_5179[["area_code"]])
  dissolved <- do.call(rbind, lapply(names(groups), function(area_code) {
    index <- groups[[area_code]]
    st_sf(
      area_code = area_code,
      area_name = normalise_area_name(area_code, boundary_5179[["name_eng"]][index][[1]]),
      area_unit_id = paste0(boundary_set_id, ":", area_code),
      boundary_set_id = boundary_set_id,
      boundary_level = "si_gun_gu",
      source_boundary_codes = paste(sort(boundary_5179[["source_code"]][index]), collapse = "|"),
      source_korean_names = paste(sort(boundary_5179[["name"]][index]), collapse = "|"),
      land_area_sq_km = as.numeric(sum(st_area(boundary_5179[index, ]))) / 1e6,
      geometry = st_union(st_geometry(boundary_5179[index, ]))
    )
  }))
  dissolved <- dissolved[order(dissolved[["area_code"]]), ]

  tolerances <- c(50, 100, 200, 500, 750, 1000, 1500, 2000, 3000, 5000)
  chosen_tolerance <- tail(tolerances, 1)
  chosen_bytes <- NA_integer_
  for (tolerance in tolerances) {
    candidate <- st_simplify(dissolved, dTolerance = tolerance, preserveTopology = TRUE)
    candidate <- st_make_valid(st_transform(candidate, 4326))
    st_write(candidate, output_path, delete_dsn = TRUE, quiet = TRUE)
    chosen_bytes <- file_bytes(output_path)
    chosen_tolerance <- tolerance
    if (chosen_bytes <= kr_boundary_max_bytes) break
  }
  if (chosen_bytes > kr_boundary_max_bytes) {
    stop("boundary output remains above 3 MB after simplification", call. = FALSE)
  }

  list(
    area_table = st_drop_geometry(dissolved)[c("area_code", "area_name", "land_area_sq_km", "source_boundary_codes")],
    source_feature_count = nrow(boundary),
    output_feature_count = row_count_file(output_path),
    simplification_tolerance_m = chosen_tolerance,
    output_bytes = chosen_bytes
  )
}

# dissolve the 2018 boundary file to current-sido product units.
write_sido_boundary_product <- function(input_path, output_path) {
  require_file(input_path)
  boundary <- st_read(input_path, quiet = TRUE)
  boundary[["source_code"]] <- as.character(boundary[["code"]])
  boundary[["area_code"]] <- substr(boundary[["source_code"]], 1L, 2L)
  if (!setequal(unique(boundary[["area_code"]]), names(sido_area_names))) {
    missing <- setdiff(names(sido_area_names), unique(boundary[["area_code"]]))
    extra <- setdiff(unique(boundary[["area_code"]]), names(sido_area_names))
    stop(
      "unexpected current-sido boundary codes; missing=",
      paste(missing, collapse = "|"),
      " extra=",
      paste(extra, collapse = "|"),
      call. = FALSE
    )
  }

  boundary_5179 <- st_make_valid(st_transform(boundary, 5179))
  groups <- split(seq_len(nrow(boundary_5179)), boundary_5179[["area_code"]])
  dissolved <- do.call(rbind, lapply(names(sido_area_names), function(area_code) {
    index <- groups[[area_code]]
    st_sf(
      area_code = area_code,
      area_name = unname(sido_area_names[[area_code]]),
      area_unit_id = paste0(sido_boundary_set_id, ":", area_code),
      boundary_set_id = sido_boundary_set_id,
      boundary_level = "sido",
      source_boundary_codes = paste(sort(boundary_5179[["source_code"]][index]), collapse = "|"),
      source_korean_names = paste(sort(boundary_5179[["name"]][index]), collapse = "|"),
      land_area_sq_km = as.numeric(sum(st_area(boundary_5179[index, ]))) / 1e6,
      geometry = st_union(st_geometry(boundary_5179[index, ]))
    )
  }))
  dissolved <- dissolved[order(dissolved[["area_code"]]), ]

  tolerances <- c(50, 100, 200, 500, 750, 1000, 1500, 2000, 3000, 5000)
  chosen_tolerance <- tail(tolerances, 1)
  chosen_bytes <- NA_integer_
  for (tolerance in tolerances) {
    candidate <- st_simplify(dissolved, dTolerance = tolerance, preserveTopology = TRUE)
    candidate <- st_make_valid(st_transform(candidate, 4326))
    st_write(candidate, output_path, delete_dsn = TRUE, quiet = TRUE)
    chosen_bytes <- file_bytes(output_path)
    chosen_tolerance <- tolerance
    if (chosen_bytes <= kr_boundary_max_bytes) break
  }
  if (chosen_bytes > kr_boundary_max_bytes) {
    stop("sido boundary output remains above 3 MB after simplification", call. = FALSE)
  }

  list(
    area_table = st_drop_geometry(dissolved)[c("area_code", "area_name", "land_area_sq_km", "source_boundary_codes")],
    source_feature_count = nrow(boundary),
    output_feature_count = row_count_file(output_path),
    simplification_tolerance_m = chosen_tolerance,
    output_bytes = chosen_bytes
  )
}

for (spec in sido_wave_specs) require_file(spec[["zip_path"]])
require_file(boundary_raw_path)

boundary_info <- write_boundary_product(boundary_raw_path, boundary_out)
area_table <- boundary_info[["area_table"]][order(boundary_info[["area_table"]][["area_code"]]), ]
if (nrow(area_table) != 229L) stop("expected 229 harmonised KR area units", call. = FALSE)

sido_boundary_info <- write_sido_boundary_product(boundary_raw_path, sido_boundary_out)
sido_area_table <- sido_boundary_info[["area_table"]][order(sido_boundary_info[["area_table"]][["area_code"]]), ]
if (nrow(sido_area_table) != 17L) stop("expected 17 harmonised KR sido units", call. = FALSE)

source_rows_by_year <- setNames(
  lapply(sido_wave_specs, read_kosis_wave),
  vapply(sido_wave_specs, function(spec) as.character(spec[["year"]]), character(1))
)
concordance_branch <- detect_1995_concordance_branch(source_rows_by_year[["1995"]])
years <- vapply(wave_specs, `[[`, integer(1), "year")
sido_years <- vapply(sido_wave_specs, `[[`, integer(1), "year")

area_split <- split(area_table, seq_len(nrow(area_table)))
rows <- unname(unlist(lapply(area_split, function(area) {
  lapply(years, function(year) build_area_row(area, year, source_rows_by_year))
}), recursive = FALSE))

sido_area_split <- split(sido_area_table, seq_len(nrow(sido_area_table)))
sido_rows <- unname(unlist(lapply(sido_area_split, function(area) {
  lapply(sido_years, function(year) build_sido_row(area, year, source_rows_by_year, concordance_branch))
}), recursive = FALSE))

write_json(area_summary_document(rows), summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")
write_json(sido_area_summary_document(sido_rows), sido_summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(sido_rows), sido_summary_csv_out, row.names = FALSE, na = "")

rows_flat <- flatten_rows(rows)
sido_rows_flat <- flatten_rows(sido_rows)
national_validation <- lapply(wave_specs, function(spec) {
  result <- validate_against_national(rows_flat, source_rows_by_year[[as.character(spec[["year"]])]], spec)
  if (result[["population_total_difference"]] != 0 ||
      result[["religious_affiliation_difference"]] != 0 ||
      result[["no_religion_difference"]] != 0 ||
      result[["unknown_difference"]] != 0) {
    stop("national validation failed for ", spec[["year"]], call. = FALSE)
  }
  result
})

sido_national_validation <- lapply(sido_wave_specs, function(spec) {
  result <- validate_sido_against_national(
    sido_rows_flat,
    source_rows_by_year,
    spec,
    sido_area_table[["area_code"]],
    concordance_branch
  )
  if (result[["population_total_difference"]] != 0 ||
      result[["religious_affiliation_difference"]] != 0 ||
      result[["no_religion_difference"]] != 0 ||
      result[["unknown_difference"]] != 0) {
    stop("sido national validation failed for ", spec[["year"]], call. = FALSE)
  }
  result
})

gyeongnam_ulsan_validation <- validate_1995_gyeongnam_ulsan_split(
  sido_rows_flat,
  source_rows_by_year[["1995"]],
  concordance_branch
)

join_coverage <- lapply(years, function(year) {
  list(
    year = year,
    matched_area_count = nrow(area_table),
    expected_area_count = nrow(area_table),
    missing_area_names = character(0),
    notes = if (year == 2005L) {
      "All 229 harmonised units are matched after documented 2005 predecessor-code aggregation."
    } else {
      "All 229 harmonised units are matched to 2015 KOSIS rows."
    }
  )
})

sido_join_coverage <- lapply(sido_years, function(year) {
  list(
    year = year,
    matched_area_count = nrow(sido_area_table),
    expected_area_count = nrow(sido_area_table),
    non_null_area_count = sum(!is.na(sido_rows_flat[sido_rows_flat[["year"]] == year, "population_total"])),
    missing_area_names = character(0),
    notes = if (year == 1995L) {
      if (concordance_branch == "adm2_split") {
        "All 17 current sido rows are emitted; Sejong is null because it did not exist, Ulsan uses the Ulsan-si row, and Gyeongsangnam-do subtracts Ulsan-si."
      } else {
        "All 17 current sido rows are emitted; Sejong and Ulsan are null because the 1995 source cannot separate them."
      }
    } else if (year == 2005L) {
      "All 17 current sido rows are emitted; Sejong uses Yeongi-gun and Chungcheongnam-do subtracts Yeongi-gun to preserve the national partition."
    } else {
      "All 17 current sido rows are matched to 2015 KOSIS current-sido rows."
    }
  )
})

raw_sources <- list(
  raw_source_record(
    wave_spec_1995[["zip_path"]],
    census_1995_dataset_id,
    kosis_mass_url("DT_1IN9506"),
    "KOSIS mass CSV ZIP 101_DT_1IN9506_F_1995; used for current-sido rows with Ulsan split from Gyeongsangnam-do and Sejong null.",
    TRUE,
    "1995"
  ),
  raw_source_record(
    wave_specs[[1]][["zip_path"]],
    census_2005_dataset_id,
    kosis_mass_url("DT_1IN0505"),
    "KOSIS mass CSV ZIP 101_DT_1IN0505_F_2005; used for 2005 harmonised si/gun/gu rows and current-sido rows.",
    TRUE,
    "2005"
  ),
  raw_source_record(
    wave_specs[[2]][["zip_path"]],
    census_2015_dataset_id,
    kosis_mass_url("DT_1PM1502"),
    "KOSIS mass CSV ZIP 101_DT_1PM1502_F_2015; used for 2015 harmonised si/gun/gu rows and current-sido rows.",
    TRUE,
    "2015"
  ),
  raw_source_record(
    boundary_raw_path,
    boundary_dataset_id,
    source_urls[["southkorea_maps_boundary"]],
    "KoStat-derived 2018 municipality GeoJSON from southkorea-maps; dissolved to harmonised si/gun/gu and current-sido units.",
    TRUE,
    "2018"
  )
)

si_summary_sha <- sha256_file(summary_json_out)
sido_summary_sha <- sha256_file(sido_summary_json_out)
summary_sha <- sha256_values(c(si_summary_sha, sido_summary_sha))
sido_boundary_sha <- sha256_file(sido_boundary_out)
boundary_sha <- sha256_file(boundary_out)
docs_manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = paste0("manifest:kr-census-religion:kr:1995-2015:", substr(summary_sha, 1, 12)),
  dataset_id = "kr-census-religion:kr:1995-2015:kosis",
  dataset_version_id = paste0("kr-census-religion:kr:1995-2015:kosis:", substr(summary_sha, 1, 12)),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "kr-census-religion",
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
      waves = c("1995", "2005", "2015"),
      boundary_sets = list(si_gun_gu = boundary_set_id, sido = sido_boundary_set_id),
      boundary_simplification_tolerance_m = list(
        si_gun_gu = boundary_info[["simplification_tolerance_m"]],
        sido = sido_boundary_info[["simplification_tolerance_m"]]
      ),
      denominator = "KOSIS table total: 1995 계 and 2005 내국인 (명), both including 미상 (unknown), and 2015 계; 2015 is a 20% sample-survey estimate.",
      omitted_metrics = c("religious_change", "places_per_10000_residents", "place_density_per_sq_km")
    ),
    software_versions = list(
      r = paste(R.version[["major"]], R.version[["minor"]], sep = "."),
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite"))
    )
  ),
  source = list(
    provider = "Korean Statistical Information Service (KOSIS), Statistics Korea; southkorea-maps / KoStat boundaries",
    source_dataset_ids = c(census_1995_dataset_id, census_2005_dataset_id, census_2015_dataset_id, boundary_dataset_id),
    source_urls = c(source_urls[["kosis_1995"]], source_urls[["kosis_2005"]], source_urls[["kosis_2015"]], source_urls[["southkorea_maps_boundary"]], source_urls[["southkorea_maps_readme"]], source_urls[["kogl"]]),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = "KOSIS and KoStat-derived inputs are recorded as Korea Open Government License Type 1 / source-indication attribution material; the southkorea-maps README describes KOSTAT data as free to share or remix.",
    citation = "KOSIS tables DT_1IN9506, DT_1IN0505, and DT_1PM1502; southkorea-maps skorea-municipalities-2018-geo.json derived from KoStat administrative boundary geodata.",
    raw_redistribution = "Raw KOSIS ZIPs and the KoStat-derived raw boundary file are not committed. They remain in data/raw/kr_census/ with manifest checksums."
  ),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = list(
    manifest_file_record(summary_json_out, "South Korea harmonised si/gun/gu area summary with KOSIS census religion metrics for 2005 and 2015."),
    manifest_file_record(summary_csv_out, "Flattened South Korea harmonised si/gun/gu area summary with KOSIS census religion metrics for 2005 and 2015."),
    manifest_file_record(boundary_out, "Simplified South Korea harmonised si/gun/gu boundary GeoJSON derived from KoStat 2018 municipalities."),
    manifest_file_record(sido_summary_json_out, "South Korea current-sido area summary with KOSIS census religion metrics for 1995, 2005, and 2015."),
    manifest_file_record(sido_summary_csv_out, "Flattened South Korea current-sido area summary with KOSIS census religion metrics for 1995, 2005, and 2015."),
    manifest_file_record(sido_boundary_out, "Simplified South Korea current-sido boundary GeoJSON derived from KoStat 2018 municipalities.")
  ),
  derived_outputs = list(
    list(
      uri = paste0("repo:", summary_json_out),
      sha256 = si_summary_sha,
      built_by = script_id,
      notes = sprintf("%d harmonised si/gun/gu units x 2 census years.", nrow(area_table))
    ),
    list(
      uri = paste0("repo:", sido_summary_json_out),
      sha256 = sido_summary_sha,
      built_by = script_id,
      notes = sprintf("%d current-sido units x 3 census years; 1995 Sejong row is null by concordance.", nrow(sido_area_table))
    ),
    list(
      uri = paste0("repo:", boundary_out),
      sha256 = boundary_sha,
      built_by = script_id,
      notes = sprintf("KoStat-derived 2018 municipality layer dissolved to %d si/gun/gu units and simplified at %d m tolerance.", nrow(area_table), boundary_info[["simplification_tolerance_m"]])
    ),
    list(
      uri = paste0("repo:", sido_boundary_out),
      sha256 = sido_boundary_sha,
      built_by = script_id,
      notes = sprintf("KoStat-derived 2018 municipality layer dissolved to %d current-sido units and simplified at %d m tolerance.", nrow(sido_area_table), sido_boundary_info[["simplification_tolerance_m"]])
    )
  ),
  validation = list(
    checks = c(
      "KOSIS 1995, 2005, and 2015 mass CSV ZIPs are present under data/raw/kr_census/.",
      "The 1995 source is read as CP949/EUC-KR-style text and contains province/metropolitan and sub-provincial total rows.",
      "Religious affiliation is recomputed as the sum of named religion columns and validated against the source religious total column for every used source row.",
      "Si/gun/gu rows reconcile exactly to the 2005 and 2015 national source rows for population_total, religious_affiliation_count, no_religion_count, and 2005 unknown_count.",
      "Current-sido rows reconcile exactly to the 1995, 2005, and 2015 national source rows for population_total, religious_affiliation_count, no_religion_count, and unknown_count.",
      "The 1995 Gyeongsangnam-do plus Ulsan split reconciles exactly to the printed 1995 Gyeongsangnam-do row.",
      sprintf("KoStat-derived boundary source has %d features; outputs have %d si/gun/gu features and %d current-sido features.", boundary_info[["source_feature_count"]], boundary_info[["output_feature_count"]], sido_boundary_info[["output_feature_count"]]),
      sprintf("Boundary GeoJSON writes to %d si/gun/gu bytes after %d m simplification and %d sido bytes after %d m simplification.", boundary_info[["output_bytes"]], boundary_info[["simplification_tolerance_m"]], sido_boundary_info[["output_bytes"]], sido_boundary_info[["simplification_tolerance_m"]]),
      "Religious change is omitted because 2005 is a full-count census table while 2015 is a 20% sample survey and several rows use predecessor-code or boundary-concordance assignments."
    ),
    join_coverage = list(si_gun_gu = join_coverage, sido = sido_join_coverage),
    national_validation = list(si_gun_gu = national_validation, sido = sido_national_validation),
    concordance = list(
      branch = concordance_branch,
      evidence = if (concordance_branch == "adm2_split") {
        "The 1995 total-sex/total-age source rows include Gyeongsangnam-do (code 38) and Ulsan-si (울산시, code 38020); Ulsan is therefore separable."
      } else {
        "The 1995 source has a Gyeongsangnam-do row but no separable Ulsan-si sub-provincial row; Ulsan is null for 1995."
      },
      gyeongnam_ulsan_validation = gyeongnam_ulsan_validation,
      sejong_1995 = "Sejong is null for 1995 because it did not exist in 1995."
    ),
    category_mapping_1995 = list(
      printed_categories = c("계", "종교있음", "불교", "개신교", "천주교", "유교", "원불교", "천도교", "대종교", "대순진리회", "기타", "종교없음", "미상"),
      religious_affiliation_count = c("불교", "개신교", "천주교", "유교", "원불교", "천도교", "대종교", "대순진리회", "기타"),
      other_residual = "기타",
      no_religion_count = "종교없음",
      denominator = "계, with 미상 retained in the denominator"
    ),
    boundary_validation = list(
      si_gun_gu = list(
        source_feature_count = boundary_info[["source_feature_count"]],
        output_feature_count = boundary_info[["output_feature_count"]],
        output_bytes = boundary_info[["output_bytes"]],
        simplification_tolerance_m = boundary_info[["simplification_tolerance_m"]],
        harmonised_area_count = nrow(area_table),
        dissolved_parent_codes = names(district_groups)
      ),
      sido = list(
        source_feature_count = sido_boundary_info[["source_feature_count"]],
        output_feature_count = sido_boundary_info[["output_feature_count"]],
        output_bytes = sido_boundary_info[["output_bytes"]],
        simplification_tolerance_m = sido_boundary_info[["simplification_tolerance_m"]],
        harmonised_area_count = nrow(sido_area_table)
      )
    )
  ),
  deferred_sources = list(
    list(
      source_dataset_id = census_1985_dataset_id,
      table_id = "DT_1IN8505",
      year = 1985,
      geography = "sido",
      status = "deferred",
      reason = "KOSIS exposes the table page and metadata, but no mass CSV file was available through the no-key bulk route during this build; scripted grid export requires session state that is not yet reproducible in the builder."
    )
  ),
  construct_notes = list(
    "The public product keeps the country's own broad any-religion and no-religion constructs; no denomination crosswalk is attempted.",
    "1995 religious_affiliation_count sums Buddhist, Protestant, Catholic, Confucianism, Won Buddhism, Cheondogyo, Daejonggyo, Daesoon Jinrihoe, and other; the 1995 기타 category maps to the product's other/residual component.",
    "2005 religious_affiliation_count sums Buddhist, Protestant, Catholic, Confucianism, Won Buddhism, Jeungsan, Cheondogyo, Daejonggyo, and other.",
    "2015 religious_affiliation_count sums Buddhist, Protestant, Catholic, Won Buddhism, Confucianism, Cheondogyo, Daesoon Jinrihoe, Daejonggyo, and other.",
    "1995 uses KOSIS table total 계, including 미상. 2005 uses KOSIS table total 내국인 (명), including 미상. 2015 uses KOSIS table total 계.",
    "The 1995 current-sido concordance uses the source Ulsan-si row inside Gyeongsangnam-do as current Ulsan and subtracts Ulsan-si from Gyeongsangnam-do; Sejong is null because it did not exist in 1995.",
    "The 2005 current-sido concordance assigns Yeongi-gun to current Sejong and subtracts Yeongi-gun from Chungcheongnam-do, matching the existing si/gun/gu convention.",
    "2015 religion came from the 20% sample survey of the register-based census; rows carry sample_survey_20pct.",
    "The harmonised si/gun/gu boundary set dissolves 2018 district geometries to parent cities where KOSIS uses parent-city totals, and aggregates documented 2005 predecessor codes for Sejong, Yeoju, Cheongju, Gyeryong, Dangjin, Changwon, and Jeju."
  ),
  privacy = "public",
  licence_status = "kogl_type_1_attribution",
  downstream_status = "public",
  source_datasets = source_datasets(include_1995 = TRUE),
  notes = "The committed products contain derived area summaries and simplified boundaries only. On-page attribution must cite KOSIS, KoStat, southkorea-maps, and KOGL Type 1 attribution."
)

write_json(docs_manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
manifest_text <- paste(readLines(manifest_out, warn = FALSE), collapse = "\n")
if (!validate(manifest_text)) stop("manifest JSON failed jsonlite::validate", call. = FALSE)

cat(sprintf("wrote %s: %d rows\n", summary_json_out, length(rows)))
cat(sprintf("wrote %s: %d rows\n", summary_csv_out, row_count_file(summary_csv_out)))
cat(sprintf("wrote %s: %d features, %d bytes\n", boundary_out, row_count_file(boundary_out), file_bytes(boundary_out)))
cat(sprintf("wrote %s: %d rows\n", sido_summary_json_out, length(sido_rows)))
cat(sprintf("wrote %s: %d rows\n", sido_summary_csv_out, row_count_file(sido_summary_csv_out)))
cat(sprintf("wrote %s: %d features, %d bytes\n", sido_boundary_out, row_count_file(sido_boundary_out), file_bytes(sido_boundary_out)))
cat(sprintf("wrote %s\n", manifest_out))
cat(sprintf("1995 concordance branch: %s\n", concordance_branch))
cat("done\n")
