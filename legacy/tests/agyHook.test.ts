// انتهى — البديل: لا بديل؛ أُلغي العمل بـGemini (Antigravity) في هذا المشروع، وClaude وحده ينفّذ ويراجع — ر170 — ٢٢ ت١ ٢٠٢٦
/**
 * حارس جلسات Antigravity (`tools/hooks/agy.mjs`، ر163): يترجم نداء أداته إلى صيغة Claude ويسأل `guard.mjs` نفسه. بـ`git` مزيّف
 * يُجيب من جدول كـ`guardHook`؛ وحالةٌ أخيرة تشغّل السكربت كما يشغّله `.agents/hooks.json` (من مجلّد `.agents/`، وJSON على stdin).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — أداةٌ بـJavaScript بلا أنواع.
import { toClaude, verdict } from '../tools/hooks/agy.mjs';

const ROOT = resolve(__dirname, '..');
type Verdict = { decision: string; reason: string } | null;

function ctx(table: Record<string, string> = {}, files: Record<string, string> = {}) {
  return {
    root: ROOT,
    cwd: ROOT,
    git: (args: string[]) => table[args.join(' ')] ?? '',
    read: (rel: string) => files[rel],
    readBytes: (rel: string) => {
      if (!(rel in files)) throw new Error('غائب');
      return Buffer.from(files[rel]!, 'latin1');
    },
  };
}
const call = (name: string, args: object, c = ctx()): Verdict => verdict({ toolCall: { name, args } }, c);
const kind = (v: Verdict) => v?.decision ?? 'pass';
const cmd = (CommandLine: string, c = ctx()) => kind(call('run_command', { CommandLine, Cwd: ROOT }, c));

describe('حارس Antigravity — الترجمة', () => {
  it('أدوات Antigravity إلى أسماء Claude ومفاتيحها، وما سواها لا يُحرس', () => {
    expect(toClaude({ name: 'run_command', args: { CommandLine: 'git status' } })).toEqual({ tool_name: 'Bash', tool_input: { command: 'git status' } });
    expect(toClaude({ name: 'view_file', args: { AbsolutePath: 'd:/x/a.md', StartLine: 1, EndLine: 40 } })).toEqual({
      tool_name: 'Read',
      tool_input: { file_path: 'd:/x/a.md', offset: 1, limit: 40 },
    });
    expect(toClaude({ name: 'view_file', args: { AbsolutePath: 'file:///d:/x/a.md' } })?.tool_input).toEqual({ file_path: 'd:/x/a.md' });
    expect(toClaude({ name: 'replace_file_content', args: { TargetFile: 'd:/x/a.md' } })?.tool_name).toBe('Edit');
    expect(toClaude({ name: 'grep_search', args: { SearchPath: 'd:/x' } })?.tool_input).toEqual({ path: 'd:/x' });
    expect(toClaude({ name: 'search_web', args: {} })).toBeNull();
  });
});

describe('حارس Antigravity — القرار', () => {
  it('ممنوعات الحارس نفسها، وما يسأل عنه المالك force_ask', () => {
    expect(cmd('git status')).toBe('pass');
    expect(cmd("sed -i 's/a/b/' docs/PLAN.md")).toBe('deny');
    expect(cmd('git push --force origin packs')).toBe('deny');
    expect(cmd('git push origin master')).toBe('force_ask');
    expect(cmd('node tools/sweep.mjs')).toBe('force_ask');
    expect(kind(call('view_file', { AbsolutePath: 'C:/k/diwan-owner-private.key' }))).toBe('deny');
  });

  it(`الدفتر يُقرأ بمدى StartLine–EndLine حتى ١٢٠ سطرًا وحده`, () => {
    const log = join(ROOT, 'docs', 'LOG.md');
    expect(kind(call('view_file', { AbsolutePath: log }))).toBe('deny');
    expect(kind(call('view_file', { AbsolutePath: log, StartLine: 1, EndLine: 100 }))).toBe('pass');
    expect(kind(call('view_file', { AbsolutePath: log, StartLine: 1, EndLine: 500 }))).toBe('deny');
    expect(kind(call('view_file', { AbsolutePath: join(ROOT, 'docs', 'PLAN.md') }))).toBe('pass');
  });

  it('قبل git commit: بايت تحكّم أو نهاياتٌ وُحّدت في ملفٍّ تغيّر يُمنع؛ والسليم يمرّ', () => {
    const table = { 'diff --name-only HEAD': 'docs/x.md\n' };
    expect(cmd('git commit -m x', ctx(table, { 'docs/x.md': 'a\bb\n' }))).toBe('deny');
    const drift = { ...table, 'ls-files --eol -- docs/x.md': 'i/crlf  w/lf    attr/                 \tdocs/x.md\n' };
    expect(cmd('git commit -m x', ctx(drift, { 'docs/x.md': 'a\n' }))).toBe('deny');
    expect(cmd('git commit -m x', ctx(table, { 'docs/x.md': 'a\n' }))).toBe('pass');
    expect(cmd('git status', ctx(table, { 'docs/x.md': 'a\bb\n' }))).toBe('pass');
  });
});

describe('حارس Antigravity — كما يشغّله .agents/hooks.json', () => {
  const hook = JSON.parse(readFileSync(join(ROOT, '.agents', 'hooks.json'), 'utf8'))['diwan-guard'].PreToolUse[0].hooks[0].command as string;
  const run = (input: string) => {
    const [, script] = hook.split(' ');
    return spawnSync(process.execPath, [script!], { cwd: join(ROOT, '.agents'), input, encoding: 'utf8' });
  };

  it('الأمر يجد السكربت من مجلّد .agents/، والمخرج JSON دائمًا (allow لما يمرّ والمدخل الفاسد)', () => {
    expect(hook).toBe('node ../tools/hooks/agy.mjs');
    const denied = run(JSON.stringify({ toolCall: { name: 'run_command', args: { CommandLine: 'sed -i s/a/b/ x.md' } } }));
    expect(denied.status).toBe(0);
    expect(JSON.parse(denied.stdout)).toMatchObject({ decision: 'deny' });
    const passed = run(JSON.stringify({ toolCall: { name: 'run_command', args: { CommandLine: 'git status' } } }));
    expect([passed.status, JSON.parse(passed.stdout)]).toEqual([0, { decision: 'allow' }]);
    const broken = run('{');
    expect([broken.status, JSON.parse(broken.stdout)]).toEqual([0, { decision: 'allow' }]);
  });
});
