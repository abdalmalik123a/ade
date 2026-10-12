/**
 * خيارات الورقة: خطّ الترويسة، والخطّ الفاصل أسفلها، والهوامش (تقسيم مصمّم الترويسة بعد ١٫٧٫٠) — منقولٌ من `LetterheadDesigner` كما هو.
 */
import FontSelect from '../FontSelect';
import { fontFamilyOf, type LetterheadLayout } from '@shared/letterhead';

type Props = {
  layout: LetterheadLayout;
  onChange: (next: LetterheadLayout) => void;
  showPageOptions: boolean;
};

export default function PageOptions({ layout, onChange, showPageOptions }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-space-md pt-space-xs">
      <label className="flex items-center gap-space-xs font-label-sm text-label-sm text-on-surface-variant">
        الخط
        <FontSelect
          act="letterhead-font"
          className="h-8 px-2 rounded bg-surface-container-low text-on-surface font-label-md text-label-md"
          title="خطّ الترويسة كلّها — من «خطوط ديوان»"
          value={fontFamilyOf(layout.font)}
          onChange={(family) => family && onChange({ ...layout, font: family })}
        />
      </label>

      <label className="flex items-center gap-space-xs font-label-sm text-label-sm text-on-surface cursor-pointer">
        <input
          className="w-4 h-4 accent-secondary"
          checked={layout.divider}
          type="checkbox"
          onChange={(e) => onChange({ ...layout, divider: e.target.checked })}
        />
        خط فاصل أسفل الترويسة
      </label>

      {showPageOptions &&
        (['top', 'right', 'bottom', 'left'] as const).map((side) => (
          <label
            key={side}
            className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant"
          >
            {{ top: 'أعلى', right: 'يمين', bottom: 'أسفل', left: 'يسار' }[side]}
            <input
              className="w-14 h-7 px-1 rounded bg-surface-container-low text-on-surface text-center"
              min={0}
              max={60}
              type="number"
              value={layout.margins[side]}
              onChange={(e) =>
                onChange({
                  ...layout,
                  margins: { ...layout.margins, [side]: Number(e.target.value) || 0 }
                })
              }
            />
            ملم
          </label>
        ))}
    </div>
  );
}
