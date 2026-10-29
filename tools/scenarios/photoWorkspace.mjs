/** ر186: الصور بأدوات يسار وخيارات أعلى وخطوات يمين وإخراج ثابت، بصورة مولدة. */
import { resolve,join } from 'node:path';
export function prepare(){return {DIWAN_TEST_OPEN_FILE:resolve('tests/fixtures/portrait-generated.png')};}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
export default async function scenario(page,{shotsDir}={}){
 const steps=[],ok=(s,v)=>steps.push(`${v?'✓':'✗'} ${s}`);
 const click=async s=>{await page.eval(`document.querySelector(${JSON.stringify(s)})?.click();return true;`);await wait(150);};
 const measure=()=>page.eval(`const r=s=>{const el=document.querySelector(s);if(!el)return null;const b=el.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,w:b.width,h:b.height,visible:el.checkVisibility()};};return {dock:r('[data-photo-dock]'),side:r('[data-photo-sidebar]'),view:r('[data-photo-viewport]'),options:r('[data-photo-options]'),size:r('[data-photo-size-output]'),copies:r('[data-photo-count]'),review:r('[data-act="review-photos"]'),save:r('[data-act="save-photo"]'),upload:r('[data-act="save-upload"]'),frame:r('[data-photo-frame]'),overflow:document.documentElement.scrollWidth>innerWidth,bodyScroll:document.documentElement.scrollHeight>innerHeight+1};`);
 const verify=(g,width,height,label)=>{
  ok(`الأدوات يسار والخصائص يمين ${label}`,g.dock.right<=g.view.x+1&&g.side.x>=g.view.right-1&&g.dock.h>g.dock.w*3);
  ok(`الخيارات أعلى المعاينة ${label}`,g.options.bottom<=g.view.y+1);
  ok(`المقاس والنسخ ظاهران ${label}`,g.size.y>=64&&g.copies.bottom<=height&&g.size.bottom<=height);
  ok(`الإخراج والحفظ والرفع ضمن الشاشة ${label}`,[g.review,g.save,g.upload].every(x=>x.visible&&x.y>=64&&x.bottom<=height));
  ok(`بلا خروج أو تمرير الصفحة ${label}`,!g.overflow&&!g.bodyScroll&&g.side.right<=width);
  if(g.frame)ok(`الصورة تسع مساحة المعاينة ${label}`,g.frame.y>=g.view.y&&g.frame.bottom<=g.view.bottom+1);
 };
 await page.goto('passport-photos');
 await page.send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});await wait(250);verify(await measure(),1280,720,'قبل الفتح');
 ok('الخطوات الست موجودة بأرقامها',await page.eval(`return [...document.querySelectorAll('[data-step]')].map(x=>x.dataset.step).join() === '1,2,3,4,5,6';`));
 await click('[data-act="open-photo"]');if(!await page.until(`return document.querySelector('[data-photo-frame]')?.dataset.cutout==='done'&&!document.querySelector('[data-act="review-photos"]').disabled;`,45000)) throw new Error('الصورة لم تجهز');
 for(const [width,height] of [[1280,720],[1366,768]]){await page.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await wait(300);verify(await measure(),width,height,`بعد الفتح ${width}`);}
 await click('[data-photo-size-guide] summary');verify(await measure(),1366,768,'مع فتح دليل المقاس');await click('[data-photo-size-guide] summary');
 await click('[data-tool="keep"]');ok('خيارات الفرشاة في الأعلى',await page.eval(`return Boolean(document.querySelector('[data-photo-options] [data-brush-toolbar]'));`));
 await page.type('[data-act="brush-size"]','23');await page.type('[data-act="brush-softness"]','0.4');await click('[data-tool="color"]');ok('خيارات اللون في الموضع نفسه',await page.eval(`return Boolean(document.querySelector('[data-photo-options] [data-erase-bar]'));`));
 await click('[data-tool="remove"]');ok('قيم الفرشاة تبقى عند تبديل الأداة',await page.eval(`return document.querySelector('[data-act="brush-size"]').value==='23'&&document.querySelector('[data-act="brush-softness"]').value==='0.4';`));
 await click('[data-tool="repair"]');ok('الترميم يعرض حد تحت الذقن',await page.eval(`return Boolean(document.querySelector('[data-repair-line]'));`));
 await click('[data-tool="move"]');const box=()=>page.eval(`return JSON.parse(document.querySelector('[data-photo-canvas]').dataset.box);`);const before=await box();
 const p=await page.eval(`const r=document.querySelector('[data-photo-frame]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};`);
 for(const[type,x]of[['mousePressed',p.x],['mouseMoved',p.x+14],['mouseReleased',p.x+14]])await page.send('Input.dispatchMouseEvent',{type,x,y:p.y,button:'left',clickCount:1});await wait(180);const moved=await box();
 ok('السحب يحرّك الصورة في الإطار',Math.abs(moved.left-before.left)>2);
 // التاريخ القائم يدفع لقطة قبل الفرشاة والقاط؛ السحب المباشر للصورة لا يدفع لقطة في الكود السابق أيضًا.
 await click('[data-tool="remove"]');await wait(350);
 const digest=()=>page.eval(`const c=document.querySelector('[data-photo-canvas]');const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let h=2166136261;for(const v of a)h=Math.imul(h^v,16777619);return h>>>0;`);const original=await digest();
 const stroke=await page.eval(`const r=document.querySelector('[data-photo-frame]').getBoundingClientRect();return{x:r.x+r.width*.5,y:r.y+r.height*.2};`);
 for(const[type,x]of[['mousePressed',stroke.x],['mouseMoved',stroke.x+8],['mouseReleased',stroke.x+8]])await page.send('Input.dispatchMouseEvent',{type,x,y:stroke.y,button:'left',clickCount:1});await wait(250);
 ok('الفرشاة تغير المعاينة فعليًا',await digest()!==original);await click('[data-act="history-undo"]');await wait(250);ok('التراجع يعيد بكسلات المعاينة',await digest()===original);
 ok('قيم الفرشاة تبقى بعد التراجع',await page.eval(`return document.querySelector('[data-act="brush-size"]').value==='23'&&document.querySelector('[data-act="brush-softness"]').value==='0.4';`));
 if(shotsDir)await page.shot(join(shotsDir,'photo-workspace.png'));
 return steps.join('\n');
}
