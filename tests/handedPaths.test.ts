/**
 * المسارات عند الباب (A04، D69): القنوات التي تقرأ مسارًا مطلقًا من الواجهة (فحص النسخة واسترجاعها، ومرآتها، والتحديث،
 * ومجلّد النسخة التلقائية) لا تقبل إلا ما أعطته الرئيسة في هذا التشغيل — من حوارها أو نسختها.
 */
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { handOut, pickAgain, wasHandedOut } from '../src/main/ipc/handedPaths';

const picked = join(tmpdir(), 'diwan-handed', 'diwan-backup-2026-10-18.zip');
const win = process.platform === 'win32';

describe('ما أعطته الرئيسة (A04، D69)', () => {
  it('handOut يعيد المسار كما هو، و`null` كما هو', () => {
    expect(handOut(picked)).toBe(picked);
    expect(handOut(null)).toBeNull();
  });

  it('المُعطى يُقبل — ولو بشرطةٍ أخرى أو بحالة حروفٍ أخرى على ويندوز', () => {
    handOut(picked);
    expect(wasHandedOut(picked)).toBe(true);
    expect(wasHandedOut(join(picked, '..', 'diwan-backup-2026-10-18.zip'))).toBe(true);
    if (win) {
      expect(wasHandedOut(picked.replace(/\\/g, '/'))).toBe(true);
      expect(wasHandedOut(picked.toUpperCase())).toBe(true);
    }
  });

  it('وما لم يُعطَ يُرفض: ملفٌّ آخر، وجاره في المجلّد نفسه، ومجلّده', () => {
    handOut(picked);
    for (const p of ['C:\\Windows\\win.ini', join(tmpdir(), 'diwan-handed', 'other.zip'), join(tmpdir(), 'diwan-handed'), `${picked}.bak`]) {
      expect(wasHandedOut(p)).toBe(false);
    }
  });

  it('ومسارٌ فارغ أو غير نصّ أو بحرفٍ صفريّ يُرفض', () => {
    handOut(picked);
    for (const p of ['', null, undefined, 7, { path: picked }, [picked], `${picked}\0`]) expect(wasHandedOut(p)).toBe(false);
  });

  it('ورسالة الرفض تقول ما يُفعل', () => {
    expect(pickAgain('الملفّ').message).toContain('اختر الملفّ من ديوان ثانيةً');
    expect(pickAgain('المجلّد').message).toContain('اختر المجلّد من ديوان ثانيةً');
  });
});
