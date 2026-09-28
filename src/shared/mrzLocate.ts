/**
 * إيجاد سطور MRZ من الصورة نفسها (تعميق الموجود ٨) — حسابٌ خالص على البكسلات.
 *
 * تقسيم القارئ للصفحة لم يرَ في نسخةٍ مصوّرة حقيقية شيئًا (خطوط النسخ في خلفيّتها). وسطور MRZ
 * لها بصمةٌ في الصورة: نحو ثلاثين رمزًا منفصلًا متساوية الارتفاع بخطوةٍ ثابتة — والعربيّ حروفٌ
 * موصولة متفاوتة. فتُعدّ «قطع الحبر» المتّصلة، وتُجمع أسطرًا، ويُختار ثلاثةٌ بتلك البصمة.
 */
import type { Box } from './mrzImage';

export type Blob = Box & { area: number };

/** قطع الحبر المتّصلة (بجوارٍ ثمانيّ) — صناديقها ومساحاتها. */
export function components(bin: Uint8Array, width: number, height: number): Blob[] {
  const parent = new Int32Array(width * height).fill(-1);
  const find = (i: number): number => {
    while (parent[i]! !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!bin[i]) continue;
      parent[i] = i;
      if (x > 0 && bin[i - 1]) union(i, i - 1);
      if (y > 0) {
        if (bin[i - width]) union(i, i - width);
        if (x > 0 && bin[i - width - 1]) union(i, i - width - 1);
        if (x + 1 < width && bin[i - width + 1]) union(i, i - width + 1);
      }
    }
  }
  const boxes = new Map<number, Blob>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!bin[i]) continue;
      const r = find(i);
      const b = boxes.get(r);
      if (!b) boxes.set(r, { x0: x, y0: y, x1: x + 1, y1: y + 1, area: 1 });
      else {
        if (x < b.x0) b.x0 = x;
        if (x + 1 > b.x1) b.x1 = x + 1;
        b.y1 = y + 1;
        b.area++;
      }
    }
  }
  return [...boxes.values()];
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};
const around = (bs: Box[]): Box => ({
  x0: Math.min(...bs.map((b) => b.x0)),
  y0: Math.min(...bs.map((b) => b.y0)),
  x1: Math.max(...bs.map((b) => b.x1)),
  y1: Math.max(...bs.map((b) => b.y1))
});

/** سطرٌ مرشَّح: صندوقه ورموزه وخطوته وارتفاع رموزه، ووسطه على امتداده (`cy = a + b·x`) — فالمسح المائل قليلًا لا يخلط سطرًا بجاره. */
export type GlyphLine = { box: Box; glyphs: Box[]; pitch: number; height: number; a: number; b: number };

type Glyph = Blob & { cx: number; cy: number; h: number };

/** الخطّ الأقرب لأوساط الرموز (مربّعاتٌ صغرى). */
function fitCenters(gs: Glyph[]): { a: number; b: number } {
  const n = gs.length;
  const mx = gs.reduce((s, g) => s + g.cx, 0) / n;
  const my = gs.reduce((s, g) => s + g.cy, 0) / n;
  const sxx = gs.reduce((s, g) => s + (g.cx - mx) ** 2, 0);
  const b = sxx ? gs.reduce((s, g) => s + (g.cx - mx) * (g.cy - my), 0) / sxx : 0;
  return { a: my - b * mx, b };
}

/**
 * أسطرٌ برموزٍ منفصلةٍ متقاربة الارتفاع بخطوةٍ ثابتة — مرشّحةٌ لسطور MRZ.
 *
 * كلّ قطعةٍ بذرةٌ يُتتبَّع منها السطر يمينًا ويسارًا رمزًا رمزًا: التالي أقربُ قطعةٍ بعده
 * يحاذي وسطُها وسطَ سابقه (فيتبع الميل)، بفجوةٍ لا تتّسع. و«<» أقصر من الحروف فيُقبل نصفها.
 * ويُقبل ما انتظمت خطواته أكثرها — فغبار النسخة وحرفٌ انكسر أو التصق بجاره لا يُسقط السطر.
 */
export function glyphLines(blobs: Blob[], minGlyphs = 20): GlyphLine[] {
  const glyphs: Glyph[] = blobs
    .filter((c) => {
      const h = c.y1 - c.y0;
      const w = c.x1 - c.x0;
      return h >= 6 && h <= 90 && w >= 2 && w <= h * 1.4;
    })
    .map((c) => ({ ...c, cx: (c.x0 + c.x1) / 2, cy: (c.y0 + c.y1) / 2, h: c.y1 - c.y0 }))
    .sort((a, b) => a.cx - b.cx);
  const cxs = glyphs.map((g) => g.cx);
  const firstAfter = (v: number) => {
    let lo = 0;
    let hi = cxs.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cxs[mid]! <= v) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const fits = (g: Glyph, h: number) => g.h >= h * 0.5 && g.h <= h * 1.6;
  const out: GlyphLine[] = [];
  const used = new Set<Glyph>();
  for (const seed of glyphs) {
    if (used.has(seed) || seed.h < 8) continue;
    const h = seed.h;
    // يمينًا: أقرب قطعةٍ بعده (بالوسط) تحاذيه.
    const right: Glyph[] = [];
    for (let cur = seed; ; ) {
      let next: Glyph | undefined;
      for (let j = firstAfter(cur.cx); j < glyphs.length && glyphs[j]!.x0 - cur.x1 <= h * 1.5; j++) {
        const g = glyphs[j]!;
        if (fits(g, h) && Math.abs(g.cy - cur.cy) <= h * 0.3) {
          next = g;
          break;
        }
      }
      if (!next) break;
      right.push(next);
      cur = next;
    }
    // ويسارًا كذلك.
    const left: Glyph[] = [];
    for (let cur = seed; ; ) {
      let prev: Glyph | undefined;
      for (let j = firstAfter(cur.cx - 0.001) - 1; j >= 0 && cur.x0 - glyphs[j]!.x1 <= h * 1.5; j--) {
        const g = glyphs[j]!;
        if (g.cx < cur.cx && fits(g, h) && Math.abs(g.cy - cur.cy) <= h * 0.3) {
          prev = g;
          break;
        }
      }
      if (!prev) break;
      left.push(prev);
      cur = prev;
    }
    const seg = [...left.reverse(), seed, ...right];
    if (seg.length < minGlyphs) continue;
    const steps = seg.slice(1).map((g, k) => g.cx - seg[k]!.cx);
    const pitch = median(steps);
    const height = median(seg.map((g) => g.h));
    const regular = steps.filter((s) => Math.abs(s - pitch) <= pitch * 0.3).length / steps.length;
    if (regular < 0.7 || pitch < height * 0.5 || pitch > height * 1.6) continue;
    for (const g of seg) used.add(g);
    out.push({ box: around(seg), glyphs: seg, pitch, height, ...fitCenters(seg) });
  }
  return out;
}

/** ثلاثة أسطرٍ متتالية متوازية بخطوةٍ واحدة وعرضٍ واحد — سطور MRZ — وصندوقها. */
export function pickMrz(lines: GlyphLine[]): { box: Box; lines: GlyphLine[] } | null {
  const mid = (l: GlyphLine) => (l.box.x0 + l.box.x1) / 2;
  const sorted = [...lines].sort((p, q) => p.a + p.b * mid(p) - (q.a + q.b * mid(q)));
  for (let i = 0; i + 2 < sorted.length; i++) {
    const trio = sorted.slice(i, i + 3);
    const pitch = trio.map((l) => l.pitch);
    const width = trio.map((l) => l.box.x1 - l.box.x0);
    const x = mid(trio[1]!);
    const cy = trio.map((l) => l.a + l.b * x);
    const h = trio[1]!.height;
    const samePitch = Math.max(...pitch) / Math.min(...pitch) < 1.25;
    const sameWidth = Math.max(...width) / Math.min(...width) < 1.3;
    const spaced = [cy[1]! - cy[0]!, cy[2]! - cy[1]!].every((d) => d > h * 1.1 && d < h * 3);
    const parallel = Math.max(...trio.map((l) => l.b)) - Math.min(...trio.map((l) => l.b)) < 0.02;
    if (samePitch && sameWidth && spaced && parallel) return { box: around(trio.map((l) => l.box)), lines: trio };
  }
  return null;
}
