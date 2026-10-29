/** S33: صورة بطاقة مصنوعة، OCR المحلي الحقيقي، العرض والحافظة والأصل المخزون. */
export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const clipboardBefore = await page.eval('return window.diwan.ui.pasteText();');
  const ids = await page.eval(`
    const c = document.createElement('canvas'); c.width = 1900; c.height = 1100;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#111'; g.font = '54px Tahoma'; g.direction = 'rtl'; g.textAlign = 'right';
    const lines = ['الاسم / ناو : زينب علي حسن', 'الأب / باوك : علي', 'الجد / بابير : حسن',
      'اللقب / نازناو : الموسوي', 'الأم / دايك : هناء', 'تاريخ الولادة : 1990/01/15', 'ملاحظات : ناو'];
    lines.forEach((s, i) => g.fillText(s, 1800, 120 + i * 135));
    const citizen = await window.diwan.citizens.save({ id: null, fullName: 'ملف قراءة مصنوع', verified: false });
    const attachment = await window.diwan.attachments.addFromDataUrl(citizen.id, 'وطنية مصنوعة', c.toDataURL('image/png'));
    return { citizen: citizen.id, attachment: attachment.id };
  `);
  try {
    await page.goto('citizens-identity-records');
    if (!await page.until(`return Boolean(document.querySelector('[data-citizen-id="${ids.citizen}"]'));`, 8000)) throw new Error('ملف غير ظاهر');
    await page.eval(`document.querySelector('[data-citizen-id="${ids.citizen}"]').click(); return true;`);
    if (!await page.until(`const b = document.querySelector('button[title="استخراج النصوص OCR"]'); return b && !b.disabled;`, 8000)) throw new Error('قارىء غير جاهز');
    await page.eval(`document.querySelector('button[title="استخراج النصوص OCR"]').click(); return true;`);
    if (!await page.until(`return Boolean(document.querySelector('[data-ocr-panel]'));`, 60000)) throw new Error('لوحة OCR لم تظهر');
    const stored = () => page.eval(`const c = await window.diwan.citizens.get(${ids.citizen}); const a = c.attachments.find(a => a.id === ${ids.attachment}); return { text: a.ocrText, confidence: a.ocrAccuracy, name: c.fullName, birth: c.birthDate };`);
    const original = await stored();
    const shown = () => page.eval(`return document.querySelector('[data-ocr-text]').textContent;`);
    const cleaned = await shown();
    ok('OCR الحقيقي قرأ الصورة المصنوعة وخزّن النص', Boolean(original.text) && original.text.includes('اللقب') && original.text.includes('نازناو'));
    ok('والعرض المنقّى افتراضيًا يختلف عن الأصل', cleaned !== original.text && await page.eval(`return document.querySelector('[data-ocr-text]').dataset.ocrText === 'cleaned';`));
    ok('أُزيل عنوان اللقب الكردي وبقي العربي', !cleaned.includes('نازناو') && cleaned.includes('اللقب'));
    const tails = (text) => text.split('\n').filter(l => l.includes(':')).map(l => l.slice(l.indexOf(':'))).join('\n');
    ok('وكل جانب القيمة بعد النقطتين بقي حرفيًا كما قرأه المحرك', tails(cleaned) === tails(original.text));
    ok('والملاحظة التي هي قيمة لا تُحذف', original.text.includes('ناو') && cleaned.includes('ناو'));
    ok('والتنبيه يوضح بقاء الملتبس وأخطاء القراءة', (await page.text()).includes('قد تبقى كلمات ملتبسة وأخطاء قراءة'));
    ok('والثقة المعروضة هي الثقة الأصلية', (await page.text()).includes('دقة ' + Math.round(original.confidence * 100) + '%'));
    const click = async (act) => { await page.eval(`document.querySelector('[data-act="${act}"]').click(); return true;`); };
    await click('ocr-copy');
    ok('النسخ الافتراضي يطابق المنقّى المعروض', await page.until(`return (await window.diwan.ui.pasteText()) === ${JSON.stringify(cleaned)};`, 5000));
    await click('ocr-original');
    ok('يمكن الرجوع إلى الأصل حرفيًا', await page.until(`return document.querySelector('[data-ocr-text]').dataset.ocrText === 'original' && document.querySelector('[data-ocr-text]').textContent === ${JSON.stringify(original.text)};`, 5000));
    ok('وزر النسخ يقول إنه الأصل', await page.eval(`return document.querySelector('[data-act="ocr-copy"]').innerText === 'نسخ النصّ الأصلي';`));
    await click('ocr-copy');
    ok('ونسخ الأصل يطابقه', await page.until(`return (await window.diwan.ui.pasteText()) === ${JSON.stringify(original.text)};`, 5000));
    await click('ocr-original');
    ok('والرجوع للمنقّى يعيد العرض الأول', await page.until(`return document.querySelector('[data-ocr-text]').textContent === ${JSON.stringify(cleaned)};`, 5000));
    const after = await stored();
    ok('الأصل والثقة المخزونان لم يتغيرا', after.text === original.text && after.confidence === original.confidence);
    ok('ولا ملء لبيانات الملف من النص المنقّى', after.name === 'ملف قراءة مصنوع' && after.birth === null);
    ok('ولا ملء MRZ من هذه القراءة', !await page.eval(`return Boolean(document.querySelector('[data-act="mrz-fill"]'));`));
  } finally {
    await page.eval(`await window.diwan.ui.copyText(${JSON.stringify(clipboardBefore)}); return true;`);
  }
  return steps.join('\n');
}
