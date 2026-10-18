# دفتر التسليم

> قيدٌ لكلّ جلسة، **الأحدث في الأعلى**، عشرة أسطر على الأكثر: التاريخ والساعة · الأمر · ما تغيّر (الإيداعات) · الفحص ونتيجته ·
> المراجعة (أيّ أمرٍ رُوجع وبأيّ نتيجة) · أين توقّف بالضبط · الخطوة التالية.
>
> الأقدم في `docs/legacy/LOG-*.md` (يُبحث فيه بـGrep). وحين يزيد الدفتر على ١٠٠ ك.ب ينقل الأمر الخاتم أقدم قيوده بنصّها — إلا قيود ما لم يُراجَع —
> إلى `docs/legacy/LOG-<التالي>.md` (يحرسه `tests/docsBudget.test.ts`).

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

## ٢٠٢٦-١٠-١٨ ١٢:٣٢ — D66 ✅ — `fee` يُزال من الكود ويبقى في القاعدة بصفره (ر161)، والقاعدة ١٠ «المال صامت» · والتوقّف هنا (ر160)
- **ما تغيّر:** `fee` حُذف من `DocumentRow` `DocumentDetail` `IssueInput` `TransactionSheet` `TransactionResult` و`CitizenDocumentRow`، ومن `ROW_COLUMNS` و`getDocument` و`listCitizenDocuments`،
  ومن `INSERT INTO documents` (العمود وعلامته) و`INSERT INTO transactions` (وجمعه)، و`issueTransaction` لا يعيده، والكاتبان في الواجهة لا يرسلانه (وتعليق «المال صامت» باقٍ في `useIssue.ts`) — `b6d41fb`.
- **الاختبار:** الأربعة عشر بلا `fee` (`documents` بحالاته، و`sheetStyle` بتفكيكه) · «وأجرتها مجموع أوراقها» ← «والأجرة صامتة (ر161)»: ثلاث أوراق، والجواب بلا `fee`، و`transactions` `{sheets:3, fee:0}`،
  و`documents` الثلاثة `fee` ٠، و`getDocument` وصفوف `listDocuments` بلا `fee` · و«وكتبه في ملفّه بلا أجرة» (`listCitizenDocuments`) · `auditFixes` كما هو — `b6d41fb`.
- **القاعدة ١٠** (`5a90ebb`): كلّ سطرٍ في `src/` فيه `\bfee\b` تعريفُ العمود في `schema.sql` أو `documents.ts` وحده، وعددها ٣ · **الكسر** (`fee: number` في `DocumentRow`، لم يُودَع) ← ١٠ ✗ «apiArchive.ts:18: المال صامت (ر161)…»، وبعد `git checkout` ١٠ ✓.
- **الفحص:** `typecheck` ✓ · الأربعة عشر و`structure` و`auditFixes` و`migrationRunner` ٢١٨ ✓ (و`load` بـ`DIWAN_LOAD=1` ✓، و`makeReleaseDb` يحتاج `RELEASE_OUT` فتُرك) · `lint` ✓ · `docsBudget` `repoHygiene` ٧ ✓ ·
  `electron-vite build` ✓ · `issue` ١١٣ ✓ («والرسوم صفرٌ صامت») و`service` ٦٣ ✓ («والأجرة صفرٌ صامت» «ولا أجرة على ورقة») بلا ✗ · لقطات الرسّام لم تُمسّ · لا بايت تحكّم · `tools/` لم يُمسّ.
- **الوثائق** (`2facfd9`): `records.md` سطرا A06 · BACKLOG «أُغلق: A06» · OWNER-GUIDE §٧ · حال ر161. **كيف يُراجَع:** `grep -rnw fee src/` ← `schema.sql:178` `:258` و`documents.ts:150` ·
  `git diff 260ec58..2facfd9 --stat` بلا `tools/` · القاعدة ١٠ وسطرها في الرأس · والكسر أعلاه. **التالي:** `/next` يراجع D66 ثم D72 ⚙️.

## ٢٠٢٦-١٠-١٨ ١٢:١٩ — مراجعة D71 ✓ · وحجز D66 🔒
- **رسالة المالك:** `/next`.
- **D71 بـ«كيف يُراجَع»:** الخمسة ٥٧ ٥٣ ٤٥ ٥٤ ٤٨ سطرًا · `grep -rnw fee src/` ← عشرون (الثلاثة الباقية `schema.sql:178` `:258` و`documents.ts:150`)، والواجهة كاتبان وحدهما،
  و`tests/` ستّة عشر، و`tools/scenarios/` ثلاثة عشر: عشرةٌ تمرّره، و`issue` (`SELECT * FROM documents`) و`service` يقرآنه من القاعدة، و`orders` نمطٌ لا يخصّه ·
  `mkdirSync(workDir` في `services/backup.ts:162` و`:191` داخل الفرعين، و`restore-work` أربعة ولا ماحي، وحالة الصيغة القديمة تفكّ إلى `old.db` · القاعدة ٩ بـ`SQL_TEMPLATES`
  و`questionBank.ts:118` (`${where…}`) · ملفّ القفل `i/crlf` ولا `overrides` · وكلّ ⚙️ بلا سؤالٍ ولا أداة (وD74 يتوقّف 🛑 إن ظهر اسمٌ جديد)، وD75 بلا كود، والترتيب مقبول. ✓
- **شروط D66:** D71 ✅ ومُراجَع، ولا ⬜ قبله. **التالي:** D66 (جارٍ).

## ٢٠٢٦-١٠-١٨ ١٢:١٦ — D71 ✅ 🧭 — خمسة أوامر: D66 D72 D73 D74 ⚙️ وD75 🧭، وسطر D76 · والتوقّف لتراجعها الجلسة التالية
- **ما تغيّر:** نصّ D71 من سطره (`aea571c`) · `docs/orders/D66.md` و`D72.md`–`D75.md` وسطورها في PLAN، وسطر D76 🧭 (A09 ب، A13 A14 A15، وA17 A18 بعد إصدار) — `d6e6ee9`.
- **الترتيب وسببه:** D66 A06 (ر161 ينتظر، ويمسّ `services/documents.ts` قبل تقسيمه) · D72 A16 وA09 أ («ENOENT» إنكليزيّ في الاسترجاع، وبقايا `restore-work` لا تُمحى) ·
  D73 A04 (القاعدة ٩ سطرًا سطرًا) · D74 A12 (الشبكة وملفّ القفل بعد الحرّاس) · D75 A11 (١٦ ملفًّا، ٩٣٢٠ سطرًا: جردٌ ثم تصميمٌ ثم أوامر).
- **وقائع بأوامر بحث:** `grep -rnw fee src/` ← ٢٠ (ثلاثةٌ تعريف العمود تبقى)، و`tests/` ١٦ ملفًّا، و`tools/scenarios/` عشرةٌ تمرّره (تبقى: الجسر يتجاهله) و`issue` `service` يقرآنه صفرًا ·
  `openBackup` ينشئ `workDir` في فرعين وحدهما، ولا شيء يمحو `restore-work` · فحص النصّ كلّه يجد `questionBank.ts` وحده زائدًا (منذ `08e9e0d`) · `npm audit --omit=dev` ← 3
  (brace-expansion عالية عبر `archiver`، وuuid 8.3.2 تحت exceljs) و`npm view pdf-lib version` ← 1.17.1 = المثبَّت · `ImportPlanDialog.tsx` ٣٩٦ وسقفه ٤٤٤.
- **وقرّرتُ في الكتابة:** مدخلات السيناريوهات العشرة لا تُمسّ في D66 (حذفها عشرة تشغيلاتٍ بلا أثر)، و`questionBank.ts` يُضاف إلى القائمة مرّةً لا يُعاد كتابته (يضيّع الفهرس).
- **الفحص:** الأوامر ٦٥ ٥٧ ٥٣ ٤٥ ٥٤ ٤٨ سطرًا · برنامجٌ في المسودّات قرأ كلّ مسارٍ واسمٍ بين علامتين: الغائب «جديد» (`clearWorkDir` و`D77.md`) أو خارج الكود (`archiver` `v4`
  و`diwan-backup.json` و`inspect-1-1.db`)، وصحّح `ArchiveRow` ← `DocumentRow` · لا بايت تحكّم · `docsBudget` `repoHygiene` ٧ ✓ · وثائقُ وحدها، و`npm` قراءةٌ بلا تثبيت.
- **كيف يُراجَع:** اقرأ الخمسة قبل D66: أمواضعها كما وُصفت؟ أيُنفَّذ كلّ ⚙️ بلا سؤالٍ ولا أداة؟ وD75 بلا كود؟ **التالي:** `/next` يراجع D71 ثم D66 ⚙️.

## ٢٠٢٦-١٠-١٨ ١٢:٠٥ — مراجعة D70 ✓ · وحجز D71 🔒
- **رسالة المالك:** `/next`.
- **D70 بـ«كيف يُراجَع»:** `grep -n "handleChecked" src/main/ipc/*.ts` ← تعريفه (`checked.ts:13`) وقناتا `revisions:list`/`get` (`templates.ts:112–113`) وحدهما ·
  `channels.allow.json` ٢٠٣ اسمًا · وأمر جرد D65 (منسوخًا من قيده ببرنامج) ← `203 | … 62 34 23 68 0 16 | بالبوّابة 26` · والكسر أعدتُه بنفسي (`elements:probe`
  بـ`ipcMain.handle` في `ipc/elements.ts`، لم يُودَع): القاعدتان ٤ و٩ ✗ «ليست في tests/channels.allow.json — سجّل القناة الجديدة بـhandleChecked…»، وبعد `git checkout` ٩ ✓. ✓
- **D71 بلا نصّ أمر** (سطرٌ في PLAN) — فكتبتُه من سطره بطريقة D60 (`docs/orders/D71.md`)؛ وشروطه: D70 ✅ ومُراجَع، ولا ⬜ قبله إلا D66 (يعتمد عليه)، ولا نصّ لـD66 ولا D72–D75. **التالي:** D71 (جارٍ).

## ٢٠٢٦-١٠-١٨ ١١:٥٥ — D70 ✅ — القناة الجديدة تُنمَّط: `@shared/bridgeGuards` و`handleChecked`، والقاعدة ٩ «القنوات القائمة» · والتوقّف هنا (ر160)
- **ما تغيّر:** `bridgeGuards.ts` (`id` `text(max)` `oneOf` `optional` `listOf`، خالصةٌ ورسالتها تسمّي المعامل) و`handleChecked` في `ipc/checked.ts` (ينادي `ipcMain.handle` فتلفّه البوّابة والترجمة، والزائد يُرفض) — `9d3f38d` ·
  `revisions:list`/`get` بـ`oneOf(KINDS)` و`id`، و`isKind` حُذف (لا منادي له) — **والنوع المجهول كان يعيد `[]`/`null` وصار يُرفض برسالة**، والواجهة لا ترسل إلا المعروف (`RevisionsMenu`: `template`/`letterhead`) ·
  القاعدة ٤ تعدّ `handleChecked('…'` مجيبًا، والقاعدة ٩: كلّ `ipcMain.handle/on('…'` في `tests/channels.allow.json` (٢٠٣، وسقفها لا يرتفع)، والاسم غير الحرفيّ خارج `checked.ts` يُرفض، و`${}` في SQL في الخمسة عشر، والقائمتان بالاتّجاهين — `b1c2212`.
- **وزيادةٌ في التوقيع:** `G & {…}` و`NoInfer` بدل `G extends Record<…>` — فـ`{ kind: oneOf(…) }` المكتوب في النداء كان يسقط نوعه إلى العامّ إن كان المعالج دالّةً مسمّاة (جرّبتُ سبعة توقيعات في ملفٍّ مؤقّت، ونقلتُه خارج المستودع).
- **الاختبار:** `bridgeGuards` ٨ ✓ (`'1'` `-1` `0` `1.5` `NaN` لـ`id`، والطول، وغير العضو، و`ids[2]`، والسليم يصل كما هو، والفاسد والزائد لا يصلان) · **الكسر** (`elements:probe` بـ`ipcMain.handle` في `ipc/elements.ts`، لم يُودَع) ← القاعدتان ٤ و٩ ✗
  «ليست في tests/channels.allow.json — سجّل القناة الجديدة بـhandleChecked وحرّاسها»، وبعد `git checkout` ٩ ✓ · وثلاثةٌ زائدة بالطريقة نفسها: اسمٌ زائلٌ في القائمة · `${}` في `questionBank.ts` · اسمٌ بقالب — كلٌّ برسالته.
- **البناء والسيناريو:** `electron-vite build` ✓ · `letterTools` ٢٦ ✓ بلا ✗ · وسيناريو مؤقّت (خارج المستودع) على البناء نفسه: السليم يمرّ، و`'documents'` و`'1'` و`1.5` تُرفض برسالتها عبر الجسر الحقيقي، والنسخة الغائبة `null` كما كانت.
- **الفحص:** `typecheck` ✓ · الخمسة في «الفحص» ٣٨ ✓ (٨ ٩ ١ ١٦ ٤) · `docsBudget` `repoHygiene` ٧ ✓ · لقطات الرسّام لم تُمسّ · لا بايت تحكّم · «كيف يُراجَع»: `handleChecked` تعريفه وقناتا `revisions:*` وحدهما، وأمر الجرد ← `203 | … 62 34 23 68 0 16 | بالبوّابة 26`.
- **الوثائق** (`38a0ebe`): «عقد الجسر» D70 ✅ و«اسم SQL» · «إضافة أداةٍ اليوم» · §١ `ipc/` ٢٤ · BACKLOG A04 · `system.md`. **وثغرةٌ خارج النطاق:** `prepare(` في سطرٍ وقالبه بـ`${}` في التالي (`questionBank.ts`) لا تراه القاعدة —
  جرد D65 كان بسطرٍ واحد فجاءت القائمة خمسة عشر؛ وسطر «نقاط الضعف» في §١ ما زال يقول «بلا تحقّقٍ موحّد» (خارج المسموح). **التالي:** `/next` يراجع D70 ثم D71 🧭.

## ٢٠٢٦-١٠-١٨ ١١:٣٥ — مراجعة D69 ✓ · وحجز D70 🔒
- **رسالة المالك:** `/next`.
- **D69 بـ«كيف يُراجَع»:** `grep -n "handOut\|wasHandedOut" src/main/ipc/*.ts` ← خمسةٌ تعطي (`backup.ts:105` `274` `315` `364` و`update.ts:35`) وستٌّ تفحص (`backup.ts:284` `322` `327` `368` `375` و`update.ts:40`) ·
  `grep -rn "includes('..')" src/main/ipc/` لا شيء · والكسر أعدتُه بنفسي (`wasHandedOut` يعيد `true`، لم يُودَع): `handedPaths.test.ts` ٢ ✗ («وما لم يُعطَ يُرفض…» و«ومسارٌ فارغ…»)، وبعد `git checkout` ٥ ✓ ·
  وفحوص `harden` بكسرها «0 ← 1» في القيد. ✓
- **شروط D70:** أمر جرد D65 ← `205 | … 62 34 23 68 2 16 | بالبوّابة 26` · `` grep -rlE '(prepare|exec)\(\s*`[^`]*\$\{' src/main `` ← ١٥ ملفًّا · `revisions:list`/`get` بـ`isKind` تعيدان `[]`/`null` (`templates.ts:111–115`) ·
  لا `bridgeGuards` ولا `handleChecked` ولا `tests/channels.allow.json`. **التالي:** D70 (جارٍ).

## ٢٠٢٦-١٠-١٨ ١١:٣٢ — D69 ✅ — المسارات عند الباب: ما أعطته الرئيسة (`handedPaths`) وما في المخزن (`storeFile`) · والتوقّف هنا (ر160)
- **ما تغيّر:** `ipc/handedPaths.ts` (جديد، لهذا التشغيل وحده): `handOut` في خمس (`backup:pick` `mirrorPick` `autoPickDir` و`createBackup` و`update:pick`) و`wasHandedOut` في ستّ (`inspect` `restore` `mirrorInspect`
  `mirrorRestore` و`update:install` قبل `createPreUpdateBackup`، و`autoSet` يقبل المحفوظ أيضًا) — `bbff476`، و`backup.ts` ٣٩٨ · و`storeFile` في `localPaths.ts` (ملفٌّ موجودٌ داخل المخزن، والمطلق يُرفض) لـ`clients:setLogo`
  و`seals:add` («الصورة خارج مخزن ديوان — اخترها ثانيةً») ولصور Word في `output:saveDocx` و`templates:export` (`documents.ts` ٤٧٣ ← ٤٧٠، والسقف لم يُخفض)، و`checkBucket` قبل الحوار في الثلاث — `a513e8f`.
- **وتغيّرٌ صغير:** صورةٌ في المخزن موجودةٌ وتتعذّر قراءتها (مقفلة) تُسقط تصدير Word برسالتها بدل أن تُترك صامتة — فالكتلة قصرت كما طلب الأمر، والغائب يحسمه `storeFile` قبلها.
- **الاختبار** (`b76f9f9`): `handedPaths` ٥ ✓ و`localPaths` ١٠ ✓؛ والكسر المؤقّت (`wasHandedOut` يقبل كلّ شيء، لم يُودَع) ← ٢ ✗ ثم ٥ ✓ بعد الإعادة.
- **السيناريوهات** (`43e56a2`، على `electron-vite build`): `harden` ١٨ ✓ — أربعةٌ جديدة: `win.ini` يُرفض في الفحص والتثبيت ونسخ ما قبل التحديث «0 ← 0»، و`../diwan.db` يُرفض، والشعار بمسار المخزن يمرّ؛ وكسر باب التحديث
  مؤقّتًا أسقطها «0 ← 1» ثم ١٨ ✓ بعد الإعادة · `backup` ٢٠ `restoreStuck` ١١ `autoBackup` ٢٢ `update` ٦ `designBrandKit` ٧ `deleteGuards` ٣٣ `letterhead` ٤٠ — ١٥٧ ✓ بلا ✗.
- **الفحص:** `typecheck` ✓ · الستّة في «الفحص» ٤٢ ✓ · `docsBudget` `repoHygiene` ٧ ✓ · لقطات الرسّام لم تُمسّ · لا بايت تحكّم · وبحث «كيف يُراجَع»: خمسٌ تعطي وستٌّ تفحص، و`includes('..')` لا شيء
  (و`'\0'` في `wasHandedOut` صار `'\u0000'` كي لا يطابقه). **الوثائق** (`89d6e38`): «عقد الجسر» سطر D69 ✅ · §١ `ipc/` ٢٣ · BACKLOG A04 (١). وبقي سطر «نقاط الضعف» في §٢ يقول «عشرٌ بلا فحص» (خارج المسموح). **التالي:** `/next` يراجع D69 ثم D70 ⚙️.

## ٢٠٢٦-١٠-١٨ ١١:١٢ — مراجعة D68 ✓ · وحجز D69 🔒
- **رسالة المالك:** `/next`.
- **D68 بـ«كيف يُراجَع»:** القاعدة ٨ في `structure.test.ts:251` بأقسامها الأربعة (Node · الواجهة و`connect-src` · السبع · الترخيص) وقوائمها الصريحة، وسطرها ٨ في الرأس ·
  الكسور الأربعة ونتائجها في القيد، والأوّل أعدتُه بنفسي (`fetch('https://example.com')` في `clock.ts`، لم يُودَع) ← ١ ✗ «src/main/clock.ts: ينادي fetch(»، وبعد `git checkout` ٨ ✓ ·
  `git diff --stat 5cc29c8..96c1163 -- src` فارغ. ✓
- **شروط D69:** أمر جرد D65 (منسوخًا من قيده) ← `205 | … 62 34 23 68 2 16` (١٦ مسارًا) · `backup:inspect`/`restore` يناديان `openAndInspect(path` و`mirrorInspect`/`mirrorRestore` `readMirror(path` كما جاء ·
  `createPreUpdateBackup` (`update.ts:39`) قبل `readUpdate` (٤١) · `includes('..')` في `documents.ts:457` و`templates.ts:271` · `documents.ts` ٤٧٣/٤٧٣ و`backup.ts` ٣٩١ · لا `handedPaths` ولا `storeFile(` في `src/`.
  **التالي:** D69 (جارٍ).

## ٢٠٢٦-١٠-١٨ ١١:٠٧ — D68 ✅ — القاعدة ٨ «الأبواب الواحدة» في `structure.test.ts`: الشبكة والاعتماديات وحال الترخيص · والتوقّف هنا (ر160)
- **ما تغيّر** (`5ff63d4`؛ `tests/structure.test.ts` وحده، ٢٤٧ ← ٣٠٣ سطرًا): سطر ٨ في الرأس، و`it('٨ — …')` بأربعة أقسام وقوائم صريحة (`NET_MODULES` `NET_FETCH` `CONNECT_SRC` `DEPENDENCIES`
  `LICENSE_SERVICE` `LICENSE_STATUS` `PRODUCTIVE`): (١) Node بلا وحدة شبكة ولا `fetch(` ولا `XMLHttpRequest`/`WebSocket`/`EventSource`/`sendBeacon`، و`net.fetch|request(` في `main/index.ts` وحده ·
  (٢) `fetch(` الواجهة أوّله `diwan://` و`connect-src` واحدٌ `'self' diwan:` · (٣) `dependencies` السبع بالاتّجاهين · (٤) `services/license` و`licenseStatus(` و`requireProductive(` في ملفّاتها. و٨ ✓ على القائم.
- **الكسور الأربعة** (كلٌّ وحده، `git checkout -- src` بعده، لم تُودَع): `fetch('https://example.com')` في `clock.ts` ← «ينادي fetch(» · `import 'node:https'` في `arabic.ts` ← «يستورد وحدة الشبكة» (ومعها القاعدة ١) ·
  `https:` في `connect-src` ← «connect-src «'self' diwan: https:»» · `licenseStatus(true)` في `ipc/backup.ts` ← «ينادي licenseStatus(» — وبعد الإعادة ٨ ✓ ·
  **وأربعةٌ زائدة** بالطريقة نفسها: `fetch(\`https://…\`)` في `UploadExportDialog` · `axios` في `package.json` · استيراد `services/license` في `backup.ts` · `net.fetch` في `clock.ts` — كلٌّ أسقطها برسالته.
- **الوثائق** (`03f50dd`): «عقد الجسر» سطر D68 ✅ · BACKLOG A04 (٢) و(٣) · `system.md` سطرا A04 · ونُقل الأمر.
- **الفحص:** `typecheck` ✓ · `structure` `lint` `gate` `license` **٤٠ ✓** · `docsBudget` `repoHygiene` ٧ ✓ · لا بناء ولا سيناريو (`src/` لم يتغيّر) · لا بايت تحكّم.
- **وثغرةٌ خارج النطاق:** حزمة شبكةٍ في `devDependencies` تُستورد في الرئيسة تُحزم فيها ولا تراها القاعدة (تمنع `http` في `src` لا داخل الحزم) — يحسمها أمرٌ لاحق. **التالي:** `/next` يراجع D68 ثم D69 ⚙️.

## ٢٠٢٦-١٠-١٨ ١١:٠٠ — مراجعة D67 ✓ · وحجز D68 🔒
- **رسالة المالك:** `/next`.
- **D67 بـ«كيف يُراجَع»:** `git show 673923e`: `const cut = shingles(item.text)` مرّةً في `groupDuplicates` (والمجموعة تحفظ `cuts`)، و`similarity(a: string | Set<string>, …)`، و`blanks.ts` ٦٥٨ وسقفه ٦٥٨ ·
  والكسر أعدتُه بنفسي (`shingles(items[0]!.text)`، لم يُودَع): `blanks.test.ts` ٣ ✗ منها الجديدة في سطر `toEqual(expected)`، وبعد `git checkout` ٤٦ ✓ ·
  الأرقام الثلاثة ووسيطها في القيد بجانب D62 · وA19 وA07 مغلقان، وS44 أوّله «قراءة تنسيق Word في استيراد التصاميم — عالٍ» نصّ A07 القديم. ✓
- **شروط D68:** الشبكة سطران وحدهما (`main/index.ts:240` `net.fetch` و`UploadExportDialog.tsx:52` `diwan://store/`) · `connect-src 'self' diwan:` · السبع · `services/license` في `ipc/license.ts` وحده،
  و`licenseStatus(` خارجه في `support.ts:26` وحده و`requireProductive(` في `gate.ts:83` وحده. **التالي:** D68 (جارٍ).

## ٢٠٢٦-١٠-١٨ ١٠:٥٦ — D67 ✅ — كشف المكرّر بقطعٍ تُحسب مرّةً: «استورد مجلدي» بخمسمئة ملف ١٠٠٢٠ ← ٢٩٠ م.ث · والتوقّف هنا (ر160)
- **ما تغيّر:** `similarity` تقبل نصًّا أو قطعًا محسوبة، و`groupDuplicates` يحسب `shingles(item.text)` مرّةً لكلّ عنصر ويحفظ القطع بدل النصوص (`673923e`؛ `blanks.ts` ٦٥٨/٦٥٨ بـ`continue` بدل كتلة `if`) ·
  حالة «والقطع تُحسب مرّةً لكلّ نصّ» (`6368f38`): ستّون نصًّا مختلَقًا في ١٣ مجموعةً متداخلة (ستٌّ على العتبة ٠٫٩٥ بالضبط) تساوي `toEqual` مرجعًا بالطريقة القديمة؛ والكسر المؤقّت (`shingles(items[0]!.text)` للكلّ) أسقطها ومعها حالتان قديمتان، و٤٦ ✓ بعد الإعادة.
- **القياس** (`gen.mjs` و`measure.mjs` من مجلّد جلسة D62 كما هما إلا مسار الجلسة، لم يُودعا؛ المجلّد ٦٧٥١٨٠٧ بايت كما في D62؛ بناء التطوير؛ بترتيب التشغيل ثم الوسيط، وبين القوسين D62):
  **حلقة الرئيسة** ٢٩٨ ٢٩٠ ٢٩٠ ← **٢٩٠ م.ث** (١٠٠٢٠) · أطول ردٍّ قبل المراجعة ٤٣٧ ٤٠١ ٤٢٩ ← **٤٢٩** (١٠٢٥٦؛ وفيه رسم البطاقات في الواجهة) · حتى المراجعة ٩٦٣٤ ٤٨٨٩ ٤٩١٣ ← **٤٩١٣** (٢٠٢٦٥) ·
  الذروة ٥٨٤ ٦٠١ ٥٩٢ ← **٥٩٢ م.ب** (٥٩١) · و«سيُحفظ 500 من 500» في الثلاث. وExcel لم يُعد (١٨٨ في D62).
- **ومرّةٌ رابعة بملفّ أداء** (زيادةٌ تسمّي البقيّة لا شرط؛ فجوتها بالمفتّش ٣٢٦): `groupDuplicates` **١١٠** (كان ٨٢٥٤) و`applyHabits` ١١٢ و`applyBlankFields` ٥٦ و`formsOf` ٤٤ — فالبقيّة موزّعةٌ، والهامش رفيع: مجلّدٌ أكبر أو جهازٌ أبطأ قد يتجاوز ٣٠٠.
- **الوثائق:** دون ٣٠٠ فأُغلق A19 وA07 (السقوف D51، والمهلة D55، وما في الرئيسة لا يجمّدها)، وS44 جديد في designs بنصّ A07 · ARCHITECTURE §١ و§٢ · `editor.md` `system.md` `designs.md` (`5237292`) · ونُقل الأمر.
- **الفحص:** `typecheck` ✓ · `blanks` `importFolder` `structure` `lint` **٨٢ ✓** · `docsBudget` `repoHygiene` ٧ ✓ · `electron-vite build` ثم `importFolder` ✓٣٤ و`excelImport` ✓١٩ بلا ✗ (كما في D57) · لقطات الرسّام كما هي · لا بايت تحكّم.
- **خارج النطاق:** `docs/sections/pdf.md:65` ما زال يقول «وبقيت المهلة (A07 مع A03)» — ليس في مسموح D67، فيصحّحه D71 أو أوّل أمرٍ يمسّ `pdf.md` · **وزلّة:** دفعتُ `16615d6` وهذا القيد ١٢ سطرًا (`docsBudget` ✗)، فاختصرتُه في الإيداع التالي.
  **كيف يُراجَع:** كما في الأمر. **التالي:** `/next` يراجع D67 ثم D68 ⚙️.

## ٢٠٢٦-١٠-١٨ ١٠:٤٥ — مراجعة D65 ✓ · وحجز D67 🔒
- **رسالة المالك:** `/next`.
- **D65 بـ«كيف يُراجَع»:** أعدتُ أمر الجرد كما في قيده (منسوخًا من الدفتر نفسه) ← `205 | … 62 34 23 68 2 16 | بالبوّابة 26` — الأعداد نفسها ·
  ومواضع الأوامر الأربعة مفحوصةٌ ببرنامج: كلّ ملفٍّ وسيناريو مذكور موجود، ودوالّ «كشف المكرّر» في `blanks.ts` (٥٥٢–٦١٠، والملفّ ٦٥٨ وسقفه ٦٥٨)، وسطرا الشبكة وحدهما و`connect-src 'self' diwan:`
  والاعتماديات السبع، و`services/license` في `ipc/license.ts` وحده و`licenseStatus(` في `support.ts:26` و`requireProductive(` في `gate.ts:83`، وقنوات D69 بأسطرها
  (`includes('..')` في `documents.ts:457` و`templates.ts:271`، و`createPreUpdateBackup` قبل `readUpdate` في `update.ts:39`)، و`isKind` و`revisions:*` في `templates.ts:17–114`، و`${}` في SQL في ١٥ ملفًّا ·
  ولا `handedPaths` ولا `bridgeGuards` ولا `handleChecked` ولا `channels.allow.json` بعد · كلّها ⚙️ بلا مكتبةٍ ولا سؤال، والترتيب مقبول (A19 المقيس أوّلًا، ثم أرخص الحرّاس). ✓
- **التالي:** D67 (جارٍ).

## ٢٠٢٦-١٠-١٨ ١٠:٤٠ — D65 ✅ 🧭 — عقد الجسر: الجرد والتصميم في ARCHITECTURE §٢، وأوامر D67–D70 · والتوقّف لتراجعها الجلسة التالية
- **أمر الجرد** (Bash من جذر المشروع؛ شجرة TypeScript، وأخطر مدخلٍ لكلّ قناة) ← `205 | … 62 34 23 68 2 16 | بالبوّابة 26`: `node -e "const ts=require('typescript'),fs=require('fs'),G=fs.readFileSync('src/main/ipc/gate.ts','utf8'),c=[0,0,0,0,0,0];let n=0,g=0;for(const f of [...fs.readdirSync('src/main/ipc').map(x=>'src/main/ipc/'+x),'src/main/index.ts']){const s=ts.createSourceFile(f,fs.readFileSync(f,'utf8'),99,true);const w=e=>{if(ts.isCallExpression(e)&&/^ipcMain\.(handle|on)$/.test(e.expression.getText(s))&&ts.isStringLiteral(e.arguments[0])){const h=e.arguments[1],b=h.body?h.body.getText(s):'';n++;if(G.includes(\"'\"+e.arguments[0].text+\"'\"))g++;c[(h.parameters||[]).slice(1).map(p=>{const v=p.name.getText(s),t=p.type?p.type.getText(s):'';return /^(path|paths|dir|url|bucket)$|Path$/.test(v)||/\b(path|dir|imagePath)\??:/.test(t)||b.includes('join(')&&b.includes('$'+'{'+v+'}')||/\bDoc\b/.test(t)&&b.includes('storeDir(')?5:v=='kind'&&/[Rr]evision/.test(b)?4:/^(number|number\[\]|boolean)( \| (null|undefined))*$/.test(t)?1:/^(string|string\[\]|'[^']*'( \| '[^']*')*)( \| (null|undefined))*$/.test(t)?2:3}).reduce((a,k)=>Math.max(a,k),0)]++}ts.forEachChild(e,w)};w(s)}console.log(n,'| بلا مدخل · أرقام · نصوص · كائنات · اسم SQL · مسار:',c.join(' '),'| بالبوّابة',g)"`
- **وما قرأتُه بيدي:** الأبواب `grep -cE "\binvoke(<[^>]*>)?\(\s*'|ipcRenderer\.(send|sendSync)\(\s*'" src/preload/*.ts` ← المكتب ٥٥ الأدوات ٥٤ النماذج ٤٦ المواطنون ٢٦ الأرشيف ١٦ المكتبة ٨ ·
  المسارات الستّ عشرة: ستٌّ يفحصها معالجها وعشرٌ لا (أسماؤها في «عقد الجسر») · اسم SQL: `` grep -rnE '(prepare|exec)\(\s*`[^`]*\$\{' src/main `` ← ٤٩ في ١٥ ملفًّا، والآتي من الواجهة `TABLE[kind]` وحده (بـ`isKind`) ·
  الشبكة سطران (`net.fetch` و`diwan://`) · والترخيص من `licenseStatus` وحدها، و`services/license` لا يستورده غير `ipc/license.ts`.
- **A19 قبلها (D65 §٣):** D62 سمّى `groupDuplicates` لا القراءة، فقستُ في Node (`esbuild` لـ`blanks.ts`، خمسمئة نصٍّ مختلَق بـ١٧٤ كلمة): القائم ١٥٣٩٢ ١٤٩٧٨ ١٥٢٢٣ ← **١٥٢٢٣ م.ث** والقطع مرّةً
  ١٥٢ ١٤٣ ١٥٢ ← **١٥٢**، والمخرجان متساويان — فـD67 علاجٌ بلا نقل، لا «نقلٌ بفصل `planFolderImport` عن القاعدة» كما توقّع نصّ D65.
- **الأوامر:** D67 (A19) · D68 حارسا الشبكة والترخيص (أرخصها وأقواها حراسةً، بلا `src/`) · D69 المسارات عند الباب (`handedPaths` و`storeFile`) · D70 `handleChecked` و`channels.allow.json` —
  كلّها ⚙️ بلا مكتبة ولا سؤال · وD71 🧭 لما بقي من الموجة ٣، وD66 صار بعده. **الوثائق:** ARCHITECTURE §٢ «عقد الجسر» و§١ و«ما يتغيّر» (`d7bc480`) · BACKLOG A04 · PLAN · ونُقل الأمر.
- **الفحص:** الأوامر ٥١ ٥١ ٥٥ ٥٢ سطرًا · ما فيها من مسارٍ ودالّةٍ وقناةٍ وسيناريو موجودٌ ببرنامج إلا «جديد» (وأسماء وحدات الشبكة الممنوعة غائبةٌ قصدًا) · `docsBudget` `repoHygiene` ✓ · لا بايت تحكّم · `git diff --stat` وثائقُ وحدها.
- **كيف يُراجَع:** أعِد أمر الجرد فتجد الأعداد نفسها، واقرأ الأوامر الأربعة. **التالي:** `/next` يراجع D65 ثم D67 ⚙️.

## ٢٠٢٦-١٠-١٨ ١٠:٢١ — مراجعة D64 ✓ · وحجز D65 🔒
- **رسالة المالك:** `/next`.
- **D64 بـ«كيف يُراجَع»:** `grep -n "REVISIONS_KEEP\|DELETE" src/main/services/revisions.ts` ← الحذف في `recordRevision` (٨٦–٨٨) بشرط `kind` و`item_uuid` وأحدث `REVISIONS_KEEP` بـ`revision`،
  و`forgetRevisions` (١٢٤) كما كان · الكسر المؤقّت (السقف ٢١) أسقط الحالات الثلاث في قيده · `letterTools.mjs:105` «وتقول إنها تحفظ آخر ٢٠» · وأعدتُ `revisions` **١٦ ✓**. ✓
- **شروط D65:** D62 D63 D64 ✅ · `grep -rcE "ipcMain\.(handle|on|handleOnce|once)\(" src/main/ipc` ← **٢٠٢** `handle` في ٢٢ ملفًّا، وفي `main/index.ts` ثلاثة `ipcMain.on` (٥٩ ٧١ ١٩٢) ·
  الشبكة في الرئيسة: `net.fetch` لملفٍّ محلّي (`index.ts:240`) و`openExternalSafe` (`harden.ts`) وحدهما · لا مكتبة تحقّقٍ في package.json · ولا أمر A04 في `docs/orders/`. ✓
- **التالي:** D65 (جارٍ).

## ٢٠٢٦-١٠-١٨ ١٠:١٨ — D64 ✅ — آخر عشرين نسخةً سابقة لكلّ قطعة، و«تُحفظ آخر ٢٠ نسخة» في القائمة · والتوقّف هنا (ر160)
- **ما تغيّر:** `REVISIONS_KEEP = 20` بجانب `Revision` في `shared/apiTemplates.ts` (يُستورد من `@shared/apiTemplates` لأنّ `@shared/api` أنواعٌ وحدها) · وفي `recordRevision` بعد الإدراج
  `DELETE … WHERE kind AND item_uuid AND revision NOT IN (أحدث عشرين)` في معاملة الحفظ، والحفظ الذي لم يغيّر شيئًا يعود قبله · وفي ذيل `RevisionsMenu` سطرٌ خافت `count(REVISIONS_KEEP, 'نسخة')` ← «تُحفظ آخر ٢٠ نسخة» (`f47979a`) ·
  ثلاث حالاتٍ في `revisions.test.ts` (`c04d0b3`) · وفحص `letterTools` (`16c36a1`). وفي `RevisionsMenu` سطر الاستيراد مع سطر النصّ (والأمر قال «سطرٌ واحد»).
- **الفحص:** `typecheck` ✓ · `revisions` **١٦ ✓** (١٣ + ٣) · `revisions` `structure` `lint` و`tests/ui` **٣٤ ✓** · `electron-vite build` ثم `letterTools` **٢٦ ✓ بلا ✗** (والجديد «وتقول إنها تحفظ آخر ٢٠») ·
  **الكسر المؤقّت:** السقف ٢١ أسقط الحالات الثلاث (٢١ بدل ٢٠)، وحذف شرط `item_uuid` أسقط «لا يُمسّان» وحدها؛ وبعد الإعادة ١٦ ✓ · لقطات الرسّام كما هي · لا بايت تحكّم.
- **كيف يُراجَع:** `grep -n "REVISIONS_KEEP\|DELETE" src/main/services/revisions.ts` ← الحذف في `recordRevision` بشرط `kind` و`item_uuid` (وفي `forgetRevisions` كما كان).
- **الوثائق:** `system.md` سطرا A10 · BACKLOG «أُغلق: A10» وسطر S02 · و`editor.md` لا يصف النسخ السابقة فلم يُمسّ · PLAN · ونُقل الأمر. **التالي:** `/next` يراجع D64 ثم D65 🧭.

## ٢٠٢٦-١٠-١٨ ١٠:١١ — مراجعة D63 ✓ · وحجز D64 🔒
- **رسالة المالك:** `/next`.
- **D63 بـ«كيف يُراجَع»:** `grep` في `autoBackup.ts`: لا `tmpdir`، و`fsyncSync` (١٠٤) قبل `renameSync` الوحيد (١٠٨)، و`readFileSync` في `readManifest` (١٦١) و`readMirror` (٣٥٨ ٣٦٨) وحدهما ·
  جسما `unseal` و`readMirror` بالبصمة نفسها في `df3b4df` و`d4a8e3f` · أرقام القياس قبل وبعد في قيده، وكسر «الوسم في موضعه» أسقط حالتي الفكّ المشفّرتين · وسطر `transient.test.ts` خارج المسموح مذكورٌ بسببه. ✓
- **شروط D64:** `recordRevision` `INSERT OR IGNORE` ثم `revision + 1` بلا `DELETE` ولا حدّ · مناديها الثلاثة (`templates` `letterheads` `clips`) داخل `db.transaction` الحفظ ·
  `RevisionsMenu` يعرض `[data-revisions] [data-revision]` · `revisions.test.ts` ١٣ ✓ · و`letterTools` على البناء القائم ٢٥ ✓ بلا ✗. ✓ — و`@shared/api` يعيد تصدير الأنواع وحدها (`export type *`)، فالثابت يُستورد من `@shared/apiTemplates` كما `apiCitizens` في `ipc/citizens.ts`.
- **التالي:** D64 (جارٍ).

## ٢٠٢٦-١٠-١٨ ١٠:٠٨ — D63 ✅ — النسخة التلقائية: المؤقّت في مجلّد البيانات، وأجزاءٌ و`fsync`؛ ذروتها بقاعدة ٣٠٠ م.ب ١٢٠١ ← ٧٣ م.ب · والتوقّف هنا (ر160)
- **ما تغيّر:** `runAutoBackup` يأخذ `tempDir` إلزاميًّا (`ipc/backup.ts` يمرّر `dataDir()`)، و`diwan-auto-*.db` الباقية فيه تُحذف قبل النسخة وحدها · `eachChunk` بجزءٍ ١ م.ب لـ`hashFile`
  و`copyInto` (المتّجه ثم ١٦ صفرًا ثم `cipher.update` لكلّ جزء ثم الوسم في موضعه ١٢)، و`writeAtomic` إلى `.part` ثم `fsyncSync` ثم `renameSync` وmanifest به (`4da8329`) · حالاتٌ خمس (`db28587`) · واسم المعامل `onChunk` (`3c331f5`).
- **خارج المسموح سطرٌ واحد:** `tests/transient.test.ts` ينادي `runAutoBackup` ولم يذكره الأمر، و`tempDir` إلزاميٌّ بنصّه — فزدتُه له (`mkdtempSync`)؛ بدونه يسقط.
- **القياس** (`esbuild` للملفّ، عمليةٌ لكلّ نداء، قاعدةٌ ٣٠٠ م.ب يُنسخها `snapshotDb`؛ ارتفاع `maxRSS` ثم الزمن، بالترتيب ثم الوسيط) — **قبل:** بلا تشفير ٣٠١ ٣٠١ ٣٠١ ← **٣٠١ م.ب** ·
  ٢٩٠٠ ١١٤٢ ٢١٠٩ ← **٢١٠٩ م.ث** · مشفّرةً ١١١٠ ١٢٠١ ١٢٠٢ ← **١٢٠١** · ٢٣٥٥ ١٦٣٦ ٢٩٩٣ ← **٢٣٥٥** — **بعد:** ٤ ٤ ٤ ← **٤** · ١٠٥٩ ٨٧٦ ٢٣٥٨ ← **١٠٥٩** · ٧٤ ٧٣ ٧٣ ← **٧٣** ·
  ١٢٥١ ١٢٨٠ ٢٧٧٨ ← **١٢٨٠** · وما كُتب بالبايت نفسه قبل وبعد (٣١٤٥٧٣٨٢٤ و٣١٤٥٧٣٨٨٠).
- **الفحص:** `typecheck` ✓ · `autoBackup` `backup` `backupPassword` `restoreSwap` `structure` `lint` `transient` **٦١ ✓** (`lint` أسقط أوّلًا معاملًا اسمه `use` فسمّيته) · `electron-vite build` ثم
  `autoBackup` **٢٢ ✓ بلا ✗** · **الكسر المؤقّت** (لا يُكتب الوسم في موضعه): ٢ ✗ من ١٥ (حالتا الفكّ المشفّرتان)، وبعد الإعادة ١٥ ✓ · لا بايت تحكّم.
- **كيف يُراجَع (أجريته):** لا `tmpdir`، و`fsyncSync` (١٠٤) قبل `renameSync` الوحيد (١٠٨)، و`readFileSync` في `readManifest` و`readMirror` وحدهما · `unseal` و`readMirror` بالبصمة نفسها قبل وبعد.
- **الوثائق:** `system.md` سطرا A08 · BACKLOG «أُغلق: A08» · PLAN · ونُقل الأمر. **التالي:** `/next` يراجع D63 ثم D64 ⚙️.

## ٢٠٢٦-١٠-١٨ ٠٩:٥٨ — مراجعة D62 ✓ · وحجز D63 🔒
- **رسالة المالك:** `/next`.
- **D62 بـ«كيف يُراجَع»:** `git diff 308ab14..ecd5e2c --stat` وثائقُ وحدها (ARCHITECTURE وBACKLOG والدفتر وPLAN و`editor.md` ونقل الأمر) · الثلاثة لكلّ رقمٍ ووسيطها في القيد
  وكلّ وسيطٍ هو أوسط ثلاثته (١٠٠٢٠ ١٠٢٥٦ ٢٠٢٦٥ ٥٩١ · ١٨٨ ١٧٨ ٣٦٥ ٤٩٥) · والحجمان ٦٧٥١٨٠٧ و١٢٩٢٦٢ بايت (٦٫٤ م.ب و١٢٦ ك.ب في A19) · ونصّ A19 يطابق القيد،
  وA07 لم يُمسّ (في BACKLOG سطرٌ واحد تغيّر)، ولا S44. ✓
- **شروط D63:** في `runAutoBackup` `join(tmpdir(), 'diwan-auto-…')` ثم `snapshotDb` ثم `readFileSync` كاملًا ثم `seal` ثم `writeAtomic` (`writeFileSync` ثم `renameSync` بلا `fsync`)،
  والمخزن `readFileSync` ملفًّا ملفًّا · `seal` متّجه ١٢ ‖ وسم ١٦ ‖ المشفَّر، و`lastDbHash` sha256 القاعدة قبل التشفير · `readMirror` يقرأ الملفّ كلّه و`unseal` ·
  `runConfiguredAutoBackup` في `ipc/backup.ts` ويناديها الإغلاق في `index.ts`. ✓
- **التالي:** D63 (جارٍ).

## ٢٠٢٦-١٠-١٨ ٠٩:٥٤ — D62 ✅ — «استورد مجلدي» بـ٥٠٠ ملف يجمّد الرئيسة ١٠٠٢٠ م.ث، وExcel بخمسين ورقة ١٨٨ · والتوقّف هنا (ر160)
- **الملفّان** (`gen.mjs` في مجلّد الجلسة، لم يُودَع): ٥٠٠ Word (٢٥٠ من كلٍّ من `warning-letter.docx` و`school-warning.docx`، وسطرٌ برقمه آخر `word/document.xml`) **٦٧٥١٨٠٧ بايت** ·
  وExcel على مثال `letterSheet` (خمسون ورقة و«الرئيسية») **١٢٩٢٦٢ بايت** · والرقم بالحروف ورمزٌ من عشر كلمات: `shingleText` يُسقط الأرقام، وتجربةٌ أولى بالكلمات وحدها عدّت بعضها نسخًا بـ٩٥٪ (أرقامها ليست من الثلاثة) — والآن «سيُحفظ 500 من 500».
- **القياس** (`measure.mjs`: `electron-vite build` ثم `drive`، طريقة D57؛ بترتيب التشغيل ثم الوسيط) — **المجلّد:** حلقة الرئيسة ١٠٠٢٠ ١١٦٢٨ ٦٠٥٤ ← **١٠٠٢٠ م.ث** (فجوةٌ واحدة بعد القراءة) ·
  أطول ردٍّ قبل المراجعة ١٠٢٥٦ ١١٨٩١ ٦١٣٢ ← **١٠٢٥٦** · حتى المراجعة ٢٥١٧٧ ٢٠٢٦٥ ١٠٥٠٥ ← **٢٠٢٦٥** · الذروة ٥٩١ ٥٦٦ ٦٠٥ ← **٥٩١ م.ب** ·
  **Excel:** ٢٠٤ ١٨٨ ١٨٥ ← **١٨٨ م.ث** · ٢٠٨ ١٧٨ ١٦٦ ← **١٧٨** · ٤٠٩ ٣٦٥ ٣٦٢ ← **٣٦٥** · ٤٩٥ ٤٩٦ ٤٩١ ← **٤٩٥ م.ب**.
- **ملفّ الأداء** (مرّةٌ رابعة للمجلّد، فجوتها ٨٦٣٢): شاملًا `groupDuplicates` **٨٢٥٤** (`similarity` ٨٠٤١ ← `shingles` ٧٩٢٣، وذاتيًّا ٦٠٩٩ و`shingleText` ١٣٢٢) · `importTemplateFile` ٣٨٩٦ في الجملة
  قبلها بلا فجوةٍ فوق ١٠٠ م.ث (في المرّات الأربع) · `storeLetterheadImage` ٣٨٣ · `applyHabits` ٢٠٠ · `applyBlankFields` ٥٨ ← التجميد كشف المكرّر بعد القراءة؛ ورسم ٥٠٠ بطاقة في الواجهة ٢٣١–٤٦٧ م.ث.
- **الوثائق:** BACKLOG A19 بأرقامه وأثقل دوالّه، وA07 كما هو، ولا S44 · ARCHITECTURE §١ و§٢ «الأوامر» · `editor.md` سطر A19 · ونُقل الأمر · **الفحص:** `git status` بلا `src/` `tests/` `tools/` · `docsBudget` `repoHygiene` ٧ ✓ · لا بايت تحكّم.
- **التالي:** `/next` يراجع D62 ثم D63 ⚙️ · وD65 (الخطوة ٤) يكتب أمر المجلّد قبل غيره — والأثقل حسابٌ نقيّ في `shared/blanks.ts` لا قراءة.

## ٢٠٢٦-١٠-١٨ ٠٩:٤٢ — مراجعة D61 ✓ · وحجز D62 🔒
- **رسالة المالك:** `/next`.
- **D61 بـ«كيف يُراجَع»:** كلماته في القيد «D61 ب» هي نصّ ر161 («قال المالك: «D61 ب»») · BACKLOG A06 وOWNER-GUIDE §٧ وسطرا `records.md` تقول الحال نفسه
  (يبقيان في القاعدة بصفرهما ويُزالان من الكود، أمرٌ ⚙️ بعد D65) · `git diff d0f8ce7..3c2605b --stat`: DECISIONS وBACKLOG وOWNER-GUIDE و`records.md` وPLAN والدفتر ونقل الأمر وحدها،
  وفي DECISIONS صفّ ر161 وحال ر152 ور077 لا غير. ✓
- **شروط D62:** `FOLDER_LIMIT = 500` و`planFolderImport` ينتظر `importTemplateFile` ملفًّا ملفًّا ثم `findShared` و`applyBlankFields` و`groupDuplicates` · `templates:planFolder`/`planExcel`
  في الرئيسة بلا عامل · `empty-import-folder` و`new-folder` و`new-excel` تحت `data-import-menu` · `fflate` `exceljs` `esbuild` في package.json. ✓
- **التالي:** D62 (جارٍ).

## ٢٠٢٦-١٠-١٨ ٠٩:٤٠ — D61 🛑 ✅ — المالك اختار «ب»: `fee` يبقى في القاعدة ويُزال من الكود (ر161) · والتوقّف هنا (ر160)
- **كلمات المالك كما هي:** «D61 ب» (في رسالة `/next D61 ب`).
- **ما تغيّر:** DECISIONS: ر161 في §٧ بعد ر152، وحال ر152 «سارٍ — قُرِّر ر161»، وحال ر077 «و`fee` حدّده ر152 ور161» (ور007 لم يُمسّ) · BACKLOG A06 بنصّه الجديد وبلا 👤 ·
  OWNER-GUIDE §٧ صفّ A06 «✅ قرّرتَ ب» · `records.md` سطرا A06 · PLAN: D61 ✅ وسطر **D66 ⚙️** بعد D65 (بلا نصّ أمر — تفصّله جلسة تخطيط، وD65 الخطوة ٤ تذكر «A06 إن صار أمرًا») ·
  ونُقل الأمر إلى `done/`. ورأس PLAN «أحدثها» وARCHITECTURE §٢ (سطر A06) لم يُمسّا: خارج المسموح.
- **الفحص:** `git diff --stat`: DECISIONS وBACKLOG وOWNER-GUIDE و`records.md` وPLAN و`orders/` وحدها (والدفتر) · صفّ `| ر161 ·` واحد · لا بايت تحكّم ·
  `repoHygiene` و`docsBudget` ٧ ✓ · ولا كود.
- **التالي:** جلسةٌ جديدة بـ`/next` تراجع D61 بـ«كيف يُراجَع» ثم تأخذ D62 ⚙️.

## ٢٠٢٦-١٠-١٨ ٠٩:٣٧ — مراجعة D60 ✓ · وحجز D61 🔒
- **رسالة المالك:** `/next D61 ب`.
- **D60 بـ«كيف يُراجَع»** (قرأتُ D61–D65 وأعدتُ وقائعها بأوامر بحث): `fee` `INTEGER NOT NULL DEFAULT 0` في `documents` و`transactions` (`schema.sql` ١٧٨ و٢٥٨) والواجهة تكتب `fee: 0`
  (`useEditorOutput.ts` و`useIssue.ts`) · `FOLDER_LIMIT = 500` و`planFolderImport` ثم `findShared` و`groupDuplicates`، و`templates:planFolder`/`planExcel` في الرئيسة، والبابان وأزرار
  `new-folder` `new-excel` `empty-import-folder`، و`fflate` `exceljs` `esbuild` في package.json · `autoBackup.ts`: `tmpdir()` و`readFileSync` و`writeAtomic` بلا `fsync` ·
  `recordRevision` بـ`INSERT OR IGNORE` بلا `DELETE`، و`apiTemplates.ts` ٣٤٦ سطرًا، و`usePaperOutput.ts` ← `templates.save` · `ipcMain.handle|on` ٢٠٢ في `ipc/` و٣ في `index.ts`،
  والأبواب الستّة في `preload/`، و`net.fetch` لملفٍّ محلّي · و`requireProductive` معرّفةٌ في `ipc/license.ts` ويناديها `gate.ts` (وD65 يذكرهما معًا). كلّ ⚙️ بلا سؤالٍ ولا أداةٍ جديدة،
  وD65 بلا كود، والترتيب مقبول. ✓
- **التالي:** D61 (جارٍ) بجواب المالك «ب».

## ٢٠٢٦-١٠-١٨ ٠٩:٢٣ — D60 🧭 ✅ — خمسة أوامر مفصّلة D61–D65 · والتوقّف هنا (ر160)
- **الأوامر:** D61 🛑 A06 (سؤال `fee`: أ/ب/ج، والتوصية ب) · D62 ⚙️ A19 (قياسٌ بلا كود) · D63 ⚙️ A08 · D64 ⚙️ A10 · D65 🧭 A04 — والسبب في `done/D60.md` الخطوة ٢؛ وما سواها في BACKLOG.
- **وقائع من الكود (بأوامر بحث):** `fee` في `documents` و`transactions` والواجهة تكتب ٠ · `planFolderImport` ينتظر ملفًّا ملفًّا ثم `groupDuplicates` على الكلّ، و`importFolder.ts` يستورد القاعدة ·
  `runAutoBackup` عند الإغلاق: `VACUUM INTO` إلى `tmpdir()` غير مشفّرة ثم `readFileSync` و`seal` و`writeFileSync` بلا `fsync` · `recordRevision` بلا حدّ، وورقة الأسئلة تُحفظ بـ`templates.save`
  (`usePaperOutput.ts`) · ٢٠٢ معالجٍ في `ipc/` و٣ في `index.ts`، ولا شبكة إلا `net.fetch` لملفٍّ محلّي و`openExternalSafe`، ولا مكتبة تحقّق.
- **ملاحظتان:** «قراءة تنسيق Word في استيراد التصاميم» في A07 ميزةٌ لا سقف (تقرير ٧ ت١ «جديد») — D62 ينقلها إلى S44 إن أُغلق A07 · و«أوّل محرّك Rust» في وصف الموجة ٣ بلا رقم A — لجلسة التخطيط بعد D65 (🛑، ر159).
- **الفحص:** الأوامر ٤٥–٥٤ سطرًا (الحدّ ٨٠) · كلّ مسارٍ ومعرّفٍ مذكور موجود ببرنامج إلا `REVISIONS_KEEP` و`tempDir` (موسومان «جديد») و`manifest.json` (ملفّ المرآة) · لا بايت تحكّم ·
  `docsBudget` و`repoHygiene` ٧ ✓ · `git diff --stat`: PLAN والدفتر و`orders/` وحدها · ولا تعديل في `src/`.
- **التالي:** جلسةٌ جديدة بـ`/next` تراجع نصوص D61–D65 (أمواضعها كما وُصفت؟ وأيُنفَّذ كلّ ⚙️ بلا سؤال؟) ثم تأخذ D62 (D61 🛑 ينتظر جواب المالك).

## ٢٠٢٦-١٠-١٨ ٠٩:١٠ — مراجعة D57 ✓ · وحجز D60 🔒
- **رسالة المالك:** `/next`.
- **D57 بـ«كيف يُراجَع»:** `git diff a602b7e..5ac5c6e -- import.ts docxDoc.ts` فارغ · `letterheadImagePath` بنصّ ما كان في `storeLetterheadImage` (`sha256` وأوّل ٣٢ والامتداد بحروفٍ صغيرة و`letterheads/`) ·
  أرقام القياس قبل وبعد في قيديه · `workerJobs` يقارن `JOBS.readTemplate` بنداء `importTemplateFile` المباشر بعد `withoutIds` · وأُعيد هنا: `workerJobs` ١٣ ✓ و`electron-vite build` ثم `import` ✓٣٣
  وفيه «والخطّ الفاصل في المخزن». ✓
- **التالي:** D60 🧭 (جارٍ): تفصيل أوامر الموجة ٣ التالية.

## ٢٠٢٦-١٠-١٨ ٠٩:٠٣ — D57 ✅ — قراءة Word نموذجًا في العامل: حلقة الرئيسة ١٦٣٤ ← ١١٦ م.ث · وأُغلق A03 · والتوقّف هنا (ر160)
- **(٣–٤) `4eb953e`:** عمل `readTemplate` ينادي `importTemplateFile` كما هو بحافظٍ يعيد `letterheadImagePath` ويجمع البايتات (`slice()`) مرّةً لكلّ اسم، ومهلته ٦٠ ث ·
  `readTemplateFile` في `ipc/templates.ts`: `runOr` والقديم بديلٌ، ثم تكتب الرئيسة كلّ صورةٍ في مكانها، وإن تعذّرت كتابةٌ أعادت بالقديم · ويناديها `templates:importFile` و`inbox:importWord`.
- **(٥) `4dc898a`:** `workerJobs` ٤ حالات: الملفّان مطابقان للنداء المباشر بعد `withoutIds`، والصور بأسمائها وبايتاتها من الحزمة وكلّ `letterheads/…` له صورة، و`.doc` والتالفة برسالته ·
  وكسرٌ مؤقّت (صورةٌ تسقط من `images`) أسقط الحالتين ثم أُعيد.
- **(٦) القياس بعده** (السكربت نفسه ثلاثًا): حلقة الرئيسة ١٢٢ ١٠٥ ١١٦ ← **١١٦ م.ث** (كان ١٦٣٤) · أطول ردٍّ قبل الانفتاح ٢٥١ ٢٣٥ ١٨٣ ← **٢٣٥** (كان ١٧٢١؛ وبلا المفتّش ١٧٨) ·
  حتى المصمّم ٢٧٠٢ (كان ٢٠٩٤: إقلاع العامل والنسخ) · الذروة ١١٠٧ م.ب (كانت ٩٩٣: عملية العامل) · ورسم الواجهة للمصمّم بعده كما كان (٣٦٣٩ بعد ٣٦٥٧) — في الواجهة لا الرئيسة، وخارج A03.
- **الفحص:** `typecheck` ✓ · الاختبارات العشرة ١٢٦ ✓ (كانت ١٢٢) · `electron-vite build` ثم `import` ✓٣٣ `inbox` ✓١٠ `wordHints` ✓٢٢ `wordLosses` ✓١٣ `importFolder` ✓٣٤ `excelImport` ✓١٩
  `workerPath` ✓٩ — كما كانت · `git diff a602b7e..HEAD -- import.ts docxDoc.ts` فارغ · ولا بناء محزوم ولا `sweep`.
- **الوثائق:** ARCHITECTURE §١ «نقاط الضعف» و§٢ (D57 ✅) · `editor.md` §٢ §٧ · BACKLOG: «أُغلق: A03»، وA19 جديد، وA07 «وبقي» بلا Word المكتبة (انتقل بمهلته) · PLAN · ونُقل الأمر إلى `done/` · وQUALITY لا يذكر `workerJobs` (خارج المسموح).
- **التالي:** جلسةٌ جديدة بـ`/next` تراجع D57 («كيف يُراجَع») ثم D60 🧭 (تقرأ BACKLOG).

## ٢٠٢٦-١٠-١٨ ٠٨:٤٨ — D57 (١–٢) 🔄 — القياس قبل، والاسم دالّةٌ نقيّة
- **القياس قبل** (بناء التطوير، ثلاثًا؛ Word مولَّد ٢٠ ألف فقرة و٣٠ صورة ٠٫٨٥ م.ب؛ السكربت في مجلّد الجلسة لم يُودَع): حلقة الرئيسة (مفتّشها بـ`NODE_OPTIONS=--inspect`، نبضٌ كلّ ٢٠ م.ث)
  ١٧١٧ ١٥٩٢ ١٦٣٤ ← **١٦٣٤ م.ث** · وأطول ردٍّ لـ`settings.get` أُرسل قبل انفتاح المصمّم ١٨١٨ ١٦٨٥ ١٧٢١ ← **١٧٢١** (طريقة D52: ٢٠٦٩) · حتى المصمّم ٢٠٩٤ · الذروة ٩٩٣ م.ب.
  **وتنبيه:** أطول ردٍّ كلّه ٣٦٥٧ — وهو رسم الواجهة للمصمّم بعشرين ألف فقرة (فجوة الواجهة نفسها ٣٧٠٩ تبدأ عند انفتاحه)، لا الرئيسة؛ فالمقياس الأوّلان.
- **(٢)** `services/letterheadImage.ts` (`letterheadImagePath`) و`storeLetterheadImage` تناديها ثم تكتب كما كانت · `typecheck` ✓ · `import` `importFolder` ٤٩ ✓ ·
  `import` ✓٣٣ `importFolder` ✓٣٤ `excelImport` ✓١٩ · ومرجع الباقي على هذا البناء: `inbox` ✓١٠ `wordHints` ✓٢٢ `wordLosses` ✓١٣ `workerPath` ✓٩.

## ٢٠٢٦-١٠-١٨ ٠٨:٢٩ — مراجعة نصّ D57 ✓ · وحجز D57 🔒
- **رسالة المالك:** `/next`.
- **النصّ:** يُنفَّذ بلا سؤال — لا مكتبة ولا أداة، وكلّ ما يلزمه قائم: `importTemplateFile` يُنادى في `templates.ts:116` و`inbox.ts:24` بـ`storeLetterheadImage` و`importFolder.ts:171` ·
  `storeLetterheadImage` (`templates.ts:44`) بالاسم الموصوف و`null` · `import.ts` وما يستورده ٧٠ ملفًّا و`worker/index.ts` ١٠٧ بلا `electron` ولا `db/` ولا `ipc/` (ببرنامج) ·
  لا `readTemplate` ولا `letterheadImage` في `src/` · `DIWAN_TEST_OPEN_FILE` و`new-word` و`templates-library-drafts` و«والخطّ الفاصل في المخزن» حيث وُصفت · والملفّان والسيناريوهات السبعة موجودة. ✓
- **التالي:** D57 ⚙️ (جارٍ).

## ٢٠٢٦-١٠-١٨ ٠٨:٢٢ — D57 🧭 — نصّه مكتوب (`docs/orders/D57.md`، ٦٢ سطرًا) ⚙️ · وD60 🧭 سطرًا · والتوقّف هنا (ر160)
- **من الكود:** `importTemplateFile(path, saveImage?)` يُنادى من `templates:importFile` و`inbox:importWord` (بـ`storeLetterheadImage`) ومن `planFolderImport` · الاسم
  `letterheads/<sha256 ٣٢><امتداد>` و`null` إن تعذّرت الكتابة فيُسقط `docxToDoc` الصورة · `import.ts` وما يستورده (٧٠ ملفًّا معه) بلا `electron` ولا `db/` ولا `ipc/` (ببرنامج) · و`import.ts` عند سقفه ٥٥١/٥٥٣.
- **التصميم:** عمل `readTemplate {path}` ← النموذج والصور `{path, bytes}`؛ والاسم بدالّةٍ نقيّة جديدة يناديها `storeLetterheadImage` أيضًا فلا يتغيّر · والرئيسة تكتب، وإن تعذّرت
  كتابةٌ أعادت بالقديم (النتيجة كما كانت) · والمطابقة بـ`withoutIds` (المعرّفات عشوائية) · والقياس قبل أيّ تعديل؛ والخطر المكتوب: نسخ النموذج الكبير بين العمليّتين.
- **خارجه:** «استورد مجلدي» و«كتب من Excel» لم يُقاسا ← A19 يكتبه D57 · وبناء الاختبار ممنوعٌ بلا قول المالك (بعد منتصف الليل Z يكتب في سجلّه، قيد D54).
- **الفحص:** كلّ مسارٍ مذكورٍ موجود (ببرنامج) إلا الجديد · ٦٢ سطرًا (الحدّ ٨٠) · لا بايت تحكّم · ولا تعديل في `src/`.
- **التالي:** جلسةٌ جديدة بـ`/next` تراجع نصّ D57 (أيُنفَّذ بلا سؤال؟ ومواضعه كما وُصفت؟) ثم تنفّذه وتتوقّف؛ ثم D60 🧭.

## ٢٠٢٦-١٠-١٨ ٠٨:١٢ — مراجعة D58 ✓ · وحجز D57 🔒
- **رسالة المالك:** `/next`.
- **D58 بـ«كيف يُراجَع»:** PLAN ١٠١١٠ والدفتر ٣٤٣٤٢ (السقفان ٢٥ و١٠٠ ك.ب) · A03 وG30 في BACKLOG · `git diff 2200542..fc83fcd` ١١٢٣+ و١٠٥٤−، والحذف من PLAN والدفتر
  تقابله إضافة الثلاثة الجديدة · `docsBudget` ٣ ✓ · فاشلٌ مؤقّت (نُقل بعد إلى مجلّد الجلسة) أظهر سجلّه ورسالته وفرقه وسطره بالافتراضي. ✓
- **ملاحظة (قبل D58، نُقلت كما هي):** G30 صفٌّ مفتوح في جدول BACKLOG و«أُغلق: G30» في آخره معًا — لا يُصلح هنا.
- **التالي:** D57 🧭 (جارٍ): تفصيل أمر قراءة Word في مكتبة النماذج في العامل.

## ٢٠٢٦-١٠-١٨ ٠٨:٠٨ — D58 ✅ — ما تقرؤه كلّ جلسة أقلّ ولا يضيع منه حرف · والتوقّف هنا (ر160)
- **قبل:** PLAN ٤٧٦٦٤ ب والدفتر ١٧٩٩٥١ · ومخرج `npx vitest run` الأخضر ٩ أسطر ٢٢٩ ب بالصيغ الثلاث (الافتراضي و`agent` و`agent --silent=passed-only`): متطابقة.
- **النقل الحرفيّ:** `2b293a2` الموجتان ١ و٢ إلى `docs/legacy/PLAN-1-2.md` (روابطها `../orders/done/`، ٤٦ لا مكسور) و«الموجات القادمة» إلى آخر الملف إلى `docs/BACKLOG.md` ·
  `ddcf906` قيود ما قبل D52 إلى `docs/legacy/LOG-1.md` · **بعد:** PLAN ٩٧٠٨ (−٨٠٪) والدفتر ٣٢١٩٣ (−٨٢٪)، وفي رأسيهما قاعدة النقل.
- **لا ضياع (سكربت الجلسة على `2200542`):** ١١٣٤ سطرًا غير فارغ كلّها في الخمسة بعددها، والجديد ١٦: الرؤوس وأسطر الإشارة وحدها · `git diff --shortstat` ١٠٧١+ و١٠٥٠−.
- **vitest:** فاشلٌ مؤقّت (نُقل خارج `tests/` بعد، ولم يُودَع) أظهر بالافتراضي اسمه ورسالته وفرقه وملفّه وسطره وسجلّه، و`agent` مثله — فلا تغيير في `vitest.config.ts`.
- **`643a7b8`:** `tests/docsBudget.test.ts` (٣ حالات؛ وقيدٌ من ١١ سطرًا جُرّب فسقط برسالته ثم أُعيد الدفتر) · CLAUDE.md (سطر الوثائق والخطوة ١) · `next.md` الخطوة ١ · QUALITY §٦ البند ٩.
- **الفحص:** `typecheck` ✓ · `docsBudget` `repoHygiene` `guardHook` ٢٠ ✓ · `npx vitest run` كاملًا ١٩٣٨ ✓ و٤ متخطّاة (٩ أسطر) · `git diff -- src` فارغ.
- **ملاحظة:** QUALITY §٥ لا يذكر `docsBudget` (ولا `guardHook` و`worker*` قبله، وعدّه ١٨٢) — خارج مسموح الأمر. و«أُغلق:» صارت في آخر BACKLOG.
- **التالي:** جلسةٌ جديدة بـ`/next` تراجع D58 ثم تفصّل D57 🧭 (وتقرأ BACKLOG).

## ٢٠٢٦-١٠-١٨ ٠٧:٥٦ — مراجعة D59 ✓ · وحجز D58 🔒
- **رسالة المالك:** `/next`.
- **D59:** `git diff b649aa0..cb1bf7a` في `vitest.config.ts` وحده (الإعداد: `testTimeout` ومجموعتا `unit` و`onnx`)، و`workerJobs.test.ts` لم يُمسّ ولا فحصٌ تغيّر ·
  ثلاثة تشغيلاتٍ كاملة متتالية (`--reporter=json`): كلٌّ ١٩٣٥ ✓ و٠ ✗ و٤ متخطّاة، في ١٦٣ و١٠٢ و٩١ ث · سطر «أُغلق: G34» في PLAN · وجدول الخطوة ١ في قيد ٠٦:٠٥. ✓
- **تحقّق D58 قبل البدء:** صفوف الموجتين ١ و٢ ستّةٌ وأربعون كلّها ✅ · قيد D52 في الدفتر · `BACKLOG.md` و`legacy/LOG-1.md` و`legacy/PLAN-1-2.md` غير موجودة ·
  و`npx vitest run` أخضر (التشغيلات الثلاثة أعلاه).
- **التالي:** D58 ⚙️ (جارٍ).

## ٢٠٢٦-١٠-١٨ ٠٦:٣٨ — D59 ✅ — `vitest` كاملًا أخضر عشرًا متتالية: ملفّات ONNX في مجموعةٍ بعد الباقي، ومهلة ١٥ ث · والتوقّف هنا (ر160)
- **رسالة المالك:** `/next`. ولا منجزَ بلا مراجعة (D53–D56 رُوجعت ٠٥:٢٢، وD58 أُوقف قبل أن يبدأ). والقياس والأسباب في القيد أدناه.
- **التجارب بترتيب الأمر:** (أ) `testTimeout` ١٥ ث: ✗ ٢ من ٢ (`workerJobs` «للأشياء» ٩٠ و٩٧ ث، و`searchIndex` ٣٦ — مهلتاهما صريحتان فلا يمسّهما) في ١٤٦ و١٥٦ ث ·
  (أ)+(ب) `maxWorkers` ٤: ✗ في الأوّل (`workerJobs` ٦٠٫١ ث، والذاكرة ٣٨١ م.ب) ١٣٨ ث · (أ)+(ج) مجموعة `onnx` (`groupOrder` ١ و`maxWorkers` ١): ✓ ٣ من ٣ في ١٠١–١٠٤ ث والذاكرة ٩٦١. فاختير (أ)+(ج) بلا (ب).
- **`cb1bf7a` (`vitest.config.ts` وحده):** المجموعة تُعرف من نصّ الملفّ (ما يقرأ `resources/models`: الخمسة، لا `portraitLoad` المزيِّف) · و`include` في كلّ مجموعةٍ لا في الجذر — فالمجموعة **تضمّ** قائمة الجذر
  (جُرّب: التقطت `onnx` الملفّات كلّها، ٣٦٩) · و`globalSetup` في الجذر يجري مرّةً (شيفرة vitest ٥٫٠٫٠) · والمهلة ضعف ٦٫٦ ث (D58) مقرَّبًا. والكشف من النصّ دخل أثناء الأوّل من العشر، والمجموعتان كما هما (`vitest list`).
- **العشر المتتالية:** كلٌّ ١٩٣٥ ✓ و٤ متخطّاة في ١٨٧ ملفًّا · ١١٣ ١٠٦ ١٠٤ ١٠٩ ١٠٩ ١٠٦ ٩٨ ٩٠ ٨٨ ٩٢ ث ← وسيط **١٠٥** مقابل **١١٠** قبل، وأكبرها ١٠٣٪ (الحدّ ١٢٥٪) · أبطأ اختبارٍ ٢٨٫٤ ث (`lint`، مهلته ٦٠)
  و«للأشياء» ١٠–١٥ ث، وأبطأ ما بلا مهلةٍ صريحة ٣٫٧ ث (`repoHygiene` «٢») · وأدنى ذاكرةٍ حرّة ٧٦٣ م.ب. والسبب ليس في البرنامج: عملٌ واحد في العامل، و«للأشياء» وحده ١١ ث لنداءين.
- **الفحص:** `typecheck` ✓ · `structure` `repoHygiene` `guardHook` ٢٤ ✓ · `git diff -- src` فارغ، و`workerJobs.test.ts` لم يُمسّ · والوثائق: QUALITY §٢ §٧ · FIELD-LESSONS L63 · PLAN (D59 ✅ و«أُغلق: G34» وD58 ⬜).
- **التالي:** جلسةٌ جديدة بـ`/next` تراجع D59 ثم تنفّذ D58 من أوّله (تحقّقه «قبل البدء» يجد الوحدة خضراء)؛ ثم D57 🧭.

## ٢٠٢٦-١٠-١٨ ٠٦:٠٥ — D59: القياس والأسباب (الخطوتان ١ و٢)
- **قبل** (ثلاثة كاملة بـ`--reporter=json`): ✓ · ✗ `searchIndex` «أرشيفٍ كبير» ٣١٫٥ ث (مهلته ٣٠) و`workerJobs` «للأشياء» ٧٤٫٦ (٦٠) · ✗ `backup` ٥٫٤ (٥) و`workerJobs` ٦٣٫٧ — في ٩٩ ١١٧ ١١٠ ث؛ وفوق ٢٫٥ ث ٥٠ اختبارًا في ٢١ ملفًّا شُغّل كلٌّ وحده.

| الاختبار (مهلته) | وحده | أكبره في الحزمة | النسبة | السبب من الكود |
|---|---|---|---|---|
| `workerJobs` «للأشياء» (٦٠) · «للأشخاص» (٦٠) | ١١٫١ · ٣٫٤ ث | ٧٤٫٦ ✗ · ١٠٫٦ | ×٧ · ×٣ | ONNX مرّتين (مباشرًا وعبر العمل)، وكلّ جلسةٍ بثمانية خيوط (`portrait.ts` THREADS)؛ وفي الحزمة معه أربعة ملفّات ONNX أخرى |
| `searchIndex` «أرشيفٍ كبير» (٣٠) | ٤٫١ | ٣١٫٥ ✗ | ×٨ | ٤٠٠٠ كتابٍ بفهرس FTS في معاملةٍ واحدة |
| `backup` «القاعدة والمخزن» (٥) | ٠٫٣ | ٥٫٤ ✗ | ×١٨ | scrypt (N=2^15، ٣٢ م.ب) كتابةً وفتحًا، وzip وملفّات |
| `repoHygiene` «٢ — نهايات الأسطر» (٥) | ١٫٠ | ٤٫٠ | ×٤ | عملية `git ls-files --eol` تقرأ الشجرة كلّها |
| `colorErase` «والتراجع» (٥) | ٠٫٧ | ٣٫٤ | ×٥ | نحو ٣٨ ألف `expect` في حلقة، و`toEqual` على مصفوفتين (٣٨٤٠٠ و١٥٣٦٠٠) |
| `auditFixes` «مجلّد المخزن…» (٥) | ٠٫١ | ٣٫٠ | ×٣٤ | `import('../src/main/ipc/files')` داخل الاختبار: تحويل شجرة وحداتٍ تحت الحمل |
- **والعامّ:** ×٣–×٤٧ أكبر من تقاسم المعالج: الذاكرة الحرّة ٢٣٤٨ م.ب قبل التشغيل ← **١٦٨** أثناءه (عيّنةٌ كلّ ثانيتين). والباقي فوق ٢٫٥ ث: بمهلٍ صريحة — ESLint (`lint`) · scrypt N=2^17 (١٢٨ م.ب، `keytool` و`update` بعمليات node) · ONNX (`objectCutout` و`portrait*`) · tesseract (`mrzRead`) · ١٣٠ ألف صفّ (`auditFixes`) · ٢٠ ألف مدخل zip (`importLimits`)؛ وعلى الافتراضية دون ٣٫٦ ث (قراءة PSD وPDF وملفّات، وعمليات git وnode).

## ٢٠٢٦-١٠-١٨ ٠٥:٤٦ — D59 ⬜ ⚙️ مكتوب بأمر المالك (لـG34)، ويُقدَّم على D58
- **أمر المالك بكلماته:** «اكتب أمر D59 لإصلاح G34 (السبب أوّلًا ثم الإصلاح) ويُقدَّم على D58، وتنفّذه جلسةٌ جديدة.»
- **`docs/orders/D59.md`** (٥٤ سطرًا): قياس مدد الاختبارات في الحزمة ووحدها (`--reporter=json`)، وسببٌ لكلّ اختبارٍ من الكود، ثم أصغر إعدادٍ في `vitest.config.ts`
  (المهلة، ثم العمّال، ثم عزل حالتي ONNX) تثبته عشرة تشغيلاتٍ متتالية خضراء والزمن ≤ ١٢٥٪؛ بلا حذفٍ ولا تخطٍّ ولا `retry` ولا `src/`. وإن نجحت ستّةٌ قبل الإصلاح: توقّف.
- **ومن شيفرة vitest ٥٫٠٫٠ (في الأمر):** العمّال الافتراضيون ٧ على هذا الجهاز (ثمانية مسارات − ١)، والمهلة ٥ ث. والأسماء الستّة موجودة في ملفّاتها (ببرنامج).
- **PLAN:** سطر D59 قبل D58، وD58 يعتمد على D59 ويبدأ من أوّله بعده، وG34 «أمره D59». ولا كود.
- **التالي:** جلسةٌ جديدة بـ`/next` تنفّذ D59 وتتوقّف؛ ثم D58 من أوّله؛ ثم D57 🧭.

## ٢٠٢٦-١٠-١٨ ٠٥:٣٧ — D58 أُوقف في «تحقّق قبل البدء»: `npx vitest run` كاملًا يتقلّب ← G34 (لا تعديل غير PLAN والدفتر)
- **ستّة تشغيلاتٍ كاملة، أربعةٌ سقطت وكلّها مهلة:** `auditFixes` «مجلّد المخزن…» ٥٠١٦ م.ث · `colorErase` «والتراجع يعيد القناع…» ٦٥٨٨ · `workerJobs` «أزل الخلفية للأشياء» ٦٥٦٥٩ (مهلته ٦٠ ث) ·
  `backup` «القاعدة والمخزن يعودان…» ٥٠٣٤ و`workerJobs` ٧٣٤٩٨ · وبلا `workerJobs` (`--exclude`): أخضر ١٩٢٦ ✓ مرّةً، ثم `colorErase` ٥٧٥٨ و`repoHygiene` «٢ — نهايات الأسطر» ٥٥٦٩.
  والأخضر الكامل مرّةً واحدة (١٩٣٥ ✓). **وحده ينجح:** `auditFixes` ١٤ ✓ · `workerJobs` ٩ ✓ («للأشياء» ٨٩٨٨ م.ث وحده ← ٦٥–٧٣ ث في الحزمة). والجهاز خاملٌ بينها (المعالج ≈١٠٪، ولا node ولا electron).
- **المرجَّح:** ١٨٧ ملفًّا متوازيةً على أربع نوى وذاكرة ٨ غيغا، واختباراتٌ تقارب ٥ ث فتتجاوزها تحت الحمل، و`workerJobs` (D54) يزيده ولا يصنعه وحده. وآخر وحدةٍ كاملة خضراء في الدفتر D50.
- **قياس الخطوة ١ (يُعاد في الأمر):** PLAN ٤٦١٢١ ب والدفتر ١٧٠١١٧ · والافتراضي تحت Claude Code هو `agent` نفسه (vitest ٥٫٠٫٠: `isAgent ? "minimal"` و`agent` = `MinimalReporter`
  بـ`silent: "passed-only"`) — فالأخضر ١٣ سطرًا ٤٢٦ ب بالصيغ الثلاث، والسقوط يُطبع كاملًا (٣٢–٤٨ سطرًا).
- **الاقتراح لأمر G34 (السبب أوّلًا):** مدد الاختبارات في الحزمة (`--reporter=json`) ثم واحدٌ من: `testTimeout` أوسع، أو `maxWorkers` أقلّ، أو مهلة «أزل الخلفية» في `workerJobs` — في `vitest.config.ts` وهو خارج مسموح D58.
- **أين توقّفت:** لم يُمسّ ملفٌّ غير PLAN (G34، وسطر D58 ⬜ يعتمد على G34) والدفتر. **التالي:** أمرٌ لـG34 يقرّه المالك (أو يأذن بتجاوز الشرط)، ثم D58 من أوّله.

## ٢٠٢٦-١٠-١٨ ٠٥:٢٢ — مراجعة D53–D56 ✓ · وحجز D58 🔒
- **رسالة المالك:** `/next`.
- **D53:** `git diff --stat a72be2d..7e7b547` في المسموح وحده (و`apiOffice.ts` من `@shared/api*`) · `worker/index.ts` فيه `ping` و`crash` وحدهما · `worker.js` في `app.asar` والسيناريو على بناء الاختبار برقمي العمليّتين في قيده. ✓
- **D54:** `src/` المتغيّر أربعة ملفّات في المسموح، و`portrait.ts` و`objectCutout.ts` لم يُمسّا · القياس ٢٨٤٧ ← ١٤ في قيده · `designCutout` و`workerPath` على بناء الاختبار، و`portrait` عليه متعذّرٌ بسببه المكتوب (ر116). ✓
- **D55:** «استغرق أكثر ممّا يُحتمل — أُوقف» بنصّها في `workerTimeout.mjs`، و«أُلغي» لا تظهر في الواجهة (النافذة تُغلق) ونصّها محروسٌ في `workerHost.test.ts` · البابان خلف `__DIWAN_TEST_DOORS__` وحده · `--stat` في المسموح. ✓
- **D56:** جسم `flattenPsd` القديم في `ipc/designs.ts` والجديد في `flatten.ts` متطابقان (`diff` بلا فرق إلا `export`) · القياس ١٣٦١ ← ٢ في قيده · `importCap` ✓٧ على بناء الاختبار. ✓
- **تحقّق D58 قبل البدء:** صفوف الموجتين ٤٦ كلّها ✅ · قيد D52 في الدفتر · الملفّات الثلاثة الجديدة غير موجودة. و`vitest` أخضر يُثبت في قياس الخطوة ١.
- **التالي:** D58 ⚙️ (جارٍ).

## ٢٠٢٦-١٠-١٨ ٠٥:١٨ — ر160: أمرٌ واحد لكلّ جلسة (قول المالك، جلسة الأدوات)
- **القرار:** تختم الجلسة أمرها ثم تتوقّف، والتالي لجلسةٍ جديدة بـ`/next`؛ و⚙️ صار «تأخذه الجلسة التالية بلا انتظار المالك». والمالك لا يقرأ التقارير
  ويتحرّى الدقّة — فمراجعة الأمر السابق في أوّل كلّ جلسة هي الضمان، ولا يُكتب في الدفتر إلا ما شُغّل فعلًا.
- **كُتب في:** DECISIONS (ر160) · CLAUDE.md الخطوة ٦ · `/next` الخطوة ٥ · رأس PLAN (الوسم و«أحدثها») · قالب الأوامر وختام D58. ولا موضع آخر يقول «⚙️ تابع».
- **التالي:** جلسةٌ تراجع D53–D56 ثم تنفّذ D58 وتتوقّف؛ ثم جلسةٌ تراجع D58 ثم تفصّل D57 (🧭).

## ٢٠٢٦-١٠-١٨ ٠٥:٠٩ — جلسة الأدوات (بطلب المالك، خارج الأوامر) — حرّاس الجلسات، وكتابة D58
- **القياس** (أداة تقارير الجلسات الرسمية، ٧ أيام): ٢٢ جلسة و٥١٧٣ خطوة و١٫٩ مليار توكن، ومتوسّط الخطوة ≈٣٦٠ ألفًا — ما يُقرأ يُعاد مع كلّ خطوةٍ بعده.
- **على الجهاز (لا في المستودع):** Context7 بالعنوان العامّ بلا دخول، و`typescript-lsp` (ومعه `typescript-language-server` عامًّا) — يعملان من الجلسة التالية.
- **`a441d83`:** `tools/hooks/guard.mjs` يشغّله `.claude/settings.json` — يمنع `sed -i` والدفع بالقوّة وحذف المتتبَّع وقراءة الدفتر كلّه (فوق ١٢٠ سطرًا)
  ورفع السقوف وإيداع ما في .gitignore ومسّ مجلّد المالك، ويسأل المالك عن master وproduction والوسم والإصدار و`sweep` والاعتماديات واللقطات؛
  وبعد Edit وWrite بايتات التحكّم والنهايات (L56) بأمر `fix-eol`. `guardHook` ١٣ ✓ و`repoHygiene` ✓ و`typecheck` (tests) ✓، وجُرّب حيًّا: `sed -i` وقراءة الدفتر كلّه مُنعا.
- **D58 ⬜ ⚙️** (يُقدَّم على D57): نقل الموجتين ١ و٢ و«الموجات القادمة» وقيود ما قبل D52 حرفيًّا، ومخرج vitest تحت Claude Code، و`docsBudget`.
- **التالي:** مراجعة D53–D56 كما قال القيد أدناه، ثم D58 ثم D57. وGraphify مرفوض (المالك)، و21st للأفكار وحدها.

## ٢٠٢٦-١٠-١٨ ٠٢:٥٥ — D56 ✅ — «استورد تصميمًا» في العامل، والتوقّف ١٣٦١ ← ٢ م.ث · والتوقّف هنا (D57 🧭 بعد مراجعة D53–D56)
- **ما تغيّر (`a817f71` و`7e4fcad` و`b7661dd` وإيداع الختام):** `flattenPsd` منقولةٌ إلى `services/design/flatten.ts` (الجسم بلا فرق إلا `export`) و`designImport` ✓١٥ `designPsd` ✓٩ قبل غيرها ·
  عمل `readDesign` (`readFile` ثم `assertPixels` ثم `readDesign` ثم `flattenPsd` لـPhotoshop بلا صور) بمهلة ٦٠ ث · `designs:import`: الحوار و`assertSize` والخطوط في الرئيسة، ثم `runOr`
  والقديم في الرئيسة بديلًا، وما بعده كما هو (`rasterPdf` و`store` و`canvasFromImport` و`layerSuggestions`).
  **وفي العقد:** مخرج `readDesign` `{ imported: unknown, flat }` — فنوع `DesignImport` في `main/services/design/importTypes.ts` والمشترك لا يرى الرئيسة (القاعدة ١) ولا يُغيَّر
  `importTypes` (ممنوع)؛ فتنصّه القناة بتعليق. وحزمة العامل بلا `electron` (فُحص في `out/main`).
- **القياس** (سكربتٌ في مجلّد الجلسة بطريقة D52، Photoshop ٥٠٠٠×٥٠٠٠ بخمس قنوات خامًا ١١٩ م.ب بـ٣٠٠ نقطة؛ لم يُودَع): **قبل** (ملفّات الخطوة ٢ مُرجعةً مؤقّتًا إلى `a817f71` ثم أُعيدت)
  ١٣٥٨ ١٣٦١ ١٣٦١ ← وسيط **١٣٦١ م.ث** (وD52 قاس ٢٠٠١ بملفٍّ وسكربتٍ آخرين) · **بعد** ٢٩ ٢ ٢ ← وسيط **٢ م.ث** (الهدف دون ٣٠٠ ✓) · والذروة ١٠٢١–١١٢٤ ← ١١٣٢–١١٣٨
  كما هي · وزمن الاستيراد ١٫٥٨ ← ١٫٩٥ ث (إقلاع العامل ونسخ الصور بين العمليّتين) والبرنامج يستجيب طواله.
- **الفحص:** `typecheck` ✓ · العشرة ١١٥ ✓ (`workerJobs` ٩: Photoshop بلا طبقات وبطبقة نصّ وWord مطابقةٌ للنداء المباشر، والرأس الضخم برسالة D51؛ و`realPsd` ١٦ جرى) ·
  `designImport` ✓١٥ `designPsd` ✓٩ `designPsdStyles` ✓٩ `importCap` ✓٧ `designFonts` ✓٦ `workerPath` ✓٩ — كما كانت · `npm run pack` ثم `designPsd` ✓٩ و`importCap` ✓٧ و`workerPath` ✓٩
  على بناء الاختبار **قبل ٠٣:٠٠** — وسجلّ المالك بعدها كما كان (`LastSeen` ١٧ ت١ ١٨:١٦Z).
- **ملاحظةٌ لـD57:** حالة «التسطيح» (Photoshop تتعذّر صورته المسطّحة وفيه طبقات) لا يصنعها `psdBuilder` بسهولة — فالمقارنة الكاملة بالنداء المباشر تشملها ولا حالة لها بعينها.
- **الوثائق:** ARCHITECTURE §١ «نقاط الضعف» (والمهلة D55 فيها) و§٢ (سطر الأوامر) · `designs.md` §٢ §٧ · PLAN (D56 ✅ وA03، وسطر D57 كما هو).
- **أين توقّفت بالضبط:** D53–D56 ✅ كلّها، والشجرة نظيفة بعد إيداع الختام. **التالي 🧭:** الجلسة التالية تراجع D53–D56 بـ«كيف يُراجَع» في كلٍّ، ثم يُفصَّل D57.
  **وبيد المالك (ر116):** `portrait` على بناء الاختبار لا يجري على هذا الجهاز (التجربة منتهية منذ ٢ ت١) إلا بـ`registryGuard` — يُشغَّل بقوله وحده، وإلا يبقى على التطوير.

## ٢٠٢٦-١٠-١٨ ٠٢:٤١ — D55 ✅ — المهلة والإلغاء لأعمال العامل · ثم D56 ⚙️ (حُجز ٠٢:٤١)
- **ما تغيّر (`1239fa6` و`b526026` وإيداع الختام):** `WORKER_TIMEOUT_MS` (`ping` و`crash` ٥ ث، و`cutout` و`cutoutObject` ٦٠ ث) والرسالتان في `shared/worker.ts` · المضيف: مؤقّتٌ لكلّ طلب
  يقتل العامل ويقيّد `worker-timeout` ويرفضه بـ«استغرق أكثر ممّا يُحتمل — أُوقف» والمعلّق غيره بـ«توقّف المعالج»، و`cancel(job)` بـ«أُلغي» (وبلا طلبٍ معلّق لا شيء)، و`WorkerTimeoutError`
  ليس سقوطًا لـ`runOr` · `app:workerCancel` وبابه في الجسر · `useCutout`: الخروج والنموذج يعمل (و«ألغِ» وEsc يغلقان النافذة) ينادي `workerCancel('cutoutObject')`، وجوابه المتأخّر مهملٌ كما كان ·
  بابا `DIWAN_TEST_SLOW_WORKER` (في العامل) و`DIWAN_TEST_WORKER_TIMEOUT` (في المضيف) في القاعدة ٢.
  **وتفسيران:** التأخير لا يمسّ `ping` — وإلا انقضت مهلة «أنا هنا» نفسها في السيناريو (٤ ث تأخير و٢٫٥ ث مهلة) · والعامل يرث بيئة الرئيسة (افتراضي `fork`) فلا `env` صريح.
  و`CutoutModal.tsx` لم يُمسّ: «ألغِ» يغلقها كما كان، والإيقاف في تنظيف `useCutout`.
- **الفحص:** `typecheck` ✓ · الخمسة ٣٢ ✓ (`workerHost` ١٥: أربعٌ جديدة بساعةٍ مزيّفة؛ وحالة الخمول من D54 أُعطيت مهلةً طويلة لأنّ «أنا هنا» صار له ٥ ث) · `electron-vite build` ثم
  `workerTimeout` ✓١٣ مرّتين (وتعطيل نداء الإلغاء مؤقّتًا أسقط فحصين: الرقم نفسه قبل المهلة، ومهلتان في السجلّ) · `designCutout` ✓٦ `workerPath` ✓٩ `portrait` ✓١٥ كما كانت ·
  وبناء الإصدار (`--mode release`): لا `DIWAN_TEST_` في `out/main` ولا `process.exit` في `worker.js` ولا `app:workerCrash`.
- **المراجعة («كيف يُراجَع»):** الرسالتان بنصّهما في السيناريو · `grep SLOW_WORKER\|WORKER_TIMEOUT src/main` داخل `__DIWAN_TEST_DOORS__` وحده · `git diff --stat` في المسموح. ✓
- **الوثائق:** ARCHITECTURE §٢ · `designs.md` §٢ §٧ · `system.md` §٢ §٧ · QUALITY §٢ (١١٣) §٣ · PLAN: A07 «(ب) المهلة — D55 ✅» ويبقى Word في مكتبة النماذج.
- **التالي:** D56 ⚙️ — حُجز ١٨ ت١ ٠٢:٤١. **وفحصاه على بناء الاختبار** (`designPsd` و`importCap`) بعد ٠٣:٠٠ يكتبان في سجلّ المالك (D54) — فلا يُشغَّلان بلا قوله.

## ٢٠٢٦-١٠-١٨ ٠٢:٣١ — D54 ✅ — «أزل الخلفية» في العامل، والتوقّف ٢٨٤٧ ← ١٤ م.ث · ثم D55 ⚙️ (حُجز ٠٢:٣١)
- **ما تغيّر (`8b3a182` وإيداع الختام):** عملا `cutout` و`cutoutObject` في العقد والعامل (`portrait.ts` و`objectCutout.ts` بلا فرق) · `runOr` في المضيف: `WorkerStoppedError` وحده سقوط،
  والأوّل يُرفض برسالته والثاني المتتالي يجري القديم في الرئيسة ويُقيَّد `worker-fallback`، ونجاحٌ يصفّر · و`IDLE_MS` = ٦٠ ث · و`ipc/photos.ts` الجسمان وحدهما (الفحوص والرسائل قبل الإرسال كما هي).
- **القياس** (سكربتٌ في مجلّد الجلسة بطريقة D52 — لم يبقَ سكربت D52 فكُتب مثله؛ لم يُودَع): **قبل** (كود D53، ثلاثًا) التوقّف ٢٩٥٢ ٢٨٤٧ ٢٨١٩ ← وسيط **٢٨٤٧**
  والذروة ١٦٤٤ (يوافق D52: ٢٧٧٩ و١٦٣٨) · **بعد** ٣ ١٤ ٣١ ← وسيط **١٤ م.ث** (الهدف دون ٣٠٠ ✓) والذروة ١٥٦٢–١٧٦٩ (كما هي).
  **الخمول:** بعد ٣٠ ث العامل باقٍ والذاكرة ١٠٤٢ والثانية دافئة ٣٫٢ ث · بعد ٧٥ ث أُغلق والذاكرة ٤٠٦ (البرنامج قبل أوّل نموذج ٤٧٠) والثانية ٥٫٧ ث —
  فالعامل الخامل يحجز نحو ٦٤٠ م.ب، وإعادة النموذج نحو ٢٫٥ ث: فالدقيقة.
  **وزمن العمل نفسه** ظهر أبطأ في العامل (الدافئ ٣٫٦–٤٫٦ ث مقابل ٢٫٨–٣٫١)، فجُرّب: الأولوية «عادية» في العمليّتين، وإخراج العامل من خنق الطاقة لم يغيّر شيئًا،
  وتجربةٌ خارج البرنامج بالترتيبين أظهرت أنّ **ما يجري ثانيًا أبطأ أيًّا كانت العملية** (حرارة المعالج) — فلم يثبت فرقٌ للعامل نفسه؛ ويُعاد قياسه إن شكا المكتب.
- **الفحص:** `typecheck` ✓ · الاختبارات العشرة ٦٤ ✓ (`workerJobs` ٥ جديد: مطابقٌ بايتًا ببايت للأشياء وللأشخاص بوجهه؛ و`workerHost` ١١) · `electron-vite build` ثم
  `designCutout` ✓٦ `portrait` ✓١٥ `photos` ✓٨ `photoSteps` ✓٥ `paperPhoto` ✓١٩ `workerPath` ✓٩ — كما كانت (`portrait` ✓١٥ على كود D53 أيضًا: ✓١٧ القديم كان قبل تفريغ القاط) ·
  `npm run pack` ثم `designCutout` ✓٦ و`workerPath` ✓٩ على بناء الاختبار (BiRefNet من `app.asar.unpacked` في العامل).
- **تعذّر:** `portrait` على بناء الاختبار — «انتهت المدّة التجريبية» فالصور الشخصية محجوبة: مرساة السجلّ `TrialStart` = ٢ ت١ (برنامج المالك المثبّت)، ولا يُمحى إلا
  بـ`registryGuard` أي لمس سجلّ جهاز المالك، وهو بقوله وحده (ر116). **وتحقّقتُ أنّ تشغيلاتي المحزومة لم تكتب فيه:** `LastSeen` و`LastVerified` ما زالا ١٧ ت١ ١٨:١٦ و١٨:٢٥Z.
  **وتنبيه:** بعد ٠٣:٠٠ بتوقيتنا (منتصف الليل Z) يكتب المحزوم `LastSeen` جديدًا — فلا تشغيل للمحزوم بعدها بلا قول المالك.
- **الوثائق:** ARCHITECTURE §١ «النماذج المحلية» و§٢ (سطر الأوامر) · `photos.md` §٥ §٧ و§٢ · `designs.md` §٢ · QUALITY §٢ (١٨٣) · PLAN: A18 جديد (نقل القديم إلى `legacy/` بعد إصدار).
- **التالي:** D55 ⚙️ — حُجز ١٨ ت١ ٠٢:٣١.

## ٢٠٢٦-١٠-١٨ ٠٢:٠١ — D53 ✅ — العامل المستقلّ فارغًا في الطريق كلّه · ثم D54 ⚙️ (حُجز ٠٢:٠١)
- **ما تغيّر (`423a3e3` و`ba7a54a` وإيداع الختام):** `shared/worker.ts` (العقد: `WorkerJobs` بـ`ping` و`crash`، والطلب، والجواب `result`/`failure` بوسم `type`، و`WORKER_STOPPED`) ·
  `main/worker/index.ts` (`JOBS` و`answer` مصدَّران، و`parentPort` إن وُجد؛ و`crash` خلف `__DIWAN_TEST_DOORS__`) · `services/workerHost.ts` (`WorkerHost` بدالّة إقلاع، و`workerHost()`
  بـ`utilityProcess.fork(join(__dirname,'worker.js'))`، و`closeWorker()` في `before-quit`) · `electron.vite.config.ts` مدخلٌ ثانٍ · `app:workerPing` و`app:workerCrash` (في الأبواب) وبابهما `app` في الجسر.
  **وزيادةٌ لزمت الفحص:** `app:workerPing` يعيد مع `{pid, at}` رقم الرئيسة `main` — فالسيناريو لا يعرف رقمها من غيره.
- **الفحص:** `typecheck` ✓ · `workerHost` ٨ ✓ و`structure` و`repoHygiene` و`lint` (٢٠ ✓) · وكسرٌ مؤقّت (`../db` و`electron` في العامل) أسقط القاعدة الجديدة ثم أُعيد ·
  `electron-vite build` ثم `workerPath` ✓٩ مرّتين (العامل ٩٠٤٠ والرئيسة ١٩٨٠٠ ← بعد السقوط ٨١٩٦) و`firstDay` ✓٢٣ و`settings` ✓٢٩ · `npm run pack` و`out/main/worker.js` في `app.asar`،
  و`workerPath` على بناء الاختبار ✓٩ (العامل ١٥٥٢ والرئيسة ٦٦٦٠ ← ١٤٢٥٦).
- **المراجعة («كيف يُراجَع»):** `git diff --stat` في المسموح وحده · لا عمل حقيقيّ في `worker/index.ts` (`ping` و`crash` وحدهما). ✓
- **الوثائق:** ARCHITECTURE §١ (`worker/index.ts`) و§٢ («قائمٌ فارغًا») · `system.md` §٢ §٧ · QUALITY §٢ (١٨٢ و١١٢) · PLAN.
- **التالي:** D54 ⚙️ — حُجز ١٨ ت١ ٠٢:٠١.

## ٢٠٢٦-١٠-١٨ ٠١:٤٩ — مراجعة D52 ✓ (D53–D56) · وحجز D53 🔒
- **رسالة المالك:** «ابدأ».
- **مراجعة D52 بـ«كيف يُراجَع»:** الترتيب يبرّره القياس — «أزل الخلفية» الأشدّ (٢٧٧٩) أوّلًا، ثم المهلة والإلغاء كما طلب D52، ثم Photoshop (٢٠٠١)؛ وWord (٢٠٦٩)
  أشدّ منه لكنّه D57 بسببه المكتوب (`saveImage` لا يعبر العمليات) · D53 عاملٌ فارغ في التطوير وبناء الاختبار المحزوم · ARCHITECTURE §٢ «العامل المستقلّ» يقول
  ما يحدث عند السقوط («توقّف المعالج — جرّب ثانيةً» والقيد والإعادة والرجوع بعد سقوطين) وعند المهلة والإلغاء برسالتيهما · ولا أداة ولا مكتبة: `utilityProcess` مدمجٌ
  (Electron ٤٤٫٣٫٠)، فكلّها ⚙️ بحقّ. والمسارات والاختبارات والسيناريوهات المسمّاة في الأربعة موجودة (ببرنامج)، و`cutout-cancel` و`data-cutout-status` و`flattenPsd` حيث وُصفت. **✓**
- **تحقّق D53 قبل البدء:** لا `utilityProcess` ولا `worker_threads` ولا `app:worker` في `src/` · Electron ٤٤٫٣٫٠ · الشجرة نظيفة. ✓
- **التالي:** D53 ⚙️ (جارٍ).

## ٢٠٢٦-١٠-١٨ ٠١:٤٥ — D52 ✅ 🧭 — قياس العامل وتصميمه وأوامره D53–D56 · والتوقّف لتراجعها الجلسة التالية
- **تحقّق قبل البدء:** D51 ✅ · لا `utilityProcess` ولا `worker_threads` في `src/` · لا D53 فما بعده. ✓ · وElectron ٤٤٫٣٫٠ (`utilityProcess` فيه، و`postMessage` ينقل المنافذ وحدها).
- **القياس** (بناء التطوير، الجهاز المرجعي، ثلاث مرّات لكلٍّ؛ التوقّف = أطول ردٍّ لـ`settings.get` يُرسل كلّ ١٠٠ م.ث من الواجهة، والذاكرة = ذروة عمليّات Electron بـ`tasklist`؛
  السكربت والملفّات المولَّدة في مجلّد الجلسة ومجلّد `drive` المؤقّت، لم يُودَع شيء):
  | العمل | التوقّف (م.ث) | الوسيط | الذروة (م.ب) | الزمن |
  |---|---|---|---|---|
  | «أزل الخلفية» ١٠٢٤×١٠٢٤ (BiRefNet) مرّتين | ٣١٦٧ ٢٧٧٣ ٢٧٧٩ | **٢٧٧٩** | ١٦٣٨ | الأولى ٥٫٧ ث بتحميل النموذج، الثانية ٢٫٨ |
  | Word في مكتبة النماذج: ٢٠ ألف فقرة و٣٠ صورة (٠٫٨ م.ب) | ٢١٢٤ ١٩٨١ ٢٠٦٩ | **٢٠٦٩** | ٩٧١ | ٣٫٧ ث |
  | Photoshop عند حدّه (١١٩ م.ب، ٥٠٠٠×٥٠٠٠ بخمس قنوات) | ٢١٢٨ ١٩٠٠ ٢٠٠١ | **٢٠٠١** | ١١٢٧ | ٤٫١ ث |
  | PDF بـ٣٠٠ صفحة (٨٦ م.ب) فتحًا ثم بناءً | ٣٠٢ ٣١٠ ٣٢٦ | ٣١٠ | ١٣٤٦ | ٣٫٤ ث (الفتح ٢٫١) |
  | دفعة ٥٠٠ بطاقة إلى PDF (بعد المراجعة) | ٣٧٦ ٢١٤ ٢١٢ | ٢١٤ | **١٧٩٠** | ٢٢ ث |
- **ما يُستنتج:** التجميد في ثلاثة (النموذج، وقراءة Word، وPhotoshop) فهي أوامر العامل بترتيبها؛ وPDF يُرسم في الواجهة أصلًا، والدفعة مشكلتها ذاكرة نافذة الإخراج (E08) لا الرئيسة.
- **ما كُتب:** ARCHITECTURE §٢ «العامل المستقلّ» (٢١ سطرًا: القياس، وعاملٌ واحد، والقاعدة والمخزن في الرئيسة، والعقد، والمهلة والإلغاء، والسقوط، والذاكرة، والحزم والحراسة، وRust خلف
  العقد) · D53 ⚙️ (عاملٌ فارغ وسيناريو `workerPath` على بناء الاختبار، ٥٤ سطرًا) · D54 ⚙️ («أزل الخلفية»، ٥١) · D55 ⚙️ (المهلة والإلغاء وبابا اختبار، ٥١) · D56 ⚙️
  («استورد تصميمًا»، ٤٦) · D57 سطرٌ 🧭 (Word في مكتبة النماذج: `saveImage` لا يعبر العمليات فيحتاج تصميمًا) · ونصّ A03 في PLAN. ولا 🛑: لا أداة ولا مكتبة جديدة.
- **الفحص:** كلّ أمرٍ دون ثمانين سطرًا · كلّ مسارٍ قائمٍ مذكورٍ موجود (ببرنامج)، والجديد موسومٌ «جديد» · لا كود في `src/` `tests/` `tools/` · `repoHygiene` ✓ · لا بايت تحكّم.
- **التالي 🧭:** الجلسة التالية تراجع D53–D56 («كيف يُراجَع» في D52) ثم تنفّذ D53 ⚙️ بـ«ابدأ».
