/**
 * لوح التنبيه الإملائي — كلُّ اقتراحٍ سطرٌ يُختار أو يُترك، ولا تصحيح صامت.
 *
 * يُعرض في الورشة على نصّ النموذج، وفي الشبّاك على ما كتبه الموظف. و`onFix`
 * يتسلّم المختار وحده: «علي» الذي هو اسمٌ لا يُقترح أصلًا، وما اقتُرح خطأً يُترك.
 */
import { useEffect, useState } from 'react';
import type { SpellIssue } from '@shared/spelling';

const toIndic = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);

export default function SpellingPanel({
  issues,
  title = 'تنبيهاتٌ إملائية',
  note,
  onFix
}: {
  issues: SpellIssue[];
  title?: string;
  /** سطرٌ تحت العنوان: من أين الاقتراحات، وأين تُصلح. */
  note?: string;
  /** بلا `onFix` يُعرض اللوح للاطّلاع وحده (نصّ نموذجٍ يُصلح في الورشة). */
  onFix?: (chosen: SpellIssue[]) => void;
}) {
  const key = (i: SpellIssue) => `${i.word}→${i.fix}`;
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(issues.map(key)));
  useEffect(() => setChosen(new Set(issues.map(key))), [issues]);

  if (!issues.length) return null;
  return (
    <section className="rounded-xl bg-surface-container-low p-space-sm flex flex-col gap-space-xs" data-spelling="">
      <div className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface font-semibold">
        <span className="material-symbols-outlined text-[18px] text-secondary">spellcheck</span>
        {title} ({toIndic(issues.length)})
      </div>
      {note && <span className="font-label-sm text-label-sm text-on-surface-variant">{note}</span>}
      <ul className="flex flex-col gap-1">
        {issues.map((issue) => (
          <li key={key(issue)} className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface">
            {onFix && (
              <input
                checked={chosen.has(key(issue))}
                className="w-4 h-4 accent-secondary"
                type="checkbox"
                onChange={(e) =>
                  setChosen((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(key(issue));
                    else next.delete(key(issue));
                    return next;
                  })
                }
              />
            )}
            <span className="line-through text-error">{issue.word}</span>
            <span className="material-symbols-outlined text-[14px] text-on-surface-variant">arrow_back</span>
            <b>{issue.fix}</b>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              — {issue.reason}
              {issue.count > 1 ? ` (${toIndic(issue.count)} مرّات)` : ''}
            </span>
          </li>
        ))}
      </ul>
      {onFix && (
        <button
          className="self-start h-8 px-space-sm rounded-lg bg-secondary text-on-secondary font-label-sm text-label-sm font-semibold disabled:opacity-40"
          data-act="fix-spelling"
          disabled={chosen.size === 0}
          type="button"
          onClick={() => onFix(issues.filter((i) => chosen.has(key(i))))}
        >
          أصلح المختار ({toIndic(chosen.size)})
        </button>
      )}
    </section>
  );
}
