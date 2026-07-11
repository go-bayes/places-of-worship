# build the Sri Lanka district census-religion area-summary product.
# inputs: DCS Statistical Abstract 2023 Table 2.14 (1981/2001/2012 district religion counts),
#         the standalone 2001 religion PDF p9p9Religion.pdf (18-district detail), the 2024
#         Population Preliminary Report Table A3 (district counts), and geoBoundaries LKA ADM3
#         (Divisional Secretariat, CC BY 3.0 IGO, Survey Department lineage) dissolved to the
#         25 modern districts, with geoBoundaries LKA ADM2 supplying the district assignment.
# outputs: district area-summary JSON/CSV, a simplified boundary, and a data-manifest.v2.
# run from the repository root: Rscript scripts/build_lk_area_summary.R
# design: four census waves (1981, 2001, 2012, 2024) on one stable 25-district frame. The six
#         religion categories are stable across every wave; two verbatim label conventions
#         coexist (the abstract convention for 1981/2012, the census-table convention for
#         2001/2024) in an exact 1:1 correspondence, both recorded. District counts are
#         rendered exactly as printed (render-the-record); no small-cell treatment is applied.
#         Two coverage facts ride the product per row and are never estimated or distributed:
#         (a) the 2001 census enumerated religion for only 18 of 25 districts, so the seven
#         northern and eastern districts carry their printed estimated total and null religion;
#         (b) Kilinochchi did not exist in 1981 (carved from Jaffna in 1984), so its 1981 row
#         is null and Jaffna's printed 1981 row covers present-day Jaffna plus Kilinochchi.
# licence: DCS asserts "@ All Rights Reserved" (no open licence). This build ships derived
#         summaries with DCS attribution; raw sources stay git-ignored. licence_status is
#         needs_review pending PI task 14; the gate is recorded in the manifest notes.

suppressMessages({
  library(digest)
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

raw_dir <- "data/raw/lk_census"
output_dir <- "apps/regions/lk/data"
manifest_dir <- "docs/manifests"
dir.create(raw_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

country_code <- "LK"
years <- c(1981L, 2001L, 2012L, 2024L)
script_id <- "scripts/build_lk_area_summary.R"
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- format(Sys.Date(), "%Y-%m-%d")
git_commit <- tryCatch(system("git rev-parse --short HEAD", intern = TRUE), error = function(e) NA_character_)
if (length(git_commit) == 0L || is.na(git_commit[[1]])) git_commit <- NULL

boundary_level <- "district"
boundary_vintage <- "2020"
boundary_set_id <- "lk-district-geoboundaries-adm3-dissolved-25"
census_dataset_id <- "dcs-census-religion-district-1981-2024"
boundary_dataset_id <- "geoboundaries-lka-adm3-dissolved-25"

# source URLs (verified 2026-07-11; see research/countries/lk/route-probe.md)
url_214 <- "https://www.statistics.gov.lk/abstract2023/CHAP2/2.14.pdf"
url_p9p9 <- "https://www.statistics.gov.lk/Resource/en/Population/PopHouStat/PDF/Population/p9p9Religion.pdf"
url_2024 <- "https://www.statistics.gov.lk/Resource/en/Population/CPH_2024/Population_Preliminary_Report.pdf"
url_terms <- "https://www.statistics.gov.lk/"
url_adm3_meta <- "https://www.geoboundaries.org/api/current/gbOpen/LKA/ADM3/"
url_adm2_meta <- "https://www.geoboundaries.org/api/current/gbOpen/LKA/ADM2/"
url_adm3 <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/LKA/ADM3/geoBoundaries-LKA-ADM3.geojson"
url_adm2 <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/LKA/ADM2/geoBoundaries-LKA-ADM2.geojson"

path_214 <- file.path(raw_dir, "abstract2023_2.14.pdf")
path_p9p9 <- file.path(raw_dir, "p9p9Religion.pdf")
path_2024 <- file.path(raw_dir, "cph2024_preliminary.pdf")
path_terms <- file.path(raw_dir, "dcs_home.html")
path_adm3_meta <- file.path(raw_dir, "gb_lka_adm3_meta.json")
path_adm2_meta <- file.path(raw_dir, "gb_lka_adm2_meta.json")
path_adm3 <- file.path(raw_dir, "geoboundaries_lka_adm3.geojson")
path_adm2 <- file.path(raw_dir, "geoboundaries_lka_adm2.geojson")

summary_json_out <- file.path(output_dir, "area_summary_district.json")
summary_csv_out <- file.path(output_dir, "area_summary_district.csv")
boundary_out <- file.path(output_dir, "lk_district_geoboundaries_adm3_dissolved.geojson")
manifest_out <- file.path(manifest_dir, "lk-census-religion-1981-2024.json")

# licence position captured byte-for-byte from the DCS site footer (2026-07-11).
dcs_copyright_verbatim <- "@ All Rights Reserved"
coverage_2001_footnote_verbatim <- "Data are given only for 18 districts where the Census of Population and Housing 2001 was carried out completely."

scope_note <- paste(
  "This product renders the Department of Census and Statistics (DCS) published district religion counts exactly, on the stable 25-district frame in force for the 2012 and 2024 censuses.",
  "The 2001 census enumerated religion for only 18 of 25 districts; the seven northern and eastern districts (Jaffna, Mannar, Vavuniya, Mullaitivu, Kilinochchi, Batticaloa, Trincomalee) carry the DCS estimated total population and null religion, with the DCS footnote quoted verbatim.",
  "Kilinochchi did not exist in 1981 (it was carved from Jaffna in 1984); its 1981 row is null and Jaffna's printed 1981 row covers present-day Jaffna plus Kilinochchi. No 1981 split is invented."
)
sensitivity_note <- paste(
  "Religion in Sri Lanka is closely tied to ethnicity and to the 1983-2009 civil war; a religion map reads as an ethnic map in the north and east.",
  "The DCS district tables print exact small counts with no official suppression rule; this product renders those counts as published and applies no district-level small-cell treatment.",
  "The 2001-to-2012 change in northern and eastern districts partly reflects displacement and return, not only affiliation change; the 2001 coverage gap already precludes any 2001-based change there."
)
label_note <- paste(
  "The six religion categories are stable across all four waves. Two verbatim DCS label conventions coexist for the same six categories, in an exact 1:1 correspondence.",
  "The abstract convention (Statistical Abstract 2023 Table 2.14, used here for 1981 and 2012) prints: Buddhist, Hindus, Muslims, Catholics, Christians, Others.",
  "The census-table convention (2001 p9p9Religion.pdf and 2024 Table A3) prints: Buddhist, Hindu, Islam, Roman Catholic, Other Christian, Other.",
  "Correspondence: Buddhist=Buddhist; Hindus=Hindu; Muslims=Islam; Catholics=Roman Catholic; Christians=Other Christian; Others=Other. Each wave preserves the label convention of its actual source table."
)
boundary_note <- paste(
  "Display geometry is the geoBoundaries LKA ADM3 layer (Divisional Secretariat, 330 features, boundary ID LKA-ADM3-8540358, represented year 2020, CC BY 3.0 IGO, OCHA ROAP / Survey Department of Sri Lanka lineage), dissolved to the 25 districts.",
  "Each ADM3 Divisional Secretariat is assigned to the district whose geoBoundaries LKA ADM2 polygon it most overlaps (largest-intersection-area assignment), then the Divisional Secretariats are unioned per district.",
  "The dissolve is verified to yield exactly 25 districts with valid, non-empty, distinct geometries. Geometric stability of district boundaries across the census waves was not independently verified."
)

# --- helpers ---------------------------------------------------------------

# return a file's SHA-256 digest.
sha256_file <- function(path) unname(tools::sha256sum(path))

# return a file's size in bytes.
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))

# write retrieval metadata after a successful download.
write_meta <- function(path, url, method = "GET", notes = NULL) {
  write_json(
    list(url = url, retrieved_at = stamp, http_status = 200L, method = method, notes = notes),
    paste0(path, ".meta.json"), auto_unbox = TRUE, pretty = TRUE, null = "null"
  )
}

# read retrieval metadata for a cached source, defaulting to the retrieval date.
read_meta <- function(path) {
  meta_path <- paste0(path, ".meta.json")
  if (!file.exists(meta_path)) {
    return(list(retrieved_at = paste0(retrieval_date, "T00:00:00Z"), http_status = NULL))
  }
  fromJSON(meta_path, simplifyVector = FALSE)
}

# fetch one source while preserving the first successful cache.
fetch_file <- function(url, path) {
  if (file.exists(path) && file_bytes(path) > 0L) return(invisible(path))
  part <- paste0(path, ".part")
  on.exit(unlink(part), add = TRUE)
  status <- system2("curl", c("-L", "--fail", "--silent", "--show-error", "--retry", "3",
                              "--max-time", "600", "-o", shQuote(part), shQuote(url)))
  if (!identical(status, 0L) || !file.exists(part) || file_bytes(part) == 0L) {
    stop("curl failed for ", url, call. = FALSE)
  }
  if (!file.rename(part, path)) stop("failed to cache ", path, call. = FALSE)
  write_meta(path, url)
  invisible(path)
}

# assert one cached PDF contains an expected verbatim anchor string (source-integrity gate).
assert_pdf_contains <- function(path, needles) {
  text_path <- tempfile(fileext = ".txt")
  on.exit(unlink(text_path), add = TRUE)
  status <- system2("pdftotext", c("-layout", shQuote(path), shQuote(text_path)))
  if (!identical(status, 0L)) stop("pdftotext failed for ", path, call. = FALSE)
  text <- paste(readLines(text_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  for (needle in needles) {
    if (!grepl(needle, text, fixed = TRUE)) {
      stop("source anchor not found in ", path, ": ", needle, call. = FALSE)
    }
  }
  invisible(TRUE)
}

# --- district frame (25 modern districts) -----------------------------------

# stable district codes, DCS English display names, and the geoBoundaries ADM2 district label.
districts <- data.frame(
  code = c("colombo", "gampaha", "kalutara", "kandy", "matale", "nuwara_eliya", "galle",
           "matara", "hambantota", "jaffna", "mannar", "vavuniya", "mullaitivu", "kilinochchi",
           "batticaloa", "ampara", "trincomalee", "kurunegala", "puttalam", "anuradhapura",
           "polonnaruwa", "badulla", "moneragala", "ratnapura", "kegalle"),
  area_name = c("Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya", "Galle",
                "Matara", "Hambantota", "Jaffna", "Mannar", "Vavuniya", "Mullaitivu", "Kilinochchi",
                "Batticaloa", "Ampara", "Trincomalee", "Kurunegala", "Puttalam", "Anuradhapura",
                "Polonnaruwa", "Badulla", "Moneragala", "Ratnapura", "Kegalle"),
  adm2_name = c("Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya", "Galle",
                "Matara", "Hambantota", "Jaffna", "Mannar", "Vavuniya", "Mullaitivu", "Kilinochchi",
                "Batticaloa", "Ampara", "Trincomalee", "Kurunegala", "Puttalam", "Anuradhapura",
                "Polonnaruwa", "Badulla", "Monaragala", "Ratnapura", "Kegalle"),
  stringsAsFactors = FALSE
)
district_codes <- districts[["code"]]

# --- category frame ---------------------------------------------------------

# six stable category codes in published column order.
category_codes <- c("buddhist", "hindu", "islam", "roman_catholic", "other_christian", "other")

# verbatim source labels per label convention, keyed by stable code.
labels_abstract <- c(buddhist = "Buddhist", hindu = "Hindus", islam = "Muslims",
                     roman_catholic = "Catholics", other_christian = "Christians", other = "Others")
labels_census_table <- c(buddhist = "Buddhist", hindu = "Hindu", islam = "Islam",
                         roman_catholic = "Roman Catholic", other_christian = "Other Christian", other = "Other")

# the label convention each wave's source table actually prints.
wave_label_convention <- c(`1981` = "abstract", `2001` = "census_table",
                           `2012` = "abstract", `2024` = "census_table")
wave_source <- c(`1981` = "Statistical Abstract 2023 Table 2.14",
                 `2001` = "Census 2001 p9p9Religion.pdf (18-district religion table)",
                 `2012` = "Statistical Abstract 2023 Table 2.14",
                 `2024` = "Census 2024 Preliminary Report Table A3")

# return the verbatim source labels (named by stable code) for one wave.
labels_for_wave <- function(year) {
  if (wave_label_convention[[as.character(year)]] == "abstract") labels_abstract else labels_census_table
}

# --- wave data (transcribed from the cached DCS tables; every array is in the stable
#     column order total, buddhist, hindu, islam, roman_catholic, other_christian, other) ----

# 1981: Statistical Abstract 2023 Table 2.14 (24 districts; Kilinochchi did not yet exist).
data_1981 <- rbind(
  colombo      = c(1699241, 1196964,  130215,  168863,  159947,  40598,  2654),
  gampaha      = c(1390862,  989212,   26750,   48117,  313352,  12563,   868),
  kalutara     = c( 829704,  699613,   37035,   62659,   27697,   2424,   276),
  kandy        = c(1048317,  771435,  132943,  115941,   20067,   7498,   433),
  matale       = c( 357354,  281004,   41352,   26265,    7443,   1202,    88),
  nuwara_eliya = c( 603577,  251247,  303571,   14902,   28382,   5312,   163),
  galle        = c( 814531,  767661,   15086,   26301,    3586,   1452,   445),
  matara       = c( 643786,  608714,   15356,   16670,    2026,    818,   202),
  hambantota   = c( 424344,  411919,    2174,    9408,     542,    174,   127),
  jaffna       = c( 830552,    5104,  705705,   14844,   95613,   9153,   133),
  mannar       = c( 106235,    3363,   28885,   29161,   43633,   1056,   137),
  vavuniya     = c(  95428,   15754,   65574,    6740,    6493,    845,    22),
  mullaitivu   = c(  77189,    1060,   60117,    3789,   11735,    476,    12),
  batticaloa   = c( 330333,    9127,  218812,   78810,   19704,   3795,    85),
  ampara       = c( 388970,  145687,   72809,  162140,    5643,   2387,   304),
  trincomalee  = c( 255948,   82602,   80843,   76404,   14303,   1280,   516),
  kurunegala   = c(1211801, 1092128,   15133,   64112,   36340,   3641,   447),
  puttalam     = c( 492533,  236241,   18997,   50351,  184555,   2082,   307),
  anuradhapura = c( 587929,  530008,    6843,   42999,    6949,    939,   191),
  polonnaruwa  = c( 261563,  235758,    4781,   17090,    3471,    351,   112),
  badulla      = c( 640952,  440755,  156037,   29317,   11529,   3081,   233),
  moneragala   = c( 273570,  253576,   12778,    5584,    1224,    314,    94),
  ratnapura    = c( 797087,  675785,   92156,   15576,   11107,   2188,   275),
  kegalle      = c( 684944,  583611,   53854,   35672,    8372,   3225,   210)
)

# 2001: standalone p9p9Religion.pdf, the 18 districts enumerated completely.
data_2001 <- rbind(
  colombo      = c(2251274, 1578246,  194743,  241944,  181920,  51334,  3087),
  gampaha      = c(2063684, 1479955,   42356,   93496,  418286,  28361,  1230),
  kalutara     = c(1066239,  883968,   34678,  105957,   36176,   5038,   422),
  kandy        = c(1279028,  937001,  134438,  173590,   23232,  10330,   437),
  matale       = c( 441328,  348762,   42433,   39980,    8400,   1703,    50),
  nuwara_eliya = c( 703610,  279139,  359135,   19099,   35008,  10741,   488),
  galle        = c( 990487,  932331,   14934,   35100,    4568,   3378,   176),
  matara       = c( 761370,  716710,   17339,   22481,    2703,   2001,   136),
  hambantota   = c( 526414,  509987,    1369,   13076,     924,    949,   109),
  ampara       = c( 592997,  235652,  100213,  245179,    7816,   3969,   168),
  kurunegala   = c(1460215, 1300539,   13303,   98223,   40680,   6960,   510),
  puttalam     = c( 709677,  308273,   29482,  134643,  229966,   6830,   483),
  anuradhapura = c( 745693,  670963,    3459,   62797,    6266,   2073,   135),
  polonnaruwa  = c( 358984,  320491,    6592,   27225,    3883,    691,   102),
  badulla      = c( 779983,  561510,  158473,   41347,   13236,   5242,   175),
  moneragala   = c( 397375,  375252,   11623,    8183,    1583,    681,    53),
  ratnapura    = c(1015807,  880151,   96738,   21901,   11728,   4924,   365),
  kegalle      = c( 785524,  667618,   51662,   51675,    9365,   4977,   227)
)

# 2001 estimated totals for the seven unenumerated districts (Table 2.14, footnote (1) "Estimates").
# religion is not enumerated for these districts; only the estimated total population is printed.
estimate_2001_total <- c(jaffna = 490621L, mannar = 151577L, vavuniya = 149835L,
                         mullaitivu = 121667L, kilinochchi = 127263L, batticaloa = 486447L,
                         trincomalee = 340158L)
estimate_2001_national <- 18797257L  # DCS national estimate marked (1); religion is "..".

# 2012: Statistical Abstract 2023 Table 2.14 (25 districts, full coverage).
data_2012 <- rbind(
  colombo      = c(2324349, 1632225,  186454,  274087,  162314,  66994,  2275),
  gampaha      = c(2304833, 1642767,   52973,  112746,  449398,  46080,   869),
  kalutara     = c(1221948, 1018909,   39541,  114556,   39774,   8956,   212),
  kandy        = c(1375382, 1009220,  133744,  197076,   22379,  12798,   165),
  matale       = c( 484531,  385151,   43432,   45682,    7899,   2342,    25),
  nuwara_eliya = c( 711644,  278254,  363163,   21116,   33476,  15508,   127),
  galle        = c(1063334,  998647,   15584,   39267,    4415,   5315,   106),
  matara       = c( 814048,  766323,   16421,   25614,    2432,   3208,    50),
  hambantota   = c( 599903,  580344,    1222,   15204,    1139,   1692,   302),
  jaffna       = c( 583882,    2168,  483255,    2363,   75474,  20511,   111),
  mannar       = c(  99570,    1809,   24027,   16512,   52415,   4790,    17),
  vavuniya     = c( 172115,   16853,  119401,   11972,   15305,   8498,    86),
  mullaitivu   = c(  92238,    8185,   69377,    1880,    9063,   3664,    69),
  kilinochchi  = c( 113510,    1275,   92986,     700,   12063,   6436,    50),
  batticaloa   = c( 526567,    6281,  338882,  134065,   24454,  22833,    52),
  ampara       = c( 649402,  251427,  102829,  281987,    7588,   5541,    30),
  trincomalee  = c( 379541,   99344,   98442,  159418,   14493,   7774,    70),
  kurunegala   = c(1618465, 1431632,   14721,  118305,   43711,   9926,   170),
  puttalam     = c( 762396,  329705,   28811,  150404,  240221,  12093,  1162),
  anuradhapura = c( 860575,  775366,    3231,   71493,    6747,   3660,    78),
  polonnaruwa  = c( 406088,  364229,    6886,   30465,    3192,   1276,    40),
  badulla      = c( 815405,  591799,  157608,   47192,   12020,   6615,   171),
  moneragala   = c( 451058,  426762,   11997,    9809,    1601,    859,    30),
  ratnapura    = c(1088007,  943464,  101962,   24446,   10844,   7212,    79),
  kegalle      = c( 840648,  709917,   54350,   61164,    8777,   6386,    54)
)

# 2024: Census 2024 Preliminary Report Table A3 (25 districts, full coverage).
data_2024 <- rbind(
  colombo      = c(2375415, 1682524,  197759,  298422,  139882,  55624,  1204),
  gampaha      = c(2436142, 1744475,   69429,  134422,  442291,  44540,   985),
  kalutara     = c(1305784, 1080638,   42528,  138230,   36510,   7733,   145),
  kandy        = c(1461895, 1063511,  144618,  223997,   18623,  10919,   227),
  matale       = c( 526870,  418608,   46181,   52224,    7797,   2026,    34),
  nuwara_eliya = c( 725280,  278828,  377266,   21929,   31705,  15474,    78),
  galle        = c(1097372, 1026031,   15600,   46038,    4207,   5377,   119),
  matara       = c( 837889,  787303,   14625,   29858,    2445,   3619,    39),
  hambantota   = c( 671418,  649736,    1401,   17947,    1017,   1247,    70),
  jaffna       = c( 594751,    2788,  489521,    4352,   77197,  20857,    36),
  mannar       = c( 123756,     382,   26214,   33883,   57713,   5560,     4),
  vavuniya     = c( 172312,   18292,  114504,   17775,   12785,   8895,    61),
  mullaitivu   = c( 122619,   10293,   88738,    3279,   13982,   6315,    12),
  kilinochchi  = c( 136710,    1533,  110258,    1394,   14446,   9074,     5),
  batticaloa   = c( 595918,    6024,  374836,  161494,   25803,  27728,    33),
  ampara       = c( 744551,  276176,  114586,  339896,    7351,   6486,    56),
  trincomalee  = c( 442745,  106919,  108050,  205664,   14353,   7714,    45),
  kurunegala   = c(1768156, 1557554,   17487,  143299,   40273,   9413,   130),
  puttalam     = c( 818816,  361148,   28832,  176963,  240975,  10619,   279),
  anuradhapura = c( 960080,  862807,    3755,   83979,    5760,   3656,   123),
  polonnaruwa  = c( 447530,  399488,    7215,   37097,    2560,   1086,    84),
  badulla      = c( 872307,  636988,  166380,   53563,    9593,   5729,    54),
  moneragala   = c( 527585,  498436,   14974,   12262,    1181,    713,    19),
  ratnapura    = c(1145423,  999682,  103883,   26796,    8607,   6394,    61),
  kegalle      = c( 870476,  728929,   56199,   72616,    7292,   5387,    53)
)

wave_data <- list(`1981` = data_1981, `2001` = data_2001, `2012` = data_2012, `2024` = data_2024)

# national anchors printed by DCS, in the stable column order (total then the six categories).
national_anchor <- list(
  `1981` = c(14846750, 10288328, 2297806, 1121715, 1023713, 106854, 8334),
  `2001` = c(16929689, 12986548, 1312970, 1435896, 1035740, 150182, 8353),  # 18-district total
  `2012` = c(20359439, 14272056, 2561299, 1967523, 1261194, 290967, 6400),
  `2024` = c(21781800, 15199093, 2734839, 2337379, 1224348, 282185, 3956)
)

# --- reconciliation gates (fail-fast; stop, do not tune) --------------------

# validate one wave: within-row totals, the published-district count, and exact national reconciliation.
validate_wave <- function(year) {
  mat <- wave_data[[as.character(year)]]
  colnames(mat) <- c("total", category_codes)
  # every printed district: total must equal the sum of the six categories.
  row_sums <- rowSums(mat[, category_codes, drop = FALSE])
  bad <- rownames(mat)[row_sums != mat[, "total"]]
  if (length(bad)) stop("within-row total != sum(categories) for ", year, ": ", paste(bad, collapse = ", "), call. = FALSE)
  # published-district count matches the source.
  expected_n <- if (year == 1981L) 24L else if (year == 2001L) 18L else 25L
  if (nrow(mat) != expected_n) stop("wave ", year, " has ", nrow(mat), " districts, expected ", expected_n, call. = FALSE)
  # column sums reconcile exactly to the printed national anchor.
  col_sums <- c(total = sum(mat[, "total"]), colSums(mat[, category_codes, drop = FALSE]))
  anchor <- national_anchor[[as.character(year)]]
  names(anchor) <- c("total", category_codes)
  diff <- col_sums - anchor
  if (any(diff != 0L)) {
    stop("national reconciliation failed for ", year, ": ",
         paste(names(diff)[diff != 0L], collapse = ", "), call. = FALSE)
  }
  list(
    year = year,
    published_districts = nrow(mat),
    within_row_total_reconciliation = "exact",
    national_reconciliation = "exact",
    national_total = unname(anchor["total"]),
    national_by_category = as.list(anchor[category_codes]),
    reconciliation_residual = as.list(diff)
  )
}

# validate the exact 1:1 label-convention correspondence across the two DCS conventions.
validate_label_correspondence <- function() {
  if (!identical(names(labels_abstract), category_codes) ||
      !identical(names(labels_census_table), category_codes)) {
    stop("label conventions are not both keyed by the six stable category codes", call. = FALSE)
  }
  if (length(labels_abstract) != 6L || length(labels_census_table) != 6L) {
    stop("a label convention does not carry exactly six categories", call. = FALSE)
  }
  if (anyDuplicated(labels_abstract) || anyDuplicated(labels_census_table)) {
    stop("a label convention has duplicate labels; 1:1 correspondence broken", call. = FALSE)
  }
  setNames(lapply(category_codes, function(code) {
    list(stable_code = code, abstract_label = unname(labels_abstract[code]),
         census_table_label = unname(labels_census_table[code]))
  }), category_codes)
}

reconciliation <- setNames(lapply(years, validate_wave), as.character(years))
label_correspondence <- validate_label_correspondence()

# --- boundary: dissolve geoBoundaries ADM3 (330 DSD) -> 25 districts ---------

# calculate one geometry hash without serialisation metadata.
geometry_hash <- function(geometry) {
  digest(st_as_binary(st_sfc(geometry), EWKB = TRUE)[[1]], algo = "sha256", serialize = FALSE)
}

# assign each ADM3 Divisional Secretariat to a district by largest ADM2 overlap, then union per district.
build_boundary <- function() {
  adm3_meta <- fromJSON(path_adm3_meta, simplifyVector = TRUE)
  adm2_meta <- fromJSON(path_adm2_meta, simplifyVector = TRUE)
  if (as.integer(adm3_meta[["admUnitCount"]]) != 330L) stop("geoBoundaries LKA ADM3 release count changed", call. = FALSE)
  if (as.integer(adm2_meta[["admUnitCount"]]) != 25L) stop("geoBoundaries LKA ADM2 release count changed", call. = FALSE)

  adm3 <- st_make_valid(st_read(path_adm3, quiet = TRUE))
  adm2 <- st_make_valid(st_read(path_adm2, quiet = TRUE))
  if (nrow(adm3) != 330L) stop("ADM3 layer does not carry 330 Divisional Secretariats", call. = FALSE)
  if (nrow(adm2) != 25L) stop("ADM2 layer does not carry 25 districts", call. = FALSE)

  adm2[["district_label"]] <- sub(" District$", "", as.character(adm2[["shapeName"]]))
  if (!setequal(adm2[["district_label"]], districts[["adm2_name"]])) {
    stop("geoBoundaries ADM2 district names do not match the 25-district frame", call. = FALSE)
  }
  # map each ADM2 district label to the stable code.
  adm2_to_code <- setNames(districts[["code"]], districts[["adm2_name"]])
  adm2[["code"]] <- unname(adm2_to_code[adm2[["district_label"]]])

  # largest-intersection-area assignment in a metric CRS.
  adm3_m <- st_transform(adm3, 3857)
  adm2_m <- st_transform(adm2, 3857)
  hits <- st_intersects(adm3_m, adm2_m)
  assigned <- vapply(seq_len(nrow(adm3_m)), function(i) {
    cand <- hits[[i]]
    if (length(cand) == 0L) stop("ADM3 feature ", i, " intersects no district", call. = FALSE)
    if (length(cand) == 1L) return(adm2_m[["code"]][cand])
    areas <- vapply(cand, function(j) {
      inter <- suppressWarnings(st_area(st_intersection(adm3_m[i, ], adm2_m[j, ])))
      if (length(inter) == 0L) 0 else as.numeric(sum(inter))
    }, numeric(1))
    adm2_m[["code"]][cand[which.max(areas)]]
  }, character(1))
  adm3[["code"]] <- assigned
  if (anyNA(adm3[["code"]])) stop("a Divisional Secretariat was left unassigned", call. = FALSE)
  if (!setequal(unique(adm3[["code"]]), district_codes)) {
    stop("Divisional Secretariat assignment did not cover exactly the 25 districts", call. = FALSE)
  }

  dissolved <- aggregate(adm3["code"], by = list(code = adm3[["code"]]),
                         FUN = function(x) x[1], do_union = TRUE)
  dissolved <- st_make_valid(dissolved[, "code"])
  if (nrow(dissolved) != 25L || !setequal(dissolved[["code"]], district_codes)) {
    stop("dissolve did not yield exactly 25 districts (the BS trap)", call. = FALSE)
  }
  name_by_code <- setNames(districts[["area_name"]], districts[["code"]])
  dissolved[["area_code"]] <- dissolved[["code"]]
  dissolved[["area_name"]] <- unname(name_by_code[dissolved[["code"]]])
  dissolved[["area_unit_id"]] <- paste(boundary_set_id, dissolved[["code"]], sep = ":")
  dissolved[["boundary_set_id"]] <- boundary_set_id
  dissolved[["boundary_level"]] <- boundary_level
  dissolved[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(dissolved, 6933))) / 1e6
  dissolved <- st_transform(dissolved, 4326)
  dissolved <- dissolved[order(dissolved[["area_code"]]),
                         c("area_code", "area_name", "area_unit_id", "boundary_set_id",
                           "boundary_level", "land_area_sq_km", "geometry")]

  dsd_per_district <- as.list(table(assigned)[district_codes])
  list(layer = dissolved, adm3_meta = adm3_meta, adm2_meta = adm2_meta, dsd_per_district = dsd_per_district)
}

# simplify the dissolved boundary to a byte cap and enforce valid, distinct features.
write_boundary <- function(boundary) {
  simplification <- mapshaper_simplify_to_cap(
    boundary, boundary_out, max_bytes = 1800000,
    keep_percentages = c(100, 75, 50, 25, 15, 10, 7.5, 5, 3, 2, 1),
    clean_option = "allow-overlaps"
  )
  written <- st_read(boundary_out, quiet = TRUE)
  validity <- st_is_valid(written)
  if (nrow(written) != 25L || any(st_is_empty(written)) || any(is.na(validity)) || any(!validity)) {
    stop("simplified boundary did not retain 25 valid features", call. = FALSE)
  }
  if (!setequal(written[["area_code"]], district_codes)) stop("district codes changed during simplification", call. = FALSE)
  hashes <- vapply(st_geometry(written), geometry_hash, character(1))
  if (length(unique(hashes)) != 25L) stop("district geometry hashes are not distinct", call. = FALSE)
  simplification[["byte_ceiling"]] <- 1800000L
  list(layer = written, simplification = simplification, valid_feature_count = sum(validity),
       geometry_hashes = setNames(as.list(hashes), written[["area_code"]]))
}

# --- row assembly -----------------------------------------------------------

# describe the population basis for one wave and district.
population_basis <- function(year, code) {
  base <- paste0("DCS Census ", year, " district population; ", wave_source[[as.character(year)]],
                 ". Percentages use the district total religion population. ")
  if (year == 2001L && code %in% names(estimate_2001_total)) {
    return(paste0(base, "This district was not enumerated for religion in 2001; the value is the DCS estimated total population marked (1) Estimates. ",
                  coverage_2001_footnote_verbatim))
  }
  if (year == 1981L && code == "kilinochchi") {
    return(paste0("Kilinochchi district did not exist at the 1981 census (carved from Jaffna in 1984); no 1981 population is published for it. ",
                  "Its 1981 territory is counted inside Jaffna's 1981 row."))
  }
  paste0(base, scope_note)
}

# build one schema-conforming district-year row.
build_row <- function(year, code, boundary) {
  mat <- wave_data[[as.character(year)]]
  colnames(mat) <- c("total", category_codes)
  labels <- labels_for_wave(year)
  area <- boundary[boundary[["area_code"]] == code, ]
  land_area <- round(area[["land_area_sq_km"]][[1]], 4)
  unit_id <- area[["area_unit_id"]][[1]]
  disp_name <- area[["area_name"]][[1]]

  enumerated <- code %in% rownames(mat)
  is_2001_estimate <- year == 2001L && code %in% names(estimate_2001_total)
  is_1981_kilinochchi <- year == 1981L && code == "kilinochchi"

  # category-breakdown record for the quality flag, using the wave's verbatim label convention.
  if (enumerated) {
    counts <- mat[code, category_codes]
    total <- as.integer(mat[code, "total"])
    breakdown <- paste(vapply(category_codes, function(cc) {
      paste0(labels[[cc]], "=", counts[[cc]])
    }, character(1)), collapse = ";")
    affiliation_count <- as.integer(sum(counts))  # the six categories partition the total
    affiliation_percent <- round(100 * affiliation_count / total, 4)
    flag <- paste0(
      "full_enumeration_census_religion;six_category_partition;no_no_religion_or_not_stated_category;",
      "affiliation=total_all_six_named_categories;label_convention=", wave_label_convention[[as.character(year)]],
      ";source_categories_verbatim=", breakdown, ";exact_within_row_and_national_reconciliation;",
      "district_counts_rendered_as_published_no_small_cell_treatment"
    )
  } else if (is_2001_estimate) {
    total <- as.integer(estimate_2001_total[[code]])
    affiliation_count <- NA_integer_
    affiliation_percent <- NA_real_
    flag <- paste0(
      "religion_not_enumerated_2001;dcs_estimated_total_population_only;coverage_gap_render_the_record;",
      "footnote_verbatim=", coverage_2001_footnote_verbatim,
      ";religion_null_never_estimated_never_distributed;change_metrics_break_at_2001_for_this_district"
    )
  } else if (is_1981_kilinochchi) {
    total <- NA_integer_
    affiliation_count <- NA_integer_
    affiliation_percent <- NA_real_
    flag <- paste0(
      "district_did_not_exist_1981;carved_from_jaffna_1984;territory_included_in_jaffna_1981_row;",
      "boundary_mismatch_disclosed;religion_and_total_null_no_split_invented"
    )
  } else {
    stop("unexpected non-enumerated case for ", year, " ", code, call. = FALSE)
  }

  # Jaffna 1981 carries the folded-in Kilinochchi territory; disclose per row.
  if (year == 1981L && code == "jaffna") {
    flag <- paste0(flag, ";jaffna_1981_row_covers_present_day_jaffna_plus_kilinochchi")
  }

  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = unit_id,
    area_code = code,
    area_name = disp_name,
    year = year,
    population_total = if (is.na(total)) NULL else as.integer(total),
    population_total_basis = population_basis(year, code),
    religious_affiliation_count = if (is.na(affiliation_count)) NULL else affiliation_count,
    religious_affiliation_percent = if (is.na(affiliation_percent)) NULL else affiliation_percent,
    no_religion_count = NULL,
    no_religion_percent = NULL,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = land_area,
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = as.list(c(census_dataset_id, boundary_dataset_id)),
    quality_flag = flag
  )
}

# flatten row objects into the CSV companion shape.
flatten_rows <- function(rows) {
  na_int <- function(x) if (is.null(x)) NA_integer_ else as.integer(x)
  na_num <- function(x) if (is.null(x)) NA_real_ else as.numeric(x)
  data.frame(
    country_code = vapply(rows, `[[`, character(1), "country_code"),
    boundary_set_id = vapply(rows, `[[`, character(1), "boundary_set_id"),
    boundary_level = vapply(rows, `[[`, character(1), "boundary_level"),
    area_unit_id = vapply(rows, `[[`, character(1), "area_unit_id"),
    area_code = vapply(rows, `[[`, character(1), "area_code"),
    area_name = vapply(rows, `[[`, character(1), "area_name"),
    year = vapply(rows, `[[`, integer(1), "year"),
    population_total = vapply(rows, function(r) na_int(r[["population_total"]]), integer(1)),
    population_total_basis = vapply(rows, `[[`, character(1), "population_total_basis"),
    religious_affiliation_count = vapply(rows, function(r) na_int(r[["religious_affiliation_count"]]), integer(1)),
    religious_affiliation_percent = vapply(rows, function(r) na_num(r[["religious_affiliation_percent"]]), numeric(1)),
    no_religion_count = NA_integer_,
    no_religion_percent = NA_real_,
    place_count = NA_integer_,
    places_per_10000_residents = NA_real_,
    place_density_per_sq_km = NA_real_,
    land_area_sq_km = vapply(rows, `[[`, numeric(1), "land_area_sq_km"),
    site_snapshot_date = NA_character_,
    place_count_basis = NA_character_,
    source_dataset_ids = vapply(rows, function(r) paste(unlist(r[["source_dataset_ids"]]), collapse = "|"), character(1)),
    quality_flag = vapply(rows, `[[`, character(1), "quality_flag"),
    stringsAsFactors = FALSE
  )
}

# return a row or feature count for one generated artefact.
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$", path)) return(nrow(st_read(path, quiet = TRUE)))
  object <- fromJSON(path, simplifyVector = FALSE)
  if (!is.null(object[["rows"]])) return(length(object[["rows"]]))
  NA_integer_
}

# --- indicators, layers, datasets, manifest pieces --------------------------

temporal_cov <- "DCS censuses of population and housing 1981, 2001, 2012, and 2024."
spatial_cov <- paste("Twenty-five districts on the modern (2012/2024) frame.", scope_note)
quality_cov <- paste("Census religion is a self-identification question with a six-category frame and no no-religion or not-stated option.",
                     sensitivity_note, boundary_note)

indicators <- function() {
  list(
    list(indicator_id = "population_total", label = "Census religion-table population",
         description = paste("DCS published district total for the wave.", scope_note),
         unit = "count", denominator_indicator_id = NULL,
         method = "Direct DCS table value; for enumerated districts the total equals the sum of the six religion categories.",
         temporal_coverage = temporal_cov, spatial_coverage = spatial_cov, quality_notes = quality_cov),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
         description = paste("Share of the district population counted in the six DCS religion categories.",
                             "The DCS census assigns every enumerated person to one of the six religions; there is no no-religion or not-stated category, so this share is the full enumerated population where religion was counted."),
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 times the sum of the six religion categories divided by the district total; null where religion was not enumerated (the seven 2001 districts) or the district did not exist (Kilinochchi 1981).",
         temporal_coverage = temporal_cov, spatial_coverage = spatial_cov, quality_notes = quality_cov),
    list(indicator_id = "no_religion_percent", label = "No religion %",
         description = "The DCS census religion frame has no no-religion category; this indicator is documented as absent and rows carry null no-religion values.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "Not applicable; no_religion_category_absent.",
         temporal_coverage = temporal_cov, spatial_coverage = spatial_cov, quality_notes = "Rows carry no_religion_category_absent and null no_religion_count/no_religion_percent.")
  )
}

visual_layers <- function() {
  list(
    list(visual_layer_id = "lk-district-religious-affiliation",
         label = "Religious affiliation %",
         description = "Share of the district population in the six DCS religion categories, for 1981, 2001 (18 enumerated districts), 2012, and 2024.",
         layer_type = "choropleth", indicator_ids = list("religious_affiliation_percent"),
         geometry_unit_type = "area_unit", legend = list(unit = "percent", denominator = "district total religion population"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "district counts rendered as published; no allocation; the seven 2001 districts and Kilinochchi 1981 carry null religion",
         uncertainty_display = "quality_flag", default_visibility = TRUE, notes = paste(scope_note, sensitivity_note))
  )
}

source_datasets <- function() {
  list(
    list(source_dataset_id = census_dataset_id,
         name = "DCS census religion by district, 1981, 2001, 2012 (Statistical Abstract 2023 Table 2.14; 2001 detail from p9p9Religion.pdf) and 2024 (Preliminary Report Table A3)",
         provider = "Department of Census and Statistics, Sri Lanka (DCS)",
         url = url_214, retrieval_date = retrieval_date, local_path = path_214,
         licence = list(name = paste0("DCS asserts all rights reserved (verbatim site footer: \"", dcs_copyright_verbatim, "\"); no open-data licence located."),
                        url = url_terms, attribution = "Source: Department of Census and Statistics, Sri Lanka"),
         citation = "DCS, Census of Population and Housing 1981, 2001, 2012 (Statistical Abstract 2023, Tables 2.13-2.15) and 2024 (Population Preliminary Report).",
         access_limits = NULL,
         redistribution_limits = "DCS reserves all rights. The build ships derived summaries with DCS attribution and holds raw sources git-ignored; a reuse ruling is deferred to the PI (task 14).",
         notes = paste(scope_note, label_note)),
    list(source_dataset_id = boundary_dataset_id,
         name = "geoBoundaries LKA ADM3 (Divisional Secretariat) dissolved to 25 districts",
         provider = "geoBoundaries; OCHA ROAP / Survey Department of Sri Lanka",
         url = url_adm3, retrieval_date = retrieval_date, local_path = path_adm3,
         licence = list(name = "Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO)",
                        url = "https://www.geoboundaries.org/",
                        attribution = "Boundary source: OCHA ROAP / Survey Department of Sri Lanka, via geoBoundaries; CC BY 3.0 IGO"),
         citation = "geoBoundaries gbOpen LKA ADM3, boundary ID LKA-ADM3-8540358, represented year 2020.",
         access_limits = NULL,
         redistribution_limits = "CC BY 3.0 IGO; attribution required.",
         notes = boundary_note)
  )
}

# describe one tracked public output in the manifest.
manifest_file_record <- function(path, content, licence_basis) {
  list(uri = paste0("repo:", path), storage_provider = "git_repository", format = tools::file_ext(path),
       bytes = file_bytes(path), sha256 = sha256_file(path), row_count = row_count_file(path),
       content = content, privacy = "public", licence_status = "needs_review", licence_basis = licence_basis)
}

# describe one raw cached source with URL, retrieval time, and digest.
raw_source_record <- function(path, url, format, source_dataset_id, notes) {
  meta <- read_meta(path)
  list(uri = path, url = url, retrieval_date = substr(meta[["retrieved_at"]], 1L, 10L), retrieved_at = meta[["retrieved_at"]],
       http_status = meta[["http_status"]], format = format, bytes = file_bytes(path), sha256 = sha256_file(path),
       source_dataset_id = source_dataset_id, used_in_public_product = TRUE, notes = notes)
}

# --- run --------------------------------------------------------------------

fetch_file(url_214, path_214)
fetch_file(url_p9p9, path_p9p9)
fetch_file(url_2024, path_2024)
fetch_file(url_terms, path_terms)
fetch_file(url_adm3_meta, path_adm3_meta)
fetch_file(url_adm2_meta, path_adm2_meta)
fetch_file(url_adm3, path_adm3)
fetch_file(url_adm2, path_adm2)

# source-integrity gates: the transcription anchors must be present in the cached PDFs.
assert_pdf_contains(path_214, c(
  "Population by religion and district, Census 1981, 2001, 2012",
  coverage_2001_footnote_verbatim, "14,846,750", "20,359,439"))
assert_pdf_contains(path_p9p9, c("Total (18 districts)", "16,929,689"))
assert_pdf_contains(path_2024, c("Population by religion according to districts, 2024", "21,781,800"))

boundary_built <- build_boundary()
boundary_result <- write_boundary(boundary_built[["layer"]])
written_boundary <- boundary_result[["layer"]]

rows <- unlist(lapply(years, function(y) {
  lapply(district_codes, function(cd) build_row(y, cd, written_boundary))
}), recursive = FALSE)
if (length(rows) != 100L) stop("expected 100 district-year rows", call. = FALSE)

area_summary <- list(
  schema_version = "0.2.0",
  generated_at = stamp,
  generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code, level = boundary_level,
                      vintage = boundary_vintage, source_dataset_id = boundary_dataset_id),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "No governed Sri Lanka place-of-worship snapshot is included in this census-religion release.",
                       notes = paste("The product ships census-religion metrics and district geometry only; place-density fields are null.", scope_note)),
  source_datasets = source_datasets(),
  indicators = indicators(),
  visual_layers = visual_layers(),
  rows = rows
)
write_json(area_summary, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

raw_sources <- list(
  raw_source_record(path_214, url_214, "pdf", census_dataset_id, "Statistical Abstract 2023 Table 2.14: district religion counts for 1981, 2001, 2012 with the 2001 coverage footnote."),
  raw_source_record(path_p9p9, url_p9p9, "pdf", census_dataset_id, "Census 2001 standalone religion table: 18-district counts and percentages; used for the 2001 wave detail."),
  raw_source_record(path_2024, url_2024, "pdf", census_dataset_id, "Census 2024 Population Preliminary Report; Table A3 gives district religion counts."),
  raw_source_record(path_terms, url_terms, "html", census_dataset_id, "DCS homepage; footer carries the verbatim all-rights-reserved copyright."),
  raw_source_record(path_adm3_meta, url_adm3_meta, "json", boundary_dataset_id, "geoBoundaries LKA ADM3 release metadata (CC BY 3.0 IGO, 330 Divisional Secretariats, year 2020)."),
  raw_source_record(path_adm2_meta, url_adm2_meta, "json", boundary_dataset_id, "geoBoundaries LKA ADM2 release metadata (ODbL, 25 districts); used only for the district-assignment key."),
  raw_source_record(path_adm3, url_adm3, "geojson", boundary_dataset_id, "geoBoundaries LKA ADM3 GeoJSON dissolved to 25 districts in the build."),
  raw_source_record(path_adm2, url_adm2, "geojson", boundary_dataset_id, "geoBoundaries LKA ADM2 GeoJSON; supplies the 25-district assignment key for the ADM3 dissolve.")
)

# category correspondence record for the manifest (verbatim labels per wave).
category_mapping_by_wave <- setNames(lapply(years, function(y) {
  labels <- labels_for_wave(y)
  list(
    year = y, source_table = wave_source[[as.character(y)]], label_convention = wave_label_convention[[as.character(y)]],
    categories = setNames(lapply(category_codes, function(cc) unname(labels[cc])), category_codes)
  )
}), as.character(years))

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = "manifest:lk-census-religion:lk:1981-2024:dcs-district",
  dataset_id = "lk-census-religion:lk:1981-2024:dcs-district",
  dataset_version_id = paste0("lk-census-religion:lk:1981-2024:dcs-district:", substr(sha256_file(summary_json_out), 1L, 12L)),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "lk-census-religion",
  dataset_role = "public_product",
  scope = list(level = "country", country_codes = list(country_code), snapshot_date = NULL, snapshot_anchor = NULL, pipeline_stage = "staged"),
  created_at = stamp,
  created_by = script_id,
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      waves = years,
      geography = "25 districts on the modern (2012/2024) frame; ADM3 Divisional Secretariats dissolved to districts via largest-ADM2-overlap assignment",
      construct = "census religion (six-category self-identification, no no-religion or not-stated option)",
      denominator = "district total religion population",
      category_rule = "six stable categories rendered exactly as published; affiliation is the full six-category total where religion was enumerated",
      category_label_conventions = list(
        abstract = as.list(labels_abstract), census_table = as.list(labels_census_table),
        correspondence = label_correspondence, by_wave = category_mapping_by_wave),
      coverage_2001 = paste("Religion enumerated for 18 of 25 districts; seven districts carry the DCS estimated total and null religion.", coverage_2001_footnote_verbatim),
      kilinochchi_1981_treatment = "Kilinochchi did not exist in 1981 (carved from Jaffna 1984); its 1981 row is null with population and religion null, and Jaffna's printed 1981 row (830,552) covers present-day Jaffna plus Kilinochchi. No split invented; boundary mismatch disclosed per row.",
      sensitivity = sensitivity_note,
      small_cell_treatment = "none at district level; district exact counts rendered as published (no official DCS suppression rule).",
      territorial_scope = scope_note,
      boundary_source = boundary_note,
      dsd_per_district = boundary_built[["dsd_per_district"]],
      boundary_simplification = boundary_result[["simplification"]],
      local_cache_hint = "Raw DCS sources, terms, and geoBoundaries geometry are cached under data/raw/lk_census/ and remain git-ignored.",
      raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/lk_census/ (13 objects mirrored 2026-07-11)"),
      retrieval_routes = list(
        list(purpose = "1981/2001/2012 district religion counts", method = "GET", url = url_214, notes = "Statistical Abstract 2023 Table 2.14."),
        list(purpose = "2001 18-district religion detail", method = "GET", url = url_p9p9, notes = "Standalone 2001 religion table."),
        list(purpose = "2024 district religion counts", method = "GET", url = url_2024, notes = "Preliminary Report Table A3."),
        list(purpose = "boundary (ADM3)", method = "GET", url = url_adm3, notes = "geoBoundaries LKA ADM3 GeoJSON."),
        list(purpose = "district-assignment key (ADM2)", method = "GET", url = url_adm2, notes = "geoBoundaries LKA ADM2 GeoJSON.")
      )
    ),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")), jsonlite = as.character(packageVersion("jsonlite")),
      digest = as.character(packageVersion("digest")),
      mapshaper = "npx mapshaper through scripts/lib/simplify_boundary.R", pdftotext = "Poppler pdftotext command-line utility"
    )
  ),
  source = list(
    provider = "Department of Census and Statistics, Sri Lanka (DCS); geoBoundaries (OCHA ROAP / Survey Department of Sri Lanka)",
    source_dataset_ids = list(census_dataset_id, boundary_dataset_id),
    source_urls = list(url_214, url_p9p9, url_2024, url_terms, url_adm3_meta, url_adm2_meta, url_adm3, url_adm2),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = paste0("DCS census: site footer asserts all rights reserved (verbatim: \"", dcs_copyright_verbatim, "\"); no open licence located; derived summaries ship with attribution, reuse ruling deferred to the PI (task 14). Boundary: geoBoundaries ADM3 under CC BY 3.0 IGO (Survey Department lineage)."),
    citation = "DCS census religion by district 1981/2001/2012 (Statistical Abstract 2023 Table 2.14; 2001 detail p9p9Religion.pdf), 2024 (Preliminary Report Table A3); geoBoundaries LKA ADM3 dissolved to 25 districts.",
    raw_redistribution = "Raw DCS files stay git-ignored; only derived summaries are published. Cached under data/raw/lk_census/, mirrored to gs://pow-research-data/raw_sources/lk_census/.",
    licence_position = "needs_review"
  ),
  input_manifests = list(),
  durable_files = list(
    manifest_file_record(summary_json_out, "Sri Lanka district census-religion summary for 1981, 2001, 2012, and 2024 on the 25-district frame.", "dcs_all_rights_reserved_attribution"),
    manifest_file_record(summary_csv_out, "Flattened Sri Lanka district census-religion rows.", "dcs_all_rights_reserved_attribution"),
    manifest_file_record(boundary_out, "geoBoundaries LKA ADM3 dissolved to the 25 districts, simplified.", "cc_by_3_0_igo_attribution")
  ),
  raw_sources = raw_sources,
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id, notes = "100 district-year rows (25 districts x 4 waves)."),
    list(uri = paste0("repo:", summary_csv_out), sha256 = sha256_file(summary_csv_out), built_by = script_id, notes = "CSV companion."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out), built_by = script_id, notes = "25 simplified district features.")
  ),
  target_years = years,
  validation = list(
    status = "passed_with_warnings",
    commands = list(
      "Rscript scripts/build_lk_area_summary.R",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/lk/data/area_summary_district.json",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/data-manifest.schema.json docs/manifests/lk-census-religion-1981-2024.json",
      "bash scripts/validate_manifests.sh"
    ),
    tests = list(
      "Every printed district's total equals the sum of the six religion categories, for all four waves.",
      "District category columns sum exactly to the printed national anchor: 1981 over 24 districts, 2001 over 18 enumerated districts, 2012 and 2024 over 25 districts.",
      "The two DCS label conventions map 1:1 onto the six stable category codes with no duplicate labels.",
      "The seven 2001 unenumerated districts carry the DCS estimated total and null religion with the coverage footnote quoted verbatim.",
      "Kilinochchi 1981 carries null total and null religion; Jaffna 1981 discloses that its row covers present-day Jaffna plus Kilinochchi.",
      "The ADM3 dissolve yields exactly 25 valid, non-empty districts with 25 distinct SHA-256 WKB geometry hashes.",
      "Every raw input and generated output records URL or repository path, retrieval date, byte size, and SHA-256."
    ),
    warnings = list(
      paste0("DCS asserts all rights reserved (verbatim: \"", dcs_copyright_verbatim, "\"). No open-data licence located; licence_status is needs_review pending PI task 14."),
      scope_note, sensitivity_note, boundary_note
    ),
    notes = paste("All four wave reconciliation gates and the label-correspondence gate passed exactly.", scope_note),
    stats = list(
      waves = 4L, rows = 100L, districts_per_wave = 25L,
      enumerated_districts = list(`1981` = 24L, `2001` = 18L, `2012` = 25L, `2024` = 25L),
      category_count = 6L,
      boundary_features = 25L, boundary_valid_features = boundary_result[["valid_feature_count"]],
      distinct_geometry_hashes = length(unique(unlist(boundary_result[["geometry_hashes"]]))),
      adm3_divisional_secretariats = 330L,
      boundary_bytes = file_bytes(boundary_out), summary_json_bytes = file_bytes(summary_json_out), summary_csv_bytes = file_bytes(summary_csv_out)
    ),
    reconciliation = reconciliation,
    boundary_validation = list(
      output_feature_count = 25L, valid_feature_count = boundary_result[["valid_feature_count"]],
      distinct_geometry_hash_count = length(unique(unlist(boundary_result[["geometry_hashes"]]))),
      geometry_sha256_by_code = boundary_result[["geometry_hashes"]],
      dsd_source_count = 330L, dsd_per_district = boundary_built[["dsd_per_district"]],
      source_crs = "EPSG:4326", area_calculation_crs = "EPSG:6933", output_crs = "EPSG:4326"
    )
  ),
  construct_notes = c(list(
    "The construct is census religion. It does not measure belief, practice, attendance, or registered membership.",
    "The DCS census religion question uses six categories and assigns every enumerated person to one of them; there is no no-religion or not-stated category, so religious_affiliation_percent equals 100 wherever religion was enumerated.",
    scope_note, label_note, sensitivity_note, boundary_note,
    coverage_2001_footnote_verbatim,
    "The 2001 wave detail uses the standalone p9p9Religion.pdf table, whose 18-district counts reconcile exactly to its printed 16,929,689 national total; Statistical Abstract Table 2.14 prints only estimated totals with '..' religion for the seven unenumerated districts.",
    "DCS means the Department of Census and Statistics, Sri Lanka. DSD means Divisional Secretariat Division (geoBoundaries ADM3). District means the ADM2/modern administrative district."
  ), lapply(years, function(y) {
    labels <- labels_for_wave(y)
    paste0("Category labels for ", y, " (", wave_source[[as.character(y)]], ", ", wave_label_convention[[as.character(y)]],
           " convention): ", paste(vapply(category_codes, function(cc) paste0(cc, "=", labels[[cc]]), character(1)), collapse = "; "), ".")
  })),
  deferred_sources = list(
    list(source = "DCS 2012 and 2024 Divisional Secretariat (DSD) religion tables",
         status = "finer_level_not_shipped",
         reason = "DSD-level religion exists for 2012 (25 per-district A4 PDFs) and 2024 (Table A7). A DSD-level product is deferred pending a small-cell ruling and a per-wave DSD concordance; district is the shipped level."),
    list(source = "DCS 2024 percentage twin (Table 9) and abstract percentage table 2.15",
         status = "not_shipped_derivable",
         reason = "Percentages are recomputed from the shipped counts; the published percentage tables are not separately shipped.")
  ),
  privacy = "public",
  licence_status = "needs_review",
  licence_basis = "dcs_all_rights_reserved_attribution",
  downstream_status = "staged",
  source_datasets = source_datasets(),
  notes = paste("STAGED for conductor review: no page and no hub link are built by this lane.",
                "licence_status is needs_review pending PI task 14 (DCS asserts all rights reserved).",
                "The committed product contains derived district summaries and simplified geoBoundaries geometry only.",
                scope_note)
)
write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)

cat("Sri Lanka area-summary build complete\n")
cat("  waves: 1981, 2001, 2012, 2024 x 25 districts = 100 rows\n")
for (y in as.character(years)) {
  r <- reconciliation[[y]]
  cat(sprintf("  %s: published_districts=%d national_total=%d within_row=%s national_reconciliation=%s\n",
      y, r[["published_districts"]], r[["national_total"]], r[["within_row_total_reconciliation"]], r[["national_reconciliation"]]))
}
cat("  label-convention correspondence: exact 1:1 across abstract and census-table conventions\n")
cat("  2001 coverage: 18 enumerated + 7 estimated-total-only (null religion, footnote rendered)\n")
cat("  1981 Kilinochchi: null (did not exist; folded in Jaffna's printed 1981 row)\n")
cat(sprintf("  boundary: 25 valid features, %d distinct hashes, %d bytes\n",
    length(unique(unlist(boundary_result[["geometry_hashes"]]))), file_bytes(boundary_out)))
cat(sprintf("  licence: DCS all rights reserved (needs_review, PI task 14); boundary CC BY 3.0 IGO\n"))
cat(sprintf("  wrote %s (%d rows), %s (%d rows), %s, %s\n",
    summary_json_out, row_count_file(summary_json_out), summary_csv_out, row_count_file(summary_csv_out), boundary_out, manifest_out))
