# Build slim dated OpenStreetMap place-of-worship products for country maps.
# Usage:
#   Rscript scripts/build_osm_dated_places_products.R
#   Rscript scripts/build_osm_dated_places_products.R --countries AU,BR --no-fetch

suppressPackageStartupMessages({
  library(digest)
  library(dplyr)
  library(jsonlite)
  library(purrr)
  library(sf)
})

repo_root <- normalizePath(
  if (basename(getwd()) == "scripts") ".." else ".",
  mustWork = TRUE
)

`%||%` <- function(x, y) {
  # return a fallback for null values while preserving explicit falsey values.
  if (is.null(x)) y else x
}

default_snapshot_date <- "2025-09-01"
default_countries <- c("AU", "BR", "CA", "MX", "UK", "PT", "SK")
default_object_types <- c("node", "way")
default_cache_dir <- file.path(tempdir(), "places-of-worship-dated-places-ohsome")
ohsome_endpoint <- "https://api.ohsome.org/v1/elements/centroid"
osm_attribution <- paste0(intToUtf8(169), " OpenStreetMap contributors, ODbL 1.0")
lifecycle_key_filter <- paste(
  "start_date=*",
  "old_start_date=*",
  "end_date=*",
  "disused:amenity=*",
  "abandoned:amenity=*",
  "was:amenity=*",
  "demolished:amenity=*",
  sep = " or "
)
strict_pow_filter <- "amenity=place_of_worship"

country_configs <- list(
  AU = list(
    boundary_files = "apps/regions/au/data/sa2_2021.geojson",
    bboxes = paste(
      "mainland_tas:112,-44,154,-10",
      "indian_ocean:96,-13,106,-9",
      "pacific_external:154,-32,169,-28",
      sep = "|"
    )
  ),
  BR = list(
    boundary_files = "apps/regions/br/data/br_municipality_2022.geojson",
    bboxes = "brazil:-74,-34,-32,6"
  ),
  CA = list(
    boundary_files = "apps/regions/ca/data/cd_2021.geojson",
    bboxes = paste(
      "west:-141,48,-114,70",
      "prairies:-114,49,-88,60",
      "ontario_south:-96,41,-74,56",
      "quebec_atlantic:-80,44,-52,63",
      "north:-141,60,-52,90",
      sep = "|"
    )
  ),
  MX = list(
    boundary_files = "apps/regions/mx/data/mx_municipality_2020.geojson",
    bboxes = "mexico:-119,14,-86,33"
  ),
  UK = list(
    boundary_files = c(
      "apps/regions/uk/data/ew_ltla_2021.geojson",
      "apps/regions/uk/data/sco_council_area_2019.geojson",
      "apps/regions/uk/data/ni_lgd_2012.geojson"
    ),
    bboxes = paste(
      "great_britain:-8.7,49.8,1.8,60.9",
      "northern_ireland:-8.3,54,-5.3,55.4",
      sep = "|"
    )
  ),
  PT = list(
    boundary_files = "apps/regions/pt/data/pt_municipality_caop2021.geojson",
    bboxes = paste(
      "mainland:-10,36.8,-6,42.2",
      "madeira:-17.5,31.5,-15.5,33.2",
      "azores:-32,36.5,-24,40.2",
      sep = "|"
    )
  ),
  SK = list(
    boundary_files = "apps/regions/sk/data/sk_municipality_2021.geojson",
    bboxes = "slovakia:16.8,47.7,22.6,49.7"
  )
)

parse_args <- function(args) {
  # parse command-line flags into countries, snapshot date, and fetch settings.
  countries <- default_countries
  snapshot_date <- default_snapshot_date
  object_types <- default_object_types
  cache_dir <- default_cache_dir
  fetch <- TRUE

  index <- 1L
  while (index <= length(args)) {
    arg <- args[[index]]
    if (arg == "--countries") {
      index <- index + 1L
      countries <- strsplit(args[[index]], ",", fixed = TRUE)[[1]] |>
        trimws() |>
        toupper()
    } else if (arg == "--snapshot-date") {
      index <- index + 1L
      snapshot_date <- args[[index]]
    } else if (arg == "--types") {
      index <- index + 1L
      object_types <- strsplit(args[[index]], ",", fixed = TRUE)[[1]] |>
        trimws()
    } else if (arg == "--cache-dir") {
      index <- index + 1L
      cache_dir <- args[[index]]
    } else if (arg == "--no-fetch") {
      fetch <- FALSE
    } else if (arg == "--help" || arg == "-h") {
      cat(
        "Build dated place-of-worship GeoJSON products from ohsome.\n\n",
        "Options:\n",
        "  --countries CSV       Country codes, default AU,BR,CA,MX,UK,PT,SK\n",
        "  --snapshot-date DATE  OSM snapshot date, default 2025-09-01\n",
        "  --types CSV           OSM object types, default node,way\n",
        "  --cache-dir DIR       Raw ohsome cache directory, default tempdir()\n",
        "  --no-fetch            Reuse cached raw ohsome files\n",
        "  --help                Show this help text\n",
        sep = ""
      )
      quit(save = "no", status = 0)
    } else {
      stop("Unknown argument: ", arg)
    }
    index <- index + 1L
  }

  unknown <- setdiff(countries, names(country_configs))
  if (length(unknown) > 0) {
    stop("Unsupported countries: ", paste(unknown, collapse = ", "))
  }

  list(
    countries = countries,
    snapshot_date = snapshot_date,
    object_types = object_types,
    cache_dir = cache_dir,
    fetch = fetch
  )
}

repo_relative <- function(path) {
  # express paths under the repository root in manifest-friendly form.
  sub(
    paste0("^", gsub("([\\^$.|?*+(){}\\[\\]\\\\])", "\\\\\\1", repo_root), "/?"),
    "",
    normalizePath(path, mustWork = FALSE)
  )
}

read_country_boundary <- function(country_code) {
  # load the country mask from the map's existing regional boundary files.
  files <- country_configs[[country_code]]$boundary_files
  pieces <- map(files, function(path) {
    full_path <- file.path(repo_root, path)
    if (!file.exists(full_path)) {
      stop("Boundary file not found: ", path)
    }
    st_read(full_path, quiet = TRUE) |>
      st_transform(4326) |>
      st_make_valid()
  })
  do.call(rbind, map(pieces, function(piece) piece[, 0]))
}

urlencode_query <- function(query) {
  # encode a named query list for a GET request.
  paste(
    paste0(names(query), "=", vapply(unlist(query), URLencode, character(1), reserved = TRUE)),
    collapse = "&"
  )
}

request_url <- function(country_code, object_type, snapshot_date) {
  # build the ohsome elements/centroid URL for one country and OSM object type.
  type_filter <- paste0(
    strict_pow_filter,
    " and (",
    lifecycle_key_filter,
    ") and type:",
    object_type
  )
  query <- list(
    bboxes = country_configs[[country_code]]$bboxes,
    time = snapshot_date,
    filter = type_filter,
    properties = "tags,metadata",
    clipGeometry = "false"
  )
  paste0(ohsome_endpoint, "?", urlencode_query(query))
}

fetch_ohsome <- function(country_code, object_type, snapshot_date, cache_dir, fetch) {
  # fetch or reuse one raw ohsome GeoJSON response.
  country_cache_dir <- file.path(cache_dir, tolower(country_code))
  dir.create(country_cache_dir, recursive = TRUE, showWarnings = FALSE)
  output_path <- file.path(
    country_cache_dir,
    paste0(tolower(country_code), "_", object_type, "_", snapshot_date, ".geojson")
  )

  if (isTRUE(fetch) || !file.exists(output_path)) {
    url <- request_url(country_code, object_type, snapshot_date)
    message("Fetching ", country_code, " ", object_type, " from ohsome...")
    status <- tryCatch(
      utils::download.file(url, output_path, quiet = TRUE, mode = "wb"),
      error = function(error) error
    )
    if (inherits(status, "error") || !identical(status, 0L)) {
      status_message <- if (inherits(status, "error")) conditionMessage(status) else as.character(status)
      stop("ohsome request failed for ", country_code, " ", object_type, ": ", status_message)
    }
  } else {
    message("Reusing cached ", country_code, " ", object_type, " ohsome response.")
  }

  output_path
}

read_ohsome_features <- function(raw_paths) {
  # read raw ohsome feature lists and attach their cache source path.
  map(raw_paths, function(path) {
    payload <- read_json(path, simplifyVector = FALSE)
    map(payload$features %||% list(), function(feature) {
      feature$properties[["@rawCachePath"]] <- path
      feature
    })
  }) |>
    flatten()
}

extract_tags <- function(properties) {
  # keep OSM tags and discard ohsome metadata properties.
  tag_names <- names(properties)[!startsWith(names(properties), "@")]
  properties[tag_names]
}

parse_osm_identity <- function(properties) {
  # parse ohsome metadata into a stable OSM type and numeric identifier.
  osm_type <- properties[["@osmType"]] %||% NA_character_
  osm_id <- properties[["@osmId"]] %||% NA_character_
  if (!is.na(osm_id) && grepl("/", as.character(osm_id), fixed = TRUE)) {
    parts <- strsplit(as.character(osm_id), "/", fixed = TRUE)[[1]]
    osm_type <- parts[[1]]
    osm_id <- parts[[2]]
  }
  list(osm_type = as.character(osm_type), osm_id = as.character(osm_id))
}

has_value <- function(value) {
  # test whether a scalar tag value contains non-blank text.
  !is.null(value) &&
    length(value) > 0 &&
    !is.na(value) &&
    trimws(as.character(value)) != ""
}

last_day_of_month <- function(year, month) {
  # return the last calendar day for a year-month pair.
  if (month == 12L) {
    return(as.Date(sprintf("%04d-12-31", year)))
  }
  as.Date(sprintf("%04d-%02d-01", year, month + 1L)) - 1L
}

parse_calendar_date <- function(value) {
  # parse simple OSM date strings into lower and upper date bounds.
  text <- trimws(value)
  if (grepl("^\\d{4}-\\d{2}-\\d{2}$", text)) {
    parsed <- suppressWarnings(as.Date(text))
    if (!is.na(parsed)) {
      return(list(lower = parsed, upper = parsed, precision = "day", warning = ""))
    }
  }

  month_match <- regexec("^(\\d{4})-(\\d{2})$", text)
  month_parts <- regmatches(text, month_match)[[1]]
  if (length(month_parts) == 3) {
    year <- as.integer(month_parts[[2]])
    month <- as.integer(month_parts[[3]])
    if (!is.na(year) && !is.na(month) && month >= 1L && month <= 12L) {
      return(list(
        lower = as.Date(sprintf("%04d-%02d-01", year, month)),
        upper = last_day_of_month(year, month),
        precision = "month",
        warning = ""
      ))
    }
  }

  if (grepl("^\\d{4}$", text)) {
    year <- as.integer(text)
    return(list(
      lower = as.Date(sprintf("%04d-01-01", year)),
      upper = as.Date(sprintf("%04d-12-31", year)),
      precision = "year",
      warning = ""
    ))
  }

  decade_match <- regexec("^(\\d{3})0s$", text)
  decade_parts <- regmatches(text, decade_match)[[1]]
  if (length(decade_parts) == 2) {
    decade <- as.integer(paste0(decade_parts[[2]], "0"))
    return(list(
      lower = as.Date(sprintf("%04d-01-01", decade)),
      upper = as.Date(sprintf("%04d-12-31", decade + 9L)),
      precision = "bounded",
      warning = "decade_date"
    ))
  }

  NULL
}

empty_lifecycle_parse <- function(raw = "", tag = "", source_year = "") {
  # represent missing or unsupported lifecycle evidence.
  list(
    raw = raw,
    tag = tag,
    source_year = source_year,
    lower = as.Date(NA),
    upper = as.Date(NA),
    precision = "unknown",
    warning = if (has_value(raw)) "unsupported_date" else ""
  )
}

combine_warnings <- function(warnings) {
  # combine parser warnings into one stable semicolon-separated string.
  paste(unique(warnings[warnings != ""]), collapse = ";")
}

parse_lifecycle_date_value <- function(value, tag, source_year = "") {
  # parse the lifecycle date grammar used by the NZ OSM temporal extractor.
  raw <- trimws(as.character(value %||% ""))
  if (!has_value(raw)) {
    return(empty_lifecycle_parse(tag = tag, source_year = source_year))
  }

  text <- tolower(raw)
  warnings <- character()

  if (grepl("[;,]", text)) {
    pieces <- unlist(strsplit(text, "[;,]", perl = TRUE), use.names = FALSE)
    text <- trimws(pieces[[1]])
    warnings <- c(warnings, "multiple_values_first_used")
  }

  if (grepl("^(c\\.?|ca\\.?|circa|about|approx\\.?|approximately|~)\\s+", text)) {
    text <- sub("^(c\\.?|ca\\.?|circa|about|approx\\.?|approximately|~)\\s+", "", text)
    warnings <- c(warnings, "approximate_date")
  }

  range_match <- regexec("^(\\d{4})\\s*[-/]\u2013?\\s*(\\d{4})$", text)
  range_parts <- regmatches(text, range_match)[[1]]
  if (length(range_parts) != 3) {
    range_match <- regexec("^(\\d{4})\\s*[-\u2013/]\\s*(\\d{4})$", text)
    range_parts <- regmatches(text, range_match)[[1]]
  }
  if (length(range_parts) == 3) {
    start_year <- as.integer(range_parts[[2]])
    end_year <- as.integer(range_parts[[3]])
    if (!is.na(start_year) && !is.na(end_year) && start_year <= end_year) {
      return(list(
        raw = raw,
        tag = tag,
        source_year = source_year,
        lower = as.Date(sprintf("%04d-01-01", start_year)),
        upper = as.Date(sprintf("%04d-12-31", end_year)),
        precision = "bounded",
        warning = combine_warnings(c(warnings, "bounded_range"))
      ))
    }
  }

  before_match <- regexec("^before\\s+(.+)$", text)
  before_parts <- regmatches(text, before_match)[[1]]
  if (length(before_parts) == 2) {
    parsed <- parse_calendar_date(before_parts[[2]])
    if (!is.null(parsed)) {
      return(list(
        raw = raw,
        tag = tag,
        source_year = source_year,
        lower = as.Date(NA),
        upper = parsed$lower - 1L,
        precision = "bounded",
        warning = combine_warnings(c(warnings, "before_date"))
      ))
    }
  }

  after_match <- regexec("^after\\s+(.+)$", text)
  after_parts <- regmatches(text, after_match)[[1]]
  if (length(after_parts) == 2) {
    parsed <- parse_calendar_date(after_parts[[2]])
    if (!is.null(parsed)) {
      return(list(
        raw = raw,
        tag = tag,
        source_year = source_year,
        lower = parsed$upper + 1L,
        upper = as.Date(NA),
        precision = "bounded",
        warning = combine_warnings(c(warnings, "after_date"))
      ))
    }
  }

  parsed <- parse_calendar_date(text)
  if (!is.null(parsed)) {
    return(list(
      raw = raw,
      tag = tag,
      source_year = source_year,
      lower = parsed$lower,
      upper = parsed$upper,
      precision = parsed$precision,
      warning = combine_warnings(c(warnings, parsed$warning))
    ))
  }

  parse <- empty_lifecycle_parse(raw, tag, source_year)
  parse$warning <- combine_warnings(c(warnings, parse$warning))
  parse
}

date_for_ordering <- function(parse) {
  # choose the earliest usable bound for ordering competing lifecycle tags.
  if (!is.na(parse$lower)) return(parse$lower)
  if (!is.na(parse$upper)) return(parse$upper)
  as.Date(NA)
}

choose_earliest_parse <- function(parses) {
  # choose the lifecycle parse with the earliest usable date.
  parses <- keep(parses, function(parse) has_value(parse$raw))
  if (length(parses) == 0) return(empty_lifecycle_parse())

  order_values <- map_dbl(parses, function(parse) {
    date <- date_for_ordering(parse)
    if (is.na(date)) Inf else as.numeric(date)
  })
  if (all(is.infinite(order_values))) return(parses[[1]])

  parses[[which.min(order_values)]]
}

former_use_tags <- function(tags) {
  # collect former-use OSM lifecycle tags that the NZ extractor recognises.
  tag_names <- names(tags) %||% character()
  tag_names <- tag_names[!is.na(tag_names) & tag_names != ""]
  former_names <- tag_names[grepl("^(disused|abandoned|was|demolished):", tag_names)]
  if (length(former_names) == 0) return(character())
  values <- map_chr(former_names, function(name) as.character(tags[[name]] %||% ""))
  keep <- values != ""
  if (!any(keep)) return(character())
  paste0(former_names[keep], "=", values[keep])
}

collect_lifecycle_parses <- function(tags, fields) {
  # parse all present lifecycle date values from the requested OSM tag fields.
  parses <- list()
  for (field in fields) {
    value <- tags[[field]] %||% ""
    if (has_value(value)) {
        parses <- c(parses, list(parse_lifecycle_date_value(value, field)))
    }
  }
  parses
}

collect_former_use_parse <- function(tags, snapshot_date) {
  # convert former-use tags into the bounded observation used by the NZ extractor.
  tags <- former_use_tags(tags)
  if (length(tags) > 0) {
    return(list(
      raw = paste(tags, collapse = ";"),
      tag = "former_use_tags",
      source_year = substr(snapshot_date, 1L, 4L),
      lower = as.Date(NA),
      upper = as.Date(snapshot_date),
      precision = "bounded",
      warning = "former_use_observation_not_later_than_snapshot"
    ))
  }
  empty_lifecycle_parse()
}

extract_first_year <- function(raw) {
  # fall back to the first four-digit year in unsupported lifecycle text.
  if (!has_value(raw)) return(NA_integer_)
  match <- regmatches(raw, regexpr("\\d{4}", raw, perl = TRUE))
  if (length(match) == 0 || match == "") return(NA_integer_)
  as.integer(match)
}

start_year_from_parse <- function(parse) {
  # derive the map start year from the earliest origin bound available.
  if (!is.na(parse$lower)) return(as.integer(format(parse$lower, "%Y")))
  if (!is.na(parse$upper)) return(as.integer(format(parse$upper, "%Y")))
  extract_first_year(parse$raw)
}

end_year_from_parse <- function(parse) {
  # derive the map end year from the latest closure bound available.
  if (!is.na(parse$upper)) return(as.integer(format(parse$upper, "%Y")))
  extract_first_year(parse$raw)
}

null_if_blank <- function(value) {
  # convert blank OSM tag values into JSON nulls.
  if (!has_value(value)) NA_character_ else as.character(value)
}

feature_key <- function(feature) {
  # construct a unique OSM key for de-duplicating overlapping bbox results.
  identity <- parse_osm_identity(feature$properties %||% list())
  paste(identity$osm_type, identity$osm_id, sep = "/")
}

dedupe_features <- function(features) {
  # keep the first feature for each OSM object returned by overlapping bboxes.
  if (length(features) == 0) return(features)
  keys <- map_chr(features, feature_key)
  features[!duplicated(keys)]
}

features_to_points <- function(features) {
  # convert ohsome point features into an sf object for country-mask filtering.
  if (length(features) == 0) {
    return(st_as_sf(
      data.frame(feature_index = integer(), lon = numeric(), lat = numeric()),
      coords = c("lon", "lat"),
      crs = 4326,
      remove = FALSE
    ))
  }

  rows <- imap(features, function(feature, index) {
    coords <- feature$geometry$coordinates %||% c(NA_real_, NA_real_)
    data.frame(
      feature_index = index,
      lon = as.numeric(coords[[1]] %||% NA_real_),
      lat = as.numeric(coords[[2]] %||% NA_real_)
    )
  }) |>
    bind_rows()

  rows <- rows[!is.na(rows$lon) & !is.na(rows$lat), ]
  st_as_sf(rows, coords = c("lon", "lat"), crs = 4326, remove = FALSE)
}

filter_features_to_country <- function(features, boundary) {
  # keep only ohsome centroids inside or touching the local country mask.
  if (length(features) == 0) return(features)
  points <- features_to_points(features)
  if (nrow(points) == 0) return(list())
  inside <- lengths(st_intersects(points, boundary)) > 0
  feature_indices <- points$feature_index[inside]
  features[feature_indices]
}

feature_to_product_feature <- function(feature, snapshot_date) {
  # transform one ohsome feature into the dated_places.geojson schema.
  properties <- feature$properties %||% list()
  tags <- extract_tags(properties)
  identity <- parse_osm_identity(properties)
  coords <- feature$geometry$coordinates %||% c(NA_real_, NA_real_)

  origin <- choose_earliest_parse(collect_lifecycle_parses(tags, c("old_start_date", "start_date")))
  closure <- choose_earliest_parse(c(
    collect_lifecycle_parses(tags, "end_date"),
    list(collect_former_use_parse(tags, snapshot_date))
  ))

  start_date <- if (has_value(origin$raw)) origin$raw else NA_character_
  end_date <- if (has_value(closure$raw)) {
    if (identical(closure$tag, "former_use_tags")) snapshot_date else closure$raw
  } else {
    NA_character_
  }

  list(
    type = "Feature",
    geometry = list(
      type = "Point",
      coordinates = list(round(as.numeric(coords[[1]]), 5), round(as.numeric(coords[[2]]), 5))
    ),
    properties = list(
      osm_type = identity$osm_type,
      osm_id = as.numeric(identity$osm_id),
      name = null_if_blank(tags[["name"]] %||% tags[["name:en"]] %||% NA_character_),
      religion = null_if_blank(tags[["religion"]] %||% NA_character_),
      denomination = null_if_blank(tags[["denomination"]] %||% NA_character_),
      start_date = start_date,
      end_date = end_date,
      start_year = start_year_from_parse(origin),
      end_year = end_year_from_parse(closure)
    )
  )
}

sort_product_features <- function(features) {
  # order features stably by lifecycle year, name, OSM type, and OSM ID.
  if (length(features) == 0) return(features)
  order_values <- map(features, function(feature) {
    props <- feature$properties
    list(
      is_missing_start = is.na(props$start_year),
      start_year = props$start_year %||% Inf,
      end_year = props$end_year %||% Inf,
      name = tolower(props$name %||% ""),
      osm_type = props$osm_type %||% "",
      osm_id = props$osm_id %||% Inf
    )
  })
  indices <- order(
    map_lgl(order_values, "is_missing_start"),
    map_dbl(order_values, "start_year"),
    map_dbl(order_values, "end_year"),
    map_chr(order_values, "name"),
    map_chr(order_values, "osm_type"),
    map_dbl(order_values, "osm_id"),
    na.last = TRUE
  )
  features[indices]
}

write_product <- function(country_code, features) {
  # write the compact public dated_places.geojson product for one country.
  output_path <- file.path(
    repo_root,
    "apps",
    "regions",
    tolower(country_code),
    "data",
    "dated_places.geojson"
  )
  product <- list(
    type = "FeatureCollection",
    attribution = osm_attribution,
    features = sort_product_features(features)
  )
  write_json(product, output_path, auto_unbox = TRUE, null = "null", na = "null", digits = NA)
  output_path
}

sha256_file <- function(path) {
  # compute a SHA-256 digest for a generated file.
  digest(file = path, algo = "sha256")
}

build_country <- function(country_code, args) {
  # fetch, filter, transform, and write one country's dated product.
  raw_paths <- map_chr(args$object_types, function(object_type) {
    fetch_ohsome(country_code, object_type, args$snapshot_date, args$cache_dir, args$fetch)
  })
  raw_features <- read_ohsome_features(raw_paths)
  raw_features <- dedupe_features(raw_features)
  boundary <- read_country_boundary(country_code)
  country_features <- filter_features_to_country(raw_features, boundary)
  product_features <- map(country_features, function(feature) {
    feature_to_product_feature(feature, args$snapshot_date)
  })
  output_path <- write_product(country_code, product_features)

  list(
    country_code = country_code,
    raw_paths = raw_paths,
    bboxes = country_configs[[country_code]]$bboxes,
    boundary_files = country_configs[[country_code]]$boundary_files,
    raw_feature_count = length(raw_features),
    country_feature_count = length(country_features),
    output_feature_count = length(product_features),
    output_path = output_path,
    output_sha256 = sha256_file(output_path),
    output_bytes = file.info(output_path)$size
  )
}

country_result_manifest <- function(result, args, retrieved_at) {
  # describe one country result for the manifest's raw source section.
  list(
    country_code = result$country_code,
    provider = "OpenStreetMap via ohsome API",
    endpoint = ohsome_endpoint,
    retrieved_at = retrieved_at,
    snapshot_date = args$snapshot_date,
    bboxes = result$bboxes,
    filter = paste0(strict_pow_filter, " and (", lifecycle_key_filter, ")"),
    object_types = as.list(args$object_types),
    raw_cache_files = as.list(result$raw_paths),
    raw_feature_count = result$raw_feature_count,
    country_feature_count = result$country_feature_count,
    output_feature_count = result$output_feature_count,
    boundary_files = as.list(result$boundary_files)
  )
}

write_manifest <- function(results, args, retrieved_at) {
  # write one data-manifest entry covering all country dated products.
  combined_hash <- digest(paste(map_chr(results, "output_sha256"), collapse = "\n"), algo = "sha256")
  short_id <- substr(combined_hash, 1L, 12L)
  manifest_path <- file.path(
    repo_root,
    "docs",
    "manifests",
    paste0("osm-pow-dated-7countries-", short_id, ".json")
  )
  git_commit <- tryCatch(
    system2("git", c("rev-parse", "--short=12", "HEAD"), stdout = TRUE, stderr = FALSE)[[1]],
    error = function(error) "unknown"
  )
  if (!grepl("^[a-f0-9]{7,40}$", git_commit)) {
    git_commit <- "0000000"
  }

  durable_files <- map(results, function(result) {
    list(
      uri = paste0("repo:", repo_relative(result$output_path)),
      storage_provider = "other",
      format = "geojson",
      bytes = unname(as.integer(result$output_bytes)),
      sha256 = result$output_sha256,
      content_sha256 = NULL,
      row_count = NULL,
      feature_count = result$output_feature_count,
      content = paste0(
        result$country_code,
        " OSM date-tag places of worship product for country map period mode."
      ),
      privacy = "public",
      licence_status = "accepted"
    )
  })

  partitions <- map(results, function(result) {
    list(
      partition_id = paste0("country:", result$country_code),
      partition_type = "country",
      country_code = result$country_code,
      file_uri = paste0("repo:", repo_relative(result$output_path)),
      sha256 = result$output_sha256,
      row_count = NULL,
      feature_count = result$output_feature_count
    )
  })

  country_counts <- setNames(
    map_int(results, "output_feature_count"),
    paste0(tolower(map_chr(results, "country_code")), "_feature_count")
  )
  raw_counts <- setNames(
    map_int(results, "raw_feature_count"),
    paste0(tolower(map_chr(results, "country_code")), "_raw_lifecycle_feature_count")
  )

  manifest <- list(
    `$schema` = "../../schemas/data-manifest.schema.json",
    schema_version = "data-manifest.v1",
    manifest_id = paste0("manifest:osm-pow:dated-7countries:", short_id),
    dataset_id = "osm-pow-dated-7countries",
    dataset_version_id = paste0("osm-pow-dated-7countries:", short_id),
    manifest_sha256 = NULL,
    supersedes_manifest_id = NULL,
    superseded_by_manifest_id = NULL,
    dataset_family = "osm-pow",
    dataset_role = "public_product",
    scope = list(
      level = "country",
      country_codes = as.list(map_chr(results, "country_code")),
      snapshot_date = args$snapshot_date,
      snapshot_anchor = substr(args$snapshot_date, 6L, 10L),
      pipeline_stage = "public"
    ),
    created_at = retrieved_at,
    created_by = "scripts/build_osm_dated_places_products.R",
    pipeline = list(
      script = "scripts/build_osm_dated_places_products.R",
      git_commit = git_commit,
      command = paste(
        "Rscript scripts/build_osm_dated_places_products.R",
        "--countries",
        paste(args$countries, collapse = ","),
        "--snapshot-date",
        args$snapshot_date,
        "--cache-dir",
        args$cache_dir
      ),
      parameters = list(
        snapshot_date = args$snapshot_date,
        types = paste(args$object_types, collapse = ","),
        strict_filter = strict_pow_filter,
        lifecycle_key_filter = lifecycle_key_filter,
        provider_endpoint = ohsome_endpoint,
        raw_sources = map(results, country_result_manifest, args = args, retrieved_at = retrieved_at)
      ),
      software_versions = list(
        r = paste(R.version$major, R.version$minor, sep = "."),
        sf = as.character(packageVersion("sf")),
        jsonlite = as.character(packageVersion("jsonlite")),
        digest = as.character(packageVersion("digest"))
      )
    ),
    source = list(
      provider = "OpenStreetMap via ohsome API",
      source_dataset_ids = list("osm-ohsome-elements-centroid"),
      source_urls = list(ohsome_endpoint, "https://www.openstreetmap.org/copyright"),
      retrieved_at = retrieved_at,
      licence = "ODbL-1.0",
      citation = "OpenStreetMap contributors; ohsome API."
    ),
    input_manifests = list(),
    durable_files = durable_files,
    partitions = partitions,
    stats = c(
      list(
        country_count = length(results),
        total_feature_count = sum(map_int(results, "output_feature_count")),
        total_raw_lifecycle_feature_count = sum(map_int(results, "raw_feature_count"))
      ),
      as.list(country_counts),
      as.list(raw_counts)
    ),
    local_cache_hint = args$cache_dir,
    validation = list(
      status = "passed_with_warnings",
      commands = c(
        list(
          paste(
            "Rscript scripts/build_osm_dated_places_products.R --countries",
            paste(args$countries, collapse = ","),
            "--snapshot-date",
            args$snapshot_date,
            "--cache-dir",
            args$cache_dir
          ),
          paste0(
            "Rscript -e 'jsonlite::validate(paste(readLines(\"",
            repo_relative(manifest_path),
            "\", warn = FALSE), collapse = \"\\\\n\"))'"
          )
        ),
        map(results, function(result) {
          paste0(
            "Rscript -e 'jsonlite::validate(paste(readLines(\"",
            repo_relative(result$output_path),
            "\", warn = FALSE), collapse = \"\\\\n\"))'"
          )
        })
      ),
      warnings = list(
        "OSM date tags are provisional lifecycle evidence, not accepted historical worship-use states.",
        "Country extraction uses named ohsome bboxes followed by exact local boundary filtering."
      ),
      notes = "Generated dated_places.geojson products for country-map period mode."
    ),
    privacy = "public",
    licence_status = "accepted",
    downstream_status = "public",
    notes = "Products include only amenity=place_of_worship node/way objects carrying start_date, old_start_date, end_date, or NZ-extractor former-use lifecycle tags at the selected OSM snapshot."
  )

  write_json(manifest, manifest_path, pretty = TRUE, auto_unbox = TRUE, null = "null", na = "null", digits = NA)
  manifest_path
}

main <- function() {
  # run the dated-place product build for the requested countries.
  options(timeout = 900)
  sf_use_s2(FALSE)
  args <- parse_args(commandArgs(trailingOnly = TRUE))
  dir.create(args$cache_dir, recursive = TRUE, showWarnings = FALSE)
  retrieved_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")

  results <- map(args$countries, function(country_code) build_country(country_code, args))
  manifest_path <- write_manifest(results, args, retrieved_at)

  message("Wrote manifest: ", repo_relative(manifest_path))
  walk(results, function(result) {
    message(
      result$country_code,
      ": ",
      result$output_feature_count,
      " features -> ",
      repo_relative(result$output_path)
    )
  })
}

if (identical(environment(), globalenv())) {
  main()
}
