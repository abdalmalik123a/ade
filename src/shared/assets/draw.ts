/**
 * أدوات رسم عناصر ديوان المحزومة (DESIGNS.md ١٫٤): دائرةٌ ومستطيلٌ مدوّر ومضلّعٌ وقطعٌ ناقص مائل — مساراتٌ في مربّع
 * ٠..١٠٠ تُجمع في مسارٍ واحد يُملأ بقاعدة `nonzero`: **الشكل مع عقارب الساعة والثقب عكسها**، فتتّحد الأشكال وتُثقب الثقوب.
 * فكلّ أيقونةٍ عنصرٌ حرّ (`kinds/path.ts`) يُلوَّن ويُدرَّج ويُكبَّر بلا فقد.
 */

const n = (v: number) => (Math.round(v * 100) / 100).toString();
type Pt = [number, number];

/** دائرةٌ — والثقب (`hole`) عكس عقارب الساعة. */
export function circle(cx: number, cy: number, r: number, hole = false): string {
  const s = hole ? 0 : 1;
  return `M${n(cx - r)} ${n(cy)} A${n(r)} ${n(r)} 0 1 ${s} ${n(cx + r)} ${n(cy)} A${n(r)} ${n(r)} 0 1 ${s} ${n(cx - r)} ${n(cy)} Z`;
}

/** قطعٌ ناقص مائلٌ بزاويته (بالدرجات) — ورقة الغار وسعفة النخلة. */
export function ellipse(cx: number, cy: number, rx: number, ry: number, deg = 0, hole = false): string {
  const a = (deg * Math.PI) / 180;
  const [dx, dy] = [rx * Math.cos(a), rx * Math.sin(a)];
  const s = hole ? 0 : 1;
  return `M${n(cx - dx)} ${n(cy - dy)} A${n(rx)} ${n(ry)} ${n(deg)} 1 ${s} ${n(cx + dx)} ${n(cy + dy)} A${n(rx)} ${n(ry)} ${n(deg)} 1 ${s} ${n(cx - dx)} ${n(cy - dy)} Z`;
}

/** مستطيلٌ بزواياه المدوّرة. */
export function rect(x: number, y: number, w: number, h: number, r = 0, hole = false): string {
  const k = Math.min(r, w / 2, h / 2);
  if (!hole) {
    return (
      `M${n(x + k)} ${n(y)} H${n(x + w - k)}${k ? ` A${n(k)} ${n(k)} 0 0 1 ${n(x + w)} ${n(y + k)}` : ''} V${n(y + h - k)}` +
      `${k ? ` A${n(k)} ${n(k)} 0 0 1 ${n(x + w - k)} ${n(y + h)}` : ''} H${n(x + k)}${k ? ` A${n(k)} ${n(k)} 0 0 1 ${n(x)} ${n(y + h - k)}` : ''}` +
      ` V${n(y + k)}${k ? ` A${n(k)} ${n(k)} 0 0 1 ${n(x + k)} ${n(y)}` : ''} Z`
    );
  }
  return (
    `M${n(x)} ${n(y + k)} V${n(y + h - k)}${k ? ` A${n(k)} ${n(k)} 0 0 0 ${n(x + k)} ${n(y + h)}` : ''} H${n(x + w - k)}` +
    `${k ? ` A${n(k)} ${n(k)} 0 0 0 ${n(x + w)} ${n(y + h - k)}` : ''} V${n(y + k)}${k ? ` A${n(k)} ${n(k)} 0 0 0 ${n(x + w - k)} ${n(y)}` : ''}` +
    ` H${n(x + k)}${k ? ` A${n(k)} ${n(k)} 0 0 0 ${n(x)} ${n(y + k)}` : ''} Z`
  );
}

/** مضلّعٌ — يُرتَّب اتّجاهه وحده من مساحته، فلا يهمّ ترتيب نقاطه. */
export function poly(points: Pt[], hole = false): string {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]!;
    const [x2, y2] = points[(i + 1) % points.length]!;
    area += x1 * y2 - x2 * y1;
  }
  // المحور الرأسي نازل: المساحة الموجبة مع عقارب الساعة على الشاشة.
  const ordered = area > 0 === !hole ? points : [...points].reverse();
  return `M${ordered.map(([x, y]) => `${n(x)} ${n(y)}`).join(' L')} Z`;
}

/** نجمةٌ برؤوسها ونصفَي قطرها. */
export function star(cx: number, cy: number, points: number, outer: number, inner: number, hole = false): string {
  return poly(
    Array.from({ length: points * 2 }, (_, i) => {
      const r = i % 2 ? inner : outer;
      const a = (i * Math.PI) / points - Math.PI / 2;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Pt;
    }),
    hole
  );
}

/** حلقة: دائرةٌ بثقبها. */
export const ring = (cx: number, cy: number, r: number, inner: number) => `${circle(cx, cy, r)} ${circle(cx, cy, inner, true)}`;

/** أوراقٌ على قوسٍ حول مركز — الإكليل والسعف. `from`/`to` بالدرجات. */
export function leavesOnArc(cx: number, cy: number, r: number, from: number, to: number, count: number, rx: number, ry: number, tilt: number): string {
  return Array.from({ length: count }, (_, i) => {
    const deg = from + ((to - from) * i) / Math.max(1, count - 1);
    const a = (deg * Math.PI) / 180;
    return ellipse(cx + r * Math.cos(a), cy + r * Math.sin(a), rx, ry, deg + 90 + tilt);
  }).join(' ');
}
