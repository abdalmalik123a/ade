/* مُولَّد آليًا من stitch_/_2/code.html — لا تُحرّره يدويًا.
   أعِد التوليد بـ: node tools/html-to-tsx.mjs */
/* eslint-disable */

export default function CitizensRaw() {
  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full">
      <div className="flex flex-col w-full">
        {/* Status Ribbon & Macro Statistics */}
        <div className="px-space-lg pt-space-md pb-space-lg">
          <div
            className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md pb-space-md"
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-space-xs text-secondary font-label-md text-label-md">
                <span className="material-symbols-outlined text-[18px]">verified_user</span>
                <span>منظومة التوثيق الرقمي والملفات المركزية المعتمدة</span>
                <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                <span className="text-on-surface-variant">تحديث حي 09:42 ص</span>
              </div>
              <div className="font-headline-xl text-headline-xl text-on-surface tracking-tight mt-0.5">سجل المواطنين والمستمسكات الرسمية (Vault 3.0)</div>
            </div>
            {/* Quick Action Commands */}
            <div className="flex items-center gap-space-sm flex-wrap">
              <button
                className="flex items-center gap-space-xs px-space-md h-11 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-all font-label-lg text-label-lg shadow-sm"
                type="button"
              >
                <span className="material-symbols-outlined text-[20px] text-secondary">document_scanner</span>
                <span>فحص الماسح الضوئي (WIA)</span>
                <span
                  className="px-1.5 py-0.2 rounded-full bg-secondary text-on-secondary font-code-sm text-code-sm"
                >
                  متصل
                </span>
              </button>
              <button
                className="flex items-center gap-space-xs px-space-lg h-11 rounded-lg bg-primary-container text-on-primary hover:bg-surface-container-highest hover:text-on-surface transition-all font-label-lg text-label-lg shadow-md"
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">person_add</span>
                <span className="font-semibold">+ إضافة ملف مواطن مع سحب المستمسك</span>
                <span className="font-code-sm text-code-sm opacity-60">F2</span>
              </button>
            </div>
          </div>
          {/* 4 KPI Banners with Inset Progressions & Rich Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md">
            {/* KPI 1 */}
            <div
              className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col justify-between relative overflow-hidden"
            >
              <div
                className="absolute -left-6 -top-6 w-24 h-24 bg-surface-container-high/40 rounded-full blur-xl pointer-events-none"
              />
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">الملفات المسجلة النشطة</span>
                  <span className="font-headline-xl text-headline-xl text-on-surface font-bold mt-1">1,840</span>
                </div>
                <div
                  className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-secondary"
                >
                  <span className="material-symbols-outlined text-[22px]">folder_shared</span>
                </div>
              </div>
              <div className="mt-space-sm pt-space-xs flex items-center justify-between">
                <span className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-secondary text-[16px]">check_circle</span>
                  موثقة بالرقم الوطني
                </span>
                <span
                  className="font-label-sm text-label-sm text-secondary font-bold bg-surface-container-highest px-2 py-0.5 rounded"
                >
                  100% مدققة
                </span>
              </div>
            </div>
            {/* KPI 2 */}
            <div
              className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col justify-between relative overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">المستمسكات المقروءة بالماسح</span>
                  <span className="font-headline-xl text-headline-xl text-on-surface font-bold mt-1">5,410</span>
                </div>
                <div
                  className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-secondary"
                >
                  <span className="material-symbols-outlined text-[22px]">document_scanner</span>
                </div>
              </div>
              <div className="mt-space-sm pt-space-xs flex items-center justify-between">
                <span className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-secondary text-[16px]">analytics</span>
                  دقة استخراج النصوص OCR
                </span>
                <span className="font-label-sm text-label-sm text-on-surface font-bold">99.4%</span>
              </div>
            </div>
            {/* KPI 3 */}
            <div
              className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col justify-between relative overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">الإنجاز التلقائي للشهر</span>
                  <div className="flex items-baseline gap-space-xs mt-1">
                    <span className="font-headline-xl text-headline-xl text-on-surface font-bold">782</span>
                    <span className="font-label-md text-label-md text-on-surface-variant">معاملة موثقة</span>
                  </div>
                </div>
                {/* Mini SVG Sparkline */}
                <svg
                  className="w-20 h-9 text-secondary overflow-visible"
                  fill="none"
                  viewBox="0 0 100 40"
                >
                  <path
                    d="M0 32 Q 25 36 35 24 T 65 14 T 85 8 L 100 4"
                    fill="none"
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-width="2.5"
                  />
                  <path
                    d="M0 32 Q 25 36 35 24 T 65 14 T 85 8 L 100 4 L 100 40 L 0 40 Z"
                    fill="currentColor"
                    fill-opacity="0.08"
                  />
                </svg>
              </div>
              <div className="mt-space-sm pt-space-xs flex items-center justify-between">
                <span className="font-body-sm text-body-sm text-on-surface-variant">معدل التسريع الإداري</span>
                <span className="font-label-sm text-label-sm text-secondary font-bold">+28% أسرع من الشهر الفائت</span>
              </div>
            </div>
            {/* KPI 4 */}
            <div
              className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col justify-between relative overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">جاهزية التكرار السريع</span>
                  <span className="font-headline-xl text-headline-xl text-on-surface font-bold mt-1">94%</span>
                </div>
                <div
                  className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-secondary"
                >
                  <span className="material-symbols-outlined text-[22px]">bolt</span>
                </div>
              </div>
              <div className="mt-space-sm pt-space-xs flex items-center justify-between">
                <span className="font-body-sm text-body-sm text-on-surface-variant">توليد الكتب بضغطة واحدة</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">متوسط 2.1 ثانية/كتاب</span>
              </div>
            </div>
          </div>
        </div>
        {/* Primary Workspace: Split 2-Column High-Density Layout */}
        <div
          className="px-space-lg pb-space-xl grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start"
        >
          {/* LEFT COLUMN: Citizen Registry Directory & Quick Finder (xl:col-span-4) */}
          <div className="xl:col-span-4 flex flex-col gap-space-md">
            {/* Directory Search & Sector Filter */}
            <div
              className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-secondary text-[20px]">badge</span>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-bold">دليل المواطنين والموظفين</span>
                </div>
                <span
                  className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface font-mono"
                >
                  1,840 ملف
                </span>
              </div>
              {/* Filter Input */}
              <div className="relative w-full mt-1">
                <span
                  className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]"
                >
                  search
                </span>
                <input
                  className="w-full h-10 pr-9 pl-4 rounded-lg bg-surface-container-low text-on-surface text-body-sm font-body-sm focus:outline-none focus:bg-surface-container-lowest shadow-inner transition-colors"
                  placeholder="البحث بالاسم الثلاثي، الرقم الوطني، أو المحلة..."
                  type="text"
                  defaultValue="سمير صالح مهدي"
                />
              </div>
              {/* Category Tags Bar */}
              <div className="flex items-center gap-1 overflow-x-auto py-1 no-scrollbar">
                <button
                  className="px-space-sm py-1 rounded text-label-sm font-label-sm bg-primary-container text-on-primary font-bold whitespace-nowrap"
                  type="button"
                >
                  الكل (1,840)
                </button>
                <button
                  className="px-space-sm py-1 rounded text-label-sm font-label-sm bg-surface-container-high text-on-surface hover:bg-surface-container-highest whitespace-nowrap transition-colors"
                  type="button"
                >
                  تربية وتعليم (512)
                </button>
                <button
                  className="px-space-sm py-1 rounded text-label-sm font-label-sm bg-surface-container-high text-on-surface hover:bg-surface-container-highest whitespace-nowrap transition-colors"
                  type="button"
                >
                  متقاعدين (380)
                </button>
                <button
                  className="px-space-sm py-1 rounded text-label-sm font-label-sm bg-surface-container-high text-on-surface hover:bg-surface-container-highest whitespace-nowrap transition-colors"
                  type="button"
                >
                  عقود وأجراء (290)
                </button>
                <button
                  className="px-space-sm py-1 rounded text-label-sm font-label-sm bg-surface-container-high text-on-surface hover:bg-surface-container-highest whitespace-nowrap transition-colors"
                  type="button"
                >
                  عقارات وسكن (658)
                </button>
              </div>
            </div>
            {/* Quick Directory List Cards */}
            <div className="flex flex-col gap-space-xs max-h-[820px] overflow-y-auto pr-0.5">
              {/* Active Selected Citizen Card */}
              <div
                className="bg-surface-container-highest/60 rounded-xl p-space-md shadow-sm relative overflow-hidden cursor-pointer transition-all"
              >
                <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-secondary" />
                <div className="flex items-start justify-between gap-space-sm">
                  <div className="flex items-center gap-space-sm min-w-0">
                    <div
                      className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-surface-container-high shadow-sm"
                    >
                      <img
                        className="w-full h-full object-cover"
                        data-alt="Official formal studio portrait photo of an Iraqi middle-aged male civil servant with trimmed mustache wearing a dark navy suit and white shirt against a neutral administrative light gray studio background with sharp studio lighting."
                        data-placeholder="image"
                      />
                      <span
                        className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-secondary ring-2 ring-surface-container-lowest"
                      />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-space-xs">
                        <span className="font-headline-sm text-headline-sm text-on-surface font-bold truncate">سمير صالح مهدي جبر</span>
                        <span className="material-symbols-outlined text-secondary text-[16px]" title="ملف مدقق ورسمي">verified</span>
                      </div>
                      <span className="font-label-sm text-label-sm text-on-surface-variant truncate">معلم جامعي أقدم - تربية بغداد الرصافة الأولى</span>
                      <span className="font-code-sm text-code-sm text-secondary font-mono tracking-wider mt-0.5">ID: 198420918230</span>
                    </div>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded bg-secondary text-on-secondary font-label-sm text-label-sm shrink-0"
                  >
                    النشط حالياً
                  </span>
                </div>
                {/* Card Bottom Utility */}
                <div
                  className="mt-space-sm pt-space-xs flex items-center justify-between bg-surface-container-lowest/80 rounded-lg p-space-xs px-space-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">4 مستمسكات ممسوحة</span>
                    <span className="w-1 h-1 rounded-full bg-outline-variant" />
                    <span className="font-label-sm text-label-sm text-on-surface-variant font-mono">آخر معاملة: أمس</span>
                  </div>
                  <button
                    className="flex items-center gap-1 px-2 py-1 rounded bg-surface-container text-secondary hover:bg-secondary hover:text-on-secondary font-label-sm text-label-sm font-bold transition-colors"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[14px]">post_add</span>
                    <span>إنشاء كتاب فوري</span>
                  </button>
                </div>
              </div>
              {/* Citizen Card 2 */}
              <div
                className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm hover:bg-surface-container-low transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-space-sm">
                  <div className="flex items-center gap-space-sm min-w-0">
                    <div
                      className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-surface-container-high shadow-sm"
                    >
                      <img
                        className="w-full h-full object-cover"
                        data-alt="Official biometric identification portrait photograph of an Iraqi senior retired citizen with gray hair wearing traditional clean modern attire, captured in front of an institutional solid light blue photography background."
                        data-placeholder="image"
                      />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">حسين عبد الأمير كاظم الربيعي</span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant truncate">متقاعد مدني - وزارة النقل والمواصلات</span>
                      <span
                        className="font-code-sm text-code-sm text-on-surface-variant font-mono tracking-wider mt-0.5"
                      >
                        ID: 196144810291
                      </span>
                    </div>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm shrink-0"
                  >
                    متقاعد
                  </span>
                </div>
                <div className="mt-space-sm pt-space-xs flex items-center justify-between">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">3 مستمسكات • معاملة تقاعد</span>
                  <button
                    className="flex items-center gap-1 px-2 py-1 rounded hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold transition-colors"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[14px]">history_edu</span>
                    <span>فتح الملف</span>
                  </button>
                </div>
              </div>
              {/* Citizen Card 3 */}
              <div
                className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm hover:bg-surface-container-low transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-space-sm">
                  <div className="flex items-center gap-space-sm min-w-0">
                    <div
                      className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-surface-container-high shadow-sm"
                    >
                      <img
                        className="w-full h-full object-cover"
                        data-alt="Formal identification studio portrait of an Iraqi professional woman in civil service wearing headscarf hijab and an elegant dark gray blazer with passport-style bright neutral background."
                        data-placeholder="image"
                      />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">زينب طارق جاسم الحمداني</span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant truncate">مهندسة معمارية - دائرة الإسكان والتعمير</span>
                      <span
                        className="font-code-sm text-code-sm text-on-surface-variant font-mono tracking-wider mt-0.5"
                      >
                        ID: 199173820491
                      </span>
                    </div>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm shrink-0"
                  >
                    عقود وزارية
                  </span>
                </div>
                <div className="mt-space-sm pt-space-xs flex items-center justify-between">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">5 مستمسكات • ترقية وظيفية</span>
                  <button
                    className="flex items-center gap-1 px-2 py-1 rounded hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold transition-colors"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[14px]">history_edu</span>
                    <span>فتح الملف</span>
                  </button>
                </div>
              </div>
              {/* Citizen Card 4 */}
              <div
                className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm hover:bg-surface-container-low transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-space-sm">
                  <div className="flex items-center gap-space-sm min-w-0">
                    <div
                      className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-surface-container-high shadow-sm"
                    >
                      <img
                        className="w-full h-full object-cover"
                        data-alt="Official administrative headshot portrait of a young Iraqi male citizen wearing a crisp white collared shirt with formal pose against a neutral clean wall background."
                        data-placeholder="image"
                      />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">مقتدى كريم فيصل الدليمي</span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant truncate">كاسب / صاحب عقار - بلدية الكرخ</span>
                      <span
                        className="font-code-sm text-code-sm text-on-surface-variant font-mono tracking-wider mt-0.5"
                      >
                        ID: 199855219012
                      </span>
                    </div>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm shrink-0"
                  >
                    عقارات
                  </span>
                </div>
                <div className="mt-space-sm pt-space-xs flex items-center justify-between">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">2 مستمسكات • سند وتأييد</span>
                  <button
                    className="flex items-center gap-1 px-2 py-1 rounded hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold transition-colors"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[14px]">history_edu</span>
                    <span>فتح الملف</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          {/* RIGHT COLUMN: Active Citizen Dossier, Vault, and Ledger (xl:col-span-8) */}
          <div className="xl:col-span-8 flex flex-col gap-space-lg">
            {/* Section A: Primary Citizen Identification & Quick Injector Card */}
            <div
              className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md relative overflow-hidden"
            >
              {/* Header Banner with Status & Inject Button */}
              <div
                className="flex flex-col md:flex-row md:items-center justify-between gap-space-md bg-surface-container-low p-space-md rounded-lg"
              >
                <div className="flex items-center gap-space-md">
                  <div
                    className="relative w-16 h-16 rounded-lg overflow-hidden bg-surface-container-high shadow-md shrink-0"
                  >
                    <img
                      className="w-full h-full object-cover"
                      data-alt="Close up high-resolution official portrait photography of Samir Saleh Mahdi, an Iraqi government teacher wearing a dark charcoal suit jacket with silver lapel pin against an official studio gray backcloth."
                      data-placeholder="image"
                    />
                    <div
                      className="absolute bottom-0 inset-x-0 bg-primary-container text-on-primary text-center text-[10px] font-bold py-0.5"
                    >
                      رسمي 4×6
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-space-xs flex-wrap">
                      <span className="font-headline-md text-headline-md text-on-surface font-bold">سمير صالح مهدي جبر العماري</span>
                      <span
                        className="px-2 py-0.5 rounded-full bg-surface-container-highest text-secondary font-label-sm text-label-sm font-bold flex items-center gap-1"
                      >
                        <span className="w-2 h-2 rounded-full bg-secondary" />
                        موثق ومعتمد رسمياً
                      </span>
                    </div>
                    <div
                      className="flex items-center gap-space-sm text-on-surface-variant font-body-sm text-body-sm mt-0.5"
                    >
                      <span>تاريخ الفتح الأولي: 14 شباط 2021</span>
                      <span>•</span>
                      <span>رمز الموظف: EDU-BG-88410</span>
                    </div>
                  </div>
                </div>
                {/* Main Productivity CTA */}
                <div className="flex items-center gap-space-xs shrink-0">
                  <button
                    className="flex items-center gap-space-xs px-space-lg h-11 rounded-lg bg-secondary text-on-secondary hover:opacity-95 transition-all font-label-lg text-label-lg shadow-md"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[20px]">output</span>
                    <span className="font-bold">إدراج في محرر الكتب الآن</span>
                    <span className="px-2 py-0.5 rounded bg-surface-container-lowest/20 font-code-sm text-code-sm">Ctrl + Enter</span>
                  </button>
                  <button
                    className="w-11 h-11 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest flex items-center justify-center transition-colors shadow-sm"
                    title="تعديل بيانات المواطن"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[20px]">edit</span>
                  </button>
                </div>
              </div>
              {/* Structured Metadata Data Grid (3 Columns) */}
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-space-md pt-space-xs">
                <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col">
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">الرقم الوطني الموحد</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-body-lg text-body-lg text-on-surface font-mono font-bold">198420918230</span>
                    <button
                      className="text-secondary hover:text-on-surface transition-colors"
                      title="نسخ"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[16px]">content_copy</span>
                    </button>
                  </div>
                </div>
                <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col">
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">العنوان الوظيفي والدرجة</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-body-md text-body-md text-on-surface font-semibold truncate">معلم جامعي أقدم / الدرجة الثالثة</span>
                  </div>
                </div>
                <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col">
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">دائرة الانتساب الرسمية</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-body-md text-body-md text-on-surface font-semibold truncate">مديرية تربية بغداد الرصافة 1</span>
                  </div>
                </div>
                <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col">
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">تاريخ ومحل الولادة</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-body-md text-body-md text-on-surface font-semibold">12/08/1984 - بغداد</span>
                  </div>
                </div>
                <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col">
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">رقم بطاقة السكن والمكتب</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-body-md text-body-md text-on-surface font-mono font-semibold">R-491028 (مكتب الكرادة)</span>
                  </div>
                </div>
                <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col">
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">المحلة والزقاق والدار</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-body-md text-body-md text-on-surface font-semibold">محلة 903، زقاق 14، دار 8/أ</span>
                  </div>
                </div>
                <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col">
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">أقرب نقطة دالة</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-body-md text-body-md text-on-surface font-semibold truncate">قرب ساحة الواثق - الكرادة خارج</span>
                  </div>
                </div>
                <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col">
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">رقم هاتف الاتصال المعتمد</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-body-md text-body-md text-on-surface font-mono font-semibold" dir="ltr">+964 770 184 9201</span>
                  </div>
                </div>
              </div>
            </div>
            {/* Section B: Digital Document Vault (خزنة المستمسكات الرسمية الممسوحة ضوئياً) */}
            <div
              className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md"
            >
              {/* Vault Header & Tools */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
                <div className="flex items-center gap-space-sm">
                  <div
                    className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-secondary"
                  >
                    <span className="material-symbols-outlined text-[24px]">lock_clock</span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-space-xs">
                      <span className="font-headline-md text-headline-md text-on-surface font-bold">خزنة المستمسكات الرسمية الممسوحة ضوئياً</span>
                      <span
                        className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-code-sm text-code-sm"
                      >
                        4 وثائق مأرشفة
                      </span>
                    </div>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">مستندات مشفرة ومطابقة للأصل عبر تقنية المسح فائق الدقة 600 DPI</span>
                  </div>
                </div>
                {/* Scanner Direct Triggers */}
                <div className="flex items-center gap-space-xs">
                  <button
                    className="flex items-center gap-space-xs px-space-md h-10 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors font-label-md text-label-md"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">photo_library</span>
                    <span>تصدير الكل ZIP</span>
                  </button>
                  <button
                    className="flex items-center gap-space-xs px-space-md h-10 rounded-lg bg-primary-container text-on-primary hover:bg-surface-container-highest hover:text-on-surface transition-all font-label-md text-label-md font-semibold"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">scanner</span>
                    <span>مسح ضوئي فوري (Scanner)</span>
                  </button>
                </div>
              </div>
              {/* 4 Document Vault Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md pt-space-xs">
                {/* Document 1: البطاقة الوطنية الموحدة */}
                <div
                  className="bg-surface-container-low rounded-xl p-space-sm flex flex-col justify-between group shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex flex-col gap-space-xs">
                    <div
                      className="relative w-full h-36 rounded-lg overflow-hidden bg-surface-container-lowest flex items-center justify-center"
                    >
                      <img
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        data-alt="High quality realistic scan of an official Iraqi National Unified Identification Smart Card showing front face with microprint security guilloche pattern watermarks eagle crest and bilingual Arabic Kurdish typography."
                        data-placeholder="image"
                      />
                      <span
                        className="absolute top-2 right-2 px-2 py-0.5 rounded bg-primary-container/85 text-on-primary font-label-sm text-label-sm font-bold backdrop-blur-sm"
                      >
                        الوجه والظهر
                      </span>
                      <span
                        className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-surface-container-lowest/90 text-secondary font-code-sm text-code-sm font-bold"
                      >
                        600 DPI
                      </span>
                    </div>
                    <div className="flex flex-col mt-1 px-1">
                      <span className="font-label-lg text-label-lg text-on-surface font-bold truncate">البطاقة الوطنية الموحدة</span>
                      <div
                        className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm"
                      >
                        <span>تم الفحص: 10/01/2024</span>
                        <span className="text-secondary font-semibold">OCR 99.8%</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1 mt-space-sm pt-space-xs">
                    <button
                      className="h-8 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface flex items-center justify-center transition-colors"
                      title="استخراج النصوص OCR"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[16px]">raw_on</span>
                    </button>
                    <button
                      className="h-8 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface flex items-center justify-center transition-colors"
                      title="طباعة فورية ملونة"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[16px]">print</span>
                    </button>
                    <button
                      className="h-8 rounded bg-surface-container text-secondary hover:bg-secondary hover:text-on-secondary flex items-center justify-center transition-colors"
                      title="معاينة بكامل الشاشة"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[16px]">visibility</span>
                    </button>
                  </div>
                </div>
                {/* Document 2: بطاقة السكن الرسمية */}
                <div
                  className="bg-surface-container-low rounded-xl p-space-sm flex flex-col justify-between group shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex flex-col gap-space-xs">
                    <div
                      className="relative w-full h-36 rounded-lg overflow-hidden bg-surface-container-lowest flex items-center justify-center"
                    >
                      <img
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        data-alt="Official scanned document preview of Iraqi Residence Card Certificate with security stamp ink seal government Ministry of Interior administrative crest and serialized reference number."
                        data-placeholder="image"
                      />
                      <span
                        className="absolute top-2 right-2 px-2 py-0.5 rounded bg-surface-container-highest text-on-surface font-label-sm text-label-sm font-bold backdrop-blur-sm"
                      >
                        مصدق مختارياً
                      </span>
                      <span
                        className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-surface-container-lowest/90 text-secondary font-code-sm text-code-sm font-bold"
                      >
                        PDF / A
                      </span>
                    </div>
                    <div className="flex flex-col mt-1 px-1">
                      <span className="font-label-lg text-label-lg text-on-surface font-bold truncate">بطاقة السكن الرسمية</span>
                      <div
                        className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm"
                      >
                        <span>تم الفحص: 02/03/2024</span>
                        <span className="text-secondary font-semibold">OCR 98.9%</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1 mt-space-sm pt-space-xs">
                    <button
                      className="h-8 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface flex items-center justify-center transition-colors"
                      title="استخراج النصوص OCR"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[16px]">raw_on</span>
                    </button>
                    <button
                      className="h-8 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface flex items-center justify-center transition-colors"
                      title="طباعة فورية ملونة"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[16px]">print</span>
                    </button>
                    <button
                      className="h-8 rounded bg-surface-container text-secondary hover:bg-secondary hover:text-on-secondary flex items-center justify-center transition-colors"
                      title="معاينة بكامل الشاشة"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[16px]">visibility</span>
                    </button>
                  </div>
                </div>
                {/* Document 3: أمر التعيين والمباشرة الوزاري */}
                <div
                  className="bg-surface-container-low rounded-xl p-space-sm flex flex-col justify-between group shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex flex-col gap-space-xs">
                    <div
                      className="relative w-full h-36 rounded-lg overflow-hidden bg-surface-container-lowest flex items-center justify-center"
                    >
                      <img
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        data-alt="High contrast administrative scanned A4 ministerial appointment decree order on official Iraqi governmental letterhead with red verification wax seal ribbon and ministerial signatures."
                        data-placeholder="image"
                      />
                      <span
                        className="absolute top-2 right-2 px-2 py-0.5 rounded bg-primary-container/85 text-on-primary font-label-sm text-label-sm font-bold backdrop-blur-sm"
                      >
                        أمر وزاري
                      </span>
                      <span
                        className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-surface-container-lowest/90 text-secondary font-code-sm text-code-sm font-bold"
                      >
                        صادر 1840
                      </span>
                    </div>
                    <div className="flex flex-col mt-1 px-1">
                      <span className="font-label-lg text-label-lg text-on-surface font-bold truncate">أمر التعيين والمباشرة</span>
                      <div
                        className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm"
                      >
                        <span>تم الفحص: 14/02/2021</span>
                        <span className="text-secondary font-semibold">OCR 99.4%</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1 mt-space-sm pt-space-xs">
                    <button
                      className="h-8 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface flex items-center justify-center transition-colors"
                      title="استخراج النصوص OCR"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[16px]">raw_on</span>
                    </button>
                    <button
                      className="h-8 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface flex items-center justify-center transition-colors"
                      title="طباعة فورية ملونة"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[16px]">print</span>
                    </button>
                    <button
                      className="h-8 rounded bg-surface-container text-secondary hover:bg-secondary hover:text-on-secondary flex items-center justify-center transition-colors"
                      title="معاينة بكامل الشاشة"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[16px]">visibility</span>
                    </button>
                  </div>
                </div>
                {/* Document 4: الصورة الشخصية المفرغة 4×6 */}
                <div
                  className="bg-surface-container-low rounded-xl p-space-sm flex flex-col justify-between group shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex flex-col gap-space-xs">
                    <div
                      className="relative w-full h-36 rounded-lg overflow-hidden bg-surface-container-lowest flex items-center justify-center p-2"
                    >
                      {/* Alpha grid background effect */}
                      <div
                        className="w-full h-full rounded flex items-center justify-center bg-[radial-gradient(#d3e4fe_1px,transparent_1px)] [background-size:8px_8px]"
                      >
                        <img
                          className="h-full object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300"
                          data-alt="Cutout biometric passport photo of Samir Saleh Mahdi isolated transparent background ready for administrative stamps and official badges."
                          data-placeholder="image"
                        />
                      </div>
                      <span
                        className="absolute top-2 right-2 px-2 py-0.5 rounded bg-surface-container-highest text-secondary font-label-sm text-label-sm font-bold backdrop-blur-sm"
                      >
                        مفرغة PNG
                      </span>
                      <span
                        className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-surface-container-lowest/90 text-on-surface font-code-sm text-code-sm font-bold"
                      >
                        4×6 سم
                      </span>
                    </div>
                    <div className="flex flex-col mt-1 px-1">
                      <span className="font-label-lg text-label-lg text-on-surface font-bold truncate">الصورة الشخصية الرسمية</span>
                      <div
                        className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm"
                      >
                        <span>صالحة لجميع المعاملات</span>
                        <span className="text-secondary font-semibold">جاهزة للختم</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1 mt-space-sm pt-space-xs">
                    <button
                      className="h-8 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface flex items-center justify-center transition-colors"
                      title="نسخ إلى الحافظة"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[16px]">content_copy</span>
                    </button>
                    <button
                      className="h-8 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface flex items-center justify-center transition-colors"
                      title="طباعة ورق صور"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[16px]">view_in_ar_new</span>
                    </button>
                    <button
                      className="h-8 rounded bg-surface-container text-secondary hover:bg-secondary hover:text-on-secondary flex items-center justify-center transition-colors"
                      title="إدراج في الترويسة"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[16px]">add_photo_alternate</span>
                    </button>
                  </div>
                </div>
              </div>
              {/* Drag and Drop Scanner Ingestion Zone */}
              <div
                className="p-space-md rounded-xl bg-surface-container-low flex flex-col md:flex-row items-center justify-between gap-space-md shadow-inner"
              >
                <div className="flex items-center gap-space-md">
                  <div
                    className="w-12 h-12 rounded-lg bg-surface-container-lowest flex items-center justify-center text-secondary shadow-sm shrink-0"
                  >
                    <span className="material-symbols-outlined text-[28px]">cloud_upload</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-headline-sm text-headline-sm text-on-surface font-bold">إضافة أو سحب مستمسك جديد لهذا المواطن</span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      قم بسحب الملفات إلى هنا (PDF، JPG، PNG) أو السحب مباشرة من جهاز الماسح الضوئي WIA
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-space-sm">
                  <button
                    className="px-space-md h-10 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors font-label-md text-label-md font-semibold shadow-sm"
                    type="button"
                  >
                    استعراض من الحاسوب
                  </button>
                  <button
                    className="flex items-center gap-1 px-space-md h-10 rounded-lg bg-secondary text-on-secondary hover:opacity-95 transition-all font-label-md text-label-md font-semibold shadow-sm"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                    <span>بدء مسح الورقة الحالية</span>
                  </button>
                </div>
              </div>
            </div>
            {/* Section C: Transaction Ledger & Instant Repeat Engine (أرشيف المعاملات والكتب السابقة) */}
            <div
              className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md"
            >
              {/* Ledger Header with Quick Filter */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
                <div className="flex items-center gap-space-sm">
                  <div
                    className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-secondary"
                  >
                    <span className="material-symbols-outlined text-[24px]">history_edu</span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-space-xs">
                      <span className="font-headline-md text-headline-md text-on-surface font-bold">سجل المعاملات والكتب الإدارية الصادرة للمواطن</span>
                      <span
                        className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-code-sm text-code-sm"
                      >
                        4 كتب سابقة
                      </span>
                    </div>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      نظام التكرار الفوري: تحديث التأريخ والصادر آلياً بنقرة واحدة دون إعادة الطباعة اليدوية
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-space-xs">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">الميزة الجوهرية:</span>
                  <span
                    className="px-2 py-1 rounded bg-surface-container-highest text-secondary font-label-sm text-label-sm font-bold flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">bolt</span>
                    تكرار في ثانيتين
                  </span>
                </div>
              </div>
              {/* Ledger Table */}
              <div className="overflow-x-auto rounded-xl shadow-inner bg-surface-container-low">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-surface-container-high text-on-surface-variant font-label-md text-label-md">
                      <th className="p-space-md font-bold">رقم الصادر / الرمز</th>
                      <th className="p-space-md font-bold">نوع الكتاب الإداري</th>
                      <th className="p-space-md font-bold">الجهة المعنون إليها</th>
                      <th className="p-space-md font-bold">تاريخ الإصدار</th>
                      <th className="p-space-md font-bold">الحالة الإجرائية</th>
                      <th className="p-space-md font-bold text-center">الإجراء السريع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container font-body-sm text-body-sm">
                    {/* Row 1 */}
                    <tr className="hover:bg-surface-container-lowest transition-colors group">
                      <td className="p-space-md font-mono text-on-surface font-bold">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-secondary text-[18px]">verified</span>
                          <span>ص / 10842</span>
                        </div>
                      </td>
                      <td className="p-space-md">
                        <div className="flex flex-col">
                          <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">كتاب تأييد استمرار بالخدمة</span>
                          <span className="font-label-sm text-label-sm text-on-surface-variant">لأغراض الكفالة المصرفية والمخصصات</span>
                        </div>
                      </td>
                      <td className="p-space-md text-on-surface">مصرف الرافدين / فرع الفردوس (8)</td>
                      <td className="p-space-md font-mono text-on-surface-variant">12/04/2024</td>
                      <td className="p-space-md">
                        <span
                          className="px-2 py-0.5 rounded-full bg-surface-container-highest text-secondary font-label-sm text-label-sm font-semibold"
                        >
                          مسلّم ومؤرشف
                        </span>
                      </td>
                      <td className="p-space-md text-center">
                        <button
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-secondary text-on-secondary hover:opacity-95 shadow-sm font-label-sm text-label-sm font-bold transition-transform active:scale-95"
                          title="ينشئ نفس الكتاب الآن مع رقم صادر جديد وتأريخ اليوم فوراً"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[16px]">sync_saved_locally</span>
                          <span>تكرار وتحديث التأريخ (ثانيتان)</span>
                        </button>
                      </td>
                    </tr>
                    {/* Row 2 */}
                    <tr className="hover:bg-surface-container-lowest transition-colors group">
                      <td className="p-space-md font-mono text-on-surface font-bold">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-secondary text-[18px]">verified</span>
                          <span>ص / 08921</span>
                        </div>
                      </td>
                      <td className="p-space-md">
                        <div className="flex flex-col">
                          <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">كتاب عدم ممانعة إيفاد ودراسة</span>
                          <span className="font-label-sm text-label-sm text-on-surface-variant">إكمال متطلبات الدراسات العليا</span>
                        </div>
                      </td>
                      <td className="p-space-md text-on-surface">وزارة التعليم العالي والبحث العلمي</td>
                      <td className="p-space-md font-mono text-on-surface-variant">18/11/2023</td>
                      <td className="p-space-md">
                        <span
                          className="px-2 py-0.5 rounded-full bg-surface-container-highest text-secondary font-label-sm text-label-sm font-semibold"
                        >
                          مكتمل رسمياً
                        </span>
                      </td>
                      <td className="p-space-md text-center">
                        <button
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-secondary hover:text-on-secondary text-on-surface shadow-sm font-label-sm text-label-sm font-bold transition-all active:scale-95"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[16px]">replay</span>
                          <span>تكرار المعاملة</span>
                        </button>
                      </td>
                    </tr>
                    {/* Row 3 */}
                    <tr className="hover:bg-surface-container-lowest transition-colors group">
                      <td className="p-space-md font-mono text-on-surface font-bold">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-secondary text-[18px]">verified</span>
                          <span>ص / 05419</span>
                        </div>
                      </td>
                      <td className="p-space-md">
                        <div className="flex flex-col">
                          <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">تأييد سكن مصدق وموثق إلكترونياً</span>
                          <span className="font-label-sm text-label-sm text-on-surface-variant">مع ختم المختار وتوقيع المجلس المحلي</span>
                        </div>
                      </td>
                      <td className="p-space-md text-on-surface">دائرة الأحوال المدنية والجوازات</td>
                      <td className="p-space-md font-mono text-on-surface-variant">05/06/2023</td>
                      <td className="p-space-md">
                        <span
                          className="px-2 py-0.5 rounded-full bg-surface-container-highest text-secondary font-label-sm text-label-sm font-semibold"
                        >
                          منتهي الصلاحية
                        </span>
                      </td>
                      <td className="p-space-md text-center">
                        <button
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-secondary text-on-secondary hover:opacity-95 shadow-sm font-label-sm text-label-sm font-bold transition-transform active:scale-95"
                          title="تجديد تأييد السكن لنفس العنوان مع تاريخ اليوم"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[16px]">autorenew</span>
                          <span>تجديد فوري لليوم</span>
                        </button>
                      </td>
                    </tr>
                    {/* Row 4 */}
                    <tr className="hover:bg-surface-container-lowest transition-colors group">
                      <td className="p-space-md font-mono text-on-surface font-bold">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-secondary text-[18px]">verified</span>
                          <span>ص / 01103</span>
                        </div>
                      </td>
                      <td className="p-space-md">
                        <div className="flex flex-col">
                          <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">كتاب شكر وتقدير وظيفي</span>
                          <span className="font-label-sm text-label-sm text-on-surface-variant">بناءً على جهود الامتحانات الوزارية العامة</span>
                        </div>
                      </td>
                      <td className="p-space-md text-on-surface">إلى الموظف مباشرة / ملف الأضبارة</td>
                      <td className="p-space-md font-mono text-on-surface-variant">29/08/2022</td>
                      <td className="p-space-md">
                        <span
                          className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm font-semibold"
                        >
                          محفوظ بالأضبارة
                        </span>
                      </td>
                      <td className="p-space-md text-center">
                        <button
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-sm text-label-sm font-semibold transition-colors"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[16px]">print</span>
                          <span>إعادة طباعة الأصل</span>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {/* Ledger Footer Summary */}
              <div
                className="flex flex-col sm:flex-row items-center justify-between gap-space-sm pt-space-xs text-on-surface-variant font-label-sm text-label-sm"
              >
                <div className="flex items-center gap-space-sm">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-secondary">memory</span>
                    محفوظ في قاعدة بيانات الأرشيف المحلي (SQLite 3.42)
                  </span>
                  <span>•</span>
                  <span>بصمة التوثيق SHA-256: 9b2d8f...301a</span>
                </div>
                <div className="flex items-center gap-space-xs">
                  <button
                    className="px-2 py-1 rounded hover:bg-surface-container text-on-surface transition-colors"
                    type="button"
                  >
                    تصدير السجل كملف Excel
                  </button>
                  <span>|</span>
                  <button
                    className="px-2 py-1 rounded hover:bg-surface-container text-on-surface transition-colors"
                    type="button"
                  >
                    عرض السجل الجنائي / البراءة
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Client-side Interactive Micro-Script */}
      </div>
    </main>
  );
}
