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

  // ── إدراج كليشةٍ يُسجِّل استعمالها: فتتصدّر المكتبة أقدمُها بعد أن تُدرج (كان لا يُسجَّل — تنظيف ٢٩ أيلول) ──
  const firstBefore = await page.eval(`return (await window.diwan.clips.list())[0]?.title ?? null;`);
  await page.eval(`
    document.querySelector('[data-screen="editor"] [data-act="insert"]').click();
    await new Promise((r) => setTimeout(r, 300));
    [...document.querySelectorAll('[data-clip-direction]')].find((b) => b.textContent.includes('طلب إلى المديرية')).click();
    return true;`);
  await wait(500);
  ok('أُدرجت الكليشة في الكتاب', await page.eval(`return document.querySelector('[data-screen="editor"] .a4-sheet')?.innerText.includes('يرجى التفضل بالموافقة') ?? false;`));
  const firstAfter = await page.eval(`return (await window.diwan.clips.list())[0]?.title ?? null;`);
  ok(`وتصدّرت المكتبة بآخر استعمالها (${firstBefore} ← ${firstAfter})`, firstAfter === 'طلب إلى المديرية' && firstBefore !== 'طلب إلى المديرية');

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

  // ── التعلّم في المصمّم (ج١٣): حدّ الترويسة يُعدَّل ويُقيَّد، والتصنيف يُقترح ──────
  const sheet = await page.eval(`
    const p = (id, text) => ({ id, kind: 'paragraph', align: 'right', inlines: text ? [{ kind: 'run', text }] : [] });
    const doc = {
      id: 'head-doc', schemaVersion: 1, kind: 'flow', issuing: 'registered',
      blocks: [
        { id: 'row', kind: 'columns', columns: [[p('c1', 'إدارة مدرسة الصحوة الابتدائية')], [p('c2', 'العدد: ')]] },
        p('h2', 'قسم الشؤون الإدارية'),
        p('gap', ''),
        p('b1', 'م / تأييد'),
        p('b2', 'نؤيد أن الطالب مستمر بالدوام.')
      ],
      fields: [], meta: {}
    };
    const t = await window.diwan.templates.save({ id: null, code: null, title: 'تأييد دوام — الصحوة', subtitle: null, category: 'تربية',
      subjectLine: null, letterheadId: null, bodyHtml: 'نؤيد أن الطالب مستمر بالدوام.', variables: [], doc });
    return t.id;`);
  await page.goto('service-counter');
  await wait(300);
  await page.goto('templates-library-drafts');
  await wait(1000);
  await page.eval(`
    // بطاقة النموذج بعنوانه — فالمكتبة ترتّب بالاستعمال والعنوان لا بالأحدث.
    const edit = [...document.querySelectorAll('button[title="تعديل صيغ المتغيرات"]')].find((b) => {
      let el = b;
      for (let i = 0; i < 8 && el; i++, el = el.parentElement) if (el.innerText?.includes('الصحوة')) return true;
      return false;
    });
    edit?.click();
    return true;`);
  await wait(1300);
  const edge = () => page.eval(`return Number(document.querySelector('[data-head-edge]')?.getAttribute('data-head-edge') ?? 0);`);
  ok(`يُقترح فصل أعلى الورقة ترويسةً بحدٍّ مخمَّن (${await edge()} أسطر)`, (await edge()) === 2);
  await page.eval(`document.querySelector('[data-act="head-more"]').click(); return true;`);
  await wait(300);
  ok('ويُزاد الحدّ سطرًا ويُرى ما يدخل فيه', (await edge()) === 3 && (await page.eval(`return document.querySelectorAll('[data-head-preview] span').length;`)) === 3);
  await page.eval(`document.querySelector('[data-act="head-less"]').click(); return true;`);
  await wait(300);
  await page.eval(`document.querySelector('[data-act="head-less"]').click(); return true;`);
  await wait(300);
  ok('ويُنقص', (await edge()) === 1);
  await page.eval(`document.querySelector('[data-act="save-head"]').click(); return true;`);
  await wait(1000);
  const db2 = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const corr = db2.prepare("SELECT suggested, chosen FROM corrections WHERE kind = 'letterheadEdge'").all();
  db2.close();
  ok(`وما صحّحه الموظف من الحدّ يُقيَّد ليُقترح لكتب الجهة القادمة (${JSON.stringify(corr)})`, corr.length === 1 && corr[0].suggested === '2' && corr[0].chosen === '1');
  await page.clickText('إلغاء', 'button');
  await wait(600);

  // التصنيف من العنوان: نماذج المكتب المصنَّفة شواهد
  await page.eval(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('ورقة فارغة'))?.click(); return true;`);
  await wait(1200);
  await page.type('input[placeholder="مثال: تأييد استمرار بالخدمة"]', 'تأييد دوام طالبة');
  await wait(1200);
  ok('وتصنيف النموذج يُقترح من عنوانه — «تربية» بنماذج المكتب', (await page.eval(`return document.querySelector('[data-category-suggest]')?.getAttribute('data-category-suggest') ?? '';`)) === 'تربية');
  void sheet;

  return steps.join('\n');
}
