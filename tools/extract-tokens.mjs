/**
 * يستخرج tailwind.config من ملفات التصميم ويكتب tailwind.config.cjs.
 *
 * التوكنات متطابقة في الشاشات الأربع — يتحقّق البرنامج من ذلك ويتوقّف إن اختلفت،
 * لأن اختلافها يعني أن التصميم تغيّر ويحتاج قرارًا لا نسخًا.
 *
 * الاستعمال:  node tools/extract-tokens.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SCREENS = ['a4', '_1', '_2', '_3'];
const RE = /<script id="tailwind-config">tailwind\.config=([\s\S]*?)<\/script>/;

function read(dir) {
  const html = readFileSync(`stitch_/${dir}/code.html`, 'utf8');
  const match = html.match(RE);
  if (!match) throw new Error(`لا يوجد tailwind-config في ${dir}`);
  return Function(`"use strict"; return (${match[1]});`)();
}

const configs = SCREENS.map((dir) => ({ dir, config: read(dir) }));
const reference = JSON.stringify(configs[0].config);

for (const { dir, config } of configs.slice(1)) {
  if (JSON.stringify(config) !== reference) {
    throw new Error(`توكنات ${dir} تختلف عن a4 — راجع التصميم قبل التوليد.`);
  }
}

const theme = configs[0].config.theme.extend;

const file =
  '/** توكنات التصميم — مُستخرجة آليًا من ملفات code.html في stitch_.\n' +
  ' *  لا تُعدَّل يدويًا. أعِد التوليد بـ: node tools/extract-tokens.mjs */\n' +
  'module.exports = {\n' +
  '  darkMode: "class",\n' +
  '  content: ["./src/renderer/index.html", "./src/renderer/src/**/*.{ts,tsx}"],\n' +
  '  theme: {\n' +
  '    extend: ' +
  JSON.stringify(theme, null, 6).replace(/\n/g, '\n    ') +
  '\n  },\n  plugins: []\n};\n';

writeFileSync('tailwind.config.cjs', file);

console.log(
  `tailwind.config.cjs  ←  ${SCREENS.length} ملفات متطابقة  ` +
    `(${Object.keys(theme.colors).length} لونًا، ` +
    `${Object.keys(theme.fontSize).length} مقياس خط، ` +
    `${Object.keys(theme.spacing).length} مسافة، ` +
    `${Object.keys(theme.borderRadius).length} نصف قطر)`
);
