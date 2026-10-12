/**
 * معاينة الترويسة على ورقة A4 حقيقية (تقسيم شاشتها بعد ١٫٧٫٠) — منقولةٌ من `LetterheadScreen` كما هي.
 */
import { mmToPx, isLayoutEmpty, type LetterheadLayout } from '@shared/letterhead';
import LetterheadView from '../../components/LetterheadView';

type Props = {
  layout: LetterheadLayout;
};

export default function LetterheadPreview({ layout }: Props) {
  return (
    <div className="flex-1 h-full overflow-auto bg-surface-dim/40 flex flex-col items-center py-space-xl">
      <div className="a4-sheet bg-surface-container-lowest shadow-[0_1px_3px_rgba(15,23,42,0.06),0_16px_32px_-4px_rgba(15,23,42,0.08)] shrink-0">
        <div
          style={{
            paddingTop: mmToPx(layout.margins.top),
            paddingRight: mmToPx(layout.margins.right),
            paddingBottom: mmToPx(layout.margins.bottom),
            paddingLeft: mmToPx(layout.margins.left)
          }}
        >
          <LetterheadView
            layout={layout}
            emptyHint="منطقة الترويسة فارغة — كل ما تضيفه يظهر هنا بمقاسه الحقيقي"
          />

          {!isLayoutEmpty(layout) && (
            <div className="mt-space-xl space-y-space-md opacity-30 select-none">
              <div className="h-3 bg-surface-container-high rounded w-1/3" />
              <div className="h-2 bg-surface-container-high rounded" />
              <div className="h-2 bg-surface-container-high rounded" />
              <div className="h-2 bg-surface-container-high rounded w-4/5" />
            </div>
          )}
        </div>
      </div>
      <span className="mt-space-sm font-label-sm text-label-sm text-on-surface-variant">
        ورقة A4 بمقاسها الحقيقي — 210×297 ملم
      </span>
    </div>
  );
}
