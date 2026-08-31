import assert from "node:assert/strict";
import test from "node:test";
import { presignCanonical, presignR2Url, r2ConfigFromEnv } from "./r2Presign.ts";

// the official aws sigv4 presigned-get example (s3 developer guide,
// "signing aws requests: query parameter authentication"): known keys,
// fixed clock, published expected signature
const AWS_EXAMPLE = {
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  method: "GET",
  host: "examplebucket.s3.amazonaws.com",
  canonicalUri: "/test.txt",
  expiresSeconds: 86400,
  now: new Date("2013-05-24T00:00:00Z"),
  region: "us-east-1",
  service: "s3",
};

test("reproduces the official aws presigned-get example signature", async () => {
  const url = await presignCanonical(AWS_EXAMPLE);
  assert.match(
    url,
    /X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404$/,
  );
  assert.match(url, /^https:\/\/examplebucket\.s3\.amazonaws\.com\/test\.txt\?/);
  assert.match(url, /X-Amz-Expires=86400/);
});

test("r2 urls are path-style against the account endpoint", async () => {
  const url = await presignR2Url(
    { accountId: "acct123", accessKeyId: "k", secretAccessKey: "s", bucket: "pow-evidence" },
    { method: "PUT", key: "evidence/task-1/photo one.jpg", expiresSeconds: 300, now: new Date("2026-08-31T00:00:00Z") },
  );
  assert.match(url, /^https:\/\/acct123\.r2\.cloudflarestorage\.com\/pow-evidence\/evidence\/task-1\/photo%20one\.jpg\?/);
  assert.match(url, /X-Amz-Expires=300/);
  assert.match(url, /X-Amz-Signature=[0-9a-f]{64}$/);
});

test("config requires all four env values", () => {
  assert.equal(r2ConfigFromEnv({}), null);
  assert.equal(r2ConfigFromEnv({ R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "b", R2_SECRET_ACCESS_KEY: "c" }), null);
  assert.deepEqual(
    r2ConfigFromEnv({ R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "b", R2_SECRET_ACCESS_KEY: "c", R2_BUCKET: "d" }),
    { accountId: "a", accessKeyId: "b", secretAccessKey: "c", bucket: "d" },
  );
});
