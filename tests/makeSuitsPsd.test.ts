/**
 * مولّد `tests/fixtures/suits-layers.psd` لاختبار `suitsPsd` وسيناريوهات القاط (S48، D204): ملفّ Photoshop بطبقاتٍ كما يكتبها المكتب —
 * قاطان مفرّغان («قاط أسود» و«قاط كحلي»: كتفان وفتحة رقبة) وخلفيةٌ بيضاء معتمة ونصٌّ وطبقةٌ مخفيّة لا تُعدّ قاطًا. مختلَقٌ كلّه (لا قاط من السوق)،
 * ويُكتب مرّةً:
 *
 *   PSD_FIXTURE_OUT=tests/fixtures/suits-layers.psd npx vitest run tests/makeSuitsPsd.test.ts
 */
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { layeredPsd, tyshFull, u16, u32, type Layer, type Rect } from './psdBuilder';
import { BLACK, NAVY, SUITS_H, SUITS_W, suitShape } from './suitsPsdShapes';

it.runIf(process.env['PSD_FIXTURE_OUT'])('suits-layers.psd', () => {
  const engine = `/EngineDict << /StyleRun << /RunArray [ << /StyleSheet << /StyleSheetData << /FontSize 18.0 >> >> >> ] >> >>`;
  const layers: Layer[] = [
    { name: 'خلفية', rect: { top: 0, left: 0, bottom: SUITS_H, right: SUITS_W }, color: () => [255, 255, 255] },
    { name: 'قاط أسود', rect: BLACK, color: () => [30, 30, 35], alpha: suitShape(BLACK) },
    { name: 'قاط كحلي', rect: NAVY, color: () => [20, 30, 80], alpha: suitShape(NAVY) },
    { name: 'مسودّة', rect: BLACK, color: () => [200, 0, 0], alpha: suitShape(BLACK), hidden: true },
    { name: 'عنوان', rect: { top: 10, left: 60, bottom: 40, right: 240 }, color: () => [90, 90, 90], text: tyshFull('قاط المكتب', engine) }
  ];
  const inside = (r: Rect, x: number, y: number) => x >= r.left && x < r.right && y >= r.top && y < r.bottom;
  const file = layeredPsd({
    w: SUITS_W,
    h: SUITS_H,
    composite: (x, y) =>
      inside(BLACK, x, y) && suitShape(BLACK)(x, y) ? [30, 30, 35] : inside(NAVY, x, y) && suitShape(NAVY)(x, y) ? [20, 30, 80] : [255, 255, 255],
    layers
  });
  writeFileSync(process.env['PSD_FIXTURE_OUT']!, file);
});

/** مثال D207: بلا طبقات، وRGB مع قناة شفافية رابعة في المسطّحة — مصنوعٌ بالكامل. */
it.runIf(process.env['PSD_FLAT_OUT'])('suits-flat.psd', () => {
  const w = 100, h = 80;
  const head = Buffer.alloc(26);
  head.write('8BPS', 0, 'ascii');
  head.writeUInt16BE(1, 4);
  head.writeUInt16BE(4, 12);
  head.writeUInt32BE(h, 14);
  head.writeUInt32BE(w, 18);
  head.writeUInt16BE(8, 22);
  head.writeUInt16BE(3, 24);
  const planes = Array.from({ length: 4 }, (_, c) => {
    const plane = Buffer.alloc(w * h, 40);
    if (c === 3) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) plane[y * w + x] = y > 30 && x > 20 && x < 80 && (x !== 50 || y !== 40) ? 255 : 0;
    return plane;
  });
  writeFileSync(process.env['PSD_FLAT_OUT']!, Buffer.concat([head, u32(0), u32(0), u32(0), u16(0), ...planes]));
});
