/**
 * تنبيهٌ خفيف على الرقم الوطني والهاتف (د١٣) — تنبيهٌ لا منع.
 */
import { describe, expect, it } from 'vitest';
import { internationalPhone, nationalIdHint, normalizePhone, phoneHint } from '../src/shared/idChecks';

describe('الرقم الوطني', () => {
  it('١٢ رقمًا بلا تنبيه — ولو بالأرقام الهندية أو بمسافات', () => {
    expect(nationalIdHint('199912345678')).toBeNull();
    expect(nationalIdHint('١٩٩٩١٢٣٤٥٦٧٨')).toBeNull();
    expect(nationalIdHint('1999 1234 5678')).toBeNull();
    expect(nationalIdHint('')).toBeNull();
  });

  it('وغيرها يُنبَّه عليه بعدده — ولا يُمنع', () => {
    expect(nationalIdHint('19991234567')).toContain('وهذا 11');
    expect(nationalIdHint('1999123456O8')).toContain('أرقامٌ فقط');
  });
});

describe('الهاتف', () => {
  it('المحمول بصيغه كلّها يُعرف', () => {
    for (const v of ['07701234567', '0770 123 4567', '+9647701234567', '009647701234567', '٠٧٧٠١٢٣٤٥٦٧', '7701234567']) {
      expect(normalizePhone(v)).toBe('07701234567');
      expect(phoneHint(v)).toBeNull();
    }
    expect(internationalPhone('07701234567')).toBe('+9647701234567');
  });

  it('والناقص يُنبَّه عليه، والأرضي يُترك', () => {
    expect(phoneHint('0770123456')).toContain('١١ رقمًا');
    expect(phoneHint('07801234')).toContain('07');
    expect(phoneHint('017181234')).toBeNull();
    expect(internationalPhone('123')).toBeNull();
  });
});
