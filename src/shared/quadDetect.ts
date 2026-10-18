/**
 * كشف أركان البطاقة أو الورقة في الصورة آليًّا (Otsu وأكبر كتلةٍ متّصلة) — نُقل من `deskew.ts` (D88).
 */
import type { Quad, PixelData } from './deskew';

// ── كشف الأركان آليًّا ───────────────────────────────────────────────

/**
 * يكشف أركان البطاقة أو الورقة في الصورة — أو `null` إن لم تتميّز عن خلفيتها.
 *
 * لونُ الخلفية من حافّة الصورة (الوسيط: فالبطاقة قد تلامس الحافّة من جهة)،
 * وكلّ بكسلٍ يُقاس بعده عن ذلك اللون، والحدّ الفاصل بطريقة Otsu لا برقمٍ
 * ثابت — فالهوية على غطاء الماسح الأبيض كالهوية على طاولةٍ داكنة. ثم أكبرُ
 * كتلةٍ متّصلة، وأركانها أطرافها: أصغرُ x+y وأكبره، وأصغرُ x−y وأكبره —
 * وهي أركان المستطيل ما دام ميلانه دون ٤٥ درجة.
 *
 * والحساب على صورةٍ مصغّرة (٤٨٠ بكسلًا) ثم يُكبَّر: الأركان لا تحتاج دقّةً
 * أعلى، والموظف يضبطها بالفأرة إن شاء.
 */
export function detectQuad(src: PixelData, maxSide = 480): Quad | null {
  const scale = Math.min(1, maxSide / Math.max(src.width, src.height));
  const w = Math.max(8, Math.round(src.width * scale));
  const h = Math.max(8, Math.round(src.height * scale));
  const rgb = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.min(src.width - 1, Math.floor(x / scale));
      const sy = Math.min(src.height - 1, Math.floor(y / scale));
      const s = (sy * src.width + sx) * 4;
      const d = (y * w + x) * 3;
      rgb[d] = src.data[s]!;
      rgb[d + 1] = src.data[s + 1]!;
      rgb[d + 2] = src.data[s + 2]!;
    }
  }

  // لون الخلفية: وسيطُ حافّة الصورة لكل قناة.
  const border: number[][] = [[], [], []];
  const take = (x: number, y: number) => {
    for (let c = 0; c < 3; c++) border[c]!.push(rgb[(y * w + x) * 3 + c]!);
  };
  for (let x = 0; x < w; x++) {
    take(x, 0);
    take(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    take(0, y);
    take(w - 1, y);
  }
  const bg = border.map((list) => list.sort((a, z) => a - z)[Math.floor(list.length / 2)]!);

  const total = w * h;
  const dist = new Float32Array(total);
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < total; i++) {
    const d = Math.hypot(rgb[i * 3]! - bg[0]!, rgb[i * 3 + 1]! - bg[1]!, rgb[i * 3 + 2]! - bg[2]!);
    dist[i] = d;
    hist[Math.min(255, Math.round(d / 1.74))]!++;
  }
  // Otsu: الحدّ الذي يفصل الكتلتين بأكبر تباينٍ بينهما.
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t]!;
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 0;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!;
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t]!;
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  const cut = Math.max(18, threshold * 1.74);
  const mask = new Uint8Array(total);
  for (let i = 0; i < total; i++) mask[i] = dist[i]! > cut ? 1 : 0;

  // أكبر كتلةٍ متّصلة (رباعيًّا) — لا فتاتُ الغبار ولا ظلُّ الغطاء.
  const label = new Int32Array(total);
  const stack = new Int32Array(total);
  let bestLabel = 0;
  let bestSize = 0;
  let next = 0;
  for (let start = 0; start < total; start++) {
    if (!mask[start] || label[start]) continue;
    next++;
    let top = 0;
    stack[top++] = start;
    label[start] = next;
    let size = 0;
    while (top) {
      const p = stack[--top]!;
      size++;
      const x = p % w;
      const y = (p - x) / w;
      const around = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of around) {
        if (q >= 0 && mask[q] && !label[q]) {
          label[q] = next;
          stack[top++] = q;
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      bestLabel = next;
    }
  }
  if (bestSize < total * 0.04) return null;

  let tl = { v: Infinity, x: 0, y: 0 };
  let br = { v: -Infinity, x: 0, y: 0 };
  let tr = { v: -Infinity, x: 0, y: 0 };
  let bl = { v: Infinity, x: 0, y: 0 };
  for (let p = 0; p < total; p++) {
    if (label[p] !== bestLabel) continue;
    const x = p % w;
    const y = (p - x) / w;
    if (x + y < tl.v) tl = { v: x + y, x, y };
    if (x + y > br.v) br = { v: x + y, x, y };
    if (x - y > tr.v) tr = { v: x - y, x, y };
    if (x - y < bl.v) bl = { v: x - y, x, y };
  }
  const quad: Quad = {
    tl: { x: tl.x / scale, y: tl.y / scale },
    tr: { x: (tr.x + 1) / scale, y: tr.y / scale },
    br: { x: (br.x + 1) / scale, y: (br.y + 1) / scale },
    bl: { x: bl.x / scale, y: (bl.y + 1) / scale }
  };
  // رباعيٌّ أصغر كثيرًا من كتلته ليس بطاقة (كتلةٌ ملتوية لا مستطيل).
  const area =
    Math.abs(
      quad.tl.x * quad.tr.y -
        quad.tr.x * quad.tl.y +
        (quad.tr.x * quad.br.y - quad.br.x * quad.tr.y) +
        (quad.br.x * quad.bl.y - quad.bl.x * quad.br.y) +
        (quad.bl.x * quad.tl.y - quad.tl.x * quad.bl.y)
    ) / 2;
  return area >= (bestSize / (scale * scale)) * 0.6 ? quad : null;
}
