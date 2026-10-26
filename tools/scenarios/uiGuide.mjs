/**
 * سيناريو: دليل الواجهة (`UI.md`، محادثة «الأساس» — البنود ١٥ و١٦ و١٧ و١٩).
 *
 * اسمٌ واحد لكلّ مكان: «السجلّ» بتبويب «الصادر» وعنوانه «الصادر»، و«الزبائن» بـ«الأشخاص». ولا إنكليزية في نافذة
 * «استنساخ هوية»، والبصمة خلف «تفاصيل التوثيق». والعدّ بأداته: «لا نماذج بعد»، «كتاب واحد». وEscape يغلق كلّ نافذة
 * (الهوية والنسخة الاحتياطية) — العليا وحدها، وبحث الشبّاك يُمسح بـ✕ ظاهر.
 * («؟» الذي يهدأ ولا يختفي — البند ٨ — في `overview.mjs`.)
 */
const SHEET = `{ sheetHtml: '<div class="a4-sheet"><p>نؤيد</p></div>', templateId: null, citizenId: null, authorityId: null, citizenName: 'سالم حسن',
  nationalId: null, docType: 'تأييد', destination: null, purpose: null, values: {}, copies: 1, copyKind: null, fee: 0,
  gregorianDate: '', hijriDate: null, operator: null, printer: null, serialPrefix: 'م', serialYear: 2026, letterheadId: null }`;

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const has = (sel) => page.eval(`return Boolean(document.querySelector('${sel}'));`);
  const text = () => page.text();

  // ── العدّ في مكتبٍ فارغ ───────────────────────────────────────────────
  await page.goto('templates-library-drafts');
  await wait(800);
  ok('المكتبة الفارغة: «لا نماذج بعد» لا «0 نموذجًا»', (await text()).includes('لا نماذج بعد') && !(await text()).includes('0 نموذجًا'));

  // ── السجلّ: اسمٌ واحد، والعدّ، والبصمة خلف «تفاصيل» ─────────────────────
  const issued = await page.eval(`try { await window.diwan.documents.issue(${SHEET}, false); return 'ok'; } catch (e) { return String(e?.message ?? e); }`);
  await page.goto('transactions-archive-ledger');
  await wait(900);
  const tabs = await page.eval(`return [...document.querySelectorAll('[data-path]')].map((e) => e.innerText.trim()).filter((t) => t === 'الصادر' || t === 'الأحداث').join('|');`);
  const h1 = await page.eval(`return document.querySelector('[data-archive] h1')?.innerText.trim() ?? '';`);
  let t = await text();
  ok(`السجلّ بتبويبَي «الصادر» و«الأحداث»، وعنوان الشاشة اسم تبويبها (${tabs} · ${h1})`, tabs === 'الصادر|الأحداث' && h1 === 'الصادر');
  ok('ولا «الأرشيف والبحث» ولا «سجل الصادر» ولا «ما خرج» في الشاشة', !t.includes('الأرشيف والبحث') && !t.includes('سجل الصادر') && !t.includes('ما خرج'));
  const today = await page.eval(`return document.querySelector('[data-archive-today]')?.innerText ?? '';`);
  ok(`وعدّ اليوم عربيٌّ سليم («${today}»)`, issued === 'ok' && today.includes('اليوم كتاب واحد') && !today.includes('اليوم: اليوم') && !/\d/.test(today));
  await page.eval(`document.querySelector('[data-row-status]')?.click(); return true;`);
  await wait(700);
  const fp = await page.eval(`const d = document.querySelector('[data-inspect] [data-fingerprint]'); return d ? { open: d.open, shown: d.querySelector('summary')?.innerText ?? '' } : null;`);
  ok('والبصمة مطويّةٌ خلف «تفاصيل التوثيق»', fp?.open === false && fp.shown === 'تفاصيل التوثيق');

  // ── Escape يغلق النافذة: النسخة الاحتياطية ───────────────────────────
  await page.clickText('نسخة احتياطية…');
  await wait(500);
  ok('فُتحت نافذة النسخة الاحتياطية', await has('[data-backup-dialog]'));
  await page.key('Escape');
  ok('وEscape يغلقها', !(await has('[data-backup-dialog]')));

  // ── الزبائن: «الأشخاص»، و«استنساخ هوية» يفتح «ورقة المستمسكات» (S47) بلا إنكليزية ─────────────
  await page.goto('citizens-identity-records');
  await wait(800);
  t = await text();
  ok('«الأشخاص» عنوانًا، ولا «سجل المواطنين» ولا «WIA»', t.includes('الأشخاص') && !t.includes('سجل المواطنين') && !t.includes('WIA'));
  await page.clickText('استنساخ هوية');
  await wait(700);
  t = await text();
  ok('فُتحت «ورقة المستمسكات»', t.includes('ورقة المستمسكات') && (await has('[data-id-sheet]')));
  ok('بلا إنكليزية: لا Front ولا Back ولا Duplex ولا 1:1', !/Front|Back|Duplex|1:1|صانع هويات/.test(t));
  // الخانة الفارغة تُنقر فيُسأل من أين — و«افتح الصورة» فيه.
  await page.eval(`document.querySelector('[data-id-sheet] [data-sheet-empty]').click(); return true;`);
  await wait(400);
  t = await text();
  ok('و«افتح الصورة» لا «استعراض من الحاسوب»', t.includes('افتح الصورة') && !t.includes('استعراض من الحاسوب'));
  await page.key('Escape');
  await wait(300);
  ok('وEscape يغلق العليا وحدها: سؤال المصدر، والورقة باقية', !(await has('[data-source-picker]')) && (await has('[data-id-sheet]')));
  await page.key('Escape');
  await wait(300);
  ok('وEscape ثانيةً يغلق الورقة', !(await has('[data-id-sheet]')));
  ok('والشاشة تحتها باقية', (await text()).includes('أرشيف محلي مؤمّن'));

  // ── بحث الشبّاك يُمسح بـ✕ ظاهر ───────────────────────────────────────
  await page.goto('service-counter');
  await wait(800);
  ok('لا ✕ والبحث فارغ', !(await has('[data-act="search-clear"]')));
  await page.type('[data-counter-search]', 'صور');
  await wait(300);
  ok('كُتب في البحث فظهر ✕', await has('[data-act="search-clear"]'));
  await page.eval(`document.querySelector('[data-act="search-clear"]').click(); return true;`);
  await wait(300);
  const after = await page.eval(`const i = document.querySelector('[data-counter-search]'); return { value: i.value, focused: document.activeElement === i };`);
  ok('و✕ يمسحه ويُبقي المؤشّر فيه', after.value === '' && after.focused && !(await has('[data-act="search-clear"]')));

  // ── لوحة المفاتيح (D97، D101): Tab يُظهر حلقة التركيز على ما وصل إليه ─────
  await page.eval(`document.activeElement?.blur(); return true;`);
  for (let i = 0; i < 3; i++) {
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  }
  await wait(300);
  const ring = await page.eval(
    `const e = document.activeElement; const s = getComputedStyle(e); return { tag: e.tagName, outline: s.outlineStyle + ' ' + s.outlineWidth, ring: s.boxShadow !== 'none' };`
  );
  ok(`Tab بلوحة المفاتيح يُظهر حلقة التركيز (${ring.tag}: ${ring.outline})`, ring.tag !== 'BODY' && (ring.outline.startsWith('solid') || ring.ring));

  return steps;
}
