/**
 * ملفّ Word المستورد بترويسته: تُحفظ في المكتبة أم تُترك (تقسيم مكتبة النماذج بعد ١٫٧٫٠) — منقولٌ من `TemplatesScreen` كما هو.
 */
import type { Dispatch, SetStateAction } from 'react';
import LetterheadView from '../../components/LetterheadView';
import { normalizeLayout } from '@shared/letterhead';
import type { ImportedTemplate } from '@shared/api';

type Props = {
  pendingImport: ImportedTemplate;
  setPendingImport: Dispatch<SetStateAction<ImportedTemplate | null>>;
  openImported: (imported: ImportedTemplate, letterheadId: number | null) => void;
  keepImportedLetterhead: (imported: ImportedTemplate) => Promise<void>;
};

export default function ImportedLetterhead({ pendingImport, setPendingImport, openImported, keepImportedLetterhead }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-scrim/40 backdrop-blur-[2px] flex items-center justify-center p-space-lg">
      <div className="w-full max-w-3xl bg-surface-container-lowest rounded-xl shadow-lg overflow-hidden">
        <div className="h-12 px-space-md flex items-center justify-between bg-surface-container-low">
          <span className="font-headline-sm text-headline-sm text-on-surface">
            وُجدت ترويسة في الملف
          </span>
          <button
            className="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high"
            type="button"
            onClick={() => {
              const imported = pendingImport;
              setPendingImport(null);
              openImported(imported, null);
            }}
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="p-space-md space-y-space-md">
          <p className="font-label-md text-label-md text-on-surface-variant">
            كتب Word غالبًا تحمل ترويسة مكتوبة نصًّا لا كترويسة صفحة، فتضيع عند
            الاستيراد. هذه ما وجدناه في أعلى الملف — احفظها لتُستعمل مع هذا النموذج
            وغيره، أو اتركها فتبقى ضمن المتن.
          </p>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-space-md">
            <LetterheadView layout={normalizeLayout(pendingImport.letterhead)} />
          </div>

          <div className="flex items-center justify-end gap-space-sm">
            <button
              className="h-10 px-space-md rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md"
              type="button"
              onClick={() => {
                const imported = pendingImport;
                setPendingImport(null);
                openImported(imported, null);
              }}
            >
              لا تحفظها
            </button>
            <button
              className="h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold"
              type="button"
              onClick={() => void keepImportedLetterhead(pendingImport)}
            >
              احفظ الترويسة واربطها بالنموذج
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
