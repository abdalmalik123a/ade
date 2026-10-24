/**
 * بطاقة النموذج في المكتبة (تقسيمها بعد ١٫٧٫٠) — منقولةٌ من `TemplatesScreen` كما هي: ورقته مصغّرة، وفتحه وتكراره وتصديره وحذفه.
 */
import type { TemplateSummary } from '@shared/api';
import type { Letterhead } from '@shared/letterhead';
import { useState } from 'react';
import { nf } from './shared';
import { MiniSheet } from './MiniSheet';
import { count } from '@shared/arabic';

export function TemplateCard({
  template,
  letterheads,
  onOpen,
  onEdit,
  onDuplicate,
  onZoom,
  onExport,
  onDelete
}: {
  template: TemplateSummary;
  letterheads: Letterhead[];
  onOpen: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onZoom: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [usage, setUsage] = useState<number | null>(null);

  async function askDelete() {
    setUsage(await window.diwan.templates.usage(template.id));
    setConfirming(true);
  }

  const letterhead =
    letterheads.find((l) => l.id === template.letterheadId) ??
    letterheads.find((l) => l.isDefault) ??
    null;

  return (
    <article className="bg-surface-container-lowest rounded-card shadow-low flex flex-col overflow-hidden">
      <div className="p-space-md flex items-start justify-between gap-space-sm">
        <div className="flex flex-col gap-space-xs min-w-0">
          <div className="flex items-center gap-space-xs">
            {template.category && (
              <span className="px-space-xs py-0.5 rounded bg-surface-container-high font-label-sm text-label-sm text-secondary font-semibold">
                {template.category}
              </span>
            )}
            {template.code && (
              <span className="font-code-sm text-code-sm text-on-surface-variant font-mono">
                CODE: {template.code}
              </span>
            )}
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface truncate">
            {template.title}
          </h3>
          {template.subtitle && (
            <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
              {template.subtitle}
            </span>
          )}
        </div>
        <div className="flex items-center gap-space-xs shrink-0">
          <div className="flex flex-col items-center">
            <span className="font-headline-md text-headline-md text-on-surface font-bold tabular">
              {nf.format(template.issuedThisMonth)}
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant text-center">
              طبعة هذا الشهر
            </span>
          </div>
          {/* التصدير والحذف في الرأس أيضًا: البطاقة بنسبة A4 فتدفع صفّ الأزرار
              أسفل حافة الشاشة، والحذف لا يجوز أن يحتاج تمريرًا للوصول إليه. */}
          <div className="flex flex-col gap-1">
            <button
              className="w-8 h-8 rounded-btn bg-surface-container-high text-on-surface flex items-center justify-center hover:bg-surface-container-highest transition-colors"
              title="صدّره مستند Word — للمشاركة والطباعة خارج المكتب"
              type="button"
              onClick={onExport}
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
            </button>
            <button
              className="w-8 h-8 rounded-btn bg-surface-container-high text-error flex items-center justify-center hover:bg-error-container transition-colors"
              title="حذف النموذج"
              type="button"
              onClick={() => void askDelete()}
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
            </button>
          </div>
        </div>
      </div>

      <div className="px-space-md py-space-sm bg-surface-container-low flex justify-center items-center">
        <div className="paper w-full max-w-[310px] aspect-[1/1.38] bg-surface-container-lowest rounded shadow-[0_1px_3px_rgba(15,23,42,0.06),0_16px_32px_-4px_rgba(15,23,42,0.08)] text-right relative overflow-hidden select-none">
          <MiniSheet template={template} letterhead={letterhead} scale={310 / 794} />
        </div>
      </div>

      {template.variables.length > 0 && (
        <div className="p-space-md flex flex-wrap items-center gap-space-xs">
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            المتغيرات المحقونة:
          </span>
          {template.variables.map((v) => (
            <span
              key={v}
              className="px-space-xs py-0.5 rounded bg-surface-container-high text-secondary font-mono font-label-sm text-label-sm"
            >
              [{v}]
            </span>
          ))}
        </div>
      )}

      {confirming ? (
        <div className="p-space-md pt-0 mt-auto flex flex-col gap-space-xs">
          <span className="font-label-sm text-label-sm text-error text-center">
            {usage && usage > 0
              ? `صدر عن هذا النموذج ${count(usage, 'كتاب')} — تحذفه؟`
              : 'تأكيد حذف النموذج؟'}
          </span>
          <div className="flex items-center gap-space-xs">
            <button
              className="flex-1 h-9 rounded-btn bg-error text-on-error font-label-md text-label-md font-semibold"
              type="button"
              onClick={() => {
                setConfirming(false);
                onDelete();
              }}
            >
              نعم، احذف
            </button>
            <button
              className="flex-1 h-9 rounded-btn bg-surface-container-high text-on-surface font-label-md text-label-md"
              type="button"
              onClick={() => setConfirming(false)}
            >
              تراجع
            </button>
          </div>
        </div>
      ) : (
        <div className="p-space-md pt-0 mt-auto flex items-center gap-space-xs">
          <button
            className="flex-1 h-9 btn-act font-label-md text-label-md font-semibold flex items-center justify-center gap-space-xs transition-all"
            type="button"
            onClick={onOpen}
          >
            <span className="material-symbols-outlined text-[18px]">edit_document</span>
            <span>فتح في المحرر</span>
          </button>
          <button
            className="w-9 h-9 rounded-btn bg-surface-container-high text-on-surface flex items-center justify-center hover:bg-surface-container-highest transition-colors"
            title="تعديل صيغ المتغيرات"
            type="button"
            onClick={onEdit}
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
          </button>
          <button
            className="w-9 h-9 rounded-btn bg-surface-container-high text-on-surface flex items-center justify-center hover:bg-surface-container-highest transition-colors"
            title="نسخ النموذج — نسخة مستقلّة تُعدَّل دون المساس بالأصل"
            type="button"
            onClick={onDuplicate}
          >
            <span className="material-symbols-outlined text-[18px]">content_copy</span>
          </button>
          <button
            className="w-9 h-9 rounded-btn bg-surface-container-high text-on-surface flex items-center justify-center hover:bg-surface-container-highest transition-colors"
            title="معاينة بالحجم الكامل A4"
            type="button"
            onClick={onZoom}
          >
            <span className="material-symbols-outlined text-[18px]">zoom_in</span>
          </button>
          <button
            className="w-9 h-9 rounded-btn bg-surface-container-high text-on-surface flex items-center justify-center hover:bg-surface-container-highest transition-colors"
            title="صدّره مستند Word — للمشاركة والطباعة خارج المكتب"
            type="button"
            onClick={onExport}
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
          </button>
          <button
            className="w-9 h-9 rounded-btn bg-surface-container-high text-error flex items-center justify-center hover:bg-error-container transition-colors"
            title="حذف النموذج"
            type="button"
            onClick={() => void askDelete()}
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      )}
    </article>
  );
}
