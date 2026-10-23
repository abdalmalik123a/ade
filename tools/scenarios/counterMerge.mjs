/**
 * سيناريو: الدمج في الشبّاك من ملفّ Excel أو CSV مباشرةً (D121 — S36 · SV-5).
 *
 * يتحقّق من:
 * ١ — استيراد الأسماء من جدول Excel مباشرةً عبر زر «من ملف Excel أو CSV».
 * ٢ — استخلاص الأسماء من عمود «الاسم» وتحديث حقل الأسماء وعدد المعاملات.
 * ٣ — تفريغ قائمة الأسماء يعطّل أزرار الإصدار ويمنع الدمج.
 * و(D137): رأس الملفّ «ت | الإسم | الصف» بالهمزة كما تكتبه المدارس — كانت الأسماء «ت ١ ٢ ٣» —
 * ثم بعد إعادة الفتح ملفّ `.xls` قديم: سببه يُقال تحت الزرّ (كان استثناءً غير ممسوك بلا رسالة).
 * والحوار لا يُضغط آليًّا فبابه ملفٌّ واحد لكلّ إقلاع (`DIWAN_TEST_OPEN_FILE`): يُبدَّل بين الإقلاعين.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';

const DIR = join(process.env.TEMP ?? '.', `diwan-counter-merge-${Date.now()}`);
const FILE = join(DIR, 'قائمة_الموظفين.xlsx');
const XLS = join(DIR, 'قائمة_قديمة.xls');
/** بيئة الإقلاع — `drive.mjs` ينشرها عند كلّ إقلاع، فيُبدَّل ملفّها قبل الثاني. */
let ENV;

export async function prepare() {
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('الموظفون');
  sheet.addRow(['ت', 'الإسم', 'الصف']);
  sheet.addRow([1, 'سالم محمود جاسم', 'الخامس']);
  sheet.addRow([2, 'ليلى عبد الله حسن', 'الخامس']);
  sheet.addRow([3, 'زينب علي حسن', 'الخامس']);
  await book.xlsx.writeFile(FILE);
  ENV = { DIWAN_TEST_OPEN_FILE: FILE };
  return ENV;
}

export async function betweenRestarts() {
  writeFileSync(XLS, 'ملف Excel قديم');
  ENV.DIWAN_TEST_OPEN_FILE = XLS;
}

/** يفتح النموذج في الشبّاك ويُشعل «قائمة أسماء» — في الإقلاعين. */
async function openMerge(page, wait) {
  await page.goto('templates-library-drafts');
  await wait(400);
  await page.goto('service-counter');
  await wait(800);
  await page.eval(`
    const card = document.querySelector('[data-template-card]');
    if (card) card.click();
    return Boolean(card);
  `);
  await wait(500);
  await page.clickText('املأ (1)');
  await wait(1200);
  return page.eval(`
    const label = [...document.querySelectorAll('label')].find((l) => l.textContent.includes('قائمة أسماء'));
    const box = label && label.querySelector('input[type="checkbox"]');
    if (!box) return false;
    if (!box.checked) box.click();
    return true;
  `);
}

/** «من ملف Excel أو CSV». */
const pickSheet = (page) => page.eval(`
  const btn = document.querySelector('[data-screen="service"] button[data-act="merge-sheet"]');
  if (!btn) return false;
  btn.click();
  return true;
`);

export async function afterRestart(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  ok('(D137) بعد إعادة الفتح: النموذج في الشبّاك و«قائمة أسماء» مُشعلة', await openMerge(page, wait));
  const before = await page.eval(`return document.querySelector('[data-fill-form] textarea')?.value ?? null;`);
  ok('(D137) الضغط على «من ملف Excel أو CSV» بملفٍّ .xls', await pickSheet(page));
  await wait(1200);
  const said = await page.eval(`return document.querySelector('[data-merge-sheet-error]')?.innerText ?? '';`);
  ok(`(D137) ملف .xls: سببه تحت الزرّ («${said}»)`, said.includes('.xls') && said.includes('.xlsx') && !said.includes('Error'));
  const after = await page.eval(`return document.querySelector('[data-fill-form] textarea')?.value ?? null;`);
  ok('(D137) والأسماء كما كانت', before !== null && after === before);
  return steps.join('\n');
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

  // ٢–٣. فتح الشبّاك واختيار النموذج وتفعيل خيار دمج قائمة الأسماء
  const checked = await openMerge(page, wait);
  ok('تفعيل خيار الدمج في الشبّاك', checked);
  await wait(500);

  // ٤. الضغط على زر «من ملف Excel أو CSV»
  const clicked = await pickSheet(page);
  ok('العثور على زر «من ملف Excel أو CSV» والضغط عليه', clicked);
  await wait(1500);

  // ٥. التحقّق من استيراد الأسماء المستخلصة من ملف Excel — من عمود «الإسم» بالهمزة وحده (D137)
  const textareaValue = await page.eval(`
    const el = document.querySelector('[data-fill-form] textarea');
    return el?.value ?? '';
  `);
  ok('استيراد الأسماء من ملف Excel بنجاح', textareaValue.includes('سالم محمود جاسم') && textareaValue.includes('ليلى عبد الله حسن') && textareaValue.includes('زينب علي حسن'));
  ok(`(D137) رأس «ت | الإسم | الصف»: الأسماء الثلاثة وحدها بترتيبها — لا «ت» ولا أرقامه («${textareaValue.replace(/\n/g, ' / ')}»)`,
    textareaValue === 'سالم محمود جاسم\nليلى عبد الله حسن\nزينب علي حسن');
  const quiet = await page.eval(`return !document.querySelector('[data-merge-sheet-error]');`);
  ok('(D137) ولا رسالة تحت الزرّ', quiet);

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
