/**
 * «أرسل تقرير المشكلة» (البند ٣٢): الموظف يكتب ما كان يفعل، فيُحفظ ملفٌّ واحد (سطح المكتب أوّلًا) فيه ذلك والإصدار وWindows
 * وآخر سجلّ الأخطاء — ثم «افتح مجلّده» و«راسل المطوّر على واتساب». كان يُقال «أخبرنا به» ولا طريق: السجلّ في مجلّد
 * بيانات المكتب لا يعرفه الموظف. ولا يُرسل البرنامج شيئًا بنفسه، ولا شيء من سجلّ المكتب في التقرير.
 */
import { useState } from 'react';
import { DEVELOPER } from '@shared/brand';
import { useEscape } from '../kit/useEscape';
import { errorText } from '../lib/errors';

export default function ProblemReportDialog({ onClose, error }: { onClose: () => void; error?: string }) {
  useEscape(onClose);
  const [note, setNote] = useState(error ? `ظهرت الرسالة: «${error}»\nوكنت أفعل: ` : '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setFailed(null);
    try {
      const path = await window.diwan.ui.problemReport(note);
      if (path) setSaved(path);
    } catch (e) {
      setFailed(errorText(e, 'تعذّر حفظ التقرير'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-scrim/50 p-space-md"
      data-problem-report=""
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg rounded-2xl bg-surface-container-lowest shadow-2xl p-space-lg flex flex-col gap-space-md">
        <div className="flex items-start gap-space-sm">
          <span className="material-symbols-outlined text-[28px] text-secondary">support_agent</span>
          <div className="flex-1">
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">أرسل تقرير المشكلة</h2>
            <p className="font-label-md text-label-md text-on-surface-variant">
              يُحفظ ملفٌّ واحد ترسله إلى المطوّر بواتساب: ما تكتبه هنا، ورقم الإصدار، وأخطاء البرنامج الأخيرة — ولا شيء من سجلّ
              المكتب ولا أسماء الزبائن.
            </p>
          </div>
          <button className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-surface-container-high" title="إغلاق" type="button" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {saved === null ? (
          <>
            <label className="flex flex-col gap-1 font-label-md text-label-md text-on-surface">
              ماذا كنت تفعل حين ظهرت المشكلة؟ (اختياري)
              <textarea
                autoFocus
                className="min-h-28 p-space-sm rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none focus:ring-1 focus:ring-secondary"
                data-field="problem-note"
                placeholder="مثال: كنت أطبع كتاب تأييد من الشبّاك فظهرت رسالة ولم يُطبع."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            {failed && <p className="font-label-md text-label-md text-error">{failed}</p>}
            <div className="flex justify-end gap-space-sm">
              <button className="h-10 px-space-md rounded-lg text-on-surface hover:bg-surface-container-high font-label-md text-label-md" type="button" onClick={onClose}>
                إلغاء
              </button>
              <button
                className="h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold disabled:opacity-50"
                data-act="save-problem-report"
                disabled={busy}
                type="button"
                onClick={() => void save()}
              >
                {busy ? 'يُحفظ…' : 'احفظ التقرير'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="p-space-sm rounded-lg bg-secondary-fixed text-on-secondary-fixed font-label-md text-label-md" data-problem-saved="">
              حُفظ التقرير — أرسله إلى المطوّر بواتساب ({DEVELOPER.phoneDisplay}) واكتب معه اسم مكتبك.
              <span className="block font-mono text-[11px] break-all opacity-80" dir="ltr">
                {saved}
              </span>
            </p>
            <div className="flex flex-wrap justify-end gap-space-sm">
              <button
                className="h-10 px-space-md rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high font-label-md text-label-md flex items-center gap-1"
                data-act="show-problem-report"
                type="button"
                onClick={() => void window.diwan.ui.showProblemReport()}
              >
                <span className="material-symbols-outlined text-[18px]">folder_open</span>
                افتح مجلّده
              </button>
              <a
                className="h-10 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold flex items-center gap-1"
                data-act="whatsapp-developer"
                href={DEVELOPER.whatsapp}
                rel="noreferrer"
                target="_blank"
              >
                <span className="material-symbols-outlined text-[18px]">chat</span>
                راسل المطوّر على واتساب
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
