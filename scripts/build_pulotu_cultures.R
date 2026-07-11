#!/usr/bin/env Rscript

# build_pulotu_cultures.R
# builds the single global "Pulotu cultures" data product: 137 Pacific culture
# points from the cached Pulotu release (D-PLACE CLDF edition v1.3.1, CC BY 4.0)
# plus the accompanying manifest. data only, no runtime. the ratified design is
# docs/development/pulotu-cultures-layer.md; the facts are in research/pulotu/.
# emits: apps/regions/_shared/data/pulotu_cultures.geojson
#        docs/manifests/pulotu-cultures-1.3.1.json
# run with: Rscript scripts/build_pulotu_cultures.R

suppressMessages({
  library(sf)
  library(jsonlite)
  library(digest)
})

# planar geos assignment: the natural earth polygons carry a few invalid loops
# that the s2 spherical engine rejects; planar point-in-polygon is exact enough
# for country resolution and sidesteps the lwgeom dependency (not installed).
sf_use_s2(FALSE)

repo <- normalizePath(file.path(dirname(sub("^--file=", "", grep("^--file=", commandArgs(), value = TRUE)[1])), ".."))
if (is.na(repo) || length(repo) == 0) repo <- normalizePath(getwd())

raw_dir      <- file.path(repo, "data/raw/pulotu")
societies_fp <- file.path(raw_dir, "pulotu_societies.csv")
data_fp      <- file.path(raw_dir, "pulotu_data.csv")
variables_fp <- file.path(raw_dir, "pulotu_variables.csv")
codes_fp     <- file.path(raw_dir, "pulotu_codes.csv")
licence_fp   <- file.path(raw_dir, "pulotu_LICENSE.txt")
ne_fp        <- file.path(raw_dir, "ne_10m_admin_0_countries.geojson")

out_geojson  <- file.path(repo, "apps/regions/_shared/data/pulotu_cultures.geojson")
out_manifest <- file.path(repo, "docs/manifests/pulotu-cultures-1.3.1.json")

# --- read the cached release (read.csv handles the quoted embedded newlines) ---
soc   <- read.csv(societies_fp, stringsAsFactors = FALSE, colClasses = "character")
dat   <- read.csv(data_fp,      stringsAsFactors = FALSE, colClasses = "character")
vars  <- read.csv(variables_fp, stringsAsFactors = FALSE, colClasses = "character")
codes <- read.csv(codes_fp,     stringsAsFactors = FALSE, colClasses = "character")

soc$Latitude  <- as.numeric(soc$Latitude)
soc$Longitude <- as.numeric(soc$Longitude)

stopifnot(nrow(soc) == 137)

# --- the ratified curated variable set (design ruling 3) -----------------------
# five curated values plus the two calendar anchors; the full-record link carries
# the remaining 80 variables.
curated <- list(
  list(key = "adoption_world_religion",            param = "68", name = "Adoption of a world religion"),
  list(key = "dominant_world_religion",            param = "85", name = "Dominant world religion"),
  list(key = "belief_in_gods",                     param = "2",  name = "Belief in god(s)"),
  list(key = "belief_in_ancestral_spirits",        param = "5",  name = "Belief in ancestral spirits"),
  list(key = "supernatural_punishment_for_impiety", param = "7", name = "Belief in supernatural punishment for impiety")
)
anchor_traditional  <- "1"   # Traditional State Time Focus (137/137)
anchor_contemporary <- "82"  # Contemporary Time Focus (121/137)

# code label lookup: label_by[[param]][[value]] -> human-readable Description.
label_by <- local({
  out <- list()
  for (p in unique(codes$Parameter_ID)) {
    sub <- codes[codes$Parameter_ID == p, ]
    out[[p]] <- setNames(sub$Description, sub$Name)
  }
  out
})

# fast row lookup keyed on culture and parameter; one observed row per cell.
dat$key <- paste(dat$Language_ID, dat$Parameter_ID, sep = "|")
row_by <- setNames(seq_len(nrow(dat)), dat$key)

# split a Pulotu Source string (";"-separated bib keys with page refs) to a list.
split_sources <- function(s) {
  if (is.na(s) || !nzchar(s)) return(list())
  parts <- trimws(strsplit(s, ";", fixed = TRUE)[[1]])
  as.list(parts[nzchar(parts)])
}

# fetch a curated Option value with its label and sources, or NA when uncoded.
get_curated <- function(culture, param, name) {
  i <- unname(row_by[paste(culture, param, sep = "|")])
  if (is.na(i)) return(NA)
  val <- dat$Value[i]
  lbl <- unname(label_by[[param]][val])
  obj <- list(
    variable_id = as.integer(param),
    variable    = name,
    code        = suppressWarnings(as.integer(val)),
    label       = if (is.na(lbl)) NA else lbl,
    sources     = split_sources(dat$Source[i])
  )
  obj
}

# fetch a text time-focus anchor with a parsed year, or NA when absent.
get_anchor <- function(culture, param) {
  i <- unname(row_by[paste(culture, param, sep = "|")])
  if (is.na(i)) return(NA)
  val <- dat$Value[i]
  yr  <- if (grepl("^[0-9]{4}$", val)) as.integer(val) else NA
  list(
    variable_id = as.integer(param),
    value       = val,
    year        = yr,
    sources     = split_sources(dat$Source[i])
  )
}

# --- computed modern-country ISO2 tag ------------------------------------------
# method: point-in-polygon against natural earth 10m admin-0, with a geodesic
# nearest-land fallback for offshore centroids the boundary layer does not carry.
world <- st_read(ne_fp, quiet = TRUE)
world$iso2 <- ifelse(!is.na(world$ISO_A2_EH) & world$ISO_A2_EH != "-99",
                     world$ISO_A2_EH, world$ISO_A2)
world_fixed <- suppressWarnings(st_buffer(world, 0))
pts <- st_as_sf(soc, coords = c("Longitude", "Latitude"), crs = 4326, remove = FALSE)

hits <- suppressMessages(suppressWarnings(st_intersects(pts, world_fixed)))
iso <- rep(NA_character_, nrow(soc))
inside <- rep(FALSE, nrow(soc))
for (i in seq_len(nrow(soc))) {
  if (length(hits[[i]]) > 0) {
    iso[i] <- world_fixed$iso2[hits[[i]][1]]
    inside[i] <- TRUE
  }
}

# geodesic nearest-land fallback (great-circle to the nearest boundary vertex).
haversine_km <- function(lon1, lat1, lon2, lat2) {
  r <- 6371; d <- pi / 180
  a <- sin((lat2 - lat1) * d / 2)^2 +
       cos(lat1 * d) * cos(lat2 * d) * sin((lon2 - lon1) * d / 2)^2
  2 * r * asin(pmin(1, sqrt(a)))
}
vcoord <- st_coordinates(world)
vlon <- vcoord[, 1]; vlat <- vcoord[, 2]
viso <- world$iso2[vcoord[, ncol(vcoord)]]
offshore_km <- rep(0, nrow(soc))
miss <- which(is.na(iso))
for (i in miss) {
  dkm <- haversine_km(soc$Longitude[i], soc$Latitude[i], vlon, vlat)
  j <- which.min(dkm)
  iso[i] <- viso[j]
  offshore_km[i] <- dkm[j]
}

# documented territorial correction: natural earth folds the Tokelau atolls into
# new zealand, but iso 3166-1 assigns Tokelau its own code TK and the project
# ships a Tokelau frame; tag the single tokelau culture TK.
tokelau_corrected <- soc$ID == "tokelau" & iso == "NZ"
iso[tokelau_corrected] <- "TK"
soc$iso2 <- iso

# --- hard gates: stop on failure, do not tune past ----------------------------
gate_fail <- function(msg) stop(sprintf("GATE FAILED: %s", msg), call. = FALSE)

# gate 1: feature count and distinct coordinates.
if (nrow(soc) != 137) gate_fail(sprintf("feature count %d, expected 137", nrow(soc)))
n_distinct_coord <- nrow(unique(soc[, c("Latitude", "Longitude")]))
if (n_distinct_coord != 137) gate_fail(sprintf("only %d distinct coordinate pairs of 137", n_distinct_coord))

# gate 2: country assignment (the transposed-sign gate). Vanuatu must yield the
# nine documented cultures and exclude the documented intruders.
vu_expected <- sort(c("tanna", "aneityum", "erromango", "futuna-west", "Seniang",
                      "small_islands", "nguna", "south_pentecost", "mota"))
vu_built <- sort(soc$ID[soc$iso2 == "VU"])
if (!identical(vu_built, vu_expected)) {
  gate_fail(sprintf("VU set mismatch. built: %s", paste(vu_built, collapse = ", ")))
}
intruders <- c(lifou = "NC", mare = "NC", tikopia = "SB", anuta = "SB")
for (nm in names(intruders)) {
  got <- soc$iso2[soc$ID == nm]
  if (length(got) != 1 || got == "VU") gate_fail(sprintf("intruder %s tagged %s (must not be VU)", nm, got))
  if (got != intruders[[nm]]) gate_fail(sprintf("intruder %s expected %s, got %s", nm, intruders[[nm]], got))
}
# every culture must carry a valid country tag; a transposed sign would leave a
# point stranded far from any land.
if (any(is.na(soc$iso2) | soc$iso2 == "-99")) gate_fail("one or more cultures have no country tag")
max_offshore <- max(offshore_km)
transposition_bound_km <- 600  # documented: the true maximum (ifaluk, an outer atoll absent from the boundary layer) is ~517 km
if (max_offshore > transposition_bound_km) {
  gate_fail(sprintf("offshore distance %.1f km exceeds the %d km transposition bound", max_offshore, transposition_bound_km))
}

# gate 3: dateline. emit the signed [-180, 180] convention the runtime data uses;
# point features carry no antimeridian-spanning edges, therefore no cutting.
if (any(soc$Longitude < -180 | soc$Longitude > 180)) gate_fail("longitude outside [-180, 180]")
if (any(soc$Latitude  <  -90 | soc$Latitude  >  90)) gate_fail("latitude outside [-90, 90]")

# --- build the 137 point features ----------------------------------------------
build_feature <- function(i) {
  culture <- soc$ID[i]
  values <- list()
  for (cv in curated) {
    obj <- get_curated(culture, cv$param, cv$name)
    # forward hook: the dominant-world-religion value carries an optional
    # denomination-taxonomy code field, null-filled until a taxonomy exists.
    if (cv$key == "dominant_world_religion" && is.list(obj)) {
      obj$denomination_taxonomy_code <- NA
    }
    values[[cv$key]] <- obj
  }
  props <- list(
    culture_id   = culture,
    name         = soc$Name[i],
    country_iso2 = soc$iso2[i],
    glottocode   = if (nzchar(soc$Glottocode[i])) soc$Glottocode[i] else NA,
    record_url   = paste0("https://pulotu.com/culture/", culture),
    values       = values,
    time_focus   = list(
      traditional_state = get_anchor(culture, anchor_traditional),
      contemporary      = get_anchor(culture, anchor_contemporary)
    )
  )
  list(
    type = "Feature",
    geometry = list(type = "Point", coordinates = c(soc$Longitude[i], soc$Latitude[i])),
    properties = props
  )
}
features <- lapply(seq_len(nrow(soc)), build_feature)

fc <- list(type = "FeatureCollection", features = features)
geojson_txt <- toJSON(fc, auto_unbox = TRUE, na = "null", null = "null",
                      digits = NA, pretty = TRUE)

dir.create(dirname(out_geojson), showWarnings = FALSE, recursive = TRUE)
writeLines(geojson_txt, out_geojson)

# --- hashes and byte counts ----------------------------------------------------
sha256_file <- function(fp) digest(file = fp, algo = "sha256")
bytes_file  <- function(fp) as.integer(file.info(fp)$size)

geojson_sha  <- sha256_file(out_geojson)
geojson_bytes <- bytes_file(out_geojson)

raw_inputs <- list(
  list(uri = "data/raw/pulotu/pulotu_societies.csv", url = "https://github.com/D-PLACE/dplace-dataset-pulotu/raw/v1.3.1/cldf/societies.csv", fmt = "csv", sid = "pulotu-dplace-cldf-v1-3-1", note = "137 culture units with coordinates and glottocodes (CLDF LanguageTable)."),
  list(uri = "data/raw/pulotu/pulotu_data.csv",      url = "https://github.com/D-PLACE/dplace-dataset-pulotu/raw/v1.3.1/cldf/data.csv",      fmt = "csv", sid = "pulotu-dplace-cldf-v1-3-1", note = "10,423 long-format value rows with per-value source references (CLDF ValueTable)."),
  list(uri = "data/raw/pulotu/pulotu_variables.csv", url = "https://github.com/D-PLACE/dplace-dataset-pulotu/raw/v1.3.1/cldf/variables.csv", fmt = "csv", sid = "pulotu-dplace-cldf-v1-3-1", note = "88 variable definitions (CLDF ParameterTable)."),
  list(uri = "data/raw/pulotu/pulotu_codes.csv",     url = "https://github.com/D-PLACE/dplace-dataset-pulotu/raw/v1.3.1/cldf/codes.csv",     fmt = "csv", sid = "pulotu-dplace-cldf-v1-3-1", note = "277 code labels for the categorical variables (CLDF CodeTable)."),
  list(uri = "data/raw/pulotu/pulotu_LICENSE.txt",   url = "https://github.com/D-PLACE/dplace-dataset-pulotu/raw/v1.3.1/LICENSE",            fmt = "txt", sid = "pulotu-dplace-cldf-v1-3-1", note = "Creative Commons Attribution 4.0 International legal code; the sole licence evidence claimed for this product."),
  list(uri = "data/raw/pulotu/ne_10m_admin_0_countries.geojson", url = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson", fmt = "geojson", sid = "natural-earth-10m-admin0", note = "Natural Earth 10m admin-0 countries (public domain); the boundary layer for the computed modern-country tag.")
)
raw_sources <- lapply(raw_inputs, function(r) {
  fp <- file.path(repo, r$uri)
  list(uri = r$uri, url = r$url, retrieval_date = "2026-07-11", format = r$fmt,
       bytes = bytes_file(fp), sha256 = sha256_file(fp),
       source_dataset_id = r$sid, used_in_public_product = TRUE, notes = r$note)
})

git_commit <- tryCatch(trimws(system2("git", c("-C", repo, "rev-parse", "--short", "HEAD"), stdout = TRUE)),
                       error = function(e) NA_character_)
if (length(git_commit) != 1 || is.na(git_commit) || !nzchar(git_commit)) git_commit <- NA

country_tally <- as.list(sort(table(soc$iso2), decreasing = TRUE))
country_codes <- sort(unique(soc$iso2))

# --- prose (NZ English; no ", so" joins) ---------------------------------------
description_note <- "Pulotu cultures: 137 Pacific culture points from the Pulotu database of Austronesian religions (D-PLACE CLDF edition v1.3.1, CC BY 4.0). Each point carries a curated set of Pulotu variables with human-readable code labels and per-value source references, the two calendar anchors (Traditional State Time Focus and Contemporary Time Focus), a computed modern-country ISO2 tag, and a link to the culture's full Pulotu record. This is the single global product; country pages opt in by config."

construct_notes <- c(
  "Measurement-diversity principle. Pulotu is a scholarly reconstruction with per-value sourcing, not an enumeration. This layer renders documented cultural reconstructions, never counts.",
  "Never-merge rule. Pulotu values never enter area summaries, census metrics, or change layers. This build touches no census artefact.",
  "Curated variable set (design ruling 3). Each feature carries five curated values with their code labels and source references: Adoption of a world religion, Dominant world religion, Belief in god(s), Belief in ancestral spirits, and Belief in supernatural punishment for impiety. The full-record link (https://pulotu.com/culture/{id}) carries the remaining 80 variables. The Dominant world religion value carries an optional denomination-taxonomy code field, null-filled until a taxonomy exists; no taxonomy is invented here.",
  "Temporal treatment (design ruling 4). The layer is independent of the census year slider. Each feature declares its own two calendar anchors; the Traditional State Time Focus is present for all 137 cultures and the Contemporary Time Focus for 121, null where absent. There is no per-value date and no series between the anchors, and the dated-places interval fields are not emitted.",
  "Computed modern-country tag. The ISO2 tag is computed by point-in-polygon assignment of each culture coordinate against Natural Earth 10m admin-0 countries, with a geodesic nearest-land fallback for the offshore centroids the boundary layer does not contain (Pulotu points are society centroids often placed just offshore of small islands). One documented territorial correction is applied: Natural Earth attributes the Tokelau atolls to New Zealand, while ISO 3166-1 assigns Tokelau its own code TK and the project ships a Tokelau frame; the single tokelau culture is tagged TK. The Vanuatu assignment yields exactly the nine documented cultures and excludes the New Caledonia intruders (lifou, mare) and the Solomon Islands intruders (tikopia, anuta). The computed tally differs from the exploration profile's nearest-populated-place counts in a few border cases (for example Varisi resolves to Solomon Islands rather than Papua New Guinea); the point-in-polygon result is the shipped assignment.",
  "Dateline convention. The product emits point coordinates in the signed [-180, 180] convention the runtime data already uses, verified against apps/regions/ki/data/ki_island_2017.geojson and apps/regions/fj/data/fj_province_2020.geojson. Every Pulotu longitude falls within [-178, 178]; no point sits on the antimeridian. Point features carry no antimeridian-spanning edges, therefore no cutting is required and each point plots once in either map frame with no loss or mirroring. The build brief anticipated Kiribati cultures on both sides of 180; in the cached release Kiribati holds a single culture (kiribati) at longitude 174.70, west of the antimeridian. The both-sides-of-180 condition is a property of the global product's Pacific span (Fiji near +178 alongside Tonga near -175), not of Kiribati's single point, and the signed convention carries that span without loss."
)

# --- manifest ------------------------------------------------------------------
manifest <- list(
  `$schema` = "../../schemas/data-manifest.schema.json",
  schema_version = "data-manifest.v2",
  manifest_id = "manifest:pulotu-cultures:global:1.3.1",
  dataset_id = "pulotu-cultures:global:1.3.1",
  dataset_version_id = paste0("pulotu-cultures:global:1.3.1:", substr(geojson_sha, 1, 12)),
  manifest_sha256 = NA,
  supersedes_manifest_id = NA,
  superseded_by_manifest_id = NA,
  dataset_family = "pulotu-cultures",
  dataset_role = "public_product",
  scope = list(
    level = "global",
    country_codes = country_codes,
    snapshot_date = NA,
    pipeline_stage = "public"
  ),
  created_at = "2026-07-11T00:00:00Z",
  created_by = "scripts/build_pulotu_cultures.R",
  pipeline = list(
    script = "scripts/build_pulotu_cultures.R",
    git_commit = git_commit,
    command = "Rscript scripts/build_pulotu_cultures.R",
    parameters = list(
      product = "Pulotu cultures",
      release = "D-PLACE CLDF edition v1.3.1 (Zenodo 10.5281/zenodo.19127704)",
      feature_geometry = "point (the dataset's own geometry; no polygon exists in Pulotu)",
      curated_variables = c("68 Adoption of a world religion", "85 Dominant world religion",
                            "2 Belief in god(s)", "5 Belief in ancestral spirits",
                            "7 Belief in supernatural punishment for impiety"),
      calendar_anchors = c("1 Traditional State Time Focus (137/137)", "82 Contemporary Time Focus (121/137)"),
      record_link_pattern = "https://pulotu.com/culture/{culture_id}",
      country_method = "point-in-polygon against Natural Earth 10m admin-0, geodesic nearest-land fallback for offshore centroids; documented Tokelau (NZ->TK) territorial correction",
      dateline_convention = "signed [-180, 180]; point features carry no antimeridian-spanning edges (no cutting required)",
      denomination_taxonomy_hook = "dominant_world_religion carries a null-filled denomination_taxonomy_code field; no taxonomy invented"
    ),
    software_versions = list(
      r = R.version.string,
      sf = as.character(packageVersion("sf")),
      jsonlite = as.character(packageVersion("jsonlite")),
      digest = as.character(packageVersion("digest"))
    )
  ),
  source = list(
    provider = "Pulotu: Database of Austronesian Supernatural Beliefs and Practices (D-PLACE CLDF edition)",
    source_dataset_ids = c("pulotu-dplace-cldf-v1-3-1", "natural-earth-10m-admin0"),
    source_urls = c("https://github.com/D-PLACE/dplace-dataset-pulotu",
                    "https://pulotu.com",
                    "https://github.com/nvkelso/natural-earth-vector"),
    retrieved_at = "2026-07-11T00:00:00Z",
    licence = "CC-BY-4.0",
    citation = "Watts J., Sheehan O., Greenhill S.J., Gomes-Ng S., Atkinson Q.D., Bulbulia J., Gray R.D. (2015). Pulotu: Database of Austronesian Supernatural Beliefs and Practices. PLoS ONE 10(9), e0136783. doi:10.1371/journal.pone.0136783. Version DOI 10.5281/zenodo.19127704.",
    raw_redistribution = "Raw Pulotu CLDF tables stay git-ignored under data/raw/pulotu/; only the derived point product is published. The Natural Earth boundary layer is public domain and used only to compute the country tag."
  ),
  durable_files = list(
    list(
      uri = "repo:apps/regions/_shared/data/pulotu_cultures.geojson",
      storage_provider = "git_repository",
      format = "geojson",
      bytes = geojson_bytes,
      sha256 = geojson_sha,
      feature_count = 137L,
      content = "Pulotu cultures: 137 global point features carrying the five curated Pulotu values with code labels and per-value source references, the two calendar anchors, a computed modern-country ISO2 tag, a null-filled denomination-taxonomy hook on Dominant world religion, and a link to the culture's full Pulotu record.",
      privacy = "public",
      licence_status = "accepted",
      licence_basis = "cc_by_4_0"
    )
  ),
  raw_sources = raw_sources,
  stats = list(
    feature_count = 137L,
    distinct_coordinates = n_distinct_coord,
    countries = length(country_codes),
    country_tally = country_tally,
    vanuatu_cultures = vu_built,
    curated_value_coverage = list(
      adoption_world_religion = sum(dat$Parameter_ID == "68"),
      dominant_world_religion = sum(dat$Parameter_ID == "85"),
      belief_in_gods = sum(dat$Parameter_ID == "2"),
      belief_in_ancestral_spirits = sum(dat$Parameter_ID == "5"),
      supernatural_punishment_for_impiety = sum(dat$Parameter_ID == "7")
    ),
    anchor_coverage = list(
      traditional_state_time_focus = sum(dat$Parameter_ID == "1"),
      contemporary_time_focus = sum(dat$Parameter_ID == "82")
    ),
    max_offshore_fallback_km = round(max_offshore, 1)
  ),
  validation = list(
    status = "passed",
    commands = c("Rscript scripts/build_pulotu_cultures.R",
                 "bash scripts/validate_manifests.sh"),
    gates = list(
      feature_count_137 = TRUE,
      distinct_coordinates_137 = (n_distinct_coord == 137),
      vanuatu_nine_exact = identical(vu_built, vu_expected),
      intruders_excluded_from_vu = TRUE,
      every_point_has_country = TRUE,
      offshore_within_transposition_bound = (max_offshore <= transposition_bound_km),
      dateline_signed_range = TRUE
    ),
    notes = sprintf("Vanuatu yields exactly the nine documented cultures; intruders lifou/mare land in NC and tikopia/anuta in SB. Maximum offshore nearest-land fallback distance %.1f km (ifaluk, an outer atoll absent from the 10m boundary layer), under the %d km transposition bound.", max_offshore, transposition_bound_km)
  ),
  privacy = "public",
  licence_status = "accepted",
  licence_basis = "cc_by_4_0",
  downstream_status = "public",
  construct_notes = construct_notes,
  notes = description_note
)

manifest_txt <- toJSON(manifest, auto_unbox = TRUE, na = "null", null = "null",
                       digits = NA, pretty = TRUE)
writeLines(manifest_txt, out_manifest)

# --- build report --------------------------------------------------------------
cat("built:", out_geojson, "\n")
cat("  features:", length(features), " bytes:", geojson_bytes, "\n")
cat("  sha256:", geojson_sha, "\n")
cat("built:", out_manifest, "\n")
cat("country tally:\n")
print(sort(table(soc$iso2), decreasing = TRUE))
cat("VU (", length(vu_built), "):", paste(vu_built, collapse = ", "), "\n")
cat("max offshore fallback km:", round(max_offshore, 1), "\n")
cat("all gates passed\n")
