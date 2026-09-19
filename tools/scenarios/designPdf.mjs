/**
 * سيناريو: استيراد ملصقٍ من PDF — المقاس من `MediaBox`، والصفحة تُرسم خلفية.
 *
 * يبني ملف PDF حقيقيًّا بصفحةٍ A4 فيها مستطيلٌ ملوّن، ثم يستورده ويتفقّد: أقُرئ
 * المقاس بالنقاط؟ وأرُسمت الصفحة صورةً تُعرض فعلًا تحت الحقول؟
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

/** A4 بالنقاط: ٥٩٥٫٢٨ × ٨٤١٫٨٩ (٧٢ نقطة للإنش). */
function posterPdf() {
  const content = `1 0 0 RG 0.95 0.6 0.2 rg 60 500 480 260 re f\n0 0 0 rg BT /F1 36 Tf 90 420 Td (POSTER) Tj ET`;
  const objects = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox [0 0 595.28 841.89]/Contents 4 0 R' +
      '/Resources<</Font<</F1 5 0 R>>>>>>',
    `<</Length ${content.length}>>\nstream\n${content}\nendstream`,
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>'
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefAt = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefAt}\n%%EOF`;

  return Buffer.from(pdf, 'latin1');
}

export function prepare() {
  const dir = join(process.env.TEMP ?? '.', `diwan-pdf-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'ملصق.pdf');
  writeFileSync(file, posterPdf());
  return { DIWAN_TEST_OPEN_FILE: file, DIWAN_TEST_SAVE_DIR: dir };
}

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`document.querySelector('${sel}')?.click(); return true;`);

  await page.goto('designed-documents');
  await wait(700);
  await click('button[data-act="import"]');
  await wait(5000);

  const size = await page.eval(`return document.querySelector('[data-size]')?.innerText ?? '';`);
  ok('قُرئ مقاس صفحة PDF بالنقاط', size.includes('210.0') && size.includes('297.0'));

  const design = await page.eval(`return document.querySelector('[data-design]')?.innerHTML ?? '';`);
  ok('ورُسمت الصفحة خلفيةً', design.includes('diwan://store/designs/'));

  // والدقّة المعلَنة هي الخارجة فعلًا لا المطلوبة — فالنافذة محدودةٌ بالشاشة.
  ok('وأُعلنت دقّةُ الرسم', /\d+ نقطة\/إنش/.test(size));

  await page.type('input[data-title]', 'ملصق مدرسي');
  await wait(200);
  await click('button[data-act="save"]');
  await wait(1500);

  const db = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const row = db.prepare('SELECT doc_json AS docJson FROM templates').get();
  db.close();
  const doc = row?.docJson ? JSON.parse(row.docJson) : null;

  ok('وحُفظت لوحةً بمقاس A4', Math.round(doc?.canvas?.size?.h ?? 0) === 297);
  ok('وبخلفيتها', doc?.canvas?.background?.kind === 'image');
  // A4 لا يُقصّ، فلا نزف.
  ok('وبلا نزفٍ — فالورقة لا تُقصّ', doc?.canvas?.bleed === 0);

  // الخلفية تحمل دقّتها، فلا تُطبع ضبابيةً بلا علم.
  const dpi = doc?.canvas?.background?.dpi ?? 0;
  ok('وبدقّةٍ محفوظةٍ مع الخلفية', dpi > 0);
  const png = doc?.canvas?.background?.src;
  ok('والصورة كاملةُ الصفحة لا مقصوصة', Boolean(png));
  if (png) {
    const { readFileSync } = await import('node:fs');
    const bytes = readFileSync(join(profile, 'data', 'store', png));
    const w = bytes.readUInt32BE(16);
    const h = bytes.readUInt32BE(20);
    // نسبةُ A4 هي ٢١٠/٢٩٧؛ وصفحةٌ مقصوصةٌ من أسفل تكسرها.
    ok('ونسبتُها نسبةُ A4', Math.abs(w / h - 210 / 297) < 0.03);
    ok('ودقّتُها المعلَنة تطابق بكسلاتها', Math.abs(Math.round((w / 210) * 25.4) - dpi) <= 1);
  }

  if (shotsDir) await page.shot(join(shotsDir, 'design-pdf.png'));
  return steps.join('\n');
}
