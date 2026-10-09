/**
 * كلمة النسخة الاحتياطية المشفّرة (و٦): ثمانية أحرفٍ أقلّها — في الواجهتين **وفي العملية الرئيسية**، فلا يكفي حدّ
 * الواجهة. وكانت أربعة: النسخة تخرج من المكتب على فلاشة، و«١٢٣٤» تُجرَّب في دقائق.
 *
 * والحدّ عند **الإنشاء** وحده: نسخةٌ قديمة بكلمةٍ أقصر تُفتح كما كانت.
 */
export const BACKUP_PASSWORD_MIN = 8;

/** ما في الكلمة من خطأ بلغة المكتب — أو `null` إن صلحت. والحروف تُعدّ حروفًا (لا وحدات ترميز). */
export function backupPasswordProblem(password: string): string | null {
  if (password.trim() === '') return 'كلمة المرور فراغاتٌ وحدها — اكتب حروفًا';
  if ([...password].length < BACKUP_PASSWORD_MIN) return `كلمة المرور ${BACKUP_PASSWORD_MIN} أحرفٍ أقلّها`;
  return null;
}
