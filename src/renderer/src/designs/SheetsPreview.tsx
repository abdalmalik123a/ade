/**
 * مراجعة الأوراق قبل الطباعة — كما ستخرج من الطابعة، ورقةً ورقة.
 *
 * هي علامات الطباعة نفسها (`renderPlan`) مصغّرةً — لا رسمٌ ثانٍ يشبهها — فما
 * يُرى هنا هو ما يُرسَل. والأسماء تُقاس بعد الرسم فتصغر الطويلة كما تصغر هناك.
 *
 * واللوح بترتيب الحاجة (محادثة «التصاميم»، البند ١٤): الفحص ظاهرٌ والتحذيرات أوّله، وخيارات الورق — لما يقع أحيانًا (ورقةٌ
 * استُعمل بعضها، وبطاقةٌ تلفت، ورزمٌ مفروزة، وPDF معاينةٍ للزبون) — مطويّةٌ تحت اسمها، وتنفتح وحدها إن كان فيها خيارٌ مفعّل.
 * وكانت كلّها في لوحٍ واحد كثيف.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { fitCanvasText } from '@shared/design/fit';
import type { PreflightIssue } from '@shared/preflight';
import { count, countIn } from '@shared/arabic';

const toIndic = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);
const PX_PER_MM = 96 / 25.4;

/**
 * ما لا يُعرف إلا بالخطّ الحقيقي: اسمٌ صغُر دون ٦٠٪ من حجمه (يُقرأ بصعوبة)، ونصٌّ
 * لا يصغر فاض عن صندوقه فقُصّ.
 */
function measure(root: HTMLElement): PreflightIssue[] {
  const out: PreflightIssue[] = [];
  let shrunk = 0;
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-fit]'))) {
    const max = parseFloat(el.dataset.fit || '0');
    const now = parseFloat(el.style.fontSize || '0');
    if (max && now && now < max * 0.6) shrunk++;
  }
  if (shrunk) out.push({ level: 'info', text: `${toIndic(shrunk)} نصًّا في هذه الورقة صغُر دون ٦٠٪ من حجمه ليسع — راجع قراءته` });
  let overflow = 0;
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('[dir]'))) {
    if (el.dataset.fit !== undefined) continue;
    if (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) overflow++;
  }
  if (overflow) out.push({ level: 'warn', text: `${toIndic(overflow)} نصًّا في هذه الورقة فاض عن صندوقه فقُصّ` });
  return out;
}

export default function SheetsPreview({
  pages,
  sheet,
  cards,
  duplex = false,
  unit = 'بطاقة',
  busy,
  onClose,
  onPrint,
  onPdf,
  issues = [],
  options,
  optionsActive = false
}: {
  pages: string[];
  sheet: { w: number; h: number };
  cards: number;
  /** الصفحات وجهٌ ثم ظهرٌ بالتناوب — فالورقة صفحتان. */
  duplex?: boolean;
  /** ما في الخانة: بطاقة، أو صورة. */
  unit?: string;
  busy: boolean;
  onClose: () => void;
  onPrint: () => void;
  onPdf: () => void;
  /** ما وجده الفاحص في التصميم وقيمه — يُنبَّه به ولا يمنع. */
  issues?: PreflightIssue[];
  /** خيارات الطباعة تُعرض في اللوح الجانبي (البدء من خانة، والفواصل…). */
  options?: ReactNode;
  /** في الخيارات ما فُعِّل — فتنفتح ولا يُخفى ما يغيّر الأوراق. */
  optionsActive?: boolean;
}) {
  const [at, setAt] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  /** ما يُقاس بعد الرسم في الورقة المعروضة: اسمٌ صغُر كثيرًا، ونصٌّ فاض. */
  const [measured, setMeasured] = useState<PreflightIssue[]>([]);

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
    void document.fonts.ready.then(() => {
      if (!paper.current) return;
      fitCanvasText(paper.current);
      setMeasured(measure(paper.current));
    });
  }, [at, pages]);

  // التحذيرات أوّلًا — ما يُفسد الورقة قبل ما يحسن أن يُعرف.
  const all = [...issues, ...measured].sort((a, b) => Number(b.level === 'warn') - Number(a.level === 'warn'));
  const [optionsOpen, setOptionsOpen] = useState(optionsActive);
  useEffect(() => {
    if (optionsActive) setOptionsOpen(true);
  }, [optionsActive]);

  // خيارات الورق تُنقص الأوراق — فلا تبقى المعاينة على ورقةٍ لم تعد موجودة.
  useEffect(() => {
    if (at >= pages.length) setAt(0);
  }, [at, pages.length]);

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
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex flex-col bg-inverse-surface/95" data-sheets="">
      <div className="h-16 shrink-0 px-space-lg flex items-center justify-between bg-surface-container-lowest">
        <div className="flex items-center gap-space-md">
          <button className="w-9 h-9 rounded-btn hover:bg-surface-container-high flex items-center justify-center" title="رجوع (Esc)" type="button" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
          <div>
            <div className="font-headline-sm text-headline-sm text-on-surface">مراجعة الأوراق</div>
            <div className="font-label-sm text-label-sm text-on-surface-variant" data-sheets-summary="">
              {unit === 'بطاقة' ? (cards === 1 ? 'تصميم واحد' : count(cards, 'بطاقة')) : unit === 'صورة' ? count(cards, 'صورة') : `${toIndic(cards)} ${unit}`} على {countIn(duplex ? pages.length / 2 : pages.length, 'ورقة')}
              {duplex ? ' بوجهين' : ''} — {toIndic(sheet.w)} × {toIndic(sheet.h)} ملم، بعلامات القصّ
            </div>
          </div>
        </div>
        <div className="flex items-center gap-space-sm">
          <button
            className="h-10 px-space-md rounded-btn bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md flex items-center gap-1.5 disabled:opacity-50"
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
            className="h-10 px-space-lg btn-act font-label-md text-label-md font-semibold flex items-center gap-1.5 disabled:opacity-50"
            data-act="print-sheets"
            disabled={busy}
            type="button"
            onClick={onPrint}
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            اطبع {countIn(duplex ? pages.length / 2 : pages.length, 'ورقة')}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex">
      <aside className="w-80 shrink-0 overflow-y-auto bg-surface-container-lowest border-l border-outline-variant p-space-md flex flex-col gap-space-md" data-preflight="">
        <section className="flex flex-col gap-space-xs">
          <div className="flex items-center gap-1.5 font-label-lg text-label-lg text-on-surface font-semibold" title="الفاحص يُنبّه ولا يمنع — والقياس بالخطّ الحقيقي للورقة المعروضة">
            <span className={`material-symbols-outlined text-[20px] ${all.some((i) => i.level === 'warn') ? 'text-error' : 'text-secondary'}`}>
              {all.length ? 'report' : 'verified'}
            </span>
            فحصٌ قبل الطباعة
          </div>
          {all.length === 0 ? (
            <span className="font-label-md text-label-md text-on-surface-variant">لا ملاحظات — الدقّة والحوافّ والقيم سليمة.</span>
          ) : (
            <ul className="flex flex-col gap-1">
              {all.map((issue, i) => (
                <li
                  key={i}
                  className={`px-2 py-1.5 rounded-card font-label-sm text-label-sm leading-5 ${
                    issue.level === 'warn' ? 'bg-error-container text-on-error-container' : 'bg-surface-container text-on-surface'
                  }`}
                  data-issue={issue.level}
                >
                  {issue.text}
                </li>
              ))}
            </ul>
          )}
        </section>
        {options && (
          <details
            className="rounded-card border border-outline-variant/70 open:pb-space-sm"
            data-options-box={optionsOpen ? 'open' : 'closed'}
            open={optionsOpen}
            onToggle={(e) => setOptionsOpen((e.currentTarget as HTMLDetailsElement).open)}
          >
            <summary className="px-space-sm py-space-xs cursor-pointer flex flex-col gap-0.5">
              <span className="font-label-lg text-label-lg text-on-surface font-semibold">خيارات الورق</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                لورقةٍ استُعمل بعضها، أو بطاقةٍ تلفت فتُعاد، أو رزمٍ مفروزة، أو PDF معاينةٍ للزبون
              </span>
            </summary>
            <div className="px-space-sm pt-space-xs flex flex-col gap-space-md">{options}</div>
          </details>
        )}
      </aside>
      <div ref={stage} className="flex-1 min-h-0 flex items-center justify-center gap-space-lg">
        <button className={nav} disabled={at === 0} title="السابقة" type="button" onClick={() => setAt((i) => i - 1)}>
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
        <div
          className="shrink-0 bg-white shadow-card"
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
      </div>
      <div className="h-12 shrink-0 flex items-center justify-center font-label-md text-label-md text-inverse-on-surface tabular">
        {duplex
          ? `ورقة ${toIndic(Math.floor(at / 2) + 1)} من ${toIndic(pages.length / 2)} — ${at % 2 ? 'الظهر (معكوس)' : 'الوجه'}`
          : `ورقة ${toIndic(at + 1)} من ${toIndic(pages.length)}`}
      </div>
    </div>
  );
}
