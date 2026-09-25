/**
 * مراجعة الأوراق قبل الطباعة — كما ستخرج من الطابعة، ورقةً ورقة.
 *
 * هي علامات الطباعة نفسها (`sheetsHtml`) مصغّرةً — لا رسمٌ ثانٍ يشبهها — فما
 * يُرى هنا هو ما يُرسَل. والأسماء تُقاس بعد الرسم فتصغر الطويلة كما تصغر هناك.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fitCanvasText } from '@shared/canvasFit';

const toIndic = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);
const PX_PER_MM = 96 / 25.4;

export default function SheetsPreview({
  pages,
  sheet,
  cards,
  busy,
  onClose,
  onPrint,
  onPdf
}: {
  pages: string[];
  sheet: { w: number; h: number };
  cards: number;
  busy: boolean;
  onClose: () => void;
  onPrint: () => void;
  onPdf: () => void;
}) {
  const [at, setAt] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const fit = () => {
      const el = stage.current;
      if (!el) return;
      setScale(Math.min((el.clientWidth - 48) / (sheet.w * PX_PER_MM), (el.clientHeight - 48) / (sheet.h * PX_PER_MM)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [sheet.w, sheet.h]);

  // يُقاس فور الرسم، ثم ثانيةً بعد تحميل الخطّ: خطٌّ يُحمَّل أوّل مرّةٍ هنا (نسخٌ
  // عريض لم يُستعمل قبل) يوسّع الاسم بعد القياس الأوّل فيتجاوز صندوقه بكسلًا.
  useLayoutEffect(() => {
    if (paper.current) fitCanvasText(paper.current);
    void document.fonts.ready.then(() => paper.current && fitCanvasText(paper.current));
  }, [at, pages]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setAt((i) => Math.min(pages.length - 1, i + 1));
      if (e.key === 'ArrowRight') setAt((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pages.length, onClose]);

  const nav = 'w-10 h-10 rounded-full bg-surface-container-lowest hover:bg-surface-container-high flex items-center justify-center disabled:opacity-30';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-inverse-surface/95" data-sheets="">
      <div className="h-16 shrink-0 px-space-lg flex items-center justify-between bg-surface-container-lowest">
        <div className="flex items-center gap-space-md">
          <button className="w-9 h-9 rounded-lg hover:bg-surface-container-high flex items-center justify-center" title="رجوع (Esc)" type="button" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
          <div>
            <div className="font-headline-sm text-headline-sm text-on-surface">مراجعة الأوراق</div>
            <div className="font-label-sm text-label-sm text-on-surface-variant" data-sheets-summary="">
              {toIndic(cards)} {cards === 1 ? 'تصميم' : 'بطاقة'} على {toIndic(pages.length)} ورقة — {toIndic(sheet.w)} × {toIndic(sheet.h)} ملم، بعلامات القصّ
            </div>
          </div>
        </div>
        <div className="flex items-center gap-space-sm">
          <button
            className="h-10 px-space-md rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md flex items-center gap-1.5 disabled:opacity-50"
            data-act="pdf"
            disabled={busy}
            title="للمطبعة أو للإرسال — بمقاس الورقة الحقيقي"
            type="button"
            onClick={onPdf}
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            حفظ PDF
          </button>
          <button
            className="h-10 px-space-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold flex items-center gap-1.5 shadow-md disabled:opacity-50"
            data-act="print-sheets"
            disabled={busy}
            type="button"
            onClick={onPrint}
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            اطبع {toIndic(pages.length)} ورقة
          </button>
        </div>
      </div>

      <div ref={stage} className="flex-1 min-h-0 flex items-center justify-center gap-space-lg">
        <button className={nav} disabled={at === 0} title="السابقة" type="button" onClick={() => setAt((i) => i - 1)}>
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
        <div
          className="shrink-0 bg-white shadow-2xl"
          style={{ width: sheet.w * PX_PER_MM * scale, height: sheet.h * PX_PER_MM * scale }}
        >
          <div
            ref={paper}
            dangerouslySetInnerHTML={{ __html: pages[at] ?? '' }}
            style={{ transform: `scale(${scale})`, transformOrigin: 'top right', width: sheet.w * PX_PER_MM }}
          />
        </div>
        <button className={nav} disabled={at >= pages.length - 1} title="التالية" type="button" onClick={() => setAt((i) => i + 1)}>
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
      </div>
      <div className="h-12 shrink-0 flex items-center justify-center font-label-md text-label-md text-inverse-on-surface tabular">
        ورقة {toIndic(at + 1)} من {toIndic(pages.length)}
      </div>
    </div>
  );
}
