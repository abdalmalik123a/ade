/**
 * حقول صاحب العلاقة — قائمة يبنيها المكتب، لا حقول ثابتة في الكود.
 *
 * كل معاملة تطلب حقولًا غير التي تطلبها غيرها: كتاب التربية يسأل عن المدرسة
 * والملاك والدرجة، ومعاملة الأحوال المدنية تسأل عن اسم الأم ورقم السجل
 * والصحيفة، والجوازات تسأل عن رقم الجواز وجهة إصداره. ولذلك الحقول هنا
 * «كتالوج» يُختار منه ويُحذف منه، ويُضاف إليه حقل يسمّيه المكتب بنفسه.
 *
 * الكتالوج مبنيّ على الاستمارات الرسمية العراقية المنشورة (البطاقة الوطنية
 * الموحّدة، جواز السفر المقروء آليًا، بطاقة السكن، كتب الملاك التربوي) —
 * وهو اقتراح يُعرض على الموظف، لا محتوى يُفرض عليه.
 */

/** دور الحقل في السجل: ما يُقيَّد في الأرشيف ولا يجوز أن يبقى مجهولًا. */
export type FieldRole = 'name' | 'nationalId' | 'destination' | 'purpose' | null;

/** مصدر الملء التلقائي من ملف المواطن (F2). */
export type FieldSource =
  | 'fullName'
  | 'nationalId'
  | 'jobTitle'
  | 'workplace'
  | 'employeeCode'
  | 'serviceStatus'
  | 'birthDate'
  | 'birthPlace'
  | 'enrollmentDept'
  | 'address'
  | 'housingCardNo'
  | 'landmark'
  | 'phone'
  // خانات الاستمارات الحكومية في ملف المواطن (أيلول ٢٠٢٦).
  | 'surname'
  | 'motherName'
  | 'gender'
  | 'maritalStatus'
  | 'education'
  | 'governorate'
  | 'district'
  | 'familyNumber'
  | 'nidIssueDate'
  | 'civilRecord'
  | 'civilPage'
  | 'passportNo'
  | 'rationCardNo'
  | null;

export type CatalogField = {
  label: string;
  /** اسم المتغيّر في المتن: {الاسم} */
  token: string;
  source?: FieldSource;
  role?: FieldRole;
  /** إشارة إلى أن الحقل تاريخ — لتسهيل ختم تاريخ اليوم فيه. */
  date?: boolean;
};

export type LetterField = CatalogField & {
  id: string;
  value: string;
};

export type FieldGroup = { name: string; hint: string; fields: CatalogField[] };

/** الحقول التي لا يخلو منها كتاب — تُنشأ مع كل كتاب جديد. */
export const CORE_FIELDS: CatalogField[] = [
  { label: 'الاسم الرباعي واللقب', token: 'الاسم', source: 'fullName', role: 'name' },
  {
    label: 'الرقم الوطني / البطاقة الموحدة',
    token: 'الرقم_الوطني',
    source: 'nationalId',
    role: 'nationalId'
  },
  { label: 'الجهة الموجه إليها الكتاب', token: 'الجهة_الموجه_إليها', role: 'destination' },
  { label: 'الغرض من الكتاب', token: 'الغرض', role: 'purpose' }
];

export const FIELD_GROUPS: FieldGroup[] = [
  {
    name: 'الملاك والوظيفة',
    hint: 'كتب التأييد والاستمرار بالخدمة وبراءة الذمة',
    fields: [
      { label: 'العنوان الوظيفي', token: 'العنوان_الوظيفي', source: 'jobTitle' },
      { label: 'الحالة الوظيفية والخدمة', token: 'الحالة_الوظيفية', source: 'serviceStatus' },
      { label: 'مكان العمل / التشكيل', token: 'مكان_العمل', source: 'workplace' },
      { label: 'دائرة الانتساب', token: 'دائرة_الانتساب', source: 'enrollmentDept' },
      { label: 'الرقم الوظيفي / رمز الموظف', token: 'الرقم_الوظيفي', source: 'employeeCode' },
      { label: 'الدرجة والمرحلة', token: 'الدرجة_والمرحلة' },
      { label: 'تاريخ المباشرة', token: 'تاريخ_المباشرة', date: true },
      { label: 'مدة الخدمة', token: 'مدة_الخدمة' },
      { label: 'الشهادة والتخصص', token: 'الشهادة_والتخصص' },
      { label: 'التحصيل الدراسي', token: 'التحصيل_الدراسي', source: 'education' },
      { label: 'الراتب الاسمي', token: 'الراتب_الاسمي' }
    ]
  },
  {
    name: 'الأحوال المدنية والجنسية',
    hint: 'البطاقة الوطنية الموحّدة وشهادة الجنسية',
    fields: [
      { label: 'اسم الأم الثلاثي', token: 'اسم_الأم', source: 'motherName' },
      { label: 'اللقب', token: 'اللقب', source: 'surname' },
      { label: 'الجنس', token: 'الجنس', source: 'gender' },
      { label: 'الحالة الاجتماعية', token: 'الحالة_الاجتماعية', source: 'maritalStatus' },
      { label: 'تاريخ الولادة', token: 'تاريخ_الولادة', source: 'birthDate', date: true },
      { label: 'محل الولادة', token: 'محل_الولادة', source: 'birthPlace' },
      { label: 'الرقم العائلي', token: 'الرقم_العائلي', source: 'familyNumber' },
      { label: 'تاريخ إصدار البطاقة الوطنية', token: 'تاريخ_إصدار_البطاقة', source: 'nidIssueDate', date: true },
      { label: 'رقم السجل', token: 'رقم_السجل', source: 'civilRecord' },
      { label: 'رقم الصحيفة', token: 'رقم_الصحيفة', source: 'civilPage' },
      { label: 'مركز التسجيل / الدائرة المصدرة', token: 'مركز_التسجيل' },
      { label: 'رقم شهادة الجنسية', token: 'رقم_شهادة_الجنسية' },
      { label: 'المادة القانونية', token: 'المادة_القانونية' },
      { label: 'رقم البطاقة التموينية', token: 'رقم_البطاقة_التموينية', source: 'rationCardNo' }
    ]
  },
  {
    name: 'الجوازات والسفر',
    hint: 'كتب عدم الممانعة والموافقة على السفر',
    fields: [
      { label: 'رقم الجواز', token: 'رقم_الجواز', source: 'passportNo' },
      { label: 'نوع الجواز', token: 'نوع_الجواز' },
      { label: 'تاريخ إصدار الجواز', token: 'تاريخ_إصدار_الجواز', date: true },
      { label: 'تاريخ انتهاء الجواز', token: 'تاريخ_انتهاء_الجواز', date: true },
      { label: 'جهة الإصدار', token: 'جهة_إصدار_الجواز' },
      { label: 'الجهة المقصودة بالسفر', token: 'جهة_السفر' },
      { label: 'مدة السفر', token: 'مدة_السفر' }
    ]
  },
  {
    name: 'التربية والتعليم',
    hint: 'تأييدات الطلبة والدرجات والقيد',
    fields: [
      { label: 'المدرسة', token: 'المدرسة' },
      { label: 'الصف والشعبة', token: 'الصف_والشعبة' },
      { label: 'الفرع (علمي / أدبي)', token: 'الفرع' },
      { label: 'السنة الدراسية', token: 'السنة_الدراسية' },
      { label: 'الرقم الامتحاني', token: 'الرقم_الامتحاني' },
      { label: 'رقم القيد', token: 'رقم_القيد' },
      { label: 'الدور', token: 'الدور' },
      { label: 'المعدل', token: 'المعدل' }
    ]
  },
  {
    name: 'السكن والعنوان',
    hint: 'بطاقة السكن وتأييد السكن المعنون',
    fields: [
      { label: 'رقم بطاقة السكن', token: 'رقم_بطاقة_السكن', source: 'housingCardNo' },
      { label: 'المحلة والزقاق والدار', token: 'العنوان', source: 'address' },
      { label: 'أقرب نقطة دالة', token: 'أقرب_نقطة_دالة', source: 'landmark' },
      { label: 'رقم العقار', token: 'رقم_العقار' },
      { label: 'المحافظة', token: 'المحافظة', source: 'governorate' },
      { label: 'القضاء', token: 'القضاء', source: 'district' },
      { label: 'رقم الهاتف', token: 'رقم_الهاتف', source: 'phone' }
    ]
  },
  {
    name: 'المالية والمصارف',
    hint: 'السلف والحوالات وبراءة الذمة المالية',
    fields: [
      { label: 'المصرف والفرع', token: 'المصرف' },
      { label: 'رقم الحساب', token: 'رقم_الحساب' },
      { label: 'المبلغ', token: 'المبلغ' },
      { label: 'المبلغ كتابةً', token: 'المبلغ_كتابة' },
      { label: 'نوع السلفة', token: 'نوع_السلفة' }
    ]
  },
  {
    name: 'العقود والكمبيالات العرفية',
    hint: 'عقود الإيجار ومكاتبات السيارات والكمبيالات مع الكفيل',
    fields: [
      { label: 'بدل الإيجار الشهري (رقماً)', token: 'بدل_الإيجار_الشهري_رقما' },
      { label: 'بدل الإيجار (كتابة)', token: 'بدل_الإيجار_كتابة' },
      { label: 'مبلغ الدين (رقماً)', token: 'مبلغ_الدين_رقما' },
      { label: 'مبلغ الدين (كتابة)', token: 'مبلغ_الدين_كتابة' },
      { label: 'سعر البيع (رقماً)', token: 'سعر_البيع_رقما' },
      { label: 'سعر البيع (كتابة)', token: 'سعر_البيع_كتابة' },
      { label: 'تاريخ الاستحقاق', token: 'تاريخ_الاستحقاق', date: true },
      { label: 'اسم الكفيل الضامن', token: 'اسم_الكفيل' },
      { label: 'رقم الشاصي', token: 'رقم_الشاصي' },
      { label: 'رقم اللوحة والمحافظة', token: 'رقم_اللوحة_والمحافظة' }
    ]
  }
];

let seq = 0;
function fieldId(): string {
  seq += 1;
  return `f${Date.now().toString(36)}${seq.toString(36)}`;
}

export function toField(catalog: CatalogField, value = ''): LetterField {
  return { ...catalog, id: fieldId(), value };
}

export function defaultFields(): LetterField[] {
  return CORE_FIELDS.map((f) => toField(f));
}

/** اسم يكتبه الموظف يصير وسمًا صالحًا في المتن. */
export function tokenFromLabel(label: string): string {
  return label.trim().replace(/\s+/g, '_').replace(/[{}]/g, '') || 'حقل';
}

/** يمنع تكرار الوسم في الكتاب الواحد — وسمان متشابهان يفسدان الحقن. */
export function uniqueToken(token: string, existing: LetterField[]): string {
  if (!existing.some((f) => f.token === token)) return token;
  for (let i = 2; i < 100; i++) {
    const candidate = `${token}_${i}`;
    if (!existing.some((f) => f.token === candidate)) return candidate;
  }
  return `${token}_${Date.now().toString(36)}`;
}

export function fieldByRole(fields: LetterField[], role: Exclude<FieldRole, null>): string {
  return fields.find((f) => f.role === role)?.value.trim() ?? '';
}
