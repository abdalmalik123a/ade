/**
 * هيكل التصاميم (DESIGNS.md ٠٫١ و٣٫٤) — يُبنى على اختبار الهيكل العامّ (`structure.test.ts`، ز١) ويزيد عليه ما يخصّ
 * التصاميم، فلا تتكاثر الشيفرة في ملفٍّ واحد ولا يُخلّ تعديلٌ بالجميع (قيد المالك الأوّل):
 *
 * ١. **الحجم**: ملفٌّ في مجلّدات التصاميم **٤٠٠ سطر** أقصاه، **والمكوّن (`.tsx`) ٣٠٠**. وما يتجاوزه اليوم في
 *    `designStructure.allow.json` بحجمه — قائمةٌ **تتناقص حتى تفرغ بنهاية المرحلة صفر، ولا يُضاف إليها شيء**، ولا ينمو
 *    ملفٌّ فيها. و`DIWAN_DESIGN_RATCHET=1 npx vitest run tests/designStructure.test.ts` يكتب الأحجام الأصغر ويُسقط ما
 *    نزل تحت حدّه.
 * ٢. **النواة** (`shared/design` والأنواع الجاهزة واللوحة والرسّام والهندسة والترتيب على الورق والدفعات) لا تستورد React
 *    ولا Electron ولا Node ولا الواجهة ولا العملية الرئيسة — تعمل في العمليّتين وفي الاختبار.
 * ٣. **أنواع العناصر لا يستورد بعضها بعضًا** (`shared/design/kinds/*`): تعديل نوعٍ لا يمسّ غيره — إلا السجلّ وأنواعه
 *    المشتركة (`registry` و`types` و`index`).
 *
 * و«الواجهة لا تستورد خدمةً من العملية الرئيسة» يحرسها الاختبار العامّ للبرنامج كلّه.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..');
const ALLOW_FILE = join(__dirname, 'designStructure.allow.json');
const FILE_CAP = 400;
const COMPONENT_CAP = 300;

const rel = (p: string) => relative(ROOT, p).replace(/\\/g, '/');
const walk = (dir: string): string[] =>
  !existsSync(dir)
    ? []
    : readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
      });
const file = (p: string) => (existsSync(join(ROOT, p)) ? [join(ROOT, p)] : []);

/** نواة التصاميم المشتركة: اليوم ملفّاتٌ في `shared`، وغدًا `shared/design` و`fonts` و`assets` (DESIGNS.md ٣٫٢). */
const CORE = [
  ...walk(join(ROOT, 'src/shared/design')),
  ...walk(join(ROOT, 'src/shared/designKit')),
  ...walk(join(ROOT, 'src/shared/fonts')),
  ...walk(join(ROOT, 'src/shared/assets')),
  ...['canvas.ts', 'canvasHtml.ts', 'canvasEdit.ts', 'canvasFit.ts', 'imposition.ts', 'batch.ts', 'layerFields.ts', 'clipart.ts'].flatMap((n) => file(`src/shared/${n}`))
];

/** مجلّدات التصاميم كلّها: النواة، والواجهة، والخدمات. */
const DESIGN_FILES = [
  ...CORE,
  ...walk(join(ROOT, 'src/renderer/src/designs')),
  ...file('src/renderer/src/screens/DesignsScreen.tsx'),
  ...walk(join(ROOT, 'src/main/services/design')),
  ...file('src/main/services/psdLayers.ts'),
  ...file('src/main/services/designImport.ts'),
  ...file('src/main/ipc/designs.ts')
].map((abs) => ({ abs, path: rel(abs), text: readFileSync(abs, 'utf8') }));

const lineCount = (text: string) => text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
const capOf = (path: string) => (path.endsWith('.tsx') ? COMPONENT_CAP : FILE_CAP);

function importsOf(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?\sfrom\s*['"]([^'"]+)['"]/g)) out.push(m[1]!);
  for (const m of text.matchAll(/\b(?:import|require)\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(m[1]!);
  return out;
}
const NODE = new Set(builtinModules);

describe('هيكل التصاميم (DESIGNS.md ٠٫١)', () => {
  it('١ — الحجم: ٤٠٠ سطر للملفّ و٣٠٠ للمكوّن، والاستثناء يتناقص ولا يزيد', () => {
    const allow: Record<string, number> = existsSync(ALLOW_FILE) ? (JSON.parse(readFileSync(ALLOW_FILE, 'utf8')) as Record<string, number>) : {};
    const sizes = DESIGN_FILES.map((f) => ({ path: f.path, n: lineCount(f.text), cap: capOf(f.path) }));
    if (process.env['DIWAN_DESIGN_RATCHET'] === '1') {
      const first = !existsSync(ALLOW_FILE);
      const next: Record<string, number> = {};
      for (const s of [...sizes].sort((a, b) => (a.path < b.path ? -1 : 1))) {
        if (s.n <= s.cap) continue;
        if (first) next[s.path] = s.n;
        else if (allow[s.path] !== undefined) next[s.path] = Math.min(allow[s.path]!, s.n);
      }
      writeFileSync(ALLOW_FILE, `${JSON.stringify(next, null, 2)}\n`);
      return;
    }
    const bad: string[] = [];
    for (const s of sizes) {
      const listed = allow[s.path];
      if (listed === undefined && s.n > s.cap) bad.push(`${s.path}: ${s.n} سطرًا — وحدّه ${s.cap}؛ قسّمه (لا يُضاف إلى الاستثناء)`);
      else if (listed !== undefined && s.n > listed) bad.push(`${s.path}: نما إلى ${s.n} سطرًا واستثناؤه ${listed} — الاستثناء يتناقص ولا يزيد`);
    }
    expect(bad).toEqual([]);
  });

  it('٢ — النواة لا تستورد React ولا Electron ولا Node ولا الواجهة ولا العملية الرئيسة', () => {
    const bad: string[] = [];
    for (const f of DESIGN_FILES.filter((x) => CORE.includes(x.abs))) {
      for (const spec of importsOf(f.text)) {
        const to = spec.startsWith('.') ? rel(resolve(dirname(f.abs), spec)) : '';
        if (spec === 'react' || spec.startsWith('react/') || spec === 'react-dom' || spec === 'electron' || spec.startsWith('node:') || NODE.has(spec.split('/')[0]!)) {
          bad.push(`${f.path}: نواة التصاميم تستورد «${spec}» — تعمل في العمليّتين وفي الاختبار بلا واجهةٍ ولا Node`);
        } else if (to.startsWith('src/renderer') || to.startsWith('src/main') || to.startsWith('src/preload')) {
          bad.push(`${f.path}: نواة التصاميم تستورد «${spec}» من الواجهة أو العملية الرئيسة`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('٣ — أنواع العناصر لا يستورد بعضها بعضًا', () => {
    const KINDS = join(ROOT, 'src/shared/design/kinds');
    const SHARED = new Set(['registry', 'types', 'index']);
    const bad: string[] = [];
    for (const f of DESIGN_FILES.filter((x) => x.abs.startsWith(KINDS + (process.platform === 'win32' ? '\\' : '/')))) {
      for (const spec of importsOf(f.text)) {
        if (!spec.startsWith('.')) continue;
        const target = resolve(dirname(f.abs), spec);
        if (dirname(target) === KINDS && !SHARED.has(basename(target).replace(/\.(ts|tsx)$/, ''))) {
          bad.push(`${f.path}: نوعٌ يستورد نوعًا آخر «${spec}» — ما يشتركان فيه مكانه السجلّ أو الأنواع المشتركة`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
