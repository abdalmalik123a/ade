/**
 * نقل منطقٍ من شاشةٍ إلى خطّافٍ في ملفّه (تقسيم الشاشات بعد ١٫٧٫٠) — **حرفيًّا**: الجمل تنتقل كما هي إلى `function useX(ctx)`، وما تأخذه
 * من الشاشة يمرّ في `ctx` **بأسمائه وأنواعه من مدقّق TypeScript**، وما تستعمله الشاشة ممّا عرّفته يُعاد؛ والنداء في موضع المقطع نفسه.
 *
 *   node tools/split/hook.cjs spec.json        (من جذر المستودع؛ ثم tools/split/prune.cjs ثم npm run typecheck)
 *
 * spec: { src, component, outFile, name, from, to | toBlockOf, doc: [..], comment?, overrides?, moveLocals? }
 *   - from: أوّل سطرٍ في المقطع؛ to: آخره — أو toBlockOf: أوّل سطر الدالّة الأخيرة، والمقطع إلى ما يُغلقها.
 *   - withDoc: true — والتعليق الملاصق فوق `from` ينتقل معه.
 *   - comment: تعليقٌ يسبق النداء في الشاشة. moveLocals: متغيّراتٌ في مستوى الوحدة يكتب فيها المقطع — تنتقل معه (لا يُكتب في مستورَد).
 * **ويتوقّف** إن كان النداء سيقرأ قيمةً قبل تعريفها (`const` بعد موضعه)، أو تستعمل الشاشة ممّا يعيده شيئًا قبل موضعه خارج دالّة —
 * وكلاهما خطأٌ يقع وقت الرسم لا وقت البناء.
 */
const fs = require('fs');
const path = require('path');
const ts = require(require.resolve('typescript', { paths: [process.cwd()] }));

const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const ROOT = process.cwd();
const SRC = path.resolve(spec.src);
const OUT = path.resolve(spec.outFile);
const raw = fs.readFileSync(SRC, 'utf8');
const CRLF = raw.includes('\r\n');
const text = raw.replace(/\r\n/g, '\n');
const lines = text.split('\n');

const cfg = ts.parseJsonConfigFileContent(ts.readConfigFile(path.join(ROOT, 'tsconfig.web.json'), ts.sys.readFile).config, ts.sys, ROOT);
const host = ts.createCompilerHost(cfg.options);
const origGet = host.getSourceFile;
host.getSourceFile = (f, lang, ...rest) => (path.resolve(f) === SRC ? ts.createSourceFile(f, text, lang, true) : origGet(f, lang, ...rest));
const program = ts.createProgram({ rootNames: cfg.fileNames, options: cfg.options, host });
const checker = program.getTypeChecker();
const sf = program.getSourceFiles().find((s) => path.resolve(s.fileName) === SRC);
if (!sf) throw new Error('لم يُوجد الملفّ في البرنامج (tsconfig.web.json)');

const imports = new Map();
for (const st of sf.statements) {
  if (!ts.isImportDeclaration(st) || !st.importClause) continue;
  const mod = st.moduleSpecifier.text;
  const c = st.importClause;
  if (c.name) imports.set(c.name.text, { mod, kind: 'default', typeOnly: c.isTypeOnly });
  if (c.namedBindings && ts.isNamedImports(c.namedBindings))
    for (const el of c.namedBindings.elements) imports.set(el.name.text, { mod, kind: 'named', typeOnly: c.isTypeOnly || el.isTypeOnly, orig: el.propertyName?.text });
}

let comp = null;
(function find(n) {
  if (comp) return;
  if ((ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n)) && n.name?.text === spec.component) comp = n;
  ts.forEachChild(n, find);
})(sf);
if (!comp) throw new Error(`لا مكوّن باسم ${spec.component}`);

const one = (t) => {
  const hits = lines.map((s, i) => (s.trim() === t.trim() ? i : -1)).filter((i) => i >= 0);
  if (hits.length !== 1) throw new Error(`«${t}» ${hits.length} مرّة`);
  return hits[0];
};
const indentOf = (s) => s.length - s.trimStart().length;
// withDoc: والتعليق الملاصق فوق أوّل المقطع (`/** … */` أو `//`) يذهب معه.
const i0 = (() => {
  let i = one(spec.from);
  if (spec.withDoc) while (i > 0 && /^(\/\*\*|\*|\*\/|\/\/)/.test(lines[i - 1].trim())) i--;
  return i;
})();
const i1 = (() => {
  if (spec.to) return one(spec.to);
  const s = one(spec.toBlockOf);
  for (let j = s + 1; j < lines.length; j++) if (lines[j].trim() && indentOf(lines[j]) === indentOf(lines[s])) return j;
  throw new Error('دالّةٌ بلا نهاية');
})();
const lineStart = (i) => lines.slice(0, i).reduce((a, s) => a + s.length + 1, 0);
const p0 = lineStart(i0);
const p1 = lineStart(i1) + lines[i1].length;

// ما يُعرَّف في أعلى المقطع
const declared = new Map();
for (const st of comp.body.statements.filter((s) => s.getStart(sf) >= p0 && s.getEnd() <= p1 + 1)) {
  if (ts.isFunctionDeclaration(st) && st.name) declared.set(st.name.text, st.name);
  if (ts.isVariableStatement(st))
    for (const d of st.declarationList.declarations)
      (function collect(n) {
        if (ts.isIdentifier(n)) declared.set(n.text, n);
        else if (ts.isObjectBindingPattern(n) || ts.isArrayBindingPattern(n)) n.elements.forEach((e) => e.name && collect(e.name));
      })(d.name);
}

const FLAGS = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseSingleQuotesForStringLiteralType;
const extraTypes = new Map(); // نوعٌ لم تستورده الشاشة ← ملفّه
const ctx = new Map();
const used = new Set();
const returns = new Set();
const problems = [];
const inFunction = (node) => {
  for (let n = node.parent; n && n !== comp; n = n.parent)
    if (ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isMethodDeclaration(n)) return true;
  return false;
};
const isRef = (id) => {
  const p = id.parent;
  if (ts.isPropertyAccessExpression(p) && p.name === id) return false;
  if (ts.isQualifiedName(p) && p.right === id) return false;
  if ((ts.isPropertyAssignment(p) || ts.isPropertySignature(p) || ts.isMethodDeclaration(p)) && p.name === id) return false;
  if (ts.isJsxAttribute(p) && p.name === id) return false;
  if (ts.isBindingElement(p) && p.propertyName === id) return false;
  return true;
};
const symOf = (id) => (ts.isShorthandPropertyAssignment(id.parent) && id.parent.name === id ? checker.getShorthandAssignmentValueSymbol(id.parent) : checker.getSymbolAtLocation(id));

(function walk(n) {
  if (ts.isIdentifier(n) && isRef(n)) {
    const pos = n.getStart(sf);
    const sym = symOf(n);
    const decl = sym?.declarations?.[0];
    if (decl && decl.getSourceFile() === sf) {
      const dp = decl.getStart(sf);
      const inside = pos >= p0 && pos <= p1;
      const declInside = dp >= p0 && dp <= p1;
      if (inside && !declInside) {
        if (ts.isImportSpecifier(decl) || ts.isImportClause(decl)) used.add(n.text);
        else if (dp >= comp.getStart(sf) && dp <= comp.getEnd()) {
          if (!ctx.has(n.text)) {
            const t = (spec.overrides?.[n.text] ?? checker.typeToString(checker.getTypeOfSymbolAtLocation(sym, decl.name ?? decl), sf, FLAGS))
              .replace(/import\("[^"]*@types\/react\/index"\)\./g, '')
              // نوعٌ بمساره الكامل من ملفٍّ في المستودع: اسمه، ويُستورد من ملفّه.
              .replace(/import\("([^"]+)"\)\.(\w+)/g, (_m, abs, name) => {
                extraTypes.set(name, abs);
                return name;
              });
            ctx.set(n.text, t);
            // يُقرأ عند النداء: يجب أن يُعرَّف قبله — إلا دالّةً مرفوعة.
            if (!ts.isFunctionDeclaration(decl) && dp > p0) problems.push(`«${n.text}» يُعرَّف بعد موضع النداء`);
          }
        } else if (!(spec.moveLocals ?? []).includes(n.text)) problems.push(`«${n.text}» من مستوى الوحدة — انقله أوّلًا، أو اذكره في moveLocals`);
      }
      if (!inside && declInside && declared.has(n.text) && sym === symOf(declared.get(n.text))) {
        returns.add(n.text);
        if (pos < p0 && !inFunction(n)) problems.push(`«${n.text}» تستعمله الشاشة قبل موضع النداء خارج دالّة`);
      }
    }
  }
  ts.forEachChild(n, walk);
})(sf);
if (problems.length) throw new Error('لا يُنقل:\n' + [...new Set(problems)].join('\n'));

// ── الاستيرادات ──
const relFrom = (mod) => {
  if (!mod.startsWith('.')) return mod;
  const r = path.relative(path.dirname(OUT), path.resolve(path.dirname(SRC), mod)).replace(/\\/g, '/');
  return r.startsWith('.') ? r : './' + r;
};
const typeNames = new Set([...[...ctx.values()].join(' ').matchAll(/(?<![\w.'"])([A-Z][A-Za-z0-9_]*)\b/g)].map((m) => m[1]));
const reactTypes = ['Dispatch', 'SetStateAction', 'MutableRefObject', 'RefObject', 'ReactNode'].filter((n) => typeNames.has(n) && !imports.has(n));
const byMod = new Map();
const add = (name, typeOnly) => {
  const im = imports.get(name);
  if (!im) return;
  const mod = relFrom(im.mod);
  if (!byMod.has(mod)) byMod.set(mod, { def: null, named: [] });
  const e = byMod.get(mod);
  if (im.kind === 'default') e.def = name;
  else if (!e.named.some((x) => x.name === name)) e.named.push({ name, orig: im.orig, typeOnly: typeOnly || im.typeOnly });
};
for (const n of used) add(n, false);
for (const n of typeNames) if (!used.has(n)) add(n, true);
// أنواعٌ لم تستوردها الشاشة (React، وما طبعه المدقّق بمساره) — تُضمّ إلى سطر وحدتها لا سطرًا لكلّ نوع.
const addType = (mod, name) => {
  if (!byMod.has(mod)) byMod.set(mod, { def: null, named: [] });
  const e = byMod.get(mod);
  if (!e.named.some((x) => x.name === name)) e.named.push({ name, typeOnly: true });
};
for (const n of reactTypes) addType('react', n);
for (const [name, abs] of extraTypes) {
  if (imports.has(name)) continue;
  const shared = path.resolve(ROOT, 'src/shared');
  const absPath = path.resolve(abs);
  let mod = absPath.startsWith(shared) ? '@shared/' + path.relative(shared, absPath).split(path.sep).join('/') : path.relative(path.dirname(OUT), absPath).split(path.sep).join('/');
  if (!mod.startsWith('.') && !mod.startsWith('@')) mod = './' + mod;
  addType(mod.replace(/[.]tsx?$/, ''), name);
}
const impLines = [];
for (const [mod, e] of byMod) {
  const allType = !e.def && e.named.every((x) => x.typeOnly);
  const named = e.named.map((x) => `${!allType && x.typeOnly ? 'type ' : ''}${x.orig ? `${x.orig} as ` : ''}${x.name}`).join(', ');
  if (allType) impLines.push(`import type { ${named} } from '${mod}';`);
  else if (e.def && named) impLines.push(`import ${e.def}, { ${named} } from '${mod}';`);
  else if (e.def) impLines.push(`import ${e.def} from '${mod}';`);
  else impLines.push(`import { ${named} } from '${mod}';`);
}

// ── ما ينتقل مع المقطع من مستوى الوحدة ──
const moved = [];
for (const name of spec.moveLocals ?? []) {
  const at = lines.findIndex((s) => new RegExp(`^(let|const) ${name}\\b`).test(s));
  if (at < 0) throw new Error(`لا تعريف لـ${name}`);
  if (at > i0) throw new Error(`${name} بعد المقطع`);
  let from = at;
  while (from > 0 && /^\s*(\/\*\*|\*|\/\/)/.test(lines[from - 1])) from--;
  moved.push(...lines.slice(from, at + 1));
}

const names = [...ctx.keys()];
const rets = [...returns];
const list = (head, items, tail, ind) => {
  if ((head + items.join(', ') + tail).length + ind <= 140) return [' '.repeat(ind) + head + items.join(', ') + tail];
  const out = [' '.repeat(ind) + head.trimEnd()];
  let cur = '';
  for (const it of items) {
    if ((cur + it).length > 130) {
      out.push(' '.repeat(ind + 2) + cur.trimEnd());
      cur = '';
    }
    cur += it + ', ';
  }
  out.push(' '.repeat(ind + 2) + cur.replace(/, $/, ''));
  out.push(' '.repeat(ind) + tail.trimStart());
  return out;
};
fs.writeFileSync(
  OUT,
  [
    '/**',
    ...spec.doc.map((d) => ` * ${d}`),
    ' */',
    ...impLines,
    ...(moved.length ? ['', ...moved] : []),
    '',
    `export function ${spec.name}(`,
    '  ctx: {',
    ...names.map((n) => `    ${n}: ${ctx.get(n)};`),
    '  }',
    ') {',
    ...list('const { ', names, ' } = ctx;', 2),
    '',
    ...lines.slice(i0, i1 + 1),
    ...(rets.length ? ['', ...list('return { ', rets, ' };', 2)] : []),
    '}',
    ''
  ].join('\n')
);

// النداء في موضع المقطع: على سطرٍ إن وسعه، وإلا أسطرًا
// وخطّافٌ لا يعيد شيئًا (أثرٌ وحده) يُنادى بلا تفكيك.
const head = rets.length ? `  const { ${rets.join(', ')} } = ${spec.name}({` : `  ${spec.name}({`;
const call = (() => {
  if ((head + ' ' + names.join(', ') + ' });').length <= 140) return [`${head} ${names.join(', ')} });`];
  const out = [head];
  let cur = '    ';
  for (const n of names) {
    if ((cur + n).length > 130) {
      out.push(cur.trimEnd());
      cur = '    ';
    }
    cur += n + ', ';
  }
  out.push(cur.replace(/, $/, ''), '  });');
  return out;
})();
lines.splice(i0, i1 - i0 + 1, ...(spec.comment ? [`  // ${spec.comment}`] : []), ...call);
for (const m of moved) lines.splice(lines.indexOf(m), 1);
const lastImport = sf.getLineAndCharacterOfPosition(sf.statements.filter((s) => ts.isImportDeclaration(s)).pop().getEnd()).line;
const rel = path.relative(path.dirname(SRC), OUT).replace(/\\/g, '/').replace(/\.tsx?$/, '');
lines.splice(lastImport + 1, 0, `import { ${spec.name} } from '${rel.startsWith('.') ? rel : './' + rel}';`);
fs.writeFileSync(SRC, CRLF ? lines.join('\n').replace(/\n/g, '\r\n') : lines.join('\n'));
console.log(`${spec.name}: ${i1 - i0 + 1} سطرًا، يأخذ ${names.length} ويعيد ${rets.length} (${rets.join('، ')})`);
console.log(`الشاشة: ${lines.length} سطرًا`);
