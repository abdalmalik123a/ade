/**
 * حارس جلسات Antigravity (ر163): مترجمٌ يحوّل نداء أداته إلى صيغة Claude ويسأل `guard.mjs` نفسه — فالقواعد واحدةٌ لا نسختان.
 *
 * يشغّله `.agents/hooks.json` قبل الأداة: `node tools/hooks/agy.mjs` ومدخله JSON على stdin ({ toolCall: { name, args }, workspacePaths }).
 * والمخرج `{ decision, reason }`: «deny» يُمنع، و«force_ask» يُسأل المالك ولو سبق إذنٌ دائم، و«allow» يمرّ إلى إذن البرنامج المعتاد.
 * وفحص ما بعد التعديل (L56) لا قرار له هناك، فيُجرى قبل `git commit` على كلّ ملفٍّ تغيّر. وعطل المترجم يمرّر الأداة كالحارس.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkAfterEdit, decide, segments } from './guard.mjs';

const lines = (s) => (s ?? '').split('\n').map((x) => x.trim()).filter(Boolean);
const local = (p) => String(p ?? '').replace(/^file:\/\/\/?/, '');

/** نداء أداة Antigravity ← { tool_name, tool_input } كما يأخذه `decide` — أو null لما لا يحرسه. */
export function toClaude(call) {
  const a = call?.args ?? {};
  switch (call?.name) {
    case 'run_command':
      return { tool_name: 'Bash', tool_input: { command: String(a.CommandLine ?? '') } };
    case 'view_file': {
      const from = Number(a.StartLine);
      const to = Number(a.EndLine);
      const ranged = Number.isFinite(from) && Number.isFinite(to) && to >= from;
      return { tool_name: 'Read', tool_input: { file_path: local(a.AbsolutePath), ...(ranged ? { offset: from, limit: to - from + 1 } : {}) } };
    }
    case 'write_to_file':
      return { tool_name: 'Write', tool_input: { file_path: local(a.TargetFile) } };
    case 'replace_file_content':
    case 'multi_replace_file_content':
      return { tool_name: 'Edit', tool_input: { file_path: local(a.TargetFile) } };
    case 'list_dir':
      return { tool_name: 'Glob', tool_input: { path: local(a.DirectoryPath) } };
    case 'find_by_name':
      return { tool_name: 'Glob', tool_input: { path: local(a.SearchDirectory) } };
    case 'grep_search':
      return { tool_name: 'Grep', tool_input: { path: local(a.SearchPath) } };
    default:
      return null;
  }
}

/** قبل `git commit`: بايتات التحكّم ونهايات الأسطر في كلّ ملفٍّ تغيّر أو جدّ — فلا يُودَع ما أفسده تعديل. */
export function checkBeforeCommit(cmd, ctx) {
  if (!segments(cmd).some((t) => t[0] === 'git' && t.includes('commit'))) return null;
  const files = new Set([...lines(ctx.git(['diff', '--name-only', 'HEAD'])), ...lines(ctx.git(['ls-files', '-o', '--exclude-standard']))]);
  for (const f of files) {
    const r = checkAfterEdit({ file_path: resolve(ctx.root, f) }, ctx);
    if (r) return r;
  }
  return null;
}

/** القرار بصيغة Antigravity — أو null (يمرّ). */
export function verdict(payload, ctx) {
  const c = toClaude(payload?.toolCall);
  if (!c) return null;
  const r = decide('pre', c, ctx) ?? (c.tool_name === 'Bash' ? checkBeforeCommit(c.tool_input.command, ctx) : null);
  return r && { decision: r.decision === 'ask' ? 'force_ask' : r.decision, reason: r.reason };
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const git = (args) => {
    try {
      return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
    } catch {
      return null;
    }
  };
  const payload = JSON.parse(readFileSync(0, 'utf8') || 'null');
  const cwd = payload?.toolCall?.args?.Cwd || payload?.workspacePaths?.[0] || root;
  const ctx = { root, cwd, git, read: (rel) => readFileSync(resolve(root, rel), 'utf8'), readBytes: (rel) => readFileSync(resolve(root, rel)) };
  return verdict(payload, ctx);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let r = null;
  try {
    r = main();
  } catch {
    // المترجم لا يوقف العمل: عطله يمرّر الأداة.
  }
  process.stdout.write(JSON.stringify(r ?? { decision: 'allow' }));
}
