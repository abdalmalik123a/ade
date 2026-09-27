/**
 * ورقة الكتاب كما تُطبع — للشبّاك والمحرّر معًا، فلا تختلف ورقةٌ عن ورقة.
 *
 * ترويسةٌ ومتنٌ وعلامةٌ مائية في عنصرٍ واحد (FOUNDATION §٣: الورقة عنصرٌ واحد
 * والطابعة تقسمها). وما يُطبع هو علامات هذه الورقة نفسها — يُنسخ عنصرها ويُرسل.
 *
 * **والصفحات**: هوامش الورقة العليا والسفلى تُعلن `@page` في الطباعة لا حشوًا في
 * العنصر — فالصفحة الثانية من كتابٍ طويل تبدأ بهامشها لا عند حافّة الورق (كان
 * الحشو يقع في أول الورقة وآخرها وحدهما). ومنه **ترقيم الصفحات** في هامشها السفلي،
 * و**تكرار الترويسة** رأسَ جدولٍ تعيده الطابعة في كل صفحة.
 */
import type { CSSProperties } from 'react';
import type { Doc } from '@shared/doc';
import { pageMm } from '@shared/doc';
import { pageCss, renderDocHtml, watermarkHtml } from '@shared/docHtml';
import type { LetterheadLayout } from '@shared/letterhead';
import LetterheadView from './LetterheadView';

/**
 * الفراغ فاصلٌ عن الترويسة المبنيّة. وبلا ترويسة يُنزل الورقة كلّها عن موضعها
 * في Word — وكذا رأسٌ فُصل من ورقة: فراغه معه في كتله.
 */
export function gapAfter(layout: LetterheadLayout | null): boolean {
  return Boolean(layout && !layout.sheet?.length);
}

/**
 * الورقة بمقاس الوثيقة وهوامشها — كما رُسمت في المصمّم.
 *
 * والنمط مضمَّنٌ لا صنفًا: الورقة تُنسخ علاماتٍ إلى نافذة الطباعة، والعلامة
 * المائية تحتاج ورقةً «relative/isolate» لتقع خلف المتن.
 */
export function sheetStyle(doc: Doc): CSSProperties {
  const page = pageMm(doc.pageSetup);
  const m = doc.pageSetup.margins;
  return {
    width: `${page.w}mm`,
    minHeight: `${page.h}mm`,
    paddingTop: `${m.top}mm`,
    paddingRight: `${m.right}mm`,
    paddingBottom: `${m.bottom}mm`,
    paddingLeft: `${m.left}mm`,
    position: 'relative',
    isolation: 'isolate'
  };
}

export type LetterSheetProps = {
  doc: Doc;
  layout: LetterheadLayout | null;
  values: Record<string, string>;
  /** العدد والتاريخ في سطر الترويسة — ما أعطاه الزبون وتاريخ اليوم. */
  registry?: { number: string; date: string };
  /** حقول الترويسة التلقائية ({التاريخ_الميلادي}…). */
  resolve?: (value: string) => string;
  className?: string;
  sheetRef?: (el: HTMLDivElement | null) => void;
};

export default function LetterSheet({ doc, layout, values, registry, resolve, className = '', sheetRef }: LetterSheetProps) {
  // `data-letterhead`: به يُقاس ارتفاع الترويسة من الورقة في قائمة التحقّق.
  const head = layout ? (
    <div data-letterhead="">
      <LetterheadView layout={layout} registryValues={registry} resolve={resolve} />
    </div>
  ) : null;
  const body = (
    <div
      className={`${gapAfter(layout) ? 'mt-space-md ' : ''}font-body-md text-body-md leading-8`}
      data-body=""
      dangerouslySetInnerHTML={{ __html: renderDocHtml(doc, values, { missing: 'blank', paragraphs: 'blocks' }) }}
    />
  );
  return (
    <div ref={sheetRef} className={`a4-sheet bg-white text-black shadow-lg ${className}`} data-letter-sheet="" style={sheetStyle(doc)}>
      <style>{pageCss(doc)}</style>
      <div dangerouslySetInnerHTML={{ __html: watermarkHtml(doc) }} />
      {doc.pageSetup.repeatLetterhead && head ? (
        // رأس جدولٍ تعيده الطابعة في أعلى كل صفحة — والشاشة ترى ورقةً واحدة كما هي.
        <table style={{ width: '100%', borderCollapse: 'collapse' }} data-repeat-head="">
          <thead>
            <tr>
              <td style={{ padding: 0 }}>{head}</td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: 0 }}>{body}</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <>
          {head}
          {body}
        </>
      )}
    </div>
  );
}
