/**
 * نقل تعريفاتٍ كاملة من مستوى وحدة ملفٍّ (مكوّنٌ فرعيّ، دالّة، ثابت، نوع) إلى ملفٍّ جديد — كما هي بتعليقاتها (تقسيم الشاشات بعد ١٫٧٫٠).
 * يُصدَّر المنقول، ويُستورد في الأصل ما بقي يستعمله، ويأخذ الملفّ الجديد من استيرادات الأصل ما يحتاجه.
 *
 *   node tools/split/move.cjs spec.json        (من جذر المستودع؛ ثم tools/split/prune.cjs ثم npm run typecheck)
 *
 * spec: { src, outFile, names: [..], doc: [أسطر رأس الملفّ الجديد], tsconfig?: البرنامج ('tsconfig.web.json' إن غاب، و'tsconfig.node.json' لـmain), fromSrc?: true — ما يستعمله المنقول من الأصل يُستورد منه إن كان مصدَّرًا فيه (وإلا توقّف، وإن بقي الأصل يستعمل المنقول توقّف: دورة) }
 * ويتوقّف إن استعمل المنقولُ تعريفًا آخر في مستوى الوحدة لم يُذكر معه (فيُذكر معه، أو يُنقل قبله إلى ملفٍّ مشترك).
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

const TSCONFIG = spec.tsconfig ?? 'tsconfig.web.json';
const cfg = ts.parseJsonConfigFileContent(ts.readConfigFile(path.join(ROOT, TSCONFIG), ts.sys.readFile).config, ts.sys, ROOT);
const host = ts.createCompilerHost(cfg.options);
const origGet = host.getSourceFile;
host.getSourceFile = (f, lang, ...rest) => (path.resolve(f) === SRC ? ts.createSourceFile(f, text, lang, true) : origGet(f, lang, ...rest));
const program = ts.createProgram({ rootNames: cfg.fileNames, options: cfg.options, host });
const checker = program.getTypeChecker();
const sf = program.getSourceFiles().find((s) => path.resolve(s.fileName) === SRC);
if (!sf) throw new Error(`لم يُوجد الملفّ في البرنامج (${TSCONFIG})`);

const nameOf = (st) =>
  ts.isFunctionDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isInterfaceDeclaration(st) || ts.isClassDeclaration(st)
    ? st.name?.text
    : ts.isVariableStatement(st)
      ? st.declarationList.declarations[0]?.name.getText(sf)
      : null;
const moving = sf.statements.filter((st) => spec.names.includes(nameOf(st)));
for (const n of spec.names) if (!moving.some((st) => nameOf(st) === n)) throw new Error(`لا تعريف في مستوى الوحدة باسم ${n}`);
const movingSet = new Set(moving);

const imports = new Map();
for (const st of sf.statements) {
  if (!ts.isImportDeclaration(st) || !st.importClause) continue;
  const mod = st.moduleSpecifier.text;
  const c = st.importClause;
  if (c.name) imports.set(c.name.text, { mod, kind: 'default', typeOnly: c.isTypeOnly });
  if (c.namedBindings && ts.isNamedImports(c.namedBindings))
    for (const el of c.namedBindings.elements) imports.set(el.name.text, { mod, kind: 'named', typeOnly: c.isTypeOnly || el.isTypeOnly, orig: el.propertyName?.text });
  if (c.namedBindings && ts.isNamespaceImport(c.namedBindings)) imports.set(c.namedBindings.name.text, { mod, kind: 'ns' });
}

const topOf = (node) => {
  let n = node;
  while (n.parent && n.parent !== sf) n = n.parent;
  return n;
};
const used = new Set();
const missing = new Set();
const stillUsed = new Set();
const fromOrig = new Map();
(function walk(n) {
  if (ts.isIdentifier(n)) {
    const p = n.parent;
    const skip = (ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isQualifiedName(p) && p.right === n) || (ts.isJsxAttribute(p) && p.name === n);
    const sym = !skip && (ts.isShorthandPropertyAssignment(p) && p.name === n ? checker.getShorthandAssignmentValueSymbol(p) : checker.getSymbolAtLocation(n));
    const decl = sym?.declarations?.[0];
    if (decl && decl.getSourceFile() === sf) {
      const from = topOf(n);
      const to = topOf(decl);
      const inMoved = movingSet.has(from);
      if (inMoved && !movingSet.has(to)) {
        if (ts.isImportDeclaration(to)) used.add(n.text);
        else if (to !== from && spec.fromSrc) fromOrig.set(nameOf(to) ?? n.text, to);
        else if (to !== from) missing.add(nameOf(to) ?? n.text);
      }
      if (!inMoved && movingSet.has(to) && !ts.isImportDeclaration(from)) stillUsed.add(nameOf(to));
    }
  }
  ts.forEachChild(n, walk);
})(sf);
if (missing.size) throw new Error(`المنقول يستعمل من مستوى الوحدة ${[...missing].join('، ')} — اذكره معه`);
const isExported = (st) => !!(ts.getCombinedModifierFlags(ts.isVariableStatement(st) ? st.declarationList.declarations[0] : st) & ts.ModifierFlags.Export);
if (spec.fromSrc) {
  const hidden = [...fromOrig].filter(([, st]) => !isExported(st)).map(([n]) => n);
  if (hidden.length) throw new Error(`المنقول يستعمل من الأصل ${hidden.join('، ')} وليس مصدَّرًا فيه — لا تصدير جديد`);
  if (stillUsed.size) throw new Error(`دورة: الأصل يبقى يستعمل من المنقول ${[...stillUsed].join('، ')}`);
}

const relFrom = (mod) => {
  if (!mod.startsWith('.')) return mod;
  const r = path.relative(path.dirname(OUT), path.resolve(path.dirname(SRC), mod)).replace(/\\/g, '/');
  return r.startsWith('.') ? r : './' + r;
};
const byMod = new Map();
for (const n of used) {
  const im = imports.get(n);
  const mod = relFrom(im.mod);
  if (!byMod.has(mod)) byMod.set(mod, { def: null, ns: null, named: [] });
  const e = byMod.get(mod);
  if (im.kind === 'default') e.def = n;
  else if (im.kind === 'ns') e.ns = n;
  else e.named.push({ n, orig: im.orig, typeOnly: im.typeOnly });
}
const impLines = [];
for (const [mod, e] of byMod) {
  const allType = !e.def && !e.ns && e.named.every((x) => x.typeOnly);
  const named = e.named.map((x) => `${!allType && x.typeOnly ? 'type ' : ''}${x.orig ? `${x.orig} as ` : ''}${x.n}`).join(', ');
  if (e.ns) impLines.push(`import * as ${e.ns} from '${mod}';`);
  if (allType && named) impLines.push(`import type { ${named} } from '${mod}';`);
  else if (e.def && named) impLines.push(`import ${e.def}, { ${named} } from '${mod}';`);
  else if (e.def) impLines.push(`import ${e.def} from '${mod}';`);
  else if (named) impLines.push(`import { ${named} } from '${mod}';`);
}
if (fromOrig.size) {
  // من الأصل بترتيب تعريفاته فيه، والأنواع بـtype.
  const isTypeSt = (st) => ts.isTypeAliasDeclaration(st) || ts.isInterfaceDeclaration(st);
  const all = [...fromOrig].sort((a, b) => a[1].pos - b[1].pos);
  const allType = all.every(([, st]) => isTypeSt(st));
  const names = all.map(([n, st]) => (!allType && isTypeSt(st) ? `type ${n}` : n)).join(', ');
  const relSrc = path.relative(path.dirname(OUT), SRC).replace(/\\/g, '/').replace(/\.tsx?$/, '');
  impLines.push(`import ${allType ? 'type ' : ''}{ ${names} } from '${relSrc.startsWith('.') ? relSrc : './' + relSrc}';`);
}

// نصّ كلّ تعريفٍ بتعليقه (من بداية سطر أوّل تعليقٍ يسبقه)
const lineStartOf = (pos) => text.lastIndexOf('\n', pos - 1) + 1;
const pieces = moving.map((st) => {
  const comments = ts.getLeadingCommentRanges(text, st.getFullStart()) ?? [];
  const start = lineStartOf(comments.length ? comments[0].pos : st.getStart(sf));
  let end = st.getEnd();
  if (text[end] === '\n') end += 1;
  let body = text.slice(start, end);
  // يُصدَّر ما لم يكن مصدَّرًا
  const exported = ts.getCombinedModifierFlags(ts.isVariableStatement(st) ? st.declarationList.declarations[0] : st) & ts.ModifierFlags.Export;
  if (!exported) {
    const declStart = st.getStart(sf) - start;
    body = body.slice(0, declStart) + 'export ' + body.slice(declStart);
  }
  return { start, end, body };
});
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const movedText = pieces.map((p) => p.body.replace(/\n+$/, '')).join('\n\n');
if (fs.existsSync(OUT)) {
  // ملفٌّ قائم (مشتركٌ يُضاف إليه): استيراداتٌ جديدة بعد آخر استيراده، والمنقول في آخره.
  const old = fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n').split('\n');
  const lastImp = old.reduce((k, s, i) => (s.startsWith('import ') ? i : k), -1);
  const fresh = impLines.filter((l) => !old.includes(l));
  old.splice(lastImp + 1, 0, ...fresh);
  fs.writeFileSync(OUT, old.join('\n').replace(/\n+$/, '') + '\n\n' + movedText + '\n');
} else fs.writeFileSync(OUT, ['/**', ...spec.doc.map((d) => ` * ${d}`), ' */', ...impLines, '', movedText, ''].join('\n'));

let out = text;
for (const p of [...pieces].sort((a, b) => b.start - a.start)) out = out.slice(0, p.start) + out.slice(p.end);
out = out.replace(/\n{3,}/g, '\n\n');
// آخر استيرادٍ في النصّ بعد الحذف — فالمنقول قد يكون بين الاستيرادات، فتتغيّر المواضع.
const outSf = ts.createSourceFile(SRC, out, ts.ScriptTarget.Latest, true, SRC.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const at = outSf.statements.filter((s) => ts.isImportDeclaration(s)).pop().getEnd();
const rel = path.relative(path.dirname(SRC), OUT).replace(/\\/g, '/').replace(/\.tsx?$/, '');
const keep = [...stillUsed];
if (keep.length) {
  const isType = (n) => {
    const st = moving.find((s) => nameOf(s) === n);
    return !!st && (ts.isTypeAliasDeclaration(st) || ts.isInterfaceDeclaration(st));
  };
  const typeOnly = keep.every(isType);
  const names = keep.map((n) => (!typeOnly && isType(n) ? `type ${n}` : n)).join(', ');
  out = out.slice(0, at) + `\nimport ${typeOnly ? 'type ' : ''}{ ${names} } from '${rel.startsWith('.') ? rel : './' + rel}';` + out.slice(at);
}
fs.writeFileSync(SRC, CRLF ? out.replace(/\n/g, '\r\n') : out);
console.log(`نُقل ${spec.names.join('، ')} إلى ${path.relative(ROOT, OUT)}${keep.length ? ` — ويستورد الأصل ${keep.join('، ')}` : ''}`);
console.log(`الأصل: ${out.split('\n').length} سطرًا`);
