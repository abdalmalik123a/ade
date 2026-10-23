/**
 * مصمّم النماذج والمُعاملات.
 *
 * المتغيّرات تُشتقّ من المتن نفسه لا من قائمة منفصلة — فلا يمكن أن تتعارض
 * القائمة مع ما هو مكتوب فعلًا. يكتب الموظف {الاسم} فيظهر المتغيّر تلقائيًا.
 */
import { useEffect, useMemo, useState } from 'react';
import PageEditor, { type HeadChoice } from '../components/PageEditor';
import { docFromLegacy, docText, type Doc, type Watermark } from '@shared/doc';
import { normalizeFold } from '@shared/arabic';
import type { Clip, Seal } from '@shared/api';
import type { TemplateDetail } from '@shared/api';
import {
  type TemplateInput,
  type TemplateVariable,
  legacyFieldMeta
} from '@shared/template';
import {
  normalizeLayout, type Letterhead } from '@shared/letterhead';
import LetterheadView from '../components/LetterheadView';
import { errorText } from '../lib/errors';
import { useLeaveGuard } from '../kit/useLeaveGuard';
import WordLossPanel from '../components/WordLosses';
import type { WordScan } from '@shared/wordLosses';
import { docSpelling } from '@shared/spelling';
import DesignerHeader from './templateDesigner/DesignerHeader';
import TemplateFields from './templateDesigner/TemplateFields';
import WatermarkSection from './templateDesigner/WatermarkSection';
import PagesSection from './templateDesigner/PagesSection';
import DesignerFooter from './templateDesigner/DesignerFooter';
import { useSheetHead } from './templateDesigner/useSheetHead';

export type DesignerProps = {
  initial: TemplateDetail | null;
  /** ورقة Word المستوردة بتنسيقها — تُفتح كما هي، ورأسها فيها. */
  initialDoc?: Doc | null;
  /** ما في ملفّ Word ولم يُنقل إلى الورقة (الموجة ٢) — لوحٌ فوقها يُغلق. */
  wordScan?: WordScan | null;
  letterheads: Letterhead[];
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
};

export default function TemplateDesigner({
  initial,
  initialDoc = null,
  wordScan = null,
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
  /** لوح «ما لم يُنقل من Word» أُغلق. */
  const [lossesSeen, setLossesSeen] = useState(false);

  /**
   * نموذج مستورد يأتي مملوءًا بلا سجلّ في القاعدة (id = 0): يُحرَّر كالجديد
   * ويُحفظ سجلًّا جديدًا. التمييز بوجود `initial` وحده كان يجعله «تعديلًا»
   * لسجلّ لا وجود له، فيضيع ما استُورد.
   */
  const editing = Boolean(initial && initial.id > 0);
  const [error, setError] = useState<string | null>(null);
  /** نسخةٌ سابقة حُمّلت ولم تُحفظ بعد — تُذكر حتى يُعتمد بالحفظ أو يُترك. */
  const [restored, setRestored] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [usage, setUsage] = useState(0);
  /** البنية الداخلية كتلٌ لحفظ التنسيق، أمّا واجهة المكتب فهي ورقةٌ واحدة. */
  const [doc, setDoc] = useState<Doc>(
    () => initialDoc ?? docFromLegacy(initial?.bodyHtml ?? '', legacyFieldMeta)
  );
  const [clips, setClips] = useState<Clip[]>([]);
  /** التدقيق الإملائي: اقتراحاتٌ على نصّ النموذج تُختار ثم تُصلح. */
  const [spellOpen, setSpellOpen] = useState(false);
  const spelling = useMemo(() => docSpelling(doc), [doc]);

  // ── ما لم يُحفظ (ج٣) ─────────────────────────────────────────────────
  // × و«إلغاء» والانتقال وإغلاق البرنامج تسأل عمّا عُدِّل ولم يُحفظ: توقيعُ ما في المصمّم مقابل توقيعه حين فُتح. والنموذج المستورد من Word لا أصل له في القاعدة، فهو غير محفوظ منذ فُتح.
  const signature = useMemo(
    () => JSON.stringify([code, title, subtitle, category, subjectLine, letterheadId, variables, doc]),
    [code, title, subtitle, category, subjectLine, letterheadId, variables, doc]
  );
  const [baseline, setBaseline] = useState<string | null>(null);
  /** يُرفع عند التركيب وبعد وصول وثيقة النموذج المحفوظة: يُسجَّل توقيعها أصلًا لا تعديلًا. */
  const [rebase, setRebase] = useState(true);
  useEffect(() => {
    if (!rebase) return;
    setBaseline(signature);
    setRebase(false);
  }, [rebase, signature]);
  const dirty = (!editing && Boolean(initialDoc)) || (baseline !== null && signature !== baseline);
  const leave = useLeaveGuard({ label: 'مصمّم النماذج', dirty, save });

  async function closeDesigner() {
    if (!(await leave())) return;
    onClose();
  }

  // وثيقة النموذج المحفوظة كتلًا — وإلا رُحّلت من متنه النصّي.
  useEffect(() => {
    if (!initial || initial.id <= 0) return;
    void window.diwan.templates.doc(initial.id).then((d) => {
      if (!d) return;
      setDoc(d);
      setRebase(true);
    });
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

  /** شريط الورقة: ترويسة النموذج من المكتبة، أو أسطرٌ في أعلى الورقة، أو بلا (ن١٧). */
  const headChoice: HeadChoice = {
    mode: letterhead ? 'formal' : doc.pageSetup.letterheadMode === 'lines' ? 'lines' : 'none',
    letterheads: heads.map((l) => ({ id: l.id, name: l.name })),
    letterheadId,
    onChoose: (c) => {
      setLetterheadId(c.mode === 'formal' ? c.id : null);
      setDoc((d) => ({ ...d, pageSetup: { ...d.pageSetup, letterheadMode: c.mode === 'formal' ? 'print' : c.mode } }));
    }
  };

  /**
   * رأس الورقة إن عُرف حدّه — وبغيره لا يُعرض الاقتراح.
   *
   * والحدّ يُقترح مما اختاره المكتب لكتب هذه الجهة من قبل (بصمة أعلى الورقة، ج١٣) —
   * وإلا فمن الكاشف. ويُزاد سطرًا ويُنقص، وما صحّحه الموظف يُقيَّد فيُقترح في المرّة القادمة.
   */
  // ── رأس الورقة المكتشَف: أسطره بعادة المكتب، وتصنيفه المقترح، وحفظه ترويسة — `templateDesigner/useSheetHead.ts` ──
  const { catSuggest, headSplit, headLines, setHeadCount, canGrow, habitCount, headCount, edgeHabit, headName, setHeadName, saveHead } = useSheetHead({
    letterheadId, doc, title, category, setSavedHead, setDoc, setLetterheadId, setError
  });

  async function save(): Promise<boolean> {
    setError(null);
    if (!title.trim()) {
      setError('عنوان النموذج مطلوب');
      return false;
    }
    const text = docText(doc);
    if (!text.trim()) {
      setError('متن النموذج فارغ');
      return false;
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
      // تصنيفٌ غير المقترح: تصحيحٌ يُقيَّد لهذا العنوان (والموافقة لا تُقيَّد).
      const chosen = category.trim();
      if (catSuggest && chosen && chosen !== catSuggest.value) {
        void window.diwan.learning.record({ kind: 'category', input: normalizeFold(title), suggested: catSuggest.value, chosen });
      }
      onSaved();
      return true;
    } catch (e) {
      setError(errorText(e, 'تعذّر الحفظ'));
      return false;
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
    // يحلّ محلّ ما على الورقة: يُسأل عمّا لم يُحفظ أوّلًا.
    if (!(await leave())) return;
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
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-stretch bg-scrim/40 backdrop-blur-[2px]">
      <div className="m-auto w-[min(1520px,98vw)] h-[min(880px,92vh)] rounded-xl bg-surface-container-lowest shadow-2xl flex flex-col overflow-hidden">
        {/* الترويسة */}
        <DesignerHeader
          editing={editing}
          initial={initial}
          setTitle={setTitle}
          setCode={setCode}
          setSubtitle={setSubtitle}
          setCategory={setCategory}
          setSubjectLine={setSubjectLine}
          setLetterheadId={setLetterheadId}
          setDoc={setDoc}
          setRestored={setRestored}
          usage={usage}
          importFile={importFile}
          setSpellOpen={setSpellOpen}
          spelling={spelling}
          spellOpen={spellOpen}
          saveAsClip={saveAsClip}
          closeDesigner={closeDesigner}
        />

        <div className="flex-1 flex overflow-hidden">
          {/* لوح التحرير */}
          <div className="w-[360px] shrink-0 overflow-y-auto p-space-md bg-surface-container-lowest">
            {wordScan && !lossesSeen && <WordLossPanel scan={wordScan} onClose={() => setLossesSeen(true)} />}
            <TemplateFields
              title={title}
              setTitle={setTitle}
              subtitle={subtitle}
              setSubtitle={setSubtitle}
              code={code}
              setCode={setCode}
              category={category}
              setCategory={setCategory}
              categories={categories}
              catSuggest={catSuggest}
              subjectLine={subjectLine}
              setSubjectLine={setSubjectLine}
              letterheadId={letterheadId}
              setLetterheadId={setLetterheadId}
              heads={heads}
              doc={doc}
              setDoc={setDoc}
              headSplit={headSplit}
              headLines={headLines}
              setHeadCount={setHeadCount}
              canGrow={canGrow}
              habitCount={habitCount}
              headCount={headCount}
              edgeHabit={edgeHabit}
              headName={headName}
              setHeadName={setHeadName}
              saveHead={saveHead}
            />

            {/* العلامة المائية — من الورقة لا من المتن، وتُطبع خلفه باهتةً. */}
            <WatermarkSection
              watermark={watermark}
              wantImage={wantImage}
              setWantImage={setWantImage}
              setWatermark={setWatermark}
              sealImages={sealImages}
            />

            {/* الصفحات — لكتابٍ يطول فتقسمه الطابعة. ويرثها كل كتابٍ من هذا النموذج. */}
            <PagesSection
              doc={doc}
              setDoc={setDoc}
              letterhead={letterhead}
            />
          </div>

          {/* الورقة هي مساحة التأليف الوحيدة؛ المتغيّرات ترافقها في اللوح الجانبي. */}
          <div className="flex-1 min-w-0">
            <PageEditor
              clips={clips}
              doc={doc}
              footer={letterhead ? normalizeLayout(letterhead.layout).footer : null}
              head={headChoice}
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
                ) : doc.pageSetup.letterheadMode === 'none' || doc.pageSetup.letterheadMode === 'lines' ? null : (
                  <div className="mb-space-md py-space-sm text-center text-on-surface-variant font-label-sm text-label-sm border border-dashed border-outline-variant rounded">
                    بلا ترويسة — اخترها من قسم التعريف
                  </div>
                )
              }
            />
          </div>
        </div>

        {/* التذييل */}
        <DesignerFooter
          restored={restored}
          error={error}
          editing={editing}
          confirmDelete={confirmDelete}
          usage={usage}
          remove={remove}
          setConfirmDelete={setConfirmDelete}
          closeDesigner={closeDesigner}
          saving={saving}
          save={save}
        />
      </div>
    </div>
  );
}
