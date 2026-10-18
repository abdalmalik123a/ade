/**
 * المسارات التي أعطتها الرئيسة للواجهة في هذه الجلسة (A04، D69) — من حوارها أو من نسخةٍ كتبتها.
 *
 * قنواتٌ تقرأ مسارًا مطلقًا تأتي به الواجهة (فحص النسخة واسترجاعها، ومرآتها، وملفّ التحديث، ومجلّد النسخة التلقائية)
 * لا تقبل إلا ما أعطته الرئيسة نفسها — فواجهةٌ عبث بها شيءٌ (أو خطأٌ فيها) لا تفتح بها ملفًّا آخر على القرص.
 * ويُحسم ذلك قبل أيّ لمسٍ للقرص. والذاكرة لهذا التشغيل وحده: لا ملفّ ولا قاعدة، وبعد الإعادة يُختار من جديد.
 */
import { resolve } from 'node:path';

/** المسار محلولًا — وعلى ويندوز بلا فرقٍ بين الحروف (`C:` و`c:`)، كما في `services/localPaths.ts`. */
const key = (p: string) => (process.platform === 'win32' ? resolve(p).toLowerCase() : resolve(p));

const handed = new Set<string>();

/** يذكر أنّ الرئيسة أعطت هذا المسار للواجهة، ويعيده كما هو (و`null` كما هو). */
export function handOut<T extends string | null>(path: T): T {
  if (path) handed.add(key(path));
  return path;
}

/** أأعطته الرئيسة في هذا التشغيل؟ — بالمسار المحلول، فشرطةٌ أخرى أو حرفٌ بحالةٍ أخرى على ويندوز هو هو. */
export function wasHandedOut(path: unknown): path is string {
  return typeof path === 'string' && path !== '' && !path.includes('\0') && handed.has(key(path));
}

/** رسالة الرفض: المسار لم تعطه الرئيسة — فيُختار من حوار ديوان ثانيةً. */
export const pickAgain = (what: 'الملفّ' | 'المجلّد'): Error =>
  new Error(`هذا ${what} لم يُختر من ديوان في هذا التشغيل — اختر ${what} من ديوان ثانيةً`);
