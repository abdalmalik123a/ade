/**
 * لبناتٌ للأنماط الجديدة (DESIGNS.md ٣٫١) — محسوبةٌ متّجهة كلّها كـ`ornaments.ts`، بوحدات الرسم:
 *
 * - **الغصن الخطّي** (`sprig`): ساقٌ منحنية وأوراقٌ متناوبة — للخطّي البسيط والزهري المائي.
 * - **البقعة المائية** (`wash`): دوائرُ متداخلةٌ بتدرّجٍ شعاعيٍّ شفيف — تشبه ضربة الفرشاة المبلولة دون مرشّح (والمرشّح يصير صورةً في PDF).
 * - **الهلال والفانوس والنجمة** (`crescent`، `lantern`): ليالي رمضان.
 * - **الموجة** (`wave`): شريطٌ منحنٍ على حافّة الورقة — للطبّي.
 * - **الزهرة** (`blossom`): خمس بتلاتٍ ووسط — للزهري والأطفال الهادئ.
 */
import { n, seeded } from './ornaments';

/** غصنٌ من `(x, y)` بطول `len` واتّجاه `angle` (راديان)، ينحني بـ`bend`، وأوراقٌ متناوبة. */
export function sprig(x: number, y: number, len: number, angle: number, color: string, sw: number, leaves = 6, bend = 0.25, fill = 'none'): string {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  // المنحنى: نقطة تحكّمٍ عموديّة على الاتّجاه بقدر الانحناء.
  const ex = x + dx * len;
  const ey = y + dy * len;
  const cx = x + dx * len * 0.5 - dy * len * bend;
  const cy = y + dy * len * 0.5 + dx * len * bend;
  let out = `<path d="M${n(x)},${n(y)} Q${n(cx)},${n(cy)} ${n(ex)},${n(ey)}" fill="none" stroke="${color}" stroke-width="${n(sw)}" stroke-linecap="round"/>`;
  for (let i = 1; i <= leaves; i++) {
    const t = i / (leaves + 1);
    // نقطةٌ على المنحنى وميله.
    const px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * cx + t * t * ex;
    const py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * cy + t * t * ey;
    const tx = 2 * (1 - t) * (cx - x) + 2 * t * (ex - cx);
    const ty = 2 * (1 - t) * (cy - y) + 2 * t * (ey - cy);
    const a = Math.atan2(ty, tx) + (i % 2 ? 0.75 : -0.75);
    const L = len * 0.16 * (1 - t * 0.45);
    const lx = px + Math.cos(a) * L;
    const ly = py + Math.sin(a) * L;
    const nx = -Math.sin(a) * L * 0.32;
    const ny = Math.cos(a) * L * 0.32;
    out += `<path d="M${n(px)},${n(py)} Q${n((px + lx) / 2 + nx)},${n((py + ly) / 2 + ny)} ${n(lx)},${n(ly)} Q${n((px + lx) / 2 - nx)},${n((py + ly) / 2 - ny)} ${n(px)},${n(py)} Z" fill="${fill}" stroke="${color}" stroke-width="${n(sw * 0.8)}"/>`;
  }
  return out;
}

/** تدرّجٌ شعاعيٌّ للبقعة المائية — لونٌ في وسطه يتلاشى عند حافّته. */
export const washGradient = (id: string, color: string, op = 0.55) =>
  `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${op}"/><stop offset="0.65" stop-color="${color}" stop-opacity="${n(op * 0.45)}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;

/** بقعةٌ مائية حول `(cx, cy)` بنصف قطر `r`: دوائرُ متداخلة بمواضع ثابتة البذرة. */
export function wash(cx: number, cy: number, r: number, gradientId: string, seed: number, blobs = 5): string {
  const rnd = seeded(seed);
  let out = '';
  for (let i = 0; i < blobs; i++) {
    const a = rnd() * Math.PI * 2;
    const d = r * 0.35 * rnd();
    out += `<ellipse cx="${n(cx + Math.cos(a) * d)}" cy="${n(cy + Math.sin(a) * d)}" rx="${n(r * (0.55 + rnd() * 0.45))}" ry="${n(r * (0.45 + rnd() * 0.4))}" fill="url(#${gradientId})" transform="rotate(${n(rnd() * 180)} ${n(cx)} ${n(cy)})"/>`;
  }
  return out;
}

/** زهرةٌ بخمس بتلاتٍ بيضاوية ووسطٍ — `r` نصف قطرها؛ و`outline` بتلاتٌ مرسومةٌ بخطٍّ (للخطّي). */
export function blossom(cx: number, cy: number, r: number, petal: string, heart: string, rot = 0, outline?: { color: string; width: number }): string {
  let out = '';
  const line = outline ? ` stroke="${outline.color}" stroke-width="${n(outline.width)}"` : '';
  for (let i = 0; i < 5; i++) {
    const a = rot + (i * Math.PI * 2) / 5;
    out += `<ellipse cx="${n(cx + Math.cos(a) * r * 0.55)}" cy="${n(cy + Math.sin(a) * r * 0.55)}" rx="${n(r * 0.5)}" ry="${n(r * 0.32)}" fill="${petal}"${line} transform="rotate(${n((a * 180) / Math.PI)} ${n(cx + Math.cos(a) * r * 0.55)} ${n(cy + Math.sin(a) * r * 0.55)})"/>`;
  }
  return out + `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 0.24)}" fill="${heart}"/>`;
}

/** هلالٌ: دائرةٌ تقضمها أخرى مزاحة — بلونٍ واحد، ومفتوحٌ جهة `dir` (١ يمين، −١ يسار). */
export function crescent(cx: number, cy: number, r: number, fill: string, dir = 1): string {
  const off = r * 0.42 * dir;
  // قوسا الدائرتين: الخارجيّ كاملًا والداخليّ عكسه — مسارٌ واحد بلا قناع.
  const k = Math.sqrt(Math.max(0, r * r - (off / 2) ** 2));
  const x = cx + off / 2;
  return `<path d="M${n(x)},${n(cy - k)} A${n(r)},${n(r)} 0 1,${dir > 0 ? 0 : 1} ${n(x)},${n(cy + k)} A${n(r)},${n(r)} 0 1,${dir > 0 ? 1 : 0} ${n(x)},${n(cy - k)} Z" fill="${fill}"/>`;
}

/** فانوسٌ معلّق بخيطٍ من الأعلى: قبّةٌ وجسمٌ مضلّعٌ بنافذةٍ مضيئة وقاعدة. `h` ارتفاعه بلا خيط. */
export function lantern(cx: number, top: number, h: number, metal: string, glow: string, string = 0): string {
  const w = h * 0.5;
  const y = top + string;
  const body = y + h * 0.22;
  return (
    (string ? `<line x1="${n(cx)}" y1="${n(top)}" x2="${n(cx)}" y2="${n(y)}" stroke="${metal}" stroke-width="${n(h * 0.02)}"/>` : '') +
    `<circle cx="${n(cx)}" cy="${n(y + h * 0.03)}" r="${n(h * 0.035)}" fill="none" stroke="${metal}" stroke-width="${n(h * 0.02)}"/>` +
    `<path d="M${n(cx - w * 0.35)},${n(body)} Q${n(cx)},${n(y + h * 0.02)} ${n(cx + w * 0.35)},${n(body)} Z" fill="${metal}"/>` +
    `<path d="M${n(cx - w * 0.35)},${n(body)} L${n(cx - w * 0.5)},${n(body + h * 0.45)} L${n(cx - w * 0.3)},${n(body + h * 0.62)} L${n(cx + w * 0.3)},${n(body + h * 0.62)} L${n(cx + w * 0.5)},${n(body + h * 0.45)} L${n(cx + w * 0.35)},${n(body)} Z" fill="${glow}" stroke="${metal}" stroke-width="${n(h * 0.025)}"/>` +
    `<line x1="${n(cx)}" y1="${n(body)}" x2="${n(cx)}" y2="${n(body + h * 0.62)}" stroke="${metal}" stroke-width="${n(h * 0.018)}"/>` +
    `<rect x="${n(cx - w * 0.32)}" y="${n(body + h * 0.62)}" width="${n(w * 0.64)}" height="${n(h * 0.07)}" fill="${metal}"/>` +
    `<path d="M${n(cx - w * 0.12)},${n(body + h * 0.69)} L${n(cx)},${n(body + h * 0.78)} L${n(cx + w * 0.12)},${n(body + h * 0.69)} Z" fill="${metal}"/>`
  );
}

/** موجةٌ على حافّة الورقة: من `y` إلى الحافّة (`toTop`)، بقمّتين وسعة `amp`. */
export function wave(W: number, y: number, amp: number, fill: string, toTop: boolean, phase = 0, edge = 0): string {
  const e = toTop ? -edge : (edge || 0);
  const end = toTop ? e : y + amp * 4 + edge;
  const p = (f: number) => n(y + Math.sin(phase + f * Math.PI * 2) * amp);
  return `<path d="M${-edge},${p(0)} C${n(W * 0.18)},${n(+p(0.25) - amp)} ${n(W * 0.32)},${n(+p(0.35) + amp)} ${n(W * 0.5)},${p(0.5)} S${n(W * 0.82)},${n(+p(0.85) - amp)} ${n(W + edge)},${p(1)} L${n(W + edge)},${n(end)} L${-edge},${n(end)} Z" fill="${fill}"/>`;
}

/** نبضة القلب: خطٌّ مستقيمٌ تتخلّله قفزةٌ — فاصلٌ طبّيّ. */
export function pulse(cx: number, y: number, half: number, color: string, sw: number): string {
  const s = half * 0.12;
  const pts = [
    [cx - half, y],
    [cx - s * 2, y],
    [cx - s * 1.2, y - s * 1.6],
    [cx - s * 0.3, y + s * 2.4],
    [cx + s * 0.6, y - s * 3],
    [cx + s * 1.4, y],
    [cx + half, y]
  ];
  return `<polyline points="${pts.map(([a, b]) => `${n(a!)},${n(b!)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${n(sw)}" stroke-linejoin="round" stroke-linecap="round"/>`;
}
