/**
 * أداة بناء حزم المحتوى الجاهزة — تُشغَّل عبر:
 *     node tools/build-packs.mjs
 * أو:
 *     npm run packs
 */
import { mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const outDir = resolve('resources/packs');
mkdirSync(outDir, { recursive: true });

const bundlePath = join(outDir, '.build-packs-runner.mjs');

try {
  await build({
    entryPoints: [resolve('tools/packs/build.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    outfile: bundlePath,
    logLevel: 'error',
    packages: 'external'
  });

  const { buildAllPacks } = await import(pathToFileURL(bundlePath).href);
  const results = await buildAllPacks(resolve('content/packs'), outDir);

  console.log(`\nتم بناء حزم المحتوى بنجاح (${results.length} حزمة):`);
  for (const r of results) {
    console.log(
      `  ✓ [${r.id}] «${r.title}» — ${r.counts.templates} نماذج، ${r.counts.clips} كليشات (SHA-256: ${r.sha256.slice(0, 12)}...)`
    );
  }
} finally {
  rmSync(bundlePath, { force: true });
}
