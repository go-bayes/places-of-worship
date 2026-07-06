# build the us county boundary geojson for the region map from the census
# bureau cartographic boundary file.
# inputs: data/raw/us_rcms/cb_extract/cb_2020_us_county_5m.shp (2020
# vintage, 1:5,000,000 scale, public domain; downloaded from
# https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_county_5m.zip,
# see data/raw/us_rcms/sources.csv for provenance)
# outputs: apps/regions/us/data/counties_2020.geojson (50 states + DC,
# GEOID is the 5-digit county fips join key used by area_summary_county)
# run from the repo root: Rscript scripts/build_us_county_boundaries.R

suppressMessages(library(sf))

shp_path <- "data/raw/us_rcms/cb_extract/cb_2020_us_county_5m.shp"
out_path <- "apps/regions/us/data/counties_2020.geojson"

shp <- st_read(shp_path, quiet = TRUE)

# rcms covers the 50 states + dc only; drop territories (pr, vi, gu, as,
# mp) so the join set matches the data and the file stays smaller
us <- shp[shp$STUSPS %in% c(state.abb, "DC"), c("GEOID", "NAME", "STUSPS", "STATE_NAME", "ALAND", "AWATER")]
stopifnot(nrow(us) == 3143)

# simplify in an equal-area conic projection (nad83 conus albers) so the
# tolerance is roughly consistent across conus, alaska and hawaii, then
# reproject back to wgs84 for the geojson; 1000m keeps visible detail at
# national zoom while cutting file size by about half versus unsimplified
us_proj <- st_transform(us, 5070)
us_simplified <- st_simplify(us_proj, dTolerance = 1000, preserveTopology = TRUE)
us_wgs <- st_transform(us_simplified, 4326)

if (file.exists(out_path)) file.remove(out_path)
st_write(us_wgs, out_path, driver = "GeoJSON", quiet = TRUE)

cat(sprintf("wrote %s: %d counties, %.2f MB\n", out_path, nrow(us_wgs), file.size(out_path) / 1e6))
