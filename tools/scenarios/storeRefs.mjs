/**
 * سيناريو: ملفّ المخزن المشترك لا يُحذف ما دام لغيره (خطة Production، ١٫١).
 *
 * المخزن يسمّي الملف ببصمته، فالصورة نفسها مستمسكًا لمواطنَين ملفٌّ واحد — بطاقة سكن
 * العائلة. وكان حذف مستمسك الأول يُتلف مستمسك الثاني: يبقى سجلّه ويُرفض ملفّه.
 * فيُفحص على التطبيق الحقيقي: من الجسر نفسه، ثم بقراءة الملفّ من بروتوكول المخزن.
 */
const BASE = `{ id: null, nationalId: null, jobTitle: null, workplace: null, employeeCode: null, serviceStatus: null,
  birthDate: null, birthPlace: null, enrollmentDept: null, address: null, housingCardNo: null, landmark: null,
  phone: null, photoPath: null, category: null, notes: null, verified: false }`;

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);

  const r = await page.eval(`
    const base = ${BASE};
    const reads = async (p) => { try { return (await fetch('diwan://store/' + p)).status === 200; } catch { return false; } };
    const c = document.createElement('canvas'); c.width = 40; c.height = 30;
    const g = c.getContext('2d'); g.fillStyle = '#336699'; g.fillRect(0, 0, 40, 30);
    const url = c.toDataURL('image/png');

    // ١ — مستمسكٌ مشترك: يُحذف من الأول فيبقى للثاني، ثم من الثاني فيُحذف.
    const father = await window.diwan.citizens.save({ ...base, fullName: 'أب العائلة' });
    const mother = await window.diwan.citizens.save({ ...base, fullName: 'أمّ العائلة' });
    await window.diwan.attachments.addFromDataUrl(father.id, 'بطاقة السكن', url);
    await window.diwan.attachments.addFromDataUrl(mother.id, 'بطاقة السكن', url);
    const f = (await window.diwan.citizens.get(father.id)).attachments[0];
    const m = (await window.diwan.citizens.get(mother.id)).attachments[0];
    await window.diwan.attachments.delete(f.id);
    const motherKeeps = await reads(m.filePath);
    await window.diwan.attachments.delete(m.id);
    const goneAtLast = !(await reads(m.filePath));

    // ٢ — حذف مواطنٍ كاملًا وفي ملفّه مستمسكٌ يشاركه فيه آخر.
    const c2 = document.createElement('canvas'); c2.width = 41; c2.height = 30;
    c2.getContext('2d').fillRect(0, 0, 41, 30);
    const url2 = c2.toDataURL('image/png');
    const one = await window.diwan.citizens.save({ ...base, fullName: 'الأول' });
    const two = await window.diwan.citizens.save({ ...base, fullName: 'الثاني' });
    await window.diwan.attachments.addFromDataUrl(one.id, 'عقد الزواج', url2);
    await window.diwan.attachments.addFromDataUrl(two.id, 'عقد الزواج', url2);
    const shared = (await window.diwan.citizens.get(two.id)).attachments[0].filePath;
    await window.diwan.citizens.delete(one.id);
    const twoKeeps = await reads(shared);

    return { samePath: f.filePath === m.filePath, motherKeeps, goneAtLast, twoKeeps };
  `);

  ok('الصورة نفسها مستمسكًا لاثنين ملفٌّ واحد في المخزن', r.samePath);
  ok('حذف مستمسك الأب يُبقي ملفّ مستمسك الأمّ مقروءًا', r.motherKeeps);
  ok('حذف آخر من يستعمله يحذف الملفّ من القرص', r.goneAtLast);
  ok('حذف مواطنٍ كاملًا يُبقي ما يشاركه فيه غيره', r.twoKeeps);
  return steps.join('\n');
}
