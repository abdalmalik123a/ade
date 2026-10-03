/**
 * سيناريو: «أداة مفاتيح ديوان» (tools/keytool) كما يستعملها المالك — على مجلّدٍ مؤقّت بمفتاح اختبار، لا على
 * مجلّده الحقيقي أبدًا (DIWAN_OWNER_DIR).
 *
 * أوّل فتح: كلمة سرٍّ تُنشأ فيُشفَّر المفتاح ويُمحى غير المشفّر. ثم «مفتاح جديد»: رمز الجهاز والخطّة و«ولّد»،
 * والمفتاح يتحقّق بالمفتاح العامّ؛ وأوّل عشرة مدى الحياة يُعدّون؛ والشهري إلى يومه؛ والسجلّ يُبحث فيه؛ وملفّ
 * التحديث يُصنع موقّعًا؛ وكلمة السرّ تتغيّر؛ والقفل يدويًّا وبعد الخمول؛ والمحاولات الخاطئة تُبطئ.
 */
import { generateKeyPairSync, verify } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const appDir = 'tools/keytool';

const DIR = join(process.env.TEMP ?? '.', `diwan-keytool-${Date.now()}`);
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const DEVICE = 'DWN-1234-5678-9ABC-DEFG';
const PASSWORD = 'test-pass-12345';
const NEW_PASSWORD = 'test-pass-67890';
const IDLE_MS = 12_000;

export async function prepare() {
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
  writeFileSync(join(DIR, 'diwan-owner-private.pem'), privateKey.export({ type: 'pkcs8', format: 'pem' }));
  writeFileSync(join(DIR, 'setup.exe'), Buffer.alloc(300_000, 7));
  return { DIWAN_OWNER_DIR: DIR, DIWAN_KEYTOOL_IDLE_MS: String(IDLE_MS) };
}

/** المفتاح كما يقرؤه البرنامج: الحمولة، وتوقيعها بالمفتاح العامّ. */
function readKey(key) {
  const [body, sig] = key.slice('DIWAN-'.length).split('.');
  const good = verify(null, Buffer.from(body, 'utf8'), publicKey, Buffer.from(sig, 'base64url'));
  return good ? JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) : null;
}

export default async function scenario(page, { shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const visible = (screen) => page.eval(`return !document.querySelector('[data-screen="${screen}"]').classList.contains('hidden');`);
  const text = (sel) => page.eval(`return document.querySelector(${JSON.stringify(sel)})?.innerText ?? '';`);
  const setVal = (id, v) =>
    page.eval(`const el = document.getElementById(${JSON.stringify(id)}); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); return true;`);
  const click = async (id, ms = 600) => {
    await page.eval(`document.getElementById(${JSON.stringify(id)}).click(); return true;`);
    await wait(ms);
  };
  const plan = (v) => page.eval(`const r = document.querySelector('input[name=plan][value=${v}]'); r.checked = true; r.dispatchEvent(new Event('change')); return true;`);
  const shot = (name) => shotsDir && page.shot(join(shotsDir, `keytool-${name}.png`));

  // ── أوّل فتح ──────────────────────────────────────────────────────
  await wait(500);
  ok('أوّل فتحٍ والمفتاح غير مشفّر: «أنشئ كلمة سرّ» ومعها تحذير النسيان', (await visible('create')) && (await text('[data-screen="create"]')).includes('فقد المفتاح نهائيًّا'));
  ok('ومجلّد المالك هو المؤقّت لا الحقيقي', (await text('#dir')) === DIR);
  await shot('1-create');
  await setVal('newPw', 'short');
  await setVal('newPw2', 'short');
  await click('createBtn');
  ok('كلمةٌ قصيرة تُرفض بسببها', (await text('#createMsg')).includes('ثمانية أحرف'));
  await setVal('newPw', PASSWORD);
  await setVal('newPw2', PASSWORD + 'x');
  await click('createBtn');
  ok('وكلمتان مختلفتان تُرفضان', (await text('#createMsg')).includes('لا تتطابقان'));
  ok('ولم يُمسّ المفتاح بعد', existsSync(join(DIR, 'diwan-owner-private.pem')) && !existsSync(join(DIR, 'diwan-owner-private.key')));
  await setVal('newPw2', PASSWORD);
  await click('createBtn', 2500);
  ok('فإذا تطابقتا: شُفّر المفتاح وفُتحت الأداة', await visible('app'));
  ok('وغير المشفّر مُحي، والمشفّر وحده في المجلّد', !existsSync(join(DIR, 'diwan-owner-private.pem')) && readFileSync(join(DIR, 'diwan-owner-private.key'), 'utf8').includes('BEGIN DIWAN ENCRYPTED KEY'));
  ok('ومفتاح الاختبار لا يطابق مفتاح البرنامج — فيُنبَّه', (await text('[data-match]')).includes('لا يطابق'));
  ok('والعدّاد: التالي رقم ١ من أوّل ١٠', (await text('[data-counter]')).includes('التالي رقم ١ من أوّل ١٠'));

  // ── مفتاح مدى الحياة ──────────────────────────────────────────────
  await setVal('device', 'DWN-1234');
  await page.eval(`document.getElementById('device').dispatchEvent(new Event('blur')); return true;`);
  await wait(300);
  ok('رمز جهازٍ ناقص يُقال عند الخروج من خانته', (await text('#deviceMsg')).includes('ستّة عشر'));
  await click('issueBtn');
  ok('و«ولّد» به يُرفض ولا يُكتب شيء', (await text('[data-issue-msg]')).includes('ستّة عشر') && !existsSync(join(DIR, 'سجل المفاتيح المصدرة.csv')));
  await setVal('device', 'dwn 1234 5678 9abc defg');
  await page.eval(`document.getElementById('device').dispatchEvent(new Event('blur')); return true;`);
  await wait(300);
  ok('ورمزٌ بحروفٍ صغيرة ومسافات يُسوّى', (await page.eval(`return document.getElementById('device').value;`)) === DEVICE);
  await setVal('office', 'مكتب النور');
  await setVal('phone', '07701234567');
  await setVal('price', '150000');
  await click('issueBtn');
  const key1 = await text('[data-result-key]');
  const p1 = readKey(key1);
  ok(`«ولّد»: مفتاحٌ موقّعٌ مدى الحياة لذلك الجهاز (${p1?.kind})`, p1?.kind === 'full' && p1.device === DEVICE && p1.office === 'مكتب النور');
  ok('ويُقال: المشتري رقم ١ من أوّل ١٠', (await text('#resultTitle')).includes('المشتري رقم ١ من أوّل ١٠'));
  ok('وتُفرَّغ الخانات فلا يُصدر مرّتين بضغطةٍ ثانية', (await page.eval(`return document.getElementById('device').value + document.getElementById('office').value;`)) === '');
  await shot('2-lifetime');
  await click('copyMsg', 300);
  ok('ونسخ رسالة واتساب يُقال', (await text('#copied')).includes('نُسخ'));

  // ── الشهري ────────────────────────────────────────────────────────
  await plan('monthly');
  await wait(300);
  await setVal('start', '2027-01-31');
  await wait(400);
  ok('الشهري: يومه الأخير يُحسب من البدء (٣١ كانون الثاني ← ٢٨ شباط)', (await page.eval(`return document.getElementById('until').value;`)) === '2027-02-28');
  await setVal('device', DEVICE);
  await setVal('office', 'مكتب الفرات');
  await click('issueBtn');
  const p2 = readKey(await text('[data-result-key]'));
  ok('ويصدر اشتراكًا شهريًّا إلى ذلك اليوم', p2?.kind === 'sub' && p2.plan === 'monthly' && p2.until === '2027-02-28');
  ok('ويُقال في العنوان', (await text('#resultTitle')).includes('اشتراك شهري حتى 2027-02-28'));

  // ── التمديد ───────────────────────────────────────────────────────
  await plan('extend');
  await setVal('device', DEVICE);
  await click('issueBtn');
  ok('تمديدٌ بلا يومٍ يُرفض', (await text('[data-issue-msg]')).includes('آخر يوم'));
  await setVal('extUntil', '2026-11-30');
  await click('issueBtn');
  ok('وبيومه يصدر', readKey(await text('[data-result-key]'))?.until === '2026-11-30');

  // ── أوّل عشرة ─────────────────────────────────────────────────────
  for (let i = 2; i <= 10; i++) await page.eval(`await window.keytool.issue({ device: '${DEVICE}', plan: 'lifetime', office: 'مكتب ${i}' }); return true;`);
  await plan('lifetime');
  await setVal('device', DEVICE);
  await setVal('office', 'مكتب الحادي عشر');
  await click('issueBtn');
  const title11 = await text('#resultTitle');
  ok('الحادي عشر مدى الحياة: رقمه ١١ بلا «من أوّل ١٠»', title11.includes('رقم ١١') && !title11.includes('من أوّل'));
  ok('والعدّاد: أوّل ١٠ اكتملوا', (await text('[data-counter]')).includes('أوّل ١٠ اكتملوا'));
  const csv = readFileSync(join(DIR, 'سجل المفاتيح المصدرة.csv'), 'utf8');
  const lines = csv.split('\r\n').filter(Boolean);
  ok(`والسجلّ: ${lines.length - 1} مفتاحًا، العاشر «من أوّل 10» والحادي عشر بلا`, lines.length === 14 && lines[12].includes('من أوّل 10') && !lines[13].includes('من أوّل'));
  ok('وفيه السعر والهاتف', lines[1].includes('"150000"') && lines[1].includes('"07701234567"'));

  // ── السجلّ ───────────────────────────────────────────────────────
  await page.eval(`document.querySelector('[data-tab="ledger"]').click(); return true;`);
  await wait(600);
  ok('لسان «السجلّ»: كلّ المفاتيح، الأحدث أوّلًا', (await page.eval(`return document.querySelectorAll('[data-ledger] tr').length;`)) === 13 && (await text('[data-ledger] tr')).includes('مكتب الحادي عشر'));
  await setVal('ledgerQ', 'الفرات');
  ok('والبحث يُضيّقه', (await page.eval(`return document.querySelectorAll('[data-ledger] tr').length;`)) === 1 && (await text('[data-ledger]')).includes('شهري'));
  await setVal('ledgerQ', '');
  await shot('3-ledger');

  // ── ملفّ التحديث ──────────────────────────────────────────────────
  const upd = await page.eval(
    `return await window.keytool.makeUpdate({ exe: ${JSON.stringify(join(DIR, 'setup.exe'))}, version: '1.0.1', notes: 'إصلاحات' });`
  );
  const file = upd.ok ? readFileSync(upd.value.out) : null;
  let manifestOk = false;
  if (file) {
    const nameLen = file.readUInt16LE(26);
    const len = file.readUInt32LE(18);
    const json = JSON.parse(file.subarray(30 + nameLen, 30 + nameLen + len).toString('utf8'));
    const m = json.manifest;
    const canon = JSON.stringify({ app: m.app, kind: m.kind, version: m.version, sha256: m.sha256, size: m.size, notes: m.notes, issued: m.issued });
    manifestOk = m.version === '1.0.1' && m.size === 300_000 && verify(null, Buffer.from(canon, 'utf8'), publicKey, Buffer.from(json.signature, 'base64url'));
  }
  ok('ملفّ التحديث يُصنع بجانب المثبّت، موقّعًا بالمفتاح', manifestOk && file.length > 300_000);
  const badUpd = await page.eval(`return await window.keytool.makeUpdate({ exe: ${JSON.stringify(join(DIR, 'setup.exe'))}, version: '1.1', notes: 'x' });`);
  ok('ورقم إصدارٍ ناقص يُرفض', !badUpd.ok && badUpd.error.includes('1.1.0'));

  // ── كلمة السرّ ────────────────────────────────────────────────────
  await page.eval(`document.querySelector('[data-tab="password"]').click(); return true;`);
  await setVal('oldPw', 'wrong-pass-000');
  await setVal('chPw', NEW_PASSWORD);
  await setVal('chPw2', NEW_PASSWORD);
  await click('changeBtn', 2500);
  ok('تغيير الكلمة بقديمةٍ خاطئة يُرفض', (await text('#changeMsg')).includes('خاطئة'));
  await setVal('oldPw', PASSWORD);
  await click('changeBtn', 3500);
  ok('وبالصحيحة تتغيّر', (await text('#changeMsg')).includes('تغيّرت'));

  await click('lockBtn', 400);
  ok('«قفل» يعيد شاشة الكلمة', await visible('login'));
  const locked = await page.eval(`return await window.keytool.issue({ device: '${DEVICE}', plan: 'lifetime' });`);
  ok('والأداة المقفلة لا تُصدر مفتاحًا ولو طُلب من خلف الواجهة', !locked.ok && locked.error.includes('مقفلة'));
  await setVal('pw', PASSWORD);
  await click('unlockBtn', 2000);
  ok('والكلمة القديمة لم تعد تفتح', (await text('[data-login-msg]')).includes('خاطئة') && (await visible('login')));
  await setVal('pw', NEW_PASSWORD);
  await click('unlockBtn', 2000);
  ok('والجديدة تفتح', await visible('app'));
  await shot('4-app');

  // ── الخمول ───────────────────────────────────────────────────────
  await wait(IDLE_MS + 1500);
  ok('وبعد الخمول تُقفل وحدها وتقول لماذا', (await visible('login')) && (await text('[data-login-msg]')).includes('بلا عمل'));

  // ── المحاولات الخاطئة ─────────────────────────────────────────────
  for (let i = 0; i < 5; i++) {
    await setVal('pw', `wrong-${i}-12345`);
    await click('unlockBtn', 1500);
  }
  await setVal('pw', NEW_PASSWORD);
  await click('unlockBtn', 800);
  ok('وبعد خمس خاطئة لا تُقبل حتى الصحيحة لحظاتٍ', (await text('[data-login-msg]')).includes('انتظر') && (await visible('login')));

  rmSync(DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  return steps.join('\n');
}
