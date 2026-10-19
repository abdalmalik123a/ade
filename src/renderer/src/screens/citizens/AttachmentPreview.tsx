/**
 * معاينة مستمسكٍ بحجمه (تقسيم شاشة الزبائن بعد ١٫٧٫٠) — منقولةٌ من `CitizensScreen` كما هي.
 */
import type { Dispatch, SetStateAction } from 'react';
import { storeUrl } from './shared';
import type { Attachment } from '@shared/api';

type Props = {
  setPreview: Dispatch<SetStateAction<Attachment | null>>;
  preview: Attachment;
};

export default function AttachmentPreview({ setPreview, preview }: Props) {
  return (
    <div
      role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-scrim/40 backdrop-blur-[2px] flex flex-col items-center justify-center p-space-lg"
      onClick={() => setPreview(null)}
    >
      <div className="mb-space-sm flex items-center gap-space-md text-on-primary">
        <span className="font-headline-sm text-headline-sm">{preview.docType}</span>
        <button
          className="w-9 h-9 rounded-lg bg-surface-container-lowest text-on-surface flex items-center justify-center"
          title="إغلاق"
          type="button"
          onClick={() => setPreview(null)}
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>
      <img
        alt={preview.docType}
        className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl bg-surface-container-lowest"
        src={storeUrl(preview.filePath)}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
