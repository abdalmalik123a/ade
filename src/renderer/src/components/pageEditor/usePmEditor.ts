/**
 * قلب محرّر الورقة وصفحاته (تقسيم PageEditor بعد ١٫٧٫٠) — منقولٌ منه كما هو: ما في ProseMirror إلى الوثيقة والحقول تتبع ما على
 * الورقة، وعُقد الحقول، وF4 يصنع خانة، والإدراج، وربط المحرّر بالورقة ومزامنته؛ ثم هندسة الورقة وقياس صفحاتها كما تقسمها الطابعة —
 * وهما معًا: القلب يقرأ عرض المتن من الصفحات.
 */
import { useRef, useCallback, useEffect, useMemo } from 'react';
import { type DocField, type Doc, reconcileFields, newUuid, type Block, pageMm } from '@shared/doc';
import type { Node as PMNode } from 'prosemirror-model';
import { pmBlocks, blocksToPm } from '@shared/docPm';
import { FieldView, ImageView, SpacerView, pageBreakView, TableView, ColumnsView, GroupView } from '../pageViews';
import { EditorView } from 'prosemirror-view';
import { type Command, TextSelection, EditorState, Plugin } from 'prosemirror-state';
import { N, M, splitParagraph, uniqueIds, placeholder, markWords, SHEET_GAP } from './commands';
import { fieldFromText } from '@shared/docEdit';
import { keymap } from 'prosemirror-keymap';
import { undo, redo, history } from 'prosemirror-history';
import { toggleMark, chainCommands, baseKeymap } from 'prosemirror-commands';
import { splitListItem, sinkListItem, liftListItem } from 'prosemirror-schema-list';
import { goToNextCell, tableEditing } from 'prosemirror-tables';
import { gapCursor } from 'prosemirror-gapcursor';
import { tableResizing, listMarkersPlugin, listMarkersKey } from '../editorPlugins';
import { caretAfterPaste, cleanPastedHtml, pasteImages, adoptPastedImages } from '../editorPaste';
import { pageFlowPlugin, MM_PX, measurePages, sameBreaks, pageFlowKey } from '../pageFlow';
import type { Dispatch, SetStateAction, MutableRefObject, ReactNode } from 'react';

export function usePmEditor(
  ctx: {
    ownBlocks: MutableRefObject<Block[] | null>;
    docRef: MutableRefObject<Doc>;
    pendingFields: MutableRefObject<DocField[]>;
    onChangeRef: MutableRefObject<(doc: Doc) => void>;
    labelRef: MutableRefObject<(key: string) => string>;
    viewRef: MutableRefObject<EditorView | null>;
    setMenu: Dispatch<SetStateAction<boolean>>;
    mountRef: MutableRefObject<HTMLDivElement | null>;
    wrongRef: MutableRefObject<string[]>;
    setTick: Dispatch<SetStateAction<number>>;
    doc: Doc;
    shownValues: Record<string, string> | undefined;
    trying: boolean;
    header: ReactNode;
    paperRef: MutableRefObject<HTMLDivElement | null>;
    headRef: MutableRefObject<HTMLDivElement | null>;
    setPages: Dispatch<SetStateAction<number>>;
  }
) {
  const {
    ownBlocks, docRef, pendingFields, onChangeRef, labelRef, viewRef, setMenu, mountRef, wrongRef, setTick, doc, shownValues, trying,
    header, paperRef, headRef, setPages
  } = ctx;

  /** ما في المحرّر إلى الوثيقة — والحقول تتبع ما على الورقة. */
  /**
   * كلّ خانةٍ عُرفت في هذه الجلسة بوصفها: التراجع يرفع الخانة من الورقة فتسقط من القائمة،
   * والإعادة تردّها — فتعود باسمها ودورها لا مفتاحًا عاريًا.
   */
  const fieldMemory = useRef(new Map<string, DocField>());
  const emit = useCallback((pm: PMNode) => {
    const blocks = pmBlocks(pm);
    ownBlocks.current = blocks;
    const base = docRef.current;
    for (const f of [...base.fields, ...pendingFields.current]) fieldMemory.current.set(f.key, f);
    const withPending = { ...base, blocks, fields: [...base.fields, ...pendingFields.current.filter((f) => !base.fields.some((x) => x.key === f.key))] };
    pendingFields.current = [];
    const next: Doc = { ...withPending, fields: reconcileFields(withPending, (key) => fieldMemory.current.get(key) ?? {}) };
    docRef.current = next;
    onChangeRef.current(next);
  }, []);

  const pendingPmDoc = useRef<PMNode | null>(null);
  const emitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** تفريغ الوثيقة المعلّقة وإرسالها فورًا إلى شجرة React (D122 — S43). */
  const flushEmit = useCallback(
    (explicitDoc?: PMNode) => {
      if (emitTimer.current) {
        clearTimeout(emitTimer.current);
        emitTimer.current = null;
      }
      const target = explicitDoc ?? pendingPmDoc.current;
      if (target) {
        pendingPmDoc.current = null;
        emit(target);
      }
    },
    [emit]
  );

  /** تأجيل إرسال الوثيقة أثناء الكتابة السريعة المتتابعة لتفادي إعادة تحويل الكتل ورسم React مع كلّ حرف. */
  const scheduleEmit = useCallback(
    (pmDoc: PMNode) => {
      pendingPmDoc.current = pmDoc;
      if (emitTimer.current) clearTimeout(emitTimer.current);
      emitTimer.current = setTimeout(() => {
        emitTimer.current = null;
        if (pendingPmDoc.current) {
          const d = pendingPmDoc.current;
          pendingPmDoc.current = null;
          emit(d);
        }
      }, 250);
    },
    [emit]
  );

  const nodeViews = useCallback(
    () => ({
      field: (node: PMNode) => new FieldView(node, (k) => labelRef.current(k)),
      image: (node: PMNode, view: EditorView, getPos: () => number | undefined) => new ImageView(node, view, getPos),
      spacer: (node: PMNode, view: EditorView, getPos: () => number | undefined) => new SpacerView(node, view, getPos),
      page_break: () => pageBreakView(),
      table: (node: PMNode) => new TableView(node),
      columns: (node: PMNode) => new ColumnsView(node),
      group: (node: PMNode) => new GroupView(node)
    }),
    []
  );

  /** F4: ما ظُلِّل يصير خانةً باسمه — نصًّا متّصلًا في سطرٍ واحد، بلا حقلٍ داخله. */
  const toField: Command = useCallback((state, dispatch) => {
    flushEmit();
    const { $from, $to, from, to, empty } = state.selection;
    if (empty || !$from.sameParent($to) || !$from.parent.isTextblock) return false;
    let hasField = false;
    state.doc.nodesBetween(from, to, (n) => {
      if (n.type === N.field) hasField = true;
    });
    if (hasField) return false;
    const base = docRef.current;
    const known = { ...base, fields: [...base.fields, ...pendingFields.current] };
    const field = fieldFromText(known, state.doc.textBetween(from, to));
    if (!field) return false;
    if (dispatch) {
      pendingFields.current.push(field);
      dispatch(state.tr.replaceWith(from, to, N.field.create({ ref: field.key, id: newUuid() })));
    }
    return true;
  }, [flushEmit]);

  /** كتلٌ بعد الكتلة التي فيها المؤشّر — والمؤشّر في أوّل سطرٍ يُكتب فيه منها. */
  const insertBlocks = useCallback((blocks: Block[]) => {
    flushEmit();
    const view = viewRef.current;
    if (!view) return;
    const { state } = view;
    const $from = state.selection.$from;
    const at = $from.depth >= 1 ? $from.after(1) : state.doc.content.size;
    const nodes = blocksToPm(blocks).content;
    const tr = state.tr.insert(at, nodes);
    tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(at + 1, tr.doc.content.size))));
    view.dispatch(tr.scrollIntoView());
    view.focus();
    setMenu(false);
  }, [flushEmit, setMenu]);

  const run_ = useCallback((cmd: Command) => {
    const view = viewRef.current;
    if (!view) return false;
    const done = cmd(view.state, view.dispatch, view);
    view.focus();
    return done;
  }, []);

  // ── الصفحات ─────────────────────────────────────────────────────────
  const page = pageMm(doc.pageSetup);
  const margins = doc.pageSetup.margins;
  // كما في `pageCss`: الترقيم يحتاج هامشًا سفليًّا لا يقلّ عن ١٤ ملم.
  const bottomMm = doc.pageSetup.pageNumbers ? Math.max(margins.bottom, 14) : margins.bottom;
  const repeatHead = doc.pageSetup.repeatLetterhead && Boolean(header);
  /** عرض المتن بالبكسل — أعرض ما تُلصق به صورة. */
  const contentWidth = useRef(0);
  contentWidth.current = (page.w - margins.left - margins.right) * MM_PX;
  const geo = useRef({ pageW: 0, pageH: 0, top: 0, bottom: 0, repeat: false });
  geo.current = { pageW: page.w * MM_PX, pageH: page.h * MM_PX, top: margins.top * MM_PX, bottom: bottomMm * MM_PX, repeat: repeatHead };
  const frame = useRef(0);
  const measureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** التنفيذ الفعلي لقياس الورقة وفواصلها في إطار الرسم. */
  const doMeasure = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const view = viewRef.current;
      const paper = paperRef.current;
      const mount = mountRef.current;
      if (!view || !paper || !mount) return;
      const g = geo.current;
      const scale = paper.getBoundingClientRect().width / g.pageW || 1;
      const head = g.repeat && headRef.current ? headRef.current.getBoundingClientRect().height / scale : 0;
      const { breaks, pages: n } = measurePages(view, paper, mount, { pageW: g.pageW, pageH: g.pageH, gap: SHEET_GAP, top: g.top, bottom: g.bottom, repeatHead: head });
      setPages(n);
      if (!sameBreaks(pageFlowKey.getState(view.state)?.breaks ?? [], breaks)) {
        view.dispatch(view.state.tr.setMeta(pageFlowKey, breaks).setMeta('addToHistory', false));
      }
    });
  }, [headRef, mountRef, paperRef, setPages, viewRef]);

  /**
   * إعادة القياس: فوريٌّ عند تهيئة الورقة أو تغيّر هندستها، ومؤجَّلٌ (debounced) أثناء الكتابة السريعة
   * لتفادي قياس مئات الصفحات مع كلّ نقرة حرف (D122 — S43).
   */
  const remeasure = useCallback(
    (immediate = false) => {
      if (measureTimer.current) {
        clearTimeout(measureTimer.current);
        measureTimer.current = null;
      }
      if (immediate) {
        doMeasure();
      } else {
        measureTimer.current = setTimeout(() => {
          measureTimer.current = null;
          doMeasure();
        }, 250);
      }
    },
    [doMeasure]
  );

  // المحرّر يُنشأ مرّة؛ وما بعدها يمرّ بالحالة.
  useEffect(() => {
    if (!mountRef.current) return;
    const keys = keymap({
      'Mod-z': undo,
      'Mod-y': redo,
      'Shift-Mod-z': redo,
      'Mod-b': toggleMark(M.bold),
      'Mod-i': toggleMark(M.italic),
      'Mod-u': toggleMark(M.underline),
      Enter: chainCommands(splitListItem(N.list_item), splitParagraph),
      'Shift-Enter': (state, dispatch) => {
        if (dispatch) dispatch(state.tr.replaceSelectionWith(N.hard_break.create()).scrollIntoView());
        return true;
      },
      'Mod-Enter': (state, dispatch) => {
        const $from = state.selection.$from;
        const at = $from.depth >= 1 ? $from.after(1) : state.doc.content.size;
        if (dispatch) {
          const tr = state.tr.insert(at, [N.page_break.create({ id: newUuid() }), N.paragraph.create({ id: newUuid(), align: $from.parent.attrs.align ?? 'right' })]);
          tr.setSelection(TextSelection.near(tr.doc.resolve(at + 2)));
          dispatch(tr.scrollIntoView());
        }
        return true;
      },
      F4: (state, dispatch) => toField(state, dispatch),
      Tab: chainCommands(goToNextCell(1), sinkListItem(N.list_item)),
      'Shift-Tab': chainCommands(goToNextCell(-1), liftListItem(N.list_item))
    });
    const view = new EditorView(mountRef.current, {
      state: EditorState.create({
        doc: blocksToPm(docRef.current.blocks),
        plugins: [
          history({ depth: 200 }),
          keys,
          keymap(baseKeymap),
          gapCursor(),
          tableResizing(),
          tableEditing(),
          listMarkersPlugin(() => docRef.current.pageSetup.numerals),
          uniqueIds,
          placeholder,
          caretAfterPaste,
          pageFlowPlugin(),
          new Plugin({ props: { decorations: (state) => markWords(state.doc, wrongRef.current) } })
        ]
      }),
      nodeViews: nodeViews(),
      attributes: { class: 'pm-page outline-none', dir: 'rtl', 'data-page-editor': '' },
      transformPastedHTML: cleanPastedHtml,
      handlePaste(v, event) {
        // صورةٌ وحدها في الحافظة (لقطة شاشة، أو صورةٌ نُسخت): تُحفظ وتُدرج. ونصٌّ من Word يحمل
        // معه صورةً لما نُسخ — فالنصّ أولى، ويُلصق كما هو.
        const data = event.clipboardData;
        const files = data ? [...data.files].filter((f) => f.type.startsWith('image/')) : [];
        if (!data || !files.length) return false;
        const html = data.getData('text/html');
        const words = (data.getData('text/plain') + html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ')).trim();
        if (words) return false;
        event.preventDefault();
        void pasteImages(v, files, contentWidth.current);
        return true;
      },
      handleDOMEvents: {
        blur: () => {
          flushEmit();
          remeasure(true);
          return false;
        }
      },
      dispatchTransaction(tr) {
        const v = viewRef.current!;
        const before = v.state.doc;
        const next = v.state.apply(tr);
        v.updateState(next);
        if (next.doc !== before) {
          if (tr.getMeta('paste') || tr.getMeta('forceEmit')) {
            flushEmit(next.doc);
          } else {
            scheduleEmit(next.doc);
          }
        }
        if (tr.getMeta('paste')) void adoptPastedImages(v);
        setTick((t) => t + 1);
      }
    });
    viewRef.current = view;
    ownBlocks.current = docRef.current.blocks;
    return () => {
      flushEmit();
      if (measureTimer.current) clearTimeout(measureTimer.current);
      cancelAnimationFrame(frame.current);
      view.destroy();
      viewRef.current = null;
    };
  }, [emit, nodeViews, toField, flushEmit, scheduleEmit, remeasure, setTick]);

  // وثيقةٌ جاءت من الخارج (فتحُ نموذجٍ آخر، أو حذف حقلٍ من اللوح) تحلّ في المحرّر.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || doc.blocks === ownBlocks.current) return;
    flushEmit();
    ownBlocks.current = doc.blocks;
    view.updateState(EditorState.create({ doc: blocksToPm(doc.blocks), plugins: view.state.plugins }));
    setTick((t) => t + 1);
  }, [doc.blocks, flushEmit, setTick]);

  // قيم الحقول وأسماؤها تتغيّر بلا أن تتغيّر الورقة — فتُعاد رسم الصناديق. وبالبصمة لا
  // بالمرجع: قائمة الحقول تُبنى من جديد مع كلّ حرف، وإعادة الرسم مع كلّ حرف تُربك الكتابة.
  const labelSig = useMemo(
    () => JSON.stringify([doc.fields.map((f) => [f.key, f.label]), shownValues ?? {}]),
    [doc.fields, shownValues]
  );
  // وأرقام الورقة (هندية أو عربية) تُعيد رسم علامات القوائم كما تُطبع — والمتن لم يتغيّر.
  useEffect(() => {
    const view = viewRef.current;
    if (view) view.dispatch(view.state.tr.setMeta(listMarkersKey, true).setMeta('addToHistory', false));
  }, [doc.pageSetup.numerals]);
  // والعلامات الحمراء تُرسم حين يُجرَّب الاسم الآخر وتُمحى حين يُترك.
  useEffect(() => {
    const view = viewRef.current;
    if (view) view.dispatch(view.state.tr.setMeta('trial', trying));
  }, [trying]);

  /** اقتراحاتٌ قُبلت: الوثيقة كلّها خطوةً واحدة في المحرّر — يتراجع عنها Ctrl+Z. */
  const applyDoc = (next: Doc) => {
    flushEmit();
    const view = viewRef.current;
    if (!view) return;
    const known = new Set(docRef.current.fields.map((f) => f.key));
    pendingFields.current.push(...next.fields.filter((f) => !known.has(f.key)));
    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, blocksToPm(next.blocks).content));
    view.focus();
  };
  const firstSig = useRef(labelSig);
  useEffect(() => {
    if (labelSig === firstSig.current) return;
    firstSig.current = labelSig;
    viewRef.current?.setProps({ nodeViews: nodeViews() });
  }, [labelSig, nodeViews]);

  // بعد كلّ رسم: كتابةٌ أو تنسيقٌ أو مقاسٌ أو هوامش. القياس الأوّل فوريّ، وما يليه أثناء الكتابة مؤجّل.
  const initialMeasured = useRef(false);
  useEffect(() => {
    if (!initialMeasured.current) {
      initialMeasured.current = true;
      remeasure(true);
    } else {
      remeasure(false);
    }
  });

  // تغيّر مقاس الورقة أو هوامشها أو ترقيمها يُقاس فورًا.
  useEffect(() => {
    remeasure(true);
  }, [page.w, page.h, margins.top, margins.bottom, margins.left, margins.right, repeatHead, doc.pageSetup.pageNumbers, doc.pageSetup.numerals, remeasure]);

  // والخطوط حين تكتمل، وكلّ تغيّرٍ في ارتفاع المتن لم يمرّ بالمحرّر.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const ro = new ResizeObserver(() => remeasure(true));
    ro.observe(mount);
    void document.fonts?.ready.then(() => remeasure(true));
    return () => {
      ro.disconnect();
      if (measureTimer.current) clearTimeout(measureTimer.current);
      cancelAnimationFrame(frame.current);
    };
  }, [mountRef, remeasure]);

  return { margins, run_, insertBlocks, page, toField, repeatHead, bottomMm, applyDoc };
}
