/**
 * المسح الضوئي (و٢): الدقّة رقمٌ صحيحٌ محصور، وسكربت PowerShell ثابتٌ لا يُبنى من قيم — فما يأتي من الواجهة لا
 * يصير أمرًا، وعلامةٌ في مسار حساب ويندوز لا تكسره. والسكربت نفسه جُرِّب في PowerShell: يُحلَّل بلا خطأ، ويقرأ
 * قيمه من البيئة، ويقول «NO_DEVICE» بلا ماسح.
 */
import { describe, expect, it } from 'vitest';
import { SCAN_DPI_RANGE, SCAN_SCRIPT, scanDpi, scanEnv } from '../src/main/services/scanner';

describe('دقّة المسح (و٢)', () => {
  it('ما ليس رقمًا موجبًا يصير الافتراض — لا يمرّ إلى السكربت', () => {
    expect(scanDpi('300; calc')).toBe(300);
    expect(scanDpi(NaN)).toBe(300);
    expect(scanDpi(undefined)).toBe(300);
    expect(scanDpi(null)).toBe(300);
    expect(scanDpi(0)).toBe(300);
    expect(scanDpi(-600)).toBe(300);
    expect(scanDpi('')).toBe(300);
    expect(scanDpi({ toString: () => '600' })).toBe(300);
    expect(SCAN_DPI_RANGE.fallback).toBe(300);
  });

  it('والرقم يُقرَّب ويُحصر بين ٥٠ و١٢٠٠', () => {
    expect(scanDpi(600)).toBe(600);
    expect(scanDpi('150')).toBe(150);
    expect(scanDpi(299.6)).toBe(300);
    expect(scanDpi(10)).toBe(50);
    expect(scanDpi(9600)).toBe(1200);
    expect(scanDpi(Infinity)).toBe(300);
  });
});

describe('سكربت المسح ثابت وقيمه من البيئة (و٢)', () => {
  it('لا قيمة ملصوقة فيه: لا «${» ولا مسار ولا دقّة', () => {
    expect(SCAN_SCRIPT).not.toContain('${');
    expect(SCAN_SCRIPT).toContain('[int]$env:DIWAN_SCAN_DPI');
    expect(SCAN_SCRIPT).toContain('$env:DIWAN_SCAN_TARGET');
    expect(SCAN_SCRIPT).toContain('$_.DeviceID -eq $env:DIWAN_SCAN_DEVICE');
  });

  it('والبيئة بقيمٍ محصورة — ومسارٌ فيه علامةٌ مائلة يبقى نصًّا كما هو', () => {
    const target = 'C:\\Users\\O’Brien\\AppData\\store\\tmp\\scan-1.png';
    const env = scanEnv({ dpi: '300; calc' as unknown as number, color: false, deviceId: "x' ; calc ; '" }, target);
    expect(env).toEqual({
      DIWAN_SCAN_DPI: '300',
      DIWAN_SCAN_INTENT: '2',
      DIWAN_SCAN_DEVICE: "x' ; calc ; '",
      DIWAN_SCAN_TARGET: target,
      DIWAN_SCAN_PART: `${target}.part`
    });
    expect(scanEnv({ dpi: 600 }, target).DIWAN_SCAN_INTENT).toBe('1');
    expect(scanEnv({}, target).DIWAN_SCAN_DEVICE).toBe('');
  });
});
