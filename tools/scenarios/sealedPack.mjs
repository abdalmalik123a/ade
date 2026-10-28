/**
 * سيناريو: الحزمة المختومة للقاط (S48، ر181 ر182، D205) — شرط نهاية م٩.
 *
 * مفتاح اختبارٍ يقوم مقام مفتاح التحديث (`DIWAN_TEST_LICENSE_PUBKEY`)، وقطعٌ مصنوعة (PNG مفرّغان ومثال PSD بقاطين)، و`keygen seal` يصنع:
 * حزمةً أولى، وحزمة مشترٍ، وحزمةً بمفتاحٍ غريب — ونسخةً من الأولى بايتٌ في قطعتها مقلوب. ثم من الجسر (`photos.importSealed` بباب الفتح):
 * (أ) في التجربة الأولى تُستورد وقطعها في «قاط المكتب» باسم الحزمة، وثانيةً لا تكرار · (ب) حزمة المشتري تُرفض برسالتها ولا يُضاف شيء ·
 * (ج) الغريبة «ليست مختومة» والمقلوبة «عُبث» · (د) بعد التفعيل بمفتاح اختبار حزمة المشتري تُستورد · (هـ) ولا ملفّ مؤقّتٌ باقٍ.
 */
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync, sign } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const KEYGEN = join(ROOT, 'tools', 'license', 'keygen.mjs');
const DIR = join(process.env.TEMP ?? '.', `diwan-seal-${Date.now()}`);
const OPEN = join(DIR, 'open.diwanseal');
const owner = generateKeyPairSync('ed25519');
const stranger = generateKeyPairSync('ed25519');
const pemOf = (k) => k.privateKey.export({ type: 'pkcs8', format: 'pem' });

/** PNG مفرّغ بلا مكتبة: لونٌ في دائرة، وما حولها شفّاف. */
function png(w, h, [r, g, b]) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const inside = (x - w / 2) ** 2 + (y - h / 2) ** 2 < (Math.min(w, h) / 2.2) ** 2;
      raw.set([r, g, b, inside ? 255 : 0], y * (w * 4 + 1) + 1 + x * 4);
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
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const canonical = (p) => JSON.stringify({ v: p.v, device: p.device, kind: p.kind, issued: p.issued, ...(p.office && { office: p.office }) });
const keyFor = (payload) => {
  const body = Buffer.from(canonical(payload), 'utf8').toString('base64url');
  return `DIWAN-${body}.${sign(null, Buffer.from(body, 'utf8'), owner.privateKey).toString('base64url')}`;
};
const seal = (pieces, kind, title, key, out) =>
  execFileSync(process.execPath, [KEYGEN, 'seal', pieces, '--kind', kind, '--title', title, '--key', key, '--out', out], { encoding: 'utf8' });

export async function prepare() {
  rmSync(DIR, { recursive: true, force: true });
  for (const d of ['first', 'buyer', 'mixed']) mkdirSync(join(DIR, d), { recursive: true });
  writeFileSync(join(DIR, 'owner.pem'), pemOf(owner));
  writeFileSync(join(DIR, 'stranger.pem'), pemOf(stranger));
  writeFileSync(join(DIR, 'first', 'قاط رمادي.png'), png(160, 120, [90, 90, 95]));
  copyFileSync(join(ROOT, 'tests', 'fixtures', 'suits-layers.psd'), join(DIR, 'first', 'قاطان.psd'));
  writeFileSync(join(DIR, 'buyer', 'قاط بنّي.png'), png(160, 120, [110, 70, 40]));
  seal(join(DIR, 'first'), 'first', 'قاط تجريبي', join(DIR, 'owner.pem'), join(DIR, 'first.diwanseal'));
  seal(join(DIR, 'buyer'), 'buyer', 'قاط المشتري', join(DIR, 'owner.pem'), join(DIR, 'buyer.diwanseal'));
  seal(join(DIR, 'first'), 'first', 'قاط غريب', join(DIR, 'stranger.pem'), join(DIR, 'stranger.diwanseal'));
  // D207: قطعة سليمة ثم PSD معتمة — تتعذّر وحدها ويكمل الاستيراد مع السبب.
  writeFileSync(join(DIR, 'mixed', 'أ قاط سليم.png'), png(160, 120, [20, 110, 80]));
  const opaque = readFileSync(join(ROOT, 'tests', 'fixtures', 'suits-flat.psd'));
  opaque.fill(255, opaque.length - 100 * 80);
  writeFileSync(join(DIR, 'mixed', 'ي خلفية معتمة.psd'), opaque);
  seal(join(DIR, 'mixed'), 'first', 'حزمة مختلطة', join(DIR, 'owner.pem'), join(DIR, 'mixed.diwanseal'));
  const flipped = readFileSync(join(DIR, 'first.diwanseal'));
  flipped[flipped.length - 16 - 40] ^= 0x5a;
  writeFileSync(join(DIR, 'tampered.diwanseal'), flipped);
  return {
    DIWAN_TEST_OPEN_FILE: OPEN,
    DIWAN_TEST_MACHINE_ID: 'test-machine-guid-seal',
    DIWAN_TEST_LICENSE_PUBKEY: owner.publicKey.export({ type: 'spki', format: 'pem' }).toString()
  };
}

export default async function scenario(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  /** يضع الحزمة في باب الفتح ثم يستوردها من الجسر — ويعيد الناتج أو نصّ الرفض. */
  const importPack = async (name) => {
    copyFileSync(join(DIR, `${name}.diwanseal`), OPEN);
    return page.eval(`try { return await window.diwan.photos.importSealed(); } catch (e) { return { error: String(e?.message ?? e) }; }`);
  };
  const suits = () => page.eval(`return (await window.diwan.photos.suits()).map((s) => s.name + '|' + (s.pack ?? ''));`);

  const status = await page.eval(`return (await window.diwan.license.status()).status;`);
  ok(`ديوانٌ جديد في التجربة (${status})`, status === 'trial');

  // (أ) الأولى في التجربة، ثم لا تكرار.
  const first = await importPack('first');
  const listed = await suits();
  ok(`«حزمةٌ أولى» تُستورد في التجربة: ${first?.added?.length} قاط (${listed.join('، ')})`,
    first?.kind === 'first' && first.added.length === 3 && listed.join('،') === 'قاط رمادي|قاط تجريبي،قاط أسود|قاط تجريبي،قاط كحلي|قاط تجريبي');
  const again = await importPack('first');
  ok(`وثانيةً لا تكرار: أُضيف ${again?.added?.length} وتُخطّي ${again?.skipped}`, again?.added?.length === 0 && again.skipped === 3 && (await suits()).length === 3);

  // (ب) حزمة المشتري قبل التفعيل.
  const early = await importPack('buyer');
  ok(`و«حزمة المشتري» قبل التفعيل تُرفض برسالتها ولا يُضاف شيء (${early?.error})`, String(early?.error).includes('تُستورد في ديوانٍ مفعّل') && (await suits()).length === 3);

  // (ج) الغريبة والمقلوبة.
  const strange = await importPack('stranger');
  ok(`والمختومة بمفتاحٍ غريب تُرفض (${strange?.error})`, String(strange?.error).includes('ليست مختومةً من صاحب ديوان'));
  const broken = await importPack('tampered');
  ok(`وما عُبث به بعد ختمه يُرفض (${broken?.error})`, String(broken?.error).includes('عُبث بالحزمة') && (await suits()).length === 3);

  // (د) التفعيل ثم حزمة المشتري.
  const device = await page.eval(`return (await window.diwan.license.status()).device;`);
  await page.eval(`return window.diwan.license.activate(${JSON.stringify(keyFor({ v: 1, device, kind: 'full', issued: '2026-10-27', office: 'مكتب الاختبار' }))}).then(() => true);`);
  const paid = await page.eval(`return (await window.diwan.license.status()).status;`);
  const bought = await importPack('buyer');
  ok(`وبعد التفعيل (${paid}) تُستورد «حزمة المشتري» (${bought?.title}: ${bought?.added?.map((s) => s.name).join('، ')})`,
    paid === 'activated' && bought?.kind === 'buyer' && bought.added.length === 1 && (await suits()).includes('قاط بنّي|قاط المشتري'));

  // (هـ) لا مؤقّت باقٍ — والقطع في المخزن.
  const work = join(profile, 'data', 'seal-work');
  const left = existsSync(work) ? readdirSync(work) : [];
  ok(`ولا ملفّ مؤقّتٌ باقٍ في مجلّد العمل (${left.length})`, left.length === 0);
  const stored = readdirSync(join(profile, 'data', 'store', 'suits')).filter((f) => f.endsWith('.png')).length;
  ok(`والقطع الأربع PNG في مخزن القاط (${stored})`, stored === 4);

  const mixed = await importPack('mixed');
  ok(`وقطعةٌ معتمة لا توقف الحزمة: أُضيف ${mixed?.added?.length} وتعذّر ${mixed?.failed} (${mixed?.reason})`,
    mixed?.added?.length === 1 && mixed.failed === 1 && mixed.skipped === 0 &&
    mixed.added[0].name === 'أ قاط سليم' && String(mixed.reason).includes('احفظه بخلفيةٍ شفّافة') && (await suits()).length === 5);
  await page.goto('passport-photos');
  // أدوات القاط تظهر بعد فتح صورة؛ صورة الاختبار مصنوعة ولا بيانات شخصية فيها.
  const image = readFileSync(join(ROOT, 'tests', 'fixtures', 'portrait-generated.png')).toString('base64');
  await page.eval(`
    const bytes = Uint8Array.from(atob(${JSON.stringify(image)}), (c) => c.charCodeAt(0));
    const dt = new DataTransfer(); dt.items.add(new File([bytes], 'test.png', { type: 'image/png' }));
    document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    return true;
  `);
  if (!await page.until(`return Boolean(document.querySelector('[data-act="import-sealed"]'));`, 15000)) throw new Error('لم تظهر أدوات القاط');
  await page.eval(`document.querySelector('[data-act="import-sealed"]').click(); return true;`);
  let say = '';
  for (let i = 0; i < 40; i++) {
    say = await page.text();
    if (say.includes('وتعذّر ١:')) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  ok('وفي الشاشة تُقال القطعة المتعذّرة وسببها، وما كان في القاط يُتخطّى',
    say.includes('وتعذّر ١:') && say.includes('ي خلفية معتمة') && say.includes('احفظه بخلفيةٍ شفّافة') && say.includes('وتُخطّي ١'));
  const cleaned = existsSync(work) ? readdirSync(work) : [];
  ok('ومجلّد العمل يُنظَّف أيضًا بعد قطعةٍ متعذّرة', cleaned.length === 0);

  rmSync(DIR, { recursive: true, force: true });
  return steps.join('\n');
}
