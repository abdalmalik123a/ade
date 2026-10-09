/**
 * الجدول (DESIGNS.md ١٫٩): صفٌّ بلونه وخطّه، وحدودٌ كاملة أو أسطرٌ أفقية أو بلا حدود، وبلا صفّ عناوين — والقديم كما كان.
 * ولقطتان: إمساكيةٌ يومُها الحاضر ملوّن، ومنيو بأسطرٍ وحدها بلا عناوين.
 */
import { describe, expect, it } from 'vitest';
import { canvasDoc, emptyCanvas, normalizeCanvas, SCREEN_DPI, tableElement } from '../src/shared/canvas';
import { renderCanvasHtml } from '../src/shared/canvasHtml';

const box = { x: 0.05, y: 0.05, w: 0.9, h: 0.9 };
const render = (patch: Record<string, unknown>) =>
  renderCanvasHtml(canvasDoc(normalizeCanvas({ size: { w: 148, h: 210 }, elements: [{ ...tableElement({ id: 't', box }), ...patch }] })), {}, { dpi: SCREEN_DPI });

describe('الجدول', () => {
  it('القديم بحدوده الكاملة وعناوينه كما كان', () => {
    const html = render({});
    expect(html).toContain('<thead>');
    expect(html).toContain('<td style="border:1px solid #cbd5e1;');
  });

  it('وأسطرٌ أفقية وحدها، أو بلا حدود', () => {
    expect(render({ borders: 'rows' })).toContain('<td style="border:none;border-bottom:1px solid #cbd5e1;');
    expect(render({ borders: 'rows' })).toContain('border-bottom:2px solid #cbd5e1');
    const none = render({ borders: 'none' });
    expect(none).not.toContain('solid #cbd5e1');
    expect(render({ borders: 'dotted' })).toContain('<td style="border:1px solid #cbd5e1;');
  });

  it('وبلا صفّ العناوين', () => {
    expect(render({ hideHeader: true })).not.toContain('<thead>');
  });

  it('وصفٌّ بلونه وخطّه وعرضه — يغلب التقليم — والتالف يُقوَّم', () => {
    const html = render({ stripe: true, rowStyles: [null, { bg: '#fff3c4', color: '#7a1e2c', bold: true }, { bg: 'red;x' }, { bg: '#000' }] });
    expect(html).toContain('<tr style="background:#fff3c4;color:#7a1e2c;">');
    expect(html).toContain('<tr style="background:#fff7d6;">');
    // صفوف الجدول الافتراضي ثلاثة: النمط الرابع لا صفّ له.
    expect(html).not.toContain('background:#000');
    const el = normalizeCanvas({ size: { w: 1, h: 1 }, elements: [{ ...tableElement({ id: 't', box }), rowStyles: [{}, null] }] }).elements[0]!;
    expect('rowStyles' in el).toBe(false);
  });

  it('لقطتا الإمساكية والمنيو', async () => {
    const imsak = tableElement({
      id: 'imsak',
      box: { x: 0.05, y: 0.05, w: 0.9, h: 0.45 },
      columns: [
        { title: 'اليوم', widthPercent: 30, align: 'center' },
        { title: 'الإمساك', widthPercent: 35, align: 'center' },
        { title: 'الإفطار', widthPercent: 35, align: 'center' }
      ],
      rows: [
        [{ text: '١' }, { text: '٤:١٢' }, { text: '٧:٠٥' }],
        [{ text: '٢' }, { text: '٤:١١' }, { text: '٧:٠٦' }],
        [{ text: '٣' }, { text: '٤:١٠' }, { text: '٧:٠٧' }]
      ],
      rowStyles: [null, { bg: '#fde68a', bold: true }, null],
      stripe: true
    });
    const menu = tableElement({
      id: 'menu',
      box: { x: 0.05, y: 0.55, w: 0.9, h: 0.4 },
      columns: [
        { title: 'الصنف', widthPercent: 70, align: 'right' },
        { title: 'السعر', widthPercent: 30, align: 'left' }
      ],
      rows: [
        [{ text: 'شاي عراقي' }, { text: '٥٠٠' }],
        [{ text: 'قهوة عربية' }, { text: '١٠٠٠' }]
      ],
      borders: 'rows',
      hideHeader: true
    });
    const canvas = { ...emptyCanvas({ w: 148, h: 210 }), elements: [imsak, menu] };
    const html = renderCanvasHtml(canvasDoc(normalizeCanvas(canvas)), {}, { dpi: SCREEN_DPI }).replace(/></g, '>\n<');
    await expect(`${html}\n`).toMatchFileSnapshot('./snapshots/renderer/table-styles.html');
  });
});
