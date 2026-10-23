/**
 * شريط التنسيق في محرّر الورقة (تقسيم PageEditor بعد ١٫٧٫٠) — منقولٌ منه كما هو: التراجع، والخطّ وحجمه، والعريض والمائل والتسطير
 * والشطب وأعلى السطر وأسفله واللون، والمحاذاة والتباعد والقوائم، والجدول والإدراج. عرضٌ وحده: الحال والأوامر تمرّ بأسمائها.
 */
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import { Tool, ToolSep, BASE_SIZE, OFFICIAL_INDENT_MM } from '../editorKit';
import { undo, redo } from 'prosemirror-history';
import FontSelect from '../FontSelect';
import { fontsIn } from '../../lib/fonts';
import { M, setValueMark, markActive, markValue, setParagraphAttr, paragraphValue, LINE_HEIGHTS, SPACE_AFTERS, LIST_STYLES, clearMarks } from './commands';
import { ptToPx, WORD_SIZES_PT } from '@shared/fontSize';
import { toggleMark, selectAll } from 'prosemirror-commands';
import ColorTool from '../ColorTool';
import { toggleList, setListStyle } from '@shared/docPmList';
import type { ListStyle, Align } from '@shared/doc';
import { addRowBefore, addRowAfter, deleteRow, splitCell, deleteTable } from 'prosemirror-tables';
import {
  addColumnKeepWidths,
  deleteColumnKeepWidths,
  resizeColumnBy,
  mergeCellsInRow,
  toggleTableBorders,
  toggleHeaderRow,
  toggleHeaderShading,
  setCellVAlign
} from '@shared/docPmTable';
import type { Command, EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

/**
 * تباعد الفقرة قبلها أو بعدها (S11، D139) — بالبكسل كما يُحفظ ويُطبع، والوحدة في النصّ (كانت «تباعد: ١٢» بلا وحدة).
 * وما جاء من Word بغير هذه القيم يظهر كما هو.
 */
function SpacingSelect({ side, cur, onPick }: { side: 'spaceBefore' | 'spaceAfter'; cur: number | null | undefined; onPick: (px: number | null) => void }) {
  const word = side === 'spaceBefore' ? 'قبل' : 'بعد';
  const label = (v: number) => (v === 0 ? `${word}: ٠` : `${word}: ${v} بكسل`);
  return (
    <select
      aria-label={`التباعد ${word} الفقرة`}
      className="bg-transparent font-label-md text-label-md text-on-surface tabular outline-none cursor-pointer"
      data-act={side === 'spaceBefore' ? 'paragraph-spacing-before' : 'paragraph-spacing'}
      title={`تباعد ما ${word} الفقرة — بالبكسل`}
      value={cur == null || cur === 0 ? '0' : String(cur)}
      onChange={(e) => {
        const v = Number(e.target.value);
        onPick(v > 0 ? v : null);
      }}
    >
      {SPACE_AFTERS.map((v) => (
        <option key={v} value={v}>
          {label(v)}
        </option>
      ))}
      {cur != null && cur > 0 && !SPACE_AFTERS.includes(cur as 0 | 6 | 12 | 18) && (
        <option key={cur} value={String(cur)}>
          {label(cur)}
        </option>
      )}
    </select>
  );
}

type Props = {
  run_: (cmd: Command) => boolean;
  state: EditorState | null;
  curFont: string | null;
  curPt: number;
  curAlign: Align | undefined;
  curLh: number | null | undefined;
  curIndent: unknown;
  curList: ListStyle | null;
  listLabel: (s: ListStyle) => string;
  setMenu: Dispatch<SetStateAction<boolean>>;
  all: boolean;
  toField: Command;
  table: {
    borders: boolean;
    header: boolean;
    headerShading?: boolean;
    spansRows: boolean;
    vAlign?: 'top' | 'middle' | 'bottom' | null;
  } | null;
  viewRef: MutableRefObject<EditorView | null>;
  setNotice: Dispatch<SetStateAction<string | null>>;
};

export default function FormatBar({ run_, state, curFont, curPt, curAlign, curLh, curIndent, curList, listLabel, setMenu, all, toField, table, viewRef, setNotice }: Props) {
  const curSpaceBefore = state ? (paragraphValue(state, 'spaceBefore') as number | null | undefined) : undefined;
  const curSpaceAfter = state ? (paragraphValue(state, 'spaceAfter') as number | null | undefined) : undefined;
  return (
    <div className="bg-surface-container-lowest px-space-sm py-1 flex items-center gap-0.5 flex-wrap border-b border-outline-variant/30">
      <Tool act="undo" icon="undo" title="تراجع (Ctrl+Z)" onRun={() => run_(undo)} />
      <Tool act="redo" icon="redo" title="إعادة (Ctrl+Y)" onRun={() => run_(redo)} />
      <ToolSep />
      <FontSelect
        act="font"
        blank="خطّ الورقة"
        className="h-8 w-40 rounded-lg bg-surface-container-low px-2 font-label-md text-label-md text-on-surface"
        title="الخطّ من «خطوط ديوان» — لما حُدِّد، أو لما سيُكتب"
        used={state ? fontsIn(state.doc, M.font) : []}
        value={curFont}
        onChange={(family) => run_(setValueMark(M.font, family ? { family } : null))}
      />
      <select
        aria-label="حجم الخطّ"
        className="h-8 w-16 rounded-lg bg-surface-container-low px-1 font-label-md text-label-md text-on-surface tabular"
        data-act="size"
        title="حجم الخطّ بالنقطة كما في Word — لما حُدِّد، أو لما سيُكتب"
        value={String(curPt)}
        onChange={(e) => {
          const px = ptToPx(Number(e.target.value));
          run_(setValueMark(M.size, px === BASE_SIZE ? null : { px }));
        }}
      >
        {[...new Set([...WORD_SIZES_PT, curPt])].sort((a, b) => a - b).map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <ToolSep />
      <Tool act="bold" icon="format_bold" title="عريض (Ctrl+B)" active={state ? markActive(state, M.bold) : false} onRun={() => run_(toggleMark(M.bold))} />
      <Tool act="italic" icon="format_italic" title="مائل (Ctrl+I)" active={state ? markActive(state, M.italic) : false} onRun={() => run_(toggleMark(M.italic))} />
      <Tool act="underline" icon="format_underlined" title="تحته خطّ (Ctrl+U)" active={state ? markActive(state, M.underline) : false} onRun={() => run_(toggleMark(M.underline))} />
      {/* وما كان ينقص عن Word (البند ٣): الشطب، وأعلى السطر وأسفله (لا يجتمعان)، ولون النصّ — بلا اختصاراتٍ جديدة. */}
      <Tool act="strike" icon="format_strikethrough" title="يتوسّطه خطّ" active={state ? markActive(state, M.strike) : false} onRun={() => run_(toggleMark(M.strike))} />
      <Tool act="sup" icon="superscript" title="أعلى السطر" active={state ? markActive(state, M.sup) : false} onRun={() => run_(toggleMark(M.sup))} />
      <Tool act="sub" icon="subscript" title="أسفل السطر" active={state ? markActive(state, M.sub) : false} onRun={() => run_(toggleMark(M.sub))} />
      <ColorTool value={state ? (markValue(state, M.color, 'hex') as string | null) : null} onPick={(hex) => run_(setValueMark(M.color, hex ? { hex } : null))} />
      <ToolSep />
      {(
        [
          { align: 'right', icon: 'format_align_right', title: 'محاذاة يمين' },
          { align: 'center', icon: 'format_align_center', title: 'توسيط' },
          { align: 'left', icon: 'format_align_left', title: 'محاذاة يسار' },
          { align: 'justify', icon: 'format_align_justify', title: 'ضبط الطرفين' }
        ] as const
      ).map((a) => (
        <Tool key={a.align} act={`align-${a.align}`} icon={a.icon} title={a.title} active={curAlign === a.align} onRun={() => run_(setParagraphAttr('align', a.align))} />
      ))}
      <select
        aria-label="تباعد الأسطر"
        className="h-8 w-16 rounded-lg bg-surface-container-low px-1 font-label-md text-label-md text-on-surface tabular"
        data-act="line-height"
        title="تباعد الأسطر"
        value={curLh == null ? '' : String(curLh)}
        onChange={(e) => run_(setParagraphAttr('lineHeight', e.target.value ? Number(e.target.value) : null))}
      >
        <option value="">تلقائي</option>
        {LINE_HEIGHTS.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-1 bg-surface-container-low rounded-lg px-1.5 h-8" title="تباعد الفقرة: قبلها وبعدها بالبكسل (S11)">
        <span className="material-symbols-outlined text-[18px] text-on-surface-variant pointer-events-none">format_line_spacing</span>
        <SpacingSelect side="spaceBefore" cur={curSpaceBefore} onPick={(px) => run_(setParagraphAttr('spaceBefore', px))} />
        <SpacingSelect side="spaceAfter" cur={curSpaceAfter} onPick={(px) => run_(setParagraphAttr('spaceAfter', px))} />
      </div>
      <Tool
        act="indent"
        icon="format_indent_increase"
        title="مسافة بادئة ٢ سم لأوّل السطر — كما يُكتب متن الكتاب الرسمي"
        active={Boolean(curIndent)}
        onRun={() => run_(setParagraphAttr('indent', curIndent ? null : OFFICIAL_INDENT_MM))}
      />
      <Tool act="bullets" icon="format_list_bulleted" title="تعداد نقطي" active={curList === 'bullet'} onRun={() => run_(toggleList('bullet'))} />
      <Tool act="numbers" icon="format_list_numbered" title="ترقيم" active={curList === 'number'} onRun={() => run_(toggleList('number'))} />
      <select
        aria-label="شكل الترقيم"
        className="h-8 w-24 rounded-lg bg-surface-container-low px-1 font-label-md text-label-md text-on-surface"
        data-act="list-style"
        title="شكل الترقيم — كما يُطبع، ولمستوى القائمة الذي فيه المؤشّر"
        value={curList ?? ''}
        onChange={(e) => e.target.value && run_(setListStyle(e.target.value as ListStyle))}
      >
        <option value="">شكل الترقيم</option>
        {[...LIST_STYLES, ...(curList && !LIST_STYLES.includes(curList) ? [curList] : [])].map((s) => (
          <option key={s} value={s}>
            {listLabel(s)}
          </option>
        ))}
      </select>
      <ToolSep />
      <button
        className="h-8 px-2.5 rounded-lg bg-primary-container text-on-primary font-label-sm text-label-sm font-bold flex items-center gap-1 hover:bg-primary transition-all shadow-xs"
        type="button"
        data-act="insert"
        title="إدراج جدول أو صورة أو كليشة أو فاصل صفحة"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setMenu(true)}
      >
        <span className="material-symbols-outlined text-[16px]">post_add</span>
        <span>إدراج</span>
      </button>
      <Tool act="select-all" icon="select_all" title="تحديد الكلّ (Ctrl+A)" active={all} onRun={() => run_(selectAll)}>
        <span className="font-label-sm text-label-sm">تحديد الكلّ</span>
      </Tool>
      <Tool act="clear" icon="format_clear" title="مسح التنسيق" onRun={() => run_(clearMarks)} />
      <Tool act="field" icon="data_object" title="اجعل المظلَّل خانة (F4)" onRun={() => run_(toField)}>
        <span className="font-label-sm text-label-sm">خانة</span>
      </Tool>

      {table && (
        <>
          <ToolSep />
          {/* أوامر الجدول تحفظ ما تصنعه في الوثيقة (`shared/docPmTable.ts`): الأوزان مع الأعمدة، ولا دمج رأسيّ. */}
          <Tool act="row-above" icon="add_row_above" title="صفٌّ فوق هذا" onRun={() => run_(addRowBefore)} />
          <Tool act="row-add" icon="add_row_below" title="صفٌّ تحت هذا" onRun={() => run_(addRowAfter)} />
          <Tool act="col-right" icon="add_column_right" title="عمودٌ يمين هذا — بعرضه" onRun={() => run_(addColumnKeepWidths('before'))} />
          <Tool act="col-add" icon="add_column_left" title="عمودٌ يسار هذا — بعرضه" onRun={() => run_(addColumnKeepWidths('after'))} />
          <Tool act="row-del" icon="remove_road" title="احذف الصفّ" onRun={() => run_(deleteRow)} />
          <Tool act="col-del" icon="splitscreen_left" title="احذف العمود" onRun={() => run_(deleteColumnKeepWidths)} />
          <Tool act="col-wider" icon="width_wide" title="وسّع العمود" onRun={() => run_(resizeColumnBy(0.5))} />
          <Tool act="col-narrower" icon="width_normal" title="ضيّق العمود" onRun={() => run_(resizeColumnBy(-0.5))} />
          <Tool
            act="merge"
            icon="call_merge"
            title="ادمج الخلايا المحدَّدة"
            onRun={() => run_(mergeCellsInRow)}
          />
          <Tool act="split" icon="call_split" title="افصل الخليّة" onRun={() => run_(splitCell)} />
          <Tool
            act="table-borders"
            icon={table.borders ? 'border_clear' : 'border_all'}
            title={table.borders ? 'أخفِ حدود الجدول — لجدولٍ يرتّب الرأس أو التواقيع لا يُرى' : 'أظهر حدود الجدول'}
            active={!table.borders}
            onRun={() => run_(toggleTableBorders)}
          />
          <Tool act="table-header" icon="title" title="صفّ عناوين يتكرّر في أعلى كلّ صفحة" active={table.header} onRun={() => run_(toggleHeaderRow)} />
          <Tool
            act="table-header-shading"
            icon="format_color_fill"
            title="تظليل صفّ العناوين بلون خفيف"
            active={table.headerShading}
            onRun={() => run_(toggleHeaderShading)}
          />
          <Tool
            act="cell-valign-top"
            icon="vertical_align_top"
            title="محاذاة الخليّة إلى الأعلى"
            active={table.vAlign === 'top' || table.vAlign == null}
            onRun={() => run_(setCellVAlign('top'))}
          />
          <Tool
            act="cell-valign-middle"
            icon="vertical_align_center"
            title="توسيط محتوى الخليّة عموديًّا"
            active={table.vAlign === 'middle'}
            onRun={() => run_(setCellVAlign('middle'))}
          />
          <Tool
            act="cell-valign-bottom"
            icon="vertical_align_bottom"
            title="محاذاة الخليّة إلى الأسفل"
            active={table.vAlign === 'bottom'}
            onRun={() => run_(setCellVAlign('bottom'))}
          />
          <Tool act="table-del" icon="delete" title="احذف الجدول كلّه" onRun={() => run_(deleteTable)} />
        </>
      )}
    </div>
  );
}
