/**
 * ورقة الإجابة بالدوائر (OMR) — تُطبع وتُمسح وتُصحَّح بحسابٍ ثابت لا بذكاء.
 *
 * مخطّطٌ واحد بالملّم (`omrLayout`) تُرسم منه الورقة ويُقرأ منه المسح — فلا
 * تفترق الطباعة عن القراءة أبدًا. وفي أركان الورقة أربعة مربّعاتٍ سود: يجدها
 * القارئ في الصورة الممسوحة (مائلةً أو مزاحةً أو بدقّةٍ أيًّا كانت)، ومنها يحسب
 * التحويل الإسقاطي نفسه الذي تسوّي به الهويات (`deskew.ts`)، ثم يقيس سواد كل
 * دائرةٍ في موضعها.
 *
 * والحكم على الدائرة بنسبة سوادها: مظلّلةٌ فوق النصف تقريبًا، وفارغةٌ دون الثلث،
 * و**دائرتان مظلّلتان في سؤالٍ واحد لا تُعدّان صوابًا ولا تُخمَّن إحداهما** —
 * تُعلَّم «متعدّد» ويراها المصحّح.
 */
import { computeProjectiveCoefficients, mapUnitToQuad, type PixelData, type Point, type Quad } from './deskew';

export type OmrSpec = {
  questions: number;
  /** بدائل كل سؤال: ٢ (صح وخطأ) إلى ٥. */
  choices: number;
  /** خانات رقم الطالب: كلّ خانةٍ عمودٌ من عشر دوائر (٠–٩). */
  idDigits: number;
  /** مفتاح الإجابة: رقم البديل الصحيح لكل سؤال (من ٠)، و-١ سؤالٌ لا يُصحَّح. */
  key: number[];
};

export const CHOICE_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ'];
const DIGITS = '٠١٢٣٤٥٦٧٨٩';

const PAGE = { w: 210, h: 297 };
/** مراكز المربّعات السود — ٨ ملم، وبعيدةٌ عن حافّة الطابعة. */
const FID = { x0: 14, y0: 14, x1: 196, y1: 283, size: 8 };
const R = 2.3;
const ROW = 6.4;
const COL = 7.2;
const PER_COLUMN = 25;

export type OmrLayout = {
  page: { w: number; h: number };
  bubbleR: number;
  /** رقم الطالب: خانتُه (من اليسار كما يُكتب الرقم) وقيمة الدائرة. */
  id: { digit: number; value: number; x: number; y: number }[];
  answers: { q: number; c: number; x: number; y: number }[];
  labels: { text: string; x: number; y: number }[];
};

/** المخطّط بالملّم — للرسم والقراءة معًا. */
export function omrLayout(spec: OmrSpec): OmrLayout {
  const id: OmrLayout['id'] = [];
  const answers: OmrLayout['answers'] = [];
  const labels: OmrLayout['labels'] = [];

  // رقم الطالب في أعلى اليسار: الخانات من اليسار إلى اليمين كما يُقرأ الرقم.
  const idX0 = 30;
  const idY0 = 64;
  for (let d = 0; d < spec.idDigits; d++) {
    for (let v = 0; v < 10; v++) {
      id.push({ digit: d, value: v, x: idX0 + d * COL, y: idY0 + v * 5.4 });
    }
  }
  for (let v = 0; v < 10; v++) labels.push({ text: DIGITS[v]!, x: idX0 - 6, y: idY0 + v * 5.4 });

  // الأسئلة أعمدةً من اليمين، خمسةٌ وعشرون في العمود.
  const colWidth = 10 + spec.choices * COL + 6;
  const top = 128;
  for (let q = 0; q < spec.questions; q++) {
    const column = Math.floor(q / PER_COLUMN);
    const row = q % PER_COLUMN;
    const right = 186 - column * colWidth;
    const y = top + row * ROW;
    labels.push({ text: String(q + 1).replace(/\d/g, (x) => DIGITS[Number(x)]!), x: right, y });
    for (let c = 0; c < spec.choices; c++) {
      answers.push({ q, c, x: right - 10 - c * COL, y });
    }
  }
  return { page: PAGE, bubbleR: R, id, answers, labels };
}

/** أكبر عدد أسئلةٍ تسعه الورقة ببدائله. */
export function omrCapacity(choices: number): number {
  const colWidth = 10 + choices * COL + 6;
  return Math.floor((186 - 20) / colWidth + 1) * PER_COLUMN;
}

const mm = (v: number) => `${Math.round(v * 100) / 100}mm`;
const esc = (s: string) => s.replace(/[<>&]/g, '');

/** ورقة الإجابة علاماتٍ بالملّم الحقيقي — ورأسها من رأس ورقة الأسئلة. */
export function omrSheetHtml(spec: OmrSpec, head: { title?: string; lines?: string[] } = {}): string {
  const lay = omrLayout(spec);
  const box = (x: number, y: number, w: number, h: number, extra = '') =>
    `<div style="position:absolute;left:${mm(x)};top:${mm(y)};width:${mm(w)};height:${mm(h)};${extra}"></div>`;
  const text = (x: number, y: number, t: string, size = 3.2, anchor: 'center' | 'right' = 'center') =>
    `<div style="position:absolute;left:${mm(x - 20)};top:${mm(y - size * 0.62)};width:${mm(40)};text-align:${anchor};font-size:${mm(size)};line-height:1.2;color:#000;font-family:'Cairo','IBM Plex Sans Arabic',sans-serif">${esc(t)}</div>`;
  const parts: string[] = [];
  const s = FID.size;
  for (const [x, y] of [
    [FID.x0, FID.y0],
    [FID.x1, FID.y0],
    [FID.x1, FID.y1],
    [FID.x0, FID.y1]
  ] as const) {
    parts.push(box(x - s / 2, y - s / 2, s, s, 'background:#000'));
  }
  parts.push(
    `<div dir="rtl" style="position:absolute;left:${mm(28)};right:${mm(28)};top:${mm(20)};font-family:'Cairo','IBM Plex Sans Arabic',sans-serif;color:#000;text-align:center">` +
      `<div style="font-size:${mm(5)};font-weight:700">${esc(head.title || 'ورقة الإجابة')}</div>` +
      (head.lines ?? []).map((l) => `<div style="font-size:${mm(3.4)};margin-top:${mm(1)}">${esc(l)}</div>`).join('') +
      `<div style="font-size:${mm(3.6)};margin-top:${mm(4)};text-align:right">اسم الطالب: ...........................................&nbsp;&nbsp;&nbsp; الشعبة: ..........</div>` +
      `<div style="font-size:${mm(2.8)};margin-top:${mm(2)};color:#333">ظلِّل دائرةً واحدة لكل سؤال بقلمٍ غامق، وظلِّل رقمك في الأعمدة — ولا تكتب قرب المربّعات السود</div>` +
      `</div>`
  );
  parts.push(text(30 + ((spec.idDigits - 1) * COL) / 2, 58, 'رقم الطالب', 3));
  const ring = (x: number, y: number, label: string) =>
    box(x - R, y - R, 2 * R, 2 * R, 'border:0.25mm solid #000;border-radius:50%;box-sizing:border-box') +
    `<div style="position:absolute;left:${mm(x - R)};top:${mm(y - R)};width:${mm(2 * R)};height:${mm(2 * R)};display:flex;align-items:center;justify-content:center;font-size:${mm(2.2)};color:#9a9a9a;font-family:'Cairo',sans-serif">${label}</div>`;
  for (const b of lay.id) parts.push(ring(b.x, b.y, DIGITS[b.value]!));
  for (const b of lay.answers) parts.push(ring(b.x, b.y, CHOICE_LETTERS[b.c]!));
  for (const l of lay.labels) parts.push(text(l.x, l.y, l.text, 3.2));
  return `<div class="print-page" style="position:relative;width:${mm(PAGE.w)};height:${mm(PAGE.h)};overflow:hidden;background:#fff;break-after:page;page-break-after:always">${parts.join('')}</div>`;
}

// ── القراءة ─────────────────────────────────────────────────────────

export type OmrRead = {
  /** رقم الطالب — و«؟» لخانةٍ فارغةٍ أو مظلّلةٍ مرّتين. */
  id: string;
  /** لكل سؤال: رقم البديل، أو -١ فارغ، أو -٢ متعدّد. */
  answers: number[];
  /** أركان الورقة كما وُجدت — للمعاينة. */
  corners: Quad;
};

function luminance(px: PixelData): Float32Array {
  const out = new Float32Array(px.width * px.height);
  for (let i = 0; i < out.length; i++) out[i] = 0.299 * px.data[i * 4]! + 0.587 * px.data[i * 4 + 1]! + 0.114 * px.data[i * 4 + 2]!;
  return out;
}

function otsu(gray: Float32Array): number {
  const hist = new Array<number>(256).fill(0);
  for (const g of gray) hist[Math.max(0, Math.min(255, Math.round(g)))]!++;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t]!;
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!;
    if (!wB) continue;
    const wF = gray.length - wB;
    if (!wF) break;
    sumB += t * hist[t]!;
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

/**
 * المربّعات السود الأربعة: كتلٌ داكنة مصمتة مربّعة، أقربُها إلى كلّ ركن.
 * والبحث على صورةٍ مصغّرة — المراكز لا تحتاج أكثر.
 */
function findFiducials(gray: Float32Array, w: number, h: number, threshold: number): Quad | null {
  const scale = Math.min(1, 700 / Math.max(w, h));
  const sw = Math.max(1, Math.round(w * scale));
  const sh = Math.max(1, Math.round(h * scale));
  const dark = new Uint8Array(sw * sh);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const g = gray[Math.min(h - 1, Math.floor(y / scale)) * w + Math.min(w - 1, Math.floor(x / scale))]!;
      // طريقة Otsu تعدّ الحدّ نفسه من الكتلة الداكنة: ≤ لا <.
      dark[y * sw + x] = g <= threshold ? 1 : 0;
    }
  }
  const label = new Int32Array(sw * sh);
  const stack = new Int32Array(sw * sh);
  // المربّع ٨ ملم في ورقةٍ عرضها ٢١٠: نحو ٤٪ من العرض.
  const expected = (sw * FID.size) / PAGE.w;
  const blobs: { cx: number; cy: number }[] = [];
  let next = 0;
  for (let start = 0; start < sw * sh; start++) {
    if (!dark[start] || label[start]) continue;
    next++;
    let top = 0;
    stack[top++] = start;
    label[start] = next;
    let area = 0;
    let sx = 0;
    let sy = 0;
    let minX = sw;
    let maxX = 0;
    let minY = sh;
    let maxY = 0;
    while (top) {
      const p = stack[--top]!;
      const x = p % sw;
      const y = (p - x) / sw;
      area++;
      sx += x;
      sy += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (const q of [x > 0 ? p - 1 : -1, x < sw - 1 ? p + 1 : -1, y > 0 ? p - sw : -1, y < sh - 1 ? p + sw : -1]) {
        if (q >= 0 && dark[q] && !label[q]) {
          label[q] = next;
          stack[top++] = q;
        }
      }
    }
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const fill = area / (bw * bh);
    const side = Math.sqrt(area);
    if (fill > 0.8 && bw / bh > 0.6 && bw / bh < 1.6 && side > expected * 0.5 && side < expected * 2) {
      blobs.push({ cx: (sx / area + 0.5) / scale, cy: (sy / area + 0.5) / scale });
    }
  }
  if (blobs.length < 4) return null;
  const nearest = (tx: number, ty: number) =>
    blobs.reduce((best, b) => (Math.hypot(b.cx - tx, b.cy - ty) < Math.hypot(best.cx - tx, best.cy - ty) ? b : best));
  const pick = (tx: number, ty: number): Point => {
    const b = nearest(tx, ty);
    return { x: b.cx, y: b.cy };
  };
  const quad: Quad = { tl: pick(0, 0), tr: pick(w, 0), br: pick(w, h), bl: pick(0, h) };
  const distinct = new Set([quad.tl, quad.tr, quad.br, quad.bl].map((p) => `${Math.round(p.x)},${Math.round(p.y)}`));
  return distinct.size === 4 ? quad : null;
}

/** يقرأ ورقة إجابةٍ ممسوحة — أو `null` إن لم تُوجد مربّعاتها الأربعة. */
export function readOmr(px: PixelData, spec: OmrSpec): OmrRead | null {
  const gray = luminance(px);
  const threshold = Math.min(160, otsu(gray));
  const corners = findFiducials(gray, px.width, px.height, threshold);
  if (!corners) return null;
  const coeff = computeProjectiveCoefficients(corners);
  const toImage = (x: number, y: number) => mapUnitToQuad((x - FID.x0) / (FID.x1 - FID.x0), (y - FID.y0) / (FID.y1 - FID.y0), coeff);
  const pxPerMm = Math.hypot(corners.tr.x - corners.tl.x, corners.tr.y - corners.tl.y) / (FID.x1 - FID.x0);
  const r = R * pxPerMm * 0.62;

  /** نسبة سواد الدائرة: ما داخل ثلثيها الأوسطين — فحافّتها المطبوعة لا تُحسب ظلًّا. */
  const fill = (x: number, y: number) => {
    const c = toImage(x, y);
    let dark = 0;
    let all = 0;
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
      for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const X = Math.round(c.x + dx);
        const Y = Math.round(c.y + dy);
        if (X < 0 || Y < 0 || X >= px.width || Y >= px.height) continue;
        all++;
        if (gray[Y * px.width + X]! <= threshold) dark++;
      }
    }
    return all ? dark / all : 0;
  };

  const decide = (fills: number[]) => {
    const order = fills.map((f, i) => [f, i] as const).sort((a, b) => b[0] - a[0]);
    const [best, second] = order;
    if (!best || best[0] < 0.35) return -1;
    if (second && second[0] >= 0.35) return -2;
    return best[1];
  };

  const lay = omrLayout(spec);
  const answers: number[] = [];
  for (let q = 0; q < spec.questions; q++) {
    answers.push(decide(lay.answers.filter((b) => b.q === q).map((b) => fill(b.x, b.y))));
  }
  let id = '';
  for (let d = 0; d < spec.idDigits; d++) {
    const v = decide(lay.id.filter((b) => b.digit === d).map((b) => fill(b.x, b.y)));
    id += v >= 0 ? String(v) : '؟';
  }
  return { id, answers, corners };
}

export type OmrGrade = {
  correct: number;
  wrong: number;
  blank: number;
  multi: number;
  /** الأسئلة المصحَّحة (ما له مفتاح). */
  total: number;
  /** من مئة. */
  percent: number;
};

/** التصحيح بالمفتاح: المتعدّد والفارغ لا يُعدّان صوابًا. */
export function gradeOmr(answers: number[], key: number[]): OmrGrade {
  let correct = 0;
  let wrong = 0;
  let blank = 0;
  let multi = 0;
  let total = 0;
  key.forEach((k, q) => {
    if (k < 0) return;
    total++;
    const a = answers[q] ?? -1;
    if (a === k) correct++;
    else if (a === -1) blank++;
    else if (a === -2) multi++;
    else wrong++;
  });
  return { correct, wrong, blank, multi, total, percent: total ? Math.round((correct / total) * 1000) / 10 : 0 };
}

/** المفتاح من نصٍّ يكتبه المدرّس: «أ ب ج د» أو «1 2 3 4»، و«-» لسؤالٍ لا يُصحَّح. */
export function parseKey(text: string, choices: number): number[] {
  const out: number[] = [];
  for (const tok of text.replace(/[،,]/g, ' ').split(/\s+/).filter(Boolean)) {
    const byLetter = CHOICE_LETTERS.findIndex((l) => l === tok || (l === 'هـ' && tok === 'ه'));
    const n = Number(tok.replace(/[٠-٩]/g, (d) => String(DIGITS.indexOf(d))));
    if (tok === '-' || tok === '—') out.push(-1);
    else if (byLetter >= 0 && byLetter < choices) out.push(byLetter);
    else if (Number.isInteger(n) && n >= 1 && n <= choices) out.push(n - 1);
    else out.push(-1);
  }
  return out;
}
