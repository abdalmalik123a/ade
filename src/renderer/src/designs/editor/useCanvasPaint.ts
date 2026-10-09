/**
 * ما يُرسم بعد حقن اللوحة في الشاشة: الباركود ورموزه، وتصغير الأسماء الطويلة لتسع.
 */
import { useEffect, useRef } from 'react';
import { drawCode } from '@shared/design/imposition';
import { NOT_128 } from '@shared/barcode';
import { fitCanvasText } from '@shared/design/fit';

/**
 * الباركود يُرسم بعد الحقن.
 *
 * فمحرّك الرسم يترك موضعه وقيمته فحسب — ولو بنى الـSVG بنفسه لصار على
 * `shared/canvasHtml.ts` أن يعرف Code128 وQR، وهو رسّامٌ لا مُرمِّز.
 */
export function useCanvasPaint(html: string, preview: boolean) {
  const paintRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = paintRef.current;
    if (!root) return;
    for (const node of root.querySelectorAll<HTMLElement>('[data-barcode]')) {
      const value = node.dataset.value ?? '';
      const kind = node.dataset.barcode ?? '';
      if (!value) {
        // لا قيمة بعد (حقلٌ لم يُملأ): عيّنةٌ باهتة في التحرير فيُرى موضع الرمز وحجمه —
        // كان الصندوق يبقى فارغًا فيُظنّ أن الباركود لم يُنشأ. وفي «المعاينة» لا شيء:
        // المعاينة ما سيُطبع، ولا يُطبع رمزٌ بقيمةٍ مخترعة.
        node.innerHTML = preview ? '' : `<div style="opacity:.3;width:100%;height:100%">${drawCode(kind, '0000000000')}</div>`;
        continue;
      }
      try {
        node.innerHTML = drawCode(kind, value);
      } catch {
        // قيمةٌ لا تُرمَّز (حروفٌ عربية في Code128): كانت تُترك فارغةً فيُظنّ الباركود
        // مطبوعًا — فتُقال في موضعه، وفاحص ما قبل الطباعة يعدّ بطاقاتها.
        node.innerHTML =
          '<div data-barcode-error="" style="width:100%;height:100%;box-sizing:border-box;border:1.5px dashed #b3261e;color:#b3261e;' +
          'display:flex;align-items:center;justify-content:center;text-align:center;font:600 7pt/1.2 sans-serif;padding:1mm">' +
          `${NOT_128}</div>`;
      }
    }
    // الأسماء الطويلة تصغر لتسع — بعد الرسم وبعد تحميل الخطوط.
    fitCanvasText(root);
    void document.fonts.ready.then(() => paintRef.current && fitCanvasText(paintRef.current));
  }, [html, preview]);
  return paintRef;
}
