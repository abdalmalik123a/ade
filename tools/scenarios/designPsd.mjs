/**
 * سيناريو: استيراد تصميمٍ من Photoshop — المقاس من الترويسة، والطبقات تُسطَّح.
 *
 * يبني ملف .psd حقيقيًّا بمقاس هوية CR80 عند ٣٠٠ نقطة/إنش، ثم يستورده ويتفقّد:
 * أقُرئ المقاس من المورد ١٠٠٥؟ وأسُطّحت الصورة خلفيةً تُرسم فعلًا؟
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

/**
 * أصغرُ PSD صالح.
 *
 * وقسمُ الطبقات لا يُترك صفرًا: القارئ يقرأ عدد الطبقات (`i16`) بعد طولَي
 * القسمين مهما كانا، فيلزم اثنا عشر بايتًا — وبدونها يسقط بقراءةٍ خارج المدى.
 */
function psd(w, h, dpi) {
  const head = Buffer.alloc(26);
  head.write('8BPS', 0, 'ascii');
  head.writeUInt16BE(1, 4); // الصيغة
  head.writeUInt16BE(3, 12); // ثلاث قنوات
  head.writeUInt32BE(h, 14);
  head.writeUInt32BE(w, 18);
  head.writeUInt16BE(8, 22); // ثمانيةُ بتّات
  head.writeUInt16BE(3, 24); // RGB

  const color = Buffer.alloc(4); // لا بيانات صيغةٍ لونية

  // المورد ١٠٠٥: الدقّة عددًا ثابتَ الفاصلة ١٦٫١٦
  const resource = Buffer.alloc(28);
  resource.write('8BIM', 0, 'ascii');
  resource.writeUInt16BE(1005, 4);
  resource.writeUInt32BE(16, 8);
  resource.writeUInt32BE(dpi * 65536, 12);
  resource.writeUInt32BE(dpi * 65536, 20);
  const resourceLength = Buffer.alloc(4);
  resourceLength.writeUInt32BE(resource.length);

  const layers = Buffer.alloc(12);
  layers.writeUInt32BE(8, 0); // طول قسم الطبقات والأقنعة
  layers.writeUInt32BE(8, 4); // طول قسم معلومات الطبقات
  // عددُ الطبقات صفر، ثم حشوٌ، ثم طولُ قناع الطبقات العام صفرًا.

  const compression = Buffer.alloc(2); // ٠ = خام بلا ضغط
  const pixels = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    pixels[i] = 0xf3;
    pixels[w * h + i] = 0xe9;
    pixels[2 * w * h + i] = 0xd2;
  }

  return Buffer.concat([head, color, resourceLength, resource, layers, compression, pixels]);
}

export function prepare() {
  const dir = join(process.env.TEMP ?? '.', `diwan-psd-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'هوية-موظف.psd');
  // ١٠١١ × ٦٣٨ بكسل عند ٣٠٠ = ٨٥٫٦ × ٥٤ ملم، وهي CR80.
  writeFileSync(file, psd(1011, 638, 300));
  return { DIWAN_TEST_OPEN_FILE: file, DIWAN_TEST_SAVE_DIR: dir };
}

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`document.querySelector('${sel}')?.click(); return true;`);

  await page.goto('designed-documents');
  await wait(700);
  await click('button[data-act="import"]');
  await wait(3500);

  const size = await page.eval(`return document.querySelector('[data-size]')?.innerText ?? '';`);
  ok('قُرئ مقاس Photoshop من ترويسته', size.includes('85.6') && size.includes('54.0'));
  ok('وقُرئت دقّته من المورد ١٠٠٥', size.includes('300'));
  ok('ولم يُسأل عن مقاسٍ يعرفه', !(await page.text()).includes('اختر مقاسًا معياريًّا'));

  const design = await page.eval(`return document.querySelector('[data-design]')?.innerHTML ?? '';`);
  ok('وسُطّحت الطبقات خلفيةً تُرسم', design.includes('diwan://store/designs/'));

  await page.type('input[data-title]', 'هوية موظف');
  await wait(200);
  await click('button[data-act="save"]');
  await wait(1500);

  const db = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const row = db.prepare('SELECT doc_json AS docJson FROM templates').get();
  db.close();
  const doc = row?.docJson ? JSON.parse(row.docJson) : null;

  ok('وحُفظت لوحةً', doc?.kind === 'canvas');
  ok('بمقاس CR80', Math.round((doc?.canvas?.size?.w ?? 0) * 10) === 856);
  ok('وبخلفيةٍ بدقّة ٣٠٠', doc?.canvas?.background?.dpi === 300);
  // الهوية تُقصّ، فالنزف أصلٌ فيها.
  ok('وبنزفٍ ثلاثة ملّمات', doc?.canvas?.bleed === 3);

  if (shotsDir) await page.shot(join(shotsDir, 'design-psd.png'));
  return steps.join('\n');
}
