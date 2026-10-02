/**
 * سيناريو: أنماط الورقة تُحفظ مع كلّ كتابٍ يصدر (خطة Production، ١٫٣).
 *
 * الورقة المؤرشفة علاماتٌ تعتمد على أنماط التطبيق، فتغيّرُ خطّ الواجهة غيّر خطّ كتبٍ قديمة عند
 * إعادة طبعها. فيُصدر هنا كتابٌ من المحرّر، ومعاملةٌ من الشبّاك، ودفعة — ثم تُفتح القاعدة
 * للقراءة: لكلٍّ أنماطه، وهي ملفّ الأنماط المبنيّ نفسه بخطوطه، مرّةً واحدة.
 */
import { join } from 'node:path';
import Database from 'better-sqlite3';

const SHEET = (n) => `<div class="a4-sheet"><p>نؤيد أن السيد ${n} يعمل لدينا.</p></div>`;
const COMMON = `serialPrefix: 'م', serialYear: 2026, gregorianDate: '2 تشرين الأول 2026', hijriDate: null, operator: null, printer: null`;
const SHEET_FIELDS = `templateId: null, letterheadId: null, authorityId: null, docType: 'تأييد', destination: null, purpose: null, values: {}, copies: 1, copyKind: null, fee: 0`;

export default async function scenario(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);

  const ids = await page.eval(`
    const a = await window.diwan.documents.issue({
      sheetHtml: ${JSON.stringify(SHEET('أحمد'))}, citizenId: null, citizenName: 'أحمد', nationalId: null,
      ${SHEET_FIELDS}, ${COMMON}
    }, false);
    const t = await window.diwan.documents.issueTransaction({
      citizenId: null, citizenName: 'زينب', nationalId: null, ${COMMON},
      sheets: [{ sheetHtml: ${JSON.stringify(SHEET('زينب'))}, ${SHEET_FIELDS} }, { sheetHtml: ${JSON.stringify(SHEET('زينب ٢'))}, ${SHEET_FIELDS} }]
    });
    const b = await window.diwan.documents.issueBatch(['حسن', 'مريم'].map((n) => ({
      citizenId: null, citizenName: n, nationalId: null, ${COMMON},
      sheets: [{ sheetHtml: '<div class="a4-sheet"><p>' + n + '</p></div>', ${SHEET_FIELDS} }]
    })));
    return [a.id, ...t.documents.map((d) => d.id), ...b.flatMap((x) => x.documents.map((d) => d.id))];
  `);

  const d = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  try {
    const rows = d.prepare(`SELECT id, style_hash AS h FROM documents WHERE id IN (${ids.map(Number).join(',')})`).all();
    const styles = d.prepare('SELECT hash, css, body_class AS bodyClass FROM sheet_styles').all();
    ok(`الكتب الخمسة من المحرّر والشبّاك والدفعة صدرت (${ids.length})`, rows.length === 5);
    ok('لكلّ كتابٍ أنماطه', rows.every((r) => r.h));
    ok('والأنماط صفٌّ واحد لها كلّها — مرّةً لكلّ بصمة', styles.length === 1 && rows.every((r) => r.h === styles[0].hash));
    const css = styles[0]?.css ?? '';
    ok('هي ملفّ الأنماط المبنيّ: فيها ورقة A4 وخطوطها', css.includes('.a4-sheet') && css.includes('@font-face'));
    ok('وروابط الخطوط نسبيّةٌ إلى index.html (./assets/…)', /url\(\.\/assets\//.test(css) && !/url\(\.\/[a-z0-9-]+\.woff/i.test(css));
    ok('ومعها صنف <body> الذي يرث منه خطّ الورقة', (styles[0]?.bodyClass ?? '').includes('font-body-md'));
  } finally {
    d.close();
  }

  const check = await page.eval(`return await window.diwan.documents.verify();`);
  ok('الأرشيف سليم: الأنماط لا تمسّ البصمة ولا السلسلة', check.checked === 5 && check.problems.length === 0);
  return steps.join('\n');
}
