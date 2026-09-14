/**
 * مصمّم النماذج والمُعاملات.
 *
 * المتغيّرات تُشتقّ من المتن نفسه لا من قائمة منفصلة — فلا يمكن أن تتعارض
 * القائمة مع ما هو مكتوب فعلًا. يكتب الموظف {الاسم} فيظهر المتغيّر تلقائيًا.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { TemplateDetail } from '@shared/api';
import {
  AUTO_TOKENS,
  CITIZEN_TOKENS,
  reconcileVariables,
  renderBody,
  type TemplateInput,
  type TemplateVariable,
  type VariableSource
} from '@shared/template';
import { mmToPx, type Letterhead } from '@shared/letterhead';
import { errorText } from '../lib/errors';

const inputCls =
  'w-full h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-secondary';

const SOURCE_LABEL: Record<VariableSource, string> = {
  auto: 'يملؤه المحرّك',
  citizen: 'من ملف المواطن',
  manual: 'يكتبه الموظف'
};

const SOURCE_STYLE: Record<VariableSource, string> = {
  auto: 'bg-surface-container-high text-secondary',
  citizen: 'bg-secondary-fixed text-on-secondary-fixed',
  manual: 'bg-surface-container-high text-on-surface-variant'
};

export type DesignerProps = {
  initial: TemplateDetail | null;
  letterheads: Letterhead[];
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
};

export default function TemplateDesigner({
  initial,
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
  const [body, setBody] = useState(initial?.bodyHtml ?? '');
  const [letterheadId, setLetterheadId] = useState<number | null>(
    initial?.letterheadId ?? letterheads.find((l) => l.isDefault)?.id ?? null
  );
  const [variables, setVariables] = useState<TemplateVariable[]>(initial?.variables ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [usage, setUsage] = useState(0);

  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // المتغيّرات تتبع المتن دائمًا.
  useEffect(() => {
    setVariables((prev) => reconcileVariables(body, prev));
  }, [body]);

  // الخطأ يُمسح حال التصحيح — إبقاؤه بعد إصلاح السبب تضليل.
  useEffect(() => {
    setError(null);
  }, [title, body, code]);

  useEffect(() => {
    if (initial) void window.diwan.templates.usage(initial.id).then(setUsage);
  }, [initial]);

  const letterhead = letterheads.find((l) => l.id === letterheadId) ?? null;

  const preview = useMemo(
    () => renderBody(body, {}, { markMissing: true }),
    [body]
  );

  function insert(token: string) {
    const el = bodyRef.current;
    const text = `{${token}}`;
    if (!el) {
      setBody((b) => b + text);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    setBody(body.slice(0, start) + text + body.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + text.length;
    });
  }

  function patchVar(token: string, patch: Partial<TemplateVariable>) {
    setVariables((prev) => prev.map((v) => (v.token === token ? { ...v, ...patch } : v)));
  }

  async function save() {
    setError(null);
    if (!title.trim()) {
      setError('عنوان النموذج مطلوب');
      return;
    }
    if (!body.trim()) {
      setError('متن النموذج فارغ');
      return;
    }
    setSaving(true);
    try {
      const input: TemplateInput = {
        id: initial?.id ?? null,
        code: code.trim() || null,
        title,
        subtitle: subtitle.trim() || null,
        category: category.trim() || null,
        subjectLine: subjectLine.trim() || null,
        bodyHtml: body,
        letterheadId,
        variables
      };
      await window.diwan.templates.save(input);
      onSaved();
    } catch (e) {
      setError(errorText(e, 'تعذّر الحفظ'));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!initial) return;
    await window.diwan.templates.delete(initial.id);
    onDeleted();
  }

  async function importFile() {
    const imported = await window.diwan.templates.importFile();
    if (!imported) return;
    setTitle(imported.title);
    setBody(imported.body);
    if (imported.subtitle) setSubtitle(imported.subtitle);
    if (imported.category) setCategory(imported.category);
    if (imported.code) setCode(imported.code);
    if (imported.subjectLine) setSubjectLine(imported.subjectLine);
    setError(imported.warnings.length ? imported.warnings.join(' · ') : null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-primary-container/45 backdrop-blur-[2px]">
      <div className="m-auto w-[min(1280px,95vw)] h-[min(880px,92vh)] rounded-xl bg-surface-container-lowest shadow-2xl flex flex-col overflow-hidden">
        {/* الترويسة */}
        <div className="h-14 shrink-0 px-space-lg flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-space-sm">
            <span className="p-1 rounded-lg bg-primary-container text-on-primary">
              <span className="material-symbols-outlined text-[18px]">data_object</span>
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface">
              {initial ? 'تعديل النموذج' : 'مصمّم النماذج والمُعاملات'}
            </span>
            {initial && usage > 0 && (
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
          <div className="w-[520px] shrink-0 overflow-y-auto p-space-md space-y-space-md bg-surface-container-lowest">
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
                    {letterheads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="bg-surface-container-low rounded-xl p-space-md space-y-space-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-headline-sm text-headline-sm text-on-surface">
                  متن الكتاب
                </h3>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  اكتب المتغيّر هكذا: {'{'}الاسم{'}'}
                </span>
              </div>

              <div className="flex flex-wrap gap-1">
                <span className="font-label-sm text-label-sm text-on-surface-variant w-full">
                  من ملف المواطن:
                </span>
                {CITIZEN_TOKENS.map((t) => (
                  <button
                    key={t.token}
                    className="px-2 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed font-mono font-label-sm text-label-sm hover:opacity-80 transition-opacity"
                    type="button"
                    onClick={() => insert(t.token)}
                  >
                    {t.label}
                  </button>
                ))}
                <span className="font-label-sm text-label-sm text-on-surface-variant w-full pt-space-xs">
                  يملؤه المحرّك:
                </span>
                {AUTO_TOKENS.map((t) => (
                  <button
                    key={t.token}
                    className="px-2 py-0.5 rounded bg-surface-container-high text-secondary font-mono font-label-sm text-label-sm hover:opacity-80 transition-opacity"
                    type="button"
                    onClick={() => insert(t.token)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <textarea
                ref={bodyRef}
                className="w-full p-space-sm rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md leading-relaxed focus:outline-none focus:ring-1 focus:ring-secondary resize-none"
                rows={10}
                value={body}
                placeholder="نؤيد لكم بأن السيد {الاسم}، الحامل للرقم الوطني ({الرقم_الوطني})، ..."
                onChange={(e) => setBody(e.target.value)}
              />
            </section>

            <section className="bg-surface-container-low rounded-xl p-space-md space-y-space-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-headline-sm text-headline-sm text-on-surface">
                  المتغيّرات المكتشَفة
                </h3>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  {variables.length} متغيّر
                </span>
              </div>
              {variables.length === 0 ? (
                <p className="font-label-sm text-label-sm text-on-surface-variant py-space-sm">
                  لا متغيّرات بعد — تظهر هنا تلقائيًا حالما تكتبها في المتن.
                </p>
              ) : (
                <div className="space-y-1">
                  {variables.map((v) => (
                    <div
                      key={v.token}
                      className="flex items-center gap-space-sm p-space-sm rounded-lg bg-surface-container-lowest"
                    >
                      <span className="font-mono font-label-md text-label-md text-secondary shrink-0">
                        {'{'}
                        {v.token}
                        {'}'}
                      </span>
                      <input
                        className="flex-1 h-8 px-2 rounded bg-surface-container-low text-on-surface font-label-sm text-label-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                        value={v.label}
                        onChange={(e) => patchVar(v.token, { label: e.target.value })}
                      />
                      <select
                        className={`h-8 px-2 rounded font-label-sm text-label-sm cursor-pointer focus:outline-none ${SOURCE_STYLE[v.source]}`}
                        value={v.source}
                        onChange={(e) =>
                          patchVar(v.token, { source: e.target.value as VariableSource })
                        }
                      >
                        {(['manual', 'citizen', 'auto'] as VariableSource[]).map((s) => (
                          <option key={s} value={s}>
                            {SOURCE_LABEL[s]}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 cursor-pointer shrink-0">
                        <input
                          className="w-4 h-4 accent-primary-container"
                          type="checkbox"
                          checked={v.required}
                          onChange={(e) => patchVar(v.token, { required: e.target.checked })}
                        />
                        <span className="font-label-sm text-label-sm text-on-surface-variant">
                          إلزامي
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* المعاينة على ورقة A4 */}
          <div className="flex-1 overflow-auto bg-surface-dim/40 flex flex-col items-center py-space-lg">
            <div
              className="bg-surface-container-lowest shadow-[0_1px_3px_rgba(15,23,42,0.06),0_16px_32px_-4px_rgba(15,23,42,0.08)] shrink-0"
              style={{ width: 620, minHeight: 877 }}
            >
              <div
                style={{
                  paddingTop: mmToPx(letterhead?.layout.margins.top ?? 20) * 0.78,
                  paddingRight: mmToPx(letterhead?.layout.margins.right ?? 20) * 0.78,
                  paddingLeft: mmToPx(letterhead?.layout.margins.left ?? 20) * 0.78
                }}
              >
                {letterhead && letterhead.layout.blocks.length > 0 ? (
                  <div>
                    {letterhead.layout.blocks.map((b) => {
                      if (b.kind === 'spacer')
                        return <div key={b.id} style={{ height: b.gap ?? 12 }} />;
                      if (b.kind === 'divider')
                        return <hr key={b.id} className="border-t border-on-surface my-space-sm" />;
                      if (b.kind === 'image') {
                        const justify =
                          b.align === 'center'
                            ? 'center'
                            : b.align === 'left'
                              ? 'flex-start'
                              : 'flex-end';
                        return (
                          <div key={b.id} className="flex" style={{ justifyContent: justify }}>
                            <img
                              alt=""
                              src={b.value ? `diwan://store/${b.value}` : undefined}
                              style={{ width: (b.width ?? 90) * 0.78 }}
                            />
                          </div>
                        );
                      }
                      return (
                        <div
                          key={b.id}
                          className={b.bold ? 'font-bold' : ''}
                          style={{
                            textAlign: b.align,
                            fontSize: `${b.size * 0.85}px`,
                            lineHeight: 1.9
                          }}
                        >
                          {b.value || ' '}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-space-md text-center text-on-surface-variant font-label-sm text-label-sm border border-dashed border-outline-variant rounded">
                    بلا ترويسة — اخترها من الأعلى
                  </div>
                )}

                {subjectLine && (
                  <div className="mt-space-lg text-center font-bold underline underline-offset-8 text-on-surface text-[13px]">
                    م / {subjectLine}
                  </div>
                )}

                <div
                  className="mt-space-lg text-on-surface"
                  style={{ fontSize: '12.5px', lineHeight: 2, textAlign: 'justify' }}
                  dangerouslySetInnerHTML={{
                    __html:
                      preview ||
                      '<span class="text-on-surface-variant">المتن فارغ — اكتبه على اليمين</span>'
                  }}
                />
              </div>
            </div>
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
            {initial &&
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
