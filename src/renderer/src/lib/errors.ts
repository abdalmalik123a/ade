/**
 * تنقية رسائل الأخطاء القادمة من العملية الرئيسية.
 *
 * Electron يغلّف خطأ المعالج هكذا:
 *   Error invoking remote method 'attachments:scan': Error: لا يوجد ماسح
 * واسم القناة يحوي نقطتين، فلا يصحّ قطع ما قبل أول نقطتين — يجب قطع
 * ما بين علامتَي الاقتباس كاملًا، وإلا تسرّبت إنجليزية إلى واجهة عربية.
 */
const IPC_PREFIX = /^Error invoking remote method\s+'[^']*':\s*/;
const ERROR_PREFIX = /^(?:Error|TypeError|RangeError):\s*/;

export function cleanError(message: string): string {
  let out = message.replace(IPC_PREFIX, '');
  while (ERROR_PREFIX.test(out)) out = out.replace(ERROR_PREFIX, '');
  return out.trim();
}

/** يحوّل أي قيمة مرميّة إلى رسالة عربية صالحة للعرض. */
export function errorText(e: unknown, fallback: string): string {
  if (e instanceof Error) {
    const cleaned = cleanError(e.message);
    return cleaned || fallback;
  }
  return fallback;
}
