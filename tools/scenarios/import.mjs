/**
 * سيناريو: استيراد كتاب Word بترويسته — على التطبيق الحقيقي.
 *
 * يُبنى ملف .docx بالشكل الغالب في كتب الدوائر: فقرة فارغة في أوّله، ثم سطران
 * يفصل فيهما فراغٌ طويلٌ يمينَ الترويسة عن يسارها، ثم شعار، ثم المتن. ويُقاد
 * التطبيق ليستورده، فيُفتَّش عن الترويسة في الحوار وفي القاعدة وفي المخزن.
 *
 * حوار فتح الملف لا يُضغط آليًا، فيُجاب عنه بـDIWAN_TEST_OPEN_FILE الذي لا
 * يوجد إلا تحت هذا المِقْود.
 */
import { join } from 'node:path';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  AlignmentType,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  TextRun
} from 'docx';
import Database from 'better-sqlite3';

const TINY_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

const para = (text, alignment) =>
  new Paragraph({
    alignment,
    bidirectional: true,
    children: [new TextRun({ text, rightToLeft: true })]
  });

async function writeSchoolLetter() {
  const doc = new Document({
    sections: [
      {
        children: [
          para(''),
          para('        ادارة                                        العدد: '),
          para('  مدرسة الصحوة الابتدائية                        التاريخ: / / 20'),
          para('للبنيـــــــن'),
          para(''),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                type: 'gif',
                data: TINY_GIF,
                transformation: { width: 60, height: 60 }
              })
            ]
          }),
          para(''),
          para('الى / ولي امر التلميذ ............................'),
          para('م/ انـــــــــذار', AlignmentType.CENTER),
          para('بالنظر لوصول غيابات التلميذ ............ في الصف ........'),
          para('لذا تقرر نقص ....... من درجة المواظبة وانذاره.')
        ]
      }
    ]
  });

  const dir = join(tmpdir(), `diwan-import-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'انذار.docx');
  writeFileSync(path, await Packer.toBuffer(doc));
  return path;
}

/** يُبنى الملف قبل إقلاع التطبيق، ويُمرَّر مسارُه في بيئته. */
export async function prepare() {
  const file = process.env.DIWAN_TEST_OPEN_FILE ?? (await writeSchoolLetter());
  process.env.DIWAN_TEST_OPEN_FILE = file; // ليقرأه السيناريو نفسه أيضًا
  return { DIWAN_TEST_OPEN_FILE: file };
}

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const source = process.env.DIWAN_TEST_OPEN_FILE;
  ok('مِقْود الاستيراد مهيّأ', Boolean(source) && existsSync(source));
  if (!source) return steps.join('\n');

  // ── الاستيراد من مكتبة النماذج ──────────────────────────────────────
  await page.goto(1);
  await wait(700);
  await page.clickText('استيراد نموذج');
  await wait(2500);

  let text = await page.text();
  ok('عُرضت الترويسة المستخرجة قبل حفظها', text.includes('وُجدت ترويسة في الملف'));
  ok('فيها يمين الترويسة', text.includes('مدرسة الصحوة الابتدائية'));
  ok('وفيها يسارها مفصولًا', text.includes('العدد:') && text.includes('التاريخ: / / 20'));
  ok(
    'وشعار المدرسة صورةً لا نصًّا',
    await page.eval(`
      const imgs = [...document.querySelectorAll('img')].filter(i => (i.src||'').startsWith('diwan://'));
      return imgs.length > 0;
    `)
  );
  if (shotsDir) await page.shot(join(shotsDir, 'import-letterhead.png'));

  await page.clickText('احفظ الترويسة واربطها بالنموذج');
  await wait(2000);

  text = await page.text();
  ok('انفتح المصمّم بالنموذج المستورد', text.includes('نموذج مستورد'));
  ok('والعنوان من سطر الموضوع', text.includes('انـــــــــذار'));

  const designerValues = await page.eval(`
    const title = [...document.querySelectorAll('input')].map(i => i.value).join(' || ');
    const body = [...document.querySelectorAll('textarea')].map(t => t.value).join(' || ');
    return JSON.stringify({ title, body });
  `);
  const values = JSON.parse(designerValues);
  ok('وصل عنوان النموذج إلى المصمّم', values.title.includes('انـــــــــذار'));
  ok('ووصل متنه كاملًا', values.body.includes('بالنظر لوصول غيابات التلميذ'));
  ok('والمتن بلا أسطر الترويسة', !values.body.includes('مدرسة الصحوة'));
  ok('ولا يحمل سطر الموضوع مكرّرًا', !values.body.includes('م/ انـــــــــذار'));

  ok(
    'والنموذج مربوط بالترويسة المستوردة',
    await page.eval(`
      const sel = [...document.querySelectorAll('select')].find(s =>
        [...s.options].some(o => o.textContent.includes('انـــــــــذار')));
      return Boolean(sel && sel.selectedOptions[0]?.textContent.includes('انـــــــــذار'));
    `)
  );

  // ── التفتيش في القاعدة والمخزن ──────────────────────────────────────
  const db = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const row = db.prepare('SELECT name, layout_json FROM letterheads').get();
  db.close();

  ok('حُفظت الترويسة في المكتبة', Boolean(row));
  const layout = row ? JSON.parse(row.layout_json) : {};
  ok('بقسمين: يمين ويسار', layout.columns === 2);
  ok(
    'القسم الأول باسم الجهة',
    layout.sections?.[0]?.blocks?.map((b) => b.value).join('|') ===
      'ادارة|مدرسة الصحوة الابتدائية|للبنيـــــــن|' + (layout.sections[0].blocks[3]?.value ?? '')
  );
  ok(
    'القسم الثاني بالعدد والتاريخ',
    layout.sections?.[1]?.blocks?.map((b) => b.value).join('|') === 'العدد:|التاريخ: / / 20'
  );

  const image = layout.sections?.[0]?.blocks?.find((b) => b.kind === 'image');
  ok('الشعار كتلة صورة في الترويسة', Boolean(image));
  ok(
    'ونُقل ملفه إلى مخزن التطبيق',
    Boolean(image) && existsSync(join(profile, 'data', 'store', image.value))
  );
  ok(
    'بامتداده الأصلي',
    readdirSync(join(profile, 'data', 'store', 'letterheads')).some((f) => f.endsWith('.gif'))
  );

  return steps.join('\n');
}
