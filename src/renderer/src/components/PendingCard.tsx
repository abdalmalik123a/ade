/**
 * ما لم يكتمل من غير الطلبات في «قيد العمل»: مسودّةٌ أو معاملةٌ معلّقة — بزرٍّ واحد.
 */
import type { DraftRow } from '@shared/api';
import { localStamp } from '@shared/dates';
import { isDesignDraft } from '@shared/design/draft';

export function PendingCard({
  kind,
  icon,
  title,
  sub,
  when,
  action,
  act,
  onRun,
  onDelete
}: {
  kind: string;
  icon: string;
  title: string;
  sub: string;
  when: string;
  action: string;
  act: string;
  onRun: () => void;
  /** المسودّة وحدها تُحذف من هنا (د٢). */
  onDelete?: () => void;
}) {
  return (
    <article className="rounded-card bg-surface-container-lowest border border-outline-variant p-space-sm space-y-space-xs shadow-soft" data-pending={act}>
      <div className="flex items-center justify-between gap-2 font-label-sm text-label-sm text-on-surface-variant">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="material-symbols-outlined text-[16px] text-secondary">{icon}</span>
          <span className="truncate">{kind}</span>
        </span>
        <span className="shrink-0 tabular">{when}</span>
      </div>
      <div className="font-body-md text-body-md text-on-surface font-semibold truncate">{title}</div>
      {sub && <div className="font-label-sm text-label-sm text-on-surface-variant truncate">{sub}</div>}
      <div className="flex items-center gap-1">
        <button className="flex-1 h-8 btn-act font-label-md text-label-md font-semibold" data-act={act} type="button" onClick={onRun}>
          {action}
        </button>
        {onDelete && (
          <button
            className="w-8 h-8 shrink-0 rounded-btn text-on-surface-variant hover:bg-error-container hover:text-on-error-container flex items-center justify-center"
            data-act="delete-draft"
            title="احذف المسودّة"
            type="button"
            onClick={onDelete}
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
        )}
      </div>
    </article>
  );
}

/** مسودّة: كتابٌ يُكمَل في المحرّر، أو تصميمٌ لم يُحفظ يُكمَل في التصاميم (DESIGNS.md ٠٫٦). */
export function DraftCard({
  draft: d,
  onOpen,
  onOpenDesign,
  onDelete
}: {
  draft: DraftRow;
  onOpen?: (id: number) => void;
  onOpenDesign?: (id: number) => void;
  onDelete: () => void;
}) {
  const design = isDesignDraft(d.valuesJson);
  return (
    <PendingCard
      action="أكمله"
      act={design ? 'resume-design-draft' : 'resume-draft'}
      icon={design ? 'palette' : 'edit_document'}
      kind={design ? 'تصميمٌ لم يُحفظ' : 'مسودة كتاب'}
      sub={design ? (d.templateTitle ? `تعديلٌ على «${d.templateTitle}»` : 'تصميمٌ جديد') : [d.citizenName, d.templateTitle].filter(Boolean).join(' · ')}
      title={d.title || (design ? 'تصميمٌ بلا اسم' : 'كتابٌ بلا عنوان')}
      when={localStamp(d.updatedAt)}
      onRun={() => (design ? onOpenDesign : onOpen)?.(d.id)}
      onDelete={onDelete}
    />
  );
}
