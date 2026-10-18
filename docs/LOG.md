# دفتر التسليم

> قيدٌ لكلّ جلسة، **الأحدث في الأعلى**، عشرة أسطر على الأكثر: التاريخ والساعة · الأمر · ما تغيّر (الإيداعات) · الفحص ونتيجته ·
> المراجعة (أيّ أمرٍ رُوجع وبأيّ نتيجة) · أين توقّف بالضبط · الخطوة التالية.
>
> الأقدم في `docs/legacy/LOG-*.md` (يُبحث فيه بـGrep). وحين يزيد الدفتر على ١٠٠ ك.ب ينقل الأمر الخاتم أقدم قيوده بنصّها — إلا قيود ما لم يُراجَع —
> إلى `docs/legacy/LOG-<التالي>.md` (يحرسه `tests/docsBudget.test.ts`).

## ٢٠٢٦-١٠-١٩ ٠٢:٠٣ — مراجعة D90 ✓ · وحجز D91 🔒 · النموذج: Gemini 4 Argon (Medium)
- **D90 بـ«كيف يُراجَع»:** `verbatim.cjs 359103d` ← «ضاع 0 · جديد 0» · `git show --stat c03c400` الملفّان وحدهما · `export` في `imageFormDoc.ts` ٢ · `inventory.cjs` ← «دورات القيم: 0» · و`structure.allow.json` بلا `src/shared/imageForm.ts`. ✓
- **تحقّق D91 قبل البدء:** `paperDoc.ts` ٤٤٧ وسقفه ٤٤٧ · `inventory.cjs` ← «مكوّنات 1 أكبرها 367» و«دورات القيم: 0» · لا `paperLines.ts`. ✓

## ٢٠٢٦-١٠-١٩ ٠٢:٠٢ — D90 ✅ — A11 (١٣): `shared/imageForm.ts` ٤٤٧ ← ٣٦٦ نقلًا حرفيًّا، ووثيقة الاستمارة وقيمها في `imageFormDoc.ts` · النموذج: Gemini 4 Argon (Medium)
- **النقل** (`c03c400`): `move.cjs` (`tsconfig.web.json`، و`fromSrc` لنوع `FormSlot`) ← الثلاثة (`PT_PER_MM` `imageFormDoc` `formValues`) بتعليقاتها إلى `imageFormDoc.ts` ٨٨ · وبـEdit: بابٌ في `imageForm.ts` يعيد تصدير `imageFormDoc` و`formValues`، و`PT_PER_MM` بلا `export` (فالمصدَّر منه ٢) · `prune.cjs` نظّف ٣ استيرادات من `imageForm.ts` · `typecheck` نظيف · والسقف (`600fd14`): `RATCHET` فسقط `imageForm.ts` من `structure.allow.json`.
- **الوثائق** (`1d64c56`): ARCHITECTURE §١ (بقي اثنان) و§٢ (الجدول #١٤ ← D90 بأرقامه، وسطر الأوامر D90 ✅، والاثنان الباقيان لـD91–D92) · BACKLOG A11 (الثلاثة عشر ✅، والاثنان لـD91–D92).
- **الفحص:** الحرفيّة `verbatim.cjs 359103d` ← «ضاع 0 · جديد 0» · `git show --stat c03c400` الملفّان وحدهما · المصدَّر من `imageFormDoc` ٢، ومن `imageForm` ٨ قبل وبعد · LF كما كان، ولا بايت تحكّم · `inventory.cjs` ← ملفّان بلا `imageForm.ts` و«دورات القيم: 0» · `structure` ١٠ ✓ · `docsBudget` `repoHygiene` ٧ ✓ · `npx vitest run` كاملًا **١٩٧٧ ✓** و٤ متخطّاة (١٨٧ ملفًّا) ولقطات الرسّام كما هي · `npx electron-vite build` ثم `imageForm` ٩ ✓ بلا ✗.
- **التالي:** مراجعة D90 بـ«كيف يُراجَع» ثم D91 (م، وبه تتمّ النقاط الأربع).

## ٢٠٢٦-١٠-١٩ ٠١:٥٥ — مراجعة D89 ✓ · وحجز D90 🔒 · النموذج: Gemini 4 Argon (Medium)
- **رسالة المالك:** `/next`.
- **D89 بـ«كيف يُراجَع»:** `verbatim.cjs 9cd7cc0` ← «ضاع 0 · جديد 0» · `git show --stat 38e6fd8` الملفّان وحدهما · `export` في `qrCodewords.ts` ٦ · `inventory.cjs` ← «دورات القيم: 0» · و`structure.allow.json` بلا `src/shared/qr.ts`. ✓
- **تحقّق D90 قبل البدء:** `imageForm.ts` ٤٤٧ وسقفه ٤٤٧ · `inventory.cjs` ← «مكوّنات 3 أكبرها 316» و«دورات القيم: 0» · لا `imageFormDoc.ts` · والثلاثة (`PT_PER_MM` `imageFormDoc` `formValues`) متتاليةٌ في آخر `imageForm.ts` بعد `assignKeys`. ✓

## ٢٠٢٦-١٠-١٩ ٠١:٤٥ — D89 ✅ — A11 (١٢): `shared/qr.ts` ٤٦٣ ← ٣١٣ نقلًا حرفيًّا، وحقل غالوا وريد-سولومون وكلمات الرمز في `qrCodewords.ts` · والتوقّف هنا (٤ نقاط، ر162) · النموذج: Gemini 4 Argon (Medium)
- **النقل** (`38e6fd8`): `move.cjs` (`tsconfig.web.json`، بلا `fromSrc`) ← الأحد عشر تصريحًا بتعليقاتها إلى `qrCodewords.ts` ١٥٧ · وبـEdit: كتلة تهيئة `EXP` و`LOG` (١٠ أسطرٍ من `{` إلى `}`) نُقلت من `qr.ts` إلى موضعها بعد `const LOG` في `qrCodewords.ts`، وبابٌ للخمسة المصدَّرة (`gfMul` `reedSolomon` `pickVersion` `buildCodewords` `blockLayout`)، والخمسة غير المصدَّرة بلا `export` (فالمصدَّر منه ٦) · `prune.cjs` نظّف `EXP` و`LOG` من استيراد `qr.ts` · `typecheck` نظيف · والسقف (`afe26e1`): `RATCHET` فسقط `qr.ts` من `structure.allow.json`.
- **الوثائق** (`2287063`): ARCHITECTURE §١ (بقي ثلاثة) و§٢ (الجدول #١٣ ← D89 بأرقامه، وسطر الأوامر D89 ✅، والثلاثة الباقية لـD90–D92) · BACKLOG A11 (الاثنا عشر ✅، والثلاثة لـD90–D92).
- **الفحص:** الحرفيّة `verbatim.cjs 9cd7cc0` ← «ضاع 0 · جديد 0» · `git show --stat 38e6fd8` الملفّان وحدهما · المصدَّر من `qrCodewords` ٦، ومن `qr` ١٣ قبل وبعد · LF كما كان، ولا بايت تحكّم · `inventory.cjs` ← ثلاثة ملفّات بلا `qr.ts` و«دورات القيم: 0» · `structure` ١٠ ✓ · `docsBudget` `repoHygiene` ٧ ✓ · `npx vitest run` كاملًا **١٩٧٧ ✓** و٤ متخطّاة (١٨٧ ملفًّا) ولقطات الرسّام كما هي · `npx electron-vite build` ثم `designs` ١٧٥ ✓ و`issue` ١٠٤ ✓ بلا ✗.
- **كيف يُراجَع:** «كيف يُراجَع» في أمره، ومرجع الحرفيّة `9cd7cc0` ← «ضاع 0 · جديد 0». **التالي:** `/next` يراجع D89 ثم يأخذ D90 وD91 (م + م = ٤ نقاط، ر162).

## ٢٠٢٦-١٠-١٩ ٠١:٣٦ — مراجعة D88 ✓ · وحجز D89 🔒 · النموذج: Gemini 4 Argon (Medium)
- **D88 بـ«كيف يُراجَع»:** `verbatim.cjs 4b45e4c` ← «ضاع 0 · جديد 0» · `git show --stat 8d6adec` الملفّات الخمسة وحدها · `export` في `quadDetect.ts` ١ · `inventory.cjs` ← «دورات القيم: 0» · و`structure.allow.json` بلا `src/shared/deskew.ts`. ✓
- **تحقّق D89 قبل البدء:** `qr.ts` ٤٦٣ وسقفه ٤٦٣ · `inventory.cjs` ← «مكوّنات 1 أكبرها 425» و«دورات القيم: 0» · لا `qrCodewords.ts` · وكتلة التهيئة (١٠ أسطرٍ من `{` إلى `}`) بين `const LOG = new Uint8Array(256);` (٧٣) و`export function gfMul` (٨٥). ✓

## ٢٠٢٦-١٠-١٩ ٠١:٣٥ — D88 ✅ — A11 (١١): `shared/deskew.ts` ٤٦٧ ← ٣٢٦ نقلًا حرفيًّا، وكشف الأركان في `quadDetect.ts` · النموذج: Gemini 4 Argon (Medium)
- **النقل** (`8d6adec`): `move.cjs` (`tsconfig.web.json`، و`fromSrc` لنوعَي `Quad` `PixelData`) ← `detectQuad` بتعليقه وسطر قسمه إلى `quadDetect.ts` ١٤٥ بلا باب · وتحديث مستورديه الثلاثة (`deskewSteps.ts` و`paperRules.ts` و`tests/deskew.test.ts`) · `prune.cjs` · `typecheck` نظيف · والسقف (`f75517b`): `RATCHET` فسقط `deskew.ts` من `structure.allow.json`.
- **الوثائق** (`d0850da`): ARCHITECTURE §١ (بقي أربعة) و§٢ (الجدول #١٢ ← D88 بأرقامه، وسطر الأوامر D88 ✅، والأربعة الباقية لـD89–D92) · BACKLOG A11 (الأحد عشر ✅، والأربعة لـD89–D92).
- **الفحص:** الحرفيّة `verbatim.cjs 4b45e4c` ← «ضاع 0 · جديد 0» · `git show --stat 8d6adec` الملفّات الخمسة وحدها · المصدَّر من `quadDetect` ١ · LF كما كان، ولا بايت تحكّم · `inventory.cjs` ← أربعة ملفّات بلا `deskew.ts` و«دورات القيم: 0» · `structure` ١٠ ✓ · `docsBudget` `repoHygiene` ٧ ✓ · `npx vitest run` كاملًا **١٩٧٧ ✓** و٤ متخطّاة (١٨٧ ملفًّا) ولقطات الرسّام كما هي · `npx electron-vite build` ثم `idTools` ٢٠ ✓ و`paperPhoto` ١٨ ✓ بلا ✗.
- **التالي:** مراجعة D88 بـ«كيف يُراجَع» ثم D89 (م، وبه تتمّ النقاط الأربع).

## ٢٠٢٦-١٠-١٩ ٠١:٢٤ — مراجعة D87 ✓ · وحجز D88 🔒 · النموذج: Gemini 4 Argon (Medium)
- **رسالة المالك:** `/next`.
- **D87 بـ«كيف يُراجَع»:** قُرئت D88–D92: الأسماء الثلاثة والثلاثون كلّها تصريحاتٌ عليا في ملفّاتها (`missing: 0`) · كلّ أمرٍ ⚙️ م يُنفَّذ بـ`move.cjs` و`prune.cjs` وEdit بلا سؤالٍ ولا أداةٍ جديدة · وفرز A13 (الستّة الباقية) وA14 (الأربعة الباقية) في `BACKLOG.md` مطابقٌ لمواضعه في الكود (`render.ts:87` `psd.ts:72` `docHtml.ts:246` `designs.ts:107` `issue.ts:37` `errorLog.ts:29`). ✓
- **تحقّق D88 قبل البدء:** `deskew.ts` ٤٦٧ وسقفه ٤٦٧ · `inventory.cjs` ← «مكوّنات 5 أكبرها 180» و«دورات القيم: 0» · لا `quadDetect.ts` · ومستوردو `detectQuad` الثلاثة (`deskewSteps.ts` و`paperRules.ts` و`tests/deskew.test.ts`) وحدها. ✓

## ٢٠٢٦-١٠-١٩ ٠١:١٠ — D87 ✅ — تفصيل الخمسة الباقية من A11 (D88–D92) وفرز A13 وA14 وسطر D93 🧭 · والتوقّف هنا (🧭 وحده، ر162) · النموذج: Gemini 4 Argon (Medium)
- **محاكاة النقل بـ`move.cjs` على الخمسة الباقية من A11 (#١٢–#١٦ في ARCHITECTURE §٢):** D88 (`deskew.ts` ٤٦٧ ← ٣٢٦ و`quadDetect.ts` ١٤٥ بلا باب و`fromSrc` لـ`Quad` و`PixelData` ومستوردوه الثلاثة) · D89 (`qr.ts` ٤٦٣ ← ٣١٣ و`qrCodewords.ts` ١٥٧ بأحد عشر اسمًا وكتلة تهيئة `EXP`/`LOG` العشر وبابٍ لخمسةٍ والمصدَّر ٦) · D90 (`imageForm.ts` ٤٤٧ ← ٣٦٦ و`imageFormDoc.ts` ٨٨ بثلاثة أسماء و`fromSrc` لـ`FormSlot` وبابٍ والمصدَّر ٢) · D91 (`paperDoc.ts` ٤٤٧ ← ٣٣٤ و`paperLines.ts` ١٢٧ بسبعة عشر اسمًا وبابٍ للأنواع الأربعة والمصدَّر ١٣) · D92 (`importFolder.ts` ٤١٨ ← ٣٤٨ و`importApply.ts` ٨١ بـ`applyImportPlan` وتعليقه بلا باب ومستورديه الاثنين، وبه يفرغ `structure.allow.json` ويُغلق A11).
- **فرز A13 وA14 بأمر بحثٍ لكلّ بند (في `D87.md` و`BACKLOG.md`):** A13 أُغلق منه دورتا الاستيراد (D77 وD81) وحزم exceljs (D74) وADF في E07، وبقي لـD93 ستّ صغائر (`printToPDF` يمرّر ميكرونات `pageSizeOf` · `PSB` في `psd.ts:72` يقبل ٢ بأطوال ٤/٢ · `repeat` في `GroupBlock` · `"engines"` و`.nvmrc` · «إن لم يُفتح البرنامج» في `INSTALL.md` · الوصول بلوحة المفاتيح `focus-visible`/`role="dialog"`). وA14 أُغلق منه إيداعات المثبّت (`v1.8.0`) والوثائق و`eslint-disable` و`fee` والترقيات الكسولة والمسارات و`RENEW_WARN_DAYS` (`Header` و`LicenseCard`) و`machineIdCache` (`guid` وحده)، وبقي لـD93 أربعٌ (`forgetGeminiKey` · `f.required` في `issue.ts` · `quick_check` عند الإقلاع · رقم الإصدار في `errorLog.ts`).
- **الأوامر واللوحة:** `docs/orders/done/D87.md` (٤٦ سطرًا) و`docs/orders/D88.md`–`D92.md` (٤٦–٥٢ سطرًا، كلٌّ ⚙️ م) · نقل المراجَعة D76 وD82–D86 بنصّها إلى `docs/legacy/PLAN-3.md` (ر162) · وسطر D93 🧭 بعد D92.
- **الفحص:** الأسماء الثلاثة والثلاثون كلّها موجودةٌ في أصولها بالمُحلِّل (`missing: 0`) · الأوامر الستّة ≤ ٨٠ سطرًا · لا بايت تحكّم · `docsBudget` ٣ ✓ و`repoHygiene` ٤ ✓ · والتغييرات في `docs/` وحدها. **التالي:** `/next` يراجع D87 (وA13/A14 في BACKLOG) ثم يأخذ D88 وD89 (م + م = ٤ نقاط، ر162).

## ٢٠٢٦-١٠-١٩ ٠٠:٥٢ — مراجعة D86 ✓ · وحجز D87 🔒 · النموذج: Gemini 4 Argon (Medium)
- **رسالة المالك:** `/next`.
- **D86 بـ«كيف يُراجَع»:** `verbatim.cjs e94b1ca` ← «ضاع 0 · جديد 0» · `git show --stat 5dd760f` الملفّان وحدهما · `export` في `fieldWords.ts` ١٣ · `inventory.cjs` ← خمسة ملفّات و«دورات القيم: 0» · و`structure.allow.json` بلا `src/shared/fieldHints.ts`. ✓
- **تحقّق D87 قبل البدء:** D86 ✅ ومُراجَع · `inventory.cjs` ← الخمسة الباقية (`importFolder.ts` ٤١٨ و`deskew.ts` ٤٦٧ و`imageForm.ts` ٤٤٧ و`paperDoc.ts` ٤٤٧ و`qr.ts` ٤٦٣) و«دورات القيم: 0» · لا نصّ لـD88 فما بعد. ✓

## ٢٠٢٦-١٠-١٩ ٠٠:٤٨ — D86 ✅ — A11 (١٠): `shared/fieldHints.ts` ٥١٩ ← ٣٧١ نقلًا حرفيًّا، وألفاظ الكشف والصياغة مع الجنس في `fieldWords.ts` · والتوقّف هنا (التالي D87 🧭 وحده، ر162) · النموذج: Gemini 4 Argon (Medium)
- **النقل** (`5dd760f`): `move.cjs` (`tsconfig.web.json`، بلا `fromSrc`) ← الخمسة والعشرون بتعليقاتها وأسطر أقسامها إلى `fieldWords.ts` ١٦٧ · وفي الأصل بعد سطر `./gender` وما وضعه `move.cjs` بابٌ لـ`wrongGenderWords` · والاثنا عشر غير المصدَّرة بلا `export` (فالمصدَّر منه ١٣) · `prune.cjs` نظّف `guessGender` من `fieldHints.ts` · `typecheck` نظيف · والسقف (`dfd3a6b`): `RATCHET` فسقط `fieldHints.ts` من `structure.allow.json`.
- **الوثائق** (`91648a0`): ARCHITECTURE §١ (بقي خمسة) و§٢ (الجدول #١١ ← D86 بأرقامه، وسطر الأوامر D86 ✅، والخمسة الباقية لـD87) · BACKLOG A11 (العشرة ✅، والخمسة لـD87).
- **الفحص:** الحرفيّة `verbatim.cjs e94b1ca` ← «ضاع 0 · جديد 0» · `git show --stat 5dd760f` الملفّان وحدهما · المصدَّر من `fieldWords` ١٣، ومن `fieldHints` خمسة قبل وبعد · LF كما كان، ولا بايت تحكّم · `inventory.cjs` ← خمسة ملفّات بلا `fieldHints.ts` و«دورات القيم: 0» · `structure` ١٠ ✓ · `docsBudget` `repoHygiene` ٧ ✓ · `npx vitest run` كاملًا **١٩٧٧ ✓** و٤ متخطّاة (١٨٧ ملفًّا) ولقطات الرسّام كما هي · `npx electron-vite build` ثم `wordHints` ٢٢ ✓ و`importFolder` ٣٤ ✓ بلا ✗.
- **كيف يُراجَع:** «كيف يُراجَع» في أمره، ومرجع الحرفيّة `e94b1ca` ← «ضاع 0 · جديد 0». **التالي:** `/next` يراجع D86 ثم يأخذ D87 🧭 (وحده بحكم ر162).

## ٢٠٢٦-١٠-١٩ ٠٠:٣٨ — مراجعة D85 ✓ · وحجز D86 🔒 · النموذج: Gemini 4 Argon (Medium)
- **رسالة المالك:** `/next`.
- **D85 بـ«كيف يُراجَع»:** `verbatim.cjs b6b06c8` ← «ضاع 6 · جديد 0» (`emptyLayout` `newId` `Align` `ColumnCount` `LetterheadBlock` `LetterheadLayout` من استيراد `@shared/letterhead` الممتدّ كما في القيد) · `git show --stat be71dfb` الملفّان وحدهما · الرأس في `import.ts` بعد استيراداته وليس في `importLayout.ts` · `inventory.cjs` ← «دورات القيم: 0» · و`structure.allow.json` بلا `src/main/services/import.ts`. ✓
- **تحقّق D86 قبل البدء:** `fieldHints.ts` ٥١٩ وسقفه ٥١٩ · «مكوّنات 1 أكبرها 443» · لا `fieldWords.ts`. ✓

## ٢٠٢٦-١٠-١٩ ٠٠:٣٤ — D85 ✅ — A11 (٩): `services/import.ts` ٥٥١ ← ٢٥٤ نقلًا حرفيًّا، والفقرات والترويسة وتخطيطها في `importLayout.ts` · والتوقّف هنا (٤ نقاط، ر162) · النموذج: Gemini 4 Argon (Medium)
- **النقل** (`be71dfb`): `move.cjs` (`tsconfig.node.json`، بلا `fromSrc`) ← الستّة عشر بتعليقاتها إلى `importLayout.ts` ٢٩٩ · وبـEdit: الرأس (١٢ سطرًا) أُعيد من أعلى `importLayout.ts` إلى `import.ts` بعد استيراداته كما كان، وبابٌ لـ`ImageSaver`، والتسعة غير المصدَّرة بلا `export` (فالمصدَّر منه ٧) · `prune.cjs` وحذف بقيّة استيراد `@shared/letterhead` الممتدّ غير المستعمَل في `import.ts` · `typecheck` نظيف · والسقف (`a070394`): `RATCHET` فسقط `import.ts` من `structure.allow.json`.
- **الوثائق** (`3e38e26`): ARCHITECTURE §١ (بقي ستّة) و§٢ (الجدول #١٠ ← D85 بأرقامه، وسطر الأوامر D85 ✅) · BACKLOG A11 (التسعة ✅، والستّة: D86 ثم D87).
- **الفحص:** الحرفيّة `verbatim.cjs b6b06c8` ← «ضاع 6 · جديد 0» (`emptyLayout` `newId` `Align` `ColumnCount` `LetterheadBlock` `LetterheadLayout` من استيراد `@shared/letterhead` الممتدّ) · `git show --stat be71dfb` الملفّان وحدهما · `git diff b6b06c8 -- src/main/services/import.ts` لا يمسّ أسطر الرأس · المصدَّر من `importLayout` ٧، ومن `import` أربعة قبل وبعد · CRLF كما كان، ولا بايت تحكّم · `inventory.cjs` ← ستّة ملفّات بلا `import.ts` و«دورات القيم: 0» · `structure` ١٠ ✓ · `docsBudget` `repoHygiene` ٧ ✓ · `npx vitest run` كاملًا **١٩٧٧ ✓** و٤ متخطّاة (١٨٧ ملفًّا) ولقطات الرسّام كما هي · `npx electron-vite build` ثم `import` ٣٣ ✓ و`importFolder` ٣٤ ✓ و`inbox` ١٠ ✓ بلا ✗.
- **كيف يُراجَع:** «كيف يُراجَع» في أمره، ومرجع الحرفيّة `b6b06c8` ← «ضاع 6 · جديد 0» (الأسماء أعلاه). **التالي:** `/next` يراجع D85 ثم يأخذ D86 (م، نقطتان؛ وD87 🧭 بعده وحده بحكم ر162).

## ٢٠٢٦-١٠-١٩ ٠٠:٢٤ — مراجعة D84 ✓ · وحجز D85 🔒 · النموذج: Gemini 4 Argon (Medium)
- **D84 بـ«كيف يُراجَع»:** `verbatim.cjs aebaf68` ← «ضاع 0 · جديد 0» · `git show --stat e140ab4` الملفّان وحدهما · `export` في `blankText.ts` ٩ · `inventory.cjs` ← «دورات القيم: 0» · و`structure.allow.json` بلا `src/shared/blanks.ts`. ✓
- **تحقّق D85 قبل البدء:** `import.ts` ٥٥١ وسقفه ٥٥٣ · «مكوّنات 1 أكبرها 499» · لا `importLayout.ts` · والرأس سطوره الاثنا عشر بين `} from '@shared/letterhead';` و`const decodeEntities`. ✓

## ٢٠٢٦-١٠-١٩ ٠٠:٢٢ — D84 ✅ — A11 (٨): `shared/blanks.ts` ٦٥٨ ← ٣٦٦ نقلًا حرفيًّا، وتنظيف السطر وتسمية الخانة في `blankText.ts` · النموذج: Gemini 4 Argon (Medium)
- **النقل** (`e140ab4`): `move.cjs` (`tsconfig.web.json`، بلا `fromSrc`) ← الأربعة والعشرون بتعليقاتها وأسطر أقسامها إلى `blankText.ts` ٣٠٨ · وفي الأصل بعد سطر `Confidence, Suggestion` بابٌ واحد للتسعة المصدَّرة · والخمسة عشر غير المصدَّرة بلا `export` (فالمصدَّر منه ٩) · `prune.cjs` · `typecheck` نظيف · والسقف (`6e9ee64`): `RATCHET` فسقط `blanks.ts` من `structure.allow.json`.
- **الوثائق** (`af9294c`): ARCHITECTURE §١ (بقي سبعة) و§٢ (الجدول #٩ ← D84 بأرقامه، وسطر الأوامر D84 ✅) · BACKLOG A11 (الثمانية ✅، والسبعة: D85–D86 ثم D87).
- **الفحص:** الحرفيّة `verbatim.cjs aebaf68` ← «ضاع 0 · جديد 0» · `git show --stat e140ab4` الملفّان وحدهما · المصدَّر من `blankText` ٩، ومن `blanks` ٢١ قبل وبعد · LF كما كان، ولا بايت تحكّم · `inventory.cjs` ← سبعة ملفّات بلا `blanks.ts` و«دورات القيم: 0» · `structure` ١٠ ✓ · `docsBudget` `repoHygiene` ٧ ✓ · `npx vitest run` كاملًا **١٩٧٧ ✓** و٤ متخطّاة (١٨٧ ملفًّا) ولقطات الرسّام كما هي · `npx electron-vite build` ثم `import` ٣٣ ✓ و`wordHints` ٢٢ ✓ و`imageForm` ٩ ✓ بلا ✗.
- **التالي:** مراجعة D84 بـ«كيف يُراجَع» ثم D85 (م، وبه تتمّ النقاط الأربع).

## ٢٠٢٦-١٠-١٩ ٠٠:١٣ — مراجعة D83 ✓ · وحجز D84 🔒 · النموذج: Gemini 4 Argon (Medium)
- **رسالة المالك:** `/next`.
- **D83 بـ«كيف يُراجَع»:** `verbatim.cjs f1cafc7` ← «ضاع 6 · جديد 0» (`fieldRef` `makeField` `Doc` `DocField` `Inline` `Marks` من استيراد `@shared/doc` الممتدّ كما في القيد) · `git show --stat c7f6b1d` الملفّان وحدهما · `export` في `excelCells.ts` ٢٠ · `inventory.cjs` ← «دورات القيم: 0» · و`structure.allow.json` بلا `excelDoc.ts`. ✓
- **تحقّق D84 قبل البدء:** `blanks.ts` ٦٥٨ وسقفه ٦٥٨ · «مكوّنات 4 أكبرها 538» · لا `blankText.ts` · و`services/blanks.ts` بابٌ بـ`export * from '@shared/blanks'`. ✓

## ٢٠٢٦-١٠-١٩ ٠٠:١٠ — ر163 (تعديل): ترحيل `/next` في Antigravity من مسار عمل إلى مهارة · النموذج: Gemini (Antigravity)
- **ما تغيّر:** إنشاء `.agents/skills/next/SKILL.md` بالإحالة نفسها إلى `.claude/commands/next.md` · نقل `.agents/workflows/next.md` بـ`git mv` إلى `legacy/.agents/workflows/next.md` مع سطر «انتهى — البديل …» · تحديث ذكر المسار في `AGENTS.md` وفي سطر ر163 من `docs/DECISIONS.md` («عُدّل ١٩ ت١: مسار العمل صار مهارة»).
- **الفحص:** `npx vitest run tests/docsBudget.test.ts tests/repoHygiene.test.ts tests/agyHook.test.ts` ← ٣ ملفّات (١٢ اختبارًا) ✓ · وحارس Antigravity شغّال قبل كلّ أداة في هذه الجلسة.
- **التالي:** `/next` في جلسةٍ جديدة (مراجعة D83 ثم D84 وD85).

## ٢٠٢٦-١٠-١٨ ٢٣:٥٣ — ر163 ✅: حارس Antigravity يُصلَح مساره، واختباره ووثائقه · وتبقى تجربة المالك الثانية
- **تجربة المالك في Antigravity** (نقلها نصًّا): طلب قراءة الدفتر كلّه فمُنعت — لكن لأنّ الخطاف بحث عن `.agents/tools/hooks/agy.mjs` فخرج بـ`MODULE_NOT_FOUND`، فأوقف كلّ أداة:
  Antigravity يشغّل أمر `hooks.json` من مجلّد `.agents/`، وخطافٌ يخرج بخطأ يوقف الأداة هناك (لا يمرّرها).
- **الإصلاح:** الأمر `node ../tools/hooks/agy.mjs`، ورأس `agy.mjs` يقول لماذا · **والاختبار** `tests/agyHook.test.ts` (٥): الترجمة، وممنوعات الحارس نفسها و`force_ask`، والدفتر بمداه،
  وفحص ما قبل الإيداع، وتشغيل الأمر كما في `hooks.json` من مجلّد `.agents/` (JSON دائمًا، و`allow` للمدخل الفاسد) · **والوثائق:** QUALITY §٨ (سطر Antigravity) · DECISIONS ر163.
- **الفحص:** `agyHook` ٥ ✓ و`guardHook` ١٣ ✓ · `npm run typecheck` · `docsBudget` `repoHygiene` ✓ (في الإيداع).
- **التالي:** المالك يعيد التجربة في Antigravity (قراءة الدفتر كلّه ← تُمنع بسبب الدفتر لا بالمسار، ثم `git status` ← يمرّ)، ثم `/next` هناك أو هنا: مراجعة D83 ثم D84 وD85.

## ٢٠٢٦-١٠-١٨ ٢٣:١٥ — ر163: جلسات Antigravity (Gemini) بالقواعد نفسها (قول المالك: «نعم، اكتب الملفّات الثلاثة الآن») · 🔄 لم يكتمل (نفد الرصيد)
- **كُتب:** `AGENTS.md` إحالةٌ إلى CLAUDE.md · `.agents/workflows/next.md` يحيل إلى `.claude/commands/next.md` · `.agents/hooks.json` (PreToolUse) و`tools/hooks/agy.mjs` يترجم نداء Antigravity
  إلى صيغة Claude ويسأل `guard.mjs` نفسه (`ask` ← `force_ask`)، وفحص ما بعد التعديل قبل `git commit`.
- **الفحص (يدويًّا وحده):** `sed -i` ← deny · `git status` ← allow · `git push origin master` ← force_ask · الدفتر بلا مدى ← deny وبـ١–١٠٠ ← allow · مدخلٌ فاسد ← allow.
- **بقي:** `tests/agyHook.test.ts` (كحالات `guardHook`) · QUALITY §٨ وسطر ر163 في DECISIONS · وتجربة المالك في Antigravity: يطلب قراءة الدفتر كلّه، فإن رُفض فالحارس يعمل.
- **التالي:** يُكمَل «بقي» أوّلًا، ثم `/next` (مراجعة D83 ثم D84 وD85).

## ٢٠٢٦-١٠-١٨ ٢٣:٠٠ — D83 ✅ — A11 (٧): `services/excelDoc.ts` ٦٨٧ ← ٣٣٩ نقلًا حرفيًّا، والخلايا في `excelCells.ts` · والتوقّف هنا (٤ نقاط، ر162)
- **النقل** (`c7f6b1d`): `move.cjs` و`tsconfig.node.json` بلا `fromSrc` ← الثمانية والعشرون بتعليقاتها وأسطر أقسامها (المقاسات، ورقة البيانات، نصّ الخليّة، المحاذاة) إلى `excelCells.ts` ٣٥١، و«الورقة» باقٍ ·
  وفي الأصل بعد استيراد `move.cjs` بابٌ واحد بنصّ الأمر · والثمانية (`PREPOSITIONS` `cellText` `fixZeros` `literalInlines` `marksOf` `fieldInline` `formulaInlines` `retarget`) بلا `export` فالمصدَّر ٢٠ ·
  `prune.cjs` نظّف ثمانية (ومنها سطرا `./blanks` و`./cellText` كاملين) · `typecheck` نظيف · والسقف (`c342464`): `RATCHET` فسقط `excelDoc.ts`.
- **الوثائق** (`3ad53eb`): ARCHITECTURE §١ (بقي ثمانية) و§٢ (الجدول #٨ ← D83 بأرقامه، وسطر الأوامر D83 ✅) · BACKLOG A11 (السبعة ✅، و«ضاع» D83 ستّة).
- **الفحص:** الحرفيّة `verbatim.cjs f1cafc7` ← «ضاع 6 · جديد 0»: `fieldRef` `makeField` `Doc` `DocField` `Inline` `Marks` من استيراد `@shared/doc` الممتدّ حذفها `prune`، وبحذف جمل الاستيراد وإعادة التصدير بالشجرة
  (سكربتٌ في مجلّد الجلسة) 0 و0 · `git show --stat c7f6b1d` الملفّان وحدهما · المصدَّر من `excelDoc` سبعة قبل وبعد · LF كما كان، ولا بايت تحكّم · `inventory.cjs` ← ثمانية بلا `excelDoc.ts` و«دورات القيم: 0» ·
  `structure` ١٠ ✓ · `docsBudget` ٣ ✓ · `npx vitest run` كاملًا **١٩٧٢ ✓** و٤ متخطّاة ولقطات الرسّام كما هي · `npx electron-vite build` ثم `excelImport` ١٩ ✓ و`importFolder` ٣٤ ✓ بلا ✗.
- **فرق التقدير:** قدّر الأمر (من D76) الجديد ≈٣١٦ والأصل ≈٣٧١، والواقع ٣٥١ و٣٣٩ (أكثر من ±١٠ — كأنّ المحاكاة عدّت `retarget` `adoptDataFields` في الباقي)، والاثنان دون ٤٠٠ فالهدف قائم ·
  فلتقديرات D84–D86 أن تُقرأ تقريبيةً، و`move.cjs` وسقف ٤٠٠ يمسكان الخطأ.
- **كيف يُراجَع:** «كيف يُراجَع» في أمره، ومرجع الحرفيّة `f1cafc7` ← «ضاع 6 · جديد 0» (الأسماء أعلاه). **التالي:** `/next` يراجع D83 ثم D84 وD85 (م + م = ٤ نقاط).

## ٢٠٢٦-١٠-١٨ ٢٢:٥٤ — مراجعة D82 ✓ · وحجز D83 🔒
- **D82 بـ«كيف يُراجَع»:** `verbatim.cjs 602cf14` ← «ضاع 0 · جديد 0» · `git show --stat 05a0135` الملفّان وحدهما · `inventory.cjs` ← «دورات القيم: 0» · و`structure.allow.json` بلا `portraitMask.ts`. ✓
- **تحقّق D83 قبل البدء:** `excelDoc.ts` ٦٨٧ وسقفه ٦٩٠ · «مكوّنات 2 أكبرها 537» · لا `excelCells.ts` · و`ExcelBook` `ExcelSheetDoc` لا يستوردهما ملفٌّ خارجه. ✓

## ٢٠٢٦-١٠-١٨ ٢٢:٥٣ — D82 ✅ — A11 (٦): `shared/portraitMask.ts` ٥٤٠ ← ٣٣٥ نقلًا حرفيًّا، والقاط في `suitFit.ts`
- **النقل** (`05a0135`): `move.cjs` بمواصفةٍ في مجلّد الجلسة (`fromSrc`، والبرنامج `tsconfig.web.json`) ← الأحد عشر بتعليقاتها ومعها سطر `// ── القاط` إلى `suitFit.ts` ٢١٠، وفيه `import type { Landmarks } from './portraitMask'`
  وحده · وفي الأصل بعد سطر `photoPresets` بابٌ واحد بنصّ الأمر · `prune.cjs` لم يجد ما يحذف · `typecheck` نظيف · والسقف (`a9cd079`): `RATCHET` فسقط `portraitMask.ts` من `structure.allow.json`.
- **الوثائق** (`e50c8de`): ARCHITECTURE §١ (بقي تسعة) و§٢ (الجدول #٧ ← D82 بأرقامه، وسطر الأوامر D82 ✅) · BACKLOG A11 (الستّة ✅، والتسعة: D83–D86 ثم D87).
- **الفحص:** الحرفيّة `verbatim.cjs 602cf14` ← «ضاع 0 · جديد 0» · `git show --stat 05a0135` الملفّان وحدهما · الأسماء المصدَّرة من `portraitMask` ٢٢ قبل وبعد (بالباب) · LF كما كان، ولا بايت تحكّم ·
  `inventory.cjs` ← تسعة ملفّات بلا `portraitMask.ts` و«دورات القيم: 0» · `structure` ١٠ ✓ · `docsBudget` ٣ ✓ · `npx vitest run` كاملًا **١٩٧٢ ✓** و٤ متخطّاة (١٨٦ ملفًّا) ولقطات الرسّام كما هي ·
  `npx electron-vite build` ثم `portrait` ١٥ ✓ و`autoCollar` ٤ ✓ و`faceChin` ٤ ✓ بلا ✗ (والأخيران يتخطّيان لبس القاط المدمج لأنّه مفرّغ — كما هما منذ ١٣ ت١؛ و`portrait` يُلبس قاطًا مستوردًا).
- **التالي:** مراجعة D82 بـ«كيف يُراجَع» ثم D83 (م، وبه تمّت النقاط الأربع).

## ٢٠٢٦-١٠-١٨ ٢٢:٤٧ — مراجعة D76 ✓ · وحجز D82 🔒
- **رسالة المالك:** `/next`.
- **D76 بـ«كيف يُراجَع»:** الأسماء المئة والأربعة في D82–D86 تصريحاتٌ عليا في ملفّاتها بأمر البحث في قيد ٢٢:٤١ ← لا ناقص · وحال تصديرها اليوم يطابق ما يقوله كلّ أمر («يُعاد بلا `export`» ما لم يكن مصدَّرًا،
  والباقي مصدَّرٌ أو يستورده الأصل): D82 الأحد عشر مصدَّرة · D83 خمسة مصدَّرة من ٢٨ · D84 تسعة من ٢٤ · D85 `ImageSaver` وحده · D86 `wrongGenderWords` وحده ·
  وأسماء D82 الأحد عشر متتاليةٌ بين `// ── القاط` (٣١٧) و`// ── القصّ على دليل الرأس` (٥٢٣) · و`ExcelBook` `ExcelSheetDoc` لا يستوردهما غير `excelDoc.ts` · وسطور الربط (`photoPresets` ٢٢، `importGuard` ٤٦،
  `Confidence, Suggestion` ٣١، `gender` ٢٥، والرأس ١٨–٣١ في `import.ts`) في مواضعها · و`inventory.cjs` ← العشرة و«دورات القيم: 0» · كلٌّ ⚙️ بلا سؤالٍ ولا أداةٍ جديدة، والترتيب والأحجام (م) مقبولة. ✓
- **التالي:** D82 ثم D83 (م + م = ٤ نقاط، ر162).

## ٢٠٢٦-١٠-١٨ ٢٢:٤١ — D76 ✅ 🧭 — خمسة أوامر A11 (D82–D86، كلٌّ ⚙️ م) وسطر D87 🧭 · والتوقّف لتراجعها الجلسة التالية
- **النصّ:** كُتب نصّ D76 في الجلسة نفسها من سطره في PLAN (كـD71)، ونُقل إلى `done/` · **والطريقة:** محاكاةٌ للنقل بمنطق `move.cjs` بلا كتابة (سكربتٌ في مجلّد الجلسة لم يُودَع): الأسطر المنقولة والباقية، وما يستعمله المنقول من الأصل، وما يبقى الأصل يستعمله، والمستوردون، والتعليق الذي يأخذه `move.cjs` مع أوّل تصريح.
- **الأوامر** بترتيب جدول ARCHITECTURE §٢ (#٧–#١١)، كلّها قيعانٌ ببابٍ فلا مستورد يتغيّر: D82 `portraitMask.ts` ٥٤٠ ← ≈٣٤٥ (`suitFit.ts` ≈١٩٥، و`fromSrc` لأنّه يأخذ النوع `Landmarks`) · D83 `excelDoc.ts` ٦٨٧ ← ≈٣٧١ (`excelCells.ts` ≈٣١٦ ومعه `ExcelSheetDoc` `ExcelBook`) ·
  D84 `blanks.ts` ٦٥٨ ← ≈٣٧٩ (`blankText.ts` ≈٢٧٩ ومعه `citizenLink`، وبدونه ٣٩٣) · D85 `import.ts` ٥٥١ ← ≈٢٦٢ (`importLayout.ts` ≈٢٨٩، ورأس الملفّ يأخذه `move.cjs` مع `decodeEntities` فيُعاد بـEdit) · D86 `fieldHints.ts` ٥١٩ ← ≈٣٨٣ (`fieldWords.ts` ≈١٣٦).
- **الحجم:** كلٌّ م (ملفّان وباب، وسيناريوهان أو ثلاثة، وبناءٌ مرّة) · **D87 🧭:** الخمسة الباقية (#١٢–#١٦) وفرز A13 A14 وA09 ب وA15؛ وA17 A18 بعد إصدار.
- **PLAN:** أسطر D47–D74 وD81 المراجَعة بنصّها إلى `docs/legacy/PLAN-3.md` (ر162، والروابط `../orders/`، و«غائب 0» بسكربت) فـPLAN ٢٢٤٠٦ ← ٥٠٦٢ بايت.
- **الفحص:** الأوامر ٤٦–٥٤ سطرًا · الأسماء المئة والأربعة تصريحاتٌ عليا في ملفّاتها بـ`grep -qE "^(export )?(type|function|const|let) $n\b" <الملفّ> || echo $n` لكلّ اسمٍ في كلّ أمر ← لا شيء ·
  كلّ مسارٍ مذكورٍ موجود إلا الخمسة الجديدة، والسيناريوهات والاختبارات بأسمائها موجودة · `docsBudget` `repoHygiene` ٧ ✓ · لا بايت تحكّم · `src/` `tests/` `tools/` لم تُمسّ.
- **التالي:** `/next` يراجع D76 («كيف يُراجَع» فيه) ثم D82 وD83 (م + م = ٤ نقاط، ر162).

## ٢٠٢٦-١٠-١٨ ٢٢:٢٤ — مراجعة D81 ✓ · ونقل قيود D58–D66 إلى legacy · وحجز D76 🔒
- **رسالة المالك:** `/next`.
- **D81 بـ«كيف يُراجَع»:** `git show 0708396` يمسّ `tools/split/move.cjs` وحده (+١٨ −١: `fromSrc` وسطر `spec:`) · `verbatim.cjs 0708396` على الخمسة ← «ضاع 7 · جديد 0» والسبعة أسماء الاستيراد الممتدّ
  (`ArchiveCheck` … `TransactionResult`) كمرجع قيد ٢٢:٠٥ · `git diff 0708396 -U0` لـ`documents.ts` بلا سطر `+`، والستّة (`htmlToText` `fingerprint` `chainLink` `CHAIN_GENESIS` `peekSerial` `reserveSerial`)
  بنصّها كاملًا مع تعليقها مطابقةٌ بمحلّل TypeScript (وما في الفرق منها نداءاتٌ في المنقول) · `inventory.cjs` ← «دورات القيم: 0» · و`structure.allow.json` بلا `documents.ts`. ✓
- **الدفتر:** ١٠١٩١٢ بايت فنُقلت قيود D58 ✅ إلى D66 ✅ (٣٠ قيدًا) بنصّها إلى `docs/legacy/LOG-3.md` كما تقول رسالة الحارس، و«لا ضياع» بـ`cmp` (الباقي + المنقول = الأصل) · الدفتر ٤٥٩٣٩ بايت.
- **التالي:** D76 🧭 (جارٍ، وحده بحكم ر162).

## ٢٠٢٦-١٠-١٨ ٢٢:١٨ — ر162: أوامر بحجمها حتى ٤ نقاط في الجلسة (قول المالك، بعد ختام D81)
- **قول المالك:** «اضفنا حسب المهام مثل مهمة قصيرة … او 4 مهام تقاس على انها قصيرة … والمهمة الكبيرة تكون وحدها او معها شيء»، ثم «ان كان لا ياثر فموافق» (على الدقّة).
- **القرار:** ص نقطة · م نقطتان · ك ثلاث (وما بلا حجمٍ ك) ومجموعها ٤ على الأكثر، و🧭 و🛑 كلٌّ وحده · وضوابط الدقّة: كلّ أمرٍ يُختم كاملًا قبل التالي، و«كيف يُراجَع» للمختوم إن اعتمد التالي عليه،
  والجلسة التالية تراجع كلّ ما أُنجز، ولا أمر بعد توقّفٍ أو تلخيصٍ آليّ أو قرب نفاد الرصيد · وخانة ✅ سطرٌ قصير، وأسطر ✅ المراجَعة تُنقل بنصّها إلى legacy حين تحتاج اللوحة مكانًا.
- **كُتب في:** DECISIONS (ر162، وشُطب من ر160 «أمرٌ واحد لكلّ جلسة») · CLAUDE.md الخطوات ٢ و٣ و٦ · `/next` الخطوتان ٢ و٥ · `_TEMPLATE.md` (الحجم ومعياره والختام) · رأس PLAN (الحجم و«أحدثها») ·
  رسالة حارس PLAN في `docsBudget.test.ts` (نصّها وحده، والسقف كما هو).
- **PLAN:** أسطر D75 وD77–D80 (مراجَعة) نُقلت بنصّها إلى `docs/legacy/PLAN-3.md` (والروابط `../orders/` كـPLAN-1-2، والخمسة مطابقةٌ لما في `HEAD` بعد ردّ البادئة)، وبقي عنها سطرٌ واحد · PLAN ٢٥٥٩٥ ← ٢٢٤٠٦ بايت؛ وD81 باقٍ حتى يُراجَع.
- **تصحيحٌ لقيد ٢٢:٠٢:** «يحفظ CRLF» معناه يحفظ نهايات الأسطر كما هي — `documents.test.ts` و`searchIndex.test.ts` CRLF والباقي LF، وعدّ `tr -cd '\r'` قبل D81 وبعده يطابق ذلك.
- **التالي:** `/next` يراجع D81 ثم D76 🧭 (وحده بحكم ر162)، ويكتب لكلّ أمرٍ حجمه · والدفتر ١٠١٧٥٥ من ١٠٢٤٠٠ بايت: أوّل قيدٍ بعده ينقل أقدم القيود كما تقول رسالة الحارس.

## ٢٠٢٦-١٠-١٨ ٢٢:٠٥ — D81 ✅ — A11 (٥): `services/documents.ts` ٩١٠ ← ٣٧٠ نقلًا حرفيًّا، والدورة (٢) قُطعت · والتوقّف هنا (ر160)
- **رسالة المالك:** «D81 ١ — أضف documentList.ts إلى قائمة القاعدة ٩ بتعليقه، وأكمل D81 حتى الختام».
- **الاستئناف من نقطة ٢٢:٠٢** (`e9b738c`): `src/main/services/documentList.ts` في `SQL_TEMPLATES` بـ`tests/structure.test.ts` قبل `documents.ts`، وفوقه تعليق «نُقل من documents.ts في D81 بقوالبه الثمانية، ولا قالب جديد
  (٩ قبل النقل و١ + ٨ بعده) — أُضيف بكلمة المالك «D81 ١»، والقائمة بعده تتناقص ولا تزيد» · فالقائمة ١٧ والقوالب ٩ كما كانت.
- **الوثائق** (`07c7aa6`): ARCHITECTURE §١ «نقاط الضعف» (بقي عشرة لـD76 ولا دورة) و§٢ سطر الأوامر D81 ✅ · BACKLOG A11 (✅ `services/documents.ts`، والخمسة ✅، و«ضاع» سبعة في D81) وA13 (الدورتان قُطعتا).
- **الفحص:** `structure` ١٠ ✓ · `npx vitest run` كاملًا **١٩٧٢ ✓** و٤ متخطّاة (١٨٦ ملفًّا) ولقطات الرسّام كما هي · `inventory.cjs` ← عشرة ملفّات فوق ٤٠٠ و«دورات القيم: 0» · `docsBudget` ٣ ✓ · لا بايت تحكّم ·
  والسيناريوهات السبعة ٢٠٣ ✓ بلا ✗ من قيد ٢٢:٠٢ (بعدها لم يتغيّر في `src/` شيء).
- **كيف يُراجَع:** «كيف يُراجَع» في أمره، ومرجع الحرفيّة `0708396` ← «ضاع 7 · جديد 0» (الأسماء السبعة في قيد ٢٢:٠٢) لا 0. **التالي:** `/next` يراجع D81 ثم D76 🧭 (يفصّل ما بقي من الموجة ٣).
- **تنبيهٌ لـD76:** PLAN عند سقف `docsBudget` (٢٥٥٩٥ من ٢٥٦٠٠ بايت بعد أن قصّرتُ خليّة D81 ✅، وتفصيلها هنا) — فأسطر أوامره الجديدة تحتاج مكانًا يُخلى أوّلًا بما تقوله رسالة الحارس.

## ٢٠٢٦-١٠-١٨ ٢٢:٠٢ — D81 🔄 — متوقّفٌ عند القاعدة ٩ في `structure.test.ts`: سؤالٌ للمالك 🛑
- **(١) `fromSrc`** (`0708396`): تجربةٌ في مجلّد الجلسة — ما ليس مصدَّرًا ← «keepStyle، nidOf، searchFold وليس مصدَّرًا فيه» · الدورة ← «دورة: … assertNotVoid» · وبلا المفتاح الرسالة كالأداة القديمة، ونقلٌ ناجح بالأداتين بايتًا ببايت.
- **(٢) النقل** (`53dd954`) أربع مرّات بـ`fromSrc`: `issue.ts` ٢٣٢ و`documentList.ts` ١٦٤ و`archiveVerify.ts` ١٠٤ و`printRecords.ts` ٦١ تستورد من `./documents` · `searchFold` `keepStyle` `nidOf` `ROW_COLUMNS` `LEGACY_SLOTS` `legacySlots` بلا `export` كما كانت (سابقة D77 وD80) ·
  المستوردون بسكربتٍ في مجلّد الجلسة يحفظ CRLF: سطور الاستيراد و`svc.` وحدها (`ipc/documents.ts` `ipc/output.ts` `ipc/index.ts` والاختبارات الخمسة عشر) · `prune` حذف اثني عشر · `documents.ts` ٩١٠ ← ٣٧٠ ولا سطر `+` فيه، والستّة وكلّ الباقي (٢٣) بايتًا ببايت.
- **(٣) السقف** (`d6503b2`): `documents.ts` خرج من `structure.allow.json`.
- **الفحص:** `typecheck` ✓ · الحرفيّة بـ`0708396` «ضاع 7 · جديد 0» (`ArchiveCheck` `ArchiveStats` `DocumentRow` `IssueInput` `PeriodStats` `TransactionInput` `TransactionResult` — استيراد `@shared/api` الممتدّ، كـD79)، وبحذف جمل الاستيراد بالشجرة 0 و0، وحرفٌ مغيَّر ← 1 و1 ·
  `inventory.cjs` ← «دورات القيم: 0» · `npx vitest run` ١٩٧١ ✓ و٤ متخطّاة و**١ ✗: القاعدة ٩** · `electron-vite build` ✓ ثم `issue` ١١٣ `batches` ٢٨ `copies` ١٠ `weekly` ١٥ `audit` ٨ `orderPrinted` ١٣ `receipt` ١٦ — بلا ✗ · لا بايت تحكّم.
- **التوقّف:** القاعدة ٩ تقول «`documentList.ts` يبني SQL بقالب `${}` … وهذه القائمة لا تزيد»: الخمس المنقولة إليه تحمل قوالبها حرفيًّا. قوالب `prepare/exec` بـ`${}` كانت ٩ في `documents.ts`، وبعده ١ فيه و٨ في `documentList.ts` = ٩، فلا قالب جديد؛
  لكنّ إصلاحه سطرٌ في `SQL_TEMPLATES` بـ`tests/structure.test.ts`، وهو خارج «المسموح» وتعليقه «لا يُضاف إليهما شيء». فلم يُمسّ.
- **سؤال المالك:** (١) **توصيتي:** يُضاف `src/main/services/documentList.ts` إلى القائمة بتعليق «نُقل من documents.ts في D81 بقوالبه الثمانية، ولا قالب جديد» (كـ`questionBank.ts` في D73)، فتصير ١٧ ويبقى عدد القوالب ٩ · (٢) أو يُردّ النقل (`53dd954` `d6503b2`) ويبقى `documents.ts` ٩١٠.
- **نقطة الاستئناف:** بعد الجواب (١): السطر في `structure.test.ts` ثم `structure` و`npx vitest run` كاملًا، ثم الخطوة ٤ (ARCHITECTURE §٢ سطر D81 و§١ «نقاط الضعف»، وBACKLOG A11 وA13) والختام. والسيناريوهات لا تُعاد (لا `src/` يتغيّر).

## ٢٠٢٦-١٠-١٨ ٢١:٤٦ — مراجعة D80 ✓ · وحجز D81 🔒
- **رسالة المالك:** `/next`.
- **D80 بـ«كيف يُراجَع»:** `verbatim.cjs da59a53` على `render.ts` والثلاثة ← «ضاع 0 · جديد 0» · `verbatim.cjs 6f15dec` على `ipc/documents.ts` و`ipc/output.ts` ← «ضاع 0 · جديد 2» (`function registerOutputIpc(): void {` و`}`) ·
  `ipcMain.handle(` في `documents.ts` بـ`6f15dec` ٢٧، واليوم ١٥ + ١٢ · `ipc/index.ts` يستورد `registerOutputIpc` (٢٠) وينادي بها (١٦٨) بعد `registerDocumentIpc()` (١٦٧) وقبل `assertGateComplete()` (٢٦٦) · `structure.allow.json` بلا الملفّين. ✓
- **شروط D81:** `documents.ts` ٩١٠ وسقفه ٩١٢ · `inventory.cjs` ← «دورات القيم: 1» (`documents.ts` و`searchIndex.ts`) · لا `issue.ts` ولا `documentList.ts` ولا `archiveVerify.ts` ولا `printRecords.ts` · مستوردو المنقول كما في الأمر
  (والباقي: `gate.ts` و`preload/archive.ts` و`useIssue.ts` و`apiArchive.ts` قنوات أو تعليق، و`search.ts` تعليق، و`channels.allow.json` قنوات). **التالي:** D81 (جارٍ).

## ٢٠٢٦-١٠-١٨ ٢١:٣٠ — D80 ✅ — A11 (٤): طريق الطباعة — `render.ts` ٤٧١ ← ٣٦٥ و`ipc/documents.ts` ٤٧٠ ← ٢٦٣ نقلًا حرفيًّا · والتوقّف هنا (ر160)
- **`render.ts`** (`6f15dec`) بـ`move.cjs` و`"tsconfig": "tsconfig.node.json"` ثلاث مرّات، والمواصفات في مجلّد الجلسة: `pngDensity.ts` ٤٥ و`sheetStyle.ts` ٤٣ و`calibration.ts` ٣٢، بلا باب — سطرا الاستيراد في `renderImage.ts`
  و`ipc/documents.ts` يأخذان كلّ اسمٍ من ملفّه، و`render.ts` يستورد `withDensity` لـ`renderPng` (أضافته الأداة) · و`CRC_TABLE` `styleCache` أعدتُ سطريهما بلا `export` كما كانا (الأداة تصدّر كلّ منقول، ولا يستعملهما غير ملفّهما — سابقة `BlockBase` D77) ·
  `prune.cjs` حذف `posix` من `render.ts` · و`render.ts` بقي CRLF والجديدة LF (كما تكتبها الأداة).
- **`ipc/output.ts`** (`896a102`) يدويًّا (Write للجديد وEdit للأصل): الرأس، واستيرادات ما تستعمله الجمل من استيرادات `documents.ts` ومعها `win` `safeName` `saveAs` من `./documents`، ثم `PrintMode` `PER_SHEET_PAGE` `forPrint`، ثم `registerOutputIpc`
  بمعالج `printIssued` بتعليقه ثم ما من «إخراج الورقة الجارية في المحرر» إلى قوس الدالّة · `export` على `win` · `ipc/index.ts` سطر الاستيراد والنداء بعد `registerDocumentIpc()` · `prune.cjs` حذف أربعة عشر من `documents.ts` ولا شيء من `output.ts` · **السقف** (`18364d1`) · **الوثائق** (`a1f5d01`).
- **الفحص:** `typecheck` ✓ (خروج 0) بعد كلّ خطوة · `verbatim.cjs da59a53` على `render.ts` والثلاثة ← «ضاع 0 · جديد 0» · `verbatim.cjs 6f15dec` على `documents.ts` و`output.ts` ← «ضاع 0 · جديد 2» (`function registerOutputIpc(): void {` و`}`) ·
  وسكربتٌ في مجلّد الجلسة: الجمل المنقولة ١٨٠ سطرًا غير فارغ مطابقةً للأصل بترتيبها، والتصريحات الثلاثة كما هي · `ipcMain.handle(` ٢٧ قبل، و١٥ + ١٢ بعد · `inventory.cjs` ← الملفّان خرجا من القائمة و«دورات القيم: 1» ·
  `npx vitest run` ١٩٧٢ ✓ و٤ متخطّاة (ومنه `structure` ١٠ ✓) ولقطات الرسّام كما هي · `electron-vite build` ✓ ثم `printResume` ٤ ✓ `copies` ١٠ `orderPrinted` ١٣ `printRoles` ٢٠ `sheetStyle` ٧ `paperSize` ١٤ `issue` ١١٣ `dailyWork` ٢٠ — بلا ✗ ·
  لا بايت تحكّم · `docsBudget` ٣ ✓.
- **كيف يُراجَع:** «كيف يُراجَع» في أمره بـ`da59a53` ثم `6f15dec` مرجعين للحرفيّة. **التالي:** `/next` يراجع D80 ثم D81 ⚙️ (`services/documents.ts`، و`fromSrc` في `move.cjs`).

## ٢٠٢٦-١٠-١٨ ٢١:١٧ — مراجعة D79 ✓ · وحجز D80 🔒
- **رسالة المالك:** `/next`.
- **D79 بـ«كيف يُراجَع»:** `git show 64ec44e` ← `move.cjs` وحده و`spec.tsconfig` وحده (`TSCONFIG` في الإعداد والرسالة وسطر `spec:`) · `verbatim.cjs 64ec44e` على الثلاثة ← «ضاع 6 · جديد 0» والستّة هي التي سمّاها قيد D79
  (`PAGE_MM` `tokenInlines` `ImageBlock` `Marks` `PageSetup` `PageSize`)، وكلّها في سطر استيراد `@shared/doc` في `docxStyles.ts:7` أو `docxRuns.ts:4` · `grep` الجديدين في `import.ts` و`design/importWord.ts` ← لا شيء · `structure.allow.json` بلا `docxDoc.ts`. ✓
- **شروط D80:** `render.ts` ٤٧١ و`ipc/documents.ts` ٤٧٠ وسقفاهما ٤٧١ و٤٧٣ · `PER_SHEET_PAGE` `forPrint` `PrintMode` في `documents.ts` تعريفاتها (٢٣ ٢٦ ٢٩) ومعالج `printIssued` وحده (٢٧٢ ٢٨٧ ٢٨٩) ·
  لا `pngDensity.ts` ولا `sheetStyle.ts` ولا `calibration.ts` ولا `ipc/output.ts` · `move.cjs` يقرأ `tsconfig`. **التالي:** D80 (جارٍ).

## ٢٠٢٦-١٠-١٨ ٢١:١٤ — D79 ✅ — A11 (٣): `docxDoc.ts` ٩١٩ ← ٣٢٨ نقلًا حرفيًّا · والتوقّف هنا (ر160)
- **`move.cjs`** (`64ec44e`): `const TSCONFIG = spec.tsconfig ?? 'tsconfig.web.json'` في قراءة الإعداد ورسالة «لم يُوجد الملفّ في البرنامج (…)» وسطر `spec:` · ومواصفةٌ بلا المفتاح على ملفٍّ في main ← «(tsconfig.web.json)» كما كانت.
- **النقل** (`59d76ac`، الثلاثة وحدها) بـ`move.cjs` و`"tsconfig": "tsconfig.node.json"`، والمواصفتان في مجلّد الجلسة: العشرون إلى `docxStyles.ts` ٢٩٢، ثم الستّة عشر إلى `docxRuns.ts` ٣١٣ (أخذت `chain` `readR` `Ctx` `RProps` من `./docxStyles`) ·
  وسطر الباب `export { sizeOfTwips, type SaveImage } from './docxStyles';` بعد باب `docxXml` · `prune.cjs tsconfig.node.json` حذف أحد عشر من `docxDoc.ts` · وعنوان «المقاسات» بقي فوق `TW_PER_PX` (تعليقه) · **السقف** (`292b43c`) · **الوثائق** (`a52d62d`).
- **الفحص:** `typecheck` ✓ (خروج 0) · `verbatim.cjs 64ec44e` على الثلاثة ← **«ضاع 6 · جديد 0»**: الستّة `PAGE_MM,` `tokenInlines,` `type ImageBlock,` `type Marks,` `type PageSetup,` `type PageSize` — أسطر استيراد `@shared/doc` الممتدّ حذفها `prune`
  (وهي في استيراد الجديدين بسطر)، وجهة «ضاع» في الأداة لا تتجاهلها؛ والفحص نفسه بحذف جمل الاستيراد كاملةً بشجرة TypeScript (سكربت في مجلّد الجلسة) ← 0 و0، وعلى D78 ← 0 و0، وسطرٌ معدَّل ← «ضاع 1 · جديد 1» ·
  الأسماء المصدَّرة من `docxDoc.ts` بالمدقّق ستّة قبل وبعد · `npx vitest run` ١٩٧٢ ✓ و٤ متخطّاة (ومنه `docxDoc` `docPm` `fieldHints` `sheetHead` `issuedDocx` ٨١ ✓) ولقطات الرسّام كما هي · `inventory.cjs` ← «دورات القيم: 1» ·
  `electron-vite build` ✓ ثم `import` ٣٣ ✓ `wordHints` ٢٢ `wordLosses` ١٣ `importFolder` ٣٤ — بلا ✗ · `import.ts` و`design/importWord.ts` لا يذكران الجديدين · لا بايت تحكّم · `docsBudget` ٣ ✓.
- **كيف يُراجَع:** «كيف يُراجَع» في أمره، والحرفيّة ستُظهر «ضاع 6» نفسها (الأسماء أعلاه) لا 0 — وتعديل `verbatim.cjs` لأمرٍ يسمح به (BACKLOG A11). **التالي:** `/next` يراجع D79 ثم D80 ⚙️ (`render.ts` و`ipc/documents.ts`).

## ٢٠٢٦-١٠-١٨ ٢١:٠٤ — مراجعة D78 ✓ · وحجز D79 🔒
- **رسالة المالك:** `/next`.
- **D78 بـ«كيف يُراجَع»:** `verbatim.cjs 49c069d src/shared/docPm.ts src/shared/docPmSchema.ts` ← «ضاع 0 · جديد 0» · `git show 6516205 --stat` ← `docPm.ts` و`docPmSchema.ts` وحدهما (فلا مستورد تغيّر) ·
  `structure.allow.json` أربعة عشر ملفًّا بلا `docPm.ts`. ✓
- **شروط D79:** `docxDoc.ts` ٩١٩ وسقفه ٩١٩ · `inventory.cjs` ← `docxDoc.ts` «مكوّنات 2 أكبرها 790» و«دورات القيم: 1» · `move.cjs` يقرأ `tsconfig.web.json` ثابتًا (سطرا ٢٢ و٢٩) · لا `docxStyles.ts` ولا `docxRuns.ts`. **التالي:** D79 (جارٍ).

## ٢٠٢٦-١٠-١٨ ٢١:٠٢ — D78 ✅ — A11 (٢): `docPm.ts` ٤٩٩ ← ٢٥٦ نقلًا حرفيًّا · والتوقّف هنا (ر160)
- **النقل** (`6516205`، الملفّان وحدهما) بـ`move.cjs` والمواصفة في مجلّد الجلسة (`names` العشرة، و`doc` رأسٌ بسطرٍ واحد): `docPmSchema.ts` ٢٥٣ يستورد من `./doc` (`import type`) و`./docPmMarks` وprosemirror-model، لا من `docPm.ts` ·
  والأداة أضافت `import { docSchema }` في الأصل (لـ`const S`)، ثم سطر الباب `export { docSchema, cssIndentToMm, cssLineHeight } from './docPmSchema';` بعد سطر `docPmMarks` · `prune.cjs` حذف أربعة (`Schema` `NodeSpec` `cssSizeToPx` `marks`) ·
  وعنوان القسم «قراءة الأنماط من HTML ملصوق» بقي في `docPm.ts` فوق سطري الباب (تعليقٌ يسبق تصريحًا لم يُنقل؛ والأداة تنقل تعليق المنقول وحده) · **السقف** (`623fa5e`): سقط `docPm.ts` وحده · **الوثائق** (`3960ebd`): ARCHITECTURE §٢ وBACKLOG A11.
- **الفحص:** `typecheck` ✓ (خروج 0) · `verbatim.cjs 49c069d src/shared/docPm.ts src/shared/docPmSchema.ts` ← «ضاع 0 · جديد 0» · الأسماء المصدَّرة من `docPm.ts` بمدقّق TypeScript ٩ قبل وبعد (لا غائب ولا زائد) ·
  `npx vitest run` ١٩٧٢ ✓ و٤ متخطّاة (ومنه `docPm` `docPmTable` `docPmList` `localPaths`)، ولقطات الرسّام كما هي · `inventory.cjs` ← «دورات القيم: 1» (`docPm.ts` خرج من السقوف فلا يعدّه؛ و`wc -l` ٢٥٦) ·
  `electron-vite build` ✓ ثم `pageEditor` ٦٣ ✓ `editor` ٣٩ `editorDraft` ٣ `bookEditor` ٣٤ `pagedLetter` ١٤ — بلا ✗ · لا بايت تحكّم · `docsBudget` ٣ ✓.
- **ملاحظة:** ARCHITECTURE §١ يقول «بقي خمسة عشر» (D77) وصارت أربعة عشر — لم يُمسّ لأنّ المسموح §٢ وحده؛ يصحّحه أمرٌ يسمح بـ§١.
- **كيف يُراجَع:** «كيف يُراجَع» في أمره بـ`49c069d` مرجعًا للحرفيّة، و`git show 6516205 --stat`، و`structure.allow.json`. **التالي:** `/next` يراجع D78 ثم D79 ⚙️ (`docxDoc.ts`، و`tsconfig` في `move.cjs`).

## ٢٠٢٦-١٠-١٨ ٢٠:٥٢ — مراجعة D77 ✓ · وحجز D78 🔒
- **رسالة المالك:** `/next`.
- **D77 بـ«كيف يُراجَع»:** `verbatim.cjs 4129df6` على `doc.ts` والثلاثة الجديدة ← «ضاع 0 · جديد 0» · `inventory.cjs` (٨ ث) ← «دورات القيم: 1» (`documents`↔`searchIndex` وحدها) ·
  `git show b149cb1 --stat` ← ثمانية عشر ملفًّا: الأصل والجديد والستّة عشر، وأسطرهم المتغيّرة (`+`/`-`) كلّها سطور `import` (أو `normalizeDoc,` من استيرادٍ ممتدّ) · `structure.allow.json` ١٧ سطرًا بلا `doc.ts` ولا `ImportPlanDialog.tsx`. ✓
- **شروط D78:** `docPm.ts` ٤٩٩ وسقفه ٤٩٩ · `inventory.cjs` ← `docPm.ts` «مكوّنات 4 أكبرها 228» و«دورات القيم: 1» · لا `docPmSchema.ts`. **التالي:** D78 (جارٍ).

## ٢٠٢٦-١٠-١٨ ٢٠:٥٠ — D77 ✅ — A11 (١): `doc.ts` ٨٥٢ ← ٣٧٤ نقلًا حرفيًّا، ودورة التصاميم قُطعت · والتوقّف هنا (ر160)
- **الأداتان** (`4129df6`): `tools/split/verbatim.cjs` و`inventory.cjs` بنصّيهما (استخراجٌ ببرنامج من ARCHITECTURE والقيد، وسطرٌ جديد بعد الفواصل وحذفه يعيد النصّ) · والفرق: `structure.allow.json` من مجلّد العمل كما في الأمر،
  و**`process.argv.slice(2)` لا `slice(1)`** في `verbatim` (في `node -e` أوّل الوسائط `argv[1]`، وفي ملفٍّ هو مسار الأداة) · `inventory.cjs` ← مخرج أمر القيد سطرًا بسطر (`diff` فارغ)، و`verbatim.cjs HEAD src/shared/qr.ts` ← 0 و0 (وسطرٌ غريب ← «جديد 1»).
- **الأنواع والترقيم** (`c4641fc`) بـ`move.cjs`: الثمانية والثلاثون إلى `docTypes.ts` (٣٢٦)، و`Measured` `paginate` `keepTogetherFrom` إلى `docPaginate.ts` (٧٩)، والسطران `export type *` و`export { … }` · و`move.cjs` أضاف `export`
  على `BlockBase` (لم يكن مصدَّرًا) فأظهره الباب اسمًا جديدًا من `doc.ts` ← أُعيد سطره كما كان (لا يستعمله إلا `docTypes`) · الأسماء المصدَّرة ببرنامج ٧٢ قبل وبعد، لا غائب ولا زائد.
- **التطبيع** (`b149cb1`): الكتلة من `isObj` إلى `normalizeField` بـWrite وEdit إلى `docNormalize.ts` (١٠٦) بلا باب، والمستوردون الستّة عشر بسطور استيرادٍ وحدها (وCRLF الثلاثة كما هي) ·
  و`import type { Canvas }` بعد `prune` (فلا يبقى استيرادٌ من `canvas.ts` عند البناء) · **السقف** (`997245d`): سقط الملفّان وحدهما · **الوثائق:** ARCHITECTURE §١ و§٢ (ودرس `BlockBase`) وBACKLOG A11 وA13.
- **الفحص:** `typecheck` ✓ بعد كلّ خطوة · `verbatim.cjs 4129df6` على الأربعة ← «ضاع 0 · جديد 0» · `inventory.cjs` (قبل السقف) ← `doc.ts` ٣٧٤ و«دورات القيم: 1» (`documents`↔`searchIndex`) · `npx vitest run` ١٩٧٢ ✓ و٤ متخطّاة،
  ولقطات الرسّام كما هي · `electron-vite build` ✓ ثم `editor` ٣٩ ✓ `pagedLetter` ١٤ `templates` ٤٠ `packs` ٢٧ `designDraft` ٢٥ `letterhead` ٤٠ — بلا ✗ · الجديدة ٤٠٠ فأقلّ · لا بايت تحكّم.
- **كيف يُراجَع:** «كيف يُراجَع» في أمره بالإيداعات أعلاه (`verbatim.cjs 4129df6 …` و`inventory.cjs` و`git show b149cb1 --stat` و`structure.allow.json`)؛ وبعد السقف لا يعدّ `inventory.cjs` `doc.ts` (يقرأ ما في السقوف وحدها) فحجمه بـ`wc -l`. **التالي:** `/next` يراجع D77 ثم D78 ⚙️.

## ٢٠٢٦-١٠-١٨ ٢٠:٣٠ — مراجعة D75 ✓ · وحجز D77 🔒
- **رسالة المالك:** `/next`.
- **D75 بـ«كيف يُراجَع»:** أمر الجرد منسوخًا من القيد (٨ ث) ← الأعداد نفسها: ستّة عشر ملفًّا مجموعها ٩٣١٨ (`docxDoc` ٩١٩ · `services/documents` ٩١٠ · `doc` ٨٥٢ ويستورده ١١٩/٤٧/٢ ·
  `portraitMask` ١٤ مكوّنة · `docxDoc` أكبرها ٧٩٠) و«دورات القيم: 2» (العشرة حول `doc.ts`، و`documents`↔`searchIndex`) · وقرأتُ ARCHITECTURE §٢ والأوامر الخمسة: كلّ قطعٍ نقلٌ
  بـ`move.cjs` أو يدويٌّ حرفيّ وبابٌ أو تحديث استيرادٍ وحده، وفحص الحرفيّة في كلٍّ · كلّها ⚙️ بلا سؤالٍ للمالك ولا أداةٍ خارجية (المفتاحان في `move.cjs` القائمة) · والترتيب (بنود الموجة ٥ ثم الأكبر) مقبول. ✓
- **شروط D77:** D75 ✅ ومُراجَع · `doc.ts` ٨٥٢ وسقفه ٨٥٢ (و`ImportPlanDialog.tsx` ٣٩٦ وسقفه ٤٤٤) · «دورات القيم: 2» · `grep -rlw normalizeDoc src tests tools` ← الأصل والستّة عشر المذكورون ·
  لا `docTypes.ts` ولا `docPaginate.ts` ولا `docNormalize.ts` ولا `verbatim.cjs` ولا `inventory.cjs`. **التالي:** D77 (جارٍ).

## ٢٠٢٦-١٠-١٨ ١٩:٥٥ — D75 ✅ 🧭 — A11: جرد الملفّات الستّة عشر وتصميم تقسيمها في ARCHITECTURE §٢، وأوامر D77–D81 · والتوقّف لتراجعها الجلسة التالية
- **أمر الجرد** (Bash من جذر المشروع؛ شجرة TypeScript ومدقّقها من `tsconfig.node.json`، والمستوردون في `src` `tests` `tools` ومن وراء الأبواب، ودورات القيم) ← لكلّ ملفّ أسطره وتصريحاته ومُصدَّره وأنواعه ومستوردوه ومكوّنات قيمه، ثم «دورات القيم: 2» (٢١ ث): `node -e "const ts=require('typescript'),fs=require('fs'),P=require('path'),R=process.cwd(),rel=f=>P.relative(R,f).split(P.sep).join('/'); const A=require('./tests/structure.allow.json'),F=Object.keys(A).filter(f=>/^src\/(main|shared)\//.test(f)); const W=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?(e.name=='node_modules'?[]:W(P.join(d,e.name))):/\.tsx?$/.test(e.name)&&!/\.d\.ts$/.test(e.name)?[P.join(d,e.name)]:[]); const res=(fr,s)=>{let b=s.startsWith('@shared/')?P.join(R,'src/shared',s.slice(8)):s.startsWith('.')?P.resolve(P.dirname(fr),s):null;if(!b)return null;for(const c of [b,b+'.ts',b+'.tsx',P.join(b,'index.ts')])if(fs.existsSync(c)&&fs.statSync(c).isFile())return rel(c);return null}; const imp=new Map(),bar=new Map(),add=(m,k,v)=>(m.get(k)||m.set(k,new Set()).get(k)).add(v); for(const f of ['src','tests','tools'].flatMap(d=>W(P.join(R,d)))){const s=ts.createSourceFile(f,fs.readFileSync(f,'utf8'),99,true),fr=rel(f);const v=n=>{const sp=(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier?n.moduleSpecifier:ts.isCallExpression(n)&&n.expression.kind==ts.SyntaxKind.ImportKeyword?n.arguments[0]:null;if(sp&&ts.isStringLiteral(sp)){const t=res(f,sp.text);if(t){add(imp,t,fr);if(ts.isExportDeclaration(n))add(bar,t,fr)}}ts.forEachChild(n,v)};v(s)} const users=(t,seen=new Set())=>{if(seen.has(t))return[];seen.add(t);const b=bar.get(t)||new Set();return[...new Set([...[...(imp.get(t)||[])].filter(x=>!b.has(x)),...[...b].flatMap(x=>users(x,seen))])]}; const cfg=ts.parseJsonConfigFileContent(ts.readConfigFile('tsconfig.node.json',ts.sys.readFile).config,ts.sys,R),pg=ts.createProgram(cfg.fileNames,cfg.options),ck=pg.getTypeChecker(); const inT=n=>{for(let p=n.parent;p&&!ts.isSourceFile(p);p=p.parent)if(ts.isTypeNode(p)||ts.isTypeAliasDeclaration(p)||ts.isInterfaceDeclaration(p))return true;return false}; const E=new Map();for(const s of pg.getSourceFiles()){const fr=rel(s.fileName);if(!/^src\/(main|shared)\//.test(fr))continue;const val=new Set();const v=n=>{if(ts.isIdentifier(n)&&!inT(n)&&!ts.isImportSpecifier(n.parent)&&!ts.isImportClause(n.parent)&&!ts.isNamespaceImport(n.parent)){const y=ck.getSymbolAtLocation(n);if(y&&y.flags&ts.SymbolFlags.Alias)val.add(y)}ts.forEachChild(n,v)};s.statements.filter(x=>!ts.isImportDeclaration(x)).forEach(v); for(const st of s.statements){const sp=st.moduleSpecifier;if(!sp||!ts.isStringLiteral(sp))continue;const t=res(s.fileName,sp.text);if(!t||!/^src\/(main|shared)\//.test(t))continue;let on=false;if(ts.isExportDeclaration(st))on=!st.isTypeOnly;else{const c=st.importClause;if(!c)on=true;else if(!c.isTypeOnly){const b=[c.name,c.namedBindings&&ts.isNamespaceImport(c.namedBindings)?c.namedBindings.name:null,...(c.namedBindings&&ts.isNamedImports(c.namedBindings)?c.namedBindings.elements.filter(e=>!e.isTypeOnly).map(e=>e.name):[])].filter(Boolean);on=b.some(x=>val.has(ck.getSymbolAtLocation(x)))}}if(on)add(E,fr,t)}} const cyc=[];{let i=0;const st=[],on=new Set(),I=new Map(),L=new Map();const sc=v=>{I.set(v,i);L.set(v,i++);st.push(v);on.add(v);for(const w of E.get(v)||[]){if(!I.has(w)){sc(w);L.set(v,Math.min(L.get(v),L.get(w)))}else if(on.has(w))L.set(v,Math.min(L.get(v),I.get(w)))}if(L.get(v)==I.get(v)){const c=[];let w;do{w=st.pop();on.delete(w);c.push(w)}while(w!=v);if(c.length>1)cyc.push(c)}};for(const v of E.keys())if(!I.has(v))sc(v)} for(const f of F){const s=pg.getSourceFile(P.join(R,f)),x=s.getFullText(),ln=p=>s.getLineAndCharacterOfPosition(p).line;const D=s.statements.filter(t=>!ts.isImportDeclaration(t)).map(t=>{const cm=ts.getLeadingCommentRanges(x,t.getFullStart())||[];return{t,n:ln(t.getEnd())-ln(cm.length?cm[0].pos:t.getStart(s))+1,e:!!(ts.getCombinedModifierFlags(ts.isVariableStatement(t)?t.declarationList.declarations[0]:t)&ts.ModifierFlags.Export)||ts.isExportDeclaration(t),ty:ts.isTypeAliasDeclaration(t)||ts.isInterfaceDeclaration(t),r:new Set()}}); const M=new Map(D.map(d=>[d.t,d])),top=n=>{while(n.parent&&n.parent!==s)n=n.parent;return n};D.forEach(d=>{const v=n=>{if(ts.isIdentifier(n)){const y=ck.getSymbolAtLocation(n),q=y&&y.declarations&&y.declarations[0];if(q&&q.getSourceFile()===s){const o=M.get(top(q));if(o&&o!==d&&!o.ty&&!d.ty){d.r.add(o);o.r.add(d)}}}ts.forEachChild(n,v)};v(d.t)}); const V=D.filter(d=>!d.ty),seen=new Set(),C=[];for(const d of V){if(seen.has(d))continue;let q=[d],k=0;seen.add(d);while(q.length){const y=q.pop();k+=y.n;for(const z of y.r)if(!seen.has(z)){seen.add(z);q.push(z)}}C.push(k)}C.sort((a,b)=>b-a); const u=users(f);console.log(f,ln(s.getEnd()),'| تصريحات',D.length,'مُصدَّر',D.filter(d=>d.e).length,'أنواع',D.filter(d=>d.ty).reduce((a,d)=>a+d.n,0),'| يستورده src/tests/tools',['src/','tests/','tools/'].map(p=>u.filter(z=>z.startsWith(p)).length).join('/'),'| مكوّنات',C.length,'أكبرها',C[0])} console.log('دورات القيم:',cyc.length);cyc.forEach(c=>console.log(' ',c.length,c.sort().join(' ')))"`
- **النتيجة:** ستّة عشر ملفًّا ٩٣١٨ سطرًا (`docxDoc` ٩١٩ · `services/documents` ٩١٠ · `doc` ٨٥٢ …) · `doc.ts` يستورده ١١٩/٤٧/٢ (src/tests/tools) · `portraitMask` ١٤ مكوّنة · وكتلةٌ واحدة في `docxDoc` (٧٩٠) و`qr` و`fieldHints` و`import` و`paperDoc` ·
  والدورتان كما في تدقيق ت١ (ر٣-٠٤): (١) عشرة ملفّات حول `doc.ts` ↔ `canvas.ts`، (٢) `documents.ts` ↔ `searchIndex.ts`.
- **التجربة** (لم تُودَع، وأُعيدت بـ`git checkout` وحذف الثلاثة): أنواع `doc.ts` وترقيمه بـ`move.cjs`، والتطبيع يدويًّا ومستوردوه الستّة عشر (منهم `tools/packs/build.ts`، فضُمّ `tools` إلى الجرد) ← `typecheck` ✓،
  و`doc` `canvas` `packs` `pageAndDates` `designDraft` `structure` ١١٢ ✓، والحرفيّة «ضاع 0 · جديد 0» (وسطرٌ معدَّل عمدًا ← ١ و١)، و`doc.ts` ٣٧٥، و«دورات القيم: 1».
- **التصميم** (`b5b4050`): ARCHITECTURE §٢ «تقسيم الملفّات الكبيرة» — المبادئ السبعة، والأداة (`move.cjs` للقاع، ومفتاحا `tsconfig` في D79 و`fromSrc` في D81)، وفحص الحرفيّة بأمرٍ واحد، وجدول الستّة عشر (خطّ القطع، والحجم بعده كلّه ٤٠٠ فأقلّ، والباب أو تحديث المستوردين بسببه)، والترتيب: عدد بنود الموجة ٥ ثم الأكبر · و§١ سطر A11.
- **الأوامر** (`e4012bd`): D77 `doc.ts` (٥٤ سطرًا) · D78 `docPm.ts` (٤١) · D79 `docxDoc.ts` (٤٨) · D80 `render.ts` و`ipc/documents.ts` (٥٢) · D81 `services/documents.ts` (٤٩) — كلّها ⚙️ بلا سؤالٍ ولا أداةٍ خارجية، وكلّ مسارٍ ودالّةٍ وسيناريو فيها موجودٌ ببرنامج إلا «جديد» · وD76 بعد D81 ومعه العشرة الباقية · BACKLOG A11 وA13.
- **الدفتر:** ١٠٠٢٥٥ بايت قبل هذا القيد ← نُقلت قيود D52–D59 (١٦٢ سطرًا) بنصّها إلى `docs/legacy/LOG-2.md`، و«لا ضياع» ببرنامج (الدفتر والمنقول = الأصل).
- **الفحص:** `docsBudget` `repoHygiene` ٧ ✓ · أمر الجرد منسوخًا من هذا القيد يعيد الأعداد، و«فحص الحرفيّة» منسوخًا من ARCHITECTURE على `qr.ts` ← «ضاع 0 · جديد 0» · الأوامر ٨٠ سطرًا فأقلّ · لا بايت تحكّم · `git diff --stat` وثائقُ وحدها، و`src/` لم يُمسّ بعد التجربة.
- **كيف يُراجَع:** أعِد أمر الجرد فتجد الأعداد نفسها، واقرأ القسم والأوامر: أكلّ قطعٍ نقلٌ بلا تغيّر سلوك؟ أكلّ ⚙️ بلا سؤالٍ ولا أداةٍ خارجية؟ والترتيب مقبول؟ **التالي:** `/next` يراجع D75 ثم D77 ⚙️.

## ٢٠٢٦-١٠-١٨ ١٩:١٥ — مراجعة D74 ✓ · وحجز D75 🔒
- **رسالة المالك:** `/next`.
- **D74 بـ«كيف يُراجَع»:** `npm audit --omit=dev` ← «found 0 vulnerabilities» · `git diff 73234ef..57e33a0 -- package.json` ← `overrides` وحده (`exceljs` ← `uuid` `^11.1.1`) ·
  ومقارنة `packages` في القفل ببرنامج (`git show 73234ef:` و`HEAD:`) ← ٧٧٩ مفتاحًا قبل وبعد (٧٧٨ بلا الجذر)، لا اسم جديد ولا غائب، والمتغيّر ثلاثة وحدها:
  `glob/…/brace-expansion` 1.1.18 ← 1.1.21 و`readdir-glob/…/brace-expansion` 2.1.4 ← 2.1.7 و`uuid` 8.3.2 ← 11.1.1 · والقفل `i/crlf`. ✓
- **شروط D75:** D74 ✅ ومُراجَع · `wc -l` للستّة عشر كلّها عند سقوفها أو دونها (`docxDoc` ٩١٩ و`services/documents` ٩١٠ و`doc` ٨٥٢ …) و`ImportPlanDialog.tsx` ٣٩٦ (سقفه ٤٤٤) ·
  لا قسم A11 في ARCHITECTURE · لا نصّ لـD77 فما بعد. **التالي:** D75 (جارٍ).

## ٢٠٢٦-١٠-١٨ ١٩:١٠ — D74 ✅ — ثغرتا exceljs العابرتان تُسدّان (brace-expansion وuuid) بلا حزمةٍ جديدة، وpdf-lib آخر إصدار (A12) · والتوقّف هنا (ر160)
- **brace-expansion** (`57e33a0`): `npm audit fix` كما كُتب غيّر أربعةً وعشرين إصدارًا لأدوات التطوير (منها electron-builder 26.15.3 ← 26.17.0 و`@electron/rebuild` و`node-abi`) ونقل `@noble/hashes` ←
  فأعدتُ بـ`git checkout package-lock.json` و`npm ci` كما يقول الأمر · ثم `npm audit fix --omit=dev` (وبه يقيس الأمر) ← النسختان وحدهما: `glob/…` 1.1.18 ← 1.1.21 و`readdir-glob/…` 2.1.4 ← 2.1.7.
- **uuid:** `"overrides": { "exceljs": { "uuid": "^11.1.1" } }` و`npm install` ← 8.3.2 ← 11.1.1 · والمقارنة ببرنامج (٧٧٨ مدخلًا قبل وبعد): لا اسم جديد ولا غائب ولا إصدار آخر، وفرق القفل ٢٥ سطرًا ·
  وأُعيد CRLF (`i/crlf`، ولا سطر LF)، و`electronLanguages` لم يُفرد هذه المرّة · exceljs يحلّ `uuid/dist/cjs/index.js` 11.1.1 و`v4()` معرّفٌ صحيح · `npm audit --omit=dev` ← «found 0 vulnerabilities».
- **الفحص:** `typecheck` ✓ · الملفّات التسعة ١٠٥ ✓ · `npm run notices` ٤٠ و`notices.json` كما هو · `electron-vite build` ✓ · `excelImport` ١٩ ✓ و`citizenImport` ١٤ ✓ بلا ✗ · `npm run pack` ✓ و`app.asar` فيه
  uuid 11.1.1 (بـ`dist/cjs`) وbrace-expansion 1.1.21 و2.1.7 وexceljs 4.4.0 (بـ`@electron/asar` في Node) · `docsBudget` `repoHygiene` `structure` ✓ · لا بايت تحكّم · `src/` لم يُمسّ.
- **ما ظهر:** بعد `npm ci` لا `electron.exe` (Electron 44 ينزّله عند أوّل `require('electron')`، و`drive.mjs` يأخذ المسار مباشرة فسقط بـENOENT) ← `node node_modules/electron/install.js` من المخبأ ·
  وثغرات أدوات التطوير (`npm audit` كلّه ٢١ ← ١٩) خارج A12 ولا تُحزم · الوثائق (`6f0da03`): BACKLOG «أُغلق: A12» و`system.md`، وpdf-lib: `npm view` ← 1.17.1 = المثبَّت.
- **كيف يُراجَع:** `npm audit --omit=dev` ← صفر · `git diff 73234ef..57e33a0 -- package.json` ← `overrides` وحده · ولا جديد في القفل (أعلاه). **التالي:** `/next` يراجع D74 ثم D75 🧭.

## ٢٠٢٦-١٠-١٨ ١٨:٥٨ — مراجعة D73 ✓ · وحجز D74 🔒
- **رسالة المالك:** `/next`.
- **D73 بـ«كيف يُراجَع»:** القاعدة ٩ تطابق `s.text` كلّه (`structure.test.ts:345`) لا الأسطر · `SQL_TEMPLATES` ستّة عشر وتعليق `questionBank.ts` فوقه (`:325`) ·
  والكسر (أ) أعدتُه بنفسي (`${'elements'}` في قالب `elements.ts:65` و`db.prepare(` في `:64`، لم يُودَع) ← ٩ ✗ «src/main/services/elements.ts: يبني SQL بقالب ${}…»، وبعد `git checkout` `structure` ١٠ ✓. ✓
- **شروط D74:** D73 ✅ ومُراجَع · `npm audit --omit=dev` ← «3 vulnerabilities (2 moderate, 1 high)» (brace-expansion عالية بـ«npm audit fix»، وuuid <11.1.1 و`--force` يُنزل exceljs إلى 3.4.0) ·
  `npm ls brace-expansion uuid --omit=dev` ← `1.1.18` تحت `minimatch@3.1.5` و`2.1.4` تحت `minimatch@5.1.9` و`uuid@8.3.2` تحت `exceljs@4.4.0` كما في الهدف · `package-lock.json` `i/crlf` · لا `overrides`. **التالي:** D74 (جارٍ).

## ٢٠٢٦-١٠-١٨ ١٣:٣٠ — D73 ✅ — القاعدة ٩ ترى قالب SQL ولو بدأ في السطر التالي لـ`prepare(`، و`SQL_TEMPLATES` ستّة عشر · والتوقّف هنا (ر160)
- **الفحص** (`b4b326e`): النمط يُطابَق على `s.text` كلّه بدل `split('\n')`، و`'src/main/services/questionBank.ts'` في `SQL_TEMPLATES` بتعليقه («فاتت جرد D65… أُضيف في D73 مرّةً…»)، وسطر الرأس ٩ «بسطرٍ أو أكثر (D73)» · `structure` ١٠ ✓.
- **الكسر المؤقّت** (لم يُودَع): (أ) `${'x'}` في قالب `elements.ts:65` (و`db.prepare(` في `:64`) ← ٩ ✗ «src/main/services/elements.ts: يبني SQL بقالب ${}…» · وعليه مع الفحص القديم (سطرًا سطرًا، أُعيد مؤقّتًا)
  لم يُرَ `elements.ts`، والساقط وحده «questionBank.ts: لم يعد يبني SQL بقالب ${}» (العمى نفسه) · (ب) حذف `questionBank.ts` من القائمة ← ٩ ✗ «questionBank.ts: يبني SQL بقالب ${}…» · وبعد `git checkout` ١٠ ✓.
- **ما ظهر:** النصّ كلّه ٦٤ نداءً مقابل ٤٩ سطرًا (جرد D65): الخمسة عشر الزائدة قوالب تمتدّ أسطرًا — `citizens` ٥ `documents` ٧ `searchIndex` ١ `templates` ١ `questionBank` ١ —
  قرأتها: أسماءٌ وشروطٌ من ثوابت الكود (`SUMMARY` `FIELDS` `ROW_COLUMNS` `COLUMNS[name]` و`where.push('…?')`)، والقيم بـ`?`؛ فـ«واحدٌ يأخذ من الواجهة» (`kind`) كما هو.
- **الوثائق** (`9c50720`): «عقد الجسر» سطر «اسم SQL» (٦٤ نداءً في ١٦ ملفًّا) · BACKLOG A04: «والقاعدة ٩ تقرأ القالب ولو بدأ في السطر التالي — D73 ✅» بدل «وبقي…» · `system.md` سطرا A04.
- **الفحص:** `structure` `lint` `docsBudget` `repoHygiene` ١٨ ✓ · `typecheck` ✓ (خروج ٠) · لا بايت تحكّم · `src/` لم يُمسّ · `channels.allow.json` كما هو.
- **كيف يُراجَع:** القاعدة ٩ تطابق `s.text` (`structure.test.ts:345`)، و`SQL_TEMPLATES` ستّة عشر وتعليق `questionBank.ts` فوقه · وأعِد الكسر (أ): ✗ ثم ✓ بعد الإعادة.
  **التالي:** `/next` يراجع D73 ثم D74 ⚙️ (وD74 يتوقّف 🛑 إن احتاج حزمةً جديدة أو تغيير `dependencies`).

## ٢٠٢٦-١٠-١٨ ١٣:٢٣ — مراجعة D72 ✓ · وحجز D73 🔒
- **رسالة المالك:** `/next`.
- **D72 بـ«كيف يُراجَع»:** `grep -rn "clearWorkDir" src/main` ← تعريفها (`backup.ts:227`) والاستيراد ونداءٌ واحد (`index.ts:278`) بعد `recoverIncompleteRestore` ومعالجة «recovered»،
  و`if (!primary) return;` أوّل `whenReady` (`:223`) · `grep -n "mkdirSync(workDir" src/main/services/backup.ts` ← `:151` وحده في أوّل `openBackup` ·
  والسقوط أعدتُه بنفسي (حذف السطر ١٥١، لم يُودَع) ← ✗ «ENOENT: no such file or directory, open '…\restore-work\inspect-1-1.db'»، وبعد `git checkout` `backup` ١٢ ✓. ✓
- **شروط D73:** D72 ✅ ومُراجَع · النمط على النصّ كلّه في `src/main` ستّة عشر، وسطرًا سطرًا خمسة عشر، والزائد `services/questionBank.ts` وحده (ولا ناقص) ·
  `git log -S'FROM question_bank ${where' … | tail -1` ← `08e9e0d`. **التالي:** D73 (جارٍ).

## ٢٠٢٦-١٠-١٨ ١٢:٥٠ — D72 ✅ — `restore-work` يُنشأ قبل كلّ فكّ ويُفرَغ عند الإقلاع (A16، A09 أ) · والتوقّف هنا (ر160)
- **A16** (`96448d9`): `mkdirSync(workDir…)` في أوّل `openBackup` (`backup.ts:151`) وحُذف من فرعي التشفير والوصف · وحالة «والقديمة غير المشفّرة تُفحص على جهازٍ لا مجلّد عملٍ فيه»: `legacyBackup(…, null)` تُفكّ قاعدتها إلى
  `restore-work/inspect-1-1.db` غائب وتساويها بايتًا ببايت · **وعلى الكود القديم** (`git show HEAD:…` مؤقّتًا، لم يُودَع) ← ✗ «ENOENT: no such file or directory, open '…\restore-work\inspect-1-1.db'»، وبعد الإعادة ١١ ✓.
- **A09 (أ)** (`ea73ecf`): `clearWorkDir(dir)` تمحو ما في المجلّد وتُبقيه ولا ترمي (الممسوك يُترك ويُعدّ، والغائب ٠)، وتُنادى في `index.ts:278` بعد `recoverIncompleteRestore` ومعالجة «recovered» —
  وشرط `primary` قائمٌ بـ`if (!primary) return;` أوّل `whenReady` فلم يُكرَّر — والعدد غير الصفر بـ`logError('restoreWork', …)` · وحالة «بقايا الفكّ المنقطع»: `inspect-1-1.db` و`restore-1-1.zip` ومجلّدٌ فرعيّ تُمحى، و`before-restore-…` بجانبه كما هو، والغائب لا يرمي ولا يُنشأ.
- **السيناريو** (`e20f275`): `betweenRestarts` تكتب البقيّتين في `data/restore-work`، و`afterRestart` «وبقايا الفكّ المنقطع تُمحى عند الإقلاع، وما جانبًا باقٍ (فارغ)» ✓.
- **الفحص:** `typecheck` ✓ · `backup` `restoreSwap` `structure` ٤٠ ✓ · `docsBudget` `repoHygiene` ٧ ✓ · `eslint` للملفّين ✓ · `electron-vite build` ✓ · `restoreStuck` ١٢ ✓ و`backup` ٢٠ ✓ و`update` ٦ ✓ بلا ✗ ·
  لقطات الرسّام لم تُمسّ · لا بايت تحكّم · `git diff 8b6df57..HEAD --stat` ستّة ملفّات كلّها في «المسموح».
- **الوثائق** (`49706ee`): `system.md` مواضعه الثلاثة (ما بُني وما بقي) · BACKLOG: A09 بـ(أ) ✅ و(ب) FAT32 وحذف `before-restore-*` بتأكيد، وصفّ A16 حُذف و«أُغلق: A16».
- **كيف يُراجَع:** `grep -rn "clearWorkDir" src/main` ← تعريفها (`backup.ts:227`) والاستيراد ونداءٌ واحد (`index.ts:278`) · `grep -n "mkdirSync(workDir" src/main/services/backup.ts` ← `:151` وحده · والسقوط على القديم أعلاه.
  **التالي:** `/next` يراجع D72 ثم D73 ⚙️.

## ٢٠٢٦-١٠-١٨ ١٢:٤٢ — مراجعة D66 ✓ · وحجز D72 🔒
- **رسالة المالك:** `/next`.
- **D66 بـ«كيف يُراجَع»:** `grep -rnw fee src/` ← ثلاثة: `schema.sql:178` `:258` و`documents.ts:150` · `git diff 260ec58..2facfd9 --stat` خمسةٌ وعشرون ملفًّا كلّها في «المسموح» ولا `tools/` ·
  القاعدة ١٠ وسطرها في رأس `structure.test.ts` (السطر ٢٣)، و`structure` ١٠ ✓ · والكسر أعدتُه بنفسي (`fee: number;` في `DocumentRow`، لم يُودَع) ← ١٠ ✗
  «apiArchive.ts:9: المال صامت (ر161): العمود باقٍ في القاعدة ولا يعود إلى الكود»، وبعد `git checkout` ١٠ ✓. ✓
- **شروط D72:** D66 ✅ ومُراجَع · `mkdirSync(workDir` في `services/backup.ts:162` و`:191` · `restore-work` أربعة (`ipc/backup.ts:36` `update.ts:26` `content.ts:68` `:102`) ولا ماحي ·
  و«الصيغة القديمة» تفكّ إلى `join(dir, 'old.db')`. **التالي:** D72 (جارٍ).
