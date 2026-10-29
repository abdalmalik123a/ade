/**
 * سيناريو: التصاميم (محادثة «التصاميم» — البنود ١٣ و١٢ و١٤ و٢ من IMPROVEMENTS.md).
 *
 * ١٣ — شريط المصمّم: ما يُستعمل كلّ يوم ظاهر، و«تحرير ▾» و«رتّب ▾» قائمتان بأسماء أدواتهما واختصاراتها — تُغلقان بـEscape وبعد
 *      الفعل — والظاهر أقلّ من نصف ما كان (نحو ثلاثين أيقونة).
 * ١٢ — «هويّة طالب» الجاهزة تُراجَع أوراقها بلا تحذير قصّ (كانت «{المدرسة}» على ١٫٩ ملم و«{العنوان}» على ٠٫٥ ملم).
 * ١٤ — مراجعة الأوراق: الفحص ظاهر، وخيارات الورق مطويّةٌ تحت اسمها تنفتح بالضغط — وتنفتح وحدها حين يُفعَّل خيار.
 * ٢  — جدولٌ على لوحةٍ بيضاء: عرض العمود برقمٍ بالملّم من جاره، والعمود الجديد بعرض متوسّطها والمجموع مئة؛ وسحب الحدّ بين
 *      عمودين وبين صفّين بالفأرة على اللوحة، خطوةً واحدة في التراجع؛ وارتفاع صفٍّ برقم؛ و«صفوف متساوية» يعيدها؛ ويُحفظ ذلك.
 */
import { join } from 'node:path';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function scenario(page, { shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const click = (sel) => page.eval(`const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.click(); return true;`);
  // `checkVisibility`: ما في <details> مطويٍّ لا يُرسم ويبقى له `offsetParent`.
  const visible = (sel) => page.eval(`const el = document.querySelector(${JSON.stringify(sel)}); return Boolean(el && el.checkVisibility());`);
  const drawn = () => page.eval(`return document.querySelector('[data-design]')?.innerHTML ?? '';`);
  /** رقمٌ بالملّم في خانةٍ تُعتمد عند تركها — كما يكتبه الموظف. */
  const setMm = (sel, value) =>
    page.eval(`
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return false;
      el.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(String(value))});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.blur();
      return true;`);
  const mm = (sel) => page.eval(`return Number(document.querySelector(${JSON.stringify(sel)})?.value ?? NaN);`);
  const drag = async (sel, dx, dy) => {
    const at = await page.eval(`const r = document.querySelector(${JSON.stringify(sel)})?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;`);
    if (!at) return false;
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y });
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: at.x, y: at.y, button: 'left', clickCount: 1 });
    await wait(60);
    for (const f of [0.3, 0.7, 1]) {
      await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x + dx * f, y: at.y + dy * f, button: 'left' });
      await wait(60);
    }
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x + dx, y: at.y + dy, button: 'left', clickCount: 1 });
    await wait(400);
    return true;
  };

  // ── ١٣: الشريط ───────────────────────────────────────────────────────
  await page.goto('designed-documents');
  await wait(800);
  await click('button[data-kind="student-id"]');
  await wait(1200);
  const bar = await page.eval(`
    const row = document.querySelector('[data-side-tabs]').parentElement;
    return [...row.querySelectorAll('button')].filter((b) => b.checkVisibility() && !b.closest('[data-menu-panel]') && !b.closest('[data-tool-dock]')).length;`);
  ok(`الشريط بما يُستعمل كلّ يوم: ${bar} زرًّا ظاهرًا (كان نحو ثلاثين)`, bar > 0 && bar <= 15);
  ok('وأدوات الحافظة والترتيب مطويّة', !(await visible('[data-edit="copy"]')) && !(await visible('[data-align="hCenter"]')));
  await click('[data-menu="edit"]');
  await wait(300);
  const edit = await page.eval(`return document.querySelector('[data-menu-panel="edit"]')?.innerText ?? '';`);
  ok(`«تحرير ▾» بأسماء أدواته واختصاراتها («${edit.replace(/\s+/g, ' ').slice(0, 60)}…»)`, (await visible('[data-edit="copy"]')) && edit.includes('انسخ') && edit.includes('Ctrl+C') && edit.includes('فكّ التجميع'));
  await page.key('Escape');
  await wait(200);
  ok('وEscape يطويها', !(await visible('[data-edit="copy"]')));
  await page.eval(`document.querySelector('[data-design] [data-handle]')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); return true;`);
  await page.eval(`document.querySelector('[data-desk]')?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true;`);
  await wait(300);
  await click('[data-menu="arrange"]');
  await wait(300);
  const arrange = await page.eval(`return document.querySelector('[data-menu-panel="arrange"]')?.innerText ?? '';`);
  ok('و«رتّب ▾»: المحاذاة والتوزيع والطبقات بعناوينها', arrange.includes('المحاذاة') && arrange.includes('التوزيع') && arrange.includes('الطبقات') && arrange.includes('إلى الأمام'));
  await click('[data-align="hCenter"]');
  await wait(300);
  ok('والفعل يُنفَّذ ويطويها', !(await visible('[data-align="hCenter"]')) && (await page.eval(`return document.querySelector('[data-menu="arrange"]').getAttribute('aria-expanded');`)) === 'false');
  await click('[data-undo]');
  await wait(300);

  await click('[data-design-panel="fill"]');
  // ── ١٢: «هويّة طالب» بلا تحذير قصّ ────────────────────────────────────
  await page.type('textarea[data-batch-text]', ['الاسم\tالصف\tالرقم', 'زينب علي حسن\tالخامس\t2026001', 'سالم حسن\tالخامس\t2026002', 'مريم كريم\tالسادس\t2026003'].join('\n'));
  await wait(700);
  await click('button[data-act="sheets"]');
  await wait(1800);
  const issues = await page.eval(`return [...document.querySelectorAll('[data-sheets] [data-issue]')].map((n) => n.innerText);`);
  ok(`أوراق «هويّة طالب» الجاهزة بلا تحذير قصّ (${issues.length ? issues.join(' | ').slice(0, 80) : 'لا ملاحظات'})`, !issues.some((t) => t.includes('خطّ القصّ')));

  // ── ١٤: مراجعة الأوراق ───────────────────────────────────────────────
  if (shotsDir) await page.shot(join(shotsDir, 'design-sheets.png'));
  const box = () => page.eval(`return document.querySelector('[data-sheets] [data-options-box]')?.dataset.optionsBox ?? null;`);
  ok('الفحص ظاهر، وخيارات الورق مطويّة تحت اسمها', (await visible('[data-sheets] [data-preflight]')) && (await box()) === 'closed' && !(await visible('[data-sheets] [data-slot]')));
  ok('ويقول اسمها متى تُستعمل', (await page.eval(`return document.querySelector('[data-sheets] [data-options-box] summary')?.innerText ?? '';`)).includes('بطاقةٍ تلفت'));
  await click('[data-sheets] [data-options-box] summary');
  await wait(300);
  ok('وتنفتح بالضغط: أوّل خانةٍ فارغة وبطاقاتٌ بعينها', (await box()) === 'open' && (await visible('[data-sheets] [data-slot]')) && (await visible('[data-sheets] [data-act="pick-cards"]')));
  await click('[data-sheets] [data-options-box] summary');
  await wait(300);
  await click('[data-sheets] button[data-slot="2"]');
  await wait(500);
  ok('وخيارٌ يُفعَّل يفتحها وحده — فلا يُخفى ما يغيّر الأوراق', (await box()) === 'open');
  await click('[data-sheets] button[data-slot="0"]');
  await page.eval(`document.querySelector('[data-sheets] button[title="رجوع (Esc)"]')?.click(); return true;`);
  await wait(500);

  await click('[data-editor-panel="fill"] [data-close-panel]');
  // ── ٢: جدولٌ على لوحةٍ بيضاء ──────────────────────────────────────────
  await click('[data-act="gallery"]');
  await wait(600);
  await click('[data-act="blank-card"]');
  await wait(400);
  await page.eval(`[...document.querySelectorAll('button[type="submit"]')].find((b) => b.textContent.includes('اللوحة البيضاء'))?.click(); return true;`);
  await wait(900);
  await click('[data-design-tool="table"]');
  await page.eval(`const s=document.querySelector('[data-design]');const r=s.getBoundingClientRect();const o={bubbles:true,clientX:r.right-r.width*.08,clientY:r.top+r.height*.35};s.dispatchEvent(new MouseEvent('mousedown',o));document.querySelector('[data-desk]').dispatchEvent(new MouseEvent('mouseup',o));return true;`);
  await click('[data-design-tool="select"]');
  await wait(600);
  const widths = () => Promise.all([0, 1, 2].map((i) => mm(`[data-act="table-col-width-${i}"]`)));
  const before = await widths();
  const total = before.reduce((a, b) => a + b, 0);
  await setMm('[data-act="table-col-width-0"]', (before[0] + 3).toFixed(1));
  await wait(400);
  let after = await widths();
  ok(
    `عرض العمود برقمٍ بالملّم من جاره (${before.join('، ')} ← ${after.join('، ')})`,
    Math.abs(after[0] - before[0] - 3) < 0.15 && Math.abs(after[1] - before[1] + 3) < 0.15 && after[2] === before[2]
  );
  await click('button[title^="إضافة عمود جديد"]');
  await wait(400);
  const ths = await page.eval(`return [...document.querySelector('[data-design] table thead tr').children].map((th) => parseFloat(th.style.width));`);
  ok(`والعمود الجديد بعرض متوسّطها والمجموع مئة (${ths.join('، ')})`, ths.length === 4 && ths[3] === 25 && Math.abs(ths.reduce((a, b) => a + b, 0) - 100) < 0.1);
  await click('button[title="حذف آخر عمود"]');
  await wait(400);

  if (shotsDir) await page.shot(join(shotsDir, 'design-table.png'));
  ok('وحدود الجدول المحدَّد على اللوحة مقابضُ تُسحب', (await page.eval(`return document.querySelectorAll('[data-table-grip^="col-"]').length;`)) === 2 && (await page.eval(`return document.querySelectorAll('[data-table-grip^="row-"]').length;`)) === 3);
  const colsBefore = await widths();
  await drag('[data-table-grip="col-1"]', -40, 0);
  const colsAfter = await widths();
  ok(
    `سحب الحدّ بين العمودين الأوّلين: الأوّل يتّسع بقدر ما يضيق جاره، والثالث كما هو (${colsBefore.join('، ')} ← ${colsAfter.join('، ')})`,
    colsAfter[0] > colsBefore[0] + 2 && Math.abs(colsAfter[0] + colsAfter[1] - colsBefore[0] - colsBefore[1]) < 0.2 && colsAfter[2] === colsBefore[2] && Math.abs(colsAfter.reduce((a, b) => a + b, 0) - total) < 0.3
  );
  const painted = () => page.eval(`return [...document.querySelector('[data-design] table').rows].map((r) => Math.round(r.getBoundingClientRect().height * 10) / 10);`);
  const rows = () => Promise.all([mm('[data-act="table-header-height"]'), ...[0, 1, 2].map((i) => mm(`[data-act="table-row-height-${i}"]`))]);
  ok('والصفوف بلا ضبطٍ «تلقائي» في اللوح — لا أرقامٌ لا تطابق المرسوم', (await rows()).every((x) => Number.isNaN(x) || x === 0) && (await page.eval(`return document.querySelector('[data-act="table-row-height-0"]').placeholder;`)) === 'تلقائي');
  const drawnBefore = await painted();
  await drag('[data-table-grip="row-1"]', 0, 20);
  const drawnAfter = await painted();
  const rowsBefore = await rows();
  ok(
    `وسحب الحدّ بين صفّ العناوين والأوّل من ارتفاعهما المرسوم بلا قفزة: العناوين أعلى بقدر ما قصر الأوّل، والباقيان كما هما (${drawnBefore.join('، ')} ← ${drawnAfter.join('، ')})`,
    drawnAfter[0] > drawnBefore[0] + 10 && Math.abs(drawnAfter[0] + drawnAfter[1] - drawnBefore[0] - drawnBefore[1]) < 1.5 && Math.abs(drawnAfter[2] - drawnBefore[2]) < 1 && Math.abs(drawnAfter[3] - drawnBefore[3]) < 1
  );
  ok(`واللوح يقول ارتفاعها بالملّم بعد الضبط (${rowsBefore.join('، ')})`, rowsBefore.every((x) => x > 0));
  ok('ويُرسم الجدول بارتفاعات صفوفه', (await drawn()).includes('<tr style="height:'));
  await setMm('[data-act="table-row-height-1"]', (rowsBefore[2] + 2).toFixed(1));
  await wait(400);
  after = await rows();
  ok(`وارتفاع صفٍّ برقمٍ من جاره (${after.join('، ')})`, Math.abs(after[2] - rowsBefore[2] - 2) < 0.15 && Math.abs(after[3] - rowsBefore[3] + 2) < 0.15);
  await click('[data-undo]');
  await wait(400);
  await click('[data-undo]');
  await wait(400);
  ok('والسحبة خطوةٌ واحدة في التراجع: تراجعان يعيدان الصفوف «تلقائي» والأعمدة كما سُحبت', !(await drawn()).includes('<tr style="height:') && Math.abs((await widths())[0] - colsAfter[0]) < 0.15);
  await setMm('[data-act="table-row-height-1"]', '20');
  await wait(400);
  await click('[data-act="table-even-rows"]');
  await wait(400);
  ok('و«صفوف متساوية» يعيدها كما تُرسم بلا ضبط', !(await drawn()).includes('<tr style="height:'));
  await setMm('[data-act="table-row-height-0"]', '20');
  await wait(400);

  await page.type('input[data-title]', 'جدول بعرضٍ وارتفاع');
  await click('button[data-act="save"]');
  await wait(1500);
  const saved = await page.eval(`
    const t = (await window.diwan.templates.list('تصاميم', 'print-only')).find((x) => x.title === 'جدول بعرضٍ وارتفاع');
    const table = t ? (await window.diwan.templates.doc(t.id)).canvas.elements.find((e) => e.kind === 'table') : null;
    return table ? { widths: table.columns.map((c) => c.widthPercent), rows: table.rowHeights, header: table.headerHeight } : null;`);
  ok(
    `ويُحفظ ذلك: عرض الأعمدة وأوزان الصفوف (${JSON.stringify(saved)})`,
    saved?.widths?.length === 3 && Math.abs(saved.widths.reduce((a, b) => a + b, 0) - 100) < 0.2 && saved.rows?.length === 3 && typeof saved.header === 'number'
  );
  return steps;
}
