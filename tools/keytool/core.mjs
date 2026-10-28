/**
 * قلب أداة المفاتيح — للأداة المكتبية (main.mjs) ولسطر الأوامر (tools/license/keygen.mjs) معًا، فلا يختلفان.
 * بلا تبعيّات: وحدات Node وحدها.
 *
 * - **المفتاح الخاص مشفّرٌ بكلمة سرّ المالك** (قرار المالك ٣ تشرين الأول ٢٠٢٦): scrypt (N = ٢^١٧) ثم AES-256-GCM،
 *   في ملفٍّ نصّيٍّ (`diwan-owner-private.key`) — فالفلاشة أو Google Drive إن تسرّبا لا يُصدَر بهما مفتاح.
 *   ومن نسي الكلمة فقد المفتاح: لا بابَ خلفيّ.
 * - **المفتاح الذي يصدر** بصيغة البرنامج نفسها (src/main/services/license.ts): الحقول بترتيبٍ ثابت، وتوقيع Ed25519.
 * - **السجلّ** (`سجل المفاتيح المصدرة.csv`) سطرٌ لكلّ مفتاح، ويُعدّ منه مشترو مدى الحياة — أوّل عشرة.
 * - **ملفّ التحديث «أ+»** أرشيفٌ يقرؤه البرنامج: `update.json` الموقّع، والمثبّت كما هو.
 * - **مفتاح التحديث** (البند ٣٣): مفتاحٌ ثانٍ يصنعه المالك مرّةً بالأداة، مشفّرًا بكلمته نفسها — به تُوقَّع ملفّات التحديث،
 *   فلا يصلح مفتاح التراخيص لتحديثٍ ولا مفتاح التحديث لترخيص في الإصدارات التي تعرفه.
 * - **الحزمة المختومة** (S48، D203): قطعٌ تُختم بمفتاح التحديث وتُشفَّر فلا يقبل ديوان غيرها ولا تُفتح في غيره —
 *   والصيغة في `src/shared/sealedPack.ts` (والقارئ `src/main/services/sealedPack.ts`) بالقواعد نفسها نصًّا.
 */
import { createCipheriv, createDecipheriv, createHash, createPrivateKey, createPublicKey, generateKeyPairSync, hkdfSync, randomBytes, scryptSync, sign } from 'node:crypto';
import { appendFileSync, createReadStream, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync, writeSync, closeSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { crc32 } from 'node:zlib';

export const KEY_FILE = 'diwan-owner-private.key';
export const PLAIN_KEY_FILE = 'diwan-owner-private.pem';
export const LEDGER_FILE = 'سجل المفاتيح المصدرة.csv';
export const TEXT_COPY_FILE = '٢ - المفتاح الخاص (نسخة نصية).txt';
export const UPDATE_KEY_FILE = 'diwan-update-private.key';
export const UPDATE_TEXT_COPY_FILE = '٧ - مفتاح التحديث الخاص (نسخة نصية).txt';
export const UPDATE_PUBLIC_FILE = '٨ - مفتاح التحديث العام.txt';
export const EARLY_LIFETIME = 10;

const SCRYPT = { N: 1 << 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const BEGIN = '-----BEGIN DIWAN ENCRYPTED KEY-----';
const END = '-----END DIWAN ENCRYPTED KEY-----';

export class KeyToolError extends Error {}

// ── رمز الجهاز ─────────────────────────────────────────────────────────

/** كما في البرنامج: Crockford، وO صفر، وI وL واحد — ستّة عشر حرفًا بعد DWN. */
export function normalizeDevice(code) {
  const body = String(code ?? '')
    .toUpperCase()
    .replace(/^\s*DWN/, '')
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  if (body.length !== 16) throw new KeyToolError('رمز الجهاز ستّة عشر حرفًا بعد DWN — انسخه من شاشة «التفعيل» في البرنامج كما هو');
  return `DWN-${body.match(/.{4}/g).join('-')}`;
}

// ── المفتاح الخاص ──────────────────────────────────────────────────────

export function keyState(dir) {
  return { encrypted: existsSync(join(dir, KEY_FILE)), plain: existsSync(join(dir, PLAIN_KEY_FILE)), update: existsSync(join(dir, UPDATE_KEY_FILE)) };
}

function seal(text, password) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(password.normalize('NFC'), salt, 32, SCRYPT);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const body = { v: 1, kdf: 'scrypt', N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, salt: salt.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
  const b64 = Buffer.from(JSON.stringify(body)).toString('base64').match(/.{1,64}/g).join('\n');
  return `${BEGIN}\n${b64}\n${END}\n`;
}

function unseal(armored, password) {
  const b64 = armored.slice(armored.indexOf(BEGIN) + BEGIN.length, armored.indexOf(END)).replace(/\s+/g, '');
  let body;
  try {
    body = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  } catch {
    throw new KeyToolError('ملف المفتاح معطوب');
  }
  const key = scryptSync(String(password).normalize('NFC'), Buffer.from(body.salt, 'base64'), 32, { N: body.N, r: body.r, p: body.p, maxmem: SCRYPT.maxmem });
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(body.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(body.tag, 'base64'));
  try {
    return Buffer.concat([decipher.update(Buffer.from(body.data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    throw new KeyToolError('كلمة السرّ خاطئة');
  }
}

/** المفتاح الخاص في الذاكرة: من الملف المشفّر بكلمته، أو من القديم غير المشفّر. */
export function loadPrivateKey(dir, password) {
  const enc = join(dir, KEY_FILE);
  if (existsSync(enc)) {
    if (!password) throw new KeyToolError('المفتاح مشفّر — اكتب كلمة السرّ');
    return createPrivateKey(unseal(readFileSync(enc, 'utf8'), password));
  }
  const plain = join(dir, PLAIN_KEY_FILE);
  if (existsSync(plain)) return createPrivateKey(readFileSync(plain, 'utf8'));
  throw new KeyToolError(`لا مفتاح خاصّ في ${dir}`);
}

/** يُحمَّل مفتاحٌ خاصّ من ملفّ PEM بعينه (للاختبار و`--key`). */
export function loadPrivateKeyFile(path) {
  if (!existsSync(path)) throw new KeyToolError(`لا مفتاح خاصّ في ${path}`);
  return createPrivateKey(readFileSync(path, 'utf8'));
}

export function publicKeyPem(privateKey) {
  return createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString().trim();
}

/**
 * يشفّر المفتاح القديم بكلمة المالك — أوّل فتحٍ للأداة: يُكتب المشفّر ويُتحقّق أنّه يُفكّ بالكلمة نفسها إلى المفتاح
 * نفسه، ثم يُمحى غير المشفّر، وتصير النسخة النصّية نصّ المشفّر.
 */
export function encryptExistingKey(dir, password) {
  if (String(password).length < 8) throw new KeyToolError('كلمة السرّ ثمانية أحرفٍ أقلّها');
  const plain = join(dir, PLAIN_KEY_FILE);
  if (!existsSync(plain)) throw new KeyToolError('لا مفتاح غير مشفّرٍ ليُشفَّر');
  const pem = readFileSync(plain, 'utf8');
  const armored = seal(pem, password);
  const before = publicKeyPem(createPrivateKey(pem));
  if (publicKeyPem(createPrivateKey(unseal(armored, password))) !== before) throw new KeyToolError('تعذّر التحقّق من التشفير — لم يُمسّ شيء');
  const enc = join(dir, KEY_FILE);
  writeFileSync(`${enc}.part`, armored);
  renameSync(`${enc}.part`, enc);
  if (publicKeyPem(loadPrivateKey(dir, password)) !== before) throw new KeyToolError('تعذّر التحقّق من الملف المشفّر — لم يُمحَ القديم');
  writeTextCopy(dir, armored);
  rmSync(plain);
  return before;
}

/**
 * تغيير كلمة السرّ: يُفكّ بالقديمة ويُشفَّر بالجديدة، ويُتحقّق قبل أن يُستبدل — **والمفتاحان معًا** (التراخيص والتحديث)،
 * فلا يبقى للمالك كلمتان. ويُفكّ الاثنان ويُتحقّق منهما قبل أن يُكتب أيٌّ منهما.
 */
export function changePassword(dir, oldPassword, newPassword) {
  if (String(newPassword).length < 8) throw new KeyToolError('كلمة السرّ ثمانية أحرفٍ أقلّها');
  const files = [KEY_FILE, UPDATE_KEY_FILE].map((f) => join(dir, f)).filter((f) => existsSync(f));
  const resealed = files.map((enc) => {
    const pem = unseal(readFileSync(enc, 'utf8'), oldPassword);
    const armored = seal(pem, newPassword);
    if (publicKeyPem(createPrivateKey(unseal(armored, newPassword))) !== publicKeyPem(createPrivateKey(pem))) throw new KeyToolError('تعذّر التحقّق — لم يُمسّ شيء');
    return { enc, armored };
  });
  for (const { enc, armored } of resealed) {
    writeFileSync(`${enc}.part`, armored);
    renameSync(`${enc}.part`, enc);
    if (enc.endsWith(UPDATE_KEY_FILE)) writeUpdateTextCopy(dir, armored);
    else writeTextCopy(dir, armored);
  }
}

const textCopy = (title, keyFile, armored) =>
  [
    title,
    'لا يُفكّ بغير الكلمة، فتسرّبه لا يُصدر مفتاحًا. ومن نسي الكلمة فقده: احفظها مكتوبةً بعيدًا عن الفلاشة.',
    `إن ضاع ملف ${keyFile} فانسخ الأسطر بين الخطّين — ومعها سطرا BEGIN وEND — إلى ملفٍّ بذلك الاسم.`,
    '------------------------------------------------------------',
    armored.trim(),
    '------------------------------------------------------------'
  ].join('\r\n');

function writeTextCopy(dir, armored) {
  const text = textCopy('المفتاح الخاص لديوان — مشفّرٌ بكلمة سرّ المالك (scrypt + AES-256-GCM).', KEY_FILE, armored);
  writeFileSync(join(dir, TEXT_COPY_FILE), Buffer.from('﻿' + text + '\r\n', 'utf8'));
}

function writeUpdateTextCopy(dir, armored) {
  const text = textCopy('مفتاح التحديث الخاص لديوان — به تُوقَّع ملفّات التحديث، مشفّرٌ بكلمة سرّ المالك نفسها.', UPDATE_KEY_FILE, armored);
  writeFileSync(join(dir, UPDATE_TEXT_COPY_FILE), Buffer.from('﻿' + text + '\r\n', 'utf8'));
}

// ── مفتاح التحديث (البند ٣٣) ───────────────────────────────────────────

/**
 * يصنع مفتاح التحديث **مرّةً**: بكلمة المالك نفسها (يُفكّ بها مفتاح التراخيص أوّلًا — فهي كلمته)، ويُتحقّق أنّه يُفكّ
 * إلى المفتاح نفسه قبل أن يُكتب، ولا يُكتب فوق مفتاحٍ قائم أبدًا. ويُكتب بجانبه عامُّه نصًّا — ليس سرًّا: يُرسل إلى
 * المطوّر فيضعه في البرنامج.
 */
export function createUpdateKey(dir, password) {
  const enc = join(dir, UPDATE_KEY_FILE);
  if (existsSync(enc)) throw new KeyToolError('مفتاح التحديث موجودٌ قبلُ — لا يُصنع ثانيةً');
  if (!existsSync(join(dir, KEY_FILE))) throw new KeyToolError('شفّر مفتاح التراخيص بكلمة السرّ أوّلًا');
  const license = loadPrivateKey(dir, password);
  const { privateKey } = generateKeyPairSync('ed25519');
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const pub = publicKeyPem(privateKey);
  if (pub === publicKeyPem(license)) throw new KeyToolError('تعذّر صنع مفتاحٍ مختلف — لم يُكتب شيء');
  const armored = seal(pem, password);
  if (publicKeyPem(createPrivateKey(unseal(armored, password))) !== pub) throw new KeyToolError('تعذّر التحقّق من التشفير — لم يُكتب شيء');
  writeFileSync(`${enc}.part`, armored, { flag: 'wx' });
  renameSync(`${enc}.part`, enc);
  if (publicKeyPem(loadUpdateKey(dir, password)) !== pub) throw new KeyToolError('تعذّر التحقّق من ملف مفتاح التحديث');
  writeUpdateTextCopy(dir, armored);
  const note = [
    'مفتاح التحديث العامّ لديوان — ليس سرًّا.',
    'أرسل الأسطر بين الخطّين (ومعها BEGIN وEND) إلى المطوّر ليضعها في البرنامج: بها يقبل البرنامج ملفّات التحديث.',
    '------------------------------------------------------------',
    pub,
    '------------------------------------------------------------'
  ].join('\r\n');
  writeFileSync(join(dir, UPDATE_PUBLIC_FILE), Buffer.from('﻿' + note + '\r\n', 'utf8'));
  return pub;
}

/** مفتاح التحديث في الذاكرة — بكلمة المالك. */
export function loadUpdateKey(dir, password) {
  const enc = join(dir, UPDATE_KEY_FILE);
  if (!existsSync(enc)) throw new KeyToolError('لا مفتاح تحديثٍ بعد — اصنعه من «مفتاح التحديث»');
  if (!password) throw new KeyToolError('المفتاح مشفّر — اكتب كلمة السرّ');
  return createPrivateKey(unseal(readFileSync(enc, 'utf8'), password));
}

// ── المفتاح الذي يصدر ──────────────────────────────────────────────────

/** بترتيب البرنامج نفسه — ما يُوقَّع هو ما يتحقّق منه حرفًا بحرف. */
export function canonical(p) {
  const o = { v: p.v, device: p.device, kind: p.kind, issued: p.issued };
  if (p.plan) o.plan = p.plan;
  if (p.until) o.until = p.until;
  if (p.office) o.office = p.office;
  return JSON.stringify(o);
}

export function signKey(payload, privateKey) {
  const body = Buffer.from(canonical(payload), 'utf8').toString('base64url');
  return `DIWAN-${body}.${sign(null, Buffer.from(body, 'utf8'), privateKey).toString('base64url')}`;
}

export const today = () => new Date().toLocaleDateString('en-CA');

/** آخر يومٍ في الاشتراك من يوم بدئه: الشهري إلى اليوم الذي قبله من الشهر التالي، والسنوي من السنة التالية. */
export function subscriptionUntil(plan, start) {
  const [y, m, d] = start.split('-').map(Number);
  const end = plan === 'yearly' ? new Date(Date.UTC(y + 1, m - 1, d)) : new Date(Date.UTC(y, m, d));
  // ٣١ كانون الثاني + شهر: يُقصّ إلى آخر شباط لا يقفز إلى آذار.
  if (plan === 'monthly' && end.getUTCDate() !== d) end.setUTCDate(0);
  else if (plan === 'yearly' && end.getUTCDate() !== d) end.setUTCDate(0);
  else end.setUTCDate(end.getUTCDate() - 1);
  return end.toISOString().slice(0, 10);
}

const KIND_LABEL = { full: 'كامل', sub: 'اشتراك', extend: 'تمديد' };
/**
 * مفتاح العرض (و٩): مدى الحياة موقَّعٌ كالمعتاد — لجهاز المالك يعرض به البرنامج — ويُقيَّد في السجلّ بهذا النوع، فلا يزيد
 * `countLifetime` ولا يأخذ مكان مشترٍ من «أوّل ١٠». **صيغة المفتاح الموقَّع واحدة** (`kind: 'full'`): البرنامج لا يفرّق.
 */
export const DEMO_KIND = 'عرض';
const PLAN_LABEL = { lifetime: 'مدى الحياة', demo: 'عرض (مدى الحياة)', monthly: 'شهري', yearly: 'سنوي', extend: 'تمديد تجريبي' };

/** آخر عشرة أرقامٍ من الهاتف — فـ«07701234567» و«+9647701234567» واحد. */
const phoneKey = (p) => String(p ?? '').replace(/\D/g, '').slice(-10);

/**
 * ما صدر قبلُ لهذا الجهاز أو المكتب أو الهاتف (و٩) — تنبيهٌ لا منع: مفتاحٌ ثانٍ لجهازٍ واحد أو مكتبٍ اشترى قبلُ
 * يُرى قبل أن يُرسل، لا بعد أن يُعدّ مشتريًا جديدًا.
 */
export function repeatsOf(dir, { device, office, phone }) {
  const rows = readLedger(dir);
  const out = [];
  const say = (match, what) => {
    const found = rows.filter(match);
    if (!found.length) return;
    const last = found[found.length - 1];
    out.push(`${what} صدر له ${found.length === 1 ? 'مفتاحٌ' : `${found.length} مفاتيح`} قبلُ — آخرها «${last.plan || last.kind}» يوم ${last.date}`);
  };
  say((r) => r.device === device, `هذا الجهاز (${device})`);
  const name = String(office ?? '').trim();
  if (name) say((r) => String(r.office ?? '').trim() === name, `المكتب «${name}»`);
  const tel = phoneKey(phone);
  if (tel.length >= 7) say((r) => phoneKey(r.phone) === tel, `الهاتف ${String(phone).trim()}`);
  return out;
}

/**
 * يُصدر مفتاحًا ويكتبه في السجلّ. `plan`: lifetime أو demo أو monthly أو yearly أو extend. ويعيد المفتاح ورقم المشتري
 * (لمدى الحياة) ورسالةً جاهزةً للزبون، وتنبيهات ما صدر قبلُ للجهاز أو المكتب أو الهاتف.
 */
export function issue(dir, privateKey, input, opts = {}) {
  const device = normalizeDevice(input.device);
  const plan = input.plan;
  const issued = input.issued ?? today();
  const office = String(input.office ?? '').trim() || undefined;
  let payload;
  // والعرض مدى الحياة نفسه موقَّعًا — يختلف في السجلّ وحده.
  if (plan === 'lifetime' || plan === 'demo') payload = { v: 1, device, kind: 'full', issued, office };
  else if (plan === 'monthly' || plan === 'yearly') {
    const until = input.until || subscriptionUntil(plan, input.start || issued);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) throw new KeyToolError('يوم انتهاء الاشتراك YYYY-MM-DD');
    payload = { v: 1, device, kind: 'sub', issued, plan, until, office };
  } else if (plan === 'extend') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.until ?? '')) throw new KeyToolError('اكتب آخر يومٍ في التمديد');
    payload = { v: 1, device, kind: 'extend', issued, until: input.until, office };
  } else throw new KeyToolError('اختر الخطّة: مدى الحياة أو عرض أو شهري أو سنوي أو تمديد');
  const key = signKey(payload, privateKey);
  const buyer = plan === 'lifetime' ? countLifetime(dir) + 1 : null;
  // قبل أن يُقيَّد هذا المفتاح نفسه. والتجديد (`renewal`) يكرّر الجهاز عمدًا — فلا تنبيه.
  const warnings = input.renewal ? [] : repeatsOf(dir, { device, office, phone: input.phone });
  if (opts.record !== false) {
    appendLedger(dir, {
      date: issued,
      kind: plan === 'demo' ? DEMO_KIND : KIND_LABEL[payload.kind],
      plan: PLAN_LABEL[plan],
      buyer: buyer ?? '',
      device,
      office,
      phone: input.phone,
      until: payload.until ?? '',
      price: input.price,
      notes:
        plan === 'demo'
          ? `مفتاح عرض — لا يُعدّ من أوّل ${EARLY_LIFETIME}${input.notes ? ` — ${input.notes}` : ''}`
          : buyer && buyer <= EARLY_LIFETIME
            ? `من أوّل ${EARLY_LIFETIME} مشترين${input.notes ? ` — ${input.notes}` : ''}`
            : input.renewal
              ? `تجديد${input.notes ? ` — ${input.notes}` : ''}`
              : input.notes,
      key
    });
  }
  return { key, payload, buyer, warnings, message: customerMessage(key, payload) };
}

/** ما يُرسل للزبون بواتساب: المفتاح وكيف يُلصق. */
export function customerMessage(key, payload) {
  const what =
    payload.kind === 'full' ? 'تفعيل ديوان مدى الحياة' : payload.kind === 'sub' ? `اشتراك ديوان ${payload.plan === 'yearly' ? 'السنوي' : 'الشهري'} حتى ${payload.until}` : `تمديد المدّة التجريبية حتى ${payload.until}`;
  return [`مفتاح ${what} — لهذا الجهاز (${payload.device}):`, '', key, '', 'افتح ديوان ← الإعدادات ← التفعيل، والصق المفتاح كاملًا، واضغط «فعّل».'].join('\n');
}

// ── السجلّ ─────────────────────────────────────────────────────────────

export const LEDGER_COLUMNS = ['التاريخ', 'النوع', 'الخطة', 'رقم المشتري', 'رمز الجهاز', 'المكتب', 'الهاتف', 'حتى', 'السعر', 'ملاحظات', 'المفتاح'];
const FIELDS = ['date', 'kind', 'plan', 'buyer', 'device', 'office', 'phone', 'until', 'price', 'notes', 'key'];
const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur);
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
      cur = '';
    } else cur += c;
  }
  if (cur !== '' || row.length) {
    row.push(cur);
    if (row.some((x) => x !== '')) rows.push(row);
  }
  return rows;
}

/** صفوف السجلّ — بعناوينه أيًّا كان ترتيبها (السجلّ القديم بسبعة أعمدة يُقرأ أيضًا). */
export function readLedger(dir) {
  const file = join(dir, LEDGER_FILE);
  if (!existsSync(file)) return [];
  const rows = parseCsv(readFileSync(file, 'utf8').replace(/^﻿/, ''));
  const head = rows.shift() ?? [];
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [FIELDS[LEDGER_COLUMNS.indexOf(h)] ?? h, r[i] ?? ''])));
}

const PLAN_OF_LABEL = { [PLAN_LABEL.monthly]: 'monthly', [PLAN_LABEL.yearly]: 'yearly' };
const nextDay = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * تجديد الاشتراك من السجلّ (البند ٣٤، قرار المالك ١٢ ت١): المكتب لا يرسل رمز جهازه ثانيةً — رمزه ومكتبه وهاتفه في السجلّ.
 * فيُؤخذ **آخر اشتراكٍ لهذا الجهاز** (أبعده يومًا) بخطّته، ويبدأ الجديد في اليوم التالي لنهايته — أو اليوم إن كان قد انتهى.
 * والبرنامج يأخذ أبعد يومٍ في مفاتيح الجهاز، فالمفتاح الجديد يُضاف ولا يُلغي ما قبله.
 */
export function renewalFor(dir, device, todayIso = today()) {
  const code = normalizeDevice(device);
  const subs = readLedger(dir).filter((r) => r.device === code && PLAN_OF_LABEL[r.plan] && /^\d{4}-\d{2}-\d{2}$/.test(r.until ?? ''));
  if (!subs.length) throw new KeyToolError('لا اشتراك لهذا الجهاز في السجلّ يُجدَّد');
  const last = subs.reduce((a, b) => (b.until > a.until ? b : a));
  const plan = PLAN_OF_LABEL[last.plan];
  const after = nextDay(last.until);
  const start = after > todayIso ? after : todayIso;
  return { device: code, plan, office: last.office ?? '', phone: last.phone ?? '', start, until: subscriptionUntil(plan, start), previousUntil: last.until };
}

export function countLifetime(dir) {
  return readLedger(dir).filter((r) => r.kind === 'كامل').length;
}

function appendLedger(dir, row) {
  const file = join(dir, LEDGER_FILE);
  mkdirSync(dirname(file), { recursive: true });
  const headLine = LEDGER_COLUMNS.map(cell).join(',') + '\r\n';
  if (!existsSync(file)) writeFileSync(file, '﻿' + headLine);
  else {
    // سجلٌّ بعناوين قديمة: تُعاد كتابته بالجديدة، والصفوف كما هي في أعمدتها.
    const text = readFileSync(file, 'utf8').replace(/^﻿/, '');
    const head = parseCsv(text.split(/\r?\n/)[0] ?? '')[0] ?? [];
    if (head.join() !== LEDGER_COLUMNS.join()) {
      const old = readLedger(dir);
      writeFileSync(file, '﻿' + headLine + old.map((r) => FIELDS.map((f) => cell(r[f])).join(',') + '\r\n').join(''));
    }
  }
  appendFileSync(file, FIELDS.map((f) => cell(row[f])).join(',') + '\r\n');
}

// ── ملفّ التحديث «أ+» ─────────────────────────────────────────────────

/** الحمولة بترتيب البرنامج (src/main/services/update.ts). */
function canonicalManifest(m) {
  return JSON.stringify({ app: m.app, kind: m.kind, version: m.version, sha256: m.sha256, size: m.size, notes: m.notes, issued: m.issued });
}

async function hashAndCrc(path) {
  const hash = createHash('sha256');
  let crc = 0;
  for await (const chunk of createReadStream(path, { highWaterMark: 1 << 20 })) {
    hash.update(chunk);
    crc = crc32(chunk, crc);
  }
  return { sha256: hash.digest('hex'), crc: crc >>> 0 };
}

/**
 * أرشيفٌ بمدخلين مخزَّنين (لا ضغط): `update.json` ثم `setup.exe` — يقرؤه البرنامج من فهرسه.
 *
 * `signature` بـ`privateKey` — ما تقرؤه الإصدارات كلّها. و`updateKeys` (البند ٣٣) توقيعاتٌ أخرى في `signatures`: الإصدار
 * الذي يعرف مفتاح التحديث يقبل الملفّ بها، والأقدم لا يقرؤها فيكفيه `signature` — فملفٌّ واحد للمكاتب كلّها.
 */
export async function writeUpdateFile({ exe, version, notes, privateKey, updateKeys = [], out }) {
  if (!existsSync(exe)) throw new KeyToolError('اختر ملف المثبّت');
  if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new KeyToolError('رقم الإصدار مثل 1.1.0');
  if (!String(notes ?? '').trim()) throw new KeyToolError('اكتب «ما الجديد» في هذا الإصدار');
  const size = statSync(exe).size;
  const { sha256, crc } = await hashAndCrc(exe);
  const manifest = { app: 'diwan', kind: 'update', version, sha256, size, notes: String(notes).trim(), issued: today() };
  const signed = (k) => sign(null, Buffer.from(canonicalManifest(manifest), 'utf8'), k).toString('base64url');
  const signature = signed(privateKey);
  const signatures = updateKeys.map(signed);
  const json = Buffer.from(JSON.stringify(signatures.length ? { manifest, signature, signatures } : { manifest, signature }, null, 2));

  const fd = openSync(`${out}.part`, 'w');
  let pos = 0;
  const put = (buf) => {
    writeSync(fd, buf, 0, buf.length, pos);
    pos += buf.length;
  };
  const entries = [];
  const local = (name, length, entryCrc) => {
    const n = Buffer.from(name, 'utf8');
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0);
    h.writeUInt16LE(20, 4);
    h.writeUInt16LE(0x0800, 6);
    h.writeUInt32LE(entryCrc, 14);
    h.writeUInt32LE(length, 18);
    h.writeUInt32LE(length, 22);
    h.writeUInt16LE(n.length, 26);
    entries.push({ n, length, crc: entryCrc, offset: pos });
    put(Buffer.concat([h, n]));
  };
  try {
    local('update.json', json.length, crc32(json) >>> 0);
    put(json);
    local('setup.exe', size, crc);
    for await (const chunk of createReadStream(exe, { highWaterMark: 1 << 20 })) put(chunk);
    const cdStart = pos;
    for (const e of entries) {
      const h = Buffer.alloc(46);
      h.writeUInt32LE(0x02014b50, 0);
      h.writeUInt16LE(20, 4);
      h.writeUInt16LE(20, 6);
      h.writeUInt16LE(0x0800, 8);
      h.writeUInt32LE(e.crc, 16);
      h.writeUInt32LE(e.length, 20);
      h.writeUInt32LE(e.length, 24);
      h.writeUInt16LE(e.n.length, 28);
      h.writeUInt32LE(e.offset, 42);
      put(Buffer.concat([h, e.n]));
    }
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(pos - cdStart, 12);
    end.writeUInt32LE(cdStart, 16);
    put(end);
  } finally {
    closeSync(fd);
  }
  if (existsSync(out)) rmSync(out);
  renameSync(`${out}.part`, out);
  return { out, manifest };
}

// ── الحزمة المختومة (S48، D203) ─────────────────────────────────────────

const SEAL_MAGIC = 'DIWANSEAL1\n';
const SEAL_CONTEXT = 'diwan-seal\n';
const SEAL_ITEM = 200 * 1024 ** 2;
const SEAL_ITEMS = 2000;
const SEAL_CONTENT_EXTS = { suits: ['png', 'psd'], templates: ['diwanpack'], clips: ['diwanpack'], letterheads: ['diwanpack'] };
export const SEAL_KINDS = { first: 'حزمةٌ أولى', buyer: 'حزمة المشتري' };

/** اسم ملفّ الحزمة من عنوانها (D207): بلا فواصل المسار ومحارف Windows الخاصة. */
export function sealFileName(title) {
  const name = String(title ?? '').replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').replace(/^[. ]+|[. ]+$/g, '');
  return `${name || 'حزمة'}.diwanseal`;
}

/** معرّف المفتاح ومفتاح التشفير من العامّ — كـ`sealKeys` في البرنامج. */
export function sealKeys(publicKey) {
  const der = publicKey.export({ type: 'spki', format: 'der' });
  return {
    keyId: createHash('sha256').update(der).digest('hex').slice(0, 16),
    content: Buffer.from(hkdfSync('sha256', der, Buffer.from('diwan-seal-v1'), Buffer.from('content'), 32))
  };
}

/** قطع مجلّدٍ للحزمة: PNG وPSD بأسمائها مرتّبةً، بلا ما سواها. */
export function sealItemsFrom(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new KeyToolError('اختر مجلّد القطع');
  const items = readdirSync(dir)
    .filter((f) => /\.(png|psd)$/i.test(f))
    .sort((a, b) => a.localeCompare(b, 'ar'))
    .map((f) => ({ name: f.replace(/\.[^.]+$/, ''), path: join(dir, f) }));
  if (!items.length) throw new KeyToolError('لا قطعة في المجلّد — PNG مفرّغة أو PSD');
  return items;
}

/**
 * يكتب حزمةً مختومة: `items` [{ name, path }] (PNG أو PSD)، و`content` (`suits`)، و`kind` (`first` أو `buyer`)، والعنوان —
 * بمفتاح التحديث الخاصّ. الحمولة تُشفَّر تدفّقًا إلى ملفٍّ مؤقّت وتُحسب بصمتها، ثم الرأس والختم والحمولة.
 */
export async function writeSealedPack({ items, content = 'suits', kind, title, privateKey, out }) {
  if (!Object.hasOwn(SEAL_CONTENT_EXTS, content)) throw new KeyToolError('اختر محتوى الحزمة');
  if (content !== 'suits' && items?.length !== 1) throw new KeyToolError('حزمة القسم ملف محتوى واحد');
  if (kind !== 'first' && kind !== 'buyer') throw new KeyToolError('اختر نوع الحزمة: أولى أو للمشتري');
  const name = String(title ?? '').trim().slice(0, 80);
  if (!name) throw new KeyToolError('اكتب عنوان الحزمة');
  if (!items?.length || items.length > SEAL_ITEMS) throw new KeyToolError('القطع من واحدةٍ إلى ألفين');
  const list = [];
  for (const it of items) {
    const ext = /\.diwanpack$/i.test(it.path) ? 'diwanpack' : /\.psd$/i.test(it.path) ? 'psd' : /\.png$/i.test(it.path) ? 'png' : null;
    if (!SEAL_CONTENT_EXTS[content].includes(ext)) throw new KeyToolError(content === 'suits' ? `«${it.name}» ليست PNG ولا PSD` : 'اختر ملف القسم الذي صدّره ديوان (diwanpack)');
    const size = statSync(it.path).size;
    if (!size || size > SEAL_ITEM) throw new KeyToolError(`«${it.name}» فارغةٌ أو أكبر من ٢٠٠ م.ب`);
    const { sha256 } = await hashAndCrc(it.path);
    list.push({ name: String(it.name).replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'قطعة', ext, size, sha256 });
  }
  const { keyId, content: key } = sealKeys(createPublicKey(privateKey));
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = `${out}.body.part`;
  const fd = openSync(body, 'w');
  const hash = createHash('sha256');
  let size = 0;
  const put = (buf) => {
    if (!buf.length) return;
    writeSync(fd, buf);
    hash.update(buf);
    size += buf.length;
  };
  try {
    const listJson = Buffer.from(JSON.stringify({ items: list }), 'utf8');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(listJson.length, 0);
    put(cipher.update(Buffer.concat([len, listJson])));
    for (const it of items) for await (const chunk of createReadStream(it.path, { highWaterMark: 1 << 20 })) put(cipher.update(chunk));
    put(cipher.final());
    put(cipher.getAuthTag());
  } finally {
    closeSync(fd);
  }
  const head = Buffer.from(
    JSON.stringify({ v: 1, app: 'diwan', content, kind, title: name, issued: today(), keyId, iv: iv.toString('base64url'), size, sha256: hash.digest('hex') }),
    'utf8'
  );
  const signature = sign(null, Buffer.concat([Buffer.from(SEAL_CONTEXT, 'utf8'), head]), privateKey);
  const u32 = (n) => {
    const b = Buffer.alloc(4);
    b.writeUInt32BE(n, 0);
    return b;
  };
  const ofd = openSync(`${out}.part`, 'w');
  try {
    writeSync(ofd, Buffer.concat([Buffer.from(SEAL_MAGIC, 'utf8'), u32(head.length), head, u32(signature.length), signature]));
    for await (const chunk of createReadStream(body, { highWaterMark: 1 << 20 })) writeSync(ofd, chunk);
  } finally {
    closeSync(ofd);
    rmSync(body, { force: true });
  }
  if (existsSync(out)) rmSync(out);
  renameSync(`${out}.part`, out);
  return { out, kind, title: name, items: list.length, size: statSync(out).size };
}

/** «ما الجديد» من قسم الإصدار في CHANGELOG.md — إن كان الملف معروفًا. */
export function changelogSection(file, version) {
  if (!file || !existsSync(file)) return '';
  const lines = readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => l.startsWith(`## ${version}`));
  if (start < 0) return '';
  const end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim();
}
