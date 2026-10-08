/**
 * ما يُنسخ إلى المخزن عابرًا: مسوحٌ لأدوات الهويّة والأوراق (مراجعة ٧ ت١).
 *
 * كان كلّ مسحٍ لوجه هويّةٍ يُكتب في `store/attachments/scan-<وقت>.png` (نحو ١١ م.ب) فلا يمسحه أحد: يمتلئ القرص
 * وتكبر النسخ الاحتياطية، وتنتقل صور هويّات الزبائن إلى الفلاشة بلا سجلٍّ يدلّ عليها — والبرنامج نفسه يقول في مسح
 * محرّر PDF إنّ المستمسك «لا يبقى نسخةً منسيّة».
 *
 * فالمسح العابر صار يُكتب في `store/tmp/` وحدها:
 * - تحذفه الواجهة حين يُغلق حوارُه (`files:discardTransient`)؛
 * - ويُكنس المجلّد كلّه عند الإقلاع — فلا شيء من جلسةٍ سابقة قيد الاستعمال؛
 * - ولا يدخل نسخةً احتياطيةً (يدويّةً ولا تلقائيّة).
 * وما يُقيَّد مستمسكًا لزبون (`attachments:scan`) يبقى في `attachments/` كما كان.
 */
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** مجلّد العابر داخل المخزن. */
export const TRANSIENT_DIR = 'tmp';

/** مسارٌ نسبيّ لملفٍّ عابر: `tmp/اسم` بلا فواصل أخرى ولا `..`. */
export function isTransientPath(rel: unknown): rel is string {
  return typeof rel === 'string' && /^tmp\/[^/\\]+$/.test(rel.replace(/\\/g, '/')) && !rel.includes('..');
}

/** يحذف الملفّات العابرة المذكورة — وما ليس عابرًا يُتجاهل ولو طُلب. */
export function discardTransient(storeRoot: string, paths: unknown[]): number {
  let n = 0;
  for (const rel of paths) {
    if (!isTransientPath(rel)) continue;
    const file = join(storeRoot, rel.replace(/\\/g, '/'));
    try {
      if (existsSync(file)) {
        rmSync(file, { force: true });
        n++;
      }
    } catch {
      // ملفٌّ يمسكه برنامج آخر — يُكنس عند الإقلاع القادم.
    }
  }
  return n;
}

/** عند الإقلاع: كلّ ما في `tmp/`، وكلّ `*.part` أقدم من يومٍ في المخزن (كتابةٌ انقطعت). */
export function sweepTransient(storeRoot: string, now = Date.now()): { tmp: number; parts: number } {
  let tmp = 0;
  let parts = 0;
  const tmpDir = join(storeRoot, TRANSIENT_DIR);
  if (existsSync(tmpDir)) {
    for (const name of readdirSync(tmpDir)) {
      try {
        rmSync(join(tmpDir, name), { recursive: true, force: true });
        tmp++;
      } catch {
        // يُكنس لاحقًا.
      }
    }
  }
  const visit = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== TRANSIENT_DIR) visit(full);
      } else if (e.name.endsWith('.part')) {
        try {
          if (now - statSync(full).mtimeMs > 24 * 3600 * 1000) {
            rmSync(full, { force: true });
            parts++;
          }
        } catch {
          // يُترك.
        }
      }
    }
  };
  if (existsSync(storeRoot)) visit(storeRoot);
  return { tmp, parts };
}
