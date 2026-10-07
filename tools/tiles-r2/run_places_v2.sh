#!/usr/bin/env bash
# Run the places-v2 build under tmux-friendly conditions, logging to a file.
#
#   tmux new -d -s places-v2 'caffeinate -is tools/tiles-r2/run_places_v2.sh'
#
# Environment (defaults suit green):
#   WORK      build directory                      ~/tiles-build-2026-10-07/places-v2
#   SOURCE    places.mbtiles, opened read-only     ~/tiles-archive-2026-07/tiles-migration/places.mbtiles
#   EXTRACT   work directory of the v2 extract     ~/tiles-build-2026-10-07/v3/work (holds slim.ndjson, input-stats.json, extract-report.json)
#   STAGES    space-separated stages               "build validate measure manifest"
#   PAGES     JSON list of the pages at z6-7       <this folder>/manifests/landing-pages-z6-7.json
#   MANIFESTS manifest directory                   <WORK>/manifests
#   SCHEMA    data-manifest.schema.json            the repository's, when run from a checkout
#   GIT_COMMIT commit of the committed script, recorded in the manifest
#   EXTRA     extra flags
set -uo pipefail
export PATH=/opt/homebrew/bin:$PATH
here="$(cd "$(dirname "$0")" && pwd)"
ARCHIVE="${HOME}/tiles-archive-2026-07/tiles-migration"
WORK="${WORK:-${HOME}/tiles-build-2026-10-07/places-v2}"
SOURCE="${SOURCE:-${ARCHIVE}/places.mbtiles}"
EXTRACT="${EXTRACT:-${HOME}/tiles-build-2026-10-07/v3/work}"
STAGES="${STAGES:-build validate measure manifest}"
PAGES="${PAGES:-${here}/manifests/landing-pages-z6-7.json}"
MANIFESTS="${MANIFESTS:-${WORK}/manifests}"
mkdir -p "${WORK}"
log="${WORK}/run.log"
commit="${GIT_COMMIT:-$(git -C "${here}" rev-parse HEAD 2>/dev/null || true)}"
for stage in ${STAGES}; do
  echo "$(date -u +%FT%TZ) stage ${stage}" | tee -a "${log}"
  # shellcheck disable=SC2086
  uv run "${here}/build_places_v2.py" "${stage}" --work "${WORK}" --source "${SOURCE}" --slim "${EXTRACT}/slim.ndjson" \
    --extract-work "${EXTRACT}" --pages "${PAGES}" --manifest-dir "${MANIFESTS}" ${commit:+--git-commit "${commit}"} ${SCHEMA:+--schema "${SCHEMA}"} ${EXTRA:-} \
    2>&1 | tee -a "${log}"
  rc=${PIPESTATUS[0]}
  if [ "${rc}" -ne 0 ]; then
    echo "$(date -u +%FT%TZ) stage ${stage} failed with ${rc}" | tee -a "${log}"
    exit "${rc}"
  fi
done
echo "$(date -u +%FT%TZ) done" | tee -a "${log}"
