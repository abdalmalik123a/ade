/**
 * مساراتٌ تأتي من الواجهة وتصير ملفّاتٍ تُقرأ (و٥) — فيُحسم أين تقع قبل أن يُلمس بها القرص.
 *
 * - صورةٌ لُصقت من Word: رابط `file:` لملفٍّ مؤقّت. ورابطٌ له مضيف (`file://server/share/x.png`) أو مسارُ شبكة
 *   (`\\server\share`) كان يُقرأ — فيتّصل ويندوز بذلك الجهاز ويرسل إليه بصمة دخول الموظف. فلا يُقبل إلا ملفٌّ
 *   محلّيٌّ داخل مجلّدٍ متوقَّع (المجلّد المؤقّت الذي يضع فيه Word صوره، والمخزن).
 * - `diwan://store/…`: المسار النسبي محلولًا داخل المخزن — لا «..» نصًّا يُبحث عنه فقط.
 * - صورةٌ يحفظها الشعار أو الختم، وصورةٌ تُقرأ لـWord: ملفٌّ موجودٌ داخل المخزن (`storeFile`، A04).
 */
import { statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** ويندوز لا يفرّق بين الحروف في المسارات (`C:` و`c:`). */
const fold = (p: string) => (process.platform === 'win32' ? p.toLowerCase() : p);

/** أيقع `path` داخل `root` أو هو هو؟ — بالمسار المحلول. */
export function isInside(root: string, path: string): boolean {
  const rel = relative(fold(resolve(root)), fold(resolve(path)));
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

/** مسارٌ يبدأ بشرطتين: مسار شبكة (`\\server\share`) أو مسار جهاز (`\\?\`، `\\.\`). */
const networkPath = (p: string) => /^[\\/]{2}/.test(p);

/** ملفّ المخزن من مساره النسبي — أو `null` إن خرج منه (`..`، أو مطلقٌ، أو مسار شبكة) أو كان المخزن نفسه. */
export function resolveStorePath(root: string, rel: string): string | null {
  if (!rel || rel.includes('\0') || networkPath(rel)) return null;
  const full = resolve(root, rel);
  return isInside(root, full) && fold(full) !== fold(resolve(root)) ? full : null;
}

/** ملفٌّ موجودٌ داخل المخزن من مساره النسبي — أو `null` (خارجه، أو مجلّد، أو غير موجود، أو ليس نصًّا). والاحتواء يُحسم قبل اللمس. */
export function storeFile(root: string, rel: unknown): string | null {
  const full = typeof rel === 'string' ? resolveStorePath(root, rel) : null;
  if (!full) return null;
  try {
    return statSync(full).isFile() ? full : null;
  } catch {
    return null;
  }
}

/** صورةٌ لُصقت: رابط `file:` بلا مضيف لملفٍّ محلّيٍّ داخل أحد `roots` — أو `null` قبل أيّ لمسٍ للقرص. */
export function pastedImagePath(url: string, roots: string[]): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'file:' || parsed.host !== '') return null;
  let path: string;
  try {
    path = fileURLToPath(parsed);
  } catch {
    return null;
  }
  if (networkPath(path)) return null;
  return roots.some((root) => isInside(root, path)) ? path : null;
}
