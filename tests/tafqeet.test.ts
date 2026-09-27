import { describe, expect, it } from 'vitest';
import { amountWordsField, countWords, derivedWords, isAmountField, parseAmount, tafqeet, wordsForField } from '../src/shared/tafqeet';

describe('محرك التفقيط المالي بالدينار العراقي (Arabic Tafqeet)', () => {
  it('يفقط المبالغ اليومية الشائعة بالدينار العراقي بدقة فصيحة', () => {
    // 500,000 دينار
    expect(tafqeet(500000)).toBe('فقط خمسمئة ألف دينار عراقي لا غير');

    // 25,000 دينار
    expect(tafqeet(25000)).toBe('فقط خمسة وعشرون ألف دينار عراقي لا غير');

    // 15,250,000 دينار
    expect(tafqeet(15250000)).toBe(
      'فقط خمسة عشر مليونًا ومئتان وخمسون ألف دينار عراقي لا غير'
    );

    // 1,000,000 دينار
    expect(tafqeet(1000000)).toBe('فقط مليون دينار عراقي لا غير');
  });

  it('يدعم الأرقام الهندية المشرقية والفواصل', () => {
    expect(tafqeet('١٥,٠٠٠')).toBe('فقط خمسة عشر ألف دينار عراقي لا غير');
  });

  it('يدعم الدولار الأمريكي', () => {
    expect(tafqeet(3500, { currency: 'USD' })).toBe(
      // بعد المئة المعدودُ مفردٌ مجرور: «خمسمئة دولار» لا «دولارًا».
      'فقط ثلاثة آلاف وخمسمئة دولار أمريكي لا غير'
    );
  });

  it('يدعم التفقيط البحت بدون عملة أو بدون بادئة', () => {
    expect(tafqeet(100, { currency: 'NONE', prefix: false, suffix: false })).toBe('مئة');
  });

  it('يدعم المبالغ الصغيرة والمليارات والعملات المختلفة', () => {
    expect(tafqeet(1)).toBe('فقط دينار عراقي واحد لا غير');
    expect(tafqeet(2)).toBe('فقط ديناران عراقيان لا غير');
    expect(tafqeet(5)).toBe('فقط خمسة دنانير عراقية لا غير');
    expect(tafqeet(10)).toBe('فقط عشرة دنانير عراقية لا غير');
    expect(tafqeet(1000)).toBe('فقط ألف دينار عراقي لا غير');
    // المثنّى مضافًا يفقد نونه.
    expect(tafqeet(2000)).toBe('فقط ألفا دينار عراقي لا غير');
    expect(tafqeet(10000)).toBe('فقط عشرة آلاف دينار عراقي لا غير');
    expect(tafqeet(1000000000)).toBe('فقط مليار دينار عراقي لا غير');
  });

  it('التمييز بآخر رقمين: جمعٌ لـ٣–١٠، ومنصوبٌ لـ١١–٩٩، ومجرورٌ بعد المئة', () => {
    expect(tafqeet(11)).toBe('فقط أحد عشر دينارًا عراقيًا لا غير');
    expect(tafqeet(250)).toBe('فقط مئتان وخمسون دينارًا عراقيًا لا غير');
    expect(tafqeet(103)).toBe('فقط مئة وثلاثة دنانير عراقية لا غير');
    expect(tafqeet(2500)).toBe('فقط ألفان وخمسمئة دينار عراقي لا غير');
    expect(tafqeet(2_000_000)).toBe('فقط مليونا دينار عراقي لا غير');
    expect(tafqeet(500_250)).toBe('فقط خمسمئة ألف ومئتان وخمسون دينارًا عراقيًا لا غير');
  });

  it('والكسر لا يُسقط صامتًا: الدينار ألف فلس', () => {
    expect(tafqeet('250.5')).toBe('فقط مئتان وخمسون دينارًا عراقيًا وخمسمئة فلس لا غير');
    expect(tafqeet('0.25')).toBe('فقط مئتان وخمسون فلسًا لا غير');
  });

  it('وما ليس مبلغًا لا يُفقَّط: التاريخ والهاتف', () => {
    expect(parseAmount('2026/01/15')).toBeNull();
    expect(parseAmount('07701234567')).toBeNull();
    expect(parseAmount('١٥,٠٠٠')).toBe(15000);
    expect(parseAmount('1.500.000')).toBe(1500000);
    expect(tafqeet('2026/01/15')).toBe('');
  });
});

describe('حقل المبلغ وحقل كتابته', () => {
  const f = (id: string, token: string, label = token) => ({ id, token, label });
  const fields = [
    f('1', 'بدل_الإيجار_الشهري_رقما'),
    f('2', 'بدل_الإيجار_كتابة'),
    f('3', 'مبلغ_الدين_رقما'),
    f('4', 'مبلغ_الدين_كتابة'),
    f('5', 'الرقم_الوطني'),
    f('6', 'التاريخ')
  ];

  it('كلُّ مبلغٍ يُكتب في حقله هو — لا في أوّل حقلٍ فيه «كتابة»', () => {
    expect(amountWordsField(fields[0]!, fields)?.id).toBe('2');
    expect(amountWordsField(fields[2]!, fields)?.id).toBe('4');
  });

  it('والرقم الوطني والتاريخ ليسا مبلغين', () => {
    expect(isAmountField(fields[4]!, fields)).toBe(false);
    expect(isAmountField(fields[5]!, fields)).toBe(false);
    expect(isAmountField(fields[0]!, fields)).toBe(true);
  });
});

describe('الدرجات والمدد: العدد يخالف معدوده المؤنّث', () => {
  it('الدرجة مؤنّثة: ثلاث درجات، وإحدى عشرة، وخمس وتسعون', () => {
    expect(countWords(95, 'درجة')).toBe('خمس وتسعون درجة');
    expect(countWords(3, 'درجة')).toBe('ثلاث درجات');
    expect(countWords(11, 'درجة')).toBe('إحدى عشرة درجة');
    expect(countWords(12, 'درجة')).toBe('اثنتا عشرة درجة');
    expect(countWords(21, 'درجة')).toBe('إحدى وعشرون درجة');
    expect(countWords(100, 'درجة')).toBe('مئة درجة');
    expect(countWords(1, 'درجة')).toBe('درجة واحدة');
    expect(countWords('87.5', 'درجة')).toBe('سبع وثمانون درجة ونصف');
  });

  it('واليوم مذكّر: يومان، وخمسة أيام، وخمسة عشر يومًا', () => {
    expect(countWords(2, 'يوم')).toBe('يومان');
    expect(countWords(5, 'يوم')).toBe('خمسة أيام');
    expect(countWords(15, 'يوم')).toBe('خمسة عشر يومًا');
    expect(countWords(3, 'سنة')).toBe('ثلاث سنوات');
  });

  it('والكسر غير المعروف لا يُقرَّب صامتًا', () => {
    expect(countWords('87.3', 'درجة')).toBe('');
  });

  it('حقول الكتابة تُملأ من أرقامها — ولا يُمسّ ما كُتب باليد', () => {
    const keys = ['الدرجة', 'الدرجة_كتابة', 'مدة_الإجازة', 'مدة_الإجازة_كتابة', 'المبلغ', 'المبلغ_كتابة'];
    const out = derivedWords({ الدرجة: '95', مدة_الإجازة: '15', المبلغ: '2000', المبلغ_كتابة: 'كتبتها بيدي' }, keys);
    expect(out['الدرجة_كتابة']).toBe('خمس وتسعون درجة');
    expect(out['مدة_الإجازة_كتابة']).toBe('خمسة عشر يومًا');
    expect(out['المبلغ_كتابة']).toBe('كتبتها بيدي');
  });
});

describe('كلمات الحقل بوحدته', () => {
  it('الدرجة لا تُفقَّط دنانير', () => {
    const fields = [
      { id: '1', token: 'الدرجة', label: 'الدرجة', value: '95' },
      { id: '2', token: 'الدرجة_كتابة', label: 'الدرجة كتابة', value: '' },
      { id: '3', token: 'المبلغ', label: 'المبلغ', value: '2000' }
    ];
    expect(wordsForField(fields[0]!, fields)).toBe('خمس وتسعون درجة');
    expect(wordsForField(fields[2]!, fields)).toBe('فقط ألفا دينار عراقي لا غير');
  });
});
