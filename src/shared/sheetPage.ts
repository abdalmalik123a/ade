/**
 * مقاس الورقة يرافق علاماتها.
 *
 * الواجهة ترسل علامات الورقة إلى العملية الرئيسة لتُطبع وتُؤرشف، والمقاس لم يكن يرافقها:
 * فالإصدار الرسمي وإعادة الطبع وتصدير PDF من السجلّ كانت تخرج على A4 مهما كانت ورقة الكتاب —
 * الفولسكاب تُقسَّم أسطره على صفحتين، والأفقي يُقصّ، وA5 يقع في ركنٍ (مراجعة ٧ ت١).
 *
 * فيُكتب المقاس في الورقة نفسها (`data-page="210x330"`) فيعود معها أنّى ذهبت: من الأرشيف وإلى
 * كلّ طابعة، بلا عمودٍ في القاعدة ولا حقلٍ في كلّ نداء. وما صدر قبل هذا (بلا السمة) يبقى A4 كما طُبع.
 */

export type SheetPage = { w: number; h: number };

/** `210x330` — بلا كسورٍ زائدة. */
export function sheetPageAttr(page: SheetPage): string {
  const mm = (n: number) => String(Math.round(n * 100) / 100);
  return `${mm(page.w)}x${mm(page.h)}`;
}

const ATTR = /\bdata-page="(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)"/;

/** مقاس أوّل ورقةٍ في العلامات، أو `null` إن لم يُكتب (أو لم يكن مقاسًا معقولًا). */
export function pageOfSheetHtml(html: string): SheetPage | null {
  const m = ATTR.exec(html);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  // بين بطاقةٍ صغيرة وملصقٍ كبير — وما خرج عن ذلك سمةٌ مصنوعة لا مقاس ورق.
  const sane = (n: number) => Number.isFinite(n) && n >= 40 && n <= 1500;
  return sane(w) && sane(h) ? { w, h } : null;
}
