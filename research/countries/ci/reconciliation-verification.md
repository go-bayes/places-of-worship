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
