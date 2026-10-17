/**
 * سقوف الاستيراد (A07 أ، D51): الحدّ نفسه يُقبل والحدّ+١ يُرفض برسالته — قبل أن يُقرأ الملفّ أو يُفكّ. والحدود تُمرَّر
 * صغيرةً هنا، فلا ملفّ كبير في الاختبار.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  IMPORT_LIMITS,
  MAX_PIXELS,
  ZIP_LIMITS,
  ZIP_TOO_BIG,
  psdHeader,
  tooLarge,
  tooManyPixels,
  zipBudget,
  type ImportKind
} from '../src/shared/importLimits';
import { assertPixels, designKind, ImportLimitError, zipFilter } from '../src/main/services/importGuard';
import { wordDesign } from '../src/main/services/designImport';
import { importContent } from '../src/main/services/contentPack';
import { importTemplateFile } from '../src/main/services/import';
import { freshDb } from './helpers';

const MESSAGES: Record<ImportKind, string> = {
  word: 'ملفّ Word أكبر من ١٠٠ ميغابايت — لا يُفتح هنا',
  excel: 'ملفّ Excel أكبر من ٥٠ ميغابايت — لا يُفتح هنا',
  pdf: 'ملفّ PDF أكبر من ١٥٠ ميغابايت — لا يُفتح هنا',
  psd: 'ملفّ Photoshop أكبر من ١٢٥ ميغابايت — لا يُفتح هنا',
  image: 'الصورة أكبر من ١٠٠ ميغابايت — لا تُفتح هنا'
};

/** رأس Photoshop وحده (٢٦ بايتًا) بمقاسٍ يُكتب فيه — كما يبدأ الملفّ على القرص. */
function psdHead(width: number, height: number, version = 1): Uint8Array {
  const b = Buffer.alloc(26);
  b.write('8BPS', 0, 'ascii');
  b.writeUInt16BE(version, 4);
  b.writeUInt16BE(3, 12);
  b.writeUInt32BE(height, 14);
  b.writeUInt32BE(width, 18);
  b.writeUInt16BE(8, 22);
  b.writeUInt16BE(3, 24);
  return new Uint8Array(b);
}

/** أرشيفٌ بمداخل صغيرةٍ كثيرة — يتجاوز عددها الحدّ وحجمه صغير. */
const manyEntries = (n: number) => zipSync(Object.fromEntries(Array.from({ length: n }, (_, i) => [`f${i}.txt`, strToU8('x')])));

describe('حدّ الحجم لكلّ نوع', () => {
  it.each(Object.keys(MESSAGES) as ImportKind[])('%s: الحدّ نفسه يُقبل، والحدّ+١ يُرفض برسالته', (kind) => {
    expect(tooLarge(kind, IMPORT_LIMITS[kind])).toBeNull();
    expect(tooLarge(kind, IMPORT_LIMITS[kind] + 1)).toBe(MESSAGES[kind]);
    expect(tooLarge(kind, 0)).toBeNull();
  });
});

describe('حدّ النقاط', () => {
  it('الصورة: ١٠٠ مليون تُقبل، وفوقها يُرفض بمقاسها', () => {
    expect(tooManyPixels('image', 10_000, 10_000)).toBeNull();
    expect(tooManyPixels('image', 20_000, 8_000)).toBe('الصورة أكبر من ١٠٠ مليون نقطة (٢٠٠٠٠×٨٠٠٠) — صغّرها ثم استوردها');
  });

  it('وPhotoshop: ٢٥ مليونًا تُقبل، وفوقها يُرفض', () => {
    expect(MAX_PIXELS.psd).toBe(25_000_000);
    expect(tooManyPixels('psd', 5_000, 5_000)).toBeNull();
    expect(tooManyPixels('psd', 5_000, 5_001)).toBe('ملفّ Photoshop أكبر من ٢٥ مليون نقطة (٥٠٠٠×٥٠٠١) — صغّره ثم استورده');
  });

  it('ورأس Photoshop ٣٠٠٠٠×٣٠٠٠٠ يُرفض من بايتاته الستّة والعشرين — قبل أن يُفكّ شيء', () => {
    const head = psdHead(30_000, 30_000);
    expect(psdHeader(head)).toEqual({ width: 30_000, height: 30_000 });
    expect(() => assertPixels(head, 'psd')).toThrow(ImportLimitError);
    expect(() => assertPixels(head, 'psd')).toThrow('ملفّ Photoshop أكبر من ٢٥ مليون نقطة (٣٠٠٠٠×٣٠٠٠٠) — صغّره ثم استورده');
    // وPSB (الإصدار ٢) كذلك، وما ليس رأسًا لا يُحكم عليه هنا.
    expect(psdHeader(psdHead(30_000, 30_000, 2))).toEqual({ width: 30_000, height: 30_000 });
    expect(psdHeader(psdHead(10, 10, 3))).toBeNull();
    expect(() => assertPixels(psdHead(1000, 1000), 'psd')).not.toThrow();
  });

  it('والنوع من الامتداد كما يقرؤه «استورد تصميمًا»', () => {
    expect(['ش.docx', 'ش.PSD', 'ش.pdf', 'ش.png', 'ش.webp'].map(designKind)).toEqual(['word', 'psd', 'pdf', 'image', 'image']);
  });
});

describe('ميزانية الأرشيف', () => {
  const small = { entries: 2, bytes: 10 };

  it('العدد والحجم بعد الفكّ — الحدّ نفسه يُقبل', () => {
    expect(zipBudget([{ size: 5 }, { size: 5 }], small)).toBeNull();
    expect(zipBudget([{ size: 1 }, { size: 1 }, { size: 1 }], small)).toBe(ZIP_TOO_BIG);
    expect(zipBudget([{ size: 6 }, { size: 5 }], small)).toBe(ZIP_TOO_BIG);
  });

  it('ومرشّح unzipSync يرمي عند المدخل الزائد والحجم الزائد', () => {
    const three = zipSync({ a: strToU8('xx'), b: strToU8('yy'), c: strToU8('zz') });
    expect(() => unzipSync(three, { filter: zipFilter(small) })).toThrow(ZIP_TOO_BIG);
    const big = zipSync({ a: strToU8('x'.repeat(11)) });
    expect(() => unzipSync(big, { filter: zipFilter(small) })).toThrow(ZIP_TOO_BIG);
    expect(Object.keys(unzipSync(zipSync({ a: strToU8('xxxxx'), b: strToU8('yyyyy') }), { filter: zipFilter(small) }))).toEqual(['a', 'b']);
  });

  // عشرون ألف مدخلٍ تُضغط وتُفكّ ثلاث مرّات — فالمهلة أطول من الافتراضية.
  it('وWord بمداخل أكثر من حدّه يقول الحدّ لا «تالف» — في التصميم والنموذج', { timeout: 60_000 }, async () => {
    const bytes = manyEntries(ZIP_LIMITS.word.entries + 1);
    expect(() => wordDesign(bytes, 'كثير.docx')).toThrow(ZIP_TOO_BIG);
    const file = join(mkdtempSync(join(tmpdir(), 'diwan-limits-')), 'كثير.docx');
    writeFileSync(file, bytes);
    await expect(importTemplateFile(file)).rejects.toThrow(ZIP_TOO_BIG);
  });

  it('والحزمة بمداخل أكثر من حدّها تُرفض قبل أن يُفكّ منها شيء', { timeout: 60_000 }, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-limits-'));
    const file = join(dir, 'كثير.diwanpack');
    writeFileSync(file, manyEntries(ZIP_LIMITS.pack.entries + 1));
    await expect(importContent(file, freshDb(), join(dir, 'store'), join(dir, 'work'))).rejects.toThrow(ZIP_TOO_BIG);
  });
});
