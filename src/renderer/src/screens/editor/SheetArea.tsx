/**
 * ورقة المحرّر (تقسيمه بعد ١٫٧٫٠): «تحرير على الورقة» و«معاينة كما تُطبع» (وتجربتها بقيمٍ وهمية)، والبحث والرموز، وحفظ المسودة
 * و«اجعله نموذجًا» والإخراج — ثم الورقة نفسها.
 */
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { LetterheadLayout } from '@shared/letterhead';
import type { Doc } from '@shared/doc';
import type { TemplateSummary } from '@shared/api';
import PageEditor, { type HeadChoice } from '../../components/PageEditor';
import type { EditorApi } from '../../components/editorKit';
import LetterSheet from '../../components/LetterSheet';
import SymbolPalette from '../../components/SymbolPalette';
import { FindReplaceBar } from '../EditorPickers';

type Props = {
  view: 'edit' | 'preview';
  setView: Dispatch<SetStateAction<'edit' | 'preview'>>;
  trial: boolean;
  setTrial: Dispatch<SetStateAction<boolean>>;
  tool: 'find' | 'symbols' | null;
  setTool: Dispatch<SetStateAction<'find' | 'symbols' | null>>;
  saveDraft: (silent: boolean) => Promise<unknown>;
  setTemplateOpen: Dispatch<SetStateAction<boolean>>;
  exporting: boolean;
  busy: boolean;
  exportWord: () => Promise<void>;
  exportPdf: () => Promise<void>;
  exportPng: () => Promise<void>;
  doc: Doc;
  templates: TemplateSummary[];
  setDoc: (next: Doc | ((d: Doc) => Doc)) => void;
  switchTemplate: (id: number | null) => Promise<void>;
  api: MutableRefObject<EditorApi | null>;
  clips: { id: number; title: string; body: string }[];
  headChoice: HeadChoice;
  head: React.ReactNode;
  effective: Record<string, string>;
  headLayout: LetterheadLayout | null;
  shown: Record<string, string>;
  regValues: { number: string; date: string };
  resolveHead: (text: string) => string;
};

export default function SheetArea({
  view,
  setView,
  trial,
  setTrial,
  tool,
  setTool,
  saveDraft,
  setTemplateOpen,
  exporting,
  busy,
  exportWord,
  exportPdf,
  exportPng,
  doc,
  templates,
  setDoc,
  switchTemplate,
  api,
  clips,
  headChoice,
  head,
  effective,
  headLayout,
  shown,
  regValues,
  resolveHead
}: Props) {
  return (
    <div className="flex-1 min-w-0 h-full flex flex-col">
      <div className="h-12 shrink-0 px-space-md flex items-center gap-space-xs bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex-wrap">
        <div className="flex p-0.5 rounded-lg bg-surface-container-low">
          {(
            [
              ['edit', 'تحرير على الورقة'],
              ['preview', 'معاينة كما تُطبع']
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              className={`h-8 px-3 rounded-md font-label-md text-label-md ${view === v ? 'bg-primary-container text-on-primary font-semibold' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
              data-view={v}
              type="button"
              onClick={() => setView(v)}
            >
              {label}
            </button>
          ))}
        </div>
        {view === 'preview' && (
          <label className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface cursor-pointer" title="قيمٌ طويلة للفارغ — تكشف الفراغ القصير والسطر الزائد قبل الورق">
            <input checked={trial} className="w-4 h-4 accent-secondary" data-act="trial" type="checkbox" onChange={(e) => setTrial(e.target.checked)} />
            جرّبها بقيمٍ وهمية
          </label>
        )}
        <span className="w-px h-6 bg-outline-variant/60 mx-1" />
        <button
          className={`h-9 px-2.5 rounded-lg font-label-sm text-label-sm flex items-center gap-1 ${tool === 'find' ? 'bg-secondary-fixed' : 'hover:bg-surface-container-high'}`}
          data-act="find"
          type="button"
          onClick={() => setTool((t) => (t === 'find' ? null : 'find'))}
        >
          <span className="material-symbols-outlined text-[18px]">find_replace</span>
          بحث واستبدال
        </button>
        <button
          className={`h-9 px-2.5 rounded-lg font-label-sm text-label-sm flex items-center gap-1 ${tool === 'symbols' ? 'bg-secondary-fixed' : 'hover:bg-surface-container-high'}`}
          data-act="symbols"
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setTool((t) => (t === 'symbols' ? null : 'symbols'))}
        >
          <span className="material-symbols-outlined text-[18px]">function</span>
          رموز
        </button>
        <span className="flex-1" />
        <button className="h-9 px-2.5 rounded-lg hover:bg-surface-container-high font-label-sm text-label-sm flex items-center gap-1" data-act="save" type="button" onClick={() => void saveDraft(false)}>
          <span className="material-symbols-outlined text-[18px]">save</span>
          حفظ مسودة
        </button>
        <button className="h-9 px-2.5 rounded-lg hover:bg-surface-container-high font-label-sm text-label-sm flex items-center gap-1" data-act="as-template" type="button" onClick={() => setTemplateOpen(true)}>
          <span className="material-symbols-outlined text-[18px]">library_add</span>
          اجعله نموذجًا
        </button>
        <button className="h-9 px-2.5 rounded-lg hover:bg-surface-container-high font-label-sm text-label-sm flex items-center gap-1 disabled:opacity-40" data-act="export-word" disabled={exporting || busy} type="button" onClick={() => void exportWord()}>
          <span className="material-symbols-outlined text-[18px] text-secondary">description</span>
          Word
        </button>
        <button className="h-9 px-2.5 rounded-lg hover:bg-surface-container-high font-label-sm text-label-sm flex items-center gap-1 disabled:opacity-40" data-act="export-pdf" disabled={exporting || busy} type="button" onClick={() => void exportPdf()}>
          <span className="material-symbols-outlined text-[18px] text-error">picture_as_pdf</span>
          PDF
        </button>
        <button className="h-9 px-2.5 rounded-lg hover:bg-surface-container-high font-label-sm text-label-sm flex items-center gap-1 disabled:opacity-40" data-act="export-png" disabled={exporting || busy} type="button" onClick={() => void exportPng()}>
          <span className="material-symbols-outlined text-[18px]">image</span>
          صورة عالية الدقّة
        </button>
      </div>

      {tool === 'find' && <FindReplaceBar doc={doc} templates={templates} onChange={setDoc} onOpenTemplate={(id) => void switchTemplate(id)} />}
      {tool === 'symbols' && (
        <div className="px-space-md py-space-sm bg-surface-container-low border-b border-outline-variant/40">
          <SymbolPalette onPick={(s) => api.current?.insertText(s)} />
        </div>
      )}

      <div className="flex-1 min-h-0">
        {view === 'edit' ? (
          <PageEditor apiRef={api} aside={null} clips={clips} doc={doc} head={headChoice} header={head} values={effective} onChange={setDoc} />
        ) : (
          <div className="h-full overflow-auto flex justify-center py-space-lg bg-surface-dim/40" data-preview="">
            <div style={{ zoom: 0.85 }} className="w-fit">
              <LetterSheet doc={doc} layout={headLayout} values={shown} registry={regValues} resolve={resolveHead} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
