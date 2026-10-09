/**
 * مكتبة العناصر (DESIGNS.md ٣٫٧ و٠٫٨): زخارف وإطارات وأيقونات وصور ظلّية — SVG (يُعقَّم: `svgClean.ts`) وPNG — يستوردها
 * المكتب فتُحفظ في المخزن ببصمتها وفهرسها في القاعدة، وتنتقل في النسخة الاحتياطية؛ وبجانبها المجموعة الحرّة المحزومة
 * (`clipart.ts` اليوم، ومحتواها في المرحلة ١). والعنصر يدخل التصميم صورةً بمساره في المخزن، فحذفه من المكتبة لا يكسر
 * تصميمًا استعمله (الملفّ يبقى ما بقي له مرجع).
 */
import { clampBox } from './model/box';
import type { Box, CanvasSize } from './model/types';

export const ELEMENT_CATEGORIES = ['زخارف', 'إطارات', 'أيقونات', 'صور ظلّية', 'أخرى'] as const;
export type ElementCategory = (typeof ELEMENT_CATEGORIES)[number];

export type LibraryElement = {
  id: number;
  name: string;
  category: ElementCategory;
  kind: 'svg' | 'png';
  /** مساره في المخزن: `elements/<بصمة>.svg`. */
  file: string;
  /** أبعاده الأصلية — منها نسبة صندوقه في اللوحة. */
  width: number;
  height: number;
  createdAt: string;
};

export type ElementImport = { added: LibraryElement[]; errors: { name: string; reason: string }[] };

/** جسر الواجهة (`window.diwan.elements`). */
export type ElementsApi = {
  list(): Promise<LibraryElement[]>;
  /** ملفّات SVG أو PNG يختارها المكتب إلى صنفٍ — كلٌّ يُفحص (والـSVG يُعقَّم) قبل قبوله. */
  importFiles(category: ElementCategory): Promise<ElementImport>;
  remove(id: number): Promise<void>;
};

export function normalizeCategory(raw: unknown): ElementCategory {
  return (ELEMENT_CATEGORIES as readonly string[]).includes(raw as string) ? (raw as ElementCategory) : 'أخرى';
}

/**
 * صندوق العنصر حين يُدرج: في وسط اللوحة، بنسبة أبعاده الحقيقية (فلا تُمطّ الأيقونة)، وأطول ضلعيه ثلث أقصر ضلعي اللوحة.
 */
export function elementBox(el: Pick<LibraryElement, 'width' | 'height'>, size: CanvasSize): Box {
  const side = Math.min(size.w, size.h) / 3;
  const ratio = el.width > 0 && el.height > 0 ? el.width / el.height : 1;
  const wMm = ratio >= 1 ? side : side * ratio;
  const hMm = ratio >= 1 ? side / ratio : side;
  const w = wMm / size.w;
  const h = hMm / size.h;
  return clampBox({ x: (1 - w) / 2, y: (1 - h) / 2, w, h });
}
