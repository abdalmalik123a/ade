/**
 * سيناريو: الأنماط والأنواع الجديدة (DESIGNS.md ٣٫١) — المعرض بثلاثة عشر نمطًا تلتفّ ولا تخرج عن عرضها، ومجموعة «مطاعم
 * ومحلّات»؛ والمنيو بنمط «مطعم داكن» أصنافه بحبرٍ فاتح على الفحميّ؛ واستمارة الفاتورة بنمط «ليالي رمضان» جدولٌ مرقّمٌ باثني
 * عشر سطرًا فارغًا؛ ووصل القبض بأسطره المنقّطة — كلّها تُفتح في المحرّر.
 */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); return true;`);
  const drawn = () => page.eval(`return document.querySelector('[data-design]')?.innerHTML ?? '';`);
  const open = async (style, kind) => {
    await click('[data-act="gallery"]');
    await wait(600);
    await click(`[data-style="${style}"]`);
    await wait(300);
    await click(`button[data-kind="${kind}"]`);
    await wait(1200);
  };

  await page.goto('designed-documents');
  await wait(800);
  const picker = await page.eval(`
    const buttons = [...document.querySelectorAll('[data-style]')];
    const box = buttons[0]?.parentElement?.getBoundingClientRect();
    return { count: buttons.length, inside: buttons.every((b) => { const r = b.getBoundingClientRect(); return r.left >= box.left - 1 && r.right <= box.right + 1; }), names: buttons.map((b) => b.textContent.trim()) };`);
  ok(`ثلاثة عشر نمطًا داخل عرضها (${picker.count}: ${picker.names.slice(5).join('، ')})`, picker.count === 13 && picker.inside);
  await click('[data-group="مطاعم ومحلّات"]');
  await wait(300);
  const group = await page.eval(`return [...document.querySelectorAll('button[data-kind]')].map((b) => b.dataset.kind);`);
  ok(`ومجموعة «مطاعم ومحلّات» تبويبٌ بالمنيو والوصل والفاتورة (${group.join('، ')})`, group.length === 3 && ['menu', 'receipt', 'invoice'].every((k) => group.includes(k)));

  await click('[data-style="restaurant"]');
  await wait(300);
  await click('button[data-kind="menu"]');
  await wait(1200);
  const menu = await drawn();
  ok('المنيو بنمط «مطعم داكن»: الأصناف بحبرٍ فاتح على الفحميّ', menu.includes('قوزي على تمّن') && menu.includes('<tr style="color:#efe6da;">'));

  await open('ramadan', 'invoice');
  const invoice = await drawn();
  const rows = await page.eval(`return document.querySelectorAll('[data-design] tbody tr').length;`);
  ok(`واستمارة الفاتورة بنمط «ليالي رمضان»: جدولٌ مرقّم (${rows} سطرًا) يُملأ بالقلم`, rows === 12 && invoice.includes('>١٢<') && invoice.includes('فاتورة'));

  await open('lineart', 'receipt');
  const receipt = await drawn();
  ok('ووصل القبض بأسطره: «استلمنا من» و«مبلغًا وقدره» و«وذلك عن»', ['وصل قبض', 'استلمنا من السيد / السيدة', 'مبلغًا وقدره', 'وذلك عن'].every((t) => receipt.includes(t)));
  return steps.join('\n');
}
