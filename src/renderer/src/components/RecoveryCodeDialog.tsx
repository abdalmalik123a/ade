/**
 * رمز استرداد بيانات المكتب أوّل مرّة (D237): يُعرض حتى يقرّ المكتب بحفظه — «حفظته» وحدها تغلقه، فلا يضيع بضغطةٍ عابرة.
 * يُنسخ أو يُحفظ ملفًّا ليُطبع أو يُحفظ بعيدًا عن الحاسوب.
 */
import { useEffect, useState } from 'react';

export default function RecoveryCodeDialog() {
  const [code, setCode] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void window.diwan.dataKey
      .pending()
      .then(setCode)
      .catch(() => undefined);
  }, []);

  if (!code) return null;

  return (
    <div className="fixed inset-0 z-50 bg-scrim/40 flex items-center justify-center" data-recovery-dialog="" role="dialog" aria-modal="true">
      <div className="w-[min(560px,92vw)] rounded-card bg-surface p-space-lg flex flex-col gap-space-sm shadow-elevation-3" dir="rtl">
        <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">رمز استرداد بيانات المكتب</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          يحمي ديوان بيانات المكتب بمفتاحٍ تحفظه حماية ويندوز. فإن أُعيد تنصيب ويندوز أو تغيّر الحساب، فلن تُفتح البيانات إلا بهذا الرمز. احفظه بعيدًا عن هذا الحاسوب — ورقةٌ مطبوعة أو هاتف — ولا ترسله لأحد.
        </p>
        <div className="p-space-sm rounded-card bg-surface-container-low text-center font-mono text-[20px] tracking-wider text-on-surface select-all" data-recovery-code="" dir="ltr">
          {code}
        </div>
        {note && <span className="font-label-sm text-label-sm text-secondary break-all">{note}</span>}
        <div className="flex gap-space-xs flex-wrap">
          <button
            className="h-9 px-3 rounded-btn bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md"
            data-act="recovery-copy"
            type="button"
            onClick={() => void navigator.clipboard.writeText(code).then(() => setNote('نُسخ الرمز.'))}
          >
            انسخه
          </button>
          <button
            className="h-9 px-3 rounded-btn bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md"
            data-act="recovery-save"
            type="button"
            onClick={() => void window.diwan.dataKey.save(code).then((path) => path && setNote(`حُفظ في: ${path}`))}
          >
            احفظه ملفًّا
          </button>
          <button
            className="h-9 px-4 rounded-btn bg-secondary text-on-secondary font-label-md text-label-md font-semibold ms-auto"
            data-act="recovery-done"
            type="button"
            onClick={() => void window.diwan.dataKey.acknowledge().then(() => setCode(null))}
          >
            حفظته
          </button>
        </div>
      </div>
    </div>
  );
}
