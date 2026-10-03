/**
 * سيناريو: الخانات المقترحة من ملفّ Word، و«جرّب باسمٍ آخر» (المرحلة ١ من UPGRADE.md).
 *
 * يُستورد كتاب الإنذار الحقيقي (فراغاتٌ منقوطة وصياغةٌ مذكّرة) في المحرّر الجديد: فتُقترح
 * خاناته من الكلام قبل كلّ فراغ — واسم التلميذ في موضعيه خانةٌ واحدة — وتُقترح صياغته خياراتٍ
 * للجنسين. و«جرّب باسمٍ آخر» يملأ الورقة باسم «زينب» فيُعلَّم المذكّر الباقي. ثم تُقبل كلّها
 * بضغطة ويُتراجع عنها بـCtrl+Z ويُعاد، ويُحفظ النموذج، ويُصدر في الشبّاك لتلميذةٍ: «التلميذة»
 * و«غياباتها» على ورقتها.
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';

export async function prepare() {
  const file = process.env.DIWAN_TEST_OPEN_FILE ?? resolve('tests/fixtures/warning-letter.docx');
  process.env.DIWAN_TEST_OPEN_FILE = file;
  return { DIWAN_TEST_OPEN_FILE: file };
}

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (selector) =>
    page.eval(`
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      el.click();
      return true;
    `);
  const count = (selector) => page.eval(`return document.querySelectorAll(${JSON.stringify(selector)}).length;`);

  ok('ملفّ Word للاستيراد', existsSync(process.env.DIWAN_TEST_OPEN_FILE ?? ''));
  await page.eval(`await window.diwan.settings.set({ newEditor: true }); return true;`);
  await page.goto('templates-library-drafts');
  await wait(700);
  await page.clickText('استيراد نموذج');
  await wait(2500);
  ok('انفتح الملفّ في المحرّر الجديد', (await count('[data-editor="v2"] [data-page-editor]')) === 1);

  // ── الاقتراحات ─────────────────────────────────────────────────────
  const hints = await page.eval(`
    return [...document.querySelectorAll('[data-hint]')].map((h) => ({ kind: h.dataset.hint, text: h.innerText }));
  `);
  const has = (kind, text) => hints.some((h) => h.kind === kind && h.text.includes(text));
  ok('اقتُرح «اسم التلميذ» لفراغيه معًا', has('blank', 'اسم التلميذ') && hints.find((h) => h.text.includes('اسم التلميذ'))?.text.includes('2 مواضع'));
  ok('و«الصف» و«التاريخ» من الكلام قبل فراغيهما', has('blank', 'الصف') && has('blank', 'التاريخ'));
  ok('ولا «التقدير»: نقاط الخاتمة زخرفة', !hints.some((h) => h.text.includes('التقدير')));
  ok('والصياغة: «التلميذ» و«غياباته» خياران للجنسين', has('gender', 'التلميذ/التلميذة') && has('gender', 'غياباته/غياباتها'));
  ok('ولا شيء تغيّر قبل الضغط', (await count('[data-page-editor] [data-field]')) === 0);

  // ── «جرّب باسمٍ آخر» قبل القبول: المذكّر الباقي يُعلَّم ──────────────
  await click('[data-act="try-other-name"]');
  await wait(500);
  const marked = await page.eval(`return [...document.querySelectorAll('[data-page-editor] [data-wrong]')].map((e) => e.textContent);`);
  ok(`«جرّب باسمٍ آخر» يعلّم المذكّر الباقي (${marked.length})`, marked.includes('التلميذ') && marked.includes('غياباته') && marked.includes('وحثه'));
  if (shotsDir) await page.shot(join(shotsDir, 'hints-try.png'));

  // ── القبول كلّه بضغطة ──────────────────────────────────────────────
  // عمق التراجع: فتح الملفّ لا يُحسب تغييرًا، والقبول كلّه خطوةٌ واحدة.
  const depth = () => page.eval(`return Number(document.querySelector('[data-editor="v2"]').dataset.undoDepth);`);
  ok('فتح الملفّ لا يضع في التراجع شيئًا', (await depth()) === 0);
  await click('[data-act="hints-all"]');
  await wait(800);
  ok('والقبول كلّه خطوةٌ واحدة في التراجع', (await depth()) === 1);
  const chips = await page.eval(`return [...document.querySelectorAll('[data-page-editor] [data-field]')].map((e) => e.textContent.trim());`);
  ok(`صارت الفراغات والصياغة خانات (${chips.length})`, chips.length >= 10);
  ok('والورقة باسم زينب وصياغتها مؤنّثة', chips.includes('زينب علي حسين') && chips.includes('التلميذة') && chips.includes('غياباتها'));
  ok('ولا علامة باقية', (await count('[data-page-editor] [data-wrong]')) === 0);
  ok('ولا اقتراح باقٍ', (await count('[data-hint]')) === 0);
  if (shotsDir) await page.shot(join(shotsDir, 'hints-applied.png'));

  // ── Ctrl+Z يتراجع عن القبول كلّه خطوةً واحدة، وCtrl+Y يعيده ──────────
  await page.eval(`document.querySelector('[data-page-editor]').focus(); return true;`);
  await page.key('KeyZ', { ctrl: true });
  await wait(500);
  ok('Ctrl+Z يعيد الفراغات كما كانت', (await count('[data-page-editor] [data-field]')) === 0);
  await page.key('KeyY', { ctrl: true });
  await wait(500);
  ok('وCtrl+Y يعيد الخانات', (await count('[data-page-editor] [data-field]')) === chips.length);
  await click('[data-act="try-other-name"]');
  await wait(300);

  // ── الحفظ ثم الشبّاك لتلميذة ──────────────────────────────────────
  await page.clickText('حفظ النموذج');
  await wait(1800);
  const db = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const row = db.prepare('SELECT title, doc_json AS docJson FROM templates').get();
  db.close();
  const doc = row?.docJson ? JSON.parse(row.docJson) : null;
  const name = doc?.fields?.find((f) => f.role === 'name');
  ok('حُفظت خانة الاسم بدورها، فيملؤها سجلّ المواطنين', name?.label === 'اسم التلميذ' && name?.source === 'fullName');
  ok('وخيار الصياغة في الوثيقة', JSON.stringify(doc?.blocks ?? []).includes('"ref":"التلميذ|التلميذة"'));

  await page.goto('service-counter');
  await wait(900);
  await page.clickText(row?.title ?? 'انذار', 'button');
  await wait(300);
  await page.clickText('املأ', 'button');
  await wait(1200);
  const filled = await page.eval(`
    const label = [...document.querySelectorAll('label')].find((l) => l.querySelector('span')?.textContent.trim().startsWith('اسم التلميذ'));
    const input = label?.querySelector('input');
    if (!input) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'زينب علي حسين');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  `);
  ok('كُتب اسم التلميذة في الشبّاك', filled);
  await wait(400);
  await click('[data-gender-value="أنثى"]');
  await wait(300);
  await page.clickText('راجع الأوراق', 'button');
  await wait(1000);
  const sheet = await page.eval(`return document.querySelector('.a4-sheet [data-body]')?.innerText ?? '';`);
  ok('وعلى ورقتها: «التلميذة زينب علي حسين»', sheet.includes('التلميذة زينب علي حسين'));
  ok('و«غياباتها» و«وانذارها» و«وحثها»', sheet.includes('غياباتها') && sheet.includes('وانذارها') && sheet.includes('وحثها'));
  ok('ولا مذكّرٌ باقٍ', !/التلميذ\s|غياباته\s|وحثه\s/.test(sheet));
  if (shotsDir) await page.shot(join(shotsDir, 'hints-service.png'));

  return steps.join('\n');
}
