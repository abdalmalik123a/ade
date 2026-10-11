/**
 * حدود الجدول المحدَّد على اللوحة (محادثة «التصاميم»، البند ٢): بين كلّ عمودين وكلّ صفّين مقبضٌ يُسحب كما في Word، فيتقاسم
 * الجاران العرض أو الارتفاع ولا يتغيّر صندوق الجدول. والأعمدة من أوزانها، والصفوف تُقاس من الجدول المرسوم نفسه — بأوزانها إن
 * ضُبطت، أو بارتفاعها الطبيعي فيبدأ السحب منه بلا قفزة.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import type { TableElement } from '@shared/canvas';
import { rowWeights, visibleRows } from '@shared/design/tableSizes';

type Start = (e: React.MouseEvent, axis: 'col' | 'row', border: number, start: number[], size: number, sign: number) => void;

/** الجدول المرسوم الذي يطابق صندوقُه صندوقَ المقبض — على الشاشة بتكبيرها. */
function paintedTable(handle: HTMLElement): HTMLTableElement | null {
  const r = handle.getBoundingClientRect();
  const near = (a: number, b: number) => Math.abs(a - b) < 2;
  const tables = [...(handle.closest('[data-design]')?.querySelectorAll('table') ?? [])];
  return (
    tables.find((t) => {
      const b = t.parentElement?.getBoundingClientRect();
      return b && near(b.left, r.left) && near(b.top, r.top) && near(b.width, r.width) && near(b.height, r.height);
    }) ?? null
  );
}

export default function TableGrips({ el, html, onStart }: { el: TableElement; html: string; onStart: Start }) {
  const ref = useRef<HTMLDivElement>(null);
  /** ارتفاع كلّ صفٍّ ظاهرٍ كما رُسم — على الشاشة. */
  const [rowPx, setRowPx] = useState<number[]>([]);

  useLayoutEffect(() => {
    const handle = ref.current?.parentElement;
    const table = handle ? paintedTable(handle) : null;
    setRowPx(table ? [...table.rows].map((tr) => tr.getBoundingClientRect().height) : []);
  }, [el, html]);

  const rect = () => ref.current?.parentElement?.getBoundingClientRect();
  const total = el.columns.reduce((a, c) => a + c.widthPercent, 0) || 1;
  const rtl = (el.dir ?? 'rtl') === 'rtl';
  const cols = el.columns.slice(0, -1).map((_, i) => (el.columns.slice(0, i + 1).reduce((a, c) => a + c.widthPercent, 0) * 100) / total);
  const rowsSum = rowPx.reduce((a, b) => a + b, 0) || 1;
  const rows = rowPx.length === visibleRows(el) ? rowPx.slice(0, -1).map((_, i) => (rowPx.slice(0, i + 1).reduce((a, b) => a + b, 0) * 100) / rowsSum) : [];

  return (
    <div ref={ref} className="absolute inset-0 pointer-events-none" data-table-grips="">
      {cols.map((at, i) => (
        <div
          key={`c${i}`}
          className="absolute top-0 bottom-0 w-[7px] pointer-events-auto cursor-col-resize hover:bg-primary/40"
          data-table-grip={`col-${i + 1}`}
          style={rtl ? { right: `calc(${at}% - 3.5px)` } : { left: `calc(${at}% - 3.5px)` }}
          title="اسحب لتغيير عرض العمودين"
          onMouseDown={(e) => onStart(e, 'col', i + 1, el.columns.map((c) => c.widthPercent), rect()?.width ?? 0, rtl ? -1 : 1)}
        />
      ))}
      {rows.map((at, i) => (
        <div
          key={`r${i}`}
          className="absolute left-0 right-0 h-[7px] pointer-events-auto cursor-row-resize hover:bg-primary/40"
          data-table-grip={`row-${i + 1}`}
          style={{ top: `calc(${at}% - 3.5px)` }}
          title="اسحب لتغيير ارتفاع الصفّين"
          onMouseDown={(e) => onStart(e, 'row', i + 1, rowWeights(el) ?? rowPx, rect()?.height ?? 0, 1)}
        />
      ))}
    </div>
  );
}
