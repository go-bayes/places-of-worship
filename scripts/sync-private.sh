#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/sync-private.sh <push|pull|dry-run|pull-dry-run>

Synchronise the ignored local .private workspace with the configured private
Google Cloud Storage prefix.

Configuration is read from .private-sync.env unless PRIVATE_SYNC_CONFIG points
elsewhere. Required variable:

  PRIVATE_SYNC_REMOTE_URI=gs://example-private-bucket/private/

Optional variables:

  PRIVATE_SYNC_LOCAL_DIR=.private
  PRIVATE_SYNC_DELETE=0

Actions:

  push          upload local private files to GCS
  pull          download private files from GCS
  dry-run       show what push would change
  pull-dry-run  show what pull would change
USAGE
}

die() {
  printf 'sync-private: %s\n' "$1" >&2
  exit 1
}

load_config() {
  local config_file="${PRIVATE_SYNC_CONFIG:-.private-sync.env}"

  if [[ -f "$config_file" ]]; then
    # The config file is deliberately local and untracked.
    # shellcheck source=/dev/null
    source "$config_file"
  fi
}

require_gcloud() {
  if ! command -v gcloud >/dev/null 2>&1; then
    die "gcloud is not installed or not on PATH"
  fi
}

run_rsync() {
  local source_uri="$1"
  local destination_uri="$2"
  local dry_run="$3"
  local delete_missing="$4"
  local -a args=(storage rsync "$source_uri" "$destination_uri" --recursive)

  if [[ "$dry_run" == "1" ]]; then
    args+=(--dry-run)
  fi

  if [[ "$delete_missing" == "1" ]]; then
    args+=(--delete-unmatched-destination-objects)
  fi

  gcloud "${args[@]}"
}

main() {
  local action="${1:-}"
  local dry_run=0
  local direction="push"

  case "$action" in
    push) ;;
    pull) direction="pull" ;;
    dry-run) dry_run=1 ;;
    pull-dry-run)
      direction="pull"
      dry_run=1
      ;;
    -h|--help|"")
      usage
      exit 0
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac

  load_config
  require_gcloud

  local local_dir="${PRIVATE_SYNC_LOCAL_DIR:-.private}"
  local remote_uri="${PRIVATE_SYNC_REMOTE_URI:-}"
  local delete_missing="${PRIVATE_SYNC_DELETE:-0}"

  [[ -n "$remote_uri" ]] || die "PRIVATE_SYNC_REMOTE_URI is not set"
  [[ "$remote_uri" == gs://* ]] || die "PRIVATE_SYNC_REMOTE_URI must start with gs://"
  [[ "$delete_missing" == "0" || "$delete_missing" == "1" ]] || die "PRIVATE_SYNC_DELETE must be 0 or 1"

  mkdir -p "$local_dir"

  local local_uri="${local_dir%/}"
  local remote_prefix="${remote_uri%/}"

  if [[ "$direction" == "pull" ]]; then
    run_rsync "$remote_prefix" "$local_uri" "$dry_run" "$delete_missing"
  else
    run_rsync "$local_uri" "$remote_prefix" "$dry_run" "$delete_missing"
  fi
}

main "$@"
