/**
 * بناء محرّك Rust الأصلي (A20، D103) — يُبنى الحزمة بـcargo وينسخ الناتج إلى diwan_psd.node.
 *
 * يُنادى في `build` و`dist` كليهما، ويجد cargo في PATH أو في `%USERPROFILE%\.cargo\bin\cargo.exe`.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function findCargo() {
  const probe = spawnSync('cargo', ['--version'], { encoding: 'utf8', stdio: 'pipe' });
  if (probe.status === 0) return 'cargo';

  const userProfile = process.env.USERPROFILE || '';
  if (userProfile) {
    const fallback = join(userProfile, '.cargo', 'bin', 'cargo.exe');
    if (existsSync(fallback)) return fallback;
  }
  return null;
}

const cargo = findCargo();
if (!cargo) {
  console.error('✗ تعذّر العثور على cargo في PATH أو في %USERPROFILE%\\.cargo\\bin — ثبّت rustup أو أعد تشغيل البرنامج لترث الجلسة المسار');
  process.exit(1);
}

const manifest = join(ROOT, 'native', 'diwan-psd', 'Cargo.toml');
// CRT ساكن (D142): بدونه يستورد الملحق `VCRUNTIME140.dll`، وويندوز يبحث عنه بجانب الملحق لا بجانب Diwan.exe — فلا يُحمَّل على جهازٍ بلا VC++.
// ولهدف ويندوز في عملية cargo هذه وحدها، لا `RUSTFLAGS` عامّة؛ و`afterPack.cjs` يُسقط التحزيم إن بقي الاستيراد.
const res = spawnSync(cargo, ['build', '--release', '--manifest-path', manifest], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_RUSTFLAGS: '-C target-feature=+crt-static' }
});

if (res.status !== 0) {
  console.error('✗ تعذّر بناء حزمة Rust (diwan-psd)');
  process.exit(res.status ?? 1);
}

const dll = join(ROOT, 'native', 'diwan-psd', 'target', 'release', 'diwan_psd.dll');
const nodeOut = join(ROOT, 'native', 'diwan-psd', 'diwan_psd.node');

if (!existsSync(dll)) {
  console.error(`✗ ملف DLL المبني غير موجود: ${dll}`);
  process.exit(1);
}

const dllBuf = readFileSync(dll);
if (existsSync(nodeOut)) {
  try {
    const existing = readFileSync(nodeOut);
    if (existing.equals(dllBuf)) {
      console.log('✓ محرّك Rust مطابقٌ لـ native/diwan-psd/diwan_psd.node (لم يتغيّر شيء)');
      process.exit(0);
    }
  } catch {
    // إن تعذّرت القراءة نمضي إلى محاولة النسخ
  }
}

try {
  copyFileSync(dll, nodeOut);
  console.log('✓ بُني محرّك Rust ونُسخ إلى native/diwan-psd/diwan_psd.node');
} catch (e) {
  if (e && (e.code === 'EBUSY' || e.code === 'EPERM')) {
    console.error('✗ إضافة Rust مفتوحةٌ في برنامجٍ يعمل — أغلق ديوان والاختبارات ثم أعد البناء');
    process.exit(1);
  }
  throw e;
}

