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

export default async function scenario(page, { profile }) {
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
  await click('[data-act="camera-photo"]');
  await wait(2500);
  await click('[data-act="camera-take"]');
  await wait(600);
  await click('[data-act="camera-confirm"]');
  await wait(1200);
  await page.clickText('حفظ الملف', 'button');
  await wait(1200);
  const d = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const photo = d.prepare('SELECT photo_path AS p FROM citizens WHERE id = ?').get(id)?.p;
  d.close();
  ok(`والصورة الشخصية بالكاميرا تُحفظ في ملفّه (${photo ?? '—'})`, Boolean(photo));

  // ── بطاقة التعبئة في نافذتها (هـ٦) ─────────────────────────────────────
  await click('[data-act="fill-card"]');
  await wait(2500);
  const targets = await (await fetch('http://127.0.0.1:9223/json/list')).json();
  ok('بطاقة التعبئة تُفتح في نافذتها', targets.some((t) => t.type === 'page' && String(t.url).includes('mode=fillcard') && String(t.url).includes(`citizen=${id}`)));

  return steps.join('\n');
}
