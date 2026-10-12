/**
 * «رمّم» (البند ٤٠) — المحرّك على صورٍ يرسمها الاختبار، وما تحت الحفرة معروفٌ فيُقاس الملء به: خطوطٌ مائلة تُكمَل لا تُطمس،
 * وضجيجٌ كملمس الجلد يبقى ضجيجًا لا لطخة، وتدرّجٌ يتّصل، وما لا يجوز الأخذ منه لا يُؤخذ، والحافّة تمتزج بشفافية الفرشاة.
 */
import { describe, expect, it } from 'vitest';
import { inpaint } from '../src/shared/inpaint';

const W = 200;
const H = 160;

function image(f: (x: number, y: number) => number[]): Uint8ClampedArray {
  const px = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = f(x, y);
      for (let k = 0; k < 3; k++) px[(y * W + x) * 4 + k] = c[k]!;
      px[(y * W + x) * 4 + 3] = 255;
    }
  }
  return px;
}

/** حفرةٌ مربّعة (٢٥٥) في الوسط — وما سواها صفر. */
function square(x0: number, y0: number, s: number, v = 255): Uint8Array {
  const m = new Uint8Array(W * H);
  for (let y = y0; y < y0 + s; y++) for (let x = x0; x < x0 + s; x++) m[y * W + x] = v;
  return m;
}

/** متوسّط الفرق عن الأصل في الحفرة، وانحراف الإضاءة فيها وحولها (للملمس). */
function measure(out: Uint8ClampedArray, truth: Uint8ClampedArray, hole: Uint8Array) {
  let err = 0;
  let n = 0;
  const inside: number[] = [];
  const around: number[] = [];
  for (let i = 0; i < W * H; i++) {
    const l = out[i * 4]! * 0.3 + out[i * 4 + 1]! * 0.59 + out[i * 4 + 2]! * 0.11;
    if (hole[i]) {
      for (let k = 0; k < 3; k++) err += Math.abs(out[i * 4 + k]! - truth[i * 4 + k]!);
      n += 3;
      inside.push(l);
    } else around.push(l);
  }
  const sd = (v: number[]) => {
    const m = v.reduce((s, x) => s + x, 0) / v.length;
    return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length);
  };
  return { err: err / n, sdIn: sd(inside), sdOut: sd(around) };
}

describe('رمّم', () => {
  it('الخطوط المائلة تُكمَل داخل الحفرة بنقشها لا بلطخةٍ رمادية', () => {
    const stripes = (x: number, y: number) => (Math.floor((x + y) / 8) % 2 ? [200, 60, 50] : [40, 50, 160]);
    const truth = image(stripes);
    const px = Uint8ClampedArray.from(truth);
    const hole = square(80, 60, 36);
    const rect = inpaint(px, W, H, hole)!;
    expect(rect).toEqual({ x: 80, y: 60, w: 36, h: 36 });
    const m = measure(px, truth, hole);
    expect(m.sdIn).toBeGreaterThan(m.sdOut * 0.7); // النقش باقٍ
    expect(m.err).toBeLessThan(45); // وفي موضعه غالبًا (الخطّ بعرض ٨)
    // وما خارج الحفرة لا يُمسّ.
    let changed = 0;
    for (let i = 0; i < W * H; i++) if (!hole[i] && px[i * 4] !== truth[i * 4]) changed++;
    expect(changed).toBe(0);
  });

  it('وملمس الجلد يبقى: ضجيجٌ بقدر ما حوله ولونٌ كلونه', () => {
    let seed = 5;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % 1000) / 1000;
    const truth = image(() => {
      const n = (rnd() - 0.5) * 40;
      return [215 + n, 170 + n * 0.8, 145 + n * 0.7];
    });
    const px = Uint8ClampedArray.from(truth);
    const hole = square(70, 50, 50);
    inpaint(px, W, H, hole);
    const m = measure(px, truth, hole);
    expect(m.sdIn).toBeGreaterThan(m.sdOut * 0.8);
    let r = 0;
    let n = 0;
    for (let i = 0; i < W * H; i++) if (hole[i]) (r += px[i * 4]!), n++;
    expect(Math.abs(r / n - 215)).toBeLessThan(6);
  });

  it('والتدرّج يتّصل عبر الحفرة', () => {
    const truth = image((x, y) => [60 + x * 0.8, 80 + y * 0.6, 120]);
    const px = Uint8ClampedArray.from(truth);
    const hole = square(90, 60, 30);
    inpaint(px, W, H, hole);
    expect(measure(px, truth, hole).err).toBeLessThan(8);
  });

  it('ولا يُؤخذ ممّا لم يُسمح به: الحفرة في الأخضر تحت أحمرٍ ممنوع تُملأ أخضر', () => {
    const truth = image((x, y) => (y < 80 ? [220, 30, 30] : [30, 170, 60]));
    const px = Uint8ClampedArray.from(truth);
    const hole = square(80, 82, 30);
    const allow = new Uint8Array(W * H);
    for (let i = 80 * W; i < W * H; i++) allow[i] = 1;
    inpaint(px, W, H, hole, { allow });
    let red = 0;
    for (let i = 0; i < W * H; i++) if (hole[i] && px[i * 4]! > 100) red++;
    expect(red).toBe(0);
  });

  it('والحافّة الناعمة تمتزج بالأصل بشفافية الفرشاة، والنتيجة نفسها في كلّ مرّة', () => {
    const truth = image((x) => (x < 100 ? [250, 250, 250] : [20, 20, 20]));
    const px = Uint8ClampedArray.from(truth);
    // بقعةٌ داكنة على الأبيض، وحفرةٌ عليها نصف شفافيّتها على حافّتها.
    for (let y = 70; y < 80; y++) for (let x = 40; x < 50; x++) [0, 1, 2].forEach((k) => (px[(y * W + x) * 4 + k] = 30));
    const hole = square(36, 66, 18, 255);
    for (let y = 66; y < 84; y++) for (const x of [36, 53]) hole[y * W + x] = 128;
    const a = Uint8ClampedArray.from(px);
    inpaint(a, W, H, hole);
    expect(a[(75 * W + 45) * 4]).toBeGreaterThan(230); // البقعة زالت
    const edge = (75 * W + 36) * 4;
    expect(a[edge]).toBeGreaterThan(240); // نصفٌ من الأصل الأبيض ونصفٌ من الملء الأبيض
    const b = Uint8ClampedArray.from(px);
    inpaint(b, W, H, hole);
    expect(b).toEqual(a);
    expect(inpaint(Uint8ClampedArray.from(px), W, H, new Uint8Array(W * H))).toBeNull();
  });

  it('وسريعٌ بما يكفي لفرشاة: حفرةٌ ٨٠×٨٠ في صورةٍ ٨٠٠×٦٠٠ في أقلّ من ثانيتين', () => {
    const w = 800;
    const h = 600;
    const px = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const x = i % w;
      const y = Math.floor(i / w);
      const v = Math.floor((x + y) / 8) % 2 ? 200 : 50;
      px.set([v, v, v, 255], i * 4);
    }
    const hole = new Uint8Array(w * h);
    for (let y = 260; y < 340; y++) for (let x = 360; x < 440; x++) hole[y * w + x] = 255;
    const t = performance.now();
    inpaint(px, w, h, hole);
    expect(performance.now() - t).toBeLessThan(2000);
  });
});
