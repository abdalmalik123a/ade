/**
 * معاينة الورقة الأولى في «صفحاتٌ في ورقة» (S27، D178) — بالتخطيط نفسه الذي يُرسم به الملفّ (`@shared/pdfSheets`) ومصغّرات الصفحات كما تُرى:
 * فما يُرى هو ما يُحفظ.
 */
import type { PageRef } from '@shared/pdfEdit';
import { sheetLayout } from '@shared/pdfSheets';

type Props = {
  n: number;
  pages: PageRef[];
  /** مقاس الصفحة الأولى كما تُرى بالنقاط — منه الشبكة. */
  first: { w: number; h: number } | null;
  thumbs: Record<string, string>;
  thumbKey: (r: PageRef) => string;
};

const HEIGHT = 56;

export default function SheetPreview({ n, pages, first, thumbs, thumbKey }: Props) {
  if (n <= 1 || !first || !pages.length) return null;
  const l = sheetLayout(n, first);
  const k = HEIGHT / l.sheet.h;
  return (
    <div className="relative shrink-0 bg-white border border-outline-variant rounded-sm" data-sheet-preview="" style={{ width: l.sheet.w * k, height: HEIGHT }} title="الورقة الأولى كما تُحفظ">
      {pages.slice(0, n).map((p, i) => {
        const c = l.cells[i]!;
        const url = thumbs[thumbKey(p)];
        return url ? (
          <img
            key={p.id}
            alt=""
            className="absolute object-contain"
            src={url}
            style={{ left: c.x * k, top: (l.sheet.h - c.y - c.h) * k, width: c.w * k, height: c.h * k }}
          />
        ) : null;
      })}
    </div>
  );
}
