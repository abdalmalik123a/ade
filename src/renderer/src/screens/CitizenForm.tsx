/**
 * نموذج إضافة/تعديل ملف مواطن.
 *
 * الحقول هي عين ما يعرضه التصميم في بطاقة ملف الشخص — لا حقل زائد ولا ناقص.
 */
import { useEffect, useState } from 'react';
import type { CitizenDetail, CitizenInput } from '@shared/api';
import WhatsAppPasteDialog from './WhatsAppPasteDialog';
import { errorText } from '../lib/errors';

const inputCls =
  'w-full h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary';

const FIELDS: { key: keyof CitizenInput; label: string; required?: boolean; mono?: boolean }[] = [
  { key: 'fullName', label: 'الاسم الرباعي واللقب', required: true },
  { key: 'nationalId', label: 'الرقم الوطني الموحد', mono: true },
  { key: 'jobTitle', label: 'العنوان الوظيفي والدرجة' },
  { key: 'workplace', label: 'مكان العمل' },
  { key: 'employeeCode', label: 'رمز الموظف', mono: true },
  { key: 'serviceStatus', label: 'الحالة الوظيفية والخدمة' },
  { key: 'enrollmentDept', label: 'دائرة الانتساب الرسمية' },
  { key: 'birthDate', label: 'تاريخ الولادة' },
  { key: 'birthPlace', label: 'محل الولادة' },
  { key: 'housingCardNo', label: 'رقم بطاقة السكن', mono: true },
  { key: 'address', label: 'المحلة والزقاق والدار' },
  { key: 'landmark', label: 'أقرب نقطة دالة' },
  { key: 'phone', label: 'رقم هاتف الاتصال', mono: true }
];

function emptyInput(): CitizenInput {
  return {
    id: null,
    fullName: '',
    nationalId: null,
    jobTitle: null,
    workplace: null,
    employeeCode: null,
    serviceStatus: null,
    birthDate: null,
    birthPlace: null,
    enrollmentDept: null,
    address: null,
    housingCardNo: null,
    landmark: null,
    phone: null,
    photoPath: null,
    category: null,
    notes: null,
    verified: false
  };
}

export default function CitizenForm({
  initial,
  categories,
  onClose,
  onSaved
}: {
  initial: CitizenDetail | null;
  categories: string[];
  onClose: () => void;
  onSaved: (id: number) => void;
}) {
  const [form, setForm] = useState<CitizenInput>(() =>
    initial
      ? {
          id: initial.id,
          fullName: initial.fullName,
          nationalId: initial.nationalId,
          jobTitle: initial.jobTitle,
          workplace: initial.workplace,
          employeeCode: initial.employeeCode,
          serviceStatus: initial.serviceStatus,
          birthDate: initial.birthDate,
          birthPlace: initial.birthPlace,
          enrollmentDept: initial.enrollmentDept,
          address: initial.address,
          housingCardNo: initial.housingCardNo,
          landmark: initial.landmark,
          phone: initial.phone,
          photoPath: initial.photoPath,
          category: initial.category,
          notes: initial.notes,
          verified: initial.verified
        }
      : emptyInput()
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);

  useEffect(() => setError(null), [form.fullName, form.nationalId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (key: keyof CitizenInput, value: string | boolean | null) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function pickPhoto() {
    const picked = await window.diwan.files.pickImage('photos');
    if (picked) set('photoPath', picked);
  }

  async function save() {
    if (!form.fullName.trim()) {
      setError('اسم المواطن مطلوب');
      return;
    }
    setSaving(true);
    try {
      const saved = await window.diwan.citizens.save(form);
      onSaved(saved.id);
    } catch (e) {
      setError(errorText(e, 'تعذّر الحفظ'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-container/45 backdrop-blur-[2px]">
      <div className="w-[min(980px,94vw)] h-[min(760px,92vh)] rounded-xl bg-surface-container-lowest shadow-2xl flex flex-col overflow-hidden">
        <div className="h-14 shrink-0 px-space-lg flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-space-sm">
            <span className="p-1 rounded-lg bg-primary-container text-on-primary">
              <span className="material-symbols-outlined text-[18px]">badge</span>
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface">
              {initial ? 'تعديل بيانات المواطن' : 'إضافة ملف مواطن'}
            </span>
          </div>

          <div className="flex items-center gap-space-sm">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary-fixed text-on-secondary-fixed font-label-md text-label-md font-semibold hover:bg-secondary-fixed-dim transition-colors shadow-sm"
              onClick={() => setWhatsappOpen(true)}
            >
              <span className="material-symbols-outlined text-[18px]">chat_paste</span>
              <span>لصق ذكي من واتساب</span>
            </button>
            <button
              className="w-9 h-9 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors flex items-center justify-center"
              title="إغلاق (Esc)"
              type="button"
              onClick={onClose}
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        <WhatsAppPasteDialog
          isOpen={whatsappOpen}
          onClose={() => setWhatsappOpen(false)}
          onApply={(extracted) => {
            setForm((prev) => ({
              ...prev,
              fullName: extracted.fullName ?? prev.fullName,
              nationalId: extracted.nationalId ?? prev.nationalId,
              phone: extracted.phone ?? prev.phone,
              birthDate: extracted.birthDate ?? prev.birthDate,
              birthPlace: extracted.birthPlace ?? prev.birthPlace,
              housingCardNo: extracted.housingCardNo ?? prev.housingCardNo,
              address: extracted.address ?? prev.address,
              landmark: extracted.landmark ?? prev.landmark,
              jobTitle: extracted.jobTitle ?? prev.jobTitle,
              workplace: extracted.workplace ?? prev.workplace,
              employeeCode: extracted.employeeCode ?? prev.employeeCode,
              notes:
                extracted.notes ??
                (extracted.motherName ? `اسم الأم: ${extracted.motherName}` : prev.notes)
            }));
          }}
        />

        <div className="flex-1 overflow-y-auto p-space-lg space-y-space-md">
          <div className="flex items-start gap-space-lg">
            <div className="flex flex-col items-center gap-space-xs shrink-0">
              <div className="w-24 h-32 rounded-lg bg-surface-container-high overflow-hidden flex items-center justify-center">
                {form.photoPath ? (
                  <img
                    alt=""
                    className="w-full h-full object-cover"
                    src={`diwan://store/${form.photoPath}`}
                  />
                ) : (
                  <span className="material-symbols-outlined text-[32px] text-on-surface-variant">
                    person
                  </span>
                )}
              </div>
              <button
                className="font-label-sm text-label-sm text-secondary font-semibold hover:underline"
                type="button"
                onClick={() => void pickPhoto()}
              >
                {form.photoPath ? 'تغيير الصورة' : 'إضافة صورة 6×4'}
              </button>
              {form.photoPath && (
                <button
                  className="font-label-sm text-label-sm text-error hover:underline"
                  type="button"
                  onClick={() => set('photoPath', null)}
                >
                  إزالة
                </button>
              )}
            </div>

            <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-space-sm">
              {FIELDS.map((f) => (
                <div key={f.key} className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant">
                    {f.label} {f.required && <span className="text-error">*</span>}
                  </label>
                  <input
                    className={f.mono ? `${inputCls} font-mono` : inputCls}
                    type="text"
                    value={(form[f.key] as string | null) ?? ''}
                    onChange={(e) => set(f.key, e.target.value || null)}
                  />
                </div>
              ))}

              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant">
                  التصنيف
                </label>
                <input
                  className={inputCls}
                  type="text"
                  list="citizen-categories"
                  placeholder="تصنيف جديد أو قائم"
                  value={form.category ?? ''}
                  onChange={(e) => set('category', e.target.value || null)}
                />
                <datalist id="citizen-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-label-sm text-on-surface-variant">ملاحظات</label>
            <textarea
              className="w-full p-space-sm rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none focus:ring-1 focus:ring-secondary resize-none"
              rows={3}
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value || null)}
            />
          </div>

          <label className="flex items-center gap-space-sm cursor-pointer">
            <input
              className="w-4 h-4 accent-primary-container"
              type="checkbox"
              checked={form.verified}
              onChange={(e) => set('verified', e.target.checked)}
            />
            <span className="font-label-md text-label-md text-on-surface">
              موثّق ومعتمد رسميًا — طُوبقت مستمسكاته مع الأصل
            </span>
          </label>
        </div>

        <div className="h-16 shrink-0 px-space-lg flex items-center justify-between bg-surface-container-low">
          <span className="font-label-md text-label-md text-error flex items-center gap-space-xs">
            {error && (
              <>
                <span className="material-symbols-outlined text-[18px]">warning</span>
                {error}
              </>
            )}
          </span>
          <div className="flex items-center gap-space-sm">
            <button
              className="px-space-md h-9 rounded-lg text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md"
              type="button"
              onClick={onClose}
            >
              إلغاء
            </button>
            <button
              className="px-space-lg h-9 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold flex items-center gap-space-xs disabled:opacity-40"
              type="button"
              disabled={saving}
              onClick={() => void save()}
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              <span>{saving ? 'جارٍ الحفظ...' : 'حفظ الملف'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
