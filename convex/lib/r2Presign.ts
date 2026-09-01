// aws signature v4 query presigning for r2's s3-compatible api, in the
// default convex runtime (web crypto only, no sdk). inputs: one bucket
// object key and a method; output: a url a browser can PUT to or GET from
// for a bounded number of seconds. r2 ignores regions but sigv4 requires
// one, so "auto" is used per cloudflare's documentation.

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

export function r2ConfigFromEnv(env: Record<string, string | undefined>): R2Config | null {
  const accountId = env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = env.R2_BUCKET?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

const encoder = new TextEncoder();

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(key: ArrayBuffer | Uint8Array, value: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key instanceof Uint8Array ? (key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer) : key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(value));
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// rfc 3986 encoding as sigv4 requires: encodeURIComponent plus the five
// characters it leaves bare, with "/" preserved only inside object keys
function awsEncode(value: string, preserveSlash: boolean): string {
  const encoded = encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return preserveSlash ? encoded.replace(/%2F/g, "/") : encoded;
}

// the sigv4 core, split out so tests can drive it with the official aws
// example vector (virtual-hosted uri) while production uses r2 path-style
export async function presignCanonical(options: {
  accessKeyId: string;
  secretAccessKey: string;
  method: "GET" | "PUT";
  host: string;
  canonicalUri: string;
  expiresSeconds: number;
  now: Date;
  region: string;
  service: string;
}): Promise<string> {
  const { host, canonicalUri, region, service } = options;
  const amzDate = options.now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;

  const query: Array<[string, string]> = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${options.accessKeyId}/${scope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(options.expiresSeconds)],
    ["X-Amz-SignedHeaders", "host"],
  ];
  const canonicalQuery = query
    .map(([k, v]) => `${awsEncode(k, false)}=${awsEncode(v, false)}`)
    .sort()
    .join("&");

  const canonicalRequest = [
    options.method,
    canonicalUri,
    canonicalQuery,
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = await hmac(encoder.encode(`AWS4${options.secretAccessKey}`), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, "aws4_request");
  const signature = hex(await hmac(kSigning, stringToSign));

  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

export async function presignR2Url(
  config: R2Config,
  options: {
    method: "GET" | "PUT";
    key: string;
    expiresSeconds: number;
    // fixed clock injection keeps the function deterministic for tests
    now?: Date;
  },
): Promise<string> {
  return presignCanonical({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    method: options.method,
    host: `${config.accountId}.r2.cloudflarestorage.com`,
    canonicalUri: `/${awsEncode(config.bucket, false)}/${awsEncode(options.key, true)}`,
    expiresSeconds: options.expiresSeconds,
    now: options.now ?? new Date(),
    region: "auto",
    service: "s3",
  });
}
