/**
 * لوح المحرّر بأقسامه الأربعة و«اطبع» في أسفله (تقسيمه بعد ١٫٧٫٠) — منقولٌ من `EditorScreen` كما هو، والأقسام في ملفّاتها.
 */
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import TemplateSection from './TemplateSection';
import RegistrySection from './RegistrySection';
import ValuesSection from './ValuesSection';
import ChecksSection from './ChecksSection';
import PrintBar from './PrintBar';
import type { TemplateSummary } from '@shared/api';
import type { Letterhead, LetterheadLayout } from '@shared/letterhead';
import type { Doc } from '@shared/doc';
import type { Registry } from '@shared/letterDraft';
import type { EditorApi } from '../../components/editorKit';
import type { DocField } from '@shared/doc';
import type { Check } from '@shared/letterDraft';
import type { SpellIssue } from '@shared/spelling';

type Props = {
  activeTemplate: number | null;
  switchTemplate: (id: number | null) => Promise<void>;
  templates: TemplateSummary[];
  letterheadId: number | null;
  applyLetterhead: (found: Letterhead | null, blank?: boolean, keepMargins?: boolean) => void;
  letterheads: Letterhead[];
  setDesignerOpen: Dispatch<SetStateAction<boolean>>;
  layoutDirty: boolean;
  layout: LetterheadLayout;
  setSaveLayoutOpen: Dispatch<SetStateAction<boolean>>;
  docType: string;
  dirty: MutableRefObject<boolean>;
  setDocType: Dispatch<SetStateAction<string>>;
  doc: Doc;
  setDoc: (next: Doc | ((d: Doc) => Doc)) => void;
  registry: Registry;
  setReg: (patch: Partial<Registry>) => void;
  stampToday: () => void;
  setPickerOpen: Dispatch<SetStateAction<boolean>>;
  nameField: DocField | null;
  owner: string;
  setOwner: Dispatch<SetStateAction<string>>;
  ownerHints: string[];
  takeOwner: (name: string) => void;
  needsGender: boolean;
  values: Record<string, string>;
  setGenderByHand: Dispatch<SetStateAction<boolean>>;
  setValue: (key: string, value: string) => void;
  named: { id: string; token: string; label: string; value: string; }[];
  api: MutableRefObject<EditorApi | null>;
  writeWords: (key: string) => void;
  setFieldPickerOpen: Dispatch<SetStateAction<boolean>>;
  checks: Check[];
  setSpellOpen: Dispatch<SetStateAction<boolean>>;
  spellOpen: boolean;
  spelling: SpellIssue[];
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  toast: string | null;
  busy: boolean;
  requestIssue: () => void;
  blocked: boolean;
  measure: { headRatio: number | null; pages: number | null; };
  printDraftSheet: () => Promise<void>;
  saving: boolean;
  savedAt: Date | null;
  hasContent: boolean;
};

export default function EditorPanel({ activeTemplate, switchTemplate, templates, letterheadId, applyLetterhead, letterheads, setDesignerOpen, layoutDirty, layout, setSaveLayoutOpen, docType, dirty, setDocType, doc, setDoc, registry, setReg, stampToday, setPickerOpen, nameField, owner, setOwner, ownerHints, takeOwner, needsGender, values, setGenderByHand, setValue, named, api, writeWords, setFieldPickerOpen, checks, setSpellOpen, spellOpen, spelling, error, setError, toast, busy, requestIssue, blocked, measure, printDraftSheet, saving, savedAt, hasContent }: Props) {
  return (
    <aside className="w-[400px] shrink-0 h-full flex flex-col bg-surface-container-low" data-editor-panel="">
      <div className="flex-1 min-h-0 overflow-y-auto p-space-md flex flex-col gap-space-md" data-editor-steps="">
        {/* ١ — النموذج والترويسة */}
        <TemplateSection
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
        />

        {/* ٢ — العدد والتاريخ والصفحة */}
        <RegistrySection
          registry={registry}
          setReg={setReg}
          stampToday={stampToday}
          doc={doc}
          setDoc={setDoc}
        />

        {/* ٣ — القيم */}
        <ValuesSection
          setPickerOpen={setPickerOpen}
          nameField={nameField}
          owner={owner}
          dirty={dirty}
          setOwner={setOwner}
          ownerHints={ownerHints}
          takeOwner={takeOwner}
          needsGender={needsGender}
          values={values}
          setGenderByHand={setGenderByHand}
          setValue={setValue}
          doc={doc}
          setDoc={setDoc}
          named={named}
          api={api}
          writeWords={writeWords}
          setFieldPickerOpen={setFieldPickerOpen}
        />

        {/* ٤ — قبل الطبع */}
        <ChecksSection
          checks={checks}
          ownerHints={ownerHints}
          takeOwner={takeOwner}
          setSpellOpen={setSpellOpen}
          setGenderByHand={setGenderByHand}
          setValue={setValue}
          spellOpen={spellOpen}
          spelling={spelling}
          setDoc={setDoc}
        />
      </div>

      {/*
       * «اطبع» ظاهرٌ أبدًا (البند ٤، UI.md ٦): كان في آخر اللوح فيختفي تحت حافّة شاشة ١٣٦٦×٧٦٨، ويبقى «طباعة تجريبية» في
       * أعلى الورقة — وهي لا تُحفظ في السجلّ، فيخرج كتابٌ بلا أثر. فصار «اطبع» في أسفل اللوح لا يمرّ مع ما فوقه، والتجريبية
       * تحته أصغر ومكتوبٌ عليها ذلك. ورسائل الخطأ والنجاح معه: تُرى أينما وقف التمرير.
       */}
      <PrintBar
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
    </aside>
  );
}
