/**
 * يحذف من الملفّات المعطاة ما يقول المدقّق إنّه مستوردٌ ولا يُستعمل (TS6133 وTS6196 وTS6192) — من أسطر الاستيراد وحدها، وبنهايات
 * الأسطر كما هي. بعد `render.cjs` و`hook.cjs`: الشاشة تبقى تستورد ما صار في أجزائها.
 *
 *   node tools/split/prune.cjs tsconfig.web.json file1 file2 ...
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const [cfg, ...files] = process.argv.slice(2);
const targets = new Set(files.map((f) => path.resolve(f)));
const r = spawnSync(`npx tsc --noEmit -p ${JSON.stringify(cfg)}`, { encoding: 'utf8', shell: true });
const out = (r.stdout || '') + (r.stderr || '');
const errs = new Map();
for (const m of out.matchAll(/^(.+?)\((\d+),(\d+)\): error TS(6133|6196|6192): (?:'([^']+)')?/gm)) {
  const f = path.resolve(m[1]);
  if (!targets.has(f)) continue;
  if (!errs.has(f)) errs.set(f, []);
  errs.get(f).push({ line: Number(m[2]) - 1, name: m[4] === '6192' ? null : m[5] });
}
for (const [f, list] of errs) {
  const raw = fs.readFileSync(f, 'utf8');
  const crlf = raw.includes('\r\n');
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const drop = new Set();
  for (const { line, name } of list) {
    const s = lines[line];
    // اسمٌ في استيرادٍ ممتدّ على أسطر: سطره وحده
    if (!s.startsWith('import ') && name !== null && new RegExp(`^\\s*(type\\s+)?(\\w+\\s+as\\s+)?${name},?\\s*$`).test(s)) {
      drop.add(line);
      continue;
    }
    if (!s.startsWith('import ')) {
      // اسمٌ بين أسماءٍ في سطرٍ من استيرادٍ ممتدّ: `a, name, b` أو `a, name } from …`
      const mid = s.replace(new RegExp(`\\b(type\\s+)?${name}\\s*,\\s*`), '');
      const tail = mid === s ? s.replace(new RegExp(`,\\s*(type\\s+)?${name}\\s*(?=\\})`), '') : mid;
      if (name !== null && tail !== s) {
        lines[line] = tail;
        continue;
      }
      console.log(`تُرك (ليس استيرادًا): ${path.basename(f)}:${line + 1} ${name}`);
      continue;
    }
    if (name === null) {
      drop.add(line);
      continue;
    }
    let t = s;
    t = t.replace(new RegExp(`(\\{|,)\\s*(type\\s+)?(\\w+\\s+as\\s+)?${name}\\s*(?=,|\\})`), (_all, lead) => (lead === '{' ? '{' : ''));
    t = t.replace(/\{\s*,\s*/, '{ ').replace(/,\s*\}/, ' }').replace(/(\w)\}/, '$1 }');
    t = t.replace(new RegExp(`^import (type )?${name} from .*$`), '');
    t = t.replace(new RegExp(`^import \\* as ${name} from .*$`), '');
    t = t.replace(new RegExp(`^import ${name}, \\{`), 'import {');
    if (/^import (type )?\{\s*\} from/.test(t) || !t.trim()) drop.add(line);
    else lines[line] = t;
  }
  const kept = lines.filter((_, i) => !drop.has(i));
  fs.writeFileSync(f, crlf ? kept.join('\n').replace(/\n/g, '\r\n') : kept.join('\n'));
  console.log(`نُظّف ${path.basename(f)}: ${list.length}`);
}

// ثم أسطر الاستيراد المسمّاة من وحدةٍ واحدة تُضمّ سطرًا (`import { a }` و`import type { B }` ← `import { a, type B }`).
for (const f of targets) {
  const raw = fs.readFileSync(f, 'utf8');
  const crlf = raw.includes('\r\n');
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const byMod = new Map();
  lines.forEach((s, i) => {
    const m = /^import (type )?\{ ([^{}]+) \} from '([^']+)';$/.exec(s);
    if (!m) return;
    if (!byMod.has(m[3])) byMod.set(m[3], []);
    byMod.get(m[3]).push({ i, allType: !!m[1], names: m[2].split(',').map((x) => x.trim()).filter(Boolean) });
  });
  const drop = new Set();
  for (const [mod, list] of byMod) {
    if (list.length < 2) continue;
    const allType = list.every((x) => x.allType);
    const names = [];
    for (const x of list)
      for (const n of x.names) {
        const name = !allType && x.allType && !n.startsWith('type ') ? `type ${n}` : n;
        if (!names.includes(name)) names.push(name);
      }
    lines[list[0].i] = `import ${allType ? 'type ' : ''}{ ${allType ? names.map((n) => n.replace(/^type /, '')).join(', ') : names.join(', ')} } from '${mod}';`;
    for (const x of list.slice(1)) drop.add(x.i);
  }
  if (!drop.size) continue;
  const kept = lines.filter((_, i) => !drop.has(i));
  fs.writeFileSync(f, crlf ? kept.join('\n').replace(/\n/g, '\r\n') : kept.join('\n'));
  console.log(`ضُمّت استيرادات ${path.basename(f)}: ${drop.size}`);
}
