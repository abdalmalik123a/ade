/**
 * سيناريو: معاملةٌ معلّقة لزبونٍ حُذف، وأخطاء القاعدة بالعربية (مراجعة ٧ ت١).
 *
 * كان الاستئناف يعيد `citizenId` القديم فيفشل قيد الكتاب بـ«FOREIGN KEY constraint failed» إنكليزيةً خامًا. فالآن
 * يُتحقَّق من وجود الزبون عند الاستئناف: غاب فلا تُربط به، ويُقال ذلك. وما تسرّب من خطأ القاعدة نفسه يصل الواجهة
 * عربيًّا من حدّ القنوات (`ipc/errors.ts`).
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SEED = `
  const run = (text) => ({ kind: 'run', text });
  const ref = (key) => ({ kind: 'field', id: key, ref: key });
  await window.diwan.templates.save({
    id: null, code: null, title: 'تأييد دوام', subtitle: null, category: null, subjectLine: null,
    letterheadId: null, bodyHtml: 'نؤيد أن {الاسم} مستمر بالدوام.', variables: [],
    doc: {
      id: 'gone-doc', schemaVersion: 1, kind: 'flow', issuing: 'registered',
      blocks: [{ id: 'b1', kind: 'paragraph', align: 'right', inlines: [run('نؤيد أن '), ref('الاسم'), run(' مستمر بالدوام.')] }],
      fields: [{ id: 'f-name', key: 'الاسم', label: 'الاسم', type: 'text', required: true, width: 14, fillMode: 'printed', role: 'name', source: 'fullName' }],
      meta: {}
    }
  });
  return true;
`;

const SHEET = (citizenId) => `{ sheetHtml: '<div class="a4-sheet"><p>نؤيد</p></div>', templateId: null, citizenId: ${citizenId}, authorityId: null, citizenName: 'أحمد',
  nationalId: null, docType: 'تأييد', destination: null, purpose: null, values: {}, copies: 1, copyKind: null, fee: 0,
  gregorianDate: '', hijriDate: null, operator: null, printer: null, serialPrefix: 'م', serialYear: 2026, letterheadId: null }`;

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);

  await page.eval(SEED);

  // ── خطأ قاعدةٍ يصل الواجهة بالعربية ──────────────────────────────────────
  const stale = await page.eval(
    `try { await window.diwan.documents.issue(${SHEET(999999)}, false); return 'ok'; } catch (e) { return String(e?.message ?? e); }`
  );
  ok(`كتابٌ لزبونٍ غير موجود: خطأ القاعدة بالعربية (${stale.slice(0, 60)}…)`, stale.includes('لم يعد موجودًا') && !/FOREIGN KEY|SqliteError/.test(stale));
  ok('ولم يُقيَّد شيءٌ في السجلّ', (await page.eval(`return (await window.diwan.documents.list({ limit: 10 })).length;`)) === 0);

  // ── معاملةٌ معلّقة لزبونٍ ثم حُذف الزبون ─────────────────────────────────
  const made = await page.eval(`
    const tid = (await window.diwan.templates.list()).find((t) => t.title === 'تأييد دوام').id;
    const cid = (await window.diwan.citizens.save({ id: null, fullName: 'زبون سيُحذف', verified: false })).id;
    await window.diwan.service.setParked([{
      key: Date.now(), label: 'معاملة زبونٍ حُذف', step: 'fill', picked: [tid], values: { 'الاسم': 'زبون سيُحذف' },
      letterNo: '', citizenId: cid, merge: false, names: '', valuesOnly: false, genderByHand: false
    }]);
    await window.diwan.citizens.delete(cid);
    return { cid, still: (await window.diwan.citizens.get(cid)) !== null };
  `);
  ok('الزبون حُذف والمعاملة معلّقةٌ باسمه', typeof made.cid === 'number' && made.still === false);

  await page.eval(`location.reload(); return true;`).catch(() => undefined);
  await sleep(3000);
  await page.goto('orders-board');
  await sleep(1300);
  await page.eval(
    `[...document.querySelectorAll('[data-column="customer"] [data-pending="resume-parked"]')].find((c) => c.innerText.includes('معاملة زبونٍ حُذف')).querySelector('[data-act="resume-parked"]').click(); return true;`
  );
  await sleep(1500);
  const text = await page.text();
  ok('«استأنف» تفتح الشبّاك على المعاملة', text.includes('زبون سيُحذف') || (await page.eval(`return Boolean(document.querySelector('[data-screen="service"]'));`)));
  ok('ويُقال إنّ الزبون لم يعد في السجلّ فلا تُربط به', text.includes('لم يعد في السجلّ فلا تُربط به'));
  ok('وتخرج من المعلّقات', (await page.eval(`return (await window.diwan.service.parked()).length;`)) === 0);

  // والمعاملة المستأنفة تُحفظ فعلًا — لا يفشل قيدها بمفتاحٍ لزبونٍ غائب.
  await page.clickText('راجع الأوراق');
  await sleep(1000);
  await page.clickText('احفظ بلا طباعة');
  await sleep(1800);
  const docs = await page.eval(`return (await window.diwan.documents.list({ limit: 10 })).map((d) => ({ name: d.citizenName, citizenId: d.citizenId ?? null }));`);
  ok(`ويُقيَّد كتابها في السجلّ بلا ربطٍ بالزبون المحذوف (${JSON.stringify(docs)})`, docs.length === 1 && docs[0].name === 'زبون سيُحذف' && docs[0].citizenId === null);
  return steps.join('\n');
}
