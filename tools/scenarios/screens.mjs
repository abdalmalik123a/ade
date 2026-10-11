/**
 * سيناريو: كلّ الشاشات على شاشات المكاتب الصغيرة (خطة Production، المرحلة ٣).
 *
 * حاسوبٌ محمول بـ١٣٦٦×٧٦٨ أو شاشةٌ بـ١٢٨٠×٧٢٠: تُفتح الشاشات الأربع عشرة على المقاسين ويُفتّش في
 * كلٍّ منها: لا تمريرٌ أفقيّ للصفحة، ولا زرٌّ أو حقلٌ يقطعه طرف النافذة أو حاويةٌ لا تُمرَّر، وأسفل
 * السكّة (الإعدادات) ظاهر. ثم السكّة نفسها (المرحلة ٢): خمس وجهاتٍ ظاهرة، والأدوات بطاقاتٌ في الشبّاك،
 * والزبائن بتبويبين، وبطاقات الشبّاك تُخفى وتُرتَّب من الإعدادات وتُصفّى بالبحث. ثم البحث الشامل في مكانه.
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

  // ── السكّة: خمس وجهاتٍ ظاهرة دائمًا، والإعدادات زرٌّ صغير (المرحلة ٢، ن٤) ──
  await size(1280, 720);
  await page.goto('service-counter');
  await wait(500);
  const rail = () =>
    page.eval(`return [...document.querySelectorAll('[data-sidebar="rail"] [data-dest]')].map((a) => ({ dest: a.dataset.dest, label: a.querySelector('span:last-child').innerText.trim(), on: a.getAttribute('aria-current') === 'page' }));`);
  let dests = await rail();
  ok(
    'خمس وجهاتٍ بأسمائها: الشبّاك وقيد العمل والسجلّ والزبائن والمكتبة',
    dests.map((d) => d.label).join('|') === 'الشبّاك|قيد العمل|السجلّ|الزبائن|المكتبة'
  );
  ok('والإعدادات زرٌّ صغير أسفلها', await page.eval(`return Boolean(document.querySelector('[data-sidebar="rail"] [data-act="open-settings"]'));`));
  ok('ولا إخفاء ولا تثبيت: السكّة ظاهرةٌ دائمًا', !(await page.eval(`return Boolean(document.querySelector('[data-act="sidebar-hide"], [data-act="sidebar-pin"], [data-act="sidebar-show"], [data-sidebar-edge]'));`)));
  ok('والشريط العلوي بجانبها لا تحتها', (await page.eval(`return Math.round(document.querySelector('header').getBoundingClientRect().right);`)) <= 1280 - 80);

  // الأدوات بطاقاتٌ في الشبّاك، وتُحسب عليه.
  await page.eval(`document.querySelector('[data-cards] [data-card="photos"]').click(); return true;`);
  await wait(700);
  dests = await rail();
  ok('بطاقة «صور شخصية» تفتح أداتها، والسكّة على «الشبّاك»', (await page.text()).includes('الصور') && dests.find((d) => d.on)?.dest === 'service');

  // الزبائن: أشخاصٌ وجهات تبويبان في رأس الشاشة.
  await page.goto('citizens-identity-records');
  await wait(600);
  const tabs = await page.eval(`return [...document.querySelectorAll('[data-tabs] a')].map((a) => a.innerText.trim()).join('|');`);
  ok('«الزبائن» بتبويبين: الأشخاص والجهات', tabs === 'الأشخاص|الجهات');
  await page.goto('clients-directory');
  await wait(600);
  dests = await rail();
  ok('و«جهات» تحت «الزبائن» في السكّة', dests.find((d) => d.on)?.dest === 'customers');

  // ── بطاقات الشبّاك من الإعدادات ────────────────────────────────────
  await page.goto('office-settings');
  await wait(800);
  await page.eval(`for (const k of ['designs', 'papers']) document.querySelector('[data-counter-cards] [data-card="' + k + '"]').click(); return true;`);
  await wait(700);
  ok('ما أُخفي يُحفظ', (await page.eval(`return (await window.diwan.settings.get()).counterCards.join();`)) === 'photos,id-copy,pdf,blank,id-sheet,order');
  await page.goto('service-counter');
  await wait(800);
  const cards = () => page.eval(`return [...document.querySelectorAll('[data-cards] [data-card]')].map((b) => b.dataset.card);`);
  let shown = await cards();
  ok('ويغيب من الشبّاك', !shown.includes('designs') && !shown.includes('papers') && shown.includes('photos'));
  await page.goto('office-settings');
  await wait(800);
  await page.eval(`document.querySelector('[data-card-row="pdf"] [data-act="card-up"]').click(); return true;`);
  await wait(400);
  await page.eval(`for (const k of ['designs', 'papers']) document.querySelector('[data-counter-cards] [data-card="' + k + '"]').click(); return true;`);
  await wait(700);
  await page.goto('service-counter');
  await wait(800);
  shown = await cards();
  ok('ويعود من الإعدادات، والترتيب بيد المكتب («ملفات PDF» قبل «استنساخ هوية»)', shown.includes('designs') && shown.indexOf('pdf') < shown.indexOf('id-copy'));
  await page.type('[data-counter-search]', 'جواز');
  await wait(400);
  shown = await cards();
  ok('والبحث يصفّي البطاقات بكلمة الزبون («جواز» ← صور شخصية)', shown.join() === 'photos');
  await page.type('[data-counter-search]', '');
  await wait(300);

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
