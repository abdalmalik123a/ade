/**
 * الأوراق المحفوظة في شاشة الأسئلة (تقسيمها بعد ١٫٧٫٠) — منقولةٌ من `PapersScreen` كما هي.
 */
import type { Dispatch, SetStateAction } from 'react';
import { ICON_BTN } from './shared';
import { confirmAction } from '../../kit/ask';
import type { TemplateSummary } from '@shared/api';

type Props = {
  papers: TemplateSummary[];
  openPaper: (id: number) => Promise<void>;
  paperId: number | null;
  setPaperId: Dispatch<SetStateAction<number | null>>;
  loadPapers: () => Promise<void>;
  onChanged: (() => void) | undefined;
  say: (text: string, tone?: 'ok' | 'warn') => void;
};

export default function SavedPapers({ papers, openPaper, paperId, setPaperId, loadPapers, onChanged, say }: Props) {
  return (
    <div className="rounded-xl bg-surface-container-lowest p-space-md space-y-space-xs">
      <h2 className="font-title-sm text-title-sm text-on-surface font-semibold">
        أوراقٌ محفوظة ({papers.length})
      </h2>
      {papers.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between rounded-lg px-space-sm py-1.5 hover:bg-surface-container-high"
        >
          <button
            className="text-right flex-1 font-body-sm text-body-sm text-on-surface"
            type="button"
            onClick={() => void openPaper(p.id)}
          >
            {p.title}
            {p.subtitle && <span className="text-on-surface-variant"> — {p.subtitle}</span>}
          </button>
          <button
            className={ICON_BTN}
            title="احذف الورقة"
            type="button"
            onClick={async () => {
              // ورقةُ أسئلةٍ محفوظة بنقرة: تُمحى ونسخها السابقة (ج٢).
              const ok = await confirmAction({
                title: `حذف الورقة «${p.title}»؟`,
                message: 'تُمحى ورقة الأسئلة المحفوظة ونسخها السابقة. لا رجعة بعد الحذف.',
                confirm: 'احذفها نهائيًّا',
                danger: true
              });
              if (!ok) return;
              await window.diwan.templates.delete(p.id);
              if (paperId === p.id) setPaperId(null);
              await loadPapers();
              onChanged?.();
              say('حُذفت الورقة');
            }}
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      ))}
    </div>
  );
}
