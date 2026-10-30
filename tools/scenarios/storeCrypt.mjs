/**
 * سيناريو: ديوان يشفّر ملفّات المخزن التي فيها بيانات شخصية (D238، ر190 §٢).
 *
 * ١) مستمسكٌ يُضاف وصورةٌ شخصية تُلصق: على القرص لا يشبهان PNG (مشفّران بمفتاح المكتب)، والواجهة تعرضهما
 *    (بروتوكول `diwan://store` — وهو ما تطبع منه نافذة الطباعة)، وقراءة الظهر (MRZ) تأخذ الصورة مفكوكة، والنسخ إلى الحافظة يعمل.
 *    والشعار في `images` يبقى واضحًا. ونسخةٌ احتياطية بكلمة تُؤخذ.
 * ٢) مكتبٌ آخر بمفتاحٍ آخر (مجلّد البيانات القديم جانبًا): تُسترجع النسخة، فيُرى المستمسك ويُعاد تشفيره بالمفتاح الجديد.
 */
import { existsSync, mkdirSync, readFileSync, renameSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const CARD = resolve('tests/fixtures/card-back-fake.png');
const PASSWORD = 'كلمة مكتب النور';
let BACKUP = '';
let SCAN_REL = '';
let firstKeys = '';

export async function prepare() {
  mkdirSync(process.env.DIWAN_TEST_SAVE_DIR, { recursive: true });
  return {};
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const head = (file) => readFileSync(file).subarray(0, 8);
const dataUrl = `data:image/png;base64,${readFileSync(CARD).toString('base64')}`;

export default async function scenario(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const store = join(profile, 'data', 'store');
  const citizen = await page.eval(`return window.diwan.citizens.save({ id: null, fullName: 'زينب علي حسن', verified: false });`);
  const att = await page.eval(`return window.diwan.attachments.addFromDataUrl(${citizen.id}, 'ظهر البطاقة', ${JSON.stringify(dataUrl)});`);
  SCAN_REL = att.filePath;
  const onDisk = join(store, SCAN_REL);
  ok(`المستمسك على القرص مشفّر لا PNG (${SCAN_REL})`, existsSync(onDisk) && !head(onDisk).subarray(0, 4).equals(PNG_SIGNATURE) && head(onDisk).toString('latin1') === 'DWNSEAL1');
  ok('وسُجّل أنّ بيانات المكتب صارت مشفّرة', existsSync(join(profile, 'data', 'sealed.flag')));

  const served = await page.eval(`return fetch('diwan://store/${SCAN_REL}').then(async (r) => { const b = new Uint8Array(await r.arrayBuffer()); return { status: r.status, type: r.headers.get('content-type'), size: b.length, png: b[0] === 0x89 && b[1] === 0x50 }; });`);
  ok(`والواجهة تعرضه مفكوكًا (${served.status} ${served.type} ${served.size} بايت)`, served.status === 200 && served.png && served.size === readFileSync(CARD).length);
  const mrz = await page.eval(`return window.diwan.attachments.readMrz(${att.id}).then((r) => r.lines.length, (e) => 'خطأ: ' + e.message);`);
  ok(`وقراءة الظهر تأخذ الصورة مفكوكة (أسطرها: ${mrz})`, typeof mrz === 'number' && mrz > 0);
  ok('والنسخ إلى الحافظة يعمل', (await page.eval(`return window.diwan.attachments.copyToClipboard(${att.id});`)) === true);

  const photo = await page.eval(`return window.diwan.photos.storePasted(${JSON.stringify(dataUrl)});`);
  ok('والصورة الشخصية مشفّرةٌ كذلك', head(join(store, photo)).toString('latin1') === 'DWNSEAL1');
  const image = await page.eval(`return window.diwan.files.storeImage(Uint8Array.from(atob(${JSON.stringify(readFileSync(CARD).toString('base64'))}), (c) => c.charCodeAt(0)));`);
  ok(`وصورةٌ في تصميمٍ أو كتاب (${image}) تبقى واضحةً كأصول التصميم`, Boolean(image) && head(join(store, image)).subarray(0, 4).equals(PNG_SIGNATURE));

  const made = await page.eval(`return window.diwan.backup.create(${JSON.stringify(PASSWORD)});`);
  BACKUP = made?.path ?? '';
  ok('ونسخةٌ احتياطية بكلمةٍ أُخذت', Boolean(BACKUP) && existsSync(BACKUP));
  firstKeys = readFileSync(join(profile, 'data', 'keys.json'), 'utf8');
  return steps.join('\n');
}

/** مكتبٌ آخر: مجلّد البيانات القديم جانبًا، فيُنشأ مفتاحٌ آخر في التشغيل التالي. */
export async function betweenRestarts({ profile }) {
  renameSync(join(profile, 'data'), join(profile, 'data-office-one'));
  process.env.DIWAN_TEST_OPEN_FILE = BACKUP;
}

export async function afterRestart(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const keys = readFileSync(join(profile, 'data', 'keys.json'), 'utf8');
  ok('مكتبٌ آخر بمفتاحٍ آخر', keys !== firstKeys);
  // النسخة تُختار من ديوان (بابه DIWAN_TEST_OPEN_FILE) — لا مسارٌ يُعطى من خارجه.
  const picked = await page.eval(`return window.diwan.backup.pick();`);
  const summary = await page.eval(`return window.diwan.backup.inspect(${JSON.stringify(picked?.path ?? '')}, ${JSON.stringify(PASSWORD)});`);
  ok('والنسخة تُفحص بكلمتها', Boolean(summary));
  await page.eval(`return window.diwan.backup.restore(${JSON.stringify(picked?.path ?? '')}, ${JSON.stringify(PASSWORD)}).then(() => true);`);
  await wait(1500);
  const onDisk = join(profile, 'data', 'store', SCAN_REL);
  ok('بعد الاسترجاع: المستمسك على القرص مشفّرٌ بمفتاح هذا المكتب', existsSync(onDisk) && head(onDisk).toString('latin1') === 'DWNSEAL1');
  const served = await page.eval(`return fetch('diwan://store/${SCAN_REL}').then(async (r) => { const b = new Uint8Array(await r.arrayBuffer()); return r.status + ':' + (b[0] === 0x89 && b[1] === 0x50); });`);
  ok(`ويُرى مفكوكًا (${served})`, served === '200:true');
  return steps.join('\n');
}
