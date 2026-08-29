#!/usr/bin/env bash
# validate every collection product (and the schema fixture) against
# schemas/collection.v1.schema.json; exit non-zero on any failure. sibling of
# validate_area_summaries.sh, same conventions: declared-version gating, run
# from the repo root. collection products live at
# apps/regions/<cc>/data/collections/*.json and declare
# schema_version "collection.v1".
# run: bash scripts/validate_collections.sh
set -uo pipefail
cd "$(dirname "$0")/.."

gate_total=0
gate_fails=0

validate_one() {
  local f="$1"
  local ver
  ver=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('schema_version') or '')" "$f" 2>/dev/null)
  if [ "$ver" != "collection.v1" ]; then
    echo "GATE FAIL (schema_version '$ver'): $f"
    gate_total=$((gate_total+1)); gate_fails=$((gate_fails+1)); return
  fi
  gate_total=$((gate_total+1))
  local out
  out=$(uvx check-jsonschema --base-uri "file://$PWD/schemas/" --schemafile schemas/collection.v1.schema.json "$f" 2>&1)
  if grep -q "ok --" <<<"$out"; then
    echo "GATE PASS (collection.v1): $f"
  else
    echo "GATE FAIL (collection.v1): $f"
    head -8 <<<"$out"
    gate_fails=$((gate_fails+1))
  fi
}

for f in apps/regions/*/data/collections/*.json schemas/fixtures/collection.v1.example.json; do
  [ -e "$f" ] || continue
  validate_one "$f"
done

echo "gate: $((gate_total-gate_fails))/$gate_total collection products pass"
exit $gate_fails
