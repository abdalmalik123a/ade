/**
 * قارئ Word — قطع الفقرة حروفًا بتنسيقها وصورها، ومقاطع السطر وأعمدة المسافات، والمحاذاة وعرض الحرف — نُقل من `docxDoc.ts` (D79).
 */
import { type Align, type ImageBlock, newUuid, type Inline, type Marks, tokenInlines } from '@shared/doc';
import { type RProps, type Ctx, chain, readR } from './docxStyles';
import { type XNode, kid, find, num, val } from './docxXml';
import { fixZeroPeriods, APPLY_THRESHOLD } from './blanks';
import type { KashidaLevel } from '@shared/kashida';

export const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * عرضٌ تقديريّ للحرف بمقاييس Arial — الخطّ الذي يرسم به Word العربيَّ افتراضًا.
 *
 * لا يُحتاج إلا لمعرفة أين أوصلت المسافاتُ النصَّ في Word: «ادارة ……… العدد:»
 * يقع فيه العدد حيث بلغته ستّون مسافة، لا عند الهامش. والخطأ هنا عُشرٌ في موضع
 * عمود، لا في النصّ.
 */
export function charEm(ch: string, bold: boolean): number {
  if (ch === ' ' || ch === ' ' || ch === '/') return 0.278;
  if (/[0-9٠-٩]/.test(ch)) return 0.556;
  // مَقيسةٌ من تصدير Word نفسه: «مدرسة الصحوة الابتدائية» عريضةً ٠٫٣٥٥،
  // و«الى / ولي امر التلميذ» عاديةً ٠٫٣١ — لا تقديرًا من جدول خطوط.
  if (/[؀-ۿ]/.test(ch)) return bold ? 0.355 : 0.31;
  if (/[A-Za-z]/.test(ch)) return 0.5;
  return 0.3;
}

export const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

/**
 * المحاذاة: في الفقرة العربية يكتب Word `right` لليسار و`left` لليمين.
 *
 * ثابتٌ بسؤال Word نفسه — فقرةٌ عربية محاذاةٌ يسارًا خرجت `<w:jc w:val="right"/>`،
 * واليمنى بلا `jc` أصلًا. وقراءتهما حرفيًّا كانت تقلب كل سطرٍ يساريّ.
 */
export function mapJc(jc: string | undefined, bidi: boolean): Align {
  switch (jc) {
    case 'center':
      return 'center';
    case 'both':
    case 'distribute':
    case 'lowKashida':
    case 'mediumKashida':
    case 'highKashida':
    case 'thaiDistribute':
      return 'justify';
    case 'end':
      return bidi ? 'left' : 'right';
    case 'right':
      return bidi ? 'left' : 'right';
    case 'left':
      return bidi ? 'right' : 'left';
    default:
      return bidi ? 'right' : 'left';
  }
}

/** مستوى الكشيدة في الفقرة المضبوطة من `w:jc` (D183) — وما سواها بلا مستوى. */
export function jcKashida(jc: string | undefined): KashidaLevel | undefined {
  return jc === 'lowKashida' ? 'low' : jc === 'mediumKashida' ? 'medium' : jc === 'highKashida' ? 'high' : undefined;
}

// ── الفقرة ───────────────────────────────────────────────────────────

/** حرفٌ بتنسيقه — الوحدة التي تُقصّ عندها الأعمدة وتُصحّح الأصفار. */
export type Cell = { ch: string; bold: boolean; italic: boolean; underline: boolean; px: number; strike?: boolean; script?: 'sup' | 'sub'; color?: string };

export type Piece = { kind: 'chars'; cells: Cell[] } | { kind: 'break' } | { kind: 'page' };

export const sizePx = (r: RProps, cs: boolean) => {
  const half = cs ? (r.szCs ?? r.sz) : (r.sz ?? r.szCs);
  return ((half ?? 22) / 2) * (96 / 72);
};

/** يمشي على أبناء الفقرة: المقاطع وما يلفّها (روابط، إدراجات، حقول محتوى). */
export function collectRuns(n: XNode, out: XNode[]) {
  for (const k of n.kids) {
    if (k.name === 'w:r') out.push(k);
    else if (['w:pPr', 'w:del', 'w:moveFrom', 'w:rPr', 'w:sdtPr'].includes(k.name)) continue;
    else collectRuns(k, out);
  }
}

export function imageFrom(run: XNode, align: Align, ctx: Ctx): ImageBlock | null {
  let rel: string | undefined;
  let width = 0;
  let height = 0;
  let imgAlign = align;

  const drawing = kid(run, 'w:drawing');
  if (drawing) {
    const extent = find(drawing, 'wp:extent');
    width = (num(extent?.attrs['cx']) ?? 0) / 9525;
    height = (num(extent?.attrs['cy']) ?? 0) / 9525;
    rel = find(drawing, 'a:blip')?.attrs['r:embed'];
    const h = find(drawing, 'wp:positionH');
    const hAlign = h ? find(h, 'wp:align')?.text.trim() : undefined;
    if (hAlign === 'center' || hAlign === 'left' || hAlign === 'right') imgAlign = hAlign;
  }
  const pict = kid(run, 'w:pict') ?? kid(run, 'w:object');
  if (pict) {
    const shape = find(pict, 'v:shape');
    rel = find(pict, 'v:imagedata')?.attrs['r:id'];
    const style = shape?.attrs['style'] ?? '';
    const dim = (key: string) => {
      const m = style.match(new RegExp(`${key}:\\s*([\\d.]+)(pt|px|in|cm|mm)?`));
      if (!m) return 0;
      const v = Number(m[1]);
      const unit = m[2] ?? 'px';
      return unit === 'pt' ? v * (96 / 72) : unit === 'in' ? v * 96 : unit === 'cm' ? (v * 96) / 2.54 : unit === 'mm' ? (v * 96) / 25.4 : v;
    };
    width = dim('width');
    height = dim('height');
    // الخطّ الأفقي في Word صورةٌ بـ`o:hr` ومحاذاتها في `o:hralign`.
    const hr = shape?.attrs['o:hralign'];
    if (hr === 'center' || hr === 'left' || hr === 'right') imgAlign = hr;
  }
  if (!rel) return null;

  const target = ctx.rels.get(rel);
  const bytes = target ? ctx.files[`word/${target}`] : undefined;
  if (!bytes || !ctx.saveImage) {
    ctx.notes.add('صورةٌ في الملف لم تُنقل — أعِد إدراجها');
    return null;
  }
  const dot = target!.lastIndexOf('.');
  const src = ctx.saveImage(bytes, dot > 0 ? target!.slice(dot) : '.png');
  if (!src) return null;

  // صورةٌ أعرض من الورقة تُحصر فيها بنسبتها.
  if (width > ctx.contentWidthPx) {
    height = height ? (height * ctx.contentWidthPx) / width : 0;
    width = ctx.contentWidthPx;
  }
  return {
    id: newUuid(),
    kind: 'image',
    src,
    width: Math.max(8, Math.round(width || 120)),
    ...(height ? { height: Math.max(1, Math.round(height)) } : {}),
    align: imgAlign
  };
}

/** قطعُ الفقرة: حروفٌ بتنسيقها، وكسرُ سطر، وفاصلُ صفحة — والصور تُعاد وحدها. */
export function readPieces(
  p: XNode,
  ctx: Ctx,
  styleR: RProps,
  align: Align
): { pieces: Piece[]; images: ImageBlock[] } {
  const pieces: Piece[] = [];
  const images: ImageBlock[] = [];
  let chars: Cell[] = [];
  const flush = () => {
    if (chars.length) pieces.push({ kind: 'chars', cells: chars });
    chars = [];
  };

  const runs: XNode[] = [];
  collectRuns(p, runs);
  for (const r of runs) {
    const rStyle = val(kid(kid(r, 'w:rPr'), 'w:rStyle'));
    const rr: RProps = Object.assign({}, styleR, ...chain(ctx.styles, rStyle).map((s) => s.r), readR(kid(r, 'w:rPr')));
    const text = r.kids.map((k) => (k.name === 'w:t' ? k.text : '')).join('');
    // النصّ العربي يُرسم بخصائص «النصوص المعقّدة»: `bCs` و`szCs` لا `b` و`sz`.
    const cs = Boolean(rr.rtl) || hasArabic(text);
    const cellOf = (ch: string): Cell => ({
      ch,
      bold: Boolean(cs ? (rr.bCs ?? false) : rr.b),
      italic: Boolean(cs ? (rr.iCs ?? false) : rr.i),
      underline: Boolean(rr.u),
      px: sizePx(rr, cs),
      ...(rr.strike ? { strike: true } : {}),
      ...(rr.script ? { script: rr.script } : {}),
      ...(rr.color ? { color: rr.color } : {})
    });

    for (const k of r.kids) {
      if (k.name === 'w:t') for (const ch of k.text) chars.push(cellOf(ch));
      else if (k.name === 'w:tab' || k.name === 'w:ptab') chars.push(cellOf('\t'));
      else if (k.name === 'w:noBreakHyphen') chars.push(cellOf('-'));
      else if (k.name === 'w:br' || k.name === 'w:cr') {
        flush();
        pieces.push(k.attrs['w:type'] === 'page' ? { kind: 'page' } : { kind: 'break' });
      } else if (k.name === 'w:drawing' || k.name === 'w:pict' || k.name === 'w:object') {
        const img = imageFrom(r, align, ctx);
        if (img) images.push(img);
      }
    }
  }
  flush();
  return { pieces, images };
}

/**
 * «0» بدل النقطة عبر المقاطع: `وانذاره` في مقطع و`0 راجين` في آخر.
 *
 * والتصحيح حرفٌ بحرف فلا تتزحزح المواضع — فيُصحّح على النصّ كاملًا ويُعاد إلى
 * حروفه بتنسيقها.
 */
export function fixZeros(cells: Cell[], notes: Set<string>) {
  let text = cells.map((c) => c.ch).join('');
  for (let guard = 0; guard < 50; guard++) {
    const fix = fixZeroPeriods(text).find((s) => s.confidence >= APPLY_THRESHOLD);
    if (!fix) break;
    let at = 0;
    while (at < text.length && text[at] === fix.value[at]) at++;
    if (at >= cells.length) break;
    // يُعدَّل الحرف نفسه لا نسخته: المصفوفة هنا جمعٌ لحروف القطع لا القطع ذاتها.
    cells[at]!.ch = '.';
    text = fix.value;
    notes.add('«0» كُتب بدل النقطة فصُحّح «.»');
  }
}

/** موضع الجدولة التالي: جدولات الفقرة أوّلًا، ثم شبكة المستند الافتراضية. */
export function nextStop(pos: number, stops: number[], def: number): number {
  const custom = stops.find((s) => s > pos + 1);
  if (custom !== undefined) return custom;
  return (Math.floor(pos / def) + 1) * def;
}

/** يحوّل الحروف مقاطعَ — المتجاور بتنسيقٍ واحد مقطعٌ واحد. */
export function toInlines(pieces: Piece[], basePx: number): Inline[] {
  const out: Inline[] = [];
  for (const piece of pieces) {
    if (piece.kind === 'break') {
      out.push({ kind: 'break' });
      continue;
    }
    if (piece.kind !== 'chars') continue;
    for (const c of piece.cells) {
      const size = round1(c.px);
      const marks: Marks = {};
      if (c.bold) marks.bold = true;
      if (c.italic) marks.italic = true;
      if (c.underline) marks.underline = true;
      if (size !== basePx) marks.size = size;
      if (c.strike) marks.strike = true;
      if (c.script) marks.script = c.script;
      if (c.color) marks.color = c.color;
      const ch = c.ch === '\t' ? '    ' : c.ch;
      const last = out[out.length - 1];
      if (last?.kind === 'run' && JSON.stringify(last.marks ?? {}) === JSON.stringify(marks)) {
        last.text += ch;
      } else {
        out.push(Object.keys(marks).length ? { kind: 'run', text: ch, marks } : { kind: 'run', text: ch });
      }
    }
  }
  // مسافاتُ آخر السطر لا تُرى، وتُربك المحاذاة.
  const tail = out[out.length - 1];
  if (tail?.kind === 'run') {
    tail.text = tail.text.replace(/[ \t ]+$/, '');
    if (!tail.text) out.pop();
  }
  return withTokens(out);
}

/**
 * «{الاسم}» في ملف Word حقلٌ — كما يكتبه تصدير النموذج إلى Word، وكما يكتبه المكتب
 * بيده في مربّع نصّ اللوحة وفي النموذج القديم (`tokenInlines` واحدٌ لها كلّها). فيعود
 * الملف المصدَّر نموذجًا بحقوله إن عُدّل في Word واستُورد. والتنسيق يبقى على ما حوله.
 */
export function withTokens(list: Inline[]): Inline[] {
  const out: Inline[] = [];
  for (const n of list) {
    if (n.kind !== 'run' || !n.text.includes('{')) {
      out.push(n);
      continue;
    }
    for (const part of tokenInlines(n.text)) out.push(part.kind === 'run' && n.marks ? { ...part, marks: n.marks } : part);
  }
  return out;
}

/** الحجم الغالب على حروف الفقرة — فلا يُكتب على كل مقطعٍ حجمُه. */
export function dominantPx(cells: Cell[], fallback: number): number {
  const count = new Map<number, number>();
  for (const c of cells) {
    if (/\s/.test(c.ch)) continue;
    const k = round1(c.px);
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  // سطرٌ مسافاتُه وحدها يأخذ ارتفاعه من علامة الفقرة لا من مسافاته: Word لا
  // يعدّ المسافات في ارتفاع السطر. ثابتٌ بتصديره — مسافةٌ بحجم ٢٠ وعلامةٌ بخمس
  // نقاط خرجت سطرًا بخمس نقاط، مثل السطر الفارغ قبلها تمامًا.
  let best = round1(fallback);
  let most = 0;
  for (const [k, n] of count) if (n > most) [best, most] = [k, n];
  return best;
}

/**
 * سطرٌ عمودان كُتب بالمسافات: «ادارة ……… العدد:».
 *
 * يُقسم بشروطٍ متشدّدة، فخطأ قسمة جملةٍ من المتن أسوأ من إبقاء سطرٍ كما هو:
 * سطرٌ قصير، محاذاته البداية، والفراغ ليس داخل قوسين — «(          )» فراغ
 * كتابةٍ باليد لا فاصل عمودين.
 */
export function splitGaps(cells: Cell[]): number[][] | null {
  const text = cells.map((c) => c.ch).join('');
  const letters = text.replace(/\s/g, '').length;
  if (letters === 0 || letters > 50) return null;

  const cuts: number[][] = [];
  for (const m of text.matchAll(/[  ]{6,}|\t[ \t ]*/g)) {
    const at = m.index ?? 0;
    const before = text.slice(0, at);
    const after = text.slice(at + m[0].length);
    if (!before.trim() || !after.trim()) continue;
    const depth = (before.match(/\(/g) ?? []).length - (before.match(/\)/g) ?? []).length;
    if (depth > 0) continue;
    cuts.push([at, at + m[0].length]);
  }
  return cuts.length >= 1 && cuts.length <= 2 ? cuts : null;
}
