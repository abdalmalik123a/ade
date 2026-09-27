/**
 * الماسح متعدّد البطاقات (هـ٢) — دوالّ خالصة على البكسلات.
 *
 * الزبون يضع بطاقاته الثلاث على زجاج الماسح معًا: مسحةٌ واحدة، ثم تُعرف كلّ بطاقةٍ
 * وتُقصّ وحدها. ثم تُقلب البطاقات **في أماكنها** وتُمسح ظهورها، فيُطابَق كلّ ظهرٍ
 * بوجهه **من موضعه** — بلا أن يُسأل الموظف أيّها لأيّها.
 *
 * والكشف: غطاء الماسح أبيض، والبطاقة ما ليس غطاءً — حوافّها وألوانها وكتابتها —
 * تُغلق فجواتها وتُملأ ثقوبها فتصير كتلةً واحدة، وما وافق مقاس البطاقة منها بطاقة.
 */
import type { PixelData } from './deskew';

export type Rect = { x: number; y: number; w: number; h: number };

const lum = (d: ArrayLike<number>, i: number) => 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;

/** توسيعٌ ثمّ تآكل بمربّعٍ نصف قطره `r` — يسدّ فجوات الكتابة داخل البطاقة. */
function close(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const pass = (src: Uint8Array, want: 1 | 0) => {
    // أفقيًّا ثم عموديًّا: مربّعٌ منفصل بكلفة خطّية.
    const tmp = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      let run = 0;
      for (let x = -r; x < w + r; x++) {
        const add = x + r < w ? src[y * w + x + r]! === want : false;
        const drop = x - r - 1 >= 0 ? src[y * w + x - r - 1]! === want : false;
        run += (add ? 1 : 0) - (drop ? 1 : 0);
        if (x >= 0 && x < w) tmp[y * w + x] = run > 0 ? want : want ? 0 : 1;
      }
    }
    const out = new Uint8Array(w * h);
    for (let x = 0; x < w; x++) {
      let run = 0;
      for (let y = -r; y < h + r; y++) {
        const add = y + r < h ? tmp[(y + r) * w + x]! === want : false;
        const drop = y - r - 1 >= 0 ? tmp[(y - r - 1) * w + x]! === want : false;
        run += (add ? 1 : 0) - (drop ? 1 : 0);
        if (y >= 0 && y < h) out[y * w + x] = run > 0 ? want : want ? 0 : 1;
      }
    }
    return out;
  };
  return pass(pass(mask, 1), 0);
}

/** الكتل المتّصلة (جوارٌ رباعي) ومستطيلاتها ومساحاتها. */
function components(mask: Uint8Array, w: number, h: number, value: 0 | 1) {
  const label = new Int32Array(w * h).fill(-1);
  const out: { rect: Rect; area: number; touchesEdge: boolean; id: number }[] = [];
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (mask[start] !== value || label[start] !== -1) continue;
    const id = out.length;
    let x0 = w;
    let y0 = h;
    let x1 = 0;
    let y1 = 0;
    let area = 0;
    let edge = false;
    stack.push(start);
    label[start] = id;
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % w;
      const y = (p - x) / w;
      area++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
      for (const q of [p - 1, p + 1, p - w, p + w]) {
        if (q < 0 || q >= w * h) continue;
        if ((q === p - 1 && x === 0) || (q === p + 1 && x === w - 1)) continue;
        if (mask[q] === value && label[q] === -1) {
          label[q] = id;
          stack.push(q);
        }
      }
    }
    out.push({ rect: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }, area, touchesEdge: edge, id });
  }
  return { label, list: out };
}

/**
 * البطاقات في مسحةٍ واحدة — مستطيلاتٌ بإحداثيّات الصورة، مرتّبةً كما تُقرأ الورقة
 * العربية: من الأعلى، ثم من اليمين.
 *
 * `minShare` أصغر بطاقةٍ نسبةً من الصورة (بطاقة ID-1 على زجاج A4 نحو ٧٪)، و`ratio`
 * مدى نسبة الطول إلى العرض (ID-1 = ١٫٥٩، وبطاقة السكن ١٫٤٢).
 */
export function detectCards(px: PixelData, opts: { minShare?: number; ratio?: [number, number] } = {}): Rect[] {
  const { width: W, height: H, data } = px;
  const minShare = opts.minShare ?? 0.03;
  const [rmin, rmax] = opts.ratio ?? [1.2, 1.9];
  const scale = Math.min(1, 700 / Math.max(W, H));
  const w = Math.max(1, Math.round(W * scale));
  const h = Math.max(1, Math.round(H * scale));

  // الغطاء: سطوع أغلب الصورة (النسبة ٧٥) — والبطاقة أغمق منه أو ملوّنة.
  const lums = new Float32Array(w * h);
  const sat = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (Math.min(H - 1, Math.floor(y / scale)) * W + Math.min(W - 1, Math.floor(x / scale))) * 4;
      lums[y * w + x] = lum(data, i);
      const max = Math.max(data[i]!, data[i + 1]!, data[i + 2]!);
      const min = Math.min(data[i]!, data[i + 1]!, data[i + 2]!);
      sat[y * w + x] = max - min;
    }
  }
  const sorted = Array.from(lums).sort((a, b) => a - b);
  const lid = sorted[Math.floor(sorted.length * 0.75)] ?? 255;
  let mask: Uint8Array = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) mask[p] = lums[p]! < lid - 28 || sat[p]! > 40 ? 1 : 0;

  // الكتابة والحوافّ تُوصل، ثم الثقوب البيضاء داخل البطاقة تُملأ.
  mask = close(mask, w, h, Math.max(2, Math.round(Math.min(w, h) * 0.015)));
  const holes = components(mask, w, h, 0);
  for (const hole of holes.list) {
    if (hole.touchesEdge) continue;
    for (let p = 0; p < w * h; p++) if (holes.label[p] === hole.id) mask[p] = 1;
  }

  const found: Rect[] = [];
  for (const c of components(mask, w, h, 1).list) {
    const share = (c.rect.w * c.rect.h) / (w * h);
    if (share < minShare || share > 0.9) continue;
    const ratio = Math.max(c.rect.w, c.rect.h) / Math.min(c.rect.w, c.rect.h);
    if (ratio < rmin || ratio > rmax) continue;
    // ممتلئةٌ كالبطاقة لا كخطٍّ مائل: الكتلة تملأ أغلب مستطيلها.
    if (c.area / (c.rect.w * c.rect.h) < 0.75) continue;
    found.push({
      x: Math.round(c.rect.x / scale),
      y: Math.round(c.rect.y / scale),
      w: Math.round(c.rect.w / scale),
      h: Math.round(c.rect.h / scale)
    });
  }
  const rowTol = H * 0.08;
  return found.sort((a, b) => (Math.abs(a.y - b.y) > rowTol ? a.y - b.y : b.x + b.w - (a.x + a.w)));
}

/**
 * يطابق كلّ ظهرٍ بوجهه من موضعه على الزجاج: أقرب المراكز أوّلًا. والبطاقة المقلوبة في
 * مكانها يبقى مركزها قريبًا من مركز وجهها — ولو انزاحت قليلًا باليد.
 *
 * يعيد لكلّ وجهٍ رقم ظهره (أو `null` إن لم يُمسح له ظهر)، بترتيب الوجوه.
 */
export function matchBacks(fronts: Rect[], backs: Rect[], page: { w: number; h: number }): (number | null)[] {
  const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  const pairs: { f: number; b: number; d: number }[] = [];
  fronts.forEach((fr, f) =>
    backs.forEach((br, b) => {
      const a = center(fr);
      const c = center(br);
      pairs.push({ f, b, d: Math.hypot(a.x - c.x, a.y - c.y) });
    })
  );
  pairs.sort((x, y) => x.d - y.d);
  const out: (number | null)[] = fronts.map(() => null);
  const used = new Set<number>();
  // ظهرٌ أبعد من ربع الورقة عن كلّ وجهٍ ليس ظهرًا لأيٍّ منها: بطاقةٌ غيرها.
  const far = Math.hypot(page.w, page.h) * 0.25;
  for (const p of pairs) {
    if (out[p.f] !== null || used.has(p.b) || p.d > far) continue;
    out[p.f] = p.b;
    used.add(p.b);
  }
  return out;
}

/** هامشٌ صغير حول المقصوص — فلا تُقصّ حافّة البطاقة المستديرة. */
export function padRect(r: Rect, page: { w: number; h: number }, pad = 0.02): Rect {
  const px = Math.round(Math.max(r.w, r.h) * pad);
  // من الحافّتين معًا: ما قُصّ عند حافّة الصورة لا يُزاد على الجهة الأخرى.
  const x = Math.max(0, r.x - px);
  const y = Math.max(0, r.y - px);
  return { x, y, w: Math.min(page.w, r.x + r.w + px) - x, h: Math.min(page.h, r.y + r.h + px) - y };
}
