/**
 * لقطات صفحة المتجر (🛑 م١٦، بأمر المالك ٣٠ ت١): ستّ لقطاتٍ من البرنامج الحقيقي ببياناتٍ مختلَقة وحدها، بترتيب عرضها.
 *
 * كتابٌ من حزمة التربية بعد «راجع» لزبونةٍ مصنوعة (زينب علي حسن) · ورقة المستمسكات بجوازٍ ووطنيةٍ تُرسمان هنا ·
 * الصور الشخصية بالصورة المولَّدة (`tests/fixtures/portrait-generated.png`) · شهادةٌ من المعرض ممتلئة · المعرض نفسه · والسجلّ بأربعة كتب.
 * المقاس ١٣٦٦×٧٦٨ (شاشة المكاتب) بكثافة ٢، فتخرج ٢٧٣٢×١٥٣٦ PNG كما يطلب المتجر (١٣٦٦×٧٦٨ فأكبر).
 * وارد الشبّاك مجلّدٌ مؤقّت تُكتب فيه الصور المصنوعة نفسها (الجواز والوطنية والصورة الشخصية)، فلا يظهر شيءٌ من ملفّات صاحب الجهاز؛
 * و`KEEP_RUN=1` يُبقي الملف الشخصي والوارد فيُفتح عليهما ديوان للتصوير اليدويّ بالبيانات المختلَقة نفسها.
 *   SHOT_DIR=<مجلّد> node tools/drive.mjs tools/scenarios/storeShots.mjs
 */
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DIR = join(process.env.TEMP ?? '.', `diwan-store-shots-${Date.now()}`);
const OPEN = join(DIR, 'open.png');
const INBOX = join(DIR, 'inbox');
const PORTRAIT = resolve('tests/fixtures/portrait-generated.png');

export function prepare() {
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(INBOX, { recursive: true });
  copyFileSync(PORTRAIT, OPEN);
  return { DIWAN_TEST_OPEN_FILE: OPEN, DIWAN_TEST_SCAN_FILE: OPEN, DIWAN_TEST_SAVE_DIR: DIR, DIWAN_TEST_INBOX: `downloads=${INBOX}` };
}

/**
 * مستمسكٌ مقصوصٌ بمقاسه كما يخرج من «الأركان الأربعة»، مرسومًا في الصفحة بخطّ ديوان: الجواز (١٢٥×٨٨) أو وجه الوطنية أو ظهرها
 * (٨٥٫٦×٥٣٫٩٨)، بأسماء وأرقامٍ مختلَقة، والصورة المولَّدة رماديةً في خانتها.
 */
const DOC = (kind, photo) => `
  const passport = ${JSON.stringify(kind)} === 'passport';
  const W = passport ? 1500 : 1284, H = passport ? 1056 : 810;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, passport ? '#ece4d2' : '#dfe9e6');
  bg.addColorStop(1, passport ? '#dcd2bd' : '#cddbd7');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2;
  for (let i = -H; i < W; i += 22) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + H, H); g.stroke(); }
  const font = getComputedStyle(document.body).fontFamily;
  g.fillStyle = '#26323a'; g.textAlign = 'right'; g.direction = 'rtl';
  const line = (t, y, size, bold) => { g.font = (bold ? '700 ' : '500 ') + size + 'px ' + font; g.fillText(t, W - 60, y); };
  const mrz = (rows, top, size) => {
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(0, top - size * 1.2, W, rows.length * size * 1.45 + size * 0.5);
    g.font = '500 ' + size + 'px Consolas, monospace'; g.textAlign = 'left'; g.direction = 'ltr'; g.fillStyle = '#2f3a40';
    rows.forEach((r, i) => g.fillText(r, 50, top + i * size * 1.45));
  };
  const face = async (x, y, w, h) => {
    const img = new Image(); img.src = 'data:image/png;base64,${photo}'; await img.decode();
    g.save(); g.filter = 'grayscale(1) contrast(1.05)'; g.drawImage(img, x, y, w, h); g.restore();
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3; g.strokeRect(x, y, w, h);
  };
  if (passport) {
    line('جمهورية العراق — جواز سفر', 110, 56, true);
    line('Republic of Iraq — Passport', 175, 34, false);
    line('الاسم: زينب علي حسن', 290, 44, false);
    line('محل الولادة: بغداد', 360, 44, false);
    line('تاريخ الإصدار: ٢٠٢٦/٠١/١٥', 430, 44, false);
    line('جهة الإصدار: مديرية الجوازات', 500, 44, false);
    await face(70, 230, 380, 470);
    mrz(['P<IRQHASSAN<<ZAINAB<ALI<<<<<<<<<<<<<<<<<<<<<', 'A000000000IRQ9901010F3601154<<<<<<<<<<<<<<00'], 870, 44);
  } else if (${JSON.stringify(kind)} === 'front') {
    line('جمهورية العراق', 95, 48, true);
    line('البطاقة الوطنية الموحّدة', 155, 36, false);
    line('الاسم: زينب', 270, 40, false);
    line('الأب: علي', 330, 40, false);
    line('الجدّ: حسن', 390, 40, false);
    line('الجنس: أنثى', 450, 40, false);
    line('الرقم الوطني: ١٩٩٩٠٠٠٠٠٠٠٠', 560, 40, false);
    await face(60, 200, 300, 370);
  } else {
    line('جمهورية العراق', 95, 48, true);
    line('وزارة الداخلية — مديرية الأحوال المدنية والجوازات والإقامة', 155, 32, false);
    line('محل الولادة: بغداد', 230, 36, false);
    line('جهة الإصدار: مديرية الأحوال المدنية', 290, 36, false);
    mrz(['IDIRQZ0000000001999000000000<<', '9901010F3601154IRQ<<<<<<<<<<<0', 'HASSAN<<ZAINAB<ALI<<<<<<<<<<<<'], 590, 46);
  }
  return c.toDataURL('image/png').split(',')[1];
`;

export default async function scenario(page, { shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.click(); return true;`);
  const shot = async (name) => {
    await wait(700);
    if (shotsDir) await page.shot(join(shotsDir, name));
  };
  const fill = (label, value) =>
    page.eval(`
      const l = [...document.querySelectorAll('label')].find((x) => x.textContent.trim().includes(${JSON.stringify(label)}));
      const input = l?.querySelector('input[type="text"]') ?? l?.parentElement?.querySelector('input[type="text"]');
      if (!input) return false;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;`);
  const photo = readFileSync(PORTRAIT).toString('base64');
  const NAMES = { passport: 'جواز سفر - زينب علي حسن.png', front: 'البطاقة الوطنية - الوجه.png', back: 'البطاقة الوطنية - الظهر.png', portrait: 'صورة شخصية - زينب علي حسن.png' };
  const nextImage = async (kind) => {
    const buf = Buffer.from(await page.eval(DOC(kind, photo)), 'base64');
    writeFileSync(OPEN, buf);
    writeFileSync(join(INBOX, NAMES[kind]), buf);
  };

  await page.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 2, mobile: false });
  // تنبيه «اضبط النسخ الاحتياطي» بعد أوّل كتاب يُعدّ مسؤولًا عنه: لا يغطّي اللقطات التالية.
  await page.eval(`await window.diwan.backup.markFirstIssuePromptShown(); return true;`);
  await wait(400);

  // ── ١) كتابٌ من حزمة التربية لزبونةٍ مصنوعة، بعد «راجع» ─────────────────
  await page.eval(`await window.diwan.citizens.save({ id: null, fullName: 'زينب علي حسن', phone: '07700000000', nationalId: '199900000000', motherName: 'فاطمة كاظم', gender: 'أنثى', verified: true }); return true;`);
  await page.goto('templates-library-drafts');
  await wait(800);
  await click('[data-act="content-import"]');
  await wait(600);
  await click('[data-act="import-bundled-education"]');
  await wait(1500);
  await page.key('Escape');
  await wait(400);
  await page.goto('service-counter');
  await wait(900);
  ok(
    'نموذج «تأييد استمرار بالدوام» في الشبّاك',
    await page.eval(`const card = [...document.querySelectorAll('[data-template-card]')].find((c) => c.querySelector('.font-headline-sm')?.textContent?.trim() === 'تأييد استمرار بالدوام'); card?.click(); return Boolean(card);`)
  );
  await wait(400);
  await page.clickText('املأ');
  await wait(1200);
  await page.clickText('هات الزبون');
  await wait(800);
  await page.clickText('زينب علي حسن', 'button');
  await wait(800);
  await fill('الجهة المرسل إليها', 'مديرية تربية بغداد الرصافة الأولى');
  await fill('العام الدراسي', '2026-2027');
  await fill('الصف والشعبة', 'الخامس العلمي - ب');
  await click('[data-gender-value="أنثى"]');
  await wait(300);
  await page.clickText('راجع الأوراق');
  await wait(1500);
  const sheet = await page.eval(`return document.querySelector('.a4-sheet')?.innerText ?? '';`);
  ok('الورقة مرسومةٌ ببيانات الزبونة المصنوعة وبصيغة المؤنّث', sheet.includes('زينب علي حسن') && sheet.includes('الطالبة'));
  await shot('1-كتاب-جاهز-للطباعة.png');

  // ── ٢) السجلّ بعد الحفظ، ومعه ثلاثة كتبٍ أخرى بأسماءٍ مختلَقة ──────────────
  await page.clickText('احفظ بلا طباعة');
  await wait(1500);
  await click('[data-act="after-close"]');
  await wait(500);
  for (const [name, gender, to, grade] of [
    ['سالم حسن كريم', 'ذكر', 'مديرية التقاعد العامة', 'الثالث المتوسط - أ'],
    ['مريم سعد جاسم', 'أنثى', 'دائرة الرعاية الاجتماعية', 'السادس الإعدادي - ج'],
    ['كرار حيدر علي', 'ذكر', 'مصرف الرافدين — فرع الكرادة', 'الأول المتوسط - ب']
  ]) {
    await page.eval(`[...document.querySelectorAll('[data-template-card]')].find((c) => c.querySelector('.font-headline-sm')?.textContent?.trim() === 'تأييد استمرار بالدوام')?.click(); return true;`);
    await wait(400);
    await page.clickText('املأ');
    await wait(1200);
    await fill('اسم الطالب', name);
    await fill('الجهة المرسل إليها', to);
    await fill('العام الدراسي', '2026-2027');
    await fill('الصف والشعبة', grade);
    await click(`[data-gender-value="${gender}"]`);
    await wait(300);
    await page.clickText('راجع الأوراق');
    await wait(1200);
    await page.clickText('احفظ بلا طباعة');
    await wait(1500);
    await click('[data-act="after-close"]');
    await wait(500);
  }
  await page.goto('transactions-archive-ledger');
  await wait(1200);
  const ledger = await page.text();
  ok('السجلّ فيه الكتب الأربعة', ['زينب علي حسن', 'سالم حسن كريم', 'مريم سعد جاسم', 'كرار حيدر علي'].every((n) => ledger.includes(n)));
  await shot('6-السجل.png');

  // ── ٣) ورقة المستمسكات: الجواز وجهًا واحدًا، والوطنية بوجهيها ─────────
  const pickFile = async (face) => {
    await page.until(`return Boolean(document.querySelector('[data-source-picker="${face}"]'));`, 4000);
    await click('[data-source-picker] [data-act="source-file"]');
    await page.until(`return !document.querySelector('[data-source-picker="${face}"]');`, 4000);
    await wait(500);
  };
  const docs = () => page.eval(`return [...document.querySelectorAll('[data-id-sheet] [data-sheet-page] [data-doc]')].map((b) => ({ doc: b.dataset.doc, face: b.dataset.face, empty: b.hasAttribute('data-sheet-empty') }));`);
  await page.goto('service-counter');
  await wait(700);
  await click('[data-cards] [data-card="id-sheet"]');
  await page.until(`return Boolean(document.querySelector('[data-id-sheet]'));`);
  let c = await docs();
  // السكن يُحذف من لوحته؛ فتبقى الوطنية ويُضاف الجواز.
  await click(`[data-doc="${c[2].doc}"][data-face="front"]`);
  await wait(300);
  await click('[data-source-picker] button[title="إغلاق"]');
  await wait(200);
  await click('[data-act="doc-delete"]');
  await wait(300);
  await nextImage('passport');
  await click('[data-act="sheet-add"]');
  await wait(300);
  await click('[data-add-type="passport"] [data-faces="1"]');
  await pickFile('front');
  await nextImage('front');
  await click(`[data-doc="${c[0].doc}"][data-face="front"]`);
  await pickFile('front');
  await nextImage('back');
  await pickFile('back');
  c = await docs();
  ok(`ورقة المستمسكات ممتلئة (${c.length} خانات)`, c.length === 3 && c.every((x) => !x.empty));
  await shot('2-ورقة-المستمسكات.png');
  await click('[data-act="id-sheet-close"]');
  await wait(500);
  ok('وتُغلق الورقة قبل الصور', !(await page.eval(`return Boolean(document.querySelector('[data-id-sheet]'));`)));

  // ── ٤) الصور الشخصية: الصورة المولَّدة بعد إزالة خلفيتها ───────────────
  // الصورة المولَّدة ٣٨٤ نقطة: تُكبَّر أربعًا كصورة هاتف، فلا يظهر تنبيه الدقّة الخاصّ بالصورة الصغيرة.
  const big = await page.eval(`const img = new Image(); img.src = 'data:image/png;base64,${photo}'; await img.decode();
    const c = document.createElement('canvas'); c.width = c.height = 1536; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, 1536, 1536); return c.toDataURL('image/png').split(',')[1];`);
  writeFileSync(OPEN, Buffer.from(big, 'base64'));
  writeFileSync(join(INBOX, NAMES.portrait), Buffer.from(big, 'base64'));
  await page.goto('passport-photos');
  await wait(800);
  await click('[data-act="open-photo"]');
  ok(
    'الصورة الشخصية جاهزة بخلفيتها',
    await page.until(`return document.querySelector('[data-photo-frame]')?.dataset.cutout === 'done' && !document.querySelector('[data-act="review-photos"]').disabled;`, 45000)
  );
  await shot('3-الصور-الشخصية.png');

  // ── ٥) شهادةٌ من معرض التصاميم ─────────────────────────────────────
  await page.goto('designed-documents');
  await wait(900);
  // المعرض من تبويباته: صفّان من التصاميم تحت الأنماط والألوان.
  await page.eval(`const s = [...document.querySelectorAll('div.overflow-auto')].find((e) => e.scrollHeight > e.clientHeight + 50); s.scrollTop = 330; return true;`);
  await shot('5-معرض-التصاميم.png');
  await click('button[data-kind="excellence"]');
  await wait(1800);
  ok('الشهادة مفتوحةٌ في المحرّر', await page.eval(`return Boolean(document.querySelector('[data-design]'));`));
  // حقول اللوحة بلا سمة type (نصّيةٌ بطبعها)، فتُعدّ بخاصّيتها.
  const fields = `return [...document.querySelectorAll('[data-editor-panel="fill"] input')].filter((i) => i.type === 'text').length >= 6;`;
  if (!(await page.eval(fields))) await click('[data-design-panel="fill"]');
  const opened = await page.until(fields, 4000);
  const where = opened
    ? ''
    : await page.eval(
        `return JSON.stringify({ panels: [...document.querySelectorAll('[data-editor-panel]')].map((e) => e.dataset.editorPanel), buttons: [...document.querySelectorAll('[data-design-panel]')].map((e) => e.dataset.designPanel + ':' + e.innerText.trim()) });`
      );
  ok(`لوحة «تعبئة ودفعة» مفتوحة بحقول الشهادة ${where}`, opened);
  if (!opened) return steps.join('\n');
  const values = ['مدرسة الرافدين الابتدائية', 'زينب علي حسن', 'الصف الخامس', '٢٠٢٦ - ٢٠٢٧', 'سالم حسن كريم', 'مدير المدرسة'];
  await page.eval(`
    const inputs = [...document.querySelectorAll('[data-editor-panel="fill"] input')].filter((i) => i.type === 'text').slice(0, 6);
    ${JSON.stringify(values)}.forEach((v, i) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inputs[i], v);
      inputs[i].dispatchEvent(new Event('input', { bubbles: true }));
    });
    [...document.querySelectorAll('[data-editor-panel="fill"] button')].find((b) => b.innerText.trim() === 'اليوم')?.click();
    return true;`);
  await wait(400);
  await click('[data-editor-panel="fill"] [data-close-panel]');
  // وتنبيه «املأه أو الصق قائمة» يمضي قبل اللقطة.
  await wait(4500);
  ok('والشهادة ممتلئة باسم الطالبة', (await page.eval(`return document.querySelector('[data-design]')?.innerText ?? '';`)).includes('زينب علي حسن'));
  await shot('4-تصميم-شهادة.png');

  return steps.join('\n');
}
