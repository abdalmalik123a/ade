/**
 * طبقات Photoshop — «الواصف» (Action Descriptor، DESIGNS.md ٢٫١): الصيغة العامّة التي يحفظ بها Photoshop مؤثّرات الطبقة
 * (`lfx2`) وتشويه النصّ (`TySh`) — شجرةٌ من مفاتيح وأنواع: كائنٌ (`Objc`)، وقائمةٌ (`VlLs`)، وعددٌ بوحدته (`UntF`)، ونصٌّ،
 * وتعدادٌ… يُقرأ منه ما نحتاجه، وما لا نعرف نوعه يوقف القراءة (فلا يُقرأ بعده شيءٌ خطأ).
 */
export type Value = number | string | boolean | Desc | Value[] | null;
export type Desc = { cls: string; items: Record<string, Value> };

class Reader {
  constructor(
    private buf: Buffer,
    public at = 0
  ) {}
  u32() {
    const v = this.buf.readUInt32BE(this.at);
    this.at += 4;
    return v;
  }
  i32() {
    const v = this.buf.readInt32BE(this.at);
    this.at += 4;
    return v;
  }
  f64() {
    const v = this.buf.readDoubleBE(this.at);
    this.at += 8;
    return v;
  }
  ascii(n: number) {
    const v = this.buf.toString('latin1', this.at, this.at + n);
    this.at += n;
    return v;
  }
  /** مفتاحٌ بطوله — والصفر مفتاحٌ من أربعة أحرف. */
  key() {
    const n = this.u32();
    return this.ascii(n || 4);
  }
  unicode() {
    const n = this.u32();
    const bytes = Buffer.from(this.buf.subarray(this.at, this.at + n * 2));
    this.at += n * 2;
    bytes.swap16();
    return bytes.toString('utf16le').replace(/\0+$/, '');
  }
  descriptor(): Desc {
    this.unicode(); // الاسم
    const cls = this.key();
    const count = this.u32();
    const items: Record<string, Value> = {};
    for (let i = 0; i < count; i++) {
      const k = this.key();
      items[k] = this.value(this.ascii(4));
    }
    return { cls, items };
  }
  value(type: string): Value {
    switch (type) {
      case 'Objc':
      case 'GlbO':
        return this.descriptor();
      case 'VlLs': {
        const n = this.u32();
        const out: Value[] = [];
        for (let i = 0; i < n; i++) out.push(this.value(this.ascii(4)));
        return out;
      }
      case 'doub':
        return this.f64();
      case 'UntF':
        this.ascii(4); // الوحدة: #Pxl #Prc #Ang …
        return this.f64();
      case 'UnFl': {
        this.ascii(4);
        const n = this.u32();
        const out: number[] = [];
        for (let i = 0; i < n; i++) out.push(this.f64());
        return out;
      }
      case 'long':
        return this.i32();
      case 'comp':
        this.at += 8;
        return null;
      case 'bool':
        return this.buf[this.at++] !== 0;
      case 'TEXT':
        return this.unicode();
      case 'enum':
        this.key();
        return this.key();
      case 'type':
      case 'GlbC':
        this.unicode();
        return this.key();
      case 'alis':
      case 'tdta':
      case 'Pth ': {
        const n = this.u32();
        this.at += n;
        return null;
      }
      default:
        throw new Error(`نوعٌ غير معروف في الواصف: ${type}`);
    }
  }
}

/** يقرأ الواصف من بدايته — و`null` إن لم يُفهم. */
export function readDescriptor(buf: Buffer, at = 0): Desc | null {
  try {
    return new Reader(buf, at).descriptor();
  } catch {
    return null;
  }
}


/** الواصف وموضع ما بعده (فيُقرأ ما يليه في السجلّ) — و`null` إن لم يُفهم. */
export function readDescriptorAt(buf: Buffer, at = 0): { desc: Desc; end: number } | null {
  try {
    const r = new Reader(buf, at);
    const desc = r.descriptor();
    return { desc, end: r.at };
  } catch {
    return null;
  }
}

export const isDesc = (v: Value | undefined): v is Desc => typeof v === 'object' && v !== null && !Array.isArray(v);
export const num = (v: Value | undefined, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const hex2 = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');

/** لون الواصف (RGB أو رماديّ أو CMYK أو HSB) بصيغة #rrggbb — وشفافيّته إن أُعطيت. */
export function descColor(v: Value | undefined, opacity = 1): string | null {
  if (!isDesc(v)) return null;
  const c = v.items;
  let rgb: [number, number, number] | null = null;
  if (v.cls === 'RGBC') rgb = [num(c['Rd  ']), num(c['Grn ']), num(c['Bl  '])];
  else if (v.cls === 'Grsc') {
    const g = 255 * (1 - num(c['Gry ']) / 100);
    rgb = [g, g, g];
  } else if (v.cls === 'CMYC') {
    const k = 1 - num(c['Blck']) / 100;
    rgb = [255 * (1 - num(c['Cyn ']) / 100) * k, 255 * (1 - num(c['Mgnt']) / 100) * k, 255 * (1 - num(c['Ylw ']) / 100) * k];
  } else if (v.cls === 'HSBC') {
    const h = (num(c['H   ']) % 360) / 60;
    const s = num(c['Strt']) / 100;
    const b = num(c['Brgh']) / 100;
    const f = (n: number) => {
      const k = (n + h) % 6;
      return 255 * b * (1 - s * Math.max(0, Math.min(k, 4 - k, 1)));
    };
    rgb = [f(5), f(3), f(1)];
  }
  if (!rgb) return null;
  const a = opacity < 0.999 ? hex2(opacity * 255) : '';
  return `#${rgb.map(hex2).join('')}${a}`;
}

