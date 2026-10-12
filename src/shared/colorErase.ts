/**
 * «امسح لونًا» (البند ٣٨) — ضغطةٌ على لونٍ تزيله من القناع: ما قارب لونَ الضغطة بقدر **السماحية** (أقصى فرقٍ في قناةٍ
 * واحدة من ٢٥٥، كممحاة Photoshop السحرية) يصير شفّافًا — **المتّصل** بموضع الضغطة وحده، أو **الصورة كلّها** (لما بين
 * الحروف وداخل الحلقات).
 *
 * و**تنعيم الحافّة**: البكسلات حول ما مُسح مزيجٌ من اللون والشيء (حافّةٌ ناعمة الطباعة أو ضبابية الهاتف) — فيُحلّ كلٌّ
 * منها إلى نسبة الشيء فيه (شفافيّته) ولون الشيء من جواره المعتم، فلا تبقى حول الشعار هالةٌ بلون البطاقة. وبلا تنعيمٍ
 * يُمسح ما في السماحية وحده بحافّةٍ حادّة.
 *
 * و**يُقترح وحده** (`leftoverBorder`) إن بقيت حوافّ الصورة بعد التفريغ لونًا واحدًا: شعارٌ على بطاقةٍ بيضاء عدّ النموذجُ
 * البطاقةَ كلّها «الشيء» فبقيت.
 *
 * حسابٌ خالص على البكسلات (يُختبر بلا متصفّح): يكتب في القناع والألوان في مكانهما ويعود بما كان فيهما قبله (`EraseUndo`)
 * — فالتراجع وإعادة الضغطة بسماحيةٍ أخرى (المعاينة الحيّة) يعيدان ما تغيّر وحده. **ولا يرتفع بكسلٌ في القناع أبدًا**: ما
 * أخفاه النموذج أو الفرشاة يبقى مخفيًّا، وما بعيدًا عن اللون لا يُمسّ.
 */

export type Rgb = [number, number, number];
export type Rect = { x: number; y: number; w: number; h: number };
export type EraseOptions = {
  /** أقصى فرقٍ في قناةٍ واحدة (٠–٢٥٥) ليُعدّ البكسل من اللون. */
  tolerance: number;
  /** المتّصل بموضع الضغطة وحده، أو كلّ ما في الصورة من اللون. */
  contiguous: boolean;
  /** عرض الحافّة التي تُحلّ مزيجًا (بكسلات الصورة العاملة) — ٠ حافّةٌ حادّة. */
  smooth: number;
};
export const ERASE_DEFAULTS: EraseOptions = { tolerance: 32, contiguous: true, smooth: 2 };
export const SMOOTH_MAX = 4;

/** ما كان في القناع والألوان قبل المسح — لما تغيّر وحده، ومستطيله. */
export type EraseUndo = { idx: Uint32Array; alpha: Uint8Array; rgb: Uint8Array; rect: Rect };

type Px = Uint8Array | Uint8ClampedArray;

/** دون هذا من الشفافية (في القناع أو في الأصل الشفّاف) لا يُرى البكسل — فلا يُعبر ولا يُعدّ. */
const VISIBLE = 16;
const visible = (pixels: Px, alpha: Uint8Array, i: number) => alpha[i]! >= VISIBLE && pixels[i * 4 + 3]! >= VISIBLE;

/** فرق اللون: أقصى فرقٍ في قناة — كالسماحية في برامج الصور. */
export function colorDistance(pixels: Px, i: number, c: Rgb): number {
  const p = i * 4;
  return Math.max(Math.abs(pixels[p]! - c[0]), Math.abs(pixels[p + 1]! - c[1]), Math.abs(pixels[p + 2]! - c[2]));
}

/** لون الضغطة: وسيط ٣×٣ المرئيّ حولها — فلا تحرفه نقطة ضجيجٍ في صورة الهاتف. و`null` على ما لا يُرى. */
export function sampleColor(pixels: Px, alpha: Uint8Array, width: number, height: number, x: number, y: number): Rgb | null {
  const cx = Math.round(x);
  const cy = Math.round(y);
  if (cx < 0 || cy < 0 || cx >= width || cy >= height || !visible(pixels, alpha, cy * width + cx)) return null;
  const ch: number[][] = [[], [], []];
  for (let yy = Math.max(0, cy - 1); yy <= Math.min(height - 1, cy + 1); yy++) {
    for (let xx = Math.max(0, cx - 1); xx <= Math.min(width - 1, cx + 1); xx++) {
      const i = yy * width + xx;
      if (!visible(pixels, alpha, i)) continue;
      for (let c = 0; c < 3; c++) ch[c]!.push(pixels[i * 4 + c]!);
    }
  }
  return ch.map((v) => v.sort((a, b) => a - b)[v.length >> 1]!) as Rgb;
}

/**
 * ما يُمسح: المرئيّ في السماحية من اللون — المتّصل بالبذور (جوارٌ رباعيّ: لا يتسرّب من زاويةٍ بين حرفين)، أو كلّه.
 * والبذور نفسها منه ما رُئيت (موضع الضغطة يُمسح ولو أبعده الضجيج عن وسيط جواره). ويعود بالقائمة ومستطيلها.
 */
export function colorRegion(pixels: Px, alpha: Uint8Array, width: number, height: number, seeds: number[], color: Rgb, tolerance: number, contiguous: boolean): { sel: Uint8Array; list: Uint32Array; rect: Rect | null } {
  const n = width * height;
  const sel = new Uint8Array(n);
  const near = (i: number) => visible(pixels, alpha, i) && colorDistance(pixels, i, color) <= tolerance;
  const list = new Uint32Array(n);
  let count = 0;
  for (const s of seeds) {
    if (s < 0 || s >= n || sel[s] || !visible(pixels, alpha, s)) continue;
    sel[s] = 1;
    list[count++] = s;
  }
  if (contiguous) {
    // القائمة نفسها صفّ الانتظار: ما أُضيف يُفحص جيرانه بعده.
    for (let k = 0; k < count; k++) {
      const i = list[k]!;
      const x = i % width;
      const tryAdd = (j: number) => {
        if (!sel[j] && near(j)) {
          sel[j] = 1;
          list[count++] = j;
        }
      };
      if (x > 0) tryAdd(i - 1);
      if (x < width - 1) tryAdd(i + 1);
      if (i >= width) tryAdd(i - width);
      if (i + width < n) tryAdd(i + width);
    }
  } else {
    for (let i = 0; i < n; i++) {
      if (!sel[i] && near(i)) {
        sel[i] = 1;
        list[count++] = i;
      }
    }
  }
  if (!count) return { sel, list: list.subarray(0, 0), rect: null };
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let k = 0; k < count; k++) {
    const i = list[k]!;
    const x = i % width;
    const y = (i - x) / width;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { sel, list: list.subarray(0, count), rect: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } };
}

/** سجلّ ما تغيّر: الفهرس والشفافية والألوان قبل التغيير — بسعة ما قد يتغيّر (المختار وحافّته). */
class Changes {
  idx: Uint32Array;
  alpha: Uint8Array;
  rgb: Uint8Array;
  n = 0;
  constructor(capacity: number) {
    this.idx = new Uint32Array(capacity);
    this.alpha = new Uint8Array(capacity);
    this.rgb = new Uint8Array(capacity * 3);
  }
  push(i: number, a: number, pixels: Px): void {
    this.idx[this.n] = i;
    this.alpha[this.n] = a;
    this.rgb[this.n * 3] = pixels[i * 4]!;
    this.rgb[this.n * 3 + 1] = pixels[i * 4 + 1]!;
    this.rgb[this.n * 3 + 2] = pixels[i * 4 + 2]!;
    this.n++;
  }
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * يمسح اللون من البذور (فهارس بكسلات) بخياراته — في القناع والألوان مكانهما — ويعود بما كان قبله، أو `null` إن لم يكن
 * في الموضع شيءٌ من اللون يُرى.
 */
export function eraseColor(pixels: Px, alpha: Uint8Array, width: number, height: number, seeds: number[], color: Rgb, opts: EraseOptions): EraseUndo | null {
  const tol = Math.max(0, Math.min(255, opts.tolerance));
  const { sel, list, rect } = colorRegion(pixels, alpha, width, height, seeds, color, tol, opts.contiguous);
  if (!rect) return null;
  const R = Math.max(0, Math.min(SMOOTH_MAX, Math.round(opts.smooth)));
  // ١. الحافّة: المرئيّ غير الممسوح حول حدّ ما يُمسح، بعرض التنعيم.
  const band: number[] = [];
  if (R > 0) {
    for (const i of list) {
      const x = i % width;
      const y = (i - x) / width;
      const edge = (x > 0 && !sel[i - 1]) || (x < width - 1 && !sel[i + 1]) || (y > 0 && !sel[i - width]) || (y < height - 1 && !sel[i + width]);
      if (!edge) continue;
      for (let yy = Math.max(0, y - R); yy <= Math.min(height - 1, y + R); yy++) {
        for (let xx = Math.max(0, x - R); xx <= Math.min(width - 1, x + R); xx++) {
          const j = yy * width + xx;
          if (sel[j] || !visible(pixels, alpha, j)) continue;
          sel[j] = 2;
          band.push(j);
        }
      }
    }
  }
  const ch = new Changes(list.length + band.length);
  // ٢. الحافّة أوّلًا (من الألوان الأصلية قبل أن يُمسّ شيء): كلّ بكسلٍ مزيجٌ من اللون (B) والشيء (F، متوسّط جواره المعتم
  // الذي لم يُمسح) — نسبة الشيء فيه إسقاطُ لونه على الخطّ بينهما، ولونه بعد نزع اللون منه.
  const r2 = R + 2;
  const nb = band.length;
  const outA = new Int16Array(nb).fill(-1);
  const outC = new Uint8Array(nb * 3);
  const [br, bgc, bb] = color;
  const soft = Math.max(8, tol);
  for (let k = 0; k < nb; k++) {
    const i = band[k]!;
    const x = i % width;
    const y = (i - x) / width;
    let fr = 0;
    let fg = 0;
    let fb = 0;
    let fw = 0;
    for (let yy = Math.max(0, y - r2); yy <= Math.min(height - 1, y + r2); yy++) {
      for (let xx = Math.max(0, x - r2), row = yy * width; xx <= Math.min(width - 1, x + r2); xx++) {
        const j = row + xx;
        if (sel[j] || alpha[j]! < 250 || pixels[j * 4 + 3]! < 250) continue;
        fr += pixels[j * 4]!;
        fg += pixels[j * 4 + 1]!;
        fb += pixels[j * 4 + 2]!;
        fw++;
      }
    }
    const pr = pixels[i * 4]!;
    const pg = pixels[i * 4 + 1]!;
    const pb = pixels[i * 4 + 2]!;
    let a = clamp01((Math.max(Math.abs(pr - br), Math.abs(pg - bgc), Math.abs(pb - bb)) - tol) / soft);
    if (fw) {
      fr /= fw;
      fg /= fw;
      fb /= fw;
      const ur = fr - br;
      const ug = fg - bgc;
      const ub = fb - bb;
      const span = Math.max(Math.abs(ur), Math.abs(ug), Math.abs(ub));
      if (span > Math.max(16, tol)) {
        // ضجيج الصورة بنصف السماحية لا يُحسب مزيجًا: ما قارب الشيء معتمٌ تمامًا، وما قارب اللون شفّافٌ تمامًا.
        const eps = Math.min(0.15, tol / 2 / span);
        a = clamp01(((pr - br) * ur + (pg - bgc) * ug + (pb - bb) * ub) / (ur * ur + ug * ug + ub * ub));
        a = clamp01((a - eps) / (1 - 2 * eps));
        // لونٌ ثالث لا يفسّره المزيج (خطٌّ بلونٍ آخر على الحافّة): يبقى بقدر ما بعُد عن المزيج.
        const res = Math.max(Math.abs(pr - (br + a * ur)), Math.abs(pg - (bgc + a * ug)), Math.abs(pb - (bb + a * ub)));
        a = Math.max(a, clamp01((res - tol) / soft));
      }
    }
    const na = Math.min(alpha[i]!, Math.round(a * 255));
    if (na >= alpha[i]!) continue;
    outA[k] = na;
    // لون الشيء وحده: يُحلّ من المزيج، ويُمال إلى جواره حين يقلّ نصيبه (الحلّ يضعف بالقسمة على صغير).
    const t = fw ? clamp01((a - 0.3) / 0.5) : 1;
    const solve = (v: number, b: number, f: number) => {
      const solved = a > 0.02 ? Math.max(0, Math.min(255, (v - (1 - a) * b) / a)) : v;
      return Math.round(f * (1 - t) + solved * t);
    };
    outC[k * 3] = solve(pr, br, fr);
    outC[k * 3 + 1] = solve(pg, bgc, fg);
    outC[k * 3 + 2] = solve(pb, bb, fb);
  }
  for (let k = 0; k < nb; k++) {
    if (outA[k]! < 0) continue;
    const i = band[k]!;
    ch.push(i, alpha[i]!, pixels);
    alpha[i] = outA[k]!;
    pixels[i * 4] = outC[k * 3]!;
    pixels[i * 4 + 1] = outC[k * 3 + 1]!;
    pixels[i * 4 + 2] = outC[k * 3 + 2]!;
  }
  // ٣. ما في السماحية يصير شفّافًا — وألوانه كما هي، فما تعيده «أبقِ» يعود بلونه.
  for (const i of list) {
    if (!alpha[i]) continue;
    ch.push(i, alpha[i]!, pixels);
    alpha[i] = 0;
  }
  const x0 = Math.max(0, rect.x - R);
  const y0 = Math.max(0, rect.y - R);
  const box = { x: x0, y: y0, w: Math.min(width, rect.x + rect.w + R) - x0, h: Math.min(height, rect.y + rect.h + R) - y0 };
  return { idx: ch.idx.slice(0, ch.n), alpha: ch.alpha.slice(0, ch.n), rgb: ch.rgb.slice(0, ch.n * 3), rect: box };
}

/** التراجع: ما تغيّر يعود كما كان. */
export function undoErase(pixels: Px, alpha: Uint8Array, u: EraseUndo): void {
  for (let k = u.idx.length - 1; k >= 0; k--) {
    const i = u.idx[k]!;
    alpha[i] = u.alpha[k]!;
    pixels[i * 4] = u.rgb[k * 3]!;
    pixels[i * 4 + 1] = u.rgb[k * 3 + 1]!;
    pixels[i * 4 + 2] = u.rgb[k * 3 + 2]!;
  }
}

/**
 * هل بقيت حوافّ الصورة لونًا واحدًا بعد التفريغ؟ نصف طولها فأكثر مرئيٌّ بلونٍ واحد في السماحية — فيُقترح مسحه، وبذوره
 * بكسلاته على الحافّة. و`portrait`: الأعلى والجانبان وحدها — الصدر يلامس أسفل الصورة الشخصية بلباسه.
 */
export function leftoverBorder(pixels: Px, alpha: Uint8Array, width: number, height: number, sides: 'all' | 'portrait', tolerance = ERASE_DEFAULTS.tolerance): { color: Rgb; seeds: number[]; share: number } | null {
  const border: number[] = [];
  for (let x = 0; x < width; x++) border.push(x);
  if (sides === 'all') for (let x = 0; x < width; x++) border.push((height - 1) * width + x);
  const yEnd = sides === 'all' ? height - 1 : height;
  for (let y = 1; y < yEnd; y++) border.push(y * width, y * width + width - 1);
  const shown = border.filter((i) => alpha[i]! >= 128 && pixels[i * 4 + 3]! >= 128);
  if (shown.length < border.length * 0.5) return null;
  // اللون الغالب: أكثر الخانات عددًا بأربعة بتّاتٍ للقناة، ثم وسيط ما فيها.
  const bins = new Map<number, number[]>();
  for (const i of shown) {
    const key = ((pixels[i * 4]! >> 4) << 8) | ((pixels[i * 4 + 1]! >> 4) << 4) | (pixels[i * 4 + 2]! >> 4);
    const list = bins.get(key);
    if (list) list.push(i);
    else bins.set(key, [i]);
  }
  let best: number[] = [];
  for (const list of bins.values()) if (list.length > best.length) best = list;
  const color = [0, 1, 2].map((c) => best.map((i) => pixels[i * 4 + c]!).sort((a, b) => a - b)[best.length >> 1]!) as Rgb;
  const seeds = shown.filter((i) => colorDistance(pixels, i, color) <= tolerance);
  const share = seeds.length / border.length;
  return share >= 0.5 ? { color, seeds, share } : null;
}
