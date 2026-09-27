/**
 * أداتا حقل التاريخ بجانب خانته: «اليوم» بضغطة، وتقويمٌ لتاريخٍ غيره (ولادة، أمر
 * إداري) — وكلاهما يكتب بتقويم الحقل: ميلادي أو هجري أو كلاهما.
 *
 * والخانة تبقى نصًّا يُكتب فيه باليد أيضًا: الزبون يملي التاريخ كما في مستمسكه.
 */
import { useRef } from 'react';
import { formatDateIn, fromIsoDate, CALENDAR_LABEL, type Calendar } from '@shared/dates';

export default function DateTools({
  calendar = 'gregorian',
  onPick,
  size = 'h-9'
}: {
  calendar?: Calendar;
  onPick: (text: string) => void;
  size?: string;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const btn = `${size} px-2 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant shrink-0 font-label-sm text-label-sm`;
  return (
    <>
      <button
        className={btn}
        data-act="date-today"
        title={`تاريخ اليوم — ${CALENDAR_LABEL[calendar]}`}
        type="button"
        onClick={() => onPick(formatDateIn(new Date(), calendar))}
      >
        اليوم
      </button>
      <span className="relative shrink-0">
        <button
          className={btn}
          data-act="date-pick"
          title={`اختر تاريخًا — يُكتب ${CALENDAR_LABEL[calendar]}`}
          type="button"
          onClick={() => {
            const el = picker.current;
            if (!el) return;
            try {
              el.showPicker();
            } catch {
              el.focus();
            }
          }}
        >
          <span className="material-symbols-outlined text-[16px] align-middle">calendar_month</span>
        </button>
        {/* الخانة الأصلية مخفيّة: تقويمُ النظام وحده، والنصّ يُكتب بتقويم الحقل. */}
        <input
          ref={picker}
          aria-hidden
          className="absolute inset-0 opacity-0 pointer-events-none"
          data-date-picker=""
          tabIndex={-1}
          type="date"
          onChange={(e) => {
            const d = fromIsoDate(e.target.value);
            if (d) onPick(formatDateIn(d, calendar));
          }}
        />
      </span>
    </>
  );
}
