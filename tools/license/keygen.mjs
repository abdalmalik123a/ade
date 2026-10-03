/**
 * أداة المفاتيح — للمالك وحده، ولا تُحزم في المثبّت (خطة Production، ٦٫٣).
 *
 *   node tools/license/keygen.mjs init
 *       يصنع زوج المفاتيح مرّةً واحدة: الخاصّ في مجلّد المالك خارج المشروع — «لا يجب فقدانها» على سطح المكتب
 *       (أو DIWAN_OWNER_DIR) — احفظ المجلّد كلّه على فلاشةٍ وفي Google Drive ولا تعطِ المفتاح أحدًا —
 *       والعامّ في src/main/license/ownerKey.ts ليُبنى به البرنامج.
 *
 *   node tools/license/keygen.mjs issue DWN-XXXX-XXXX-XXXX-XXXX [--office "مكتب الرافدين"] [--phone 07…]
 *       مفتاح تفعيلٍ كامل مدى الحياة لذلك الجهاز — ويُكتب في «سجل المفاتيح المصدرة.csv» في مجلّد المالك،
 *       فيُعاد إصداره لمن طلبه يومًا ويُعرف لمن بيع.
 *
 *   node tools/license/keygen.mjs extend DWN-XXXX-XXXX-XXXX-XXXX --until 2026-11-30
 *       تمديد المدّة التجريبية لذلك الجهاز إلى يومٍ بعينه (شاملًا).
 *
 *   node tools/license/keygen.mjs update release/diwan-1.1.0-setup.exe --version 1.1.0 [--notes ملف]
 *       ملفّ التحديث «أ+» (diwan-1.1.0.diwanupdate بجانب المثبّت): المثبّت وبصمته و«ما الجديد» — من قسم
 *       الإصدار في CHANGELOG.md إن لم يُعطَ ملف — بتوقيع المالك. يُرسل إلى المكاتب فتثبّته من «الإعدادات».
 *
 * و`--key مسار` يختار مفتاحًا خاصًّا غير الافتراضي (للاختبار). والمفتاح يُطبع سطرًا واحدًا يُرسل كما هو.
 * وصيغته هي ما يقرؤه البرنامج (src/main/services/license.ts) — ويُثبّت ذلك tests/license.test.ts.
 */
import { generateKeyPairSync, createHash, createPrivateKey, sign } from 'node:crypto';
import { appendFileSync, createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { Zip, ZipDeflate, ZipPassThrough } from 'fflate';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
/** مجلّد المالك: المفتاح الخاصّ وسجلّ المفاتيح المصدرة — يُرفع كلّه على فلاشةٍ وGoogle Drive. */
const OWNER_DIR = process.env.DIWAN_OWNER_DIR ?? join(homedir(), 'Desktop', 'لا يجب فقدانها');
const KEY_NAME = 'diwan-owner-private.pem';
/** ما كان قبل المجلّد (٢ تشرين الأول ٢٠٢٦): يُقرأ منه إن لم يُنقل بعد. */
const LEGACY_KEY = join(homedir(), 'Diwan-Owner', KEY_NAME);
const DEFAULT_KEY = existsSync(join(OWNER_DIR, KEY_NAME)) || !existsSync(LEGACY_KEY) ? join(OWNER_DIR, KEY_NAME) : LEGACY_KEY;
const LEDGER = join(OWNER_DIR, 'سجل المفاتيح المصدرة.csv');
const PUBLIC_TS = join(ROOT, 'src', 'main', 'license', 'ownerKey.ts');

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

/** كما في البرنامج: Crockford، وO صفر، وI وL واحد. */
function normalizeDevice(code) {
  const body = String(code ?? '')
    .toUpperCase()
    .replace(/^DWN/, '')
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  if (body.length !== 16) fail('رمز الجهاز ستّة عشر حرفًا بعد DWN — انسخه من شاشة «التفعيل» كما هو');
  return `DWN-${body.match(/.{4}/g).join('-')}`;
}

function canonical(p) {
  const o = { v: p.v, device: p.device, kind: p.kind, issued: p.issued };
  if (p.until) o.until = p.until;
  if (p.office) o.office = p.office;
  return JSON.stringify(o);
}

function makeKey(payload, keyPath) {
  if (!existsSync(keyPath)) fail(`لا مفتاح خاصّ في ${keyPath} — شغّل «init» أوّلًا، أو أعطِ مساره بـ--key`);
  const privateKey = createPrivateKey(readFileSync(keyPath, 'utf8'));
  const body = Buffer.from(canonical(payload), 'utf8').toString('base64url');
  return `DIWAN-${body}.${sign(null, Buffer.from(body, 'utf8'), privateKey).toString('base64url')}`;
}

const today = new Date().toLocaleDateString('en-CA');

/**
 * كلّ مفتاحٍ صدر بمفتاح المالك يُكتب سطرًا في السجلّ — بعلامة UTF-8 في أوّله فيقرأ Excel العربية. ولا يُكتب
 * ما صدر بمفتاح اختبار (`--key`).
 */
function record(row) {
  if (flag('key')) return;
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  if (!existsSync(LEDGER)) {
    mkdirSync(dirname(LEDGER), { recursive: true });
    writeFileSync(LEDGER, String.fromCharCode(0xfeff) + ['التاريخ', 'النوع', 'رمز الجهاز', 'المكتب', 'الهاتف', 'حتى', 'المفتاح'].map(cell).join(',') + '\r\n');
  }
  appendFileSync(LEDGER, [row.date, row.kind, row.device, row.office, row.phone, row.until, row.key].map(cell).join(',') + '\r\n');
}

/** قسم الإصدار من CHANGELOG.md: من «## X.Y.Z» إلى القسم الذي يليه. */
function changelogSection(version) {
  const file = join(ROOT, 'CHANGELOG.md');
  if (!existsSync(file)) return '';
  const lines = readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => l.startsWith(`## ${version}`));
  if (start < 0) return '';
  const end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim();
}

/** الأرشيف مارًّا: الوصف مضغوطًا، والمثبّت كما هو (مضغوطٌ أصلًا). */
async function writeUpdate(out, json, exe) {
  const ws = createWriteStream(out);
  const done = new Promise((res, rej) => {
    ws.on('finish', res);
    ws.on('error', rej);
  });
  const zip = new Zip((err, chunk, final) => {
    if (err) throw err;
    ws.write(Buffer.from(chunk));
    if (final) ws.end();
  });
  const head = new ZipDeflate('update.json', { level: 9 });
  zip.add(head);
  head.push(new Uint8Array(json), true);
  const body = new ZipPassThrough('setup.exe');
  zip.add(body);
  for await (const chunk of createReadStream(exe, { highWaterMark: 1 << 20 })) body.push(new Uint8Array(chunk));
  body.push(new Uint8Array(0), true);
  zip.end();
  await done;
}
const [cmd, device] = args;

if (cmd === 'init') {
  const out = flag('key') ?? DEFAULT_KEY;
  if (existsSync(out)) fail(`يوجد مفتاحٌ خاصّ في ${out} — لا يُكتب فوقه: المفاتيح التي صدرت به تبقى تعمل بعموميّه`);
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  const pem = publicKey.export({ type: 'spki', format: 'pem' }).trim();
  if (!flag('key')) {
    mkdirSync(dirname(PUBLIC_TS), { recursive: true });
    writeFileSync(
      PUBLIC_TS,
      `/**\n * المفتاح العامّ للمالك (Ed25519) — به يتحقّق البرنامج من مفاتيح التفعيل. صنعته tools/license/keygen.mjs init\n * يوم ${today}؛ والخاصّ عند المالك وحده خارج المشروع. لا يُغيَّر إلا بإصدارٍ جديد: ما صدر بغيره لا يعمل به.\n */\nexport const OWNER_PUBLIC_KEY = \`${pem}\`;\n`
    );
  }
  console.log(`✓ المفتاح الخاصّ: ${out}\n  احفظ منه نسختين خارج هذا الجهاز (فلاشة وبريدٌ خاصّ)، ولا تعطه أحدًا.`);
  if (!flag('key')) console.log(`✓ المفتاح العامّ: ${PUBLIC_TS}`);
} else if (cmd === 'issue') {
  const payload = { v: 1, device: normalizeDevice(device), kind: 'full', issued: today };
  const office = flag('office');
  if (office) payload.office = office;
  const key = makeKey(payload, flag('key') ?? DEFAULT_KEY);
  record({ date: today, kind: 'كامل', device: payload.device, office, phone: flag('phone'), until: '', key });
  console.log(key);
} else if (cmd === 'extend') {
  const until = flag('until');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until ?? '')) fail('--until YYYY-MM-DD: آخر يومٍ تعمل فيه المدّة');
  const payload = { v: 1, device: normalizeDevice(device), kind: 'extend', issued: today, until };
  const key = makeKey(payload, flag('key') ?? DEFAULT_KEY);
  record({ date: today, kind: 'تمديد', device: payload.device, office: flag('office'), phone: flag('phone'), until, key });
  console.log(key);
} else if (cmd === 'update') {
  const exe = args[1];
  const version = flag('version');
  if (!exe || !existsSync(exe)) fail('أعطِ مسار المثبّت: update release/diwan-X.Y.Z-setup.exe --version X.Y.Z');
  if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) fail('--version X.Y.Z: رقم الإصدار الذي في المثبّت');
  const notes = flag('notes') ? readFileSync(flag('notes'), 'utf8').trim() : changelogSection(version);
  if (!notes) fail(`لا «ما الجديد» للإصدار ${version}: اكتب قسمه في CHANGELOG.md أو أعطِ --notes`);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(exe)) hash.update(chunk);
  const manifest = { app: 'diwan', kind: 'update', version, sha256: hash.digest('hex'), size: statSync(exe).size, notes, issued: today };
  const keyPath = flag('key') ?? DEFAULT_KEY;
  if (!existsSync(keyPath)) fail(`لا مفتاح خاصّ في ${keyPath}`);
  const canonicalManifest = JSON.stringify({ app: manifest.app, kind: manifest.kind, version: manifest.version, sha256: manifest.sha256, size: manifest.size, notes: manifest.notes, issued: manifest.issued });
  const signature = sign(null, Buffer.from(canonicalManifest, 'utf8'), createPrivateKey(readFileSync(keyPath, 'utf8'))).toString('base64url');
  const out = flag('out') ?? join(dirname(exe), `diwan-${version}.diwanupdate`);
  await writeUpdate(out, Buffer.from(JSON.stringify({ manifest, signature }, null, 2)), exe);
  console.log(`✓ ${out}\n  الإصدار ${version} — ${(manifest.size / 1024 / 1024).toFixed(1)} م.ب — SHA-256 ${manifest.sha256}`);
} else {
  console.log('الأوامر: init · issue <رمز الجهاز> [--office اسم] · extend <رمز الجهاز> --until YYYY-MM-DD · update <المثبّت> --version X.Y.Z   (و--key مسار)');
  process.exit(cmd ? 1 : 0);
}
