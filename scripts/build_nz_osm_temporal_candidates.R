# Build cleaned New Zealand OSM temporal candidate diffs.
# Usage:
#   Rscript scripts/build_nz_osm_temporal_candidates.R
#   Rscript scripts/build_nz_osm_temporal_candidates.R --bbox 174.6,-41.4,175.1,-41.0
#   Rscript scripts/build_nz_osm_temporal_candidates.R --no-fetch

suppressPackageStartupMessages({
  library(dplyr)
  library(httr)
  library(jsonlite)
  library(purrr)
})

repo_root <- normalizePath(
  if (basename(getwd()) == "scripts") ".." else ".",
  mustWork = TRUE
)

source(file.path(repo_root, "scripts", "clean_global_places.R"), local = FALSE)

default_snapshot_years <- 2013L:2025L
default_task_years <- c(2013L, 2018L, 2023L)
default_snapshot_month_day <- "09-01"
default_osm_object_types <- c("node", "way")
default_bboxes <- "main_nz:166,-53,180,-28|chatham:-180,-53,-175,-28"
broad_filter <- paste(
  "(",
  "amenity=place_of_worship",
  "or building in (church,chapel,cathedral,mosque,synagogue,temple,gurdwara,shrine,monastery)",
  "or religion=*",
  ")"
)
strict_filter <- "amenity=place_of_worship"

parse_years <- function(value) {
  pieces <- unlist(strsplit(value, ",", fixed = TRUE), use.names = FALSE) |>
    trimws()
  years <- map(pieces, \(piece) {
    range_match <- regexec("^(\\d{4})(:|-)(\\d{4})$", piece)
    matched <- regmatches(piece, range_match)[[1]]
    if (length(matched) == 4) {
      from <- as.integer(matched[[2]])
      to <- as.integer(matched[[4]])
      return(seq.int(from, to))
    }

    as.integer(piece)
  }) |>
    unlist(use.names = FALSE)

  if (length(years) == 0 || any(is.na(years))) {
    stop("Could not parse years: ", value)
  }
  sort(unique(years))
}

build_snapshot_dates <- function(years, snapshot_month_day) {
  if (!grepl("^\\d{2}-\\d{2}$", snapshot_month_day)) {
    stop("--snapshot-month-day must use MM-DD format")
  }

  setNames(paste0(years, "-", snapshot_month_day), as.character(years))
}

parse_args <- function(args) {
  output_dir <- file.path("data", "intermediate", "nz_osm_temporal")
  bboxes <- default_bboxes
  fetch <- TRUE
  osm_filter <- strict_filter
  osm_object_types <- default_osm_object_types
  timeout_seconds <- 180
  snapshot_years <- default_snapshot_years
  task_years <- default_task_years
  snapshot_month_day <- default_snapshot_month_day

  index <- 1
  while (index <= length(args)) {
    arg <- args[[index]]
    if (arg == "--output-dir") {
      index <- index + 1
      output_dir <- args[[index]]
    } else if (arg == "--bbox" || arg == "--bboxes") {
      index <- index + 1
      bboxes <- args[[index]]
    } else if (arg == "--no-fetch") {
      fetch <- FALSE
    } else if (arg == "--broad") {
      osm_filter <- broad_filter
    } else if (arg == "--types") {
      index <- index + 1
      osm_object_types <- strsplit(args[[index]], ",", fixed = TRUE)[[1]] |>
        trimws()
    } else if (arg == "--timeout-seconds") {
      index <- index + 1
      timeout_seconds <- as.numeric(args[[index]])
    } else if (arg == "--years" || arg == "--snapshot-years") {
      index <- index + 1
      snapshot_years <- parse_years(args[[index]])
    } else if (arg == "--task-years") {
      index <- index + 1
      task_years <- parse_years(args[[index]])
    } else if (arg == "--snapshot-month-day") {
      index <- index + 1
      snapshot_month_day <- args[[index]]
    } else if (arg == "--help" || arg == "-h") {
      cat(
        "Build cleaned NZ OSM temporal candidate leads.\n\n",
        "Options:\n",
        "  --output-dir DIR   Output directory (default: data/intermediate/nz_osm_temporal)\n",
        "  --bbox BBOXES      ohsome bboxes string; use for small-area smoke tests\n",
        "  --no-fetch         Reuse existing raw GeoJSON files in the output directory\n",
        "  --broad            Include building and religion-tag candidates; slower/noisier\n",
        "  --types CSV        OSM object types, default node,way; add relation explicitly\n",
        "  --timeout-seconds N  Per-request timeout, default 180\n",
        "  --years SPEC       Snapshot years, default 2013:2025; accepts 2013:2025 or CSV\n",
        "  --task-years SPEC  Target years to highlight for RA review, default 2013,2018,2023\n",
        "  --snapshot-month-day MM-DD  Annual anchor, default 09-01\n",
        "  --help             Show this help text\n",
        sep = ""
      )
      quit(save = "no", status = 0)
    } else {
      stop("Unknown argument: ", arg)
    }
    index <- index + 1
  }

  snapshot_dates <- build_snapshot_dates(snapshot_years, snapshot_month_day)
  if (!all(task_years %in% snapshot_years)) {
    stop("--task-years must be included in --years")
  }

  list(
    output_dir = output_dir,
    bboxes = bboxes,
    fetch = fetch,
    osm_filter = osm_filter,
    osm_object_types = osm_object_types,
    timeout_seconds = timeout_seconds,
    snapshot_years = snapshot_years,
    snapshot_dates = snapshot_dates,
    task_years = task_years,
    snapshot_month_day = snapshot_month_day
  )
}

normalise_religion_value <- function(religion_value) {
  if (is.null(religion_value) || is.na(religion_value) || religion_value == "") {
    return("unknown")
  }

  religion_value <- tolower(religion_value)

  case_when(
    religion_value %in% c("christian", "christianity", "catholic", "protestant", "orthodox", "baptist", "methodist", "pentecostal") ~ "christian",
    religion_value %in% c("muslim", "islam", "sunni", "shia", "islamic") ~ "muslim",
    religion_value %in% c("jewish", "judaism") ~ "jewish",
    religion_value %in% c("hindu", "hinduism") ~ "hindu",
    religion_value %in% c("buddhist", "buddhism") ~ "buddhist",
    religion_value %in% c("sikh", "sikhism") ~ "sikh",
    religion_value %in% c("shinto") ~ "shinto",
    religion_value %in% c("taoist", "taoism", "daoism") ~ "taoist",
    religion_value %in% c("bahai", "baha'i", "bahá'í") ~ "bahai",
    TRUE ~ "unknown"
  )
}

parse_osm_identity <- function(properties) {
  osm_type <- properties[["@osmType"]] %||% NA_character_
  osm_id <- properties[["@osmId"]] %||% properties[["@osmId"]] %||% NA_character_

  if (!is.na(osm_id) && grepl("/", as.character(osm_id), fixed = TRUE)) {
    parts <- strsplit(as.character(osm_id), "/", fixed = TRUE)[[1]]
    osm_type <- parts[[1]]
    osm_id <- parts[[2]]
  }

  list(
    osm_type = as.character(osm_type),
    osm_id = as.character(osm_id)
  )
}

extract_tags <- function(properties) {
  tag_names <- names(properties)[!startsWith(names(properties), "@")]
  properties[tag_names]
}

address_from_tags <- function(tags) {
  parts <- c(
    tags[["addr:housenumber"]],
    tags[["addr:street"]],
    tags[["addr:suburb"]],
    tags[["addr:city"]],
    tags[["addr:postcode"]]
  )
  parts <- parts[!is.na(parts) & parts != ""]
  paste(parts, collapse = ", ")
}

feature_to_record <- function(feature, snapshot_year, snapshot_date) {
  properties <- feature$properties %||% list()
  tags <- extract_tags(properties)
  identity <- parse_osm_identity(properties)
  coordinates <- feature$geometry$coordinates %||% c(NA_real_, NA_real_)
  osm_type <- identity$osm_type
  osm_id <- identity$osm_id
  prefix <- substr(osm_type, 1, 1)

  list(
    id = paste0(prefix, osm_id),
    osm_id = osm_id,
    osm_type = osm_type,
    source_layer = "ohsome_centroid",
    lat = as.numeric(coordinates[[2]] %||% NA_real_),
    lng = as.numeric(coordinates[[1]] %||% NA_real_),
    name = tags[["name"]] %||% tags[["name:en"]] %||% "Unnamed Place of Worship",
    religion = normalise_religion_value(tags[["religion"]] %||% ""),
    denomination = tags[["denomination"]] %||% "",
    confidence = 0.5,
    country_code = "NZ",
    type = "churches",
    website = tags[["website"]] %||% tags[["contact:website"]] %||% "",
    phone = tags[["phone"]] %||% tags[["contact:phone"]] %||% "",
    address = address_from_tags(tags),
    start_date = tags[["start_date"]] %||% NA_character_,
    snapshot_year = snapshot_year,
    snapshot_date = snapshot_date,
    osm_valid_from = properties[["@validFrom"]] %||% properties[["@timestamp"]] %||% NA_character_,
    osm_version = properties[["@version"]] %||% NA_character_,
    tags_raw = tags
  )
}

fetch_snapshot_type <- function(snapshot_date, bboxes, osm_filter, object_type, timeout_seconds) {
  message("  - ", object_type)
  type_filter <- if (identical(osm_filter, strict_filter)) {
    paste(osm_filter, "and", paste0("type:", object_type))
  } else {
    paste0("(", osm_filter, ") and type:", object_type)
  }

  response <- GET(
    "https://api.ohsome.org/v1/elements/centroid",
    timeout(timeout_seconds),
    user_agent("places-of-worship temporal OSM cleaning pilot"),
    query = list(
      bboxes = bboxes,
      time = snapshot_date,
      filter = type_filter,
      properties = "tags,metadata",
      clipGeometry = "false"
    )
  )

  if (http_error(response)) {
    stop(
      "ohsome request failed for ", snapshot_date, " ", object_type, ": ",
      status_code(response), " ", content(response, as = "text", encoding = "UTF-8")
    )
  }

  content(response, as = "parsed", type = "application/json", encoding = "UTF-8")
}

fetch_snapshot <- function(snapshot_date, bboxes, osm_filter, osm_object_types, timeout_seconds, output_path) {
  message("Fetching OSM snapshot from ohsome for ", snapshot_date, "...")
  payloads <- map(osm_object_types, \(object_type) {
    fetch_snapshot_type(snapshot_date, bboxes, osm_filter, object_type, timeout_seconds)
  })

  features <- payloads |>
    map(\(payload) payload$features %||% list()) |>
    flatten()

  combined <- list(
    attribution = payloads[[1]]$attribution %||% list(),
    apiVersion = payloads[[1]]$apiVersion %||% NA_character_,
    type = "FeatureCollection",
    features = features
  )

  write_json(combined, output_path, pretty = TRUE, auto_unbox = TRUE, null = "null")
  output_path
}

normalise_snapshot <- function(raw_path, snapshot_year, snapshot_date, output_dir) {
  payload <- read_json(raw_path, simplifyVector = FALSE)
  records <- map(payload$features %||% list(), \(feature) {
    feature_to_record(feature, snapshot_year, snapshot_date)
  })

  normalised_path <- file.path(output_dir, paste0("nz_osm_", snapshot_year, "_normalised.json"))
  write_json(records, normalised_path, pretty = TRUE, auto_unbox = TRUE, null = "null")

  cleaned <- keep(records, \(record) keep_record(record, records))
  cleaned_path <- file.path(output_dir, paste0("nz_osm_", snapshot_year, "_cleaned.json"))
  write_json(cleaned, cleaned_path, pretty = TRUE, auto_unbox = TRUE, null = "null")

  list(
    year = snapshot_year,
    date = snapshot_date,
    raw_path = raw_path,
    normalised_path = normalised_path,
    cleaned_path = cleaned_path,
    normalised_count = length(records),
    cleaned_count = length(cleaned),
    records = cleaned
  )
}

osm_key <- function(record) {
  paste0(record$osm_type %||% "unknown", "/", record$osm_id %||% record$id)
}

record_value <- function(record, field) {
  if (is.null(record)) return("")
  value <- record[[field]] %||% ""
  if (length(value) == 0 || is.na(value)) "" else as.character(value)
}

tag_value <- function(record, field) {
  if (is.null(record)) return("")
  tags <- record$tags_raw %||% list()
  value <- tags[[field]] %||% ""
  if (length(value) == 0 || is.na(value)) "" else as.character(value)
}

repo_relative <- function(path) {
  sub(
    paste0("^", gsub("([\\^$.|?*+(){}\\[\\]\\\\])", "\\\\\\1", repo_root), "/?"),
    "",
    normalizePath(path, mustWork = FALSE)
  )
}

has_tag_change <- function(records_by_year) {
  values <- map_chr(records_by_year, \(record) paste(
    record_value(record, "name"),
    record_value(record, "religion"),
    record_value(record, "denomination"),
    tag_value(record, "amenity"),
    tag_value(record, "building"),
    sep = "||"
  ))
  length(unique(values[values != "||||"])) > 1
}

collapse_year_values <- function(records_by_year, field) {
  paste(
    map_chr(names(records_by_year), \(year) {
      value <- record_value(records_by_year[[year]], field)
      paste0(year, "=", value)
    }),
    collapse = " | "
  )
}

collapse_tag_values <- function(records_by_year, field) {
  paste(
    map_chr(names(records_by_year), \(year) {
      value <- tag_value(records_by_year[[year]], field)
      paste0(year, "=", value)
    }),
    collapse = " | "
  )
}

latest_present_record <- function(records_by_year) {
  present <- compact(records_by_year)
  if (length(present) == 0) return(NULL)
  present[[length(present)]]
}

collapse_presence_values <- function(present_by_year, years = names(present_by_year)) {
  paste(
    map_chr(years, \(year) {
      value <- present_by_year[[as.character(year)]] %||% FALSE
      state <- if (isTRUE(value)) "present" else "absent"
      paste0(year, "=", state)
    }),
    collapse = " | "
  )
}

detect_presence_transitions <- function(present_by_year, snapshot_dates) {
  years <- names(present_by_year)
  if (length(years) < 2) return(data.frame())

  rows <- map(seq_len(length(years) - 1), \(index) {
    from_year <- years[[index]]
    to_year <- years[[index + 1]]
    from_present <- present_by_year[[from_year]] %||% FALSE
    to_present <- present_by_year[[to_year]] %||% FALSE

    if (isTRUE(from_present) && !isTRUE(to_present)) {
      return(data.frame(
        from_year = as.integer(from_year),
        to_year = as.integer(to_year),
        transition_type = "osm_present_then_absent",
        diff_category = paste0("osm_present_", from_year, "_absent_", to_year),
        transition_window = paste0(snapshot_dates[[from_year]], "/", snapshot_dates[[to_year]]),
        stringsAsFactors = FALSE
      ))
    }

    if (!isTRUE(from_present) && isTRUE(to_present)) {
      return(data.frame(
        from_year = as.integer(from_year),
        to_year = as.integer(to_year),
        transition_type = "osm_absent_then_present",
        diff_category = paste0("osm_absent_", from_year, "_present_", to_year),
        transition_window = paste0(snapshot_dates[[from_year]], "/", snapshot_dates[[to_year]]),
        stringsAsFactors = FALSE
      ))
    }

    NULL
  }) |>
    compact()

  if (length(rows) == 0) return(data.frame())
  bind_rows(rows)
}

classify_transition <- function(present_by_year, changed_tags, snapshot_dates) {
  transitions <- detect_presence_transitions(present_by_year, snapshot_dates)
  categories <- transitions$diff_category %||% c()
  transition_types <- transitions$transition_type %||% c()

  if (isTRUE(changed_tags)) {
    categories <- c(categories, "osm_tags_changed")
    transition_types <- c(transition_types, "osm_tags_changed")
  }

  if (length(categories) == 0) {
    categories <- "no_cleaned_osm_diff"
  }

  list(
    category = paste(unique(categories), collapse = ";"),
    transition_types = paste(unique(transition_types), collapse = ";"),
    transition_windows = paste(unique(transitions$transition_window %||% c()), collapse = ";"),
    transitions = transitions
  )
}

current_map_index <- function() {
  current_path <- file.path(repo_root, "apps", "regions", "nz", "data", "nz_places.json")
  if (!file.exists(current_path)) {
    return(list())
  }
  current <- read_json(current_path, simplifyVector = FALSE)
  set_names(current, map_chr(current, osm_key))
}

find_nearby_replacement <- function(row_record, candidates) {
  if (is.null(row_record) || length(candidates) == 0) {
    return(NULL)
  }

  lat <- as_numeric_or_na(row_record$lat)
  lng <- as_numeric_or_na(row_record$lng)
  if (is.na(lat) || is.na(lng)) return(NULL)

  row_tokens <- normalise_name_tokens(row_record$name %||% "")

  matches <- map(candidates, \(candidate) {
    candidate_lat <- as_numeric_or_na(candidate$lat)
    candidate_lng <- as_numeric_or_na(candidate$lng)
    if (is.na(candidate_lat) || is.na(candidate_lng)) return(NULL)

    distance <- haversine_distance_metres(lat, lng, candidate_lat, candidate_lng)
    if (distance > 150) return(NULL)

    candidate_tokens <- normalise_name_tokens(candidate$name %||% "")
    shared_tokens <- intersect(row_tokens, candidate_tokens)
    if (length(shared_tokens) == 0 && row_record$denomination != candidate$denomination) {
      return(NULL)
    }

    list(
      key = osm_key(candidate),
      name = candidate$name %||% "",
      distance_m = round(distance, 1)
    )
  }) |>
    compact()

  if (length(matches) == 0) return(NULL)
  matches[[which.min(map_dbl(matches, "distance_m"))]]
}

build_candidate_rows <- function(snapshot_results, task_years) {
  by_year <- set_names(map(snapshot_results, "records"), as.character(map_int(snapshot_results, "year")))
  by_key_year <- map(by_year, \(records) set_names(records, map_chr(records, osm_key)))
  keys <- sort(unique(unlist(map(by_key_year, names))))
  current_index <- current_map_index()
  snapshot_years <- names(by_year)
  snapshot_dates <- set_names(map_chr(snapshot_results, "date"), snapshot_years)
  task_years <- as.character(task_years)

  rows <- map(keys, \(key) {
    records_by_year <- map(by_key_year, \(records) records[[key]])
    names(records_by_year) <- names(by_key_year)
    present_by_year <- map_lgl(records_by_year, Negate(is.null))
    changed_tags <- has_tag_change(compact(records_by_year))
    transition <- classify_transition(as.list(present_by_year), changed_tags, snapshot_dates)
    category <- transition$category
    if (category == "no_cleaned_osm_diff") return(NULL)

    latest <- latest_present_record(records_by_year)
    current_match <- current_index[[key]]

    disappeared_record <- NULL
    replacement_candidates <- list()
    if (nrow(transition$transitions) > 0) {
      disappeared_transitions <- transition$transitions |>
        filter(transition_type == "osm_present_then_absent")

      for (index in seq_len(nrow(disappeared_transitions))) {
        from_year <- as.character(disappeared_transitions$from_year[[index]])
        to_year <- as.character(disappeared_transitions$to_year[[index]])
        disappeared_record <- disappeared_record %||% records_by_year[[from_year]]
        appearing_keys <- setdiff(names(by_key_year[[to_year]]), names(by_key_year[[from_year]]))
        replacement_candidates <- c(
          replacement_candidates,
          by_year[[to_year]][map_chr(by_year[[to_year]], osm_key) %in% appearing_keys]
        )
      }
    }

    if (length(replacement_candidates) > 0) {
      replacement_candidates <- replacement_candidates |>
        set_names(map_chr(replacement_candidates, osm_key))
      replacement_candidates <- replacement_candidates[!duplicated(names(replacement_candidates))]
    }
    replacement <- find_nearby_replacement(disappeared_record, replacement_candidates)

    if (!is.null(replacement) && grepl("osm_present_then_absent", transition$transition_types, fixed = TRUE)) {
      category <- paste(category, "possible_osm_object_replacement", sep = ";")
    }

    has_disappearance <- grepl("osm_present_then_absent", transition$transition_types, fixed = TRUE)
    has_appearance <- grepl("osm_absent_then_present", transition$transition_types, fixed = TRUE)

    instruction <- if (has_disappearance && has_appearance) {
      "Check whether this is OSM object churn, replacement mapping, or a short-lived real worship-use change."
    } else if (has_disappearance) {
      "Check whether worship use ended, the OSM object was replaced, or the earlier OSM state was noise."
    } else if (has_appearance) {
      "Check whether this is a real opening/newly documented site or an OSM mapping lag."
    } else {
      "Check whether name, religion, denomination, or building-use tags changed in a way that matters analytically."
    }

    present_years <- names(present_by_year)[present_by_year]
    first_present_year <- if (length(present_years) == 0) NA_integer_ else as.integer(present_years[[1]])
    last_present_year <- if (length(present_years) == 0) NA_integer_ else as.integer(present_years[[length(present_years)]])

    base_row <- data.frame(
      candidate_id = paste0("nz-osm-temporal-", gsub("/", "-", key)),
      osm_key = key,
      matched_current_project_id = current_match$id %||% "",
      matched_current_name = current_match$name %||% "",
      diff_category = category,
      transition_types = transition$transition_types,
      transition_windows = transition$transition_windows,
      snapshot_presence = collapse_presence_values(as.list(present_by_year), snapshot_years),
      task_year_presence = collapse_presence_values(as.list(present_by_year), task_years),
      first_present_snapshot_year = first_present_year,
      last_present_snapshot_year = last_present_year,
      latest_name = latest$name %||% "",
      latest_religion = latest$religion %||% "",
      latest_denomination = latest$denomination %||% "",
      latest_lat = latest$lat %||% NA_real_,
      latest_lng = latest$lng %||% NA_real_,
      name_by_year = collapse_year_values(records_by_year, "name"),
      religion_by_year = collapse_year_values(records_by_year, "religion"),
      denomination_by_year = collapse_year_values(records_by_year, "denomination"),
      amenity_by_year = collapse_tag_values(records_by_year, "amenity"),
      building_by_year = collapse_tag_values(records_by_year, "building"),
      nearby_replacement_osm_key = replacement$key %||% "",
      nearby_replacement_name = replacement$name %||% "",
      nearby_replacement_distance_m = replacement$distance_m %||% NA_real_,
      evidence_basis = "cleaned OSM snapshot diff only; not accepted historical worship-use evidence",
      andre_check = instruction,
      stringsAsFactors = FALSE
    )

    present_columns <- as.data.frame(
      as.list(setNames(
        map_lgl(snapshot_years, \(year) present_by_year[[year]] %||% FALSE),
        paste0("present_in_cleaned_osm_", snapshot_years)
      )),
      check.names = FALSE
    )

    cbind(base_row, present_columns)
  }) |>
    compact()

  if (length(rows) == 0) {
    return(data.frame())
  }

  bind_rows(rows) |>
    arrange(diff_category, latest_name, osm_key)
}

candidate_geojson <- function(candidates) {
  if (nrow(candidates) == 0) {
    return(list(type = "FeatureCollection", features = list()))
  }

  features <- pmap(candidates, \(...) {
    row <- list(...)
    list(
      type = "Feature",
      geometry = list(
        type = "Point",
        coordinates = list(as.numeric(row$latest_lng), as.numeric(row$latest_lat))
      ),
      properties = row[setdiff(names(row), c("latest_lat", "latest_lng"))]
    )
  })

  list(
    type = "FeatureCollection",
    features = features
  )
}

write_manifest <- function(snapshot_results, candidates, args, output_dir) {
  manifest <- list(
    generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    generated_by = "scripts/build_nz_osm_temporal_candidates.R",
    snapshot_years = as.list(args$snapshot_years),
    snapshot_month_day = args$snapshot_month_day,
    snapshot_dates = as.list(args$snapshot_dates),
    task_years = as.list(args$task_years),
    bboxes = args$bboxes,
    filter = args$osm_filter,
    osm_object_types = as.list(args$osm_object_types),
    timeout_seconds = args$timeout_seconds,
    source = "ohsome API elements/centroid endpoint",
    caveat = "Outputs are cleaned OSM-history leads, not accepted real-world worship-use states.",
    snapshots = map(snapshot_results, \(result) {
      list(
        year = result$year,
        date = result$date,
        raw_path = repo_relative(result$raw_path),
        normalised_path = repo_relative(result$normalised_path),
        cleaned_path = repo_relative(result$cleaned_path),
        normalised_count = result$normalised_count,
        cleaned_count = result$cleaned_count
      )
    }),
    candidate_count = nrow(candidates)
  )

  write_json(
    manifest,
    file.path(output_dir, "manifest.json"),
    pretty = TRUE,
    auto_unbox = TRUE,
    null = "null"
  )
}

main <- function() {
  args <- parse_args(commandArgs(trailingOnly = TRUE))
  output_dir <- file.path(repo_root, args$output_dir)
  raw_dir <- file.path(output_dir, "raw")
  dir.create(raw_dir, recursive = TRUE, showWarnings = FALSE)

  snapshot_results <- imap(args$snapshot_dates, \(snapshot_date, snapshot_year) {
    raw_path <- file.path(raw_dir, paste0("nz_osm_pows_", snapshot_date, ".geojson"))
    if (args$fetch || !file.exists(raw_path)) {
      fetch_snapshot(
        snapshot_date,
        args$bboxes,
        args$osm_filter,
        args$osm_object_types,
        args$timeout_seconds,
        raw_path
      )
    }
    normalise_snapshot(raw_path, as.integer(snapshot_year), snapshot_date, output_dir)
  })

  candidates <- build_candidate_rows(snapshot_results, args$task_years)
  csv_path <- file.path(output_dir, "nz_osm_temporal_candidates.csv")
  geojson_path <- file.path(output_dir, "nz_osm_temporal_candidates.geojson")

  write.csv(candidates, csv_path, row.names = FALSE, na = "")
  write_json(candidate_geojson(candidates), geojson_path, pretty = TRUE, auto_unbox = TRUE, null = "null")
  write_manifest(snapshot_results, candidates, args, output_dir)

  message("Wrote candidate CSV: ", repo_relative(csv_path))
  message("Wrote candidate GeoJSON: ", repo_relative(geojson_path))
  message("Candidate rows: ", nrow(candidates))
}

if (sys.nframe() == 0) {
  main()
}
