/** العسلي والسيان (D241، ر192): تفاعل حقيقي بالفأرة والمفاتيح، لا صفحة عرض مصطنعة. */
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

export function prepare() {
  const inbox = join(process.env.TEMP, 'honey-cyan-inbox');
  mkdirSync(inbox, { recursive: true });
  return { DIWAN_TEST_INBOX: `downloads=${inbox}` };
}

export default async function scenario(page, { shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const style = (selector, prop) => page.eval(`const el = document.querySelector(${JSON.stringify(selector)}); return el ? getComputedStyle(el)[${JSON.stringify(prop)}] : null;`);
  const until = async (expression) => {
    for (let i = 0; i < 60; i++) {
      if (await page.eval(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const debug = await page.eval(`const b = document.querySelector('[data-basket] .btn-act'); const r = b?.getBoundingClientRect(); return { hoverMedia: matchMedia('(hover: hover)').matches, hover: b?.matches(':hover'), image: b && getComputedStyle(b).backgroundImage, rect: r && { x: r.x, y: r.y, w: r.width, h: r.height }, point: r && document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML.slice(0,300) };`);
    throw new Error(`انتهى انتظار: ${expression} · ${JSON.stringify(debug)}`);
  };
  const key = async (key, shift = false) => {
    const codes = { Tab: 9, Enter: 13 };
    const params = { key, code: key, windowsVirtualKeyCode: codes[key], nativeVirtualKeyCode: codes[key], modifiers: shift ? 8 : 0 };
    await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...params });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...params });
  };
  const fill = '[data-basket] .btn-act';
  await page.eval(`
    for (const title of ['تأييد سكن', 'طلب خطي']) {
      await window.diwan.templates.save({ id: null, code: null, title, subtitle: null, category: 'معاملات',
        subjectLine: null, letterheadId: null, bodyHtml: 'نموذج تجريبي باسم {الاسم}.',
        variables: [{ token: 'الاسم', label: 'الاسم', source: 'citizen', required: true }] });
    }
    return true;
  `);
  await page.goto('templates-library-drafts');
  await page.goto('service-counter');
  await until(`return document.querySelectorAll('[data-template-card]').length === 2;`);
  const text = await page.text();
  ok('الشبّاك بنصوصه وسلّته', text.includes('ماذا يطلب الزبون؟') && text.includes('سلّة النماذج'));
  ok('خلفية النموذج رمادية موحّدة', (await style('body', 'backgroundColor')) === 'rgb(243, 245, 247)' && (await style('body', 'backgroundImage')) === 'none');
  ok('نص كحلي معتمد', (await style('body', 'color')) === 'rgb(18, 50, 77)');
  ok('المعطّل رمادي بلا ظل أو شفافية', (await style(fill, 'backgroundColor')) === 'rgb(230, 232, 230)' && (await style(fill, 'backgroundImage')) === 'none' && (await style(fill, 'boxShadow')) === 'none' && (await style(fill, 'opacity')) === '1');
  await page.clickText('تأييد سكن', '[data-template-card]');
  const card = '[data-template-card].border-cyan';
  ok('تحديد سيان وعلامة واضحة بلا إزاحة البطاقة', (await style(card, 'borderColor')) === 'rgb(99, 191, 203)' && (await style(card, 'transform')) === 'none' && (await page.eval(`return document.querySelector('${card}').innerText.includes('check');`)));
  ok('سطر السلّة يستجيب بحركة قصيرة', (await style('[data-basket-item]', 'animationName')) === 'basket-arrive' && (await style('[data-basket-item]', 'animationDuration')) === '0.16s');
  await page.clickText('طلب خطي', '[data-template-card]');
  ok('العدد يعكس الاختيارين', (await page.eval(`return document.querySelector('[data-basket-count]').innerText;`)).trim() === '٢');
  const geometry = () => page.eval(`const r = document.querySelector('${fill}').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height };`);
  await page.eval(`await document.fonts.ready; return true;`);
  const before = await geometry();
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 });
  const base = await style(fill, 'backgroundImage');
  ok('الفعل عسلي من درجتي النموذج بنص كحلي', base.includes('rgb(245, 184, 102)') && base.includes('rgb(239, 160, 74)') && (await style(fill, 'color')) === 'rgb(18, 50, 77)');
  const x = before.x + before.width / 2, y = before.y + before.height / 2;
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await until(`return getComputedStyle(document.querySelector('${fill}')).backgroundImage.includes('rgb(227, 147, 57)');`);
  ok('المرور يهدّئ الدرجة ويعمّق الظل', (await style(fill, 'backgroundImage')).includes('rgb(241, 173, 86)') && (await style(fill, 'boxShadow')).includes('9px'));
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await until(`const s = getComputedStyle(document.querySelector('${fill}')); return s.backgroundImage === 'none' && s.backgroundColor === 'rgb(246, 183, 106)';`);
  ok('الضغط يفتح العسلي ويعكس الظل للداخل', (await style(fill, 'backgroundColor')) === 'rgb(246, 183, 106)' && (await style(fill, 'boxShadow')).includes('2px 3px 5px'));
  // الإفلات خارج الزر يمنع الانتقال إلى الملء في هذه الخطوة؛ نختبره لاحقًا بـEnter.
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1, buttons: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 1, y: 1, button: 'left', clickCount: 1 });
  ok('المقاس والموضع ثابتان في المرور والضغط', JSON.stringify(await geometry()) === JSON.stringify(before));
  await page.eval(`document.querySelector('${fill}').focus(); return true;`);
  await key('Tab', true);
  await key('Tab');
  await until(`return getComputedStyle(document.querySelector('${fill}')).boxShadow.includes('99, 191, 203');`);
  ok('Tab يركّز زر الفعل بهالة سيان وحلقة واضحة', (await page.eval(`return document.querySelector('${fill}') === document.activeElement && document.activeElement.matches(':focus-visible');`)) && (await style(fill, 'outlineColor')) === 'rgb(36, 94, 105)' && (await style(fill, 'boxShadow')).includes('99, 191, 203'));
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  ok('تفضيل تقليل الحركة يلغي الانتقال والحركة', (await style(fill, 'transitionDuration')) === '0s' && (await style('[data-basket-item]', 'animationName')) === 'none');
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await page.eval(`document.activeElement?.blur(); return true;`);
  ok('على ١٢٨٠×٧٢٠: زر املأ ظاهر ولا تمرير أفقي', await page.eval(`const r = document.querySelector('${fill}').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && document.documentElement.scrollWidth <= innerWidth;`));
  if (shotsDir) await page.shot(join(shotsDir, 'honey-cyan-counter.png'));
  await page.eval(`document.querySelector('${fill}').focus(); return true;`);
  await key('Enter');
  await until(`return document.querySelector('[data-steps] [aria-current="step"]')?.innerText.includes('املأ');`);
  ok('Enter ينفّذ الفعل وينقل إلى الملء', (await page.text()).includes('بيانات صاحب العلاقة'));
  await page.eval(`document.querySelector('[data-act="park"]').click(); return true;`);
  await until(`return Boolean(document.querySelector('[data-basket]'));`);
  await page.goto('citizens-identity-records');
  await page.clickText('إضافة ملف مواطن');
  await page.clickText('حفظ الملف', '[data-citizen-form] button');
  const invalid = '[data-citizen-field="fullName"]';
  await until(`return document.querySelector('${invalid}')?.getAttribute('aria-invalid') === 'true';`);
  await until(`return getComputedStyle(document.querySelector('${invalid}')).borderColor === 'rgb(184, 38, 44)';`);
  ok('الخطأ القائم يلوّن العنوان والحد ويترك قيمة الحقل بلونها', (await style(invalid, 'borderColor')) === 'rgb(184, 38, 44)' && (await page.eval(`const input = document.querySelector('${invalid}'); return getComputedStyle(input.parentElement.querySelector('label')).color;`)) === 'rgb(184, 38, 44)' && (await style(invalid, 'color')) !== 'rgb(184, 38, 44)');
  await page.type(invalid, 'زينب علي حسن');
  await until(`return document.querySelector('${invalid}')?.getAttribute('aria-invalid') !== 'true';`);
  await until(`return getComputedStyle(document.querySelector('${invalid}')).borderColor === 'rgb(226, 231, 234)';`);
  ok('تصحيح الإدخال يزيل حالة الخطأ نفسها', (await style(invalid, 'borderColor')) !== 'rgb(184, 38, 44)');
  return steps.join('\n');
}
