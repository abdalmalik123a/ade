/**
 * سيناريو: الياقة تلقائيًّا (البند ٣٩) — صورة المعاملة المولَّدة (`tests/fixtures/portrait-generated.png`)، ونسخةٌ منها
 * تُرسم في الصفحة بياقةٍ بيضاء مرتفعة تغطّي الرقبة تحت الذقن (كقميصٍ مزرّرٍ إلى أعلاه). والخلفية زرقاء فاتحة ليُعرف ما قُصّ.
 *
 * بلا قاطٍ تظهر الياقة كما هي؛ وبالقاط **ما في فتحته من الياقة يُقصّ** (لونها لونُ الخلفية لا الأبيض) والوجه لا يتغيّر،
 * وخلعه يعيدها. وفي الصورة الأصلية بالقاط نفسه **الرقبة باقيةٌ بلون الجلد** — لا يُقصّ إلا ما ليس جلدًا.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const BLUE = [0xdb, 0xe8, 0xf5];

export default async function scenario(page, { shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const click = (sel) => page.eval(`const el = document.querySelector(${JSON.stringify(sel)}); el?.click(); return Boolean(el);`);
  const until = async (expr, ms = 20000) => {
    for (let t = 0; t < ms; t += 250) {
      if (await page.eval(`return Boolean(${expr});`)) return true;
      await wait(250);
    }
    return false;
  };
  /** لون نقطةٍ من الصورة (بكسلاتها ٣٨٤) في لوحة الإطار — متوسّط ٣×٣ — بعد أن يستقرّ الرسم. */
  const read = (x, y) =>
    page.eval(`
      const c = document.querySelector('[data-photo-canvas]');
      const box = JSON.parse(c.dataset.box);
      const k = c.width / c.clientWidth;
      const fx = Math.round((box.left + (${x} * box.width) / 384) * k);
      const fy = Math.round((box.top + (${y} * box.height) / 384) * k);
      const d = c.getContext('2d').getImageData(fx - 1, fy - 1, 3, 3).data;
      const s = [0, 0, 0];
      for (let i = 0; i < d.length; i += 4) for (let j = 0; j < 3; j++) s[j] += d[i + j];
      return s.map((v) => Math.round(v / 9));`);
  const settled = async (x, y) => {
    let a = await read(x, y);
    for (let t = 0; t < 24; t++) {
      await wait(250);
      const b = await read(x, y);
      if (JSON.stringify(a) === JSON.stringify(b)) return b;
      a = b;
    }
    return a;
  };
  const near = (c, rgb, tol = 8) => c.every((v, i) => Math.abs(v - rgb[i]) <= tol);
  const skin = (c) => c[0] > c[1] + 15 && c[1] > c[2] && !near(c, BLUE, 20);

  const fixture = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'portrait-generated.png')).toString('base64');
  /** يفتح الصورة لصقًا — و`collar`: تُرسم عليها في الصفحة ياقةٌ بيضاء من تحت الذقن بعرض الرقبة. */
  const open = async (collar) => {
    await page.goto('designed-documents');
    await wait(300);
    await page.goto('passport-photos');
    await wait(700);
    await page.eval(`
      const bytes = Uint8Array.from(atob(${JSON.stringify(fixture)}), (c) => c.charCodeAt(0));
      let blob = new Blob([bytes], { type: 'image/png' });
      if (${collar}) {
        const bmp = await createImageBitmap(blob);
        const c = document.createElement('canvas');
        c.width = bmp.width;
        c.height = bmp.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(bmp, 0, 0);
        const img = ctx.getImageData(158, 186, 70, 50);
        let seed = 1;
        for (let i = 0; i < img.data.length; i += 4) {
          seed = (seed * 1103515245 + 12345) & 0x7fffffff;
          const n = (seed % 11) - 5;
          img.data[i] = 238 + n; img.data[i + 1] = 238 + n; img.data[i + 2] = 236 + n;
        }
        ctx.putImageData(img, 158, 186);
        blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      }
      const dt = new DataTransfer();
      dt.items.add(new File([blob], 'whatsapp.png', { type: 'image/png' }));
      document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
      return true;`);
    const done = await until(`document.querySelector('[data-photo-frame]')?.dataset.cutout === 'done'`, 30000);
    await wait(500);
    await click('[data-bg="lightBlue"]');
    await page.eval(`const el = document.querySelector('input[data-act="zoom"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '1.5'); el.dispatchEvent(new Event('input', { bubbles: true })); return true;`);
    await wait(500);
    return done;
  };
  const wear = async (id) => {
    await click(`[data-suit="${id}"]`);
    await until(`document.querySelector('[data-tool="suit"]') && !document.querySelector('[data-tool="suit"]').disabled`, 8000);
    await wait(800);
  };

  // ١. الياقة المرتفعة: ظاهرةٌ بلا قاط، ومقصوصةٌ في فتحته.
  ok('صورةٌ بياقةٍ بيضاء مرتفعة تُلصق وتُفرَّغ', await open(true));
  const collarPlain = await settled(192, 206);
  const faceBefore = await settled(192, 120);
  ok(`بلا قاطٍ تظهر الياقة البيضاء تحت الذقن (${collarPlain})`, collarPlain.every((v) => v > 215) && !near(collarPlain, BLUE, 12));
  await wear('suit-brown-gold-tie');
  const collarSuit = await settled(192, 206);
  const faceSuit = await settled(192, 120);
  ok(`وبالقاط يُقصّ ما في فتحته من الياقة — لونه لون الخلفية (${collarPlain} ← ${collarSuit})`, near(collarSuit, BLUE, 10));
  ok(`والوجه لا يتغيّر (${faceBefore} ← ${faceSuit})`, near(faceSuit, faceBefore, 2));
  if (shotsDir) await page.shot(join(shotsDir, 'auto-collar.png'));
  await click('[data-suit="none"]');
  await wait(600);
  ok(`وخلع القاط يعيد الياقة (${await settled(192, 206)})`, near(await settled(192, 206), collarPlain, 6));

  // ٢. الصورة الأصلية: الرقبة جلدٌ تبقى في الفتحة.
  await open(false);
  await wear('suit-brown-gold-tie');
  const neck = await settled(192, 200);
  ok(`وفي الصورة الأصلية بالقاط نفسه تبقى الرقبة بلون الجلد (${neck})`, skin(neck));
  return steps.join('\n');
}
