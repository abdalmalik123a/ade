/**
 * نظافة المستودع قبل الإيداع (L56 وL60) — ما تُفسده أدوات هذا الجهاز صامتةً يسقط هنا قبل أن يُودَع:
 *
 * ١. **بايتات التحكّم** (L56): heredoc في bash أكل شرطةً مائلة فصار `\b` بايت 0x08 في ملفٍّ أُودع. فلا بايت تحكّم
 *    (غير \t و\n و\r) في ملفٍّ نصّيٍّ متتبَّع.
 * ٢. **نهايات الأسطر** (L56): `sed -i` وقراءة Python النصّية وأداة Edit توحّد النهايات صامتةً، و`grep -c $'\r'` يكذب.
 *    فمن `git ls-files --eol`: لا ملفّ نهايته في الشجرة غيرها في الفهرس إلا بسمة `eol` (ملفّا `.bat`). ويُشغَّل
 *    قبل `git add` — فالمضاف إلى الفهرس صار هو المقارَن به.
 * ٣. **`package.json` هو الأصل** (L60): `asar extract-file` في المستودع كتب المحزوم فوقه وأُودع — والمحزوم بلا
 *    `devDependencies` ولا سكربتات التطوير.
 *
 * وإن غاب git يُتخطّى ولا يسقط.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..');
/** الملفّات النصّية بامتداداتها — وما سواها (قواعد، صور، PDF، نماذج) لا يُقرأ. */
const TEXT = /\.(ts|tsx|mjs|cjs|js|json|md|html|css|sql|py|bat)$|(^|\/)\.git(ignore|attributes|keep)$/;

function git(args: string[]): string | null {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

/** موضع أوّل بايت تحكّمٍ (غير \t و\n و\r، ومعه 0x7F) — أو -1. */
function firstControlByte(bytes: Uint8Array): number {
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i]!;
    if ((c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) || c === 0x7f) return i;
  }
  return -1;
}

/** من مخرج `git ls-files --eol -z`: ما نهايته في الشجرة غيرها في الفهرس بلا سمة `eol`. والغائب من الشجرة لا يُعدّ. */
function eolDrift(out: string): string[] {
  const bad: string[] = [];
  for (const entry of out.split('\0')) {
    const tab = entry.indexOf('\t');
    if (tab < 0) continue;
    const m = /^i\/(\S*)\s+w\/(\S*)\s+attr\/(.*)$/.exec(entry.slice(0, tab).trimEnd());
    if (!m) continue;
    const [, index, tree, attr] = m;
    if (!tree || index === tree || /\beol=/.test(attr!)) continue;
    bad.push(`${entry.slice(tab + 1)}: نهاياته في الفهرس ${index} وفي الشجرة ${tree} — أداةٌ وحّدتها صامتةً (L56)؛ أعِدها كما في HEAD`);
  }
  return bad;
}

const tracked = git(['ls-files', '-z'])?.split('\0').filter(Boolean) ?? null;
// `core.autocrlf=true` (إعداد Git العامّ على ويندوز) يحوّل النهايات عند السحب فلا معنى للمقارنة — والمستودع على false.
const autocrlf = git(['config', 'core.autocrlf'])?.trim() === 'true';

describe('نظافة المستودع (L56 وL60)', () => {
  it('الفحصان يريان الفساد: بايت تحكّم، ونهاياتٌ وُحّدت', () => {
    expect(firstControlByte(new TextEncoder().encode('سطرٌ\tو\r\nآخر\n'))).toBe(-1);
    expect(firstControlByte(new TextEncoder().encode('/\b(?:x)/'))).toBe(1);
    expect(firstControlByte(Uint8Array.from([0x61, 0x7f]))).toBe(1);
    const sample = [
      'i/crlf  w/lf    attr/                 \ttools/drive.mjs',
      'i/lf    w/crlf  attr/text eol=crlf    \tstart.bat',
      'i/lf    w/lf    attr/                 \tdocs/PLAN.md',
      'i/lf    w/      attr/                 \tgone.ts',
      ''
    ].join('\0');
    const drift = eolDrift(sample);
    expect(drift).toHaveLength(1);
    expect(drift[0]).toContain('tools/drive.mjs');
  });

  it.skipIf(!tracked)('١ — لا بايت تحكّم في ملفٍّ نصّيٍّ متتبَّع', () => {
    const bad: string[] = [];
    for (const path of tracked!.filter((p) => TEXT.test(p))) {
      let bytes: Buffer;
      try {
        bytes = readFileSync(join(ROOT, path));
      } catch {
        continue; // محذوفٌ من الشجرة ولم يُودَع حذفه
      }
      const at = firstControlByte(bytes);
      if (at >= 0) bad.push(`${path}: بايت تحكّم 0x${bytes[at]!.toString(16).padStart(2, '0')} عند ${at} — كُتب بـheredoc؟ (L56) اكتبه بأداة الكتابة`);
    }
    expect(bad).toEqual([]);
    expect(tracked!.filter((p) => TEXT.test(p)).length).toBeGreaterThan(1000);
  });

  it.skipIf(!tracked || autocrlf)('٢ — نهايات الأسطر في الشجرة كما في الفهرس (إلا بسمة eol)', () => {
    const out = git(['ls-files', '--eol', '-z']);
    expect(out).not.toBeNull();
    expect(eolDrift(out!)).toEqual([]);
  });

  it('٣ — package.json هو الأصل لا المحزوم (L60)، وفيه engines و.nvmrc وتعريب x64WinRequired (D95)', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      devDependencies?: object;
      scripts?: Record<string, string>;
      engines?: { node?: string };
    };
    const why = 'package.json بلا ما في الأصل — أكتبته أداة asar فوقه؟ (L60) أعِده من git';
    expect(Object.keys(pkg.devDependencies ?? {}).length, why).toBeGreaterThan(0);
    expect(pkg.scripts?.['dev'], why).toBeTruthy();
    expect(pkg.scripts?.['dist'], why).toBeTruthy();
    expect(pkg.engines?.node).toBe('>=22');
    expect(readFileSync(join(ROOT, '.nvmrc'), 'utf8').trim()).toBe('22');
    expect(readFileSync(join(ROOT, 'resources', 'installer.nsh'), 'utf8')).toContain('LangString x64WinRequired 1025');
  });
});
