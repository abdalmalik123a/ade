/**
 * صناديق الاستمارة المصوّرة (خطّة الترقية، المرحلة ٤): كلّ مساحةٍ بيضاء يحيطها خطّ — خانة جدول،
 * أو مستطيلٌ مدوّر يُكتب فيه، أو مربّع اختيار، أو مربّع الصورة.
 *
 * والطريقة لا تحتاج أن تعرف شكل الاستمارة: البيضاء المتّصلة التي لا تبلغ حافّة الصورة محاطةٌ بخطّ؛
 * وما كان منها مستطيلًا (يملأ صندوقه) صندوق. وما بين أسطر النصّ متّصلٌ بالورقة فلا يُحسب، وفجوات
 * الحدود الصغيرة في صورةٍ ضعيفة الدقّة تُسدّ بأخذ أغمق ما في كلّ رقعة. وأيّها فارغٌ وأيّها عنوانٌ
 * يقرّره القارئ بعده (`imageForm.ts`): هذه دالّةٌ خالصة على البكسلات، تُختبر بلا متصفّح.
 */
import type { PixelData } from './deskew';
import type { Box } from './paperRules';

/** أغمق من هذا حبرٌ أو خطّ — والرماديّ الفاتح (ظلّ الطباعة) ورقة. */
const INK = 170;

/** يُصغَّر ما زاد عن هذا قبل البحث: الخطوط تبقى بأخذ أغمق ما في الرقعة. */
const WORK_SIDE = 1600;

/** أغمق من ورق جواره بهذا حبرٌ وإن كان رماديًّا. */
const LOCAL = 45;

/**
 * حدّ الحبر من الصورة نفسها (أوتسو): خطوطٌ رماديّة رفيعة في صورةٍ مضغوطة كُبّرت تصير أفتح من ١٧٠
 * فتتسرّب الخانات بعضها إلى بعض — «معلومات» لم يُكشف من جدولها شيء. والحدّ محصورٌ فلا يأكل الورق.
 */
export function inkThreshold(px: PixelData): number {
  const hist = new Array<number>(256).fill(0);
  const { data } = px;
  const step = Math.max(1, Math.floor(data.length / 4 / 400_000));
  let n = 0;
  for (let i = 0; i < data.length; i += 4 * step) {
    hist[Math.round(0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!)]!++;
    n++;
  }
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t]!;
  let sumB = 0, wB = 0, best = 0, at = INK;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!;
    if (!wB) continue;
    const wF = n - wB;
    if (!wF) break;
    sumB += t * hist[t]!;
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) (best = between), (at = t);
  }
  return Math.min(215, Math.max(140, at + 10));
}

/**
 * قناع الحبر بعد التصغير: كلّ رقعةٍ بأغمق ما فيها — فالخطّ الرفيع لا يضيع. والحبر ما غمق عن الحدّ،
 * أو عمّا حوله بفرقٍ بيّن: خطوط جدولٍ رماديّة (١٨٠) في صورةٍ مضغوطة كُبّرت أفتح من أيّ حدٍّ واحد
 * يُبقي الورق ورقًا، لكنّها أغمق من بياض جوارها بكثير. فالقناع بدرجتين: ٢ لما غمق عن الحدّ،
 * و١ لما غمق عن جواره وحده.
 */
function inkMask(px: PixelData): { ink: Uint8Array; w: number; h: number; f: number } {
  const { width: W, height: H, data } = px;
  const cut = inkThreshold(px);
  const f = Math.max(1, Math.ceil(Math.max(W, H) / WORK_SIDE));
  const w = Math.ceil(W / f);
  const h = Math.ceil(H / f);
  const lum = new Uint8Array(w * h).fill(255);
  for (let y = 0; y < H; y++) {
    const row = Math.floor(y / f) * w;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const v = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
      const j = row + Math.floor(x / f);
      if (v < lum[j]!) lum[j] = v;
    }
  }
  // لون الورق حول كلّ نقطة: أفتح ما في جوارها (أفقيًّا ثم عموديًّا). لا المتوسّط — فإطارٌ أسود
  // عريض بجوار خطٍّ رماديّ يُعتم المتوسّط فيضيع الخطّ، وتتسرّب الخانات إلى ما بين الإطار والجدول.
  const r = Math.max(4, Math.round(Math.max(w, h) / 150));
  const rowMax = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let k = Math.max(0, x - r), e = Math.min(w - 1, x + r); k <= e; k++) if (lum[y * w + k]! > m) m = lum[y * w + k]!;
      rowMax[y * w + x] = m;
    }
  }
  const ink = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = lum[y * w + x]!;
      if (v < cut) {
        ink[y * w + x] = 2;
        continue;
      }
      let paper = 0;
      for (let k = Math.max(0, y - r), e = Math.min(h - 1, y + r); k <= e; k++) if (rowMax[k * w + x]! > paper) paper = rowMax[k * w + x]!;
      if (v < paper - LOCAL) ink[y * w + x] = 1;
    }
  }
  return { ink, w, h, f };
}

/**
 * الصناديق بالقراءتين: بالحدّ وحده، وبالحدّ مع فرق الجوار. والثانية تُظهر الخطوط الباهتة لكنّ هالة
 * الحروف فيها تصير حبرًا فتنغلق خانةٌ ضيّقة فيها كلمة («رقمًا» تحت «الدرجة»). فيُؤخذ من الأولى ما
 * لم تقسمه الثانية خانتين فأكثر — وما قسمته فالقسمة أدقّ.
 */
export function findBoxes(px: PixelData): Box[] {
  const mask = inkMask(px);
  const hard = boxesIn(px, mask, 2);
  const soft = boxesIn(px, mask, 1);
  const centre = (b: Box, o: Box) => (b.x0 + b.x1) / 2 >= o.x0 && (b.x0 + b.x1) / 2 <= o.x1 && (b.y0 + b.y1) / 2 >= o.y0 && (b.y0 + b.y1) / 2 <= o.y1;
  const out = [...soft];
  for (const a of hard) {
    const inside = soft.filter((b) => centre(b, a));
    if (inside.length >= 2) continue;
    if (inside.length === 1 && centre(a, inside[0]!)) continue;
    out.push(a);
  }
  return out;
}

function boxesIn(px: PixelData, { ink, w, h, f }: ReturnType<typeof inkMask>, level: 1 | 2): Box[] {
  const { width: W, height: H } = px;
  // سدّ الفجوات بكسلًا: حدود الصندوق في صورةٍ مضغوطة تنقطع فتتسرّب بياضه إلى الورقة.
  const solid = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (ink[y * w + x]! < level) continue;
      solid[y * w + x] = 1;
      if (x > 0) solid[y * w + x - 1] = 1;
      if (x < w - 1) solid[y * w + x + 1] = 1;
      if (y > 0) solid[(y - 1) * w + x] = 1;
      if (y < h - 1) solid[(y + 1) * w + x] = 1;
    }
  }

  // المساحات البيضاء المتّصلة (رباعيًّا)، وما بلغ حافّة الصورة ورقةٌ لا صندوق.
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const out: Box[] = [];
  const minW = Math.max(5, Math.round(w * 0.012));
  const minH = Math.max(5, Math.round(h * 0.008));
  for (let start = 0; start < w * h; start++) {
    if (solid[start] || seen[start]) continue;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, count = 0, edge = false;
    while (top > 0) {
      const p = stack[--top]!;
      const x = p % w;
      const y = (p - x) / w;
      count++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
      if (x > 0 && !solid[p - 1] && !seen[p - 1]) (seen[p - 1] = 1), (stack[top++] = p - 1);
      if (x < w - 1 && !solid[p + 1] && !seen[p + 1]) (seen[p + 1] = 1), (stack[top++] = p + 1);
      if (y > 0 && !solid[p - w] && !seen[p - w]) (seen[p - w] = 1), (stack[top++] = p - w);
      if (y < h - 1 && !solid[p + w] && !seen[p + w]) (seen[p + w] = 1), (stack[top++] = p + w);
    }
    if (edge) continue;
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;
    if (bw < minW || bh < minH || bw > w * 0.97 || bh > h * 0.3) continue;
    // مستطيلٌ يملأ صندوقه — ونصٌّ في الخانة يقلّل بياضها ولا يذهب به.
    if (count / (bw * bh) < 0.6) continue;
    // الصندوق بحدوده الداخلية بمقاس الصورة الأصلي — ويُعاد الكسل الذي أكله سدّ الفجوات.
    out.push({ x0: (x0 - 1) * f, y0: (y0 - 1) * f, x1: Math.min(W, (x1 + 2) * f), y1: Math.min(H, (y1 + 2) * f) });
  }
  return out;
}

/** نسبة الحبر داخل الصندوق (بلا حوافّه) — للفارغ قريبٌ من الصفر. */
export function inkShare(px: PixelData, b: Box): number {
  const { width: W, data } = px;
  const padX = Math.max(2, Math.round((b.x1 - b.x0) * 0.08));
  const padY = Math.max(2, Math.round((b.y1 - b.y0) * 0.12));
  let dark = 0;
  let all = 0;
  for (let y = b.y0 + padY; y < b.y1 - padY; y++) {
    for (let x = b.x0 + padX; x < b.x1 - padX; x++) {
      const i = (y * W + x) * 4;
      const lum = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
      all++;
      if (lum < INK) dark++;
    }
  }
  return all ? dark / all : 0;
}

/**
 * النقاط المتتابعة «...........» على سطرٍ واحد — فراغٌ يُكتب فوقه. والقارئ كثيرًا ما يُسقطها، فتُكشف
 * من البكسلات: نقاطٌ صغيرة على خطٍّ أفقيّ، متقاربةٌ بانتظام، ستٌّ فأكثر.
 */
export function findLeaders(px: PixelData): Box[] {
  const { width: W, height: H } = px;
  const { ink: mask, w, h, f } = inkMask(px);
  // النقاط بالحدّ وحده: هالة الحرف بفرق الجوار تُكبّر النقطة وتصل بعضها ببعض.
  const ink = mask.map((v) => (v === 2 ? 1 : 0));
  // مكوّنات الحبر الصغيرة (ثمانيًّا): النقطة صغيرةٌ وتقارب المربّع.
  const maxDot = Math.max(3, Math.round(w * 0.006));
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const dots: { x: number; y: number }[] = [];
  for (let start = 0; start < w * h; start++) {
    if (!ink[start] || seen[start]) continue;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, n = 0;
    while (top > 0) {
      const p = stack[--top]!;
      const x = p % w;
      const y = (p - x) / w;
      n++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (ink[q] && !seen[q]) (seen[q] = 1), (stack[top++] = q);
        }
      }
      if (n > maxDot * maxDot * 4) break;
    }
    if (x1 - x0 + 1 <= maxDot && y1 - y0 + 1 <= maxDot && n <= maxDot * maxDot) dots.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 });
  }
  // سلاسل على خطٍّ واحد: بالترتيب من اليسار، وكلّ سلسلةٍ تمتدّ إلى أقرب نقطةٍ بعدها على خطّها —
  // والنقطة قد تعلو بكسلًا أو تنزل، فالخطّ متوسّطُ ما فيه لا أوّلُه.
  dots.sort((a, b) => a.x - b.x);
  const out: Box[] = [];
  const maxGap = Math.max(4, w * 0.012);
  const used = new Uint8Array(dots.length);
  for (let i = 0; i < dots.length; i++) {
    if (used[i]) continue;
    const chain = [dots[i]!];
    used[i] = 1;
    let meanY = dots[i]!.y;
    for (let j = i + 1; j < dots.length; j++) {
      const last = chain[chain.length - 1]!;
      const d = dots[j]!;
      if (d.x - last.x > maxGap) break;
      if (used[j] || Math.abs(d.y - meanY) > 1.5 || d.x <= last.x) continue;
      chain.push(d);
      used[j] = 1;
      meanY = (meanY * (chain.length - 1) + d.y) / chain.length;
    }
    const span = chain[chain.length - 1]!.x - chain[0]!.x;
    if (chain.length >= 6 && span >= w * 0.04) {
      const y = chain.reduce((s, d) => s + d.y, 0) / chain.length;
      // الخانة فوق النقاط بارتفاع سطر.
      const line = Math.round(h * 0.02);
      out.push({ x0: Math.max(0, (chain[0]!.x - 2) * f), y0: Math.max(0, (y - line) * f), x1: Math.min(W, (chain[chain.length - 1]!.x + 3) * f), y1: Math.min(H, (y + 2) * f) });
    }
  }
  return out;
}

/**
 * حدود الصناديق شرائطَ رفيعة تُمحى قبل القراءة: القارئ يقرأ خطوط الجدول حروفًا («|» و«ل»)
 * فتتفكّك كلمات الخانة. والحدّ خارج الصندوق ملاصقٌ له، فالشريط من حافّته إلى الخارج قليلًا.
 */
export function borderBands(boxes: Box[], W: number, H: number): Box[] {
  const g = Math.max(3, Math.round(Math.max(W, H) / 300));
  const out: Box[] = [];
  for (const b of boxes) {
    // فتحات الحروف الغليظة صناديقُ صغيرة أيضًا — ومحو ما حولها يمحو الكلمة («بأن» فلا يُعرف الاسم).
    if (b.x1 - b.x0 < W * 0.03 || b.y1 - b.y0 < H * 0.012) continue;
    const x0 = Math.max(0, b.x0 - g), x1 = Math.min(W - 1, b.x1 + g);
    const y0 = Math.max(0, b.y0 - g), y1 = Math.min(H - 1, b.y1 + g);
    out.push({ x0, y0, x1, y1: Math.min(H - 1, b.y0 + 1) });
    out.push({ x0, y0: Math.max(0, b.y1 - 1), x1, y1 });
    out.push({ x0, y0, x1: Math.min(W - 1, b.x0 + 1), y1 });
    out.push({ x0: Math.max(0, b.x1 - 1), y0, x1, y1 });
  }
  return out;
}

/** الصندوق مقصوصًا بهامشٍ أبيض — ليُقرأ وحده. */
export function cropPixels(px: PixelData, b: Box, pad: number): { px: PixelData; x: number; y: number } {
  const x0 = Math.max(0, Math.floor(b.x0)), y0 = Math.max(0, Math.floor(b.y0));
  const x1 = Math.min(px.width, Math.ceil(b.x1)), y1 = Math.min(px.height, Math.ceil(b.y1));
  const w = x1 - x0 + pad * 2;
  const h = y1 - y0 + pad * 2;
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  for (let y = y0; y < y1; y++) {
    data.set(px.data.subarray((y * px.width + x0) * 4, (y * px.width + x1) * 4), ((y - y0 + pad) * w + pad) * 4);
  }
  return { px: { width: w, height: h, data }, x: x0 - pad, y: y0 - pad };
}
