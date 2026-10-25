/**
 * الشبّاك — ٢ «املأ» (تقسيم الشبّاك بعد ١٫٧٫٠): منقولةٌ من `ServiceScreen` كما هي — «هات الزبون» و«هات المدرسة» و«لصق من
 * واتساب» و«ورقة مستمسكاته»، وقائمة الأسماء، والعدد على الكتاب، والجنس، والحقول بتنبيهها الخفيف، والمعاينة الحيّة.
 * عرضٌ وحده: الحال والدوالّ كلّها في الشاشة، وتمرّ إليها بأسمائها (و`fillFromSchool` دالّةٌ تملأ خانات المدرسة لا خطّاف) — إلا رسالة ملفّ الأسماء.
 * وكان فيه حصر Tab للشبّاك (`trapTab`)، ونُقل إلى `kit/trapTab.ts` لتستعمله نافذتا «هات الزبون» و«هات المدرسة» أيضًا (D140).
 */
import { useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { count } from '@shared/arabic';
import { isDateField, type DocField } from '@shared/doc';
import { GENDER_KEY, isChoiceKey } from '@shared/gender';
import { nationalIdHint, phoneHint } from '@shared/idChecks';
import { isAmbiguousAmount, isAmountField } from '@shared/tafqeet';
import type { Client } from '@shared/orders';
import DateTools from '../../components/DateTools';
import ImageFieldInput from '../../components/ImageFieldInput';
import LetterSheet from '../../components/LetterSheet';
import { errorText } from '../../lib/errors';
import { namesFromSheet } from './sheetNames';
import type { Loaded } from './types';

type Props = {
  loaded: Loaded[];
  fields: DocField[];
  values: Record<string, string>;
  setValues: Dispatch<SetStateAction<Record<string, string>>>;
  effective: Record<string, string>;
  citizenId: number | null;
  setPicker: Dispatch<SetStateAction<boolean>>;
  setPasteOpen: Dispatch<SetStateAction<boolean>>;
  openIdSheet: () => Promise<void>;
  nameField: DocField | null;
  merge: boolean;
  setMerge: Dispatch<SetStateAction<boolean>>;
  names: string;
  setNames: Dispatch<SetStateAction<string>>;
  rows: string[];
  setMergePicker: Dispatch<SetStateAction<boolean>>;
  printsRegistry: boolean;
  letterNo: string;
  setLetterNo: Dispatch<SetStateAction<string>>;
  needsGender: boolean;
  genderByHand: boolean;
  setGenderByHand: Dispatch<SetStateAction<boolean>>;
  schoolOn: boolean;
  setSchoolPicker: Dispatch<SetStateAction<boolean>>;
  schoolNameKey: string | null;
  schools: Client[];
  fillFromSchool: (school: Client, base?: Record<string, string>, filled?: Record<string, string>) => void;
  schoolFilled: MutableRefObject<Record<string, string>>;
  registry: { number: string; date: string };
  resolveHead: (text: string) => string;
};

export default function CounterFill({
  loaded,
  fields,
  values,
  setValues,
  effective,
  citizenId,
  setPicker,
  setPasteOpen,
  openIdSheet,
  nameField,
  merge,
  setMerge,
  names,
  setNames,
  rows,
  setMergePicker,
  printsRegistry,
  letterNo,
  setLetterNo,
  needsGender,
  genderByHand,
  setGenderByHand,
  schoolOn,
  setSchoolPicker,
  schoolNameKey,
  schools,
  fillFromSchool,
  schoolFilled,
  registry,
  resolveHead
}: Props) {
  /** ما يُقال عن ملفّ الأسماء: لا يُقرأ (`.xls` القديم)، أو فارغ، أو بلا أسماء — كان يسكت (D137). */
  const [sheetError, setSheetError] = useState<string | null>(null);

  // وTab يُحصر في الشاشة كلّها لا في الورقة وحدها: `trapTab` في `kit/trapTab.ts`، تسجّله `ServiceScreen` (D138).
  return (
    <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-space-lg items-start">
      <div className="flex flex-col gap-space-md" data-fill-form="">
      <div className="flex items-center gap-space-sm">
        <span className="font-headline-sm text-headline-sm text-on-surface">
          بيانات صاحب العلاقة
        </span>
        <span className="flex-1 font-label-sm text-label-sm text-on-surface-variant">
          تُكتب مرّة وتملأ {loaded.length} أوراق
        </span>
        <button
          className="h-9 px-3 btn-soft font-label-md text-label-md flex items-center gap-1"
          data-act="pick-customer"
          type="button"
          onClick={() => setPicker(true)}
        >
          <span className="material-symbols-outlined text-[18px] text-secondary">badge</span>
          هات الزبون
        </button>
        {schoolOn && (
          <button
            className="h-9 px-3 btn-soft font-label-md text-label-md flex items-center gap-1"
            data-act="pick-school"
            title="اسم المدرسة وجنسها ومحافظتها ومديرها من ملفّها في «الجهات»"
            type="button"
            onClick={() => setSchoolPicker(true)}
          >
            <span className="material-symbols-outlined text-[18px] text-secondary">school</span>
            هات المدرسة
          </button>
        )}
        <button
          className="h-9 px-3 btn-soft font-label-md text-label-md flex items-center gap-1"
          data-act="whatsapp-paste"
          type="button"
          onClick={() => setPasteOpen(true)}
        >
          <span className="material-symbols-outlined text-[18px] text-secondary">content_paste_go</span>
          لصق من واتساب
        </button>
        {citizenId !== null && (
          <button
            className="h-9 px-3 btn-soft font-label-md text-label-md flex items-center gap-1"
            data-act="counter-id-sheet"
            title="مستمسكات صاحب العلاقة من ملفّه بمقاسها الحقيقي على ورقة A4 واحدة"
            type="button"
            onClick={() => void openIdSheet()}
          >
            <span className="material-symbols-outlined text-[18px] text-secondary">document_scanner</span>
            ورقة مستمسكاته
          </button>
        )}
      </div>

      {nameField && (
        <div className="p-space-sm rounded-card bg-surface-container-low flex flex-col gap-space-xs">
          <label className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface cursor-pointer">
            <input
              className="w-4 h-4 accent-secondary"
              checked={merge}
              type="checkbox"
              onChange={(e) => setMerge(e.target.checked)}
            />
            قائمة أسماء — ورقةٌ لكل اسم
          </label>
          {merge && (
            <>
              <textarea
                className="input-field w-full min-h-[112px] p-space-sm text-on-surface font-label-md text-label-md leading-7"
                placeholder={'سطرٌ لكل اسم\nأحمد عادل كريم\nسالم محمود جاسم'}
                value={names}
                onChange={(e) => setNames(e.target.value)}
              />
              {/* استيراد الأسماء من جدول Excel أو CSV أو من السجل */}
              <div className="flex items-center gap-2">
                <button
                  className="self-start h-8 px-space-sm rounded-btn bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-sm text-label-sm flex items-center gap-1"
                  data-act="merge-sheet"
                  type="button"
                  onClick={async () => {
                    setSheetError(null);
                    try {
                      const sheet = await window.diwan.files.readSheet();
                      if (!sheet) return;
                      const extracted = namesFromSheet(sheet.text);
                      if (!extracted.length) {
                        setSheetError(sheet.text.trim() ? `لا عمود أسماءٍ في «${sheet.name}» — أعمدته أرقام` : `«${sheet.name}» فارغ — لا صفوف فيه`);
                        return;
                      }
                      setNames((prev) => [prev.trim(), ...extracted].filter(Boolean).join('\n'));
                    } catch (err) {
                      setSheetError(errorText(err, 'تعذّرت قراءة الملف'));
                    }
                  }}
                >
                  <span className="material-symbols-outlined text-[16px]">table_view</span>
                  من ملف Excel أو CSV
                </button>
                <button
                  className="self-start h-8 px-space-sm rounded-btn bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-sm text-label-sm flex items-center gap-1"
                  data-act="merge-registry"
                  type="button"
                  onClick={() => setMergePicker(true)}
                >
                  <span className="material-symbols-outlined text-[16px]">badge</span>
                  أضف من الزبائن
                </button>
              </div>
              {sheetError && (
                <span className="font-label-sm text-label-sm text-error" data-merge-sheet-error="" role="alert">
                  {sheetError}
                </span>
              )}
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                {count(rows.length, 'اسم')} × {count(loaded.length, 'ورقة')} ={' '}
                <b>{rows.length * loaded.length}</b> ورقة، لكل اسم معاملتُه.
                وبقيّة الحقول تُملأ مرّة للجميع.
              </span>
            </>
          )}
        </div>
      )}

      {printsRegistry && (
        <label className="flex flex-col gap-1" data-letter-no="">
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            العدد على الكتاب — كما أعطاه الزبون، أو يُترك فارغًا تكتبه الجهة
          </span>
          <input
            className="h-10 px-space-sm rounded-field bg-surface-container-lowest text-on-surface font-label-md text-label-md"
            value={letterNo}
            onChange={(e) => setLetterNo(e.target.value)}
          />
        </label>
      )}

      {fields.length === 0 ? (
        <span className="font-body-md text-body-md text-on-surface-variant">
          لا حقول في هذه النماذج — امضِ إلى المراجعة.
        </span>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
          {needsGender && (
            <div className="md:col-span-2 flex items-center gap-space-sm" data-gender="">
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                الجنس (للتذكير والتأنيث في الأوراق)
              </span>
              {(['ذكر', 'أنثى'] as const).map((g) => (
                <button
                  key={g}
                  className={`h-9 px-4 rounded-btn font-label-md text-label-md ${
                    values[GENDER_KEY] === g ? 'bg-primary-fixed text-primary font-bold' : 'bg-surface-container-low text-on-surface'
                  }`}
                  data-gender-value={g}
                  type="button"
                  onClick={() => {
                    setGenderByHand(true);
                    setValues((prev) => ({ ...prev, [GENDER_KEY]: g }));
                  }}
                >
                  {g}
                </button>
              ))}
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                {merge ? 'وفي القائمة: لكلّ اسمٍ جنسُه من اسمه' : genderByHand ? '' : 'مقترحٌ من الاسم'}
              </span>
            </div>
          )}
          {fields
            .filter((f) => !isChoiceKey(f.key))
            .filter((f) => !(merge && f.key === nameField?.key))
            .map((f) => {
            // حقل الصورة (S38) في `div` لا `label`: النقر على عنوانه لا يفتح «اختر صورة».
            const Wrap = f.type === 'image' ? 'div' : 'label';
            return (
            <Wrap key={f.key} className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                {f.label}
                {f.required && <span className="text-error"> *</span>}
              </span>
              <span className="flex items-center gap-1">
                {/* مربّع الاختيار في الاستمارة المصوّرة: يُعلَّم فيُطبع ✓ (المرحلة ٤). */}
                {f.type === 'image' ? (
                  <ImageFieldInput fieldKey={f.key} value={values[f.key] ?? ''} onChange={(path) => setValues((prev) => ({ ...prev, [f.key]: path }))} />
                ) : f.type === 'bool' ? (
                  <input
                    checked={Boolean(effective[f.key])}
                    className="w-5 h-5 accent-secondary"
                    data-check-field={f.key}
                    type="checkbox"
                    onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.checked ? '✓' : '' }))}
                  />
                ) : (
                <input
                  className="input-field flex-1 min-w-0 h-10 px-3 text-on-surface font-label-md text-label-md"
                  type="text"
                  // واسم المدرسة يقترح مدارس «الجهات»: اختيار إحداها يملأ بقيّة ملفّها.
                  list={schoolOn && f.key === schoolNameKey ? 'diwan-schools' : undefined}
                  placeholder={effective[f.key] && !values[f.key] ? effective[f.key] : undefined}
                  value={values[f.key] ?? ''}
                  onChange={(e) => {
                    const typed = e.target.value;
                    const school = schoolOn && f.key === schoolNameKey ? schools.find((s) => s.name === typed.trim()) : undefined;
                    if (school) fillFromSchool(school, { ...values, [f.key]: typed }, { ...schoolFilled.current, [f.key]: typed });
                    else setValues((prev) => ({ ...prev, [f.key]: typed }));
                  }}
                />
                )}
                {isDateField(f) && (
                  <DateTools
                    calendar={f.calendar}
                    size="h-10"
                    onPick={(text) => setValues((prev) => ({ ...prev, [f.key]: text }))}
                  />
                )}
              </span>
              {/* تنبيهٌ خفيف لا منع (د١٣) */}
              {(() => {
                const v = values[f.key] ?? '';
                const isAmount = isAmountField(f, fields);
                const hint =
                  f.role === 'nationalId' || f.source === 'nationalId'
                    ? nationalIdHint(v)
                    : f.source === 'phone' || /هاتف|موبايل|جوال/.test(f.label)
                      ? phoneHint(v)
                      : isAmount && isAmbiguousAmount(v)
                        ? 'المبلغ غامض: إن كان بالآلاف فاكتبه بالفاصلة (25,000) أو صريحًا (25000)'
                        : null;
                return hint ? (
                  <span className="font-label-sm text-label-sm text-tertiary" data-field-hint={f.key}>
                    {hint}
                  </span>
                ) : null;
              })()}
            </Wrap>
            );
          })}
        </div>
      )}
      </div>
      {/* معاينة حيّة بجانب التعبئة — عرضٌ فقط، لا تُصدَر عنها ورقة */}
      <div className="hidden lg:flex justify-center sticky top-0">
        {loaded[0] && (
          <div style={{ zoom: 0.42 }} className="w-fit">
            <LetterSheet
              doc={loaded[0].doc}
              layout={loaded[0].layout}
              values={effective}
              registry={registry}
              resolve={resolveHead}
            />
          </div>
        )}
      </div>
    </div>
  );
}
