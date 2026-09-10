# circulation calibration design: build the site frame for a future study that
# calibrates presence signals against ground truth at places of worship.
# reads data/nz_places.geojson, apps/regions/nz/data/sa2_2023.geojson and
# apps/regions/nz/data/area_summary_sa2.json; writes the stratified frame
# summary, the allocation and a seeded probability sample to
# exports/circulation-calibration/ (git-ignored). no signal data are used; see
# docs/development/circulation-signals-options-2026-09-10.md section 8.
# run from the repository root: Rscript scripts/circulation_calibration_design.R

suppressPackageStartupMessages({
  library(sf)
  library(dplyr)
  library(tidyr)
  library(readr)
  library(purrr)
  library(jsonlite)
})

set.seed(20260910)

places_path <- "data/nz_places.geojson"
sa2_path <- "apps/regions/nz/data/sa2_2023.geojson"
summary_path <- "apps/regions/nz/data/area_summary_sa2.json"
out_dir <- "exports/circulation-calibration"
dir.create(out_dir, showWarnings = FALSE, recursive = TRUE)

# design constants; each is a decision the brief records as open for the pi
sample_size <- 120
stratum_floor <- 8
urban_density_threshold <- 400 # residents per square kilometre; a proxy, not the stats nz urban/rural classification
census_year <- 2023

# read the osm-derived places as a tidy frame with one row per site;
# inputs: geojson path; output: sf points with the tags we stratify on
read_places <- function(path) {
  raw <- fromJSON(path, simplifyVector = TRUE)
  props <- raw$features$properties
  tags <- props$osm_tags
  coords <- do.call(rbind, raw$features$geometry$coordinates)
  tibble(
    place_id = props$place_id,
    osm_type = props$osm_type,
    osm_id = props$osm_id,
    name = props$name,
    religion_tag = tags$religion,
    denomination_tag = tags$denomination,
    has_building_tag = !is.na(tags$building),
    lon = coords[, 1],
    lat = coords[, 2]
  ) |>
    st_as_sf(coords = c("lon", "lat"), crs = 4326, remove = FALSE)
}

# map the osm religion and denomination tags to the five denomination groups
# the brief proposes, plus a sixth group for sites with no religion tag, which
# are the frame's best supply of sites that may host no worship at all.
# cooperating parishes (tags joined by ";") and christian sites without a
# denomination tag fall into other_christian
denomination_group <- function(religion, denomination) {
  case_when(
    is.na(religion) ~ "unknown",
    religion != "christian" ~ "non_christian",
    is.na(denomination) ~ "other_christian",
    grepl(";", denomination, fixed = TRUE) ~ "other_christian",
    denomination == "anglican" ~ "anglican",
    denomination == "presbyterian" ~ "presbyterian",
    denomination %in% c("catholic", "roman_catholic") ~ "catholic",
    TRUE ~ "other_christian"
  )
}

places <- read_places(places_path) |>
  mutate(
    denomination_group = denomination_group(religion_tag, denomination_tag),
    # mapping detail is the only size-like proxy in the current data
    mapping_detail = if_else(osm_type == "way" & has_building_tag, "building_mapped", "point_only")
  )

# sa2 membership and a residential-density proxy from the census summary
sa2 <- st_read(sa2_path, quiet = TRUE) |>
  select(sa2_code = SA22023_V1_00, sa2_name = SA22023_V1_00_NAME)

density <- fromJSON(summary_path)$rows |>
  as_tibble() |>
  filter(year == census_year) |>
  transmute(
    sa2_code = area_code,
    population_total,
    land_area_sq_km,
    residents_per_sq_km = if_else(land_area_sq_km > 0, population_total / land_area_sq_km, NA_real_)
  )

# a point on a shared boundary joins twice and a coastal point simplified
# outside every polygon joins nowhere; keep one sa2 per site and give the
# unplaced points their nearest sa2
joined <- places |>
  st_join(sa2, join = st_within, left = TRUE) |>
  distinct(place_id, .keep_all = TRUE)
unplaced <- filter(joined, is.na(sa2_code))
if (nrow(unplaced) > 0) {
  nearest <- st_drop_geometry(sa2)[st_nearest_feature(unplaced, sa2), ]
  unplaced$sa2_code <- nearest$sa2_code
  unplaced$sa2_name <- nearest$sa2_name
}
frame <- bind_rows(filter(joined, !is.na(sa2_code)), unplaced) |>
  mutate(sa2_placement = if_else(place_id %in% unplaced$place_id, "nearest_sa2", "within_sa2")) |>
  st_drop_geometry() |>
  left_join(density, by = "sa2_code") |>
  mutate(
    urban_rural = case_when(
      is.na(residents_per_sq_km) ~ "unknown",
      residents_per_sq_km >= urban_density_threshold ~ "urban",
      TRUE ~ "rural"
    ),
    stratum = paste(denomination_group, urban_rural, sep = " × ")
  )

frame_summary <- frame |>
  count(denomination_group, urban_rural, mapping_detail, name = "sites") |>
  arrange(denomination_group, urban_rural, mapping_detail)

stratum_sizes <- frame |>
  count(stratum, denomination_group, urban_rural, name = "n_frame") |>
  arrange(desc(n_frame))

# proportional allocation with a floor per stratum; strata smaller than the
# floor take every site; excess above the total is trimmed from the largest
# strata one site at a time so the allocation stays reproducible
allocate <- function(sizes, total, floor) {
  sizes <- sizes |>
    mutate(
      n_prop = round(total * n_frame / sum(n_frame)),
      n_alloc = pmin(n_frame, pmax(floor, n_prop))
    )
  while (sum(sizes$n_alloc) > total) {
    i <- which.max(sizes$n_alloc - pmin(sizes$n_frame, floor))
    if (sizes$n_alloc[i] <= min(sizes$n_frame[i], floor)) break
    sizes$n_alloc[i] <- sizes$n_alloc[i] - 1
  }
  sizes
}

allocation <- allocate(stratum_sizes, sample_size, stratum_floor)

# seeded stratified simple random sample
sample_sites <- frame |>
  inner_join(select(allocation, stratum, n_alloc), by = "stratum") |>
  group_by(stratum) |>
  group_modify(~ slice_sample(.x, n = first(.x$n_alloc))) |>
  ungroup() |>
  select(place_id, osm_type, osm_id, name, denomination_group, urban_rural, mapping_detail,
         sa2_code, sa2_name, sa2_placement, residents_per_sq_km, stratum, lon, lat) |>
  arrange(stratum, name)

write_csv(frame_summary, file.path(out_dir, "frame_summary.csv"))
write_csv(allocation, file.path(out_dir, "allocation.csv"))
write_csv(sample_sites, file.path(out_dir, "sample.csv"))
st_write(
  st_as_sf(sample_sites, coords = c("lon", "lat"), crs = 4326),
  file.path(out_dir, "sample.geojson"),
  driver = "GeoJSON", delete_dsn = TRUE, quiet = TRUE
)

cat("frame:", nrow(frame), "sites;", n_distinct(frame$stratum), "strata\n")
cat("placed by nearest sa2:", sum(frame$sa2_placement == "nearest_sa2"), "\n")
print(count(frame, denomination_group, name = "sites") |> arrange(desc(sites)), n = Inf)
print(count(frame, urban_rural, name = "sites"), n = Inf)
print(count(frame, mapping_detail, name = "sites"), n = Inf)
print(allocation |> select(stratum, n_frame, n_prop, n_alloc), n = Inf)
cat("sample:", nrow(sample_sites), "sites written to", out_dir, "\n")
