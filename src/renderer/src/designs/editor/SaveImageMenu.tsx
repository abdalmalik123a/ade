/**
 * «احفظ صورة» (DESIGNS.md ١٫٨): PNG · JPG · PNG شفّافة — بجانب الطباعة وPDF، للدعوة على الواتساب والمنشور.
 */
import { useState } from 'react';

const CHOICES: { key: string; label: string; hint: string; format: 'png' | 'jpg'; transparent: boolean }[] = [
  { key: 'png', label: 'PNG', hint: 'أوضح صورة — للواتساب والطباعة', format: 'png', transparent: false },
  { key: 'jpg', label: 'JPG', hint: 'أصغر حجمًا — للإرسال السريع', format: 'jpg', transparent: false },
  { key: 'png-transparent', label: 'PNG شفّافة', hint: 'بلا خلفية — شعارٌ أو ختمٌ فوق غيره', format: 'png', transparent: true }
];

export default function SaveImageMenu({ busy, onSave }: { busy: boolean; onSave: (format: 'png' | 'jpg', transparent: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        className="h-9 px-space-md rounded-btn bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md flex items-center gap-1.5 disabled:opacity-50"
        data-act="save-image"
        disabled={busy}
        title="احفظ التصميم صورةً — للواتساب والنشر"
        type="button"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="material-symbols-outlined text-[18px]">image</span>
        احفظ صورة
      </button>
      {open && (
        <div className="absolute bottom-11 left-0 z-50 w-64 rounded-card bg-surface-container-lowest shadow-soft border border-outline-variant p-1" data-image-menu="">
          {CHOICES.map((c) => (
            <button
              key={c.key}
              className="w-full text-right rounded-btn px-space-sm py-1.5 hover:bg-surface-container-high flex flex-col"
              data-image-format={c.key}
              type="button"
              onClick={() => {
                setOpen(false);
                onSave(c.format, c.transparent);
              }}
            >
              <span className="font-label-md text-label-md text-on-surface font-semibold">{c.label}</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">{c.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
