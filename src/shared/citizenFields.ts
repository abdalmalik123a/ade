/**
 * قيم الحقل من ملف المواطن بمعناه (د١٥، د١٢) — لهويّات الموظفين من السجل.
 *
 * حقول التصميم تُسمّى كما يشاء المكتب: «اسم الموظف»، «المنصب»، «رقم الهوية». فيُعرف
 * كلٌّ بمعناه من اسمه، ويؤخذ من ملف صاحبه — والحقل الذي لا يُعرف معناه يُترك فارغًا
 * يُملأ باليد، لا يُخمَّن له.
 */
import { normalizeFold } from './arabic';
import type { CitizenInput } from './api';

type Source = keyof Omit<CitizenInput, 'id' | 'verified'>;

/** [أنماط اسم الحقل مطويًّا، خانة الملف] — الأدقّ أولًا: «الرقم الوطني» قبل «الرقم». */
const VOCAB: [RegExp, Source][] = [
  [/الرقم الوطني|البطاقه الوطنيه|الموحده|national/, 'nationalId'],
  [/محل الولاده|مكان الولاده/, 'birthPlace'],
  [/تاريخ الولاده|المواليد|الولاده|birth|dob/, 'birthDate'],
  [/بطاقه السكن/, 'housingCardNo'],
  [/نقطه داله/, 'landmark'],
  // خانات الاستمارات الحكومية (أيلول ٢٠٢٦) — قبل «الاسم» و«العنوان» العامّين: «اسم الأم» ليس الاسم.
  [/اسم الام|^الام$|الوالده|mother/, 'motherName'],
  [/اللقب|surname/, 'surname'],
  [/الجنس|gender|^sex$/, 'gender'],
  [/الحاله الاجتماعيه|الحاله الزوجيه|marital/, 'maritalStatus'],
  [/التحصيل|education/, 'education'],
  [/البريد|email/, 'email'],
  [/المحافظه|governorate/, 'governorate'],
  [/القضاء/, 'district'],
  [/الناحيه/, 'subdistrict'],
  [/الرقم العائلي/, 'familyNumber'],
  [/رقم السجل/, 'civilRecord'],
  [/رقم الصحيفه/, 'civilPage'],
  [/الجواز|passport/, 'passportNo'],
  [/التموينيه/, 'rationCardNo'],
  [/رمز الموظف|الرقم الوظيفي|رقم الموظف|employee|code/, 'employeeCode'],
  [/الهاتف|الموبايل|الجوال|phone|mobile/, 'phone'],
  [/العنوان الوظيفي|الوظيفه|المنصب|المسمى|job|title|position/, 'jobTitle'],
  [/مكان العمل|الدائره|المديريه|القسم|الجهه|workplace|department|dept/, 'workplace'],
  [/الدرجه|الانتساب/, 'enrollmentDept'],
  [/الحاله الوظيفيه|الخدمه/, 'serviceStatus'],
  [/العنوان|السكن|address/, 'address'],
  [/الاسم|اسم|name/, 'fullName'],
  [/^الرقم$|^رقم$|^id$/, 'employeeCode']
];

/** خانة الملف لحقلٍ باسمه — أو عدم. و`source` الصريح في الحقل يغلب. */
export function citizenSourceOf(key: string, source?: string | null): Source | null {
  if (source) return source as Source;
  const k = normalizeFold(key).replace(/[_\s]+/g, ' ').trim();
  for (const [pattern, field] of VOCAB) if (pattern.test(k)) return field;
  return null;
}

/**
 * صفّ الدفعة من ملف مواطن: لكلّ حقلٍ عُرف معناه قيمتُه. و«الرقم» بلا وصفٍ رمزُ الموظف،
 * فإن لم يكن فالرقم الوطني.
 */
export function rowFromCitizen(
  citizen: Partial<CitizenInput> & { fullName: string },
  fields: { key: string; source?: string | null }[]
): Record<string, string> {
  const row: Record<string, string> = {};
  for (const f of fields) {
    const source = citizenSourceOf(f.key, f.source);
    if (!source) continue;
    let value = citizen[source];
    if (source === 'employeeCode' && !value) value = citizen.nationalId ?? null;
    if (typeof value === 'string' && value.trim()) row[f.key] = value.trim();
  }
  return row;
}

/** صفوفٌ نصًّا بالجدولة وعناوينها — كما لو لُصقت من Excel، فتمرّ بقراءة الدفعة نفسها. */
export function rowsToTsv(keys: string[], rows: Record<string, string>[]): string {
  const clean = (v: string) => v.replace(/[\t\r\n]+/g, ' ');
  return [keys.join('\t'), ...rows.map((r) => keys.map((k) => clean(r[k] ?? '')).join('\t'))].join('\n');
}
