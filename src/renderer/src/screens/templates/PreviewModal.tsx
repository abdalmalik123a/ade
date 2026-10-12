/**
 * معاينة النموذج بحجمه (تقسيم مكتبة النماذج بعد ١٫٧٫٠) — منقولةٌ من `TemplatesScreen` كما هي.
 */
import type { TemplateSummary } from '@shared/api';
import type { Letterhead } from '@shared/letterhead';
import { useEffect } from 'react';
import { MiniSheet } from './MiniSheet';

export function PreviewModal({
  template,
  letterheads,
  onClose,
  onOpen
}: {
  template: TemplateSummary;
  letterheads: Letterhead[];
  onClose: () => void;
  onOpen: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const letterhead =
    letterheads.find((l) => l.id === template.letterheadId) ??
    letterheads.find((l) => l.isDefault) ??
    null;

  return (
    <div
      className="fixed inset-0 z-50 bg-scrim/40 backdrop-blur-[2px] flex flex-col items-center overflow-auto py-space-lg"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest rounded-lg shadow-2xl shrink-0"
        style={{ width: 794 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-12 px-space-md flex items-center justify-between bg-surface-container-low rounded-t-lg">
          <span className="font-headline-sm text-headline-sm text-on-surface truncate">
            {template.title}
          </span>
          <div className="flex items-center gap-space-sm">
            <button
              className="px-space-md h-8 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold"
              type="button"
              onClick={onOpen}
            >
              فتح في المحرر
            </button>
            <button
              className="w-8 h-8 rounded text-on-surface-variant hover:bg-surface-container-high flex items-center justify-center"
              title="إغلاق (Esc)"
              type="button"
              onClick={onClose}
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>
        <div className="a4-sheet bg-surface-container-lowest">
          <MiniSheet template={template} letterhead={letterhead} scale={1} />
        </div>
      </div>
    </div>
  );
}
