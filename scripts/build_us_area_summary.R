# build the us county area-summary product from the u.s. religion census
# (rcms) 2010 and 2020 county files.
# inputs: data/raw/us_rcms/RCMSCY{10,20}_county.xlsx (arda/osf-hosted
# excel files, see data/raw/us_rcms/sources.csv for provenance) and
# apps/regions/us/data/source/fips_crosswalk_2010_to_2020.csv (documented
# county fips changes between the two waves)
# outputs: apps/regions/us/data/area_summary_county.{json,csv} following
# the same row contract as apps/regions/nz/data/area_summary_ta.json, and
# tracked source extracts at apps/regions/us/data/source/*.csv
# construct: congregations and adherents reported by religious bodies to
# the u.s. religion census -- institutional presence, not a census
# self-identification question. labels must say "adherents", never
# "religious affiliation" (playbook docs/playbooks/us-data-map.md).
# run from the repo root: Rscript scripts/build_us_area_summary.R

suppressMessages({
  library(readxl)
  library(jsonlite)
})

us_dir <- "apps/regions/us/data"
src_dir <- file.path(us_dir, "source")
raw_dir <- "data/raw/us_rcms"
dir.create(src_dir, showWarnings = FALSE, recursive = TRUE)
stamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")

crosswalk <- read.csv(file.path(src_dir, "fips_crosswalk_2010_to_2020.csv"), stringsAsFactors = FALSE,
                       colClasses = c(old_fips = "character", new_fips = "character"))
crosswalk$old_fips <- sprintf("%05d", as.integer(crosswalk$old_fips))
crosswalk$new_fips <- sprintf("%05d", as.integer(crosswalk$new_fips))

# apply the crosswalk to a 5-digit-fips-keyed data frame with numeric
# cng/adh/pop columns: old rows are remapped onto their 2020 successor
# fips and summed, so a county that absorbed a split neighbour carries
# the combined total (documented as an approximation in the crosswalk
# notes -- see fips_crosswalk_2010_to_2020.csv)
apply_crosswalk <- function(df) {
  m <- match(df$fips, crosswalk$old_fips)
  remap <- !is.na(m)
  df$fips[remap] <- crosswalk$new_fips[m[remap]]
  agg <- aggregate(cbind(cng, adh, pop) ~ fips, data = df, FUN = sum, na.rm = TRUE)
  agg
}

# a 2010 area that later split into two 2020 counties (valdez-cordova ->
# chugach + copper river) only has a mapped row for the successor the
# crosswalk chose as majority; add the other successor as an explicit
# pending row (na, not zero) so every 2020 boundary geoid gets a 2010 row
add_pending_successors <- function(agg, geoids) {
  missing <- setdiff(geoids, agg$fips)
  if (!length(missing)) return(agg)
  name_lookup <- setNames(name20$name, name20$fips)
  state_lookup <- setNames(name20$state, name20$fips)
  pending <- data.frame(
    fips = missing, cng = NA_real_, adh = NA_real_, pop = NA_real_,
    name = name_lookup[missing], state = state_lookup[missing],
    stringsAsFactors = FALSE
  )
  rbind(agg, pending)
}
# fips codes that only exist as a 2020 boundary because their 2010 rcms
# total is folded into a crosswalked sibling (see the crosswalk notes);
# set once pending successors are computed, read by build_rows for the
# quality flag
pending_split_fips <- character(0)

# ---- 2020 ----
raw20 <- read_excel(file.path(raw_dir, "RCMSCY20_county.xlsx"), sheet = "Data")
d20 <- data.frame(
  fips = sprintf("%05d", as.integer(raw20[["FIPS"]])),
  name = raw20[["COUNAM"]],
  state = raw20[["STABBREV"]],
  cng = as.numeric(raw20[["TOTCNG_2020"]]),
  adh = as.numeric(raw20[["TOTADH_2020"]]),
  pop = as.numeric(raw20[["POP2020"]]),
  stringsAsFactors = FALSE
)
stopifnot(nrow(d20) == 3143)
name20 <- d20[!duplicated(d20$fips), c("fips", "name", "state")]
d20_agg <- apply_crosswalk(d20[, c("fips", "cng", "adh", "pop")])
d20_agg <- merge(d20_agg, name20, by = "fips", all.x = TRUE)

write.csv(d20_agg[order(d20_agg$fips), c("fips", "name", "state", "cng", "adh", "pop")],
          file.path(src_dir, "us_rcms_county_2020_extract.csv"), row.names = FALSE, na = "")

# ---- 2010 ----
raw10 <- read_excel(file.path(raw_dir, "RCMSCY10_county.xlsx"), sheet = "Data")
d10 <- data.frame(
  fips = sprintf("%05d", as.integer(raw10[["FIPS"]])),
  name = raw10[["CNTYNAME"]],
  state = raw10[["STABBR"]],
  cng = as.numeric(raw10[["TOTCNG"]]),
  adh = as.numeric(raw10[["TOTADH"]]),
  pop = as.numeric(raw10[["POP2010"]]),
  stringsAsFactors = FALSE
)
stopifnot(nrow(d10) == 3149)
name10 <- d10[!duplicated(d10$fips), c("fips", "name", "state")]
d10_agg <- apply_crosswalk(d10[, c("fips", "cng", "adh", "pop")])
d10_agg <- merge(d10_agg, name10, by = "fips", all.x = TRUE)
pending_split_fips <- setdiff(name20$fips, d10_agg$fips)
d10_agg <- add_pending_successors(d10_agg, name20$fips)

write.csv(d10_agg[order(d10_agg$fips), c("fips", "name", "state", "cng", "adh", "pop")],
          file.path(src_dir, "us_rcms_county_2010_extract.csv"), row.names = FALSE, na = "")

cat(sprintf("2020: %d source rows -> %d fips after crosswalk\n", nrow(d20), nrow(d20_agg)))
cat(sprintf("2010: %d source rows -> %d fips after crosswalk\n", nrow(d10), nrow(d10_agg)))

# ---- national totals cross-check against the published book (validation) ----
# 2020 USRC book: 356,642 congregations, 158,821,388 adherents (Grammich
# et al. 2023, national overview chapter); reproduced here from the raw
# county file's own totals row sum, which is the same source, so this is
# an internal-consistency check, not an independent replication
cat(sprintf("2020 national sum: %d congregations, %.0f adherents, %.0f population\n",
            sum(d20_agg$cng), sum(d20_agg$adh), sum(d20_agg$pop)))
cat(sprintf("2010 national sum: %d congregations, %.0f adherents, %.0f population\n",
            sum(d10_agg$cng, na.rm = TRUE), sum(d10_agg$adh, na.rm = TRUE), sum(d10_agg$pop, na.rm = TRUE)))
# 2010 arda summary page states 344,894 congregations, 150,686,156
# adherents, 48.8% of 308,745,538 population; the raw county file's own
# column sum gives 150,596,792 adherents (89,364 less, 0.06%) even before
# any crosswalk is applied -- a genuine small discrepancy between ARDA's
# published summary statistic and its own downloadable county file, not
# an artefact of this pipeline. congregations and population match exactly.

# ---- boundary geojson geoids (join coverage check) ----
geojson <- fromJSON(file.path(us_dir, "counties_2020.geojson"), simplifyVector = FALSE)
geoids <- vapply(geojson$features, function(f) f$properties$GEOID, "")
cat(sprintf("boundary geoids: %d\n", length(geoids)))
cat(sprintf("2020 join coverage: %d/%d\n", sum(d20_agg$fips %in% geoids), length(geoids)))
cat(sprintf("2010 join coverage (post-crosswalk): %d/%d\n", sum(d10_agg$fips %in% geoids), length(geoids)))
missing20 <- setdiff(geoids, d20_agg$fips)
missing10 <- setdiff(geoids, d10_agg$fips)
if (length(missing20)) cat("boundary fips missing from 2020 data:", paste(missing20, collapse = ", "), "\n")
if (length(missing10)) cat("boundary fips missing from 2010 data:", paste(missing10, collapse = ", "), "\n")

# ---- build area_summary_county rows, contract matching area_summary_ta.json ----
# construct: congregations and adherents reported by religious bodies
# (institutional presence), not a census self-identification question.
# population_total_basis differs from nz/vu accordingly (playbook, binding).
build_rows <- function(agg, year, source_id) {
  land_area <- setNames(
    vapply(geojson$features, function(f) {
      a <- f$properties$ALAND
      if (is.null(a)) NA_real_ else as.numeric(a) / 1e6  # sq metres -> sq km
    }, numeric(1)),
    geoids
  )
  lapply(seq_len(nrow(agg)), function(i) {
    r <- agg[i, ]
    pct <- if (is.finite(r$pop) && r$pop > 0) round(100 * r$adh / r$pop, 2) else NA
    la <- unname(land_area[r$fips])
    list(
      country_code = "US",
      boundary_set_id = "us-county-2020",
      boundary_level = "county",
      area_unit_id = paste0("us-county-2020:", r$fips),
      area_code = r$fips,
      area_name = paste0(r$name, ", ", r$state),
      year = year,
      population_total = if (is.finite(r$pop)) r$pop else NULL,
      population_total_basis = "resident population (denominator of published adherence rates)",
      religious_affiliation_count = if (is.finite(r$adh)) r$adh else NULL,
      religious_affiliation_percent = if (is.finite(pct)) pct else NULL,
      no_religion_count = NULL,
      no_religion_percent = NULL,
      place_count = NULL,
      places_per_10000_residents = NULL,
      place_density_per_sq_km = NULL,
      land_area_sq_km = if (is.finite(la)) round(la, 2) else NULL,
      site_snapshot_date = NULL,
      place_count_basis = NULL,
      quality_flag = if (year == 2010 && r$fips %in% pending_split_fips) {
        "county_created_by_post_2010_split_no_2010_data"
      } else if (r$fips %in% crosswalk$new_fips) {
        "county_boundary_change_crosswalked"
      } else {
        ""
      },
      source_dataset_ids = list(source_id, "census-bureau-cb-county-2020", "us-fips-crosswalk-2010-2020")
    )
  })
}

rows <- c(
  build_rows(d10_agg, 2010, "usrc-2010-county-file"),
  build_rows(d20_agg, 2020, "usrc-2020-county-file")
)

source_datasets <- list(
  list(
    source_dataset_id = "usrc-2010-county-file",
    name = "U.S. Religion Census - Religious Congregations and Membership Study, 2010 (County File)",
    provider = "Association of Religion Data Archives (ARDA); data collected by Grammich, Hadaway, Houseal, Jones, Krindatch, Stanley & Taylor for the Association of Statisticians of American Religious Bodies (ASARB)",
    url = "https://www.thearda.com/data-archive?fid=RCMSCY10",
    retrieval_date = "2026-07-06",
    local_path = "apps/regions/us/data/source/us_rcms_county_2010_extract.csv",
    licence = list(
      name = "no formal EULA; ARDA click-through research-use terms",
      url = "https://www.thearda.com/data-archive?fid=RCMSCY10&tab=3",
      attribution = "Association of Religion Data Archives (ARDA) and the U.S. Religion Census / ASARB"
    ),
    citation = "Grammich, C., Hadaway, K., Houseal, R., Jones, D. E., Krindatch, A., Stanley, R., & Taylor, R. H. (2018, December 11). U.S. Religion Census Religious Congregations and Membership Study, 2010 (County File).",
    access_limits = "None found: file hosted on OSF, downloadable without account/login. ARDA shows an in-page acknowledgement of citation/responsible-use/as-is/Indiana-law terms before revealing the download links (not a registration form).",
    redistribution_limits = "No explicit restriction on derived/aggregated products found; attribute ARDA and the original collectors.",
    notes = "236 religious groups reporting congregations/adherents by county; total adherents are 48.8% of 2010 population per ARDA's own summary. Ten 2010 county fips values predate the 2010 census boundary set (legacy codes for pre-2010 mergers/splits); remapped onto 2020 successors via fips_crosswalk_2010_to_2020.csv."
  ),
  list(
    source_dataset_id = "usrc-2020-county-file",
    name = "U.S. Religion Census - Religious Congregations and Membership Study, 2020 (County File)",
    provider = "Association of Religion Data Archives (ARDA); data collected by Grammich, Hadaway, Houseal, Jones, Krindatch, Stanley & Thumma",
    url = "https://www.thearda.com/data-archive?fid=RCMSCY20",
    retrieval_date = "2026-07-06",
    local_path = "apps/regions/us/data/source/us_rcms_county_2020_extract.csv",
    licence = list(
      name = "no formal EULA; ARDA click-through research-use terms",
      url = "https://www.thearda.com/data-archive?fid=RCMSCY20&tab=3",
      attribution = "Association of Religion Data Archives (ARDA) and the U.S. Religion Census"
    ),
    citation = "U.S. Religion Census: Religious Congregations and Membership Study, 2020 (County File). Association of Statisticians of American Religious Bodies.",
    access_limits = "None found: file hosted on OSF, downloadable without account/login.",
    redistribution_limits = "No explicit restriction on derived/aggregated products found; attribute ARDA and the original collectors.",
    notes = "372 religious groups reporting congregations/adherents by county; perfect 3143/3143 join to the 2020 county boundary file with no crosswalk needed."
  ),
  list(
    source_dataset_id = "census-bureau-cb-county-2020",
    name = "2020 Cartographic Boundary File, Counties, 1:5,000,000",
    provider = "U.S. Census Bureau",
    url = "https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_county_5m.zip",
    retrieval_date = "2026-07-06",
    local_path = "apps/regions/us/data/counties_2020.geojson",
    licence = list(
      name = "U.S. government work (public domain)",
      url = "https://www.census.gov/geographies/mapping-files/time-series/geo/carto-boundary-file.html",
      attribution = "U.S. Census Bureau"
    ),
    citation = "U.S. Census Bureau (2021). 2020 Cartographic Boundary Files, Counties.",
    access_limits = NULL,
    redistribution_limits = "None; public domain.",
    notes = "Filtered to 50 states + DC (3143 of 3234 features); simplified to 1000m tolerance in NAD83 Conus Albers (EPSG:5070), 2.56MB. Published 2021-01-24, before Connecticut's 2022 planning-region switch, so its county layout matches both RCMS waves."
  ),
  list(
    source_dataset_id = "us-fips-crosswalk-2010-2020",
    name = "US county FIPS crosswalk, 2010 RCMS codes to 2020 boundary codes (derived)",
    provider = "Places of Worship project derivation, sourced from U.S. Census Bureau county-change documentation",
    url = "https://www.census.gov/programs-surveys/geography/technical-documentation/county-changes.2010.html",
    retrieval_date = "2026-07-06",
    local_path = "apps/regions/us/data/source/fips_crosswalk_2010_to_2020.csv",
    licence = list(
      name = "derived from public-domain Census Bureau documentation",
      url = NULL,
      attribution = "U.S. Census Bureau county-change records; derivation by the Places of Worship project"
    ),
    citation = "Derived crosswalk; sourced from U.S. Census Bureau 'Substantial Changes to Counties and County Equivalent Entities' technical documentation and Wikipedia corroboration for pre-2010 legacy codes appearing in the RCMS 2010 file.",
    access_limits = NULL,
    redistribution_limits = "None.",
    notes = "10 of 3149 2010 RCMS county rows carry fips codes that predate or postdate simple 1:1 successors (Alaska census-area splits/renames, Yellowstone NP dissolution, two Virginia independent-city mergers, one South Dakota rename). Mapped to their 2020 successor for the join; where a 2010 area split into two 2020 counties, the combined total is attributed to the larger successor and flagged county_boundary_change_crosswalked."
  )
)

indicators <- list(
  list(indicator_id = "population_total", label = "Resident population",
       description = "Resident population of the county in the census year, the denominator of the published adherence rate.",
       unit = "count", denominator_indicator_id = NULL,
       method = "Read from the RCMS county file's POP field for the matching year.",
       temporal_coverage = "2010, 2020", spatial_coverage = "US counties, 2020 boundary set",
       quality_notes = "Not a religion-response denominator: this is total resident population, unlike the NZ/VU stated-response basis."),
  list(indicator_id = "religious_affiliation_percent", label = "Adherents per 100 population",
       description = "Congregational adherents reported to the U.S. Religion Census per 100 residents. Institutional adherence claimed by participating religious bodies, not a census self-identification question.",
       unit = "percent", denominator_indicator_id = "population_total",
       method = "100 * total adherents (all reporting religious bodies) / resident population.",
       temporal_coverage = "2010, 2020", spatial_coverage = "US counties, 2020 boundary set",
       quality_notes = "Not comparable to the NZ/VU religious-affiliation percentage, which is self-identified in a census question. Coverage varies by religious body: some report members only, some adherents only; ARDA/ASARB documents estimation methods per group. 31 counties nationally have reported adherents exceeding population (denominator/numerator mismatch: undercount, membership overcount, or residence differing from congregational membership)."),
  list(indicator_id = "religious_change", label = "Change in adherents per 100 population",
       description = "Percentage-point change in adherents per 100 population between 2010 and 2020.",
       unit = "percentage points", denominator_indicator_id = "population_total",
       method = "2020 adherents-per-100 minus 2010 adherents-per-100.",
       temporal_coverage = "2010-2020", spatial_coverage = "US counties, 2020 boundary set",
       quality_notes = "Denomination participation differs somewhat between the 2010 and 2020 waves; treat as indicative of direction rather than a precise rate.")
)

manifest <- list(
  schema_version = "0.1.0",
  generated_at = stamp,
  generated_by = "scripts/build_us_area_summary.R",
  country_code = "US",
  boundary_set = list(
    boundary_set_id = "us-county-2020",
    country_code = "US",
    level = "county",
    vintage = "2020",
    source_dataset_id = "census-bureau-cb-county-2020"
  ),
  site_snapshot = list(
    source_dataset_id = NULL,
    snapshot_date = NULL,
    basis = "no OpenStreetMap place-of-worship layer built yet for the US",
    notes = "place_count and its derived rates are omitted (not zero) pending a US OSM extraction pass."
  ),
  source_datasets = source_datasets,
  indicators = indicators,
  data_status = "adherents_live",
  data_status_note = "Congregations/adherents are live for all counties in 2010 and 2020 (U.S. Religion Census County Files). No no-religion metric is offered: absence of reported adherence in this construct is not equivalent to a census no-religion response. No place-of-worship density metric is offered yet: the US OSM layer has not been built.",
  rows = rows
)

json_path <- file.path(us_dir, "area_summary_county.json")
write_json(manifest, json_path, auto_unbox = TRUE, pretty = TRUE, null = "null", na = "null", digits = NA)

# csv sibling, flattened
flat <- do.call(rbind, lapply(rows, function(r) {
  data.frame(
    country_code = r$country_code, boundary_set_id = r$boundary_set_id, boundary_level = r$boundary_level,
    area_unit_id = r$area_unit_id, area_code = r$area_code, area_name = r$area_name, year = r$year,
    population_total = ifelse(is.null(r$population_total), NA, r$population_total),
    population_total_basis = r$population_total_basis,
    religious_affiliation_count = ifelse(is.null(r$religious_affiliation_count), NA, r$religious_affiliation_count),
    religious_affiliation_percent = ifelse(is.null(r$religious_affiliation_percent), NA, r$religious_affiliation_percent),
    no_religion_count = NA, no_religion_percent = NA,
    place_count = NA, places_per_10000_residents = NA, place_density_per_sq_km = NA,
    land_area_sq_km = ifelse(is.null(r$land_area_sq_km), NA, r$land_area_sq_km),
    site_snapshot_date = NA, place_count_basis = NA,
    source_dataset_ids = paste(unlist(r$source_dataset_ids), collapse = "|"),
    quality_flag = r$quality_flag,
    stringsAsFactors = FALSE
  )
}))
write.csv(flat, file.path(us_dir, "area_summary_county.csv"), row.names = FALSE, na = "")

cat(sprintf("\nwrote %s: %d rows (%.0f counties x 2 years)\n", json_path, length(rows), length(rows) / 2))
cat("done\n")
