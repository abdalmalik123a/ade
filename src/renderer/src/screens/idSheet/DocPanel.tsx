/**
 * لوحة المستمسك المحدَّد في «ورقة المستمسكات» (S47): النوع بمقاسه (والمقاس باليد بعد المسطرة)، ووجهٌ واحد أو وجهٌ وظهر،
 * وترتيبهما (جنبًا، أو فوق، أو نصفا الورقة)، وتبديلهما، واستبدال كلّ وجه، وعدد النسخ، والحذف — وما صُغِّر ليسع الورقة يُقال.
 */
import { docType, docTypes, faceLabel, type Arrange, type Face, type SheetDoc } from '@shared/idDocSheet';
import { toIndic } from '@shared/arabic';

type Props = {
  doc: SheetDoc;
  /** أصغر نسبةٍ صُغِّر بها وجهٌ منه ليسع الورقة (١ = بمقاسه). */
  scale: number;
  resolveUrl: (src: string) => string;
  onChange: (patch: Partial<SheetDoc>) => void;
  onPick: (face: Face) => void;
  onDelete: () => void;
  onDone: () => void;
  busy: boolean;
  /** تحت كلّ وجهٍ له صورة: «الأركان الأربعة» و«قصٌّ مستطيل» (ر182) و«دوّر ٩٠°». */
  onTool: (tool: 'corners' | 'rect' | 'rotate', face: Face) => void;
  /** «احفظ في ملفّه»: عدد الوجوه التي لم تُحفظ فيه بعد — و`null` بلا شخص فلا يظهر. */
  toSave: number | null;
  onSave: () => void;
};

const TOOLS: { key: 'corners' | 'rect' | 'rotate'; label: string; title: string }[] = [
  { key: 'corners', label: 'الأركان الأربعة', title: 'اسحب الأركان الأربعة فتُقوَّم الصورة المائلة' },
  { key: 'rect', label: 'قصٌّ مستطيل', title: 'مستطيلٌ بمقابض يُسحب' },
  { key: 'rotate', label: 'دوّر ٩٠°', title: 'الصورة الممسوحة على جنبها — والخانة بمقاسها' }
];

const ARRANGE: { key: Arrange; label: string }[] = [
  { key: 'side', label: 'جنبًا' },
  { key: 'over', label: 'فوق' },
  { key: 'halves', label: 'نصفا الورقة' }
];

const chip = (on: boolean) =>
  `flex-1 h-8 rounded-btn font-label-sm text-label-sm ${on ? 'bg-primary-fixed text-primary font-semibold' : 'border border-outline-variant hover:bg-surface-container-high'}`;

export default function DocPanel({ doc, scale, resolveUrl, onChange, onPick, onDelete, onDone, busy, onTool, toSave, onSave }: Props) {
  const type = docType(doc.typeKey);
  const num = (v: string, fallback: number) => {
    const n = Number(v.replace('٫', '.').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))));
    return Number.isFinite(n) && n >= 10 && n <= 420 ? n : fallback;
  };
  const faces: Face[] = doc.faces === 2 ? ['front', 'back'] : ['front'];
  return (
    <div className="w-[24rem] shrink-0 overflow-y-auto p-space-md flex flex-col gap-space-sm bg-surface-container-low border-l border-outline-variant/40" data-doc-panel={doc.id}>
      <div className="flex items-center justify-between">
        <h3 className="font-title-md text-title-md text-on-surface">{doc.label}</h3>
        <button className="h-8 px-2 rounded-btn text-secondary hover:bg-surface-container-high font-label-sm text-label-sm" data-act="doc-done" type="button" onClick={onDone}>
          خيارات الورقة
        </button>
      </div>

      <label className="flex flex-col gap-1 font-label-sm text-label-sm text-on-surface-variant">
        النوع
        <select
          className="input-field h-9 px-2 text-on-surface"
          data-doc-type=""
          value={doc.typeKey}
          onChange={(e) => {
            const t = docType(e.target.value);
            onChange({ typeKey: t.key, label: t.label, w: t.w, h: t.h, faces: t.faces === 2 || doc.back ? 2 : 1 });
          }}
        >
          {docTypes().map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-end gap-space-xs font-label-sm text-label-sm text-on-surface-variant">
        <label className="flex-1 min-w-0 flex flex-col gap-1">
          العرض (ملم)
          <input key={`w${doc.id}${doc.w}`} className="input-field h-9 w-full min-w-0 px-2 text-on-surface" data-doc-w="" defaultValue={doc.w} onBlur={(e) => onChange({ w: num(e.target.value, doc.w) })} />
        </label>
        <label className="flex-1 min-w-0 flex flex-col gap-1">
          الطول (ملم)
          <input key={`h${doc.id}${doc.h}`} className="input-field h-9 w-full min-w-0 px-2 text-on-surface" data-doc-h="" defaultValue={doc.h} onBlur={(e) => onChange({ h: num(e.target.value, doc.h) })} />
        </label>
        <button className="h-9 w-9 shrink-0 rounded-btn border border-outline-variant hover:bg-surface-container-high" title="اقلب: العرض طولًا والطول عرضًا" type="button" onClick={() => onChange({ w: doc.h, h: doc.w })}>
          <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
        </button>
      </div>
      {(doc.w !== type.w || doc.h !== type.h) && (
        <button className="self-start text-secondary font-label-sm text-label-sm hover:underline" type="button" onClick={() => onChange({ w: type.w, h: type.h })}>
          ↺ مقاس النوع
        </button>
      )}
      {type.note && <p className="font-label-sm text-label-sm text-on-surface-variant">{type.note}</p>}
      {scale < 1 && (
        <p className="font-label-sm text-label-sm text-tertiary" data-doc-scaled="">
          أكبر من الورقة بهوامشها، فيُطبع مصغّرًا {toIndic(Math.round(scale * 100))}٪ — لا يُقصّ منه شيء.
        </p>
      )}

      <div className="flex gap-1" role="group">
        <button className={chip(doc.faces === 1)} data-act="doc-faces-1" type="button" onClick={() => onChange({ faces: 1 })}>
          وجهٌ واحد
        </button>
        <button className={chip(doc.faces === 2)} data-act="doc-faces-2" type="button" onClick={() => onChange({ faces: 2 })}>
          وجهٌ وظهر
        </button>
      </div>
      {doc.faces === 2 && (
        <div className="flex gap-1" role="group">
          {ARRANGE.map((a) => (
            <button key={a.key} className={chip(doc.arrange === a.key)} data-arrange={a.key} type="button" onClick={() => onChange({ arrange: a.key })}>
              {a.label}
            </button>
          ))}
        </div>
      )}

      {faces.map((face) => {
        const src = face === 'front' ? doc.front : doc.back;
        return (
          <div key={face} className="rounded-card bg-surface-container-lowest border border-outline-variant p-space-xs flex flex-col gap-1" data-doc-face={face}>
            <div className="flex items-center gap-space-xs">
              <div className="w-20 h-14 shrink-0 rounded-md bg-surface-container-high overflow-hidden flex items-center justify-center">
                {src ? (
                  <img alt="" className="w-full h-full object-contain" src={resolveUrl(src)} />
                ) : (
                  <span className="material-symbols-outlined text-on-surface-variant/40">image</span>
                )}
              </div>
              <div className="flex-1 min-w-0 font-label-sm text-label-sm text-on-surface">{faceLabel(doc, face)}</div>
              <button className="h-8 px-2 rounded-btn border border-outline-variant hover:bg-surface-container-high font-label-sm text-label-sm" data-act={`doc-replace-${face}`} type="button" onClick={() => onPick(face)}>
                {src ? 'استبدل' : 'املأ'}
              </button>
            </div>
            {src && (
              <div className="flex gap-1">
                {TOOLS.map((t) => (
                  <button
                    key={t.key}
                    className="flex-1 h-8 rounded-btn border border-outline-variant hover:bg-surface-container-high font-label-sm text-label-sm disabled:opacity-40"
                    data-act={`face-${t.key}-${face}`}
                    disabled={busy}
                    title={t.title}
                    type="button"
                    onClick={() => onTool(t.key, face)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {doc.faces === 2 && (
        <button className="h-8 rounded-btn border border-outline-variant hover:bg-surface-container-high font-label-sm text-label-sm flex items-center justify-center gap-1" data-act="doc-swap" type="button" onClick={() => onChange({ front: doc.back, back: doc.front })}>
          <span className="material-symbols-outlined text-[16px]">swap_vert</span>
          بدّل الوجه والظهر
        </button>
      )}

      <label className="flex items-center gap-space-xs font-label-sm text-label-sm text-on-surface">
        النسخ على الورقة
        <input
          className="input-field h-8 w-20 px-2"
          data-doc-copies=""
          max={20}
          min={1}
          type="number"
          value={doc.copies}
          onChange={(e) => onChange({ copies: Math.min(20, Math.max(1, Math.round(Number(e.target.value) || 1))) })}
        />
      </label>

      {toSave !== null && (
        <button
          className="h-9 rounded-btn border border-outline-variant hover:bg-surface-container-high font-label-md text-label-md flex items-center justify-center gap-1 disabled:opacity-50"
          data-act="doc-save-file"
          disabled={busy || toSave === 0}
          type="button"
          onClick={onSave}
        >
          <span className="material-symbols-outlined text-[18px]">{toSave ? 'save' : 'check'}</span>
          {toSave ? 'احفظ في ملفّه' : 'في ملفّه'}
        </button>
      )}

      <button className="mt-auto h-9 rounded-btn text-error hover:bg-error-container font-label-md text-label-md flex items-center justify-center gap-1" data-act="doc-delete" type="button" onClick={onDelete}>
        <span className="material-symbols-outlined text-[18px]">delete</span>
        احذفه من الورقة
      </button>
    </div>
  );
}
