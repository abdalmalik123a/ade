/**
 * صور حزمة المتجر (D242): من رمز ديوان `resources/icon.png` إلى `resources/appx/` التي يأخذها هدف `appx` في electron-builder
 * بدل صوره الافتراضية. ترسمها System.Drawing في Windows PowerShell — بلا اعتمادية — بخلفيةٍ شفّافة والرمز في وسطها.
 *
 *   node tools/appxAssets.mjs
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'resources', 'icon.png');
const OUT = join(ROOT, 'resources', 'appx');

/** [الاسم، العرض، الطول، حجم الرمز فيها] — الرموز الصغيرة تملؤها، والبلاطات تترك هامشًا كما توصي مايكروسوفت. */
const ASSETS = [
  ['StoreLogo', 50, 50, 50],
  ['Square44x44Logo', 44, 44, 44],
  ['SmallTile', 71, 71, 52],
  ['Square150x150Logo', 150, 150, 100],
  ['Wide310x150Logo', 310, 150, 100],
  ['LargeTile', 310, 310, 200]
];

mkdirSync(OUT, { recursive: true });
const lines = ASSETS.map(
  ([name, w, h, s]) => `Draw '${join(OUT, `${name}.png`)}' ${w} ${h} ${s}`
);
const script = `
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile('${SRC}')
function Draw($path, $w, $h, $s) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($src, [int](($w - $s) / 2), [int](($h - $s) / 2), $s, $s)
  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}
${lines.join('\n')}
$src.Dispose()
`;
const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' });
if (r.status !== 0) {
  console.error(r.stderr || r.stdout);
  process.exit(1);
}
console.log(`✓ ${ASSETS.length} صور في resources/appx`);
