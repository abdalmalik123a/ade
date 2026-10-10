/**
 * الطلب وملفّ الجهة يملآن التصاميم (DESIGNS.md ٣٫٥) — كما يملأ «هات المدرسة» كتب الشبّاك: ما في ملفّ الجهة (اسمها
 * وعنوانها وهاتفها، وملفّ المدرسة: مديريتها ومديرها) يُكتب في حقول التصميم بأسمائها في المعرض («الجهة»، «المديرية»،
 * «الموقّع»…)، والعام الدراسي من التاريخ — فشهادات صفٍّ كاملٍ من طلب مدرسةٍ تخرج بقائمته وحدها.
 *
 * وما لا يُعرف لا يُكتب: صفة الموقّع («مدير المدرسة» أو «مديرة المدرسة») تُكتب إن عُرف جنس المدير من اسمه يقينًا، وإلا
 * تبقى للموظّف — فشهادةٌ بصفةٍ خاطئة أسوأ من خانةٍ فارغة يقولها الفحص قبل الطباعة.
 */
import { normalizeFold, toIndic } from '../arabic';
import { guessGender, type LearnedGenders } from '../gender';
import type { Client } from '../orders';
import { academicYear, SCHOOL_KINDS } from '../schoolFile';

type Slot = 'name' | 'directorate' | 'address' | 'phone' | 'signer' | 'signerTitle' | 'year';

/** الحقول بأسمائها مطبَّعةً (`normalizeFold`: «الدائرة» ← «الدايره») — المطابقة تامّة: «العنوان الوظيفي» ليس «العنوان». */
const SLOTS: [RegExp, Slot][] = [
  [/^(?:اسم )?(?:الجهه|المدرسه|الدايره|الموسسه|الشركه|المحل|الروضه)$/, 'name'],
  [/^(?:المديريه(?: العامه)?|المحافظه)$/, 'directorate'],
  [/^(?:العنوان|عنوان (?:الجهه|المدرسه|المحل))$/, 'address'],
  [/^(?:الهاتف|رقم الهاتف|الموبايل|هاتف (?:الجهه|المدرسه|المحل))$/, 'phone'],
  [/^(?:الموقع|اسم المدير|(?:اسم )?مدير المدرسه)$/, 'signer'],
  [/^صفه الموقع$/, 'signerTitle'],
  [/^(?:العام|السنه) الدراسيه?$/, 'year']
];

const slotOf = (key: string): Slot | null => {
  const k = normalizeFold(key.replace(/_/g, ' ')).replace(/\s+/g, ' ').trim();
  return SLOTS.find(([re]) => re.test(k))?.[1] ?? null;
};

/** «مدير المدرسة» أو «مديرة الروضة» — من نوع الجهة وجنس مديرها إن عُرف يقينًا، وإلا عدم. */
function signerTitle(client: Client, learned: LearnedGenders): string | null {
  if (!client.principal?.trim()) return null;
  // «أ. سعاد» و«د. حسين»: اللقب المختصر ليس اسمًا.
  const g = guessGender(client.principal.replace(/^(?:أ|د|م|ست)\.?\s+/, ''), learned);
  if (!g?.sure) return null;
  const place = client.kind === 'روضة' ? 'الروضة' : 'المدرسة';
  return `${g.gender === 'أنثى' ? 'مديرة' : 'مدير'} ${place}`;
}

/** العام الدراسي كما يُطبع في الشهادات: «٢٠٢٦ – ٢٠٢٧». */
export const designAcademicYear = (today: Date): string => {
  const { from, to } = academicYear(today);
  return `${toIndic(from)} – ${toIndic(to)}`;
};

/**
 * قيم حقول التصميم من ملفّ الجهة — لكلّ حقلٍ يُعرف معناه ما عند الجهة له، والعام الدراسي وإن لم تكن جهة. ومديرها وصفته
 * ومديريتها لجهةٍ من أنواع المدارس وحدها (ملفّ المدرسة).
 */
export function clientValues(keys: string[], client: Client | null, today: Date, learned: LearnedGenders = {}): Record<string, string> {
  const school = Boolean(client?.kind && SCHOOL_KINDS.includes(client.kind));
  const valueOf = (slot: Slot | null): string | null | undefined => {
    if (slot === 'year') return designAcademicYear(today);
    if (!client) return null;
    switch (slot) {
      case 'name':
        return client.name;
      case 'address':
        return client.address;
      case 'phone':
        return client.phone;
      case 'directorate':
        return school ? client.governorate : null;
      case 'signer':
        return school ? client.principal : null;
      case 'signerTitle':
        return school ? signerTitle(client, learned) : null;
      default:
        return null;
    }
  };
  const out: Record<string, string> = {};
  for (const key of keys) {
    const value = valueOf(slotOf(key));
    if (value?.trim()) out[key] = value.trim();
  }
  return out;
}

/** أسماء ما مُلئ بكلام الموظّف: «العنوان والهاتف والموقّع». */
export function filledWords(values: Record<string, string>): string {
  const keys = Object.keys(values);
  return keys.length <= 1 ? (keys[0] ?? '') : `${keys.slice(0, -1).join('، ')} و${keys[keys.length - 1]}`;
}
