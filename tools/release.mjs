/**
 * بعد `npm run dist` (خطة Production، ٧٫٤): يتحقّق أنّ المثبّت بإصدار package.json وأنّ لإصداره قسمًا في
 * CHANGELOG.md، ويكتب بصمته SHA-256 في release/SHA256SUMS.txt — تُرسل مع المثبّت فيُطابقها المكتب
 * (docs/INSTALL.md) قبل أن يثبّت.
 *
 *   npm run release   (= npm run dist ثم هذا)
 */
import { createHash } from 'node:crypto';
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

if (!existsSync(exe)) fail(`لا مثبّت للإصدار ${version}: ${exe} — شغّل npm run dist أوّلًا`);
const changelog = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
if (!new RegExp(`^## ${version.replace(/\./g, '\\.')}\\b`, 'm').test(changelog)) fail(`لا قسم «## ${version}» في CHANGELOG.md`);
if (!existsSync(join(ROOT, 'tests', 'fixtures', `release-${version}.db`))) {
  console.warn(`! لا tests/fixtures/release-${version}.db — اصنعها (tests/makeReleaseDb.test.ts) واحفظها لكلّ إصدارٍ يُباع`);
}

const hash = createHash('sha256');
for await (const chunk of createReadStream(exe)) hash.update(chunk);
const sum = hash.digest('hex');
const line = `${sum}  diwan-${version}-setup.exe\n`;
writeFileSync(join(ROOT, 'release', 'SHA256SUMS.txt'), line);
console.log(`✓ diwan-${version}-setup.exe — ${(statSync(exe).size / 1024 / 1024).toFixed(1)} م.ب`);
console.log(`  SHA-256 ${sum}`);
console.log('  ← release/SHA256SUMS.txt');
