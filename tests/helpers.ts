import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import Database from 'better-sqlite3';

/** قاعدة نظيفة في الذاكرة بنفس مخطط الإنتاج — بلا Electron. */
export function freshDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  const dir = join(process.cwd(), 'src', 'main', 'db');
  for (const file of ['schema.sql', 'search.sql']) {
    db.exec(readFileSync(join(dir, file), 'utf8'));
  }
  return db;
}

/** PNG بثمانية بتّات — رماديّ أو RGB أو RGBA أو رماديّ بشفافية — بكسلاتٍ RGBA. */
export function readPngRgba(buf: Buffer): { rgba: Uint8Array; width: number; height: number } {
  let p = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Buffer[] = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[12] !== 0) throw new Error('PNG بثمانية بتّات وبلا تشابك وحده');
      channels = ({ 0: 1, 2: 3, 4: 2, 6: 4 } as Record<number, number>)[data[9]!] ?? 0;
      if (!channels) throw new Error('نوع لونٍ غير مدعوم');
    }
    if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const cur = new Uint8Array(stride);
  const prev = new Uint8Array(stride);
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? cur[i - channels]! : 0;
      const b = prev[i]!;
      const c = i >= channels ? prev[i - channels]! : 0;
      const pa = Math.abs(b - c);
      const pb = Math.abs(a - c);
      const pc = Math.abs(a + b - 2 * c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      cur[i] = (raw[y * (stride + 1) + 1 + i]! + [0, a, b, (a + b) >> 1, paeth][filter]!) & 255;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const s = x * channels;
      if (channels <= 2) {
        rgba[o] = rgba[o + 1] = rgba[o + 2] = cur[s]!;
        rgba[o + 3] = channels === 2 ? cur[s + 1]! : 255;
      } else {
        rgba[o] = cur[s]!;
        rgba[o + 1] = cur[s + 1]!;
        rgba[o + 2] = cur[s + 2]!;
        rgba[o + 3] = channels === 4 ? cur[s + 3]! : 255;
      }
    }
    prev.set(cur);
  }
  return { rgba, width, height };
}

/** PNG رماديّ بثمانية بتّات (كما يكتبه `tools/mrz-fixture.mjs`) ← بكسلاته. */
export function readGrayPng(buf: Buffer): { gray: Uint8Array; width: number; height: number } {
  let p = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 0) throw new Error('ليس PNG رماديًّا بثمانية بتّات');
    }
    if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const gray = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (width + 1)]!;
    for (let x = 0; x < width; x++) {
      const a = x > 0 ? gray[y * width + x - 1]! : 0;
      const b = y > 0 ? gray[(y - 1) * width + x]! : 0;
      const c = x > 0 && y > 0 ? gray[(y - 1) * width + x - 1]! : 0;
      const pa = Math.abs(b - c);
      const pb = Math.abs(a - c);
      const pc = Math.abs(a + b - 2 * c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      const v = raw[y * (width + 1) + 1 + x]!;
      gray[y * width + x] = (v + [0, a, b, (a + b) >> 1, paeth][filter]!) & 255;
    }
  }
  return { gray, width, height };
}
