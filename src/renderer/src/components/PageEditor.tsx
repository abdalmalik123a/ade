/**
 * المحرّر — الورقة وثيقةٌ واحدة (خطّة الترقية، المرحلة ١: المحرّر يساوي Word).
 *
 * المحرّر الأوّل جعل كلّ كتلةٍ مساحة تحريرٍ وحدها، فلا يُحدَّد النصّ عبر الفقرات ولا
 * يُنسَّق دفعةً واحدة — وهذا أكثر ما شكا منه الموظفون. وهنا ProseMirror: التحديد بالحرف
 * أينما امتدّ وCtrl+A، والتنسيق على المحدَّد، والتراجع واللصق من Word بتنسيقه، والكتابة
 * العربية — من مكتبةٍ مجرَّبة لا من كودٍ يُكتب لها.
 *
 * **والوثيقة لا تتغيّر.** ما يُحفظ `Doc` بكتلها كما كان (`shared/docPm.ts` جسرٌ في
 * الاتجاهين)، والحقل عقدةٌ ذرّية: تُحذف كلّها أو تبقى، ولا يُكتب داخلها. وأوامر الجدول
 * تحفظ ما تصنعه (`shared/docPmTable.ts`).
 *
 * بُني بجانب الأوّل حتى ثبت في الميدان (٤ تشرين الأول ٢٠٢٦)، ثم صار المحرّر الوحيد وحُذف الأوّل
 * (الموجة ١، المجموعة ج). وأدواته المشتركة — الشريط وقائمة الإدراج ولوحة الحقول — في `editorKit.tsx`.
 */
import 'prosemirror-view/style/prosemirror.css';
import 'prosemirror-tables/style/tables.css';
import 'prosemirror-gapcursor/style/gapcursor.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AllSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { undoDepth } from 'prosemirror-history';
import {
  tableState,
} from '@shared/docPmTable';
import { listStyleAt } from '@shared/docPmList';
import { pmBlocks } from '@shared/docPm';
import {
  marginPreset,
  newUuid,
  paragraph,
  run,
  type Align,
  type Block,
  type Doc,
  type DocField,
  type ListStyle,
  type PageSetup,
} from '@shared/doc';
import { marker, watermarkHtml } from '@shared/docHtml';
import { makeTable } from '@shared/docEdit';
import { HEAD_MAX, findSheetHead } from '@shared/sheetHead';
import { pxToPt } from '@shared/fontSize';
import {
  BASE_SIZE,
  InsertMenu,
  type EditorProps,
  type MenuClip
} from './editorKit';
import { FieldPanel } from './pageEditor/FieldPanel';
import { MM_PX } from './pageFlow';
import FieldHints from './FieldHints';
import { wrongGenderWords } from '@shared/fieldHints';
import { GENDER_KEY, isChoiceKey, pickChoice } from '@shared/gender';
import { toIndic, count } from '@shared/arabic';
import { trialValues, N, M, SHEET_GAP, markValue, paragraphValue, insertFieldFallback } from './pageEditor/commands';
import FormatBar from './pageEditor/FormatBar';
import SheetBar from './pageEditor/SheetBar';
import type { HeadChoice } from './pageEditor/types';
import { usePmEditor } from './pageEditor/usePmEditor';
import { selectCellsInTable } from '@shared/docPmTable';
export type { HeadChoice } from './pageEditor/types';

export type PageEditorProps = EditorProps & { head?: HeadChoice };

// ── المحرّر ─────────────────────────────────────────────────────────────

export default function PageEditor({ doc, onChange, clips = [], header, values, aside, apiRef, head }: PageEditorProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const docRef = useRef(doc);
  docRef.current = doc;
  /** آخر كتلٍ صدرت من المحرّر — وما سواها وثيقةٌ جاءت من الخارج فتُعاد إليه. */
  const ownBlocks = useRef<Block[] | null>(null);
  /** حقولٌ عُرّفت قبل أن تقع على الورقة (F4 وكتالوج المعاملات) — تُضمّ في أوّل حفظ. */
  const pendingFields = useRef<DocField[]>([]);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [menu, setMenu] = useState(false);
  const [, setTick] = useState(0);
  const paperRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<HTMLDivElement | null>(null);
  const [pages, setPages] = useState(1);
  /** كلمةٌ عابرة في سطر الحال — لما لا يُفعل ولماذا (دمجٌ رأسيّ). */
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    const el = mountRef.current?.querySelector('[data-page-editor]');
    const fn = (r1: number, c1: number, r2: number, c2: number) => {
      const v = viewRef.current;
      if (!v) return;
      const tr = selectCellsInTable(v.state, 0, r1, c1, r2, c2);
      if (tr) v.dispatch(tr);
    };
    if (el) (el as any).__pmSelectCells = fn;
    (window as any).__pmSelectCells = fn;
    return () => {
      if (el) delete (el as any).__pmSelectCells;
      delete (window as any).__pmSelectCells;
    };
  });
  const [customMargins, setCustomMargins] = useState(false);

  const [trying, setTrying] = useState(false);
  const shownValues = useMemo(() => (trying ? trialValues(doc.fields, values) : values), [trying, doc.fields, values]);
  const labelOf = useCallback(
    (key: string) => {
      // خيار التذكير والتأنيث: بالجنس إن عُرف، وبالخيارين معًا إن لم يُعرف.
      if (isChoiceKey(key)) {
        const g = shownValues?.[GENDER_KEY];
        return g ? `=${pickChoice(key, g)}` : pickChoice(key, undefined);
      }
      const value = shownValues?.[key]?.trim();
      return value ? `=${value}` : doc.fields.find((f) => f.key === key)?.label || key;
    },
    [doc.fields, shownValues]
  );
  /** ما يُعلَّم على الورقة في «جرّب باسمٍ آخر»: المذكّر الباقي نصًّا، وقيم الخانات المكتوبة نصًّا. */
  const wrongRef = useRef<string[]>([]);
  wrongRef.current = trying
    ? [
        ...wrongGenderWords('أنثى'),
        ...doc.fields.filter((f) => !isChoiceKey(f.key) && f.label.trim().split(/\s+/).length >= 2).map((f) => f.label.trim())
      ]
    : [];
  const labelRef = useRef(labelOf);
  labelRef.current = labelOf;

  // ── قلب المحرّر والصفحات: ProseMirror على الورقة والوثيقة بينهما، والصفحات كما تقسمها الطابعة — `pageEditor/usePmEditor.ts` ──
  const { margins, run_, insertBlocks, page, toField, repeatHead, bottomMm, applyDoc } = usePmEditor({
    ownBlocks, docRef, pendingFields, onChangeRef, labelRef, viewRef, setMenu, mountRef, wrongRef, setTick, doc, shownValues,
    trying, header, paperRef, headRef, setPages
  });

  /** الخطّ الفاصل تحت أسطر الرأس: أوّل خطٍّ في أعلى الورقة — أو صورة Word الممطوطة. */
  const topRule = (): { pos: number; size: number } | null => {
    const view = viewRef.current;
    if (!view) return null;
    let found: { pos: number; size: number } | null = null;
    let i = 0;
    view.state.doc.forEach((node, pos) => {
      if (found || i++ >= HEAD_MAX) return;
      const h = Number(node.attrs.height);
      const wordLine = node.type === N.image && h > 0 && h <= 20 && Number(node.attrs.width) >= 200;
      if (node.type === N.rule || wordLine) found = { pos, size: node.nodeSize };
    });
    return found;
  };

  /**
   * يضع الخطّ تحت أسطر الرأس أو يرفعه. وحدّ الرأس: ما يعرفه كاشف الرأس، وإلا فالأسطر
   * الأولى حتى أوّل فراغٍ أو جدولٍ أو فاصل (ستّةٌ على الأكثر)، وإلا فالسطر الأوّل.
   */
  const toggleLinesRule = () => {
    const view = viewRef.current;
    if (!view) return;
    const { state } = view;
    const existing = topRule();
    if (existing) {
      view.dispatch(state.tr.delete(existing.pos, existing.pos + existing.size));
      view.focus();
      return;
    }
    const blocks = pmBlocks(state.doc);
    let end = findSheetHead({ ...docRef.current, blocks });
    if (end <= 0) {
      // سطرٌ من الرأس: فقرةٌ فيها نصّ، أو صفٌّ بأعمدته — وما سواهما (فراغٌ أو جدولٌ أو فاصل) حدّه.
      const headish = (b: Block) =>
        b.kind === 'columns' || (b.kind === 'paragraph' && b.inlines.some((x) => x.kind !== 'run' || x.text.trim()));
      while (end < Math.min(6, blocks.length) && headish(blocks[end]!)) end += 1;
      if (end === 0 || end === 6) end = 1;
    }
    let at = 0;
    let i = 0;
    state.doc.forEach((node, pos) => {
      if (i++ < end) at = pos + node.nodeSize;
    });
    view.dispatch(state.tr.insert(at, N.rule.create({ id: newUuid() })).scrollIntoView());
    view.focus();
  };

  /** ضبط الورقة من شريطها — والمتن كما هو. */
  const setPage = (patch: Partial<PageSetup>) => {
    const next: Doc = { ...docRef.current, pageSetup: { ...docRef.current.pageSetup, ...patch } };
    docRef.current = next;
    onChangeRef.current(next);
  };
  const preset = marginPreset(margins);

  if (apiRef)
    apiRef.current = {
      insertField: (key) =>
        run_((state, dispatch) => {
          if (dispatch) dispatch(state.tr.replaceSelectionWith(N.field.create({ ref: key, id: newUuid() }), false).scrollIntoView());
          return true;
        }),
      insertText: (text) =>
        run_((state, dispatch) => {
          if (dispatch) dispatch(state.tr.insertText(text).scrollIntoView());
          return true;
        }),
      insertNewField: (f) =>
        run_((state, dispatch) => {
          if (dispatch) {
            pendingFields.current.push(f);
            dispatch(state.tr.replaceSelectionWith(N.field.create({ ref: f.key, id: newUuid() }), false).scrollIntoView());
          }
          return true;
        })
    };

  function insertClip(clip: MenuClip) {
    insertBlocks(clip.body.split('\n').map((line) => paragraph(line ? [run(line)] : [])));
    void window.diwan.clips.touch(clip.id);
  }

  // ── حال الأدوات ─────────────────────────────────────────────────────
  const state = viewRef.current?.state ?? null;
  const all = state?.selection instanceof AllSelection;
  const curFont = state ? (markValue(state, M.font, 'family') as string | null) : null;
  const curSizeMark = state ? (markValue(state, M.size, 'px') as number | null) : null;
  const curParaSize = state ? (paragraphValue(state, 'size') as number | null | undefined) : null;
  // يُعرض بالنقطة كما في Word (د٥)، ويبقى مخزَّنًا بالبكسل.
  const curPt = pxToPt(curSizeMark ?? curParaSize ?? BASE_SIZE);
  const curAlign = state ? (paragraphValue(state, 'align') as Align | undefined) : undefined;
  const curLh = state ? (paragraphValue(state, 'lineHeight') as number | null | undefined) : undefined;
  const curIndent = state ? paragraphValue(state, 'indent') : undefined;
  const curList = state ? listStyleAt(state) : null;
  const listLabel = (s: ListStyle) => [0, 1, 2].map((i) => marker(s, i, doc.pageSetup.numerals)).join(' ');
  /** الجدول الذي فيه المؤشّر — حدوده وصفّ عناوينه، وهل التحديد يعبر صفوفه. */
  const table = state ? tableState(state) : null;
  const selChars = state && !state.selection.empty ? state.doc.textBetween(state.selection.from, state.selection.to, ' ').length : 0;

  const pageH = page.h * MM_PX;
  const stride = pageH + SHEET_GAP;
  const pageNumber = (n: number) => (doc.pageSetup.numerals === 'indic' ? toIndic(n) : String(n));

  return (
    <div className="flex gap-space-md h-full min-h-0">
      <div className="flex-1 min-w-0 overflow-auto flex flex-col bg-surface-dim/40" data-doc-editor="" data-editor="v2" data-undo-depth={state ? undoDepth(state) : 0}>
        {/* الأدوات وشريط الورقة معًا في أعلى الشاشة، والورقة تمرّ تحتهما. */}
        <div className="sticky top-0 z-10">
          <FormatBar
            run_={run_}
            state={state}
            curFont={curFont}
            curPt={curPt}
            curAlign={curAlign}
            curLh={curLh}
            curIndent={curIndent}
            curList={curList}
            listLabel={listLabel}
            setMenu={setMenu}
            all={all}
            toField={toField}
            table={table}
            viewRef={viewRef}
            setNotice={setNotice}
          />

          {/* شريط الورقة: المقاس والاتجاه والهوامش — بكلمةٍ لا بأرقام، والأرقام لمن أرادها. */}
          <SheetBar
            head={head}
            topRule={topRule}
            toggleLinesRule={toggleLinesRule}
            doc={doc}
            setPage={setPage}
            preset={preset}
            customMargins={customMargins}
            setCustomMargins={setCustomMargins}
            margins={margins}
            pages={pages}
          />
          {notice && (
            <div className="px-space-sm py-1 bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm" data-editor-notice="" role="status">
              {notice}
            </div>
          )}
        </div>

        {/* الورقة بمقاسها الحقيقي وهوامشها، وصفحاتها كما تقسمها الطابعة (`pageFlow.ts`). */}
        <div
          ref={paperRef}
          className="relative isolate mx-auto my-space-md shrink-0 flex flex-col"
          data-paper=""
          style={{
            width: `${page.w}mm`,
            minHeight: `${pages * pageH + (pages - 1) * SHEET_GAP}px`,
            paddingTop: `${margins.top}mm`,
            paddingRight: `${margins.right}mm`,
            paddingLeft: `${margins.left}mm`
          }}
        >
          <div aria-hidden="true" className="absolute inset-x-0 top-0 pointer-events-none" style={{ zIndex: -2 }}>
            {Array.from({ length: pages }, (_, i) => (
              <div
                key={i}
                className="paper absolute inset-x-0 bg-surface-container-lowest shadow-[0_1px_3px_rgba(24,33,29,0.06),0_16px_32px_-4px_rgba(24,33,29,0.10)]"
                data-sheet={i + 1}
                style={{ top: i * stride, height: pageH }}
              />
            ))}
          </div>
          <div className="contents" dangerouslySetInnerHTML={{ __html: watermarkHtml(doc) }} />
          {header ? <div ref={headRef}>{header}</div> : null}
          <div ref={mountRef} className="flex-1 font-body-md text-body-md leading-8 text-on-surface" />
          {repeatHead &&
            Array.from({ length: pages - 1 }, (_, i) => (
              <div
                key={i}
                aria-hidden="true"
                className="absolute pointer-events-none"
                data-repeat-head={i + 2}
                style={{ top: (i + 1) * stride + margins.top * MM_PX, right: `${margins.right}mm`, left: `${margins.left}mm` }}
              >
                {header}
              </div>
            ))}
          {doc.pageSetup.pageNumbers &&
            Array.from({ length: pages }, (_, i) => (
              <div
                key={i}
                aria-hidden="true"
                className="absolute inset-x-0 text-center text-[10pt] leading-none text-on-surface-variant pointer-events-none"
                data-page-number={i + 1}
                style={{ top: i * stride + pageH - (bottomMm * MM_PX) / 2 - 6 }}
              >
                صفحة {pageNumber(i + 1)} من {pageNumber(pages)}
              </div>
            ))}
        </div>

        <div className="mx-auto my-space-sm font-label-sm text-label-sm text-on-surface-variant" data-selection-status="">
          {all
            ? 'المحدَّد: الورقة كلّها — كلّ تنسيقٍ يقع عليها'
            : selChars
              ? `محدَّد ${count(selChars, 'حرف')}`
              : head?.mode === 'lines' && !topRule()
                ? 'اكتب أسطر الترويسة في أعلى الورقة، ثم «خطّ فاصل» يضع الخطّ تحتها'
                : 'ظلّل عبارةً واضغط F4 لتصير خانة · Shift+Enter سطرٌ في الفقرة نفسها · Ctrl+Enter صفحةٌ جديدة'}
        </div>
      </div>

      {aside === undefined ? (
        <FieldPanel
          doc={doc}
          top={<FieldHints doc={doc} trying={trying} onApply={applyDoc} onTry={setTrying} />}
          onChange={onChange}
          onInsert={(key) => apiRef?.current?.insertField(key) ?? insertFieldFallback(viewRef.current, key)}
        />
      ) : (
        aside
      )}

      {menu && (
        <InsertMenu
          addressing={doc.meta.addressing ?? null}
          clips={clips}
          onClose={() => setMenu(false)}
          onClip={insertClip}
          onTable={(rows, cols) => insertBlocks([makeTable(rows, cols)])}
          onImage={(src, align) => insertBlocks([{ id: newUuid(), kind: 'image', src, width: 140, align }])}
          onPick={(what) => {
            if (what === 'copies')
              insertBlocks([paragraph([run('نسخة منه إلى :-', { bold: true, underline: true })]), paragraph([run('- ')]), paragraph([run('- ')])]);
            else if (what === 'columns') insertBlocks([{ id: newUuid(), kind: 'columns', columns: [[paragraph([])], [paragraph([])]] }]);
            else if (what === 'answer') insertBlocks([{ id: newUuid(), kind: 'spacer', height: 112, lines: true }]);
            else if (what === 'spacer') insertBlocks([{ id: newUuid(), kind: 'spacer', height: 24 }]);
            else if (what === 'pageBreak') insertBlocks([{ id: newUuid(), kind: 'pageBreak' }, paragraph([])]);
            else if (what === 'rule') insertBlocks([{ id: newUuid(), kind: 'rule' }]);
          }}
        />
      )}
    </div>
  );
}

