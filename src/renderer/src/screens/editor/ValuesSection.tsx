/**
 * لوح المحرّر — ٣ «القيم» (تقسيمه بعد ١٫٧٫٠): «هات الزبون»، واسم صاحب العلاقة ومقترحه من المتن، والجنس، والحقول بتقويمها
 * وكتابتها، و«أضف حقلًا».
 */
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { CALENDAR_LABEL, type Calendar } from '@shared/dates';
import { patchField } from '@shared/docEdit';
import { isDateField, type Doc } from '@shared/doc';
import { wordsForField } from '@shared/tafqeet';
import { GENDER_KEY, isChoiceKey } from '@shared/gender';
import type { nameFieldOf } from '@shared/letterDraft';
import DateTools from '../../components/DateTools';
import type { EditorApi } from '../../components/editorKit';
import { inputCls } from '../EditorDialogs';
import { section, title } from './panelUi';

type Props = {
  setPickerOpen: Dispatch<SetStateAction<boolean>>;
  nameField: ReturnType<typeof nameFieldOf>;
  owner: string;
  dirty: MutableRefObject<boolean>;
  setOwner: Dispatch<SetStateAction<string>>;
  ownerHints: string[];
  takeOwner: (name: string) => void;
  needsGender: boolean;
  values: Record<string, string>;
  setGenderByHand: Dispatch<SetStateAction<boolean>>;
  setValue: (key: string, value: string) => void;
  doc: Doc;
  setDoc: (next: Doc | ((d: Doc) => Doc)) => void;
  named: { id: string; token: string; label: string; value: string }[];
  api: MutableRefObject<EditorApi | null>;
  writeWords: (key: string) => void;
  setFieldPickerOpen: Dispatch<SetStateAction<boolean>>;
};

export default function ValuesSection({
  setPickerOpen,
  nameField,
  owner,
  dirty,
  setOwner,
  ownerHints,
  takeOwner,
  needsGender,
  values,
  setGenderByHand,
  setValue,
  doc,
  setDoc,
  named,
  api,
  writeWords,
  setFieldPickerOpen
}: Props) {
  return (
    <section className={section} data-editor-values="">
      {title(
        'badge',
        'القيم',
        <button
          className="h-8 px-2.5 rounded-btn bg-surface-container-high hover:bg-surface-container-highest font-label-sm text-label-sm flex items-center gap-1"
          type="button"
          onClick={() => setPickerOpen(true)}
        >
          <span className="material-symbols-outlined text-[16px] text-secondary">person_search</span>
          هات الزبون
        </button>
      )}
      {!nameField && (
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            اسم صاحب العلاقة <span className="text-error">*</span> — للأرشيف، ولا حقل له على الورقة
          </span>
          <input className={inputCls} data-editor-owner="" value={owner} onChange={(e) => (dirty.current = true, setOwner(e.target.value))} />
        </label>
      )}
      {ownerHints.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 font-label-sm text-label-sm text-on-surface-variant" data-owner-hints="">
          مكتوبٌ في الكتاب — اضغطه:
          {ownerHints.map((n) => (
            <button
              key={n}
              className="h-7 px-2.5 rounded-chip bg-secondary-fixed text-on-secondary-fixed font-semibold hover:bg-secondary-fixed-dim"
              data-owner-hint={n}
              type="button"
              onClick={() => takeOwner(n)}
            >
              {n}
            </button>
          ))}
        </div>
      )}
      {needsGender && (
        <div className="flex items-center gap-space-xs" data-gender="">
          <span className="font-label-sm text-label-sm text-on-surface-variant">الجنس:</span>
          {(['ذكر', 'أنثى'] as const).map((g) => (
            <button
              key={g}
              className={`h-8 px-3 rounded-btn font-label-sm text-label-sm ${
                values[GENDER_KEY] === g ? 'bg-primary-fixed text-primary font-bold' : 'bg-surface-container-low text-on-surface'
              }`}
              type="button"
              onClick={() => {
                setGenderByHand(true);
                setValue(GENDER_KEY, g);
              }}
            >
              {g}
            </button>
          ))}
        </div>
      )}
      {doc.fields.filter((f) => !isChoiceKey(f.key)).length === 0 ? (
        <p className="font-label-sm text-label-sm text-on-surface-variant">
          لا حقول على الورقة — ظلّل عبارةً في الورقة واضغط F4، أو أضف حقلًا من كتالوج المعاملات.
        </p>
      ) : (
        doc.fields
          .filter((f) => !isChoiceKey(f.key))
          .map((f) => {
            const words = wordsForField(named.find((n) => n.id === f.key)!, named);
            return (
              <label key={f.key} className="flex flex-col gap-1" data-value-of={f.key}>
                <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
                  {f.label} {f.required && <span className="text-error">*</span>}
                  <span className="flex-1" />
                  {isDateField(f) && (
                    <select
                      className="h-6 px-1 rounded bg-surface-container-low text-on-surface-variant cursor-pointer"
                      data-calendar-of={f.key}
                      title="بأيّ تقويمٍ يُكتب التاريخ"
                      value={f.calendar ?? 'gregorian'}
                      onChange={(e) => setDoc((d) => patchField(d, f.key, { type: 'date', calendar: e.target.value as Calendar }))}
                    >
                      {(Object.keys(CALENDAR_LABEL) as Calendar[]).map((k) => (
                        <option key={k} value={k}>
                          {CALENDAR_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    className="text-secondary hover:underline"
                    title="أدرجه مرّةً أخرى حيث وقف المؤشّر في الورقة"
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => api.current?.insertField(f.key)}
                  >
                    + في الورقة
                  </button>
                </span>
                <span className="flex items-center gap-1">
                  <input className={inputCls} value={values[f.key] ?? ''} placeholder="—" onChange={(e) => setValue(f.key, e.target.value)} />
                  {words && (
                    <button
                      className="h-9 px-2 rounded-btn bg-surface-container-low hover:bg-surface-container-high text-secondary shrink-0"
                      title={`كتابةً: ${words}`}
                      type="button"
                      onClick={() => writeWords(f.key)}
                    >
                      <span className="material-symbols-outlined text-[16px]">spellcheck</span>
                    </button>
                  )}
                  {isDateField(f) && <DateTools calendar={f.calendar} onPick={(t) => setValue(f.key, t)} />}
                </span>
              </label>
            );
          })
      )}
      <button
        className="h-9 rounded-btn border border-dashed border-outline-variant hover:border-secondary text-on-surface-variant hover:text-on-surface font-label-md text-label-md flex items-center justify-center gap-1"
        data-act="add-field"
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setFieldPickerOpen(true)}
      >
        <span className="material-symbols-outlined text-[18px] text-secondary">add_circle</span>
        أضف حقلًا من كتالوج المعاملات
      </button>
    </section>
  );
}
