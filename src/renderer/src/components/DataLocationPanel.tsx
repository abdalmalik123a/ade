/**
 * مجلّد بيانات المكتب في «الإعدادات ← البيانات» (D236، ر190): أين يحفظ ديوان سجلّ المكتب، وفتحه، ونقله إلى مكانٍ آخر.
 * النقل يجري في التشغيل التالي والقاعدة مغلقة؛ وما بقي جانبًا بعد نقلٍ إلى قرصٍ آخر يُحذف هنا بيد المكتب بتأكيد.
 */
import { useEffect, useState } from 'react';
import type { DataLocationChoice, DataLocationInfo } from '@shared/api';
import { ask } from '../kit/ask';
import { errorText } from '../lib/errors';

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} غ.ب`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} م.ب`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} ك.ب`;
  return `${bytes} بايت`;
}

const softButton =
  'h-9 px-3 rounded-btn bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center justify-center gap-space-xs disabled:opacity-40';

export default function DataLocationPanel() {
  const [info, setInfo] = useState<DataLocationInfo | null>(null);
  const [choice, setChoice] = useState<DataLocationChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setInfo(await window.diwan.dataLocation.get());
    } catch (e) {
      setError(errorText(e, 'تعذّرت قراءة مكان البيانات'));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function pick() {
    setError(null);
    setChoice(await window.diwan.dataLocation.pick());
  }

  async function move() {
    if (!choice || choice.error) return;
    setBusy(true);
    try {
      const ok = await window.diwan.dataLocation.moveTo(choice.target);
      if (!ok) {
        setError('تعذّر اعتماد هذا المكان — اختر غيره.');
        return;
      }
      setChoice(null);
      await load();
      const now = await ask({
        title: 'نقل بيانات المكتب',
        message: 'يُنقل سجلّ المكتب عند تشغيل ديوان القادم. احفظ عملك، ثم أعد التشغيل الآن أو لاحقًا.',
        choices: [
          { key: 'later', label: 'لاحقًا', tone: 'neutral' },
          { key: 'now', label: 'أعد التشغيل الآن', tone: 'primary' }
        ],
        fallback: 'later'
      });
      if (now === 'now') await window.diwan.dataLocation.restart();
    } catch (e) {
      setError(errorText(e, 'تعذّر طلب النقل'));
    } finally {
      setBusy(false);
    }
  }

  async function removeAside(path: string, bytes: number) {
    const sure = await ask({
      title: 'حذف البيانات القديمة؟',
      message: `بقيت نسخةٌ من بيانات المكتب في مكانها القديم بعد النقل: ${path} (${formatBytes(bytes)}). احذفها بعد أن تطمئنّ أنّ ديوان يعمل من المكان الجديد. الحذف نهائي.`,
      choices: [
        { key: 'keep', label: 'ابقِ عليها', tone: 'neutral' },
        { key: 'delete', label: 'احذف', tone: 'danger' }
      ],
      fallback: 'keep'
    });
    if (sure !== 'delete') return;
    setBusy(true);
    try {
      await window.diwan.dataLocation.deleteAside(path);
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!info) return error ? <p className="text-error font-label-sm text-label-sm">{error}</p> : null;

  return (
    <div className="pt-space-sm border-t border-outline-variant/40 flex flex-col gap-space-xs" data-data-location="">
      <span className="font-label-lg text-label-lg font-semibold text-on-surface">مكان بيانات المكتب</span>
      <span className="font-label-sm text-label-sm text-on-surface-variant">
        القاعدة والمستمسكات والصور والترخيص في هذا المجلّد، ولا تُمحى إن أُزيل ديوان. انسخه احتياطيًّا كما تنسخ أيّ ملفٍّ مهمّ.
      </span>
      <span className="font-label-md text-label-md text-on-surface break-all" data-data-path="" dir="ltr">
        {info.path}
      </span>
      {info.pending && (
        <span className="font-label-sm text-label-sm text-secondary break-all" data-data-pending="">
          يُنقل عند التشغيل القادم إلى: {info.pending}
        </span>
      )}
      <div className="flex gap-space-xs">
        <button className={softButton} data-act="data-open" type="button" onClick={() => void window.diwan.dataLocation.open()}>
          <span className="material-symbols-outlined text-[18px]">folder_open</span>
          افتح المجلّد
        </button>
        <button className={softButton} data-act="data-pick" type="button" disabled={busy} onClick={() => void pick()}>
          <span className="material-symbols-outlined text-[18px]">drive_file_move</span>
          انقل إلى مكانٍ آخر
        </button>
      </div>
      {choice && (
        <div className="p-space-sm rounded-card bg-surface-container-low flex flex-col gap-space-xs font-label-md text-label-md" data-data-choice="">
          <span className="break-all" dir="ltr">
            {choice.target}
          </span>
          {choice.error && <span className="text-error" data-data-choice-error="">{choice.error}</span>}
          {choice.warning && <span className="text-error" data-data-choice-warning="">{choice.warning}</span>}
          <div className="flex gap-space-xs">
            {!choice.error && (
              <button
                className="h-9 px-3 rounded-btn bg-secondary text-on-secondary font-label-md text-label-md disabled:opacity-40"
                data-act="data-move"
                type="button"
                disabled={busy}
                onClick={() => void move()}
              >
                {choice.warning ? 'انقل إليه على أيّ حال' : 'انقل إليه'}
              </button>
            )}
            <button className={softButton} type="button" onClick={() => setChoice(null)}>
              ألغِ
            </button>
          </div>
        </div>
      )}
      {info.asides.map((aside) => (
        <div key={aside.path} className="flex items-center justify-between bg-surface-container p-space-xs rounded-md gap-space-xs" data-data-aside={aside.path}>
          <div className="flex flex-col min-w-0">
            <span className="font-label-sm text-label-sm text-on-surface-variant">بيانات المكان القديم بعد النقل — {formatBytes(aside.bytes)}</span>
            <span className="font-label-sm text-label-sm text-on-surface break-all" dir="ltr">
              {aside.path}
            </span>
          </div>
          <button
            className="h-8 px-3 rounded-btn bg-surface-container-high hover:bg-error-container hover:text-on-error-container text-on-surface font-label-sm text-label-sm disabled:opacity-40"
            data-act="data-delete-aside"
            type="button"
            disabled={busy}
            onClick={() => void removeAside(aside.path, aside.bytes)}
          >
            احذف
          </button>
        </div>
      ))}
      {error && <span className="text-error font-label-sm text-label-sm">{error}</span>}
    </div>
  );
}
