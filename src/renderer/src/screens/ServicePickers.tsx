/**
 * نافذتا الاختيار في الشبّاك: «هات المدرسة» (ملفّ المدارس) و«هات الزبون» (الزبون المتكرّر).
 *
 * كانتا في `ServiceScreen.tsx` حتى بلغ سقفه، فنُقلتا كما هما (محادثة «الشبّاك واليوم الأوّل»).
 */
import { useEffect, useState } from 'react';
import { normalizeFold } from '@shared/arabic';
import { SCHOOL_KINDS } from '@shared/schoolFile';
import type { Client } from '@shared/orders';

/** «هات المدرسة» (ملفّ المدارس): جهات المكتب والمدارسُ أوّلها، ويُبحث فيها بالاسم. */
export function SchoolPicker({ schools, onClose, onPick }: { schools: Client[]; onClose: () => void; onPick: (school: Client) => void }) {
  const [query, setQuery] = useState('');
  const q = normalizeFold(query.trim());
  const isSchool = (c: Client) => SCHOOL_KINDS.includes(c.kind ?? '') || Boolean(c.schoolGender || c.governorate || c.principal);
  const rows = schools.filter((c) => !q || normalizeFold(c.name).includes(q)).sort((a, b) => Number(isSchool(b)) - Number(isSchool(a)));
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-scrim/50">
      <div className="w-full max-w-lg rounded-2xl bg-surface-container-lowest shadow-2xl p-space-md flex flex-col gap-space-sm" data-school-picker="">
        <span className="font-headline-sm text-headline-sm text-on-surface">هات المدرسة</span>
        <input
          autoFocus
          className="h-10 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary"
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
                className="min-h-10 px-3 py-1 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface text-right font-label-md text-label-md flex items-center justify-between gap-space-sm"
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
          className="h-9 self-end px-4 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md"
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

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-scrim/50">
      <div className="w-full max-w-lg rounded-2xl bg-surface-container-lowest shadow-2xl p-space-md flex flex-col gap-space-sm">
        <span className="font-headline-sm text-headline-sm text-on-surface">
          هات الزبون
        </span>
        <input
          autoFocus
          className="h-10 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary"
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
                className="h-10 px-3 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface text-right font-label-md text-label-md flex items-center justify-between"
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
          className="h-9 self-end px-4 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md"
          type="button"
          onClick={onClose}
        >
          إغلاق
        </button>
      </div>
    </div>
  );
}
