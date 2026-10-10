/**
 * طبقات Photoshop — النصّ: سجلّ `TySh` وEngineData (الخطّ والحجم واللون والمحاذاة) (DESIGNS.md ٠٫٩).
 */
import { utf16be, type PsdText, type Rect } from './psdTypes';
import { readDescriptorAt } from './psdDescriptor';

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

  // بعد واصف النصّ (٥٦) واصفُ التشويه: نمطه («قوس»…) وانحناؤه، واتّجاه النصّ (عموديٌّ أم أفقيّ) في واصف النصّ (٢٫١).
  const textDesc = readDescriptorAt(data, 56);
  const warpDesc = textDesc && textDesc.end + 6 <= data.length ? readDescriptorAt(data, textDesc.end + 6) : null;
  const warpStyle = warpDesc?.desc.items['warpStyle'];
  const warpValue = warpDesc?.desc.items['warpValue'];
  const warp = typeof warpStyle === 'string' && warpStyle !== 'warpNone' ? { style: warpStyle, value: typeof warpValue === 'number' ? warpValue : 0 } : undefined;

  return {
    value,
    ...(warp && { warp }),
    ...(textDesc?.desc.items['Ornt'] === 'Vrtc' && { vertical: true }),
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
