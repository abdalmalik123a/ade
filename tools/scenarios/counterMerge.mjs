/**
 * سيناريو: الدمج في الشبّاك من ملفّ Excel أو CSV مباشرةً (D121 — S36 · SV-5).
 *
 * يتحقّق من:
 * ١ — استيراد الأسماء من جدول Excel مباشرةً عبر زر «من ملف Excel أو CSV».
 * ٢ — استخلاص الأسماء من عمود «الاسم» وتحديث حقل الأسماء وعدد المعاملات.
 * ٣ — تفريغ قائمة الأسماء يعطّل أزرار الإصدار ويمنع الدمج.
 */
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';

const DIR = join(process.env.TEMP ?? '.', `diwan-counter-merge-${Date.now()}`);
const FILE = join(DIR, 'قائمة_الموظفين.xlsx');

export async function prepare() {
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('الموظفون');
  sheet.addRow(['ت', 'الاسم', 'الصف']);
  sheet.addRow([1, 'سالم محمود جاسم', 'الخامس']);
  sheet.addRow([2, 'ليلى عبد الله حسن', 'الخامس']);
  sheet.addRow([3, 'زينب علي حسن', 'الخامس']);
  await book.xlsx.writeFile(FILE);
  return { DIWAN_TEST_OPEN_FILE: FILE };
}

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ١. تجهيز نموذج في الشبّاك يحوي حقل اسم برتبة name
  await page.eval(`
    const doc = {
      blocks: [
        {
          id: 'p1',
          kind: 'paragraph',
          align: 'right',
          inlines: [
            { kind: 'run', text: 'نؤيد مباشرة الموظف ' },
            { kind: 'field', ref: 'الاسم' },
            { kind: 'run', text: ' في عمله.' }
          ]
        }
      ],
      fields: [
        { id: 'f1', key: 'الاسم', label: 'اسم الموظف', type: 'text', role: 'name', source: 'fullName', required: true, width: 14, fillMode: 'printed' }
      ],
      page: { size: 'A4', orientation: 'portrait', margins: { top: 20, bottom: 20, left: 20, right: 20 } },
      letterhead: null,
      issuing: 'registered'
    };
    await window.diwan.templates.save({
      id: null,
      code: null,
      title: 'استمارة مباشرة عمل للموظف',
      subtitle: 'دائرة التربية',
      category: 'تربية',
      subjectLine: 'م/ مباشرة عمل',
      letterheadId: null,
      bodyHtml: 'نؤيد مباشرة الموظف {الاسم} في عمله.',
      variables: [
        { token: 'الاسم', label: 'اسم الموظف', source: 'fullName', required: true }
      ],
      doc
    });
    return true;
  `);

  // ٢. فتح الشبّاك واختيار النموذج
  await page.goto('templates-library-drafts');
  await wait(400);
  await page.goto('service-counter');
  await wait(800);

  // اختيار النموذج بالنقر عليه
  await page.eval(`
    const card = document.querySelector('[data-template-card]');
    if (card) card.click();
    return Boolean(card);
  `);
  await wait(500);
  await page.clickText('املأ (1)');
  await wait(1200);

  // ٣. تفعيل خيار دمج قائمة الأسماء
  const checked = await page.eval(`
    const label = [...document.querySelectorAll('label')].find((l) => l.textContent.includes('قائمة أسماء'));
    const box = label && label.querySelector('input[type="checkbox"]');
    if (!box) return false;
    box.click();
    return true;
  `);
  ok('تفعيل خيار الدمج في الشبّاك', checked);
  await wait(500);

  // ٤. الضغط على زر «من ملف Excel أو CSV»
  const clicked = await page.eval(`
    const btn = document.querySelector('[data-screen="service"] button[data-act="merge-sheet"]');
    if (!btn) return false;
    btn.click();
    return true;
  `);
  ok('العثور على زر «من ملف Excel أو CSV» والضغط عليه', clicked);
  await wait(1500);

  // ٥. التحقّق من استيراد الأسماء المستخلصة من ملف Excel
  const textareaValue = await page.eval(`
    const el = document.querySelector('[data-fill-form] textarea');
    return el?.value ?? '';
  `);
  ok('استيراد الأسماء من ملف Excel بنجاح', textareaValue.includes('سالم محمود جاسم') && textareaValue.includes('ليلى عبد الله حسن') && textareaValue.includes('زينب علي حسن'));

  const countSummary = await page.text();
  ok('حساب عدد الأسماء والأوراق بدقة', (countSummary.includes('٣ أسماء') || countSummary.includes('3 أسماء')) && countSummary.includes('ورقة واحدة') && countSummary.includes('لكل اسم معاملتُه'));

  // ٦. تفريغ النتيجة للتحقّق من منع الدمج
  await page.eval(`
    const el = document.querySelector('[data-fill-form] textarea');
    if (el) {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, '');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  `);
  await wait(500);

  // الانتقال إلى خطوة المراجعة
  await page.clickText('راجع الأوراق');
  await wait(700);

  const isBlocked = await page.eval(`
    const btns = [...document.querySelectorAll('button')].filter((b) => b.textContent.includes('احفظ بلا طباعة') || b.textContent.includes('اطبع'));
    return btns.length > 0 && btns.every((b) => b.hasAttribute('disabled'));
  `);
  ok('تفريغ الأسماء يعطّل أزرار الإصدار ويمنع الدمج', isBlocked);

  return steps;
}
