# build the Kazakhstan region census-religion area-summary product for two waves
# (2009, 2021) on per-vintage region frames. the two waves ride DIFFERENT region
# boundaries: 2009 on the 16-unit frame (South Kazakhstan Region intact), 2021 on
# the 17-unit frame (South Kazakhstan split into Turkistan Region + Shymkent city
# in 2018). the 2022 reorganisation (Abai/Jetisu/Ulytau) postdates the 2021 census
# and only affects the current COD-AB vintage, which is dissolved back to the 2021
# frame. see research/countries/kz/route-probe.md for full provenance and sha256.
#   inputs (all cached, git-ignored):
#   data/raw/kz_census/kz_2009_brief.txt  <- 2009 "Краткие итоги" Section 7.1
#     "Население по вероисповеданию по полу" (region x religion, Все население/Оба пола)
#   data/raw/kz_census/kz_2021_results.txt <- 2021 "Краткие итоги" (ESTAT464825)
#     Section 7.1 "Население по вероисповеданию в разрезе регионов" (Оба пола)
#   data/raw/kz_census/geoBoundaries-KAZ-ADM1.geojson <- 2009 boundary (16 units, ODbL)
#   data/raw/kz_census/codab/.../kaz_admbnda_adm1_unhcr_2023.shp <- 2021 boundary
#     (COD-AB, 20 units, CC BY-IGO), dissolved to 17
# every religion cell is transcribed verbatim from its cached source (extracted with
# pdftotext -layout, margin-verified) and reconciled against the printed control
# totals here; the build stops on any margin mismatch and never allocates, infers,
# rounds, imputes, or tunes a value. dashes/blank read as nil; no cell suppression.
# outputs: apps/regions/kz/data/{kz_region_2009.geojson, kz_region_2021.geojson,
#   area_summary_region.json, area_summary_region.csv} and
#   docs/manifests/kz-census-religion-2009-2021.json.
# run from the repo root: Rscript scripts/build_kz_area_summary.R

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "KZ"
script_id <- "scripts/build_kz_area_summary.R"
raw_dir <- "data/raw/kz_census"
product_dir <- "apps/regions/kz/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-12"
stamp <- paste0(retrieval_date, "T00:00:00Z")
git_commit <- trimws(system2("git", c("rev-parse", "HEAD"), stdout = TRUE))
if (length(git_commit) != 1L || !grepl("^[a-f0-9]{40}$", git_commit)) git_commit <- NULL

# ---- dataset ids ---------------------------------------------------------------
d2009 <- "kz-census-2009-brief-results-7-1-religion-by-region"
d2021 <- "kz-census-2021-brief-results-7-1-religion-by-region"
d_gb <- "geoboundaries-kaz-adm1-2017"
d_cod <- "ocha-codab-kaz-adm1-2023"

boundary_set_2009 <- "kz-region-2009-geoboundaries-adm1"
boundary_set_2021 <- "kz-region-2021-ocha-codab-adm1"
boundary_set_period <- "kz-region-period-2009-2021"

# ---- source urls and cached paths ----------------------------------------------
url_2009 <- "https://stat.gov.kz/upload/medialibrary/e07/edrb65uwved0wmlee6fe701slvowygso/3-%D0%9F%D0%B5%D1%80%D0%B5%D0%BF%D0%B8%D1%81%D1%8C_%D0%BA%D1%80%D0%B0%D1%82%D0%BA%D0%B8%D0%B5%20%D0%B8%D1%82%D0%BE%D0%B3%D0%B8.rar"
url_2021 <- "https://web.archive.org/web/20220902140633/https://stat.gov.kz/api/getFile/?docId=ESTAT464825"
url_2021_orig <- "https://stat.gov.kz/api/getFile/?docId=ESTAT464825"
url_gb <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/KAZ/ADM1/geoBoundaries-KAZ-ADM1.geojson"
url_gb_meta <- "https://www.geoboundaries.org/api/current/gbOpen/KAZ/ADM1/"
url_cod <- "https://data.humdata.org/dataset/afb05759-c3da-44f4-93a1-6bd2d8bcd431/resource/86cce6ba-4b79-4b4e-8961-3e6e04308395/download/kaz_adm_unhcr_2023_shp.zip"
url_cod_meta <- "https://data.humdata.org/api/3/action/package_show?id=cod-ab-kaz"
url_terms <- "https://stat.gov.kz/en/description/"
url_terms_ru <- "https://stat.gov.kz/ru/description/"

path_2009_rar <- file.path(raw_dir, "kz_2009_brief_results.rar")
path_2021_pdf <- file.path(raw_dir, "kz_2021_census_results_ESTAT464825.pdf")
path_gb <- file.path(raw_dir, "geoBoundaries-KAZ-ADM1.geojson")
path_gb_meta <- file.path(raw_dir, "gb_kaz_adm1_meta.json")
path_cod_zip <- file.path(raw_dir, "kaz_adm_unhcr_2023_shp.zip")
path_cod_shp <- file.path(raw_dir, "codab/kaz_adm_unhcr_2023_SHP/kaz_admbnda_adm1_unhcr_2023.shp")
path_cod_meta <- file.path(raw_dir, "hdx_kaz.json")
path_terms_en <- file.path(raw_dir, "kz_stat_terms_en.html")
path_terms_ru <- file.path(raw_dir, "kz_stat_terms_ru.html")

geojson_2009_out <- file.path(product_dir, "kz_region_2009.geojson")
geojson_2021_out <- file.path(product_dir, "kz_region_2021.geojson")
summary_json_out <- file.path(product_dir, "area_summary_region.json")
summary_csv_out <- file.path(product_dir, "area_summary_region.csv")
manifest_out <- file.path(manifest_dir, "kz-census-religion-2009-2021.json")

# ---- verbatim category frames --------------------------------------------------
# seven top-level categories, identical across waves; 2021 additionally prints a
# Christianity sub-breakdown (Orthodox/Catholic/Protestant) carried on the flag.
# NOTE the column-order trap: 2009 prints Other, Non-believers, Refused; 2021
# prints Other, Refused, Non-believers. each wave keeps its own printed order.
top_cats <- c("Islam", "Christianity", "Judaism", "Buddhism", "Other",
              "Non-believers", "Refused to indicate")
cat_ru_2009 <- c(Islam = "ислам", Christianity = "христианство", Judaism = "иудаизм",
                 Buddhism = "буддизм", Other = "другое",
                 `Non-believers` = "неверующие", `Refused to indicate` = "отказались указать")
cat_ru_2021 <- c(Islam = "ислам", Christianity = "христиан", Judaism = "иудаизм",
                 Buddhism = "буддизм", Other = "басқа/другое",
                 `Non-believers` = "дінге сенбейтіндер/неверующие",
                 `Refused to indicate` = "көрсетуден бас тартты/отказались указать")

# ---- 2009 wave (16 regions; all persons, all ages) -----------------------------
# printed order of the numeric columns: total, islam, christianity, judaism,
# buddhism, other, non-believers, refused. transcribed from Section 7.1
# (Все население / Оба пола).
region_2009 <- c("Akmola", "Aktobe", "Almaty Region", "Atyrau", "West Kazakhstan",
                 "Jambyl", "Karaganda", "Kostanay", "Kyzylorda", "Mangystau",
                 "South Kazakhstan", "Pavlodar", "North Kazakhstan",
                 "East Kazakhstan", "Astana", "Almaty")
region_2009_ru <- c("Акмолинская", "Актюбинская", "Алматинская", "Атырауская",
                    "Западно-Казахстанская", "Жамбылская", "Карагандинская",
                    "Костанайская", "Кызылординская", "Мангистауская",
                    "Южно-Казахстанская", "Павлодарская", "Северо-Казахстанская",
                    "Восточно-Казахстанская", "Астана г.а.", "Алматы г.а.")
slug_2009 <- c("akmola", "aktobe", "almaty_region", "atyrau", "west_kazakhstan",
               "jambyl", "karaganda", "kostanay", "kyzylorda", "mangystau",
               "south_kazakhstan", "pavlodar", "north_kazakhstan",
               "east_kazakhstan", "astana", "almaty")
# 2009 census region -> geoBoundaries ADM1 shapeName (16-unit, 2017 vintage).
boundary_name_2009 <- c(
  Akmola = "Akmola Region", Aktobe = "Aktobe Region",
  `Almaty Region` = "Almaty Region", Atyrau = "Atyrau Region",
  `West Kazakhstan` = "West Kazakhstan Region", Jambyl = "Jambyl Region",
  Karaganda = "Karaganda Region", Kostanay = "Kostanay Region",
  Kyzylorda = "Kyzylorda Region", Mangystau = "Mangystau Region",
  `South Kazakhstan` = "South Kazakhstan Region", Pavlodar = "Pavlodar Region",
  `North Kazakhstan` = "North Kazakhstan Region",
  `East Kazakhstan` = "East Kazakhstan Region", Astana = "Astana", Almaty = "Almaty")
# one row per region: total, islam, christianity, judaism, buddhism, other, nonbeliever, refused
m2009 <- rbind(
  Akmola            = c(737495,  368459,  326864,   142,   193,  4832, 32275,  4730),
  Aktobe            = c(757768,  602680,  130138,   275,   355,  1116, 18876,  4328),
  `Almaty Region`   = c(1807894, 1458685, 313898,   418,  2910,  2338, 24621,  5024),
  Atyrau            = c(510377,  468606,   36192,    79,   806,   274,  2913,  1507),
  `West Kazakhstan` = c(598880,  430363,  148137,   443,   133,   251, 17008,  2545),
  Jambyl            = c(1022129, 873572,  137672,   147,  1632,   861,  6695,  1550),
  Karaganda         = c(1341700, 649133,  601315,   407,  1227,  7741, 68405, 13472),
  Kostanay          = c(885570,  344056,  473306,   169,   515,  1164, 59840,  6520),
  Kyzylorda         = c(678794,  652206,   19007,    91,  1359,   109,  5173,   849),
  Mangystau         = c(485392,  435429,   44122,   631,   260,   300,  3604,  1046),
  `South Kazakhstan`= c(2469357, 2307183, 150365,   278,  1997,  1328,  5547,  2659),
  Pavlodar          = c(742475,  368840,  337113,   345,   281,  1683, 29652,  4561),
  `North Kazakhstan`= c(596535,  210605,  351339,   202,    90,  1494, 28615,  4190),
  `East Kazakhstan` = c(1396593, 787224,  520177,    44,   166,   797, 82220,  5965),
  Astana            = c(613006,  444743,  142917,   290,   581,  2789, 16411,  5275),
  Almaty            = c(1365632, 836163,  457566,  1295,  2136,  3032, 48652, 16788)
)
colnames(m2009) <- c("total", "Islam", "Christianity", "Judaism", "Buddhism",
                     "Other", "Non-believers", "Refused to indicate")
# printed national control row (Республика Казахстан).
nat_2009 <- c(total = 16009597, Islam = 11237947, Christianity = 4190128,
              Judaism = 5256, Buddhism = 14641, Other = 30109,
              `Non-believers` = 450507, `Refused to indicate` = 81009)

# ---- 2021 wave (17 regions; all persons, all ages) -----------------------------
# printed order: total, islam, christianity(+orthodox,catholic,protestant),
# judaism, buddhism, other, refused, non-believers. transcribed from Section 7.1
# (Все население / Оба пола). christianity sub-columns carried for the flag only.
region_2021 <- c("Akmola", "Aktobe", "Almaty Region", "Atyrau", "West Kazakhstan",
                 "Jambyl", "Karaganda", "Kostanay", "Kyzylorda", "Mangystau",
                 "Pavlodar", "North Kazakhstan", "Turkistan", "East Kazakhstan",
                 "Nur-Sultan (Astana)", "Almaty", "Shymkent")
region_2021_ru <- c("Ақмола", "Ақтөбе", "Алматы облысы", "Атырау",
                    "Батыс Қазақстан", "Жамбыл", "Қарағанды", "Қостанай",
                    "Қызылорда", "Маңғыстау", "Павлодар", "Солтүстік Қазақстан",
                    "Түркістан", "Шығыс Қазақстан", "Нұр-Сұлтан қаласы",
                    "Алматы қаласы", "Шымкент қаласы")
slug_2021 <- c("akmola", "aktobe", "almaty_region", "atyrau", "west_kazakhstan",
               "jambyl", "karaganda", "kostanay", "kyzylorda", "mangystau",
               "pavlodar", "north_kazakhstan", "turkistan", "east_kazakhstan",
               "nur_sultan", "almaty", "shymkent")
# 2021 census region -> dissolved COD-AB ADM1_EN (17-unit 2021 frame).
boundary_name_2021 <- c(
  Akmola = "Akmola Region", Aktobe = "Aktobe Region",
  `Almaty Region` = "Almaty Region", Atyrau = "Atyrau Region",
  `West Kazakhstan` = "West Kazakhstan Region", Jambyl = "Jambyl Region",
  Karaganda = "Karaganda Region", Kostanay = "Kostanay Region",
  Kyzylorda = "Kyzylorda Region", Mangystau = "Mangystau Region",
  Pavlodar = "Pavlodar Region", `North Kazakhstan` = "North Kazakhstan Region",
  Turkistan = "Turkistan Region", `East Kazakhstan` = "East Kazakhstan Region",
  `Nur-Sultan (Astana)` = "Astana", Almaty = "Almaty", Shymkent = "Shymkent")
# columns: total, islam, christianity, orthodox, catholic, protestant, judaism,
# buddhism, other, refused, nonbeliever
m2021_raw <- rbind(
  Akmola                 = c(782995,  362070,  287619,  283202,  4078,  339,   295,   152,  1034, 117247, 14578),
  Aktobe                 = c(906220,  760924,   88968,   88392,   374,  202,   320,   277,  1191,  39242, 15298),
  `Almaty Region`        = c(2146576, 1482673, 213791,  212509,   561,  721,   275,  3406,  1659, 416727, 28045),
  Atyrau                 = c(673601,  563539,   29513,   29391,    78,   44,   174,   188,   508,  73284,  6395),
  `West Kazakhstan`      = c(675655,  529961,  106732,  106530,    97,  105,    74,   187,  1081,  26473, 11147),
  Jambyl                 = c(1199259, 1009257,  90275,   89765,   217,  293,    71,  1163,   811,  83279, 14403),
  Karaganda              = c(1348468, 701013,  441806,  437989,  2035, 1782,   858,  2572,  2558, 148990, 50671),
  Kostanay               = c(833643,  308024,  366880,  365185,  1308,  387,   508,   349,  1475, 116064, 40343),
  Kyzylorda              = c(814931,  784051,   14465,   14360,    32,   73,    46,   255,   365,  13027,  2722),
  Mangystau              = c(735008,  508701,   30967,   30731,    90,  146,   132,   112,   663, 162242, 32191),
  Pavlodar               = c(756755,  431885,  286298,  284407,  1472,  419,   264,   289,  1254,  20257, 16508),
  `North Kazakhstan`     = c(540786,  209397,  298288,  292993,  4987,  308,   123,   188,   832,  21923, 10035),
  Turkistan              = c(2054021, 1897485,  32341,   32111,    76,  154,    63,   340,   389, 118394,  5009),
  `East Kazakhstan`      = c(1341292, 846457,  447764,  445686,  1382,  696,   250,   516,  2218,  15979, 28108),
  `Nur-Sultan (Astana)`  = c(1234042, 968445,  135656,  133807,  1193,  656,  1320,   675,  1691,  97781, 28474),
  Almaty                 = c(2030285, 1172838, 353477,  349853,   929, 2695,  2184,  4452,  4865, 404847, 87622),
  Shymkent               = c(1112478, 761055,   72710,   72232,    79,  399,   235,   337,   653, 236897, 40591)
)
colnames(m2021_raw) <- c("total", "Islam", "Christianity", "orthodox", "catholic",
                         "protestant", "Judaism", "Buddhism", "Other",
                         "Refused to indicate", "Non-believers")
# top-level matrix in the shared category order for slot math and gating.
m2021 <- m2021_raw[, c("total", "Islam", "Christianity", "Judaism", "Buddhism",
                       "Other", "Non-believers", "Refused to indicate")]
nat_2021 <- c(total = 19186015, Islam = 13297775, Christianity = 3297550,
              Judaism = 7192, Buddhism = 15458, Other = 23247,
              `Non-believers` = 432140, `Refused to indicate` = 2112653)
nat_2021_christ_sub <- c(orthodox = 3269143, catholic = 18988, protestant = 9419)

# ---- reconciliation gates (fail-fast; stop, do not tune) -----------------------
# every region row's seven top-level categories sum to its printed total; every
# category column sums to its printed national total; both margins reconcile to
# the national grand total. any deviation stops the build.
reconcile_wave <- function(mat, nat, year) {
  cats <- top_cats
  records <- list()
  for (r in rownames(mat)) {
    row_sum <- sum(mat[r, cats])
    if (row_sum != mat[r, "total"]) {
      stop(sprintf("%d region gate FAILED for %s: categories sum %d != printed total %d",
                   year, r, row_sum, mat[r, "total"]), call. = FALSE)
    }
    records[[length(records) + 1L]] <- data.frame(
      year = year, margin = "region_row", key = r,
      computed = row_sum, printed = unname(mat[r, "total"]), difference = 0L,
      stringsAsFactors = FALSE)
  }
  for (c in cats) {
    col_sum <- sum(mat[, c])
    if (col_sum != nat[[c]]) {
      stop(sprintf("%d religion-column gate FAILED for %s: region sum %d != printed national %d",
                   year, c, col_sum, nat[[c]]), call. = FALSE)
    }
    records[[length(records) + 1L]] <- data.frame(
      year = year, margin = "religion_column", key = c,
      computed = col_sum, printed = unname(nat[[c]]), difference = 0L,
      stringsAsFactors = FALSE)
  }
  if (sum(mat[, "total"]) != nat[["total"]]) {
    stop(sprintf("%d grand gate FAILED: region-total sum %d != printed national %d",
                 year, sum(mat[, "total"]), nat[["total"]]), call. = FALSE)
  }
  if (sum(nat[cats]) != nat[["total"]]) {
    stop(sprintf("%d category-total gate FAILED: national category sum %d != printed national %d",
                 year, sum(nat[cats]), nat[["total"]]), call. = FALSE)
  }
  do.call(rbind, records)
}

rec_2009 <- reconcile_wave(m2009, nat_2009, 2009L)
rec_2021 <- reconcile_wave(m2021, nat_2021, 2021L)

# 2021 Christianity sub-columns must sum to the Christianity total in every region
# and nationally (Orthodox + Catholic + Protestant = Christianity).
for (r in rownames(m2021_raw)) {
  sub <- sum(m2021_raw[r, c("orthodox", "catholic", "protestant")])
  if (sub != m2021_raw[r, "Christianity"]) {
    stop(sprintf("2021 Christianity sub gate FAILED for %s: %d != %d",
                 r, sub, m2021_raw[r, "Christianity"]), call. = FALSE)
  }
}
if (sum(nat_2021_christ_sub) != nat_2021[["Christianity"]]) {
  stop("2021 national Christianity sub gate FAILED", call. = FALSE)
}

message(sprintf("gate 2009: PASSED (both margins close to %d; 16 region rows, 7 religion columns)", nat_2009[["total"]]))
message(sprintf("gate 2021: PASSED (both margins close to %d; 17 region rows, 7 religion columns + Christianity sub)", nat_2021[["total"]]))

# ---- boundary helpers ----------------------------------------------------------
sha256_file <- function(path) unname(tools::sha256sum(path))
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))
require_file <- function(path) {
  if (!file.exists(path) || file_bytes(path) == 0L) stop("missing required source: ", path, call. = FALSE)
}
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$", path)) return(length(fromJSON(path, simplifyVector = FALSE)[["features"]]))
  if (grepl("\\.json$", path)) return(length(fromJSON(path, simplifyVector = FALSE)[["rows"]]))
  NA_integer_
}
geometry_hashes <- function(layer) {
  vapply(seq_len(nrow(layer)), function(i) {
    digest(st_as_binary(st_geometry(layer)[i], EWKB = TRUE)[[1L]], algo = "sha256", serialize = FALSE)
  }, character(1))
}

invisible(lapply(c(path_gb, path_gb_meta, path_cod_shp, path_cod_meta), require_file))

# confirm the 2009 boundary licence, unit count, and type before use.
gb_meta <- fromJSON(path_gb_meta, simplifyVector = FALSE)
if (!identical(gb_meta[["boundaryLicense"]], "Open Data Commons Open Database License 1.0") ||
    !identical(gb_meta[["admUnitCount"]], "16") ||
    !identical(gb_meta[["boundaryType"]], "ADM1")) {
  stop("geoBoundaries KAZ ADM1 licence, unit count, or type metadata changed", call. = FALSE)
}
# confirm the 2021 boundary licence from the HDX metadata.
cod_meta <- fromJSON(path_cod_meta, simplifyVector = FALSE)
if (!identical(cod_meta[["result"]][["license_id"]], "cc-by-igo")) {
  stop("OCHA COD-AB KAZ licence metadata changed", call. = FALSE)
}

# KZ-centred equal-area projection for land areas (no dateline crossing).
kz_laea <- "+proj=laea +lat_0=48 +lon_0=67 +datum=WGS84 +units=m +no_defs"

# assemble one wave's boundary layer: join census regions to the boundary source,
# attach product identifiers and land area. returns an sf in EPSG:4326.
build_boundary <- function(boundary, region_names, slugs, name_map,
                           boundary_set_id, boundary_vintage) {
  target <- unname(name_map[region_names])
  idx <- match(target, boundary[["boundary_source_name"]])
  if (anyNA(idx) || anyDuplicated(idx) || length(idx) != length(region_names)) {
    stop("census regions and boundary features do not join one-to-one for ", boundary_set_id, call. = FALSE)
  }
  boundary <- boundary[idx, ]
  boundary[["area_name"]] <- region_names
  boundary[["area_code"]] <- slugs
  boundary[["area_unit_id"]] <- paste(boundary_set_id, slugs, sep = ":")
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- "region"
  boundary[["boundary_vintage"]] <- boundary_vintage
  boundary[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(boundary, kz_laea))) / 1e6
  boundary <- st_transform(st_make_valid(boundary), 4326)
  boundary[c("area_code", "area_name", "boundary_source_name", "area_unit_id",
             "boundary_set_id", "boundary_level", "boundary_vintage",
             "land_area_sq_km", "geometry")]
}

# --- 2009 boundary: geoBoundaries ADM1 (16 units, direct) ---
gb <- st_make_valid(st_read(path_gb, quiet = TRUE, stringsAsFactors = FALSE))
if (nrow(gb) != 16L) stop("geoBoundaries KAZ ADM1 feature count is not 16", call. = FALSE)
gb[["boundary_source_name"]] <- gb[["shapeName"]]
boundary_2009 <- build_boundary(gb, region_2009, slug_2009, boundary_name_2009,
                                boundary_set_2009, "2009 census 16-region frame (geoBoundaries ADM1, 2017)")

# --- 2021 boundary: COD-AB ADM1 (20 units) dissolved to the 17-unit 2021 frame ---
# dissolve the three 2022-created regions back into their single pre-2022 parents.
cod <- st_make_valid(st_read(path_cod_shp, quiet = TRUE, stringsAsFactors = FALSE))
if (nrow(cod) != 20L) stop("COD-AB KAZ ADM1 feature count is not 20", call. = FALSE)
reorg_parent <- c(`Abay Region` = "East Kazakhstan Region",
                  `Jetisu Region` = "Almaty Region",
                  `Ulytau Region` = "Karaganda Region")
cod[["dissolve_name"]] <- ifelse(cod[["ADM1_EN"]] %in% names(reorg_parent),
                                 unname(reorg_parent[cod[["ADM1_EN"]]]), cod[["ADM1_EN"]])
cod_17 <- aggregate(cod["dissolve_name"], by = list(name = cod[["dissolve_name"]]),
                    FUN = function(x) x[1], do_union = TRUE)
cod_17 <- st_make_valid(cod_17)
if (nrow(cod_17) != 17L) stop("dissolved COD-AB frame is not 17 units", call. = FALSE)
cod_17[["boundary_source_name"]] <- cod_17[["name"]]
boundary_2021 <- build_boundary(cod_17, region_2021, slug_2021, boundary_name_2021,
                                boundary_set_2021, "2021 census 17-region frame (OCHA COD-AB 2023 dissolved to pre-2022 parents)")

# simplify each vintage with the mandatory helper; re-validate count + distinctness.
simplify_and_check <- function(boundary, out_path, n_expected) {
  simplification <- mapshaper_simplify_to_cap(
    boundary, out_path, max_bytes = 900000L,
    keep_percentages = c(30, 20, 12, 8, 5, 3, 2),
    clean_option = "allow-overlaps")
  written <- st_read(out_path, quiet = TRUE, stringsAsFactors = FALSE)
  written <- written[match(boundary[["area_code"]], written[["area_code"]]), ]
  if (anyNA(written[["area_code"]])) stop("simplified boundary lost an area code", call. = FALSE)
  if (nrow(written) != n_expected) stop("simplified boundary count mismatch", call. = FALSE)
  w_valid <- st_is_valid(written)
  if (any(st_is_empty(written)) || any(is.na(w_valid)) || any(!w_valid)) {
    stop("simplified boundary has empty or invalid geometries", call. = FALSE)
  }
  hashes <- geometry_hashes(written)
  if (length(unique(hashes)) != n_expected) stop("simplified geometry hashes not distinct", call. = FALSE)
  list(simplification = simplification, written = written, hashes = hashes,
       bbox = st_bbox(written))
}

s2009 <- simplify_and_check(boundary_2009, geojson_2009_out, 16L)
s2021 <- simplify_and_check(boundary_2021, geojson_2021_out, 17L)
message(sprintf("boundary 2009: PASSED (16 distinct features, %d bytes at %g%% keep)",
                file_bytes(geojson_2009_out), s2009$simplification[["keep_percent"]]))
message(sprintf("boundary 2021: PASSED (17 distinct features, %d bytes at %g%% keep)",
                file_bytes(geojson_2021_out), s2021$simplification[["keep_percent"]]))

# ---- product rows --------------------------------------------------------------
# ordinary two-slot design (SB/FM precedent): religious_affiliation_percent is the
# summed share of every religious-affiliation category (Islam + Christianity +
# Judaism + Buddhism + Other); no_religion_percent is the single Non-believers
# line. Refused-to-indicate stays in the denominator and in neither slot, so the
# two shares need not sum to 100.
flag_common <- paste(
  "census_affiliation", "all_persons_all_ages_universe",
  "single_select_reported_religion",
  "religious_affiliation_percent_is_summed_affiliation_share",
  "no_religion_percent_is_non_believers_line_only",
  "refused_to_indicate_residual_in_denominator_neither_slot",
  "shares_need_not_sum_to_100",
  "region_frame_break_2018_no_cross_wave_region_change",
  "census_licence_open_reuse_with_attribution",
  sep = ";")

basis_2009 <- paste(
  "2009 National Census of Kazakhstan, Brief Results (Краткие итоги), Section 7.1",
  "'Население по вероисповеданию по полу' (Все население / Оба пола), all persons",
  "of all ages; the denominator is the printed region total. Religious affiliation",
  "is the region population minus the Non-believers (неверующие) and Refused-to-",
  "indicate (отказались указать) lines.")
basis_2021 <- paste(
  "2021 National Census of Kazakhstan, Brief Results (Краткие итоги, getFile",
  "ESTAT464825), Section 7.1 'Население по вероисповеданию в разрезе регионов'",
  "(Все население / Оба пола), all persons of all ages; the denominator is the",
  "printed region total. Religious affiliation is the region population minus the",
  "Non-believers (дінге сенбейтіндер/неверующие) and Refused-to-indicate lines.")

# build one schema-shaped row, carrying the verbatim per-region category breakdown.
make_row <- function(region, wave) {
  mat <- wave$mat
  pop <- as.integer(mat[region, "total"])
  no_rel <- as.integer(mat[region, "Non-believers"])
  refused <- as.integer(mat[region, "Refused to indicate"])
  affiliation <- pop - no_rel - refused
  aff_pct <- round(100 * affiliation / pop, 4)
  no_pct <- round(100 * no_rel / pop, 4)
  # verbatim breakdown: RU/KK source label = count, in printed order.
  if (wave$year == 2021L) {
    cols <- c("Islam", "Christianity", "orthodox", "catholic", "protestant",
              "Judaism", "Buddhism", "Other", "Refused to indicate", "Non-believers")
    labs <- c(cat_ru_2021[["Islam"]], cat_ru_2021[["Christianity"]],
              "православие", "католицизм", "протестантизм", cat_ru_2021[["Judaism"]],
              cat_ru_2021[["Buddhism"]], cat_ru_2021[["Other"]],
              cat_ru_2021[["Refused to indicate"]], cat_ru_2021[["Non-believers"]])
    vals <- m2021_raw[region, cols]
  } else {
    cols <- c("Islam", "Christianity", "Judaism", "Buddhism", "Other",
              "Non-believers", "Refused to indicate")
    labs <- cat_ru_2009[cols]
    vals <- mat[region, cols]
  }
  breakdown <- paste(paste0(labs, "=", vals), collapse = ";")
  full_flag <- paste0(wave$flag, ";source_region_name=", wave$ru[[which(wave$region == region)]],
                      ";source_categories_verbatim=", breakdown)
  list(
    country_code = country_code,
    boundary_set_id = wave$boundary_set_id,
    boundary_level = "region",
    area_unit_id = paste(wave$boundary_set_id, wave$slug[[which(wave$region == region)]], sep = ":"),
    area_code = wave$slug[[which(wave$region == region)]],
    area_name = region,
    year = as.integer(wave$year),
    population_total = pop,
    population_total_basis = wave$basis,
    religious_affiliation_count = as.integer(affiliation),
    religious_affiliation_percent = aff_pct,
    no_religion_count = no_rel,
    no_religion_percent = no_pct,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = unname(round(wave$land_area[[region]], 4)),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(wave$dataset, wave$boundary_dataset),
    quality_flag = full_flag
  )
}

land_2009 <- setNames(s2009$written[["land_area_sq_km"]], s2009$written[["area_name"]])
land_2021 <- setNames(s2021$written[["land_area_sq_km"]], s2021$written[["area_name"]])

wave_2009 <- list(year = 2009L, mat = m2009, region = region_2009, ru = region_2009_ru,
                  slug = slug_2009, boundary_set_id = boundary_set_2009, dataset = d2009,
                  boundary_dataset = d_gb, flag = flag_common, basis = basis_2009,
                  land_area = land_2009)
wave_2021 <- list(year = 2021L, mat = m2021, region = region_2021, ru = region_2021_ru,
                  slug = slug_2021, boundary_set_id = boundary_set_2021, dataset = d2021,
                  boundary_dataset = d_cod, flag = flag_common, basis = basis_2021,
                  land_area = land_2021)

rows <- c(lapply(region_2009, make_row, wave = wave_2009),
          lapply(region_2021, make_row, wave = wave_2021))

# ---- area-summary document -----------------------------------------------------
census_licence_name <- paste(
  "Bureau of National Statistics open reuse grant. The BNS 'About using the data'",
  "page (stat.gov.kz/en/description/, retrieved 2026-07-12) states: 'Users may use",
  "official statistical information for any purposes (including reusing it in full)",
  "freely, free of charge, perpetually, and without territorial restrictions,",
  "including copying, publishing, distributing with a reference to the source,",
  "modifying, combining it with other information, as well as using it for the",
  "creation of software products and applications.' An open licence conditioned only",
  "on source attribution.")

source_datasets <- function() {
  list(
    list(
      source_dataset_id = d2009,
      name = "Kazakhstan 2009 National Census, Brief Results (Краткие итоги), Section 7.1: Population by religion by region",
      provider = "Bureau of National Statistics of the Agency for Strategic Planning and Reforms of the Republic of Kazakhstan (2009: Agency of Statistics)",
      url = url_2009, retrieval_date = retrieval_date, local_path = path_2009_rar,
      licence = list(name = census_licence_name, url = url_terms,
                     attribution = "Bureau of National Statistics of the Republic of Kazakhstan, 2009 National Population Census"),
      citation = "Bureau of National Statistics of the Republic of Kazakhstan, 2009 National Population Census, Brief Results, Section 7.1 (Population by religion by region).",
      access_limits = NULL,
      redistribution_limits = "Open reuse with source attribution; derived region summaries ship with attribution to the Bureau of National Statistics.",
      notes = paste("All persons, all ages; 16-region frame (South Kazakhstan Region intact). Both margins close exactly to",
                    "the printed national total 16,009,597. Seven top-level categories; column order Other, Non-believers,",
                    "Refused. No cell suppression.")),
    list(
      source_dataset_id = d2021,
      name = "Kazakhstan 2021 National Census, Brief Results (Краткие итоги, getFile ESTAT464825), Section 7.1: Population by religion by region",
      provider = "Bureau of National Statistics of the Agency for Strategic Planning and Reforms of the Republic of Kazakhstan",
      url = url_2021, retrieval_date = retrieval_date, local_path = path_2021_pdf,
      licence = list(name = census_licence_name, url = url_terms,
                     attribution = "Bureau of National Statistics of the Republic of Kazakhstan, 2021 National Population Census"),
      citation = "Bureau of National Statistics of the Republic of Kazakhstan, 2021 National Population Census, Brief Results (getFile ESTAT464825), Section 7.1 (Population by religion by region).",
      access_limits = NULL,
      redistribution_limits = "Open reuse with source attribution; the original BNS getFile id is stale, durable via the Internet Archive capture of 2022-09-02.",
      notes = paste("All persons, all ages; 17-region frame (Turkistan Region + Shymkent city split from South Kazakhstan in",
                    "2018). Both margins close exactly to the printed national total 19,186,015. Christianity sub-split",
                    "(Orthodox/Catholic/Protestant) sums to the Christianity total. Column order Other, Refused, Non-believers.")),
    list(
      source_dataset_id = d_gb,
      name = "geoBoundaries KAZ ADM1 (16 regions, 2017 vintage)",
      provider = "geoBoundaries (William & Mary geoLab); boundary source OpenStreetMap, Wambacher",
      url = url_gb, retrieval_date = retrieval_date, local_path = path_gb,
      licence = list(name = "Open Data Commons Open Database License 1.0 (ODbL)", url = url_gb_meta,
                     attribution = "geoBoundaries (gbOpen); boundary source OpenStreetMap contributors (ODbL)"),
      citation = "geoBoundaries KAZ ADM1 (gbOpen, pinned 9469f09), 16 region boundaries.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary is committed under ODbL (OpenStreetMap via geoBoundaries); the ODbL share-alike and attribution apply.",
      notes = "16 ADM1 regions, boundaryYearRepresented 2017; the 2009 census 16-region frame joins one-to-one (South Kazakhstan Region intact)."),
    list(
      source_dataset_id = d_cod,
      name = "OCHA COD-AB Kazakhstan ADM1 (UNHCR from OpenStreetMap, 2023), dissolved to the 17-region 2021 frame",
      provider = "OCHA / UNHCR (Common Operational Dataset - Administrative Boundaries)",
      url = url_cod, retrieval_date = retrieval_date, local_path = path_cod_zip,
      licence = list(name = "Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO)", url = url_cod_meta,
                     attribution = "OCHA / UNHCR, Common Operational Dataset - Administrative Boundaries (CC BY-IGO)"),
      citation = "OCHA COD-AB Kazakhstan ADM1 (UNHCR from OpenStreetMap, 2023), dissolved to the pre-2022 17-region frame.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary is committed under CC BY-IGO with attribution to OCHA/UNHCR.",
      notes = paste("The 2023 COD carries 20 ADM1 units (post-2022 reorg). The three 2022-created regions are dissolved into",
                    "their single pre-2022 parents (Abay->East Kazakhstan, Jetisu->Almaty Region, Ulytau->Karaganda) to",
                    "reconstruct the 17-unit 2021 census frame by exact complete-unit partition (Montenegro precedent)."))
  )
}

indicators <- function() {
  denom_note <- paste(
    "Percentages use each region's printed census population total. The Refused-to-",
    "indicate line stays in the denominator and outside both headline numerators, so",
    "the two shares need not sum to 100%.")
  list(
    list(indicator_id = "population_total", label = "Census population total",
         description = "Region all-persons population represented in the wave's religion table.",
         unit = "count", denominator_indicator_id = NULL,
         method = "Printed region total: 2009 Brief Results Section 7.1; 2021 Brief Results Section 7.1.",
         temporal_coverage = "2009; 2021", spatial_coverage = "Kazakhstan regions (16 in 2009; 17 in 2021)",
         quality_notes = "Every wave counts all persons of all ages; there is no universe break. The region frame changes between waves (16 vs 17 units, the 2018 South Kazakhstan split), so no cross-wave region change is claimed."),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
         description = "Share of the region population reporting affiliation with a named religion (Islam, Christianity, Judaism, Buddhism, or Other).",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (population - Non-believers - Refused to indicate) / population.",
         temporal_coverage = "2009; 2021", spatial_coverage = "Kazakhstan regions (16 in 2009; 17 in 2021)",
         quality_notes = paste("The seven top-level categories are identical across waves (Islam, Christianity, Judaism, Buddhism, Other, Non-believers, Refused). Affiliation is read as levels per wave, not as cross-wave change (2018 frame break).", denom_note)),
    list(indicator_id = "no_religion_percent", label = "No religious affiliation %",
         description = "Share in the census Non-believers line (неверующие / дінге сенбейтіндер).",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (Non-believers line) / population. Refused to indicate is not part of this slot.",
         temporal_coverage = "2009; 2021", spatial_coverage = "Kazakhstan regions (16 in 2009; 17 in 2021)",
         quality_notes = paste("The Refused-to-indicate share rose sharply between waves (national 0.5% in 2009 to 11.0% in 2021); it is a disclosed residual, never folded into the no-religion slot.", denom_note))
  )
}

visual_layers <- function() {
  list(
    list(visual_layer_id = "kz-region-religious-affiliation", label = "Religious affiliation %",
         description = "Kazakhstan census-affiliation share by region.", layer_type = "choropleth",
         indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "region all-persons population, including a Refused-to-indicate residual"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "reported region value", uncertainty_display = "quality_flag",
         default_visibility = TRUE,
         notes = "Census affiliation, not practice or membership. The year selector must switch to the matching per-vintage region boundary (2009: 16 units; 2021: 17 units)."),
    list(visual_layer_id = "kz-region-no-religion", label = "No religious affiliation %",
         description = "Kazakhstan census non-believers share by region.", layer_type = "choropleth",
         indicator_ids = list("no_religion_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "region all-persons population"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "reported region value", uncertainty_display = "quality_flag",
         default_visibility = FALSE,
         notes = "The source category is Non-believers (неверующие). Refused to indicate is excluded from this slot.")
  )
}

summary_product <- list(
  schema_version = "area-summary.v1", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_period, country_code = country_code,
                      level = "region", vintage = "2009 (16-region) and 2021 (17-region) census frames",
                      source_dataset_id = paste(d_gb, d_cod, sep = "|")),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "No governed place-of-worship snapshot ships in the Kazakhstan census product.",
                       notes = "Place counts and density metrics remain null."),
  source_datasets = source_datasets(), indicators = indicators(),
  visual_layers = visual_layers(), rows = rows
)

write_json(summary_product, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(summary_json_out, warn = FALSE), collapse = "\n"))) {
  stop("area-summary JSON is invalid", call. = FALSE)
}

# flatten rows to the CSV companion.
flatten_rows <- function(rows) {
  do.call(rbind, lapply(rows, function(r) {
    data.frame(
      country_code = r[["country_code"]], boundary_set_id = r[["boundary_set_id"]],
      boundary_level = r[["boundary_level"]], area_unit_id = r[["area_unit_id"]],
      area_code = r[["area_code"]], area_name = r[["area_name"]], year = r[["year"]],
      population_total = r[["population_total"]], population_total_basis = r[["population_total_basis"]],
      religious_affiliation_count = r[["religious_affiliation_count"]],
      religious_affiliation_percent = r[["religious_affiliation_percent"]],
      no_religion_count = r[["no_religion_count"]], no_religion_percent = r[["no_religion_percent"]],
      place_count = NA_integer_, places_per_10000_residents = NA_real_,
      place_density_per_sq_km = NA_real_, land_area_sq_km = r[["land_area_sq_km"]],
      site_snapshot_date = NA_character_, place_count_basis = NA_character_,
      source_dataset_ids = paste(unlist(r[["source_dataset_ids"]]), collapse = "|"),
      quality_flag = r[["quality_flag"]], stringsAsFactors = FALSE
    )
  }))
}
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

# ---- manifest ------------------------------------------------------------------
raw_source_record <- function(path, url, format, used, periods, dataset_id, notes) {
  list(uri = path, url = url, format = format, bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = NULL, source_dataset_id = dataset_id, used_in_public_product = used,
       periods = periods, notes = notes,
       local_cache_hint = paste0(path, " (git-ignored by .gitignore data/ rule)"),
       raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/kz_census/"))
}
durable_file_record <- function(path, content, licence_status_value, licence_basis_value) {
  list(uri = paste0("repo:", path), storage_provider = "git_repository", format = sub("^.*\\.", "", path),
       bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = if (grepl("area_summary|\\.csv$", path)) row_count_file(path) else NULL,
       feature_count = if (grepl("\\.geojson$", path)) row_count_file(path) else NULL,
       content = content, privacy = "public",
       licence_status = licence_status_value, licence_basis = licence_basis_value)
}
reconciliation_block <- function(rec) lapply(seq_len(nrow(rec)), function(i) as.list(rec[i, ]))

licence_basis_slug <- "kz_bns_open_reuse_with_attribution"

raw_sources <- list(
  raw_source_record(path_2009_rar, url_2009, "rar", TRUE, "2009", d2009,
    "2009 Brief Results RAR (contains Перепись_краткие итоги.pdf); Section 7.1 region x religion. Both margins close to 16,009,597."),
  raw_source_record(path_2021_pdf, url_2021, "pdf", TRUE, "2021", d2021,
    paste0("2021 Brief Results PDF (BNS getFile ESTAT464825; original ", url_2021_orig, " now stale, durable via Internet Archive 2022-09-02); Section 7.1 region x religion. Both margins close to 19,186,015.")),
  raw_source_record(path_gb, url_gb, "geojson", TRUE, "2017", d_gb,
    "geoBoundaries KAZ ADM1 GeoJSON; 16 regions, ODbL. Pinned commit 9469f09. Used for the 2009 wave."),
  raw_source_record(path_gb_meta, url_gb_meta, "json", FALSE, "2017", d_gb,
    "geoBoundaries KAZ ADM1 metadata; records ODbL, boundarySource OpenStreetMap/Wambacher, admUnitCount 16."),
  raw_source_record(path_cod_zip, url_cod, "shp_zip", TRUE, "2023", d_cod,
    "OCHA COD-AB KAZ ADM1 shapefile (UNHCR 2023, 20 units); dissolved to the 17-unit 2021 frame. Used for the 2021 wave."),
  raw_source_record(path_cod_meta, url_cod_meta, "json", FALSE, "2023", d_cod,
    "HDX COD-AB KAZ metadata; records license_id cc-by-igo, dataset_source 'UNHCR from Open Street Map'."),
  raw_source_record(path_terms_en, url_terms, "html", FALSE, "2026", d2021,
    "BNS 'About using the data' page (EN); verbatim open-reuse-with-attribution licence."),
  raw_source_record(path_terms_ru, url_terms_ru, "html", FALSE, "2026", d2021,
    "BNS 'About using the data' page (RU); verbatim open-reuse-with-attribution licence.")
)

dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)
dataset_id <- "kz-census-religion:kz:2009-2021:bns-region"

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = paste0("manifest:", dataset_id),
  dataset_id = dataset_id,
  dataset_version_id = paste0(dataset_id, ":", dataset_hash),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "kz-census-religion", dataset_role = "accepted_export",
  scope = list(level = "country", country_codes = list("KZ"), snapshot_date = NULL,
               snapshot_anchor = NULL, pipeline_stage = "accepted"),
  created_at = stamp, created_by = script_id,
  target_years = list(2009L, 2021L),
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation",
      shipped_waves = list(2009L, 2021L),
      shipped_geography = "16 Kazakhstan regions in 2009; 17 regions in 2021 (per-vintage)",
      boundary_sets = list(`2009` = boundary_set_2009, `2021` = boundary_set_2021),
      source_tables = list(
        `2009` = "Brief Results Section 7.1 Население по вероисповеданию по полу (Все население/Оба пола)",
        `2021` = "Brief Results Section 7.1 Население по вероисповеданию в разрезе регионов (Оба пола)"
      ),
      universes = list(`2009` = "all persons, all ages", `2021` = "all persons, all ages"),
      denominators = list(
        `2009` = "printed region total; affiliation = population - Non-believers - Refused to indicate",
        `2021` = "printed region total; affiliation = population - Non-believers - Refused to indicate"
      ),
      slot_design = paste(
        "Ordinary two-slot (SB/FM precedent, not the minority-share design; Kazakhstan has a real",
        "Non-believers category). religious_affiliation_percent is the summed share of Islam +",
        "Christianity + Judaism + Buddhism + Other. no_religion_percent is the single Non-believers line.",
        "Refused-to-indicate stays in the denominator and in neither slot, so the two shares need not sum to 100."
      ),
      category_frames = list(
        top_level = as.list(top_cats),
        `2009_ru` = as.list(unname(cat_ru_2009[top_cats])),
        `2021_ru_kk` = as.list(unname(cat_ru_2021[top_cats])),
        christianity_sub_2021 = list("православие", "католицизм", "протестантизм"),
        column_order_note = paste(
          "The seven top-level categories are identical across waves. The column order differs: 2009 prints",
          "Other, Non-believers, Refused; 2021 prints Other, Refused, Non-believers. Each wave is transcribed in",
          "its own printed order and labelled by wave, never by position. 2021 additionally prints a Christianity",
          "sub-breakdown (Orthodox/Catholic/Protestant) that sums to the Christianity total; it is carried verbatim",
          "on the per-region quality flag and never treated as a separate top-level category."
        )
      ),
      frame_break = paste(
        "The 2009 wave uses the 16-region frame; the 2021 wave uses the 17-region frame. South Kazakhstan Region",
        "was renamed Turkistan Region and Shymkent city was carved out as a third city of republican significance",
        "in June 2018 — a region-level frame break. The June 2022 reorganisation (Abai/Jetisu/Ulytau) postdates the",
        "2021 census and only affects the current boundary vintage. No cross-wave region change is claimed",
        "(CHANGE-WITHHOLD); the two waves ship as levels on per-vintage boundaries."
      ),
      boundary_derivation = list(
        `2009` = "geoBoundaries KAZ ADM1 (16 units, ODbL, 2017); direct one-to-one join.",
        `2021` = "OCHA COD-AB KAZ ADM1 (20 units, CC BY-IGO, 2023) dissolved to 17: Abay->East Kazakhstan, Jetisu->Almaty Region, Ulytau->Karaganda (exact complete-unit partition)."
      ),
      omitted_metrics = list("places_per_10000_residents", "place_density_per_sq_km"),
      boundary_simplification = list(`2009` = s2009$simplification, `2021` = s2021$simplification),
      local_cache_hint = "All raw sources are cached under data/raw/kz_census/ and remain git-ignored.",
      retrieval_record = raw_sources
    ),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")), digest = as.character(packageVersion("digest")),
      mapshaper = "scripts/lib/simplify_boundary.R (npx mapshaper)"
    )
  ),
  source = list(
    provider = "Bureau of National Statistics of the Republic of Kazakhstan; geoBoundaries (William & Mary geoLab); OCHA/UNHCR COD-AB",
    source_dataset_ids = list(d2009, d2021, d_gb, d_cod),
    source_urls = list(url_2009, url_2021, url_gb, url_gb_meta, url_cod, url_cod_meta, url_terms, url_terms_ru),
    retrieved_at = stamp,
    licence = census_licence_name,
    citation = "BNS 2009 Brief Results Section 7.1; BNS 2021 Brief Results Section 7.1 (getFile ESTAT464825); geoBoundaries KAZ ADM1 (ODbL); OCHA COD-AB KAZ ADM1 (CC BY-IGO).",
    raw_redistribution = "The census RAR/PDF and the boundary source files are not committed; they remain in data/raw/kz_census/.",
    local_cache_hint = "data/raw/kz_census/ (git-ignored by .gitignore data/ rule)",
    raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/kz_census/")
  ),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = list(
    durable_file_record(summary_json_out, "Kazakhstan region census-affiliation area summary for 2009 (16 regions) and 2021 (17 regions).", "accepted", licence_basis_slug),
    durable_file_record(summary_csv_out, "Flattened Kazakhstan region census-affiliation rows for 2009 and 2021.", "accepted", licence_basis_slug),
    durable_file_record(geojson_2009_out, "Simplified geoBoundaries KAZ ADM1 16-region boundary GeoJSON (2009 frame).", "accepted", "geoboundaries_odbl"),
    durable_file_record(geojson_2021_out, "Simplified OCHA COD-AB KAZ 17-region boundary GeoJSON (2021 frame, dissolved).", "accepted", "ocha_codab_cc_by_igo")
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id,
         notes = "33 rows: 16 regions (2009) + 17 regions (2021); all-persons universe in every wave; no suppressed cells."),
    list(uri = paste0("repo:", geojson_2009_out), sha256 = sha256_file(geojson_2009_out), built_by = script_id,
         notes = "16 region features from geoBoundaries KAZ ADM1, simplified with mapshaper."),
    list(uri = paste0("repo:", geojson_2021_out), sha256 = sha256_file(geojson_2021_out), built_by = script_id,
         notes = "17 region features from OCHA COD-AB (dissolved), simplified with mapshaper.")
  ),
  validation = list(
    status = "passed",
    commands = list(
      paste("Rscript", script_id),
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/kz/data/area_summary_region.json",
      "bash scripts/validate_manifests.sh"
    ),
    gate_2009 = list(status = "passed", both_margins_close_to = unname(nat_2009[["total"]]),
                     region_row_checks = 16L, religion_column_checks = length(top_cats),
                     records = reconciliation_block(rec_2009)),
    gate_2021 = list(status = "passed", both_margins_close_to = unname(nat_2021[["total"]]),
                     region_row_checks = 17L, religion_column_checks = length(top_cats),
                     records = reconciliation_block(rec_2021)),
    boundary_validation = list(
      `2009` = list(status = "passed", feature_count = 16L,
                    distinct_geometry_hashes = length(unique(s2009$hashes)),
                    bbox = as.list(s2009$bbox), output_bytes = file_bytes(geojson_2009_out),
                    licence = gb_meta[["boundaryLicense"]], adm_unit_count = gb_meta[["admUnitCount"]]),
      `2021` = list(status = "passed", feature_count = 17L,
                    distinct_geometry_hashes = length(unique(s2021$hashes)),
                    bbox = as.list(s2021$bbox), output_bytes = file_bytes(geojson_2021_out),
                    licence = cod_meta[["result"]][["license_title"]],
                    dissolve = "Abay->East Kazakhstan; Jetisu->Almaty Region; Ulytau->Karaganda")),
    join_coverage = list(matched_2009 = 16L, expected_2009 = 16L, matched_2021 = 17L, expected_2021 = 17L),
    notes = paste(
      "2009 (16 regions) and 2021 (17 regions) each close exactly at both margins: every region row and every",
      "religion column sum to the printed national total (16,009,597 in 2009; 19,186,015 in 2021). 2021 Christianity",
      "sub-columns (Orthodox+Catholic+Protestant) sum to the Christianity total. Boundaries join 16/16 and 17/17."
    ),
    warnings = list(
      "Per-vintage boundaries: the 2009 wave rides geoBoundaries ADM1 (16 units, ODbL); the 2021 wave rides OCHA COD-AB (17 units after dissolving the three 2022-created regions, CC BY-IGO).",
      "Region-level frame break (2018 South Kazakhstan -> Turkistan + Shymkent): no cross-wave region change is claimed.",
      "The Refused-to-indicate line is a disclosed denominator residual (national 0.5% in 2009, 11.0% in 2021), in neither headline slot; affiliation and no-religion shares need not sum to 100%.",
      "The 2021 source (BNS getFile ESTAT464825) is durable only via the Internet Archive capture of 2022-09-02; the live id is stale."
    )
  ),
  construct_notes = list(
    "The construct is census affiliation: each resident's reported religion (asked of all persons of all ages), not practice, attendance, or membership. Religion was first asked in the 2009 census and again in 2021.",
    "The public product carries three headline fields per region-wave: population total, religious affiliation percent, and no-religion percent. Place-density metrics are null (no governed place-of-worship snapshot).",
    "The seven top-level categories (Islam, Christianity, Judaism, Buddhism, Other, Non-believers, Refused to indicate) are identical across waves and preserved verbatim per wave. 2021 additionally prints a Christianity sub-breakdown (Orthodox/Catholic/Protestant) carried on the per-region flag.",
    "Slot design (ordinary two-slot, SB/FM precedent): religious_affiliation_percent is the summed share of Islam + Christianity + Judaism + Buddhism + Other; no_religion_percent is the single Non-believers line. Refused-to-indicate is a disclosed residual kept in the denominator and in neither slot, so the two shares need not sum to 100.",
    "The 2009 wave uses the 16-region frame and the 2021 wave the 17-region frame; South Kazakhstan Region split into Turkistan Region + Shymkent city in 2018. This is a region-level frame break, so no cross-wave region change is claimed. The 2022 reorganisation (Abai/Jetisu/Ulytau) postdates the 2021 census.",
    "Boundaries are per vintage: 2009 on geoBoundaries KAZ ADM1 (16 units, ODbL, direct join); 2021 on OCHA COD-AB KAZ ADM1 (CC BY-IGO) dissolved from 20 to 17 by folding the three 2022-created regions into their pre-2022 parents (Abay->East Kazakhstan, Jetisu->Almaty Region, Ulytau->Karaganda).",
    "Licence: the census data ship under the Bureau of National Statistics open reuse grant (free reuse for any purpose with source attribution, quoted verbatim in the manifest source.licence and captured under data/raw/kz_census/). No reuse ask is needed; the product ships with attribution to the Bureau of National Statistics."
  ),
  deferred_sources = list(
    list(source_dataset_id = "kz-census-religion-by-nationality-age", status = "deferred",
         url = url_2021, local_path = NULL,
         notes = "Both waves cross-tab religion by nationality and by age nationally (2009 analytical report Section 4.4; 2021 collection tables 12-14). Not a region series; a future national-context lane."),
    list(source_dataset_id = "kz-region-urban-rural-religion", status = "deferred",
         url = url_2009, local_path = NULL,
         notes = "Both Brief Results Section 7.1 tables also split religion by urban/rural and by sex within region. Only the all-persons/both-sexes block is shipped; the urban/rural and sex cuts are a deeper future product.")
  ),
  privacy = "public",
  licence_status = "accepted",
  licence_basis = licence_basis_slug,
  downstream_status = "accepted",
  source_datasets = source_datasets(),
  notes = paste(
    "Accepted product (open BNS reuse licence with attribution). The committed products are the derived region area",
    "summary (33 rows across 2009 and 2021) and two per-vintage boundary GeoJSONs (geoBoundaries 16-region 2009,",
    "COD-AB 17-region 2021). On-page attribution, when a page is built, must cite the Bureau of National Statistics",
    "of the Republic of Kazakhstan, geoBoundaries (ODbL), and OCHA/UNHCR COD-AB (CC BY-IGO)."
  )
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

cat("waves shipped: 2009 (16 regions), 2021 (17 regions) on per-vintage boundaries\n")
cat(sprintf("rows: %d (16 + 17)\n", length(rows)))
cat(sprintf("gate 2009: passed; both margins close to %d\n", nat_2009[["total"]]))
cat(sprintf("gate 2021: passed; both margins close to %d\n", nat_2021[["total"]]))
cat(sprintf("boundary 2009: 16 features, %d bytes; boundary 2021: 17 features, %d bytes\n",
            file_bytes(geojson_2009_out), file_bytes(geojson_2021_out)))
cat("licence: accepted (BNS open reuse with attribution); ODbL 2009 boundary; CC BY-IGO 2021 boundary\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", geojson_2009_out))
cat(sprintf("wrote %s\n", geojson_2021_out))
cat(sprintf("wrote %s\n", manifest_out))
