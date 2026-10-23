/**
 * `cleanCheck.mjs` على برنامجٍ مثبَّت في هذا الجهاز (A22، D141) — بعد ترقية المالك، أو على `release/check/win-unpacked` قبل الصندوق:
 * ملفّ تعريفٍ مؤقّت (`drive.mjs`) فلا تُمسّ بيانات المكتب، و`registryGuard` يحفظ مرساة المدّة في السجلّ ويعيدها كما كانت (L61، ر116).
 *
 *   node tools/sandbox/onHost.mjs <Diwan.exe> [الإصدار المنتظر]
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registryGuard } from '../registryGuard.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const [exe, expect] = process.argv.slice(2);
if (!exe || !existsSync(exe)) {
  console.error('✗ أعطِ مسار Diwan.exe المثبَّت — مثل: node tools/sandbox/onHost.mjs "%LOCALAPPDATA%\\Programs\\Diwan\\Diwan.exe" 1.8.1-a22');
  process.exit(1);
}
const guard = registryGuard();
let status = 1;
try {
  const run = spawnSync(process.execPath, [join(HERE, '..', 'drive.mjs'), join(HERE, 'cleanCheck.mjs')], {
    cwd: join(HERE, '..', '..'),
    stdio: 'inherit',
    env: { ...process.env, DIWAN_EXE: resolve(exe), ...(expect ? { DIWAN_EXPECT_VERSION: expect } : {}) },
    timeout: 5 * 60 * 1000
  });
  status = run.status ?? 1;
} finally {
  guard.restore();
}
process.exit(status);
