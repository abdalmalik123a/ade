/**
 * اللوحة — الوثيقة المصمَّمة: مدخلٌ ثابت (DESIGNS.md ٠٫٤ و٣٫١).
 *
 * النموذج في `shared/design/model/*`، وكلّ نوع عنصرٍ في ملفّه بـ`shared/design/kinds/*` وسجلّه — وهنا يُعاد تصديرها،
 * فالشبّاك والكتب والاختبارات لا تتغيّر يوم النقل، ثم يُنقل كلٌّ منها بهدوء.
 */
export type {
  Mm,
  CanvasSize,
  Box,
  ElementBase,
  VAlign,
  TextElement,
  ImageElement,
  ImageFrame,
  BarcodeElement,
  ShapeElement,
  TableCell,
  TableColumn,
  TableElement,
  TableRowStyle,
  ImsakiyaSettings,
  DateCalendar,
  PathElement,
  CanvasElement,
  Background,
  Canvas
} from './design/model/types';
export { BLEED_MM, PRINT_DPI, SCREEN_DPI, SIZE_PRESETS, canvasPx, mmToPx, ptToPx, type SizePreset } from './design/model/units';
export { clampBox } from './design/model/box';
export { CANVAS_VERSION, canvasVersionOf, designPackLevel, migrateCanvas } from './design/model/version';
export { byLayer, canvasDoc, canvasKeys, canvasText, emptyCanvas, normalizeCanvas, topZ } from './design/model/canvas';
export { textElement } from './design/kinds/text';
export { imageElement } from './design/kinds/image';
export { barcodeElement } from './design/kinds/barcode';
export { shapeElement } from './design/kinds/shape';
export { tableElement } from './design/kinds/table';
export { pathElement } from './design/kinds/path';
