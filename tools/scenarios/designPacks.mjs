/**
 * سيناريو: حزم التصاميم تُستورد كملفّ (DESIGNS.md ٣٫٦) — تصميمان محفوظان، «حزمة» في «تصاميمك المحفوظة» تختار أحدهما وتحفظه
 * ملفًّا `.diwanpack`؛ ثمّ يُحذف التصميم و«استورد حزمة تصاميم» تعيده بلمحته، والاستيراد الثاني لا يكرّره.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, '0');

export function prepare() {
  const dir = join(tmpdir(), `diwan-designpacks-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const d = new Date();
  // الحفظ يكتب باسمه الافتراضيّ في المجلّد، والاستيراد يفتح الملفّ نفسه.
  return { DIWAN_TEST_SAVE_DIR: dir, DIWAN_TEST_OPEN_FILE: join(dir, `تصاميم-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.diwanpack`) };
}

export default async function scenario(page, { shotsDir } = {}) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const click = (sel) => page.eval(`const el = document.querySelector(${JSON.stringify(sel)}); el?.click(); return Boolean(el);`);
  const body = () => page.eval(`return document.body.innerText;`);
  const savedIds = () => page.eval(`return [...document.querySelectorAll('[data-saved-thumb]')].map((b) => Number(b.dataset.savedThumb));`);
  const saveAs = async (kind, title) => {
    await click('[data-act="gallery"]');
    await wait(500);
    await click(`button[data-kind="${kind}"]`);
    await wait(1200);
    await page.type('input[data-title]', title);
    await click('button[data-act="save"]');
    await wait(1200);
  };

  await page.goto('designed-documents');
  await wait(900);
  await click('button[data-kind="thanks"]');
  await wait(1200);
  await page.type('input[data-title]', 'شكر وتقدير — للحزمة');
  await click('button[data-act="save"]');
  await wait(1200);
  await saveAs('invitation', 'دعوة — تبقى');
  await click('[data-act="gallery"]');
  await wait(900);
  const ids = await savedIds();
  ok(`تصميمان محفوظان (${ids.length})`, ids.length === 2);
  const thanks = await page.eval(`return (await window.diwan.templates.list('تصاميم', 'print-only')).find((t) => t.title === 'شكر وتقدير — للحزمة')?.id ?? null;`);

  // ── «حزمة»: النقر يختار ولا يفتح ──────────────────────────────────
  await click('[data-act="pack-mode"]');
  await wait(300);
  await click(`[data-saved-thumb="${thanks}"]`);
  await wait(300);
  const still = await page.eval(`return Boolean(document.querySelector('[data-gallery-view]')?.offsetParent);`);
  const label = await page.eval(`return document.querySelector('[data-act="pack-save"]')?.innerText ?? '';`);
  if (shotsDir) await page.shot(join(shotsDir, 'design-packs.png'));
  ok(`«حزمة»: النقر على التصميم يختاره ولا يفتحه («${label.trim().split('\n').pop()}»)`, still && label.includes('١'));
  await click('[data-act="pack-save"]');
  await wait(1500);
  ok('ويُحفظ ملفًّا: «حُفظت حزمة فيها تصميم واحد»', (await body()).includes('حُفظت حزمة فيها تصميم واحد'));
  ok('ويعود النقر يفتح', !(await page.eval(`return Boolean(document.querySelector('[data-pack-pick]'));`)));

  // ── يُحذف ثمّ يُستورد ─────────────────────────────────────────────
  await page.eval(`await window.diwan.templates.delete(${thanks}); return true;`);
  await page.goto('orders-board');
  await wait(500);
  await page.goto('designed-documents');
  await wait(1200);
  ok('حُذف التصميم المحزوم', (await savedIds()).length === 1);
  await click('[data-act="pack-import"]');
  await wait(2000);
  const after = await page.eval(`return (await window.diwan.templates.list('تصاميم', 'print-only')).map((t) => t.title);`);
  ok(`و«استورد حزمة تصاميم» يعيده (${after.join('، ')})`, after.includes('شكر وتقدير — للحزمة') && after.length === 2);
  ok('ويقول ما أُضيف إلى «تصاميمك المحفوظة»', (await body()).includes('أُضيف ١ تصميم إلى «تصاميمك المحفوظة»'));
  ok('وتظهر لمحته في المعرض', (await savedIds()).length === 2);
  await wait(3800);
  await click('[data-act="pack-import"]');
  await wait(2000);
  ok('والاستيراد الثاني لا يكرّره', (await body()).includes('لا تصميم جديد في الحزمة') && (await savedIds()).length === 2);
  return steps.join('\n');
}
