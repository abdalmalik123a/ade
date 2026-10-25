/**
 * خانة حقل الصورة (S38، DC-2) — في «املأ» بالشبّاك ولوح القيم في المحرّر بدل خانة النصّ: مصغّرةٌ وزرّا «اختر صورة» و«أزل».
 *
 * القيمة مسارٌ في المخزن: صورة الزبون من ملفّه تملؤها «هات الزبون» وحدها (مصدر الحقل `photoPath`)، أو صورةٌ من الجهاز
 * تُنسخ إلى `photos/` كما تُنسخ صورة المعاملة. والصورة كما هي — لا تُقصّ ولا تُجمَّل (ر023).
 */
import { useState } from 'react';
import { errorText } from '../lib/errors';

type Props = {
  fieldKey: string;
  value: string;
  onChange: (path: string) => void;
};

export default function ImageFieldInput({ fieldKey, value, onChange }: Props) {
  const [error, setError] = useState<string | null>(null);

  async function pick() {
    setError(null);
    try {
      const path = await window.diwan.files.pickImage('photos');
      if (path) onChange(path);
    } catch (e) {
      setError(errorText(e, 'تعذّر فتح الصورة'));
    }
  }

  return (
    <span className="flex items-center gap-space-sm" data-image-input={fieldKey}>
      <span className="w-12 h-12 shrink-0 rounded border border-outline-variant bg-surface-container-low flex items-center justify-center overflow-hidden">
        {value ? (
          <img alt="" className="w-full h-full object-contain" data-image-thumb={fieldKey} src={`diwan://store/${value}`} />
        ) : (
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">portrait</span>
        )}
      </span>
      <button className="h-9 px-3 btn-soft font-label-md text-label-md" data-act="pick-field-image" type="button" onClick={() => void pick()}>
        اختر صورة
      </button>
      {value && (
        <button
          className="h-9 px-2 rounded-btn text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md"
          data-act="clear-field-image"
          type="button"
          onClick={() => onChange('')}
        >
          أزل
        </button>
      )}
      {error && <span className="font-label-sm text-label-sm text-error">{error}</span>}
    </span>
  );
}
