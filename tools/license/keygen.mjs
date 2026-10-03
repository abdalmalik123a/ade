/**
 * أداة المفاتيح من سطر الأوامر — للمطوّر والاختبار. **والمالك يستعمل الأداة المكتبية** «أداة مفاتيح ديوان»
 * (tools/keytool) بلا أوامر: كلمة السرّ، ثم الخانات، ثم «ولّد». والاثنتان على قلبٍ واحد (tools/keytool/core.mjs).
 *
 *   node tools/license/keygen.mjs issue DWN-XXXX-XXXX-XXXX-XXXX [--plan lifetime|monthly|yearly] [--office "…"]
 *        [--phone 07…] [--start YYYY-MM-DD] [--until YYYY-MM-DD] [--price 50000]
 *       مفتاح تفعيل: مدى الحياة (الافتراض)، أو اشتراكٌ شهريٌّ أو سنويٌّ إلى يومه — ويُكتب في سجلّ المفاتيح.
 *
 *   node tools/license/keygen.mjs extend DWN-XXXX-XXXX-XXXX-XXXX --until 2026-11-30
 *       تمديد المدّة التجريبية لذلك الجهاز إلى يومٍ بعينه (شاملًا).
 *
 *   node tools/license/keygen.mjs update release/diwan-1.1.0-setup.exe --version 1.1.0 [--notes ملف]
 *       ملفّ التحديث «أ+» بجانب المثبّت — «ما الجديد» من CHANGELOG.md إن لم يُعطَ ملف.
 *
 *   node tools/license/keygen.mjs init --key مسار
 *       زوج مفاتيح للاختبار (غير مشفّر) في المسار المعطى. ومفتاح المالك صُنع مرّةً ولا يُصنع ثانيةً.
 *
 * المفتاح الخاص: من مجلّد المالك «لا يجب فقدانها» على سطح المكتب (أو DIWAN_OWNER_DIR)، مشفّرًا بكلمةٍ تُعطى
 * في DIWAN_OWNER_PASSWORD — أو من `--key مسار` لملفّ PEM غير مشفّر (للاختبار، ولا يُكتب في السجلّ).
 */
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  KeyToolError,
  changelogSection,
  issue,
  keyState,
  loadPrivateKey,
  loadPrivateKeyFile,
  normalizeDevice,
  writeUpdateFile
} from '../keytool/core.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OWNER_DIR = process.env.DIWAN_OWNER_DIR ?? join(homedir(), 'Desktop', 'لا يجب فقدانها');

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

const privateKey = () => (flag('key') ? loadPrivateKeyFile(flag('key')) : loadPrivateKey(OWNER_DIR, process.env.DIWAN_OWNER_PASSWORD));

async function main() {
  const [cmd, device] = args;
  if (cmd === 'init') {
    const out = flag('key');
    if (!out) fail('مفتاح المالك صُنع مرّةً ولا يُصنع ثانيةً — و«init» للاختبار بـ--key مسار');
    if (existsSync(out)) fail(`يوجد مفتاحٌ في ${out}`);
    const { privateKey: priv } = generateKeyPairSync('ed25519');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, priv.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    console.log(`✓ ${out}`);
  } else if (cmd === 'issue' || cmd === 'extend') {
    const plan = cmd === 'extend' ? 'extend' : (flag('plan') ?? 'lifetime');
    const out = issue(
      flag('key') ? dirname(flag('key')) : OWNER_DIR,
      privateKey(),
      { device: normalizeDevice(device), plan, office: flag('office'), phone: flag('phone'), start: flag('start'), until: flag('until'), price: flag('price') },
      { record: !flag('key') }
    );
    if (out.buyer && !flag('key')) console.error(`  مشتري مدى الحياة رقم ${out.buyer}`);
    console.log(out.key);
  } else if (cmd === 'update') {
    const exe = args[1];
    const version = flag('version');
    const notes = flag('notes') ? (await import('node:fs')).readFileSync(flag('notes'), 'utf8') : changelogSection(join(ROOT, 'CHANGELOG.md'), version);
    const out = flag('out') ?? join(dirname(exe ?? '.'), `diwan-${version}.diwanupdate`);
    const { manifest } = await writeUpdateFile({ exe, version, notes, privateKey: privateKey(), out });
    console.log(`✓ ${out}\n  الإصدار ${version} — ${(manifest.size / 1024 / 1024).toFixed(1)} م.ب — SHA-256 ${manifest.sha256}`);
  } else if (cmd === 'status') {
    const s = keyState(OWNER_DIR);
    console.log(`مجلّد المالك: ${OWNER_DIR}\n  مشفّر: ${s.encrypted ? 'نعم' : 'لا'} — غير مشفّر: ${s.plain ? 'نعم (افتح الأداة المكتبية لتشفيره)' : 'لا'}`);
  } else {
    console.log('الأوامر: issue · extend · update · status · init --key   — والمالك يستعمل «أداة مفاتيح ديوان»');
    process.exit(cmd ? 1 : 0);
  }
}

main().catch((e) => fail(e instanceof KeyToolError ? e.message : e?.stack ?? String(e)));
