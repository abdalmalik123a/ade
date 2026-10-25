/**
 * «تشخيص الجهاز» (S34، D186): لكلّ سطرٍ من الخمسة حدٌّ — سليمٌ ومنبِّهٌ ومعطَّل — بجملةٍ عربية تقول ما يُفعل؛ والأسطر نفسها في تقرير المشكلة.
 */
import { describe, expect, it } from 'vitest';
import { CLOCK_SLACK_MS, DISK_BAD_BYTES, DISK_WARN_BYTES, diagnose, diagnoseLines, type DiagnoseInput } from '../src/main/services/diagnostics';

const NOW = new Date(2026, 9, 26, 10, 0);
const BASE: DiagnoseInput = {
  vcMissing: [],
  fonts: { count: 0, broken: [] },
  printers: [{ name: 'HP LaserJet', isDefault: true, ready: true }],
  freeBytes: 50 * 1024 ** 3,
  now: NOW,
  lastSeen: NOW.toISOString()
};
const row = (patch: Partial<DiagnoseInput>, key: string) => diagnose({ ...BASE, ...patch }).find((r) => r.key === key)!;

describe('تشخيص الجهاز', () => {
  it('جهازٌ سليم: خمسة أسطر سليمة بمفاتيحها وترتيبها', () => {
    const rows = diagnose(BASE);
    expect(rows.map((r) => r.key)).toEqual(['vc', 'fonts', 'printers', 'disk', 'clock']);
    expect(rows.every((r) => r.level === 'ok')).toBe(true);
    expect(row({}, 'printers').text).toContain('«HP LaserJet»');
    expect(row({}, 'disk').text).toContain('٥٠ غ.ب');
  });

  it('مكتبات مايكروسوفت: ملفٌّ ناقص يعطّل «أزل الخلفية» ويقول ما يُثبَّت', () => {
    const r = row({ vcMissing: ['vcruntime140_1.dll'] }, 'vc');
    expect(r.level).toBe('bad');
    expect(r.text).toContain('vcruntime140_1.dll');
    expect(r.text).toContain('Microsoft Visual C++ Redistributable');
  });

  it('الخطوط: ملفٌّ تعذّر يُنبَّه باسم عائلته، والمستوردة تُعدّ', () => {
    expect(row({ fonts: { count: 3, broken: ['خط الثلث'] } }, 'fonts')).toMatchObject({ level: 'warn', text: expect.stringContaining('خط الثلث') });
    expect(row({ fonts: { count: 3, broken: [] } }, 'fonts').text).toContain('٣ خطوط مستوردة');
  });

  it('الطابعات: بلا طابعة معطَّل، وغير المستعدّة أو بلا افتراضية تنبيه', () => {
    expect(row({ printers: [] }, 'printers').level).toBe('bad');
    expect(row({ printers: [{ name: 'Canon', isDefault: true, ready: false }] }, 'printers')).toMatchObject({ level: 'warn', text: expect.stringContaining('«Canon»') });
    expect(row({ printers: [{ name: 'Canon', isDefault: false, ready: true }] }, 'printers')).toMatchObject({ level: 'warn', text: expect.stringContaining('لا افتراضية') });
  });

  it('المساحة: دون ٢ غ.ب تنبيه، ودون ٥٠٠ م.ب معطَّل، وما تعذّرت قراءته تنبيه', () => {
    expect(row({ freeBytes: DISK_WARN_BYTES }, 'disk').level).toBe('ok');
    expect(row({ freeBytes: DISK_WARN_BYTES - 1 }, 'disk').level).toBe('warn');
    expect(row({ freeBytes: DISK_BAD_BYTES - 1 }, 'disk').level).toBe('bad');
    expect(row({ freeBytes: null }, 'disk').level).toBe('warn');
  });

  it('الساعة: قبل آخر يومٍ رآه البرنامج بأكثر من يومٍ معطَّلة، ويقول التاريخين', () => {
    const later = new Date(NOW.getTime() + CLOCK_SLACK_MS + 60_000).toISOString();
    const r = row({ lastSeen: later }, 'clock');
    expect(r.level).toBe('bad');
    expect(r.text).toContain('٢٠٢٦-١٠-٢٦');
    expect(row({ lastSeen: new Date(NOW.getTime() + CLOCK_SLACK_MS - 60_000).toISOString() }, 'clock').level).toBe('ok');
    expect(row({ lastSeen: null }, 'clock').level).toBe('ok');
  });

  it('والأسطر نصًّا للتقرير بعلامتها', () => {
    const lines = diagnoseLines(diagnose({ ...BASE, printers: [] }));
    expect(lines[0]).toMatch(/^✓ مكتبات مايكروسوفت: /);
    expect(lines[2]).toMatch(/^✗ الطابعات: /);
  });
});
