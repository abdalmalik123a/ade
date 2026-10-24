/**
 * العدد والتاريخ: موضعهما القسم الأخير، وهما اختياريان — فراغٌ يُملأ باليد أو مطبوعان (تقسيم مصمّم الترويسة بعد ١٫٧٫٠) — منقولٌ من `LetterheadDesigner` كما هو.
 */
import type { LetterheadLayout } from '@shared/letterhead';

type Props = {
  layout: LetterheadLayout;
  onChange: (next: LetterheadLayout) => void;
};

export default function RegistryOptions({ layout, onChange }: Props) {
  return (
    <div className="p-space-sm rounded-card bg-surface-container-low flex flex-col gap-space-xs">
      <label className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface cursor-pointer">
        <input
          className="w-4 h-4 accent-secondary"
          checked={layout.registry.show}
          type="checkbox"
          onChange={(e) =>
            onChange({ ...layout, registry: { ...layout.registry, show: e.target.checked } })
          }
        />
        إظهار التاريخ والعدد في {layout.columns === 1 ? 'الترويسة' : 'القسم الأخير'}
      </label>

      {layout.registry.show && (
        <div className="flex items-center gap-1 bg-surface-container-lowest p-1 rounded-card">
          {(
            [
              { value: 'manual', label: 'فراغ يُملأ باليد', hint: 'يكتبهما موظّف الاستلام' },
              { value: 'printed', label: 'مطبوعان', hint: 'من الصادر' }
            ] as const
          ).map((c) => (
            <button
              key={c.value}
              className={`flex-1 h-9 rounded font-label-sm text-label-sm transition-colors flex flex-col items-center justify-center leading-tight ${
                layout.registry.mode === c.value
                  ? 'bg-primary-fixed text-primary font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
              type="button"
              onClick={() => onChange({ ...layout, registry: { ...layout.registry, mode: c.value } })}
            >
              <span>{c.label}</span>
              <span className="text-[10px] opacity-80">{c.hint}</span>
            </button>
          ))}
        </div>
      )}
      <span className="font-label-sm text-label-sm text-on-surface-variant">
        التاريخ فوق العدد. والكتاب يُقيَّد في الأرشيف برقمه في الحالين — الاختيار في ما
        يُطبع على الورقة فقط.
      </span>
    </div>
  );
}
