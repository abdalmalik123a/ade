/** ر186: أدوات يسار وخصائص وطبقات يمين، ونوافذ الصفحة والتعبئة تحتفظ بحالتها. */
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

export default async function scenario(page, { shotsDir } = {}) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const click = (s) => page.eval(`const b=document.querySelector(${JSON.stringify(s)});b?.click();return Boolean(b);`);
  await page.goto('designed-documents');
  await click('button[data-kind="student-id"]');
  if (!await page.until(`return document.querySelector('[data-design-workspace]')?.checkVisibility();`, 10000)) throw new Error('لا مساحة عمل');
  await click('[data-tool-dock] button[title="إضافة نص مباشر"]');
  if (!await page.until(`return document.querySelector('[data-element-text]')?.checkVisibility();`, 5000)) throw new Error('لا خصائص نص');
  for (const [width, height] of [[1366, 768], [1280, 720]]) {
    await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await new Promise((r) => setTimeout(r, 250));
    const g = await page.eval(`
      const rect=s=>{const e=document.querySelector(s),b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom,visible:e.checkVisibility()};};
      return {dock:rect('[data-tool-dock]'),desk:rect('[data-desk]'),side:rect('[data-fixed-panels]'),props:rect('[data-design-properties]'),layers:rect('[data-design-layers]'),print:rect('[data-act="print"]'),save:rect('[data-act="save"]'),overflow:document.documentElement.scrollWidth>innerWidth};`);
    ok(`خصائص وطبقات ظاهرتان معًا ${width}`, g.props.visible && g.layers.visible && g.props.h > 80 && g.layers.h > 80);
    ok(`الأدوات يسار واللوحات يمين ${width}`, g.dock.right <= g.desk.x + 1 && g.side.x >= g.desk.right - 1);
    ok(`أدوات الإضافة عمودية ${width}`, g.dock.h > g.dock.w * 3);
    ok(`الإخراج والحفظ ضمن الشاشة ${width}`, g.print.visible && g.print.bottom <= height && g.save.visible && g.save.bottom <= height);
    ok(`بلا خروج أفقي ${width}`, !g.overflow);
    if (shotsDir) { mkdirSync(shotsDir, { recursive: true }); await page.shot(resolve(shotsDir, `fixed-${width}.png`)); }
  }
  ok('الخصائص قابلة للتعديل دون إخفاء الطبقات', await page.eval(`return document.querySelector('[data-element-text]').checkVisibility() && document.querySelector('[data-layer]').checkVisibility();`));
  const count = () => page.eval(`return document.querySelectorAll('[data-layer]').length;`);
  const before = await count();
  await click('[data-design-panel="fill"]');
  ok('مدخل التعبئة يفتح نافذته', await page.until(`return document.querySelector('[data-editor-panel="fill"]').checkVisibility() && document.querySelector('[data-batch-text]').checkVisibility();`, 5000));
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Backspace', key: 'Backspace', windowsVirtualKeyCode: 8 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Backspace', key: 'Backspace', windowsVirtualKeyCode: 8 });
  ok('المفاتيح خلف النافذة لا تحذف عنصرًا', (await count()) === before);
  await page.type('textarea[data-batch-text]', 'زينب علي حسن\nسالم حسن علي');
  await click('[data-editor-panel="fill"] [data-close-panel]');
  ok('إغلاق التعبئة يعيد اللوحتين', await page.eval(`return !document.querySelector('[data-editor-panel="fill"]').checkVisibility() && document.querySelector('[data-design-layers]').checkVisibility();`));
  await click('[data-design-panel="page"]');
  ok('الصفحة والاستيراد لها نافذة مستقلة', await page.until(`return document.querySelector('[data-editor-panel="page"]').checkVisibility() && Boolean(document.querySelector('[data-editor-panel="page"] input'));`, 5000));
  await page.key('Escape');
  ok('Escape يغلق نافذة الصفحة', await page.until(`return !document.querySelector('[data-editor-panel="page"]').checkVisibility();`, 5000));
  await click('[data-design-panel="fill"]');
  ok('قائمة الدفعة باقية بعد الإغلاق والصفحة', await page.eval(`return document.querySelector('textarea[data-batch-text]').value === ${JSON.stringify('زينب علي حسن\nسالم حسن علي')};`));
  await page.eval(`const root=document.querySelector('[data-editor-panel="fill"]');const all=[...root.querySelectorAll('button,input,textarea,select')].filter(b=>!b.disabled&&b.getClientRects().length);all.at(-1).focus();return true;`);
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Tab', key: 'Tab', windowsVirtualKeyCode: 9 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Tab', key: 'Tab', windowsVirtualKeyCode: 9 });
  ok('Tab يبقى داخل النافذة', await page.eval(`return Boolean(document.activeElement.closest('[data-editor-panel="fill"]'));`));
  await page.key('Escape');
  ok('الطبقات والخصائص باقيتان بعد Escape', await page.eval(`return !document.querySelector('[data-editor-panel="fill"]').checkVisibility() && document.querySelector('[data-design-properties]').checkVisibility() && document.querySelector('[data-design-layers]').checkVisibility();`));
  return steps.join('\n');
}
