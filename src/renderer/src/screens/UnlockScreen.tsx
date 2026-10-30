/**
 * نافذة رمز الاسترداد (D237): تظهر قبل أن تُفتح بيانات المكتب حين لا تفتحها حماية ويندوز — أُعيد تنصيب ويندوز
 * أو تغيّر الحساب. الرمز الصحيح يفتحها ويمضي البرنامج؛ ولا شيء يُكتب قبله.
 */
import { useState } from 'react';

export default function UnlockScreen() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const out = await window.diwan.dataKey.unlock(code);
      if (out.ok) setDone(true);
      else setError(out.error ?? 'رمز الاسترداد غير صحيح');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-surface text-on-surface flex flex-col gap-space-md p-space-lg" dir="rtl" data-unlock="">
      <h1 className="font-headline-sm text-headline-sm font-bold">فتح بيانات المكتب</h1>
      <p className="font-body-md text-body-md text-on-surface-variant">
        لم تستطع حماية ويندوز فتح بيانات المكتب على هذا الحساب — يحدث هذا بعد إعادة تنصيب ويندوز أو تغيير الحساب. اكتب رمز الاسترداد الذي حفظه المكتب.
      </p>
      {done ? (
        <p className="font-body-md text-body-md text-secondary font-semibold" data-unlock-done="">
          فُتحت بيانات المكتب — يُفتح ديوان الآن.
        </p>
      ) : (
        <form
          className="flex flex-col gap-space-sm"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input
            autoFocus
            className="h-11 px-3 rounded-btn bg-surface-container-low border border-outline-variant font-mono text-[18px] tracking-wider text-center"
            data-unlock-code=""
            dir="ltr"
            placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
            spellCheck={false}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          {error && (
            <span className="text-error font-label-md text-label-md" data-unlock-error="">
              {error}
            </span>
          )}
          <button
            className="h-10 rounded-btn bg-secondary text-on-secondary font-label-lg text-label-lg font-semibold disabled:opacity-40"
            data-act="unlock"
            disabled={busy || !code.trim()}
            type="submit"
          >
            افتح
          </button>
        </form>
      )}
      <p className="font-label-sm text-label-sm text-on-surface-variant">ليس عندك الرمز؟ لا تحذف شيئًا من مجلّد البيانات، وراسل المطوّر.</p>
    </main>
  );
}
