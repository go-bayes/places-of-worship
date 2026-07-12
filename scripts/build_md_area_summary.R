# build the Moldova raion/municipality census-religion area-summary product for
# three waves (2004, 2014, 2024) on one stable 35-unit right-bank frame
# (Mun. Chişinău, Mun. Bălţi, 32 raions, U.T.A. Găgăuzia). one licensed boundary
# set (geoBoundaries MDA ADM1, 37 units, CC BY 3.0 IGO) serves all waves: 35 units
# carry every wave; the two left-bank polygons (Transnistria, Bender) join the
# boundary but carry NO census religion in any wave and render as disclosed
# no-data features (never zero). see research/countries/md/route-probe.md for
# full provenance, sha256, and the territorial-scope statement.
#   inputs (all cached, git-ignored under data/raw/md_census/):
#   Recensamint_2004_vol.I.pdf  <- 2004 census Vol I, Table 5.2 (unit x religion); transcribed inline
#   Caracteristici_populatie_Comune_RPL_2014_rom_rus_eng.xls <- 2014 sheet 2.1 (read live)
#   Anexa_Caracteristici_Etnoculturale_RPL2024.xlsx <- 2024 sheet 5.29 counts (read live)
#   geoBoundaries-MDA-ADM1.geojson  <- raion/municipality boundary (37 units, CC BY 3.0 IGO)
# every religion cell is transcribed/read verbatim from its cached source and
# reconciled against the printed control totals here; the build stops on any
# margin mismatch and never allocates, infers, rounds, imputes, or tunes a value.
# 2024 "-" reads as magnitude zero (per the source footnote). category frames
# differ per wave and are preserved verbatim; the two-slot headline metrics ship
# as levels on each wave's own frame and a fine-category cross-wave change is
# withheld (change_withheld).
# outputs: apps/regions/md/data/{md_raion.geojson, area_summary_raion.json,
#   area_summary_raion.csv} and docs/manifests/md-census-religion-2004-2024.json.
# run from the repo root: Rscript scripts/build_md_area_summary.R

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(readxl)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "MD"
script_id <- "scripts/build_md_area_summary.R"
raw_dir <- "data/raw/md_census"
product_dir <- "apps/regions/md/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-12"
stamp <- paste0(retrieval_date, "T00:00:00Z")
git_commit <- trimws(system2("git", c("rev-parse", "HEAD"), stdout = TRUE))
if (length(git_commit) != 1L || !grepl("^[a-f0-9]{40}$", git_commit)) git_commit <- NULL

# ---- dataset ids ---------------------------------------------------------------
d2004 <- "md-census-2004-vol1-table5-2-religion-by-territory"
d2014 <- "md-census-2014-population-by-religion-territorial"
d2024 <- "md-census-2024-ethnocultural-annex-5-29-religion-by-raion"
d_gb <- "geoboundaries-mda-adm1-2020"
boundary_set_id <- "md-raion-geoboundaries-adm1"

# ---- source urls and cached paths ----------------------------------------------
url_2004 <- "https://statistica.gov.md/files/files/publicatii_electronice/Recensamint/recensamint_2004_vol.I.zip"
url_2014 <- "https://statistica.gov.md/public/files/Recensamint/Recensamint_pop_2014/Rezultate/Tabele/Caracteristici_populatie_Comune_RPL_2014_rom_rus_eng.xls"
url_2024 <- "https://statistica.gov.md/files/files/ComPresa/Recensamant/2024/Ro/Anexa_Caracteristici_Etnoculturale_RPL2024.xlsx"
url_gb <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/MDA/ADM1/geoBoundaries-MDA-ADM1.geojson"
url_gb_meta <- "https://www.geoboundaries.org/api/current/gbOpen/MDA/ADM1/"
url_terms <- "https://statistica.gov.md/en/terms-and-conditions-139_4417.html"

path_2004_pdf <- file.path(raw_dir, "Recensamint_2004_vol.I.pdf")
path_2014 <- file.path(raw_dir, "Caracteristici_populatie_Comune_RPL_2014_rom_rus_eng.xls")
path_2024 <- file.path(raw_dir, "Anexa_Caracteristici_Etnoculturale_RPL2024.xlsx")
path_gb <- file.path(raw_dir, "geoBoundaries-MDA-ADM1.geojson")
path_gb_meta <- file.path(raw_dir, "gb_mda_adm1_meta.json")

geojson_out <- file.path(product_dir, "md_raion.geojson")
summary_json_out <- file.path(product_dir, "area_summary_raion.json")
summary_csv_out <- file.path(product_dir, "area_summary_raion.csv")
manifest_out <- file.path(manifest_dir, "md-census-religion-2004-2024.json")

# ---- helpers -------------------------------------------------------------------
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
# order-independent name key: fold RO diacritics to the geoBoundaries ASCII form,
# strip administrative prefixes and punctuation. both â and î fold to i because the
# boundary layer writes these raion names with i (Hincesti, RIscani, SIngerei).
norm_key <- function(x) {
  x <- tolower(as.character(x))
  x <- gsub("ă", "a", x)                 # ă
  x <- gsub("[âî]", "i", x)         # â, î -> i
  x <- gsub("[şș]", "s", x)         # ş, ș
  x <- gsub("[ţț]", "t", x)         # ţ, ț
  x <- gsub("ó", "o", x)
  x <- gsub("\\b(mun|municipiul|u\\.?t\\.?a|uta|raionul|r-nul)\\b", "", x)
  gsub("[^a-z0-9]", "", x)
}
num0 <- function(x) {                          # coerce cells to numeric; "-" and blanks read as magnitude zero
  x <- as.character(x); x[is.na(x) | x == "-" | x == ""] <- "0"; as.numeric(x)
}

# ---- stable 35-unit identity (slug -> display label; -> geoBoundaries shapeName) ----
slug35 <- c("chisinau","balti","anenii_noi","basarabeasca","briceni","cahul","cantemir",
  "calarasi","causeni","cimislia","criuleni","donduseni","drochia","dubasari","edinet",
  "falesti","floresti","glodeni","hincesti","ialoveni","leova","nisporeni","ocnita","orhei",
  "rezina","riscani","singerei","soroca","straseni","soldanesti","stefan_voda","taraclia",
  "telenesti","ungheni","gagauzia")
label35 <- c(
  chisinau="Mun. Chişinău", balti="Mun. Bălţi", anenii_noi="Anenii Noi",
  basarabeasca="Basarabeasca", briceni="Briceni", cahul="Cahul", cantemir="Cantemir",
  calarasi="Călăraşi", causeni="Căuşeni", cimislia="Cimişlia",
  criuleni="Criuleni", donduseni="Donduşeni", drochia="Drochia", dubasari="Dubăsari",
  edinet="Edineţ", falesti="Făleşti", floresti="Floreşti", glodeni="Glodeni",
  hincesti="Hînceşti", ialoveni="Ialoveni", leova="Leova", nisporeni="Nisporeni",
  ocnita="Ocniţa", orhei="Orhei", rezina="Rezina", riscani="Rîşcani",
  singerei="Sîngerei", soroca="Soroca", straseni="Străşeni",
  soldanesti="Şoldăneşti", stefan_voda="Ştefan Vodă", taraclia="Taraclia",
  telenesti="Teleneşti", ungheni="Ungheni", gagauzia="U.T.A. Găgăuzia")
# the two left-bank polygons the census never enumerates; carried as disclosed no-data.
slug_nodata <- c("transnistria", "bender")
label_nodata <- c(transnistria = "Transnistria (stânga Nistrului)", bender = "Bender")

# ---- category frames (verbatim per wave; never merged) -------------------------
# 2004 Table 5.2 columns (15), printed order across the two-block spread.
cats2004 <- c("Ortodoxă","Romano-catolică","Reformată",
  "Evanghelică de confesiune augustană","Evanghelică sinodo-prezbiter.",
  "Creştină de rit vechi","Baptistă","Penticostală",
  "Adventistă de ziua a şaptea","Creştină după Evanghelie",
  "Musulmană","Alte religii","Atei","Fără religie","Nedeclarată")
tax2004 <- c("christian.orthodox","christian.catholic","christian.reformed","christian.lutheran",
  NA,"russian_orthodox","christian.baptist","christian.pentecostal","christian.seventh_day_adventist",
  "christian.evangelical","islam",NA,NA,NA,NA)
aff2004 <- 1:12; norel2004 <- 13:14; resid2004 <- 15L

# 2014 sheet 2.1 declared-block columns (14), printed order; not-declared is a
# separate column outside the 14.
cats2014 <- c("Ortodoxă","Creştină de rit vechi","Catolică",
  "Evanghelică de Confesiune Augustană (Luterană)","Creştină Evanghelic Baptistă",
  "Creştină după Evanghelie","Adventistă de Ziua a şaptea",
  "Penticostală (Biserica lui Dumnezeu Apostolică)","Martorii lui Iehova",
  "Iudaism","Islam","Alte grupări religioase","Agnostic","Ateu")
tax2014 <- c("christian.orthodox","russian_orthodox","christian.catholic","christian.lutheran",
  "christian.baptist","christian.evangelical","christian.seventh_day_adventist",
  "christian.pentecostal","christian.jehovahs_witnesses","judaism","islam",NA,NA,NA)
lab2014_notdecl <- "Populaţia care nu a declarat religia"
aff2014 <- 1:12; norel2014 <- 13:14  # residual = not-declared column (separate)

# 2024 sheet 5.29 declared-block columns (14), printed order; not-declared separate.
cats2024 <- c("Ortodoxă","Baptistă","Martorii lui Iehova","Penticostală",
  "Adventistă","Creștină după Evanghelie","Staroveri (Ortodoxă Rusă de rit vechi)",
  "Islam","Catolică","Alte religii","Liber cugetător","Agnostic","Ateu","Fără religie")
tax2024 <- c("christian.orthodox","christian.baptist","christian.jehovahs_witnesses",
  "christian.pentecostal","christian.seventh_day_adventist","christian.evangelical",
  "russian_orthodox","islam","christian.catholic",NA,NA,NA,NA,NA)
lab2024_notdecl <- "Nu au declarat religia"
aff2024 <- 1:10; norel2024 <- 11:14  # residual = not-declared column (separate)

# ---- 2004 wave: Vol I Table 5.2, transcribed verbatim (35 units x 15 cols) ------
# order: Ortodoxă Romano-cat Reformată Ev.augustană Ev.sinodo-prezb Creştină-rit-vechi
#        Baptistă | Penticostală Adventistă Creştină-după-Ev Musulmană Alte-religii Atei Fără-religie Nedeclarată
m2004 <- rbind(
 chisinau     = c(629310,2227,265,279,1043,98,4425, 1256,996,1991,995,4831,10477,9990,44035),
 balti        = c(110961,990,44,77,296,47,2609, 487,576,166,106,2161,544,3304,5193),
 anenii_noi   = c(78159,141,41,22,28,14,453, 72,95,48,30,379,89,946,1193),
 basarabeasca = c(27149,16,12,5,11,2,485, 144,303,157,11,24,6,320,333),
 briceni      = c(62181,31,26,36,24,1,794, 1796,520,84,11,6111,132,3269,3011),
 cahul        = c(106535,40,74,22,50,24,4142, 255,1479,68,32,513,442,2840,2715),
 cantemir     = c(58003,16,10,19,15,0,541, 120,262,22,5,161,4,488,335),
 calarasi     = c(73388,8,60,24,25,0,138, 24,339,22,14,159,10,261,603),
 causeni      = c(88052,17,22,63,35,5,648, 435,118,79,15,184,14,416,509),
 cimislia     = c(58501,8,10,65,19,8,479, 22,697,15,15,59,18,496,513),
 criuleni     = c(70778,28,25,22,21,0,368, 24,94,15,15,194,6,258,406),
 donduseni    = c(43690,23,10,38,28,748,23, 137,151,100,14,663,12,343,462),
 drochia      = c(84494,28,62,103,144,4,441, 246,166,34,16,296,47,301,710),
 dubasari     = c(33189,2,3,19,15,0,23, 27,30,15,8,79,4,81,520),
 edinet       = c(71234,44,28,39,122,137,340, 919,901,447,10,3798,63,1212,2096),
 falesti      = c(86207,19,1,24,16,434,1292, 261,229,74,15,429,36,470,813),
 floresti     = c(84794,23,21,24,80,2370,292, 97,360,37,16,508,64,156,547),
 glodeni      = c(58760,216,12,12,15,0,656, 67,69,39,15,467,15,312,320),
 hincesti     = c(114111,37,73,28,125,5,2247, 360,1020,262,9,183,50,436,816),
 ialoveni     = c(95752,22,47,14,68,0,278, 122,207,24,35,360,14,170,591),
 leova        = c(49566,12,6,11,68,0,77, 36,305,23,4,95,43,181,629),
 nisporeni    = c(64150,7,11,5,87,1,112, 97,69,11,6,35,3,89,241),
 ocnita       = c(54091,70,7,50,139,5,324, 91,96,78,18,366,33,289,853),
 orhei        = c(113515,88,39,60,97,4,498, 66,255,72,26,407,47,325,772),
 rezina       = c(46626,14,1,14,33,0,304, 49,234,22,9,119,2,472,206),
 riscani      = c(66896,30,17,31,25,0,458, 368,255,28,17,706,7,249,367),
 singerei     = c(79137,237,4,125,79,1168,2989, 680,1112,458,12,265,12,107,768),
 soroca       = c(92878,21,27,47,127,2,111, 94,202,21,13,493,60,427,463),
 straseni     = c(86324,42,10,21,73,0,610, 179,318,96,26,182,21,359,639),
 soldanesti   = c(41485,7,3,5,47,0,64, 71,98,7,2,105,4,81,248),
 stefan_voda  = c(66613,6,42,20,51,6,2128, 85,157,47,20,117,1,701,600),
 taraclia     = c(40701,14,6,2,62,3,573, 110,84,157,17,219,141,558,507),
 telenesti    = c(68722,15,45,7,78,3,299, 36,268,57,5,173,9,84,325),
 ungheni      = c(107283,51,88,11,120,0,1009, 50,195,40,23,216,24,630,805),
 gagauzia     = c(144780,95,38,85,330,5,2524, 296,1243,259,82,470,270,2586,2583))
colnames(m2004) <- cats2004
tot2004 <- c(chisinau=712218,balti=127561,anenii_noi=81710,basarabeasca=28978,briceni=78027,
 cahul=119231,cantemir=60001,calarasi=75075,causeni=90612,cimislia=60925,criuleni=72254,
 donduseni=46442,drochia=87092,dubasari=34015,edinet=81390,falesti=90320,floresti=89389,
 glodeni=60975,hincesti=119762,ialoveni=97704,leova=51056,nisporeni=64924,ocnita=56510,
 orhei=116271,rezina=48105,riscani=69454,singerei=87153,soroca=94986,straseni=88900,
 soldanesti=42227,stefan_voda=70594,taraclia=43154,telenesti=70126,ungheni=110545,gagauzia=155646)
tot2004 <- tot2004[slug35]; m2004 <- m2004[slug35, , drop = FALSE]
notdecl2004 <- m2004[, resid2004]   # Nedeclarată is column 15 of the 2004 frame

# ---- 2014 wave: read sheet 2.1 live, key to slug (order-independent) ------------
require_file(path_2014)
raw14 <- as.data.frame(suppressMessages(read_excel(path_2014, sheet = "2.1.",
  col_names = FALSE, .name_repair = "minimal")))
body14 <- raw14[7:41, ]                     # the 35 unit rows
key14 <- norm_key(body14[[1]])
idx14 <- match(norm_key(slug35), key14)     # fold underscores in the slug to the same key form
if (anyNA(idx14) || anyDuplicated(idx14[!is.na(idx14)])) stop("2014 units do not key 1:1 to the 35 slugs", call. = FALSE)
body14 <- body14[idx14, ]
tot2014 <- num0(body14[[2]])                # Total populaţie
decl2014 <- num0(body14[[3]])               # Populaţia care a declarat religia
notdecl2014 <- num0(body14[[18]])           # Populaţia care nu a declarat religia
m2014 <- t(vapply(4:17, function(j) num0(body14[[j]]), numeric(35)))
m2014 <- t(m2014); rownames(m2014) <- slug35; colnames(m2014) <- cats2014
names(tot2014) <- names(decl2014) <- names(notdecl2014) <- slug35

# ---- 2024 wave: read sheet 5.29 live, drop region aggregates, key to slug -------
require_file(path_2024)
raw24 <- as.data.frame(suppressMessages(read_excel(path_2024, sheet = "5.29",
  col_names = FALSE, .name_repair = "minimal")))
body24 <- raw24[11:48, ]
keep24 <- !is.na(body24[[1]]) & trimws(as.character(body24[[1]])) != ""  # units carry a CUATM code; Total/Nord/Centru/Sud do not
body24 <- body24[keep24, ]
if (nrow(body24) != 35L) stop("2024 unit filter did not yield 35 rows", call. = FALSE)
key24 <- norm_key(body24[[2]])
idx24 <- match(norm_key(slug35), key24)
if (anyNA(idx24) || anyDuplicated(idx24[!is.na(idx24)])) stop("2024 units do not key 1:1 to the 35 slugs", call. = FALSE)
body24 <- body24[idx24, ]
cuatm2024 <- trimws(as.character(body24[[1]]))
tot2024 <- num0(body24[[3]])                # Total (populaţie cu reşedinţă obişnuită)
notdecl2024 <- num0(body24[[18]])           # Nu au declarat religia
m2024 <- t(vapply(4:17, function(j) num0(body24[[j]]), numeric(35)))
m2024 <- t(m2024); rownames(m2024) <- slug35; colnames(m2024) <- cats2024
names(tot2024) <- names(notdecl2024) <- slug35

# ---- reconciliation gates (fail-fast; stop, do not tune) -----------------------
recs <- list()
add_rec <- function(year, margin, key, computed, printed) {
  recs[[length(recs) + 1L]] <<- data.frame(year = year, margin = margin, key = key,
    computed = as.integer(computed), printed = as.integer(printed),
    difference = as.integer(computed - printed), stringsAsFactors = FALSE)
}
# 2004: every unit row's 15 categories sum to its printed total; grand total exact.
for (s in slug35) {
  rs <- sum(m2004[s, ])
  if (rs != tot2004[[s]]) stop(sprintf("2004 row gate FAILED for %s: sum %d != total %d", s, rs, tot2004[[s]]), call. = FALSE)
  add_rec(2004L, "unit_row", s, rs, tot2004[[s]])
}
if (sum(tot2004) != 3383332L) stop(sprintf("2004 grand gate FAILED: %d != 3383332", sum(tot2004)), call. = FALSE)
add_rec(2004L, "national_total", "Republica Moldova", sum(tot2004), 3383332L)
add_rec(2004L, "national_orthodox", "Ortodoxă", sum(m2004[, 1]), 3158015L)
if (sum(m2004[, 1]) != 3158015L) stop("2004 Orthodox national gate FAILED", call. = FALSE)

# 2014: Total = declared + not-declared, and declared = sum(14 categories), per unit; grand total exact.
for (s in slug35) {
  cs <- sum(m2014[s, ])
  if (cs != decl2014[[s]]) stop(sprintf("2014 declared gate FAILED for %s: cats %d != declared %d", s, cs, decl2014[[s]]), call. = FALSE)
  if (decl2014[[s]] + notdecl2014[[s]] != tot2014[[s]]) stop(sprintf("2014 total gate FAILED for %s", s), call. = FALSE)
  add_rec(2014L, "unit_declared_plus_notdeclared", s, decl2014[[s]] + notdecl2014[[s]], tot2014[[s]])
}
if (sum(tot2014) != 2804801L) stop(sprintf("2014 grand gate FAILED: %d != 2804801", sum(tot2014)), call. = FALSE)
add_rec(2014L, "national_total", "Total populaţie", sum(tot2014), 2804801L)
add_rec(2014L, "national_orthodox", "Ortodoxă", sum(m2014[, 1]), 2528152L)
if (sum(m2014[, 1]) != 2528152L) stop("2014 Orthodox national gate FAILED", call. = FALSE)

# 2024: Total = sum(14 categories) + not-declared, per unit; grand total + Orthodox exact.
for (s in slug35) {
  if (sum(m2024[s, ]) + notdecl2024[[s]] != tot2024[[s]]) stop(sprintf("2024 total gate FAILED for %s", s), call. = FALSE)
  add_rec(2024L, "unit_categories_plus_notdeclared", s, sum(m2024[s, ]) + notdecl2024[[s]], tot2024[[s]])
}
if (sum(tot2024) != 2409207L) stop(sprintf("2024 grand gate FAILED: %d != 2409207", sum(tot2024)), call. = FALSE)
add_rec(2024L, "national_total", "Total", sum(tot2024), 2409207L)
add_rec(2024L, "national_orthodox", "Ortodoxă", sum(m2024[, 1]), 2271105L)
if (sum(m2024[, 1]) != 2271105L) stop("2024 Orthodox national gate FAILED", call. = FALSE)
reconciliation <- do.call(rbind, recs)
message("gate 2004: PASSED (35 unit rows close; national 3,383,332; Orthodox 3,158,015)")
message("gate 2014: PASSED (35 units: declared+not-declared=total; national 2,804,801; Orthodox 2,528,152)")
message("gate 2024: PASSED (35 units: categories+not-declared=total; national 2,409,207; Orthodox 2,271,105)")

# ---- boundary: 37 features (35 census + Transnistria + Bender no-data) ----------
require_file(path_gb); require_file(path_gb_meta)
gb_meta <- fromJSON(path_gb_meta, simplifyVector = FALSE)
if (!identical(gb_meta[["boundaryLicense"]], "Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO)") ||
    !identical(gb_meta[["admUnitCount"]], "37") ||
    !identical(gb_meta[["boundaryType"]], "ADM1")) {
  stop("geoBoundaries MDA ADM1 licence, unit count, or type metadata changed", call. = FALSE)
}
gb <- st_make_valid(st_read(path_gb, quiet = TRUE, stringsAsFactors = FALSE))
if (nrow(gb) != 37L) stop("geoBoundaries MDA ADM1 feature count is not 37", call. = FALSE)
gb_key <- norm_key(gb[["shapeName"]])
# 35 census units join one-to-one; the two extra polygons are exactly Transnistria + Bender.
all_slugs <- c(slug35, slug_nodata)
idx_gb <- match(norm_key(all_slugs), gb_key)
if (anyNA(idx_gb) || anyDuplicated(idx_gb)) stop("census + no-data units do not join geoBoundaries shapeNames one-to-one", call. = FALSE)
if (length(idx_gb) != 37L) stop("boundary join is not 37 features", call. = FALSE)
boundary <- gb[idx_gb, ]
all_label <- c(label35, label_nodata)
boundary[["area_code"]] <- all_slugs
boundary[["area_name"]] <- unname(all_label[all_slugs])
boundary[["boundary_source_name"]] <- gb[["shapeName"]][idx_gb]
boundary[["area_unit_id"]] <- paste(boundary_set_id, all_slugs, sep = ":")
boundary[["boundary_set_id"]] <- boundary_set_id
boundary[["boundary_level"]] <- "raion"
# Moldova-centred equal-area projection for land areas.
md_laea <- "+proj=laea +lat_0=47 +lon_0=28.5 +datum=WGS84 +units=m +no_defs"
boundary[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(boundary, md_laea))) / 1e6
boundary <- st_make_valid(st_set_precision(st_transform(st_make_valid(boundary), 4326), 1e5))
boundary <- boundary[c("area_code", "area_name", "boundary_source_name", "area_unit_id",
                       "boundary_set_id", "boundary_level", "land_area_sq_km", "geometry")]

simplification <- mapshaper_simplify_to_cap(
  boundary, geojson_out, max_bytes = 2500000L,
  keep_percentages = c(60, 40, 25, 15, 10, 6, 4), clean_option = "allow-overlaps")
written <- st_read(geojson_out, quiet = TRUE, stringsAsFactors = FALSE)
written <- written[match(boundary[["area_code"]], written[["area_code"]]), ]
if (anyNA(written[["area_code"]]) || nrow(written) != 37L) stop("simplified boundary lost a unit", call. = FALSE)
w_valid <- st_is_valid(written)
if (any(st_is_empty(written)) || any(is.na(w_valid)) || any(!w_valid)) stop("simplified boundary invalid", call. = FALSE)
hashes <- geometry_hashes(written)
if (length(unique(hashes)) != 37L) stop("simplified geometry hashes not distinct", call. = FALSE)
land_area <- setNames(written[["land_area_sq_km"]], written[["area_code"]])
message(sprintf("boundary: PASSED (37 distinct features, %d bytes at %g%% keep)",
                file_bytes(geojson_out), simplification[["keep_percent"]]))

# ---- small-cell scan (published counts; docs/development/small-cell-rule.md) ----
# under_10 marks a row where any published category numerator falls under 10; the
# denominator threshold (100) is never triggered at raion grain (smallest 14,914).
small_cell_counts <- list()
smallest_numerator <- Inf; smallest_denominator <- Inf
scan_small <- function(mat, tots, year) {
  n_under10 <- 0L
  for (s in rownames(mat)) {
    if (min(tots[[s]]) < smallest_denominator) smallest_denominator <<- tots[[s]]
    if (min(mat[s, ]) < smallest_numerator) smallest_numerator <<- min(mat[s, ])
    if (any(mat[s, ] < 10)) n_under10 <- n_under10 + 1L
  }
  small_cell_counts[[as.character(year)]] <<- list(rows_with_small_cell_under_10 = n_under10, rows = nrow(mat))
}
scan_small(m2004, tot2004, 2004L)
scan_small(m2014, tot2014, 2014L)
scan_small(m2024, tot2024, 2024L)

# ---- row construction ----------------------------------------------------------
# fine-category cross-wave change is withheld: the three frames break (2004 splits
# Atei/Fără religie/Nedeclarată; 2014 carries Agnostic/Ateu inside declared with a
# single not-declared column and no separate fără religie; 2024 splits Liber
# cugetător/Agnostic/Ateu/Fără religie). the two-slot headline metrics ship as
# levels on each wave's own frame.
change_token <- "fine_category_cross_wave_change_withheld"

flag_common <- paste(
  "census_affiliation", "whole_enumerated_population_all_ages_universe",
  "single_select_reported_religion",
  "religious_affiliation_percent_is_declared_religion_share",
  "raion_frame_stable_across_waves",
  "category_frames_differ_per_wave_no_cross_wave_category_change",
  change_token,
  "right_bank_only_transnistria_and_bender_not_enumerated",
  "census_licence_open_reuse_with_attribution_cc_by_4_0",
  sep = ";")

basis_text <- c(
  `2004` = paste(
    "2004 Population Census of Moldova, Volume I, Table 5.2 (Populaţia după religie,",
    "în profil teritorial), whole enumerated resident population of all ages as of 5 October 2004;",
    "the denominator is the printed unit total. Right bank only ('cu excepţia raioanelor de Est",
    "şi a municipiului Bender'). Affiliation = total - Atei - Fără religie - Nedeclarată;",
    "no-religion = Atei + Fără religie; Nedeclarată stays in the denominator, outside both slots."),
  `2014` = paste(
    "2014 Population and Housing Census of Moldova, table 2.1 (Populaţia după religie, în",
    "profil teritorial), whole enumerated population of all ages; the denominator is the printed",
    "Total populaţie. Right bank only. Affiliation = the 12 named confessions (declared religion",
    "minus Agnostic and Ateu); no-religion = Agnostic + Ateu; 'Populaţia care nu a declarat",
    "religia' stays in the denominator, outside both slots. Enumerated base; a later usual-resident",
    "revision is not reconciled here (each wave read in its own published denominator)."),
  `2024` = paste(
    "2024 Population and Housing Census of Moldova, ethnocultural annex table 5.29 (counts),",
    "usual-resident population of all ages; the denominator is the printed Total. Right bank only",
    "(annex footnote lists the non-enumerated left-bank localities). Affiliation = the 10 named",
    "categories (Ortodoxă ... Alte religii); no-religion = Liber cugetător + Agnostic + Ateu +",
    "Fără religie; 'Nu au declarat religia' stays in the denominator, outside both slots.",
    "'-' reads as magnitude zero per the source footnote."))

# per-unit territorial-scope note where the record needs one (2024 footnote localities).
scope_note <- function(slug) {
  if (slug == "causeni") return("territorial_scope=causeni_enumerated_in_controlled_part_only_left_bank_localities_cremenciug_and_gisca_not_enumerated_polygon_spans_full_extent")
  if (slug == "dubasari") return("territorial_scope=dubasari_enumerated_in_controlled_part_only_left_bank_localities_corjova_mahala_roghi_not_enumerated_polygon_spans_full_extent")
  NULL
}

# build one composition list for a unit-wave: one item per verbatim category with
# its published count and, where unambiguous, a denomination-taxonomy.json code.
composition_of <- function(mat, slug, labels, taxa, notdecl_label = NULL, notdecl_count = NULL) {
  comp <- list()
  for (k in seq_along(labels)) {
    item <- list(label_verbatim = labels[k], count = as.integer(mat[slug, k]))
    if (!is.na(taxa[k])) item[["taxonomy_code"]] <- taxa[k]
    comp[[length(comp) + 1L]] <- item
  }
  if (!is.null(notdecl_label)) {
    comp[[length(comp) + 1L]] <- list(label_verbatim = notdecl_label, count = as.integer(notdecl_count))
  }
  comp
}

make_census_row <- function(slug, year) {
  if (year == 2004L) {
    mat <- m2004; pop <- as.integer(tot2004[[slug]]); labels <- cats2004; taxa <- tax2004
    affiliation <- sum(mat[slug, aff2004]); no_rel <- sum(mat[slug, norel2004])
    comp <- composition_of(mat, slug, labels, taxa)   # Nedeclarată is category 15, already in labels
  } else if (year == 2014L) {
    mat <- m2014; pop <- as.integer(tot2014[[slug]]); labels <- cats2014; taxa <- tax2014
    affiliation <- sum(mat[slug, aff2014]); no_rel <- sum(mat[slug, norel2014])
    comp <- composition_of(mat, slug, labels, taxa, lab2014_notdecl, notdecl2014[[slug]])
  } else {
    mat <- m2024; pop <- as.integer(tot2024[[slug]]); labels <- cats2024; taxa <- tax2024
    affiliation <- sum(mat[slug, aff2024]); no_rel <- sum(mat[slug, norel2024])
    comp <- composition_of(mat, slug, labels, taxa, lab2024_notdecl, notdecl2024[[slug]])
  }
  dataset <- switch(as.character(year), `2004` = d2004, `2014` = d2014, `2024` = d2024)
  # under-10 numerator marker from the published category counts of this row.
  numerators <- as.integer(mat[slug, ])
  small_flag <- if (any(numerators < 10L)) "small_cell_under_10" else NULL
  flag_parts <- c(flag_common, scope_note(slug), small_flag)
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = "raion",
    area_unit_id = paste(boundary_set_id, slug, sep = ":"),
    area_code = slug,
    area_name = unname(label35[[slug]]),
    year = as.integer(year),
    population_total = pop,
    population_total_basis = basis_text[[as.character(year)]],
    religious_affiliation_count = as.integer(affiliation),
    religious_affiliation_percent = round(100 * affiliation / pop, 4),
    no_religion_count = as.integer(no_rel),
    no_religion_percent = round(100 * no_rel / pop, 4),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = unname(round(land_area[[slug]], 4)),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(dataset, d_gb),
    quality_flag = paste(flag_parts[nzchar(flag_parts)], collapse = ";"),
    composition = comp)
}

# no-data row for a left-bank polygon in a given wave: the census does not
# enumerate it, so every metric is null and the polygon renders as no-data.
nodata_basis <- paste(
  "The National Bureau of Statistics enumerates the right bank only; this left-bank",
  "polygon is not enumerated in any post-Soviet Moldovan census. No census religion is",
  "reported (no-data, never zero). The project takes no position on territorial status.")
make_nodata_row <- function(slug, year) {
  dataset <- switch(as.character(year), `2004` = d2004, `2014` = d2014, `2024` = d2024)
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = "raion",
    area_unit_id = paste(boundary_set_id, slug, sep = ":"),
    area_code = slug,
    area_name = unname(label_nodata[[slug]]),
    year = as.integer(year),
    population_total = NULL,
    population_total_basis = nodata_basis,
    religious_affiliation_count = NULL,
    religious_affiliation_percent = NULL,
    no_religion_count = NULL,
    no_religion_percent = NULL,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = unname(round(land_area[[slug]], 4)),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(dataset, d_gb),
    quality_flag = paste("census_not_enumerated_left_bank_no_data",
      "right_bank_only_transnistria_and_bender_not_enumerated",
      "renders_as_no_data_never_zero", sep = ";"))
}

years <- c(2004L, 2014L, 2024L)
rows <- c(
  unlist(lapply(years, function(y) lapply(slug35, make_census_row, year = y)), recursive = FALSE),
  unlist(lapply(years, function(y) lapply(slug_nodata, make_nodata_row, year = y)), recursive = FALSE))

# ---- area-summary document -----------------------------------------------------
census_licence_name <- paste(
  "National Bureau of Statistics of the Republic of Moldova (BNS) Terms of use of data,",
  "Creative Commons Attribution 4.0 International. The BNS Terms of use page",
  "(statistica.gov.md/en/terms-and-conditions-139_4417.html, retrieved 2026-07-12) place",
  "reuse of the website content and data under 'the license Creative Commons Attribution 4.0",
  "International License', free to copy, redistribute, remix, transform and build upon the",
  "material for any purpose, on the conditions that the source is clearly indicated and any",
  "modification is noted. Attribution: 'National Bureau of Statistics of the Republic of Moldova'.")

source_datasets <- function() {
  gl <- list(name = "Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO)",
             url = url_gb_meta,
             attribution = "geoBoundaries (gbOpen); boundary source UNHCR, OCHA FISS (CC BY 3.0 IGO)")
  cl <- function(att) list(name = census_licence_name, url = url_terms, attribution = att)
  list(
    list(source_dataset_id = d2004,
         name = "Moldova 2004 Population Census, Volume I, Table 5.2: population by religion, in territorial aspect",
         provider = "National Bureau of Statistics of the Republic of Moldova",
         url = url_2004, retrieval_date = retrieval_date, local_path = path_2004_pdf,
         licence = cl("National Bureau of Statistics of the Republic of Moldova, 2004 Population Census"),
         citation = "Moldova 2004 Population Census Results, Volume I, Table 5.2 (Populaţia după religie, în profil teritorial).",
         access_limits = NULL,
         redistribution_limits = "Open reuse with source attribution (CC BY 4.0); derived raion summaries ship with attribution to the National Bureau of Statistics of the Republic of Moldova.",
         notes = paste("Whole enumerated resident population, all ages, right bank only ('cu excepţia raioanelor de Est şi a municipiului Bender').",
                       "35 units, 15 categories (12 named/other + Atei + Fără religie + Nedeclarată). Both margins close exactly to 3,383,332 (Orthodox 3,158,015).",
                       "Text-extractable PDF (pdftotext -layout); the two-block spread transcribed verbatim and reconciled at build time.")),
    list(source_dataset_id = d2014,
         name = "Moldova 2014 Population and Housing Census: population by religion, in territorial aspect (table 2.1)",
         provider = "National Bureau of Statistics of the Republic of Moldova",
         url = url_2014, retrieval_date = retrieval_date, local_path = path_2014,
         licence = cl("National Bureau of Statistics of the Republic of Moldova, 2014 Population and Housing Census"),
         citation = "Moldova 2014 Population and Housing Census, Caracteristici - Populaţie 2, sheet 2.1 (Populaţia după religie, în profil teritorial).",
         access_limits = NULL,
         redistribution_limits = "Open reuse with source attribution (CC BY 4.0); derived raion summaries ship with attribution to the National Bureau of Statistics of the Republic of Moldova.",
         notes = paste("Whole enumerated population, all ages, right bank only. 35 units, 14 declared-block categories (incl. Agnostic and Ateu) plus a separate not-declared column.",
                       "Total = declared + not-declared per unit; declared = sum of the 14 categories; national closes exactly to 2,804,801 (Orthodox 2,528,152).",
                       "Enumerated base; BNS later published a lower usual-resident estimate, not reconciled here (each wave read in its own denominator).")),
    list(source_dataset_id = d2024,
         name = "Moldova 2024 Population and Housing Census, ethnocultural annex table 5.29: population by religious affiliation by development region and raion/municipality (counts)",
         provider = "National Bureau of Statistics of the Republic of Moldova",
         url = url_2024, retrieval_date = retrieval_date, local_path = path_2024,
         licence = cl("National Bureau of Statistics of the Republic of Moldova, 2024 Population and Housing Census"),
         citation = "Moldova 2024 Population and Housing Census, ethnocultural characteristics annex, table 5.29 (counts) / 5.30 (shares).",
         access_limits = NULL,
         redistribution_limits = "Open reuse with source attribution (CC BY 4.0); derived raion summaries ship with attribution to the National Bureau of Statistics of the Republic of Moldova.",
         notes = paste("Usual-resident population, all ages, right bank only. 35 units extracted from the region-and-raion table (the Nord/Centru/Sud development-region aggregate rows are dropped by their empty CUATM code).",
                       "14 declared-block categories (incl. Liber cugetător, Agnostic, Ateu, Fără religie) plus a separate not-declared column; Total = categories + not-declared per unit; national closes exactly to 2,409,207 (Orthodox 2,271,105).",
                       "'-' = magnitudine zero. The published shares sheet 5.30 prints the Liber cugetător and Agnostic columns at 100x their fraction (a source-internal formatting inconsistency); the product carries the exact 5.29 counts and does not use those printed shares.")),
    list(source_dataset_id = d_gb,
         name = "geoBoundaries MDA ADM1 (37 raion/municipality units, 2020 vintage)",
         provider = "geoBoundaries (William & Mary geoLab); boundary source UNHCR, OCHA FISS",
         url = url_gb, retrieval_date = retrieval_date, local_path = path_gb,
         licence = gl,
         citation = "geoBoundaries MDA ADM1 (gbOpen, pinned 9469f09), 37 raion/municipality boundaries.",
         access_limits = NULL,
         redistribution_limits = "The simplified derived boundary is committed under CC BY 3.0 IGO with attribution to geoBoundaries and UNHCR/OCHA FISS.",
         notes = "37 ADM1 units, boundaryYearRepresented 2020. The 35 census units join one-to-one; Transnistria and Bender are the two non-census polygons carried as disclosed no-data."))
}

indicators <- function() {
  denom_note <- paste(
    "Percentages use each unit's printed census total. In every wave the not-declared line",
    "(2004 Nedeclarată; 2014/2024 the separate not-declared column) stays in the denominator and",
    "outside both numerators, so the two shares need not sum to 100%. No-religion is each wave's own",
    "atheist/no-religion block, which differs across waves (2004 Atei + Fără religie; 2014 Agnostic +",
    "Ateu; 2024 Liber cugetător + Agnostic + Ateu + Fără religie); a fine-category cross-wave change is withheld.")
  list(
    list(indicator_id = "population_total", label = "Census population total",
         description = "Unit whole-population count represented in the wave's religion table.",
         unit = "count", denominator_indicator_id = NULL,
         method = "Printed unit total: 2004 Vol I Table 5.2; 2014 table 2.1; 2024 ethnocultural annex table 5.29.",
         temporal_coverage = "2004; 2014; 2024", spatial_coverage = "Moldova right-bank raions and municipalities (35 units)",
         quality_notes = "Whole enumerated resident population, all ages, in every wave. Right bank only: Transnistria and Bender are not enumerated (rendered as no-data); Căuşeni and Dubăsari are enumerated in their central-government-controlled parts only (flagged). National totals fall across the series (3,383,332; 2,804,801; 2,409,207) with population change, not a religion change."),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
         description = "Share of the unit population reporting affiliation with a declared religion.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "2004: (total - Atei - Fără religie - Nedeclarată)/total. 2014: (12 named confessions)/total. 2024: (10 named categories Ortodoxă ... Alte religii)/total.",
         temporal_coverage = "2004; 2014; 2024", spatial_coverage = "Moldova right-bank raions and municipalities",
         quality_notes = paste("Category frames differ across waves (2004: 15 columns; 2014: 14 declared + not-declared; 2024: 14 declared + not-declared), so no cross-wave category change is claimed; the comparable spine is the Orthodox share and the aggregate declared-affiliation share, carried verbatim per unit.", denom_note)),
    list(indicator_id = "no_religion_percent", label = "No religion %",
         description = "Share of the unit population in the wave's atheist/no-religion block.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "2004: (Atei + Fără religie)/total. 2014: (Agnostic + Ateu)/total. 2024: (Liber cugetător + Agnostic + Ateu + Fără religie)/total.",
         temporal_coverage = "2004; 2014; 2024", spatial_coverage = "Moldova right-bank raions and municipalities",
         quality_notes = "The no-religion block is not cell-comparable across waves (2014 carries no separate 'fără religie' line at raion grain); each wave renders its own block. Not-declared is a disclosed denominator residual, never folded into this slot.")
  )
}

visual_layers <- function() {
  list(
    list(visual_layer_id = "md-raion-religious-affiliation", label = "Religious affiliation %",
         description = "Moldova census-affiliation share by raion/municipality.", layer_type = "choropleth",
         indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "unit census total"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "reported unit value", uncertainty_display = "quality_flag",
         default_visibility = TRUE,
         notes = "Census affiliation, not practice or membership. Transnistria and Bender render as no-data (not enumerated). Căuşeni and Dubăsari are enumerated in their controlled parts only (flagged)."),
    list(visual_layer_id = "md-raion-no-religion", label = "No religion %",
         description = "Moldova census atheist/no-religion share by raion/municipality.", layer_type = "choropleth",
         indicator_ids = list("no_religion_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "unit census total"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "reported unit value", uncertainty_display = "quality_flag",
         default_visibility = FALSE,
         notes = "Each wave's own atheist/no-religion block; not cell-comparable across waves. Not-declared is excluded from this slot.")
  )
}

summary_product <- list(
  schema_version = "area-summary.v2", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code,
                      level = "raion",
                      vintage = "geoBoundaries MDA ADM1 (2020); 37 units, Transnistria and Bender carried as no-data",
                      source_dataset_id = d_gb),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "No governed place-of-worship snapshot ships in the Moldova census product.",
                       notes = "Place counts and density metrics remain null."),
  data_status = "census_religion_live",
  data_status_note = paste("Census religious affiliation is live for the 35 right-bank raions and municipalities across 2004, 2014 and 2024",
    "on one geoBoundaries MDA ADM1 frame. Transnistria and Bender are carried as disclosed no-data. Two-slot headline metrics ship as levels",
    "on each wave's own frame; a fine-category cross-wave change is withheld across the frame breaks."),
  source_datasets = source_datasets(), indicators = indicators(),
  visual_layers = visual_layers(), rows = rows)

write_json(summary_product, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(summary_json_out, warn = FALSE), collapse = "\n"))) {
  stop("area-summary JSON is invalid", call. = FALSE)
}

# flatten rows to the CSV companion (composition is JSON-only).
flatten_rows <- function(rows) {
  do.call(rbind, lapply(rows, function(r) {
    data.frame(
      country_code = r[["country_code"]], boundary_set_id = r[["boundary_set_id"]],
      boundary_level = r[["boundary_level"]], area_unit_id = r[["area_unit_id"]],
      area_code = r[["area_code"]], area_name = r[["area_name"]], year = r[["year"]],
      population_total = if (is.null(r[["population_total"]])) NA_integer_ else r[["population_total"]],
      population_total_basis = r[["population_total_basis"]],
      religious_affiliation_count = if (is.null(r[["religious_affiliation_count"]])) NA_integer_ else r[["religious_affiliation_count"]],
      religious_affiliation_percent = if (is.null(r[["religious_affiliation_percent"]])) NA_real_ else r[["religious_affiliation_percent"]],
      no_religion_count = if (is.null(r[["no_religion_count"]])) NA_integer_ else r[["no_religion_count"]],
      no_religion_percent = if (is.null(r[["no_religion_percent"]])) NA_real_ else r[["no_religion_percent"]],
      place_count = NA_integer_, places_per_10000_residents = NA_real_,
      place_density_per_sq_km = NA_real_, land_area_sq_km = r[["land_area_sq_km"]],
      site_snapshot_date = NA_character_, place_count_basis = NA_character_,
      source_dataset_ids = paste(unlist(r[["source_dataset_ids"]]), collapse = "|"),
      quality_flag = r[["quality_flag"]], stringsAsFactors = FALSE)
  }))
}
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

# ---- manifest ------------------------------------------------------------------
raw_source_record <- function(path, url, format, used, periods, dataset_id, notes) {
  list(uri = path, url = url, format = format, bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = NULL, source_dataset_id = dataset_id, used_in_public_product = used,
       periods = periods, notes = notes,
       local_cache_hint = paste0(path, " (git-ignored)"),
       raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/md_census/"))
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

licence_basis_slug <- "md_bns_cc_by_4_0_with_attribution"

raw_sources <- list(
  raw_source_record(path_2004_pdf, url_2004, "pdf", TRUE, "2004", d2004,
    "2004 census Vol I (text-extractable PDF from the published ZIP); Table 5.2 unit x religion. Both margins close to 3,383,332 (Orthodox 3,158,015)."),
  raw_source_record(path_2014, url_2014, "xls", TRUE, "2014", d2014,
    "2014 population-by-religion territorial table (sheet 2.1). National closes to 2,804,801 (Orthodox 2,528,152); Total=declared+not-declared per unit."),
  raw_source_record(path_2024, url_2024, "xlsx", TRUE, "2024", d2024,
    "2024 ethnocultural annex table 5.29 (counts). Region rows dropped by empty CUATM; 35 units close to 2,409,207 (Orthodox 2,271,105); '-'=magnitude zero."),
  raw_source_record(path_gb, url_gb, "geojson", TRUE, "2020", d_gb,
    "geoBoundaries MDA ADM1 GeoJSON; 37 units, CC BY 3.0 IGO. Pinned commit 9469f09. Transnistria and Bender are the two non-census polygons."),
  raw_source_record(path_gb_meta, url_gb_meta, "json", FALSE, "2020", d_gb,
    "geoBoundaries MDA ADM1 metadata; records CC BY 3.0 IGO, admUnitCount 37, boundaryYearRepresented 2020, source UNHCR/OCHA FISS."))

dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)
dataset_id <- "md-census-religion:md:2004-2024:bns-raion"

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = paste0("manifest:", dataset_id),
  dataset_id = dataset_id,
  dataset_version_id = paste0(dataset_id, ":", dataset_hash),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "md-census-religion", dataset_role = "accepted_export",
  scope = list(level = "country", country_codes = list("MD"), snapshot_date = NULL,
               snapshot_anchor = NULL, pipeline_stage = "accepted"),
  created_at = stamp, created_by = script_id,
  target_years = list(2004L, 2014L, 2024L),
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation",
      shipped_waves = list(2004L, 2014L, 2024L),
      shipped_geography = "35 right-bank raions and municipalities (Mun. Chişinău, Mun. Bălţi, 32 raions, U.T.A. Găgăuzia); Transnistria and Bender carried as no-data",
      boundary_set = boundary_set_id,
      source_tables = list(
        `2004` = "Vol I Table 5.2 (Populaţia după religie, în profil teritorial)",
        `2014` = "table 2.1 (Populaţia după religie, în profil teritorial)",
        `2024` = "ethnocultural annex table 5.29 counts (5.30 shares)"),
      universes = list(`2004` = "whole enumerated resident population, all ages (5 October 2004), right bank only",
                       `2014` = "whole enumerated population, all ages, right bank only",
                       `2024` = "usual-resident population, all ages, right bank only"),
      slot_design = paste(
        "Ordinary two-slot on each wave's own frame. religious_affiliation_percent: 2004 = (total - Atei -",
        "Fără religie - Nedeclarată)/total; 2014 = (12 named confessions)/total; 2024 = (10 named categories",
        "Ortodoxă ... Alte religii)/total. no_religion_percent: 2004 = (Atei + Fără religie)/total; 2014 =",
        "(Agnostic + Ateu)/total; 2024 = (Liber cugetător + Agnostic + Ateu + Fără religie)/total. The",
        "not-declared line (2004 Nedeclarată; 2014/2024 the separate not-declared column) stays in the",
        "denominator, outside both slots, so the two shares need not sum to 100."),
      category_frames = list(
        `2004` = as.list(cats2004),
        `2014` = as.list(c(cats2014, lab2014_notdecl)),
        `2024` = as.list(c(cats2024, lab2024_notdecl)),
        frame_break_note = paste(
          "The three waves do not share one category frame. 2004 prints 15 columns incl. separate Atei, Fără",
          "religie and Nedeclarată. 2014 carries 14 declared-block columns (incl. Agnostic and Ateu, and Iudaism and",
          "Martorii lui Iehova as explicit lines) plus one not-declared column, with no separate 'fără religie' line at",
          "raion grain. 2024 adds Staroveri and splits the no-religion block into Liber cugetător, Agnostic, Ateu and",
          "Fără religie, folding several confessions into Alte religii. Each wave is transcribed in its own printed order",
          "and labelled by wave; a fine-category cross-wave change is withheld (change_withheld). The comparable spine is",
          "the Orthodox share and the aggregate declared-affiliation share.")),
      change_metric = "fine_category_cross_wave_change_withheld: headline two-slot levels ship per wave on each wave's own frame; a category-by-category cross-wave change is withheld across the frame breaks.",
      magnitude_zero = "2024 table 5.29 prints '-' for magnitude-zero cells; read as 0, never suppressed or differenced.",
      shares_sheet_quirk = "2024 table 5.30 (shares) prints the Liber cugetător and Agnostic columns at 100x their fraction (a source-internal formatting inconsistency); the product carries the exact 5.29 counts and does not use those printed shares. Recorded, not repaired.",
      territorial_scope = paste(
        "The National Bureau of Statistics enumerates the right bank only in every post-Soviet census. 2004 states 'cu",
        "excepţia raioanelor de Est şi a municipiului Bender'; the 2024 annex footnote lists the non-enumerated left-bank",
        "localities verbatim: 'Datele se referă doar la UAT efectiv recenzate şi nu includ unităţile administrativ-teritoriale",
        "din stânga Nistrului, municipiului Bender (inclusiv satul Proteagailovca), comuna Chițcani (inclusiv satele",
        "Merenești și Zahorna), satele Cremenciug și Gîsca din raionul Căușeni, comuna Corjova (inclusiv satul Mahala)",
        "din raionul Dubăsari, precum și satul Roghi din cadrul comunei Molovata Nouă, raionul Dubăsari.' The two left-bank",
        "ADM1 polygons (Transnistria, Bender) carry no census religion in any wave and render as disclosed no-data",
        "(never zero). Căuşeni and Dubăsari are enumerated in their central-government-controlled parts only; their polygons",
        "span the full administrative extent, disclosed on the per-unit flag. No count is invented for any non-enumerated area."),
      universe_caveat_2014 = "The 2014 enumerated-population base (2,804,801) differs from a later BNS usual-resident revision; each wave's shares are read within that wave's own published denominator and the bases are not reconciled.",
      boundary_derivation = "geoBoundaries MDA ADM1 (37 units, CC BY 3.0 IGO, 2020). The 35 census units join one-to-one after folding RO diacritics to the boundary ASCII form (ă->a, â/î->i, ş->s, ţ->t) and stripping the Mun./U.T.A. prefixes. Transnistria and Bender are the two non-census polygons. One boundary set serves all waves.",
      omitted_metrics = list("places_per_10000_residents", "place_density_per_sq_km"),
      boundary_simplification = simplification,
      small_cell_rule = paste(
        "docs/development/small-cell-rule.md. Denominator threshold (100) never triggered at raion grain (smallest unit total",
        sprintf("%d).", as.integer(smallest_denominator)),
        "small_cell_under_10 marks rows carrying any published category numerator under 10;",
        sprintf("counts under 10 are rendered exactly as published, none suppressed. Smallest numerator observed: %d.", as.integer(smallest_numerator))),
      small_cell_counts = small_cell_counts,
      local_cache_hint = "All raw sources are cached under data/raw/md_census/ and remain git-ignored.",
      retrieval_record = raw_sources),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")), readxl = as.character(packageVersion("readxl")),
      digest = as.character(packageVersion("digest")),
      mapshaper = "scripts/lib/simplify_boundary.R (npx mapshaper)")),
  source = list(
    provider = "National Bureau of Statistics of the Republic of Moldova; geoBoundaries (William & Mary geoLab)",
    source_dataset_ids = list(d2004, d2014, d2024, d_gb),
    source_urls = list(url_2004, url_2014, url_2024, url_gb, url_gb_meta, url_terms),
    retrieved_at = stamp,
    licence = census_licence_name,
    citation = "Moldova 2004 Census Vol I Table 5.2; 2014 population by religion (table 2.1); 2024 ethnocultural annex tables 5.29/5.30; geoBoundaries MDA ADM1 (CC BY 3.0 IGO).",
    raw_redistribution = "The census PDF/XLS/XLSX and the boundary source file are not committed; they remain in data/raw/md_census/.",
    local_cache_hint = "data/raw/md_census/ (git-ignored)",
    raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/md_census/")),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = list(
    durable_file_record(summary_json_out, "Moldova raion/municipality census-affiliation area summary for 2004, 2014, 2024.", "accepted", licence_basis_slug),
    durable_file_record(summary_csv_out, "Flattened Moldova raion/municipality census-affiliation rows for 2004, 2014, 2024.", "accepted", licence_basis_slug),
    durable_file_record(geojson_out, "Simplified geoBoundaries MDA ADM1 37-unit boundary GeoJSON (35 census + Transnistria + Bender no-data).", "accepted", "geoboundaries_cc_by_3_0_igo")),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id,
         notes = "111 rows: 35 units x 3 waves (105 census) + 2 left-bank polygons x 3 waves (6 no-data). Composition carries verbatim category counts per row."),
    list(uri = paste0("repo:", geojson_out), sha256 = sha256_file(geojson_out), built_by = script_id,
         notes = "37 features from geoBoundaries MDA ADM1, simplified with mapshaper; Transnistria and Bender carried as no-data.")),
  validation = list(
    status = "passed",
    commands = list(
      paste("Rscript", script_id),
      "bash scripts/validate_area_summaries.sh",
      "uvx check-jsonschema --schemafile schemas/data-manifest.schema.json docs/manifests/md-census-religion-2004-2024.json"),
    gate_2004 = list(status = "passed", both_margins_close_to = 3383332L, orthodox_national = 3158015L,
                     unit_row_checks = 35L, records = reconciliation_block(reconciliation[reconciliation$year == 2004L, ])),
    gate_2014 = list(status = "passed", national_total = 2804801L, orthodox_national = 2528152L,
                     note = "per unit Total=declared+not-declared and declared=sum(14 categories); national exact",
                     records = reconciliation_block(reconciliation[reconciliation$year == 2014L, ])),
    gate_2024 = list(status = "passed", national_total = 2409207L, orthodox_national = 2271105L,
                     note = "per unit Total=categories+not-declared; national exact",
                     records = reconciliation_block(reconciliation[reconciliation$year == 2024L, ])),
    boundary_validation = list(status = "passed", feature_count = 37L,
                               distinct_geometry_hashes = length(unique(hashes)),
                               bbox = as.list(st_bbox(written)), output_bytes = file_bytes(geojson_out),
                               licence = gb_meta[["boundaryLicense"]], adm_unit_count = gb_meta[["admUnitCount"]]),
    join_coverage = list(matched_census_units = 35L, expected_census_units = 35L,
                         no_data_polygons = 2L, total_features = 37L),
    notes = paste(
      "All three waves close exactly at both margins (2004: 3,383,332; 2014: 2,804,801; 2024: 2,409,207; Orthodox",
      "3,158,015 / 2,528,152 / 2,271,105). Boundary joins 35/35 census units plus Transnistria and Bender as no-data; 37/37 features have distinct geometry hashes."),
    warnings = list(
      "Category frames differ per wave (2004: 15 columns; 2014: 14 declared + not-declared; 2024: 14 declared + not-declared) — a fine-category cross-wave change is withheld (change_withheld); the comparable spine is the Orthodox and aggregate declared-affiliation shares.",
      "No-religion block is not cell-comparable across waves (2014 has no separate 'fără religie' line at raion grain); each wave renders its own atheist/no-religion block.",
      "Territorial scope: Transnistria and Bender not enumerated in any wave (rendered as no-data, never zero); Căuşeni and Dubăsari enumerated in controlled parts only (flagged).",
      "2014 enumerated base differs from a later usual-resident revision; each wave read in its own denominator.",
      "2024 shares sheet 5.30 prints Liber cugetător and Agnostic at 100x their fraction (source-internal); exact 5.29 counts used instead.",
      "small_cell_under_10 marks rows with any published category numerator under 10; counts rendered exactly, none suppressed.")),
  construct_notes = list(
    "The construct is census affiliation: each enumerated resident's declared religion (asked of the whole enumerated population, all ages), not practice, attendance, or membership. Religion was tabulated at raion grain in the 2004, 2014 and 2024 censuses.",
    "The public product carries three headline fields per unit-wave: population total, religious affiliation percent, and no-religion percent, plus a structured per-row composition of the wave's verbatim categories and counts. Place-density metrics are null (no governed place-of-worship snapshot).",
    "Category frames differ per wave and are preserved verbatim per unit in the composition field and on the quality flag. A fine-category cross-wave change is withheld; the two-slot headline metrics ship as levels on each wave's own frame.",
    "Slot design: religious_affiliation = the wave's declared-religion categories; no_religion = the wave's atheist/no-religion block (2004 Atei + Fără religie; 2014 Agnostic + Ateu; 2024 Liber cugetător + Agnostic + Ateu + Fără religie). The not-declared line stays in the denominator, outside both slots, so the two shares need not sum to 100.",
    "Territorial scope (render the record): the National Bureau of Statistics enumerates the right bank only. Transnistria and Bender are carried as disclosed no-data polygons (never zero); Căuşeni and Dubăsari are enumerated in their central-government-controlled parts only, disclosed on the per-unit flag. No count is invented for any non-enumerated area.",
    "Licence: the census data ship under the BNS Terms of use of data (Creative Commons Attribution 4.0 International with source attribution, quoted verbatim in source.licence). No reuse ask is needed; the product ships with attribution to the National Bureau of Statistics of the Republic of Moldova, and the boundary under CC BY 3.0 IGO to geoBoundaries / UNHCR / OCHA FISS."),
  deferred_sources = list(
    list(source_dataset_id = "md-census-religion-age-sex-medium", status = "deferred",
         url = url_2024, local_path = path_2024,
         notes = "The 2024 annex and the 2004 Vol I Table 5.1 split religion by age group, sex and urban/rural. Only the whole-population territorial block is shipped; the age/sex/medium cuts are a deeper future product.")),
  privacy = "public",
  licence_status = "accepted",
  licence_basis = licence_basis_slug,
  downstream_status = "accepted",
  source_datasets = source_datasets(),
  notes = paste(
    "Accepted product (open BNS CC BY 4.0 reuse licence with attribution). The committed products are the derived raion",
    "area summary (111 rows across 2004, 2014, 2024) and one geoBoundaries MDA ADM1 37-unit boundary GeoJSON.",
    "On-page attribution, when a page is built, must cite the National Bureau of Statistics of the Republic of Moldova",
    "and geoBoundaries (CC BY 3.0 IGO)."))

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

cat("waves shipped: 2004, 2014, 2024 on one 37-unit boundary set (35 census + Transnistria + Bender no-data)\n")
cat(sprintf("rows: %d (105 census + 6 no-data)\n", length(rows)))
cat("gate 2004: passed; both margins close to 3,383,332 (Orthodox 3,158,015)\n")
cat("gate 2014: passed; national exact to 2,804,801 (Orthodox 2,528,152)\n")
cat("gate 2024: passed; national exact to 2,409,207 (Orthodox 2,271,105)\n")
cat(sprintf("boundary: 37 features, %d bytes, %d distinct geometry hashes\n", file_bytes(geojson_out), length(unique(hashes))))
cat(sprintf("small cells: smallest denominator %d; smallest numerator %d\n", as.integer(smallest_denominator), as.integer(smallest_numerator)))
cat("licence: accepted (BNS CC BY 4.0 with attribution); CC BY 3.0 IGO boundary\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", geojson_out))
cat(sprintf("wrote %s\n", manifest_out))
