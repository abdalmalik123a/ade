/**
 * حرّاس جلسات Claude (`tools/hooks/guard.mjs`) — ممنوعات CLAUDE.md منعٌ آليّ. بـ`git` مزيّف يُجيب من جدول،
 * فلا يُلمس المستودع؛ وحالةٌ أخيرة تشغّل السكربت كما يشغّله `.claude/settings.json` (JSON على stdin).
 */
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — أداةٌ بـJavaScript بلا أنواع.
import { decide, eolDrift, LOG_LIMIT, segments } from '../tools/hooks/guard.mjs';

const ROOT = resolve(__dirname, '..');
type Verdict = { decision: string; reason: string } | null;

/** سياقٌ بـgit يُجيب من جدولٍ (المفتاح: الوسائط مضمومةً بمسافة)، وملفّاتٍ من جدول. */
function ctx(table: Record<string, string> = {}, files: Record<string, string> = {}, cwd = ROOT) {
  return {
    root: ROOT,
    cwd,
    git: (args: string[]) => table[args.join(' ')] ?? '',
    read: (rel: string) => files[rel],
    readBytes: (rel: string) => {
      if (!(rel in files)) throw new Error('غائب');
      return Buffer.from(files[rel]!, 'latin1');
    },
  };
}
const bash = (command: string, c = ctx()): Verdict => decide('pre', { tool_name: 'Bash', tool_input: { command } }, c);
const kind = (v: Verdict) => v?.decision ?? 'pass';

describe('حرّاس الجلسات — الأوامر', () => {
  it('يمرّ المعتاد بلا سؤال', () => {
    for (const c of ['git status', 'npx vitest run tests/guardHook.test.ts', 'sed -n 1,40p docs/LOG.md', 'git push origin packs', 'npm install', 'npm i -g typescript-language-server', 'git tag', 'git tag -l', 'git commit -m "x"', 'rm -rf node_modules/.vite']) {
      expect([c, kind(bash(c))]).toEqual([c, 'pass']);
    }
  });

  it('يمنع sed -i وperl -i بصورهما — ولو بعد xargs', () => {
    for (const c of ["sed -i 's/a/b/' docs/PLAN.md", 'sed -Ei s/a/b/ x.md', 'find docs -name "*.md" | xargs sed -i s/a/b/', 'perl -pi -e s/a/b/ x.md', 'sed --in-place=.bak s/a/b/ x']) {
      expect([c, kind(bash(c))]).toEqual([c, 'deny']);
    }
  });

  it('يمنع الدفع بالقوّة، ويسأل المالك عن master وproduction والوسوم والدمج والإصدار', () => {
    for (const c of ['git push --force origin packs', 'git push -f', 'git push origin +packs', 'git push --force-with-lease origin packs']) expect([c, kind(bash(c))]).toEqual([c, 'deny']);
    for (const c of ['git push origin master', 'git push origin packs:production', 'git push --tags', 'git tag v1.9.0', 'git checkout master && git merge packs', 'npm run dist', 'node tools/release.mjs', 'node tools/sweep.mjs']) {
      expect([c, kind(bash(c))]).toEqual([c, 'ask']);
    }
    expect(kind(bash('git merge packs', ctx({ 'rev-parse --abbrev-ref HEAD': 'master\n' })))).toBe('ask');
  });

  it('يسأل عن اعتماديةٍ جديدة، وتحديث اللقطات، وgit clean، وgit add -f', () => {
    for (const c of ['npm install lodash', 'pnpm add left-pad', 'npx vitest run -u', 'npm test -- --update', 'git clean -fd', 'git add -f reports/x.md']) expect([c, kind(bash(c))]).toEqual([c, 'ask']);
  });

  it('يمنع مسّ مجلّد المالك ومفتاحه بأيّ أداة', () => {
    expect(kind(bash('ls "C:/Users/x/Desktop/لا يجب فقدانها"'))).toBe('deny');
    expect(kind(decide('pre', { tool_name: 'Read', tool_input: { file_path: 'C:/k/diwan-owner-private.key' } }, ctx()))).toBe('deny');
    expect(kind(decide('pre', { tool_name: 'Grep', tool_input: { pattern: 'x', path: 'C:/Users/x/Desktop/لا يجب فقدانها' } }, ctx()))).toBe('deny');
  });

  it('لا حذف لملفٍّ متتبَّع: rm وRemove-Item وgit rm — ولو بعد cd؛ وغير المتتبَّع يمرّ', () => {
    const c = ctx({ 'ls-files -- docs/PLAN.md': 'docs/PLAN.md\n' });
    expect(kind(bash('rm docs/PLAN.md', c))).toBe('deny');
    expect(kind(bash('cd docs && rm -f PLAN.md', c))).toBe('deny');
    expect(kind(decide('pre', { tool_name: 'PowerShell', tool_input: { command: 'Remove-Item -Force docs/PLAN.md' } }, c))).toBe('deny');
    expect(kind(bash('rm docs/other.md', c))).toBe('pass');
    expect(kind(bash('git rm docs/PLAN.md', c))).toBe('deny');
    expect(kind(bash('git rm --cached docs/PLAN.md', c))).toBe('pass');
  });
});

describe('حرّاس الجلسات — قبل الإيداع', () => {
  it('لا يُودَع ما في .gitignore — مرحَّلًا أو بـgit add في الأمر نفسه؛ وقواعد tests/fixtures تمرّ', () => {
    expect(kind(bash('git commit -m x', ctx({ 'diff --cached --name-only': 'reports/a.md\n' })))).toBe('deny');
    expect(kind(bash('git commit -m x', ctx({ 'diff --cached --name-only': 'diwan-owner-private.key\n' })))).toBe('deny');
    expect(kind(bash('git add -A && git commit -m x', ctx({ 'ls-files -m -o --exclude-standard --': 'release/x.exe\n' })))).toBe('deny');
    expect(kind(bash('git commit -m x', ctx({ 'diff --cached --name-only': 'tests/fixtures/release-1.7.0.db\n' })))).toBe('pass');
  });

  it('سقوف الحجم: الخفض والإزالة يمرّان، والرفع والملفّ الجديد يُمنعان — من الفهرس ومن الشجرة مع -a', () => {
    const cap = 'tests/structure.allow.json';
    const at = (after: object) => ({ 'diff --cached --name-only': `${cap}\n`, [`show HEAD:${cap}`]: '{"a.ts": 500, "b.ts": 450}', [`show :${cap}`]: JSON.stringify(after) });
    expect(kind(bash('git commit -m x', ctx(at({ 'a.ts': 480 }))))).toBe('pass');
    expect(kind(bash('git commit -m x', ctx(at({ 'a.ts': 520, 'b.ts': 450 }))))).toBe('deny');
    expect(kind(bash('git commit -m x', ctx(at({ 'a.ts': 500, 'c.ts': 410 }))))).toBe('deny');
    const tree = ctx({ 'diff --name-only': `${cap}\n`, [`show HEAD:${cap}`]: '{"a.ts": 500}' }, { [cap]: '{"a.ts": 600}' });
    expect(kind(bash('git commit -am x', tree))).toBe('deny');
  });

  it('لقطات الرسّام: تغيّرها يحتاج ذكرها في رسالة الإيداع', () => {
    const snap = ctx({ 'diff --cached --name-only': 'tests/snapshots/a.svg\n' });
    expect(kind(bash('git commit -m "D60: إصلاح"', snap))).toBe('deny');
    expect(kind(bash('git commit -m "D60: تغيّرت لقطة الرسّام لأنّ الهامش صُحّح"', snap))).toBe('pass');
  });
});

describe('حرّاس الجلسات — الملفّات', () => {
  it(`الدفتر يُقرأ بـlimit حتى ${LOG_LIMIT} سطرًا وحده، وغيره بلا قيد`, () => {
    const read = (file_path: string, extra: object = {}) => kind(decide('pre', { tool_name: 'Read', tool_input: { file_path, ...extra } }, ctx()));
    expect(read(join(ROOT, 'docs', 'LOG.md'))).toBe('deny');
    expect(read(join(ROOT, 'docs', 'LOG.md'), { limit: 40 })).toBe('pass');
    expect(read(join(ROOT, 'docs', 'LOG.md'), { limit: 500 })).toBe('deny');
    expect(read(join(ROOT, 'docs', 'PLAN.md'))).toBe('pass');
  });

  it('بعد التعديل: بايت تحكّم أو نهاياتٌ وُحّدت يُعاد لـClaude بأمر الإصلاح؛ وغير المتتبَّع وغير النصّي يمرّان', () => {
    const edit = (file: string, table: Record<string, string>, content = 'a\n') =>
      decide('post', { tool_name: 'Edit', tool_input: { file_path: join(ROOT, file) } }, ctx(table, { [file]: content }));
    expect(kind(edit('docs/x.md', {}, 'a\bb\n'))).toBe('deny');
    const drift = edit('docs/x.md', { 'ls-files --eol -- docs/x.md': 'i/crlf  w/lf    attr/                 \tdocs/x.md\n' });
    expect(drift?.reason).toContain('fix-eol docs/x.md');
    expect(kind(edit('docs/x.md', {}))).toBe('pass');
    expect(kind(edit('docs/x.png', {}, 'a\bb'))).toBe('pass');
  });

  it('eolDrift وsegments', () => {
    expect(eolDrift('i/lf    w/crlf  attr/                 \ta.md')).toEqual({ index: 'lf', tree: 'crlf' });
    expect(eolDrift('i/crlf  w/lf    attr/text eol=crlf    \ta.bat')).toBeNull();
    expect(eolDrift('i/lf    w/lf    attr/                 \ta.md')).toBeNull();
    expect(eolDrift('')).toBeNull();
    expect(segments('FOO=1 npm test && git status')).toEqual([['npm', 'test'], ['git', 'status']]);
  });
});

describe('حارس الاستمرار (ر176) — محادثة /next لا تتوقّف ما بقي أمر', () => {
  const PLAN = [
    '| الرقم | الأمر | الحال | الوسم | يعتمد على |',
    '|---|---|---|---|---|',
    '| [D154](orders/done/D154.md) | قديم | ✅ 961df33 | 🧭 | — |',
    '| [D155](orders/D155.md) | الرمز | ⬜ | ⚙️ ص | مراجعة D154 |'
  ].join('\n');
  const LOG = '# دفتر\n\n## ٢٠٢٦-١٠-٢٤ — D154 ✅\n- شيء';
  const user = (content: unknown, extra: object = {}) => JSON.stringify({ type: 'user', message: { role: 'user', content }, ...extra });
  const NEXT = user('<command-message>next</command-message>\n<command-name>/next</command-name>');
  function stopCtx(transcript: string, files: Record<string, string> = {}, head = 'h1') {
    const state = new Map<string, string>();
    return { ...ctx({ 'rev-parse HEAD': `${head}\n` }, { 'docs/PLAN.md': PLAN, 'docs/LOG.md': LOG, ...files }), transcript: () => transcript, state };
  }
  const stop = (c: ReturnType<typeof stopCtx>, active = false): Verdict => decide('stop', { session_id: 's', transcript_path: 't', stop_hook_active: active }, c);

  it('آخر ما كتبه المالك /next وفي PLAN أمرٌ غير 🛑: يُردّ إلى العمل بالتالي', () => {
    const v = stop(stopCtx([NEXT, user([{ type: 'tool_result', content: 'x' }]), user('ملخّص', { isCompactSummary: true })].join('\n')));
    expect(v?.decision).toBe('block');
    expect(v?.reason).toContain('D155');
  });

  it('و«أكمل» كذلك؛ أمّا رسالةٌ أخرى من المالك فتتوقّف المحادثة', () => {
    expect(kind(stop(stopCtx(user([{ type: 'text', text: 'أكمل' }]))))).toBe('block');
    expect(kind(stop(stopCtx([NEXT, user('اشرح لي ما تغيّر')].join('\n'))))).toBe('pass');
    expect(kind(stop(stopCtx('')))).toBe('pass');
  });

  it('تتوقّف بقيد «توقّف» في رأس الدفتر، وعند 🛑، وحين لا يبقى شيء', () => {
    expect(kind(stop(stopCtx(NEXT, { 'docs/LOG.md': '## ٢٠٢٦ — D155 — توقّف: الواقع يخالف الأمر\n' })))).toBe('pass');
    expect(kind(stop(stopCtx(NEXT, { 'docs/PLAN.md': PLAN.replace('⚙️ ص', '🛑') })))).toBe('pass');
    expect(kind(stop(stopCtx(NEXT, { 'docs/PLAN.md': PLAN.replace('⬜', '✅ abc') })))).toBe('pass');
  });

  it('لا حلقة: إن لم يتقدّم HEAD منذ آخر ردٍّ تتوقّف، وإن تقدّم يُردّ ثانية', () => {
    const c = stopCtx(NEXT);
    expect(kind(stop(c))).toBe('block');
    expect(kind(stop(c, true))).toBe('pass');
    c.git = (args: string[]) => (args.join(' ') === 'rev-parse HEAD' ? 'h2\n' : '');
    expect(kind(stop(c, true))).toBe('block');
  });
});

describe('حرّاس الجلسات — كما يشغّلها Claude Code', () => {
  const run = (mode: string, payload: object) =>
    spawnSync(process.execPath, [join(ROOT, 'tools', 'hooks', 'guard.mjs'), mode], { input: JSON.stringify(payload), encoding: 'utf8' });

  it('المنع JSON بقرار deny وسببه، والمسموح بلا مخرج، والمدخل الفاسد يمرّ', () => {
    const denied = run('pre', { tool_name: 'Bash', tool_input: { command: 'sed -i s/a/b/ x.md' }, cwd: ROOT });
    expect(denied.status).toBe(0);
    const out = JSON.parse(denied.stdout);
    expect(out.hookSpecificOutput.hookEventName).toBe('PreToolUse');
    expect(out.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(out.hookSpecificOutput.permissionDecisionReason).toContain('sed -i');
    const passed = run('pre', { tool_name: 'Bash', tool_input: { command: 'git status' }, cwd: ROOT });
    expect([passed.status, passed.stdout]).toEqual([0, '']);
    const broken = spawnSync(process.execPath, [join(ROOT, 'tools', 'hooks', 'guard.mjs'), 'pre'], { input: '{', encoding: 'utf8' });
    expect([broken.status, broken.stdout]).toEqual([0, '']);
  });
});
