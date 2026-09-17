/**
 * مولّد رمز QR — مكتوب هنا لا مستوردًا من حزمة.
 *
 * السبب: «رمز التحقق الإلكتروني» في التصميم يُطبع على كتاب رسمي، والتطبيق مقطوع
 * عن الشبكة تمامًا. فالرمز يُبنى محليًا من رقم الصادر وبصمة SHA-256، ويُرسم SVG
 * داخل الورقة نفسها — فيخرج مع الطباعة وPDF بلا صورة ولا خدمة خارجية.
 *
 * المواصفة المنفَّذة: ISO/IEC 18004 — نمط البايت (UTF-8)، مستوى تصحيح M،
 * الإصدارات 1..20 (تكفي ما يزيد على ستمئة بايت، والحمولة هنا دون المئة).
 */

export type QrMatrix = { size: number; modules: boolean[][] };

/** لكل إصدار: [كلمات التصحيح لكل كتلة، كتل المجموعة الأولى، كلمات بياناتها،
 *  كتل المجموعة الثانية، كلمات بياناتها] — مستوى M حصرًا. */
const EC_M: readonly (readonly [number, number, number, number, number])[] = [
  [10, 1, 16, 0, 0], //  1
  [16, 1, 28, 0, 0], //  2
  [26, 1, 44, 0, 0], //  3
  [18, 2, 32, 0, 0], //  4
  [24, 2, 43, 0, 0], //  5
  [16, 4, 27, 0, 0], //  6
  [18, 4, 31, 0, 0], //  7
  [22, 2, 38, 2, 39], //  8
  [22, 3, 36, 2, 37], //  9
  [26, 4, 43, 1, 44], // 10
  [30, 1, 50, 4, 51], // 11
  [22, 6, 36, 2, 37], // 12
  [22, 8, 37, 1, 38], // 13
  [24, 4, 40, 5, 41], // 14
  [24, 5, 41, 5, 42], // 15
  [28, 7, 45, 3, 46], // 16
  [28, 10, 46, 1, 47], // 17
  [26, 9, 43, 4, 44], // 18
  [26, 3, 44, 11, 45], // 19
  [26, 3, 41, 13, 42] // 20
];

/** مراكز مربّعات المحاذاة لكل إصدار. */
const ALIGNMENT: readonly (readonly number[])[] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90]
];

/** بتّات البقايا بعد آخر كلمة — تُملأ أصفارًا. */
function remainderBits(version: number): number {
  if (version === 1) return 0;
  if (version <= 6) return 7;
  if (version <= 13) return 0;
  return 3; // الإصدارات 14..20
}

// ── حقل غالوا GF(256) ────────────────────────────────────────────────
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d; // كثير الحدود الأولي للمواصفة
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!;
}

export function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a]! + LOG[b]!]!;
}

/** كثير حدود المولّد لعدد كلمات تصحيح معيّن. */
function generatorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    for (let j = 0; j < poly.length; j++) {
      next[j] = next[j]! ^ poly[j]!;
      next[j + 1] = next[j + 1]! ^ gfMul(poly[j]!, EXP[i]!);
    }
    poly = next;
  }
  return poly;
}

/** كلمات التصحيح لكتلة بيانات — باقي القسمة على كثير حدود المولّد. */
export function reedSolomon(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = generatorPoly(ecCount);
  const rest = new Uint8Array(ecCount);
  for (const byte of data) {
    const factor = byte ^ rest[0]!;
    rest.copyWithin(0, 1);
    rest[ecCount - 1] = 0;
    if (factor !== 0) {
      for (let i = 0; i < ecCount; i++) rest[i] = rest[i]! ^ gfMul(gen[i + 1]!, factor);
    }
  }
  return rest;
}

// ── تيار البتّات ─────────────────────────────────────────────────────
function pushBits(bits: number[], value: number, length: number): void {
  for (let i = length - 1; i >= 0; i--) bits.push((value >> i) & 1);
}

export function pickVersion(byteLength: number): number {
  for (let v = 1; v <= EC_M.length; v++) {
    const [, b1, d1, b2, d2] = EC_M[v - 1]!;
    const dataCodewords = b1 * d1 + b2 * d2;
    const header = 4 + (v <= 9 ? 8 : 16);
    if (dataCodewords * 8 >= header + byteLength * 8) return v;
  }
  throw new Error('الحمولة أكبر من طاقة رمز QR المدعومة');
}

/** كلمات الرمز مرتّبة للرسم: تجزئة إلى كتل، تصحيح لكل كتلة، ثم تشبيك. */
export function buildCodewords(bytes: Uint8Array, version: number): Uint8Array {
  const [ecCount, b1, d1, b2, d2] = EC_M[version - 1]!;
  const totalData = b1 * d1 + b2 * d2;

  const bits: number[] = [];
  pushBits(bits, 0b0100, 4); // نمط البايت
  pushBits(bits, bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) pushBits(bits, b, 8);

  // الإنهاء: أربع بتّات صفرية أو ما يتّسع، ثم إكمال إلى بايت كامل.
  const capacity = totalData * 8;
  for (let i = 0; i < 4 && bits.length < capacity; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const data = new Uint8Array(totalData);
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j]!;
    data[i / 8] = byte;
  }
  // بايتات الحشو المنصوص عليها، بالتناوب.
  for (let i = bits.length / 8, alt = 0; i < totalData; i++, alt++) {
    data[i] = alt % 2 === 0 ? 0xec : 0x11;
  }

  const blocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;
  for (const [count, size] of [
    [b1, d1],
    [b2, d2]
  ] as const) {
    for (let i = 0; i < count; i++) {
      const block = data.slice(offset, offset + size);
      offset += size;
      blocks.push(block);
      ecBlocks.push(reedSolomon(block, ecCount));
    }
  }

  const out: number[] = [];
  const maxData = Math.max(d1, d2);
  for (let i = 0; i < maxData; i++) {
    for (const block of blocks) if (i < block.length) out.push(block[i]!);
  }
  for (let i = 0; i < ecCount; i++) {
    for (const block of ecBlocks) out.push(block[i]!);
  }
  return new Uint8Array(out);
}

// ── رسم المصفوفة ────────────────────────────────────────────────────
/** خلايا المصفوفة: ‎-1 لم تُملأ بعد، 0 فاتحة، 1 داكنة. */
type Grid = { size: number; cells: Int8Array };

const at = (g: Grid, x: number, y: number): number => g.cells[y * g.size + x]!;
const put = (g: Grid, x: number, y: number, v: number): void => {
  g.cells[y * g.size + x] = v;
};

/** BCH(18,6) لمعلومات الإصدار. */
export function versionBits(version: number): number {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (version << 12) | rem;
}

/** BCH(15,5) لمعلومات الصيغة — مستوى التصحيح M ترميزه 00. */
export function formatBits(mask: number): number {
  const data = (0b00 << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

/** أنماط الوظيفة الثابتة، وتعليم المواضع المحجوزة التي لا تحمل بيانات. */
function drawFunctionPatterns(g: Grid, version: number): boolean[] {
  const reserved = new Array<boolean>(g.size * g.size).fill(false);
  const mark = (x: number, y: number, v: number) => {
    if (x < 0 || y < 0 || x >= g.size || y >= g.size) return;
    put(g, x, y, v);
    reserved[y * g.size + x] = true;
  };

  // مربّعات التموضع الثلاثة مع فاصلها الفاتح.
  for (const [ox, oy] of [
    [0, 0],
    [g.size - 7, 0],
    [0, g.size - 7]
  ] as const) {
    for (let dy = -1; dy <= 7; dy++) {
      for (let dx = -1; dx <= 7; dx++) {
        const inner = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
        const dark =
          inner &&
          (dx === 0 ||
            dx === 6 ||
            dy === 0 ||
            dy === 6 ||
            (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
        mark(ox + dx, oy + dy, dark ? 1 : 0);
      }
    }
  }

  // مربّعات المحاذاة — عدا ما يقع على مربّعات التموضع.
  const centers = ALIGNMENT[version - 1]!;
  for (const cy of centers) {
    for (const cx of centers) {
      const onFinder =
        (cx === 6 && cy === 6) ||
        (cx === 6 && cy === g.size - 7) ||
        (cx === g.size - 7 && cy === 6);
      if (onFinder) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const ring = Math.max(Math.abs(dx), Math.abs(dy));
          mark(cx + dx, cy + dy, ring === 1 ? 0 : 1);
        }
      }
    }
  }

  // خطّا التوقيت.
  for (let i = 8; i < g.size - 8; i++) {
    const dark = i % 2 === 0 ? 1 : 0;
    mark(i, 6, dark);
    mark(6, i, dark);
  }

  // مواضع معلومات الصيغة تُحجز الآن وتُملأ بعد اختيار القناع.
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) mark(i, 8, 0);
    if (i !== 6) mark(8, i, 0);
  }
  for (let i = 0; i < 8; i++) mark(g.size - 1 - i, 8, 0);
  for (let i = 0; i < 7; i++) mark(8, g.size - 1 - i, 0);
  mark(8, g.size - 8, 1); // الوحدة الداكنة الثابتة

  // معلومات الإصدار للإصدارات 7 فما فوق.
  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = (bits >> i) & 1;
      const a = Math.floor(i / 3);
      const b = (i % 3) + g.size - 11;
      mark(a, b, bit);
      mark(b, a, bit);
    }
  }

  return reserved;
}

/** مواضع أنماط الوظيفة — يحتاجها فكّ الترميز ليعرف أين تقع البيانات. */
export function functionModules(version: number): { size: number; reserved: boolean[] } {
  const size = 17 + version * 4;
  const g: Grid = { size, cells: new Int8Array(size * size).fill(-1) };
  return { size, reserved: drawFunctionPatterns(g, version) };
}

/** بنية الكتل لإصدار: [كلمات التصحيح، كتل أولى، كلماتها، كتل ثانية، كلماتها]. */
export function blockLayout(version: number): readonly [number, number, number, number, number] {
  return EC_M[version - 1]!;
}

function placeFormat(g: Grid, mask: number): void {
  const bits = formatBits(mask);
  const bit = (i: number) => (bits >> i) & 1;
  for (let i = 0; i <= 5; i++) put(g, 8, i, bit(i));
  put(g, 8, 7, bit(6));
  put(g, 8, 8, bit(7));
  put(g, 7, 8, bit(8));
  for (let i = 9; i < 15; i++) put(g, 14 - i, 8, bit(i));

  for (let i = 0; i <= 7; i++) put(g, g.size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) put(g, 8, g.size - 15 + i, bit(i));
  put(g, 8, g.size - 8, 1);
}

/** ترتيب وضع البتّات: عمودان عمودان من اليمين، صعودًا ثم نزولًا. */
export function zigzag(size: number, reserved: boolean[]): [number, number][] {
  const order: [number, number][] = [];
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // عمود التوقيت يُتخطّى
    for (let step = 0; step < size; step++) {
      const y = upward ? size - 1 - step : step;
      for (const x of [right, right - 1]) {
        if (!reserved[y * size + x]) order.push([x, y]);
      }
    }
    upward = !upward;
  }
  return order;
}

export const MASKS: readonly ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
];

/** عقوبات المواصفة الأربع — أقلّها يختار القناع. */
function penalty(g: Grid): number {
  const n = g.size;
  let score = 0;

  for (let pass = 0; pass < 2; pass++) {
    for (let a = 0; a < n; a++) {
      let run = 1;
      let prev = pass === 0 ? at(g, 0, a) : at(g, a, 0);
      for (let b = 1; b < n; b++) {
        const cur = pass === 0 ? at(g, b, a) : at(g, a, b);
        if (cur === prev) {
          run++;
          if (run === 5) score += 3;
          else if (run > 5) score += 1;
        } else {
          run = 1;
          prev = cur;
        }
      }
    }
  }

  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      const v = at(g, x, y);
      if (v === at(g, x + 1, y) && v === at(g, x, y + 1) && v === at(g, x + 1, y + 1)) score += 3;
    }
  }

  const finder = [1, 0, 1, 1, 1, 0, 1];
  const quiet = [0, 0, 0, 0];
  const matches = (line: number[], start: number, want: number[]) =>
    want.every((w, i) => line[start + i] === w);
  for (let pass = 0; pass < 2; pass++) {
    for (let a = 0; a < n; a++) {
      const line: number[] = [];
      for (let b = 0; b < n; b++) line.push(pass === 0 ? at(g, b, a) : at(g, a, b));
      for (let i = 0; i + 10 < n; i++) {
        if (matches(line, i, [...finder, ...quiet]) || matches(line, i, [...quiet, ...finder])) {
          score += 40;
        }
      }
    }
  }

  let dark = 0;
  for (let i = 0; i < g.cells.length; i++) if (g.cells[i] === 1) dark++;
  const ratio = (dark * 100) / (n * n);
  score += Math.floor(Math.abs(ratio - 50) / 5) * 10;

  return score;
}

/** يبني مصفوفة الرمز كاملةً، ويختار القناع الأقلّ عقوبةً كما تنصّ المواصفة. */
export function encodeQr(text: string): QrMatrix {
  const bytes = new TextEncoder().encode(text);
  const version = pickVersion(bytes.length);
  const codewords = buildCodewords(bytes, version);
  const size = 17 + version * 4;

  const base: Grid = { size, cells: new Int8Array(size * size).fill(-1) };
  const reserved = drawFunctionPatterns(base, version);

  const order = zigzag(size, reserved);
  const bits: number[] = [];
  for (const cw of codewords) for (let i = 7; i >= 0; i--) bits.push((cw >> i) & 1);
  for (let i = 0; i < remainderBits(version); i++) bits.push(0);
  order.forEach(([x, y], i) => put(base, x, y, bits[i] ?? 0));

  let best: Grid | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const g: Grid = { size, cells: Int8Array.from(base.cells) };
    for (const [x, y] of order) if (MASKS[mask]!(x, y)) put(g, x, y, at(g, x, y) ^ 1);
    placeFormat(g, mask);
    const score = penalty(g);
    if (score < bestScore) {
      bestScore = score;
      best = g;
    }
  }

  const grid = best!;
  const modules: boolean[][] = [];
  for (let y = 0; y < size; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < size; x++) row.push(at(grid, x, y) === 1);
    modules.push(row);
  }
  return { size, modules };
}

/**
 * الرمز صورةً داخل الورقة: SVG مضمّن، لا ملف ولا خدمة.
 * الهامش الصامت أربع وحدات — أقلّ منه لا تقرأه الماسحات.
 */
export function qrSvg(text: string, pixels = 64): string {
  const { size, modules } = encodeQr(text);
  const quiet = 4;
  const total = size + quiet * 2;
  let path = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules[y]![x]) path += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" ` +
    `width="${pixels}" height="${pixels}" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="#ffffff"/>` +
    `<path d="${path}" fill="#000000"/></svg>`
  );
}
