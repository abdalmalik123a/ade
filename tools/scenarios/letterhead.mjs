/**
 * سيناريو: بناء ترويسة من الصفر بالضغط على الأزرار، ثم التأكّد أنها حُفظت في القاعدة.
 * هذا اختبار للأزرار نفسها، لا للعلامات.
 */
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import Database from 'better-sqlite3';

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);

  // إلى شاشة الترويسة (الخامسة في التنقّل)
  await page.goto(4);
  ok('فُتحت شاشة الترويسة', (await page.text()).includes('مصمّم الترويسة والأختام'));
  ok('تبدأ فارغة', (await page.text()).includes('منطقة الترويسة فارغة'));

  // الحفظ بلا اسم يجب أن يُرفض
  await page.clickText('سطر نصّي');
  await page.clickText('حفظ الترويسة');
  ok('يرفض الحفظ بلا اسم', (await page.text()).includes('سمِّ الترويسة أولًا'));

  // تسمية الترويسة وكتابة سطر
  await page.type('input[placeholder^="مثال: مديرية"]', 'مديرية تربية بغداد / الرصافة الأولى');
  await page.type('input[placeholder="اكتب محتوى السطر"]', 'جمهورية العراق');

  // سطر ثانٍ + خط فاصل + حقل تلقائي
  await page.clickText('سطر نصّي');
  await page.type('input[placeholder="اكتب محتوى السطر"]', 'وزارة التربية');
  await page.clickText('خط فاصل');
  await page.clickText('حقل تلقائي');
  await page.clickText('رقم الصادر');

  const body = await page.text();
  ok('ظهرت الكتل في المعاينة', body.includes('جمهورية العراق') && body.includes('وزارة التربية'));
  ok('الحقل التلقائي بصيغته', body.includes('{رقم_الصادر}'));
  ok('يوسم أنها غير محفوظة', body.includes('غير محفوظة'));

  await page.clickText('حفظ الترويسة');
  await new Promise((r) => setTimeout(r, 800));
  ok('أكّد الحفظ', (await page.text()).includes('حُفظت الترويسة'));

  if (shotsDir) await page.shot(join(shotsDir, 'letterhead-built.png'));

  // التحقّق من القرص — لا من الشاشة
  const dbPath = join(profile, 'data', 'diwan.db');
  ok('أُنشئ ملف القاعدة', existsSync(dbPath));

  const db = new Database(dbPath, { readonly: true });
  const row = db.prepare('SELECT name, layout_json, is_default FROM letterheads').get();
  db.close();

  ok('حُفظ السجل في القاعدة', Boolean(row));
  ok('حُفظ الاسم', row?.name === 'مديرية تربية بغداد / الرصافة الأولى');
  ok('صارت الافتراضية تلقائيًا', row?.is_default === 1);

  const layout = row ? JSON.parse(row.layout_json) : { blocks: [] };
  ok('حُفظت أربع كتل بترتيبها', layout.blocks.length === 4);
  ok('الكتلة الأولى نصّ صحيح', layout.blocks[0]?.value === 'جمهورية العراق');
  ok('الكتلة الثالثة خط فاصل', layout.blocks[2]?.kind === 'divider');
  ok('الكتلة الرابعة حقل رقم الصادر', layout.blocks[3]?.value === '{رقم_الصادر}');

  return steps.join('\n');
}
