/**
 * طبقات Photoshop — ما يصير من مؤثّراتها في العنصر (DESIGNS.md ٢٫١)، وما لا يصير يُقال:
 *
 * - **النصّ**: الظلّ ظلُّه (بزاوية «الضوء العامّ» إن تبعه)، والحدّ حدُّه حول الحروف، واللون فوقه لونُه، والتدرّج فوقه تدرّجُه،
 *   والتشويه «قوسًا» قوسُه (١٫١٠)، وشفافية الطبقة شفافيّته.
 * - **إطار الصورة**: حدّ الحلقة فوق صورة الموظف، أو حدّ الدائرة التي تُقصّ فيها، حلقةٌ حولها (١٫١) — وإلا غطّتها الصورة.
 *
 * والأطوال بكسلاتُ الملف نِسَبًا من ارتفاعه (كحجم الخطّ `sizeFrac`) — فتصير نقاطًا وملّمات بالمقاس الذي يُعرف.
 */
import type { Gradient } from '@shared/design/paint';
import type { PsdLayer } from './psdTypes';

/** ما لم يُنقل: لكلّ سببٍ أسماء طبقاته — ويُقال سطرًا في التقرير. */
export class PsdLosses {
  private map = new Map<string, Set<string>>();
  add(reason: string, layer: string): void {
    const set = this.map.get(reason) ?? new Set<string>();
    set.add(layer || 'بلا اسم');
    this.map.set(reason, set);
  }
  lines(): string[] {
    return [...this.map].map(([reason, names]) => {
      const list = [...names];
      const shown = list.slice(0, 3).map((n) => `«${n}»`).join('، ');
      return `${reason}: ${shown}${list.length > 3 ? ` و${list.length - 3} غيرها` : ''}`;
    });
  }
}

export type TextStyleFrac = {
  shadowFrac?: { color: string; dx: number; dy: number; blur: number };
  outlineFrac?: { color: string; width: number };
  gradient?: Gradient;
  color?: string;
  arc?: number;
  opacity?: number;
};

const NORMAL = new Set(['norm', 'pass']);
/** أنماط المزج بأسمائها في Photoshop العربي. */
const BLEND: Record<string, string> = { mul: 'ضرب', scrn: 'شاشة', over: 'تراكب', 'sLit': 'ضوءٌ ناعم', hLit: 'ضوءٌ ساطع', diff: 'فرق', lddg: 'إضافة', dark: 'تعتيم', lite: 'تفتيح' };

/** شفافية الطبقة ونمط مزجها — للنصّ والصورة سواء. */
function common(layer: PsdLayer, losses: PsdLosses): { opacity?: number } {
  if (!NORMAL.has(layer.blend)) losses.add(`مزجٌ «${BLEND[layer.blend] ?? layer.blend}» رُسم عاديًّا`, layer.name);
  return layer.opacity < 0.99 ? { opacity: Math.round(layer.opacity * 100) / 100 } : {};
}

/** مؤثّرات طبقة النصّ — بأطوالٍ نِسَبًا من ارتفاع الملف `H`، وزاوية «الضوء العامّ» `globalAngle`. */
export function textStyle(layer: PsdLayer, H: number, globalAngle: number, losses: PsdLosses): TextStyleFrac {
  const out: TextStyleFrac = common(layer, losses);
  const fx = layer.effects;
  const k = 1 / H;
  if (fx?.shadow) {
    const a = ((fx.shadow.global ? globalAngle : fx.shadow.angle) * Math.PI) / 180;
    // الزاوية جهةُ الضوء: الظلّ عكسها — ١٢٠° ضوءٌ من أعلى اليسار وظلٌّ إلى أسفل اليمين.
    out.shadowFrac = { color: fx.shadow.color, dx: -Math.cos(a) * fx.shadow.distance * k, dy: Math.sin(a) * fx.shadow.distance * k, blur: fx.shadow.size * k };
  }
  if (fx?.stroke) {
    out.outlineFrac = { color: fx.stroke.color, width: (fx.stroke.position === 'outside' ? fx.stroke.size : fx.stroke.size / 2) * k };
    if (fx.stroke.position === 'inside') losses.add('حدٌّ داخل الحروف رُسم خارجها', layer.name);
  }
  // اللون فوق النصّ يغطّي التدرّج تحته (ترتيب Photoshop) — والشفيف منه لا يُغيّر اللون.
  if (fx?.overlay && fx.overlay.opacity >= 0.5) out.color = fx.overlay.color;
  else if (fx?.overlay) losses.add('لونٌ شفيفٌ فوق النصّ لم يُرسم', layer.name);
  if (fx?.gradient && !out.color) out.gradient = fx.gradient;
  for (const name of fx?.other ?? []) losses.add(`«${name}» لا يُرسم`, layer.name);

  const warp = layer.text?.warp;
  if (warp && (warp.style === 'warpArc' || warp.style === 'warpArch')) {
    const arc = Math.round(Math.max(-100, Math.min(100, warp.value)));
    if (arc) out.arc = arc;
  } else if (warp) losses.add('نصٌّ مشوَّه رُسم مستقيمًا (والقوس وحده يُنقل)', layer.name);
  if (layer.text?.vertical) losses.add('نصٌّ عموديّ رُسم أفقيًّا', layer.name);
  return out;
}

/** حلقةُ الصورة من حدّ الحلقة فوقها أو حدّ إطارها (الدائرة التي تُقصّ فيها) — بالنسبة من الارتفاع. */
export function photoFrame(ring: PsdLayer | undefined, base: PsdLayer | undefined, photo: PsdLayer, H: number, losses: PsdLosses): { frameFrac?: { color: string; width: number }; opacity?: number } {
  const out: { frameFrac?: { color: string; width: number }; opacity?: number } = common(photo, losses);
  const stroke = ring?.effects?.stroke ?? base?.effects?.stroke;
  if (stroke) out.frameFrac = { color: stroke.color, width: (stroke.position === 'center' ? stroke.size / 2 : stroke.size) / H };
  for (const name of photo.effects?.other ?? []) losses.add(`«${name}» على الصورة لا يُرسم`, photo.name);
  return out;
}
