/**
 * خانات ملف المواطن — تعريفٌ واحد يُبنى منه النموذج والحفظ والعرض والتصدير.
 *
 * وما أُضيف في أيلول ٢٠٢٦ من بحث استمارات منصّة أور (٣٣٢ استمارة): أكثر ما تسأل عنه
 * بعد الاسم والهاتف — اسم الأم الثلاثي، واللقب منفصلًا، والجنس، والمحافظة والقضاء
 * والناحية، والحالة الاجتماعية، والتحصيل، والبريد، ونوع الهوية: البطاقة الموحّدة
 * (تاريخ إصدارها وجهتها والرقم العائلي) أو هوية الأحوال (رقمها والسجل والصحيفة)، ورقم
 * الجواز والبطاقة التموينية وجهة إصدار بطاقة السكن. فتُحفظ مرّةً في الملف، ولا يسأل
 * الموظف عنها الزبونَ في كلّ معاملة.
 */
import type { CitizenInput } from './api';

export type CitizenTextKey = Exclude<keyof CitizenInput, 'id' | 'verified' | 'photoPath' | 'category' | 'notes'>;

export const CITIZEN_GROUPS = ['الهوية', 'البطاقات والأرقام', 'السكن والاتصال', 'العمل والدراسة'] as const;
export type CitizenGroup = (typeof CITIZEN_GROUPS)[number];

export type CitizenFieldDef = {
  key: CitizenTextKey;
  column: string;
  label: string;
  group: CitizenGroup;
  mono?: boolean;
  required?: boolean;
  /** اقتراحاتٌ تُعرض عند الكتابة — لا قائمةٌ مغلقة. */
  options?: readonly string[];
  placeholder?: string;
};

/** المحافظات — جغرافيا لا جهة: اقتراحٌ يُختار منه أو يُكتب غيره. */
export const GOVERNORATES = [
  'بغداد',
  'البصرة',
  'نينوى',
  'أربيل',
  'السليمانية',
  'دهوك',
  'كركوك',
  'الأنبار',
  'ديالى',
  'صلاح الدين',
  'بابل',
  'كربلاء',
  'النجف',
  'واسط',
  'القادسية',
  'ميسان',
  'ذي قار',
  'المثنى',
  'حلبجة'
] as const;

export const CITIZEN_FIELDS: readonly CitizenFieldDef[] = [
  { key: 'fullName', column: 'full_name', label: 'الاسم الرباعي واللقب', group: 'الهوية', required: true },
  { key: 'surname', column: 'surname', label: 'اللقب', group: 'الهوية', placeholder: 'كما يُكتب منفصلًا في الاستمارات' },
  { key: 'motherName', column: 'mother_name', label: 'اسم الأم الثلاثي', group: 'الهوية' },
  { key: 'gender', column: 'gender', label: 'الجنس', group: 'الهوية', options: ['ذكر', 'أنثى'] },
  { key: 'birthDate', column: 'birth_date', label: 'تاريخ الولادة', group: 'الهوية' },
  { key: 'birthPlace', column: 'birth_place', label: 'محل الولادة', group: 'الهوية' },
  { key: 'maritalStatus', column: 'marital_status', label: 'الحالة الاجتماعية', group: 'الهوية', options: ['أعزب', 'متزوج', 'مطلّق', 'أرمل', 'عزباء', 'متزوجة', 'مطلّقة', 'أرملة'] },

  { key: 'nationalId', column: 'national_id', label: 'الرقم الوطني الموحد', group: 'البطاقات والأرقام', mono: true },
  { key: 'nidIssueDate', column: 'nid_issue_date', label: 'تاريخ إصدار البطاقة', group: 'البطاقات والأرقام' },
  { key: 'nidIssuer', column: 'nid_issuer', label: 'جهة إصدار البطاقة', group: 'البطاقات والأرقام' },
  { key: 'familyNumber', column: 'family_number', label: 'الرقم العائلي', group: 'البطاقات والأرقام', mono: true },
  { key: 'civilIdNo', column: 'civil_id_no', label: 'رقم هوية الأحوال (القديمة)', group: 'البطاقات والأرقام', mono: true },
  { key: 'civilRecord', column: 'civil_record', label: 'رقم السجل', group: 'البطاقات والأرقام', mono: true },
  { key: 'civilPage', column: 'civil_page', label: 'رقم الصحيفة', group: 'البطاقات والأرقام', mono: true },
  { key: 'passportNo', column: 'passport_no', label: 'رقم الجواز', group: 'البطاقات والأرقام', mono: true },
  { key: 'rationCardNo', column: 'ration_card_no', label: 'رقم البطاقة التموينية', group: 'البطاقات والأرقام', mono: true },
  { key: 'housingCardNo', column: 'housing_card_no', label: 'رقم بطاقة السكن', group: 'البطاقات والأرقام', mono: true },
  { key: 'housingIssuer', column: 'housing_issuer', label: 'جهة إصدار بطاقة السكن', group: 'البطاقات والأرقام' },

  { key: 'governorate', column: 'governorate', label: 'المحافظة', group: 'السكن والاتصال', options: GOVERNORATES },
  { key: 'district', column: 'district', label: 'القضاء', group: 'السكن والاتصال' },
  { key: 'subdistrict', column: 'subdistrict', label: 'الناحية', group: 'السكن والاتصال' },
  { key: 'address', column: 'address', label: 'المحلة والزقاق والدار', group: 'السكن والاتصال', placeholder: 'محلة ٦١٢ زقاق ١٤ دار ٧' },
  { key: 'landmark', column: 'landmark', label: 'أقرب نقطة دالة', group: 'السكن والاتصال' },
  { key: 'phone', column: 'phone', label: 'رقم هاتف الاتصال', group: 'السكن والاتصال', mono: true },
  { key: 'email', column: 'email', label: 'البريد الإلكتروني', group: 'السكن والاتصال', mono: true },

  { key: 'jobTitle', column: 'job_title', label: 'العنوان الوظيفي والدرجة', group: 'العمل والدراسة' },
  { key: 'workplace', column: 'workplace', label: 'مكان العمل', group: 'العمل والدراسة' },
  { key: 'employeeCode', column: 'employee_code', label: 'رمز الموظف', group: 'العمل والدراسة', mono: true },
  { key: 'serviceStatus', column: 'service_status', label: 'الحالة الوظيفية والخدمة', group: 'العمل والدراسة' },
  { key: 'enrollmentDept', column: 'enrollment_dept', label: 'دائرة الانتساب الرسمية', group: 'العمل والدراسة' },
  {
    key: 'education',
    column: 'education',
    label: 'التحصيل الدراسي',
    group: 'العمل والدراسة',
    options: ['يقرأ ويكتب', 'ابتدائية', 'متوسطة', 'إعدادية', 'دبلوم', 'بكالوريوس', 'دبلوم عالٍ', 'ماجستير', 'دكتوراه']
  }
];

/** الأعمدة التي أُضيفت بعد إنشاء الجدول — تُضاف إلى قاعدة المكتب القائمة عند الإقلاع. */
export const ADDED_COLUMNS = [
  'surname',
  'mother_name',
  'gender',
  'marital_status',
  'education',
  'email',
  'governorate',
  'district',
  'subdistrict',
  'nid_issue_date',
  'nid_issuer',
  'family_number',
  'civil_id_no',
  'civil_record',
  'civil_page',
  'passport_no',
  'ration_card_no',
  'housing_issuer'
] as const;
