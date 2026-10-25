/**
 * كتلة الصورة في الورقة — ومعها حقل الصورة (S38، DC-2): صورةٌ مربوطةٌ بحقلٍ تُملأ عند كلّ ورقة.
 *
 * - **الصورة الثابتة** (شعارٌ أو صورةٌ من الجهاز): مسارها في الكتلة كما كانت.
 * - **وحقل الصورة**: قيمة الحقل (مسارٌ في المخزن — صورة الزبون من ملفّه أو من الجهاز) تسبق ما في الكتلة؛
 *   والمملوء يحمل `fv` فيظهر في «القيم وحدها» على الاستمارة المطبوعة مسبقًا كما يظهر الحقل النصّيّ.
 * - **والفارغ** إطارٌ رفيعٌ بمقاسه يُطبع — مكانًا لصورةٍ تُلصق باليد — كما يطبع الحقل النصّيّ فراغه.
 *
 * منفصلٌ عن `docHtml.ts` لسقف حجمه؛ ويناديه `renderBlock` نفسه، فالمعاينة والطباعة وPDF رسمٌ واحد.
 */
import type { ImageBlock } from './docTypes';
import { escapeHtml } from './html';

export function imageBlockHtml(block: ImageBlock, values: Record<string, string>): string {
  // محاذاةٌ فيزيائية لا منطقية: `flex-start` ينقلب في الورقة العربية فيقع
  // الختمُ المقصود يسارًا في اليمين. و`text-align:left` يسارٌ في كل اتجاه.
  const align = block.align === 'justify' ? 'center' : block.align;
  const filled = block.field ? values[block.field]?.trim() : '';
  const path = filled || block.src;
  const height = block.height ? `height:${block.height}px;` : '';
  const cls = filled ? ' class="fv"' : '';
  if (!path && block.field) {
    const h = block.height ?? block.width;
    return (
      `<div data-image-field="${escapeHtml(block.field)}" style="text-align:${align};break-inside:avoid">` +
      `<span style="display:inline-block;box-sizing:border-box;width:${block.width}px;height:${h}px;max-width:100%;border:1px solid currentColor;opacity:.35"></span></div>`
    );
  }
  const src = path ? `diwan://store/${escapeHtml(path)}` : '';
  // وصورة الحقل تُحصر في إطاره بنسبتها (`contain`) — صورة الزبون كما في ملفّه، لا تُمطّ ولا تُقصّ (ر023).
  const fit = block.field ? ';object-fit:contain' : '';
  return `<div${cls} style="text-align:${align};break-inside:avoid"><img alt="" src="${src}" style="display:inline-block;width:${block.width}px;${height}max-width:100%${fit}"/></div>`;
}
