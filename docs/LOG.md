# دفتر التسليم

> قيدٌ لكلّ جلسة، **الأحدث في الأعلى**، عشرة أسطر على الأكثر: التاريخ والساعة · الأمر · ما تغيّر (الإيداعات) · الفحص ونتيجته ·
> المراجعة (أيّ أمرٍ رُوجع وبأيّ نتيجة) · أين توقّف بالضبط · الخطوة التالية.
>
> الأقدم في `docs/legacy/LOG-*.md` (يُبحث فيه بـGrep). وحين يزيد الدفتر على ١٠٠ ك.ب ينقل الأمر الخاتم أقدم قيوده بنصّها — إلا قيود ما لم يُراجَع —
> إلى `docs/legacy/LOG-<التالي>.md` (يحرسه `tests/docsBudget.test.ts`).

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
