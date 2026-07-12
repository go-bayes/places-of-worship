# build the Jamaica 2011 census-religion parish product from STATIN Volume 6 Table 5
# ("Population by Sex and Religious Affiliation/Denomination, by Parish").
#
# inputs: the cached Vol 6 thematic report PDF, the Vol 1 general report PDF (national
# comparison run only), the STATIN Terms & Conditions of Data Use capture, and the
# geoBoundaries JAM ADM1 boundary with its release metadata, all under git-ignored
# data/raw/jm_census/ with sha256 pins recorded in research/countries/jm/route-probe.md
# and asserted below. Table 5's Total column is transcribed verbatim into this script
# (each parish's printed rows in printed order with the parish's own printed spellings)
# and the build re-derives every printed Total-column margin as a fail-fast gate.
# outputs: apps/regions/jm/data/area_summary_parish.{json,csv},
# apps/regions/jm/data/jm_parish_2011.geojson, and the tracked data manifest
# docs/manifests/jm-census-religion-2011.json.
# run from the repo root: Rscript scripts/build_jm_area_summary.R
#
# product scope. 14 parish units, one wave (2011). the universe is the 2011 de jure
# religion universe (national total 2,684,115, slightly below the full census population
# of 2,697,983; the difference is a residual not carried in the religion tabulation).
# the product ships the Total column only: the printed Male/Female columns carry small
# margin defects (documented in the manifest), while the Total column is integer-exact
# at every printed margin.
#
# frame design (conductor ruling, 2026-07-12, on the build-lane STOP). Vol 6 Table 5
# prints a HETEROGENEOUS parish frame and this build ships it exactly as printed —
# zero merges, zero reconstruction, per the verbatim-over-uniform precedent line.
# eleven parishes print 19 categories with the four small non-Christian groups (Bahai,
# Hinduism, Islam, Judaism) included in the parish Other line by source design (the
# table's own footnote); St Andrew prints all four small groups (23 categories),
# St James prints Hinduism (20), and St Catherine prints Islam (20). the four small
# groups are therefore non-additive parish-to-national by source design: the
# un-broken-out residuals (Bahai 160, Hinduism 484, Islam 658, Judaism 180; 1,482 in
# all) sit inside the parish Other lines, whose sum exceeds the national Other line by
# exactly 1,482. the build gates on that identity and records it as a source-design
# fact, never as an error.
#
# slot design (per-row verbatim labels; slot assignment by ROLE, not by string).
# each parish prints exactly one affirmative no-religion line — spelled
# "No Religious Affiliation/Denomination" (8 parishes), "No Religion/Denomination"
# (St Andrew, St Thomas, Trelawny), or "None" (Manchester, Clarendon, St Catherine) —
# and that line fills the no_religion slot whatever its spelling (national 571,982).
# each parish prints exactly one non-response line — "Not Reported" (9 parishes) or
# "Not Stated" (Westmoreland, St Elizabeth, Manchester, Clarendon, St Catherine) —
# which stays inside the denominator and outside both slots (national 61,374). every
# other printed line is the religious_affiliation slot (national 2,050,759). the
# role-to-label mapping is recorded per parish in the manifest.
#
# gate design (Total column, integer-exact, fail-fast; reworded gate per the conductor
# ruling). the national block's 23 categories sum to 2,684,115; every parish's PRINTED
# categories sum to its printed parish total; the 14 parish totals sum to 2,684,115;
# each of the 16 denominational lines printed in every parish reconciles
# parish-to-national exactly; the no-religion and non-response roles reconcile to
# 571,982 and 61,374 exactly; and the small-group residual identity closes exactly
# (residuals 160+484+658+180 = 1,482 = parish Other sum 143,461 minus national Other
# 141,979). any nonzero deviation stops the build; no count is allocated, inferred,
# imputed, or tuned.
#
# licence. STATIN Terms & Conditions of Data Use: open reuse grant (non-exclusive,
# royalty-free, commercial and non-commercial, derivative works) with attribution, an
# indication of changes, and a link to the original data; licence_status accepted.
# boundary geoBoundaries JAM ADM1 CC BY-SA 2.0 (OpenStreetMap contributors; the derived
# boundary ships share-alike).

suppressPackageStartupMessages({
  library(jsonlite)
  library(sf)
  library(digest)
})
source("scripts/lib/simplify_boundary.R")

country_code <- "JM"
script_id <- "scripts/build_jm_area_summary.R"
raw_dir <- "data/raw/jm_census"
output_dir <- "apps/regions/jm/data"
manifest_dir <- "docs/manifests"

retrieval_date <- "2026-07-12"
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")

# ---- cached inputs, pinned source URLs, and probe sha256 pins ---------------

census_pdf <- file.path(raw_dir, "vol6_religion.pdf")
vol1_pdf <- file.path(raw_dir, "vol1_general.pdf")
licence_html <- file.path(raw_dir, "terms-of-use.html")
boundary_path <- file.path(raw_dir, "geoBoundaries-JAM-ADM1.geojson")
boundary_meta_path <- file.path(raw_dir, "gb_jam_adm1_meta.json")

url_census_pdf <- "https://census.statinja.gov.jm/wp-content/themes/futurio-child/Census2011Reports/Population and Housing Census 2011 Jamaica Ethnic Origin & Religious Affiliation Vol 6 .pdf"
url_vol1_pdf <- "https://census.statinja.gov.jm/wp-content/themes/futurio-child/Census2011Reports/Population and Housing Census 2011 Jamaica General Report Vol 1.pdf"
url_licence <- "https://statinja.gov.jm/terms-of-use.aspx"
url_boundary <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/JAM/ADM1/geoBoundaries-JAM-ADM1.geojson"
url_boundary_meta <- "https://www.geoboundaries.org/api/current/gbOpen/JAM/ADM1/"

# sha256 pins recorded in the probe (research/countries/jm/route-probe.md); the build
# stops if any cached source drifts from its pinned value.
probe_sha256 <- c(
  "data/raw/jm_census/vol6_religion.pdf" = "fb6b1c30cd2d760bad4025249a2e12c3444ef7d13746645dfb89ba6171145dd1",
  "data/raw/jm_census/vol1_general.pdf" = "7b81cfa16010a6bfab8d2ce2c44b1d15e9b0ca7851a9b12d5dfc556e7e93e25d",
  "data/raw/jm_census/terms-of-use.html" = "d6a13671144cb51983eab771d92e650266a25ba88b5fff04124eae3ea11a7a81",
  "data/raw/jm_census/geoBoundaries-JAM-ADM1.geojson" = "54e50f3b788cfcabe8d7b17031bc103c7dd550082da4755f9de6617b82d8d5b0",
  "data/raw/jm_census/gb_jam_adm1_meta.json" = "f2d174ffcc2af398a9728e4057a0cf471531cbd51e8511e4afaae80906108058"
)

boundary_set_id <- "jm-parish-2011-geoboundaries-adm1"
boundary_output <- file.path(output_dir, "jm_parish_2011.geojson")
summary_output <- file.path(output_dir, "area_summary_parish.json")
summary_csv_output <- file.path(output_dir, "area_summary_parish.csv")
manifest_output <- file.path(manifest_dir, "jm-census-religion-2011.json")

dataset_id_census <- "statin-jm-2011-vol6-table5-religion-parish"
dataset_id_boundary <- "geoboundaries-jam-adm1"

wave_year <- 2011L
national_total <- 2684115L

# ---- Table 5 source grid (Total column, transcribed verbatim) ---------------
# national block (All Jamaica), 23 categories, Total column, verbatim printed order
national_labels <- c("Anglican", "Baptist", "Brethren", "Church of God in Jamaica", "Church of God of Prophecy", "New Testament Church of God", "Other Church of God", "Jehovah's Witness", "Methodist", "Moravian", "Pentecostal", "Rastafarian", "Revivalist", "Roman Catholic", "Seventh-Day Adventist", "United Church", "Bahai", "Hinduism", "Islam", "Judaism", "Other Religion/Denomination", "No Religion/Denomination", "Not Reported")
national_counts <- c(75143L, 180712L, 24128L, 129540L, 121254L, 192128L, 247291L, 50854L, 43387L, 18358L, 319730L, 29040L, 36413L, 58082L, 322261L, 56334L, 269L, 1838L, 1512L, 506L, 141979L, 571982L, 61374L)

# the 14 parish blocks, Total column, each parish's printed rows verbatim in printed
# order with the parish's own printed spellings (three spellings each for the Other,
# no-religion, and non-response lines; St Andrew / St James / St Catherine carry the
# printed small-group breakout rows)
parish_blocks <- list(
  list(
    area_code = "JM-01", census_name = "Kingston", shape_name = "Kingston",
    printed_total = 84606L,
    labels = c("Anglican", "Baptist", "Brethren", "Church of God in Jamaica", "Church of God of Prophecy", "New Testament Church of God", "Other Church of God", "Jehovah's Witness", "Methodist", "Moravian", "Pentecostal", "Rastafarian", "Revivalist", "Roman Catholic", "Seventh-Day Adventist", "United Church", "Other Religious Affiliation/Denomination", "No Religious Affiliation/Denomination", "Not Reported"),
    counts = c(2535L, 3635L, 1019L, 5008L, 2306L, 3170L, 4998L, 1086L, 1150L, 357L, 12654L, 1300L, 1256L, 3602L, 5445L, 1587L, 1756L, 28794L, 2948L)
  ),
  list(
    area_code = "JM-02", census_name = "St Andrew", shape_name = "Saint Andrew",
    printed_total = 571194L,
    labels = c("Anglican", "Baptist", "Brethren", "Church of God in Jamaica", "Church of God of Prophecy", "New Testament Church of God", "Other Church of God", "Jehovah's Witness", "Methodist", "Moravian", "Pentecostal", "Rastafarian", "Revivalist", "Roman Catholic", "Seventh-Day Adventist", "United Church", "Bahai", "Hinduism", "Islam", "Judaism", "Other Religion/Denomination", "No Religion/Denomination", "Not Reported"),
    counts = c(21580L, 32331L, 8162L, 43309L, 18116L, 32639L, 41655L, 7711L, 10562L, 2277L, 59147L, 7629L, 6861L, 28058L, 51140L, 11779L, 109L, 967L, 483L, 326L, 20888L, 148025L, 17440L)
  ),
  list(
    area_code = "JM-03", census_name = "St Thomas", shape_name = "Saint Thomas",
    printed_total = 93742L,
    labels = c("Anglican", "Baptist", "Brethren", "Church of God in Jamaica", "Church of God of Prophecy", "New Testament Church of God", "Other Church of God", "Jehovah's Witness", "Methodist", "Moravian", "Pentecostal", "Rastafarian", "Revivalist", "Roman Catholic", "Seventh-Day Adventist", "United Church", "Other Religion/Denomination", "No Religion/Denomination", "Not Reported"),
    counts = c(1624L, 8048L, 424L, 3174L, 5860L, 4565L, 12720L, 1705L, 2709L, 37L, 9247L, 1365L, 3355L, 865L, 9614L, 454L, 4326L, 21155L, 2495L)
  ),
  list(
    area_code = "JM-04", census_name = "Portland", shape_name = "Portland",
    printed_total = 81566L,
    labels = c("Anglican", "Baptist", "Brethren", "Church of God in Jamaica", "Church of God of Prophecy", "New Testament Church of God", "Other Church of God", "Jehovah's Witness", "Methodist", "Moravian", "Pentecostal", "Rastafarian", "Revivalist", "Roman Catholic", "Seventh-Day Adventist", "United Church", "Other Religious Affiliation/Denomination", "No Religious Affiliation/Denomination", "Not Reported"),
    counts = c(2633L, 5632L, 487L, 2257L, 3123L, 5919L, 6475L, 1808L, 1611L, 34L, 6899L, 1126L, 1976L, 707L, 14198L, 1611L, 5825L, 18248L, 997L)
  ),
  list(
    area_code = "JM-05", census_name = "St Mary", shape_name = "Saint Mary",
    printed_total = 113172L,
    labels = c("Anglican", "Baptist", "Brethren", "Church of God in Jamaica", "Church of God of Prophecy", "New Testament Church of God", "Other Church of God", "Jehovah's Witness", "Methodist", "Moravian", "Pentecostal", "Rastafarian", "Revivalist", "Roman Catholic", "Seventh-Day Adventist", "United Church", "Other Religious Affiliation/Denomination", "No Religious Affiliation/Denomination", "Not Reported"),
    counts = c(2901L, 7545L, 1404L, 3557L, 3749L, 5425L, 11721L, 2188L, 1710L, 49L, 11458L, 1317L, 1769L, 2388L, 16937L, 4880L, 6007L, 25872L, 2295L)
  ),
  list(
    area_code = "JM-06", census_name = "St Ann", shape_name = "Saint Ann",
    printed_total = 171740L,
    labels = c("Anglican", "Baptist", "Brethren", "Church of God in Jamaica", "Church of God of Prophecy", "New Testament Church of God", "Other Church of God", "Jehovah's Witness", "Methodist", "Moravian", "Pentecostal", "Rastafarian", "Revivalist", "Roman Catholic", "Seventh-Day Adventist", "United Church", "Other Religious Affiliation/Denomination", "No Religious Affiliation/Denomination", "Not Reported"),
    counts = c(4093L, 16115L, 753L, 4694L, 9740L, 17051L, 12656L, 4471L, 6521L, 242L, 31571L, 1580L, 1159L, 1927L, 16804L, 2379L, 11458L, 24506L, 4020L)
  ),
  list(
    area_code = "JM-07", census_name = "Trelawny", shape_name = "Trelawny",
    printed_total = 74991L,
    labels = c("Anglican", "Baptist", "Brethren", "Church of God in Jamaica", "Church of God of Prophecy", "New Testament Church of God", "Other Church of God", "Jehovah's Witness", "Methodist", "Moravian", "Pentecostal", "Rastafarian", "Revivalist", "Roman Catholic", "Seventh-Day Adventist", "United Church", "Other Religion/Denomination", "No Religion/Denomination", "Not Reported"),
    counts = c(3119L, 9145L, 444L, 830L, 1655L, 9489L, 3640L, 1780L, 1630L, 31L, 11406L, 802L, 1166L, 470L, 9171L, 1983L, 3651L, 12955L, 1624L)
  ),
  list(
    area_code = "JM-08", census_name = "St James", shape_name = "Saint James",
    printed_total = 182820L,
    labels = c("Anglican", "Baptist", "Brethren", "Church of God in Jamaica", "Church of God of Prophecy", "New Testament Church of God", "Other Church of God", "Jehovah's Witness", "Methodist", "Moravian", "Pentecostal", "Rastafarian", "Revivalist", "Roman Catholic", "Seventh-Day Adventist", "United Church", "Hinduism", "Other Religious Affiliation/Denomination", "No Religious Affiliation/Denomination", "Not Reported"),
    counts = c(3609L, 16292L, 970L, 3937L, 3561L, 11925L, 11558L, 5766L, 1801L, 583L, 25406L, 1726L, 1708L, 2315L, 37255L, 2722L, 387L, 9317L, 37989L, 3993L)
  ),
  list(
    area_code = "JM-09", census_name = "Hanover", shape_name = "Hanover",
    printed_total = 69398L,
    labels = c("Anglican", "Baptist", "Brethren", "Church of God in Jamaica", "Church of God of Prophecy", "New Testament Church of God", "Other Church of God", "Jehovah's Witness", "Methodist", "Moravian", "Pentecostal", "Rastafarian", "Revivalist", "Roman Catholic", "Seventh-Day Adventist", "United Church", "Other Religious Affiliation/Denomination", "No Religious Affiliation/Denomination", "Not Reported"),
    counts = c(1184L, 4495L, 41L, 997L, 1301L, 7383L, 3555L, 2195L, 1671L, 35L, 4649L, 864L, 681L, 540L, 14414L, 3387L, 5744L, 14751L, 1511L)
  ),
  list(
    area_code = "JM-10", census_name = "Westmoreland", shape_name = "Westmoreland",
    printed_total = 143847L,
    labels = c("Anglican", "Baptist", "Brethren", "Church of God in Jamaica", "Church of God of Prophecy", "New Testament Church of God", "Other Church of God", "Jehovah's Witness", "Methodist", "Moravian", "Pentecostal", "Rastafarian", "Revivalist", "Roman Catholic", "Seventh-Day Adventist", "United Church", "Other Religious Affiliation/Denomination", "No Religious Affiliation/Denomination", "Not Stated"),
    counts = c(4370L, 7292L, 255L, 2684L, 4687L, 12255L, 9663L, 2804L, 1600L, 1597L, 15776L, 1534L, 2326L, 2754L, 21440L, 3036L, 17716L, 29155L, 2903L)
  ),
  list(
    area_code = "JM-11", census_name = "St Elizabeth", shape_name = "Saint Elizabeth",
    printed_total = 150025L,
    labels = c("Anglican", "Baptist", "Brethren", "Church of God in Jamaica", "Church of God of Prophecy", "New Testament Church of God", "Other Church of God", "Jehovah's Witness", "Methodist", "Moravian", "Pentecostal", "Rastafarian", "Revivalist", "Roman Catholic", "Seventh-Day Adventist", "United Church", "Other Religious Affiliation/Denomination", "No Religious Affiliation/Denomination", "Not Stated"),
    counts = c(7227L, 9787L, 3593L, 5195L, 5601L, 8798L, 11511L, 2575L, 2517L, 4700L, 20635L, 1223L, 2070L, 1283L, 20856L, 2067L, 7035L, 31359L, 1993L)
  ),
  list(
    area_code = "JM-12", census_name = "Manchester", shape_name = "Manchester",
    printed_total = 188826L,
    labels = c("Anglican", "Baptist", "Brethren", "Church of God in Jamaica", "Church of God of Prophecy", "New Testament Church of God", "Other Church of God", "Jehovah's Witness", "Methodist", "Moravian", "Pentecostal", "Rastafarian", "Revivalist", "Roman Catholic", "Seventh-Day Adventist", "United Church", "Other", "None", "Not Stated"),
    counts = c(6054L, 8271L, 1815L, 9075L, 14058L, 15292L, 16869L, 3806L, 1516L, 6566L, 24734L, 1514L, 1881L, 2015L, 27762L, 8765L, 13515L, 22343L, 2975L)
  ),
  list(
    area_code = "JM-13", census_name = "Clarendon", shape_name = "Clarendon",
    printed_total = 244655L,
    labels = c("Anglican", "Baptist", "Brethren", "Church of God in Jamaica", "Church of God of Prophecy", "New Testament Church of God", "Other Church of God", "Jehovah's Witness", "Methodist", "Moravian", "Pentecostal", "Rastafarian", "Revivalist", "Roman Catholic", "Seventh-Day Adventist", "United Church", "Other", "None", "Not Stated"),
    counts = c(4183L, 19756L, 1694L, 11883L, 20040L, 29510L, 40653L, 3751L, 2666L, 631L, 22661L, 2496L, 4701L, 1519L, 20467L, 6007L, 11571L, 36469L, 3997L)
  ),
  list(
    area_code = "JM-14", census_name = "St Catherine", shape_name = "Saint Catherine",
    printed_total = 513533L,
    labels = c("Anglican", "Baptist", "Brethren", "Church of God in Jamaica", "Church of God of Prophecy", "New Testament Church of God", "Other Church of God", "Jehovah's Witness", "Methodist", "Moravian", "Pentecostal", "Rastafarian", "Revivalist", "Roman Catholic", "Seventh-Day Adventist", "United Church", "Islam", "Other", "None", "Not Stated"),
    counts = c(10031L, 32368L, 3067L, 32940L, 27457L, 28707L, 59617L, 9208L, 5723L, 1219L, 63487L, 4564L, 5504L, 9639L, 56758L, 5677L, 371L, 24652L, 120361L, 12183L)
  )
)

# ---- roles (slot assignment is by role, never by string) --------------------
# the 16 denominational lines printed in every parish, in printed order.
mainstream_labels <- c(
  "Anglican", "Baptist", "Brethren", "Church of God in Jamaica",
  "Church of God of Prophecy", "New Testament Church of God", "Other Church of God",
  "Jehovah's Witness", "Methodist", "Moravian", "Pentecostal", "Rastafarian",
  "Revivalist", "Roman Catholic", "Seventh-Day Adventist", "United Church"
)
# the four small non-Christian groups; broken out only where printed (St Andrew all
# four, St James Hinduism, St Catherine Islam), never reconstructed elsewhere.
small_group_labels <- c("Bahai", "Hinduism", "Islam", "Judaism")
# the three printed tail slots each carry three spellings across parishes; the role
# sets below map every spelling to its role.
other_label_variants <- c(
  "Other Religious Affiliation/Denomination", "Other Religion/Denomination", "Other"
)
no_religion_label_variants <- c(
  "No Religious Affiliation/Denomination", "No Religion/Denomination", "None"
)
non_response_label_variants <- c("Not Reported", "Not Stated")
known_labels <- c(mainstream_labels, small_group_labels, other_label_variants,
                  no_religion_label_variants, non_response_label_variants)

# expected printed frame per parish: category count and small-group breakout rows.
expected_categories <- c(
  "JM-01" = 19L, "JM-02" = 23L, "JM-03" = 19L, "JM-04" = 19L, "JM-05" = 19L,
  "JM-06" = 19L, "JM-07" = 19L, "JM-08" = 20L, "JM-09" = 19L, "JM-10" = 19L,
  "JM-11" = 19L, "JM-12" = 19L, "JM-13" = 19L, "JM-14" = 20L
)
expected_breakouts <- list(
  "JM-02" = c("Bahai", "Hinduism", "Islam", "Judaism"),
  "JM-08" = c("Hinduism"),
  "JM-14" = c("Islam")
)

# printed national tail-slot and role totals (Vol 6 Table 5 national block).
national_no_religion <- 571982L
national_non_response <- 61374L
national_other <- 141979L
national_affiliation <- national_total - national_no_religion - national_non_response
# expected small-group residuals absorbed by the parish Other lines (national count
# minus the printed parish breakouts), per the table's own footnote.
expected_residuals <- c(Bahai = 160L, Hinduism = 484L, Islam = 658L, Judaism = 180L)

parish_codes <- vapply(parish_blocks, function(b) b$area_code, character(1))
names(parish_blocks) <- parish_codes

# ---- small helpers ----------------------------------------------------------

require_file <- function(path) {
  if (!file.exists(path)) stop("missing required source: ", path, call. = FALSE)
}
sha256_file <- function(path) unname(tools::sha256sum(path))
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))

# named check-jsonschema invocation (pinned uv cache dirs match sibling builders so the
# repo uv.lock is never touched).
validate_json_schema <- function(schema_path, instance_path) {
  base_uri <- paste0("file://",
    normalizePath(dirname(schema_path), winslash = "/", mustWork = TRUE), "/")
  status <- system2("uvx",
    c("check-jsonschema", "--base-uri", base_uri, "--schemafile", schema_path, instance_path),
    env = c(
      "UV_CACHE_DIR=/tmp/places-of-worship-uv/cache",
      "UV_TOOL_DIR=/tmp/places-of-worship-uv/tools",
      "UV_PYTHON_INSTALL_DIR=/tmp/places-of-worship-uv/python"
    ))
  if (!identical(status, 0L)) stop("schema validation failed for ", instance_path, call. = FALSE)
  invisible(instance_path)
}

# ---- source pin gate (probe sha256 values must match exactly) ---------------

assert_source_pins <- function() {
  for (path in names(probe_sha256)) {
    require_file(path)
    actual <- sha256_file(path)
    if (!identical(actual, unname(probe_sha256[[path]]))) {
      stop("STOP: cached source ", path, " drifted from its probe pin (",
           actual, " != ", probe_sha256[[path]], ")", call. = FALSE)
    }
  }
  invisible(TRUE)
}

# ---- reconciliation gates (Total column, fail-fast on any nonzero deviation) --

# the national block's 23 categories must sum to the printed religion universe.
assert_national_block <- function() {
  if (length(national_labels) != 23L || length(national_counts) != 23L) {
    stop("STOP: national block must carry 23 categories", call. = FALSE)
  }
  if (sum(national_counts) != national_total) {
    stop("STOP: national block sums to ", sum(national_counts), " not ",
         national_total, call. = FALSE)
  }
  invisible(TRUE)
}

# every parish's printed categories must sum to its printed parish total; every label
# must belong to a known role set; each parish carries exactly one Other line, one
# no-religion line, and one non-response line; the printed frame (category count and
# small-group breakouts) must match the recorded expectation.
assert_parish_blocks <- function() {
  for (b in parish_blocks) {
    unknown <- setdiff(b$labels, known_labels)
    if (length(unknown) > 0L) {
      stop("STOP: ", b$census_name, " carries unknown label(s): ",
           paste(unknown, collapse = "; "), call. = FALSE)
    }
    if (anyDuplicated(b$labels)) {
      stop("STOP: ", b$census_name, " carries duplicate labels", call. = FALSE)
    }
    if (sum(b$counts) != b$printed_total) {
      stop("STOP: ", b$census_name, " categories sum to ", sum(b$counts),
           " not the printed ", b$printed_total, ". No count altered; build stopped.",
           call. = FALSE)
    }
    if (length(b$labels) != expected_categories[[b$area_code]]) {
      stop("STOP: ", b$census_name, " prints ", length(b$labels),
           " categories, expected ", expected_categories[[b$area_code]], call. = FALSE)
    }
    for (set_name in list(other_label_variants, no_religion_label_variants,
                          non_response_label_variants)) {
      if (sum(b$labels %in% set_name) != 1L) {
        stop("STOP: ", b$census_name, " must print exactly one line from: ",
             paste(set_name, collapse = " / "), call. = FALSE)
      }
    }
    if (!all(mainstream_labels %in% b$labels)) {
      stop("STOP: ", b$census_name, " is missing a mainstream denominational line",
           call. = FALSE)
    }
    breakouts <- intersect(b$labels, small_group_labels)
    expected <- expected_breakouts[[b$area_code]]
    if (is.null(expected)) expected <- character(0)
    if (!setequal(breakouts, expected)) {
      stop("STOP: ", b$census_name, " small-group breakouts (",
           paste(breakouts, collapse = ", "), ") differ from the printed record (",
           paste(expected, collapse = ", "), ")", call. = FALSE)
    }
  }
  invisible(TRUE)
}

# the 14 parish totals must sum to the national religion universe exactly.
assert_parish_margin <- function() {
  s <- sum(vapply(parish_blocks, function(b) b$printed_total, integer(1)))
  if (s != national_total) {
    stop("STOP: parish totals sum to ", s, " not ", national_total, call. = FALSE)
  }
  invisible(TRUE)
}

# sum a label's counts across all parishes (0 where a parish does not print it).
parish_label_sum <- function(labels_wanted) {
  sum(vapply(parish_blocks, function(b) {
    sum(b$counts[b$labels %in% labels_wanted])
  }, numeric(1)))
}

# the 16 mainstream lines must reconcile parish-to-national exactly; the no-religion
# and non-response roles must reconcile exactly; the small-group residual identity
# must close exactly against the parish Other lines.
assert_category_reconciliation <- function() {
  national <- setNames(national_counts, national_labels)
  for (lab in mainstream_labels) {
    s <- parish_label_sum(lab)
    if (s != national[[lab]]) {
      stop("STOP: ", lab, " parish sum ", s, " != national ", national[[lab]],
           call. = FALSE)
    }
  }
  s_none <- parish_label_sum(no_religion_label_variants)
  if (s_none != national_no_religion) {
    stop("STOP: no-religion role parish sum ", s_none, " != national ",
         national_no_religion, call. = FALSE)
  }
  s_nr <- parish_label_sum(non_response_label_variants)
  if (s_nr != national_non_response) {
    stop("STOP: non-response role parish sum ", s_nr, " != national ",
         national_non_response, call. = FALSE)
  }
  # small-group residual identity: national minus printed breakouts, per group.
  residuals <- vapply(small_group_labels, function(lab) {
    as.integer(national[[lab]] - parish_label_sum(lab))
  }, integer(1))
  if (!identical(residuals, expected_residuals[small_group_labels])) {
    stop("STOP: small-group residuals ", paste(residuals, collapse = ","),
         " differ from the printed record ",
         paste(expected_residuals, collapse = ","), call. = FALSE)
  }
  if (any(residuals < 0L)) stop("STOP: negative small-group residual", call. = FALSE)
  # the parish Other lines must absorb exactly the residual total.
  s_other <- parish_label_sum(other_label_variants)
  if (s_other - national_other != sum(residuals)) {
    stop("STOP: parish Other sum ", s_other, " minus national Other ", national_other,
         " != residual total ", sum(residuals), call. = FALSE)
  }
  invisible(list(residuals = residuals, parish_other_sum = as.integer(s_other)))
}

# ---- boundary ----------------------------------------------------------------
# validate and simplify the 14-feature geoBoundaries JAM ADM1 layer; join by shapeISO
# (JM-01..JM-14) with the shapeName checked against the concordance (boundary "Saint"
# <-> census "St"); return the written layer, geodesic land areas by code, and
# geometry-validation detail (per-feature hashes, never c()-ed sfg lists).
build_boundary <- function() {
  boundary <- st_read(boundary_path, quiet = TRUE, stringsAsFactors = FALSE)
  if (nrow(boundary) != 14L) stop("expected 14 geoBoundaries JAM ADM1 features", call. = FALSE)
  boundary <- st_make_valid(boundary)
  validity <- st_is_valid(boundary)
  if (any(st_is_empty(boundary)) || any(is.na(validity)) || any(!validity)) {
    stop("source boundary contains empty or invalid geometries", call. = FALSE)
  }
  source_hashes <- vapply(st_as_binary(st_geometry(boundary), EWKB = TRUE), digest,
                          character(1), algo = "sha256", serialize = FALSE)
  if (anyDuplicated(source_hashes)) stop("source boundary contains duplicate geometries", call. = FALSE)

  # join: boundary shapeISO -> parish area_code (14/14, one-to-one), with shapeName
  # checked against the concordance.
  boundary_iso <- boundary[["shapeISO"]]
  if (!setequal(boundary_iso, parish_codes) || anyDuplicated(boundary_iso)) {
    stop("boundary shapeISO values do not match the 14 parish codes 1:1", call. = FALSE)
  }
  code_to_shape_name <- setNames(
    vapply(parish_blocks, function(b) b$shape_name, character(1)), parish_codes)
  mismatch <- boundary[["shapeName"]] != unname(code_to_shape_name[boundary_iso])
  if (any(mismatch)) {
    stop("boundary shapeName does not match the concordance for: ",
         paste(boundary[["shapeName"]][mismatch], collapse = "; "), call. = FALSE)
  }
  boundary[["area_code"]] <- boundary_iso
  boundary[["area_name"]] <- boundary[["shapeName"]]
  boundary[["area_unit_id"]] <- paste0(boundary_set_id, ":", boundary[["area_code"]])
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- "parish"
  boundary <- boundary[, c("area_code", "area_name", "area_unit_id", "boundary_set_id",
                           "boundary_level")]
  boundary <- boundary[order(boundary[["area_code"]]), ]

  dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
  # small source layer (447 KB); simplify topology-preserving well under the 3 MB cap.
  simplification <- mapshaper_simplify_to_cap(
    boundary, boundary_output, max_bytes = 3000000L,
    keep_percentages = c(30, 20, 15, 10, 8, 6, 5, 4, 3),
    clean_option = "allow-overlaps"
  )
  written <- st_read(boundary_output, quiet = TRUE, stringsAsFactors = FALSE)
  written <- written[order(written[["area_code"]]), ]
  written_validity <- st_is_valid(written)
  written_hashes <- vapply(st_as_binary(st_geometry(written), EWKB = TRUE), digest,
                           character(1), algo = "sha256", serialize = FALSE)
  if (nrow(written) != 14L || any(st_is_empty(written)) || any(!written_validity) ||
      anyDuplicated(written_hashes) || file.info(boundary_output)[["size"]] > 3000000L) {
    stop("simplified boundary failed feature, validity, distinctness, or byte-cap gate", call. = FALSE)
  }
  land_area <- as.numeric(st_area(written)) / 1e6
  land_area_by_code <- setNames(round(land_area, 4), written[["area_code"]])
  # sanity band: Jamaica is about 10,991 km2; catch a crs or unit mistake.
  if (sum(land_area) < 10000 || sum(land_area) > 12000) {
    stop("total boundary land area is implausible; check the boundary crs", call. = FALSE)
  }
  list(
    written = written,
    land_area_by_code = land_area_by_code,
    total_land_area = round(sum(land_area), 2),
    simplification = simplification,
    source_geometry_sha256 = setNames(as.list(unname(source_hashes)),
                                      boundary[["area_code"]]),
    written_geometry_sha256 = setNames(as.list(unname(written_hashes)),
                                       written[["area_code"]]),
    output_bytes = file_bytes(boundary_output),
    distinct_written_hash_count = length(unique(written_hashes))
  )
}

# ---- run gates ---------------------------------------------------------------

assert_source_pins()
assert_national_block()
assert_parish_blocks()
assert_parish_margin()
residual_result <- assert_category_reconciliation()

boundary_result <- build_boundary()
land_area_by_code <- boundary_result[["land_area_by_code"]]

# ---- small-cell tokens --------------------------------------------------------
# small_denominator_under_100: a parish whose denominator (parish religion-universe
# total) is under 100 (none in Jamaica; the smallest parish is Hanover at 69,398).
# small_cell_under_10: any shipped verbatim category count under 10 in the parish (a
# per-category share a downstream consumer derives would then rest on fewer than ten
# people). the count itself renders exactly; the token marks fragility, per the
# ratified small-cell rule (docs/development/small-cell-rule.md).
small_denominator_codes <- parish_codes[
  vapply(parish_blocks, function(b) b$printed_total < 100L, logical(1))]
small_cell_codes <- parish_codes[
  vapply(parish_blocks, function(b) any(b$counts < 10L), logical(1))]
small_cell_detail <- lapply(small_cell_codes, function(code) {
  b <- parish_blocks[[code]]
  idx <- which(b$counts < 10L)
  list(area_code = code, area_name = b$shape_name,
       cells = setNames(as.list(as.integer(b$counts[idx])), b$labels[idx]))
})

# ---- frame note (conductor ruling: state the heterogeneity plainly) -----------

frame_note <- paste(
  "Vol 6 Table 5 prints a heterogeneous parish frame, and this product ships each",
  "parish's printed rows verbatim. Eleven parishes print 19 categories (the 16",
  "denominational lines printed in every parish, plus one Other line, one no-religion",
  "line, and one non-response line), with the four small non-Christian groups (Bahai,",
  "Hinduism, Islam, Judaism) included in the parish Other line by source design.",
  "Three parishes additionally break out small non-Christian groups as printed:",
  "St Andrew prints all four (Bahai 109, Hinduism 967, Islam 483, Judaism 326; 23",
  "categories), St James prints Hinduism (387; 20 categories), and St Catherine",
  "prints Islam (371; 20 categories). No category is merged, translated, or",
  "reconstructed. The parish Other lines therefore absorb the un-broken-out",
  "small-group residuals by source design (national count minus printed parish",
  "breakouts: Bahai 160, Hinduism 484, Islam 658, Judaism 180; 1,482 in all), and",
  "the sum of the parish Other lines (143,461) exceeds the national Other line",
  "(141,979) by exactly that 1,482. The parish-to-national non-additivity of the",
  "four small groups is a source-design fact stated in the table's own footnote,",
  "not an error."
)

table5_footnote_verbatim <- paste(
  "* This table does not represent the sum of the parish tables for the Bahai,",
  "Hinduism, Islam and Judaism because of small numbers in most parishes. For these",
  "parishes these are included as 'Other'. This also means that the 'Other' in the",
  "Jamaica table does not reflect the sum of the parishes."
)

# ---- construct product rows ----------------------------------------------------

population_basis_note <- paste(
  "2011 de jure religion universe from STATIN Vol 6 Table 5 ('Population by Sex and",
  "Religious Affiliation/Denomination, by Parish'), Total column. The parish",
  "denominator is the sum of all the parish's printed category lines, including the",
  "non-response line ('Not Reported'/'Not Stated'). The religion universe (2,684,115)",
  "sits slightly below the full 2011 de jure census population (2,697,983); the",
  "difference is a residual not carried in the religion tabulation."
)

# per-parish flag tokens for the printed frame and the verbatim slot spellings.
frame_token <- function(code) {
  switch(code,
    "JM-02" = "printed_frame_23_categories_bahai_hinduism_islam_judaism_broken_out",
    "JM-08" = "printed_frame_20_categories_hinduism_broken_out_remaining_small_groups_in_other",
    "JM-14" = "printed_frame_20_categories_islam_broken_out_remaining_small_groups_in_other",
    "printed_frame_19_categories_small_non_christian_groups_in_other"
  )
}
no_religion_token <- c(
  "No Religious Affiliation/Denomination" = "no_religion_slot_printed_line_no_religious_affiliation_denomination",
  "No Religion/Denomination" = "no_religion_slot_printed_line_no_religion_denomination",
  "None" = "no_religion_slot_printed_line_none"
)
non_response_token <- c(
  "Not Reported" = "non_response_printed_line_not_reported_inside_denominator_outside_slots",
  "Not Stated" = "non_response_printed_line_not_stated_inside_denominator_outside_slots"
)

product_rows <- lapply(parish_blocks, function(b) {
  code <- b$area_code
  denom <- as.integer(sum(b$counts))
  none_label <- b$labels[b$labels %in% no_religion_label_variants]
  nr_label <- b$labels[b$labels %in% non_response_label_variants]
  no_religion <- as.integer(sum(b$counts[b$labels == none_label]))
  non_response <- as.integer(sum(b$counts[b$labels == nr_label]))
  affiliation <- denom - no_religion - non_response
  # composition: the parish's printed rows verbatim, printed order, printed spellings.
  composition <- lapply(seq_along(b$labels), function(i) {
    list(label_verbatim = b$labels[[i]], count = as.integer(b$counts[[i]]))
  })
  flags <- c(
    "source_statin_2011_census_vol6_table5_religion_by_parish",
    "universe_2011_religion_universe_de_jure_2684115",
    "heterogeneous_printed_parish_frame_19_to_23_categories_shipped_verbatim",
    frame_token(code),
    "parish_other_absorbs_unbroken_small_group_residuals_by_source_design",
    unname(no_religion_token[[none_label]]),
    unname(non_response_token[[nr_label]]),
    "single_wave_2011",
    "religious_change_withheld",
    "boundary_geoboundaries_jam_adm1_ccbysa20"
  )
  if (code %in% small_denominator_codes) flags <- c(flags, "small_denominator_under_100")
  if (code %in% small_cell_codes) flags <- c(flags, "small_cell_under_10")
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = "parish",
    area_unit_id = paste0(boundary_set_id, ":", code),
    area_code = code,
    area_name = b$shape_name,
    year = wave_year,
    population_total = denom,
    population_total_basis = population_basis_note,
    religious_affiliation_count = affiliation,
    religious_affiliation_percent = round(100 * affiliation / denom, 4),
    no_religion_count = no_religion,
    no_religion_percent = round(100 * no_religion / denom, 4),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = unname(land_area_by_code[[code]]),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(dataset_id_census, dataset_id_boundary),
    quality_flag = paste(flags, collapse = ";"),
    composition = composition
  )
})
names(product_rows) <- NULL

if (length(product_rows) != 14L) stop("expected 14 parish rows", call. = FALSE)

# ---- source datasets, indicators, visual layers --------------------------------

licence_grant_verbatim <- paste(
  "STATIN grants to the Data User a non-exclusive, royalty-free licence to copy, use",
  "and create derivative works from STATIN's Data for commercial and non-commercial",
  "purposes, released through its website, www.statinja.gov.jm , subject to the terms",
  "of this Licence."
)
licence_attribution <- paste(
  "Adapted from data published by the Statistical Institute of Jamaica (STATIN):",
  "2011 Population and Housing Census, Ethnic Origin & Religious Affiliation",
  "(Volume 6), Table 5. Changes were made (parish religion counts restated as counts",
  "and shares on the geoBoundaries parish frame). Original data:",
  "https://census.statinja.gov.jm/census-reports/ . STATIN does not endorse this use."
)

source_datasets <- list(
  list(
    source_dataset_id = dataset_id_census,
    name = "STATIN 2011 Census Vol 6 Table 5: Population by Sex and Religious Affiliation/Denomination, by Parish",
    provider = "Statistical Institute of Jamaica (STATIN)",
    url = url_census_pdf,
    retrieval_date = retrieval_date,
    local_path = census_pdf,
    licence = list(
      name = "STATIN Terms & Conditions of Data Use (open reuse grant with attribution, indication of changes, and a link to the original data)",
      url = url_licence,
      attribution = licence_attribution
    ),
    citation = paste(
      "Statistical Institute of Jamaica, 2011 Population and Housing Census, Ethnic",
      "Origin & Religious Affiliation (Volume 6), Table 5 'Population by Sex and",
      "Religious Affiliation/Denomination, by Parish'."
    ),
    access_limits = "Public direct PDF download from census.statinja.gov.jm.",
    redistribution_limits = paste(
      "Open reuse under the STATIN Terms & Conditions of Data Use with attribution.",
      licence_grant_verbatim
    ),
    notes = paste(
      "Count-valued over a heterogeneous printed parish frame (19 to 23 categories),",
      "integer-exact to 2,684,115 at the Total column at every printed margin. The",
      "product ships the Total column only; the printed Male/Female columns carry",
      "small margin defects documented in the manifest. The 2011 national religion",
      "figures appear in two runs: this table's national block totals 2,684,115,",
      "while Vol 1 Table (xiii) totals 2,683,105 (the 2001-vs-2011 comparison run);",
      "this build takes Vol 6 Table 5 as the single source and does not mix the runs."
    )
  ),
  list(
    source_dataset_id = dataset_id_boundary,
    name = "geoBoundaries Jamaica ADM1 (14 parish units)",
    provider = "geoBoundaries (William & Mary geoLab); source OpenStreetMap, Wambacher",
    url = url_boundary,
    retrieval_date = retrieval_date,
    local_path = boundary_path,
    licence = list(
      name = "Creative Commons Attribution-ShareAlike 2.0 (CC BY-SA 2.0)",
      url = "https://creativecommons.org/licenses/by-sa/2.0/",
      attribution = "geoBoundaries (gbOpen) JAM ADM1; boundary source OpenStreetMap contributors; derived boundary shared under CC BY-SA."
    ),
    citation = paste(
      "Runfola, D. et al. (2020) geoBoundaries: A global database of political",
      "administrative boundaries. gbOpen JAM ADM1 (pinned commit 9469f09)."
    ),
    access_limits = NULL,
    redistribution_limits = "CC BY-SA 2.0 permits redistribution and derivatives with attribution and share-alike.",
    notes = "14 ADM1 units; release metadata: boundaryType ADM1, CC BY-SA 2.0, source OpenStreetMap (Wambacher), admUnitCount 14, represented year 2011."
  )
)

spatial_note <- paste(
  "Fourteen parish units on the geoBoundaries JAM ADM1 layer, joined one-to-one by",
  "shapeISO (JM-01..JM-14); the boundary spells 'Saint' where the census prints 'St'."
)

indicators <- list(
  list(
    indicator_id = "religious_affiliation_percent",
    label = "Religious affiliation (%)",
    description = "Share of the parish's 2011 religion universe affiliated with any religion (every printed line except the parish's no-religion and non-response lines, including the Other line).",
    unit = "percent",
    denominator_indicator_id = "population_total",
    method = paste(
      "Parish denominator minus the parish's printed no-religion and non-response",
      "lines, over the parish's whole religion universe (all printed lines). Counts",
      "carried verbatim from the Total column of Vol 6 Table 5; no category merged,",
      "translated, or reconstructed."
    ),
    temporal_coverage = "2011",
    spatial_coverage = spatial_note,
    quality_notes = frame_note
  ),
  list(
    indicator_id = "no_religion_percent",
    label = "No religion (%)",
    description = "Share of the parish's 2011 religion universe reporting no religious affiliation (the parish's single affirmative no-religion line).",
    unit = "percent",
    denominator_indicator_id = "population_total",
    method = paste(
      "The parish's single printed affirmative no-religion line — spelled 'No",
      "Religious Affiliation/Denomination', 'No Religion/Denomination', or 'None'",
      "depending on the parish — over the parish's whole religion universe. Slot",
      "assignment is by role, not by string; the printed spelling is preserved in",
      "the per-row composition and named in the row's quality flags."
    ),
    temporal_coverage = "2011",
    spatial_coverage = spatial_note,
    quality_notes = "The non-response line ('Not Reported'/'Not Stated') stays inside the denominator and outside both slots. National no-religion 571,982; national non-response 61,374; both reconcile parish-to-national exactly."
  ),
  list(
    indicator_id = "population_total",
    label = "Population (2011 census, religion universe)",
    description = "2011 de jure religion universe, the religion tabulation universe and the share denominator.",
    unit = "count",
    denominator_indicator_id = NULL,
    method = "Sum of the parish's printed category lines (Total column) from Vol 6 Table 5.",
    temporal_coverage = "2011",
    spatial_coverage = spatial_note,
    quality_notes = "Parishes sum to the national 2011 religion universe of 2,684,115 exactly; the religion universe sits slightly below the full census population (2,697,983)."
  )
)

visual_layers <- list(
  list(
    visual_layer_id = "jm-parish-religious-affiliation-share",
    label = "Religious affiliation share",
    description = "Census religious affiliation share by parish, 2011.",
    layer_type = "choropleth",
    indicator_ids = list("religious_affiliation_percent"),
    geometry_unit_type = "area_unit",
    legend = list(unit = "percent", denominator = "whole 2011 religion universe"),
    colour_scale = "sequential",
    time_control = "year_selector",
    aggregation_rule = "published parish value on the geoBoundaries ADM1 layer",
    uncertainty_display = "quality_flag",
    default_visibility = TRUE,
    notes = "Seventh-Day Adventist and Pentecostal are the largest affiliations nationally."
  ),
  list(
    visual_layer_id = "jm-parish-no-religion-share",
    label = "No religion share",
    description = "Census no-religion share by parish, 2011.",
    layer_type = "choropleth",
    indicator_ids = list("no_religion_percent"),
    geometry_unit_type = "area_unit",
    legend = list(unit = "percent", denominator = "whole 2011 religion universe"),
    colour_scale = "sequential",
    time_control = "year_selector",
    aggregation_rule = "published parish value on the geoBoundaries ADM1 layer",
    uncertainty_display = "quality_flag",
    default_visibility = FALSE,
    notes = "Single wave; no cross-wave change layer (2001 religion is national-only in the located sources; the 2022 census has no religion release yet)."
  )
)

area_summary <- list(
  schema_version = "area-summary.v2",
  generated_at = stamp,
  generated_by = script_id,
  country_code = country_code,
  data_status = "census_religion_live",
  data_status_note = paste(
    "Census religious affiliation is live for the 14 parishes in 2011 from STATIN Vol 6",
    "Table 5 (Total column), integer-exact to the 2,684,115 religion universe at every",
    "printed margin. Single wave: 2001 religion is national-only in the located sources",
    "and the 2022 census has no religion release yet, so no cross-wave parish change is",
    "possible.", frame_note
  ),
  boundary_set = list(
    boundary_set_id = boundary_set_id,
    country_code = country_code,
    level = "parish",
    vintage = "geoBoundaries JAM ADM1 (gbOpen); 14 units, OpenStreetMap-sourced, represented year 2011",
    source_dataset_id = dataset_id_boundary
  ),
  site_snapshot = list(
    source_dataset_id = NULL,
    snapshot_date = NULL,
    basis = "no governed Jamaica place-of-worship snapshot is included in this census-religion release",
    notes = "The Jamaica lane ships census-religion count and share metrics only; place metrics are null."
  ),
  source_datasets = source_datasets,
  indicators = indicators,
  visual_layers = visual_layers,
  rows = product_rows
)

dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)
write_json(area_summary, summary_output, auto_unbox = TRUE, pretty = TRUE, null = "null", digits = NA)

# flat CSV companion (no composition; slot counts and shares only)
csv_df <- do.call(rbind, lapply(product_rows, function(r) {
  data.frame(
    country_code = r$country_code, boundary_set_id = r$boundary_set_id,
    boundary_level = r$boundary_level, area_unit_id = r$area_unit_id,
    area_code = r$area_code, area_name = r$area_name, year = r$year,
    population_total = r$population_total, population_total_basis = r$population_total_basis,
    religious_affiliation_count = r$religious_affiliation_count,
    religious_affiliation_percent = r$religious_affiliation_percent,
    no_religion_count = r$no_religion_count, no_religion_percent = r$no_religion_percent,
    place_count = NA_integer_, places_per_10000_residents = NA_real_,
    place_density_per_sq_km = NA_real_, land_area_sq_km = r$land_area_sq_km,
    site_snapshot_date = NA_character_, place_count_basis = NA_character_,
    source_dataset_ids = paste(unlist(r$source_dataset_ids), collapse = "|"),
    quality_flag = r$quality_flag, stringsAsFactors = FALSE
  )
}))
utils::write.csv(csv_df, summary_csv_output, row.names = FALSE, na = "")

if (!jsonlite::validate(readChar(summary_output, file_bytes(summary_output), useBytes = TRUE))) {
  stop("area-summary output failed JSON syntax validation", call. = FALSE)
}
validate_json_schema("schemas/area-summary.v2.schema.json", summary_output)

# ---- manifest -------------------------------------------------------------------

raw_source_record <- function(path, url, content) {
  list(local_path = path, url = url, content = content, retrieval_date = retrieval_date,
       bytes = file_bytes(path), sha256 = sha256_file(path))
}
raw_sources <- list(
  raw_source_record(census_pdf, url_census_pdf,
    "STATIN 2011 census Ethnic Origin & Religious Affiliation (Vol 6) PDF; Table 5 'Population by Sex and Religious Affiliation/Denomination, by Parish' (heterogeneous 19-23-category parish frame, Total column integer-exact to 2,684,115)"),
  raw_source_record(vol1_pdf, url_vol1_pdf,
    "STATIN 2011 census General Report (Vol 1) PDF; Table (xiii) national religion, 2001 and 2011 columns (comparison run totalling 2,683,105; not mixed into the parish product)"),
  raw_source_record(licence_html, url_licence,
    "STATIN Terms & Conditions of Data Use (open reuse grant with attribution, verbatim)"),
  raw_source_record(boundary_path, url_boundary,
    "geoBoundaries JAM ADM1 source GeoJSON (14 parish units)"),
  raw_source_record(boundary_meta_path, url_boundary_meta,
    "geoBoundaries JAM ADM1 release metadata (CC BY-SA 2.0, OpenStreetMap/Wambacher source, represented year 2011)")
)

output_paths <- c(summary_output, summary_csv_output, boundary_output)
output_hashes <- vapply(output_paths, sha256_file, character(1))
raw_hashes <- vapply(raw_sources, `[[`, character(1), "sha256")
combined <- paste(c(raw_hashes, output_hashes), collapse = "")
version_hash <- substr(digest(combined, algo = "sha256", serialize = FALSE), 1L, 12L)
git_commit <- tryCatch({
  value <- trimws(system2("git", c("rev-parse", "--short", "HEAD"), stdout = TRUE, stderr = TRUE))
  if (length(value) == 1L && grepl("^[a-f0-9]{7,40}$", value)) value else NULL
}, error = function(e) NULL)

durable_file_record <- function(path, content, licence_basis, licence_status,
                                row_count = NULL, feature_count = NULL) {
  record <- list(
    uri = paste0("repo:", path), storage_provider = "git_repository",
    format = sub("^.*\\.", "", path), bytes = file_bytes(path), sha256 = sha256_file(path),
    content = content, privacy = "public", licence_status = licence_status, licence_basis = licence_basis)
  if (!is.null(row_count)) record[["row_count"]] <- as.integer(row_count)
  if (!is.null(feature_count)) record[["feature_count"]] <- as.integer(feature_count)
  record
}

# role-to-label mapping per parish (conductor ruling: nothing silent). each parish's
# printed spellings for the three tail slots, its printed category count, and its
# printed small-group breakout rows.
role_to_label_by_parish <- lapply(parish_blocks, function(b) {
  breakouts <- intersect(b$labels, small_group_labels)
  list(
    area_code = b$area_code,
    census_name = b$census_name,
    shape_name = b$shape_name,
    printed_categories = length(b$labels),
    no_religion_label = b$labels[b$labels %in% no_religion_label_variants],
    non_response_label = b$labels[b$labels %in% non_response_label_variants],
    other_label = b$labels[b$labels %in% other_label_variants],
    small_group_breakout_labels = as.list(breakouts),
    parish_total = b$printed_total
  )
})
names(role_to_label_by_parish) <- NULL

# per-category national frame for the manifest (verbatim label, role, national count).
frame_manifest <- lapply(seq_along(national_labels), function(i) {
  lab <- national_labels[[i]]
  role <- if (lab %in% no_religion_label_variants) "no_religion" else
          if (lab %in% non_response_label_variants) "non_response" else
          if (lab %in% other_label_variants) "residual_affiliation" else
          if (lab %in% small_group_labels) "small_group_affiliation_parish_collapsed_except_where_printed" else
          "affiliation"
  list(label_verbatim = lab, role = role, national_count = national_counts[[i]])
})

small_group_non_additivity <- lapply(small_group_labels, function(lab) {
  national <- national_counts[[which(national_labels == lab)]]
  breakout_sum <- as.integer(parish_label_sum(lab))
  list(label_verbatim = lab, national_count = national,
       printed_parish_breakout_sum = breakout_sum,
       residual_in_parish_other = national - breakout_sum)
})

small_cell_manifest <- list(
  rule = "docs/development/small-cell-rule.md",
  small_denominator_under_100 = list(
    threshold = 100L,
    basis = "parish religion-universe total (the metric denominator)",
    row_count = length(small_denominator_codes),
    rows = as.list(small_denominator_codes),
    note = "No Jamaica parish falls under 100; the smallest parish is Hanover (69,398)."
  ),
  small_cell_under_10 = list(
    threshold = 10L,
    basis = "any shipped verbatim category count under 10 in the parish (a downstream per-category share would rest on fewer than ten people; the count renders exactly)",
    row_count = length(small_cell_codes),
    rows = small_cell_detail,
    note = if (length(small_cell_codes) == 0L) {
      "No parish carries a printed category count under 10; the smallest shipped cell is Trelawny's Moravian line (31). The source's own guard is coarser: it collapses the four small non-Christian groups into the parish Other line wherever their numbers are small."
    } else {
      "Counts render exactly; none suppressed."
    }
  )
)

# printed Male/Female column observations (documented source facts; the product ships
# the Total column only). verified against the PDF pages in the build lane.
sex_column_observations <- list(
  shipped = "Total column only; no sex split is shipped.",
  observations = list(
    "St Mary's Moravian row prints Total 49 = Male 25 + Female 25 (a printed one-off in the sex split; the Total column is consistent).",
    "In eight blocks (All Jamaica, Kingston, St Mary, Trelawny, Hanover, Westmoreland, Manchester, St Catherine) the printed sex columns sum across categories to within 1-2 of the printed block sex headers, but not exactly.",
    "The 14 parish Male headers sum to 1,332,794 against the printed national Male header 1,324,690 (+8,104; the Female mirror is -8,104), while every block's Total column is integer-exact. The national sex split appears to come from a different tabulation run than the parish sex splits.",
    "None of these defects touches the Total column, which reconciles integer-exact at every printed margin and is the sole basis of this product."
  )
)

manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = paste0("manifest:jm-census-religion:jm:2011:", version_hash),
  dataset_id = "jm-census-religion:jm:2011:vol6-table5-geoboundaries",
  dataset_version_id = paste0("jm-census-religion:jm:2011:vol6-table5-geoboundaries:", version_hash),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "jm-census-religion",
  dataset_role = "public_product",
  scope = list(level = "country", country_codes = list("JM"), snapshot_date = NULL, pipeline_stage = "staged"),
  created_at = stamp,
  created_by = script_id,
  target_years = list(2011L),
  pipeline = list(
    script = script_id,
    git_commit = git_commit,
    command = paste("Rscript", script_id),
    parameters = list(
      wave = list(
        year = 2011L,
        construct = "census religion (Population by Sex and Religious Affiliation/Denomination, by Parish, Vol 6 Table 5), counts by parish, heterogeneous 19-23-category printed frame, Total column",
        geography = "14 parishes (ADM1)",
        universe = "2011 de jure religion universe (national total 2,684,115; slightly below the full census population of 2,697,983)",
        denominator = "whole parish religion universe (all printed category lines, including the 'Not Reported'/'Not Stated' non-response line)",
        source = "STATIN 2011 Population and Housing Census, Ethnic Origin & Religious Affiliation (Volume 6), Table 5",
        gate = paste(
          "Conductor-ruled gate (2026-07-12): the national block's 23 categories sum to",
          "2,684,115; every parish's PRINTED categories sum to its printed parish total;",
          "the 14 parish totals sum to 2,684,115 at the Total column; the 16 denominational",
          "lines printed in every parish reconcile parish-to-national exactly; the",
          "no-religion and non-response roles reconcile to 571,982 and 61,374 exactly; and",
          "the small-group residual identity closes exactly (1,482). Integer-exact."
        )
      ),
      frame = list(
        ruling = "Conductor, 2026-07-12, on the build-lane STOP: Option A — ship the heterogeneous frame exactly as printed (St Andrew 23 rows, St James and St Catherine 20, the other eleven parishes 19); zero merges, zero reconstruction; per-row verbatim labels with slot assignment by role. The probe's uniform-19-category claim was over-generalised; a dated correction is appended to research/countries/jm/route-probe.md.",
        note = frame_note,
        table5_footnote_verbatim = table5_footnote_verbatim,
        breakout_parishes = list(
          list(area_code = "JM-02", census_name = "St Andrew",
               breakouts = list("Bahai", "Hinduism", "Islam", "Judaism"), printed_categories = 23L),
          list(area_code = "JM-08", census_name = "St James",
               breakouts = list("Hinduism"), printed_categories = 20L),
          list(area_code = "JM-14", census_name = "St Catherine",
               breakouts = list("Islam"), printed_categories = 20L)
        ),
        never_reconstruct = "The four small non-Christian groups are never reconstructed by parish; they ship only where the source prints them."
      ),
      slot_design = list(
        no_religion_slot = "Each parish's single printed affirmative no-religion line, whatever its spelling — 'No Religious Affiliation/Denomination' (8 parishes), 'No Religion/Denomination' (St Andrew, St Thomas, Trelawny), or 'None' (Manchester, Clarendon, St Catherine). National 571,982; reconciles parish-to-national exactly. Slot assignment is by role, not by string; every printed spelling stays verbatim in the per-row composition.",
        no_religion_basis = "Vol 6 Table 5 prints exactly one affirmative no-religion line per parish (the national block prints it as 'No Religion/Denomination', 571,982), distinct from the 'Not Reported'/'Not Stated' non-response line (national 61,374). The former is the no_religion slot; the latter is non-response.",
        religious_affiliation_slot = "Every other printed line: the 16 denominational lines printed in every parish, the printed small-group breakout rows, and the parish Other line (national 2,050,759).",
        non_response = "'Not Reported' (9 parishes) / 'Not Stated' (Westmoreland, St Elizabeth, Manchester, Clarendon, St Catherine): inside the denominator, outside both slots (national 61,374).",
        role_to_label_by_parish = role_to_label_by_parish,
        national_totals = list(
          affiliation = national_affiliation,
          no_religion = national_no_religion,
          not_reported_non_response = national_non_response,
          total = national_total
        )
      ),
      category_frame = list(
        national_category_count = length(national_labels),
        parish_category_counts = "19 categories in eleven parishes; 20 in St James and St Catherine; 23 in St Andrew (heterogeneous by source design; shipped verbatim)",
        preservation = "Every parish's printed rows ship verbatim in printed order with the parish's own printed spellings; the three tail slots each carry three spellings across parishes ('Other Religious Affiliation/Denomination' / 'Other Religion/Denomination' / 'Other'; 'No Religious Affiliation/Denomination' / 'No Religion/Denomination' / 'None'; 'Not Reported' / 'Not Stated'). No category merged or translated.",
        national_table = frame_manifest
      ),
      reconciliation = list(
        national_total = national_total,
        national_block_status = "The national block's 23 categories sum to 2,684,115 exactly.",
        parish_block_status = "Every parish's printed categories sum to its printed parish total exactly (Total column).",
        parish_margin_status = "The 14 parish totals sum to 2,684,115 exactly.",
        mainstream_status = "All 16 denominational lines printed in every parish reconcile parish-to-national exactly.",
        role_status = "The no-religion role sums to 571,982 and the non-response role to 61,374 across parishes, each equal to its national line exactly.",
        small_group_non_additivity = list(
          status = "Source-design fact per the table's own footnote, never an error: the four small non-Christian groups are non-additive parish-to-national because the source collapses them into the parish Other line wherever their numbers are small.",
          footnote_verbatim = table5_footnote_verbatim,
          table = small_group_non_additivity,
          residual_total = sum(expected_residuals),
          parish_other_sum = residual_result[["parish_other_sum"]],
          national_other = national_other,
          identity = "parish Other sum (143,461) - national Other (141,979) = 1,482 = sum of the small-group residuals (160 + 484 + 658 + 180); gated integer-exact."
        ),
        parish_totals = setNames(
          lapply(parish_blocks, function(b) b$printed_total), parish_codes),
        sex_columns = sex_column_observations,
        national_figure_note = "The 2011 national religion figures appear in two runs: Vol 6 Table 5's national block totals 2,684,115 (this product's single source), while Vol 1 Table (xiii) totals 2,683,105 (the 2001-vs-2011 comparison run). The build does not mix the runs.",
        status = "Integer-exact at every Total-column margin; no count allocated, inferred, imputed, or tuned."
      ),
      small_cell = small_cell_manifest,
      change_metric = list(
        status = "withheld",
        rationale = "Parish religion is available for 2011 only (2001 religion is national-only in the located sources; the 2022 census has no religion release yet). No cross-wave parish change is possible."
      ),
      boundary = list(
        boundary_set_id = boundary_set_id,
        source = "geoBoundaries JAM ADM1 (gbOpen), CC BY-SA 2.0, source OpenStreetMap (Wambacher), represented year 2011",
        features = 14L,
        total_land_area_sq_km = boundary_result[["total_land_area"]],
        output_bytes = boundary_result[["output_bytes"]],
        distinct_written_geometry_hashes = boundary_result[["distinct_written_hash_count"]],
        join = "area_code via boundary shapeISO (JM-01..JM-14, 14/14, one-to-one), with shapeName checked against the concordance; the boundary spells 'Saint' where the census prints 'St' (e.g. census 'St Andrew' <-> boundary 'Saint Andrew')",
        simplification = c(boundary_result[["simplification"]],
                           list(byte_ceiling = 3000000L, helper = "scripts/lib/simplify_boundary.R")),
        source_geometry_sha256 = boundary_result[["source_geometry_sha256"]],
        written_geometry_sha256 = boundary_result[["written_geometry_sha256"]]
      ),
      licence_position = list(
        status = "accepted",
        basis = "statin_terms_and_conditions_of_data_use",
        grant_verbatim = licence_grant_verbatim,
        attribution_clause_verbatim = paste(
          "The Data User agrees to offer clear attribution to STATIN for all uses and",
          "derivations of STATIN's Data in any reasonable manner, but not in any way that",
          "suggests that STATIN endorses you or your use. The Data User also agrees to",
          "clearly indicate if changes were made to the data received from STATIN.",
          "Additionally, for data freely accessible on STATIN's website, data users are",
          "required to provide a link to the original data produced by STATIN."
        ),
        boundary_licence = "geoBoundaries JAM ADM1: CC BY-SA 2.0 (OpenStreetMap contributors; derived boundary ships share-alike)",
        attribution = licence_attribution,
        summary = "The STATIN Terms & Conditions of Data Use grant open reuse (commercial and non-commercial, derivative works) with attribution, an indication of changes, and a link to the original data; the derived parish summary sits inside the grant and carries all three. No reuse ask is needed. Boundary CC BY-SA 2.0."
      ),
      raw_sources = raw_sources,
      local_cache_hint = "data/raw/jm_census/ (git-ignored; every cached source listed with URL, bytes, and SHA-256, pinned in research/countries/jm/route-probe.md and asserted by the build).",
      raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/jm_census/")
    ),
    software_versions = list(
      R = paste(R.version$major, R.version$minor, sep = "."),
      sf = as.character(utils::packageVersion("sf")),
      jsonlite = as.character(utils::packageVersion("jsonlite")),
      digest = as.character(utils::packageVersion("digest"))
    )
  ),
  source = list(
    provider = "Statistical Institute of Jamaica (STATIN); geoBoundaries (William & Mary geoLab)",
    source_dataset_ids = list(dataset_id_census, dataset_id_boundary),
    source_urls = list(url_census_pdf, url_vol1_pdf, url_licence, url_boundary, url_boundary_meta),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = "Census: STATIN Terms & Conditions of Data Use (open reuse grant with attribution), accepted. Boundary: CC BY-SA 2.0.",
    raw_redistribution = "The census PDFs are public direct downloads from census.statinja.gov.jm; the boundary is an open web source; intended durable mirror gs://pow-research-data/raw_sources/jm_census/.",
    citation = "STATIN 2011 Population and Housing Census, Ethnic Origin & Religious Affiliation (Volume 6), Table 5 (religion by parish); geoBoundaries JAM ADM1 (CC BY-SA 2.0).",
    local_cache_hint = "data/raw/jm_census/ (git-ignored).",
    raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/jm_census/")
  ),
  input_manifests = list(),
  deferred_sources = list(
    list(layer = "2001 wave", status = "documented non-route",
         note = "2001 religion survives nationally as the 2001 column of Vol 1 Table (xiii); no 2001 religion-by-parish volume was located on the main site or the reports subdomain. A 2001 parish wave would need the 2001 census thematic reports."),
    list(layer = "2022 wave", status = "awaited",
         note = "The 2022 census publishes 6 early-release tables (population/dwelling counts, intercensal movement) and no religion product yet. Extend when STATIN releases 2022 religion.")
  ),
  durable_files = list(
    durable_file_record(summary_output, "Jamaica single-wave parish census-religion area-summary JSON (v2, per-parish verbatim composition over the heterogeneous 19-23-category printed frame)",
                        "statin_terms_and_conditions_of_data_use", "accepted", row_count = 14L),
    durable_file_record(summary_csv_output, "Jamaica single-wave parish census-religion area-summary CSV",
                        "statin_terms_and_conditions_of_data_use", "accepted", row_count = 14L),
    durable_file_record(boundary_output, "Jamaica parish boundary (geoBoundaries JAM ADM1, 14 units)",
                        "cc_by_sa_2_0", "accepted", feature_count = 14L)
  ),
  partitions = list(
    list(partition_id = "jm-parish-2011", partition_type = "area",
         file_uri = paste0("repo:", summary_output), sha256 = sha256_file(summary_output),
         country_code = "JM", row_count = 14L, stage = "staged")
  ),
  stats = list(
    waves = 1L, years = "2011", parish_rows = 14L, parishes_per_wave = 14L,
    national_categories = length(national_labels),
    parish_categories = "19-23 (heterogeneous printed frame)",
    boundary_features = 14L, national_total = national_total,
    national_affiliation = national_affiliation,
    national_no_religion = national_no_religion,
    national_not_reported = national_non_response,
    small_group_residual_in_parish_other = sum(expected_residuals),
    small_denominator_under_100_rows = length(small_denominator_codes),
    small_cell_under_10_rows = length(small_cell_codes)
  ),
  local_cache_hint = "data/raw/jm_census/ (git-ignored; every cached source listed with URL, bytes, and SHA-256).",
  validation = list(
    status = "passed",
    commands = list(
      paste("Rscript", script_id),
      paste("uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile",
            "schemas/area-summary.v2.schema.json", summary_output),
      paste("uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile",
            "schemas/data-manifest.schema.json", manifest_output),
      "bash scripts/validate_area_summaries.sh",
      "bash scripts/validate_manifests.sh"
    ),
    warnings = list(
      "Heterogeneous printed parish frame shipped verbatim (conductor ruling 2026-07-12): 19 categories in eleven parishes, 20 in St James and St Catherine, 23 in St Andrew; the probe's uniform-19-category claim was over-generalised and is corrected in the probe.",
      "The four small non-Christian groups are non-additive parish-to-national by source design (1,482 absorbed in the parish Other lines); never reconstructed by parish.",
      "The printed Male/Female columns carry small margin defects (documented under reconciliation.sex_columns); the product ships the Total column only.",
      "Single wave (2011), parish level; no cross-wave change (2001 religion national-only; 2022 not yet released).",
      "The three tail slots carry three printed spellings each across parishes; slot assignment is by role and every spelling ships verbatim in composition."
    ),
    notes = paste(
      "Vol 6 Table 5 reconciles integer-exact at every Total-column margin: the national",
      "block's 23 categories sum to 2,684,115; every parish's printed categories sum to",
      "its printed parish total; the 14 parish totals sum to 2,684,115; the 16",
      "denominational lines printed in every parish reconcile parish-to-national exactly;",
      "the no-religion (571,982) and non-response (61,374) roles reconcile exactly; and",
      "the small-group residual identity closes exactly (1,482). Boundary output has 14",
      "valid, non-empty, distinctly hashed geometries within the 3 MB cap, joined 14/14 by",
      "shapeISO. Area-summary (v2) and manifest pass schema validation."
    )
  ),
  privacy = "public",
  licence_status = "accepted",
  licence_basis = "statin_terms_and_conditions_of_data_use",
  downstream_status = "staged",
  notes = paste(
    "Single-wave (2011) 14-parish census-religion product; Total-column counts over the",
    "heterogeneous printed parish frame (19-23 categories) with per-parish verbatim",
    "composition, transcribed from STATIN Vol 6 Table 5 and reconciled to 2,684,115",
    "exactly at every Total-column margin. Frame shipped exactly as printed per the",
    "conductor ruling of 2026-07-12 (verbatim-over-uniform); the four small non-Christian",
    "groups are non-additive parish-to-national by source design. Ships STAGED (no page,",
    "no hub link). Census reuse accepted under the STATIN Terms & Conditions of Data Use;",
    "boundary CC BY-SA 2.0."
  )
)

write_json(manifest, manifest_output, auto_unbox = TRUE, pretty = TRUE, null = "null", digits = NA)

if (!jsonlite::validate(readChar(manifest_output, file_bytes(manifest_output), useBytes = TRUE))) {
  stop("manifest output is not valid JSON", call. = FALSE)
}
validate_json_schema("schemas/data-manifest.schema.json", manifest_output)

message(
  "built Jamaica parish census-religion product: ", length(product_rows),
  " parish rows for 2011; boundary ", boundary_result[["output_bytes"]],
  " bytes, ", boundary_result[["total_land_area"]], " km2; national reconciliation exact",
  " (total ", national_total, "; affiliation ", national_affiliation, ", no-religion ",
  national_no_religion, ", not-reported ", national_non_response,
  "; small-group residual in parish Other ", sum(expected_residuals),
  "); small_cell_under_10 rows ", length(small_cell_codes), "; accepted."
)
