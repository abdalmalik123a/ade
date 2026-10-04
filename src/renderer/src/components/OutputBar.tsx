/**
 * شريط الإخراج (خطّة الترقية، المرحلة ٢ — ن٩): الطابعة مكتوبةً قبل «اطبع» — من دورها في الإعدادات
 * (`printRoles.ts`) — فلا يُفاجأ الموظف بأين خرجت الورقة؛ وبعد الطبع شريطٌ يقول ما خرج وأين، ومنه
 * «أعد الطبع» و«شيءٌ آخر لنفس الزبون».
 */
import { PRINT_ROLES, describeRole, type PrintRoleKey, type PrintRoles } from '@shared/printRoles';

/** «على Canon MF3010 · طابعة الكتب» — أو «تُختار الطابعة عند الطبع». */
export function PrinterNote({ role, roles }: { role: PrintRoleKey; roles: PrintRoles | null | undefined }) {
  const printer = roles ? describeRole(roles[role]) : null;
  const label = PRINT_ROLES.find((r) => r.key === role)?.label ?? '';
  return (
    <span className="flex items-center gap-1 min-w-0 font-label-sm text-label-sm text-on-surface-variant" data-printer-note={role} title={`دورها في «الإعدادات ← الطابعات»: ${label}`}>
      <span className="material-symbols-outlined text-[18px] text-secondary shrink-0">print</span>
      {printer ? (
        <span className="truncate">
          على <span className="text-on-surface font-semibold">{printer}</span> · طابعة {label}
        </span>
      ) : (
        <span className="truncate">تُختار الطابعة عند الطبع · {label}</span>
      )}
    </span>
  );
}

/** «ورقةٌ واحدة»، «ورقتان»، «٣ أوراق»، «١٢ ورقة» — كما تُقال. */
export function papersWord(n: number): string {
  if (n === 1) return 'ورقةٌ واحدة';
  if (n === 2) return 'ورقتان';
  return n <= 10 ? `${n} أوراق` : `${n} ورقة`;
}

export type Outcome = {
  /** ما خرج: «٣ أوراق» أو «كتاب». */
  what: string;
  /** الطابعة — أو `null`: حُفظ بلا طباعة. */
  printer: string | null;
  /** رقمه الداخلي في السجلّ — وما لا يُقيَّد (الصور، التصاميم) بلا رقم. */
  serial?: string;
};

/** بعد الطبع: ما خرج وأين، وما يُفعل بعده. */
export function AfterPrint({
  outcome,
  onReprint,
  onPdf,
  onSameCustomer,
  onClose
}: {
  outcome: Outcome;
  onReprint?: () => void;
  /** ما قُيِّد الآن ملفّ PDF للزبون — من السجلّ كما صدر (ن٩). */
  onPdf?: () => void;
  onSameCustomer?: () => void;
  onClose: () => void;
}) {
  return (
    <div className="p-space-sm rounded-xl bg-secondary-fixed flex flex-wrap items-center gap-space-sm" data-after-print="" role="status">
      <span className="material-symbols-outlined text-[22px] text-secondary">{outcome.printer ? 'task_alt' : 'inventory_2'}</span>
      <span className="flex-1 min-w-0 font-label-md text-label-md text-on-surface">
        {outcome.printer ? (
          <>
            طُبعت {outcome.what} على <span className="font-bold">{outcome.printer}</span>
          </>
        ) : (
          <>حُفظت {outcome.what} بلا طباعة</>
        )}
        {outcome.serial && <span className="text-on-surface-variant"> · في السجلّ برقم {outcome.serial}</span>}
      </span>
      {onReprint && (
        <button className="h-9 px-3 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high font-label-md text-label-md" data-act="reprint" type="button" onClick={onReprint}>
          {outcome.printer ? 'أعد الطبع' : 'اطبعه الآن'}
        </button>
      )}
      {onPdf && (
        <button className="h-9 px-3 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high font-label-md text-label-md flex items-center gap-1" data-act="after-pdf" type="button" onClick={onPdf}>
          <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
          PDF
        </button>
      )}
      {onSameCustomer && (
        <button className="h-9 px-3 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold" data-act="same-customer" type="button" onClick={onSameCustomer}>
          شيءٌ آخر لنفس الزبون
        </button>
      )}
      <button className="w-9 h-9 rounded-lg text-on-surface-variant hover:bg-surface-container-high" data-act="after-close" title="زبونٌ جديد" type="button" onClick={onClose}>
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
}
