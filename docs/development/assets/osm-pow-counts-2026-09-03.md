# OSM places of worship by country, counts at two anchors (run 2026-09-03)

Method note for `osm-pow-counts-2026-09-03.csv`, produced by `scripts/osm_pow_country_counts.py` (step 1 of `docs/development/osm-annual-audit-scoping-2026-09-03.md` §6).

- Source: ohsome API `elements/count/groupBy/boundary`, filter `amenity=place_of_worship and (type:node or type:way)`; relations excluded, matching the NZ pilot's default. Times: `2025-09-01` and `2026-07-27T09:00:00Z`, the latest timestamp ohsome held on 2026-09-03 (its data runs about five to six weeks behind live OSM).
- Boundaries: Natural Earth 1:110m admin-0 polygons (177 units incl. Antarctica and disputed areas), one country per request. Multi-country batches failed with HTTP 500; single-country requests took 30–120 s each; the whole run took 39 minutes plus two retries. The USA and Sudan polygons also returned 500 and were counted with bounding boxes instead (USA: lower 48, Alaska, Hawaii; Sudan: one box), which over-count by whatever falls inside the boxes across a land border; the `method` column marks them.
- The 1:110m polygons clip coastal and island places (Vanuatu shows 29 against 214 in the project's own Overpass archive, which is the clearest case), so the sum runs below taginfo's global figure for nodes and ways (1,608,654 at 2026-09-02). Use the table for scale and ranking; the audit itself will use exact boundaries.

| | 2025-09-01 | 2026-07-27 |
|---|---|---|
| Total, 177 units | 1,485,702 | 1,544,023 |

Top 15 at the latest timestamp:

| ISO | Country | 2025-09-01 | 2026-07-27 |
|---|---|---|---|
| US | United States of America | 278,396 | 283,375 |
| ID | Indonesia | 68,392 | 73,068 |
| JP | Japan | 70,317 | 72,998 |
| DE | Germany | 70,329 | 70,914 |
| IT | Italy | 63,095 | 65,570 |
| IN | India | 60,462 | 64,536 |
| FR | France | 57,820 | 58,477 |
| BR | Brazil | 48,009 | 50,940 |
| TR | Turkey | 42,233 | 44,369 |
| GB | United Kingdom | 39,401 | 40,002 |
| ES | Spain | 35,090 | 36,594 |
| MM | Myanmar | 27,604 | 28,873 |
| RU | Russia | 28,291 | 28,551 |
| TH | Thailand | 23,724 | 25,195 |
| CN | China | 20,643 | 23,236 |

Zero rows: Antarctica only. Growth over the eleven months is mapping activity, not building: China +12.6 percent, Indonesia +6.8 percent, India +6.7 percent.
