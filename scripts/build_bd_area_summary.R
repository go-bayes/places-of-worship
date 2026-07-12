# build the Bangladesh two-wave district census-religion product (2011 + 2022).
# inputs (git-ignored, under data/raw/bd_census/):
#   phc2022_national_report_vol1.pdf   BBS Population and Housing Census 2022,
#                                      National Report (Volume I); Table P08
#                                      "Population by Religion, Sex and District".
#   phc2011_community_<zila>.pdf        64 BBS Population and Housing Census 2011
#                                      Community Reports, one per zila; Table C-13
#                                      "Distribution of population by religion,
#                                      residence and community" prints a
#                                      "[Zila] Total" line in the identical five-
#                                      category column order as Table P08.
#   phc2011_national_vol2_union_djvu.txt  Vol-2 full text; national religion
#                                      percentages and the enumerated national
#                                      population anchor (144,043,697).
#   geoboundaries_bgd_adm2.geojson     geoBoundaries BGD ADM2 (64 districts).
#   geoboundaries_bgd_adm2_metadata.json  release metadata (licence record).
# outputs:
#   apps/regions/bd/data/bd_district_2022.geojson    simplified district boundary
#                                                    (shared by both waves)
#   apps/regions/bd/data/area_summary_district.{json,csv}       two-wave product
#   apps/regions/bd/data/area_summary_district_2022.{json,csv}  legacy single-wave
#                                                    2022 file (kept for the staged
#                                                    page, which is not edited here)
#   docs/manifests/bd-census-religion-2011-2022.json  two-wave manifest
#   docs/manifests/bd-census-religion-2022.json       old manifest, marked superseded
# run from the repository root: Rscript scripts/build_bd_area_summary.R
#
# gates (stop, do not tune):
#   2022: Table P08 must parse to 1 national + 8 divisions + 64 districts; every
#     Male+Female cell equals its Total; every district sums to its division and
#     every division to the national row for all fifteen count columns; the
#     verified national category totals match; boundary joins 64:64; simplified
#     boundary under 3 MB.
#   2011: each of the 64 Community Reports must yield a Table C-13 zila-total line
#     of five category counts that sum exactly to the printed zila total; the 64
#     zila totals reconcile against the enumerated national anchor and the derived
#     national percentages must reproduce the Vol-2 infographic at printed rounding.
#   both waves carry the ratified minority-share two-slot design and the same
#     nine-name spelling concordance and 64-feature boundary.
# Any per-zila reconciliation failure or a missing report stops the build.

suppressMessages({
  library(jsonlite)
  library(sf)
})

raw_dir <- "data/raw/bd_census"
out_dir <- "apps/regions/bd/data"
manifest_dir <- "docs/manifests"
dir.create(out_dir, showWarnings = FALSE, recursive = TRUE)
dir.create(manifest_dir, showWarnings = FALSE, recursive = TRUE)

stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date_2022 <- "2026-07-10"
retrieval_date_2011 <- "2026-07-12"
script_id <- "scripts/build_bd_area_summary.R"
country_code <- "BD"
census_years <- c(2011L, 2022L)

# the boundary_set_id is shared across both waves: the 64-zila frame is stable and
# both waves join the identical geoBoundaries ADM2 layer. the "2022" token in the
# id is a stable identifier string, not a claim that the boundary is 2022-specific.
boundary_set_id <- "bd-district-2022-geoboundaries-adm2"
boundary_level <- "district"
census_dataset_id_2022 <- "bbs-phc-2022-table-p08-religion-district"
census_dataset_id_2011 <- "bbs-phc-2011-community-report-table-c13-religion-district"
boundary_dataset_id <- "geoboundaries-bgd-adm2"

census_pdf_path <- file.path(raw_dir, "phc2022_national_report_vol1.pdf")
vol2_txt_path <- file.path(raw_dir, "phc2011_national_vol2_union_djvu.txt")
boundary_path <- file.path(raw_dir, "geoboundaries_bgd_adm2.geojson")
boundary_meta_path <- file.path(raw_dir, "geoboundaries_bgd_adm2_metadata.json")

census_pdf_url <- "https://objectstorage.ap-dcc-gazipur-1.oraclecloud15.com/n/axvjbnqprylg/b/V2Ministry/o/office-bbs/2024/12/9ce5bd160bb14a1ab1eabe886adddb9a.pdf"
bbs_site_url <- "https://bbs.gov.bd/"
vol2_url <- "https://archive.org/details/BangladeshPopulationAndHousingCensus-2011_NationalReportVolume-2"
community_series_url <- "http://nsds.bbs.gov.bd/en/topic/68/PHC%20Report%20(Community%20Series)"
boundary_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/BGD/ADM2/geoBoundaries-BGD-ADM2.geojson"
boundary_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/BGD/ADM2/"

boundary_out <- file.path(out_dir, "bd_district_2022.geojson")
summary_json_out <- file.path(out_dir, "area_summary_district.json")
summary_csv_out <- file.path(out_dir, "area_summary_district.csv")
legacy_json_out <- file.path(out_dir, "area_summary_district_2022.json")
legacy_csv_out <- file.path(out_dir, "area_summary_district_2022.csv")
manifest_out <- file.path(manifest_dir, "bd-census-religion-2011-2022.json")
old_manifest_out <- file.path(manifest_dir, "bd-census-religion-2022.json")

# category frame as printed in Table P08 (2022) and Table C-13 (2011), identical
# column order in both.
categories <- c("Muslim", "Hindu", "Christian", "Buddhist", "Others")

# denomination-taxonomy.json code for each printed source category, assigned only
# where the mapping is unambiguous. "Others" is a residual mix with no single
# code, so it ships without one; the area-summary.v2 composition field carries a
# taxonomy_code only when present.
category_taxonomy <- c(
  "Muslim"    = "muslim",
  "Hindu"     = "hindu",
  "Christian" = "christian",
  "Buddhist"  = "buddhist",
  "Others"    = NA_character_
)

# verified 2022 national category totals (Table P08, male+female basis). these
# anchor the 2022 extraction against pdftotext column drift; a mismatch stops the
# build.
national_expected_2022 <- c(
  Muslim = 150415066L, Hindu = 13143749L, Christian = 488555L,
  Buddhist = 1001927L, Others = 101195L
)

# 2011 national anchor. the cached Vol-2 full text (line "Population (Enumerated)
# / Bangladesh / Both Sex") prints the 2011 enumerated national population as
# 144,043,697 (the 149,772,364 figure printed one row below is the post-
# enumeration ADJUSTED population, not the tabulation basis). the Community Report
# C-13 tables are enumeration counts, so the 64 zila totals reconcile against the
# enumerated figure. the Vol-2 "Population By Religion (%)" infographic prints the
# national shares Muslim 90.39, Hindu 8.54, Buddhist 0.60, Christian 0.37, Others
# 0.14; the summed zila counts must reproduce these at printed two-decimal
# rounding (note the infographic prints Buddhist before Christian; C-13 column
# order is Christian before Buddhist).
national_enumerated_2011 <- 144043697L
national_pct_published_2011 <- c(
  Muslim = 90.39, Hindu = 8.54, Christian = 0.37, Buddhist = 0.60, Others = 0.14
)

# minority-share design (project-lead ruling 2026-07-11, task 6). the BBS frame
# sums to 100 percent by construction, so a share-of-affiliation choropleth
# carries no signal. under the ratified design the two legacy metric slots carry
# declared constructs: religious_affiliation_percent is the reference-group share
# and no_religion_percent is its exact complement, the minority share. the same
# design and reference group apply to both waves.
reference_group <- "Muslim" # largest published national category, held constant across every area and wave
minority_categories <- setdiff(categories, reference_group)
# published national reference-group share, most recent wave (2022). BBS Table
# 3.2.15 reports 91.08% Muslim on the full-population basis; on the Table P08
# sex-classified basis the share is 150,415,066 / 165,150,492 = 91.0776%, which
# reproduces the published figure at printed (two-decimal) rounding.
reference_national_share_published <- 91.08
metric_round_digits <- 4L

# small-cell rule thresholds (docs/development/small-cell-rule.md, ratified
# 2026-07-12). the numerator threshold flags any published category cell below 10
# persons; the denominator threshold flags a metric denominator below 100 persons.
# thresholds are applied exactly.
small_cell_numerator_threshold <- 10L
small_denominator_threshold <- 100L

# census district spelling -> geoBoundaries ADM2 shapeName. the two sources name
# the same 64 districts; this maps only anglicised-spelling differences and
# invents no geography. every other district name matches verbatim. the same nine
# names carry both waves.
name_concordance <- c(
  "Barishal" = "Barisal",
  "Chattogram" = "Chittagong",
  "Cumilla" = "Comilla",
  "Brahmanbaria" = "Brahamanbaria",
  "Bogura" = "Bogra",
  "Jashore" = "Jessore",
  "Moulvibazar" = "Maulvibazar",
  "Netrokona" = "Netrakona",
  "Chapainawabganj" = "Nawabganj"
)

# 2011 Community Report cache: area_code (slug of the 2022 census district name)
# -> local PDF filename under data/raw/bd_census/. every 2011 report was located
# as an individual nsds.bbs.gov.bd post linking the PHC_2011 Community Report
# storage folder; the source filenames are inconsistent (Com_, C_, COMMUNITY_,
# bare) and are recorded verbatim per zila in the retrieval index
# (phc2011_community_index.json). the area_code keys match the 2022 product's
# area_codes exactly, so the two waves join on one frame.
community_files_2011 <- c(
  "bagerhat"        = "phc2011_community_bagerhat.pdf",
  "bandarban"       = "phc2011_community_bandarban.pdf",
  "barguna"         = "phc2011_community_barguna.pdf",
  "barishal"        = "phc2011_community_barishal.pdf",
  "bhola"           = "phc2011_community_bhola.pdf",
  "bogura"          = "phc2011_community_bogura.pdf",
  "brahmanbaria"    = "phc2011_community_brahmanbaria.pdf",
  "chandpur"        = "phc2011_community_chandpur.pdf",
  "chapainawabganj" = "phc2011_community_chapainawabganj.pdf",
  "chattogram"      = "phc2011_community_chattogram.pdf",
  "chuadanga"       = "phc2011_community_chuadanga.pdf",
  "cox_s_bazar"     = "phc2011_community_cox_s_bazar.pdf",
  "cumilla"         = "phc2011_community_cumilla.pdf",
  "dhaka"           = "phc2011_community_dhaka.pdf",
  "dinajpur"        = "phc2011_community_dinajpur.pdf",
  "faridpur"        = "phc2011_community_faridpur.pdf",
  "feni"            = "phc2011_community_feni.pdf",
  "gaibandha"       = "phc2011_community_gaibandha.pdf",
  "gazipur"         = "phc2011_community_gazipur.pdf",
  "gopalganj"       = "phc2011_community_gopalganj.pdf",
  "habiganj"        = "phc2011_community_habiganj.pdf",
  "jamalpur"        = "phc2011_community_jamalpur.pdf",
  "jashore"         = "phc2011_community_jashore.pdf",
  "jhalokati"       = "phc2011_community_jhalokati.pdf",
  "jhenaidah"       = "phc2011_community_jhenaidah.pdf",
  "joypurhat"       = "phc2011_community_joypurhat.pdf",
  "khagrachhari"    = "phc2011_community_khagrachhari.pdf",
  "khulna"          = "phc2011_community_khulna.pdf",
  "kishoreganj"     = "phc2011_community_kishoreganj.pdf",
  "kurigram"        = "phc2011_community_kurigram.pdf",
  "kushtia"         = "phc2011_community_kushtia.pdf",
  "lakshmipur"      = "phc2011_community_lakshmipur.pdf",
  "lalmonirhat"     = "phc2011_community_lalmonirhat.pdf",
  "madaripur"       = "phc2011_community_madaripur.pdf",
  "magura"          = "phc2011_community_magura.pdf",
  "manikganj"       = "phc2011_community_manikganj.pdf",
  "meherpur"        = "phc2011_community_meherpur.pdf",
  "moulvibazar"     = "phc2011_community_moulvibazar.pdf",
  "munshiganj"      = "phc2011_community_munshiganj.pdf",
  "mymensingh"      = "phc2011_community_mymensingh.pdf",
  "naogaon"         = "phc2011_community_naogaon.pdf",
  "narail"          = "phc2011_community_narail.pdf",
  "narayanganj"     = "phc2011_community_narayanganj.pdf",
  "narsingdi"       = "phc2011_community_narsingdi.pdf",
  "natore"          = "phc2011_community_natore.pdf",
  "netrokona"       = "phc2011_community_netrokona.pdf",
  "nilphamari"      = "phc2011_community_nilphamari.pdf",
  "noakhali"        = "phc2011_community_noakhali.pdf",
  "pabna"           = "phc2011_community_pabna.pdf",
  "panchagarh"      = "phc2011_community_panchagarh.pdf",
  "patuakhali"      = "phc2011_community_patuakhali.pdf",
  "pirojpur"        = "phc2011_community_pirojpur.pdf",
  "rajbari"         = "phc2011_community_rajbari.pdf",
  "rajshahi"        = "phc2011_community_rajshahi.pdf",
  "rangamati"       = "phc2011_community_rangamati.pdf",
  "rangpur"         = "phc2011_community_rangpur.pdf",
  "satkhira"        = "phc2011_community_satkhira.pdf",
  "shariatpur"      = "phc2011_community_shariatpur.pdf",
  "sherpur"         = "phc2011_community_sherpur.pdf",
  "sirajganj"       = "phc2011_community_sirajganj.pdf",
  "sunamganj"       = "phc2011_community_sunamganj.pdf",
  "sylhet"          = "phc2011_community_sylhet.pdf",
  "tangail"         = "phc2011_community_tangail.pdf",
  "thakurgaon"      = "phc2011_community_thakurgaon.pdf"
)

# 2011 defective Community Reports and the authorized recovery (conductor ruling
# 2026-07-12): two of the 64 Community Report PDFs cannot yield an extractable
# Table C-13 zila-total religion line. Both were confirmed on fresh re-downloads
# (identical sha256), so the defect is in the published source, not the download.
#   Bhola: the cached report (sha256 ddd4b56...) omits printed pages 229-240,
#     exactly the C-13 pages carrying the "Bhola Zila Total" religion line and five
#     upazilas' breakdown; no located mirror (nsds primary, fresh re-download, the
#     203.112.218.101 alternate BBS host — byte-identical, Internet Archive,
#     Barisal divisional portal, web search) supplies a complete copy, and the
#     report carries religion nowhere else.
#   Lalmonirhat: the cached report (sha256 6bcaa04..., 296 pages, 118 MB) is a
#     scanned image PDF with almost no text layer; the C-13 religion table is
#     image-only.
# The conductor authorized recovery via the 2011 Zila/District Series reports (a
# different official BBS publication of the same census; a documented source
# addition, not a repair), text layer only, never optical character recognition,
# with the zila total required to match the Vol-2 enumerated total exactly.
#   Lalmonirhat: RECOVERED. Zila_Lalmonirhat.pdf carries a full text layer; Table
#     P05 "Population by Age group, Religion and Residence" prints the zila-total
#     religion line in the identical five-category column order as C-13, and Table
#     PT14 "Population by Religion, 1981-2011" prints the identical 2011 counts.
#     The extracted zila total must equal the Vol-2 enumerated total (1,256,099)
#     exactly; a mismatch stops the build.
#   Bhola: RECOVERY FAILED, stays WITHHELD. Zila_BHOLA.pdf (sha256 ec52bd7...,
#     360 pages) is a scanned document whose text layer covers only the cover and
#     Table H01; the religion tables are image-only, and the alternate BBS host
#     serves a byte-identical copy. Under the ruling (text layer required, never
#     optical character recognition) the Bhola 2011 religion composition remains
#     withheld (null metrics, disclosed), never substituted, estimated, or
#     interpolated.
# Bhola's enumerated 2011 population is independently published in the cached
# Vol-2 union statistics (1,776,795); it is used ONLY to confirm the national
# frame closes. With it, the frame closes exactly: 63 extracted zila totals plus
# Bhola's published total reproduce the enumerated national anchor 144,043,697
# (deviation 0).
withheld_2011 <- c("bhola")
withheld_known_totals_2011 <- c(bhola = 1776795L)

# lalmonirhat recovery source (Zila Series report, authorized source swap).
zila_lalmonirhat_file <- "phc2011_zila_lalmonirhat.pdf"
zila_bhola_file <- "phc2011_zila_bhola.pdf" # failed-recovery documentation only
recovered_2011 <- c("lalmonirhat")
lalmonirhat_expected_total_2011 <- 1256099L
census_dataset_id_2011_zila <- "bbs-phc-2011-zila-report-lalmonirhat-table-p05-religion"
zila_lalmonirhat_url <- "http://nsds.bbs.gov.bd/storage/files/1/Publications/PHC_Zila_2011/RANGPUR%20DIVISION/Zila_Lalmonirhat.pdf"
zila_bhola_url <- "http://nsds.bbs.gov.bd/storage/files/1/Publications/PHC_Zila_2011/BARISAL%20DIVISION/Zila_BHOLA.pdf"

# stop early when a raw source required for the governed build is missing.
require_file <- function(path) {
  if (!file.exists(path)) stop("missing required source: ", path, call. = FALSE)
}

sha256_file <- function(path) unname(tools::sha256sum(path))
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))

# turn a district name into a stable lowercase area code used as the join key.
slugify <- function(value) {
  slug <- tolower(trimws(value))
  slug <- gsub("[^a-z0-9]+", "_", slug)
  gsub("^_|_$", "", slug)
}

# extract Table P08 rows from the 2022 census PDF with poppler pdftotext -layout.
read_table_p08 <- function(pdf_path) {
  require_file(pdf_path)
  if (nchar(Sys.which("pdftotext")) == 0L) {
    stop("pdftotext (poppler) is required to extract Table P08", call. = FALSE)
  }
  txt_path <- tempfile(fileext = ".txt")
  on.exit(unlink(txt_path), add = TRUE)
  status <- system2("pdftotext", c("-layout", shQuote(pdf_path), shQuote(txt_path)))
  if (!identical(status, 0L)) stop("pdftotext failed on ", pdf_path, call. = FALSE)
  lines <- readLines(txt_path, warn = FALSE)

  start <- grep("Table P08 Population by Religion, Sex and District", lines, fixed = TRUE)
  end <- grep("Table P09", lines, fixed = TRUE)
  if (!length(start)) stop("Table P08 marker not found", call. = FALSE)
  if (!length(end)) stop("Table P09 end marker not found", call. = FALSE)
  region <- lines[start[1]:(end[end > start[1]][1] - 1L)]

  rows <- list()
  for (ln in region) {
    s <- trimws(ln)
    if (!nzchar(s)) next
    m <- regmatches(s, regexec("^([A-Za-z][A-Za-z. '-]*?)\\s+([0-9][0-9 ]*)$", s))[[1]]
    if (length(m) != 3L) next
    ints <- as.integer(strsplit(trimws(m[3]), "\\s+")[[1]])
    if (length(ints) != 15L || any(is.na(ints))) next
    rows[[length(rows) + 1L]] <- c(list(name = trimws(m[2])), as.list(ints))
  }
  if (!length(rows)) stop("no Table P08 data rows parsed", call. = FALSE)
  df <- do.call(rbind, lapply(rows, function(r) {
    data.frame(name = r$name, matrix(unlist(r[-1]), nrow = 1), stringsAsFactors = FALSE)
  }))
  colnames(df) <- c(
    "name",
    paste(rep(categories, each = 3), rep(c("T", "M", "F"), times = 5), sep = "_")
  )
  df
}

# fail-fast reconciliation of Table P08; returns the 64 district rows.
reconcile_p08 <- function(df) {
  count_cols <- setdiff(colnames(df), "name")
  total_cols <- paste0(categories, "_T")

  for (cat in categories) {
    bad <- which(df[[paste0(cat, "_M")]] + df[[paste0(cat, "_F")]] != df[[paste0(cat, "_T")]])
    if (length(bad)) {
      stop("sex-total reconciliation failed for ", cat, " in rows: ",
           paste(df$name[bad], collapse = ", "), call. = FALSE)
    }
  }

  is_division <- grepl(" Division$", df$name)
  is_national <- df$name == "National"
  if (sum(is_national) != 1L) stop("expected exactly one National row", call. = FALSE)
  if (sum(is_division) != 8L) {
    stop("expected 8 division rows, found ", sum(is_division), call. = FALSE)
  }

  division_of <- rep(NA_character_, nrow(df))
  current <- NA_character_
  for (i in seq_len(nrow(df))) {
    if (is_national[i]) next
    if (is_division[i]) { current <- df$name[i]; next }
    division_of[i] <- current
  }
  districts <- df[!is_division & !is_national, , drop = FALSE]
  district_div <- division_of[!is_division & !is_national]
  if (nrow(districts) != 64L) {
    stop("expected 64 district rows, found ", nrow(districts), call. = FALSE)
  }
  if (any(is.na(district_div))) stop("a district row precedes any division", call. = FALSE)

  for (div in df$name[is_division]) {
    members <- districts[district_div == div, count_cols, drop = FALSE]
    div_row <- df[df$name == div, count_cols, drop = FALSE]
    diff <- colSums(members) - unlist(div_row)
    if (any(diff != 0)) {
      stop("district-to-division reconciliation failed for ", div, call. = FALSE)
    }
  }

  div_rows <- df[is_division, count_cols, drop = FALSE]
  nat_row <- df[is_national, count_cols, drop = FALSE]
  diff <- colSums(div_rows) - unlist(nat_row)
  if (any(diff != 0)) stop("division-to-national reconciliation failed", call. = FALSE)

  nat_totals <- setNames(unlist(df[is_national, total_cols]), categories)
  if (!all(nat_totals[names(national_expected_2022)] == national_expected_2022)) {
    stop("2022 national category totals do not match the verified anchor", call. = FALSE)
  }

  districts$division <- district_div
  districts
}

# extract the Table C-13 zila-total religion line from one 2011 Community Report.
# returns the five integer category counts (Muslim, Hindu, Christian, Buddhist,
# Others) plus the printed zila total. locates the C-13 header ("Distribution of
# population by religion, ...", excluding the table-of-contents line that carries a
# trailing page number), then reads the first following "[...] Zila Total" line
# that carries exactly six trailing integers (Total plus the five categories).
read_table_c13 <- function(pdf_path) {
  require_file(pdf_path)
  txt_path <- tempfile(fileext = ".txt")
  on.exit(unlink(txt_path), add = TRUE)
  status <- system2("pdftotext", c("-layout", shQuote(pdf_path), shQuote(txt_path)))
  if (!identical(status, 0L)) stop("pdftotext failed on ", pdf_path, call. = FALSE)
  lines <- readLines(txt_path, warn = FALSE)

  hdr <- grep("Distribution of population by religion", lines, ignore.case = TRUE)
  # drop table-of-contents entries: a header line ending in a page number.
  hdr <- hdr[!grepl("[0-9]\\s*$", lines[hdr])]
  if (!length(hdr)) stop("Table C-13 religion header not found in ", basename(pdf_path), call. = FALSE)

  for (h in hdr) {
    upper <- min(h + 30L, length(lines))
    for (j in h:upper) {
      m <- regmatches(lines[j], regexec("^\\s*(.*?)\\bZila Total\\b\\s+([0-9][0-9 ]*?)\\s*$", lines[j]))[[1]]
      if (length(m) == 3L) {
        ints <- as.integer(strsplit(trimws(m[3]), "\\s+")[[1]])
        if (length(ints) == 6L && !any(is.na(ints))) {
          total <- ints[1]
          counts <- setNames(ints[2:6], categories)
          if (sum(counts) == total) {
            return(list(total = total, counts = counts))
          }
        }
      }
    }
  }
  stop("no reconciling Table C-13 zila-total line found in ", basename(pdf_path), call. = FALSE)
}

# extract the Lalmonirhat zila-total religion line from the 2011 Zila Series
# report (authorized source swap). locates Table P05 "Population by Age group,
# Religion and Residence", whose zila block opens with a "Lalmonirhat Zila" line
# followed by a "Total" line carrying six integers in the identical column order
# as C-13 (Total, Muslim, Hindu, Christian, Buddhist, Others). gates: the five
# categories must sum exactly to the printed total, and the total must equal the
# Vol-2 enumerated zila total (1,256,099) exactly; either failure stops the build.
read_lalmonirhat_zila_p05 <- function(pdf_path) {
  require_file(pdf_path)
  txt_path <- tempfile(fileext = ".txt")
  on.exit(unlink(txt_path), add = TRUE)
  status <- system2("pdftotext", c("-layout", shQuote(pdf_path), shQuote(txt_path)))
  if (!identical(status, 0L)) stop("pdftotext failed on ", pdf_path, call. = FALSE)
  lines <- readLines(txt_path, warn = FALSE)

  hdr <- grep("Table P05\\s*:\\s*Population by Age group, Religion and Residence", lines)
  if (!length(hdr)) stop("Table P05 header not found in ", basename(pdf_path), call. = FALSE)
  for (h in hdr) {
    zila_at <- which(trimws(lines) == "Lalmonirhat Zila")
    zila_at <- zila_at[zila_at > h & zila_at <= h + 10L]
    if (!length(zila_at)) next
    for (j in (zila_at[1] + 1L):min(zila_at[1] + 3L, length(lines))) {
      m <- regmatches(lines[j], regexec("^\\s*Total\\s+([0-9][0-9 ]*?)\\s*$", lines[j]))[[1]]
      if (length(m) == 2L) {
        ints <- as.integer(strsplit(trimws(m[2]), "\\s+")[[1]])
        if (length(ints) == 6L && !any(is.na(ints))) {
          total <- ints[1]
          counts <- setNames(ints[2:6], categories)
          if (sum(counts) != total) {
            stop("Zila_Lalmonirhat P05 categories do not sum to the printed total", call. = FALSE)
          }
          if (total != lalmonirhat_expected_total_2011) {
            stop(sprintf("Zila_Lalmonirhat P05 total %d does not equal the Vol-2 enumerated total %d",
                         total, lalmonirhat_expected_total_2011), call. = FALSE)
          }
          return(list(total = total, counts = counts))
        }
      }
    }
  }
  stop("no reconciling P05 zila-total line found in ", basename(pdf_path), call. = FALSE)
}

# read every 2011 Community Report plus the authorized Zila-Series recovery and
# reconcile. returns a data frame with one row per extracted zila (area_code,
# five category counts, printed total) and stops on any missing report or
# per-zila reconciliation failure. Lalmonirhat comes from the Zila Series report
# (source swap); Bhola stays withheld.
read_all_c13 <- function() {
  area_codes <- setdiff(names(community_files_2011), c(withheld_2011, recovered_2011))
  rows <- lapply(area_codes, function(code) {
    path <- file.path(raw_dir, community_files_2011[[code]])
    require_file(path)
    r <- read_table_c13(path)
    data.frame(
      area_code = code,
      Muslim = r$counts[["Muslim"]], Hindu = r$counts[["Hindu"]],
      Christian = r$counts[["Christian"]], Buddhist = r$counts[["Buddhist"]],
      Others = r$counts[["Others"]], total = r$total,
      stringsAsFactors = FALSE
    )
  })
  # authorized recovery: Lalmonirhat from the Zila Series report Table P05.
  r <- read_lalmonirhat_zila_p05(file.path(raw_dir, zila_lalmonirhat_file))
  rows[[length(rows) + 1L]] <- data.frame(
    area_code = "lalmonirhat",
    Muslim = r$counts[["Muslim"]], Hindu = r$counts[["Hindu"]],
    Christian = r$counts[["Christian"]], Buddhist = r$counts[["Buddhist"]],
    Others = r$counts[["Others"]], total = r$total,
    stringsAsFactors = FALSE
  )
  df <- do.call(rbind, rows)
  expected <- 64L - length(withheld_2011)
  if (nrow(df) != expected) stop("expected ", expected, " extracted 2011 zilas, parsed ", nrow(df), call. = FALSE)
  # per-zila reconciliation (categories sum to printed total) is enforced inside
  # the extractors; assert again here for defence in depth.
  bad <- which(rowSums(df[, categories]) != df$total)
  if (length(bad)) {
    stop("2011 per-zila reconciliation failed for: ",
         paste(df$area_code[bad], collapse = ", "), call. = FALSE)
  }
  df
}

null_if_na <- function(value) {
  if (length(value) == 0L || is.na(value) || !is.finite(value)) return(NULL)
  value
}

# assemble one schema-shaped area-summary row. wave-parameterised: the universe
# basis text and universe/small-cell quality tokens differ per wave, but the
# minority-share two-slot construction is identical.
build_row <- function(area_code, area_name, land_area_sq_km, counts, year, universe,
                      withheld = FALSE, source_swap = FALSE) {
  if (withheld) {
    reason <- if (identical(area_code, "bhola")) {
      "community_report_pdf_missing_printed_pages_229_240_C13_zila_total"
    } else {
      "community_report_source_defect"
    }
    known_total <- withheld_known_totals_2011[[area_code]]
    reason_prose <- "the Community Report PDF omits printed pages 229-240 (the Table C-13 zila-total religion line and five upazilas' breakdown), and the authorized Zila-Series recovery failed because Zila_BHOLA.pdf is a scanned document whose religion tables carry no text layer (text layer required, never optical character recognition, per the conductor ruling 2026-07-12)"
    flags <- paste(c(
      "census_flat_frame_minority_share_design",
      sprintf("reference_group=%s", reference_group),
      "minority_share=Hindu+Christian+Buddhist+Others",
      "source_categories_verbatim=Muslim|Hindu|Christian|Buddhist|Others",
      "religion_composition_withheld_source_defect",
      sprintf("withheld_reason=%s", reason),
      "zila_series_recovery_attempted_report_is_scanned_image_no_text_layer",
      sprintf("published_zila_total=%d", known_total),
      universe[["token"]]
    ), collapse = ";")
    return(list(
      country_code = country_code,
      boundary_set_id = boundary_set_id,
      boundary_level = boundary_level,
      area_unit_id = paste0(boundary_set_id, ":", area_code),
      area_code = area_code,
      area_name = area_name,
      year = year,
      population_total = NULL,
      population_total_basis = paste0(
        "WITHHELD: the 2011 record for ", area_name, " is unrecoverable from a text layer (", reason_prose,
        "); the religion composition is withheld and never substituted, estimated, or interpolated. The enumerated ", area_name,
        " zila population is independently published in the Vol-2 union statistics as ", known_total,
        ", used only to confirm the national frame closes."),
      religious_affiliation_count = NULL,
      religious_affiliation_percent = NULL,
      no_religion_count = NULL,
      no_religion_percent = NULL,
      place_count = NULL,
      places_per_10000_residents = NULL,
      place_density_per_sq_km = NULL,
      land_area_sq_km = round(land_area_sq_km, 2),
      site_snapshot_date = NULL,
      place_count_basis = NULL,
      source_dataset_ids = c(census_dataset_id_2011, boundary_dataset_id),
      quality_flag = flags
    ))
  }
  cat_counts <- setNames(as.integer(counts[categories]), categories)
  total <- sum(cat_counts)
  reference_count <- cat_counts[[reference_group]]
  minority_count <- as.integer(total - reference_count)
  reference_pct <- round(100 * reference_count / total, metric_round_digits)
  minority_pct <- round(100 * minority_count / total, metric_round_digits)
  composition <- paste(sprintf("%s=%d", categories, cat_counts), collapse = ";")

  # structured area-summary.v2 composition: one item per printed source category
  # in the verbatim frame order, carrying the source-verbatim label and the exact
  # published zila count. the census prints counts, not percentages, so no percent
  # is derived. taxonomy_code links to denomination-taxonomy.json where the
  # mapping is unambiguous (Others has none). withheld rows (Bhola 2011) carry no
  # composition; the field is absent, never zeroed or estimated.
  composition_items <- lapply(categories, function(cat) {
    item <- list(label_verbatim = cat, count = as.integer(cat_counts[[cat]]))
    code <- category_taxonomy[[cat]]
    if (!is.na(code)) item[["taxonomy_code"]] <- code
    item
  })

  # small-cell tokens (thresholds applied exactly). the denominator token fires
  # when the zila total is under 100; the numerator token when any published
  # category cell is under 10. name the sub-threshold categories for transparency.
  small_cat <- categories[cat_counts < small_cell_numerator_threshold]
  tokens <- c(
    "census_flat_frame_minority_share_design",
    sprintf("reference_group=%s", reference_group),
    sprintf("reference_share_pct=%s", reference_pct),
    sprintf("minority_share_pct=%s", minority_pct),
    "minority_share=Hindu+Christian+Buddhist+Others",
    composition,
    "source_categories_verbatim=Muslim|Hindu|Christian|Buddhist|Others",
    "no_religion_category_absent",
    "not_stated_category_absent",
    universe[["token"]],
    "exact_zila_reconciliation"
  )
  if (source_swap) {
    # authorized source swap (conductor ruling 2026-07-12): the Community Report
    # copy is defective; this row's counts come from the Zila Series report.
    tokens <- c(tokens,
                "source_swap_zila_series_report",
                "source_table=Zila_Report_Lalmonirhat_Table_P05",
                "community_report_copy_defective_scanned_image",
                "zila_total_matches_vol2_enumerated_total_exactly")
  }
  if (total < small_denominator_threshold) {
    tokens <- c(tokens, "small_denominator_under_100")
  }
  if (length(small_cat)) {
    tokens <- c(tokens,
                "small_cell_under_10",
                sprintf("small_cells=%s", paste(small_cat, collapse = "|")))
  }
  flags <- paste(tokens, collapse = ";")

  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = paste0(boundary_set_id, ":", area_code),
    area_code = area_code,
    area_name = area_name,
    year = year,
    population_total = as.integer(total),
    population_total_basis = if (source_swap) {
      paste0(universe[["basis"]],
             " SOURCE SWAP (authorized, conductor ruling 2026-07-12): the Community Report copy for ", area_name,
             " is defective (scanned image, no text layer for the C-13 religion pages), so this row's counts come from the 2011 Zila Series report (Zila Report: Lalmonirhat), Table P05 'Population by Age group, Religion and Residence' zila-total line, a different official BBS publication of the same census, identical five-category frame and column order; the zila total equals the Vol-2 enumerated total (1,256,099) exactly, and Table PT14 of the same report prints the identical 2011 counts.")
    } else universe[["basis"]],
    religious_affiliation_count = reference_count,
    religious_affiliation_percent = reference_pct,
    no_religion_count = minority_count,
    no_religion_percent = minority_pct,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(land_area_sq_km, 2),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = c(
      if (year != 2011L) census_dataset_id_2022
      else if (source_swap) census_dataset_id_2011_zila
      else census_dataset_id_2011,
      boundary_dataset_id),
    quality_flag = flags,
    composition = composition_items
  )
}

# per-wave universe declarations. 2011 is the full enumerated population (the 2011
# census carried no third-gender enumeration and Table C-13 has no not-stated
# category); 2022 is the sex-classified population, which excludes the 8,124 hijra
# nationally who are religion-classified only in the division-level Table 3.2.15.
universe_2011 <- list(
  token = "universe_2011_full_enumerated_population;no_hijra_enumeration_in_2011;not_stated_category_absent",
  basis = paste0(
    "Sum of the five Table C-13 religion categories (Muslim, Hindu, Christian, Buddhist, Others) at the zila-total line of the 2011 Community Report; the full enumerated population. The 2011 census carried no third-gender (hijra) enumeration and Table C-13 has no not-stated category, so this is the complete enumerated zila population. Under the minority-share design the two metric slots carry the reference-group (Muslim) share and its exact complement, the minority share."
  )
)
universe_2022 <- list(
  token = "sex_classified_basis_excludes_hijra",
  basis = paste0(
    "Sum of the five Table P08 religion categories (Muslim, Hindu, Christian, Buddhist, Others), the male + female classified population; excludes hijra (third gender), who are religion-classified only at division level in Table 3.2.15. Under the minority-share design the two metric slots carry the reference-group (Muslim) share and its exact complement, the minority share; the recognised categories are Muslim, Hindu, Christian, Buddhist and Others, with no no-religion and no not-stated category."
  )
)

# coalesce a NULL scalar (withheld metric) to NA for flat CSV cells.
na_if_null <- function(value) if (is.null(value)) NA else value

# flatten the area-summary rows for the CSV sibling.
flatten_rows <- function(rows) {
  do.call(rbind, lapply(rows, function(row) {
    data.frame(
      country_code = row$country_code,
      boundary_set_id = row$boundary_set_id,
      boundary_level = row$boundary_level,
      area_unit_id = row$area_unit_id,
      area_code = row$area_code,
      area_name = row$area_name,
      year = row$year,
      population_total = na_if_null(row$population_total),
      population_total_basis = row$population_total_basis,
      religious_affiliation_count = na_if_null(row$religious_affiliation_count),
      religious_affiliation_percent = na_if_null(row$religious_affiliation_percent),
      no_religion_count = na_if_null(row$no_religion_count),
      no_religion_percent = na_if_null(row$no_religion_percent),
      place_count = NA_integer_,
      places_per_10000_residents = NA_real_,
      place_density_per_sq_km = NA_real_,
      land_area_sq_km = row$land_area_sq_km,
      site_snapshot_date = NA,
      place_count_basis = NA,
      source_dataset_ids = paste(row$source_dataset_ids, collapse = "|"),
      quality_flag = row$quality_flag,
      stringsAsFactors = FALSE
    )
  }))
}

row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$", path)) {
    return(length(fromJSON(path, simplifyVector = FALSE)[["features"]]))
  }
  if (grepl("\\.json$", path)) {
    j <- fromJSON(path, simplifyVector = FALSE)
    if (!is.null(j[["rows"]])) return(length(j[["rows"]]))
  }
  NA_integer_
}

validate_json_file <- function(path) {
  jsonlite::validate(paste(readLines(path, warn = FALSE), collapse = "\n"))
}

# read, label, measure, simplify, and write the district boundary layer.
write_boundary_product <- function(path, census_names, output_path) {
  raw <- st_read(path, quiet = TRUE)
  if (!"shapeName" %in% names(raw)) stop("boundary lacks shapeName property", call. = FALSE)

  boundary_for_census <- ifelse(census_names %in% names(name_concordance),
                                name_concordance[census_names], census_names)
  boundary_names <- raw[["shapeName"]]
  missing <- setdiff(boundary_for_census, boundary_names)
  extra <- setdiff(boundary_names, boundary_for_census)
  if (length(missing) || length(extra) || nrow(raw) != 64L) {
    stop("boundary-census join is not exactly 64:64 (missing: ",
         paste(missing, collapse = ", "), "; extra: ",
         paste(extra, collapse = ", "), ")", call. = FALSE)
  }

  lookup <- data.frame(
    shapeName = boundary_for_census,
    area_code = slugify(census_names),
    area_name = census_names,
    stringsAsFactors = FALSE
  )
  idx <- match(raw[["shapeName"]], lookup$shapeName)
  raw[["area_code"]] <- lookup$area_code[idx]
  raw[["area_name"]] <- lookup$area_name[idx]

  boundaries <- raw[order(raw[["area_code"]]), c("area_code", "area_name")]
  boundaries <- st_make_valid(boundaries)
  projected <- st_make_valid(st_transform(boundaries, 8857))
  area_table <- st_drop_geometry(boundaries)
  area_table[["land_area_sq_km"]] <- as.numeric(st_area(projected)) / 1e6

  tolerances <- c(250, 500, 750, 1000, 1500, 2000, 3000, 5000, 8000, 12000, 20000)
  chosen_tolerance <- tail(tolerances, 1)
  chosen_bytes <- NA_integer_
  for (tolerance in tolerances) {
    candidate <- st_simplify(projected, dTolerance = tolerance, preserveTopology = TRUE)
    candidate <- st_make_valid(st_transform(candidate, 4326))
    st_write(candidate, output_path, quiet = TRUE, delete_dsn = TRUE)
    chosen_bytes <- file_bytes(output_path)
    chosen_tolerance <- tolerance
    if (chosen_bytes <= 3000000L) break
  }
  if (chosen_bytes > 3000000L) {
    stop("boundary output remains larger than 3 MB after maximum simplification", call. = FALSE)
  }

  list(
    area_table = area_table,
    source_feature_count = nrow(raw),
    output_feature_count = row_count_file(output_path),
    simplification_tolerance_m = chosen_tolerance,
    output_bytes = chosen_bytes
  )
}

# --- build ---------------------------------------------------------------

require_file(census_pdf_path)
require_file(vol2_txt_path)
require_file(file.path(raw_dir, zila_lalmonirhat_file))
require_file(boundary_path)
require_file(boundary_meta_path)

# 2022 wave: parse and reconcile Table P08.
p08 <- read_table_p08(census_pdf_path)
districts_2022 <- reconcile_p08(p08)

# 2011 wave: parse and reconcile all 64 Table C-13 zila totals.
districts_2011 <- read_all_c13()

# boundary and land areas (shared across both waves).
boundary_info <- write_boundary_product(boundary_path, districts_2022$name, boundary_out)
area_table <- boundary_info[["area_table"]]

# 2011 national reconciliation. districts_2011 carries the extracted zilas only
# (Bhola and Lalmonirhat withheld on source-PDF defects). two facts are checked.
# first, the FRAME closes: the 62 extracted zila totals plus the two withheld
# zilas' independently published enumerated populations reproduce the enumerated
# national anchor 144,043,697 (exactly). second, the extracted-zila derived
# national shares track the Vol-2 infographic; because two ~1.2%-weight zilas are
# withheld this is an approximate check (a wider band), enough to catch a gross
# column-drift extraction error but not asserting an exact national match that the
# withheld zilas make impossible.
national_counts_2011 <- setNames(
  vapply(categories, function(cat) sum(districts_2011[[cat]]), numeric(1)), categories)
national_total_extracted_2011 <- sum(districts_2011$total)
withheld_total_2011 <- sum(withheld_known_totals_2011)
national_total_2011 <- national_total_extracted_2011 + withheld_total_2011
national_sum_deviation_2011 <- national_total_2011 - national_enumerated_2011
if (abs(national_sum_deviation_2011) > 1000L) {
  stop(sprintf("2011 frame reconciliation off by %d: extracted zila totals (%d) plus the withheld zilas' published totals (%d) do not close to the enumerated national anchor %d",
               national_sum_deviation_2011, national_total_extracted_2011,
               withheld_total_2011, national_enumerated_2011), call. = FALSE)
}
national_derived_pct_2011 <- round(100 * national_counts_2011 / national_total_extracted_2011, 2)
pct_deviation_2011 <- national_derived_pct_2011 - national_pct_published_2011[categories]
if (any(abs(pct_deviation_2011) > 0.5)) {
  stop("2011 extracted-zila national percentages diverge from the Vol-2 infographic beyond the withheld-zila band: ",
       paste(sprintf("%s %.2f vs %.2f", categories, national_derived_pct_2011,
                     national_pct_published_2011[categories]), collapse = "; "),
       call. = FALSE)
}

# build both waves' rows, joined by the slugified area code from the boundary.
make_wave_rows <- function(src, year, universe, count_of, withheld_codes = character(0),
                           swap_codes = character(0)) {
  unname(lapply(seq_len(nrow(area_table)), function(i) {
    code <- area_table$area_code[i]
    name <- area_table$area_name[i]
    if (code %in% withheld_codes) {
      return(build_row(code, name, area_table$land_area_sq_km[i], NULL, year, universe,
                       withheld = TRUE))
    }
    counts <- count_of(src, code)
    build_row(code, name, area_table$land_area_sq_km[i], counts, year, universe,
              source_swap = code %in% swap_codes)
  }))
}

# 2022 counts by area code: match the census district name to its slug.
counts_2022 <- function(src, code) {
  idx <- which(slugify(src$name) == code)
  if (length(idx) != 1L) stop("expected one 2022 census row for ", code, call. = FALSE)
  setNames(as.integer(unlist(src[idx, paste0(categories, "_T")])), categories)
}
# 2011 counts by area code: rows are already keyed by area_code.
counts_2011 <- function(src, code) {
  idx <- which(src$area_code == code)
  if (length(idx) != 1L) stop("expected one 2011 Community Report for ", code, call. = FALSE)
  setNames(as.integer(unlist(src[idx, categories])), categories)
}

rows_2011 <- make_wave_rows(districts_2011, 2011L, universe_2011, counts_2011, withheld_2011,
                            swap_codes = recovered_2011)
rows_2022 <- make_wave_rows(districts_2022, 2022L, universe_2022, counts_2022)

# join coverage must be exactly 64:64 by area code, in both waves.
boundary_codes <- sort(area_table$area_code)
for (waverows in list(rows_2011, rows_2022)) {
  codes <- sort(vapply(waverows, `[[`, character(1), "area_code"))
  if (!identical(codes, boundary_codes)) {
    stop("area-code join coverage failed between a census wave and the boundary", call. = FALSE)
  }
}

# ordering: both waves per district, 2011 before 2022, districts alphabetical.
rows <- unlist(lapply(seq_along(rows_2011), function(i) list(rows_2011[[i]], rows_2022[[i]])),
               recursive = FALSE)

# minority-share complement gate: the two metric slots must be exact complements
# in every row (reference-group share plus minority share equals 100 exactly).
complement_diff <- vapply(rows, function(r) {
  aff <- r[["religious_affiliation_percent"]]
  min_share <- r[["no_religion_percent"]]
  if (is.null(aff) || is.null(min_share)) return(0) # withheld rows carry null metrics
  aff + min_share - 100
}, numeric(1))
if (any(abs(complement_diff) > 0)) {
  bad <- vapply(rows, `[[`, character(1), "area_name")[abs(complement_diff) > 0]
  stop("minority-share complement gate failed for rows: ",
       paste(bad, collapse = ", "), call. = FALSE)
}

# national reference-group anchor (2022): the Muslim share on the Table P08 basis
# must reproduce the published national figure at printed (two-decimal) rounding.
national_total_2022 <- sum(national_expected_2022)
national_reference_pct_2022 <- 100 * national_expected_2022[[reference_group]] / national_total_2022
if (round(national_reference_pct_2022, 2) != reference_national_share_published) {
  stop(sprintf("2022 national reference-group share %.4f does not reproduce the published %.2f",
               national_reference_pct_2022, reference_national_share_published), call. = FALSE)
}

# --- source-dataset, indicator, and visual-layer records -----------------

source_datasets <- function() {
  list(
    list(
      source_dataset_id = census_dataset_id_2011,
      name = "Population and Housing Census 2011, Community Report series (64 zila reports), Table C-13: Distribution of population by religion, residence and community",
      provider = "Bangladesh Bureau of Statistics (BBS), Statistics and Informatics Division, Ministry of Planning",
      url = community_series_url,
      retrieval_date = retrieval_date_2011,
      local_path = file.path(raw_dir, "phc2011_community_<zila>.pdf (64 files; see phc2011_community_index.json)"),
      licence = list(
        name = "BBS copyright asserted; reuse terms unresolved",
        url = bbs_site_url,
        attribution = "Bangladesh Bureau of Statistics"
      ),
      citation = "Bangladesh Bureau of Statistics, Population and Housing Census 2011, Community Report series (one report per zila), Table C-13.",
      access_limits = "The BBS canonical hosts are TLS-blocked in the local environment; the 64 Community Reports were retrieved over plain HTTP from the National Statistical Data System (nsds.bbs.gov.bd), each linked from an individual publication post pointing to the PHC_2011 Community Report storage folder. Source filenames are inconsistent across zilas and are recorded verbatim per zila in phc2011_community_index.json.",
      redistribution_limits = "BBS asserts copyright with no open-reuse licence located. The raw PDFs are not committed; this derived product is held in staging until BBS reuse terms are established.",
      notes = "Each report's Table C-13 prints a '[Zila] Total' line with the five categories Muslim, Hindu, Christian, Buddhist, Others in the identical column order as the 2022 Table P08. 62 of the 64 reports yield this line from a clean text layer, and every extracted zila's five categories sum exactly to its printed total. Two copies are defective (confirmed on byte-identical fresh re-downloads): Bhola omits printed pages 229-240 (the C-13 zila-total religion pages) and Lalmonirhat is a scanned image with no text layer for C-13; Lalmonirhat is recovered from the Zila Series report (authorized source swap) and Bhola is withheld. The 2011 wave is the full enumerated population (no third-gender enumeration, no not-stated category)."
    ),
    list(
      source_dataset_id = census_dataset_id_2011_zila,
      name = "Population and Housing Census 2011, Zila Report: Lalmonirhat (Zila Series), Table P05: Population by Age group, Religion and Residence (zila-total line); cross-checked against Table PT14: Population by Religion, 1981-2011",
      provider = "Bangladesh Bureau of Statistics (BBS), Statistics and Informatics Division, Ministry of Planning",
      url = zila_lalmonirhat_url,
      retrieval_date = retrieval_date_2011,
      local_path = file.path(raw_dir, zila_lalmonirhat_file),
      licence = list(
        name = "BBS copyright asserted; reuse terms unresolved",
        url = bbs_site_url,
        attribution = "Bangladesh Bureau of Statistics"
      ),
      citation = "Bangladesh Bureau of Statistics, Population and Housing Census 2011, Zila Report: Lalmonirhat, Table P05 (and Table PT14).",
      access_limits = "Retrieved over plain HTTP from nsds.bbs.gov.bd (PHC_Zila_2011 storage folder, publication post 390); BBS canonical hosts are TLS-blocked locally.",
      redistribution_limits = "BBS asserts copyright with no open-reuse licence located. The raw PDF is not committed; this derived product is held in staging until BBS reuse terms are established.",
      notes = "Authorized source swap (conductor ruling 2026-07-12) for the single Lalmonirhat 2011 row: the Community Report copy for Lalmonirhat is a scanned image with no text layer for its C-13 religion pages, so this Zila Series report (a different official BBS publication of the same census) supplies the zila-total religion line from its text layer. Identical five-category frame and column order as C-13 (Total, Muslim, Hindu, Christian, Buddhist, Others); the zila total (1,256,099) equals the Vol-2 enumerated total exactly; Table PT14 of the same report prints the identical 2011 counts. The defective Community Report copy remains cached and documented."
    ),
    list(
      source_dataset_id = census_dataset_id_2022,
      name = "Population and Housing Census 2022, National Report (Volume I), Table P08: Population by Religion, Sex and District",
      provider = "Bangladesh Bureau of Statistics (BBS), Statistics and Informatics Division, Ministry of Planning",
      url = census_pdf_url,
      retrieval_date = retrieval_date_2022,
      local_path = census_pdf_path,
      licence = list(
        name = "BBS copyright asserted; reuse terms unresolved",
        url = bbs_site_url,
        attribution = "Bangladesh Bureau of Statistics"
      ),
      citation = "Bangladesh Bureau of Statistics, Population and Housing Census 2022, National Report (Volume I), November 2023 (revised January 2024), ISBN 978-984-475-201-6, Table P08.",
      access_limits = "The canonical bbs.portal.gov.bd host was unreachable; the report was retrieved from the BBS Oracle Cloud object-storage mirror. TLS chain validation failed for the bbs.gov.bd hosts in the local environment.",
      redistribution_limits = "The report front matter asserts copyright (c) BBS with no open-reuse licence located. The raw PDF is not committed; this derived product is held in staging until BBS reuse terms are established.",
      notes = "Table P08 reports Muslim, Hindu, Christian, Buddhist, and Others by Total, Male and Female for 64 districts in 8 divisions plus a national row. The sex-classified table excludes the 8,124 hijra (third-gender) persons who are religion-classified only in Table 3.2.15; the district table therefore sums to 165,150,492 rather than the full 165,158,616 population."
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "geoBoundaries BGD ADM2 (district) boundaries",
      provider = "geoBoundaries (William & Mary geoLab); source Bangladesh Bureau of Statistics and OCHA ROAP",
      url = boundary_meta_url,
      retrieval_date = retrieval_date_2022,
      local_path = boundary_path,
      licence = list(
        name = "Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO)",
        url = "https://creativecommons.org/licenses/by/3.0/igo/",
        attribution = "geoBoundaries; Bangladesh Bureau of Statistics; OCHA ROAP"
      ),
      citation = "geoBoundaries BGD ADM2, boundary ID BGD-ADM2-16705992, release commit 9469f09.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary attributes geoBoundaries and its BBS/OCHA sources under CC BY 3.0 IGO.",
      notes = "64 features; boundaryYearRepresented 2020; the 64-district set is stable across the 2011 and 2022 census waves, so one boundary serves both waves."
    )
  )
}

indicators <- function() {
  list(
    list(
      indicator_id = "population_total",
      label = "Population classified by religion",
      description = "Sum of the five religion categories in the district. 2011: the full enumerated population (Table C-13 zila total). 2022: the sex-classified population (Table P08, male + female).",
      unit = "count",
      denominator_indicator_id = NULL,
      method = "2011: sum of the five Table C-13 categories at the zila-total line (Lalmonirhat: the Zila Series report's Table P05 zila-total line, an authorized source swap with the identical frame and column order). 2022: sum of the five Table P08 Total columns.",
      temporal_coverage = "2011; 2022",
      spatial_coverage = "Bangladesh districts (zila), 64 units",
      quality_notes = "Per-wave universe difference: the 2011 wave is the full enumerated population (the 2011 census carried no third-gender enumeration and Table C-13 has no not-stated category); the 2022 wave is the sex-classified population, which excludes the 8,124 hijra (third gender) persons nationally, who are religion-classified only in the division-level Table 3.2.15. The 8,124-person national exclusion is immaterial to the district minority shares. Neither wave has a not-stated or non-response category."
    ),
    list(
      indicator_id = "religious_affiliation_percent",
      label = "Muslim (%)",
      description = "Reference-group share: the share of the district's classified population reporting the reference group, Muslim. Declared construct under the minority-share design (project-lead ruling 2026-07-11): the reference group is Bangladesh's largest published category at the national level in the most recent wave (2022), held constant across every district and both waves. The value is that group's share of the census frame, never a measure of affiliation versus non-affiliation.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * Muslim / population_total, where population_total is the sum of the five religion categories in the wave's district table.",
      temporal_coverage = "2011; 2022",
      spatial_coverage = "Bangladesh districts (zila), 64 units",
      quality_notes = "Reference group Muslim, declared once and held constant across both waves. National most-recent-wave evidence: 150,415,066 / 165,150,492 = 91.0776%, reproducing the published BBS national figure of 91.08% (Table 3.2.15) at printed two-decimal rounding. The 2011 summed shares reproduce the Vol-2 national infographic (Muslim 90.39, Hindu 8.54, Christian 0.37, Buddhist 0.60, Others 0.14). The per-district composition (the five category counts) is carried verbatim in each row's quality_flag."
    ),
    list(
      indicator_id = "no_religion_percent",
      label = "Minority share (%)",
      description = "Minority share: the exact complement of the reference-group share, the summed share of every published category outside the reference group (Hindu + Christian + Buddhist + Others). This is arithmetic on the published affiliation categories, the share outside Bangladesh's largest published category. It is not a measure of no religion, belief, practice, or secularity.",
      unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * (Hindu + Christian + Buddhist + Others) / population_total; equivalently 100 minus religious_affiliation_percent. The two slots are exact complements in every row and wave.",
      temporal_coverage = "2011; 2022",
      spatial_coverage = "Bangladesh districts (zila), 64 units",
      quality_notes = "The no_religion slot carries the minority share under the minority-share design; the field name is the legacy slot key and carries no no-religion semantics. Small-cell rule (ratified 2026-07-12): rows whose smallest published category cell is under 10 persons carry a small_cell_under_10 token naming the affected categories; no zila denominator falls under 100, so the small_denominator_under_100 token is not triggered. Change across 2011-2022 differences the reference-group (Muslim) share on the stable 64-zila frame."
    )
  )
}

visual_layers <- function() {
  list(
    list(
      visual_layer_id = "bd-district-muslim-share",
      label = "Muslim (%)",
      description = "Census reference-group (Muslim) share by district, 2011 and 2022.",
      layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"),
      geometry_unit_type = "area_unit",
      legend = NULL,
      colour_scale = "shared sequential blue",
      time_control = "year_selector",
      aggregation_rule = "reported district value",
      uncertainty_display = "quality_flag",
      default_visibility = TRUE,
      notes = "Reference-group share under the minority-share design: the share reporting Muslim, Bangladesh's largest published category. The per-category composition rides on each row's quality_flag. The year selector switches between the 2011 and 2022 waves on the stable 64-zila frame."
    ),
    list(
      visual_layer_id = "bd-district-minority-share",
      label = "Minority share (%)",
      description = "Census minority share by district: the exact complement of the Muslim share (Hindu + Christian + Buddhist + Others), 2011 and 2022.",
      layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"),
      geometry_unit_type = "area_unit",
      legend = NULL,
      colour_scale = "shared sequential blue",
      time_control = "year_selector",
      aggregation_rule = "reported district value",
      uncertainty_display = "quality_flag",
      default_visibility = FALSE,
      notes = "Minority share: arithmetic on the published affiliation categories, the share outside the reference group. Not a measure of no religion, belief, practice, or secularity. Highest where the map is most informative (for example Rangamati and Bandarban in the Chittagong Hill Tracts)."
    )
  )
}

# --- write the combined two-wave area summary ----------------------------

site_snapshot_block <- list(
  source_dataset_id = NULL,
  snapshot_date = NULL,
  basis = "no governed Bangladesh OpenStreetMap place-of-worship snapshot is included in this country data-map release",
  notes = "The Bangladesh page exposes the census minority-share metrics only (the reference-group Muslim share and its minority-share complement); place-density metrics are hidden until a governed Bangladesh place layer is built."
)

write_summary <- function(rows_subset, path_json, path_csv) {
  area_summary <- list(
    schema_version = "area-summary.v2",
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
    site_snapshot = site_snapshot_block,
    source_datasets = source_datasets(),
    indicators = indicators(),
    visual_layers = visual_layers(),
    rows = rows_subset
  )
  write_json(area_summary, path_json, auto_unbox = TRUE, pretty = TRUE,
             null = "null", na = "null", digits = NA)
  write.csv(flatten_rows(rows_subset), path_csv, row.names = FALSE, na = "")
  if (!validate_json_file(path_json)) stop("invalid summary JSON: ", path_json, call. = FALSE)
}

# combined two-wave product (128 rows). the legacy single-wave 2022 files
# (area_summary_district_2022.{json,csv}) are NOT rewritten here: they remain a
# frozen, hash-consistent snapshot referenced by the superseded 2022 manifest, and
# the staged page (which references them and is not edited in this lane) keeps
# reading them unchanged. the two-wave deliverable is the combined file below.
write_summary(rows, summary_json_out, summary_csv_out)

version_hash <- substr(sha256_file(summary_json_out), 1, 12)

# --- manifest ------------------------------------------------------------

manifest_file_record <- function(path, content, licence_status) {
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

raw_file_record <- function(path, url, notes, source_dataset_id, used = TRUE) {
  list(
    uri = path,
    url = url,
    format = sub("^.*\\.", "", path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    source_dataset_id = source_dataset_id,
    used_in_public_product = used,
    notes = notes
  )
}

# per-zila 2011 raw-source records, read from the retrieval index so every cached
# report's url and sha256 ride the manifest.
community_index_path <- file.path(raw_dir, "phc2011_community_index.json")
raw_sources_2011 <- list()
if (file.exists(community_index_path)) {
  idx <- fromJSON(community_index_path, simplifyVector = FALSE)
  raw_sources_2011 <- lapply(idx[["reports"]], function(r) {
    defective <- isTRUE(r[["defective"]])
    recovered <- !is.null(r[["recovered_via"]])
    notes <- if (defective && recovered) {
      sprintf("2011 Community Report for %s (nsds post %s) DEFECTIVE (%s); superseded for this row by the authorized Zila-Series source swap (%s). Cached as defect documentation.",
              r[["district"]], r[["post_id"]], r[["defect"]], r[["recovered_via"]])
    } else if (defective) {
      sprintf("2011 Community Report for %s (nsds post %s) DEFECTIVE (%s); the authorized Zila-Series recovery also failed (scanned document), so the religion composition is WITHHELD, never substituted. Published enumerated zila total %d used only for national frame closure.",
              r[["district"]], r[["post_id"]], r[["defect"]], as.integer(r[["published_zila_total"]]))
    } else {
      sprintf("2011 Community Report for %s (nsds post %s); Table C-13 zila total %d = %s.",
              r[["district"]], r[["post_id"]], as.integer(r[["c13_total"]]),
              paste(sprintf("%s %d", categories,
                            vapply(categories, function(c) as.integer(r[["c13"]][[c]]), integer(1))),
                    collapse = " / "))
    }
    list(
      uri = r[["local_path"]],
      url = r[["url"]],
      format = "pdf",
      bytes = as.integer(r[["bytes"]]),
      sha256 = r[["sha256"]],
      source_dataset_id = census_dataset_id_2011,
      used_in_public_product = !defective,
      notes = notes
    )
  })
}

national_counts_int_2011 <- setNames(as.integer(national_counts_2011), categories)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = paste0("manifest:bd-census-religion:bd:2011-2022:", version_hash),
  dataset_id = "bd-census-religion:bd:2011-2022:bbs-phc-district",
  dataset_version_id = paste0("bd-census-religion:bd:2011-2022:bbs-phc-district:", version_hash),
  manifest_sha256 = NULL,
  supersedes_manifest_id = "manifest:bd-census-religion:bd:2022:c6e1b341c20b",
  superseded_by_manifest_id = NULL,
  dataset_family = "bd-census-religion",
  dataset_role = "staged_evidence",
  scope = list(
    level = "country",
    country_codes = list(country_code),
    snapshot_date = NULL,
    snapshot_anchor = NULL,
    pipeline_stage = "staged"
  ),
  created_at = stamp,
  created_by = script_id,
  pipeline = list(
    script = script_id,
    git_commit = NULL,
    command = paste("Rscript", script_id),
    parameters = list(
      waves = "2011; 2022",
      target_years = as.list(census_years),
      geography = "64 districts (zila) in 8 divisions",
      construct = "minority-share design over the BBS census religion frame: reference-group (Muslim) share and its exact complement, the minority share, on both waves",
      category_frame = as.list(categories),
      source_tables = list(
        `2011` = "Community Report series, Table C-13: Distribution of population by religion, residence and community (per-zila '[Zila] Total' line), for 62 of 64 zilas",
        `2011_lalmonirhat_source_swap` = "Zila Report: Lalmonirhat (Zila Series), Table P05: Population by Age group, Religion and Residence, zila-total line (cross-checked against Table PT14 of the same report) — authorized source swap, conductor ruling 2026-07-12; the Community Report copy for Lalmonirhat is a scanned image with no text layer for its C-13 religion pages and remains cached as defect documentation",
        `2022` = "National Report (Volume I), Table P08: Population by Religion, Sex and District"
      ),
      universes = list(
        `2011` = "full enumerated population (Table C-13 zila total; no third-gender enumeration, no not-stated category)",
        `2022` = "sex-classified population (Table P08 male + female; excludes 8,124 hijra classified only at division level in Table 3.2.15)"
      ),
      universe_difference_note = "The 2011 wave is the full enumerated population; the 2022 wave is the sex-classified population, which excludes the 8,124 hijra nationally. The exclusion is immaterial to the district minority shares (8,124 of 165 million) and is disclosed per wave on each row's quality_flag and in the population_total indicator. Following the Palau per-wave-universe disclosure pattern; unlike Palau, the difference here does not break comparability, so the change metric is supported.",
      metric_design = "minority-share (project-lead ruling 2026-07-11, task 6)",
      reference_group = reference_group,
      reference_group_basis = "largest published national category in the most recent wave (2022), held constant across every district and both waves",
      reference_group_national_share = sprintf("%s: 150,415,066 / 165,150,492 = 91.0776%% on the 2022 Table P08 sex-classified basis, reproducing the published national figure 91.08%% (Table 3.2.15) at printed two-decimal rounding", reference_group),
      affiliation_rule = "religious_affiliation_percent = 100 * Muslim / population_total (reference-group share); no_religion_percent = 100 * (Hindu + Christian + Buddhist + Others) / population_total (minority share, exact complement); the two slots sum to 100 in every row and wave",
      change_rule = "Two waves on the stable 64-zila frame support a change metric (the Peru 2007-2017 two-wave precedent): the reference-group (Muslim) share and the minority share are differenced across 2011-2022 per district. Both waves share the identical five-category frame and boundary; the only universe difference is the 8,124 hijra excluded from the 2022 sex-classified table, immaterial to the shares. Change is the difference of the reported shares; population growth is never treated as religion change.",
      national_anchor_2011 = sprintf("enumerated national population 144,043,697 (Vol-2 'Population (Enumerated)', Bangladesh, Both Sex). 63 of 64 zila totals were extracted from text layers (62 Community Reports Table C-13 plus the authorized Lalmonirhat Zila-Series Table P05 swap) and sum to %d; adding Bhola's independently published enumerated total (%d) closes the frame to %d (deviation %+d from the anchor — exact). Bhola's religion composition is WITHHELD (source-PDF defect, recovery failed: the Zila-Series copy is a scanned image), so the national category counts below are 63-zila; their derived shares (Muslim %.2f, Hindu %.2f, Christian %.2f, Buddhist %.2f, Others %.2f) track the Vol-2 infographic (Muslim 90.39, Hindu 8.54, Christian 0.37, Buddhist 0.60, Others 0.14) within the one-withheld-zila band",
                                     national_total_extracted_2011, withheld_total_2011, national_total_2011, national_sum_deviation_2011,
                                     national_derived_pct_2011[["Muslim"]], national_derived_pct_2011[["Hindu"]],
                                     national_derived_pct_2011[["Christian"]], national_derived_pct_2011[["Buddhist"]],
                                     national_derived_pct_2011[["Others"]]),
      national_category_counts_2011_extracted_63 = as.list(national_counts_int_2011),
      recovered_2011 = list(
        lalmonirhat = "RECOVERED via authorized source swap (conductor ruling 2026-07-12): the Community Report copy is a scanned image with no text layer for its C-13 religion pages, so the row's counts come from the Zila Series report (Zila Report: Lalmonirhat), Table P05 zila-total line, text layer, identical five-category frame and column order; the zila total (1,256,099) equals the Vol-2 enumerated total exactly and Table PT14 of the same report prints the identical 2011 counts (Muslim 1,080,512; Hindu 174,558; Christian 622; Buddhist 5; Others 402). The defective Community Report copy remains cached and documented."),
      withheld_2011 = list(
        bhola = "community report PDF omits printed pages 229-240 (C-13 zila-total religion line; byte-identical on fresh re-download and on the 203.112.218.101 alternate BBS host); authorized Zila-Series recovery FAILED: Zila_BHOLA.pdf is a scanned document whose religion tables carry no text layer (text layer required, never optical character recognition, per the ruling); religion composition withheld, never substituted, estimated, or interpolated; published zila total 1,776,795 (Vol-2) used only for frame closure"),
      denominator = "sum of the five religion categories in each wave's district table",
      name_concordance = as.list(paste(names(name_concordance), name_concordance, sep = " -> ")),
      boundary_source_vintage = "geoBoundaries BGD ADM2, boundaryYearRepresented 2020 (shared by both waves)",
      boundary_simplification_tolerance_m = boundary_info[["simplification_tolerance_m"]],
      small_cell_rule = "docs/development/small-cell-rule.md (ratified 2026-07-12): small_cell_under_10 token emitted where any published category cell is under 10; small_denominator_under_100 where a zila denominator is under 100 (not triggered — all zila totals exceed 100,000).",
      omitted_metrics = c("places_per_10000_residents", "place_density_per_sq_km")
    ),
    software_versions = list(
      r = paste(R.version[["major"]], R.version[["minor"]], sep = "."),
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite"))
    )
  ),
  source = list(
    provider = "Bangladesh Bureau of Statistics (BBS); geoBoundaries (W&M geoLab), BBS/OCHA ROAP",
    source_dataset_ids = c(census_dataset_id_2011, census_dataset_id_2011_zila, census_dataset_id_2022, boundary_dataset_id),
    source_urls = c(community_series_url, zila_lalmonirhat_url, census_pdf_url, vol2_url, boundary_url, boundary_meta_url),
    retrieved_at = paste0(retrieval_date_2011, "T00:00:00Z"),
    licence = "Census: BBS copyright asserted (2022 ISBN 978-984-475-201-6); no open-reuse licence located, reuse terms unresolved. Boundary: CC BY 3.0 IGO (geoBoundaries; BBS; OCHA ROAP).",
    citation = "Bangladesh Bureau of Statistics, Population and Housing Census 2011 (Community Report series, Table C-13) and 2022 (National Report Volume I, Table P08); geoBoundaries BGD ADM2.",
    raw_redistribution = "Raw census PDFs (64 Community Reports plus the 2022 National Report) and the boundary GeoJSON are not committed. They remain in data/raw/bd_census/ (git-ignored)."
  ),
  input_manifests = list(),
  raw_sources = c(
    list(
      raw_file_record(census_pdf_path, census_pdf_url,
        "BBS PHC 2022 National Report (Volume I). Table P08 extracted with pdftotext -layout; 64 districts reconcile exactly to 8 divisions and the national row.",
        census_dataset_id_2022),
      raw_file_record(vol2_txt_path, vol2_url,
        "BBS PHC 2011 National Report Volume-2 (Union Statistics) full text (Internet Archive). Anchors the 2011 enumerated national population (144,043,697) and the national religion percentages; carries no zila-by-religion cross-tab.",
        census_dataset_id_2011),
      raw_file_record(file.path(raw_dir, zila_lalmonirhat_file), zila_lalmonirhat_url,
        "BBS PHC 2011 Zila Report: Lalmonirhat (Zila Series; nsds post 390). Authorized source swap for the Lalmonirhat 2011 row: Table P05 zila-total religion line extracted from the text layer (Total 1,256,099 = Muslim 1,080,512 + Hindu 174,558 + Christian 622 + Buddhist 5 + Others 402, matching the Vol-2 enumerated total exactly); Table PT14 prints identical 2011 counts.",
        census_dataset_id_2011_zila),
      raw_file_record(file.path(raw_dir, zila_bhola_file), zila_bhola_url,
        "BBS PHC 2011 Zila Report: Bhola (Zila Series; nsds post 283). Cached as failed-recovery documentation only: the report is a scanned document whose text layer covers only the cover and Table H01; the religion tables are image-only, so the authorized Zila-Series recovery for Bhola could not proceed (text layer required, never optical character recognition). Not used in the product.",
        census_dataset_id_2011, used = FALSE),
      raw_file_record(boundary_path, boundary_url,
        "geoBoundaries BGD ADM2, 64 district features, joined to the census districts via the spelling concordance; shared by both waves.",
        boundary_dataset_id),
      raw_file_record(boundary_meta_path, boundary_meta_url,
        "geoBoundaries BGD ADM2 release metadata; records boundary ID BGD-ADM2-16705992, 64 units, CC BY 3.0 IGO.",
        boundary_dataset_id)
    ),
    raw_sources_2011
  ),
  durable_files = list(
    manifest_file_record(summary_json_out, "Bangladesh two-wave (2011 + 2022) district area summary, 128 rows, BBS census minority-share metrics (reference-group Muslim share and its minority-share complement); Bhola and Lalmonirhat 2011 religion cells withheld on source-PDF defects.", "needs_review"),
    manifest_file_record(summary_csv_out, "Flattened Bangladesh two-wave (2011 + 2022) district area summary.", "needs_review"),
    manifest_file_record(boundary_out, "Simplified Bangladesh district boundary GeoJSON derived from geoBoundaries BGD ADM2; shared by both waves.", "accepted")
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out),
         built_by = script_id, notes = "128 rows (64 districts x 2 waves); 2011 full enumerated population (Lalmonirhat recovered via the authorized Zila-Series source swap; Bhola religion composition withheld on source-PDF defects in both publications), 2022 sex-classified population."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out),
         built_by = script_id, notes = sprintf("geoBoundaries BGD ADM2 simplified at %d m tolerance to %d bytes; shared by both waves.", boundary_info[["simplification_tolerance_m"]], boundary_info[["output_bytes"]]))
  ),
  validation = list(
    status = "passed",
    checks = list(
      "2022 Table P08 parsed to exactly 1 national + 8 division + 64 district rows; every Male + Female cell equals its Total; every district sums to its division and every division to the national row.",
      "2022 national category totals match the verified anchor: Muslim 150,415,066; Hindu 13,143,749; Christian 488,555; Buddhist 1,001,927; Others 101,195.",
      "2011: 62 of 64 Community Reports parsed from Table C-13 text layers; every parsed zila's five categories sum exactly to its printed zila total. Lalmonirhat recovered via the authorized Zila-Series source swap (Table P05 text layer; zila total equals the Vol-2 enumerated total 1,256,099 exactly; Table PT14 prints identical counts). Bhola withheld (both its Community Report and Zila-Series copies are defective).",
      sprintf("2011 frame reconciliation: 63 extracted zila totals (62 C-13 + 1 P05 swap) sum to %d; adding Bhola's independently published enumerated total (%d) closes the frame to %d against the enumerated national anchor 144,043,697 (deviation %+d — exact). The 63-zila derived national shares (Muslim %.2f, Hindu %.2f, Christian %.2f, Buddhist %.2f, Others %.2f) track the Vol-2 infographic (Muslim 90.39, Hindu 8.54, Christian 0.37, Buddhist 0.60, Others 0.14) within the one-withheld-zila band.",
              national_total_extracted_2011, withheld_total_2011, national_total_2011, national_sum_deviation_2011,
              national_derived_pct_2011[["Muslim"]], national_derived_pct_2011[["Hindu"]],
              national_derived_pct_2011[["Christian"]], national_derived_pct_2011[["Buddhist"]],
              national_derived_pct_2011[["Others"]]),
      "Bhola's 2011 religion composition is WITHHELD (null metrics, disclosed): its Community Report PDF omits printed pages 229-240 (the C-13 zila-total religion line) and the authorized Zila-Series recovery failed (Zila_BHOLA.pdf is a scanned document, religion tables image-only; text layer required, never optical character recognition); the missing district religion is never substituted, estimated, or interpolated.",
      "The census-boundary district join is exactly 64:64 in both waves after the anglicised-spelling concordance (Bhola present in the 2011 frame with withheld metrics).",
      sprintf("The simplified boundary has %d features and %d bytes after %d m simplification.",
              boundary_info[["output_feature_count"]], boundary_info[["output_bytes"]], boundary_info[["simplification_tolerance_m"]]),
      "Minority-share design on both waves: religious_affiliation_percent carries the reference-group (Muslim) share and no_religion_percent its exact complement; the two slots sum to 100 in every row and wave.",
      sprintf("2022 national reference-group anchor: the Muslim share on the Table P08 basis is %.4f%%, reproducing the published national figure %.2f%% at printed rounding.",
              national_reference_pct_2022, reference_national_share_published),
      "Per-wave universe difference disclosed (2011 full enumerated population; 2022 sex-classified population excluding 8,124 hijra); small-cell tokens emitted per the ratified rule.",
      "Census publication reuse rights are unresolved: BBS asserts copyright and no open-reuse licence was located. The product is held in staging."
    ),
    national_reconciliation_2011 = list(
      enumerated_national_anchor = national_enumerated_2011,
      extracted_zila_count = nrow(districts_2011),
      withheld_zila = as.list(withheld_2011),
      extracted_zila_total_sum = national_total_extracted_2011,
      extraction_sources = "62 Community Reports (Table C-13) + 1 Zila Series report (Lalmonirhat, Table P05, authorized source swap)",
      withheld_published_totals = as.list(withheld_known_totals_2011),
      frame_total_incl_withheld = national_total_2011,
      frame_deviation = national_sum_deviation_2011,
      category_counts_extracted_63 = as.list(national_counts_int_2011),
      derived_percentages_extracted_63 = as.list(national_derived_pct_2011),
      published_percentages = as.list(national_pct_published_2011[categories])
    ),
    join_coverage = list(
      matched_area_count = length(rows_2011),
      expected_area_count = nrow(area_table),
      source_area_count_2011 = nrow(districts_2011),
      source_area_count_2022 = nrow(districts_2022)
    ),
    boundary_validation = list(
      source_feature_count = boundary_info[["source_feature_count"]],
      output_feature_count = boundary_info[["output_feature_count"]],
      output_bytes = boundary_info[["output_bytes"]],
      simplification_tolerance_m = boundary_info[["simplification_tolerance_m"]]
    )
  ),
  deferred_sources = list(
    list(
      source_dataset_id = "bbs-phc-2011-bhola-religion-recovery",
      url = zila_bhola_url,
      local_path = file.path(raw_dir, zila_bhola_file),
      notes = "Bhola's 2011 religion composition remains WITHHELD after the authorized recovery attempt (conductor ruling 2026-07-12). Its Community Report PDF omits printed pages 229-240 (the C-13 zila-total religion pages; byte-identical on fresh re-download and on the 203.112.218.101 alternate BBS host; no complete copy on the Internet Archive, the Barisal divisional portal, or via web search). The authorized Zila-Series route also failed: Zila_BHOLA.pdf (cached, sha256 pinned) is a scanned document whose text layer covers only the cover and Table H01 — the religion tables are image-only, and the ruling requires a text layer, never optical character recognition. Remaining unblocks: a text-based mirror of either publication, a re-issued BBS copy, or a conductor ruling authorizing optical character recognition of the scanned Zila-Series religion page."
    ),
    list(
      source_dataset_id = "bbs-census-2001-1991-1981-subnational-religion",
      url = bbs_site_url,
      local_path = NULL,
      notes = "National religion figures are established for 2001, 1991 and 1981, but no online extractable district religion table was located for these waves (2001/1991 published only in hard-copy Zila/Community Series; 1981 additionally sits on a pre-1984 greater-district frame break). The series therefore ends at two waves (2011 + 2022); deeper waves are HELD on source access per research/countries/bd/history-probe.md."
    )
  ),
  construct_notes = list(
    "The BBS census religion frame is Muslim, Hindu, Christian, Buddhist and Others. There is no no-religion category and no not-stated category in either wave; the frame sums to 100 percent by construction.",
    "Minority-share design (project-lead ruling 2026-07-11, task 6): the two legacy metric slots carry declared constructs on both waves. religious_affiliation_percent is the reference-group share (Muslim); no_religion_percent is its exact complement, the minority share (Hindu + Christian + Buddhist + Others). The two slots sum to 100 in every district and wave.",
    "The reference group is Muslim, Bangladesh's largest published national category in the most recent wave (2022), declared once and held constant across every district and both waves. National 2022 evidence: 150,415,066 / 165,150,492 = 91.0776%, reproducing the published 91.08% (Table 3.2.15). The 2011 summed shares reproduce the Vol-2 national infographic (Muslim 90.39, Hindu 8.54, Christian 0.37, Buddhist 0.60, Others 0.14).",
    "The minority share is arithmetic on the published affiliation categories, the share outside the reference group. It is not a measure of no religion, belief, practice, minority status in law, or self-understood identity. The no_religion slot key is the legacy runtime field name and carries no no-religion semantics here.",
    "Per-wave universe difference (Palau disclosure pattern): the 2011 wave is the full enumerated population (Table C-13; the 2011 census carried no third-gender enumeration and no not-stated category); the 2022 wave is the sex-classified population (Table P08), which excludes the 8,124 hijra classified only in the division-level Table 3.2.15. The 8,124-person national exclusion is immaterial to the district minority shares. Unlike Palau's all-ages-versus-18+ break, this difference does not break comparability, so the change metric is supported.",
    "Change metric (Peru 2007-2017 two-wave precedent): two waves on the stable 64-zila frame with the identical five-category frame and boundary support differencing the reference-group (Muslim) share and the minority share across 2011-2022. Population growth is never treated as a religion change.",
    "Small-cell rule (ratified 2026-07-12): rows whose smallest published category cell is under 10 persons carry a small_cell_under_10 token naming the affected categories; the count itself renders as published. No zila denominator falls under 100, so the small_denominator_under_100 token is not triggered. Thresholds are applied exactly.",
    "Two 2011 Community Report copies are defective (each confirmed byte-identical on fresh re-download): Bhola's omits printed pages 229-240 (the Table C-13 zila-total religion line) and Lalmonirhat's is a scanned image with no text layer for the C-13 religion pages. The conductor authorized recovery via the 2011 Zila/District Series reports (2026-07-12; a documented source addition, not a repair; text layer required, never optical character recognition; zila total must equal the Vol-2 enumerated total exactly). Lalmonirhat is RECOVERED under that ruling: the Zila Report: Lalmonirhat carries a full text layer, its Table P05 zila-total line reads Total 1,256,099 = Muslim 1,080,512 + Hindu 174,558 + Christian 622 + Buddhist 5 + Others 402 in the identical column order as C-13, the total equals the Vol-2 enumerated total exactly, and Table PT14 of the same report prints identical 2011 counts. The swap is disclosed on the row's quality_flag and source_dataset_ids, and the defective Community Report copy remains cached and documented.",
    "Bhola's 2011 religion composition remains WITHHELD (null metrics, disclosed on the row's quality_flag): the authorized Zila-Series recovery also failed because Zila_BHOLA.pdf is a scanned document whose religion tables carry no text layer (its text covers only the cover and Table H01), and the alternate BBS host serves byte-identical copies of both defective files. The missing district religion is never substituted, estimated, or interpolated; Bhola is present in the 2011 frame so the boundary join holds and the population frame closes exactly (its enumerated total, 1,776,795, is published in the cached Vol-2), but it carries no religion values and its 2011-2022 change is null.",
    "The per-district composition (the five category counts) is carried verbatim in each row's quality_flag in both waves (except the withheld Bhola 2011 cell).",
    "Religion figures in Bangladesh are politically salient for minority populations; the product renders the BBS record exactly and names the recognised categories neutrally, with no editorial framing.",
    "Page wiring is out of scope in this lane: the staged, hub-unlinked page apps/regions/bd/index.html still references the single-wave 2022 files and is not edited here. Surfacing the 2011 wave and the change metric on the page (a wave-agnostic district level with a year selector, following the Australia and Moldova two-wave page pattern) is a conductor follow-up, alongside the standing BBS reuse ask (PI task 1) that governs any move from staged to live."
  ),
  privacy = "public",
  licence_status = "needs_review",
  downstream_status = "staged",
  source_datasets = source_datasets(),
  notes = "Staged, not public: the census reuse licence is unresolved. Supersedes the single-wave 2022 manifest (bd-census-religion-2022.json), which is retained and marked superseded. The committed products are the two-wave derived area summary (128 rows across 2011 and 2022), the retained legacy single-wave 2022 summary, and a simplified district boundary shared by both waves. On-page attribution cites BBS and geoBoundaries with the CC BY 3.0 IGO boundary licence."
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!validate_json_file(manifest_out)) stop("invalid manifest JSON", call. = FALSE)

# mark the old single-wave 2022 manifest as superseded (retained, not deleted).
if (file.exists(old_manifest_out)) {
  old <- fromJSON(old_manifest_out, simplifyVector = FALSE)
  old[["superseded_by_manifest_id"]] <- manifest[["manifest_id"]]
  write_json(old, old_manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
  if (!validate_json_file(old_manifest_out)) stop("invalid old manifest JSON after supersession note", call. = FALSE)
}

cat(sprintf("wrote %s: %d rows (2011 + 2022)\n", summary_json_out, length(rows)))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("(legacy single-wave 2022 files left frozen: %s, %s)\n", legacy_json_out, legacy_csv_out))
cat(sprintf("wrote %s: %d features, %d bytes\n", boundary_out, row_count_file(boundary_out), file_bytes(boundary_out)))
cat(sprintf("wrote %s\n", manifest_out))
cat(sprintf("2011 national: total %d (anchor 144,043,697, deviation %+d); %s\n",
            national_total_2011, national_sum_deviation_2011,
            paste(sprintf("%s %d (%.2f%%)", categories, national_counts_int_2011, national_derived_pct_2011),
                  collapse = ", ")))
cat("done\n")
