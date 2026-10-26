import { describe, expect, it } from 'vitest';
import { crc32, zipStored } from './zip';

describe('crc32', () => {
  it('gives the CRC-32 standard check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});

describe('zipStored', () => {
  const archive = zipStored({ 'a.csv': 'x,y\n1,2', 'ü.csv': 'é' }, new Date(2026, 9, 26, 14, 30, 10));
  const view = new DataView(archive.buffer);
  const text = (from: number, length: number) => new TextDecoder().decode(archive.subarray(from, from + length));

  it('ends with a central directory listing both files', () => {
    const end = archive.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    const centralStart = view.getUint32(end + 16, true);
    expect(view.getUint32(centralStart, true)).toBe(0x02014b50);
    expect(centralStart + view.getUint32(end + 12, true)).toBe(end);
  });

  it('stores each file whole after its local header, with its CRC and size', () => {
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint16(8, true)).toBe(0); // stored, not compressed
    const nameLength = view.getUint16(26, true);
    expect(text(30, nameLength)).toBe('a.csv');
    expect(view.getUint32(22, true)).toBe(7);
    expect(text(30 + nameLength, 7)).toBe('x,y\n1,2');
    expect(view.getUint32(14, true)).toBe(crc32(new TextEncoder().encode('x,y\n1,2')));
  });

  it('marks names as UTF-8 and keeps the modification date', () => {
    expect(view.getUint16(6, true) & 0x0800).toBe(0x0800);
    const date = view.getUint16(12, true);
    expect([(date >> 9) + 1980, (date >> 5) & 15, date & 31]).toEqual([2026, 10, 26]);
  });
});
