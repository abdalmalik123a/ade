/**
 * سيناريو: الذقن من الوجه (إصلاح البند ٣٩) — صورة المعاملة المولَّدة (`tests/fixtures/portrait-generated.png`) تُرسم عليها في
 * الصفحة **لحيةٌ داكنة** من تحت الشفة إلى ما تحت الذقن، كصورٍ حقيقيةٍ بلحية. والخلفية زرقاء فاتحة ليُعرف ما قُصّ.
 *
 * كان الذقن يُقدَّر من عرض القناع (الصفّ ١٩٤ هنا) فيقع فوق نهاية اللحية: فتقصّ «الياقة تلقائيًّا» أسفلها فيظهر لون الخلفية
 * تحت الفم، ويبدأ «رمّم» منها. والآن الذقن من الوجه (نموذج YuNet وحافّة الإضاءة تحت الفم): **اللحية تبقى بالقاط**، والرقبة
 * تحتها جلد، و**خطّ «رمّم» تحت اللحية**.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const BLUE = [0xdb, 0xe8, 0xf5];
/** اللحية: بيضيٌّ تحت الفم (الفم على الصفّ ١٦٥، والذقن ~١٩٧) ينتهي على الصفّ ٢٠٥. */
const BEARD = { cx: 192, cy: 188, rx: 26, ry: 17 };

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
      const d = c.getContext('2d').getImageData(Math.round((box.left + (${x} * box.width) / 384) * k) - 1, Math.round((box.top + (${y} * box.height) / 384) * k) - 1, 3, 3).data;
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
  const dark = (c) => Math.max(...c) < 110;
  const skin = (c) => c[0] > c[1] + 15 && c[1] > c[2] && !near(c, BLUE, 20);

  const fixture = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'portrait-generated.png')).toString('base64');
  await page.goto('designed-documents');
  await wait(300);
  await page.goto('passport-photos');
  await wait(700);
  await page.eval(`
    const bytes = Uint8Array.from(atob(${JSON.stringify(fixture)}), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(bmp, 0, 0);
    const b = ${JSON.stringify(BEARD)};
    const img = ctx.getImageData(b.cx - b.rx, b.cy - b.ry, b.rx * 2 + 1, b.ry * 2 + 1);
    let seed = 7;
    for (let y = 0; y <= b.ry * 2; y++) for (let x = 0; x <= b.rx * 2; x++) {
      if (((x - b.rx) / b.rx) ** 2 + ((y - b.ry) / b.ry) ** 2 > 1) continue;
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const n = (seed % 13) - 6;
      const i = (y * img.width + x) * 4;
      img.data[i] = 48 + n; img.data[i + 1] = 38 + n; img.data[i + 2] = 32 + n;
    }
    ctx.putImageData(img, b.cx - b.rx, b.cy - b.ry);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'whatsapp.png', { type: 'image/png' }));
    document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    return true;`);
  ok('صورةٌ بلحيةٍ تحت الذقن تُلصق وتُفرَّغ', await until(`document.querySelector('[data-photo-frame]')?.dataset.cutout === 'done'`, 30000));
  await wait(500);
  await click('[data-bg="lightBlue"]');
  await page.eval(`const el = document.querySelector('input[data-act="zoom"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '1.5'); el.dispatchEvent(new Event('input', { bubbles: true })); return true;`);
  await wait(500);

  // نهاية اللحية تحت الذقن الذي كان يُقدَّر (١٩٤): الصفّ ٢٠٠ لحية.
  const beardPlain = await settled(192, 200);
  const faceBefore = await settled(192, 120);
  ok(`بلا قاطٍ تظهر اللحية تحت الذقن (${beardPlain})`, dark(beardPlain));
  await click('[data-suit="suit-brown-gold-tie"]');
  await until(`document.querySelector('[data-tool="suit"]') && !document.querySelector('[data-tool="suit"]').disabled`, 8000);
  await wait(800);
  const beardSuit = await settled(192, 200);
  ok(`وبالقاط تبقى اللحية — لا لون الخلفية في موضعها (${beardPlain} ← ${beardSuit})`, dark(beardSuit) && !near(beardSuit, BLUE, 30));
  ok(`والوجه لا يتغيّر (${faceBefore} ← ${await settled(192, 120)})`, near(await settled(192, 120), faceBefore, 2));
  const neck = await settled(192, 214);
  ok(`والرقبة تحت اللحية جلدٌ باقٍ (${neck})`, skin(neck));
  if (shotsDir) await page.shot(join(shotsDir, 'face-chin.png'));

  // خطّ «رمّم» على الذقن من الوجه: تحت اللحية لا عند ١٩٤.
  await click('[data-suit="none"]');
  await wait(400);
  await click('[data-tool="repair"]');
  await wait(300);
  const lineAt = await page.eval(`
    const line = document.querySelector('[data-repair-line]');
    const c = document.querySelector('[data-photo-canvas]');
    if (!line || !c) return null;
    const box = JSON.parse(c.dataset.box);
    return Math.round(((parseFloat(line.style.top) - box.top) * 384) / box.height);`);
  ok(`وخطّ «رمّم» تحت اللحية — الصفّ ${lineAt} (كان ١٩٤)`, lineAt !== null && lineAt >= 201 && lineAt <= 210);
  return steps.join('\n');
}
