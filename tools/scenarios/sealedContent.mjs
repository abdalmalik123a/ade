/** S49، D209: ملفات الأقسام من أزرار المكتبة، وختمها واستيرادها والتفعيل والتوافق. بيانات مصنوعة فقط. */
import { generateKeyPairSync, createHash, sign } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { unzipSync } from 'fflate';
import { writeSealedPack } from '../keytool/core.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DIR = join(process.env.TEMP ?? '.', `diwan-sealed-content-${Date.now()}`);
const OPEN = join(DIR, 'open.diwanseal');
const owner = generateKeyPairSync('ed25519'), stranger = generateKeyPairSync('ed25519');
const sections = { templates: 'المعاملات', clips: 'الكليشات', letterheads: 'الترويسات' };

export function prepare() {
  mkdirSync(DIR, { recursive: true });
  return {
    DIWAN_TEST_SAVE_DIR: DIR, DIWAN_TEST_OPEN_FILE: OPEN, DIWAN_TEST_MACHINE_ID: 'test-sealed-content',
    DIWAN_TEST_LICENSE_PUBKEY: owner.publicKey.export({ type: 'spki', format: 'pem' }).toString()
  };
}

export default async function scenario(page, { profile }) {
  const steps = [], files = {};
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const db = (fn) => {
    const d = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
    try { return fn(d); } finally { d.close(); }
  };
  const counts = () => db((d) => ['templates', 'letterheads', 'clips'].map((t) => d.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n).join(','));
  const click = (selector) => page.eval(`const b = document.querySelector(${JSON.stringify(selector)}); b?.click(); return Boolean(b);`);
  const importPack = async (path) => {
    copyFileSync(path, OPEN);
    return page.eval(`try { return await window.diwan.content.import(); } catch (e) { return { error: String(e?.message ?? e) }; }`);
  };
  let serial = 0;
  const seal = async (content, kind = 'first', path = files[content], key = owner.privateKey) => {
    const out = join(DIR, `sealed-${++serial}.diwanseal`);
    await writeSealedPack({ items: [{ name: 'قسم مصنوع', path }], content, kind, title: `قسم ${sections[content] ?? 'القاط'} التجريبي`, privateKey: key, out });
    return out;
  };
  const image = readFileSync(join(ROOT, 'tests/fixtures/portrait-generated.png'));
  const logo = `letterheads/${createHash('sha256').update(image).digest('hex').slice(0, 32)}.png`;
  const storedLogo = join(profile, 'data', 'store', logo);
  mkdirSync(dirname(storedLogo), { recursive: true }); writeFileSync(storedLogo, image);
  const ids = await page.eval(`
    const lh = await window.diwan.letterheads.save({ id: null, name: 'مدرسة النور', authorityId: null, category: null,
      layout: { sections: [{ id: 's', weight: 1, blocks: [{ id: 'b', kind: 'image', value: ${JSON.stringify(logo)}, align: 'center', size: 14, bold: false, width: 25 }] }] } });
    const t = await window.diwan.templates.save({ id: null, code: null, title: 'تأييد المدرسة المصنوع', subtitle: null, category: null, subjectLine: null,
      bodyHtml: '<p>معاملة اختبار</p>', letterheadId: lh.id, variables: [] });
    const c = await window.diwan.clips.save({ id: null, title: 'ختام مصنوع', body: 'مع التقدير.', category: null, direction: null });
    return { t: t.id, lh: lh.id, c: c.id };
  `);
  const templateUuid = db((d) => d.prepare('SELECT uuid FROM templates WHERE id=?').get(ids.t).uuid);
  ok('مكتب جديد في التجربة', await page.eval(`return (await window.diwan.license.status()).status === 'trial';`));
  const invalid = await page.eval(`try { await window.diwan.content.exportSection('suits'); return ''; } catch (e) { return String(e.message); }`);
  ok('وحارس القناة يرفض قسمًا غير معروف قبل حوار الحفظ', invalid.includes('واحدٌ من'));
  await page.goto('templates-library-drafts');
  for (const [section, label] of Object.entries(sections)) {
    await page.eval(`
      const s = document.querySelector('[data-content-section]');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, ${JSON.stringify(section)});
      s.dispatchEvent(new Event('change', { bubbles: true })); return true;
    `);
    await click('[data-act="content-export-section"]');
    if (!await page.until(`return !document.querySelector('[data-act="content-export-section"]').disabled && document.body.innerText.includes(${JSON.stringify(`صُدّر قسم «${label}»`)});`, 15000)) throw new Error(`تصدير ${section}`);
    const name = readdirSync(DIR).find((f) => f.startsWith(`diwan-${section}-`) && f.endsWith('.diwanpack'));
    files[section] = name ? join(DIR, name) : '';
    const pkg = files[section] ? JSON.parse(Buffer.from(unzipSync(readFileSync(files[section]))['diwan-content.json']).toString()) : null;
    ok(`وزر «صدّر القسم» يكتب ${label} وحده مع لوازمه`, Boolean(pkg) && (section === 'templates'
      ? pkg.templates.length === 1 && pkg.clips.length === 0 && pkg.letterheads.length === 1
      : section === 'clips' ? pkg.templates.length === 0 && pkg.clips.length === 1 && pkg.letterheads.length === 0
        : pkg.templates.length === 0 && pkg.clips.length === 0 && pkg.letterheads.length === 1));
  }
  await page.eval(`await window.diwan.templates.delete(${ids.t}); await window.diwan.clips.delete(${ids.c}); await window.diwan.letterheads.delete(${ids.lh}); return true;`);
  rmSync(storedLogo);
  ok('وحُذف محتوى الاختبار كي يكون الاستيراد إلى مكتب فارغ', counts() === '0,0,0');

  const wrong = await importPack(await seal('clips', 'first', files.templates));
  ok(`والقسم المخالف لرأسه يُرفض قبل أي صف أو صورة (${wrong.error})`, String(wrong.error).includes('لا يطابق') && counts() === '0,0,0' && !existsSync(storedLogo));
  const foreign = await importPack(await seal('templates', 'first', files.templates, stranger.privateKey));
  ok('والمختوم بمفتاح غريب يُرفض', String(foreign.error).includes('ليست مختومةً من صاحب ديوان') && counts() === '0,0,0');
  const broken = await seal('templates');
  const bytes = readFileSync(broken); bytes[bytes.length - 35] ^= 0x5a; writeFileSync(broken, bytes);
  const tampered = await importPack(broken);
  ok('والمقلوب بعد ختمه يُرفض قبل الكتابة', String(tampered.error).includes('عُبث بالحزمة') && counts() === '0,0,0');
  const png = join(DIR, 'قاط.png'); writeFileSync(png, image);
  const suit = await importPack(await seal('suits', 'first', png));
  ok('وحزمة القاط تقول إن مكانها الصور الشخصية', String(suit.error).includes('استوردها من الصور الشخصية') && counts() === '0,0,0');

  const sealed = {};
  for (const section of Object.keys(sections)) {
    sealed[section] = await seal(section);
    const r = await importPack(sealed[section]);
    ok(`وقسم ${sections[section]} الأول يُستورد في التجربة`, !r.error && r.sealed?.content === section && r.sealed.kind === 'first');
  }
  const restored = db((d) => d.prepare('SELECT id,uuid,letterhead_id AS lh FROM templates').get());
  ok('والمعاملة بمعرّفها وترويستها وصورتها كما صدّرت', counts() === '1,1,1' && restored.uuid === templateUuid && restored.lh > 0 && existsSync(storedLogo) && readFileSync(storedLogo).equals(image));
  await page.eval(`await window.diwan.templates.save({ id: ${restored.id}, code: null, title: 'تعديل المكتب', subtitle: null, category: null, subjectLine: null, bodyHtml: '<p>معاملة اختبار</p>', letterheadId: ${restored.lh}, variables: [] }); return true;`);
  const again = await importPack(sealed.templates);
  ok('وإعادة القسم لا تكرّر ولا تمحو تعديل المكتب', again.added?.templates === 0 && again.existing.templates === 1 && db((d) => d.prepare('SELECT title FROM templates').get().title) === 'تعديل المكتب' && counts() === '1,1,1');

  const plain = await importPack(files.templates);
  ok('وحزمة المحتوى العادية تبقى مقروءة ولو كان امتداد باب الفتح مختومًا', !plain.error && !plain.sealed && plain.existing.templates === 1 && counts() === '1,1,1');

  const buyer = await seal('clips', 'buyer');
  const early = await importPack(buyer);
  ok('وحزمة المشتري قبل التفعيل تُرفض ولا تضيف شيئًا', String(early.error).includes('تُستورد في ديوانٍ مفعّل') && counts() === '1,1,1');
  const device = await page.eval(`return (await window.diwan.license.status()).device;`);
  const payload = { v: 1, device, kind: 'full', issued: '2026-10-28', office: 'مكتب الاختبار' };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const key = `DIWAN-${body}.${sign(null, Buffer.from(body), owner.privateKey).toString('base64url')}`;
  await page.eval(`return window.diwan.license.activate(${JSON.stringify(key)}).then(() => true);`);
  const bought = await importPack(buyer);
  ok('وبعد التفعيل تُقبل حزمة المشتري ويحفظ المكرّر', bought.sealed?.kind === 'buyer' && bought.existing.clips === 1 && counts() === '1,1,1');
  copyFileSync(sealed.templates, OPEN);
  await page.goto('office-settings'); await page.goto('templates-library-drafts');
  await click('[data-act="content-import"]');
  if (!await page.until(`return Boolean(document.querySelector('[data-act="content-import-file"]'));`)) throw new Error('حوار الحزم');
  await click('[data-act="content-import-file"]');
  const said = await page.until(`return document.body.innerText.includes('«قسم المعاملات التجريبي»') && document.body.innerText.includes('موجودٌ في المكتب');`, 15000);
  ok('وزر الاستيراد في المكتبة يعرض عنوان المختوم وما كان موجودًا', said);
  const work = join(profile, 'data', 'seal-work');
  ok('ولا ملفات فكّ مؤقتة بعد النجاح والرفض', !existsSync(work) || readdirSync(work).length === 0);
  rmSync(DIR, { recursive: true, force: true });
  return steps.join('\n');
}
