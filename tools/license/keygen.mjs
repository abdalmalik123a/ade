/**
 * أداة المفاتيح — للمالك وحده، ولا تُحزم في المثبّت (خطة Production، ٦٫٣).
 *
 *   node tools/license/keygen.mjs init
 *       يصنع زوج المفاتيح مرّةً واحدة: الخاصّ في مجلّد المالك خارج المشروع
 *       (%USERPROFILE%\Diwan-Owner\diwan-owner-private.pem) — احفظ منه نسختين خارج الجهاز ولا تعطه أحدًا —
 *       والعامّ في src/main/license/ownerKey.ts ليُبنى به البرنامج.
 *
 *   node tools/license/keygen.mjs issue DWN-XXXX-XXXX-XXXX-XXXX [--office "مكتب الرافدين"]
 *       مفتاح تفعيلٍ كامل مدى الحياة لذلك الجهاز.
 *
 *   node tools/license/keygen.mjs extend DWN-XXXX-XXXX-XXXX-XXXX --until 2026-11-30
 *       تمديد المدّة التجريبية لذلك الجهاز إلى يومٍ بعينه (شاملًا).
 *
 * و`--key مسار` يختار مفتاحًا خاصًّا غير الافتراضي (للاختبار). والمفتاح يُطبع سطرًا واحدًا يُرسل كما هو.
 * وصيغته هي ما يقرؤه البرنامج (src/main/services/license.ts) — ويُثبّت ذلك tests/license.test.ts.
 */
import { generateKeyPairSync, createPrivateKey, sign } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_KEY = join(homedir(), 'Diwan-Owner', 'diwan-owner-private.pem');
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
  console.log(makeKey(payload, flag('key') ?? DEFAULT_KEY));
} else if (cmd === 'extend') {
  const until = flag('until');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until ?? '')) fail('--until YYYY-MM-DD: آخر يومٍ تعمل فيه المدّة');
  console.log(makeKey({ v: 1, device: normalizeDevice(device), kind: 'extend', issued: today, until }, flag('key') ?? DEFAULT_KEY));
} else {
  console.log('الأوامر: init · issue <رمز الجهاز> [--office اسم] · extend <رمز الجهاز> --until YYYY-MM-DD   (و--key مسار)');
  process.exit(cmd ? 1 : 0);
}
