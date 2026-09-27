/**
 * محرّر الوثيقة — كتلًا، لا نصًّا واحدًا.
 *
 * **القرار المعماري:** `contentEditable` للكتلة الواحدة لا للمستند، والتحديد
 * عبر الكتل بمستوى الكتلة لا الحرف. يُسقط هذا تسعين بالمئة من تعقيد المحررات
 * — التحديد المتقاطع، والتراجع، واللصق — ويبقي إحساس Word.
 *
 * والحقل عقدةٌ لا نصّ: يُرسم صندوقًا غير قابل للتحرير، فلا يُكسر بنصف مسح.
 *
 * والتنسيق (العريض، التسطير، الحجم، المحاذاة، المسافة البادئة) يُكتب في
 * الوثيقة نفسها — `marks` للنصّ و`align`/`indent` للفقرة — فيخرج في الطباعة
 * كما رُئي، لأن محرّك الرسم واحد.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import {
  fieldRef,
  itemScore,
  newUuid,
  pageMm,
  paragraph,
  run,
  unfield,
  type Align,
  type Block,
  type Doc,
  type DocField,
  type ImageBlock,
  type Inline,
  type ListBlock,
  type ListItem,
  type Marks,
  type ParagraphBlock,
  type TableBlock
} from '@shared/doc';
import { marker, watermarkHtml } from '@shared/docHtml';
import { CALENDAR_LABEL, type Calendar } from '@shared/dates';
import { ADDRESSING_LABEL, rankByAddressing } from '@shared/addressing';
import type { Addressing } from '@shared/api';
import {
  addColumn,
  addRow,
  commit,
  fieldify,
  findParagraph,
  gridColumn,
  insertBlock,
  insertField,
  makeTable,
  mergeCells,
  mergeWithPrevious,
  patchBlock,
  patchField,
  removeBlock,
  removeColumn,
  removeRow,
  reorderFields,
  resizeColumn,
  setInlines,
  splitCell,
  splitParagraph,
  startHistory,
  redo,
  undo,
  type History,
  addBranch,
  addItem,
  patchItem,
  removeItem,
  setItemInlines
} from '@shared/docEdit';
import type { Seal } from '@shared/api';

export type DocEditorProps = {
  doc: Doc;
  onChange: (doc: Doc) => void;
  /** عبارات المكتب — تُدرج من قائمة `/`، وكليشات اتجاه الكتاب أولًا (`doc.meta.addressing`). */
  clips?: MenuClip[];
  /** يُرسم أعلى الورقة قبل الكتل — الترويسة عادةً — فيكتب المكتب على ورقةٍ حقيقية. */
  header?: ReactNode;
  /**
   * قيم الحقول — في محرّر الكتب: الحقل على الورقة يُظهر قيمته حيث كُتب، لا اسمه.
   * وفي مصمّم النماذج لا قيم، فيُظهر اسمه بين قوسين.
   */
  values?: Record<string, string>;
  /**
   * اللوح بجانب الورقة: `undefined` لوحُ تعريف الحقول (المصمّم)، و`null` لا لوح،
   * وغيرهما يُرسم مكانه (لوح القيم في المحرّر).
   */
  aside?: ReactNode | null;
  /** يُعطى الشاشةَ ما تفعله في موضع المؤشّر: حقلٌ أو نصٌّ يُدرج حيث وقف. */
  apiRef?: MutableRefObject<DocEditorApi | null>;
};

export type DocEditorApi = {
  /** حقلٌ موجود في الوثيقة يُدرج حيث وقف المؤشّر. */
  insertField: (key: string) => void;
  /** نصٌّ (رمزٌ أو عبارة) يُدرج حيث وقف المؤشّر. */
  insertText: (text: string) => void;
  /** حقلٌ جديد (من كتالوج المعاملات) يُعرَّف ويُدرج معًا حيث وقف المؤشّر — أو آخر الورقة. */
  insertNewField: (field: DocField) => void;
};

/** الأحجام المعروضة: من الهامش إلى العنوان — والقائمة الطويلة عبءٌ لا ميزة. */
const SIZES = [11, 12, 14, 16, 18, 20, 24, 28, 32];
/** حجم المتن حين لا يُذكر حجم — وهو حجم الورقة في المعاينة والإصدار. */
const BASE_SIZE = 14;
/** المسافة البادئة للكتاب الرسمي: ٢ سم في أوّل سطر المتن (الأساس §٤). */
const OFFICIAL_INDENT_MM = 20;

// ── تحويل الأجزاء ↔ العلامات ────────────────────────────────────────

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * الحقل صندوقٌ لا يُحرَّر: `contenteditable=false` يمنع كسره بنصف مسح.
 *
 * و`labelOf` يعيد ما يُكتب فيه: اسمه بين قوسين، أو قيمته إن مُلئ (`=` في أوّله
 * علامة القيمة) — فيُرى الكتاب في المحرّر كما سيُطبع، والحقل ما زال حقلًا.
 */
function inlinesToHtml(inlines: Inline[], labelOf: (key: string) => string): string {
  return (
    inlines
      .map((i) => {
        if (i.kind === 'break') return '<br/>';
        if (i.kind === 'run') {
          let out = esc(i.text);
          if (i.marks?.size)
            out = `<span data-size="${i.marks.size}" style="font-size:${i.marks.size}px">${out}</span>`;
          if (i.marks?.underline) out = `<u>${out}</u>`;
          if (i.marks?.bold) out = `<strong>${out}</strong>`;
          return out;
        }
        const shown = labelOf(i.ref);
        if (shown.startsWith('=')) {
          return (
            `<span contenteditable="false" data-field="${esc(i.ref)}" data-filled="" ` +
            `class="px-0.5 rounded bg-secondary-fixed/60 text-on-surface font-semibold">${esc(shown.slice(1))}</span>`
          );
        }
        return (
          `<span contenteditable="false" data-field="${esc(i.ref)}" ` +
          `class="px-1.5 py-0.5 mx-0.5 rounded-md bg-amber-500/15 text-amber-950 border border-amber-500/40 font-semibold font-label-sm text-label-sm shadow-xs">` +
          `[ ${esc(shown)} ]</span>`
        );
      })
      .join('') || ''
  );
}

/** لا تُحفظ علاماتٌ فارغة — `{ bold: false }` ضجيجٌ في الوثيقة لا معنى. */
function cleanMarks(m: Marks): Marks | undefined {
  const out: Marks = {};
  if (m.bold) out.bold = true;
  if (m.underline) out.underline = true;
  if (m.size) out.size = m.size;
  return Object.keys(out).length ? out : undefined;
}

/** عناصر كتلية داخل الكتلة: تأتي من لصقٍ أو من Enter قديم، وتُقرأ كسرَ سطر. */
const LINE_TAGS = new Set(['DIV', 'P', 'LI']);

/** يقرأ ما كتبه الموظف في الكتلة ويعيده أجزاءً — الحقول والتنسيق كما هما. */
function htmlToInlines(node: Node): Inline[] {
  const out: Inline[] = [];

  const walk = (el: Node, marks: Marks) => {
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent ?? '';
        if (text) out.push(run(text, cleanMarks(marks)));
        continue;
      }
      if (!(child instanceof HTMLElement)) continue;

      const key = child.dataset.field;
      if (key) {
        out.push(fieldRef(key));
        continue;
      }
      if (child.tagName === 'BR') {
        out.push({ kind: 'break' });
        continue;
      }
      // سطرٌ ملصوق في كتلة: لا يلتصق بما قبله فتندمج الجملتان.
      if (LINE_TAGS.has(child.tagName) && out.length && out[out.length - 1]!.kind !== 'break') {
        out.push({ kind: 'break' });
      }
      const tag = child.tagName;
      const weight = child.style.fontWeight;
      const px = child.dataset.size ? Number(child.dataset.size) : parseFloat(child.style.fontSize);
      walk(child, {
        ...marks,
        // إلغاء العريض داخل عريض يأتي `font-weight:normal` — فيُحترم لا يُبتلع.
        bold:
          weight === 'normal' || weight === '400'
            ? false
            : marks.bold || tag === 'B' || tag === 'STRONG' || weight === 'bold' || Number(weight) >= 600,
        underline: marks.underline || tag === 'U',
        ...(px > 0 ? { size: Math.round(px) } : {})
      });
    }
  };

  walk(node, {});
  return out;
}

/** أسطرٌ فارغة في الذيل: أثرُ `contentEditable` لا ما كتبه المكتب. */
function trimTrailingBreaks(inlines: Inline[]): Inline[] {
  let end = inlines.length;
  while (end > 0 && inlines[end - 1]!.kind === 'break') end--;
  return inlines.slice(0, end);
}

/**
 * موضع المؤشّر في نصّ الكتلة: الحقل وكسر السطر محرفٌ واحد.
 *
 * ويُعطى المدى صراحةً حين يكون التركيز قد غادر الورقة — زرٌّ في اللوح الجانبي
 * مثلًا — فيُحسب من آخر تحديدٍ فيها لا من تحديدٍ صار في مكانٍ آخر.
 */
function caretOffsets(
  host: HTMLElement,
  given?: Range | null
): { start: number; end: number } | null {
  let range = given ?? null;
  if (!range) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    range = sel.getRangeAt(0);
  }
  if (!host.contains(range.startContainer)) return null;

  const measure = (container: Node, offset: number): number => {
    const probe = document.createRange();
    probe.selectNodeContents(host);
    probe.setEnd(container, offset);
    const frag = probe.cloneContents();
    let n = 0;
    const count = (node: Node) => {
      for (const c of Array.from(node.childNodes)) {
        if (c.nodeType === Node.TEXT_NODE) n += (c.textContent ?? '').length;
        else if (c instanceof HTMLElement) {
          if (c.dataset.field || c.tagName === 'BR') n += 1;
          else count(c);
        }
      }
    };
    count(frag);
    return n;
  };

  return {
    start: measure(range.startContainer, range.startOffset),
    end: measure(range.endContainer, range.endOffset)
  };
}

/** يضع المؤشّر عند موضعٍ في نصّ الكتلة — عكسُ `caretOffsets`. */
function placeCaret(host: HTMLElement, offset: number) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  let left = offset;

  const walk = (node: Node): boolean => {
    for (const c of Array.from(node.childNodes)) {
      if (c.nodeType === Node.TEXT_NODE) {
        const len = (c.textContent ?? '').length;
        if (left <= len) {
          range.setStart(c, left);
          return true;
        }
        left -= len;
      } else if (c instanceof HTMLElement) {
        if (c.dataset.field || c.tagName === 'BR') {
          if (left === 0) {
            range.setStartBefore(c);
            return true;
          }
          left -= 1;
        } else if (walk(c)) return true;
      }
    }
    return false;
  };

  if (!walk(host)) {
    range.selectNodeContents(host);
    range.collapse(false);
  }
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

// ── الكتلة القابلة للتحرير ──────────────────────────────────────────

function EditableInlines({
  inlines,
  labelOf,
  onCommit,
  onFocus,
  className,
  placeholder,
  style,
  blockId,
  onEnter,
  onBackspaceAtStart
}: {
  inlines: Inline[];
  labelOf: (key: string) => string;
  onCommit: (inlines: Inline[], host: HTMLElement) => void;
  onFocus?: (host: HTMLElement) => void;
  className?: string;
  placeholder?: string;
  style?: React.CSSProperties;
  /** معرّف الفقرة — به تعرف أدوات التنسيق أيّ فقرةٍ تُحاذي. */
  blockId?: string;
  /** Enter: سطرٌ جديد. وبغيره يكون Enter كسرَ سطرٍ داخل الكتلة (خلية، سؤال). */
  onEnter?: (host: HTMLElement) => void;
  /** Backspace في أوّل الكتلة: يعيد `true` إن تولّاه. */
  onBackspaceAtStart?: (host: HTMLElement) => boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const html = useMemo(() => inlinesToHtml(inlines, labelOf), [inlines, labelOf]);

  // لا يُعاد الرسم أثناء الكتابة: إعادةُ العلامات تقفز بالمؤشّر إلى أوّل السطر.
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerHTML !== html) el.innerHTML = html;
  }, [html]);

  return (
    <div
      ref={ref}
      className={className}
      contentEditable
      data-block={blockId}
      data-placeholder={placeholder}
      dir="rtl"
      style={style}
      suppressContentEditableWarning
      onBlur={() => ref.current && onCommit(htmlToInlines(ref.current), ref.current)}
      onFocus={() => ref.current && onFocus?.(ref.current)}
      onInput={() => ref.current && onCommit(htmlToInlines(ref.current), ref.current)}
      onKeyDown={(e) => {
        const el = ref.current;
        if (!el || e.nativeEvent.isComposing) return;
        if (e.key === 'Enter') {
          // بلا هذا يُنشئ المتصفّح `<div>` داخل الكتلة، فتندمج الأسطر عند الحفظ.
          e.preventDefault();
          if (!e.shiftKey && onEnter) onEnter(el);
          else document.execCommand('insertLineBreak');
        } else if (e.key === 'Backspace' && onBackspaceAtStart) {
          const at = caretOffsets(el);
          if (at && at.start === 0 && at.end === 0 && onBackspaceAtStart(el)) e.preventDefault();
        }
      }}
    />
  );
}

// ── المحرّر ─────────────────────────────────────────────────────────

/**
 * السطر على الورقة: بلا حشوٍ عموديّ ولا فجوة — فما يُرى هو ما يُطبع، وخمسة
 * أسطرٍ فارغة في المحرّر هي خمسةٌ في الطباعة لا أطول. والحشو الأفقي يُستردّ
 * بهامشٍ سالب فلا يُزيح النصّ عن موضعه.
 */
const BLOCK_CLASS =
  'min-h-[1lh] -mx-2 px-2 rounded outline-none focus:bg-surface-container-low font-body-md text-body-md leading-8 text-on-surface whitespace-pre-wrap';

/** خليّة الجدول: حشوها حشوُ الطباعة نفسه (٢×٤ بكسل). */
const CELL_CLASS =
  'min-h-[1lh] px-1 py-0.5 outline-none focus:bg-surface-container-low font-body-md text-body-md leading-8 text-on-surface whitespace-pre-wrap';

/** نمط الفقرة على الورقة — هو ما يكتبه محرّك الطباعة لها، خاصيةً بخاصية. */
function paraStyle(b: ParagraphBlock): React.CSSProperties {
  return {
    textAlign: b.align,
    textIndent: b.indent ? `${b.indent}mm` : undefined,
    fontSize: b.size ? `${b.size}px` : undefined,
    lineHeight: b.lineHeight ?? undefined,
    marginBottom: b.spaceAfter ? `${b.spaceAfter}px` : undefined
  };
}

type Saved = { range: Range; host: HTMLElement };

export default function DocEditor({ doc, onChange, clips = [], header, values, aside, apiRef }: DocEditorProps) {
  const [history, setHistory] = useState<History>(() => startHistory(doc));
  const [active, setActive] = useState<string | null>(doc.blocks[0]?.id ?? null);
  const [menu, setMenu] = useState(false);
  const [sizeMenu, setSizeMenu] = useState(false);
  /** حال التحديد الجاري — لتعرض الأدوات ما هو مطبَّق فعلًا. */
  const [curSize, setCurSize] = useState<number | null>(null);
  const [curBlock, setCurBlock] = useState<string | null>(null);

  const paperRef = useRef<HTMLDivElement | null>(null);
  /**
   * آخر تحديدٍ داخل الورقة.
   *
   * أزرار التنسيق تمنع سرقة التركيز، لكن ما خارج الشريط (لوحة المتغيّرات) يسرقه.
   * فيُحفظ التحديد عند كل تغيّر، وتعمل الأدوات عليه لا على ما صار محدَّدًا الآن.
   */
  const saved = useRef<Saved | null>(null);
  /** كتلةٌ تنتظر التركيز بعد الرسم — سطرٌ جديدٌ بـEnter، أو سابقٌ بعد الدمج. */
  const pending = useRef<{ id: string; at: number } | null>(null);

  // الوثيقة تأتي من الخارج (فتحُ نموذج آخر) فيُبدأ تاريخٌ جديد.
  useEffect(() => {
    setHistory((h) => (h.present === doc ? h : startHistory(doc)));
  }, [doc]);

  const apply = useCallback(
    (next: Doc) => {
      if (next === history.present) return;
      setHistory((h) => commit(h, next));
      onChange(next);
    },
    [history.present, onChange]
  );

  const step = useCallback(
    (fn: (h: History) => History) => {
      setHistory((h) => {
        const next = fn(h);
        if (next !== h) onChange(next.present);
        return next;
      });
    },
    [onChange]
  );

  const labelOf = useCallback(
    (key: string) => {
      const value = values?.[key]?.trim();
      return value ? `=${value}` : doc.fields.find((f) => f.key === key)?.label || key;
    },
    [doc.fields, values]
  );

  const nextLabel = (d: Doc, key: string) => d.fields.find((f) => f.key === key)?.label || key;

  // التحديد يُتابَع في الورقة وحدها — وما خارجها لا يمسح ما حُفظ منها.
  useEffect(() => {
    const onSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const start = range.startContainer;
      const el = (start instanceof HTMLElement ? start : start.parentElement)?.closest<HTMLElement>(
        '[contenteditable="true"]'
      );
      if (!el || !paperRef.current?.contains(el)) return;
      saved.current = { range: range.cloneRange(), host: el };

      let size: number | null = null;
      for (let n: Node | null = start; n && n !== el; n = n.parentNode) {
        if (n instanceof HTMLElement && n.dataset.size) {
          size = Number(n.dataset.size);
          break;
        }
      }
      setCurSize(size);
      setCurBlock(el.dataset.block ?? null);
    };
    document.addEventListener('selectionchange', onSelection);
    return () => document.removeEventListener('selectionchange', onSelection);
  }, []);

  // سطرٌ جديد أو مدمَج: يُركَّز بعد أن يُرسم، والمؤشّر حيث يتوقّعه الكاتب.
  useEffect(() => {
    const p = pending.current;
    if (!p) return;
    const host = paperRef.current?.querySelector<HTMLElement>(`[data-block="${p.id}"]`);
    if (!host) return;
    pending.current = null;
    host.focus();
    placeCaret(host, p.at);
    setActive(p.id);
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // بالرمز لا بالحرف: `Ctrl+Z` في التخطيط العربي يصل `Ctrl+ء`.
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        step(undo);
      } else if (ctrl && (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey))) {
        e.preventDefault();
        step(redo);
      } else if (e.code === 'F4') {
        e.preventDefault();
        toField();
      } else if (ctrl && e.code === 'KeyB') {
        e.preventDefault();
        document.execCommand('bold');
      } else if (ctrl && e.code === 'KeyU') {
        e.preventDefault();
        document.execCommand('underline');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /**
   * F4: ما ظُلِّل يصير حقلًا باسمه.
   *
   * يُقرأ التظليل من آخر تحديدٍ في الورقة — التحديد بالفأرة لا يُطلق `input`،
   * فالاعتماد على آخر كتابةٍ كان يحوّل غير ما ظُلِّل.
   */
  function toField() {
    const s = saved.current;
    const id = s?.host.dataset.block;
    if (!s || !id || !s.host.isConnected) return;
    const at = caretOffsets(s.host, s.range);
    if (!at || at.end <= at.start) return;
    const base = setInlines(doc, id, htmlToInlines(s.host));
    const next = fieldify(base, id, at.start, at.end);
    if (next === base) return;
    // العلامات تُعاد رسمها: الحقل صندوقٌ جديد مكان النصّ.
    const block = next.blocks.find((b) => b.id === id) as ParagraphBlock | undefined;
    if (block) s.host.innerHTML = inlinesToHtml(block.inlines, (k) => nextLabel(next, k));
    apply(next);
  }

  /** حقلٌ قائم يُدرج حيث وقف المؤشّر آخر مرّة في الورقة. */
  function insertFieldAtCaret(key: string) {
    const s = saved.current;
    const id = s?.host.dataset.block;
    if (!s || !id || !s.host.isConnected) return;
    const at = caretOffsets(s.host, s.range);
    if (!at) return;
    const base = setInlines(doc, id, htmlToInlines(s.host));
    const next = insertField(base, id, at.start, key);
    if (next === base) return;
    const block = next.blocks.find((b) => b.id === id) as ParagraphBlock | undefined;
    if (block) s.host.innerHTML = inlinesToHtml(block.inlines, (k) => nextLabel(next, k));
    apply(next);
  }

  /** Enter: الفقرة تنشطر، وما بعد المؤشّر سطرٌ جديد يُركَّز. */
  function onEnter(blockId: string, host: HTMLElement) {
    const at = caretOffsets(host);
    if (!at) return;
    const base = setInlines(doc, blockId, htmlToInlines(host));
    const res = splitParagraph(base, blockId, at.start, at.end);
    if (!res) return;
    // الكتلة الجارية مركَّزة فلا تُعاد رسمًا — فتُكتب هنا وإلا حفظ الإفلاتُ نصّها كاملًا.
    const cur = res.doc.blocks.find((b) => b.id === blockId) as ParagraphBlock;
    host.innerHTML = inlinesToHtml(cur.inlines, (k) => nextLabel(res.doc, k));
    pending.current = { id: res.id, at: 0 };
    apply(res.doc);
  }

  /** Backspace في أوّل السطر: يلتحق بما قبله، وسطرٌ فارغ بعد جدولٍ يُحذف. */
  function onBackspaceAtStart(blockId: string, host: HTMLElement): boolean {
    const base = setInlines(doc, blockId, trimTrailingBreaks(htmlToInlines(host)));
    const res = mergeWithPrevious(base, blockId);
    if (res) {
      pending.current = { id: res.id, at: res.at };
      apply(res.doc);
      return true;
    }
    const idx = base.blocks.findIndex((b) => b.id === blockId);
    const cur = base.blocks[idx];
    if (idx > 0 && cur?.kind === 'paragraph' && cur.inlines.length === 0) {
      apply(removeBlock(base, blockId));
      return true;
    }
    return false;
  }

  /** يُدرج كتلًا بعد الكتلة الجارية بترتيبها، ويركّز ما يُطلب منها. */
  function insertBlocks(blocks: Block[], focus?: string) {
    let next = doc;
    let after = active;
    for (const b of blocks) {
      next = insertBlock(next, b, after);
      after = b.id;
    }
    if (focus) pending.current = { id: focus, at: Number.MAX_SAFE_INTEGER };
    // ما يُدرج بعدها يأتي بعد آخر ما أُدرج — جدولٌ ثم توقيعٌ لا توقيعٌ فوق الجدول.
    else if (after) setActive(after);
    apply(next);
    setMenu(false);
  }

  function insertClip(body: string) {
    insertBlocks(body.split('\n').map((line) => paragraph(line ? [run(line)] : [])));
  }

  /** نصٌّ حيث وقف المؤشّر — رمزٌ من لوحة الرموز، أو كلمةٌ من لوح جانبي. */
  function insertTextAtCaret(text: string) {
    const host = restore();
    if (!host) return;
    document.execCommand('insertText', false, text);
    apply(setInlines(doc, host.dataset.block ?? '', htmlToInlines(host)));
  }

  /**
   * حقلٌ جديد يُعرَّف ويُدرج في خطوةٍ واحدة — فالإدراج يرفض حقلًا لم يُعرَّف بعد.
   * وبلا موضع مؤشّرٍ محفوظ يُلحق بآخر سطرٍ في الورقة، ولا يضيع.
   */
  function insertNewFieldAtCaret(f: DocField) {
    // تعديل الفقرة يعيد بناء قائمة الحقول مما يُستعمل على الورقة (`reconciled`)، فيُسقط
    // حقلًا لم يُوضع بعد. فالترتيب: نصّ الفقرة أوّلًا، ثم يُعرَّف الحقل، ثم يُدرج.
    const define = (d: Doc): Doc => (d.fields.some((x) => x.key === f.key) ? d : { ...d, fields: [...d.fields, f] });
    const withField = define(doc);
    const s = saved.current;
    const id = s?.host.dataset.block;
    if (s && id && s.host.isConnected) {
      const at = caretOffsets(s.host, s.range);
      if (at) {
        const next = insertField(define(setInlines(doc, id, htmlToInlines(s.host))), id, at.start, f.key);
        const block = next.blocks.find((b) => b.id === id) as ParagraphBlock | undefined;
        if (block) s.host.innerHTML = inlinesToHtml(block.inlines, (k) => nextLabel(next, k));
        apply(next);
        return;
      }
    }
    const last = [...withField.blocks].reverse().find((b) => b.kind === 'paragraph') as ParagraphBlock | undefined;
    if (last) apply(setInlines(withField, last.id, [...last.inlines, run(' '), fieldRef(f.key)]));
    else apply(insertBlock(withField, paragraph([fieldRef(f.key)]), null));
  }

  if (apiRef) apiRef.current = { insertField: insertFieldAtCaret, insertText: insertTextAtCaret, insertNewField: insertNewFieldAtCaret };

  // ── أدوات التنسيق ─────────────────────────────────────────────────

  /** يعيد التحديد المحفوظ إلى الورقة قبل أن تعمل الأداة عليه. */
  function restore(): HTMLElement | null {
    const s = saved.current;
    if (!s || !s.host.isConnected) return null;
    s.host.focus();
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(s.range);
    return s.host;
  }

  function exec(command: 'bold' | 'underline') {
    if (restore()) document.execCommand(command);
  }

  /**
   * يلفّ ما ظُلِّل بحجم — أو الكتلة كلّها إن لم يُظلَّل شيء.
   *
   * لا `execCommand('fontSize')`: يكتب `<font size=1..7>` لا يُعرف له مقاس.
   * والحجم القديم داخل المظلَّل يُنزع أوّلًا، فلا تتداخل أحجامٌ متناقضة.
   */
  function applySize(size: number | null) {
    setSizeMenu(false);
    const host = restore();
    const sel = window.getSelection();
    if (!host || !sel || sel.rangeCount === 0) return;
    // حجم السطر نفسه لا يُكتب على مقاطعه — يكفيها أن ترثه.
    const base = (host.dataset.block && findParagraph(doc, host.dataset.block)?.size) || BASE_SIZE;
    let range = sel.getRangeAt(0);
    if (range.collapsed) {
      range = document.createRange();
      range.selectNodeContents(host);
    }
    const frag = range.extractContents();
    frag.querySelectorAll<HTMLElement>('[data-size]').forEach((s) => s.replaceWith(...Array.from(s.childNodes)));
    frag.querySelectorAll<HTMLElement>('span').forEach((s) => {
      if (!s.dataset.field && s.style.fontSize) s.style.fontSize = '';
    });

    let node: Node = frag;
    if (size && size !== base) {
      const span = document.createElement('span');
      span.dataset.size = String(size);
      span.style.fontSize = `${size}px`;
      span.appendChild(frag);
      node = span;
    }
    const first = node === frag ? frag.firstChild : node;
    const last = node === frag ? frag.lastChild : node;
    range.insertNode(node);

    if (first && last) {
      const again = document.createRange();
      again.setStartBefore(first);
      again.setEndAfter(last);
      sel.removeAllRanges();
      sel.addRange(again);
      saved.current = { range: again.cloneRange(), host };
    }
    host.dispatchEvent(new Event('input', { bubbles: true }));
    setCurSize(size && size !== base ? size : null);
  }

  /**
   * يمسح التنسيق عمّا ظُلِّل.
   *
   * لا `execCommand('removeFormat')`: قد يفكّ صناديق الحقول فتصير نصًّا
   * «[ الاسم ]» يُطبع حرفيًّا.
   */
  function clearFormat() {
    const host = restore();
    const sel = window.getSelection();
    if (!host || !sel || sel.rangeCount === 0) return;
    let range = sel.getRangeAt(0);
    if (range.collapsed) {
      range = document.createRange();
      range.selectNodeContents(host);
    }
    const frag = range.extractContents();
    frag
      .querySelectorAll<HTMLElement>('b, strong, u, i, em, [data-size]')
      .forEach((el) => el.replaceWith(...Array.from(el.childNodes)));
    frag.querySelectorAll<HTMLElement>('span').forEach((s) => {
      if (!s.dataset.field) s.removeAttribute('style');
    });
    range.insertNode(frag);
    host.dispatchEvent(new Event('input', { bubbles: true }));
    setCurSize(null);
  }

  // أينما وقف المؤشّر — في المتن أو عمود أو خليّة — فالمحاذاة والبادئة لفقرته.
  const curParagraph = (curBlock && findParagraph(doc, curBlock)) || undefined;

  /** مقاس الورقة بعد الاتجاه، بالملّم — من ضبطها لا ثابتًا. */
  const page = pageMm(doc.pageSetup);

  function setAlign(align: Align) {
    if (curParagraph) apply(patchBlock<ParagraphBlock>(doc, curParagraph.id, { align }));
  }

  function toggleIndent() {
    if (!curParagraph) return;
    apply(
      patchBlock<ParagraphBlock>(doc, curParagraph.id, {
        indent: curParagraph.indent ? undefined : OFFICIAL_INDENT_MM
      })
    );
  }

  return (
    <div className="flex gap-space-md h-full min-h-0">
      {/* الورقة */}
      <div className="flex-1 min-w-0 overflow-auto flex flex-col bg-surface-dim/40">
        <div className="sticky top-0 z-10 bg-surface-container-lowest px-space-sm py-1 flex items-center gap-0.5 flex-wrap border-b border-outline-variant/30">
          <button
            className="h-8 px-2.5 rounded-lg bg-primary-container text-on-primary font-label-sm text-label-sm font-bold flex items-center gap-1 hover:bg-secondary transition-all shadow-xs"
            type="button"
            data-act="insert"
            title="إدراج جدول أو صورة أو كليشة"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setMenu(true)}
          >
            <span className="material-symbols-outlined text-[16px]">post_add</span>
            <span>إدراج</span>
          </button>

          <ToolSep />
          <Tool act="bold" icon="format_bold" title="عريض (Ctrl+B)" onRun={() => exec('bold')} />
          <Tool act="underline" icon="format_underlined" title="تحته خطّ (Ctrl+U)" onRun={() => exec('underline')} />

          <div className="relative">
            <Tool
              act="size"
              icon="format_size"
              title="حجم الخطّ — لما ظُلِّل، أو للسطر كلّه"
              active={sizeMenu}
              onRun={() => setSizeMenu((v) => !v)}
            >
              <span className="tabular w-6 text-center">{Math.round(curSize ?? curParagraph?.size ?? BASE_SIZE)}</span>
            </Tool>
            {sizeMenu && (
              <div className="absolute top-9 right-0 z-20 w-44 p-1 rounded-xl bg-surface-container-lowest shadow-lg border border-outline-variant/50 grid grid-cols-3 gap-1">
                {SIZES.map((s) => (
                  <button
                    key={s}
                    className={`h-8 rounded-lg tabular font-label-md text-label-md ${
                      Math.round(curSize ?? curParagraph?.size ?? BASE_SIZE) === s
                        ? 'bg-primary-container text-on-primary font-bold'
                        : 'hover:bg-surface-container-high text-on-surface'
                    }`}
                    data-size-opt={s}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applySize(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <ToolSep />
          {(
            [
              { align: 'right', icon: 'format_align_right', title: 'محاذاة يمين' },
              { align: 'center', icon: 'format_align_center', title: 'توسيط' },
              { align: 'left', icon: 'format_align_left', title: 'محاذاة يسار' },
              { align: 'justify', icon: 'format_align_justify', title: 'ضبط الطرفين' }
            ] as const
          ).map((a) => (
            <Tool
              key={a.align}
              act={`align-${a.align}`}
              icon={a.icon}
              title={curParagraph ? a.title : `${a.title} — ضع المؤشّر في سطر`}
              active={curParagraph?.align === a.align}
              disabled={!curParagraph}
              onRun={() => setAlign(a.align)}
            />
          ))}
          <Tool
            act="indent"
            icon="format_indent_increase"
            title="مسافة بادئة ٢ سم لأوّل السطر — كما يُكتب متن الكتاب الرسمي"
            active={Boolean(curParagraph?.indent)}
            disabled={!curParagraph}
            onRun={toggleIndent}
          />

          <ToolSep />
          <Tool act="clear" icon="format_clear" title="مسح التنسيق" onRun={clearFormat} />
          <Tool act="field" icon="data_object" title="اجعل المظلَّل متغيّرًا (F4)" onRun={toField}>
            <span className="font-label-sm text-label-sm">متغيّر</span>
          </Tool>

          <span className="flex-1" />
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            ظلّل عبارة واضغط F4 لتصير متغيّرًا · Enter سطرٌ جديد
          </span>
        </div>

        {/* الورقة بمقاسها الحقيقي وهوامشها — فيلتفّ السطر حيث يلتفّ في الطباعة. */}
        <div
          ref={paperRef}
          className="relative isolate mx-auto mt-space-md shrink-0 bg-surface-container-lowest shadow-[0_1px_3px_rgba(24,33,29,0.06),0_16px_32px_-4px_rgba(24,33,29,0.10)] flex flex-col"
          style={{
            width: `${page.w}mm`,
            minHeight: `${page.h}mm`,
            paddingTop: `${doc.pageSetup.margins.top}mm`,
            paddingRight: `${doc.pageSetup.margins.right}mm`,
            paddingBottom: `${doc.pageSetup.margins.bottom}mm`,
            paddingLeft: `${doc.pageSetup.margins.left}mm`
          }}
          onMouseDown={() => setSizeMenu(false)}
        >
          {/* العلامة المائية خلف المتن — بمحرّك الرسم نفسه الذي يطبعها. */}
          <div className="contents" dangerouslySetInnerHTML={{ __html: watermarkHtml(doc) }} />
          {header}

          {doc.blocks.map((block) => (
            <div key={block.id} className="group/blk relative" onClick={() => setActive(block.id)}>
              {block.kind === 'paragraph' && (
                <EditableInlines
                  blockId={block.id}
                  className={BLOCK_CLASS}
                  inlines={block.inlines}
                  labelOf={labelOf}
                  placeholder="اكتب هنا، أو اضغط / للإدراج"
                  style={paraStyle(block)}
                  onBackspaceAtStart={(host) => onBackspaceAtStart(block.id, host)}
                  onCommit={(inlines) => {
                    // `/` في أوّل سطر فارغ تفتح قائمة الإدراج.
                    const text = inlines.map((i) => (i.kind === 'run' ? i.text : '')).join('');
                    if (text === '/') {
                      setMenu(true);
                      return;
                    }
                    apply(setInlines(doc, block.id, inlines));
                  }}
                  onEnter={(host) => onEnter(block.id, host)}
                  onFocus={() => setActive(block.id)}
                />
              )}

              {block.kind === 'table' && (
                <TableEditor
                  block={block}
                  doc={doc}
                  labelOf={labelOf}
                  onChange={apply}
                  onRemove={() => apply(removeBlock(doc, block.id))}
                />
              )}

              {block.kind === 'image' && (
                <ImageEditor
                  block={block}
                  onPatch={(patch) => apply(patchBlock<ImageBlock>(doc, block.id, patch))}
                  onRemove={() => apply(removeBlock(doc, block.id))}
                />
              )}

              {block.kind === 'list' && (
                <ListEditor block={block} doc={doc} labelOf={labelOf} onChange={apply} />
              )}

              {block.kind === 'columns' && (
                // الأعمدة بأوزانها وفجوتها كما تُطبع — وحدودها خطٌّ لا يأخذ مكانًا.
                <div className="flex" style={{ gap: block.gap ?? 16 }}>
                  {block.columns.map((col, ci) => (
                    <div
                      key={ci}
                      className="min-w-0 hover:outline-dashed hover:outline-1 hover:outline-outline-variant"
                      style={{ flex: `${block.widths?.[ci] ?? 1} 1 0` }}
                    >
                      {col.map((b) =>
                        b.kind === 'paragraph' ? (
                          <EditableInlines
                            key={b.id}
                            blockId={b.id}
                            className={BLOCK_CLASS}
                            inlines={b.inlines}
                            labelOf={labelOf}
                            style={paraStyle(b)}
                            onCommit={(inlines) => apply(setInlines(doc, b.id, inlines))}
                          />
                        ) : null
                      )}
                    </div>
                  ))}
                </div>
              )}

              {block.kind === 'spacer' && (
                <div
                  className="rounded border border-dashed border-outline-variant flex items-center justify-center gap-space-sm font-label-sm text-label-sm text-on-surface-variant"
                  style={{ height: Math.max(28, block.height) }}
                >
                  <span>{block.lines ? 'مساحة إجابة' : 'مسافة'} {block.height}px</span>
                  <button
                    className="h-6 px-2 rounded bg-surface-container-low hover:bg-surface-container-high"
                    type="button"
                    onClick={() =>
                      apply(patchBlock<typeof block>(doc, block.id, { lines: !block.lines }))
                    }
                  >
                    {block.lines ? 'بلا سطور' : 'بسطور'}
                  </button>
                </div>
              )}

              {block.kind === 'pageBreak' && (
                <div className="my-space-xs border-t-2 border-dashed border-secondary text-center">
                  <span className="px-2 -mt-2 inline-block bg-surface-container-lowest font-label-sm text-label-sm text-secondary">
                    فاصل صفحة
                  </span>
                </div>
              )}

              {/* ما لا يُكتب فيه لا يُمسح بـBackspace — فحذفه زرٌّ صريح. */}
              {(block.kind === 'spacer' ||
                block.kind === 'pageBreak' ||
                block.kind === 'columns' ||
                block.kind === 'list') && (
                <button
                  className="absolute -left-9 top-0 w-7 h-7 rounded-lg text-error hover:bg-error-container opacity-0 group-hover/blk:opacity-100 transition-opacity flex items-center justify-center"
                  title="حذف هذه الكتلة"
                  type="button"
                  onClick={() => apply(removeBlock(doc, block.id))}
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                </button>
              )}
            </div>
          ))}

        </div>

        {/* خارج الورقة: زرٌّ لا يُطبع لا يأخذ من ارتفاعها. */}
        <button
          className="mx-auto my-space-md h-8 px-3 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm shadow-xs"
          type="button"
          onClick={() => {
            // السطر الجديد في آخر الورقة، لا بعد السطر الجاري في وسطها.
            const line = paragraph([]);
            pending.current = { id: line.id, at: 0 };
            apply(insertBlock(doc, line, doc.blocks[doc.blocks.length - 1]?.id ?? null));
          }}
        >
          + سطر في آخر الورقة
        </button>
      </div>

      {/* المتغيّرات الموضوعة على الورقة نفسها — أو لوح الشاشة مكانها */}
      {aside === undefined ? <FieldPanel doc={doc} onChange={apply} onInsert={insertFieldAtCaret} /> : aside}

      {menu && (
        <InsertMenu
          addressing={doc.meta.addressing ?? null}
          clips={clips}
          onClose={() => setMenu(false)}
          onClip={insertClip}
          onTable={(rows, cols) => insertBlocks([makeTable(rows, cols)])}
          onImage={(src, align) =>
            insertBlocks([{ id: newUuid(), kind: 'image', src, width: 140, align }])
          }
          onPick={(what) => {
            if (what === 'copies') {
              const first = paragraph([run('- ')]);
              insertBlocks(
                [
                  paragraph([run('نسخة منه إلى :-', { bold: true, underline: true })]),
                  first,
                  paragraph([run('- ')])
                ],
                first.id
              );
            } else if (what === 'columns')
              insertBlocks([
                { id: newUuid(), kind: 'columns', columns: [[paragraph([])], [paragraph([])]] }
              ]);
            else if (what === 'answer')
              insertBlocks([{ id: newUuid(), kind: 'spacer', height: 112, lines: true }]);
            else if (what === 'spacer') insertBlocks([{ id: newUuid(), kind: 'spacer', height: 24 }]);
            else if (what === 'pageBreak') insertBlocks([{ id: newUuid(), kind: 'pageBreak' }]);
          }}
        />
      )}
    </div>
  );
}

/** زرّ أداة: لا يسرق التحديد من الورقة، وإلا ضاع ما ظلّله الكاتب قبل أن يُنسَّق. */
function Tool({
  act,
  icon,
  title,
  active,
  disabled,
  onRun,
  children
}: {
  act: string;
  icon: string;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onRun: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      className={`h-8 min-w-[2rem] px-1.5 rounded-lg flex items-center justify-center gap-0.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        active ? 'bg-secondary-fixed text-secondary' : 'text-on-surface hover:bg-surface-container-high'
      }`}
      data-act={act}
      disabled={disabled}
      title={title}
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onRun}
    >
      <span className="material-symbols-outlined text-[19px]">{icon}</span>
      {children}
    </button>
  );
}

function ToolSep() {
  return <span className="w-px h-5 bg-outline-variant/60 mx-1" />;
}

type Preset = 'copies' | 'columns' | 'answer' | 'spacer' | 'pageBreak';

/**
 * قائمة الإدراج: ما يحتاجه الكتاب الرسمي بضغطة — بلا أشرطة أدوات.
 *
 * ولا توقيع فيها ولا ختم: المكتب يستنسخ ويطبع، والجهة توقّع وتختم بيدها بعد
 * الطباعة. فالصور شعاراتٌ تُطبع مع الورقة، لا أختامٌ تُزوَّر عليها.
 */
type MenuClip = { id: number; title: string; body: string; direction?: Addressing | null };

function InsertMenu({
  addressing,
  clips,
  onPick,
  onTable,
  onImage,
  onClip,
  onClose
}: {
  addressing: Addressing | null;
  clips: MenuClip[];
  onPick: (what: Preset) => void;
  onTable: (rows: number, cols: number) => void;
  onImage: (src: string, align: Align) => void;
  onClip: (body: string) => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<'main' | 'table' | 'image'>('main');
  const [query, setQuery] = useState('');
  const [hover, setHover] = useState({ r: 3, c: 3 });
  const [seals, setSeals] = useState<Seal[]>([]);
  // كليشات اتجاه الكتاب أولًا — «يرجى» لجهةٍ أعلى و«تنسب» لأدنى — ولا يُخفى غيرها.
  const shown = rankByAddressing(
    clips.map((c) => ({ ...c, direction: c.direction ?? null })),
    addressing
  ).filter((c) => !query.trim() || c.title.includes(query.trim()) || c.body.includes(query.trim()));

  // الشعارات وحدها: الختم والتوقيع يوضعان باليد على الورقة المطبوعة.
  useEffect(() => {
    if (view === 'image')
      void window.diwan.seals.list().then((all) => setSeals(all.filter((s) => s.kind === 'شعار' && s.imagePath)));
  }, [view]);

  async function fromDevice() {
    const src = await window.diwan.files.pickImage('images');
    if (src) onImage(src, 'center');
  }

  const back = (
    <button
      className="self-start h-8 px-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-sm text-label-sm flex items-center gap-1"
      type="button"
      onClick={() => setView('main')}
    >
      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
      رجوع
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-28 bg-scrim/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-surface-container-lowest shadow-2xl p-space-sm flex flex-col gap-space-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {view === 'main' && (
          <>
            <input
              autoFocus
              className="h-10 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary"
              placeholder="ابحث عن كليشة، أو اختر ما تُدرج"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-1">
              <MenuItem act="ins-table" icon="table" label="جدول" onClick={() => setView('table')} />
              <MenuItem act="ins-image" icon="image" label="صورة أو شعار" onClick={() => setView('image')} />
              <MenuItem act="ins-copies" icon="forward_to_inbox" label="نسخة منه إلى" onClick={() => onPick('copies')} />
              <MenuItem act="ins-columns" icon="view_column" label="عمودان" onClick={() => onPick('columns')} />
              <MenuItem act="ins-answer" icon="edit_note" label="مساحة كتابة" onClick={() => onPick('answer')} />
              <MenuItem act="ins-spacer" icon="height" label="مسافة" onClick={() => onPick('spacer')} />
              <MenuItem act="ins-break" icon="insert_page_break" label="فاصل صفحة" wide onClick={() => onPick('pageBreak')} />
            </div>

            {clips.length > 0 && (
              <div className="max-h-56 overflow-y-auto flex flex-col gap-1 pt-space-xs">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  كليشات المكتب{addressing ? ` — ما يُكتب ${ADDRESSING_LABEL[addressing]} أولًا` : ''}
                </span>
                {shown.length === 0 ? (
                  <span className="font-label-sm text-label-sm text-on-surface-variant py-space-sm text-center">
                    لا كليشة بهذا الاسم
                  </span>
                ) : (
                  shown.map((c) => (
                    <button
                      key={c.id}
                      className="text-right p-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container-high flex flex-col gap-0.5"
                      data-clip-direction={c.direction ?? ''}
                      type="button"
                      onClick={() => onClip(c.body)}
                    >
                      <span className="font-label-md text-label-md text-on-surface flex items-center gap-1">
                        {c.title}
                        {c.direction && (
                          <span
                            className={`font-label-sm text-label-sm px-1.5 rounded-full ${
                              c.direction === addressing ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-surface-container-high text-on-surface-variant'
                            }`}
                          >
                            {ADDRESSING_LABEL[c.direction]}
                          </span>
                        )}
                      </span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
                        {c.body.split('\n')[0]}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </>
        )}

        {view === 'table' && (
          <>
            {back}
            <span className="font-label-md text-label-md text-on-surface text-center tabular">
              جدول {hover.r} صفوف × {hover.c} أعمدة
            </span>
            {/* تُختار المقاسات بالمرور كما في Word — ضغطةٌ واحدة لا خانتا أرقام. */}
            <div className="mx-auto grid grid-cols-8 gap-1" dir="rtl">
              {Array.from({ length: 8 }, (_, r) =>
                Array.from({ length: 8 }, (_, c) => (
                  <button
                    key={`${r}-${c}`}
                    aria-label={`${r + 1} × ${c + 1}`}
                    className={`w-6 h-6 rounded border transition-colors ${
                      r < hover.r && c < hover.c
                        ? 'bg-secondary-fixed border-secondary'
                        : 'bg-surface-container-low border-outline-variant'
                    }`}
                    data-grid={`${r + 1}-${c + 1}`}
                    type="button"
                    onClick={() => onTable(r + 1, c + 1)}
                    onMouseEnter={() => setHover({ r: r + 1, c: c + 1 })}
                  />
                ))
              )}
            </div>
          </>
        )}

        {view === 'image' && (
          <>
            {back}
            {seals.length === 0 ? (
              <span className="font-label-sm text-label-sm text-on-surface-variant text-center py-space-sm">
                لا شعار محفوظ — ارفعه من «الترويسات والشعارات»، أو أدرج صورةً من الجهاز.
              </span>
            ) : (
              <div className="grid grid-cols-3 gap-1 max-h-64 overflow-y-auto">
                {seals.map((s) => (
                    <button
                      key={s.id}
                      className="p-1 rounded-lg bg-surface-container-low hover:bg-surface-container-high flex flex-col items-center gap-1"
                      type="button"
                      onClick={() => onImage(s.imagePath!, 'center')}
                    >
                      <img alt="" className="w-16 h-16 object-contain" src={`diwan://store/${s.imagePath}`} />
                      <span className="font-label-sm text-label-sm text-on-surface truncate w-full text-center">
                        {s.name}
                      </span>
                    </button>
                  ))}
              </div>
            )}
            <button
              className="h-9 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center justify-center gap-1"
              type="button"
              onClick={() => void fromDevice()}
            >
              <span className="material-symbols-outlined text-[18px] text-secondary">image</span>
              صورة من الجهاز…
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function MenuItem({
  act,
  icon,
  label,
  wide,
  onClick
}: {
  act: string;
  icon: string;
  label: string;
  /** يملأ الصفّ — فلا يبقى زرٌّ وحده في نصفه. */
  wide?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`h-10 px-3 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-2 ${wide ? 'col-span-2' : ''}`}
      data-act={act}
      type="button"
      onClick={onClick}
    >
      <span className="material-symbols-outlined text-[18px] text-secondary">{icon}</span>
      {label}
    </button>
  );
}

/** الصورة والشعار: حجمٌ ومحاذاة وحذف — ولا تحرير صور (ما لن نبنيه). */
function ImageEditor({
  block,
  onPatch,
  onRemove
}: {
  block: ImageBlock;
  onPatch: (patch: Partial<ImageBlock>) => void;
  onRemove: () => void;
}) {
  // الارتفاع الصريح يتبع العرض بنسبته — فالخطّ الفاصل يطول ولا يتضخّم.
  const width = (w: number) => {
    const next = Math.min(800, Math.max(20, w));
    onPatch({
      width: next,
      ...(block.height ? { height: Math.max(1, Math.round((block.height * next) / block.width)) } : {})
    });
  };
  return (
    <div className="group/img relative" style={{ textAlign: block.align === 'justify' ? 'center' : block.align }}>
      <img
        alt=""
        src={block.src ? `diwan://store/${block.src}` : undefined}
        style={{
          display: 'inline-block',
          width: block.width,
          height: block.height ?? undefined,
          maxWidth: '100%'
        }}
      />
      <div className="absolute top-1 right-1 hidden group-hover/img:flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-container-lowest shadow border border-outline-variant/50">
        <IconBtn icon="remove" title="أصغر" onClick={() => width(block.width - 20)} />
        <span className="font-label-sm text-label-sm tabular px-1">{block.width}</span>
        <IconBtn icon="add" title="أكبر" onClick={() => width(block.width + 20)} />
        <IconBtn icon="format_align_right" title="يمين" onClick={() => onPatch({ align: 'right' })} />
        <IconBtn icon="format_align_center" title="وسط" onClick={() => onPatch({ align: 'center' })} />
        <IconBtn icon="format_align_left" title="يسار" onClick={() => onPatch({ align: 'left' })} />
        <IconBtn icon="delete" title="حذف" danger onClick={onRemove} />
      </div>
    </div>
  );
}

function IconBtn({
  icon,
  title,
  danger,
  onClick
}: {
  icon: string;
  title: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`w-7 h-7 rounded flex items-center justify-center ${
        danger ? 'text-error hover:bg-error-container' : 'text-on-surface-variant hover:bg-surface-container-high'
      }`}
      title={title}
      type="button"
      onClick={onClick}
    >
      <span className="material-symbols-outlined text-[16px]">{icon}</span>
    </button>
  );
}

/** لوحة الحقول: ترتيبها هو ترتيب شاشة الإدخال في الشبّاك. */
function FieldPanel({
  doc,
  onChange,
  onInsert
}: {
  doc: Doc;
  onChange: (doc: Doc) => void;
  onInsert: (key: string) => void;
}) {
  const move = (key: string, dir: -1 | 1) => {
    const keys = doc.fields.map((f) => f.key);
    const at = keys.indexOf(key);
    const to = at + dir;
    if (at < 0 || to < 0 || to >= keys.length) return;
    [keys[at], keys[to]] = [keys[to]!, keys[at]!];
    onChange(reorderFields(doc, keys));
  };

  return (
    <div className="w-72 shrink-0 overflow-y-auto border-r border-outline-variant p-space-sm flex flex-col gap-space-xs">
      <span className="font-label-md text-label-md text-on-surface font-semibold">
        المتغيّرات على الورقة ({doc.fields.length})
      </span>
      <span className="font-label-sm text-label-sm text-on-surface-variant">
        أضفها بتظليل العبارة في الورقة ثم الضغط على F4.
      </span>

      {doc.fields.length === 0 ? (
        <span className="py-space-md text-center font-label-sm text-label-sm text-on-surface-variant">
          ظلّل كلمةً واضغط F4 لتصير حقلًا
        </span>
      ) : (
        doc.fields.map((f) => <FieldRow key={f.key} field={f} doc={doc} onChange={onChange} onInsert={onInsert} onMove={move} />)
      )}
    </div>
  );
}

function FieldRow({
  field,
  doc,
  onChange,
  onInsert,
  onMove
}: {
  field: DocField;
  doc: Doc;
  onChange: (doc: Doc) => void;
  onInsert: (key: string) => void;
  onMove: (key: string, dir: -1 | 1) => void;
}) {
  return (
    <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          className="flex-1 min-w-0 h-8 px-2 rounded bg-surface-container-lowest text-on-surface font-label-md text-label-md focus:outline-none focus:ring-1 focus:ring-secondary"
          type="text"
          value={field.label}
          onChange={(e) => onChange(patchField(doc, field.key, { label: e.target.value }))}
        />
        <button
          className="w-6 h-6 rounded text-on-surface-variant hover:bg-surface-container-high"
          title="أعلى"
          type="button"
          onClick={() => onMove(field.key, -1)}
        >
          <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
        </button>
        <button
          className="w-6 h-6 rounded text-on-surface-variant hover:bg-surface-container-high"
          title="أسفل"
          type="button"
          onClick={() => onMove(field.key, 1)}
        >
          <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
        </button>
      </div>
      <div className="flex items-center gap-space-xs">
        <label className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
          <input
            className="w-3.5 h-3.5 accent-secondary"
            checked={field.required}
            type="checkbox"
            onChange={(e) => onChange(patchField(doc, field.key, { required: e.target.checked }))}
          />
          إلزامي
        </label>
        <label className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
          عرضه
          <input
            className="w-12 h-7 px-1 rounded bg-surface-container-lowest text-on-surface text-center"
            min={3}
            type="number"
            value={field.width}
            onChange={(e) =>
              onChange(patchField(doc, field.key, { width: Math.max(3, Number(e.target.value) || 6) }))
            }
          />
        </label>
        <span className="flex-1" />
        <button
          className="w-6 h-6 rounded text-secondary hover:bg-surface-container-high"
          title="أدرجه حيث وقف المؤشّر في الورقة"
          type="button"
          onClick={() => onInsert(field.key)}
        >
          <span className="material-symbols-outlined text-[14px]">add</span>
        </button>
        <button
          className="w-6 h-6 rounded text-error hover:bg-error-container"
          title="ليس حقلًا — أعِده نقاطًا"
          type="button"
          onClick={() => onChange(unfield(doc, field.key))}
        >
          <span className="material-symbols-outlined text-[14px]">backspace</span>
        </button>
      </div>
      {/* النوع: التاريخ بتقويمه يُكتب «اليوم» أو من التقويم في الشبّاك والمحرّر. */}
      <label className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
        نوعه
        <select
          className="flex-1 h-7 px-1 rounded bg-surface-container-lowest text-on-surface cursor-pointer"
          data-field-kind={field.key}
          value={field.type === 'date' ? `date:${field.calendar ?? 'gregorian'}` : field.type === 'text' ? 'text' : 'other'}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'other') return;
            onChange(
              patchField(doc, field.key, v.startsWith('date:') ? { type: 'date', calendar: v.slice(5) as Calendar } : { type: 'text', calendar: undefined })
            );
          }}
        >
          <option value="text">نصّ</option>
          {(Object.keys(CALENDAR_LABEL) as Calendar[]).map((c) => (
            <option key={c} value={`date:${c}`}>
              تاريخ {CALENDAR_LABEL[c]}
            </option>
          ))}
          {field.type !== 'text' && field.type !== 'date' && (
            <option disabled value="other">
              كما هو
            </option>
          )}
        </select>
      </label>
    </div>
  );
}

/**
 * محرّر الأسئلة: عناصرُ ترقيم بفروعها ودرجاتها.
 *
 * لم يعد يُدرج من هنا — للأسئلة شاشتُها — لكن ما حُفظ قديمًا يُفتح ويُحرَّر.
 * والعلامة تُحسب ولا تُكتب — فحذف سؤال يعيد ترقيم ما بعده وحده.
 */
function ListEditor({
  block,
  doc,
  labelOf,
  onChange,
  depth = 0,
  items
}: {
  block: ListBlock;
  doc: Doc;
  labelOf: (key: string) => string;
  onChange: (doc: Doc) => void;
  depth?: number;
  items?: ListItem[];
}) {
  const list = items ?? block.items;
  const style = block.styles[Math.min(depth, block.styles.length - 1)] ?? 'bullet';

  return (
    <div style={{ paddingInlineStart: depth === 0 ? 0 : 18 }}>
      {list.map((it, i) => (
        <div key={it.id} className="group/item flex flex-col gap-0.5">
          <div className="flex items-start gap-1">
            <span className="shrink-0 mt-1 font-label-md text-label-md font-bold text-secondary">
              {marker(style, i, doc.pageSetup.numerals)}
            </span>
            <EditableInlines
              className={`${BLOCK_CLASS} flex-1 min-w-0`}
              inlines={it.inlines}
              labelOf={labelOf}
              placeholder="نصّ السؤال"
              onCommit={(inlines) => onChange(setItemInlines(doc, block.id, it.id, inlines))}
            />
            <input
              className="w-14 h-8 px-1 shrink-0 rounded bg-surface-container-lowest text-on-surface text-center font-label-sm text-label-sm"
              placeholder="درجة"
              title="درجة السؤال"
              type="number"
              value={it.score ?? ''}
              onChange={(e) =>
                onChange(
                  patchItem(doc, block.id, it.id, {
                    score: e.target.value === '' ? undefined : Number(e.target.value)
                  })
                )
              }
            />
            <input
              className="w-12 h-8 px-1 shrink-0 rounded bg-surface-container-lowest text-on-surface text-center font-label-sm text-label-sm"
              placeholder="أجب"
              title="أجب عن ن من فروعه فقط"
              type="number"
              value={it.pick ?? ''}
              onChange={(e) =>
                onChange(
                  patchItem(doc, block.id, it.id, {
                    pick: e.target.value === '' ? undefined : Number(e.target.value)
                  })
                )
              }
            />
            <button
              className="w-7 h-7 shrink-0 rounded text-on-surface-variant hover:bg-surface-container-high opacity-0 group-hover/item:opacity-100"
              title="أضف فرعًا"
              type="button"
              onClick={() => onChange(addBranch(doc, block.id, it.id))}
            >
              <span className="material-symbols-outlined text-[14px]">subdirectory_arrow_left</span>
            </button>
            <button
              className="w-7 h-7 shrink-0 rounded text-error hover:bg-error-container opacity-0 group-hover/item:opacity-100"
              title="حذف"
              type="button"
              onClick={() => onChange(removeItem(doc, block.id, it.id))}
            >
              <span className="material-symbols-outlined text-[14px]">delete</span>
            </button>
          </div>

          {it.items?.length ? (
            <ListEditor
              block={block}
              depth={depth + 1}
              doc={doc}
              items={it.items}
              labelOf={labelOf}
              onChange={onChange}
            />
          ) : null}
        </div>
      ))}

      {depth === 0 && (
        <div className="flex items-center gap-space-xs mt-1">
          <button
            className="h-7 px-2 rounded bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm"
            type="button"
            onClick={() => onChange(addItem(doc, block.id))}
          >
            + سؤال
          </button>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            مجموعها {block.items.reduce((n, it) => n + itemScore(it), 0)}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * الجدول: خلاياه فقراتٌ تُحرَّر كغيرها، وتُنسَّق بأدوات الشريط نفسها.
 *
 * والعمليات على الخليّة التي يقف فيها المؤشّر — صفٌّ تحتها، عمودٌ بجانبها —
 * لا على آخر الجدول دائمًا. وأدواتها تظهر حين يُحرَّر الجدول وحده، فلا تزاحم
 * الورقة.
 */
function TableEditor({
  block,
  doc,
  labelOf,
  onChange,
  onRemove
}: {
  block: TableBlock;
  doc: Doc;
  labelOf: (key: string) => string;
  onChange: (doc: Doc) => void;
  onRemove: () => void;
}) {
  const [at, setAt] = useState({ r: 0, ci: 0 });
  const r = Math.min(at.r, block.rows.length - 1);
  const row = block.rows[r]!;
  /** ترتيب الخليّة في صفّها — وموضعها في الشبكة غيره حين يُدمج ما قبلها. */
  const ci = Math.min(at.ci, row.cells.length - 1);
  const cur = row.cells[ci]!;
  const c = gridColumn(row, ci);
  const spanOf = cur.colSpan ?? 1;
  const total = block.columns.reduce((a, b) => a + b, 0) || 1;

  const ops: { act: string; label: string; title: string; run: () => void; danger?: boolean; off?: boolean }[] = [
    { act: 'row-below', label: '+ صفّ تحت', title: 'صفٌّ تحت الخليّة الحالية', run: () => onChange(addRow(doc, block.id, r + 1)) },
    { act: 'row-above', label: '+ صفّ فوق', title: 'صفٌّ فوق الخليّة الحالية', run: () => onChange(addRow(doc, block.id, r)) },
    { act: 'col-left', label: '+ عمود يسار', title: 'عمودٌ يسار الخليّة الحالية', run: () => onChange(addColumn(doc, block.id, c + spanOf)) },
    { act: 'col-right', label: '+ عمود يمين', title: 'عمودٌ يمين الخليّة الحالية', run: () => onChange(addColumn(doc, block.id, c)) },
    {
      act: 'cell-merge',
      label: '⇤ دمج باليسرى',
      title: 'ادمج الخليّة بالتي على يسارها — وما كُتب فيهما يبقى',
      run: () => onChange(mergeCells(doc, block.id, r, ci)),
      off: ci >= row.cells.length - 1
    },
    {
      act: 'cell-split',
      label: '⇹ فكّ الدمج',
      title: 'أعِد الخليّة المدموجة خلايا بعدد ما غطّت',
      run: () => onChange(splitCell(doc, block.id, r, ci)),
      off: spanOf <= 1
    },
    { act: 'col-wider', label: '⇔ أوسع', title: 'وسّع العمود الحالي', run: () => onChange(resizeColumn(doc, block.id, c, 0.5)) },
    { act: 'col-narrower', label: '⇔ أضيق', title: 'ضيّق العمود الحالي', run: () => onChange(resizeColumn(doc, block.id, c, -0.5)) },
    {
      act: 'table-borders',
      label: block.borders === false ? '⊞ بحدود' : '⊟ بلا حدود',
      title: 'حدود الجدول تُطبع أو تُخفى — لجدولٍ يرتّب الرأس لا يُرى',
      run: () => onChange(patchBlock<TableBlock>(doc, block.id, { borders: block.borders === false }))
    },
    { act: 'row-remove', label: '− الصفّ', title: 'احذف الصفّ الحالي', run: () => onChange(removeRow(doc, block.id, r)), danger: true },
    { act: 'col-remove', label: '− العمود', title: 'احذف العمود الحالي', run: () => onChange(removeColumn(doc, block.id, c)), danger: true }
  ];

  return (
    <div className="group/tbl flex flex-col gap-1">
      <table className="w-full table-fixed border-collapse">
        <tbody>
          {block.rows.map((row, ri) => {
            // موضع كل خليّة في شبكة الأعمدة — المدموجة أفقيًّا تشغل أكثر من عمود.
            let grid = 0;
            return (
            <tr key={row.id}>
              {row.cells.map((cel, k) => {
                const from = grid;
                grid += cel.colSpan ?? 1;
                const weight = block.columns.slice(from, grid).reduce((a, b) => a + b, 0) || 1;
                return (
                <td
                  key={cel.id}
                  className={`align-top p-0 border ${
                    block.borders === false ? 'border-dashed border-outline-variant/50' : 'border-outline-variant'
                  } ${ri === r && k === ci ? 'group-focus-within/tbl:bg-secondary-fixed/40' : ''}`}
                  colSpan={cel.colSpan}
                  data-cell={`${ri}-${k}`}
                  style={{ width: `${(weight / total) * 100}%` }}
                >
                  {/* فقرات الخليّة كلّها — خليّة Word قد تحمل أسطرًا بمحاذاةٍ لكلٍّ منها. */}
                  {cel.blocks.map((p) => (
                    <EditableInlines
                      key={p.id}
                      blockId={p.id}
                      className={`${CELL_CLASS} ${block.header && ri === 0 ? 'font-bold' : ''}`}
                      inlines={p.inlines}
                      labelOf={labelOf}
                      style={paraStyle(p)}
                      onCommit={(inlines) => onChange(setInlines(doc, p.id, inlines))}
                      onFocus={() => setAt({ r: ri, ci: k })}
                    />
                  ))}
                </td>
                );
              })}
            </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-1">
        <div className="hidden group-focus-within/tbl:flex flex-wrap items-center gap-1">
          {ops.map((a) => (
            <button
              key={a.act}
              className={`h-7 px-2 rounded font-label-sm text-label-sm disabled:opacity-30 disabled:cursor-not-allowed ${
                a.danger
                  ? 'text-error hover:bg-error-container'
                  : 'bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant'
              }`}
              data-act={a.act}
              disabled={a.off}
              title={a.title}
              type="button"
              // لا يسرق التركيز من الخليّة: الأدوات تظهر ما دام التركيز في الجدول.
              onMouseDown={(e) => e.preventDefault()}
              onClick={a.run}
            >
              {a.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
          <input
            className="w-3.5 h-3.5 accent-secondary"
            checked={block.header}
            type="checkbox"
            onChange={(e) => onChange(patchBlock<TableBlock>(doc, block.id, { header: e.target.checked }))}
          />
          صفّ عناوين يتكرّر بين الصفحات
        </label>
        <span className="flex-1" />
        <button
          className="h-7 px-2 rounded text-error hover:bg-error-container font-label-sm text-label-sm opacity-0 group-hover/tbl:opacity-100 group-focus-within/tbl:opacity-100 transition-opacity flex items-center gap-1"
          data-act="table-delete"
          title="احذف الجدول كلّه"
          type="button"
          onClick={onRemove}
        >
          <span className="material-symbols-outlined text-[16px]">delete</span>
          حذف الجدول
        </button>
      </div>
    </div>
  );
}
