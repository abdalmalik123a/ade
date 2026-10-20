/**
 * تذييل الورقة (القدم): سطرٌ في أسفل الورقة لعنوان المكتب والجهة وهواتفها.
 */
import { ALIGN_META } from './shared';
import type { LetterheadLayout } from '@shared/letterhead';

type Props = {
  layout: LetterheadLayout;
  onChange: (next: LetterheadLayout) => void;
};

export default function FooterOptions({ layout, onChange }: Props) {
  const footer = layout.footer ?? { show: false, text: '', align: 'center', size: 10 };
  return (
    <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col gap-space-xs" data-footer-options="">
      <label className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface cursor-pointer">
        <input
          className="w-4 h-4 accent-secondary"
          checked={footer.show}
          data-act="footer-toggle"
          type="checkbox"
          onChange={(e) => {
            onChange({ ...layout, footer: { ...footer, show: e.target.checked } });
          }}
        />
        تذييل الورقة (عنوان المكتب وهاتفه أسفل الصفحة)
      </label>

      {footer.show && (
        <div className="flex items-center gap-space-xs">
          <input
            className="flex-1 h-8 px-2 rounded bg-surface-container-lowest text-on-surface font-label-md text-label-md focus:outline-none focus:ring-1 focus:ring-secondary"
            placeholder="مثال: بغداد — شارع الرشيد | هاتف: 07701234567 | info@example.com"
            type="text"
            data-act="footer-text"
            value={footer.text}
            onChange={(e) =>
              onChange({ ...layout, footer: { ...footer, text: e.target.value } })
            }
          />
          <input
            className="w-14 h-8 px-1 rounded bg-surface-container-lowest text-on-surface text-center font-label-md text-label-md"
            min={8}
            max={24}
            type="number"
            data-act="footer-size"
            value={footer.size ?? 10}
            onChange={(e) =>
              onChange({
                ...layout,
                footer: { ...footer, size: Number(e.target.value) || 10 }
              })
            }
          />
          <div className="flex items-center gap-0.5">
            {ALIGN_META.map((a) => (
              <button
                key={a.value}
                className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                  footer.align === a.value
                    ? 'bg-surface-container-high text-on-surface'
                    : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
                title={a.title}
                type="button"
                data-act={`footer-align-${a.value}`}
                onClick={() =>
                  onChange({ ...layout, footer: { ...footer, align: a.value } })
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
