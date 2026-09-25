/**
 * Word ← ورقة: يعيد رسم ملف Word على ورقة البرنامج كما صنعه صاحبه.
 *
 * المكاتب لا تستعمل ترويسة Word ولا تفصل رأس الكتاب عن متنه: الملف عندها قطعةٌ
 * واحدة. فلا يُفصل هنا شيء — الرأس أسطرٌ في أعلى الورقة كما كُتب، بأحجامه
 * وعريضه ومحاذاته، والجداول جداول، والخطّ الفاصل صورةٌ بمقاسها، وهوامش الصفحة
 * من الملف. ثم يظلّل المكتب ما يتغيّر ويضغط F4.
 *
 * **والمقياس ما يرسمه Word نفسه لا ما نظنّه.** تثبّته الملفات المرجعية في
 * `tests/fixtures/`، وقد قيس عليها بتصدير Word الملفَّ PDF.
 *
 * وما لا يُستورد يُقال في الملاحظات ولا يُخمَّن: ترقيمٌ غريب، ومسافةٌ قبل الفقرة.
 */
import { strFromU8 } from 'fflate';
import {
  emptyDoc,
  newUuid,
  paragraph,
  reconcileFields,
  type Align,
  type Block,
  type ColumnsBlock,
  type Doc,
  type ImageBlock,
  type Inline,
  type Marks,
  type PageSetup,
  type ParagraphBlock,
  type TableBlock,
  type TableCell
} from '@shared/doc';
import { APPLY_THRESHOLD, fixZeroPeriods } from './blanks';

/** ملف يُنقل من حزمة Word إلى مخزن التطبيق فيعيد مساره النسبي. */
export type SaveImage = (bytes: Uint8Array, extension: string) => string | null;

// ── قارئ XML صغير ────────────────────────────────────────────────────

/**
 * عقدة XML: اسمٌ وسماتٌ وأبناءٌ ونصّ.
 *
 * ملف Word شجرة — جدولٌ في خليّته فقرة في مقطعها نصّ — والتعابير النمطية تقرؤه
 * سطحًا فتخلط فقرة الخليّة بفقرة المتن. وقارئٌ بأربعين سطرًا يكفي: الملف مولَّدٌ
 * سليم البنية دائمًا.
 */
export type XNode = { name: string; attrs: Record<string, string>; kids: XNode[]; text: string };

const decode = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');

export function parseXml(xml: string): XNode {
  const root: XNode = { name: '#root', attrs: {}, kids: [], text: '' };
  const stack: XNode[] = [root];
  const re =
    /<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|<!\[CDATA\[([\s\S]*?)\]\]>|<[?!][\s\S]*?>|([^<]+)/g;

  for (const m of xml.matchAll(re)) {
    const top = stack[stack.length - 1]!;
    if (m[6] !== undefined) {
      top.text += decode(m[6]);
      continue;
    }
    if (m[5] !== undefined) {
      top.text += m[5];
      continue;
    }
    if (!m[2]) continue; // تعليق أو تعليمة معالجة
    if (m[1]) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of (m[3] ?? '').matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      attrs[a[1]!] = decode(a[2] ?? a[3] ?? '');
    }
    const node: XNode = { name: m[2], attrs, kids: [], text: '' };
    top.kids.push(node);
    if (!m[4]) stack.push(node);
  }
  return root;
}

const kid = (n: XNode | undefined, name: string) => n?.kids.find((k) => k.name === name);
const kidsOf = (n: XNode | undefined, name: string) => n?.kids.filter((k) => k.name === name) ?? [];
const val = (n: XNode | undefined) => n?.attrs['w:val'];
const num = (s: string | undefined) => (s === undefined || s === '' ? undefined : Number(s));
/** خاصيةٌ مفتاحية: وجودها تشغيل، إلا أن تُطفأ صراحةً بـ`w:val="0"`. */
const toggle = (n: XNode | undefined) =>
  n === undefined ? undefined : !['0', 'false', 'off', 'none'].includes(n.attrs['w:val'] ?? '');

function find(n: XNode, name: string): XNode | undefined {
  for (const k of n.kids) {
    if (k.name === name) return k;
    const deep = find(k, name);
    if (deep) return deep;
  }
  return undefined;
}

// ── الأنماط: ما لم يُكتب على المقطع يُرث من نمطه ثم من افتراض المستند ──

type RProps = { b?: boolean; bCs?: boolean; u?: boolean; sz?: number; szCs?: number; rtl?: boolean };
type PProps = {
  jc?: string;
  bidi?: boolean;
  after?: number;
  before?: number;
  line?: number;
  lineRule?: string;
  firstLine?: number;
  hanging?: number;
  start?: number;
  tabs?: number[];
  numId?: string;
  ilvl?: number;
};

function readR(rpr: XNode | undefined): RProps {
  if (!rpr) return {};
  const o: RProps = {};
  const set = <K extends keyof RProps>(key: K, v: RProps[K] | undefined) => {
    if (v !== undefined) o[key] = v;
  };
  set('b', toggle(kid(rpr, 'w:b')));
  set('bCs', toggle(kid(rpr, 'w:bCs')));
  set('rtl', toggle(kid(rpr, 'w:rtl')));
  const u = kid(rpr, 'w:u');
  if (u) o.u = (val(u) ?? 'single') !== 'none';
  set('sz', num(val(kid(rpr, 'w:sz'))));
  set('szCs', num(val(kid(rpr, 'w:szCs'))));
  return o;
}

function readP(ppr: XNode | undefined): PProps {
  if (!ppr) return {};
  const o: PProps = {};
  const jc = val(kid(ppr, 'w:jc'));
  if (jc) o.jc = jc;
  const bidi = toggle(kid(ppr, 'w:bidi'));
  if (bidi !== undefined) o.bidi = bidi;
  const sp = kid(ppr, 'w:spacing');
  if (sp) {
    const after = num(sp.attrs['w:after']);
    const before = num(sp.attrs['w:before']);
    const line = num(sp.attrs['w:line']);
    if (after !== undefined) o.after = after;
    if (before !== undefined) o.before = before;
    if (line !== undefined) o.line = line;
    if (sp.attrs['w:lineRule']) o.lineRule = sp.attrs['w:lineRule'];
  }
  const ind = kid(ppr, 'w:ind');
  if (ind) {
    const first = num(ind.attrs['w:firstLine']);
    const hanging = num(ind.attrs['w:hanging']);
    const start = num(ind.attrs['w:start']);
    if (first !== undefined) o.firstLine = first;
    if (hanging !== undefined) o.hanging = hanging;
    if (start !== undefined) o.start = start;
  }
  const tabs = kidsOf(kid(ppr, 'w:tabs'), 'w:tab')
    .filter((t) => val(t) !== 'clear')
    .map((t) => num(t.attrs['w:pos']))
    .filter((p): p is number => typeof p === 'number' && p > 0);
  if (tabs.length) o.tabs = tabs;
  const numPr = kid(ppr, 'w:numPr');
  if (numPr) {
    const id = val(kid(numPr, 'w:numId'));
    if (id && id !== '0') {
      o.numId = id;
      o.ilvl = num(val(kid(numPr, 'w:ilvl'))) ?? 0;
    }
  }
  return o;
}

type Style = { basedOn?: string; r: RProps; p: PProps; node: XNode };

type Styles = {
  r: RProps;
  p: PProps;
  byId: Map<string, Style>;
  defaultPara?: string;
};

function readStyles(xml: string | undefined): Styles {
  const out: Styles = { r: {}, p: {}, byId: new Map() };
  if (!xml) return out;
  const root = parseXml(xml);
  const styles = find(root, 'w:styles');
  const defaults = kid(styles, 'w:docDefaults');
  out.r = readR(kid(kid(defaults, 'w:rPrDefault'), 'w:rPr'));
  out.p = readP(kid(kid(defaults, 'w:pPrDefault'), 'w:pPr'));
  for (const s of kidsOf(styles, 'w:style')) {
    const id = s.attrs['w:styleId'];
    if (!id) continue;
    out.byId.set(id, {
      basedOn: val(kid(s, 'w:basedOn')),
      r: readR(kid(s, 'w:rPr')),
      p: readP(kid(s, 'w:pPr')),
      node: s
    });
    if (s.attrs['w:type'] === 'paragraph' && ['1', 'true', 'on'].includes(s.attrs['w:default'] ?? '')) {
      out.defaultPara = id;
    }
  }
  return out;
}

/** سلسلة `basedOn` من الأبعد إلى الأقرب — والأقرب يغلب. */
function chain(styles: Styles, id: string | undefined): Style[] {
  const out: Style[] = [];
  const seen = new Set<string>();
  for (let at = id; at && !seen.has(at) && out.length < 20; ) {
    seen.add(at);
    const s = styles.byId.get(at);
    if (!s) break;
    out.unshift(s);
    at = s.basedOn;
  }
  return out;
}

// ── الترقيم: ما يرسمه Word رقمًا لا نصًّا يُكتب هنا نصًّا ────────────

const AR_ALPHA = [...'أبتثجحخدذرزسشصضطظعغفقكلمنهوي'];
const AR_ABJAD = [...'أبجدهوزحطيكلمنسعفصقرشتثخذضظغ'];

function formatNumber(n: number, fmt: string): string {
  switch (fmt) {
    case 'bullet':
      return '•';
    case 'arabicAlpha':
      return AR_ALPHA[(n - 1) % AR_ALPHA.length]!;
    case 'arabicAbjad':
      return AR_ABJAD[(n - 1) % AR_ABJAD.length]!;
    case 'lowerLetter':
      return String.fromCharCode(96 + (((n - 1) % 26) + 1));
    case 'upperLetter':
      return String.fromCharCode(64 + (((n - 1) % 26) + 1));
    case 'hindiNumbers':
    case 'arabicAbjadNumbers':
      return String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);
    default:
      return String(n);
  }
}

type Numbering = (numId: string, ilvl: number) => string | null;

function readNumbering(xml: string | undefined, notes: Set<string>): Numbering {
  if (!xml) return () => null;
  const root = find(parseXml(xml), 'w:numbering');
  const abstracts = new Map<string, XNode>();
  for (const a of kidsOf(root, 'w:abstractNum')) abstracts.set(a.attrs['w:abstractNumId'] ?? '', a);
  const nums = new Map<string, string>();
  for (const n of kidsOf(root, 'w:num')) {
    nums.set(n.attrs['w:numId'] ?? '', val(kid(n, 'w:abstractNumId')) ?? '');
  }
  const counters = new Map<string, number[]>();

  return (numId, ilvl) => {
    const abs = abstracts.get(nums.get(numId) ?? '');
    const lvl = kidsOf(abs, 'w:lvl').find((l) => num(l.attrs['w:ilvl']) === ilvl);
    if (!lvl) return null;
    const fmt = val(kid(lvl, 'w:numFmt')) ?? 'decimal';
    const text = val(kid(lvl, 'w:lvlText')) ?? '%1.';
    const start = num(val(kid(lvl, 'w:start'))) ?? 1;

    const levels = counters.get(numId) ?? [];
    levels[ilvl] = (levels[ilvl] ?? start - 1) + 1;
    levels.length = ilvl + 1; // الأعمق يبدأ من جديد تحت كل عنصرٍ أعلى
    counters.set(numId, levels);

    if (!['decimal', 'bullet', 'arabicAlpha', 'arabicAbjad', 'lowerLetter', 'upperLetter', 'hindiNumbers', 'arabicAbjadNumbers'].includes(fmt)) {
      notes.add(`ترقيم Word بنمط «${fmt}» قُرئ أرقامًا عادية — راجعه`);
    }
    if (fmt === 'bullet') return '•';
    return text.replace(/%(\d)/g, (_, l: string) => formatNumber(levels[Number(l) - 1] ?? 1, fmt));
  };
}

// ── المقاسات ─────────────────────────────────────────────────────────

/** ١ بكسل = ١٥ twip عند ٩٦ نقطة/إنش — مقياس الورقة في المعاينة والطباعة معًا. */
const TW_PER_PX = 15;
const twToMm = (tw: number) => Math.round((tw / 1440) * 25.4 * 10) / 10;
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * عرضٌ تقديريّ للحرف بمقاييس Arial — الخطّ الذي يرسم به Word العربيَّ افتراضًا.
 *
 * لا يُحتاج إلا لمعرفة أين أوصلت المسافاتُ النصَّ في Word: «ادارة ……… العدد:»
 * يقع فيه العدد حيث بلغته ستّون مسافة، لا عند الهامش. والخطأ هنا عُشرٌ في موضع
 * عمود، لا في النصّ.
 */
function charEm(ch: string, bold: boolean): number {
  if (ch === ' ' || ch === ' ' || ch === '/') return 0.278;
  if (/[0-9٠-٩]/.test(ch)) return 0.556;
  // مَقيسةٌ من تصدير Word نفسه: «مدرسة الصحوة الابتدائية» عريضةً ٠٫٣٥٥،
  // و«الى / ولي امر التلميذ» عاديةً ٠٫٣١ — لا تقديرًا من جدول خطوط.
  if (/[؀-ۿ]/.test(ch)) return bold ? 0.355 : 0.31;
  if (/[A-Za-z]/.test(ch)) return 0.5;
  return 0.3;
}

const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

/**
 * المحاذاة: في الفقرة العربية يكتب Word `right` لليسار و`left` لليمين.
 *
 * ثابتٌ بسؤال Word نفسه — فقرةٌ عربية محاذاةٌ يسارًا خرجت `<w:jc w:val="right"/>`،
 * واليمنى بلا `jc` أصلًا. وقراءتهما حرفيًّا كانت تقلب كل سطرٍ يساريّ.
 */
function mapJc(jc: string | undefined, bidi: boolean): Align {
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

// ── الفقرة ───────────────────────────────────────────────────────────

/** حرفٌ بتنسيقه — الوحدة التي تُقصّ عندها الأعمدة وتُصحّح الأصفار. */
type Cell = { ch: string; bold: boolean; underline: boolean; px: number };
type Piece = { kind: 'chars'; cells: Cell[] } | { kind: 'break' } | { kind: 'page' };

type Ctx = {
  styles: Styles;
  numbering: Numbering;
  notes: Set<string>;
  rels: Map<string, string>;
  files: Record<string, Uint8Array>;
  saveImage?: SaveImage;
  defaultTab: number;
  contentWidthTw: number;
  contentWidthPx: number;
};

/** خصائص الفقرة بعد الوراثة: افتراض المستند ← نمطها ← ما كُتب عليها. */
function paraProps(p: XNode, ctx: Ctx): { pp: PProps; styleR: RProps; markR: RProps } {
  const ppr = kid(p, 'w:pPr');
  const styleId = val(kid(ppr, 'w:pStyle')) ?? ctx.styles.defaultPara;
  const styles = chain(ctx.styles, styleId);
  const pp: PProps = Object.assign({}, ctx.styles.p, ...styles.map((s) => s.p), readP(ppr));
  const styleR: RProps = Object.assign({}, ctx.styles.r, ...styles.map((s) => s.r));
  const markR: RProps = { ...styleR, ...readR(kid(ppr, 'w:rPr')) };
  return { pp, styleR, markR };
}

const sizePx = (r: RProps, cs: boolean) => {
  const half = cs ? (r.szCs ?? r.sz) : (r.sz ?? r.szCs);
  return ((half ?? 22) / 2) * (96 / 72);
};

/** يمشي على أبناء الفقرة: المقاطع وما يلفّها (روابط، إدراجات، حقول محتوى). */
function collectRuns(n: XNode, out: XNode[]) {
  for (const k of n.kids) {
    if (k.name === 'w:r') out.push(k);
    else if (['w:pPr', 'w:del', 'w:moveFrom', 'w:rPr', 'w:sdtPr'].includes(k.name)) continue;
    else collectRuns(k, out);
  }
}

function imageFrom(run: XNode, align: Align, ctx: Ctx): ImageBlock | null {
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
function readPieces(
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
      underline: Boolean(rr.u),
      px: sizePx(rr, cs)
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
function fixZeros(cells: Cell[], notes: Set<string>) {
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
function nextStop(pos: number, stops: number[], def: number): number {
  const custom = stops.find((s) => s > pos + 1);
  if (custom !== undefined) return custom;
  return (Math.floor(pos / def) + 1) * def;
}

/** يحوّل الحروف مقاطعَ — المتجاور بتنسيقٍ واحد مقطعٌ واحد. */
function toInlines(pieces: Piece[], basePx: number): Inline[] {
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
      if (c.underline) marks.underline = true;
      if (size !== basePx) marks.size = size;
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
  return out;
}

/** الحجم الغالب على حروف الفقرة — فلا يُكتب على كل مقطعٍ حجمُه. */
function dominantPx(cells: Cell[], fallback: number): number {
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
function splitGaps(cells: Cell[]): number[][] | null {
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

function convertParagraph(p: XNode, ctx: Ctx): Block[] {
  const { pp, styleR, markR } = paraProps(p, ctx);
  const bidi = pp.bidi ?? false;
  const align = mapJc(pp.jc, bidi);
  const dir = bidi ? undefined : ('ltr' as const);
  const { pieces, images } = readPieces(p, ctx, styleR, align);

  if (pp.before) ctx.notes.add('المسافة قبل الفقرات لا تُستورد — تبقى المسافة بعدها');

  // الترقيم الذي يرسمه Word يُكتب نصًّا في أوّل الفقرة.
  if (pp.numId) {
    const label = ctx.numbering(pp.numId, pp.ilvl ?? 0);
    const first = pieces.find((x) => x.kind === 'chars');
    if (label && first?.kind === 'chars') {
      const proto = first.cells[0]!;
      first.cells.unshift(...[...`${label} `].map((ch) => ({ ...proto, ch })));
    }
  }

  const markPx = sizePx(markR, bidi || Boolean(markR.rtl));
  const spaceAfter = pp.after !== undefined ? round1(pp.after / TW_PER_PX) : undefined;
  const lineHeight =
    pp.line && (pp.lineRule ?? 'auto') === 'auto'
      ? Math.round((pp.line / 240) * 1.15 * 100) / 100
      : undefined;

  const blocks: Block[] = [...images];

  // فاصل الصفحة يشطر الفقرة: ما قبله ورقة وما بعده أخرى.
  const groups: Piece[][] = [[]];
  for (const piece of pieces) {
    if (piece.kind === 'page') groups.push([]);
    else groups[groups.length - 1]!.push(piece);
  }

  groups.forEach((group, gi) => {
    if (gi > 0) blocks.push({ id: newUuid(), kind: 'pageBreak' });
    const allCells = group.flatMap((x) => (x.kind === 'chars' ? x.cells : []));
    fixZeros(allCells, ctx.notes);

    // صورةٌ وحدها في فقرتها لا تحتاج سطرًا فارغًا بعدها.
    if (images.length && !allCells.some((c) => c.ch.trim())) return;

    const basePx = dominantPx(allCells, markPx);

    // الجدولات والمسافات في أوّل السطر موضعُ بدايته: تصير مسافةً بادئة بالملّم.
    let pos = (pp.firstLine ?? 0) - (pp.hanging ?? 0) + (pp.start ?? 0);
    const first = group[0];
    if (first?.kind === 'chars') {
      let i = 0;
      for (; i < first.cells.length; i++) {
        const c = first.cells[i]!;
        if (c.ch === '\t') pos = nextStop(pos, pp.tabs ?? [], ctx.defaultTab);
        else if (c.ch === ' ' || c.ch === ' ') pos += charEm(' ', false) * c.px * TW_PER_PX;
        else break;
      }
      first.cells.splice(0, i);
    }
    const indent = pos > 20 ? twToMm(pos) : undefined;

    const common: Partial<ParagraphBlock> = {
      align,
      ...(dir ? { dir } : {}),
      size: basePx,
      ...(lineHeight ? { lineHeight } : {}),
      ...(spaceAfter ? { spaceAfter } : {})
    };

    // عمودان أو ثلاثة بالمسافات — بشروطها، وللسطر الذي محاذاته البداية وحده.
    const onlyChars = group.length === 1 && first?.kind === 'chars';
    const cuts = onlyChars && align === (bidi ? 'right' : 'left') ? splitGaps(first.cells) : null;
    if (cuts && first?.kind === 'chars') {
      const cells = first.cells;
      const bounds: [number, number][] = [];
      let from = 0;
      for (const [a, b] of cuts) {
        bounds.push([from, a]);
        from = b;
      }
      bounds.push([from, cells.length]);

      // أين أوصلت المسافاتُ كلَّ جزء في Word — ومنه عرض عموده.
      const starts: number[] = [];
      let x = pos;
      let next = 1;
      for (let i = 0; i < cells.length && next < bounds.length; i++) {
        if (i === bounds[next]![0]) {
          starts.push(x);
          next++;
        }
        const c = cells[i]!;
        x = c.ch === '\t' ? nextStop(x, pp.tabs ?? [], ctx.defaultTab) : x + charEm(c.ch, c.bold) * c.px * TW_PER_PX;
      }
      if (starts.length === bounds.length - 1) {
        const edges = [0, ...starts.map((s) => Math.min(s, ctx.contentWidthTw * 0.9)), ctx.contentWidthTw];
        const widths = edges
          .slice(1)
          .map((e, i) => Math.max(0.05, Math.round(((e - edges[i]!) / ctx.contentWidthTw) * 1000) / 1000));

        const columns = bounds.map(([a, b], i) => {
          const part = cells.slice(a, b);
          const inlines = toInlines([{ kind: 'chars', cells: part }], basePx);
          return [
            paragraph(inlines, {
              ...common,
              align: bidi ? 'right' : 'left',
              ...(i === 0 && indent ? { indent } : {})
            })
          ];
        });
        const block: ColumnsBlock = { id: newUuid(), kind: 'columns', columns, widths, gap: 0 };
        blocks.push(block);
        return;
      }
    }

    blocks.push(
      paragraph(toInlines(group, basePx), { ...common, ...(indent ? { indent } : {}) })
    );
  });

  return blocks;
}

// ── الجدول ───────────────────────────────────────────────────────────

/** حدودٌ ظاهرة؟ — `nil` و`none` خطوطٌ مخفية، وجدولٌ بلا نمطٍ ولا حدود مخفيّ. */
function tableHasBorders(tbl: XNode, ctx: Ctx): boolean {
  const visible = (borders: XNode | undefined) =>
    borders !== undefined && borders.kids.some((b) => !['nil', 'none'].includes(val(b) ?? 'none'));
  const tblPr = kid(tbl, 'w:tblPr');
  const own = kid(tblPr, 'w:tblBorders');
  if (own) return visible(own);
  const styleId = val(kid(tblPr, 'w:tblStyle'));
  for (const s of chain(ctx.styles, styleId).reverse()) {
    const b = find(s.node, 'w:tblBorders');
    if (b) return visible(b);
  }
  return false;
}

function convertTable(tbl: XNode, ctx: Ctx): TableBlock {
  const grid = kidsOf(kid(tbl, 'w:tblGrid'), 'w:gridCol').map((g) => num(g.attrs['w:w']) ?? 0);
  const rowsX = kidsOf(tbl, 'w:tr');
  const widest = Math.max(1, ...rowsX.map((r) => kidsOf(r, 'w:tc').length));
  const total = grid.reduce((a, b) => a + b, 0);
  const columns =
    grid.length && total > 0
      ? grid.map((w) => Math.max(0.1, Math.round((w / total) * grid.length * 100) / 100))
      : Array.from({ length: widest }, () => 1);

  const rows = rowsX.map((tr) => ({
    id: newUuid(),
    cells: kidsOf(tr, 'w:tc').map((tc): TableCell => {
      const tcPr = kid(tc, 'w:tcPr');
      const span = num(val(kid(tcPr, 'w:gridSpan'))) ?? 1;
      const vMerge = kid(tcPr, 'w:vMerge');
      // امتدادُ دمجٍ عمودي: الخليّة فارغة، ونصّها في الخليّة التي بدأت الدمج.
      const continued = vMerge !== undefined && val(vMerge) !== 'restart';
      if (continued) ctx.notes.add('الخلايا المدموجة عموديًا فُكّ دمجها — النصّ في أولاها');

      const inlines: Inline[] = [];
      let align: Align = 'right';
      let size: number | undefined;
      if (!continued) {
        const paras: XNode[] = [];
        const walk = (n: XNode) => {
          for (const k of n.kids) {
            if (k.name === 'w:p') paras.push(k);
            else if (k.name !== 'w:tcPr') walk(k);
          }
        };
        walk(tc);
        paras.forEach((p, i) => {
          const blocks = convertParagraph(p, ctx).flatMap((b) =>
            b.kind === 'paragraph'
              ? [b]
              : b.kind === 'columns'
                ? b.columns.flat().filter((x): x is ParagraphBlock => x.kind === 'paragraph')
                : []
          );
          for (const b of blocks) {
            if (i === 0 && size === undefined) {
              align = b.align;
              size = b.size;
            }
            if (inlines.length) inlines.push({ kind: 'break' });
            inlines.push(...b.inlines);
          }
        });
      }
      return {
        id: newUuid(),
        blocks: [paragraph(inlines, { align, ...(size ? { size } : {}) })],
        ...(span > 1 ? { colSpan: span } : {})
      };
    })
  }));

  const header = Boolean(toggle(kid(kid(rowsX[0], 'w:trPr'), 'w:tblHeader')));
  return {
    id: newUuid(),
    kind: 'table',
    columns,
    header,
    borders: tableHasBorders(tbl, ctx),
    rows
  };
}

// ── الصفحة ───────────────────────────────────────────────────────────

function pageSetupFrom(sect: XNode | undefined): { setup: PageSetup; widthTw: number } {
  const pgSz = kid(sect, 'w:pgSz');
  const mar = kid(sect, 'w:pgMar');
  const w = num(pgSz?.attrs['w:w']) ?? 11906;
  const h = num(pgSz?.attrs['w:h']) ?? 16838;
  const m = (key: string, def: number) => num(mar?.attrs[key]) ?? def;
  const margins = {
    top: twToMm(m('w:top', 1134)),
    right: twToMm(m('w:right', 1134)),
    bottom: twToMm(m('w:bottom', 1134)),
    left: twToMm(m('w:left', 1134))
  };
  const short = Math.min(w, h);
  return {
    setup: {
      size: Math.abs(short - 8391) < 300 ? 'A5' : 'A4',
      orientation: w > h ? 'landscape' : 'portrait',
      margins,
      // الرأس جزءٌ من الورقة هنا — فلا ترويسة تُطبع فوقه.
      letterheadMode: 'none',
      repeatLetterhead: false,
      pageNumbers: false,
      numerals: 'arabic',
      watermark: null
    },
    widthTw: w - m('w:left', 1134) - m('w:right', 1134)
  };
}

// ── المستند ──────────────────────────────────────────────────────────

export type DocxResult = { doc: Doc; notes: string[] };

/**
 * يقرأ حزمة Word ويعيدها ورقةً واحدة بتنسيقها.
 *
 * والفراغات («.....» و«(   )» و«/ / 20») تبقى كما كتبها المكتب: تحويلها
 * متغيّرات قرارٌ يتّخذه هو بـF4 على الورقة، لا المحرّك في الخفاء.
 */
export function docxToDoc(files: Record<string, Uint8Array>, saveImage?: SaveImage): DocxResult {
  const main = files['word/document.xml'];
  if (!main) throw new Error('الملف ليس مستند Word صالحًا (لا يحتوي word/document.xml)');
  const body = find(parseXml(strFromU8(main)), 'w:body');
  if (!body) throw new Error('مستند Word بلا متن');

  const notes = new Set<string>();
  const rels = new Map<string, string>();
  const relsFile = files['word/_rels/document.xml.rels'];
  if (relsFile) {
    for (const r of kidsOf(find(parseXml(strFromU8(relsFile)), 'Relationships'), 'Relationship')) {
      if (r.attrs['Id'] && r.attrs['Target']) {
        rels.set(r.attrs['Id'], r.attrs['Target'].replace(/^\/?word\//, '').replace(/^\.\.\//, ''));
      }
    }
  }

  const settings = files['word/settings.xml'] ? parseXml(strFromU8(files['word/settings.xml'])) : undefined;
  const defaultTab = num(val(settings ? find(settings, 'w:defaultTabStop') : undefined)) ?? 720;

  const sect = kid(body, 'w:sectPr') ?? find(body, 'w:sectPr');
  const page = pageSetupFrom(sect);

  const ctx: Ctx = {
    styles: readStyles(files['word/styles.xml'] ? strFromU8(files['word/styles.xml']) : undefined),
    numbering: () => null,
    notes,
    rels,
    files,
    saveImage,
    defaultTab,
    contentWidthTw: page.widthTw,
    contentWidthPx: page.widthTw / TW_PER_PX
  };
  ctx.numbering = readNumbering(
    files['word/numbering.xml'] ? strFromU8(files['word/numbering.xml']) : undefined,
    notes
  );

  const blocks: Block[] = [];
  const walk = (n: XNode) => {
    for (const k of n.kids) {
      if (k.name === 'w:p') blocks.push(...convertParagraph(k, ctx));
      else if (k.name === 'w:tbl') blocks.push(convertTable(k, ctx));
      else if (k.name === 'w:sdt') walk(kid(k, 'w:sdtContent') ?? k);
    }
  };
  walk(body);

  const doc = emptyDoc();
  doc.pageSetup = page.setup;
  doc.blocks = blocks.length ? blocks : [paragraph([])];
  doc.fields = reconcileFields(doc);
  return { doc, notes: [...notes] };
}
