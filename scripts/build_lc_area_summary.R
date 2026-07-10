# validate the blocked Saint Lucia district census-affiliation route.
#
# run from the repository root with:
# Rscript scripts/build_lc_area_summary.R
#
# the builder deliberately stops before product writing. published integer
# cells fail exact reconciliation in 2001, 2010, and 2022. no tolerance,
# allocation, or rounding repair is permitted.

suppressMessages({
  library(digest)
  library(jsonlite)
  library(sf)
  library(xml2)
})
source("scripts/lib/simplify_boundary.R")

raw_dir <- "data/raw/lc_census"
output_dir <- "apps/regions/lc/data"
boundary_path <- file.path(raw_dir, "geoBoundaries-LCA-ADM1.geojson")
boundary_metadata_path <- file.path(raw_dir, "gb_lca_adm1_meta.json")
pdf_2022 <- file.path(raw_dir, "lc_2022_provisional_release1_rev1.pdf")
boundary_output <- file.path(output_dir, "lc_district_2015.geojson")
boundary_set_id <- "lc-district-2015-geoboundaries-adm1"

# stop when a required cached source is absent.
require_file <- function(path) {
  if (!file.exists(path)) stop("missing required source: ", path, call. = FALSE)
}

# return non-blank cell text for every HTML table row.
html_rows <- function(path) {
  document <- xml2::read_html(path)
  rows <- xml2::xml_find_all(document, ".//tr")
  lapply(rows, function(row) {
    values <- trimws(xml2::xml_text(xml2::xml_find_all(row, "./th|./td")))
    values[values != "" & values != "\u00a0"]
  })
}

# convert REDATAM grouped integers and hyphen zeros to exact integers.
redatam_integer <- function(value) {
  if (identical(trimws(value), "-")) return(0L)
  as.integer(gsub("[^0-9]", "", value))
}

# extract one REDATAM frequency table, including its printed total.
parse_frequency <- function(path) {
  rows <- html_rows(path)
  header <- which(vapply(rows, function(row) {
    length(row) == 4L && identical(row[[1]], "Religion") && identical(row[[2]], "Counts")
  }, logical(1)))[[1]]
  body <- rows[(header + 1L):length(rows)]
  total_offset <- which(vapply(body, function(row) {
    length(row) >= 1L && identical(row[[1]], "Total")
  }, logical(1)))[[1]]
  body <- body[seq_len(total_offset)]
  counts <- vapply(body, function(row) redatam_integer(row[[2]]), integer(1))
  names(counts) <- vapply(body, `[[`, character(1), 1L)
  missing_row <- rows[which(vapply(rows, function(row) {
    length(row) >= 1L && identical(row[[1]], "Missing :")
  }, logical(1)))]
  missing_count <- if (length(missing_row) == 0L) 0L else redatam_integer(missing_row[[1]][[2]])
  list(counts = counts, missing = missing_count)
}

# extract the 12 2001 District/Parish tables from one REDATAM result.
parse_2001_local <- function(path) {
  rows <- html_rows(path)
  starts <- which(vapply(rows, function(row) {
    length(row) >= 2L && grepl("^AREA #", row[[1]])
  }, logical(1)))
  summary_start <- which(vapply(rows, function(row) {
    length(row) == 1L && identical(row[[1]], "SUMMARY")
  }, logical(1)))[[1]]
  lapply(seq_along(starts), function(index) {
    finish <- if (index < length(starts)) starts[[index + 1L]] - 1L else summary_start - 1L
    section <- rows[(starts[[index]] + 1L):finish]
    count_rows <- section[vapply(section, function(row) {
      length(row) == 4L && grepl("^[0-9 -]+$", row[[4]])
    }, logical(1))]
    counts <- vapply(count_rows, function(row) redatam_integer(row[[4]]), integer(1))
    names(counts) <- vapply(count_rows, `[[`, character(1), 1L)
    list(area = rows[[starts[[index]]]][[2]], counts = counts, missing = 0L)
  })
}

# extract the 2001 national category row from its REDATAM result.
parse_2001_national <- function(path) {
  rows <- html_rows(path)
  count_rows <- rows[vapply(rows, function(row) {
    length(row) == 4L && grepl("^[0-9 -]+$", row[[4]])
  }, logical(1))]
  counts <- vapply(count_rows, function(row) redatam_integer(row[[4]]), integer(1))
  names(counts) <- vapply(count_rows, `[[`, character(1), 1L)
  list(counts = counts, missing = 0L)
}

# require every local category set to reproduce its printed total exactly.
assert_exact_local_rows <- function(local_rows, wave) {
  failures <- vapply(local_rows, function(row) {
    sum(row$counts[names(row$counts) != "Total"]) - row$counts[["Total"]]
  }, integer(1))
  if (any(failures != 0L)) {
    stop(
      wave, " every-area reconciliation failed: ",
      paste(names(failures)[failures != 0L], failures[failures != 0L], collapse = "; "),
      call. = FALSE
    )
  }
  invisible(TRUE)
}

# require local weighted cells to reproduce every national value exactly.
assert_local_to_national <- function(local_rows, national, wave) {
  categories <- names(national$counts)
  local_sums <- vapply(categories, function(category) {
    sum(vapply(local_rows, function(row) {
      if (category %in% names(row$counts)) row$counts[[category]] else 0L
    }, integer(1)))
  }, integer(1))
  differences <- local_sums - national$counts[categories]
  missing_difference <- sum(vapply(local_rows, `[[`, integer(1), "missing")) - national$missing
  failures <- differences[differences != 0L]
  if (length(failures) > 0L || missing_difference != 0L) {
    details <- c(
      paste0(names(failures), " ", sprintf("%+d", failures)),
      if (missing_difference != 0L) paste0("Missing ", sprintf("%+d", missing_difference))
    )
    stop(
      wave, " local-to-national reconciliation failed: ", paste(details, collapse = "; "),
      ". no tolerance, allocation, or rounding repair was applied; product writing stopped.",
      call. = FALSE
    )
  }
  invisible(TRUE)
}

# return the full 2022 Table D.2 count matrix transcribed from the PDF.
table_2022 <- function() {
  source_rows <- c(
    "Total|171834|60614|5841|2171|8322|7122|8507|19669|16693|12943|29953",
    "Anglican|2191|769|17|3|13|264|237|227|42|50|571",
    "Baptist|2987|1140|170|1|74|17|83|367|285|47|801",
    "Bahai Faith|29|17|0|0|0|0|2|6|0|0|4",
    "Brethren|122|60|1|0|4|0|2|13|23|0|20",
    "Buddhism|47|9|0|0|1|0|0|5|1|1|28",
    "Mennonite|3760|562|3|15|197|175|431|1245|499|454|177",
    "Hindu|253|83|0|1|1|0|0|57|0|1|110",
    "Jehovah Witnesses|1353|617|14|10|43|25|50|104|74|105|310",
    "Methodist|664|499|0|3|2|1|3|17|6|2|130",
    "Mormon|52|28|0|0|0|0|0|8|1|0|15",
    "Islam|292|112|8|0|6|1|6|73|12|4|70",
    "Pentecostal|15515|5432|646|15|434|416|633|1837|1761|1181|3159",
    "Nazarene|310|70|2|0|2|4|3|5|3|0|220",
    "Rastafarian|2463|836|116|51|210|127|95|260|217|259|292",
    "Roman Catholic|86967|27131|2576|1436|5832|5104|5388|10708|8330|6751|13711",
    "Salvation Army|202|79|7|3|10|9|9|15|16|15|39",
    "Seventh Day Adventist|18601|7390|1084|354|439|411|508|1374|2491|1523|3028",
    "Universal Church|277|114|20|0|4|9|5|27|6|51|42",
    "Hinduism|66|9|2|0|1|1|0|8|0|0|44",
    "Atheist - Do not believe in God|514|163|34|4|23|9|17|36|23|35|170",
    "None - No religion but believe in God|24252|9846|937|242|811|340|686|1942|2557|2081|4811",
    "Other|3854|1462|103|25|100|135|212|466|210|285|854",
    "Not reported|7064|4184|100|9|114|71|140|867|136|99|1345"
  )
  split_rows <- strsplit(source_rows, "\\|", fixed = FALSE)
  counts <- do.call(rbind, lapply(split_rows, function(row) as.integer(row[-1L])))
  rownames(counts) <- vapply(split_rows, `[[`, character(1), 1L)
  colnames(counts) <- c(
    "Saint Lucia", "Castries", "Anse La Raye", "Canaries", "Soufriere",
    "Choiseul", "Laborie", "Vieux Fort", "Micoud", "Dennery", "Gros Islet"
  )
  counts
}

# run Poppler and return normalised PDF text for transcription assertions.
pdf_text <- function(path) {
  executable <- Sys.which("pdftotext")
  if (!nzchar(executable)) stop("pdftotext (Poppler) is required", call. = FALSE)
  output <- tempfile(fileext = ".txt")
  on.exit(unlink(output), add = TRUE)
  status <- system2(executable, c("-layout", shQuote(path), shQuote(output)))
  if (status != 0L) stop("pdftotext failed on ", path, call. = FALSE)
  gsub("[[:space:]]+", " ", paste(readLines(output, warn = FALSE), collapse = " "))
}

# require each transcribed 2022 source row to occur in the cached PDF text.
assert_2022_transcription <- function(counts, text) {
  source_labels <- rownames(counts)
  source_labels[source_labels == "Atheist - Do not believe in God"] <- "Atheist - Do not believe in"
  source_labels[source_labels == "None - No religion but believe in God"] <- "None - No religion but"
  for (index in seq_len(nrow(counts))) {
    values <- ifelse(counts[index, ] == 0L, "-", format(counts[index, ], big.mark = ",", scientific = FALSE, trim = TRUE))
    pieces <- c(source_labels[[index]], values)
    pattern <- paste(vapply(pieces, function(piece) {
      gsub(" ", "[[:space:]]+", piece, fixed = TRUE)
    }, character(1)), collapse = "[[:space:]]+")
    if (!grepl(pattern, text, perl = TRUE)) {
      stop("2022 transcribed row not found in PDF text: ", rownames(counts)[[index]], call. = FALSE)
    }
  }
  invisible(TRUE)
}

# require the 2022 matrix to reconcile along both published dimensions.
assert_2022_reconciliation <- function(counts) {
  categories <- counts[rownames(counts) != "Total", , drop = FALSE]
  printed_totals <- counts["Total", ]
  column_differences <- colSums(categories) - printed_totals
  row_differences <- rowSums(categories[, colnames(counts) != "Saint Lucia", drop = FALSE]) -
    categories[, "Saint Lucia"]
  failed_columns <- column_differences[column_differences != 0L]
  failed_rows <- row_differences[row_differences != 0L]
  if (length(failed_columns) > 0L || length(failed_rows) > 0L) {
    details <- c(
      paste0("column ", names(failed_columns), " ", sprintf("%+d", failed_columns)),
      paste0("category ", names(failed_rows), " ", sprintf("%+d", failed_rows))
    )
    stop(
      "2022 exact reconciliation failed: ", paste(details, collapse = "; "),
      ". no tolerance, allocation, or rounding repair was applied; product writing stopped.",
      call. = FALSE
    )
  }
  invisible(TRUE)
}

# validate and simplify the ten-feature boundary only after census gates pass.
build_boundary <- function() {
  metadata <- jsonlite::read_json(boundary_metadata_path, simplifyVector = TRUE)
  if (!identical(metadata$boundaryID, "LCA-ADM1-63095687") ||
      !identical(metadata$admUnitCount, "10") ||
      !grepl("CC0 1.0", metadata$boundaryLicense, fixed = TRUE)) {
    stop("geoBoundaries release metadata does not match the pinned release", call. = FALSE)
  }
  boundary <- sf::st_make_valid(sf::st_read(boundary_path, quiet = TRUE))
  validity <- sf::st_is_valid(boundary)
  hashes <- vapply(sf::st_as_binary(sf::st_geometry(boundary), EWKB = TRUE), digest::digest,
                   character(1), algo = "sha256", serialize = FALSE)
  if (nrow(boundary) != 10L || any(sf::st_is_empty(boundary)) || any(is.na(validity)) ||
      any(!validity) || anyDuplicated(hashes)) {
    stop("source boundary failed feature, validity, or distinctness gates", call. = FALSE)
  }
  area_names <- c(
    "Vieux Fort" = "Vieux Fort", "Anse la Raya" = "Anse La Raye", "Castries" = "Castries",
    "Gros Islet" = "Gros Islet", "Dennery" = "Dennery", "Micoud" = "Micoud",
    "Soufrière" = "Soufriere", "Choiseul" = "Choiseul", "Laborie" = "Laborie",
    "Canaries" = "Canaries"
  )
  if (!setequal(boundary$shapeName, names(area_names))) {
    stop("boundary district labels do not match the pinned join map", call. = FALSE)
  }
  boundary$area_name <- unname(area_names[boundary$shapeName])
  boundary$area_code <- gsub("-+", "-", gsub("[^a-z0-9]+", "-", tolower(boundary$area_name)))
  boundary$area_unit_id <- paste0(boundary_set_id, ":", boundary$area_code)
  boundary$boundary_set_id <- boundary_set_id
  boundary$boundary_level <- "district"
  boundary <- boundary[, c("area_code", "area_name", "area_unit_id", "boundary_set_id", "boundary_level")]
  dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
  simplification <- mapshaper_simplify_to_cap(
    boundary, boundary_output, max_bytes = 3000000L,
    keep_percentages = c(100, 80, 60, 40, 30, 20, 15, 10, 7, 5),
    clean_option = "allow-overlaps"
  )
  written <- sf::st_read(boundary_output, quiet = TRUE)
  written_validity <- sf::st_is_valid(written)
  written_hashes <- vapply(sf::st_as_binary(sf::st_geometry(written), EWKB = TRUE), digest::digest,
                           character(1), algo = "sha256", serialize = FALSE)
  if (nrow(written) != 10L || any(sf::st_is_empty(written)) || any(is.na(written_validity)) ||
      any(!written_validity) || anyDuplicated(written_hashes) ||
      file.info(boundary_output)$size > 3000000L) {
    stop("simplified boundary failed feature, validity, distinctness, or byte-cap gates", call. = FALSE)
  }
  simplification
}

required_paths <- c(
  pdf_2022,
  file.path(raw_dir, "redatam_2001_religion_by_district.html"),
  file.path(raw_dir, "redatam_2001_religion_national.html"),
  file.path(raw_dir, "redatam_2010_religion_national.html"),
  file.path(raw_dir, "redatam_2010_districts", paste0("district_", 1:12, ".html")),
  boundary_path,
  boundary_metadata_path
)
invisible(lapply(required_paths, require_file))

counts_2022 <- table_2022()
assert_2022_transcription(counts_2022, pdf_text(pdf_2022))

# this gate currently stops on the published 2022 count matrix. later gates
# remain explicit below so a corrected official table cannot bypass them.
assert_2022_reconciliation(counts_2022)

local_2001 <- parse_2001_local(file.path(raw_dir, "redatam_2001_religion_by_district.html"))
names(local_2001) <- vapply(local_2001, `[[`, character(1), "area")
national_2001 <- parse_2001_national(file.path(raw_dir, "redatam_2001_religion_national.html"))
assert_exact_local_rows(local_2001, "2001")
assert_local_to_national(local_2001, national_2001, "2001")

local_2010 <- lapply(1:12, function(code) {
  parse_frequency(file.path(raw_dir, "redatam_2010_districts", paste0("district_", code, ".html")))
})
names(local_2010) <- paste0("District code ", 1:12)
national_2010 <- parse_frequency(file.path(raw_dir, "redatam_2010_religion_national.html"))
assert_exact_local_rows(local_2010, "2010")
assert_local_to_national(local_2010, national_2010, "2010")

boundary_result <- build_boundary()
stop(
  "all source gates unexpectedly passed; product writing remains disabled until the corrected source is reviewed",
  call. = FALSE
)
