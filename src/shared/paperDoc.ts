/**
 * صورة الورقة ← كتاب (هـ٨): من كلمات القارئ المحلي بمواضعها إلى وثيقةٍ تُحرَّر.
 *
 * القارئ يعطي كلَّ كلمةٍ بصندوقها وثقتها. ومن المواضع وحدها يُبنى الكتاب:
 *
 * - **السطر قطعٌ**: فراغٌ أعرض من سطرين ونصف بين كلمتين يفصل ما على اليمين عمّا على
 *   اليسار — «جمهورية العراق … العدد:» سطرٌ واحدٌ عند القارئ وعمودان في الورقة.
 * - **الترويسة بالسياق**: ما فوق الخطّ الفاصل في أعلى الورقة، وإلا فالأسطر الأولى التي
 *   تشبه الرأس (جمهورية، وزارة، مديرية، العدد، التاريخ…) أو تقع على الجانبين. وتُبنى
 *   أعمدةً من مواضعها، و«العدد:» و«التاريخ:» فيها **حقلان** — أرقام الكتاب القديم لا
 *   تُنقل إلى نموذجٍ يُملأ.
 * - **المحاذاة من الهوامش**، والأسطر المتتالية التي تبلغ الهامش الأيسر فقرةٌ واحدة.
 * - **الجدول من خطوطه** (`paperRules`): كلُّ كلمةٍ في خانتها بموضعها.
 *
 * ولا يُطبَّق شيءٌ صامتًا (المبدأ ٥): **كلّ رقمٍ يُراجَع** — القارئ يخطئ في الأرقام
 * الهندية، ورقمٌ خاطئ في كتابٍ رسمي أسوأ من فراغ؛ والكلمة الضعيفة تُراجَع؛ والإملاء
 * اقتراح. وما لا يُشبه نصًّا (توقيعٌ بالحبر الأسود، أثرُ ختم) يُسقط **ويُعرض** فيُعاد
 * إن كان نصًّا.
 */
import { emptyDoc, fieldRef, newUuid, paragraph, reconcileFields, run, type Align, type Block, type Doc, type Inline, type ParagraphBlock, type TableBlock } from './doc';
import type { Box, TableGrid } from './paperRules';
import { spellingIssues, type SpellIssue } from './spelling';

export type OcrWord = { text: string; conf: number; box: Box };
export type OcrLine = { conf: number; box: Box; words: OcrWord[] };

export type PaperRead = {
  width: number;
  height: number;
  lines: OcrLine[];
  tables: TableGrid[];
  dividers: Box[];
  /** ما مُحي قبل القراءة من ختمٍ وتوقيعٍ ملوّن. */
  marks: Box[];
};

/** قطعةٌ من الورقة تُراجَع وتُحرَّر: سطرٌ أو جزؤه، أو خانة جدول. */
export type Piece = {
  id: string;
  text: string;
  box: Box;
  /** أضعف كلمةٍ فيها (٠..١٠٠). */
  conf: number;
  /** كلماتٌ ضعيفة تُعلَّم في المراجعة. */
  weak: string[];
  /** يُنقل إلى الكتاب؟ — وما أُسقط يُعرض فيُعاد. */
  keep: boolean;
  /** «العدد:» و«التاريخ:» في الترويسة: تصير حقلًا لا نصًّا. */
  field?: { label: string; key: string };
};

export type PlanItem =
  | { kind: 'head'; columns: string[][]; align: Align[]; widths: number[] }
  | { kind: 'para'; ids: string[]; align: Align; subject: boolean }
  | { kind: 'row'; ids: string[] }
  | { kind: 'table'; rows: string[][]; widths: number[] }
  | { kind: 'space'; lines: number };

export type ReviewReason = 'digits' | 'weak' | 'spelling' | 'dropped';
export type ReviewItem = { id: string; reasons: ReviewReason[]; spelling: SpellIssue[] };

export type PaperPlan = {
  pieces: Piece[];
  items: PlanItem[];
  review: ReviewItem[];
  notes: string[];
  title: string;
};

const HEAD_WORDS = /(جمهوري|وزار|مديري|المديري|دائر|الدائر|محافظ|رئاس|قسم|شعب|هيئ|جامع|كلي|مدرس|العدد|الرقم|التاريخ|republic|ministry|directorate)/i;
const SUBJECT = /^\s*(م\s*[/\\]|الموضوع\s*[:：/]?)/;
const FIELD_LINE: { re: RegExp; label: string; key: string }[] = [
  { re: /^\s*(العدد|الرقم|رقم الكتاب)\s*[:：/]?\s*/, label: 'العدد', key: 'العدد' },
  { re: /^\s*(التاريخ)\s*[:：/]?\s*/, label: 'التاريخ', key: 'التاريخ' }
];
const DIGITS = /[0-9٠-٩۰-۹]/;
const LETTERS = /[A-Za-zء-ي]/g;

const cx = (b: Box) => (b.x0 + b.x1) / 2;
const cy = (b: Box) => (b.y0 + b.y1) / 2;
const union = (boxes: Box[]): Box => ({
  x0: Math.min(...boxes.map((b) => b.x0)),
  y0: Math.min(...boxes.map((b) => b.y0)),
  x1: Math.max(...boxes.map((b) => b.x1)),
  y1: Math.max(...boxes.map((b) => b.y1))
});
const inside = (b: Box, area: Box, pad = 0) =>
  cx(b) >= area.x0 - pad && cx(b) <= area.x1 + pad && cy(b) >= area.y0 - pad && cy(b) <= area.y1 + pad;
const overlap = (a: Box, b: Box) => {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? (w * h) / Math.max(1, (a.x1 - a.x0) * (a.y1 - a.y0)) : 0;
};
function median(values: number[], fallback: number): number {
  if (!values.length) return fallback;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

/** علامات الاتجاه الخفيّة (LRM وRLM والتضمين والعزل) — تُبنى من أرقامها لتُقرأ في المصدر. */
const BIDI = new RegExp(
  `[${String.fromCharCode(0x200e, 0x200f)}${String.fromCharCode(0x202a)}-${String.fromCharCode(0x202e)}${String.fromCharCode(0x2066)}-${String.fromCharCode(0x2069)}]`,
  'g'
);

/** نصُّ كلماتٍ بترتيب القارئ — والكلمات منفصلةٌ عنده وإن ألصقها نصُّه. */
const joinWords = (words: OcrWord[]) =>
  words
    // علامات الاتجاه الخفيّة يضعها القارئ حول الكلمات — لا تُرى وتُفسد البحث والمقارنة.
    .map((w) => w.text.replace(BIDI, '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+([،؛:.؟!)])/g, '$1')
    .replace(/([(])\s+/g, '$1');

/**
 * كلمةٌ تُراجَع: ثقتها ضعيفة، أو حرفٌ لاتينيٌّ أو حرفان وسط العربية — «أ» في خانةٍ
 * صغيرة قُرئت «j» بثقة ٨٢٪، والثقة وحدها لا تكشفها.
 */
function suspicious(w: OcrWord): boolean {
  return w.conf < 65 || /^[A-Za-z]{1,2}$/.test(w.text.replace(BIDI, '').trim());
}

function piece(id: string, words: OcrWord[]): Piece {
  return {
    id,
    text: joinWords(words),
    box: union(words.map((w) => w.box)),
    conf: Math.round(Math.min(...words.map((w) => w.conf))),
    weak: words.filter(suspicious).map((w) => w.text.replace(BIDI, '').trim()).filter(Boolean),
    keep: true
  };
}

/** يقسم السطر حيث يتّسع الفراغ بين كلمتين — ما على الجانبين قطعتان. */
function splitLine(line: OcrLine, gap: number): OcrWord[][] {
  const out: OcrWord[][] = [];
  let cur: OcrWord[] = [];
  for (const w of line.words) {
    if (!w.text.trim()) continue;
    const prev = cur[cur.length - 1];
    if (prev && Math.max(prev.box.x0 - w.box.x1, w.box.x0 - prev.box.x1) > gap) {
      out.push(cur);
      cur = [];
    }
    cur.push(w);
  }
  if (cur.length) out.push(cur);
  return out;
}

/**
 * أيُشبه نصًّا؟ — التوقيع بالحبر الأسود يُقرأ رموزًا ضعيفة بلا كلمات.
 *
 * ويكفي النصَّ كلمةٌ واحدة قويّة: سطرٌ فيه كلمةٌ ضعيفة (رقمٌ هنديّ لم يُعرف) سطرٌ
 * يُراجَع لا أثرٌ يُسقط — وإلا سقط «العدد:» كلّه لأن رقمه قُرئ ضعيفًا.
 */
function looksLikeText(words: OcrWord[]): boolean {
  return words.some((w) => {
    const letters = (w.text.match(LETTERS) ?? []).length;
    return (letters >= 2 && w.conf >= 60) || (letters >= 1 && w.conf >= 85);
  });
}

export function planPaper(read: PaperRead): PaperPlan {
  const { width: W, height: H } = read;
  const lineH = median(
    read.lines.filter((l) => l.conf >= 50).map((l) => l.box.y1 - l.box.y0),
    H * 0.02
  );
  const pieces: Piece[] = [];
  const notes: string[] = [];

  // ── الجداول: كلُّ كلمةٍ في خانتها ────────────────────────────────
  const cellWords = read.tables.map((t) => t.rows.slice(1).map(() => t.cols.slice(1).map(() => [] as OcrWord[])));
  const loose: OcrWord[][] = [];
  for (const line of read.lines) {
    const rest: OcrWord[] = [];
    for (const w of line.words) {
      const ti = read.tables.findIndex((t) => inside(w.box, t.box, 2));
      if (ti < 0) {
        rest.push(w);
        continue;
      }
      const t = read.tables[ti]!;
      const r = t.rows.findIndex((y, i) => i + 1 < t.rows.length && cy(w.box) >= y && cy(w.box) < t.rows[i + 1]!);
      const c = t.cols.findIndex((x, i) => i + 1 < t.cols.length && cx(w.box) >= x && cx(w.box) < t.cols[i + 1]!);
      if (r >= 0 && c >= 0 && w.text.trim()) cellWords[ti]![r]![c]!.push(w);
    }
    if (rest.length) loose.push(...splitLine({ ...line, words: rest }, lineH * 2.5));
  }
  const tableItems: { y: number; item: PlanItem }[] = read.tables.map((t, ti) => {
    const nCols = t.cols.length - 1;
    // الجدول في كتابٍ عربي يُقرأ من اليمين: أوّل خانةٍ في الصفّ أقصاها يمينًا.
    const rows = cellWords[ti]!.map((row, r) =>
      Array.from({ length: nCols }, (_, k) => {
        const words = row[nCols - 1 - k]!;
        if (!words.length) return '';
        const p = piece(`t${ti}r${r}c${k}`, words);
        pieces.push(p);
        return p.id;
      })
    );
    const widths = Array.from({ length: nCols }, (_, k) => {
      const i = nCols - 1 - k;
      return Math.round(((t.cols[i + 1]! - t.cols[i]!) / (t.box.x1 - t.box.x0)) * 1000) / 1000;
    });
    notes.push(`جدولٌ ${t.rows.length - 1}×${nCols} من خطوطه`);
    return { y: t.box.y0, item: { kind: 'table', rows, widths } };
  });

  // ── القطع: ما سوى الجداول ─────────────────────────────────────────
  const loosePieces = loose.map((words, i) => {
    const p = piece(`p${i}`, words);
    // تحت ختمٍ مُحي: أثرُه لا نصّ — والكتابة السوداء التي عبرها تبقى لأن لها كلماتٍ قويّة.
    const underMark = read.marks.some((m) => overlap(p.box, m) > 0.5) && p.conf < 70;
    // و«العدد:» و«التاريخ:» و«م /» نصٌّ بتعريفه — عُرفت كلمتُها ولو ضعُفت ثقتها.
    const known = FIELD_LINE.some((f) => f.re.test(p.text)) || SUBJECT.test(p.text);
    p.keep = (looksLikeText(words) || known) && !underMark;
    return p;
  });
  pieces.push(...loosePieces);

  // صفوفٌ بالموضع: قطعٌ تتشارك الارتفاع نفسه — ممّا يُنقل وحده، فأثرٌ مُسقَطٌ بجانب
  // «مدير المدرسة» لا يجعله صفًّا بعمودين.
  const sorted = loosePieces.filter((p) => p.keep).sort((a, b) => cy(a.box) - cy(b.box));
  const rows: Piece[][] = [];
  for (const p of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(cy(p.box) - cy(union(last.map((q) => q.box)))) < lineH * 0.6) last.push(p);
    else rows.push([p]);
  }
  for (const r of rows) r.sort((a, b) => b.box.x1 - a.box.x1); // من اليمين

  // ── الترويسة ─────────────────────────────────────────────────────
  const firstTable = read.tables[0]?.box.y0 ?? Infinity;
  const divider = read.dividers.find((d) => d.y0 < H * 0.45 && d.x1 - d.x0 >= W * 0.5 && d.y0 < firstTable);
  let headRows: Piece[][] = [];
  if (divider && rows.some((r) => cy(r[0]!.box) < divider.y0)) {
    headRows = rows.filter((r) => cy(r[0]!.box) < divider.y0);
    notes.push('الترويسة: ما فوق الخطّ الفاصل');
  } else {
    for (const r of rows) {
      const text = r.map((p) => p.text).join(' ');
      if (cy(r[0]!.box) > H * 0.35 || SUBJECT.test(text)) break;
      if (r.length >= 2 || HEAD_WORDS.test(text)) headRows.push(r);
      else break;
    }
    if (headRows.length < 2) headRows = [];
    else notes.push('الترويسة: الأسطر الأولى بسياقها');
  }
  const headSet = new Set(headRows.flat());
  const items: { y: number; item: PlanItem }[] = [...tableItems];

  if (headRows.length) {
    const head = headRows.flat().filter((p) => p.keep);
    for (const p of head) {
      const f = FIELD_LINE.find((x) => x.re.test(p.text));
      if (f) p.field = { label: f.label, key: f.key };
    }
    if (head.some((p) => p.field)) notes.push('«العدد» و«التاريخ» في الترويسة صارا حقلين يُملآن');
    const side = (p: Piece) => (cx(p.box) >= W * 0.58 ? 0 : cx(p.box) <= W * 0.42 ? 2 : 1);
    const cols = [0, 1, 2]
      .map((s) => head.filter((p) => side(p) === s).sort((a, b) => a.box.y0 - b.box.y0))
      .map((ps, s) => ({ ids: ps.map((p) => p.id), s }))
      .filter((c) => c.ids.length);
    const weights = { 0: 0.42, 1: 0.2, 2: 0.38 } as const;
    const total = cols.reduce((a, c) => a + weights[c.s as 0 | 1 | 2], 0);
    items.push({
      y: Math.min(...headRows.flat().map((p) => p.box.y0)),
      item: {
        kind: 'head',
        columns: cols.map((c) => c.ids),
        // عمودٌ واحدٌ في الوسط رأسٌ متوسّط؛ وأعمدة الجانبين تبدأ من يمينها.
        align: cols.map((c) => (cols.length === 1 && c.s === 1 ? 'center' : c.s === 1 ? 'center' : 'right')),
        widths: cols.map((c) => Math.round((weights[c.s as 0 | 1 | 2] / total) * 1000) / 1000)
      }
    });
  }

  // ── المتن: المحاذاة من الهوامش، والفقرات من الأسطر ───────────────
  const body = rows.filter((r) => !r.some((p) => headSet.has(p)));
  const kept = body.flat().filter((p) => p.keep);
  const wide = kept.filter((p) => p.box.x1 - p.box.x0 > W * 0.5);
  const ref = wide.length ? wide : kept;
  const left = ref.length ? Math.min(...ref.map((p) => p.box.x0)) : 0;
  const right = ref.length ? Math.max(...ref.map((p) => p.box.x1)) : W;
  const span = Math.max(1, right - left);
  const alignOf = (b: Box): Align => {
    const gl = b.x0 - left;
    const gr = right - b.x1;
    if (gl < span * 0.06 && gr < span * 0.06) return 'justify';
    if (Math.abs(gl - gr) < span * 0.1 && gl > span * 0.12) return 'center';
    if (gr <= gl) return 'right';
    return 'left';
  };
  const reachesLeft = (b: Box) => b.x0 - left < span * 0.06;

  let prevBottom: number | null = headRows.length ? Math.max(...headRows.flat().map((p) => p.box.y1)) : null;
  let open: { item: Extract<PlanItem, { kind: 'para' }>; last: Box; y: number } | null = null;
  const flush = () => {
    if (open) items.push({ y: open.y, item: open.item });
    open = null;
  };
  const blocksBetween = (y0: number, y1: number) => tableItems.some((t) => t.y > y0 && t.y < y1);
  for (const r of body) {
    const box = union(r.map((p) => p.box));
    // فراغٌ عمودي واسع (فوق التوقيع مثلًا) يبقى فراغًا — سطرٌ لكلّ سطرين، وأربعةٌ أقصى.
    if (prevBottom !== null) {
      const gap = box.y0 - prevBottom;
      if (gap > lineH * 1.6 && !blocksBetween(prevBottom, box.y0)) {
        flush();
        items.push({ y: box.y0 - 1, item: { kind: 'space', lines: Math.min(4, Math.max(1, Math.round(gap / (lineH * 1.8)))) } });
      }
    }
    prevBottom = box.y1;
    if (r.length >= 2) {
      flush();
      items.push({ y: box.y0, item: { kind: 'row', ids: r.map((p) => p.id) } });
      continue;
    }
    const p = r[0]!;
    const subject = SUBJECT.test(p.text);
    const align = alignOf(p.box);
    const cont =
      open &&
      !subject &&
      !open.item.subject &&
      reachesLeft(open.last) &&
      (open.item.align === 'justify' || open.item.align === 'right') &&
      (align === 'justify' || align === 'right') &&
      p.box.y0 - open.last.y1 < lineH * 0.9 &&
      !blocksBetween(open.last.y1, p.box.y0);
    if (cont && open) {
      open.item.ids.push(p.id);
      open.item.align = 'justify';
      open.last = p.box;
      continue;
    }
    flush();
    open = { item: { kind: 'para', ids: [p.id], align, subject }, last: p.box, y: p.box.y0 };
  }
  flush();
  // وما أُسقط يبقى في موضعه فقرةً مستقلّة — لا تُكتب ما لم يُعِدها الموظف.
  for (const p of loosePieces) {
    if (!p.keep) items.push({ y: p.box.y0, item: { kind: 'para', ids: [p.id], align: alignOf(p.box), subject: false } });
  }
  items.sort((a, b) => a.y - b.y);

  // ── المراجعة ─────────────────────────────────────────────────────
  const review: ReviewItem[] = [];
  let digits = 0;
  for (const p of pieces) {
    const reasons: ReviewReason[] = [];
    if (!p.keep) reasons.push('dropped');
    else {
      if (!p.field && DIGITS.test(p.text)) {
        reasons.push('digits');
        digits++;
      }
      // سطر الحقل يُكتب عنوانُه وحده — فرقمُه الضعيف لا يُراجَع.
      if (p.weak.length && !p.field) reasons.push('weak');
    }
    const spelling = p.keep ? spellingIssues(p.text) : [];
    if (spelling.length) reasons.push('spelling');
    if (reasons.length) review.push({ id: p.id, reasons, spelling });
  }
  if (read.marks.length) notes.unshift(`أُهمل ${read.marks.length === 1 ? 'ختمٌ أو توقيعٌ ملوّن' : `${read.marks.length} أختامٍ وتواقيع ملوّنة`} — الكتاب يُوقَّع ويُختم من جديد`);
  if (digits) notes.push(`مواضع فيها أرقام: ${digits} — راجعها بالصورة، فالقارئ يخطئ في الأرقام`);
  const dropped = pieces.filter((p) => !p.keep).length;
  if (dropped) notes.push(`آثارٌ لا تشبه نصًّا لم تُنقل: ${dropped} (توقيعٌ أو ختم؟) — أعدها إن كانت نصًّا`);

  const subjectPiece = pieces.find((p) => p.keep && SUBJECT.test(p.text));
  const title = subjectPiece ? subjectPiece.text.replace(SUBJECT, '').trim() || 'كتابٌ من صورة' : 'كتابٌ من صورة';
  return { pieces, items: items.map((i) => i.item), review, notes, title };
}

export type PaperEdits = { texts?: Record<string, string>; keep?: Record<string, boolean> };

/** الكتاب من الخطّة — بما صحّحه الموظف وما أعاده. */
export function paperDoc(plan: PaperPlan, edits: PaperEdits = {}): Doc {
  const byId = new Map(plan.pieces.map((p) => [p.id, p]));
  const kept = (id: string) => {
    const p = byId.get(id);
    return Boolean(p && (edits.keep?.[id] ?? p.keep));
  };
  const textOf = (id: string) => (edits.texts?.[id] ?? byId.get(id)?.text ?? '').trim();
  const inlinesOf = (id: string, bold = false): Inline[] => {
    const p = byId.get(id)!;
    const text = textOf(id);
    if (p.field) {
      const f = FIELD_LINE.find((x) => x.key === p.field!.key)!;
      // ما بعد «العدد:» رقمُ الكتاب القديم — لا يُنقل، والحقل يُملأ لكلّ كتاب.
      if (f.re.test(text)) return [run(`${p.field.label}: `), fieldRef(p.field.key)];
    }
    return [run(text, bold ? { bold: true } : undefined)];
  };
  const para = (ids: string[], align: Align, bold = false): ParagraphBlock => {
    const live = ids.filter(kept);
    const inlines: Inline[] = [];
    live.forEach((id, i) => {
      if (i) inlines.push(run(' '));
      inlines.push(...inlinesOf(id, bold));
    });
    return paragraph(inlines, { align });
  };

  const blocks: Block[] = [];
  for (const it of plan.items) {
    if (it.kind === 'head') {
      const cols = it.columns.map((ids, c) => ids.filter(kept).map((id) => para([id], it.align[c] ?? 'right')));
      if (cols.length === 1) blocks.push(...cols[0]!);
      else blocks.push({ id: newUuid(), kind: 'columns', columns: cols, widths: it.widths, gap: 0 });
    } else if (it.kind === 'para') {
      if (it.ids.some(kept)) blocks.push(para(it.ids, it.align, it.subject));
    } else if (it.kind === 'row') {
      const live = it.ids.filter(kept);
      if (live.length === 1) blocks.push(para(live, 'right'));
      else if (live.length > 1) {
        blocks.push({
          id: newUuid(),
          kind: 'columns',
          columns: live.map((id, i) => [para([id], i === 0 ? 'right' : i === live.length - 1 ? 'left' : 'center')]),
          gap: 0
        });
      }
    } else if (it.kind === 'table') {
      const table: TableBlock = {
        id: newUuid(),
        kind: 'table',
        columns: it.widths,
        header: it.rows.length >= 3,
        rows: it.rows.map((row) => ({
          id: newUuid(),
          cells: row.map((id) => ({ id: newUuid(), blocks: [id && kept(id) ? para([id], 'center') : paragraph([run('')], { align: 'center' })] }))
        }))
      };
      blocks.push(table);
    } else {
      for (let i = 0; i < it.lines; i++) blocks.push(paragraph([run('')]));
    }
  }
  const doc = emptyDoc();
  doc.blocks = blocks;
  doc.fields = reconcileFields(doc, (key) => (key === 'التاريخ' ? { type: 'date', label: 'التاريخ' } : { label: key }));
  return doc;
}
