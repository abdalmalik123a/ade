/**
 * قياس النصوص التي تصغر لتسع — بعد أن يرسمها المتصفّح بخطّها الحقيقي.
 *
 * التقدير في `canvasHtml.ts` يضع حجمًا آمنًا، وهذا يكبّره إلى أقصى ما يسع
 * صندوقه (ولا يتجاوز `data-fit`). ويجري في المعاينة، وفي نافذة الطباعة بعد
 * تحميل الخطوط — فتخرج الورقة كما رُئيت.
 *
 * **دالّةٌ مكتفيةٌ بنفسها** لا تشير إلى شيءٍ خارجها: نافذة الطباعة تنفّذ نصّها
 * (`fitCanvasText.toString()`)، فأيّ مرجعٍ خارجي ينكسر هناك صامتًا.
 */
/** أقلّ ما تحتاجه الدالّة من العنصر — فتُبنى في العملية الرئيسية بلا مكتبة DOM. */
type FitBox = {
  dataset: { fit?: string };
  firstElementChild: { offsetWidth: number } | null;
  clientWidth: number;
  style: { fontSize: string };
};

export function fitCanvasText(root: { querySelectorAll(selector: string): ArrayLike<unknown> }): number {
  let fitted = 0;
  const nodes = root.querySelectorAll('[data-fit]') as ArrayLike<FitBox>;
  for (const box of Array.from(nodes)) {
    const span = box.firstElementChild;
    const max = parseFloat(box.dataset.fit || '0');
    if (!span || !max) continue;
    const room = box.clientWidth;
    if (!room) continue;
    const fits = (px: number) => {
      box.style.fontSize = px + 'px';
      return span.offsetWidth <= room;
    };
    if (fits(max)) continue;
    // بحثٌ ثنائي: عشر خطوات تكفي لدقّة جزءٍ من بكسل.
    let lo = 1;
    let hi = max;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) lo = mid;
      else hi = mid;
    }
    box.style.fontSize = lo.toFixed(2) + 'px';
    fitted += 1;
  }
  return fitted;
}
