/**
 * استيراد الزبائن من Excel (الموجة ٢، «كلفة الانتقال»): الأعمدة تُعرف من عناوينها، والاسم والعنوان
 * المفرّقان يُجمعان، والجديد يُضاف والموجود يُكمل فارغه — ولا يُكتب فوق ما كتبه المكتب، ولا يتكرّر ملف.
 */
import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import { ensureSearchColumn, getCitizen, listCitizens, saveCitizen } from '../src/main/services/citizens';
import { importCitizens, planCitizenImport, readImportMap, saveImportMap } from '../src/main/services/citizenImport';
import { autoTarget, cleanMap, cleanRows, importRows, mapOf, readTable, withTarget } from '../src/shared/citizenImport';
import { auditLabel } from '../src/shared/auditLabels';
import type { CitizenInput } from '../src/shared/api';

const tsv = (rows: string[][]) => rows.map((r) => r.join('\t')).join('\n');

/** قائمةٌ كما تُرسلها دائرة: الاسم مفرّقًا، والعنوان مفرّقًا، وعمود تسلسلٍ وعمودٌ لا خانة له. */
const LIST = tsv([
  ['ت', 'الاسم', 'اسم الأب', 'اسم الجد', 'اللقب', 'رقم الهوية', 'الموبايل', 'التولد', 'المحلة', 'الزقاق', 'الدار', 'الصف'],
  ['1', 'علي', 'حسين', 'كاظم', 'الربيعي', '199912345678', '07701234567', '1999/03/01', '612', '14', '7', 'الثالث'],
  ['2', 'زينب', 'محمد', 'جاسم', '', '200011112222', '0780 111 2222', '2000', '305', '9', '11', 'الثالث'],
  ['3', 'حسن', 'علي', 'عباس', 'التميمي', '١٩٩٨٣٣٣٣٤٤٤٤', '', '', '', '', '', 'الرابع']
]);

const person = (fullName: string, patch: Partial<CitizenInput> = {}): CitizenInput =>
  ({ id: null, fullName, nationalId: null, verified: false, ...patch }) as CitizenInput;

function db() {
  const d = freshDb();
  ensureSearchColumn(d);
  return d;
}

describe('الأعمدة تُعرف من عناوينها', () => {
  it('الاسم المفرّق واللقب والهوية والهاتف والتولد والعنوان — والتسلسل وما لا خانة له يُتركان', () => {
    const t = readTable(LIST);
    expect(t.headed).toBe(true);
    expect(t.columns.map((c) => c.target)).toEqual([
      null,
      'fullName',
      'fullName',
      'fullName',
      'surname',
      'nationalId',
      'phone',
      'birthDate',
      'address',
      'address',
      'address',
      null
    ]);
    expect(t.rows).toHaveLength(3);
  });

  it('والصفّ يُجمع: الاسم الرباعي باللقب، والعنوان بأسماء أجزائه كما في خانة الملف', () => {
    const [ali, zainab, hassan] = importRows(readTable(LIST));
    expect(ali).toMatchObject({
      fullName: 'علي حسين كاظم الربيعي',
      surname: 'الربيعي',
      nationalId: '199912345678',
      phone: '07701234567',
      birthDate: '1999/03/01',
      address: 'محلة 612 زقاق 14 دار 7'
    });
    // بلا لقبٍ يبقى الاسم كما هو، والأعمدة الفارغة لا تُكتب.
    expect(zainab!.fullName).toBe('زينب محمد جاسم');
    expect(zainab!.surname).toBeUndefined();
    expect(hassan!.address).toBeUndefined();
  });

  it('«رقم الهوية» يُعرف من قيمه: ١٢ رقمًا للموحّدة، وغيرها لهوية الأحوال', () => {
    expect(autoTarget('رقم الهوية', ['199912345678', '200011112222'])).toBe('nationalId');
    expect(autoTarget('رقم الهوية', ['A1234567', '889911'])).toBe('civilIdNo');
    expect(autoTarget('رقم هوية الأحوال', ['199912345678'])).toBe('civilIdNo');
  });

  it('و«اسم المدرسة» مكان عمل لا اسم، و«اسم الأم» ليس الاسم، و«الرقم» بقيمٍ ١، ٢، ٣ تسلسل', () => {
    expect(autoTarget('اسم المدرسة')).toBe('workplace');
    expect(autoTarget('اسم الأم')).toBe('motherName');
    expect(autoTarget('الرقم', ['1', '2', '3'])).toBeNull();
    expect(autoTarget('الرقم', ['E-4410', 'E-4411'])).toBe('employeeCode');
    expect(autoTarget('التصنيف')).toBe('category');
    expect(autoTarget('ملاحظات المكتب')).toBe('notes');
  });

  it('والجنس بصيغة الملف — وما لا يُعرف يبقى كما كُتب', () => {
    const t = readTable(tsv([['الاسم', 'الجنس'], ['سارة علي', 'انثى'], ['عمر خالد', 'M'], ['نور حسن', 'غير مذكور']]));
    expect(importRows(t).map((r) => r.gender)).toEqual(['أنثى', 'ذكر', 'غير مذكور']);
  });

  it('وملفٌّ بلا عناوين: أعمدةٌ بأرقامها يربطها الموظف — ولا يُتذكّر ربطه', () => {
    let t = readTable(tsv([['أحمد كريم', '07711112222'], ['سعاد حسن', '07722223333']]));
    expect(t.headed).toBe(false);
    expect(t.columns.map((c) => c.header)).toEqual(['العمود 1', 'العمود 2']);
    expect(t.columns.every((c) => c.target === null)).toBe(true);
    t = withTarget(withTarget(t, 0, 'fullName'), 1, 'phone');
    expect(importRows(t)).toEqual([
      { fullName: 'أحمد كريم', phone: '07711112222' },
      { fullName: 'سعاد حسن', phone: '07722223333' }
    ]);
    expect(mapOf(t)).toEqual({});
  });

  it('والربط المحفوظ يغلب المعجم — و«اتركه» محفوظٌ أيضًا', () => {
    const first = withTarget(withTarget(readTable(LIST), 11, 'category'), 6, null);
    const saved = mapOf(first);
    const again = readTable(LIST, saved);
    expect(again.columns[11]).toMatchObject({ target: 'category', manual: true });
    expect(again.columns[6]).toMatchObject({ target: null, manual: true });
    expect(importRows(again)[0]).toMatchObject({ category: 'الثالث' });
    expect(importRows(again)[0]!.phone).toBeUndefined();
  });

  it('وما يصل عبر الجسر يُنقّى: خاناتٌ معروفة بقيمٍ نصّية وحدها', () => {
    expect(cleanRows([{ fullName: ' علي ', phone: 7, hacker: 'x', category: '' }, null])).toEqual([{ fullName: 'علي' }, {}]);
    expect(cleanRows('not rows')).toEqual([]);
    expect(cleanMap({ 'الاسم': 'fullName', 'x': 'drop table', 'الصف': null })).toEqual({ 'الاسم': 'fullName', 'الصف': null });
  });
});

describe('الاستيراد على السجلّ', () => {
  it('الجديد يُضاف بخاناته، ويُوجد بالبحث، ويُقيَّد في سجلّ الأحداث', () => {
    const d = db();
    const report = importCitizens(d, importRows(readTable(LIST)), { fileName: 'قائمة التربية.xlsx' });
    expect(report).toMatchObject({ added: 3, completed: 0, similar: 0, noName: 0, repeated: 0, unusualIds: 0 });
    const ali = listCitizens(d, { query: 'الربيعي' })[0]!;
    expect(getCitizen(d, ali.id)).toMatchObject({ fullName: 'علي حسين كاظم الربيعي', surname: 'الربيعي', phone: '07701234567' });
    // الهندية تُوحَّد كما في الحفظ اليدوي.
    expect(listCitizens(d, { query: 'التميمي' })[0]!.nationalId).toBe('199833334444');
    const audit = d.prepare("SELECT entity, action, detail FROM audit_log WHERE entity = 'citizen'").get() as { entity: string; action: string; detail: string };
    expect(auditLabel(audit)).toBe('استُورد زبائن من Excel — قائمة التربية.xlsx: أُضيف 3، وأُكمل 0');
  });

  it('ومرّةً ثانية لا يتكرّر أحد — ومن نقص ملفّه يُكمل فارغه ولا يُكتب فوق ما فيه', () => {
    const d = db();
    const zainab = saveCitizen(d, person('زينب محمد جاسم', { nationalId: '200011112222', phone: '07999999999', workplace: 'مديرية التربية' }));
    importCitizens(d, importRows(readTable(LIST)));
    const report = importCitizens(d, importRows(readTable(LIST)));
    expect(report).toMatchObject({ added: 0, completed: 0, unchanged: 3 });
    expect(listCitizens(d)).toHaveLength(3);
    const after = getCitizen(d, zainab.id)!;
    // الهاتف الذي كتبه المكتب يبقى، والعنوان والتولد الفارغان يُكملان — والرقم الوطني باقٍ
    // (كان الإكمال يمحوه: `saveCitizen` يكتبه دائمًا ولو غاب عن الطلب).
    expect(after).toMatchObject({
      nationalId: '200011112222',
      phone: '07999999999',
      workplace: 'مديرية التربية',
      birthDate: '2000',
      address: 'محلة 305 زقاق 9 دار 11'
    });
  });

  it('والموجود بلا رقمٍ وطنيٍّ يُعرف بالاسم والهاتف معًا — فيُكمل ويأخذ رقمه', () => {
    const d = db();
    const ali = saveCitizen(d, person('علي حسين كاظم الربيعي', { phone: '0770 123 4567' }));
    const report = importCitizens(d, importRows(readTable(LIST)));
    expect(report).toMatchObject({ added: 2, completed: 1 });
    expect(getCitizen(d, ali.id)!.nationalId).toBe('199912345678');
  });

  it('والاسم نفسه بلا ما يفرّق يُترك ويُسمّى — إلا إن اختار المكتب إضافته', () => {
    const d = db();
    saveCitizen(d, person('سعاد حسن علي'));
    const rows = [{ fullName: 'سعاد حسن علي', address: 'البياع' }, { fullName: 'جديد تماما' }];
    expect(planCitizenImport(d, rows).report).toMatchObject({ added: 1, similar: 1, similarNames: ['سعاد حسن علي'] });
    expect(importCitizens(d, rows, { addSimilar: true })).toMatchObject({ added: 2, similar: 0 });
    expect(listCitizens(d, { query: 'سعاد' })).toHaveLength(2);
  });

  it('ورقمان وطنيّان مختلفان باسمٍ واحد شخصان — يُضاف ولا يُترك', () => {
    const d = db();
    saveCitizen(d, person('محمد علي حسن', { nationalId: '199011112222' }));
    expect(planCitizenImport(d, [{ fullName: 'محمد علي حسن', nationalId: '199533334444' }]).report).toMatchObject({ added: 1, similar: 0 });
  });

  it('والمكرّر في الملف نفسه يُدمج في أوّله، والاسم المتكرّر بلا رقمٍ ولا هاتف لا يُدمج', () => {
    const d = db();
    const report = importCitizens(d, [
      { fullName: 'كريم جاسم', nationalId: '199812121212' },
      { fullName: 'كريم جاسم محمد', nationalId: '199812121212', phone: '07701112233' },
      { fullName: 'طالب بلا رقم' },
      { fullName: 'طالب بلا رقم' },
      { phone: '07700000000' }
    ]);
    expect(report).toMatchObject({ added: 3, repeated: 1, noName: 1 });
    expect(listCitizens(d, { query: 'كريم' })[0]).toMatchObject({ fullName: 'كريم جاسم' });
    expect(getCitizen(d, listCitizens(d, { query: 'كريم' })[0]!.id)!.phone).toBe('07701112233');
  });

  it('والتصنيف للجميع لا يغيّر تصنيف ملفٍّ موجود، والرقم غير المعتاد يُحفظ كما كُتب ويُعدّ', () => {
    const d = db();
    const old = saveCitizen(d, person('ليلى كاظم', { nationalId: '198700000001', category: 'قديم' }));
    const report = importCitizens(d, [{ fullName: 'ليلى كاظم', nationalId: '198700000001', phone: '07801234567' }, { fullName: 'هدى سالم', nationalId: '12345' }], {
      category: 'موظفو التربية'
    });
    expect(report).toMatchObject({ added: 1, completed: 1, unusualIds: 1 });
    expect(getCitizen(d, old.id)!.category).toBe('قديم');
    expect(listCitizens(d, { query: 'هدى' })[0]).toMatchObject({ category: 'موظفو التربية', nationalId: '12345' });
  });

  it('والملف الأكبر من حدّه يُرفض بسببه — والاستيراد كلّه أو لا شيء', () => {
    const d = db();
    const big = Array.from({ length: 10001 }, (_, i) => ({ fullName: `زبون ${i}` }));
    expect(() => importCitizens(d, big)).toThrow(/قسّمه/);
    expect(listCitizens(d)).toHaveLength(0);
  });

  it('والربط يُحفظ ويُضاف إليه، وما فسد منه يُترك', () => {
    const d = db();
    expect(readImportMap(d)).toEqual({});
    saveImportMap(d, { 'الاسم': 'fullName', 'الصف': null });
    saveImportMap(d, { 'الموبايل': 'phone', 'سيء': 'not-a-field' });
    expect(readImportMap(d)).toEqual({ 'الاسم': 'fullName', 'الصف': null, 'الموبايل': 'phone' });
  });
});
