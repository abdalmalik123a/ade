/**
 * مولّد `tests/fixtures/psd-styles.psd` لسيناريو `designPsdStyles` (DESIGNS.md ٢٫١): هويّةٌ صغيرة بطبقاتها كما
 * يكتبها Photoshop — صورة الموظف مقصوصةٌ في دائرةٍ وفوقها حلقة، ومجموعة اسمٍ ووظيفة والاسم بظلٍّ وحدٍّ ونتوء، وعنوانٌ مقوَّس،
 * وتوقيعٌ «كائنٌ ذكيّ». مختلَقةٌ كلّها (لا قالب من السوق)، وتُكتب مرّةً:
 *
 *   PSD_FIXTURE_OUT=tests/fixtures/psd-styles.psd npx vitest run tests/makePsdFixture.test.ts
 */
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { deg, en, layeredPsd, lfx2, obj, on, pct, px, rgb, tagged, tyshFull, type Layer, type Rect } from './psdBuilder';

const W = 360;
const H = 240;
const zero: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
const engine = (size: number) => `/EngineDict << /StyleRun << /RunArray [ << /StyleSheet << /StyleSheetData << /FontSize ${size}.0 /FillColor << /Type 1 /Values [ 1.0 0.12 0.23 0.54 ] >> >> >> >> ] >> /ParagraphRun << /Justification 2 >> >>`;
const circle = (r: Rect) => (x: number, y: number) => (Math.hypot(x - (r.left + r.right) / 2, y - (r.top + r.bottom) / 2) <= (r.right - r.left) / 2 ? 255 : 0);
const frame: Rect = { top: 60, left: 20, bottom: 140, right: 100 };
const sign: Rect = { top: 190, left: 230, bottom: 225, right: 340 };

it.runIf(process.env['PSD_FIXTURE_OUT'])('psd-styles.psd', () => {
  const layers: Layer[] = [
    { name: '</Layer group>', rect: zero, divider: 3 },
    { name: 'Ellipse 1', rect: frame, color: () => [210, 210, 210], alpha: circle(frame) },
    { name: 'Image', rect: { top: 55, left: 15, bottom: 145, right: 105 }, color: () => [120, 90, 70], clipping: true },
    {
      name: 'Ring',
      rect: { top: 62, left: 22, bottom: 138, right: 98 },
      color: () => [0, 0, 0],
      alpha: () => 0,
      extra: [lfx2([['FrFX', obj('FrFX', [['enab', on()], ['Styl', en('FStl', 'InsF')], ['PntT', en('FrFl', 'SClr')], ['Sz  ', px(4)], ['Clr ', rgb(46, 160, 67)]])]])]
    },
    { name: 'Employee Image', rect: zero, divider: 1 },
    { name: '</Layer group>', rect: zero, divider: 3 },
    {
      name: 'Line 1',
      rect: { top: 90, left: 130, bottom: 120, right: 340 },
      color: () => [30, 60, 140],
      text: tyshFull('سالم حسن', engine(24)),
      extra: [
        lfx2([
          ['DrSh', obj('DrSh', [['enab', on()], ['Clr ', rgb(0, 0, 0)], ['Opct', pct(40)], ['uglg', on()], ['lagl', deg(120)], ['Dstn', px(3)], ['blur', px(2)]])],
          ['FrFX', obj('FrFX', [['enab', on()], ['Styl', en('FStl', 'OutF')], ['PntT', en('FrFl', 'SClr')], ['Sz  ', px(1)], ['Clr ', rgb(255, 255, 255)]])],
          ['ebbl', obj('ebbl', [['enab', on()]])]
        ])
      ]
    },
    { name: 'Line 2', rect: { top: 128, left: 160, bottom: 148, right: 310 }, color: () => [90, 90, 90], text: tyshFull('محاسب', engine(14)) },
    { name: 'Name block', rect: zero, divider: 1 },
    { name: 'Headline', rect: { top: 10, left: 110, bottom: 50, right: 350 }, color: () => [30, 60, 140], text: tyshFull('مدرسة النور', engine(20), { style: 'warpArc', value: 30 }) },
    { name: 'Sign', rect: sign, color: () => [20, 40, 160], alpha: (x) => (x % 7 < 4 ? 255 : 0), extra: [tagged('SoLd', Buffer.alloc(8))] }
  ];
  const inside = (r: Rect, x: number, y: number) => x >= r.left && x < r.right && y >= r.top && y < r.bottom;
  const file = layeredPsd({
    w: W,
    h: H,
    dpi: 300,
    globalAngle: 120,
    composite: (x, y) => (inside(sign, x, y) && x % 7 < 4 ? [20, 40, 160] : circle(frame)(x, y) ? [120, 90, 70] : [250, 248, 240]),
    layers
  });
  writeFileSync(process.env['PSD_FIXTURE_OUT']!, file);
});
