#!/usr/bin/env bash
# validate every data manifest against the manifest schema; exit non-zero on any failure.
# run from the repo root: bash scripts/validate_manifests.sh
# review gates run this before any commit that touches docs/manifests/ or a builder.
set -uo pipefail
cd "$(dirname "$0")/.."
fails=0
for f in docs/manifests/*.json; do
  out=$(uvx check-jsonschema --base-uri "file://$PWD/schemas/" --schemafile schemas/data-manifest.schema.json "$f" 2>&1)
  if ! grep -q "ok --" <<<"$out"; then
    echo "FAIL: $f"
    grep '::\$' <<<"$out" | head -5
    fails=$((fails+1))
  fi
done
total=$(ls docs/manifests/*.json | wc -l | tr -d ' ')
echo "manifest validation: $((total-fails))/$total pass"
exit $fails
