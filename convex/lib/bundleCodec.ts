import { gunzipSync, gzipSync } from "fflate";

// the stored encoding of frozen bundle files (lean-storage brief, ruling 3,
// jb 2026-09-24): every file is gzip-compressed with a pinned pure-js codec
// before it is stored, with a deterministic header (mtime 0, no filename,
// no comment, fflate's fixed os byte 3), so one plain file under one codec
// record gives exactly one stored byte sequence. The codec record travels
// with every stored file (frozen_files[].codec) so stored bytes can be
// reproduced from the plain bytes, not only checked. The manifest contract
// (pow-export-bundle.v1) is untouched: manifest `files[]` and
// frozen_files[].sha256 / byte_length keep describing the plain bytes.

// must equal the exact version pinned in package.json (checked by
// convex/lib/bundleCodec.node-test.mjs against node_modules)
export const FFLATE_VERSION = "0.8.3";
export const GZIP_LEVEL = 6;

export type CodecRecord = {
  name: "fflate";
  version: string;
  level: number;
  header: { mtime: number; filename: boolean };
};

export const BUNDLE_CODEC: CodecRecord = {
  name: "fflate",
  version: FFLATE_VERSION,
  level: GZIP_LEVEL,
  header: { mtime: 0, filename: false },
};

// names one stored representation: plain content under one codec. A codec
// upgrade yields a new id, so an object key built from it never replaces
// bytes written under the old codec.
export function codecId(codec: CodecRecord): string {
  return `${codec.name}-${codec.version}-l${codec.level}`;
}

// the object key rule of ruling 3 (plain hash and codec id together), used
// as the stored object's name in pending_freeze.stored_objects; the durable
// bucket that serves these keys is the separate L2 step
export function storedObjectKey(plainSha256: string, codec: CodecRecord): string {
  return `objects/sha256/${plainSha256}/${codecId(codec)}.gz`;
}

export function sameCodec(a: CodecRecord, b: CodecRecord): boolean {
  return a.name === b.name
    && a.version === b.version
    && a.level === b.level
    && a.header.mtime === b.header.mtime
    && a.header.filename === b.header.filename;
}

export function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

// gzip under BUNDLE_CODEC. fflate writes mtime only when the option is not
// 0 and a filename only when one is given, so the header is fixed
export function gzipBundleFile(plain: Uint8Array, codec: CodecRecord = BUNDLE_CODEC): Uint8Array {
  if (!sameCodec(codec, BUNDLE_CODEC)) {
    throw new Error(`Unsupported bundle codec ${codecId(codec)}; this build writes ${codecId(BUNDLE_CODEC)}.`);
  }
  return gzipSync(plain, { level: codec.level as 6, mtime: 0 });
}

// the decoder accepts any fflate gzip stream; the caller verifies the plain
// bytes against their recorded sha256 and length. fflate does not check the
// gzip trailer's crc, which is why the plain hash check is mandatory
export function gunzipBundleFile(stored: Uint8Array): Uint8Array {
  return gunzipSync(stored);
}

export function hexOfDigest(digest: ArrayBuffer): string {
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return hexOfDigest(await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>));
}

// the four values of one stored file: plain sha256 and byte length (what
// the manifest records) and stored sha256 and byte length (the gzip bytes)
export type FourValues = {
  sha256: string;
  byte_length: number;
  stored_sha256: string;
  stored_byte_length: number;
};

// verifies stored bytes against all four recorded values and returns the
// plain bytes; a mismatch names which value failed
export async function verifyStoredFile(
  label: string,
  stored: Uint8Array,
  expected: FourValues,
): Promise<Uint8Array> {
  const storedSha256 = await sha256Hex(stored);
  if (storedSha256 !== expected.stored_sha256 || stored.length !== expected.stored_byte_length) {
    throw new Error(
      `${label}: stored bytes failed verification (expected stored sha256 ${expected.stored_sha256} and ${expected.stored_byte_length} bytes, got ${storedSha256} and ${stored.length} bytes).`,
    );
  }
  let plain: Uint8Array;
  try {
    plain = gunzipBundleFile(stored);
  } catch (error) {
    throw new Error(`${label}: stored bytes do not decode as gzip (${error instanceof Error ? error.message : String(error)}).`);
  }
  const plainSha256 = await sha256Hex(plain);
  if (plainSha256 !== expected.sha256 || plain.length !== expected.byte_length) {
    throw new Error(
      `${label}: decoded bytes failed verification (expected sha256 ${expected.sha256} and ${expected.byte_length} bytes, got ${plainSha256} and ${plain.length} bytes).`,
    );
  }
  return plain;
}
