# build the Norway Church of Norway diocese membership product.
# inputs: SSB table 06929 member counts and national totals, SSB metadata and
# licence terms, and Kartverket's 2025 Geonorge Soknegrenser SOSI package.
# outputs: apps/regions/no/data/no_diocese_2025.geojson,
# apps/regions/no/data/area_summary_diocese.{json,csv}, and
# docs/manifests/no-membership-2005-2025.json.
# run from the repository root: Rscript scripts/build_no_area_summary.R

suppressMessages({
  library(jsonlite)
  library(sf)
})

source("scripts/lib/simplify_boundary.R")

raw_dir <- "data/raw/no_membership"
output_dir <- "apps/regions/no/data"
manifest_dir <- "docs/manifests"
dir.create(raw_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(manifest_dir, recursive = TRUE, showWarnings = FALSE)

country_code <- "NO"
script_id <- "scripts/build_no_area_summary.R"
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
retrieval_date <- format(Sys.Date(), "%Y-%m-%d")
git_commit <- system("git rev-parse --short HEAD", intern = TRUE)
years <- 2005L:2025L

ssb_table_url <- "https://data.ssb.no/api/v0/en/table/DNKMedlemmer"
ssb_table_page_url <- "https://www.ssb.no/en/statbank1/table/06929"
ssb_methodology_url <- "https://www.ssb.no/en/kultur-og-fritid/religion-og-livssyn/statistikk/den-norske-kirke"
ssb_licence_url <- "https://www.ssb.no/en/diverse/lisens"
rindal_transfer_url <- paste0(
  "https://www.kirken.no/nn-NO/bispedommer/more/aktuelt/",
  "endringar%20i%20bisped%C3%B8megrenser%20og%20prostigrenser%20fr%C3%A5%202020/"
)
nord_halogaland_scope_url <- paste0(
  "https://www.kirken.no/nb-NO/bispedommer/nord-haalogaland/",
  "biskop%20og%20bisped%C3%B8mme2/"
)
unknown_qualifier_verbatim <- "Unknown diocese do not include members living aboard."
geonorge_metadata_uuid <- "289d459c-0390-4000-84f3-88982f2cdb0c"
geonorge_catalogue_url <- paste0(
  "https://kartkatalog.geonorge.no/Metadata/uuid/", geonorge_metadata_uuid
)
geonorge_metadata_url <- paste0(
  "https://kartkatalog.geonorge.no/api/getdata/", geonorge_metadata_uuid
)
geonorge_capabilities_url <- paste0(
  "https://nedlasting.geonorge.no/api/capabilities/", geonorge_metadata_uuid
)
geonorge_order_url <- "https://nedlasting.geonorge.no/api/order"
geonorge_no_conditions_url <- paste0(
  "http://inspire.ec.europa.eu/metadata-codelist/",
  "ConditionsApplyingToAccessAndUse/noConditionsApply"
)

membership_dataset_id <- "ssb-06929-church-of-norway-members-diocese-2005-2025"
boundary_dataset_id <- "kartverket-geonorge-soknegrenser-diocese-2025"
boundary_set_id <- "no-diocese-2025-geonorge-soknegrenser"

ssb_metadata_path <- file.path(raw_dir, "ssb_06929_metadata_en.json")
ssb_diocese_path <- file.path(raw_dir, "ssb_06929_members_by_diocese_2005_2025.json")
ssb_national_path <- file.path(raw_dir, "ssb_06929_members_national_2005_2025.json")
ssb_licence_path <- file.path(raw_dir, "ssb_licence_en.html")
geonorge_metadata_path <- file.path(raw_dir, "geonorge_soknegrenser_metadata.json")
geonorge_capabilities_path <- file.path(raw_dir, "geonorge_soknegrenser_capabilities.json")
geonorge_order_path <- file.path(raw_dir, "geonorge_soknegrenser_order.json")
geonorge_sosi_zip_path <- file.path(raw_dir, "geonorge_soknegrenser_2025_sosi.zip")

boundary_out <- file.path(output_dir, "no_diocese_2025.geojson")
summary_json_out <- file.path(output_dir, "area_summary_diocese.json")
summary_csv_out <- file.path(output_dir, "area_summary_diocese.csv")
manifest_out <- file.path(manifest_dir, "no-membership-2005-2025.json")

ssb_diocese_request <- list(
  query = list(
    list(code = "Bispedomme", selection = list(filter = "all", values = list("*"))),
    list(code = "ContentsCode", selection = list(filter = "item", values = list("Medlemmer"))),
    list(code = "Tid", selection = list(filter = "all", values = list("*")))
  ),
  response = list(format = "json-stat2")
)

ssb_national_request <- list(
  query = list(
    list(code = "ContentsCode", selection = list(filter = "item", values = list("Medlemmer"))),
    list(code = "Tid", selection = list(filter = "all", values = list("*")))
  ),
  response = list(format = "json-stat2")
)

geonorge_order_request <- list(
  downloadAsBundle = FALSE,
  orderLines = list(list(
    areas = list(list(code = "0000", name = "Hele landet", type = "landsdekkende")),
    formats = list(list(name = "SOSI")),
    metadataUuid = geonorge_metadata_uuid,
    projections = list(list(
      code = "25833",
      name = "EUREF89 UTM sone 33, 2d",
      codespace = "http://www.opengis.net/def/crs/EPSG/0/25833"
    ))
  )),
  usageGroup = "research",
  softwareClient = "places-of-worship",
  softwareClientVersion = "1"
)

# return a file's SHA-256 digest.
sha256_file <- function(path) unname(tools::sha256sum(path))

# hash ordered text values into a compact product version token.
sha256_values <- function(values) {
  tmp <- tempfile()
  on.exit(unlink(tmp), add = TRUE)
  writeBin(charToRaw(paste(values, collapse = "")), tmp)
  sha256_file(tmp)
}

# return a file size as an integer number of bytes.
file_bytes <- function(path) as.integer(unname(file.info(path)[["size"]]))

# write cache provenance beside a raw network response.
write_meta <- function(path, url, method, request_body = NULL) {
  write_json(
    list(
      retrieved_at = stamp,
      url = url,
      method = method,
      http_status = 200L,
      request_body = request_body
    ),
    paste0(path, ".meta.json"),
    auto_unbox = TRUE,
    pretty = TRUE,
    null = "null"
  )
}

# read cached response provenance or stop when it is absent.
read_meta <- function(path) {
  meta_path <- paste0(path, ".meta.json")
  if (!file.exists(meta_path)) stop("missing cache provenance: ", meta_path, call. = FALSE)
  fromJSON(meta_path, simplifyVector = FALSE)
}

# fetch a public GET response into the raw cache when absent.
fetch_get_if_missing <- function(url, path) {
  if (file.exists(path) && file_bytes(path) > 0L) {
    if (!file.exists(paste0(path, ".meta.json"))) write_meta(path, url, "GET")
    return(invisible(FALSE))
  }
  tmp <- tempfile(tmpdir = dirname(path))
  on.exit(unlink(tmp), add = TRUE)
  status <- system2(
    "curl",
    c("-fL", "-sS", "--retry", "3", "--max-time", "300", "-A",
      "places-of-worship-research-build", shQuote(url), "-o", shQuote(tmp))
  )
  if (status != 0L || !file.exists(tmp) || file_bytes(tmp) == 0L) {
    stop("GET failed for ", url, call. = FALSE)
  }
  file.rename(tmp, path)
  write_meta(path, url, "GET")
  invisible(TRUE)
}

# post a JSON request into the raw cache when absent.
fetch_post_json_if_missing <- function(url, request_body, path) {
  if (file.exists(path) && file_bytes(path) > 0L) {
    if (!file.exists(paste0(path, ".meta.json"))) write_meta(path, url, "POST", request_body)
    return(invisible(FALSE))
  }
  body_path <- tempfile(fileext = ".json")
  tmp <- tempfile(tmpdir = dirname(path))
  on.exit(unlink(c(body_path, tmp)), add = TRUE)
  write_json(request_body, body_path, auto_unbox = TRUE, null = "null")
  status <- system2(
    "curl",
    c("-fL", "-sS", "--retry", "3", "--max-time", "300", "-A",
      "places-of-worship-research-build", "-H", shQuote("Content-Type: application/json"),
      "--data-binary", shQuote(paste0("@", body_path)), shQuote(url), "-o", shQuote(tmp))
  )
  if (status != 0L || !file.exists(tmp) || file_bytes(tmp) == 0L) {
    stop("POST failed for ", url, call. = FALSE)
  }
  file.rename(tmp, path)
  write_meta(path, url, "POST", request_body)
  invisible(TRUE)
}

# fetch every raw source while limiting SSB to two data POST requests.
fetch_sources <- function() {
  fetch_get_if_missing(ssb_table_url, ssb_metadata_path)
  fetch_post_json_if_missing(ssb_table_url, ssb_diocese_request, ssb_diocese_path)
  fetch_post_json_if_missing(ssb_table_url, ssb_national_request, ssb_national_path)
  fetch_get_if_missing(ssb_licence_url, ssb_licence_path)
  fetch_get_if_missing(geonorge_metadata_url, geonorge_metadata_path)
  fetch_get_if_missing(geonorge_capabilities_url, geonorge_capabilities_path)
  fetch_post_json_if_missing(geonorge_order_url, geonorge_order_request, geonorge_order_path)

  order <- fromJSON(geonorge_order_path, simplifyVector = FALSE)
  files <- order[["files"]]
  if (length(files) != 1L || !identical(files[[1]][["format"]], "SOSI")) {
    stop("Geonorge order did not return one SOSI file", call. = FALSE)
  }
  fetch_get_if_missing(files[[1]][["downloadUrl"]], geonorge_sosi_zip_path)
  invisible(TRUE)
}

# return values from one SSB metadata variable by its code.
ssb_variable <- function(metadata, code) {
  variables <- Filter(function(variable) identical(variable[["code"]], code), metadata[["variables"]])
  if (length(variables) != 1L) stop("SSB metadata variable missing or duplicated: ", code, call. = FALSE)
  variables[[1]]
}

# recover a JSON-stat dimension's category codes in cube order.
jsonstat_codes <- function(dataset, dimension_code) {
  index <- unlist(dataset[["dimension"]][[dimension_code]][["category"]][["index"]])
  names(sort(index))
}

# parse the SSB diocese and national member cubes into tidy records.
parse_membership <- function() {
  metadata <- fromJSON(ssb_metadata_path, simplifyVector = FALSE)
  area_variable <- ssb_variable(metadata, "Bispedomme")
  contents_variable <- ssb_variable(metadata, "ContentsCode")
  time_variable <- ssb_variable(metadata, "Tid")
  source_years <- as.integer(unlist(time_variable[["values"]]))
  area_codes <- unlist(area_variable[["values"]])
  area_names <- unlist(area_variable[["valueTexts"]])
  contents_codes <- unlist(contents_variable[["values"]])
  contents_labels <- unlist(contents_variable[["valueTexts"]])

  if (!identical(source_years, years)) stop("SSB table years differ from 2005-2025", call. = FALSE)
  if (!identical(area_codes, c(sprintf("%02d", 1:11), "99"))) {
    stop("SSB table diocese codes differ from 01-11 plus 99 Unknown diocese", call. = FALSE)
  }
  member_index <- match("Medlemmer", contents_codes)
  if (is.na(member_index)) stop("SSB member category Medlemmer is absent", call. = FALSE)
  member_label <- contents_labels[[member_index]]

  by_diocese <- fromJSON(ssb_diocese_path, simplifyVector = FALSE)
  national <- fromJSON(ssb_national_path, simplifyVector = FALSE)
  if (!identical(unlist(by_diocese[["id"]]), c("Bispedomme", "ContentsCode", "Tid")) ||
      !identical(as.integer(unlist(by_diocese[["size"]])), c(12L, 1L, 21L))) {
    stop("SSB diocese JSON-stat cube shape changed", call. = FALSE)
  }
  if (!identical(unlist(national[["id"]]), c("ContentsCode", "Tid")) ||
      !identical(as.integer(unlist(national[["size"]])), c(1L, 21L))) {
    stop("SSB national JSON-stat cube shape changed", call. = FALSE)
  }
  if (!identical(jsonstat_codes(by_diocese, "Bispedomme"), area_codes) ||
      !identical(as.integer(jsonstat_codes(by_diocese, "Tid")), years) ||
      !identical(as.integer(jsonstat_codes(national, "Tid")), years)) {
    stop("SSB JSON-stat dimension order differs from metadata", call. = FALSE)
  }

  values <- as.integer(unlist(by_diocese[["value"]]))
  national_values <- as.integer(unlist(national[["value"]]))
  if (length(values) != 252L || length(national_values) != 21L ||
      anyNA(values) || anyNA(national_values)) {
    stop("SSB membership response contains missing or unexpected values", call. = FALSE)
  }
  records <- do.call(rbind, lapply(seq_along(area_codes), function(area_index) {
    offset <- (area_index - 1L) * length(years)
    data.frame(
      area_code = area_codes[[area_index]],
      area_name = area_names[[area_index]],
      year = years,
      member_count = values[offset + seq_along(years)],
      stringsAsFactors = FALSE
    )
  }))
  national_records <- data.frame(
    year = years,
    national_member_count = national_values,
    stringsAsFactors = FALSE
  )
  list(
    metadata = metadata,
    member_label = member_label,
    records = records,
    national = national_records,
    source_note = unlist(by_diocese[["note"]])
  )
}

# return the start and end line for each top-level SOSI curve or surface record.
sosi_record_index <- function(lines) {
  starts <- grep("^\\.(KURVE|FLATE)\\s+[0-9]+:", lines)
  headers <- regexec("^\\.(KURVE|FLATE)\\s+([0-9]+):", lines[starts])
  fields <- regmatches(lines[starts], headers)
  data.frame(
    type = vapply(fields, `[[`, character(1), 2L),
    id = as.integer(vapply(fields, `[[`, character(1), 3L)),
    start = starts,
    end = c(starts[-1L] - 1L, length(lines)),
    stringsAsFactors = FALSE
  )
}

# parse the direct Geonorge diocese surfaces and their referenced curve identifiers.
parse_diocese_surfaces <- function(lines, records) {
  surfaces <- list()
  flat_rows <- which(records[["type"]] == "FLATE")
  for (row in flat_rows) {
    block <- lines[records[["start"]][[row]]:records[["end"]][[row]]]
    if (!any(block == "..OBJTYPE Bispedømme")) next
    code_line <- grep("^\\.\\.\\.BISPEDØMMENUMMER ", block, value = TRUE)
    name_line <- grep("^\\.\\.\\.BISPEDØMMENAVN ", block, value = TRUE)
    ref_start <- grep("^\\.\\.REF ", block)
    if (length(code_line) != 1L || length(name_line) != 1L || length(ref_start) != 1L) {
      stop("failed to parse a Geonorge diocese surface", call. = FALSE)
    }
    ref_end_candidates <- which(seq_along(block) > ref_start & grepl("^\\.", block))
    ref_end <- if (length(ref_end_candidates)) min(ref_end_candidates) - 1L else length(block)
    ref_text <- paste(block[ref_start:ref_end], collapse = " ")
    refs <- as.integer(unlist(regmatches(ref_text, gregexpr("-?[0-9]+", ref_text))))
    code <- sprintf("%02d", as.integer(sub("^.* ", "", code_line)))
    name <- gsub('^.*BISPEDØMMENAVN\\s+|"', "", name_line)
    surfaces[[code]] <- list(code = code, name = name, refs = refs)
  }
  if (length(surfaces) != 11L) stop("Geonorge SOSI does not contain 11 diocese surfaces", call. = FALSE)
  surfaces
}

# parse only the SOSI curves referenced by diocese surfaces into EPSG:25833 lines.
parse_referenced_curves <- function(lines, records, wanted_ids) {
  curves <- list()
  curve_rows <- which(records[["type"]] == "KURVE" & records[["id"]] %in% wanted_ids)
  for (row in curve_rows) {
    block <- lines[records[["start"]][[row]]:records[["end"]][[row]]]
    coordinate_lines <- grep("^-?[0-9]+\\s+-?[0-9]+", trimws(block), value = TRUE)
    parts <- strsplit(trimws(coordinate_lines), "\\s+")
    coordinates <- do.call(rbind, lapply(parts, function(part) {
      c(as.numeric(part[[2L]]) / 100, as.numeric(part[[1L]]) / 100)
    }))
    coordinates <- coordinates[c(TRUE, rowSums(abs(diff(coordinates))) > 0), , drop = FALSE]
    if (nrow(coordinates) < 2L) {
      stop("a referenced SOSI curve has fewer than two distinct coordinates", call. = FALSE)
    }
    curves[[as.character(records[["id"]][[row]])]] <- st_linestring(coordinates)
  }
  curves
}

# polygonise each diocese's referenced network without concatenating sfg objects.
build_diocese_polygons <- function(surfaces, curves) {
  features <- lapply(surfaces, function(surface) {
    ids <- as.character(abs(surface[["refs"]]))
    missing <- setdiff(ids, names(curves))
    if (length(missing)) {
      stop("missing referenced SOSI curves: ", paste(head(missing), collapse = ", "), call. = FALSE)
    }
    line_sfc <- st_sfc(lapply(ids, function(id) curves[[id]]), crs = 25833)
    polygonised <- st_collection_extract(st_polygonize(st_union(line_sfc)), "POLYGON")
    geometry <- st_union(polygonised)
    st_sf(
      area_code = surface[["code"]],
      source_boundary_name = surface[["name"]],
      geometry = geometry
    )
  })
  do.call(rbind, features)
}

# count interior rings in a polygon or multipolygon union as uncovered gaps.
interior_ring_count <- function(geometry) {
  sfg <- st_geometry(geometry)[[1]]
  if (inherits(sfg, "POLYGON")) return(max(0L, length(sfg) - 1L))
  if (inherits(sfg, "MULTIPOLYGON")) {
    return(sum(vapply(sfg, function(polygon) max(0L, length(polygon) - 1L), integer(1))))
  }
  stop("coverage union is not polygonal", call. = FALSE)
}

# hash each feature's own WKB geometry and preserve one digest per feature.
geometry_hashes <- function(layer) {
  vapply(seq_len(nrow(layer)), function(index) {
    raw_wkb <- st_as_binary(st_geometry(layer)[index], EWKB = TRUE)[[1]]
    tmp <- tempfile()
    on.exit(unlink(tmp), add = TRUE)
    writeBin(raw_wkb, tmp)
    sha256_file(tmp)
  }, character(1))
}

# enforce validity, distinctness, overlap, and coverage gates for 11 polygons.
validate_boundary <- function(layer, stage) {
  if (nrow(layer) != 11L || any(st_is_empty(layer)) || any(!st_is_valid(layer))) {
    stop(stage, " boundary does not contain 11 valid non-empty features", call. = FALSE)
  }
  hashes <- geometry_hashes(layer)
  if (length(unique(hashes)) != 11L) {
    stop(stage, " boundary does not have 11 distinct geometry hashes", call. = FALSE)
  }
  metric <- st_transform(layer, 25833)
  union <- st_union(metric)
  overlap_sq_m <- sum(as.numeric(st_area(metric))) - as.numeric(st_area(union))
  if (overlap_sq_m > 1) {
    stop(stage, " boundary overlap exceeds the fixed 1 square metre tolerance", call. = FALSE)
  }
  if (interior_ring_count(union) != 0L) {
    stop(stage, " boundary union contains an uncovered interior gap", call. = FALSE)
  }
  list(
    hashes = setNames(as.list(hashes), layer[["area_code"]]),
    overlap_sq_m = round(overlap_sq_m, 6),
    interior_gap_count = 0L,
    coverage_sq_km = round(as.numeric(st_area(union)) / 1e6, 4)
  )
}

# build 11 direct Geonorge polygons and align their public names to SSB metadata.
build_boundary <- function(membership) {
  extract_dir <- tempfile("no-sosi-")
  dir.create(extract_dir)
  on.exit(unlink(extract_dir, recursive = TRUE), add = TRUE)
  extracted <- unzip(geonorge_sosi_zip_path, files = "Soknegrenser.sos", exdir = extract_dir)
  if (length(extracted) != 1L) stop("Geonorge SOSI archive layout changed", call. = FALSE)
  lines <- readLines(extracted, encoding = "UTF-8", warn = FALSE)
  records <- sosi_record_index(lines)
  surfaces <- parse_diocese_surfaces(lines, records)
  wanted_ids <- unique(abs(unlist(lapply(surfaces, `[[`, "refs"))))
  curves <- parse_referenced_curves(lines, records, wanted_ids)
  boundary <- build_diocese_polygons(surfaces, curves)
  boundary <- boundary[order(boundary[["area_code"]]), ]

  mapped_names <- unique(membership[["records"]][membership[["records"]][["area_code"]] != "99", c("area_code", "area_name")])
  mapped_names <- mapped_names[order(mapped_names[["area_code"]]), ]
  if (!identical(boundary[["area_code"]], mapped_names[["area_code"]]) ||
      !identical(boundary[["source_boundary_name"]], sub(" diocese$", "", mapped_names[["area_name"]]))) {
    stop("Geonorge boundary codes or names do not align with SSB table metadata", call. = FALSE)
  }
  boundary[["area_name"]] <- mapped_names[["area_name"]]
  boundary[["country_code"]] <- country_code
  boundary[["area_unit_id"]] <- paste0(boundary_set_id, ":", boundary[["area_code"]])
  boundary[["boundary_set_id"]] <- boundary_set_id
  boundary[["boundary_level"]] <- "diocese"
  boundary[["boundary_vintage"]] <- "2025-01-01"
  boundary <- boundary[, c(
    "country_code", "area_code", "area_name", "source_boundary_name",
    "area_unit_id", "boundary_set_id", "boundary_level", "boundary_vintage",
    "geometry"
  )]
  st_transform(st_make_valid(boundary), 4326)
}

# write the direct boundary through the shared simplification helper and rerun all geometry gates.
write_boundary <- function(boundary) {
  source_validation <- validate_boundary(boundary, "source")
  keep_percentages <- c(10, 5, 3, 2, 1, 0.5, 0.25)
  simplification <- mapshaper_simplify_to_cap(
    boundary,
    boundary_out,
    max_bytes = 800000,
    keep_percentages = keep_percentages,
    clean_option = NULL
  )
  written <- st_read(boundary_out, quiet = TRUE, stringsAsFactors = FALSE)
  written <- written[order(written[["area_code"]]), ]
  simplified_validation <- validate_boundary(written, "simplified")
  max_latitude <- unname(st_bbox(written)[["ymax"]])
  if (max_latitude >= 72) {
    stop("mapped diocese polygons extend beyond the reviewed mainland latitude", call. = FALSE)
  }
  simplification[["byte_ceiling"]] <- 800000L
  list(
    simplification = simplification,
    source_validation = source_validation,
    simplified_validation = simplified_validation,
    max_latitude = round(max_latitude, 4),
    boundary = written
  )
}

# reconcile all SSB diocese categories, including Unknown diocese, to national totals.
build_reconciliation <- function(membership) {
  records <- membership[["records"]]
  national <- membership[["national"]]
  output <- lapply(years, function(year) {
    year_rows <- records[records[["year"]] == year, ]
    mapped_sum <- sum(year_rows[["member_count"]][year_rows[["area_code"]] != "99"])
    unknown <- year_rows[["member_count"]][year_rows[["area_code"]] == "99"]
    all_diocese_sum <- sum(year_rows[["member_count"]])
    national_total <- national[["national_member_count"]][national[["year"]] == year]
    list(
      year = year,
      mapped_diocese_sum = as.integer(mapped_sum),
      unknown_diocese_count = as.integer(unknown),
      all_ssb_diocese_categories_sum = as.integer(all_diocese_sum),
      ssb_published_national_total = as.integer(national_total),
      difference = as.integer(national_total - all_diocese_sum),
      exact = identical(as.integer(all_diocese_sum), as.integer(national_total))
    )
  })
  if (!all(vapply(output, `[[`, logical(1), "exact"))) {
    stop("diocese membership categories do not reconcile exactly to SSB national totals", call. = FALSE)
  }
  output
}

# describe the unallocated counts and their share of the published national series.
unknown_diocese_note <- function(reconciliation) {
  unknown_counts <- vapply(reconciliation, `[[`, integer(1), "unknown_diocese_count")
  national_totals <- vapply(reconciliation, `[[`, integer(1), "ssb_published_national_total")
  unknown_percent <- 100 * unknown_counts / national_totals
  paste0(
    "Across 2005-2025, SSB's unallocated Unknown diocese category ranges from ",
    format(min(unknown_counts), big.mark = ",", scientific = FALSE), " to ",
    format(max(unknown_counts), big.mark = ",", scientific = FALSE),
    " members, or 0 to ", sprintf("%.4f", max(unknown_percent)),
    "% of the published national total. SSB table 06929 states verbatim: ",
    "\"", unknown_qualifier_verbatim, "\" Source: ",
    ssb_table_page_url, "."
  )
}

# explain how annual SSB assignments relate to the fixed mapped boundary vintage.
boundary_vintage_note <- function() {
  paste0(
    "Counts follow SSB's published diocese assignment for each reference year. ",
    "The drawn boundaries use the 2025-01-01 vintage. Rindal parish moved from ",
    "Møre to Nidaros on 1 January 2020. Early-year counts near transferred ",
    "parishes may therefore not align exactly with the drawn borders. Neither table 06929 ",
    "metadata nor SSB's About the statistics documentation states whether the ",
    "historical series is rebased to current dioceses. Sources: ",
    ssb_table_page_url, "; ", ssb_methodology_url, "; ", rindal_transfer_url, "."
  )
}

# state the common Svalbard exclusion and the formal diocese scope.
svalbard_note <- function() {
  paste0(
    "SSB's Church of Norway statistics and the mapped polygons both exclude ",
    "Svalbard. Nord-Hålogaland diocese formally includes Svalbard, while the ",
    "shipped polygons end at about 71.4° N. Sources: ", ssb_methodology_url,
    "; ", nord_halogaland_scope_url, "."
  )
}

# return the review-gate construct notes used in generated public metadata.
construct_notes <- function(reconciliation) {
  c(
    boundary_vintage_note(),
    svalbard_note(),
    unknown_diocese_note(reconciliation)
  )
}

# state why the product carries no imported population denominator.
population_basis_note <- function() {
  paste(
    "SSB table 06929 publishes Church of Norway member counts by diocese but",
    "does not publish a diocese population denominator. This product imports",
    "no denominator from table 12025 or another source."
  )
}

# build one schema-conforming area-summary row from an SSB member count.
build_row <- function(record, boundary) {
  area <- boundary[boundary[["area_code"]] == record[["area_code"]], ]
  if (nrow(area) != 1L) stop("area-summary row has no unique boundary", call. = FALSE)
  list(
    country_code = country_code,
    boundary_set_id = boundary_set_id,
    boundary_level = "diocese",
    area_unit_id = area[["area_unit_id"]][[1]],
    area_code = record[["area_code"]],
    area_name = record[["area_name"]],
    year = as.integer(record[["year"]]),
    population_total = NULL,
    population_total_basis = population_basis_note(),
    religious_affiliation_count = as.integer(record[["member_count"]]),
    religious_affiliation_percent = NULL,
    no_religion_count = NULL,
    no_religion_percent = NULL,
    place_count = NULL,
    places_per_10000_residents = NULL,
    place_density_per_sq_km = NULL,
    land_area_sq_km = NULL,
    site_snapshot_date = NULL,
    place_count_basis = NULL,
    source_dataset_ids = list(membership_dataset_id, boundary_dataset_id),
    quality_flag = paste(
      "administrative_membership_register",
      "church_of_norway_membership_not_census_affiliation_or_attendance",
      "ssb_06929_count",
      "percentage_not_published",
      "unknown_diocese_unallocated",
      "national_reconciliation_exact_with_unknown",
      "geonorge_diocese_2025",
      sep = ";"
    )
  )
}

# flatten row objects into the repository's CSV companion shape.
flatten_rows <- function(rows) {
  data.frame(
    country_code = vapply(rows, `[[`, character(1), "country_code"),
    boundary_set_id = vapply(rows, `[[`, character(1), "boundary_set_id"),
    boundary_level = vapply(rows, `[[`, character(1), "boundary_level"),
    area_unit_id = vapply(rows, `[[`, character(1), "area_unit_id"),
    area_code = vapply(rows, `[[`, character(1), "area_code"),
    area_name = vapply(rows, `[[`, character(1), "area_name"),
    year = vapply(rows, `[[`, integer(1), "year"),
    population_total = NA_integer_,
    population_total_basis = vapply(rows, `[[`, character(1), "population_total_basis"),
    religious_affiliation_count = vapply(rows, `[[`, integer(1), "religious_affiliation_count"),
    religious_affiliation_percent = NA_real_,
    no_religion_count = NA_integer_,
    no_religion_percent = NA_real_,
    place_count = NA_integer_,
    places_per_10000_residents = NA_real_,
    place_density_per_sq_km = NA_real_,
    land_area_sq_km = NA_real_,
    site_snapshot_date = NA_character_,
    place_count_basis = NA_character_,
    source_dataset_ids = vapply(
      rows,
      function(row) paste(unlist(row[["source_dataset_ids"]]), collapse = "|"),
      character(1)
    ),
    quality_flag = vapply(rows, `[[`, character(1), "quality_flag"),
    stringsAsFactors = FALSE
  )
}

# return the source dataset declarations shared by the JSON product.
source_datasets <- function(reconciliation) {
  list(
    list(
      source_dataset_id = membership_dataset_id,
      name = "06929: Church of Norway, members, church ceremonies and services, by diocese, contents and year",
      provider = "Statistics Norway (SSB)",
      url = ssb_table_url,
      retrieval_date = retrieval_date,
      local_path = ssb_diocese_path,
      licence = list(
        name = "Creative Commons Attribution 4.0 International (CC BY 4.0)",
        url = ssb_licence_url,
        attribution = "Statistics Norway"
      ),
      citation = "Statistics Norway, StatBank table 06929, Church of Norway member register counts by diocese and year.",
      access_limits = "The SSB API is rate-limited; the builder makes two data POST requests only when the raw cache is absent.",
      redistribution_limits = "CC BY 4.0 attribution applies.",
      notes = paste(
        "Administrative Church of Norway membership register. Up to and including",
        "2020, SSB included members and an unbaptised child under 18 of a member;",
        "from 2021 the variable includes members only.",
        unknown_diocese_note(reconciliation),
        "SSB's Church of Norway statistics exclude Svalbard. Source:",
        paste0(ssb_methodology_url, ".")
      )
    ),
    list(
      source_dataset_id = boundary_dataset_id,
      name = "Soknegrenser",
      provider = "Kartverket via Geonorge",
      url = geonorge_catalogue_url,
      retrieval_date = retrieval_date,
      local_path = geonorge_sosi_zip_path,
      licence = list(
        name = "No conditions apply to access and use",
        url = geonorge_no_conditions_url,
        attribution = "Kartverket"
      ),
      citation = "Kartverket, Geonorge Soknegrenser, diocese surfaces effective 1 January 2025.",
      access_limits = NULL,
      redistribution_limits = "The catalogue metadata records no conditions on access or use and no public-access limitation.",
      notes = paste(
        "The source contains eleven direct Bispedømme surfaces in SOSI EPSG:25833.",
        "The published surfaces extend through coastal waters; land_area_sq_km is therefore null.",
        boundary_vintage_note(),
        svalbard_note()
      )
    )
  )
}

# declare the one shipped indicator with SSB's published label verbatim.
indicators <- function(member_label, reconciliation) {
  list(list(
    indicator_id = "religious_affiliation_count",
    label = member_label,
    description = paste(
      "Legacy area-summary field used for the SSB table 06929 Church of Norway",
      "administrative member-register count. It does not measure census",
      "religious affiliation, belief, or attendance."
    ),
    unit = "count",
    denominator_indicator_id = NULL,
    method = "Published SSB table 06929 Medlemmer count for the named diocese and year; no denominator or percentage is derived.",
    temporal_coverage = "Annual 2005-2025.",
    spatial_coverage = "Eleven named Church of Norway dioceses; SSB's Unknown diocese category remains national reconciliation context.",
    quality_notes = paste(
      "Up to and including 2020, SSB included members and an unbaptised child",
      "under 18 of a member; from 2021 the variable includes members only.",
      "From 2011 Unknown diocese is included, and SSB warns that national totals",
      "cannot be compared with earlier years.",
      paste(construct_notes(reconciliation), collapse = " ")
    )
  ))
}

# describe the proportional-symbol layer supported by count-only source data.
visual_layers <- function(member_label) {
  list(list(
    visual_layer_id = "no-diocese-church-membership-count",
    label = member_label,
    description = "Published Church of Norway administrative member-register count by diocese.",
    layer_type = "proportional_symbol",
    indicator_ids = list("religious_affiliation_count"),
    geometry_unit_type = "area_unit",
    legend = list(unit = "members", source_category_code = "Medlemmer"),
    colour_scale = "sequential",
    time_control = "year_selector",
    aggregation_rule = "use the published diocese count; assign no Unknown diocese members to mapped polygons",
    uncertainty_display = "quality_flag",
    default_visibility = TRUE,
    notes = "Count layer only. Table 06929 publishes no diocese population percentage."
  ))
}

# return a stable row or feature count for a generated artefact.
row_count_file <- function(path) {
  if (grepl("\\.csv$", path)) return(max(0L, length(readLines(path, warn = FALSE)) - 1L))
  if (grepl("\\.geojson$", path)) return(nrow(st_read(path, quiet = TRUE)))
  object <- fromJSON(path, simplifyVector = FALSE)
  if (!is.null(object[["rows"]])) return(length(object[["rows"]]))
  NA_integer_
}

# describe one committed output in a schema-valid durable-file record.
manifest_file_record <- function(path, content) {
  record <- list(
    uri = paste0("repo:", path),
    storage_provider = "other",
    format = tools::file_ext(path),
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    content = content,
    privacy = "public",
    licence_status = "accepted"
  )
  if (grepl("\\.geojson$", path)) {
    record[["feature_count"]] <- row_count_file(path)
  } else {
    record[["row_count"]] <- row_count_file(path)
  }
  record
}

# describe one cached raw input with exact URL, retrieval time, and digest.
raw_source_record <- function(path, format, dataset_id, used, licence, notes) {
  meta <- read_meta(path)
  list(
    uri = path,
    url = meta[["url"]],
    method = meta[["method"]],
    request_body = meta[["request_body"]],
    format = format,
    bytes = file_bytes(path),
    sha256 = sha256_file(path),
    source_dataset_id = dataset_id,
    used_in_public_product = used,
    retrieved_at = meta[["retrieved_at"]],
    http_status = meta[["http_status"]],
    licence = licence,
    notes = notes
  )
}

fetch_sources()
membership <- parse_membership()
if (!(unknown_qualifier_verbatim %in% membership[["source_note"]])) {
  stop("SSB Unknown diocese qualifier differs from the reviewed wording", call. = FALSE)
}
reconciliation <- build_reconciliation(membership)
boundary <- build_boundary(membership)
boundary_result <- write_boundary(boundary)
written_boundary <- boundary_result[["boundary"]]

mapped_records <- membership[["records"]][membership[["records"]][["area_code"]] != "99", ]
mapped_records <- mapped_records[order(mapped_records[["year"]], mapped_records[["area_code"]]), ]
if (nrow(mapped_records) != 231L || !identical(sort(unique(mapped_records[["year"]])), years)) {
  stop("mapped membership rows do not cover 11 dioceses for every year 2005-2025", call. = FALSE)
}
rows <- lapply(seq_len(nrow(mapped_records)), function(index) {
  build_row(mapped_records[index, , drop = FALSE], written_boundary)
})

area_summary <- list(
  schema_version = "0.2.0",
  generated_at = stamp,
  generated_by = script_id,
  country_code = country_code,
  boundary_set = list(
    boundary_set_id = boundary_set_id,
    country_code = country_code,
    level = "diocese",
    vintage = "2025-01-01",
    source_dataset_id = boundary_dataset_id
  ),
  site_snapshot = list(
    source_dataset_id = NULL,
    snapshot_date = NULL,
    basis = "no governed Norway place-of-worship snapshot is included in this Church of Norway membership release",
    notes = "The product ships administrative membership counts only; place-density fields are null."
  ),
  source_datasets = source_datasets(reconciliation),
  indicators = indicators(membership[["member_label"]], reconciliation),
  visual_layers = visual_layers(membership[["member_label"]]),
  rows = rows
)

write_json(
  area_summary,
  summary_json_out,
  auto_unbox = TRUE,
  pretty = TRUE,
  null = "null",
  na = "null",
  digits = NA
)
write.csv(flatten_rows(rows), summary_csv_out, row.names = FALSE, na = "")

ssb_licence_name <- "Creative Commons Attribution 4.0 International (CC BY 4.0)"
geonorge_licence_name <- "No conditions apply to access and use"
raw_sources <- list(
  raw_source_record(ssb_metadata_path, "json", membership_dataset_id, TRUE, ssb_licence_name,
                    "SSB table 06929 metadata with category codes, labels, and 2005-2025 years."),
  raw_source_record(ssb_diocese_path, "json-stat2", membership_dataset_id, TRUE, ssb_licence_name,
                    "Twelve SSB geography categories: eleven mapped dioceses and Unknown diocese."),
  raw_source_record(ssb_national_path, "json-stat2", membership_dataset_id, TRUE, ssb_licence_name,
                    "Published national member series returned by omitting the optional diocese dimension."),
  raw_source_record(ssb_licence_path, "html", membership_dataset_id, FALSE, ssb_licence_name,
                    "SSB licence page confirming CC BY 4.0."),
  raw_source_record(geonorge_metadata_path, "json", boundary_dataset_id, TRUE, geonorge_licence_name,
                    "Geonorge metadata confirming direct diocese surfaces and the 1 January 2025 effective date."),
  raw_source_record(geonorge_capabilities_path, "json", boundary_dataset_id, TRUE, geonorge_licence_name,
                    "Geonorge download capability response pinning nationwide SOSI in EPSG:25833."),
  raw_source_record(geonorge_order_path, "json", boundary_dataset_id, TRUE, geonorge_licence_name,
                    "Geonorge order receipt with the exact SOSI download URL."),
  raw_source_record(geonorge_sosi_zip_path, "zip-sosi", boundary_dataset_id, TRUE, geonorge_licence_name,
                    "Kartverket Soknegrenser SOSI package containing eleven direct Bispedømme surfaces.")
)

version_hash <- substr(sha256_values(c(
  sha256_file(summary_json_out),
  sha256_file(summary_csv_out),
  sha256_file(boundary_out)
)), 1L, 12L)

manifest <- list(
  "$schema" = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v1",
  manifest_id = paste0("manifest:no-membership:no:2005-2025:", version_hash),
  dataset_id = "no-membership:no:2005-2025:ssb-geonorge",
  dataset_version_id = paste0("no-membership:no:2005-2025:ssb-geonorge:", version_hash),
  manifest_sha256 = NULL,
  supersedes_manifest_id = NULL,
  superseded_by_manifest_id = NULL,
  dataset_family = "no-membership",
  dataset_role = "public_product",
  scope = list(
    level = "country",
    country_codes = list(country_code),
    snapshot_date = NULL,
    snapshot_anchor = "12-31",
    pipeline_stage = "public"
  ),
  created_at = stamp,
  created_by = script_id,
  pipeline = list(
    script = script_id,
    git_commit = git_commit,
    command = paste("Rscript", script_id),
    parameters = list(
      years = as.list(years),
      geography = "eleven Church of Norway dioceses",
      boundary_vintage = "2025-01-01",
      boundary_route = "direct Kartverket Geonorge Soknegrenser Bispedømme surfaces",
      concordance = "not applicable because the successful direct-polygon route requires no kommune dissolve",
      source_category_code = "Medlemmer",
      source_category_label_verbatim = membership[["member_label"]],
      construct_notes = as.list(construct_notes(reconciliation)),
      indicators_block_declaration = paste(
        "The legacy religious_affiliation_count field carries Church of Norway",
        "administrative member-register counts. All percentage, population,",
        "no-religion, place, and land-area fields are null."
      ),
      ssb_diocese_api_request = ssb_diocese_request,
      ssb_national_api_request = ssb_national_request,
      geonorge_order_request = geonorge_order_request,
      boundary_simplification = boundary_result[["simplification"]],
      hard_gates = list(
        reconciliation = list(status = "passed", years = reconciliation),
        concordance_completeness = list(
          status = "not_applicable_direct_polygon_route",
          coverage_status = "passed",
          overlap_tolerance_sq_m = 1,
          source = boundary_result[["source_validation"]],
          simplified = boundary_result[["simplified_validation"]]
        ),
        geometry = list(
          status = "passed",
          feature_count = 11L,
          distinct_geometry_hash_count = 11L,
          hashes = boundary_result[["simplified_validation"]][["hashes"]]
        ),
        source_qualifier = list(
          status = "passed",
          unknown_diocese_verbatim = unknown_qualifier_verbatim
        ),
        svalbard_exclusion = list(
          status = "passed",
          mapped_max_latitude = boundary_result[["max_latitude"]]
        ),
        year_coverage = list(status = "passed", first_year = 2005L, last_year = 2025L, count = 21L),
        provenance = list(status = "passed", raw_sources = raw_sources)
      )
    ),
    software_versions = list(
      r = R.version.string,
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")),
      mapshaper = "npx mapshaper used through scripts/lib/simplify_boundary.R",
      curl = system2("curl", "--version", stdout = TRUE)[[1]]
    )
  ),
  source = list(
    provider = "Statistics Norway (SSB); Kartverket via Geonorge",
    source_dataset_ids = c(membership_dataset_id, boundary_dataset_id),
    source_urls = c(
      ssb_table_url,
      ssb_table_page_url,
      ssb_methodology_url,
      ssb_licence_url,
      rindal_transfer_url,
      nord_halogaland_scope_url,
      geonorge_catalogue_url,
      geonorge_metadata_url,
      geonorge_no_conditions_url
    ),
    retrieved_at = stamp,
    licence = paste(
      "SSB StatBank data and API content: CC BY 4.0 with Statistics Norway",
      "attribution. Geonorge Soknegrenser metadata: No conditions apply to",
      "access and use, with no public-access limitation."
    ),
    citation = paste(
      "Statistics Norway StatBank table 06929; Kartverket Geonorge",
      "Soknegrenser diocese surfaces effective 1 January 2025."
    )
  ),
  input_manifests = list(),
  durable_files = list(
    manifest_file_record(summary_json_out, "Norway diocese Church of Norway administrative membership area summary, 2005-2025."),
    manifest_file_record(summary_csv_out, "Flattened Norway diocese Church of Norway administrative membership rows."),
    manifest_file_record(boundary_out, "Simplified direct Kartverket Geonorge 2025 diocese geometry, eleven features.")
  ),
  stats = list(
    years = 21L,
    rows = length(rows),
    boundary_features = 11L,
    unknown_category_rows = 21L,
    boundary_bytes = file_bytes(boundary_out),
    summary_json_bytes = file_bytes(summary_json_out),
    summary_csv_bytes = file_bytes(summary_csv_out)
  ),
  local_cache_hint = "Raw SSB and Geonorge responses are cached under data/raw/no_membership/ and remain git-ignored.",
  validation = list(
    status = "passed_with_warnings",
    commands = list(
      "Rscript scripts/build_no_area_summary.R",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/area-summary.schema.json apps/regions/no/data/area_summary_diocese.json",
      "uvx check-jsonschema --base-uri file://$PWD/schemas/ --schemafile schemas/data-manifest.schema.json docs/manifests/no-membership-2005-2025.json",
      "jq empty apps/regions/no/data/area_summary_diocese.json docs/manifests/no-membership-2005-2025.json"
    ),
    warnings = c(
      paste(
        "Unknown diocese remains unallocated; mapped sums plus Unknown diocese reconcile exactly to SSB's national totals.",
        unknown_diocese_note(reconciliation)
      ),
      "The SSB member definition changes in 2021, and SSB warns that national totals from 2011 cannot be compared with earlier years because Unknown diocese was then included.",
      boundary_vintage_note(),
      svalbard_note(),
      "The direct Geonorge diocese surfaces extend through coastal waters; land_area_sq_km and density fields are null."
    ),
    notes = paste(
      "All hard gates passed. Eleven named diocese rows ship for every year 2005-2025.",
      "For every year, the eleven mapped counts plus SSB's Unknown diocese count",
      "equal the published national total exactly. Both source and simplified",
      "boundaries contain eleven valid, non-empty, distinct geometries, no",
      "interior coverage gaps, and overlap below the fixed 1 square metre tolerance."
    )
  ),
  privacy = "public",
  licence_status = "accepted",
  downstream_status = "public",
  notes = paste(
    "Administrative Church of Norway membership register product. The counts",
    "never measure census affiliation, belief, or attendance. SSB table 06339",
    "remains future national context and is excluded from this diocese product."
  )
)

write_json(
  manifest,
  manifest_out,
  auto_unbox = TRUE,
  pretty = TRUE,
  null = "null",
  na = "null",
  digits = NA
)

cat(sprintf("wrote %s: %d rows, %d bytes\n", summary_json_out, length(rows), file_bytes(summary_json_out)))
cat(sprintf("wrote %s: %d rows, %d bytes\n", summary_csv_out, row_count_file(summary_csv_out), file_bytes(summary_csv_out)))
cat(sprintf("wrote %s: %d features, %d bytes\n", boundary_out, row_count_file(boundary_out), file_bytes(boundary_out)))
cat(sprintf("wrote %s: %d bytes\n", manifest_out, file_bytes(manifest_out)))
cat("hard gates: reconciliation passed; direct-boundary coverage passed; geometry passed; source qualifier passed; Svalbard exclusion passed; year coverage passed; provenance passed\n")
