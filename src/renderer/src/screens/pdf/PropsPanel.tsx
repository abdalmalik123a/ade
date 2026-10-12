/**
 * لوح الخصائص في محرّر PDF (تقسيم الشاشة بعد ١٫٧٫٠) — منقولٌ من `PdfScreen` كما هو: العنصر المحدَّد بخطّه وحجمه ولونه، والاستمارة
 * القابلة للتعبئة، وشرح ما يُفعل.
 */
import type { Dispatch, SetStateAction } from 'react';
import { toIndic } from '@shared/arabic';
import { PDF_FONTS, type FracBox, type PageRef, type Overlay, type TextOverlay, type ImageOverlay } from '@shared/pdfEdit';
import { fieldsWord, type Src } from './pdfPages';

type Props = {
  crop: FracBox | null;
  btn: 'h-9 px-space-sm rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md flex items-center gap-1 disabled:opacity-40';
  applyCrop: (scope: 'page' | 'targets' | 'clear') => void;
  selected: string[];
  currentRef: PageRef | null;
  setCrop: Dispatch<SetStateAction<FracBox | null>>;
  activeOverlay: Overlay | null;
  patch: (id: string, p: Partial<TextOverlay> | Partial<ImageOverlay>) => void;
  current: string | null;
  setOverlays: Dispatch<SetStateAction<Overlay[]>>;
  setActive: Dispatch<SetStateAction<string | null>>;
  sources: Record<string, Src>;
  formFilled: string[];
  formCitizen: { id: number; fullName: string; } | null;
  formQuery: string;
  setFormCitizen: Dispatch<SetStateAction<{ id: number; fullName: string; } | null>>;
  setFormQuery: Dispatch<SetStateAction<string>>;
  formHits: { id: number; fullName: string; }[];
  setFormHits: Dispatch<SetStateAction<{ id: number; fullName: string; }[]>>;
  fillForm: (sourceId: string) => Promise<void>;
};

export default function PropsPanel({ crop, btn, applyCrop, selected, currentRef, setCrop, activeOverlay, patch, current, setOverlays, setActive, sources, formFilled, formCitizen, formQuery, setFormCitizen, setFormQuery, formHits, setFormHits, fillForm }: Props) {
  return (
    <aside className="w-72 shrink-0 border-r border-outline-variant bg-surface-container-lowest p-space-md overflow-y-auto space-y-space-sm" data-pdf-props="">
      {crop ? (
        <div className="space-y-space-xs">
          <h2 className="font-label-lg text-label-lg font-bold">القصّ</h2>
          <p className="font-label-sm text-label-sm text-on-surface-variant">اسحب الصندوق وكبّره من زاويته: ما خارجه لا يظهر في الملف الجديد.</p>
          <button className={`${btn} w-full justify-center`} data-act="pdf-crop-page" type="button" onClick={() => applyCrop('page')}>
            طبّق على هذه الصفحة
          </button>
          {selected.length > 1 && (
            <button className={`${btn} w-full justify-center`} data-act="pdf-crop-selected" type="button" onClick={() => applyCrop('targets')}>
              على الصفحات المحدَّدة ({toIndic(selected.length)})
            </button>
          )}
          {currentRef?.crop && (
            <button className={`${btn} w-full justify-center`} type="button" onClick={() => applyCrop('clear')}>
              أزل القصّ
            </button>
          )}
          <button className="w-full h-8 font-label-md text-label-md text-on-surface-variant hover:underline" type="button" onClick={() => setCrop(null)}>
            تراجع
          </button>
        </div>
      ) : activeOverlay ? (
        <div className="space-y-space-sm">
          <h2 className="font-label-lg text-label-lg font-bold">{activeOverlay.kind === 'text' ? 'النصّ' : 'الصورة'}</h2>
          {activeOverlay.kind === 'text' && (
            <>
              <textarea
                className="w-full h-20 p-2 rounded-lg bg-surface-container-low border border-outline-variant font-body-md text-body-md"
                data-pdf-overlay-text=""
                dir="auto"
                value={activeOverlay.text}
                onChange={(e) => patch(activeOverlay.id, { text: e.target.value })}
              />
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                للترقيم اكتب <b>{'{رقم}'}</b> و<b>{'{عدد}'}</b> (أو <b dir="ltr">{'{n}'}</b> و<b dir="ltr">{'{N}'}</b> بالأرقام الإنكليزية) — فتُرى كلّ صفحةٍ برقمها.
              </p>
              <label className="flex items-center gap-2 font-label-md text-label-md">
                الخطّ
                <select className="flex-1 h-8 rounded bg-surface-container-low" value={activeOverlay.font} onChange={(e) => patch(activeOverlay.id, { font: e.target.value })}>
                  {PDF_FONTS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center gap-2 font-label-md text-label-md">
                <label className="flex items-center gap-1">
                  الحجم
                  <input className="w-16 h-8 px-1 rounded bg-surface-container-low" data-pdf-size="" min={6} max={200} type="number" value={activeOverlay.size} onChange={(e) => patch(activeOverlay.id, { size: Number(e.target.value) || 12 })} />
                </label>
                <input className="w-10 h-8" title="اللون" type="color" value={activeOverlay.color} onChange={(e) => patch(activeOverlay.id, { color: e.target.value })} />
                <button className={`h-8 w-8 rounded ${activeOverlay.bold ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high'}`} title="عريض" type="button" onClick={() => patch(activeOverlay.id, { bold: !activeOverlay.bold })}>
                  <span className="material-symbols-outlined text-[18px]">format_bold</span>
                </button>
              </div>
              <div className="flex gap-1">
                {(['right', 'center', 'left'] as const).map((a) => (
                  <button
                    key={a}
                    className={`flex-1 h-8 rounded ${activeOverlay.align === a ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high'}`}
                    type="button"
                    onClick={() => patch(activeOverlay.id, { align: a })}
                  >
                    <span className="material-symbols-outlined text-[18px]">{a === 'right' ? 'format_align_right' : a === 'center' ? 'format_align_center' : 'format_align_left'}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          <label className="block font-label-md text-label-md">
            الشفافية: {toIndic(Math.round(activeOverlay.opacity * 100))}٪
            <input className="w-full" max={100} min={5} type="range" value={Math.round(activeOverlay.opacity * 100)} onChange={(e) => patch(activeOverlay.id, { opacity: Number(e.target.value) / 100 })} />
          </label>
          <label className="block font-label-md text-label-md">
            الميل: <span dir="ltr">{toIndic(activeOverlay.angle)}°</span>
            <input className="w-full" max={90} min={-90} type="range" value={activeOverlay.angle} onChange={(e) => patch(activeOverlay.id, { angle: Number(e.target.value) })} />
          </label>
          <div className="font-label-md text-label-md space-y-1">
            <span className="font-semibold">يظهر في</span>
            <label className="flex items-center gap-2">
              <input checked={activeOverlay.pages !== 'all'} data-pdf-scope="page" name="scope" type="radio" onChange={() => current && patch(activeOverlay.id, { pages: [current] })} />
              هذه الصفحة
            </label>
            {selected.length > 1 && (
              <label className="flex items-center gap-2">
                <input checked={false} name="scope" type="radio" onChange={() => patch(activeOverlay.id, { pages: [...selected] })} />
                الصفحات المحدَّدة ({toIndic(selected.length)})
              </label>
            )}
            <label className="flex items-center gap-2">
              <input checked={activeOverlay.pages === 'all'} data-pdf-scope="all" name="scope" type="radio" onChange={() => patch(activeOverlay.id, { pages: 'all' })} />
              كلّ الصفحات
            </label>
          </div>
          <button
            className="w-full h-9 rounded-lg bg-error-container text-on-error-container font-label-md text-label-md"
            data-act="pdf-overlay-delete"
            type="button"
            onClick={() => {
              setOverlays((os) => os.filter((o) => o.id !== activeOverlay.id));
              setActive(null);
            }}
          >
            احذف (Delete)
          </button>
        </div>
      ) : (
        <div className="font-label-md text-label-md text-on-surface-variant space-y-2">
          {(() => {
            const src = currentRef ? sources[currentRef.source] : undefined;
            const empty = (src?.fields ?? []).filter((f) => f.kind !== 'check' && !f.value.trim());
            if (!src || !src.fields?.length) return null;
            const done = formFilled.includes(src.id);
            return (
              <div className="rounded-lg bg-secondary-container/40 p-space-sm space-y-space-xs text-on-surface" data-pdf-form={src.fields.length}>
                <p className="font-semibold">
                  استمارةٌ قابلة للتعبئة: {fieldsWord(new Set(src.fields.map((f) => f.name)).size)}، الفارغ منها {toIndic(empty.length)}
                </p>
                {done ? (
                  <p>صارت حقولها طبقاتٍ في مواضعها — انقر أيّ حقلٍ لتكتبه. وما كان فيه قيمةٌ يبقى كما كُتب.</p>
                ) : (
                  <>
                    <p>تصير حقولها الفارغة نصوصًا في مواضعها، تُملأ من ملف مواطنٍ بمعنى كلّ حقلٍ من اسمه — والعربية موصولة.</p>
                    <input
                      className="w-full h-8 px-2 rounded bg-surface-container-lowest border border-outline-variant"
                      data-form-citizen=""
                      placeholder="ابحث عن مواطن (اختياري)"
                      value={formCitizen ? formCitizen.fullName : formQuery}
                      onChange={(e) => {
                        setFormCitizen(null);
                        setFormQuery(e.target.value);
                      }}
                    />
                    {!formCitizen &&
                      formHits.map((c) => (
                        <button
                          key={c.id}
                          className="block w-full text-right px-2 py-1 rounded hover:bg-surface-container-high"
                          data-form-citizen-pick={c.id}
                          type="button"
                          onClick={() => {
                            setFormCitizen(c);
                            setFormHits([]);
                          }}
                        >
                          {c.fullName}
                        </button>
                      ))}
                    <button
                      className="w-full h-9 rounded-lg bg-primary-container text-on-primary font-semibold disabled:opacity-40"
                      data-act="form-fill"
                      disabled={!empty.length}
                      type="button"
                      onClick={() => void fillForm(src.id)}
                    >
                      {formCitizen ? `املأها من ملف ${formCitizen.fullName}` : 'اجعل حقولها نصوصًا تُكتب'}
                    </button>
                  </>
                )}
              </div>
            );
          })()}
          <p>اختر صفحةً من اليمين، أو حدّد عدّة صفحاتٍ بمربّعاتها لتُدار أو تُحذف أو تُستخرج معًا.</p>
          <p>«نصّ» و«شعار» يُضافان إلى الصفحة الحالية، و«علامة مائية» إلى الصفحات كلّها — واسحب أيَّ عنصرٍ إلى موضعه.</p>
          <p>وترتيب الصفحات بالسحب، أو بالسهمين. وCtrl+Z يتراجع عن آخر تعديل.</p>
          <p>و«الحجم» حدُّ خانة الرفع: ما تجاوزه تصير صفحاته صورًا بأجود درجةٍ تبلغه — في الحفظ والصور.</p>
        </div>
      )}
    </aside>
  );
}
