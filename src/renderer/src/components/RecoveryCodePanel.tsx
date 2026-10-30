/**
 * رمز الاسترداد في «الإعدادات ← البيانات» (D237): يُعرض بعد تأكيد، ويُستبدل برمزٍ جديد يُبطل القديم.
 */
import { useState } from 'react';
import { ask } from '../kit/ask';
import { errorText } from '../lib/errors';

const softButton =
  'h-9 px-3 rounded-btn bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center justify-center gap-space-xs disabled:opacity-40';

export default function RecoveryCodePanel() {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function show() {
    const sure = await ask({
      title: 'عرض رمز الاسترداد',
      message: 'من يرى الرمز يستطيع أن يفتح بيانات المكتب على حاسوبٍ آخر. اعرضه حين لا يراه غيرك.',
      choices: [
        { key: 'no', label: 'ألغِ', tone: 'neutral' },
        { key: 'show', label: 'اعرضه', tone: 'primary' }
      ],
      fallback: 'no'
    });
    if (sure !== 'show') return;
    const shown = await window.diwan.dataKey.show();
    setCode(shown);
    setError(shown ? null : 'تعذّر عرض الرمز: حماية ويندوز لا تفتحه على هذا الحساب.');
  }

  async function renew() {
    const sure = await ask({
      title: 'رمز استرداد جديد',
      message: 'يُبطل الرمز القديم فلا يفتح البيانات بعد اليوم، ويُعرض الجديد لتحفظه.',
      choices: [
        { key: 'no', label: 'ألغِ', tone: 'neutral' },
        { key: 'renew', label: 'أنشئ رمزًا جديدًا', tone: 'danger' }
      ],
      fallback: 'no'
    });
    if (sure !== 'renew') return;
    try {
      setCode(await window.diwan.dataKey.renew());
    } catch (e) {
      setError(errorText(e, 'تعذّر إنشاء رمزٍ جديد'));
    }
  }

  return (
    <div className="flex flex-col gap-space-xs" data-recovery-panel="">
      <span className="font-label-md text-label-md font-semibold text-on-surface">رمز الاسترداد</span>
      <span className="font-label-sm text-label-sm text-on-surface-variant">يفتح بيانات المكتب إن أُعيد تنصيب ويندوز أو تغيّر الحساب.</span>
      {code && (
        <span className="p-space-xs rounded-md bg-surface-container-low font-mono text-[16px] tracking-wider text-center" data-recovery-shown="" dir="ltr">
          {code}
        </span>
      )}
      <div className="flex gap-space-xs">
        <button className={softButton} data-act="recovery-show" type="button" onClick={() => void show()}>
          <span className="material-symbols-outlined text-[18px]">key</span>
          اعرض رمز الاسترداد
        </button>
        <button className={softButton} data-act="recovery-renew" type="button" onClick={() => void renew()}>
          أنشئ رمزًا جديدًا
        </button>
      </div>
      {error && <span className="text-error font-label-sm text-label-sm">{error}</span>}
    </div>
  );
}
