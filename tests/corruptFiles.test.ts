/**
 * الملفات الفاسدة (المرحلة ٧ — الحوافّ): كلّ بابٍ يفتح ملفًّا يُقال فيه خطأٌ يفهمه
 * الموظف — بالعربية وبسببه — لا رسالةُ جافاسكربت داخلية («Cannot read properties of
 * undefined»)، ولا نتيجةٌ فارغة تُوهم أن الملف قُرئ.
 *
 * والفاسد هنا نوعان يقعان فعلًا: بايتاتٌ لا صلة لها بالامتداد (ملفٌّ أُعيدت تسميته)،
 * وملفٌّ صحيحُ البداية مقطوعٌ (تنزيلٌ لم يكتمل، أو فلاشةٌ نُزعت في منتصف النسخ).
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importTemplateFile } from '../src/main/services/import';
import { readDesign } from '../src/main/services/designImport';
import { sheetToText } from '../src/main/services/sheetRead';
import { imageMeta } from '../src/main/services/imageSize';

const dir = mkdtempSync(join(tmpdir(), 'diwan-corrupt-'));
const garbage = Buffer.from('هذا ليس ملفًّا — بل نصٌّ أُعيدت تسميته. '.repeat(40), 'utf8');
const docx = readFileSync(join(__dirname, 'fixtures', 'school-warning.docx'));
const file = (name: string, bytes: Uint8Array) => {
  const p = join(dir, name);
  writeFileSync(p, bytes);
  return p;
};

/** رسالةٌ للموظف: فيها حروفٌ عربية، وليست من داخل المحرّك. */
const ARABIC = /[ء-ي]/;
const INTERNAL = /Cannot read|undefined|is not a function|of null|Unexpected token|RangeError|TypeError|offset/i;

async function failure(run: () => unknown): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

const cases: [string, () => unknown][] = [
  ['Word: نصٌّ باسم docx', () => importTemplateFile(file('fake.docx', garbage), () => '')],
  ['Word: ملفٌّ مقطوع', () => importTemplateFile(file('cut.docx', docx.subarray(0, 1500)), () => '')],
  ['XML: نصٌّ فاسد', () => importTemplateFile(file('fake.xml', garbage), () => '')],
  ['تصميم: PSD فاسد', () => readDesign(garbage, 'fake.psd')],
  ['تصميم: PSD مقطوع', () => readDesign(Buffer.concat([Buffer.from('8BPS'), Buffer.alloc(30)]), 'cut.psd')],
  ['تصميم: PDF فاسد', () => readDesign(garbage, 'fake.pdf')],
  ['تصميم: صورة فاسدة', () => readDesign(garbage, 'fake.png')],
  ['تصميم: Word فاسد', () => readDesign(garbage, 'fake.docx')],
  ['Excel: نصٌّ باسم xlsx', () => sheetToText(file('fake.xlsx', garbage))]
];

describe('كلّ ملفٍّ فاسد يُقال بالعربية وبسببه', () => {
  for (const [label, run] of cases) {
    it(label, async () => {
      const message = await failure(run);
      expect(message, `${label}: قُبل الملف الفاسد صامتًا`).not.toBeNull();
      expect(message!, `${label}: «${message}»`).toMatch(ARABIC);
      expect(message!, `${label}: «${message}»`).not.toMatch(INTERNAL);
    });
  }

  it('ومقاس صورةٍ فاسدة لا يُخمَّن', () => {
    expect(imageMeta(garbage)).toBeNull();
    expect(imageMeta(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
  });
});
