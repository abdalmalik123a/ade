/**
 * رسم اللوحة علاماتٍ — مدخلٌ ثابت (DESIGNS.md ٠٫٤ و٣٫١): الرسّام في `shared/design/render/renderCanvas.ts` يمرّ على
 * سجلّ الأنواع، وكلّ نوعٍ يرسم نفسه في ملفّه.
 */
export { renderCanvasHtml, type CanvasRenderOptions } from './design/render/renderCanvas';
export { estimateEm } from './design/kinds/text';
