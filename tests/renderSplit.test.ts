import { describe, expect, it } from 'vitest';
import { splitPagesHtml } from '../src/main/services/renderSplit';
import { impose, planSheets, renderPlan } from '../src/shared/design/imposition';
import { idSheetHtml } from '../src/shared/idSheet';
import { generateIdDuplexHtml } from '../src/shared/idCardDuplex';
import { docSheetHtml, newDoc } from '../src/shared/idDocSheet';
import { photoSheetsHtml } from '../src/shared/photoSheet';
import { omrSheetHtml, type OmrSpec } from '../src/shared/omr';
import { tiledWatermark, WATERMARK_PRESETS } from '../src/shared/watermark';

describe('تجزئة علامات الطباعة بالأوراق — renderSplit', () => {
  it('١ — المولّد الأوّل (imposition): عدد الوحدات يساوي عدد الأوراق وجمعها يساوي الأصل', () => {
    const imp = impose({ w: 85.6, h: 54 }, 3); // 9 بطاقات في الورقة
    const plan = planSheets(imp, Array.from({ length: 27 }, (_, i) => i)); // 3 أوراق
    const pages = renderPlan(imp, plan, (i) => `<div>Card ${i}</div>`);
    expect(pages).toHaveLength(3);

    const html = pages.join('');
    const units = splitPagesHtml(html);
    expect(units).toHaveLength(3);
    expect(units.join('')).toBe(html);
  });

  it('٢ — المولّد الثاني (idSheet): عدد الوحدات يساوي عدد الأوراق وجمعها يساوي الأصل', () => {
    const slots = Array.from({ length: 12 }, (_, i) => ({
      id: `slot-${i}`,
      label: `مستمسك ${i + 1}`,
      sizeKey: 'id1',
      src: 'test.png'
    }));
    const pages = idSheetHtml(slots, { resolveUrl: (s) => s });
    expect(pages.length).toBeGreaterThan(1);

    const html = pages.join('');
    const units = splitPagesHtml(html);
    expect(units).toHaveLength(pages.length);
    expect(units.join('')).toBe(html);
  });

  it('٣ — المولّد الثالث (idCardDuplex): عدد الوحدات يساوي عدد الأوراق وجمعها يساوي الأصل', () => {
    const pages = generateIdDuplexHtml(
      {
        cardSize: { w: 85.6, h: 54 },
        mode: 'duplex',
        frontSrc: 'f1.png',
        backSrc: 'b1.png',
        colorFilter: 'color',
        brightness: 1,
        contrast: 1
      },
      (s) => s
    );
    expect(pages).toHaveLength(2);

    const html = pages.join('');
    const units = splitPagesHtml(html);
    expect(units).toHaveLength(2);
    expect(units.join('')).toBe(html);
  });

  it('٣ب — ورقة المستمسكات (idDocSheet) وعلى وجهي الورقة: عدد الوحدات يساوي عدد الأوراق وجمعها يساوي الأصل', () => {
    const docs = [newDoc('national', { front: 'f.png', back: 'b.png', copies: 6 }), newDoc('passport', { front: 'p.png' })];
    for (const duplex of [false, true]) {
      const pages = docSheetHtml(docs, { resolveUrl: (s) => s, duplex });
      expect(pages.length).toBeGreaterThan(1);
      const html = pages.join('');
      const units = splitPagesHtml(html);
      expect(units).toHaveLength(pages.length);
      expect(units.join('')).toBe(html);
    }
  });

  it('٤ — المولّد الرابع (photoSheet): عدد الوحدات يساوي عدد الأوراق وجمعها يساوي الأصل', () => {
    const pages = photoSheetsHtml(
      {
        paper: { w: 101.6, h: 152.4 },
        photo: { w: 35, h: 45 },
        natural: { w: 350, h: 450 },
        crop: { zoom: 1, x: 0.5, y: 0.5 },
        count: 16,
        src: 'photo.png'
      },
      (s) => s
    );
    expect(pages.length).toBeGreaterThanOrEqual(2);

    const html = pages.join('');
    const units = splitPagesHtml(html);
    expect(units).toHaveLength(pages.length);
    expect(units.join('')).toBe(html);
  });

  it('٥ — المولّد الخامس (omr): عدد الوحدات يساوي عدد الأوراق وجمعها يساوي الأصل', () => {
    const spec: OmrSpec = { questions: 50, choices: 4, idDigits: 6, key: [] };
    const pages = Array.from({ length: 3 }, () => omrSheetHtml(spec));
    expect(pages).toHaveLength(3);

    const html = pages.join('');
    const units = splitPagesHtml(html);
    expect(units).toHaveLength(3);
    expect(units.join('')).toBe(html);
  });

  it('٦ — على الغلاف (علامة معاينة): الورقة بغلافها وحدة واحدة، لا يقسم داخله وجمعها يساوي الأصل', () => {
    const imp = impose({ w: 85.6, h: 54 }, 3);
    const plan = planSheets(imp, Array.from({ length: 180 }, (_, i) => i)); // 20 ورقة
    const pages = renderPlan(imp, plan, (i) => `<div>Card ${i}</div>`);
    expect(pages).toHaveLength(20);

    const wrappedHtml = pages
      .map(
        (p, idx) =>
          `<div style="position:relative;break-inside:avoid">${
            idx === pages.length - 1 ? p.replace(/page-break-after:\s*always;?/g, '').replace(/break-after:\s*page;?/g, '') : p
          }${tiledWatermark({ text: WATERMARK_PRESETS.preview, opacity: 0.2, sizeMm: 9 })}</div>`
      )
      .join('');

    const units = splitPagesHtml(wrappedHtml);
    expect(units).toHaveLength(20);
    expect(units.join('')).toBe(wrappedHtml);

    // كل وحدة تبدأ بالغلاف وتحوي print-page داخله بلا كسر ولا بتر
    for (const u of units) {
      expect(u.startsWith('<div style="position:relative;break-inside:avoid">')).toBe(true);
      expect(u.endsWith('</div>')).toBe(true);
      expect((u.match(/class="print-page"/g) ?? []).length).toBe(1);
    }
  });

  it('٧ — مع أنماط مسبقة (prefix): الأنماط تُحفظ في البداية وجمع الأجزاء يساوي الأصل', () => {
    const prefix = '<style>@page { margin: 0; } body { font-family: Cairo; }</style>';
    const imp = impose({ w: 85.6, h: 54 }, 3);
    const plan = planSheets(imp, Array.from({ length: 18 }, (_, i) => i)); // ورقتان
    const pages = renderPlan(imp, plan, (i) => `<div>Card ${i}</div>`);
    const wrappedHtml = prefix + pages.map((p) => `<div style="position:relative;break-inside:avoid">${p}</div>`).join('');

    const units = splitPagesHtml(wrappedHtml);
    expect(units).toHaveLength(2);
    expect(units.join('')).toBe(wrappedHtml);
    expect(units[0]!.startsWith(prefix)).toBe(true);
  });
});
