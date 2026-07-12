# build the Thailand province census-religion area-summary product for one wave
# (2010) on the 2010-census-frame 76-province rendering of the geoBoundaries THA
# ADM1 layer (Bueng Kan, created March 2011, unioned back into Nong Khai). inputs (all cached,
# git-ignored, sha256 recorded in the manifest and research/countries/th/route-probe.md):
#   data/raw/th_census/reports2010/<Province>_T.pdf -> 2010 census provincial final
#     reports; "Table 4 Population by religion, sex and area" (integer full count, 9
#     categories, one province per report) plus WholeKingdom_T.pdf (national control)
#   data/raw/th_census/table4_extracted.json -> the verbatim Table 4 Total-column
#     counts transcribed from those PDFs by scripts/../extract_table4.py (pdftotext
#     -layout, Thai-anchor parse); this file is the transcription this build embeds
#   data/raw/th_census/geoBoundaries-THA-ADM1.geojson -> 77-province ADM1 boundary
#   data/raw/th_census/gb_tha_adm1_meta.json -> boundary licence metadata (ODbL 1.0)
# every religion cell is carried verbatim and reconciled against the printed province
# Total row here; the build stops on any deviation beyond the published +-2 rounding
# bound and never allocates, infers, rounds, imputes, or tunes a value. the NSO
# full-count tables carry small (+-1/+-2 person) independent-rounding residuals between
# the nine category counts and the printed Total row; these are disclosed per province.
# outputs: apps/regions/th/data/th_province_2017.geojson,
#   apps/regions/th/data/area_summary_province.{json,csv}, and
#   docs/manifests/th-census-religion-2010.json.
# run from the repo root: Rscript scripts/build_th_area_summary.R
# STAGED product: no page, no hub link; licence needs_review under BUILD-THEN-ASK
# (NSO no-stated-licence with attribution; boundary ODbL 1.0, share-alike).

suppressPackageStartupMessages({
  library(digest)
  library(jsonlite)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "TH"
script_id <- "scripts/build_th_area_summary.R"
raw_dir <- "data/raw/th_census"
product_dir <- "apps/regions/th/data"
manifest_dir <- "docs/manifests"
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- "2026-07-12"
stamp <- paste0(retrieval_date, "T00:00:00Z")
git_commit <- trimws(system2("git", c("rev-parse", "HEAD"), stdout = TRUE))
if (length(git_commit) != 1L || !grepl("^[a-f0-9]{40}$", git_commit)) git_commit <- NULL

# geoBoundaries boundaryYearRepresented is 2017 for THA ADM1 (77 provinces incl.
# Bueng Kan). the 2010 census province frame is 76 provinces: the NongKhai report is
# the old frame (its Table 1 lists all 17 amphoes incl. the eight that became Bueng
# Kan in March 2011) and the separate BuengKan report re-tabulates those same eight
# amphoes, so summing both double-counts (+362,747 vs the WholeKingdom total). the
# build ships the NSO-published 2010 frame on a per-vintage boundary: the Bueng Kan
# polygon is unioned into Nong Khai (geometrically exact -- Bueng Kan was carved
# wholly from Nong Khai), never an invented allocation.
boundary_level <- "province"
boundary_vintage <- "2010-census-frame (geometry 2017; Bueng Kan unioned into Nong Khai)"
boundary_set_id <- "th-province-2010censusframe-geoboundaries-adm1"
target_year <- 2010L

d2010 <- "th-census-2010-provincial-report-table4-religion-by-province"
d_boundary <- "geoboundaries-tha-adm1-2017"

# ---- source urls and cached paths ----------------------------------------------
report_url_base <- "http://web.nso.go.th/sites/2014en/Documents/popeng/2010/Report/"
nso_home_url <- "https://www.nso.go.th"
ckan_licence_url <- "https://catalog.nso.go.th/api/3/action/package_show"
boundary_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/THA/ADM1/geoBoundaries-THA-ADM1.geojson"
boundary_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/THA/ADM1/"

reports_dir <- file.path(raw_dir, "reports2010")
extracted_path <- file.path(raw_dir, "table4_extracted.json")
concordance_path <- file.path(raw_dir, "concordance.json")
boundary_path <- file.path(raw_dir, "geoBoundaries-THA-ADM1.geojson")
boundary_meta_path <- file.path(raw_dir, "gb_tha_adm1_meta.json")

boundary_out <- file.path(product_dir, "th_province_2010frame.geojson")
summary_json_out <- file.path(product_dir, "area_summary_province.json")
summary_csv_out <- file.path(product_dir, "area_summary_province.csv")
manifest_out <- file.path(manifest_dir, "th-census-religion-2010.json")

# ---- category frame (2010 Table 4; preserved verbatim per the render-the-record rule)
# nine categories in printed order; Thai originals kept alongside the report's English.
cats_en <- c("Buddhism", "Islam", "Christianity", "Hindus", "Confucious", "Sikh",
             "Others", "No religion", "Unknown")
cats_th <- c("พุทธ", "อิสลาม",
             "คริสต์", "ฮินดู",
             "ขงจื้อ", "ซิกข์",
             "อื่น ๆ", "ไม่มีศาสนา",
             "ไม่ทราบ")
no_rel_label <- "No religion"
nonresp_label <- "Unknown"
# reconciliation bound: the observed maximum published category-sum-minus-Total residual
# is +-3 persons (RoiEt -3); a deviation beyond this fails the gate (extraction fault).
recon_bound <- 3L
# national cross-source bound: the 76 province reports were produced separately from
# the WholeKingdom volume; observed per-category deviations are within +-14 persons
# (Buddhism -14) and the total within -7. beyond +-25 fails the gate.
national_bound <- 25L

# ---- data: verbatim 2010 Table 4 province counts (Total column, all persons) --------
# transcribed from the cached provincial final-report PDFs (data/raw/th_census/reports2010)
# via pdftotext Thai-anchor extraction. prov_data is keyed by the geoBoundaries THA
# ADM1 shapeName (the boundary join key); each value is a named numeric vector of the
# nine categories (source order) plus the printed province Total row. national_control
# is the WholeKingdom_T.pdf Table 4 (national cross-source reconciliation control).
# generated block, do not hand-edit: regenerate with the documented extractor.
# ===DATA_BLOCK_START===
prov_data <- list(
  "Amnat Charoen Province" = c(`Buddhism` = 281675, `Islam` = 267, `Christianity` = 1649, `Hindus` = 59, `Confucious` = 13, `Sikh` = 13, `Others` = 53, `No religion` = 0, `Unknown` = 0, Total = 283729),
  "Ang Thong Province" = c(`Buddhism` = 249847, `Islam` = 3994, `Christianity` = 213, `Hindus` = 172, `Confucious` = 7, `Sikh` = 7, `Others` = 42, `No religion` = 9, `Unknown` = 0, Total = 254292),
  "Bangkok" = c(`Buddhism` = 7686022, `Islam` = 382385, `Christianity` = 157534, `Hindus` = 22820, `Confucious` = 6800, `Sikh` = 7183, `Others` = 24330, `No religion` = 17091, `Unknown` = 1053, Total = 8305218),
  "Buri Ram Province" = c(`Buddhism` = 1261658, `Islam` = 1911, `Christianity` = 7508, `Hindus` = 745, `Confucious` = 278, `Sikh` = 131, `Others` = 1746, `No religion` = 911, `Unknown` = 25, Total = 1274912),
  "Chachoengsao Province" = c(`Buddhism` = 663790, `Islam` = 46041, `Christianity` = 4457, `Hindus` = 231, `Confucious` = 43, `Sikh` = 55, `Others` = 626, `No religion` = 360, `Unknown` = 0, Total = 715603),
  "Chai Nat Province" = c(`Buddhism` = 304407, `Islam` = 592, `Christianity` = 424, `Hindus` = 35, `Confucious` = 23, `Sikh` = 18, `Others` = 47, `No religion` = 41, `Unknown` = 0, Total = 305587),
  "Chaiyaphum Province" = c(`Buddhism` = 961401, `Islam` = 944, `Christianity` = 1185, `Hindus` = 227, `Confucious` = 59, `Sikh` = 57, `Others` = 9, `No religion` = 16, `Unknown` = 9, Total = 963907),
  "Chanthaburi Province" = c(`Buddhism` = 475653, `Islam` = 1937, `Christianity` = 5922, `Hindus` = 129, `Confucious` = 65, `Sikh` = 40, `Others` = 1016, `No religion` = 849, `Unknown` = 0, Total = 485611),
  "Chiang Mai Province" = c(`Buddhism` = 1592164, `Islam` = 6789, `Christianity` = 133761, `Hindus` = 790, `Confucious` = 365, `Sikh` = 189, `Others` = 546, `No religion` = 2420, `Unknown` = 17, Total = 1737041),
  "Chiang Rai Province" = c(`Buddhism` = 1065170, `Islam` = 3167, `Christianity` = 103450, `Hindus` = 478, `Confucious` = 212, `Sikh` = 52, `Others` = 139, `No religion` = 245, `Unknown` = 15, Total = 1172928),
  "Chon Buri Province" = c(`Buddhism` = 1463280, `Islam` = 23269, `Christianity` = 56878, `Hindus` = 1155, `Confucious` = 610, `Sikh` = 426, `Others` = 6139, `No religion` = 3601, `Unknown` = 0, Total = 1555358),
  "Chumphon Province" = c(`Buddhism` = 462822, `Islam` = 3545, `Christianity` = 1040, `Hindus` = 115, `Confucious` = 88, `Sikh` = 11, `Others` = 79, `No religion` = 101, `Unknown` = 0, Total = 467801),
  "Kalasin" = c(`Buddhism` = 821714, `Islam` = 1058, `Christianity` = 1348, `Hindus` = 72, `Confucious` = 30, `Sikh` = 33, `Others` = 203, `No religion` = 76, `Unknown` = 0, Total = 824534),
  "Kamphaeng Phet Province" = c(`Buddhism` = 790017, `Islam` = 1571, `Christianity` = 3775, `Hindus` = 226, `Confucious` = 124, `Sikh` = 94, `Others` = 746, `No religion` = 838, `Unknown` = 0, Total = 797391),
  "Kanchanaburi Province" = c(`Buddhism` = 789692, `Islam` = 2849, `Christianity` = 7833, `Hindus` = 203, `Confucious` = 204, `Sikh` = 20, `Others` = 145, `No religion` = 573, `Unknown` = 0, Total = 801519),
  "Khon Kaen Province" = c(`Buddhism` = 1731964, `Islam` = 2593, `Christianity` = 6251, `Hindus` = 517, `Confucious` = 232, `Sikh` = 370, `Others` = 39, `No religion` = 2, `Unknown` = 2, Total = 1741969),
  "Krabi Province" = c(`Buddhism` = 235594, `Islam` = 125476, `Christianity` = 517, `Hindus` = 120, `Confucious` = 59, `Sikh` = 34, `Others` = 305, `No religion` = 93, `Unknown` = 5, Total = 362203),
  "Lampang Province" = c(`Buddhism` = 729866, `Islam` = 1422, `Christianity` = 10730, `Hindus` = 68, `Confucious` = 108, `Sikh` = 37, `Others` = 665, `No religion` = 243, `Unknown` = 3, Total = 743143),
  "Lamphun Province" = c(`Buddhism` = 410259, `Islam` = 631, `Christianity` = 1698, `Hindus` = 30, `Confucious` = 12, `Sikh` = 16, `Others` = 96, `No religion` = 0, `Unknown` = 0, Total = 412741),
  "Loei Province" = c(`Buddhism` = 543592, `Islam` = 544, `Christianity` = 1778, `Hindus` = 0, `Confucious` = 12, `Sikh` = 17, `Others` = 73, `No religion` = 16, `Unknown` = 0, Total = 546031),
  "Lopburi Province" = c(`Buddhism` = 765821, `Islam` = 1525, `Christianity` = 1304, `Hindus` = 141, `Confucious` = 55, `Sikh` = 51, `Others` = 294, `No religion` = 733, `Unknown` = 0, Total = 769925),
  "Mae Hong Son Province" = c(`Buddhism` = 159448, `Islam` = 1313, `Christianity` = 47755, `Hindus` = 24, `Confucious` = 72, `Sikh` = 4, `Others` = 422, `No religion` = 116, `Unknown` = 0, Total = 209153),
  "Maha Sarakham Province" = c(`Buddhism` = 822847, `Islam` = 1446, `Christianity` = 2690, `Hindus` = 215, `Confucious` = 23, `Sikh` = 29, `Others` = 388, `No religion` = 0, `Unknown` = 0, Total = 827639),
  "Mukdahan Province" = c(`Buddhism` = 354667, `Islam` = 379, `Christianity` = 2213, `Hindus` = 10, `Confucious` = 6, `Sikh` = 12, `Others` = 40, `No religion` = 12, `Unknown` = 0, Total = 357339),
  "Nakhon Nayok Province" = c(`Buddhism` = 229282, `Islam` = 15668, `Christianity` = 1579, `Hindus` = 85, `Confucious` = 44, `Sikh` = 4, `Others` = 118, `No religion` = 73, `Unknown` = 14, Total = 246867),
  "Nakhon Pathom Province" = c(`Buddhism` = 928954, `Islam` = 2162, `Christianity` = 9803, `Hindus` = 444, `Confucious` = 108, `Sikh` = 38, `Others` = 1574, `No religion` = 810, `Unknown` = 0, Total = 943892),
  "Nakhon Phanom Province" = c(`Buddhism` = 578682, `Islam` = 357, `Christianity` = 4404, `Hindus` = 67, `Confucious` = 15, `Sikh` = 8, `Others` = 163, `No religion` = 30, `Unknown` = 0, Total = 583726),
  "Nakhon Ratchasima Province" = c(`Buddhism` = 2509891, `Islam` = 5031, `Christianity` = 6314, `Hindus` = 404, `Confucious` = 275, `Sikh` = 194, `Others` = 3583, `No religion` = 295, `Unknown` = 0, Total = 2525987),
  "Nakhon Sawan Province" = c(`Buddhism` = 988678, `Islam` = 2252, `Christianity` = 1417, `Hindus` = 35, `Confucious` = 130, `Sikh` = 11, `Others` = 0, `No religion` = 225, `Unknown` = 0, Total = 992749),
  "Nakhon Si Thammarat Province" = c(`Buddhism` = 1353244, `Islam` = 94914, `Christianity` = 1323, `Hindus` = 250, `Confucious` = 167, `Sikh` = 29, `Others` = 538, `No religion` = 0, `Unknown` = 0, Total = 1450466),
  "Nan Province" = c(`Buddhism` = 444201, `Islam` = 329, `Christianity` = 8071, `Hindus` = 27, `Confucious` = 10, `Sikh` = 19, `Others` = 156, `No religion` = 0, `Unknown` = 0, Total = 452814),
  "Narathiwat Province" = c(`Buddhism` = 93968, `Islam` = 575585, `Christianity` = 212, `Hindus` = 44, `Confucious` = 161, `Sikh` = 30, `Others` = 2, `No religion` = 0, `Unknown` = 0, Total = 670002),
  "Nong Bua Lam Phu Province" = c(`Buddhism` = 484770, `Islam` = 448, `Christianity` = 650, `Hindus` = 57, `Confucious` = 13, `Sikh` = 19, `Others` = 0, `No religion` = 17, `Unknown` = 0, Total = 485974),
  "Nong Khai Province" = c(`Buddhism` = 817218, `Islam` = 575, `Christianity` = 3416, `Hindus` = 214, `Confucious` = 61, `Sikh` = 32, `Others` = 0, `No religion` = 10, `Unknown` = 0, Total = 821526),
  "Nonthaburi Province" = c(`Buddhism` = 1282703, `Islam` = 41816, `Christianity` = 7760, `Hindus` = 656, `Confucious` = 373, `Sikh` = 89, `Others` = 172, `No religion` = 473, `Unknown` = 40, Total = 1334083),
  "Pathum Thani Province" = c(`Buddhism` = 1271785, `Islam` = 35867, `Christianity` = 9807, `Hindus` = 1367, `Confucious` = 706, `Sikh` = 99, `Others` = 6592, `No religion` = 845, `Unknown` = 78, Total = 1327147),
  "Pattani Province" = c(`Buddhism` = 94507, `Islam` = 513841, `Christianity` = 221, `Hindus` = 77, `Confucious` = 58, `Sikh` = 49, `Others` = 237, `No religion` = 23, `Unknown` = 3, Total = 609015),
  "Phangnga Province" = c(`Buddhism` = 200324, `Islam` = 57081, `Christianity` = 786, `Hindus` = 98, `Confucious` = 23, `Sikh` = 46, `Others` = 2, `No religion` = 174, `Unknown` = 0, Total = 258534),
  "Phatthalung Province" = c(`Buddhism` = 423199, `Islam` = 56282, `Christianity` = 973, `Hindus` = 79, `Confucious` = 109, `Sikh` = 24, `Others` = 248, `No religion` = 58, `Unknown` = 3, Total = 480976),
  "Phayao Province" = c(`Buddhism` = 412121, `Islam` = 487, `Christianity` = 4275, `Hindus` = 35, `Confucious` = 19, `Sikh` = 14, `Others` = 103, `No religion` = 321, `Unknown` = 4, Total = 417380),
  "Phetchabun Province" = c(`Buddhism` = 929722, `Islam` = 2774, `Christianity` = 5818, `Hindus` = 392, `Confucious` = 499, `Sikh` = 57, `Others` = 407, `No religion` = 400, `Unknown` = 7, Total = 940076),
  "Phetchaburi Province" = c(`Buddhism` = 460298, `Islam` = 10423, `Christianity` = 1414, `Hindus` = 61, `Confucious` = 53, `Sikh` = 5, `Others` = 129, `No religion` = 206, `Unknown` = 0, Total = 472589),
  "Phichit Province" = c(`Buddhism` = 546908, `Islam` = 751, `Christianity` = 368, `Hindus` = 43, `Confucious` = 53, `Sikh` = 21, `Others` = 81, `No religion` = 18, `Unknown` = 0, Total = 548242),
  "Phitsanulok Province" = c(`Buddhism` = 904276, `Islam` = 1614, `Christianity` = 5062, `Hindus` = 421, `Confucious` = 606, `Sikh` = 143, `Others` = 155, `No religion` = 550, `Unknown` = 0, Total = 912827),
  "Phra Nakhon Si Ayutthaya Province" = c(`Buddhism` = 827251, `Islam` = 37056, `Christianity` = 3024, `Hindus` = 330, `Confucious` = 78, `Sikh` = 44, `Others` = 458, `No religion` = 57, `Unknown` = 2373, Total = 870671),
  "Phrae Province" = c(`Buddhism` = 423310, `Islam` = 551, `Christianity` = 3118, `Hindus` = 45, `Confucious` = 52, `Sikh` = 35, `Others` = 184, `No religion` = 101, `Unknown` = 2, Total = 427398),
  "Phuket Province" = c(`Buddhism` = 418025, `Islam` = 83969, `Christianity` = 19058, `Hindus` = 1011, `Confucious` = 67, `Sikh` = 104, `Others` = 930, `No religion` = 2453, `Unknown` = 91, Total = 525709),
  "Prachin Buri Province" = c(`Buddhism` = 542135, `Islam` = 1382, `Christianity` = 2282, `Hindus` = 182, `Confucious` = 53, `Sikh` = 18, `Others` = 692, `No religion` = 253, `Unknown` = 0, Total = 546996),
  "Prachuap Khiri Khan Province" = c(`Buddhism` = 456317, `Islam` = 6105, `Christianity` = 3962, `Hindus` = 198, `Confucious` = 57, `Sikh` = 30, `Others` = 541, `No religion` = 257, `Unknown` = 0, Total = 467466),
  "Ranong Province" = c(`Buddhism` = 217686, `Islam` = 29950, `Christianity` = 586, `Hindus` = 47, `Confucious` = 12, `Sikh` = 35, `Others` = 25, `No religion` = 677, `Unknown` = 0, Total = 249017),
  "Ratchaburi Province" = c(`Buddhism` = 781901, `Islam` = 2802, `Christianity` = 10108, `Hindus` = 411, `Confucious` = 205, `Sikh` = 90, `Others` = 474, `No religion` = 757, `Unknown` = 0, Total = 796748),
  "Rayong Province" = c(`Buddhism` = 807532, `Islam` = 8794, `Christianity` = 3882, `Hindus` = 210, `Confucious` = 605, `Sikh` = 49, `Others` = 0, `No religion` = 0, `Unknown` = 0, Total = 821072),
  "Roi Et Province" = c(`Buddhism` = 1081621, `Islam` = 1172, `Christianity` = 1880, `Hindus` = 100, `Confucious` = 46, `Sikh` = 33, `Others` = 39, `No religion` = 94, `Unknown` = 0, Total = 1084988),
  "Sa Kaeo Province" = c(`Buddhism` = 553526, `Islam` = 721, `Christianity` = 1393, `Hindus` = 90, `Confucious` = 31, `Sikh` = 14, `Others` = 54, `No religion` = 132, `Unknown` = 0, Total = 555961),
  "Sakon Nakhon Province" = c(`Buddhism` = 915976, `Islam` = 877, `Christianity` = 24790, `Hindus` = 36, `Confucious` = 11, `Sikh` = 17, `Others` = 36, `No religion` = 68, `Unknown` = 0, Total = 941811),
  "Samut Prakan Province" = c(`Buddhism` = 1788280, `Islam` = 22785, `Christianity` = 9444, `Hindus` = 2128, `Confucious` = 774, `Sikh` = 99, `Others` = 3477, `No religion` = 1705, `Unknown` = 0, Total = 1828694),
  "Samut Sakhon Province" = c(`Buddhism` = 880437, `Islam` = 2699, `Christianity` = 1687, `Hindus` = 449, `Confucious` = 102, `Sikh` = 105, `Others` = 425, `No religion` = 1265, `Unknown` = 22, Total = 887191),
  "Samut Songkhram Province" = c(`Buddhism` = 182157, `Islam` = 894, `Christianity` = 2233, `Hindus` = 70, `Confucious` = 12, `Sikh` = 3, `Others` = 50, `No religion` = 146, `Unknown` = 0, Total = 185564),
  "Saraburi Province" = c(`Buddhism` = 712193, `Islam` = 2668, `Christianity` = 937, `Hindus` = 395, `Confucious` = 98, `Sikh` = 27, `Others` = 598, `No religion` = 111, `Unknown` = 23, Total = 717051),
  "Satun Province" = c(`Buddhism` = 89715, `Islam` = 184552, `Christianity` = 403, `Hindus` = 17, `Confucious` = 152, `Sikh` = 16, `Others` = 0, `No religion` = 8, `Unknown` = 0, Total = 274863),
  "Si Sa Ket Province" = c(`Buddhism` = 1047650, `Islam` = 1677, `Christianity` = 5818, `Hindus` = 196, `Confucious` = 30, `Sikh` = 41, `Others` = 312, `No religion` = 255, `Unknown` = 0, Total = 1055979),
  "Sing Buri Province" = c(`Buddhism` = 197857, `Islam` = 891, `Christianity` = 1149, `Hindus` = 50, `Confucious` = 3, `Sikh` = 7, `Others` = 0, `No religion` = 23, `Unknown` = 2, Total = 199982),
  "Songkhla Province" = c(`Buddhism` = 1102830, `Islam` = 374728, `Christianity` = 2635, `Hindus` = 218, `Confucious` = 214, `Sikh` = 37, `Others` = 271, `No religion` = 88, `Unknown` = 0, Total = 1481021),
  "Sukhothai Province" = c(`Buddhism` = 626631, `Islam` = 833, `Christianity` = 1490, `Hindus` = 27, `Confucious` = 203, `Sikh` = 13, `Others` = 157, `No religion` = 352, `Unknown` = 0, Total = 629707),
  "Suphan Buri Province" = c(`Buddhism` = 842659, `Islam` = 1439, `Christianity` = 1012, `Hindus` = 90, `Confucious` = 4, `Sikh` = 19, `Others` = 216, `No religion` = 123, `Unknown` = 0, Total = 845561),
  "Surat Thani Province" = c(`Buddhism` = 978368, `Islam` = 22521, `Christianity` = 2313, `Hindus` = 460, `Confucious` = 238, `Sikh` = 42, `Others` = 2469, `No religion` = 2940, `Unknown` = 0, Total = 1009351),
  "Surin Province" = c(`Buddhism` = 1118193, `Islam` = 1493, `Christianity` = 2256, `Hindus` = 247, `Confucious` = 204, `Sikh` = 50, `Others` = 262, `No religion` = 197, `Unknown` = 0, Total = 1122900),
  "Tak Province" = c(`Buddhism` = 495044, `Islam` = 6586, `Christianity` = 22903, `Hindus` = 72, `Confucious` = 69, `Sikh` = 38, `Others` = 1322, `No religion` = 347, `Unknown` = 0, Total = 526381),
  "Trang Province" = c(`Buddhism` = 511698, `Islam` = 85609, `Christianity` = 1216, `Hindus` = 74, `Confucious` = 13, `Sikh` = 26, `Others` = 200, `No religion` = 40, `Unknown` = 0, Total = 598877),
  "Trat Province" = c(`Buddhism` = 239943, `Islam` = 6373, `Christianity` = 744, `Hindus` = 73, `Confucious` = 2, `Sikh` = 3, `Others` = 299, `No religion` = 438, `Unknown` = 0, Total = 247876),
  "Ubon Ratchathani Province" = c(`Buddhism` = 1733845, `Islam` = 1898, `Christianity` = 9850, `Hindus` = 539, `Confucious` = 140, `Sikh` = 150, `Others` = 107, `No religion` = 264, `Unknown` = 1, Total = 1746793),
  "Udon Thani Province" = c(`Buddhism` = 1279494, `Islam` = 1080, `Christianity` = 6554, `Hindus` = 263, `Confucious` = 64, `Sikh` = 45, `Others` = 866, `No religion` = 0, `Unknown` = 0, Total = 1288365),
  "Uthai Thani Province" = c(`Buddhism` = 296187, `Islam` = 467, `Christianity` = 728, `Hindus` = 19, `Confucious` = 7, `Sikh` = 15, `Others` = 12, `No religion` = 60, `Unknown` = 0, Total = 297493),
  "Uttaradit Province" = c(`Buddhism` = 436424, `Islam` = 664, `Christianity` = 1200, `Hindus` = 115, `Confucious` = 98, `Sikh` = 32, `Others` = 0, `No religion` = 18, `Unknown` = 27, Total = 438578),
  "Yala Province" = c(`Buddhism` = 100778, `Islam` = 331747, `Christianity` = 453, `Hindus` = 69, `Confucious` = 61, `Sikh` = 40, `Others` = 0, `No religion` = 16, `Unknown` = 3, Total = 433167),
  "Yasothon Province" = c(`Buddhism` = 482651, `Islam` = 453, `Christianity` = 4689, `Hindus` = 140, `Confucious` = 28, `Sikh` = 15, `Others` = 0, `No religion` = 0, `Unknown` = 0, Total = 487976)
)

national_control <- c(`Buddhism` = 61746429, `Islam` = 3259340, `Christianity` = 789376, `Hindus` = 41808, `Confucious` = 16718, `Sikh` = 11124, `Others` = 66922, `No religion` = 46122, `Unknown` = 3820, Total = 65981660)
# ===DATA_BLOCK_END===

# ---- reconciliation gates (fail-fast; stop, do not tune) ------------------------
# for each province: the nine category counts must sum to the printed Total row within
# the +-recon_bound published rounding residual. every deviation is recorded.
reconcile_provinces <- function(data) {
  records <- list()
  for (nm in names(data)) {
    v <- data[[nm]]
    cat_vals <- v[cats_en]
    if (anyNA(cat_vals)) {
      stop(sprintf("province %s is missing a religion category", nm), call. = FALSE)
    }
    total <- unname(v[["Total"]])
    catsum <- sum(cat_vals)
    dev <- catsum - total
    if (abs(dev) > recon_bound) {
      stop(sprintf("province %s FAILED reconciliation: category sum %d vs printed Total %d (dev %d > bound %d)",
                   nm, as.integer(catsum), as.integer(total), as.integer(dev), recon_bound), call. = FALSE)
    }
    records[[length(records) + 1L]] <- data.frame(
      province = nm, printed_total = as.integer(total), category_sum = as.integer(catsum),
      deviation = as.integer(dev), stringsAsFactors = FALSE)
  }
  do.call(rbind, records)
}

if (length(prov_data) != 76L) {
  stop(sprintf("expected 76 provinces (2010 census frame), have %d", length(prov_data)), call. = FALSE)
}
recon <- reconcile_provinces(prov_data)
n_exact <- sum(recon$deviation == 0L)
message(sprintf("province gate: PASSED (76 provinces; %d exact, %d within +-%d)",
                n_exact, 76L - n_exact, recon_bound))

# national cross-source control: sum of province Totals and per-category sums vs the
# WholeKingdom report Table 4; enforced within national_bound and recorded exactly.
national_from_provinces <- c(
  vapply(cats_en, function(c) sum(vapply(prov_data, function(v) v[[c]], numeric(1))), numeric(1)),
  Total = sum(vapply(prov_data, function(v) v[["Total"]], numeric(1))))
national_devs <- national_from_provinces[names(national_control)] - national_control
if (any(abs(national_devs) > national_bound)) {
  stop(sprintf("national cross-source gate FAILED: max |deviation| %d > bound %d",
               max(abs(national_devs)), national_bound), call. = FALSE)
}
message(sprintf("national control: province-sum total %d vs WholeKingdom %d (dev %d)",
                as.integer(national_from_provinces[["Total"]]),
                as.integer(national_control[["Total"]]),
                as.integer(national_from_provinces[["Total"]] - national_control[["Total"]])))

# ---- boundary ------------------------------------------------------------------
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
slugify <- function(x) {
  x <- sub(" Province$", "", x)
  x <- tolower(gsub("[^A-Za-z0-9]+", "_", x))
  gsub("^_|_$", "", x)
}

invisible(lapply(c(boundary_path, boundary_meta_path, extracted_path), require_file))

# confirm the pinned boundary licence, unit count, and type before use.
boundary_metadata <- fromJSON(boundary_meta_path, simplifyVector = FALSE)
if (!identical(boundary_metadata[["boundaryLicense"]], "Open Data Commons Open Database License 1.0") ||
    !identical(boundary_metadata[["admUnitCount"]], "77") ||
    !identical(boundary_metadata[["boundaryType"]], "ADM1")) {
  stop("geoBoundaries THA ADM1 licence, unit count, or type metadata changed", call. = FALSE)
}
boundary_licence <- boundary_metadata[["boundaryLicense"]]

# Thailand-centred equal-area projection for province land areas (far from antimeridian).
th_laea <- "+proj=laea +lat_0=13 +lon_0=101 +datum=WGS84 +units=m +no_defs"

# join the 76 census-frame provinces one-to-one to the geoBoundaries ADM1 features:
# union the Bueng Kan polygon into Nong Khai first (per-vintage 2010 frame; Bueng Kan
# was carved wholly from Nong Khai in 2011, so the union is the exact old extent).
build_boundary <- function(path) {
  boundary <- st_make_valid(st_read(path, quiet = TRUE, stringsAsFactors = FALSE))
  if (nrow(boundary) != 77L) stop("geoBoundaries THA ADM1 feature count is not 77", call. = FALSE)
  i_nk <- which(boundary[["shapeName"]] == "Nong Khai Province")
  i_bk <- which(boundary[["shapeName"]] == "Bueng Kan Province")
  if (length(i_nk) != 1L || length(i_bk) != 1L) {
    stop("Nong Khai or Bueng Kan feature not found for the 2010-frame union", call. = FALSE)
  }
  merged_geom <- st_make_valid(st_union(st_geometry(boundary)[i_nk], st_geometry(boundary)[i_bk]))
  st_geometry(boundary)[i_nk] <- merged_geom
  boundary <- boundary[-i_bk, ]
  if (nrow(boundary) != 76L) stop("2010-frame boundary is not 76 features after the union", call. = FALSE)
  names_b <- boundary[["shapeName"]]
  if (!setequal(names_b, names(prov_data))) {
    stop("census provinces and geoBoundaries shapeName values do not match one-to-one", call. = FALSE)
  }
  idx <- match(names(prov_data), names_b)
  boundary <- boundary[idx, ]
  boundary[["area_name"]] <- sub(" Province$", "", boundary[["shapeName"]])
  boundary[["boundary_source_name"]] <- boundary[["shapeName"]]
  boundary[["area_iso"]] <- boundary[["shapeISO"]]
  boundary[["area_code"]] <- slugify(boundary[["shapeName"]])
  if (anyDuplicated(boundary[["area_code"]])) stop("area_code slugs are not unique", call. = FALSE)
  boundary[["area_unit_id"]] <- paste(boundary_set_id, boundary[["area_code"]], sep = ":")
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- boundary_level
  boundary[["boundary_vintage"]] <- boundary_vintage
  boundary[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(boundary, th_laea))) / 1e6
  boundary <- st_transform(st_make_valid(boundary), 4326)
  boundary[c("area_code", "area_name", "area_iso", "boundary_source_name", "area_unit_id",
             "boundary_set_id", "boundary_level", "boundary_vintage",
             "land_area_sq_km", "geometry")]
}

boundary <- build_boundary(boundary_path)

# full-extent gate: Thailand spans lon ~97.3 to 105.7 E and lat ~5.6 to 20.5 N.
bbox <- st_bbox(boundary)
if (bbox[["xmin"]] < 96.5 || bbox[["xmin"]] > 98.5 ||
    bbox[["xmax"]] < 104.5 || bbox[["xmax"]] > 106.5 ||
    bbox[["ymin"]] < 5.0 || bbox[["ymin"]] > 7.0 ||
    bbox[["ymax"]] < 19.5 || bbox[["ymax"]] > 21.5) {
  stop("boundary bbox does not match the expected Thailand extent", call. = FALSE)
}

simplification <- mapshaper_simplify_to_cap(
  boundary, boundary_out,
  max_bytes = 1400000L,
  keep_percentages = c(30, 20, 15, 10, 7, 5, 3, 2),
  clean_option = "allow-overlaps"
)
written <- st_read(boundary_out, quiet = TRUE, stringsAsFactors = FALSE)
written <- written[match(boundary[["area_code"]], written[["area_code"]]), ]
if (anyNA(written[["area_code"]])) stop("simplified boundary lost an area code", call. = FALSE)
if (nrow(written) != 76L) stop("simplified boundary does not contain 76 features", call. = FALSE)
w_valid <- st_is_valid(written)
if (any(st_is_empty(written)) || any(is.na(w_valid)) || any(!w_valid)) {
  stop("simplified boundary has empty or invalid geometries", call. = FALSE)
}
geom_hashes <- geometry_hashes(written)
if (length(unique(geom_hashes)) != 76L) stop("simplified boundary geometry hashes are not distinct", call. = FALSE)
message(sprintf("boundary: PASSED (76 valid distinct features, %d bytes at %g%% keep)",
                file_bytes(boundary_out), simplification[["keep_percent"]]))

land_area <- setNames(round(written[["land_area_sq_km"]], 4), written[["area_name"]])
area_unit <- setNames(written[["area_unit_id"]], written[["area_name"]])
area_code <- setNames(written[["area_code"]], written[["area_name"]])
area_iso <- setNames(written[["area_iso"]], written[["area_name"]])
shape_name_by_area <- setNames(written[["boundary_source_name"]], written[["area_name"]])

# ---- product rows --------------------------------------------------------------
# slot design (ordinary two-slot, BZ/SB precedent): religious_affiliation is the
# province population minus the No religion line and the Unknown non-response line;
# no_religion is the single No religion line. Unknown stays in the denominator and in
# neither slot, so the two shares need not sum to 100. counts are integers (full count).

flag_common <- paste(
  "census_affiliation", "all_persons_universe", "single_select_reported_religion",
  "wave_2010_full_count_provincial_report_table4",
  "frame_2010_census_76_provinces_bueng_kan_within_nong_khai",
  "religious_affiliation_percent_is_named_religion_share",
  "no_religion_percent_is_no_religion_line_only",
  "unknown_nonresponse_in_denominator_neither_slot",
  "shares_need_not_sum_to_100",
  "no_cross_wave_change_single_wave",
  "licence_needs_review_build_then_ask_nso_attribution",
  "boundary_odbl_1_0_share_alike",
  sep = ";")

basis_2010 <- paste(
  "2010 Population and Housing Census provincial final report, Table 4 'Population by",
  "religion, sex and area', full-count enumeration (all households processed); the",
  "denominator is the printed province Total row. Religious affiliation is the province",
  "population minus the No religion and Unknown lines.")

# build one schema-shaped area-summary row per province, carrying the verbatim
# per-category counts and the reconciliation deviation on the quality flag.
make_row <- function(nm) {
  v <- prov_data[[shape_name_by_area[[nm]]]]
  pop <- unname(v[["Total"]])
  no_rel <- unname(v[[no_rel_label]])
  nonresp <- unname(v[[nonresp_label]])
  affiliation <- pop - no_rel - nonresp
  aff_pct <- round(100 * affiliation / pop, 4)
  no_pct <- round(100 * no_rel / pop, 4)
  dev <- sum(v[cats_en]) - pop
  breakdown <- paste(vapply(seq_along(cats_en), function(i)
    paste0(cats_en[i], "[", cats_th[i], "]=", as.integer(v[[cats_en[i]]])), character(1)),
    collapse = ";")
  nk_flag <- if (identical(shape_name_by_area[[nm]], "Nong Khai Province"))
    ";unit_is_2010_frame_nong_khai_including_later_bueng_kan_iso_th43_plus_th38" else ""
  full_flag <- paste0(flag_common, nk_flag,
                      ";category_sum_minus_printed_total=", as.integer(dev),
                      ";area_iso=", unname(area_iso[[nm]]),
                      ";source_categories_verbatim=", breakdown)
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = unname(area_unit[[nm]]),
    area_code = unname(area_code[[nm]]),
    area_name = nm,
    year = target_year,
    population_total = as.integer(pop),
    population_total_basis = basis_2010,
    religious_affiliation_count = as.integer(affiliation),
    religious_affiliation_percent = aff_pct,
    no_religion_count = as.integer(no_rel),
    no_religion_percent = no_pct,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = unname(land_area[[nm]]),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(d2010, d_boundary),
    quality_flag = full_flag
  )
}

province_names <- written[["area_name"]]
rows <- lapply(province_names, make_row)

# ---- area-summary document -----------------------------------------------------

licence_pending <- paste(
  "No reuse licence is stated on the 2010 census provincial final-report PDFs; the",
  "front matter records only the publisher (National Statistical Office, Social",
  "Statistics Bureau). The NSO open-data catalogue (catalog.nso.go.th) labels its",
  "published datasets 'Creative Commons Attributions' (fetched verbatim from the CKAN",
  "package_show API, 2026-07-12), which governs the catalogue's survey datasets rather",
  "than these archived census reports. The derived province summaries carry attribution",
  "to the National Statistical Office of Thailand and ship STAGED under the BUILD-THEN-ASK",
  "ruling (summaries-with-attribution stance, RO/SK/CI/MONSTAT/LK line); an NSO",
  "reuse-confirmation is the clean courtesy unblock. The boundary is Open Data Commons",
  "Open Database License 1.0 (ODbL; attribution and share-alike to OpenStreetMap).")

source_datasets <- function() {
  list(
    list(
      source_dataset_id = d2010,
      name = "Thailand 2010 Population and Housing Census, provincial final reports, Table 4: Population by religion, sex and area",
      provider = "National Statistical Office of Thailand (NSO)",
      url = report_url_base, retrieval_date = retrieval_date, local_path = reports_dir,
      licence = list(name = licence_pending, url = nso_home_url,
                     attribution = "National Statistical Office of Thailand, 2010 Population and Housing Census"),
      citation = "National Statistical Office of Thailand, 2010 Population and Housing Census, Provincial Reports, Table 4 (Population by religion, sex and area).",
      access_limits = "The live NSO hosts are WAF/Cloudflare-blocked to automation and the statbbi/nsoweb portals are decommissioned; the report PDFs were retrieved from Internet Archive replays of the NSO originals.",
      redistribution_limits = "Derived province summaries only; no open-data licence is stated on the census reports. Ships STAGED under BUILD-THEN-ASK with attribution.",
      notes = paste("77 provincial final reports cached (full-count enumeration); 76 ship on the 2010 frame (the BuengKan report is a deferred re-tabulation of eight old-Nong-Khai amphoes). One Table 4 per province,",
                    "nine verbatim categories (Buddhism, Islam, Christianity, Hindus, Confucious, Sikh, Others, No religion, Unknown).",
                    "Category counts sum to the printed province Total exactly or within a +-1 to +-3 person NSO independent-rounding residual,",
                    "disclosed per province. WholeKingdom and the four regional reports carry the same Table 4 as cross-source controls.")),
    list(
      source_dataset_id = d_boundary,
      name = "geoBoundaries THA ADM1 (77 provinces)",
      provider = "geoBoundaries (William & Mary geoLab); boundary source OpenStreetMap",
      url = boundary_url, retrieval_date = retrieval_date, local_path = boundary_path,
      licence = list(name = boundary_licence, url = boundary_meta_url,
                     attribution = "geoBoundaries (gbOpen); boundary source OpenStreetMap contributors (ODbL)"),
      citation = "geoBoundaries THA ADM1 (gbOpen, pinned 9469f09), 77 province boundaries.",
      access_limits = NULL,
      redistribution_limits = "The simplified derived boundary is committed under Open Data Commons Open Database License 1.0 (attribution and share-alike to OpenStreetMap contributors).",
      notes = paste("77 ADM1 provinces (boundaryYearRepresented 2017), rendered as the 76-unit 2010 census frame by unioning Bueng Kan into Nong Khai; joined one-to-one to the census provinces by shapeName after a",
                    "three-name concordance (Ayutthaya/Phra Nakhon Si Ayutthaya, Phachuap/Prachuap Khiri Khan, Ubonatchathani/Ubon Ratchathani).",
                    "shapeISO carries the ISO-3166-2 code. Thailand is far from the antimeridian; no dateline handling needed."))
  )
}

indicators <- function() {
  denom_note <- paste(
    "Percentages use each province's printed census population Total row. The Unknown",
    "(non-response) line stays in the denominator and outside both headline numerators,",
    "and the two shares therefore need not sum to 100%.")
  list(
    list(indicator_id = "population_total", label = "Census population total",
         description = "Province all-persons population in the 2010 census religion table (Table 4 Total row).",
         unit = "count", denominator_indicator_id = NULL,
         method = "Printed province Total row of the 2010 provincial report Table 4 (full-count enumeration).",
         temporal_coverage = "2010", spatial_coverage = "Thailand provinces (76, 2010 census frame)",
         quality_notes = "Religion is asked of the whole resident population of all ages. The Table 4 Total row equals the province Table 1 population total."),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
         description = "Share of the province population reporting affiliation with a named religion.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * (population - No religion - Unknown) / population.",
         temporal_coverage = "2010", spatial_coverage = "Thailand provinces (76, 2010 census frame)",
         quality_notes = paste("Single wave (2010); no cross-wave change is claimed. Category counts are carried verbatim; a +-1 to +-3 person NSO independent-rounding residual between the nine category counts and the printed Total is disclosed per province.", denom_note)),
    list(indicator_id = "no_religion_percent", label = "No religious affiliation %",
         description = "Share of the province population in the census No religion line.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 * No religion / population. The Unknown line is not part of this slot.",
         temporal_coverage = "2010", spatial_coverage = "Thailand provinces (76, 2010 census frame)",
         quality_notes = paste("The source category is 'No religion' (ไม่มีศาสนา); very small in Thailand (national no-religion share well under 0.1%).", denom_note))
  )
}

visual_layers <- function() {
  list(
    list(visual_layer_id = "th-province-religious-affiliation", label = "Religious affiliation %",
         description = "Thailand 2010 census-affiliation share by province.", layer_type = "choropleth",
         indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "province census population, including an Unknown non-response residual"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "reported province value", uncertainty_display = "quality_flag",
         default_visibility = TRUE,
         notes = "Census affiliation, not practice, attendance, or membership. The deep-South provinces (Pattani, Yala, Narathiwat, Satun) are Muslim-majority and sensitive; render neutrally per the country README."),
    list(visual_layer_id = "th-province-no-religion", label = "No religious affiliation %",
         description = "Thailand 2010 census no-religion share by province.", layer_type = "choropleth",
         indicator_ids = list("no_religion_percent"), geometry_unit_type = "area_unit",
         legend = list(unit = "percent", denominator = "province census population"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "reported province value", uncertainty_display = "quality_flag",
         default_visibility = FALSE,
         notes = "The source category is 'No religion'. The Unknown non-response line is excluded from this slot.")
  )
}

summary_product <- list(
  schema_version = "area-summary.v1", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code,
                      level = boundary_level, vintage = boundary_vintage, source_dataset_id = d_boundary),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "No governed place-of-worship snapshot ships in the Thailand census product.",
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
      no_religion_count = r[["no_religion_count"]],
      no_religion_percent = r[["no_religion_percent"]],
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

durable_file_record <- function(path, content, licence_status_value, licence_basis_value) {
  list(uri = paste0("repo:", path), storage_provider = "git_repository", format = sub("^.*\\.", "", path),
       bytes = file_bytes(path), sha256 = sha256_file(path),
       row_count = if (grepl("area_summary|\\.csv$", path)) row_count_file(path) else NULL,
       feature_count = if (grepl("\\.geojson$", path)) row_count_file(path) else NULL,
       content = content, privacy = "public",
       licence_status = licence_status_value, licence_basis = licence_basis_value)
}

licence_basis_slug <- "nso_no_stated_licence_attribution_build_then_ask"

# raw report retrieval record (77 provinces + WholeKingdom + 4 regional controls).
report_files <- sort(list.files(reports_dir, pattern = "_T\\.pdf$", full.names = TRUE))
raw_report_records <- lapply(report_files, function(p) {
  list(uri = p, url = paste0(report_url_base, basename(p)), format = "pdf",
       bytes = file_bytes(p), sha256 = sha256_file(p), row_count = NULL,
       source_dataset_id = d2010,
       used_in_public_product = !grepl("WholeKingdom|Central|Northern|Northeastern|Southern|BuengKan", basename(p)),
       periods = "2010",
       notes = "2010 census provincial final report; Table 4 religion by province (full count). Retrieved from Internet Archive replay of the NSO original.",
       local_cache_hint = paste0(p, " (git-ignored by .gitignore data/ rule)"),
       raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/th_census/"))
})
raw_aux_records <- list(
  list(uri = boundary_path, url = boundary_url, format = "geojson", bytes = file_bytes(boundary_path),
       sha256 = sha256_file(boundary_path), row_count = NULL, source_dataset_id = d_boundary,
       used_in_public_product = TRUE, periods = "2017",
       notes = "geoBoundaries THA ADM1 GeoJSON; 77 provinces, ODbL 1.0. Pinned commit 9469f09.",
       local_cache_hint = paste0(boundary_path, " (git-ignored)"),
       raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/th_census/")),
  list(uri = boundary_meta_path, url = boundary_meta_url, format = "json", bytes = file_bytes(boundary_meta_path),
       sha256 = sha256_file(boundary_meta_path), row_count = NULL, source_dataset_id = d_boundary,
       used_in_public_product = FALSE, periods = "2017",
       notes = "geoBoundaries THA ADM1 metadata; records ODbL 1.0, admUnitCount 77, boundaryYearRepresented 2017.",
       local_cache_hint = paste0(boundary_meta_path, " (git-ignored)"),
       raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/th_census/")),
  list(uri = extracted_path, url = NA, format = "json", bytes = file_bytes(extracted_path),
       sha256 = sha256_file(extracted_path), row_count = NULL, source_dataset_id = d2010,
       used_in_public_product = TRUE, periods = "2010",
       notes = "Transcription of Table 4 (Total column) from the cached provincial report PDFs via pdftotext Thai-anchor extraction; the counts embedded in this build.",
       local_cache_hint = paste0(extracted_path, " (git-ignored)"),
       raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/th_census/"))
)
raw_sources <- c(raw_report_records, raw_aux_records)

dataset_hash <- substr(sha256_file(summary_json_out), 1L, 12L)
dataset_id <- "th-census-religion:th:2010:nso-province"

recon_records <- lapply(seq_len(nrow(recon)), function(i) as.list(recon[i, ]))

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = paste0("manifest:", dataset_id),
  dataset_id = dataset_id,
  dataset_version_id = paste0(dataset_id, ":", dataset_hash),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "th-census-religion", dataset_role = "staged_evidence",
  scope = list(level = "country", country_codes = list("TH"), snapshot_date = NULL,
               snapshot_anchor = NULL, pipeline_stage = "staged"),
  created_at = stamp, created_by = script_id,
  target_years = list(2010L),
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation",
      shipped_waves = list(2010L),
      shipped_geography = "76 Thailand provinces (changwat) on the 2010 census frame (Bueng Kan within Nong Khai)",
      boundary_set = boundary_set_id,
      source_table = "2010 census provincial final reports, Table 4 'Population by religion, sex and area' (full-count, 9 categories)",
      universe = "all persons, all ages; province Total row of Table 4",
      extraction_note = paste(
        "The 76 census-frame province counts were transcribed from the cached provincial report PDFs (data/raw/th_census/reports2010)",
        "with pdftotext -layout, keying on the stable Thai category labels (English labels carry per-report typos e.g.",
        "'Buddihism' in Tak, and the reversed Total label 'รวมยอด' in Ayutthaya). The transcription is data/raw/th_census/table4_extracted.json,",
        "sha256-pinned in raw_sources, and embedded in this build."),
      slot_design = paste(
        "Ordinary two-slot (BZ/SB precedent). religious_affiliation_percent is the share of the province population",
        "reporting a named religion (population minus No religion minus Unknown); no_religion_percent is the single",
        "No religion line. The Unknown non-response line stays in the denominator and in neither slot, so the two",
        "shares need not sum to 100."),
      category_frame = list(english = as.list(cats_en), thai = as.list(cats_th)),
      reconciliation_rule = paste(
        "Per province, the nine category counts must sum to the printed Total row within a +-3 person bound (the",
        "observed maximum NSO independent-rounding residual in these full-count tables). Every deviation is recorded;",
        "counts are carried verbatim, never repaired. The slots use the printed Total row as the denominator, so",
        "affiliation% + no-religion% + unknown% = 100% exactly."),
      change_rule = "Single wave (2010); no cross-wave change is claimed. The 2000 province religion is percentage-only (two categories, no counts); not compared.",
      bueng_kan_note = paste(
        "The 2010 census enumeration (1 September 2010) predates Bueng Kan province (created March 2011 from eight",
        "Nong Khai amphoes). The NongKhai provincial report is the old frame -- its Table 1 lists all 17 amphoes",
        "including the eight later transferred -- and the separate BuengKan report re-tabulates those same eight",
        "amphoes, so summing all 77 reports double-counts Bueng Kan (+362,747 against the WholeKingdom Table 4 total;",
        "Bueng Kan's own total is 362,754). The product therefore ships the NSO-published 2010 frame: 76 provinces,",
        "with the Bueng Kan polygon unioned into Nong Khai (geometrically exact; Bueng Kan was carved wholly from",
        "Nong Khai). The BuengKan re-tabulation is recorded as a deferred source; no unpublished cell is derived by",
        "subtraction and no allocation is invented."),
      territorial_note = "The deep-South provinces (Pattani, Yala, Narathiwat, Satun) are Muslim-majority and politically sensitive; the build renders the NSO record neutrally. Separate page annotation is a page-lane concern.",
      omitted_metrics = list("places_per_10000_residents", "place_density_per_sq_km"),
      boundary_simplification = simplification,
      access_note = paste(
        "statbbi.nso.go.th and nsoweb.nso.go.th are decommissioned (NXDOMAIN via Cloudflare DoH); the live www.nso.go.th",
        "is behind a CloudWAF/Cloudflare managed challenge that blocks automation. The report PDFs were retrieved from",
        "Internet Archive replays of the NSO originals; content type verified on every download."),
      local_cache_hint = "All raw sources are cached under data/raw/th_census/ and remain git-ignored.",
      retrieval_record = raw_sources
    ),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")), digest = as.character(packageVersion("digest")),
      mapshaper = "scripts/lib/simplify_boundary.R (npx mapshaper)",
      extraction = "pdftotext (poppler) -layout + Thai-anchor parse (data/raw/th_census/extract_table4.py)"
    )
  ),
  source = list(
    provider = "National Statistical Office of Thailand (NSO); geoBoundaries (William & Mary geoLab)",
    source_dataset_ids = list(d2010, d_boundary),
    source_urls = list(report_url_base, boundary_url, boundary_meta_url),
    retrieved_at = stamp,
    licence = licence_pending,
    citation = "NSO Thailand 2010 Population and Housing Census, Provincial Reports Table 4; geoBoundaries THA ADM1 (gbOpen).",
    raw_redistribution = "The census report PDFs and the geoBoundaries source GeoJSON are not committed; they remain in data/raw/th_census/.",
    local_cache_hint = "data/raw/th_census/ (git-ignored by .gitignore data/ rule)",
    raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/th_census/")
  ),
  input_manifests = list(),
  raw_sources = raw_sources,
  durable_files = list(
    durable_file_record(summary_json_out, "Thailand 76-province (2010 census frame) census-affiliation area summary.", "needs_review", licence_basis_slug),
    durable_file_record(summary_csv_out, "Flattened Thailand 76-province (2010 census frame) census-affiliation rows.", "needs_review", licence_basis_slug),
    durable_file_record(boundary_out, "Simplified 76-unit 2010-census-frame boundary GeoJSON (geoBoundaries THA ADM1; Bueng Kan unioned into Nong Khai).", "accepted", "geoboundaries_odbl_1_0")
  ),
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id,
         notes = "76 census-frame provinces x 1 wave = 76 rows; all-persons full-count universe; verbatim nine-category breakdown in quality_flag."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out), built_by = script_id,
         notes = "76 province features (2010 frame: Bueng Kan unioned into Nong Khai) from geoBoundaries THA ADM1, simplified with mapshaper weighted keep-shapes.")
  ),
  validation = list(
    status = "passed_with_warnings",
    commands = list(
      paste("Rscript", script_id),
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/th/data/area_summary_province.json",
      "bash scripts/validate_manifests.sh"
    ),
    province_reconciliation = list(status = "passed", provinces = 76L,
                                   exact = as.integer(n_exact), within_bound = as.integer(76L - n_exact),
                                   bound = recon_bound, records = recon_records),
    national_control = list(status = "passed", bound = national_bound,
                            province_sum_total = as.integer(national_from_provinces[["Total"]]),
                            wholekingdom_total = as.integer(national_control[["Total"]]),
                            deviations = as.list(national_devs)),
    boundary_validation = list(status = "passed", feature_count = 76L,
                               distinct_geometry_hashes = length(unique(geom_hashes)),
                               bbox = list(xmin = unname(bbox[["xmin"]]), ymin = unname(bbox[["ymin"]]),
                                           xmax = unname(bbox[["xmax"]]), ymax = unname(bbox[["ymax"]])),
                               dateline_note = "extent lon ~97-106E, lat ~5.6-20.5N; far from the antimeridian, no dateline handling needed",
                               output_bytes = file_bytes(boundary_out), simplification = simplification,
                               licence = boundary_licence, adm_unit_count = boundary_metadata[["admUnitCount"]]),
    join_coverage = list(matched_provinces = 76L, expected_provinces = 76L, unmatched_provinces = list(),
                         unused_boundary_features = list("Bueng Kan Province (unioned into Nong Khai for the 2010 frame)")),
    notes = "76 census-frame provinces reconcile to their printed Table 4 Total within a +-3 person NSO independent-rounding bound, and their sums reconcile to the WholeKingdom national Table 4 within -7 (total) and +-14 (categories); the 2010-frame boundary (Bueng Kan unioned into Nong Khai) joins 76/76 with 76 distinct geometry hashes.",
    warnings = list(
      "STAGED product: no page, no hub link. Licence needs review; ships under BUILD-THEN-ASK with attribution to NSO (no stated reuse licence on the census reports).",
      "About half the provinces carry a +-1 to +-3 person residual between the nine category counts and the printed Total row (NSO independent-rounding in a full-count table); carried verbatim and disclosed per province, never repaired. The cross-report national control deviates by -7 (total) and at most +-14 (categories), likewise disclosed.",
      "Single wave (2010): no cross-wave change is claimed. 2000 province religion is percentage-only (Buddhism/Muslim, no counts); 2020 is register-assisted with no located province religion table.",
      "2010 census frame: 76 provinces. The Bueng Kan re-tabulation (NSO, post-2011 frame) is a deferred source; the Nong Khai row and polygon include the later Bueng Kan territory.",
      "The deep-South provinces are Muslim-majority and sensitive; the data renders the NSO record neutrally, and separate page annotation is left to the page lane."
    )
  ),
  construct_notes = list(
    "The construct is census affiliation: each resident's reported religion (2010 questionnaire 'What religion': Buddhism, Islam, Christianity, ...), asked of the whole resident population of all ages, not practice, attendance, or membership.",
    "The public product carries three headline fields per province: population total, religious affiliation percent, and no-religion percent. Place-density metrics are null (no governed place-of-worship snapshot).",
    "Slot design (ordinary two-slot, BZ/SB precedent): religious_affiliation_percent is the share reporting a named religion (population minus No religion minus Unknown); no_religion_percent is the single No religion line. The Unknown non-response line stays in the denominator and in neither slot; the two shares therefore need not sum to 100.",
    "Single wave (2010). The 2000 census publishes province religion only as a two-category percentage summary (Buddhism %, Muslim %) with no counts and no no-religion line; the 2020 register-assisted census has no located province religion table. No cross-wave change is asserted.",
    "Boundary: geoBoundaries THA ADM1 rendered on the 2010 census frame -- 76 provinces, with Bueng Kan (created March 2011) unioned into Nong Khai, geometrically exact. Licence Open Data Commons Open Database License 1.0 (ODbL, share-alike). The 76 units join one-to-one to the NSO 2010 provincial reports by name after a three-name concordance. The NSO Bueng Kan re-tabulation is a deferred source; no unpublished cell is derived."
  ),
  deferred_sources = list(
    list(source_dataset_id = "th-census-2010-bueng-kan-retabulation", status = "deferred",
         url = paste0(report_url_base, "BuengKan_T.pdf"), local_path = file.path(reports_dir, "BuengKan_T.pdf"),
         notes = paste("NSO re-tabulation of the eight Nong Khai amphoes that became Bueng Kan province (March 2011):",
                       "Table 4 total 362,754 (Buddhism 360,468; Islam 242; Christianity 1,913). Published on the",
                       "post-2011 frame; using it beside the old-frame NongKhai report double-counts. Recorded for a",
                       "possible future finer-frame view; not shipped in the 2010-frame product.")),
    list(source_dataset_id = "th-census-2000-religion-by-province", status = "deferred",
         url = "http://web.nso.go.th/census/poph/finalrep/tables/", local_path = NULL,
         notes = "2000 census province religion is percentage-only (Buddhism %, Muslim %) in the provincial workbooks; the full nine-category count table is region-level (eadv_tab3.xls, in thousands) or was on the decommissioned statbbi portal. Not shipped."),
    list(source_dataset_id = "th-census-2020-religion-by-province", status = "not_located",
         url = nso_home_url, local_path = NULL,
         notes = "The 2020 register-assisted census has no located province religion count table in open products; recovery would need the WAF-gated live portal or an NSO request."),
    list(source_dataset_id = "nso-licence-confirmation", status = "not_pinned",
         url = nso_home_url, local_path = NULL,
         notes = "An NSO reuse-confirmation is the clean courtesy unblock under BUILD-THEN-ASK; none is held. The catalogue posture is 'Creative Commons Attributions'.")
  ),
  privacy = "public",
  licence_status = "needs_review",
  licence_basis = licence_basis_slug,
  downstream_status = "staged",
  source_datasets = source_datasets(),
  notes = paste(
    "STAGED product (no page, no hub link). The committed products are the derived 76-province area summary (76 rows,",
    "2010 census frame: Bueng Kan within Nong Khai) and the simplified geoBoundaries THA ADM1 2010-frame boundary. Ships under BUILD-THEN-ASK with attribution to the",
    "National Statistical Office of Thailand (NSO) and geoBoundaries (ODbL 1.0)."
  )
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

cat("wave shipped: 2010 on 76 Thailand provinces (2010 census frame)\n")
cat(sprintf("rows: %d\n", length(rows)))
cat(sprintf("province gate: passed; %d exact, %d within +-%d\n", n_exact, 76L - n_exact, recon_bound))
cat(sprintf("boundary gate: passed; 76/76 join, %d distinct geometry hashes, %d bytes at %g%% keep\n",
            length(unique(geom_hashes)), file_bytes(boundary_out), simplification[["keep_percent"]]))
cat("licence gate: needs_review; STAGED under BUILD-THEN-ASK with NSO attribution\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", boundary_out))
cat(sprintf("wrote %s\n", manifest_out))
