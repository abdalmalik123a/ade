/**
 * سيناريو: ورقة المستمسكات المجمّعة (خطة Production، المرحلة ٥).
 *
 * مواطنٌ في ملفّه الوطنية والسكن وجهًا وظهرًا: تُفتح ورقته من ملفّه فتمتلئ الخانات الأربع بمستمسكاته
 * وحدها، وتُصفّ على ورقة A4 واحدة كلٌّ بمقاسه، وتُحفظ PDF صفحةً واحدة، وتُطبع على طابعة دور
 * «استنساخ المستمسكات» (بلا ورق: `DIWAN_TEST_PRINT_LOG`). وفي لوحة الأوامر بابها، وفي الشبّاك لصاحب العلاقة.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.env.TEMP ?? '.', `diwan-idsheet-${Date.now()}`);
const LOG = join(DIR, 'print.jsonl');

export async function prepare() {
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
  return { DIWAN_TEST_SAVE_DIR: DIR, DIWAN_TEST_PRINT_LOG: LOG };
}

export default async function scenario(page, { shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // مواطنٌ بمستمسكاته الأربعة — صورٌ ملوّنة تُرسم في الصفحة — ومستمسكٌ خامس لا يخصّ الورقة.
  await page.eval(`
    const shot = (color) => { const c = document.createElement('canvas'); c.width = 428; c.height = 270;
      const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, 428, 270); return c.toDataURL('image/png'); };
    const c = await window.diwan.citizens.save({ id: null, fullName: 'حيدر سالم العبيدي', verified: false });
    for (const [type, color] of [['البطاقة الوطنية الموحدة — الوجه', '#c33'], ['البطاقة الوطنية الموحدة — الظهر', '#3c3'],
        ['بطاقة السكن — الوجه', '#33c'], ['بطاقة السكن — الظهر', '#cc3'], ['جواز السفر', '#999']])
      await window.diwan.attachments.addFromDataUrl(c.id, type, shot(color));
    return true;
  `);

  // من ملفّه: البحث الشامل يفتحه.
  await page.goto('citizens-identity-records');
  await wait(600);
  await page.eval(`document.querySelector('[data-global-search]').focus(); return true;`);
  await page.type('[data-global-search]', 'العبيدي');
  await wait(900);
  await page.eval(`document.querySelector('[data-search-results] [data-search-citizen]').click(); return true;`);
  await wait(1200);
  await page.eval(`document.querySelector('[data-act="citizen-id-sheet"]').click(); return true;`);
  await wait(1200);

  const sheet = await page.eval(`
    const d = document.querySelector('[data-id-sheet]');
    const slots = [...d.querySelectorAll('[data-sheet-slot]')].map((s) => Boolean(s.querySelector('img')));
    const cards = [...d.querySelectorAll('[data-sheet-card]')].map((c) => c.style.width + 'x' + c.style.height);
    return { slots, cards, pages: d.querySelectorAll('.print-page').length };
  `);
  if (shotsDir) await page.shot(join(shotsDir, 'id-sheet.png'));
  ok('تُفتح من ملفّ المواطن والخانات الأربع ممتلئةٌ بمستمسكاته', sheet.slots.length === 4 && sheet.slots.every(Boolean));
  ok('على ورقة A4 واحدة', sheet.pages === 1);
  ok('كلٌّ بمقاسه الحقيقي: الوطنية ٨٥٫٦×٥٤ والسكن ١٠٥×٧٤ ملم', JSON.stringify(sheet.cards) === JSON.stringify(['85.6mmx54mm', '85.6mmx54mm', '105mmx74mm', '105mmx74mm']));

  await page.eval(`document.querySelector('[data-act="sheet-pdf"]').click(); return true;`);
  await wait(3000);
  const pdfs = readdirSync(DIR).filter((f) => f.endsWith('.pdf'));
  const pdf = pdfs.length ? readFileSync(join(DIR, pdfs[0])).toString('latin1') : '';
  const pageCount = (pdf.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  const box = /\/MediaBox\s*\[([^\]]*)\]/.exec(pdf)?.[1]?.trim() ?? '—';
  ok(`وتُحفظ PDF صفحةً واحدة A4 (${pdfs.length} ملف، ${pageCount} صفحة، ${box})`, pdfs.length === 1 && pageCount === 1 && /^0 0 59[45]/.test(box));

  await page.eval(`return window.diwan.settings.set({ printRoles: { copies: { normal: 'ملوّنة الاستنساخ', color: null, dialog: false } } }).then(() => true);`);
  await page.eval(`document.querySelector('[data-act="sheet-print"]').click(); return true;`);
  await wait(2500);
  const lines = existsSync(LOG) ? readFileSync(LOG, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  ok('وتُطبع على طابعة دور «استنساخ المستمسكات» مباشرةً', lines.length === 1 && lines[0].printer === 'ملوّنة الاستنساخ' && lines[0].silent);

  // خانةٌ تُزال، وأخرى تُضاف — والورقة تتبع.
  await page.eval(`document.querySelector('[data-sheet-slot="res-back"] button[title^="أزل"]').click(); return true;`);
  await wait(400);
  ok('وإزالة خانةٍ تُزيل بطاقتها من الورقة', (await page.eval(`return document.querySelectorAll('[data-id-sheet] [data-sheet-card]').length;`)) === 3);
  await page.eval(`document.querySelector('[data-act="id-sheet-close"]').click(); return true;`);
  await wait(300);

  // ولوحة الأوامر تفتحها من أيّ مكان.
  await page.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', ctrlKey: true })); return true;`);
  await wait(500);
  ok('وفي لوحة الأوامر بابها', (await page.eval(`return document.querySelector('[data-command-palette]')?.innerText ?? '';`)).includes('ورقة المستمسكات المجمّعة'));

  rmSync(DIR, { recursive: true, force: true });
  return steps.join('\n');
}
