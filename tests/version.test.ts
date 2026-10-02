import { describe, expect, it } from 'vitest';
import { compareVersions } from '../src/shared/version';

/** أرقام الإصدار أرقامًا لا نصًّا — فلا يُسترجع في ١٫٩ ما أُخذ بـ١٫١٠ (خطة Production، ٤٫٢). */
describe('مقارنة الإصدارات', () => {
  it('أرقامًا لا نصًّا، والناقص صفر، والوسم يُهمل', () => {
    expect(compareVersions('1.10.0', '1.9.3')).toBe(1);
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('1.0.0-beta.2', '1.0.0')).toBe(0);
    expect(compareVersions('0.1.0', '1.0.0')).toBe(-1);
  });
});
