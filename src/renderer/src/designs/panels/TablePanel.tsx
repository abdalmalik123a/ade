/**
 * الجدول المحدَّد: صفوفه وأعمدته، وخطّه وترويسته وتقليمه وألوانه، وعناوين أعمدته ومحاذاتها وعرضها، وارتفاع صفوفه، ومحتوى
 * خلاياه (أو وسوم حقول). والعرض والارتفاع بالملّم — وكلاهما من الجار فلا يتغيّر صندوق الجدول (البند ٢، `tableSizes.ts`)،
 * ويُسحبان أيضًا على اللوحة (`TableGrips`).
 */
import { useEffect, useState } from 'react';
import type { Canvas, TableElement, TableRowStyle } from '@shared/canvas';
import {
  columnsMm,
  rowsMm,
  setColumnMm,
  setRowMm,
  withColumnAdded,
  withColumnRemoved,
  withRowAdded,
  withRowRemoved
} from '@shared/design/tableSizes';
import { toHexColor } from '../editor/kit';
import FontSelect from '../../components/FontSelect';
import { familyOf, stackOf } from '@shared/fonts';

const SMALL = 'h-7 px-2 rounded bg-surface-container-low hover:bg-surface-container-high font-label-xs text-label-xs text-on-surface';
const NUMBER = 'w-14 h-7 px-1 rounded bg-surface-container-lowest border border-outline-variant text-center tabular font-label-xs text-label-xs';
const COLOR = 'w-7 h-7 rounded border border-outline-variant bg-surface-container-lowest cursor-pointer';

/**
 * رقمٌ بالملّم يُعتمد عند ترك الخانة أو Enter — لا مع كلّ حرف، فلا يُوزَّع «١» قبل «١٢». و`null` «تلقائي»: صفوفٌ بلا ضبطٍ
 * ارتفاعها ما يرسمه المتصفّح لمحتواها، فلا يُكتب لها رقمٌ لا يطابقها.
 */
function MmInput({ value, act, title, onSet }: { value: number | null; act: string; title: string; onSet: (mm: number) => void }) {
  const shown = value === null ? '' : value.toFixed(1);
  const [text, setText] = useState(shown);
  useEffect(() => setText(shown), [shown]);
  const commit = () => {
    const mm = Number(text.replace(',', '.'));
    if (Number.isFinite(mm) && mm > 0 && (value === null || Math.abs(mm - value) >= 0.05)) onSet(mm);
    else setText(shown);
  };
  return (
    <input
      className={NUMBER}
      data-act={act}
      inputMode="decimal"
      placeholder="تلقائي"
      title={title}
      value={text}
      onBlur={commit}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
      }}
    />
  );
}

export default function TablePanel({ canvas, table, patch }: { canvas: Pick<Canvas, 'size'>; table: TableElement; patch: (p: Partial<TableElement>) => void }) {
  const widths = columnsMm(table, canvas);
  // الصفوف بلا ضبطٍ «تلقائي» — والرقم الأوّل يبدأها متساوية (`setRowMm`).
  const heights = table.rowHeights ? rowsMm(table, canvas) : null;
  /** الصفّ الظاهر: العناوين صفّه الأوّل إن ظهرت. */
  const shown = (row: number) => row + (table.hideHeader ? 0 : 1);
  return (
    <div className="space-y-space-sm pt-2 border-t border-outline-variant/60" data-table-inspector="">
      <div className="flex items-center justify-between">
        <span className="font-label-sm text-label-sm text-on-surface font-semibold">صفوف وأعمدة الجدول</span>
        <div className="flex items-center gap-1">
          <button className={SMALL} title="إضافة صف جديد" type="button" onClick={() => patch(withRowAdded(table))}>
            + صف ({table.rows.length})
          </button>
          <button
            className={`${SMALL} disabled:opacity-40`}
            title="حذف آخر صف"
            type="button"
            disabled={table.rows.length <= 1}
            onClick={() => patch(withRowRemoved(table))}
          >
            - صف
          </button>
          <button
            className={SMALL}
            title="إضافة عمود جديد — بعرض متوسّط الأعمدة، والبقيّة تفسح له"
            type="button"
            onClick={() => patch(withColumnAdded(table))}
          >
            + عمود ({table.columns.length})
          </button>
          <button
            className={`${SMALL} disabled:opacity-40`}
            title="حذف آخر عمود"
            type="button"
            disabled={table.columns.length <= 1}
            onClick={() => patch(withColumnRemoved(table))}
          >
            - عمود
          </button>
        </div>
      </div>

      {/* إعدادات المظهر والخط */}
      <div className="flex items-center gap-space-sm flex-wrap p-2 bg-surface-container-low rounded-card border border-outline-variant/60">
        <FontSelect
          act="table-font"
          blank="خطّ التصميم"
          className={SMALL}
          title="خطّ الجدول — من «خطوط ديوان»"
          value={familyOf(table.font) || null}
          onChange={(family) => patch({ font: family ? stackOf(family) : undefined })}
        />
        <label className="flex items-center gap-1 font-label-xs text-label-xs text-on-surface-variant">
          الخط
          <input className={NUMBER} inputMode="numeric" value={table.fontSize ?? 10} onChange={(e) => patch({ fontSize: Number(e.target.value) || table.fontSize })} />
          نقطة
        </label>
        <label className="flex items-center gap-1 font-label-xs text-label-xs text-on-surface-variant">
          الترويسة
          <input className={NUMBER} inputMode="numeric" value={table.headerFontSize ?? 11} onChange={(e) => patch({ headerFontSize: Number(e.target.value) || table.headerFontSize })} />
        </label>
        <label className="flex items-center gap-1 font-label-xs text-label-xs text-on-surface-variant cursor-pointer">
          <input type="checkbox" checked={table.stripe ?? false} onChange={(e) => patch({ stripe: e.target.checked })} />
          تخطيط مقلم
        </label>
        <div className="flex items-center gap-1 font-label-xs text-label-xs text-on-surface-variant">
          <span>الترويسة</span>
          <input type="color" className={COLOR} value={toHexColor(table.headerBg ?? '#f1f5f9')} onChange={(e) => patch({ headerBg: e.target.value })} />
        </div>
        <div className="flex items-center gap-1 font-label-xs text-label-xs text-on-surface-variant">
          <span>الحدود</span>
          <input type="color" className={COLOR} value={toHexColor(table.borderColor ?? '#cbd5e1')} onChange={(e) => patch({ borderColor: e.target.value })} />
        </div>
      </div>

      {/* الحدود والعناوين (DESIGNS.md ١٫٩): جدول المنيو بأسطرٍ وحدها، والفاتورة اليدوية بلا عناوين إن شاء. */}
      <div className="flex items-center gap-space-sm flex-wrap font-label-xs text-label-xs text-on-surface-variant">
        <select className={`${SMALL} border border-outline-variant`} data-act="table-borders" title="حدود الجدول" value={table.borders ?? 'all'} onChange={(e) => patch({ borders: e.target.value === 'all' ? undefined : (e.target.value as 'rows' | 'none') })}>
          <option value="all">حدودٌ كاملة</option>
          <option value="rows">أسطرٌ أفقية</option>
          <option value="none">بلا حدود</option>
        </select>
        <label className="flex items-center gap-1 cursor-pointer">
          <input checked={!table.hideHeader} data-act="table-header" type="checkbox" onChange={(e) => patch({ hideHeader: e.target.checked ? undefined : true })} />
          صفّ العناوين
        </label>
        <label className="flex items-center gap-1 cursor-pointer" title="حشوٌ أقلّ وسطرٌ أضيق — فيسع الجدول الطويل صندوقه">
          <input checked={Boolean(table.dense)} data-act="table-dense" type="checkbox" onChange={(e) => patch({ dense: e.target.checked ? true : undefined })} />
          صفوف متقاربة
        </label>
      </div>

      {/* العرض والارتفاع (البند ٢): بالملّم من الجار، و«متساوية» تعيدها كما يُرسم الجدول بلا ضبط. */}
      <div className="flex items-center gap-space-sm flex-wrap font-label-xs text-label-xs text-on-surface-variant">
        <span>العرض والارتفاع بالملّم — ويُسحب حدّ العمود والصفّ على اللوحة</span>
        <button className={SMALL} data-act="table-even-cols" type="button" onClick={() => patch({ columns: table.columns.map((c) => ({ ...c, widthPercent: Math.round(10000 / table.columns.length) / 100 })) })}>
          أعمدة متساوية
        </button>
        <button className={`${SMALL} disabled:opacity-40`} data-act="table-even-rows" disabled={!table.rowHeights} type="button" onClick={() => patch({ rowHeights: undefined, headerHeight: undefined })}>
          صفوف متساوية
        </button>
        {!table.hideHeader && (
          <label className="flex items-center gap-1">
            صفّ العناوين
            <MmInput act="table-header-height" title="ارتفاع صفّ العناوين بالملّم" value={heights?.[0] ?? null} onSet={(mm) => patch(setRowMm(table, canvas, 0, mm))} />
          </label>
        )}
      </div>

      {/* تعديل عناوين الأعمدة */}
      <div className="space-y-1">
        <span className="font-label-xs text-label-xs text-on-surface-variant font-semibold">عناوين الأعمدة:</span>
        <div className="grid gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-surface-container-low rounded-card border border-outline-variant/60">
          {table.columns.map((col, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <span className="font-label-xs text-label-xs text-on-surface-variant w-4 text-center">{idx + 1}</span>
              <input
                className="flex-1 h-7 px-2 rounded bg-surface-container-lowest border border-outline-variant font-label-xs text-label-xs text-on-surface"
                value={col.title}
                placeholder={`عمود ${idx + 1}`}
                onChange={(e) => {
                  const nextCols = [...table.columns];
                  nextCols[idx] = { ...col, title: e.target.value };
                  patch({ columns: nextCols });
                }}
              />
              <select
                className="h-7 px-1 rounded bg-surface-container-lowest border border-outline-variant font-label-xs text-label-xs text-on-surface"
                value={col.align ?? 'center'}
                onChange={(e) => {
                  const nextCols = [...table.columns];
                  nextCols[idx] = { ...col, align: e.target.value as 'right' | 'center' | 'left' };
                  patch({ columns: nextCols });
                }}
              >
                <option value="right">يمين</option>
                <option value="center">وسط</option>
                <option value="left">يسار</option>
              </select>
              <MmInput act={`table-col-width-${idx}`} title="عرض العمود بالملّم — من جاره" value={widths[idx]!} onSet={(mm) => patch(setColumnMm(table, canvas, idx, mm))} />
            </div>
          ))}
        </div>
      </div>

      {/* تعديل خلايا الصفوف */}
      <div className="space-y-1">
        <span className="font-label-xs text-label-xs text-on-surface-variant font-semibold">محتويات الخلايا (أو وسوم مثل {'{الاسم}'}):</span>
        <div className="max-h-48 overflow-auto p-1.5 bg-surface-container-low rounded-card border border-outline-variant/60 space-y-1">
          {table.rows.map((row, rIdx) => (
            <div key={rIdx} className="flex items-center gap-1">
              <span className="font-label-xs text-label-xs text-on-surface-variant w-4 text-center">{rIdx + 1}</span>
              <MmInput act={`table-row-height-${rIdx}`} title="ارتفاع الصفّ بالملّم — من جاره" value={heights?.[shown(rIdx)] ?? null} onSet={(mm) => patch(setRowMm(table, canvas, shown(rIdx), mm))} />
              <RowStyle table={table} index={rIdx} patch={patch} />
              {row.map((cell, cIdx) => (
                <input
                  key={cIdx}
                  className="flex-1 min-w-[50px] h-7 px-1.5 rounded bg-surface-container-lowest border border-outline-variant font-label-xs text-label-xs text-on-surface"
                  value={cell.text}
                  placeholder={table.columns[cIdx]?.title || `خ ${cIdx + 1}`}
                  onChange={(e) => {
                    const nextRows = table.rows.map((r, ri) => (ri === rIdx ? r.map((c, ci) => (ci === cIdx ? { ...c, text: e.target.value } : c)) : r));
                    patch({ rows: nextRows });
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** لون الصفّ وعريضه (١٫٩) — يوم الإمساكية الحاضر، وصفّ المجموع. */
function RowStyle({ table, index, patch }: { table: TableElement; index: number; patch: (p: Partial<TableElement>) => void }) {
  const style = table.rowStyles?.[index] ?? null;
  const set = (next: TableRowStyle | null) => {
    const all = Array.from({ length: table.rows.length }, (_, i) => (i === index ? next : (table.rowStyles?.[i] ?? null)));
    patch({ rowStyles: all.some(Boolean) ? all : undefined });
  };
  return (
    <span className="flex items-center gap-0.5 shrink-0">
      <input
        className="w-6 h-6 rounded border border-outline-variant cursor-pointer"
        data-row-bg={index}
        title="لون الصفّ"
        type="color"
        value={toHexColor(style?.bg ?? '#ffffff')}
        onChange={(e) => set({ ...style, bg: e.target.value })}
      />
      <button
        className={`w-6 h-6 rounded font-bold text-[11px] ${style?.bold ? 'bg-primary-fixed text-primary' : 'bg-surface-container-lowest border border-outline-variant'}`}
        data-row-bold={index}
        title="صفٌّ عريض"
        type="button"
        onClick={() => set({ ...style, bold: style?.bold ? undefined : true })}
      >
        ع
      </button>
      {style && (
        <button className="w-5 h-6 text-on-surface-variant hover:text-error" data-row-clear={index} title="بلا لونٍ ولا عرض" type="button" onClick={() => set(null)}>
          ×
        </button>
      )}
    </span>
  );
}
