# RA CLI Tutorial

This tutorial explains how a research assistant can use the local `pow` command
to check a small evidence batch before handing it back to the project team.

The command-line tool is a safety check. It does not approve data, upload data,
or change the public map. It checks whether a CSV or revision file follows the
current project templates and, when asked, writes a local staging copy for later
review.

## What You Need

- A local copy of the `places-of-worship` repository.
- A terminal app.
- Rust and Cargo installed. Check with:

```sh
cargo --version
```

If that command is not found, ask the project team before installing anything.

## What Not To Edit

Do not enter research data into the template files in the repository. The
template files under `docs/templates/ra-historical-site-evidence/` are reference
files.

Enter data in the agreed working spreadsheet. When a batch is ready, export the
working tab as a CSV file and validate that exported CSV.

## Open The Project Folder

Open a terminal and move into the repository:

```sh
cd /path/to/places-of-worship
```

If you are using your own copy, update it first:

```sh
git pull --ff-only
```

## Check The Tool Works

Run the built-in help:

```sh
cargo run -p pow-cli -- --help
```

You should see commands named `validate` and `stage`.

## Validate A CSV

Export your working spreadsheet tab as a CSV file. Then run:

```sh
cargo run -p pow-cli -- validate /path/to/your/exported-file.csv
```

If the file path contains spaces, put it in quotes:

```sh
cargo run -p pow-cli -- validate "/path/to/NZ pilot batch.csv"
```

A successful validation looks like this:

```text
pow validate: /path/to/NZ pilot batch.csv
format: csv
records checked: 25
errors: 0
warnings: 0
```

Warnings mean the file can be read, but something may need human review. Errors
mean the file should be fixed before staging.

## Common Validation Problems

- The CSV columns do not match the template exactly.
- A controlled-vocabulary field contains a spelling variant not listed in
  `controlled_vocabularies.csv`.
- A date is not in one of the accepted forms: `YYYY`, `YYYY-MM`, or
  `YYYY-MM-DD`.
- A latitude or longitude is outside the valid range.
- A probability is not between `0` and `1`.
- A required field is blank.

Fix the spreadsheet, export a fresh CSV, and run `validate` again.

## Stage A Valid Batch

Only stage a file after validation has no errors:

```sh
cargo run -p pow-cli -- stage /path/to/your/exported-file.csv
```

By default, staged data are written to:

```text
.pow/staging.sqlite
```

This file stays on your computer and is ignored by Git. Staging is not approval.
It creates a local review copy so the project team can inspect the batch.

## Propose Draft Events

After staging, the project team may ask you to run `pow propose` with the batch
id printed by `pow stage`:

```sh
cargo run -p pow-cli -- propose <staged_batch_id>
```

This prints draft JSONL events for review. It does not approve the batch or
change the public map. If the command prints warnings about raw denomination or
tradition text, that is expected for now; coded denomination mapping is deferred
until the project taxonomy exists.

## Save A JSON Report

For a machine-readable report, use `--report json`:

```sh
cargo run -p pow-cli -- validate /path/to/your/exported-file.csv --report json
```

If the project team asks for a report file, copy the terminal output into a text
file, or ask for help redirecting it safely.

## What To Send Back

For each pilot batch, send the project team:

- the exported CSV that you validated
- the validation output
- notes on confusing fields or sources
- any rows that need a reviewer decision

Do not send private contact details, restricted source files, or raw uploads
unless the project team has explicitly approved that storage path.

## Quick Reference

```sh
cd /path/to/places-of-worship
git pull --ff-only
cargo run -p pow-cli -- --help
cargo run -p pow-cli -- validate /path/to/batch.csv
cargo run -p pow-cli -- stage /path/to/batch.csv
cargo run -p pow-cli -- propose <staged_batch_id>
```
