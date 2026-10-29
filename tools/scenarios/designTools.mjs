/** ر186: اختيار أداة ثم الموضع، ونص عربي مباشر بقيد واحد مع الحماية. */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export default async function scenario(page) {
  const steps = []; const ok = (s, v) => steps.push(`${v ? '✓' : '✗'} ${s}`);
  const click = async (s) => { await page.eval(`document.querySelector(${JSON.stringify(s)})?.click();return true;`); await wait(120); };
  const n = () => page.eval(`return document.querySelectorAll('[data-layer]').length;`);
  const selected = () => page.eval(`return document.querySelector('[data-handle].outline-primary')?.dataset.handle;`);
  const rect = (s) => page.eval(`const r=document.querySelector(${JSON.stringify(s)})?.getBoundingClientRect();return r?{x:r.x,y:r.y,right:r.right,top:r.top,w:r.width,h:r.height}:null;`);
  const at = async (x,y) => { const r=await rect('[data-design]');return {x:r.right-r.w*x,y:r.y+r.h*y}; };
  const mouse = (type,p,extra={}) => page.send('Input.dispatchMouseEvent',{type,x:p.x,y:p.y,button:'left',clickCount:1,...extra});
  const place = async (x,y,to) => { const p=await at(x,y);await mouse('mousePressed',p);if(to) await mouse('mouseMoved',await at(...to));await mouse('mouseReleased',to?await at(...to):p);await wait(200);return p; };
  const editText = async (id) => {
    await click('[data-design-tool="select"]');const r=await rect(`[data-handle="${id}"]`);const p={x:r.x+r.w/2,y:r.y+r.h/2};
    for(const count of [1,2]) { await mouse('mousePressed',p,{clickCount:count});await mouse('mouseReleased',p,{clickCount:count}); }
    await wait(200);
  };
  const text = () => page.eval(`return document.querySelector('[data-element-text]')?.value??'';`);
  await page.goto('designed-documents');await click('[data-kind="student-id"]');
  if(!await page.until(`return document.querySelector('[data-design]')?.checkVisibility();`,8000)) throw new Error('لا لوحة');
  const base=await n();await click('[data-design-tool="text"]');
  ok('اختيار النص لا يضيف عنصرًا',await n()===base);
  const p=await place(.1,.1);const first=await selected();let r=await rect(`[data-handle="${first}"]`);
  ok('النقر يضع النص من يمين الورقة في الموضع المقصود',await n()===base+1&&Math.abs(r.right-p.x)<2&&Math.abs(r.top-p.y)<2);
  await place(.4,.45);const id=await selected();
  ok('الأداة مستمرة للنقر الثاني',await n()===base+2&&await page.eval(`return document.querySelector('[data-design-tool="text"]').getAttribute('aria-pressed')==='true';`));
  await click('[data-undo]');ok('الإدراج تراجع واحد',await n()===base+1);await click('button[title="إعادة (Ctrl+Y)"]');ok('والإعادة ترجع العنصر',await n()===base+2);
  await click('[data-zoom="out"]');await click('[data-design-tool="shape"]');
  const from=await at(.08,.7),to=await at(.35,.9);await place(.08,.7,[.35,.9]);r=await rect(`[data-handle="${await selected()}"]`);
  ok('السحب مع التكبير يطابق الموضع والمقاس',Math.abs(r.right-from.x)<2&&Math.abs(r.top-from.y)<2&&Math.abs(r.w-(from.x-to.x))<2&&Math.abs(r.h-(to.y-from.y))<2);
  await page.key('Escape');ok('Escape يعيد التحديد',await page.eval(`return document.querySelector('[data-design-tool="select"]').getAttribute('aria-pressed')==='true';`));
  await editText(id);ok('نقرتان تفتحان النص فوق اللوحة',await page.eval(`return document.querySelector('[data-inline-text]')===document.activeElement;`));
  await page.typeKeys('[data-inline-text]','زينب علي حسن');
  ok('الكتابة العربية فعلية ولا تعتمد كل حرف',await text()==='نص جديد'&&await page.eval(`return document.querySelector('[data-inline-text]').value==='زينب علي حسن';`));
  const caret=await page.eval(`return document.querySelector('[data-inline-text]').selectionStart;`);
  ok('مؤشر الكتابة بقي في نهاية الإدخال',caret==='زينب علي حسن'.length);
  await page.key('Backspace');ok('Backspace يحذف حرفًا ويبقي العنصر',await n()===base+3&&await page.eval(`return document.querySelector('[data-inline-text]').value==='زينب علي حس';`));
  await click('[data-inline-cancel]');ok('إلغاء النص يعيد الأصل',await text()==='نص جديد'&&!await page.eval(`return Boolean(document.querySelector('[data-inline-text]'));`));
  await editText(id);await page.typeKeys('[data-inline-text]','مريم عادل');await click('[data-inline-accept]');
  ok('الاعتماد يحدّث الرسم والخصائص',await text()==='مريم عادل'&&await page.eval(`return document.querySelector('[data-design]').innerText.includes('مريم عادل');`));
  await click('[data-undo]');ok('تراجع واحد يعيد النص كله',await text()==='نص جديد');await click('button[title="إعادة (Ctrl+Y)"]');ok('إعادة واحدة تعيد النص كله',await text()==='مريم عادل');
  await page.eval(`document.querySelector('[data-layer-lock="${id}"]')?.click();return true;`);await wait(100);
  await editText(id);ok('المقفل لا يفتح محرر النص',!await page.eval(`return Boolean(document.querySelector('[data-inline-text]'));`));
  await page.eval(`document.querySelector('[data-layer-lock="${id}"]')?.click();document.querySelector('[data-layer-hide="${id}"]')?.click();return true;`);await wait(150);
  ok('المخفي لا يملك سطح تحرير',!await page.eval(`return Boolean(document.querySelector('[data-handle="${id}"]'));`));
  await click('[data-design-tool="field"]');await click('[data-cancel-tool]');ok('زر الإلغاء يعيد أداة التحديد',await page.eval(`return document.querySelector('[data-design-tool="select"]').getAttribute('aria-pressed')==='true';`));
  const count=await n();await page.eval(`document.activeElement?.blur();return true;`);await page.key('KeyU');await page.key('KeyF');ok('لا اختصارات حروف تضيف عناصر',await n()===count);
  await click('[data-side-tabs] button:nth-child(2)');await wait(250);const back=await n();await click('[data-design-tool="barcode"]');await place(.1,.2);ok('الأداة تضيف في الظهر وحده',await n()===back+1);
  await click('[data-side-tabs] button:first-child');ok('الوجه يحتفظ بعناصره',await n()===count);
  return steps.join('\n');
}
