/**
 * شاشة مراجعة «استورد مجلدي».
 *
 * **لا تخمين صامت.** يعرض البرنامج ما ظنّه: كم بطاقة، وأيّها نسخةٌ من أيّ،
 * وأي ترويسة تتكرّر، وما الحقول التي استنتجها وبأي درجة — ثم يحفظ ما قبِله
 * الموظف وحده.
 *
 * والمكرَّر مُنزوع الاختيار سلفًا مع إبقاء أوّله: ثلاثة ملفات متشابهة ٩٨٪
 * ليست ثلاث استمارات.
 */
import { useEffect, useMemo, useState } from 'react';
import { renameField, unfield, type Doc } from '@shared/doc';
import { isLayoutEmpty } from '@shared/letterhead';
import type { ImportChoices, ImportPlan } from '@shared/api';
import { similarityBucket } from '@shared/learningKeys';
import { skippedLines } from '@shared/importSkipped';
import { WORD_LOSSES, lossesOf } from '@shared/wordLosses';
import LetterheadView from './LetterheadView';
import { WordLossList } from './WordLosses';
import { FieldRow, pct } from './ImportPlanRows';
import { useEscape } from '../kit/useEscape';
import { count, countIn } from '@shared/arabic';

const LOSS_LABEL = new Map(WORD_LOSSES.map((l) => [l.key, l.label]));

export type ImportPlanDialogProps = {
  plan: ImportPlan;
  busy?: boolean;
  onCancel: () => void;
  onApply: (plan: ImportPlan, choices: ImportChoices) => void;
};

/** أوّل كل مجموعة يبقى، وما بعده نسخٌ لا تُحفظ إلا أن يطلب الموظف. */
function initialAccept(plan: ImportPlan): Set<string> {
  const copies = new Set<string>();
  for (const g of plan.duplicates) for (const id of g.ids.slice(1)) copies.add(id);
  return new Set(plan.candidates.map((c) => c.id).filter((id) => !copies.has(id)));
}

export default function ImportPlanDialog({
  plan,
  busy = false,
  onCancel,
  onApply
}: ImportPlanDialogProps) {
  useEscape(onCancel);
  const [docs, setDocs] = useState<Record<string, Doc>>(() =>
    Object.fromEntries(plan.candidates.map((c) => [c.id, c.doc]))
  );
  const [accept, setAccept] = useState<Set<string>>(() => initialAccept(plan));
  const [open, setOpen] = useState<string | null>(plan.candidates[0]?.id ?? null);
  const [useShared, setUseShared] = useState(Boolean(plan.sharedLetterhead));
  const [sharedName, setSharedName] = useState('ترويسة المكتب');
  const [category, setCategory] = useState('');
  /** أين حُفظ إحصاء المجلّد — أو سبب تعذّره. */
  const [censusSaved, setCensusSaved] = useState<string | null>(null);

  async function saveCensus() {
    try {
      const path = await window.diwan.templates.saveCensus();
      if (path) setCensusSaved(`حُفظ الإحصاء في ${path} — أرسله إلى المطوّر`);
    } catch {
      setCensusSaved('تعذّر حفظ الإحصاء');
    }
  }
  /** ما تعلّمه البرنامج من هذا المكتب — يُعرض هنا حيث تُراجَع الاقتراحات. */
  const [taught, setTaught] = useState<{ total: number; habits: number } | null>(null);

  useEffect(() => {
    window.diwan.learning
      .stats()
      .then((s) => setTaught(s.total ? { total: s.total, habits: s.habits } : null))
      .catch(() => setTaught(null));
  }, []);

  /** من أي مجموعة جاءت البطاقة — لتُشرح للموظف لماذا نُزع اختيارها. */
  const copyOf = useMemo(() => {
    const map = new Map<string, { of: string; confidence: number }>();
    for (const g of plan.duplicates) {
      const first = plan.candidates.find((c) => c.id === g.ids[0]);
      for (const id of g.ids.slice(1)) {
        if (first) map.set(id, { of: first.file, confidence: g.confidence });
      }
    }
    return map;
  }, [plan]);

  const toggle = (id: string) =>
    setAccept((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const patchDoc = (id: string, fn: (doc: Doc) => Doc) =>
    setDocs((prev) => ({ ...prev, [id]: fn(prev[id]!) }));

  /**
   * ما صحّحه الموظف من أسماء الحقول.
   *
   * وتُحسب هنا لأن هذه الشاشة وحدها تملك الاثنين: ما اقترحه البرنامج (في
   * `plan`) وما صار إليه بيد الموظف (في `docs`). ولا تُجمع بأثر رجعي، فما لم
   * يُقيَّد الآن فُقد.
   */
  function corrections() {
    const out: { input: string; suggested: string | null; chosen: string }[] = [];
    for (const c of plan.candidates) {
      if (!accept.has(c.id)) continue;
      const edited = docs[c.id];
      if (!edited) continue;
      const before = new Map(c.doc.fields.map((f) => [f.key, f.label]));
      for (const field of edited.fields) {
        const was = before.get(field.key);
        if (was && was !== field.label) {
          out.push({ input: was, suggested: was, chosen: field.label });
        }
      }
    }
    return out;
  }

  function apply() {
    // نسخةٌ نزع البرنامج اختيارها فأعادها الموظف: ليست نسخةً في عُرف هذا المكتب (ج١٣).
    for (const g of plan.duplicates) {
      for (const id of g.ids.slice(1)) {
        if (accept.has(id)) {
          void window.diwan.learning.record({
            kind: 'duplicate',
            input: similarityBucket(g.confidence),
            suggested: 'copy',
            chosen: 'keep'
          });
        }
      }
    }
    onApply(
      { ...plan, candidates: plan.candidates.map((c) => ({ ...c, doc: docs[c.id] ?? c.doc })) },
      {
        accept: [...accept],
        useSharedLetterhead: useShared,
        sharedName,
        category: category.trim() || null,
        corrections: corrections()
      }
    );
  }

  const files = new Set(plan.candidates.map((c) => c.file)).size;
  /** من أوراق ملفّ Excel لا من مجلّد ملفّات Word — فتُقال المراجعة بلغته. */
  const excel = plan.source === 'excel';
  const shared = plan.sharedLetterhead;
  const skipped = skippedLines(plan.skipped);

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/50 p-space-md">
      <div className="w-full max-w-5xl max-h-[92vh] rounded-2xl bg-surface-container-lowest shadow-2xl flex flex-col overflow-hidden">
        {/* الحصيلة */}
        <div className="p-space-md bg-surface-container-low flex flex-col gap-space-xs shrink-0">
          <div className="flex items-center justify-between">
            <span className="font-headline-sm text-headline-sm text-on-surface">
              {excel ? 'مراجعة ما وجدناه في ملف Excel' : 'مراجعة ما وجدناه في مجلدك'}
            </span>
            <span className="font-label-md text-label-md text-on-surface-variant">
              {excel ? count(plan.candidates.length, 'ورقة') : count(files, 'ملف')} ← {count(plan.candidates.length, 'بطاقة')}
            </span>
          </div>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            لا يُحفظ إلا ما تختاره. راجع الأسماء المستنتجة — والنقطة الحمراء علامةُ
            اجتهادٍ ضعيف.
          </span>
          {/* ما في المجلّد ولم يُقرأ (هـ١): يُقال بعدده وبما يُفعل له قبل الحفظ — لا يُكتشف بعد شهر. */}
          {skipped.length > 0 && (
            <div className="flex flex-col gap-0.5 p-space-xs rounded-lg bg-tertiary-container text-on-tertiary-container font-label-sm text-label-sm" data-import-skipped="">
              <span className="font-semibold">ما في المجلّد ولم يُنقل:</span>
              {skipped.map((line) => (
                <span key={line}>• {line}</span>
              ))}
            </div>
          )}
          {plan.census && plan.census.files > 0 && (
            <div className="flex flex-col gap-1 pt-space-xs border-t border-outline-variant/60 font-label-sm text-label-sm text-on-surface-variant" data-census="">
              {plan.census.losses.length > 0 && (
                <span data-census-losses="">
                  ما في الملفّات ولا يُنقل:{' '}
                  {plan.census.losses
                    .slice(0, 5)
                    .map((l) => `${LOSS_LABEL.get(l.key)} (${l.files} ملفّ)`)
                    .join('، ')}
                  {plan.census.losses.length > 5 ? '…' : ''}
                </span>
              )}
              <div className="flex items-center gap-space-sm">
                <button
                  className="h-8 px-space-sm rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-sm text-label-sm"
                  data-act="save-census"
                  title="أعدادٌ وأسماء خطوطٍ وحدها — لا اسم ملفٍّ ولا شيء من نصوصه"
                  type="button"
                  onClick={() => void saveCensus()}
                >
                  احفظ إحصاء الملفّات
                </button>
                {censusSaved && <span data-census-saved="">{censusSaved}</span>}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 flex">
          {/* البطاقات */}
          <div className="w-[46%] border-l border-outline-variant overflow-y-auto p-space-sm flex flex-col gap-1">
            {plan.candidates.map((c) => {
              const copy = copyOf.get(c.id);
              const fields = (docs[c.id] ?? c.doc).fields.length;
              return (
                <div
                  key={c.id}
                  className={`rounded-lg p-space-sm flex flex-col gap-1 cursor-pointer transition-colors ${
                    open === c.id ? 'bg-primary-container text-on-primary' : 'bg-surface-container-low'
                  }`}
                  onClick={() => setOpen(c.id)}
                >
                  <div className="flex items-center gap-space-xs">
                    <input
                      className="w-4 h-4 accent-secondary shrink-0"
                      checked={accept.has(c.id)}
                      type="checkbox"
                      onChange={() => toggle(c.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="flex-1 min-w-0 font-label-md text-label-md truncate">
                      {c.title}
                    </span>
                    <span className="font-label-sm text-label-sm opacity-70 shrink-0">
                      {count(fields, 'حقل')}
                    </span>
                  </div>
                  <span className="font-label-sm text-label-sm opacity-70 truncate">
                    {c.file}
                    {c.formCount > 1 ? ` — استمارة ${c.formIndex} من ${c.formCount}` : ''}
                  </span>
                  {copy && (
                    <span className="font-label-sm text-label-sm text-error">
                      تشبه «{copy.of}» بنسبة {pct(copy.confidence)} — تُركت نسخةً
                    </span>
                  )}
                </div>
              );
            })}

            {plan.failed.length > 0 && (
              <div className="mt-space-sm p-space-sm rounded-lg bg-error-container text-on-error-container flex flex-col gap-1">
                <span className="font-label-md text-label-md font-semibold">
                  {plan.failed.length} {excel ? 'ورقةً لم تُستورد' : 'ملفًا لم يُقرأ'}
                </span>
                {plan.failed.map((f) => (
                  <span key={f.file} className="font-label-sm text-label-sm">
                    {f.file}: {f.error}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* تفصيل البطاقة المفتوحة */}
          <div className="flex-1 overflow-y-auto p-space-md flex flex-col gap-space-sm">
            {(() => {
              const c = plan.candidates.find((x) => x.id === open);
              if (!c) return null;
              const doc = docs[c.id] ?? c.doc;
              const byKey = new Map(
                c.suggestions.map((s) => [s.value.split(' — ')[0]!, s] as const)
              );

              return (
                <>
                  <span className="font-title-md text-title-md text-on-surface">{c.title}</span>

                  {c.notes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {c.notes.map((n) => (
                        <span
                          key={n}
                          className="px-2 py-0.5 rounded-full bg-surface-container-low font-label-sm text-label-sm text-on-surface-variant"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  )}

                  {c.scan && lossesOf(c.scan).length > 0 && (
                    <div className="rounded-lg bg-surface-container-low p-space-xs text-on-surface-variant" data-file-losses="">
                      <WordLossList scan={c.scan} />
                    </div>
                  )}

                  <span className="font-label-md text-label-md text-on-surface-variant">
                    الحقول المستنتجة — سمِّها أو أعِدها نقاطًا
                  </span>
                  {doc.fields.length === 0 ? (
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      لا فراغات في هذه الورقة.
                    </span>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {doc.fields.map((f) => (
                        <FieldRow
                          key={f.key}
                          label={f.label}
                          suggestion={byKey.get(f.key)}
                          onRename={(value) => patchDoc(c.id, (d) => renameField(d, f.key, value))}
                          onDrop={() => patchDoc(c.id, (d) => unfield(d, f.key))}
                        />
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* الترويسة المتكرّرة والتصنيف والتنفيذ */}
        <div className="p-space-md bg-surface-container-low shrink-0 flex flex-col gap-space-sm">
          {shared && !isLayoutEmpty(shared.layout) && (
            <div className="p-space-sm rounded-lg bg-surface-container-lowest flex items-center gap-space-md">
              <label className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface cursor-pointer shrink-0">
                <input
                  className="w-4 h-4 accent-secondary"
                  checked={useShared}
                  type="checkbox"
                  onChange={(e) => setUseShared(e.target.checked)}
                />
                ترويسة واحدة تتكرّر في {shared.count} — احفظها مرّة واربطها بالجميع
              </label>
              <input
                className="w-56 h-8 px-2 rounded bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:ring-1 focus:ring-secondary"
                disabled={!useShared}
                placeholder="اسم الترويسة"
                type="text"
                value={sharedName}
                onChange={(e) => setSharedName(e.target.value)}
              />
              <div className="flex-1 min-w-0 scale-[0.6] origin-right">
                <LetterheadView layout={shared.layout} />
              </div>
            </div>
          )}

          <div className="flex items-center gap-space-sm">
            <label className="flex items-center gap-space-xs font-label-sm text-label-sm text-on-surface-variant">
              التصنيف
              <input
                className="w-40 h-9 px-3 rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md focus:outline-none focus:ring-1 focus:ring-secondary"
                placeholder="مدارس"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </label>
            <span className="font-label-md text-label-md text-on-surface">
              سيُحفظ {accept.size} من {plan.candidates.length}
            </span>
            {taught && (
              <span
                className="font-label-sm text-label-sm text-on-surface-variant"
                data-taught
                title="يتعلّم من تصحيحاتك — عدٌّ لا نموذج، ولا يغادر جهازك شيء"
              >
                تعلّم من مكتبك: {taught.total} تصحيحًا
                {taught.habits ? ` · ${taught.habits} عادة` : ''}
              </span>
            )}
            <span className="flex-1" />
            <button
              className="h-9 px-4 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md"
              type="button"
              onClick={onCancel}
            >
              إلغاء
            </button>
            <button
              className="h-9 px-4 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold disabled:opacity-40"
              type="button"
              disabled={busy || accept.size === 0}
              onClick={apply}
            >
              {busy ? 'جارٍ الحفظ...' : `احفظ ${countIn(accept.size, 'بطاقة')}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
