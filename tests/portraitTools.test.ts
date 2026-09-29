/**
 * صورة المعاملة — الحساب الخالص: القوالب والدقّة، والفرشاة، والمعالم من القناع، والقاط،
 * والتحسين الذي لا يغيّر الهوية. كلّه على صورٍ صناعيّة تُرسم هنا — لا وجوه حقيقية.
 */
import { describe, expect, it } from 'vitest';
import { BUILTIN_PRESETS, backgroundColor, effectiveDpi, parsePresets, pixelSize, setJpegDpi, validatePreset, type PhotoPreset } from '../src/shared/photoPresets';
import { autoCrop, collarWidth, fitSuit, landmarks, modelInput, modelSize, neckLine, paintAlpha, placeSuit, rowWidths, strokeAlpha, suitAnchor, suitTops, underSuit, upsampleAlpha } from '../src/shared/portraitMask';
import { NEUTRAL, applyEnhance, autoEnhance, denoiseChroma, toneCurve } from '../src/shared/portraitEnhance';
import { BUILTIN_SUITS, parseCustomSuits, pngTransparency } from '../src/shared/suits';
import { cropBox } from '../src/shared/photoSheet';
import { imageMeta } from '../src/main/services/imageSize';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// ── صورٌ صناعيّة ─────────────────────────────────────────────────────

/** شخصٌ مبسّط: رأسٌ بيضاويّ، ورقبةٌ مستطيلة، وكتفان يتّسعان — قناعًا بمقاسه. */
function silhouette(w: number, h: number, g = { headCx: 200, headCy: 150, rx: 62, ry: 80, neckW: 54, neckTo: 285, shoulderW: 330 }) {
  const a = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const head = ((x - g.headCx) / g.rx) ** 2 + ((y - g.headCy) / g.ry) ** 2 <= 1;
      const neck = y > g.headCy && y <= g.neckTo && Math.abs(x - g.headCx) <= g.neckW / 2;
      const t = Math.min(1, Math.max(0, (y - g.neckTo) / 40));
      const shoulders = y > g.neckTo && Math.abs(x - g.headCx) <= (g.neckW + (g.shoulderW - g.neckW) * t) / 2;
      a[y * w + x] = head || neck || shoulders ? 255 : 0;
    }
  }
  return a;
}

/** قاطٌ صناعيّ: ياقةٌ بفتحة V تنغلق عند الصفّ ٤٠، وكتفان يتّسعان حتى الصفّ ٦٠ ثم يثبتان. */
function suitShape(w = 300, h = 240) {
  const a = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const half = Math.min(140, 55 + 85 * Math.min(1, y / 60));
    const vHalf = Math.max(0, 30 - y * 0.75);
    for (let x = 0; x < w; x++) {
      const dx = Math.abs(x - 150);
      a[y * w + x] = dx < half && dx >= vHalf ? 255 : 0;
    }
  }
  return a;
}

/** وجهٌ صناعيّ: بيضاويٌّ فاتح فيه عينان وفمٌ داكنة على خلفيةٍ — لقياس ما يتحرّك. */
function face(w: number, h: number, tint: [number, number, number] = [1, 1, 1]) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inFace = ((x - w / 2) / (w * 0.3)) ** 2 + ((y - h / 2) / (h * 0.38)) ** 2 <= 1;
      const eye = Math.hypot(x - w * 0.4, y - h * 0.42) < w * 0.04 || Math.hypot(x - w * 0.6, y - h * 0.42) < w * 0.04;
      const mouth = Math.abs(y - h * 0.65) < h * 0.015 && Math.abs(x - w / 2) < w * 0.1;
      let v = inFace ? 170 : 150;
      if (eye || mouth) v = 40;
      const i = (y * w + x) * 4;
      // الوجه بلون البشرة، والخلفية جدارٌ رماديّ — وكلاهما تحت الميل اللوني نفسه.
      const skin = inFace && !eye && !mouth;
      px[i] = v * tint[0];
      px[i + 1] = v * (skin ? 0.85 : 1) * tint[1];
      px[i + 2] = v * (skin ? 0.72 : 1) * tint[2];
      px[i + 3] = 255;
    }
  }
  return px;
}

const lumAt = (px: ArrayLike<number>, i: number) => 0.299 * px[i * 4]! + 0.587 * px[i * 4 + 1]! + 0.114 * px[i * 4 + 2]!;

/** خريطة الحوافّ (Sobel) على الإضاءة — بها يُعرف أن شكلًا لم يتحرّك. */
function edges(px: ArrayLike<number>, w: number, h: number): Float64Array {
  const e = new Float64Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const L = (dx: number, dy: number) => lumAt(px, (y + dy) * w + x + dx);
      const gx = L(1, -1) + 2 * L(1, 0) + L(1, 1) - L(-1, -1) - 2 * L(-1, 0) - L(-1, 1);
      const gy = L(-1, 1) + 2 * L(0, 1) + L(1, 1) - L(-1, -1) - 2 * L(0, -1) - L(1, -1);
      e[y * w + x] = Math.hypot(gx, gy);
    }
  }
  return e;
}

const correlation = (a: Float64Array, b: Float64Array) => {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i]! - ma) * (b[i]! - mb);
    da += (a[i]! - ma) ** 2;
    db += (b[i]! - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
};

/** PNG صغيرة بنوع لونٍ معطى — لفحص الاستيراد. */
function png(colorType: number, withTrns = false): Uint8Array {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    return Buffer.concat([len, Buffer.from(type, 'ascii'), data, Buffer.alloc(4)]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0);
  ihdr.writeUInt32BE(2, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  return Uint8Array.from(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      ...(withTrns ? [chunk('tRNS', Buffer.from([0, 0, 0, 0, 0, 0]))] : []),
      chunk('IDAT', deflateSync(Buffer.alloc(16))),
      chunk('IEND', Buffer.alloc(0))
    ])
  );
}

// ── القوالب والدقّة ────────────────────────────────────────────────────

describe('قوالب صورة المعاملة', () => {
  it('الأبيض أصلها كلّها، ولا يُسمّى رسميًّا إلا ما له مصدرٌ منشور', () => {
    for (const p of BUILTIN_PRESETS) {
      expect(p.background).toEqual({ kind: 'white' });
      expect(validatePreset(p)).toBeNull();
      if (/رسمي|رسمية/.test(p.name + p.notes)) expect(p.source).not.toBeNull();
    }
    const passport = BUILTIN_PRESETS.find((p) => p.id === '35x45')!;
    expect(passport.source).toMatch(/ICAO/);
    expect(BUILTIN_PRESETS.filter((p) => p.source).map((p) => p.id)).toEqual(['35x45']);
    expect(BUILTIN_PRESETS.map((p) => p.id)).toEqual(expect.arrayContaining(['35x45', '4x6', '3x4', '5x5']));
  });

  it('البكسلات بعدد ما يلزم المقاس بدقّته — لا رقمٌ يُكتب وحده', () => {
    expect(pixelSize({ widthMm: 35, heightMm: 45, dpi: 600 })).toEqual({ w: 827, h: 1063 });
    expect(pixelSize({ widthMm: 40, heightMm: 60, dpi: 300 })).toEqual({ w: 472, h: 709 });
    expect(effectiveDpi(413, 35)).toBe(300);
  });

  it('والقالب الذي يكتبه المكتب يُقال سبب رفضه، والمحفوظ الفاسد يُسقط', () => {
    const mine: PhotoPreset = { ...BUILTIN_PRESETS[0]!, id: 'u1', name: 'بطاقة جامعة', builtin: false, source: null };
    expect(validatePreset({ ...mine, name: ' ' })).toMatch(/سمِّ/);
    expect(validatePreset({ ...mine, widthMm: 5 })).toMatch(/المقاس/);
    expect(validatePreset({ ...mine, dpi: 72 })).toMatch(/الدقّة/);
    expect(validatePreset({ ...mine, background: { kind: 'custom', color: 'blue' } })).toMatch(/#RRGGBB/);
    expect(parsePresets(JSON.stringify([mine, { id: 'x', name: '' }, 3]))).toEqual([mine]);
    expect(parsePresets('ليس JSON')).toEqual([]);
    expect(backgroundColor({ kind: 'custom', color: '#123456' })).toBe('#123456');
  });

  it('الدقّة تُكتب في رأس JFIF فيقرؤها قارئ المقاس — وتُدرج إن غاب', () => {
    const jfif = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x04, 0x27, 0x03, 0x3b, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9]);
    const out = setJpegDpi(jfif, 600);
    expect(imageMeta(out)).toMatchObject({ width: 827, height: 1063, dpi: 600 });
    const bare = Uint8Array.from([0xff, 0xd8, ...jfif.subarray(20)]);
    expect(imageMeta(setJpegDpi(bare, 300))).toMatchObject({ width: 827, dpi: 300 });
    expect(() => setJpegDpi(Uint8Array.from([1, 2, 3]), 300)).toThrow('JPEG');
  });
});

// ── القناع ───────────────────────────────────────────────────────────

describe('القناع وما يُبنى عليه', () => {
  it('مدخل النموذج: الضلع الأقصر ٥١٢ ومضاعفات ٣٢، والقيم بين −١ و١', () => {
    expect(modelSize(1024, 1536)).toEqual({ w: 512, h: 768 });
    expect(modelSize(1000, 1333)).toEqual({ w: 512, h: 672 });
    const px = new Uint8Array(64 * 64 * 4).fill(255);
    const t = modelInput(px, 64, 64, 32, 32);
    expect(t.length).toBe(3 * 32 * 32);
    expect(Math.max(...t)).toBeCloseTo(1, 5);
    const up = upsampleAlpha(Float32Array.from([0, 1, 0, 1]), 2, 2, 4, 4);
    expect(up.length).toBe(16);
    expect(up[0]).toBe(0);
    expect(up[3]).toBe(255);
  });

  it('الفرشاة: «احذف» يُفرغ و«أبقِ» يعيد، بحافّةٍ ناعمة، ويُعرف ما تغيّر', () => {
    const w = 100;
    const a = new Uint8Array(w * w).fill(255);
    const box = paintAlpha(a, w, w, 50, 50, 10, 'remove');
    expect(a[50 * w + 50]).toBe(0);
    expect(a[50 * w + 59]).toBeGreaterThan(0); // الحافّة ناعمة
    expect(a[50 * w + 59]).toBeLessThan(255);
    expect(a[10 * w + 10]).toBe(255); // ما بعُد لم يُمسّ
    expect(box).toMatchObject({ x: 40, y: 40 });
    strokeAlpha(a, w, w, { x: 30, y: 50 }, { x: 70, y: 50 }, 12, 'keep');
    expect(a[50 * w + 50]).toBe(255);
  });

  it('المعالم من القناع: قمّة الرأس، والرقبة بعرضها، والكتفان', () => {
    const w = 400;
    const h = 500;
    const lm = landmarks(silhouette(w, h), w, h)!;
    expect(lm.top).toBeGreaterThanOrEqual(69);
    expect(lm.top).toBeLessThanOrEqual(72);
    expect(lm.neckY).toBeGreaterThan(230);
    expect(lm.neckY).toBeLessThanOrEqual(287);
    expect(Math.abs(lm.neckWidth - 55)).toBeLessThan(6);
    expect(Math.abs(lm.neckCenterX - 200)).toBeLessThan(2);
    expect(lm.shoulderY).not.toBeNull();
    expect(lm.headWidth).toBeGreaterThan(115);
    // الذقن أسفل البيضاوي (٢٣٠) — لا حيث يبدأ الرأس يضيق.
    expect(Math.abs(lm.chin - 230)).toBeLessThan(8);
    // بلا شخص: لا معالم تُخترع.
    expect(landmarks(new Uint8Array(w * h), w, h)).toBeNull();
  });

  it('والقاط يُلبس على الجسد: كتفاه على كتفَي الشخص، والرقبة في فتحته', () => {
    const sil = silhouette(400, 500);
    const lm = landmarks(sil, 400, 500)!;
    const suit = suitShape();
    const anchor = suitAnchor(suit, 300, 240)!;
    const t = fitSuit(anchor, rowWidths(suit, 300, 240), rowWidths(sil, 400, 500), lm);
    expect(anchor.neckWidth * t.scale).toBeGreaterThanOrEqual(lm.neckWidth);
    // أعلى القاط بين الذقن والكتفين، وعرضه يغطّي الشخص حيث اتّسع كتفاه.
    expect(t.y).toBeGreaterThanOrEqual(lm.chin);
    expect(t.y).toBeLessThanOrEqual(290);
    const person = rowWidths(sil, 400, 500);
    const rows = rowWidths(suit, 300, 240);
    for (const y of [330, 360, 400]) expect(rows[Math.min(239, Math.round(anchor.cy + (y - t.y) / t.scale))]! * t.scale).toBeGreaterThan(person[y]! * 0.9);
  });

  it('والياقة تلتفّ على الرقبة: تُقاس حيث تلتفّ لا عند أعلاها، ولا تظهر ملابس الزبون في الفتحة', () => {
    const sil = silhouette(400, 500);
    const lm = landmarks(sil, 400, 500)!;
    const suit = suitShape();
    const anchor = suitAnchor(suit, 300, 240)!;
    const tops = suitTops(suit, 300, 240, anchor);
    // الفتحة ٦٠ في أعلاها، وتنغلق عند الصفّ ٤٠ — وعند ثلث عمقها (الصفّ ١٢) نحو ٤٢.
    expect(anchor.neckWidth).toBeGreaterThan(55);
    expect(Math.abs(collarWidth(tops, anchor) - 42)).toBeLessThan(3);
    const t = fitSuit(anchor, rowWidths(suit, 300, 240), rowWidths(sil, 400, 500), lm, tops);
    const hug = (collarWidth(tops, anchor) * t.scale) / lm.neckWidth;
    expect(hug).toBeGreaterThanOrEqual(0.9);
    expect(hug).toBeLessThanOrEqual(1.31);
    // قاطٌ كُبّر باليد حتى اتّسعت فتحته: ما جاور الرقبة فيها يُقصّ عند أعلى الياقة، والرقبة تبقى.
    const big = { ...t, scale: t.scale * 2 };
    const neck = { x: lm.neckCenterX, half: lm.neckWidth * 0.625, from: lm.chin };
    const line = neckLine(tops, anchor, big, 400, 4, neck);
    const bottom = big.y + 20 * big.scale; // داخل الفتحة، أعلى من أسفلها
    expect(line[Math.round(lm.neckCenterX)]!).toBeGreaterThan(bottom);
    expect(line[Math.round(lm.neckCenterX + lm.neckWidth * 0.9)]!).toBeLessThan(big.y + 6);
    // وتحت الذقن لا يبقى إلا الرقبة: كتف الشخص بعيدًا عن القاط يُقصّ عند ذقنه.
    expect(line[20]!).toBeLessThanOrEqual(lm.chin);
    expect(line[Math.round(lm.neckCenterX)]!).toBeGreaterThan(lm.chin);
  });

  it('ويُقصّ الشخص على حدّ القاط: الرقبة إلى أسفل فتحته، ولباسه حولها يزول — والرأس لا يُمسّ', () => {
    const sil = silhouette(400, 500);
    const lm = landmarks(sil, 400, 500)!;
    const suit = suitShape();
    const anchor = suitAnchor(suit, 300, 240)!;
    const t = fitSuit(anchor, rowWidths(suit, 300, 240), rowWidths(sil, 400, 500), lm);
    const tops = suitTops(suit, 300, 240, anchor);
    const out = underSuit(sil, 400, 500, neckLine(tops, anchor, t, 400));
    expect(out[150 * 400 + 200]).toBe(255); // الرأس
    expect(out[Math.round(t.y + 15 * t.scale) * 400 + 200]).toBe(255); // الرقبة في الفتحة
    expect(out[400 * 400 + 200]).toBe(0); // تحت القاط
    expect(out[Math.round(t.y + 20 * t.scale) * 400 + 200 + Math.round(40 * t.scale)]).toBe(0); // كتف الشخص بجانب الياقة
    // ويتبع القاط إن مال: الجانب الأيمن أخفض.
    const tilted = neckLine(tops, anchor, { ...t, angle: 10 }, 400);
    expect(tilted[330]! - tilted[70]!).toBeGreaterThan(20);
  });

  it('وفتحة عنق القاط من شفافيّته، والقاط يوضع تحت الرقبة بعرضٍ يلائمها', () => {
    // قاطٌ صناعيّ: كتفان عريضان وفتحة V في أعلى وسطه.
    const w = 300;
    const h = 200;
    const suit = new Uint8Array(w * h);
    for (let y = 20; y < h; y++) {
      for (let x = 10; x < w - 10; x++) {
        const vHalf = Math.max(0, 40 - (y - 20) * 0.6);
        suit[y * w + x] = Math.abs(x - 150) < vHalf ? 0 : 255;
      }
    }
    const anchor = suitAnchor(suit, w, h)!;
    expect(Math.abs(anchor.cx - 150)).toBeLessThan(2);
    expect(anchor.neckWidth).toBeGreaterThan(70);
    expect(anchor.shoulderWidth).toBe(280);
    const lm = landmarks(silhouette(400, 500), 400, 500)!;
    const t = placeSuit(anchor, lm);
    expect(t.x).toBeCloseTo(lm.neckCenterX, 5);
    expect(t.y).toBeGreaterThan(lm.neckY);
    expect(anchor.neckWidth * t.scale).toBeGreaterThan(lm.neckWidth);
    expect(t.angle).toBe(0);
    // صورةٌ بلا شفافيّةٍ أصلًا: لا فتحة تُخترع.
    expect(suitAnchor(new Uint8Array(w * h), w, h)).toBeNull();
  });

  it('والقصّ التلقائي يضع الرأس في دليل القالب', () => {
    const w = 400;
    const h = 500;
    const lm = landmarks(silhouette(w, h), w, h)!;
    const guide = BUILTIN_PRESETS[0]!.head!;
    const frame = { w: 350, h: 450 };
    const crop = autoCrop(lm, { w, h }, frame, guide);
    const box = cropBox(frame, { w, h }, crop);
    const scale = box.width / w;
    const headOnFrame = (lm.chin - lm.top) * scale;
    expect(headOnFrame / frame.h).toBeGreaterThan(guide.min - 0.03);
    expect(headOnFrame / frame.h).toBeLessThan(guide.max + 0.03);
  });
});

// ── التحسين: لا يغيّر الهوية ────────────────────────────────────────────

describe('التحسين محافظٌ لا يغيّر الهوية', () => {
  it('منحنى الإضاءة رتيبٌ صاعد في كلّ الضبطات — ما كان أفتح يبقى أفتح', () => {
    for (const e of [
      { exposure: 1, contrast: 1, shadows: 1 },
      { exposure: -1, contrast: -1, shadows: 0 },
      { exposure: 0.5, contrast: 0.3, shadows: 0.6 }
    ]) {
      let prev = -1;
      for (let i = 0; i <= 200; i++) {
        const v = toneCurve(i / 200, e);
        expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = v;
      }
    }
  });

  it('المقاس كما هو، والحوافّ في أماكنها، والوجه لا يتحرّك ولا يتّسع', () => {
    const w = 160;
    const h = 200;
    const src = face(w, h, [1.1, 1, 0.8]);
    const e = { ...autoEnhance(src, null, w, h), exposure: 0.6, contrast: 0.4, shadows: 0.5, denoise: 0.6 };
    const out = applyEnhance(src, w, h, e);
    expect(out.length).toBe(src.length);
    expect(correlation(edges(src, w, h), edges(out, w, h))).toBeGreaterThan(0.97);
    // مركز الأجزاء الداكنة (العينان والفم) وعددها لم يتغيّر.
    const dark = (px: ArrayLike<number>, limit: number) => {
      let n = 0;
      let sx = 0;
      let sy = 0;
      for (let i = 0; i < w * h; i++) {
        if (lumAt(px, i) < limit) {
          n++;
          sx += i % w;
          sy += Math.floor(i / w);
        }
      }
      return { n, cx: sx / n, cy: sy / n };
    };
    const before = dark(src, 60);
    const after = dark(out, (toneCurve(60 / 255, e) * 255 + toneCurve(40 / 255, e) * 255) / 2 + 12);
    expect(Math.abs(after.cx - before.cx)).toBeLessThan(0.5);
    expect(Math.abs(after.cy - before.cy)).toBeLessThan(0.5);
    expect(Math.abs(after.n - before.n) / before.n).toBeLessThan(0.05);
  });

  it('وتخفيف الضجيج على اللون وحده: الإضاءة لا تُنعَّم', () => {
    const w = 64;
    const px = new Uint8ClampedArray(w * w * 4);
    for (let i = 0; i < w * w; i++) {
      const noise = (i * 7919) % 13;
      px[i * 4] = 120 + noise;
      px[i * 4 + 1] = 120 - noise;
      px[i * 4 + 2] = 120;
      px[i * 4 + 3] = 255;
    }
    const out = denoiseChroma(px, w, w, 1);
    // الضجيج تذبذبُ اللون حول متوسّطه — لا متوسّطه نفسه (لون الصورة يبقى).
    const spread = (p: ArrayLike<number>) => {
      const d = Array.from({ length: w * w }, (_, i) => p[i * 4]! - p[i * 4 + 1]!);
      const m = d.reduce((s, v) => s + v, 0) / d.length;
      return Math.sqrt(d.reduce((s, v) => s + (v - m) ** 2, 0) / d.length);
    };
    let lumDiff = 0;
    for (let i = 0; i < w * w; i++) lumDiff = Math.max(lumDiff, Math.abs(lumAt(out, i) - lumAt(px, i)));
    expect(lumDiff).toBeLessThanOrEqual(1.5);
    expect(spread(out)).toBeLessThan(spread(px) * 0.5);
  });

  it('والتلقائي يصلح الميل اللوني ويرفع المعتم — بحدود', () => {
    const w = 120;
    const h = 150;
    const dim = face(w, h, [1.12, 1, 0.88]).map((v, i) => (i % 4 === 3 ? v : v * 0.55));
    const e = autoEnhance(Uint8ClampedArray.from(dim), null, w, h);
    expect(e.gains[0]).toBeLessThan(1); // الأحمر الزائد يُخفَّض
    expect(e.gains[2]).toBeGreaterThan(1);
    for (const g of e.gains) expect(Math.abs(g - 1)).toBeLessThanOrEqual(0.15 * 0.7 + 1e-9);
    expect(e.exposure).toBeGreaterThan(0);
    expect(e.exposure).toBeLessThanOrEqual(0.9);
    expect(applyEnhance(Uint8ClampedArray.from(dim), w, h, NEUTRAL)).toEqual(Uint8ClampedArray.from(dim));
  });
});

// ── القاط ────────────────────────────────────────────────────────────

describe('مكتبة القاط', () => {
  it('المدمج صورٌ موجودة، ولا بدلة نظامية باسم جهةٍ أو رتبة', () => {
    for (const s of BUILTIN_SUITS) {
      const file = join(__dirname, '..', 'src', 'renderer', 'src', 'assets', 'suits', s.file);
      expect(existsSync(file), s.file).toBe(true);
      expect(readFileSync(file).subarray(8, 12).toString('ascii')).toBe('WEBP');
    }
    // كلّ ملفٍّ في المجلّد في الفهرس وكلّ ما في الفهرس ملفّ — فلا يُحزم قاطٌ لا يُرى، ولا يُرى ما لم يُحزم.
    const dir = join(__dirname, '..', 'src', 'renderer', 'src', 'assets', 'suits');
    expect(readdirSync(dir).filter((f) => f.endsWith('.webp')).sort()).toEqual(BUILTIN_SUITS.map((s) => s.file).sort());
    expect(new Set(BUILTIN_SUITS.map((s) => s.id)).size).toBe(BUILTIN_SUITS.length);
    const uniforms = BUILTIN_SUITS.filter((s) => s.category === 'uniform').map((s) => s.name).join(' ');
    expect(uniforms).not.toMatch(/ضابط|شرطة|جيش|رتبة|مكافحة|اتحادية/);
  });

  it('الاستيراد: PNG شفّافة وحدها — والمعتمة وغير PNG تُرفض بسببها', () => {
    expect(pngTransparency(png(6))).toBe('ok');
    expect(pngTransparency(png(4))).toBe('ok');
    expect(pngTransparency(png(2, true))).toBe('ok');
    expect(pngTransparency(png(2))).toBe('opaque');
    expect(pngTransparency(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('not-png');
    const saved = [{ id: 'a', name: 'قاط المكتب', path: 'suits/a.png', createdAt: '2026-09-29' }];
    expect(parseCustomSuits(JSON.stringify([...saved, { id: 'b', name: 'خارج', path: '../x.png', createdAt: '' }]))).toEqual(saved);
  });
});
