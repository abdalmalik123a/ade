/**
 * خريطة شاشةٍ قبل تقسيمها (تقسيم الشاشات بعد ١٫٧٫٠): مكوّناتها بأسطرها، وفي المكوّن المسمّى أقسام منطقه المعلَّمة (`// ──`) وجمله
 * العليا، وموضع `return`، وعلامات عرضه (`{/* … *\/}` و`{x && (` والعناصر العليا) بإزاحتها — لتُكتب منها مواصفات render.cjs وhook.cjs.
 *
 *   node tools/split/outline.cjs src/renderer/src/screens/X.tsx [اسم المكوّن]
 */
const fs = require('fs');
const path = require('path');
const ts = require(require.resolve('typescript', { paths: [process.cwd()] }));

const file = path.resolve(process.argv[2]);
const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const line = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
const lines = text.split('\n');
console.log(`${path.basename(file)}: ${lines.length} سطرًا`);

const comps = [];
for (const st of sf.statements) {
  const name = ts.isFunctionDeclaration(st) ? st.name?.text : ts.isVariableStatement(st) ? st.declarationList.declarations[0]?.name.getText(sf) : null;
  const kind = ts.SyntaxKind[st.kind].replace('Declaration', '').replace('Statement', '');
  if (name) console.log(`  ${line(st.getStart(sf))}–${line(st.getEnd())} ${kind} ${name}`);
  if (ts.isFunctionDeclaration(st) && st.body) comps.push(st);
}
const want = process.argv[3];
const comp = comps.find((c) => c.name?.text === want) ?? comps.sort((a, b) => b.getEnd() - b.getStart(sf) - (a.getEnd() - a.getStart(sf)))[0];
if (!comp) process.exit(0);
console.log(`\n${comp.name.text}:`);
let ret = 0;
for (const st of comp.body.statements) {
  const l = line(st.getStart(sf));
  const s = lines[l - 1].trim();
  if (ts.isReturnStatement(st)) ret = l;
  const sec = lines.slice(Math.max(0, l - 4), l - 1).find((x) => /^\s*\/\/ ──/.test(x));
  if (sec) console.log(`  — ${sec.trim()}`);
  console.log(`  ${l}–${line(st.getEnd())} ${s.slice(0, 100)}`);
}
if (ret) {
  console.log('\nالعرض:');
  for (let i = ret; i < lines.length; i++) {
    const s = lines[i];
    const ind = s.length - s.trimStart().length;
    if (ind > 16) continue;
    const t = s.trim();
    if (/^\{\/\*/.test(t) || /^\{[\w.!?() ]+&& \($/.test(t) || /\? \($/.test(t) || /^<(section|aside|header|main|div|nav|ToolOutput|[A-Z]\w+)\b/.test(t))
      console.log(`  ${i + 1} [${ind}] ${t.slice(0, 110)}`);
  }
}
