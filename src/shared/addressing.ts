/**
 * اتجاه المخاطبة (FOUNDATION §٤ و§٦): نبرة الفعل تتبع من يُخاطَب.
 *
 * `يرجى / الرجاء` من الأدنى إلى الأعلى، و`تنسب / تزويدنا` من الأعلى إلى الأدنى،
 * و`إشارة إلى` بين المتساويين. فالكليشة تُعلَّم باتجاهها — ويُخمَّن من أفعالها
 * حين تُحفظ — والكتاب يعلن لمن يُكتب، فتتصدّر كليشاتُ اتجاهه القائمة وحدها.
 */
import type { Addressing } from './api';
import { normalizeFold } from './arabic';

export const ADDRESSING: Addressing[] = ['up', 'down', 'peer'];

export const ADDRESSING_LABEL: Record<Addressing, string> = {
  up: 'إلى جهةٍ أعلى',
  down: 'إلى جهةٍ أدنى',
  peer: 'بين المتساويين'
};

/** مثال النبرة بجانب الاسم — ليُعرف الاتجاه من فعله لا من وصفه. */
export const ADDRESSING_HINT: Record<Addressing, string> = {
  up: 'يرجى / الرجاء',
  down: 'تنسب / تزويدنا',
  peer: 'إشارة إلى'
};

/**
 * كلمةٌ كاملة بعد الطيّ، ولو سبقها حرف عطف (ويرجى، فالرجاء). والحدّ حرفٌ ليس
 * حرفًا: `\b` لا يعرف العربية.
 */
const word = (forms: string[]) =>
  new RegExp(`(?:^|[^\\p{L}])(?:و|ف)?(?:${forms.map(normalizeFold).join('|')})(?=$|[^\\p{L}])`, 'u');

// «يرجى تزويدنا» صاعدة: الرجاء يحسم، فيُسأل عنه قبل «تزويدنا».
const UP = word(['يرجى', 'يُرجى', 'الرجاء', 'نرجو', 'راجين', 'نأمل', 'نلتمس', 'يرجى التفضل']);
const DOWN = word(['تنسب', 'تُنسب', 'تزويدنا', 'يقتضي', 'نوعز', 'أوعز', 'للتنفيذ']);
const PEER = word(['إشارة إلى', 'إشارةً إلى', 'بالإشارة إلى', 'نود إعلامكم', 'للتفضل بالعلم']);

/** اتجاه العبارة من أفعالها — أو عدمٌ إن لم يظهر فيها ما يدلّ. */
export function guessAddressing(text: string): Addressing | null {
  const t = normalizeFold(text);
  if (UP.test(t)) return 'up';
  if (DOWN.test(t)) return 'down';
  if (PEER.test(t)) return 'peer';
  return null;
}

/**
 * الكليشات مرتّبةً لكتابٍ باتجاهه: ما وافقه أولًا، ثم ما يصلح لكلّ اتجاه، ثم
 * الباقي — كلٌّ بترتيبه الأصلي (الأحدث استعمالًا). ولا يُخفى شيء: الموظف قد
 * يحتاج عبارةً من غير اتجاهها فيعدّل فعلها.
 */
export function rankByAddressing<T extends { direction: Addressing | null }>(
  items: T[],
  to: Addressing | null
): T[] {
  if (!to) return items;
  const rank = (x: T) => (x.direction === to ? 0 : x.direction === null ? 1 : 2);
  return items
    .map((x, i) => ({ x, i }))
    .sort((a, b) => rank(a.x) - rank(b.x) || a.i - b.i)
    .map((e) => e.x);
}
