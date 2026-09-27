/**
 * مكتبة الرسومات والأيقونات المتجهة المدمجة (Offline Vector Clipart & Illustrations)
 *
 * رسومات SVG نقية، خفيفة الوزن وعالية الدقة والوضوح (Vector)، تعمل دون اتصال:
 * 1. دينية وإسلامية: مصحف شريف (القرآن الكريم)، بسملة مخطوطة، زخرفة إسلامية أندلسية.
 * 2. شخصيات كارتونية ومدرسية: تلميذ متفوق، تلميذة متفوقة، قبعة وتخرج، نجمة مبتسمة، قلم كارتوني.
 * 3. تكريم وتفوق: كأس ذهبي، وسام التميز مع شريط، إكليل غار ملكي، شريط مذهب.
 * 4. وطنية ورسمية: نسر جمهورية العراق وشعار الدولة.
 */

export type ClipartItem = {
  id: string;
  name: string;
  category: 'دينية وإسلامية' | 'شخصيات وأطفال' | 'تكريم وشهادات' | 'وطنية ورسمية';
  svg: string;
  tags: string[];
};

export const BUILTIN_CLIPARTS: ClipartItem[] = [
  // 1. القرآن الكريم والمصحف الشريف
  {
    id: 'quran',
    name: 'القرآن الكريم (مصحف شريف)',
    category: 'دينية وإسلامية',
    tags: ['قران', 'قرآن', 'مصحف', 'اسلامي', 'دين', 'ايات', 'تلاوة'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="50%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
    <linearGradient id="page" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#fef3c7"/>
      <stop offset="100%" stop-color="#fffbeb"/>
    </linearGradient>
  </defs>
  <!-- حامل المصحف الخشبي (الرحلة) -->
  <path d="M20 78 L50 62 L80 78 L75 84 L50 68 L25 84 Z" fill="#78350f" stroke="#451a03" stroke-width="1.5"/>
  <path d="M22 62 L50 78 L78 62 L73 56 L50 72 L27 56 Z" fill="#92400e" opacity="0.9"/>
  <!-- غلاف المصحف الخارجي الأخضر والذهبي -->
  <path d="M12 48 Q 50 56 50 58 Q 50 56 88 48 L86 24 Q 50 32 50 34 Q 50 32 14 24 Z" fill="#065f46" stroke="url(#gold)" stroke-width="2"/>
  <!-- صفحات المصحف المفتوح (الجهة اليمنى واليسرى) -->
  <path d="M14 22 Q 32 28 50 24 L50 52 Q 32 56 12 46 Z" fill="url(#page)" stroke="#d97706" stroke-width="1"/>
  <path d="M86 22 Q 68 28 50 24 L50 52 Q 68 56 88 46 Z" fill="url(#page)" stroke="#d97706" stroke-width="1"/>
  <!-- خط المنتصف وطيّة المصحف -->
  <line x1="50" y1="24" x2="50" y2="52" stroke="#b45309" stroke-width="1.5"/>
  <!-- زخارف ونقوش مذهبة على الصفحات -->
  <rect x="20" y="28" width="24" height="18" fill="none" stroke="url(#gold)" stroke-width="0.8" rx="2"/>
  <rect x="56" y="28" width="24" height="18" fill="none" stroke="url(#gold)" stroke-width="0.8" rx="2"/>
  <line x1="24" y1="32" x2="40" y2="32" stroke="#92400e" stroke-width="0.7"/>
  <line x1="24" y1="36" x2="40" y2="36" stroke="#92400e" stroke-width="0.7"/>
  <line x1="24" y1="40" x2="36" y2="40" stroke="#92400e" stroke-width="0.7"/>
  <line x1="60" y1="32" x2="76" y2="32" stroke="#92400e" stroke-width="0.7"/>
  <line x1="60" y1="36" x2="76" y2="36" stroke="#92400e" stroke-width="0.7"/>
  <line x1="60" y1="40" x2="72" y2="40" stroke="#92400e" stroke-width="0.7"/>
  <!-- شمسية التذهيب والزخرفة في المنتصف -->
  <circle cx="50" cy="22" r="3" fill="url(#gold)"/>
  <polygon points="50,15 52,20 57,20 53,23 55,28 50,25 45,28 47,23 43,20 48,20" fill="url(#gold)"/>
</svg>`
  },

  // 2. البسملة الشريفة مخطوطة
  {
    id: 'bismillah',
    name: 'بسم الله الرحمن الرحيم',
    category: 'دينية وإسلامية',
    tags: ['بسملة', 'بسم_الله', 'خط', 'كاليغرافي', 'مخطوطة', 'افتتاحية'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40" width="120" height="40">
  <defs>
    <linearGradient id="goldCallig" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#b45309"/>
      <stop offset="50%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
  </defs>
  <text x="60" y="26" font-family="'Amiri', 'Traditional Arabic', serif" font-size="22" font-weight="bold" fill="url(#goldCallig)" text-anchor="middle" direction="rtl">
    ﷽
  </text>
  <line x1="15" y1="34" x2="105" y2="34" stroke="url(#goldCallig)" stroke-width="1.2" stroke-linecap="round"/>
  <circle cx="60" cy="34" r="2.5" fill="#f59e0b"/>
</svg>`
  },

  // 3. زخرفة إسلامية هندسية (نجمة ثمانية مذهبة)
  {
    id: 'islamic_ornament',
    name: 'زخرفة إسلامية مذهبة',
    category: 'دينية وإسلامية',
    tags: ['زخرفة', 'اسلامي', 'نقش', 'اطار', 'هندسي', 'ارابيسك'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <linearGradient id="goldStar" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="50%" stop-color="#fde047"/>
      <stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
  </defs>
  <!-- مربعان متقاطعان بزاوية 45 درجة (النجمة الثمانية) -->
  <rect x="25" y="25" width="50" height="50" fill="none" stroke="url(#goldStar)" stroke-width="3" rx="2"/>
  <rect x="25" y="25" width="50" height="50" fill="none" stroke="url(#goldStar)" stroke-width="3" rx="2" transform="rotate(45 50 50)"/>
  <circle cx="50" cy="50" r="18" fill="none" stroke="url(#goldStar)" stroke-width="2"/>
  <circle cx="50" cy="50" r="12" fill="url(#goldStar)" opacity="0.3"/>
  <circle cx="50" cy="50" r="6" fill="url(#goldStar)"/>
  <!-- رؤوس زخرفية محيطة -->
  <circle cx="50" cy="12" r="3" fill="url(#goldStar)"/>
  <circle cx="50" cy="88" r="3" fill="url(#goldStar)"/>
  <circle cx="12" cy="50" r="3" fill="url(#goldStar)"/>
  <circle cx="88" cy="50" r="3" fill="url(#goldStar)"/>
</svg>`
  },

  // 4. شخصية كارتونية - تلميذ متفوق سعيد
  {
    id: 'cartoon_boy',
    name: 'شخصية كارتونية - تلميذ متفوق',
    category: 'شخصيات وأطفال',
    tags: ['كارتون', 'تلميذ', 'طالب', 'ولد', 'طفل', 'مدرسة', 'شخصية'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <!-- الرأس والشعر -->
  <path d="M30 35 Q 50 15 70 35 Q 75 25 65 20 Q 50 12 35 20 Z" fill="#3b2614"/>
  <circle cx="50" cy="40" r="22" fill="#fed7aa"/>
  <!-- قبعة التخرج أو شعر أمامي -->
  <path d="M32 30 Q 50 22 68 30 Q 60 26 50 25 Q 40 26 32 30 Z" fill="#3b2614"/>
  <!-- العيون الكارتونية المبتسمة -->
  <ellipse cx="42" cy="38" rx="3.5" ry="5" fill="#1f2937"/>
  <circle cx="43.5" cy="36.5" r="1.5" fill="#ffffff"/>
  <ellipse cx="58" cy="38" rx="3.5" ry="5" fill="#1f2937"/>
  <circle cx="59.5" cy="36.5" r="1.5" fill="#ffffff"/>
  <!-- الخدود الوردية والابتسامة العريضة -->
  <circle cx="36" cy="44" r="3" fill="#fca5a5" opacity="0.7"/>
  <circle cx="64" cy="44" r="3" fill="#fca5a5" opacity="0.7"/>
  <path d="M42 46 Q 50 54 58 46" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round"/>
  <!-- قميص المدرسة الأنيق وربطة العنق -->
  <path d="M30 62 L 70 62 L 76 86 L 24 86 Z" fill="#2563eb" rx="4"/>
  <polygon points="50,62 44,70 50,78 56,70" fill="#dc2626"/>
  <polygon points="50,62 42,62 45,66 50,62" fill="#ffffff"/>
  <polygon points="50,62 58,62 55,66 50,62" fill="#ffffff"/>
  <!-- يد ترفع علامة الإعجاب أو كتاب -->
  <circle cx="22" cy="68" r="6" fill="#fed7aa"/>
  <circle cx="78" cy="68" r="6" fill="#fed7aa"/>
  <rect x="74" y="60" width="16" height="20" fill="#10b981" rx="2" transform="rotate(15 74 60)"/>
  <line x1="77" y1="65" x2="86" y2="67" stroke="#ffffff" stroke-width="1.5"/>
</svg>`
  },

  // 5. شخصية كارتونية - تلميذة متفوقة سعيدة
  {
    id: 'cartoon_girl',
    name: 'شخصية كارتونية - تلميذة متفوقة',
    category: 'شخصيات وأطفال',
    tags: ['كارتون', 'تلميذة', 'طالبة', 'بنت', 'طفلة', 'مدرسة', 'شخصية'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <!-- الشعر الطويل بالضفائر وفيونكات حمراء -->
  <circle cx="30" cy="50" r="10" fill="#78350f"/>
  <circle cx="70" cy="50" r="10" fill="#78350f"/>
  <circle cx="28" cy="46" r="4" fill="#ef4444"/>
  <circle cx="72" cy="46" r="4" fill="#ef4444"/>
  <path d="M28 35 Q 50 10 72 35 Q 76 22 50 16 Q 24 22 28 35 Z" fill="#78350f"/>
  <!-- الوجه -->
  <circle cx="50" cy="40" r="21" fill="#fed7aa"/>
  <path d="M32 30 Q 50 20 68 30 Q 50 25 32 30 Z" fill="#78350f"/>
  <!-- العيون والرموش والابتسامة -->
  <ellipse cx="42" cy="38" rx="3.5" ry="5" fill="#1f2937"/>
  <circle cx="43.5" cy="36.5" r="1.5" fill="#ffffff"/>
  <path d="M38 33 L 42 35" stroke="#1f2937" stroke-width="1.2"/>
  <ellipse cx="58" cy="38" rx="3.5" ry="5" fill="#1f2937"/>
  <circle cx="59.5" cy="36.5" r="1.5" fill="#ffffff"/>
  <path d="M62 33 L 58 35" stroke="#1f2937" stroke-width="1.2"/>
  <circle cx="36" cy="44" r="3.5" fill="#fca5a5" opacity="0.8"/>
  <circle cx="64" cy="44" r="3.5" fill="#fca5a5" opacity="0.8"/>
  <path d="M43 46 Q 50 53 57 46" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round"/>
  <!-- المريلة المدرسية الوردية/الحمراء -->
  <path d="M30 62 L 70 62 L 78 88 L 22 88 Z" fill="#ec4899" rx="4"/>
  <polygon points="50,62 44,70 50,78 56,70" fill="#ffffff"/>
  <!-- يد تمسك قلم ملوّن -->
  <circle cx="22" cy="68" r="5.5" fill="#fed7aa"/>
  <circle cx="78" cy="68" r="5.5" fill="#fed7aa"/>
  <polygon points="82,56 86,60 76,82 72,78" fill="#f59e0b"/>
  <polygon points="82,56 86,60 85,52" fill="#ef4444"/>
</svg>`
  },

  // 6. نجمة كارتونية مبتسمة للأطفال
  {
    id: 'cartoon_star',
    name: 'نجمة كارتونية مبتسمة',
    category: 'شخصيات وأطفال',
    tags: ['نجمة', 'كارتون', 'اطفال', 'امتياز', 'تفوق', 'شاطر'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <linearGradient id="starGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fde047"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
  </defs>
  <!-- جسم النجمة الذهبية اللامعة -->
  <polygon points="50,10 62,36 90,36 67,54 76,80 50,64 24,80 33,54 10,36 38,36" fill="url(#starGrad)" stroke="#d97706" stroke-width="2.5" stroke-linejoin="round"/>
  <!-- العيون الكارتونية المبهجة -->
  <circle cx="43" cy="44" r="4" fill="#1f2937"/>
  <circle cx="44.5" cy="42.5" r="1.5" fill="#ffffff"/>
  <circle cx="57" cy="44" r="4" fill="#1f2937"/>
  <circle cx="58.5" cy="42.5" r="1.5" fill="#ffffff"/>
  <!-- الخدود والابتسامة -->
  <ellipse cx="38" cy="50" rx="3.5" ry="2.5" fill="#f87171" opacity="0.8"/>
  <ellipse cx="62" cy="50" rx="3.5" ry="2.5" fill="#f87171" opacity="0.8"/>
  <path d="M44 52 Q 50 60 56 52" fill="none" stroke="#991b1b" stroke-width="2.5" stroke-linecap="round"/>
</svg>`
  },

  // 7. قلم كارتوني مبتسم
  {
    id: 'cartoon_pencil',
    name: 'قلم كارتوني مدرسي',
    category: 'شخصيات وأطفال',
    tags: ['قلم', 'كارتون', 'رسم', 'كتابة', 'مدرسة', 'تعليم'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <!-- رأس القلم الخشبي والرصاصي -->
  <polygon points="50,12 36,36 64,36" fill="#fed7aa"/>
  <polygon points="50,12 45,21 55,21" fill="#1f2937"/>
  <!-- جسم القلم الأصفر المضلع -->
  <rect x="36" y="36" width="9" height="42" fill="#f59e0b"/>
  <rect x="45" y="36" width="10" height="42" fill="#fbbf24"/>
  <rect x="55" y="36" width="9" height="42" fill="#d97706"/>
  <!-- حلقة معدنية وممحاة وردية -->
  <rect x="36" y="78" width="28" height="6" fill="#9ca3af"/>
  <rect x="36" y="84" width="28" height="8" fill="#f43f5e" rx="2"/>
  <!-- وجه القلم الكارتوني المبتسم -->
  <circle cx="45" cy="50" r="2.5" fill="#1f2937"/>
  <circle cx="55" cy="50" r="2.5" fill="#1f2937"/>
  <path d="M46 58 Q 50 64 54 58" fill="none" stroke="#1f2937" stroke-width="2" stroke-linecap="round"/>
  <circle cx="41" cy="56" r="2" fill="#fca5a5"/>
  <circle cx="59" cy="56" r="2" fill="#fca5a5"/>
</svg>`
  },

  // 8. كأس التفوق الذهبي اللامع
  {
    id: 'golden_trophy',
    name: 'كأس التفوق والبطولة الذهبي',
    category: 'تكريم وشهادات',
    tags: ['كاس', 'كأس', 'تفوق', 'بطولة', 'جائزة', 'مركز_اول', 'ذهب'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <linearGradient id="trophyGold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="50%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
  </defs>
  <!-- وعاء الكأس الكبير -->
  <path d="M30 20 L70 20 L66 50 Q 50 66 34 50 Z" fill="url(#trophyGold)" stroke="#78350f" stroke-width="1.5"/>
  <!-- مقابض الكأس الجانبية (يمين ويسار) -->
  <path d="M31 24 C 16 26 16 46 34 46" fill="none" stroke="url(#trophyGold)" stroke-width="4.5" stroke-linecap="round"/>
  <path d="M69 24 C 84 26 84 46 66 46" fill="none" stroke="url(#trophyGold)" stroke-width="4.5" stroke-linecap="round"/>
  <!-- ساق الكأس -->
  <path d="M46 58 L54 58 L56 72 L44 72 Z" fill="url(#trophyGold)"/>
  <!-- قاعدة الكأس الرخامية المربعة -->
  <rect x="32" y="72" width="36" height="8" fill="#92400e" rx="1"/>
  <rect x="28" y="80" width="44" height="10" fill="#1f2937" rx="2"/>
  <rect x="36" y="83" width="28" height="4" fill="url(#trophyGold)" rx="1"/>
  <!-- نجمة المركز الأول في قلب الكأس -->
  <polygon points="50,28 53,35 60,35 55,40 57,47 50,43 43,47 45,40 40,35 47,35" fill="#fef08a"/>
</svg>`
  },

  // 9. وسام التميز مع شريط ملكي
  {
    id: 'medal_ribbon',
    name: 'وسام التميز مع شريط أحمر وأزرق',
    category: 'تكريم وشهادات',
    tags: ['وسام', 'ميدالية', 'شريط', 'تكريم', 'امتياز', 'تقدير'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <linearGradient id="medalGold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="50%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
  </defs>
  <!-- شريط الميدالية المتقاطع (أحمر وذهبي وأزرق) -->
  <polygon points="36,15 44,52 30,52 24,15" fill="#dc2626"/>
  <polygon points="64,15 56,52 70,52 76,15" fill="#dc2626"/>
  <polygon points="30,15 36,15 42,52 36,52" fill="#2563eb"/>
  <polygon points="70,15 64,15 58,52 64,52" fill="#2563eb"/>
  <!-- ذيل الشريط المقطوع -->
  <polygon points="30,52 44,52 37,66" fill="#b91c1c"/>
  <polygon points="70,52 56,52 63,66" fill="#b91c1c"/>
  <!-- الميدالية الذهبية المستديرة -->
  <circle cx="50" cy="56" r="22" fill="url(#medalGold)" stroke="#78350f" stroke-width="2"/>
  <circle cx="50" cy="56" r="17" fill="none" stroke="#fef08a" stroke-width="1.5" stroke-dasharray="3 2"/>
  <!-- شعلة أو رقم 1 أو نجمة في الوسط -->
  <polygon points="50,44 53,52 61,52 55,57 57,65 50,60 43,65 45,57 39,52 47,52" fill="#ffffff"/>
</svg>`
  },

  // 10. إكليل الغار الذهبي الملكي
  {
    id: 'laurel_wreath',
    name: 'إكليل الغار الذهبي (رمز التكريم)',
    category: 'تكريم وشهادات',
    tags: ['غار', 'اكليل', 'تاج', 'شهادة', 'تكريم', 'ملك', 'شرف'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <linearGradient id="laurelGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fde047"/>
      <stop offset="60%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
  </defs>
  <!-- فرع الغار الأيمن -->
  <path d="M50 82 C 72 80 82 56 74 30" fill="none" stroke="url(#laurelGrad)" stroke-width="2"/>
  <!-- أوراق الغار اليمنى -->
  <ellipse cx="62" cy="74" rx="7" ry="3.5" fill="url(#laurelGrad)" transform="rotate(-30 62 74)"/>
  <ellipse cx="73" cy="62" rx="7" ry="3.5" fill="url(#laurelGrad)" transform="rotate(-50 73 62)"/>
  <ellipse cx="76" cy="46" rx="7" ry="3.5" fill="url(#laurelGrad)" transform="rotate(-70 76 46)"/>
  <ellipse cx="72" cy="32" rx="7" ry="3.5" fill="url(#laurelGrad)" transform="rotate(-90 72 32)"/>
  <ellipse cx="60" cy="24" rx="6" ry="3" fill="url(#laurelGrad)" transform="rotate(-110 60 24)"/>
  <!-- فرع الغار الأيسر -->
  <path d="M50 82 C 28 80 18 56 26 30" fill="none" stroke="url(#laurelGrad)" stroke-width="2"/>
  <!-- أوراق الغار اليسرى -->
  <ellipse cx="38" cy="74" rx="7" ry="3.5" fill="url(#laurelGrad)" transform="rotate(30 38 74)"/>
  <ellipse cx="27" cy="62" rx="7" ry="3.5" fill="url(#laurelGrad)" transform="rotate(50 27 62)"/>
  <ellipse cx="24" cy="46" rx="7" ry="3.5" fill="url(#laurelGrad)" transform="rotate(70 24 46)"/>
  <ellipse cx="28" cy="32" rx="7" ry="3.5" fill="url(#laurelGrad)" transform="rotate(90 28 32)"/>
  <ellipse cx="40" cy="24" rx="6" ry="3" fill="url(#laurelGrad)" transform="rotate(110 40 24)"/>
  <!-- عقدة الشريط بالأسفل -->
  <circle cx="50" cy="82" r="3.5" fill="#f59e0b"/>
  <path d="M48 83 Q 44 92 38 94" fill="none" stroke="#f59e0b" stroke-width="2"/>
  <path d="M52 83 Q 56 92 62 94" fill="none" stroke="#f59e0b" stroke-width="2"/>
</svg>`
  },

  // 11. شعار جمهورية العراق (النسر العراقي المذهب)
  {
    id: 'iraq_emblem',
    name: 'شعار جمهورية العراق (النسر)',
    category: 'وطنية ورسمية',
    tags: ['عراق', 'نسر', 'شعار_العراق', 'جمهورية_العراق', 'رسمي', 'وزارة'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <linearGradient id="eagleGold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="50%" stop-color="#d97706"/>
      <stop offset="100%" stop-color="#78350f"/>
    </linearGradient>
  </defs>
  <!-- رأس النسر والمنقار الملتفت لليمين -->
  <path d="M46 16 Q 52 10 58 14 Q 63 15 65 20 L 59 22 Q 54 24 46 22 Z" fill="url(#eagleGold)"/>
  <!-- أجنحة النسر الممتدة -->
  <path d="M48 24 C 30 18 16 34 14 54 C 22 52 32 50 40 48 C 30 56 22 66 20 74 C 30 68 40 60 44 54 Z" fill="url(#eagleGold)"/>
  <path d="M52 24 C 70 18 84 34 86 54 C 78 52 68 50 60 48 C 70 56 78 66 80 74 C 70 68 60 60 56 54 Z" fill="url(#eagleGold)"/>
  <!-- درع علم العراق في قلب النسر -->
  <path d="M42 34 L 58 34 L 56 58 Q 50 66 42 58 Z" fill="#ffffff" stroke="#78350f" stroke-width="1.5"/>
  <!-- خطوط العلم العراقي (أحمر، أبيض، أسود) -->
  <path d="M42 34 L 58 34 L 57.5 42 L 42.5 42 Z" fill="#dc2626"/>
  <path d="M42.5 42 L 57.5 42 L 57 50 L 43 50 Z" fill="#ffffff"/>
  <path d="M43 50 L 57 50 L 56 58 Q 50 66 42 58 Z" fill="#111827"/>
  <!-- الله أكبر باللون الأخضر في قلب الشريط الأبيض -->
  <text x="50" y="48" font-size="5" font-weight="bold" fill="#047857" text-anchor="middle" direction="rtl">الله أكبر</text>
  <!-- مخالب النسر والقاعدة -->
  <path d="M38 74 L 62 74 L 60 80 L 40 80 Z" fill="url(#eagleGold)"/>
</svg>`
  },

  // 12. قبعة التخرج والوثيقة
  {
    id: 'graduation_cap',
    name: 'قبعة تخرج وشهادة ملفوفة',
    category: 'تكريم وشهادات',
    tags: ['تخرج', 'قبعة', 'شهادة', 'جامعة', 'معهد', 'مدرسة'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <linearGradient id="capGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1f2937"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <!-- مسطح قبعة التخرج الماسي -->
  <polygon points="50,22 84,36 50,50 16,36" fill="url(#capGrad)" stroke="#374151" stroke-width="1.5"/>
  <!-- قبعة الرأس السفلية -->
  <path d="M32 44 L 32 56 Q 50 66 68 56 L 68 44 Q 50 52 32 44 Z" fill="#111827"/>
  <!-- الشرابة الذهبية المتدلية -->
  <circle cx="50" cy="36" r="3" fill="#f59e0b"/>
  <path d="M50 36 C 66 38 72 48 74 60" fill="none" stroke="#f59e0b" stroke-width="2"/>
  <polygon points="71,60 77,60 74,68" fill="#d97706"/>
  <!-- وثيقة التخرج الملفوفة بالأسفل بشريط أحمر -->
  <rect x="25" y="70" width="50" height="12" fill="#fffbeb" stroke="#d97706" rx="2" transform="rotate(-6 50 76)"/>
  <rect x="46" y="69" width="8" height="14" fill="#dc2626" rx="1" transform="rotate(-6 50 76)"/>
</svg>`
  }
];

export function normalizeClipartKey(s: string): string {
  return s.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

export const CLIPART_MAP = new Map<string, ClipartItem>();
for (const item of BUILTIN_CLIPARTS) {
  CLIPART_MAP.set(normalizeClipartKey(item.id), item);
  CLIPART_MAP.set(item.id.toLowerCase(), item);
  for (const tag of item.tags) {
    CLIPART_MAP.set(normalizeClipartKey(tag), item);
    CLIPART_MAP.set(tag.toLowerCase(), item);
  }
}

/** تحويل كود SVG إلى Data URL صالح للعرض كصورة في أي متصفح */
export function svgToDataUrl(svg: string): string {
  const cleanSvg = svg.trim();
  // التأكد من وجود xmlns
  const withXmlns = cleanSvg.includes('xmlns=')
    ? cleanSvg
    : cleanSvg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  return `data:image/svg+xml;utf8,${encodeURIComponent(withXmlns)}`;
}

/** العثور على رسمة مناسبة بالاسم أو الوسم أو الكلمة الدلالية */
export function findClipart(query: string): ClipartItem | null {
  const raw = query.trim().toLowerCase();
  const q = normalizeClipartKey(query);
  if (CLIPART_MAP.has(q)) return CLIPART_MAP.get(q)!;
  if (CLIPART_MAP.has(raw)) return CLIPART_MAP.get(raw)!;

  for (const item of BUILTIN_CLIPARTS) {
    if (
      normalizeClipartKey(item.id) === q ||
      item.id.toLowerCase() === raw ||
      item.name.includes(query)
    ) {
      return item;
    }
    if (
      item.tags.some(
        (t) => normalizeClipartKey(t).includes(q) || q.includes(normalizeClipartKey(t))
      )
    ) {
      return item;
    }
  }
  return null;
}
