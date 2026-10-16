/**
 * أوّل `npm run dist` (L61): إصدارٌ مُصدَرٌ لا يُبنى ثانيةً — `npm run dist` بإصدار package.json وهو موسومٌ يكتب فوق مثبّته
 * المُباع وبصمته في `release/`. فإن وُجد الوسم `v<الإصدار>` يخرج بـ١ قبل البناء. و`npm run release` يمرّ به لأنّه يبدأ بـ`dist`،
 * والوسم يُكتب بعد الإصدار (بأمر المالك). والفحص يُبنى في `release/check` أو بـ`npm run pack`، لا هنا.
 *
 *   node tools/distGuard.mjs
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const fail = (m) => {
  console.error(`✗ ${m}`);
  process.exit(1);
};

const git = spawnSync('git', ['tag', '--list', `v${version}`], { cwd: ROOT, encoding: 'utf8' });
if (git.status !== 0) fail('تعذّر سؤال git عن الوسوم — لا يُعرف أمُصدَرٌ هذا الإصدار');
if (git.stdout.trim()) fail(`الإصدار ${version} مُصدَرٌ — ارفع الرقم أوّلًا (package.json)، فلا يُكتب فوق مثبّته وبصمته`);
console.log(`✓ الإصدار ${version} لم يُوسَم بعد — يُبنى`);
