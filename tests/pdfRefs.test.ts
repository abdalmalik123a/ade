/**
 * صور مرجع مقارنة PDF (G30، D35): `tests/fixtures/pdf-ref/` يكتبها سيناريو `pdfCompare` بـ`DIWAN_PDF_REF=update`، وتبقى في المستودع
 * (قرار المالك) — فمجموعها ٥ م.ب على الأكثر، وكلّ ملفٍّ PNG بمقاس نوعه بدقّة ٥٠: فلا تدخل صورةٌ بدقّةٍ أعلى أو بمقاسٍ آخر،
 * ولا يغيب نوعٌ من الخمسة ولا صفحةٌ من وسطه.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = resolve(__dirname, 'fixtures/pdf-ref');
const LIMIT = 5 * 1024 * 1024;
/** مقاس الورقة بدقّة ٥٠ (ملّيمتر ÷ ٢٥٫٤ × ٥٠): A4 طولًا ٤١٣×٥٨٥ وعرضًا ٥٨٥×٤١٣، وورق الصور ١٠×١٥ إنش ٢٠٠×٣٠٠. */
const SIZE: Record<string, [number, number]> = {
  book: [413, 585],
  design: [585, 413],
  idsheet: [413, 585],
  paper: [413, 585],
  photos: [200, 300]
};
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const files = readdirSync(DIR).sort();

describe('صور مرجع مقارنة PDF (G30)', () => {
  it('مجموعها ٥ م.ب على الأكثر', () => {
    const total = files.reduce((s, f) => s + statSync(join(DIR, f)).size, 0);
    expect(total).toBeLessThanOrEqual(LIMIT);
  });

  it('كلّ ملفٍّ <النوع>-<الصفحة>.png من الأنواع الخمسة، PNG بمقاس نوعه بدقّة ٥٠', () => {
    const bad: string[] = [];
    for (const f of files) {
      const m = /^([a-z]+)-(\d+)\.png$/.exec(f);
      const size = m ? SIZE[m[1]!] : undefined;
      if (!size) {
        bad.push(`${f}: ليس اسم مرجع`);
        continue;
      }
      const head = readFileSync(join(DIR, f)).subarray(0, 24);
      const w = head.readUInt32BE(16);
      const h = head.readUInt32BE(20);
      if (!head.subarray(0, 8).equals(PNG) || head.toString('ascii', 12, 16) !== 'IHDR') bad.push(`${f}: ليس PNG`);
      else if (Math.abs(w - size[0]) > 1 || Math.abs(h - size[1]) > 1) bad.push(`${f}: ${w}×${h} والمنتظر ${size.join('×')}`);
    }
    expect(bad).toEqual([]);
  });

  it('الأنواع الخمسة كلّها، وصفحات كلٍّ متتاليةٌ من ١', () => {
    for (const kind of Object.keys(SIZE)) {
      const pages = files
        .map((f) => new RegExp(`^${kind}-(\\d+)\\.png$`).exec(f))
        .filter((m): m is RegExpExecArray => Boolean(m))
        .map((m) => Number(m[1]))
        .sort((a, b) => a - b);
      expect(pages.length, kind).toBeGreaterThan(0);
      expect(pages, kind).toEqual(pages.map((_, i) => i + 1));
    }
  });
});
