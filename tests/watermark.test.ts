/**
 * العلامة المائية المكرَّرة (هـ٣): فوق نسخة المستمسك وفوق معاينة التصميم.
 */
import { describe, expect, it } from 'vitest';
import { purposeWatermark, tiledWatermark, WATERMARK_PRESETS } from '../src/shared/watermark';
import { generateIdDuplexHtml, type IdCardConfig } from '../src/shared/idCardDuplex';

describe('العلامة المكرَّرة', () => {
  it('نصٌّ مائلٌ يتكرّر فوق عنصره كلّه', () => {
    const svg = tiledWatermark({ text: 'نسخة لغرض مصرف الرشيد فقط' });
    expect(svg).toContain('<pattern');
    expect(svg).toContain('patternTransform="rotate(-28)"');
    expect(svg).toContain('نسخة لغرض مصرف الرشيد فقط');
    expect(svg).toContain('position:absolute;inset:0');
    expect(svg).toContain('fill-opacity="0.22"');
  });

  it('ونصّها يُهرَّب فلا يكسر العلامات، والفارغ لا يُرسم', () => {
    expect(tiledWatermark({ text: '<b>"x" & y</b>' })).toContain('&lt;b&gt;&quot;x&quot; &amp; y&lt;/b&gt;');
    expect(tiledWatermark({ text: '   ' })).toBe('');
  });

  it('ولكلّ طبقةٍ نمطها: عشر بطاقاتٍ في ورقةٍ لا تتنازع معرّفًا', () => {
    const ids = Array.from({ length: 10 }, () => /pattern id="([^"]+)"/.exec(tiledWatermark({ text: 'نسخة' }))![1]);
    expect(new Set(ids).size).toBe(10);
  });

  it('والوضوح في حدّه: لا تختفي ولا تحجب', () => {
    expect(tiledWatermark({ text: 'x', opacity: 0 })).toContain('fill-opacity="0.05"');
    expect(tiledWatermark({ text: 'x', opacity: 1 })).toContain('fill-opacity="0.8"');
  });

  it('«نسخة لغرض …» من الجهة، وبغيرها النصّ العام', () => {
    expect(purposeWatermark('مصرف الرشيد')).toBe('نسخة لغرض تقديمها إلى مصرف الرشيد فقط');
    expect(purposeWatermark(' ')).toBe(WATERMARK_PRESETS.copy);
  });
});

describe('فوق نسخة الهوية', () => {
  const config = (watermark: IdCardConfig['watermark']): IdCardConfig => ({
    cardSize: { w: 85.6, h: 54 },
    mode: 'stacked',
    frontSrc: 'scans/front.png',
    backSrc: 'scans/back.png',
    colorFilter: 'color',
    brightness: 1,
    contrast: 1,
    watermark
  });

  it('على الوجه والظهر معًا، وبعد الصورة لا قبلها — فوقها', () => {
    const html = generateIdDuplexHtml(config({ text: 'نسخة لغرض مصرف الرشيد فقط' }), (s) => s).join('');
    expect(html.match(/data-watermark-tiled/g)).toHaveLength(2);
    expect(html.indexOf('data-watermark-tiled')).toBeGreaterThan(html.indexOf('scans/front.png'));
  });

  it('وبلا علامةٍ لا شيء', () => {
    expect(generateIdDuplexHtml(config(null), (s) => s).join('')).not.toContain('data-watermark-tiled');
  });
});
