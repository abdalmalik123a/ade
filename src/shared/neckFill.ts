/**
 * إكمال الرقبة بلا نموذج (S45، D175 — ر174، ر136 معدَّلًا بها): حين يُلبس القاط يُقصّ تحت الذقن ما ليس جلدًا (`neckSkin`) وما
 * تحت حدّ القاط (`neckLine`)، فكان مكان ياقة الزبون وقميصه في الفتحة لونَ الخلفية. وهنا **يُملأ ما قُصّ ولم يغطّه القاط** بين
 * أسفل الوجه وأعلى القاط: **الرقبة** في عمودها جلدًا من جلدها (وسيط الجلد المعروف حولها ثم انتشارٌ منه وتشويشٌ بقدر نسيجه)،
 * و**باطن الياقة** بجانبها داخل فتحة القاط تحت أعلاها قماشًا من قماش القاط الملاصق في ظلّ — وما علا الفتحة بجانب الرقبة خلفيّةٌ كاليوم.
 *
 * نقلٌ لـ`holeOf` و`knownSkin` و`diffuse` و`fillPlain` في نموذج D159 الأوّلي (`reports/diag/suitMeasure.diag.ts`): على عشر صورٍ
 * بياقةٍ ظاهرة كان الجلد في الرقبة المملوءة ٩٧–١٠٠٪ وMI-GAN ٠–١٣٪ — فلا نموذج.
 *
 * حسابٌ خالص (يُختبر بلا متصفّح) في مستطيل الرقبة وحده، يعيد طبقةً بحدود مستطيلها تُكتب في الشخص تحت القاط (`usePhotoCanvas`).
 * **ولا شيء فوق أسفل الوجه** (`faceFloor`، أو ملتقى الفكّ بلا وجه) — ر023. والتشويش ببذرةٍ ثابتة: الرسم نفسه في كلّ مرّة.
 */
import type { Landmarks } from './portraitMask';
import { keepAbove, type SuitAnchor, type SuitTransform } from './suitFit';
import { faceFloor, type Face } from './portraitFace';
import { jawLine, skinAt, skinWeight, type SkinMask, type SkinModel } from './portraitSkin';

type Px = Uint8Array | Uint8ClampedArray;

export type Rect = { x: number; y: number; w: number; h: number };

/** الطبقة: RGBA بمقاس مستطيلها، شفّافةٌ إلا المملوء — و`neck` و`collar` عدد بكسلات كلّ نوع. */
export type NeckFill = Rect & { data: Uint8ClampedArray; neck: number; collar: number };

/** المشهد كما يُرسم: الشخص بلونه وقناعه، وقصّه (حدّ القاط بريشته وقناع الجلد)، والمعالم والوجه ولون الجلد، والقاط بموضعه. */
export type NeckScene = {
  width: number;
  height: number;
  pixels: Px;
  alpha: Uint8Array;
  line: Float32Array;
  feather: number;
  mask: SkinMask | null;
  lm: Landmarks;
  face: Face | null;
  skin: SkinModel;
  at: SuitTransform;
  anchor: Pick<SuitAnchor, 'neckWidth'>;
  neck: { x: number; half: number };
};

/**
 * دورات الانتشار (كالنموذج الأوّلي) — ورقبةٌ كبيرة تقلّ دوراتها حتى لا يجاوز العمل `WORK` تحديثًا (دوراتٌ × بكسلات، نحو ربع
 * ثانيةٍ في أسوئه)، فيبقى الحساب بعد توقّف القاط قصيرًا؛ والوسيط أساسٌ فقلّة الدورات لا تفسد.
 */
export const ROUNDS = 300;
const WORK = 1.2e7;
/** مستطيلٌ أكبر من هذا لا يُملأ — ولا يبلغه عنق صورة عملٍ حدّها ٢٤٠٠ بكسل. */
const MAX_AREA = 2.5e6;
/** قماش القاط الملاصق يُقرأ حتى هذا البعد، والجلد المعروف حتى ٣ بكسلات بجانب المفقود. */
const NEAR = 4;
/** ظلّ باطن الياقة من إضاءة القماش، وحدّ نسيج الجلد (انحراف الإضاءة عن جيرانها). */
const SHADE = 0.55;
const GRAIN = 6;

/**
 * طبقة الإكمال، و`null` إن لم يُقصّ شيءٌ ظاهر أو قلّ الجلد المعروف حوله (أقلّ من ٣٠ بكسلًا) أو كبر المستطيل.
 * `paintSuit` يرسم القاط بموضعه في مستطيلٍ من الصورة (RGBA بمقاسه) — كما يُرسم في المشهد. و`rounds` للاختبار وحده.
 */
export function neckFill(s: NeckScene, paintSuit: (r: Rect) => Px, rounds = ROUNDS): NeckFill | null {
  const { width: W, height: H, lm, face, at, feather, neck } = s;
  const sx = (at.scaleX ?? 1) * at.scale;
  const open = (s.anchor.neckWidth * sx) / 2 + feather;
  const floor = (x: number) => Math.max(0, Math.ceil(face ? faceFloor(face, lm.chin, x) : jawLine(lm)));
  const x0 = Math.max(0, Math.floor(Math.min(neck.x - neck.half, at.x - open)));
  const x1 = Math.min(W - 1, Math.ceil(Math.max(neck.x + neck.half, at.x + open)));
  const bottom = Math.min(H, Math.ceil(lm.chin + lm.neckWidth * 3));
  let top = H;
  for (let x = x0; x <= x1; x++) top = Math.min(top, floor(x));
  if (x1 < x0 || bottom <= top) return null;

  // المستطيل المقروء: المفقود المحتمل، وفوقه جلدٌ معروف (٠٫٣ من الرقبة)، وحوله قماشٌ ملاصق.
  const rx = Math.max(0, x0 - NEAR);
  const ry = Math.max(0, top - Math.round(lm.neckWidth * 0.3) - NEAR);
  const rw = Math.min(W - 1, x1 + NEAR) - rx + 1;
  const rh = Math.min(H - 1, bottom + NEAR) - ry + 1;
  if (rw * rh > MAX_AREA) return null;
  const n = rw * rh;
  const suit = paintSuit({ x: rx, y: ry, w: rw, h: rh });
  /** شفافية الشخص كما تُرسم (`rebuildSubject`)، وموضعه في الصورة. */
  const shown = (x: number, y: number) => s.alpha[y * W + x]! * keepAbove(s.line, x, y, feather) * skinAt(s.mask, x, y);

  // ١ المفقود: ١ الرقبة في عمودها، ٢ باطن الياقة تحت أعلى الفتحة — حتى أعلى القاط بريشته.
  const kind = new Uint8Array(n);
  const tan = Math.tan((at.angle * Math.PI) / 180);
  let hx0 = W;
  let hx1 = -1;
  let hy0 = H;
  let hy1 = -1;
  for (let x = x0; x <= x1; x++) {
    const inNeck = Math.abs(x - neck.x) <= neck.half;
    const openTop = at.y + (x - at.x) * tan;
    let under = -1;
    for (let y = floor(x); y < bottom; y++) {
      const li = (y - ry) * rw + x - rx;
      if (suit[li * 4 + 3]! >= 128 && under < 0) under = y;
      if (under >= 0 && y > under + feather) break;
      if (!inNeck && y < openTop) continue;
      if (shown(x, y) < 128 && (inNeck || s.alpha[y * W + x]! >= 128)) {
        kind[li] = inNeck ? 1 : 2;
        if (x < hx0) hx0 = x;
        if (x > hx1) hx1 = x;
        if (y < hy0) hy0 = y;
        if (y > hy1) hy1 = y;
      }
    }
  }
  if (hx1 < 0) return null;

  // ٢ الجلد المعروف حوله: معتمٌ كما يُرسم ولونه جلد — يُقرأ ولا يُكتب فيه.
  const known = new Uint8Array(n);
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  let nk = 0;
  for (let y = Math.max(ry, hy0 - Math.round(lm.neckWidth * 0.3)); y <= hy1; y++)
    for (let x = Math.max(rx, hx0 - 3); x <= Math.min(rx + rw - 1, hx1 + 3); x++) {
      const li = (y - ry) * rw + x - rx;
      const i = (y * W + x) * 4;
      if (kind[li] || shown(x, y) < 200 || skinWeight(s.skin, s.pixels[i]!, s.pixels[i + 1]!, s.pixels[i + 2]!) < 0.5) continue;
      known[li] = 1;
      nk++;
      for (let ch = 0; ch < 3; ch++) hist[ch]![s.pixels[i + ch]!]!++;
    }
  if (nk < 30) return null;

  // ٣ الرقبة: وسيط الجلد ثم انتشارٌ من المعروف · وباطن الياقة: وسيط القماش الملاصق في ظلّ، وانتشارٌ قصير من حدّ القاط.
  const col = new Float32Array(n * 3);
  const med = hist.map((h) => median(h, nk));
  const neckIdx: number[] = [];
  const collIdx: number[] = [];
  const inNeck = new Uint8Array(n);
  const inColl = new Uint8Array(n);
  for (let li = 0; li < n; li++) {
    if (kind[li] === 1) {
      neckIdx.push(li);
      inNeck[li] = 1;
      for (let ch = 0; ch < 3; ch++) col[li * 3 + ch] = med[ch]!;
    } else if (kind[li] === 2) {
      collIdx.push(li);
      inColl[li] = 1;
    } else if (known[li]) {
      const i = (((li / rw) | 0) + ry) * W + (li % rw) + rx;
      for (let ch = 0; ch < 3; ch++) col[li * 3 + ch] = s.pixels[i * 4 + ch]!;
    }
  }
  diffuse(rw, col, Int32Array.from(neckIdx), inNeck, known, Math.min(rounds, Math.floor(WORK / Math.max(1, neckIdx.length))));
  if (collIdx.length) {
    const shirt = new Uint8Array(n);
    const sh = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
    let ns = 0;
    for (const li of collIdx) {
      const cx = li % rw;
      const cy = (li / rw) | 0;
      for (let y = Math.max(0, cy - NEAR); y <= Math.min(rh - 1, cy + NEAR); y++)
        for (let x = Math.max(0, cx - NEAR); x <= Math.min(rw - 1, cx + NEAR); x++) {
          const j = y * rw + x;
          if (shirt[j] || kind[j] || suit[j * 4 + 3]! < 200) continue;
          shirt[j] = 1;
          ns++;
          for (let ch = 0; ch < 3; ch++) {
            sh[ch]![suit[j * 4 + ch]!]!++;
            col[j * 3 + ch] = suit[j * 4 + ch]!;
          }
        }
    }
    if (ns) {
      const sm = sh.map((h) => median(h, ns) * SHADE);
      for (const li of collIdx) for (let ch = 0; ch < 3; ch++) col[li * 3 + ch] = sm[ch]!;
      diffuse(rw, col, Int32Array.from(collIdx), inColl, shirt, 6);
    }
  }

  // ٤ نسيج الجلد: انحراف الإضاءة عن متوسّط جيرانها في المعروف — وتشويشٌ به ببذرةٍ ثابتة (نصفه في باطن الياقة).
  const L = (li: number) => {
    const i = ((((li / rw) | 0) + ry) * W + (li % rw) + rx) * 4;
    return 0.299 * s.pixels[i]! + 0.587 * s.pixels[i + 1]! + 0.114 * s.pixels[i + 2]!;
  };
  let ss = 0;
  let sn = 0;
  for (let li = rw + 1; li < n - rw - 1; li++) {
    if (!known[li] || !known[li - 1] || !known[li + 1] || !known[li - rw] || !known[li + rw]) continue;
    const d = L(li) - (L(li - 1) + L(li + 1) + L(li - rw) + L(li + rw)) / 4;
    ss += d * d;
    sn++;
  }
  const sigma = Math.min(GRAIN, sn ? Math.sqrt(ss / sn) : 0);
  const gauss = noise(1);
  const out = { x: hx0, y: hy0, w: hx1 - hx0 + 1, h: hy1 - hy0 + 1 };
  const data = new Uint8ClampedArray(out.w * out.h * 4);
  for (const li of [...neckIdx, ...collIdx]) {
    const g = gauss() * sigma * (inColl[li] ? 0.5 : 1);
    const o = ((((li / rw) | 0) + ry - out.y) * out.w + (li % rw) + rx - out.x) * 4;
    for (let ch = 0; ch < 3; ch++) data[o + ch] = col[li * 3 + ch]! + g;
    data[o + 3] = 255;
  }
  return { ...out, data, neck: neckIdx.length, collar: collIdx.length };
}

/** الوسيط من مدرّجٍ تكراريّ لقناةٍ (٠..٢٥٥). */
function median(h: Uint32Array, n: number): number {
  let c = 0;
  for (let v = 0; v < 256; v++) if ((c += h[v]!) > n >> 1) return v;
  return 255;
}

/** انتشارٌ (Gauss–Seidel، ذهابًا وإيابًا) في `idx` من حدودٍ ثابتة (`fixed`) — والجار الذي ليس منهما لا يُحسب. */
function diffuse(w: number, col: Float32Array, idx: Int32Array, inSet: Uint8Array, fixed: Uint8Array, rounds: number): void {
  const n = inSet.length;
  const m = idx.length;
  // الجيران المحسوبون لكلّ بكسلٍ مرّةً (٤ خاناتٍ، و-١ لما لا يُحسب) — فالحلقة الثقيلة قراءةٌ وجمعٌ وحدهما.
  const nb = new Int32Array(m * 4).fill(-1);
  for (let k = 0; k < m; k++) {
    const i = idx[k]!;
    const x = i % w;
    const ok = (j: number) => j >= 0 && j < n && (inSet[j] === 1 || fixed[j] === 1);
    if (x > 0 && ok(i - 1)) nb[k * 4] = i - 1;
    if (x < w - 1 && ok(i + 1)) nb[k * 4 + 1] = i + 1;
    if (ok(i - w)) nb[k * 4 + 2] = i - w;
    if (ok(i + w)) nb[k * 4 + 3] = i + w;
  }
  for (let it = 0; it < rounds; it++) {
    const back = it % 2 === 1;
    for (let t = 0; t < m; t++) {
      const k = back ? m - 1 - t : t;
      const i = idx[k]!;
      let c = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let q = k * 4; q < k * 4 + 4; q++) {
        const j = nb[q]!;
        if (j < 0) continue;
        c++;
        r += col[j * 3]!;
        g += col[j * 3 + 1]!;
        b += col[j * 3 + 2]!;
      }
      if (c) {
        col[i * 3] = r / c;
        col[i * 3 + 1] = g / c;
        col[i * 3 + 2] = b / c;
      }
    }
  }
}

/** تشويشٌ غاوسيّ من مولّدٍ ببذرة (mulberry32) — كالنموذج الأوّلي. */
function noise(seed: number): () => number {
  let s = seed;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
}
