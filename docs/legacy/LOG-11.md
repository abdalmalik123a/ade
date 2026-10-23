> انتهى — البديل: docs/LOG.md — الأمر D142 — ٢٣ ت١ ٢٠٢٦
# دفتر التسليم — من قيد «D124 ✅» (٢٠ ت١) إلى قيد «مراجعة D125» (٢٠ ت١)

## ٢٠٢٦-١٠-٢٠ ٠٩:٠٥ — مراجعة D125 (ر166 ر167 ر169) ✓ · النموذج: Gemini 3.8 Flash (High)
- **الحكم:** ✓ (تظليل صفّ العناوين ومحاذاة الخليّة عموديًّا في جداول المحرّر S12 مطابق للكود والقواعد والقالب).
- **مُجرَّب ومن الكود:** `npm run typecheck` نظيف · `tests/docPmTable.test.ts` (٢٠ ✓) · الحارس: تعطيل `toggleHeaderShading` أسقط الاختبار فورًا (١ ✗ و١٩ ✓) واستعادته أخضرته · بناء `electron-vite build` نظيف (١٠٫٧ ث) وسيناريو `tableAlign.mjs` (٧ ✓) وسيناريو `paragraphSpacing.mjs` (٦ ✓) بلا ✗ · `docDocx.ts` (٣٩٨ سطرًا) و`docHtml.ts` (٣٩٠ سطرًا) دون سقف ٤٠٠ سطر.
- **الفحص الشامل:** `npx vitest run` كاملًا ٢٠٦١ ✓ و٤ متخطّاة (١٩٦ ملفًّا) · `tests/docsBudget.test.ts` و`tests/repoHygiene.test.ts` و`tests/lint.test.ts` و`tests/structure.test.ts` (١٨ ✓) بلا أيّ خرق · الشجرة نظيفة.
- **الخطوة التالية:** إيداع المراجعة أولاً، ثم تخطيط الدفعة التالية من الموجة ٥ (الموجة ٥: المحرّر وباقي بنوده S10 وS14 وS15 وS16 أو حسب الأولويات في BACKLOG §٥) بأمر تخطيط 🧭.

## ٢٠٢٦-١٠-٢٠ ٠٨:٥٥ — D125 ✅ — تظليل صفّ العناوين ومحاذاة الخليّة عموديًّا في جداول المحرّر (S12) · النموذج: Gemini 3.8 Flash (High)
- **ما تغيّر:** `src/shared/docTypes.ts`: دعم `vAlign` في `TableCell` و`headerShading` في `TableBlock` · `src/shared/docPmSchema.ts` و`src/shared/docPm.ts`: تمرير وحفظ `vAlign` و`headerShading` في كتل ProseMirror وعقدها وقراءة/كتابة خصائص DOM · `src/shared/docPmTable.ts`: إضافة أمرين `toggleHeaderShading` و`setCellVAlign` وتحديث `tableState` · `src/renderer/src/components/pageEditor/FormatBar.tsx`: إضافة أزرار تظليل الرأس والمحاذاة العمودية (أعلى، وسط، أسفل) · `src/renderer/src/components/pageViews.ts` و`styles.css`: تطبيق فئة `pm-header-shading` ولون التظليل `#f1f5f9` في المحرّر · `src/shared/docHtml.ts` و`src/main/services/docDocx.ts`: تصدير التظليل والمحاذاة العمودية للطباعة وWord بـ`w:shd` و`w:vAlign` · إضافة اختبارات في `tests/docPmTable.test.ts` (٢٠ ✓) وسيناريو `tools/scenarios/tableAlign.mjs` (٧ ✓) وتحديث `docs/QUALITY.md` ونقل D125 إلى `done/`.
- **الفحص:** `npm run typecheck` نظيف · `tests/docPmTable.test.ts` (٢٠ ✓) · فحص النظافة والهيكل وESLint وميزانية الوثائق (١٨ ✓) والملفات المعدّلة دون سقف ٤٠٠ سطر (docHtml ٣٩٠، docDocx ٣٩٨) · بناء `electron-vite build` نظيف (٧٫٥ ث) وسيناريوهات `tableAlign.mjs` (٧ ✓) و`paragraphSpacing.mjs` (٦ ✓) بلا ✗.
- **الختام والتالي:** اكتمال الدفعة الثانية من الموجة ٥ (D121–D125) · المراجعة الخطوة ٢ بـ`/next` بمحادثة جديدة لـD125 (ر167 ر169) ثم تخطيط الدفعة التالية.

## ٢٠٢٦-١٠-٢٠ ٠٨:٣٥ — مراجعة D124 (ر166 ر167 ر169) ✓ · النموذج: Gemini 3.8 Flash (High)
- **الحكم:** ✓ (تباعد الفقرات قبل وبعد في شريط المحرّر S11 مطابق للكود والقواعد والقالب).
- **مُجرَّب ومن الكود:** `npm run typecheck` نظيف · `tests/docPm.test.ts` (٢١ ✓) · الحارس: تعطيل `setSpaceAfter` أسقط الاختبار فورًا (١ ✗ و٢٠ ✓) واستعادته أخضرته · بناء `electron-vite build` نظيف (٨٫٥ ث) وسيناريو `paragraphSpacing.mjs` (٦ ✓) وسيناريو `customPaper.mjs` (١١ ✓) بلا ✗ · `FormatBar.tsx` (٢١٤ سطرًا) و`commands.ts` (٢١٤ سطرًا) دون سقف ٤٠٠ سطر.
- **الفحص الشامل:** `npx vitest run` كاملًا ٢٠٥٦ ✓ و٤ متخطّاة (١٩٦ ملفًّا) · `tests/docsBudget.test.ts` و`tests/repoHygiene.test.ts` و`tests/lint.test.ts` و`tests/structure.test.ts` (١٨ ✓) بلا أيّ خرق · الشجرة نظيفة.
- **الخطوة التالية:** إيداع المراجعة أولاً، ثم حجز وتنفيذ D125 (⚙️ ص: تظليل صفّ العناوين ومحاذاة الخليّة عموديًّا في جداول المحرّر S12).

## ٢٠٢٦-١٠-٢٠ ٠٨:١٠ — D124 ✅ — تباعد الفقرات قبل وبعد في شريط المحرّر (S11) · النموذج: Gemini 3.8 Flash (High)
- **ما تغيّر:** `src/renderer/src/components/pageEditor/commands.ts`: توسيع `setParagraphAttr` ليشمل `'spaceAfter'` وتصدير `setSpaceAfter` وثابت خيارات التباعد `SPACE_AFTERS = [0, 6, 12, 18]` · `src/renderer/src/components/pageEditor/FormatBar.tsx`: إضافة أداة تباعد ما بعد الفقرة برمز `format_line_spacing` وقائمة سريعة `data-act="paragraph-spacing"` مرتبطة بالفقرة المحددة وقراءة `paragraphValue(state, 'spaceAfter')` · إضافة اختبارات في `tests/docPm.test.ts` (٢١ ✓) وسيناريو `tools/scenarios/paragraphSpacing.mjs` (٦ ✓) وتحديث `docs/QUALITY.md` ونقل D124 إلى `done/`.
- **الفحص:** `npm run typecheck` نظيف · `tests/docPm.test.ts` (٢١ ✓) · فحص النظافة والهيكل وESLint وميزانية الوثائق (٣٩ ✓) و`commands.ts` ٢١٤ سطرًا و`FormatBar.tsx` ٢١٤ سطرًا (< ٤٠٠) · بناء `electron-vite build` نظيف وسيناريوهات `paragraphSpacing.mjs` (٦ ✓) و`customPaper.mjs` (١١ ✓) بلا ✗.
- **التالي:** D125 (⚙️ ص: تظليل صفّ العناوين ومحاذاة الخليّة عموديًّا في جداول المحرّر S12) بمحادثة جديدة بـ`/next` تبدأ بمراجعة D124.
