import { describe, expect, it, vi } from 'vitest';
import { CONTRACT_PRESETS, installContracts } from '../src/shared/contracts';
import { tafqeet } from '../src/shared/tafqeet';

describe('نماذج العقود والكمبيالات العرفية (Contracts & Promissory Notes)', () => {
  it('تحتوي الحزمة على النماذج الأساسية المطلوبة لمكاتب الطباعة العراقية', () => {
    expect(CONTRACT_PRESETS.length).toBeGreaterThanOrEqual(5);

    const codes = CONTRACT_PRESETS.map((p) => p.code);
    expect(codes).toContain('عقد-إيجار');
    expect(codes).toContain('مكاتبة-مركبة');
    expect(codes).toContain('كمبيالة-دين');
    expect(codes).toContain('تعهد-قانوني');
    expect(codes).toContain('سند-مخالصة');
  });

  it('كل نموذج يحتوي على متغيرات مطابقة للمتن وتدعم استيراد بيانات المواطن والتفقيط', () => {
    for (const preset of CONTRACT_PRESETS) {
      expect(preset.title).toBeTruthy();
      expect(preset.category).toBeTruthy();
      expect(preset.bodyHtml).toBeTruthy();
      expect(preset.variables.length).toBeGreaterThan(0);

      // التأكد من أن كل متغير معرّف موجود في المتن
      for (const v of preset.variables) {
        expect(preset.bodyHtml).toContain(`{${v.token}}`);
      }
    }
  });

  it('تثبيت النماذج يتخطى النماذج المثبتة مسبقًا بدون تكرار', async () => {
    const mockSave = vi.fn().mockResolvedValue({ id: 1 });
    const existing = new Set<string>(['عقد-إيجار']);

    const res = await installContracts(mockSave, existing);

    expect(res.skipped).toBe(1);
    expect(res.installed).toBe(CONTRACT_PRESETS.length - 1);
    expect(mockSave).toHaveBeenCalledTimes(CONTRACT_PRESETS.length - 1);
  });

  it('يدعم تكامل التفقيط المالي مع مبالغ الإيجار والكمبيالات', () => {
    const rentAmount = 650000;
    const rentInWords = tafqeet(rentAmount);
    expect(rentInWords).toBe('فقط ستمئة وخمسون ألف دينار عراقي لا غير');

    const debtAmount = 5000000;
    const debtInWords = tafqeet(debtAmount);
    expect(debtInWords).toBe('فقط خمسة ملايين دينار عراقي لا غير');
  });
});
