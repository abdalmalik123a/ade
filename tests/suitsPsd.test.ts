/**
 * القاط من Photoshop (S48، D204): كلّ طبقةٍ مفرّغةٍ ترسم قاطٌ باسمها، ولا خلفيةٌ معتمة ولا نصٌّ ولا مخفيّة؛ والشفافية محفوظة
 * والقاط مقصوصٌ على حدّه؛ وبلا طبقاتٍ صالحة فالمسطّحة المفرّغة قاطٌ واحد، والمعتمة رسالةٌ تقول ما يُصلحه.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { NO_PSD_CUTOUT, suitsFromPsd } from '../src/main/services/suitsPsd';
import { setNativePsdReader } from '../src/main/services/psd';
import { layeredPsd } from './psdBuilder';
import { BLACK, suitShape } from './suitsPsdShapes';

const FLAT = new Uint8Array(readFileSync(join(__dirname, 'fixtures', 'suits-flat.psd')));
const FIXTURE = new Uint8Array(readFileSync(join(__dirname, 'fixtures', 'suits-layers.psd')));
const flat = (w: number, h: number, alpha: (x: number, y: number) => number) => {
  const rgba = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rgba.set([40, 40, 40, alpha(x, y)], (y * w + x) * 4);
  return rgba;
};
afterEach(() => setNativePsdReader(null));

describe('القاط من Photoshop', () => {
  it('المثال: قاطان باسميهما — ولا الخلفية المعتمة ولا النصّ ولا المخفيّة', () => {
    const suits = suitsFromPsd(FIXTURE, 'suits-layers');
    expect(suits.map((s) => s.name)).toEqual(['قاط أسود', 'قاط كحلي']);
  });

  it('مقصوصٌ على حدّ ما يرسم، والشفافية محفوظة: زاويتا الأعلى وفتحة الرقبة شفّافة، والأسفل مرسوم', () => {
    const [black] = suitsFromPsd(FIXTURE, 'x');
    const { rgba, width, height } = black!;
    expect(width).toBeLessThanOrEqual(BLACK.right - BLACK.left);
    expect(height).toBeLessThanOrEqual(BLACK.bottom - BLACK.top);
    const a = (x: number, y: number) => rgba[(y * width + x) * 4 + 3];
    expect(a(0, 0)).toBe(0);
    expect(a(width - 1, 0)).toBe(0);
    expect(a(Math.floor(width / 2), 0)).toBe(0);
    expect(a(Math.floor(width / 2), height - 1)).toBe(255);
    expect([...rgba.subarray(((height - 1) * width + 2) * 4, ((height - 1) * width + 2) * 4 + 3)]).toEqual([30, 30, 35]);
  });

  it('ملفٌّ بطبقةٍ واحدةٍ مفرّغة قاطٌ واحد باسمها', () => {
    const one = layeredPsd({ w: 160, h: 120, composite: () => [255, 255, 255], layers: [{ name: 'قاط رمادي', rect: BLACK, color: () => [90, 90, 90], alpha: suitShape(BLACK) }] });
    expect(suitsFromPsd(new Uint8Array(one), 'ملف').map((s) => s.name)).toEqual(['قاط رمادي']);
  });

  it('بلا طبقاتٍ صالحة: المسطّحة المفرّغة قاطٌ باسم الملفّ، والمعتمة ← الرسالة', () => {
    const opaqueOnly = new Uint8Array(layeredPsd({ w: 100, h: 80, composite: () => [255, 255, 255], layers: [{ name: 'خلفية', rect: { top: 0, left: 0, bottom: 80, right: 100 }, color: () => [255, 255, 255] }] }));
    setNativePsdReader(() => ({ width: 100, height: 80, dpi: null, warnings: [], rgba: flat(100, 80, (x, y) => (y > 30 && x > 20 && x < 80 && (x !== 50 || y !== 40) ? 255 : 0)) }));
    expect(suitsFromPsd(FLAT, 'قاط الملف').map((s) => [s.name, s.width, s.height])).toEqual([['قاط الملف', 59, 49]]);
    setNativePsdReader(() => ({ width: 100, height: 80, dpi: null, warnings: [], rgba: flat(100, 80, () => 255) }));
    expect(() => suitsFromPsd(opaqueOnly, 'x')).toThrow(NO_PSD_CUTOUT);
    expect(() => suitsFromPsd(new Uint8Array(Buffer.from('ليس PSD')), 'x')).toThrow('الملف ليس ملفّ Photoshop');
  });
});
