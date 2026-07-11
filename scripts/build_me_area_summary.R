# build the Montenegro municipality census-religion product.
# inputs: MONSTAT 2003 Book 3 PDF, 2011 table O19 (xls), 2023 census release II (xlsx),
#         and geoBoundaries Montenegro ADM1 dissolved to the 21 pre-2013 municipalities.
# outputs: area-summary JSON/CSV, a simplified boundary, and a data-manifest.v2.
# run from the repository root: Rscript scripts/build_me_area_summary.R
# design: three waves (2003, 2011, 2023) on one stable 21-municipality frame. The 2023
#         census reports 25 municipalities; the four post-2011 units are summed back into
#         their historical parents (Petnjica->Berane, Gusinje->Plav, Tuzi+Zeta->Podgorica)
#         as complete-unit partitions. Population totals reconcile exactly for every wave.
#         Category counts reconcile exactly for 2003 and 2011; the 2023 municipal table
#         applies MONSTAT confidentiality suppression ("z") to small cells, so 2023
#         category counts are published-cell lower bounds, disclosed and flagged, never tuned.

suppressMessages({
  library(digest)
  library(jsonlite)
  library(readxl)
  library(sf)
})
source("scripts/lib/simplify_boundary.R")

raw_dir <- "data/raw/me_census"
output_dir <- "apps/regions/me/data"
manifest_dir <- "docs/manifests"
dir.create(raw_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

country_code <- "ME"
years <- c(2003L, 2011L, 2023L)
script_id <- "scripts/build_me_area_summary.R"
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- format(Sys.Date(), "%Y-%m-%d")
git_commit <- tryCatch(system("git rev-parse --short HEAD", intern = TRUE), error = function(e) NA_character_)
if (length(git_commit) == 0L || is.na(git_commit[[1]])) git_commit <- NULL

boundary_level <- "municipality"
boundary_vintage <- "2011"
boundary_set_id <- "me-municipality-2003-2011-frame-geoboundaries-adm1-dissolved"
census_dataset_id <- "monstat-census-religion-municipality-2003-2023"
boundary_dataset_id <- "geoboundaries-mne-adm1-dissolved-21"

# source URLs (verified 2026-07-11; see research/countries/me/route-probe.md)
url_2003 <- "http://www.monstat.org/userfiles/file/popis03/Popis03.zip"
url_2011 <- "https://www.monstat.org/userfiles/file/popis2011/PODACI%20OPSTINE/nove/tabela%20O19.xls"
url_2023 <- "https://www.monstat.org/uploads/files/popis%202021/saopstenja/TABELA_Popis%20stanovnistva%202023%20II_ENG.xlsx"
url_terms <- "https://www.monstat.org/eng/"
url_boundary_meta <- "https://www.geoboundaries.org/api/current/gbOpen/MNE/ADM1/"
url_boundary <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/MNE/ADM1/geoBoundaries-MNE-ADM1.geojson"

path_2003_zip <- file.path(raw_dir, "me_2003_book3_religion.zip")
path_2003_pdf <- file.path(raw_dir, "knjiga3SVE.pdf")
path_2003_txt <- file.path(raw_dir, "knjiga3SVE.txt")
path_2011 <- file.path(raw_dir, "me_2011_O19_religion_by_municipality.xls")
path_2023 <- file.path(raw_dir, "me_2023_II_ethnicity_religion_language_ENG.xlsx")
path_terms <- file.path(raw_dir, "monstat_home_eng.html")
path_boundary_meta <- file.path(raw_dir, "geoboundaries_mne_adm1_metadata.json")
path_boundary <- file.path(raw_dir, "geoboundaries_mne_adm1.geojson")

summary_json_out <- file.path(output_dir, "area_summary_municipality.json")
summary_csv_out <- file.path(output_dir, "area_summary_municipality.csv")
boundary_out <- file.path(output_dir, "me_municipality_2003_2011_frame.geojson")
manifest_out <- file.path(manifest_dir, "me-census-religion-2003-2023.json")

# licence position captured byte-for-byte from the MONSTAT English site footer (2026-07-11).
monstat_copyright_verbatim <- "Copyrights © 2025 All Rights Reserved by MONSTAT."
scope_note <- paste(
  "This product follows the territorial coverage published by the Statistical Office of Montenegro (MONSTAT).",
  "The stable frame is the 21-municipality administrative division in force for the 2003 and 2011 censuses.",
  "The 2023 census reports 25 municipalities; the four units created after 2011 are summed back into their historical parents as complete partitions:",
  "Petnjica into Berane (created 2013), Gusinje into Plav (2014), and Tuzi (2018) and Zeta (2024) into Podgorica.",
  "In 2003 Montenegro was a constituent republic of the State Union of Serbia and Montenegro; the source reports it as Republika Crna Gora."
)
suppression_note <- paste(
  "The 2023 MONSTAT municipal religion table applies statistical-confidentiality suppression, marked \"z\", to small category cells;",
  "18 of the 25 published municipalities carry at least one suppressed religion cell.",
  "Municipality population totals are published in full and reconcile exactly to the national total for every wave.",
  "For 2023 the religious-affiliation and no-religion counts are computed from the published (unsuppressed) category cells and are therefore lower bounds where suppression applies;",
  "the suppressed mass per municipality is recorded and never redistributed or estimated."
)
boundary_note <- paste(
  "Display geometry is the geoBoundaries Montenegro ADM1 layer (23 features, boundary ID MNE-ADM1-59799669, represented year 2017),",
  "dissolved to 21 features by merging Petnjica into Berane and Gusinje into Plav; Tuzi and Zeta are already inside the Podgorica feature at that vintage.",
  "The dissolve reproduces the external and internal boundaries of the 21-municipality 2003-2011 division.",
  "Geometric stability of every boundary segment across the census waves was not independently verified."
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

# read retrieval metadata for a cached source.
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
  status <- system2("curl", c("-L", "--fail", "--silent", "--show-error", "-o", shQuote(path), shQuote(url)))
  if (!identical(status, 0L) || !file.exists(path) || file_bytes(path) == 0L) {
    stop("curl failed for ", url, call. = FALSE)
  }
  write_meta(path, url)
  invisible(path)
}

# 21 stable municipality codes (ASCII slugs) and their English display names.
muni_codes <- c(
  "andrijevica", "bar", "berane", "bijelo_polje", "budva", "cetinje", "danilovgrad",
  "herceg_novi", "kolasin", "kotor", "mojkovac", "niksic", "plav", "pljevlja",
  "pluzine", "podgorica", "rozaje", "savnik", "tivat", "ulcinj", "zabljak"
)
muni_display <- c(
  andrijevica = "Andrijevica", bar = "Bar", berane = "Berane", bijelo_polje = "Bijelo Polje",
  budva = "Budva", cetinje = "Cetinje", danilovgrad = "Danilovgrad", herceg_novi = "Herceg Novi",
  kolasin = "Kolašin", kotor = "Kotor", mojkovac = "Mojkovac", niksic = "Nikšić",
  plav = "Plav", pljevlja = "Pljevlja", pluzine = "Plužine", podgorica = "Podgorica",
  rozaje = "Rožaje", savnik = "Šavnik", tivat = "Tivat", ulcinj = "Ulcinj", zabljak = "Žabljak"
)

# --- wave category frames (source labels are the record; English are display) ---

category_2003 <- data.frame(
  source_code = c("total", "islamska", "judaisticka", "katolicka", "pravoslavna", "protestantska",
                  "proorijentalni", "druge", "neizjasnjen", "nije_vjernik", "nepoznato"),
  source_name = c("Укупно", "Исламска", "Јудаистичка", "Католичка", "Православна", "Протестантска",
                  "Прооријенталних култова", "Друге вјероисповијести", "Неизјашњен", "Није вјерник", "Непознато"),
  display_en = c("Total", "Islamic", "Judaic", "Catholic", "Orthodox", "Protestant",
                 "Pro-oriental cults", "Other religions", "Undeclared", "Not a believer", "Unknown"),
  role = c("total", "named_religion", "named_religion", "named_religion", "named_religion", "named_religion",
           "named_religion", "named_religion", "not_declared", "no_religion", "unknown"),
  stringsAsFactors = FALSE
)

category_2011 <- data.frame(
  source_code = c("total", "pravoslavna", "katolicka", "islamska", "adventist", "agnostik", "ateista",
                  "budisti", "hriscani", "jehovini", "protestant", "ostale", "ne_zeli"),
  source_name = c("Ukupno/ Total", "Pravoslavna/ Orthodox", "Katolička/ Catholics", "Islamska/ Islam",
                  "Adventist/ Adventist", "Agnostik/ Agnostic", "Ateista/ Atheist", "Budisti/ Buddhist",
                  "Hrišćani/ Christians", "Jehovini svjedoci / Jehovah witness", "Protestant/ Protestants",
                  "Ostale vjeroispovijesti/ Other religions", "Ne želi da se izjasni/ Does not want to declare"),
  display_en = c("Total", "Orthodox", "Catholics", "Islam", "Adventist", "Agnostic", "Atheist",
                 "Buddhist", "Christians", "Jehovah witness", "Protestants", "Other religions", "Does not want to declare"),
  role = c("total", "named_religion", "named_religion", "named_religion", "named_religion", "no_religion",
           "no_religion", "named_religion", "named_religion", "named_religion", "named_religion",
           "named_religion", "not_declared"),
  stringsAsFactors = FALSE
)

category_2023 <- data.frame(
  source_code = c("total", "ortodox", "catholics", "protestant", "jehovah", "other_christian", "islam",
                  "buddhist", "other_religion", "atheist", "agnostic", "does_not_declare", "other"),
  source_name = c("Total", "Ortodox", "Catholics", "Protestant", "Jehovah witness", "Other christian", "Islam",
                  "Buddhist", "Other religion", "Atheist", "Agnostic", "Does not want to declare", "Other"),
  display_en = c("Total", "Orthodox", "Catholics", "Protestant", "Jehovah witness", "Other Christian", "Islam",
                 "Buddhist", "Other religion", "Atheist", "Agnostic", "Does not want to declare", "Other"),
  role = c("total", "named_religion", "named_religion", "named_religion", "named_religion", "named_religion",
           "named_religion", "named_religion", "named_religion", "no_religion", "no_religion", "not_declared", "other"),
  stringsAsFactors = FALSE
)

wave_categories <- list(`2003` = category_2003, `2011` = category_2011, `2023` = category_2023)

# --- 2003: parse the Cyrillic Book 3 religion-by-municipality table -----------

# map 2003 Cyrillic municipality names (and the national row) to stable codes.
cyr_to_code <- c(
  "Андријевица" = "andrijevica",
  "Бар" = "bar",
  "Беране" = "berane",
  "Бијело Поље" = "bijelo_polje",
  "Будва" = "budva",
  "Цетиње" = "cetinje",
  "Даниловград" = "danilovgrad",
  "Херцег Нови" = "herceg_novi",
  "Колашин" = "kolasin",
  "Котор" = "kotor",
  "Мојковац" = "mojkovac",
  "Никшић" = "niksic",
  "Плав" = "plav",
  "Пљевља" = "pljevlja",
  "Плужине" = "pluzine",
  "Подгорица" = "podgorica",
  "Рожаје" = "rozaje",
  "Шавник" = "savnik",
  "Тиват" = "tivat",
  "Улцињ" = "ulcinj",
  "Жабљак" = "zabljak"
)
nat_2003_name <- "Република Црна Гора"  # Република Црна Гора

# convert the cached 2003 PDF to a fixed-layout text layer.
extract_2003_text <- function() {
  if (file.exists(path_2003_txt) && file_bytes(path_2003_txt) > 0L) return(invisible(path_2003_txt))
  if (!file.exists(path_2003_pdf)) {
    status <- system2("unzip", c("-o", shQuote(path_2003_zip), "-d", shQuote(raw_dir)))
    if (!identical(status, 0L) || !file.exists(path_2003_pdf)) stop("could not extract 2003 PDF from zip", call. = FALSE)
  }
  status <- system2("pdftotext", c("-layout", shQuote(path_2003_pdf), shQuote(path_2003_txt)))
  if (!identical(status, 0L)) stop("pdftotext failed for the 2003 publication", call. = FALSE)
  write_meta(path_2003_txt, url_2003, "DERIVED", "Fixed-layout text extracted from Book 3 knjiga3SVE.pdf.")
  invisible(path_2003_txt)
}

# parse one 2003 religion line into 11 integers (Total + 10 categories).
parse_2003_line <- function(line, name) {
  tail <- sub(paste0("^\\s*", name, "\\s+"), "", line)
  tokens <- strsplit(trimws(tail), "[[:space:]]+")[[1]]
  tokens[tokens == "-"] <- "0"
  if (length(tokens) != 11L || any(!grepl("^[0-9]+$", tokens))) {
    stop("unexpected 2003 token layout for ", name, call. = FALSE)
  }
  as.integer(tokens)
}

# read the 2003 section-1 religion table (national + 21 municipality total rows).
read_2003 <- function(path) {
  lines <- readLines(path, warn = FALSE, encoding = "UTF-8")
  start <- grep("1\\. СТАНОВНИШТВО ПРЕМА ВЈЕРОИСПОВЈЕСТИ", lines)
  stop_at <- grep("2\\. СТАНОВНИШТВО ПРЕМА МАТЕРЊЕМ", lines)
  if (length(start) == 0L || length(stop_at) == 0L) stop("2003 religion section markers absent", call. = FALSE)
  block <- lines[start[1]:stop_at[1]]
  take_row <- function(name) {
    hit <- grep(paste0("^\\s*", name, "\\s+[0-9]"), block, value = TRUE)
    if (length(hit) == 0L) stop("missing 2003 row: ", name, call. = FALSE)
    parse_2003_line(hit[1], name)
  }
  result <- lapply(names(cyr_to_code), function(nm) {
    setNames(list(unname(cyr_to_code[[nm]]), take_row(nm)), c("code", "values"))
  })
  national <- take_row(nat_2003_name)
  list(national = national, muni = setNames(lapply(result, `[[`, "values"), vapply(result, `[[`, character(1), "code")))
}

# --- 2011: parse table O19 (clean bilingual xls) -----------------------------

lat_to_code_2011 <- c(
  "Andrijevica" = "andrijevica", "Bar" = "bar", "Berane" = "berane", "Bijelo Polje" = "bijelo_polje",
  "Budva" = "budva", "Cetinje" = "cetinje", "Danilovgrad" = "danilovgrad", "Herceg Novi" = "herceg_novi",
  "Kolašin" = "kolasin", "Kotor" = "kotor", "Mojkovac" = "mojkovac", "Nikšić" = "niksic",
  "Plav" = "plav", "Pljevlja" = "pljevlja", "Plužine" = "pluzine", "Podgorica" = "podgorica",
  "Rožaje" = "rozaje", "Šavnik" = "savnik", "Tivat" = "tivat", "Ulcinj" = "ulcinj", "Žabljak" = "zabljak"
)

# read table O19: national + 21 municipalities, Total + 12 categories.
read_2011 <- function(path) {
  sheet <- excel_sheets(path)[1]
  d <- suppressMessages(read_excel(path, sheet = sheet, col_names = FALSE))
  names_col <- as.character(d[[1]])
  parse_row <- function(label) {
    idx <- which(names_col == label)
    if (length(idx) != 1L) stop("2011 O19 row not found or ambiguous: ", label, call. = FALSE)
    vals <- suppressWarnings(as.integer(unlist(d[idx, 2:14])))
    if (any(is.na(vals))) stop("2011 O19 non-integer cell (unexpected suppression) at ", label, call. = FALSE)
    vals
  }
  national <- parse_row("CRNA GORA / MONTENEGRO")
  muni <- setNames(lapply(names(lat_to_code_2011), parse_row), unname(lat_to_code_2011))
  list(national = national, muni = muni)
}

# --- 2023: parse release II Table 2 and aggregate 25 -> 21 -------------------

ascii_to_code_2023 <- c(
  "Andrijevica" = "andrijevica", "Bar" = "bar", "Berane" = "berane", "Bijelo Polje" = "bijelo_polje",
  "Budva" = "budva", "Cetinje" = "cetinje", "Danilovgrad" = "danilovgrad", "Gusinje" = "plav",
  "Herceg Novi" = "herceg_novi", "Kolasin" = "kolasin", "Kotor" = "kotor", "Mojkovac" = "mojkovac",
  "Niksic" = "niksic", "Petnjica" = "berane", "Plav" = "plav", "Pljevlja" = "pljevlja",
  "Pluzine" = "pluzine", "Podgorica" = "podgorica", "Rozaje" = "rozaje", "Savnik" = "savnik",
  "Tivat" = "tivat", "Tuzi" = "podgorica", "Ulcinj" = "ulcinj", "Zabljak" = "zabljak", "Zeta" = "podgorica"
)
# columns holding Total + the 12 mutually exclusive leaf categories (skip the "in %" columns).
cols_2023 <- c(2L, 4L, 6L, 8L, 10L, 12L, 14L, 16L, 18L, 20L, 22L, 24L, 26L)

# read Table 2: returns published integers and a parallel matrix flagging suppressed ("z") leaf cells.
read_2023 <- function(path) {
  d <- suppressMessages(read_excel(path, sheet = "Table 2", col_names = FALSE))
  name_rows <- 4:29                                  # Montenegro (row 4) + 25 municipalities
  raw <- lapply(name_rows, function(r) as.character(unlist(d[r, cols_2023])))
  labels <- vapply(name_rows, function(r) as.character(d[[1]][r]), character(1))
  national_raw <- raw[[1]]
  if (labels[1] != "Montenegro") stop("2023 national row label changed", call. = FALSE)
  if (any(national_raw == "z")) stop("2023 national row is unexpectedly suppressed", call. = FALSE)
  national <- as.integer(national_raw)
  # per-25-municipality published values (z/- -> 0) and suppression flags
  muni_labels <- labels[-1]
  if (!setequal(muni_labels, names(ascii_to_code_2023)) || length(muni_labels) != 25L) {
    stop("2023 municipality inventory changed", call. = FALSE)
  }
  vals25 <- lapply(raw[-1], function(v) {
    supp <- v == "z"
    num <- v; num[v == "z" | v == "-"] <- "0"
    if (any(!grepl("^[0-9]+$", num))) stop("2023 non-numeric cell after z/- handling", call. = FALSE)
    list(values = as.integer(num), suppressed = supp)
  })
  names(vals25) <- muni_labels
  # aggregate 25 -> 21 by target code; sum published values, OR suppression flags
  agg_vals <- setNames(lapply(muni_codes, function(cd) integer(length(cols_2023))), muni_codes)
  agg_supp <- setNames(lapply(muni_codes, function(cd) logical(length(cols_2023))), muni_codes)
  for (lab in muni_labels) {
    cd <- unname(ascii_to_code_2023[[lab]])
    agg_vals[[cd]] <- agg_vals[[cd]] + vals25[[lab]][["values"]]
    agg_supp[[cd]] <- agg_supp[[cd]] | vals25[[lab]][["suppressed"]]
  }
  list(national = national, muni = agg_vals, muni_suppressed = agg_supp, published25 = vals25)
}

# --- role-based headline extraction -----------------------------------------

# split a wave's category vector (named by source_code) into headline components.
headline_counts <- function(values, categories) {
  names(values) <- categories[["source_code"]]
  total <- values[["total"]]
  affiliation <- sum(values[categories[["source_code"]][categories[["role"]] == "named_religion"]])
  no_religion <- sum(values[categories[["source_code"]][categories[["role"]] == "no_religion"]])
  outside <- total - affiliation - no_religion
  list(total = total, affiliation = affiliation, no_religion = no_religion, outside = outside)
}

# --- validation: exact where the source permits it --------------------------

# validate one wave; exact category reconciliation for 2003/2011, population-only for 2023.
validate_wave <- function(year, wave, categories) {
  codes <- categories[["source_code"]]
  muni <- wave[["muni"]]
  if (!setequal(names(muni), muni_codes) || length(muni) != 21L) stop("wave lacks 21 municipalities: ", year, call. = FALSE)
  national <- wave[["national"]]
  if (length(national) != length(codes)) stop("wave national category count changed: ", year, call. = FALSE)

  # population-total reconciliation is exact for every wave
  muni_totals <- vapply(muni_codes, function(cd) muni[[cd]][1], integer(1))
  if (sum(muni_totals) != national[1]) {
    stop("population total reconciliation failed for ", year, ": ", sum(muni_totals), " vs ", national[1], call. = FALSE)
  }

  exact_categories <- year %in% c(2003L, 2011L)
  within_row_exact <- TRUE
  category_reconciliation <- NA
  suppressed_cells <- 0L
  suppressed_municipalities <- 0L
  suppressed_mass <- 0L

  if (exact_categories) {
    # every category sum must equal the row total, and municipality sums must equal national
    for (cd in muni_codes) {
      v <- muni[[cd]]
      if (sum(v[-1]) != v[1]) stop("within-municipality category sum failed for ", year, " ", cd, call. = FALSE)
    }
    per_cat <- vapply(seq_along(codes), function(j) sum(vapply(muni_codes, function(cd) muni[[cd]][j], integer(1))), integer(1))
    if (any(per_cat != national)) stop("category municipality-to-national reconciliation failed for ", year, call. = FALSE)
    category_reconciliation <- "exact"
  } else {
    # 2023: quantify confidentiality suppression; do not force an exact category gate
    supp <- wave[["muni_suppressed"]]
    for (cd in muni_codes) {
      leaf_supp <- supp[[cd]][-1]
      published_leaf_sum <- sum(muni[[cd]][-1])
      gap <- muni[[cd]][1] - published_leaf_sum
      if (gap < 0L) stop("2023 published leaves exceed total for ", cd, " (unexpected)", call. = FALSE)
      if (any(leaf_supp)) suppressed_municipalities <- suppressed_municipalities + 1L
      suppressed_cells <- suppressed_cells + sum(leaf_supp)
      suppressed_mass <- suppressed_mass + gap
    }
    category_reconciliation <- "population_exact_categories_confidentiality_suppressed"
  }

  hn <- headline_counts(national, categories)
  list(
    year = year,
    municipality_count = 21L,
    published_category_rows_including_total = length(codes),
    population_total_reconciliation = "exact",
    within_municipality_category_reconciliation = category_reconciliation,
    national_total = national[1],
    national_affiliation_count = hn[["affiliation"]],
    national_no_religion_count = hn[["no_religion"]],
    national_outside_headlines_count = hn[["outside"]],
    suppressed_municipalities = suppressed_municipalities,
    suppressed_category_cells = suppressed_cells,
    suppressed_mass_persons = suppressed_mass
  )
}

# --- boundary: dissolve geoBoundaries ADM1 (23) -> 21 ------------------------

gb_to_code <- c(
  "Andrijevica" = "andrijevica", "Bar" = "bar", "Berane" = "berane", "Bijelo Polje" = "bijelo_polje",
  "Budva" = "budva", "Cetinje" = "cetinje", "Danilovgrad" = "danilovgrad", "Gusinje" = "plav",
  "Herceg Novi" = "herceg_novi", "Kolašin" = "kolasin", "Kotor" = "kotor", "Mojkovac" = "mojkovac",
  "Nikšić" = "niksic", "Petnjica" = "berane", "Plav" = "plav", "Pljevlja" = "pljevlja",
  "Plužine" = "pluzine", "Podgorica" = "podgorica", "Rožaje" = "rozaje", "Šavnik" = "savnik",
  "Tivat" = "tivat", "Ulcinj" = "ulcinj", "Žabljak" = "zabljak"
)

# build the 21-municipality layer from geoBoundaries ADM1 by dissolve.
build_boundary <- function(path) {
  source <- st_read(path, quiet = TRUE)
  if (!"shapeName" %in% names(source)) stop("geoBoundaries fields changed", call. = FALSE)
  base_name <- sub(" Municipality$", "", as.character(source[["shapeName"]]))
  if (nrow(source) != 23L || !setequal(base_name, names(gb_to_code))) {
    stop("expected 23 geoBoundaries ADM1 features with known names", call. = FALSE)
  }
  source[["code"]] <- unname(gb_to_code[base_name])
  source <- st_make_valid(source)
  if (any(st_is_empty(source)) || any(!st_is_valid(source))) stop("invalid geoBoundaries geometry", call. = FALSE)
  dissolved <- aggregate(source["code"], by = list(code = source[["code"]]), FUN = function(x) x[1], do_union = TRUE)
  dissolved <- dissolved[, "code"]
  dissolved <- st_make_valid(dissolved)
  if (nrow(dissolved) != 21L || !setequal(dissolved[["code"]], muni_codes)) stop("dissolve did not yield 21 municipalities", call. = FALSE)
  dissolved[["area_name"]] <- unname(muni_display[dissolved[["code"]]])
  dissolved[["area_unit_id"]] <- paste(boundary_set_id, dissolved[["code"]], sep = ":")
  dissolved[["boundary_set_id"]] <- boundary_set_id
  dissolved[["boundary_level"]] <- boundary_level
  dissolved[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(dissolved, 3035))) / 1e6
  dissolved <- st_transform(dissolved, 4326)
  # the shipped join property is area_code, matching every sibling layer;
  # a page lane copying a sibling config must join without a codeProp override
  dissolved[["area_code"]] <- dissolved[["code"]]
  dissolved[order(dissolved[["area_code"]]), c("area_code", "area_name", "area_unit_id", "boundary_set_id", "boundary_level", "land_area_sq_km", "geometry")]
}

# simplify the boundary to a byte cap and enforce valid, distinct features.
write_boundary <- function(boundary) {
  simplification <- mapshaper_simplify_to_cap(
    boundary, boundary_out, max_bytes = 1500000,
    keep_percentages = c(100, 75, 50, 25, 15, 10, 7.5, 5, 3, 2, 1),
    clean_option = "allow-overlaps"
  )
  written <- st_read(boundary_out, quiet = TRUE)
  validity <- st_is_valid(written)
  if (nrow(written) != 21L || any(st_is_empty(written)) || any(is.na(validity)) || any(!validity)) {
    stop("simplified boundary did not retain 21 valid features", call. = FALSE)
  }
  if (!setequal(written[["area_code"]], muni_codes)) stop("municipality codes changed during simplification", call. = FALSE)
  hashes <- vapply(st_as_binary(st_geometry(written), EWKB = TRUE), function(wkb) digest(wkb, algo = "sha256", serialize = FALSE), character(1))
  if (length(unique(hashes)) != 21L) stop("municipality geometry hashes are not distinct", call. = FALSE)
  simplification[["byte_ceiling"]] <- 1500000L
  list(layer = written, simplification = simplification, valid_feature_count = sum(validity),
       geometry_hashes = setNames(as.list(hashes), written[["area_code"]]))
}

# --- row assembly -----------------------------------------------------------

# build one schema-conforming municipality-year row.
build_row <- function(year, code, wave, categories, boundary) {
  values <- wave[["muni"]][[code]]
  hn <- headline_counts(values, categories)
  area <- boundary[boundary[["area_code"]] == code, ]
  suppressed <- year == 2023L && any(wave[["muni_suppressed"]][[code]][-1])
  suppressed_mass <- if (year == 2023L) hn[["total"]] - hn[["affiliation"]] - hn[["no_religion"]] - 0L else NA
  base_flag <- if (year == 2023L) {
    paste0("full_enumeration_census_affiliation;total_population_denominator;population_total_exact;",
           "categories_25to21_aggregated_to_historic_parents;",
           if (suppressed) "monstat_confidentiality_suppression_z;affiliation_and_no_religion_are_published_cell_lower_bounds;" else "no_suppressed_cells_in_this_municipality;")
  } else {
    "full_enumeration_census_affiliation;total_population_denominator;exact_within_and_national_reconciliation;"
  }
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = area[["area_unit_id"]][[1]],
    area_code = code,
    area_name = area[["area_name"]][[1]],
    year = year,
    population_total = hn[["total"]],
    population_total_basis = paste("MONSTAT census population total; percentages use the total census population.", scope_note),
    religious_affiliation_count = hn[["affiliation"]],
    religious_affiliation_percent = round(100 * hn[["affiliation"]] / hn[["total"]], 4),
    no_religion_count = hn[["no_religion"]],
    no_religion_percent = round(100 * hn[["no_religion"]] / hn[["total"]], 4),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(area[["land_area_sq_km"]][[1]], 4),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = as.list(c(census_dataset_id, boundary_dataset_id)),
    quality_flag = paste0(base_flag, scope_note)
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
    no_religion_count = vapply(rows, `[[`, integer(1), "no_religion_count"),
    no_religion_percent = vapply(rows, `[[`, numeric(1), "no_religion_percent"),
    place_count = NA_integer_,
    places_per_10000_residents = NA_real_,
    place_density_per_sq_km = NA_real_,
    land_area_sq_km = vapply(rows, `[[`, numeric(1), "land_area_sq_km"),
    site_snapshot_date = NA_character_,
    place_count_basis = NA_character_,
    source_dataset_ids = vapply(rows, function(row) paste(unlist(row[["source_dataset_ids"]]), collapse = "|"), character(1)),
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

temporal_cov <- "MONSTAT population censuses 2003, 2011, and 2023."
spatial_cov <- paste("Twenty-one municipalities on the stable 2003-2011 administrative frame.", scope_note)
quality_cov <- paste("Census affiliation is a self-identification question.", suppression_note, boundary_note)

indicators <- function() {
  list(
    list(indicator_id = "population_total", label = "Census population",
         description = "Published census population total for the municipality and wave.",
         unit = "count", denominator_indicator_id = NULL, method = "Published MONSTAT municipality total.",
         temporal_coverage = temporal_cov, spatial_coverage = spatial_cov, quality_notes = quality_cov),
    list(indicator_id = "religious_affiliation_percent", label = "Religious affiliation (% of census population)",
         description = "Share of the census population in the published named-religion categories.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 times the sum of named-religion categories divided by the census population total; for 2023 the numerator is a published-cell lower bound where confidentiality suppression applies.",
         temporal_coverage = temporal_cov, spatial_coverage = spatial_cov, quality_notes = quality_cov),
    list(indicator_id = "no_religion_percent", label = "No religion (% of census population)",
         description = "Not-a-believer in 2003; agnostic plus atheist in 2011 and 2023, divided by the census population total.",
         unit = "percent", denominator_indicator_id = "population_total",
         method = "100 times the wave-specific no-religion categories divided by the census population total; for 2023 a published-cell lower bound where suppression applies.",
         temporal_coverage = temporal_cov, spatial_coverage = spatial_cov, quality_notes = quality_cov)
  )
}

visual_layers <- function() {
  list(
    list(visual_layer_id = "me-municipality-religious-affiliation",
         label = "Religious affiliation (% of census population)",
         description = "Census-affiliation share by municipality for 2003, 2011, and 2023.",
         layer_type = "choropleth", indicator_ids = list("religious_affiliation_percent"),
         geometry_unit_type = "area_unit", legend = list(unit = "percent", denominator = "total census population"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "sum published named-religion categories; 2023 municipal detail is suppressed for small cells",
         uncertainty_display = "quality_flag", default_visibility = TRUE, notes = paste(scope_note, suppression_note)),
    list(visual_layer_id = "me-municipality-no-religion",
         label = "No religion (% of census population)",
         description = "Not-a-believer in 2003; agnostic plus atheist in 2011 and 2023.",
         layer_type = "choropleth", indicator_ids = list("no_religion_percent"),
         geometry_unit_type = "area_unit", legend = list(unit = "percent", denominator = "total census population"),
         colour_scale = "sequential", time_control = "year_selector",
         aggregation_rule = "use the published wave-specific no-religion categories",
         uncertainty_display = "quality_flag", default_visibility = FALSE, notes = paste(scope_note, suppression_note))
  )
}

source_datasets <- function() {
  list(
    list(source_dataset_id = census_dataset_id,
         name = "MONSTAT census religion by municipality, 2003, 2011, and 2023",
         provider = "Statistical Office of Montenegro (MONSTAT)",
         url = url_2023, retrieval_date = retrieval_date, local_path = path_2023,
         licence = list(name = paste0("MONSTAT reserves all rights (verbatim site footer: \"", monstat_copyright_verbatim, "\"); no open-data licence or reproduction clause located."),
                        url = url_terms, attribution = "Statistical Office of Montenegro (MONSTAT)"),
         citation = "MONSTAT, Census of Population, Households and Dwellings 2003 (Book 3), 2011 (Table O19), and 2023 (Release II).",
         access_limits = NULL,
         redistribution_limits = "Site footer reserves all rights. The build ships derived summaries with MONSTAT attribution and holds raw sources git-ignored; a reuse ruling is deferred to the conductor/PI.",
         notes = paste("2003 and 2011 report 21 municipalities; 2023 reports 25 aggregated to the 21-municipality frame.", suppression_note)),
    list(source_dataset_id = boundary_dataset_id,
         name = "geoBoundaries Montenegro ADM1 (dissolved to 21 municipalities)",
         provider = "geoBoundaries (OpenStreetMap-derived)",
         url = url_boundary, retrieval_date = retrieval_date, local_path = path_boundary,
         licence = list(name = "Open Data Commons Open Database License 1.0 (ODbL)", url = "https://www.openstreetmap.org/copyright", attribution = "geoBoundaries; © OpenStreetMap contributors, ODbL"),
         citation = "geoBoundaries gbOpen Montenegro ADM1, boundary ID MNE-ADM1-59799669, represented year 2017.",
         access_limits = NULL,
         redistribution_limits = "ODbL share-alike; derived database and attribution required.",
         notes = boundary_note)
  )
}

# describe one tracked public output in the manifest.
manifest_file_record <- function(path, content) {
  list(uri = paste0("repo:", path), storage_provider = "git_repository", format = tools::file_ext(path),
       bytes = file_bytes(path), sha256 = sha256_file(path), row_count = row_count_file(path),
       content = content, privacy = "public", licence_status = "needs_review", licence_basis = "monstat_all_rights_reserved_attribution")
}

# describe one raw cached source with URL, retrieval time, and digest.
raw_source_record <- function(path, url, format, source_dataset_id, notes) {
  meta <- read_meta(path)
  list(uri = path, url = url, retrieval_date = substr(meta[["retrieved_at"]], 1L, 10L), retrieved_at = meta[["retrieved_at"]],
       http_status = meta[["http_status"]], format = format, bytes = file_bytes(path), sha256 = sha256_file(path),
       source_dataset_id = source_dataset_id, used_in_public_product = TRUE, notes = notes)
}

# record categories with source labels and English display labels.
category_mapping <- function(year, categories) {
  entries <- apply(categories, 1, function(entry) {
    paste0(entry[["source_code"]], " ", entry[["source_name"]], " => ", entry[["display_en"]],
           " [product role: ", entry[["role"]], "; harmonisation: as_published]")
  })
  paste0("Category mapping for ", year, ": ", paste(entries, collapse = "; "), ".")
}

# --- run --------------------------------------------------------------------

fetch_file(url_2003, path_2003_zip)
fetch_file(url_2011, path_2011)
fetch_file(url_2023, path_2023)
fetch_file(url_terms, path_terms)
fetch_file(url_boundary_meta, path_boundary_meta)
fetch_file(url_boundary, path_boundary)
extract_2003_text()

waves <- list(`2003` = read_2003(path_2003_txt), `2011` = read_2011(path_2011), `2023` = read_2023(path_2023))
reconciliation <- lapply(years, function(y) validate_wave(y, waves[[as.character(y)]], wave_categories[[as.character(y)]]))
names(reconciliation) <- as.character(years)

boundary_result <- write_boundary(build_boundary(path_boundary))
written_boundary <- boundary_result[["layer"]]

rows <- unlist(lapply(years, function(y) {
  lapply(muni_codes, function(cd) build_row(y, cd, waves[[as.character(y)]], wave_categories[[as.character(y)]], written_boundary))
}), recursive = FALSE)
if (length(rows) != 63L) stop("expected 63 municipality-year rows", call. = FALSE)

area_summary <- list(
  schema_version = "0.2.0",
  generated_at = stamp,
  generated_by = script_id,
  country_code = country_code,
  boundary_set = list(boundary_set_id = boundary_set_id, country_code = country_code, level = boundary_level,
                      vintage = boundary_vintage, source_dataset_id = boundary_dataset_id),
  site_snapshot = list(source_dataset_id = NULL, snapshot_date = NULL,
                       basis = "no governed Montenegro place-of-worship snapshot is included in this census-affiliation release",
                       notes = paste("The product ships census-affiliation metrics and municipality geometry only; place-density fields are null.", scope_note)),
  source_datasets = source_datasets(),
  indicators = indicators(),
  visual_layers = visual_layers(),
  rows = rows
)
write_json(area_summary, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

raw_sources <- list(
  raw_source_record(path_2003_zip, url_2003, "zip", census_dataset_id, "2003 census Book 3 (Vjeroispovijest, maternji jezik i nacionalna pripadnost po opstinama); contains knjiga3SVE.pdf."),
  raw_source_record(path_2003_txt, url_2003, "txt", census_dataset_id, "Fixed-layout Cyrillic text extracted from the 2003 Book 3 PDF; section 1 is population by religion by municipality."),
  raw_source_record(path_2011, url_2011, "xls", census_dataset_id, "2011 census Table O19, population by religion per municipality (bilingual)."),
  raw_source_record(path_2023, url_2023, "xlsx", census_dataset_id, "2023 census Release II (ENG); Table 2 is population by religion by municipality with confidentiality suppression."),
  raw_source_record(path_terms, url_terms, "html", census_dataset_id, "MONSTAT English homepage; footer carries the verbatim all-rights-reserved copyright."),
  raw_source_record(path_boundary_meta, url_boundary_meta, "json", boundary_dataset_id, "geoBoundaries MNE ADM1 release metadata (ODbL, 23 features, year 2017)."),
  raw_source_record(path_boundary, url_boundary, "geojson", boundary_dataset_id, "geoBoundaries MNE ADM1 GeoJSON dissolved to 21 municipalities in the build.")
)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = "manifest:me-census-religion:me:2003-2023:monstat-municipality",
  dataset_id = "me-census-religion:me:2003-2023:monstat-municipality",
  dataset_version_id = paste0("me-census-religion:me:2003-2023:monstat-municipality:", substr(sha256_file(summary_json_out), 1L, 12L)),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "me-census-religion",
  dataset_role = "public_product",
  scope = list(level = "country", country_codes = list(country_code), snapshot_date = NULL, snapshot_anchor = NULL, pipeline_stage = "staged"),
  created_at = stamp,
  created_by = script_id,
  pipeline = list(
    script = script_id, git_commit = git_commit, command = paste("Rscript", script_id),
    parameters = list(
      waves = years,
      geography = "21 municipalities on the stable 2003-2011 administrative frame; 2023's 25 municipalities aggregated to their historical parents",
      construct = "census affiliation",
      denominator = "total census population",
      category_rule = "preserve source categories per wave; sum named religions for the affiliation headline; keep non-response outside both headlines",
      aggregation_2023 = "Petnjica->Berane; Gusinje->Plav; Tuzi->Podgorica; Zeta->Podgorica (complete-unit partitions)",
      suppression_2023 = suppression_note,
      territorial_scope = scope_note,
      boundary_source = boundary_note,
      boundary_simplification = boundary_result[["simplification"]],
      local_cache_hint = "Raw MONSTAT sources, terms, and geoBoundaries geometry are cached under data/raw/me_census/ and remain git-ignored.",
      raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/me_census/ (8 objects mirrored 2026-07-11)"),
      retrieval_routes = list(
        list(purpose = "2003 religion", method = "GET", url = url_2003, notes = "Book 3 zip; knjiga3SVE.pdf section 1."),
        list(purpose = "2011 religion", method = "GET", url = url_2011, notes = "Table O19 xls."),
        list(purpose = "2023 religion", method = "GET", url = url_2023, notes = "Release II ENG xlsx, Table 2."),
        list(purpose = "boundary", method = "GET", url = url_boundary, notes = "geoBoundaries MNE ADM1 GeoJSON.")
      )
    ),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")), jsonlite = as.character(packageVersion("jsonlite")),
      readxl = as.character(packageVersion("readxl")), digest = as.character(packageVersion("digest")),
      mapshaper = "npx mapshaper through scripts/lib/simplify_boundary.R", pdftotext = "Poppler pdftotext command-line utility"
    )
  ),
  source = list(
    provider = "Statistical Office of Montenegro (MONSTAT); geoBoundaries (OpenStreetMap)",
    source_dataset_ids = list(census_dataset_id, boundary_dataset_id),
    source_urls = list(url_2003, url_2011, url_2023, url_terms, url_boundary_meta, url_boundary),
    retrieved_at = paste0(retrieval_date, "T00:00:00Z"),
    licence = paste0("MONSTAT census: site footer reserves all rights (verbatim: \"", monstat_copyright_verbatim, "\"); no open licence located; derived summaries ship with attribution, reuse ruling deferred. Boundary: geoBoundaries ADM1 under ODbL."),
    citation = "MONSTAT census religion by municipality 2003 (Book 3), 2011 (Table O19), 2023 (Release II); geoBoundaries MNE ADM1.",
    raw_redistribution = "Raw MONSTAT files stay git-ignored; only derived summaries are published.",
    licence_position = "needs_review"
  ),
  input_manifests = list(),
  durable_files = list(
    manifest_file_record(summary_json_out, "Montenegro municipality census-religion summary for 2003, 2011, and 2023 on the 21-municipality frame."),
    manifest_file_record(summary_csv_out, "Flattened Montenegro municipality census-religion rows."),
    manifest_file_record(boundary_out, "geoBoundaries MNE ADM1 dissolved to the 21 pre-2013 municipalities, simplified.")
  ),
  raw_sources = raw_sources,
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id, notes = "63 municipality-year rows."),
    list(uri = paste0("repo:", summary_csv_out), sha256 = sha256_file(summary_csv_out), built_by = script_id, notes = "CSV companion."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out), built_by = script_id, notes = "21 simplified municipality features.")
  ),
  target_years = years,
  validation = list(
    status = "passed_with_warnings",
    commands = list(
      "Rscript scripts/build_me_area_summary.R",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/me/data/area_summary_municipality.json",
      "bash scripts/validate_manifests.sh"
    ),
    tests = list(
      "All three announced waves contain national and 21 municipality rows.",
      "Municipality population totals sum exactly to the published national total for every wave.",
      "2003 and 2011 category counts reconcile exactly within municipality and from municipality to national.",
      "2023 category detail is confidentiality-suppressed (z) for small cells; affiliation and no-religion are published-cell lower bounds, disclosed and never tuned.",
      "All 21 simplified geometries are valid, non-empty, and have distinct SHA-256 WKB hashes.",
      "Every raw input and generated output records URL or repository path, retrieval date, byte size, and SHA-256."
    ),
    warnings = list(
      suppression_note,
      paste0("MONSTAT reserves all rights (verbatim: \"", monstat_copyright_verbatim, "\"). No open-data licence located; licence status is needs_review pending a conductor/PI reuse ruling."),
      boundary_note
    ),
    notes = paste("Population-denominator and 2003/2011 category gates passed exactly; 2023 category suppression is disclosed.", scope_note),
    stats = list(
      waves = 3L, rows = 63L, municipalities_per_wave = 21L,
      category_counts = "2003=11; 2011=13; 2023=13 published columns including total",
      boundary_features = 21L, boundary_valid_features = boundary_result[["valid_feature_count"]],
      distinct_geometry_hashes = length(unique(unlist(boundary_result[["geometry_hashes"]]))),
      boundary_bytes = file_bytes(boundary_out), summary_json_bytes = file_bytes(summary_json_out), summary_csv_bytes = file_bytes(summary_csv_out)
    ),
    reconciliation = reconciliation,
    boundary_validation = list(
      output_feature_count = 21L, valid_feature_count = boundary_result[["valid_feature_count"]],
      distinct_geometry_hash_count = length(unique(unlist(boundary_result[["geometry_hashes"]]))),
      geometry_sha256_by_code = boundary_result[["geometry_hashes"]],
      source_crs = "EPSG:4326", area_calculation_crs = "EPSG:3035", output_crs = "EPSG:4326"
    )
  ),
  construct_notes = c(list(
    "The construct is census affiliation. It does not measure belief, practice, attendance, or registered membership.",
    scope_note,
    "The headline percentages use the total census population. Non-response categories remain in that denominator and outside both headlines.",
    "In 2003 the no-religion headline is Nije vjernik (not a believer); Neizjasnjen and Nepoznato are non-response held in the denominator.",
    "In 2011 and 2023 the no-religion headline is agnostics plus atheists; the 2023 residual Other category is held outside both headlines in the denominator.",
    suppression_note,
    boundary_note,
    "Source category labels are preserved verbatim: 2003 in Montenegrin Cyrillic, 2011 bilingual (Montenegrin Latin / English), 2023 in MONSTAT English (spelling 'Ortodox' kept as published). English display labels are added, not substituted.",
    "MONSTAT means the Statistical Office of Montenegro. ADM1 means first-level administrative division in the geoBoundaries scheme."
  ), lapply(years, function(y) category_mapping(y, wave_categories[[as.character(y)]]))),
  deferred_sources = list(
    list(source = "MONSTAT 2023 Release II Table 2 at the full 25-municipality level",
         status = "extra_level_not_shipped",
         reason = "The current-division 25-municipality 2023 detail (Petnjica, Gusinje, Tuzi, Zeta separate) is not shipped as a second level; a licensed 25-municipality boundary and a current-frame companion design are future work. The 2023 data are shipped aggregated to the 21-municipality change frame."),
    list(source = "MONSTAT 2003/2011 settlement-level religion tables",
         status = "finer_level_not_shipped",
         reason = "Settlement-level religion exists for 2003 and 2011 but not for the harmonised change frame; municipality is the shipped level.")
  ),
  privacy = "public",
  licence_status = "needs_review",
  licence_basis = "monstat_all_rights_reserved_attribution",
  downstream_status = "staged",
  source_datasets = source_datasets(),
  notes = paste("The committed product contains derived municipality summaries and simplified geoBoundaries geometry only. Montenegro UI and hub wiring are outside this build.", scope_note)
)
write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)

cat(sprintf("2003 route: %s (Book 3 knjiga3SVE.pdf)\n", url_2003))
cat(sprintf("2011 route: %s (Table O19)\n", url_2011))
cat(sprintf("2023 route: %s (Release II, Table 2)\n", url_2023))
cat("waves x geography: 2003, 2011, 2023 x 21 municipalities (2023 aggregated 25->21)\n")
cat("population reconciliation gate: passed exactly for all three waves\n")
cat("category reconciliation gate: exact for 2003 and 2011; 2023 confidentiality-suppressed and disclosed\n")
for (y in as.character(years)) {
  r <- reconciliation[[y]]
  cat(sprintf("  %s: national=%d affiliation=%d no_religion=%d outside=%d suppressed_munis=%s suppressed_mass=%s\n",
      y, r[["national_total"]], r[["national_affiliation_count"]], r[["national_no_religion_count"]],
      r[["national_outside_headlines_count"]], r[["suppressed_municipalities"]], r[["suppressed_mass_persons"]]))
}
cat("geometry gate: passed; 21 valid features with 21 distinct SHA-256 WKB hashes\n")
cat(sprintf("licence: MONSTAT reserves all rights (needs_review); boundary ODbL\n"))
cat(sprintf("wrote %s: %d rows, %d bytes\n", summary_json_out, length(rows), file_bytes(summary_json_out)))
cat(sprintf("wrote %s: %d rows, %d bytes\n", summary_csv_out, row_count_file(summary_csv_out), file_bytes(summary_csv_out)))
cat(sprintf("wrote %s: %d features, %d bytes\n", boundary_out, row_count_file(boundary_out), file_bytes(boundary_out)))
cat(sprintf("wrote %s: %d bytes\n", manifest_out, file_bytes(manifest_out)))
