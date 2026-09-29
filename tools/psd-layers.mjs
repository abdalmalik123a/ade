/**
 * طبقات ملف Photoshop صورًا PNG شفّافة — بقارئ البرنامج نفسه (`src/main/services/psdLayers.ts`).
 *
 *     node tools/psd-layers.mjs <ملف.psd> <مجلّد الإخراج>
 *
 * كلّ طبقةٍ ترسم (لا نصّ ولا رأس مجموعة) تُكتب `NNN.png` بفهرسها في الملف، ومعها `layers.txt`
 * بأسمائها ومقاساتها. لتجهيز القاط من ملف المكتب (`tools/prepare-suits.py`).
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const [, , psdPath, outDir] = process.argv;
if (!psdPath || !outDir) {
  console.error('node tools/psd-layers.mjs <file.psd> <outDir>');
  process.exit(1);
}

// القارئ مكتوبٌ بـTypeScript: يُحزم إلى ملفٍّ مؤقّت ويُستورد.
const bundle = join(resolve(outDir), '.psd-reader.mjs');
mkdirSync(outDir, { recursive: true });
await build({
  stdin: {
    contents: "export { parsePsdLayers, layerPixels } from './src/main/services/psdLayers.ts'; export { writePng } from './src/main/services/png.ts';",
    resolveDir: resolve('.'),
    loader: 'ts'
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: bundle,
  logLevel: 'error'
});
const { parsePsdLayers, layerPixels, writePng } = await import(pathToFileURL(bundle).href);
rmSync(bundle);

const bytes = new Uint8Array(readFileSync(psdPath));
const doc = parsePsdLayers(bytes);
if (!doc) throw new Error('ليس ملف Photoshop');
const lines = [];
doc.layers.forEach((layer, i) => {
  const w = layer.rect.right - layer.rect.left;
  const h = layer.rect.bottom - layer.rect.top;
  lines.push(`${String(i).padStart(3, '0')}\t${layer.name}\t${w}x${h}`);
  if (w <= 0 || h <= 0 || layer.text || layer.divider) return;
  const px = layerPixels(bytes, doc, layer);
  if (!px || px.k !== 3) return;
  const rgba = new Uint8Array(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    rgba.set(px.native.subarray(p * 3, p * 3 + 3), p * 4);
    rgba[p * 4 + 3] = px.alpha[p];
  }
  writeFileSync(join(outDir, `${String(i).padStart(3, '0')}.png`), writePng(rgba, w, h));
});
writeFileSync(join(outDir, 'layers.txt'), lines.join('\n'));
console.log(`${doc.layers.length} طبقة ← ${outDir}`);
