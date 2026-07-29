/**
 * Minimal deterministic ZIP writer (store method, no compression).
 *
 * Entries are sorted by path and stamped with a fixed DOS timestamp so the
 * same inputs always produce byte-identical archives — required for the
 * staleness check in `npm run validate:release`. No external dependencies.
 */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i++) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

// Fixed timestamp: 2026-01-01 00:00:00 in DOS date/time format.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

/**
 * Build a ZIP archive buffer.
 * @param {Array<{ path: string, data: Buffer }>} entries
 * @returns {Buffer}
 */
export function createZip(entries) {
  const sorted = [...entries].sort((a, b) => a.path.localeCompare(b.path));
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of sorted) {
    const nameBytes = Buffer.from(entry.path, "utf8");
    const data = entry.data;
    const crc = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 flag
    localHeader.writeUInt16LE(0, 8); // store (no compression)
    localHeader.writeUInt16LE(DOS_TIME, 10);
    localHeader.writeUInt16LE(DOS_DATE, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBytes, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(DOS_TIME, 12);
    centralHeader.writeUInt16LE(DOS_DATE, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra length
    centralHeader.writeUInt16LE(0, 32); // comment length
    centralHeader.writeUInt16LE(0, 34); // disk number
    centralHeader.writeUInt16LE(0, 36); // internal attrs
    centralHeader.writeUInt32LE(0, 38); // external attrs
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBytes);
    offset += localHeader.length + nameBytes.length + data.length;
  }

  const centralStart = offset;
  const centralBuffer = Buffer.concat(centralParts);

  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(sorted.length, 8);
  endRecord.writeUInt16LE(sorted.length, 10);
  endRecord.writeUInt32LE(centralBuffer.length, 12);
  endRecord.writeUInt32LE(centralStart, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralBuffer, endRecord]);
}
