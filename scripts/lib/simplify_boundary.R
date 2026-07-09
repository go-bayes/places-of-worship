# simplify an sf layer or GeoJSON path with mapshaper until it fits a byte cap.
mapshaper_simplify_to_cap <- function(input_sf_or_path, output_path, max_bytes,
                                      keep_percentages,
                                      clean_option = "allow-overlaps") {
  if (!requireNamespace("sf", quietly = TRUE)) {
    stop("the sf package is required for boundary simplification", call. = FALSE)
  }

  # legacy callers attach existing mapshaper options to the ladder so the
  # helper can preserve behaviour without widening the public signature.
  mapshaper_method <- attr(keep_percentages, "mapshaper_method", exact = TRUE)
  if (is.null(mapshaper_method)) mapshaper_method <- "weighted"
  mapshaper_target <- attr(keep_percentages, "mapshaper_target", exact = TRUE)
  extra_output_paths <- attr(keep_percentages, "mapshaper_extra_output_paths", exact = TRUE)
  keep_percentages <- as.numeric(keep_percentages)
  if (any(is.na(keep_percentages))) {
    stop("keep_percentages must be numeric percentages", call. = FALSE)
  }

  tmp_input <- tempfile(fileext = ".geojson")
  npm_cache <- tempfile("npm-cache-")
  dir.create(npm_cache, showWarnings = FALSE, recursive = TRUE)
  on.exit(unlink(c(tmp_input, npm_cache), recursive = TRUE), add = TRUE)

  input_layer <- if (inherits(input_sf_or_path, "sf")) {
    input_sf_or_path
  } else if (is.character(input_sf_or_path) && length(input_sf_or_path) == 1L) {
    sf::st_read(input_sf_or_path, quiet = TRUE)
  } else {
    stop("input_sf_or_path must be an sf object or one GeoJSON path", call. = FALSE)
  }

  sf::st_write(
    input_layer,
    tmp_input,
    driver = "GeoJSON",
    delete_dsn = TRUE,
    quiet = TRUE,
    layer_options = c("COORDINATE_PRECISION=5")
  )

  chosen <- NULL
  clean_args <- if (identical(clean_option, "skip")) {
    character()
  } else if (is.null(clean_option) || identical(clean_option, "")) {
    "-clean"
  } else {
    c("-clean", clean_option)
  }
  clean_label <- if (identical(clean_option, "skip")) {
    "skipped"
  } else if (is.null(clean_option) || identical(clean_option, "")) {
    "-clean"
  } else {
    clean_option
  }

  for (keep_percent in keep_percentages) {
    unlink(c(output_path, extra_output_paths))
    args <- c("--yes", "mapshaper", tmp_input)
    if (!is.null(mapshaper_target)) {
      args <- c(args, "-target", mapshaper_target)
    }
    args <- c(
      args,
      "-simplify", mapshaper_method, "keep-shapes", sprintf("%g%%", keep_percent),
      clean_args,
      "-o", "precision=0.00001", "format=geojson", output_path
    )
    result <- tryCatch(
      system2(
        "npx",
        args,
        stdout = TRUE,
        stderr = TRUE,
        env = c(
          paste0("NPM_CONFIG_CACHE=", npm_cache),
          paste0("npm_config_cache=", npm_cache),
          "npm_config_update_notifier=false"
        )
      ),
      warning = function(w) structure(conditionMessage(w), status = 1L)
    )
    status <- attr(result, "status")
    if (!is.null(status) && status != 0L) {
      stop(
        "mapshaper failed at ", keep_percent, "%:\n",
        paste(result, collapse = "\n"),
        call. = FALSE
      )
    }
    if (!file.exists(output_path)) {
      output_base <- tools::file_path_sans_ext(basename(output_path))
      split_paths <- Sys.glob(file.path(dirname(output_path), paste0(output_base, "-*.geojson")))
      polygon_candidates <- split_paths[vapply(split_paths, function(path) {
        candidate <- tryCatch(sf::st_read(path, quiet = TRUE), error = function(e) NULL)
        if (is.null(candidate) || nrow(candidate) != nrow(input_layer)) return(FALSE)
        all(grepl("POLYGON", as.character(sf::st_geometry_type(candidate))))
      }, logical(1))]
      if (length(polygon_candidates) == 1L) {
        file.copy(polygon_candidates, output_path, overwrite = TRUE)
        unlink(split_paths)
      } else {
        stop("mapshaper did not create output at ", keep_percent, "%", call. = FALSE)
      }
    }

    written <- sf::st_read(output_path, quiet = TRUE)
    written_valid <- sf::st_is_valid(written)
    if (any(sf::st_is_empty(written)) || any(is.na(written_valid)) || any(!written_valid)) {
      stop("mapshaper simplification produced empty or invalid geometries", call. = FALSE)
    }

    bytes <- as.numeric(unname(file.info(output_path)[["size"]]))
    chosen <- list(
      method = paste("mapshaper", mapshaper_method, "keep-shapes"),
      clean_option = clean_label,
      keep_percent = keep_percent,
      bytes = bytes
    )
    if (bytes <= max_bytes) return(chosen)
  }

  stop(
    "mapshaper-simplified boundary remains above ",
    max_bytes,
    " bytes after ",
    chosen[["keep_percent"]],
    "% keep",
    call. = FALSE
  )
}
