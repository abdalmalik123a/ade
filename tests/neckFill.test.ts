/**
 * إكمال الرقبة بلا نموذج (S45، D175): على شخصٍ يرسمه الاختبار — وجهٌ بلون البشرة، ورقبةٌ يتدرّج ضوؤها من اليسار إلى اليمين،
 * وياقةٌ بيضاء مرتفعة تُقصّ تحت القاط — وقاطٍ داكنٍ بفتحة V: المملوء في عمود الرقبة جلدٌ يلتحم بما فوقه، وباطن الياقة أغمق من
 * القماش، ولا بكسل فوق أسفل الوجه (ر023)، والطبقة نفسها في رسمين.
 */
import { describe, expect, it } from 'vitest';
import { neckFill, type NeckScene, type Rect } from '../src/shared/neckFill';
import { landmarks } from '../src/shared/portraitMask';
import { neckLine, suitAnchor, suitTops, type SuitTransform } from '../src/shared/suitFit';
import { faceChin, faceFloor, withFace, type Face, type FaceBox } from '../src/shared/portraitFace';
import { neckSkin, skinSample, skinWeight } from '../src/shared/portraitSkin';

const SKIN = [224, 178, 150];
const SUIT = [30, 32, 40];
const W = 400;
const H = 500;

/** شخصٌ مبسّط (كاختبار الجلد): رأسٌ بيضاويّ بعينين وفم، ورقبةٌ ضوؤها ٠٫٦٥ يسارًا إلى ٠٫٩٥ يمينًا، وياقةٌ بيضاء من `collarFrom`، وجسدٌ أبيض. */
function person(collarFrom: number) {
  const alpha = new Uint8Array(W * H);
  const px = new Uint8ClampedArray(W * H * 4);
  let seed = 11;
  const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % 7) - 3;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const head = ((x - 200) / 62) ** 2 + ((y - 150) / 80) ** 2 <= 1;
      const neck = y > 150 && y <= 285 && Math.abs(x - 200) <= 27;
      const t = Math.min(1, Math.max(0, (y - 285) / 40));
      const body = y > 285 && Math.abs(x - 200) <= (54 + 276 * t) / 2;
      if (!(head || neck || body)) continue;
      alpha[i] = 255;
      let c = SKIN;
      if (neck && !head) c = SKIN.map((v) => v * (0.65 + (0.3 * (x - 173)) / 54));
      if (head && (Math.hypot(x - 178, y - 135) < 7 || Math.hypot(x - 222, y - 135) < 7)) c = [40, 30, 30];
      if (head && Math.abs(y - 190) < 3 && Math.abs(x - 200) < 16) c = [190, 90, 90];
      if ((neck && !head && y >= collarFrom) || body) c = [240, 240, 238];
      for (let k = 0; k < 3; k++) px[i * 4 + k] = c[k]! + noise();
      px[i * 4 + 3] = 255;
    }
  return { px, alpha };
}

/** قاطٌ ٤٠٠×٣٠٠ (كسيناريو الصورة): كتفان داكنان منحدران، وفتحة عنقٍ V شفّافة. */
function suitImage() {
  const sw = 400;
  const sh = 300;
  const rgba = new Uint8ClampedArray(sw * sh * 4);
  const alpha = new Uint8Array(sw * sh);
  for (let y = 0; y < sh; y++)
    for (let x = 0; x < sw; x++) {
      const dx = Math.abs(x - 200);
      const shoulder = y > 40 + Math.max(0, dx - 60) * 0.35 && dx < 195;
      const gap = y < 130 && dx < 38 * (1 - (y - 40) / 90);
      if (!shoulder || gap) continue;
      const i = y * sw + x;
      alpha[i] = 255;
      rgba.set([...SUIT, 255], i * 4);
    }
  const anchor = suitAnchor(alpha, sw, sh)!;
  return { sw, sh, rgba, alpha, anchor, tops: suitTops(alpha, sw, sh, anchor) };
}

// الوجه كما يجده النموذج (كاختبار الجلد): الرأس ينتهي على الصفّ ٢٣٠.
const BOX: FaceBox = { x: 138, y: 90, w: 124, h: 140, eyes: [{ x: 178, y: 135 }, { x: 222, y: 135 }], nose: { x: 200, y: 165 }, mouth: [{ x: 184, y: 190 }, { x: 216, y: 190 }], score: 0.9 };

/** المشهد كما يرسمه البرنامج (`usePhotoCanvas`): حدّ القاط بالرقبة وأسفل الوجه، وقناع الجلد، والقاط على الرقبة. */
function scene(collarFrom: number, withFaceBox = true) {
  const p = person(collarFrom);
  const bare = landmarks(p.alpha, W, H)!;
  const face: Face | null = withFaceBox ? { ...BOX, chin: faceChin(BOX, p.px, W, H) } : null;
  const lm = withFace(bare, face)!;
  const s = suitImage();
  // أعلى الفتحة على أوّل الجسد: الفتحة أعرض من الرقبة فيظهر بجانبها من القميص ما يُقصّ (باطن الياقة).
  const at: SuitTransform = { x: lm.neckCenterX, y: 285, scale: 1, angle: 0 };
  const feather = 3;
  const neck = { x: lm.neckCenterX, half: lm.neckWidth * 0.5 + 1, from: lm.chin };
  const line = neckLine(s.tops, s.anchor, at, W, feather + 1, neck);
  if (face) for (let x = 0; x < W; x++) if (Math.abs(x - neck.x) > neck.half) line[x] = Math.min(line[x]!, faceFloor(face, lm.chin, x));
  const skin = skinSample(p.px, p.alpha, W, H, lm, face)!;
  const mask = neckSkin(p.px, W, H, lm, skin, lm.chin + lm.neckWidth * 2.5, neck.half, face, 0);
  const sc: NeckScene = { width: W, height: H, pixels: p.px, alpha: p.alpha, line, feather, mask, lm, face, skin, at, anchor: s.anchor, neck };
  /** القاط في مستطيلٍ من الصورة — أقرب بكسل (كـ`suitLayer` في النموذج الأوّلي). */
  const paint = (r: Rect) => {
    const out = new Uint8ClampedArray(r.w * r.h * 4);
    for (let y = 0; y < r.h; y++)
      for (let x = 0; x < r.w; x++) {
        const u = Math.round(s.anchor.cx + (r.x + x - at.x));
        const v = Math.round(s.anchor.cy + (r.y + y - at.y));
        if (u < 0 || u >= s.sw || v < 0 || v >= s.sh) continue;
        out.set(s.rgba.subarray((v * s.sw + u) * 4, (v * s.sw + u) * 4 + 4), (y * r.w + x) * 4);
      }
    return out;
  };
  return { ...p, lm, face, sc, paint, suitAt: (x: number, y: number) => paint({ x, y, w: 1, h: 1 })[3]! >= 128 };
}

const at = (f: NonNullable<ReturnType<typeof neckFill>>, x: number, y: number) =>
  x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h ? f.data.subarray(((y - f.y) * f.w + x - f.x) * 4, ((y - f.y) * f.w + x - f.x) * 4 + 4) : null;

/** نصيب الجلد في الرقبة المملوءة الظاهرة، وباطن الياقة، والدرز: فرق اللون بين المملوء الظاهر وجلدٍ معروفٍ فوقه أو بجانبه. */
function score(t: ReturnType<typeof scene>, f: NonNullable<ReturnType<typeof neckFill>>) {
  let skin = 0;
  let nk = 0;
  let coll = 0;
  let nc = 0;
  let seam = 0;
  let sn = 0;
  for (let y = f.y; y < f.y + f.h; y++)
    for (let x = f.x; x < f.x + f.w; x++) {
      const c = at(f, x, y)!;
      if (!c[3] || t.suitAt(x, y)) continue;
      const lum = 0.299 * c[0]! + 0.587 * c[1]! + 0.114 * c[2]!;
      if (Math.abs(x - t.sc.neck.x) <= t.sc.neck.half) {
        skin += skinWeight(t.sc.skin, c[0]!, c[1]!, c[2]!) >= 0.5 ? 1 : 0;
        nk++;
        // الجار المعروف: جلدٌ ظاهر لم يُملأ.
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1]] as const) {
          const q = at(f, x + dx, y + dy);
          if (q && q[3]) continue;
          const i = ((y + dy) * W + x + dx) * 4;
          if (skinWeight(t.sc.skin, t.px[i]!, t.px[i + 1]!, t.px[i + 2]!) < 0.5) continue;
          seam += (Math.abs(c[0]! - t.px[i]!) + Math.abs(c[1]! - t.px[i + 1]!) + Math.abs(c[2]! - t.px[i + 2]!)) / 3;
          sn++;
        }
      } else if (Math.abs(Math.abs(x - t.sc.neck.x) - t.sc.neck.half) > Math.ceil(t.sc.feather / 2)) {
        // باطن الياقة خارج الانتقال المليّن بينه وبين الرقبة (D176).
        coll += lum;
        nc++;
      }
    }
  return { skin: skin / nk, neck: nk, collar: nc ? coll / nc : null, seam: seam / sn, sn };
}

describe('إكمال الرقبة بلا نموذج', () => {
  it('الياقة البيضاء المقصوصة تحت الذقن: الرقبة جلدٌ يلتحم بما فوقه، وباطن الياقة أغمق من القماش', () => {
    const t = scene(256);
    const f = neckFill(t.sc, t.paint)!;
    expect(f).not.toBeNull();
    expect(f.neck).toBeGreaterThan(500);
    expect(f.collar).toBeGreaterThan(50);
    const s = score(t, f);
    expect(s.neck).toBeGreaterThan(500);
    expect(s.skin).toBeGreaterThanOrEqual(0.95);
    // الدرز عند الجلد المعروف (الرقبة المتدرّجة فوق الياقة): بالانتشار يلتحم — وبلا انتشارٍ يبقى وسيطٌ واحد على عرضها.
    expect(s.sn).toBeGreaterThan(30);
    expect(s.seam).toBeLessThan(8);
    // باطن الياقة قماشٌ في ظلّ: أغمق من القاط نفسه.
    expect(s.collar!).toBeLessThan(0.299 * SUIT[0]! + 0.587 * SUIT[1]! + 0.114 * SUIT[2]! - 5);
    // ولا يبقى في الطبقة أبيض الياقة.
    for (let o = 0; o < f.data.length; o += 4) if (f.data[o + 3]) expect(Math.min(f.data[o]!, f.data[o + 1]!, f.data[o + 2]!)).toBeLessThan(215);
    // وبلا انتشار (دوراتٌ صفر) يبقى الدرز: الوسيط وحده لا يلتحم بالرقبة المتدرّجة (٣ ← ٢٣ عند كتابته).
    expect(score(t, neckFill(t.sc, t.paint, 0)!).seam).toBeGreaterThan(15);
  });

  it('الوجه لا يُمسّ: لا بكسل في الطبقة فوق أسفل الوجه — بوجهٍ معروف وبلا وجه', () => {
    for (const withFaceBox of [true, false]) {
      const t = scene(236, withFaceBox);
      const f = neckFill(t.sc, t.paint)!;
      expect(f).not.toBeNull();
      const floor = (x: number) => (t.face ? faceFloor(t.face, t.lm.chin, x) : t.lm.chin - t.lm.neckWidth * 0.2);
      for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) if (at(f, x, y)![3]) expect(y).toBeGreaterThanOrEqual(floor(x));
    }
  });

  it('الطبقة نفسها في رسمين (البذرة ثابتة)، والصورة لا تُمسّ', () => {
    const t = scene(256);
    const before = t.px.slice();
    const a = neckFill(t.sc, t.paint)!;
    const b = neckFill(t.sc, t.paint)!;
    expect(b.data).toEqual(a.data);
    expect([b.x, b.y, b.w, b.h]).toEqual([a.x, a.y, a.w, a.h]);
    expect(t.px).toEqual(before);
  });

  it('لمسة الواقعية (D176): ظلّ الذقن على أعلى الرقبة المملوءة، والحدّ بين الرقبة وباطن الياقة ليّن', () => {
    const L = (c: ArrayLike<number>) => 0.299 * c[0]! + 0.587 * c[1]! + 0.114 * c[2]!;
    // الياقة تحت الفكّ: المملوء يبدأ عند أسفل الوجه، وجلده من الوجه — فبلا ظلٍّ أعلاه كأسفله.
    const t = scene(236);
    const f = neckFill(t.sc, t.paint)!;
    const floor = Math.ceil(faceFloor(t.face!, t.lm.chin, 200));
    const band = (y: number) => {
      let s = 0;
      for (let x = 195; x <= 205; x++) s += at(f, x, y)?.[3] ? L(at(f, x, y)!) : NaN;
      return s / 11;
    };
    // أوّل صفٍّ مملوءٍ كلّه تحت أسفل الوجه (تدرّج القصّ القائم يُبقي صفوفًا قبله) — وفي ربع عمق الظلّ.
    const depth = Math.ceil(t.lm.neckWidth * 0.4);
    let first = floor;
    while (Number.isNaN(band(first)) && first < floor + depth) first++;
    expect(first - floor).toBeLessThan(depth / 2);
    expect(band(first)).toBeLessThan(band(floor + depth + 3) * 0.92);
    // الحدّ العموديّ عند يمين عمود الرقبة: الفرق بين الجلد وباطن الياقة كبير، وكلّ خطوةٍ بين بكسلين متجاورين صغيرة.
    const u = scene(256);
    const g = neckFill(u.sc, u.paint)!;
    const edge = Math.round(u.sc.neck.x + u.sc.neck.half);
    let rows = 0;
    let step = 0;
    for (let y = g.y; y < g.y + g.h; y++) {
      const a = at(g, edge - 3, y);
      const b = at(g, edge + 3, y);
      if (!a?.[3] || !b?.[3] || u.suitAt(edge + 3, y) || L(a) - L(b) < 60) continue;
      rows++;
      for (let x = edge - 3; x < edge + 3; x++) step = Math.max(step, Math.abs(L(at(g, x, y)!) - L(at(g, x + 1, y)!)));
    }
    expect(rows).toBeGreaterThan(5);
    expect(step).toBeLessThan(50);
  });

  it('الرقبة الظاهرة فوق الياقة تبقى كما هي: لا يُملأ فوقها شيء', () => {
    const t = scene(256);
    const f = neckFill(t.sc, t.paint)!;
    for (let y = Math.ceil(t.lm.chin) + 2; y < 252; y++) for (let x = 180; x <= 220; x++) expect(at(f, x, y)?.[3] ?? 0).toBe(0);
  });
});
