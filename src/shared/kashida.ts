/**
 * الكشيدة في الضبط (S13، D183، ه٢) — الفقرة المضبوطة تُملأ أسطرها بتطويل الحروف (U+0640) لا بالمسافات وحدها، كما يفعل Word.
 *
 * Chromium لا يمدّ الحروف (الدراسة في `docs/sections/editor.md` §٥: `text-justify: kashida` غير مدعوم، ولا علَم)، فالتطويل **يُضاف عند الرسم
 * وحده**: عناصر `<span class="kashida">` داخل الكلمة (تُبقي الحروف موصولة، و`user-select:none` يُخرجها من النسخ) — لا في النصّ المحفوظ ولا البحث.
 * والمستوى نصيبُ التطويل من فراغ السطر (منخفضة ٣٣٪ ومتوسّطة ٦٦٪ ومرتفعة ١٠٠٪، والباقي للمسافات)، والسطر الأخير لا يُضبط.
 *
 * `kashidaPoint` و`planLine` حسابٌ خالص؛ و`applyKashida` تمرّ على DOM — **مكتفيةً بمعاملاتها**: تُحقن في نافذة الطباعة بـ`toString` (كـ`fitCanvasText`)
 * والدالّتان الأخريان تُمرَّران إليها، ولا تقرأ من خارجها شيئًا.
 */

export type KashidaLevel = 'low' | 'medium' | 'high';
export const KASHIDA_LEVELS: readonly KashidaLevel[] = ['low', 'medium', 'high'];
/** نصيب التطويل من فراغ السطر بالمستوى. */
export const KASHIDA_SHARE: Record<KashidaLevel, number> = { low: 0.33, medium: 0.66, high: 1 };
/** أكثر التطويل في الكلمة الواحدة — فلا تُمطّ كلمةٌ وحدها في سطرٍ قليل المواضع. */
export const KASHIDA_MAX_PER_WORD = 5;

/**
 * موضع التطويل في الكلمة: قبل الحرف `at` (بعد سابقه وحركاته)، وأولويّته `p` — أو `null`.
 * بين حرفين يتّصلان وحدهما (السابق يتّصل بما بعده، واللاحق بما قبله)، ولا بين اللام والألف (لام ألف)، ولا في كلمةٍ فيها تطويلٌ كتبه الموظف.
 * والأولويّة: بعد السين وأخواتها (٥)، ثم قبل الأخيرة إن كانت ة ه د ذ (٤)، ثم قبل ا ط ظ ل ك (٣)، ثم قبل الأخيرة (٢)، ثم بين الحروف (١) — والتعادل للأخير.
 */
export function kashidaPoint(word: string): { at: number; p: number } | null {
  const DUAL = 'بتثجحخسشصضطظعغفقكلمنهيىئ';
  const RIGHT = 'اأإآدذرزوؤة';
  const ALEF = 'اأإآ';
  const SEEN = 'سشصض';
  const FINAL = 'ةهدذ';
  const BEFORE = 'اأإآطظلك';
  if (word.includes('ـ')) return null;
  const letters: number[] = [];
  for (let i = 0; i < word.length; i++) {
    const c = word.charCodeAt(i);
    if (!((c >= 0x064b && c <= 0x065f) || c === 0x0670)) letters.push(i);
  }
  let best: { at: number; p: number } | null = null;
  for (let k = 0; k + 1 < letters.length; k++) {
    const a = word[letters[k]!]!;
    const b = word[letters[k + 1]!]!;
    if (!DUAL.includes(a) || !(DUAL.includes(b) || RIGHT.includes(b))) continue;
    if (a === 'ل' && ALEF.includes(b)) continue;
    const last = k + 1 === letters.length - 1;
    const p = SEEN.includes(a) ? 5 : last && FINAL.includes(b) ? 4 : BEFORE.includes(b) ? 3 : last ? 2 : 1;
    if (!best || p > best.p || (p === best.p && p !== 5)) best = { at: letters[k + 1]!, p };
  }
  return best;
}

/** `n` تطويلٍ على كلمات السطر بالدور — الأعلى أولويّةً أوّلًا (والتعادل لترتيبها في السطر)، و`cap` في الكلمة على الأكثر. */
export function planLine(priorities: readonly (number | null)[], n: number, cap: number): number[] {
  const out = priorities.map(() => 0);
  const order = priorities
    .map((p, i) => ({ p, i }))
    .filter((x): x is { p: number; i: number } => x.p !== null)
    .sort((a, b) => b.p - a.p || a.i - b.i);
  let left = Math.max(0, Math.floor(n));
  for (let k = 0, idle = 0; left > 0 && order.length && idle < order.length; k = (k + 1) % order.length) {
    const i = order[k]!.i;
    if (out[i]! < cap) {
      out[i]!++;
      left--;
      idle = 0;
    } else idle++;
  }
  return out;
}

// ── المرور على DOM (أنواعٌ بنيويّة: الإعداد الرئيسيّ بلا أنواع DOM) ─────────────────

type KRect = { left: number; right: number; top: number; height: number };
type KText = { data: string; parentNode: KElement | null; splitText(offset: number): KText };
type KElement = {
  dataset: Record<string, string | undefined>;
  style: { textAlign: string };
  clientWidth: number;
  textContent: string | null;
  className: string;
  parentNode: KElement | null;
  getBoundingClientRect(): KRect;
  appendChild(node: unknown): unknown;
  insertBefore(node: unknown, ref: unknown): unknown;
  removeChild(node: unknown): unknown;
  normalize(): void;
  querySelectorAll(selector: string): ArrayLike<KElement>;
  ownerDocument: KDoc;
};
type KDoc = {
  createElement(tag: string): KElement;
  createRange(): { setStart(node: KText, offset: number): void; setEnd(node: KText, offset: number): void; getClientRects(): ArrayLike<KRect> };
  createTreeWalker(root: KElement, whatToShow: number): { nextNode(): unknown };
  defaultView: { getComputedStyle(el: KElement): { direction: string; paddingLeft: string; paddingRight: string; textIndent: string } } | null;
};

/**
 * يملأ أسطر كلّ `[data-kashida]` في `root` بالتطويل: تُقاس الأسطر بمحاذاة البداية، ويُوزَّع نصيب المستوى من فراغ كلّ سطرٍ (إلا الأخير) على مواضع كلماته،
 * ويُدخل `<span class="kashida">ـ…</span>`، ثم يعود الضبط. وفقرةٌ زاد ارتفاعها (انكسر سطرٌ) تُعاد كما كانت. ويعيد عدد ما أُدخل.
 */
export function applyKashida(
  root: KElement,
  point: (word: string) => { at: number; p: number } | null,
  plan: (priorities: readonly (number | null)[], n: number, cap: number) => number[],
  shares: Record<string, number>,
  cap: number
): number {
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  if (!view) return 0;
  const paras = Array.from(root.querySelectorAll('[data-kashida]')).filter(
    (p) => (shares[p.dataset.kashida ?? ''] ?? 0) > 0 && view.getComputedStyle(p).direction === 'rtl'
  );
  const kept = paras.map((p) => p.style.textAlign);
  for (const p of paras) p.style.textAlign = 'start';
  const inserts: { para: KElement; node: KText; offset: number; count: number }[] = [];
  const heights = paras.map((p) => p.getBoundingClientRect().height);
  const range = doc.createRange();
  for (const p of paras) {
    const share = shares[p.dataset.kashida ?? ''] ?? 0;
    const cs = view.getComputedStyle(p);
    const inner = p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const indent = parseFloat(cs.textIndent) || 0;
    // عرض التطويل بخطّ موضعه: يُقاس مرّةً لكلّ عنصرٍ يحمل نصًّا، قبل قياس الكلمات.
    const texts: KText[] = [];
    const walker = doc.createTreeWalker(p, 4);
    for (let n = walker.nextNode() as KText | null; n; n = walker.nextNode() as KText | null) texts.push(n);
    const widths = new Map<KElement, number>();
    for (const t of texts) {
      const parent = t.parentNode;
      if (!parent || widths.has(parent)) continue;
      const probe = doc.createElement('span');
      probe.textContent = 'ـ';
      parent.appendChild(probe);
      widths.set(parent, probe.getBoundingClientRect().right - probe.getBoundingClientRect().left);
      parent.removeChild(probe);
    }
    const words: { node: KText; start: number; text: string; rect: KRect; tw: number }[] = [];
    for (const t of texts) {
      const re = /\S+/g;
      for (let m = re.exec(t.data); m; m = re.exec(t.data)) {
        range.setStart(t, m.index);
        range.setEnd(t, m.index + m[0].length);
        const rect = range.getClientRects()[0];
        if (rect) words.push({ node: t, start: m.index, text: m[0], rect, tw: widths.get(t.parentNode!) ?? 0 });
      }
    }
    const lines: (typeof words)[] = [];
    for (const w of words) {
      const line = lines[lines.length - 1];
      if (line && Math.abs(line[0]!.rect.top - w.rect.top) < 3) line.push(w);
      else lines.push([w]);
    }
    lines.pop(); // السطر الأخير لا يُضبط
    lines.forEach((line, i) => {
      if (line.length < 2) return;
      const natural = Math.max(...line.map((w) => w.rect.right)) - Math.min(...line.map((w) => w.rect.left));
      const slack = inner - (i === 0 ? indent : 0) - natural;
      const pts = line.map((w) => point(w.text));
      const tw = Math.max(0, ...line.map((w, k) => (pts[k] ? w.tw : 0)));
      if (!(tw > 0) || slack <= tw) return;
      const counts = plan(
        pts.map((x) => (x ? x.p : null)),
        Math.floor((slack * share - 1) / tw),
        cap
      );
      line.forEach((w, k) => {
        if (counts[k]) inserts.push({ para: p, node: w.node, offset: w.start + pts[k]!.at, count: counts[k]! });
      });
    });
  }
  // الإدخال من آخر العقدة إلى أوّلها، فلا تنزاح المواضع.
  inserts.sort((a, b) => (a.node === b.node ? b.offset - a.offset : 0));
  const spans = new Map<KElement, KElement[]>();
  for (const ins of inserts) {
    const tail = ins.node.splitText(ins.offset);
    const span = doc.createElement('span');
    span.className = 'kashida';
    span.textContent = 'ـ'.repeat(ins.count);
    tail.parentNode!.insertBefore(span, tail);
    spans.set(ins.para, [...(spans.get(ins.para) ?? []), span]);
  }
  // فقرةٌ انكسر فيها سطرٌ بعد الإدخال تعود كما كانت.
  let inserted = 0;
  paras.forEach((p, i) => {
    const mine = spans.get(p) ?? [];
    if (p.getBoundingClientRect().height > heights[i]! + 1) {
      for (const s of mine) s.parentNode?.removeChild(s);
      p.normalize();
    } else inserted += mine.length;
    p.style.textAlign = kept[i]!;
  });
  return inserted;
}
