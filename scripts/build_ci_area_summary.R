# build the Côte d'Ivoire 2021 local census-affiliation area-summary product.
# inputs: INS/ANStat RGPH publications and geoBoundaries CIV ADM2/ADM3.
# outputs: local area-summary JSON/CSV, simplified boundary GeoJSON, and manifest.
# run from the repository root: Rscript scripts/build_ci_area_summary.R

suppressPackageStartupMessages({
  library(jsonlite)
  library(sf)
  library(stringi)
})

source("scripts/lib/simplify_boundary.R")

country_code <- "CI"
script_id <- "scripts/build_ci_area_summary.R"
raw_dir <- "data/raw/ci_census"
product_dir <- "apps/regions/ci/data"
manifest_dir <- "docs/manifests"
dir.create(raw_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(product_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

retrieval_date <- format(Sys.Date(), "%Y-%m-%d")
stamp <- paste0(retrieval_date, "T00:00:00Z")
boundary_level <- "sub_prefecture_or_commune"
boundary_set_id <- "ci-local-2021-geoboundaries-adm3"
census_2021_dataset_id <- "ins-rgph-2021-table-11-religion-local"
census_2021_tome1_dataset_id <- "anstat-rgph-2021-tome-1-state-and-population-structure"
census_2014_dataset_id <- "ins-rgph-2014-synthesis-table-2-11"
census_1998_dataset_id <- "ins-rgph-1998-volume-4-tome-1"
boundary_dataset_id <- "geoboundaries-civ-adm3-2021"
boundary_parent_dataset_id <- "geoboundaries-civ-adm2-2016"

census_2021_url <- "https://rp2021.anstat.ci/wp-content/uploads/2023/09/TABLEAUX-11_DE-BASES_RP-RELIGION.pdf"
census_2021_tome1_url <- "https://www.anstat.ci/assets/publications/files/rgpg_tom1.pdf"
census_2014_url <- "https://centredecalcul.anstat.ci/assets/rapports/RGPH_2014/Rapport_RGPH_2014.pdf"
census_1998_url <- "https://centredecalcul.anstat.ci/assets/rapports/RGPH_98/RGPH_TOME1.pdf"
anstat_site_url <- "https://www.anstat.ci/"
anstat_api_docs_url <- "https://anstat.ci/public/api"
boundary_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/CIV/ADM3/"
boundary_parent_meta_url <- "https://www.geoboundaries.org/api/current/gbOpen/CIV/ADM2/"
boundary_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/CIV/ADM3/geoBoundaries-CIV-ADM3.geojson"
boundary_parent_url <- "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/CIV/ADM2/geoBoundaries-CIV-ADM2.geojson"

census_2021_path <- file.path(raw_dir, "rgph2021_table_11_religion.pdf")
census_2021_tome1_path <- file.path(raw_dir, "rgph2021_tome1_state_structure.pdf")
census_2014_path <- file.path(raw_dir, "rgph2014_synthesis.pdf")
census_1998_path <- file.path(raw_dir, "rgph1998_volume4_tome1.pdf")
boundary_meta_path <- file.path(raw_dir, "geoboundaries_civ_adm3_metadata.json")
boundary_parent_meta_path <- file.path(raw_dir, "geoboundaries_civ_adm2_metadata.json")
boundary_path <- file.path(raw_dir, "geoboundaries_civ_adm3.geojson")
boundary_parent_path <- file.path(raw_dir, "geoboundaries_civ_adm2.geojson")

boundary_out <- file.path(product_dir, "ci_local_2021.geojson")
summary_json_out <- file.path(product_dir, "area_summary_local.json")
summary_csv_out <- file.path(product_dir, "area_summary_local.csv")
manifest_out <- file.path(manifest_dir, "ci-census-religion-2021.json")

category_codes <- c(
  "SANS_RELIGION", "CATHOLIQUE", "METHODISTE_PROTESTANT", "EVANGELIQUE",
  "CELESTE", "HARRISTE", "TEMOIN_DE_JEHOVAH", "PAPA_NOUVEAU",
  "AUTRE_CHRETIEN", "MUSULMAN", "ANIMISTE", "BOUDHISTE", "DEHIMA",
  "AUTRES_RELIGION", "NE_SAIT_PAS", "NON_DECLAREE"
)

source_labels_fr <- c(
  "Sans réligion", "Catholique", "Méthodiste / Protestant",
  "Evangélique (Assemblée de Dieu, Baptiste, Pentecôte, CM, Etc.)",
  "Céleste", "Harriste", "Témoin de Jéhovah", "Papa nouveau",
  "Autre Chrétien", "Musulman (e)", "Animiste", "Boudhiste", "Déhima",
  "Autres réligion (à préciser)", "Ne sait pas", "Non déclarée"
)

display_labels_en <- c(
  "No religion", "Catholic", "Methodist / Protestant", "Evangelical",
  "Celestial Church", "Harrist", "Jehovah's Witness", "Papa Nouveau",
  "Other Christian", "Muslim", "Animist", "Buddhist", "Dehima",
  "Other religion", "Does not know", "Not declared"
)

category_roles <- c(
  "no_religion", rep("religious_affiliation", 13L), "unknown", "nonresponse"
)

# return a file's SHA-256 digest.
sha256_file <- function(path) unname(tools::sha256sum(path))

# return a file's size in bytes.
file_bytes <- function(path) as.numeric(unname(file.info(path)[["size"]]))

# write retrieval metadata beside one cached source.
write_retrieval_meta <- function(path, url, tls_verification) {
  meta <- list(
    url = url,
    retrieved_at = stamp,
    method = "GET",
    tls_verification = tls_verification,
    bytes = file_bytes(path),
    sha256 = sha256_file(path)
  )
  write_json(meta, paste0(path, ".meta.json"), auto_unbox = TRUE, pretty = TRUE)
}

# fetch one source once and retain its first retrieval metadata.
fetch_file <- function(url, path, insecure = FALSE) {
  if (file.exists(path) && file_bytes(path) > 0) {
    if (!file.exists(paste0(path, ".meta.json"))) {
      write_retrieval_meta(path, url, if (insecure) "disabled_after_local_chain_failure" else "enabled")
    }
    return(invisible(path))
  }
  temporary_path <- paste0(path, ".part")
  arguments <- c(
    if (insecure) "-k" else character(), "-L", "--fail", "--retry", "3",
    "--retry-all-errors", "--connect-timeout", "20", "--max-time", "600",
    "--silent", "--show-error", "-o", temporary_path, url
  )
  status <- system2("curl", arguments)
  if (status != 0L || !file.exists(temporary_path) || file_bytes(temporary_path) == 0) {
    stop("failed to fetch ", url, call. = FALSE)
  }
  if (!file.rename(temporary_path, path)) stop("failed to cache ", path, call. = FALSE)
  write_retrieval_meta(path, url, if (insecure) "disabled_after_local_chain_failure" else "enabled")
  invisible(path)
}

# read the preserved retrieval metadata for one cached source.
read_retrieval_meta <- function(path) {
  meta_path <- paste0(path, ".meta.json")
  if (!file.exists(meta_path)) stop("missing retrieval metadata for ", path, call. = FALSE)
  fromJSON(meta_path, simplifyVector = FALSE)
}

# convert a French printed integer with grouping spaces to an integer.
parse_printed_integer <- function(value) as.integer(gsub(" ", "", value, fixed = TRUE))

# repair the doubly-UTF-8-encoded strings in the geoBoundaries shapeName field.
# diagnosis (raw-byte inspection, 2026-07-11): the accented ADM3 names are
# double-encoded. an original correctly-encoded UTF-8 byte pair such as e-acute
# (0xC3 0xA9) was decoded once as Latin-1 (yielding "A-tilde ©") and then
# re-encoded to UTF-8, so the file stores four bytes 0xC3 0x83 0xC2 0xA9 for a
# single "é". the repair reverses exactly one such layer: re-encode the string's
# code points to Latin-1 bytes, then reinterpret those bytes as UTF-8.
# the transform is GATED on the mojibake signature (a string containing the
# A-tilde / A-circumflex lead characters), never a place-name pattern list, and
# never applied to clean strings: on macOS `iconv` silently drops invalid bytes
# instead of returning NA, so an ungated round-trip would strip real accents
# (e.g. "Aboudé" -> "Aboud"). the gate confines the round-trip to genuinely
# double-encoded strings; 166 of the 510 ADM3 names carry the signature and are
# repaired, leaving only legitimate French letters (é, è, ï) and zero residue.
repair_mojibake <- function(value) {
  bad <- grepl("Ã|Â", value)   # U+00C3 (Ã) / U+00C2 (Â): double-encode lead chars
  if (!any(bad)) return(value)
  fix <- value[bad]
  latin <- iconv(fix, from = "UTF-8", to = "latin1")   # code points -> Latin-1 bytes
  Encoding(latin) <- "UTF-8"                            # reinterpret those bytes as UTF-8
  ok <- !is.na(latin) & !is.na(iconv(latin, "UTF-8", "UTF-8"))
  fix[ok] <- latin[ok]
  value[bad] <- fix
  value
}

# normalise one place label for an explicit census-to-boundary join.
# transliteration uses stringi's Latin-ASCII transform, not iconv
# ASCII//TRANSLIT: the macOS iconv build renders "É" as "'E" (apostrophe-E),
# which the punctuation split below would break into "E", silently destroying
# every accented boundary name. stri_trans_general maps É->E and é->e cleanly
# and portably.
normalise_name <- function(value) {
  value <- repair_mojibake(enc2utf8(value))
  value <- stri_trans_general(value, "Latin-ASCII")
  value <- toupper(value)
  value <- gsub("\\(DE [^)]+\\)", "", value)
  value <- gsub("[^A-Z0-9]+", " ", value)
  trimws(gsub("[[:space:]]+", " ", value))
}

# normalise an ADM2 region label to a comparable key. the census hierarchy prints
# an autonomous district as "District Autonome X" and an ordinary region as
# "Région du/des/de X", while the geoBoundaries ADM2 layer prints "District
# Autonome De X" / "X"; strip the administrative prefixes so, for example, the
# census "YAMOUSSOUKRO" and the ADM2 "District Autonome De Yamoussoukro" agree.
# used only to disambiguate ADM3 features that share a name across regions.
region_key <- function(value) {
  key <- normalise_name(value)
  key <- gsub(paste0(
    "^(DISTRICT AUTONOME DE |DISTRICT AUTONOME DES |DISTRICT AUTONOME D |",
    "DISTRICT DE |DISTRICT DES |DISTRICT DU |DISTRICT D |",
    "REGION DE |REGION DES |REGION DU |REGION D |DU |DES |DE |D )"), "", key)
  trimws(key)
}

# parse all count rows on one of the paired Table 11 sheets.
parse_count_sheet <- function(page) {
  lines <- strsplit(page, "\n", fixed = TRUE)[[1L]]
  number_group <- "([0-9]+(?: [0-9]{3})*)"
  pattern <- paste0("^(.+?)", paste(rep(paste0("[[:space:]]{2,}", number_group), 9L), collapse = ""), "[[:space:]]*$")
  matches <- regmatches(lines, regexec(pattern, lines, perl = TRUE))
  matches <- matches[lengths(matches) > 0L]
  if (!length(matches)) return(data.frame())
  do.call(rbind, lapply(matches, function(match) {
    prefix <- match[[2L]]
    first_character <- regexpr("[^[:space:]]", prefix)[[1L]]
    prefix_parts <- strsplit(trimws(prefix), "[[:space:]]{2,}", perl = TRUE)[[1L]]
    if (first_character >= 30L) {
      hierarchy_label <- ""
      local_label <- trimws(prefix)
    } else if (length(prefix_parts) == 1L) {
      hierarchy_label <- prefix_parts[[1L]]
      local_label <- ""
    } else {
      hierarchy_label <- prefix_parts[[1L]]
      local_label <- prefix_parts[[length(prefix_parts)]]
    }
    numbers <- vapply(match[3:11], parse_printed_integer, integer(1))
    data.frame(
      prefix_key = normalise_name(trimws(prefix)),
      hierarchy_label = hierarchy_label,
      local_label = local_label,
      population_total = numbers[[1L]],
      v1 = numbers[[2L]], v2 = numbers[[3L]], v3 = numbers[[4L]],
      v4 = numbers[[5L]], v5 = numbers[[6L]], v6 = numbers[[7L]],
      v7 = numbers[[8L]], v8 = numbers[[9L]],
      stringsAsFactors = FALSE
    )
  }))
}

# parse the paired 2021 Table 11 sheets and reconcile every printed row.
parse_2021_table <- function(path) {
  text_path <- tempfile(fileext = ".txt")
  on.exit(unlink(text_path), add = TRUE)
  status <- system2("pdftotext", c("-layout", path, text_path))
  if (status != 0L) stop("pdftotext failed for the 2021 religion table", call. = FALSE)
  text <- paste(readLines(text_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
  pages <- strsplit(text, "\f", fixed = TRUE)[[1L]]
  parsed_pages <- lapply(pages, parse_count_sheet)
  parsed_pages <- parsed_pages[vapply(parsed_pages, nrow, integer(1)) > 0L]
  if (length(parsed_pages) != 30L) stop("expected 30 Table 11 count sheets", call. = FALSE)

  paired <- vector("list", 15L)
  for (index in seq_len(15L)) {
    first <- parsed_pages[[2L * index - 1L]]
    second <- parsed_pages[[2L * index]]
    if (nrow(first) != nrow(second) ||
        !identical(first[["prefix_key"]], second[["prefix_key"]]) ||
        !identical(first[["population_total"]], second[["population_total"]])) {
      mismatch <- if (nrow(first) == nrow(second)) which(
        first[["prefix_key"]] != second[["prefix_key"]] |
          first[["population_total"]] != second[["population_total"]]
      ) else integer()
      detail <- if (nrow(first) == nrow(second) && length(mismatch)) {
        paste0(
          "; first mismatch row ", mismatch[[1L]], ": '",
          first[["hierarchy_label"]][mismatch[[1L]]], " / ", first[["local_label"]][mismatch[[1L]]],
          "' versus '", second[["hierarchy_label"]][mismatch[[1L]]], " / ",
          second[["local_label"]][mismatch[[1L]]], "'"
        )
      } else paste0("; row counts ", nrow(first), " versus ", nrow(second))
      stop("paired Table 11 sheets ", index, " do not carry identical row keys", detail, call. = FALSE)
    }
    combined <- first[, c("hierarchy_label", "local_label", "population_total")]
    combined[, category_codes[1:8]] <- first[, paste0("v", 1:8)]
    combined[, category_codes[9:16]] <- second[, paste0("v", 1:8)]
    paired[[index]] <- combined
  }
  rows <- do.call(rbind, paired)
  row.names(rows) <- NULL
  rows[["order_index"]] <- seq_len(nrow(rows))   # printed reading order, for parent-child sweeps
  component_sum <- rowSums(rows[, category_codes, drop = FALSE])
  rows[["religion_basis_total"]] <- component_sum
  # displayed printed resident total minus the exact 16-category sum. positive
  # for ordinary rows (collective-household residents and people without housing
  # excluded from the religion basis); negative for the 31 rows where the
  # source's own printed category sums exceed its printed resident total. the PI
  # ruled 2026-07-10 to SHIP these printed values unchanged with disclosure, so
  # the former negative-count hard stop is replaced by a disclosed field. the
  # discrepancies were re-read at 300 dpi and confirmed as source arithmetic in
  # research/countries/ci/reconciliation-verification.md. every other gate below
  # (paired-sheet keys, local-to-national reconciliation, geometry) stays hard.
  rows[["outside_religion_basis_count"]] <- rows[["population_total"]] - component_sum

  rows[["reporting_level"]] <- "aggregate"
  local_candidate <- nzchar(rows[["local_label"]]) &
    !grepl("^(Total|Région|District|Ensemble)", rows[["hierarchy_label"]])
  rows[["reporting_level"]][local_candidate] <- "local"
  rows[["region_name"]] <- NA_character_
  pending <- integer()
  for (index in seq_len(nrow(rows))) {
    if (rows[["reporting_level"]][[index]] == "local") pending <- c(pending, index)
    hierarchy <- rows[["hierarchy_label"]][[index]]
    if (grepl("^Région ", hierarchy) || grepl("^District Autonome ", hierarchy)) {
      if (!length(pending)) stop("region total has no pending local rows: ", hierarchy, call. = FALSE)
      region_name <- sub("^(Région|District Autonome)[[:space:]]+", "", hierarchy)
      rows[["region_name"]][pending] <- region_name
      pending <- integer()
    }
  }
  if (length(pending)) stop("unassigned local rows remain after the final region total", call. = FALSE)

  local <- rows[rows[["reporting_level"]] == "local", , drop = FALSE]
  national <- rows[grepl("^Ensemble C", rows[["hierarchy_label"]]), , drop = FALSE]
  # Table 11 yields 519 leaf sub-prefecture-or-commune rows (corrected from the
  # probe's asserted 510; the 12 ordinary "District du/des/de X" rows and the two
  # "District Autonome" rows are aggregates, not leaves). the 519 leaves partition
  # the country.
  if (nrow(local) != 519L || nrow(national) != 1L) {
    stop("expected 519 local leaf rows and one national row; found ",
         nrow(local), " and ", nrow(national), call. = FALSE)
  }
  # BASIS CONSTANT (conductor ruling 2, 2026-07-10). the product's national
  # religion basis is Table 11's OWN national row: its 16 categories sum to
  # 29,276,658 (outside-basis 112,492 against the printed resident total
  # 29,389,150). the thematic report's Tome 1 Table 2.2 gives 29,276,660
  # ordinary-household residents; the 2-person difference is a between-publications
  # discrepancy, disclosed, not corrected.
  national_basis_tome1_table_2_2 <- 29276660L
  if (national[["religion_basis_total"]][[1L]] != 29276658L ||
      national[["outside_religion_basis_count"]][[1L]] != 112492L) {
    stop("national religion basis is not Table 11's own 16-category sum (29,276,658)", call. = FALSE)
  }

  # ---- documented-discrepancy set (conductor ruling 1): the source's printed
  # arithmetic does not internally reconcile at any level. every printed value
  # ships unchanged; each discrepancy is disclosed and asserted against this
  # pinned, machine-derived record; the builder stops on drift. ----

  # LEVEL 1 (leaf self): 31 rows whose printed 16-category sum exceeds the printed
  # resident total (negative outside-basis), 41 persons in aggregate. re-read at
  # 300 dpi in research/countries/ci/reconciliation-verification.md.
  overrun_rows <- local[local[["outside_religion_basis_count"]] < 0L, , drop = FALSE]
  overrun_rows <- data.frame(
    local_label = overrun_rows[["local_label"]],
    region_name = overrun_rows[["region_name"]],
    printed_resident_total = as.integer(overrun_rows[["population_total"]]),
    category_sum = as.integer(overrun_rows[["religion_basis_total"]]),
    overrun_persons = as.integer(-overrun_rows[["outside_religion_basis_count"]]),
    stringsAsFactors = FALSE
  )
  if (nrow(overrun_rows) != 31L || sum(overrun_rows[["overrun_persons"]]) != 41L) {
    stop("leaf source-arithmetic set drifted: ", nrow(overrun_rows), " row(s), ",
         sum(overrun_rows[["overrun_persons"]]),
         " person(s); expected 31 rows and 41 persons (reconciliation-verification.md)", call. = FALSE)
  }

  # LEVEL 2 (department component sum): printed department total minus the sum of
  # that department's printed child-leaf resident totals. 48 of 110 departments
  # differ by -3..+2 persons; five (ADIAKE, BETTIE, BONON, ODIENNE, SASSANDRA)
  # were image-verified cell-for-cell (reconciliation-verification.md).
  pinned_dept_discrepancy <- c(
    "ABOISSO"=-1L,"ADIAKE"=-1L,"AGBOVILLE"=1L,"AGNIBILEKROU"=-1L,"AKOUPE"=-1L,
    "BETTIE"=-1L,"BLOLEQUIN"=1L,"BOCANDA"=-1L,"BONDOUKOU"=-1L,"BONGOUANOU"=-1L,
    "BONON"=1L,"BOUAFLE"=1L,"BOUNDIALI"=-1L,"BUYO"=-1L,"DABAKALA"=-1L,"DABOU"=1L,
    "DAOUKRO"=-1L,"FERKESSEDOUGOU"=1L,"FRESCO"=1L,"GOHITAFLA"=-1L,"GRAND-LAHOU"=1L,
    "GUIGLO"=-1L,"GUITRY"=1L,"KONG"=1L,"KORO"=-1L,"KOUIBLY"=1L,"KOUTO"=-1L,
    "LAKOTA"=1L,"M'BAHIAKRO"=-1L,"MAN"=-1L,"MANKONO"=1L,"MEAGUI"=1L,"ODIENNE"=-2L,
    "OUANGOLODOUGOU"=-1L,"OUELLE"=1L,"PRIKRO"=1L,"SAN PEDRO"=1L,"SANDEGUE"=1L,
    "SASSANDRA"=-3L,"SEGUELA"=-1L,"SINEMATIALI"=-1L,"SINFRA"=-1L,"TABOU"=2L,
    "TOUBA"=-1L,"TOUMODI"=1L,"TRANSUA"=1L,"YAMOUSSOUKRO"=-1L,"ZUENOULA"=1L
  )
  row_type <- rep("other", nrow(rows))
  row_type[rows[["reporting_level"]] == "local"] <- "leaf"
  row_type[grepl("^Total ", rows[["hierarchy_label"]])] <- "dept_total"
  row_type[grepl("^Total-Ville|^Total-S/P", rows[["hierarchy_label"]])] <- "abidjan_aggregate"
  row_type[grepl("^Région |^District ", rows[["hierarchy_label"]])] <- "region_or_district"
  row_type[grepl("^Ensemble C", rows[["hierarchy_label"]])] <- "national"
  pending <- integer(); dept_name <- character(); dept_printed <- integer(); dept_child <- integer()
  for (i in seq_len(nrow(rows))) {
    ty <- row_type[[i]]
    if (ty == "leaf") pending <- c(pending, i)
    else if (ty == "dept_total") {
      dept_name <- c(dept_name, sub("^Total\\s+", "", rows[["hierarchy_label"]][[i]]))
      dept_printed <- c(dept_printed, rows[["population_total"]][[i]])
      dept_child <- c(dept_child, sum(rows[["population_total"]][pending]))
      pending <- integer()
    } else if (ty %in% c("abidjan_aggregate", "region_or_district", "national")) pending <- integer()
  }
  dept_diff <- dept_printed - dept_child
  observed_dept <- setNames(as.integer(dept_diff[dept_diff != 0L]), dept_name[dept_diff != 0L])
  if (length(observed_dept) != length(pinned_dept_discrepancy) ||
      !setequal(names(observed_dept), names(pinned_dept_discrepancy)) ||
      !all(observed_dept[names(pinned_dept_discrepancy)] == pinned_dept_discrepancy)) {
    stop("department component-sum discrepancy set drifted from the pinned record (48 departments)", call. = FALSE)
  }
  dept_discrepancies <- data.frame(
    department = names(pinned_dept_discrepancy),
    printed_minus_child_sum = unname(pinned_dept_discrepancy), stringsAsFactors = FALSE
  )

  # LEVEL 3 (leaf -> national): the 519 leaf resident totals sum to 6 above the
  # printed national resident total, and the leaf religion-basis sums to 138 below
  # the national religion basis. these are the source's own non-reconciling
  # printed totals; the former exact local-to-national gate is replaced by this
  # pinned documented-tolerance assertion.
  leaf_to_national <- list(
    population_total = sum(local[["population_total"]]) - national[["population_total"]][[1L]],
    religion_basis_total = sum(local[["religion_basis_total"]]) - national[["religion_basis_total"]][[1L]]
  )
  if (leaf_to_national[["population_total"]] != 6L || leaf_to_national[["religion_basis_total"]] != -138L) {
    stop("leaf-to-national reconciliation drifted from the pinned record (+6 residents, -138 basis)", call. = FALSE)
  }

  list(all_rows = rows, local_rows = local, national_row = national,
       overrun_rows = overrun_rows, dept_discrepancies = dept_discrepancies,
       leaf_to_national = leaf_to_national,
       national_basis_tome1_table_2_2 = national_basis_tome1_table_2_2)
}

# count polygon interior rings, which indicate uncovered internal gaps.
interior_ring_count <- function(geometry) {
  shape <- st_geometry(geometry)[[1L]]
  if (inherits(shape, "POLYGON")) return(max(0L, length(shape) - 1L))
  if (inherits(shape, "MULTIPOLYGON")) {
    return(sum(vapply(shape, function(polygon) max(0L, length(polygon) - 1L), integer(1))))
  }
  stop("boundary union is not polygonal", call. = FALSE)
}

# hash each feature's WKB without serialising the R object.
geometry_hashes <- function(layer) {
  vapply(seq_len(nrow(layer)), function(index) {
    digest::digest(st_as_binary(st_geometry(layer)[index], EWKB = TRUE)[[1L]], algo = "sha256", serialize = FALSE)
  }, character(1))
}

# enforce validity, distinctness, overlap, gap, and sliver gates.
validate_boundary <- function(layer, stage) {
  if (nrow(layer) != 510L || any(st_is_empty(layer)) || any(is.na(st_is_valid(layer))) || any(!st_is_valid(layer))) {
    stop(stage, " boundary does not contain 510 valid non-empty features", call. = FALSE)
  }
  hashes <- geometry_hashes(layer)
  if (length(unique(hashes)) != 510L) stop(stage, " boundary geometry hashes are not distinct", call. = FALSE)
  metric <- st_transform(layer, 32630)
  areas <- as.numeric(st_area(metric))
  union <- st_union(metric)
  overlap_sq_m <- sum(areas) - as.numeric(st_area(union))
  if (overlap_sq_m > 1) stop(stage, " boundary overlap exceeds 1 square metre", call. = FALSE)
  gaps <- interior_ring_count(union)
  if (gaps != 0L) stop(stage, " boundary contains an uncovered interior gap", call. = FALSE)
  sliver_threshold_sq_m <- 1000000
  sliver_count <- sum(areas < sliver_threshold_sq_m)
  if (sliver_count != 0L) stop(stage, " boundary contains a feature below the 1 square kilometre sliver threshold", call. = FALSE)
  list(
    hashes = setNames(as.list(hashes), layer[["area_code"]]),
    overlap_sq_m = round(overlap_sq_m, 6),
    interior_gap_count = gaps,
    sliver_threshold_sq_m = sliver_threshold_sq_m,
    sliver_count = sliver_count,
    minimum_feature_area_sq_km = round(min(areas) / 1e6, 4),
    coverage_sq_km = round(as.numeric(st_area(union)) / 1e6, 4)
  )
}

# attach the containing current region to every ADM3 boundary feature.
attach_boundary_regions <- function(local_boundary, region_boundary) {
  region_boundary[["shapeName"]] <- repair_mojibake(region_boundary[["shapeName"]])
  points <- st_point_on_surface(st_transform(local_boundary, 32630))
  regions_metric <- st_transform(region_boundary, 32630)
  within <- st_within(points, regions_metric)
  if (any(lengths(within) != 1L)) stop("an ADM3 feature does not have exactly one ADM2 parent", call. = FALSE)
  local_boundary[["region_name"]] <- region_boundary[["shapeName"]][vapply(within, `[[`, integer(1), 1L)]
  local_boundary
}

# build the census 510-unit local join frame and match it to the 510 ADM3 features.
# ruling 4(b): the Abidjan autonomous city (its 10 census communes) collapses to
# the census's OWN printed "Total-Ville ABIDJAN" aggregate row, which serves the
# single ADM3 "Abidjan" feature; the district's 4 sub-prefectures (Anyama,
# Bingerville, Brofodoumé, Songon) stay as 1:1 leaves. Yamoussoukro needs no
# collapse: each of its 4 census leaves (Attiégouakro, Lolobo, Yamoussoukro,
# Kossou) has a distinct ADM3 feature. that yields 519 - 10 + 1 = 510 join units.
build_boundary <- function(parsed) {
  local_rows <- parsed[["local_rows"]]
  all_rows <- parsed[["all_rows"]]

  city <- all_rows[grepl("^Total-Ville ABIDJAN", all_rows[["hierarchy_label"]]), , drop = FALSE]
  if (nrow(city) != 1L) stop("expected exactly one printed 'Total-Ville ABIDJAN' aggregate row", call. = FALSE)
  city_pos <- city[["order_index"]][[1L]]
  abidjan <- local_rows[local_rows[["region_name"]] == "ABIDJAN", , drop = FALSE]
  communes <- abidjan[abidjan[["order_index"]] < city_pos, , drop = FALSE]   # the 10 city communes
  if (nrow(communes) != 10L) stop("expected 10 Abidjan city communes preceding the printed city aggregate", call. = FALSE)
  city_unit <- city                                # census-printed city aggregate as one join unit
  city_unit[["local_label"]] <- "ABIDJAN"
  city_unit[["region_name"]] <- "ABIDJAN"
  city_unit[["reporting_level"]] <- "local"
  census_rows <- rbind(
    local_rows[!(local_rows[["order_index"]] %in% communes[["order_index"]]), , drop = FALSE],
    city_unit[, names(local_rows), drop = FALSE]
  )
  if (nrow(census_rows) != 510L) stop("Abidjan-collapsed census join frame is not 510 units; got ", nrow(census_rows), call. = FALSE)

  boundary <- st_read(boundary_path, quiet = TRUE, stringsAsFactors = FALSE)
  regions <- st_read(boundary_parent_path, quiet = TRUE, stringsAsFactors = FALSE)
  if (nrow(boundary) != 510L || nrow(regions) != 33L) stop("geoBoundaries feature counts changed", call. = FALSE)
  boundary[["shapeName"]] <- repair_mojibake(boundary[["shapeName"]])
  if (any(grepl("Ã|Â", boundary[["shapeName"]]))) stop("residual mojibake after boundary-name repair", call. = FALSE)
  boundary <- attach_boundary_regions(boundary, regions)
  boundary[["join_name"]] <- normalise_name(boundary[["shapeName"]])
  census_rows[["join_name"]] <- normalise_name(census_rows[["local_label"]])

  # ---- census-to-ADM3 join closure (conductor rulings 2026-07-11) ----
  # after the mojibake repair, the stringi transliteration, and the Abidjan
  # aggregate collapse, 22 census units and 21 ADM3 features do not join 1:1
  # (research/countries/ci/join-residue.csv, committed a6102c4). the conductor
  # ruled on each of the four residue classes under established precedent; the
  # closure below implements those rulings as performed, pinned verifications and
  # stops on any drift. `assign[i]` holds the ADM3 feature index that census join
  # unit i is assigned to (NA until assigned).
  bn <- boundary[["join_name"]]
  cn <- census_rows[["join_name"]]
  reg_c <- region_key(census_rows[["region_name"]])
  reg_b <- region_key(boundary[["region_name"]])
  dup_boundary_names <- unique(bn[duplicated(bn)])   # ADM3 names shared across features
  assign <- rep(NA_integer_, length(cn))

  # STEP 1 (name join, region-disambiguated). assign every census unit whose
  # normalised name matches exactly one ADM3 feature. five ADM3 names repeat
  # (Guézon, Lolobo, N'Guessankro, Nafana, Santa); for those the census unit is
  # matched to the same-name feature in the SAME ADM2 region. four of the five
  # resolve uniquely by region; the two Guézon features share one region (Guémon)
  # and are left for the spatial resolver in step 2.
  for (i in seq_along(cn)) {
    if (cn[[i]] %in% dup_boundary_names) {
      cand <- which(bn == cn[[i]] & reg_b == reg_c[[i]])
      if (length(cand) == 1L) assign[[i]] <- cand
    } else {
      hit <- which(bn == cn[[i]])
      if (length(hit) == 1L) assign[[i]] <- hit
    }
  }

  # STEP 2 (CLASS B duplicate-name Guézon, spatial evidence). the census
  # disambiguates its two Guézon leaves as "GUEZON (DE FACOBLY)" and
  # "GUEZON-DUEKOUE"; the ADM3 frame carries two identical "Guézon" features. per
  # the ruling, assign each census leaf to the Guézon feature adjacent to its
  # department town (Facobly / Duékoué), recording the containment. the adjacency
  # is asserted, so any geometry drift stops the build.
  gz <- which(bn == "GUEZON")
  if (length(gz) != 2L) stop("expected exactly two 'Guézon' ADM3 features", call. = FALSE)
  fac <- which(bn == "FACOBLY"); due <- which(bn == "DUEKOUE")
  if (length(fac) != 1L || length(due) != 1L) stop("Facobly/Duékoué ADM3 anchor features not unique", call. = FALSE)
  touch_fac <- gz[lengths(st_touches(boundary[gz, ], boundary[fac, ])) > 0L]
  touch_due <- gz[lengths(st_touches(boundary[gz, ], boundary[due, ])) > 0L]
  if (length(touch_fac) != 1L || length(touch_due) != 1L || touch_fac == touch_due) {
    stop("Guézon spatial resolution is not one-to-one against Facobly/Duékoué", call. = FALSE)
  }
  ci_gz_fac <- which(cn == "GUEZON")          # "GUEZON (DE FACOBLY)" -> paren stripped
  ci_gz_due <- which(cn == "GUEZON DUEKOUE")
  if (length(ci_gz_fac) != 1L || length(ci_gz_due) != 1L) stop("census Guézon leaves not paired", call. = FALSE)
  assign[[ci_gz_fac]] <- touch_fac
  assign[[ci_gz_due]] <- touch_due
  guezon_evidence <- data.frame(
    census = c(census_rows[["local_label"]][ci_gz_fac], census_rows[["local_label"]][ci_gz_due]),
    adm3 = "Guézon", adm3_feature_index = c(touch_fac, touch_due),
    evidence = c(
      sprintf("ADM3 Guézon feature adjacent to the Facobly sub-prefecture (st_touches); centroid region %s", boundary[["region_name"]][touch_fac]),
      sprintf("ADM3 Guézon feature adjacent to the Duékoué sub-prefecture (st_touches); centroid region %s", boundary[["region_name"]][touch_due])
    ), stringsAsFactors = FALSE
  )

  # structural residue members handled outside the spelling-variant matcher.
  rollup_census_names <- c("BOBI", "DIARABANA")           # CLASS C: 2 leaves -> 1 feature
  rollup_feature <- which(bn == "BOBI DIARABANA")
  nodata_feature <- which(bn == "PARC NATIONAL DE BONA")  # CLASS D: no census unit
  if (length(rollup_feature) != 1L || length(nodata_feature) != 1L) {
    stop("Bobi-Diarabana or Parc National de Bona ADM3 feature not found", call. = FALSE)
  }

  # residue pools after steps 1-2, excluding the structural members.
  unmatched_c <- setdiff(which(is.na(assign)), which(cn %in% rollup_census_names))
  used_f <- assign[!is.na(assign)]
  unused_f <- setdiff(seq_along(bn), c(used_f, rollup_feature, nodata_feature))

  # STEP 3 (CLASS A spelling variants + GAGORE<->Kadéko exhaustion). restrict each
  # unmatched census unit to unused ADM3 features in the SAME ADM2 region, then
  # take the minimum Levenshtein distance (base adist) candidate. the pairing must
  # be mutually unique (an injective assignment that exhausts both pools) and each
  # census unit must have no competing candidate at the winning distance. a pair is
  # CLASS A when it is an orthographic variant (edit distance <= 4, or one name is a
  # prefix of the other); the single non-orthographic pair (GAGORE<->Kadéko) is a
  # CLASS B identity closed by ADM2 containment plus exhaustion (the unique leftover
  # in its region after every other unit matches). Bangladesh nine-name precedent
  # for CLASS A; the census's own department roster for the exhaustion identity.
  strip_space <- function(x) gsub(" ", "", x, fixed = TRUE)
  match_rows <- lapply(unmatched_c, function(i) {
    cand <- unused_f[reg_b[unused_f] == reg_c[[i]]]
    if (!length(cand)) return(NULL)
    d <- as.integer(adist(cn[[i]], bn[cand]))
    o <- order(d)
    best <- cand[o[[1L]]]; best_d <- d[o[[1L]]]
    second_d <- if (length(o) > 1L) d[o[[2L]]] else NA_integer_
    a <- strip_space(cn[[i]]); b <- strip_space(bn[best])
    is_prefix <- startsWith(a, b) || startsWith(b, a)
    data.frame(
      census_index = i, feature_index = best,
      census = census_rows[["local_label"]][i], adm3 = boundary[["shapeName"]][best],
      region = census_rows[["region_name"]][i], edit_distance = best_d,
      competing_margin = if (is.na(second_d)) Inf else second_d - best_d,
      orthographic = (best_d <= 4L) || is_prefix, stringsAsFactors = FALSE
    )
  })
  match_df <- do.call(rbind, match_rows)
  if (is.null(match_df) || nrow(match_df) != length(unmatched_c) ||
      nrow(match_df) != length(unused_f) ||
      anyDuplicated(match_df[["feature_index"]]) > 0L ||
      any(match_df[["competing_margin"]] <= 0L)) {
    stop("Class A / exhaustion closure is not an injective, region-restricted, unique matching", call. = FALSE)
  }
  for (k in seq_len(nrow(match_df))) assign[[match_df[["census_index"]][k]]] <- match_df[["feature_index"]][k]

  class_a <- match_df[match_df[["orthographic"]], , drop = FALSE]
  exhaustion <- match_df[!match_df[["orthographic"]], , drop = FALSE]
  if (nrow(class_a) != 18L || nrow(exhaustion) != 1L ||
      normalise_name(exhaustion[["census"]][[1L]]) != "GAGORE" ||
      normalise_name(exhaustion[["adm3"]][[1L]]) != "KADEKO") {
    stop("closure did not yield 18 Class A spelling variants plus the GAGORE<->Kadéko exhaustion", call. = FALSE)
  }

  # STEP 4 (CLASS C disclosed roll-up). BOBI and DIARABANA are two complete disjoint
  # census leaves that the ADM3 frame carries as one "Bobi-Diarabana" feature. per
  # the Korea 1995 exact-partition and Saint Lucia Castries-summation precedents,
  # both leaves are assigned to the one feature and their complete counts are summed
  # downstream. this is aggregation of complete disjoint units to a coarser frame,
  # not allocation or splitting.
  rollup_ci <- which(cn %in% rollup_census_names)
  if (length(rollup_ci) != 2L) stop("expected exactly two roll-up census leaves (BOBI, DIARABANA)", call. = FALSE)
  assign[rollup_ci] <- rollup_feature

  # closure invariants: every census join unit assigned; every ADM3 feature covered
  # by exactly one census unit except Bobi-Diarabana (two) and Parc National de Bona
  # (zero, the CLASS D no-data feature).
  if (any(is.na(assign))) stop("a census join unit remains unassigned after closure", call. = FALSE)
  feature_census <- lapply(seq_along(bn), function(f) which(assign == f))
  counts <- lengths(feature_census)
  if (sum(counts) != 510L || sum(counts == 0L) != 1L || which(counts == 0L) != nodata_feature ||
      sum(counts == 2L) != 1L || which(counts == 2L) != rollup_feature || sum(counts == 1L) != 508L) {
    stop("post-closure feature coverage is not 508 single + 1 roll-up (2) + 1 no-data (0)", call. = FALSE)
  }

  closure <- list(
    class_a = class_a, exhaustion = exhaustion, guezon = guezon_evidence,
    rollup_feature_name = boundary[["shapeName"]][rollup_feature],
    rollup_census = census_rows[["local_label"]][rollup_ci],
    nodata_feature_name = boundary[["shapeName"]][nodata_feature],
    nodata_feature_index = nodata_feature, rollup_feature_index = rollup_feature
  )

  # per-feature source label(s) for the GeoJSON: the contributing census leaf name(s),
  # or NA for the no-data feature.
  source_label <- vapply(feature_census, function(ci) {
    if (!length(ci)) NA_character_ else paste(census_rows[["local_label"]][ci], collapse = " + ")
  }, character(1))
  boundary[["source_area_name"]] <- source_label
  boundary[["area_code"]] <- boundary[["shapeID"]]
  boundary[["area_name"]] <- boundary[["shapeName"]]
  boundary[["area_unit_id"]] <- paste(boundary_set_id, boundary[["area_code"]], sep = ":")
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- boundary_level
  boundary[["boundary_vintage"]] <- "2021"
  boundary[["boundary_source"]] <- "geoBoundaries CIV ADM3; source CNTIG and OCHA ROWCA"
  boundary[["boundary_licence"]] <- "CC BY 3.0 IGO"
  boundary[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(boundary, 32630))) / 1e6
  # carry the per-feature census index vector (keyed by the stable area_code) so the
  # roll-up sum and the no-data feature survive the sort and the mapshaper round-trip.
  names(feature_census) <- boundary[["area_code"]]
  boundary <- st_transform(st_make_valid(boundary), 4326)
  boundary <- boundary[order(boundary[["area_code"]]), c(
    "area_code", "area_name", "source_area_name", "area_unit_id", "boundary_set_id",
    "boundary_level", "boundary_vintage", "boundary_source", "boundary_licence",
    "land_area_sq_km", "geometry"
  )]
  list(boundary = boundary, census_rows = census_rows,
       feature_census = feature_census, closure = closure)
}

# write and revalidate the topology-preserving simplified boundary.
write_boundary <- function(boundary) {
  source_validation <- validate_boundary(boundary, "source")
  simplification <- mapshaper_simplify_to_cap(
    boundary,
    boundary_out,
    max_bytes = 3000000,
    keep_percentages = c(25, 15, 10, 7.5, 5, 3, 2, 1, 0.5),
    clean_option = NULL
  )
  written <- st_read(boundary_out, quiet = TRUE, stringsAsFactors = FALSE)
  written <- written[order(written[["area_code"]]), ]
  simplified_validation <- validate_boundary(written, "simplified")
  list(
    layer = written,
    simplification = simplification,
    source_validation = source_validation,
    simplified_validation = simplified_validation
  )
}

# return NULL for a scalar missing from a JSON row.
null_if_na <- function(value) if (length(value) == 0L || is.na(value)) NULL else value

# sum the complete disjoint census leaves assigned to one ADM3 feature (CLASS C
# roll-up: BOBI + DIARABANA -> Bobi-Diarabana). aggregation of complete units,
# never allocation; the printed leaf totals are preserved and disclosed.
sum_census_leaves <- function(source) {
  agg <- source[1L, , drop = FALSE]
  for (code in category_codes) agg[[code]] <- sum(source[[code]])
  agg[["population_total"]] <- sum(source[["population_total"]])
  agg[["religion_basis_total"]] <- sum(source[["religion_basis_total"]])
  agg[["outside_religion_basis_count"]] <- sum(source[["outside_religion_basis_count"]])
  agg
}

population_basis_note <- paste(
  "ordinary-household religion basis, derived exactly as the sum of the 16 Table 11 categories;",
  "Ne sait pas and Non declaree remain inside this denominator and outside both headline numerators;",
  "the printed resident total (disclosed in quality_flag and in the CSV companion) additionally includes",
  "collective-household residents and people without housing, so its outside-basis count is positive for",
  "ordinary rows and negative and shipped unchanged for the 31 verified source-arithmetic rows"
)

# build one schema-shaped area row. `source` is NULL for the CLASS D no-data
# feature (Parc National de Bona: an ADM3 polygon that is no census reporting
# unit); `roll_up` marks the CLASS C aggregated feature so the disclosure clause
# names the summed leaves.
build_area_row <- function(source, area, roll_up = NULL) {
  if (is.null(source)) {
    # CLASS D no-data feature: null population and metrics; the popup has-data guard
    # covers it at runtime. disclosed here and in the manifest.
    quality_flag <- paste0(
      "no_data;adm3_feature_is_not_a_census_reporting_unit;",
      "parc_national_de_bona_national_park_has_no_rgph_2021_table_11_row;",
      "boundary_cc_by_3_0_igo"
    )
    return(list(
      country_code = country_code, boundary_set_id = boundary_set_id, boundary_level = boundary_level,
      area_unit_id = area[["area_unit_id"]], area_code = area[["area_code"]], area_name = area[["area_name"]],
      year = 2021L, population_total = NULL, population_total_basis = population_basis_note,
      religious_affiliation_count = NULL, religious_affiliation_percent = NULL,
      no_religion_count = NULL, no_religion_percent = NULL, place_count = NULL,
      places_per_10000_residents = NULL, place_density_per_sq_km = NULL,
      land_area_sq_km = round(area[["land_area_sq_km"]], 4), site_snapshot_date = NULL,
      place_count_basis = NULL, source_dataset_ids = list(boundary_dataset_id),
      quality_flag = quality_flag
    ))
  }
  excluded <- source[["SANS_RELIGION"]] + source[["NE_SAIT_PAS"]] + source[["NON_DECLAREE"]]
  affiliation <- source[["religion_basis_total"]] - excluded
  displayed_resident_total <- as.integer(source[["population_total"]])
  outside_basis <- as.integer(source[["outside_religion_basis_count"]])
  # the area-summary row schema fixes its keys (additionalProperties: false), so
  # the printed-resident-total and outside-basis disclosure travels in the
  # required quality_flag string. every row carries both numbers; rows with a
  # negative outside-basis count carry the shipped-unchanged discrepancy clause
  # citing the verification report. the CSV companion also ships the two numbers
  # as explicit numeric columns.
  quality_flag <- paste0(
    "census_affiliation;ordinary_household_denominator=sum_of_16_categories;",
    "unknown_and_nonresponse_retained_in_denominator;2021_only_local_series;",
    "religious_change_withheld;displayed_resident_total=", displayed_resident_total,
    ";outside_religion_basis_count=", outside_basis,
    ";source_publication_all_rights_reserved_derived_summaries_published_with_attribution_under_pi_approval_2026_07_10;",
    "boundary_cc_by_3_0_igo"
  )
  if (!is.null(roll_up)) {
    quality_flag <- paste0(
      quality_flag,
      ";DISCLOSED_ROLLUP=feature_is_the_sum_of_", length(roll_up), "_complete_census_leaves(",
      paste(roll_up, collapse = "+"), ")_korea1995_saintlucia_precedent"
    )
  }
  if (outside_basis < 0L) {
    quality_flag <- paste0(
      quality_flag,
      ";DISCLOSED_SOURCE_ARITHMETIC=printed_16_category_sum_exceeds_printed_resident_total_by_",
      -outside_basis, "_person(s)_shipped_unchanged_verified_reconciliation_verification_md"
    )
  }
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = area[["area_unit_id"]],
    area_code = area[["area_code"]],
    area_name = area[["area_name"]],
    year = 2021L,
    population_total = as.integer(source[["religion_basis_total"]]),
    population_total_basis = population_basis_note,
    religious_affiliation_count = as.integer(affiliation),
    religious_affiliation_percent = round(100 * affiliation / source[["religion_basis_total"]], 4),
    no_religion_count = as.integer(source[["SANS_RELIGION"]]),
    no_religion_percent = round(100 * source[["SANS_RELIGION"]] / source[["religion_basis_total"]], 4),
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = round(area[["land_area_sq_km"]], 4),
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(census_2021_dataset_id, boundary_dataset_id),
    quality_flag = quality_flag
  )
}

# flatten row objects into the CSV companion.
flatten_rows <- function(rows) {
  na_num <- function(v) if (is.null(v) || length(v) == 0L) NA_real_ else as.numeric(v)   # NULL -> NA for the no-data feature
  do.call(rbind, lapply(rows, function(row) {
    data.frame(
      country_code = row[["country_code"]], boundary_set_id = row[["boundary_set_id"]],
      boundary_level = row[["boundary_level"]], area_unit_id = row[["area_unit_id"]],
      area_code = row[["area_code"]], area_name = row[["area_name"]], year = row[["year"]],
      population_total = na_num(row[["population_total"]]), population_total_basis = row[["population_total_basis"]],
      religious_affiliation_count = na_num(row[["religious_affiliation_count"]]),
      religious_affiliation_percent = na_num(row[["religious_affiliation_percent"]]),
      no_religion_count = na_num(row[["no_religion_count"]]), no_religion_percent = na_num(row[["no_religion_percent"]]),
      place_count = NA_integer_, places_per_10000_residents = NA_real_, place_density_per_sq_km = NA_real_,
      land_area_sq_km = row[["land_area_sq_km"]], site_snapshot_date = NA_character_,
      place_count_basis = NA_character_, source_dataset_ids = paste(unlist(row[["source_dataset_ids"]]), collapse = "|"),
      quality_flag = row[["quality_flag"]], stringsAsFactors = FALSE
    )
  }))
}

# describe the source datasets carried by the public product.
source_datasets <- function() {
  list(
    list(
      source_dataset_id = census_2021_dataset_id,
      name = "RGPH 2021 Table 11: Répartition de la population résidente selon la religion",
      provider = "Institut National de la Statistique (INS), now succeeded by Agence Nationale de la Statistique (ANStat)",
      url = census_2021_url,
      retrieval_date = retrieval_date,
      local_path = census_2021_path,
      licence = list(
        name = "No named open reuse licence; ANStat footer records verbatim \"Tous droits Reservés\". Derived summaries published with attribution under PI approval 2026-07-10 (raw PDFs git-ignored).",
        url = anstat_site_url,
        attribution = "Source: Institut National de la Statistique (INS) / Agence Nationale de la Statistique (ANStat), RGPH 2021"
      ),
      citation = "Institut National de la Statistique, RGPH 2021 résultats globaux, Table 11.",
      access_limits = "The rp2021.anstat.ci TLS chain did not validate locally; retrieval used the exact HTTPS URL with certificate verification disabled and records that condition.",
      redistribution_limits = "The raw source PDF remains in the git-ignored cache. Only derived category summaries are published, with INS/ANStat attribution, under PI approval 2026-07-10 (summaries-not-raw-data stance, Iran licence-encoding precedent).",
      notes = "Table 11 prints 519 local leaf rows (including the ten Abidjan communes, joined through the census's printed Total-Ville ABIDJAN aggregate) and department, region, district, and national totals across paired sheets. The 16 religion categories sum to the ordinary-household basis; the displayed resident total additionally includes collective-household residents and people without housing. In 31 local rows the printed category sum exceeds the printed resident total by one or two people; these source-arithmetic discrepancies are shipped unchanged and disclosed (reconciliation-verification.md)."
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "geoBoundaries CIV ADM3 (510 departments in metadata; local units in the source geography)",
      provider = "geoBoundaries; source Comité National de Télédétection et d'Information Géographique (CNTIG) and OCHA ROWCA",
      url = boundary_url,
      retrieval_date = retrieval_date,
      local_path = boundary_path,
      licence = list(
        name = "Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO)",
        url = boundary_meta_url,
        attribution = "geoBoundaries; CNTIG and OCHA ROWCA"
      ),
      citation = "geoBoundaries CIV ADM3, boundary ID CIV-ADM3-97208781; source CNTIG and OCHA ROWCA.",
      access_limits = NULL,
      redistribution_limits = "The simplified derivative retains source and CC BY 3.0 IGO attribution in every feature.",
      notes = "The release metadata reports 510 units, 2021 represented year, and CC BY 3.0 IGO. The metadata's canonical label is Departments, while the 510 names align exhaustively with the census sub-prefecture-or-commune rows."
    )
  )
}

# declare the three public indicators.
indicators <- function() {
  denominator_note <- paste(
    "The denominator is each local row's ordinary-household religion basis, derived exactly as the sum of the 16 Table 11 categories.",
    "Does-not-know and not-declared responses remain in the denominator."
  )
  list(
    list(
      indicator_id = "population_total", label = "Census population",
      description = "Ordinary-household population represented in the local unit's RGPH 2021 religion categories.",
      unit = "count", denominator_indicator_id = NULL, method = "Exact sum of the 16 printed Table 11 religion categories.",
      temporal_coverage = "2021", spatial_coverage = "510 sub-prefecture-or-commune reporting units.",
      quality_notes = denominator_note
    ),
    list(
      indicator_id = "religious_affiliation_percent", label = "Religious affiliation %",
      description = "Share of residents assigned to a named religion category.", unit = "percent",
      denominator_indicator_id = "population_total",
      method = "100 * (ordinary-household religion basis - no religion - does not know - not declared) / ordinary-household religion basis.",
      temporal_coverage = "2021", spatial_coverage = "510 sub-prefecture-or-commune reporting units.",
      quality_notes = paste(denominator_note, "This is a 2021-only local series; no change metric is released.")
    ),
    list(
      indicator_id = "no_religion_percent", label = "No religion %",
      description = "Share of residents in the source's Sans réligion category.", unit = "percent",
      denominator_indicator_id = "population_total", method = "100 * Sans réligion / ordinary-household religion basis.",
      temporal_coverage = "2021", spatial_coverage = "510 sub-prefecture-or-commune reporting units.",
      quality_notes = denominator_note
    )
  )
}

# declare the two released map layers with rights and comparability disclosures.
visual_layers <- function() {
  disclosure <- paste(
    "2021 census affiliation only. Change is withheld because no comparable local earlier wave is pinned.",
    "The derived full-table product is staged for ANStat rights review. Boundary: CC BY 3.0 IGO."
  )
  list(
    list(
      visual_layer_id = "ci-local-religious-affiliation", label = "Religious affiliation %",
      description = "RGPH 2021 named-religion share by local reporting unit.", layer_type = "choropleth",
      indicator_ids = list("religious_affiliation_percent"), geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "ordinary-household religion basis in Table 11"),
      colour_scale = "sequential", time_control = "year_selector", aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag", default_visibility = TRUE, notes = disclosure
    ),
    list(
      visual_layer_id = "ci-local-no-religion", label = "No religion %",
      description = "RGPH 2021 no-religion share by local reporting unit.", layer_type = "choropleth",
      indicator_ids = list("no_religion_percent"), geometry_unit_type = "area_unit",
      legend = list(unit = "percent", denominator = "ordinary-household religion basis in Table 11"),
      colour_scale = "sequential", time_control = "year_selector", aggregation_rule = "reported area value",
      uncertainty_display = "quality_flag", default_visibility = FALSE, notes = disclosure
    )
  )
}

# count rows or features in a generated product.
row_count_file <- function(path) {
  extension <- tolower(tools::file_ext(path))
  if (extension == "csv") return(nrow(read.csv(path, check.names = FALSE)))
  if (extension == "geojson") return(nrow(st_read(path, quiet = TRUE)))
  if (extension == "json") return(length(fromJSON(path, simplifyVector = FALSE)[["rows"]]))
  NA_integer_
}

# describe one tracked generated output (DurableFile shape; storage_provider must
# be one of the schema enum values, so an in-repo file is "other").
manifest_file_record <- function(path, content, licence_status_value) {
  ext <- tools::file_ext(path)
  count <- row_count_file(path)
  record <- list(
    uri = paste0("repo:", path), storage_provider = "other",
    format = ext, bytes = as.integer(file_bytes(path)), sha256 = sha256_file(path),
    content = content, privacy = "public", licence_status = licence_status_value
  )
  if (ext == "geojson") record[["feature_count"]] <- as.integer(count) else record[["row_count"]] <- as.integer(count)
  record
}

# describe one cached input with URL, retrieval condition, and SHA-256.
raw_source_record <- function(path, url, format, dataset_id, used, periods, notes) {
  metadata <- read_retrieval_meta(path)
  list(
    uri = path, url = url, format = format, bytes = file_bytes(path), sha256 = sha256_file(path),
    retrieved_at = metadata[["retrieved_at"]], retrieval_method = metadata[["method"]],
    tls_verification = metadata[["tls_verification"]], source_dataset_id = dataset_id,
    used_in_public_product = used, periods = periods, notes = notes
  )
}

# convert the 2021 source category frame into manifest mapping records.
category_mapping_2021 <- function() {
  lapply(seq_along(category_codes), function(index) {
    list(
      source_code = category_codes[[index]], source_name_fr = source_labels_fr[[index]],
      source_display_en = display_labels_en[[index]], product_role = category_roles[[index]]
    )
  })
}

fetch_file(census_2021_url, census_2021_path, insecure = TRUE)
fetch_file(census_2021_tome1_url, census_2021_tome1_path, insecure = TRUE)
fetch_file(census_2014_url, census_2014_path, insecure = TRUE)
fetch_file(census_1998_url, census_1998_path, insecure = TRUE)
fetch_file(boundary_meta_url, boundary_meta_path)
fetch_file(boundary_parent_meta_url, boundary_parent_meta_path)
fetch_file(boundary_url, boundary_path)
fetch_file(boundary_parent_url, boundary_parent_path)

boundary_metadata <- fromJSON(boundary_meta_path, simplifyVector = FALSE)
parent_metadata <- fromJSON(boundary_parent_meta_path, simplifyVector = FALSE)
if (boundary_metadata[["boundaryID"]] != "CIV-ADM3-97208781" ||
    boundary_metadata[["boundaryLicense"]] != "Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO)" ||
    boundary_metadata[["admUnitCount"]] != "510") {
  stop("geoBoundaries ADM3 release metadata changed", call. = FALSE)
}
if (parent_metadata[["admUnitCount"]] != "33" ||
    parent_metadata[["boundaryLicense"]] != "Creative Commons Attribution 4.0 International (CC BY 4.0)") {
  stop("geoBoundaries ADM2 release metadata changed", call. = FALSE)
}

parsed <- parse_2021_table(census_2021_path)
boundary_build <- build_boundary(parsed)
boundary_result <- write_boundary(boundary_build[["boundary"]])

census_rows <- boundary_build[["census_rows"]]
feature_census <- boundary_build[["feature_census"]]     # per area_code: contributing census row indices
closure <- boundary_build[["closure"]]
boundary_layer <- boundary_result[["layer"]]

# resolve one boundary feature to its contributing census source (NULL for the
# CLASS D no-data feature; a summed row for the CLASS C roll-up feature).
feature_source <- function(area_code) {
  ci <- feature_census[[area_code]]
  if (length(ci) == 0L) return(NULL)
  if (length(ci) == 1L) return(census_rows[ci, , drop = FALSE])
  sum_census_leaves(census_rows[ci, , drop = FALSE])
}
rows <- lapply(seq_len(nrow(boundary_layer)), function(index) {
  area <- boundary_layer[index, ]
  ci <- feature_census[[area[["area_code"]]]]
  roll_up <- if (length(ci) > 1L) census_rows[["local_label"]][ci] else NULL
  build_area_row(feature_source(area[["area_code"]]), area, roll_up = roll_up)
})

area_summary <- list(
  schema_version = "0.2.0", generated_at = stamp, generated_by = script_id,
  country_code = country_code,
  boundary_set = list(
    boundary_set_id = boundary_set_id, country_code = country_code, level = boundary_level,
    vintage = "2021", source_dataset_id = boundary_dataset_id
  ),
  site_snapshot = list(
    source_dataset_id = NULL, snapshot_date = NULL,
    basis = "no governed Côte d'Ivoire place-of-worship snapshot is included",
    notes = "The product contains census-affiliation metrics only; place-density metrics remain null."
  ),
  source_datasets = source_datasets(), indicators = indicators(), visual_layers = visual_layers(), rows = rows
)
write_json(area_summary, summary_json_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
# ship the printed resident total and outside-basis count as explicit numeric
# CSV columns (the JSON row schema is closed, so these ride in quality_flag there).
# both are printed values shipped unchanged; the outside-basis count is negative
# and never clamped for the 31 verified source-arithmetic rows.
disclosure_df <- do.call(rbind, lapply(seq_len(nrow(boundary_layer)), function(index) {
  src <- feature_source(boundary_layer[["area_code"]][[index]])
  data.frame(
    displayed_resident_total = if (is.null(src)) NA_integer_ else as.integer(src[["population_total"]]),
    outside_religion_basis_count = if (is.null(src)) NA_integer_ else as.integer(src[["outside_religion_basis_count"]]),
    stringsAsFactors = FALSE
  )
}))
write.csv(cbind(flatten_rows(rows), disclosure_df), summary_csv_out, row.names = FALSE, na = "")

# ---- ACCOUNTING GATE (conductor 2026-07-11). every one of the 519 census leaf
# rows must be represented exactly once, and the closure must conserve every census
# person: no leaf silently dropped, no unit split or allocated. ----
leaf_count <- nrow(parsed[["local_rows"]])                                  # 519 printed leaves
city_agg <- parsed[["all_rows"]][grepl("^Total-Ville ABIDJAN", parsed[["all_rows"]][["hierarchy_label"]]), , drop = FALSE]
# the 510 join units are 509 non-commune leaves + the printed Abidjan city
# aggregate; the 519 leaves are those 509 plus the 10 Abidjan city communes.
# representation is exact when every join unit is placed and the closure only
# re-labels and aggregates complete units (no split, no allocation).
assigned_join_units <- sum(lengths(feature_census))                         # 510 join units all placed
if (assigned_join_units != 510L) stop("accounting gate: not all 510 census join units are placed", call. = FALSE)
if (leaf_count != 519L) stop("accounting gate: census leaf count is not 519", call. = FALSE)
# value conservation. shipped religion-basis = sum over the 509 data features. by
# construction this equals (sum of 519 leaf bases) - (10 Abidjan commune bases) +
# (printed Total-Ville ABIDJAN base), because the closure only re-labels and
# aggregates complete units; nothing is dropped or duplicated.
shipped_basis <- sum(vapply(seq_len(nrow(boundary_layer)), function(index) {
  src <- feature_source(boundary_layer[["area_code"]][[index]]); if (is.null(src)) 0L else as.integer(src[["religion_basis_total"]])
}, integer(1)))
abidjan_local <- parsed[["local_rows"]][parsed[["local_rows"]][["region_name"]] == "ABIDJAN", , drop = FALSE]
commune_basis <- sum(abidjan_local[["religion_basis_total"]][abidjan_local[["order_index"]] < city_agg[["order_index"]][[1L]]])
expected_shipped_basis <- sum(parsed[["local_rows"]][["religion_basis_total"]]) - commune_basis + city_agg[["religion_basis_total"]][[1L]]
if (shipped_basis != expected_shipped_basis) {
  stop("accounting gate: shipped religion basis is not conserved through the closure", call. = FALSE)
}
# the national religion basis is Table 11's own 16-category sum (29,276,658). the
# shipped total sits below it by exactly the source's OWN pinned, image-verified,
# documented discrepancy: the 519 leaves sum 138 below national, and the printed
# Abidjan city aggregate exceeds its 10 communes by 2, so shipped = national - 136.
# every printed value ships unchanged; the residual is disclosed, never tuned away.
national_basis <- parsed[["national_row"]][["religion_basis_total"]][[1L]]     # 29,276,658 (pinned upstream)
shipped_vs_national <- national_basis - shipped_basis
if (shipped_basis != 29276522L || shipped_vs_national != 136L) {
  stop("accounting gate: shipped basis / national residual drifted from the pinned record (29,276,522; -136)", call. = FALSE)
}
accounting_gate <- list(
  census_leaf_rows = leaf_count,
  join_units_placed = assigned_join_units,
  data_features = as.integer(sum(lengths(feature_census) >= 1L)),
  nodata_features = as.integer(sum(lengths(feature_census) == 0L)),
  rolled_up_features = as.integer(sum(lengths(feature_census) == 2L)),
  representation = "519 census leaves represented exactly once: 507 one-to-one, 2 rolled up into Bobi-Diarabana, 10 Abidjan communes carried by the printed Total-Ville ABIDJAN aggregate; 509 data features plus 1 no-data feature (Parc National de Bona) = 510",
  shipped_religion_basis = shipped_basis,
  national_religion_basis = national_basis,
  shipped_minus_national = -shipped_vs_national,
  residual_decomposition = "leaf-to-national -138 (source arithmetic, image-verified) + Abidjan city-aggregate re-tabulation +2 = -136; every printed value shipped unchanged (documented-discrepancy ruling)"
)

national <- parsed[["national_row"]][1L, ]
national_affiliation <- national[["religion_basis_total"]] - national[["SANS_RELIGION"]] -
  national[["NE_SAIT_PAS"]] - national[["NON_DECLAREE"]]
# national category totals from Table 11's own national row (the product basis),
# not the leaf sums (which sit 138 below by the disclosed source residual).
category_totals <- setNames(lapply(category_codes, function(code) as.integer(national[[code]])), category_codes)

raw_sources <- list(
  raw_source_record(census_2021_path, census_2021_url, "pdf", census_2021_dataset_id, TRUE, "2021", "Table 11 supplies every released row in the public product."),
  raw_source_record(census_2021_tome1_path, census_2021_tome1_url, "pdf", census_2021_tome1_dataset_id, FALSE, "1975, 1988, 1998, 2021", "Table 4.9 supplies the retrospective national household-population frame and category breaks."),
  raw_source_record(census_2014_path, census_2014_url, "pdf", census_2014_dataset_id, FALSE, "2014", "Table 2.11 supplies the 2014 national religion counts by nationality."),
  raw_source_record(census_1998_path, census_1998_url, "pdf", census_1998_dataset_id, FALSE, "1975, 1988, 1998", "Tables 3.1-3.9 document the 1998 construct, category frame, national counts, and rounded old-region percentages."),
  raw_source_record(boundary_meta_path, boundary_meta_url, "json", boundary_dataset_id, TRUE, "2021", "Release metadata verifies the exact CC BY 3.0 IGO licence and 510-unit count."),
  raw_source_record(boundary_path, boundary_url, "geojson", boundary_dataset_id, TRUE, "2021", "CIV ADM3 source geometry used for the shipped boundary."),
  raw_source_record(boundary_parent_meta_path, boundary_parent_meta_url, "json", boundary_parent_dataset_id, TRUE, "2016", "Release metadata verifies the CC BY 4.0 parent-region layer."),
  raw_source_record(boundary_parent_path, boundary_parent_url, "geojson", boundary_parent_dataset_id, TRUE, "2016", "CIV ADM2 geometry used only to disambiguate repeated local names by containing region.")
)

# record the tree state the build ran against; the outputs stay uncommitted.
build_git_commit <- tryCatch({
  value <- suppressWarnings(system2("git", c("rev-parse", "--short=7", "HEAD"), stdout = TRUE, stderr = FALSE))
  if (length(value) == 1L && grepl("^[a-f0-9]{7,40}$", value)) value else NULL
}, error = function(e) NULL)

# the 31 ruled-disclosure rows, built from the parse and cited to the verification report.
overrun <- parsed[["overrun_rows"]]
disclosed_source_discrepancies <- lapply(seq_len(nrow(overrun)), function(i) {
  list(
    local_label = overrun[["local_label"]][[i]],
    region_name = overrun[["region_name"]][[i]],
    printed_resident_total = overrun[["printed_resident_total"]][[i]],
    printed_category_sum = overrun[["category_sum"]][[i]],
    overrun_persons = overrun[["overrun_persons"]][[i]]
  )
})

# join-closure evidence for the manifest (conductor rulings 2026-07-11). the residue
# (research/countries/ci/join-residue.csv, committed a6102c4) is closed under four
# classes; each pair below carries the evidence the ruling requires.
inf_to_null <- function(x) if (is.infinite(x)) NULL else as.integer(x)
class_a_records <- lapply(seq_len(nrow(closure[["class_a"]])), function(i) {
  r <- closure[["class_a"]][i, ]
  list(census_leaf = r[["census"]], adm3_feature = r[["adm3"]], adm2_region = r[["region"]],
       edit_distance = as.integer(r[["edit_distance"]]),
       next_candidate_margin = inf_to_null(r[["competing_margin"]]),
       basis = "orthographic spelling variant: same ADM2 region, unique mutual-nearest match, no competing candidate (Bangladesh nine-name precedent)")
})
exhaustion_records <- lapply(seq_len(nrow(closure[["exhaustion"]])), function(i) {
  r <- closure[["exhaustion"]][i, ]
  list(census_leaf = r[["census"]], adm3_feature = r[["adm3"]], adm2_region = r[["region"]],
       edit_distance = as.integer(r[["edit_distance"]]),
       basis = "ADM2 containment plus exhaustion: the sole unmatched census leaf and the sole unused ADM3 feature left in the region after every other unit matches; the census department roster confirms identity")
})
guezon_records <- lapply(seq_len(nrow(closure[["guezon"]])), function(i) {
  r <- closure[["guezon"]][i, ]
  list(census_leaf = r[["census"]], adm3_feature = r[["adm3"]], evidence = r[["evidence"]],
       basis = "duplicate-name ADM3 pair sharing one ADM2 region (Guémon); assigned by centroid adjacency to the census department town (spatial containment)")
})
join_closure <- list(
  ruling = "conductor 2026-07-11: close the residue under four classes; performed verifications only, no invented concordance, roll-up only where ruled; the builder stops on any drift",
  residue_record = "research/countries/ci/join-residue.csv (22 census units, 21 unused ADM3 features, plus hidden duplicate-name collisions surfaced and resolved by region)",
  class_a_spelling_variants = list(count = nrow(closure[["class_a"]]), precedent = "Bangladesh nine-name identification", pairs = class_a_records),
  class_b_duplicate_and_exhaustion = list(
    guezon = list(precedent = "department/region spatial containment", pairs = guezon_records),
    gagore_kadeko = list(precedent = "ADM2 containment plus exhaustion of the department roster", pairs = exhaustion_records)
  ),
  class_c_rollup = list(
    precedent = "Korea 1995 exact-partition; Saint Lucia Castries-summation",
    feature = closure[["rollup_feature_name"]], summed_census_leaves = as.list(closure[["rollup_census"]]),
    note = "two complete disjoint census leaves summed into one coarser ADM3 feature; aggregation of complete units, not allocation; each leaf's printed total is carried in the feature's row disclosure"),
  class_d_no_data = list(
    feature = closure[["nodata_feature_name"]],
    note = "ADM3 national-park polygon that is no census reporting unit; ships with null population and metrics; the popup has-data guard covers it at runtime"),
  duplicate_name_region_disambiguation = "five ADM3 names repeat (Guézon, Lolobo, N'Guessankro, Nafana, Santa); four resolve by ADM2-region agreement between the census unit and the same-named feature, and Guézon (both features in Guémon) resolves by spatial adjacency"
)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:ci-census-religion:ci:2021:ins-geoboundaries",
  dataset_id = "ci-census-religion:ci:2021:ins-geoboundaries",
  dataset_version_id = paste0("ci-census-religion:ci:2021:ins-geoboundaries:", substr(sha256_file(summary_json_out), 1L, 12L)),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "ci-census-religion", dataset_role = "public_product",
  scope = list(
    level = "country", country_codes = list(country_code), snapshot_date = NULL,
    snapshot_anchor = NULL, pipeline_stage = "staged"
  ),
  created_at = stamp, created_by = script_id,
  pipeline = list(
    script = script_id, git_commit = build_git_commit, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation", shipped_wave = 2021L,
      shipped_geography = "510 geoBoundaries CIV ADM3 features (509 with 2021 census data plus 1 no-data national-park polygon), from 519 RGPH Table 11 sub-prefecture-or-commune leaves closed to the ADM3 frame",
      denominator = "ordinary-household religion basis, derived exactly as the sum of each row's 16 printed categories",
      nonresponse_rule = "Ne sait pas (does not know) and Non declaree (not declared) remain inside the denominator and outside both headline numerators",
      resident_population_residual_rule = paste(
        "the displayed printed resident total ships unchanged as a disclosure field (in each area-summary row's quality_flag and as an explicit CSV column);",
        "its outside-basis count is the printed resident total minus the exact 16-category sum, positive for ordinary rows (collective-household residents and people without housing) and negative for the verified source-arithmetic rows;",
        "the negative counts are disclosed unchanged and never clamped"
      ),
      documented_discrepancy_ruling = paste(
        "PI ruling 2026-07-10 (research/build-queue.md): SHIP with the documented-discrepancy treatment.",
        "In 31 of the 519 printed local leaves the source's own 16-category sum exceeds the printed resident total by one or two people (41 persons in aggregate);",
        "48 of 110 departments differ from the sum of their child leaves by -3..+2; and the 519 leaves sum 6 above the national resident total and 138 below the national religion basis.",
        "All levels were re-read from 300 dpi page renders and confirmed as source arithmetic, not extraction error, in research/countries/ci/reconciliation-verification.md.",
        "The map ships the published values unchanged; the former negative-outside-basis hard stop is replaced by a disclosed field, following the Israel residuals precedent."
      ),
      licence_ruling = paste(
        "PI ruling 2026-07-10: publish derived summaries (not raw source tables) with attribution to INS/ANStat under PI approval, notwithstanding the ANStat all-rights-reserved footer.",
        "This follows the RO/SK/CA summaries-not-raw-data stance; Iran is the licence-encoding precedent. Raw PDFs remain git-ignored."
      ),
      change_rule = "religious_change withheld because the only shipped local wave is 2021 and older published frames are not comparable",
      pdf_extraction = "poppler pdftotext -layout; paired sheets joined by identical row keys",
      category_mappings = list(`2021` = category_mapping_2021()),
      historical_publication_matrix = list(
        `1988` = list(national = "exact counts republished in RGPH 2021 Tome 1 Table 4.9 and percentages in RGPH 1998 Volume IV Tome 1 Table 3.2", subnational = "no official online subnational religion table pinned"),
        `1998` = list(national = "exact counts in RGPH 2021 Tome 1 Table 4.9", subnational = "rounded percentages for the old regional frame in RGPH 1998 Volume IV Tome 1 Table 3.6; not shipped"),
        `2014` = list(national = "exact counts in RGPH 2014 synthesis Table 2.11", subnational = "no subnational religion table in the verified synthesis volume"),
        `2021` = list(national = "exact Table 11 national row", subnational = "exact local, department, region, and district rows in Table 11; 519 local leaves closed to 510 ADM3 features")
      ),
      join_closure = join_closure,
      accounting_gate = accounting_gate,
      boundary_simplification = boundary_result[["simplification"]],
      boundary_validation = list(
        source = boundary_result[["source_validation"]],
        simplified = boundary_result[["simplified_validation"]],
        licence_metadata_status = "passed", licence = boundary_metadata[["boundaryLicense"]]
      ),
      disclosed_source_discrepancies = list(
        rule = "shipped unchanged; printed 16-category sum exceeds printed resident total; negative outside-basis count disclosed and never clamped",
        verified_against = "research/countries/ci/reconciliation-verification.md (300 dpi image readback, all 31 confirmed source arithmetic)",
        leaf_row_count = nrow(overrun), aggregate_overrun_persons = sum(overrun[["overrun_persons"]]),
        department_component_sum_discrepancies = 48L, department_signed_sum = -6L, department_absolute_sum = 52L,
        leaf_to_national_resident_residual = 6L, leaf_to_national_basis_residual = -138L,
        rows = disclosed_source_discrepancies
      ),
      printed_row_reconciliation = list(
        status = "passed_with_disclosed_source_discrepancies", printed_rows = nrow(parsed[["all_rows"]]), local_leaves = nrow(parsed[["local_rows"]]),
        category_count = length(category_codes), exact_row_matches = nrow(parsed[["all_rows"]]),
        leaves_with_positive_outside_basis = nrow(parsed[["local_rows"]]) - nrow(overrun),
        leaves_with_disclosed_negative_outside_basis = nrow(overrun),
        source_stated_national_basis = list(
          ordinary_household_population = 29276660L,
          collective_household_population = 106743L,
          people_without_housing = 5747L,
          full_resident_population = 29389150L,
          table_11_national_16_category_sum = 29276658L,
          between_publication_basis_difference = 2L
        )
      ),
      national_2021 = list(
        resident_population_total = national[["population_total"]],
        religion_basis_total = national[["religion_basis_total"]],
        outside_religion_basis_count = national[["outside_religion_basis_count"]],
        religious_affiliation_count = national_affiliation,
        no_religion_count = national[["SANS_RELIGION"]], does_not_know_count = national[["NE_SAIT_PAS"]],
        not_declared_count = national[["NON_DECLAREE"]], category_totals = category_totals
      ),
      join_coverage = list(
        census_leaves = 519L, join_units = 510L, adm3_features = 510L,
        data_features = 509L, no_data_features = 1L, rolled_up_features = 1L,
        one_to_one_matches = 508L, unmatched_census_units = list(), unresolved_features = list()
      ),
      source_datasets = source_datasets(),
      construct_notes = list(
        "The construct is census affiliation. It does not measure belief, practice, attendance, or registered membership.",
        "French source category names remain verbatim in the manifest and in each area-summary row's source labels, with separate English display labels.",
        "The 2021 percentages use the ordinary-household religion basis, derived exactly as the sum of the 16 Table 11 categories. Ne sait pas (does not know) and Non declaree (not declared) remain inside this denominator and outside both headline numerators.",
        "Table 11 displays a full resident total of 29,389,150, while its national religion categories sum to 29,276,658. RGPH 2021 Tome 1 Table 2.2 gives 29,276,660 ordinary-household residents (a 2-person between-publication difference, disclosed and not corrected), 106,743 collective-household residents, and 5,747 people without housing. The product uses the exact 16-category sum as its denominator and ships the displayed resident total as a disclosure field.",
        "The source's printed arithmetic does not internally reconcile at any level (31 leaf overruns of 41 persons; 48 departments differing by -3..+2; the 519 leaves 6 above the national resident total and 138 below the national religion basis); every printed value ships unchanged and each level is disclosed (reconciliation-verification.md).",
        "The 519 RGPH Table 11 leaves are closed to the 510 ADM3 features: the 10 Abidjan communes carry the printed Total-Ville ABIDJAN aggregate, 18 spelling variants and one exhaustion identity (GAGORE=Kadeko) close the residue, BOBI and DIARABANA roll up into the one Bobi-Diarabana feature, and Parc National de Bona ships no-data (see pipeline.parameters.join_closure).",
        "No religious_change field is released because only the 2021 local wave ships. The 1988, 1998, and 2014 publications remain national context only."
      ),
      deferred_sources = list(
        list(source_dataset_id = "ins-rgph-1988-original-religion-tables", status = "not_located_online", reason = "No original official online 1988 religion volume was pinned; official 1998 and 2021 volumes republish the 1988 national frame. National context only."),
        list(source_dataset_id = "ins-rgph-1998-old-region-religion", status = "not_shipped", reason = "Table 3.6 publishes rounded percentages on the historical regional frame; no licensed historical geometry and exact regional count table were pinned. National context only."),
        list(source_dataset_id = "ins-rgph-2014-subnational-religion", status = "not_located", reason = "The verified synthesis volume publishes religion nationally in Table 2.11; no subnational religion table was pinned. National context only."),
        list(source_dataset_id = "ins-rgph-2021-derived-full-table-rights", status = "published_under_pi_approval", reason = "ANStat records \"Tous droits Reservés\" and gives no specific reuse permission. PI ruling 2026-07-10 authorises publication of derived summaries (not raw source tables) with INS/ANStat attribution, per the RO/SK/CA summaries-not-raw-data stance and the Iran licence-encoding precedent.")
      ),
      raw_sources = raw_sources,
      derived_outputs = list(
        list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), notes = "510 area rows (509 with data, 1 no-data) for 2021."),
        list(uri = paste0("repo:", summary_csv_out), sha256 = sha256_file(summary_csv_out), notes = "Flattened CSV companion with the printed resident total and outside-basis disclosure columns."),
        list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out), notes = "510 simplified ADM3 features with CC BY 3.0 IGO attribution.")
      ),
      local_cache_hint = "Raw PDFs, metadata, and source geometry are cached under data/raw/ci_census/ and remain git-ignored.",
      raw_cache_durable_uris = list("gs://pow-research-data/raw_sources/ci_census/")
    ),
    software_versions = list(
      R = as.character(getRversion()), sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")), digest = as.character(packageVersion("digest")),
      pdftotext = "poppler pdftotext (system)", mapshaper = "scripts/lib/simplify_boundary.R"
    )
  ),
  source = list(
    provider = "Institut National de la Statistique (INS), succeeded by Agence Nationale de la Statistique (ANStat); geoBoundaries",
    source_dataset_ids = list(census_2021_dataset_id, census_2021_tome1_dataset_id, census_2014_dataset_id, census_1998_dataset_id, boundary_dataset_id, boundary_parent_dataset_id),
    source_urls = list(census_2021_url, census_2021_tome1_url, census_2014_url, census_1998_url, anstat_site_url, anstat_api_docs_url, boundary_meta_url, boundary_url, boundary_parent_meta_url, boundary_parent_url),
    retrieved_at = stamp,
    licence = paste(
      "No named open reuse licence was located for the RGPH census publications; the current ANStat site footer records verbatim \"Tous droits Reservés\".",
      "Under PI approval 2026-07-10 the product publishes derived category summaries (not raw source tables) with attribution to INS/ANStat, following the RO/SK/CA summaries-not-raw-data stance (Iran licence-encoding precedent).",
      "The raw census PDFs remain in the git-ignored cache. The shipped boundary is CC BY 3.0 IGO, verified in the release metadata."
    ),
    citation = "INS/ANStat RGPH 2021 Base Table 11 (with 1988, 1998, and 2014 publications as national context); geoBoundaries CIV ADM3 (CNTIG and OCHA ROWCA)."
  ),
  input_manifests = list(),
  durable_files = list(
    manifest_file_record(summary_json_out, "Cote d'Ivoire 2021 local census-affiliation area summary (510 features; 509 with data, 1 no-data); derived summaries published with INS/ANStat attribution under PI approval 2026-07-10.", "needs_review"),
    manifest_file_record(summary_csv_out, "Flattened Cote d'Ivoire 2021 local census-affiliation rows with the printed resident total and outside-basis disclosure columns.", "needs_review"),
    manifest_file_record(boundary_out, "Simplified geoBoundaries CIV ADM3 local geometry (510 features), CC BY 3.0 IGO.", "accepted")
  ),
  stats = list(
    census_leaf_rows = 519L, join_units = 510L, adm3_features = 510L,
    data_features = 509L, no_data_features = 1L, rolled_up_features = 1L,
    area_summary_rows = length(rows), shipped_wave_count = 1L,
    printed_rows_validated = nrow(parsed[["all_rows"]]),
    national_religion_basis = national[["religion_basis_total"]],
    shipped_religion_basis = shipped_basis,
    shipped_minus_national_basis = -shipped_vs_national,
    distinct_geometry_hashes = length(unique(unlist(boundary_result[["simplified_validation"]][["hashes"]])))
  ),
  local_cache_hint = "data/raw/ci_census/ (git-ignored; every cached source listed with URL, bytes, and SHA-256 in pipeline.parameters.raw_sources).",
  validation = list(
    status = "passed_with_warnings",
    commands = list(
      "Rscript scripts/build_ci_area_summary.R",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/ci/data/area_summary_local.json",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/data-manifest.schema.json docs/manifests/ci-census-religion-2021.json"
    ),
    notes = paste(
      "Extraction is exact and unchanged: all 677 printed Table 11 rows carry identical paired-sheet row keys and printed resident totals, and every printed cell ships unchanged.",
      "The 519 census leaves close to the 510 ADM3 features under the conductor's four-class ruling (pipeline.parameters.join_closure): 508 one-to-one, 18 spelling variants, one exhaustion identity (GAGORE=Kadeko), the Guezon duplicate-name pair by spatial adjacency, BOBI+DIARABANA rolled into Bobi-Diarabana, and Parc National de Bona shipped no-data.",
      "Accounting gate: every one of the 519 leaves is represented exactly once; the closure conserves census value (shipped religion basis 29,276,522), which sits 136 below the national basis 29,276,658 by exactly the source's own pinned, image-verified residual (-138 leaf-to-national plus +2 Abidjan city re-tabulation). No printed value was altered.",
      "All source and simplified geometry validity, distinct-hash, overlap, interior-gap, sliver, and join gates passed; both the area-summary and the manifest pass schema validation."
    ),
    warnings = list(
      "Source arithmetic ships unchanged: 31 of 519 printed leaves have a 16-category sum one or two people above the printed resident total (41 persons); 48 of 110 departments differ from their child-leaf sums by -3..+2; the 519 leaves sum 6 above the national resident total and 138 below the national religion basis. All confirmed at 300 dpi in research/countries/ci/reconciliation-verification.md.",
      "Accounting-gate interpretation: the shipped religion basis (29,276,522) cannot equal the national basis (29,276,658) exactly, because the source's own leaves already sum 138 below national (pinned, image-verified). The gate is implemented as exact value-conservation-through-closure with the -136 residual disclosed, rather than forcing equality by altering printed values (which stop-don't-tune forbids). Flagged for the conductor.",
      "No named open reuse licence was located for the census publications; the ANStat footer records \"Tous droits Reservés\". Derived summaries are published with INS/ANStat attribution under PI approval 2026-07-10 (raw PDFs stay git-ignored).",
      "The rp2021.anstat.ci TLS chain did not validate locally; the exact HTTPS source was retrieved with certificate verification disabled and hashed.",
      "No local cross-wave change metric is released. The verified older publications (1988, 1998, 2014) use national or incompatible historical regional frames and remain national context only."
    )
  ),
  privacy = "public", licence_status = "needs_review", downstream_status = "staged",
  notes = "The generated files are uncommitted and staged (no page, no hub wiring). Derived summaries publish with INS/ANStat attribution under PI approval 2026-07-10; raw PDFs stay git-ignored. The map UI is outside this build."
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

cat("waves x geography: 1988/1998/2014 national context only; 2021 shipped local, department, region, district, national\n")
cat("shipped matrix: 2021 x 510 ADM3 features (509 with data, 1 no-data) from 519 census leaves; older waves national context only\n")
cat(sprintf("category frame: 2021=%d mutually exclusive categories; verbatim French source labels retained with separate English display labels\n", length(category_codes)))
cat(sprintf("denominator: 2021 ordinary-household religion basis=%d; printed resident total=%d; outside basis=%d; affiliation=%d; no religion=%d; does not know=%d; not declared=%d\n", national[["religion_basis_total"]], national[["population_total"]], national[["outside_religion_basis_count"]], national_affiliation, national[["SANS_RELIGION"]], national[["NE_SAIT_PAS"]], national[["NON_DECLAREE"]]))
cat(sprintf("disclosure gate: %d/519 leaves carry a negative outside-basis count summing to %d persons; shipped unchanged, verified source arithmetic (reconciliation-verification.md)\n", nrow(overrun), sum(overrun[["overrun_persons"]])))
cat(sprintf("reconciliation gate: passed with disclosure; %d printed rows extracted exactly; source non-reconciliation pinned at every level (stop-on-drift)\n", nrow(parsed[["all_rows"]])))
cat(sprintf("join closure: %d Class-A spelling variants + 1 exhaustion (GAGORE=Kadeko) + Guezon spatial pair + BOBI+DIARABANA roll-up + Parc National de Bona no-data; residue fully closed\n", nrow(closure[["class_a"]])))
cat(sprintf("accounting gate: 519 leaves each represented once; shipped basis=%d; national basis=%d; residual %d = pinned source discrepancy (-138 leaf + 2 Abidjan)\n", shipped_basis, national[["religion_basis_total"]], -shipped_vs_national))
cat(sprintf("geometry gate: passed; 510 valid features, 510 distinct hashes, overlap %.6f sq m, 0 interior gaps, 0 sub-1-sq-km slivers; simplified %d bytes\n", boundary_result[["simplified_validation"]][["overlap_sq_m"]], as.integer(boundary_result[["simplification"]][["bytes"]])))
cat("join gate: passed; 510/510 ADM3 features resolved (509 census-backed, 1 disclosed no-data)\n")
cat("provenance gate: passed; URL, retrieval date, byte size, TLS condition, and SHA-256 recorded per input\n")
cat("change gate: passed by withholding; no cross-wave local change metric is released\n")
cat("rights: derived summaries published with INS/ANStat attribution under PI approval 2026-07-10; ANStat \"Tous droits Reservés\" recorded; raw PDFs git-ignored; outputs staged (uncommitted)\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", boundary_out))
cat(sprintf("wrote %s\n", manifest_out))
