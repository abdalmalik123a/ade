/**
 * ملاحظات استيراد التصميم (DESIGNS.md ٢٫١): ما صار عناصرَ، والخطوط الغائبة، و**ما لم يُنقل** من Photoshop باسم طبقته
 * (نتوءٌ، توهّجٌ، تشويهٌ غير القوس، مزجٌ…) — كلّها في لوحٍ يبقى حتى يُغلق، لا سطرها الأوّل في تنبيهٍ يمضي. كـ«ما لم يُنقل
 * من Word» (`WordLosses`).
 */
export default function ImportNotes({ where, lines, onClose }: { where: string; lines: string[]; onClose: () => void }) {
  if (!lines.length) return null;
  return (
    <div className="rounded-card border border-outline-variant bg-surface-container-lowest p-space-sm flex gap-space-sm" data-import-notes="">
      <span className="material-symbols-outlined text-[20px] text-on-surface-variant">info</span>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <span className="font-label-md text-label-md font-semibold text-on-surface">ما جرى في الاستيراد من {where}</span>
        <ul className="flex flex-col gap-0.5 font-label-sm text-label-sm text-on-surface-variant list-disc pr-4">
          {lines.map((line) => (
            <li key={line} data-import-note="">
              {line}
            </li>
          ))}
        </ul>
      </div>
      <button aria-label="أغلق" className="self-start w-7 h-7 rounded-btn hover:bg-surface-container-high flex items-center justify-center" data-act="import-notes-close" type="button" onClick={onClose}>
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
}
