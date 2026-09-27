/**
 * لوحة الرموز: مجموعاتٌ بأسمائها، والرمز يُدرج حيث وقف المؤشّر.
 *
 * `onMouseDown` يمنع سرقة التركيز من الخانة المكتوب فيها — وإلا ضاع موضع المؤشّر
 * قبل أن يُدرج الرمز.
 */
import { useState } from 'react';
import { SYMBOL_GROUPS } from '@shared/symbols';

export default function SymbolPalette({ onPick, compact = false }: { onPick: (symbol: string) => void; compact?: boolean }) {
  const [group, setGroup] = useState(0);
  const current = SYMBOL_GROUPS[group]!;
  return (
    <div className="flex flex-col gap-space-xs" data-symbols="">
      <div className="flex flex-wrap gap-1">
        {SYMBOL_GROUPS.map((g, i) => (
          <button
            key={g.name}
            className={`h-7 px-2 rounded-full font-label-sm text-label-sm ${
              i === group ? 'bg-secondary text-on-secondary' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
            }`}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setGroup(i)}
          >
            {g.name}
          </button>
        ))}
      </div>
      <div className={`grid ${compact ? 'grid-cols-8' : 'grid-cols-10'} gap-1`}>
        {current.symbols.map((sym) => (
          <button
            key={sym}
            className="h-8 rounded bg-surface-container-low hover:bg-surface-container-high text-on-surface font-body-md text-body-md"
            data-symbol={sym}
            dir="ltr"
            title={`أدرج ${sym}`}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(sym)}
          >
            {sym}
          </button>
        ))}
      </div>
    </div>
  );
}
