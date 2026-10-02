/**
 * سيناريو: كلّ الشاشات على شاشات المكاتب الصغيرة (خطة Production، المرحلة ٣).
 *
 * حاسوبٌ محمول بـ١٣٦٦×٧٦٨ أو شاشةٌ بـ١٢٨٠×٧٢٠: تُفتح الشاشات الأربع عشرة على المقاسين ويُفتّش في
 * كلٍّ منها: لا تمريرٌ أفقيّ للصفحة، ولا زرٌّ أو حقلٌ يقطعه طرف النافذة أو حاويةٌ لا تُمرَّر، وأسفل
 * الشريط الجانبي (الطابعة والإعدادات) ظاهر. ثم الشريط نفسه: يُخفى بزرّه فتأخذ الشاشة عرضه، ويظهر
 * بتقريب الفأرة من الحافّة ويختفي بابتعادها، ويُثبَّت. ثم الأقسام الظاهرة، والبحث الشامل في مكانه.
 */
import { join } from 'node:path';

const SIZES = [
  [1366, 768],
  [1280, 720]
];
const SCREENS = [
  'service-counter',
  'orders-board',
  'passport-photos',
  'pdf-tools',
  'transactions-archive-ledger',
  'citizens-identity-records',
  'templates-library-drafts',
  'smart-editor-a4-preview',
  'clients-directory',
  'header-seal-configuration',
  'exam-papers',
  'designed-documents',
  'audit-log-integrity',
  'office-settings'
];

/** ما يُقصّ في الشاشة المعروضة: أزرارٌ وحقولٌ خارج النافذة أو خارج حاويةٍ لا تُمرَّر. */
const AUDIT = `
  const W = innerWidth, H = innerHeight;
  const out = [];
  const name = (el) => (el.getAttribute('data-act') || el.getAttribute('title') || el.innerText || el.getAttribute('placeholder') || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 40);
  const hiddenSidebar = document.querySelector('[data-sidebar="hidden"]');
  const clipping = (s) => ['hidden', 'clip'].includes(s);
  for (const el of document.querySelectorAll('button, a[href], input:not([type="hidden"]), select, textarea')) {
    if (hiddenSidebar && hiddenSidebar.contains(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.opacity === '0') continue;
    if (r.left < -1 || r.right > W + 1) { out.push('طرف النافذة: ' + name(el)); continue; }
    // ما في حاويةٍ تُمرَّر يُبلَغ بتمريرها: يُفحص المحور الذي لم تمرّره حاويةٌ دونه وحده.
    let needX = true, needY = true;
    for (let p = el.parentElement; p && p !== document.body && (needX || needY); p = p.parentElement) {
      const ps = getComputedStyle(p);
      const cx = needX && clipping(ps.overflowX), cy = needY && clipping(ps.overflowY);
      const pr = p.getBoundingClientRect();
      // نصف الزرّ على الأقلّ خارج الحاوية — لا حوافّ الظلال والحدود.
      const offX = cx && (r.left + r.width / 2 < pr.left || r.left + r.width / 2 > pr.right);
      const offY = cy && (r.top + r.height / 2 < pr.top || r.top + r.height / 2 > pr.bottom);
      if (offX || offY) { out.push('حاوية لا تُمرَّر: ' + name(el)); break; }
      if (['auto', 'scroll'].includes(ps.overflowX)) needX = false;
      if (['auto', 'scroll'].includes(ps.overflowY)) needY = false;
    }
  }
  const settingsBtn = document.querySelector('[data-act="open-settings"]');
  const sb = settingsBtn?.getBoundingClientRect();
  return {
    hscroll: document.documentElement.scrollWidth > W + 1,
    sidebarFoot: !sb || (sb.bottom <= H + 1 && sb.top >= 0),
    clipped: [...new Set(out)].slice(0, 6)
  };
`;

export default async function scenario(page, { shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const size = (w, h) => page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });

  // ── الشاشات الأربع عشرة على المقاسين ──────────────────────────────
  for (const [w, h] of SIZES) {
    await size(w, h);
    await wait(400);
    const bad = [];
    for (const path of SCREENS) {
      await page.goto(path);
      await wait(700);
      const a = await page.eval(AUDIT);
      const problems = [
        ...(a.hscroll ? ['تمريرٌ أفقيّ'] : []),
        ...(a.sidebarFoot ? [] : ['أسفل الشريط خارج النافذة']),
        ...a.clipped
      ];
      if (problems.length) bad.push(`${path}: ${problems.join('، ')}`);
      if (shotsDir) await page.shot(join(shotsDir, `${w}x${h}-${path}.png`));
    }
    ok(`${w}×${h}: الشاشات الأربع عشرة بلا مقصوص${bad.length ? ` — ${bad.join(' | ')}` : ''}`, bad.length === 0);
  }

  // ── الشريط الجانبي: يُخفى ويظهر بالفأرة ويُثبَّت ─────────────────────
  await size(1280, 720);
  await page.goto('service-counter');
  await wait(500);
  const state = () => page.eval(`return document.querySelector('[data-sidebar]')?.dataset.sidebar ?? null;`);
  const contentRight = () =>
    page.eval(`return Math.round(document.querySelector('header').getBoundingClientRect().right);`);
  ok('الشريط مثبّتٌ أوّل مرّة', (await state()) === 'pinned');
  await page.eval(`document.querySelector('[data-act="sidebar-hide"]').click(); return true;`);
  await wait(500);
  ok('زرّ «أخفِ الشريط» يخفيه فيأخذ الشريط العلوي العرض كلّه', (await state()) === 'hidden' && (await contentRight()) >= 1279);
  const box = await page.eval(`const r = document.querySelector('[data-sidebar-edge]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 600, y: 360 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
  await wait(600);
  ok('ويظهر حين تقترب الفأرة من الحافّة اليمنى — فوق الشاشة لا بجانبها', (await state()) === 'open' && (await contentRight()) >= 1279);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1200, y: 300 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 500, y: 300 });
  await wait(700);
  ok('ويختفي حين تبتعد عنه', (await state()) === 'hidden');
  ok('والإخفاء يُحفظ', (await page.eval(`return (await window.diwan.settings.get()).sidebarPinned;`)) === false);
  await page.eval(`document.querySelector('[data-act="sidebar-show"]').click(); return true;`);
  await wait(500);
  ok('وزرّ «الأقسام» في الشريط العلوي يُظهره', (await state()) === 'open');
  await page.eval(`document.querySelector('[data-act="sidebar-pin"]').click(); return true;`);
  await wait(500);
  ok('و«ثبّت» يعيده إلى مكانه', (await state()) === 'pinned' && (await contentRight()) <= 1280 - 280);

  // ── الأقسام الظاهرة ────────────────────────────────────────────────
  await page.goto('office-settings');
  await wait(800);
  const locked = await page.eval(`return ['service', 'archive', 'settings'].every((k) => document.querySelector('[data-section="' + k + '"]')?.disabled);`);
  ok('الشبّاك والأرشيف والإعدادات لا تُخفى', locked);
  await page.eval(`for (const k of ['designs', 'papers']) document.querySelector('[data-section="' + k + '"]').click(); return true;`);
  await wait(700);
  const links = () => page.eval(`return [...document.querySelectorAll('aside a[data-path]')].map((a) => a.dataset.path);`);
  const after = await links();
  ok('وما أُخفي يغيب من الشريط فورًا', !after.includes('designed-documents') && !after.includes('exam-papers') && after.includes('service-counter'));
  ok('ويُحفظ', (await page.eval(`return (await window.diwan.settings.get()).hiddenSections.join();`)) === 'designs,papers');
  await page.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', ctrlKey: true })); return true;`);
  await wait(500);
  const palette = await page.eval(`return document.querySelector('[data-command-palette]')?.innerText ?? null;`);
  ok('ويغيب من لوحة الأوامر', palette !== null && palette.includes('الشبّاك') && !palette.includes('تصاميم البطاقات') && !palette.includes('الأسئلة الامتحانية'));
  await page.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' })); return true;`);
  await wait(300);
  await page.eval(`for (const k of ['designs', 'papers']) document.querySelector('[data-section="' + k + '"]').click(); return true;`);
  await wait(700);
  ok('ويعود من الإعدادات', (await links()).includes('designed-documents'));

  // ── البحث الشامل في مكانه ─────────────────────────────────────────
  await page.eval(`return window.diwan.citizens.save({ id: null, fullName: 'زينب كاظم الساعدي', nationalId: '199012345678', jobTitle: null, workplace: null, employeeCode: null, serviceStatus: null, birthDate: null, birthPlace: null, enrollmentDept: null, address: null, housingCardNo: null, landmark: null, phone: null, photoPath: null, category: null, notes: null, verified: false }).then(() => true);`);
  await page.goto('service-counter');
  await wait(500);
  await page.eval(`document.querySelector('[data-global-search]').focus(); return true;`);
  await page.type('[data-global-search]', 'الساعدي');
  await wait(900);
  const where = await page.eval(`return document.querySelector('[aria-current="page"]')?.dataset.path;`);
  ok('الكتابة في البحث لا تنقل من الشبّاك', where === 'service-counter');
  ok('والنتائج تحته في مكانها: المواطن', await page.eval(`return [...document.querySelectorAll('[data-search-results] [data-search-citizen]')].some((b) => b.innerText.includes('زينب كاظم الساعدي'));`));
  await page.eval(`document.querySelector('[data-search-results] [data-search-citizen]').click(); return true;`);
  await wait(900);
  ok('وضغطةٌ عليه تفتح ملفّه', (await page.eval(`return document.querySelector('[aria-current="page"]')?.dataset.path;`)) === 'citizens-identity-records' && (await page.text()).includes('زينب كاظم الساعدي'));
  await page.eval(`document.querySelector('[data-global-search]').focus(); return true;`);
  await page.type('[data-global-search]', 'الساعدي');
  await wait(500);
  await page.eval(`document.querySelector('[data-global-search]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return true;`);
  await wait(900);
  ok('وEnter يفتح النتائج كلّها في الأرشيف', (await page.eval(`return document.querySelector('[aria-current="page"]')?.dataset.path;`)) === 'transactions-archive-ledger' && (await page.eval(`return Boolean(document.querySelector('[data-search-others]'));`)));

  // ── المكتبة الفارغة: أقصر الطرق إليها في مكانها ─────────────────────
  await page.goto('templates-library-drafts');
  await wait(700);
  ok('المكتبة الفارغة تعرض «استورد مجلدي» و«ورقة فارغة» في وسطها', await page.eval(`return Boolean(document.querySelector('[data-act="empty-import-folder"]') && document.querySelector('[data-act="empty-new-blank"]'));`));

  await page.send('Emulation.clearDeviceMetricsOverride');
  return steps.join('\n');
}
