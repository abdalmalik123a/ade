> انتهى — البديل: docs/LOG.md — الأمر D143 — ٢٣ ت١ ٢٠٢٦
# دفتر التسليم — من قيد «D126 ✅» (٢٠ ت١) إلى قيد «مراجعة D127» (٢٠ ت١)

## ٢٠٢٦-١٠-٢٠ ١١:١٨ — مراجعة D127 (ر166 ر167 ر169) ✓ · النموذج: Gemini 3.8 Flash (High)
- **الحكم:** ✓ (تذييل الورقة عنوان المكتب وهاتفه في المحرّر والترويسة S10 مطابق للكود والقواعد والقالب).
- **مُجرَّب ومن الكود:** `npm run typecheck` نظيف · `tests/letterhead.test.ts` (٦ ✓) · `tests/letterheads.test.ts` (٣٥ ✓) · الحارس: إعادة `letterhead.ts` لما قبل D127 أسقطت ٥ من ٦ اختبارات فورًا واستعادتها أخضرته · بناء `electron-vite build` نظيف (٧٫٣ ث) وسيناريو `letterheadFooter.mjs` (٩ ✓) وسيناريو `letterhead.mjs` (٤٠ ✓) بلا ✗ وظهور التذييل في أسفل الورقة وفي `w:ftr` · `docDocx.ts` (٣٩٧ سطرًا)، `docHtml.ts` (٣٩١)، `letterhead.ts` (٣٥٦)، `LetterheadDesigner.tsx` (٣٢٢) دون سقف ٤٠٠ سطر.
- **الفحص الشامل:** `npx vitest run` كاملًا ٢٠٦٧ ✓ و٤ متخطّاة (٢٠١ ملفًّا) · `tests/docsBudget.test.ts` و`tests/repoHygiene.test.ts` و`tests/lint.test.ts` و`tests/structure.test.ts` (١٨ ✓) بلا أيّ خرق · الشجرة نظيفة وبلا حذف ملفات.
- **الخطوة التالية:** إيداع المراجعة أولاً، ثم حجز وتنفيذ D128 (⚙️ ص: ضبط انتقال ورقة فارغة من الشبّاك ومحليّة إخفاء أسماء الملفّات S16).

## ٢٠٢٦-١٠-٢٠ ١٠:٢٥ — D127 ✅ — تذييل الورقة (عنوان المكتب وهاتفه) في المحرّر والترويسة (S10) · النموذج: Gemini 3.8 Flash (High)
- **ما تغيّر:** `src/shared/letterhead.ts`: إضافة `LetterheadFooter` ودعم حقل `footer` في `LetterheadLayout` وتطبيعه في `normalizeLayout` ودعمه في `isLayoutEmpty` و`layoutText` و`resolveLayout` · `src/renderer/src/components/LetterheadView.tsx`: تصدير `LetterheadFooterView` ودعم خيار `showFooter` · `src/renderer/src/components/LetterSheet.tsx`: إدراج التذييل أسفل الورقة وفي `tfoot` عند تكرار الترويسة · `src/renderer/src/components/letterheadDesigner/FooterOptions.tsx`: لوح إعدادات تفعيل التذييل ونصه وحجمه ومحاذاته وإدراجه في `LetterheadDesigner.tsx` ومعاينته بـ`LetterheadPreview.tsx` · `src/shared/docHtml.ts`: دعم التذييل في `pageCss` للطباعة · `src/main/services/docDocx.ts`: تصدير التذييل في Word بـ`Footer` و`w:ftr` تحت سقف ٤٠٠ سقف · إضافة اختبارات وحدة `tests/letterhead.test.ts` (٦ ✓) وسيناريو `tools/scenarios/letterheadFooter.mjs` (٩ ✓) وتحديث `docs/QUALITY.md` ونقل D127 إلى `done/`.
- **الفحص:** `npm run typecheck` نظيف · `tests/letterhead.test.ts` (٦ ✓) · `tests/letterheads.test.ts` (٣٥ ✓) · فحص النظافة والهيكل وESLint وميزانية الوثائق (١٨ ✓) وجميع الملفات المعدلة دون سقف ٤٠٠ سطر (docDocx ٣٩٦، docHtml ٣٩٠، letterhead ٣٥٥) · بناء `electron-vite build` نظيف وسيناريوهات `letterheadFooter.mjs` (٩ ✓) و`letterhead.mjs` (٤٠ ✓) بلا ✗.
- **التالي:** مراجعة D127 ثم تنفيذ D128 (⚙️ ص: ضبط انتقال ورقة فارغة من الشبّاك ومحليّة إخفاء أسماء الملفّات S16) ضمن حدّ ٤ نقاط للجلسة (D127 ص + D128 ص = نقطتان).

## ٢٠٢٦-١٠-٢٠ ٠٩:٤٦ — مراجعة D126 (ر166 ر167 ر169) ✓ · النموذج: Gemini 3.8 Flash (High)
- **الحكم:** ✓ (تفصيل الدفعة الثالثة من الموجة ٥ D127–D131 مطابق للقالب والوقائع وبلا كود برمجي).
- **مُجرَّب ومن الكود:** الأوامر الخمسة D127–D131 مفصّلة بأقسام القالب وكلّ أمر ٣٤–٣٥ سطرًا (≤ ٨٠ سطرًا) ومطابقة لواقع الكود في `letterhead.ts` و`CounterPick.tsx` و`docPmTable.ts` و`PapersScreen.tsx` و`QuestionNode.tsx` ور157 · فحص الإيداعين `33a508d` و`5d92112`: وثائق وحدها ضمن «المسموح»، بلا حذف ملفات، وبلا مساس بـ `src/` أو `tests/` أو `tools/`.
- **الحارس:** زيادة أسطر أحدث قيد في الدفتر أسقطت `tests/docsBudget.test.ts` فورًا (١ ✗ و٢ ✓) واستعادتها أخضرته (٣ ✓).
- **الفحص:** `npm run typecheck` نظيف · `tests/docsBudget.test.ts` و`tests/repoHygiene.test.ts` و`tests/lint.test.ts` و`tests/structure.test.ts` (١٨ ✓) بلا أيّ خرق · الشجرة نظيفة تمامًا.
- **الخطوة التالية:** إيداع المراجعة أولاً، ثم حجز وتنفيذ أوامر الدفعة: D127 (⚙️ ص) ثم D128 (⚙️ ص) ضمن حدّ ٤ نقاط للجلسة.

## ٢٠٢٦-١٠-٢٠ ٠٩:٢٠ — D126 ✅ — تفصيل الدفعة الثالثة من الموجة ٥ (المحرّر والأسئلة: D127–D131) · النموذج: Gemini 3.8 Flash (High)
- **ما تغيّر:** تفصيل أوامر الدفعة الثالثة من الموجة ٥ المخصصة للمحرّر والأسئلة بالقالب المعتمد: D127 (⚙️ ص: تذييل الورقة عنوان وهاتف المكتب في المحرّر والترويسة S10)، وD128 (⚙️ ص: ضبط انتقال ورقة فارغة من الشبّاك ومحليّة إخفاء أسماء الملفّات S16)، وD129 (⚙️ م: الدمج الرأسيّ لخلايا الجدول في المحرّر S37)، وD130 (⚙️ م: ورقة الأسئلة بالوجهين وترقيم «الصفحة ١ من ٢» S14)، وD131 (⚙️ ص: صورةٌ داخل السؤال في ورقة الأسئلة S15 ر157) · تحديث عمود «الأمر المقرّر» في BACKLOG §٥ · إضافة أسطر الدفعة ⬜ وجعل D126 ✅ في PLAN · نقل D126 إلى done/.
- **وقائع الكود والبحث:** S10: غياب حقل `footer` في `LetterheadLayout` بـ `letterhead.ts` و`LetterheadView.tsx` · S16: عزل نص بحث الشبّاك عن نوع الكتاب في «ورقة فارغة» بـ `CounterPick.tsx` وتثبيت محليّة إخفاء الأسماء في `InboxPanel.tsx` · S37: تعطيل الدمج الرأسي صراحة بشرط `spansMultipleRows` في `docPmTable.ts:43` وخلو `TableCell` من `rowSpan` · S14: حصر `PapersScreen.tsx` في صفحة A4 واحدة وافتقارها لتقسيم الوجهين وترقيم الصفحات · S15: خلو `ListItem` في `docTypes.ts` من حقل الصورة وحاجة الأسئلة لإرفاق رسم توضيحي وفق ر157.
- **الفحص:** الأوامر الخمسة مفصّلة بأقسام القالب ومسارات الكود القائم (≤٤٠ سطرًا لكلّ أمر) · نجاح `docsBudget` و`repoHygiene` · `git diff --stat` وثائق وحدها وبلا مساس بـ `src/` أو `tests/` أو `tools/`.
- **التوقّف:** التوقّف التامّ عند ختام D126 (🧭 وحده، ر162).
- **التالي:** `/next` في محادثة جديدة تبدأ بمراجعة D126 ثم حجز وتنفيذ أول أوامر الدفعة (D127 ⚙️ ص ثم D128 ⚙️ ص ضمن حدّ ٤ نقاط للجلسة).
