/**
 * «قبل الطباعة: ذكرٌ أم أنثى؟» — للأسماء التي لم يُعرف جنسها يقينًا (ج٤).
 *
 * الدفعة تطبع «الطالب» و«الطالبة» من اسم كلّ صاحب؛ و«رسل» لا يُعرف من لاحقته. فكان
 * يُفترض «ذكرًا» صامتًا فيخرج «الطالب رسل» — تخمينٌ على ورقةٍ رسمية (المبدأ ٥).
 * فيُسأل هنا، ويُحفظ الجواب فلا يُسأل عن الاسم ثانيةً في هذا المكتب.
 */
import { useState } from 'react';
import { guessGender, type Gender, type LearnedGenders } from '@shared/gender';

export default function GenderReview({
  names,
  learned,
  onDone,
  onCancel
}: {
  names: string[];
  learned: LearnedGenders;
  onDone: (decisions: Record<string, Gender>) => void;
  onCancel: () => void;
}) {
  const [picked, setPicked] = useState<Record<string, Gender>>({});
  const left = names.filter((n) => !picked[n]).length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim/50 p-space-md" data-gender-review="">
      <div className="w-full max-w-lg max-h-[85vh] rounded-2xl bg-surface-container-lowest shadow-2xl flex flex-col overflow-hidden">
        <div className="p-space-md bg-surface-container-low">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">قبل الطباعة: ذكرٌ أم أنثى؟</h2>
          <p className="font-label-md text-label-md text-on-surface-variant">
            {names.length} اسمًا لا يُعرف جنسه من الاسم وحده — والورقة تطبع «الطالب» أو «الطالبة» بحسبه. ويُحفظ جوابك فلا
            يُسأل عنه ثانيةً.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-space-md flex flex-col gap-space-xs">
          {names.map((name) => {
            const hint = guessGender(name, learned)?.gender;
            return (
              <div key={name} className="flex items-center gap-space-sm" data-gender-name={name}>
                <span className="flex-1 font-label-lg text-label-lg text-on-surface truncate">{name}</span>
                {(['ذكر', 'أنثى'] as const).map((g) => (
                  <button
                    key={g}
                    className={`h-8 px-4 rounded-lg font-label-md text-label-md ${
                      picked[name] === g
                        ? 'bg-secondary text-on-secondary font-bold'
                        : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'
                    }`}
                    data-gender-pick={g}
                    title={hint === g ? 'هذا ما يقترحه الاسم — بلا يقين' : undefined}
                    type="button"
                    onClick={() => setPicked((p) => ({ ...p, [name]: g }))}
                  >
                    {g}
                    {hint === g && !picked[name] ? '؟' : ''}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
        <div className="p-space-md bg-surface-container-low flex items-center justify-between gap-space-sm">
          <span className="font-label-sm text-label-sm text-on-surface-variant">{left ? `بقي ${left}` : 'حُسمت كلّها'}</span>
          <div className="flex gap-space-xs">
            <button className="h-9 px-space-md rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md" type="button" onClick={onCancel}>
              رجوع
            </button>
            <button
              className="h-9 px-space-md rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold disabled:opacity-40"
              data-act="gender-review-done"
              type="button"
              disabled={left > 0}
              onClick={() => onDone(picked)}
            >
              اعتمد وتابع الطباعة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
