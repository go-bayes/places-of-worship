const utf8 = new TextDecoder("utf-8", { fatal: true });

class Reader {
  constructor(bytes) {
    this.bytes = bytes;
    this.offset = 0;
  }

  get done() {
    return this.offset === this.bytes.length;
  }

  take(length) {
    const end = this.offset + length;
    if (end > this.bytes.length) throw new Error("Truncated protobuf field");
    const bytes = this.bytes.subarray(this.offset, end);
    this.offset = end;
    return bytes;
  }

  varint64() {
    let result = 0n;
    for (let shift = 0n; shift <= 63n; shift += 7n) {
      if (this.done) throw new Error("Truncated protobuf varint");
      const byte = this.bytes[this.offset++];
      if (shift === 63n && byte > 1) throw new Error("Protobuf varint exceeds 64 bits");
      result |= BigInt(byte & 127) << shift;
      if (byte < 128) return result;
    }
  }

  uint32() {
    // geometry, indices, lengths and field tags use uint32 varints
    let result = 0;
    for (let shift = 0; shift <= 28; shift += 7) {
      if (this.done) throw new Error("Truncated protobuf varint");
      const byte = this.bytes[this.offset++];
      if (shift === 28 && byte > 15) throw new Error("Protobuf varint exceeds 32 bits");
      result += (byte & 127) * 2 ** shift;
      if (byte < 128) return result;
    }
  }

  tag() {
    const tag = this.uint32();
    if (tag < 8) throw new Error("Invalid protobuf field number");
    return tag;
  }

  bytesField() {
    return this.take(this.uint32());
  }

  string() {
    return utf8.decode(this.bytesField());
  }

  float(length) {
    const bytes = this.take(length);
    const view = new DataView(bytes.buffer, bytes.byteOffset, length);
    return length === 4 ? view.getFloat32(0, true) : view.getFloat64(0, true);
  }

  skip(tag) {
    switch (tag & 7) {
      case 0: this.varint64(); break;
      case 1: this.take(8); break;
      case 2: this.bytesField(); break;
      case 5: this.take(4); break;
      default: throw new Error("Unsupported protobuf wire type");
    }
  }
}

function safeInteger(integer) {
  const number = Number(integer);
  return Number.isSafeInteger(number) ? number : integer.toString();
}

function readValue(bytes) {
  const reader = new Reader(bytes);
  let value;
  while (!reader.done) {
    const tag = reader.tag();
    switch (tag) {
      case 10: value = reader.string(); break;
      case 21: value = reader.float(4); break;
      case 25: value = reader.float(8); break;
      case 32: value = safeInteger(BigInt.asIntN(64, reader.varint64())); break;
      case 40: value = safeInteger(reader.varint64()); break;
      case 48: {
        const encoded = reader.varint64();
        value = safeInteger((encoded >> 1n) ^ -(encoded & 1n));
        break;
      }
      case 56: value = reader.varint64() !== 0n; break;
      default: reader.skip(tag);
    }
  }
  if (value === undefined) throw new Error("Missing MVT property value");
  return value;
}

function appendPacked(bytes, values) {
  const reader = new Reader(bytes);
  while (!reader.done) values.push(reader.uint32());
}

function readPointFeature(bytes, keys, values, toLonLat, points, requirePoints) {
  const reader = new Reader(bytes);
  const tags = [];
  const geometry = [];
  let type = 0;
  while (!reader.done) {
    const tag = reader.tag();
    switch (tag) {
      case 16: tags.push(reader.uint32()); break;
      case 18: appendPacked(reader.bytesField(), tags); break;
      case 24: type = reader.uint32(); break;
      case 32: geometry.push(reader.uint32()); break;
      case 34: appendPacked(reader.bytesField(), geometry); break;
      default: reader.skip(tag);
    }
  }
  if (type !== 1) {
    if (requirePoints) throw new Error("Expected MVT point geometry");
    return;
  }
  if (tags.length % 2 !== 0) throw new Error("Unpaired MVT feature tags");

  const entries = [];
  for (let i = 0; i < tags.length; i += 2) {
    const key = keys[tags[i]];
    const value = values[tags[i + 1]];
    if (key === undefined || value === undefined) throw new Error("MVT tag index out of range");
    entries.push([key, value]);
  }
  const properties = Object.fromEntries(entries);

  // point and multipoint geometry consists of one MoveTo command
  const [command] = geometry;
  const count = command >>> 3;
  if ((command & 7) !== 1 || count === 0 || geometry.length !== 1 + 2 * count) {
    throw new Error("Invalid MVT point geometry");
  }
  let x = 0;
  let y = 0;
  for (let i = 1; i < geometry.length; i += 2) {
    x += (geometry[i] >>> 1) ^ -(geometry[i] & 1);
    y += (geometry[i + 1] >>> 1) ^ -(geometry[i + 1] & 1);
    points.push({ ...toLonLat(x, y), properties });
  }
}

function readLayer(bytes, tile, layerName, points, requirePoints) {
  const { z, x, y } = tile;
  const reader = new Reader(bytes);
  const features = [];
  const keys = [];
  const encodedValues = [];
  let name;
  let extent = 4096;
  while (!reader.done) {
    const tag = reader.tag();
    switch (tag) {
      case 10:
        name = reader.string();
        if (name !== layerName) return false;
        break;
      case 18: features.push(reader.bytesField()); break;
      case 26: keys.push(reader.string()); break;
      case 34: encodedValues.push(reader.bytesField()); break;
      case 40: extent = reader.uint32(); break;
      default: reader.skip(tag);
    }
  }
  if (name !== layerName) return false;
  if (extent === 0) throw new Error("MVT layer extent must be positive");
  const values = encodedValues.map(readValue);
  const scale = 2 ** z;
  const toLonLat = (localX, localY) => ({
    tile, localX, localY, extent,
    lon: ((x + localX / extent) / scale) * 360 - 180,
    lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + localY / extent) / scale))) * 180 / Math.PI
  });
  for (const feature of features) readPointFeature(feature, keys, values, toLonLat, points, requirePoints);
  return true;
}

// expected tile coordinates are XYZ. buffers can extend beyond the tile edges.
// reports layer presence and one row per point coordinate
export function decodeMvtPoints(buffer, tile, layerName, { requirePoints = false } = {}) {
  if (!(buffer instanceof ArrayBuffer)) throw new Error("Expected an uncompressed MVT ArrayBuffer");
  const reader = new Reader(new Uint8Array(buffer));
  const points = [];
  let foundLayer = false;
  while (!reader.done) {
    const tag = reader.tag();
    if (tag === 26) {
      if (readLayer(reader.bytesField(), tile, layerName, points, requirePoints)) foundLayer = true;
    } else {
      reader.skip(tag);
    }
  }
  return { foundLayer, points };
}
