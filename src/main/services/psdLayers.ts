/**
 * طبقات Photoshop — تُقرأ لتصير عناصر تُحرَّر، وتُمحى من الخلفية فلا تتكرّر.
 *
 * الصورة المسطَّحة في آخر الملف (`psd.ts`) هي الخلفية الصادقة: فيها المؤثّرات
 * والظلال التي لا نرسمها. لكنّ فيها أيضًا كلَّ نصٍّ وصورةٍ ورمز — فإن رُفعت هذه
 * عناصرَ فوقها ظهر كلٌّ منها مرّتين: المطبوعُ في الخلفية، والمحرَّرُ فوقه.
 *
 * فالخلفية تُؤخذ مسطَّحةً كما هي، **إلا مواضعَ ما صار عنصرًا**: تُعاد تلك وحدها
 * من الطبقات التي تحتها. ويُقاس الصدق على حلقةٍ حولها: إن خالف تركيبُنا صورةَ
 * Photoshop هناك (مؤثّرٌ لا نرسمه) مُلئ الموضع ممّا حوله بدل أن يُلصق فيه لونٌ
 * خاطئ.
 *
 * والبنية (Adobe Photoshop File Formats): سجلّاتُ الطبقات من القاع إلى القمّة،
 * ثم بياناتُ قنوات كلٍّ منها بالترتيب نفسه، وكلُّ قناةٍ بضغطها.
 */
import { unzlibSync } from 'fflate';
import { unpackBits } from './psd';

export type Rect = { top: number; left: number; bottom: number; right: number };

type Channel = { id: number; offset: number; length: number };

export type PsdText = {
  value: string;
  /** حجم الخطّ ببكسلات الملف — بعد تحويل الطبقة، لا الرقم الخام في EngineData. */
  sizePx: number;
  color: string;
  align: 'left' | 'right' | 'center';
  bold: boolean;
  italic: boolean;
  /** «كلّها كبيرة» في Photoshop: الكلمة تُكتب صغيرةً وتُرسم كبيرة. */
  caps: boolean;
  /** تباعد الحروف بوحدة em (Tracking ÷ ١٠٠٠). */
  tracking: number;
  font: string | null;
  /** ارتفاع السطر نسبةً من الخطّ — من Leading، و١٫٢ إن كان تلقائيًّا. */
  lineHeight: number;
  /** صندوقُ النصّ الملتفّ بإحداثيات الورقة — ولا صندوق للنصّ النقطيّ. */
  box?: Rect;
};

export type PsdLayer = {
  index: number;
  name: string;
  rect: Rect;
  channels: Channel[];
  blend: string;
  /** شفافية الطبقة مضروبةً في التعبئة وفي شفافية مجموعاتها — ٠..١. */
  opacity: number;
  clipping: boolean;
  /** مخفيّةٌ بنفسها أو بإحدى مجموعاتها. */
  hidden: boolean;
  mask: (Rect & { defaultColor: number }) | null;
  /** ١ و٢ رأسُ مجموعة، و٣ ذيلُها — وما سواها طبقةٌ ترسم. */
  divider: number;
  /** أسماء المجموعات من الأعلى إلى الطبقة. */
  groups: string[];
  text?: PsdText;
};

export type PsdDoc = {
  width: number;
  height: number;
  depth: number;
  colorMode: number;
  layers: PsdLayer[];
};

const toBuffer = (bytes: Uint8Array): Buffer =>
  Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);

const width = (r: Rect) => r.right - r.left;
const height = (r: Rect) => r.bottom - r.top;

function readRect(buf: Buffer, at: number): Rect {
  return {
    top: buf.readInt32BE(at),
    left: buf.readInt32BE(at + 4),
    bottom: buf.readInt32BE(at + 8),
    right: buf.readInt32BE(at + 12)
  };
}

function utf16be(bytes: Buffer): string {
  const copy = Buffer.from(bytes);
  if (copy.length % 2) return '';
  copy.swap16();
  return copy.toString('utf16le');
}

// ── النصّ: Txt والـEngineData ────────────────────────────────────────

/** سلسلة EngineData بين قوسين: UTF-16BE بعلامة ترتيب، و`\` يهرّب ما بعده. */
function engineString(latin: string, open: number): string {
  const bytes: number[] = [];
  for (let i = open + 1; i < latin.length; i++) {
    const code = latin.charCodeAt(i);
    if (code === 0x5c) {
      bytes.push(latin.charCodeAt(++i));
      continue;
    }
    if (code === 0x29) break;
    bytes.push(code);
  }
  const buf = Buffer.from(bytes);
  return buf[0] === 0xfe && buf[1] === 0xff ? utf16be(buf.subarray(2)) : buf.toString('latin1');
}

const hex = (v: number) =>
  Math.max(0, Math.min(255, Math.round(v * 255)))
    .toString(16)
    .padStart(2, '0');

/**
 * لون النصّ من `FillColor`: النوع ١ RGB والنوع ٢ CMYK، والقيم ٠..١ بعد
 * الشفافية. وCMYK هنا **حبرٌ** لا ضوء — بخلاف قنوات الصورة المخزَّنة مقلوبة.
 */
function engineColor(eng: string): string | null {
  const m = eng.match(/\/FillColor\s*<<\s*\/Type\s+(\d)\s*\/Values\s*\[([^\]]*)\]/);
  if (!m) return null;
  const v = m[2]!.trim().split(/\s+/).map(Number);
  if (v.some((n) => !Number.isFinite(n))) return null;
  if (m[1] === '1' && v.length >= 4) return `#${hex(v[1]!)}${hex(v[2]!)}${hex(v[3]!)}`;
  if (m[1] === '2' && v.length >= 5) {
    const k = 1 - v[4]!;
    return `#${hex((1 - v[1]!) * k)}${hex((1 - v[2]!) * k)}${hex((1 - v[3]!) * k)}`;
  }
  if (m[1] === '0' && v.length >= 2) return `#${hex(v[1]!).repeat(3)}`;
  return null;
}

const ALIGN: Record<string, PsdText['align']> = { '0': 'left', '1': 'right', '2': 'center', '3': 'left', '4': 'right', '5': 'center', '6': 'left' };

/**
 * يقرأ طبقة النصّ (`TySh`): النصَّ نفسه وأسلوبَ أوّل مقطعٍ منه.
 *
 * و`FontSize` في EngineData ليس حجمًا نهائيًّا: الطبقة تُحوَّل بمصفوفتها، فحجمُ
 * «Daniel Jakson» ٢١ نقطةً مضروبةً في ٢٫٤ — وقراءته خامًا أخرجت عناوين بنصف
 * حجمها، و«Sales manager» (٢٤٢ × ٠٫١) بعشرة أضعافه.
 */
export function readTextLayer(data: Buffer): PsdText | undefined {
  if (data.length < 50) return undefined;
  const yx = data.readDoubleBE(18);
  const yy = data.readDoubleBE(26);
  const scale = Math.hypot(yx, yy) || 1;

  const latin = data.toString('latin1');
  const txt = latin.indexOf('Txt TEXT');
  let value = '';
  if (txt >= 0 && txt + 12 <= data.length) {
    const count = data.readUInt32BE(txt + 8);
    const start = txt + 12;
    if (start + count * 2 <= data.length) value = utf16be(data.subarray(start, start + count * 2));
  }
  value = value.replace(/\0+$/, '').replace(/\r\n?/g, '\n');

  const at = latin.indexOf('/EngineDict');
  const eng = at >= 0 ? latin.slice(at) : latin;
  const num = (re: RegExp): number | null => {
    const m = eng.match(re);
    const n = m ? Number(m[1]) : NaN;
    return Number.isFinite(n) ? n : null;
  };
  const flag = (re: RegExp) => eng.match(re)?.[1] === 'true';

  // الخطوط في ResourceDict، والمقطع يشير إليها برقم.
  const fonts: string[] = [];
  const set = latin.indexOf('/FontSet', latin.indexOf('/ResourceDict'));
  if (set >= 0) {
    const end = latin.indexOf(']', set);
    let name = latin.indexOf('/Name (', set);
    while (name >= 0 && (end < 0 || name < end)) {
      fonts.push(engineString(latin, name + 6));
      name = latin.indexOf('/Name (', name + 7);
    }
  }
  const font = fonts[num(/\/Font\s+(\d+)/) ?? 0] ?? null;
  const fontSize = num(/\/FontSize\s+([\d.]+)/) ?? 12;
  const leading = flag(/\/AutoLeading\s+(true|false)/) ? null : num(/\/Leading\s+([\d.]+)/);

  // نصٌّ في صندوق (ShapeType ١) يلتفّ فيه: صندوقُه بإحداثيات النصّ، فيُحوَّل.
  let box: Rect | undefined;
  const bounds = eng.match(/\/BoxBounds\s*\[\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\]/);
  if (num(/\/ShapeType\s+(\d)/) === 1 && bounds) {
    const [l, t, r, b] = bounds.slice(1, 5).map(Number) as [number, number, number, number];
    const xx = data.readDoubleBE(2);
    const tx = data.readDoubleBE(34);
    const ty = data.readDoubleBE(42);
    box = {
      left: Math.round(tx + xx * l),
      top: Math.round(ty + yy * t),
      right: Math.round(tx + xx * r),
      bottom: Math.round(ty + yy * b)
    };
  }

  return {
    value,
    sizePx: fontSize * scale,
    lineHeight: leading && fontSize ? Math.max(0.8, Math.min(3, leading / fontSize)) : 1.2,
    box,
    color: engineColor(eng) ?? '#000000',
    align: ALIGN[String(num(/\/Justification\s+(\d)/) ?? 0)] ?? 'left',
    bold: flag(/\/FauxBold\s+(true|false)/) || /bold|black|heavy|demi/i.test(font ?? ''),
    italic: flag(/\/FauxItalic\s+(true|false)/) || /italic|oblique/i.test(font ?? ''),
    caps: num(/\/FontCaps\s+(\d)/) === 2,
    tracking: (num(/\/Tracking\s+(-?[\d.]+)/) ?? 0) / 1000,
    font
  };
}

// ── السجلّات ─────────────────────────────────────────────────────────

/**
 * يقرأ سجلّات الطبقات ومواضع قنواتها — بلا فكّ بكسل واحد.
 *
 * ويُرجع `null` لما ليس PSD (أو PSB بأطواله الثمانية)؛ وملفٌّ بلا طبقات يعود
 * بقائمةٍ فارغة لا بخطأ.
 */
export function parsePsdLayers(bytes: Uint8Array): PsdDoc | null {
  const buf = toBuffer(bytes);
  if (buf.length < 26 || buf.toString('ascii', 0, 4) !== '8BPS' || buf.readUInt16BE(4) !== 1) return null;
  const doc: PsdDoc = {
    height: buf.readUInt32BE(14),
    width: buf.readUInt32BE(18),
    depth: buf.readUInt16BE(22),
    colorMode: buf.readUInt16BE(24),
    layers: []
  };

  let at = 26;
  for (let i = 0; i < 2; i++) {
    if (at + 4 > buf.length) return doc;
    at += 4 + buf.readUInt32BE(at); // الصيغة اللونية، ثم الموارد
  }
  if (at + 10 > buf.length || buf.readUInt32BE(at) < 6) return doc;
  const infoLength = buf.readUInt32BE(at + 4);
  if (infoLength < 2) return doc;
  const infoEnd = Math.min(at + 8 + infoLength, buf.length);
  at += 8;
  const count = Math.abs(buf.readInt16BE(at));
  at += 2;

  type Raw = Omit<PsdLayer, 'groups'> & { ownHidden: boolean };
  const raw: Raw[] = [];

  for (let index = 0; index < count; index++) {
    if (at + 18 > infoEnd) return doc;
    const rect = readRect(buf, at);
    const channelCount = buf.readUInt16BE(at + 16);
    at += 18;
    const channels: Channel[] = [];
    for (let c = 0; c < channelCount; c++) {
      channels.push({ id: buf.readInt16BE(at), length: buf.readUInt32BE(at + 2), offset: 0 });
      at += 6;
    }
    if (at + 16 > infoEnd) return doc;
    const blend = buf.toString('ascii', at + 4, at + 8);
    const opacity = buf[at + 8]! / 255;
    const clipping = buf[at + 9] === 1;
    // البتّ الثاني «مخفيّة» — والمعيار يسمّيه «مرئية»، والعمل على خلافه.
    const ownHidden = (buf[at + 10]! & 2) !== 0;
    const extraLength = buf.readUInt32BE(at + 12);
    at += 16;
    const extraEnd = Math.min(at + extraLength, infoEnd);

    let p = at;
    let mask: PsdLayer['mask'] = null;
    const maskLength = buf.readUInt32BE(p);
    if (maskLength >= 18 && p + 22 <= extraEnd) {
      const r = readRect(buf, p + 4);
      const disabled = (buf[p + 21]! & 2) !== 0;
      if (!disabled && width(r) > 0 && height(r) > 0) mask = { ...r, defaultColor: buf[p + 20]! };
    }
    p += 4 + maskLength;
    if (p + 4 <= extraEnd) p += 4 + buf.readUInt32BE(p); // مجالات المزج

    let name = '';
    if (p < extraEnd) {
      const nameLength = buf[p]!;
      name = buf.toString('latin1', p + 1, Math.min(p + 1 + nameLength, extraEnd));
      p += Math.ceil((1 + nameLength) / 4) * 4;
    }

    let divider = 0;
    let fill = 1;
    let text: PsdText | undefined;
    while (p + 12 <= extraEnd) {
      const sig = buf.toString('ascii', p, p + 4);
      if (sig !== '8BIM' && sig !== '8B64') break;
      const key = buf.toString('ascii', p + 4, p + 8);
      const length = buf.readUInt32BE(p + 8);
      const data = buf.subarray(p + 12, Math.min(p + 12 + length, extraEnd));
      if (key === 'luni' && data.length >= 4) {
        const n = data.readUInt32BE(0);
        if (4 + n * 2 <= data.length) name = utf16be(data.subarray(4, 4 + n * 2)).replace(/\0+$/, '');
      } else if ((key === 'lsct' || key === 'lsdk') && data.length >= 4) {
        divider = data.readUInt32BE(0);
      } else if (key === 'iOpa' && data.length >= 1) {
        fill = data[0]! / 255;
      } else if (key === 'TySh') {
        text = readTextLayer(data);
      }
      p += 12 + length + (length % 2);
    }
    at = extraEnd;

    raw.push({ index, name: name.trim(), rect, channels, blend, opacity: opacity * fill, clipping, hidden: ownHidden, ownHidden, mask, divider, text });
  }

  // بيانات القنوات بعد السجلّات كلّها، بترتيبها.
  for (const layer of raw) {
    for (const channel of layer.channels) {
      channel.offset = at;
      at += channel.length;
    }
  }

  // المجموعات: رأسها فوق أبنائها في الملف (يُقرأ من القمّة)، وذيلها تحتهم.
  const stack: { name: string; hidden: boolean; opacity: number }[] = [];
  const groups = new Map<number, string[]>();
  for (let i = raw.length - 1; i >= 0; i--) {
    const layer = raw[i]!;
    const parent = stack[stack.length - 1];
    if (layer.divider === 3) {
      stack.pop();
      continue;
    }
    layer.hidden = layer.ownHidden || (parent?.hidden ?? false);
    layer.opacity *= parent?.opacity ?? 1;
    groups.set(i, stack.map((g) => g.name));
    if (layer.divider === 1 || layer.divider === 2) {
      stack.push({ name: layer.name, hidden: layer.hidden, opacity: layer.opacity });
    }
  }

  doc.layers = raw.map(({ ownHidden: _, ...layer }, i) => ({ ...layer, groups: groups.get(i) ?? [] }));
  return doc;
}

// ── البكسلات ─────────────────────────────────────────────────────────

/** يفكّ قناةً واحدة: خامًا، أو PackBits، أو ZIP بتنبّؤٍ أو بدونه. */
export function decodeChannel(bytes: Uint8Array, channel: Channel, w: number, h: number): Uint8Array | null {
  const buf = toBuffer(bytes);
  if (w <= 0 || h <= 0 || channel.length < 2 || channel.offset + 2 > buf.length) return null;
  const compression = buf.readUInt16BE(channel.offset);
  const start = channel.offset + 2;
  const end = Math.min(channel.offset + channel.length, buf.length);
  const out = new Uint8Array(w * h);

  if (compression === 0) {
    out.set(buf.subarray(start, Math.min(start + w * h, end)));
  } else if (compression === 1) {
    let data = start + h * 2;
    for (let y = 0; y < h && start + y * 2 + 2 <= end; y++) {
      const length = buf.readUInt16BE(start + y * 2);
      if (data + length > end) break;
      unpackBits(buf, data, length, out, y * w);
      data += length;
    }
  } else if (compression === 2 || compression === 3) {
    try {
      const plain = unzlibSync(buf.subarray(start, end));
      out.set(plain.subarray(0, w * h));
    } catch {
      return null;
    }
    if (compression === 3) {
      for (let y = 0; y < h; y++) for (let x = 1; x < w; x++) out[y * w + x] = (out[y * w + x]! + out[y * w + x - 1]!) & 255;
    }
  } else {
    return null;
  }
  return out;
}

/**
 * قنوات اللون بصيغة الملف نفسها: ٣ لـRGB، و٤ لـCMYK، وواحدةٌ للرماديّ.
 *
 * **والتركيب يجري فيها لا في RGB**: Photoshop يمزج حوافّ الحرف في CMYK حبرًا،
 * وتحويل CMYK إلى RGB ضربٌ (C × K) لا جمع — فمن مزج بعد التحويل أخرج حوافّ
 * الحرف الداكن على الأبيض رماديّةً، وبقي شبحُ الكلمة بعد محوها.
 */
export function colorChannels(doc: { colorMode: number }): number {
  return doc.colorMode === 4 ? 4 : doc.colorMode === 1 ? 1 : doc.colorMode === 3 ? 3 : 0;
}

/**
 * قيمٌ بصيغة الملف إلى RGB. وCMYK مخزَّنٌ **مقلوبًا** (٢٥٥ ورقٌ بلا حبر)،
 * فالمخزَّن «ضوءٌ باقٍ» يُضرب: R = C × K / ٢٥٥.
 */
function toRgb(k: number, v: ArrayLike<number>, at: number, out: Uint8Array, o: number): void {
  if (k === 3) {
    out[o] = v[at]!;
    out[o + 1] = v[at + 1]!;
    out[o + 2] = v[at + 2]!;
  } else if (k === 4) {
    const kk = v[at + 3]!;
    out[o] = Math.round((v[at]! * kk) / 255);
    out[o + 1] = Math.round((v[at + 1]! * kk) / 255);
    out[o + 2] = Math.round((v[at + 2]! * kk) / 255);
  } else {
    out[o] = out[o + 1] = out[o + 2] = v[at]!;
  }
}

/** بكسلات الطبقة بصيغة الملف (`k` قنواتٍ متتالية لكل بكسل) وشفافيتُها بقناعها. */
type Pixels = { rect: Rect; k: number; native: Uint8Array; alpha: Uint8Array };

/** بكسلات الطبقة على مستطيلها: ألوانها بصيغة الملف، وشفافيةٌ فيها قناعُها. */
export function layerPixels(bytes: Uint8Array, doc: PsdDoc, layer: PsdLayer): Pixels | null {
  const w = width(layer.rect);
  const h = height(layer.rect);
  const k = colorChannels(doc);
  if (w <= 0 || h <= 0 || doc.depth !== 8 || !k) return null;
  const plane = (id: number) => {
    const channel = layer.channels.find((c) => c.id === id);
    return channel ? decodeChannel(bytes, channel, w, h) : null;
  };
  const n = w * h;
  const native = new Uint8Array(n * k);
  for (let j = 0; j < k; j++) {
    // القناة الغائبة ورقٌ أبيض في CMYK (بلا حبر)، وسوادٌ في RGB.
    const p = plane(j);
    const missing = k === 4 ? 255 : 0;
    for (let i = 0; i < n; i++) native[i * k + j] = p ? p[i]! : missing;
  }

  const alpha = plane(-1) ?? new Uint8Array(n).fill(255);
  if (layer.mask && layer.channels.some((c) => c.id === -2)) {
    const m = layer.mask;
    const mw = width(m);
    const values = decodeChannel(bytes, layer.channels.find((c) => c.id === -2)!, mw, height(m));
    if (values) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = layer.rect.left + x - m.left;
          const dy = layer.rect.top + y - m.top;
          const v = dx >= 0 && dy >= 0 && dx < mw && dy < height(m) ? values[dy * mw + dx]! : m.defaultColor;
          alpha[y * w + x] = Math.round((alpha[y * w + x]! * v) / 255);
        }
      }
    }
  }
  return { rect: layer.rect, k, native, alpha };
}

/** يحسب مزج اللون بطريقة الطبقة — وما لا يُعرف منها يُرسم عاديًّا. */
function blendChannel(mode: string, b: number, s: number): number {
  switch (mode) {
    case 'mul ':
      return b * s;
    case 'scrn':
      return b + s - b * s;
    case 'over':
      return b <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s);
    case 'dark':
      return Math.min(b, s);
    case 'lite':
      return Math.max(b, s);
    case 'lddg':
      return Math.min(1, b + s);
    default:
      return s;
  }
}

const drawable = (layer: PsdLayer) =>
  layer.divider === 0 && !layer.hidden && layer.opacity > 0 && width(layer.rect) > 0 && height(layer.rect) > 0;

/**
 * يركّب الطبقات المرئية على مستطيلٍ من الورقة — إلا ما يُستثنى.
 *
 * والمزج على صيغة W3C بألوانٍ مضروبةٍ في شفافيتها. والطبقة المقصوصة
 * (`clipping`) تُرسم داخل شفافية قاعدتها، فإن غابت قاعدتها غابت معها.
 * **والمؤثّرات (الظلّ والإطار) لا تُرسم** — ولذلك يُقاس الناتج قبل أن يُؤخذ.
 */
export function compositeRect(
  bytes: Uint8Array,
  doc: PsdDoc,
  area: Rect,
  skip: Set<number>,
  /** إن وُجد: لا يُحسب إلا ما عُلِّم فيه — بإحداثيات الورقة. */
  only?: Uint8Array
): Float32Array {
  const aw = width(area);
  // لكل بكسل قنواتُ الملف مضروبةً في الشفافية، ثم الشفافية.
  const k = colorChannels(doc);
  const stride = k + 1;
  const out = new Float32Array(aw * height(area) * stride);
  // القاعدة تُقرأ عند الحاجة وحدها: أكثر القواعد لا يُقصّ بها شيء.
  let baseLayer: PsdLayer | null = null;
  let basePixels: Pixels | null | undefined;

  for (const layer of doc.layers) {
    if (layer.divider !== 0) {
      baseLayer = null;
      continue;
    }
    const clipped = layer.clipping;
    if (!drawable(layer) || skip.has(layer.index) || (clipped && !baseLayer)) {
      if (!clipped) baseLayer = null;
      continue;
    }
    if (!clipped) {
      baseLayer = layer;
      basePixels = undefined;
    }
    const top = Math.max(area.top, layer.rect.top);
    const bottom = Math.min(area.bottom, layer.rect.bottom);
    const left = Math.max(area.left, layer.rect.left);
    const right = Math.min(area.right, layer.rect.right);
    if (top >= bottom || left >= right) continue;
    const px = clipped || basePixels === undefined ? layerPixels(bytes, doc, layer) : basePixels;
    if (!clipped) basePixels = px;
    if (!px) continue;

    let clip: Pixels | null = null;
    if (clipped) {
      if (basePixels === undefined) basePixels = layerPixels(bytes, doc, baseLayer!);
      clip = basePixels;
      if (!clip) continue;
    }
    const lw = width(layer.rect);
    const cw = clip ? width(clip.rect) : 0;
    const ch = clip ? height(clip.rect) : 0;
    for (let y = top; y < bottom; y++) {
      for (let x = left; x < right; x++) {
        if (only && !only[y * doc.width + x]) continue;
        const li = (y - layer.rect.top) * lw + (x - layer.rect.left);
        let a = (px.alpha[li]! / 255) * layer.opacity;
        if (clip) {
          const cx = x - clip.rect.left;
          const cy = y - clip.rect.top;
          a *= cx >= 0 && cy >= 0 && cx < cw && cy < ch ? clip.alpha[cy * cw + cx]! / 255 : 0;
        }
        if (a <= 0) continue;
        const o = ((y - area.top) * aw + (x - area.left)) * stride;
        const ab = out[o + k]!;
        for (let c = 0; c < k; c++) {
          const s = px.native[li * k + c]! / 255;
          const cb = out[o + c]!;
          const bc = ab > 0 ? cb / ab : 0;
          out[o + c] = a * s * (1 - ab) + cb * (1 - a) + a * ab * blendChannel(layer.blend, bc, s);
        }
        out[o + k] = a + ab * (1 - a);
      }
    }
  }
  return out;
}

// ── المحو: المنطقة، والحلقة، والملء ─────────────────────────────────

/** قناعٌ على مستطيله لا على الورقة كلّها — فثلاثون نصًّا في A4 لا تأكل الذاكرة. */
type Region = { rect: Rect; on: Uint8Array };

const within = (r: Region, x: number, y: number) =>
  x >= r.rect.left && y >= r.rect.top && x < r.rect.right && y < r.rect.bottom
    ? r.on[(y - r.rect.top) * width(r.rect) + (x - r.rect.left)] === 1
    : false;

/** يوسّع المنطقة بمربّعٍ نصفُ قطره `r` — تمريرتان أفقيّة ثم رأسيّة، داخل الورقة. */
function dilate(region: Region, r: number, W: number, H: number): Region {
  const rect: Rect = {
    top: Math.max(0, region.rect.top - r),
    left: Math.max(0, region.rect.left - r),
    bottom: Math.min(H, region.rect.bottom + r),
    right: Math.min(W, region.rect.right + r)
  };
  const w = width(rect);
  const h = height(rect);
  const src = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (within(region, rect.left + x, rect.top + y)) src[y * w + x] = 1;
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0, run = -Infinity; x < w; x++) {
      if (src[y * w + x]) run = x;
      if (x - run <= r) tmp[y * w + x] = 1;
    }
    for (let x = w - 1, run = Infinity; x >= 0; x--) {
      if (src[y * w + x]) run = x;
      if (run - x <= r) tmp[y * w + x] = 1;
    }
  }
  const on = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    for (let y = 0, run = -Infinity; y < h; y++) {
      if (tmp[y * w + x]) run = y;
      if (y - run <= r) on[y * w + x] = 1;
    }
    for (let y = h - 1, run = Infinity; y >= 0; y--) {
      if (tmp[y * w + x]) run = y;
      if (run - y <= r) on[y * w + x] = 1;
    }
  }
  return { rect, on };
}

/** قاعدةُ الطبقة المقصوصة: أوّل ما تحتها غيرُ مقصوص، في مجموعتها. */
function clipBase(doc: PsdDoc, layer: PsdLayer): PsdLayer | null {
  if (!layer.clipping) return null;
  for (let i = layer.index - 1; i >= 0; i--) {
    const below = doc.layers[i]!;
    if (below.divider !== 0) return null;
    if (!below.clipping) return below;
  }
  return null;
}

/** موضعُ الطبقة على الورقة: ما كان فيه بكسلٌ منها — داخل قاعدتها إن قُصّت. */
function layerRegion(bytes: Uint8Array, doc: PsdDoc, layer: PsdLayer): Region | null {
  const rect: Rect = {
    top: Math.max(0, layer.rect.top),
    left: Math.max(0, layer.rect.left),
    bottom: Math.min(doc.height, layer.rect.bottom),
    right: Math.min(doc.width, layer.rect.right)
  };
  if (width(rect) <= 0 || height(rect) <= 0) return null;
  const px = layerPixels(bytes, doc, layer);
  const baseLayer = clipBase(doc, layer);
  const base = baseLayer ? layerPixels(bytes, doc, baseLayer) : null;
  const w = width(rect);
  const lw = width(layer.rect);
  const on = new Uint8Array(w * height(rect));
  for (let y = rect.top; y < rect.bottom; y++) {
    for (let x = rect.left; x < rect.right; x++) {
      let hit = px ? px.alpha[(y - layer.rect.top) * lw + (x - layer.rect.left)]! > 8 : true;
      if (hit && base) {
        const bx = x - base.rect.left;
        const by = y - base.rect.top;
        const bw = width(base.rect);
        hit = bx >= 0 && by >= 0 && bx < bw && by < height(base.rect) && base.alpha[by * bw + bx]! > 8;
      }
      if (hit) on[(y - rect.top) * w + (x - rect.left)] = 1;
    }
  }
  return { rect, on };
}

/**
 * يستعيد ما تحت حوافّ الحرف من الصورة نفسها.
 *
 * البكسل في الصورة المسطَّحة مزيجٌ: C = a·T + (1 − a)·B، والحرف (T) وشفافيته
 * (a) معلومان من طبقته — فالخلفية B = (C − a·T) / (1 − a). وهذا صادقٌ ولو كان
 * تحته نقشٌ لا نرسمه. وما غطّاه الحرف تمامًا (a قريبةٌ من ١) لا يُستعاد، فيُعلَّم
 * مجهولًا يُملأ من جيرانه.
 */
function unblend(
  rgba: Uint8Array,
  planes: Uint8Array[],
  W: number,
  H: number,
  px: Pixels,
  opacity: number,
  unknown: Uint8Array
): void {
  const lw = width(px.rect);
  const k = px.k;
  const under = new Uint8Array(k);
  for (let y = Math.max(0, px.rect.top); y < Math.min(H, px.rect.bottom); y++) {
    for (let x = Math.max(0, px.rect.left); x < Math.min(W, px.rect.right); x++) {
      const i = (y - px.rect.top) * lw + (x - px.rect.left);
      const a = (px.alpha[i]! / 255) * opacity;
      if (a <= 0.01) continue;
      const d = y * W + x;
      if (a >= 0.9) {
        unknown[d] = 1;
        continue;
      }
      // بصيغة الملف: فالمزج خطّيٌّ هناك لا في RGB.
      for (let c = 0; c < k; c++) {
        const b = (planes[c]![d]! - a * px.native[i * k + c]!) / (1 - a);
        under[c] = Math.max(0, Math.min(255, Math.round(b)));
      }
      toRgb(k, under, 0, rgba, d * 4);
    }
  }
}

/**
 * يملأ المجهول قشرةً قشرة: كلّ بكسلٍ مجهول له جارٌ معلوم يأخذ متوسّط جيرانه
 * المعلومين، ثم التي تليها. وجرّةُ الحرف رفيعة، فتُملأ في خطواتٍ قليلة من لون ما
 * يلاصقها — لا رقعًا مربّعة من هرمٍ مصغَّر.
 */
function peel(rgba: Uint8Array, W: number, H: number, unknown: Uint8Array, box: Rect): void {
  let pending: number[] = [];
  for (let y = box.top; y < box.bottom; y++) for (let x = box.left; x < box.right; x++) if (unknown[y * W + x]) pending.push(y * W + x);
  while (pending.length) {
    const next: number[] = [];
    const fills: [number, number, number, number][] = [];
    for (const d of pending) {
      const x = d % W;
      const y = (d - x) / W;
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const nd = ny * W + nx;
          if (unknown[nd]) continue;
          r += rgba[nd * 4]!;
          g += rgba[nd * 4 + 1]!;
          b += rgba[nd * 4 + 2]!;
          n++;
        }
      }
      if (n) fills.push([d, r / n, g / n, b / n]);
      else next.push(d);
    }
    if (!fills.length) {
      // جزيرةٌ لا جار لها معلوم: ورقٌ أبيض.
      for (const d of next) fills.push([d, 255, 255, 255]);
      next.length = 0;
    }
    for (const [d, r, g, b] of fills) {
      rgba[d * 4] = Math.round(r);
      rgba[d * 4 + 1] = Math.round(g);
      rgba[d * 4 + 2] = Math.round(b);
      rgba[d * 4 + 3] = 255;
      unknown[d] = 0;
    }
    pending = next;
  }
}

/**
 * الفرق المسموح بين تركيبنا وصورة Photoshop على الحلقة — متوسّطًا من ٢٥٥.
 *
 * قيس على قوالب حقيقية: ما صدق تركيبُه بقي دون ٢٫٧، وما تحته نقشٌ لا نرسمه
 * بدأ من ٣٫٤ — و١٠ كانت تقبل رقعةً حمراء مسطّحةً مكان نقشٍ مضلَّع فيظهر
 * الاسم شبحًا.
 */
const RING_TOLERANCE = 3;

/** ودونه فالتركيب صادقٌ تمامًا (تقريب الأعداد وحده) — يُقدَّم على كلّ استعادة. */
const EXACT = 0.8;

export type PsdBackground = {
  rgba: Uint8Array;
  /** مواضع أُعيدت من الطبقات تحتها. */
  rebuiltAreas: number;
  /** ومواضع مُلئت ممّا حولها لأنّ تحتها ما لا نرسمه. */
  filledAreas: number;
  /** الصورة المسطَّحة كانت بيضاء فرُكّبت الورقة كلّها من طبقاتها. */
  recomposed: boolean;
};

/** يسطّح ما ركّبناه على ورقٍ أبيض، في مواضعه من صورة الورقة. */
function flatten(f: Float32Array, k: number, area: Rect, W: number, into: Uint8Array, only?: Uint8Array): void {
  const aw = width(area);
  const px = new Uint8Array(k);
  for (let y = area.top; y < area.bottom; y++) {
    for (let x = area.left; x < area.right; x++) {
      const d = y * W + x;
      if (only && !only[d]) continue;
      const o = ((y - area.top) * aw + (x - area.left)) * (k + 1);
      const a = f[o + k]!;
      // الورق الأبيض ٢٥٥ في الصيغ كلّها: ضوءٌ كامل في RGB، ولا حبر في CMYK.
      for (let c = 0; c < k; c++) px[c] = Math.round(Math.min(1, f[o + c]! + (1 - a)) * 255);
      toRgb(k, px, 0, into, d * 4);
      into[d * 4 + 3] = 255;
    }
  }
}

/** صورةٌ بلونٍ واحد في كل مكان — كما يكتبها Photoshop بلا «توافقٍ أقصى». */
function isBlank(rgba: Uint8Array): boolean {
  const step = 4 * 97;
  for (let i = step; i < rgba.length; i += step) {
    if (rgba[i] !== rgba[0] || rgba[i + 1] !== rgba[1] || rgba[i + 2] !== rgba[2]) return false;
  }
  return true;
}

/**
 * يمحو من الصورة المسطَّحة مواضعَ الطبقات المستثناة.
 *
 * لكلّ طبقةٍ: موضعُها موسَّعًا ببكسلين أو ثلاثة (حوافّ الحروف الناعمة)، ثم
 * حلقةٌ حوله تُقارَن فيها صورتنا بصورة Photoshop. فإن اتّفقتا أُخذ تركيبُنا
 * للموضع كما هو. وإلا فتحته ما لا نرسمه (نقشٌ أو ظلٌّ من مؤثّرات Photoshop):
 * فيُستعاد ما تحت حوافّ الحرف حسابًا (`unblend`) ويُملأ جوفه من جيرانه.
 *
 * وملفٌّ حُفظ بلا «توافقٍ أقصى» صورتُه المسطَّحة بيضاء كلّها: فتُركَّب الورقة
 * من طبقاتها كاملةً — وإلا فتح المكتبُ ورقةً بيضاء وحقولًا عائمة.
 */
export function eraseLayers(
  bytes: Uint8Array,
  doc: PsdDoc,
  composite: Uint8Array | null,
  /** قنوات الصورة المسطَّحة بصيغة الملف — لاستعادة ما تحت حوافّ الحروف. */
  planes: Uint8Array[] | null,
  exclude: number[],
  dpi: number | null
): PsdBackground | null {
  const W = doc.width;
  const H = doc.height;
  const k = colorChannels(doc);
  const skip = new Set(exclude);

  if (!composite || isBlank(composite)) {
    if (!doc.layers.some(drawable)) return null;
    const full: Rect = { top: 0, left: 0, bottom: H, right: W };
    const rgba = new Uint8Array(W * H * 4);
    flatten(compositeRect(bytes, doc, full, skip), k, full, W, rgba);
    return { rgba, rebuiltAreas: skip.size, filledAreas: 0, recomposed: true };
  }

  const rgba = new Uint8Array(composite);
  const grow = Math.max(2, Math.round((dpi ?? 300) / 120));
  const erased = [...skip]
    .map((index) => doc.layers[index])
    .filter((l): l is PsdLayer => !!l && drawable(l))
    .flatMap((layer) => {
      const region = layerRegion(bytes, doc, layer);
      return region ? [{ layer, region: dilate(region, grow, W, H) }] : [];
    });
  if (!erased.length) return { rgba, rebuiltAreas: 0, filledAreas: 0, recomposed: false };

  // المواضع كلّها، وما يُحسب منها ومن حلقاتها — بإحداثيات الورقة.
  const inside = new Uint8Array(W * H);
  const needed = new Uint8Array(W * H);
  const rings = erased.map(({ region }) => dilate(region, grow + 1, W, H));
  const box: Rect = { top: H, left: W, bottom: 0, right: 0 };
  erased.forEach(({ region }, n) => {
    const ring = rings[n]!;
    for (let y = ring.rect.top; y < ring.rect.bottom; y++) {
      for (let x = ring.rect.left; x < ring.rect.right; x++) {
        if (!within(ring, x, y)) continue;
        needed[y * W + x] = 1;
        if (within(region, x, y)) inside[y * W + x] = 1;
      }
    }
    box.top = Math.min(box.top, ring.rect.top);
    box.left = Math.min(box.left, ring.rect.left);
    box.bottom = Math.max(box.bottom, ring.rect.bottom);
    box.right = Math.max(box.right, ring.rect.right);
  });

  const ours = new Uint8Array(W * H * 4);
  flatten(compositeRect(bytes, doc, box, skip, needed), k, box, W, ours, needed);

  // الحكم لكلّ موضعٍ على حلقته، ثم التطبيق — فلا يقرأ موضعٌ ما كتبه غيره.
  // ويُحسب فرقُ الدرجة أولًا ويُطرح: تركيبنا قد يخالف Photoshop بدرجةٍ واحدة
  // في كلّ مكان (طبقةُ تعديلٍ لا نرسمها)، فتظهر مواضع النصوص رقعًا أفتح على
  // خلفيةٍ فاتحة. وما بقي بعد الطرح هو الحكم.
  const judged = erased.map((_, n) => {
    const ring = rings[n]!;
    const sum = [0, 0, 0];
    let count = 0;
    for (let y = ring.rect.top; y < ring.rect.bottom; y++) {
      for (let x = ring.rect.left; x < ring.rect.right; x++) {
        const d = y * W + x;
        if (!within(ring, x, y) || inside[d]) continue;
        for (let c = 0; c < 3; c++) sum[c] += composite[d * 4 + c]! - ours[d * 4 + c]!;
        count++;
      }
    }
    const shift = sum.map((s) => (count ? s / count : 0)) as [number, number, number];
    let residual = 0;
    for (let y = ring.rect.top; y < ring.rect.bottom; y++) {
      for (let x = ring.rect.left; x < ring.rect.right; x++) {
        const d = y * W + x;
        if (!within(ring, x, y) || inside[d]) continue;
        for (let c = 0; c < 3; c++) residual += Math.abs(composite[d * 4 + c]! - ours[d * 4 + c]! - shift[c]!);
      }
    }
    const usable = count > 0 && shift.every((s) => Math.abs(s) <= 40);
    return { shift, residual: usable ? residual / (count * 3) : Infinity };
  });

  const unknown = new Uint8Array(W * H);
  let rebuiltAreas = 0;
  let filledAreas = 0;
  erased.forEach(({ layer, region }, n) => {
    const { shift, residual } = judged[n]!;
    const rebuild = () => {
      for (let y = region.rect.top; y < region.rect.bottom; y++) {
        for (let x = region.rect.left; x < region.rect.right; x++) {
          if (!within(region, x, y)) continue;
          const d = y * W + x;
          for (let c = 0; c < 3; c++) rgba[d * 4 + c] = Math.max(0, Math.min(255, Math.round(ours[d * 4 + c]! + shift[c]!)));
        }
      }
      rebuiltAreas++;
    };
    // تركيبٌ صادقٌ تمامًا يُؤخذ كما هو.
    if (residual <= EXACT) return rebuild();
    // والنصّ بعده يُستعاد من الصورة نفسها: صادقٌ فوق أيّ نقش، ما دام لونُ حرفه
    // في الصورة لونَ طبقته — لا لونًا يصبغه مؤثّر («تراكب لون»).
    const px = layer.text && !layer.clipping ? layerPixels(bytes, doc, layer) : null;
    if (px && planes?.length === k && trueColored(px, composite, W, H, layer.opacity)) {
      unblend(rgba, planes, W, H, px, layer.opacity, unknown);
      filledAreas++;
      return;
    }
    if (residual <= RING_TOLERANCE) return rebuild();
    // وما سوى ذلك يُملأ موضعه كلّه من حوله.
    for (let y = region.rect.top; y < region.rect.bottom; y++) {
      for (let x = region.rect.left; x < region.rect.right; x++) if (within(region, x, y)) unknown[y * W + x] = 1;
    }
    filledAreas++;
  });
  if (filledAreas) peel(rgba, W, H, unknown, box);
  return { rgba, rebuiltAreas, filledAreas, recomposed: false };
}

/** أيطابق لونُ الحرف المصمت في الصورة لونَ طبقته؟ */
function trueColored(px: Pixels, composite: Uint8Array, W: number, H: number, opacity: number): boolean {
  const lw = width(px.rect);
  const rgb = new Uint8Array(3);
  let diff = 0;
  let count = 0;
  for (let y = Math.max(0, px.rect.top); y < Math.min(H, px.rect.bottom); y++) {
    for (let x = Math.max(0, px.rect.left); x < Math.min(W, px.rect.right); x++) {
      const i = (y - px.rect.top) * lw + (x - px.rect.left);
      if ((px.alpha[i]! / 255) * opacity < 0.97) continue;
      const d = y * W + x;
      toRgb(px.k, px.native, i * px.k, rgb, 0);
      for (let c = 0; c < 3; c++) diff += Math.abs(composite[d * 4 + c]! - rgb[c]!);
      count += 3;
    }
  }
  return count > 0 && diff / count <= 12;
}

// ── ما يصير عنصرًا ──────────────────────────────────────────────────

export type PsdItem =
  | {
      kind: 'text';
      layer: number;
      /** اسم الطبقة في Photoshop — منه يُقترح الحقل (هـ٤). */
      name: string;
      rect: Rect;
      text: string;
      style: PsdText;
      /** سطرٌ واحد: يصغر ليسع بدل أن يُقصّ. */
      single: boolean;
    }
  | { kind: 'photo'; layer: number; rect: Rect; round: boolean }
  | { kind: 'barcode'; layer: number; rect: Rect };

/** شرائط الحبر في عدّادٍ: [بداية، نهاية) لكلّ شريط، والفجوات الصغيرة تُلحَم. */
function bands(counts: number[], minGap: number): [number, number][] {
  const out: [number, number][] = [];
  let start = -1;
  let gap = 0;
  for (let i = 0; i <= counts.length; i++) {
    const on = i < counts.length && counts[i]! > 0;
    if (on) {
      if (start < 0) start = i;
      gap = 0;
    } else if (start >= 0) {
      gap++;
      if (gap > minGap || i === counts.length) {
        out.push([start, i - gap + 1]);
        start = -1;
        gap = 0;
      }
    }
  }
  return out;
}

/**
 * يقسم طبقة النصّ أسطرًا — وسطرَ الجدولة قطعًا — بمواضعها من بكسلاتها.
 *
 * «Code:⇥⇥789456123» سطرٌ واحد في Photoshop، ومواضع الجدولة لا نرسمها: فيُقسم
 * عند أوسع فجوةٍ في حبره، ويصير عنوانٌ وقيمةٌ كلٌّ في موضعه — والقيمة تتحرّر
 * وحدها.
 */
function textPieces(bytes: Uint8Array, doc: PsdDoc, layer: PsdLayer, style: PsdText): PsdItem[] {
  const text = style.caps ? style.value.toUpperCase() : style.value;
  const lines = text.split('\n').filter((l) => l.trim());
  if (!lines.length) return [];
  const rect = layer.rect;
  const piece = (r: Rect, t: string, single: boolean): PsdItem => ({
    kind: 'text',
    layer: layer.index,
    name: layer.name,
    rect: r,
    text: t.replace(/\t+/g, ' ').trim(),
    style,
    single
  });

  // النصّ الملتفّ في صندوقه عنصرٌ واحدٌ بصندوقه: أسطره يصنعها العرض لا فواصله.
  if (style.box) return [piece(style.box, lines.join('\n'), false)];
  const px = layerPixels(bytes, doc, layer);
  if (!px) return [piece(rect, lines.join('\n'), false)];
  const w = width(rect);
  const h = height(rect);
  const ink = (i: number) => px.alpha[i]! > 64;
  const rows: number[] = [];
  for (let y = 0; y < h; y++) {
    let n = 0;
    for (let x = 0; x < w; x++) if (ink(y * w + x)) n++;
    rows.push(n);
  }
  const found = bands(rows, Math.max(1, Math.round(style.sizePx * 0.12)));
  // سطرٌ واحد في شرائط كثيرة: نصٌّ يلتفّ في صندوقه — يبقى عنصرًا واحدًا بصندوقه.
  if (lines.length === 1 && found.length > 1) return [piece(rect, lines[0]!, false)];
  // أسطرٌ لا تطابق شرائطها: تُقسم بالتساوي ولا يُخترع لها موضع.
  const spans =
    found.length === lines.length
      ? found
      : lines.map((_, i): [number, number] => [Math.round((i * h) / lines.length), Math.round(((i + 1) * h) / lines.length)]);

  const out: PsdItem[] = [];
  lines.forEach((line, i) => {
    const [t, b] = spans[i]!;
    const cols: number[] = new Array(w).fill(0);
    for (let y = t; y < b; y++) for (let x = 0; x < w; x++) if (ink(y * w + x)) cols[x]++;
    const words = bands(cols, Math.max(1, Math.round(style.sizePx * 0.35)));
    const lineRect: Rect = {
      top: rect.top + t,
      bottom: rect.top + b,
      left: rect.left + (words[0]?.[0] ?? 0),
      right: rect.left + (words[words.length - 1]?.[1] ?? w)
    };
    const parts = line
      .split(/\t+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length < 2 || words.length < parts.length) {
      out.push(piece(lineRect, line, true));
      return;
    }
    // أوسعُ الفجوات بعدد القطع ناقصًا واحدة، مرتّبةً من اليسار.
    const cuts = words
      .slice(1)
      .map((seg, k) => ({ at: k + 1, size: seg[0] - words[k]![1] }))
      .sort((a, z) => z.size - a.size)
      .slice(0, parts.length - 1)
      .map((g) => g.at)
      .sort((a, z) => a - z);
    const edges = [0, ...cuts, words.length];
    // العربية تُقرأ من اليمين: أوّل قطعةٍ منطقيًّا هي أقصى اليمين.
    const ordered = /[؀-ۿ]/.test(line) ? [...parts].reverse() : parts;
    ordered.forEach((part, k) => {
      const from = words[edges[k]!]!;
      const to = words[edges[k + 1]! - 1]!;
      out.push(piece({ ...lineRect, left: rect.left + from[0], right: rect.left + to[1] }, part, true));
    });
  });
  return out;
}

/** دائرةٌ؟ مربّعةُ الإطار، ومساحتها ربعُ باي منه تقريبًا. */
function isRound(bytes: Uint8Array, doc: PsdDoc, layer: PsdLayer): boolean {
  const w = width(layer.rect);
  const h = height(layer.rect);
  if (!w || !h || Math.abs(w - h) / Math.max(w, h) > 0.06) return false;
  if (/^(ellipse|circle|دائرة)/i.test(layer.name)) return true;
  const px = layerPixels(bytes, doc, layer);
  if (!px) return false;
  let on = 0;
  for (const a of px.alpha) if (a > 128) on++;
  const ratio = on / (w * h);
  return ratio > 0.74 && ratio < 0.83;
}

const SHAPE_NAME = /^(rectangle|rounded rectangle|shape|ellipse|circle|vector|polygon|line)\b/;

/**
 * ما يصير عنصرًا يُحرَّر: كلّ نصٍّ ظاهر، وصورةُ الشخص، والرمز.
 *
 * والصورة والرمز يُعرفان بأسماء طبقاتهم ومجموعاتهم — كما تسمّيها قوالب السوق
 * («Replace Image»، «Employee Image»، «QR Code») — فإن لم يُسمَّيا بقيا من
 * الخلفية ولم يُخمَّن مكانهما. وفي مجموعة الصورة تُقدَّم الطبقة المسمّاة، ثم
 * المقصوصة في إطارها، ولا يُؤخذ شكلٌ زخرفيّ صورةً.
 */
export function psdItems(bytes: Uint8Array, doc: PsdDoc): PsdItem[] {
  const items: PsdItem[] = [];
  const codes = new Set<string>();
  const photos = new Map<string, { layer: PsdLayer; rank: number }>();

  for (const layer of doc.layers) {
    if (!drawable(layer)) continue;
    if (layer.text) {
      items.push(...textPieces(bytes, doc, layer, layer.text));
      continue;
    }
    const name = layer.name.toLowerCase();
    const path = layer.groups.map((g) => g.toLowerCase()).join(' > ');
    const shape = SHAPE_NAME.test(name);

    if (/qr|barcode|bar code|باركود/.test(name) || (/qr|bar code|barcode/.test(path) && !shape)) {
      if (codes.has(path)) continue;
      codes.add(path);
      items.push({ kind: 'barcode', layer: layer.index, rect: layer.rect });
      continue;
    }
    if (/background|bg shape|top shape|(^| )bg( |$)/.test(path)) continue;
    const named = /replace (your )?(image|photo)|employee image|your photo|^photo$|^image$|صورة/.test(name);
    const inGroup = /employee image|photo|avatar|صورة/.test(path);
    const rank = named ? 3 : inGroup && layer.clipping ? 2 : inGroup && !shape ? 1 : 0;
    if (!rank) continue;
    const key = path || name;
    if ((photos.get(key)?.rank ?? 0) < rank) photos.set(key, { layer, rank });
  }

  for (const { layer } of photos.values()) {
    // المقصوصة تأخذ شكلَ قاعدتها: الصورة في دائرةٍ تُطبع في الدائرة.
    const frame = clipBase(doc, layer) ?? layer;
    items.push({
      kind: 'photo',
      layer: layer.index,
      rect: frame.rect,
      round: frame !== layer && isRound(bytes, doc, frame)
    });
  }
  return items.sort((a, z) => a.layer - z.layer);
}
