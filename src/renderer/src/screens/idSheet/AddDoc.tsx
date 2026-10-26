/**
 * الإضافة المباشرة في «ورقة المستمسكات» (S47): «＋» ثم النوع بمقاسه و«وجهٌ واحد» أو «وجهٌ وظهر» — ثم المصدر لكلّ وجه:
 * الماسح، أو الكاميرا، أو صورةٌ من الحاسوب، أو مستمسكٌ في ملفّ الشخص. والظهر يُطلب بعد الوجه وحده، و«بلا ظهر» يجعله وجهًا واحدًا.
 */
import { useState } from 'react';
import type { Attachment } from '@shared/api';
import { docTypes, type Face } from '@shared/idDocSheet';
import { toIndic } from '@shared/arabic';
import { useEscape } from '../../kit/useEscape';

const size = (w: number, h: number) => `${toIndic(String(w).replace('.', '٫'))} × ${toIndic(String(h).replace('.', '٫'))} ملم`;

/** قائمة الأنواع: لكلٍّ مقاسه، وزرّاه «وجهٌ واحد» و«وجهٌ وظهر» (الافتراض من النوع بارز). */
export function AddMenu({
  onAdd,
  onMulti,
  onClose
}: {
  onAdd: (typeKey: string, faces: 1 | 2) => void;
  /** «عدّة بطاقاتٍ بمسحةٍ واحدة»: كلّها من نوعٍ يُختار مرّةً للدفعة. */
  onMulti: (typeKey: string) => void;
  onClose: () => void;
}) {
  useEscape(onClose);
  const [multiType, setMultiType] = useState('national');
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[86vh] overflow-y-auto rounded-card shadow-card bg-surface-container-lowest p-space-md flex flex-col gap-space-xs"
        data-add-doc=""
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-title-md text-title-md text-on-surface">أيّ مستمسك؟</h3>
          <button className="w-8 h-8 rounded-btn hover:bg-surface-container-high" title="إغلاق" type="button" onClick={onClose}>
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="flex items-center gap-space-sm rounded-card bg-primary-fixed/40 border border-outline-variant p-space-xs" data-add-multi="">
          <span className="material-symbols-outlined text-secondary">view_module</span>
          <div className="flex-1 min-w-0 font-label-md text-label-md text-on-surface">عدّة بطاقاتٍ بمسحةٍ واحدة</div>
          <select className="input-field h-8 px-1 font-label-sm text-label-sm" value={multiType} onChange={(e) => setMultiType(e.target.value)}>
            {docTypes().map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
          <button className="h-8 px-2 rounded-btn btn-soft font-label-sm text-label-sm" data-act="add-multi" type="button" onClick={() => onMulti(multiType)}>
            ابدأ
          </button>
        </div>
        {docTypes().map((t) => (
          <div key={t.key} className="flex items-center gap-space-sm rounded-card border border-outline-variant p-space-xs" data-add-type={t.key}>
            <div className="flex-1 min-w-0">
              <div className="font-label-md text-label-md text-on-surface">{t.label}</div>
              <div className="font-label-sm text-label-sm text-on-surface-variant">
                {size(t.w, t.h)}
                {t.note ? ` — ${t.note}` : ''}
              </div>
            </div>
            {([1, 2] as const).map((faces) => (
              <button
                key={faces}
                className={`h-8 px-2 rounded-btn font-label-sm text-label-sm ${faces === t.faces ? 'btn-soft' : 'border border-outline-variant hover:bg-surface-container-high'}`}
                data-faces={faces}
                type="button"
                onClick={() => onAdd(t.key, faces)}
              >
                {faces === 1 ? 'وجهٌ واحد' : 'وجهٌ وظهر'}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

type SourceProps = {
  title: string;
  face: Face;
  attachments: Attachment[];
  busy: boolean;
  /** يُعرض للظهر حين يُطلب بعد الوجه: «بلا ظهر» يجعل المستمسك وجهًا واحدًا. */
  offerNoBack: boolean;
  onScan: () => void;
  onCamera: () => void;
  onFile: () => void;
  onAttachment: (path: string) => void;
  onNoBack: () => void;
  onClose: () => void;
};

/** من أين الوجه؟ — الماسح أوّلًا كما يعمل المكتب. */
export function SourcePicker({ title, face, attachments, busy, offerNoBack, onScan, onCamera, onFile, onAttachment, onNoBack, onClose }: SourceProps) {
  useEscape(onClose);
  const big = 'h-12 px-space-md rounded-btn flex items-center gap-space-sm font-label-md text-label-md disabled:opacity-40';
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-card shadow-card bg-surface-container-lowest p-space-md flex flex-col gap-space-sm"
        data-source-picker={face}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-title-md text-title-md text-on-surface">{title}</h3>
          <button className="w-8 h-8 rounded-btn hover:bg-surface-container-high" title="إغلاق" type="button" onClick={onClose}>
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <button className={`${big} btn-act`} data-act={face === 'front' ? 'scan-front' : 'scan-back'} disabled={busy} type="button" onClick={onScan}>
          <span className="material-symbols-outlined">scanner</span>
          امسح بالماسح الضوئي
        </button>
        <button className={`${big} border border-outline-variant hover:bg-surface-container-high`} data-act="source-camera" disabled={busy} type="button" onClick={onCamera}>
          <span className="material-symbols-outlined">photo_camera</span>
          صوّره بالكاميرا
        </button>
        <button className={`${big} border border-outline-variant hover:bg-surface-container-high`} data-act="source-file" disabled={busy} type="button" onClick={onFile}>
          <span className="material-symbols-outlined">image</span>
          افتح الصورة
        </button>
        {attachments.length > 0 && (
          <select
            className="input-field h-10 px-2 font-label-md text-label-md"
            data-source-attachment=""
            value=""
            onChange={(e) => e.target.value && onAttachment(e.target.value)}
          >
            <option value="">من ملفّه…</option>
            {attachments.map((a) => (
              <option key={a.id} value={a.filePath}>
                {a.docType || 'مستمسك'}
              </option>
            ))}
          </select>
        )}
        {offerNoBack && (
          <button className="h-9 rounded-btn text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md" data-act="source-no-back" type="button" onClick={onNoBack}>
            بلا ظهر — وجهٌ واحد
          </button>
        )}
      </div>
    </div>
  );
}
