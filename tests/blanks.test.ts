import { describe, expect, it } from 'vitest';
import {
  APPLY_THRESHOLD,
  buildBody,
  cleanLine,
  collapseEmpties,
  detectBlanks,
  EMPTY_LINE_PX,
  fixZeroPeriods,
  groupDuplicates,
  keyFromLabel,
  paragraphFromLine,
  similarity,
  splitForms,
  stripTatweel,
  suggestFieldName,
  suggestJoins
} from '../src/main/services/blanks';

describe('التمديد', () => {
  it('يُحذف فتُوجد الكلمة — «انـــــــــذار» كلمتها «انذار»', () => {
    expect(stripTatweel('انـــــــــذار')).toBe('انذار');
    expect(stripTatweel('للبنيـــــــن')).toBe('للبنين');
  });

  it('ولا يمسّ نصًّا سليمًا', () => {
    expect(stripTatweel('جمهورية العراق')).toBe('جمهورية العراق');
  });
});

describe('«0» مكان النقطة', () => {
  it('الملتصق بآخر كلمة عربية يُصحَّح بثقة', () => {
    const [fix] = fixZeroPeriods('وانذاره0  راجين');
    expect(fix!.value).toBe('وانذاره.  راجين');
    expect(fix!.confidence).toBeGreaterThanOrEqual(APPLY_THRESHOLD);
  });

  it('والمنفرد في آخر السطر كذلك', () => {
    const [fix] = fixZeroPeriods('على الدوام 0');
    expect(fix!.value).toBe('على الدوام .');
    expect(fix!.confidence).toBeGreaterThanOrEqual(APPLY_THRESHOLD);
  });

  it('ولا يُمسّ عددٌ حقيقي — وإلا أفسدنا رقمًا في كتاب رسمي', () => {
    expect(fixZeroPeriods('المبلغ 500 دينار')).toEqual([]);
    expect(fixZeroPeriods('رقم 1024')).toEqual([]);
    expect(fixZeroPeriods('Ref 0')).toEqual([]);
  });

  it('والصفر وسط الكلام يُقترح ولا يُطبَّق — دون العتبة', () => {
    const [fix] = fixZeroPeriods('قرار 0 والحمد لله');
    expect(fix!.value).toBe('قرار . والحمد لله');
    expect(fix!.confidence).toBeLessThan(APPLY_THRESHOLD);
  });
});

describe('تنظيف السطر', () => {
  it('يجمع التمديد والصفر وضغط المسافات، ويقول ما فعل', () => {
    const done = cleanLine('المواظبة وانذاره0   راجين الالتـــزام');
    expect(done.text).toBe('المواظبة وانذاره. راجين الالتزام');
    expect(done.notes).toContain('حُذف التمديد');
    expect(done.notes.some((n) => n.includes('«0»'))).toBe(true);
  });

  it('ولا يقول شيئًا عن سطر سليم', () => {
    expect(cleanLine('مع التقدير').notes).toEqual([]);
  });
});

describe('كشف الفراغات بأشكالها الأربعة', () => {
  it('القوس والنقاط والخط والتاريخ', () => {
    const kinds = (s: string) => detectBlanks(s).map((b) => b.kind);
    expect(kinds('الاسم ( )')).toEqual(['paren']);
    expect(kinds('الاسم ........')).toEqual(['dots']);
    expect(kinds('الاسم _____')).toEqual(['underline']);
    expect(kinds('التاريخ:    /    /     20')).toEqual(['date']);
  });

  it('عرض الفراغ من طول ما كتبه الموظف — فلا ينكمش على الورق', () => {
    const short = detectBlanks('أ ......')[0]!;
    const long = detectBlanks('أ ' + '.'.repeat(40))[0]!;
    expect(long.width).toBeGreaterThan(short.width);
    expect(long.width).toBe(40);
  });

  it('لا يرى تاريخًا في «الى / جهة» — شرطةٌ واحدة ليست تاريخًا', () => {
    expect(detectBlanks('الى / ولي امر التلميذ')).toEqual([]);
    expect(detectBlanks('م/ انذار')).toEqual([]);
  });

  it('ولا يعدّ نقطتين أو ثلاثة أحرف فراغًا', () => {
    expect(detectBlanks('انتهى.. والسلام')).toEqual([]);
  });

  it('يرتّبها ويُسقط المتداخل', () => {
    const found = detectBlanks('أ ..... ب ( ) ج ______');
    expect(found.map((b) => b.kind)).toEqual(['dots', 'paren', 'underline']);
    expect(found[0]!.start).toBeLessThan(found[1]!.start);
  });
});

describe('اسم الحقل يُستنتج مما قبله', () => {
  const name = (before: string) => suggestFieldName(before).value;

  it('النقطتان لا تحتملان غير ما قبلهما', () => {
    const s = suggestFieldName('الاسم: ');
    expect(s.value).toBe('الاسم');
    expect(s.confidence).toBeGreaterThan(0.9);
  });

  it('«الوثيقة المرقمة ( )» ← رقم الوثيقة', () => {
    expect(name('استنادًا إلى الوثيقة المرقمة ')).toBe('رقم الوثيقة');
  });

  it('«للتلميذ ( )» ← اسم التلميذ', () => {
    expect(name('الى / ولي امر التلميذ ')).toBe('اسم التلميذ');
    expect(name('يشهد بأن الطالب ')).toBe('اسم الطالب');
  });

  it('«في الصف ....» ← الصف، والكلمة تبقى كما كُتبت', () => {
    expect(name('غيابات التلميذ ..... في الصف ')).toBe('الصف');
  });

  it('وما لا قاعدة له يأخذ آخر كلمة بثقة منخفضة', () => {
    const s = suggestFieldName('لذا تقرر نقص ');
    expect(s.value).toBe('نقص');
    expect(s.confidence).toBeLessThan(APPLY_THRESHOLD);
  });

  it('ولكل اقتراح سببٌ يُعرض للموظف', () => {
    expect(suggestFieldName('الاسم: ').reason).toMatch(/\S/);
    expect(suggestFieldName('').confidence).toBeLessThan(0.5);
  });

  it('المفتاح يُشتقّ من العنوان بلا مسافات ولا أقواس', () => {
    expect(keyFromLabel('اسم التلميذ')).toBe('اسم_التلميذ');
    expect(keyFromLabel('  {رقم الوثيقة}  ')).toBe('رقم_الوثيقة');
  });
});

describe('الفقرة بحقولها', () => {
  it('النصّ أجزاءً والفراغ عقدةَ حقل', () => {
    const { block, fields } = paragraphFromLine('الى / ولي امر التلميذ .........', new Map());

    expect(block.inlines.map((i) => i.kind)).toEqual(['run', 'field']);
    expect(fields).toHaveLength(1);
    expect(fields[0]!.field.label).toBe('اسم التلميذ');
    expect(fields[0]!.field.fillMode).toBe('hand');
  });

  it('المفتاح المكرَّر يُميَّز — ومفتاحان متشابهان يفسدان الحقن', () => {
    const seen = new Map<string, number>();
    const a = paragraphFromLine('التلميذ ......', seen);
    const b = paragraphFromLine('التلميذ ......', seen);

    expect(a.fields[0]!.field.key).toBe('اسم_التلميذ');
    expect(b.fields[0]!.field.key).toBe('اسم_التلميذ_2');
  });

  it('سطرٌ بلا فراغ يبقى نصًّا', () => {
    const { block, fields } = paragraphFromLine('مع التقدير', new Map());
    expect(fields).toEqual([]);
    expect(block.inlines).toHaveLength(1);
  });
});

describe('الفقرات الفارغة', () => {
  it('المتتالية تصير مسافة، والمنفردة تبقى سطرًا', () => {
    expect(collapseEmpties(['أ', '', 'ب', '', '', '', 'ج'])).toEqual([
      { kind: 'text', text: 'أ' },
      { kind: 'text', text: '' },
      { kind: 'text', text: 'ب' },
      { kind: 'spacer', lines: 3 },
      { kind: 'text', text: 'ج' }
    ]);
  });

  it('وارتفاع المسافة بعدد ما طُوي', () => {
    const built = buildBody(['أ', '', '', '', 'ب']);
    const spacer = built.blocks.find((b) => b.kind === 'spacer');
    expect(spacer).toMatchObject({ height: 3 * EMPTY_LINE_PX });
  });
});

describe('الجملة المقطوعة على فقرات', () => {
  it('تُقترح ولا تُوصل آليًّا — قد تكون فقرتين مقصودتين', () => {
    const lines = [
      'ووصول عدد غياباته لذا تقرر نقص درجة من درجات المواظبة الشهرية له',
      '',
      'وانذاره راجين الالتزام'
    ];
    const [join] = suggestJoins(lines);
    expect(join!.value).toEqual([0, 2]);
    expect(join!.confidence).toBeLessThan(APPLY_THRESHOLD);
  });

  it('ولا تُقترح لسطر انتهى بعلامة، ولا لسطر قصير', () => {
    expect(suggestJoins(['سطرٌ طويل جدًّا انتهى بنقطة وفيه كلام كثير يكفي للطول.', '', 'تالٍ'])).toEqual([]);
    expect(suggestJoins(['قصير', '', 'تالٍ'])).toEqual([]);
  });

  it('ولا تُقترح إذا كان التالي بداية متن', () => {
    const lines = ['سطرٌ طويل بلا علامة في آخره وفيه من الكلام ما يكفي', '', 'إلى / وزارة التربية'];
    expect(suggestJoins(lines)).toEqual([]);
  });
});

describe('الملف الواحد مكتبة', () => {
  it('تكرار الترويسة حدٌّ بين استمارة وأخرى', () => {
    const lines = [
      'مدرسة الصحوة',
      'استمارة أولى',
      '',
      'مدرسة الصحوة',
      'استمارة ثانية',
      'مدرسة الصحوة',
      'استمارة ثالثة'
    ];
    expect(splitForms(lines, 'مدرسة الصحوة')).toEqual([
      [0, 3],
      [3, 5],
      [5, 7]
    ]);
  });

  it('وبلا تكرار يبقى الملف استمارةً واحدة', () => {
    expect(splitForms(['أ', 'ب'], 'مدرسة الصحوة')).toEqual([[0, 2]]);
    expect(splitForms(['أ', 'ب'], '')).toEqual([[0, 2]]);
  });

  it('والمدّ لا يمنع المطابقة', () => {
    expect(splitForms(['مدرســـة الصحوة', 'أ', 'مدرسة الصحوة', 'ب'], 'مدرسة الصحوة')).toHaveLength(2);
  });
});

describe('كشف المكرّر', () => {
  const A = 'نؤيد لكم أن السيد المذكور أدناه موظف لدينا ومستمر بالخدمة حتى تاريخه';
  const B = 'نؤيد لكم أن السيد المذكور أدناه موظف لدينا ومستمر بالخدمة حتى تاريخه.';
  const C = 'يرجى التفضل بالموافقة على منح الإجازة الدراسية للموظف المذكور أعلاه';

  it('النسخ المتشابهة تتجمّع — فالمئات ثلاثون نُسخت عشر مرّات', () => {
    const groups = groupDuplicates([
      { id: 'تأييد.doc', text: A },
      { id: 'تأييد2.doc', text: B },
      { id: 'إجازة.doc', text: C }
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.ids).toEqual(['تأييد.doc', 'تأييد2.doc']);
    expect(groups[0]!.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('والفراغات لا تفرّق بين نسختين — الفرق في المنطوق', () => {
    expect(similarity(`${A} ( )`, `${A} ......`)).toBe(1);
  });

  it('وما لا يتشابه لا يُجمع', () => {
    expect(similarity(A, C)).toBeLessThan(0.3);
    expect(groupDuplicates([{ id: 'a', text: A }, { id: 'c', text: C }])).toEqual([]);
  });
});
