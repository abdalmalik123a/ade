/**
 * سيناريو: أدوات الكتاب في المرحلة الثانية.
 *
 * اتجاه المخاطبة يرتّب الكليشات («تنسب» لجهةٍ أدنى أولًا)، وحقل التاريخ يُكتب
 * «اليوم» بتقويمه (ميلادي أو هجري)، والنموذج يُعاد إلى «نسخة أمس» من مصمّمه،
 * وخيارات الصفحات فيه، ونوع الحقل تاريخًا بتقويمه.
 */
import { join } from 'node:path';
import Database from 'better-sqlite3';

export default async function scenario(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const year = String(new Date().getFullYear());

  // ── الكليشات باتجاهها: تُخمَّن من أفعالها حين تُحفظ ───────────────────
  const saved = await page.eval(`
    const s = window.diwan.clips.save;
    const a = await s({ id: null, title: 'طلب إلى المديرية', body: 'يرجى التفضل بالموافقة' });
    const b = await s({ id: null, title: 'إيعاز إلى المدارس', body: 'تنسب تزويدنا بقوائم الطلبة' });
    const c = await s({ id: null, title: 'خاتمة', body: 'هذا ولكم التقدير مع الاحترام' });
    return [a.direction, b.direction, c.direction];`);
  ok(`خُمّن اتجاه كل كليشة من فعلها (${JSON.stringify(saved)})`, JSON.stringify(saved) === JSON.stringify(['up', 'down', null]));

  // ── المحرّر: لمن الكتاب؟ ────────────────────────────────────────────
  await page.goto('smart-editor-a4-preview');
  await wait(1000);
  ok('اختيار اتجاه المخاطبة في لوح الكتاب', await page.eval(`return Boolean(document.querySelector('[data-screen="editor"] [data-addressing]'));`));
  const menuOrder = () =>
    page.eval(`
      document.querySelector('[data-screen="editor"] [data-act="insert"]').click();
      await new Promise((r) => setTimeout(r, 300));
      const order = [...document.querySelectorAll('[data-clip-direction]')].map((b) => b.getAttribute('data-clip-direction'));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      document.querySelector('.fixed.inset-0.pt-28')?.click();
      return order;`);
  const before = await menuOrder();
  await wait(300);
  await page.eval(`document.querySelector('[data-screen="editor"] [data-addressing-value="down"]').click(); return true;`);
  await wait(300);
  const after = await menuOrder();
  await wait(300);
  ok(`كتابٌ إلى جهةٍ أدنى: «تنسب» أولًا (${before.join(',')} ← ${after.join(',')})`, after[0] === 'down' && after.length === 3);
  ok('ثم ما يصلح لكلّ جهة، ثم الصاعدة — ولا يُخفى شيء', after[1] === '' && after[2] === 'up');

  // ── حقل التاريخ بتقويمه ───────────────────────────────────────────────
  await page.eval(`document.querySelector('[data-screen="editor"] [data-act="add-field"]').click(); return true;`);
  await wait(500);
  await page.clickText('تاريخ المباشرة', 'button');
  await wait(700);
  const dateRow = `[data-screen="editor"] [data-value-of="تاريخ المباشرة"]`;
  ok('حقل التاريخ من الكتالوج بأداتيه', await page.eval(`return Boolean(document.querySelector('${dateRow} [data-act="date-today"]'));`));
  await page.eval(`document.querySelector('${dateRow} [data-act="date-today"]').click(); return true;`);
  await wait(300);
  const greg = await page.eval(`return document.querySelector('${dateRow} input').value;`);
  ok(`«اليوم» يكتبه ميلاديًّا بشهره العراقي (${greg})`, greg.endsWith(year) && /كانون|شباط|آذار|نيسان|أيار|حزيران|تموز|آب|أيلول|تشرين/.test(greg));
  await page.eval(`
    const sel = document.querySelector('${dateRow} [data-calendar-of]');
    const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    set.call(sel, 'hijri');
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;`);
  await wait(400);
  await page.eval(`document.querySelector('${dateRow} [data-act="date-today"]').click(); return true;`);
  await wait(300);
  const hijri = await page.eval(`return document.querySelector('${dateRow} input').value;`);
  ok(`وبالهجري إن اختير تقويمه (${hijri})`, hijri.endsWith('هـ') && /14\d\d/.test(hijri));
  ok('وقيمته على الورقة التي تُطبع', await page.eval(`return document.querySelector('[data-screen="editor"] .a4-sheet')?.innerText.includes(${JSON.stringify(hijri)}) ?? false;`));

  // ── النموذج: نسخه، والعودة إلى نسخة أمس ─────────────────────────────
  const tpl = await page.eval(`
    const input = (title) => ({ id: null, code: null, title, subtitle: null, category: null, subjectLine: null,
      bodyHtml: 'نؤيد بأن {الاسم} مستمر بالخدمة.', letterheadId: null,
      variables: [{ token: 'الاسم', label: 'الاسم', source: 'citizen', required: true }] });
    const t = await window.diwan.templates.save(input('تأييد — الأصل'));
    const t2 = await window.diwan.templates.save({ ...input('تأييد — معدَّل'), id: t.id });
    const revs = await window.diwan.revisions.list('template', t.id);
    return { id: t.id, first: t.revision, second: t2.revision, revs: revs.map((r) => r.revision) };`);
  ok(`النموذج يولد بنسخته الأولى ويرتفع بالتعديل (${JSON.stringify(tpl)})`, tpl.first === 1 && tpl.second === 2 && JSON.stringify(tpl.revs) === '[1]');

  await page.goto('templates-library-drafts');
  await wait(1000);
  await page.eval(`
    const card = [...document.querySelectorAll('button[title="تعديل صيغ المتغيرات"]')];
    card[card.length - 1]?.click();
    return true;`);
  await wait(1200);
  ok('المصمّم يُري رقم النسخة', (await page.text()).includes('النسخة 2'));
  await page.eval(`document.querySelector('[data-act="revisions"]').click(); return true;`);
  await wait(600);
  ok('وقائمة النسخ السابقة', await page.eval(`return Boolean(document.querySelector('[data-revisions] [data-revision="1"]'));`));
  await page.eval(`document.querySelector('[data-revisions] [data-revision="1"]').click(); return true;`);
  await wait(700);
  const titleNow = await page.eval(`return document.querySelector('input[placeholder="مثال: تأييد استمرار بالخدمة"]').value;`);
  ok(`استُرجعت النسخة الأولى في المصمّم (${titleNow})`, titleNow === 'تأييد — الأصل');
  ok('ويُقال إنها تُعتمد بالحفظ', await page.eval(`return Boolean(document.querySelector('[data-restored]'));`));

  // ── خيارات الصفحات ونوع الحقل في المصمّم ──────────────────────────────
  ok('خيارات الصفحات في المصمّم', await page.eval(`return Boolean(document.querySelector('[data-designer-page] [data-act="page-numbers"]'));`));
  await page.eval(`document.querySelector('[data-designer-page] [data-act="page-numbers"]').click(); return true;`);
  const kind = await page.eval(`
    const sel = document.querySelector('[data-field-kind]');
    if (!sel) return null;
    const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    set.call(sel, 'date:both');
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return [...sel.options].map((o) => o.textContent);`);
  ok(`نوع الحقل: نصٌّ أو تاريخٌ بتقويمه (${JSON.stringify(kind)})`, Array.isArray(kind) && kind.includes('تاريخ ميلادي وهجري'));
  await wait(300);
  await page.clickText('حفظ النموذج', 'button');
  await wait(1000);
  const db = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const row = db.prepare('SELECT title, revision, doc_json AS doc FROM templates WHERE id = ?').get(tpl.id);
  const revCount = db.prepare("SELECT COUNT(*) AS n FROM revisions WHERE kind = 'template'").get().n;
  db.close();
  const doc = JSON.parse(row?.doc ?? '{}');
  ok('الحفظ اعتمد المسترجَع نسخةً ثالثة — ولم يضع المعدَّل', row?.title === 'تأييد — الأصل' && row?.revision === 3 && revCount === 2);
  ok('وحُفظ ترقيم الصفحات معه', doc.pageSetup?.pageNumbers === true);
  ok('وحقل التاريخ بتقويمه', doc.fields?.[0]?.type === 'date' && doc.fields?.[0]?.calendar === 'both');

  return steps.join('\n');
}
