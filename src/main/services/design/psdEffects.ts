/**
 * طبقات Photoshop — المؤثّرات (`lfx2`، DESIGNS.md ٢٫١): ظلّ الطبقة وحدّها ولونٌ أو تدرّجٌ فوقها تُقرأ من الواصف فتصير ظلّ
 * النصّ وحدّه ولونه وتدرّجه (١٫١٠ و١٫٣)؛ وما سواها (النتوء والتوهّج والظلّ الداخلي واللمعة والنقش) يُسمّى ليُقال في
 * «ما لم يُنقل» — لا يسقط صامتًا.
 */
import type { Gradient } from '@shared/design/paint';
import { descColor, isDesc, num, readDescriptor, type Desc, type Value } from './psdDescriptor';

/** مؤثّرات الطبقة كما في الملف، ببكسلاته ودرجاته. */
export type PsdEffects = {
  shadow?: { color: string; angle: number; global: boolean; distance: number; size: number };
  stroke?: { color: string; size: number; position: 'outside' | 'inside' | 'center' };
  overlay?: { color: string; opacity: number };
  gradient?: Gradient;
  /** ما لا يُرسم بأسماء Photoshop العربية. */
  other: string[];
};

const OTHER: Record<string, string> = {
  IrSh: 'ظلٌّ داخلي',
  OrGl: 'توهّجٌ خارجي',
  IrGl: 'توهّجٌ داخلي',
  ebbl: 'نتوءٌ ونقش (Bevel)',
  ChFX: 'لمعة (Satin)',
  patternFill: 'نقشٌ فوق الطبقة',
  innerShadowMulti: 'ظلٌّ داخلي'
};

/** أوّل مؤثّرٍ مفعَّل باسمه — ومنه نسخه المتعدّدة في Photoshop الأحدث (`…Multi`). */
function first(items: Record<string, Value>, key: string, multi: string): Desc | null {
  const list = [items[key], ...(Array.isArray(items[multi]) ? (items[multi] as Value[]) : [])];
  for (const v of list) if (isDesc(v) && v.items['enab'] !== false) return v;
  return null;
}

/** مؤثّرات `lfx2`: الإصداران (٤ بايتات لكلٍّ) ثم الواصف. */
export function readEffects(data: Buffer): PsdEffects | null {
  if (data.length < 8) return null;
  const d = readDescriptor(data, 8);
  if (!d) return null;
  if (d.items['masterFXSwitch'] === false) return null;
  const out: PsdEffects = { other: [] };

  const sh = first(d.items, 'DrSh', 'dropShadowMulti');
  if (sh) {
    const color = descColor(sh.items['Clr '], num(sh.items['Opct'], 75) / 100);
    if (color) out.shadow = { color, angle: num(sh.items['lagl'], 120), global: sh.items['uglg'] !== false, distance: num(sh.items['Dstn'], 5), size: num(sh.items['blur'], 5) };
  }
  const st = first(d.items, 'FrFX', 'frameFXMulti');
  if (st && (st.items['PntT'] === undefined || st.items['PntT'] === 'SClr')) {
    const color = descColor(st.items['Clr '], num(st.items['Opct'], 100) / 100);
    const style = st.items['Styl'];
    if (color) out.stroke = { color, size: num(st.items['Sz  '], 3), position: style === 'InsF' ? 'inside' : style === 'CtrF' ? 'center' : 'outside' };
  } else if (st) out.other.push('حدٌّ متدرّج أو بنقش');

  const fill = first(d.items, 'SoFi', 'solidFillMulti');
  if (fill) {
    const color = descColor(fill.items['Clr ']);
    if (color) out.overlay = { color, opacity: num(fill.items['Opct'], 100) / 100 };
  }
  const gr = first(d.items, 'GrFl', 'gradientFillMulti');
  if (gr) {
    const g = gr.items['Grad'];
    const stops = isDesc(g) && Array.isArray(g.items['Clrs']) ? (g.items['Clrs'] as Value[]).filter(isDesc) : [];
    const colors = stops.map((s) => ({ offset: num(s.items['Lctn']) / 4096, color: descColor(s.items['Clr ']) })).filter((s): s is { offset: number; color: string } => Boolean(s.color));
    if (colors.length >= 2) {
      const reversed = gr.items['Rvrs'] === true;
      const ordered = (reversed ? colors.map((s) => ({ ...s, offset: 1 - s.offset })) : colors).sort((a, z) => a.offset - z.offset);
      // زاوية Photoshop عكس عقارب الساعة من اليمين، ونحن مع العقارب من الأعلى (`paint.ts`).
      const angle = (((360 - num(gr.items['Angl'], 90)) % 360) + 360) % 360;
      out.gradient = { type: gr.items['Type'] === 'Rdl ' ? 'radial' : 'linear', angle, stops: ordered.slice(0, 8) };
      if (gr.items['Type'] !== undefined && gr.items['Type'] !== 'Lnr ' && gr.items['Type'] !== 'Rdl ') out.other.push('تدرّجٌ بزاويةٍ أو انعكاس');
    } else out.other.push('تدرّجٌ فوق الطبقة');
  }
  for (const [key, label] of Object.entries(OTHER)) {
    const v = d.items[key];
    const on = isDesc(v) ? v.items['enab'] !== false : Array.isArray(v) && v.some((x) => isDesc(x) && x.items['enab'] !== false);
    if (on && !out.other.includes(label)) out.other.push(label);
  }
  return out.shadow || out.stroke || out.overlay || out.gradient || out.other.length ? out : null;
}

/**
 * «الضوء العامّ» في Photoshop (المورد ١٠٣٧): زاوية الظلّ الذي يتبعه (`uglg`) — ١٢٠ إن سكت الملف (افتراض Photoshop).
 */
export function psdGlobalAngle(bytes: Uint8Array): number {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  try {
    let at = 26;
    at += 4 + buf.readUInt32BE(at);
    const end = Math.min(at + 4 + buf.readUInt32BE(at), buf.length);
    let res = at + 4;
    while (res + 12 <= end && buf.toString('ascii', res, res + 4) === '8BIM') {
      const id = buf.readUInt16BE(res + 4);
      const nameLength = buf[res + 6]!;
      res += 6 + (nameLength % 2 === 0 ? nameLength + 2 : nameLength + 1);
      const size = buf.readUInt32BE(res);
      res += 4;
      if (id === 1037 && size >= 4) return buf.readInt32BE(res);
      res += size + (size % 2);
    }
  } catch {
    // ملفٌّ مبتور: الافتراض.
  }
  return 120;
}
