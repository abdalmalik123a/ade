/**
 * سيناريو: صورة الورقة ← كتاب (هـ٨)، محليًّا.
 *
 * كتابٌ يُرسم بمحرّك الطباعة نفسه (ترويسةٌ بعمودين فوق خطٍّ فاصل، وموضوع، ومتنٌ فيه
 * رقم، وجدول ٣×٣، وختمٌ أزرق فوق التوقيع)، ثم يُصوَّر «بالهاتف»: مائلًا درجتين،
 * أصغر، على سطحٍ داكن، بلا دقّةٍ في ملفّه. فيُفتح من «نموذجٌ جديد ← من صورة ورقة»،
 * ويُتفقّد: سُوّي وقُوّم، والختم لم يُنقل، والجدول من خطوطه، والرقم يُراجَع بقصاصته،
 * ثم يُفتح في المصمّم ويُحفظ — ويُفتَّش في القاعدة عن الوثيقة.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';
import Database from 'better-sqlite3';

const LETTER = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
@page { size: 210mm 297mm; margin: 0 }
body { margin: 0; font-family: 'Traditional Arabic', 'Times New Roman', serif; font-size: 16pt; color: #111 }
.sheet { width: 210mm; height: 297mm; padding: 18mm 20mm; box-sizing: border-box; position: relative; background: #fff }
.head { display: flex; justify-content: space-between; font-weight: bold }
.head div { line-height: 1.6 }
hr { border: 0; border-top: 2px solid #000; margin: 6mm 0 }
h3 { text-align: center; margin: 4mm 0 }
p { text-align: justify; line-height: 1.8; margin: 0 0 3mm }
table { border-collapse: collapse; width: 100%; margin: 4mm 0 }
td, th { border: 1.5px solid #000; padding: 2mm 3mm; text-align: center }
.close { text-align: center; margin-top: 8mm }
.sign { position: absolute; left: 25mm; bottom: 45mm; text-align: center; line-height: 1.6 }
.stamp { position: absolute; left: 60mm; bottom: 38mm; width: 34mm; height: 34mm; border: 3px solid #1d3fae; border-radius: 50%; color: #1d3fae; display: flex; align-items: center; justify-content: center; font-size: 11pt; transform: rotate(-12deg) }
</style></head><body><div class="sheet">
<div class="head">
  <div>جمهورية العراق<br>وزارة التربية<br>المديرية العامة لتربية بغداد</div>
  <div>العدد: ٤٥٦<br>التاريخ: ١٢ / ٩ / ٢٠٢٦</div>
</div>
<hr>
<h3>م / تأييد استمرار بالدوام</h3>
<p>إلى / مديرية الأحوال المدنية</p>
<p>تؤيد إدارة المدرسة أن الطالب أحمد كريم جاسم مستمر بالدوام في الصف الخامس الإعدادي للعام الدراسي الحالي، وقد أُعطي هذا التأييد بناءً على طلبه لتقديمه إلى الجهة المذكورة أعلاه.</p>
<p>ورقم الإيصال المرفق 2026/458 للاطلاع.</p>
<table>
  <tr><th>الاسم</th><th>الصف</th><th>الشعبة</th></tr>
  <tr><td>أحمد كريم جاسم</td><td>الخامس</td><td>أ</td></tr>
  <tr><td>سالم محمود علي</td><td>السادس</td><td>ب</td></tr>
</table>
<p class="close">مع التقدير</p>
<div class="sign">مدير المدرسة<br>علي حسين عباس</div>
<div class="stamp">ختم المدرسة</div>
</div></body></html>`;

// ── PNG: قراءةٌ وكتابةٌ بلا مكتبة ─────────────────────────────────────

function readPng(buf) {
  let pos = 8;
  let w = 0;
  let h = 0;
  let type = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const kind = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') [w, h, type] = [data.readUInt32BE(0), data.readUInt32BE(4), data[9]];
    if (kind === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const bpp = type === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = new Uint8Array(w * h * 3);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const row = new Uint8Array(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? row[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      const p = a + b - c;
      const pr = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c;
      row[i] = (row[i] + [0, a, b, (a + b) >> 1, pr][f]) & 255;
    }
    for (let x = 0; x < w; x++) out.set(row.subarray(x * bpp, x * bpp + 3), (y * w + x) * 3);
    prev = row;
  }
  return { w, h, rgb: out };
}

function writePng({ w, h, rgb }) {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (w * 3 + 1) + 1);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** «صورة هاتف»: الورقة أصغر، مائلةٌ درجتين، على سطحٍ داكن — وبلا دقّةٍ في ملفّها. */
function phonePhoto(sheet) {
  const k = 0.8;
  const w = Math.round(sheet.w * k) + 240;
  const h = Math.round(sheet.h * k) + 240;
  const rgb = new Uint8Array(w * h * 3).fill(70);
  const t = (2 * Math.PI) / 180;
  const [cos, sin] = [Math.cos(t), Math.sin(t)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - w / 2) / k;
      const dy = (y - h / 2) / k;
      const sx = Math.round(sheet.w / 2 + dx * cos + dy * sin);
      const sy = Math.round(sheet.h / 2 - dx * sin + dy * cos);
      if (sx >= 0 && sy >= 0 && sx < sheet.w && sy < sheet.h) rgb.set(sheet.rgb.subarray((sy * sheet.w + sx) * 3, (sy * sheet.w + sx) * 3 + 3), (y * w + x) * 3);
    }
  }
  return { w, h, rgb };
}

const ROOT = join(process.env.TEMP ?? '.', `diwan-paper-${Date.now()}`);
const PHOTO = join(ROOT, 'letter-photo.png');

export function prepare() {
  mkdirSync(ROOT, { recursive: true });
  return { DIWAN_TEST_OPEN_FILE: PHOTO, DIWAN_TEST_SAVE_DIR: ROOT, DIWAN_TEST_FAKE_CAMERA: '1' };
}

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); return true;`);
  /** ينتظر نهاية القراءة: المراجعة، أو رسالة خطأٍ تُقال. */
  const awaitRead = async () => {
    for (let i = 0; i < 120; i++) {
      await wait(500);
      const got = await page.eval(`
        const box = document.querySelector('[data-paper-review]');
        const err = document.querySelector('[data-paper-error]');
        if (!box) return err ? { error: err.innerText } : null;
        return {
          notes: [...document.querySelectorAll('[data-paper-notes] [data-paper-note]')].map((l) => l.innerText.trim()),
          items: [...box.querySelectorAll('[data-paper-item]')].map((e) => ({ id: e.dataset.paperItem, text: e.innerText, crop: e.querySelector('img')?.naturalWidth ?? 0 })),
          boxes: document.querySelectorAll('[data-paper-view] > div').length
        };`);
      if (got) return got;
    }
    return null;
  };

  // ── الكتاب يُرسم ثم «يُصوَّر» ─────────────────────────────────────
  const saved = await page.eval(`return window.diwan.output.savePng300({ sheetHtml: ${JSON.stringify(LETTER)}, suggestedName: 'letter', page: { w: 210, h: 297 } });`);
  writeFileSync(PHOTO, writePng(phonePhoto(readPng(readFileSync(saved)))));

  await page.goto('templates-library-drafts');
  await wait(900);
  await click('[data-act="new-photo"]');
  await wait(400);
  ok('«من صورة ورقة» في «نموذجٌ جديد»', await page.eval(`return Boolean(document.querySelector('[data-paper-photo]'));`));
  const t0 = Date.now();
  await click('[data-act="paper-pick"]');
  const review = await awaitRead();
  const ms = Date.now() - t0;
  if (review?.error) steps.push(`  … خطأ: ${review.error}`);
  ok(`قُرئت الصورة على الجهاز (${ms}ms)`, Boolean(review?.notes));
  const notes = review?.notes ?? [];
  steps.push(`  … ${notes.join(' | ')}`);
  ok('وسُوّيت من أركانها وقُوّمت', notes.some((n) => n.startsWith('سُوّيت')));
  ok('والختم لم يُنقل — ويُقال', notes.some((n) => n.includes('ختمٌ أو توقيعٌ ملوّن')));
  ok('والجدول ٣×٣ من خطوطه', notes.some((n) => n.includes('جدولٌ ٣×٣')));
  ok('والترويسة فوق الخطّ الفاصل، و«العدد» و«التاريخ» حقلان', notes.some((n) => n.includes('الترويسة')) && notes.some((n) => n.includes('صارا حقلين')));
  const digits = (review?.items ?? []).find((i) => i.text.includes('أرقام'));
  ok('والرقم في المتن يُراجَع بقصاصته من الصورة', Boolean(digits && digits.crop > 0));
  ok('ومربّعات ما قُرئ فوق الصورة', (review?.boxes ?? 0) > 8);
  if (shotsDir) await page.shot(join(shotsDir, 'paper-review.png'));

  // الموظف يصحّح الرقم بالصورة.
  if (digits) await page.type(`input[data-paper-text="${digits.id}"]`, 'ورقم الإيصال المرفق 2026/458 للاطلاع.');
  await wait(200);
  await click('[data-act="paper-open"]');
  await wait(1500);
  const sheet = `document.querySelector('[data-doc-editor]')`;
  const designer = await page.eval(`return ${sheet}?.innerText ?? '';`);
  ok('فُتح في المصمّم', designer.length > 0);
  ok('بترويسته ومتنه وكلماتٍ غير ملتصقة', designer.includes('جمهورية العراق') && designer.includes('استمرار بالدوام') && designer.includes('مديرية الأحوال المدنية'));
  ok('وبجدوله', await page.eval(`return (${sheet}?.querySelectorAll('table tr').length ?? 0) >= 3;`));
  ok('ولا ختم فيه', !designer.includes('ختم المدرسة'));
  ok('وما صحّحه الموظف فيه', designer.includes('2026/458'));
  if (shotsDir) await page.shot(join(shotsDir, 'paper-designer.png'));

  await page.clickText('حفظ النموذج', 'button');
  await wait(1500);
  const db = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const row = db.prepare('SELECT title, doc_json AS j FROM templates ORDER BY id DESC').get();
  db.close();
  const doc = row ? JSON.parse(row.j) : null;
  ok(`وحُفظ نموذجًا باسم موضوعه («${row?.title}»)`, Boolean(row?.title?.includes('تأييد')));
  ok('وفيه أعمدة الترويسة والجدول', Boolean(doc?.blocks?.[0]?.kind === 'columns' && doc.blocks.some((b) => b.kind === 'table')));
  ok(`وحقلا العدد والتاريخ (${JSON.stringify(doc?.fields?.map((f) => f.key))})`, Boolean(doc?.fields?.some((f) => f.key === 'العدد') && doc.fields.some((f) => f.key === 'التاريخ' && f.type === 'date')));

  // ── والمسح بدقّته (٣٠٠ في ملفّه): يُقرأ كما هو، لا يُسوّى من أركانه ──────
  copyFileSync(saved, PHOTO);
  await page.goto('templates-library-drafts');
  await wait(700);
  await click('[data-act="new-photo"]');
  await wait(300);
  await click('[data-act="paper-pick"]');
  const scan = await awaitRead();
  ok(
    'والمسح بدقّته يُقرأ كما هو — بلا تسويةٍ من أركانه، وبجدوله',
    Boolean(scan?.notes && !scan.notes.some((n) => n.startsWith('سُوّيت')) && scan.notes.some((n) => n.includes('جدولٌ ٣×٣')))
  );

  // ── والكاميرا تمرّ بالطريق نفسه: لقطةٌ (مصنوعة، بلا كتاب) تُقرأ أو يُقال إنها بلا نصّ ──
  await page.eval(`[...document.querySelectorAll('[data-paper-photo] button')].find((b) => b.textContent.includes('صورةٌ أخرى'))?.click(); return true;`);
  await wait(300);
  await click('[data-act="paper-camera"]');
  await wait(2500);
  ok('والكاميرا تُفتح من النافذة نفسها', await page.eval(`return Boolean(document.querySelector('[data-camera-capture] video'));`));
  await click('[data-act="camera-take"]');
  await wait(600);
  await click('[data-act="camera-confirm"]');
  const shot = await awaitRead();
  ok(
    `واللقطة تصل القارئ فتُقرأ أو يُقال ما فيها (${shot?.error ?? (shot?.notes ? 'قُرئت' : 'لا شيء')})`,
    Boolean(shot && (shot.notes || shot.error))
  );
  return steps.join('\n');
}
