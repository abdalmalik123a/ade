/**
 * بعد `npm run dist` (خطة Production، ٧٫٤): يتحقّق أنّ المثبّت بإصدار package.json وأنّ لإصداره قسمًا في
 * CHANGELOG.md، ويكتب بصمته SHA-256 في release/SHA256SUMS.txt — تُرسل مع المثبّت فيُطابقها المكتب
 * (docs/INSTALL.md) قبل أن يثبّت.
 *
 * وهو بوّابة (و٨): **يفشل** إن كان في الشجرة ما لم يُودَع (فالمثبّت من إيداعٍ معروف — ومنها إشعاراتٌ أعاد البناء
 * توليدها)، أو غابت قاعدة الإصدار `tests/fixtures/release-<الإصدار>.db` (كانت تحذيرًا)، أو لم تنجح اختبارات الوحدة.
 *
 *   npm run release   (= npm run dist ثم هذا)
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const exe = join(ROOT, 'release', `diwan-${version}-setup.exe`);
const fail = (m) => {
  console.error(`✗ ${m}`);
  process.exit(1);
};

// ── البوّابة (و٨): الشجرة نظيفة، وقاعدة الإصدار موجودة، والاختبارات تنجح ──
const git = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
if (git.status !== 0) fail('تعذّر سؤال git عن حال الشجرة');
if (git.stdout.trim()) fail(`في الشجرة ما لم يُودَع — المثبّت يُبنى من إيداعٍ نظيف:
${git.stdout.trimEnd()}`);
if (!existsSync(join(ROOT, 'tests', 'fixtures', `release-${version}.db`))) {
  fail(`لا tests/fixtures/release-${version}.db — اصنعها (tests/makeReleaseDb.test.ts) وأودعها: بها يُختبر ترحيل قاعدة كلّ مكتبٍ اشترى هذا الإصدار`);
}
console.log('… اختبارات الوحدة');
const tests = spawnSync('npx vitest run', { cwd: ROOT, stdio: 'inherit', shell: true });
if (tests.status !== 0) fail('اختبارات الوحدة لم تنجح كلّها — لا إصدار');

if (!existsSync(exe)) fail(`لا مثبّت للإصدار ${version}: ${exe} — شغّل npm run dist أوّلًا`);
const changelog = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
if (!new RegExp(`^## ${version.replace(/\./g, '\\.')}\\b`, 'm').test(changelog)) fail(`لا قسم «## ${version}» في CHANGELOG.md`);

const hash = createHash('sha256');
for await (const chunk of createReadStream(exe)) hash.update(chunk);
const sum = hash.digest('hex');
const line = `${sum}  diwan-${version}-setup.exe\n`;
writeFileSync(join(ROOT, 'release', 'SHA256SUMS.txt'), line);
console.log(`✓ diwan-${version}-setup.exe — ${(statSync(exe).size / 1024 / 1024).toFixed(1)} م.ب`);
console.log(`  SHA-256 ${sum}`);
console.log('  ← release/SHA256SUMS.txt');
