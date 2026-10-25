/**
 * «أرسل تقرير المشكلة» (البند ٣٢): التقرير بما كتبه الموظف والإصدار والتفعيل وآخر سجلّ الأخطاء — واسم مستخدم Windows
 * في المسارات يُخفى، والسجلّ من آخره بقدر.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildReport, hideUserName, licenseLine, readLogTail, reportFileName } from '../src/main/services/problemReport';

const INFO = { version: '1.7.2', os: 'Windows 10.0.26300', arch: 'x64', memoryGb: 7.7, freeMemoryGb: 2.1, license: null };

describe('تقرير المشكلة', () => {
  it('فيه ما كتبه الموظف والإصدار وWindows وسجلّ الأخطاء — بأسطر Windows', () => {
    const text = buildReport({ note: 'كنت أطبع كتاب تأييد', info: INFO, log: '2026-10-12 [main] تعذّر\nat x', userName: 'office', now: new Date(2026, 9, 12, 14, 5) });
    expect(text).toContain('الإصدار: 1.7.2');
    expect(text).toContain('Windows: Windows 10.0.26300 (x64)');
    expect(text).toContain('كنت أطبع كتاب تأييد');
    expect(text).toContain('[main] تعذّر');
    expect(text).toContain('التفعيل: غير معروف');
    expect(text.split('\r\n').length).toBeGreaterThan(10);
    expect(text.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('وفيه «تشخيص الجهاز» بأسطره (D186) — وتقريرٌ بلا تشخيصٍ يقول «تعذّر»', () => {
    const text = buildReport({ note: '', info: { ...INFO, diagnostics: ['✓ الطابعات: طابعة واحدة', '✗ المساحة: الفارغ ٠٫٣ غ.ب'] }, log: '', userName: '', now: new Date() });
    expect(text).toContain('تشخيص الجهاز:\r\n✓ الطابعات: طابعة واحدة\r\n✗ المساحة');
    expect(buildReport({ note: '', info: INFO, log: '', userName: '', now: new Date() })).toContain('تشخيص الجهاز:\r\n(تعذّر)');
  });

  it('وبلا ملاحظةٍ ولا أخطاء يقول ذلك', () => {
    const text = buildReport({ note: '  ', info: INFO, log: '', userName: '', now: new Date() });
    expect(text).toContain('(لم يُكتب شيء)');
    expect(text).toContain('(لا أخطاء مسجّلة)');
  });

  it('واسم مستخدم Windows في المسارات يُخفى — بالشرطتين وبأيّ حالة أحرف، وما سواه يبقى', () => {
    const log = 'at C:\\Users\\Zainab\\AppData\\x.js\nfile:///C:/users/zainab/Desktop/a.png\nC:\\Users\\Zainab2\\b\nZainab وحدها';
    const out = hideUserName(log, 'Zainab');
    expect(out).toContain('C:\\Users\\…\\AppData');
    expect(out).toContain('C:/users/…/Desktop');
    expect(out).toContain('C:\\Users\\Zainab2\\b');
    expect(out).toContain('Zainab وحدها');
    expect(hideUserName(log, '')).toBe(log);
  });

  it('والتفعيل بلغة المكتب — ورمز الجهاز معه، بلا المفتاح', () => {
    const base = { device: 'DWN-AAAA-BBBB-CCCC-DDDD', phone: '+964', trialStart: '2026-10-01' };
    expect(licenseLine({ status: 'activated', office: null, issued: '2026-10-12', ...base })).toBe('مفعّل مدى الحياة — رمز الجهاز DWN-AAAA-BBBB-CCCC-DDDD');
    expect(licenseLine({ status: 'trial', daysLeft: 3, lastDay: '2026-10-15', extended: false, ...base })).toContain('بقي ٣ أيّام');
    expect(licenseLine({ status: 'expired', lastDay: '2026-10-15', ended: 'subscription', ...base })).toContain('انتهى الاشتراك في 2026-10-15');
  });

  it('والسجلّ: الأقدم ثم الحاليّ، ومن آخره بقدرٍ — وما لا يوجد لا يُسقطه', () => {
    const dir = mkdtempSync(join(tmpdir(), 'diwan-report-'));
    writeFileSync(join(dir, 'a.log.1'), 'قديم\n');
    writeFileSync(join(dir, 'a.log'), 'حديث\n');
    expect(readLogTail([join(dir, 'a.log.1'), join(dir, 'a.log'), join(dir, 'غائب.log')])).toBe('قديم\nحديث\n');
    expect(readLogTail([join(dir, 'a.log.1'), join(dir, 'a.log')], 5)).toBe('…\nحديث\n');
  });

  it('واسم الملفّ بالتاريخ والساعة', () => {
    expect(reportFileName(new Date(2026, 9, 12, 9, 7))).toBe('تقرير مشكلة ديوان 2026-10-12 0907.txt');
  });
});
