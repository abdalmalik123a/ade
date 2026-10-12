/**
 * قياس ورقة المحرّر (تقسيمه بعد ١٫٧٫٠) — منقولٌ من `EditorScreen` كما هو: ارتفاع الترويسة وعدد الصفحات من الورقة التي تُطبع،
 * بمحاكاة الطابعة نفسها التي يعرض بها المحرّر صفحاته.
 */
import { useLayoutEffect, useState } from 'react';
import type { MutableRefObject } from 'react';
import { pageMm, type Doc } from '@shared/doc';
import type { LetterheadLayout } from '@shared/letterhead';
import type { Registry } from '@shared/letterDraft';
import { printedPages } from '../../components/pageFlow';

const MM_PX = 96 / 25.4;

export function useSheetMeasure(
  ctx: {
    printRef: MutableRefObject<HTMLDivElement | null>;
    doc: Doc;
    shown: Record<string, string>;
    layout: LetterheadLayout;
    registry: Registry;
  }
) {
  const { printRef, doc, shown, layout, registry } = ctx;

  const [measure, setMeasure] = useState<{ headRatio: number | null; pages: number | null }>({ headRatio: null, pages: null });
  useLayoutEffect(() => {
    const sheet = printRef.current;
    if (!sheet) return;
    const page = pageMm(doc.pageSetup);
    const m = doc.pageSetup.margins;
    const pagePx = page.h * MM_PX;
    const head = sheet.querySelector<HTMLElement>('[data-letterhead]');
    const body = sheet.querySelector<HTMLElement>('[data-body]');
    // الصفحات بمحاكاة الطابعة نفسها التي يعرض بها المحرّر صفحاته (`pageFlow.ts`) — لا بقسمة
    // الارتفاع: تلك لا ترى فاصل الصفحة ولا السطر الذي ينزل وحده.
    const bottomMm = doc.pageSetup.pageNumbers ? Math.max(m.bottom, 14) : m.bottom;
    setMeasure({
      headRatio: head ? head.getBoundingClientRect().height / pagePx : null,
      pages: body
        ? printedPages(sheet, body, {
            pageW: page.w * MM_PX,
            pageH: pagePx,
            top: m.top * MM_PX,
            bottom: bottomMm * MM_PX,
            head: doc.pageSetup.repeatLetterhead ? head : null
          })
        : null
    });
  }, [doc, shown, layout, registry]);

  return { measure };
}
