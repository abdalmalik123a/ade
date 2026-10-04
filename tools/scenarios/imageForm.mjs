/**
 * سيناريو: الاستمارة المصوّرة (المرحلة ٤ من UPGRADE.md — ن١٨).
 *
 * صورة استمارةٍ من الدائرة (`FORM_IMAGE`: graduation أو info أو ids — من الثلاث التي أرسلها المالك)
 * تُستورد من «المكتبة ← من صورة استمارة»: تُكشف خاناتها وتُسمّى، وتُعرض قبل الحفظ، وتُحفظ نموذجًا،
 * ثم تُملأ من الشبّاك وتُحفظ في السجلّ — والقيم فوق صورة الدائرة نفسها.
 *
 * ويطبع ما كُشف (… في أوّل السطر) ليُقاس على الاستمارة: كم خانةً صحيحة.
 */
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';

const FORM = process.env.FORM_IMAGE || 'graduation';

export async function prepare() {
  return { DIWAN_TEST_OPEN_FILE: resolve(`tests/fixtures/forms/${FORM}.jpg`) };
}

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`const el = document.querySelector(${JSON.stringify(sel)}); el?.click(); return Boolean(el);`);

  await page.goto('templates-library-drafts');
  await wait(600);
  ok('«من صورة استمارة» في المكتبة', await click('[data-act="new-form-image"]'));
  await wait(400);
  await click('[data-act="form-image-pick"]');
  let count = null;
  for (let i = 0; i < 120 && count === null; i++) {
    await wait(1000);
    count = await page.eval(`return document.querySelector('[data-slot-count]')?.dataset.slotCount ?? null;`);
    const err = await page.eval(`return document.querySelector('[data-image-form] .text-error')?.innerText ?? '';`);
    if (err) {
      ok(`قُرئت الصورة — ${err}`, false);
      return steps.join('\n');
    }
  }
  const rows = await page.eval(`return [...document.querySelectorAll('[data-slot-row]')].map((r) => r.dataset.slotRow + ':' + r.querySelector('input').value);`);
  const kinds = rows.reduce((m, r) => ((m[r.split(':')[0]] = (m[r.split(':')[0]] ?? 0) + 1), m), {});
  ok(`كُشفت خانات «${FORM}»: ${count} (${JSON.stringify(kinds)})`, Number(count) > 0);
  steps.push(`… ${rows.join(' | ')}`);
  if (await page.eval(`return Boolean(document.querySelector('[data-low-dpi]'));`)) steps.push('… تنبيه الدقّة المنخفضة ظاهر');
  if (shotsDir) await page.shot(join(shotsDir, `form-${FORM}.png`));

  // ── الحفظ نموذجًا ─────────────────────────────────────────────────
  await click('[data-act="form-image-save"]');
  await wait(1500);
  const db = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const row = db.prepare("SELECT title, category, issuing, doc_json AS docJson FROM templates WHERE category = 'استمارات'").get();
  db.close();
  const doc = row?.docJson ? JSON.parse(row.docJson) : null;
  ok('حُفظت في المكتبة استمارةً تُقيَّد', row?.issuing === 'registered' && doc?.kind === 'canvas' && doc?.meta?.form === true);
  ok('وصورة الدائرة خلفيّتها، وفوقها حقولها', doc?.canvas?.background?.kind === 'image' && doc.canvas.elements.length === doc.fields.length);

  // ── الملء من الشبّاك ──────────────────────────────────────────────
  await page.goto('service-counter');
  await wait(900);
  await page.clickText(row?.title ?? '', '[data-template-card]');
  await wait(300);
  await page.clickText('املأ (1)');
  await wait(1500);
  // الاسم: خانةٌ بدور الاسم — وإلا أوّل خانة نصٍّ ليست مربّع الصورة.
  const first = doc?.fields?.find((f) => f.role === 'name') ?? doc?.fields?.find((f) => f.type === 'text' && f.source !== 'photoPath');
  steps.push(`… الاسم في: ${first?.label ?? '—'} · المجموع يجمع: ${doc?.fields?.find((f) => f.sumOf)?.sumOf?.length ?? 0}`);
  const grade = doc?.fields?.find((f) => f.key.endsWith('_رقما') && !f.key.startsWith('المجموع'));
  await page.eval(`
    const set = (label, value) => {
      const l = [...document.querySelectorAll('[data-screen="service"] label')].find((x) => x.querySelector('span')?.textContent.trim().startsWith(label));
      const input = l?.querySelector('input[type="text"]');
      if (!input) return;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set(${JSON.stringify(first?.label ?? '')}, 'زينب علي حسين');
    ${grade ? `set(${JSON.stringify(grade.label)}, '95');` : ''}
    return true;
  `);
  await wait(500);
  await page.clickText('راجع الأوراق', 'button');
  await wait(1500);
  const sheet = await page.eval(`
    const s = document.querySelector('[data-step-review] [data-letter-sheet], [data-letter-sheet][data-form]');
    return s ? { form: s.hasAttribute('data-form'), bg: Boolean(s.querySelector('img[src^="diwan://store/images/"]')), text: s.innerText } : null;
  `);
  ok('ورقة المراجعة صورة الدائرة والقيم فوقها', sheet?.form && sheet?.bg && sheet?.text.includes('زينب علي حسين'));
  if (grade) ok('والدرجة رقمًا تُكتب كلماتٍ في خانتها', sheet?.text.includes('تسعون') || sheet?.text.includes('خمس'));
  if (shotsDir) await page.shot(join(shotsDir, `form-${FORM}-review.png`));
  // على ورقة الدائرة المطبوعة: القيم وحدها — في المعاينة الصورة باهتة والقيم بسوادها (والطباعة تخفيها: `valuesOnlySheet`).
  await click('[data-act="values-only"]');
  await wait(400);
  const values = await page.eval(`
    const s = document.querySelector('.values-preview [data-letter-sheet][data-form], [data-letter-sheet][data-form].values-preview, .values-preview');
    const fv = s ? [...s.querySelectorAll('.fv')] : [];
    const img = s?.querySelector('img');
    return { on: Boolean(s), fv: fv.length, shown: fv.some((e) => getComputedStyle(e).visibility === 'visible'), bg: img ? Number(getComputedStyle(img).opacity) : null };
  `);
  ok(`«القيم وحدها»: الصورة باهتة والقيم ظاهرة (${JSON.stringify(values)})`, values?.on && values.fv > 0 && values.shown && values.bg < 0.5);
  await click('[data-act="values-only"]');
  await wait(300);
  await page.clickText('احفظ بلا طباعة');
  await wait(2000);
  ok('وحُفظت في السجلّ', (await page.eval(`return document.querySelector('[data-after-print]')?.innerText ?? '';`)).includes('في السجلّ'));
  return steps.join('\n');
}
