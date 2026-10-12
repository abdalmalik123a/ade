/**
 * فهرس الإعدادات (محادثة «السجلّ والزبائن وقيد العمل والإعدادات»، البند ٢٠): أسماء أقسامها في أعلاها، ثابتةً وهي تُمرَّر، وكلّ
 * اسمٍ ينقل إلى قسمه. وكانت صفحةً واحدة طويلة (نحو ثلاث شاشات) باثني عشر قسمًا بلا فهرس، و«النسخ الاحتياطية» في وسطها.
 *
 * والأسماء تُقرأ من عناوين الأقسام نفسها (`data-settings-section`) بعد رسمها — فلا يختلف الفهرس عمّا تحته إن أُضيف قسم.
 */
import { useEffect, useState } from 'react';

export default function SettingsIndex({ ready }: { ready: boolean }) {
  const [items, setItems] = useState<string[]>([]);
  // ويُعاد قراءتها كلّما رُسم في الصفحة شيء: بطاقة «التفعيل» تنتظر حال الترخيص فتُرسم بعد غيرها.
  useEffect(() => {
    const page = document.querySelector('[data-settings]');
    if (!ready || !page) return;
    const read = () => {
      const next = [...page.querySelectorAll<HTMLElement>('[data-settings-section]')].map((h) => h.dataset.settingsSection ?? '');
      setItems((cur) => (cur.join('|') === next.join('|') ? cur : next));
    };
    read();
    const watch = new MutationObserver(read);
    watch.observe(page, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, [ready]);
  if (!items.length) return null;
  /**
   * إلى القسم وعنوانه تحت الفهرس: الهامش من ارتفاع الفهرس الفعليّ لا رقمٍ ثابت — فإن التفّت أسماؤه سطرين (نافذةٌ أضيق أو قسمٌ
   * أُضيف) لم يختبئ العنوان تحته. وكان ١٣٦ ثابتًا فاختبأ ٤ نقاط حين صار الفهرس سطرين.
   */
  const go = (name: string) => {
    const head = document.querySelector<HTMLElement>(`[data-settings] [data-settings-section="${CSS.escape(name)}"]`);
    const nav = document.querySelector<HTMLElement>('[data-settings-index]');
    if (!head) return;
    if (nav) head.style.scrollMarginTop = `${Math.ceil((parseFloat(getComputedStyle(nav).top) || 0) + nav.getBoundingClientRect().height + 4)}px`;
    head.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <nav className="sticky top-16 z-20 -mx-space-lg px-space-lg py-space-xs bg-surface/95 backdrop-blur flex flex-wrap items-center gap-1" data-settings-index="">
      {items.map((name) => (
        <button
          key={name}
          className="h-8 px-3 rounded-full bg-surface-container-lowest hover:bg-surface-container-high text-on-surface font-label-md text-label-md shadow-sm"
          data-settings-go={name}
          type="button"
          onClick={() => go(name)}
        >
          {name}
        </button>
      ))}
    </nav>
  );
}
