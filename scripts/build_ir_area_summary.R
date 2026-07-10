# build the Iran province census-affiliation area-summary product.
# inputs: Statistical Centre of Iran (SCI) province religion tables for the
# 1385 (2006), 1390 (2011), and 1395 (2016) censuses, recovered from pinned
# institutional mirrors, plus a Natural Earth admin-1 polygon layer dissolved
# to the 28-unit 2006-2016 analytical concordance.
# outputs: apps/regions/ir/data/area_summary_province.{json,csv},
# apps/regions/ir/data/ir_province_concordance28.geojson, and
# docs/manifests/ir-census-religion-2006-2016.json.
# run from the repository root: Rscript scripts/build_ir_area_summary.R

suppressMessages({
  library(digest)
  library(jsonlite)
  library(readxl)
  library(sf)
  library(stringi)
})
source("scripts/lib/simplify_boundary.R")

raw_dir <- "data/raw/ir_census"
output_dir <- "apps/regions/ir/data"
manifest_dir <- "docs/manifests"
dir.create(raw_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

country_code <- "IR"
script_id <- "scripts/build_ir_area_summary.R"
retrieval_date <- "2026-07-11"
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
git_commit <- tryCatch(system("git rev-parse --short HEAD", intern = TRUE), error = function(e) NA_character_)
waves <- c(2006L, 2011L, 2016L)

boundary_level <- "province"
boundary_vintage <- "2006-2016-concordance-28"
boundary_set_id <- "ir-province-concordance28-naturalearth10m"
census_2006_dataset_id <- "sci-census-1385-religion-ostan-2006"
census_2011_dataset_id <- "sci-yearbook-1390-table-2-18-religion-ostan-2011"
census_2016_dataset_id <- "sci-yearbook-1395-table-3-18-religion-ostan-2016"
un_2011_dataset_id <- "unsd-iran-2011-census-results-religion-national"
un_2016_dataset_id <- "undata-iran-2016-religion-national-table28"
boundary_dataset_id <- "naturalearth-10m-admin1-iran"
overlap_tolerance_sq_m <- 1
sliver_tolerance_sq_m <- 1000000

# pinned mirrors (SCI portal amar.org.ir was unreachable during the probe).
# the probe's pinned 2016 mirror (iranopendata iod451.pdf) is behind a
# Cloudflare bot challenge and unreachable from this sandbox; the reachable
# substitute is the SCI Statistical Yearbook 1395 population chapter, table
# 3-18 (same 1395 census), mirrored by the Iran Data Portal, with the UN data
# table 28 supplying the independent 2016 national totals.
url_2006 <- "https://irandataportal.syr.edu/wp-content/uploads/18-population-by-religion-and-ostan-1385-census-2006.xlsx"
url_2011 <- "https://istmat.org/files/uploads/44180/iran_statistical_yearbook_2011-2012_1390.pdf"
url_2011_un <- "https://unstats.un.org/unsd/demographic-social/census/documents/Iran/Iran-2011-Census-Results.pdf"
url_2016 <- "https://irandataportal.syr.edu/wp-content/uploads/Population-3.pdf"
url_2016_un <- "https://data.un.org/Data.aspx?d=POP&f=tableCode%3A28%3BcountryCode%3A364"
url_2016_pinned_unreachable <- "https://www.iranopendata.org/res/get/datasets/Sources/iod451.pdf"
url_boundary <- "https://naturalearth.s3.amazonaws.com/10m_cultural/ne_10m_admin_1_states_provinces.zip"

path_2006 <- file.path(raw_dir, "ir_2006_religion_ostan.xlsx")
path_2011 <- file.path(raw_dir, "ir_2011_yearbook_1390_istmat.pdf")
path_2011_un <- file.path(raw_dir, "ir_2011_un_census_results.pdf")
path_2016 <- file.path(raw_dir, "ir_2016_sci_yearbook_1395_population_idp.pdf")
path_2016_un <- file.path(raw_dir, "ir_undata_religion_2016_national.csv")
path_boundary_zip <- file.path(raw_dir, "ne_10m_admin_1.zip")
boundary_shp <- file.path(raw_dir, "ne_10m_admin_1", "ne_10m_admin_1_states_provinces.shp")

summary_json_out <- file.path(output_dir, "area_summary_province.json")
summary_csv_out <- file.path(output_dir, "area_summary_province.csv")
boundary_out <- file.path(output_dir, "ir_province_concordance28.geojson")
manifest_out <- file.path(manifest_dir, "ir-census-religion-2006-2016.json")

# which mirror served each cached raw input, for honest provenance recording.
mirror_of <- c(
  "ir_2006_religion_ostan.xlsx" = "Iran Data Portal (Syracuse University) institutional mirror",
  "ir_2011_yearbook_1390_istmat.pdf" = "istmat.org institutional mirror of the SCI Statistical Yearbook 1390",
  "ir_2011_un_census_results.pdf" = "United Nations Statistics Division mirror of the SCI 2011 results",
  "ir_2016_sci_yearbook_1395_population_idp.pdf" = "Iran Data Portal (Syracuse University) mirror of the SCI Statistical Yearbook 1395 population chapter, table 3-18",
  "ir_undata_religion_2016_national.csv" = "United Nations data (data.un.org) table 28 export of the SCI 2016 national religion counts",
  "ne_10m_admin_1.zip" = "Natural Earth (naturalearthdata.com) public-domain download"
)

# the source's own recognised category frame, English and Persian, verbatim.
category_ids <- c("total", "muslim", "christian", "zoroastrian", "jew", "other", "not_stated")
category_english <- c(
  total = "Total", muslim = "Muslim", christian = "Christian",
  zoroastrian = "Zoroastrian", jew = "Jew", other = "Other", not_stated = "Not stated"
)
category_persian <- c(
  total = "جمع", muslim = "مسلمان",
  christian = "مسیحی", zoroastrian = "زرتشتی",
  jew = "کلیمی", other = "سایر",
  not_stated = "اظهار نشده"
)
religion_ids <- c("muslim", "christian", "zoroastrian", "jew", "other")

# the ruled description note, shipped in both the manifest and the product.
description_note <- paste(
  "This product renders the census record of religious affiliation as the Statistical Centre of Iran (SCI) publishes it.",
  "The published categories are Total, Muslim, Christian, Zoroastrian, Jew, Other, and Not stated.",
  "Identities outside these recognised categories, including unrecognised religious minorities, do not appear in the official record.",
  "The published tables provide no rule for assigning such identities to the Other category or the Not stated category, and this product makes no such assignment."
)
description_sentinel <- "The published tables provide no rule for assigning such identities"

# public-facing licence note (product and README): attribution only, no
# internal-ruling citation. the dated project-lead approval is confined to the
# manifest licence fields per the lane conventions.
licence_note_public <- paste(
  "No explicit SCI reuse licence was located.",
  "The product publishes derived category counts with attribution to the Statistical Centre of Iran (SCI).",
  "Written SCI confirmation of reuse terms is pending."
)
licence_note_manifest <- paste(
  licence_note_public,
  "Publication proceeds under project-lead approval 2026-07-11."
)
boundary_stability_note <- paste(
  "The boundary layer is the Natural Earth 1:10m admin-1 layer for Iran, a public-domain, non-official, generalised layer that depicts the current 31-province structure.",
  "It is dissolved to the 28-unit analytical concordance.",
  "Geometric stability of these units across the 2006, 2011, and 2016 census nights is not verified; the polygons approximate current provincial extents and are not census-vintage geometry."
)

# canonical province concordance: squashed source label -> province id.
squash <- function(x) gsub("[^a-z0-9]", "", tolower(x))
province_lookup <- c(
  eastazarbayejan = "east_azarbaijan", eastazarbaijan = "east_azarbaijan", eastazerbaijan = "east_azarbaijan",
  westazarbayejan = "west_azarbaijan", westazarbaijan = "west_azarbaijan", westazerbaijan = "west_azarbaijan",
  ardebil = "ardabil", ardabil = "ardabil",
  esfahan = "esfahan", isfahan = "esfahan",
  ilam = "ilam",
  bushehr = "bushehr", boushehr = "bushehr",
  tehran = "tehran", alborz = "alborz",
  chaharmahalbakhtiyari = "chahar_mahaal_bakhtiari", chaharmahalbakhtiari = "chahar_mahaal_bakhtiari",
  chaharmahalandbakhtiari = "chahar_mahaal_bakhtiari", chaharmahallandbakhtiari = "chahar_mahaal_bakhtiari",
  southkhorasan = "south_khorasan", khorasanjonoubi = "south_khorasan", khorasansouth = "south_khorasan",
  khorasanerazavi = "razavi_khorasan", razavikhorasan = "razavi_khorasan", khorasanrazavi = "razavi_khorasan",
  northkhorasan = "north_khorasan", khorasanshomali = "north_khorasan", khorasannorth = "north_khorasan",
  khuzestan = "khuzestan",
  zanjan = "zanjan", semnan = "semnan",
  sistanbaluchestan = "sistan_baluchestan", sistanandbaluchestan = "sistan_baluchestan",
  sistanbalouchestan = "sistan_baluchestan", sistanbaluchistan = "sistan_baluchestan",
  fars = "fars", qazvin = "qazvin", qom = "qom",
  kordestan = "kordestan", kurdistan = "kordestan",
  kerman = "kerman", kermanshah = "kermanshah",
  kohgiluyehboyerahmad = "kohgiluyeh_boyer_ahmad", kohgiluyehandbuyerahmad = "kohgiluyeh_boyer_ahmad",
  kohgiluyehboyeahmad = "kohgiluyeh_boyer_ahmad", kohgiluyehandboyerahmad = "kohgiluyeh_boyer_ahmad",
  golestan = "golestan", gilan = "gilan",
  lorestan = "lorestan", luristan = "lorestan",
  mazandaran = "mazandaran", markazi = "markazi",
  hormozgan = "hormozgan", hamedan = "hamadan", hamadan = "hamadan",
  yazd = "yazd"
)

# province id -> Natural Earth name, for the boundary join.
id_to_ne_name <- c(
  alborz = "Alborz", tehran = "Tehran", razavi_khorasan = "Razavi Khorasan",
  south_khorasan = "South Khorasan", yazd = "Yazd", north_khorasan = "North Khorasan",
  ardabil = "Ardebil", bushehr = "Bushehr", chahar_mahaal_bakhtiari = "Chahar Mahall and Bakhtiari",
  east_azarbaijan = "East Azarbaijan", esfahan = "Esfahan", fars = "Fars", gilan = "Gilan",
  golestan = "Golestan", hamadan = "Hamadan", hormozgan = "Hormozgan", ilam = "Ilam",
  kerman = "Kerman", kermanshah = "Kermanshah", khuzestan = "Khuzestan",
  kohgiluyeh_boyer_ahmad = "Kohgiluyeh and Buyer Ahmad", kordestan = "Kordestan",
  lorestan = "Lorestan", markazi = "Markazi", mazandaran = "Mazandaran", qazvin = "Qazvin",
  qom = "Qom", semnan = "Semnan", sistan_baluchestan = "Sistan and Baluchestan",
  west_azarbaijan = "West Azarbaijan", zanjan = "Zanjan"
)

# province id -> 28-unit concordance unit (two aggregations, else identity).
unit_of_province <- function(id) {
  ifelse(id %in% c("tehran", "alborz"), "tehran_alborz",
    ifelse(id %in% c("razavi_khorasan", "south_khorasan", "yazd"), "khorasan_yazd", id))
}
# 28 unit ids and display names.
unit_names <- c(
  ardabil = "Ardabil", bushehr = "Bushehr", chahar_mahaal_bakhtiari = "Chahar Mahaal and Bakhtiari",
  east_azarbaijan = "East Azarbaijan", esfahan = "Esfahan", fars = "Fars", gilan = "Gilan",
  golestan = "Golestan", hamadan = "Hamadan", hormozgan = "Hormozgan", ilam = "Ilam",
  kerman = "Kerman", kermanshah = "Kermanshah", khorasan_yazd = "Razavi Khorasan, South Khorasan and Yazd",
  khuzestan = "Khuzestan", kohgiluyeh_boyer_ahmad = "Kohgiluyeh and Boyer-Ahmad",
  kordestan = "Kordestan", lorestan = "Lorestan", markazi = "Markazi", mazandaran = "Mazandaran",
  north_khorasan = "North Khorasan", qazvin = "Qazvin", qom = "Qom", semnan = "Semnan",
  sistan_baluchestan = "Sistan and Baluchestan", tehran_alborz = "Tehran and Alborz",
  west_azarbaijan = "West Azarbaijan", zanjan = "Zanjan"
)

# ---- helpers ---------------------------------------------------------------

# return a file's SHA-256 digest.
sha256_file <- function(path) unname(tools::sha256sum(path))
# return a file size in bytes.
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))

# map a source province label (or an already-canonical id) to a province id.
province_id <- function(src_name) {
  known <- unique(unname(province_lookup))
  out <- vapply(src_name, function(s) {
    if (s %in% known) return(s)                       # already a canonical id
    id <- unname(province_lookup[squash(s)])
    if (is.na(id)) return(NA_character_)
    id
  }, character(1), USE.NAMES = FALSE)
  if (any(is.na(out))) {
    stop("unmapped source province label(s): ",
         paste(unique(src_name[is.na(out)]), collapse = "; "), call. = FALSE)
  }
  out
}

# convert Persian and Arabic-Indic digits to ASCII digits.
ascii_digits <- function(x) {
  persian <- c("۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹")
  arabic <- c("٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩")
  for (d in 0:9) {
    x <- gsub(persian[d + 1L], as.character(d), x, fixed = TRUE)
    x <- gsub(arabic[d + 1L], as.character(d), x, fixed = TRUE)
  }
  x
}

# return JSON null for a missing scalar.
null_if_na <- function(value) {
  if (length(value) == 0L || is.na(value)) return(NULL)
  value
}

# return a stable row or feature count for a generated artefact.
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$", path)) return(nrow(st_read(path, quiet = TRUE)))
  object <- fromJSON(path, simplifyVector = FALSE)
  if (!is.null(object[["rows"]])) return(length(object[["rows"]]))
  NA_integer_
}

# ---- wave parsers (each returns provinces data.frame + national vector) ----
# PARSERS FOR 2011 AND 2016 ARE FILLED IN AFTER INSPECTING THE MIRROR TEXT.

# parse the 2006 (1385) SCI XLSX religion-by-ostan table.
parse_2006 <- function() {
  x <- read_excel(path_2006, sheet = 1, col_names = FALSE, .name_repair = "minimal")
  header <- as.character(unlist(x[3, ]))
  if (!identical(header[1:8], c("Ostan", "Total", "Muslim", "Zoroastrian", "Christian", "Jew", "Other", "Not stated"))) {
    stop("2006 XLSX column layout changed", call. = FALSE)
  }
  national <- as.numeric(unlist(x[4, 2:8]))
  names(national) <- c("total", "muslim", "zoroastrian", "christian", "jew", "other", "not_stated")
  body <- x[7:36, ]
  provinces <- data.frame(
    src_name = as.character(unlist(body[, 1])),
    total = as.numeric(unlist(body[, 2])),
    muslim = as.numeric(unlist(body[, 3])),
    zoroastrian = as.numeric(unlist(body[, 4])),
    christian = as.numeric(unlist(body[, 5])),
    jew = as.numeric(unlist(body[, 6])),
    other = as.numeric(unlist(body[, 7])),
    not_stated = as.numeric(unlist(body[, 8])),
    stringsAsFactors = FALSE
  )
  list(
    provinces = provinces[, c("src_name", category_ids)],
    national = national[category_ids]
  )
}

# transliterated Persian province name (Latin-ASCII, squashed) -> province id.
# the 2016 SCI table publishes Persian names; transliteration avoids both
# non-ASCII source literals and any positional assumption about row order.
persian_translit_lookup <- c(
  adhrbayjanshrqy = "east_azarbaijan", adhrbayjanghrby = "west_azarbaijan",
  ardbyl = "ardabil", asfhan = "esfahan", albrz = "alborz", aylam = "ilam",
  bwshhr = "bushehr", thran = "tehran", chharmhalwbkhtyary = "chahar_mahaal_bakhtiari",
  khrasanjnwby = "south_khorasan", khrasanrdwy = "razavi_khorasan", khrasanshmaly = "north_khorasan",
  khwzstan = "khuzestan", znjan = "zanjan", smnan = "semnan", systanwblwchstan = "sistan_baluchestan",
  fars = "fars", qzwyn = "qazvin", qm = "qom", krdstan = "kordestan", krman = "kerman",
  krmanshah = "kermanshah", khgylwyhwbwyrahmd = "kohgiluyeh_boyer_ahmad", glstan = "golestan",
  gylan = "gilan", lrstan = "lorestan", mazndran = "mazandaran", mrkzy = "markazi",
  hrmzgan = "hormozgan", hmdan = "hamadan", yzd = "yazd"
)

# convert one PDF to layout-preserving UTF-8 text via poppler pdftotext.
pdf_to_text <- function(pdf_path) {
  out <- tempfile(fileext = ".txt")
  status <- system2("pdftotext", c("-layout", shQuote(pdf_path), shQuote(out)),
                    stdout = FALSE, stderr = FALSE)
  if (!identical(status, 0L) || !file.exists(out)) {
    stop("pdftotext failed for ", pdf_path, call. = FALSE)
  }
  readLines(out, warn = FALSE, encoding = "UTF-8")
}

# parse the 2011 (1390) SCI yearbook table 2.18 religion-by-ostan table.
parse_2011 <- function() {
  lines <- pdf_to_text(path_2011)
  candidates <- grep("POPULATION BY RELIGION AND OSTAN, 1390 CENSUS", lines)
  if (length(candidates) < 1L) stop("2011 yearbook table 2.18 header not found", call. = FALSE)
  # the phrase also appears in the table of contents; choose the occurrence
  # actually followed by the "Total country" national row with seven counts.
  header <- NA_integer_
  for (h in candidates) {
    window <- lines[h:min(h + 12L, length(lines))]
    tc <- window[grepl("Total country", window)]
    if (length(tc) >= 1L && length(regmatches(tc[1], gregexpr("[0-9]+", tc[1]))[[1]]) == 7L) {
      header <- h; break
    }
  }
  if (is.na(header)) stop("2011 religion table body not located", call. = FALSE)
  footer <- grep("Source: Statistical Centre of Iran", lines)
  footer <- footer[footer > header][1]
  block <- lines[header:footer]
  natl_line <- block[grep("Total country", block)][1]
  natl_nums <- as.numeric(regmatches(natl_line, gregexpr("[0-9]+", natl_line))[[1]])
  if (length(natl_nums) != 7L) stop("2011 national row did not yield 7 counts", call. = FALSE)
  # yearbook column order: Total, Muslim, Christian, Zoroastrian, Jew, Other, Not stated.
  national <- setNames(natl_nums, c("total", "muslim", "christian", "zoroastrian", "jew", "other", "not_stated"))
  provinces <- list()
  for (ln in block) {
    if (grepl("Total country", ln) || grepl("POPULATION BY RELIGION", ln)) next
    name <- trimws(gsub("[.]+", " ", gsub("[0-9]+", "", ln)))
    name <- trimws(gsub("\\s+", " ", name))
    nums <- as.numeric(regmatches(ln, gregexpr("[0-9]+", ln))[[1]])
    if (length(nums) != 7L || nchar(name) < 3L) next
    provinces[[length(provinces) + 1L]] <- data.frame(
      src_name = name, total = nums[1], muslim = nums[2], christian = nums[3],
      zoroastrian = nums[4], jew = nums[5], other = nums[6], not_stated = nums[7],
      stringsAsFactors = FALSE
    )
  }
  provinces <- do.call(rbind, provinces)
  if (nrow(provinces) != 31L) stop("2011 table did not yield 31 province rows", call. = FALSE)
  list(provinces = provinces[, c("src_name", category_ids)], national = national[category_ids])
}

# parse the 2016 (1395) SCI yearbook table 3-18 religion-by-ostan (Persian).
# national totals come from the UN data table 28 export (independent, SCI source).
parse_2016 <- function() {
  lines <- pdf_to_text(path_2016)
  fa <- c("۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹")
  to_ascii <- function(x) { for (d in 0:9) x <- gsub(fa[d + 1L], as.character(d), x, fixed = TRUE); x }
  count7 <- function(ln) length(regmatches(to_ascii(ln), gregexpr("[0-9]+", to_ascii(ln)))[[1]]) == 7L
  # "3-18" also appears in the table of contents; choose the occurrence whose
  # next few lines begin the province rows (each with seven Persian-digit counts).
  candidates <- grep("3-18", lines)
  header <- NA_integer_
  for (h in candidates) {
    window <- lines[(h + 1L):min(h + 5L, length(lines))]
    if (any(vapply(window, count7, logical(1)))) { header <- h; break }
  }
  if (is.na(header)) stop("2016 table 3-18 body not located", call. = FALSE)
  # normalise a Persian name to a transliterated squashed ASCII key.
  name_key <- function(x) {
    x <- gsub("[0-9]", "", to_ascii(x))
    x <- stri_trans_nfkc(x)
    x <- gsub("\\p{Cf}", "", x, perl = TRUE)
    x <- stri_trans_general(x, "Any-Latin; Latin-ASCII")
    gsub("[^a-z]", "", tolower(x))
  }
  provinces <- list(); i <- header + 1L
  while (length(provinces) < 31L && i <= length(lines)) {
    ln <- lines[i]; i <- i + 1L
    asc <- to_ascii(ln)
    nums <- as.numeric(regmatches(asc, gregexpr("[0-9]+", asc))[[1]])
    if (length(nums) != 7L) next
    id <- unname(persian_translit_lookup[name_key(ln)])
    if (is.na(id)) stop("2016 unmapped Persian province: ", name_key(ln), call. = FALSE)
    # printed left-to-right order: Not stated, Other, Jew, Christian, Zoroastrian, Muslim, Total.
    provinces[[length(provinces) + 1L]] <- data.frame(
      src_name = id, total = nums[7], muslim = nums[6], christian = nums[4],
      zoroastrian = nums[5], jew = nums[3], other = nums[2], not_stated = nums[1],
      stringsAsFactors = FALSE
    )
  }
  provinces <- do.call(rbind, provinces)
  if (nrow(provinces) != 31L) stop("2016 table did not yield 31 province rows", call. = FALSE)
  # independent national totals from the UN data table 28 export.
  un <- read.csv(path_2016_un, stringsAsFactors = FALSE, check.names = FALSE)
  un <- un[un[["Year"]] == 2016 & un[["Area"]] == "Total" & un[["Sex"]] == "Both Sexes", ]
  un_map <- c(Total = "total", Muslim = "muslim", Christian = "christian",
              Zoroastrian = "zoroastrian", Jewish = "jew", `Other Religions` = "other",
              `Not Specified` = "not_stated")
  national <- setNames(rep(NA_real_, length(category_ids)), category_ids)
  for (k in seq_len(nrow(un))) {
    id <- un_map[[un[["Religion"]][k]]]
    if (!is.null(id)) national[[id]] <- as.numeric(un[["Value"]][k])
  }
  if (any(is.na(national))) stop("2016 national totals incomplete from UN data export", call. = FALSE)
  list(provinces = provinces[, c("src_name", category_ids)], national = national[category_ids])
}

# ---- normalisation, concordance, and exact reconciliation (hard gates) -----

# apply the concordance and reconcile a wave to its published national totals.
# a failed gate stops the build; it is written up, never tuned away.
normalise_wave <- function(parsed, year) {
  prov <- parsed[["provinces"]]
  prov[["prov_id"]] <- province_id(prov[["src_name"]])
  if (anyDuplicated(prov[["prov_id"]])) {
    stop("duplicate province after mapping in wave ", year, call. = FALSE)
  }
  # hard gate: within-province category sum equals the published province total.
  row_component_sum <- rowSums(prov[, c(religion_ids, "not_stated")])
  if (any(row_component_sum != prov[["total"]])) {
    bad <- prov[["src_name"]][row_component_sum != prov[["total"]]]
    stop("wave ", year, " province category sum does not equal total: ",
         paste(bad, collapse = "; "), call. = FALSE)
  }
  prov[["unit"]] <- unit_of_province(prov[["prov_id"]])
  # hard gate: every source province maps to exactly one of the 28 units.
  if (!all(prov[["unit"]] %in% names(unit_names))) {
    stop("wave ", year, " produced a unit outside the 28-unit frame", call. = FALSE)
  }
  units <- lapply(category_ids, function(cat) {
    tapply(prov[[cat]], prov[["unit"]], sum)
  })
  names(units) <- category_ids
  unit_ids <- sort(unique(prov[["unit"]]))
  if (length(unit_ids) != 28L || !setequal(unit_ids, names(unit_names))) {
    stop("wave ", year, " did not resolve to the 28 concordance units", call. = FALSE)
  }
  unit_table <- data.frame(
    unit = unit_ids,
    area_name = unname(unit_names[unit_ids]),
    stringsAsFactors = FALSE
  )
  for (cat in category_ids) unit_table[[cat]] <- as.integer(units[[cat]][unit_ids])
  # hard gate: each unit total equals its six-category sum.
  unit_component_sum <- rowSums(unit_table[, c(religion_ids, "not_stated")])
  if (any(unit_component_sum != unit_table[["total"]])) {
    stop("wave ", year, " unit category sum does not equal unit total", call. = FALSE)
  }
  # hard gate: unit sums reconcile exactly to the published national totals.
  national <- parsed[["national"]][category_ids]
  unit_colsum <- vapply(category_ids, function(cat) sum(unit_table[[cat]]), numeric(1))
  reconciliation <- lapply(category_ids, function(cat) {
    list(
      category = category_english[[cat]],
      category_persian = category_persian[[cat]],
      unit_sum = as.integer(unit_colsum[[cat]]),
      published_national_total = as.integer(national[[cat]]),
      difference = as.integer(unit_colsum[[cat]] - national[[cat]]),
      status = if (unit_colsum[[cat]] == national[[cat]]) "matched" else "mismatch"
    )
  })
  if (any(vapply(reconciliation, function(r) r[["difference"]] != 0L, logical(1)))) {
    stop("wave ", year, " failed exact national reconciliation", call. = FALSE)
  }
  # hard gate: national total equals its own six-category sum.
  if (sum(national[religion_ids], national[["not_stated"]]) != national[["total"]]) {
    stop("wave ", year, " national category sum does not equal national total", call. = FALSE)
  }
  list(
    year = year,
    source_province_count = nrow(prov),
    unit_table = unit_table,
    national = national,
    reconciliation = reconciliation,
    province_to_unit = prov[order(prov[["unit"]]), c("src_name", "prov_id", "unit")]
  )
}

# ---- boundary --------------------------------------------------------------

# dissolve the Natural Earth Iran admin-1 layer to the 28 concordance units.
build_boundary <- function() {
  ne_to_id <- setNames(names(id_to_ne_name), unname(id_to_ne_name))
  src <- st_read(boundary_shp, quiet = TRUE)
  src <- src[src[["iso_a2"]] == country_code | src[["admin"]] == "Iran", ]
  src[["prov_id"]] <- unname(ne_to_id[as.character(src[["name"]])])
  if (nrow(src) != 31L || anyNA(src[["prov_id"]])) {
    stop("Natural Earth Iran layer did not yield 31 mapped provinces", call. = FALSE)
  }
  src[["unit"]] <- unit_of_province(src[["prov_id"]])
  src <- st_make_valid(src)
  dissolved <- aggregate(src[, "geometry"], list(area_code = src[["unit"]]), st_union)
  dissolved <- st_make_valid(dissolved)
  dissolved[["area_name"]] <- unname(unit_names[dissolved[["area_code"]]])
  if (anyNA(dissolved[["area_name"]])) stop("dissolved unit missing a display name", call. = FALSE)
  dissolved[["area_unit_id"]] <- paste(boundary_set_id, dissolved[["area_code"]], sep = ":")
  dissolved[["boundary_set_id"]] <- boundary_set_id
  dissolved[["boundary_level"]] <- boundary_level
  dissolved[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(dissolved, 6933))) / 1e6
  dissolved <- st_transform(dissolved, 4326)
  dissolved[order(dissolved[["area_code"]]), c(
    "area_code", "area_name", "area_unit_id", "boundary_set_id",
    "boundary_level", "land_area_sq_km", "geometry"
  )]
}

# count interior rings in a polygon or multipolygon union as uncovered gaps.
interior_ring_count <- function(geometry) {
  sfg <- st_geometry(geometry)[[1]]
  if (inherits(sfg, "POLYGON")) return(max(0L, length(sfg) - 1L))
  if (inherits(sfg, "MULTIPOLYGON")) {
    return(sum(vapply(sfg, function(polygon) max(0L, length(polygon) - 1L), integer(1))))
  }
  stop("boundary union is not polygonal", call. = FALSE)
}

# enforce validity, distinctness, coverage, overlap, and sliver gates.
validate_boundary <- function(layer, stage) {
  validity <- st_is_valid(layer)
  if (nrow(layer) != 28L || any(st_is_empty(layer)) || any(is.na(validity)) || any(!validity)) {
    stop(stage, " boundary does not contain 28 valid non-empty features", call. = FALSE)
  }
  if (!setequal(layer[["area_code"]], names(unit_names))) {
    stop(stage, " boundary unit codes changed", call. = FALSE)
  }
  hashes <- vapply(st_as_binary(st_geometry(layer), EWKB = TRUE), function(wkb) {
    digest(wkb, algo = "sha256", serialize = FALSE)
  }, character(1))
  if (length(unique(hashes)) != 28L) {
    stop(stage, " boundary does not have 28 distinct geometry hashes", call. = FALSE)
  }
  metric <- st_transform(layer, 6933)
  union <- st_union(metric)
  overlap_sq_m <- sum(as.numeric(st_area(metric))) - as.numeric(st_area(union))
  if (overlap_sq_m > overlap_tolerance_sq_m) {
    stop(stage, " boundary overlap exceeds the fixed ", overlap_tolerance_sq_m,
         " square metre tolerance", call. = FALSE)
  }
  gap_count <- interior_ring_count(union)
  if (gap_count != 0L) {
    stop(stage, " boundary union contains an uncovered interior gap", call. = FALSE)
  }
  polygon_parts <- suppressWarnings(st_cast(st_geometry(metric), "POLYGON"))
  part_areas_sq_m <- as.numeric(st_area(polygon_parts))
  sliver_count <- sum(part_areas_sq_m < sliver_tolerance_sq_m)
  if (sliver_count != 0L) {
    stop(stage, " boundary contains a polygon part below the fixed ",
         sliver_tolerance_sq_m, " square metre sliver tolerance", call. = FALSE)
  }
  list(
    valid_feature_count = sum(validity),
    hashes = setNames(as.list(hashes), layer[["area_code"]]),
    overlap_sq_m = round(overlap_sq_m, 6),
    interior_gap_count = gap_count,
    sliver_count = sliver_count,
    sliver_tolerance_sq_m = sliver_tolerance_sq_m,
    polygon_part_count = length(part_areas_sq_m),
    minimum_polygon_part_sq_m = round(min(part_areas_sq_m), 3),
    coverage_sq_km = round(as.numeric(st_area(union)) / 1e6, 4)
  )
}

# simplify the dissolved boundary and rerun every geometry hard gate.
write_boundary <- function(boundary) {
  source_validation <- validate_boundary(boundary, "dissolved source")
  simplification <- mapshaper_simplify_to_cap(
    boundary, boundary_out, max_bytes = 1500000,
    keep_percentages = c(100, 75, 50, 25, 15, 10, 7.5, 5, 3, 2, 1),
    clean_option = "allow-overlaps"
  )
  written <- st_read(boundary_out, quiet = TRUE)
  written <- written[order(written[["area_code"]]), ]
  simplified_validation <- validate_boundary(written, "simplified")
  simplification[["byte_ceiling"]] <- 1500000L
  list(
    layer = written, simplification = simplification,
    source_validation = source_validation,
    simplified_validation = simplified_validation,
    valid_feature_count = simplified_validation[["valid_feature_count"]],
    geometry_hashes = simplified_validation[["hashes"]]
  )
}

# ---- area-summary rows -----------------------------------------------------

# build one schema-conforming unit-year row rendering the recognised frame.
build_row <- function(year, unit_row, boundary) {
  area <- boundary[boundary[["area_code"]] == unit_row[["unit"]], ]
  total <- as.integer(unit_row[["total"]])
  affiliation <- sum(as.integer(unit_row[religion_ids]))
  not_stated <- as.integer(unit_row[["not_stated"]])
  category_flag <- paste(vapply(religion_ids, function(cat) {
    paste0(cat, "=", as.integer(unit_row[[cat]]))
  }, character(1)), collapse = ";")
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = area[["area_unit_id"]][[1]],
    area_code = unit_row[["unit"]],
    area_name = unit_row[["area_name"]],
    year = year,
    population_total = total,
    population_total_basis = paste0(
      "SCI published census population for ", year,
      "; the total is the source Total (جمع) for the concordance unit. ", description_note
    ),
    religious_affiliation_count = affiliation,
    religious_affiliation_percent = round(100 * affiliation / total, 4),
    no_religion_count = NULL,
    no_religion_percent = NULL,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(area[["land_area_sq_km"]][[1]], 4),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(
      switch(as.character(year),
        "2006" = census_2006_dataset_id,
        "2011" = census_2011_dataset_id,
        "2016" = census_2016_dataset_id),
      boundary_dataset_id
    ),
    quality_flag = paste0(
      "census_affiliation_recognised_frame;",
      "affiliation=total_minus_not_stated;",
      category_flag, ";not_stated=", not_stated, ";",
      "source_categories_verbatim=Total|Muslim|Christian|Zoroastrian|Jew|Other|Not stated;",
      "no_religion_category_absent_in_source;",
      "exact_national_reconciliation;",
      "concordance_unit=", unit_row[["unit"]], ";",
      "boundary_stability_unverified"
    )
  )
}

# flatten row objects into the CSV companion shape.
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
    religious_affiliation_percent = vapply(rows, `[[`, numeric(1), "religious_affiliation_percent"),
    no_religion_count = NA_integer_,
    no_religion_percent = NA_real_,
    place_count = NA_integer_, places_per_10000_residents = NA_real_,
    place_density_per_sq_km = NA_real_,
    land_area_sq_km = vapply(rows, `[[`, numeric(1), "land_area_sq_km"),
    site_snapshot_date = NA_character_, place_count_basis = NA_character_,
    source_dataset_ids = vapply(rows, function(r) paste(unlist(r[["source_dataset_ids"]]), collapse = "|"), character(1)),
    quality_flag = vapply(rows, `[[`, character(1), "quality_flag"),
    stringsAsFactors = FALSE
  )
}

# ---- product declarations --------------------------------------------------

# declare the census-affiliation indicators in the source's own frame.
indicators <- function() {
  temporal <- "SCI censuses 1385 (2006), 1390 (2011), and 1395 (2016)."
  spatial <- "Twenty-eight analytical units from the SCI province tables under the 2006-2016 concordance."
  list(
    list(
      indicator_id = "population_total",
      label = "Census population",
      description = "SCI published census population (Total, جمع) for the concordance unit and wave.",
      unit = "count", denominator_indicator_id = NULL,
      method = "Sum of the SCI province Total counts within each concordance unit.",
      temporal_coverage = temporal, spatial_coverage = spatial,
      quality_notes = description_note
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Reported a recognised religion (%)",
      description = paste(
        "Share of the census population reporting one of the recognised religion categories (Muslim, Christian, Zoroastrian, Jew, or Other).",
        description_note
      ),
      unit = "percent", denominator_indicator_id = "population_total",
      method = "100 times (Total minus Not stated) divided by Total, using the SCI counts summed to the concordance unit.",
      temporal_coverage = temporal, spatial_coverage = spatial,
      quality_notes = paste(
        "The recognised religion categories and the Not stated category are the source's own.",
        "Not stated is a non-response category; it is not a measure of no religion, and the SCI tables publish no no-religion category.",
        description_note
      )
    )
  )
}

# describe the census and boundary datasets used by the product.
source_datasets <- function() {
  sci_licence <- list(
    name = "No explicit SCI reuse licence located; attribution to the Statistical Centre of Iran",
    url = "https://amar.org.ir",
    attribution = "Source: Statistical Centre of Iran (SCI)"
  )
  list(
    list(
      source_dataset_id = census_2006_dataset_id,
      name = "SCI table 18: Population by Religion and Ostan, 1385 Census (2006)",
      provider = "Statistical Centre of Iran (SCI)", url = url_2006,
      retrieval_date = retrieval_date, local_path = path_2006,
      licence = sci_licence,
      citation = "Statistical Centre of Iran, 1385 (2006) Census, table 18, Population by Religion and Ostan.",
      access_limits = "SCI portal amar.org.ir was unreachable during the probe; served by the Iran Data Portal mirror.",
      redistribution_limits = licence_note_public,
      notes = "Thirty province rows and a national total; category order Total, Muslim, Zoroastrian, Christian, Jew, Other, Not stated."
    ),
    list(
      source_dataset_id = census_2011_dataset_id,
      name = "SCI Statistical Yearbook 1390, table 2.18: Population by Religion and Ostan, 1390 Census (2011)",
      provider = "Statistical Centre of Iran (SCI)", url = url_2011,
      retrieval_date = retrieval_date, local_path = path_2011,
      licence = sci_licence,
      citation = "Statistical Centre of Iran, Statistical Yearbook 1390, table 2.18.",
      access_limits = "Served by the istmat.org mirror; SCI portal unreachable during the probe.",
      redistribution_limits = licence_note_public,
      notes = "Thirty-one province rows and the national row. The archived UN Statistics Division PDF contains a national religion table but no provincial religion-category table; no machine comparison against the 2011 province rows was performed."
    ),
    list(
      source_dataset_id = un_2011_dataset_id,
      name = "United Nations Statistics Division: Iran 2011 Census Results, Population by Religion",
      provider = "United Nations Statistics Division, from SCI", url = url_2011_un,
      retrieval_date = retrieval_date, local_path = path_2011_un,
      licence = sci_licence,
      citation = "United Nations Statistics Division, Iran 2011 Census Results (SCI source), national Population by Religion 2006-2011.",
      access_limits = NULL,
      redistribution_limits = licence_note_public,
      notes = "Archived supporting copy with a recorded SHA-256 hash. No machine comparison was performed because the PDF contains no provincial religion-category table; the build reconciles the 2011 province rows to the SCI yearbook national row."
    ),
    list(
      source_dataset_id = census_2016_dataset_id,
      name = "SCI Statistical Yearbook 1395, table 3-18: Population by Religion and Ostan, Aban 1395 Census (2016)",
      provider = "Statistical Centre of Iran (SCI)", url = url_2016,
      retrieval_date = retrieval_date, local_path = path_2016,
      licence = sci_licence,
      citation = "Statistical Centre of Iran, Statistical Yearbook 1395 (2016-2017), population chapter, table 3-18, Population by Religion and Ostan.",
      access_limits = paste(
        "The probe's pinned 2016 mirror (Iran Open Data iod451.pdf, SCI Statistical Yearbook 1399) is behind a Cloudflare bot challenge and was unreachable from this sandbox.",
        "The reachable substitute is the SCI Statistical Yearbook 1395 population chapter (same 1395 census, same table), mirrored by the Iran Data Portal.",
        paste0("Pinned but unreachable: ", url_2016_pinned_unreachable, ".")
      ),
      redistribution_limits = licence_note_public,
      notes = "Thirty-one province rows in the Persian yearbook; Persian province labels transliterated for mapping and recorded in construct notes."
    ),
    list(
      source_dataset_id = un_2016_dataset_id,
      name = "United Nations data, table 28: Iran Population by Religion, 2016 census (national)",
      provider = "United Nations Statistics Division, from SCI", url = url_2016_un,
      retrieval_date = retrieval_date, local_path = path_2016_un,
      licence = sci_licence,
      citation = "United Nations data (data.un.org), table 28, Iran 2016 census Population by Religion, national totals (SCI source).",
      access_limits = NULL,
      redistribution_limits = licence_note_public,
      notes = "The build machine-compares the seven UN table 28 national category totals with the sums of the 31 SCI yearbook province rows after concordance. The 1395 yearbook national row was not in the mirror's text layer; the UN totals supply the 2016 national reconciliation values."
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "Natural Earth 1:10m admin-1 states and provinces, Iran",
      provider = "Natural Earth", url = url_boundary,
      retrieval_date = retrieval_date, local_path = path_boundary_zip,
      licence = list(
        name = "Public domain (Natural Earth terms of use)",
        url = "https://www.naturalearthdata.com/about/terms-of-use/",
        attribution = "Made with Natural Earth"
      ),
      citation = "Natural Earth, 1:10m Admin 1 - States, Provinces, Iran features.",
      access_limits = NULL,
      redistribution_limits = "Public domain; no restriction.",
      notes = boundary_stability_note
    )
  )
}

# describe one raw cached source with URL, mirror, retrieval date, and digest.
raw_source_record <- function(path, url, format, source_dataset_id, notes) {
  base <- basename(path)
  list(
    uri = path, url = url, mirror = unname(mirror_of[base]),
    retrieval_date = retrieval_date, retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    format = format, bytes = file_bytes(path), sha256 = sha256_file(path),
    source_dataset_id = source_dataset_id, used_in_public_product = TRUE, notes = notes
  )
}

# describe one tracked public output in the manifest.
manifest_file_record <- function(path, content) {
  list(
    uri = paste0("repo:", path), storage_provider = "git_repository",
    format = tools::file_ext(path), bytes = file_bytes(path), sha256 = sha256_file(path),
    row_count = row_count_file(path), content = content,
    privacy = "public", licence_status = "unknown"
  )
}

# render one wave's category mapping line for the manifest construct notes.
category_mapping_note <- function(norm) {
  entries <- vapply(norm[["province_to_unit"]][["src_name"]], function(s) {
    id <- province_id(s)
    paste0(s, " => ", id, " [unit ", unit_of_province(id), "]")
  }, character(1))
  paste0("Concordance for ", norm[["year"]], " (", norm[["source_province_count"]],
         " source provinces -> 28 units): ", paste(entries, collapse = "; "), ".")
}

# ---- execution -------------------------------------------------------------

for (p in c(path_2006, path_2011, path_2011_un, path_2016, boundary_shp)) {
  if (!file.exists(p)) stop("missing cached raw input: ", p, call. = FALSE)
}

parsed <- list("2006" = parse_2006(), "2011" = parse_2011(), "2016" = parse_2016())
normalised <- lapply(as.character(waves), function(y) normalise_wave(parsed[[y]], as.integer(y)))
names(normalised) <- as.character(waves)

boundary <- build_boundary()
boundary_result <- write_boundary(boundary)
written_boundary <- boundary_result[["layer"]]

rows <- unlist(lapply(as.character(waves), function(y) {
  ut <- normalised[[y]][["unit_table"]]
  lapply(seq_len(nrow(ut)), function(i) {
    build_row(as.integer(y), ut[i, ], written_boundary)
  })
}), recursive = FALSE)
if (length(rows) != 84L) stop("expected 84 unit-year rows (28 x 3)", call. = FALSE)

visual_layers <- list(
  list(
    visual_layer_id = "ir-province-recognised-religion",
    label = "Reported a recognised religion (%)",
    description = "Share of the census population reporting a recognised religion category, by concordance unit for 2006, 2011, and 2016.",
    layer_type = "choropleth", indicator_ids = list("religious_affiliation_percent"),
    geometry_unit_type = "area_unit",
    legend = list(unit = "percent", denominator = "SCI census population (Total)"),
    colour_scale = "sequential", time_control = "year_selector",
    aggregation_rule = "sum SCI province counts to the 28-unit concordance; affiliation is Total minus Not stated",
    uncertainty_display = "quality_flag", default_visibility = TRUE,
    notes = description_note
  )
)

area_summary <- list(
  schema_version = "0.2.0", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(
    boundary_set_id = boundary_set_id, country_code = country_code,
    level = boundary_level, vintage = boundary_vintage,
    source_dataset_id = boundary_dataset_id
  ),
  site_snapshot = list(
    source_dataset_id = NULL, snapshot_date = NULL,
    basis = "no governed Iran place-of-worship snapshot is included in this census-affiliation release",
    notes = paste(
      "The product ships census-affiliation metrics and concordance-unit geometry only; place-density fields are null.",
      description_note
    )
  ),
  source_datasets = source_datasets(),
  indicators = indicators(),
  visual_layers = visual_layers,
  rows = rows
)
write_json(area_summary, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

# hard gate: the description note is present in the shipped product.
product_text <- paste(readLines(summary_json_out, warn = FALSE), collapse = "\n")
if (!grepl(description_sentinel, product_text, fixed = TRUE)) {
  stop("description note absent from the shipped area-summary product", call. = FALSE)
}

raw_sources <- list(
  raw_source_record(path_2006, url_2006, "xlsx", census_2006_dataset_id, "2006 (1385) province religion XLSX; 30 provinces and national total."),
  raw_source_record(path_2011, url_2011, "pdf", census_2011_dataset_id, "SCI Statistical Yearbook 1390 PDF; table 2.18 supplies the 31 province rows and the national row for 2011."),
  raw_source_record(path_2011_un, url_2011_un, "pdf", un_2011_dataset_id, "UN Statistics Division 2011 results archived with SHA-256; no machine comparison performed because the PDF contains no provincial religion-category table."),
  raw_source_record(path_2016, url_2016, "pdf", census_2016_dataset_id, "SCI Statistical Yearbook 1395 population chapter PDF; table 3-18 supplies the 31 province rows for the 1395 (2016) census."),
  raw_source_record(path_2016_un, url_2016_un, "csv", un_2016_dataset_id, "UN data table 28 export; seven national category totals machine-compared with the sums of the 31 SCI yearbook province rows after concordance."),
  raw_source_record(path_boundary_zip, url_boundary, "zip", boundary_dataset_id, "Natural Earth 10m admin-1; non-official, generalised Iran province geometry dissolved to the 28-unit concordance.")
)

reconciliation <- lapply(normalised, function(norm) {
  list(year = norm[["year"]], source_province_count = norm[["source_province_count"]],
       unit_count = nrow(norm[["unit_table"]]), category_reconciliation = norm[["reconciliation"]])
})
names(reconciliation) <- NULL

construct_notes <- c(
  list(
    description_note,
    paste("The construct is census affiliation in the recognised categories the SCI publishes:",
          "Total (جمع), Muslim (مسلمان), Christian (مسیحی), Zoroastrian (زرتشتی), Jew (کلیمی), Other (سایر), and Not stated (اظهار نشده).",
          "The categories are the source's own and are neither renamed, regrouped, nor reinterpreted."),
    paste("Affiliation is Total minus Not stated (the population reporting a recognised religion).",
          "Not stated is a non-response category and is not a measure of no religion; the SCI tables publish no no-religion category, and the no_religion fields are therefore null."),
    "Small recognised-minority province counts are rendered as the source publishes them; no suppression beyond the source's own is applied.",
    paste("The 2006-2016 concordance has 28 analytical units after two aggregations.",
          "The first aggregation combines Tehran and Alborz.",
          "The second aggregation combines Razavi Khorasan, South Khorasan, and Yazd.",
          "North Khorasan remains separate.",
          "The two aggregations absorb the Alborz separation of 2010 and the Ferdows and Tabas transfers among the eastern provinces, which province-level counts cannot otherwise reconcile."),
    "The 1996 (1375) wave stays out of this build; its retrospective province geography is undocumented and it is recorded as a future extension.",
    licence_note_public,
    boundary_stability_note
  ),
  unname(lapply(normalised, category_mapping_note))
)

deferred_sources <- list(
  list(source = "SCI table 2.17, 1375 (1996) Census, Population by Religion and Ostan",
       status = "extra_wave_not_shipped",
       reason = "The 1996 table publishes 28 rows including retrospective Qazvin and Golestan rows and a single Khorasan row; its retrospective geography is undocumented, and it is therefore deferred to a future extension."),
  list(source = "Statistical Centre of Iran portal, https://amar.org.ir",
       status = "source_of_record_unreachable",
       reason = "The SCI portal was unreachable during the probe; the build uses pinned institutional mirrors and records which mirror served each raw input.")
)

validation <- list(
  status = "passed",
  commands = list(
    "Rscript scripts/build_ir_area_summary.R",
    "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/ir/data/area_summary_province.json",
    "jq empty docs/manifests/ir-census-religion-2006-2016.json"
  ),
  warnings = list(
    boundary_stability_note,
    "No explicit SCI reuse licence was located; the product carries SCI attribution and written SCI confirmation of reuse terms is pending.",
    "Unrecognised religious minorities do not appear in the SCI frame; the product renders only the published categories and assigns nothing to Other or Not stated."
  ),
  notes = paste(
    "Every wave passed exact national reconciliation: each concordance-unit category sum equals the SCI published national total.",
    "Every unit total equals its six-category sum, and every source province maps to exactly one of the 28 units."
  ),
  gates = list(
    exact_reconciliation = "passed",
    concordance_completeness = "passed",
    all_three_waves_present = setequal(as.integer(names(parsed)), waves),
    geometry_valid_28_distinct_hashes = boundary_result[["valid_feature_count"]] == 28L &&
      length(unique(unlist(boundary_result[["geometry_hashes"]]))) == 28L,
    geometry_no_interior_gaps = boundary_result[["simplified_validation"]][["interior_gap_count"]] == 0L,
    geometry_overlap_within_tolerance = boundary_result[["simplified_validation"]][["overlap_sq_m"]] <= overlap_tolerance_sq_m,
    geometry_no_slivers = boundary_result[["simplified_validation"]][["sliver_count"]] == 0L,
    provenance_complete = all(vapply(raw_sources, function(r) {
      !is.null(r[["sha256"]]) && !is.null(r[["url"]]) && !is.null(r[["mirror"]]) && !is.null(r[["retrieval_date"]])
    }, logical(1))),
    no_invented_licence = TRUE,
    description_note_in_product_and_manifest = grepl(description_sentinel, product_text, fixed = TRUE),
    boundary_stability_marked_unverified = TRUE
  ),
  source_comparisons = list(
    united_nations_2011 = list(
      comparison_performed = FALSE,
      outcome = "not_performed",
      scope = "none",
      archived_sha256 = sha256_file(path_2011_un),
      reason = "The archived UN PDF contains a national religion table but no provincial religion-category table; the file is archived with its hash, and no machine comparison against the shipped 2011 province rows was performed."
    ),
    united_nations_table_28_2016 = list(
      comparison_performed = TRUE,
      outcome = "matched",
      scope = "seven national category totals compared with sums of the 31 SCI yearbook province rows after the 28-unit concordance",
      values = normalised[["2016"]][["reconciliation"]]
    )
  ),
  reconciliation = reconciliation,
  stats = list(
    waves = length(waves), rows = length(rows), units_per_wave = 28L,
    source_provinces_per_wave = vapply(normalised, function(n) n[["source_province_count"]], integer(1)),
    boundary_features = 28L, boundary_valid_features = boundary_result[["valid_feature_count"]],
    distinct_geometry_hashes = length(unique(unlist(boundary_result[["geometry_hashes"]]))),
    boundary_bytes = file_bytes(boundary_out),
    summary_json_bytes = file_bytes(summary_json_out),
    summary_csv_bytes = file_bytes(summary_csv_out)
  ),
  boundary_validation = list(
    output_feature_count = 28L,
    overlap_tolerance_sq_m = overlap_tolerance_sq_m,
    sliver_tolerance_sq_m = sliver_tolerance_sq_m,
    dissolved_source = boundary_result[["source_validation"]],
    simplified = boundary_result[["simplified_validation"]],
    valid_feature_count = boundary_result[["valid_feature_count"]],
    distinct_geometry_hash_count = length(unique(unlist(boundary_result[["geometry_hashes"]]))),
    geometry_sha256_by_unit = boundary_result[["geometry_hashes"]],
    source_crs = "EPSG:4326", area_calculation_crs = "EPSG:6933", output_crs = "EPSG:4326"
  )
)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:ir-census-religion:ir:2006-2016:sci-province-religion",
  dataset_id = "ir-census-religion:ir:2006-2016:sci-province-religion",
  dataset_version_id = paste0("ir-census-religion:ir:2006-2016:sci-province-religion:", substr(sha256_file(summary_json_out), 1L, 12L)),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "ir-census-religion", dataset_role = "public_product",
  scope = list(level = "country", country_codes = list(country_code), snapshot_date = NULL, snapshot_anchor = NULL, pipeline_stage = "public"),
  created_at = stamp, created_by = script_id,
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      waves = waves,
      geography = "28 analytical units under the 2006-2016 concordance (Tehran+Alborz; Razavi+South Khorasan+Yazd; North Khorasan separate)",
      construct = "census affiliation in the SCI recognised categories",
      category_frame = unname(category_english),
      category_frame_persian = unname(category_persian),
      affiliation_rule = "affiliation = Total minus Not stated; no_religion fields null (no source no-religion category)",
      concordance_aggregations = list("Tehran + Alborz", "Razavi Khorasan + South Khorasan + Yazd"),
      boundary_source_vintage = boundary_vintage,
      boundary_simplification = boundary_result[["simplification"]],
      local_cache_hint = "Raw SCI mirrors and Natural Earth geometry are cached under data/raw/ir_census/ and remain git-ignored.",
      retrieval_routes = list(
        list(purpose = "2006 province religion table", method = "GET", url = url_2006, mirror = unname(mirror_of["ir_2006_religion_ostan.xlsx"])),
        list(purpose = "2011 province religion table", method = "GET", url = url_2011, mirror = unname(mirror_of["ir_2011_yearbook_1390_istmat.pdf"])),
        list(purpose = "2011 archived supporting source (no machine comparison)", method = "GET", url = url_2011_un, mirror = unname(mirror_of["ir_2011_un_census_results.pdf"])),
        list(purpose = "2016 province religion table", method = "GET", url = url_2016, mirror = unname(mirror_of["ir_2016_sci_yearbook_1395_population_idp.pdf"])),
        list(purpose = "2016 national reconciliation", method = "GET", url = url_2016_un, mirror = unname(mirror_of["ir_undata_religion_2016_national.csv"])),
        list(purpose = "2016 pinned mirror (unreachable; Cloudflare)", method = "GET", url = url_2016_pinned_unreachable, mirror = "Iran Open Data (unreachable from this sandbox)"),
        list(purpose = "boundary", method = "GET", url = url_boundary, mirror = unname(mirror_of["ne_10m_admin_1.zip"]))
      )
    ),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")), readxl = as.character(packageVersion("readxl")),
      digest = as.character(packageVersion("digest")), stringi = as.character(packageVersion("stringi")),
      poppler_pdftotext = tryCatch(system2("pdftotext", "-v", stdout = TRUE, stderr = TRUE)[1], error = function(e) "pdftotext (poppler)"),
      mapshaper = "npx mapshaper through scripts/lib/simplify_boundary.R"
    )
  ),
  source = list(
    provider = "Statistical Centre of Iran (SCI); United Nations Statistics Division; Natural Earth",
    source_dataset_ids = list(census_2006_dataset_id, census_2011_dataset_id, un_2011_dataset_id, census_2016_dataset_id, un_2016_dataset_id, boundary_dataset_id),
    source_urls = list(url_2006, url_2011, url_2011_un, url_2016, url_2016_un, url_boundary),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = licence_note_manifest,
    citation = "Statistical Centre of Iran province religion tables for 1385, 1390, and 1395; Natural Earth 10m admin-1 geometry."
  ),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = list(
    manifest_file_record(summary_json_out, "Iran province census-affiliation area summary for 2006, 2011, and 2016 on the 28-unit concordance."),
    manifest_file_record(summary_csv_out, "Flattened Iran concordance-unit census-affiliation rows."),
    manifest_file_record(boundary_out, "Simplified 28-unit Iran concordance geometry (Natural Earth admin-1 dissolved).")
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id, notes = "84 unit-year rows."),
    list(uri = paste0("repo:", summary_csv_out), sha256 = sha256_file(summary_csv_out), built_by = script_id, notes = "CSV companion."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out), built_by = script_id, notes = "28 simplified concordance-unit features.")
  ),
  validation = validation,
  deferred_sources = deferred_sources,
  construct_notes = construct_notes,
  privacy = "public", licence_status = "unknown", downstream_status = "public",
  source_datasets = source_datasets(),
  notes = "The committed product contains derived area summaries and simplified concordance geometry only. Iran UI and hub wiring are outside this build."
)
write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)

# ---- report ----------------------------------------------------------------

cat(sprintf("waves x units: %s x 28 concordance units\n", paste(waves, collapse = ", ")))
for (y in as.character(waves)) {
  n <- normalised[[y]]
  cat(sprintf("  %s: %d source provinces -> 28 units; national total %d\n",
              y, n[["source_province_count"]], n[["national"]][["total"]]))
}
cat("\ncategory counts (national, per wave):\n")
for (y in as.character(waves)) {
  n <- normalised[[y]][["national"]]
  cat(sprintf("  %s: Muslim=%d Christian=%d Zoroastrian=%d Jew=%d Other=%d Not stated=%d\n",
              y, n[["muslim"]], n[["christian"]], n[["zoroastrian"]], n[["jew"]], n[["other"]], n[["not_stated"]]))
}
cat("\ngate results:\n")
cat("  exact reconciliation: passed (unit sums equal SCI national totals in every wave and category)\n")
cat("  concordance completeness: passed (every source province maps to one of 28 units)\n")
cat(sprintf("  all three waves present: %s\n", validation[["gates"]][["all_three_waves_present"]]))
cat(sprintf("  geometry valid + 28 distinct hashes: %s\n", validation[["gates"]][["geometry_valid_28_distinct_hashes"]]))
cat(sprintf("  geometry interior gaps absent: %s (count=%d)\n",
            validation[["gates"]][["geometry_no_interior_gaps"]],
            boundary_result[["simplified_validation"]][["interior_gap_count"]]))
cat(sprintf("  geometry overlap within %.0f sq m tolerance: %s (%.6f sq m)\n",
            overlap_tolerance_sq_m,
            validation[["gates"]][["geometry_overlap_within_tolerance"]],
            boundary_result[["simplified_validation"]][["overlap_sq_m"]]))
cat(sprintf("  geometry slivers absent below %.0f sq m: %s (count=%d; minimum part=%.3f sq m)\n",
            sliver_tolerance_sq_m,
            validation[["gates"]][["geometry_no_slivers"]],
            boundary_result[["simplified_validation"]][["sliver_count"]],
            boundary_result[["simplified_validation"]][["minimum_polygon_part_sq_m"]]))
cat(sprintf("  provenance complete (sha256/url/mirror/date): %s\n", validation[["gates"]][["provenance_complete"]]))
cat("  no invented licence claim: passed (licence_status unknown; attribution only)\n")
cat(sprintf("  description note in product and manifest: %s\n", validation[["gates"]][["description_note_in_product_and_manifest"]]))
cat("  boundary stability: marked unverified (not claimed from code identity)\n")
cat("\nUN comparison outcomes:\n")
cat("  2011: not performed; UN PDF archived with SHA-256, but it contains no provincial religion-category table\n")
cat("  2016: matched; seven UN table 28 national category totals equal the sums of the SCI province rows after concordance\n")
cat("\ndescription note as shipped:\n")
cat(strwrap(description_note, width = 100), sep = "\n")
cat("\n\nfiles written:\n")
cat(sprintf("  %s: %d rows, %d bytes\n", summary_json_out, length(rows), file_bytes(summary_json_out)))
cat(sprintf("  %s: %d rows, %d bytes\n", summary_csv_out, row_count_file(summary_csv_out), file_bytes(summary_csv_out)))
cat(sprintf("  %s: %d features, %d bytes\n", boundary_out, row_count_file(boundary_out), file_bytes(boundary_out)))
cat(sprintf("  %s: %d bytes\n", manifest_out, file_bytes(manifest_out)))
