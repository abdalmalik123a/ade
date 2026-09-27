/**
 * بحثٌ واستبدال في نصّ الوثيقة (FOUNDATION §١٠، البند ٧).
 *
 * يجري على النصّ الذي كتبه المؤلّف وحده — الفقرات والجداول والأعمدة والأسئلة —
 * **والحقول لا تُمسّ**: «الاسم» حقلٌ لا كلمة. والبحث متساهلٌ مع الهمزة إن طُلب:
 * «احمد» تجد «أحمد»، و«مدرسه» تجد «مدرسة» — كما يكتب الموظف مستعجلًا.
 *
 * وحدّه أن العبارة داخل مقطعٍ واحد بتنسيقٍ واحد: كلمةٌ نصفها عريض لا تُطابَق
 * كاملةً. وهذا نادرٌ في كتبٍ تُكتب بتنسيقٍ واحد، ويُقال بعدد ما وُجد.
 */
import type { Doc } from './doc';
import { mapDocText } from './spelling';

const LOOSE: Record<string, string> = {
  ا: '[اأإآ]',
  أ: '[اأإآ]',
  إ: '[اأإآ]',
  آ: '[اأإآ]',
  ى: '[ىي]',
  ي: '[ىي]',
  ة: '[ةه]',
  ه: '[ةه]'
};

/** نمط البحث: حرفيٌّ، أو متساهلٌ مع الهمزة والياء والتاء المربوطة. */
export function findPattern(query: string, loose: boolean): RegExp | null {
  const q = query.trim();
  if (!q) return null;
  const source = [...q]
    .map((ch) => (loose && LOOSE[ch] ? LOOSE[ch] : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('');
  return new RegExp(source, 'g');
}

/** كم مرّةً وردت العبارة في نصّ الوثيقة. */
export function countInDoc(doc: Doc, query: string, loose = true): number {
  const re = findPattern(query, loose);
  if (!re) return 0;
  let n = 0;
  mapDocText(doc, (t) => {
    n += t.match(re)?.length ?? 0;
    return t;
  });
  return n;
}

/** يستبدل كلّ ما وُجد، ويعيد الوثيقة الجديدة وعدد ما استُبدل. */
export function replaceInDoc(doc: Doc, query: string, replacement: string, loose = true): { doc: Doc; count: number } {
  const re = findPattern(query, loose);
  if (!re) return { doc, count: 0 };
  let count = 0;
  const next = mapDocText(doc, (t) =>
    t.replace(re, () => {
      count++;
      return replacement;
    })
  );
  return { doc: count ? next : doc, count };
}
