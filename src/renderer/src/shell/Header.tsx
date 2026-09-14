import { useEffect, useRef } from 'react';

/* منقول حرفيًا من <header> في ملفات التصميم — كان متطابقًا بايتًا ببايت في الأربعة. */

export type HeaderProps = {
  /** اسم المعاملة الجارية، أو null قبل اختيار نموذج. */
  transaction: string | null;
  search: string;
  onSearch: (value: string) => void;
  onSwapTemplate: () => void;
  onSaveDraft: () => void;
  onExportPdf: () => void;
  onPrint: () => void;
  exporting?: boolean;
  busy?: boolean;
};

export default function Header({
  transaction,
  search,
  onSearch,
  onSwapTemplate,
  onSaveDraft,
  onExportPdf,
  onPrint,
  exporting = false,
  busy = false
}: HeaderProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  // Ctrl+F — البحث الشامل، كما يعلن التصميم في حقل البحث نفسه.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="fixed top-0 right-72 left-0 h-16 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 flex items-center justify-between px-space-lg gap-space-md">
      <div className="flex items-center gap-space-md flex-1 max-w-xl">
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
            search
          </span>
          <input
            ref={searchRef}
            className="w-full h-10 pr-10 pl-16 rounded-lg bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant text-body-sm font-body-sm focus:outline-none focus:ring-1 focus:ring-secondary shadow-[0_1px_8px_rgba(0,0,0,0.04)]"
            placeholder="بحث شامل وسريع (مواطن، رقم صادر، نموذج، كتاب رسمي)..."
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-code-sm text-code-sm px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-mono">
            Ctrl+F
          </span>
        </div>
        <div className="hidden xl:flex items-center gap-space-xs px-space-md py-1.5 rounded-lg bg-surface-container-lowest text-on-surface shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
          <span className="material-symbols-outlined text-secondary text-[18px]">article</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">المعاملة:</span>
          <span className="font-label-md text-label-md font-semibold truncate max-w-[140px]">
            {transaction ?? 'لا توجد معاملة'}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-space-sm">
        <button
          className="flex items-center gap-space-xs px-space-md h-10 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md shadow-[0_1px_8px_rgba(0,0,0,0.04)]"
          type="button"
          onClick={onSwapTemplate}
        >
          <span className="material-symbols-outlined text-[18px]">sync_alt</span>
          <span>تبديل النموذج</span>
        </button>
        <button
          className="flex items-center gap-space-xs px-space-md h-10 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] disabled:opacity-50"
          type="button"
          disabled={busy}
          onClick={onSaveDraft}
        >
          <span className="material-symbols-outlined text-[18px]">save</span>
          <span>حفظ مسودة</span>
        </button>
        <button
          className="flex items-center gap-space-xs px-space-md h-10 rounded-lg bg-surface-container-lowest text-secondary hover:bg-surface-container-high transition-colors font-label-md text-label-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] disabled:opacity-50"
          type="button"
          disabled={exporting || busy}
          onClick={onExportPdf}
        >
          {exporting ? (
            <>
              <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
              <span>جاري التصدير 300DPI...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
              <span>تصدير PDF</span>
            </>
          )}
        </button>
        <button
          className="flex items-center gap-space-xs px-space-lg h-10 rounded-lg bg-primary-container text-on-primary hover:bg-surface-container-highest hover:text-on-surface transition-all font-label-md text-label-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] disabled:opacity-50"
          type="button"
          disabled={busy}
          onClick={onPrint}
        >
          <span className="material-symbols-outlined text-[18px]">print</span>
          <span className="font-bold">طباعة فورية</span>
          <span className="font-code-sm text-code-sm opacity-70">Ctrl+P</span>
        </button>
      </div>
    </header>
  );
}
