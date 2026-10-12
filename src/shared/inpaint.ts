/**
 * «رمّم» (البند ٤٠) — المحرّك الواحد لما يُملأ من جواره: ما تُمسح عليه الفرشاة يُملأ **بلون الجوار وملمسه** بحافّةٍ ناعمة.
 * وعليه يُبنى «أكمل الرقبة» (٤١) و«أزل الشوائب» (٤٢) و«احذف من الصورة» (٤٥).
 *
 * الطريقة طريقة «الملء بمراعاة المحتوى» في برامج الصور (Wexler ٢٠٠٧ بالبحث السريع PatchMatch، Barnes ٢٠٠٩): الحفرة تُملأ
 * برقعٍ صغيرة (٧×٧) **منقولةٍ من الجوار** — فيبقى ملمس الجلد أو القماش أو الجدار لا لطخةٌ ناعمة — على عدّة مقاييس من
 * الأصغر إلى الأكبر (الشكل العامّ أوّلًا ثم التفاصيل)، وكلّ بكسلٍ في الحفرة متوسّطُ ما تقترحه الرقعُ التي تغطّيه موزونًا بقربها.
 * والملء في مستطيلٍ حول الحفرة وحده (فيُؤخذ من الجوار القريب)، و`allow` يحصر ما يُؤخذ منه (في الصور الشخصية: تحت الذقن
 * وحده — فلا يُنقل من الوجه شيء). وشفافية الفرشاة الناعمة تمزج الملء بالأصل على حافّتها.
 *
 * حسابٌ خالص على البكسلات (يُختبر بلا متصفّح)، يكتب في الألوان مكانها ويعود بالمستطيل الذي تغيّر.
 */

export type Rect = { x: number; y: number; w: number; h: number };
export type InpaintOptions = {
  /** ما يجوز أن يُؤخذ منه (١) بمقاس الصورة — وبلا قيدٍ إن غاب. */
  allow?: Uint8Array;
  /** نصف ضلع الرقعة (٣ ← ٧×٧). */
  radius?: number;
  /** بذرة العشوائية — فالنتيجة نفسها في كلّ مرّة (للاختبار وللتراجع ثم الإعادة). */
  seed?: number;
};

type Px = Uint8Array | Uint8ClampedArray;
const CH = 4;

/** مقياسٌ من الهرم: الألوان (٤ قنوات) وما يُملأ وما يُؤخذ منه. */
type Level = { w: number; h: number; img: Float32Array; hole: Uint8Array; src: Uint8Array };

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** نصف المقياس: الألوان بمتوسّط ٢×٢ (المعروف وحده)، والحفرة ما مسّت شيئًا منه، والمصدر ما سلمت أربعته. */
function half(l: Level): Level {
  const w = Math.max(1, l.w >> 1);
  const h = Math.max(1, l.h >> 1);
  const img = new Float32Array(w * h * CH);
  const hole = new Uint8Array(w * h);
  const src = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = y * w + x;
      let n = 0;
      let holes = 0;
      let srcs = 0;
      const acc = [0, 0, 0, 0];
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const xx = Math.min(l.w - 1, 2 * x + dx);
          const yy = Math.min(l.h - 1, 2 * y + dy);
          const i = yy * l.w + xx;
          if (l.hole[i]) holes++;
          else {
            for (let c = 0; c < CH; c++) acc[c] += l.img[i * CH + c]!;
            n++;
          }
          if (l.src[i]) srcs++;
        }
      }
      hole[o] = holes ? 1 : 0;
      src[o] = srcs === 4 ? 1 : 0;
      for (let c = 0; c < CH; c++) img[o * CH + c] = n ? acc[c]! / n : 0;
    }
  }
  return { w, h, img, hole, src };
}

/** ملءٌ أوّليّ بالتقشير: كلّ حلقةٍ من حافّة الحفرة إلى داخلها متوسّطُ جيرانها المعروفين — لونٌ ناعمٌ يبدأ منه البحث. */
function peel(l: Level): void {
  const known = new Uint8Array(l.w * l.h);
  for (let i = 0; i < known.length; i++) known[i] = l.hole[i] ? 0 : 1;
  let left = known.reduce((s, v) => s + (v ? 0 : 1), 0);
  for (let guard = 0; left > 0 && guard < l.w + l.h; guard++) {
    const ring: number[] = [];
    for (let y = 0; y < l.h; y++) {
      for (let x = 0; x < l.w; x++) {
        const i = y * l.w + x;
        if (known[i]) continue;
        const acc = [0, 0, 0, 0];
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= l.w || yy >= l.h || !known[yy * l.w + xx]) continue;
            for (let c = 0; c < CH; c++) acc[c] += l.img[(yy * l.w + xx) * CH + c]!;
            n++;
          }
        }
        if (!n) continue;
        for (let c = 0; c < CH; c++) l.img[i * CH + c] = acc[c]! / n;
        ring.push(i);
      }
    }
    if (!ring.length) break;
    for (const i of ring) known[i] = 1;
    left -= ring.length;
  }
}

/**
 * مراكز الرقع التي يُؤخذ منها: الرقعة كلّها داخل المقياس، وكلّ بكسلٍ فيها مصدرٌ معروفٌ مسموح — بصورةٍ تكامليّة لعدد غير
 * المسموح في كلّ نافذة.
 */
function sourceCenters(l: Level, r: number): { ok: Uint8Array; list: Int32Array } {
  const W = l.w + 1;
  const bad = new Int32Array(W * (l.h + 1));
  for (let y = 0; y < l.h; y++) {
    let row = 0;
    for (let x = 0; x < l.w; x++) {
      const i = y * l.w + x;
      row += l.src[i] && !l.hole[i] ? 0 : 1;
      bad[(y + 1) * W + x + 1] = bad[y * W + x + 1]! + row;
    }
  }
  const ok = new Uint8Array(l.w * l.h);
  const list: number[] = [];
  for (let y = r; y < l.h - r; y++) {
    for (let x = r; x < l.w - r; x++) {
      const n = bad[(y + r + 1) * W + x + r + 1]! - bad[(y - r) * W + x + r + 1]! - bad[(y + r + 1) * W + x - r]! + bad[(y - r) * W + x - r]!;
      if (!n) {
        ok[y * l.w + x] = 1;
        list.push(y * l.w + x);
      }
    }
  }
  return { ok, list: Int32Array.from(list) };
}

/** الرقع التي تمسّ الحفرة: مراكزها داخلها أو على بعد نصف ضلعٍ منها، داخل المقياس. */
function targets(l: Level, r: number): Int32Array {
  const near = new Uint8Array(l.w * l.h);
  for (let y = 0; y < l.h; y++) {
    for (let x = 0; x < l.w; x++) {
      if (!l.hole[y * l.w + x]) continue;
      for (let yy = Math.max(r, y - r); yy <= Math.min(l.h - 1 - r, y + r); yy++) for (let xx = Math.max(r, x - r); xx <= Math.min(l.w - 1 - r, x + r); xx++) near[yy * l.w + xx] = 1;
    }
  }
  const out: number[] = [];
  for (let i = 0; i < near.length; i++) if (near[i]) out.push(i);
  return Int32Array.from(out);
}

/** بُعد رقعتين (مجموع مربّعات الفروق) — ويقف حين يتجاوز `limit`. */
function dist(img: Float32Array, w: number, r: number, a: number, b: number, limit: number): number {
  let d = 0;
  for (let dy = -r; dy <= r; dy++) {
    const ra = (a + dy * w) * CH;
    const rb = (b + dy * w) * CH;
    for (let dx = -r * CH; dx <= r * CH; dx++) {
      const e = img[ra + dx]! - img[rb + dx]!;
      d += e * e;
    }
    if (d >= limit) return d;
  }
  return d;
}

/** خطوة الملء على مقياس: البحث (انتشارٌ من الجار وبحثٌ عشوائيّ يضيق) ثم التصويت — `iters` مرّات. */
function solve(l: Level, r: number, nnf: Int32Array, tg: Int32Array, centers: { ok: Uint8Array; list: Int32Array }, iters: number, rand: () => number): void {
  const { w, h, img } = l;
  const n = tg.length;
  const cost = new Float64Array(n);
  const index = new Int32Array(w * h).fill(-1);
  for (let k = 0; k < n; k++) index[tg[k]!] = k;
  const area = (2 * r + 1) * (2 * r + 1) * CH;
  const pick = () => centers.list[Math.floor(rand() * centers.list.length)]!;
  for (let it = 0; it < iters; it++) {
    for (let k = 0; k < n; k++) cost[k] = dist(img, w, r, tg[k]!, nnf[k]!, Infinity);
    // البحث: ثلاث جولاتٍ بالتناوب (من الأعلى يمينًا ثم من الأسفل يسارًا).
    for (let pass = 0; pass < 3; pass++) {
      const fwd = pass % 2 === 0;
      for (let kk = 0; kk < n; kk++) {
        const k = fwd ? kk : n - 1 - kk;
        const p = tg[k]!;
        const px = p % w;
        const step = fwd ? -1 : 1;
        const tryC = (s: number) => {
          if (s < 0 || s >= w * h || !centers.ok[s] || s === nnf[k]) return;
          const d = dist(img, w, r, p, s, cost[k]!);
          if (d < cost[k]!) {
            cost[k] = d;
            nnf[k] = s;
          }
        };
        // الانتشار: ما وجده الجار يُزاح خطوة.
        const left = px + step >= 0 && px + step < w ? index[p + step]! : -1;
        if (left >= 0) tryC(nnf[left]! - step);
        const up = index[p + step * w] ?? -1;
        if (up >= 0) tryC(nnf[up]! - step * w);
        // البحث العشوائيّ حول الأفضل بنصف قطرٍ يتنصّف.
        const s0 = nnf[k]!;
        const sx = s0 % w;
        const sy = (s0 - sx) / w;
        for (let rad = Math.max(w, h); rad >= 1; rad >>= 1) {
          const x = Math.round(sx + (rand() * 2 - 1) * rad);
          const y = Math.round(sy + (rand() * 2 - 1) * rad);
          if (x >= 0 && y >= 0 && x < w && y < h) tryC(y * w + x);
        }
        if (!centers.ok[nnf[k]!]) nnf[k] = pick();
      }
    }
    // التصويت: كلّ بكسلٍ في الحفرة متوسّط ما تقترحه الرقع التي تغطّيه، والأقرب أثقل.
    const acc = new Float64Array(w * h * CH);
    const wsum = new Float64Array(w * h);
    let mean = 0;
    for (let k = 0; k < n; k++) mean += cost[k]! / area;
    const sigma2 = Math.max(4, mean / Math.max(1, n));
    for (let k = 0; k < n; k++) {
      const p = tg[k]!;
      const s = nnf[k]!;
      const wt = Math.exp(-cost[k]! / area / (2 * sigma2));
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const q = p + dy * w + dx;
          if (!l.hole[q]) continue;
          const sq = (s + dy * w + dx) * CH;
          for (let c = 0; c < CH; c++) acc[q * CH + c] += img[sq + c]! * wt;
          wsum[q] += wt;
        }
      }
    }
    for (let q = 0; q < w * h; q++) if (l.hole[q] && wsum[q]! > 0) for (let c = 0; c < CH; c++) img[q * CH + c] = acc[q * CH + c]! / wsum[q]!;
  }
}

/**
 * يملأ ما في `hole` (٠..٢٥٥ بمقاس الصورة: ما فوق ١٢٧ يُملأ، وما دونه حافّةٌ تمتزج) من جواره — في الألوان مكانها — ويعود
 * بالمستطيل الذي تغيّر، أو `null` إن لم يكن في القناع شيء.
 */
export function inpaint(pixels: Px, width: number, height: number, hole: Uint8Array, opts: InpaintOptions = {}): Rect | null {
  const r = opts.radius ?? 3;
  let bx0 = width;
  let by0 = height;
  let bx1 = -1;
  let by1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!hole[y * width + x]) continue;
      if (x < bx0) bx0 = x;
      if (x > bx1) bx1 = x;
      if (y < by0) by0 = y;
      if (y > by1) by1 = y;
    }
  }
  if (bx1 < 0) return null;
  // المستطيل حول الحفرة: بقدرها من كلّ جهة (والصغيرة جدًّا بستّة عشر بكسلًا) — فالملء من الجوار القريب.
  const margin = Math.max(16, Math.round(Math.max(bx1 - bx0, by1 - by0) * 1.0)) + r;
  const cx0 = Math.max(0, bx0 - margin);
  const cy0 = Math.max(0, by0 - margin);
  const cw = Math.min(width, bx1 + margin + 1) - cx0;
  const ch = Math.min(height, by1 + margin + 1) - cy0;
  const base: Level = { w: cw, h: ch, img: new Float32Array(cw * ch * CH), hole: new Uint8Array(cw * ch), src: new Uint8Array(cw * ch) };
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const i = (cy0 + y) * width + cx0 + x;
      const o = y * cw + x;
      for (let c = 0; c < CH; c++) base.img[o * CH + c] = pixels[i * CH + c]!;
      base.hole[o] = hole[i]! > 0 ? 1 : 0;
      base.src[o] = !opts.allow || opts.allow[i] ? 1 : 0;
    }
  }
  // الهرم حتى تصير الحفرة رقعتين أو أقلّ.
  const levels = [base];
  while (true) {
    const top = levels[levels.length - 1]!;
    const holeSize = Math.max(bx1 - bx0 + 1, by1 - by0 + 1) / 2 ** (levels.length - 1);
    if (holeSize <= 2 * (2 * r + 1) || top.w < 4 * (2 * r + 1) || top.h < 4 * (2 * r + 1)) break;
    levels.push(half(top));
  }
  const rand = rng(opts.seed ?? 0x9e3779b9);
  peel(levels[levels.length - 1]!);
  let nnf: Int32Array | null = null;
  let prevTg: Int32Array | null = null;
  let prev: Level | null = null;
  for (let li = levels.length - 1; li >= 0; li--) {
    const l = levels[li]!;
    if (prev) {
      // ما في الحفرة يبدأ من المقياس الأصغر مكبَّرًا.
      for (let y = 0; y < l.h; y++) {
        for (let x = 0; x < l.w; x++) {
          const o = y * l.w + x;
          if (!l.hole[o]) continue;
          const po = Math.min(prev.h - 1, y >> 1) * prev.w + Math.min(prev.w - 1, x >> 1);
          for (let c = 0; c < CH; c++) l.img[o * CH + c] = prev.img[po * CH + c]!;
        }
      }
    }
    const centers = sourceCenters(l, r);
    const tg = targets(l, r);
    if (!centers.list.length || !tg.length) {
      if (!prev) peel(l);
      prev = l;
      nnf = null;
      prevTg = null;
      continue;
    }
    const next = new Int32Array(tg.length);
    // الخريطة من المقياس الأصغر مضاعفةً، وما لا يصلح منها عشوائيّ.
    const old = new Map<number, number>();
    if (nnf && prevTg && prev) for (let k = 0; k < prevTg.length; k++) old.set(prevTg[k]!, nnf[k]!);
    for (let k = 0; k < tg.length; k++) {
      const p = tg[k]!;
      let s = -1;
      if (prev && old.size) {
        const x = p % l.w;
        const y = (p - x) / l.w;
        const ps = old.get(Math.min(prev.h - 1, y >> 1) * prev.w + Math.min(prev.w - 1, x >> 1));
        if (ps !== undefined) {
          const sx = (ps % prev.w) * 2 + (x & 1);
          const sy = Math.floor(ps / prev.w) * 2 + (y & 1);
          if (sx < l.w && sy < l.h && centers.ok[sy * l.w + sx]) s = sy * l.w + sx;
        }
      }
      next[k] = s >= 0 ? s : centers.list[Math.floor(rand() * centers.list.length)]!;
    }
    solve(l, r, next, tg, centers, li === levels.length - 1 ? 6 : li === 0 ? 2 : 4, rand);
    nnf = next;
    prevTg = tg;
    prev = l;
  }
  // في المقياس الأكبر: كلّ بكسلٍ في الحفرة يأخذ مركزَ رقعته الأقرب كما هو — فالمتوسّط لا ينعّم الملمس (حبّة الجلد والقماش).
  if (nnf && prevTg && prev === base) {
    for (let k = 0; k < prevTg.length; k++) {
      const p = prevTg[k]!;
      if (!base.hole[p]) continue;
      for (let c = 0; c < CH; c++) base.img[p * CH + c] = base.img[nnf[k]! * CH + c]!;
    }
  }
  // الكتابة: الملء ممزوجًا بالأصل بشفافية الفرشاة — فالحافّة ناعمة.
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const i = (cy0 + y) * width + cx0 + x;
      const m = hole[i]! / 255;
      if (!m) continue;
      const o = (y * cw + x) * CH;
      for (let c = 0; c < CH; c++) pixels[i * CH + c] = Math.round(base.img[o + c]! * m + pixels[i * CH + c]! * (1 - m));
    }
  }
  return { x: bx0, y: by0, w: bx1 - bx0 + 1, h: by1 - by0 + 1 };
}
