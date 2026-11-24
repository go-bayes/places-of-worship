#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["boto3"]
# ///
"""Upload versioned PMTiles archives to R2 and read each one back.

A versioned key is immutable: browsers and the edge hold its tiles for a year. This
script therefore refuses to write a key that already exists. It accepts only names
that match the Worker's versioned pattern and streams archives up to 5 GiB with a
conditional PUT. It verifies the size and SHA-256 of each uploaded object by reading
it back from R2.

  uv run tools/tiles-r2/upload_versioned_r2.py --dir <folder of .pmtiles> [--only <name> ...] [--dry-run]
  uv run tools/tiles-r2/upload_versioned_r2.py --check-credentials

Requires R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in the environment, or
CLOUDFLARE_API_TOKEN as upload_r2.py uses it. Each verified
upload is appended to <dir>/uploads.jsonl; a name already recorded there with the same
digest is read back and skipped only when its size and SHA-256 still match.
"""
import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path

# the worker's pattern for immutable names (worker/src/index.js)
VERSIONED = re.compile(r"^(?:places-overview-v2|places-v2|ra-dots-[a-z]{2})-(?:\d{8}|\d{4}-\d{2}-\d{2})(?:-[a-z0-9]+)?$", re.ASCII)
BUCKET = "pow-tiles"
SINGLE_PUT_LIMIT = 5 * 1024**3


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def client():
    import boto3

    # the account identifier lives in one place; importing upload_r2 would run it
    source = (Path(__file__).parent / "upload_r2.py").read_text(encoding="utf-8")

    def constant(name):
        found = re.search(rf'^{name} = "([0-9a-f]+)"', source, re.M)
        if not found:
            sys.exit(f"{name} not found in upload_r2.py")
        return found.group(1)

    # r2 s3 credentials: either the pair r2 shows when a token is created, or the pair
    # derived from the api token upload_r2.py uses (key = token id, secret = sha256 of its value)
    key, secret = os.environ.get("R2_ACCESS_KEY_ID"), os.environ.get("R2_SECRET_ACCESS_KEY")
    if not (key and secret):
        token = os.environ.get("CLOUDFLARE_API_TOKEN")
        if not token:
            sys.exit("set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY, or CLOUDFLARE_API_TOKEN")
        key, secret = constant("TOKEN_ID"), hashlib.sha256(token.encode()).hexdigest()
    from botocore.config import Config

    # r2 does not accept the trailing checksums newer boto3 adds by default
    quiet = Config(request_checksum_calculation="when_required", response_checksum_validation="when_required")
    return boto3.client(
        "s3",
        endpoint_url=f"https://{constant('ACCOUNT_ID')}.r2.cloudflarestorage.com",
        aws_access_key_id=key,
        aws_secret_access_key=secret,
        region_name="auto",
        config=quiet,
    )


def head(s3, key):
    from botocore.exceptions import ClientError

    try:
        return s3.head_object(Bucket=BUCKET, Key=key)
    except ClientError as error:
        if error.response["Error"]["Code"] in ("404", "NoSuchKey", "NotFound"):
            return None
        raise


def read_back(s3, key):
    digest, size = hashlib.sha256(), 0
    body = s3.get_object(Bucket=BUCKET, Key=key)["Body"]
    try:
        for block in body.iter_chunks(8 * 1024 * 1024):
            digest.update(block)
            size += len(block)
    finally:
        body.close()
    return digest.hexdigest(), size


def upload(s3, path, key):
    with path.open("rb") as handle:
        size = os.fstat(handle.fileno()).st_size
        if size > SINGLE_PUT_LIMIT:
            raise ValueError("archive exceeds the conditional single PUT limit")
        s3.put_object(Bucket=BUCKET, Key=key, Body=handle, ContentLength=size, IfNoneMatch="*")


def check_credentials(s3):
    """Confirm the credentials can read and write the bucket without storing anything.

    Reading is a HEAD on a missing key (403 means refused, 404 means allowed). Writing is
    a multipart upload that is started and aborted at once, which creates no object.
    """
    from botocore.exceptions import ClientError

    probe = f"credential-check-{os.urandom(6).hex()}"
    try:
        if head(s3, probe) is not None:
            sys.exit("unexpected: the probe key exists")
        print("read: allowed", flush=True)
        started = s3.create_multipart_upload(Bucket=BUCKET, Key=probe)
        s3.abort_multipart_upload(Bucket=BUCKET, Key=probe, UploadId=started["UploadId"])
        print("write: allowed (probe upload started and aborted; nothing stored)", flush=True)
    except ClientError as error:
        code = error.response.get("Error", {}).get("Code", "unknown")
        sys.exit(f"credentials refused by {BUCKET}: {code}")
    print("credentials work", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dir", type=Path, help="folder holding <name>.pmtiles files")
    parser.add_argument("--check-credentials", action="store_true",
                        help="test read and write access to the bucket, store nothing, and stop")
    parser.add_argument("--only", nargs="+", help="archive names to upload (default: every .pmtiles in --dir)")
    parser.add_argument("--dry-run", action="store_true", help="list what would be uploaded and stop")
    args = parser.parse_args()
    if args.check_credentials:
        # a dry run promises no contact with r2, and the check makes two requests
        if args.dry_run:
            parser.error("--check-credentials cannot be combined with --dry-run")
        check_credentials(client())
        return
    if args.dir is None:
        parser.error("--dir is required")

    paths = sorted(args.dir.glob("*.pmtiles"))
    if args.only:
        wanted = set(args.only)
        paths = [path for path in paths if path.stem in wanted]
        missing = wanted - {path.stem for path in paths}
        if missing:
            sys.exit(f"not found in {args.dir}: {sorted(missing)}")
    bad = [path.stem for path in paths if not VERSIONED.fullmatch(path.stem)]
    if bad:
        sys.exit(f"not versioned names, refused: {bad}")
    if not paths:
        sys.exit("nothing to upload")
    sizes = {path: path.stat().st_size for path in paths}
    too_large = [path.name for path, size in sizes.items() if size > SINGLE_PUT_LIMIT]
    if too_large:
        sys.exit(f"refused: archives exceed the 5 GiB conditional single PUT limit: {too_large}")
    print(f"{len(paths)} archives, {sum(sizes.values()):,} bytes", flush=True)
    if args.dry_run:
        for path, size in sizes.items():
            print(f"  {path.name} {size:,}")
        return

    log = args.dir / "uploads.jsonl"
    done = {}
    if log.exists():
        for line in log.read_text(encoding="utf-8").splitlines():
            record = json.loads(line)
            done[record["key"]] = record
    s3 = client()
    for path in paths:
        key = f"{path.stem}.pmtiles"
        local_sha, size = sha256_file(path), path.stat().st_size
        existing = head(s3, key)
        if existing is not None:
            recorded = done.get(key)
            if recorded and recorded["sha256"] == local_sha and existing["ContentLength"] == size:
                if read_back(s3, key) == (local_sha, size):
                    print(f"already uploaded and verified: {key}", flush=True)
                    continue
                sys.exit(f"refused: {key} differs from this run's verified upload")
            sys.exit(f"refused: {key} already exists in {BUCKET} and is not this run's verified upload")
        print(f"uploading {key} ({size:,} bytes)", flush=True)
        upload(s3, path, key)
        remote_sha, remote_size = read_back(s3, key)
        if (remote_sha, remote_size) != (local_sha, size):
            sys.exit(f"read-back mismatch for {key}: {remote_size} bytes, sha256 {remote_sha}")
        etag = (head(s3, key) or {}).get("ETag", "").strip('"')
        with log.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps({"key": key, "bytes": size, "sha256": local_sha, "etag": etag}, sort_keys=True) + "\n")
        print(f"verified {key}", flush=True)
    print("all uploads verified", flush=True)


if __name__ == "__main__":
    main()
