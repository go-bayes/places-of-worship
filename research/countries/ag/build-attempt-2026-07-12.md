# Antigua and Barbuda parish build attempt — 2026-07-12

Recorded by the conductor after a live interactive capture attempt, following the build lane's BLOCKED-AT-CAPTURE report of the same sitting. Verdict: **HELD on a server-side engine fault** — the CELADE-hosted ATG REDATAM engine's Statistical Process module is not returning output for any request, including its own defaults.

## What the live session established

The build lane proved with stateless tools that the crosstab needs a live portal session (a real `CODIGO`, session cookies, and a session-scoped temp result frame). The conductor then ran the capture in a real browser session and got further than the lane, which localises the fault precisely:

1. The portal loads, the session is live, and the two-way crosstab form (item `CRUZ1`) renders with the full control set (`ROW`, `COLUMN`, `CONTROL`, `WEIGHT`, `FORMAT`, `PERCENT`, `inputTitle`, hidden `MAIN/BASE/LANG/CODIGO/ITEM/MODE/SELECTION`).
2. The target query — `ROW = Q49 Religion`, `COLUMN = Parish`, `WEIGHT = Person weight`, `FORMAT` Table, `PERCENT` Absolute — submits, and the run container renders with the submitted title.
3. The engine then fails to serve its own output: the result area prints **"Not Found — The requested URL was not found on this server."** with the `<#PROGRAM>` template placeholder unsubstituted, and the session temp frame (`/redatg/tempo/…/~tmp_….htm`) 404s. Retried with a space-free title; identical.
4. The decisive control: submitting the form's **untouched defaults** (Age 10 year categories × Q45 Sex) fails the same way, and the run container's `redGRAPH` image is also broken. The fault is therefore server-side in the `binatg` deployment's temp-output writer, not in the query, the title, the session, or the client.

## Unblocks

The first unblock is time: the fault has the shape of a transient deployment problem (the engine accepts jobs but cannot write or serve its temp results), so a later sitting should simply retry the same capture — the form mechanics above are proven and take minutes to re-run.

The second unblock is an ask: the Statistics Division of Antigua and Barbuda publishes a contact address on the portal itself (`info.stats@ab.gov.ag`, portal footer). An email can either report the engine fault or request the religion-by-parish cross-tabulation directly (eight tabulation units, 24-category Q49 frame, person-weighted), which would bypass the engine entirely. This ask sits with the PI beside the others.

Everything else about the build is ready and recorded in the lane's plan: the geoBoundaries ADM1 boundary is cached and pinned, the Saint John city+rural fold follows the Castries precedent, the reconciliation anchors are established (Table 5.10 non-institutional 84,816 vs Table 5.1 total-resident 85,567 — which universe the crosstab reports is determined at capture), and the R build is templated on the Paraguay single-wave REDATAM product.

## Retry (2026-07-12, sixth sitting)

The conductor re-ran the decisive control in a fresh live session: the portal loads, the two-way cross-tab form renders with its full control set, and submitting the untouched defaults (Age 10 year categories × Q45 Sex, Person weight, Table, Absolute) again returns "Not Found — The requested URL was not found on this server." The engine fault stands unchanged. The build stays HELD; the remaining unblocks are a later retry and the Statistics Division ask (info.stats@ab.gov.ag) already on the project lead's list.
