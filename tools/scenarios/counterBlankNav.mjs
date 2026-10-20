/**
 * سيناريو: ضبط انتقال «اكتبه على ورقة فارغة» ومحليّة إخفاء أسماء الملفّات (D128 — S16).
 *
 * ١. زرّ إخفاء أسماء الملفّات في لوحة الوارد يحفظ تفضيله في localStorage ولا يُسجّل أيّ قيد في جدول إعدادات المكتب.
 * ٢. التفضيل يبقى محليًّا وفعّالاً عند التنقل بين الشاشات واسترجاعه.
 * ٣. البحث في الشبّاك بعبارة لا تطابق أيّ نموذج («طلب سلفة مالية عاجلة») يُظهر «اكتبه على ورقة فارغة».
 * ٤. النقر على «اكتبه على ورقة فارغة» يفتح المحرّر بعنوان ونوع خاليين («لم يُختر نموذج» في الشريط).
 * ٥. كتابة موضوع في الورقة («م / تأييد خدمة وظيفية») يجعل عنوان المسودة يشتقّ من الموضوع المكتوب لا من بحث الشبّاك.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { PDFDocument } from 'pdf-lib';

const FILE = 'وثيقة زينب علي حسن.pdf';

export async function prepare() {
  const downloads = join(process.env.TEMP, 'blank-nav', 'downloads');
  mkdirSync(downloads, { recursive: true });
  const pdf = await PDFDocument.create();
  pdf.addPage([595, 842]);
  writeFileSync(join(downloads, FILE), await pdf.save());
  return { DIWAN_TEST_INBOX: `downloads=${downloads}` };
}

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.click(); return true;`);
  const has = (sel) => page.eval(`return Boolean(document.querySelector(${JSON.stringify(sel)}));`);
  const db = (fn) => {
    const d = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
    try {
      return fn(d);
    } finally {
      d.close();
    }
  };

  await wait(600);
  // تخطي شاشة البداية إن ظهرت
  if (await has('[data-act="overview-skip"]')) {
    await click('[data-act="overview-skip"]');
    await wait(400);
  }

  ok('الشبّاك مفتوح', await has('[data-screen="service"] [data-counter-search]'));

  // ── ١: فحص محليّة إخفاء أسماء الملفّات في لوحة الوارد أولاً ──
  await wait(800);
  const inbox = () => page.eval(`return [...document.querySelectorAll('[data-screen="service"] [data-inbox-file]')].map((r) => r.innerText).join(' | ');`);
  ok('لوحة «آخر ما وصل» تظهر الملف أولاً باسمه', (await inbox()).includes('زينب علي حسن'));

  // الضغط لإخفاء الأسماء
  await click('[data-screen="service"] [data-act="inbox-names"]');
  await wait(300);

  ok('أسماء الملفات اختفت وظهر «ملفّ PDF» مكانها', (await inbox()).includes('ملفّ PDF') && !(await inbox()).includes('زينب علي حسن'));

  const lsVal = await page.eval(`return localStorage.getItem('diwan.inbox.hideNames');`);
  ok('التفضيل مسجّل في localStorage بقيمة 1', lsVal === '1');

  // التحقق من خلو قاعدة البيانات (جدول settings) من أي مفتاح للإخفاء
  const dbSettingCount = db((d) => d.prepare("SELECT COUNT(*) AS c FROM settings WHERE key LIKE '%hide%' OR key LIKE '%inbox%'").get()?.c ?? 0);
  ok('تفضيل الإخفاء لم يتسرّب إلى إعدادات المكتب المشتركة في قاعدة البيانات', dbSettingCount === 0);

  // التنقل إلى شاشة أخرى ثم العودة للتحقق من استمرار التفضيل
  await page.goto('templates-library-drafts');
  await wait(500);
  await page.goto('service-counter');
  await wait(600);

  const ariaPressed = await page.eval(`return document.querySelector('[data-screen="service"] [data-act="inbox-names"]')?.getAttribute('aria-pressed');`);
  ok('تفضيل الإخفاء ما يزال مفعلًا بعد العودة إلى الشبّاك', ariaPressed === 'true' && !(await inbox()).includes('زينب علي حسن'));

  // إعادة إظهار الأسماء
  await click('[data-screen="service"] [data-act="inbox-names"]');
  await wait(300);
  ok('إعادة الضغط تُظهر اسم الملف مجددًا', (await inbox()).includes('زينب علي حسن'));

  // ── ٢: البحث في الشبّاك وظهور «اكتبه على ورقة فارغة» ──
  await page.type('[data-counter-search]', 'طلب سلفة مالية عاجلة');
  await wait(400);

  const emptyKind = await page.eval(`return document.querySelector('[data-screen="service"] [data-counter-empty]')?.dataset?.counterEmpty ?? '';`);
  ok('البحث يُظهر حالة عدم وجود نموذج مطابق', emptyKind === 'search' || emptyKind === 'library');
  ok('زرّ «اكتبه على ورقة فارغة» ظاهر في الحالة الفارغة', await has('[data-screen="service"] [data-act="counter-blank"]'));

  // ── ٣: الانتقال للمحرّر والتأكد من خلو نوع الوثيقة ──
  await click('[data-screen="service"] [data-act="counter-blank"]');
  await wait(1200);

  ok('فُتح المحرّر على ورقة فارغة', await has('[data-screen="editor"] [data-page-editor]'));

  // التحقق من أن الشريط العلوي يقول «لم يُختر نموذج» ولا يحمل نص البحث
  const headerTx = await page.eval(`return [...document.querySelectorAll('span')].map((s) => s.innerText).find((t) => t.includes('لم يُختر نموذج') || t.includes('طلب سلفة')) ?? '';`);
  ok('نوع الكتاب في الشريط العلوي لم يتأثر بنص البحث («لم يُختر نموذج»)', headerTx.includes('لم يُختر نموذج') && !headerTx.includes('طلب سلفة'));

  // ── ٤: كتابة موضوع وحفظ المسودة والتأكد من عنوانها ──
  await page.eval(`document.querySelector('[data-screen="editor"] [data-page-editor]').focus(); return true;`);
  await page.send('Input.insertText', { text: 'إلى / ديوان المحافظة' });
  await page.key('Enter');
  await page.send('Input.insertText', { text: 'م / تأييد خدمة وظيفية' });
  await page.key('Enter');
  await page.send('Input.insertText', { text: 'نؤيد لكم استمرار الخدمة.' });
  await wait(5000);

  // مغادرة المحرّر لحفظ المسودة
  await page.goto('service-counter');
  await wait(1500);

  const drafts = db((d) => d.prepare('SELECT title, body_html FROM drafts ORDER BY id DESC LIMIT 1').all());
  ok(
    `عنوان المسودة مستخلص من موضوع الورقة («${drafts[0]?.title ?? ''}») ولا يحمل عبارة بحث الشبّاك`,
    drafts.length === 1 && drafts[0].title === 'تأييد خدمة وظيفية' && !drafts[0].title.includes('طلب سلفة')
  );

  return steps;
}
