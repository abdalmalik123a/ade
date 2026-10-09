/**
 * «غيّر المقاس» (DESIGNS.md ١٫٧): التصميم إلى مقاسٍ آخر **تتوزّع عناصره وحدها** — لا تتمطّط معه.
 *
 * فالنِّسَب وحدها كانت تمطّ كلّ شيء: الدائرة بيضويّة، والصورة مضغوطة، والعنوان في صندوقٍ نحيل. وهنا:
 * - كلّ عنصرٍ **يحفظ شكله** ويُكبَّر أو يُصغَّر بمعاملٍ واحد (`s`: أصغر النسبتين) — والخطّ والحدّ والإطار معه؛ إلا النصّ
 *   والجدول: يجريان في عرضهما، فصندوقهما **يحفظ حصّته من العرض** وحجم خطّه يتبع `s`؛
 * - و**يحفظ موضعه نسبيًّا** من مركزه — وما لصق حافّةً يبقى لاصقها (الزاوية في زاويتها، والموجة السفلية في أسفلها)؛
 * - وما امتدّ على العرض كلّه (≥ ٩٠٪) أو الارتفاع كلّه **يبقى ممتدًّا** — الشريط والموجة والإطار.
 * والخلفية تملأ الورقة كما كانت.
 */
import { clampBox } from '../model/box';
import type { Canvas, CanvasElement, CanvasSize } from '../model/types';

const SPAN = 0.9;
const EDGE = 0.01;
const half = (v: number) => Math.max(4, Math.round(v * 2) / 2);

/** المعامل الواحد بين مقاسين — أصغر النسبتين، فلا يخرج عنصرٌ عن الورقة الجديدة. */
export const relayoutScale = (from: CanvasSize, to: CanvasSize) => Math.min(to.w / from.w, to.h / from.h);

/** محورٌ واحد: الطول الجديد (نسبةً) والموضع — ممتدٌّ أو لاصقٌ حافّةً أو بمركزه. */
function axis(start: number, len: number, oldMm: number, newMm: number, s: number): [number, number] {
  if (len >= SPAN) return [start, len];
  const next = Math.min(1, (len * oldMm * s) / newMm);
  if (start <= EDGE) return [start, next];
  const tail = 1 - start - len;
  if (tail <= EDGE) return [1 - next - tail, next];
  return [start + len / 2 - next / 2, next];
}

function scaleOwn(el: CanvasElement, s: number): CanvasElement {
  switch (el.kind) {
    case 'text':
      return { ...el, size: half(el.size * s) };
    case 'table':
      return {
        ...el,
        ...(el.fontSize ? { fontSize: half(el.fontSize * s) } : {}),
        ...(el.headerFontSize ? { headerFontSize: half(el.headerFontSize * s) } : {})
      };
    case 'image':
      return el.frame ? { ...el, frame: { ...el.frame, width: el.frame.width * s, ...(el.frame.gap !== undefined ? { gap: el.frame.gap * s } : {}) } } : el;
    case 'path':
      return el.strokeWidth ? { ...el, strokeWidth: el.strokeWidth * s } : el;
    default:
      return el;
  }
}

/** التصميم بمقاسه الجديد وعناصره موزّعةً — والمقاس نفسه بلا تغيير لا يمسّ شيئًا. */
export function relayoutCanvas(canvas: Canvas, size: CanvasSize): Canvas {
  const from = canvas.size;
  if (from.w === size.w && from.h === size.h) return canvas;
  const s = relayoutScale(from, size);
  const elements = canvas.elements.map((el) => {
    // النصّ والجدول يجريان: حصّتهما من العرض كما هي، والارتفاع وحده بالمعامل.
    const flows = el.kind === 'text' || el.kind === 'table';
    const [x, w] = flows ? [el.box.x, el.box.w] : axis(el.box.x, el.box.w, from.w, size.w, s);
    const [y, h] = axis(el.box.y, el.box.h, from.h, size.h, s);
    return { ...scaleOwn(el, s), box: clampBox({ x, y, w, h }) } as CanvasElement;
  });
  return { ...canvas, size: { ...size }, elements };
}
