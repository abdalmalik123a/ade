/**
 * ملفّ المدرسة (الموجة ٢): يُكتب مرّةً ويملأ كتبها في الشبّاك — جنسها ومحافظتها ومديرها والعام الدراسي (تقسيم شاشة الجهات بعد ١٫٧٫٠) — منقولٌ من `ClientsScreen` كما هو.
 */
import type { Dispatch, SetStateAction } from 'react';
import { SCHOOL_GENDERS, academicYearText } from '@shared/schoolFile';
import type { Draft } from './shared';

type Props = {
  input: 'input-field h-10 px-3 font-label-md text-label-md text-on-surface w-full';
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
};

export default function ClientSchoolFile({ input, draft, setDraft }: Props) {
  return (
    <div className="rounded-card bg-surface-container-low p-space-md space-y-space-sm" data-school-file="">
      <h2 className="font-body-md text-body-md text-on-surface font-semibold flex items-center gap-1">
        <span className="material-symbols-outlined text-[18px] text-secondary">school</span>
        ملفّ المدرسة — يملأ كتبها في الشبّاك بـ«هات المدرسة»
      </h2>
      <div className="grid grid-cols-2 gap-space-md">
        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md text-on-surface font-semibold">جنس المدرسة — كما يُطبع تحت اسمها</span>
          <input
            className={input}
            data-school-gender=""
            value={draft.schoolGender}
            onChange={(e) => setDraft({ ...draft, schoolGender: e.target.value })}
          />
          <span className="flex flex-wrap gap-1">
            {SCHOOL_GENDERS.map((g) => (
              <button
                key={g}
                className={`h-7 px-3 rounded-chip font-label-sm text-label-sm ${draft.schoolGender === g ? 'bg-primary-fixed text-primary' : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}`}
                data-school-gender-chip={g}
                type="button"
                onClick={() => setDraft({ ...draft, schoolGender: g })}
              >
                {g}
              </button>
            ))}
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md text-on-surface font-semibold">المحافظة أو المديرية — كما تُكتب بعد «لتربية»</span>
          <input
            className={input}
            data-school-governorate=""
            placeholder="مثال: بغداد الكرخ الأولى"
            value={draft.governorate}
            onChange={(e) => setDraft({ ...draft, governorate: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 col-span-2">
          <span className="font-label-md text-label-md text-on-surface font-semibold">اسم مدير المدرسة — يُطبع في التوقيع</span>
          <input
            className={input}
            data-school-principal=""
            value={draft.principal}
            onChange={(e) => setDraft({ ...draft, principal: e.target.value })}
          />
        </label>
      </div>
      <p className="font-label-sm text-label-sm text-on-surface-variant">
        والعام الدراسي يُكتب وحده من التاريخ ({academicYearText(new Date())})، واسم المدرسة اسم الجهة أعلاه كما يُطبع.
      </p>
    </div>
  );
}
