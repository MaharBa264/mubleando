// Genera los iconos PNG de la PWA (sin dependencias): fondo verde y el mismo dibujo que icon.svg.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

function png(size, file) {
  const s = size / 64;
  const bg = [0x1f, 0x6f, 0x5c], fg = [255, 255, 255];
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const inRect = (x, y, x0, y0, x1, y1) => x >= x0 * s && x < x1 * s && y >= y0 * s && y < y1 * s;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const frame = inRect(x, y, 12, 12, 52, 52) && !inRect(x, y, 16, 16, 48, 48);
      const mid = inRect(x, y, 12, 30, 52, 34) || inRect(x, y, 30, 30, 34, 52);
      const c = frame || mid ? fg : bg;
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; raw[o + 3] = 255;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcTable[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
png(192, process.argv[2] + '/icon-192.png');
png(512, process.argv[2] + '/icon-512.png');
png(180, process.argv[2] + '/apple-icon.png');
