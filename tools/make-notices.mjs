/**
 * الإشعارات القانونية (خطة Production، ٦٫٥؛ R04، D187): ما في البرنامج من عمل غيرنا، باسمه وإصداره ورخصته —
 * **من ملفّ القفل كلّه** لا من التبعيّات المباشرة وحدها: كلّ حزمة تشغيلٍ فيه (ما يحزمه المثبّت)، وما تبنيه الواجهة في حزمتها
 * من أدوات التطوير مع ما تجرّه، وElectron نفسه. وتُقرأ رخصها من حزمها في node_modules فلا تتخلّف عن الإصدار المحزوم،
 * وما خلت حزمته من ملفّ رخصةٍ فنصّه من `tools/notices/` (D234).
 *
 *   node tools/make-notices.mjs   →   src/renderer/src/assets/notices.json («عن البرنامج»)
 *                                  →   resources/THIRD-PARTY-NOTICES.txt  (النصوص الكاملة، بجوار البرنامج في المثبّت)
 *
 * ويجري مع npm run build وnpm run dist؛ وناتجه نفسه بايتًا ببايت في كلّ تشغيل (مرتّبٌ، بلا تاريخ).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const LOCK = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8')).packages;

/** اسم الحزمة من مسارها في ملفّ القفل («node_modules/a/node_modules/@b/c» ← «@b/c»). */
const nameOf = (path) => path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);

/** حلّ Node: الاسم في `node_modules` مجلّد الحزمة، ثم ما فوقه حتى الجذر. */
function resolveFrom(dir, name) {
  for (let d = dir; ; ) {
    const at = `${d ? `${d}/` : ''}node_modules/${name}`;
    if (LOCK[at]) return at;
    if (!d) return null;
    const i = d.lastIndexOf('/node_modules/');
    d = i < 0 ? '' : d.slice(0, i);
  }
}

/** الحزمة وما تجرّه بـ`dependencies` (لا الاختياريّة: ما تبنيه الواجهة لا يحمل أدوات Node). */
function closure(roots) {
  const seen = new Set();
  const queue = roots.map((name) => {
    const at = resolveFrom('', name);
    if (!at) throw new Error(`لا حزمة ${name} في ملفّ القفل — ثبّت التبعيّات أوّلًا`);
    return at;
  });
  while (queue.length) {
    const at = queue.shift();
    if (seen.has(at)) continue;
    seen.add(at);
    for (const dep of Object.keys(LOCK[at].dependencies ?? {})) {
      const next = resolveFrom(at, dep);
      if (next) queue.push(next);
    }
  }
  return seen;
}

/** حزم التشغيل: كلّ ما ليس للتطوير في ملفّ القفل — وهو ما ينسخه المثبّت إلى node_modules. */
const RUNTIME = Object.keys(LOCK).filter((at) => at && !LOCK[at].dev && !LOCK[at].devOptional);
/** ما تبنيه الواجهة في حزمتها من أدوات التطوير: المحرّر (ProseMirror) وReact وقارئ PDF والخطوط والأيقونات — وما تجرّه. */
const RENDERER = closure([
  'react',
  'react-dom',
  'pdfjs-dist',
  'material-symbols',
  ...Object.keys(pkg.devDependencies ?? {}).filter((d) => d.startsWith('@fontsource/') || d.startsWith('prosemirror-'))
]);
/** وElectron وحده: ما يجرّه في ملفّ القفل أدوات تنزيلٍ لا تُحزم (وإشعارات Chromium في LICENSES.chromium.html معه). */
const PATHS = [...new Set([...RUNTIME, ...RENDERER, 'node_modules/electron'])];

const licenseOf = (lock, p) =>
  (lock.license ?? (typeof p.license === 'string' ? p.license : p.license?.type ?? (p.licenses ?? []).map((l) => l.type).join(' / '))) || 'غير مذكورة في الحزمة — انظر مستودعها';
const homeOf = (p) => (p.homepage ?? (typeof p.repository === 'string' ? p.repository : p.repository?.url ?? '') ?? '').replace(/^git\+/, '').replace(/\.git$/, '');
const LICENSE_FILE = /^(licen[cs]e|copying|notice)([-._].*)?$/i;
/** نصوص الرخص المكمَّلة (D234، ر188): لحزمةٍ بلا ملفّ رخصة، من مصدرها الأصليّ بسطر المصدر — `<الاسم>@<الإصدار>.txt`، فإصدارٌ جديد يحتاج نصّه. */
const SUPPLEMENT = join(ROOT, 'tools', 'notices');
const supplement = (name) => {
  const file = join(SUPPLEMENT, `${name}.txt`);
  return existsSync(file) ? readFileSync(file, 'utf8').replace(/\r\n?/g, '\n').trim() : '';
};

const items = [];
const texts = [];
for (const at of PATHS) {
  const dir = join(ROOT, at);
  const file = join(dir, 'package.json');
  if (!existsSync(file)) throw new Error(`لا حزمة ${at} على القرص — ثبّت التبعيّات أوّلًا`);
  const p = JSON.parse(readFileSync(file, 'utf8'));
  const item = { name: nameOf(at), version: LOCK[at].version ?? p.version, license: licenseOf(LOCK[at], p), home: homeOf(p) };
  if (items.some((x) => x.name === item.name && x.version === item.version)) continue; // نسختان بالإصدار نفسه في مسارين
  items.push(item);
  const files = readdirSync(dir)
    .filter((f) => LICENSE_FILE.test(f))
    .sort();
  const body =
    files.map((f) => readFileSync(join(dir, f), 'utf8').replace(/\r\n?/g, '\n').trim()).join('\n\n') || supplement(`${item.name}@${item.version}`);
  texts.push({ ...item, body: body || `(لا ملفّ رخصةٍ في الحزمة — رخصتها: ${item.license})` });
}
items.sort((a, b) => a.name.localeCompare(b.name, 'en') || a.version.localeCompare(b.version, 'en'));
texts.sort((a, b) => a.name.localeCompare(b.name, 'en') || a.version.localeCompare(b.version, 'en'));

// ما ليس حزمةً npm: النماذج وبيانات القراءة والقاط.
const OTHERS = [
  { name: 'MODNet — فصل الشخص عن خلفيّته (resources/models)', version: 'q8', license: 'Apache-2.0', home: 'https://github.com/ZHKKe/MODNet' },
  { name: 'BiRefNet_lite-matting — فصل الأشياء عن خلفيّتها (resources/models)', version: 'q8', license: 'MIT', home: 'https://github.com/ZhengPeng7/BiRefNet' },
  { name: 'YuNet — الوجه والذقن في «الصور الشخصية» (resources/models)', version: '2023mar', license: 'MIT — Copyright (c) 2020 Shiqi Yu', home: 'https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet' },
  { name: 'RTMPose-t — نقطتا الكتفين في «القاط بضغطة» (resources/models)', version: 'body7 256×192', license: 'Apache-2.0', home: 'https://github.com/open-mmlab/mmpose' },
  { name: 'Tesseract — بيانات قراءة العربية والإنكليزية (resources/tessdata)', version: '4.x', license: 'Apache-2.0', home: 'https://github.com/tesseract-ocr/tessdata' },
  { name: 'صور القاط في «الصور الشخصية»', version: '—', license: 'لا صور قاط مدمجة؛ قاط المكتب والحزم المستوردة وفق حقوق أصحابها', home: '' }
];
items.push(...OTHERS);

writeFileSync(join(ROOT, 'src', 'renderer', 'src', 'assets', 'notices.json'), JSON.stringify(items, null, 2) + '\n');

const RULE = '='.repeat(72);
const models = readFileSync(join(ROOT, 'resources', 'models', 'NOTICE.md'), 'utf8').replace(/\r\n?/g, '\n').trim();
// ومحرّك onnxruntime الأصليّ يحمل في ملفّاته عمل غيره: إشعاراته كما ينشرها صاحبه لإصداره.
const ortVersion = LOCK['node_modules/onnxruntime-node'].version;
const ort = supplement(`onnxruntime-ThirdPartyNotices@${ortVersion}`);
if (!ort) throw new Error(`لا إشعارات onnxruntime ${ortVersion} في tools/notices — انسخ ThirdPartyNotices.txt من وسم إصداره`);
// وتشفير القاعدة (D239): SQLite3 Multiple Ciphers مبنيٌّ داخل ملحق better-sqlite3-multiple-ciphers؛ ونسخته في README المحرّك.
const SQLITE3MC = '2.4.0';
const sqlite3mc = supplement(`sqlite3mc@${SQLITE3MC}`);
if (!sqlite3mc) throw new Error(`لا رخصة SQLite3 Multiple Ciphers ${SQLITE3MC} في tools/notices`);
const txt = [
  'الإشعارات القانونية — ديوان (MADA TECH)',
  'ما في البرنامج من عمل غيرنا: كلّ حزمةٍ باسمها وإصدارها ورخصتها ونصّ رخصتها كما في حزمتها.',
  'وإشعارات Chromium وNode.js التي يحملها Electron في LICENSES.chromium.html بجوار البرنامج.',
  '',
  ...texts.flatMap((t) => [RULE, `${t.name} ${t.version} — ${t.license}`, ...(t.home ? [t.home] : []), '', t.body, '']),
  RULE,
  `onnxruntime ${ortVersion} — إشعارات الأطراف الثالثة في محرّكه الأصليّ (onnxruntime.dll)`,
  '',
  ort,
  '',
  RULE,
  `SQLite3 Multiple Ciphers ${SQLITE3MC} — تشفير القاعدة، مبنيٌّ داخل better-sqlite3-multiple-ciphers`,
  '',
  sqlite3mc,
  '',
  RULE,
  'النماذج وبيانات القراءة (resources/models و resources/tessdata)',
  '',
  ...OTHERS.map((o) => `${o.name} ${o.version} — ${o.license}${o.home ? ` — ${o.home}` : ''}`),
  '',
  models,
  ''
].join('\n');
writeFileSync(join(ROOT, 'resources', 'THIRD-PARTY-NOTICES.txt'), `﻿${txt}`, 'utf8');
console.log(`✓ ${items.length} إشعارًا (${texts.length} حزمة بنصّ رخصتها)`);
