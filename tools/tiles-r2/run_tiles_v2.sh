#!/usr/bin/env bash
# Run the v2 tile build under tmux-friendly conditions, logging to a file.
#
#   tmux new -d -s tiles-v2 'caffeinate -is tools/tiles-r2/run_tiles_v2.sh'
#
# Environment (defaults suit green):
#   WORK      build directory                     ~/tiles-build-2026-10-07/work
#   SOURCE    places.mbtiles, opened read-only    ~/tiles-archive-2026-07/tiles-migration/places.mbtiles
#   LIVE      live places-overview.pmtiles        ~/tiles-archive-2026-07/tiles-migration/places-overview.pmtiles
#   STAGES    space-separated stages              "extract build validate manifest"
#   EXTRA     extra flags, e.g. --country-fallback
#   MANIFESTS manifest directory                  <this folder>/manifests
#   SCHEMA    data-manifest.schema.json            the repository's, when run from a checkout
#   GIT_COMMIT commit of the committed script, recorded in the manifest
set -uo pipefail
export PATH=/opt/homebrew/bin:$PATH
here="$(cd "$(dirname "$0")" && pwd)"
ARCHIVE="${HOME}/tiles-archive-2026-07/tiles-migration"
WORK="${WORK:-${HOME}/tiles-build-2026-10-07/work}"
SOURCE="${SOURCE:-${ARCHIVE}/places.mbtiles}"
LIVE="${LIVE:-${ARCHIVE}/places-overview.pmtiles}"
STAGES="${STAGES:-extract build validate manifest}"
MANIFESTS="${MANIFESTS:-${here}/manifests}"
mkdir -p "${WORK}"
log="${WORK}/run.log"
commit="${GIT_COMMIT:-$(git -C "${here}" rev-parse HEAD 2>/dev/null || true)}"
for stage in ${STAGES}; do
  echo "$(date -u +%FT%TZ) stage ${stage}" | tee -a "${log}"
  # shellcheck disable=SC2086
  uv run "${here}/build_tiles_v2.py" "${stage}" --work "${WORK}" --source "${SOURCE}" \
    --live-overview "${LIVE}" --manifest-dir "${MANIFESTS}" ${commit:+--git-commit "${commit}"} ${SCHEMA:+--schema "${SCHEMA}"} ${EXTRA:-} \
    2>&1 | tee -a "${log}"
  rc=${PIPESTATUS[0]}
  if [ "${rc}" -ne 0 ]; then
    echo "$(date -u +%FT%TZ) stage ${stage} failed with ${rc}" | tee -a "${log}"
    exit "${rc}"
  fi
done
echo "$(date -u +%FT%TZ) done" | tee -a "${log}"
