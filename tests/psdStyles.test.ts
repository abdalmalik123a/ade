/**
 * مؤثّرات Photoshop ومجموعاته (DESIGNS.md ٢٫١): «الواصف» يُقرأ بأنواعه، ومؤثّرات الطبقة (`lfx2`) تصير ظلّ النصّ وحدّه
 * ولونه وتدرّجه، و«القوس» قوسَه، والحلقة فوق صورة الموظف حلقتَها، والمجموعات مجموعاتٍ في اللوحة — وما لا يُرسم يُقال
 * باسم طبقته. والملفّات تُبنى بسجلّاتها كما يكتبها Photoshop.
 */
import { describe, expect, it } from 'vitest';
import { unzlibSync } from 'fflate';
import { descColor, readDescriptor } from '../src/main/services/design/psdDescriptor';
import { psdGlobalAngle, readEffects } from '../src/main/services/design/psdEffects';
import { readTextLayer } from '../src/main/services/psdLayers';
import { canvasFromImport, psdDesign } from '../src/main/services/designImport';
import type { TextElement, ImageElement } from '../src/shared/canvas';
import { deg, descriptor, en, layeredPsd, lfx2, obj, on, pct, px, rgb, tagged, tyshFull, u32, type DV, type Rect } from './psdBuilder';
import { withNativePsd } from './helpers';

withNativePsd();

const ENGINE = '/EngineDict << /StyleRun << /RunArray [ << /StyleSheet << /StyleSheetData << /FontSize 8.0 >> >> >> ] >> >>';
const shadow = (o: { angle?: number; global?: boolean; distance?: number; size?: number; opacity?: number } = {}): [string, DV] => [
  'DrSh',
  obj('DrSh', [
    ['enab', on()],
    ['Md  ', en('BlnM', 'Mltp')],
    ['Clr ', rgb(0, 0, 0)],
    ['Opct', pct(o.opacity ?? 50)],
    ['uglg', on(o.global ?? false)],
    ['lagl', deg(o.angle ?? 90)],
    ['Dstn', px(o.distance ?? 10)],
    ['Ckmt', px(0)],
    ['blur', px(o.size ?? 4)]
  ])
];
const stroke = (position = 'OutF', size = 3): [string, DV] => [
  'FrFX',
  obj('FrFX', [
    ['enab', on()],
    ['Styl', en('FStl', position)],
    ['PntT', en('FrFl', 'SClr')],
    ['Sz  ', px(size)],
    ['Clr ', rgb(255, 255, 255)]
  ])
];
const bevel: [string, DV] = ['ebbl', obj('ebbl', [['enab', on()]])];

describe('الواصف ومؤثّرات الطبقة', () => {
  it('الواصف بأنواعه: كائنٌ وقائمةٌ وعددٌ بوحدته وتعدادٌ ونصّ', () => {
    const d = readDescriptor(descriptor('null', [['Scl ', pct(100)], ['list', { t: 'VlLs', items: [{ t: 'long', v: 7 }, { t: 'TEXT', v: 'نصّ' }] }], ['Md  ', en('BlnM', 'Nrml')], ['Clr ', rgb(10, 20, 30)]]))!;
    expect(d.cls).toBe('null');
    expect(d.items['Scl ']).toBe(100);
    expect(d.items['list']).toEqual([7, 'نصّ']);
    expect(d.items['Md  ']).toBe('Nrml');
    expect(descColor(d.items['Clr '])).toBe('#0a141e');
  });

  it('والألوان: رماديٌّ وCMYK وHSB، والشفافية حرفان في آخره', () => {
    expect(descColor({ cls: 'Grsc', items: { 'Gry ': 100 } })).toBe('#000000');
    expect(descColor({ cls: 'CMYC', items: { 'Cyn ': 0, Mgnt: 100, 'Ylw ': 100, Blck: 0 } })).toBe('#ff0000');
    expect(descColor({ cls: 'HSBC', items: { 'H   ': 120, Strt: 100, Brgh: 100 } })).toBe('#00ff00');
    expect(descColor({ cls: 'RGBC', items: { 'Rd  ': 0, 'Grn ': 0, 'Bl  ': 0 } }, 0.5)).toBe('#00000080');
  });

  it('المؤثّرات: الظلّ والحدّ واللون والتدرّج بقيمها، والنتوء يُسمّى — والمعطَّل ومفتاحها العامّ لا شيء', () => {
    const grad: [string, DV] = [
      'GrFl',
      obj('GrFl', [
        ['enab', on()],
        ['Angl', deg(90)],
        ['Type', en('GrdT', 'Lnr ')],
        ['Grad', obj('Grdn', [['Clrs', { t: 'VlLs', items: [obj('Clrt', [['Clr ', rgb(255, 215, 0)], ['Lctn', { t: 'long', v: 0 }]]), obj('Clrt', [['Clr ', rgb(150, 110, 30)], ['Lctn', { t: 'long', v: 4096 }]])] }]])]
      ])
    ];
    const fx = readEffects(lfx2([shadow({ angle: 120 }), stroke('CtrF', 4), grad, bevel]).subarray(12))!;
    expect(fx.shadow).toEqual({ color: '#00000080', angle: 120, global: false, distance: 10, size: 4 });
    expect(fx.stroke).toEqual({ color: '#ffffff', size: 4, position: 'center' });
    // ٩٠ في Photoshop من الأسفل إلى الأعلى = ٢٧٠ عندنا (من الأعلى مع العقارب).
    expect(fx.gradient).toEqual({ type: 'linear', angle: 270, stops: [{ offset: 0, color: '#ffd700' }, { offset: 1, color: '#966e1e' }] });
    expect(fx.other).toEqual(['نتوءٌ ونقش (Bevel)']);
    expect(readEffects(lfx2([['masterFXSwitch', on(false)], shadow()]).subarray(12))).toBeNull();
    expect(readEffects(lfx2([['DrSh', obj('DrSh', [['enab', on(false)]])]]).subarray(12))).toBeNull();
    // نوعٌ لا يُعرف يوقف القراءة — لا شيء خطأ.
    expect(readEffects(Buffer.concat([u32(0), u32(16), Buffer.from('garbage-garbage-garbage')]))).toBeNull();
  });

  it('وتشويه النصّ «قوسًا» بانحنائه، والعموديّ — من واصفي TySh', () => {
    const t = readTextLayer(tyshFull('عنوان', ENGINE, { style: 'warpArc', value: 40 }))!;
    expect(t.value).toBe('عنوان');
    expect(t.warp).toEqual({ style: 'warpArc', value: 40 });
    expect(readTextLayer(tyshFull('x', ENGINE))!.warp).toBeUndefined();
  });

  it('و«الضوء العامّ» من المورد ١٠٣٧ — و١٢٠ إن سكت الملف', () => {
    const base = { w: 4, h: 4, composite: () => [255, 255, 255], layers: [] };
    expect(psdGlobalAngle(layeredPsd({ ...base, globalAngle: 30 }))).toBe(30);
    expect(psdGlobalAngle(layeredPsd(base))).toBe(120);
  });
});

describe('psdDesign: المؤثّرات والقوس والحلقة والمجموعات في اللوحة', () => {
  const W = 80;
  const H = 60;
  const zero: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
  const circle = (r: Rect) => (x: number, y: number) => (Math.hypot(x - (r.left + r.right) / 2, y - (r.top + r.bottom) / 2) <= (r.right - r.left) / 2 ? 255 : 0);
  const frame: Rect = { top: 4, left: 4, bottom: 28, right: 28 };
  const file = layeredPsd({
    w: W,
    h: H,
    dpi: 72,
    globalAngle: 90,
    composite: () => [255, 255, 255],
    layers: [
      { name: 'BG', rect: { top: 0, left: 0, bottom: H, right: W }, color: () => [255, 255, 255] },
      // صورة الموظف مقصوصةٌ في دائرة، وفوقها حلقةٌ بحدٍّ وحده (كقوالب الهويّات).
      { name: '</Layer group>', rect: zero, divider: 3 },
      { name: 'Ellipse 1', rect: frame, color: () => [220, 220, 220], alpha: circle(frame) },
      { name: 'Image', rect: { top: 2, left: 2, bottom: 30, right: 30 }, color: () => [90, 60, 40], clipping: true },
      { name: 'Ring', rect: { top: 6, left: 6, bottom: 26, right: 26 }, color: () => [0, 0, 0], alpha: () => 0, extra: [lfx2([stroke('InsF', 2)])] },
      { name: 'Employee Image', rect: zero, divider: 1 },
      // مجموعة «الاسم»: نصّان — والعنوان المقوَّس بظلٍّ وحدٍّ ونتوء.
      { name: '</Layer group>', rect: zero, divider: 3 },
      { name: 'Name', rect: { top: 34, left: 40, bottom: 42, right: 76 }, color: () => [0, 0, 0], text: tyshFull('سالم حسن', ENGINE), extra: [lfx2([shadow({ global: true, distance: 6, size: 3 }), stroke('OutF', 1), bevel])] },
      { name: 'Job', rect: { top: 46, left: 40, bottom: 52, right: 76 }, color: () => [0, 0, 0], text: tyshFull('محاسب', ENGINE) },
      { name: 'Name and job', rect: zero, divider: 1 },
      { name: 'Title', rect: { top: 2, left: 36, bottom: 14, right: 78 }, color: () => [0, 0, 0], text: tyshFull('مدرسة النور', ENGINE, { style: 'warpArc', value: 35 }) },
      { name: 'Wave', rect: { top: 16, left: 36, bottom: 24, right: 78 }, color: () => [0, 0, 0], text: tyshFull('شعار', ENGINE, { style: 'warpWave', value: 20 }) }
    ]
  });
  const out = psdDesign(file, 'هوية.psd');
  const canvas = canvasFromImport(out, ['bg.png'])!;
  const text = (s: string) => canvas.elements.find((e): e is TextElement => e.kind === 'text' && e.inlines.some((i) => i.kind === 'run' && i.text.includes(s)))!;

  it('الظلّ بزاوية «الضوء العامّ» (٩٠: إلى الأسفل) بالنقاط، والحدّ حول الحروف', () => {
    const name = text('سالم');
    // ٧٢ نقطة/إنش: البكسل نقطة — والمقاس من الملف نفسه.
    expect(name.shadow).toMatchObject({ color: '#00000080', dy: 6, blur: 3 });
    expect(Math.abs(name.shadow!.dx)).toBeLessThan(0.01);
    expect(name.outline).toEqual({ color: '#ffffff', width: 1 });
  });

  it('و«القوس» قوسُه، والتشويه الآخر مستقيمٌ ويُقال', () => {
    expect(text('مدرسة').arc).toBe(35);
    expect(text('شعار').arc).toBeUndefined();
    expect(out.warnings.some((w) => w.startsWith('نصٌّ مشوَّه رُسم مستقيمًا') && w.includes('«Wave»'))).toBe(true);
  });

  it('والنتوء يُقال باسم طبقته — لا يسقط صامتًا', () => {
    expect(out.warnings).toContain('«نتوءٌ ونقش (Bevel)» لا يُرسم: «Name»');
  });

  it('والحلقة فوق صورة الموظف حلقتُها، والصورة دائرة', () => {
    const photo = canvas.elements.find((e): e is ImageElement => e.kind === 'image')!;
    expect(photo.shape).toBe('circle');
    expect(photo.frame?.color).toBe('#ffffff');
    // ٢ بكسل من ٦٠ ارتفاعًا، والارتفاع ٦٠ نقطة = ٢١٫١٧ ملم.
    expect(photo.frame?.width).toBeCloseTo((2 / 60) * ((60 / 72) * 25.4), 1);
  });

  it('والمجموعة مجموعةٌ في اللوحة: الاسم والوظيفة معًا، وما وحده بلا مجموعة', () => {
    const [name, job, title] = [text('سالم'), text('محاسب'), text('مدرسة')];
    expect(name.group).toBeTruthy();
    expect(job.group).toBe(name.group);
    expect(title.group).toBeUndefined();
  });
});

describe('psdDesign: الصورة التي تُستبدل («كائنٌ ذكيّ»)', () => {
  /** بكسلات PNG كما نكتبه (مرشّحٌ صفريّ). */
  const decode = (png: Uint8Array) => {
    const buf = Buffer.from(png);
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    const idat: Buffer[] = [];
    for (let at = 8; at < buf.length; ) {
      const len = buf.readUInt32BE(at);
      if (buf.toString('ascii', at + 4, at + 8) === 'IDAT') idat.push(buf.subarray(at + 8, at + 8 + len));
      at += 12 + len;
    }
    const raw = unzlibSync(Buffer.concat(idat));
    const rgba = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) rgba.set(raw.subarray(y * (w * 4 + 1) + 1, (y + 1) * (w * 4 + 1)), y * w * 4);
    return { w, h, rgba };
  };
  const sign: Rect = { top: 20, left: 10, bottom: 30, right: 40 };
  const ink = (x: number) => (x < 25 ? 255 : 0);
  const file = layeredPsd({
    w: 60,
    h: 40,
    composite: (x, y) => (y >= sign.top && y < sign.bottom && x >= sign.left && x < sign.right && ink(x) ? [20, 40, 160] : [255, 255, 255]),
    layers: [
      { name: 'BG', rect: { top: 0, left: 0, bottom: 40, right: 60 }, color: () => [255, 255, 255] },
      // التوقيع كائنٌ ذكيّ: نصفه حبرٌ أزرق ونصفه شفّاف — وطرفه خارج الورقة لا يُؤخذ.
      { name: 'Sign', rect: sign, color: () => [20, 40, 160], alpha: (x) => ink(x), extra: [tagged('SoLd', Buffer.alloc(8))] },
      // وكائنٌ ذكيّ بحجم الورقة خلفيةٌ — يبقى فيها.
      { name: 'Texture', rect: { top: 0, left: 0, bottom: 40, right: 60 }, color: () => [255, 255, 255], alpha: () => 0, extra: [tagged('SoLd', Buffer.alloc(8))] }
    ]
  });
  const out = psdDesign(file, 'هوية.psd');

  it('صورةً بموضعها وشفافيّتها، وتُمحى من الخلفية — والكبيرة بحجم الورقة تبقى خلفية', () => {
    const pictures = out.elements.filter((e) => e.kind === 'image');
    expect(pictures).toHaveLength(1);
    const el = pictures[0]!;
    expect(el.imageIndex).toBe(1);
    expect(el.box.w).toBeCloseTo(30 / 60);
    const png = decode(out.images[1]!.bytes);
    expect([png.w, png.h]).toEqual([30, 10]);
    expect([...png.rgba.slice(0, 4)]).toEqual([20, 40, 160, 255]);
    expect(png.rgba[(5 * 30 + 25) * 4 + 3]).toBe(0);
    // ممحوّةٌ من الخلفية: لا حبر أزرق في موضعها.
    const bg = decode(out.images[0]!.bytes);
    expect(bg.rgba[(25 * 60 + 12) * 4 + 2]).not.toBe(160);
  });

  it('وفي اللوحة صورةٌ بمصدرها فوق الخلفية — تُستبدل', () => {
    const canvas = canvasFromImport(out, ['bg.png', 'sign.png'])!;
    expect(canvas.background).toMatchObject({ kind: 'image', src: 'bg.png' });
    expect(canvas.elements.find((e): e is ImageElement => e.kind === 'image')).toMatchObject({ src: 'sign.png', fit: 'contain' });
  });
});
