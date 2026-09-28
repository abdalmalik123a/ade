/**
 * سيناريو: المستمسكات والماسح (المرحلة الرابعة).
 *
 * التقاطٌ بالكاميرا (مصنوعة) في ملف المواطن — مستمسكًا وصورةً شخصية؛ والتنظيف في
 * نافذة التسوية؛ وعدّة بطاقاتٍ في مسحةٍ واحدة (صورة زجاجٍ عليه بطاقتان تُبنى هنا)؛
 * والتنبيه الخفيف على الرقم الوطني والهاتف؛ والعلامة المائية فوق نسخة الهوية؛
 * وبطاقة التعبئة في نافذتها فوق المتصفّح.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import Database from 'better-sqlite3';

const DIR = join(process.env.TEMP ?? '.', `diwan-idtools-${Date.now()}`);
const GLASS = join(DIR, 'glass.png');

/** PNG بلا مكتبة: توقيعٌ ومقاطع IHDR وIDAT وIEND. */
function png(w, h, pixel) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

export async function prepare() {
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
  // زجاج الماسح بغطائه الأبيض، وعليه بطاقتان بإطارٍ وكتابةٍ وصورة.
  const cards = [
    { x: 60, y: 80, w: 340, h: 214 },
    { x: 450, y: 420, w: 340, h: 214 }
  ];
  writeFileSync(
    GLASS,
    png(850, 1100, (x, y) => {
      for (const c of cards) {
        if (x < c.x || y < c.y || x >= c.x + c.w || y >= c.y + c.h) continue;
        const edge = x - c.x < 4 || c.x + c.w - x <= 4 || y - c.y < 4 || c.y + c.h - y <= 4;
        if (edge) return [120, 120, 125];
        const ly = y - c.y - 30;
        if (x - c.x > 20 && x - c.x < c.w * 0.55 && ly >= 0 && ly < 120 && ly % 30 < 4) return [40, 40, 50];
        if (x > c.x + c.w - 90 && x < c.x + c.w - 25 && y > c.y + 25 && y < c.y + c.h - 25) return [150, 110, 90];
        return [236, 240, 250];
      }
      return [250, 250, 248];
    })
  );
  return { DIWAN_TEST_FAKE_CAMERA: '1', DIWAN_TEST_OPEN_FILE: GLASS };
}

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const attachments = (id) => {
    const d = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
    const rows = d.prepare('SELECT doc_type AS t FROM attachments WHERE citizen_id = ? ORDER BY id').all(id).map((r) => r.t);
    d.close();
    return rows;
  };
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)}).click(); return true;`);

  const id = await page.eval(`return (await window.diwan.citizens.save({ id: null, fullName: 'عبد الله نور الدين كاظم الجبوري', verified: false, phone: '07701234567', nationalId: '199912345678' })).id;`);
  await page.goto('citizens-identity-records');
  await wait(1200);

  // ── التقاطٌ بالكاميرا (ج١٢) ────────────────────────────────────────────
  await click('[data-act="camera-attachment"]');
  await wait(2500);
  ok('الكاميرا تُفتح في ملف المواطن', await page.eval(`return Boolean(document.querySelector('[data-camera-capture] video'));`));
  await click('[data-act="camera-take"]');
  await wait(600);
  ok('واللقطة تُرى قبل حفظها', await page.eval(`return Boolean(document.querySelector('[data-camera-shot]'));`));
  await click('[data-act="camera-secondary"]');
  await wait(1500);
  ok('و«احفظها كما هي» تضيفها إلى مستمسكاته', attachments(id).includes('مستمسك بالكاميرا'));

  await click('[data-act="camera-attachment"]');
  await wait(2500);
  await click('[data-act="camera-take"]');
  await wait(600);
  await click('[data-act="camera-confirm"]');
  await wait(2000);
  ok('و«سوِّها وقوِّمها» تفتح نافذة التسوية بأدوات التنظيف (هـ١)', await page.eval(`return document.querySelectorAll('[data-cleaning] [data-clean]').length === 3;`));
  await page.eval(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('مسح نظيف'))?.click(); return true;`);
  await page.eval(`document.querySelector('[data-clean="straighten"]').click(); return true;`);
  await wait(1500);
  ok('ويُقال أثره: الحبر من الورقة', /الحبر \d+٪/.test(await page.eval(`return document.querySelector('[data-clean-effect]')?.innerText ?? '';`)));
  await page.eval(`
    const b = [...document.querySelectorAll('button')].filter((x) => /اعتماد|تطبيق|احفظ|اعتمد/.test(x.textContent)).pop();
    b?.click();
    return true;`);
  await wait(2000);
  ok('والمسوّاة تُحفظ في مستمسكاته', attachments(id).includes('مستمسك بالكاميرا (مستوٍ)'));

  // ── عدّة بطاقاتٍ بمسحةٍ واحدة (هـ٢) ────────────────────────────────────
  const before = attachments(id).length;
  await click('[data-act="multi-card"]');
  await wait(600);
  await click('[data-act="multi-file-fronts"]');
  await wait(3000);
  const found = await page.eval(`return Number(document.querySelector('[data-multi-cards]')?.getAttribute('data-multi-cards') ?? 0);`);
  ok(`بطاقتان على الزجاج تُعرفان وتُقصّان (${found})`, found === 2);
  await click('[data-act="multi-file-backs"]');
  await wait(3000);
  ok('والظهور تُطابَق بوجوهها من مواضعها', (await page.eval(`return document.querySelector('[data-multi-pairs]')?.innerText ?? '';`)).includes('طوبق 2'));
  await click('[data-act="multi-save"]');
  await wait(2500);
  const after = attachments(id);
  ok(`وتُحفظ كلّ بطاقةٍ بوجهها وظهرها (${after.length - before})`, after.length - before === 4 && after.includes('بطاقة 1 — الوجه') && after.includes('بطاقة 2 — الظهر'));

  // ── العلامة المائية فوق نسخة الهوية (هـ٣) ─────────────────────────────
  await page.eval(`[...document.querySelectorAll('button')].find((b) => b.title?.includes('بوجهين 1:1'))?.click(); return true;`);
  await wait(1200);
  await click('[data-act="id-watermark"]');
  await wait(300);
  await page.type('[data-watermark-to]', 'مصرف الرشيد');
  await wait(800);
  ok('العلامة المائية باسم الجهة', (await page.eval(`return document.querySelector('[data-watermark-text]')?.value ?? '';`)) === 'نسخة لغرض تقديمها إلى مصرف الرشيد فقط');
  await page.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'إغلاق' || b.title === 'إغلاق')?.click(); return true;`);
  await wait(600);

  // ── التنبيه الخفيف (د١٣) ───────────────────────────────────────────────
  await page.eval(`[...document.querySelectorAll('button')].find((b) => b.title === 'تعديل بيانات المواطن')?.click(); return true;`);
  await wait(800);
  ok('رقمٌ وطني وهاتفٌ سليمان: لا تنبيه', !(await page.eval(`return Boolean(document.querySelector('[data-field-hint]'));`)));
  await page.type('[data-citizen-field="nationalId"]', '19991234567');
  await page.type('[data-citizen-field="phone"]', '0770123456');
  await wait(300);
  const hints = await page.eval(`return [...document.querySelectorAll('[data-field-hint]')].map((e) => e.getAttribute('data-field-hint'));`);
  ok(`والناقص يُنبَّه عليه بجانب خانته — تنبيهًا لا منعًا (${hints.join('، ')})`, hints.includes('nationalId') && hints.includes('phone'));

  // ── الصورة الشخصية بالكاميرا (ج١٢) ────────────────────────────────────
  await page.type('[data-citizen-field="nationalId"]', '199912345678');
  await page.type('[data-citizen-field="phone"]', '07701234567');

  // ── خانات الاستمارات الحكومية (أيلول ٢٠٢٦) بأبوابها الأربعة ──────────────
  const groups = await page.eval(`return [...document.querySelectorAll('[data-citizen-group]')].map((g) => g.getAttribute('data-citizen-group'));`);
  ok(`نموذج الملف بأبوابه: ${groups.join('، ')}`, groups.length === 4 && groups[0] === 'الهوية');
  await page.type('[data-citizen-field="surname"]', 'الموسوي');
  await page.type('[data-citizen-field="motherName"]', 'فاطمة كاظم جواد');
  await page.type('[data-citizen-field="governorate"]', 'بغداد');
  await page.type('[data-citizen-field="address"]', 'محلة ٦١٢ زقاق ١٤ دار ٧');
  await page.type('[data-citizen-field="familyNumber"]', '1108L0M15600010101');
  if (shotsDir) await page.shot(join(shotsDir, 'citizen-form-groups.png'));
  await click('[data-act="camera-photo"]');
  await wait(2500);
  await click('[data-act="camera-take"]');
  await wait(600);
  await click('[data-act="camera-confirm"]');
  await wait(1200);
  await page.clickText('حفظ الملف', 'button');
  await wait(1200);
  const d = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const saved = d.prepare('SELECT photo_path AS p, mother_name AS m, surname AS s, family_number AS f FROM citizens WHERE id = ?').get(id);
  d.close();
  ok(`والصورة الشخصية بالكاميرا تُحفظ في ملفّه (${saved?.p ?? '—'})`, Boolean(saved?.p));
  ok('واسم الأم واللقب والرقم العائلي في أعمدتها', saved?.m === 'فاطمة كاظم جواد' && saved?.s === 'الموسوي' && saved?.f === '1108L0M15600010101');
  const tiles = await page.eval(`return document.body.innerText;`);
  ok('والملف يعرض الخانات المملوءة وحدها من الجديدة', tiles.includes('اسم الأم الثلاثي') && tiles.includes('الرقم العائلي') && !tiles.includes('رقم الصحيفة'));

  // ── بطاقة التعبئة في نافذتها (هـ٦) ─────────────────────────────────────
  await click('[data-act="fill-card"]');
  await wait(2500);
  const targets = await (await fetch('http://127.0.0.1:9223/json/list')).json();
  const card = targets.find((t) => t.type === 'page' && String(t.url).includes('mode=fillcard') && String(t.url).includes(`citizen=${id}`));
  ok('بطاقة التعبئة تُفتح في نافذتها', Boolean(card));

  // ما في نافذة البطاقة: تُقرأ من بروتوكولها هي — فهي نافذةٌ غير نافذة البرنامج.
  if (card) {
    const ws = new WebSocket(card.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    const expression = `JSON.stringify({ text: document.body.innerText, lines: Object.fromEntries([...document.querySelectorAll('[data-fill-line]')].map((b) => [b.dataset.fillLine, b.querySelector('span:nth-child(2)').innerText.trim()])) })`;
    const { text, lines } = JSON.parse(
      await new Promise((resolve) => {
        ws.addEventListener('message', (m) => resolve(JSON.parse(String(m.data)).result?.result?.value ?? '{}'), { once: true });
        ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
      })
    );
    // النقر ينسخ بحافظة النظام — والبطاقة ليست النافذة الأمامية (تحت المِقْود)، فكانت
    // حافظة المتصفّح ترفض: «Document is not focused».
    await new Promise((resolve) => {
      ws.addEventListener('message', resolve, { once: true });
      ws.send(JSON.stringify({ id: 2, method: 'Runtime.evaluate', params: { expression: `document.querySelector('[data-fill-line="اللقب"]').click()` } }));
    });
    await wait(500);
    ws.close();
    ok('ونقرة سطرٍ فيها تنسخه إلى حافظة النظام ولو لم تكن في الأمام', (await page.eval(`return window.diwan.ui.pasteText();`)) === 'الموسوي');
    const line = (label) => lines?.[label];
    ok(
      `وفيها ما تسأله استمارات أور: اسم الأم مفرَّقًا واللقب والمحلة والزقاق والدار (${line('اسم أب الأم')} · ${line('اللقب')} · ${line('المحلة')}/${line('الزقاق')}/${line('الدار')})`,
      line('اسم أب الأم') === 'كاظم' && line('اللقب') === 'الموسوي' && line('المحلة') === '612' && line('الزقاق') === '14' && line('الدار') === '7'
    );
    ok('وتنبيه «امحُ اسم صاحب الحساب» أعلاها', text.includes('تملأ اسم صاحبه'));
  }

  return steps.join('\n');
}
