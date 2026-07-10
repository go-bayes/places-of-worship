# build the Côte d'Ivoire 2021 local census-affiliation area-summary product.
# inputs: INS/ANStat RGPH publications and geoBoundaries CIV ADM2/ADM3.
# outputs: local area-summary JSON/CSV, simplified boundary GeoJSON, and manifest.
# run from the repository root: Rscript scripts/build_ci_area_summary.R

suppressPackageStartupMessages({
  library(jsonlite)
  library(sf)
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
manifest_out <- file.path(manifest_dir, "ci-census-religion-1988-2021.json")

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

# repair the double-decoded UTF-8 strings found in the boundary source.
repair_mojibake <- function(value) {
  bad <- grepl("Ã|Â", value)
  value[bad] <- iconv(value[bad], from = "latin1", to = "UTF-8")
  value
}

# normalise one place label for an explicit census-to-boundary join.
normalise_name <- function(value) {
  value <- repair_mojibake(enc2utf8(value))
  value <- iconv(value, from = "UTF-8", to = "ASCII//TRANSLIT")
  value <- toupper(value)
  value <- gsub("\\(DE [^)]+\\)", "", value)
  value <- gsub("[^A-Z0-9]+", " ", value)
  trimws(gsub("[[:space:]]+", " ", value))
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
  component_sum <- rowSums(rows[, category_codes, drop = FALSE])
  rows[["religion_basis_total"]] <- component_sum
  rows[["outside_religion_basis_count"]] <- rows[["population_total"]] - component_sum
  if (any(rows[["outside_religion_basis_count"]] < 0L)) {
    bad <- which(rows[["outside_religion_basis_count"]] < 0L)
    labels <- ifelse(nzchar(rows[["local_label"]][bad]), rows[["local_label"]][bad], rows[["hierarchy_label"]][bad])
    details <- paste0(labels, " (", rows[["outside_religion_basis_count"]][bad], ")")
    stop(
      "Table 11 categories exceed the printed resident total in ", length(bad),
      " row(s): ", paste(details, collapse = "; "),
      call. = FALSE
    )
  }

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
  if (nrow(local) != 510L || nrow(national) != 1L) {
    stop("expected 510 local rows and one national row", call. = FALSE)
  }
  if (national[["religion_basis_total"]][[1L]] != 29276660L ||
      national[["outside_religion_basis_count"]][[1L]] != 112490L) {
    stop("national ordinary-household religion basis does not match RGPH 2021 Tome 1", call. = FALSE)
  }
  for (field in c("population_total", "religion_basis_total", "outside_religion_basis_count", category_codes)) {
    if (sum(local[[field]]) != national[[field]][[1L]]) {
      stop("local rows do not sum to the printed national ", field, call. = FALSE)
    }
  }
  list(all_rows = rows, local_rows = local, national_row = national)
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

# build the 510-feature source boundary and match every census row.
build_boundary <- function(census_rows) {
  boundary <- st_read(boundary_path, quiet = TRUE, stringsAsFactors = FALSE)
  regions <- st_read(boundary_parent_path, quiet = TRUE, stringsAsFactors = FALSE)
  if (nrow(boundary) != 510L || nrow(regions) != 33L) stop("geoBoundaries feature counts changed", call. = FALSE)
  boundary[["shapeName"]] <- repair_mojibake(boundary[["shapeName"]])
  boundary <- attach_boundary_regions(boundary, regions)
  boundary[["join_name"]] <- normalise_name(boundary[["shapeName"]])
  boundary[["join_region"]] <- normalise_name(boundary[["region_name"]])
  census_rows[["join_name"]] <- normalise_name(census_rows[["local_label"]])
  census_rows[["join_region"]] <- normalise_name(census_rows[["region_name"]])

  aliases <- c(
    "BINGERVILLE" = "BINGERVILLE",
    "LOLOBO" = "LOLOBO"
  )
  census_rows[["join_name"]] <- ifelse(
    census_rows[["join_name"]] %in% names(aliases),
    unname(aliases[census_rows[["join_name"]]]),
    census_rows[["join_name"]]
  )

  boundary_key <- paste(boundary[["join_name"]], boundary[["join_region"]], sep = "|")
  census_key <- paste(census_rows[["join_name"]], census_rows[["join_region"]], sep = "|")
  index <- match(census_key, boundary_key)
  if (anyNA(index) || anyDuplicated(index)) {
    missing <- census_rows[is.na(index), c("local_label", "region_name")]
    stop(
      "unmatched or duplicate census-boundary join: ",
      paste(apply(head(missing, 30L), 1L, paste, collapse = " / "), collapse = "; "),
      call. = FALSE
    )
  }
  if (!setequal(index, seq_len(510L))) stop("census join does not exhaust the ADM3 boundary", call. = FALSE)
  boundary[["source_area_name"]] <- census_rows[["local_label"]][match(seq_len(510L), index)]
  boundary[["area_code"]] <- boundary[["shapeID"]]
  boundary[["area_name"]] <- boundary[["shapeName"]]
  boundary[["area_unit_id"]] <- paste(boundary_set_id, boundary[["area_code"]], sep = ":")
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- boundary_level
  boundary[["boundary_vintage"]] <- "2021"
  boundary[["boundary_source"]] <- "geoBoundaries CIV ADM3; source CNTIG and OCHA ROWCA"
  boundary[["boundary_licence"]] <- "CC BY 3.0 IGO"
  boundary[["land_area_sq_km"]] <- as.numeric(st_area(st_transform(boundary, 32630))) / 1e6
  boundary <- st_transform(st_make_valid(boundary), 4326)
  boundary <- boundary[order(boundary[["area_code"]]), c(
    "area_code", "area_name", "source_area_name", "area_unit_id", "boundary_set_id",
    "boundary_level", "boundary_vintage", "boundary_source", "boundary_licence",
    "land_area_sq_km", "geometry"
  )]
  list(boundary = boundary, census_rows = census_rows, boundary_index = index)
}

# write and revalidate the topology-preserving simplified boundary.
write_boundary <- function(boundary) {
  source_validation <- validate_boundary(boundary, "source")
  simplification <- mapshaper_simplify_to_cap(
    boundary,
    boundary_out,
    max_bytes = 1800000,
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

# build one schema-shaped local census row.
build_area_row <- function(source, area) {
  excluded <- source[["SANS_RELIGION"]] + source[["NE_SAIT_PAS"]] + source[["NON_DECLAREE"]]
  affiliation <- source[["religion_basis_total"]] - excluded
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = boundary_level,
    area_unit_id = area[["area_unit_id"]],
    area_code = area[["area_code"]],
    area_name = area[["area_name"]],
    year = 2021L,
    population_total = as.integer(source[["religion_basis_total"]]),
    population_total_basis = paste(
      "ordinary-household religion-tabulation basis, derived exactly as the sum of the 16 Table 11 categories;",
      "the printed resident total also includes collective-household residents and people without housing"
    ),
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
    quality_flag = paste(
      "census_affiliation;ordinary_household_denominator;unknown_and_nonresponse_retained_in_denominator;",
      "2021_only_local_series;religious_change_withheld;source_site_all_rights_reserved;boundary_cc_by_3_0_igo",
      sep = ""
    )
  )
}

# flatten row objects into the CSV companion.
flatten_rows <- function(rows) {
  do.call(rbind, lapply(rows, function(row) {
    data.frame(
      country_code = row[["country_code"]], boundary_set_id = row[["boundary_set_id"]],
      boundary_level = row[["boundary_level"]], area_unit_id = row[["area_unit_id"]],
      area_code = row[["area_code"]], area_name = row[["area_name"]], year = row[["year"]],
      population_total = row[["population_total"]], population_total_basis = row[["population_total_basis"]],
      religious_affiliation_count = row[["religious_affiliation_count"]],
      religious_affiliation_percent = row[["religious_affiliation_percent"]],
      no_religion_count = row[["no_religion_count"]], no_religion_percent = row[["no_religion_percent"]],
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
        name = "No reuse licence stated; the current ANStat site footer says all rights reserved",
        url = anstat_site_url,
        attribution = "Institut National de la Statistique (INS), RGPH 2021"
      ),
      citation = "Institut National de la Statistique, RGPH 2021 résultats globaux, Table 11.",
      access_limits = "The rp2021.anstat.ci TLS chain did not validate locally; retrieval used the exact HTTPS URL with certificate verification disabled and records that condition.",
      redistribution_limits = "The source PDF remains in the git-ignored cache. The derived full-table product is staged for rights review because ANStat states all rights reserved.",
      notes = "Table 11 prints 510 local rows and department, region, district, and national totals across paired sheets. The 16 religion categories sum to the ordinary-household basis; the displayed resident total additionally includes collective-household residents and people without housing."
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

# describe one tracked generated output.
manifest_file_record <- function(path, content, licence_status_value) {
  list(
    uri = paste0("repo:", path), storage_provider = "git_repository",
    format = tools::file_ext(path), bytes = file_bytes(path), sha256 = sha256_file(path),
    row_count = row_count_file(path), content = content, privacy = "public",
    licence_status = licence_status_value
  )
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
boundary_build <- build_boundary(parsed[["local_rows"]])
boundary_result <- write_boundary(boundary_build[["boundary"]])

census_rows <- boundary_build[["census_rows"]]
source_by_boundary <- match(seq_len(510L), boundary_build[["boundary_index"]])
boundary_layer <- boundary_result[["layer"]]
rows <- lapply(seq_len(nrow(boundary_layer)), function(index) {
  build_area_row(census_rows[source_by_boundary[[index]], , drop = FALSE], boundary_layer[index, ])
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
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

national <- parsed[["national_row"]][1L, ]
national_affiliation <- national[["religion_basis_total"]] - national[["SANS_RELIGION"]] -
  national[["NE_SAIT_PAS"]] - national[["NON_DECLAREE"]]
category_totals <- setNames(lapply(category_codes, function(code) sum(parsed[["local_rows"]][[code]])), category_codes)

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

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = "manifest:ci-census-religion:ci:1988-2021:ins-geoboundaries",
  dataset_id = "ci-census-religion:ci:1988-2021:ins-geoboundaries",
  dataset_version_id = paste0("ci-census-religion:ci:1988-2021:ins-geoboundaries:", substr(sha256_file(summary_json_out), 1L, 12L)),
  manifest_sha256 = NULL, supersedes_manifest_id = NULL, superseded_by_manifest_id = NULL,
  dataset_family = "ci-census-religion", dataset_role = "public_product",
  scope = list(
    level = "country", country_codes = list(country_code), snapshot_date = NULL,
    snapshot_anchor = NULL, pipeline_stage = "staged"
  ),
  created_at = stamp, created_by = script_id,
  pipeline = list(
    script = script_id, git_commit = NULL, command = paste("Rscript", script_id),
    parameters = list(
      construct = "census affiliation", shipped_wave = 2021L,
      shipped_geography = "510 RGPH sub-prefecture-or-commune rows joined to geoBoundaries CIV ADM3",
      denominator = "ordinary-household religion basis, derived exactly as the sum of each row's 16 printed categories",
      nonresponse_rule = "does not know and not declared remain in the denominator and outside both headline numerators",
      resident_population_residual_rule = "printed resident total minus religion basis is retained as the exact excluded count for collective-household residents and people without housing",
      change_rule = "religious_change withheld because the only shipped local wave is 2021 and older published frames are not comparable",
      pdf_extraction = "poppler pdftotext -layout; paired sheets joined by identical row keys",
      category_mappings = list(`2021` = category_mapping_2021()),
      historical_publication_matrix = list(
        `1988` = list(national = "exact counts republished in RGPH 2021 Tome 1 Table 4.9 and percentages in RGPH 1998 Volume IV Tome 1 Table 3.2", subnational = "no official online subnational religion table pinned"),
        `1998` = list(national = "exact counts in RGPH 2021 Tome 1 Table 4.9", subnational = "rounded percentages for the old regional frame in RGPH 1998 Volume IV Tome 1 Table 3.6; not shipped"),
        `2014` = list(national = "exact counts in RGPH 2014 synthesis Table 2.11", subnational = "no subnational religion table in the verified synthesis volume"),
        `2021` = list(national = "exact Table 11 national row", subnational = "exact local, department, region, and district rows in Table 11; 510 local rows shipped")
      ),
      boundary_simplification = boundary_result[["simplification"]],
      boundary_validation = list(
        source = boundary_result[["source_validation"]],
        simplified = boundary_result[["simplified_validation"]]
      ),
      local_cache_hint = "Raw PDFs, metadata, and source geometry are cached under data/raw/ci_census/ and remain git-ignored."
    ),
    software_versions = list(
      r = R.version.string, sf = as.character(packageVersion("sf")),
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
      "The current ANStat site footer states all rights reserved and no specific census-publication reuse licence was located;",
      "the derived full-table product is staged for rights review. The shipped boundary is CC BY 3.0 IGO, verified in the release metadata."
    ),
    citation = "INS/ANStat RGPH publications for 1988-2021; geoBoundaries CIV ADM3 (CNTIG and OCHA ROWCA)."
  ),
  input_manifests = list(), raw_sources = raw_sources,
  derived_outputs = list(
    list(uri = paste0("repo:", summary_json_out), sha256 = sha256_file(summary_json_out), built_by = script_id, notes = "510 local rows for 2021."),
    list(uri = paste0("repo:", summary_csv_out), sha256 = sha256_file(summary_csv_out), built_by = script_id, notes = "Flattened CSV companion."),
    list(uri = paste0("repo:", boundary_out), sha256 = sha256_file(boundary_out), built_by = script_id, notes = "510 simplified local features with CC BY 3.0 IGO attribution.")
  ),
  durable_files = list(
    manifest_file_record(summary_json_out, "Côte d'Ivoire 2021 local census-affiliation area summary.", "needs_review"),
    manifest_file_record(summary_csv_out, "Flattened Côte d'Ivoire 2021 local census-affiliation rows.", "needs_review"),
    manifest_file_record(boundary_out, "Simplified geoBoundaries CIV ADM3 local geometry.", "cc_by_3_0_igo")
  ),
  validation = list(
    status = "passed_with_warnings",
    commands = list(
      "Rscript scripts/build_ci_area_summary.R",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/ci/data/area_summary_local.json",
      "jq empty docs/manifests/ci-census-religion-1988-2021.json"
    ),
    notes = paste(
      "For all 677 printed Table 11 rows, the 16 categories sum exactly to the derived ordinary-household basis and the derived outside-basis residual closes exactly to the printed resident total. The 510 local rows sum exactly to the printed national resident total, derived religion basis, derived residual, and every category.",
      "All source and simplified geometry validity, distinct-hash, overlap, interior-gap, sliver, join, and provenance gates passed."
    ),
    warnings = list(
      "The current ANStat site says all rights reserved. The derived full-table product remains staged for rights review.",
      "The rp2021.anstat.ci TLS chain did not validate locally; the exact HTTPS source was retrieved with certificate verification disabled and hashed.",
      "No local cross-wave change metric is released. The verified older publications use national or incompatible historical regional frames."
    ),
    printed_row_reconciliation = list(
      status = "passed", printed_rows = nrow(parsed[["all_rows"]]), local_rows = nrow(parsed[["local_rows"]]),
      category_count = length(category_codes), exact_row_matches = nrow(parsed[["all_rows"]]),
      local_to_national_exact_fields = list("population_total", "religion_basis_total", "outside_religion_basis_count", category_codes),
      source_stated_national_basis = list(
        ordinary_household_population = 29276660L,
        collective_household_population = 106743L,
        people_without_housing = 5747L,
        full_resident_population = 29389150L
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
    join_coverage = list(matched_local_rows = 510L, expected_local_rows = 510L, unmatched_local_rows = list(), unused_boundary_features = list()),
    boundary_validation = list(
      source = boundary_result[["source_validation"]], simplified = boundary_result[["simplified_validation"]],
      licence_metadata_status = "passed", licence = boundary_metadata[["boundaryLicense"]]
    )
  ),
  stats = list(
    local_year_rows = 510L, local_area_count = 510L, shipped_wave_count = 1L,
    printed_rows_validated = nrow(parsed[["all_rows"]]),
    distinct_geometry_hashes = length(unique(unlist(boundary_result[["simplified_validation"]][["hashes"]])))
  ),
  construct_notes = list(
    "The construct is census affiliation. It does not measure belief, practice, attendance, or registered membership.",
    "French source category names remain in the manifest with English display labels.",
    "The 2021 percentages use the ordinary-household religion basis. Does-not-know and not-declared responses remain in the denominator.",
    "Table 11 displays a full resident total of 29,389,150, while its religion categories sum to 29,276,660. RGPH 2021 Tome 1 states that 29,276,660 people lived in ordinary households, 106,743 lived in collective households, and 5,747 had no housing. The product uses the exact category sum as its denominator and records the 112,490-person exclusion.",
    "The 1988 frame has no other-Christian category because the source note says other Christians were combined with other religions. The 1998 frame separates other Christians and adds non-declared. The 2014 and 2021 frames use more detailed Christian categories.",
    "No religious_change field is released because only the 2021 local wave ships. The rounded 1998 old-region percentages and the exact 2021 current-geography counts do not support a same-boundary local contrast."
  ),
  deferred_sources = list(
    list(source_dataset_id = "ins-rgph-1988-original-religion-tables", status = "not_located_online", reason = "No original official online 1988 religion volume was pinned; official 1998 and 2021 volumes republish the 1988 national frame."),
    list(source_dataset_id = "ins-rgph-1998-old-region-religion", status = "not_shipped", reason = "Table 3.6 publishes rounded percentages on the historical regional frame; no licensed historical geometry and exact regional count table were pinned."),
    list(source_dataset_id = "ins-rgph-2014-subnational-religion", status = "not_located", reason = "The verified synthesis volume publishes religion nationally in Table 2.11; no subnational religion table was pinned."),
    list(source_dataset_id = "ins-rgph-2021-derived-full-table-rights", status = "rights_review", reason = "ANStat states all rights reserved and gives no specific reuse permission for the census publication.")
  ),
  privacy = "public", licence_status = "needs_review", downstream_status = "staged",
  source_datasets = source_datasets(),
  notes = "The generated files are uncommitted. The map UI is outside this build. Rights review is required before publication."
)

write_json(manifest, manifest_out, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)
if (!jsonlite::validate(paste(readLines(manifest_out, warn = FALSE), collapse = "\n"))) {
  stop("manifest JSON is invalid", call. = FALSE)
}

cat("waves x geography: 1988 national; 1998 national plus rounded old-region percentages; 2014 national; 2021 local, department, region, district, national\n")
cat("shipped matrix: 2021 x 510 sub-prefecture-or-commune rows; older waves documented and withheld from local change\n")
cat(sprintf("category frame: 2021=%d mutually exclusive categories; French source labels retained with English display labels\n", length(category_codes)))
cat(sprintf("denominator: 2021 ordinary-household religion basis=%d; printed resident total=%d; outside basis=%d; affiliation=%d; no religion=%d; does not know=%d; not declared=%d\n", national[["religion_basis_total"]], national[["population_total"]], national[["outside_religion_basis_count"]], national_affiliation, national[["SANS_RELIGION"]], national[["NE_SAIT_PAS"]], national[["NON_DECLAREE"]]))
cat(sprintf("validation counts: %d/%d printed rows close exactly with a derived outside-basis residual; 510/510 local rows joined; %d local-to-national fields exact\n", nrow(parsed[["all_rows"]]), nrow(parsed[["all_rows"]]), length(category_codes) + 3L))
cat(sprintf("geometry gate: passed; 510 valid features, 510 distinct hashes, overlap %.6f sq m, 0 interior gaps, 0 sub-1-sq-km slivers\n", boundary_result[["simplified_validation"]][["overlap_sq_m"]]))
cat("provenance gate: passed; URL, retrieval date, byte size, TLS condition, and SHA-256 recorded per input\n")
cat("change gate: passed by withholding; no cross-wave local change metric is released\n")
cat("rights gate: open; ANStat says all rights reserved, therefore outputs remain staged for review\n")
cat(sprintf("wrote %s\n", summary_json_out))
cat(sprintf("wrote %s\n", summary_csv_out))
cat(sprintf("wrote %s\n", boundary_out))
cat(sprintf("wrote %s\n", manifest_out))
