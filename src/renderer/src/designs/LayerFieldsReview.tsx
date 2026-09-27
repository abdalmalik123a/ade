/**
 * «حقولٌ من أسماء الطبقات» (هـ٤) — بعد استيراد ملف Photoshop.
 *
 * كلّ طبقةٍ نصّية اسمُها يدلّ على حقل («Name»، «Job Title») تُعرض بنصّها النموذجي
 * والحقل المقترح: الواثق مُعلَّمٌ سلفًا، والمتردّد يُعرض ولا يُعلَّم — والموظف يقبل ويرفض
 * ويعيد التسمية. والنصّ النموذجيّ يبقى قيمةً للمعاينة، فيُرى القالب كما كان.
 */
import { useState } from 'react';
import type { FieldSuggestion } from '@shared/api';
import { APPLY_THRESHOLD } from '@shared/doc';

export default function LayerFieldsReview({
  suggestions,
  onApply,
  onClose
}: {
  suggestions: FieldSuggestion[];
  onApply: (chosen: { elementId: string; key: string; sample: string }[]) => void;
  onClose: () => void;
}) {
  const [on, setOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(suggestions.map((s) => [s.elementId, s.confidence >= APPLY_THRESHOLD]))
  );
  const [keys, setKeys] = useState<Record<string, string>>(() => Object.fromEntries(suggestions.map((s) => [s.elementId, s.key])));
  const count = suggestions.filter((s) => on[s.elementId]).length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim/50 p-space-md" data-layer-fields="">
      <div className="w-full max-w-2xl max-h-[88vh] rounded-2xl bg-surface-container-lowest shadow-2xl flex flex-col overflow-hidden">
        <div className="p-space-md bg-surface-container-low">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">حقولٌ من أسماء الطبقات</h2>
          <p className="font-label-md text-label-md text-on-surface-variant">
            طبقاتٌ نصّية تدلّ أسماؤها على حقول — تصير حقولًا تُملأ لكلّ بطاقة، ونصّها النموذجي يبقى للمعاينة.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-space-md flex flex-col gap-space-xs">
          {suggestions.map((s) => (
            <label key={s.elementId} className="flex items-center gap-space-sm p-space-xs rounded-lg bg-surface-container-low" data-layer-suggestion={s.layer}>
              <input
                checked={on[s.elementId] ?? false}
                className="w-4 h-4 accent-secondary"
                type="checkbox"
                onChange={(e) => setOn((o) => ({ ...o, [s.elementId]: e.target.checked }))}
              />
              <span className="flex flex-col min-w-0 flex-1">
                <span className="font-label-md text-label-md text-on-surface truncate" dir="auto">
                  «{s.sample || '—'}»
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant truncate" title={s.reason}>
                  {s.reason}
                  {s.confidence < APPLY_THRESHOLD ? ' — اقتراحٌ متردّد' : ''}
                </span>
              </span>
              <span className="text-on-surface-variant">←</span>
              <input
                className="w-36 h-8 px-2 rounded bg-surface-container-lowest text-on-surface font-label-md text-label-md"
                value={keys[s.elementId] ?? ''}
                onChange={(e) => setKeys((k) => ({ ...k, [s.elementId]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <div className="p-space-md bg-surface-container-low flex justify-between gap-space-sm">
          <button className="h-10 px-space-md rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md" type="button" onClick={onClose}>
            اتركها نصوصًا
          </button>
          <button
            className="h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold disabled:opacity-40"
            data-act="layer-fields-apply"
            type="button"
            disabled={count === 0}
            onClick={() =>
              onApply(
                suggestions
                  .filter((s) => on[s.elementId] && (keys[s.elementId] ?? '').trim())
                  .map((s) => ({ elementId: s.elementId, key: keys[s.elementId]!.trim(), sample: s.sample }))
              )
            }
          >
            حوّل {count} إلى حقول
          </button>
        </div>
      </div>
    </div>
  );
}
