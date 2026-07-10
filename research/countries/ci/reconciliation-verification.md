# Côte d'Ivoire RGPH 2021 Table 11 reconciliation verification

## Method

The cached source PDF matched SHA-256 `60fcf96dd0044136c56a4646954809797ae28b82fb76bc3c8cbd1beab688a0da`. I rendered paired Table 11 sheets on PDF pages 7 to 32 at 300 dots per inch with `pdftoppm`. For each target row, I made two full-width crops, one from each sheet half, that placed the page's column-header strip above the row strip. PDF text bounding boxes located the row coordinates only. I inspected all 62 crops with `view_image` and transcribed the displayed resident total and all 16 category values from the rendered pixels. I then summed the image-transcribed category values and compared every printed cell with the current `pdftotext -layout` extraction. Narrow native-pixel zooms resolved three resident-total cells that the full-width display compressed; no higher-resolution render was necessary.

The builder's failing-row record and the 31-row list in the verification brief agree exactly.

## Results

The overrun is the image-transcribed category sum minus the image-transcribed printed resident total.

| Row key | Printed resident total (image) | Category sum (image) | Overrun | Matches extraction cell-for-cell | Verdict |
| --- | ---: | ---: | ---: | :---: | --- |
| NOUAMOU | 17,403 | 17,405 | +2 | Yes | SOURCE ARITHMETIC |
| DJIDJI | 16,114 | 16,115 | +1 | Yes | SOURCE ARITHMETIC |
| YAKPABO-SAKASSOU | 13,020 | 13,021 | +1 | Yes | SOURCE ARITHMETIC |
| CECHI | 25,967 | 25,968 | +1 | Yes | SOURCE ARITHMETIC |
| LOVIGUIE | 19,771 | 19,773 | +2 | Yes | SOURCE ARITHMETIC |
| SEILEU | 23,525 | 23,526 | +1 | Yes | SOURCE ARITHMETIC |
| SANDOUGOU-SOBA | 7,347 | 7,348 | +1 | Yes | SOURCE ARITHMETIC |
| BANNEU | 20,393 | 20,394 | +1 | Yes | SOURCE ARITHMETIC |
| TEAPLEU | 42,814 | 42,815 | +1 | Yes | SOURCE ARITHMETIC |
| DIBOKE | 24,758 | 24,759 | +1 | Yes | SOURCE ARITHMETIC |
| TINHOU | 22,744 | 22,746 | +2 | Yes | SOURCE ARITHMETIC |
| BAKOUBLY | 7,186 | 7,187 | +1 | Yes | SOURCE ARITHMETIC |
| DIEOUZON | 18,316 | 18,318 | +2 | Yes | SOURCE ARITHMETIC |
| ZEO | 12,822 | 12,823 | +1 | Yes | SOURCE ARITHMETIC |
| GUEZON (DE FACOBLY) | 10,208 | 10,209 | +1 | Yes | SOURCE ARITHMETIC |
| ZAGUIETA | 50,525 | 50,526 | +1 | Yes | SOURCE ARITHMETIC |
| KOMBOLOKOURA | 8,930 | 8,931 | +1 | Yes | SOURCE ARITHMETIC |
| LOLOBO (DE BEOUMI) | 11,586 | 11,588 | +2 | Yes | SOURCE ARITHMETIC |
| BOTRO | 36,461 | 36,463 | +2 | Yes | SOURCE ARITHMETIC |
| KROFOINSOU | 13,402 | 13,403 | +1 | Yes | SOURCE ARITHMETIC |
| DJEBONOUA | 40,481 | 40,483 | +2 | Yes | SOURCE ARITHMETIC |
| AYAOU-SRAN | 16,278 | 16,279 | +1 | Yes | SOURCE ARITHMETIC |
| TIMBE | 15,035 | 15,036 | +1 | Yes | SOURCE ARITHMETIC |
| DIARABANA | 25,063 | 25,065 | +2 | Yes | SOURCE ARITHMETIC |
| GOUEKAN | 4,592 | 4,593 | +1 | Yes | SOURCE ARITHMETIC |
| BONDO | 28,482 | 28,484 | +2 | Yes | SOURCE ARITHMETIC |
| SAPLI-SEPINGO | 12,403 | 12,404 | +1 | Yes | SOURCE ARITHMETIC |
| TAGADI | 35,143 | 35,144 | +1 | Yes | SOURCE ARITHMETIC |
| BANDAKAGNI-TOMORA | 11,264 | 11,265 | +1 | Yes | SOURCE ARITHMETIC |
| DIAMBA | 17,045 | 17,047 | +2 | Yes | SOURCE ARITHMETIC |
| BOGOFA | 10,544 | 10,545 | +1 | Yes | SOURCE ARITHMETIC |

## Tally

All 31 verified rows are source-arithmetic discrepancies. No row contains an extraction error, and no cell is illegible. The printed category sums exceed the printed resident totals by 41 people in aggregate. No extracted cell must change.

## Extended verification: department and national rows (2026-07-11)

The conductor's documented-discrepancy ruling (2026-07-10) covers every level of Table 11's printed arithmetic, so the verification was extended from the 31 leaf overruns to the aggregate rows. Two further discrepancy classes were confirmed by the same 300-dot-per-inch image readback method (`pdftoppm` render, then pixel transcription independent of `pdftotext`), and compared cell-for-cell with the current extraction.

The first extended class is the department component-sum discrepancy: the printed department total minus the sum of that department's printed child sub-prefecture resident totals. Forty-eight of 110 departments differ by −3 to +2 persons. Five were image-verified, chosen to span the full range of the discrepancy and to include the department already spot-checked in the probe (ADIAKE). The render page number is the PDF page carrying the department's left-half sheet.

| Department | Page | Printed child resident totals (image) | Child sum | Printed department total (image) | Difference | Matches extraction | Verdict |
| --- | ---: | --- | ---: | ---: | ---: | :---: | --- |
| ADIAKE | 7 | 50 556 + 21 941 + 15 510 | 88 007 | 88 006 | −1 | Yes | SOURCE ARITHMETIC |
| BETTIE | 5 | 33 020 + 36 621 | 69 641 | 69 640 | −1 | Yes | SOURCE ARITHMETIC |
| BONON | 21 | 116 871 + 50 525 | 167 396 | 167 397 | +1 | Yes | SOURCE ARITHMETIC |
| ODIENNE | 7 | 28 373 + 10 151 + 20 285 + 86 279 + 11 644 | 156 732 | 156 730 | −2 | Yes | SOURCE ARITHMETIC |
| SASSANDRA | 5 | 71 998 + 41 965 + 42 746 + 17 437 + 91 140 + 87 945 | 353 231 | 353 228 | −3 | Yes | SOURCE ARITHMETIC |

The second extended class is the national row. The "Ensemble CÔTE D'IVOIRE" row was read from both paired sheet halves (PDF pages 31 and 32). The printed resident total is 29 389 150. The 16 categories read from the image are, in printed order, 3 685 173; 4 984 388; 678 962; 5 434 719; 134 332; 140 482; 32 489; 19 689; 276 522; 12 453 840; 629 938; 49 946; 57 084; 53 051; 645 256; 787. Every cell matched the extraction. The 16 categories sum to 29 276 658, which is 112 492 below the printed resident total (the collective-household residents and people without housing excluded from the religion universe) and 2 below the thematic report's Tome 1 Table 2.2 ordinary-household figure of 29 276 660.

## Extended tally

The five department rows and the national row match the extraction cell-for-cell; no image readback contradicted the extraction. The department component-sum discrepancies (48 departments, signed sum −6, absolute sum 52 persons) and the national row's under-sum are the source's own printed arithmetic, of the same class as the 31 leaf overruns. The leaf resident totals across the 519 sub-prefecture-or-commune leaves sum to 29 389 156, six above the printed national resident total; the leaf religion basis sums to 29 276 520, 138 below the national religion basis. All of these are pinned in `scripts/build_ci_area_summary.R`, which stops on any drift. No extracted cell must change.
