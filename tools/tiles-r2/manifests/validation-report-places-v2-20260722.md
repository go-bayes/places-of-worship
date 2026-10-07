# Validation report, places-v2-20260722.pmtiles

Status: **passed**. Generated 2026-10-07T01:01:13.758271+00:00. Aggregates only: no attribute values appear here.

## Warnings

- z6: 9 of 930 tiles that hold input points have no dot in their proper area (the briefed drop-fraction flags thin sparse tiles to nothing; the tile exists with a neighbour's buffer copy)

## Header

- zooms 6-18, tile type TileType.MVT, compression Compression.GZIP
- addressed tiles 8177784, distinct tile contents 8177099
- metadata layers: places; tiles per zoom: z6 950, z7 2688, z8 7631, z9 21061, z10 54232, z11 128983, z12 284007, z13 550307, z14 866044, z15 1184584, z16 1487106, z17 1719766, z18 1870425

## z8-18 against the source

8174146 archive tiles, 8174146 source tiles, 0 mismatched or missing (sha256 and length of every stored tile, compared per (z, x, y) in both directions; the archive is read through the pmtiles reader and the source through its tiles view, read-only).

| zoom | source tiles | archive tiles | source-only | archive-only |
|---|---|---|---|---|
| 8 | 7631 | 7631 | 0 | 0 |
| 9 | 21061 | 21061 | 0 | 0 |
| 10 | 54232 | 54232 | 0 | 0 |
| 11 | 128983 | 128983 | 0 | 0 |
| 12 | 284007 | 284007 | 0 | 0 |
| 13 | 550307 | 550307 | 0 | 0 |
| 14 | 866044 | 866044 | 0 | 0 |
| 15 | 1184584 | 1184584 | 0 | 0 |
| 16 | 1487106 | 1487106 | 0 | 0 |
| 17 | 1719766 | 1719766 | 0 | 0 |
| 18 | 1870425 | 1870425 | 0 | 0 |

## z6-7 tile sizes (stored bytes)

| zoom | tiles | max | p95 | mean | total | live max | live p95 |
|---|---|---|---|---|---|---|---|
| 6 | 950 | 408300 | 57091 | 10896 | 10350759 | 2743067 | 295940 |
| 7 | 2688 | 473929 | 63032 | 11729 | 31527231 | 895099 | 110746 |

Attributes in z6-7 tiles: country_code, denomination, name, osm_id, osm_type, religion. Layers: places.

## z6-7 religion shares (tile-proper points, religions above 0.5% of the input)

z6: 553717 of 2072349 features kept (26.72%); maximum absolute difference 0.048 pp; osm keys over the input multiplicity: 0.

| religion | input % | kept % | diff pp |
|---|---|---|---|
| christian | 61.737 | 61.745 | 0.008 |
| muslim | 14.548 | 14.533 | -0.015 |
| unknown | 10.378 | 10.382 | 0.004 |
| buddhist | 6.88 | 6.84 | -0.039 |
| hindu | 2.561 | 2.608 | 0.048 |
| shinto | 2.441 | 2.443 | 0.001 |
| jewish | 0.55 | 0.545 | -0.005 |

z7: 1774573 of 2072349 features kept (85.63%); maximum absolute difference 0.004 pp; osm keys over the input multiplicity: 0.

| religion | input % | kept % | diff pp |
|---|---|---|---|
| christian | 61.737 | 61.733 | -0.004 |
| muslim | 14.548 | 14.547 | -0.001 |
| unknown | 10.378 | 10.377 | -0.001 |
| buddhist | 6.88 | 6.879 | -0.001 |
| hindu | 2.561 | 2.56 | -0.0 |
| shinto | 2.441 | 2.441 | -0.0 |
| jewish | 0.55 | 0.55 | -0.0 |

## z6-7 tile coverage

- z6: 950 archive tiles of 950 source tiles; 0 source tiles have no archive tile; 0 archive tiles are not in the source (0 of them with points in the proper area; the others hold only a neighbour's buffer copy). 930 tiles hold input points clear of their edges; 9 of them have no dot in the archive.
- z7: 2688 archive tiles of 2688 source tiles; 1 source tiles have no archive tile; 1 archive tiles are not in the source (0 of them with points in the proper area; the others hold only a neighbour's buffer copy). 2646 tiles hold input points clear of their edges; 0 of them have no dot in the archive.

## Measurement

| zoom | live max | live p95 | live total | new max | new p95 | new total |
|---|---|---|---|---|---|---|
| 6 | 2743067 | 295940 | 54179091 | 408300 | 57091 | 10350759 |
| 7 | 895099 | 110746 | 56319270 | 473929 | 63032 | 31527231 |

Curl sample of live tiles: 60 of 60 returned 200; served bytes were 0.9648 to 1.0011 of the stored bytes (the edge recompresses). Largest served tile: z6 2719622 bytes, z7 885205 bytes.

### Country pages that open at z6-7

| country | zoom | viewport tiles | live bytes | new bytes | live max tile | new max tile |
|---|---|---|---|---|---|---|
| AL | 7.3 | 8 | 803858 | 443522 | 179812 | 99014 |
| AT | 6.4 | 9 | 12823806 | 2079882 | 2743067 | 408300 |
| BA | 7.0 | 12 | 2036872 | 1129339 | 537003 | 302904 |
| BD | 6.3 | 12 | 1105733 | 284421 | 222689 | 57183 |
| BG | 6.6 | 9 | 2586539 | 506254 | 583597 | 101526 |
| BS | 6.2 | 12 | 900490 | 184117 | 423168 | 77733 |
| BT | 6.7 | 4 | 506894 | 134234 | 222689 | 57183 |
| CH | 6.7 | 6 | 7619190 | 1282469 | 2503361 | 408300 |
| CV | 6.7 | 6 | 17744 | 6056 | 12489 | 3967 |
| CZ | 7.0 | 9 | 3715047 | 1786585 | 618315 | 298868 |
| DK | 6.3 | 8 | 1758524 | 282592 | 505195 | 77762 |
| EE | 6.9 | 6 | 230193 | 54268 | 83283 | 15253 |
| GE | 7.0 | 9 | 166367 | 141465 | 56100 | 48057 |
| GH | 6.4 | 9 | 459252 | 108893 | 147879 | 34825 |
| GN | 6.0 | 12 | 353148 | 85978 | 132633 | 28188 |
| GW | 7.0 | 12 | 68971 | 56869 | 17596 | 14213 |
| GY | 6.0 | 9 | 61084 | 19802 | 16366 | 5209 |
| HR | 6.4 | 6 | 6938918 | 1184665 | 2503361 | 408300 |
| HU | 6.5 | 9 | 7738774 | 1322221 | 1947041 | 328823 |
| IE | 6.0 | 9 | 2042514 | 340138 | 922352 | 145188 |
| IL | 7.2 | 6 | 97484 | 85228 | 56485 | 49291 |
| JM | 7.2 | 9 | 29121 | 24871 | 10846 | 9351 |
| KE | 6.0 | 8 | 378815 | 84179 | 114360 | 24817 |
| KH | 6.4 | 6 | 862066 | 178193 | 275409 | 57324 |
| KR | 6.5 | 6 | 1150371 | 215179 | 597641 | 109900 |
| LK | 7.0 | 12 | 991313 | 569884 | 810605 | 435127 |
| LT | 6.8 | 6 | 697924 | 132394 | 486392 | 76180 |
| MD | 7.0 | 8 | 542766 | 310798 | 189184 | 99293 |
| ME | 7.3 | 8 | 515923 | 311594 | 147745 | 75425 |
| MW | 6.3 | 12 | 89466 | 28177 | 29628 | 9200 |
| NL | 6.4 | 8 | 8316386 | 1270847 | 2743067 | 392572 |
| NP | 6.3 | 8 | 890878 | 217743 | 222689 | 57183 |
| PS | 7.8 | 6 | 97484 | 85228 | 56485 | 49291 |
| PT | 6.0 | 9 | 1748587 | 325373 | 568410 | 95230 |
| RO | 6.0 | 9 | 3607765 | 656111 | 1633187 | 263776 |
| RS | 6.4 | 6 | 4275911 | 753847 | 1947041 | 328823 |
| RW | 7.5 | 6 | 74499 | 53930 | 39223 | 26364 |
| SK | 7.0 | 8 | 2590790 | 1334041 | 568027 | 285716 |
| TV | 6.4 | 9 | 4279 | 1335 | 2535 | 694 |
| TW | 6.4 | 9 | 299938 | 86919 | 164882 | 49925 |
| VU | 6.0 | 8 | 13806 | 4250 | 6049 | 1557 |
| WS | 7.0 | 8 | 11230 | 9207 | 5679 | 5078 |

Totals: live 79220720 bytes, new 18173098 bytes. Pages with a tile over 500,000 bytes: 16 live, 0 new. tiles of the page's initial zoom (floor, at least 6) under a 1440 x 900 css-pixel viewport centred on the configured centre, 512-pixel vector tiles; stored (gzip) bytes of the live places.mbtiles against the new archive.
