import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { DocumentRow, LicenseStatus, SearchHits } from '@shared/api';
import { isCombo, shortcut } from '@shared/shortcuts';

/**
 * الشريط العلوي — البحث الشامل، وسياق الشاشة إن كان لها سياق.
 *
 * كان يحمل «حفظ مسودة» و«تصدير PDF» و«طباعة فورية» و«تبديل النموذج» في كل
 * الشاشات: في المحرّر والأسئلة تكرّر أزرارهما في مكانها، وفي التصاميم كانت
 * «طباعة» تقفز بالموظف إلى كتابٍ رسمي. فكلّ شاشةٍ تحمل أدواتها في مكانها، والشريط
 * للبحث وحده — وما تمرّره الشاشة سياقًا (المعاملة الجارية في المحرّر).
 * و`Ctrl+P` باقٍ اختصارًا يعمل على المعروض.
 *
 * والبحث في مكانه (خطة Production، ٣٫٤): كان الحرف الأوّل يقفز بالموظف إلى الأرشيف وهو في وسط
 * معاملة. فالنتائج تُعرض تحت الحقل — كتبٌ ومواطنون ونماذج ومستمسكات — وEnter يفتحها كلّها في الأرشيف.
 */
export type HeaderProps = {
  /** الأرشيف بالبحث كاملًا — Enter، أو «كلّ النتائج»، أو كتابٌ من النتائج برقمه. */
  onSearchArchive: (query: string) => void;
  onOpenCitizen: (citizenId: number) => void;
  onOpenTemplate: (templateId: number) => void;
  /** سياق الشاشة المعروضة — يُرسم يسار الشريط، ولا شيء بغيره. */
  context?: ReactNode;
  onOpenCommandPalette?: () => void;
  /** الشريط الجانبي مثبّت: يأخذ الشريط العلوي ما بقي بجانبه؛ وإلا فالعرض كلّه وزرٌّ يُظهره. */
  sidebarPinned: boolean;
  onShowSidebar: () => void;
  /** المدّة التجريبية: أيّامها الباقية، أو أنّها انتهت — وضغطةٌ تفتح «التفعيل». والمفعَّل لا يُرى شيئًا. */
  license?: LicenseStatus | null;
  onLicense?: () => void;
};

type Results = { query: string; documents: DocumentRow[]; others: SearchHits | null };

export default function Header({
  onSearchArchive,
  onOpenCitizen,
  onOpenTemplate,
  context,
  onOpenCommandPalette,
  sidebarPinned,
  onShowSidebar,
  license,
  onLicense
}: HeaderProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [results, setResults] = useState<Results | null>(null);
  const [open, setOpen] = useState(false);

  // Ctrl+F — البحث الشامل، كما يعلن الحقل نفسه.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isCombo(e, shortcut('search').combo)) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const q = text.trim();
    if (!q) {
      setResults(null);
      return;
    }
    const timer = setTimeout(() => {
      void Promise.all([
        window.diwan.documents.list({ query: q, limit: 5 }),
        window.diwan.search.others(q).catch(() => null)
      ])
        .then(([documents, others]) => setResults({ query: q, documents, others }))
        .catch(() => setResults({ query: q, documents: [], others: null }));
    }, 200);
    return () => clearTimeout(timer);
  }, [text]);

  const done = (go: () => void) => {
    go();
    setOpen(false);
    setText('');
    searchRef.current?.blur();
  };

  const q = text.trim();
  const fresh = results && results.query === q ? results : null;
  const citizens = fresh?.others?.citizens.slice(0, 4) ?? [];
  const templates = fresh?.others?.templates.slice(0, 3) ?? [];
  const attachments = fresh?.others?.attachments.slice(0, 3) ?? [];
  const empty = fresh && !fresh.documents.length && !citizens.length && !templates.length && !attachments.length;

  const item =
    'w-full flex items-center gap-space-sm px-space-sm py-1.5 rounded-lg text-start hover:bg-surface-container-high text-on-surface';
  const group = (title: string, children: ReactNode) => (
    <div className="flex flex-col gap-0.5">
      <span className="px-space-sm font-label-sm text-label-sm text-on-surface-variant font-semibold">{title}</span>
      {children}
    </div>
  );

  return (
    <header
      className={`fixed top-0 ${sidebarPinned ? 'right-72' : 'right-0'} left-0 h-16 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 flex items-center justify-between px-space-lg gap-space-md transition-[right] duration-200`}
    >
      <div className="flex items-center gap-space-sm w-full max-w-2xl min-w-0">
        {!sidebarPinned && (
          <button
            className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-surface-container-lowest text-on-surface hover:bg-surface-container-high shadow-[0_1px_8px_rgba(0,0,0,0.04)]"
            data-act="sidebar-show"
            title="الأقسام — والشريط يظهر أيضًا حين تقترب الفأرة من حافّة النافذة"
            type="button"
            onClick={onShowSidebar}
          >
            <span className="material-symbols-outlined text-[22px]">menu</span>
          </button>
        )}
        <div className="relative flex-1 min-w-0">
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
            search
          </span>
          <input
            ref={searchRef}
            className="w-full h-10 pr-10 pl-16 rounded-lg bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant text-label-md font-label-md focus:outline-none focus:ring-1 focus:ring-secondary shadow-[0_1px_8px_rgba(0,0,0,0.04)]"
            data-global-search=""
            placeholder="بحث شامل: مواطن، رقم صادر، نموذج، كتاب…"
            type="text"
            value={text}
            onBlur={() => setOpen(false)}
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && q) {
                e.preventDefault();
                done(() => onSearchArchive(q));
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setText('');
                setOpen(false);
                searchRef.current?.blur();
              }
            }}
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-mono">
            Ctrl+F
          </span>

          {open && q && (
            <div
              className="absolute top-12 inset-x-0 z-50 max-h-[70vh] overflow-y-auto rounded-xl bg-surface-container-lowest shadow-2xl p-space-sm flex flex-col gap-space-sm"
              data-search-results=""
              // الضغط على نتيجة لا يُسقط التركيز قبل أن تُفتح.
              onMouseDown={(e) => e.preventDefault()}
            >
              {!fresh && <span className="px-space-sm py-1 font-label-md text-label-md text-on-surface-variant">يُبحث…</span>}
              {empty && (
                <span className="px-space-sm py-1 font-label-md text-label-md text-on-surface-variant">
                  لا شيء بهذا — ولا في الكتب ولا المواطنين ولا النماذج.
                </span>
              )}
              {fresh &&
                fresh.documents.length > 0 &&
                group(
                  'الكتب الصادرة',
                  fresh.documents.map((d) => (
                    <button key={d.id} className={item} data-search-doc={d.serial} type="button" onClick={() => done(() => onSearchArchive(d.serial))}>
                      <span className="material-symbols-outlined text-[18px] text-secondary">description</span>
                      <span className="font-label-md text-label-md font-semibold tabular shrink-0" dir="ltr">
                        {d.serial}
                      </span>
                      <span className="font-label-md text-label-md truncate flex-1">
                        {d.citizenName}
                        {d.docType ? ` — ${d.docType}` : ''}
                      </span>
                      {d.status === 'void' && <span className="font-label-sm text-label-sm text-error">مُبطَل</span>}
                    </button>
                  ))
                )}
              {citizens.length > 0 &&
                group(
                  'المواطنون',
                  citizens.map((c) => (
                    <button key={c.id} className={item} data-search-citizen={c.id} type="button" onClick={() => done(() => onOpenCitizen(c.id))}>
                      <span className="material-symbols-outlined text-[18px] text-secondary">person</span>
                      <span className="font-label-md text-label-md truncate flex-1">{c.fullName}</span>
                      {c.nationalId && (
                        <span className="font-label-sm text-label-sm text-on-surface-variant tabular" dir="ltr">
                          {c.nationalId}
                        </span>
                      )}
                    </button>
                  ))
                )}
              {templates.length > 0 &&
                group(
                  'النماذج',
                  templates.map((t) => (
                    <button key={t.id} className={item} data-search-template={t.id} type="button" onClick={() => done(() => onOpenTemplate(t.id))}>
                      <span className="material-symbols-outlined text-[18px] text-secondary">article</span>
                      <span className="font-label-md text-label-md truncate flex-1">{t.title}</span>
                    </button>
                  ))
                )}
              {attachments.length > 0 &&
                group(
                  'المستمسكات',
                  attachments.map((a) => (
                    <button key={a.id} className={item} data-search-attachment={a.id} type="button" onClick={() => done(() => onOpenCitizen(a.citizenId))}>
                      <span className="material-symbols-outlined text-[18px] text-secondary">badge</span>
                      <span className="font-label-md text-label-md truncate flex-1">
                        {a.docType} — {a.citizenName}
                      </span>
                    </button>
                  ))
                )}
              <button
                className="self-start px-space-sm h-8 rounded-lg font-label-md text-label-md text-secondary hover:bg-surface-container-high"
                data-act="search-archive"
                type="button"
                onClick={() => done(() => onSearchArchive(q))}
              >
                كلّ النتائج في الأرشيف (Enter)
              </button>
            </div>
          )}
        </div>

        {onOpenCommandPalette && (
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 h-10 rounded-lg bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/40 text-on-surface font-label-md text-label-md font-semibold transition-colors shrink-0 shadow-sm"
            title="شريط الأوامر السريع (Ctrl+K)"
            onClick={onOpenCommandPalette}
          >
            <span className="material-symbols-outlined text-[18px] text-primary">terminal</span>
            <span className="[@media(max-width:1180px)]:hidden">الأوامر</span>
            <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-container-lowest text-on-surface-variant border">
              Ctrl+K
            </kbd>
          </button>
        )}
      </div>
      <div className="flex items-center gap-space-sm shrink-0">
        {context && (
          <div className="flex items-center gap-space-sm" data-header-context="">
            {context}
          </div>
        )}
        {license && (license.status === 'trial' || license.status === 'expired' || (license.status === 'subscribed' && license.daysLeft <= 7)) && (
          <button
            className={`h-9 px-space-md rounded-full font-label-md text-label-md font-semibold flex items-center gap-space-xs shrink-0 ${
              license.status === 'expired'
                ? 'bg-error text-on-error'
                : license.daysLeft <= 3 || license.status === 'subscribed'
                  ? 'bg-error-container text-on-error-container'
                  : 'bg-surface-container-lowest text-on-surface shadow-[0_1px_8px_rgba(0,0,0,0.04)]'
            }`}
            data-license-pill={license.status}
            title={`للتفعيل: ${license.phone} (واتساب واتصال) — أو افتح «الإعدادات ← التفعيل»`}
            type="button"
            onClick={onLicense}
          >
            <span className="material-symbols-outlined text-[18px]">{license.status === 'expired' ? 'lock_clock' : 'hourglass_top'}</span>
            {license.status === 'expired'
              ? license.ended === 'subscription'
                ? 'انتهى الاشتراك — جدّده'
                : 'انتهت المدّة التجريبية — فعّل'
              : `${license.status === 'subscribed' ? 'ينتهي الاشتراك' : 'تجريبية'} — بقي ${license.daysLeft} ${license.daysLeft === 1 ? 'يوم' : license.daysLeft <= 10 ? 'أيام' : 'يومًا'}`}
          </button>
        )}
      </div>
    </header>
  );
}
