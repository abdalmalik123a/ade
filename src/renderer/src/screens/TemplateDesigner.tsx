/**
 * مصمّم النماذج والمُعاملات.
 *
 * المتغيّرات تُشتقّ من المتن نفسه لا من قائمة منفصلة — فلا يمكن أن تتعارض
 * القائمة مع ما هو مكتوب فعلًا. يكتب الموظف {الاسم} فيظهر المتغيّر تلقائيًا.
 */
import { useEffect, useMemo, useState } from 'react';
import DocEditor from '../components/DocEditor';
import { docFromLegacy, docText, type Doc, type Watermark } from '@shared/doc';
import type { Clip, Seal } from '@shared/api';
import type { TemplateDetail } from '@shared/api';
import {
  type TemplateInput,
  type TemplateVariable,
  legacyFieldMeta
} from '@shared/template';
import {
  normalizeLayout, type Letterhead } from '@shared/letterhead';
import { splitSheetHead } from '@shared/sheetHead';
import LetterheadView from '../components/LetterheadView';
import { errorText } from '../lib/errors';

const inputCls =
  'w-full h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary';

export type DesignerProps = {
  initial: TemplateDetail | null;
  /** ورقة Word المستوردة بتنسيقها — تُفتح كما هي، ورأسها فيها. */
  initialDoc?: Doc | null;
  letterheads: Letterhead[];
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
};

export default function TemplateDesigner({
  initial,
  initialDoc = null,
  letterheads,
  categories,
  onClose,
  onSaved,
  onDeleted
}: DesignerProps) {
  const [code, setCode] = useState(initial?.code ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [subjectLine, setSubjectLine] = useState(initial?.subjectLine ?? '');
  const [letterheadId, setLetterheadId] = useState<number | null>(
    // ورقة Word رأسُها فيها — والترويسة الافتراضية فوقها تُخرج كتابًا برأسين.
    initialDoc
      ? (initial?.letterheadId ?? null)
      : (initial?.letterheadId ?? letterheads.find((l) => l.isDefault)?.id ?? null)
  );
  const [variables, setVariables] = useState<TemplateVariable[]>(initial?.variables ?? []);

  /**
   * نموذج مستورد يأتي مملوءًا بلا سجلّ في القاعدة (id = 0): يُحرَّر كالجديد
   * ويُحفظ سجلًّا جديدًا. التمييز بوجود `initial` وحده كان يجعله «تعديلًا»
   * لسجلّ لا وجود له، فيضيع ما استُورد.
   */
  const editing = Boolean(initial && initial.id > 0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [usage, setUsage] = useState(0);
  /** البنية الداخلية كتلٌ لحفظ التنسيق، أمّا واجهة المكتب فهي ورقةٌ واحدة. */
  const [doc, setDoc] = useState<Doc>(
    () => initialDoc ?? docFromLegacy(initial?.bodyHtml ?? '', legacyFieldMeta)
  );
  const [clips, setClips] = useState<Clip[]>([]);

  // وثيقة النموذج المحفوظة كتلًا — وإلا رُحّلت من متنه النصّي.
  useEffect(() => {
    if (!initial || initial.id <= 0) return;
    void window.diwan.templates.doc(initial.id).then((d) => d && setDoc(d));
  }, [initial]);

  /** الشعارات المرفوعة — منها تُختار العلامة المائية الصورية. */
  const [seals, setSeals] = useState<Seal[]>([]);

  useEffect(() => {
    void window.diwan.clips.list().then(setClips);
    void window.diwan.seals.list().then(setSeals);
  }, []);

  const watermark = doc.pageSetup.watermark ?? null;
  /** «شعار» بلا شعارات محفوظة: يُعرض السبب بدل علامةٍ فارغة تُطبع صورةً مكسورة. */
  const [wantImage, setWantImage] = useState(false);

  function setWatermark(next: Watermark | null) {
    setDoc((d) => ({ ...d, pageSetup: { ...d.pageSetup, watermark: next } }));
  }

  // الشعار وحده يُطبع — ختمٌ أو توقيعٌ خلف المتن تزويرٌ لا علامة.
  const sealImages = seals.filter((s) => s.imagePath && s.kind === 'شعار');

  /** «اجعلها كليشة»: ما يتكرّر كتابته يُحفظ عبارةً تُدرج بضغطة. */
  async function saveAsClip() {
    const text = docText(doc);
    if (!text.trim()) {
      setError('لا تُحفظ كليشة فارغة');
      return;
    }
    try {
      await window.diwan.clips.save({
        id: null,
        title: (subjectLine || title || 'كليشة').slice(0, 60),
        body: text,
        category: category.trim() || null
      });
      setClips(await window.diwan.clips.list());
      setError(null);
    } catch (e) {
      setError(errorText(e, 'تعذّر حفظ الكليشة'));
    }
  }

  // المتغيّرات تتبع ما وُضع على الورقة دائمًا.
  useEffect(() => {
    setVariables(
      doc.fields.map((f) => ({
        token: f.key,
        label: f.label,
        source: f.source ? 'citizen' : 'manual',
        required: f.required
      }))
    );
  }, [doc]);

  // الخطأ يُمسح حال التصحيح — إبقاؤه بعد إصلاح السبب تضليل.
  useEffect(() => {
    setError(null);
  }, [title, code, doc]);

  useEffect(() => {
    if (editing && initial) void window.diwan.templates.usage(initial.id).then(setUsage);
  }, [editing, initial]);

  /** ترويسةٌ فُصلت من هذه الورقة الآن — ولم تصل قائمةَ الشاشة بعد. */
  const [savedHead, setSavedHead] = useState<Letterhead | null>(null);
  const heads = savedHead ? [...letterheads.filter((l) => l.id !== savedHead.id), savedHead] : letterheads;
  const letterhead = heads.find((l) => l.id === letterheadId) ?? null;

  /** رأس الورقة إن عُرف حدّه — وبغيره لا يُعرض الاقتراح. */
  const headSplit = useMemo(() => (letterheadId ? null : splitSheetHead(doc)), [doc, letterheadId]);
  const [headName, setHeadName] = useState('');
  useEffect(() => setHeadName(headSplit?.name ?? ''), [headSplit?.name]);

  /**
   * «احفظ أعلى الورقة ترويسةً»: الرأس ينتقل كما هو إلى ترويسة، والورقة تختارها.
   * فما يُرى على الورقة لا يتغيّر — والجديد أن كتابًا آخر للجهة يبدأ برأسها.
   */
  async function saveHead() {
    if (!headSplit) return;
    try {
      const saved = await window.diwan.letterheads.save({
        id: null,
        name: headName.trim() || headSplit.name,
        authorityId: null,
        layout: headSplit.layout,
        category: category.trim() || null
      });
      setSavedHead(saved);
      setDoc(headSplit.doc);
      setLetterheadId(saved.id);
    } catch (e) {
      setError(errorText(e, 'تعذّر حفظ الترويسة'));
    }
  }

  async function save() {
    setError(null);
    if (!title.trim()) {
      setError('عنوان النموذج مطلوب');
      return;
    }
    const text = docText(doc);
    if (!text.trim()) {
      setError('متن النموذج فارغ');
      return;
    }
    setSaving(true);
    try {
      const input: TemplateInput = {
        id: editing && initial ? initial.id : null,
        code: code.trim() || null,
        title,
        subtitle: subtitle.trim() || null,
        category: category.trim() || null,
        subjectLine: subjectLine.trim() || null,
        // ظلٌّ نصّي للبحث؛ والحقيقة في الورقة المحفوظة.
        bodyHtml: text,
        letterheadId,
        variables
      };
      await window.diwan.templates.save({ ...input, doc });
      onSaved();
    } catch (e) {
      setError(errorText(e, 'تعذّر الحفظ'));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing || !initial) return;
    await window.diwan.templates.delete(initial.id);
    onDeleted();
  }

  async function importFile() {
    const imported = await window.diwan.templates.importFile();
    if (!imported) return;
    setTitle(imported.title);
    setDoc(docFromLegacy(imported.body, legacyFieldMeta));
    if (imported.subtitle) setSubtitle(imported.subtitle);
    if (imported.category) setCategory(imported.category);
    if (imported.code) setCode(imported.code);
    if (imported.subjectLine) setSubjectLine(imported.subjectLine);
    setError(imported.warnings.length ? imported.warnings.join(' · ') : null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-primary-container/45 backdrop-blur-[2px]">
      <div className="m-auto w-[min(1520px,98vw)] h-[min(880px,92vh)] rounded-xl bg-surface-container-lowest shadow-2xl flex flex-col overflow-hidden">
        {/* الترويسة */}
        <div className="h-14 shrink-0 px-space-lg flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-space-sm">
            <span className="p-1 rounded-lg bg-primary-container text-on-primary">
              <span className="material-symbols-outlined text-[18px]">data_object</span>
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface">
              {editing ? 'تعديل النموذج' : initial ? 'نموذج مستورد' : 'مصمّم النماذج والمُعاملات'}
            </span>
            {editing && usage > 0 && (
              <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">
                صدر عنه {usage} كتابًا
              </span>
            )}
          </div>
          <div className="flex items-center gap-space-sm">
            <button
              className="flex items-center gap-space-xs px-space-md h-9 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md"
              type="button"
              onClick={() => void importFile()}
            >
              <span className="material-symbols-outlined text-[18px]">file_upload</span>
              <span>استيراد DOCX / XML</span>
            </button>
            <button
              className="flex items-center gap-space-xs px-space-md h-9 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md"
              type="button"
              onClick={() => void saveAsClip()}
            >
              <span className="material-symbols-outlined text-[18px]">bookmark_add</span>
              <span>حفظ ككليشة</span>
            </button>
            <button
              className="w-9 h-9 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors flex items-center justify-center"
              title="إغلاق"
              type="button"
              onClick={onClose}
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* لوح التحرير */}
          <div className="w-[360px] shrink-0 overflow-y-auto p-space-md bg-surface-container-lowest">
            <section className="bg-surface-container-low rounded-xl p-space-md space-y-space-sm">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">تعريف النموذج</h3>
              <div className="grid grid-cols-2 gap-space-sm">
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="font-label-sm text-label-sm text-on-surface-variant">
                    العنوان الإداري <span className="text-error">*</span>
                  </label>
                  <input
                    className={inputCls}
                    type="text"
                    value={title}
                    placeholder="مثال: تأييد استمرار بالخدمة"
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="font-label-sm text-label-sm text-on-surface-variant">
                    وصف مختصر
                  </label>
                  <input
                    className={inputCls}
                    type="text"
                    value={subtitle}
                    placeholder="لمن يوجَّه هذا الكتاب ولأي غرض"
                    onChange={(e) => setSubtitle(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant">
                    كود النموذج
                  </label>
                  <input
                    className={`${inputCls} font-mono`}
                    type="text"
                    value={code}
                    placeholder="اختياري"
                    onChange={(e) => setCode(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant">
                    التصنيف
                  </label>
                  <input
                    className={inputCls}
                    type="text"
                    list="template-categories"
                    value={category}
                    placeholder="تصنيف جديد أو قائم"
                    onChange={(e) => setCategory(e.target.value)}
                  />
                  <datalist id="template-categories">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="font-label-sm text-label-sm text-on-surface-variant">
                    سطر الموضوع (م /)
                  </label>
                  <input
                    className={inputCls}
                    type="text"
                    value={subjectLine}
                    placeholder="مثال: تأييد استمرار بالخدمة"
                    onChange={(e) => setSubjectLine(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="font-label-sm text-label-sm text-on-surface-variant">
                    الترويسة المعتمدة
                  </label>
                  <select
                    className={`${inputCls} cursor-pointer`}
                    value={letterheadId ?? ''}
                    onChange={(e) => setLetterheadId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">— بلا ترويسة محدّدة —</option>
                    {heads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                {headSplit && (
                  <div
                    className="col-span-2 flex flex-col gap-space-xs p-space-sm rounded-lg bg-surface-container-lowest"
                    data-head-offer=""
                  >
                    <span className="font-label-md text-label-md text-on-surface font-semibold">
                      أعلى الورقة يصلح ترويسة
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      تُحفظ كما هي، فتختارها لكتبٍ أخرى من الجهة نفسها. ولا يتغيّر شيءٌ على هذه الورقة.
                    </span>
                    <input
                      className={inputCls}
                      type="text"
                      value={headName}
                      data-head-name=""
                      onChange={(e) => setHeadName(e.target.value)}
                    />
                    <button
                      className="h-9 rounded-lg bg-secondary-fixed text-on-secondary-fixed hover:brightness-95 font-label-md text-label-md font-semibold flex items-center justify-center gap-space-xs"
                      data-act="save-head"
                      type="button"
                      onClick={() => void saveHead()}
                    >
                      <span className="material-symbols-outlined text-[18px]">vertical_align_top</span>
                      احفظ أعلى الورقة ترويسةً
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* العلامة المائية — من الورقة لا من المتن، وتُطبع خلفه باهتةً. */}
            <section className="mt-space-md bg-surface-container-low rounded-xl p-space-md space-y-space-sm">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">العلامة المائية</h3>
              <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-surface-container-lowest">
                {(
                  [
                    { key: 'none', label: 'بلا' },
                    { key: 'text', label: 'نصّ' },
                    { key: 'image', label: 'شعار' }
                  ] as const
                ).map((o) => {
                  const on =
                    o.key === 'none'
                      ? !watermark && !wantImage
                      : o.key === 'text'
                        ? watermark?.kind === 'text'
                        : watermark?.kind === 'image' || (wantImage && !watermark);
                  return (
                    <button
                      key={o.key}
                      className={`h-8 rounded-md font-label-md text-label-md transition-colors ${
                        on
                          ? 'bg-primary-container text-on-primary font-semibold'
                          : 'text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                      data-act={`wm-${o.key}`}
                      type="button"
                      onClick={() => {
                        setWantImage(o.key === 'image');
                        if (o.key === 'none') setWatermark(null);
                        else if (o.key === 'text')
                          setWatermark({
                            kind: 'text',
                            text: watermark?.kind === 'text' ? watermark.text : 'مسودة'
                          });
                        else {
                          const first =
                            sealImages.find((s) => s.kind === 'شعار') ?? sealImages[0] ?? null;
                          setWatermark(first ? { kind: 'image', src: first.imagePath! } : null);
                        }
                      }}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>

              {watermark?.kind === 'text' && (
                <>
                  <input
                    className={inputCls}
                    maxLength={40}
                    type="text"
                    value={watermark.text}
                    onChange={(e) => setWatermark({ kind: 'text', text: e.target.value })}
                  />
                  <div className="flex flex-wrap gap-1">
                    {['مسودة', 'نسخة', 'سري', 'للاستعمال الرسمي'].map((t) => (
                      <button
                        key={t}
                        className="h-7 px-2 rounded-full bg-surface-container-lowest hover:bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm"
                        type="button"
                        onClick={() => setWatermark({ kind: 'text', text: t })}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {(watermark?.kind === 'image' || wantImage) &&
                (sealImages.length === 0 ? (
                  <p className="font-label-sm text-label-sm text-on-surface-variant">
                    لا شعار محفوظ — ارفعه من «الترويسات والشعارات» ثم اختره هنا.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-1">
                    {sealImages.map((s) => (
                      <button
                        key={s.id}
                        className={`p-1 rounded-lg flex flex-col items-center gap-0.5 ${
                          watermark?.kind === 'image' && watermark.src === s.imagePath
                            ? 'bg-secondary-fixed ring-2 ring-secondary'
                            : 'bg-surface-container-lowest hover:bg-surface-container-high'
                        }`}
                        type="button"
                        onClick={() => setWatermark({ kind: 'image', src: s.imagePath! })}
                      >
                        <img alt="" className="w-12 h-12 object-contain" src={`diwan://store/${s.imagePath}`} />
                        <span className="font-label-sm text-label-sm truncate w-full text-center">{s.name}</span>
                      </button>
                    ))}
                  </div>
                ))}

              <p className="font-label-sm text-label-sm text-on-surface-variant">
                تُرسم خلف المتن باهتةً فلا تحجب حرفًا — وتُطبع كما تراها.
              </p>
            </section>
          </div>

          {/* الورقة هي مساحة التأليف الوحيدة؛ المتغيّرات ترافقها في اللوح الجانبي. */}
          <div className="flex-1 min-w-0">
            <DocEditor
              clips={clips}
              doc={doc}
              onChange={setDoc}
              header={
                letterhead?.layout.sheet?.length ? (
                  // رأسٌ من ورقة: بلا فاصلٍ ولا فراغ — فراغه في كتله كما في Word.
                  <LetterheadView layout={normalizeLayout(letterhead.layout)} />
                ) : letterhead ? (
                  <div className="mb-space-md pb-space-md border-b border-outline-variant">
                    <LetterheadView layout={normalizeLayout(letterhead.layout)} />
                    {subjectLine && (
                      <div className="mt-space-md text-center font-bold underline underline-offset-8 text-on-surface text-[15px]">
                        م / {subjectLine}
                      </div>
                    )}
                  </div>
                ) : doc.pageSetup.letterheadMode === 'none' ? null : (
                  <div className="mb-space-md py-space-sm text-center text-on-surface-variant font-label-sm text-label-sm border border-dashed border-outline-variant rounded">
                    بلا ترويسة — اخترها من قسم التعريف
                  </div>
                )
              }
            />
          </div>
        </div>

        {/* التذييل */}
        <div className="h-16 shrink-0 px-space-lg flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-space-sm min-w-0">
            {error && (
              <span className="flex items-center gap-space-xs font-label-md text-label-md text-error truncate">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                {error}
              </span>
            )}
          </div>
          <div className="flex items-center gap-space-sm shrink-0">
            {editing &&
              (confirmDelete ? (
                <div className="flex items-center gap-space-xs">
                  <span className="font-label-sm text-label-sm text-error">
                    {usage > 0 ? `صدر عنه ${usage} كتابًا — احذف؟` : 'تأكيد الحذف؟'}
                  </span>
                  <button
                    className="px-space-md h-9 rounded-lg bg-error text-on-error font-label-md text-label-md font-semibold"
                    type="button"
                    onClick={() => void remove()}
                  >
                    نعم، احذف
                  </button>
                  <button
                    className="px-space-md h-9 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md"
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                  >
                    تراجع
                  </button>
                </div>
              ) : (
                <button
                  className="px-space-md h-9 rounded-lg text-error hover:bg-error-container transition-colors font-label-md text-label-md flex items-center gap-space-xs"
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                  <span>حذف النموذج</span>
                </button>
              ))}
            <button
              className="px-space-md h-9 rounded-lg text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md"
              type="button"
              onClick={onClose}
            >
              إلغاء
            </button>
            <button
              className="px-space-lg h-9 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold flex items-center gap-space-xs transition-all disabled:opacity-40"
              type="button"
              disabled={saving}
              onClick={() => void save()}
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              <span>{saving ? 'جارٍ الحفظ...' : 'حفظ النموذج'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
