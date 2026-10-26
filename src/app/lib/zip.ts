// A ZIP archive of uncompressed ("stored") files, after PKWARE's APPNOTE
// sections 4.3.7 (local file header), 4.3.12 (central directory) and 4.3.16
// (end of central directory). The archives here hold a few kB of CSV, so
// compression is not worth a dependency.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 as ZIP uses it (IEEE 802.3, reflected). */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** MS-DOS date and time, local time, as ZIP stores a file's modification time. */
function dosDateTime(date: Date): { time: number; date: number } {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/** UTF-8 text files, by name, in one archive. */
export function zipStored(files: Record<string, string>, modified = new Date()): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const stamp = dosDateTime(modified);
  const entries = Object.entries(files).map(([name, text]) => {
    const data = encoder.encode(text);
    return { name: encoder.encode(name), data, crc: crc32(data) };
  });
  const localSize = entries.reduce((sum, e) => sum + 30 + e.name.length + e.data.length, 0);
  const centralSize = entries.reduce((sum, e) => sum + 46 + e.name.length, 0);
  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);
  let at = 0;
  const u16 = (v: number) => { view.setUint16(at, v, true); at += 2; };
  const u32 = (v: number) => { view.setUint32(at, v, true); at += 4; };
  const bytes = (b: Uint8Array) => { out.set(b, at); at += b.length; };
  // Shared by both headers: version needed 2.0, UTF-8 names (bit 11), stored, time, date, CRC, sizes.
  const common = (e: typeof entries[number]) => {
    u16(20); u16(0x0800); u16(0); u16(stamp.time); u16(stamp.date);
    u32(e.crc); u32(e.data.length); u32(e.data.length); u16(e.name.length); u16(0);
  };

  const offsets: number[] = [];
  for (const e of entries) {
    offsets.push(at);
    u32(0x04034b50); common(e); bytes(e.name); bytes(e.data);
  }
  const centralStart = at;
  entries.forEach((e, i) => {
    u32(0x02014b50); u16(20); common(e);
    u16(0); u16(0); u16(0); u32(0); u32(offsets[i]); bytes(e.name);
  });
  const centralLength = at - centralStart;
  u32(0x06054b50); u16(0); u16(0); u16(entries.length); u16(entries.length);
  u32(centralLength); u32(centralStart); u16(0);
  return out;
}
