/**
 * حرّاس جلسات Claude (بطلب المالك ١٨ ت١ ٢٠٢٦): ممنوعات CLAUDE.md منعٌ آليّ لا تذكّر — قبل الأداة وبعدها.
 *
 * يشغّله `.claude/settings.json`: `node tools/hooks/guard.mjs pre|post` ومدخله JSON الأداة على stdin.
 * - **قبل الأداة:** «deny» يُمنع ويُشرح السبب لـClaude، و«ask» يُسأل المالك (ما يجوز بأمره الصريح وحده).
 * - **بعد Edit وWrite:** بايتات التحكّم ونهايات الأسطر (L56) — «block» يعيد السبب لـClaude فيصلح فورًا.
 * - `node tools/hooks/guard.mjs fix-eol <ملف>` يعيد نهايات ملفٍّ متتبَّع كما في الفهرس (بديل `sed -i`).
 *
 * تحليل الأوامر تقريبٌ يكفي الحارس، لا مفسّر shell. وعطل الحارس نفسه يمرّر الأداة صامتًا فلا يوقف العمل.
 * والقرارات دوالّ تأخذ `git` و`read` ممرَّرين — فيختبرها `tests/guardHook.test.ts` بلا مستودعٍ حقيقي.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** أقصى ما يُقرأ من الدفتر دفعةً (الأحدث في أعلاه). */
export const LOG_LIMIT = 120;
const VAULT = /لا يجب فقدانها|diwan-owner-private\.key/;
const CAPS = ['tests/structure.allow.json', 'tests/designStructure.allow.json'];
const TEXT = /\.(ts|tsx|mjs|cjs|js|json|md|html|css|sql|py|bat)$/;
const RM = new Set(['rm', 'rmdir', 'unlink', 'del', 'erase', 'rd', 'ri', 'remove-item']);
const OWNER_ONLY = 'بأمرٍ صريح من المالك وحده (CLAUDE.md §الإنهاء)';
const VAULT_MSG = 'مجلّد المالك «لا يجب فقدانها» ومفتاحه الخاصّ لا يُلمسان (CLAUDE.md §الإنهاء).';

const deny = (reason) => ({ decision: 'deny', reason });
const ask = (reason) => ({ decision: 'ask', reason });
const lines = (s) => (s ?? '').split('\n').map((x) => x.trim()).filter(Boolean);
const parse = (s) => {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
};

/** مسار Git Bash (`/d/x`) أو ويندوز أو نسبيّ → نسبيٌّ من جذر المستودع بشرطةٍ أمامية، أو null إن كان خارجه. */
export function repoPath(root, cwd, p) {
  const fixed = p.replace(/^\/([a-zA-Z])\//, '$1:/');
  const rel = relative(root, isAbsolute(fixed) ? fixed : resolve(cwd, fixed)).replace(/\\/g, '/');
  return rel.startsWith('..') || isAbsolute(rel) ? null : rel || '.';
}

/** الأمر قطعًا عند ; && || | والسطر، وكلّ قطعةٍ كلماتٌ بلا تنصيص ولا تعيينات بيئةٍ في أوّلها. */
export function segments(cmd) {
  return cmd
    .split(/&&|\|\||[;|\n]/)
    .map((s) => s.trim().split(/\s+/).map((w) => w.replace(/^[('"{&!]+|['")}]+$/g, '')).filter(Boolean))
    .map((t) => t.slice(Math.max(0, t.findIndex((w) => !/^\w+=/.test(w)))))
    .filter((t) => t.length > 0 && !/^\w+=/.test(t[0]));
}

/** `git [-C د] [-c ك=ق] <الأمر> …` → [الأمر، وما بعده]، أو null. */
function gitSub(t) {
  if (t[0] !== 'git') return null;
  let i = 1;
  while (i < t.length && t[i].startsWith('-')) i += t[i] === '-C' || t[i] === '-c' ? 2 : 1;
  return i < t.length ? [t[i], t.slice(i + 1)] : null;
}

/** ما لا يُودَع أبدًا (.gitignore وCLAUDE.md §الإنهاء): التقارير والإصدارات والمفاتيح والقواعد وسجلّ المشترين. */
export function isSecret(f) {
  const fixture = f.startsWith('tests/fixtures/');
  return /^(reports|release|data)\//.test(f) || /\.(pem|key|diwanupdate)$/.test(f) || VAULT.test(f) || (!fixture && /\.(csv|db)$/.test(f));
}

/** قبل `git commit`: ما سيُودَع (المرحَّل، ومعه `-a` و`git add` في الأمر نفسه — يجريان بعد الحارس). */
function checkCommit(cmd, args, ctx) {
  const staged = new Set(lines(ctx.git(['diff', '--cached', '--name-only'])));
  const fromTree = new Set();
  if (args.some((a) => /^-[a-zA-Z]*a[a-zA-Z]*$/.test(a) || a === '--all')) for (const f of lines(ctx.git(['diff', '--name-only']))) fromTree.add(f);
  for (const t of segments(cmd)) {
    const g = gitSub(t);
    if (g?.[0] !== 'add') continue;
    const paths = g[1].filter((a) => !a.startsWith('-')).map((a) => repoPath(ctx.root, ctx.cwd, a)).filter(Boolean);
    const all = !paths.length || paths.includes('.') || g[1].includes('-A') || g[1].includes('--all');
    for (const f of lines(ctx.git(['ls-files', '-m', '-o', '--exclude-standard', '--', ...(all ? [] : paths)]))) fromTree.add(f);
  }
  const files = [...new Set([...staged, ...fromTree])];
  const secret = files.filter(isSecret);
  if (secret.length) return deny(`لا يُودَع: ${secret.join('، ')} — التقارير والإصدارات والمفاتيح والقواعد خارج المستودع (CLAUDE.md §الإنهاء).`);
  for (const cap of CAPS) {
    if (!files.includes(cap)) continue;
    const before = parse(ctx.git(['show', `HEAD:${cap}`])) ?? {};
    const after = parse(fromTree.has(cap) ? ctx.read(cap) : ctx.git(['show', `:${cap}`]));
    const up = Object.entries(after ?? {})
      .filter(([k, v]) => !(k in before) || v > before[k])
      .map(([k, v]) => `${k}: ${before[k] ?? 'جديد'} ← ${v}`);
    if (up.length) return deny(`سقوف الحجم لا تُرفع ولا يُضاف إليها ملفّ — يُقسَّم الملفّ (CLAUDE.md §ثوابت): ${cap} — ${up.join('، ')}`);
  }
  if (files.some((f) => f.startsWith('tests/snapshots/')) && !/لقط/.test(cmd)) {
    return deny('تغيّرت لقطاتٌ في tests/snapshots/ — اذكر في رسالة الإيداع أنّ اللقطات تغيّرت ولماذا (CLAUDE.md §ثوابت: لا تتغيّر إلا بقصدٍ يُذكر).');
  }
  return null;
}

/** أمر Bash أو PowerShell قبل تشغيله. */
export function checkCommand(cmd, ctx) {
  if (VAULT.test(cmd)) return deny(VAULT_MSG);
  let cwd = ctx.cwd;
  const asks = [];
  for (const t of segments(cmd)) {
    const verb = t[0].toLowerCase();
    if (verb === 'cd' && t[1]) cwd = resolve(cwd, t[1].replace(/^\/([a-zA-Z])\//, '$1:/'));
    for (let k = 0; k < t.length; k++) {
      const runner = (t[k] === 'sed' || t[k] === 'perl') && (k === 0 || t[k - 1] === 'xargs' || t[k - 1] === '-exec');
      if (runner && t.slice(k + 1).some((a) => /^-[A-Za-z]*i/.test(a) || a.startsWith('--in-place'))) {
        return deny('لا `sed -i` ولا `perl -i`: يوحّدان نهايات الأسطر صامتين (CLAUDE.md §ثوابت، L56) — عدّل بـEdit، وإن تغيّرت النهايات: `node tools/hooks/guard.mjs fix-eol <ملف>`.');
      }
    }
    if (RM.has(verb)) {
      const hit = t
        .slice(1)
        .filter((a) => !a.startsWith('-') && !/[$`]/.test(a))
        .map((a) => repoPath(ctx.root, cwd, a))
        .filter((r) => r && lines(ctx.git(['ls-files', '--', r])).length > 0);
      if (hit.length) {
        return deny(`لا حذف لملفٍّ متتبَّع: ${hit.join('، ')} — ما اكتمل بديله يُنقل بـ\`git mv\` إلى legacy/ (والوثائق إلى docs/legacy/) وفي أعلاه «انتهى — البديل … — الأمر … — التاريخ» (CLAUDE.md §أوامر العمل).`);
      }
    }
    if (verb === 'find' && t.includes('-delete') && t[1] && repoPath(ctx.root, cwd, t[1])) asks.push('`find -delete` داخل المستودع يمحو ما لا يُرى قبله — ولا حذف لأيّ ملف (CLAUDE.md §أوامر العمل).');
    const g = gitSub(t);
    if (g) {
      const [sub, args] = g;
      if (sub === 'rm' && !args.includes('--cached')) return deny('لا `git rm`: ما اكتمل بديله يُنقل بـ`git mv` إلى legacy/ وفي أعلاه «انتهى — …» (CLAUDE.md §أوامر العمل).');
      if (sub === 'push') {
        if (args.some((a) => a === '-f' || a.startsWith('--force') || a.startsWith('+'))) return deny('الدفع fast-forward فقط — لا `--force` ولا `+` (CLAUDE.md §الإنهاء).');
        if (args.some((a) => /(^|:|\/)(master|production)$/.test(a) || ['--all', '--mirror', '--tags', '--delete', '-d'].includes(a))) asks.push(`الدفع إلى master أو production، أو الوسوم، أو حذف فرع — ${OWNER_ONLY}.`);
      }
      if (sub === 'tag' && args.length && !['-l', '--list', '-n', '-v', '--verify', '--contains'].includes(args[0])) asks.push(`الوسم ${OWNER_ONLY}.`);
      if (sub === 'merge' && (/^(master|production)$/.test((ctx.git(['rev-parse', '--abbrev-ref', 'HEAD']) ?? '').trim()) || /\b(checkout|switch)\s+(master|production)\b/.test(cmd))) {
        asks.push(`الدمج في master أو production ${OWNER_ONLY}.`);
      }
      if (sub === 'clean') asks.push('`git clean` يمحو ما لم يُتتبَّع (ومنه reports/) — ولا حذف لأيّ ملف (CLAUDE.md §أوامر العمل).');
      if (sub === 'add' && args.some((a) => a === '-f' || a === '--force')) asks.push('`git add -f` يُدخل ما في .gitignore (reports/ وrelease/ والمفاتيح) — وهذه لا تُودَع (CLAUDE.md §الإنهاء).');
      if (sub === 'commit') {
        const r = checkCommit(cmd, args, ctx);
        if (r) return r;
      }
    }
    if (['npm', 'pnpm', 'yarn'].includes(verb)) {
      const [sub, ...rest] = t.slice(1);
      const global = rest.some((a) => a === '-g' || a === '--global' || a === '--location=global');
      if (/^(install|i|in|add|uninstall|remove|rm|un)$/.test(sub ?? '') && !global && rest.some((a) => !a.startsWith('-'))) {
        asks.push('تغيير اعتماديات المشروع يحتاج ضرورةً وموافقة المالك (CLAUDE.md §ثوابت).');
      }
      if (sub === 'run' && /^(dist|release)$/.test(rest[0] ?? '')) asks.push(`الإصدار ${OWNER_ONLY}.`);
    }
    if (t.some((a) => /(^|\/)tools\/release\.mjs$/.test(a))) asks.push(`الإصدار ${OWNER_ONLY}.`);
    if (t.some((a) => /(^|\/)tools\/sweep\.mjs$/.test(a))) asks.push('لا فحص شامل (`tools/sweep.mjs`) إلا قبل إصدارٍ بأمر المالك (CLAUDE.md §الفحص).');
    const tests = t.some((a) => /(^|\/)vitest(\.mjs)?$/.test(a)) || (verb === 'npm' && t.includes('test'));
    if (tests && t.some((a) => a === '-u' || a.startsWith('--update'))) asks.push('تحديث اللقطات: tests/snapshots/ لا تتغيّر إلا بقصدٍ يُذكر (CLAUDE.md §ثوابت).');
  }
  return asks.length ? ask([...new Set(asks)].join(' · ')) : null;
}

/** أدوات الملفّات قبل تشغيلها: مجلّد المالك، وقراءة الدفتر كلّه. */
export function checkFile(tool, input, ctx) {
  const p = String(input.file_path ?? input.notebook_path ?? input.path ?? '');
  if (VAULT.test(p)) return deny(VAULT_MSG);
  if (tool === 'Read' && p && repoPath(ctx.root, ctx.cwd, p) === 'docs/LOG.md' && !(input.limit > 0 && input.limit <= LOG_LIMIT)) {
    return deny(`الدفتر الأحدث في أعلاه: اقرأ أوّله بـlimit حتى ${LOG_LIMIT} سطرًا (آخر قيدٍ في أوّله)، أو ابحث فيه بـGrep — قراءته كلّه عشرات آلاف التوكنات.`);
  }
  return null;
}

/** موضع أوّل بايت تحكّمٍ (غير \t و\n و\r، ومعه 0x7F) — أو -1. كما في `tests/repoHygiene.test.ts`. */
export function firstControlByte(bytes) {
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i];
    if ((c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) || c === 0x7f) return i;
  }
  return -1;
}

/** من سطر `git ls-files --eol`: نهايات الفهرس والشجرة إن اختلفتا بلا سمة `eol` — أو null (وغير المتتبَّع null). */
export function eolDrift(out) {
  const m = /^i\/(\S*)\s+w\/(\S*)\s+attr\/(.*)\t/.exec(out ?? '');
  if (!m || !['lf', 'crlf'].includes(m[1]) || !m[2] || m[1] === m[2] || /\beol=/.test(m[3])) return null;
  return { index: m[1], tree: m[2] };
}

/** بعد Edit وWrite: بايتات التحكّم ونهايات الأسطر في الملفّ النصّي (L56). */
export function checkAfterEdit(input, ctx) {
  const rel = repoPath(ctx.root, ctx.cwd, String(input.file_path ?? input.notebook_path ?? ''));
  if (!rel || !TEXT.test(rel)) return null;
  let bytes;
  try {
    bytes = ctx.readBytes(rel);
  } catch {
    return null;
  }
  const at = firstControlByte(bytes);
  if (at >= 0) return deny(`${rel}: بايت تحكّمٍ (0x${bytes[at].toString(16).padStart(2, '0')}) في الموضع ${at} — هروبٌ أكله heredoc أو نسخ (L56)؛ أصلحه قبل أيّ شيء.`);
  const drift = eolDrift(ctx.git(['ls-files', '--eol', '--', rel]));
  if (drift) return deny(`${rel}: نهايات الأسطر في الفهرس ${drift.index} وصارت ${drift.tree} — وحّدتها الأداة صامتةً (L56). أعِدها: \`node tools/hooks/guard.mjs fix-eol ${rel}\``);
  return null;
}

/** القرار: `pre` قبل الأداة و`post` بعدها — { decision, reason } أو null (يمرّ). */
export function decide(mode, payload, ctx) {
  const tool = String(payload.tool_name ?? '');
  const input = payload.tool_input ?? {};
  if (mode === 'pre') return tool === 'Bash' || tool === 'PowerShell' ? checkCommand(String(input.command ?? ''), ctx) : checkFile(tool, input, ctx);
  if (mode === 'post' && /^(Edit|MultiEdit|Write|NotebookEdit)$/.test(tool)) return checkAfterEdit(input, ctx);
  return null;
}

function main() {
  const [mode, arg] = process.argv.slice(2);
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const git = (args) => {
    try {
      return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
    } catch {
      return null;
    }
  };
  if (mode === 'fix-eol') {
    const rel = arg && repoPath(root, process.cwd(), arg);
    const drift = rel && eolDrift(git(['ls-files', '--eol', '--', rel]));
    if (!drift) return console.log(rel ? `${rel}: نهاياته كما في الفهرس` : 'أعطِ مسار ملفٍّ متتبَّع داخل المستودع');
    const text = readFileSync(resolve(root, rel), 'utf8');
    writeFileSync(resolve(root, rel), drift.index === 'crlf' ? text.replace(/\r?\n/g, '\r\n') : text.replace(/\r\n/g, '\n'));
    return console.log(`${rel}: أُعيدت نهاياته ${drift.index} كما في الفهرس`);
  }
  const payload = parse(readFileSync(0, 'utf8'));
  if (!payload) return;
  const ctx = { root, cwd: payload.cwd || process.cwd(), git, read: (rel) => readFileSync(resolve(root, rel), 'utf8'), readBytes: (rel) => readFileSync(resolve(root, rel)) };
  const r = decide(mode, payload, ctx);
  if (!r) return;
  const out = mode === 'pre' ? { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: r.decision, permissionDecisionReason: r.reason } } : { decision: 'block', reason: r.reason };
  process.stdout.write(JSON.stringify(out));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch {
    // الحارس لا يوقف العمل: عطله يمرّر الأداة.
  }
}
