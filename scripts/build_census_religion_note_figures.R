# build the three figures for docs/religious-change-highlights.md
# inputs: shipped area-summary products under apps/regions/<iso2>/data/
# outputs: docs/assets/census-religion-note/*.svg
# every number is recomputed from the shipped products at run time; nothing is hand-entered

library(jsonlite)
library(dplyr)
library(ggplot2)

out_dir <- "docs/assets/census-religion-note"
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

# palette: validated reference palette (light mode); text and chrome roles
col_accent <- "#2a78d6" # categorical slot 1, the single emphasis hue
col_first <- "#86b6ef" # sequential step 250, first census wave
col_last <- "#104281" # sequential step 650, latest census wave
col_context <- "#c3c2b7" # de-emphasis gray for context series
col_ink <- "#0b0b0b"
col_ink_2 <- "#52514e"
col_muted <- "#898781"
col_grid <- "#e1e0d9"
col_surface <- "#fcfcfb"

theme_note <- theme_minimal(base_size = 11, base_family = "sans") +
  theme(
    plot.background = element_rect(fill = col_surface, colour = NA),
    panel.grid.minor = element_blank(),
    panel.grid.major = element_line(colour = col_grid, linewidth = 0.3),
    axis.text = element_text(colour = col_muted),
    axis.title = element_text(colour = col_ink_2, size = 10),
    plot.title = element_text(colour = col_ink, face = "bold", size = 13),
    plot.subtitle = element_text(colour = col_ink_2, size = 10),
    plot.caption = element_text(colour = col_muted, size = 8, hjust = 0),
    legend.text = element_text(colour = col_ink_2),
    legend.title = element_blank()
  )

# read one area-summary product and return per-year population-weighted national shares
# stops if the product's no_religion_percent slot is a minority-share metric rather than
# a published none line (the lk/bd/kh two-slot design; docs/development/minority-share-metric.md)
read_national_series <- function(path) {
  d <- fromJSON(path, simplifyVector = FALSE)
  for (ind in d$indicators) {
    if (identical(ind$indicator_id, "no_religion_percent") &&
        grepl("minority share|complement|reference group", tolower(ind$description %||% ""))) {
      stop("minority-share slot design in ", path, "; not a no-religion measure")
    }
  }
  rows <- d$rows
  tibble(
    year = vapply(rows, function(r) as.numeric(r$year), numeric(1)),
    no_religion = vapply(rows, function(r) ifelse(is.null(r$no_religion_percent), NA_real_, as.numeric(r$no_religion_percent)), numeric(1)),
    population = vapply(rows, function(r) ifelse(is.null(r$population_total), NA_real_, as.numeric(r$population_total)), numeric(1))
  ) |>
    filter(!is.na(no_religion), !is.na(population), population > 0) |>
    group_by(year) |>
    summarise(no_religion = sum(no_religion * population) / sum(population), .groups = "drop")
}

# ---- figure 1: belize districts, emphasis on stann creek ----

bz <- fromJSON("apps/regions/bz/data/area_summary_district.json", simplifyVector = FALSE)
bz_rows <- tibble(
  district = vapply(bz$rows, function(r) r$area_name, character(1)),
  year = vapply(bz$rows, function(r) as.numeric(r$year), numeric(1)),
  no_religion = vapply(bz$rows, function(r) as.numeric(r$no_religion_percent), numeric(1))
)
bz_rows <- bz_rows |> mutate(emphasis = district == "Stann Creek")
bz_labels <- bz_rows |> filter(year == max(year))

fig1 <- ggplot(bz_rows, aes(year, no_religion, group = district)) +
  geom_line(data = filter(bz_rows, !emphasis), colour = col_context, linewidth = 0.7) +
  geom_line(data = filter(bz_rows, emphasis), colour = col_accent, linewidth = 1.1) +
  geom_point(data = filter(bz_rows, !emphasis), colour = col_context, size = 1.6) +
  geom_point(data = filter(bz_rows, emphasis), colour = col_accent, size = 2.2) +
  geom_text(
    data = bz_labels,
    aes(label = district, colour = emphasis),
    hjust = 0, nudge_x = 0.6, size = 3.1, family = "sans", show.legend = FALSE
  ) +
  scale_colour_manual(values = c(`TRUE` = col_accent, `FALSE` = col_muted)) +
  scale_x_continuous(breaks = c(2000, 2010, 2022), limits = c(2000, 2030)) +
  scale_y_continuous(limits = c(0, 50), expand = expansion(mult = c(0, 0.02))) +
  labs(
    title = "No-religion share by Belize district, 2000–2022",
    subtitle = "Census affiliation; district population reporting the None line (percent)",
    x = NULL, y = "no religion (%)",
    caption = "Source: Statistical Institute of Belize census tables, rendered from the shipped product\napps/regions/bz/data/area_summary_district.json; provenance in the product manifest bz-census-religion-2000-2022.json."
  ) +
  theme_note

ggsave(file.path(out_dir, "belize-districts.svg"), fig1, width = 7, height = 4.5, device = svglite::svglite)

# ---- figure 2: corpus dumbbell, first vs latest census wave ----

# vetted census-affiliation products with a published no-religion line in the first
# and latest wave; register, survey-panel, and membership series are out of scope,
# and products whose own manifests withhold cross-wave comparison (lt) or whose
# no-religion frame changes mid-series (ck) are excluded
products <- tribble(
  ~label, ~path,
  "Albania", "apps/regions/al/data/area_summary_prefecture.json",
  "Austria", "apps/regions/at/data/area_summary_bundesland.json",
  "Australia", "apps/regions/au/data/area_summary_sa2.json",
  "Burkina Faso", "apps/regions/bf/data/area_summary_region.json",
  "Brazil", "apps/regions/br/data/area_summary_uf.json",
  "Belize", "apps/regions/bz/data/area_summary_district.json",
  "Switzerland", "apps/regions/ch/data/area_summary_canton_census.json",
  "Chile", "apps/regions/cl/data/area_summary_commune.json",
  "Dominica", "apps/regions/dm/data/area_summary_adm0.json",
  "Estonia", "apps/regions/ee/data/area_summary_county.json",
  "Micronesia", "apps/regions/fm/data/area_summary_state.json",
  "Ghana", "apps/regions/gh/data/area_summary_region.json",
  "Croatia", "apps/regions/hr/data/area_summary_county.json",
  "Hungary", "apps/regions/hu/data/area_summary_county.json",
  "Ireland", "apps/regions/ie/data/area_summary_county_city.json",
  "Kiribati", "apps/regions/ki/data/area_summary_island.json",
  "South Korea", "apps/regions/kr/data/area_summary_sido.json",
  "Saint Lucia", "apps/regions/lc/data/area_summary_district.json",
  "Liechtenstein", "apps/regions/li/data/area_summary_municipality.json",
  "Montenegro", "apps/regions/me/data/area_summary_municipality.json",
  "Mexico", "apps/regions/mx/data/area_summary_municipality.json",
  "Nauru", "apps/regions/nr/data/area_summary_adm0.json",
  "Niue", "apps/regions/nu/data/area_summary_national.json",
  "New Zealand", "apps/regions/nz/data/area_summary_ta.json",
  "Peru", "apps/regions/pe/data/area_summary_department.json",
  "Portugal", "apps/regions/pt/data/area_summary_municipality.json",
  "Romania", "apps/regions/ro/data/area_summary_judet.json",
  "Serbia", "apps/regions/rs/data/area_summary_area.json",
  "Rwanda", "apps/regions/rw/data/area_summary_district.json",
  "Solomon Islands", "apps/regions/sb/data/area_summary_province.json",
  "Singapore", "apps/regions/sg/data/area_summary_pa.json",
  "Slovakia", "apps/regions/sk/data/area_summary_kraj.json",
  "Tokelau", "apps/regions/tk/data/area_summary_atoll.json",
  "Tuvalu", "apps/regions/tv/data/area_summary_region.json",
  "England & Wales", "apps/regions/uk/data/area_summary_ew_ltla.json",
  "Scotland", "apps/regions/uk/data/area_summary_sco_ca.json",
  "Kosovo", "apps/regions/xk/data/area_summary_municipality.json",
  "South Africa", "apps/regions/za/data/area_summary_province.json",
  "Zambia", "apps/regions/zm/data/area_summary_province.json"
)

dumbbell <- products |>
  rowwise() |>
  mutate(series = list(read_national_series(path))) |>
  ungroup() |>
  mutate(
    first_year = vapply(series, function(s) min(s$year), numeric(1)),
    last_year = vapply(series, function(s) max(s$year), numeric(1)),
    first_share = vapply(series, function(s) s$no_religion[which.min(s$year)], numeric(1)),
    last_share = vapply(series, function(s) s$no_religion[which.max(s$year)], numeric(1)),
    delta = last_share - first_share,
    axis_label = sprintf("%s, %d–%d", label, first_year, last_year)
  ) |>
  arrange(delta) |>
  mutate(axis_label = factor(axis_label, levels = axis_label))

write.csv(
  dumbbell |> select(label, first_year, last_year, first_share, last_share, delta),
  file.path(out_dir, "no-religion-change-table.csv"),
  row.names = FALSE
)

fig2 <- ggplot(dumbbell, aes(y = axis_label)) +
  geom_segment(aes(x = first_share, xend = last_share, yend = axis_label), colour = col_grid, linewidth = 1.4) +
  geom_point(aes(x = first_share, fill = "first wave shipped"), colour = col_first, size = 2.4) +
  geom_point(aes(x = last_share, fill = "latest wave shipped"), colour = col_last, size = 2.4) +
  scale_fill_manual(
    values = c(`first wave shipped` = col_first, `latest wave shipped` = col_last),
    guide = guide_legend(override.aes = list(colour = c(col_first, col_last), size = 3))
  ) +
  scale_x_continuous(limits = c(0, 60), expand = expansion(mult = c(0, 0.02))) +
  labs(
    title = "No-religion share, first versus latest shipped census wave",
    subtitle = "Population-weighted national share from each country's\ncensus-affiliation product (percent)",
    x = "no religion (%)", y = NULL,
    caption = "Each row spans the wave years shown in its label; constructs and universes\nare per product as published. Source: shipped area-summary products under\napps/regions/<iso2>/data/; per-product provenance in the project manifest register."
  ) +
  theme_note +
  theme(legend.position = "top", axis.text.y = element_text(colour = col_ink_2, size = 8.5))

ggsave(file.path(out_dir, "no-religion-dumbbell.svg"), fig2, width = 7, height = 9, device = svglite::svglite)

# ---- figure 3: chile commune distributions, 2002 vs 2024 ----

cl <- fromJSON("apps/regions/cl/data/area_summary_commune.json", simplifyVector = FALSE)
cl_rows <- tibble(
  year = vapply(cl$rows, function(r) as.numeric(r$year), numeric(1)),
  no_religion = vapply(cl$rows, function(r) ifelse(is.null(r$no_religion_percent), NA_real_, as.numeric(r$no_religion_percent)), numeric(1))
) |>
  filter(!is.na(no_religion)) |>
  mutate(wave = factor(year))

cl_label_pos <- cl_rows |> group_by(wave) |> summarise(x = median(no_religion), .groups = "drop")

fig3 <- ggplot(cl_rows, aes(no_religion, fill = wave)) +
  geom_density(alpha = 0.6, colour = NA, bw = 1.5) +
  scale_fill_manual(values = c(`2002` = col_first, `2024` = col_last)) +
  scale_x_continuous(limits = c(0, 50), expand = expansion(mult = c(0, 0.02))) +
  labs(
    title = "No-religion share across 346 Chilean communes, 2002 and 2024",
    subtitle = "Density of commune-level shares; census affiliation, population aged 15 and over (percent)",
    x = "no religion (%)", y = "density of communes",
    caption = "Source: shipped product apps/regions/cl/data/area_summary_commune.json;\nprovenance in the product manifest cl-census-religion-2002-2024.json."
  ) +
  theme_note +
  theme(legend.position = "top", axis.text.y = element_blank(), panel.grid.major.y = element_blank())

ggsave(file.path(out_dir, "chile-communes.svg"), fig3, width = 7, height = 4, device = svglite::svglite)

# print the headline numbers used in the note so the prose can be checked against this run
dumbbell |>
  select(label, first_year, last_year, first_share, last_share, delta) |>
  arrange(desc(delta)) |>
  as.data.frame() |>
  print(digits = 3)
