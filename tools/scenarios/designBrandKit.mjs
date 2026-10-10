/**
 * سيناريو: «طقم الجهة» (DESIGNS.md ٣٫٣) — جهةٌ بلونٍ أخضر وخطّ «القاهرة» وشعارٍ يُحفظ خطّها من ملفّها، ثمّ شهادةٌ ملكيّة زرقاء
 * من المعرض: «طبّق» يجعل عنوانها أخضر وخلفيّتها بلا أزرق، ونصوصها بالقاهرة، وشعار الجهة في ركنها، واسمها
 * في حقل «الجهة» — والتراجع يعيد الأزرق.
 */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/** PNG ‏٢×٢ أخضر — شعارٌ صغير. */
const LOGO = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 2, 0, 0, 0, 2, 8, 2, 0, 0, 0, 253, 212, 154, 115, 0, 0, 0, 20, 73, 68, 65, 84, 120, 156, 99, 16, 96, 136, 1, 66, 6, 40, 3, 0, 32, 238, 3, 129, 51, 140, 196, 174, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130];

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); return true;`);
  const drawn = () => page.eval(`return document.querySelector('[data-design]')?.innerHTML ?? '';`);

  await page.goto('designed-documents');
  await wait(600);
  const saved = await page.eval(`
    const c = await window.diwan.clients.save({ id: null, name: 'مدرسة النور الابتدائية', color: '#0f6b50', font: 'Cairo', address: 'بغداد — الكرخ', phone: '0770 000 0000' });
    const logo = await window.diwan.files.storeImage(new Uint8Array(${JSON.stringify(LOGO)}));
    const done = await window.diwan.clients.setLogo(c.id, logo);
    return { font: done.font, logo: done.logo };`);
  ok(`خطّ الجهة يُحفظ في ملفّها مع شعارها (${JSON.stringify(saved)})`, saved.font === 'Cairo' && Boolean(saved.logo));

  await page.goto('designed-documents');
  await wait(900);
  await click('[data-style="official"]');
  await click('button[data-kind="thanks"]');
  await wait(1200);
  const before = await drawn();
  const blue = (html) => /%231f3a8a|#1f3a8a/i.test(html);
  ok('الشهادة الملكية زرقاء قبل الطقم', blue(before));

  await page.eval(`
    const s = document.querySelector('select[data-act="brand-client"]');
    const o = [...s.options].find((x) => x.textContent.includes('مدرسة النور'));
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, o.value);
    s.dispatchEvent(new Event('change', { bubbles: true }));
    return true;`);
  await wait(200);
  await click('[data-act="brand-apply"]');
  await wait(1200);
  const after = await drawn();
  ok('«طبّق»: لا أزرق باقٍ في العناوين والخلفية', !blue(after));
  // النمط الرسمي بالنسخ والكوفي — فكلّها تصير القاهرة (والرقعة وحدها تبقى، ولا رقعة فيه).
  ok('والنصوص بخطّ الجهة', after.includes("font-family:'Cairo'") && !after.includes("font-family:'Amiri'") && !after.includes("font-family:'Noto Kufi Arabic'"));
  ok('وشعار الجهة في ركنها', /<img[^>]+diwan:\/\/store\/images\//.test(after));
  const org = await page.eval(`return document.querySelector('input[data-value="الجهة"]')?.value ?? null;`);
  ok(`واسمها في حقل «الجهة» (${org})`, org === 'مدرسة النور الابتدائية');

  await click('[data-undo]');
  await wait(500);
  ok('والتراجع يعيد الأزرق', blue(await drawn()));
  return steps.join('\n');
}
