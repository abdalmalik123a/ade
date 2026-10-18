/**
 * القاط على صورة المعاملة: فتحة العنق، ومطابقة العرض صفًّا صفًّا، والقصّ على حدّه — نُقل من `portraitMask.ts` (D82).
 */
import type { Landmarks } from './portraitMask';

// ── القاط ───────────────────────────────────────────────────────────────

/** فتحة العنق في صورة القاط: مركزها وعرضها وموضعها، وعرض الكتفين. */
export type SuitAnchor = { cx: number; cy: number; neckWidth: number; shoulderWidth: number; top: number };

/**
 * تُقرأ من شفافيّة صورة القاط نفسها — فيُركَّب القاط المستورد كما يُركَّب المدمج: الفجوة
 * الشفّافة بين طرفَي الياقة في أعلاه هي مكان العنق.
 */
export function suitAnchor(alpha: Uint8Array, width: number, height: number): SuitAnchor | null {
  const opaque = (x: number, y: number) => alpha[y * width + x]! >= 128;
  let top = -1;
  for (let y = 0; y < height && top < 0; y++) {
    let n = 0;
    for (let x = 0; x < width; x++) if (opaque(x, y)) n++;
    if (n > width * 0.01) top = y;
  }
  if (top < 0) return null;
  let shoulderWidth = 0;
  let best = { g: 0, cx: width / 2, y: top };
  const span = Math.max(4, Math.round((height - top) * 0.25));
  for (let y = top; y < Math.min(height, top + span); y++) {
    let l = -1;
    let r = -1;
    for (let x = 0; x < width; x++) {
      if (opaque(x, y)) {
        if (l < 0) l = x;
        r = x;
      }
    }
    if (l < 0) continue;
    shoulderWidth = Math.max(shoulderWidth, r - l + 1);
    // الفجوة الشفّافة الأقرب إلى وسط القاط في هذا الصفّ.
    const mid = Math.round((l + r) / 2);
    let c = -1;
    for (let d = 0; d < (r - l) / 4 && c < 0; d++) {
      if (!opaque(mid - d, y)) c = mid - d;
      else if (!opaque(mid + d, y)) c = mid + d;
    }
    if (c < 0) continue;
    let gl = c;
    let gr = c;
    while (gl > l && !opaque(gl - 1, y)) gl--;
    while (gr < r && !opaque(gr + 1, y)) gr++;
    const g = gr - gl + 1;
    if (g > best.g) best = { g, cx: (gl + gr) / 2, y };
  }
  // لا فجوة (ياقةٌ مغلقة في أعلاها): العنق وسط أعلاه، وعرضه ربع الكتفين.
  if (best.g < 3) return { cx: width / 2, cy: top, neckWidth: Math.max(1, shoulderWidth * 0.25), shoulderWidth, top };
  return { cx: best.cx, cy: best.y, neckWidth: best.g, shoulderWidth, top };
}

/** عرض الشكل في كلّ صفّ: من أوّل بكسلٍ معتمٍ إلى آخره (الفجوة بينهما محسوبة). */
export function rowWidths(alpha: Uint8Array, width: number, height: number): Float32Array {
  const out = new Float32Array(height);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let l = 0;
    while (l < width && alpha[row + l]! < 128) l++;
    if (l === width) continue;
    let r = width - 1;
    while (alpha[row + r]! < 128) r--;
    out[y] = r - l + 1;
  }
  return out;
}

/**
 * أعلى القاط في كلّ عمودٍ منه من صفّ الفتحة نزولًا — في فتحة العنق أسفلُها (الربطة أو ملتقى
 * الياقة)، وعلى الياقة أعلاها. ومنه يُرسم حدّ الشخص تحت القاط.
 */
export function suitTops(alpha: Uint8Array, width: number, height: number, anchor: SuitAnchor): Float32Array {
  const out = new Float32Array(width);
  const from = Math.max(0, Math.round(anchor.cy));
  for (let x = 0; x < width; x++) {
    let y = from;
    while (y < height && alpha[y * width + x]! < 128) y++;
    out[x] = y;
  }
  return out;
}

/**
 * عرض فتحة العنق حيث تلتفّ الياقة على الرقبة — عند ثلث عمق الفتحة، لا عند أعلاها المنفرج بين
 * طرفَي الياقة (أوسعها، وبه كان القاط يُكبَّر حتى تظهر ملابس الزبون في الفتحة).
 */
export function collarWidth(tops: Float32Array, anchor: SuitAnchor): number {
  const cx = Math.max(0, Math.min(tops.length - 1, Math.round(anchor.cx)));
  const depth = tops[cx]! - anchor.cy;
  if (!(depth > 2)) return anchor.neckWidth;
  const row = anchor.cy + depth * 0.3;
  let l = cx;
  let r = cx;
  while (l > 0 && tops[l - 1]! > row) l--;
  while (r < tops.length - 1 && tops[r + 1]! > row) r++;
  return Math.max(1, r - l + 1);
}

/** موضع القاط: فتحة عنقه تحت رقبة الشخص، بعرضٍ يلائمها — ومنها يُدار ويُكبَّر مع دعم مقياس أفقي وعمودي مستقلّين. */
export type SuitTransform = { x: number; y: number; scale: number; angle: number; scaleX?: number; scaleY?: number };

export function placeSuit(anchor: SuitAnchor, lm: Landmarks): SuitTransform {
  // الياقة أعرض قليلًا من الرقبة؛ والكتفان نحو ضعفي الرأس ونصفٍ — يُحكم بهما إن شذّ الأوّل.
  let scale = (lm.neckWidth * 1.3) / anchor.neckWidth;
  const shoulders = anchor.shoulderWidth * scale;
  const low = lm.headWidth * 2.1;
  const high = lm.headWidth * 3.2;
  if (shoulders < low || shoulders > high) scale = (lm.headWidth * 2.6) / anchor.shoulderWidth;
  return { x: lm.neckCenterX, y: lm.neckY + lm.neckWidth * 0.35, scale, angle: 0 };
}

/**
 * يُلبس القاط على جسد الشخص كما يُلبسه الخيّاط: **الياقة تلتفّ على الرقبة** — فحجمه ما تكون به
 * فتحة العنق (`collarWidth`) بين ٠٫٩ و١٫٣ من عرض الرقبة، وإلا ظهرت ملابس الزبون في الفتحة —
 * ثم يُختار من ذلك الحجمُ والارتفاعُ اللذان يطابق فيهما عرضُ القاط عرضَ الشخص صفًّا صفًّا من الذقن
 * إلى أسفل الصدر، فيقع كتفاه على كتفيه. وبلا كتفين في الصورة يبقى موضع الرقبة.
 *
 * `suitRows` عرض القاط صفًّا صفًّا بكسلاتِه، و`personRows` عرض الشخص بكسلاتِ صورته (`rowWidths`)،
 * و`tops` أعلى القاط عمودًا عمودًا (`suitTops`) — ومنه عرض الياقة.
 */
export function fitSuit(anchor: SuitAnchor, suitRows: Float32Array, personRows: Float32Array, lm: Landmarks, tops?: Float32Array): SuitTransform {
  const seed = placeSuit(anchor, lm);
  if (lm.shoulderY === null || !suitRows.length) return seed;
  const collar = tops ? collarWidth(tops, anchor) : anchor.neckWidth;
  const height = personRows.length;
  const head = Math.max(1, lm.chin - lm.top);
  // ما يظهر في صور المعاملات تحت الذقن: الرقبة وأعلى الكتفين — فيه تُقاس المطابقة.
  const y1 = Math.min(height - 1, Math.round(lm.chin + head * 0.8));
  const step = Math.max(1, Math.round(height / 600));
  const exposed = lm.neckWidth * 1.3;
  let best = { cost: Infinity, scale: seed.scale, y: seed.y };
  for (let hug = 0.9; hug <= 1.3001; hug += 0.02) {
    const scale = (hug * lm.neckWidth) / collar;
    for (let y0 = lm.chin; y0 <= lm.shoulderY + lm.neckWidth * 0.5; y0 += step) {
      let cost = 0;
      for (let y = lm.chin; y <= y1; y += step) {
        const p = personRows[y]!;
        if (y < y0) {
          // فوق القاط: الرقبة وحدها — وما اتّسع هناك كتفا الشخص بلباسه مكشوفَين، وهو أسوأ ما يُرى.
          cost += 4 * Math.max(0, p - exposed);
          continue;
        }
        const q = suitRows[Math.min(suitRows.length - 1, Math.round(anchor.cy + (y - y0) / scale))]! * scale;
        // تحت أعلى القاط يُقصّ الشخص، فالقاط الأضيق يُنحِل كتفيه؛ والأعرض قليلًا طبيعيّ في القاط.
        cost += p > q ? p - q : 0.15 * (q - p);
      }
      if (cost < best.cost) best = { cost, scale, y: y0 };
    }
  }
  return { x: lm.neckCenterX, y: best.y, scale: best.scale, angle: 0 };
}

/**
 * حدّ الشخص تحت القاط لكلّ عمودٍ من الصورة: في فتحة العنق الرقبة (`neck`) لأسفل الفتحة، وخارجها لأعلى الياقة.
 * وتحت الذقن لا يبقى إلا الرقبة، ويُحسب من نقاط أعلى القاط مُدارةً بزاويته ومقياسه (scale/scaleX/scaleY).
 */
export function neckLine(
  tops: Float32Array,
  anchor: SuitAnchor,
  at: SuitTransform,
  width: number,
  overlap = 4,
  neck?: { x: number; half: number; from: number }
): Float32Array {
  const line = new Float32Array(width).fill(NaN);
  const cos = Math.cos((at.angle * Math.PI) / 180);
  const sin = Math.sin((at.angle * Math.PI) / 180);
  const sx = (at.scaleX ?? 1) * at.scale;
  const sy = (at.scaleY ?? 1) * at.scale;
  const half = (anchor.neckWidth / 2) * sx;
  for (let c = 0; c < tops.length; c++) {
    const rawDx = (c - anchor.cx) * sx;
    // في الفتحة الرقبةُ وحدها (`neck`): ما جاورها فيها ملابس الزبون، تُقصّ عند أعلى الياقة.
    const inNeck = !neck || Math.abs(at.x + rawDx * cos - neck.x) <= neck.half;
    const rawDy = ((Math.abs(rawDx) < half && inNeck ? tops[c]! : anchor.cy) - anchor.cy) * sy;
    const X = at.x + rawDx * cos - rawDy * sin;
    const Y = at.y + rawDx * sin + rawDy * cos + overlap;
    const x = Math.round(X);
    if (x >= 0 && x < width && !(line[x]! <= Y)) line[x] = Y;
  }
  // الأعمدة بين النقاط (القاط مكبَّر) تُملأ بجوارها، وما خرج عن عرضه يمتدّ بطرفيه.
  let last = NaN;
  for (let x = 0; x < width; x++) {
    if (Number.isNaN(line[x]!)) line[x] = last;
    else last = line[x]!;
  }
  last = NaN;
  for (let x = width - 1; x >= 0; x--) {
    if (Number.isNaN(line[x]!)) line[x] = last;
    else last = line[x]!;
  }
  if (neck) for (let x = 0; x < width; x++) if (Math.abs(x - neck.x) > neck.half) line[x] = Math.min(line[x]!, neck.from);
  return line;
}

/** مضاعف الشفافية تحت القاط: ١ فوق الحدّ، ويتلاشى في `feather` صفوف حتى الحدّ. */
export const keepAbove = (line: Float32Array, x: number, y: number, feather: number): number =>
  Math.max(0, Math.min(1, (line[x]! - y) / feather));

/** الشخص مقصوصًا على حدّ القاط — كما يُرسم. */
export function underSuit(alpha: Uint8Array, width: number, height: number, line: Float32Array, feather = 4): Uint8Array {
  const out = new Uint8Array(alpha.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) out[y * width + x] = Math.round(alpha[y * width + x]! * keepAbove(line, x, y, feather));
  return out;
}
