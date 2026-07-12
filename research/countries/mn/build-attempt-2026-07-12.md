# Mongolia build attempt, 2026-07-12: HELD on seven mis-uploaded source volumes

Recorded by the conductor from a gate-verified Opus build lane that stopped honestly rather than ship partial coverage. The probe's route stands; the blocker is server-side corruption in the NSO file library itself.

## What the lane verified

The three probe-hashed files (Ulaanbaatar, Selenge, national volumes) match byte-for-byte, and their religion tables reconcile exactly with the probe's recorded figures (UB Шүтдэг 61.4 → 53.7; UB Будда 86.5 → 89.1; Selenge Будда 88.1 → 85.1). Fifteen of the 22 per-aimag volumes are clean, carry their own Tables 3.5/3.6 with 2010 and 2020 side by side, and are cached in `data/raw/mn_census/` ready for transcription. The geoBoundaries MNG ADM1 layer joins the 22-name frame one-to-one; the full transliteration crosswalk is recorded in the lane report and the cached metadata.

## The blocker: seven units do not serve their own volume

Verified by download and content inspection (duplicate-hash detection), and confirmed authoritative on NSO's side — the file-library metadata itself records the wrong sizes, the detail endpoints 404, and the Wayback Machine holds no captures:

- **Dornogovi** — its URL serves the Ulaanbaatar volume (byte-identical hash).
- **Dornod, Khentii, Orkhon** — all three URLs serve one identical Ulaanbaatar housing thematic study with no religion table.
- **Töv, Dundgovi** — library entries carry no file at all (file_size 0, pathName null).
- **Bayan-Ölgii** — persistently truncates at 6,496,256 of 11,587,633 bytes; the PDF trailer is invalid.

Recovery routes exhausted: fresh file-library queries, per-id endpoints, Wayback, retried fetches, the 2020 summary leaflets (prose only, single wave), the national volume (no aimag cross-tab), and the 2010-round volumes (2010 wave only).

## Conductor ruling

HOLD. A 15/22 product would be missing Bayan-Ölgii and Dornod — the high-Islam Kazakh west — and the coverage hole would bias the map precisely where the religious geography is most distinctive. The unblock is a human-channel ask: NSO Mongolia to fix or supply the seven 2020-round consolidated volumes (Dornogovi, Dornod, Khentii, Orkhon, Töv, Dundgovi corrected uploads; Bayan-Ölgii un-truncated). The ask is recorded on the PI's courtesy list. The moment the volumes serve correctly, the cached fifteen plus the seven fetches feed the build as briefed.
