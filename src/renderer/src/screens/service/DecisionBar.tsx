/**
 * الشبّاك — شريط القرار (تقسيم الشبّاك بعد ١٫٧٫٠): منقولٌ من `ServiceScreen` كما هو — «رجوع» و«علّق المعاملة» و«ألغِ
 * المعاملة»، و«على استمارةٍ مطبوعة»، وما يمنع الإصدار، و«املأ» و«راجع الأوراق»، والنسخ و«احفظ بلا طباعة» و«اطبع».
 * عرضٌ وحده: الحال والدوالّ كلّها في الشاشة، وتمرّ إليه بأسمائها.
 */
import type { Dispatch, SetStateAction } from 'react';
import { count, countIn, toIndic } from '@shared/arabic';
import type { DocField } from '@shared/doc';
import type { OfficeSettings } from '@shared/api';
import { GENDER_KEY } from '@shared/gender';
import { PrinterNote } from '../../components/OutputBar';
import type { Loaded, Step } from './types';

type Props = {
  step: Step;
  setStep: Dispatch<SetStateAction<Step>>;
  busy: boolean;
  picked: number[];
  goFill: (ids?: number[]) => Promise<void>;
  setAt: Dispatch<SetStateAction<number>>;
  park: () => void;
  discardTransaction: () => void;
  valuesOnly: boolean;
  setValuesOnly: Dispatch<SetStateAction<boolean>>;
  merge: boolean;
  rows: string[];
  loaded: Loaded[];
  missing: DocField[];
  genderUnsure: boolean;
  citizenName: string;
  setGenderByHand: Dispatch<SetStateAction<boolean>>;
  setValues: Dispatch<SetStateAction<Record<string, string>>>;
  settings: OfficeSettings | null;
  copies: number;
  setCopies: Dispatch<SetStateAction<number>>;
  blocked: boolean;
  issue: (print: boolean) => Promise<void>;
};

export default function DecisionBar({
  step,
  setStep,
  busy,
  picked,
  goFill,
  setAt,
  park,
  discardTransaction,
  valuesOnly,
  setValuesOnly,
  merge,
  rows,
  loaded,
  missing,
  genderUnsure,
  citizenName,
  setGenderByHand,
  setValues,
  settings,
  copies,
  setCopies,
  blocked,
  issue
}: Props) {
  return (
    <div className="shrink-0 px-space-lg py-space-sm bg-surface-container-low flex items-center gap-space-sm">
      {step !== 'pick' && (
        <button
          className="h-10 px-4 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md"
          type="button"
          onClick={() => setStep(step === 'review' ? 'fill' : 'pick')}
        >
          رجوع
        </button>
      )}
      {step !== 'pick' && (
        <button
          className="h-10 px-4 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md flex items-center gap-1"
          data-act="park"
          title="الزبون ذهب ليجلب مستمسكًا؟ علّقها واخدم غيره، ثم استأنفها من حيث تُركت"
          type="button"
          disabled={busy}
          onClick={park}
        >
          <span className="material-symbols-outlined text-[18px]">pause_circle</span>
          علّق المعاملة
        </button>
      )}
      {step !== 'pick' && (
        <button
          className="h-10 px-4 rounded-lg text-on-surface-variant hover:bg-error-container hover:text-on-error-container font-label-md text-label-md flex items-center gap-1"
          data-act="discard"
          title="زبونٌ عدل عن طلبه: تُمحى المعاملة ويُفتح الشبّاك نظيفًا — ولا يُقيَّد شيء"
          type="button"
          disabled={busy}
          onClick={discardTransaction}
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
          ألغِ المعاملة
        </button>
      )}
      <span className="flex-1" />

      {step === 'review' && (
        <>
          <label
            className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface cursor-pointer"
            title="الاستمارة الحكومية المطبوعة في الطابعة: تُطبع القيم وحدها في فراغاتها المنقّطة، والأرشيف يقيّد الورقة كاملة. اضبط إزاحة الطابعة من الإعدادات إن لزم."
          >
            <input
              checked={valuesOnly}
              className="w-4 h-4 accent-secondary"
              data-act="values-only"
              type="checkbox"
              onChange={(e) => setValuesOnly(e.target.checked)}
            />
            على استمارةٍ مطبوعة — القيم وحدها
          </label>
          {merge ? (
            <span className="font-label-md text-label-md text-on-surface">
              {count(rows.length * loaded.length, 'ورقة')} — {count(rows.length, 'اسم')}
            </span>
          ) : missing.length > 0 ? (
            <span className="font-label-md text-label-md text-error">
              حقولٌ إلزامية فارغة: {toIndic(missing.length)}
            </span>
          ) : (
            genderUnsure && (
              <span className="flex items-center gap-space-xs font-label-md text-label-md text-error" data-gender-unsure="">
                «{citizenName.split(/\s+/)[0]}»: ذكرٌ أم أنثى؟
                {(['ذكر', 'أنثى'] as const).map((g) => (
                  <button
                    key={g}
                    className="h-8 px-3 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md"
                    data-gender-choose={g}
                    type="button"
                    onClick={() => {
                      setGenderByHand(true);
                      setValues((prev) => ({ ...prev, [GENDER_KEY]: g }));
                    }}
                  >
                    {g}
                  </button>
                ))}
              </span>
            )
          )}
        </>
      )}

      {step === 'pick' && (
        <button
          className="h-10 px-5 btn-act font-label-md text-label-md font-bold disabled:opacity-40"
          type="button"
          disabled={picked.length === 0 || busy}
          onClick={() => void goFill()}
        >
          املأ {picked.length > 0 ? `(${picked.length})` : ''}
        </button>
      )}
      {step === 'fill' && (
        <button
          className="h-10 px-5 btn-act font-label-md text-label-md font-bold disabled:opacity-40"
          type="button"
          disabled={busy}
          onClick={() => {
            setAt(0);
            setStep('review');
          }}
        >
          راجع الأوراق
        </button>
      )}
      {step === 'review' && (
        <>
          <PrinterNote role="documents" roles={settings?.printRoles} />
          <label className="flex items-center gap-1 font-label-md text-label-md text-on-surface-variant" title="كم نسخةً من كلّ ورقة — تُطبع مجموعاتٍ مرتّبة">
            النسخ
            <input
              className="w-14 h-10 rounded-lg bg-surface-container-low text-center text-on-surface tabular"
              data-copies=""
              inputMode="numeric"
              max={99}
              min={1}
              type="number"
              value={copies}
              onChange={(e) => setCopies(Math.min(99, Math.max(1, Math.round(Number(e.target.value) || 1))))}
            />
          </label>
          <button
            className="h-10 px-4 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md disabled:opacity-40"
            type="button"
            disabled={busy || blocked}
            onClick={() => void issue(false)}
          >
            احفظ بلا طباعة
          </button>
          <button
            className="h-10 px-5 btn-act font-label-md text-label-md font-bold disabled:opacity-40"
            type="button"
            disabled={busy || blocked}
            onClick={() => void issue(true)}
          >
            {busy
              ? 'لحظة…'
              : `اطبع ${countIn((merge ? rows.length * loaded.length : loaded.length) * copies, 'ورقة')}`}
          </button>
        </>
      )}
    </div>
  );
}
