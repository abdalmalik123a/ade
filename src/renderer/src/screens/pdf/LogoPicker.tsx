/**
 * «شعار أو صورة» في محرّر PDF (تقسيم الشاشة بعد ١٫٧٫٠) — منقولٌ من `PdfScreen` كما هو.
 */
import type { Dispatch, SetStateAction } from 'react';

type Props = {
  setLogoPicker: Dispatch<SetStateAction<string[] | null>>;
  logoPicker: string[];
  placeLogo: (src: string) => void;
  btn: 'h-9 px-space-sm rounded-btn bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md flex items-center gap-1 disabled:opacity-40';
  logoFromDevice: () => Promise<void>;
};

export default function LogoPicker({ setLogoPicker, logoPicker, placeLogo, btn, logoFromDevice }: Props) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim/50" data-pdf-logos="" onClick={() => setLogoPicker(null)}>
      <div className="w-[560px] max-h-[70vh] rounded-card bg-surface-container-lowest p-space-md flex flex-col gap-space-sm" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-headline-sm text-headline-sm">شعار أو صورة</h2>
        <div className="flex-1 overflow-y-auto grid grid-cols-4 gap-space-xs">
          {logoPicker.map((src) => (
            <button key={src} className="aspect-square rounded-btn border border-outline-variant bg-white p-1 hover:border-secondary" data-pdf-logo={src} type="button" onClick={() => placeLogo(src)}>
              <img alt="" className="w-full h-full object-contain" src={`diwan://store/${src}`} />
            </button>
          ))}
          {!logoPicker.length && <p className="col-span-4 font-label-md text-label-md text-on-surface-variant">لا شعارات محفوظة بعد — أضف واحدًا من الجهاز فيُحفظ للمرّات القادمة.</p>}
        </div>
        <button className={`${btn} justify-center`} data-act="pdf-logo-device" type="button" onClick={() => void logoFromDevice()}>
          <span className="material-symbols-outlined text-[18px]">upload</span>من الجهاز…
        </button>
      </div>
    </div>
  );
}
