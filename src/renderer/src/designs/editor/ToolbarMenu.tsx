/**
 * قائمةٌ في شريط المصمّم (محادثة «التصاميم»، البند ١٣): زرٌّ باسمه يفتح أدواتٍ متقاربة — فيبقى الشريط بما يُستعمل كلّ يوم،
 * وكان نحو ثلاثين أيقونةً في صفٍّ واحد. والأدوات مركّبةٌ وإن طُويت (مخفيّة)، فاختصاراتها وأسماؤها كما هي، وتُغلق بالضغط خارجها
 * وبـEscape وبعد كلّ فعل. والقائمة فوق الشريط لا داخله: الشريط يُمرَّر أفقيًّا فيقصّ ما يتدلّى منه.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useEscape } from '../../kit/useEscape';

export default function ToolbarMenu({ act, icon, label, children }: { act: string; icon: string; label: string; children: ReactNode }) {
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEscape(() => setAt(null), at !== null);
  // التمرير وتغيّر المقاس يحرّكان الزرّ — فتُغلق بدل أن تبقى معلّقةً في غير مكانها.
  useEffect(() => {
    if (!at) return;
    const close = () => setAt(null);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [at]);
  const open = () => {
    const r = btn.current?.getBoundingClientRect();
    if (r) setAt({ top: r.bottom + 4, right: window.innerWidth - r.right });
  };
  return (
    <>
      <button
        ref={btn}
        aria-expanded={at !== null}
        className={`h-9 px-2.5 rounded-lg flex items-center gap-1 font-label-md text-label-md shrink-0 transition-colors ${
          at ? 'bg-primary-container text-on-primary' : 'text-on-surface hover:bg-surface-container-high'
        }`}
        data-menu={act}
        type="button"
        onClick={() => (at ? setAt(null) : open())}
      >
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
        {label}
        <span className="material-symbols-outlined text-[16px]">expand_more</span>
      </button>
      {at && <div className="fixed inset-0 z-40" onMouseDown={() => setAt(null)} />}
      <div
        className={`${at ? '' : 'hidden'} fixed z-50 p-space-sm rounded-xl bg-surface-container-lowest shadow-xl border border-outline-variant/60 flex flex-col gap-space-xs`}
        data-menu-panel={act}
        style={at ?? undefined}
        onClick={(e) => {
          // فعلٌ نُفّذ يُغلقها — لا الضغط على فراغها.
          if ((e.target as HTMLElement).closest('button')) setAt(null);
        }}
      >
        {children}
      </div>
    </>
  );
}
