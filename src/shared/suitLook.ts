/**
 * لون القاط على قدر الصورة — «لمسة الواقعية» (S45، D176، ر174): القاط المستورد أنظف من صورة الزبون، بلا ضجيجها وبإضاءةٍ غير
 * إضاءتها، فيبدو ملصقًا عليها. فيُقاس من **الشخص كما يُرسم** (بعد التحسين، وفي قناعه لا الخلفية):
 * - **الإضاءة** من أعلى إضاءاته (المئين ٩٩: بياض العين واللمعة والقميص — لا لون البشرة): الصورة الخافتة تعتّم القاط، ولا يُفتَّح أبدًا.
 * - **توازن اللون** من محايده (قميصٌ وياقةٌ ورماديّ — تشبّعٌ دون ١٥٪، أضيق من التحسين التلقائي: البشرة الفاتحة نحو ٢٢٪ دافئةٌ
 *   بطبعها لا بضوئها): ما بقي فيه من دفءٍ أو برودة.
 * - **التشويش** من انحراف الإضاءة عن متوسّط جيرانها الأربعة — بوسيطه، فالحوافّ لا تُحسب.
 * ثم يُطبَّق على **صورة القاط وحدها** بحدودٍ معلنة: يُعتَّم ٢٠٪ على الأكثر، ولونه ±٤٪ لكلّ قناة (كسبٌ يضرب — فالأسود لا يصير
 * أزرق)، ويُزاد تشويشه بقدر ما ينقص عن الصورة ببذرةٍ ثابتة (الرسم نفسه في كلّ مرّة). والشخص والوجه لا يُمسّان (ر023).
 *
 * حسابٌ خالص (يُختبر بلا متصفّح)؛ والرسم يضع القاط المعدَّل بدل صورته (`setSuitLook` في `portraitCanvas`).
 */
import { gaussNoise } from './neckFill';

type Px = Uint8Array | Uint8ClampedArray;

/** كسب القنوات (الإضاءة × التوازن) وتشويش الصورة (انحرافٌ معياريّ بمستويات ٠..٢٥٥ في بكسل الصورة). */
export type Look = { gains: [number, number, number]; grain: number };

export const NO_LOOK: Look = { gains: [1, 1, 1], grain: 0 };

/** أعلى إضاءةٍ في صورةٍ حسنة التعريض (المئين ٩٩)، وأقصى تعتيم، وأقصى ميلٍ لكلّ قناة، وأقصى تشويش. */
const BRIGHT = 235;
const DIM = 0.8;
const CAST = 0.04;
const GRAIN_MAX = 8;
const NEUTRAL = 0.15;
/** عيّنةٌ لا تتجاوز ربع مليون بكسل — فالصورة الكبيرة لا تُبطئ القياس. */
const SAMPLES = 250_000;

const lum = (px: Px, i: number) => 0.299 * px[i * 4]! + 0.587 * px[i * 4 + 1]! + 0.114 * px[i * 4 + 2]!;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * التشويش: انحراف إضاءة البكسل عن متوسّط جيرانه الأربعة، في المعتم وحده (`opaque`) — وسيطه المطلق ×١٫٤٨٢٦ تقديرٌ للانحراف
 * المعياريّ لا تفسده الحوافّ، مقسومًا على ١٫١١٨ (انحراف الفرق لتشويشٍ مستقلٍّ في البكسلات الخمسة).
 */
export function grainOf(px: Px, width: number, height: number, opaque: (i: number) => boolean): number {
  const step = Math.max(1, Math.round(Math.sqrt((width * height) / SAMPLES)));
  const ds: number[] = [];
  for (let y = 1; y < height - 1; y += step)
    for (let x = 1; x < width - 1; x += step) {
      const i = y * width + x;
      if (!opaque(i) || !opaque(i - 1) || !opaque(i + 1) || !opaque(i - width) || !opaque(i + width)) continue;
      ds.push(Math.abs(lum(px, i) - (lum(px, i - 1) + lum(px, i + 1) + lum(px, i - width) + lum(px, i + width)) / 4));
    }
  if (ds.length < 100) return 0;
  const sorted = Float32Array.from(ds).sort();
  return (sorted[sorted.length >> 1]! * 1.4826) / 1.118;
}

/** المقياس من الشخص كما يُرسم وقناعه (٢٥٠ فأكثر) — و`NO_LOOK` إن قلّ (أقلّ من ألف بكسل). */
export function photoLook(px: Px, alpha: Uint8Array, width: number, height: number): Look {
  const step = Math.max(1, Math.round(Math.sqrt((width * height) / SAMPLES)));
  const hist = new Uint32Array(256);
  let n = 0;
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let neutral = 0;
  for (let y = 0; y < height; y += step)
    for (let x = 0; x < width; x += step) {
      const i = y * width + x;
      if (alpha[i]! < 250) continue;
      const L = lum(px, i);
      hist[Math.round(L)]!++;
      n++;
      const r = px[i * 4]! / 255;
      const g = px[i * 4 + 1]! / 255;
      const b = px[i * 4 + 2]! / 255;
      const mx = Math.max(r, g, b);
      if (L > 0.15 * 255 && L < 0.95 * 255 && mx - Math.min(r, g, b) < NEUTRAL * mx) {
        sr += r;
        sg += g;
        sb += b;
        neutral++;
      }
    }
  if (n < 1000) return NO_LOOK;
  let c = 0;
  let p99 = 255;
  for (let v = 0; v < 256; v++) if ((c += hist[v]!) >= n * 0.99) {
    p99 = v;
    break;
  }
  const dim = clamp(p99 / BRIGHT, DIM, 1);
  const m = (sr + sg + sb) / 3;
  const cast = (s: number) => (neutral >= n / 100 && m > 0 ? clamp(s / m, 1 - CAST, 1 + CAST) : 1);
  const opaque = (i: number) => alpha[i]! >= 250;
  return { gains: [dim * cast(sr), dim * cast(sg), dim * cast(sb)], grain: Math.min(GRAIN_MAX, grainOf(px, width, height, opaque)) };
}

/**
 * صورة القاط بلون الصورة — نسخةٌ والأصل لا يُمسّ، والشفافية كما هي. `scale` مقياس القاط في الصورة: يُصغَّر فيُنعَّم تشويشه،
 * فيُزاد قبل التصغير بقدره (لا بعد التكبير).
 */
export function applyLook(rgba: Px, width: number, height: number, look: Look, scale = 1, seed = 1): Uint8ClampedArray {
  const own = grainOf(rgba, width, height, (i) => rgba[i * 4 + 3]! >= 250);
  const add = Math.sqrt(Math.max(0, look.grain ** 2 - own ** 2)) / Math.min(1, Math.max(0.05, scale));
  const gauss = gaussNoise(seed);
  const out = new Uint8ClampedArray(rgba.length);
  const [gr, gg, gb] = look.gains;
  for (let o = 0; o < rgba.length; o += 4) {
    out[o + 3] = rgba[o + 3]!;
    if (!rgba[o + 3]) continue;
    const g = add ? gauss() * add : 0;
    out[o] = rgba[o]! * gr + g;
    out[o + 1] = rgba[o + 1]! * gg + g;
    out[o + 2] = rgba[o + 2]! * gb + g;
  }
  return out;
}
