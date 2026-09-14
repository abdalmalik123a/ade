/* مُولَّد آليًا من stitch_/a4/code.html — لا تُحرّره يدويًا.
   أعِد التوليد بـ: node tools/html-to-tsx.mjs */
/* eslint-disable */

export default function EditorRaw() {
  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full">
      <div className="flex flex-col w-full">
        <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden bg-surface">
          {/* Left Split: Form Panel / Dynamic Control Rail */}
          <div
            className="w-full lg:w-[480px] xl:w-[520px] shrink-0 h-full flex flex-col bg-surface-container-lowest shadow-[0_10px_30px_rgba(11,28,48,0.06)] z-20 overflow-hidden"
          >
            {/* Workspace Sub-Header & Template Selector */}
            <div className="p-space-md bg-surface-container-low flex flex-col gap-space-sm shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-space-xs">
                  <span className="p-1 rounded-lg bg-primary-container text-on-primary">
                    <span className="material-symbols-outlined text-[18px]">auto_stories</span>
                  </span>
                  <span className="font-headline-sm text-headline-sm text-on-surface">محرر الكتب الرسمية الذكي</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-semibold flex items-center gap-1"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                    مزامنة فورية
                  </span>
                  <span
                    className="font-code-sm text-code-sm text-on-surface-variant bg-surface-container px-2 py-0.5 rounded"
                  >
                    REV-2024.11
                  </span>
                </div>
              </div>
              <div
                className="bg-surface-container-lowest p-space-sm rounded-xl shadow-sm flex flex-col gap-space-xs"
              >
                <div className="flex items-center justify-between">
                  <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">النموذج الرسمي النشط</label>
                  <span
                    className="font-label-sm text-label-sm text-secondary font-semibold cursor-pointer hover:underline"
                  >
                    مكتبة النماذج (Ctrl+M)
                  </span>
                </div>
                <div className="flex items-center gap-space-xs">
                  <div className="relative flex-1">
                    <select
                      className="w-full h-9 pr-8 pl-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md appearance-none focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer"
                      id="templateSelect"
                      defaultValue="تأييد استمرار بالخدمة - وزارة التربية (نموذج معتمد)"
                    >
                      <option>تأييد استمرار بالخدمة - وزارة التربية (نموذج معتمد)</option>
                      <option>أمر إداري - إيفاد رسمي ومهام تفتيشية</option>
                      <option>كتاب شكر وتقدير وزاري - كوادر تدريسية</option>
                      <option>تأييد براءة ذمة ومستحقات مالية</option>
                    </select>
                    <span
                      className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none"
                    >
                      contract
                    </span>
                  </div>
                  <button
                    className="h-9 px-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm flex items-center gap-1 transition-colors"
                    id="btnImportCitizen"
                    title="استيراد سريع من سجل المواطنين"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px] text-secondary">person_search</span>
                    <span>استيراد (F2)</span>
                  </button>
                </div>
              </div>
            </div>
            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto p-space-md space-y-space-md">
              {/* Accordion Section 1: Official Header & Authority */}
              <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm">
                <div className="flex items-center justify-between pb-space-xs">
                  <div className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-secondary text-[20px]">account_balance</span>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface">بيانات الترويسة والجهة الإدارية</h3>
                  </div>
                  <span className="font-code-sm text-code-sm text-on-surface-variant">القسم الأول</span>
                </div>
                <div className="grid grid-cols-2 gap-space-sm">
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-label-sm text-on-surface-variant">
                      المديرية العامة
                      <span className="text-error">*</span>
                    </label>
                    <input
                      className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                      id="inputDirectorate"
                      type="text"
                      defaultValue="المديرية العامة لتربية بغداد / الرصافة الأولى"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-label-sm text-on-surface-variant">القسم / الإدارة المختصة</label>
                    <input
                      className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                      id="inputDepartment"
                      type="text"
                      defaultValue="قسم التعليم العام والملاك الإداري"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant">المدرسة أو التشكيل المباشر</label>
                  <input
                    className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                    id="inputSchool"
                    type="text"
                    defaultValue="إعدادية المنصور المهنية للبنين"
                  />
                </div>
              </div>
              {/* Accordion Section 2: Outgoing Registry & Dates */}
              <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm">
                <div className="flex items-center justify-between pb-space-xs">
                  <div className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-secondary text-[20px]">pin</span>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface">سجل الصادر والتأريخ الرسمي</h3>
                  </div>
                  <button
                    className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-surface-container text-secondary hover:bg-surface-container-high transition-colors font-semibold flex items-center gap-1"
                    id="btnGenSerial"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[14px]">refresh</span>
                    توليد متسلسل
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-space-sm">
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-label-sm text-on-surface-variant">
                      رقم الصادر
                      <span className="text-error">*</span>
                    </label>
                    <input
                      className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface font-code-sm text-code-sm font-bold focus:outline-none focus:ring-1 focus:ring-secondary text-left dir-ltr"
                      id="inputSerial"
                      type="text"
                      defaultValue="ق/4/1892"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-label-sm text-on-surface-variant">التاريخ الميلادي</label>
                    <input
                      className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                      id="inputDateGreg"
                      type="text"
                      defaultValue="14 تشرين الثاني 2024"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-label-sm text-on-surface-variant">التاريخ الهجري</label>
                    <input
                      className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                      id="inputDateHijri"
                      type="text"
                      defaultValue="12 جمادى الأولى 1446"
                    />
                  </div>
                </div>
              </div>
              {/* Accordion Section 3: Beneficiary Citizen Profile */}
              <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm">
                <div className="flex items-center justify-between pb-space-xs">
                  <div className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-secondary text-[20px]">badge</span>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface">بيانات صاحب العلاقة (الموظف / المكلف)</h3>
                  </div>
                  <span
                    className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant"
                  >
                    مثبت هوية
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-space-sm">
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-label-sm text-on-surface-variant">
                      الاسم الرباعي واللقب
                      <span className="text-error">*</span>
                    </label>
                    <input
                      className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface font-headline-sm text-headline-sm font-semibold focus:outline-none focus:ring-1 focus:ring-secondary"
                      id="inputName"
                      type="text"
                      defaultValue="أحمد عادل كريم الموسوي"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-label-sm text-on-surface-variant">الرقم الوطني / البطاقة الموحدة</label>
                    <input
                      className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface font-code-sm text-code-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                      id="inputCivilId"
                      type="text"
                      defaultValue="198421098312"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-space-sm">
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-label-sm text-on-surface-variant">العنوان الوظيفي</label>
                    <input
                      className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                      id="inputJobTitle"
                      type="text"
                      defaultValue="مدرس أول لغة عربية"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-label-sm text-on-surface-variant">الحالة الوظيفية والخدمة</label>
                    <select
                      className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                      id="inputJobStatus"
                      defaultValue="مستمر بالخدمة الفعلية حتى تاريخه"
                    >
                      <option>مستمر بالخدمة الفعلية حتى تاريخه</option>
                      <option>مجاز دراسياً داخل العراق</option>
                      <option>منسب إلى ديوان الوزارة</option>
                      <option>مكلف بمهام إشرافية</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-space-sm">
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-label-sm text-on-surface-variant">الجهة الموجه إليها الكتاب</label>
                    <input
                      className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                      id="inputAddressedTo"
                      type="text"
                      defaultValue="إلى / مصرف الرافدين - فرع الفردوس (34)"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-label-sm text-on-surface-variant">الغرض من التأييد</label>
                    <input
                      className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                      id="inputPurpose"
                      type="text"
                      defaultValue="ترويج معاملة سلفة شخصية"
                    />
                  </div>
                </div>
              </div>
              {/* Accordion Section 4: Document Statement & Variables Injection */}
              <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm">
                <div className="flex items-center justify-between pb-space-xs">
                  <div className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-secondary text-[20px]">format_shapes</span>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface">منطوق الكتاب والمتغيرات التلقائية</h3>
                  </div>
                  <button
                    className="font-label-sm text-label-sm text-secondary hover:underline flex items-center gap-1 font-semibold"
                    id="btnAddCustomVar"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[14px]">add_circle</span>
                    إدراج حقل مخصص
                  </button>
                </div>
                {/* Variable Injection Badges Bar */}
                <div
                  className="flex flex-wrap items-center gap-1.5 p-space-xs rounded-lg bg-surface-container-low"
                >
                  <span className="font-label-sm text-label-sm text-on-surface-variant px-1 font-semibold">حقن سريع:</span>
                  <button
                    className="tag-inject px-2 py-0.5 rounded font-code-sm text-code-sm bg-surface-container-highest text-secondary hover:bg-secondary hover:text-on-secondary transition-all"
                    data-insert="{الاسم}"
                    type="button"
                  >
                    {'{'}الاسم{'}'}
                  </button>
                  <button
                    className="tag-inject px-2 py-0.5 rounded font-code-sm text-code-sm bg-surface-container-highest text-secondary hover:bg-secondary hover:text-on-secondary transition-all"
                    data-insert="{المدرسة}"
                    type="button"
                  >
                    {'{'}المدرسة{'}'}
                  </button>
                  <button
                    className="tag-inject px-2 py-0.5 rounded font-code-sm text-code-sm bg-surface-container-highest text-secondary hover:bg-secondary hover:text-on-secondary transition-all"
                    data-insert="{العنوان_الوظيفي}"
                    type="button"
                  >
                    {'{'}العنوان_الوظيفي{'}'}
                  </button>
                  <button
                    className="tag-inject px-2 py-0.5 rounded font-code-sm text-code-sm bg-surface-container-highest text-secondary hover:bg-secondary hover:text-on-secondary transition-all"
                    data-insert="{الرقم_الوطني}"
                    type="button"
                  >
                    {'{'}الرقم_الوطني{'}'}
                  </button>
                  <button
                    className="tag-inject px-2 py-0.5 rounded font-code-sm text-code-sm bg-surface-container-highest text-secondary hover:bg-secondary hover:text-on-secondary transition-all"
                    data-insert="{سنة_المباشرة}"
                    type="button"
                  >
                    {'{'}سنة_المباشرة{'}'}
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant">المتن الرسمي (التحرير الذكي)</label>
                  <textarea
                    className="w-full p-space-sm rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md leading-relaxed focus:outline-none focus:ring-1 focus:ring-secondary resize-none"
                    id="inputTextBody"
                    rows={5}
                    defaultValue="نؤيد لكم بأن السيد {الاسم}، الحامل للرقم الوطني ({الرقم_الوطني})، يعمل بصفة ({العنوان_الوظيفي}) ضمن ملاك ({المدرسة}) التابعة لمديريتنا، وهو مستمر بالدوام الرسمي والخدمة الفعلية حتى تاريخ صدور هذا الكتاب. وبناءً على طلبه زُوّد بهذا التأييد لتقديمه إلى جهتكم المحترمة لغرض ({الغرض}). دون أن تتحمل مديريتنا أي التزام مالي أو قانوني يترتب على ذلك."
                  />
                </div>
              </div>
              {/* Accordion Section 5: Signature & Authentication Seals */}
              <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm">
                <div className="flex items-center justify-between pb-space-xs">
                  <div className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-secondary text-[20px]">verified</span>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface">التخويل والأختام الرقمية</h3>
                  </div>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">المصادقة الوزارية</span>
                </div>
                <div className="grid grid-cols-2 gap-space-sm">
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-label-sm text-on-surface-variant">الموقع والمخوّل بالتوقيع</label>
                    <input
                      className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm font-semibold focus:outline-none focus:ring-1 focus:ring-secondary"
                      id="inputSignerName"
                      type="text"
                      defaultValue="د. وسام عبد الحسين الزيدي"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-label-sm text-on-surface-variant">المنصب الإداري</label>
                    <input
                      className="h-9 px-space-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                      id="inputSignerRole"
                      type="text"
                      defaultValue="المدير العام لتربية بغداد / الرصافة الأولى وكالة"
                    />
                  </div>
                </div>
                <div
                  className="pt-space-xs flex items-center justify-between gap-space-sm bg-surface-container-low p-space-sm rounded-lg"
                >
                  <label className="flex items-center gap-space-xs cursor-pointer select-none">
                    <input
                      defaultChecked
                      className="w-4 h-4 rounded text-secondary focus:ring-secondary"
                      id="checkStamp"
                      type="checkbox"
                    />
                    <span className="font-label-sm text-label-sm text-on-surface font-medium">إظهار الختم الدائري الرسمي</span>
                  </label>
                  <label className="flex items-center gap-space-xs cursor-pointer select-none">
                    <input
                      defaultChecked
                      className="w-4 h-4 rounded text-secondary focus:ring-secondary"
                      id="checkBarcode"
                      type="checkbox"
                    />
                    <span className="font-label-sm text-label-sm text-on-surface font-medium">رمز التحقق الإلكتروني (QR)</span>
                  </label>
                  <label className="flex items-center gap-space-xs cursor-pointer select-none">
                    <input
                      defaultChecked
                      className="w-4 h-4 rounded text-secondary focus:ring-secondary"
                      id="checkWatermark"
                      type="checkbox"
                    />
                    <span className="font-label-sm text-label-sm text-on-surface font-medium">شعار النسر كعلامة مائية</span>
                  </label>
                </div>
              </div>
            </div>
            {/* Form Footer Status */}
            <div
              className="p-space-sm px-space-md bg-surface-container-low flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm shrink-0"
            >
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-secondary">cloud_done</span>
                <span>الحفظ التلقائي: تم الحفظ منذ 12 ثانية</span>
              </div>
              <div className="flex items-center gap-space-xs">
                <span className="font-mono text-on-surface font-semibold">1,024 KB</span>
                <span>| كود الوثيقة: 884-IQ-ED</span>
              </div>
            </div>
          </div>
          {/* Right Split: Live A4 Visual Canvas (Virtual Platen) */}
          <div className="flex-1 h-full flex flex-col bg-surface-container relative overflow-hidden">
            {/* Virtual Platen Floating Control HUD */}
            <div
              className="h-14 px-space-lg bg-surface-container-lowest/90 backdrop-blur-md flex items-center justify-between shadow-sm z-30 shrink-0"
            >
              <div className="flex items-center gap-space-md">
                <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-lg">
                  <button
                    className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-container-highest text-on-surface transition-colors"
                    id="btnZoomOut"
                    title="تصغير"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">zoom_out</span>
                  </button>
                  <span className="font-code-sm text-code-sm font-semibold px-2 text-on-surface" id="zoomLabel">100%</span>
                  <button
                    className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-container-highest text-on-surface transition-colors"
                    id="btnZoomIn"
                    title="تكبير"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                  </button>
                  <button
                    className="h-7 px-2 flex items-center justify-center rounded hover:bg-surface-container-highest text-on-surface font-label-sm text-label-sm transition-colors"
                    id="btnZoomFit"
                    title="ملائمة مساحة الشاشة"
                    type="button"
                  >
                    ملائمة العرض
                  </button>
                </div>
                <div
                  className="hidden sm:flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm"
                >
                  <span className="material-symbols-outlined text-[16px]">aspect_ratio</span>
                  <span>قياس المعاينة: ISO 216 (A4 - 210x297mm)</span>
                </div>
              </div>
              <div className="flex items-center gap-space-xs">
                <button
                  className="h-9 px-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm flex items-center gap-1.5 transition-colors shadow-sm"
                  id="btnExportWord"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px] text-secondary">description</span>
                  <span className="hidden md:inline">تصدير Word (.docx)</span>
                </button>
                <button
                  className="h-9 px-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm flex items-center gap-1.5 transition-colors shadow-sm"
                  id="btnExportPdf"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px] text-error">picture_as_pdf</span>
                  <span className="hidden md:inline">تصدير بدقة عالية (300 DPI)</span>
                </button>
                <button
                  className="h-9 px-space-md rounded-lg bg-primary text-on-primary hover:bg-surface-tint font-label-md text-label-md font-semibold flex items-center gap-1.5 transition-colors shadow-md"
                  id="btnPrintCanvas"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">print</span>
                  <span>طباعة الورقة الرسمية</span>
                </button>
              </div>
            </div>
            {/* Document Scrolling Desk & Viewport */}
            <div
              className="flex-1 overflow-auto p-space-lg flex justify-center items-start"
              id="deskViewport"
            >
              {/* Live Scalable A4 Sheet Container */}
              <div className="transition-transform duration-150 origin-top transform" id="a4Container">
                {/* Physical A4 Representation (210mm x 297mm proportional: 794px x 1123px at 96 DPI) */}
                <div
                  className="w-[794px] min-h-[1123px] bg-white text-black relative p-12 flex flex-col justify-between select-text shadow-[0_1px_4px_rgba(15,23,42,0.06),0_20px_40px_-8px_rgba(15,23,42,0.12)]"
                  id="a4Paper"
                >
                  {/* Authentic Iraq Coat of Arms Watermark */}
                  <div
                    className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.045] overflow-hidden z-0"
                    id="watermarkLayer"
                  >
                    <svg
                      fill="currentColor"
                      height={480}
                      viewBox="0 0 24 24"
                      width={480}
                    >
                      <path
                        d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm0 2.18l6 2.25v4.66c0 4.14-2.73 8-6 9.08-3.27-1.08-6-4.94-6-9.08V6.43l6-2.25zM11 7h2v2h-2zm0 4h2v6h-2z"
                      />
                    </svg>
                  </div>
                  {/* Authentic Official Double Border Frame (Institutional Iraqi Standard) */}
                  <div
                    className="absolute inset-4 pointer-events-none z-10 shadow-[inset_0_0_0_2px_#1e293b,inset_0_0_0_4px_#ffffff,inset_0_0_0_5px_#64748b]"
                  />
                  {/* Page Content Wrapper */}
                  <div className="relative z-10 flex flex-col flex-1 justify-between">
                    {/* Official Document Header (Bilingual + Crest) */}
                    <div>
                      <div className="grid grid-cols-3 items-center pb-6">
                        {/* Arabic Institutional Hierarchy (Right) */}
                        <div className="text-right flex flex-col space-y-0.5 leading-tight">
                          <span className="text-[15px] font-bold tracking-tight">جمهورية العراق</span>
                          <span className="text-[14px] font-bold">وزارة التربية</span>
                          <span className="text-[13px] font-semibold text-gray-800" id="docDirectorate">المديرية العامة لتربية بغداد / الرصافة الأولى</span>
                          <span className="text-[12px] text-gray-700" id="docDepartment">قسم التعليم العام والملاك الإداري</span>
                          <span className="text-[12px] font-medium text-gray-700" id="docSchool">إعدادية المنصور المهنية للبنين</span>
                        </div>
                        {/* Central Eagle Crest of the Republic */}
                        <div className="flex flex-col items-center justify-center text-center">
                          {/* Inline SVG Iraqi Eagle Crest Silhouette */}
                          <svg
                            className="w-16 h-16 text-gray-900 drop-shadow-sm mb-1"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 64 64"
                          >
                            <path
                              d="M32 6L36 14L46 16L38 23L40 33L32 28L24 33L26 23L18 16L28 14L32 6Z"
                              fill="currentColor"
                              opacity="0.85"
                            />
                            <path
                              d="M20 34C20 34 24 38 32 38C40 38 44 34 44 34V46C44 51 32 55 32 55C32 55 20 51 20 46V34Z"
                              fill="currentColor"
                              opacity="0.9"
                            />
                            <line
                              stroke="white"
                              stroke-width="1.5"
                              x1="24"
                              x2="40"
                              y1="42"
                              y2="42"
                            />
                            <line
                              stroke="white"
                              stroke-width="1.5"
                              x1="24"
                              x2="40"
                              y1="46"
                              y2="46"
                            />
                          </svg>
                          <span className="text-[10px] font-bold tracking-widest text-gray-900 uppercase">REPUBLIC OF IRAQ</span>
                          <span className="text-[9px] font-medium tracking-wide text-gray-600">MINISTRY OF EDUCATION</span>
                        </div>
                        {/* English Hierarchy & Official Registry (Left) */}
                        <div
                          className="text-left flex flex-col items-end space-y-1 font-mono text-[11px] leading-tight"
                        >
                          <div className="flex items-center gap-1 font-sans text-[12px] font-bold dir-ltr">
                            <span>No:</span>
                            <span className="font-mono font-bold text-gray-900" id="docSerial">ق/4/1892</span>
                            <span>:العدد</span>
                          </div>
                          <div className="flex items-center gap-1 font-sans text-[11px] dir-ltr text-gray-700">
                            <span>Date:</span>
                            <span id="docDateGreg">14 تشرين الثاني 2024</span>
                            <span>:التاريخ</span>
                          </div>
                          <div className="flex items-center gap-1 font-sans text-[11px] dir-ltr text-gray-700">
                            <span>Hijri:</span>
                            <span id="docDateHijri">12 جمادى الأولى 1446</span>
                            <span>:الموافق</span>
                          </div>
                        </div>
                      </div>
                      {/* Separation Line */}
                      <div className="w-full h-0.5 bg-gray-900 mb-6" />
                      {/* Recipient Header (إلى / ...) */}
                      <div className="mt-4 mb-3 text-right">
                        <span className="text-[17px] font-bold text-gray-950 inline-block" id="docAddressedTo">إلى / مصرف الرافدين - فرع الفردوس (34)</span>
                      </div>
                      {/* Subject (م / ...) */}
                      <div className="mb-6 text-center">
                        <span
                          className="inline-block pb-1 text-[17px] font-bold text-gray-950 underline underline-offset-8 decoration-2"
                        >
                          م / تأييد استمرار بالخدمة
                        </span>
                      </div>
                      {/* Document Official Body */}
                      <div
                        className="text-justify text-[15px] leading-[2.1] text-gray-900 indent-8 mb-8 font-serif antialiased"
                        id="docRenderedBody"
                      >
                        نؤيد لكم بأن السيد
                        <span className="font-bold text-black underline underline-offset-4 decoration-1">أحمد عادل كريم الموسوي</span>
                        ، الحامل للرقم الوطني (
                        <span className="font-mono font-semibold">198421098312</span>
                        )، يعمل بصفة (
                        <span className="font-semibold">مدرس أول لغة عربية</span>
                        ) ضمن ملاك (
                        <span className="font-semibold">إعدادية المنصور المهنية للبنين</span>
                        ) التابعة لمديريتنا، وهو مستمر بالدوام الرسمي والخدمة الفعلية حتى تاريخ صدور هذا الكتاب. وبناءً على طلبه زُوّد بهذا التأييد لتقديمه إلى جهتكم المحترمة لغرض (
                        <span className="font-semibold">ترويج معاملة سلفة شخصية</span>
                        ). دون أن تتحمل مديريتنا أي التزام مالي أو قانوني يترتب على ذلك.
                      </div>
                      {/* Closing Blessing */}
                      <div className="text-center my-6">
                        <span className="text-[15px] font-bold text-gray-900 tracking-wide">... مع فائق الشكر والتقدير</span>
                      </div>
                    </div>
                    {/* Footer Section: Signatures, Seals, Copies, Verification */}
                    <div className="mt-auto pt-6">
                      {/* Signatures and Official Stamp Line */}
                      <div className="flex items-end justify-between px-6 mb-8 relative">
                        {/* Left: Verification Barcode + Security Hash */}
                        <div className="flex flex-col items-center gap-1" id="barcodeContainer">
                          <div className="w-24 h-24 bg-white p-1 shadow-sm flex items-center justify-center">
                            {/* High-Density Official Verification QR Code SVG */}
                            <svg
                              className="w-full h-full text-gray-900"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                d="M2 2h8v8H2V2zm2 2v4h4V4H4zm10-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm14 0h4v2h-4v-2zm-4-2h2v4h-2v-4zm6 6h2v2h-2v-2zm-6 2h4v-2h-4v2zm2-6h2v2h-2v-2zm-2-2h4v2h-4v-2z"
                              />
                            </svg>
                          </div>
                          <span className="font-mono text-[9px] text-gray-500 tracking-tighter">SEC: #8849-IQ-GOV</span>
                        </div>
                        {/* Center: Authentic Blue Ink Administrative Stamp Overlay */}
                        <div
                          className="absolute left-1/2 -translate-x-1/2 bottom-0 pointer-events-none transform rotate-[-8deg] opacity-90 transition-opacity"
                          id="stampWrapper"
                        >
                          <div
                            className="w-36 h-36 rounded-full border-4 border-dashed border-[#0058be] p-1 flex items-center justify-center text-center"
                          >
                            <div
                              className="w-full h-full rounded-full border-2 border-[#0058be] flex flex-col items-center justify-center text-[#0058be] p-1"
                            >
                              <span className="text-[8px] font-bold tracking-tight">جمهورية العراق - وزارة التربية</span>
                              <svg className="w-5 h-5 my-0.5 fill-[#0058be]" viewBox="0 0 24 24">
                                <path d="M12 2L4 5v6c0 5 8 11 8 11s8-6 8-11V5l-8-3z" />
                              </svg>
                              <span className="text-[8px] font-extrabold">المديرية العامة للتربية</span>
                              <span className="text-[7px] font-semibold mt-0.5">قسم الصادرة والواردة 2024</span>
                              <span className="text-[7px] font-mono tracking-widest mt-0.5">AUTHENTICATED</span>
                            </div>
                          </div>
                        </div>
                        {/* Right: Signatory & Executive Endorsement */}
                        <div className="flex flex-col items-center text-center z-10 min-w-[220px]">
                          {/* Digital Autograph Curve */}
                          <div className="h-12 w-40 flex items-center justify-center text-blue-900 mb-1">
                            <svg
                              className="w-full h-full"
                              fill="none"
                              viewBox="0 0 160 50"
                            >
                              <path
                                d="M10 38C25 10 38 45 60 22C75 5 80 48 105 28C125 12 135 42 150 15"
                                stroke="#003d85"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2.2"
                              />
                            </svg>
                          </div>
                          <span className="text-[15px] font-bold text-gray-950" id="docSignerName">د. وسام عبد الحسين الزيدي</span>
                          <span
                            className="text-[12px] font-medium text-gray-700 max-w-[200px] leading-tight"
                            id="docSignerRole"
                          >
                            المدير العام لتربية بغداد / الرصافة الأولى وكالة
                          </span>
                          <span className="text-[11px] font-mono text-gray-500 mt-1" id="docSignDate">14 / 11 / 2024</span>
                        </div>
                      </div>
                      {/* Internal Copies Routing & Official Footer Note */}
                      <div
                        className="pt-4 border-t border-gray-300 text-right text-[11px] text-gray-600 leading-relaxed"
                      >
                        <div className="font-bold text-gray-800 mb-0.5">نسخة منه إلى:</div>
                        <ul className="list-disc list-inside space-y-0.5 text-gray-600">
                          <li>
                            قسم الملاك والملفات الشخصية / للإيداع في إضبارة الموظف السالف ذكره مع الأوليات.
                          </li>
                          <li>
                            إعدادية المنصور المهنية للبنين / للتفضل بالعلم وتوثيق الانفكاك والمباشرة.
                          </li>
                          <li>شعبة التدقيق والرقابة الداخلية / للمتابعة والتدقيق القانوني.</li>
                          <li>الصادرة العامة والواردة / الحفظ الإلكتروني والأرشفة الورقية.</li>
                        </ul>
                        <div className="mt-4 flex items-center justify-between text-[10px] text-gray-400 font-mono">
                          <span>طُبع بواسطة: مُشغّل معتمد 01 (شعبة إصدار التأييدات المركزية)</span>
                          <span>منظومة ديوان 2.4 - التوثيق الإداري الموحد</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
