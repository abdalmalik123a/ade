/**
 * نوع العنصر وحدةٌ مستقلّة (DESIGNS.md ٣٫٣): كلّ نوعٍ يعرّف نفسه في ملفّه — تقويمه، ورسمه، وما يستعمله من حقول،
 * ونصّه للبحث — والسجلّ (`registry.ts`) سطرٌ له. فإضافة نوعٍ ملفٌّ جديد وسطرٌ ولقطةٌ واختبار، ولا تمسّ غيره.
 */
import type { DocField } from '../../doc';
import type { MissingMode } from '../../docHtml';
import type { Canvas, CanvasElement, ElementBase } from '../model/types';

/** خيارات الرسم بعد افتراضها. */
export type RenderOpts = { dpi: number; missing: MissingMode; marks: boolean };

/** ما يحتاجه رسم عنصر: لوحته وقيمها وحقولها، والخيارات، وعنوان الصور. */
export type RenderCtx = {
  canvas: Canvas;
  values: Record<string, string>;
  fields: Map<string, DocField>;
  opts: RenderOpts;
  url: (src: string) => string;
};

/** ما يشترك فيه كلّ عنصرٍ بعد تقويمه — ويقوّمه النموذج قبل أن يصل النوع. */
export type ElementCommon = Pick<ElementBase, 'id' | 'box' | 'z' | 'name' | 'locked' | 'rotate'> & { dir: 'rtl' | 'ltr' };

export type KindSpec<E extends CanvasElement> = {
  kind: E['kind'];
  /** القديم والتالف يُقبل ولا يُسقط شيئًا: المشترك مقوَّم في `base`، وهنا ما يخصّ النوع. */
  normalize(raw: Record<string, unknown>, base: ElementCommon): E | null;
  /** العنصر علاماتٍ في موضعه — للشاشة والطباعة معًا. */
  render(el: E, ctx: RenderCtx): string;
  /** مفاتيح الحقول التي يستعملها — للدمج والدفعات والفحص قبل الطباعة. */
  keys(el: E): string[];
  /** أسطره نصًّا للبحث والبصمة — ولا شيء لما لا نصّ فيه. */
  text?(el: E, values: Record<string, string>): string[];
};
