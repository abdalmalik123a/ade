/**
 * يولّد أيقونة التطبيق من توكنات التصميم — لا من ملف صورة يُجلب من مكان.
 *
 * العلامة: مربّع كحليّ (primary-container #131b2e) عليه ورقة بيضاء بأسطر،
 * وختم أزرق (secondary #0058be) في زاويتها — وهي صورة ما يفعله التطبيق.
 * الرسم يجري بأربعة أضعاف المقاس ثم يُصغَّر، فتخرج الحواف ناعمة بلا مكتبة رسم.
 *
 *   node tools/make-icon.mjs   →   resources/icon.ico
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SIZE = 256;
const SS = 4; // تكبير المعاينة قبل التصغير — بديل الحواف الناعمة
const W = SIZE * SS;

const NAVY = [0x13, 0x1b, 0x2e];
const WHITE = [0xff, 0xff, 0xff];
const BLUE = [0x00, 0x58, 0xbe];

const big = new Uint8Array(W * W * 4); // RGBA

function put(x, y, [r, g, b]) {
  if (x < 0 || y < 0 || x >= W || y >= W) return;
  const i = (y * W + x) * 4;
  big[i] = r;
  big[i + 1] = g;
  big[i + 2] = b;
  big[i + 3] = 255;
}

/** مستطيل بزوايا مستديرة — الاختبار على مسافة الركن. */
function roundRect(x0, y0, w, h, radius, color) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const dx = Math.max(x0 + radius - x, x - (x0 + w - 1 - radius), 0);
      const dy = Math.max(y0 + radius - y, y - (y0 + h - 1 - radius), 0);
      if (dx * dx + dy * dy <= radius * radius) put(x, y, color);
    }
  }
}

function circle(cx, cy, r, color) {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) put(x, y, color);
    }
  }
}

const u = (n) => Math.round(n * SS); // من مقاس الأيقونة إلى مقاس الرسم

// الخلفية الكحلية
roundRect(0, 0, W, W, u(56), NAVY);

// الورقة: نسبة A4 تقريبًا
const pw = u(120);
const ph = u(156);
const px = Math.round((W - pw) / 2);
const py = Math.round((W - ph) / 2) - u(6);
roundRect(px, py, pw, ph, u(8), WHITE);

// أسطر الكتاب
for (let i = 0; i < 5; i++) {
  // السطر الأخير أقصر ليفسح مكان الختم، كما تُترك حاشية الكتاب لختمه.
  const lw = i === 0 ? u(58) : i === 4 ? u(46) : u(80);
  const lx = px + pw - u(20) - lw; // من اليمين، فالكتاب عربي
  roundRect(lx, py + u(30) + i * u(22), lw, u(8), u(4), NAVY);
}

// الختم الأزرق في زاوية الورقة السفلى
circle(px + u(34), py + ph - u(26), u(20), BLUE);
circle(px + u(34), py + ph - u(26), u(13), WHITE);
circle(px + u(34), py + ph - u(26), u(8), BLUE);

// التصغير بمتوسّط كل كتلة SS×SS
const pixels = new Uint8Array(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const i = ((y * SS + sy) * W + (x * SS + sx)) * 4;
        r += big[i];
        g += big[i + 1];
        b += big[i + 2];
        a += big[i + 3];
      }
    }
    const n = SS * SS;
    const o = (y * SIZE + x) * 4;
    pixels[o] = Math.round(r / n);
    pixels[o + 1] = Math.round(g / n);
    pixels[o + 2] = Math.round(b / n);
    pixels[o + 3] = Math.round(a / n);
  }
}

// ── ترميز PNG ────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)])), 8 + data.length);
  return out;
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // عمق البتّ
ihdr[9] = 6; // RGBA
const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0; // بلا مرشّح
  Buffer.from(pixels.buffer, y * SIZE * 4, SIZE * 4).copy(raw, y * (SIZE * 4 + 1) + 1);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
]);

// ── تغليف ICO (ويندوز يقبل PNG داخل ICO للمقاس 256) ──────────────────
const ico = Buffer.alloc(6 + 16 + png.length);
ico.writeUInt16LE(0, 0);
ico.writeUInt16LE(1, 2); // نوع: أيقونة
ico.writeUInt16LE(1, 4); // صورة واحدة
ico[6] = 0; // 0 تعني 256
ico[7] = 0;
ico[8] = 0; // بلا لوحة ألوان
ico[9] = 0;
ico.writeUInt16LE(1, 10); // مستويات
ico.writeUInt16LE(32, 12); // بتّ لكل بكسل
ico.writeUInt32LE(png.length, 14);
ico.writeUInt32LE(22, 18);
png.copy(ico, 22);

mkdirSync('resources', { recursive: true });
writeFileSync(join('resources', 'icon.ico'), ico);
writeFileSync(join('resources', 'icon.png'), png);
console.log(`resources/icon.ico — ${SIZE}×${SIZE}، ${(ico.length / 1024).toFixed(1)} ك.ب`);
