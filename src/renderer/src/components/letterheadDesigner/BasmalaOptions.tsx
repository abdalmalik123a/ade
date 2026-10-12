/**
 * البسملة: سطرٌ فوق الأقسام كلّها، ومطفأةٌ في الأصل — نصّها وحجمها ومحاذاتها (تقسيم مصمّم الترويسة بعد ١٫٧٫٠) — منقولٌ من `LetterheadDesigner` كما هو.
 */
import { ALIGN_META } from './shared';
import type { LetterheadLayout } from '@shared/letterhead';

type Props = {
  layout: LetterheadLayout;
  onChange: (next: LetterheadLayout) => void;
  adoptBasmala: () => Promise<void>;
  basmalaNote: boolean;
};

export default function BasmalaOptions({ layout, onChange, adoptBasmala, basmalaNote }: Props) {
  return (
    <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col gap-space-xs">
      <label className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface cursor-pointer">
        <input
          className="w-4 h-4 accent-secondary"
          checked={layout.basmala.show}
          data-act="basmala"
          type="checkbox"
          onChange={(e) => {
            onChange({ ...layout, basmala: { ...layout.basmala, show: e.target.checked } });
            if (e.target.checked) void adoptBasmala();
          }}
        />
        البسملة فوق الترويسة
      </label>
      {basmalaNote && (
        <span className="font-label-sm text-label-sm text-on-surface-variant" data-basmala-note="">
          صارت البسملة تفضيل المكتب: كل ترويسةٍ جديدة تبدأ بها — وتُطفأ من الإعدادات.
        </span>
      )}

      {layout.basmala.show && (
        <div className="flex items-center gap-space-xs">
          <input
            className="flex-1 h-8 px-2 rounded bg-surface-container-lowest text-on-surface font-label-md text-label-md focus:outline-none focus:ring-1 focus:ring-secondary"
            type="text"
            value={layout.basmala.text}
            onChange={(e) =>
              onChange({ ...layout, basmala: { ...layout.basmala, text: e.target.value } })
            }
          />
          <input
            className="w-14 h-8 px-1 rounded bg-surface-container-lowest text-on-surface text-center font-label-md text-label-md"
            min={8}
            max={40}
            type="number"
            value={layout.basmala.size}
            onChange={(e) =>
              onChange({
                ...layout,
                basmala: { ...layout.basmala, size: Number(e.target.value) || 14 }
              })
            }
          />
          <div className="flex items-center gap-0.5">
            {ALIGN_META.map((a) => (
              <button
                key={a.value}
                className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                  layout.basmala.align === a.value
                    ? 'bg-surface-container-high text-on-surface'
                    : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
                title={a.title}
                type="button"
                onClick={() =>
                  onChange({ ...layout, basmala: { ...layout.basmala, align: a.value } })
                }
              >
                <span className="material-symbols-outlined text-[16px]">{a.icon}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
