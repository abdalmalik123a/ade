/**
 * الإطار الواحد للأداة (خطّة الترقية، المرحلة ٥ — ن٢ ون٩): رأسٌ فيه الرجوع إلى الشبّاك واسم الأداة
 * والزبون إن جاء منه و«شيءٌ آخر لنفس الزبون»، وشريط إخراجٍ في أسفل الخطوات: الطابعة مكتوبةً قبل
 * «اطبع»، وبعد الطبع ما خرج وأين. فالصور وPDF والأسئلة والتصاميم تُقرأ كلّها بنظرةٍ واحدة.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { PrintRoleKey, PrintRoles } from '@shared/printRoles';
import { AfterPrint, PrinterNote, type Outcome } from './OutputBar';

export type ToolNav = {
  /** الزبون الذي فُتحت له الأداة من الشبّاك — أو لا أحد (فُتحت من السكّة). */
  customer: { id: number; name: string } | null;
  printRoles: PrintRoles | null;
  /** إلى الشبّاك كما تُرك. */
  back: () => void;
  /** إلى الشبّاك بالزبون نفسه: يختار ما يريده بعدُ وحقوله تُملأ من ملفّه. */
  sameCustomer: () => void;
};

const Ctx = createContext<ToolNav>({ customer: null, printRoles: null, back: () => undefined, sameCustomer: () => undefined });

export const ToolNavProvider = Ctx.Provider;

export function useToolNav(): ToolNav {
  return useContext(Ctx);
}

/** اسم الزبون من ملفّه — يُجلب مرّةً حين تُفتح الأداة له. */
export function useCustomerName(id: number | null): string {
  const [name, setName] = useState('');
  useEffect(() => {
    let live = true;
    setName('');
    if (id !== null) void window.diwan.citizens.get(id).then((c) => live && setName(c?.fullName ?? ''));
    return () => {
      live = false;
    };
  }, [id]);
  return name;
}

/** رأس الأداة: «الشبّاك» رجوعًا، واسمها وما تفعله، والزبون إن جاءت له. و`bar` لأداةٍ شريطُها أفقيّ (PDF). */
export function ToolHeader({ icon, title, hint, bar, children }: { icon: string; title: string; hint?: string; bar?: boolean; children?: ReactNode }) {
  const nav = useToolNav();
  if (bar)
    return (
      <div className="flex items-center gap-space-xs" data-tool-header="">
        <button
          className="h-9 px-2 rounded-lg flex items-center gap-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-label-md text-label-md"
          data-act="tool-back"
          title="إلى الشبّاك — كما تركته"
          type="button"
          onClick={nav.back}
        >
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          الشبّاك
        </button>
        <span className="material-symbols-outlined text-[20px] text-secondary">{icon}</span>
        <h1 className="font-label-lg text-label-lg text-on-surface font-bold whitespace-nowrap">{title}</h1>
        {nav.customer && (
          <span className="flex items-center gap-1 h-8 ps-2 rounded-lg bg-surface-container-lowest font-label-sm text-label-sm" data-tool-customer={nav.customer.id}>
            <span className="material-symbols-outlined text-[16px] text-secondary">person</span>
            <span className="max-w-[10rem] truncate">{nav.customer.name || '…'}</span>
            <button className="h-8 px-2 rounded-lg text-secondary hover:bg-surface-container-high font-semibold" data-act="tool-same-customer" type="button" onClick={nav.sameCustomer}>
              شيءٌ آخر له
            </button>
          </span>
        )}
        {children}
      </div>
    );
  return (
    <header className="space-y-space-xs" data-tool-header="">
      <div className="flex items-center gap-space-xs">
        <button
          className="h-8 px-2 -ms-2 rounded-lg flex items-center gap-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-label-md text-label-md"
          data-act="tool-back"
          title="إلى الشبّاك — كما تركته"
          type="button"
          onClick={nav.back}
        >
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          الشبّاك
        </button>
        <span className="flex-1" />
        {children}
      </div>
      <div className="flex items-center gap-space-sm">
        <span className="icon-tile w-10 h-10 shrink-0 rounded-lg bg-secondary-fixed text-secondary flex items-center justify-center">
          <span className="material-symbols-outlined text-[22px]">{icon}</span>
        </span>
        <div className="min-w-0">
          <h1 className="font-headline-sm text-headline-sm text-on-surface font-bold truncate">{title}</h1>
          {hint && <p className="font-label-sm text-label-sm text-on-surface-variant">{hint}</p>}
        </div>
      </div>
      {nav.customer && (
        <div className="flex items-center gap-space-xs p-space-xs ps-space-sm rounded-lg bg-surface-container-lowest" data-tool-customer={nav.customer.id}>
          <span className="material-symbols-outlined text-[18px] text-secondary">person</span>
          <span className="flex-1 min-w-0 truncate font-label-md text-label-md text-on-surface">
            للزبون <span className="font-semibold">{nav.customer.name || '…'}</span>
          </span>
          <button
            className="h-8 px-2 rounded-lg text-secondary hover:bg-surface-container-high font-label-sm text-label-sm font-semibold"
            data-act="tool-same-customer"
            type="button"
            onClick={nav.sameCustomer}
          >
            شيءٌ آخر لنفس الزبون
          </button>
        </div>
      )}
    </header>
  );
}

/**
 * شريط الإخراج في أسفل الخطوات: الطابعة مكتوبة، ثم أفعال الإخراج (اطبع، PDF، في ملفّ الزبون، للرفع)
 * — وبعد الطبع ما خرج وأين، ومنه «أعد الطبع» و«شيءٌ آخر لنفس الزبون».
 */
export function ToolOutput({
  role,
  after,
  onReprint,
  onDismiss,
  bar,
  children
}: {
  /** دور الطابعة — ولا دور لأداةٍ لا تطبع (PDF يُحفظ ملفًّا). */
  role?: PrintRoleKey;
  after?: Outcome | null;
  onReprint?: () => void;
  onDismiss?: () => void;
  /** شريطٌ أفقيّ بعرض الشاشة أسفلها — لا في عمود الخطوات. */
  bar?: boolean;
  children: ReactNode;
}) {
  const nav = useToolNav();
  if (bar)
    return (
      <div className="flex flex-wrap items-center gap-space-xs px-space-md py-space-sm bg-surface-container-low border-t border-outline-variant" data-tool-output={role ?? 'file'}>
        {after ? (
          <div className="basis-full">
            <AfterPrint outcome={after} onClose={() => onDismiss?.()} onReprint={onReprint} onSameCustomer={nav.customer ? nav.sameCustomer : undefined} />
          </div>
        ) : (
          role && <PrinterNote role={role} roles={nav.printRoles} />
        )}
        {children}
      </div>
    );
  return (
    <>
      {/* في عمودٍ مرن يدفع الشريط إلى أسفل الخطوات؛ وفي غيره لا شيء. */}
      <div aria-hidden className="flex-1" />
      <div className="sticky bottom-0 -mx-space-lg -mb-space-lg px-space-lg py-space-md border-t border-outline-variant bg-surface-container-low space-y-space-sm" data-tool-output={role ?? 'file'}>
        {after ? (
          <AfterPrint outcome={after} onClose={() => onDismiss?.()} onReprint={onReprint} onSameCustomer={nav.customer ? nav.sameCustomer : undefined} />
        ) : (
          role && <PrinterNote role={role} roles={nav.printRoles} />
        )}
        {children}
      </div>
    </>
  );
}
