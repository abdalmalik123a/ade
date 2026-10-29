/** المسطرة: قياس الصفر والمسافة في التطبيق الحقيقي قبل التكبير والتمرير وبعدهما. */
import { join } from 'node:path';
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
export default async function scenario(page,{shotsDir}={}) {
 const steps=[],ok=(s,v)=>steps.push(`${v?'✓':'✗'} ${s}`);
 const click=async(s)=>{await page.eval(`document.querySelector(${JSON.stringify(s)})?.click();return true;`);await wait(200);};
 await page.goto('designed-documents');await click('[data-kind="student-id"]');
 if(!await page.until(`return document.querySelector('[data-design-rulers]')?.checkVisibility();`,8000)) throw new Error('لا مسطرة');
 const measure=()=>page.eval(`const rect=s=>document.querySelector(s).getBoundingClientRect();const sheet=rect('[data-design]'),x0=rect('[data-ruler-axis="x"] [data-ruler-tick="0"]'),x10=rect('[data-ruler-axis="x"] [data-ruler-tick="10"]'),y0=rect('[data-ruler-axis="y"] [data-ruler-tick="0"]'),y10=rect('[data-ruler-axis="y"] [data-ruler-tick="10"]');const zoom=sheet.width/((85.6+6)*96/25.4);const d=document.querySelector('[data-desk]');return {zoom,x:x0.x,y:y0.y,expectedX:sheet.right-3*96/25.4*zoom,expectedY:sheet.top+3*96/25.4*zoom,dx:x0.x-x10.x,dy:y10.y-y0.y,expectedGap:10*96/25.4*zoom,scroll:d.scrollTop};`);
 const verify=(m,label)=>{ok(`صفر القص مع النزف ${label}`,Math.abs(m.x-m.expectedX)<1&&Math.abs(m.y-m.expectedY)<1);ok(`عشرة ملم على المحورين ${label}`,Math.abs(m.dx-m.expectedGap)<1&&Math.abs(m.dy-m.expectedGap)<1);};
 const a=await measure();verify(a,'عند الفتح');
 await click('[data-zoom="out"]');const b=await measure();verify(b,'بعد التصغير');ok('المسطرة تغير المسافة مع التكبير',b.zoom<a.zoom&&b.dx<a.dx);
 for(let i=0;i<7;i++) await click('[data-zoom="in"]');
 const before=await measure();await page.eval(`const d=document.querySelector('[data-desk]');d.scrollTop=80;d.scrollLeft=-80;return true;`);await wait(200);const c=await measure();
 verify(c,'بعد التمرير');ok('التمرير حدث فعليًا والمسطرة تتبع الورقة',c.scroll>0&&Math.abs(c.y-before.y)>20);
 await click('[data-side-tabs] button:nth-child(2)');verify(await measure(),'في الظهر');
 await click('[data-side-tabs] button:first-child');verify(await measure(),'عند العودة للوجه');
 await click('[data-rulers]');ok('زر المسطرة يخفيها',!await page.eval(`return Boolean(document.querySelector('[data-design-rulers]'));`));await click('[data-rulers]');ok('ويعيدها',await page.eval(`return document.querySelector('[data-design-rulers]').checkVisibility();`));
 await click('[data-zoom="fit"]');if(shotsDir) await page.shot(join(shotsDir,'design-rulers.png'));
 return steps.join('\n');
}
