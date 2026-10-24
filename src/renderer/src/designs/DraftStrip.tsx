/**
 * تصاميم لم تُحفظ (DESIGNS.md ٠٫٦) — في رأس المعرض: ما تُرك بالانتقال أو الإغلاق أو انقطاع الكهرباء يُكمَل من هنا بنقرة،
 * كما يُكمَل من «قيد العمل» (وهناك يُحذف).
 */
import { useEffect, useState } from 'react';
import type { DraftRow } from '@shared/api';
import { localStamp } from '@shared/dates';
import { toIndic } from '@shared/arabic';
import { isDesignDraft } from '@shared/design/draft';

const SHOWN = 4;

export default function DraftStrip({ refreshKey, onResume }: { refreshKey: unknown; onResume: (draftId: number) => void }) {
  const [rows, setRows] = useState<DraftRow[]>([]);
  useEffect(() => {
    let live = true;
    window.diwan.drafts
      .list()
      .then((all) => live && setRows(all.filter((d) => isDesignDraft(d.valuesJson))))
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [refreshKey]);

  if (!rows.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-space-sm mt-space-sm px-space-md py-space-sm rounded-card bg-tertiary-container/40 border border-tertiary/30" data-panel="design-drafts">
      <span className="material-symbols-outlined text-[18px] text-tertiary">history</span>
      <span className="font-label-md text-label-md text-on-surface font-semibold">لم يُحفظ بعد:</span>
      {rows.slice(0, SHOWN).map((d) => (
        <button
          key={d.id}
          className="h-8 px-space-sm rounded-btn bg-surface-container-lowest border border-outline-variant font-label-md text-label-md text-on-surface hover:border-primary flex items-center gap-1.5"
          data-act="resume-design-draft"
          title="أكمل التصميم كما تُرك"
          type="button"
          onClick={() => onResume(d.id)}
        >
          {d.title || 'تصميمٌ بلا اسم'}
          <span className="font-label-sm text-label-sm text-on-surface-variant">{localStamp(d.updatedAt)}</span>
        </button>
      ))}
      {rows.length > SHOWN && (
        <span className="font-label-sm text-label-sm text-on-surface-variant">و{toIndic(rows.length - SHOWN)} غيرها في «قيد العمل»</span>
      )}
    </div>
  );
}
