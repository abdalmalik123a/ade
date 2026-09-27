import { useEffect, useRef, useState } from 'react';
import type { RouteKey } from '@shared/routes';

export type LiveDemoRobotProps = {
  isActive: boolean;
  onStop: () => void;
  onNavigate: (route: RouteKey) => void;
};

export default function LiveDemoRobot({ isActive, onStop, onNavigate }: LiveDemoRobotProps) {
  const [cursorPos, setCursorPos] = useState({ x: 200, y: 300 });
  const [clicking, setClicking] = useState(false);
  const [stepText, setStepText] = useState('');
  const [stepNum, setStepNum] = useState(1);
  const totalSteps = 6;
  // النداءان في مرجعين: يُنشئهما App من جديد مع كل رسم، فلو كانا من تبعيّات
  // الأثر لأعاد الانتقالُ الأول الجولةَ من أوّلها بلا نهاية، ونسختان تجريان معًا.
  const navigateRef = useRef(onNavigate);
  navigateRef.current = onNavigate;
  const stopRef = useRef(onStop);
  stopRef.current = onStop;

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const moveCursorTo = async (targetX: number, targetY: number, duration = 800) => {
    setCursorPos({ x: targetX, y: targetY });
    await sleep(duration);
  };

  const clickAt = async (targetX: number, targetY: number) => {
    await moveCursorTo(targetX, targetY, 600);
    setClicking(true);

    // محاكاة النقر الحقيقي على العنصر الموجود تحت الإحداثيات
    const elem = document.elementFromPoint(targetX, targetY);
    if (elem) {
      if (elem instanceof HTMLElement) {
        elem.focus?.();
        elem.click();
      }
    }

    await sleep(250);
    setClicking(false);
    await sleep(350);
  };

  const findElementCenter = (selector: string): { x: number; y: number } | null => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  };

  useEffect(() => {
    if (!isActive) return;
    // لكلّ تشغيلٍ علَمُه: الإيقاف يُسكت هذا التشغيل وحده.
    let alive = true;

    const runScript = async () => {
      // ── الخطوة 1: بدء الجولة والانتقال لشاشة التصاميم ──
      setStepNum(1);
      setStepText('مرحباً بك! جاري الانتقال إلى شاشة التصاميم والهويات...');
      await sleep(1000);
      if (!alive) return;

      navigateRef.current('designs');
      await sleep(1400);
      if (!alive) return;

      // ── الخطوة 2: النقر على زر الذكاء الاصطناعي ──
      setStepNum(2);
      setStepText('فتح مصمّم ديوان الذكي بالذكاء الاصطناعي (بدون كود)...');

      // زرّ الذكاء بسمته في المعرض. و`:contains` ليس في CSS فكان يرمي خطأً يوقف
      // الجولة؛ و«أيّ زرٍّ فيه أيقونة» كان يصيب أوّل زرٍّ في الصفحة.
      let aiBtnPos = findElementCenter('button[data-act="ai-recipe"]');
      // تراجع إلى إحداثيات زر الذكاء في شريط التصاميم إن لم يُعثر على محدد دقيق
      if (!aiBtnPos) {
        // فحص الأزرار التي تحوي auto_awesome
        const allBtns = Array.from(document.querySelectorAll('button'));
        const btn = allBtns.find(b => b.textContent?.includes('ذكاء') || b.innerHTML.includes('auto_awesome'));
        if (btn) {
          const r = btn.getBoundingClientRect();
          aiBtnPos = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }
      }

      if (aiBtnPos) {
        await clickAt(aiBtnPos.x, aiBtnPos.y);
      } else {
        // إحداثيات تقريبية لشريط الأدوات
        await clickAt(window.innerWidth - 320, 95);
      }
      await sleep(1200);
      if (!alive) return;

      // ── الخطوة 3: اختيار نموذج شهادة قرآن كريم ──
      setStepNum(3);
      setStepText('اختيار نموذج: شهادة حفظ القرآن الكريم (مع المصحف المذهب)...');
      
      const quranBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('قرآن') || b.textContent?.includes('مصحف'));
      if (quranBtn) {
        const r = quranBtn.getBoundingClientRect();
        await clickAt(r.left + r.width / 2, r.top + r.height / 2);
      } else {
        await clickAt(window.innerWidth / 2 - 120, window.innerHeight / 2 - 20);
      }
      await sleep(1200);
      if (!alive) return;

      // ── الخطوة 4: التوليد الفوري بدون إنترنت ──
      setStepNum(4);
      setStepText('الضغط على «⚡ توليد محلي فوري (بدون نت)» لإنشاء الطبقات...');

      const offlineBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('توليد محلي فوري'));
      if (offlineBtn) {
        const r = offlineBtn.getBoundingClientRect();
        await clickAt(r.left + r.width / 2, r.top + r.height / 2);
      } else {
        await clickAt(window.innerWidth / 2 + 100, window.innerHeight / 2 + 220);
      }
      await sleep(1500);
      if (!alive) return;

      // ── الخطوة 5: التصميم جاهز على اللوحة والتفاعل مع الطبقات ──
      setStepNum(5);
      setStepText('التصميم جاهز بالكامل! تحريك المؤشر وسحب اسم الطالب على اللوحة...');

      // حركة فوق اللوحة في منتصف الشاشة
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      await moveCursorTo(centerX, centerY - 60, 800);
      await sleep(400);
      await clickAt(centerX, centerY - 60); // اختيار الحقل
      await sleep(600);

      // محاكاة سحب طفيف
      await moveCursorTo(centerX + 40, centerY - 50, 600);
      await sleep(800);
      if (!alive) return;

      // ── الخطوة 6: التنقل في التطبيق والانتهاء ──
      setStepNum(6);
      setStepText('جولة سريعة: الانتقال لسجل المواطنين ثم شاشة الاستقبال...');
      navigateRef.current('citizens');
      await sleep(1600);
      if (!alive) return;

      navigateRef.current('service');
      await sleep(1200);

      setStepText('✨ اكتملت المحاكاة التفاعلية بنجاح! التطبيق مستقر وجاهز للعمل.');
      await sleep(2500);

      stopRef.current();
    };

    // خطأٌ في خطوةٍ لا يترك الغطاء معلّقًا فوق الشاشة.
    runScript().catch(() => alive && stopRef.current());

    return () => {
      alive = false;
    };
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[99999] overflow-hidden">
      {/* المؤشر الافتراضي المتحرك */}
      <div
        className="fixed transition-all duration-500 ease-out pointer-events-none"
        style={{
          left: `${cursorPos.x}px`,
          top: `${cursorPos.y}px`,
          transform: 'translate(-4px, -4px)'
        }}
      >
        {/* أيقونة الفأرة */}
        <div className="relative">
          <svg
            className={`w-7 h-7 drop-shadow-lg transition-transform ${clicking ? 'scale-75' : 'scale-100'}`}
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M3 3L10.5 21L13.5 13.5L21 10.5L3 3Z"
              fill="#ef4444"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>

          {/* موجة النقر */}
          {clicking && (
            <span className="absolute -top-3 -left-3 w-12 h-12 rounded-full border-4 border-red-500 bg-red-400/30 animate-ping pointer-events-none" />
          )}

          {/* فقاعة الشرح فوق المؤشر */}
          <div className="absolute right-6 -top-12 whitespace-nowrap bg-neutral-900/95 text-white text-[12px] font-bold px-3 py-1.5 rounded-xl shadow-2xl border border-red-500/50 flex items-center gap-1.5 backdrop-blur-md animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span>{stepText}</span>
          </div>
        </div>
      </div>

      {/* شريط التحكم العلوي العائم لإيقاف المحاكاة */}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 pointer-events-auto bg-surface-container-high/95 backdrop-blur-xl border-2 border-primary/60 px-5 py-2 rounded-2xl shadow-2xl flex items-center gap-4 text-on-surface text-[13px] font-bold z-[100000]">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
          <span>🤖 محاكاة حركة المستخدم التفاعلية [{stepNum}/{totalSteps}]</span>
        </div>
        <div className="h-4 w-px bg-outline-variant" />
        <button
          type="button"
          className="px-3 py-1 rounded-lg bg-error hover:bg-error/80 text-on-error font-bold text-[12px] transition-colors shadow-xs"
          onClick={onStop}
        >
          إيقاف المحاكاة والتحكم اليدوي
        </button>
      </div>
    </div>
  );
}
