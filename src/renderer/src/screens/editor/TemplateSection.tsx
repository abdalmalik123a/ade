/**
 * لوح المحرّر — ١ «النموذج والترويسة» (تقسيمه بعد ١٫٧٫٠): النموذج، والترويسة وتحريرها وحفظها، ونوع الكتاب، واتّجاه المخاطبة.
 */
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { isLayoutEmpty, type Letterhead, type LetterheadLayout } from '@shared/letterhead';
import type { Doc } from '@shared/doc';
import type { TemplateSummary } from '@shared/api';
import AddressingPicker from '../../components/AddressingPicker';
import { inputCls } from '../EditorDialogs';
import { section, title } from './panelUi';

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
};

export default function TemplateSection({
  activeTemplate,
  switchTemplate,
  templates,
  letterheadId,
  applyLetterhead,
  letterheads,
  setDesignerOpen,
  layoutDirty,
  layout,
  setSaveLayoutOpen,
  docType,
  dirty,
  setDocType,
  doc,
  setDoc
}: Props) {
  return (
    <section className={section}>
      {title('article', 'النموذج والترويسة')}
      <select
        className={inputCls}
        data-editor-template=""
        value={activeTemplate ?? ''}
        onChange={(e) => void switchTemplate(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">{templates.length === 0 ? '— لا نماذج في المكتبة بعد —' : '— كتابٌ جديد، أو اختر نموذجًا —'}</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-space-xs">
        <select
          className={`${inputCls} flex-1`}
          value={letterheadId ?? ''}
          onChange={(e) => applyLetterhead(letterheads.find((l) => l.id === Number(e.target.value)) ?? null)}
        >
          <option value="">{letterheads.length === 0 ? '— لا ترويسة محفوظة بعد —' : '— بلا ترويسة —'}</option>
          {letterheads.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <button
          className="h-9 px-2.5 rounded-lg bg-primary-container text-on-primary font-label-sm text-label-sm flex items-center gap-1"
          type="button"
          onClick={() => setDesignerOpen(true)}
        >
          <span className="material-symbols-outlined text-[16px]">edit_note</span>
          تحرير الترويسة
        </button>
      </div>
      <div className="flex items-center justify-between font-label-sm text-label-sm">
        <span className="text-on-surface-variant">{layoutDirty ? 'الترويسة خاصّةٌ بهذا الكتاب' : isLayoutEmpty(layout) ? 'بلا ترويسة' : 'كما في المكتبة'}</span>
        <button
          className="text-secondary font-semibold hover:underline disabled:opacity-40"
          type="button"
          disabled={isLayoutEmpty(layout)}
          onClick={() => setSaveLayoutOpen(true)}
        >
          حفظ الترويسة في المكتبة
        </button>
      </div>
      <label className="flex flex-col gap-1">
        <span className="font-label-sm text-label-sm text-on-surface-variant">نوع الكتاب — يُقيَّد به في الأرشيف</span>
        <input className={inputCls} value={docType} placeholder="مثال: تأييد استمرار بالخدمة" onChange={(e) => (dirty.current = true, setDocType(e.target.value))} />
      </label>
      <AddressingPicker
        value={doc.meta.addressing ?? null}
        onChange={(a) => setDoc((d) => ({ ...d, meta: { ...d.meta, addressing: a ?? undefined } }))}
      />
    </section>
  );
}
