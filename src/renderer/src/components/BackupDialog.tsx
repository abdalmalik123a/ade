/**
 * حوار «نسخة احتياطية» من الأرشيف (خطة Production، ٤٫١) — النموذج نفسه الذي في الإعدادات: بكلمة
 * مرورٍ إن شاء المكتب، ومكانٌ يختاره. كان الزرّ يأخذها غير مشفّرةٍ بلا سؤال.
 */
import BackupCreate, { type BackupMade } from './BackupCreate';
import { useState } from 'react';
import { useEscape } from '../kit/useEscape';

export default function BackupDialog({ onClose, onDone }: { onClose: () => void; onDone: (made: BackupMade) => void }) {
  useEscape(onClose);
  const [error, setError] = useState<string | null>(null);
  return (
    <div
      role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim/50 p-space-md"
      data-backup-dialog=""
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md surface-panel p-space-lg flex flex-col gap-space-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-secondary">backup</span>
            نسخة احتياطية كاملة
          </h2>
          <button
            className="w-8 h-8 rounded-btn flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high"
            data-act="backup-dialog-close"
            title="إغلاق"
            type="button"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <p className="font-label-md text-label-md text-on-surface-variant">
          الكتب الصادرة والمواطنون ومستمسكاتهم والنماذج والترويسات — في ملفٍّ واحد تحفظه خارج هذا الجهاز.
        </p>
        <BackupCreate
          onDone={(made) => {
            onDone(made);
            onClose();
          }}
          onError={setError}
        />
        {error && <p className="font-label-sm text-label-sm text-error">{error}</p>}
      </div>
    </div>
  );
}
