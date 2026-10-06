/**
 * حزمةٌ من برنامج مخاطباتٍ في Excel — تُشغَّل عبر:
 *     node tools/excel-pack.mjs "<ملفّ Excel>" [content/packs/school-letters]
 * فتكتب pack.json بجانب curation.json، ثم يبنيها `npm run packs` كسائر الحزم (tools/packs/excel.ts).
 */
import { rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const [xlsx, dir = 'content/packs/school-letters'] = process.argv.slice(2);
if (!xlsx) {
  console.error('الاستعمال: node tools/excel-pack.mjs "<ملفّ Excel>" [مجلّد الحزمة]');
  process.exit(1);
}

const bundlePath = resolve('tools/.excel-pack-runner.mjs');
try {
  await build({
    entryPoints: [resolve('tools/packs/excel.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    outfile: bundlePath,
    logLevel: 'error',
    packages: 'external',
    alias: { '@shared': resolve('src/shared') }
  });
  const { buildExcelPack } = await import(pathToFileURL(bundlePath).href);
  const r = await buildExcelPack(resolve(xlsx), resolve(dir));
  console.log(`\nكُتبت ${join(dir, 'pack.json')}: ${r.templates} نموذجًا — وتُركت ${r.excluded.length} (${r.excluded.join('، ')})`);
  console.log(`الصور: ${r.images.slot} موضع شعار، ${r.images.rule} خطّ فاصل، ${r.images.basmala} بسملة مكتوبة، ${r.images.drop} تُركت`);
  console.log('ثم: npm run packs');
} finally {
  rmSync(bundlePath, { force: true });
}
