/**
 * طبقات Photoshop: ما يصير عنصرًا يُمحى من الخلفية، ولا يتكرّر.
 *
 * والملفّات هنا تُبنى بطبقاتها وصورتها المسطَّحة كما يكتبها Photoshop — فكلّ
 * اختبارٍ يقيس بكسلًا بعينه، لا «يبدو سليمًا».
 */
import { describe, expect, it } from 'vitest';
import { unzlibSync } from 'fflate';
import { writePng } from '../src/main/services/png';
import { readPsd } from '../src/main/services/psd';
import { eraseLayers, parsePsdLayers, psdItems, readTextLayer } from '../src/main/services/psdLayers';
import { psdDesign } from '../src/main/services/designImport';

type Rect = { top: number; left: number; bottom: number; right: number };
type Layer = {
  name: string;
  rect: Rect;
  color?: (x: number, y: number) => number[];
  alpha?: (x: number, y: number) => number;
  clipping?: boolean;
  hidden?: boolean;
  opacity?: number;
  /** ١ أو ٢ رأسُ مجموعة، و٣ ذيلُها. */
  divider?: number;
  text?: Buffer;
};

const u16 = (n: number) => {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(n);
  return b;
};
const u32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
};
const utf16be = (s: string) => Buffer.from(s, 'utf16le').swap16();

function tagged(key: string, data: Buffer): Buffer {
  return Buffer.concat([Buffer.from(`8BIM${key}`, 'ascii'), u32(data.length), data, Buffer.alloc(data.length % 2)]);
}

/** طبقة نصّ: المصفوفة، ثم `Txt `، ثم EngineData — ما يقرؤه القارئ وحده. */
function tysh(text: string, engine: string, t: { xx?: number; yy?: number; tx?: number; ty?: number } = {}): Buffer {
  const head = Buffer.alloc(56);
  head.writeUInt16BE(1, 0);
  [t.xx ?? 1, 0, 0, t.yy ?? 1, t.tx ?? 0, t.ty ?? 0].forEach((v, i) => head.writeDoubleBE(v, 2 + i * 8));
  head.writeUInt16BE(50, 50);
  head.writeUInt32BE(16, 52);
  return Buffer.concat([head, Buffer.from('Txt TEXT', 'ascii'), u32(text.length), utf16be(text), Buffer.from(engine, 'latin1')]);
}

const fontSet = (name: string) =>
  `/ResourceDict << /FontSet [ << /Name (${Buffer.concat([Buffer.from([0xfe, 0xff]), utf16be(name)]).toString('latin1')}) >> ] >>`;

/** ملف PSD بطبقاته وصورته المسطَّحة — RGB أو CMYK (مقلوبًا كما يخزّنه Photoshop). */
function layeredPsd(o: { w: number; h: number; cmyk?: boolean; dpi?: number; composite: (x: number, y: number) => number[]; layers: Layer[] }): Buffer {
  const k = o.cmyk ? 4 : 3;
  const head = Buffer.alloc(26);
  head.write('8BPS', 0, 'ascii');
  head.writeUInt16BE(1, 4);
  head.writeUInt16BE(k, 12);
  head.writeUInt32BE(o.h, 14);
  head.writeUInt32BE(o.w, 18);
  head.writeUInt16BE(8, 22);
  head.writeUInt16BE(o.cmyk ? 4 : 3, 24);

  const res = Buffer.alloc(28);
  res.write('8BIM', 0, 'ascii');
  res.writeUInt16BE(1005, 4);
  res.writeUInt32BE(16, 8);
  res.writeUInt32BE((o.dpi ?? 300) * 65536, 12);
  res.writeUInt32BE((o.dpi ?? 300) * 65536, 20);

  const records: Buffer[] = [];
  const data: Buffer[] = [];
  for (const l of o.layers) {
    const w = l.rect.right - l.rect.left;
    const h = l.rect.bottom - l.rect.top;
    const ids = [-1, ...Array.from({ length: k }, (_, i) => i)];
    const rect = Buffer.alloc(16);
    rect.writeInt32BE(l.rect.top, 0);
    rect.writeInt32BE(l.rect.left, 4);
    rect.writeInt32BE(l.rect.bottom, 8);
    rect.writeInt32BE(l.rect.right, 12);
    const info = Buffer.concat(ids.map((id) => Buffer.concat([Buffer.from([(id >> 8) & 255, id & 255]), u32(2 + w * h)])));
    const blend = Buffer.concat([
      Buffer.from('8BIMnorm', 'ascii'),
      Buffer.from([Math.round((l.opacity ?? 1) * 255), l.clipping ? 1 : 0, (l.hidden ? 2 : 0) | 8, 0])
    ]);
    const nameBytes = Buffer.from(l.name, 'latin1');
    const name = Buffer.alloc(Math.ceil((1 + nameBytes.length) / 4) * 4);
    name[0] = nameBytes.length;
    nameBytes.copy(name, 1);
    const extra = Buffer.concat([
      u32(0),
      u32(0),
      name,
      tagged('luni', Buffer.concat([u32(l.name.length), utf16be(l.name)])),
      ...(l.divider ? [tagged('lsct', u32(l.divider))] : []),
      ...(l.text ? [tagged('TySh', l.text)] : [])
    ]);
    records.push(Buffer.concat([rect, u16(ids.length), info, blend, u32(extra.length), extra]));
    for (const id of ids) {
      const plane = Buffer.alloc(w * h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const X = l.rect.left + x;
          const Y = l.rect.top + y;
          plane[y * w + x] = id === -1 ? (l.alpha?.(X, Y) ?? 255) : (l.color?.(X, Y)[id] ?? 0);
        }
      }
      data.push(Buffer.concat([u16(0), plane]));
    }
  }
  let layerInfo = Buffer.concat([u16(o.layers.length), ...records, ...data]);
  if (layerInfo.length % 2) layerInfo = Buffer.concat([layerInfo, Buffer.alloc(1)]);
  const section = Buffer.concat([u32(layerInfo.length), layerInfo, u32(0)]);

  const planes = Array.from({ length: k }, (_, c) => {
    const p = Buffer.alloc(o.w * o.h);
    for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) p[y * o.w + x] = o.composite(x, y)[c]!;
    return p;
  });
  return Buffer.concat([head, u32(0), u32(res.length), res, u32(section.length), section, u16(0), ...planes]);
}

const inside = (r: Rect, x: number, y: number) => x >= r.left && x < r.right && y >= r.top && y < r.bottom;
const rgbAt = (rgba: Uint8Array, w: number, x: number, y: number) => [...rgba.slice((y * w + x) * 4, (y * w + x) * 4 + 3)];

/** يفكّ PNG كما نكتبه (مرشّحٌ صفريّ): يثبت أنّه صورةٌ تُقرأ لا بايتاتٌ تالفة. */
function decodePng(png: Uint8Array): { w: number; h: number; rgba: Uint8Array } {
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
}

describe('PNG: صورةٌ تُقرأ', () => {
  /**
   * كانت الصورة تُضغط deflate خامًا بلا ترويسة zlib، ومعيار PNG يشترطها: فلا
   * يفكّها قارئ، وتُفتح هويّات Photoshop ورقةً بيضاء تحتها الحقول.
   */
  it('بيانات IDAT بصيغة zlib — وتُفكّ إلى البكسلات نفسها', () => {
    const rgba = new Uint8Array([255, 0, 0, 255, 0, 128, 255, 255]);
    const out = decodePng(writePng(rgba, 2, 1));
    expect([...out.rgba]).toEqual([...rgba]);
  });
});

describe('طبقة النصّ: الحجم بالمصفوفة، واللون والمحاذاة من EngineData', () => {
  const engine = (extra = '') =>
    `/EngineDict << /StyleRun << /RunArray [ << /StyleSheet << /StyleSheetData << /Font 0 /FontSize 10.0 /FauxBold false /FontCaps 2 /Tracking 100 /FillColor << /Type 1 /Values [ 1.0 1.0 0.0 0.0 ] >> >> >> >> ] >> /ParagraphRun << /Justification 2 >> ${extra} >> ${fontSet('Arial-Bold')}`;

  it('FontSize مضروبًا في تحويل الطبقة — لا خامًا', () => {
    const t = readTextLayer(tysh('Daniel\0', engine(), { yy: 2.4 }))!;
    expect(t.sizePx).toBeCloseTo(24);
    expect(t.value).toBe('Daniel');
  });

  it('واللون والمحاذاة و«كلّها كبيرة» وتباعد الحروف والخطّ', () => {
    const t = readTextLayer(tysh('x', engine()))!;
    expect(t).toMatchObject({ color: '#ff0000', align: 'center', caps: true, tracking: 0.1, font: 'Arial-Bold', bold: true });
  });

  it('ولون CMYK في EngineData حبرٌ لا ضوء', () => {
    const cmyk = engine().replace('/Type 1 /Values [ 1.0 1.0 0.0 0.0 ]', '/Type 2 /Values [ 1.0 0.0 1.0 1.0 0.0 ]');
    expect(readTextLayer(tysh('x', cmyk))!.color).toBe('#ff0000');
  });

  it('والنصّ في صندوق يعود بصندوقه بإحداثيات الورقة', () => {
    const t = readTextLayer(tysh('x', engine('/ShapeType 1 /BoxBounds [ 0.0 0.0 100.0 50.0 ]'), { tx: 10, ty: 20 }))!;
    expect(t.box).toEqual({ left: 10, top: 20, right: 110, bottom: 70 });
  });
});

describe('السجلّات: المجموعات تُخفي أبناءها', () => {
  it('ابنٌ في مجموعةٍ مخفيّة مخفيٌّ ولو ظهر بنفسه، ويعرف اسم مجموعته', () => {
    const file = layeredPsd({
      w: 4,
      h: 4,
      composite: () => [255, 255, 255],
      layers: [
        { name: '</Layer group>', rect: { top: 0, left: 0, bottom: 0, right: 0 }, divider: 3 },
        { name: 'child', rect: { top: 0, left: 0, bottom: 2, right: 2 }, color: () => [0, 0, 0] },
        { name: 'G', rect: { top: 0, left: 0, bottom: 0, right: 0 }, divider: 1, hidden: true }
      ]
    });
    const child = parsePsdLayers(file)!.layers[1]!;
    expect(child.hidden).toBe(true);
    expect(child.groups).toEqual(['G']);
  });
});

describe('المحو: ما صار عنصرًا لا يبقى في الخلفية', () => {
  const W = 40;
  const H = 24;
  const bg = [200, 220, 240];
  const block: Rect = { top: 8, left: 10, bottom: 16, right: 30 };

  it('نصٌّ على لونٍ مصمت: موضعه يعود لون الخلفية تمامًا', () => {
    const file = layeredPsd({
      w: W,
      h: H,
      composite: (x, y) => (inside(block, x, y) ? [0, 0, 0] : bg),
      layers: [
        { name: 'BG', rect: { top: 0, left: 0, bottom: H, right: W }, color: () => bg },
        { name: 'Name', rect: block, color: () => [0, 0, 0], text: tysh('N', '/EngineDict << /FontSize 8.0 >>') }
      ]
    });
    const read = readPsd(file)!;
    const doc = parsePsdLayers(file)!;
    const out = eraseLayers(file, doc, read.rgba, read.planes ?? null, [1], 300)!;
    for (let y = block.top; y < block.bottom; y++) {
      for (let x = block.left; x < block.right; x++) expect(rgbAt(out.rgba, W, x, y)).toEqual(bg);
    }
    expect(out.rebuiltAreas).toBe(1);
  });

  /**
   * CMYK ونقشٌ لا نرسمه: الخلفية في الصورة مخطّطة وطبقتها مصمتة (مؤثّرٌ في
   * Photoshop). فيُستعاد ما تحت حوافّ الحرف حسابًا — **بقنوات CMYK** — ويُملأ
   * جوفه من جيرانه. ولو مُزج في RGB لخرجت الحوافّ رماديّةً وبقي شبح الكلمة.
   */
  it('CMYK تحت نقش: حوافّ الحرف تُستعاد بالضبط، ولا يبقى منه أثر', () => {
    const stripe = (y: number) => [255, 255, 255, y % 2 ? 210 : 255]; // رماديٌّ فاتح بالتناوب
    // أسودُ غنيّ (حبرٌ في القنوات الأربع، مقلوبًا) كما تكتبه القوالب — وعليه
    // يفترق المزج في CMYK عن المزج في RGB: الاستعادة في RGB كانت تعطي ١٣٧ لا ٢١٠.
    const ink = [60, 60, 60, 20];
    const edge = (x: number) => (x === block.left || x === block.right - 1 ? 128 : 255);
    const file = layeredPsd({
      w: W,
      h: H,
      cmyk: true,
      composite: (x, y) => {
        if (!inside(block, x, y)) return stripe(y);
        const a = edge(x) / 255;
        return stripe(y).map((b, c) => Math.round(a * ink[c]! + (1 - a) * b));
      },
      layers: [
        { name: 'BG', rect: { top: 0, left: 0, bottom: H, right: W }, color: () => [255, 255, 255, 255] },
        { name: 'Name', rect: block, color: () => ink, alpha: (x) => edge(x), text: tysh('N', '/EngineDict << /FontSize 8.0 >>') }
      ]
    });
    const read = readPsd(file)!;
    const out = eraseLayers(file, parsePsdLayers(file)!, read.rgba, read.planes ?? null, [1], 300)!;
    expect(out.filledAreas).toBe(1);
    // الحافّة: الخطّ الذي تحتها بعينه — ٢١٠ رماديًّا في الصفّ الفرديّ. والفرق
    // درجةٌ أو اثنتان: تقريب الصورة إلى ثمانية بتّات يتضاعف عند نصف التغطية.
    for (const [y, v] of [
      [9, 210],
      [10, 255]
    ] as const) {
      for (const c of rgbAt(out.rgba, W, block.left, y)) expect(Math.abs(c - v)).toBeLessThanOrEqual(2);
    }
    // والجوف: لا بكسلَ قريبٌ من الأسود.
    for (let y = block.top; y < block.bottom; y++) {
      for (let x = block.left; x < block.right; x++) expect(Math.min(...rgbAt(out.rgba, W, x, y))).toBeGreaterThan(200);
    }
  });

  it('صورةٌ مسطَّحة بيضاء كلّها (حُفظ بلا «توافقٍ أقصى»): تُركَّب الورقة من طبقاتها', () => {
    const file = layeredPsd({
      w: W,
      h: H,
      composite: () => [255, 255, 255],
      layers: [
        { name: 'BG', rect: { top: 0, left: 0, bottom: H, right: W }, color: () => [200, 30, 30] },
        { name: 'Name', rect: block, color: () => [0, 0, 0], text: tysh('N', '/EngineDict << /FontSize 8.0 >>') }
      ]
    });
    const read = readPsd(file)!;
    const out = eraseLayers(file, parsePsdLayers(file)!, read.rgba, read.planes ?? null, [1], 300)!;
    expect(out.recomposed).toBe(true);
    expect(rgbAt(out.rgba, W, 15, 12)).toEqual([200, 30, 30]);
  });
});

describe('ما يصير عنصرًا', () => {
  const circle = (r: Rect) => (x: number, y: number) => {
    const cx = (r.left + r.right) / 2 - 0.5;
    const cy = (r.top + r.bottom) / 2 - 0.5;
    return Math.hypot(x - cx, y - cy) <= (r.right - r.left) / 2 ? 255 : 0;
  };
  const frame: Rect = { top: 4, left: 4, bottom: 24, right: 24 };

  const file = layeredPsd({
    w: 60,
    h: 40,
    composite: () => [255, 255, 255],
    layers: [
      { name: 'BG', rect: { top: 0, left: 0, bottom: 40, right: 60 }, color: () => [255, 255, 255] },
      { name: '</Layer group>', rect: { top: 0, left: 0, bottom: 0, right: 0 }, divider: 3 },
      { name: 'Ellipse 1', rect: frame, color: () => [220, 220, 220], alpha: circle(frame) },
      { name: 'Layer 1', rect: { top: 0, left: 0, bottom: 28, right: 28 }, color: () => [90, 60, 40], clipping: true },
      { name: 'Employee Image', rect: { top: 0, left: 0, bottom: 0, right: 0 }, divider: 1 },
      { name: 'QR Code', rect: { top: 4, left: 40, bottom: 16, right: 52 }, color: () => [0, 0, 0] },
      // «Code:⇥123» سطرٌ واحد بقطعتين بينهما فجوة.
      {
        name: 'Info',
        rect: { top: 30, left: 30, bottom: 36, right: 58 },
        color: () => [0, 0, 0],
        alpha: (x) => (x < 38 || x >= 48 ? 255 : 0),
        text: tysh('Code:\t123', '/EngineDict << /FontSize 6.0 /Justification 0 >>')
      }
    ]
  });
  const items = psdItems(file, parsePsdLayers(file)!);

  it('الصورة في دائرةٍ تأخذ إطار دائرتها، وتُعلَّم مستديرة', () => {
    expect(items.find((i) => i.kind === 'photo')).toMatchObject({ rect: frame, round: true });
  });

  it('والرمز يُعرف باسم طبقته', () => {
    expect(items.find((i) => i.kind === 'barcode')).toMatchObject({ rect: { left: 40, right: 52 } });
  });

  it('وسطر الجدولة قطعتان، كلٌّ في موضع حبره', () => {
    const texts = items.filter((i) => i.kind === 'text');
    expect(texts.map((t) => t.kind === 'text' && t.text)).toEqual(['Code:', '123']);
    expect(texts.map((t) => [t.rect.left, t.rect.right])).toEqual([
      [30, 38],
      [48, 58]
    ]);
  });
});

describe('psdDesign: الخلفية ممحوّة، والنصّ عنصرٌ بشكله', () => {
  it('صورةٌ تُقرأ بلا النصّ، والنصّ عنصرٌ بلونه وحجمه نسبةً', async () => {
    const bg = [30, 40, 90];
    const name: Rect = { top: 20, left: 10, bottom: 30, right: 50 };
    const file = layeredPsd({
      w: 60,
      h: 40,
      composite: (x, y) => (inside(name, x, y) ? [255, 122, 18] : bg),
      layers: [
        { name: 'BG', rect: { top: 0, left: 0, bottom: 40, right: 60 }, color: () => bg },
        {
          name: 'Name',
          rect: name,
          color: () => [255, 122, 18],
          text: tysh(
            'Daniel',
            '/EngineDict << /FontSize 5.0 /FillColor << /Type 1 /Values [ 1.0 1.0 0.47843 0.07059 ] >> /Justification 2 >>',
            { yy: 2 }
          )
        }
      ]
    });
    const out = psdDesign(file, 'هوية.psd');
    const png = decodePng(out.images[0]!.bytes);
    expect(rgbAt(png.rgba, 60, 30, 25)).toEqual(bg);
    const text = out.elements.find((e) => e.kind === 'text')!;
    expect(text).toMatchObject({ color: '#ff7a12', align: 'center', dir: 'ltr' });
    expect(text.sizeFrac).toBeCloseTo(10 / 40);
    // واسم الطبقة يصل إلى العنصر مقترحًا حقلَه (هـ٤) — من الملف نفسه لا من كائنٍ مصنوع.
    expect(text).toMatchObject({ layerName: 'Name', suggest: { value: 'الاسم' } });
    const { canvasFromImport, layerSuggestions } = await import('../src/main/services/designImport');
    const canvas = canvasFromImport(out, []);
    expect(layerSuggestions(out, canvas)).toMatchObject([{ layer: 'Name', sample: 'Daniel', key: 'الاسم' }]);
  });
});
