/**
 * الإخراج: الترتيب على الورق، وأوراق المعاينة، وفاحص ما قبل الطباعة، والطباعة بسجلٍّ يُستأنف، وPDF.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Doc } from '@shared/doc';
import { SCREEN_DPI, type Canvas } from '@shared/canvas';
import { renderCanvasHtml } from '@shared/canvasHtml';
import { impose, parseCardList, planSheets, renderPlan } from '@shared/imposition';
import { designPreflight, lowResIssues, placedDpi, type PreflightIssue } from '@shared/preflight';
import { WATERMARK_PRESETS, tiledWatermark } from '@shared/watermark';
import { errorText } from '../../lib/errors';
import { choosePrinter } from '../../lib/printChoice';
import type { Outcome } from '../../components/OutputBar';

type Inputs = {
  canvas: Canvas;
  doc: Doc;
  effectiveBackDoc: Doc | null;
  cards: Record<string, string>[];
  batchRows: Record<string, string>[];
  unsureCount: number;
  title: string;
  designId: number | null;
  linkedOrder: { id: number; title: string; templateId: number } | null;
  say: (text: string, tone?: 'ok' | 'warn') => void;
  onChanged?: () => void;
  setBusy: (busy: boolean) => void;
  afterReview: 'print' | 'pdf' | null;
  setAfterReview: (what: 'print' | 'pdf' | null) => void;
};

export function useDesignOutput(i: Inputs) {
  const { canvas, doc, effectiveBackDoc, cards, batchRows, title, say, setBusy } = i;
  const [sheetsOpen, setSheetsOpen] = useState(false);
  /**
   * PDF معاينةٍ للزبون (هـ٣): «معاينة — ليست للطباعة» مكرَّرةً فوق كل ورقة، فيوافق
   * عليها ولا يطبعها في غير المكتب. والطباعة نفسها بلا علامة دائمًا.
   */
  const [previewMark, setPreviewMark] = useState(false);

  /** الترتيب على الورق: كم بطاقةً في A4 وأين تُقصّ — من مقاس التصميم ونزفه. */
  const imp = useMemo(() => impose(canvas.size, canvas.bleed), [canvas.size, canvas.bleed]);

  /**
   * خيارات الورق: أوّل خانةٍ فارغة في ورقةٍ استُعمل بعضها، وبطاقاتٌ بعينها
   * تُعاد (ما تلف وحده)، وعمودٌ تُفصل به الرزم (الصفّ والشعبة).
   */
  const [startSlot, setStartSlot] = useState(0);
  const [pickText, setPickText] = useState('');
  const [groupCol, setGroupCol] = useState('');
  const picked = useMemo(() => parseCardList(pickText, cards.length), [pickText, cards.length]);
  const items = useMemo(() => picked ?? cards.map((_, n) => n), [picked, cards]);
  const plan = useMemo(
    () => planSheets(imp, items, { startSlot, groupOf: groupCol ? (n) => cards[n]?.[groupCol]?.trim() || null : undefined }),
    [imp, items, startSlot, groupCol, cards]
  );
  const batchColumns = useMemo(() => Object.keys(batchRows[0] ?? {}), [batchRows]);

  /**
   * أوراق الطباعة بالملّم الحقيقي (٩٦ نقطة/إنش في CSS = الملّم على الورق).
   *
   * كانت تُرسم بـ٣٠٠ نقطة/إنش بكسلاتٍ فتخرج البطاقة بثلاثة أضعاف مقاسها،
   * والدقّة ليست في البكسلات: الخطوط والزخرفة متّجهة، والطابعة ترسمها بدقّتها.
   */
  const pages = useMemo(() => {
    if (!sheetsOpen) return [];
    const draw = (d: Doc) => (n: number) => renderCanvasHtml(d, cards[n]!, { dpi: SCREEN_DPI, missing: 'blank', marks: false });
    const front = renderPlan(imp, plan, draw(doc));
    if (!effectiveBackDoc) return front;
    // الوجه ثم ظهره، وظهره معكوس الأعمدة — فالورقة المقلوبة يقع كلّ ظهرٍ خلف وجهه.
    // والظهر يُملأ بقيم صاحبه أيضًا (رقمه، صفّه) لا بقيمٍ ثابتة.
    const back = renderPlan(imp, plan, draw(effectiveBackDoc), { mirror: true });
    return front.flatMap((p, n) => [p, back[n]!]);
  }, [sheetsOpen, imp, plan, cards, doc, effectiveBackDoc]);

  /**
   * فاحص ما قبل الطباعة: ما يُعرف من التصميم وقيمه، ثم دقّةُ كلّ صورةٍ في موضعها
   * بعد أن تُحمَّل — صورة طالبٍ من هاتفٍ قديم تخرج ضبابيةً في ثلاثين بطاقة.
   */
  const [lowRes, setLowRes] = useState<PreflightIssue[]>([]);
  const issues = useMemo(
    () =>
      sheetsOpen
        ? [
            ...designPreflight(canvas, batchRows.length ? cards : []),
            ...lowRes,
            ...(i.unsureCount ? [{ level: 'warn' as const, text: `${i.unsureCount} اسمًا لم يُعرف جنسه من اسمه — يُسأل عنه قبل الطباعة` }] : [])
          ]
        : [],
    [sheetsOpen, canvas, cards, batchRows.length, lowRes, i.unsureCount]
  );
  useEffect(() => {
    if (!sheetsOpen) return;
    let alive = true;
    const jobs: { label: string; src: string; boxMm: number }[] = [];
    for (const el of canvas.elements) {
      if (el.kind !== 'image') continue;
      const boxMm = el.box.w * canvas.size.w;
      const label = el.ref ?? el.name ?? 'صورة';
      const srcs = el.ref ? cards.map((c) => c[el.ref!] || el.src) : [el.src];
      for (const src of new Set(srcs)) if (src && !src.startsWith('data:image/svg')) jobs.push({ label, src, boxMm });
    }
    void Promise.all(
      jobs.slice(0, 600).map(
        (job) =>
          new Promise<{ label: string; dpi: number } | null>((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ label: job.label, dpi: placedDpi(img.naturalWidth, job.boxMm) });
            img.onerror = () => resolve(null);
            img.src = job.src.startsWith('data:') ? job.src : `diwan://store/${job.src}`;
          })
      )
    ).then((found) => alive && setLowRes(lowResIssues(found.filter((f): f is { label: string; dpi: number } => f !== null))));
    return () => {
      alive = false;
    };
  }, [sheetsOpen, canvas, cards]);

  /**
   * الطباعة: إلى الطابعة المختارة ورقةً ورقة بسجلٍّ على القرص — فإن انقطعت
   * الكهرباء عند الورقة ٢٤ من ٤٥ سُئل المكتب في الإقلاع التالي ويستأنف منها.
   * و«بإعدادات ويندوز» يُفتح حوار النظام والدفعة مهمّةٌ واحدة.
   */
  /** ما خرج آخر مرّة — يقوله شريط الإخراج، و«أعد الطبع» بالطابعة نفسها (المرحلة ٥). */
  const [after, setAfter] = useState<Outcome | null>(null);
  const lastPick = useRef<{ printer: string; system: boolean } | null>(null);

  const print = useCallback(
    async (again?: { printer: string; system: boolean }) => {
      const pick = again ?? (await choosePrinter('designs', { allowSystem: true }));
      if (!pick) return;
      setBusy(true);
      const off = window.diwan.output.onPrintProgress((p) => say(`يُطبع… ${p.sent} من ${p.total} ورقة`));
      try {
        const out = await window.diwan.output.printJob({
          label: title.trim() || 'تصميم',
          pages,
          printer: pick.system ? null : pick.printer,
          page: imp.sheet,
          duplex: Boolean(effectiveBackDoc)
        });
        const sheets = effectiveBackDoc ? pages.length / 2 : pages.length;
        // الطلب يتبع الطباعة (د٨): طُبعت دفعته كلّها فصار جاهزًا للتسليم — ويُقال ذلك.
        let orderNote = '';
        if (out.ok && i.linkedOrder && i.linkedOrder.templateId === i.designId) {
          const order = await window.diwan.orders.get(i.linkedOrder.id);
          if (order && order.status !== 'ready' && order.status !== 'delivered' && order.status !== 'cancelled') {
            await window.diwan.orders.setStatus(order.id, 'ready');
            orderNote = ` — والطلب «${order.title}» صار جاهزًا للتسليم`;
            i.onChanged?.();
          }
        }
        if (out.ok) {
          // تُغلق المعاينة ويقول شريط الإخراج ما خرج وأين — والطلب إن صار جاهزًا.
          lastPick.current = { printer: pick.printer, system: pick.system };
          setSheetsOpen(false);
          setAfter({ what: `${sheets} ورقة${effectiveBackDoc ? ' بوجهيها' : ''}`, printer: pick.system ? 'طابعة ويندوز' : pick.printer });
          if (orderNote) say(orderNote.replace(/^ — و/, ''));
        } else
          say(
            `توقّفت الطباعة بعد ${out.sent} من ${out.total} ورقة${out.reason ? ` — ${out.reason}` : ''}${out.journaled ? '؛ تُستأنف من شريط الطباعة' : ''}`,
            'warn'
          );
      } catch (e) {
        say(errorText(e, 'تعذّرت الطباعة'), 'warn');
      } finally {
        off();
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pages, imp, effectiveBackDoc, title, say, i.linkedOrder, i.designId, i.onChanged]
  );

  const savePdf = useCallback(async () => {
    setBusy(true);
    try {
      const path = await window.diwan.output.savePdf({
        sheetHtml: previewMark
          ? pages
              .map((p) => `<div style="position:relative;break-inside:avoid">${p}${tiledWatermark({ text: WATERMARK_PRESETS.preview, opacity: 0.2, sizeMm: 9 })}</div>`)
              .join('')
          : pages.join(''),
        suggestedName: title.trim() || 'تصميم',
        page: imp.sheet
      });
      if (path) say('حُفظ PDF بمقاس الورقة وعلامات القصّ');
    } catch (e) {
      say(errorText(e, 'تعذّر حفظ PDF'), 'warn');
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, title, imp, say, previewMark]);

  // حُسمت الأسماء: تُطبع الدفعة بأجناسها الجديدة — بعد أن تُعاد بطاقاتها وأوراقها.
  const { afterReview, setAfterReview } = i;
  useEffect(() => {
    if (!afterReview) return;
    const what = afterReview;
    setAfterReview(null);
    void (what === 'print' ? print() : savePdf());
  }, [afterReview, print, savePdf, setAfterReview]);

  return {
    imp, sheetsOpen, setSheetsOpen, previewMark, setPreviewMark, startSlot, setStartSlot, pickText, setPickText, groupCol, setGroupCol,
    picked, items, batchColumns, pages, issues, after, setAfter, lastPick, print, savePdf
  };
}
