/**
 * كلمة النسخة الاحتياطية (و٦): ثمانية أحرفٍ أقلّها عند الإنشاء — والفراغات وحدها ليست كلمة (كانت تُعدّ «بلا كلمة»
 * فتخرج النسخة غير مشفّرة). وفتح نسخةٍ قديمة بكلمةٍ أقصر في `backup.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { BACKUP_PASSWORD_MIN, backupPasswordProblem } from '../src/shared/backupPassword';

describe('كلمة النسخة الاحتياطية (و٦)', () => {
  it('سبعة أحرف تُرفض بعربية، وثمانية تُقبل', () => {
    expect(BACKUP_PASSWORD_MIN).toBe(8);
    expect(backupPasswordProblem('1234567')).toBe('كلمة المرور 8 أحرفٍ أقلّها');
    expect(backupPasswordProblem('12345678')).toBeNull();
    expect(backupPasswordProblem('سرّ المكتب')).toBeNull();
    expect(backupPasswordProblem('كلمة')).toMatch('أقلّها');
  });

  it('والفراغات وحدها ليست كلمة — ولو كانت ثمانية', () => {
    expect(backupPasswordProblem('        ')).toMatch('فراغاتٌ وحدها');
    expect(backupPasswordProblem('')).toMatch('فراغاتٌ وحدها');
  });

  it('والحروف تُعدّ حروفًا لا وحدات ترميز', () => {
    // سبعة رموزٍ تعبيرية: أربع عشرة وحدة ترميز، وهي سبعة أحرف.
    expect(backupPasswordProblem('😀😀😀😀😀😀😀')).toMatch('أقلّها');
  });
});
