/**
 * سجلّ الأنواع (DESIGNS.md ٣٫٣): سطرٌ لكلّ نوع — والنموذج والرسّام يمرّان عليه ولا يعرفان الأنواع بأسمائها.
 */
import type { CanvasElement } from '../model/types';
import type { ElementCommon, KindSpec } from './types';
import { TEXT_KIND } from './text';
import { IMAGE_KIND, legacySvgImage } from './image';
import { BARCODE_KIND } from './barcode';
import { SHAPE_KIND } from './shape';
import { TABLE_KIND } from './table';
import { PATH_KIND } from './path';

type AnyKind = { [K in CanvasElement['kind']]: KindSpec<Extract<CanvasElement, { kind: K }>> };

export const KINDS: AnyKind = {
  text: TEXT_KIND,
  image: IMAGE_KIND,
  barcode: BARCODE_KIND,
  shape: SHAPE_KIND,
  table: TABLE_KIND,
  path: PATH_KIND
};

/** أنواعٌ قديمة تُقرأ فتصير نوعًا قائمًا — ولا تُكتب بعد اليوم. */
export const LEGACY_KINDS: Record<string, (raw: Record<string, unknown>, base: ElementCommon) => CanvasElement | null> = {
  svg: legacySvgImage
};

/**
 * مواصفة نوع العنصر — مضبوطة النوع. ولا شيء لعنصرٍ بنوعٍ لا يعرفه السجلّ (لم يمرّ بالتقويم): يُتخطّى ولا يُسقط
 * الرسم ولا الحقول — كما كان.
 */
export const kindSpec = <E extends CanvasElement>(el: E): KindSpec<E> | undefined =>
  Object.prototype.hasOwnProperty.call(KINDS, el.kind) ? (KINDS[el.kind] as unknown as KindSpec<E>) : undefined;
