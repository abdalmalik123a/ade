/**
 * رأس مصمّم النماذج (تقسيمه بعد ١٫٧٫٠) — منقولٌ من `TemplateDesigner` كما هو: العنوان والنسخ السابقة، والإملاء، والحفظ والإغلاق.
 */
import type { Dispatch, SetStateAction } from 'react';
import RevisionsMenu from '../../components/RevisionsMenu';
import { type Doc, normalizeDoc, docFromLegacy } from '@shared/doc';
import { legacyFieldMeta } from '@shared/template';
import { count } from '@shared/arabic';
import SpellingPanel from '../../components/SpellingPanel';
import { fixDocSpelling } from '@shared/spelling';
import type { TemplateDetail } from '@shared/api';
import type { SpellIssue } from '@shared/spelling';

type Props = {
  editing: boolean;
  initial: TemplateDetail | null;
  setTitle: Dispatch<SetStateAction<string>>;
  setCode: Dispatch<SetStateAction<string>>;
  setSubtitle: Dispatch<SetStateAction<string>>;
  setCategory: Dispatch<SetStateAction<string>>;
  setSubjectLine: Dispatch<SetStateAction<string>>;
  setLetterheadId: Dispatch<SetStateAction<number | null>>;
  setDoc: Dispatch<SetStateAction<Doc>>;
  setRestored: Dispatch<SetStateAction<number | null>>;
  usage: number;
  importFile: () => Promise<void>;
  setSpellOpen: Dispatch<SetStateAction<boolean>>;
  spelling: SpellIssue[];
  spellOpen: boolean;
  saveAsClip: () => Promise<void>;
  closeDesigner: () => Promise<void>;
};

export default function DesignerHeader({ editing, initial, setTitle, setCode, setSubtitle, setCategory, setSubjectLine, setLetterheadId, setDoc, setRestored, usage, importFile, setSpellOpen, spelling, spellOpen, saveAsClip, closeDesigner }: Props) {
  return (
    <div className="h-14 shrink-0 px-space-lg flex items-center justify-between bg-surface-container-low">
      <div className="flex items-center gap-space-sm">
        <span className="p-1 rounded-lg bg-primary-container text-on-primary">
          <span className="material-symbols-outlined text-[18px]">data_object</span>
        </span>
        <span className="font-headline-sm text-headline-sm text-on-surface">
          {editing ? 'تعديل النموذج' : initial ? 'نموذج مستورد' : 'مصمّم النماذج والمُعاملات'}
        </span>
        {editing && initial && (
          <RevisionsMenu
            current={initial.revision}
            id={initial.id}
            kind="template"
            onRestore={(p, revision) => {
              setTitle(p.title);
              setCode(p.code ?? '');
              setSubtitle(p.subtitle ?? '');
              setCategory(p.category ?? '');
              setSubjectLine(p.subjectLine ?? '');
              setLetterheadId(p.letterheadId);
              let restoredDoc: Doc;
              try {
                restoredDoc = p.docJson ? normalizeDoc(JSON.parse(p.docJson)) : docFromLegacy(p.bodyHtml, legacyFieldMeta);
              } catch {
                restoredDoc = docFromLegacy(p.bodyHtml, legacyFieldMeta);
              }
              setDoc(restoredDoc);
              setRestored(revision);
            }}
          />
        )}
        {editing && usage > 0 && (
          <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">
            صدر عنه {count(usage, 'كتاب')}
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
        <span className="relative">
          <button
            className="flex items-center gap-space-xs px-space-md h-9 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md"
            data-act="spelling"
            type="button"
            onClick={() => setSpellOpen((o) => !o)}
          >
            <span className="material-symbols-outlined text-[18px]">spellcheck</span>
            <span>تدقيق إملائي{spelling.length ? ` (${spelling.length})` : ' ✓'}</span>
          </button>
          {spellOpen && (
            <div className="absolute left-0 top-11 z-10 w-96 shadow-xl rounded-xl bg-surface-container-lowest">
              {spelling.length ? (
                <SpellingPanel
                  issues={spelling}
                  note="اقتراحاتٌ على نصّ النموذج — اختر ما تريد، والحقول لا تُمسّ"
                  onFix={(chosen) => {
                    setDoc((d) => fixDocSpelling(d, chosen));
                    setSpellOpen(false);
                  }}
                />
              ) : (
                <div className="p-space-sm font-label-md text-label-md text-on-surface-variant">لا اقتراحات — النصّ سليم.</div>
              )}
            </div>
          )}
        </span>
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
          onClick={() => void closeDesigner()}
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>
    </div>
  );
}
