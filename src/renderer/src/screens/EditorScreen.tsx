/**
 * محرّر الكتب — data-path="smart-editor-a4-preview"
 *
 * **التحرير على الورقة نفسها، والأدوات في الجوانب** (قرار المالك، أيلول ٢٠٢٦): يُكتب
 * الكتاب في الورقة بمحرّر الكتل الذي يؤلّف به مصمّم النماذج — جدولٌ وأعمدةٌ وخطٌّ
 * ومحاذاة وحقول (F4) — والحقل على الورقة يُظهر قيمته حيث كُتب. وفي اللوح الجانبي
 * ما يُعمل عليه بالترتيب: النموذج والترويسة، ثم العدد والتاريخ، ثم القيم، ثم
 * قائمة التحقّق فالإصدار.
 *
 * وكان المتن مربّع نصٍّ بوسوم `{…}` ومعاينةً جانبية، ونموذجٌ مستوردٌ من Word يُحمَّل
 * ظلَّه النصّي فتضيع جداوله وتنسيقه. والمسودات والكتب القديمة تُقرأ وتُرحَّل
 * (`shared/letterDraft.ts`).
 *
 * والورقة التي تُصدر وتُطبع هي `LetterSheet` نفسها التي يُصدر منها الشبّاك — فلا
 * تختلف ورقة المحرّر عن ورقة الشبّاك. ولا توقيع ولا ختم ولا رمز تحقّق: الجهة توقّع
 * وتختم بيدها. ورقم القيد للأرشيف وحده، و«العدد» على الكتاب ما أعطاه الزبون (§١).
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { IssueOutcome, OfficeSettings, TemplateSummary } from '@shared/api';
import { normalizeFold } from '@shared/arabic';
import { docText, type Doc } from '@shared/doc';
import { emptyLayout, type Letterhead, type LetterheadLayout } from '@shared/letterhead';
import { useLearnedGenders } from '../lib/useLearnedGenders';
import { NO_REGISTRY, draftTitle, type Registry } from '@shared/letterDraft';
import { isCombo, shortcut } from '@shared/shortcuts';
import type { HeadChoice } from '../components/PageEditor';
import type { EditorApi } from '../components/editorKit';
import LetterheadView from '../components/LetterheadView';
import LetterSheet, { gapAfter } from '../components/LetterSheet';
import { confirmAction } from '../kit/ask';
import { choosePrinter } from '../lib/printChoice';
import { describeRole } from '@shared/printRoles';
import { AsTemplateDialog, IssueDialog, IssuedDialog, SaveLayoutDialog } from './EditorDialogs';
import { CitizenPicker, FieldPicker } from './EditorPickers';
import SheetArea from './editor/SheetArea';
import { useSheetMeasure } from './editor/useSheetMeasure';
import { useEditorDraft } from './editor/useEditorDraft';
import { useEditorOutput } from './editor/useEditorOutput';
import { blankLetter } from './editor/shared';
import { useEditorDocument } from './editor/useEditorDocument';
import { useEditorValues } from './editor/useEditorValues';
import { useEditorRegistry } from './editor/useEditorRegistry';
import { useEditorChecks } from './editor/useEditorChecks';
import EditorPanel from './editor/EditorPanel';
import HeadDesignerModal from './editor/HeadDesignerModal';

export type EditorHandle = {
  saveDraft: () => void;
  exportPdf: () => void;
  print: () => void;
};

type Props = {
  templateId?: number | null;
  citizenId?: number | null;
  draftId?: number | null;
  documentId?: number | null;
  onStatus?: (status: { transaction: string | null; busy: boolean; exporting: boolean }) => void;
  onIssued?: () => void;
  /** غادر الموظف المحرّر وما كتبه مسودّةٌ في «قيد العمل» — فيُقال له ذلك ويُفتح بضغطة (البند ١٠). */
  onLeave?: (draft: { id: number; title: string }) => void;
};

function EditorScreen(
  { templateId = null, citizenId = null, draftId = null, documentId = null, onStatus, onIssued, onLeave }: Props,
  ref: React.Ref<EditorHandle>
) {
  const [settings, setSettings] = useState<OfficeSettings | null>(null);
  const [letterheads, setLetterheads] = useState<Letterhead[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [clips, setClips] = useState<{ id: number; title: string; body: string }[]>([]);

  const [letterheadId, setLetterheadId] = useState<number | null>(null);
  /** ترويسة هذا الكتاب: نسخةٌ تُحرَّر معه، لا إحالةٌ إلى المحفوظة. */
  const [layout, setLayout] = useState<LetterheadLayout>(emptyLayout());
  const [layoutDirty, setLayoutDirty] = useState(false);
  const [designerOpen, setDesignerOpen] = useState(false);
  const [saveLayoutOpen, setSaveLayoutOpen] = useState(false);

  const [activeTemplate, setActiveTemplate] = useState<number | null>(templateId);
  const [linkedCitizen, setLinkedCitizen] = useState<number | null>(citizenId);
  const [doc, setDocState] = useState<Doc>(blankLetter);
  const [values, setValues] = useState<Record<string, string>>({});
  const [registry, setRegistry] = useState<Registry>(NO_REGISTRY);
  const [docType, setDocType] = useState('');
  /** اسم صاحب العلاقة حين لا حقل للاسم على الورقة — للأرشيف وحده. */
  const [owner, setOwner] = useState('');
  const [genderByHand, setGenderByHand] = useState(false);
  /** ما تعلّمه المكتب من التذكير والتأنيث (ج٤). */
  const [learned, remember] = useLearnedGenders();

  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [trial, setTrial] = useState(false);
  const [tool, setTool] = useState<'find' | 'symbols' | null>(null);
  const [spellOpen, setSpellOpen] = useState(false);

  const [draft, setDraft] = useState<number | null>(draftId);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [fieldPickerOpen, setFieldPickerOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [issued, setIssued] = useState<IssueOutcome | null>(null);
  /** فقراتٌ كُتبت حرفيًّا في ثلاثة كتبٍ فأكثر — يُقترح حفظها كليشة بعد الإصدار (د١٢). */
  const [repeated, setRepeated] = useState<{ text: string; count: number }[]>([]);

  const api = useRef<EditorApi | null>(null);
  const printRef = useRef<HTMLDivElement | null>(null);
  const dirty = useRef(false);
  /** الورقة كما جاءت من نموذجٍ أو مسودّةٍ — فما يختلف عنها كتبه الموظف بيده (ج٣). */
  const baseDoc = useRef<Doc | null>(null);

  // ── الوثيقة والترويسة، وفتح النموذج والمسودّة والكتاب المكرَّر — `editor/useEditorDocument.ts` ──
  const { setDoc, loadTemplate, letterhead, applyLetterhead, storeLayout, liveDoc } = useEditorDocument({
    dirty, setDocState, setSettings, setLetterheads, setTemplates, setClips, templateId, draftId, documentId, toast, setToast,
    letterheads, letterheadId, setLetterheadId, setLayoutDirty, setLayout, doc, layout, setSaveLayoutOpen, setActiveTemplate,
    baseDoc, setDocType, setError, setValues, setRegistry, setOwner, setDraft, setLinkedCitizen
  });

  // ── القيم ────────────────────────────────────────────────────────────
  // ── القيم: صاحب العلاقة والحقول والجنس والكتابة ومن ملفّ الزبون — `editor/useEditorValues.ts` ──
  const { shown, effective, ownerName, needsGender, byRole, nameField, ownerHints, takeOwner, setValue, named, writeWords, fillFromCitizen, addCatalogField } = useEditorValues({
    doc, values, owner, dirty, setError, setValues, setLinkedCitizen, setOwner, setToast, citizenId, genderByHand, learned, trial,
    api, setDoc, setFieldPickerOpen
  });

  // ── العدد والتاريخ ────────────────────────────────────────────────────
  // ── العدد والتاريخ وحقول الترويسة — `editor/useEditorRegistry.ts` ──
  const { headLayout, resolvePrinted, regValues, resolveHead, setReg, stampToday } = useEditorRegistry({
    dirty, setRegistry, registry, shown, effective, layout
  });

  // ── القياس: ارتفاع الترويسة وعدد الصفحات، من الورقة التي تُطبع — `editor/useSheetMeasure.ts` ──
  const { measure } = useSheetMeasure({ printRef, doc, shown, layout, registry });

  // ── قبل الطبع: الإملاء وقائمة التحقّق — `editor/useEditorChecks.ts` ──
  const { checks, spelling, blocked } = useEditorChecks({
    doc, effective, ownerName, headLayout, registry, measure, needsGender, genderByHand, learned
  });

  // ── المسودات ─────────────────────────────────────────────────────────
  const hasContent = Boolean(docText(doc).trim() || ownerName);
  /** كُتب على الورقة شيءٌ بيد الموظف: متنٌ عُدِّل، أو قيمٌ مُلئت، أو صاحب علاقة. */
  const edited = hasContent && (doc !== baseDoc.current || Object.values(values).some((v) => v.trim()) || ownerName !== '');

  /**
   * نموذجٌ آخر من القائمة أو من البحث يحلّ محلّ الورقة (ج٣): كان يمحو الكتاب ويكتب فوق مسودّته بعد ثوانٍ بلا سؤال.
   * فإن كُتب على الورقة شيءٌ سُئل الموظف أوّلًا. (والنموذج الذي يُفتح من المكتبة على ورقةٍ لم يُكتب عليها لا يسأل.)
   */
  async function switchTemplate(id: number | null) {
    if (id !== null && edited) {
      const ok = await confirmAction({
        title: 'استبدال الكتاب الحالي بنموذجٍ آخر؟',
        message: 'يُمحى ما كُتب على هذه الورقة، وتُكتب فوق مسودّتها.',
        confirm: 'استبدله',
        danger: true
      });
      if (!ok) return;
    }
    await loadTemplate(id);
  }
  const savedLetter = () => ({ doc: liveDoc.current, values, registry, layout, docType, owner });
  const draftName = draftTitle({ docType, owner: ownerName, doc, values });
  // ── حفظ المسودة: تلقائيًّا وبـCtrl+S وعند المغادرة والإغلاق — `editor/useEditorDraft.ts` ──
  const { saveDraft } = useEditorDraft({
    draftId, draft, setDraft, hasContent, setError, setSaving, activeTemplate, linkedCitizen, draftName, savedLetter, doc: liveDoc, values,
    setSavedAt, dirty, setToast, registry, layout, owner, onLeave
  });

  // ── الإخراج والإصدار: PDF وWord والصورة، و«اطبع» والتجريبية، و«اجعله نموذجًا» — `editor/useEditorOutput.ts` ──
  const { exportPdf, exportWord, exportPng, requestIssue, issue, printDraftSheet, saveAsTemplate } = useEditorOutput({
    printRef, doc, docType, ownerName, values, effective, headLayout, resolvePrinted, regValues, registry, checks, settings,
    activeTemplate, linkedCitizen, letterhead, letterheadId, byRole, savedLetter, learned, needsGender, genderByHand, remember,
    draft, setDraft, dirty, setExporting, setBusy, setError, setToast, setTrial, setIssueOpen, setIssued, setRepeated,
    setTemplates, setTemplateOpen, onIssued
  });

  const transaction = docType || null;
  useEffect(() => {
    onStatus?.({ transaction, busy, exporting });
  }, [transaction, busy, exporting, onStatus]);

  useImperativeHandle(
    ref,
    () => ({ saveDraft: () => void saveDraft(false), exportPdf: () => void exportPdf(), print: () => requestIssue() }),
    // الورقة من `printRef`، والمقبض يتجدّد مع `checks` (تتبع الوثيقة والقيم وصاحب العلاقة)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [saveDraft, checks, settings]
  );

  // Ctrl+S حفظ مسودة — بموضع المفتاح فتعمل واللوحة عربية. و«هات الزبون» زرٌّ بلا اختصار (ن١٥).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isCombo(e, shortcut('save').combo)) {
        e.preventDefault();
        void saveDraft(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveDraft]);

  /** شريط الورقة: رسمية من المكتبة، أو أسطرٌ في أعلى الورقة، أو بلا (ن١٧). */
  const headChoice: HeadChoice = {
    mode: headLayout ? 'formal' : doc.pageSetup.letterheadMode === 'lines' ? 'lines' : 'none',
    letterheads: letterheads.map((l) => ({ id: l.id, name: l.name })),
    letterheadId,
    onChoose: (c) => {
      applyLetterhead(c.mode === 'formal' ? (letterheads.find((l) => l.id === c.id) ?? null) : null);
      setDoc((d) => ({ ...d, pageSetup: { ...d.pageSetup, letterheadMode: c.mode === 'formal' ? 'print' : c.mode } }));
    },
    // الخطّ تحت الترويسة الرسمية من نسخة الكتاب منها — ورأسٌ من ورقة خطّه في كتله.
    divider:
      headLayout && !layout.sheet?.length
        ? {
            on: layout.divider,
            set: (on) => {
              setLayout((l) => ({ ...l, divider: on }));
              setLayoutDirty(true);
              dirty.current = true;
            }
          }
        : undefined,
    onEdit: () => setDesignerOpen(true)
  };

  // ── الواجهة ──────────────────────────────────────────────────────────
  const head = headLayout ? (
    <div className={gapAfter(headLayout) ? 'mb-space-md' : ''}>
      <LetterheadView layout={headLayout} registryValues={regValues} resolve={resolveHead} />
    </div>
  ) : null;

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full" data-screen="editor">
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* ── اللوح: ما يُعمل عليه بالترتيب ─────────────────────────── */}
        <EditorPanel
          activeTemplate={activeTemplate}
          switchTemplate={switchTemplate}
          templates={templates}
          letterheadId={letterheadId}
          applyLetterhead={applyLetterhead}
          letterheads={letterheads}
          setDesignerOpen={setDesignerOpen}
          layoutDirty={layoutDirty}
          layout={layout}
          setSaveLayoutOpen={setSaveLayoutOpen}
          docType={docType}
          dirty={dirty}
          setDocType={setDocType}
          doc={doc}
          setDoc={setDoc}
          registry={registry}
          setReg={setReg}
          stampToday={stampToday}
          setPickerOpen={setPickerOpen}
          nameField={nameField}
          owner={owner}
          setOwner={setOwner}
          ownerHints={ownerHints}
          takeOwner={takeOwner}
          needsGender={needsGender}
          values={values}
          setGenderByHand={setGenderByHand}
          setValue={setValue}
          named={named}
          api={api}
          writeWords={writeWords}
          setFieldPickerOpen={setFieldPickerOpen}
          checks={checks}
          setSpellOpen={setSpellOpen}
          spellOpen={spellOpen}
          spelling={spelling}
          error={error}
          setError={setError}
          toast={toast}
          busy={busy}
          requestIssue={requestIssue}
          blocked={blocked}
          measure={measure}
          printDraftSheet={printDraftSheet}
          saving={saving}
          savedAt={savedAt}
          hasContent={hasContent}
        />

        {/* ── الورقة ─────────────────────────────────────────────────── */}
        <SheetArea
          view={view}
          setView={setView}
          trial={trial}
          setTrial={setTrial}
          tool={tool}
          setTool={setTool}
          saveDraft={saveDraft}
          setTemplateOpen={setTemplateOpen}
          exporting={exporting}
          busy={busy}
          exportWord={exportWord}
          exportPdf={exportPdf}
          exportPng={exportPng}
          doc={doc}
          templates={templates}
          setDoc={setDoc}
          switchTemplate={switchTemplate}
          api={api}
          clips={clips}
          headChoice={headChoice}
          head={head}
          effective={effective}
          headLayout={headLayout}
          shown={shown}
          regValues={regValues}
          resolveHead={resolveHead}
        />
      </div>

      {/* الورقة التي تُصدر وتُطبع وتُقاس — مرسومةً خارج الشاشة بمقاسها الحقيقي، وبالقيم الحقيقية لا الوهمية. */}
      <div aria-hidden className="fixed top-0 pointer-events-none" style={{ left: -20000 }}>
        <LetterSheet
          doc={doc}
          layout={headLayout}
          values={effective}
          registry={regValues}
          resolve={resolvePrinted}
          sheetRef={(el) => {
            printRef.current = el;
          }}
        />
      </div>

      {pickerOpen && <CitizenPicker onClose={() => setPickerOpen(false)} onPick={(c) => (fillFromCitizen(c), setPickerOpen(false))} />}
      {fieldPickerOpen && <FieldPicker existing={doc.fields.map((f) => f.label)} onClose={() => setFieldPickerOpen(false)} onPick={addCatalogField} />}
      {designerOpen && (
        <HeadDesignerModal
          setDesignerOpen={setDesignerOpen}
          layout={layout}
          setLayout={setLayout}
          setLayoutDirty={setLayoutDirty}
          dirty={dirty}
        />
      )}
      {saveLayoutOpen && <SaveLayoutDialog current={letterhead} onClose={() => setSaveLayoutOpen(false)} onSave={(n, asNew) => void storeLayout(n, asNew)} />}
      {templateOpen && <AsTemplateDialog initial={docType} onClose={() => setTemplateOpen(false)} onSave={(t) => void saveAsTemplate(t)} />}
      {issueOpen && (
        <IssueDialog
          number={registry.number}
          name={ownerName}
          pages={measure.pages}
          printerName={settings ? describeRole(settings.printRoles.documents) : null}
          busy={busy}
          onClose={() => setIssueOpen(false)}
          onIssue={(opts) => void issue(opts)}
        />
      )}
      {issued && (
        <IssuedDialog
          outcome={issued}
          repeated={repeated}
          onSaveClip={async (text) => {
            await window.diwan.clips.save({ id: null, title: text.slice(0, 48), body: text });
            setRepeated((r) => r.filter((x) => x.text !== text));
            setClips(await window.diwan.clips.list());
          }}
          onRejectClip={(text) => {
            // رفضٌ يُقيَّد (FOUNDATION §١٦): فلا تُقترح الفقرة نفسها ثانيةً.
            void window.diwan.learning.record({ kind: 'clip', input: normalizeFold(text).slice(0, 200), suggested: 'save', chosen: 'reject' });
            setRepeated((r) => r.filter((x) => x.text !== text));
          }}
          onClose={() => {
            setIssued(null);
            setRepeated([]);
          }}
          onReprint={async () => {
            const pick = await choosePrinter('documents');
            if (pick) await window.diwan.documents.reprint([issued.id], 1, pick.printer);
          }}
          onExport={async () => {
            const path = await window.diwan.documents.exportPdf(issued.id);
            if (path) setToast(`حُفظ PDF: ${path}`);
          }}
        />
      )}
    </main>
  );
}

export default forwardRef(EditorScreen);
