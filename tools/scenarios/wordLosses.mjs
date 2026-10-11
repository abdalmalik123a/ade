/**
 * سيناريو: «ما لم يُنقل من Word» وإحصاء المجلّد (الموجة ٢، «كلفة الانتقال») على التطبيق الحقيقي.
 *
 * ملفّ Word كتبه مكتب: متنٌ، ومربّع نصّ، وكلمةٌ حمراء (تُنقل بلونها منذ «محرّر الكتاب») وأخرى فاتحة (تُكتب سوداء)، وجدولٌ داخل
 * جدول، وتذييلٌ بالعنوان. فيُفتح من المكتبة:
 * الورقة بمتنها، وبجانبها لوحٌ يقول ما لم يُنقل (مربّع النصّ أوّلًا) ويُغلق. ثم مجلّدٌ بملفّين منه ومن ملفٍّ نظيف:
 * شاشة المراجعة تقول ما لا يُنقل بعدد ملفّاته — و«احفظ إحصاء الملفّات» يكتب ملفًّا نصّيًّا بالأعداد بلا اسم
 * ملفٍّ ولا كلمةٍ من المتن. (وكانت تقول إنّ استيراد المجلّد يأخذ النصّ وحده — حتى صار بتنسيقه، `importFolder.ts`.)
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';

const ROOT = join(process.env.TEMP ?? '.', `diwan-word-losses-${Date.now()}`);
const FOLDER = join(ROOT, 'ملفات المكتب');
const SAVE = join(ROOT, 'محفوظ');
const FILE = join(ROOT, 'كتاب تأييد.docx');

const r = (text, rpr = '') => `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}<w:t xml:space="preserve">${text}</w:t></w:r>`;
const p = (inner, ppr = '') => `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${inner}</w:p>`;

/** ملفّ Word بأجزائه الدنيا — ما يقرؤه البرنامج كما يقرأ ملفّات المكاتب. */
function docx(body, parts = {}) {
  const ns =
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" ' +
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:v="urn:schemas-microsoft-com:vml"';
  return zipSync({
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>'
    ),
    'word/document.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${ns}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`),
    ...Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, strToU8(v)]))
  });
}

const TEXTBOX =
  '<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wp:anchor><a:graphic><a:graphicData><wps:wsp><wps:txbx><w:txbxContent>' +
  p(r('رقم الوصل ٤٥٨')) +
  '</w:txbxContent></wps:txbx></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></mc:Choice><mc:Fallback><w:pict><v:shape><v:textbox><w:txbxContent>' +
  p(r('رقم الوصل ٤٥٨')) +
  '</w:txbxContent></v:textbox></v:shape></w:pict></mc:Fallback></mc:AlternateContent></w:r>';

const LETTER = docx(
  [
    p(r('إلى / مديرية تربية الأنبار')),
    p(r('نؤيد بأن السيد المذكور موظفٌ لدينا ') + r('حصرًا', '<w:color w:val="C00000"/>') + r(' ملاحظة', '<w:color w:val="E7E6E6"/>')),
    p(TEXTBOX),
    `<w:tbl><w:tr><w:tc>${p(r('المرفقات'))}<w:tbl><w:tr><w:tc>${p(r('صورة الهوية'))}</w:tc></w:tr></w:tbl></w:tc></w:tr></w:tbl>`,
    p(r('مع التقدير'))
  ].join(''),
  { 'word/footer1.xml': `<w:ftr>${p(r('العنوان: الرمادي — حي الأندلس'))}</w:ftr>` }
);
const CLEAN = docx(p(r('نموذجٌ نظيف بلا ما يُفقد')));

export async function prepare() {
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(FOLDER, { recursive: true });
  mkdirSync(SAVE, { recursive: true });
  writeFileSync(FILE, LETTER);
  writeFileSync(join(FOLDER, 'تأييد ١.docx'), LETTER);
  writeFileSync(join(FOLDER, 'تأييد ٢.docx'), LETTER);
  writeFileSync(join(FOLDER, 'نظيف.docx'), CLEAN);
  return { DIWAN_TEST_OPEN_FILE: FILE, DIWAN_TEST_OPEN_DIR: FOLDER, DIWAN_TEST_SAVE_DIR: SAVE };
}

export default async function scenario(page, { shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const losses = (scope) => page.eval(`return [...document.querySelectorAll('${scope} [data-word-loss]')].map((l) => l.dataset.wordLoss);`);

  // ── الملفّ الواحد: الورقة، وبجانبها ما لم يُنقل ──
  await page.goto('templates-library-drafts');
  await wait(700);
  await page.eval(`document.querySelector('[data-act="new-word"]')?.click(); return true;`);
  await wait(2500);
  const paper = await page.eval(`return document.querySelector('[data-paper]')?.innerText ?? '';`);
  ok('الملفّ فُتح في المصمّم بمتنه', paper.includes('نؤيد بأن السيد') && paper.includes('مع التقدير'));
  ok('ونصّ مربّع النصّ ليس فيه — فيُقال', !paper.includes('رقم الوصل'));
  const colored = await page.eval(`return [...document.querySelectorAll('[data-paper] [data-color]')].map((e) => e.innerText.trim() + '|' + e.dataset.color);`);
  ok(`والكلمة الحمراء بلونها، والفاتحة بلا لون (${colored.join('، ')})`, colored.join() === 'حصرًا|#c00000');
  const single = await losses('[data-word-loss-panel]');
  ok(`لوح «ما في ملف Word ولم يُنقل»: مربّع النصّ أوّلًا، والتذييل، والجدول داخل الجدول، واللون الفاتح (${JSON.stringify(single)})`,
    single[0] === 'textbox' && ['footer', 'nestedTable', 'color'].every((k) => single.includes(k)));
  if (shotsDir) await page.shot(join(shotsDir, 'word-losses-designer.png'));
  await page.eval(`document.querySelector('[data-word-loss-panel] button[aria-label="أغلق"]').click(); return true;`);
  await wait(300);
  ok('ويُغلق', !(await page.eval(`return Boolean(document.querySelector('[data-word-loss-panel]'));`)));
  await page.eval(`document.querySelector('button[title="إغلاق"]')?.click(); return true;`);
  await wait(600);

  // ── المجلّد: ما لا يُنقل بعدد ملفّاته، والإحصاء ──
  await page.clickText('استورد مجلدي');
  await wait(4000);
  const census = await page.eval(`return document.querySelector('[data-census]')?.innerText ?? '';`);
  ok('شاشة المراجعة تقول ما لا يُنقل بعدد ملفّاته', census.includes('مربّعات نصّ (2 ملفّ)') && census.includes('تذييل الصفحة'));
  // وكان يقول «يأخذ نصّ الملفّات وحده» — حتى صار المجلّد يُستورد بتنسيقه كالملفّ الواحد.
  ok('ولا يقول إنّ المجلّد يُستورد نصًّا وحده — صار بتنسيقه', !census.includes('نصّ الملفّات وحده'));
  const fileLosses = await losses('[data-file-losses]');
  ok(`وفي تفصيل الملفّ ما لا يُنقل منه (${JSON.stringify(fileLosses)})`, fileLosses.includes('textbox'));
  if (shotsDir) await page.shot(join(shotsDir, 'word-losses-folder.png'));

  await page.eval(`document.querySelector('[data-act="save-census"]').click(); return true;`);
  await wait(800);
  ok('و«احفظ إحصاء الملفّات» يقول أين حُفظ', (await page.eval(`return document.querySelector('[data-census-saved]')?.innerText ?? '';`)).includes('حُفظ الإحصاء'));
  const saved = readdirSync(SAVE).find((n) => n.endsWith('.txt'));
  const raw = saved ? readFileSync(join(SAVE, saved)) : Buffer.alloc(0);
  const text = raw.toString('utf8');
  ok(`ملفٌّ نصّيٌّ يفتحه «المفكّرة» بالعربية (${saved})`, raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf && text.includes('\r\n'));
  ok('فيه الملفّات وما لا يُنقل بعددها', text.includes('الملفات: ٣') && text.includes('مربّعات نصّ: ٢ ملفّ'));
  ok('ولا اسم ملفٍّ فيه ولا كلمة من المتن', !text.includes('تأييد') && !text.includes('نظيف') && !text.includes('مديرية') && !text.includes('الرمادي'));
  rmSync(ROOT, { recursive: true, force: true });
  ok('والمجلّد المؤقّت أُزيل', !existsSync(ROOT));
  return steps.join('\n');
}
