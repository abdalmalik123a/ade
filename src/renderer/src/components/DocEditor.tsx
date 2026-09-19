/**
 * محرّر الوثيقة — كتلًا، لا نصًّا واحدًا.
 *
 * **القرار المعماري:** `contentEditable` للكتلة الواحدة لا للمستند، والتحديد
 * عبر الكتل بمستوى الكتلة لا الحرف. يُسقط هذا تسعين بالمئة من تعقيد المحررات
 * — التحديد المتقاطع، والتراجع، واللصق — ويبقي إحساس Word.
 *
 * والحقل عقدةٌ لا نصّ: يُرسم صندوقًا غير قابل للتحرير، فلا يُكسر بنصف مسح.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fieldRef,
  itemScore,
  newUuid,
  paragraph,
  run,
  tallyScores,
  type Block,
  type Doc,
  type DocField,
  type Inline,
  type ListBlock,
  type ListItem,
  type ParagraphBlock,
  type TableBlock
} from '@shared/doc';
import { marker } from '@shared/docHtml';
import {
  addColumn,
  addRow,
  commit,
  fieldify,
  insertBlock,
  insertField,
  makeTable,
  moveBlock,
  patchBlock,
  patchField,
  removeBlock,
  removeColumn,
  removeRow,
  reorderFields,
  setCell,
  setInlines,
  startHistory,
  redo,
  undo,
  type History,
  addBranch,
  addItem,
  makeQuestionList,
  patchItem,
  removeItem,
  setItemInlines
} from '@shared/docEdit';
import { unfield } from '@shared/doc';

/** رموز المواد — تُدرج بضغطة، ولا محرّك معادلات (§ما لن نبنيه). */
const SYMBOLS = [
  '√', '∑', '∫', '≤', '≥', '≠', '±', '×', '÷', '°', '∞', 'π',
  '⁰', '¹', '²', '³', '₁', '₂', '₃', '→', '⇌', 'Δ', 'λ', 'μ', 'Ω', '½', '¼', '¾'
];

export type DocEditorProps = {
  doc: Doc;
  onChange: (doc: Doc) => void;
  /** عبارات المكتب — تُدرج من قائمة `/`. */
  clips?: { id: number; title: string; body: string }[];
};

// ── تحويل الأجزاء ↔ العلامات ────────────────────────────────────────

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** الحقل صندوقٌ لا يُحرَّر: `contenteditable=false` يمنع كسره بنصف مسح. */
function inlinesToHtml(inlines: Inline[], labelOf: (key: string) => string): string {
  return (
    inlines
      .map((i) => {
        if (i.kind === 'break') return '<br/>';
        if (i.kind === 'run') {
          let out = esc(i.text);
          if (i.marks?.underline) out = `<u>${out}</u>`;
          if (i.marks?.bold) out = `<strong>${out}</strong>`;
          return out;
        }
        return (
          `<span contenteditable="false" data-field="${esc(i.ref)}" ` +
          `class="px-1 mx-0.5 rounded bg-primary-container text-on-primary font-label-sm text-label-sm">` +
          `${esc(labelOf(i.ref))}</span>`
        );
      })
      .join('') || ''
  );
}

/** يقرأ ما كتبه الموظف في الكتلة ويعيده أجزاءً — الحقول كما هي. */
function htmlToInlines(node: Node): Inline[] {
  const out: Inline[] = [];

  const walk = (el: Node, marks: { bold?: boolean; underline?: boolean }) => {
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent ?? '';
        if (text) out.push(Object.keys(marks).length ? run(text, marks) : run(text));
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
      const tag = child.tagName;
      walk(child, {
        ...marks,
        bold: marks.bold || tag === 'B' || tag === 'STRONG',
        underline: marks.underline || tag === 'U'
      });
    }
  };

  walk(node, {});
  return out;
}

/** موضع المؤشّر في نصّ الكتلة: الحقل محرفٌ واحد. */
function caretOffsets(host: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
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

// ── الكتلة القابلة للتحرير ──────────────────────────────────────────

function EditableInlines({
  inlines,
  labelOf,
  onCommit,
  onFocus,
  className,
  placeholder
}: {
  inlines: Inline[];
  labelOf: (key: string) => string;
  onCommit: (inlines: Inline[], host: HTMLElement) => void;
  onFocus?: (host: HTMLElement) => void;
  className?: string;
  placeholder?: string;
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
      data-placeholder={placeholder}
      dir="rtl"
      suppressContentEditableWarning
      onBlur={() => ref.current && onCommit(htmlToInlines(ref.current), ref.current)}
      onFocus={() => ref.current && onFocus?.(ref.current)}
      onInput={() => ref.current && onCommit(htmlToInlines(ref.current), ref.current)}
    />
  );
}

// ── المحرّر ─────────────────────────────────────────────────────────

const BLOCK_CLASS =
  'min-h-[1.9rem] px-2 py-1 rounded outline-none focus:bg-surface-container-low font-body-md text-body-md leading-8 text-on-surface';

export default function DocEditor({ doc, onChange, clips = [] }: DocEditorProps) {
  const [history, setHistory] = useState<History>(() => startHistory(doc));
  const [active, setActive] = useState<string | null>(doc.blocks[0]?.id ?? null);
  const [menu, setMenu] = useState<{ blockId: string } | null>(null);
  const hosts = useRef(new Map<string, HTMLElement>());
  const caret = useRef<{ blockId: string; start: number; end: number } | null>(null);

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
    (key: string) => doc.fields.find((f) => f.key === key)?.label || key,
    [doc.fields]
  );

  /** يتذكّر موضع المؤشّر ليعمل F4 وقائمة `/` على ما ظُلِّل. */
  const remember = (blockId: string) => {
    const host = hosts.current.get(blockId);
    if (!host) return;
    const at = caretOffsets(host);
    if (at) caret.current = { blockId, ...at };
  };

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

  /** F4: ما ظُلِّل يصير حقلًا باسمه. */
  function toField() {
    const at = caret.current;
    if (!at || at.end <= at.start) return;
    const next = fieldify(doc, at.blockId, at.start, at.end);
    if (next === doc) return;
    // العلامات تُعاد رسمها: الحقل صندوقٌ جديد مكان النصّ.
    const host = hosts.current.get(at.blockId);
    const block = next.blocks.find((b) => b.id === at.blockId) as ParagraphBlock | undefined;
    if (host && block) host.innerHTML = inlinesToHtml(block.inlines, (k) => nextLabel(next, k));
    apply(next);
  }

  const nextLabel = (d: Doc, key: string) => d.fields.find((f) => f.key === key)?.label || key;

  /** مجموع الدرجات — يُنبَّه المدرّس إن لم يبلغ المئة. */
  const tally = useMemo(() => tallyScores(doc), [doc]);

  /** رمزٌ يُدرج حيث وقف المؤشّر، وإلا فآخر الكتلة الجارية. */
  function insertSymbol(sym: string) {
    const host = active ? hosts.current.get(active) : null;
    if (!host) return;
    host.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount && host.contains(sel.getRangeAt(0).startContainer)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(sym));
      range.collapse(false);
    } else {
      host.append(document.createTextNode(sym));
    }
    host.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function insertAfterActive(block: Block) {
    apply(insertBlock(doc, block, active));
    setMenu(null);
  }

  function insertClip(body: string) {
    const lines = body.split('\n');
    let next = doc;
    let after = active;
    for (const line of lines) {
      const block = paragraph(line ? [run(line)] : []);
      next = insertBlock(next, block, after);
      after = block.id;
    }
    apply(next);
    setMenu(null);
  }

  return (
    <div className="flex gap-space-md h-full min-h-0">
      {/* الورقة */}
      <div className="flex-1 min-w-0 overflow-y-auto p-space-sm flex flex-col gap-1">
        <div className="sticky top-0 z-10 bg-surface-container-lowest pb-1 flex items-center gap-space-xs flex-wrap">
          {SYMBOLS.map((sym) => (
            <button
              key={sym}
              className="w-7 h-7 rounded bg-surface-container-low hover:bg-surface-container-high text-on-surface font-body-md text-body-md"
              title={`أدرج ${sym}`}
              type="button"
              onClick={() => insertSymbol(sym)}
            >
              {sym}
            </button>
          ))}
          <span className="flex-1" />
          {tally.total > 0 && (
            <span
              className={`px-2 h-7 flex items-center rounded-full font-label-md text-label-md ${
                tally.total === 100
                  ? 'bg-primary-container text-on-primary'
                  : 'bg-error-container text-on-error-container'
              }`}
            >
              {tally.questions} أسئلة · المجموع {tally.total}
              {tally.total !== 100 ? ` — ${tally.total < 100 ? 'ينقص' : 'يزيد'} ${Math.abs(100 - tally.total)}` : ''}
            </span>
          )}
        </div>
        {doc.blocks.map((block) => (
          <div
            key={block.id}
            className={`group relative rounded ${
              active === block.id ? 'ring-1 ring-outline-variant' : ''
            }`}
            onClick={() => setActive(block.id)}
          >
            {/* أدوات الكتلة */}
            <div className="absolute -right-8 top-1 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {(
                [
                  { icon: 'arrow_upward', title: 'أعلى', run: () => apply(moveBlock(doc, block.id, -1)) },
                  { icon: 'arrow_downward', title: 'أسفل', run: () => apply(moveBlock(doc, block.id, 1)) },
                  { icon: 'delete', title: 'حذف', run: () => apply(removeBlock(doc, block.id)) }
                ] as const
              ).map((a) => (
                <button
                  key={a.icon}
                  className="w-6 h-6 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high"
                  title={a.title}
                  type="button"
                  onClick={a.run}
                >
                  <span className="material-symbols-outlined text-[14px]">{a.icon}</span>
                </button>
              ))}
            </div>

            {block.kind === 'paragraph' && (
              <EditableInlines
                className={BLOCK_CLASS}
                inlines={block.inlines}
                labelOf={labelOf}
                placeholder="اكتب، أو اضغط / للإدراج"
                onCommit={(inlines, host) => {
                  hosts.current.set(block.id, host);
                  remember(block.id);
                  // `/` في أوّل سطر فارغ تفتح قائمة الإدراج.
                  const text = inlines.map((i) => (i.kind === 'run' ? i.text : '')).join('');
                  if (text === '/') {
                    host.innerHTML = '';
                    setMenu({ blockId: block.id });
                    return;
                  }
                  apply(setInlines(doc, block.id, inlines));
                }}
                onFocus={(host) => {
                  hosts.current.set(block.id, host);
                  setActive(block.id);
                }}
              />
            )}

            {block.kind === 'table' && (
              <TableEditor
                block={block}
                doc={doc}
                labelOf={labelOf}
                onChange={apply}
                onCaret={() => undefined}
              />
            )}

            {block.kind === 'list' && (
              <ListEditor
                block={block}
                doc={doc}
                labelOf={labelOf}
                onChange={apply}
                onHost={(id, host) => hosts.current.set(id, host)}
              />
            )}

            {block.kind === 'columns' && (
              <div className="flex gap-space-sm">
                {block.columns.map((col, ci) => (
                  <div key={ci} className="flex-1 min-w-0 p-1 rounded border border-dashed border-outline-variant">
                    {col.map((b) =>
                      b.kind === 'paragraph' ? (
                        <EditableInlines
                          key={b.id}
                          className={BLOCK_CLASS}
                          inlines={b.inlines}
                          labelOf={labelOf}
                          onCommit={(inlines) => {
                            const columns = block.columns.map((c, i) =>
                              i === ci ? c.map((x) => (x.id === b.id ? { ...x, inlines } : x)) : c
                            );
                            apply(patchBlock<typeof block>(doc, block.id, { columns }));
                          }}
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
          </div>
        ))}

        <button
          className="self-start mt-space-xs h-8 px-3 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm"
          type="button"
          onClick={() => insertAfterActive(paragraph([]))}
        >
          + فقرة
        </button>
      </div>

      {/* لوحة الحقول — وهي نفسها ترتيب شاشة الإدخال في الشبّاك */}
      <FieldPanel doc={doc} onChange={apply} onInsert={(key) => {
        const at = caret.current;
        if (at) apply(insertField(doc, at.blockId, at.start, key));
      }} />

      {menu && (
        <InsertMenu
          clips={clips}
          onClose={() => setMenu(null)}
          onPick={(what) => {
            if (what === 'table') insertAfterActive(makeTable(3, 3));
            else if (what === 'questions') insertAfterActive(makeQuestionList());
            else if (what === 'columns')
              insertAfterActive({
                id: newUuid(),
                kind: 'columns',
                columns: [[paragraph([])], [paragraph([])]]
              });
            else if (what === 'answer')
              insertAfterActive({ id: newUuid(), kind: 'spacer', height: 112, lines: true });
            else if (what === 'spacer')
              insertAfterActive({ id: newUuid(), kind: 'spacer', height: 24 });
            else if (what === 'pageBreak') insertAfterActive({ id: newUuid(), kind: 'pageBreak' });
            else setMenu(null);
          }}
          onClip={insertClip}
        />
      )}
    </div>
  );
}

/** قائمة `/` — الإدراج بلا أشرطة أدوات. */
function InsertMenu({
  clips,
  onPick,
  onClip,
  onClose
}: {
  clips: { id: number; title: string; body: string }[];
  onPick: (what: 'table' | 'spacer' | 'pageBreak' | 'questions' | 'columns' | 'answer') => void;
  onClip: (body: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const shown = clips.filter((c) => !query.trim() || c.title.includes(query.trim()));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-32 bg-scrim/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-surface-container-lowest shadow-2xl p-space-sm flex flex-col gap-space-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          className="h-10 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary"
          placeholder="ابحث عن كليشة، أو اختر ما تُدرج"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex flex-wrap gap-1">
          {(
            [
              { key: 'questions', icon: 'format_list_numbered', label: 'أسئلة' },
              { key: 'columns', icon: 'view_column', label: 'عمودان' },
              { key: 'answer', icon: 'edit_note', label: 'مساحة إجابة' },
              { key: 'table', icon: 'table', label: 'جدول' },
              { key: 'spacer', icon: 'height', label: 'مسافة' },
              { key: 'pageBreak', icon: 'insert_page_break', label: 'فاصل صفحة' }
            ] as const
          ).map((o) => (
            <button
              key={o.key}
              className="h-9 px-3 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-1"
              type="button"
              onClick={() => onPick(o.key)}
            >
              <span className="material-symbols-outlined text-[16px] text-secondary">{o.icon}</span>
              {o.label}
            </button>
          ))}
        </div>

        {clips.length > 0 && (
          <div className="max-h-56 overflow-y-auto flex flex-col gap-1 pt-space-xs">
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              كليشات المكتب
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
                  type="button"
                  onClick={() => onClip(c.body)}
                >
                  <span className="font-label-md text-label-md text-on-surface">{c.title}</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
                    {c.body.split('\n')[0]}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
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
        الحقول ({doc.fields.length})
      </span>
      <span className="font-label-sm text-label-sm text-on-surface-variant">
        ترتيبها هنا هو ترتيب شاشة الإدخال في الشبّاك.
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
          title="أدرجه في موضع المؤشّر"
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
    </div>
  );
}

/**
 * محرّر الأسئلة: عناصرُ ترقيم بفروعها ودرجاتها.
 *
 * والعلامة تُحسب ولا تُكتب — فحذف سؤال يعيد ترقيم ما بعده وحده.
 */
function ListEditor({
  block,
  doc,
  labelOf,
  onChange,
  onHost,
  depth = 0,
  items
}: {
  block: ListBlock;
  doc: Doc;
  labelOf: (key: string) => string;
  onChange: (doc: Doc) => void;
  onHost: (id: string, host: HTMLElement) => void;
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
              onCommit={(inlines, host) => {
                onHost(it.id, host);
                onChange(setItemInlines(doc, block.id, it.id, inlines));
              }}
              onFocus={(host) => onHost(it.id, host)}
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
              onHost={onHost}
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
          <label className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
            أجب عن
            <input
              className="w-12 h-7 px-1 rounded bg-surface-container-lowest text-on-surface text-center"
              placeholder="الكل"
              type="number"
              value={block.pick ?? ''}
              onChange={(e) =>
                onChange(
                  patchBlock<ListBlock>(doc, block.id, {
                    pick: e.target.value === '' ? undefined : Number(e.target.value)
                  })
                )
              }
            />
            من {block.items.length}
          </label>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            مجموعها {block.items.reduce((n, it) => n + itemScore(it), 0)}
          </span>
        </div>
      )}
    </div>
  );
}

/** الجدول: خلاياه فقراتٌ تُحرَّر كغيرها. */
function TableEditor({
  block,
  doc,
  labelOf,
  onChange
}: {
  block: TableBlock;
  doc: Doc;
  labelOf: (key: string) => string;
  onChange: (doc: Doc) => void;
  onCaret: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <table className="w-full border-collapse">
        <tbody>
          {block.rows.map((row, r) => (
            <tr key={row.id}>
              {row.cells.map((cel, c) => (
                <td
                  key={cel.id}
                  className="border border-outline-variant align-top p-0"
                  style={{ width: `${(100 / block.columns.length).toFixed(2)}%` }}
                >
                  <EditableInlines
                    className={`${BLOCK_CLASS} ${block.header && r === 0 ? 'font-bold' : ''}`}
                    inlines={cel.blocks[0]?.inlines ?? []}
                    labelOf={labelOf}
                    onCommit={(inlines) => onChange(setCell(doc, block.id, r, c, inlines))}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-1">
        {(
          [
            { label: '+ صفّ', run: () => onChange(addRow(doc, block.id)) },
            { label: '+ عمود', run: () => onChange(addColumn(doc, block.id)) },
            { label: '− صفّ', run: () => onChange(removeRow(doc, block.id, block.rows.length - 1)) },
            {
              label: '− عمود',
              run: () => onChange(removeColumn(doc, block.id, block.columns.length - 1))
            }
          ] as const
        ).map((a) => (
          <button
            key={a.label}
            className="h-7 px-2 rounded bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm"
            type="button"
            onClick={a.run}
          >
            {a.label}
          </button>
        ))}
        <label className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
          <input
            className="w-3.5 h-3.5 accent-secondary"
            checked={block.header}
            type="checkbox"
            onChange={(e) => onChange(patchBlock<TableBlock>(doc, block.id, { header: e.target.checked }))}
          />
          صفّ عناوين يتكرّر بين الصفحات
        </label>
      </div>
    </div>
  );
}
