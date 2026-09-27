/**
 * سيناريو: طبقات Photoshop المسمّاة تُقترح حقولًا (هـ٤).
 *
 * يبني ملف .psd بطبقات نصٍّ كما يكتبها Photoshop: «Name» و«Job Title» و«Layer 3».
 * فيُستورد، ويُسأل المكتب: الأولى حقل «الاسم»، والثانية «العنوان الوظيفي»، والثالثة
 * اسمٌ عامّ لا يُقترح له شيء — فيبقى نصًّا ثابتًا في التصميم.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

const u16 = (n) => {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(n);
  return b;
};
const u32 = (n) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
};
const utf16be = (s) => Buffer.from(s, 'utf16le').swap16();
const tagged = (key, data) => Buffer.concat([Buffer.from(`8BIM${key}`, 'ascii'), u32(data.length), data, Buffer.alloc(data.length % 2)]);

/** طبقة نصّ: المصفوفة، ثم `Txt `، ثم EngineData. */
function tysh(text, engine, t = {}) {
  const head = Buffer.alloc(56);
  head.writeUInt16BE(1, 0);
  [t.xx ?? 1, 0, 0, t.yy ?? 1, t.tx ?? 0, t.ty ?? 0].forEach((v, i) => head.writeDoubleBE(v, 2 + i * 8));
  head.writeUInt16BE(50, 50);
  head.writeUInt32BE(16, 52);
  return Buffer.concat([head, Buffer.from('Txt TEXT', 'ascii'), u32(text.length), utf16be(text), Buffer.from(engine, 'latin1')]);
}

/** ملف PSD بطبقاته وصورته المسطَّحة (RGB، بلا ضغط). */
function layeredPsd({ w, h, dpi, composite, layers }) {
  const head = Buffer.alloc(26);
  head.write('8BPS', 0, 'ascii');
  head.writeUInt16BE(1, 4);
  head.writeUInt16BE(3, 12);
  head.writeUInt32BE(h, 14);
  head.writeUInt32BE(w, 18);
  head.writeUInt16BE(8, 22);
  head.writeUInt16BE(3, 24);

  const res = Buffer.alloc(28);
  res.write('8BIM', 0, 'ascii');
  res.writeUInt16BE(1005, 4);
  res.writeUInt32BE(16, 8);
  res.writeUInt32BE(dpi * 65536, 12);
  res.writeUInt32BE(dpi * 65536, 20);

  const records = [];
  const data = [];
  for (const l of layers) {
    const lw = l.rect.right - l.rect.left;
    const lh = l.rect.bottom - l.rect.top;
    const ids = [-1, 0, 1, 2];
    const rect = Buffer.alloc(16);
    rect.writeInt32BE(l.rect.top, 0);
    rect.writeInt32BE(l.rect.left, 4);
    rect.writeInt32BE(l.rect.bottom, 8);
    rect.writeInt32BE(l.rect.right, 12);
    const info = Buffer.concat(ids.map((id) => Buffer.concat([Buffer.from([(id >> 8) & 255, id & 255]), u32(2 + lw * lh)])));
    const blend = Buffer.concat([Buffer.from('8BIMnorm', 'ascii'), Buffer.from([255, 0, 8, 0])]);
    const nameBytes = Buffer.from(l.name, 'latin1');
    const name = Buffer.alloc(Math.ceil((1 + nameBytes.length) / 4) * 4);
    name[0] = nameBytes.length;
    nameBytes.copy(name, 1);
    const extra = Buffer.concat([
      u32(0),
      u32(0),
      name,
      tagged('luni', Buffer.concat([u32(l.name.length), utf16be(l.name)])),
      ...(l.text ? [tagged('TySh', l.text)] : [])
    ]);
    records.push(Buffer.concat([rect, u16(ids.length), info, blend, u32(extra.length), extra]));
    for (const id of ids) {
      const plane = Buffer.alloc(lw * lh, id === -1 ? 255 : l.color[id]);
      data.push(Buffer.concat([u16(0), plane]));
    }
  }
  let layerInfo = Buffer.concat([u16(layers.length), ...records, ...data]);
  if (layerInfo.length % 2) layerInfo = Buffer.concat([layerInfo, Buffer.alloc(1)]);
  const section = Buffer.concat([u32(layerInfo.length), layerInfo, u32(0)]);

  const planes = [0, 1, 2].map((c) => {
    const p = Buffer.alloc(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) p[y * w + x] = composite(x, y)[c];
    return p;
  });
  return Buffer.concat([head, u32(0), u32(res.length), res, u32(section.length), section, u16(0), ...planes]);
}

const BG = [30, 60, 110];
const INK = [255, 255, 255];
const TEXTS = [
  { name: 'Name', value: 'Ahmed Ali', rect: { top: 300, left: 380, bottom: 360, right: 900 } },
  { name: 'Job Title', value: 'Engineer', rect: { top: 390, left: 380, bottom: 440, right: 800 } },
  { name: 'Layer 3', value: 'ACME Co', rect: { top: 60, left: 60, bottom: 120, right: 500 } }
];
const inside = (r, x, y) => x >= r.left && x < r.right && y >= r.top && y < r.bottom;

export function prepare() {
  const dir = join(process.env.TEMP ?? '.', `diwan-layers-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'staff-card.psd');
  const w = 1011;
  const h = 638;
  writeFileSync(
    file,
    layeredPsd({
      w,
      h,
      dpi: 300,
      composite: (x, y) => (TEXTS.some((t) => inside(t.rect, x, y)) ? INK : BG),
      layers: [
        { name: 'Background', rect: { top: 0, left: 0, bottom: h, right: w }, color: BG },
        ...TEXTS.map((t) => ({
          name: t.name,
          rect: t.rect,
          color: INK,
          text: tysh(t.value, '/EngineDict << /FontSize 40.0 /Justification 0 >>', { tx: t.rect.left, ty: t.rect.bottom - 10 })
        }))
      ]
    })
  );
  return { DIWAN_TEST_OPEN_FILE: file, DIWAN_TEST_SAVE_DIR: dir };
}

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); return true;`);

  await page.goto('designed-documents');
  await wait(700);
  await click('button[data-act="import"]');
  let review = null;
  for (let i = 0; i < 20 && !review; i++) {
    await wait(400);
    review = await page.eval(`
      const box = document.querySelector('[data-layer-fields]');
      if (!box) return null;
      return [...box.querySelectorAll('[data-layer-suggestion]')].map((l) => ({
        layer: l.dataset.layerSuggestion,
        checked: l.querySelector('input[type="checkbox"]')?.checked ?? null,
        text: l.innerText
      }));`);
  }
  ok(`بعد الاستيراد يُسأل: أيّ الطبقات حقولٌ تُملأ؟ (${JSON.stringify(review?.map((r) => r.layer))})`, Boolean(review));
  const byLayer = (name) => review?.find((r) => r.layer === name);
  ok('«Name» ← الاسم، ومُعلَّمةٌ سلفًا', Boolean(byLayer('Name')?.checked && byLayer('Name').text.includes('Ahmed Ali')));
  ok('«Job Title» ← العنوان الوظيفي', Boolean(byLayer('Job Title')?.checked));
  ok('و«Layer 3» اسمٌ عامّ لا يُقترح', !byLayer('Layer 3'));
  if (shotsDir) await page.shot(join(shotsDir, 'layer-fields.png'));

  await click('[data-act="layer-fields-apply"]');
  await wait(900);
  const inputs = await page.eval(`return [...document.querySelectorAll('input[data-value]')].map((e) => [e.dataset.value, e.value]);`);
  const value = (key) => inputs.find(([k]) => k === key)?.[1];
  ok(`فصارتا حقلين يُملآن (${JSON.stringify(inputs)})`, value('الاسم') !== undefined && value('العنوان الوظيفي') !== undefined);
  ok('بقيمة الملف نفسها للمعاينة', value('الاسم') === 'Ahmed Ali' && value('العنوان الوظيفي') === 'Engineer');
  ok(
    'والنصّ الثابت بقي نصًّا في التصميم',
    (await page.eval(`return document.querySelector('[data-design]')?.innerText ?? '';`)).includes('ACME Co') && !inputs.some(([k]) => k.includes('ACME'))
  );

  await page.type('input[data-title]', 'هوية موظف من Photoshop');
  await click('button[data-act="save"]');
  await wait(1500);
  const d = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const row = d.prepare('SELECT doc_json AS j FROM templates').get();
  d.close();
  const keys = row ? JSON.parse(row.j).fields.map((f) => f.key) : [];
  ok(`وحُفظ التصميم بحقليه (${JSON.stringify(keys)})`, keys.includes('الاسم') && keys.includes('العنوان الوظيفي'));
  return steps.join('\n');
}
