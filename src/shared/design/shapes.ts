/**
 * أشكال القصّ والإطار (DESIGNS.md ١٫١): الصورة تُقصّ بشكلٍ — دائرة، قوس باب، درع، منحنٍ، سداسي، ورقة — ويُرسم إطارها
 * على حدّه نفسه، حلقةً أو حلقتين.
 *
 * كلّ شكلٍ دالّةٌ خالصة من الصندوق بالبكسل إلى مسارٍ (`d`) — يُقصّ به (`clip-path: path()`) ويُرسم به الإطار (SVG): متّجهٌ
 * في الشاشة والـPDF والطابعة معًا (تجربة ٠٫١٠). و`inset` يصغّر الشكل داخل صندوقه بالبكسل — فالإطار والحلقة الثانية
 * تُرسم داخل الصندوق لا خارجه.
 */

export const IMAGE_SHAPES = ['rect', 'rounded', 'circle', 'arch', 'shield', 'blob', 'hexagon', 'leaf'] as const;
export type ImageShape = (typeof IMAGE_SHAPES)[number];

/** بأسمائها في الواجهة. */
export const SHAPE_LABELS: Record<ImageShape, string> = {
  rect: 'مستطيل',
  rounded: 'زوايا مدوّرة',
  circle: 'دائرة',
  arch: 'قوس باب',
  shield: 'درع',
  blob: 'منحنٍ',
  hexagon: 'سداسي',
  leaf: 'ورقة'
};

export function isImageShape(v: unknown): v is ImageShape {
  return (IMAGE_SHAPES as readonly unknown[]).includes(v);
}

/** لونٌ يُكتب في نمطٍ أو سمة: سداسيٌّ أو rgb()/rgba() أو اسمٌ — وما سواه لا يُقبل. */
export function cssColor(v: unknown, fallback: string): string {
  if (typeof v !== 'string') return fallback;
  const s = v.trim();
  return /^#[0-9a-f]{3,8}$/i.test(s) || /^rgba?\(\s*[\d.]+%?\s*(,\s*[\d.]+%?\s*){2,3}\)$/i.test(s) || /^[a-z]{3,20}$/i.test(s) ? s : fallback;
}

const n = (v: number) => (Math.round(v * 100) / 100).toString();

/** منحنى مغلقٌ ناعمٌ يمرّ بالنقاط (Catmull-Rom ← Bézier). */
function smooth(points: [number, number][]): string {
  const p = (i: number) => points[(i + points.length) % points.length]!;
  let d = `M${n(p(0)[0])} ${n(p(0)[1])}`;
  for (let i = 0; i < points.length; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${n(c1[0]!)} ${n(c1[1]!)} ${n(c2[0]!)} ${n(c2[1]!)} ${n(p2[0])} ${n(p2[1])}`;
  }
  return `${d} Z`;
}

/** مستطيلٌ بأنصاف أقطارٍ لكلّ زاوية: [أعلى يسار، أعلى يمين، أسفل يمين، أسفل يسار]. */
function roundedRect(x0: number, y0: number, x1: number, y1: number, r: [number, number, number, number]): string {
  const [tl, tr, br, bl] = r;
  return (
    `M${n(x0 + tl)} ${n(y0)} H${n(x1 - tr)}` +
    (tr ? ` A${n(tr)} ${n(tr)} 0 0 1 ${n(x1)} ${n(y0 + tr)}` : '') +
    ` V${n(y1 - br)}` +
    (br ? ` A${n(br)} ${n(br)} 0 0 1 ${n(x1 - br)} ${n(y1)}` : '') +
    ` H${n(x0 + bl)}` +
    (bl ? ` A${n(bl)} ${n(bl)} 0 0 1 ${n(x0)} ${n(y1 - bl)}` : '') +
    ` V${n(y0 + tl)}` +
    (tl ? ` A${n(tl)} ${n(tl)} 0 0 1 ${n(x0 + tl)} ${n(y0)}` : '') +
    ' Z'
  );
}

/**
 * مسار الشكل في صندوقٍ عرضه `w` وارتفاعه `h` بالبكسل، مصغَّرًا `inset` من كلّ جهة. و`radius` (٪ من نصف الضلع
 * الأقصر) للمستطيل القديم بزواياه — كما كان `border-radius`.
 */
export function shapePath(shape: ImageShape, w: number, h: number, inset = 0, radius = 0): string {
  const x0 = inset;
  const y0 = inset;
  const x1 = Math.max(x0 + 1, w - inset);
  const y1 = Math.max(y0 + 1, h - inset);
  const W = x1 - x0;
  const H = y1 - y0;
  const cx = x0 + W / 2;
  const cy = y0 + H / 2;
  const m = Math.min(W, H);
  switch (shape) {
    case 'rect': {
      const r = Math.min(m / 2, (m / 2) * (radius / 100));
      return roundedRect(x0, y0, x1, y1, [r, r, r, r]);
    }
    case 'rounded': {
      const r = m * 0.15;
      return roundedRect(x0, y0, x1, y1, [r, r, r, r]);
    }
    case 'circle':
      return `M${n(x0)} ${n(cy)} A${n(W / 2)} ${n(H / 2)} 0 1 1 ${n(x1)} ${n(cy)} A${n(W / 2)} ${n(H / 2)} 0 1 1 ${n(x0)} ${n(cy)} Z`;
    case 'arch': {
      const r = Math.min(W / 2, H);
      return `M${n(x0)} ${n(y1)} V${n(y0 + r)} A${n(W / 2)} ${n(r)} 0 0 1 ${n(x1)} ${n(y0 + r)} V${n(y1)} Z`;
    }
    case 'shield':
      return (
        `M${n(x0)} ${n(y0)} H${n(x1)} V${n(y0 + H * 0.55)}` +
        ` C${n(x1)} ${n(y0 + H * 0.82)} ${n(cx + W * 0.2)} ${n(y0 + H * 0.93)} ${n(cx)} ${n(y1)}` +
        ` C${n(cx - W * 0.2)} ${n(y0 + H * 0.93)} ${n(x0)} ${n(y0 + H * 0.82)} ${n(x0)} ${n(y0 + H * 0.55)} Z`
      );
    case 'blob': {
      // ثماني نقاطٍ حول الشكل البيضوي بأنصاف أقطارٍ متفاوتة — منحنٍ ثابتٌ لا عشوائي، وبهامشٍ فلا يتجاوز المنحنى صندوقه.
      const k = [0.96, 0.87, 0.93, 0.83, 0.96, 0.88, 0.91, 0.85];
      return smooth(k.map((f, i) => [cx + (W / 2) * f * Math.cos((i * Math.PI) / 4), cy + (H / 2) * f * Math.sin((i * Math.PI) / 4)]));
    }
    case 'hexagon':
      return `M${n(x0 + W * 0.25)} ${n(y0)} H${n(x1 - W * 0.25)} L${n(x1)} ${n(cy)} L${n(x1 - W * 0.25)} ${n(y1)} H${n(x0 + W * 0.25)} L${n(x0)} ${n(cy)} Z`;
    case 'leaf': {
      const r = m * 0.45;
      return roundedRect(x0, y0, x1, y1, [0, r, 0, r]);
    }
  }
}
