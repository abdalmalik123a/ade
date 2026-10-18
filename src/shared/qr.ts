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
import { pickVersion, buildCodewords, remainderBits } from './qrCodewords';
export { gfMul, reedSolomon, pickVersion, buildCodewords, blockLayout } from './qrCodewords';

export type QrMatrix = { size: number; modules: boolean[][] };

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
/**
 * `pixels` حجمٌ ثابت لمن يطلبه؛ وبغيره يملأ الرمز صندوقه ويبقى مربّعًا في وسطه.
 * كان ٦٤ بكسلًا ثابتة دائمًا: لا يكبر في صندوقٍ كبير، ويفيض خارج الصغير.
 */
export function qrSvg(text: string, pixels?: number): string {
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
    (pixels
      ? `width="${pixels}" height="${pixels}" `
      : `width="100%" height="100%" preserveAspectRatio="xMidYMid meet" `) +
    `shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="#ffffff"/>` +
    `<path d="${path}" fill="#000000"/></svg>`
  );
}
