/**
 * الصفحات في مصمّم النماذج (تقسيمه بعد ١٫٧٫٠) — منقولةٌ من `TemplateDesigner` كما هي: ترقيمها وتكرار الترويسة.
 */
import type { Dispatch, SetStateAction } from 'react';
import type { Doc } from '@shared/doc';
import type { Letterhead } from '@shared/letterhead';

type Props = {
  doc: Doc;
  setDoc: Dispatch<SetStateAction<Doc>>;
  letterhead: Letterhead | null;
};

export default function PagesSection({ doc, setDoc, letterhead }: Props) {
  return (
    <section className="mt-space-md bg-surface-container-low rounded-card p-space-md space-y-space-sm" data-designer-page="">
      <h3 className="font-headline-sm text-headline-sm text-on-surface">الصفحات</h3>
      <label className="flex items-center gap-space-xs cursor-pointer font-label-md text-label-md text-on-surface">
        <input
          checked={doc.pageSetup.pageNumbers}
          className="w-4 h-4 accent-secondary"
          data-act="page-numbers"
          type="checkbox"
          onChange={(e) => setDoc((d) => ({ ...d, pageSetup: { ...d.pageSetup, pageNumbers: e.target.checked } }))}
        />
        ترقيم الصفحات («صفحة ١ من ٢» أسفل كلٍّ منها)
      </label>
      <label
        className={`flex items-center gap-space-xs font-label-md text-label-md ${letterhead ? 'cursor-pointer text-on-surface' : 'text-on-surface-variant'}`}
      >
        <input
          checked={doc.pageSetup.repeatLetterhead && Boolean(letterhead)}
          className="w-4 h-4 accent-secondary"
          data-act="repeat-head"
          disabled={!letterhead}
          type="checkbox"
          onChange={(e) => setDoc((d) => ({ ...d, pageSetup: { ...d.pageSetup, repeatLetterhead: e.target.checked } }))}
        />
        الترويسة في أعلى كل صفحة
      </label>
      {!letterhead && (
        <p className="font-label-sm text-label-sm text-on-surface-variant">تكرار الترويسة لنموذجٍ له ترويسة مختارة.</p>
      )}
    </section>
  );
}
