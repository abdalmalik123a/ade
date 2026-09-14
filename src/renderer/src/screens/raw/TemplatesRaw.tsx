/* مُولَّد آليًا من stitch_/_3/code.html — لا تُحرّره يدويًا.
   أعِد التوليد بـ: node tools/html-to-tsx.mjs */
/* eslint-disable */

export default function TemplatesRaw() {
  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full">
      <div className="flex flex-col w-full">
        <section className="p-space-lg flex flex-col gap-space-lg">
          {/* Quick Statistics & Primary Action */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-md">
            {/* Metric Card 1: Official Templates */}
            <div
              className="relative overflow-hidden bg-surface-container-lowest p-space-md rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-space-sm">
                <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">النماذج الرسمية المعتمدة</span>
                <div
                  className="w-8 h-8 rounded-lg bg-surface-container-high text-secondary flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                </div>
              </div>
              <div className="flex items-baseline gap-space-sm">
                <span className="font-headline-xl text-headline-xl text-on-surface tracking-tight">48</span>
                <span className="font-label-sm text-label-sm text-secondary font-bold">صيغة نافذة</span>
              </div>
              <div
                className="mt-space-sm flex items-center gap-1.5 text-on-surface-variant font-body-sm text-body-sm"
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-secondary" />
                <span>مراجعة قانونياً للعام الجاري</span>
              </div>
            </div>
            {/* Metric Card 2: Custom Drafts */}
            <div
              className="relative overflow-hidden bg-surface-container-lowest p-space-md rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-space-sm">
                <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">مسودات المكتب الخاصة</span>
                <div
                  className="w-8 h-8 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[18px]">drive_file_rename_outline</span>
                </div>
              </div>
              <div className="flex items-baseline gap-space-sm">
                <span className="font-headline-xl text-headline-xl text-on-surface tracking-tight">12</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">نموذج مخصص</span>
              </div>
              <div
                className="mt-space-sm flex items-center gap-1.5 text-on-surface-variant font-body-sm text-body-sm"
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-surface-container-highest" />
                <span>آخر تعديل: اليوم 11:30 ص</span>
              </div>
            </div>
            {/* Metric Card 3: Monthly Issued Documents */}
            <div
              className="relative overflow-hidden bg-surface-container-lowest p-space-md rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-space-sm">
                <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">الكتب المطبوعة هذا الشهر</span>
                <div
                  className="w-8 h-8 rounded-lg bg-surface-container-high text-secondary flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[18px]">local_printshop</span>
                </div>
              </div>
              <div className="flex items-baseline gap-space-sm">
                <span className="font-headline-xl text-headline-xl text-on-surface tracking-tight">1,240</span>
                <span className="font-label-sm text-label-sm text-secondary font-bold">كتاب رسمي</span>
              </div>
              <div className="mt-space-sm flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-on-surface-variant">معدل الإصدار اليومي</span>
                <span className="font-label-sm text-label-sm text-on-surface font-semibold">41 كتاب / يوم</span>
              </div>
            </div>
            {/* Action Card: Create New Draft / Variable Template */}
            <div
              className="relative overflow-hidden bg-primary-container text-on-primary p-space-md rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col justify-between group cursor-pointer transition-all duration-200 hover:bg-inverse-surface"
            >
              <div className="flex items-center justify-between">
                <span
                  className="font-label-md text-label-md text-surface-container-high uppercase tracking-wider font-semibold"
                >
                  محرر التكويد الذكي
                </span>
                <span className="material-symbols-outlined text-surface-container-highest text-[24px]">post_add</span>
              </div>
              <div className="my-space-xs">
                <h2 className="font-headline-sm text-headline-sm text-on-primary font-bold">+ إنشاء مسودة نموذج جديدة</h2>
                <p className="font-body-sm text-body-sm text-surface-container-high mt-0.5">مع الحقول الديناميكية والمتغيرات التلقائية</p>
              </div>
              <button
                className="w-full h-9 rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md font-semibold flex items-center justify-center gap-space-xs transition-colors hover:bg-surface"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">data_object</span>
                <span>فتح مصمم النماذج والمُعاملات</span>
              </button>
            </div>
          </div>
          {/* Filter & Workspace Controls */}
          <div
            className="bg-surface-container-lowest p-space-md rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col gap-space-md"
          >
            {/* Top Bar: Search, Category Chips & Views */}
            <div
              className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md"
            >
              {/* Live Category Filter Buttons */}
              <div
                className="flex items-center gap-space-xs overflow-x-auto pb-1 lg:pb-0 scrollbar-none"
                id="categoryFilterContainer"
              >
                <button
                  className="px-space-md py-1.5 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold shrink-0 transition-colors"
                  data-category="all"
                  type="button"
                >
                  الكل (48)
                </button>
                <button
                  className="px-space-md py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-label-md text-label-md shrink-0 transition-colors"
                  data-category="support"
                  type="button"
                >
                  كتب التأييد والاستمرارية
                </button>
                <button
                  className="px-space-md py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-label-md text-label-md shrink-0 transition-colors"
                  data-category="notice"
                  type="button"
                >
                  كتب التبليغ والاستدعاء القضائي
                </button>
                <button
                  className="px-space-md py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-label-md text-label-md shrink-0 transition-colors"
                  data-category="decree"
                  type="button"
                >
                  القرارات الوزارية وهيئة الرأي
                </button>
                <button
                  className="px-space-md py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-label-md text-label-md shrink-0 transition-colors"
                  data-category="clearance"
                  type="button"
                >
                  كتب عدم الممانعة والنقل
                </button>
                <button
                  className="px-space-md py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-label-md text-label-md shrink-0 transition-colors"
                  data-category="residence"
                  type="button"
                >
                  نماذج المختار والسكن
                </button>
                <button
                  className="px-space-md py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-label-md text-label-md shrink-0 transition-colors"
                  data-category="custom"
                  type="button"
                >
                  مسوداتي الخاصة (12)
                </button>
              </div>
              {/* Utility Sorting & Layout Switcher */}
              <div className="flex items-center gap-space-sm shrink-0 self-end lg:self-auto">
                <div className="flex items-center bg-surface-container-low rounded-lg p-0.5">
                  <button
                    className="px-space-sm py-1 rounded bg-surface-container-lowest text-on-surface shadow-[0_1px_4px_rgba(0,0,0,0.04)] font-label-sm text-label-sm flex items-center gap-1"
                    title="عرض الشبكة الورقية"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">grid_view</span>
                    <span>A4 مصغر</span>
                  </button>
                  <button
                    className="px-space-sm py-1 rounded text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm flex items-center gap-1"
                    title="عرض جدولي مفصل"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">table_rows</span>
                    <span>سجل مسودات</span>
                  </button>
                </div>
                <div className="h-6 w-px bg-surface-container-highest" />
                <select
                  className="h-9 px-space-sm bg-surface-container-low text-on-surface rounded-lg font-label-sm text-label-sm focus:outline-none"
                >
                  <option>الأكثر استخداماً هذا الأسبوع</option>
                  <option>المضافة حديثاً</option>
                  <option>أبجدياً حسب العنوان الإداري</option>
                </select>
              </div>
            </div>
            {/* Variable Legend & Tag Filtering Hints */}
            <div
              className="flex flex-wrap items-center justify-between gap-space-sm pt-space-xs text-on-surface-variant font-label-sm text-label-sm"
            >
              <div className="flex items-center gap-space-xs flex-wrap">
                <span className="font-semibold text-on-surface">وسوم المتغيرات الحية:</span>
                <span className="px-space-xs py-0.5 rounded bg-surface-container-high text-secondary font-mono">[اسم_المواطن]</span>
                <span className="px-space-xs py-0.5 rounded bg-surface-container-high text-secondary font-mono">[رقم_الصادر]</span>
                <span className="px-space-xs py-0.5 rounded bg-surface-container-high text-secondary font-mono">[التاريخ_الهجري_والميلادي]</span>
                <span className="px-space-xs py-0.5 rounded bg-surface-container-high text-secondary font-mono">[الجهة_المستفيدة]</span>
              </div>
              <div className="flex items-center gap-space-xs text-on-surface-variant">
                <span className="material-symbols-outlined text-[16px] text-secondary">verified_user</span>
                <span>كل النماذج مؤمنة بباركود التدقيق الحكومي GS1</span>
              </div>
            </div>
          </div>
          {/* Live Paper Templates Grid (Simulated A4 Isometric Ratio Cards) */}
          <div
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-lg"
            id="templatesGrid"
          >
            {/* Template Card 1 */}
            <div
              className="bg-surface-container-lowest rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group"
            >
              {/* Card Header Info */}
              <div className="p-space-md pb-space-sm flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-space-xs mb-1">
                    <span
                      className="px-2 py-0.5 rounded bg-surface-container-highest text-secondary font-label-sm text-label-sm font-bold"
                    >
                      الأكثر طلباً
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant font-mono">CODE: DIW-EDU-301</span>
                  </div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">تأييد استمرار بالخدمة (ملاك تربوي)</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">موجه إلى المصارف ودوائر الإسكان والتقاعد الوطنية</p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-headline-sm text-headline-sm font-bold text-on-surface">320</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">طبعة هذا الشهر</span>
                </div>
              </div>
              {/* Simulated A4 Preview Window */}
              <div
                className="px-space-md py-space-sm bg-surface-container-low flex justify-center items-center"
              >
                <div
                  className="w-full max-w-[310px] aspect-[1/1.38] bg-surface-container-lowest rounded shadow-[0_1px_3px_rgba(15,23,42,0.06),0_16px_32px_-4px_rgba(15,23,42,0.08)] p-space-sm flex flex-col justify-between text-right relative overflow-hidden select-none"
                >
                  {/* Simulated Official Iraqi Crest Header */}
                  <div className="flex items-center justify-between pb-space-xs">
                    <div className="flex flex-col text-[8px] leading-tight font-bold text-on-surface">
                      <span>جمهورية العراق</span>
                      <span>وزارة التربية والتعليم</span>
                      <span className="text-[7px] text-on-surface-variant font-normal">المديرية العامة للملاكات</span>
                    </div>
                    {/* Emblem SVG */}
                    <div className="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-on-surface"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm0 2.18l6 2.25v4.66c0 4.13-2.67 8-6 9.06-3.33-1.06-6-4.93-6-9.06V6.43l6-2.25z"
                        />
                      </svg>
                    </div>
                    <div
                      className="flex flex-col text-[8px] leading-tight font-mono text-left text-on-surface-variant"
                    >
                      <span>العدد: [رقم_الصادر]</span>
                      <span>التاريخ: [التاريخ]</span>
                    </div>
                  </div>
                  {/* Subject Bar */}
                  <div className="py-1 text-center bg-surface-container-low rounded my-1">
                    <span className="font-label-sm text-label-sm font-bold text-on-surface">م/ تأييد استمرار بالخدمة الرسمية</span>
                  </div>
                  {/* Paper Body with Dynamic Tag Callouts */}
                  <div className="space-y-1.5 font-body-sm text-[9px] leading-normal text-on-surface">
                    <p>
                      تشهد هذه المديرية بأن السيد/السيدة
                      <span
                        className="px-1 py-0.5 rounded bg-surface-container-high text-secondary font-mono font-bold"
                      >
                        [اسم_الموظف]
                      </span>
                      ، العنوان الوظيفي
                      <span
                        className="px-1 py-0.5 rounded bg-surface-container-high text-secondary font-mono font-bold"
                      >
                        [العنوان]
                      </span>
                      ، مستمر بالخدمة في
                      <span
                        className="px-1 py-0.5 rounded bg-surface-container-high text-secondary font-mono font-bold"
                      >
                        [المدرسة]
                      </span>
                      حتى تاريخ تحرير هذا الكتاب الرسمي دون انقطاع، وقد زُوّد بهذا التأييد بناءً على طلبه.
                    </p>
                    <p className="text-[8px] text-on-surface-variant">
                      الملاحظات: لا يعتبر هذا التأييد كفالة مصرفية ما لم يقترن بتوقيع المدير المالي.
                    </p>
                  </div>
                  {/* Paper Footer (Signatures & Seals) */}
                  <div className="pt-space-xs flex items-end justify-between text-[8px]">
                    <div className="flex flex-col items-center">
                      <div
                        className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-[7px] text-on-surface-variant font-bold"
                      >
                        ختم الإدارة
                      </div>
                      <span className="text-[7px] mt-0.5 font-mono">QR: GS1-964</span>
                    </div>
                    <div className="flex flex-col items-center font-bold text-on-surface">
                      <span>مدير الإدارة والموارد</span>
                      <span className="font-label-sm text-label-sm text-secondary font-mono tracking-tighter">مصادق عليه</span>
                    </div>
                  </div>
                  {/* Watermark Overlay */}
                  <div
                    className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-5 rotate-[-30deg]"
                  >
                    <span className="font-headline-xl text-[44px] font-extrabold text-on-surface">ديوان العراق</span>
                  </div>
                </div>
              </div>
              {/* Variable Pills Strip */}
              <div className="px-space-md py-space-xs flex flex-wrap gap-1 bg-surface-container-lowest">
                <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">المتغيرات المحقونة:</span>
                <span
                  className="px-1.5 py-0.5 rounded bg-surface-container text-secondary font-mono text-[11px] font-semibold"
                >
                  [اسم_الموظف]
                </span>
                <span
                  className="px-1.5 py-0.5 rounded bg-surface-container text-secondary font-mono text-[11px] font-semibold"
                >
                  [العنوان]
                </span>
                <span
                  className="px-1.5 py-0.5 rounded bg-surface-container text-secondary font-mono text-[11px] font-semibold"
                >
                  [المدرسة]
                </span>
              </div>
              {/* Card Bottom Buttons */}
              <div className="p-space-md pt-space-xs flex items-center justify-between gap-space-xs">
                <button
                  className="flex-1 h-9 rounded-lg bg-primary-container text-on-primary hover:bg-inverse-surface font-label-md text-label-md font-bold flex items-center justify-center gap-1 transition-all shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">edit_document</span>
                  <span>فتح في المحرر</span>
                  <span className="font-code-sm text-code-sm opacity-60 mr-1 font-mono">Ctrl+Enter</span>
                </button>
                <button
                  className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-sm text-label-sm flex items-center justify-center"
                  title="تعديل صيغ المتغيرات"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">tune</span>
                </button>
                <button
                  className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-sm text-label-sm flex items-center justify-center"
                  title="معاينة بالحجم الكامل A4"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                </button>
              </div>
            </div>
            {/* Template Card 2 */}
            <div
              className="bg-surface-container-lowest rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group"
            >
              {/* Card Header Info */}
              <div className="p-space-md pb-space-sm flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-space-xs mb-1">
                    <span
                      className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm font-semibold"
                    >
                      إخطار عدلي
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant font-mono">CODE: DIW-NOT-108</span>
                  </div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">تبليغ بالحضور والاستدعاء الرسمي</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">للجان التحقيقية، الدوائر القانونية، والمؤسسات العدلية</p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-headline-sm text-headline-sm font-bold text-on-surface">210</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">طبعة هذا الشهر</span>
                </div>
              </div>
              {/* Simulated A4 Preview Window */}
              <div
                className="px-space-md py-space-sm bg-surface-container-low flex justify-center items-center"
              >
                <div
                  className="w-full max-w-[310px] aspect-[1/1.38] bg-surface-container-lowest rounded shadow-[0_1px_3px_rgba(15,23,42,0.06),0_16px_32px_-4px_rgba(15,23,42,0.08)] p-space-sm flex flex-col justify-between text-right relative overflow-hidden select-none"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between pb-space-xs">
                    <div className="flex flex-col text-[8px] leading-tight font-bold text-on-surface">
                      <span>المملكة الإدارية المركزية</span>
                      <span>الدائرة القانونية والتحقيقات</span>
                      <span className="text-[7px] text-on-surface-variant font-normal">قسم التبليغات والمتابعة</span>
                    </div>
                    <div
                      className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined text-[14px] text-on-surface">gavel</span>
                    </div>
                    <div
                      className="flex flex-col text-[8px] leading-tight font-mono text-left text-on-surface-variant"
                    >
                      <span>رقم: [رقم_الإشعار]</span>
                      <span>سري وشخصي</span>
                    </div>
                  </div>
                  {/* Subject Bar */}
                  <div className="py-1 text-center bg-surface-container-low rounded my-1">
                    <span className="font-label-sm text-label-sm font-bold text-error">تبليغ استدعاء واجب الحضور</span>
                  </div>
                  {/* Paper Body */}
                  <div className="space-y-1.5 font-body-sm text-[9px] leading-normal text-on-surface">
                    <p>
                      إلى المواطن / الموظف:
                      <span
                        className="px-1 py-0.5 rounded bg-surface-container-high text-secondary font-mono font-bold"
                      >
                        [اسم_الشخص]
                      </span>
                      .
                    </p>
                    <p>
                      يقتضي حضوركم أمام
                      <span
                        className="px-1 py-0.5 rounded bg-surface-container-high text-secondary font-mono font-bold"
                      >
                        [الجهة_المستدعية]
                      </span>
                      الكائنة في مجمع العدالة، في تمام الساعة
                      <span
                        className="px-1 py-0.5 rounded bg-surface-container-high text-secondary font-mono font-bold"
                      >
                        [الوقت/التاريخ]
                      </span>
                      ، وذلك للإدلاء بإفادتكم الرسمية بخصوص القضية المقيدة لدينا.
                    </p>
                    <p className="text-[8px] text-error font-semibold">تنبيه: التخلف يترتب عليه اتخاذ الإجراءات المنصوص عليها نظاماً.</p>
                  </div>
                  {/* Paper Footer */}
                  <div className="pt-space-xs flex items-end justify-between text-[8px]">
                    <div className="flex flex-col items-center">
                      <div
                        className="w-12 h-6 bg-surface-container rounded flex items-center justify-center font-mono text-[8px]"
                      >
                        [توقيع_المُبلّغ]
                      </div>
                      <span className="text-[7px] mt-0.5">المُبلّغ القضائي المعتمد</span>
                    </div>
                    <div className="flex flex-col items-center font-bold text-on-surface">
                      <span>رئيس اللجنة القانونية</span>
                      <span className="w-14 h-4 mt-1 bg-surface-container-high rounded" />
                    </div>
                  </div>
                </div>
              </div>
              {/* Variable Pills Strip */}
              <div className="px-space-md py-space-xs flex flex-wrap gap-1 bg-surface-container-lowest">
                <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">المتغيرات المحقونة:</span>
                <span
                  className="px-1.5 py-0.5 rounded bg-surface-container text-secondary font-mono text-[11px] font-semibold"
                >
                  [اسم_الشخص]
                </span>
                <span
                  className="px-1.5 py-0.5 rounded bg-surface-container text-secondary font-mono text-[11px] font-semibold"
                >
                  [الجهة_المستدعية]
                </span>
                <span
                  className="px-1.5 py-0.5 rounded bg-surface-container text-secondary font-mono text-[11px] font-semibold"
                >
                  [الوقت/التاريخ]
                </span>
              </div>
              {/* Card Bottom Buttons */}
              <div className="p-space-md pt-space-xs flex items-center justify-between gap-space-xs">
                <button
                  className="flex-1 h-9 rounded-lg bg-primary-container text-on-primary hover:bg-inverse-surface font-label-md text-label-md font-bold flex items-center justify-center gap-1 transition-all shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">edit_document</span>
                  <span>فتح في المحرر</span>
                  <span className="font-code-sm text-code-sm opacity-60 mr-1 font-mono">Ctrl+Enter</span>
                </button>
                <button
                  className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-sm text-label-sm flex items-center justify-center"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">tune</span>
                </button>
                <button
                  className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-sm text-label-sm flex items-center justify-center"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                </button>
              </div>
            </div>
            {/* Template Card 3 */}
            <div
              className="bg-surface-container-lowest rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group"
            >
              {/* Card Header Info */}
              <div className="p-space-md pb-space-sm flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-space-xs mb-1">
                    <span
                      className="px-2 py-0.5 rounded bg-surface-container-highest text-secondary font-label-sm text-label-sm font-bold"
                    >
                      قرارات ملزمة
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant font-mono">CODE: DIW-DEC-550</span>
                  </div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">قرار وزاري / هيئة الرأي العليا</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">قرارات درجات المعالجة الامتحانية وضوابط الدور الثاني</p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-headline-sm text-headline-sm font-bold text-on-surface">440</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">طبعة هذا الشهر</span>
                </div>
              </div>
              {/* Simulated A4 Preview Window */}
              <div
                className="px-space-md py-space-sm bg-surface-container-low flex justify-center items-center"
              >
                <div
                  className="w-full max-w-[310px] aspect-[1/1.38] bg-surface-container-lowest rounded shadow-[0_1px_3px_rgba(15,23,42,0.06),0_16px_32px_-4px_rgba(15,23,42,0.08)] p-space-sm flex flex-col justify-between text-right relative overflow-hidden select-none"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between pb-space-xs">
                    <div className="flex flex-col text-[8px] leading-tight font-bold text-on-surface">
                      <span>مجلس الوزراء الموقر</span>
                      <span>هيئة الرأي والقرارات الإدارية</span>
                    </div>
                    <div className="text-[9px] font-bold text-secondary font-mono tracking-widest">[قرار_رسمي]</div>
                    <div
                      className="flex flex-col text-[8px] leading-tight font-mono text-left text-on-surface-variant"
                    >
                      <span>
                        القرار رقم:
                        <span className="text-secondary font-bold">[رقم_القرار]</span>
                      </span>
                      <span>
                        سنة:
                        <span className="text-secondary font-bold">[السنة_الدراسية]</span>
                      </span>
                    </div>
                  </div>
                  {/* Subject Bar */}
                  <div className="py-1 text-center bg-surface-container-low rounded my-1">
                    <span className="font-label-sm text-label-sm font-bold text-on-surface">قرار تنظيمي نافذ - معالجة الحالات الحرجة</span>
                  </div>
                  {/* Mini Embedded Table for Criteria */}
                  <div className="w-full rounded bg-surface-container-low p-1 my-1">
                    <div className="grid grid-cols-3 text-[7px] font-bold text-on-surface-variant pb-0.5">
                      <span>المرحلة الدراسية</span>
                      <span>درجات القرار</span>
                      <span>الشرط النظامي</span>
                    </div>
                    <div className="grid grid-cols-3 text-[7px] text-on-surface pt-0.5">
                      <span>المرحلة المنتهية</span>
                      <span className="font-mono text-secondary font-bold">+5 درجات</span>
                      <span>النجاح بالدور 2</span>
                    </div>
                    <div className="grid grid-cols-3 text-[7px] text-on-surface pt-0.5">
                      <span>المراحل الانتقالية</span>
                      <span className="font-mono text-secondary font-bold">+7 درجات</span>
                      <span>تغيير الحال فقط</span>
                    </div>
                  </div>
                  {/* Paper Body */}
                  <div className="font-body-sm text-[8px] text-on-surface leading-tight">
                    <p>
                      استناداً لأحكام المادة القانونية في لائحة هيئة الرأي رقم (١٢)، يُعتمد هذا القرار ويُبلّغ لكافة المديريات العامة للتنفيذ العاجل والأرشفة بالسجلات.
                    </p>
                  </div>
                  {/* Paper Footer */}
                  <div className="pt-space-xs flex items-end justify-between text-[8px]">
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-4 rounded bg-surface-container-high" />
                      <span className="text-[7px]">نُشر في الوقائع</span>
                    </div>
                    <div className="flex flex-col items-center font-bold text-on-surface">
                      <span>أمين سر هيئة الرأي</span>
                      <span className="text-[7px] text-on-surface-variant">التصديق الإلكتروني نشط</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Variable Pills Strip */}
              <div className="px-space-md py-space-xs flex flex-wrap gap-1 bg-surface-container-lowest">
                <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">المتغيرات المحقونة:</span>
                <span
                  className="px-1.5 py-0.5 rounded bg-surface-container text-secondary font-mono text-[11px] font-semibold"
                >
                  [رقم_القرار]
                </span>
                <span
                  className="px-1.5 py-0.5 rounded bg-surface-container text-secondary font-mono text-[11px] font-semibold"
                >
                  [السنة_الدراسية]
                </span>
                <span
                  className="px-1.5 py-0.5 rounded bg-surface-container text-secondary font-mono text-[11px] font-semibold"
                >
                  [جدول_الدرجات]
                </span>
              </div>
              {/* Card Bottom Buttons */}
              <div className="p-space-md pt-space-xs flex items-center justify-between gap-space-xs">
                <button
                  className="flex-1 h-9 rounded-lg bg-primary-container text-on-primary hover:bg-inverse-surface font-label-md text-label-md font-bold flex items-center justify-center gap-1 transition-all shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">edit_document</span>
                  <span>فتح في المحرر</span>
                  <span className="font-code-sm text-code-sm opacity-60 mr-1 font-mono">Ctrl+Enter</span>
                </button>
                <button
                  className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-sm text-label-sm flex items-center justify-center"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">tune</span>
                </button>
                <button
                  className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-sm text-label-sm flex items-center justify-center"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                </button>
              </div>
            </div>
            {/* Template Card 4 */}
            <div
              className="bg-surface-container-lowest rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group"
            >
              {/* Card Header Info */}
              <div className="p-space-md pb-space-sm flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-space-xs mb-1">
                    <span
                      className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm font-semibold"
                    >
                      تنقلات ودراسات
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant font-mono">CODE: DIW-TRN-204</span>
                  </div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">كتاب عدم ممانعة / ترويج معاملة</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">إكمال الدراسات العليا، الإعارة، ونقل التخصيص المالي</p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-headline-sm text-headline-sm font-bold text-on-surface">195</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">طبعة هذا الشهر</span>
                </div>
              </div>
              {/* Simulated A4 Preview Window */}
              <div
                className="px-space-md py-space-sm bg-surface-container-low flex justify-center items-center"
              >
                <div
                  className="w-full max-w-[310px] aspect-[1/1.38] bg-surface-container-lowest rounded shadow-[0_1px_3px_rgba(15,23,42,0.06),0_16px_32px_-4px_rgba(15,23,42,0.08)] p-space-sm flex flex-col justify-between text-right relative overflow-hidden select-none"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between pb-space-xs">
                    <div className="flex flex-col text-[8px] leading-tight font-bold text-on-surface">
                      <span>وزارة التخطيط والمالية</span>
                      <span>دائرة شؤون الموظفين</span>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center">
                      <span className="material-symbols-outlined text-[15px] text-secondary">transfer_within_a_station</span>
                    </div>
                    <div
                      className="flex flex-col text-[8px] leading-tight font-mono text-left text-on-surface-variant"
                    >
                      <span>صادر: [رقم_الصادر]</span>
                      <span>تاريخ: [تاريخ_اليوم]</span>
                    </div>
                  </div>
                  {/* Subject Bar */}
                  <div className="py-1 text-center bg-surface-container-low rounded my-1">
                    <span className="font-label-sm text-label-sm font-bold text-on-surface">م/ عدم ممانعة من ترويج معاملة</span>
                  </div>
                  {/* Paper Body */}
                  <div className="space-y-1.5 font-body-sm text-[9px] leading-normal text-on-surface">
                    <p>
                      إلى/
                      <span
                        className="px-1 py-0.5 rounded bg-surface-container-high text-secondary font-mono font-bold"
                      >
                        [الجهة_الموجه_إليها]
                      </span>
                    </p>
                    <p>
                      لا تمانع هذه الدائرة من قيام الموظف
                      <span
                        className="px-1 py-0.5 rounded bg-surface-container-high text-secondary font-mono font-bold"
                      >
                        [اسم_الموظف_المعني]
                      </span>
                      بالتقديم على
                      <span
                        className="px-1 py-0.5 rounded bg-surface-container-high text-secondary font-mono font-bold"
                      >
                        [نوع_البرنامج_الدراسي_أو_النقل]
                      </span>
                      للعام الحالي، شريطة عدم الإخلال بالواجبات المكلف بها نظاماً.
                    </p>
                  </div>
                  {/* Paper Footer */}
                  <div className="pt-space-xs flex items-end justify-between text-[8px]">
                    <div className="flex flex-col items-center">
                      <div
                        className="w-10 h-7 rounded bg-surface-container-high flex items-center justify-center text-[7px]"
                      >
                        شعبة الصادرة
                      </div>
                    </div>
                    <div className="flex flex-col items-center font-bold text-on-surface">
                      <span>الوكيل الإداري والمالي</span>
                      <span className="text-[7px] text-on-surface-variant font-normal">عنه / رئيس القسم</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Variable Pills Strip */}
              <div className="px-space-md py-space-xs flex flex-wrap gap-1 bg-surface-container-lowest">
                <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">المتغيرات المحقونة:</span>
                <span
                  className="px-1.5 py-0.5 rounded bg-surface-container text-secondary font-mono text-[11px] font-semibold"
                >
                  [الجهة_الموجه_إليها]
                </span>
                <span
                  className="px-1.5 py-0.5 rounded bg-surface-container text-secondary font-mono text-[11px] font-semibold"
                >
                  [اسم_الموظف_المعني]
                </span>
                <span
                  className="px-1.5 py-0.5 rounded bg-surface-container text-secondary font-mono text-[11px] font-semibold"
                >
                  [نوع_البرنامج]
                </span>
              </div>
              {/* Card Bottom Buttons */}
              <div className="p-space-md pt-space-xs flex items-center justify-between gap-space-xs">
                <button
                  className="flex-1 h-9 rounded-lg bg-primary-container text-on-primary hover:bg-inverse-surface font-label-md text-label-md font-bold flex items-center justify-center gap-1 transition-all shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">edit_document</span>
                  <span>فتح في المحرر</span>
                  <span className="font-code-sm text-code-sm opacity-60 mr-1 font-mono">Ctrl+Enter</span>
                </button>
                <button
                  className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-sm text-label-sm flex items-center justify-center"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">tune</span>
                </button>
                <button
                  className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-sm text-label-sm flex items-center justify-center"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                </button>
              </div>
            </div>
            {/* Template Card 5 */}
            <div
              className="bg-surface-container-lowest rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group"
            >
              {/* Card Header Info */}
              <div className="p-space-md pb-space-sm flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-space-xs mb-1">
                    <span
                      className="px-2 py-0.5 rounded bg-surface-container-highest text-secondary font-label-sm text-label-sm font-bold"
                    >
                      الأعلى تداولاً
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant font-mono">CODE: DIW-RES-912</span>
                  </div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">تأييد سكن وتأييد معيشة رسمي</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">مجالس الأقضية والنواحي، مكاتب المختارين، وإصدار البطاقة</p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-headline-sm text-headline-sm font-bold text-on-surface">512</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">طبعة هذا الشهر</span>
                </div>
              </div>
              {/* Simulated A4 Preview Window */}
              <div
                className="px-space-md py-space-sm bg-surface-container-low flex justify-center items-center"
              >
                <div
                  className="w-full max-w-[310px] aspect-[1/1.38] bg-surface-container-lowest rounded shadow-[0_1px_3px_rgba(15,23,42,0.06),0_16px_32px_-4px_rgba(15,23,42,0.08)] p-space-sm flex flex-col justify-between text-right relative overflow-hidden select-none"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between pb-space-xs">
                    <div className="flex flex-col text-[8px] leading-tight font-bold text-on-surface">
                      <span>محافظة بغداد / الإدارة المحلية</span>
                      <span>مكتب المختار المعتمد</span>
                      <span className="text-[7px] text-on-surface-variant">قاطع الكرخ المركز</span>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center">
                      <span className="material-symbols-outlined text-[15px] text-on-surface">home_pin</span>
                    </div>
                    <div
                      className="flex flex-col text-[8px] leading-tight font-mono text-left text-on-surface-variant"
                    >
                      <span>الرقم: [رقم_السجل]</span>
                      <span>المحلة: [رقم_المحلة]</span>
                    </div>
                  </div>
                  {/* Subject Bar */}
                  <div className="py-1 text-center bg-surface-container-low rounded my-1">
                    <span className="font-label-sm text-label-sm font-bold text-on-surface">استمارة تأييد سكن عائلي</span>
                  </div>
                  {/* Citizen Box Simulation */}
                  <div className="p-1 rounded bg-surface-container-low font-body-sm text-[8px] space-y-0.5">
                    <div className="flex justify-between">
                      <span>
                        المواطن:
                        <span className="font-bold text-secondary">[اسم_المواطن_الرباعي]</span>
                      </span>
                      <span>
                        الرقم الوطني:
                        <span className="font-mono font-bold">[البطاقة_الوطنية]</span>
                      </span>
                    </div>
                    <div className="flex justify-between text-on-surface-variant text-[7px]">
                      <span>المحلة: [محلة] | الزقاق: [زقاق] | الدار: [دار]</span>
                      <span>تاريخ التسكين: [سنة_السكن]</span>
                    </div>
                  </div>
                  {/* Paper Body */}
                  <div className="font-body-sm text-[8px] text-on-surface leading-tight mt-1">
                    <p>
                      نؤيد نحن مختار المحلة بأن الشخص المذكور أعلاه يسكن في العنوان المثبت بعائلته، ولم يُسجل بحقه أي إشكال أمني أو عشائري.
                    </p>
                  </div>
                  {/* Paper Footer */}
                  <div className="pt-space-xs flex items-end justify-between text-[8px]">
                    <div className="flex flex-col items-center">
                      <div
                        className="w-8 h-8 rounded-full border border-dashed border-secondary flex items-center justify-center text-[7px] text-secondary font-bold"
                      >
                        ختم المختار
                      </div>
                    </div>
                    <div className="flex flex-col items-center font-bold text-on-surface">
                      <span>مختار المحلة المعتمد</span>
                      <span className="text-[7px] text-on-surface-variant font-normal">مصادقة المجلس المحلي</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Variable Pills Strip */}
              <div className="px-space-md py-space-xs flex flex-wrap gap-1 bg-surface-container-lowest">
                <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">المتغيرات المحقونة:</span>
                <span
                  className="px-1.5 py-0.5 rounded bg-surface-container text-secondary font-mono text-[11px] font-semibold"
                >
                  [اسم_المواطن_الرباعي]
                </span>
                <span
                  className="px-1.5 py-0.5 rounded bg-surface-container text-secondary font-mono text-[11px] font-semibold"
                >
                  [البطاقة_الوطنية]
                </span>
                <span
                  className="px-1.5 py-0.5 rounded bg-surface-container text-secondary font-mono text-[11px] font-semibold"
                >
                  [بيانات_السكن]
                </span>
              </div>
              {/* Card Bottom Buttons */}
              <div className="p-space-md pt-space-xs flex items-center justify-between gap-space-xs">
                <button
                  className="flex-1 h-9 rounded-lg bg-primary-container text-on-primary hover:bg-inverse-surface font-label-md text-label-md font-bold flex items-center justify-center gap-1 transition-all shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">edit_document</span>
                  <span>فتح في المحرر</span>
                  <span className="font-code-sm text-code-sm opacity-60 mr-1 font-mono">Ctrl+Enter</span>
                </button>
                <button
                  className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-sm text-label-sm flex items-center justify-center"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">tune</span>
                </button>
                <button
                  className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-sm text-label-sm flex items-center justify-center"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                </button>
              </div>
            </div>
            {/* Template Card 6 */}
            <div
              className="bg-surface-container-lowest rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group"
            >
              {/* Card Header Info */}
              <div className="p-space-md pb-space-sm flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-space-xs mb-1">
                    <span
                      className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm font-semibold"
                    >
                      لجان وعهد
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant font-mono">CODE: DIW-INV-441</span>
                  </div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">محضر استلام وتسليم رسمي (جرد العهد)</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">لجان الجرد السنوي، الأجهزة الإلكترونية، والذمم المكتبية</p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-headline-sm text-headline-sm font-bold text-on-surface">88</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">طبعة هذا الشهر</span>
                </div>
              </div>
              {/* Simulated A4 Preview Window */}
              <div
                className="px-space-md py-space-sm bg-surface-container-low flex justify-center items-center"
              >
                <div
                  className="w-full max-w-[310px] aspect-[1/1.38] bg-surface-container-lowest rounded shadow-[0_1px_3px_rgba(15,23,42,0.06),0_16px_32px_-4px_rgba(15,23,42,0.08)] p-space-sm flex flex-col justify-between text-right relative overflow-hidden select-none"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between pb-space-xs">
                    <div className="flex flex-col text-[8px] leading-tight font-bold text-on-surface">
                      <span>لجنة إدارة الأصول والمخازن</span>
                      <span>محضر رسمي مصدق</span>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center">
                      <span className="material-symbols-outlined text-[15px] text-on-surface">inventory</span>
                    </div>
                    <div
                      className="flex flex-col text-[8px] leading-tight font-mono text-left text-on-surface-variant"
                    >
                      <span>محضر رقم: [رقم_المحضر]</span>
                      <span>النسخة: الأصلية 1/3</span>
                    </div>
                  </div>
                  {/* Subject Bar */}
                  <div className="py-1 text-center bg-surface-container-low rounded my-1">
                    <span className="font-label-sm text-label-sm font-bold text-on-surface">محضر استلام وتسليم ذمة مادية</span>
                  </div>
                  {/* Micro Table */}
                  <div className="w-full rounded bg-surface-container-low p-1 my-1">
                    <div className="grid grid-cols-4 text-[7px] font-bold text-on-surface-variant pb-0.5">
                      <span>ت</span>
                      <span>المادة / الجهاز</span>
                      <span>الرقم التسلسلي</span>
                      <span>الحالة الفنية</span>
                    </div>
                    <div className="grid grid-cols-4 text-[7px] text-on-surface pt-0.5">
                      <span>1</span>
                      <span>طابعة HP Laser</span>
                      <span className="font-mono text-[6px]">SN: 8902A</span>
                      <span className="text-secondary font-bold">جيدة جداً</span>
                    </div>
                    <div className="grid grid-cols-4 text-[7px] text-on-surface pt-0.5">
                      <span>2</span>
                      <span>ماسح ضوئي A4</span>
                      <span className="font-mono text-[6px]">SN: 1140C</span>
                      <span className="text-secondary font-bold">تعمل بكفاءة</span>
                    </div>
                  </div>
                  {/* Paper Body */}
                  <div className="font-body-sm text-[8px] text-on-surface leading-tight">
                    <p>
                      جرى تسليم واستلام المواد المثبتة أعلاه بين الطرفين بحضور أعضاء اللجنة المشكلة بموجب الأمر الإداري ذي العدد [الأمر_الإداري].
                    </p>
                  </div>
                  {/* Paper Footer Dual Signatures */}
                  <div className="pt-space-xs flex items-center justify-between text-[8px]">
                    <div className="flex flex-col items-center font-bold">
                      <span>المُسلّم (الطرف الأول)</span>
                      <span className="text-[7px] text-on-surface-variant font-mono">[توقيع_المسلم]</span>
                    </div>
                    <div className="flex flex-col items-center font-bold">
                      <span>المُستلم (الطرف الثاني)</span>
                      <span className="text-[7px] text-on-surface-variant font-mono">[توقيع_المستلم]</span>
                    </div>
                    <div className="flex flex-col items-center font-bold">
                      <span>رئيس لجنة الجرد</span>
                      <span className="text-[7px] text-secondary font-mono">مصادق</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Variable Pills Strip */}
              <div className="px-space-md py-space-xs flex flex-wrap gap-1 bg-surface-container-lowest">
                <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">المتغيرات المحقونة:</span>
                <span
                  className="px-1.5 py-0.5 rounded bg-surface-container text-secondary font-mono text-[11px] font-semibold"
                >
                  [رقم_المحضر]
                </span>
                <span
                  className="px-1.5 py-0.5 rounded bg-surface-container text-secondary font-mono text-[11px] font-semibold"
                >
                  [المُسلّم]
                </span>
                <span
                  className="px-1.5 py-0.5 rounded bg-surface-container text-secondary font-mono text-[11px] font-semibold"
                >
                  [المُستلم]
                </span>
                <span
                  className="px-1.5 py-0.5 rounded bg-surface-container text-secondary font-mono text-[11px] font-semibold"
                >
                  [جدول_الأصول]
                </span>
              </div>
              {/* Card Bottom Buttons */}
              <div className="p-space-md pt-space-xs flex items-center justify-between gap-space-xs">
                <button
                  className="flex-1 h-9 rounded-lg bg-primary-container text-on-primary hover:bg-inverse-surface font-label-md text-label-md font-bold flex items-center justify-center gap-1 transition-all shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">edit_document</span>
                  <span>فتح في المحرر</span>
                  <span className="font-code-sm text-code-sm opacity-60 mr-1 font-mono">Ctrl+Enter</span>
                </button>
                <button
                  className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-sm text-label-sm flex items-center justify-center"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">tune</span>
                </button>
                <button
                  className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors font-label-sm text-label-sm flex items-center justify-center"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                </button>
              </div>
            </div>
          </div>
          {/* Quick Footer Audit Bar */}
          <div
            className="p-space-md bg-surface-container-lowest rounded-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] flex flex-col sm:flex-row items-center justify-between gap-space-sm"
          >
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-secondary text-[20px]">sync</span>
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface font-bold">مزامنة مكتبة النماذج الوطنية</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">تم استيراد آخر تحديث للتعليمات الوزارية قبل 3 ساعات (الإصدار 2024.11)</span>
              </div>
            </div>
            <div className="flex items-center gap-space-sm">
              <button
                className="h-9 px-space-md rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high font-label-md text-label-md font-semibold flex items-center gap-1 transition-colors"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">file_upload</span>
                <span>استيراد نموذج DOCX / XML</span>
              </button>
              <button
                className="h-9 px-space-md rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container-high font-label-md text-label-md font-semibold flex items-center gap-1 transition-colors"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">backup</span>
                <span>نسخ احتياطي للمسودات</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
