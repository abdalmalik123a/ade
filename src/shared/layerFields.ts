/**
 * اقتراح الحقول من أسماء طبقات Photoshop (هـ٤) — يؤكّده المكتب.
 *
 * قالب الهوية المشترى من الإنترنت طبقاته مسمّاة: «Name» و«Job Title» و«ID No» —
 * وفيها نصٌّ نموذجيّ («Ahmed Ali»). فكانت تُستورد نصوصًا ثابتة، ويعيد الموظف صنع كلّ
 * حقلٍ بيده. وهنا يُقترح لكلّ طبقةٍ حقلُها من اسمها، بدرجة ثقةٍ وسبب، والموظف يقبل أو
 * يرفض — والنصّ النموذجيّ يبقى قيمةً للمعاينة.
 *
 * والاسم العامّ («Layer 1»، «Text»، «Copy») لا يُقترح له شيء: لا تخمين.
 */
import type { Suggestion } from './doc';
import { normalizeFold } from './arabic';

/** [أنماط الاسم، الحقل] — الأدقّ أولًا: «Father Name» قبل «Name». */
const TABLE: [RegExp, string][] = [
  [/(father|اسم الاب|اسم الأب)/, 'اسم الأب'],
  [/(mother|اسم الام|اسم الأم)/, 'اسم الأم'],
  [/(full ?name|الاسم الكامل|الاسم الرباعي)/, 'الاسم الكامل'],
  [/(first ?name|given)/, 'الاسم'],
  [/(last ?name|surname|family|اللقب)/, 'اللقب'],
  [/(^|[^a-z])(name|الاسم|اسم)([^a-z]|$)/, 'الاسم'],
  [/(job|title|position|designation|role|المنصب|الوظيفه|العنوان الوظيفي)/, 'العنوان الوظيفي'],
  [/(dep(t|artment)?|section|القسم|الشعبه)/, 'القسم'],
  [/(blood|فصيله)/, 'فصيلة الدم'],
  [/(dob|birth|الولاده|المواليد)/, 'تاريخ الولادة'],
  [/(expir|valid|النفاذ|الصلاحيه)/, 'تاريخ النفاذ'],
  [/(issue ?date|الاصدار)/, 'تاريخ الإصدار'],
  [/(phone|mobile|tel|الهاتف|الموبايل)/, 'الهاتف'],
  [/(email|البريد)/, 'البريد'],
  [/(address|العنوان|السكن)/, 'العنوان'],
  [/(school|المدرسه)/, 'المدرسة'],
  [/(class|grade|stage|الصف|المرحله)/, 'الصف'],
  [/(nationality|الجنسيه)/, 'الجنسية'],
  [/(id ?(no|num|number|#)?|employee ?(no|id|code)|code|serial|رقم|الرقم)/, 'الرقم'],
  [/(company|org|الشركه|الجهه)/, 'الجهة']
];

/** أسماءٌ عامّة يضعها Photoshop من نفسه — لا تدلّ على حقل. */
const GENERIC = /^(layer|text|copy|group|shape|rectangle|ellipse|طبقه|نص|نسخه)?\s*\d*(\s*copy\s*\d*)?$/;

export function fieldFromLayerName(layerName: string, sample = ''): Suggestion<string> | null {
  const name = normalizeFold(layerName).replace(/[_\-.]+/g, ' ').trim();
  if (!name || GENERIC.test(name)) return null;
  for (const [pattern, key] of TABLE) {
    if (!pattern.test(name)) continue;
    // الاسم نصًّا صريحًا («Name») أوثق من كلمةٍ في وسطه («Name Tag Background»).
    const exact = name.split(/\s+/).length <= 2;
    // ونصٌّ نموذجيٌّ قصير (سطر) يليق بحقل؛ وفقرةٌ طويلة غالبًا نصٌّ ثابتٌ في التصميم.
    const shortSample = !sample || sample.length <= 40;
    const confidence = exact && shortSample ? 0.85 : 0.6;
    return { value: key, confidence, reason: `اسم الطبقة «${layerName.trim()}»` };
  }
  return null;
}
