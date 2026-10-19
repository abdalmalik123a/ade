/**
 * عرض وحذف مجلّدات البيانات المنقولة جانبًا عند الاسترجاع (`before-restore-*`) يدويًّا بتأكيد (A09 ب).
 */
import { useEffect, useState } from 'react';
import type { BeforeRestoreAside } from '@shared/api';
import { ask } from '../kit/ask';

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} م.ب`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} ك.ب`;
  return `${bytes} بايت`;
}

export default function BackupAsides() {
  const [asides, setAsides] = useState<BeforeRestoreAside[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const list = await window.diwan.backup.listAsides();
      setAsides(list ?? []);
    } catch {
      setAsides([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (asides.length === 0) return null;

  async function handleDelete(aside: BeforeRestoreAside) {
    const choice = await ask({
      title: 'حذف البيانات المنقولة جانبًا؟',
      message: `المجلّد ${aside.name} (${formatBytes(aside.bytes)}). هذا الحذف نهائي ولا يمكن التراجع عنه.`,
      choices: [
        { key: 'keep', label: 'ابقِ عليها', tone: 'neutral' },
        { key: 'delete', label: 'احذف', tone: 'danger' }
      ],
      fallback: 'keep'
    });
    if (choice !== 'delete') return;

    setBusy(aside.name);
    try {
      await window.diwan.backup.deleteAside(aside.name);
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="p-space-sm rounded-lg bg-surface-container-low text-on-surface flex flex-col gap-space-xs font-label-md text-label-md"
      data-before-restore-list=""
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-on-surface">بيانات سابقة نُقلت جانبًا عند الاسترجاع:</span>
        <span className="text-on-surface-variant font-label-sm text-label-sm">
          {asides.length} {asides.length === 1 ? 'مجلّد' : 'مجلّدات'}
        </span>
      </div>
      <p className="text-on-surface-variant font-label-sm text-label-sm">
        تُحفظ تلقائيًّا عند كلّ استرجاعٍ لحماية بياناتك من الضياع، ويمكنك تفريغ مساحتها بعد الاطمئنان على سلامة بياناتك الحالية.
      </p>
      <div className="flex flex-col gap-space-xs mt-1">
        {asides.map((aside) => (
          <div
            key={aside.name}
            className="flex items-center justify-between bg-surface-container p-space-xs rounded-md"
            data-before-restore-item={aside.name}
          >
            <div className="flex flex-col">
              <span className="font-medium text-on-surface">{aside.name}</span>
              <span className="text-on-surface-variant font-label-sm text-label-sm">
                {new Date(aside.at).toLocaleString('ar-IQ-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' })} —{' '}
                {formatBytes(aside.bytes)}
              </span>
            </div>
            <button
              className="h-8 px-3 rounded-lg bg-surface-container-high hover:bg-error-container hover:text-on-error-container text-on-surface font-label-sm text-label-sm disabled:opacity-40"
              data-act="delete-before-restore"
              type="button"
              disabled={busy !== null}
              onClick={() => void handleDelete(aside)}
            >
              {busy === aside.name ? 'يحذف...' : 'احذف'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
