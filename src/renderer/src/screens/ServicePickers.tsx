/**
 * نافذتا الاختيار في الشبّاك: «هات المدرسة» (ملفّ المدارس) و«هات الزبون» (الزبون المتكرّر).
 *
 * كانتا في `ServiceScreen.tsx` حتى بلغ سقفه، فنُقلتا كما هما (محادثة «الشبّاك واليوم الأوّل»).
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import { normalizeFold } from '@shared/arabic';
import { SCHOOL_KINDS } from '@shared/schoolFile';
import type { Client } from '@shared/orders';
import { trapTab } from '../kit/trapTab';
import { useEscape } from '../kit/useEscape';

/**
 * لوحة المفاتيح في النافذتين (D140): Esc يغلقها كما يغلقها «إغلاق» (`useEscape` — العليا وحدها)، وTab وShift+Tab يدوران على بحثها ونتائجها
 * و«إغلاق» ولا يخرجان منها (`trapTab`) — كانت ضغطتان تخرجان إلى الشريط العلوي والسكّة وهي مفتوحة، وEsc لا يغلقها.
 * وبعد إغلاقها يعود التركيز إلى ما فتحها إن لم يأخذه شيءٌ بعدها — كان يضيع على الصفحة.
 */
function useDialogKeys(onClose: () => void): RefObject<HTMLDivElement> {
  const ref = useRef<HTMLDivElement>(null);
  // ما فتحها يُقرأ قبل أن يأخذ بحثُها التركيز (`autoFocus` قبل التأثيرات).
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  useEscape(onClose);
  useEffect(() => {
    const onTab = (e: KeyboardEvent) => trapTab(e, ref.current, true);
    window.addEventListener('keydown', onTab);
    return () => {
      window.removeEventListener('keydown', onTab);
      const now = document.activeElement;
      if ((!now || now === document.body) && opener?.isConnected) opener.focus();
    };
  }, [opener]);
  return ref;
}

/** «هات المدرسة» (ملفّ المدارس): جهات المكتب والمدارسُ أوّلها، ويُبحث فيها بالاسم. */
export function SchoolPicker({ schools, onClose, onPick }: { schools: Client[]; onClose: () => void; onPick: (school: Client) => void }) {
  const [query, setQuery] = useState('');
  const q = normalizeFold(query.trim());
  const isSchool = (c: Client) => SCHOOL_KINDS.includes(c.kind ?? '') || Boolean(c.schoolGender || c.governorate || c.principal);
  const rows = schools.filter((c) => !q || normalizeFold(c.name).includes(q)).sort((a, b) => Number(isSchool(b)) - Number(isSchool(a)));
  const ref = useDialogKeys(onClose);
  return (
    <div ref={ref} role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-scrim/50">
      <div className="w-full max-w-lg surface-panel p-space-md flex flex-col gap-space-sm" data-school-picker="">
        <span className="font-headline-sm text-headline-sm text-on-surface">هات المدرسة</span>
        <input
          autoFocus
          className="input-field h-10 px-3 text-on-surface font-label-md text-label-md"
          placeholder="اسم المدرسة"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && rows.length > 0) {
              e.preventDefault();
              onPick(rows[0]);
            }
          }}
        />
        <div className="max-h-72 overflow-y-auto flex flex-col gap-1">
          {rows.length === 0 ? (
            <span className="py-space-md text-center font-label-md text-label-md text-on-surface-variant">
              {schools.length ? 'لا مدرسة بهذا الاسم' : 'أضف المدارس في «الجهات» بملفّاتها — مرّةً واحدة'}
            </span>
          ) : (
            rows.map((c) => (
              <button
                key={c.id}
                className="min-h-10 px-3 py-1 rounded-btn bg-surface-container-low hover:bg-surface-container-high text-on-surface text-right font-label-md text-label-md flex items-center justify-between gap-space-sm"
                data-school-pick={c.id}
                type="button"
                onClick={() => onPick(c)}
              >
                <span>{c.name}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
                  {[c.schoolGender, c.governorate, c.principal].filter(Boolean).join(' · ') || c.kind || ''}
                </span>
              </button>
            ))
          )}
        </div>
        <button
          className="h-9 self-end px-4 rounded-btn text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md"
          type="button"
          onClick={onClose}
        >
          إغلاق
        </button>
      </div>
    </div>
  );
}

/** الزبون المتكرر: يُكتب اسمه فيُستعاد ما يعرفه البرنامج عنه. */
export function CitizenPicker({
  onClose,
  onPick
}: {
  onClose: () => void;
  onPick: (id: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<{ id: number; fullName: string; nationalId: string | null }[]>(
    []
  );

  useEffect(() => {
    let alive = true;
    void window.diwan.citizens.list({ query, limit: 20 }).then((list) => {
      if (alive) setRows(list as typeof rows);
    });
    return () => {
      alive = false;
    };
  }, [query]);
  const ref = useDialogKeys(onClose);

  return (
    <div ref={ref} role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-scrim/50">
      <div className="w-full max-w-lg surface-panel p-space-md flex flex-col gap-space-sm">
        <span className="font-headline-sm text-headline-sm text-on-surface">
          هات الزبون
        </span>
        <input
          autoFocus
          className="input-field h-10 px-3 text-on-surface font-label-md text-label-md"
          placeholder="اسم المواطن أو رقمه"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && rows.length > 0) {
              e.preventDefault();
              onPick(rows[0].id);
            }
          }}
        />
        <div className="max-h-72 overflow-y-auto flex flex-col gap-1">
          {rows.length === 0 ? (
            <span className="py-space-md text-center font-label-md text-label-md text-on-surface-variant">
              لا ملفّ بهذا الاسم
            </span>
          ) : (
            rows.map((c) => (
              <button
                key={c.id}
                className="h-10 px-3 rounded-btn bg-surface-container-low hover:bg-surface-container-high text-on-surface text-right font-label-md text-label-md flex items-center justify-between"
                type="button"
                onClick={() => onPick(c.id)}
              >
                <span>{c.fullName}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  {c.nationalId ?? ''}
                </span>
              </button>
            ))
          )}
        </div>
        <button
          className="h-9 self-end px-4 rounded-btn text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md"
          type="button"
          onClick={onClose}
        >
          إغلاق
        </button>
      </div>
    </div>
  );
}
