import { deflateRawSync } from 'node:zlib';

type ZipEntry = { name: string; data: Buffer };

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number) { const output = Buffer.alloc(2); output.writeUInt16LE(value, 0); return output; }
function u32(value: number) { const output = Buffer.alloc(4); output.writeUInt32LE(value >>> 0, 0); return output; }

/** Creates a small standards-compliant ZIP with server-controlled flat paths. */
export function createZip(entries: ZipEntry[]) {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name.replace(/\\/g, '/'), 'utf8');
    const compressed = deflateRawSync(entry.data);
    const crc = crc32(entry.data);
    const header = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), u16(20), u16(0), u16(8), u16(0), u16(0), u32(crc), u32(compressed.length), u32(entry.data.length), u16(name.length), u16(0), name, compressed]);
    local.push(header);
    const directory = Buffer.concat([Buffer.from([0x50, 0x4b, 0x01, 0x02]), u16(20), u16(20), u16(0), u16(8), u16(0), u16(0), u32(crc), u32(compressed.length), u32(entry.data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]);
    central.push(directory);
    offset += header.length;
  }
  const centralData = Buffer.concat(central);
  const end = Buffer.concat([Buffer.from([0x50, 0x4b, 0x05, 0x06]), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(centralData.length), u32(offset), u16(0)]);
  return Buffer.concat([...local, centralData, end]);
}

