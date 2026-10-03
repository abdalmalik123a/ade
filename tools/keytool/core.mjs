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
 */
import { createCipheriv, createDecipheriv, createHash, createPrivateKey, createPublicKey, randomBytes, scryptSync, sign } from 'node:crypto';
import { appendFileSync, createReadStream, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, writeSync, closeSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { crc32 } from 'node:zlib';

export const KEY_FILE = 'diwan-owner-private.key';
export const PLAIN_KEY_FILE = 'diwan-owner-private.pem';
export const LEDGER_FILE = 'سجل المفاتيح المصدرة.csv';
export const TEXT_COPY_FILE = '٢ - المفتاح الخاص (نسخة نصية).txt';
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
  return { encrypted: existsSync(join(dir, KEY_FILE)), plain: existsSync(join(dir, PLAIN_KEY_FILE)) };
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

/** تغيير كلمة السرّ: يُفكّ بالقديمة ويُشفَّر بالجديدة، ويُتحقّق قبل أن يُستبدل. */
export function changePassword(dir, oldPassword, newPassword) {
  if (String(newPassword).length < 8) throw new KeyToolError('كلمة السرّ ثمانية أحرفٍ أقلّها');
  const enc = join(dir, KEY_FILE);
  const pem = unseal(readFileSync(enc, 'utf8'), oldPassword);
  const armored = seal(pem, newPassword);
  if (publicKeyPem(createPrivateKey(unseal(armored, newPassword))) !== publicKeyPem(createPrivateKey(pem))) throw new KeyToolError('تعذّر التحقّق — لم يُمسّ شيء');
  writeFileSync(`${enc}.part`, armored);
  renameSync(`${enc}.part`, enc);
  writeTextCopy(dir, armored);
}

function writeTextCopy(dir, armored) {
  const text = [
    'المفتاح الخاص لديوان — مشفّرٌ بكلمة سرّ المالك (scrypt + AES-256-GCM).',
    'لا يُفكّ بغير الكلمة، فتسرّبه لا يُصدر مفتاحًا. ومن نسي الكلمة فقده: احفظها مكتوبةً بعيدًا عن الفلاشة.',
    `إن ضاع ملف ${KEY_FILE} فانسخ الأسطر بين الخطّين — ومعها سطرا BEGIN وEND — إلى ملفٍّ بذلك الاسم.`,
    '------------------------------------------------------------',
    armored.trim(),
    '------------------------------------------------------------'
  ].join('\r\n');
  writeFileSync(join(dir, TEXT_COPY_FILE), Buffer.from('﻿' + text + '\r\n', 'utf8'));
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
const PLAN_LABEL = { lifetime: 'مدى الحياة', monthly: 'شهري', yearly: 'سنوي', extend: 'تمديد تجريبي' };

/**
 * يُصدر مفتاحًا ويكتبه في السجلّ. `plan`: lifetime أو monthly أو yearly أو extend. ويعيد المفتاح ورقم المشتري
 * (لمدى الحياة) ورسالةً جاهزةً للزبون.
 */
export function issue(dir, privateKey, input, opts = {}) {
  const device = normalizeDevice(input.device);
  const plan = input.plan;
  const issued = input.issued ?? today();
  const office = String(input.office ?? '').trim() || undefined;
  let payload;
  if (plan === 'lifetime') payload = { v: 1, device, kind: 'full', issued, office };
  else if (plan === 'monthly' || plan === 'yearly') {
    const until = input.until || subscriptionUntil(plan, input.start || issued);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) throw new KeyToolError('يوم انتهاء الاشتراك YYYY-MM-DD');
    payload = { v: 1, device, kind: 'sub', issued, plan, until, office };
  } else if (plan === 'extend') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.until ?? '')) throw new KeyToolError('اكتب آخر يومٍ في التمديد');
    payload = { v: 1, device, kind: 'extend', issued, until: input.until, office };
  } else throw new KeyToolError('اختر الخطّة: مدى الحياة أو شهري أو سنوي أو تمديد');
  const key = signKey(payload, privateKey);
  const buyer = plan === 'lifetime' ? countLifetime(dir) + 1 : null;
  if (opts.record !== false) {
    appendLedger(dir, {
      date: issued,
      kind: KIND_LABEL[payload.kind],
      plan: PLAN_LABEL[plan],
      buyer: buyer ?? '',
      device,
      office,
      phone: input.phone,
      until: payload.until ?? '',
      price: input.price,
      notes: buyer && buyer <= EARLY_LIFETIME ? `من أوّل ${EARLY_LIFETIME} مشترين${input.notes ? ` — ${input.notes}` : ''}` : input.notes,
      key
    });
  }
  return { key, payload, buyer, message: customerMessage(key, payload) };
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

/** أرشيفٌ بمدخلين مخزَّنين (لا ضغط): `update.json` ثم `setup.exe` — يقرؤه البرنامج من فهرسه. */
export async function writeUpdateFile({ exe, version, notes, privateKey, out }) {
  if (!existsSync(exe)) throw new KeyToolError('اختر ملف المثبّت');
  if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new KeyToolError('رقم الإصدار مثل 1.1.0');
  if (!String(notes ?? '').trim()) throw new KeyToolError('اكتب «ما الجديد» في هذا الإصدار');
  const size = statSync(exe).size;
  const { sha256, crc } = await hashAndCrc(exe);
  const manifest = { app: 'diwan', kind: 'update', version, sha256, size, notes: String(notes).trim(), issued: today() };
  const signature = sign(null, Buffer.from(canonicalManifest(manifest), 'utf8'), privateKey).toString('base64url');
  const json = Buffer.from(JSON.stringify({ manifest, signature }, null, 2));

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

/** «ما الجديد» من قسم الإصدار في CHANGELOG.md — إن كان الملف معروفًا. */
export function changelogSection(file, version) {
  if (!file || !existsSync(file)) return '';
  const lines = readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => l.startsWith(`## ${version}`));
  if (start < 0) return '';
  const end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim();
}
