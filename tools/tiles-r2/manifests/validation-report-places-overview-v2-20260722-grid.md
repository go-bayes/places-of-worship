# Grid-thinned tiles: validation report

Status: **passed**. Input: 2,072,349 places (slim.ndjson sha256 `aceb33558462ba5eb12543cc392acee6b86751ae3f4d5293adc69b90cf5509be`).

Each zoom keeps one place per screen-pixel cell, religion and denomination; `n` on a dot is the number of input places it stands for.

| archive | zoom | cell px | kept | of input | tiles | max bytes | p95 bytes | total MB |
|---|---|---|---|---|---|---|---|---|
| places-overview-v2-20260722-grid | 0 | 2 | 65,265 | 3.1% | 1 | 347,369 | 347,369 | 0.3 |
| places-overview-v2-20260722-grid | 1 | 2 | 116,143 | 5.6% | 4 | 298,432 | 220,099 | 0.6 |
| places-overview-v2-20260722-grid | 2 | 2 | 206,647 | 10.0% | 12 | 392,292 | 241,193 | 1.0 |
| places-overview-v2-20260722-grid | 3 | 2 | 359,835 | 17.4% | 37 | 455,753 | 132,601 | 1.8 |
| places-overview-v2-20260722-grid | 4 | 2 | 603,131 | 29.1% | 118 | 604,066 | 87,983 | 2.8 |
| places-overview-v2-20260722-grid | 5 | 2 | 916,974 | 44.2% | 327 | 277,401 | 55,696 | 4.1 |
| places-v2-20260722-grid | 6 | 2 | 1,212,056 | 58.5% | 950 | 204,302 | 29,011 | 5.5 |
| places-v2-20260722-grid | 7 | 1 | 1,653,926 | 79.8% | 2,691 | 385,726 | 59,102 | 30.0 |

`places-v2-20260722-grid` z8-18: copied from places.mbtiles and compared by digest in both directions.

| zoom | source tiles | archive tiles | mismatched | missing |
|---|---|---|---|---|
| 8 | 7,631 | 7,631 | 0 | 0 |
| 9 | 21,061 | 21,061 | 0 | 0 |
| 10 | 54,232 | 54,232 | 0 | 0 |
| 11 | 128,983 | 128,983 | 0 | 0 |
| 12 | 284,007 | 284,007 | 0 | 0 |
| 13 | 550,307 | 550,307 | 0 | 0 |
| 14 | 866,044 | 866,044 | 0 | 0 |
| 15 | 1,184,584 | 1,184,584 | 0 | 0 |
| 16 | 1,487,106 | 1,487,106 | 0 | 0 |
| 17 | 1,719,766 | 1,719,766 | 0 | 0 |
| 18 | 1,870,425 | 1,870,425 | 0 | 0 |
