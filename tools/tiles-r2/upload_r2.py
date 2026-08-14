# upload pmtiles archives to r2 via s3 multipart api
# r2 s3 credentials are derived from a cloudflare api token:
# access key = token id, secret = sha256 hex of the token value
import hashlib
import os
import sys

import boto3
from boto3.s3.transfer import TransferConfig

ACCOUNT_ID = "4799a35f17f38fd6509d945820cc7075"
TOKEN_ID = "8027872ca7dd947fa94e1457fb0d468c"
BUCKET = "pow-tiles"
FILES = ["nz-polygons.pmtiles", "buildings.pmtiles", "places-overview.pmtiles", "places.pmtiles"]

token = os.environ["CLOUDFLARE_API_TOKEN"]
secret = hashlib.sha256(token.encode()).hexdigest()

s3 = boto3.client(
    "s3",
    endpoint_url=f"https://{ACCOUNT_ID}.r2.cloudflarestorage.com",
    aws_access_key_id=TOKEN_ID,
    aws_secret_access_key=secret,
    region_name="auto",
)

# multipart with large parts keeps the request count low
cfg = TransferConfig(multipart_threshold=64 * 1024 * 1024, multipart_chunksize=128 * 1024 * 1024)

base = os.path.dirname(os.path.abspath(__file__))
for name in FILES:
    path = os.path.join(base, name)
    size_mb = os.path.getsize(path) / 1e6
    print(f"uploading {name} ({size_mb:.0f} MB)...", flush=True)
    s3.upload_file(path, BUCKET, name, Config=cfg)
    print(f"done: {name}", flush=True)

# verify
listed = s3.list_objects_v2(Bucket=BUCKET)
for obj in listed.get("Contents", []):
    print(f"in bucket: {obj['Key']} {obj['Size']:,} bytes")
