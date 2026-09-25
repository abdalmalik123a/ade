import { useEffect, useRef, type ReactNode } from 'react';

/**
 * الشريط العلوي — البحث الشامل، وسياق الشاشة إن كان لها سياق.
 *
 * كان يحمل «حفظ مسودة» و«تصدير PDF» و«طباعة فورية» و«تبديل النموذج» في كل
 * الشاشات: في المحرّر والأسئلة تكرّر أزرارهما في مكانها، وفي التصاميم كانت
 * «طباعة» تقفز بالموظف إلى كتابٍ رسمي. فكلّ شاشةٍ تحمل أدواتها في مكانها، والشريط
 * للبحث وحده — وما تمرّره الشاشة سياقًا (المعاملة الجارية في المحرّر).
 * و`Ctrl+P` باقٍ اختصارًا يعمل على المعروض.
 */
export type HeaderProps = {
  search: string;
  onSearch: (value: string) => void;
  /** سياق الشاشة المعروضة — يُرسم يسار الشريط، ولا شيء بغيره. */
  context?: ReactNode;
};

export default function Header({ search, onSearch, context }: HeaderProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  // Ctrl+F — البحث الشامل، كما يعلن الحقل نفسه.
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
      <div className="relative w-full max-w-xl">
        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
          search
        </span>
        <input
          ref={searchRef}
          className="w-full h-10 pr-10 pl-16 rounded-lg bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant text-label-md font-label-md focus:outline-none focus:ring-1 focus:ring-secondary shadow-[0_1px_8px_rgba(0,0,0,0.04)]"
          data-global-search=""
          placeholder="بحث شامل: مواطن، رقم صادر، نموذج، كتاب…"
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-mono">
          Ctrl+F
        </span>
      </div>
      {context && <div className="flex items-center gap-space-sm" data-header-context="">{context}</div>}
    </header>
  );
}
