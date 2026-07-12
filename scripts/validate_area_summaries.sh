#!/usr/bin/env bash
# validate every area-summary product against the schema version it declares;
# exit non-zero on any gated failure. twin of scripts/validate_manifests.sh,
# declared-version-resolving: each product declares schema_version and the
# validator resolves that to the matching schema. area-summary.v2 products are
# gated against schemas/area-summary.v2.schema.json. legacy generations
# (0.1.0, 0.2.0, area-summary.v1) have no authored version schema yet; they are
# reported as advisory against the base schemas/area-summary.schema.json and do
# not affect the exit code, upgrading to v2 opportunistically when their
# builders are next touched.
# run from the repo root: bash scripts/validate_area_summaries.sh
# review gates run this before any commit touching an area_summary product or an
# area-summary builder.
set -uo pipefail
cd "$(dirname "$0")/.."

gate_total=0
gate_fails=0
adv_total=0
adv_pass=0
adv_fail=0

# resolve a declared schema_version to its authored schema file; empty means no
# version schema is authored yet (legacy, advisory-only).
resolve_schema() {
  case "$1" in
    area-summary.v2) echo "schemas/area-summary.v2.schema.json" ;;
    *) echo "" ;;
  esac
}

for f in apps/regions/*/data/area_summary_*.json; do
  ver=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('schema_version') or '')" "$f" 2>/dev/null)
  if [ -z "$ver" ]; then
    echo "GATE FAIL (no schema_version): $f"
    gate_total=$((gate_total+1)); gate_fails=$((gate_fails+1)); continue
  fi
  schema=$(resolve_schema "$ver")
  if [ -n "$schema" ]; then
    gate_total=$((gate_total+1))
    out=$(uvx check-jsonschema --base-uri "file://$PWD/schemas/" --schemafile "$schema" "$f" 2>&1)
    if grep -q "ok --" <<<"$out"; then
      echo "GATE PASS ($ver): $f"
    else
      echo "GATE FAIL ($ver): $f"
      grep '::\$' <<<"$out" | head -8
      gate_fails=$((gate_fails+1))
    fi
  else
    adv_total=$((adv_total+1))
    out=$(uvx check-jsonschema --base-uri "file://$PWD/schemas/" --schemafile schemas/area-summary.schema.json "$f" 2>&1)
    if grep -q "ok --" <<<"$out"; then
      echo "legacy-advisory PASS ($ver): $f"
      adv_pass=$((adv_pass+1))
    else
      echo "legacy-advisory FAIL ($ver): $f"
      adv_fail=$((adv_fail+1))
    fi
  fi
done

echo "gate: $((gate_total-gate_fails))/$gate_total area-summary.v2 products pass"
echo "legacy-advisory (non-gating): $adv_pass/$adv_total pass against base schema, $adv_fail fail"
exit $gate_fails
