/**
 * «ملفّ المدارس» (الموجة ٢، بقرار المالك ٦ تشرين الأول): مكتبٌ يخدم مدارس يكتب لكلّ مدرسةٍ مرّةً جنسها ومحافظتها ومديرها
 * في ملفّها في «الجهات»، فتمتلئ كتبها في الشبّاك بضغطة («هات المدرسة») — كما تملأ ورقة البيانات كتب برنامج المخاطبات في
 * Excel. خيارٌ يُفعَّل من الإعدادات، لا للجميع («ولا يضاف للجميع»).
 *
 * وخانات المدرسة تُعرف بأسمائها كما يكتبها برنامج المخاطبات وورقة بياناته («اسم_المدرسة»، «جنس_المدرسة»، «المحافظة»،
 * «اسم_مدير_المدرسة»، «العام_الدراسي») — والخانة المربوطة بملفّ الزبون (المحافظة من سكنه) لا تُمسّ. والعام الدراسي لا
 * يُكتب في الملفّ: يُحسب من التاريخ، فالعام العراقي يبدأ في أيلول.
 */
import { normalizeFold } from './arabic';

export type SchoolSlot = 'name' | 'gender' | 'governorate' | 'principal' | 'year' | 'year2';

/** ملفّ المدرسة كما في «الجهات» — والجهة نفسها تُمرَّر. */
export type SchoolFile = {
  name: string;
  schoolGender?: string | null;
  governorate?: string | null;
  principal?: string | null;
};

/** أنواع الجهات التي لها ملفّ مدرسة. */
export const SCHOOL_KINDS = ['مدرسة', 'روضة', 'إعدادية', 'ثانوية'];

/** جنس المدرسة كما يُطبع تحت اسمها في رأس الكتاب. */
export const SCHOOL_GENDERS = ['للبنين', 'للبنات', 'المختلطة'];

const SLOTS: [RegExp, SchoolSlot][] = [
  [/^(?:اسم )?المدرسه$/, 'name'],
  [/^(?:جنس|نوع) المدرسه$/, 'gender'],
  [/^(?:ال)?محافظه$|^(?:ال)?مديريه(?: العامه)?(?: لل?تربيه)?$/, 'governorate'],
  [/^(?:اسم )?مدير المدرسه$|^اسم المدير$/, 'principal'],
  [/^(?:العام|السنه) الدراسيه?(?: 1)?$/, 'year'],
  [/^(?:العام|السنه) الدراسيه? 2$/, 'year2']
];

/** معنى الخانة في ملفّ المدرسة من اسمها — أو عدم. والخانة المربوطة بملفّ الزبون لصاحبها. */
export function schoolSlotOf(key: string, source?: string | null): SchoolSlot | null {
  if (source) return null;
  const k = normalizeFold(key.replace(/_/g, ' ')).replace(/\s+/g, ' ').trim();
  for (const [re, slot] of SLOTS) if (re.test(k)) return slot;
  return null;
}

/** أفي الأوراق خانةٌ من ملفّ المدرسة (سوى العام الدراسي)؟ — فيُعرض «هات المدرسة». */
export function hasSchoolFields(fields: { key: string; source?: string | null }[]): boolean {
  return fields.some((f) => {
    const slot = schoolSlotOf(f.key, f.source);
    return slot !== null && slot !== 'year' && slot !== 'year2';
  });
}

/** العام الدراسي من التاريخ: يبدأ في أيلول — من أيلول ٢٠٢٥ إلى آب ٢٠٢٦ عامُ ٢٠٢٥/٢٠٢٦. */
export function academicYear(today: Date): { from: number; to: number } {
  const y = today.getFullYear();
  return today.getMonth() >= 8 ? { from: y, to: y + 1 } : { from: y - 1, to: y };
}

/** العام الدراسي كما يُكتب في خانةٍ واحدة: «2025/2026». */
export function academicYearText(today: Date): string {
  const { from, to } = academicYear(today);
  return `${from}/${to}`;
}

/**
 * قيم خانات المدرسة في الأوراق من ملفّها — وما لا يُعرف لا يُكتب. و`school` الغائب: العام الدراسي وحده. والعام بخانتين
 * (ورقة البيانات: «2025  /» و«2026») يُكتب كما تكتبه، وبخانةٍ واحدة «2025/2026».
 */
export function schoolValues(fields: { key: string; source?: string | null }[], school: SchoolFile | null, today: Date): Record<string, string> {
  const year = academicYear(today);
  const slots = fields.flatMap((f) => {
    const slot = schoolSlotOf(f.key, f.source);
    return slot ? [{ key: f.key, slot }] : [];
  });
  const split = slots.some((s) => s.slot === 'year2');
  const out: Record<string, string> = {};
  for (const { key, slot } of slots) {
    const value =
      slot === 'name'
        ? school?.name
        : slot === 'gender'
          ? school?.schoolGender
          : slot === 'governorate'
            ? school?.governorate
            : slot === 'principal'
              ? school?.principal
              : slot === 'year'
                ? split
                  ? `${year.from} /`
                  : academicYearText(today)
                : String(year.to);
    if (value?.trim()) out[key] = value.trim();
  }
  return out;
}

/**
 * القيم بعد اختيار مدرسة: ما ملأته مدرسةٌ سابقة يُستبدل، وما كتبه الموظف بيده لا يُطمس. و`filled` ما ملأه الاختيار
 * السابق — فتبديل المدرسة يبدّل قيمها لا يُبقي اسم الأولى.
 */
export function applySchool(
  values: Record<string, string>,
  next: Record<string, string>,
  filled: Record<string, string>
): { values: Record<string, string>; filled: Record<string, string> } {
  const out = { ...values };
  const now: Record<string, string> = {};
  // ما ملأته الأولى ولا تعرفه الثانية (مديرٌ لم يُكتب في ملفّها) يُمحى — لا يبقى مدير مدرسةٍ في كتب أخرى.
  for (const [key, value] of Object.entries(filled)) if (!(key in next) && out[key] === value) out[key] = '';
  for (const [key, value] of Object.entries(next)) {
    const cur = out[key]?.trim() ?? '';
    if (!cur || cur === filled[key]) {
      out[key] = value;
      now[key] = value;
    }
  }
  return { values: out, filled: now };
}
