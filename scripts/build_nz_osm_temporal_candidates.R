# Build cleaned New Zealand OSM temporal lists of places to check.
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
        "Build cleaned NZ OSM temporal lists of places to check.\n\n",
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

has_value <- function(value) {
  !is.null(value) &&
    length(value) > 0 &&
    !is.na(value) &&
    trimws(as.character(value)) != ""
}

format_date_or_blank <- function(value) {
  if (is.null(value) || length(value) == 0 || is.na(value)) {
    return("")
  }
  format(as.Date(value), "%Y-%m-%d")
}

last_day_of_month <- function(year, month) {
  if (month == 12L) {
    return(as.Date(sprintf("%04d-12-31", year)))
  }
  as.Date(sprintf("%04d-%02d-01", year, month + 1L)) - 1L
}

parse_calendar_date <- function(value) {
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
  paste(unique(warnings[warnings != ""]), collapse = ";")
}

parse_lifecycle_date_value <- function(value, tag, source_year = "") {
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

  range_match <- regexec("^(\\d{4})\\s*[-–/]\\s*(\\d{4})$", text)
  range_parts <- regmatches(text, range_match)[[1]]
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
  if (!is.na(parse$lower)) return(parse$lower)
  if (!is.na(parse$upper)) return(parse$upper)
  as.Date(NA)
}

choose_earliest_parse <- function(parses) {
  parses <- keep(parses, \(parse) has_value(parse$raw))
  if (length(parses) == 0) return(empty_lifecycle_parse())

  order_values <- map_dbl(parses, \(parse) {
    date <- date_for_ordering(parse)
    if (is.na(date)) Inf else as.numeric(date)
  })
  if (all(is.infinite(order_values))) return(parses[[1]])

  parses[[which.min(order_values)]]
}

collapse_lifecycle_tag_values <- function(records_by_year, fields) {
  paste(
    map_chr(names(records_by_year), \(year) {
      record <- records_by_year[[year]]
      values <- map_chr(fields, \(field) {
        value <- tag_value(record, field)
        if (value == "") return("")
        paste0(field, "=", value)
      })
      values <- values[values != ""]
      paste0(year, "=", if (length(values) == 0) "" else paste(values, collapse = ";"))
    }),
    collapse = " | "
  )
}

former_use_tags <- function(record) {
  if (is.null(record)) return(character())
  tags <- record$tags_raw %||% list()
  tag_names <- names(tags) %||% character()
  tag_names <- tag_names[!is.na(tag_names) & tag_names != ""]
  former_names <- tag_names[grepl("^(disused|abandoned|was|demolished):", tag_names)]
  if (length(former_names) == 0) return(character())
  values <- map_chr(former_names, \(name) as.character(tags[[name]] %||% ""))
  keep <- values != ""
  if (!any(keep)) return(character())
  paste0(former_names[keep], "=", values[keep])
}

collect_lifecycle_parses <- function(records_by_year, fields) {
  parses <- list()
  for (year in names(records_by_year)) {
    record <- records_by_year[[year]]
    for (field in fields) {
      value <- tag_value(record, field)
      if (has_value(value)) {
        parses <- c(parses, list(parse_lifecycle_date_value(value, field, year)))
      }
    }
  }
  parses
}

collect_former_use_parse <- function(records_by_year) {
  for (year in names(records_by_year)) {
    record <- records_by_year[[year]]
    tags <- former_use_tags(record)
    if (length(tags) > 0) {
      snapshot_date <- record$snapshot_date %||% paste0(year, "-", default_snapshot_month_day)
      return(list(
        raw = paste(tags, collapse = ";"),
        tag = "former_use_tags",
        source_year = year,
        lower = as.Date(NA),
        upper = as.Date(snapshot_date),
        precision = "bounded",
        warning = "former_use_observation_not_later_than_snapshot"
      ))
    }
  }
  empty_lifecycle_parse()
}

derive_lifecycle_target_status <- function(origin, closure, target_year, snapshot_month_day) {
  target_anchor <- as.Date(paste0(target_year, "-", snapshot_month_day))

  if (has_value(closure$raw)) {
    if (!is.na(closure$upper) && closure$upper < target_anchor) {
      return(list(
        status = "absent",
        basis = "osm_date_tags",
        evidence = paste0(closure$tag, "=", closure$raw, " suggests worship use ended before ", target_anchor)
      ))
    }
    if (
      (!is.na(closure$lower) && closure$lower <= target_anchor) &&
        (!is.na(closure$upper) && closure$upper >= target_anchor)
    ) {
      return(list(
        status = "uncertain",
        basis = "osm_date_tags",
        evidence = paste0(closure$tag, "=", closure$raw, " overlaps ", target_anchor)
      ))
    }
  }

  if (has_value(origin$raw)) {
    if (!is.na(origin$upper) && origin$upper < target_anchor) {
      return(list(
        status = "present",
        basis = "osm_date_tags",
        evidence = paste0(origin$tag, "=", origin$raw, " suggests worship use or structure existed before ", target_anchor)
      ))
    }
    if (!is.na(origin$lower) && origin$lower > target_anchor) {
      return(list(
        status = "absent",
        basis = "osm_date_tags",
        evidence = paste0(origin$tag, "=", origin$raw, " suggests onset after ", target_anchor)
      ))
    }
    return(list(
      status = "uncertain",
      basis = "osm_date_tags",
      evidence = paste0(origin$tag, "=", origin$raw, " is not precise enough to settle ", target_anchor)
    ))
  }

  if (has_value(closure$raw)) {
    return(list(
      status = "uncertain",
      basis = "osm_date_tags",
      evidence = paste0(closure$tag, "=", closure$raw, " exists, but no start evidence is recorded")
    ))
  }

  list(
    status = "not_assessed",
    basis = "missing_osm_date_evidence",
    evidence = "No OSM date tag supports target-year status."
  )
}

detect_lifecycle_windows <- function(status_by_year, snapshot_dates) {
  years <- names(status_by_year)
  if (length(years) < 2) return("")

  windows <- map_chr(seq_len(length(years) - 1), \(index) {
    from_year <- years[[index]]
    to_year <- years[[index + 1]]
    from_status <- status_by_year[[from_year]]
    to_status <- status_by_year[[to_year]]
    window <- paste0(snapshot_dates[[from_year]], "/", snapshot_dates[[to_year]])

    if (from_status == "absent" && to_status == "present") {
      return(paste0("candidate_gain:", window))
    }
    if (from_status == "present" && to_status == "absent") {
      return(paste0("candidate_loss:", window))
    }
    if (from_status != to_status) {
      return(paste0("candidate_status_change:", from_status, "_to_", to_status, ":", window))
    }
    ""
  })

  paste(windows[windows != ""], collapse = ";")
}

instruction_for_lifecycle <- function(status_by_year, windows, parser_warnings) {
  windows <- windows %||% ""
  if (grepl("candidate_loss", windows, fixed = TRUE)) {
    return("Check whether worship use really ended in the candidate window, or whether OSM describes mapping churn, building history, or a changed tag.")
  }
  if (grepl("candidate_gain", windows, fixed = TRUE)) {
    return("Check whether worship use really began in the candidate window, or whether OSM records a late mapping or building date.")
  }
  if (any(status_by_year == "uncertain")) {
    return("Check sources that can resolve the uncertain target-year status.")
  }
  if (parser_warnings != "") {
    return("Check the raw OSM date tag because the parser treated it as approximate, bounded, or otherwise ambiguous.")
  }
  "Check whether independent evidence supports the OSM date-tag-derived target-year statuses."
}

date_tag_row_column_names <- function(task_years) {
  c(
    "date_tag_row_id",
    "osm_key",
    "matched_current_project_id",
    "matched_current_name",
    "latest_name",
    "latest_religion",
    "latest_denomination",
    "latest_lat",
    "latest_lng",
    "osm_date_tags_by_year",
    "former_use_tags_by_year",
    "origin_tag",
    "origin_raw",
    "origin_source_year",
    "origin_not_earlier_than",
    "origin_not_later_than",
    "origin_date_precision",
    "origin_parser_warning",
    "closure_tag",
    "closure_raw",
    "closure_source_year",
    "closure_not_earlier_than",
    "closure_not_later_than",
    "closure_date_precision",
    "closure_parser_warning",
    "candidate_date_tag_windows",
    "evidence_basis",
    "andre_check",
    unlist(map(as.character(task_years), \(year) {
      c(
        paste0("target_year_", year, "_status"),
        paste0("target_year_", year, "_basis"),
        paste0("target_year_", year, "_evidence")
      )
    }), use.names = FALSE)
  )
}

empty_date_tag_rows <- function(task_years) {
  columns <- date_tag_row_column_names(task_years)
  as.data.frame(
    setNames(replicate(length(columns), character(), simplify = FALSE), columns),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
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
      evidence_basis = "cleaned OSM year-to-year comparison only; not accepted historical worship-use evidence",
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

build_date_tag_rows <- function(snapshot_results, task_years, snapshot_month_day) {
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
    origin_parses <- collect_lifecycle_parses(records_by_year, c("old_start_date", "start_date"))
    closure_parses <- collect_lifecycle_parses(records_by_year, "end_date")
    former_parse <- collect_former_use_parse(records_by_year)
    date_tag_present <- length(origin_parses) > 0 ||
      length(closure_parses) > 0 ||
      has_value(former_parse$raw)
    if (!date_tag_present) return(NULL)

    origin <- choose_earliest_parse(origin_parses)
    closure <- choose_earliest_parse(c(closure_parses, list(former_parse)))
    latest <- latest_present_record(records_by_year)
    current_match <- current_index[[key]]

    status_details <- set_names(
      map(task_years, \(year) derive_lifecycle_target_status(origin, closure, year, snapshot_month_day)),
      task_years
    )
    status_by_year <- map_chr(status_details, "status")
    windows <- detect_lifecycle_windows(as.list(status_by_year), snapshot_dates)
    parser_warnings <- combine_warnings(c(origin$warning, closure$warning))

    base_row <- data.frame(
      date_tag_row_id = paste0("nz-osm-date-tag-", gsub("/", "-", key)),
      osm_key = key,
      matched_current_project_id = current_match$id %||% "",
      matched_current_name = current_match$name %||% "",
      latest_name = latest$name %||% "",
      latest_religion = latest$religion %||% "",
      latest_denomination = latest$denomination %||% "",
      latest_lat = latest$lat %||% NA_real_,
      latest_lng = latest$lng %||% NA_real_,
      osm_date_tags_by_year = collapse_lifecycle_tag_values(
        records_by_year,
        c("old_start_date", "start_date", "end_date")
      ),
      former_use_tags_by_year = paste(
        map_chr(names(records_by_year), \(year) {
          tags <- former_use_tags(records_by_year[[year]])
          paste0(year, "=", if (length(tags) == 0) "" else paste(tags, collapse = ";"))
        }),
        collapse = " | "
      ),
      origin_tag = origin$tag %||% "",
      origin_raw = origin$raw %||% "",
      origin_source_year = origin$source_year %||% "",
      origin_not_earlier_than = format_date_or_blank(origin$lower),
      origin_not_later_than = format_date_or_blank(origin$upper),
      origin_date_precision = origin$precision %||% "unknown",
      origin_parser_warning = origin$warning %||% "",
      closure_tag = closure$tag %||% "",
      closure_raw = closure$raw %||% "",
      closure_source_year = closure$source_year %||% "",
      closure_not_earlier_than = format_date_or_blank(closure$lower),
      closure_not_later_than = format_date_or_blank(closure$upper),
      closure_date_precision = closure$precision %||% "unknown",
      closure_parser_warning = closure$warning %||% "",
      candidate_date_tag_windows = windows,
      evidence_basis = "osm_date_tags; not accepted historical worship-use evidence",
      andre_check = instruction_for_lifecycle(status_by_year, windows, parser_warnings),
      stringsAsFactors = FALSE
    )

    status_columns <- as.data.frame(
      as.list(unlist(map(task_years, \(year) {
        detail <- status_details[[year]]
        setNames(
          c(detail$status, detail$basis, detail$evidence),
          c(
            paste0("target_year_", year, "_status"),
            paste0("target_year_", year, "_basis"),
            paste0("target_year_", year, "_evidence")
          )
        )
      }))),
      check.names = FALSE
    )

    cbind(base_row, status_columns)
  }) |>
    compact()

  if (length(rows) == 0) {
    return(empty_date_tag_rows(task_years))
  }

  bind_rows(rows) |>
    arrange(candidate_date_tag_windows, latest_name, osm_key)
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

write_manifest <- function(snapshot_results, candidates, date_tag_rows, args, output_dir) {
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
    caveat = "Outputs are cleaned OSM-history lists of places to check, not accepted real-world worship-use states.",
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
    candidate_count = nrow(candidates),
    date_tag_places_to_check_count = nrow(date_tag_rows)
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
  date_tag_rows <- build_date_tag_rows(
    snapshot_results,
    args$task_years,
    args$snapshot_month_day
  )
  csv_path <- file.path(output_dir, "nz_osm_temporal_candidates.csv")
  geojson_path <- file.path(output_dir, "nz_osm_temporal_candidates.geojson")
  date_tag_csv_path <- file.path(output_dir, "nz_osm_date_tag_places_to_check.csv")
  date_tag_geojson_path <- file.path(output_dir, "nz_osm_date_tag_places_to_check.geojson")

  write.csv(candidates, csv_path, row.names = FALSE, na = "")
  write_json(candidate_geojson(candidates), geojson_path, pretty = TRUE, auto_unbox = TRUE, null = "null")
  write.csv(date_tag_rows, date_tag_csv_path, row.names = FALSE, na = "")
  write_json(candidate_geojson(date_tag_rows), date_tag_geojson_path, pretty = TRUE, auto_unbox = TRUE, null = "null")
  write_manifest(snapshot_results, candidates, date_tag_rows, args, output_dir)

  message("Wrote candidate CSV: ", repo_relative(csv_path))
  message("Wrote candidate GeoJSON: ", repo_relative(geojson_path))
  message("Wrote OSM date-tag CSV: ", repo_relative(date_tag_csv_path))
  message("Wrote OSM date-tag GeoJSON: ", repo_relative(date_tag_geojson_path))
  message("Candidate rows: ", nrow(candidates))
  message("OSM date-tag rows: ", nrow(date_tag_rows))
}

if (sys.nframe() == 0) {
  main()
}
