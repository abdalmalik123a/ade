import { useState } from 'react';
import { validatePreset, type PhotoPreset } from '@shared/photoPresets';
import { errorText } from '../lib/errors';
import { toIndic } from '@shared/arabic';
import { useEscape } from '../kit/useEscape';

/** قوالب المكتب: ما تطلبه جهاته من مقاسٍ ودقّةٍ وخلفيةٍ ودليل رأس — تُحفظ وتُحذف. */
export default function PresetsDialog({
  presets,
  onSave,
  onDelete,
  onClose
}: {
  presets: PhotoPreset[];
  onSave: (p: PhotoPreset) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  useEscape(onClose);
  const [draft, setDraft] = useState<PhotoPreset>({
    id: '',
    name: '',
    widthMm: 35,
    heightMm: 45,
    dpi: 600,
    background: { kind: 'white' },
    head: { min: 0.6, max: 0.75, top: 0.1 },
    copies: 6,
    notes: '',
    source: null,
    builtin: false
  });
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<PhotoPreset>) => setDraft((d) => ({ ...d, ...patch }));
  const num = (v: string) => Number(v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))) || 0;
  const field = 'input-field h-9 px-2 font-label-md text-label-md';

  async function save() {
    const p = { ...draft, id: draft.id || `preset-${Date.now().toString(36)}`, name: draft.name.trim(), source: draft.source?.trim() || null };
    const why = validatePreset(p);
    if (why) return setError(why);
    try {
      await onSave(p);
    } catch (e) {
      setError(errorText(e, 'تعذّر حفظ القالب'));
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim/50 p-space-md" data-presets-dialog="">
      <div className="w-full max-w-xl max-h-[85vh] overflow-auto surface-panel p-space-lg space-y-space-md">
        <div className="flex items-center justify-between">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">قوالب المكتب</h2>
          <button className="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high" type="button" onClick={onClose}>
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        {presets.length > 0 && (
          <div className="divide-y divide-outline-variant">
            {presets.map((p) => (
              <div key={p.id} className="py-space-xs flex items-center justify-between font-label-md text-label-md">
                <span>
                  {p.name} — {toIndic(p.widthMm)}×{toIndic(p.heightMm)} ملم، {toIndic(p.dpi)} نقطة
                </span>
                <button className="h-8 px-2 rounded-btn text-error hover:bg-error-container" type="button" onClick={() => void onDelete(p.id)}>
                  احذف
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-space-sm font-label-sm text-label-sm text-on-surface-variant">
          <label className="col-span-2 flex flex-col gap-1">
            الاسم (ما تطلبه الجهة)
            <input autoFocus className={field} data-preset-name="" value={draft.name} onChange={(e) => set({ name: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            العرض (ملم)
            <input className={field} data-preset-w="" value={draft.widthMm} onChange={(e) => set({ widthMm: num(e.target.value) })} />
          </label>
          <label className="flex flex-col gap-1">
            الارتفاع (ملم)
            <input className={field} data-preset-h="" value={draft.heightMm} onChange={(e) => set({ heightMm: num(e.target.value) })} />
          </label>
          <label className="flex flex-col gap-1">
            الدقّة (نقطة في الإنش)
            <select className={field} value={draft.dpi} onChange={(e) => set({ dpi: Number(e.target.value) })}>
              {[300, 400, 600].map((d) => (
                <option key={d} value={d}>
                  {toIndic(d)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            النسخ في الطلب
            <input className={field} value={draft.copies} onChange={(e) => set({ copies: num(e.target.value) })} />
          </label>
          <label className="col-span-2 flex flex-col gap-1">
            الخلفية
            <span className="flex items-center gap-space-xs">
              <select
                className={`${field} flex-1`}
                value={draft.background.kind}
                onChange={(e) =>
                  set({ background: e.target.value === 'custom' ? { kind: 'custom', color: '#e6e6e6' } : { kind: e.target.value as 'white' | 'lightBlue' } })
                }
              >
                <option value="white">أبيض</option>
                <option value="lightBlue">أزرق فاتح</option>
                <option value="custom">لونٌ آخر</option>
              </select>
              {draft.background.kind === 'custom' && (
                <input className="w-10 h-9" type="color" value={draft.background.color} onChange={(e) => set({ background: { kind: 'custom', color: e.target.value } })} />
              )}
            </span>
          </label>
          <label className="col-span-2 flex items-center gap-space-xs">
            <input checked={Boolean(draft.head)} type="checkbox" onChange={(e) => set({ head: e.target.checked ? { min: 0.6, max: 0.75, top: 0.1 } : null })} />
            دليل الرأس (من الذقن إلى قمّة الرأس، نسبةً من ارتفاع الصورة)
          </label>
          {draft.head && (
            <div className="col-span-2 flex items-center gap-space-xs">
              من
              <input className={`${field} w-16`} value={Math.round(draft.head.min * 100)} onChange={(e) => set({ head: { ...draft.head!, min: num(e.target.value) / 100 } })} />
              إلى
              <input className={`${field} w-16`} value={Math.round(draft.head.max * 100)} onChange={(e) => set({ head: { ...draft.head!, max: num(e.target.value) / 100 } })} />
              ٪، وقمّة الرأس على
              <input className={`${field} w-16`} value={Math.round(draft.head.top * 100)} onChange={(e) => set({ head: { ...draft.head!, top: num(e.target.value) / 100 } })} />
              ٪ من الأعلى
            </div>
          )}
          <label className="col-span-2 flex flex-col gap-1">
            ملاحظات
            <input className={field} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
          </label>
          <label className="col-span-2 flex flex-col gap-1">
            المصدر المنشور (إن وُجد — بدونه لا يُسمّى القالب رسميًّا)
            <input className={field} value={draft.source ?? ''} onChange={(e) => set({ source: e.target.value })} />
          </label>
        </div>
        {error && <p className="font-label-md text-label-md text-error">{error}</p>}
        <div className="flex justify-end gap-space-sm">
          <button className="h-10 px-space-md rounded-btn text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md" type="button" onClick={onClose}>
            إلغاء
          </button>
          <button className="h-10 px-space-lg btn-act font-label-md text-label-md font-bold" data-act="save-preset" type="button" onClick={() => void save()}>
            احفظ القالب
          </button>
        </div>
      </div>
    </div>
  );
}
