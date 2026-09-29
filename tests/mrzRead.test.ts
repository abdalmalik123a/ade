/**
 * قارئ ظهر البطاقة الخاصّ (تعميق الموجود ٨).
 *
 * العيّنة `fixtures/card-back-fake.png` ببياناتٍ مخترعة، بظواهر نسخةٍ مصوّرة حقيقية للبطاقة
 * الموحّدة كسرت القارئ واحدةً واحدة (انظر `fixtures/README.md`). والنسخة الحقيقية نفسها قُرئت
 * بأرقام تحقّقها الأربعة ثمّ حُذفت — فيها بيانات مواطن.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createWorker, PSM, type Worker } from 'tesseract.js';
import { readCardBack, locateMrz, voteLines, type LinesOcr, type OcrLine } from '../src/main/services/mrzRead';
import { parseTD1, settleTD1, type MrzSymbol } from '../src/shared/mrz';
import { chevronShape, resizeGray, rotate180 } from '../src/shared/mrzImage';
import { readGrayPng } from './helpers';

const card = readGrayPng(readFileSync(join(__dirname, 'fixtures', 'card-back-fake.png')));
// ما رسمه `tools/mrz-fixture.mjs`.
const MRZ = ['IDIRQZ123456789199012345678<<<', '9001158M3102204IRQ<<<<<<<<<<<1', '<<SAMIR<KHALID<<<<<<<<<<<<<<<<'];

describe('إيجاد السطور من الصورة', () => {
  it('ثلاثة أسطرٍ من ثلاثين رمزًا — بين كلامٍ عربيّ وغبارٍ وتخطيطٍ وميل', () => {
    const lines = locateMrz(card)!;
    expect(lines).toHaveLength(3);
    expect(lines.map((l) => l.glyphs.length)).toEqual([30, 30, 30]);
    expect(lines[0]!.box.y0).toBeLessThan(lines[1]!.box.y0);
    expect(lines[1]!.box.y0).toBeLessThan(lines[2]!.box.y0);
    // الميل درجةٌ واحدة: ينزل السطر نحو نصف بكسلٍ كلّ ثلاثين.
    expect(lines[0]!.b).toBeGreaterThan(0.01);
    expect(lines[0]!.b).toBeLessThan(0.03);
  });

  it('والمقلوبة كذلك — والصورة بلا سطورٍ لا يُخترع لها شيء', () => {
    const flipped = { ...card, gray: rotate180(card.gray) };
    expect(locateMrz(flipped)?.map((l) => l.glyphs.length)).toEqual([30, 30, 30]);
    // أعلى البطاقة وحده: عربيٌّ ونقاط.
    const top = { gray: card.gray.slice(0, card.width * 420), width: card.width, height: 420 };
    expect(locateMrz(top)).toBeNull();
  });
});

describe('«<» من شكله', () => {
  /** رمزٌ بخطوطٍ سميكة على شبكة ٤٠×٤٠، وصندوق حبره. */
  function glyph(strokes: [number, number][][]) {
    const width = 40;
    const bin = new Uint8Array(width * width);
    for (const path of strokes) {
      for (let k = 0; k + 1 < path.length; k++) {
        const [ax, ay] = path[k]!;
        const [bx, by] = path[k + 1]!;
        for (let t = 0; t <= 1; t += 0.005) {
          const x = ax + (bx - ax) * t;
          const y = ay + (by - ay) * t;
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) bin[Math.round(y + dy) * width + Math.round(x + dx)] = 1;
        }
      }
    }
    const xs: number[] = [];
    const ys: number[] = [];
    bin.forEach((v, i) => v && (xs.push(i % width), ys.push(Math.floor(i / width))));
    return { bin, width, box: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs) + 1, y1: Math.max(...ys) + 1 } };
  }
  const shapes: Record<string, [number, number][][]> = {
    '<': [[[32, 12], [8, 20], [32, 28]]],
    K: [[[6, 3], [6, 37]], [[32, 3], [8, 20], [32, 37]]],
    T: [[[4, 3], [34, 3]], [[19, 3], [19, 37]]],
    '7': [[[4, 3], [32, 3], [14, 37]]],
    X: [[[5, 3], [33, 37]], [[33, 3], [5, 37]]],
    C: [[[32, 7], [22, 3], [11, 5], [6, 12], [5, 20], [6, 28], [11, 35], [22, 37], [32, 33]]],
    Z: [[[5, 3], [33, 3], [5, 37], [33, 37]]],
    '1': [[[10, 10], [20, 3], [20, 37]]]
  };

  it('رأسٌ في وسط اليسار وطرفان يمينًا — وما سواه ليس «<»', () => {
    const verdict = Object.fromEntries(Object.entries(shapes).map(([k, s]) => [k, chevronShape(glyph(s).bin, 40, glyph(s).box)]));
    expect(verdict).toEqual({ '<': true, K: false, T: false, '7': false, X: false, C: false, Z: false, '1': false });
  });
});

describe('الصورة قبل القارئ', () => {
  it('التصغير بمتوسّط ما يغطّيه البكسل — فنقاط حبر النسخة لا تصير خطوطًا', () => {
    // رقعة شطرنجٍ بكسلًا بكسلًا: أخذُ بكسلٍ واحدٍ يعطي أسود أو أبيض، والمتوسّط رماديّ.
    const w = 64;
    const board = Uint8Array.from({ length: w * w }, (_, i) => ((i % w) + Math.floor(i / w)) % 2 ? 255 : 0);
    const half = resizeGray(board, w, w, 0.5);
    expect(new Set(half.gray)).toEqual(new Set([128]));
  });

  it('صفحةٌ كاملة بدقّة ٣٠٠ نقطة بلا سطور: لا شيء، ولا سقوط (عتبة الصفحة كانت تجاوز حدّ المكدّس)', () => {
    const w = 2550;
    const h = 3508;
    expect(locateMrz({ gray: new Uint8Array(w * h).fill(200), width: w, height: h })).toBeNull();
  });
});

describe('من الرموز إلى الحقول', () => {
  const readMrzSymbols = (raw: { symbols: MrzSymbol[]; left: number; right: number }[]) => {
    const lines = settleTD1(raw);
    return lines ? parseTD1(lines) : null;
  };
  /** سطرٌ رموزًا بمواضعها — كلّ رمزٍ في خانته. */
  const symbols = (line: string, chevrons: number[] = []): { symbols: MrzSymbol[]; left: number; right: number } => ({
    left: 0,
    right: 300,
    symbols: [...line].map((text, i) => ({ text, x0: i * 10 + 1, x1: i * 10 + 8, chevron: chevrons.includes(i) }))
  });

  it('الحرف في خانة الرقم رقمٌ، والرقم في خانة الحرف حرف، و«<» الذي قُرئ K من شكله', () => {
    const r = readMrzSymbols([
      symbols('1DIRQZ123456789199012345678KKK', [27, 28, 29]),
      symbols('9OO1158M31O22O41RQ<<<<<<<<<<<I'),
      symbols('<<SAM1R<KHAL1D<<<<<<<<<<<<<<<<')
    ])!;
    expect(r).toMatchObject({
      documentCode: 'ID',
      issuer: 'IRQ',
      documentNumber: 'Z12345678',
      optional1: '199012345678',
      birthDate: '1990-01-15',
      sex: 'ذكر',
      expiryDate: '2031-02-20',
      nationality: 'IRQ',
      surname: '',
      givenNames: 'SAMIR KHALID',
      valid: true
    });
  });

  it('وفي رقم الوثيقة (حروفٌ وأرقام) يحسم رقمُ التحقّق الملتبس', () => {
    const r = readMrzSymbols([symbols('IDIRQ2123456789199012345678<<<'), symbols(MRZ[1]!), symbols(MRZ[2]!)])!;
    expect(r.documentNumber).toBe('Z12345678');
    expect(r.valid).toBe(true);
  });

  it('ورمزٌ لم يُقرأ «<» — فيكشفه رقم التحقّق لا يُخترع', () => {
    const line = symbols(MRZ[0]!);
    line.symbols.splice(8, 1);
    const r = readMrzSymbols([line, symbols(MRZ[1]!), symbols(MRZ[2]!)])!;
    expect(r.checks.documentNumber).toBe(false);
    expect(r.valid).toBe(false);
  });
});

describe('قراءاتٌ بأحجام', () => {
  it('أكثر ما قالته القراءات في كلّ خانة', () => {
    expect(voteLines([['AB1', 'XY'], ['AB2', 'XZ'], ['AC2', 'XZ']])).toEqual(['AB2', 'XZ']);
    // التعادل للأولى.
    expect(voteLines([['A'], ['B']])).toEqual(['A']);
  });
});

describe('القراءة كلّها بالقارئ المحلي (tesseract، الإنكليزية)', () => {
  let worker: Worker;
  const ocr: LinesOcr = async (png, opts) => {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, tessedit_char_whitelist: opts.whitelist ?? '', user_defined_dpi: '300' });
    const { data } = await worker.recognize(Buffer.from(png), {}, { blocks: true });
    const lines: OcrLine[] = [];
    for (const b of data.blocks ?? []) {
      for (const p of b.paragraphs) {
        for (const l of p.lines) lines.push({ text: l.text, box: l.bbox, symbols: l.words.flatMap((w) => w.symbols.map((s) => ({ text: s.text, box: s.bbox }))) });
      }
    }
    return lines;
  };
  beforeAll(async () => {
    worker = await createWorker(['eng'], 1, { langPath: join(__dirname, '..', 'resources', 'tessdata'), gzip: true, cacheMethod: 'none' });
  }, 60_000);
  afterAll(() => worker?.terminate());

  it('السطور الثلاثة كما رُسمت، وأرقام تحقّقها كلّها', async () => {
    const r = await readCardBack(card, ocr);
    expect(r.lines).toEqual(MRZ);
    expect(r.result).toMatchObject({ documentNumber: 'Z12345678', optional1: '199012345678', birthDate: '1990-01-15', valid: true });
  }, 60_000);

  it('رقمٌ أخطأه القارئ بحجمٍ يكشفه رقم تحقّقه، ويُقرأ بحجمٍ آخر', async () => {
    // كما في النسخة الحقيقية: رقمٌ في رقم الوثيقة قُرئ غيره بثقةٍ عالية في قراءةٍ واحدة.
    let calls = 0;
    const once: LinesOcr = async (png, opts) => {
      const lines = await ocr(png, opts);
      if (calls++ === 0) {
        const sym = lines[0]!.symbols.find((x) => x.text === '4')!;
        sym.text = '9';
      }
      return lines;
    };
    const r = await readCardBack(card, once);
    expect(calls).toBeGreaterThan(1);
    expect(r.result).toMatchObject({ documentNumber: 'Z12345678', valid: true });
  }, 60_000);

  it('والبطاقة ممسوحةً مقلوبة تُقرأ', async () => {
    const r = await readCardBack({ ...card, gray: rotate180(card.gray) }, ocr);
    expect(r.result?.valid).toBe(true);
    expect(r.result?.givenNames).toBe('SAMIR KHALID');
  }, 60_000);
});
