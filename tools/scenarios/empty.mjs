/**
 * سيناريو: التطبيق يبدأ خاليًا تمامًا.
 * يمرّ على الشاشات الست ويبحث عن أي أثر لبيانات التصميم — أسماء، أرقام، مبالغ.
 */
import { join } from 'node:path';

const ROUTES = ['editor', 'templates', 'archive', 'citizens', 'letterhead', 'search'];

/** كل ما ورد في ملفات التصميم كبيانات. ظهور أيٍّ منه = فشل. */
const FORBIDDEN = [
  'سمير صالح', 'حسين عبد الأمير', 'زينب طارق', 'مقتدى كريم', 'كرار ضياء',
  'مروة جاسم', 'سالم حاتم', 'هناء عزيز', 'وسام طه', 'أنور ناطق',
  'أحمد عادل', 'محمد جاسم', 'وسام عبد الحسين',
  '198420918230', '199482019482', '198421098312', '196144810291',
  '372,500', '1,840', '5,410', 'DIW-EDU', 'DIW-DEC', 'DIW-NOT',
  'مصرف الرشيد', 'مصرف الرافدين', 'ثانوية العقيدة', 'إعدادية المنصور',
  'HP LaserJet', 'REV-2024', 'IQ-ED-884', 'EDU-BG-88410', 'Vault 3.0',
  'وزارة التربية', 'جمهورية العراق', 'الرصافة الأولى'
];

export default async function scenario(page, { shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const findings = [];

  for (let i = 0; i < ROUTES.length; i++) {
    await page.goto(i);
    await new Promise((r) => setTimeout(r, 500));
    const text = await page.text();

    const hits = FORBIDDEN.filter((needle) => text.includes(needle));
    if (hits.length) findings.push(`${ROUTES[i]}: ${hits.join(' · ')}`);
    ok(`${ROUTES[i]} — خالية من بيانات التصميم`, hits.length === 0);

    if (shotsDir) await page.shot(join(shotsDir, `empty-${ROUTES[i]}.png`));
  }

  // فحوص إضافية: العدّادات صفر والحقول فارغة
  await page.goto('transactions-archive-ledger');
  const archive = await page.text();
  ok('الأرشيف يعلن أنه فارغ', archive.includes('لم يصدر أي كتاب اليوم'));

  await page.goto('templates-library-drafts');
  const templates = await page.text();
  ok('مكتبة النماذج تعلن أنها فارغة', templates.includes('مكتبة النماذج فارغة'));

  await page.goto('citizens-identity-records');
  const citizens = await page.text();
  ok('دليل المواطنين فارغ', citizens.includes('الدليل فارغ'));
  ok('لا ملف مفتوح', citizens.includes('لم يُفتح أي ملف'));

  await page.goto('smart-editor-a4-preview');
  const editor = await page.text();
  ok('المحرر بلا نماذج', editor.includes('لا نماذج في المكتبة بعد'));
  const emptyInputs = await page.eval(`
    const els = [...document.querySelectorAll('main input[type="text"], main textarea')];
    return els.filter(e => e.value.trim() !== '').map(e => e.value).slice(0, 5);
  `);
  ok('كل حقول المحرر فارغة', emptyInputs.length === 0);
  if (emptyInputs.length) findings.push(`حقول غير فارغة: ${emptyInputs.join(' | ')}`);

  if (findings.length) steps.push('', 'المخالفات:', ...findings.map((f) => `  ${f}`));
  return steps.join('\n');
}
