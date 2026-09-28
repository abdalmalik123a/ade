/**
 * قارئ ظهر البطاقة الخاصّ (تعميق الموجود ٨).
 *
 * جُرِّب القارئ العامّ على نسخةٍ حقيقية من البطاقة الموحّدة (٢٨ أيلول ٢٠٢٦) فلم يقرأ سطورها:
 * العربيّ على الصفحة كلّها يخلطها بحروفه، والإنكليزيّ يرى «<» C أو L أو K. وتقسيمه للصفحة لم
 * يرَ فيها نصًّا أصلًا. فهنا طريقٌ خاصّ:
 * ١. **تُوجد السطور من الصورة** (`@shared/mrzLocate`): ثلاثة أسطرٍ من رموزٍ منفصلة متساوية
 *    بخطوةٍ ثابتة — بلا قارئ.
 * ٢. **تُقصّ من الأصل** وتُنعَّم قليلًا (تخطيط النسخة يقطع الحروف)، وتُصغَّر أو تُكبَّر حتى
 *    يصير الرمز نحو ثلاثين بكسلًا، وتصير أبيض وأسود بعتبةٍ لكلّ رمز (فالطرف الباهت لا يُمحى).
 * ٣. **تُقرأ بحروف MRZ وحدها**، وكلّ رمزٍ في خانته من موضعه على سطره، و«<» من شكله،
 *    والملتبس تحسمه أرقام التحقّق (`@shared/mrz`). والبطاقة الممسوحة مقلوبةً تُقلب قطعتها.
 *
 * والصورة والقارئ يُمرَّران من الخارج (محرّك الصور وtesseract في التطبيق) — فيُختبر بلا Electron.
 */
import { parseTD1, settleTD1, slotLine, type MrzResult, type MrzSymbol } from '@shared/mrz';
import { binarizeLocal, blurGray, chevronShape, cropGray, leftInk, looksLikeChevron, otsu, resizeGray, rotate180, toRgba, type Box } from '@shared/mrzImage';
import { components, glyphLines, pickMrz, type GlyphLine } from '@shared/mrzLocate';
import { writePng } from './png';

export type OcrLine = { text: string; box: Box; symbols: { text: string; box: Box }[] };
/** قراءة صورة PNG أسطرًا برموزها — كتلةً واحدة، وبالحروف المسموحة وحدها إن أُعطيت. */
export type LinesOcr = (png: Uint8Array, opts: { whitelist?: string }) => Promise<OcrLine[]>;

export const MRZ_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';

export type CardBackRead = { result: MrzResult | null; lines: string[] };

/** سطرٌ بصندوقه ورموزه (قطع حبره) ووسطه على امتداده — في إحداثيّات صورته. */
export type MrzLine = Pick<GlyphLine, 'box' | 'glyphs' | 'height' | 'a' | 'b'>;

/** السطر في صورةٍ قُصّت عند (dx, dy) ثمّ كُبّرت s مرّة. */
function moveLine(l: MrzLine, s: number, dx: number, dy: number): MrzLine {
  const box = (b: Box): Box => ({ x0: (b.x0 - dx) * s, y0: (b.y0 - dy) * s, x1: (b.x1 - dx) * s, y1: (b.y1 - dy) * s });
  return { box: box(l.box), glyphs: l.glyphs.map(box), height: l.height * s, a: s * (l.a + l.b * dx - dy), b: l.b };
}

/** السطر في الصورة مقلوبةً نصف دورة (فتنعكس رموزه). */
function flipLine(l: MrzLine, width: number, height: number): MrzLine {
  const box = (b: Box): Box => ({ x0: width - b.x1, y0: height - b.y1, x1: width - b.x0, y1: height - b.y0 });
  return { box: box(l.box), glyphs: l.glyphs.map(box).reverse(), height: l.height, a: height - l.a - l.b * width, b: l.b };
}

/** أين السطور الثلاثة في الصورة — بإحداثيّاتها الأصلية. */
export function locateMrz(img: { gray: Uint8Array; width: number; height: number }): MrzLine[] | null {
  // صورةٌ مصغَّرة أسرع، والبصمة تُرى فيها.
  const k = Math.min(1, 1300 / img.width);
  const small = k < 1 ? resizeGray(img.gray, img.width, img.height, k) : img;
  const bin = binarizeLocal(small.gray, small.width, small.height, 20);
  const found = pickMrz(glyphLines(components(bin, small.width, small.height)));
  return found ? found.lines.map((l) => moveLine(l, 1 / k, 0, 0)) : null;
}

/** كم تحقّق من القراءة — والصحيحة كلّها فوق الجميع. */
const score = (r: CardBackRead) => (r.result ? Object.values(r.result.checks).filter(Boolean).length + (r.result.valid ? 10 : 0) : -1);

/** أكثر ما قالته القراءات في كلّ خانة (والتعادل للأولى). */
export function voteLines(readings: string[][]): string[] {
  return readings[0]!.map((line, i) =>
    [...line]
      .map((first, k) => {
        const count = new Map<string, number>();
        for (const r of readings) count.set(r[i]![k]!, (count.get(r[i]![k]!) ?? 0) + 1);
        return [...count].reduce((best, c) => (c[1] > best[1] ? c : best), [first, count.get(first)!])[0];
      })
      .join('')
  );
}

/**
 * يقرأ سطور ظهر البطاقة من صورةٍ رمادية (المسح كلّه أو البطاقة وحدها).
 *
 * والقارئ يخطئ رقمًا بثقةٍ عالية أحيانًا بحجمٍ ويصيبه بغيره: نسخةٌ حقيقية قُرئت بسبعة أحجام
 * فتطابقت ستٌّ منها وتحقّقت أرقامها كلّها، وأخطأت واحدةٌ رقمًا في رقم الوثيقة — فكشفه رقم
 * تحقّقه (خطأ رقمٍ واحد لا يمرّ برقم التحقّق أبدًا). فتُقرأ بحجم، فإن لم تتحقّق فمقلوبةً، ثم
 * بحجمين آخرين، ثم يُصوَّت على كلّ خانة — وأوّل قراءةٍ تتحقّق أرقامها كلّها تُعتمد.
 */
export async function readCardBack(img: { gray: Uint8Array; width: number; height: number }, ocr: LinesOcr): Promise<CardBackRead> {
  const lines = locateMrz(img);
  if (!lines) return { result: null, lines: [] };

  // السطور من الأصل بدقّته، بهامشٍ حولها، منعَّمةً قليلًا.
  const h = lines[1]!.height;
  const area = {
    x0: Math.max(0, Math.floor(Math.min(...lines.map((l) => l.box.x0)) - h)),
    y0: Math.max(0, Math.floor(Math.min(...lines.map((l) => l.box.y0)) - h * 0.8)),
    x1: Math.max(...lines.map((l) => l.box.x1)) + h,
    y1: Math.max(...lines.map((l) => l.box.y1)) + h * 0.8
  };
  const cut = cropGray(img.gray, img.width, img.height, area);
  const smooth = blurGray(cut.gray, cut.width, cut.height, Math.round(h * 0.04));

  /** القطعة بحجمٍ يصير فيه الرمز `target` بكسلًا، قائمةً أو مقلوبة (فيصير سطرها الأخير أوّلًا). */
  const readAt = (target: number, flipped: boolean) => {
    const scale = Math.min(4, Math.max(0.5, target / h));
    const big = Math.abs(scale - 1) > 0.05 ? resizeGray(smooth, cut.width, cut.height, scale) : { gray: smooth, width: cut.width, height: cut.height };
    const upright = lines.map((l) => moveLine(l, big.width / cut.width, area.x0, area.y0));
    return flipped
      ? readLines(rotate180(big.gray), big.width, big.height, upright.map((l) => flipLine(l, big.width, big.height)).reverse(), ocr)
      : readLines(big.gray, big.width, big.height, upright, ocr);
  };

  const upright = await readAt(32, false);
  if (upright.result?.valid) return upright;
  const flippedRead = await readAt(32, true);
  if (flippedRead.result?.valid) return flippedRead;
  const flipped = score(flippedRead) > score(upright);
  const tries = [flipped ? flippedRead : upright];
  for (const target of [44, 26]) {
    const r = await readAt(target, flipped);
    if (r.result?.valid) return r;
    tries.push(r);
  }
  const whole = tries.filter((t) => t.result && t.lines.length === 3);
  if (whole.length === 3) {
    const voted = voteLines(whole.map((t) => t.lines));
    const result = parseTD1(voted);
    if (result?.valid) return { result, lines: voted };
  }
  return tries.reduce((best, t) => (score(t) > score(best) ? t : best));
}

/**
 * قراءة القطعة وتوزيع رموزها على السطور بمواضعها. السطر الذي وُجدت له ثلاثون قطعةً (رمزٌ لكلّ
 * خانة): «<» فيه يُعرف من شكله ويُمحى قبل القراءة — فالقارئ يراه K، ثمّ يُكمل على ذلك فيقرأ
 * الرقم بعده حرفًا (قرأ 8 في آخر السطر Y بثقةٍ عالية) — وتأخذ كلّ قطعةٍ باقيةٍ أقرب ما قرأه.
 * وغيره يُوزَّع بمواضع ما قرأه القارئ على عرض السطر، و«<» فيه ما قرأه C أو L أو K وشكله شكله.
 */
async function readLines(gray: Uint8Array, width: number, height: number, lines: MrzLine[], ocr: LinesOcr): Promise<CardBackRead> {
  // حبرُ صناديق الرموز وحده، ولكلّ رمزٍ عتبته من بكسلاته (Otsu) — فأوّل السطر الباهت في نسخةٍ
  // حقيقية لا يُمحى، ونقش البطاقة خلفها أفتح من الحبر فيسقط.
  const bin = new Uint8Array(width * height);
  for (const l of lines) {
    const pad = l.height * 0.12;
    for (const g of l.glyphs) {
      const x0 = Math.max(0, Math.floor(g.x0 - pad));
      const y0 = Math.max(0, Math.floor(g.y0 - pad));
      const x1 = Math.min(width, Math.ceil(g.x1 + pad));
      const y1 = Math.min(height, Math.ceil(g.y1 + pad));
      const values: number[] = [];
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) values.push(gray[y * width + x]!);
      const t = otsu(values);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) bin[y * width + x] = gray[y * width + x]! <= t ? 1 : 0;
    }
  }
  const whole = lines.map((l) => l.glyphs.length === 30);
  const isChevron = lines.map((l, i) => l.glyphs.map((g) => whole[i]! && chevronShape(bin, width, g)));
  const page = Uint8Array.from(bin);
  lines.forEach((l, i) =>
    l.glyphs.forEach((g, k) => {
      if (!isChevron[i]![k]) return;
      const pad = l.height * 0.12;
      for (let y = Math.max(0, Math.floor(g.y0 - pad)); y < Math.min(height, Math.ceil(g.y1 + pad)); y++) {
        for (let x = Math.max(0, Math.floor(g.x0 - pad)); x < Math.min(width, Math.ceil(g.x1 + pad)); x++) page[y * width + x] = 0;
      }
    })
  );
  const read = await ocr(writePng(toRgba(page, true), width, height, 300), { whitelist: MRZ_CHARS });
  const found: { text: string; box: Box }[][] = lines.map(() => []);
  for (const sym of read.flatMap((l) => l.symbols)) {
    const cx = (sym.box.x0 + sym.box.x1) / 2;
    const cy = (sym.box.y0 + sym.box.y1) / 2;
    const off = lines.map((l) => Math.abs(cy - (l.a + l.b * cx)));
    const i = off.indexOf(Math.min(...off));
    if (off[i]! < lines[i]!.height * 0.6) found[i]!.push(sym);
  }
  const raw = lines.map((l, i) => {
    if (whole[i]) {
      const texts: (string | undefined)[] = Array(30).fill(undefined);
      const open = l.glyphs.map((_, k) => k).filter((k) => !isChevron[i]![k]);
      for (const sym of found[i]!) {
        const cx = (sym.box.x0 + sym.box.x1) / 2;
        const k = open.reduce((best, j) => (Math.abs((l.glyphs[j]!.x0 + l.glyphs[j]!.x1) / 2 - cx) < Math.abs((l.glyphs[best]!.x0 + l.glyphs[best]!.x1) / 2 - cx) ? j : best), open[0] ?? 0);
        texts[k] ??= sym.text;
      }
      return {
        left: l.glyphs[0]!.x0,
        right: l.glyphs[29]!.x1,
        symbols: l.glyphs.map((g, k): MrzSymbol => ({ text: texts[k] ?? '<', x0: g.x0, x1: g.x1, chevron: isChevron[i]![k] }))
      };
    }
    return {
      left: l.box.x0,
      right: l.box.x1,
      symbols: found[i]!.map(
        (sym): MrzSymbol => ({ text: sym.text, x0: sym.box.x0, x1: sym.box.x1, chevron: /^[CKL<]$/.test(sym.text) && looksLikeChevron(leftInk(bin, width, sym.box)) })
      )
    };
  });
  const settled = settleTD1(raw);
  return { result: settled ? parseTD1(settled) : null, lines: settled ?? raw.map((r) => slotLine(r.symbols, r.left, r.right)) };
}
