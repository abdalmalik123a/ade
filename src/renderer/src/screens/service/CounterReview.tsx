/**
 * الشبّاك — ٣ «راجع» (تقسيم الشبّاك بعد ١٫٧٫٠): منقولةٌ من `ServiceScreen` كما هي — التنبيه الإملائي، والأوراق مملوءةً ورقةً
 * ورقة. وتبقى مركّبةً في الخطوات كلّها (مخفيّةً في غيرها): منها تُؤخذ الأوراق كما رآها الموظف حين تصدر (`sheets`).
 * عرضٌ وحده: الحال والدوالّ كلّها في الشاشة، وتمرّ إليها بأسمائها.
 */
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { GENDER_KEY } from '@shared/gender';
import { applySpelling, type SpellIssue } from '@shared/spelling';
import LetterSheet from '../../components/LetterSheet';
import SpellingPanel from '../../components/SpellingPanel';
import type { Loaded, Step } from './types';

type Props = {
  step: Step;
  typedSpelling: SpellIssue[];
  templateSpelling: SpellIssue[];
  setValues: Dispatch<SetStateAction<Record<string, string>>>;
  merge: boolean;
  rows: string[];
  loaded: Loaded[];
  at: number;
  setAt: Dispatch<SetStateAction<number>>;
  current: Loaded | undefined;
  sheets: MutableRefObject<Map<number, HTMLDivElement | null>>;
  valuesOnly: boolean;
  effective: Record<string, string>;
  registry: { number: string; date: string };
  resolveHead: (text: string) => string;
};

export default function CounterReview({
  step,
  typedSpelling,
  templateSpelling,
  setValues,
  merge,
  rows,
  loaded,
  at,
  setAt,
  current,
  sheets,
  valuesOnly,
  effective,
  registry,
  resolveHead
}: Props) {
  return (
    <div className={step === 'review' ? 'flex flex-col items-center gap-space-md' : 'hidden'}>
      {(typedSpelling.length > 0 || templateSpelling.length > 0) && (
        <div className="w-full max-w-3xl flex flex-col gap-space-xs">
          <SpellingPanel
            issues={typedSpelling}
            title="فيما كُتب في الحقول"
            onFix={(chosen) =>
              setValues((prev) =>
                Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, k === GENDER_KEY ? v : applySpelling(v, chosen)]))
              )
            }
          />
          <SpellingPanel
            issues={templateSpelling}
            title="في نصّ النموذج نفسه"
            note="يُصلح من «المكتبة» (تدقيق إملائي في مصمّم النماذج) — فالشبّاك لا يعدّل النماذج"
          />
        </div>
      )}
      {merge && rows.length > 0 && (
        <span className="font-label-md text-label-md text-on-surface-variant">
          معاينة الاسم الأول ({rows[0]}) — وبقيّة الأسماء {rows.length - 1} مثلها
        </span>
      )}
      {loaded.length > 1 && (
        <div className="flex items-center gap-space-sm">
          <button
            className="w-9 h-9 rounded-lg bg-surface-container-low hover:bg-surface-container-high disabled:opacity-30"
            disabled={at === 0}
            type="button"
            onClick={() => setAt((n) => n - 1)}
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
          <span className="font-label-md text-label-md text-on-surface">
            ورقة {at + 1} من {loaded.length} — {current?.summary.title}
          </span>
          <button
            className="w-9 h-9 rounded-lg bg-surface-container-low hover:bg-surface-container-high disabled:opacity-30"
            disabled={at >= loaded.length - 1}
            type="button"
            onClick={() => setAt((n) => n + 1)}
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
        </div>
      )}

      {loaded.map((l, i) => (
        <div key={l.summary.id} className={i === at ? '' : 'hidden'}>
          <LetterSheet
            sheetRef={(el) => {
              sheets.current.set(l.summary.id, el);
            }}
            className={valuesOnly ? 'values-preview' : ''}
            doc={l.doc}
            layout={l.layout}
            values={effective}
            registry={registry}
            resolve={resolveHead}
          />
        </div>
      ))}
    </div>
  );
}
