# Malaysia DOSM district-report URL harvest, 2026-07-13

## Method

The DOSM release hub for the 2020 administrative-district key findings links only a state-level summary download; the ~160 district-report PDFs live as separate publications in the DOSM publication catalogue at <https://www.dosm.gov.my/portal-main/publication>. Each publication row exposes its files through a download modal whose links route through the logging endpoint `/portal-main/publication-estatistik-log?document_id=<d>&chapter_id=<c>`, which 302-redirects to a stable `/uploads/publications/<timestamp>.<ext>` URL. The endpoint needs no session cookie, so curl downloads work directly.

The catalogue paginates at a hard cap of 10 rows per page with an unstable sort: repeated traversals of the 16 result pages for the English series title reached only 84–85 of its 155 items because the server tie-breaks row order differently per request and the OFFSET skips rows. The harvest therefore enumerated by title-prefix queries (`search_keyword` = series title + district-name prefix, deepening any prefix whose result count exceeded 10) until every leaf query returned a single fully visible page. Leaf counts sum to exactly 155, so the enumeration is exhaustive for the English series. A separate query for the Malay series title found one further publication (Tumpat). Every file was downloaded at about one request per second and checksummed with sha256.

## Coverage

DOSM's 2020 reporting frame has 160 administrative districts. The harvest reconciles all 160 exactly:

- **152 districts with a district-report PDF** downloaded to `data/raw/my_census/district_reports/` (151 from the English-titled series plus Tumpat, whose report is titled in Malay only). One catalogue row is titled "Alor Gajah Jasin Melaka Tengah" but carries three separate per-district PDFs; its Alor Gajah chapter was harvested here, and Jasin and Melaka Tengah also have their own catalogue rows with distinct uploads.
- **2 districts (Padang Terap and Yan, both Kedah) whose PDF slot is a server-side mis-upload**: all three chapters of each publication, including the chapter labelled as the Penemuan Utama PDF, redirect to XLSX files, and within each publication the mislabelled chapter's byte size duplicates the MyLocal Stats spreadsheet exactly. The served XLSX files are kept as `padang_terap.xlsx` and `yan.xlsx`. This is the same mis-upload class the Mongolia lane found at the NSO.
- **2 districts (Hulu Terengganu and Pendang) with a catalogue row but no file**: the download column prints "-" and the row exposes no modal links.
- **4 units absent from the district-report series**: Perlis (a single-district state) and the three federal territories, W.P. Kuala Lumpur, W.P. Labuan, and W.P. Putrajaya. Keyword probes in English and Malay return no census district report for any of the four; per the route probe, the state-report series covers these geographies.

Sum: 152 + 2 + 2 + 4 = 160. Files on disk: 152 PDFs and 2 XLSX, 1,149,904,476 bytes in total. PDF sizes run 2.3–20.7 MB with no outliers below 2 MB; the smallest reports belong to newly created districts (Bukit Mabong, Tebedu, Tatau) whose historical columns are `..`.

## Spot verification

Johor Bahru (`johor_bahru.pdf`, upload `20221018092514.pdf`) matches the route probe's validated sample byte-for-byte in size (9,062,000) and URL. Its Table 3 religion rows for 2020 — Islam 883,183; Christianity 75,957; Buddhism 566,112; Hinduism 156,071; Others 15,094; No Religion/Unknown 14,774 — sum to exactly the printed district total of 1,711,191, and the 1991, 2000, and 2010 columns are present as the probe recorded. Bukit Mabong's harvested URL (`20221018130805.pdf`) also matches the probe. The probe's Melaka Tengah URL (`20221011101133.pdf`) is the Melaka Tengah chapter of the three-district Melaka publication (document 257, chapter 905); the standalone Melaka Tengah row harvested here carries a different, larger upload (`20221018140046.pdf`) of the same report.

## Anomalies

1. Padang Terap and Yan: PDF never uploaded; every chapter of both publications serves XLSX (see Coverage). A build for these two districts must either extract from the served XLSX table files or await a DOSM fix.
2. Hulu Terengganu and Pendang: catalogue rows exist with no downloadable file of any format. These two districts currently have no online district report.
3. Tumpat is the only district whose report is titled in Malay ("Penemuan Utama Banci Penduduk dan Perumahan Malaysia 2020 Daerah Pentadbiran Tumpat"); English-keyword sweeps miss it.
4. The Melaka three-district publication and the standalone Jasin and Melaka Tengah rows duplicate the same reports under different uploads (Jasin also at `20221011101123.pdf`, Melaka Tengah also at `20221011101133.pdf`, both in document 257).
5. The catalogue's unstable pagination silently hides ~45% of a multi-page result set on any single traversal; any future DOSM catalogue harvest should enumerate by narrowing queries, never by paging.
6. No login, account, or CAPTCHA was required anywhere on the route.

## Files

The full table below lists every harvested file, sorted by state then district.


| State | District | Local file | URL | sha256 | Bytes |
|---|---|---|---|---|---|
| Johor | Batu Pahat | `batu_pahat.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018092411.pdf> | `dcada63025451f9035ab56054138936c7bfe9bbd42f50bf86d8e30b002c5b49c` | 9,303,841 |
| Johor | Johor Bahru | `johor_bahru.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018092514.pdf> | `3150b9ac332179762225c39fbc864be30ad2067dd8013b9e509298be54d5d1d5` | 9,062,000 |
| Johor | Kluang | `kluang.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018092737.pdf> | `23861034d6610f519ac68165968f182e46d4a85589cd1f766c1c745148d6c181` | 8,871,691 |
| Johor | Kota Tinggi | `kota_tinggi.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018092901.pdf> | `80dcec83417fba7179c8966e991970ff5795e7a222b44de20055ab18facedc21` | 8,866,520 |
| Johor | Kulai | `kulai.pdf` | <https://www.dosm.gov.my/uploads/publications/20221013141500.pdf> | `a840db435e185763f916ca20f279d8b8564bf4153a146784f757d01571fd6dc5` | 9,562,022 |
| Johor | Mersing | `mersing.pdf` | <https://www.dosm.gov.my/uploads/publications/20221013114652.pdf> | `9186bfafb36320b4bd915189a0cc2ed8e6545455117022ccdbdf3a1e7f8aac38` | 10,627,320 |
| Johor | Muar | `muar.pdf` | <https://www.dosm.gov.my/uploads/publications/20221014144726.pdf> | `0e58e6ee32361b1e2b7a2fee0452632660060384fbe68abe44a4d483a5e93c59` | 10,171,225 |
| Johor | Pontian | `pontian.pdf` | <https://www.dosm.gov.my/uploads/publications/20221013121350.pdf> | `b934980fa700aba193ca0a0a43aa62dfe9e7f7342581f7a1a96ffdebb0361b6a` | 10,033,871 |
| Johor | Segamat | `segamat.pdf` | <https://www.dosm.gov.my/uploads/publications/20221014144845.pdf> | `73f91e374d09702f9b1848c8619d11433305ba5a7dbcdbe5f3e1ec8918f99b61` | 9,990,583 |
| Johor | Tangkak | `tangkak.pdf` | <https://www.dosm.gov.my/uploads/publications/20221013141601.pdf> | `4fd7cc0dc01702d87568d59fdbf273fe13ac89bf4a176d87d6d08882cb32ec61` | 9,708,678 |
| Kedah | Baling | `baling.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012100306.pdf> | `06cc4e577b800f1385c23e13ddc7d38488766ad51645e4ebd32cf7fd57851caf` | 2,468,784 |
| Kedah | Bandar Baharu | `bandar_baharu.pdf` | <https://www.dosm.gov.my/uploads/publications/20221014151020.pdf> | `bbd1b7929844f8ebb1a063e585993b660650078b8d4d736c0f1332e2b554128e` | 16,213,917 |
| Kedah | Kota Setar | `kota_setar.pdf` | <https://www.dosm.gov.my/uploads/publications/20221013120038.pdf> | `3be3c08ca11d015956da10656737b4054e4f59aeafce7d3a4ab2db333f3d03aa` | 16,136,080 |
| Kedah | Kuala Muda | `kuala_muda.pdf` | <https://www.dosm.gov.my/uploads/publications/20221013120517.pdf> | `4663e02d3ac680bacf03632af034a894168d95d74178d77f6ec854803e7a1678` | 14,875,315 |
| Kedah | Kubang Pasu | `kubang_pasu.pdf` | <https://www.dosm.gov.my/uploads/publications/20221013120634.pdf> | `ea02be95da7375cedd0a716e239077e20f5f4dc42cd768ec2988b92f65793991` | 12,191,527 |
| Kedah | Kulim | `kulim.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012115930.pdf> | `658b9f2746c0e6841c69d92cc1bc6efb6be81934e4ca64f649e691cd41df2753` | 13,243,181 |
| Kedah | Langkawi | `langkawi.pdf` | <https://www.dosm.gov.my/uploads/publications/20221011131019.pdf> | `a70b64aebd26870f43f38a93ec5b23d561d7b3ac5e553d5d732673222620021a` | 11,854,782 |
| Kedah | Padang Terap (xlsx mis-upload) | `padang_terap.xlsx` | <https://www.dosm.gov.my/uploads/publications/20221011130757.xlsx> | `2603151ea007a5f1a06e12ed5ee6dcfc58f17324ba788ccc3c8702901de7a765` | 1,121,243 |
| Kedah | Pokok Sena | `pokok_sena.pdf` | <https://www.dosm.gov.my/uploads/publications/20221014093223.pdf> | `ee0edd83032e108cc336159da9803985203f0ce0bc91e4b8e8c1fa9ca8033946` | 12,829,435 |
| Kedah | Sik | `sik.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018150057.pdf> | `55712436deb78df1549b97cb30fb183a145f8ec91dda82a05e5bff4aa226a96f` | 12,014,633 |
| Kedah | Yan (xlsx mis-upload) | `yan.xlsx` | <https://www.dosm.gov.my/uploads/publications/20221014093945.xlsx> | `3937b2239b227709ebc23173f1857aba124c10dc9655c6be1b246bd40048a741` | 939,386 |
| Kelantan | Bachok | `bachok.pdf` | <https://www.dosm.gov.my/uploads/publications/20221007112812.pdf> | `4bd492ee445dc75dd785e94368139e47a786404ff103d0c864d3f3d35b1f3ec7` | 15,993,716 |
| Kelantan | Gua Musang | `gua_musang.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012120015.pdf> | `31eb097cb6a2efc3de3c4351236af0d9f39f69fe28c6b17ea58631cbe9bc3e28` | 16,514,398 |
| Kelantan | Jeli | `jeli.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018153815.pdf> | `d9d1579d9c1bdbdfe6eaa662ba4e6294770e6413e8d30755ca325341be854a96` | 15,938,044 |
| Kelantan | Kecil Lojing | `kecil_lojing.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012145334.pdf> | `2b1c8f79c66f75b31b65a9db05de0a10752476fb44d41674256ce4c6b5707ac8` | 15,697,799 |
| Kelantan | Kota Bharu | `kota_bharu.pdf` | <https://www.dosm.gov.my/uploads/publications/20221013111124.pdf> | `f68a995074d79da1d11b41620cefa2e43f4f2913ff2d03ca112272fc72269aee` | 16,305,699 |
| Kelantan | Kuala Krai | `kuala_krai.pdf` | <https://www.dosm.gov.my/uploads/publications/20221013111012.pdf> | `5796cbe4e43c30bfb706247fd5d80eba0b68909d364ef6441541cb03157cd2e4` | 15,134,758 |
| Kelantan | Machang | `machang.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018115035.pdf> | `bcef683b7087c54f256de261f33d94844116872bbcef561f60f7c2bc524b702f` | 15,150,070 |
| Kelantan | Pasir Mas | `pasir_mas.pdf` | <https://www.dosm.gov.my/uploads/publications/20221007105443.pdf> | `3a60e4a8371f9298f24b562268881b0eefec153177f3ea2ff0f97fe86c513157` | 16,715,486 |
| Kelantan | Pasir Puteh | `pasir_puteh.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012144941.pdf> | `fca5442fc5bd73bad7d4a62b12d27bd16163744fd6e40266d4bcc19e40b9c9ae` | 15,344,796 |
| Kelantan | Tanah Merah | `tanah_merah.pdf` | <https://www.dosm.gov.my/uploads/publications/20221011143911.pdf> | `22db8689f83424b62a5d3a550a470b9dafc76a03567360f1e0d9a09fd2c589ee` | 17,499,803 |
| Kelantan | Tumpat | `tumpat.pdf` | <https://www.dosm.gov.my/uploads/publications/20221011144921.pdf> | `b43d874aa8cb39638b115c9266fcf1a553bdba4f9d653efd3c2c7df5a6911ef4` | 17,387,587 |
| Melaka | Alor Gajah | `alor_gajah.pdf` | <https://www.dosm.gov.my/uploads/publications/20221011101113.pdf> | `db18340e1ea9bb1055a41844b58240e6dd905b93a95e56470383ddd92bf5459b` | 15,106,028 |
| Melaka | Jasin | `jasin.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012144900.pdf> | `4c804277eb8243f058cbd4d889ddbaaeedaf2c637781d8f70789bd70204bc8f8` | 10,598,145 |
| Melaka | Melaka Tengah | `melaka_tengah.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018140046.pdf> | `e69419ec26fb390f8e310ad795897aa9f06a7a7068c664a68cc125b360cce9d8` | 6,928,060 |
| Negeri Sembilan | Jelebu | `jelebu.pdf` | <https://www.dosm.gov.my/uploads/publications/20221011101216.pdf> | `531bc7fe3a25cde358337245d1b00b6436d2c239b1b72c8e086275e11fa38e55` | 2,407,948 |
| Negeri Sembilan | Jempol | `jempol.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012111207.pdf> | `e3298d72fa33f0e074c2643c328cfcff6be257596d163dec4f57635a7dff8560` | 2,524,669 |
| Negeri Sembilan | Kuala Pilah | `kuala_pilah.pdf` | <https://www.dosm.gov.my/uploads/publications/20221013110928.pdf> | `c9b787514322535b1c9f5381f432f4bd7221891f06e7096b227ef67c58064e31` | 2,426,109 |
| Negeri Sembilan | Port Dickson | `port_dickson.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018153630.pdf> | `193839e8e7d4b8170521af7e5882395f8fa84ad1c99c8d3e3c981eae13ef15f0` | 2,399,253 |
| Negeri Sembilan | Rembau | `rembau.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012111300.pdf> | `e82ab2fd8481df6d47626aceb408d88196aa835ac4eedc2cbc3f878fbdf1789e` | 2,396,617 |
| Negeri Sembilan | Seremban | `seremban.pdf` | <https://www.dosm.gov.my/uploads/publications/20221011143642.pdf> | `bac63626d41fa29b61c7e85f0b2262706b9a421d2cb5a45cf9cfaea145dc131f` | 2,417,363 |
| Negeri Sembilan | Tampin | `tampin.pdf` | <https://www.dosm.gov.my/uploads/publications/20221007162831.pdf> | `53a53ded7d4dc2da1f2ce93865575dc8e2298367a8ae7ecba8299efada5f2d7b` | 2,538,046 |
| P.Pinang | Barat Daya | `barat_daya.pdf` | <https://www.dosm.gov.my/uploads/publications/20221017163828.pdf> | `7c399f3576efa9f31797a15a9f90a5bf306b7d195f9f2109020f6aaa2ff77699` | 20,701,016 |
| P.Pinang | Seberang Perai Selatan | `seberang_perai_selatan.pdf` | <https://www.dosm.gov.my/uploads/publications/20221011093805.pdf> | `9e7937e149626b729b97b9ec5408285556ab2f442bd011c504484a512f703f78` | 12,735,443 |
| P.Pinang | Seberang Perai Tengah | `seberang_perai_tengah.pdf` | <https://www.dosm.gov.my/uploads/publications/20221011093931.pdf> | `159a6b2ac819e75b217c77fff7f30030794e1d47d54033affae17afa5fed28c9` | 16,318,897 |
| P.Pinang | Seberang Perai Utara | `seberang_perai_utara.pdf` | <https://www.dosm.gov.my/uploads/publications/20221011115526.pdf> | `053201862def628371b5650b60a7e8926af101ca83b6dd9a6782741816b55412` | 12,001,414 |
| P.Pinang | Timur Laut | `timur_laut.pdf` | <https://www.dosm.gov.my/uploads/publications/20221017163633.pdf> | `14220ef10756be71b97368cfd0d5e35d2977ff1b85c8517a05fd8a265062b3b5` | 10,469,944 |
| Pahang | Bentong | `bentong.pdf` | <https://www.dosm.gov.my/uploads/publications/20221011115407.pdf> | `e25cd34c962040d499463ca01a207037cc5834a993f53a491ada684486303f21` | 3,088,597 |
| Pahang | Bera | `bera.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018135937.pdf> | `3f112d4f0aa56f40b3ee713b11fa296b17c83df045bf3aa01319a99b7b87acb6` | 4,307,772 |
| Pahang | Cameron Highlands | `cameron_highlands.pdf` | <https://www.dosm.gov.my/uploads/publications/20221011094033.pdf> | `4a4b3fc30318fd1bfda91ed0cad5f7012ad0bb119d72b0bd2121120af47f1949` | 3,470,668 |
| Pahang | Jerantut | `jerantut.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018152809.pdf> | `00d683fe5d78d7b37e311bdfe1c9d2b206bc26c7bbb1734465e044688801bfa5` | 3,779,786 |
| Pahang | Kuantan | `kuantan.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018135849.pdf> | `9f19947c22e60adc57ff4beaec95943d6ff441d2dc972eb89b9da2b7c8d8a50f` | 3,558,955 |
| Pahang | Lipis | `lipis.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018135707.pdf> | `8ec312b18c2ac1d4118f530c1309e6b088761b64145170fa2e604cecdfa97ef9` | 3,625,585 |
| Pahang | Maran | `maran.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018153525.pdf> | `9aabbe0d974b8b39535790ded420af3e36c1e8756a64d9f074b85cc964efd722` | 4,314,420 |
| Pahang | Pekan | `pekan.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012143901.pdf> | `70f86ae2776f12926d83474b777fa46b8c2999a499f1da3e1bfbe1f21ea43b6f` | 3,540,770 |
| Pahang | Raub | `raub.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018135741.pdf> | `27b683bac8f3a2b23dad1434f4cba615a3c34fea29322d1db12f657c7253fbfa` | 3,556,119 |
| Pahang | Rompin | `rompin.pdf` | <https://www.dosm.gov.my/uploads/publications/20221017163954.pdf> | `318270416aed30f31e2d26989ef2bb00f3c3298b3f253d28287e98cd0400a447` | 4,213,238 |
| Pahang | Temerloh | `temerloh.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012144749.pdf> | `20740640859b989d44206b1a8cd6ee89ff7108df48131f43b8d9997c2a8acf06` | 3,561,321 |
| Perak | Bagan Datuk | `bagan_datuk.pdf` | <https://www.dosm.gov.my/uploads/publications/20221007105334.pdf> | `b02a714682e639519e78c69920fd7092a0f05c48079436d27980f0220a86fb2c` | 3,366,571 |
| Perak | Batang Padang | `batang_padang.pdf` | <https://www.dosm.gov.my/uploads/publications/20221011093712.pdf> | `9d8537c60d61ef957ab4c15ec570c18b2d8105dc319a0187aaa61d3e7759beb5` | 3,421,213 |
| Perak | Hilir Perak | `hilir_perak.pdf` | <https://www.dosm.gov.my/uploads/publications/20221011101013.pdf> | `572410f5b316800105b5c7e13a3e1515dc81b1b1fdf6beaca7fe8747deff9839` | 3,418,167 |
| Perak | Hulu Perak | `hulu_perak.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018135506.pdf> | `801c33450c94543937b80041094939ebf84d05f46ae8b1234c7cd831f0f78162` | 3,401,899 |
| Perak | Kampar | `kampar.pdf` | <https://www.dosm.gov.my/uploads/publications/20221011093617.pdf> | `1488231adf8b5185618a72b2238ae4f9896a124f0ae9cc02498d87e7cb114887` | 3,392,077 |
| Perak | Kerian | `kerian.pdf` | <https://www.dosm.gov.my/uploads/publications/20221017163456.pdf> | `014a5385397d4409db4df70b54fb0a3763e4f22f402ac32f736a1fda545c9e8d` | 3,416,297 |
| Perak | Kinta | `kinta.pdf` | <https://www.dosm.gov.my/uploads/publications/20221011115309.pdf> | `f353807f5a5659c02949b4cf1a1d12be5116a9a6a16ab210387d3850dba10c0c` | 3,642,171 |
| Perak | Kuala Kangsar | `kuala_kangsar.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018153539.pdf> | `21e7dda60e6e93cd967e13a7d4a120a13f4666af07f07c8a986a43b9e65aa26c` | 3,558,806 |
| Perak | Larut dan Matang | `larut_dan_matang.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018152728.pdf> | `43a8437ba987ed39788a332ec653c50a33bf29fe25443b8d743f68baa2b91340` | 2,392,440 |
| Perak | Manjung | `manjung.pdf` | <https://www.dosm.gov.my/uploads/publications/20221011100929.pdf> | `23664a04a5db332a2b28419ec4401db2321a50dc5526147096495308b883d3c4` | 3,431,994 |
| Perak | Muallim | `muallim.pdf` | <https://www.dosm.gov.my/uploads/publications/20221011143545.pdf> | `b372b634cd5378dc36758ddfa08e6b9ee56975f8ee9a464fadfff956d790b239` | 3,496,768 |
| Perak | Perak Tengah | `perak_tengah.pdf` | <https://www.dosm.gov.my/uploads/publications/20221011115213.pdf> | `94f5bcb87cd87c4af1b7124f5883fa419056ab6604ca65e12bdd376e4c427b20` | 3,410,384 |
| Perak | Selama | `selama.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018122844.pdf> | `91eb7dd4b5a689599d72baa801748599fbef25dda19ed43b7d43889f586e8912` | 3,347,798 |
| Sabah | Beaufort | `beaufort.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018095023.pdf> | `25fe35a9631814a1f2d61372eb9512c5e9d2516b8d79e879215d2f615267b8fa` | 8,339,256 |
| Sabah | Beluran | `beluran.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018103159.pdf> | `5641aaa658e06b6b9d40faccbdb13dd816a7e0e76055d693963ff679cef2137f` | 9,486,702 |
| Sabah | Kalabakan | `kalabakan.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018123100.pdf> | `697c1d56ee654991a20a30aef65cd403b79c5f2286aab261b1bbe6dae345de76` | 8,743,601 |
| Sabah | Keningau | `keningau.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012110116.pdf> | `8fbebe8027f2303498c51f8a463abe181ef633147993c18d09d057b29c8b4df7` | 9,045,035 |
| Sabah | Kinabatangan | `kinabatangan.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012150433.pdf> | `86b9d1a77e5688a39a9d0877dc34e7ef2a409c1e08a8c238f51f34fdbd0dec3e` | 9,058,040 |
| Sabah | Kota Belud | `kota_belud.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018143358.pdf> | `6455469fe8bf441e89ed6729bbdb7a191dc3ae90f01dd5d425ea56de52f4edff` | 8,499,772 |
| Sabah | Kota Kinabalu | `kota_kinabalu.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012105633.pdf> | `8ea144edbfa1fc228a8bf3a1071859d870507ee72366c9a471c59703e7e901cf` | 9,183,855 |
| Sabah | Kota Marudu | `kota_marudu.pdf` | <https://www.dosm.gov.my/uploads/publications/20221007162941.pdf> | `c6240ffd19776c659037c006643aa1e6baf5a9e87a628038d85641d579ef9601` | 8,095,863 |
| Sabah | Kuala Penyu | `kuala_penyu.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012110212.pdf> | `b57f8085cdbee8dda5e925d81a7ac987fdc451a3d6e4e64af4334f6a921f0570` | 8,588,718 |
| Sabah | Kudat | `kudat.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012105741.pdf> | `917190dd5b8bb26f2877f93d4692e5f8e8c46de5d4699345f01cb750dc2079bf` | 8,234,497 |
| Sabah | Kunak | `kunak.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012110354.pdf> | `daa0961e04e4c0067471feeb49a2feaaa09f4d0b826097b3c7e06db3abf32d44` | 8,328,682 |
| Sabah | Lahad Datu | `lahad_datu.pdf` | <https://www.dosm.gov.my/uploads/publications/20221013141655.pdf> | `46776fcce65d24f182d2cdd3e56d84a8a3ba042b91c276030ee8b0587f1191a8` | 9,267,401 |
| Sabah | Nabawan | `nabawan.pdf` | <https://www.dosm.gov.my/uploads/publications/20221017094559.pdf> | `1ebb56594e979df82a23a0df7f2de331efbf510ba24bac387dc89d19f0f3cbd6` | 8,303,349 |
| Sabah | Papar | `papar.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018115503.pdf> | `795f9aa6a7c84bf247078258178e980bd4beb8e5fff0c938732f414cd10d5673` | 8,546,572 |
| Sabah | Penampang | `penampang.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018115418.pdf> | `6310e8c77ca3566c36b4effc12ab10b3b3d57027ccd28fda6a27e7daa384119e` | 8,370,211 |
| Sabah | Pitas | `pitas.pdf` | <https://www.dosm.gov.my/uploads/publications/20221017094507.pdf> | `48f12ab822ab4a6f4870ad4d2305a1d608ffdfb182f3a1c86a36ecd5e84e8f1f` | 8,220,158 |
| Sabah | Putatan | `putatan.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012121010.pdf> | `ae8aa8e9f50d653ab6daaf04c70ee3e4a0dc0f5c8eaad9c2f25ca92db8ff6bfb` | 8,210,813 |
| Sabah | Ranau | `ranau.pdf` | <https://www.dosm.gov.my/uploads/publications/20221013141757.pdf> | `40c7a7da76eb56eca3f6428058f4fbcff899cc13e6e5bd9ea815796907ed2db2` | 8,252,903 |
| Sabah | Sandakan | `sandakan.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012105549.pdf> | `3a8a852f437a1897838eb925120dc27bec9f4f546e9612d0b817160ffb3307b3` | 8,971,344 |
| Sabah | Semporna | `semporna.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012105455.pdf> | `c88e1874f07c1bfe82909c22e68b0b8af09ecd95124fcce8cf17c33576f706a9` | 8,956,736 |
| Sabah | Sipitang | `sipitang.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012105839.pdf> | `fc3411955f53936e2c5b04b269ce6222c5a194aa05fa79c95931c0da76cf696e` | 8,268,886 |
| Sabah | Tambunan | `tambunan.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012110254.pdf> | `9a307617c8408cf608c11967731c0f10fdd478f43a503a5f6e7da3c9d252d49e` | 8,380,523 |
| Sabah | Tawau | `tawau.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012105407.pdf> | `737895fc1f6a29a98dba3b531faaa38ac3e392232152f834729f4ef64c017832` | 8,877,595 |
| Sabah | Telupid | `telupid.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018092953.pdf> | `c3907e12fee3684853baa0a228539f4eab03ea51e72ac18c04ab917a186c6a8e` | 8,291,622 |
| Sabah | Tenom | `tenom.pdf` | <https://www.dosm.gov.my/uploads/publications/20221007113127.pdf> | `f305904024e9282e385c10e12b64f519b12e3cc171a6555a59c309f089fe4820` | 8,461,664 |
| Sabah | Tongod | `tongod.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012095901.pdf> | `63e3ae080b6e277abf084e33bd2a7ed7b59bab5877366ab800117243200f8b7e` | 8,654,875 |
| Sabah | Tuaran | `tuaran.pdf` | <https://www.dosm.gov.my/uploads/publications/20221017094431.pdf> | `21207a1f12b467f5d9c5a5fa1c888927ce70eb01cd9171e513d922ae04fc7e3b` | 8,357,075 |
| Sarawak | Asajaya | `asajaya.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012145628.pdf> | `7da9f12d2875f1f9d76ed4b6bc92b34fed28c421f43adf69de8a7b9592547b44` | 2,361,082 |
| Sarawak | Bau | `bau.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012115051.pdf> | `aee436b4e08e50f627b75981e1f5239a04af1106727ec4e23bdeee7a11069043` | 4,288,176 |
| Sarawak | Belaga | `belaga.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018121104.pdf> | `956a703e87c1706162bcfd713f5b749867dbfef77d14a80a8b629eb506a99a50` | 11,160,117 |
| Sarawak | Beluru | `beluru.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018121108.pdf> | `73af6d4d06f8ea55be8835932cc18b1fc1075af5d50d1fa5dbb063d262b282c9` | 4,480,205 |
| Sarawak | Betong | `betong.pdf` | <https://www.dosm.gov.my/uploads/publications/20221013121525.pdf> | `5c8ac8913edd4695123c7781255b3bc03e2c55c450c5cda548843f8062cc45b5` | 2,441,925 |
| Sarawak | Bintulu | `bintulu.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018130355.pdf> | `ffd882519f73f3febec6de3c60e091dcb4e89eb99f40483d21152b99288b963a` | 10,308,095 |
| Sarawak | Bukit Mabong | `bukit_mabong.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018130805.pdf> | `59cd8c10c78b8cf6721740a733a4bfe19b5502481af81813d600bde208e2756b` | 2,336,832 |
| Sarawak | Dalat | `dalat.pdf` | <https://www.dosm.gov.my/uploads/publications/20221014093808.pdf> | `300f626abfb661c2179b5b42d8227e35eb27159c992d7a30983a8000c9d2ef76` | 2,418,861 |
| Sarawak | Daro | `daro.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018153306.pdf> | `3b69eef693b9f8b7405eaf0411f5036c93a25a5477d1690c39d4eb2c6cbc294b` | 15,350,229 |
| Sarawak | Julau | `julau.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018114858.pdf> | `d5e964cc02a5a462396be06a02bd44ec70c2d2aff6b929dd55ed107102165645` | 17,329,916 |
| Sarawak | Kabong | `kabong.pdf` | <https://www.dosm.gov.my/uploads/publications/20221007160158.pdf> | `fdb3f162db003160243dd677eb59581c1576415eddbc8c1a732b7966896a4188` | 2,562,920 |
| Sarawak | Kanowit | `kanowit.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018130507.pdf> | `aa3616cbc075624a9bd8c93460e6060b23420f3a79d184e5630e3e01573fa471` | 2,346,122 |
| Sarawak | Kapit | `kapit.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018114905.pdf> | `d257e701adef104aeaff89771f832f3e457e960ed2a8252168c21b95aaa9e220` | 2,533,406 |
| Sarawak | Kuching | `kuching.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018120028.pdf> | `57761af02ac99ae2a50a3d2df489b383133608ab964cbb7d2ac072b042f3b620` | 2,552,715 |
| Sarawak | Lawas | `lawas.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018114734.pdf> | `63956677a6e4ff2ccf43fb3d8d1b9d5b725763db6ce7f991cda59c29c58eb989` | 2,506,900 |
| Sarawak | Limbang | `limbang.pdf` | <https://www.dosm.gov.my/uploads/publications/20221017095628.pdf> | `6b833ea0c1cf17fffc5a8e106e496e6d6133d9a9c24096028cd9f120c61e653b` | 2,526,779 |
| Sarawak | Lubok Antu | `lubok_antu.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018120139.pdf> | `24699ee2881000ff9842355710af67b05d6daec50139db53abc867e820812c53` | 3,513,346 |
| Sarawak | Lundu | `lundu.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018120108.pdf> | `42d097f7205f44d78cac051a7c748342aef730f9a09660ebc424467eddfe7ede` | 2,540,909 |
| Sarawak | Maradong | `maradong.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012115124.pdf> | `5615b6b1a9345dd63384993cf279aac59432f9f11cae92325ba86ca132ee303f` | 2,562,713 |
| Sarawak | Marudi | `marudi.pdf` | <https://www.dosm.gov.my/uploads/publications/20221007145039.pdf> | `d234ad4e8f18a64c8ca4b3a9fade17ac1ea88c34a174c1b2420bc3ca8c2c1906` | 2,548,256 |
| Sarawak | Matu | `matu.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018120227.pdf> | `71dae35755115c6748970685b30578e50ac80da51252b074658e276e2a4a04d9` | 2,761,130 |
| Sarawak | Miri | `miri.pdf` | <https://www.dosm.gov.my/uploads/publications/20221014093854.pdf> | `b064c1ffb301b9be28bf53cbbe812162a0767379a197b638e0f799fe00e2f3a7` | 2,581,158 |
| Sarawak | Mukah | `mukah.pdf` | <https://www.dosm.gov.my/uploads/publications/20221014151750.pdf> | `35085faa8d24653c8d895f5cedb25a4fb1c8a881ef7b339e72cbb08b2918717a` | 2,576,868 |
| Sarawak | Pakan | `pakan.pdf` | <https://www.dosm.gov.my/uploads/publications/20221007160245.pdf> | `af15a2c52f10178040a3145ed83a943a5793fc9d82e0934f47537410b0d69601` | 2,590,057 |
| Sarawak | Pusa | `pusa.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018113641.pdf> | `283708bee202061054c624dc434507aded57424d24ed42dc3f00210cc2044e49` | 2,764,014 |
| Sarawak | Samarahan | `samarahan.pdf` | <https://www.dosm.gov.my/uploads/publications/20221017095656.pdf> | `31e183ae9ca3ed05c368230e51ff3c3d309fdc9a245b3ab0e34f4d7c9b0a7994` | 2,769,221 |
| Sarawak | Saratok | `saratok.pdf` | <https://www.dosm.gov.my/uploads/publications/20221013121608.pdf> | `5ea940759fad063e6e9fe72db2d5e66e74047cc6f71ac8dab8a32e412759ba07` | 2,704,007 |
| Sarawak | Sarikei | `sarikei.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018153401.pdf> | `f5899a43c64c50de61d184b25f45c2445bf3ebc40f1bbfee08a751d6fd2a0cce` | 2,777,051 |
| Sarawak | Sebauh | `sebauh.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018114657.pdf> | `72231a69c777aea7967bc7263e8e7493f1d4f93879dae9de697c9d869a723ed8` | 2,729,257 |
| Sarawak | Selangau | `selangau.pdf` | <https://www.dosm.gov.my/uploads/publications/20221007100412.pdf> | `b3c2c09f3225e54ad99985c524fac76c72ab39479bb1fbbba614aac20f6dcf1b` | 2,766,985 |
| Sarawak | Serian | `serian.pdf` | <https://www.dosm.gov.my/uploads/publications/20221007144949.pdf> | `80d19f9847c0d30b17a90e2de5b090a5eaa0a1c330f29b36094495e11d1ab4f8` | 2,486,012 |
| Sarawak | Sibu | `sibu.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018101137.pdf> | `cc0dae0376a70423144fb16dce39912968d7aa89ffb4da8e383f3a79c350557e` | 15,676,940 |
| Sarawak | Simunjan | `simunjan.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018130716.pdf> | `a60d003b9ce296b21ecd5a5ce5a2043d29a1e24314aecaffb0bd8a4df60706ee` | 2,430,871 |
| Sarawak | Song | `song.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018130751.pdf> | `6b6ec9fae9fd55798f2d0218a5260001c4dc6ce0a9a6cab71597e88ecfc17677` | 16,638,024 |
| Sarawak | Sri Aman | `sri_aman.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018105451.pdf> | `be51556edfa169783ccb18f76571528683d8f14a3101a65ebeaad1f09fa849b9` | 2,457,258 |
| Sarawak | Subis | `subis.pdf` | <https://www.dosm.gov.my/uploads/publications/20221017095738.pdf> | `e1a19707cec23df26205034044c4ff29d3e8d5c66c27790299fc9d4e9d5e8ae5` | 18,299,258 |
| Sarawak | Tanjung Manis | `tanjung_manis.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018123317.pdf> | `2c2c545a8068d4f0a7ea94b4d3e91b89faae8b72b466f54617df4fdf9f5e1dfe` | 2,346,875 |
| Sarawak | Tatau | `tatau.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018153208.pdf> | `1a01e2e5c6138ca09d7afc193c3e13a0667c031d02b45733095dd1da710c4b99` | 2,345,472 |
| Sarawak | Tebedu | `tebedu.pdf` | <https://www.dosm.gov.my/uploads/publications/20221013121439.pdf> | `9ab073ccab367a185bf535ebd02b603206e8e0f840ffeb9a7afa266741329c86` | 2,344,619 |
| Sarawak | Telang Usan | `telang_usan.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018130446.pdf> | `ffbe61b8d134a13254e49093cffa40738e6a55cb19750f32729143eb83c382e8` | 15,864,274 |
| Selangor | Gombak | `gombak.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018122944.pdf> | `099bc71ae096d3d5679187bd286689e049e35c9b6032b03a58485d3341b82661` | 11,838,267 |
| Selangor | Klang | `klang.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018135550.pdf> | `333b818df59d1575c0b5ad331e06a2b42b3dd6b2771c0753e9c4c53bd9433796` | 2,510,675 |
| Selangor | Kuala Langat | `kuala_langat.pdf` | <https://www.dosm.gov.my/uploads/publications/20221013105315.pdf> | `4561e13e77db69f8622d42dcadad70610a96e49f8cdc15da83b4e450705f0893` | 12,861,633 |
| Selangor | Kuala Selangor | `kuala_selangor.pdf` | <https://www.dosm.gov.my/uploads/publications/20221013115917.pdf> | `3dfa6cccca0de7d30d729b5194c3110f2a6887d242010b3b315b97ceb9d18a93` | 10,146,479 |
| Selangor | Petaling | `petaling.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018135626.pdf> | `63a0826211691f7f1572f095fd2bd726add726fde80a2ea65f07168f2db678e8` | 2,530,068 |
| Selangor | Sabak Bernam | `sabak_bernam.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018121033.pdf> | `aadb7fbf2599b38501b1782a29173909bf9ba585e52aece4eaf239b18864b100` | 10,141,202 |
| Selangor | Sepang | `sepang.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018123210.pdf> | `09765cc7f36001b7fa79556cf6d7315f4da16981fdb5bb503389e9374d80f08f` | 10,477,112 |
| Selangor | Ulu Langat | `ulu_langat.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018093434.pdf> | `012fdb59dec7c8c6a5e23a79ac2b6e4614518bb43b8ee890387989a89067f720` | 10,261,142 |
| Selangor | Ulu Selangor | `ulu_selangor.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012103821.pdf> | `1566be8df81f95f9bfde2cb36585fa3e720e8e12494301e1dab8ff6bfac54bf7` | 10,063,596 |
| Terengganu | Besut | `besut.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018123242.pdf> | `6eb13e0fbd01388be1f9644b4cfda91d3edc84497dc48c96cadb22f7950b8d92` | 2,432,960 |
| Terengganu | Dungun | `dungun.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018093511.pdf> | `a69402723fc69e88fe537f45006f73330654b50a374b371c1b2be4ff5c399d17` | 10,478,006 |
| Terengganu | Kemaman | `kemaman.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012145710.pdf> | `cbdff7d6fb0916a270baffe0e7ed634ec6823fe065a5d415f0aee483e2939884` | 2,434,404 |
| Terengganu | Kuala Nerus | `kuala_nerus.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012102318.pdf> | `f1359d40cc97bafb6ca76b63de1d0762f1ba65570a95c1ce4fc2e26393ad9888` | 13,420,184 |
| Terengganu | Kuala Terengganu | `kuala_terengganu.pdf` | <https://www.dosm.gov.my/uploads/publications/20221018134907.pdf> | `30896a6cadae8958eb710f71bd6a0b5c964277d8d10f6b0d6f0b76bb1351cf12` | 2,424,732 |
| Terengganu | Marang | `marang.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012102433.pdf> | `cc290b43cee6570b2d5fa7535b44a01d871e86a8c1cf78995730e6e57ef981f7` | 2,408,831 |
| Terengganu | Setiu | `setiu.pdf` | <https://www.dosm.gov.my/uploads/publications/20221012101107.pdf> | `056b51c57cda7a7fecacf657dfe4823195e670188addd014e56596d3ba723a33` | 2,449,624 |
