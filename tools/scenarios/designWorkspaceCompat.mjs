/** وثيقة مصنّعة ببنية ١٫٩ قبل نقل الواجهة؛ لا مصدر إنتاج يتغير هنا. */
import { readFileSync } from 'node:fs';
import { join,resolve } from 'node:path';
import Database from 'better-sqlite3';
const fixture=JSON.parse(readFileSync(resolve('tests/fixtures/design-workspace-legacy.json'),'utf8'));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
export default async function scenario(page,{profile}) {
 const steps=[],ok=(s,v)=>steps.push(`${v?'✓':'✗'} ${s}`);
 const click=async s=>{await page.eval(`document.querySelector(${JSON.stringify(s)})?.click();return true;`);await wait(180);};
 const saved=await page.eval(`return await window.diwan.templates.save({id:null,code:null,title:${JSON.stringify(fixture.meta.title)},subtitle:'90 × 55 ملم',category:'تصاميم',subjectLine:null,letterheadId:null,bodyHtml:'',variables:[],doc:${JSON.stringify(fixture)}});`);
 // إعادة النص الخام إلى الحقل كما يتركه الإصدار السابق، كي لا يسبق الفتحَ تطبيعٌ من باب الحفظ الحالي.
 const db=new Database(join(profile,'data','diwan.db'));db.prepare('UPDATE templates SET doc_json=? WHERE id=?').run(JSON.stringify(fixture),saved.id);db.close();
 const read=()=>page.eval(`return await window.diwan.templates.doc(${saved.id});`);
 await page.goto('designed-documents');await click(`[data-saved-thumb="${saved.id}"]`);
 if(!await page.until(`return document.querySelector('[data-design]')?.checkVisibility();`,8000))throw new Error('لم يفتح المحفوظ');
 const before=await read();
 ok('المحفوظ القديم يفتح في الإطار الثابت',await page.eval(`return document.querySelector('[data-design-properties]').checkVisibility()&&document.querySelector('[data-design-layers]').checkVisibility();`));
 ok('النص العربي والجدول والصورة مرسومة',await page.eval(`const d=document.querySelector('[data-design]');const img=d.querySelector('img');return d.innerText.includes('بطاقة الطالب')&&Boolean(d.querySelector('table'))&&Boolean(img&&img.complete&&img.naturalWidth>0);`));
 ok('ارتفاعات صفوف الوجه والعناوين قُرئت',JSON.stringify(before.canvas.elements.find(e=>e.id==='legacy-table').rowHeights)==='[18,27,35]'&&before.canvas.elements.find(e=>e.id==='legacy-table').headerHeight===20);
 await click('[data-side-tabs] button:nth-child(2)');
 ok('الظهر القديم يفتح بنصه وجدوله',await page.eval(`const d=document.querySelector('[data-design]');return d.innerText.includes('ظهر البطاقة')&&Boolean(d.querySelector('table'));`));
 await click('[data-side-tabs] button:first-child');
 await page.eval(`document.querySelector('[data-handle="legacy-name"]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));return true;`);
 if(!await page.until(`return Boolean(document.querySelector('[data-inline-text]'));`,3000))throw new Error('لا محرر نص');
 await page.typeKeys('[data-inline-text]','بطاقة مجددة {الاسم}');await click('[data-inline-accept]');
 ok('يُعدّل النص القديم من اللوحة',await page.eval(`return document.querySelector('[data-element-text]').value==='بطاقة مجددة {الاسم}';`));
 await click('[data-design-panel="fill"]');
 ok('الحقول القديمة موجودة في التعبئة',await page.eval(`return document.querySelector('input[data-value="الاسم"]').checkVisibility();`));
 const batch='اسم التلميذ\nزينب علي حسن\nسالم حسن علي';await page.type('[data-batch-text]',batch);await wait(350);
 ok('ربط العمود القديم يملأ الاسم في الرسم',await page.eval(`return document.querySelector('[data-design]').innerText.includes('زينب علي حسن');`));
 await click('[data-editor-panel="fill"] [data-close-panel]');await click('[data-design-panel="page"]');await click('[data-editor-panel="page"] [data-close-panel]');await click('[data-design-panel="fill"]');
 ok('الدفعة باقية بعد الإغلاق وفتح الصفحة',await page.eval(`return document.querySelector('[data-batch-text]').value===${JSON.stringify(batch)};`));
 await click('[data-act="sheets"]');
 if(!await page.until(`return Boolean(document.querySelector('[data-sheets] .print-page'));`,8000))throw new Error('لا مراجعة');
 const reviewText=await page.eval(`return document.querySelector('[data-sheets]').innerText;`);
 ok('مراجعة الدفعة بوجهين وبالأسماء نفسها',reviewText.includes('بوجهين')&&reviewText.includes('زينب علي حسن')&&reviewText.includes('سالم حسن علي'));
 await click('[data-sheets] button[title="التالية"]');
 ok('مراجعة الظهر تحفظ النص والاسم',await page.eval(`const d=document.querySelector('[data-sheets] .print-page');return d.innerText.includes('ظهر البطاقة')&&d.innerText.includes('زينب علي حسن');`));
 await click('[data-sheets] button[title="رجوع (Esc)"]');await click('[data-editor-panel="fill"] [data-close-panel]');await click('[data-act="save"]');await wait(700);
 const after=await read();
 const stable=c=>JSON.stringify(c.elements.filter(e=>e.id!=='legacy-name'));
 ok('حفظ التعديل يبقي الصورة والجدول بكل بياناتهما',stable(before.canvas)===stable(after.canvas));
 ok('ويبقي الظهر وارتفاع صفوفه كما كان',JSON.stringify(before.backCanvas)===JSON.stringify(after.backCanvas));
 ok('ويبقي ربط الأعمدة والحقول',JSON.stringify(after.meta.batchMap)===JSON.stringify(before.meta.batchMap)&&after.fields.some(f=>f.key==='الاسم'));
 await click('[data-act="gallery"]');await click(`[data-saved-thumb="${saved.id}"]`);await wait(350);
 ok('يفتح ثانية بالنص المعدل والمقاس القديم',await page.eval(`return document.querySelector('[data-design]').innerText.includes('بطاقة مجددة')&&document.querySelector('[data-size]').innerText.includes('90.0 × 55.0');`));
 ok('الوجه والظهر بقيت معرفاتهما',after.canvas.elements.length===fixture.canvas.elements.length&&after.backCanvas.elements.length===fixture.backCanvas.elements.length);
 return steps.join('\n');
}
