# Saint Lucia 2022 Table D.2 reconciliation verification

## Method

The cached source PDF matched SHA-256 `030cba4bf5a5002e08d5bfbc67fe1c4d3d7b3728b4119c6c8911ab1c8b93dcf7`. I rendered Table D.2 on PDF page 74 at 300 dots per inch with `pdftoppm`. I made 11 column crops that contain each geography header, printed total, and all 23 category cells. I also made 15 full-width row crops for the category rows that failed district-to-national reconciliation. PDF text bounding boxes located crop coordinates only. I inspected all 26 target crops with `view_image` and transcribed every displayed digit from the rendered pixels. A printed dash is preserved as `-` in the readback and contributes zero to the arithmetic. I then recomputed every column and row sum and compared the pixel transcriptions with the current `pdftotext -layout` extraction.

The category order in each column readback is: Anglican; Baptist; Bahai Faith; Brethren; Buddhism; Mennonite; Hindu; Jehovah Witnesses; Methodist; Mormon; Islam; Pentecostal; Nazarene; Rastafarian; Roman Catholic; Salvation Army; Seventh Day Adventist; Universal Church; Hinduism; Atheist - Do not believe in God; None - No religion but believe in God; Other; Not reported.

## Geography-column results

The difference is the image-transcribed category sum minus the image-transcribed printed total.

| Geography | Printed total (image) | Category cells in stated order (image) | Category sum (image) | Difference | Matches extraction cell-for-cell | Verdict |
| --- | ---: | --- | ---: | ---: | :---: | --- |
| Saint Lucia | 171,834 | `2,191; 2,987; 29; 122; 47; 3,760; 253; 1,353; 664; 52; 292; 15,515; 310; 2,463; 86,967; 202; 18,601; 277; 66; 514; 24,252; 3,854; 7,064` | 171,835 | +1 | Yes | SOURCE ARITHMETIC |
| Castries | 60,614 | `769; 1,140; 17; 60; 9; 562; 83; 617; 499; 28; 112; 5,432; 70; 836; 27,131; 79; 7,390; 114; 9; 163; 9,846; 1,462; 4,184` | 60,612 | -2 | Yes | SOURCE ARITHMETIC |
| Anse La Raye | 5,841 | `17; 170; -; 1; -; 3; -; 14; -; -; 8; 646; 2; 116; 2,576; 7; 1,084; 20; 2; 34; 937; 103; 100` | 5,840 | -1 | Yes | SOURCE ARITHMETIC |
| Canaries | 2,171 | `3; 1; -; -; -; 15; 1; 10; 3; -; -; 15; -; 51; 1,436; 3; 354; -; -; 4; 242; 25; 9` | 2,172 | +1 | Yes | SOURCE ARITHMETIC |
| Soufriere | 8,322 | `13; 74; -; 4; 1; 197; 1; 43; 2; -; 6; 434; 2; 210; 5,832; 10; 439; 4; 1; 23; 811; 100; 114` | 8,321 | -1 | Yes | SOURCE ARITHMETIC |
| Choiseul | 7,122 | `264; 17; -; -; -; 175; -; 25; 1; -; 1; 416; 4; 127; 5,104; 9; 411; 9; 1; 9; 340; 135; 71` | 7,119 | -3 | Yes | SOURCE ARITHMETIC |
| Laborie | 8,507 | `237; 83; 2; 2; -; 431; -; 50; 3; -; 6; 633; 3; 95; 5,388; 9; 508; 5; -; 17; 686; 212; 140` | 8,510 | +3 | Yes | SOURCE ARITHMETIC |
| Vieux Fort | 19,669 | `227; 367; 6; 13; 5; 1,245; 57; 104; 17; 8; 73; 1,837; 5; 260; 10,708; 15; 1,374; 27; 8; 36; 1,942; 466; 867` | 19,667 | -2 | Yes | SOURCE ARITHMETIC |
| Micoud | 16,693 | `42; 285; -; 23; 1; 499; -; 74; 6; 1; 12; 1,761; 3; 217; 8,330; 16; 2,491; 6; -; 23; 2,557; 210; 136` | 16,693 | 0 | Yes | RECONCILES |
| Dennery | 12,943 | `50; 47; -; -; 1; 454; 1; 105; 2; -; 4; 1,181; -; 259; 6,751; 15; 1,523; 51; -; 35; 2,081; 285; 99` | 12,944 | +1 | Yes | SOURCE ARITHMETIC |
| Gros Islet | 29,953 | `571; 801; 4; 20; 28; 177; 110; 310; 130; 15; 70; 3,159; 220; 292; 13,711; 39; 3,028; 42; 44; 170; 4,811; 854; 1,345` | 29,951 | -2 | Yes | SOURCE ARITHMETIC |

## Category-row results

The district-cell order in each row readback is: Castries; Anse La Raye; Canaries; Soufriere; Choiseul; Laborie; Vieux Fort; Micoud; Dennery; Gros Islet. The difference is the image-transcribed district sum minus the image-transcribed Saint Lucia cell.

| Category | Saint Lucia cell (image) | District cells in stated order (image) | District sum (image) | Difference | Matches extraction cell-for-cell | Verdict |
| --- | ---: | --- | ---: | ---: | :---: | --- |
| Anglican | 2,191 | `769; 17; 3; 13; 264; 237; 227; 42; 50; 571` | 2,193 | +2 | Yes | SOURCE ARITHMETIC |
| Baptist | 2,987 | `1,140; 170; 1; 74; 17; 83; 367; 285; 47; 801` | 2,985 | -2 | Yes | SOURCE ARITHMETIC |
| Brethren | 122 | `60; 1; -; 4; -; 2; 13; 23; -; 20` | 123 | +1 | Yes | SOURCE ARITHMETIC |
| Buddhism | 47 | `9; -; -; 1; -; -; 5; 1; 1; 28` | 45 | -2 | Yes | SOURCE ARITHMETIC |
| Mennonite | 3,760 | `562; 3; 15; 197; 175; 431; 1,245; 499; 454; 177` | 3,758 | -2 | Yes | SOURCE ARITHMETIC |
| Jehovah Witnesses | 1,353 | `617; 14; 10; 43; 25; 50; 104; 74; 105; 310` | 1,352 | -1 | Yes | SOURCE ARITHMETIC |
| Methodist | 664 | `499; -; 3; 2; 1; 3; 17; 6; 2; 130` | 663 | -1 | Yes | SOURCE ARITHMETIC |
| Pentecostal | 15,515 | `5,432; 646; 15; 434; 416; 633; 1,837; 1,761; 1,181; 3,159` | 15,514 | -1 | Yes | SOURCE ARITHMETIC |
| Nazarene | 310 | `70; 2; -; 2; 4; 3; 5; 3; -; 220` | 309 | -1 | Yes | SOURCE ARITHMETIC |
| Seventh Day Adventist | 18,601 | `7,390; 1,084; 354; 439; 411; 508; 1,374; 2,491; 1,523; 3,028` | 18,602 | +1 | Yes | SOURCE ARITHMETIC |
| Universal Church | 277 | `114; 20; -; 4; 9; 5; 27; 6; 51; 42` | 278 | +1 | Yes | SOURCE ARITHMETIC |
| Hinduism | 66 | `9; 2; -; 1; 1; -; 8; -; -; 44` | 65 | -1 | Yes | SOURCE ARITHMETIC |
| None - No religion but believe in God | 24,252 | `9,846; 937; 242; 811; 340; 686; 1,942; 2,557; 2,081; 4,811` | 24,253 | +1 | Yes | SOURCE ARITHMETIC |
| Other | 3,854 | `1,462; 103; 25; 100; 135; 212; 466; 210; 285; 854` | 3,852 | -2 | Yes | SOURCE ARITHMETIC |
| Not reported | 7,064 | `4,184; 100; 9; 114; 71; 140; 867; 136; 99; 1,345` | 7,065 | +1 | Yes | SOURCE ARITHMETIC |

## Tally

All ten failing geography columns and all 15 failing category rows are source-arithmetic discrepancies. No cell contains an extraction error, and no cell is illegible. Micoud reconciles exactly. No extracted cell must change.

## REDATAM code-to-name capture

The REDATAM portal was reachable on 2026-07-10. The cached 2010 person cross-tabulation selection form, `data/raw/lc_census/redatam_2010_selection_form.html`, is 25,675 bytes with SHA-256 `d430afdfa50935e355fef5c7715dd28e7d7e2571785ac5d875158e1dccca405f`. Its response bytes assign `DISTRICT.DISTC=1` through `DISTRICT.DISTC=12` to Castries Metro; Castries city; Castries rural; Anse-La-Raye; Canaries; Soufriere; Choiseul; Laborie; Vieux-Fort; Micoud; Dennery; and Gros-Islet. The accompanying `redatam_2010_selection_form.meta.json` records the source URL, retrieval time, response status, byte count, and hash.

The cached 2001 cross-tabulation selection form, `data/raw/lc_census/redatam_2001_selection_form.html`, is 10,598 bytes with SHA-256 `8d97ceaaa40ff6029da1887908798e414bf2140146a0aa85ec13b6881e5fb4e6`. Its response bytes assign `sel\DISTRICT_01.sel` through `sel\DISTRICT_12.sel` to Castries Metropolitan; Castries City (Rest); Castries Rural; Anse-La-Raye; Canaries; Sourfriere; Choiseul; Laborie; Vieux-Fort; Micoud; Dennery; and Gross Islet. The accompanying `redatam_2001_selection_form.meta.json` records the same retrieval fields.
