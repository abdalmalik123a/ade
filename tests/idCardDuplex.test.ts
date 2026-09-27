import { describe, expect, it } from 'vitest';
import { generateIdDuplexHtml, layoutIdCards, STANDARD_CARD_SIZES } from '../src/shared/idCardDuplex';

describe('صانع هويات الوجه والظهر (ID Duplex 1:1)', () => {
  const id1 = STANDARD_CARD_SIZES[0]!;

  it('النمط المتراكب (stacked): الوجه في النصف العلوي والظهر في السفلي على ورقة A4 واحدة', () => {
    const pages = layoutIdCards({
      cardSize: id1,
      mode: 'stacked',
      frontSrc: 'front.jpg',
      backSrc: 'back.jpg',
      colorFilter: 'color',
      brightness: 1,
      contrast: 1
    });

    expect(pages).toHaveLength(1);
    expect(pages[0]!.cards).toHaveLength(2);

    const front = pages[0]!.cards.find((c) => c.side === 'front')!;
    const back = pages[0]!.cards.find((c) => c.side === 'back')!;

    // كلاهما في وسط الورقة أفقياً
    expect(front.x).toBeCloseTo((210 - id1.w) / 2);
    expect(back.x).toBeCloseTo((210 - id1.w) / 2);

    // الوجه في النصف الأعلى والظهر في النصف الأسفل
    expect(front.y).toBeLessThan(148.5);
    expect(back.y).toBeGreaterThan(148.5);
  });

  it('نمط الطباعة بوجهين (duplex): صفحتان متطابقتان تماماً في الإحداثيات', () => {
    const pages = layoutIdCards({
      cardSize: id1,
      mode: 'duplex',
      frontSrc: 'front.jpg',
      backSrc: 'back.jpg',
      colorFilter: 'photocopy',
      brightness: 1,
      contrast: 1
    });

    expect(pages).toHaveLength(2);
    expect(pages[0]!.cards[0]!.side).toBe('front');
    expect(pages[1]!.cards[0]!.side).toBe('back');

    // إحداثيات الوجه والظهر متطابقة 100% بالمليمتر
    expect(pages[0]!.cards[0]!.x).toBe(pages[1]!.cards[0]!.x);
    expect(pages[0]!.cards[0]!.y).toBe(pages[1]!.cards[0]!.y);
  });

  it('توليد كود HTML بمقاس A4 الحقيقي ومعاملات الفلتر', () => {
    const htmls = generateIdDuplexHtml(
      {
        cardSize: id1,
        mode: 'stacked',
        frontSrc: 'front.jpg',
        backSrc: 'back.jpg',
        colorFilter: 'photocopy',
        brightness: 1.1,
        contrast: 1.2
      },
      (src) => `diwan://store/${src}`
    );

    expect(htmls).toHaveLength(1);
    expect(htmls[0]).toContain('width:210mm');
    expect(htmls[0]).toContain('height:297mm');
    expect(htmls[0]).toContain('grayscale(100%)');
    expect(htmls[0]).toContain('diwan://store/front.jpg');
    expect(htmls[0]).toContain('diwan://store/back.jpg');
  });
});
