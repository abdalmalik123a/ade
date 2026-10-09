/**
 * الجدول المحدَّد: صفوفه وأعمدته، وخطّه وترويسته وتقليمه وألوانه، وعناوين أعمدته ومحاذاتها، ومحتوى خلاياه (أو وسوم حقول).
 */
import type { TableElement } from '@shared/canvas';
import { toHexColor } from '../editor/kit';
import FontSelect from '../../components/FontSelect';
import { familyOf, stackOf } from '@shared/fonts';

const SMALL = 'h-7 px-2 rounded bg-surface-container-low hover:bg-surface-container-high font-label-xs text-label-xs text-on-surface';
const NUMBER = 'w-14 h-7 px-1 rounded bg-surface-container-lowest border border-outline-variant text-center tabular font-label-xs text-label-xs';
const COLOR = 'w-7 h-7 rounded border border-outline-variant bg-surface-container-lowest cursor-pointer';

export default function TablePanel({ table, patch }: { table: TableElement; patch: (p: Partial<TableElement>) => void }) {
  return (
    <div className="space-y-space-sm pt-2 border-t border-outline-variant/60" data-table-inspector="">
      <div className="flex items-center justify-between">
        <span className="font-label-sm text-label-sm text-on-surface font-semibold">صفوف وأعمدة الجدول</span>
        <div className="flex items-center gap-1">
          <button className={SMALL} title="إضافة صف جديد" type="button" onClick={() => patch({ rows: [...table.rows, table.columns.map(() => ({ text: '' }))] })}>
            + صف ({table.rows.length})
          </button>
          <button className={`${SMALL} disabled:opacity-40`} title="حذف آخر صف" type="button" disabled={table.rows.length <= 1} onClick={() => patch({ rows: table.rows.slice(0, -1) })}>
            - صف
          </button>
          <button
            className={SMALL}
            title="إضافة عمود جديد"
            type="button"
            onClick={() =>
              patch({
                columns: [...table.columns, { title: 'عمود', widthPercent: 20, align: 'center' as const }],
                rows: table.rows.map((r) => [...r, { text: '' }])
              })
            }
          >
            + عمود ({table.columns.length})
          </button>
          <button
            className={`${SMALL} disabled:opacity-40`}
            title="حذف آخر عمود"
            type="button"
            disabled={table.columns.length <= 1}
            onClick={() => patch({ columns: table.columns.slice(0, -1), rows: table.rows.map((r) => r.slice(0, -1)) })}
          >
            - عمود
          </button>
        </div>
      </div>

      {/* إعدادات المظهر والخط */}
      <div className="flex items-center gap-space-sm flex-wrap p-2 bg-surface-container-low rounded-lg border border-outline-variant/60">
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

      {/* تعديل عناوين الأعمدة */}
      <div className="space-y-1">
        <span className="font-label-xs text-label-xs text-on-surface-variant font-semibold">عناوين الأعمدة:</span>
        <div className="grid gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-surface-container-low rounded-lg border border-outline-variant/60">
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
            </div>
          ))}
        </div>
      </div>

      {/* تعديل خلايا الصفوف */}
      <div className="space-y-1">
        <span className="font-label-xs text-label-xs text-on-surface-variant font-semibold">محتويات الخلايا (أو وسوم مثل {'{الاسم}'}):</span>
        <div className="max-h-48 overflow-auto p-1.5 bg-surface-container-low rounded-lg border border-outline-variant/60 space-y-1">
          {table.rows.map((row, rIdx) => (
            <div key={rIdx} className="flex items-center gap-1">
              <span className="font-label-xs text-label-xs text-on-surface-variant w-4 text-center">{rIdx + 1}</span>
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
