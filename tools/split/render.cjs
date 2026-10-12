/**
 * نقل مقاطع العرض من شاشةٍ إلى مكوّناتٍ في ملفّاتها (تقسيم الشاشات بعد ١٫٧٫٠) — **حرفيًّا**: المقطع ينتقل كما هو، وما يأخذه من الشاشة
 * يمرّ إليه **بأسمائه نفسها**، وأنواعه **من مدقّق TypeScript نفسه** لا تُكتب باليد، واستيراداته من استيرادات الشاشة.
 *
 *   node tools/split/render.cjs spec.json        (من جذر المستودع؛ ثم tools/split/prune.cjs ثم npm run typecheck)
 *
 * spec: { src, component, outDir, blocks: [ … ] } — ولكلّ مقطع: { name, doc: [أسطر الوصف], … } وواحدٌ من:
 *   - after: سطرٌ وحيد (تعليق القسم، أو `{x && (`)؛ والمقطع العنصر الذي يليه إلى إغلاقه. و`nth` لعلامةٍ متكرّرة (من الصفر).
 *   - start: أوّل سطرٍ في المقطع نفسه (و`nth` إن تكرّر).
 *   - from + to: مدًى من سطرٍ إلى سطر (عناصر متجاورة) يُلفّ في `<>…</>`.
 *   و`overrides`: { اسم: نوع } لقيمةٍ ضُيّقت في فرعها (مثل `detail` بعد `detail === null ? …`).
 * والسطر يُقارَن بعد حذف مسافات بدايته. وما في مستوى وحدة الشاشة يُنقل أوّلًا إلى ملفٍّ مشترك ويُستورد (فيعرفه المقطع استيرادًا).
 */
const fs = require('fs');
const path = require('path');
const ts = require(require.resolve('typescript', { paths: [process.cwd()] }));

const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const ROOT = process.cwd();
const SRC = path.resolve(spec.src);
const raw = fs.readFileSync(SRC, 'utf8');
const CRLF = raw.includes('\r\n');
const text = raw.replace(/\r\n/g, '\n');
const lines = text.split('\n');

// ── البرنامج: الملفّ كما هو (بنهايات LF، فالمواضع تطابق `text`) ──
const cfg = ts.parseJsonConfigFileContent(ts.readConfigFile(path.join(ROOT, 'tsconfig.web.json'), ts.sys.readFile).config, ts.sys, ROOT);
const host = ts.createCompilerHost(cfg.options);
const origGet = host.getSourceFile;
host.getSourceFile = (f, lang, ...rest) => (path.resolve(f) === SRC ? ts.createSourceFile(f, text, lang, true) : origGet(f, lang, ...rest));
const program = ts.createProgram({ rootNames: cfg.fileNames, options: cfg.options, host });
const checker = program.getTypeChecker();
const sf = program.getSourceFiles().find((s) => path.resolve(s.fileName) === SRC);
if (!sf) throw new Error('لم يُوجد الملفّ في البرنامج (tsconfig.web.json)');

// ── استيرادات الشاشة: الاسم ← الوحدة، وأهو نوعٌ وحده ──
const imports = new Map();
for (const st of sf.statements) {
  if (!ts.isImportDeclaration(st) || !st.importClause) continue;
  const mod = st.moduleSpecifier.text;
  const c = st.importClause;
  if (c.name) imports.set(c.name.text, { mod, kind: 'default', typeOnly: c.isTypeOnly });
  const nb = c.namedBindings;
  if (nb && ts.isNamedImports(nb))
    for (const el of nb.elements) imports.set(el.name.text, { mod, kind: 'named', typeOnly: c.isTypeOnly || el.isTypeOnly, orig: el.propertyName?.text });
  if (nb && ts.isNamespaceImport(nb)) imports.set(nb.name.text, { mod, kind: 'ns', typeOnly: c.isTypeOnly });
}

// ── المكوّن ──
let comp = null;
(function find(n) {
  if (comp) return;
  if ((ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n)) && n.name?.text === spec.component) comp = n;
  else if (ts.isVariableDeclaration(n) && n.name.getText?.(sf) === spec.component) comp = n;
  ts.forEachChild(n, find);
})(sf);
if (!comp) throw new Error(`لا مكوّن باسم ${spec.component}`);
const compStart = comp.getStart(sf);
const compEnd = comp.getEnd();

const lineStart = (i) => lines.slice(0, i).reduce((a, s) => a + s.length + 1, 0);
const indentOf = (s) => s.length - s.trimStart().length;
const hitsOf = (t) => lines.map((x, i) => (x.trim() === t.trim() ? i : -1)).filter((i) => i >= 0);

function blockRange(b) {
  if (b.from) {
    const uniq = (t) => {
      const h = hitsOf(t);
      if (h.length !== 1) throw new Error(`«${t}» ${h.length} مرّة`);
      return h[0];
    };
    const f = uniq(b.from);
    return { i0: f, i1: uniq(b.to), ind: indentOf(lines[f]), wrap: true };
  }
  let i0;
  if (b.after) {
    const hits = hitsOf(b.after);
    if (b.nth === undefined && hits.length !== 1) throw new Error(`العلامة «${b.after}» ${hits.length} مرّة`);
    if (hits[b.nth ?? 0] === undefined) throw new Error(`لا علامة رقم ${b.nth}: ${b.after}`);
    i0 = hits[b.nth ?? 0] + 1;
    while (!lines[i0].trim()) i0++;
  } else i0 = hitsOf(b.start)[b.nth ?? 0];
  if (i0 === undefined) throw new Error(`لا سطر: ${b.start}`);
  const ind = indentOf(lines[i0]);
  // حدّ المقطع من شجرة الملفّ: العنصر الذي يبدأ في هذا السطر إلى إغلاقه — لا بالإزاحة (بعض الملفّات إزاحتها غير منتظمة).
  const pos = lineStart(i0) + ind;
  let node = null;
  (function find(n) {
    if (n.getStart(sf) === pos && (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) && (!node || n.getEnd() > node.getEnd())) node = n;
    if (n.getStart(sf) <= pos && n.getEnd() >= pos) ts.forEachChild(n, find);
  })(sf);
  if (!node) throw new Error(`لا عنصر JSX يبدأ في السطر ${i0 + 1}: ${lines[i0].trim()}`);
  const i1 = sf.getLineAndCharacterOfPosition(node.getEnd()).line;
  return { i0, i1, ind };
}

const FLAGS = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseSingleQuotesForStringLiteralType;
const extraTypes = new Map(); // نوعٌ لم تستورده الشاشة ← ملفّه

const typeText = (sym, decl, override) =>
  (override ?? checker.typeToString(checker.getTypeOfSymbolAtLocation(sym, decl.name ?? decl), sf, FLAGS))
    .replace(/import\("[^"]*@types\/react\/index"\)\./g, '')
    .replace(/import\("([^"]+)"\)\.(\w+)/g, (_m, abs, name) => {
      extraTypes.set(name, abs);
      return name;
    });

function analyze(i0, i1, overrides) {
  const p0 = lineStart(i0);
  const p1 = lineStart(i1) + lines[i1].length;
  const props = new Map();
  const used = new Set();
  const locals = new Set();
  const consider = (id) => {
    const p = id.parent;
    if (ts.isPropertyAccessExpression(p) && p.name === id) return;
    if (ts.isQualifiedName(p) && p.right === id) return;
    if ((ts.isPropertyAssignment(p) || ts.isPropertySignature(p) || ts.isMethodDeclaration(p)) && p.name === id) return;
    if (ts.isJsxAttribute(p) && p.name === id) return;
    if (ts.isBindingElement(p) && p.propertyName === id) return;
    if (ts.isJsxClosingElement(p)) return;
    const sym = ts.isShorthandPropertyAssignment(p) && p.name === id ? checker.getShorthandAssignmentValueSymbol(p) : checker.getSymbolAtLocation(id);
    const decl = sym?.declarations?.[0];
    if (!decl || decl.getSourceFile() !== sf) return; // عامٌّ أو من غيرها
    const dp = decl.getStart(sf);
    if (dp >= p0 && dp <= p1) return; // مُعرَّفٌ داخل المقطع
    if (ts.isImportSpecifier(decl) || ts.isImportClause(decl) || ts.isNamespaceImport(decl)) return void used.add(id.text);
    if (dp >= compStart && dp <= compEnd) {
      if (!props.has(id.text)) props.set(id.text, typeText(sym, decl, overrides[id.text]));
      return;
    }
    locals.add(id.text);
  };
  (function visit(n) {
    if (n.getEnd() < p0 || n.getStart(sf) > p1) return;
    if (ts.isIdentifier(n) && n.getStart(sf) >= p0 && n.getEnd() <= p1) consider(n);
    ts.forEachChild(n, visit);
  })(sf);
  return { props, used, locals };
}

const REACT_TYPES = ['Dispatch', 'SetStateAction', 'MutableRefObject', 'RefObject', 'ReactNode', 'ReactElement', 'CSSProperties', 'Ref'];

function relFrom(outFile, mod) {
  if (!mod.startsWith('.')) return mod;
  const r = path.relative(path.dirname(outFile), path.resolve(path.dirname(SRC), mod)).replace(/\\/g, '/');
  return r.startsWith('.') ? r : './' + r;
}

function importLines(outFile, names, typeNames) {
  const byMod = new Map();
  const add = (name, typeOnly) => {
    const im = imports.get(name);
    if (!im) return;
    const mod = relFrom(outFile, im.mod);
    if (!byMod.has(mod)) byMod.set(mod, { def: null, defType: false, named: [], ns: null });
    const e = byMod.get(mod);
    if (im.kind === 'default') {
      e.def = name;
      e.defType = typeOnly && im.typeOnly;
    } else if (im.kind === 'ns') e.ns = name;
    else if (!e.named.some((x) => x.name === name)) e.named.push({ name, orig: im.orig, typeOnly: typeOnly || im.typeOnly });
  };
  for (const n of names) add(n, false);
  for (const n of typeNames) if (!names.has(n)) add(n, true);
  const out = [];
  for (const [mod, e] of byMod) {
    const allType = !e.def && !e.ns && e.named.every((x) => x.typeOnly);
    const named = e.named.map((x) => `${x.typeOnly && !allType ? 'type ' : ''}${x.orig ? `${x.orig} as ` : ''}${x.name}`).join(', ');
    if (e.ns) out.push(`import * as ${e.ns} from '${mod}';`);
    if (allType && named) out.push(`import type { ${named} } from '${mod}';`);
    else if (e.def && named) out.push(`import ${e.def}, { ${named} } from '${mod}';`);
    else if (e.def) out.push(`import ${e.defType ? 'type ' : ''}${e.def} from '${mod}';`);
    else if (named) out.push(`import { ${named} } from '${mod}';`);
  }
  return out;
}

function extraImports(outFile, text) {
  const out = [];
  const shared = path.resolve(ROOT, 'src/shared');
  for (const [name, abs] of extraTypes) {
    if (imports.has(name) || !new RegExp('(?<![\\w.])' + name + '(?![\\w])').test(text)) continue;
    const absPath = path.resolve(abs);
    let mod = absPath.startsWith(shared)
      ? '@shared/' + path.relative(shared, absPath).replace(/\\/g, '/')
      : path.relative(path.dirname(outFile), absPath).replace(/\\/g, '/');
    if (!mod.startsWith('.') && !mod.startsWith('@')) mod = './' + mod;
    out.push(`import type { ${name} } from '${mod.replace(/\.tsx?$/, '')}';`);
  }
  return out;
}

const results = spec.blocks.map((b) => {
  const r = blockRange(b);
  const a = analyze(r.i0, r.i1, b.overrides ?? {});
  for (const k of Object.keys(b.overrides ?? {})) if (!a.props.has(k)) throw new Error(`${b.name}: «${k}» ليس ممّا يمرّ`);
  if (a.locals.size) throw new Error(`${b.name}: يستعمل من مستوى الوحدة ${[...a.locals].join('، ')} — انقله إلى ملفٍّ مشترك أوّلًا`);
  return { b, ...r, ...a };
});
const sorted = [...results].sort((x, y) => x.i0 - y.i0);
for (let k = 1; k < sorted.length; k++) if (sorted[k].i0 <= sorted[k - 1].i1) throw new Error(`مقطعان متداخلان: ${sorted[k - 1].b.name} و${sorted[k].b.name}`);
const lastImportDecl = sf.statements.filter((s) => ts.isImportDeclaration(s)).pop();
const lastImport = sf.getLineAndCharacterOfPosition(lastImportDecl.getEnd()).line;
if (results.some((r) => r.i0 <= lastImport)) throw new Error('مقطعٌ قبل آخر استيراد');

fs.mkdirSync(path.resolve(spec.outDir), { recursive: true });
const report = [];
for (const r of results) {
  const outFile = path.resolve(spec.outDir, `${r.b.name}.tsx`);
  const props = [...r.props.entries()];
  const types = props.map(([, t]) => t).join(' ');
  const typeNames = new Set([...types.matchAll(/(?<![\w.'"])([A-Z][A-Za-z0-9_]*)\b/g)].map((m) => m[1]));
  // أنواع React: ما لم تستورده الشاشة، أو ما استوردته من 'react' نفسها.
  const reactNamed = REACT_TYPES.filter((n) => typeNames.has(n) && (!imports.has(n) || imports.get(n).mod === 'react'));
  // الإزاحة من أقلّ أسطر المقطع إزاحةً — فما كُتب أقلّ من أوّله يبقى في مكانه نسبيًّا.
  const minInd = Math.min(...lines.slice(r.i0, r.i1 + 1).filter((s) => s.trim()).map(indentOf));
  const shift = minInd - (r.wrap ? 6 : 4);
  const body = lines.slice(r.i0, r.i1 + 1).map((s) => {
    if (!s.trim()) return '';
    if (shift < 0) return ' '.repeat(-shift) + s;
    if (s.slice(0, shift).trim()) throw new Error(`${r.b.name}: إزاحةٌ أقلّ من المتوقّع: ${s}`);
    return s.slice(shift);
  });
  fs.writeFileSync(
    outFile,
    [
      '/**',
      ...r.b.doc.map((d) => ` * ${d}`),
      ' */',
      ...(reactNamed.length ? [`import type { ${reactNamed.join(', ')} } from 'react';`] : []),
      ...importLines(outFile, new Set([...r.used].filter((n) => !reactNamed.includes(n))), new Set([...typeNames].filter((n) => !REACT_TYPES.includes(n)))),
      ...extraImports(outFile, types),
      '',
      'type Props = {',
      ...props.map(([n, t]) => `  ${n}: ${t};`),
      '};',
      '',
      `export default function ${r.b.name}(${props.length ? `{ ${props.map(([n]) => n).join(', ')} }: Props` : ''}) {`,
      '  return (',
      ...(r.wrap ? ['    <>', ...body, '    </>'] : body),
      '  );',
      '}',
      ''
    ].join('\n')
  );
  report.push(`${r.b.name}: ${r.i1 - r.i0 + 1} سطرًا، ${props.length} قيمة`);
  const pad = ' '.repeat(r.ind);
  r.usage = props.length ? [`${pad}<${r.b.name}`, ...props.map(([n]) => `${pad}  ${n}={${n}}`), `${pad}/>`] : [`${pad}<${r.b.name} />`];
}

for (const r of [...results].sort((x, y) => y.i0 - x.i0)) lines.splice(r.i0, r.i1 - r.i0 + 1, ...r.usage);
const relDir = path.relative(path.dirname(SRC), path.resolve(spec.outDir)).replace(/\\/g, '/');
const prefix = relDir ? `./${relDir}/` : './';
lines.splice(lastImport + 1, 0, ...results.map((r) => `import ${r.b.name} from '${prefix}${r.b.name}';`));
fs.writeFileSync(SRC, CRLF ? lines.join('\n').replace(/\n/g, '\r\n') : lines.join('\n'));
console.log(report.join('\n'));
console.log(`الشاشة: ${lines.length} سطرًا`);
