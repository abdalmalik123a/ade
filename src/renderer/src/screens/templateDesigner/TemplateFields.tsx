/**
 * بيانات النموذج في مصمّمه (تقسيمه بعد ١٫٧٫٠) — منقولةٌ من `TemplateDesigner` كما هي: الرمز والعنوان والتصنيف والموضوع والترويسة،
 * ورأس الورقة المكتشَف يُحفظ ترويسة.
 */
import type { Dispatch, SetStateAction } from 'react';
import { inputCls } from './shared';
import AddressingPicker from '../../components/AddressingPicker';
import { docText, emptyDoc, type Suggestion, type Doc } from '@shared/doc';
import type { Letterhead } from '@shared/letterhead';
import type { SheetHeadSplit } from '@shared/sheetHead';

type Props = {
  title: string;
  setTitle: Dispatch<SetStateAction<string>>;
  subtitle: string;
  setSubtitle: Dispatch<SetStateAction<string>>;
  code: string;
  setCode: Dispatch<SetStateAction<string>>;
  category: string;
  setCategory: Dispatch<SetStateAction<string>>;
  categories: string[];
  catSuggest: Suggestion<string> | null;
  subjectLine: string;
  setSubjectLine: Dispatch<SetStateAction<string>>;
  letterheadId: number | null;
  setLetterheadId: Dispatch<SetStateAction<number | null>>;
  heads: Letterhead[];
  doc: Doc;
  setDoc: Dispatch<SetStateAction<Doc>>;
  headSplit: SheetHeadSplit | null;
  headLines: number;
  setHeadCount: Dispatch<SetStateAction<number | null>>;
  canGrow: boolean;
  habitCount: number;
  headCount: number | null;
  edgeHabit: Suggestion<string> | null;
  headName: string;
  setHeadName: Dispatch<SetStateAction<string>>;
  saveHead: () => Promise<void>;
};

export default function TemplateFields({ title, setTitle, subtitle, setSubtitle, code, setCode, category, setCategory, categories, catSuggest, subjectLine, setSubjectLine, letterheadId, setLetterheadId, heads, doc, setDoc, headSplit, headLines, setHeadCount, canGrow, habitCount, headCount, edgeHabit, headName, setHeadName, saveHead }: Props) {
  return (
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
          {catSuggest && !category.trim() && (
            <button
              className="self-start font-label-sm text-label-sm text-secondary hover:underline text-right"
              data-category-suggest={catSuggest.value}
              title={catSuggest.reason}
              type="button"
              onClick={() => setCategory(catSuggest.value)}
            >
              مقترح: «{catSuggest.value}» — {catSuggest.reason}
            </button>
          )}
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
        <div className="col-span-2">
          <AddressingPicker
            value={doc.meta.addressing ?? null}
            onChange={(a) => setDoc((d) => ({ ...d, meta: { ...d.meta, addressing: a ?? undefined } }))}
          />
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
            {/* الحدّ: كم سطرًا من أعلى الورقة رأس — يُزاد ويُنقص، ويُرى ما يدخل فيه */}
            <div className="flex items-center gap-space-xs font-label-sm text-label-sm text-on-surface" data-head-edge={headLines}>
              <span>الرأس {headLines} {headLines === 1 ? 'سطر' : 'أسطر'}</span>
              <button
                className="w-7 h-7 rounded bg-surface-container-high hover:bg-surface-container-highest disabled:opacity-30"
                data-act="head-less"
                title="سطرٌ أقلّ في الرأس"
                type="button"
                disabled={headLines <= 1}
                onClick={() => setHeadCount(headLines - 1)}
              >
                −
              </button>
              <button
                className="w-7 h-7 rounded bg-surface-container-high hover:bg-surface-container-highest disabled:opacity-30"
                data-act="head-more"
                title="سطرٌ أكثر في الرأس"
                type="button"
                disabled={!canGrow}
                onClick={() => setHeadCount(headLines + 1)}
              >
                +
              </button>
              {habitCount > 0 && headCount === null && (
                <span className="text-on-surface-variant" title={edgeHabit?.reason}>
                  — كما فصلتَه لكتب هذه الجهة
                </span>
              )}
            </div>
            <div className="flex flex-col gap-0.5 p-space-xs rounded bg-surface-container-low font-label-sm text-label-sm text-on-surface-variant max-h-24 overflow-y-auto" data-head-preview="">
              {(headSplit.layout.sheet ?? []).map((b, i) => {
                const line = docText({ ...emptyDoc(), blocks: [b] }).replace(/\s+/g, ' ').trim();
                return <span key={i} className="truncate">{line || '— سطرٌ فارغ —'}</span>;
              })}
            </div>
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
  );
}
