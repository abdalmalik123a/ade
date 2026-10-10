/**
 * ملفّات Photoshop للاختبار: طبقاتٌ وصورةٌ مسطَّحة كما يكتبها Photoshop (منقولٌ من `psdLayers.test.ts` ليشترك فيه اختبار
 * المؤثّرات) — وكاتبُ «واصفٍ» صغير لسجلّات المؤثّرات وتشويه النصّ (DESIGNS.md ٢٫١).
 */
export type Rect = { top: number; left: number; bottom: number; right: number };
export type Layer = {
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
  /** سجلّاتٌ إضافية بمفاتيحها (`lfx2` للمؤثّرات…). */
  extra?: Buffer[];
};

export const u16 = (n: number) => {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(n);
  return b;
};
export const u32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
};
export const utf16be = (s: string) => Buffer.from(s, 'utf16le').swap16();

export function tagged(key: string, data: Buffer): Buffer {
  return Buffer.concat([Buffer.from(`8BIM${key}`, 'ascii'), u32(data.length), data, Buffer.alloc(data.length % 2)]);
}

/** طبقة نصّ: المصفوفة، ثم `Txt `، ثم EngineData — ما يقرؤه القارئ وحده. */
export function tysh(text: string, engine: string, t: { xx?: number; yy?: number; tx?: number; ty?: number } = {}): Buffer {
  const head = Buffer.alloc(56);
  head.writeUInt16BE(1, 0);
  [t.xx ?? 1, 0, 0, t.yy ?? 1, t.tx ?? 0, t.ty ?? 0].forEach((v, i) => head.writeDoubleBE(v, 2 + i * 8));
  head.writeUInt16BE(50, 50);
  head.writeUInt32BE(16, 52);
  return Buffer.concat([head, Buffer.from('Txt TEXT', 'ascii'), u32(text.length), utf16be(text), Buffer.from(engine, 'latin1')]);
}

export const fontSet = (name: string) =>
  `/ResourceDict << /FontSet [ << /Name (${Buffer.concat([Buffer.from([0xfe, 0xff]), utf16be(name)]).toString('latin1')}) >> ] >>`;

/** ملف PSD بطبقاته وصورته المسطَّحة — RGB أو CMYK (مقلوبًا كما يخزّنه Photoshop). */
export function layeredPsd(o: { w: number; h: number; cmyk?: boolean; dpi?: number; globalAngle?: number; composite: (x: number, y: number) => number[]; layers: Layer[] }): Buffer {
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
  // «الضوء العامّ» (المورد ١٠٣٧) إن طُلب.
  const angle = Buffer.alloc(16);
  if (o.globalAngle !== undefined) {
    angle.write('8BIM', 0, 'ascii');
    angle.writeUInt16BE(1037, 4);
    angle.writeUInt32BE(4, 8);
    angle.writeInt32BE(o.globalAngle, 12);
  }
  const resources = o.globalAngle !== undefined ? Buffer.concat([res, angle]) : res;

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
      ...(l.text ? [tagged('TySh', l.text)] : []),
      ...(l.extra ?? [])
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
  return Buffer.concat([head, u32(0), u32(resources.length), resources, u32(section.length), section, u16(0), ...planes]);
}

// ── الواصف (Action Descriptor) — لسجلّات المؤثّرات وتشويه النصّ (٢٫١) ─────────────────

export type DV =
  | { t: 'Objc'; cls: string; items: [string, DV][] }
  | { t: 'VlLs'; items: DV[] }
  | { t: 'UntF'; unit: string; v: number }
  | { t: 'doub'; v: number }
  | { t: 'long'; v: number }
  | { t: 'bool'; v: boolean }
  | { t: 'enum'; type: string; v: string }
  | { t: 'TEXT'; v: string }
  | { t: 'tdta'; v: Buffer };

/** المفتاح: أربعة أحرف بطولٍ صفر، وما سواها بطوله. */
const dkey = (k: string) => (k.length === 4 ? Buffer.concat([u32(0), Buffer.from(k, 'latin1')]) : Buffer.concat([u32(k.length), Buffer.from(k, 'latin1')]));
/** نصٌّ يونيكود بطوله وصفرٍ في آخره كما يكتبه Photoshop. */
const dtext = (v: string) => Buffer.concat([u32(v.length + 1), utf16be(v), Buffer.alloc(2)]);

function dvalue(v: DV): Buffer {
  const type = Buffer.from(v.t, 'latin1');
  switch (v.t) {
    case 'Objc':
      return Buffer.concat([type, descriptor(v.cls, v.items)]);
    case 'VlLs':
      return Buffer.concat([type, u32(v.items.length), ...v.items.map(dvalue)]);
    case 'UntF': {
      const n = Buffer.alloc(8);
      n.writeDoubleBE(v.v);
      return Buffer.concat([type, Buffer.from(v.unit, 'latin1'), n]);
    }
    case 'doub': {
      const n = Buffer.alloc(8);
      n.writeDoubleBE(v.v);
      return Buffer.concat([type, n]);
    }
    case 'long': {
      const n = Buffer.alloc(4);
      n.writeInt32BE(v.v);
      return Buffer.concat([type, n]);
    }
    case 'bool':
      return Buffer.concat([type, Buffer.from([v.v ? 1 : 0])]);
    case 'enum':
      return Buffer.concat([type, dkey(v.type), dkey(v.v)]);
    case 'TEXT':
      return Buffer.concat([type, dtext(v.v)]);
    case 'tdta':
      return Buffer.concat([type, u32(v.v.length), v.v]);
  }
}

export function descriptor(cls: string, items: [string, DV][]): Buffer {
  return Buffer.concat([dtext(''), dkey(cls), u32(items.length), ...items.flatMap(([k, v]) => [dkey(k), dvalue(v)])]);
}

export const rgb = (r: number, g: number, b: number): DV => ({ t: 'Objc', cls: 'RGBC', items: [['Rd  ', { t: 'doub', v: r }], ['Grn ', { t: 'doub', v: g }], ['Bl  ', { t: 'doub', v: b }]] });
export const px = (v: number): DV => ({ t: 'UntF', unit: '#Pxl', v });
export const pct = (v: number): DV => ({ t: 'UntF', unit: '#Prc', v });
export const deg = (v: number): DV => ({ t: 'UntF', unit: '#Ang', v });
export const on = (v = true): DV => ({ t: 'bool', v });
export const en = (type: string, v: string): DV => ({ t: 'enum', type, v });
export const obj = (cls: string, items: [string, DV][]): DV => ({ t: 'Objc', cls, items });

/** سجلّ المؤثّرات `lfx2`: الإصداران ثم الواصف. */
export const lfx2 = (items: [string, DV][]) => tagged('lfx2', Buffer.concat([u32(0), u32(16), descriptor('null', items)]));

/** طبقة نصٍّ بواصفها الحقيقي (Txt وEngineData) ثم واصف التشويه — كما يكتبها Photoshop. */
export function tyshFull(text: string, engine: string, warp: { style: string; value: number } = { style: 'warpNone', value: 0 }, t: { tx?: number; ty?: number } = {}): Buffer {
  const head = Buffer.alloc(56);
  head.writeUInt16BE(1, 0);
  [1, 0, 0, 1, t.tx ?? 0, t.ty ?? 0].forEach((v, i) => head.writeDoubleBE(v, 2 + i * 8));
  head.writeUInt16BE(50, 50);
  head.writeUInt32BE(16, 52);
  const textDesc = descriptor('TxLr', [
    ['Txt ', { t: 'TEXT', v: text }],
    ['EngineData', { t: 'tdta', v: Buffer.from(engine, 'latin1') }]
  ]);
  const warpDesc = descriptor('warp', [
    ['warpStyle', en('warpStyle', warp.style)],
    ['warpValue', { t: 'doub', v: warp.value }],
    ['warpPerspective', { t: 'doub', v: 0 }],
    ['warpPerspectiveOther', { t: 'doub', v: 0 }],
    ['warpRotate', en('Ornt', 'Hrzn')]
  ]);
  return Buffer.concat([head, textDesc, u16(1), u32(16), warpDesc, Buffer.alloc(32)]);
}
