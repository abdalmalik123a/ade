/**
 * مضيف السؤال (ج١) — يُركَّب مرّةً في جذر الواجهة، ويعرض ما يطلبه `ask()` من أيّ مكان.
 *
 * - Esc أو النقر خارج الحوار = الجواب الاحتياطي (`fallback`)، وعليه التركيز: فـEnter لا يمرّ على حذف.
 * - الأسئلة المتتالية تصطفّ، فلا يضيع سؤالٌ بسؤال.
 * - Esc يُلتقط قبل غيره (طور الالتقاط): فلا يغلق ملفَّ الزبون من تحت السؤال ما كُتب فيه (ج٤).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { mountHost, type AskOptions, type ChoiceTone } from './ask';

type Item = { options: AskOptions<string>; resolve: (key: string) => void };

const TONES: Record<ChoiceTone, string> = {
  primary: 'bg-primary-container text-on-primary font-bold',
  danger: 'bg-error text-on-error font-bold',
  neutral: 'bg-surface-container hover:bg-surface-container-high text-on-surface'
};

export default function ConfirmHost() {
  const [queue, setQueue] = useState<Item[]>([]);
  const focusRef = useRef<HTMLButtonElement | null>(null);

  useEffect(
    () =>
      mountHost(
        (options) =>
          new Promise<string>((resolve) => {
            setQueue((q) => [...q, { options, resolve }]);
          })
      ),
    []
  );

  const current = queue[0];

  const finish = useCallback((item: Item, key: string) => {
    item.resolve(key);
    setQueue((q) => q.filter((x) => x !== item));
  }, []);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      finish(current, current.options.fallback);
    };
    window.addEventListener('keydown', onKey, true);
    focusRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey, true);
  }, [current, finish]);

  if (!current) return null;
  const { options } = current;

  return (
    <div
      aria-labelledby="confirm-title"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-scrim/50"
      data-confirm=""
      role="alertdialog"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) finish(current, options.fallback);
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest shadow-2xl p-space-lg flex flex-col gap-space-md">
        <span className="font-headline-sm text-headline-sm text-on-surface" data-confirm-title="" id="confirm-title">
          {options.title}
        </span>
        {options.message && <p className="font-body-md text-body-md text-on-surface-variant leading-7">{options.message}</p>}
        <div className="flex items-center gap-space-sm justify-end flex-wrap">
          {options.choices.map((c) => (
            <button
              key={c.key}
              ref={c.key === options.fallback ? focusRef : undefined}
              className={`h-10 px-4 rounded-lg font-label-md text-label-md ${TONES[c.tone ?? 'neutral']}`}
              data-choice={c.key}
              type="button"
              onClick={() => finish(current, c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
