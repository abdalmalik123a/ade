/**
 * قواعد في نصّ الشيفرة لدروسٍ لا يراها اختبار سلوك (G29):
 *
 * ١. **خيوط ONNX** (L21): «أزل الخلفية» استغرق ٩ ث لأنّ ONNX في Electron يعمل بخيطٍ واحد افتراضيًّا، وبالخيوط الصريحة ٢٫٦ ث.
 *    فكلّ `InferenceSession.create(` في `src/` يمرّر `intraOpNumThreads`. (وزمنه على الجهاز المرجعي يقيسه G06 G07.)
 * ٢. **مؤقّت الرسائل** (L28): مؤقّت الرسالة القديمة محا الجديدة قبل أن تُقرأ. فالرسائل بـ`kit/useToast.ts`، وما بقي يدويًّا
 *    في شاشاته: المؤقّت في `ref` يُلغى قبله (`clearTimeout(<المرجع>.current)`)، والذي في `useEffect` يُلغى في تنظيفه —
 *    وقائمته بأسماء ملفّاتها تنقص ولا تزيد (كسقوف `structure`): الجديد يستعمل `useToast`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..');
const rel = (p: string) => relative(ROOT, p).replace(/\\/g, '/');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

const SOURCES = walk(join(ROOT, 'src')).map((abs) => ({ path: rel(abs), text: readFileSync(abs, 'utf8') }));

/** نصّ النداء من قوسه المفتوح إلى قوسه المغلق. */
function callText(text: string, open: number): string {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return text.slice(open, i + 1);
  }
  return text.slice(open);
}

/** مؤقّتٌ يمحو رسالةً: `<مرجع>.current = setTimeout(() => setToast(null)` أو `const <اسم> = setTimeout(…)`. */
const TIMER = /(?:(\w+)\.current|const\s+(\w+))\s*=\s*(?:window\.)?setTimeout\(\(\)\s*=>\s*set(?:Toast|Notice)\(null\)/g;

/** مؤقّتات الرسائل اليدوية خارج `useToast` يوم كُتب الحارس (D30) — تنقص ولا تزيد. */
const MANUAL_TIMERS: Record<string, number> = {
  'src/renderer/src/components/PageEditor.tsx': 1,
  'src/renderer/src/screens/ArchiveScreen.tsx': 1,
  'src/renderer/src/screens/CitizensScreen.tsx': 1,
  'src/renderer/src/screens/LetterheadScreen.tsx': 1,
  'src/renderer/src/screens/PapersScreen.tsx': 1,
  'src/renderer/src/screens/PdfScreen.tsx': 1,
  'src/renderer/src/screens/PhotosScreen.tsx': 1,
  'src/renderer/src/screens/SettingsScreen.tsx': 1,
  'src/renderer/src/screens/TemplatesScreen.tsx': 1,
  'src/renderer/src/screens/editor/useEditorDocument.ts': 1
};

describe('قواعد في نصّ الشيفرة (G29)', () => {
  it('١ — كلّ InferenceSession.create يضبط intraOpNumThreads (L21)', () => {
    const bad: string[] = [];
    let calls = 0;
    for (const s of SOURCES) {
      for (const m of s.text.matchAll(/InferenceSession\.create\(/g)) {
        calls++;
        if (!/\bintraOpNumThreads\b/.test(callText(s.text, m.index! + m[0].length - 1))) {
          bad.push(`${s.path}: InferenceSession.create بلا intraOpNumThreads — ONNX في Electron بخيطٍ واحد افتراضيًّا (L21: ٩ ث بدل ٢٫٦)`);
        }
      }
    }
    expect(bad).toEqual([]);
    expect(calls).toBeGreaterThan(0);
  });

  it('٢ — مؤقّت الرسالة يُلغي سابقته، ولا يزيد اليدويّ خارج useToast (L28)', () => {
    const bad: string[] = [];
    const found: Record<string, number> = {};
    for (const s of SOURCES) {
      if (s.path === 'src/renderer/src/kit/useToast.ts') continue;
      for (const m of s.text.matchAll(TIMER)) {
        found[s.path] = (found[s.path] ?? 0) + 1;
        const [, ref, local] = m;
        if (ref && !s.text.slice(0, m.index).includes(`clearTimeout(${ref}.current)`)) {
          bad.push(`${s.path}: مؤقّت الرسالة في ${ref}.current لا يُلغى قبله — يمحو الرسالة الجديدة بعد لحظة (L28)`);
        }
        if (local && !new RegExp(`clearTimeout\\(${local}\\)`).test(s.text)) {
          bad.push(`${s.path}: مؤقّت الرسالة ${local} لا يُلغى في تنظيف useEffect (L28)`);
        }
      }
    }
    for (const [path, n] of Object.entries(found)) {
      const cap = MANUAL_TIMERS[path] ?? 0;
      if (n > cap) bad.push(`${path}: ${n} مؤقّت رسالةٍ يدويّ (السقف ${cap}) — استعمل useToast من kit (L28)`);
    }
    for (const path of Object.keys(MANUAL_TIMERS)) {
      if (!found[path]) bad.push(`${path}: لا مؤقّت رسالةٍ يدويّ فيه بعد اليوم — احذفه من MANUAL_TIMERS (القائمة تنقص)`);
    }
    expect(bad).toEqual([]);
  });
});
