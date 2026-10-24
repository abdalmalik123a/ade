/**
 * «ما لم يُنقل من Word» (الموجة ٢): لكلّ ما في الملف ولا تحمله الورقة سطرٌ — اسمه، وكم مرّة، وما صار إليه أو ما
 * يفعله الموظف. بجانب الورقة المستوردة في المصمّم، وفي تفصيل كلّ ملفٍّ من «استورد مجلدي».
 */
import type { WordScan } from '@shared/wordLosses';
import { lossesOf } from '@shared/wordLosses';

export function WordLossList({ scan }: { scan: WordScan }) {
  const losses = lossesOf(scan);
  if (!losses.length) return null;
  return (
    <ul className="flex flex-col gap-0.5 font-label-sm text-label-sm" data-word-losses="">
      {losses.map((l) => (
        <li key={l.key} data-word-loss={l.key}>
          <span className="font-semibold">{l.label}</span>
          {l.key !== 'font' && ` (${l.count})`}: {l.hint}
          {l.key === 'font' && ` — ${scan.fonts.join('، ')}`}
        </li>
      ))}
    </ul>
  );
}

/** لوحٌ يُغلق فوق الورقة المستوردة: ما لم يُنقل منها — فلا يُكتشف بعد الطباعة. */
export default function WordLossPanel({ scan, onClose }: { scan: WordScan; onClose: () => void }) {
  if (!lossesOf(scan).length) return null;
  return (
    <div className="mb-space-md rounded-card border border-outline-variant bg-surface-container-low p-space-sm flex gap-space-sm" data-word-loss-panel="">
      <span className="material-symbols-outlined text-[20px] text-on-surface-variant">info</span>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <span className="font-label-md text-label-md font-semibold text-on-surface">ما في ملف Word ولم يُنقل إلى الورقة</span>
        <WordLossList scan={scan} />
      </div>
      <button aria-label="أغلق" className="self-start w-7 h-7 rounded-btn hover:bg-surface-container-high flex items-center justify-center" type="button" onClick={onClose}>
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
}
