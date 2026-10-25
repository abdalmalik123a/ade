/**
 * نموذج إضافة/تعديل ملف مواطن.
 *
 * الخانات من تعريفٍ واحد (`citizenSchema.ts`) بأبوابها الأربعة: الهوية، والبطاقات
 * والأرقام، والسكن والاتصال، والعمل والدراسة — وما تسأل عنه الاستمارات الحكومية فيها.
 */
import { useEffect, useRef, useState } from 'react';
import type { CitizenDetail, CitizenInput } from '@shared/api';
import WhatsAppPasteDialog from './WhatsAppPasteDialog';
import { errorText } from '../lib/errors';
import { useLeaveGuard } from '../kit/useLeaveGuard';
import CameraCapture from '../components/CameraCapture';
import { nationalIdHint, phoneHint } from '@shared/idChecks';
import { CITIZEN_FIELDS, CITIZEN_GROUPS } from '@shared/citizenSchema';

const inputCls =
  'input-field w-full h-9 px-3 text-on-surface font-label-md text-label-md';

function emptyInput(): CitizenInput {
  return {
    ...(Object.fromEntries(CITIZEN_FIELDS.map((f) => [f.key, null])) as Partial<CitizenInput>),
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
  const [form, setForm] = useState<CitizenInput>(() => {
    if (!initial) return emptyInput();
    const { attachments: _a, documents: _d, ...rest } = initial;
    void _a;
    void _d;
    return { ...emptyInput(), ...rest };
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  /** الصورة الشخصية بالكاميرا (ج١٢): إطار ٤×٦ في وسط الصورة، يُحفظ في المخزن. */
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => setError(null), [form.fullName, form.nationalId]);

  // ما كُتب في الملف ولم يُحفظ (ج٤): توقيعُ الخانات مقابل توقيعها حين فُتح النموذج.
  const [opened] = useState(() => JSON.stringify(form));
  const dirty = JSON.stringify(form) !== opened;
  const leave = useLeaveGuard({ label: 'ملف المواطن', dirty, save });

  async function close() {
    if (!(await leave())) return;
    onClose();
  }

  // Esc يغلق أعلى ما هو مفتوح: لصق واتساب أو الكاميرا أوّلًا، ثم النموذج — وهذا يسأل إن كُتب فيه شيء. وكان يغلق النموذج كلَّه
  // ويُضيع ما كُتب لمن ضغطه ليغلق اللصق.
  const escape = useRef<() => void>(() => undefined);
  escape.current = () => {
    if (whatsappOpen) setWhatsappOpen(false);
    else if (cameraOpen) setCameraOpen(false);
    else void close();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      escape.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const set = (key: keyof CitizenInput, value: string | boolean | null) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function pickPhoto() {
    const picked = await window.diwan.files.pickImage('photos');
    if (picked) set('photoPath', picked);
  }

  async function save(): Promise<boolean> {
    if (!form.fullName.trim()) {
      setError('اسم المواطن مطلوب');
      return false;
    }
    setSaving(true);
    try {
      const saved = await window.diwan.citizens.save(form);
      onSaved(saved.id);
      return true;
    } catch (e) {
      setError(errorText(e, 'تعذّر الحفظ'));
      return false;
    } finally {
      setSaving(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/40 backdrop-blur-[2px]" data-citizen-form="">
      <div className="w-[min(980px,94vw)] h-[min(760px,92vh)] surface-panel flex flex-col overflow-hidden">
        <div className="h-14 shrink-0 px-space-lg flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-space-sm">
            <span className="p-1 rounded-ico bg-grad-act text-on-primary shadow-act">
              <span className="material-symbols-outlined text-[18px]">badge</span>
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface">
              {initial ? 'تعديل بيانات المواطن' : 'إضافة ملف مواطن'}
            </span>
          </div>

          <div className="flex items-center gap-space-sm">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-btn bg-secondary-fixed text-on-secondary-fixed font-label-md text-label-md font-semibold hover:bg-secondary-fixed-dim transition-colors shadow-low"
              onClick={() => setWhatsappOpen(true)}
            >
              <span className="material-symbols-outlined text-[18px]">content_paste_go</span>
              <span>لصق ذكي من واتساب</span>
            </button>
            <button
              className="w-9 h-9 rounded-btn text-on-surface-variant hover:bg-surface-container-high transition-colors flex items-center justify-center"
              title="إغلاق (Esc)"
              type="button"
              onClick={() => void close()}
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
              motherName: extracted.motherName ?? prev.motherName,
              notes: extracted.notes ?? prev.notes
            }));
          }}
        />

        {cameraOpen && (
          <CameraCapture
            aspect={{ w: 4, h: 6 }}
            title="الصورة الشخصية 4×6 — الوجه في وسط الإطار"
            onCapture={(dataUrl) => {
              setCameraOpen(false);
              void window.diwan.camera.store(dataUrl).then((src) => set('photoPath', src));
            }}
            onClose={() => setCameraOpen(false)}
          />
        )}

        <div className="flex-1 overflow-y-auto p-space-lg space-y-space-md">
          <div className="flex items-start gap-space-lg">
            <div className="flex flex-col items-center gap-space-xs shrink-0">
              <div className="w-24 h-32 rounded-card bg-surface-container-high overflow-hidden flex items-center justify-center">
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
              <button
                className="font-label-sm text-label-sm text-secondary font-semibold hover:underline flex items-center gap-0.5"
                data-act="camera-photo"
                type="button"
                onClick={() => setCameraOpen(true)}
              >
                <span className="material-symbols-outlined text-[14px]">photo_camera</span>
                بالكاميرا
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

            <div className="flex-1 flex flex-col gap-space-md">
              {CITIZEN_GROUPS.map((group) => (
                <section key={group} className="flex flex-col gap-space-xs" data-citizen-group={group}>
                  <h3 className="font-label-md text-label-md text-secondary font-semibold border-b border-outline-variant pb-1">{group}</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-space-sm">
                    {CITIZEN_FIELDS.filter((f) => f.group === group).map((f) => (
                      <div key={f.key} className="flex flex-col gap-1">
                        <label className="font-label-sm text-label-sm text-on-surface-variant">
                          {f.label} {f.required && <span className="text-error">*</span>}
                        </label>
                        <input
                          className={f.mono ? `${inputCls} font-mono` : inputCls}
                          data-citizen-field={f.key}
                          dir={f.ltr ? 'ltr' : undefined}
                          list={f.options ? `citizen-${f.key}-options` : undefined}
                          placeholder={f.placeholder}
                          type="text"
                          value={(form[f.key] as string | null | undefined) ?? ''}
                          onChange={(e) => set(f.key, e.target.value || null)}
                        />
                        {f.options && (
                          <datalist id={`citizen-${f.key}-options`}>
                            {f.options.map((o) => (
                              <option key={o} value={o} />
                            ))}
                          </datalist>
                        )}
                        {/* تنبيهٌ خفيف لا منع (د١٣) — والرقم الوطني يُحفظ أرقامًا لاتينية بلا شوائب (التدقيق المستقل). */}
                        {(() => {
                          const v = (form[f.key] as string | null | undefined) ?? '';
                          const hint = f.key === 'nationalId' ? nationalIdHint(v) : f.key === 'phone' ? phoneHint(v) : null;
                          return hint ? (
                            <span className="font-label-sm text-label-sm text-tertiary" data-field-hint={f.key}>
                              {hint}
                            </span>
                          ) : null;
                        })()}
                      </div>
                    ))}
                  </div>
                </section>
              ))}

              <div className="flex flex-col gap-1 w-1/3">
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
              className="input-field w-full p-space-sm text-on-surface font-body-md text-body-md resize-none"
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
              className="px-space-md h-9 rounded-btn text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md"
              type="button"
              onClick={() => void close()}
            >
              إلغاء
            </button>
            <button
              className="px-space-lg h-9 btn-act font-label-md text-label-md font-bold flex items-center gap-space-xs disabled:opacity-40"
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
