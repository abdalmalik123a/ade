/**
 * الإشعارات القانونية (خطة Production، ٦٫٥): ما في البرنامج من عمل غيرنا، باسمه وإصداره ورخصته —
 * تُقرأ من حزمها في node_modules فلا تتخلّف عن الإصدار المحزوم، وتُعرض في «عن البرنامج».
 *
 *   node tools/make-notices.mjs   →   src/renderer/src/assets/notices.json   (ويجري مع npm run build)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

/** حزم المحرّر (ProseMirror) تُبنى في الواجهة — وما تحمله معها من حزمٍ صغيرة (و٧: كانت خارج الإشعارات). */
const PROSEMIRROR = Object.keys(pkg.devDependencies ?? {}).filter((d) => d.startsWith('prosemirror-'));
const prosemirrorDeps = PROSEMIRROR.flatMap((name) => {
  const file = join(ROOT, 'node_modules', name, 'package.json');
  return existsSync(file) ? Object.keys(JSON.parse(readFileSync(file, 'utf8')).dependencies ?? {}) : [];
});

/** ما يُحزم فعلًا: تبعيّات التشغيل، وما تبنيه الواجهة في حزمتها من أدوات التطوير. */
const BUNDLED = [
  ...Object.keys(pkg.dependencies ?? {}),
  'electron',
  'react',
  'react-dom',
  'pdfjs-dist',
  'material-symbols',
  ...Object.keys(pkg.devDependencies ?? {}).filter((d) => d.startsWith('@fontsource/')),
  ...PROSEMIRROR,
  ...prosemirrorDeps
];

const licenseOf = (p) => (typeof p.license === 'string' ? p.license : p.license?.type ?? (p.licenses ?? []).map((l) => l.type).join(' / ')) || '—';
const homeOf = (p) => p.homepage ?? (typeof p.repository === 'string' ? p.repository : p.repository?.url ?? '')?.replace(/^git\+/, '').replace(/\.git$/, '');

const items = [];
for (const name of [...new Set(BUNDLED)].sort()) {
  const file = join(ROOT, 'node_modules', name, 'package.json');
  if (!existsSync(file)) throw new Error(`لا حزمة ${name} في node_modules — ثبّت التبعيّات أوّلًا`);
  const p = JSON.parse(readFileSync(file, 'utf8'));
  items.push({ name, version: p.version, license: licenseOf(p), home: homeOf(p) || '' });
}

// ما ليس حزمةً npm: النموذج وبيانات القراءة والقاط.
items.push(
  { name: 'MODNet — فصل الشخص عن خلفيّته (resources/models)', version: 'q8', license: 'Apache-2.0', home: 'https://github.com/ZHKKe/MODNet' },
  { name: 'BiRefNet_lite-matting — فصل الأشياء عن خلفيّتها (resources/models)', version: 'q8', license: 'MIT', home: 'https://github.com/ZhengPeng7/BiRefNet' },
  { name: 'YuNet — الوجه والذقن في «الصور الشخصية» (resources/models)', version: '2023mar', license: 'MIT — Copyright (c) 2020 Shiqi Yu', home: 'https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet' },
  { name: 'Tesseract — بيانات قراءة العربية والإنكليزية (resources/tessdata)', version: '4.x', license: 'Apache-2.0', home: 'https://github.com/tesseract-ocr/tessdata' },
  { name: 'صور القاط في «الصور الشخصية»', version: '—', license: 'من مكتبةٍ مفتوحة المصدر — مسموحٌ استعمالها (قرار المالك)', home: '' }
);

writeFileSync(join(ROOT, 'src', 'renderer', 'src', 'assets', 'notices.json'), JSON.stringify(items, null, 2) + '\n');
console.log(`✓ ${items.length} إشعارًا`);
