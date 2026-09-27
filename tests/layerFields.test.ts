/**
 * اقتراح الحقول من أسماء طبقات Photoshop (هـ٤): من اسم الطبقة حقلُها، والعامّ لا يُقترح له.
 */
import { describe, expect, it } from 'vitest';
import { fieldFromLayerName } from '../src/shared/layerFields';
import { APPLY_THRESHOLD } from '../src/shared/doc';

describe('الحقل من اسم الطبقة', () => {
  it('الأسماء الشائعة في قوالب الهويات — بالإنجليزية والعربية', () => {
    const cases: [string, string][] = [
      ['Name', 'الاسم'],
      ['Employee Name', 'الاسم'],
      ['Father_Name', 'اسم الأب'],
      ['Job Title', 'العنوان الوظيفي'],
      ['ID No', 'الرقم'],
      ['Blood Group', 'فصيلة الدم'],
      ['DOB', 'تاريخ الولادة'],
      ['Mobile', 'الهاتف'],
      ['الاسم', 'الاسم'],
      ['الصف', 'الصف'],
      ['Expiry Date', 'تاريخ النفاذ']
    ];
    for (const [layer, key] of cases) expect(fieldFromLayerName(layer)?.value, layer).toBe(key);
  });

  it('والاسم الصريح مع نصٍّ قصير يُقترح بثقةٍ تكفي لتحديده سلفًا', () => {
    const s = fieldFromLayerName('Name', 'Ahmed Ali')!;
    expect(s.confidence).toBeGreaterThanOrEqual(APPLY_THRESHOLD);
    expect(s.reason).toContain('«Name»');
  });

  it('وفقرةٌ طويلة باسم «Title» غالبًا نصٌّ ثابت — يُقترح ولا يُحدَّد', () => {
    const long = 'This card is the property of the company and must be returned upon request';
    expect(fieldFromLayerName('Title', long)!.confidence).toBeLessThan(APPLY_THRESHOLD);
  });

  it('والأسماء العامّة لا يُقترح لها شيء — لا تخمين', () => {
    for (const layer of ['Layer 1', 'Text', 'Layer 3 copy 2', 'Rectangle 4', '', 'Logo']) {
      expect(fieldFromLayerName(layer), layer).toBeNull();
    }
  });
});

describe('من الاستيراد إلى عناصر اللوحة', () => {
  it('كلّ اقتراحٍ بمعرّف عنصره ونصّه النموذجي', async () => {
    const { canvasFromImport, layerSuggestions } = await import('../src/main/services/designImport');
    const imported = {
      source: 'psd' as const,
      name: 'id.psd',
      size: { w: 85.6, h: 54 },
      dpi: 300,
      images: [],
      warnings: [],
      elements: [
        { kind: 'text' as const, box: { x: 0.1, y: 0.1, w: 0.5, h: 0.1 }, inlines: [{ kind: 'run' as const, text: 'Ahmed Ali' }], layerName: 'Name', suggest: fieldFromLayerName('Name', 'Ahmed Ali')! },
        { kind: 'text' as const, box: { x: 0.1, y: 0.3, w: 0.5, h: 0.1 }, inlines: [{ kind: 'run' as const, text: 'ACME' }], layerName: 'Layer 4' },
        { kind: 'barcode' as const, box: { x: 0.7, y: 0.6, w: 0.2, h: 0.3 }, symbology: 'qr' as const }
      ]
    };
    const canvas = canvasFromImport(imported, []);
    const s = layerSuggestions(imported, canvas);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ elementId: canvas!.elements[0]!.id, layer: 'Name', sample: 'Ahmed Ali', key: 'الاسم' });
    expect(layerSuggestions(imported, null)).toEqual([]);
  });
});
