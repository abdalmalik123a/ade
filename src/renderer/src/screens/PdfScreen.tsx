/**
 * «ملفات PDF» — محرّر PDF للتقديم الإلكتروني.
 *
 * ما يفعله المكتب يوميًّا بملفّات المنصّات (أور، مظلتي، الجامعات): يضيف نصًّا أو شعارًا أو
 * علامةً مائية أو رقم الصفحة، ويقصّ ويجزّئ ويدمج ويرتّب، ويمسح من الماسح — بلا إنترنت، فلا
 * تُرفع مستمسكات الناس إلى مواقع مجهولة. والصفحات تُرسم هنا (pdf.js)، والملف يُبنى في
 * العملية الرئيسة من الخطّة (`@shared/pdfEdit`)، والنصّ العربي يرسمه محرّك الطباعة موصولًا
 * ويبقى نصًّا.
 *
 * و«حدّ الحجم» لخانة الرفع: ما تجاوزه تصير صفحاته صورًا بأجود درجةٍ تبلغه — الملف والصور.
 * والحفظ ملفٌّ جديد دائمًا: الأصل يبقى كما وصل (قرار المالك).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  overlaysFor,
  type FracBox,
  type ImageOverlay,
  type Overlay,
  type PageRef,
  type PdfPlan,
  type TextOverlay
} from '@shared/pdfEdit';
import { useLeaveGuard } from '../kit/useLeaveGuard';
import { rememberLimit, savedLimit } from '../lib/fitImage';
import { shownPt, type Src, type Drag, type PdfIncoming } from './pdf/pdfPages';
import PdfToolbar from './pdf/PdfToolbar';
import PdfEmpty from './pdf/PdfEmpty';
import PagesRail from './pdf/PagesRail';
import PageStage from './pdf/PageStage';
import PropsPanel from './pdf/PropsPanel';
import PdfOutputBar from './pdf/PdfOutputBar';
import LogoPicker from './pdf/LogoPicker';
import { usePdfHistory } from './pdf/usePdfHistory';
import { usePdfOpen } from './pdf/usePdfOpen';
import { usePdfThumbs } from './pdf/usePdfThumbs';
import { usePdfPageOps } from './pdf/usePdfPageOps';
import { usePdfAdditions } from './pdf/usePdfAdditions';
import { usePdfDrag } from './pdf/usePdfDrag';
import { usePdfOutput } from './pdf/usePdfOutput';

/** ملفّاتٌ فتحها الشبّاك من «الملفّات» — نوعها في `pdf/pdfPages.ts`. */
export type { PdfIncoming } from './pdf/pdfPages';

export default function PdfScreen({ incoming = null }: { incoming?: PdfIncoming | null } = {}) {
  const [sources, setSources] = useState<Record<string, Src>>({});
  const [pages, setPages] = useState<PageRef[]>([]);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [crop, setCrop] = useState<FracBox | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'warn' } | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [view, setView] = useState<{ url: string; w: number; h: number } | null>(null);
  const [logoPicker, setLogoPicker] = useState<string[] | null>(null);
  const [splitText, setSplitText] = useState<string | null>(null);
  const [limit, setLimitState] = useState(() => savedLimit());
  const [gray, setGray] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);
  const drag = useRef<Drag | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;

  // إغلاق مصادر PDF في النواة عند مغادرة الشاشة (E02)
  useEffect(() => {
    return () => {
      const ids = Object.keys(sourcesRef.current);
      if (ids.length) void window.diwan.pdf.close(ids);
    };
  }, []);

  const say = useCallback((text: string, tone: 'ok' | 'warn' = 'ok') => {
    window.clearTimeout(toastTimer.current);
    setToast({ text, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);

  function setLimit(bytes: number) {
    setLimitState(bytes);
    rememberLimit(bytes);
  }

  const plan = useMemo<PdfPlan>(() => ({ pages, overlays }), [pages, overlays]);
  const currentRef = pages.find((p) => p.id === current) ?? null;
  const currentIndex = pages.findIndex((p) => p.id === current);
  const targets = selected.length ? selected : current ? [current] : [];

  // ── التراجع والإعادة ────────────────────────────────────────────────
  // ── التراجع والإعادة، وما لم يُخرَج منه (ج٣) — `pdf/usePdfHistory.ts` ──
  const { latest, baselinePending, past, future, restoring, committed, setBaseline, unsaved, redo, undo, canUndo, canRedo } = usePdfHistory({
    pages, overlays, setPages, setOverlays, setSelected, setCurrent, setActive, setCrop
  });

  // ── الفتح والدمج والمسح ─────────────────────────────────────────────
  // ── الفتح والدمج والمسح — `pdf/usePdfOpen.ts` ──
  const { reset, open, scan } = usePdfOpen({
    latest, baselinePending, setSources, setPages, setCurrent, name, setName, incoming, say, setBusy, sources, past, future,
    restoring, committed, setOverlays, setSelected, setActive, setCrop, setThumbs, setView
  });

  // ── الرسم: المصغّرات، والصفحة الحالية ───────────────────────────────
  // ── الرسم: المصغّرات، والصفحة الحالية — `pdf/usePdfThumbs.ts` ──
  const { thumbKey } = usePdfThumbs({ pages, thumbs, sources, setThumbs, currentRef, setView, crop, stage, current });

  // ── عمليات الصفحات ──────────────────────────────────────────────────
  // ── عمليات الصفحات: التدوير والحذف والترتيب والسحب والتكرار — `pdf/usePdfPageOps.ts` ──
  const { rotate, move, duplicate, remove, dragPage, dropPage } = usePdfPageOps({
    setPages, targets, pages, setOverlays, setSelected, setCurrent, say
  });

  // ── الإضافة: نصّ، وشعار، وعلامة مائية ──────────────────────────────
  // ── الإضافة: النصّ والعلامة المائية والاستمارة والترقيم والشعار — `pdf/usePdfAdditions.ts` ──
  const { addText, openLogos, addWatermark, addNumbers, formFilled, formCitizen, formQuery, setFormCitizen, setFormQuery, formHits, setFormHits, fillForm, placeLogo, logoFromDevice } = usePdfAdditions({
    current, setOverlays, setActive, sources, pages, say, overlays, setLogoPicker
  });

  const activeOverlay = overlays.find((o) => o.id === active) ?? null;
  const patch = (id: string, p: Partial<TextOverlay> | Partial<ImageOverlay>) =>
    setOverlays((os) => os.map((o) => (o.id === id ? ({ ...o, ...p } as Overlay) : o)));

  // ── السحب: نقل العنصر وتكبيره، وصندوق القصّ ────────────────────────
  // ── السحب والقصّ — `pdf/usePdfDrag.ts` ──
  const { startCrop, onPointerMove, startDrag, applyCrop } = usePdfDrag({
    drag, setActive, view, setCrop, patch, currentRef, crop, targets, setPages
  });

  // ── الحفظ ────────────────────────────────────────────────────────────
  // ── الحفظ والإخراج: بحدّ الحجم، وإلى ملفّ الزبون، والاستخراج والتقسيم والصور — `pdf/usePdfOutput.ts` ──
  const { saveAs, extract, toImages, save, nav, toCustomer, split } = usePdfOutput({
    setBusy, setBaseline, latest, say, gray, limit, plan, name, targets, pages, overlays, setSplitText, selected
  });

  const leave = useLeaveGuard({
    label: 'ملف PDF',
    dirty: unsaved,
    save: async () => Boolean(await saveAs(plan, name || 'ملف معدّل'))
  });

  /** «أغلق الملف وابدأ من جديد»: يمحو الجلسة، فيُسأل عمّا لم يُحفظ أوّلًا. */
  async function startOver() {
    if (!(await leave())) return;
    reset();
  }

  // ── لوحة المفاتيح: Delete يحذف العنصر المحدَّد، وCtrl+Z يتراجع ─────
  // (ما في الدالّتين مراجعُ وضوابطُ حالة — فلا يضرّها أن تكون من رسمٍ سابق.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (e.ctrlKey && (e.code === 'KeyZ' || e.code === 'KeyY')) {
        e.preventDefault();
        if (e.code === 'KeyY' || e.shiftKey) redo();
        else undo();
        return;
      }
      if (e.key === 'Delete' && active) {
        setOverlays((os) => os.filter((o) => o.id !== active));
        setActive(null);
      }
      if (e.key === 'Escape') {
        setActive(null);
        setCrop(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // `undo` و`redo` تقرآن من مراجع (`past` و`future`) — فالقديمة منهما صحيحة
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const btn = 'h-9 px-space-sm rounded-btn bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md flex items-center gap-1 disabled:opacity-40';
  const hasDoc = pages.length > 0;
  const pageOverlays = currentRef ? overlaysFor(plan, currentRef.id) : [];
  const pt = currentRef && sources[currentRef.source] ? shownPt(sources[currentRef.source]!, currentRef) : null;
  const pxPerPt = view && pt ? view.w / pt.w : 1;

  return (
    <main className="relative pt-16 bg-surface min-h-screen w-full" data-screen="pdf">
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* ── الشريط ─────────────────────────────────────────────── */}
        <PdfToolbar
          btn={btn}
          open={open}
          hasDoc={hasDoc}
          scan={scan}
          canUndo={canUndo}
          undo={undo}
          canRedo={canRedo}
          redo={redo}
          current={current}
          addText={addText}
          openLogos={openLogos}
          addWatermark={addWatermark}
          addNumbers={addNumbers}
          startCrop={startCrop}
          targets={targets}
          extract={extract}
          setSplitText={setSplitText}
          toImages={toImages}
          startOver={startOver}
        />

        {!hasDoc ? (
          <PdfEmpty
            open={open}
            scan={scan}
          />
        ) : (
          <div className="flex-1 min-h-0 flex">
            {/* ── الصفحات ─────────────────────────────────────────── */}
            <PagesRail
              targets={targets}
              rotate={rotate}
              move={move}
              duplicate={duplicate}
              remove={remove}
              pages={pages}
              selected={selected}
              setSelected={setSelected}
              current={current}
              setCurrent={setCurrent}
              setCrop={setCrop}
              dragPage={dragPage}
              dropPage={dropPage}
              thumbs={thumbs}
              thumbKey={thumbKey}
            />

            {/* ── الصفحة ──────────────────────────────────────────── */}
            <PageStage
              stage={stage}
              setActive={setActive}
              onPointerMove={onPointerMove}
              drag={drag}
              view={view}
              currentRef={currentRef}
              crop={crop}
              pageOverlays={pageOverlays}
              active={active}
              startDrag={startDrag}
              pxPerPt={pxPerPt}
              currentIndex={currentIndex}
              pages={pages}
            />

            {/* ── الخصائص ─────────────────────────────────────────── */}
            <PropsPanel
              crop={crop}
              btn={btn}
              applyCrop={applyCrop}
              selected={selected}
              currentRef={currentRef}
              setCrop={setCrop}
              activeOverlay={activeOverlay}
              patch={patch}
              current={current}
              setOverlays={setOverlays}
              setActive={setActive}
              sources={sources}
              formFilled={formFilled}
              formCitizen={formCitizen}
              formQuery={formQuery}
              setFormCitizen={setFormCitizen}
              setFormQuery={setFormQuery}
              formHits={formHits}
              setFormHits={setFormHits}
              fillForm={fillForm}
            />
          </div>
        )}
        {hasDoc && (
          <PdfOutputBar
            limit={limit}
            setLimit={setLimit}
            gray={gray}
            setGray={setGray}
            name={name}
            setName={setName}
            save={save}
            nav={nav}
            btn={btn}
            toCustomer={toCustomer}
          />
        )}
      </div>

      {logoPicker && (
        <LogoPicker
          setLogoPicker={setLogoPicker}
          logoPicker={logoPicker}
          placeLogo={placeLogo}
          btn={btn}
          logoFromDevice={logoFromDevice}
        />
      )}

      {splitText !== null && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim/50" data-pdf-split-dialog="" onClick={() => setSplitText(null)}>
          <div className="w-[480px] rounded-card bg-surface-container-lowest p-space-md flex flex-col gap-space-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-headline-sm text-headline-sm">قسّم الملف</h2>
            <p className="font-label-md text-label-md text-on-surface-variant">
              اكتب المجموعات مفصولةً بـ«؛» — مثل <b dir="ltr">1-3؛ 4-6؛ 7</b> — فتصير كلٌّ منها ملفًّا. واتركها فارغةً لتصير كلّ صفحةٍ ملفًّا.
            </p>
            <input
              autoFocus
              className="h-10 px-2 rounded-field bg-surface-container-low border border-outline-variant"
              data-pdf-split=""
              dir="ltr"
              value={splitText}
              onChange={(e) => setSplitText(e.target.value)}
            />
            <button className="h-10 btn-act font-label-md text-label-md font-semibold" data-act="pdf-split-go" type="button" onClick={() => void split(splitText)}>
              قسّم واحفظ في مجلّد
            </button>
          </div>
        </div>
      )}

      {busy && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-center justify-center bg-scrim/30" data-pdf-busy="">
          <div className="rounded-card bg-surface-container-lowest px-space-lg py-space-md shadow-card flex items-center gap-2 font-label-md text-label-md">
            <span className="material-symbols-outlined animate-spin">progress_activity</span>
            {busy}
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-space-md left-1/2 -translate-x-1/2 z-[75] max-w-2xl rounded-card px-space-md py-space-sm shadow-card font-label-md text-label-md ${toast.tone === 'warn' ? 'bg-error-container text-on-error-container' : 'bg-inverse-surface text-inverse-on-surface'}`}
          data-pdf-toast=""
        >
          {toast.text}
        </div>
      )}
    </main>
  );
}
