/**
 * سيناريو: قراءة ظهر البطاقة بقارئه الخاصّ (تعميق الموجود ٨) — على التطبيق الحقيقي.
 *
 * الماسح يُعطي `tests/fixtures/card-back-fake.png` (بياناتٌ مخترعة بظواهر نسخةٍ مصوّرة
 * حقيقية)، ثم زرّ «اقرأ ظهر البطاقة» على المستمسك، ثم «املأ ملفّه بها» والحفظ. ثم مسحٌ ثانٍ صورته
 * `tests/fixtures/passport-fake.png` (S41، D181): صفحة الجواز تُقرأ ويملأ رقمها ملفّه، وما في الملفّ لا يُكتب فوقه.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** مسار المسح ثابتٌ تحت المِقْود: يُكتب فيه ما «يمسحه» الماسح قبل كلّ مسح. */
export async function prepare() {
  const dir = join(process.env.TEMP ?? '.', `diwan-mrz-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const scan = join(dir, 'scan.png');
  copyFileSync(resolve('tests/fixtures/card-back-fake.png'), scan);
  process.env.MRZ_SCAN_FILE = scan;
  return { DIWAN_TEST_SCAN_FILE: scan };
}

export default async function scenario(page, { shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (test, ms = 30000) => {
    for (let t = 0; t < ms; t += 300) {
      if (await test()) return true;
      await wait(300);
    }
    return false;
  };

  await page.goto('citizens-identity-records');
  await page.clickText('إضافة ملف مواطن');
  await wait(500);
  await page.eval(`
    const l = [...document.querySelectorAll('label')].find(x => x.textContent.trim().startsWith('الاسم الرباعي واللقب'));
    const input = l.parentElement.querySelector('input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'سمير خالد عبد الله');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  `);
  await page.clickText('حفظ الملف');
  await wait(900);
  ok('حُفظ ملف المواطن بالاسم وحده', (await page.text()).includes('حُفظ ملف المواطن'));

  await page.clickText('مسح ضوئي فوري');
  ok('مُسح ظهر البطاقة', await until(async () => (await page.text()).includes('اكتمل المسح الضوئي')));

  const t0 = Date.now();
  const clicked = await page.eval(`
    const b = document.querySelector('button[title^="اقرأ ظهر البطاقة"]');
    if (!b || b.disabled) return false;
    b.click();
    return true;
  `);
  ok('زرّ «اقرأ ظهر البطاقة» على المستمسك', clicked);
  const read = await until(async () => (await page.text()).includes('قُرئ وتحقّقت أرقامه'), 60000);
  ok(`قُرئ ظهر البطاقة وتحقّقت أرقامه (${((Date.now() - t0) / 1000).toFixed(1)} ث)`, read);
  const text = await page.text();
  ok('رقم الوثيقة', text.includes('Z12345678'));
  ok('الرقم الشخصي من الحقل الاختياري', text.includes('199012345678'));
  ok('الولادة والنفاذ', text.includes('1990-01-15') && text.includes('2031-02-20'));
  ok('الاسم اللاتيني', text.includes('SAMIR KHALID'));
  ok('ولا «المستمسك منتهٍ» — نفاذها ٢٠٣١ (S29)', !(await page.eval(`return Boolean(document.querySelector('[data-mrz-expired]'));`)));
  ok('لا «دقّة» لقراءة ظهر البطاقة — أرقام التحقّق حَكَمُها', !/دقة \d+%/.test(text.slice(text.indexOf('ظهر البطاقة —'))));
  ok('ولا ملاحظة «القارئ العامّ»', !text.includes('من القارئ العامّ'));
  const shown = await page.eval(`const pre = document.querySelector('pre[dir="ltr"]'); return pre ? pre.textContent : null;`);
  ok('السطور الثلاثة من اليسار كما على البطاقة', shown?.startsWith('IDIRQZ123456789') && shown.includes('<<SAMIR<KHALID<<'));
  if (shotsDir) await page.shot(join(shotsDir, 'mrz-read.png'));

  await page.eval(`document.querySelector('[data-act="mrz-fill"]').click(); return true;`);
  await wait(600);
  await page.clickText('حفظ الملف');
  await wait(900);
  const saved = await page.eval(`
    const list = await window.diwan.citizens.list({ query: 'سمير خالد' });
    const c = await window.diwan.citizens.get(list.items?.[0]?.id ?? list[0]?.id);
    return { nationalId: c.nationalId, birthDate: c.birthDate, gender: c.gender, latinName: c.latinName };
  `);
  ok(`حُفظت في ملفّه: ${JSON.stringify(saved)}`, saved.nationalId === '199012345678' && saved.birthDate === '1990-01-15' && saved.gender === 'ذكر' && saved.latinName === 'SAMIR KHALID');

  // ── صفحة الجواز (S41، D181): مسحٌ ثانٍ، ثم القراءة والملء ──
  copyFileSync(resolve('tests/fixtures/passport-fake.png'), process.env.MRZ_SCAN_FILE);
  const readButtons = () => page.eval(`return document.querySelectorAll('button[title^="اقرأ ظهر البطاقة"]').length;`);
  const before = await readButtons();
  await page.clickText('مسح ضوئي فوري');
  ok('ومُسحت صفحة الجواز مستمسكًا ثانيًا', await until(async () => (await readButtons()) > before));
  // أيّ الزرّين للمستمسك الجديد: يُجرَّب حتى تقول اللوحة «جواز السفر».
  let passportRead = false;
  for (let k = 0; k < (await readButtons()) && !passportRead; k++) {
    await page.eval(`document.querySelectorAll('button[title^="اقرأ ظهر البطاقة"]')[${k}].click(); return true;`);
    passportRead = await until(async () => (await page.text()).includes('جواز السفر (MRZ) — قُرئ وتحقّقت أرقامه'), 60000);
    if (!passportRead) await page.key('Escape');
  }
  ok('«اقرأ ظهر البطاقة أو صفحة الجواز»: «جواز السفر (MRZ)» وتحقّقت أرقامه', passportRead);
  const ptext = await page.text();
  ok('رقم الجواز والجنسية والاسم اللاتيني والنفاذ', ptext.includes('رقم الجواز') && ptext.includes('A12345678') && ptext.includes('IRQ') && ptext.includes('ZAINAB ALI HASSAN') && ptext.includes('2031-02-20'));
  if (shotsDir) await page.shot(join(shotsDir, 'mrz-passport.png'));
  await page.eval(`document.querySelector('[data-act="mrz-fill"]').click(); return true;`);
  await wait(600);
  await page.clickText('حفظ الملف');
  await wait(900);
  const after = await page.eval(`
    const list = await window.diwan.citizens.list({ query: 'سمير خالد' });
    const c = await window.diwan.citizens.get(list.items?.[0]?.id ?? list[0]?.id);
    return { passportNo: c.passportNo, latinName: c.latinName, gender: c.gender, nationalId: c.nationalId };
  `);
  ok(`ويملأ رقم الجواز، وما في الملفّ لا يُكتب فوقه: ${JSON.stringify(after)}`, after.passportNo === 'A12345678' && after.latinName === 'SAMIR KHALID' && after.gender === 'ذكر' && after.nationalId === '199012345678');

  return steps.join('\n');
}
